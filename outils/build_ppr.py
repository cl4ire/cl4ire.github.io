"""Zones réglementées des plans de prévention des risques naturels (PPRN) de la Sarthe.

Source : « Assemblage départemental des zones réglementées des PPRNI et PPRMT de la
Sarthe » (DDT de la Sarthe, data.gouv.fr), flux WFS du serveur geo-ide du ministère.
Le serveur ne sait renvoyer que du GML en Lambert 93 : ce script le convertit en
GeoJSON WGS84, simplifie les contours et ne garde que les zones qui touchent le
territoire.

Usage : python3 outils/build_ppr.py [--territoire <id>]
        python3 outils/build_ppr.py --essai fichier.gml   (sans réseau)
Écrit <couches>/risques/ppr_zones.geojson.
"""
import json
import math
import os
import sys
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import territoires_commun as tc  # noqa: E402

WFS = ("https://ogc.geo-ide.developpement-durable.gouv.fr/wxs?map=/opt/data/stack/mapfiles/1.4/"
       "org_38086/6b9fb554-1778-4013-8190-f1cd44b74db6.internet.map")
COUCHE = "ms:L_ZONE_REG_PPRN_S_072"
NS = {"gml": "http://www.opengis.net/gml", "ms": "http://mapserver.gis.umn.edu/mapserver",
      "wfs": "http://www.opengis.net/wfs"}
TOLERANCE_M = 3.0  # simplification des contours (mètres, en Lambert 93)

# Type de règlement (nomenclature CNIG des PPR, champ TYPEREG).
TYPES_REGLEMENT = {
    "01": "Prescriptions (hors zone d'aléa)",
    "02": "Zone bleue : constructible sous conditions",
    "03": "Zone rouge : inconstructible, sauf exceptions",
    "04": "Zone rouge stricte : inconstructible",
    "05": "Zone de délocalisation",
}

# Nom lisible de chaque plan (identifiant GASPAR), d'après les fiches de la DDT sur
# data.gouv.fr. Un plan absent de cette liste garde son identifiant.
NOMS_PPR = {
    "72DDT20000004": ("PPR inondation de la Vallée du Loir", "Inondation"),
    "72DDT19960004": ("PPR mouvements de terrain de La Chartre-sur-le-Loir", "Mouvements de terrain"),
    "72DDT20010003": ("PPR mouvements de terrain du Grand-Lucé", "Mouvements de terrain"),
    "72DDT20070003": ("PPR mouvements de terrain de Vouvray-sur-Loir et Château-du-Loir", "Mouvements de terrain"),
    "72DDT20120202": ("PPR mouvements de terrain de Loir en Vallée", "Mouvements de terrain"),
}

# --- Lambert 93 (EPSG:2154) <-> WGS84, formules de l'IGN (ellipsoïde GRS80) ---
A, E = 6378137.0, 0.0818191910428158
LON0, PHI1, PHI2, PHI0 = math.radians(3), math.radians(44), math.radians(49), math.radians(46.5)
X0, Y0 = 700000.0, 6600000.0


def _m(phi):
    return math.cos(phi) / math.sqrt(1 - (E * math.sin(phi)) ** 2)


def _t(phi):
    s = math.sin(phi)
    return math.tan(math.pi / 4 - phi / 2) / ((1 - E * s) / (1 + E * s)) ** (E / 2)


N = (math.log(_m(PHI1)) - math.log(_m(PHI2))) / (math.log(_t(PHI1)) - math.log(_t(PHI2)))
F = _m(PHI1) / (N * _t(PHI1) ** N)
R0 = A * F * _t(PHI0) ** N


def vers_l93(lon, lat):
    r = A * F * _t(math.radians(lat)) ** N
    th = N * (math.radians(lon) - LON0)
    return X0 + r * math.sin(th), Y0 + R0 - r * math.cos(th)


def depuis_l93(x, y):
    dx, dy = x - X0, R0 - (y - Y0)
    r = math.copysign(math.hypot(dx, dy), N)
    t = (r / (A * F)) ** (1 / N)
    lon = math.atan2(dx, dy) / N + LON0
    phi = math.pi / 2 - 2 * math.atan(t)
    for _ in range(10):
        s = math.sin(phi)
        phi = math.pi / 2 - 2 * math.atan(t * ((1 - E * s) / (1 + E * s)) ** (E / 2))
    return round(math.degrees(lon), 6), round(math.degrees(phi), 6)


# --- Simplification (Douglas-Peucker) ---
def _dist(p, a, b):
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    dx, dy = b[0] - a[0], b[1] - a[1]
    return abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / math.hypot(dx, dy)


def simplifier(points, tol):
    if len(points) < 5:
        return points
    garder = [False] * len(points)
    garder[0] = garder[-1] = True
    pile = [(0, len(points) - 1)]
    while pile:
        i, j = pile.pop()
        dmax, k = 0.0, None
        for m in range(i + 1, j):
            d = _dist(points[m], points[i], points[j])
            if d > dmax:
                dmax, k = d, m
        if k is not None and dmax > tol:
            garder[k] = True
            pile += [(i, k), (k, j)]
    res = [p for p, g in zip(points, garder) if g]
    return res if len(res) >= 4 else points


def anneau(element):
    txt = element.find(".//gml:coordinates", NS).text.split()
    pts = [tuple(map(float, c.split(",")[:2])) for c in txt]
    return [depuis_l93(x, y) for x, y in simplifier(pts, TOLERANCE_M)]


def geometrie(elem):
    polys = []
    for poly in elem.iter("{%s}Polygon" % NS["gml"]):
        ext = poly.find("gml:outerBoundaryIs", NS)
        trous = poly.findall("gml:innerBoundaryIs", NS)
        polys.append([anneau(ext)] + [anneau(t) for t in trous])
    if not polys:
        return None
    return {"type": "MultiPolygon", "coordinates": polys} if len(polys) > 1 else {"type": "Polygon", "coordinates": polys[0]}


def texte(elem, champ):
    e = elem.find("ms:" + champ, NS)
    return (e.text or "").strip() if e is not None and e.text else ""


def telecharger(boite_l93):
    url = (f"{WFS}&SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME={COUCHE}"
           f"&BBOX={','.join(str(round(v)) for v in boite_l93)}")
    with urllib.request.urlopen(url, timeout=300) as r:
        return r.read()


def main():
    ident, args = tc.separer_argument(sys.argv)
    territoire = tc.charger(ident)
    zone, communes = tc.charger_zones(territoire)
    x0, y0, x1, y1 = zone.boite
    coins = [vers_l93(x, y) for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1))]
    boite_l93 = (min(c[0] for c in coins), min(c[1] for c in coins), max(c[0] for c in coins), max(c[1] for c in coins))

    if "--essai" in args:
        with open(args[args.index("--essai") + 1], "rb") as f:
            brut = f.read()
    else:
        brut = telecharger(boite_l93)
    racine = ET.fromstring(brut)

    features = []
    for membre in racine.iter("{%s}featureMember" % NS["gml"]):
        elem = membre[0]
        geom = geometrie(elem.find("ms:geometry", NS))
        if not geom:
            continue
        sommets = [p for poly in tc.polygones(geom) for p in poly[0]]
        touchees = sorted({nom for code, nom, z in communes for p in sommets[::3] if z.contient(*p)})
        if not touchees:
            continue
        typereg = texte(elem, "TYPEREG")
        features.append({"type": "Feature", "geometry": geom, "properties": {
            "nom": texte(elem, "NOM"),
            "code_zone": texte(elem, "CODEZONE"),
            "type_reglement": typereg,
            "libelle_reglement": TYPES_REGLEMENT.get(typereg, "Zone réglementée"),
            "id_ppr": texte(elem, "ID_GASPAR"),
            "plan": NOMS_PPR.get(texte(elem, "ID_GASPAR"), (texte(elem, "ID_GASPAR"), None))[0],
            "risque": NOMS_PPR.get(texte(elem, "ID_GASPAR"), (None, None))[1],
            # Certains liens pointent vers l'intranet du ministère (*.rie.gouv.fr),
            # injoignable depuis internet : on ne les garde pas.
            "reglement": texte(elem, "URLFIC") if texte(elem, "URLFIC").startswith("http") and ".rie." not in texte(elem, "URLFIC") else None,
            "communes": ", ".join(touchees),
        }})

    sortie = os.path.join(territoire.couches, "risques", "ppr_zones.geojson")
    if not features:
        # Aucun plan sur ce territoire : pas de fichier, la couche reste masquée
        # (fichiersDisponibles) plutôt que de s'afficher vide.
        if os.path.exists(sortie):
            os.remove(sortie)
        print("ppr : aucune zone sur ce territoire, pas de fichier")
        return
    os.makedirs(os.path.dirname(sortie), exist_ok=True)
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "source": "DDT de la Sarthe - zones réglementées des PPRN (data.gouv.fr)",
                   "features": features}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"ppr : {len(features)} zones -> {sortie}")


if __name__ == "__main__":
    main()
