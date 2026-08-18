/* =========================================================
   ENVIRONNEMENT
   ========================================================= */

let vigieau = L.layerGroup();
let debroussaillement = L.layerGroup();


/* =========================================================
   SÉCHERESSE — STYLE
   ========================================================= */

function styleVigieau(feature) {

    switch (feature.properties.niveauGravite) {

        case "crise":

            return {
                color: "#c0392b",
                fillColor: "#e74c3c",
                weight: 2,
                fillOpacity: 0.4
            };


        case "alerte_renforcee":

            return {
                color: "#d35400",
                fillColor: "#e67e22",
                weight: 2,
                fillOpacity: 0.4
            };


        case "alerte":

            return {
                color: "#f39c12",
                fillColor: "#f1c40f",
                weight: 2,
                fillOpacity: 0.4
            };


        case "vigilance":

            return {
                color: "#27ae60",
                fillColor: "#2ecc71",
                weight: 2,
                fillOpacity: 0.3
            };


        default:

            return {
                color: "#7f8c8d",
                fillColor: "#95a5a6",
                weight: 1,
                fillOpacity: 0.2
            };

    }

}


/* =========================================================
   NOM DU NIVEAU
   ========================================================= */

function nomNiveau(niveau) {

    switch (niveau) {

        case "crise":
            return "Crise";

        case "alerte_renforcee":
            return "Alerte renforcée";

        case "alerte":
            return "Alerte";

        case "vigilance":
            return "Vigilance";

        default:
            return niveau || "Non renseigné";

    }

}


/* =========================================================
   CLASSE DU NIVEAU
   ========================================================= */

function classeNiveau(niveau) {

    return niveau || "inconnu";

}


/* =========================================================
   FORMAT DATE
   ========================================================= */

function formaterDateVigieau(date) {

    if (!date) {

        return "Non renseignée";

    }


    const d =
        new Date(date);


    if (isNaN(d.getTime())) {

        return "Non renseignée";

    }


    return d.toLocaleDateString(
        "fr-FR"
    );

}


/* =========================================================
   FORMAT TYPE D'EAU
   ========================================================= */

function nomTypeEau(type) {

    switch (type) {

        case "SUP":
            return "Eau superficielle";

        case "SOU":
            return "Eau souterraine";

        case "AEP":
            return "Eau potable";

        default:
            return type || "Type d'eau non renseigné";

    }

}


/* =========================================================
   ICÔNE TYPE D'EAU
   ========================================================= */

function iconeTypeEau(type) {

    switch (type) {

        case "SUP":
            return "🌊";

        case "SOU":
            return "💧";

        case "AEP":
            return "🚰";

        default:
            return "💧";

    }

}


/* =========================================================
   RÉCUPÉRATION DES RESTRICTIONS VIGIEAU
   ========================================================= */

async function recupererRestrictionsVigieau(
    latitude,
    longitude
) {

    const typesEau = [
        "SUP",
        "SOU",
        "AEP"
    ];


    const resultats =
        await Promise.all(

            typesEau.map(
                async typeEau => {

                    const url =
                        "https://api.vigieau.gouv.fr/api/zones" +

                        `?lon=${encodeURIComponent(longitude)}` +

                        `&lat=${encodeURIComponent(latitude)}` +

                        "&profil=particulier" +

                        `&zoneType=${typeEau}`;


                    try {

                        const response =
                            await fetch(url);


                        if (!response.ok) {

                            console.warn(
                                "VigiEau API :",
                                typeEau,
                                response.status
                            );

                            return null;

                        }


                        const data =
                            await response.json();


                        /*
                         * L'API renvoie normalement
                         * un objet zone.
                         */

                        if (
                            Array.isArray(data)
                        ) {

                            return data.length
                                ? data[0]
                                : null;

                        }


                        return data;

                    }

                    catch (error) {

                        console.warn(
                            "Erreur API VigiEau :",
                            typeEau,
                            error
                        );


                        return null;

                    }

                }
            )

        );


    return resultats.filter(
        resultat => resultat
    );

}


/* =========================================================
   RESTRICTIONS POUR LES PARTICULIERS
   ========================================================= */

function construireRestrictionsVigieau(zones) {

    if (
        !zones ||
        !zones.length
    ) {

        return `
            <div class="vigieau-no-data">
                Les restrictions détaillées
                ne sont pas disponibles.
            </div>
        `;

    }


    let totalUsages = 0;


    const blocs =
        zones.map(
            zone => {

                const usages =
                    Array.isArray(zone.usages)

                        ? zone.usages.filter(
                            usage =>
                                usage.concerneParticulier === true
                        )

                        : [];


                if (!usages.length) {

                    return "";

                }


                totalUsages +=
                    usages.length;


                const niveau =
                    zone.niveauGravite ||
                    "inconnu";


                return `

                    <div
                        class="
                            vigieau-eau
                            niveau-${niveau}
                        "
                    >

                        <div class="vigieau-eau-title">

                            <span>
                                ${iconeTypeEau(zone.type)}
                            </span>

                            <div>

                                <strong>
                                    ${nomTypeEau(zone.type)}
                                </strong>

                                <span
                                    class="
                                        vigieau-eau-niveau
                                        niveau-${niveau}
                                    "
                                >
                                    ${nomNiveau(niveau)}
                                </span>

                            </div>

                        </div>


                        <div class="vigieau-usages">

                            ${usages.map(
                                (usage, index) => {

                                    const id =
                                        `vigieau-usage-${Date.now()}-${index}-${Math.random()
                                            .toString(36)
                                            .substring(2, 7)}`;


                                    return `

                                        <div
                                            class="
                                                vigieau-usage
                                            "
                                        >

                                            <button
                                                type="button"
                                                class="
                                                    vigieau-usage-button
                                                "
                                                onclick="
                                                    document
                                                        .getElementById('${id}')
                                                        .classList
                                                        .toggle('open')
                                                "
                                            >

                                                <span>
                                                    ${
                                                        usage.nom ||
                                                        "Usage"
                                                    }
                                                </span>

                                                <span
                                                    class="
                                                        vigieau-usage-chevron
                                                    "
                                                >
                                                    ▾
                                                </span>

                                            </button>


                                            <div
                                                id="${id}"
                                                class="
                                                    vigieau-usage-description
                                                "
                                            >

                                                ${
                                                    usage.description
                                                        ? String(
                                                            usage.description
                                                        ).replace(
                                                            /\r?\n/g,
                                                            "<br>"
                                                        )
                                                        : "Aucune précision."
                                                }

                                            </div>

                                        </div>

                                    `;

                                }
                            ).join("")}

                        </div>

                    </div>

                `;

            }
        )
        .join("");


    if (!totalUsages) {

        return `
            <div class="vigieau-no-data">
                Aucune restriction spécifique
                pour les particuliers n'est renseignée
                pour cette zone.
            </div>
        `;

    }


    return blocs;

}


/* =========================================================
   FICHE VIGIEAU
   ========================================================= */

async function ouvrirFicheVigieau(
    feature,
    layer
) {

    const p =
        feature.properties;


    const arrete =
        p.arreteRestriction || {};


    /* =====================================================
       INFORMATIONS DU GEOJSON
       ===================================================== */

    const nom =
        p.nom ||
        "Zone de restriction";


    const niveau =
        nomNiveau(
            p.niveauGravite
        );


    const departement =
        p.departement &&
        p.departement.nom

            ? p.departement.nom

            : "Sarthe";


    const dateDebut =
        arrete.dateDebut

            ? formaterDateVigieau(
                arrete.dateDebut
            )

            : "Non renseignée";


    const dateFin =
        arrete.dateFin

            ? formaterDateVigieau(
                arrete.dateFin
            )

            : "Non renseignée";


    const dateSignature =
        arrete.dateSignature

            ? formaterDateVigieau(
                arrete.dateSignature
            )

            : "Non renseignée";


    const numero =
        arrete.numero ||
        "Non renseigné";


    const lienArrete =
        arrete.fichier

            ? `

                <a
                    href="${arrete.fichier}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="vigieau-arrete-link"
                >
                    📄 Consulter l'arrêté
                    ↗
                </a>

              `

            : "";


    /* =====================================================
       CENTRE DE LA ZONE
       ===================================================== */

    let centre;


    try {

        centre =
            layer.getBounds().getCenter();

    }

    catch (error) {

        console.warn(
            "Impossible de déterminer le centre de la zone Vigieau.",
            error
        );

    }


    /* =====================================================
       FICHE DE CHARGEMENT
       ===================================================== */

    ouvrirFiche(`

        <div class="info-header">

            <div class="info-type">
                ENVIRONNEMENT
            </div>


            <div class="info-title">
                ${nom}
            </div>

            <div
                class="
                    vigieau-level
                    niveau-${classeNiveau(
                        p.niveauGravite
                    )}
                "
            >
                💧 ${niveau}
            </div>

        </div>


        <div class="info-body">

            <div class="vigieau-loading">

                <div class="vigieau-loading-icon">
                    💧
                </div>

                <div>
                    Recherche des restrictions
                    applicables aux particuliers…
                </div>

            </div>

        </div>

    `);


    /* =====================================================
       APPEL API VIGIEAU
       ===================================================== */

    let zonesAPI = [];


    if (centre) {

        try {

            zonesAPI =
                await recupererRestrictionsVigieau(
                    centre.lat,
                    centre.lng
                );

        }

        catch (error) {

            console.error(
                "Erreur récupération restrictions VigiEau :",
                error
            );

        }

    }


    /* =====================================================
       RESTRICTIONS
       ===================================================== */

    const restrictions =
        construireRestrictionsVigieau(
            zonesAPI
        );


    /* =====================================================
       NIVEAUX PAR TYPE D'EAU
       ===================================================== */

    let niveauxEau = "";


    if (zonesAPI.length) {

        niveauxEau = `

            <div class="vigieau-eaux">

                ${zonesAPI.map(
                    zone => `

                        <div class="vigieau-eau-badge">

                            <span>
                                ${iconeTypeEau(
                                    zone.type
                                )}
                            </span>


                            <span>

                                <small>
                                    ${nomTypeEau(
                                        zone.type
                                    )}
                                </small>


                                <strong
                                    class="
                                        niveau-${classeNiveau(
                                            zone.niveauGravite
                                        )}
                                    "
                                >
                                    ${nomNiveau(
                                        zone.niveauGravite
                                    )}
                                </strong>

                            </span>

                        </div>

                    `
                ).join("")}

            </div>

        `;

    }


    /* =====================================================
       FICHE FINALE
       ===================================================== */

    ouvrirFiche(`

        <!-- =============================================
             EN-TÊTE
             ============================================= -->

        <div class="info-header">

            <div class="info-type">
                ENVIRONNEMENT
            </div>


            <div class="info-title">
                ${nom}
            </div>


            <div
                class="
                    vigieau-level
                    niveau-${classeNiveau(
                        p.niveauGravite
                    )}
                "
            >
                💧 ${niveau}
            </div>

        </div>


        <div class="info-body">


            <!-- =========================================
                 SITUATION
                 ========================================= -->

            <div class="info-section">

                <div class="info-section-title">
                    Situation de l'eau
                </div>


                <div class="info-row">

                    <span class="info-label">
                        💧 Niveau
                    </span>


                    <span class="info-value">
                        ${niveau}
                    </span>

                </div>


                <div class="info-row">

                    <span class="info-label">
                        🏘️ Département
                    </span>


                    <span class="info-value">
                        ${departement}
                    </span>

                </div>


                ${
                    niveauxEau
                }

            </div>


            <!-- =========================================
                 PÉRIODE
                 ========================================= -->

            <div class="info-section">

                <div class="info-section-title">
                    Période de l'arrêté
                </div>


                <div class="info-row">

                    <span class="info-label">
                        📅 Début
                    </span>


                    <span class="info-value">
                        ${dateDebut}
                    </span>

                </div>


                <div class="info-row">

                    <span class="info-label">
                        📅 Fin
                    </span>


                    <span class="info-value">
                        ${dateFin}
                    </span>

                </div>

            </div>


            <!-- =========================================
                 RESTRICTIONS
                 ========================================= -->

            <div class="info-section">

                <div class="info-section-title">

                    🚿 Restrictions
                    pour les particuliers

                </div>


                <div class="vigieau-restrictions">

                    ${restrictions}

                </div>

            </div>


            <!-- =========================================
                 ARRÊTÉ
                 ========================================= -->

            <div class="info-section">

                <div class="info-section-title">
                    Arrêté
                </div>


                <div class="info-row">

                    <span class="info-label">
                        📄 Référence
                    </span>


                    <span class="info-value">
                        ${numero}
                    </span>

                </div>


                <div class="info-row">

                    <span class="info-label">
                        ✍️ Signé le
                    </span>


                    <span class="info-value">
                        ${dateSignature}
                    </span>

                </div>

            </div>


            <!-- =========================================
                 SOURCE
                 ========================================= -->

            <div class="vigieau-info">

                <div class="vigieau-info-title">
                    💧 Informations officielles
                </div>


                <div class="vigieau-info-text">

                    Les restrictions peuvent varier selon
                    le type d'eau utilisé et sont définies
                    par les arrêtés préfectoraux.

                </div>


                ${lienArrete}


                <a
                    href="https://vigieau.gouv.fr/"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="vigieau-info-link"
                >
                    Consulter VigiEau
                    ↗
                </a>

            </div>


        </div>

    `);

}


/* =========================================================
   CHARGEMENT VIGIEAU
   ========================================================= */

fetch(
    "https://regleau.s3.gra.perf.cloud.ovh.net/geojson/zones_arretes_en_vigueur.geojson"
)

.then(response => {

    console.log(
        "Vigieau HTTP :",
        response.status,
        response.ok
    );


    if (!response.ok) {

        throw new Error(
            `HTTP ${response.status}`
        );

    }


    return response.json();

})


.then(data => {

    console.log(
        "Vigieau total :",
        data.features.length
    );


    /* =====================================================
       FILTRE SARTHE
       ===================================================== */

    const zones72 =
        data.features.filter(
            feature => {

                return (

                    feature.properties &&

                    feature.properties.departement &&

                    String(
                        feature.properties.departement.code
                    ) === "72"

                );

            }
        );


    console.log(
        "Vigieau 72 :",
        zones72.length
    );


    /* =====================================================
       CRÉATION DE LA COUCHE
       ===================================================== */

    L.geoJSON(

        {
            type: "FeatureCollection",
            features: zones72
        },

        {

            style:
                styleVigieau,


            onEachFeature:
                function(
                    feature,
                    layer
                ) {

                    layer.on(
                        "click",
                        function() {

                            ouvrirFicheVigieau(
                                feature,
                                layer
                            );

                        }
                    );

                }

        }

    ).addTo(
        vigieau
    );


    console.log(
        "Vigieau couche :",
        vigieau.getLayers().length
    );

})


.catch(error => {

    console.error(
        "Erreur Vigieau :",
        error
    );

});


/* =========================================================
   DÉBROUSSAILLEMENT
   ========================================================= */

fetch(
    "https://data.geopf.fr/wfs/ows?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=DEBROUSSAILLEMENT%3Adebroussaillement&OUTPUTFORMAT=application%2Fjson&SRSNAME=EPSG%3A4326&CQL_FILTER=dept%3D%27072%27"
)

.then(response => {

    if (!response.ok) {

        throw new Error(
            `HTTP ${response.status}`
        );

    }


    return response.json();

})


.then(data => {

    L.geoJSON(

        data,

        {

            style: {

                color: "#27ae60",

                weight: 2,

                fillOpacity: 0.15

            }

        }

    ).addTo(
        debroussaillement
    );


    console.log(
        "Débroussaillement :",
        debroussaillement.getLayers().length
    );

})


.catch(error => {

    console.error(
        "Erreur débroussaillement :",
        error
    );

});