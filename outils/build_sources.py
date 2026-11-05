#!/usr/bin/env python3
"""Construit les couches d'un territoire qui ne viennent pas d'OpenStreetMap.

Pour le territoire donné (--territoire <id>, geoberce par défaut), télécharge chaque source
ouverte, ne garde que ce qui tombe dans la communauté de communes et écrit le même format
de fichier que celui de GéoBercé (couches/...). Chaque source est indépendante : une qui
échoue est signalée, les autres sont quand même écrites.

Sources (--sources a,b,c pour n'en lancer que certaines ; toutes par défaut) :
  mairies         Annuaire de l'administration (service-public.fr) : coordonnées et horaires
  bal             La Poste : boîtes aux lettres de rue (et heure de levée)
  irve            Bornes de recharge de véhicules électriques (fichier consolidé, data.gouv.fr)
  covoiturage     Base nationale des lieux de covoiturage (BNLC)
  franceServices  Structures labellisées France services (ANCT)
  monuments       Immeubles protégés au titre des monuments historiques (Mérimée)
  aleop           Arrêts et lignes du réseau Aléop (GTFS, transport.data.gouv.fr)
  rga             Aléa retrait-gonflement des argiles (Géorisques)
  plui            Zonage des documents d'urbanisme (Géoportail de l'urbanisme)
  dpe             Diagnostics de performance énergétique (ADEME)

Pas encore couvertes : défibrillateurs (source nationale à identifier), petite enfance,
prix de l'immobilier, démographie, parcelles DVF.

Usage : python3 outils/build_sources.py [--territoire <id>] [--sources mairies,bal] [--sortie <dossier>]
"""
import csv
import io
import json
import os
import re
import shutil
import sys
import tempfile
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import zipfile

import territoires_commun
from territoires_commun import Zone  # noqa: F401

TERRITOIRE_ID, ARGS = territoires_commun.separer_argument(sys.argv)
T = territoires_commun.charger(TERRITOIRE_ID)
SORTIE = ARGS[ARGS.index("--sortie") + 1] if "--sortie" in ARGS else T.couches
csv.field_size_limit(sys.maxsize)

# ----------------------------------------------------------------------------------------
# Réseau
# ----------------------------------------------------------------------------------------


def ouvrir(url, essais=6, timeout=180, entetes=None):
    derniere = None
    for i in range(essais):
        try:
            h = {"User-Agent": "geo-territoires (swallowAGE; données ouvertes)"}
            h.update(entetes or {})
            return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout)
        except urllib.error.HTTPError as e:
            corps = re.sub(r"\s+", " ", e.read()[:900].decode("utf8", "ignore"))
            # Serveur surchargé (« pool error », délai dépassé) : on réessaie ; les autres 4xx sont de vraies erreurs.
            if e.code in (401, 403, 404) or (e.code == 400 and not re.search(r"pool error|timeout|timed out", corps, re.I)):
                raise RuntimeError(f"HTTP {e.code} : {url[:120]} {corps}")
            derniere = f"HTTP {e.code} {corps[-160:]}"
        except Exception as e:  # noqa: BLE001 - réseau instable : on réessaie
            derniere = e
        time.sleep(3 + 4 * i)
    raise RuntimeError(f"injoignable après {essais} essais : {url[:120]} ({derniere})")


def json_url(url, **kw):
    with ouvrir(url, **kw) as r:
        return json.load(r)


def fichier_url(url, suffixe=""):
    """Télécharge dans un fichier temporaire (gros fichiers) et renvoie son chemin."""
    chemin = tempfile.mkstemp(suffix=suffixe)[1]
    with ouvrir(url, timeout=600) as r, open(chemin, "wb") as f:
        shutil.copyfileobj(r, f, 1 << 20)
    return chemin


def lignes_csv(chemin, delimiteur=","):
    with open(chemin, encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f, delimiter=delimiteur)


# ----------------------------------------------------------------------------------------
# Contexte du territoire
# ----------------------------------------------------------------------------------------
ZONE, COMMUNES_ZONES = territoires_commun.charger_zones(T)
CODES = list(T.communes)
BBOX = ZONE.boite  # ouest, sud, est, nord


def arrondir(c, n=6):
    if isinstance(c[0], (int, float)):
        return [round(c[0], n), round(c[1], n)]
    return [arrondir(x, n) for x in c]


def point(lon, lat, props):
    return {"type": "Feature", "properties": props, "geometry": {"type": "Point", "coordinates": [round(lon, 7), round(lat, 7)]}}


def dans(lon, lat):
    return ZONE.contient(lon, lat)


def sommet_dedans(geometrie):
    """Vrai si un sommet de la géométrie (Polygon, MultiPolygon, LineString...) est dans le territoire."""
    def parcourir(c):
        if isinstance(c[0], (int, float)):
            yield c
        else:
            for x in c:
                yield from parcourir(x)
    return any(dans(p[0], p[1]) for p in parcourir(geometrie["coordinates"]))


def intersecte(geometrie):
    """Vrai si la géométrie touche le territoire : un de ses sommets est dedans, ou une grande
    zone qui l'englobe (un sommet du contour du territoire est dans la zone)."""
    if sommet_dedans(geometrie):
        return True
    zone = Zone(geometrie)
    return any(zone.contient(p[0], p[1]) for poly in ZONE.polys for p in poly[0][::max(1, len(poly[0]) // 200)])


def flottant(v):
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return None


def vers_bool(v):
    return {"true": True, "false": False, "1": True, "0": False, "oui": True, "non": False}.get(str(v).strip().lower())


# ----------------------------------------------------------------------------------------
# Sources
# ----------------------------------------------------------------------------------------

JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]


def de_commune(nom):
    return ("d'" if nom[:1].lower() in "aeiouhéèêâîôû" else "de ") + nom


def horaires_mairie(plages):
    """[{nom_jour_debut, nom_jour_fin, valeur_heure_debut_1...}] -> « Le Lundi : de 08h30 à 12h00 et de 13h30 à 17h30 »."""
    par_jour = {}
    for p in plages or []:
        try:
            i0, i1 = JOURS.index(p["nom_jour_debut"].capitalize()), JOURS.index(p["nom_jour_fin"].capitalize())
        except (ValueError, KeyError, AttributeError):
            continue
        morceaux = []
        for k in ("1", "2"):
            d, f = p.get("valeur_heure_debut_" + k), p.get("valeur_heure_fin_" + k)
            if d and f:
                morceaux.append("de %sh%s à %sh%s" % (d[:2], d[3:5], f[:2], f[3:5]))
        if not morceaux:
            continue
        for i in range(i0, i1 + 1):
            par_jour.setdefault(JOURS[i], []).extend(morceaux)
    return "\n".join("Le %s : %s" % (j, " et ".join(par_jour[j])) for j in JOURS if j in par_jour) or None


ANNUAIRES = [
    # Annuaire officiel (service-public.fr), puis copie publiée par la Région des Pays de la Loire.
    "https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?",
    "https://data.paysdelaloire.fr/api/explore/v2.1/catalog/datasets/annuaire-de-l-administration-base-de-donnees-locales/records?",
]


def liste_json(v):
    """Les champs imbriqués de l'annuaire sont des listes JSON, parfois encore sous forme de texte."""
    if isinstance(v, str):
        try:
            v = json.loads(v)
        except ValueError:
            return []
    return v if isinstance(v, list) else []


def mairies_de(code):
    derniere = None
    for base in ANNUAIRES:
        try:
            url = base + urllib.parse.urlencode({"limit": 20, "where": f'code_insee_commune="{code}" and nom like "Mairie"'})
            return json_url(url).get("results", [])
        except Exception as e:  # noqa: BLE001 - on tente l'annuaire suivant
            derniere = e
    raise derniere


def src_mairies():
    features = []
    centres = {}
    for code, nom, zone in COMMUNES_ZONES:
        b = zone.boite
        centres[code] = ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
    for code in CODES:
        for x in mairies_de(code):
            nom = x.get("nom") or ""
            if not nom.lower().startswith("mairie"):
                continue
            adresse = (liste_json(x.get("adresse")) or [{}])[0]
            lon, lat = flottant(adresse.get("longitude")), flottant(adresse.get("latitude"))
            if lon is None or lat is None:
                lon, lat = centres[code]
            genre = "Mairie déléguée" if "délégu" in nom.lower() else ("Mairie annexe" if "annexe" in nom.lower() else "Mairie")
            m = re.match(r"^[^-]+-\s*(.+)$", nom)
            lieu = (m.group(1) if m else T.communes[code]).strip()
            tel = liste_json(x.get("telephone")) or [{}]
            web = liste_json(x.get("site_internet")) or [{}]
            features.append(point(lon, lat, {
                "amenity": genre, "name": f"{genre} {de_commune(lieu)}", "commune": T.communes[code],
                "contact_phone": (tel[0] or {}).get("valeur"), "contact_email": x.get("adresse_courriel") or None,
                "contact_website": (web[0] or {}).get("valeur") or None,
                "opening_hours": horaires_mairie(liste_json(x.get("plage_ouverture")))}))
    return [("services/mairies.geojson", "mairies", features)]


def src_bal():
    features = []
    for code in CODES:
        url = "https://data.laposte.fr/data-fair/api/v1/datasets/laposte-boiterue/lines?" + urllib.parse.urlencode({"size": 1000, "qs": f"co_insee_com:{code}"})
        while url:
            j = json_url(url)
            for r in j.get("results", []):
                lon, lat = flottant(r.get("va_coord_adr_x")), flottant(r.get("va_coord_adr_y"))
                if lon is None or lat is None:
                    continue
                features.append(point(lon, lat, {
                    "CO_MUP": r.get("co_mup"), "VA_NO_VOIE": r.get("va_no_voie"), "LB_EXTENSION": r.get("lb_extension"),
                    "LB_VOIE_EXT": r.get("lb_voie_ext"), "LB_COM": r.get("lb_com"),
                    "CO_POSTAL": int(r["co_postal"]) if str(r.get("co_postal", "")).isdigit() else r.get("co_postal"),
                    "CO_INSEE_COM": r.get("co_insee_com"), "VA_COORD_ADR_X": lon, "VA_COORD_ADR_Y": lat,
                    "HDL_SEMAINE_EXTRA": r.get("hdl_semaine_extra"), "HDL_SAMEDI_EXTRA": r.get("hdl_samedi_extra")}))
            url = j.get("next")
    return [("services/bal.geojson", "bal", features)]


def src_irve():
    chemin = fichier_url("https://www.data.gouv.fr/fr/datasets/r/eb76d20a-8501-400e-b336-d85724de5435", ".csv")
    features = []
    for r in lignes_csv(chemin):
        m = re.findall(r"-?\d+(?:\.\d+)?", r.get("coordonneesXY") or "")
        if len(m) < 2:
            continue
        lon, lat = float(m[0]), float(m[1])
        if dans(lon, lat):
            features.append(point(lon, lat, {k: v for k, v in r.items() if k is not None}))
    os.remove(chemin)
    return [("services/irve.geojson", "irve", features)]


def src_covoiturage():
    chemin = fichier_url("https://www.data.gouv.fr/api/1/datasets/r/4fd78dee-e122-4c0d-8bf6-ff55d79f3af1", ".csv")
    features = []
    for r in lignes_csv(chemin):
        lon, lat = flottant(r.get("Xlong")), flottant(r.get("Ylat"))
        if lon is None or lat is None or not (r.get("insee") in T.communes or dans(lon, lat)):
            continue
        props = dict(r)
        props.update({"Xlong": lon, "Ylat": lat, "ouvert": vers_bool(r.get("ouvert")), "lumiere": vers_bool(r.get("lumiere")),
                      "nbre_pl": int(r["nbre_pl"]) if str(r.get("nbre_pl", "")).isdigit() else None,
                      "nbre_pmr": int(r["nbre_pmr"]) if str(r.get("nbre_pmr", "")).isdigit() else None})
        features.append(point(lon, lat, {k: (v if v != "" else None) for k, v in props.items()}))
    os.remove(chemin)
    return [("mobilite/airecovoiturage.geojson", "airecovoiturage", features)]


def src_franceServices():
    chemin = fichier_url("https://www.data.gouv.fr/api/1/datasets/r/31576dff-fd61-4de9-819f-32c2f880b142", ".csv")
    features = []
    for r in lignes_csv(chemin, ";"):
        lon, lat = flottant(r.get("longitude")), flottant(r.get("latitude"))
        if lon is None or lat is None or not (r.get("insee_com") in T.communes or dans(lon, lat)):
            continue
        features.append(point(lon, lat, {k: v for k, v in r.items() if k not in ("latitude", "longitude") and k is not None}))
    os.remove(chemin)
    return [("services/franceServices.geojson", "franceServices", features)]


def src_monuments():
    chemin = fichier_url("https://ministere-culture.s3.sbg.io.cloud.ovh.net/POP/merimee.csv", ".csv")
    features = []
    with open(chemin, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f, delimiter="|", quotechar='"'):
            m = re.findall(r"-?\d+(?:\.\d+)?", r.get("coordonnees_au_format_WGS84") or "")
            if len(m) < 2:
                continue
            a, b = float(m[0]), float(m[1])
            lat, lon = (a, b) if abs(a) > abs(b) else (b, a)
            if not dans(lon, lat):
                continue
            props = {k.lower(): (v[:2000] if v else v) for k, v in r.items() if k and v}
            features.append(point(lon, lat, props))
    os.remove(chemin)
    return [("patrimoine/immeublesProteges.geojson", "immeublesProteges", features)]


def rgb(hexa, defaut=None):
    h = (hexa or "").strip().lstrip("#")
    if re.fullmatch(r"[0-9A-Fa-f]{6}", h):
        return "rgb(%d,%d,%d)" % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    return defaut


def src_aleop():
    chemin = fichier_url("https://www.data.gouv.fr/api/1/datasets/r/916752e4-5daa-48bd-8bc1-4dd8d64f1d4a", ".zip")
    ouest, sud, est, nord = BBOX
    with zipfile.ZipFile(chemin) as z:
        def lire(nom):
            with z.open(nom) as f:
                yield from csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))

        # Arrêts dans le territoire
        arrets = []
        for r in lire("stops.txt"):
            lon, lat = flottant(r.get("stop_lon")), flottant(r.get("stop_lat"))
            if lon is None or lat is None or not dans(lon, lat):
                continue
            acces = {"1": "available", "2": "not available"}.get(str(r.get("wheelchair_boarding", "")).strip(), "unknown")
            arrets.append(point(lon, lat, {
                "code": r.get("stop_code") or None, "description": r.get("stop_desc") or None, "id": r.get("stop_id"),
                "name": r.get("stop_name"), "parent_station": r.get("parent_station") or None, "route_color": None,
                "route_id": None, "route_long_name": None, "route_short_name": None, "route_text_color": None,
                "wheelchair_boarding": acces}))

        # Lignes : formes (shapes) qui traversent le territoire. Deux passes pour ne pas tout garder en mémoire.
        proches = set()
        for r in lire("shapes.txt"):
            lon, lat = flottant(r.get("shape_pt_lon")), flottant(r.get("shape_pt_lat"))
            if lon is not None and lat is not None and ouest <= lon <= est and sud <= lat <= nord and dans(lon, lat):
                proches.add(r["shape_id"])
        points_par_forme = {}
        for r in lire("shapes.txt"):
            if r["shape_id"] in proches:
                points_par_forme.setdefault(r["shape_id"], []).append(
                    (int(float(r.get("shape_pt_sequence") or 0)), round(float(r["shape_pt_lon"]), 5), round(float(r["shape_pt_lat"]), 5)))
        routes = {r["route_id"]: r for r in lire("routes.txt")}
        formes_de_route = {}
        for r in lire("trips.txt"):
            if r.get("shape_id") in points_par_forme:
                formes_de_route.setdefault(r["route_id"], set()).add(r["shape_id"])
    os.remove(chemin)

    lignes = []
    for route_id, formes in formes_de_route.items():
        meilleure = max(formes, key=lambda s: len(points_par_forme[s]))
        coords = [[lon, lat] for _, lon, lat in sorted(points_par_forme[meilleure])]
        r = routes.get(route_id, {})
        lignes.append({"type": "Feature", "geometry": {"type": "LineString", "coordinates": coords}, "properties": {
            "code": None, "description": None, "id": None, "name": None, "parent_station": None,
            "route_color": rgb(r.get("route_color")), "route_id": route_id, "route_long_name": r.get("route_long_name"),
            "route_short_name": r.get("route_short_name"), "route_text_color": rgb(r.get("route_text_color"), "rgb(0,0,0)"),
            "wheelchair_boarding": None}})
    return [("mobilite/arretsALEOP.geojson", "arretsALEOP", arrets), ("mobilite/reseauALEOP.geojson", "reseauALEOP", lignes)]


def wfs_geojson(base, params, taille=500, cles=("startIndex", "count")):
    """Parcourt un service WFS par pages et renvoie toutes les entités.
    `cles` : noms des paramètres de pagination (la passerelle de l'IGN exige les majuscules)."""
    tout, debut = [], 0
    while True:
        p = dict(params)
        p[cles[0]], p[cles[1]] = debut, taille
        j = json_url(base + "?" + urllib.parse.urlencode(p), timeout=300)
        lot = j.get("features", [])
        tout.extend(lot)
        if len(lot) < taille:
            return tout
        debut += taille


def bbox_wfs():
    ouest, sud, est, nord = BBOX
    return f"{sud},{ouest},{nord},{est},urn:ogc:def:crs:EPSG::4326"


def src_rga():
    lot = wfs_geojson("https://www.georisques.gouv.fr/services", {
        "service": "WFS", "version": "2.0.0", "request": "GetFeature", "typeNames": "ms:ALEARG_REALISE",
        "outputFormat": "application/json; subtype=geojson; charset=utf-8", "srsName": "EPSG:4326", "bbox": bbox_wfs()}, 200)
    features = []
    for f in lot:
        if not f.get("geometry") or not intersecte(f["geometry"]):
            continue
        p = f["properties"]
        features.append({"type": "Feature", "geometry": {"type": f["geometry"]["type"], "coordinates": arrondir(f["geometry"]["coordinates"])},
                         "properties": {"gid": int(p["gid"]), "insee_dep": p.get("insee_dep"), "niveau": int(float(p["id"])), "surf_m2": flottant(p.get("surf_m2"))}})
    return [("urbanisme/rga_2025_loir_luce_berce.geojson", "rga", features)]


def src_plui():
    # Zones des documents d'urbanisme du territoire : le PLUi de la communauté de communes (partition DU_<SIREN>)
    # et d'éventuels documents communaux (DU_<code INSEE>). Plus léger et plus précis qu'un filtre par rectangle.
    partitions = ["DU_" + T.siren] + ["DU_" + c for c in CODES]
    cql = "partition IN (" + ",".join("'%s'" % p for p in partitions) + ")"
    lot = wfs_geojson("https://data.geopf.fr/wfs/ows", {
        "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature", "TYPENAMES": "wfs_du:zone_urba",
        "OUTPUTFORMAT": "application/json", "SRSNAME": "EPSG:4326", "CQL_FILTER": cql, "SORTBY": "gid"}, 500, cles=("STARTINDEX", "COUNT"))
    features = []
    for f in lot:
        if not f.get("geometry"):
            continue
        props = {k: v for k, v in f["properties"].items() if k != "gid"}
        geom = f["geometry"]
        features.append({"type": "Feature", "properties": props, "geometry": {"type": geom["type"], "coordinates": arrondir(geom["coordinates"])}})
    return [("urbanisme/zonage_plui_loir_luce_berce_filtre.geojson", "zonage_plui", features)]


def src_dpe():
    features = []
    base = "https://data.ademe.fr/data-fair/api/v1/datasets/meg-83tjwtg8dyz4vv7h1dqe/lines?"
    for code in CODES:
        url = base + urllib.parse.urlencode({"size": 5000, "qs": f"code_insee_ban:{code}"})
        while url:
            j = json_url(url)
            for r in j.get("results", []):
                gp = (r.get("_geopoint") or "").split(",")
                lat, lon = (flottant(gp[0]), flottant(gp[1])) if len(gp) == 2 else (None, None)
                if lat is None or lon is None:
                    continue
                features.append(point(lon, lat, {
                    "numero_dpe": r.get("numero_dpe"), "date_etablissement_dpe": r.get("date_etablissement_dpe"),
                    "date_reception_dpe": r.get("date_reception_dpe"), "date_fin_validite_dpe": r.get("date_fin_validite_dpe"),
                    "date_derniere_modification_dpe": r.get("date_derniere_modification_dpe"),
                    "etiquette_dpe": r.get("etiquette_dpe"), "etiquette_ges": r.get("etiquette_ges"),
                    "consommation": r.get("conso_5_usages_par_m2_ep"), "emissions_ges": r.get("emission_ges_5_usages_par_m2"),
                    "surface_habitable": r.get("surface_habitable_logement"), "surface_habitable_immeuble": r.get("surface_habitable_immeuble"),
                    "annee_construction": r.get("annee_construction"), "periode_construction": r.get("periode_construction"),
                    "type_batiment": r.get("type_batiment"), "chauffage": r.get("type_generateur_chauffage_principal"),
                    "energie_chauffage": r.get("type_energie_principale_chauffage"), "ecs": r.get("type_generateur_n1_ecs_n1"),
                    "energie_ecs": r.get("type_energie_principale_ecs"), "code_insee": r.get("code_insee_ban"),
                    "code_postal": r.get("code_postal_ban"), "commune": r.get("nom_commune_ban"), "adresse": r.get("adresse_ban"),
                    "nom_rue": r.get("nom_rue_ban"), "numero_voie": r.get("numero_voie_ban"),
                    "identifiant_ban": r.get("identifiant_ban"), "id_rnb": r.get("id_rnb"), "statut_geocodage": r.get("statut_geocodage")}))
            url = j.get("next")
    return [("urbanisme/dpe_loir_luce_berce.geojson", "dpe", features)]


SOURCES = {
    "mairies": src_mairies, "bal": src_bal, "irve": src_irve, "covoiturage": src_covoiturage,
    "franceServices": src_franceServices, "monuments": src_monuments, "aleop": src_aleop,
    "rga": src_rga, "plui": src_plui, "dpe": src_dpe,
}


def ecrire(chemin_relatif, nom, features):
    chemin = os.path.join(SORTIE, chemin_relatif)
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "name": nom, "features": features}, f, ensure_ascii=False, separators=(",", ":"))


def main():
    voulues = ARGS[ARGS.index("--sources") + 1].split(",") if "--sources" in ARGS else list(SOURCES)
    inconnues = [s for s in voulues if s not in SOURCES]
    if inconnues:
        sys.exit("Sources inconnues : %s (disponibles : %s)" % (", ".join(inconnues), ", ".join(SOURCES)))
    echecs = []
    for nom in voulues:
        print(f"== {nom}")
        try:
            sorties = SOURCES[nom]()
            for chemin, couche, features in sorties:
                if not features:
                    print(f"  {couche} : aucun résultat (fichier non écrit)")
                    echecs.append(nom + " (vide)")
                    continue
                ecrire(chemin, couche, features)
                print(f"  {couche} : {len(features)} -> {chemin}")
        except Exception as e:  # noqa: BLE001 - une source ne doit pas bloquer les autres
            echecs.append(nom)
            print(f"  ÉCHEC : {e}")
            traceback.print_exc(limit=2)
    if echecs:
        print("À revoir :", ", ".join(echecs))
        sys.exit(1)


if __name__ == "__main__":
    main()
