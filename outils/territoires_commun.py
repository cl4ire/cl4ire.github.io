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
