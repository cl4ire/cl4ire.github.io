/* =========================================================
   TOURISME — RANDONNÉES
   ========================================================= */

let randonnees = L.layerGroup();


/* =========================================================
   CHARGEMENT DES RANDONNÉES
   ========================================================= */

fetch('couches/tourisme/randonnees.geojson')

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `Erreur HTTP randonnées : ${response.status}`
            );

        }

        return response.json();

    })

    .then(data => {

        L.geoJSON(data, {

            /* -------------------------------------------------
               STYLE DU PARCOURS
               ------------------------------------------------- */

           style: {
                color: "#3F8064",
                weight: 3,
                opacity: 0.8,
                lineCap: "round",
                lineJoin: "round"
            },


            /* -------------------------------------------------
               ACTIONS SUR CHAQUE RANDONNÉE
               ------------------------------------------------- */

            onEachFeature: function (feature, layer) {

                const nom =
                    feature.properties.id ||
                    'Randonnée';


                const distance =
                    feature.properties.distance !== undefined
                        ? `${feature.properties.distance} km`
                        : 'Non renseignée';


                const duree =
                    feature.properties.dureeEstim !== undefined
                        ? `${feature.properties.dureeEstim} h`
                        : 'Non renseignée';


                /* =============================================
                   POPUP
                   ============================================= */

                layer.bindPopup(`

                    <div class="geo-popup">

                        <div class="geo-popup-header">

                            <div class="geo-popup-icon">
                                🥾
                            </div>

                            <div>

                                <div class="geo-popup-title">
                                    ${nom}
                                </div>

                                <div class="geo-popup-subtitle">
                                    Randonnée
                                </div>

                            </div>

                        </div>


                        <div class="geo-popup-body">


                            <!-- Distance -->

                            <div class="geo-popup-info">

                                <span class="geo-popup-info-icon">
                                    📏
                                </span>

                                <div>

                                    <div class="geo-popup-label">
                                        Distance
                                    </div>

                                    <div class="geo-popup-value">
                                        ${distance}
                                    </div>

                                </div>

                            </div>


                            <!-- Durée -->

                            <div class="geo-popup-info">

                                <span class="geo-popup-info-icon">
                                    🕐
                                </span>

                                <div>

                                    <div class="geo-popup-label">
                                        Durée estimée
                                    </div>

                                    <div class="geo-popup-value">
                                        ${duree}
                                    </div>

                                </div>

                            </div>


                            <!-- Bouton -->

                            <button
                                type="button"
                                class="geo-popup-action"
                            >
                                🗺️ Voir le parcours
                            </button>


                        </div>

                    </div>

                `);

                /* =================================================
                SURVOL DE LA RANDONNÉE
                ================================================= */

                layer.on('mouseover', function () {

                    layer.setStyle({
                        color: "#3F8064",
                        weight: 5,
                        opacity: 1
                    });

                });


                /* =================================================
                FIN DU SURVOL
                ================================================= */

                layer.on('mouseout', function () {

                    layer.setStyle({
                        color: "#3F8064",
                        weight: 3,
                        opacity: 0.8
                    });

                });
                /* =============================================
                   BOUTON "VOIR LE PARCOURS"
                   ============================================= */

                layer.on('popupopen', function (event) {

                    const popupElement =
                        event.popup.getElement();

                    if (!popupElement) {
                        return;
                    }


                    const bouton =
                        popupElement.querySelector(
                            '.geo-popup-action'
                        );


                    if (!bouton) {
                        return;
                    }


                    bouton.addEventListener(
                        'click',
                        function () {

                            const bounds =
                                layer.getBounds();


                            if (bounds.isValid()) {

                                map.fitBounds(
                                    bounds,
                                    {
                                        padding: [50, 50],
                                        maxZoom: 16
                                    }
                                );

                            }

                        }
                    );

                });

            }

        }).addTo(randonnees);

    })

    .catch(error => {

        console.error(
            'Erreur lors du chargement des randonnées :',
            error
        );

    });