/* =========================================================
   MOBILITÉ
   ========================================================= */


/* =========================================================
   GROUPES DE COUCHES
   ========================================================= */

let carburant = L.layerGroup();
let arrets = L.layerGroup();
let trajets = L.layerGroup();


/* =========================================================
   CARBURANTS
   ========================================================= */

fetch(
    "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?limit=100&where=code_departement=72"
)

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `Erreur HTTP : ${response.status}`
            );

        }

        return response.json();

    })

    .then(data => {

        console.log(
            "Carburants :",
            data.results.length,
            "stations chargées"
        );


        /* =====================================================
           FONCTIONS UTILITAIRES
           ===================================================== */

        function disponible(prix) {

            return (
                prix !== null &&
                prix !== undefined &&
                prix !== ""
            );

        }


        /* -----------------------------------------------------
           PRIX
           ----------------------------------------------------- */

        function formaterPrix(prix) {

            if (!disponible(prix)) {

                return null;

            }

            return Number(prix)
                .toFixed(3)
                .replace(".", ",") + " €/L";

        }


        /* -----------------------------------------------------
           DATE
           ----------------------------------------------------- */

        function formaterDate(date) {

            if (!date) {

                return "Non renseignée";

            }

            const d =
                new Date(date);


            if (isNaN(d)) {

                return "Non renseignée";

            }

            return d.toLocaleString(
                "fr-FR",
                {
                    dateStyle: "short",
                    timeStyle: "short"
                }
            );

        }


        /* -----------------------------------------------------
           NETTOYAGE DES LISTES
           ----------------------------------------------------- */

        function nettoyerListe(valeur) {

            if (!valeur) {

                return "";

            }

            return String(valeur)

                .replace(/[{}"]/g, "")

                .replace(/,/g, ", ")

                .trim();

        }


        /* -----------------------------------------------------
           ÉTAT D'UN CARBURANT
           ----------------------------------------------------- */

        function etatCarburant(
            nom,
            prix,
            ruptureTemporaire,
            ruptureDefinitive
        ) {

            const temporaire =
                nettoyerListe(
                    ruptureTemporaire
                )
                .toLowerCase()
                .includes(
                    nom.toLowerCase()
                );


            const definitive =
                nettoyerListe(
                    ruptureDefinitive
                )
                .toLowerCase()
                .includes(
                    nom.toLowerCase()
                );


            if (definitive) {

                return {

                    classe: "indisponible",

                    texte: "Indisponible"

                };

            }


            if (temporaire) {

                return {

                    classe: "rupture",

                    texte: "Rupture temporaire"

                };

            }


            if (disponible(prix)) {

                return {

                    classe: "disponible",

                    texte: formaterPrix(prix)

                };

            }


            return {

                classe: "inconnu",

                texte: "Non renseigné"

            };

        }


        /* -----------------------------------------------------
           LIGNE CARBURANT
           ----------------------------------------------------- */

        function ligneCarburant(
            nom,
            prix,
            ruptureTemporaire,
            ruptureDefinitive
        ) {

            const etat =
                etatCarburant(
                    nom,
                    prix,
                    ruptureTemporaire,
                    ruptureDefinitive
                );


            return `

                <div class="carburant-row">

                    <span class="carburant-nom">
                        ${nom}
                    </span>


                    <span
                        class="
                            carburant-valeur
                            carburant-${etat.classe}
                        "
                    >
                        ${etat.texte}
                    </span>

                </div>

            `;

        }


        /* -----------------------------------------------------
           HORAIRES
           ----------------------------------------------------- */

        function formaterHoraires(horaires) {

    if (!horaires) {

        return `
            <div class="info-description">
                Horaires non renseignés
            </div>
        `;

    }


    /*
     * Le champ peut être une chaîne JSON
     * ou directement un objet.
     */

    let donnees = horaires;


    if (typeof donnees === "string") {

        try {

            donnees =
                JSON.parse(donnees);

        }

        catch (error) {

            /*
             * Si ce n'est pas du JSON,
             * on utilisera le format texte
             * horaires_jour plus bas.
             */

            donnees = null;

        }

    }


    /* =====================================================
       FORMAT JSON
       ===================================================== */

    if (
        donnees &&
        Array.isArray(donnees.jour)
    ) {

        return `

            <div class="carburant-horaires">

                ${donnees.jour.map(
                    jour => {

                        const nom =
                            jour["@nom"] ||
                            "Jour";


                        /*
                         * Jour fermé
                         */

                        if (
                            jour["@ferme"] === "1"
                        ) {

                            return `

                                <div
                                    class="carburant-jour"
                                >

                                    <span
                                        class="
                                            carburant-jour-nom
                                        "
                                    >
                                        ${nom}
                                    </span>


                                    <span
                                        class="
                                            carburant-ferme
                                        "
                                    >
                                        Fermé
                                    </span>

                                </div>

                            `;

                        }


                        /*
                         * Horaires
                         */

                        const plages =
                            jour.horaire;


                        if (!plages) {

                            return `

                                <div
                                    class="carburant-jour"
                                >

                                    <span
                                        class="
                                            carburant-jour-nom
                                        "
                                    >
                                        ${nom}
                                    </span>


                                    <span
                                        class="
                                            carburant-jour-horaires
                                        "
                                    >
                                        Non renseigné
                                    </span>

                                </div>

                            `;

                        }


                        /*
                         * Une ou plusieurs plages
                         */

                        const liste =
                            Array.isArray(
                                plages
                            )
                                ? plages
                                : [plages];


                        const texte =
                            liste
                                .map(
                                    plage => {

                                        const ouverture =
                                            plage["@ouverture"] ||
                                            "";

                                        const fermeture =
                                            plage["@fermeture"] ||
                                            "";


                                        if (
                                            !ouverture &&
                                            !fermeture
                                        ) {

                                            return "";

                                        }


                                        return `
                                            ${ouverture.replace(
                                                ".",
                                                "h"
                                            )}
                                            –
                                            ${fermeture.replace(
                                                ".",
                                                "h"
                                            )}
                                        `;

                                    }
                                )
                                .filter(Boolean)
                                .join("<br>");


                        return `

                            <div
                                class="
                                    carburant-jour
                                "
                            >

                                <span
                                    class="
                                        carburant-jour-nom
                                    "
                                >
                                    ${nom}
                                </span>


                                <span
                                    class="
                                        carburant-jour-horaires
                                    "
                                >
                                    ${
                                        texte ||
                                        "Non renseigné"
                                    }
                                </span>

                            </div>

                        `;

                    }
                ).join("")}

            </div>

        `;

    }


    /* =====================================================
       FORMAT TEXTE horaires_jour
       ===================================================== */

    const texte =
        String(horaires)
            .replace(
                /Automate-24-24,\s*/i,
                ""
            )
            .replace(
                /\./g,
                ":"
            );


    const jours = [
        "Lundi",
        "Mardi",
        "Mercredi",
        "Jeudi",
        "Vendredi",
        "Samedi",
        "Dimanche"
    ];


    return `

        <div class="carburant-horaires">

            ${jours.map(
                jour => {

                    const regex =
                        new RegExp(
                            `${jour}\\s*([^,]+)`,
                            "i"
                        );


                    const resultat =
                        texte.match(
                            regex
                        );


                    if (!resultat) {

                        return `

                            <div
                                class="
                                    carburant-jour
                                "
                            >

                                <span
                                    class="
                                        carburant-jour-nom
                                    "
                                >
                                    ${jour}
                                </span>


                                <span
                                    class="
                                        carburant-ferme
                                    "
                                >
                                    Fermé
                                </span>

                            </div>

                        `;

                    }


                    let horairesJour =
                        resultat[1]
                            .trim();


                    horairesJour =
                        horairesJour
                            .replace(
                                /\s+et\s+/gi,
                                "<br>"
                            );


                    return `

                        <div
                            class="
                                carburant-jour
                            "
                        >

                            <span
                                class="
                                    carburant-jour-nom
                                "
                            >
                                ${jour}
                            </span>


                            <span
                                class="
                                    carburant-jour-horaires
                                "
                            >
                                ${horairesJour}
                            </span>

                        </div>

                    `;

                }
            ).join("")}

        </div>

    `;

}

        /* =====================================================
           CRÉATION DES STATIONS
           ===================================================== */

        data.results.forEach(
            station => {


                /* =============================================
                   MARQUEUR
                   ============================================= */

                const marker =
                    L.marker(

                        [
                            station.geom.lat,
                            station.geom.lon
                        ],

                        {
                            icon:
                                iconsSIG.carburant
                        }

                    );


                /* =============================================
                   INFORMATIONS GÉNÉRALES
                   ============================================= */

                const ville =
                    station.ville ||
                    "Station-service";


                const adresse =
                    station.adresse ||
                    "Adresse non renseignée";


                const codePostal =
                    station.cp ||
                    "";


                const commune =
                    station.ville ||
                    "";


                /* =============================================
                   HORAIRES
                   ============================================= */

                const horaires =
                    station.horaires ||
                    station.horaires_jour ||
                    "";


                const automate =
                    station.horaires_automate_24_24;


                /* =============================================
                   SERVICES
                   ============================================= */

                const services =
                    station.services_service ||
                    station.services ||
                    "";


                /* =============================================
                   RUPTURES
                   ============================================= */

                const ruptureTemporaire =
                    station.carburants_rupture_temporaire;


                const ruptureDefinitive =
                    station.carburants_rupture_definitive;


                /* =============================================
                   COORDONNÉES
                   ============================================= */

                const latitude =
                    station.geom.lat;


                const longitude =
                    station.geom.lon;


                const itineraire =
                    `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;


                /* =============================================
                   CLIC → FICHE
                   ============================================= */

                marker.on(
                    "click",
                    function () {

                        ouvrirFiche(`

                            <!-- =================================
                                 EN-TÊTE
                                 ================================= -->

                            <div class="info-header">

                                <div class="info-type">
                                    MOBILITÉ
                                </div>


                                <div class="info-title">
                                    Station-service
                                </div>


                                <div class="info-subtitle">
                                    ${ville}
                                </div>

                            </div>


                            <!-- =================================
                                 CORPS
                                 ================================= -->

                            <div class="info-body">


                                <!-- =================================
                                     LOCALISATION
                                     ================================= -->

                                <div class="info-section">

                                    <div class="info-section-title">
                                        Localisation
                                    </div>


                                    <div class="info-row">

                                        <span class="info-label">
                                            📍 Adresse
                                        </span>


                                        <span class="info-value">

                                            ${adresse}

                                        </span>

                                    </div>


                                    <div class="info-row">

                                        <span class="info-label">
                                            🏘️ Commune
                                        </span>


                                        <span class="info-value">
                                            ${commune}
                                        </span>

                                    </div>

                                </div>


                                <!-- =================================
                                     CARBURANTS
                                     ================================= -->

                                <div class="info-section">

                                    <div class="info-section-title">
                                        Prix des carburants
                                    </div>


                                    ${ligneCarburant(
                                        "Gazole",
                                        station.gazole_prix,
                                        ruptureTemporaire,
                                        ruptureDefinitive
                                    )}


                                    ${ligneCarburant(
                                        "E10",
                                        station.e10_prix,
                                        ruptureTemporaire,
                                        ruptureDefinitive
                                    )}


                                    ${ligneCarburant(
                                        "SP95",
                                        station.sp95_prix,
                                        ruptureTemporaire,
                                        ruptureDefinitive
                                    )}


                                    ${ligneCarburant(
                                        "SP98",
                                        station.sp98_prix,
                                        ruptureTemporaire,
                                        ruptureDefinitive
                                    )}


                                    ${ligneCarburant(
                                        "E85",
                                        station.e85_prix,
                                        ruptureTemporaire,
                                        ruptureDefinitive
                                    )}


                                    ${ligneCarburant(
                                        "GPLc",
                                        station.gplc_prix,
                                        ruptureTemporaire,
                                        ruptureDefinitive
                                    )}

                                </div>


                                <!-- =================================
                                     MISE À JOUR
                                     ================================= -->

                                <div class="carburant-update">

                                    <span
                                        class="
                                            carburant-update-label
                                        "
                                    >
                                        🔄 Dernière mise à jour
                                    </span>


                                    <strong>

                                        ${formaterDate(

                                            station.gazole_maj ||

                                            station.e10_maj ||

                                            station.sp95_maj ||

                                            station.sp98_maj

                                        )}

                                    </strong>

                                </div>


                                <!-- =================================
                                     HORAIRES
                                     ================================= -->

                                <div class="info-section">

                                    <div class="info-section-title">
                                        Horaires
                                    </div>


                                    ${formaterHoraires(
                                        horaires
                                    )}


                                    ${
                                        String(
                                            automate
                                        )
                                        .toLowerCase()
                                        .includes(
                                            "oui"
                                        )
                                            ? `

                                                <div
                                                    class="
                                                        carburant-automate
                                                    "
                                                >
                                                    🤖 Automate disponible
                                                    24h/24
                                                </div>

                                              `
                                            : ""
                                    }

                                </div>


                                <!-- =================================
                                     SERVICES
                                     ================================= -->

                                ${
                                    services
                                        ? `

                                            <div
                                                class="
                                                    info-section
                                                "
                                            >

                                                <div
                                                    class="
                                                        info-section-title
                                                    "
                                                >
                                                    Services
                                                </div>


                                                <div
                                                    class="
                                                        info-description
                                                    "
                                                >
                                                    ${nettoyerListe(
                                                        services
                                                    )}
                                                </div>

                                            </div>

                                          `
                                        : ""
                                }


                                <!-- =================================
                                     RUPTURES
                                     ================================= -->

                                ${
                                    (
                                        ruptureTemporaire ||
                                        ruptureDefinitive
                                    )
                                        ? `

                                            <div
                                                class="
                                                    carburant-alert
                                                "
                                            >

                                                <div
                                                    class="
                                                        carburant-alert-title
                                                    "
                                                >
                                                    ⚠️ Disponibilité
                                                </div>


                                                ${
                                                    ruptureTemporaire
                                                        ? `

                                                            <div>

                                                                🟠
                                                                Rupture temporaire :

                                                                ${nettoyerListe(
                                                                    ruptureTemporaire
                                                                )}

                                                            </div>

                                                          `
                                                        : ""
                                                }


                                                ${
                                                    ruptureDefinitive
                                                        ? `

                                                            <div>

                                                                🔴
                                                                Rupture définitive :

                                                                ${nettoyerListe(
                                                                    ruptureDefinitive
                                                                )}

                                                            </div>

                                                          `
                                                        : ""
                                                }

                                            </div>

                                          `
                                        : ""
                                }


                                <!-- =================================
                                     ITINÉRAIRE
                                     ================================= -->

                                <div
                                    class="
                                        carburant-action
                                    "
                                >

                                    <a
                                        href="${itineraire}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="
                                            carburant-itineraire
                                        "
                                    >

                                        🧭
                                        Itinéraire vers cette station

                                    </a>

                                </div>


                            </div>

                        `);

                    }
                );


                marker.addTo(
                    carburant
                );

            }
        );

    })

    .catch(error => {

        console.error(
            "Erreur lors du chargement des carburants :",
            error
        );

    });


/* =========================================================
   ARRÊTS ALEOP
   ========================================================= */


/* ---------------------------------------------------------
   Chargement du GeoJSON
   --------------------------------------------------------- */

fetch(
    'couches/mobilite/arretsALEOP.geojson'
)

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `Erreur HTTP arrêts ALEOP : ${response.status}`
            );

        }

        return response.json();

    })

    .then(data => {

        L.geoJSON(
            data,
            {

                style: {

                    color: "#008000",

                    weight: 3

                },


                pointToLayer:
                    function (
                        feature,
                        latlng
                    ) {

                        return L.marker(
                            latlng,
                            {
                                icon:
                                    iconsSIG.transport
                            }
                        );

                    },


                onEachFeature: function (
    feature,
    layer
) {

    const p =
        feature.properties;


    /* =============================================
       INFORMATIONS
       ============================================= */

    const nom =
        p.name ||
        "Arrêt ALEOP";


    const code =
        p.code ||
        "Non renseigné";


    const identifiant =
        p.id ||
        "";


    const parentStation =
        p.parent_station ||
        "";


    /* =============================================
       ACCESSIBILITÉ PMR
       ============================================= */

    const accessibilite =
        p.wheelchair_boarding ||
        "unknown";


    let texteAccessibilite =
        "Non renseignée";


    let classeAccessibilite =
        "aleop-badge-neutral";


    if (
        accessibilite === "available"
    ) {

        texteAccessibilite =
            "Accessible PMR";

        classeAccessibilite =
            "aleop-badge-success";

    }


    else if (
        accessibilite === "not available"
    ) {

        texteAccessibilite =
            "Non accessible PMR";

        classeAccessibilite =
            "aleop-badge-warning";

    }


    else if (
        accessibilite === "unknown"
    ) {

        texteAccessibilite =
            "Accessibilité inconnue";

    }


    /* =============================================
       COORDONNÉES
       ============================================= */

    const longitude =
        feature.geometry.coordinates[0];


    const latitude =
        feature.geometry.coordinates[1];


    const itineraire =
        `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;


    /* =============================================
       FICHE
       ============================================= */

    layer.on(
        "click",
        function () {

            ouvrirFiche(`

                <!-- =================================
                     EN-TÊTE
                     ================================= -->

                <div class="info-header">

                    <div class="info-type">
                        MOBILITÉ
                    </div>


                    <div class="info-title">
                        ${nom}
                    </div>


                    <div class="info-subtitle">
                        Arrêt de bus ALEOP
                    </div>


                    <div class="aleop-badge ${classeAccessibilite}">
                        ${
                            accessibilite === "available"
                                ? "♿"
                                : "●"
                        }
                        ${texteAccessibilite}
                    </div>

                </div>


                <div class="info-body">


                    <!-- =================================
                         ARRÊT
                         ================================= -->

                    <div class="info-section">

                        <div class="info-section-title">
                            Informations sur l'arrêt
                        </div>


                        ${
                            code !== "Non renseigné"
                                ? `

                                    <div class="info-row">

                                        <span class="info-label">
                                            🚌 Code
                                        </span>

                                        <span class="info-value">
                                            ${code}
                                        </span>

                                    </div>

                                  `
                                : ""
                        }


                        ${
                            parentStation
                                ? `

                                    <div class="info-row">

                                        <span class="info-label">
                                            📍 Arrêt
                                        </span>

                                        <span class="info-value">
                                            ${parentStation}
                                        </span>

                                    </div>

                                  `
                                : ""
                        }

                    </div>


                    <!-- =================================
                         ACCESSIBILITÉ
                         ================================= -->

                    <div class="info-section">

                        <div class="info-section-title">
                            Accessibilité
                        </div>


                        <div class="info-row">

                            <span class="info-label">
                                ♿ Accès PMR
                            </span>

                            <span class="info-value">
                                ${texteAccessibilite}
                            </span>

                        </div>

                    </div>


                    <!-- =================================
                         BON À SAVOIR
                         ================================= -->
<div class="aleop-info">

    <div class="aleop-info-title">
        🚌 Réseau Aléop
    </div>

    <div class="aleop-info-text">
        Consultez les horaires, itinéraires
        et informations du réseau Aléop.
    </div>

    <a
        href="https://aleop.paysdelaloire.fr/"
        target="_blank"
        rel="noopener noreferrer"
        class="aleop-info-link"
    >
        Voir les informations sur Aléop
        ↗
    </a>

</div>


                    <!-- =================================
                         ITINÉRAIRE
                         ================================= -->

                    <div class="aleop-action">

                        <a
                            href="${itineraire}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="aleop-itineraire"
                        >
                            🧭
                            Itinéraire vers cet arrêt
                        </a>

                    </div>


                </div>

            `);

        }
    );

}}
        ).addTo(
            arrets
        );


        /*
         * Les arrêts ALEOP étaient affichés
         * par défaut dans ton fichier original.
         */

        arrets.addTo(
            map
        );

    })

    .catch(error => {

        console.error(
            "Erreur lors du chargement des arrêts ALEOP :",
            error
        );

    });


/* =========================================================
   LIGNES ALEOP
   ========================================================= */


/* ---------------------------------------------------------
   Chargement du réseau ALEOP
   --------------------------------------------------------- */

fetch(
    'couches/mobilite/reseauALEOP.geojson'
)

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `Erreur HTTP réseau ALEOP : ${response.status}`
            );

        }

        return response.json();

    })

    .then(data => {

        L.geoJSON(
            data,
            {

                style:
                    function(feature) {

                        return {

                            color:
                                feature.properties
                                    .route_color ||
                                "#3F8064",

                            weight: 4,

                            opacity: 0.85,

                            lineCap:
                                "round",

                            lineJoin:
                                "round"

                        };

                    },


                onEachFeature:
    function (feature, layer) {

        const p =
            feature.properties;


        /* =============================================
           INFORMATIONS DE LA LIGNE
           ============================================= */

        const numero =
            p.route_short_name ||
            p.route_id ||
            "Ligne ALEOP";


        const nom =
            p.route_long_name ||
            "Itinéraire non renseigné";


        const type =
            p.route_type ||
            "Bus";


        /* =============================================
           COULEUR DE LA LIGNE
           ============================================= */

        const couleur =
            p.route_color
                ? `#${p.route_color}`
                : "#3F8064";


        /* =============================================
           FICHE
           ============================================= */

        layer.on(
            "click",
            function () {

                ouvrirFiche(`

                    <!-- =================================
                         EN-TÊTE
                         ================================= -->

                    <div class="info-header">

                        <div class="info-type">
                            MOBILITÉ
                        </div>


                        <div class="info-title">
                            Ligne ${numero}
                        </div>


                        <div class="info-subtitle">
                            ${nom}
                        </div>


                        <div
                            class="aleop-line-color"
                            style="
                                background-color:
                                ${couleur};
                            "
                        ></div>

                    </div>


                    <div class="info-body">


                        <!-- =================================
                             INFORMATIONS
                             ================================= -->

                        <div class="info-section">

                            <div class="info-section-title">
                                Ligne
                            </div>


                            <div class="info-row">

                                <span class="info-label">
                                    🚌 Numéro
                                </span>

                                <span class="info-value">
                                    ${numero}
                                </span>

                            </div>


                            <div class="info-row">

                                <span class="info-label">
                                    🗺️ Itinéraire
                                </span>

                                <span class="info-value">
                                    ${nom}
                                </span>

                            </div>


                            <div class="info-row">

                                <span class="info-label">
                                    🚍 Type
                                </span>

                                <span class="info-value">
                                    ${type}
                                </span>

                            </div>

                        </div>


                        <!-- =================================
                             ALÉOP
                             ================================= -->

                        <div class="aleop-info">

                            <div class="aleop-info-title">
                                🚌 Réseau Aléop
                            </div>


                            <div class="aleop-info-text">

                                Consultez les horaires,
                                itinéraires et informations
                                du réseau Aléop.

                            </div>


                            <a
                                href="
                                    https://aleop.paysdelaloire.fr/
                                "
                                target="_blank"
                                rel="noopener noreferrer"
                                class="aleop-info-link"
                            >
                                Voir les informations sur Aléop ↗
                            </a>

                        </div>


                    </div>

                `);

            }
        );


        /* =============================================
           SURVOL DE LA LIGNE
           ============================================= */

        layer.on(
            "mouseover",
            function () {

                layer.setStyle({

                    weight: 7,

                    opacity: 1

                });

            }
        );


        layer.on(
            "mouseout",
            function () {

                layer.setStyle({

                    weight: 4,

                    opacity: 0.85

                });

            }
        );

    }
}
        ).addTo(
            trajets
        );


        /*
         * Les lignes ALEOP étaient affichées
         * par défaut dans ton fichier original.
         */

        trajets.addTo(
            map
        );

    })

    .catch(error => {

        console.error(
            "Erreur lors du chargement du réseau ALEOP :",
            error
        );

    });