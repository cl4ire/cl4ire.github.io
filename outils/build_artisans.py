#!/usr/bin/env python3
"""Construit couches/commerces/artisans.geojson depuis le registre SIRENE.

Source : API Recherche d'entreprises (https://recherche-entreprises.api.gouv.fr),
qui reprend la base SIRENE de l'Insee. Pour chaque commune du territoire, on
demande les établissements actifs dont l'activité principale (code APE) est un
métier d'artisan du bâtiment ou du jardin, puis on les range par métier.

- Les établissements « non diffusibles » (l'entrepreneur a demandé à ne pas
  apparaître) sont écartés.
- Un établissement déjà présent dans couches/commerces/commerces.geojson
  (même SIRET) n'est pas repris, pour éviter les doublons sur la carte.

Usage : python3 outils/build_artisans.py [sortie.geojson]
Lancé chaque mois par .github/workflows/donnees-mensuelles.yml.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://recherche-entreprises.api.gouv.fr/search"

COMMUNES = {
    "72027": "Beaumont-sur-Dême", "72028": "Beaumont-Pied-de-Bœuf", "72052": "Chahaignes",
    "72068": "La Chartre-sur-le-Loir", "72071": "Montval-sur-Loir", "72103": "Courdemanche",
    "72115": "Dissay-sous-Courcillon", "72134": "Flée", "72143": "Le Grand-Lucé",
    "72153": "Jupilles", "72160": "Lavernat", "72161": "Lhomme", "72173": "Luceau",
    "72183": "Marçon", "72210": "Montreuil-le-Henri", "72221": "Nogent-sur-Loir",
    "72248": "Pruillé-l'Éguillé", "72262": "Loir en Vallée", "72279": "Saint-Georges-de-la-Couée",
    "72311": "Saint-Pierre-de-Chevillé", "72314": "Saint-Pierre-du-Lorouër",
    "72325": "Saint-Vincent-du-Lorouër", "72356": "Thoiré-sur-Dinan", "72376": "Villaines-sous-Lucé",
}

# Métier (id utilisé par TYPES_ARTISANS dans js/config.js) -> codes APE (NAF rév. 2).
METIERS = {
    "plomberie": ["43.22A", "43.22B"],
    "electricite": ["43.21A", "43.21B"],
    "maconnerie": ["43.99C", "41.20A", "41.20B", "43.11Z", "43.12A", "43.12B", "43.99D"],
    "couverture": ["43.91A", "43.91B", "43.99A"],
    "menuiserie": ["43.32A", "43.32B", "43.32C", "16.23Z"],
    "peinture": ["43.34Z", "43.33Z", "43.31Z", "43.29A", "43.39Z"],
    "jardin": ["81.30Z"],
    "autre": ["43.29B", "43.13Z", "25.11Z", "25.62B", "95.22Z", "95.24Z"],
}
LIBELLES_APE = {
    "43.22A": "Installation d'eau et de gaz", "43.22B": "Chauffage et climatisation",
    "43.21A": "Installation électrique", "43.21B": "Installation électrique sur la voie publique",
    "43.99C": "Maçonnerie générale et gros œuvre", "41.20A": "Construction de maisons individuelles",
    "41.20B": "Construction de bâtiments", "43.11Z": "Démolition", "43.12A": "Terrassement",
    "43.12B": "Terrassements spécialisés", "43.99D": "Travaux spécialisés de construction",
    "43.91A": "Charpente", "43.91B": "Couverture", "43.99A": "Étanchéité",
    "43.32A": "Menuiserie bois et PVC", "43.32B": "Menuiserie métallique et serrurerie",
    "43.32C": "Agencement de lieux de vente", "16.23Z": "Fabrication de charpentes et de menuiseries",
    "43.34Z": "Peinture et vitrerie", "43.33Z": "Revêtement des sols et des murs", "43.31Z": "Plâtrerie",
    "43.29A": "Isolation", "43.39Z": "Travaux de finition", "81.30Z": "Aménagement paysager",
    "43.29B": "Installations diverses", "43.13Z": "Forages et sondages", "25.11Z": "Structures métalliques",
    "25.62B": "Mécanique industrielle", "95.22Z": "Réparation d'électroménager et de matériel de jardin",
    "95.24Z": "Réparation de meubles",
}
METIER_DE = {code: metier for metier, codes in METIERS.items() for code in codes}

PETITS_MOTS = {"de", "des", "du", "la", "le", "les", "et", "en", "au", "aux", "sur", "sous", "a", "à"}
SIGLES = {"SARL", "EURL", "SAS", "SASU", "SCI", "EIRL", "EI", "ETS", "SNC", "SA", "BTP"}


def joli(nom):
    """« JEAN DUPONT PLOMBERIE » -> « Jean Dupont Plomberie » (sigles courts gardés)."""
    mots = []
    for i, mot in enumerate(str(nom or "").split()):
        bas = mot.lower()
        if i and bas in PETITS_MOTS and not mots[-1][:1].isdigit():
            mots.append(bas)
        elif mot.strip("().,") in SIGLES or (len(mot.strip("().,")) <= 5 and mot.isupper() and not any(v in bas for v in "aeiouyéè")):
            mots.append(mot)  # sigle : SARL, EURL, SCI…
        else:
            mots.append("-".join(p[:1].upper() + p[1:] for p in bas.split("-")))
    return " ".join(mots)


def appel(params, essais=4):
    url = API + "?" + urllib.parse.urlencode(params)
    for n in range(essais):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "GeoBerce (https://cl4ire.github.io)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(2 + 3 * n)
                continue
            raise
        except urllib.error.URLError:
            time.sleep(2 + 3 * n)
    raise RuntimeError("API injoignable : " + url)


def sirets_commerces():
    try:
        with open(os.path.join(RACINE, "couches", "commerces", "commerces.geojson"), encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return set()
    return {str(x["properties"].get("siret") or "").replace(" ", "") for x in data.get("features", [])} - {""}


def non_diffusible(texte):
    return "NON-DIFFUSIBLE" in str(texte or "").upper() or "[ND]" in str(texte or "").upper()


def main():
    sortie = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RACINE, "couches", "commerces", "artisans.geojson")
    deja = sirets_commerces()
    codes = sorted(METIER_DE)
    vus, features = set(), []
    for insee, nom_commune in COMMUNES.items():
        page, pages = 1, 1
        while page <= pages:
            j = appel({
                "code_commune": insee, "activite_principale": ",".join(codes), "etat_administratif": "A",
                "per_page": 25, "page": page, "limite_matching_etablissements": 100,
            })
            pages = int(j.get("total_pages") or 1)
            for ul in j.get("results", []):
                nom_ul = ul.get("nom_complet") or ul.get("nom_raison_sociale") or ""
                if non_diffusible(nom_ul):
                    continue
                for et in ul.get("matching_etablissements") or []:
                    siret = str(et.get("siret") or "")
                    ape = et.get("activite_principale") or ul.get("activite_principale")
                    if not siret or siret in vus or siret in deja:
                        continue
                    if et.get("etat_administratif", "A") != "A" or str(et.get("commune")) != insee:
                        continue
                    if ape not in METIER_DE or non_diffusible(et.get("adresse")):
                        continue
                    try:
                        lat, lon = float(et.get("latitude")), float(et.get("longitude"))
                    except (TypeError, ValueError):
                        continue
                    enseignes = [e for e in (et.get("liste_enseignes") or []) if e]
                    nom = et.get("nom_commercial") or (enseignes[0] if enseignes else "") or nom_ul
                    vus.add(siret)
                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [round(lon, 6), round(lat, 6)]},
                        "properties": {
                            "siret": siret,
                            "nom": joli(nom),
                            "categorie": METIER_DE[ape],
                            "ape": ape,
                            "activite": LIBELLES_APE.get(ape, ""),
                            "adresse": joli(re.split(r"\s\d{5}(\s|$)", str(et.get("adresse") or ""))[0]),
                            "com_insee": insee,
                            "com_nom": nom_commune,
                            "creation": (et.get("date_creation") or "")[:4],
                        },
                    })
            page += 1
            time.sleep(0.25)  # l'API accepte 7 appels par seconde
        print(f"{nom_commune} : {sum(1 for f in features if f['properties']['com_insee'] == insee)} artisans")

    # Une même entreprise peut avoir deux établissements à la même adresse
    # (ancien et nouveau SIRET) : un seul point sur la carte.
    uniques = {}
    for f in features:
        p = f["properties"]
        uniques.setdefault((p["nom"].lower(), p["adresse"].lower(), p["com_insee"]), f)
    features = list(uniques.values())

    if not features:
        sys.exit("Aucun artisan trouvé : l'API a peut-être changé, fichier laissé tel quel.")
    features.sort(key=lambda f: (f["properties"]["com_nom"], f["properties"]["nom"]))
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "source": "Registre SIRENE (Insee), API Recherche d'entreprises",
                   "mise_a_jour": time.strftime("%Y-%m-%d"), "features": features}, f, ensure_ascii=False, indent=1)
    print(f"{len(features)} artisans écrits dans {sortie}")


if __name__ == "__main__":
    main()
