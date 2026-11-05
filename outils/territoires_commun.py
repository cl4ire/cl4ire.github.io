"""Outils communs aux scripts de données : lire le fichier de territoire.

Chaque script accepte `--territoire <id>` (geoberce par défaut) et lit la liste des
communes, le SIREN et le dossier de données dans le fichier de territoire :

  geoberce       js/territoire.js            -> couches/
  autre          territoires/<id>/territoire.js -> territoires/<id>/couches/
"""
import json
import os
import re
import sys
from types import SimpleNamespace

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ID_REFERENCE = "geoberce"


def separer_argument(argv):
    """Retire `--territoire <id>` de argv. Renvoie (identifiant, arguments restants)."""
    args = list(argv[1:])
    ident = ID_REFERENCE
    if "--territoire" in args:
        i = args.index("--territoire")
        if i + 1 >= len(args):
            sys.exit("--territoire demande un identifiant (geoberce, geosudsarthe, geobelinois...)")
        ident = args[i + 1]
        del args[i:i + 2]
    return ident, args


def charger(identifiant):
    if identifiant == ID_REFERENCE:
        fichier = os.path.join(RACINE, "js", "territoire.js")
        couches = os.path.join(RACINE, "couches")
    else:
        fichier = os.path.join(RACINE, "territoires", identifiant, "territoire.js")
        couches = os.path.join(RACINE, "territoires", identifiant, "couches")
    if not os.path.isfile(fichier):
        sys.exit(f"Territoire inconnu : {fichier} n'existe pas")
    with open(fichier, encoding="utf-8") as f:
        src = f.read()
    # Le dictionnaire des communes est le dernier « communes: { » du fichier
    # (un « communes: { » plus haut peut décrire des pages d'actualités).
    debut = src.rindex("communes: {")
    communes = {code: json.loads('"' + nom + '"')
                for code, nom in re.findall(r'"(\d{5})":\s*"((?:[^"\\]|\\.)*)"', src[debut:])}
    siren = re.search(r'siren:\s*"(\d+)"', src)
    if not communes or not siren:
        sys.exit(f"{fichier} : communes ou SIREN introuvables")
    return SimpleNamespace(id=identifiant, communes=communes, siren=siren.group(1),
                           couches=couches, fichier=fichier)


# ----------------------------------------------------------------------------------------
# Géométrie : contour de la communauté de communes et des communes
# ----------------------------------------------------------------------------------------

def polygones(geometrie):
    """Liste de polygones [anneau extérieur, trous...] d'un Polygon/MultiPolygon GeoJSON."""
    if geometrie["type"] == "Polygon":
        return [geometrie["coordinates"]]
    if geometrie["type"] == "MultiPolygon":
        return geometrie["coordinates"]
    return []


def dans_anneau(x, y, anneau):
    dedans = False
    j = len(anneau) - 1
    for i in range(len(anneau)):
        xi, yi = anneau[i][0], anneau[i][1]
        xj, yj = anneau[j][0], anneau[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-18) + xi:
            dedans = not dedans
        j = i
    return dedans


class Zone:
    """Un ensemble de polygones, avec test point-dans-polygone rapide (boîte englobante d'abord)."""

    def __init__(self, geometrie):
        self.polys = polygones(geometrie)
        xs = [p[0] for poly in self.polys for p in poly[0]]
        ys = [p[1] for poly in self.polys for p in poly[0]]
        self.boite = (min(xs), min(ys), max(xs), max(ys))

    def contient(self, x, y):
        b = self.boite
        if not (b[0] <= x <= b[2] and b[1] <= y <= b[3]):
            return False
        return any(dans_anneau(x, y, poly[0]) and not any(dans_anneau(x, y, t) for t in poly[1:]) for poly in self.polys)


def charger_zones(territoire):
    """(Zone de la communauté de communes, [(code INSEE, nom, Zone) de chaque commune])."""
    with open(os.path.join(territoire.couches, "epci.geojson"), encoding="utf-8") as f:
        epci = json.load(f)["features"][0]["geometry"]
    with open(os.path.join(territoire.couches, "communes.geojson"), encoding="utf-8") as f:
        communes = json.load(f)["features"]
    return Zone(epci), [(c["properties"]["code_insee"], c["properties"]["nom_offici"], Zone(c["geometry"])) for c in communes]


def commune_de(x, y, communes):
    for code, nom, zone in communes:
        if zone.contient(x, y):
            return code, nom
    return None, None
