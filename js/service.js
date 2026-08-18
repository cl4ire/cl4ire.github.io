/* =========================================================
   SERVICES
   ========================================================= */


/* =========================================================
   GROUPES DE COUCHES
   ========================================================= */

let bal = L.layerGroup();
let mairies = L.layerGroup();



/* =========================================================
   COUCHE — BOÎTES AUX LETTRES
   ========================================================= */

fetch('couches/services/bal.geojson')

    .then(response => response.json())

    .then(data => {

        L.geoJSON(data, {

            pointToLayer: function (feature, latlng) {

                return L.marker(latlng, {
                    icon: iconsSIG.bal
                });

            },


onEachFeature: function (feature, layer) {

    const p = feature.properties;


    /* =====================================================
       ADRESSE
       ===================================================== */

    const numero =
        p.VA_NO_VOIE &&
        p.VA_NO_VOIE !== "NULL"
            ? p.VA_NO_VOIE
            : "";


    const voie =
        p.LB_VOIE_EXT || "";


    const adresse =
        [numero, voie]
            .filter(Boolean)
            .join(" ");


    const commune =
        p.LB_COM || "Commune non renseignée";


    const codePostal =
        p.CO_POSTAL || "";


    /* =====================================================
       HEURES DE LEVÉE
       ===================================================== */

    function formaterHeure(
        valeur
    ) {

        if (!valeur) {
            return "Non renseignée";
        }

        /*
         * Exemple :
         * T15:00:00+00:00
         */

        const match =
            valeur.match(
                /T(\d{2}):(\d{2})/
            );

        if (!match) {
            return "Non renseignée";
        }

        return `${match[1]}h${match[2]}`;

    }


    const semaine =
        formaterHeure(
            p.HDL_SEMAINE_EXTRA
        );


    const samedi =
        formaterHeure(
            p.HDL_SAMEDI_EXTRA
        );


    /* =====================================================
       COORDONNÉES
       ===================================================== */

    const longitude =
        feature.geometry.coordinates[0];


    const latitude =
        feature.geometry.coordinates[1];


    const itineraire =
        `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;


    /* =====================================================
       FICHE
       ===================================================== */

    layer.on(
        "click",
        function () {

            ouvrirFiche(`

                <div class="info-header">

                    <div class="info-type">
                        SERVICES
                    </div>


                    <div class="info-title">
                        Boîte aux lettres
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

                                ${adresse || "Non renseignée"}
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
                         LEVÉE DU COURRIER
                         ================================= -->

                    <div class="info-section">

                        <div class="info-section-title">
                            Dernière levée du courrier
                        </div>


                        <div class="info-row">

                            <span class="info-label">
                                📅 Du lundi au vendredi
                            </span>

                            <span class="info-value">
                                ${semaine}
                            </span>

                        </div>


                        <div class="info-row">

                            <span class="info-label">
                                📅 Samedi
                            </span>

                            <span class="info-value">
                                ${samedi}
                            </span>

                        </div>

                    </div>


                    <!-- =================================
                         BON À SAVOIR
                         ================================= -->

                    <div class="bal-info">

                        <div class="bal-info-title">
                            💡 Bon à savoir
                        </div>

                        <div class="bal-info-text">
                            L'heure indiquée correspond à la
                            dernière levée du courrier dans
                            cette boîte aux lettres.
                        </div>

                    </div>


                    <!-- =================================
                         ITINÉRAIRE
                         ================================= -->

                    <div class="bal-action">

                        <a
                            href="${itineraire}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="bal-itineraire"
                        >
                            🧭
                            Itinéraire vers cette boîte
                        </a>

                    </div>


                </div>

            `);

        }
    );

}

        }).addTo(bal);

    })

    .catch(error => {

        console.error(
            'Erreur lors du chargement des boîtes aux lettres :',
            error
        );

    });

/* =========================================================
   COUCHE — MAIRIES
   ========================================================= */

function escapeHtmlMairie(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   HORAIRES
   ========================================================= */

function formaterHorairesMairie(horaires) {

    if (!horaires) {

        return `
            <div class="mairie-no-data">
                Horaires non renseignés
            </div>
        `;

    }


    const lignes =
        String(horaires)
            .split(/\r?\n/)
            .map(
                ligne =>
                    ligne.trim()
            )
            .filter(
                ligne =>
                    ligne
            );


    if (!lignes.length) {

        return `
            <div class="mairie-no-data">
                Horaires non renseignés
            </div>
        `;

    }


    return `

        <div class="mairie-horaires">

            ${lignes.map(
                ligne => {

                    let jour = "";
                    let heures = "";


                    /* =====================================
                       CAS 1
                       "Du Lundi au Mercredi : ..."
                       ===================================== */

                    let match =
                        ligne.match(
                            /^Du\s+(.+?)\s+au\s+(.+?)\s*:\s*(.+)$/i
                        );


                    if (match) {

                        jour =
                            `Du ${match[1]} au ${match[2]}`;

                        heures =
                            match[3];

                    }


                    /* =====================================
                       CAS 2
                       "Le Jeudi : ..."
                       ===================================== */

                    else {

                        match =
                            ligne.match(
                                /^Le\s+(.+?)\s*:\s*(.+)$/i
                            );


                        if (match) {

                            jour =
                                match[1];

                            heures =
                                match[2];

                        }

                    }


                    /* =====================================
                       CAS 3
                       "Jeudi : ..."
                       ===================================== */

                    if (!match) {

                        match =
                            ligne.match(
                                /^(.+?)\s*:\s*(.+)$/
                            );


                        if (match) {

                            jour =
                                match[1];

                            heures =
                                match[2];

                        }

                    }


                    /* =====================================
                       AUCUN FORMAT RECONNU
                       ===================================== */

                    if (!jour || !heures) {

                        return `

                            <div
                                class="
                                    mairie-horaire-ligne
                                    mairie-horaire-libre
                                "
                            >

                                ${escapeHtmlMairie(
                                    ligne
                                )}

                            </div>

                        `;

                    }


                    /* =====================================
                       NETTOYAGE DES HEURES
                       ===================================== */

                    heures =
                        heures
                            .replace(
                                /^de\s+/i,
                                ""
                            );


                    /*
                     * Harmonisation :
                     *
                     * "08h00 à 12h00"
                     * devient
                     * "08h00 – 12h00"
                     */

                    heures =
                        heures.replace(
                            /\s+à\s+/gi,
                            " – "
                        );


                    /*
                     * "de 13h30 à 17h30"
                     * après le premier remplacement
                     * devient correctement :
                     *
                     * "13h30 – 17h30"
                     */

                    heures =
                        heures.replace(
                            /\s+de\s+/gi,
                            "  ·  "
                        );


                    /*
                     * Nettoyage éventuel de doubles espaces.
                     */

                    heures =
                        heures.replace(
                            /\s{2,}/g,
                            " "
                        )
                        .trim();


                    return `

                        <div
                            class="
                                mairie-horaire-ligne
                            "
                        >

                            <span
                                class="
                                    mairie-horaire-jour
                                "
                            >

                                ${escapeHtmlMairie(
                                    jour
                                )}

                            </span>


                            <span
                                class="
                                    mairie-horaire-heures
                                "
                            >

                                ${escapeHtmlMairie(
                                    heures
                                )}

                            </span>

                        </div>

                    `;

                }
            ).join("")}

        </div>

    `;

}

/* =========================================================
   CONSEIL MUNICIPAL
   ========================================================= */

function formaterElusMairie(elus) {

    if (!elus) {

        return `

            <div class="mairie-no-data">
                Conseil municipal non renseigné
            </div>

        `;

    }


    const lignes =
        String(elus)
            .split(/\r?\n/)
            .map(
                ligne =>
                    ligne.trim()
            )
            .filter(
                ligne =>
                    ligne
            );


    if (!lignes.length) {

        return `

            <div class="mairie-no-data">
                Conseil municipal non renseigné
            </div>

        `;

    }


    return `

        <div class="mairie-elus">

            ${lignes.map(
                ligne => {

                    /*
                     * Les données sont du type :
                     *
                     * GRAU Vincent (Maire)
                     * MILLET Lynda (1er adjoint au Maire)
                     *
                     */

                    const match =
                        ligne.match(
                            /^(.*?)\s*\((.*?)\)\s*$/
                        );


                    if (!match) {

                        return `

                            <div
                                class="
                                    mairie-elu
                                "
                            >

                                <div
                                    class="
                                        mairie-elu-nom
                                    "
                                >
                                    ${escapeHtmlMairie(
                                        ligne
                                    )}
                                </div>

                            </div>

                        `;

                    }


                    const nom =
                        match[1]
                            .trim();


                    const fonction =
                        match[2]
                            .trim();


                    const fonctionMin =
                        fonction.toLowerCase();


                    let classe =
                        "mairie-fonction-conseiller";


                    if (
                        fonctionMin.includes(
                            "maire"
                        ) &&
                        !fonctionMin.includes(
                            "adjoint"
                        )
                    ) {

                        classe =
                            "mairie-fonction-maire";

                    }

                    else if (
                        fonctionMin.includes(
                            "adjoint"
                        )
                    ) {

                        classe =
                            "mairie-fonction-adjoint";

                    }


                    return `

                        <div
                            class="
                                mairie-elu
                                ${classe}
                            "
                        >

                            <div
                                class="
                                    mairie-elu-nom
                                "
                            >
                                ${escapeHtmlMairie(
                                    nom
                                )}
                            </div>


                            <div
                                class="
                                    mairie-elu-fonction
                                "
                            >
                                ${escapeHtmlMairie(
                                    fonction
                                )}
                            </div>

                        </div>

                    `;

                }
            ).join("")}

        </div>

    `;

}


/* =========================================================
   CHARGEMENT DES MAIRIES
   ========================================================= */

fetch(
    'couches/services/mairies.geojson'
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

    L.geoJSON(
        data,
        {

            pointToLayer:
                function(
                    feature,
                    latlng
                ) {

                    return L.marker(
                        latlng,
                        {
                            icon: iconsSIG.mairie
                        }
                    );

                },


            onEachFeature: function (feature, layer) {

    layer.on(
        "click",
        function () {

            const p =
                feature.properties || {};


            const nom =
                p.name ;


            const site =
                p.contact_website;


            const email =
                p.contact_email;


            const telephone =
                p.contact_phone;


            const horaires =
                formaterHorairesMairie(
                    p.opening_hours
                );


            const elus =
                formaterElusMairie(
                    p.elus
                );

                const amenity =
                p.amenity;

            ouvrirFiche(`

                <div class="info-header">

                    <div class="info-type">
                        SERVICES
                    </div>


                    <div class="info-title">
                        ${escapeHtmlMairie(nom)}
                    </div>


                    <div class="info-subtitle">
                        ${amenity}
                    </div>

                </div>


                <div class="info-body">


                    <!-- =================================
                         CONTACT
                         ================================= -->

                    <div class="info-section">

                        <div class="info-section-title">
                            Contact
                        </div>


                        <div class="mairie-contact">

                            ${
                                site
                                    ? `

                                        <div class="mairie-contact-ligne">

                                            <span class="mairie-contact-icon">
                                                🌐
                                            </span>

                                            <span class="mairie-contact-label">
                                                Site internet
                                            </span>

                                            <a
                                                href="${escapeHtmlMairie(site)}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="mairie-contact-action"
                                            >
                                                Visiter le site
                                            </a>

                                        </div>

                                      `
                                    : ""
                            }


                            ${
                                email
                                    ? `

                                        <div class="mairie-contact-ligne">

                                            <span class="mairie-contact-icon">
                                                ✉️
                                            </span>

                                            <span class="mairie-contact-label">
                                                Email
                                            </span>

                                            <a
                                                href="mailto:${escapeHtmlMairie(email)}"
                                                class="mairie-contact-value"
                                            >
                                                ${escapeHtmlMairie(email)}
                                            </a>

                                        </div>

                                      `
                                    : ""
                            }


                            ${
                                telephone
                                    ? `

                                        <div class="mairie-contact-ligne">

                                            <span class="mairie-contact-icon">
                                                ☎️
                                            </span>

                                            <span class="mairie-contact-label">
                                                Téléphone
                                            </span>

                                            <a
                                                href="tel:${escapeHtmlMairie(telephone)}"
                                                class="mairie-contact-value"
                                            >
                                                ${escapeHtmlMairie(telephone)}
                                            </a>

                                        </div>

                                      `
                                    : ""
                            }

                        </div>

                    </div>


                    <!-- =================================
                         HORAIRES
                         ================================= -->

                    <div class="info-section">

                        <div class="info-section-title">
                            Horaires d'ouverture
                        </div>


                        ${horaires}

                    </div>


                    <!-- =================================
                         CONSEIL MUNICIPAL
                         ================================= -->

                    <div class="info-section mairie-section-elus">

                        <button
                            type="button"
                            class="mairie-elus-toggle"
                            onclick="
                                this
                                    .closest('.mairie-section-elus')
                                    .classList
                                    .toggle('open')
                            "
                        >

                            <span>
                                👥 Conseil municipal
                            </span>


                            <span class="mairie-elus-chevron">
                                ▾
                            </span>

                        </button>


                        <div class="mairie-elus-content">

                            ${elus}

                        </div>

                    </div>


                </div>

            `);

        }
    );

}}

    ).addTo(
        mairies
    );


    /*
     * Les mairies restent affichées
     * par défaut comme actuellement.
     */

    mairies.addTo(
        map
    );

})


.catch(error => {

    console.error(
        "Erreur lors du chargement des mairies :",
        error
    );

});