#!/usr/bin/env python3
"""Construit couches/associations/associations.geojson depuis le RNA.

Source : Répertoire national des associations (RNA), fichier « waldec »
publié chaque mois sur data.gouv.fr. On garde les associations :
- dont le siège est dans une commune du territoire (code Insee actuel, ou
  nom d'une ancienne commune fusionnée dans Montval-sur-Loir ou Loir en Vallée) ;
- actives (position « A », pas de date de dissolution) ;
- qui ont fait au moins une déclaration ces ANS_MAX dernières années, pour
  écarter les associations endormies qui n'ont jamais déclaré leur fin.

Vie privée : le siège d'une petite association est souvent le domicile d'un
ou d'une bénévole. On ne publie donc PAS l'adresse : chaque commune donne un
seul point (le centre de la commune) qui porte la liste de ses associations.

Usage : python3 outils/build_associations.py [rna_waldec.zip ou .csv] [sortie.geojson]
Sans fichier, le dernier export est téléchargé depuis data.gouv.fr.
"""
import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
import zipfile

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET = "https://www.data.gouv.fr/api/1/datasets/repertoire-national-des-associations/"
ANS_MAX = 10

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


def cle(t):
    t = unicodedata.normalize("NFD", str(t or "")).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z]+", " ", t).strip()


# Nom de commune (actuel ou ancien) -> code Insee actuel, pour les déclarations
# qui portent encore le code ou le nom d'une commune déléguée.
PAR_NOM = {cle(n): c for c, n in COMMUNES.items()}
PAR_NOM.update({
    cle("Château-du-Loir"): "72071", cle("Montabon"): "72071", cle("Vouvray-sur-Loir"): "72071",
    cle("Ruillé-sur-Loir"): "72262", cle("La Chapelle-Gaugain"): "72262", cle("Lavenay"): "72262",
    cle("Poncé-sur-le-Loir"): "72262",
})

# Catégories affichées (id utilisé par js/config.js) : mots du nom ou de l'objet
# d'abord, puis le thème déclaré (3 premiers chiffres du code « objet social »).
CATEGORIES = [
    ("sport", r"\b(SPORT|FOOT|FOOTBALL|TENNIS|BASKET|HAND|HANDBALL|VOLLEY|RUGBY|JUDO|KARATE|GYM|GYMNASTIQUE|PETANQUE|BOULE|BOULES|CYCLO|VELO|CYCLISME|VTT|RANDO|RANDONNEE|MARCHE|COURSE|ATHLETISME|NATATION|ESCRIME|TIR|EQUITATION|EQUESTRE|HIPPIQUE|BADMINTON|PING|YOGA|DANSE SPORTIVE|CHASSE|CHASSEURS|PECHE|PECHEURS|GAULE|ARCHERS|BILLARD|MOTO|AUTO CLUB)\b"),
    ("culture", r"\b(THEATRE|MUSIQUE|MUSICAL|HARMONIE|FANFARE|CHORALE|CHOEUR|CHANT|DANSE|CINEMA|LECTURE|BIBLIOTHEQUE|LIVRE|LIVRES|PEINTURE|ARTS|ARTISTES|PHOTO|PHOTOGRAPHIE|CULTURE|CULTUREL|CULTURELLE|FESTIVAL|CONCERT|CONCERTS|ECRITURE)\b"),
    ("patrimoine", r"\b(PATRIMOINE|HISTOIRE|HISTORIQUE|SAUVEGARDE|EGLISE|CHAPELLE|CHATEAU|MOULIN|LAVOIR|MEMOIRE|ARCHEOLOGIE|GENEALOGIE|ANCIENS COMBATTANTS|COMBATTANTS|UNC|FNACA|VETERANS)\b"),
    ("education", r"\b(PARENTS|ELEVES|APE|APEL|ECOLE|ECOLES|COLLEGE|LYCEE|SCOLAIRE|PERISCOLAIRE|CANTINE|JEUNESSE|JEUNES|ENFANCE|ENFANTS|FORMATION)\b"),
    ("entraide", r"\b(ENTRAIDE|SOLIDARITE|SOLIDAIRE|AIDE|SOCIAL|SOCIALE|SANTE|DON DU SANG|DONNEURS|HANDICAP|HANDICAPES|AINES|ANCIENS|RETRAITES|SENIORS|AGE|AMITIE|CLUB DE L AMITIE|ADMR|RESTOS|SECOURS|CROIX ROUGE|EMPLOI|INSERTION|ALIMENTAIRE|EPICERIE SOLIDAIRE|FAMILLES|FAMILLE|POMPIERS)\b"),
    ("environnement", r"\b(ENVIRONNEMENT|NATURE|JARDIN|JARDINS|JARDINIERS|ECOLOGIE|ECOLOGIQUE|RIVIERE|LOIR|FORET|ARBRES|ABEILLES|APICULTURE|APICULTEURS|PROTECTION DES ANIMAUX|ANIMAUX|CHATS|CHIENS|ENERGIE)\b"),
    ("loisirs", r"\b(FETES|FETE|COMITE DES FETES|ANIMATION|ANIMATIONS|LOISIRS|LOISIR|CLUB|AMICALE|FOYER|RURAL|JUMELAGE|JEUX|CARTES|BELOTE|TAROT|SCRABBLE|COUTURE|TRICOT|CUISINE|VOYAGES|TOURISME|DETENTE|BROCANTE|VIDE GRENIER)\b"),
]
THEMES = {
    "010": "sport", "011": "sport", "006": "culture", "005": "culture", "009": "patrimoine",
    "013": "education", "014": "education", "015": "entraide", "016": "entraide", "017": "entraide",
    "018": "entraide", "019": "entraide", "023": "entraide", "022": "environnement",
    "007": "loisirs", "008": "loisirs", "012": "loisirs", "050": "loisirs", "002": "loisirs",
}

SIGLES = {"APE", "APEL", "UNC", "FNACA", "ADMR", "AFN", "ACPG", "CATM", "ASL", "US", "AS", "ESL", "CSL", "ACL", "AAPPMA",
          "MJC", "CCAS", "BTP", "EPGV", "OGEC", "AEP", "ASLC", "ASCL", "UFOLEP", "FFR", "AMAP", "ACCA", "GDON", "ADAPEI",
          "UNRPA", "ANACR", "FNATH", "ESAT", "SEL", "UCAL", "CUMA", "CA", "EA", "AC"}
PETITS_MOTS = {"de", "des", "du", "la", "le", "les", "et", "en", "au", "aux", "sur", "sous", "pour", "a", "à", "d", "l"}


# Le RNA écrit souvent en majuscules sans accents : on remet ceux des mots courants.
ACCENTS = {w.lower().replace("é", "e").replace("è", "e").replace("ê", "e").replace("â", "a").replace("î", "i")
           .replace("ô", "o").replace("û", "u").replace("ç", "c").replace("ë", "e").replace("ï", "i").replace("œ", "oe"): w
           for w in """comité fêtes fête école écoles élèves amitié société solidarité théâtre musée château église
           pêche pêcheurs pétanque génération générations activités aînés retraités bibliothèque médiathèque énergie
           écologie sécurité développement études événements fédération région vallée forêt bercé lucé flée marçon
           thoiré lorouër dême bœuf pruillé éguillé chevillé côte côteaux protégé créative créatif littéraire
           numérique éducation sénior séniors âge épicerie évasion équitation équestre gymnastique athlétisme
           cyclisme randonnée randonneurs génie mémoire réseau intérêt économie économique agréé agréée défense
           sapeurs-pompiers précieux préservation célébrations carnaval jumelé télé été hôpital santé""".split()}


def accent(mot):
    bas = mot.lower()
    return ACCENTS.get(bas, bas)


def joli(texte):
    """« COMITE DES FETES DE FLEE » -> « Comite des Fetes de Flee » ; sigles gardés."""
    sortie = []
    for i, mot in enumerate(str(texte or "").split()):
        bas = mot.lower()
        nu = re.sub(r"[^A-Za-z]", "", mot)
        if nu.isupper() and (nu in SIGLES or (1 < len(nu) <= 5 and not re.search(r"[AEIOUY]", nu))):
            sortie.append(mot)  # sigle : APE, UNC, FNACA, ADMR…
        elif i and bas in PETITS_MOTS:
            sortie.append(bas)
        else:
            bas = "-".join(accent(p) for p in bas.split("-"))
            sortie.append(re.sub(r"(^|[-'’(])(\w)", lambda m: m.group(1) + m.group(2).upper(), bas))
    return " ".join(sortie)


def phrase(texte, longueur=220):
    t = re.sub(r"\s+", " ", str(texte or "")).strip()
    if t.isupper():
        t = " ".join(accent(m) for m in t.split())
    t = t[:1].upper() + t[1:]
    return t if len(t) <= longueur else t[:longueur].rsplit(" ", 1)[0] + "…"


def categorie(titre, objet, code):
    texte = " " + cle(titre) + " " + cle(objet) + " "
    for nom, motif in CATEGORIES:
        if re.search(motif, cle(titre)):
            return nom
    if code and str(code)[:3] in THEMES:
        return THEMES[str(code)[:3]]
    for nom, motif in CATEGORIES:
        if re.search(motif, texte):
            return nom
    return "autres"


def telecharger():
    req = urllib.request.Request(DATASET, headers={"User-Agent": "GeoBerce"})
    with urllib.request.urlopen(req, timeout=60) as r:
        ressources = json.load(r).get("resources", [])
    zips = [x for x in ressources if "waldec" in (x.get("title", "") + x.get("url", "")).lower() and x.get("url", "").endswith(".zip")]
    if not zips:
        sys.exit("Pas d'export « rna_waldec » sur data.gouv.fr")
    zips.sort(key=lambda x: (x.get("last_modified") or x.get("created_at") or "", x.get("url")), reverse=True)
    url = zips[0]["url"]
    print("Téléchargement de", url)
    chemin = "/tmp/rna_waldec.zip"
    # Le serveur du ministère refuse l'identité par défaut de urllib (403) :
    # on se présente comme un navigateur ordinaire, avec quelques essais.
    entetes = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
               "Accept": "application/zip,application/octet-stream,*/*", "Referer": "https://www.data.gouv.fr/"}
    for essai in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=entetes), timeout=300) as r, open(chemin, "wb") as f:
                while True:
                    bloc = r.read(1 << 20)
                    if not bloc:
                        break
                    f.write(bloc)
            return chemin
        except urllib.error.URLError as e:
            print("Essai", essai + 1, ":", e)
            time.sleep(5 * (essai + 1))
    sys.exit("Téléchargement du RNA impossible : " + url)


def lignes(chemin):
    """Lignes du département 72 (fichier zip de l'export, ou un .csv déjà extrait)."""
    if chemin.endswith(".zip"):
        z = zipfile.ZipFile(chemin)
        noms = [n for n in z.namelist() if n.lower().endswith(".csv")]
        dep = [n for n in noms if re.search(r"(dpt|dep)?_?72\.csv$", n.lower())]
        brut = b"".join(z.read(n) for n in (dep or noms))
    else:
        with open(chemin, "rb") as f:
            brut = f.read()
    for enc in ("utf-8-sig", "latin-1"):
        try:
            texte = brut.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    sep = ";" if texte[:2000].count(";") > texte[:2000].count(",") else ","
    yield from csv.DictReader(io.StringIO(texte), delimiter=sep)


def centres():
    """Centre approximatif de chaque commune (barycentre de son plus grand polygone)."""
    with open(os.path.join(RACINE, "couches", "communes.geojson"), encoding="utf-8") as f:
        data = json.load(f)
    out = {}
    for feat in data["features"]:
        code = str(feat["properties"].get("code_insee"))
        g = feat["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        meilleur = None
        for poly in polys:
            ring = poly[0]
            a = cx = cy = 0.0
            for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
                k = x1 * y2 - x2 * y1
                a += k
                cx += (x1 + x2) * k
                cy += (y1 + y2) * k
            if a and (meilleur is None or abs(a) > abs(meilleur[0])):
                meilleur = (a, cx / (3 * a), cy / (3 * a))
        if meilleur:
            out[code] = [round(meilleur[1], 5), round(meilleur[2], 5)]
    return out


def main():
    source = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "-" else telecharger()
    sortie = sys.argv[2] if len(sys.argv) > 2 else os.path.join(RACINE, "couches", "associations", "associations.geojson")
    limite = str(int(time.strftime("%Y")) - ANS_MAX) + time.strftime("-%m-%d")
    par_commune = {c: [] for c in COMMUNES}
    lues = 0
    for r in lignes(source):
        lues += 1
        code = (r.get("adrs_codeinsee") or "").strip()
        insee = code if code in COMMUNES else PAR_NOM.get(cle(r.get("adrs_libcommune")))
        if not insee:
            continue
        if (r.get("position") or "A").strip().upper() != "A":
            continue
        disso = (r.get("date_disso") or "").strip()
        if disso and not disso.startswith("0001"):
            continue
        derniere = max((r.get(k) or "").strip()[:10] for k in ("date_decla", "date_creat", "date_publi"))
        if derniere < limite:
            continue
        titre = r.get("titre") or r.get("titre_court") or ""
        if not titre.strip():
            continue
        site = (r.get("siteweb") or "").strip()
        if site and not site.lower().startswith("http"):
            site = "https://" + site
        par_commune[insee].append({
            "titre": joli(titre),
            "objet": phrase(r.get("objet")),
            "cat": categorie(titre, r.get("objet"), r.get("objet_social1")),
            "creation": (r.get("date_creat") or "")[:4],
            "declaration": derniere[:4],
            "site": site if re.match(r"https?://[\w.-]+\.\w{2,}", site) else "",
            "_theme": (r.get("objet_social1") or "").strip(),
        })
    print(f"{lues} lignes lues dans le RNA")
    # Aide au réglage du classement : thèmes déclarés et exemples de noms.
    themes = {}
    for assos in par_commune.values():
        for a in assos:
            themes.setdefault(a.pop("_theme", "") or "-", []).append(a["titre"])
    for code, noms in sorted(themes.items(), key=lambda x: -len(x[1])):
        print(f"  thème {code} ({len(noms)}) : " + " / ".join(noms[:4]))

    pos = centres()
    features = []
    for insee, assos in par_commune.items():
        assos.sort(key=lambda a: cle(a["titre"]))
        print(f"{COMMUNES[insee]} : {len(assos)} associations")
        if not assos or insee not in pos:
            continue
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": pos[insee]},
            "properties": {"com_insee": insee, "com_nom": COMMUNES[insee], "nb": len(assos),
                           "titre": "Associations de " + COMMUNES[insee], "associations": assos},
        })
    total = sum(f["properties"]["nb"] for f in features)
    if total == 0:
        sys.exit("Aucune association trouvée : le format du RNA a peut-être changé, fichier laissé tel quel.")
    os.makedirs(os.path.dirname(os.path.abspath(sortie)), exist_ok=True)
    with open(sortie, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "source": "Répertoire national des associations (RNA), data.gouv.fr",
                   "mise_a_jour": time.strftime("%Y-%m-%d"), "features": features}, f, ensure_ascii=False, indent=1)
    print(f"{total} associations écrites dans {sortie}")


if __name__ == "__main__":
    main()
