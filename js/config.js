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
const URL_CADASTRE_EPCI = "https://cadastre.data.gouv.fr/bundler/cadastre-etalab/epcis/200070373/geojson/communes";

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
        lazy: false, searchable: true, cluster: true,
        titleFields: ["name", "type", "com_nom"],
        subtitleFields: ["com_nom", "opening_hours"]
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

    /* ---------- PATRIMOINE ---------- */
    {
        id: "immeublesProteges", group: "patrimoine", label: "Monuments protégés",
        file: "couches/patrimoine/immeublesProteges.geojson", type: "point",
        icon: "fa-solid fa-monument", color: "#7F7E7B",
        lazy: false, searchable: true, cluster: true,
        titleFields: ["denomination_de_l_edifice", "autre_appellation_de_l_edifice"],
        subtitleFields: ["commune_forme_index", "datation_de_l_edifice"]
    },

    /* ---------- TOURISME ---------- */
    {
        id: "randonnees", group: "tourisme", label: "Randonnées",
        file: "couches/tourisme/randonnees.geojson", type: "line",
        color: PALETTE.feuille,
        lazy: false, searchable: false, cluster: false,
        titleFields: ["id"],
        subtitleFields: ["distance", "dureeEstim"]
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
        lazy: true, searchable: false, cluster: false,
        titleFields: ["adresse", "reference_parcelle"],
        subtitleFields: ["commune", "nb_mutations"]
    },
    {
        id: "cadastre", group: "urbanisme", label: "Parcelles cadastrales",
        /* Flux unique du cadastre pour toute la comcom (bundler Etalab par
           EPCI), fusionné/complété par fusionnerCadastre. Volumineux
           (parcellaire complet des 24 communes) : chargée à la demande et
           affichée seulement à partir d'un certain niveau de zoom (voir
           zoomMin dans layers.js), comme les visualisateurs de cadastre
           habituels. */
        file: URL_CADASTRE_EPCI, transform: fusionnerCadastre,
        type: "polygon", color: PALETTE.ardoise,
        styleFn: () => ({ color: PALETTE.ardoise, weight: 1, opacity: 0.6, fillOpacity: 0 }),
        zoomMin: 15,
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
const RACCOURCIS = [
    {
        label: "Stations essence près de chez moi",
        icon: "fa-solid fa-gas-pump",
        layerIds: ["carburants"]
    },
    {
        label: "Assistante maternelle près de chez moi",
        icon: "fa-solid fa-baby",
        layerIds: ["petiteEnfance"]
    },
    {
        label: "Écoles près de chez moi",
        icon: "fa-solid fa-graduation-cap",
        layerIds: ["education"]
    },
    {
        label: "Commerces près de chez moi",
        icon: "fa-solid fa-basket-shopping",
        layerIds: ["commerces"]
    },
    {
        label: "Défibrillateurs près de chez moi",
        icon: "fa-solid fa-heart-pulse",
        layerIds: ["dae"]
    },
    {
        label: "Bornes de recharge près de chez moi",
        icon: "fa-solid fa-charging-station",
        layerIds: ["irve"]
    }
];
