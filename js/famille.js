/* =========================================================
   FAMILLE
   ========================================================= */

let petiteEnfance = L.layerGroup();
let education = L.layerGroup();


/* =========================================================
   PETITE ENFANCE
   ========================================================= */

fetch('couches/famille/petiteEnfance.geojson')

    .then(response => {

        if (!response.ok) {
            throw new Error(
                `Erreur HTTP petite enfance : ${response.status}`
            );
        }

        return response.json();

    })

    .then(data => {

        L.geoJSON(data, {

            pointToLayer: function (feature, latlng) {

                return L.marker(latlng, {
                    icon: iconsSIG.petiteEnfance
                });

            },
            onEachFeature: function (feature, layer) {

                const nom =
                    feature.properties.nom ||
                    'Lieu d\'accueil';


                const type =
                    feature.properties.type ||
                    'Non renseigné';


                const adresse =
                    feature.properties.adresse ||
                    'Non renseignée';


                const telephone =
                    feature.properties.telephone
                        ? `
                            <a
                                href="tel:${feature.properties.telephone}"
                                class="geo-popup-link"
                            >
                                ${feature.properties.telephone}
                            </a>
                          `
                        : 'Non renseigné';


                const mail =
                    feature.properties.mail
                        ? `
                            <a
                                href="mailto:${feature.properties.mail}"
                                class="geo-popup-link"
                            >
                                ${feature.properties.mail}
                            </a>
                          `
                        : 'Non renseigné';


                layer.bindPopup(`

                    <div class="geo-popup">

                        <!-- ==============================
                             EN-TÊTE
                             ============================== -->

                        <div class="geo-popup-header">

                            <div class="geo-popup-icon">
                                👶
                            </div>

                            <div>

                                <div class="geo-popup-title">
                                    ${nom}
                                </div>

                                <div class="geo-popup-subtitle">
                                    ${type}
                                </div>

                            </div>

                        </div>


                        <!-- ==============================
                             CORPS
                             ============================== -->

                        <div class="geo-popup-body">


                            <!-- Adresse -->

                            <div class="geo-popup-info">

                                <span class="geo-popup-info-icon">
                                    📍
                                </span>

                                <div>

                                    <div class="geo-popup-label">
                                        Adresse
                                    </div>

                                    <div class="geo-popup-value">
                                        ${adresse}
                                    </div>

                                </div>

                            </div>


                            <!-- Téléphone -->

                            <div class="geo-popup-info">

                                <span class="geo-popup-info-icon">
                                    📞
                                </span>

                                <div>

                                    <div class="geo-popup-label">
                                        Téléphone
                                    </div>

                                    <div class="geo-popup-value">
                                        ${telephone}
                                    </div>

                                </div>

                            </div>


                            <!-- Mail -->

                            <div class="geo-popup-info">

                                <span class="geo-popup-info-icon">
                                    ✉️
                                </span>

                                <div>

                                    <div class="geo-popup-label">
                                        Mail
                                    </div>

                                    <div class="geo-popup-value">
                                        ${mail}
                                    </div>

                                </div>

                            </div>


                        </div>

                    </div>

                `);

            }

        }).addTo(petiteEnfance);

    })

    .catch(error => {

        console.error(
            'Erreur lors du chargement de la petite enfance :',
            error
        );

    });


/* =========================================================
   ÉDUCATION
   ========================================================= */

fetch('couches/famille/education.geojson')

    .then(response => {

        if (!response.ok) {
            throw new Error(
                `Erreur HTTP éducation : ${response.status}`
            );
        }

        return response.json();

    })

    .then(data => {

        L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {

                return L.marker(latlng, {
                    icon: iconsSIG.education
                });

            },

            onEachFeature: function (feature, layer) {

                const nom =
                    feature.properties.name ||
                    'Établissement scolaire';


                const type =
                    feature.properties.type_fr ||
                    'Non renseigné';


                const statut =
                    feature.properties.statut ||
                    'Non renseigné';


                layer.bindPopup(`

                    <div class="geo-popup">

                        <!-- ==============================
                             EN-TÊTE
                             ============================== -->

                        <div class="geo-popup-header">

                            <div class="geo-popup-icon">
                                🎓
                            </div>

                            <div>

                                <div class="geo-popup-title">
                                    ${nom}
                                </div>

                                <div class="geo-popup-subtitle">
                                    ${type}
                                </div>

                            </div>

                        </div>


                        <!-- ==============================
                             CORPS
                             ============================== -->

                        <div class="geo-popup-body">


                            <!-- Type -->

                            <div class="geo-popup-info">

                                <span class="geo-popup-info-icon">
                                    🏫
                                </span>

                                <div>

                                    <div class="geo-popup-label">
                                        Type
                                    </div>

                                    <div class="geo-popup-value">
                                        ${type}
                                    </div>

                                </div>

                            </div>


                            <!-- Statut -->

                            <div class="geo-popup-info">

                                <span class="geo-popup-info-icon">
                                    ℹ️
                                </span>

                                <div>

                                    <div class="geo-popup-label">
                                        Statut
                                    </div>

                                    <div class="geo-popup-value">
                                        ${statut}
                                    </div>

                                </div>

                            </div>


                        </div>

                    </div>

                `);

            }

        }).addTo(education);

    })

    .catch(error => {

        console.error(
            'Erreur lors du chargement de l’éducation :',
            error
        );

    });