#!/usr/bin/env python3
"""Extrait de OpenStreetMap les couches d'un territoire et les range dans couches/.

Pour le territoire donné (--territoire <id>, geoberce par défaut) :
  1. interroge Overpass sur le rectangle englobant de la communauté de communes ;
  2. ne garde que ce qui tombe vraiment dans son contour (couches/epci.geojson) ;
  3. range chaque objet dans sa couche d'après ses tags OpenStreetMap ;
  4. rattache chaque point à sa commune (couches/communes.geojson) ;
  5. écrit un fichier .geojson par couche, au même format que celles de GéoBercé.

Couches produites : commerces, banques, education, parkings, toilettes, fontaines, dechets,
bibliotheques, marches, airesJeu, equipementSportif, antennes, lockers_osm, pompiers,
gendarmerie, ehpad, officesTourisme, campingcar, patrimoineRural, cours_eau, velo,
randonnees_osm. Les fichiers de complément saisis à la main (lockers_manuels,
randonnees) sont créés vides s'ils n'existent pas.

La couverture est celle d'OpenStreetMap au moment de l'extraction : relancer ce script
(workflow « Données des territoires ») pour mettre à jour.

Usage : python3 outils/build_osm.py [--territoire <id>] [--essai points.json,lignes.json] [--sortie <dossier>]
  --essai : lit des réponses Overpass déjà enregistrées (points et lignes, deux fichiers
            séparés par une virgule) au lieu d'interroger le réseau.
"""
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import territoires_commun

TERRITOIRE_ID, ARGS = territoires_commun.separer_argument(sys.argv)
T = territoires_commun.charger(TERRITOIRE_ID)
# --sortie <dossier> : écrire ailleurs que dans les couches du territoire (essais).
SORTIE = ARGS[ARGS.index("--sortie") + 1] if "--sortie" in ARGS else T.couches

MIROIRS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# ----------------------------------------------------------------------------------------
# Géométrie
# ----------------------------------------------------------------------------------------


from territoires_commun import Zone, commune_de, dans_anneau, polygones  # noqa: E402,F401


def charger_zones():
    return territoires_commun.charger_zones(T)


def haversine_km(a, b):
    r = 6371.0088
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dp, dl = p2 - p1, math.radians(b[0] - a[0])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


# ----------------------------------------------------------------------------------------
# Overpass
# ----------------------------------------------------------------------------------------

AMENITES = ("restaurant|bar|pub|fast_food|pharmacy|post_office|fuel|car_wash|vehicle_inspection|driving_school|cinema|"
            "bank|atm|school|college|kindergarten|parking|toilets|drinking_water|library|marketplace|parcel_locker|"
            "fire_station|police|social_facility|fountain|washing_place|recycling")
LOISIRS = "playground|pitch|sports_centre|swimming_pool|track|horse_riding|recreation_ground|fitness_station"


def requete_points(bbox):
    b = ",".join(str(round(v, 5)) for v in bbox)  # sud, ouest, nord, est
    return f"""[out:json][timeout:240];
(
  nwr["shop"]({b});
  nwr["amenity"~"^({AMENITES})$"]({b});
  nwr["office"~"^(insurance|estate_agent|association)$"]({b});
  nwr["craft"~"^(photographer|caterer|handicraft|winery)$"]({b});
  nwr["tourism"~"^(museum|information|caravan_site)$"]({b});
  nwr["leisure"~"^({LOISIRS})$"]({b});
  nwr["man_made"~"^(mast|watermill|windmill)$"]({b});
  nwr["historic"~"^(wayside_cross|wayside_shrine|calvary)$"]({b});
);
out center tags;"""


def requete_lignes(bbox):
    b = ",".join(str(round(v, 5)) for v in bbox)
    return f"""[out:json][timeout:240];
(
  way["waterway"~"^(river|stream|canal|drain|ditch)$"]({b});
  relation["route"~"^(bicycle|hiking)$"]({b});
);
out geom tags;"""


def interroger(requete, essais_par_miroir=3):
    derniere = None
    for miroir in MIROIRS:
        for n in range(essais_par_miroir):
            try:
                donnees = urllib.parse.urlencode({"data": requete}).encode()
                req = urllib.request.Request(miroir, data=donnees, headers={"User-Agent": "geo-territoires (hirundAGE)"})
                with urllib.request.urlopen(req, timeout=300) as r:
                    reponse = json.load(r)
                if reponse.get("remark") and not reponse.get("elements"):
                    raise RuntimeError(reponse["remark"])
                print(f"  {miroir.split('/')[2]} : {len(reponse.get('elements', []))} éléments")
                return reponse
            except Exception as e:  # noqa: BLE001 - réseau, quota, délai : on passe au suivant
                derniere = e
                print(f"  {miroir.split('/')[2]} essai {n + 1} : {e}")
                time.sleep(10 + 15 * n)
    raise RuntimeError(f"Overpass injoignable ({derniere})")


# ----------------------------------------------------------------------------------------
# Classement par tags
# ----------------------------------------------------------------------------------------

# Valeurs de shop/amenity/office/craft/tourisme que la couche « commerces » reconnaît (voir TYPES_COMMERCES dans js/config.js).
COMMERCES_AMENITY = {"restaurant", "bar", "pub", "fast_food", "pharmacy", "post_office", "fuel", "car_wash",
                     "vehicle_inspection", "driving_school", "cinema"}
COMMERCES_OFFICE = {"insurance", "estate_agent", "association"}
COMMERCES_CRAFT = {"photographer", "caterer", "handicraft", "winery"}
SHOP_IGNORES = {"vacant", "no", "yes"}

BRUIT = {"fixme", "FIXME", "note", "created_by", "source:date", "survey:date", "check_date"}


def tags_utiles(tags):
    return {k: v for k, v in tags.items() if k not in BRUIT and not k.startswith(("fixme", "note:", "source:", "check_date:"))}


def prem(tags, *cles):
    for c in cles:
        v = tags.get(c)
        if v not in (None, ""):
            return v
    return None


def adresse(tags):
    rue = prem(tags, "addr:street", "contact:street")
    num = prem(tags, "addr:housenumber", "contact:housenumber")
    return " ".join(x for x in (num, rue) if x) or None


def prive(tags):
    return tags.get("access") in ("private", "no")


def type_fr_ecole(tags):
    v = (tags.get("school:FR") or "").lower()
    if v:
        return v
    nom = (tags.get("name") or "").lower()
    for mot, libelle in (("maternelle", "maternelle"), ("élémentaire", "élémentaire"), ("elementaire", "élémentaire"),
                         ("primaire", "primaire"), ("collège", "collège"), ("college", "collège"), ("lycée", "lycée")):
        if mot in nom:
            return libelle
    return None


def classer(el):
    """Renvoie [(couche, type_de_geometrie_attendue, proprietes)] pour un élément Overpass (points)."""
    t = el.get("tags") or {}
    if not t:
        return []
    oid = f"{el['type']}/{el['id']}"
    sorties = []
    shop, amenity, office, craft = t.get("shop"), t.get("amenity"), t.get("office"), t.get("craft")
    tourism, leisure, man_made, historic = t.get("tourism"), t.get("leisure"), t.get("man_made"), t.get("historic")

    # Commerces (shop, amenity, office, craft, musées) : un nom est obligatoire
    type_commerce = None
    if shop and shop not in SHOP_IGNORES:
        type_commerce = shop
    elif amenity in COMMERCES_AMENITY:
        type_commerce = amenity
    elif office in COMMERCES_OFFICE:
        type_commerce = office
    elif craft in COMMERCES_CRAFT:
        type_commerce = craft
    elif tourism == "museum":
        type_commerce = "museum"
    elif amenity == "cinema":
        type_commerce = "cinema"
    if type_commerce and t.get("name"):
        sorties.append(("commerces", {
            "osm_id": oid, "type": type_commerce, "name": t.get("name"), "brand": t.get("brand"), "operator": t.get("operator"),
            "wheelchair": t.get("wheelchair"), "opening_hours": t.get("opening_hours"), "level": t.get("level"),
            "siret": (t.get("ref:FR:SIRET") or "").replace(" ", "") or None, "profession_ref": t.get("ref:FR:LaPoste"),
            "wikidata": t.get("wikidata"), "website": prem(t, "website", "contact:website"),
            "phone": prem(t, "phone", "contact:phone"), "email": prem(t, "email", "contact:email"),
            "facebook": prem(t, "contact:facebook", "facebook"), "address": adresse(t), "last_update": None}))

    if amenity in ("bank", "atm"):
        sorties.append(("banques", {
            "osm_id": oid, "type": amenity, "name": t.get("name"), "brand": t.get("brand"), "operator": t.get("operator"),
            "network": t.get("network"), "wheelchair": t.get("wheelchair"), "opening_hours": t.get("opening_hours"),
            "bank_id_code": t.get("ref:FR:BIC") or t.get("bic"), "has_atm": t.get("atm"), "brand_wikidata": t.get("brand:wikidata")}))

    if amenity in ("school", "college", "kindergarten"):
        statut = (t.get("operator:type") or "").lower()
        sorties.append(("education", {
            "osm_id": oid, "name": t.get("name"), "type": amenity, "type_fr": type_fr_ecole(t),
            "statut": "privé" if "private" in statut else ("public" if statut else None),
            "ref_uai": t.get("ref:UAI"), "wikidata": t.get("wikidata")}))

    if amenity == "parking" and not prive(t) and t.get("access") != "customers":
        sorties.append(("parkings", tags_utiles(t)))
    if amenity == "toilets" and not prive(t):
        sorties.append(("toilettes", tags_utiles(t)))
    if amenity == "drinking_water":
        sorties.append(("fontaines", tags_utiles(t)))
    if amenity == "library":
        sorties.append(("bibliotheques", tags_utiles(t)))
    if amenity == "marketplace":
        sorties.append(("marches", tags_utiles(t)))
    if amenity == "recycling":
        # Déchèterie (centre), dépôt de déchets verts (compost) ou point d'apport volontaire (container)
        if t.get("recycling_type") == "centre":
            genre = "centre"
        elif t.get("recycling:green_waste") == "yes" or t.get("recycling:garden_waste") == "yes" or "compost" in (t.get("name") or "").lower():
            genre = "compost"
        else:
            genre = "container"
        sorties.append(("dechets", {
            "type": genre, "name": t.get("name") or "Point de tri", "operator": t.get("operator"),
            "opening_hours": t.get("opening_hours"),
            "glass": prem(t, "recycling:glass_bottles", "recycling:glass"), "paper": t.get("recycling:paper"),
            "waste": t.get("recycling:waste"), "plastic_packaging": t.get("recycling:plastic_packaging")}))
    if amenity == "parcel_locker":
        sorties.append(("lockers_osm", tags_utiles(t)))
    if amenity == "fire_station":
        sorties.append(("pompiers", tags_utiles(t)))
    if amenity == "police":
        sorties.append(("gendarmerie", tags_utiles(t)))
    if amenity == "social_facility" and t.get("social_facility") == "nursing_home":
        sorties.append(("ehpad", tags_utiles(t)))
    if man_made == "mast" and (t.get("tower:type") == "communication" or t.get("communication:mobile_phone") == "yes"):
        sorties.append(("antennes", tags_utiles(t)))
    if tourism == "information" and t.get("information") == "office":
        sorties.append(("officesTourisme", tags_utiles(t)))
    if tourism == "caravan_site":
        sorties.append(("campingcar", tags_utiles(t)))

    if leisure == "playground" and not prive(t):
        sorties.append(("airesJeu", {
            "osm_id": oid, "name": t.get("name"), "surface": t.get("surface"), "wheelchair": t.get("wheelchair"),
            "min_age": t.get("min_age"), "max_age": t.get("max_age"), "operator": t.get("operator"),
            "opening_hours": t.get("opening_hours"), "access": t.get("access"), "indoor": t.get("indoor"),
            "fee": t.get("fee"), "supervised": t.get("supervised")}))
    if leisure in LOISIRS.split("|") and leisure != "playground" and not prive(t):
        exige_nom = leisure in ("swimming_pool", "recreation_ground")
        if not (exige_nom and not t.get("name")):
            sorties.append(("equipementSportif", {
                "osm_id": oid, "type": leisure, "name": t.get("name"), "operator": t.get("operator"), "sport": t.get("sport"),
                "wheelchair": t.get("wheelchair"), "opening_hours": t.get("opening_hours")}))

    # Petit patrimoine rural : croix, lavoirs, fontaines, moulins
    if historic in ("wayside_cross", "wayside_shrine", "calvary") or amenity in ("fountain", "washing_place") \
            or man_made in ("watermill", "windmill"):
        sorties.append(("patrimoineRural", tags_utiles(t)))
    return sorties


# ----------------------------------------------------------------------------------------
# Écriture
# ----------------------------------------------------------------------------------------

FICHIERS = {
    "commerces": "commerces/commerces.geojson", "banques": "commerces/banques.geojson",
    "education": "famille/education.geojson",
    "parkings": "services/parkings.geojson", "toilettes": "services/toilettes.geojson",
    "fontaines": "services/fontaines.geojson", "bibliotheques": "services/bibliotheques.geojson",
    "marches": "services/marches.geojson", "airesJeu": "services/airesJeu.geojson",
    "equipementSportif": "services/equipementSportif.geojson", "antennes": "services/antennes.geojson",
    "lockers_osm": "services/lockers_osm.geojson", "dechets": "services/dechets.geojson",
    "pompiers": "securite/pompiers.geojson", "gendarmerie": "securite/gendarmerie.geojson", "ehpad": "securite/ehpad.geojson",
    "officesTourisme": "tourisme/officesTourisme.geojson", "campingcar": "tourisme/campingcar.geojson",
    "patrimoineRural": "patrimoine/patrimoineRural.geojson",
    "cours_eau": "tourisme/cours_eau.geojson", "velo": "tourisme/velo.geojson", "randonnees_osm": "tourisme/randonnees_osm.geojson",
}
COMPLEMENTS_VIDES = ["services/lockers_manuels.geojson", "tourisme/randonnees.geojson"]
COUCHES_AVEC_XY = {"banques", "airesJeu"}  # GéoBercé : X (longitude) et Y (latitude) en propriétés


def ecrire(chemin_relatif, features, nom):
    chemin = os.path.join(SORTIE, chemin_relatif)
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "name": nom, "features": features}, f, ensure_ascii=False, separators=(",", ":"))


def arrondir(c):
    return [round(c[0], 6), round(c[1], 6)]


def traiter_points(elements, zone, communes):
    par_couche = {}
    vus = set()
    for el in elements:
        if el["type"] == "node":
            lon, lat = el.get("lon"), el.get("lat")
        else:
            centre = el.get("center") or {}
            lon, lat = centre.get("lon"), centre.get("lat")
        if lon is None or lat is None or not zone.contient(lon, lat):
            continue
        code, nom_commune = commune_de(lon, lat, communes)
        for couche, props in classer(el):
            if (couche, el["type"], el["id"]) in vus:
                continue
            vus.add((couche, el["type"], el["id"]))
            props = dict(props)
            if couche not in ("commerces", "banques", "education", "airesJeu", "equipementSportif"):
                props.setdefault("osm_id", f"{el['type']}/{el['id']}")
            if couche in COUCHES_AVEC_XY:
                props["X"], props["Y"] = round(lon, 7), round(lat, 7)
            props["com_insee"], props["com_nom"] = code, nom_commune
            par_couche.setdefault(couche, []).append({
                "type": "Feature", "properties": props,
                "geometry": {"type": "Point", "coordinates": [round(lon, 7), round(lat, 7)]}})
    return par_couche


def traiter_lignes(elements, zone):
    eau, velo, rando = [], [], []
    for el in elements:
        t = tags_utiles(el.get("tags") or {})
        if el["type"] == "way" and t.get("waterway"):
            pts = [arrondir((p["lon"], p["lat"])) for p in el.get("geometry", []) if p]
            if len(pts) >= 2 and any(zone.contient(p[0], p[1]) for p in pts):
                props = {k: t[k] for k in ("name", "waterway", "tunnel", "ref:sandre", "intermittent") if k in t}
                eau.append({"type": "Feature", "properties": props, "geometry": {"type": "LineString", "coordinates": pts}})
        elif el["type"] == "relation" and t.get("route") in ("bicycle", "hiking"):
            segments = []
            for m in el.get("members", []):
                pts = [arrondir((p["lon"], p["lat"])) for p in (m.get("geometry") or []) if p]
                if m.get("type") == "way" and len(pts) >= 2 and any(zone.contient(p[0], p[1]) for p in pts):
                    segments.append(pts)
            if not segments:
                continue
            km = sum(haversine_km(s[i], s[i + 1]) for s in segments for i in range(len(s) - 1))
            props = dict(t)
            props.update({"type": "route", "id": t.get("ref") or str(el["id"]),
                          "distance": round(km, 2), "dureeEstim": round(km / 4, 2)})  # 4 km/h
            cible = velo if t["route"] == "bicycle" else rando
            cible.append({"type": "Feature", "properties": props, "geometry": {"type": "MultiLineString", "coordinates": segments}})
    return eau, velo, rando


def appliquer_horaires_decheteries(features):
    """Horaires relevés à la main (saison d'hiver et d'été) : territoires/<id>/saisie/horaires-decheteries.json.
    Chaque entrée dont « correspond » figure dans le nom d'une déchèterie ajoute ses deux périodes
    (horaires_saisons, affichées toutes les deux dans la popup), l'adresse, le téléphone, et un
    opening_hours saisonnier pour le badge « ouvert / fermé »."""
    chemin = os.path.join(territoires_commun.RACINE, "territoires", T.id, "saisie", "horaires-decheteries.json")
    if not os.path.isfile(chemin):
        return
    with open(chemin, encoding="utf-8") as f:
        saisies = json.load(f)
    n = 0
    for ft in features:
        p = ft["properties"]
        if p.get("type") != "centre":
            continue
        for s in saisies:
            if s["correspond"].lower() in (p.get("name") or "").lower():
                for cle in ("adresse", "telephone"):
                    if s.get(cle):
                        p[cle] = s[cle]
                if s.get("notes"):
                    p["horaires_notes"] = s["notes"]
                p["horaires_saisons"] = [{"label": x["label"], "mois": x["mois"], "horaires": x["horaires"]} for x in s["periodes"]]
                p["opening_hours"] = "; ".join(f"{x['mois']}: {b.strip()}" for x in s["periodes"] for b in x["horaires"].split(";"))
                n += 1
    print(f"  horaires saisis : {n} déchèterie(s)")


def main():
    zone, communes = charger_zones()
    b = zone.boite
    bbox = (b[1] - 0.002, b[0] - 0.002, b[3] + 0.002, b[2] + 0.002)  # sud, ouest, nord, est

    if "--essai" in ARGS:
        fichiers = ARGS[ARGS.index("--essai") + 1].split(",")
        with open(fichiers[0], encoding="utf-8") as f:
            points = json.load(f)
        lignes = {"elements": []}
        if len(fichiers) > 1:
            with open(fichiers[1], encoding="utf-8") as f:
                lignes = json.load(f)
    else:
        print("Overpass : points d'intérêt")
        points = interroger(requete_points(bbox))
        print("Overpass : cours d'eau et itinéraires")
        lignes = interroger(requete_lignes(bbox))

    par_couche = traiter_points(points.get("elements", []), zone, communes)
    eau, velo, rando = traiter_lignes(lignes.get("elements", []), zone)
    par_couche["cours_eau"], par_couche["velo"], par_couche["randonnees_osm"] = eau, velo, rando

    appliquer_horaires_decheteries(par_couche.get("dechets", []))
    total = 0
    for couche, chemin in FICHIERS.items():
        features = par_couche.get(couche, [])
        features.sort(key=lambda f: (str(f["properties"].get("com_nom") or ""), str(f["properties"].get("name") or f["properties"].get("nom") or "")))
        if not features:
            print(f"  {couche} : aucun résultat (fichier non écrit)")
            continue
        ecrire(chemin, features, couche)
        total += len(features)
        print(f"  {couche} : {len(features)}")
    if total == 0:
        sys.exit("Aucun résultat : Overpass a peut-être changé, fichiers laissés tels quels.")
    for chemin in COMPLEMENTS_VIDES:
        cible = os.path.join(SORTIE, chemin)
        if not os.path.exists(cible):
            ecrire(chemin, [], os.path.basename(chemin)[:-8])
    print(f"{total} objets écrits pour {TERRITOIRE_ID}")


if __name__ == "__main__":
    main()
