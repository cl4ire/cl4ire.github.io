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


                    <div class="info-subtitle">
                        La Poste
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

fetch('couches/services/mairies.geojson')

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `Erreur HTTP : ${response.status}`
            );

        }

        return response.json();

    })

    .then(data => {

        L.geoJSON(data, {

            pointToLayer: function (feature, latlng) {

                return L.marker(latlng, {
                   icon: iconsSIG.mairie
                });

            },


            onEachFeature: function (feature, layer) {

                const nom =
                    feature.properties.name ||
                    'Mairie';


                const site =
                    feature.properties.contact_website
                        ? `
                            <a
                                href="${feature.properties.contact_website}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="geo-popup-link"
                            >
                                Visiter le site
                            </a>
                          `
                        : 'Non renseigné';


                const email =
                    feature.properties.contact_email
                        ? `
                            <a
                                href="mailto:${feature.properties.contact_email}"
                                class="geo-popup-link"
                            >
                                ${feature.properties.contact_email}
                            </a>
                          `
                        : 'Non renseigné';


                const telephone =
                    feature.properties.contact_phone
                        ? `
                            <a
                                href="tel:${feature.properties.contact_phone}"
                                class="geo-popup-link"
                            >
                                ${feature.properties.contact_phone}
                            </a>
                          `
                        : 'Non renseigné';


                const horaires =
                    feature.properties.opening_hours
                        ? feature.properties.opening_hours
                            .replace(/\n/g, '<br>')
                        : 'Non renseigné';


                const elus =
                    feature.properties.elus
                        ? feature.properties.elus
                            .replace(/\r?\n/g, '<br>')
                        : 'Non renseigné';


                layer.on("click", function () {

                    ouvrirFiche(`

                        <div class="info-header">

                            <div class="info-type">
                                SERVICES
                            </div>

                            <div class="info-title">
                                ${nom}
                            </div>

                            <div class="info-subtitle">
                                Mairie
                            </div>

                        </div>


                        <div class="info-body">


                            <!-- =========================================
                                CONTACT
                                ========================================= -->

                            <div class="info-section">

                                <div class="info-section-title">
                                    Contact
                                </div>


                                <div class="info-row">

                                    <span class="info-label">
                                        🌐 Site internet
                                    </span>

                                    <span class="info-value">
                                        ${site}
                                    </span>

                                </div>


                                <div class="info-row">

                                    <span class="info-label">
                                        ✉️ Email
                                    </span>

                                    <span class="info-value">
                                        ${email}
                                    </span>

                                </div>


                                <div class="info-row">

                                    <span class="info-label">
                                        📞 Téléphone
                                    </span>

                                    <span class="info-value">
                                        ${telephone}
                                    </span>

                                </div>

                            </div>


                            <!-- =========================================
                                HORAIRES
                                ========================================= -->

                            <div class="info-section">

                                <div class="info-section-title">
                                    Horaires d'ouverture
                                </div>

                                <div class="info-description">
                                    ${horaires}
                                </div>

                            </div>


                            <!-- =========================================
                                CONSEIL MUNICIPAL
                                ========================================= -->

                            <div class="info-section">

                                <div class="info-section-title">
                                    Conseil municipal
                                </div>

                                <div class="info-description">
                                    ${elus}
                                </div>

                            </div>


                        </div>

                    `);

                });

            }

        }).addTo(mairies);


        /*
         * Les mairies sont affichées par défaut.
         */

        mairies.addTo(map);

    })

    .catch(error => {

        console.error(
            'Erreur lors du chargement des mairies :',
            error
        );

    });