#!/usr/bin/env python3
"""Noms français des espèces observées dans un territoire (pour la couche « Observations nature »).

Les observations de GBIF portent le plus souvent un nom anglais ou aucun nom : on constitue ici, une fois
par mois, un dictionnaire { identifiant d'espèce GBIF : nom français } pour les espèces observées sur les
communes du territoire (noms vernaculaires français de GBIF ; sans nom français, l'espèce est affichée
sous son nom latin et n'apparaît pas dans le dictionnaire).

Écrit nature/noms_especes.json.

Usage : python3 outils/build_noms_especes.py [--territoire <id>] [--sortie <dossier>]
"""
import json
import os
import sys

import build_sources as S
import build_biodiversite as B

T = S.T


def main():
    with open(os.path.join(T.couches, "communes.geojson"), encoding="utf-8") as f:
        geoms = {c["properties"]["code_insee"]: c["geometry"] for c in json.load(f)["features"]}
    cles = {}
    for code, nom in T.communes.items():
        if code not in geoms:
            continue
        _, liste = B.facette(B.wkt_polygones(geoms[code]), "speciesKey", 5000)
        for c in liste:
            cles[int(c["name"])] = True
        print(f"  {nom} : {len(cles)} espèces au total")
    noms = {}
    for i, cle in enumerate(cles, 1):
        try:
            fr = [n["vernacularName"] for n in B.appel(f"species/{cle}/vernacularNames", limit=200)["results"]
                  if n.get("language") == "fra" and n.get("vernacularName")]
        except RuntimeError:
            continue
        if fr:
            court = min(fr, key=len)
            noms[str(cle)] = court[0].upper() + court[1:]
        if i % 200 == 0:
            print(f"  {i}/{len(cles)} espèces traitées, {len(noms)} avec un nom français")
    chemin = os.path.join(S.SORTIE, "nature", "noms_especes.json")
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(noms, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    print(f"  noms français : {len(noms)}/{len(cles)} espèces -> nature/noms_especes.json")


if __name__ == "__main__":
    main()
