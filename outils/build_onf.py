"""Forêt : parcelles forestières publiques (ONF) et points de rencontre des secours en forêt.

- Parcelles forestières publiques : jeu « Parcelles forestières publiques (diffusion
  publique) » de l'ONF (data.gouv.fr). Le flux WFS d'origine (ws.carmencarto.fr) ne
  répond pas en HTTPS ; on lit la copie publiée par Esri France sur ArcGIS Online
  (même jeu ONF, millésime 2019), qui accepte les requêtes par zone.
  Le numéro de parcelle (ccod_prf) est celui des affiches de chasse de l'ONF.
- Points de rencontre des secours en forêt (PRSF) : couche nationale diffusée par
  l'IGN (Géoplateforme, PROTECTEDAREAS.PRSF:prsf).

Usage : python3 outils/build_onf.py [--territoire <id>]
Écrit <couches>/chasse/parcelles_forestieres.geojson et <couches>/securite/prsf.geojson.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import territoires_commun as tc  # noqa: E402

URL_PARCELLES = ("https://services.arcgis.com/d3voDfTFbHOCRwVR/ArcGIS/rest/services/"
                 "Parcelles_foresti%C3%A8res_publiques_WME/FeatureServer/0/query")
URL_PRSF = "https://data.geopf.fr/wfs/ows"


def lire_json(url):
    with urllib.request.urlopen(url, timeout=180) as r:
        return json.load(r)


def arrondir(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 6), round(coords[1], 6)]
    return [arrondir(c) for c in coords]


def reparer_texte(v):
    """Le flux PRSF renvoie de l'UTF-8 lu comme du Latin-1 (« JUPILLES », « THOIRÃ‰ »...)."""
    if isinstance(v, str) and "Ã" in v:
        try:
            return v.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return v
    return v


def parcelles(boite, zone):
    """Toutes les parcelles des forêts qui touchent le territoire, y compris leurs parcelles
    situées juste à côté (une forêt domaniale comme Bercé déborde sur les communautés de
    communes voisines, et ses lots de chasse aussi)."""
    params = {
        "where": "1=1", "geometry": ",".join(str(v) for v in boite), "geometryType": "esriGeometryEnvelope",
        "inSR": "4326", "spatialRel": "esriSpatialRelIntersects", "outFields": "iidtn_frt,llib_frt,ccod_prf",
        "returnGeometry": "true", "outSR": "4326", "f": "geojson", "resultRecordCount": "2000",
    }
    marge = 0.08  # ~6-9 km autour du territoire
    boite = (boite[0] - marge, boite[1] - marge, boite[2] + marge, boite[3] + marge)
    params["geometry"] = ",".join(str(v) for v in boite)
    data = lire_json(URL_PARCELLES + "?" + urllib.parse.urlencode(params))
    forets = set()
    for f in data.get("features", []):
        sommets = [p for poly in tc.polygones(f["geometry"]) for p in poly[0]]
        if any(zone.contient(*p) for p in sommets):
            forets.add(f["properties"].get("iidtn_frt"))
    sortie = []
    for f in data.get("features", []):
        if f["properties"].get("iidtn_frt") not in forets:
            continue
        p = f["properties"]
        sortie.append({"type": "Feature", "geometry": {"type": f["geometry"]["type"], "coordinates": arrondir(f["geometry"]["coordinates"])},
                       "properties": {"foret": p.get("llib_frt"), "code_foret": p.get("iidtn_frt"), "parcelle": p.get("ccod_prf")}})
    return sortie


def prsf(boite, codes, parcelles_gardees):
    """Points des communes du territoire, plus ceux situés dans une des forêts gardées."""
    zones_forets = [tc.Zone(f["geometry"]) for f in parcelles_gardees]
    boite = (boite[0] - 0.08, boite[1] - 0.08, boite[2] + 0.08, boite[3] + 0.08)
    params = {
        "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature", "TYPENAMES": "PROTECTEDAREAS.PRSF:prsf",
        "OUTPUTFORMAT": "application/json", "SRSNAME": "EPSG:4326", "COUNT": "2000",
        "BBOX": ",".join(str(v) for v in boite) + ",EPSG:4326",
    }
    data = lire_json(URL_PRSF + "?" + urllib.parse.urlencode(params))
    sortie = []
    for f in data.get("features", []):
        p = {k: reparer_texte(v) for k, v in f["properties"].items()}
        x, y = f["geometry"]["coordinates"][:2]
        if p.get("insee_com") not in codes and not any(z.contient(x, y) for z in zones_forets):
            continue
        sortie.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "code": p.get("code_prsf"), "description": (p.get("desc_prsf") or "").strip(), "commune": p.get("nom_com"),
            "insee": p.get("insee_com"), "coord_dfci": p.get("coord_dfci"), "reseau_tel": p.get("reseau_tel"),
            "accessible": p.get("accessible"), "stationnement": p.get("stationnement"),
            "panneau": p.get("panneau"), "gestionnaire": p.get("gestionnaire")}})
    return sortie


def ecrire(chemin, features, source):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "source": source, "features": features}, f,
                  ensure_ascii=False, separators=(",", ":"))


def main():
    ident, _ = tc.separer_argument(sys.argv)
    territoire = tc.charger(ident)
    zone, _communes = tc.charger_zones(territoire)
    boite = zone.boite  # (lon min, lat min, lon max, lat max)

    p = parcelles(boite, zone)
    ecrire(os.path.join(territoire.couches, "chasse", "parcelles_forestieres.geojson"), p,
           "ONF - parcelles forestières publiques (data.gouv.fr), copie Esri France ArcGIS Online")
    print(f"parcelles forestières : {len(p)}")

    s = prsf(boite, set(territoire.communes), p)
    ecrire(os.path.join(territoire.couches, "securite", "prsf.geojson"), s,
           "IGN Géoplateforme - points de rencontre des secours en forêt (PRSF)")
    print(f"points de rencontre des secours : {len(s)}")


if __name__ == "__main__":
    main()
