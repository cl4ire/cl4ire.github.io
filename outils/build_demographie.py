#!/usr/bin/env python3
"""Couche « Mon territoire en chiffres » (démographie) d'un territoire, depuis les fichiers ouverts de l'INSEE.

Écrit urbanisme/demographie_communes.geojson : un polygone par commune, avec les mêmes champs que celui de GéoBercé.

Sources (insee.fr, recensement 2023 et statistiques locales) :
  - « Base du comparateur de territoires » (comparateur_csv.zip) :
      population 2017 et 2023 (séries historiques), logements et logements vacants 2023,
      niveau de vie médian 2023 (Filosofi), établissements actifs 2024 (Flores/Sirene)
  - « Évolution et structure de la population en 2023 » (DS_RP_POPULATION_PRINC) :
      population par âge, pour les parts de moins de 25 ans, de 25 à 64 ans et de 65 ans et plus

Une valeur absente (secret statistique, commune non couverte) n'est pas écrite : la popup n'affiche alors pas la ligne.

Usage : python3 outils/build_demographie.py [--territoire <id>] [--sortie <dossier>]
"""
import csv
import io
import json
import sys
import zipfile

import build_sources as S

T = S.T
CODES = set(T.communes)
URL_COMPARATEUR = "https://www.insee.fr/fr/statistiques/fichier/2521169/comparateur_csv.zip"
URL_AGES = "https://www.insee.fr/fr/statistiques/fichier/9005956/DS_RP_POPULATION_PRINC_2023_CSV_FR.zip"
csv.field_size_limit(sys.maxsize)


def lignes_zip(chemin, motif_nom="", exclure="metadata"):
    """Lignes (dictionnaires) du CSV du zip dont le nom contient motif_nom, lues sans tout décompresser."""
    with zipfile.ZipFile(chemin) as z:
        noms = [i.filename for i in z.infolist() if i.filename.lower().endswith(".csv") and motif_nom in i.filename and exclure not in i.filename.lower()]
        if not noms:
            raise RuntimeError(f"aucun CSV dans {chemin} : {[i.filename for i in z.infolist()]}")
        with z.open(noms[0]) as brut:
            yield from csv.DictReader(io.TextIOWrapper(brut, encoding="utf-8-sig", newline=""), delimiter=";")


def nombre(v):
    return S.flottant(v)


def lire_comparateur_zip(chemin=None):
    """{code: {(jeu, mesure, période): valeur}} pour les communes du territoire."""
    chemin = chemin or telecharger_zip(URL_COMPARATEUR)
    wanted = {("DS_RP_SERIE_HISTORIQUE", "POP", "2017"), ("DS_RP_SERIE_HISTORIQUE", "POP", "2023"),
              ("DS_RP_LOGEMENT_PRINC", "DWELLINGS", "2023"), ("DS_RP_LOGEMENT_PRINC", "DWELLINGS_OCS_DW_VAC", "2023"),
              ("DS_FILOSOFI_CC", "MED_SL", "2023"), ("DS_FLORES_A5", "UNIT_LOC", "2024")}
    valeurs = {c: {} for c in CODES}
    n = 0
    for r in lignes_zip(chemin):
        if r["GEO_OBJECT"] != "COM" or r["GEO"] not in CODES:
            continue
        cle = (r["DS"], r["TAB_MEASURE"], r["TIME_PERIOD"])
        if cle in wanted and r.get("OBS_VALUE") not in (None, ""):
            valeurs[r["GEO"]][cle] = nombre(r["OBS_VALUE"])
            n += 1
    print(f"  comparateur : {n} valeurs pour {sum(1 for v in valeurs.values() if v)} commune(s) sur {len(CODES)}")
    return valeurs


def telecharger_zip(url, essais=3):
    """Télécharge un zip et vérifie qu'il s'ouvre (un téléchargement interrompu donne un zip tronqué) ; réessaie sinon."""
    derniere = None
    for k in range(essais):
        try:
            chemin = S.fichier_url(url, ".zip")
            with zipfile.ZipFile(chemin):
                return chemin
        except Exception as e:  # noqa: BLE001 - réseau instable : on recommence
            derniere = e
            print(f"  téléchargement incomplet ({e}), nouvel essai {k + 2}/{essais}")
            S.time.sleep(5 * (k + 1))
    raise RuntimeError(f"zip inutilisable après {essais} essais : {url} ({derniere})")


def lire_ages(chemin=None):
    """{code: (moins de 25 ans, 25 à 64 ans, 65 ans et plus, total)} en 2023, tous sexes."""
    chemin = chemin or telecharger_zip(URL_AGES)
    pop = {c: {} for c in CODES}
    for r in lignes_zip(chemin):
        if r["GEO_OBJECT"] == "COM" and r["GEO"] in CODES and r["SEX"] == "_T" and r["TIME_PERIOD"] == "2023" and r["OBS_VALUE"]:
            pop[r["GEO"]][r["AGE"]] = nombre(r["OBS_VALUE"])
    out = {}
    for code, a in pop.items():
        if all(k in a for k in ("Y_LT15", "Y15T24", "Y25T39", "Y40T54", "Y55T64", "Y_GE65", "_T")) and a["_T"]:
            out[code] = (a["Y_LT15"] + a["Y15T24"], a["Y25T39"] + a["Y40T54"] + a["Y55T64"], a["Y_GE65"], a["_T"])
    print(f"  âges : {len(out)} commune(s) sur {len(CODES)}")
    return out


def construire(comparateur, ages):
    with open(S.os.path.join(T.couches, "communes.geojson"), encoding="utf-8") as f:
        geoms = {c["properties"]["code_insee"]: c["geometry"] for c in json.load(f)["features"]}
    features, manques = [], []
    for code, nom in T.communes.items():
        if code not in geoms:
            manques.append(f"{nom} (pas de contour)")
            continue
        v = comparateur.get(code, {})
        p = {"commune": code, "commune_nom": nom}
        p23, p17 = v.get(("DS_RP_SERIE_HISTORIQUE", "POP", "2023")), v.get(("DS_RP_SERIE_HISTORIQUE", "POP", "2017"))
        if p23:
            p["population"] = int(round(p23))
        ent = v.get(("DS_FLORES_A5", "UNIT_LOC", "2024"))
        if ent is not None:
            p["nb_entreprises"] = int(round(ent))
        rev = v.get(("DS_FILOSOFI_CC", "MED_SL", "2023"))
        if rev:
            p["revenu_median"] = int(round(rev))
        log, vac = v.get(("DS_RP_LOGEMENT_PRINC", "DWELLINGS", "2023")), v.get(("DS_RP_LOGEMENT_PRINC", "DWELLINGS_OCS_DW_VAC", "2023"))
        if log:
            p["nb_logements"] = int(round(log))
            if vac is not None:
                p["part_logements_vacants"] = round(100 * vac / log, 1)
        if p23 and p17:
            p["evolution_annuelle_2017_2023"] = round(((p23 / p17) ** (1 / 6) - 1) * 100, 1)
        if code in ages:
            m25, m2564, m65, tot = ages[code]
            p["part_moins_25"], p["part_25_64"], p["part_65_plus"] = round(100 * m25 / tot, 1), round(100 * m2564 / tot, 1), round(100 * m65 / tot, 1)
        if len(p) <= 2:
            manques.append(f"{nom} (aucune donnée)")
            continue
        features.append({"type": "Feature", "properties": p,
                         "geometry": {"type": geoms[code]["type"], "coordinates": S.arrondir(geoms[code]["coordinates"], 5)}})
    if manques:
        print("  sans données :", ", ".join(manques))
    return features


def main():
    comparateur = lire_comparateur_zip()
    ages = lire_ages()
    features = construire(comparateur, ages)
    if not features:
        sys.exit("aucune commune renseignée")
    S.ecrire("urbanisme/demographie_communes.geojson", "demographie_communes", features)
    print(f"  demographie : {len(features)} commune(s) -> urbanisme/demographie_communes.geojson")


if __name__ == "__main__":
    main()
