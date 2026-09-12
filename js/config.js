/* =========================================================
   GÉOBERCÉ — CONFIGURATION DES COUCHES
   Un seul endroit pour décrire toutes les données : le reste
   du code (chargement, icônes, panneau, recherche, popups)
   est générique et lit cette configuration.
   ========================================================= */

/* Couleurs de l'identité graphique (voir aussi css/style.css) */
const PALETTE = {
    foret: "#0F6E56",
    feuille: "#1D9E75",
    terracotta: "#D85A30",
    riviere: "#378ADD",
    ardoise: "#5F5E5A"
};

/* =========================================================
   GROUPES (catégories du panneau de couches / thématiques
   de la page d'accueil)
   ========================================================= */
const GROUPS = {
    services: { label: "Services & mairie", icon: "fa-solid fa-landmark", color: PALETTE.foret },
    famille: { label: "Famille", icon: "fa-solid fa-child-reaching", color: PALETTE.terracotta },
    commerces: { label: "Commerces", icon: "fa-solid fa-basket-shopping", color: PALETTE.feuille },
    mobilite: { label: "Mobilité", icon: "fa-solid fa-bus", color: PALETTE.riviere },
    securite: { label: "Sécurité & santé", icon: "fa-solid fa-heart-pulse", color: "#AD4826" },
    tourisme: { label: "Nature & rando", icon: "fa-solid fa-person-hiking", color: PALETTE.feuille },
    patrimoine: { label: "Patrimoine", icon: "fa-solid fa-monument", color: "#7F7E7B" },
    urbanisme: { label: "Habitat & urbanisme", icon: "fa-solid fa-house-chimney", color: PALETTE.ardoise },
    risques: { label: "Risques & prévention", icon: "fa-solid fa-triangle-exclamation", color: "#AD4826" }
};

/* =========================================================
   STYLES DYNAMIQUES POUR COUCHES "FLUX"
   (données dont on ne maîtrise pas totalement le nom exact
   des attributs distants : on cherche des mots-clés plutôt
   qu'un nom de champ figé, pour rester robuste aux évolutions
   du fournisseur de données)
   ========================================================= */
function couleurVigieau(feature) {
    const props = feature.properties || {};
    const texte = Object.values(props)
        .filter(v => typeof v === "string")
        .join(" ")
        .toLowerCase();

    let remplissage = "#9AA5A0"; // niveau inconnu / pas de restriction identifiée
    if (texte.includes("crise")) remplissage = "#7A1F1F";
    else if (texte.includes("renforc")) remplissage = "#EB5757";
    else if (texte.includes("alerte")) remplissage = "#F2994A";
    else if (texte.includes("vigilance")) remplissage = "#F2C94C";

    return { color: "#fff", weight: 1, fillColor: remplissage, fillOpacity: 0.5 };
}

/* =========================================================
   CATÉGORIES DE COMMERCES
   Le champ "type" du fichier commerces.geojson porte des valeurs
   OSM brutes (restaurant, bakery, hairdresser...) : on les regroupe
   en quelques catégories visuelles (icône + couleur) pour que la
   carte reste lisible, avec un repli générique pour tout type non
   prévu. Sert à la fois aux marqueurs et à la légende du panneau.
   ========================================================= */
const TYPES_COMMERCES = [
    {
        id: "boulangerie", label: "Boulangerie & pâtisserie", icon: "fa-solid fa-bread-slice", color: PALETTE.feuille,
        types: ["bakery", "chocolate"]
    },
    {
        id: "alimentation", label: "Alimentation", icon: "fa-solid fa-basket-shopping", color: PALETTE.feuille,
        types: ["supermarket", "convenience", "butcher", "deli", "seafood", "greengrocer", "winery", "variety_store", "newsagent"]
    },
    {
        id: "restauration", label: "Restaurants & bars", icon: "fa-solid fa-utensils", color: PALETTE.terracotta,
        types: ["restaurant", "bar", "pub", "fast_food"]
    },
    {
        id: "coiffure", label: "Coiffure", icon: "fa-solid fa-scissors", color: "#AD4826",
        types: ["hairdresser"]
    },
    {
        id: "beaute", label: "Beauté & bien-être", icon: "fa-solid fa-spa", color: PALETTE.terracotta,
        types: ["beauty", "perfumery", "tattoo"]
    },
    {
        id: "sante", label: "Santé", icon: "fa-solid fa-briefcase-medical", color: PALETTE.riviere,
        types: ["pharmacy", "optician", "hearing_aids"]
    },
    {
        id: "automobile", label: "Automobile", icon: "fa-solid fa-car", color: PALETTE.ardoise,
        types: ["car_repair", "car_wash", "fuel", "vehicle_inspection", "driving_school", "bicycle"]
    },
    {
        id: "bricolage", label: "Bricolage & jardin", icon: "fa-solid fa-screwdriver-wrench", color: PALETTE.feuille,
        types: ["doityourself", "garden_centre", "interior_decoration"]
    },
    {
        id: "mode", label: "Mode & accessoires", icon: "fa-solid fa-shirt", color: PALETTE.terracotta,
        types: ["clothes", "shoes", "leather", "jewelry"]
    },
    {
        id: "poste", label: "Bureau de poste", icon: "fa-solid fa-envelope", color: PALETTE.ardoise,
        types: ["post_office"]
    },
    {
        id: "servicesPro", label: "Services professionnels", icon: "fa-solid fa-briefcase", color: PALETTE.ardoise,
        types: ["insurance", "estate_agent", "funeral_directors", "laundry", "cleaning", "photographer", "association"]
    },
    {
        id: "hightech", label: "High-tech & électronique", icon: "fa-solid fa-laptop", color: PALETTE.riviere,
        types: ["computer", "electronics", "e-cigarette"]
    },
    {
        id: "culture", label: "Culture & loisirs", icon: "fa-solid fa-palette", color: PALETTE.feuille,
        types: ["books", "art", "cinema", "sports", "photo", "gift", "handicraft", "sewing"]
    },
    {
        id: "brocante", label: "Brocante & antiquités", icon: "fa-solid fa-shop", color: "#7F7E7B",
        types: ["antiques", "second_hand", "wholesale"]
    }
];
const TYPE_COMMERCE_DEFAUT = { id: "autre", label: "Autres commerces", icon: "fa-solid fa-store", color: PALETTE.ardoise };

function categorieCommerce(typeBrut) {
    if (!typeBrut) return TYPE_COMMERCE_DEFAUT;
    const valeurs = String(typeBrut).split(/[;,/]/).map(v => v.trim().toLowerCase());
    return TYPES_COMMERCES.find(cat => cat.types.some(t => valeurs.includes(t))) || TYPE_COMMERCE_DEFAUT;
}

/* Point d'extension utilisé par icons.js/layers.js : renvoie l'icône et
   la couleur à utiliser pour CE commerce précis plutôt que celles, fixes,
   de la couche "commerces". */
function iconeCommerce(feature) {
    const cat = categorieCommerce((feature.properties || {}).type);
    return { icon: cat.icon, color: cat.color };
}

/* Point d'extension utilisé par layers.js pour répartir les commerces en
   sous-couches indépendantes (une par catégorie), afin que chacune soit
   affichable/masquable séparément depuis la légende du panneau. */
function categoriePourFeature(feature) {
    return categorieCommerce((feature.properties || {}).type).id;
}

/* =========================================================
   DPE ET MUTATIONS (DVF) — code couleur
   Mêmes couleurs que les puces DPE du formulaire de recherche foncière
   (.rf-dpe-* dans style.css) et que le prix/m² du popup parcelle
   (construirePopupCadastre), pour rester cohérent partout où une classe
   DPE ou un prix/m² apparaît sur le site.
   ========================================================= */
function couleurDpe(classe) {
    const couleurs = { A: "#2e8b57", B: "#76a942", C: "#b7c94a", D: "#e0c83c", E: "#eda832", F: "#e47732", G: "#c94338" };
    return couleurs[classe] || PALETTE.ardoise;
}

/* Point d'extension utilisé par icons.js/layers.js : un marqueur DPE par
   classe énergétique plutôt qu'une seule couleur fixe pour toute la
   couche, pour repérer les logements les moins performants d'un coup
   d'œil sur la carte. */
function iconeDpe(feature) {
    return { icon: "fa-solid fa-bolt", color: couleurDpe((feature.properties || {}).etiquette_dpe) };
}

/* Ventes connues d'une mutation DVF, restreintes aux lots qui concernent
   VRAIMENT la parcelle de cette mutation (une mutation/un acte notarié
   peut en regrouper plusieurs) : réutilisé par la fiche parcelle
   (infosParcelle dans recherche.js) ET par le popup/style de la couche
   "mutations" elle-même (chaque feature y est déjà une mutation DVF). */
function ventesDepuisMutation(dvfFeature) {
    if (!dvfFeature) return [];
    const refParcelle = dvfFeature.properties.reference_parcelle;
    return (dvfFeature.properties.historique_mutations || []).map(m => {
        const locaux = (m.elements_locaux || []).filter(e => e.parcelle === refParcelle && e.surface_batie > 0);
        const surfaceBatie = locaux.reduce((s, e) => s + e.surface_batie, 0) || null;
        const valeur = typeof m.valeur === "number" ? m.valeur : null;
        return {
            annee: m.annee || null, valeur,
            nbBatiments: locaux.length || null, surfaceBatie,
            prixM2: (surfaceBatie && valeur) ? Math.round(valeur / surfaceBatie) : null
        };
    });
}

/* Point d'extension (styleFn) de la couche "mutations" : colore chaque
   parcelle vendue selon le prix/m² de sa vente la plus récente (même
   échelle couleurPrix que la choroplethe "Prix immobilier par commune"),
   plutôt qu'une seule couleur terracotta uniforme qui ne disait rien du
   marché local. Grise (couleurPrix(null)) quand le prix/m² ne peut pas
   être calculé (vente de terrain nu sans bâti, par exemple). */
function stylePrixMutation(feature) {
    const ventes = ventesDepuisMutation(feature);
    const prixM2 = ventes[0] ? ventes[0].prixM2 : null;
    return { color: "#fff", weight: 1, fillColor: couleurPrix(prixM2), fillOpacity: 0.6 };
}

/* =========================================================
   DÉCHÈTERIES / TRI
   Une seule couche mélange trois choses bien différentes (champ
   "type") : déchèterie ("centre"), composteur partagé ("compost"), et
   point d'apport volontaire / colonnes de tri ("container"). Ces
   derniers portent, en plus, jusqu'à 4 indicateurs de flux triés
   séparés (verre/papier/plastique/ordures ménagères) : mêmes couleurs
   que les bacs de tri en France (vert/bleu/jaune/noir), affichées en
   marqueur "camembert" (une part égale par flux présent, pas de
   pondération par volume - donnée absente) plutôt qu'une seule couleur
   qui ne dirait rien du contenu réel du point.
   ========================================================= */
const FLUX_TRI = [
    { id: "glass", label: "Verre", color: PALETTE.feuille },
    { id: "paper", label: "Papier", color: PALETTE.riviere },
    { id: "plastic_packaging", label: "Emballages plastique", color: "#F2C94C" },
    { id: "waste", label: "Ordures ménagères", color: "#2A2A28" }
];

/* Champs "yes"/null dans ce flux, avec au moins une coquille observée
   dans la donnée réelle ("ye" au lieu de "yes") : on reste tolérant
   plutôt que de comparer une égalité stricte à "yes". */
function fluxActif(valeur) {
    return typeof valeur === "string" && /^y/i.test(valeur.trim());
}

function fluxPresents(props) {
    return FLUX_TRI.filter(f => fluxActif(props[f.id]));
}

/* "Syndicat Mxte du Val de Loir" : coquille observée sur une des 47
   entrées de la donnée réelle (pour "Syndicat Mixte du Val de Loir") —
   corrigée à l'affichage plutôt que de la laisser telle quelle dans la
   popup. */
function operateurDechet(operator) {
    return operator ? operator.replace(/\bMxte\b/i, "Mixte") : null;
}

/* Point d'extension utilisé par icons.js : déchèterie et composteur
   gardent une icône/couleur fixe (ce ne sont pas des points de tri
   sélectif comme tels), un point d'apport volontaire devient un
   marqueur "camembert" coloré selon les flux qu'il accepte réellement. */
function iconeDechet(feature) {
    const props = feature.properties || {};
    if (props.type === "centre") return { icon: "fa-solid fa-warehouse", color: PALETTE.foret };
    if (props.type === "compost") return { icon: "fa-solid fa-seedling", color: PALETTE.feuille };

    const flux = fluxPresents(props);
    if (!flux.length) return { icon: "fa-solid fa-recycle", color: PALETTE.ardoise };
    return { icon: "fa-solid fa-recycle", color: flux[0].color, segments: flux.map(f => f.color) };
}

/* =========================================================
   CADASTRE (parcellaire complet)
   Un seul flux pour toute la comcom Loir-Lucé-Bercé (bundler Etalab,
   par EPCI via son n° SIREN plutôt que commune par commune). Base pour
   une future "fiche parcelle" (croisement avec les mutations DVF, le
   DPE, le PLUi...).
   ========================================================= */
const COMMUNES_TERRITOIRE = {
    "72027": "Beaumont-sur-Dême", "72028": "Beaumont-Pied-de-Bœuf", "72052": "Chahaignes",
    "72068": "La Chartre-sur-le-Loir", "72071": "Montval-sur-Loir", "72103": "Courdemanche",
    "72115": "Dissay-sous-Courcillon", "72134": "Flée", "72143": "Le Grand-Lucé",
    "72153": "Jupilles", "72160": "Lavernat", "72161": "Lhomme", "72173": "Luceau",
    "72183": "Marçon", "72210": "Montreuil-le-Henri", "72221": "Nogent-sur-Loir",
    "72248": "Pruillé-l'Éguillé", "72262": "Loir en Vallée", "72279": "Saint-Georges-de-la-Couée",
    "72311": "Saint-Pierre-de-Chevillé", "72314": "Saint-Pierre-du-Lorouër",
    "72325": "Saint-Vincent-du-Lorouër", "72356": "Thoiré-sur-Dinan", "72376": "Villaines-sous-Lucé"
};

/* SIREN de la comcom Loir-Lucé-Bercé (code_siren dans couches/communes.geojson). */
const URL_CADASTRE_EPCI = "https://cadastre.data.gouv.fr/bundler/cadastre-etalab/epcis/200070373/geojson/parcelles";

/* Extrait récursivement toutes les Features d'une réponse, quelle que
   soit sa forme exacte (une seule FeatureCollection, un tableau de
   FeatureCollection, un objet {insee: FeatureCollection, ...}...) :
   je n'ai pas pu vérifier la structure exacte du bundler EPCI en
   conditions réelles (accès réseau restreint pendant le développement),
   donc on reste tolérant plutôt que de supposer une forme précise. */
function extraireFeatures(valeur) {
    if (!valeur) return [];
    if (Array.isArray(valeur)) return valeur.flatMap(extraireFeatures);
    if (valeur.type === "FeatureCollection" && Array.isArray(valeur.features)) return valeur.features;
    if (valeur.type === "Feature") return [valeur];
    if (typeof valeur === "object") return Object.values(valeur).flatMap(extraireFeatures);
    return [];
}

/* Complète chaque parcelle avec une référence lisible et le nom de la
   commune (le fichier source ne porte que le code INSEE). */
function fusionnerCadastre(data) {
    const features = extraireFeatures(data).map(feature => {
        const p = feature.properties || {};
        feature.properties = {
            ...p,
            reference: [p.section, p.numero].filter(Boolean).join(" ") || p.id,
            commune_nom: COMMUNES_TERRITOIRE[p.commune] || p.commune,
            surface_m2: p.contenance
        };
        return feature;
    });
    return { type: "FeatureCollection", features };
}

/* Transforme la réponse de l'API historique Opendatasoft (records/1.0/search)
   en GeoJSON standard, pour réutiliser le même pipeline de chargement que
   les couches fichier. Utilisé par les couches "flux" (ex : carburants). */
function geojsonDepuisFluxODS(data) {
    return {
        type: "FeatureCollection",
        features: (data.records || [])
            .filter(rec => rec.geometry)
            .map(rec => ({
                type: "Feature",
                geometry: rec.geometry,
                properties: rec.fields || {}
            }))
    };
}

/* =========================================================
   POINTS RELAIS & CASIERS COLIS (Mondial Relay, Amazon Locker, Vinted
   Go...)
   Pas de jeu de données dédié publié par un seul opérateur : ces points
   sont en revanche cartographiés dans OpenStreetMap, interrogeable en
   direct via Overpass — même principe de couche "flux" que Vigieau/OLD/
   carburants (voir plus haut), pas de fichier dans le dépôt.

   DEUX tags OSM différents selon le type de point, pas un seul : au
   départ seul amenity=parcel_locker était interrogé, ce qui ne
   remontait quasiment aucun Mondial Relay (2 sur tout le territoire) -
   parce que la grande majorité des points Mondial Relay ne sont PAS des
   casiers automatiques, ce sont des "Points Relais" hébergés dans des
   commerces existants (tabac, presse, épicerie...), tagués sur le
   commerce lui-même via post_office=post_partner (+ post_office:brand/
   post_office:service_provider pour l'enseigne), un schéma OSM distinct
   et bien documenté pour ce cas précis. Amazon Locker et Vinted Go sont
   en revanche presque toujours de vrais casiers automatiques
   (amenity=parcel_locker). La requête interroge donc les deux à la
   fois : couverture qui dépend entièrement de ce que les contributeurs
   OSM ont déjà cartographié localement, les réseaux très récents ou en
   forte expansion (Vinted Go) pouvant rester sous-représentés par
   rapport à la réalité du terrain. Pas de solution miracle à ça : c'est
   la limite du crowdsourcing, à signaler plutôt qu'à cacher (voir le
   bandeau "Ce qui reste à faire" du README).
   ========================================================= */

/* Rectangle englobant la comcom Loir-Lucé-Bercé (bbox de
   couches/epci.geojson, élargie d'environ 1 km) : le polygone exact du
   territoire fait plus de 4000 sommets, bien trop pour un filtre
   Overpass "poly:" ; un simple rectangle suffit très largement pour un
   territoire de cette taille, quitte à déborder un peu sur les
   communes limitrophes plutôt que de risquer de rater des casiers en
   bordure de territoire. */
const BBOX_TERRITOIRE = { sud: 47.60, ouest: 0.30, nord: 47.92, est: 0.72 };

/* "out center" plutôt que "out body" : nécessaire pour post_partner, qui
   peut être tagué sur un "way" (contour de bâtiment) et pas seulement un
   node - un node porte déjà lat/lon directement avec "out center" (même
   résultat qu'"out body" dans ce cas), donc un seul mode de sortie
   suffit pour toutes les familles de points interrogées.

   TROIS familles de tags, pas deux : amenity=parcel_locker (casiers
   automatiques, la norme actuelle) et post_office=post_partner (points
   relais en commerce, voir plus haut) ne suffisaient toujours pas à
   faire remonter des casiers pourtant bien réels signalés sur le
   terrain (ex. près d'un Leclerc) - troisième cas identifié :
   amenity=vending_machine + vending=parcel_pickup (ou parcel_mail_in),
   l'ANCIEN schéma de balisage des casiers, officiellement déprécié au
   profit d'amenity=parcel_locker mais dont la bascule (faite par un bot
   il y a plusieurs années) n'a pas forcément atteint 100% de la base
   dans les zones moins actives en contributions. Coûte rien de
   l'interroger aussi en plus du nouveau schéma plutôt que de perdre des
   casiers réels juste parce qu'un nœud n'a jamais été migré. */
const BBOX_OVERPASS = `${BBOX_TERRITOIRE.sud},${BBOX_TERRITOIRE.ouest},${BBOX_TERRITOIRE.nord},${BBOX_TERRITOIRE.est}`;
const REQUETE_OVERPASS_LOCKERS =
    `[out:json][timeout:25];` +
    `(node["amenity"="parcel_locker"](${BBOX_OVERPASS});` +
    `node["post_office"="post_partner"](${BBOX_OVERPASS});` +
    `way["post_office"="post_partner"](${BBOX_OVERPASS});` +
    `node["amenity"="vending_machine"]["vending"~"parcel"](${BBOX_OVERPASS}););` +
    `out center;`;

/* L'instance publique principale (overpass-api.de) est fréquemment
   surchargée et répond parfois 504 aux heures de pointe (constaté en
   conditions réelles) : plutôt que de faire échouer toute la couche sur
   un simple pic de charge d'UN serveur, on retente sur d'autres miroirs
   publics avant d'abandonner. Liste volontairement courte (3) pour ne
   pas faire attendre l'utilisateur trop longtemps si tout est en panne. */
const MIROIRS_OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.ch/api/interpreter"
];

/* Cache la réponse Overpass dans localStorage entre deux rechargements
   de page (pas seulement en mémoire le temps d'une session : chargerCouche
   évite déjà les doublons de requête TANT QUE la page reste ouverte, ça
   ne protège pas contre quelqu'un qui recharge la page plusieurs fois de
   suite en train de tester). Deux raisons : Overpass, service public
   gratuit, demande explicitement à ses consommateurs de mettre en cache
   plutôt que de le solliciter en boucle pour la même requête - et,
   plus concrètement, c'est aussi ce qui a déclenché le 429 (Too Many
   Requests) rapporté après plusieurs tests successifs. 6h : la présence
   d'un casier/point relais ne change pas assez vite pour justifier plus
   frais que ça. */
const CACHE_LOCKERS_CLE = "geoberce-cache-lockers";
const CACHE_LOCKERS_DUREE_MS = 6 * 60 * 60 * 1000;

function lireCacheLockers() {
    try {
        const brut = localStorage.getItem(CACHE_LOCKERS_CLE);
        if (!brut) return null;
        const { horodatage, donnees } = JSON.parse(brut);
        if (!horodatage || Date.now() - horodatage > CACHE_LOCKERS_DUREE_MS) return null;
        return donnees;
    } catch (_) {
        return null; // quota dépassé, navigation privée... : pas grave, on retombe sur le réseau
    }
}

function ecrireCacheLockers(donnees) {
    try {
        localStorage.setItem(CACHE_LOCKERS_CLE, JSON.stringify({ horodatage: Date.now(), donnees }));
    } catch (_) {
        // silencieux : le cache est un confort, pas un besoin
    }
}

function recupererOverpassLockers() {
    const enCache = lireCacheLockers();
    if (enCache) return Promise.resolve(enCache);

    const essayer = index => {
        if (index >= MIROIRS_OVERPASS.length) {
            return Promise.reject(new Error("Tous les miroirs Overpass ont échoué (dernier testé : " + MIROIRS_OVERPASS[MIROIRS_OVERPASS.length - 1] + ")"));
        }
        const url = MIROIRS_OVERPASS[index] + "?data=" + encodeURIComponent(REQUETE_OVERPASS_LOCKERS);
        return fetch(url)
            .then(r => {
                if (!r.ok) throw new Error("Erreur HTTP " + r.status + " sur " + url);
                return r.json();
            })
            .catch(err => {
                console.warn("Miroir Overpass indisponible (" + MIROIRS_OVERPASS[index] + ") :", err);
                return essayer(index + 1);
            });
    };
    return essayer(0).then(donnees => { ecrireCacheLockers(donnees); return donnees; });
}

/* Casiers/points relais connus sur le terrain mais pas encore
   cartographiés dans OpenStreetMap - donc invisibles pour Overpass, quel
   que soit le tag interrogé (constaté en conditions réelles : certains
   casiers bien réels n'existent tout simplement pas dans OSM). Un petit
   fichier local en COMPLÉMENT, pas en remplacement : la vraie base reste
   OSM/Overpass (seule solution qui profite aussi à tous les autres
   usages d'OSM, pas seulement ce site), ce fichier ne sert qu'à combler
   des trous ponctuels signalés en attendant leur ajout là-bas. Toujours
   récupéré en direct sans cache : un fichier local statique ne coûte
   rien à refetch, contrairement à Overpass, et on veut qu'un ajout dans
   ce fichier soit visible tout de suite plutôt que d'attendre 6h. Mêmes
   noms de champs qu'un flux Overpass (brand/opening_hours/addr:*...),
   voir le README pour le détail : ainsi categorieLocker/iconeLocker/
   construirePopupLocker fonctionnent sans aucune distinction entre les
   deux origines. */
function fetchLockersManuels() {
    return fetch("couches/services/lockers_manuels.geojson")
        .then(r => r.ok ? r.json() : { type: "FeatureCollection", features: [] })
        .catch(() => ({ type: "FeatureCollection", features: [] }));
}

function fetchOverpassLockers() {
    return Promise.all([recupererOverpassLockers(), fetchLockersManuels()])
        .then(([overpass, manuels]) => ({ overpass, manuels }));
}

/* data.overpass : réponse Overpass (JSON natif de l'API, pas du GeoJSON)
   - un tableau "elements". Un node porte directement lat/lon ; un way
   (post_partner sur un contour de bâtiment) porte un champ "center" à la
   place grâce à "out center" dans la requête - les deux formes sont donc
   gérées ici plutôt que de supposer que tout est un node.
   data.manuels : déjà un vrai GeoJSON (voir fetchLockersManuels), ajouté
   tel quel aux features issues d'Overpass. */
function geojsonDepuisOverpass(data) {
    const elements = (data && data.overpass && data.overpass.elements) || [];
    const featuresOverpass = elements
        .map(el => {
            const lat = typeof el.lat === "number" ? el.lat : (el.center && el.center.lat);
            const lon = typeof el.lon === "number" ? el.lon : (el.center && el.center.lon);
            if (typeof lat !== "number" || typeof lon !== "number") return null;
            return { type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: el.tags || {} };
        })
        .filter(Boolean);
    const featuresManuels = (data && data.manuels && data.manuels.features) || [];
    return { type: "FeatureCollection", features: [...featuresOverpass, ...featuresManuels] };
}

const TYPES_LOCKERS = [
    { id: "mondialrelay", label: "Mondial Relay", color: PALETTE.riviere, motifs: ["mondial relay", "mondialrelay", "point relais"] },
    { id: "amazon", label: "Amazon Locker", color: "#FF9900", motifs: ["amazon"] },
    { id: "vintedgo", label: "Vinted Go", color: "#09B1BA", motifs: ["vinted"] },
    { id: "inpost", label: "InPost", color: "#FFC700", motifs: ["inpost"] },
    { id: "chronopost", label: "Chronopost", color: "#001E62", motifs: ["chronopost"] },
    { id: "colissimo", label: "Colissimo / La Poste", color: PALETTE.foret, motifs: ["colissimo", "la poste", "laposte"] },
    { id: "relaiscolis", label: "Relais Colis / Pickup", color: PALETTE.terracotta, motifs: ["relais colis", "pickup"] },
    { id: "dpd", label: "DPD Pickup", color: "#DC0032", motifs: ["dpd"] },
    { id: "ups", label: "UPS Access Point", color: "#351C15", motifs: ["ups"] },
    { id: "hermes", label: "Hermes / Evri", color: "#6E2585", motifs: ["hermes", "evri"] }
];
const TYPE_LOCKER_DEFAUT = { id: "autre", label: "Autre opérateur", color: PALETTE.ardoise };

/* Enseigne reconnue par mots-clés plutôt que par une liste de valeurs
   exactes : OSM ne normalise pas parfaitement ces champs (variantes de
   casse/orthographe selon le contributeur), un simple "contient" reste
   robuste à ça. Cherche à la fois dans les champs d'un vrai casier
   (brand/operator/network/name, amenity=parcel_locker) et dans ceux
   d'un point relais hébergé en commerce (post_office:brand/
   post_office:service_provider, post_office=post_partner). */
function categorieLocker(props) {
    const texte = [
        props.brand, props.operator, props.network, props.name,
        props["post_office:brand"], props["post_office:service_provider"]
    ].filter(Boolean).join(" ").toLowerCase();
    return TYPES_LOCKERS.find(cat => cat.motifs.some(m => texte.includes(m))) || TYPE_LOCKER_DEFAUT;
}

/* Icône différente selon le type de point : un vrai casier automatique
   (amenity=parcel_locker) vs un point relais hébergé dans un commerce
   existant (post_office=post_partner) — deux services assez différents
   pour l'usager (une machine en libre-service vs. un dépôt/retrait
   auprès d'un commerçant), au-delà de la seule couleur d'enseigne. */
function estPointRelaisCommerce(props) {
    return props.post_office === "post_partner";
}
function iconeLocker(feature) {
    const props = feature.properties || {};
    return {
        icon: estPointRelaisCommerce(props) ? "fa-solid fa-store" : "fa-solid fa-box",
        color: categorieLocker(props).color
    };
}

/* =========================================================
   AUTRES COUCHES EN FLUX OVERPASS (OpenStreetMap) : médecins,
   vétérinaires, bibliothèques/médiathèques, offices de tourisme, aires
   de camping-car. Même principe que les casiers colis ci-dessus (bbox
   du territoire, repli sur plusieurs miroirs, cache localStorage 6h),
   mais généralisé pour ne pas dupliquer cinq fois la même logique de
   récupération - seule la requête change d'une couche à l'autre. Pas
   de fichier manuel de complément ici (contrairement aux casiers) :
   ce garde-fou n'a de sens que là où un trou de couverture OSM précis
   a été signalé et confirmé sur le terrain. */
function creerFetchOverpass(requete, cacheCle) {
    function lireCache() {
        try {
            const brut = localStorage.getItem(cacheCle);
            if (!brut) return null;
            const { horodatage, donnees } = JSON.parse(brut);
            if (!horodatage || Date.now() - horodatage > CACHE_LOCKERS_DUREE_MS) return null;
            return donnees;
        } catch (_) {
            return null; // quota dépassé, navigation privée... : pas grave, on retombe sur le réseau
        }
    }
    function ecrireCache(donnees) {
        try {
            localStorage.setItem(cacheCle, JSON.stringify({ horodatage: Date.now(), donnees }));
        } catch (_) {
            // silencieux : le cache est un confort, pas un besoin
        }
    }
    /* Requête en cours, partagée entre appels concurrents : indispensable
       depuis que plusieurs couches différentes (ex. médecins, toilettes,
       parkings...) peuvent s'appuyer sur LA MÊME requête combinée
       (fetchOverpassPointsCombines) - sans ça, cocher plusieurs couches
       à la suite déclenchait une requête réseau séparée pour chacune
       (chacune voyant "pas encore de cache" avant que la première ait
       eu le temps de l'écrire), annulant tout l'intérêt de la
       mutualisation. Remise à null une fois la requête terminée (succès
       ou échec) pour ne pas rejouer indéfiniment une erreur passée. */
    let requeteEnCours = null;
    return function fetchOverpass() {
        const enCache = lireCache();
        if (enCache) return Promise.resolve(enCache);
        if (requeteEnCours) return requeteEnCours;
        const essayer = index => {
            if (index >= MIROIRS_OVERPASS.length) {
                return Promise.reject(new Error("Tous les miroirs Overpass ont échoué (dernier testé : " + MIROIRS_OVERPASS[MIROIRS_OVERPASS.length - 1] + ")"));
            }
            const url = MIROIRS_OVERPASS[index] + "?data=" + encodeURIComponent(requete);
            return fetch(url)
                .then(r => {
                    if (!r.ok) throw new Error("Erreur HTTP " + r.status + " sur " + url);
                    return r.json();
                })
                .catch(err => {
                    console.warn("Miroir Overpass indisponible (" + MIROIRS_OVERPASS[index] + ") :", err);
                    return essayer(index + 1);
                });
        };
        requeteEnCours = essayer(0)
            .then(donnees => { ecrireCache(donnees); requeteEnCours = null; return donnees; })
            .catch(err => { requeteEnCours = null; throw err; });
        return requeteEnCours;
    };
}

/* data.elements (réponse Overpass native) -> GeoJSON, même logique que
   geojsonDepuisOverpass mais sans fichier manuel de complément. */
function geojsonDepuisElementsOverpass(data) {
    const elements = (data && data.elements) || [];
    return {
        type: "FeatureCollection",
        features: elements.map(el => {
            const lat = typeof el.lat === "number" ? el.lat : (el.center && el.center.lat);
            const lon = typeof el.lon === "number" ? el.lon : (el.center && el.center.lon);
            if (typeof lat !== "number" || typeof lon !== "number") return null;
            return { type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: el.tags || {} };
        }).filter(Boolean)
    };
}

/* Itinéraires cyclables balisés (ex. "Le Loir à Vélo") : tagués comme des
   RELATIONS OSM (route=bicycle), pas de simples nœuds/ways - "out geom;"
   plutôt que "out center;" pour récupérer la géométrie complète de
   chaque way membre (nécessaire pour tracer une ligne, pas juste un
   point), voir geojsonDepuisRoutesVelo. Timeout relevé à 40s (contre 25s
   initialement) : signalé en conditions réelles que les requêtes
   Overpass du site avaient du mal à aboutir, une relation avec beaucoup
   de way membres peut prendre plus de temps qu'un simple nœud/way. */
const REQUETE_OVERPASS_VELO =
    `[out:json][timeout:40];` +
    `relation["route"="bicycle"](${BBOX_OVERPASS});` +
    `out geom;`;
/* Sentiers de randonnée balisés : relations OSM route=hiking, comme
   route=bicycle pour les itinéraires cyclables (out geom;). */
const REQUETE_OVERPASS_RANDONNEES =
    `[out:json][timeout:40];` +
    `relation["route"="hiking"](${BBOX_OVERPASS});` +
    `out geom;`;
const fetchOverpassVelo = creerFetchOverpass(REQUETE_OVERPASS_VELO, "geoberce-cache-velo");
const fetchOverpassRandonnees = creerFetchOverpass(REQUETE_OVERPASS_RANDONNEES, "geoberce-cache-randonnees");

/* =========================================================
   REQUÊTE OVERPASS UNIQUE POUR TOUTES LES COUCHES "POINTS SIMPLES"
   (nœuds/ways, "out center;") — signalé en conditions réelles que les
   couches Overpass avaient "du mal" (erreurs fréquentes) : avec une
   quinzaine de couches en flux, chacune avec sa propre requête, cocher
   plusieurs cases revenait à déclencher autant de requêtes séparées
   vers le même service public gratuit, chacune avec son propre risque
   d'échec (surcharge du serveur, 429...). Une seule requête combinée,
   mise en cache une seule fois pour toutes ces couches, réduit
   drastiquement le nombre d'allers-retours réseau : cocher 15 couches
   ne déclenche plus qu'UNE requête réseau (la première fois), pas 15 -
   et une requête qui échoue n'a plus qu'un seul point de défaillance à
   corriger plutôt que 15 à surveiller séparément. `classifierElementCombine`
   répartit ensuite chaque élément de la réponse vers la bonne couche
   par ses tags (familles de tags disjointes entre couches, un élément
   ne peut correspondre qu'à une seule catégorie). Les couches à
   relations (vélo/randonnées, "out geom;") restent séparées : mode de
   sortie différent, pas mélangeable avec "out center;" dans une même
   requête. Casiers colis (lockers) et historique des catastrophes
   naturelles (catnat, API Géorisques, pas Overpass) restent aussi à
   part : lockers a sa propre logique déjà stabilisée, catnat n'utilise
   pas Overpass du tout. */
const REQUETE_OVERPASS_POINTS_COMBINES =
    `[out:json][timeout:40];` +
    `(` +
    // Médecins (healthcare=doctor en plus d'amenity=doctors : les deux tags
    // coexistent selon le contributeur, Overpass dédoublonne de lui-même).
    `node["amenity"="doctors"](${BBOX_OVERPASS});` +
    `way["amenity"="doctors"](${BBOX_OVERPASS});` +
    `node["healthcare"="doctor"](${BBOX_OVERPASS});` +
    `way["healthcare"="doctor"](${BBOX_OVERPASS});` +
    // Vétérinaires
    `node["amenity"="veterinary"](${BBOX_OVERPASS});` +
    `way["amenity"="veterinary"](${BBOX_OVERPASS});` +
    // Dentistes
    `node["amenity"="dentist"](${BBOX_OVERPASS});` +
    `way["amenity"="dentist"](${BBOX_OVERPASS});` +
    // Casernes de pompiers
    `node["amenity"="fire_station"](${BBOX_OVERPASS});` +
    `way["amenity"="fire_station"](${BBOX_OVERPASS});` +
    // Gendarmerie & police
    `node["amenity"="police"](${BBOX_OVERPASS});` +
    `way["amenity"="police"](${BBOX_OVERPASS});` +
    // EHPAD & maisons de retraite
    `node["amenity"="social_facility"]["social_facility"="nursing_home"](${BBOX_OVERPASS});` +
    `way["amenity"="social_facility"]["social_facility"="nursing_home"](${BBOX_OVERPASS});` +
    // Toilettes publiques
    `node["amenity"="toilets"](${BBOX_OVERPASS});` +
    `way["amenity"="toilets"](${BBOX_OVERPASS});` +
    // Points d'eau potable
    `node["amenity"="drinking_water"](${BBOX_OVERPASS});` +
    // Bibliothèques & médiathèques
    `node["amenity"="library"](${BBOX_OVERPASS});` +
    `way["amenity"="library"](${BBOX_OVERPASS});` +
    // Offices de tourisme (office=tourism : balisage actuel ; tourism=information
    // + information=office : ancien schéma, encore présent sur des points
    // jamais mis à jour).
    `node["office"="tourism"](${BBOX_OVERPASS});` +
    `way["office"="tourism"](${BBOX_OVERPASS});` +
    `node["tourism"="information"]["information"="office"](${BBOX_OVERPASS});` +
    `way["tourism"="information"]["information"="office"](${BBOX_OVERPASS});` +
    // Aires de camping-car
    `node["tourism"="caravan_site"](${BBOX_OVERPASS});` +
    `way["tourism"="caravan_site"](${BBOX_OVERPASS});` +
    // Points remarquables de la forêt de Bercé (arbre nommé, source,
    // attraction touristique nommée)
    `node["natural"="tree"]["name"](${BBOX_OVERPASS});` +
    `node["natural"="spring"](${BBOX_OVERPASS});` +
    `way["natural"="spring"](${BBOX_OVERPASS});` +
    `node["tourism"="attraction"]["name"](${BBOX_OVERPASS});` +
    // Parkings publics
    `node["amenity"="parking"](${BBOX_OVERPASS});` +
    `way["amenity"="parking"](${BBOX_OVERPASS});` +
    // Vente directe à la ferme
    `node["shop"="farm"](${BBOX_OVERPASS});` +
    `way["shop"="farm"](${BBOX_OVERPASS});` +
    // Petit patrimoine rural (croix, lavoirs, moulins - deux tags
    // concurrents selon le contributeur -, fontaines anciennes)
    `node["historic"="wayside_cross"](${BBOX_OVERPASS});` +
    `way["historic"="wayside_cross"](${BBOX_OVERPASS});` +
    `node["man_made"="wash_house"](${BBOX_OVERPASS});` +
    `way["man_made"="wash_house"](${BBOX_OVERPASS});` +
    `node["man_made"="watermill"](${BBOX_OVERPASS});` +
    `way["man_made"="watermill"](${BBOX_OVERPASS});` +
    `node["historic"="mill"](${BBOX_OVERPASS});` +
    `way["historic"="mill"](${BBOX_OVERPASS});` +
    `node["amenity"="fountain"](${BBOX_OVERPASS});` +
    `way["amenity"="fountain"](${BBOX_OVERPASS});` +
    // Antennes-relais mobiles (pivot depuis l'idée initiale de couche WMS
    // ARCEP - voir README pour le détail)
    `node["man_made"="mast"]["tower:type"="communication"](${BBOX_OVERPASS});` +
    `node["man_made"="mast"]["communication:mobile_phone"="yes"](${BBOX_OVERPASS});` +
    `node["man_made"="tower"]["tower:type"="communication"](${BBOX_OVERPASS});` +
    `);` +
    `out center;`;
const fetchOverpassPointsCombines = creerFetchOverpass(REQUETE_OVERPASS_POINTS_COMBINES, "geoberce-cache-points-combines");

/* Répartit un élément de la réponse combinée vers l'id de couche
   correspondant, par ses tags - mêmes conditions que chacune des
   requêtes individuelles d'origine, familles de tags disjointes entre
   couches donc pas d'ambiguïté possible. */
function classifierElementCombine(tags) {
    if (!tags) return null;
    if (tags.amenity === "doctors" || tags.healthcare === "doctor") return "medecins";
    if (tags.amenity === "veterinary") return "veterinaires";
    if (tags.amenity === "dentist") return "dentistes";
    if (tags.amenity === "fire_station") return "pompiers";
    if (tags.amenity === "police") return "gendarmerie";
    if (tags.amenity === "social_facility" && tags.social_facility === "nursing_home") return "ehpad";
    if (tags.amenity === "toilets") return "toilettes";
    if (tags.amenity === "drinking_water") return "fontaines";
    if (tags.amenity === "library") return "bibliotheques";
    if (tags.office === "tourism" || (tags.tourism === "information" && tags.information === "office")) return "officesTourisme";
    if (tags.tourism === "caravan_site") return "campingcar";
    if ((tags.natural === "tree" && tags.name) || tags.natural === "spring" || (tags.tourism === "attraction" && tags.name)) return "pointsRemarquablesBerce";
    if (tags.amenity === "parking") return "parkings";
    if (tags.shop === "farm") return "venteFerme";
    if (tags.historic === "wayside_cross" || tags.man_made === "wash_house" || tags.man_made === "watermill" || tags.historic === "mill" || tags.amenity === "fountain") return "patrimoineRural";
    if ((tags.man_made === "mast" && (tags["tower:type"] === "communication" || tags["communication:mobile_phone"] === "yes")) || (tags.man_made === "tower" && tags["tower:type"] === "communication")) return "antennes";
    return null;
}

/* Point d'extension `fetchPersonnalise` pour une couche donnée : réutilise
   la requête combinée (un seul appel réseau/cache pour toutes ces
   couches) et ne garde que les éléments qui lui correspondent. */
function fetchOverpassCombinePourCouche(coucheId) {
    return fetchOverpassPointsCombines().then(data => {
        const elements = (data && data.elements) || [];
        return { elements: elements.filter(el => classifierElementCombine(el.tags) === coucheId) };
    });
}

function categoriePatrimoineRural(props) {
    if (props.historic === "wayside_cross") return { id: "croix", label: "Croix de chemin", icon: "fa-solid fa-cross", color: PALETTE.ardoise };
    if (props.man_made === "wash_house") return { id: "lavoir", label: "Lavoir", icon: "fa-solid fa-water", color: PALETTE.riviere };
    if (props.man_made === "watermill" || props.historic === "mill") return { id: "moulin", label: "Moulin", icon: "fa-solid fa-industry", color: PALETTE.terracotta };
    if (props.amenity === "fountain") return { id: "fontaine", label: "Fontaine", icon: "fa-solid fa-droplet", color: PALETTE.riviere };
    return { id: "autre", label: "Petit patrimoine", icon: "fa-solid fa-landmark", color: "#7F7E7B" };
}
function iconePatrimoineRural(feature) {
    const cat = categoriePatrimoineRural(feature.properties || {});
    return { icon: cat.icon, color: cat.color };
}

function categoriePatrimoineRural(props) {
    if (props.historic === "wayside_cross") return { id: "croix", label: "Croix de chemin", icon: "fa-solid fa-cross", color: PALETTE.ardoise };
    if (props.man_made === "wash_house") return { id: "lavoir", label: "Lavoir", icon: "fa-solid fa-water", color: PALETTE.riviere };
    if (props.man_made === "watermill" || props.historic === "mill") return { id: "moulin", label: "Moulin", icon: "fa-solid fa-industry", color: PALETTE.terracotta };
    if (props.amenity === "fountain") return { id: "fontaine", label: "Fontaine", icon: "fa-solid fa-droplet", color: PALETTE.riviere };
    return { id: "autre", label: "Petit patrimoine", icon: "fa-solid fa-landmark", color: "#7F7E7B" };
}
function iconePatrimoineRural(feature) {
    const cat = categoriePatrimoineRural(feature.properties || {});
    return { icon: cat.icon, color: cat.color };
}

/* Distance d'une géométrie (somme des distances entre points consécutifs,
   formule de haversine) - pas de dénivelé disponible depuis Overpass pour
   affiner l'estimation de durée, donc convention simple reprise du seul
   tracé existant avant cet ajout (J1 : 4,04 km / 1,01 h, soit tout
   juste 4 km/h) plutôt que d'inventer une autre référence. */
function distanceHaversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}
function distanceMultiLigneKm(lignes) {
    let total = 0;
    lignes.forEach(ligne => {
        for (let i = 1; i < ligne.length; i++) {
            const [lon1, lat1] = ligne[i - 1], [lon2, lat2] = ligne[i];
            total += distanceHaversineKm(lat1, lon1, lat2, lon2);
        }
    });
    return total;
}
function arrondi2(n) { return Math.round(n * 100) / 100; }

/* Fusionne les sentiers balisés (Overpass) avec le tracé existant du
   dépôt (couches/tourisme/randonnees.geojson, "J1") - même principe que
   les casiers colis (flux + fichier local), sans savoir si ce tracé
   existant est ou non déjà présent dans OSM sous un autre id : le
   garder systématiquement plutôt que risquer de le perdre. */
function fetchRandonnees() {
    return Promise.all([
        fetchOverpassRandonnees(),
        fetch("couches/tourisme/randonnees.geojson").then(r => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] }))
    ]).then(([overpass, existant]) => ({ overpass, existant }));
}
function geojsonDepuisRandonnees(data) {
    const elements = (data.overpass && data.overpass.elements) || [];
    const featuresOverpass = elements.map(rel => {
        const lignes = (rel.members || [])
            .filter(m => m.type === "way" && Array.isArray(m.geometry) && m.geometry.length > 1)
            .map(m => m.geometry.map(pt => [pt.lon, pt.lat]));
        if (!lignes.length) return null;
        const distance = arrondi2(distanceMultiLigneKm(lignes));
        return {
            type: "Feature",
            geometry: { type: "MultiLineString", coordinates: lignes },
            properties: {
                ...(rel.tags || {}),
                id: (rel.tags && rel.tags.ref) || String(rel.id),
                distance,
                dureeEstim: arrondi2(distance / 4),
                denivelePo: null, deniveleNe: null, altiMax: null, altiMin: null
            }
        };
    }).filter(Boolean);
    const featuresExistantes = (data.existant && data.existant.features) || [];
    return { type: "FeatureCollection", features: [...featuresExistantes, ...featuresOverpass] };
}

/* Points remarquables de la forêt de Bercé - flux Overpass complété par
   un fichier local (mêmes limites/mêmes raisons que
   lockers_manuels.geojson : les sites emblématiques de la forêt,
   documentés par l'ONF, ne sont pas forcément cartographiés sur OSM). */
function fetchPointsBerceManuels() {
    return fetch("couches/tourisme/pointsRemarquablesBerce_manuels.geojson")
        .then(r => r.ok ? r.json() : { type: "FeatureCollection", features: [] })
        .catch(() => ({ type: "FeatureCollection", features: [] }));
}
function fetchPointsBerce() {
    return Promise.all([fetchOverpassCombinePourCouche("pointsRemarquablesBerce"), fetchPointsBerceManuels()])
        .then(([overpass, manuels]) => ({ overpass, manuels }));
}
function geojsonDepuisPointsBerce(data) {
    const base = geojsonDepuisElementsOverpass(data.overpass);
    const featuresManuels = (data.manuels && data.manuels.features) || [];
    return { type: "FeatureCollection", features: [...base.features, ...featuresManuels] };
}
function categoriePointRemarquableBerce(props) {
    if (props.natural === "tree") return { id: "arbre", label: "Arbre remarquable", icon: "fa-solid fa-tree", color: PALETTE.foret };
    if (props.natural === "spring") return { id: "source", label: "Source", icon: "fa-solid fa-water", color: PALETTE.riviere };
    return { id: "attraction", label: "Point remarquable", icon: "fa-solid fa-star", color: PALETTE.terracotta };
}
function iconePointRemarquableBerce(feature) {
    const cat = categoriePointRemarquableBerce(feature.properties || {});
    return { icon: cat.icon, color: cat.color };
}

/* Relations OSM (out geom;) -> une Feature MultiLineString par relation,
   une ligne par way membre (seuls les membres "way" avec une géométrie
   comptent - les nœuds isolés éventuels, ex. des points de jalonnement,
   ne forment pas de ligne et sont ignorés). */
function geojsonDepuisRoutesVelo(data) {
    const elements = (data && data.elements) || [];
    const features = elements.map(rel => {
        const lignes = (rel.members || [])
            .filter(m => m.type === "way" && Array.isArray(m.geometry) && m.geometry.length > 1)
            .map(m => m.geometry.map(pt => [pt.lon, pt.lat]));
        if (!lignes.length) return null;
        return { type: "Feature", geometry: { type: "MultiLineString", coordinates: lignes }, properties: rel.tags || {} };
    }).filter(Boolean);
    return { type: "FeatureCollection", features };
}

/* =========================================================
   HISTORIQUE DES CATASTROPHES NATURELLES (CATNAT/GASPAR)
   API Géorisques v1 (georisques.gouv.fr), endpoint CATNAT, en accès
   libre sans jeton - confirmé joignable (ex. .../api/v1/gaspar/catnat
   ?code_insee=30007&page_size=20), MAIS forme exacte de la réponse (nom
   du champ contenant la liste, noms des champs par événement) non
   vérifiable en conditions réelles (accès réseau restreint pendant le
   développement, comme pour la couche OLD/WMS - voir README). Interrogé
   commune par commune (code_insee), contrairement à Overpass qui
   accepte un rectangle englobant pour tout le territoire d'un coup :
   forme de requête différente d'une API à l'autre, pas de mutualisation
   possible avec creerFetchOverpass. Géométrie des communes reprise de
   couches/communes.geojson (déjà dans le dépôt) plutôt que demandée à
   Géorisques : seuls les événements viennent du flux distant. */
const CACHE_CATNAT_CLE = "geoberce-cache-catnat";
const CACHE_CATNAT_DUREE_MS = 24 * 60 * 60 * 1000; // historique d'arrêtés, change rarement : cache plus long que les flux Overpass

function lireCacheCatnat() {
    try {
        const brut = localStorage.getItem(CACHE_CATNAT_CLE);
        if (!brut) return null;
        const { horodatage, donnees } = JSON.parse(brut);
        if (!horodatage || Date.now() - horodatage > CACHE_CATNAT_DUREE_MS) return null;
        return donnees;
    } catch (_) {
        return null;
    }
}
function ecrireCacheCatnat(donnees) {
    try {
        localStorage.setItem(CACHE_CATNAT_CLE, JSON.stringify({ horodatage: Date.now(), donnees }));
    } catch (_) {
        // silencieux : le cache est un confort, pas un besoin
    }
}
/* Plusieurs enveloppes de réponse possibles selon la version/le format
   exact de l'API (tableau brut, {data:[...]}, {results:[...]}...) :
   lecture tolérante plutôt que de supposer une forme précise. */
function elementsReponseCatnat(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.results)) return data.results;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
}
function recupererCatnat() {
    const enCache = lireCacheCatnat();
    if (enCache) return Promise.resolve(enCache);

    const parCommune = Object.keys(COMMUNES_TERRITOIRE).map(code =>
        fetch(`https://georisques.gouv.fr/api/v1/gaspar/catnat?code_insee=${code}&page_size=50`)
            .then(r => r.ok ? r.json() : null)
            .then(data => ({ insee: code, evenements: elementsReponseCatnat(data) }))
            .catch(() => ({ insee: code, evenements: [] }))
    );
    return Promise.all(parCommune).then(resultats => { ecrireCacheCatnat(resultats); return resultats; });
}
function fetchCatnat() {
    return Promise.all([
        fetch("couches/communes.geojson").then(r => r.json()),
        recupererCatnat()
    ]).then(([communes, resultats]) => ({ communes, resultats }));
}
/* Une Feature par commune (le polygone existant), pas une par événement :
   plusieurs arrêtés concernent en général la même commune (inondations à
   répétition, sécheresse...), les regrouper sous un seul polygone évite
   d'empiler des dizaines de marqueurs identiques. */
function geojsonDepuisCatnat(data) {
    const parInsee = {};
    (data.resultats || []).forEach(r => { parInsee[r.insee] = r.evenements; });
    const features = ((data.communes && data.communes.features) || []).map(f => ({
        ...f,
        properties: { ...f.properties, catnat_evenements: parInsee[f.properties.code_insee] || [] }
    }));
    return { type: "FeatureCollection", features };
}
/* Dégradé par nombre d'événements recensés, pas par montant (couleurPrix
   ne convient pas à un compte d'événements) : gris si aucun arrêté
   connu, puis 3 paliers du jaune au rouge - seuils choisis pour rester
   lisibles avec les petits nombres typiques d'un historique communal. */
function couleurCatnat(nb) {
    if (!nb) return "#D8D6D0";
    if (nb <= 3) return "#F2C94C";
    if (nb <= 7) return "#F2994A";
    return "#AD4826";
}
function styleCatnat(feature) {
    const nb = (feature.properties.catnat_evenements || []).length;
    return { color: "#fff", weight: 1, fillColor: couleurCatnat(nb), fillOpacity: 0.55 };
}

/* =========================================================
   COUCHES
   type: "point" | "line" | "polygon" | "choropleth"
   lazy: true  -> chargée seulement quand l'utilisateur coche la couche
         false -> chargée au démarrage (fichiers légers, utiles à la recherche)
   searchable: la couche alimente la recherche unifiée
   titleFields: liste de clés de propriétés à essayer, dans l'ordre,
                pour trouver le nom à afficher (titre popup + recherche)
   ========================================================= */
const LAYERS = [

    /* ---------- SERVICES ---------- */
    {
        id: "mairies", group: "services", label: "Mairies",
        file: "couches/services/mairies.geojson", type: "point",
        icon: "fa-solid fa-landmark", color: PALETTE.riviere,
        lazy: false, searchable: true, cluster: false,
        titleFields: ["name", "commune"],
        subtitleFields: ["opening_hours", "contact_phone"]
    },
    {
        id: "bal", group: "services", label: "Boîtes aux lettres",
        file: "couches/services/bal.geojson", type: "point",
        icon: "fa-solid fa-envelope", color: PALETTE.ardoise,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["LB_VOIE_EXT", "LB_COM"],
        subtitleFields: ["LB_COM", "CO_POSTAL"]
    },
    {
        id: "dechets", group: "services", label: "Déchèteries / tri",
        file: "couches/services/dechets.geojson", type: "point",
        icon: "fa-solid fa-recycle", color: PALETTE.feuille,
        iconePourFeature: iconeDechet,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["name", "type", "com_nom"],
        subtitleFields: ["com_nom", "opening_hours"]
    },
    {
        id: "lockers", group: "services", label: "Points relais & casiers colis",
        /* Flux Overpass (OpenStreetMap), voir la section dédiée plus haut
           dans ce fichier pour le détail (bbox, limites de couverture,
           repli sur plusieurs miroirs). */
        fetchPersonnalise: fetchOverpassLockers, transform: geojsonDepuisOverpass,
        type: "point", icon: "fa-solid fa-box", color: PALETTE.ardoise,
        iconePourFeature: iconeLocker,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name", "brand", "ref"],
        subtitleFields: ["brand", "operator"]
    },
    {
        id: "irve", group: "services", label: "Bornes de recharge",
        file: "couches/services/irve.geojson", type: "point",
        icon: "fa-solid fa-charging-station", color: PALETTE.terracotta,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["nom_station", "nom_enseigne"],
        subtitleFields: ["adresse_station", "nbre_pdc"]
    },
    {
        id: "marches", group: "services", label: "Marchés",
        file: "couches/services/marches.geojson", type: "point",
        icon: "fa-solid fa-store", color: PALETTE.feuille,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["name", "amenity"],
        subtitleFields: []
    },
    {
        id: "airesJeu", group: "services", label: "Aires de jeux",
        file: "couches/services/airesJeu.geojson", type: "point",
        icon: "fa-solid fa-child-reaching", color: PALETTE.terracotta,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["min_age", "max_age"]
    },
    {
        id: "equipementSportif", group: "services", label: "Équipements sportifs",
        file: "couches/services/equipementSportif.geojson", type: "point",
        icon: "fa-solid fa-futbol", color: PALETTE.riviere,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["name", "sport", "com_nom"],
        subtitleFields: ["sport", "com_nom"]
    },
    {
        id: "bibliotheques", group: "services", label: "Bibliothèques & médiathèques",
        /* Flux Overpass (OpenStreetMap), voir plus haut dans ce fichier. */
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("bibliotheques"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-book", color: PALETTE.foret,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["opening_hours"]
    },
    {
        id: "franceServices", group: "services", label: "France Services",
        /* Extrait filtré sur le territoire (3 points) du fichier national
           "Liste des structures labellisées France services" (ANCT,
           data.gouv.fr), fourni par l'utilisatrice le 10/09/2026 - voir le
           README pour la procédure de mise à jour (pas de flux public
           filtrable par territoire côté ANCT, contrairement à Overpass). */
        file: "couches/services/franceServices.geojson", type: "point",
        icon: "fa-solid fa-people-roof", color: PALETTE.riviere,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["lib_fs"],
        subtitleFields: ["lib_com", "format_fs"]
    },
    {
        id: "toilettes", group: "services", label: "Toilettes publiques",
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("toilettes"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-restroom", color: PALETTE.ardoise,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["opening_hours"]
    },
    {
        id: "fontaines", group: "services", label: "Points d'eau potable",
        /* sansPopup : données OSM presque toujours trop pauvres pour une
           fiche (souvent juste le tag "amenity=drinking_water", rien
           d'autre) - décidé avec l'utilisatrice, voir README. */
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("fontaines"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-droplet", color: PALETTE.riviere,
        sansPopup: true,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: []
    },
    {
        id: "parkings", group: "services", label: "Parkings publics",
        /* sansPopup : voir fontaines ci-dessus, même raison (capacité/
           accès rarement renseignés sur ce territoire). */
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("parkings"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-square-parking", color: PALETTE.ardoise,
        sansPopup: true,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["capacity", "fee"]
    },
    {
        id: "antennes", group: "services", label: "Antennes-relais mobiles",
        /* Pivot depuis l'idée initiale de couche WMS ARCEP (couverture
           mobile) - voir plus haut dans ce fichier pour le détail.
           sansPopup : voir fontaines ci-dessus, l'opérateur est souvent
           absent des données OSM. */
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("antennes"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-tower-cell", color: PALETTE.ardoise,
        sansPopup: true,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["operator", "ref"],
        subtitleFields: ["operator"]
    },

    /* ---------- FAMILLE ---------- */
    {
        id: "petiteEnfance", group: "famille", label: "Petite enfance",
        file: "couches/famille/petiteEnfance.geojson", type: "point",
        icon: "fa-solid fa-baby", color: PALETTE.terracotta,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["nom"],
        subtitleFields: ["adresse", "telephone", "type"]
    },
    {
        id: "education", group: "famille", label: "Écoles",
        file: "couches/famille/education.geojson", type: "point",
        icon: "fa-solid fa-graduation-cap", color: PALETTE.terracotta,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["name", "type_fr", "com_nom"],
        subtitleFields: ["type_fr", "com_nom"]
    },

    /* ---------- COMMERCES ---------- */
    {
        id: "commerces", group: "commerces", label: "Commerces",
        file: "couches/commerces/commerces.geojson", type: "point",
        icon: "fa-solid fa-basket-shopping", color: PALETTE.feuille,
        iconePourFeature: iconeCommerce,
        legend: TYPES_COMMERCES, legendDefaut: TYPE_COMMERCE_DEFAUT, categoriser: categoriePourFeature,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["name", "brand", "type"],
        subtitleFields: ["type", "opening_hours", "phone"]
    },
    {
        id: "banques", group: "commerces", label: "Banques & DAB",
        file: "couches/commerces/banques.geojson", type: "point",
        icon: "fa-solid fa-money-bill-wave", color: PALETTE.ardoise,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["name", "brand", "com_nom"],
        subtitleFields: ["com_nom", "has_atm"]
    },
    {
        id: "venteFerme", group: "commerces", label: "Vente directe à la ferme",
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("venteFerme"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-tractor", color: PALETTE.feuille,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["opening_hours"]
    },

    /* ---------- MOBILITÉ ---------- */
    {
        id: "arretsALEOP", group: "mobilite", label: "Arrêts de bus (ALÉOP)",
        file: "couches/mobilite/arretsALEOP.geojson", type: "point",
        icon: "fa-solid fa-bus", color: PALETTE.riviere,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["name", "description"],
        subtitleFields: ["route_short_name", "route_long_name"]
    },
    {
        id: "reseauALEOP", group: "mobilite", label: "Lignes ALÉOP",
        file: "couches/mobilite/reseauALEOP.geojson", type: "line",
        color: PALETTE.riviere,
        lazy: false, searchable: false, cluster: false,
        titleFields: ["route_long_name", "route_short_name", "name"],
        subtitleFields: []
    },
    {
        id: "airecovoiturage", group: "mobilite", label: "Aires de covoiturage",
        file: "couches/mobilite/airecovoiturage.geojson", type: "point",
        icon: "fa-solid fa-car", color: PALETTE.riviere,
        lazy: false, searchable: true, cluster: true,
        titleFields: ["nom_lieu", "com_lieu"],
        subtitleFields: ["ad_lieu", "nbre_pl"]
    },

    /* ---------- SÉCURITÉ / SANTÉ ---------- */
    {
        id: "dae", group: "securite", label: "Défibrillateurs",
        file: "couches/securite/dae.geojson", type: "point",
        icon: "fa-solid fa-heart-pulse", color: "#AD4826",
        lazy: false, searchable: true, cluster: true,
        titleFields: ["c_nom", "c_com_nom"],
        subtitleFields: ["c_adr_num", "c_adr_voie", "c_com_nom"]
    },
    {
        id: "medecins", group: "securite", label: "Médecins",
        /* Flux Overpass (OpenStreetMap), voir plus haut dans ce fichier.
           Complétude dépendante d'OSM, même limite que les casiers colis. */
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("medecins"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-user-doctor", color: "#AD4826",
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["healthcare:speciality", "phone"]
    },
    {
        id: "veterinaires", group: "securite", label: "Vétérinaires",
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("veterinaires"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-paw", color: "#AD4826",
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name", "brand"],
        subtitleFields: ["phone", "opening_hours"]
    },
    {
        id: "dentistes", group: "securite", label: "Dentistes",
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("dentistes"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-tooth", color: "#AD4826",
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["phone", "opening_hours"]
    },
    {
        id: "pompiers", group: "securite", label: "Casernes de pompiers",
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("pompiers"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-fire", color: "#AD4826",
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["operator"]
    },
    {
        id: "gendarmerie", group: "securite", label: "Gendarmerie & police",
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("gendarmerie"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-shield-halved", color: "#AD4826",
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["operator", "phone"]
    },
    {
        id: "ehpad", group: "securite", label: "EHPAD & maisons de retraite",
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("ehpad"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-person-cane", color: "#AD4826",
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name", "operator"],
        subtitleFields: ["operator", "phone"]
    },

    /* ---------- PATRIMOINE ---------- */
    {
        id: "immeublesProteges", group: "patrimoine", label: "Monuments protégés",
        file: "couches/patrimoine/immeublesProteges.geojson", type: "point",
        icon: "fa-solid fa-monument", color: "#7F7E7B",
        lazy: false, searchable: true, cluster: true,
        titleFields: ["denomination_de_l_edifice", "autre_appellation_de_l_edifice"],
        subtitleFields: ["commune_forme_index", "datation_de_l_edifice"]
    },
    {
        id: "patrimoineRural", group: "patrimoine", label: "Petit patrimoine rural",
        /* Croix de chemin, lavoirs, moulins, fontaines anciennes - sur
           tout le territoire, contrairement à pointsRemarquablesBerce
           qui reste spécifique à la forêt (sites ONF nommés). Voir plus
           haut dans ce fichier pour le détail des tags par catégorie. */
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("patrimoineRural"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-landmark", color: "#7F7E7B",
        iconePourFeature: iconePatrimoineRural,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: []
    },

    /* ---------- TOURISME ---------- */
    {
        id: "randonnees", group: "tourisme", label: "Randonnées",
        /* Flux Overpass (relations route=hiking) fusionné avec le tracé
           existant du dépôt (couches/tourisme/randonnees.geojson) - voir
           plus haut dans ce fichier pour le détail (calcul de distance/
           durée estimée par géométrie, pas de dénivelé disponible). */
        fetchPersonnalise: fetchRandonnees, transform: geojsonDepuisRandonnees,
        type: "line", color: PALETTE.feuille,
        lazy: true, searchable: false, cluster: false,
        titleFields: ["name", "id"],
        subtitleFields: ["distance", "dureeEstim"]
    },
    {
        id: "velo", group: "tourisme", label: "Itinéraires cyclables",
        /* Relations OSM (route=bicycle) via Overpass, ex. "Le Loir à
           Vélo" - voir plus haut dans ce fichier pour le détail
           (géométrie récupérée avec "out geom;", pas "out center;"). */
        fetchPersonnalise: fetchOverpassVelo, transform: geojsonDepuisRoutesVelo,
        type: "line", color: PALETTE.terracotta,
        lazy: true, searchable: false, cluster: false,
        titleFields: ["name", "ref"],
        subtitleFields: ["network"]
    },
    {
        id: "officesTourisme", group: "tourisme", label: "Offices de tourisme",
        /* Flux Overpass (OpenStreetMap), voir plus haut dans ce fichier. */
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("officesTourisme"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-map-location-dot", color: PALETTE.riviere,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["opening_hours", "phone"]
    },
    {
        id: "campingcar", group: "tourisme", label: "Aires de camping-car",
        fetchPersonnalise: () => fetchOverpassCombinePourCouche("campingcar"), transform: geojsonDepuisElementsOverpass,
        type: "point", icon: "fa-solid fa-caravan", color: PALETTE.terracotta,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: ["capacity", "fee"]
    },
    {
        id: "pointsRemarquablesBerce", group: "tourisme", label: "Points remarquables (forêt de Bercé)",
        /* Flux Overpass (arbres nommés, sources, attractions), complété
           par un fichier local pour les sites emblématiques (Chêne
           Boppe, Fontaine de la Coudre, Source de l'Hermitière...)
           documentés par l'ONF mais pas forcément cartographiés sur OSM
           - voir la section dédiée du README, même principe que
           lockers_manuels.geojson. */
        fetchPersonnalise: fetchPointsBerce, transform: geojsonDepuisPointsBerce,
        type: "point", icon: "fa-solid fa-tree", color: PALETTE.foret,
        iconePourFeature: iconePointRemarquableBerce,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["name"],
        subtitleFields: []
    },

    /* ---------- URBANISME (fichiers lourds => chargement différé) ---------- */
    {
        id: "prixImmobilier", group: "urbanisme", label: "Prix immobilier par commune",
        file: "couches/urbanisme/prix_immobilier_communes.geojson", type: "choropleth",
        color: PALETTE.ardoise,
        lazy: false, searchable: false, cluster: false,
        valueField: "prix_m2_median",
        titleFields: ["commune"],
        subtitleFields: ["prix_m2_median", "nb_ventes"]
    },
    {
        id: "dpe", group: "urbanisme", label: "Diagnostics énergétiques (DPE)",
        file: "couches/urbanisme/dpe_loir_luce_berce.geojson", type: "point",
        icon: "fa-solid fa-bolt", color: PALETTE.ardoise,
        iconePourFeature: iconeDpe,
        lazy: true, searchable: false, cluster: true,
        titleFields: ["numero_dpe"],
        subtitleFields: ["etiquette_dpe", "annee_construction"]
    },
    {
        id: "zonagePLUi", group: "urbanisme", label: "Zonage PLUi",
        file: "couches/urbanisme/zonage_plui_loir_luce_berce_filtre.geojson", type: "polygon",
        color: PALETTE.ardoise,
        lazy: true, searchable: false, cluster: false,
        titleFields: ["libelong", "libelle"],
        subtitleFields: ["typezone"]
    },
    {
        id: "rga", group: "urbanisme", label: "Retrait-gonflement des argiles",
        file: "couches/urbanisme/rga_2025_loir_luce_berce.geojson", type: "polygon",
        color: "#D85A30",
        lazy: true, searchable: false, cluster: false,
        titleFields: ["niveau"],
        subtitleFields: ["surf_m2"]
    },
    {
        id: "mutations", group: "urbanisme", label: "Mutations immobilières (DVF)",
        file: "couches/urbanisme/parcelles_dvf_2021_2025_loir_luce_berce.geojson", type: "polygon",
        color: PALETTE.terracotta,
        styleFn: stylePrixMutation,
        lazy: true, searchable: false, cluster: false,
        titleFields: ["adresse", "reference_parcelle"],
        subtitleFields: ["commune", "nb_mutations"]
    },
    {
        id: "cadastre", group: "urbanisme", label: "Parcelles cadastrales",
        /* Flux unique du cadastre pour toute la comcom (bundler Etalab par
           EPCI), fusionné/complété par fusionnerCadastre. Volumineux
           (parcellaire complet des 24 communes, des dizaines de milliers de
           parcelles) : chargée à la demande, affichée seulement à partir
           d'un certain niveau de zoom (zoomMin), et seulement les parcelles
           dans la vue actuelle plutôt que tout le territoire d'un coup
           (viewportOnly, se met à jour au déplacement - voir layers.js). */
        file: URL_CADASTRE_EPCI, transform: fusionnerCadastre,
        type: "polygon", color: PALETTE.ardoise,
        styleFn: () => ({ color: PALETTE.ardoise, weight: 1, opacity: 0.6, fillOpacity: 0 }),
        zoomMin: 15, viewportOnly: true,
        lazy: true, searchable: false, cluster: false,
        titleFields: ["reference"],
        subtitleFields: ["commune_nom", "surface_m2"]
    },

    /* ---------- RISQUES & PRÉVENTION (couches en flux, données distantes
       tenues à jour par les fournisseurs et non copiées dans le dépôt) ---------- */
    {
        id: "vigieau", group: "risques", label: "Restrictions sécheresse (Vigieau)",
        /* Flux GeoJSON public des zones sous arrêté sécheresse en vigueur,
           publié par le Ministère (source du jeu de données data.gouv.fr
           "VigiEau : Arrêtés sécheresse en vigueur"), mis à jour quotidiennement. */
        file: "https://regleau.s3.gra.perf.cloud.ovh.net/geojson/zones_arretes_en_vigueur.geojson",
        type: "polygon", color: "#F2994A",
        styleFn: couleurVigieau,
        lazy: true, searchable: false, cluster: false,
        titleFields: ["nom_zone", "nomZone", "nom", "zone_nom", "libelle", "nomBassin"],
        subtitleFields: ["niveauGravite", "niveau_gravite", "type_eau", "zoneType", "departement", "nom_dept"]
    },
    {
        id: "old", group: "risques", label: "Obligations légales de débroussaillement",
        /* Flux WMS de l'IGN (Géoplateforme) - zonage informatif OLD.
           Nom de couche à vérifier/ajuster si besoin via le GetCapabilities :
           https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities */
        type: "wms",
        wmsUrl: "https://data.geopf.fr/wms-r/wms",
        wmsLayer: "DEBROUSSAILLEMENT",
        opacity: 0.6,
        attribution: "IGN",
        color: "#AD4826",
        lazy: true, searchable: false, cluster: false
    },
    {
        id: "catnat", group: "risques", label: "Historique des catastrophes naturelles",
        /* API Géorisques (CATNAT/GASPAR), interrogée commune par commune
           - voir plus haut dans ce fichier pour le détail et la limite
           principale : forme exacte de la réponse non vérifiable en
           conditions réelles (comme la couche OLD/WMS juste au-dessus),
           lecture volontairement tolérante côté code. Géométrie reprise
           de couches/communes.geojson (déjà dans le dépôt). */
        fetchPersonnalise: fetchCatnat, transform: geojsonDepuisCatnat,
        type: "polygon", color: PALETTE.ardoise, styleFn: styleCatnat,
        lazy: true, searchable: false, cluster: false,
        titleFields: ["nom_offici"],
        subtitleFields: []
    },
    {
        id: "carburants", group: "mobilite", label: "Prix des carburants",
        /* Flux instantané officiel (mis à jour ~10 min), filtré sur un rayon
           de 25 km autour du territoire pour ne récupérer que les stations utiles. */
        file: "https://data.economie.gouv.fr/api/records/1.0/search/?dataset=prix-des-carburants-en-france-flux-instantane-v2&geofilter.distance=47.791528,0.412223,25000&rows=300",
        transform: geojsonDepuisFluxODS,
        type: "point",
        icon: "fa-solid fa-gas-pump", color: PALETTE.riviere,
        lazy: true, searchable: true, cluster: true,
        titleFields: ["adresse", "nom", "enseigne", "id"],
        subtitleFields: ["ville", "cp", "gazole_prix", "sp95_prix", "e10_prix"]
    }
];

/* =========================================================
   THÉMATIQUES DE LA PAGE D'ACCUEIL
   (peuvent regrouper plusieurs groupes de couches)
   ========================================================= */
const THEMES = [
    { label: "Services & mairie", icon: "fa-solid fa-landmark", groups: ["services"] },
    { label: "Famille", icon: "fa-solid fa-child-reaching", groups: ["famille"] },
    { label: "Commerces", icon: "fa-solid fa-basket-shopping", groups: ["commerces"] },
    { label: "Mobilité", icon: "fa-solid fa-bus", groups: ["mobilite"] },
    { label: "Nature & rando", icon: "fa-solid fa-person-hiking", groups: ["tourisme", "patrimoine"] },
    { label: "Sécurité & santé", icon: "fa-solid fa-heart-pulse", groups: ["securite"] },
    { label: "Risques & prévention", icon: "fa-solid fa-triangle-exclamation", groups: ["risques"] }
];

/* =========================================================
   RACCOURCIS "PRÈS DE CHEZ MOI"
   Affichés en premier sur l'écran d'accueil : ils déclenchent
   une géolocalisation puis affichent la liste des résultats
   les plus proches pour une ou plusieurs couches (js/proximite.js).
   Pas de couleur ici : elle est reprise de la couche visée
   (LAYERS[...].color) pour rester cohérente avec le reste du site.
   ========================================================= */
/* Choisis pour coller à des besoins concrets du quotidien plutôt qu'à
   ce qui se trouvait être disponible techniquement - "où déposer mon
   courrier"/"la boulangerie la plus proche" parlent à tout le monde,
   contrairement par exemple à "Assistante maternelle" (utile, mais à un
   public bien plus restreint) qui n'a donc plus sa place ici. */
const RACCOURCIS = [
    {
        label: "Où déposer mon courrier ?",
        icon: "fa-solid fa-envelope",
        layerIds: ["bal"]
    },
    {
        label: "La boulangerie la plus proche",
        icon: "fa-solid fa-bread-slice",
        layerIds: ["commerces"],
        filtre: item => item.layer.feature && item.layer.feature.properties.type === "bakery"
    },
    {
        label: "La pharmacie la plus proche",
        icon: "fa-solid fa-prescription-bottle-medical",
        layerIds: ["commerces"],
        filtre: item => item.layer.feature && item.layer.feature.properties.type === "pharmacy"
    },
    {
        label: "Stations essence près de chez moi",
        icon: "fa-solid fa-gas-pump",
        layerIds: ["carburants"]
    },
    {
        label: "Le médecin le plus proche",
        icon: "fa-solid fa-user-doctor",
        layerIds: ["medecins"]
    },
    {
        label: "Point relais / casier colis le plus proche",
        icon: "fa-solid fa-box",
        layerIds: ["lockers"]
    },
    {
        label: "Commerces près de chez moi",
        icon: "fa-solid fa-basket-shopping",
        layerIds: ["commerces"]
    },
    {
        label: "Écoles près de chez moi",
        icon: "fa-solid fa-graduation-cap",
        layerIds: ["education"]
    },
    {
        label: "Défibrillateurs près de chez moi",
        icon: "fa-solid fa-heart-pulse",
        layerIds: ["dae"]
    }
];
