#!/usr/bin/env python3
"""Met à jour `fichiersDisponibles` dans territoires/<id>/territoire.js.

Liste les fichiers .geojson présents dans territoires/<id>/couches/ : js/config.js n'affiche
une couche que si tous ses fichiers locaux figurent dans cette liste. À lancer après les
scripts de données (build_osm.py, build_artisans.py, build_associations.py...).

Usage : python3 outils/maj_fichiers_disponibles.py --territoire <id>
"""
import os
import re
import sys

import territoires_commun

ident, _ = territoires_commun.separer_argument(sys.argv)
if ident == territoires_commun.ID_REFERENCE:
    sys.exit("GéoBercé n'a pas de liste de fichiers : toutes ses couches sont gardées.")
T = territoires_commun.charger(ident)

fichiers = []
for dossier, _, noms in os.walk(T.couches):
    for nom in noms:
        if nom.endswith(".geojson") and nom not in ("communes.geojson", "epci.geojson"):
            relatif = os.path.relpath(os.path.join(dossier, nom), T.couches).replace(os.sep, "/")
            fichiers.append("couches/" + relatif)
fichiers.sort()

with open(T.fichier, encoding="utf-8") as f:
    src = f.read()
bloc = "fichiersDisponibles: [\n" + ",\n".join(f'        "{x}"' for x in fichiers) + ("\n    ]" if fichiers else "]")
nouveau, n = re.subn(r"fichiersDisponibles:\s*\[[^\]]*\]", bloc, src, count=1)
if n != 1:
    sys.exit(f"{T.fichier} : fichiersDisponibles introuvable")
with open(T.fichier, "w", encoding="utf-8") as f:
    f.write(nouveau)
print(f"{ident} : {len(fichiers)} fichiers disponibles")
