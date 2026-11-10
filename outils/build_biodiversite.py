#!/usr/bin/env python3
"""Fiche « Nature » de chaque commune d'un territoire, depuis les observations ouvertes de GBIF.

GBIF (gbif.org) rassemble les observations de faune et de flore publiées en données ouvertes
(INPN / SINP, iNaturalist, eBird...). Pour chaque commune on interroge son contour et on garde
seulement des chiffres agrégés (aucune observation individuelle n'est republiée) :

  - nombre d'observations et d'espèces, par grand groupe (oiseaux, mammifères, reptiles,
    amphibiens, insectes, plantes) ;
  - espèces menacées ou quasi menacées (liste rouge UICN : CR, EN, VU, NT), avec leur nom français.

Écrit nature/biodiversite_communes.json : { "communes": { "<code INSEE>": {...} }, "maj": "AAAA-MM-JJ" }.
Les observations de Faune-Maine ne sont pas toutes reprises par GBIF : la fiche renvoie aussi vers ce portail.

Usage : python3 outils/build_biodiversite.py [--territoire <id>] [--sortie <dossier>]
"""
import datetime
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

import build_sources as S

T = S.T
API = "https://api.gbif.org/v1/"
# Observations réelles seulement (ni spécimens de musée, ni fossiles), sans anomalie de position.
FILTRES = {"hasCoordinate": "true", "hasGeospatialIssue": "false", "occurrenceStatus": "PRESENT",
           "basisOfRecord": ["HUMAN_OBSERVATION", "OBSERVATION", "MACHINE_OBSERVATION"]}
GROUPES = [  # (clé, libellé, paramètre GBIF)
    ("oiseaux", "Oiseaux", ("classKey", 212)),
    ("mammiferes", "Mammifères", ("classKey", 359)),
    ("reptiles", "Reptiles", ("classKey", 358)),
    ("amphibiens", "Amphibiens", ("classKey", 131)),
    ("insectes", "Insectes", ("classKey", 216)),
    ("plantes", "Plantes", ("kingdomKey", 6)),
]
GRAVITE = {"CR": 0, "EN": 1, "VU": 2, "NT": 3}
NOMS_FR = {}
EXCLUES = {"Oryctolagus cuniculus"}


def appel(chemin, **params):
    url = API + chemin + "?" + urllib.parse.urlencode(params, doseq=True)
    derniere = None
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "hirundage-sig"}), timeout=90) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 - réseau instable : on recommence
            derniere = e
            time.sleep(3 * (k + 1))
    raise RuntimeError(f"GBIF : {url} ({derniere})")


# ----------------------------------------------------------------------------------------
# Contour de la commune -> WKT simplifié (GBIF refuse les polygones trop détaillés)
# ----------------------------------------------------------------------------------------

def _distance_segment(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dx == dy == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def simplifier(points, tolerance):
    """Douglas-Peucker (version itérative, les contours ont plusieurs milliers de points)."""
    garde = [False] * len(points)
    garde[0] = garde[-1] = True
    pile = [(0, len(points) - 1)]
    while pile:
        i, j = pile.pop()
        dmax, imax = 0, None
        for k in range(i + 1, j):
            d = _distance_segment(points[k], points[i], points[j])
            if d > dmax:
                dmax, imax = d, k
        if imax is not None and dmax > tolerance:
            garde[imax] = True
            pile += [(i, imax), (imax, j)]
    return [p for p, g in zip(points, garde) if g]


def aire_signee(points):
    return sum(points[i][0] * points[(i + 1) % len(points)][1] - points[(i + 1) % len(points)][0] * points[i][1] for i in range(len(points))) / 2


def wkt_polygones(geometrie):
    polys = geometrie["coordinates"] if geometrie["type"] == "MultiPolygon" else [geometrie["coordinates"]]
    wkts = []
    for poly in polys:
        anneau = [tuple(p[:2]) for p in poly[0]]
        if anneau[0] == anneau[-1]:
            anneau = anneau[:-1]
        tol = 0.0004
        simple = simplifier(anneau + [anneau[0]], tol)[:-1]
        while len(simple) > 150:
            tol *= 1.6
            simple = simplifier(anneau + [anneau[0]], tol)[:-1]
        if len(simple) < 3:
            continue
        if aire_signee(simple) < 0:  # GBIF veut l'anneau extérieur dans le sens trigonométrique
            simple.reverse()
        wkts.append("POLYGON((" + ", ".join(f"{x:.5f} {y:.5f}" for x, y in simple + [simple[0]]) + "))")
    return wkts


# ----------------------------------------------------------------------------------------
# Interrogation de GBIF
# ----------------------------------------------------------------------------------------

def facette(geometries, champ, limite, **plus):
    r = appel("occurrence/search", geometry=geometries, limit=0, facet=champ, facetLimit=limite, **FILTRES, **plus)
    return r["count"], (r["facets"][0]["counts"] if r.get("facets") else [])


def nom_francais(cle, nom_latin):
    if cle in NOMS_FR:
        return NOMS_FR[cle]
    francais = None
    try:
        noms = appel(f"species/{cle}/vernacularNames", limit=200)["results"]
        fr = [n["vernacularName"] for n in noms if n.get("language") == "fra" and n.get("vernacularName")]
        if fr:
            francais = min(fr, key=len)[0].upper() + min(fr, key=len)[1:]
    except RuntimeError:
        pass
    NOMS_FR[cle] = {"nom": francais or nom_latin, "latin": nom_latin if francais else None}
    return NOMS_FR[cle]


def fiche_commune(geometrie):
    geoms = wkt_polygones(geometrie)
    total, _ = facette(geoms, "speciesKey", 1)
    if not total:
        return None
    # le nombre d'espèces distinctes = nombre de valeurs de la facette ; on demande la liste complète
    _, toutes = facette(geoms, "speciesKey", 5000)
    fiche = {"observations": total, "especes": len(toutes), "groupes": {}}
    for cle, _libelle, (champ, valeur) in GROUPES:
        _, liste = facette(geoms, "speciesKey", 5000, **{champ: valeur})
        if liste:
            fiche["groupes"][cle] = len(liste)
    # espèces menacées / quasi menacées
    menacees = []
    for cat in GRAVITE:
        _, liste = facette(geoms, "speciesKey", 100, iucnRedListCategory=cat)
        menacees += [(GRAVITE[cat], -int(c["count"]), int(c["name"]), cat) for c in liste]
    menacees.sort()
    fiche["remarquables"] = []
    compte = 0
    for _g, neg, cle, cat in menacees:
        info = appel(f"species/{cle}")
        latin = info.get("canonicalName") or info.get("scientificName")
        # Pas de plantes : arbres plantés et espèces de jardin y dominent. Le lapin de garenne n'est « menacé »
        # que sur la liste mondiale, alors qu'il est très commun en France.
        if info.get("kingdom") != "Animalia" or latin in EXCLUES:
            continue
        compte += 1
        if len(fiche["remarquables"]) < 8:
            n = nom_francais(cle, latin)
            fiche["remarquables"].append({"nom": n["nom"], "latin": n["latin"], "statut": cat, "observations": -neg,
                                          "groupe": info.get("class") or info.get("kingdom")})
    fiche["menacees_total"] = compte
    return fiche


def main():
    with open(os.path.join(T.couches, "communes.geojson"), encoding="utf-8") as f:
        geoms = {c["properties"]["code_insee"]: c["geometry"] for c in json.load(f)["features"]}
    resultat, manques = {}, []
    for code, nom in T.communes.items():
        if code not in geoms:
            manques.append(f"{nom} (pas de contour)")
            continue
        try:
            fiche = fiche_commune(geoms[code])
        except Exception as e:  # noqa: BLE001 - une commune en échec ne bloque pas les autres
            manques.append(f"{nom} ({e})")
            continue
        if not fiche:
            manques.append(f"{nom} (aucune observation)")
            continue
        resultat[code] = fiche
        print(f"  {nom} : {fiche['observations']} observations, {fiche['especes']} espèces, {fiche['menacees_total']} menacées ou quasi menacées")
    if manques:
        print("  sans données :", " / ".join(manques))
    if not resultat:
        sys.exit("aucune commune renseignée")
    chemin = os.path.join(S.SORTIE, "nature", "biodiversite_communes.json")
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump({"maj": datetime.date.today().isoformat(), "source": "GBIF", "communes": resultat}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  biodiversité : {len(resultat)} commune(s) -> nature/biodiversite_communes.json")


if __name__ == "__main__":
    main()
