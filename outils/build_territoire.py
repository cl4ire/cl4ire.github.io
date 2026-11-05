#!/usr/bin/env python3
"""Génère les fichiers de base d'un territoire (GéoSudSarthe, GéoBelinois...).

Pour un identifiant de TERRITOIRES ci-dessous, écrit :
  territoires/<id>/territoire.js               nom, communes, centre, SIREN...
  territoires/<id>/couches/communes.geojson    contours des communes
  territoires/<id>/couches/epci.geojson        contour de la communauté de communes

Sources officielles :
  - geo.api.gouv.fr  : communes de l'EPCI (code INSEE, nom, population, centre)
  - data.geopf.fr    : contours Admin Express (IGN), couches commune et epci

Les propriétés des communes reprennent les noms (tronqués) du fichier de
GéoBercé (couches/communes.geojson) pour que le code de la carte soit le même.

Usage : python3 outils/build_territoire.py geosudsarthe [geobelinois ...]
Sans argument : tous les territoires de la liste.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ajouter un territoire = ajouter une entrée ici, puis relancer ce script.
TERRITOIRES = {
    "geosudsarthe": {
        "nom": "GéoSudSarthe",
        "nomComplet": "Sud Sarthe",
        "comcom": "Communauté de communes Sud Sarthe",
        "siren": "200073112",
        "zoom": 11,
    },
    "geobelinois": {
        "nom": "GéoBelinois",
        "nomComplet": "Orée de Bercé-Bélinois",
        "comcom": "Communauté de communes Orée de Bercé – Bélinois",
        "siren": "247200447",
        "zoom": 12,
    },
}

URL_PROD = "https://hirundoage.github.io/{id}/"
GEO_API = "https://geo.api.gouv.fr/epcis/{siren}/communes?fields=nom,code,population,centre"
WFS = "https://data.geopf.fr/wfs/ows"


def telecharger(url, essais=8):
    """GET avec réessais : les connexions de l'environnement de dev sont parfois coupées."""
    derniere = None
    for i in range(essais):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "geo-territoires"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001 - on réessaie quel que soit l'incident réseau
            derniere = e
            time.sleep(3 + 2 * i)
    raise RuntimeError(f"Échec après {essais} essais : {url} ({derniere})")


def wfs(couche, filtre):
    params = {
        "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature",
        "TYPENAMES": f"ADMINEXPRESS-COG.LATEST:{couche}",
        "OUTPUTFORMAT": "application/json", "SRSNAME": "EPSG:4326", "CQL_FILTER": filtre,
    }
    return telecharger(WFS + "?" + urllib.parse.urlencode(params))


def arrondir(coords, n=6):
    if isinstance(coords[0], (int, float)):
        return [round(c, n) for c in coords]
    return [arrondir(c, n) for c in coords]


def ecrire_geojson(chemin, nom, features):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "name": nom, "features": features}, f, ensure_ascii=False, separators=(",", ":"))


def construire(identifiant):
    conf = TERRITOIRES[identifiant]
    siren = conf["siren"]
    base = os.path.join(RACINE, "territoires", identifiant)

    communes = sorted(telecharger(GEO_API.format(siren=siren)), key=lambda c: c["code"])
    codes = [c["code"] for c in communes]
    if not codes:
        raise RuntimeError(f"Aucune commune trouvée pour le SIREN {siren}")

    # Contours des communes, avec les noms de propriétés de couches/communes.geojson de GéoBercé
    brutes = wfs("commune", "code_insee IN ('" + "','".join(codes) + "')")["features"]
    if len(brutes) != len(codes):
        raise RuntimeError(f"{len(brutes)} contours reçus pour {len(codes)} communes")
    features = []
    for f in sorted(brutes, key=lambda f: f["properties"]["code_insee"]):
        p = f["properties"]
        features.append({"type": "Feature", "properties": {
            "cleabs": p.get("cleabs"), "nom_offici": p.get("nom_officiel"), "nom_offi_1": p.get("nom_officiel_en_majuscules"),
            "statut": p.get("statut"), "code_insee": p.get("code_insee"), "population": p.get("population"),
            "codes_sire": p.get("codes_siren_des_epci"), "code_siren": p.get("code_siren"),
            "code_posta": p.get("code_postal"), "superficie": p.get("superficie_cadastrale"),
        }, "geometry": {"type": f["geometry"]["type"], "coordinates": arrondir(f["geometry"]["coordinates"])}})
    ecrire_geojson(os.path.join(base, "couches", "communes.geojson"), "communes", features)

    epci = wfs("epci", f"code_siren='{siren}'")["features"]
    if len(epci) != 1:
        raise RuntimeError(f"{len(epci)} EPCI trouvés pour le SIREN {siren}")
    e = epci[0]
    ecrire_geojson(os.path.join(base, "couches", "epci.geojson"), "epci", [{"type": "Feature", "properties": {
        "cleabs": e["properties"].get("cleabs"), "nom_offici": e["properties"].get("nom_officiel"),
        "nature": e["properties"].get("nature"), "code_siren": e["properties"].get("code_siren"),
    }, "geometry": {"type": e["geometry"]["type"], "coordinates": arrondir(e["geometry"]["coordinates"])}}])

    # Centre de la carte : moyenne des centres des communes
    lons = [c["centre"]["coordinates"][0] for c in communes]
    lats = [c["centre"]["coordinates"][1] for c in communes]
    centre = [round(sum(lats) / len(lats), 6), round(sum(lons) / len(lons), 6)]

    lignes = ",\n".join(f'        "{c["code"]}": {json.dumps(c["nom"], ensure_ascii=False)}' for c in communes)
    contenu = f'''/* =========================================================
   {conf["nom"]} — FICHIER DE TERRITOIRE (généré par outils/build_territoire.py)
   Voir js/territoire.js (GéoBercé) pour le détail de chaque champ.
   ========================================================= */
const TERRITOIRE = {{
    id: "{identifiant}",
    nom: {json.dumps(conf["nom"], ensure_ascii=False)},
    nomComplet: {json.dumps(conf["nomComplet"], ensure_ascii=False)},
    comcom: {json.dumps(conf["comcom"], ensure_ascii=False)},
    urlProd: "{URL_PROD.format(id=identifiant)}",
    centre: {json.dumps(centre)},
    zoom: {conf["zoom"]},
    rayonCarburantsM: 25000,
    siren: "{siren}",

    /* À renseigner : actualités (voir js/territoire.js : Illiwap, lien ou null)
       et sous-domaine GoatCounter. null = pas de bouton / pas de suivi. */
    actualites: null,
    goatcounter: null,

    couchesExclues: [],

    /* Fichiers de couches/ réellement disponibles pour ce territoire
       (couches/communes.geojson et epci.geojson sont toujours présents).
       Une couche de js/config.js dont un fichier local n'est pas dans cette
       liste n'est pas affichée. À compléter au fil des scripts de données. */
    fichiersDisponibles: [],

    communes: {{
{lignes}
    }}
}};
'''
    os.makedirs(base, exist_ok=True)
    with open(os.path.join(base, "territoire.js"), "w", encoding="utf-8") as f:
        f.write(contenu)
    print(f"{identifiant} : {len(communes)} communes, centre {centre}, "
          f"{sum(c.get('population', 0) for c in communes)} habitants")


if __name__ == "__main__":
    for ident in (sys.argv[1:] or list(TERRITOIRES)):
        if ident not in TERRITOIRES:
            sys.exit(f"Territoire inconnu : {ident} (connus : {', '.join(TERRITOIRES)})")
        construire(ident)
