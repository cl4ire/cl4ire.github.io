#!/usr/bin/env python3
"""Prix de l'immobilier et mutations (DVF) d'un territoire.

À partir des « Demandes de valeurs foncières géolocalisées » (Etalab, tirées du fichier DGFiP
https://www.data.gouv.fr/datasets/demandes-de-valeurs-foncieres), commune par commune, et du
cadastre Etalab pour le dessin des parcelles. Écrit, au même format que GéoBercé :

  urbanisme/prix_immobilier_communes.geojson               prix médians par commune (choroplèthe)
  urbanisme/parcelles_dvf_2021_2025_loir_luce_berce.geojson parcelles vendues et historique des ventes

(le nom du second fichier est celui qu'attend js/config.js, il ne change pas d'un territoire à l'autre)

Usage : python3 outils/build_dvf.py [--territoire <id>] [--sortie <dossier>] [--annees 2021-2025]
"""
import gzip
import io
import json
import statistics
import sys
from collections import defaultdict

import build_sources as S

T = S.T
ARGS = S.ARGS
A0, A1 = (2021, 2025)
if "--annees" in ARGS:
    A0, A1 = (int(x) for x in ARGS[ARGS.index("--annees") + 1].split("-"))
ANNEES = range(A0, A1 + 1)
PERIODE = f"{A0}-{A1}"
NATURES_BATI = ("Maison", "Appartement")


def lignes_commune(annee, code):
    url = f"https://files.data.gouv.fr/geo-dvf/latest/csv/{annee}/communes/{code[:2]}/{code}.csv"
    try:
        with S.ouvrir(url) as r:
            texte = io.TextIOWrapper(r, encoding="utf-8-sig", newline="")
            yield from S.csv.DictReader(texte)
    except RuntimeError as e:
        if "HTTP 404" in str(e):
            return  # pas de ventes connues cette année-là pour cette commune
        raise


def f(v):
    return S.flottant(v) if v not in (None, "") else None


def date_fr(iso):
    a, m, j = (iso or "").split("-")[:3] if iso and iso.count("-") >= 2 else ("", "", "")
    return f"{j}/{m}/{a}" if a else ""


def adresse(r):
    morceaux = [r.get("adresse_numero"), r.get("adresse_suffixe"), r.get("adresse_nom_voie")]
    return " ".join(x for x in morceaux if x).strip()


def mutations_de(code):
    """{(id_mutation, disposition): [lignes]} pour toutes les années."""
    groupes = defaultdict(list)
    for annee in ANNEES:
        n = 0
        for r in lignes_commune(annee, code):
            groupes[(r.get("id_mutation"), r.get("numero_disposition"), annee)].append(r)
            n += 1
        print(f"    {annee} : {n} lignes")
    return groupes


def traiter():
    stats = {}          # code -> listes de prix
    parcelles = {}      # id_parcelle -> propriétés
    for code in T.communes:
        print(f"  {T.communes[code]} ({code})")
        prix_m2, prix_m2_maison, valeurs = [], [], []
        for (idm, _, annee), lignes in mutations_de(code).items():
            r0 = lignes[0]
            nature = r0.get("nature_mutation") or ""
            valeur = f(r0.get("valeur_fonciere"))
            # statistiques : ventes d'un seul bien bâti (maison ou appartement) avec surface et prix connus
            if nature == "Vente" and valeur and valeur > 0:
                batis = {(r.get("type_local"), r.get("surface_reelle_bati"), r.get("lot1_numero")) for r in lignes if r.get("type_local") in NATURES_BATI}
                if len(batis) == 1:
                    type_local, surface, _ = next(iter(batis))
                    surface = f(surface)
                    if surface and surface > 0 and 100 <= valeur / surface <= 15000:
                        valeurs.append(valeur)
                        prix_m2.append(valeur / surface)
                        if type_local == "Maison":
                            prix_m2_maison.append(valeur / surface)
            # parcelles : chaque parcelle de la mutation reçoit la vente dans son historique
            par_parcelle = defaultdict(lambda: {"locaux": [], "terrains": [], "rows": []})
            for r in lignes:
                ref = r.get("id_parcelle")
                if not ref:
                    continue
                p = par_parcelle[ref]
                p["rows"].append(r)
                if r.get("type_local"):
                    p["locaux"].append({
                        "parcelle": ref, "type_local": r.get("type_local"), "code_type_local": r.get("code_type_local"),
                        "surface_batie": f(r.get("surface_reelle_bati")) or 0.0,
                        "nombre_pieces": f(r.get("nombre_pieces_principales")) or 0.0,
                        "lot": r.get("lot1_numero") or "", "surface_carrez": f(r.get("lot1_surface_carrez"))})
                if r.get("nature_culture"):
                    p["terrains"].append({
                        "parcelle": ref, "nature_culture": r.get("nature_culture"),
                        "nature_culture_speciale": r.get("nature_culture_speciale") or "",
                        "surface_terrain": f(r.get("surface_terrain")) or 0.0})
            for ref, p in par_parcelle.items():
                fiche = parcelles.setdefault(ref, {
                    "code_insee": code, "commune": T.communes[code], "code_postal": p["rows"][0].get("code_postal") or "",
                    "adresse": adresse(p["rows"][0]), "historique_mutations": []})
                fiche["historique_mutations"].append({
                    "annee": annee, "date": date_fr(r0.get("date_mutation")), "nature": nature, "valeur": valeur,
                    "adresse": adresse(p["rows"][0]), "elements_locaux": p["locaux"], "elements_terrains": p["terrains"],
                    "_tri": r0.get("date_mutation") or ""})
        stats[code] = (valeurs, prix_m2, prix_m2_maison)
        print(f"    -> {len(valeurs)} ventes de logements exploitables")
    return stats, parcelles


def prix_communes(stats):
    with open(S.os.path.join(T.couches, "communes.geojson"), encoding="utf-8") as fh:
        communes = {c["properties"]["code_insee"]: c["geometry"] for c in json.load(fh)["features"]}
    features = []
    for code, (valeurs, prix_m2, prix_maison) in stats.items():
        if code not in communes:
            continue
        mediane = lambda l: round(statistics.median(l)) if l else None  # noqa: E731
        features.append({"type": "Feature", "geometry": {"type": communes[code]["type"], "coordinates": S.arrondir(communes[code]["coordinates"], 5)},
                         "properties": {"code_insee": code, "commune": code, "nb_ventes": len(valeurs),
                                        "prix_median": mediane(valeurs), "prix_m2_median": mediane(prix_m2),
                                        "prix_m2_maison_median": mediane(prix_maison), "periode": PERIODE}})
    return features


def geometries_cadastre(codes):
    """{id_parcelle: geometrie} depuis le cadastre Etalab, commune par commune."""
    geoms = {}
    for code in codes:
        url = f"https://cadastre.data.gouv.fr/bundler/cadastre-etalab/communes/{code}/geojson/parcelles"
        with S.ouvrir(url, timeout=600) as r:
            donnees = r.read()
        try:
            donnees = gzip.decompress(donnees)
        except OSError:
            pass  # déjà décompressé
        for ft in json.loads(donnees)["features"]:
            geoms[ft["properties"].get("id") or ft.get("id")] = ft["geometry"]
        print(f"    cadastre {code} : {len(geoms)} parcelles cumulées")
    return geoms


def parcelles_dvf(parcelles):
    geoms = geometries_cadastre(sorted({p["code_insee"] for p in parcelles.values()}))
    features, sans = [], 0
    for ref, p in parcelles.items():
        g = geoms.get(ref)
        if not g:
            sans += 1
            continue
        hist = sorted(p["historique_mutations"], key=lambda m: m["_tri"], reverse=True)
        for m in hist:
            m.pop("_tri", None)
        annees = [m["annee"] for m in hist]
        features.append({"type": "Feature", "geometry": {"type": g["type"], "coordinates": S.arrondir(g["coordinates"], 6)},
                         "properties": {"code_insee": p["code_insee"], "commune": p["commune"], "code_postal": p["code_postal"],
                                        "adresse": p["adresse"], "prefixe_section": ref[5:8], "section": ref[8:10],
                                        "numero_parcelle": ref[10:], "reference_parcelle": ref, "nb_mutations": len(hist),
                                        "premiere_mutation": min(annees), "derniere_mutation": max(annees),
                                        "historique_mutations": hist}})
    print(f"  {len(features)} parcelles dessinées ; {sans} sans géométrie cadastrale (fusion de communes ou parcelle disparue)")
    return features


def main():
    stats, parcelles = traiter()
    echecs = 0
    for chemin, nom, features in (
            ("urbanisme/prix_immobilier_communes.geojson", "prix_immobilier_communes", prix_communes(stats)),
            ("urbanisme/parcelles_dvf_2021_2025_loir_luce_berce.geojson", "mutations", None)):
        if features is None:
            try:
                features = parcelles_dvf(parcelles)
            except Exception as e:  # noqa: BLE001 - le prix par commune reste écrit même si le cadastre est injoignable
                print(f"  ÉCHEC cadastre : {e}")
                echecs += 1
                continue
        if not features:
            print(f"  {nom} : aucun résultat (fichier non écrit)")
            echecs += 1
            continue
        S.ecrire(chemin, nom, features)
        print(f"  {nom} : {len(features)} -> {chemin}")
    if echecs:
        sys.exit(1)


if __name__ == "__main__":
    main()
