#!/usr/bin/env python3
"""Couche « Petite enfance » d'un territoire à partir des exports saisis à la main.

Il n'existe pas de liste ouverte des assistantes maternelles de la Sarthe : on part des exports
de monenfant.fr, un fichier CSV par commune, déposés dans

    territoires/<id>/saisie/assistantes-maternelles/<commune>.csv

Colonnes lues : Nom ; Adresse ; Téléphone ; E-mail (les autres, dont « Disponibilité » trop vite
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
        if (r["properties"].get("score") or 0) < 0.5:
            continue
        lon, lat = r["geometry"]["coordinates"]
        if S.dans(lon, lat):
            return lon, lat
    return None


def lire(chemin):
    with open(chemin, encoding="utf-8-sig", newline="") as f:
        echantillon = f.read(2048)
        f.seek(0)
        delim = ";" if echantillon.count(";") >= echantillon.count(",") else ","
        yield from csv.DictReader(f, delimiter=delim)


def main():
    fichiers = sorted(glob.glob(os.path.join(DOSSIER, "*.csv")))
    if not fichiers:
        print(f"Pas d'export dans {os.path.relpath(DOSSIER, S.territoires_commun.RACINE)} : couche petite enfance ignorée.")
        return
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
            position = geocoder(adresse) if adresse else None
            if not position:
                non_places.append(f"{nom} ({adresse or 'pas d adresse'})")
                continue
            n += 1
            features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(position[0], 6), round(position[1], 6)]},
                             "properties": {"nom": nom, "adresse": adresse, "telephone": telephone(r.get("Téléphone")),
                                            "mail": (r.get("E-mail") or "").strip() or None, "ficheCAF": None,
                                            "type": "Assistant maternel"}})
        print(f"  {os.path.basename(chemin)} : {n} placés")
    if non_places:
        print(f"  {len(non_places)} non placés (adresse absente, incomplète ou hors du territoire) : " + " / ".join(non_places))
    if not features:
        sys.exit("aucune assistante maternelle placée")
    S.ecrire("famille/petiteEnfance.geojson", "petiteEnfance", features)
    print(f"  petiteEnfance : {len(features)} -> famille/petiteEnfance.geojson")


if __name__ == "__main__":
    main()
