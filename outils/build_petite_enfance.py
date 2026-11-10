#!/usr/bin/env python3
"""Couche « Petite enfance » d'un territoire à partir des exports saisis à la main.

Il n'existe pas de liste ouverte des assistantes maternelles de la Sarthe : on part des exports
de monenfant.fr, un fichier CSV par commune, déposés dans

    territoires/<id>/saisie/assistantes-maternelles/<commune>.csv

Colonnes lues : Nom ; Adresse ; Position (facultative : « latitude,longitude », prioritaire sur l'adresse) ; Téléphone ; E-mail ; Fiche monenfant.fr (les autres, dont « Disponibilité » trop vite
périmée et « Distance », sont ignorées). Chaque adresse est géolocalisée avec la Base adresse
nationale (Géoplateforme) ; une ligne sans adresse, ou introuvable, n'est pas placée sur la carte
et figure dans le rapport. Écrit couches/famille/petiteEnfance.geojson.

Usage : python3 outils/build_petite_enfance.py [--territoire <id>] [--sortie <dossier>]
"""
import csv
import glob
import json
import os
import re
import sys
import urllib.parse

import build_sources as S

T = S.T
DOSSIER = os.path.join(S.territoires_commun.RACINE, "territoires", T.id, "saisie", "assistantes-maternelles")
GEOCODEUR = "https://data.geopf.fr/geocodage/search?"


def telephone(v):
    chiffres = re.sub(r"\D", "", v or "")
    if len(chiffres) == 10:
        return " ".join(chiffres[i:i + 2] for i in range(0, 10, 2))
    return (v or "").strip() or None


def geocoder(adresse):
    """(lon, lat) de l'adresse, ou None si introuvable ou hors du territoire."""
    m = re.search(r"\b(\d{5})\b", adresse)
    params = {"q": adresse, "limit": 1}
    if m:
        params["postcode"] = m.group(1)
    j = S.json_url(GEOCODEUR + urllib.parse.urlencode(params))
    for r in j.get("features", []):
        # une commune entière n'est pas une adresse : on ne place pas au hasard au centre du bourg
        if (r["properties"].get("score") or 0) < 0.5 or r["properties"].get("type") == "municipality":
            continue
        lon, lat = r["geometry"]["coordinates"]
        if S.dans(lon, lat):
            return lon, lat
    return None


def position_saisie(v):
    """Colonne facultative « Position » (latitude,longitude relevées sur la carte) : prioritaire sur l'adresse."""
    m = re.fullmatch(r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*", v or "")
    if not m:
        return None
    lat, lon = float(m.group(1)), float(m.group(2))
    return (lon, lat) if S.dans(lon, lat) else None


def lire(chemin):
    with open(chemin, encoding="utf-8-sig", newline="") as f:
        echantillon = f.read(2048)
        f.seek(0)
        delim = ";" if echantillon.count(";") >= echantillon.count(",") else ","
        yield from csv.DictReader(f, delimiter=delim)


def distance_m(a, b):
    from math import cos, radians, hypot
    return hypot((a[0] - b[0]) * 111320 * cos(radians(a[1])), (a[1] - b[1]) * 110540)


def normaliser(t):
    import unicodedata
    return re.sub(r"[^a-z0-9]+", "", "".join(c for c in unicodedata.normalize("NFD", (t or "").lower()) if unicodedata.category(c) != "Mn"))


def structures_saisies():
    """Crèches et relais saisis à la main : territoires/<id>/saisie/structures-petite-enfance.csv
    (Type ; Nom ; Adresse ; Téléphone ; E-mail ; Lien ; Précisions)."""
    chemin = os.path.join(S.territoires_commun.RACINE, "territoires", T.id, "saisie", "structures-petite-enfance.csv")
    out, non_places = [], []
    if not os.path.isfile(chemin):
        return out, non_places
    for r in lire(chemin):
        nom, adresse = (r.get("Nom") or "").strip(), (r.get("Adresse") or "").strip()
        if not nom:
            continue
        pos = geocoder(adresse) if adresse else None
        if not pos:
            non_places.append(f"{nom} ({adresse or 'pas d adresse'})")
            continue
        out.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(pos[0], 6), round(pos[1], 6)]},
                    "properties": {"nom": nom, "adresse": adresse, "telephone": telephone(r.get("Téléphone")),
                                   "mail": (r.get("E-mail") or "").strip() or None, "ficheCAF": (r.get("Lien") or "").strip() or None,
                                   "type": (r.get("Type") or "Crèche").strip(), "precision": (r.get("Précisions") or "").strip() or None}})
    return out, non_places


def structures_osm(deja):
    """Crèches et relais d'OpenStreetMap (build_osm.py), sauf ceux déjà saisis (même nom ou à moins de 300 m)."""
    chemin = os.path.join(T.couches, "famille", "structures_pe_osm.geojson")
    if not os.path.isfile(chemin):
        return []
    with open(chemin, encoding="utf-8") as f:
        brut = json.load(f)["features"]
    out = []
    for ft in brut:
        p = ft["properties"]
        pos = ft["geometry"]["coordinates"]
        if any(normaliser(p.get("nom")) == normaliser(d["properties"]["nom"]) or
               (p.get("type") == d["properties"]["type"] and distance_m(pos, d["geometry"]["coordinates"]) < 300) for d in deja):
            continue
        precision = " · ".join(x for x in ((f"{p['capacite']} places" if p.get("capacite") else None), (f"Horaires : {p['horaires']}" if p.get("horaires") else None)) if x) or None
        out.append({"type": "Feature", "geometry": ft["geometry"],
                    "properties": {"nom": p.get("nom"), "adresse": p.get("adresse"), "telephone": telephone(p.get("telephone")),
                                   "mail": p.get("mail"), "ficheCAF": p.get("site"), "type": p.get("type"), "precision": precision}})
    return out


def main():
    fichiers = sorted(glob.glob(os.path.join(DOSSIER, "*.csv")))
    features, non_places, vus = [], [], set()
    for chemin in fichiers:
        n = 0
        for r in lire(chemin):
            nom = (r.get("Nom") or "").strip()
            if not nom:
                continue
            adresse = (r.get("Adresse") or "").strip()
            cle = (nom.lower(), adresse.lower())
            if cle in vus:
                continue
            vus.add(cle)
            position = position_saisie(r.get("Position")) or (geocoder(adresse) if adresse else None)
            if not position:
                non_places.append(f"{nom} ({adresse or 'pas d adresse'})")
                continue
            n += 1
            features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(position[0], 6), round(position[1], 6)]},
                             "properties": {"nom": nom, "adresse": adresse, "telephone": telephone(r.get("Téléphone")),
                                            "mail": (r.get("E-mail") or "").strip() or None, "ficheCAF": (r.get("Fiche monenfant.fr") or "").strip() or None,
                                            "type": "Assistant maternel"}})
        print(f"  {os.path.basename(chemin)} : {n} placés")
    if non_places:
        print(f"  {len(non_places)} assistantes maternelles non placées (adresse absente, incomplète ou hors du territoire) : " + " / ".join(non_places))
    saisies, saisies_non_placees = structures_saisies()
    osm = structures_osm(saisies)
    print(f"  structures saisies : {len(saisies)} ; trouvées sur OpenStreetMap : {len(osm)}" + (f" ; non placées : {' / '.join(saisies_non_placees)}" if saisies_non_placees else ""))
    for x in saisies + osm:
        print(f"    {x['properties']['type']} : {x['properties']['nom']} ({x['properties'].get('adresse') or 'sans adresse'})")
    features += saisies + osm
    if not features:
        print(f"Pas d'export dans {os.path.relpath(DOSSIER, S.territoires_commun.RACINE)} ni de structure : couche petite enfance ignorée.")
        return
    S.ecrire("famille/petiteEnfance.geojson", "petiteEnfance", features)
    print(f"  petiteEnfance : {len(features)} -> famille/petiteEnfance.geojson")


if __name__ == "__main__":
    main()
