/* =========================================================
   DÉFIBRILLATEURS — DAE
   ========================================================= */

let dae = L.layerGroup();


/* =========================================================
   ICÔNE
   ========================================================= */

const daeIcon = L.icon({
    iconUrl: 'img/dae.png',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});


/* =========================================================
   OUTILS
   ========================================================= */

function valeurDAE(valeur, defaut = "Non renseigné") {

    if (
        valeur === null ||
        valeur === undefined ||
        valeur === "" ||
        valeur === "null"
    ) {
        return defaut;
    }

    return String(valeur)
        .replace(/[{}"]/g, "")
        .trim() || defaut;
}


function texteDAE(valeur) {

    if (
        valeur === null ||
        valeur === undefined ||
        valeur === "" ||
        valeur === "null"
    ) {
        return "";
    }

    return String(valeur)
        .replace(/[{}"]/g, "")
        .replace(/\r?\n/g, "<br>")
        .trim();
}


function dateDAE(valeur) {

    if (
        !valeur ||
        valeur === "0001-01-01" ||
        valeur === "2000-01-01"
    ) {
        return "Non renseignée";
    }

    const date = new Date(valeur);

    if (isNaN(date)) {
        return "Non renseignée";
    }

    return date.toLocaleDateString("fr-FR");
}


/* =========================================================
   CHARGEMENT DES DAE
   ========================================================= */

fetch("couches/securite/dae.geojson")

    .then(response => {

        if (!response.ok) {
            throw new Error(
                `Erreur HTTP ${response.status}`
            );
        }

        return response.json();

    })

    .then(data => {

        L.geoJSON(data, {

            /* -------------------------------------------------
               SYMBOLE
               ------------------------------------------------- */

            pointToLayer: function (
                feature,
                latlng
            ) {

                return L.marker(
                    latlng,
                    {
                        icon: daeIcon
                    }
                );

            },


            /* -------------------------------------------------
               FICHE
               ------------------------------------------------- */

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
                    valeurDAE(
                        p.c_nom,
                        "Défibrillateur"
                    );


                const adresse =
                    [
                        p.c_adr_num,
                        p.c_adr_voie
                    ]
                    .filter(Boolean)
                    .join(" ");


                const commune =
                    valeurDAE(
                        p.c_com_nom
                    );


                const acces =
                    valeurDAE(
                        p.c_acc
                    );


                const etage =
                    texteDAE(
                        p.c_acc_etg
                    );


                const accesComplement =
                    texteDAE(
                        p.c_acc_complt
                    );


                const jours =
                    texteDAE(
                        p.c_disp_j
                    );


                const horaires =
                    texteDAE(
                        p.c_disp_h
                    );


                const disponibilite =
                    texteDAE(
                        p.c_disp_complt
                    );


                const etatFonctionnement =
                    valeurDAE(
                        p.c_etat_fonct
                    );


                const etat =
                    valeurDAE(
                        p.c_etat
                    );


                const dateInstallation =
                    dateDAE(
                        p.c_date_instal
                    );


                const derniereMaintenance =
                    dateDAE(
                        p.c_dermnt
                    );


                const frequenceMaintenance =
                    valeurDAE(
                        p.c_freq_mnt
                    );


                const exploitant =
                    valeurDAE(
                        p.c_expt_rais
                    );


                const dateMiseAJour =
                    dateDAE(
                        p.c_maj_don
                    );


                /* =============================================
                   PHOTO
                   ============================================= */

                const photo =
                    p.cc_photo1 ||
                    null;


                /* =============================================
                   COORDONNÉES
                   ============================================= */

                const coordinates =
                    feature.geometry.coordinates;

                const longitude =
                    coordinates[0];

                const latitude =
                    coordinates[1];


                const itineraire =
                    `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;


                /* =============================================
                   BADGE ÉTAT
                   ============================================= */

                let classeEtat =
                    "dae-badge-neutral";


                if (
                    etatFonctionnement
                        .toLowerCase()
                        .includes("fonctionnement")
                ) {

                    classeEtat =
                        "dae-badge-success";

                }


                /* =============================================
                   BADGE ACCESSIBILITÉ
                   ============================================= */

                let badgeAcces =
                    acces;


                if (
                    jours.includes("7j/7") &&
                    horaires.includes("24h/24")
                ) {

                    badgeAcces =
                        "Accessible 24h/24 · 7j/7";

                }


                /* =============================================
                   CONSTRUCTION DE LA FICHE
                   ============================================= */

                layer.on(
                    "click",
                    function () {

                        ouvrirFiche(`

                            <div class="info-header">


                                ${
                                    photo
                                        ? `
                                            <div class="dae-photo">

                                                <img
                                                    src="${photo}"
                                                    alt="Photo du défibrillateur"
                                                >

                                            </div>
                                          `
                                        : ""
                                }


                                <div class="info-type">
                                    SÉCURITÉ
                                </div>


                                <div class="info-title">
                                    ${nom}
                                </div>


                                <div class="info-subtitle">
                                    Défibrillateur automatisé externe
                                </div>


                                <div class="dae-badges">

                                    <span
                                        class="dae-badge ${classeEtat}"
                                    >
                                        ● ${etatFonctionnement}
                                    </span>


                                    <span
                                        class="dae-badge dae-badge-access"
                                    >
                                        🕐 ${badgeAcces}
                                    </span>

                                </div>


                            </div>


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
                                            ${
                                                adresse ||
                                                "Non renseignée"
                                            }
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


                                    ${
                                        etage
                                            ? `
                                                <div class="info-row">

                                                    <span class="info-label">
                                                        Étage
                                                    </span>

                                                    <span class="info-value">
                                                        ${etage}
                                                    </span>

                                                </div>
                                              `
                                            : ""
                                    }

                                </div>


                                <!-- =================================
                                     ACCÈS
                                     ================================= -->

                                <div class="info-section">

                                    <div class="info-section-title">
                                        Accès
                                    </div>


                                    <div class="info-row">

                                        <span class="info-label">
                                            🚪 Type d'accès
                                        </span>

                                        <span class="info-value">
                                            ${acces}
                                        </span>

                                    </div>


                                    ${
                                        accesComplement
                                            ? `
                                                <div class="info-description">
                                                    ${accesComplement}
                                                </div>
                                              `
                                            : ""
                                    }

                                </div>


                                <!-- =================================
                                     DISPONIBILITÉ
                                     ================================= -->

                                <div class="info-section">

                                    <div class="info-section-title">
                                        Disponibilité
                                    </div>


                                    ${
                                        jours
                                            ? `
                                                <div class="info-row">

                                                    <span class="info-label">
                                                        📅 Jours
                                                    </span>

                                                    <span class="info-value">
                                                        ${jours}
                                                    </span>

                                                </div>
                                              `
                                            : ""
                                    }


                                    ${
                                        horaires
                                            ? `
                                                <div class="info-row">

                                                    <span class="info-label">
                                                        🕐 Horaires
                                                    </span>

                                                    <span class="info-value">
                                                        ${horaires}
                                                    </span>

                                                </div>
                                              `
                                            : ""
                                    }


                                    ${
                                        disponibilite
                                            ? `
                                                <div class="info-description">
                                                    ${disponibilite}
                                                </div>
                                              `
                                            : ""
                                    }

                                </div>


                                <!-- =================================
                                     MAINTENANCE
                                     ================================= -->

                                ${
                                    (
                                        derniereMaintenance !==
                                            "Non renseignée" ||
                                        frequenceMaintenance !==
                                            "Non renseigné"
                                    )
                                        ? `

                                            <div class="info-section">

                                                <div class="info-section-title">
                                                    Maintenance
                                                </div>


                                                ${
                                                    derniereMaintenance !==
                                                        "Non renseignée"
                                                        ? `
                                                            <div class="info-row">

                                                                <span class="info-label">
                                                                    🔧 Dernière maintenance
                                                                </span>

                                                                <span class="info-value">
                                                                    ${derniereMaintenance}
                                                                </span>

                                                            </div>
                                                          `
                                                        : ""
                                                }


                                                ${
                                                    frequenceMaintenance !==
                                                        "Non renseigné"
                                                        ? `
                                                            <div class="info-row">

                                                                <span class="info-label">
                                                                    🔄 Fréquence
                                                                </span>

                                                                <span class="info-value">
                                                                    ${frequenceMaintenance}
                                                                </span>

                                                            </div>
                                                          `
                                                        : ""
                                                }

                                            </div>

                                          `
                                        : ""
                                }


                                <!-- =================================
                                     GESTIONNAIRE
                                     ================================= -->

                                <div class="info-section">

                                    <div class="info-section-title">
                                        Gestionnaire
                                    </div>


                                    <div class="info-row">

                                        <span class="info-label">
                                            🏢 Exploitant
                                        </span>

                                        <span class="info-value">
                                            ${exploitant}
                                        </span>

                                    </div>


                                    ${
                                        etat !== "Non renseigné"
                                            ? `
                                                <div class="info-row">

                                                    <span class="info-label">
                                                        État
                                                    </span>

                                                    <span class="info-value">
                                                        ${etat}
                                                    </span>

                                                </div>
                                              `
                                            : ""
                                    }

                                </div>


                                <!-- =================================
                                     INSTALLATION
                                     ================================= -->

                                <div class="info-section">

                                    <div class="info-section-title">
                                        Informations
                                    </div>


                                    ${
                                        dateInstallation !==
                                            "Non renseignée"
                                            ? `
                                                <div class="info-row">

                                                    <span class="info-label">
                                                        📅 Installation
                                                    </span>

                                                    <span class="info-value">
                                                        ${dateInstallation}
                                                    </span>

                                                </div>
                                              `
                                            : ""
                                    }


                                    ${
                                        dateMiseAJour !==
                                            "Non renseignée"
                                            ? `
                                                <div class="info-row">

                                                    <span class="info-label">
                                                        🔄 Données mises à jour
                                                    </span>

                                                    <span class="info-value">
                                                        ${dateMiseAJour}
                                                    </span>

                                                </div>
                                              `
                                            : ""
                                    }

                                </div>
                                <!-- =================================
                                    ARRÊT CARDIAQUE
                                    ================================= -->

                                <div class="dae-emergency">

                                    <div class="dae-emergency-title">
                                        🚨 En cas d'arrêt cardiaque
                                    </div>

                                    <div class="dae-emergency-content">

                                        <div class="dae-emergency-step">
                                            <span>📞</span>
                                            <span>
                                                Appelez immédiatement les secours.
                                            </span>
                                        </div>

                                        <div class="dae-emergency-step">
                                            <span>❤️</span>
                                            <span>
                                                Commencez un massage cardiaque.
                                            </span>
                                        </div>

                                        <div class="dae-emergency-step">
                                            <span>⚡</span>
                                            <span>
                                                Demandez à quelqu'un d'aller chercher le DAE.
                                            </span>
                                        </div>

                                        <div class="dae-emergency-step">
                                            <span>🔊</span>
                                            <span>
                                                Allumez le DAE et suivez ses instructions vocales.
                                            </span>
                                        </div>

                                    </div>

                                </div>

                                <!-- =================================
                                     ITINÉRAIRE
                                     ================================= -->

                                <div class="dae-action">

                                    <a
                                        href="${itineraire}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="dae-itineraire"
                                    >
                                        🧭
                                        Itinéraire vers ce DAE
                                    </a>

                                </div>


                            </div>

                        `);

                    }
                );

            }

        }).addTo(dae);

    })

    .catch(error => {

        console.error(
            "Erreur lors du chargement des DAE :",
            error
        );

    });