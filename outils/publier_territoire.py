#!/usr/bin/env python3
"""Construit le site d'un territoire (GéoBercé, GéoSudSarthe, GéoBelinois...) dans un dossier.

Le code (index.html, css/, js/, img/, manifest.json, sw.js) est le même pour tous les
territoires. Ce script y ajoute ce qui est propre au territoire :

  geoberce      couches/ et js/territoire.js tels quels (racine du dépôt)
  autre         territoires/<id>/territoire.js  -> js/territoire.js
                territoires/<id>/couches/       -> couches/
                et, dans index.html et manifest.json, le nom, le nom complet, la
                communauté de communes et l'adresse de GéoBercé remplacés par ceux du territoire

Il ne touche à rien d'autre dans le dossier de destination (README.md, par exemple).

Usage : python3 outils/publier_territoire.py <id> <dossier_destination>
Utilisé par .github/workflows/sync-geoberce.yml (dépôt hirundage.github.io).
"""
import json
import os
import re
import shutil
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ID_REFERENCE = "geoberce"
DOSSIERS_CODE = ("css", "img", "js")
FICHIERS_CODE = ("index.html", "manifest.json", "sw.js")


def lire_territoire(chemin):
    """Lit nom, nomComplet, comcom et urlProd dans un fichier territoire.js."""
    with open(chemin, encoding="utf-8") as f:
        src = f.read()
    valeurs = {}
    for cle in ("id", "nom", "nomComplet", "comcom", "urlProd"):
        m = re.search(r'^\s*' + cle + r':\s*("(?:[^"\\]|\\.)*")', src, re.M)
        if not m:
            sys.exit(f"{chemin} : champ « {cle} » introuvable")
        valeurs[cle] = json.loads(m.group(1))
    return valeurs


def remplacer_dossier(source, destination):
    if os.path.isdir(destination):
        shutil.rmtree(destination)
    shutil.copytree(source, destination)


def publier(identifiant, destination):
    os.makedirs(destination, exist_ok=True)
    reference = lire_territoire(os.path.join(RACINE, "js", "territoire.js"))
    if reference["id"] != ID_REFERENCE:
        sys.exit("js/territoire.js doit rester celui de GéoBercé")

    est_reference = identifiant == ID_REFERENCE
    if est_reference:
        territoire = reference
        dossier_donnees = os.path.join(RACINE, "couches")
        fichier_territoire = None
    else:
        base = os.path.join(RACINE, "territoires", identifiant)
        fichier_territoire = os.path.join(base, "territoire.js")
        dossier_donnees = os.path.join(base, "couches")
        for chemin in (fichier_territoire, dossier_donnees):
            if not os.path.exists(chemin):
                sys.exit(f"Territoire inconnu ou incomplet : {chemin} manque")
        territoire = lire_territoire(fichier_territoire)
        if territoire["id"] != identifiant:
            sys.exit(f"{fichier_territoire} : id « {territoire['id']} » au lieu de « {identifiant} »")

    for d in DOSSIERS_CODE:
        remplacer_dossier(os.path.join(RACINE, d), os.path.join(destination, d))
    remplacer_dossier(dossier_donnees, os.path.join(destination, "couches"))
    if fichier_territoire:
        shutil.copyfile(fichier_territoire, os.path.join(destination, "js", "territoire.js"))

    # Textes statiques : le HTML et le manifeste portent ceux de GéoBercé, à remplacer.
    remplacements = [
        (reference["comcom"], territoire["comcom"]),
        (reference["nomComplet"], territoire["nomComplet"]),
        (reference["nom"], territoire["nom"]),
        (reference["urlProd"].replace("https://", "").rstrip("/"), territoire["urlProd"].replace("https://", "").rstrip("/")),
    ]
    for nom_fichier in FICHIERS_CODE:
        with open(os.path.join(RACINE, nom_fichier), encoding="utf-8") as f:
            contenu = f.read()
        if not est_reference:
            for ancien, nouveau in remplacements:
                contenu = contenu.replace(ancien, nouveau)
        with open(os.path.join(destination, nom_fichier), "w", encoding="utf-8", newline="") as f:
            f.write(contenu)

    print(f"{identifiant} -> {destination}")


def territoires_publiables():
    """GéoBercé, puis chaque dossier de territoires/ qui a un territoire.js."""
    ids = [ID_REFERENCE]
    base = os.path.join(RACINE, "territoires")
    if os.path.isdir(base):
        for nom in sorted(os.listdir(base)):
            if os.path.isfile(os.path.join(base, nom, "territoire.js")):
                ids.append(nom)
    return ids


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--liste":
        print(" ".join(territoires_publiables()))
    elif len(sys.argv) == 3:
        publier(sys.argv[1], sys.argv[2])
    else:
        sys.exit(__doc__)
