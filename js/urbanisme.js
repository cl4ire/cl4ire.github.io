/* =========================================================
   URBANISME
   ========================================================= */

let mutations = L.layerGroup();


/* =========================================================
   CHARGEMENT DES MUTATIONS
   ========================================================= */

fetch('couches/urbanisme/mutations_jupilles.geojson')

    .then(response => {

        if (!response.ok) {

            throw new Error(
                `Erreur HTTP mutations : ${response.status}`
            );

        }

        return response.json();

    })

    .then(data => {

        console.log(
            "Mutations chargées :",
            data.features.length
        );


        /* =====================================================
           COUCHE GEOJSON
           ===================================================== */

        const coucheMutations = L.geoJSON(data, {

            style: {

                fillColor: "#4C9BD1",

                fillOpacity: 0.18,

                weight: 1,

                opacity: 0.9,

                color: "#357FAF"
            },


            /* =================================================
               CHAQUE MUTATION
               ================================================= */

            onEachFeature: function (
                feature,
                layer
            ) {

                let popupOuverture = false;


                const p = feature.properties;


                /* =================================================
                   DONNÉES
                   ================================================= */

                const natureMutation =
                    p.nature_mut ||
                    "Mutation immobilière";


                const valeurFonciere =
                    p.valeur_fon
                        ? Number(
                            p.valeur_fon
                        ).toLocaleString(
                            'fr-FR'
                        ) + ' €'
                        : 'Non renseignée';


                const dateMutation =
                    p.date_mutat
                        ? new Date(
                            p.date_mutat
                        ).toLocaleDateString(
                            'fr-FR'
                        )
                        : 'Non renseignée';


                const adresse = [

                    p.adresse_nu,
                    p.adresse_su,
                    p.adresse_no

                ]
                .filter(Boolean)
                .join(' ') ||
                'Non renseignée';


                const surfaceBien =
                    p.surface_re
                        ? Number(
                            p.surface_re
                        ).toLocaleString(
                            'fr-FR'
                        ) + ' m²'
                        : 'Non renseignée';


                const prixM2 =
                    p.prix_m2
                        ? Number(
                            p.prix_m2
                        ).toLocaleString(
                            'fr-FR'
                        ) + ' €/m²'
                        : 'Non renseigné';


                /* =================================================
                   CULTURES / TERRAINS
                   ================================================= */

                const cultures =
                    p.nature_cul
                        ? String(
                            p.nature_cul
                        ).split(',')
                        : [];


                const surfaces =
                    p.surface_te
                        ? String(
                            p.surface_te
                        ).split(',')
                        : [];


                let tableauCultures = '';


                if (cultures.length > 0) {

                    tableauCultures = `

                        <div class="geo-popup-section">

                            <div class="geo-popup-section-title">
                                Terrains concernés
                            </div>

                            <div class="geo-popup-table-wrapper">

                                <table
                                    class="geo-popup-table"
                                >

                                    <thead>

                                        <tr>

                                            <th>
                                                Terrain
                                            </th>

                                            <th>
                                                Surface
                                            </th>

                                        </tr>

                                    </thead>

                                    <tbody>

                    `;


                    for (
                        let i = 0;
                        i < cultures.length;
                        i++
                    ) {

                        tableauCultures += `

                            <tr>

                                <td>
                                    ${cultures[i]}
                                </td>

                                <td>
                                    ${
                                        surfaces[i]
                                            ? Number(
                                                surfaces[i]
                                            ).toLocaleString(
                                                'fr-FR'
                                            ) + ' m²'
                                            : '-'
                                    }
                                </td>

                            </tr>

                        `;

                    }


                    tableauCultures += `

                                    </tbody>

                                </table>

                            </div>

                        </div>

                    `;

                }


                /* =================================================
                   POPUP
                   ================================================= */

                layer.bindPopup(`

                    <div class="geo-popup">


                        <!-- ======================================
                             EN-TÊTE
                             ====================================== -->

                        <div class="geo-popup-header">

                            <div class="geo-popup-icon">
                                🏠
                            </div>

                            <div>

                                <div class="geo-popup-title">
                                    ${natureMutation}
                                </div>

                                <div class="geo-popup-subtitle">
                                    Mutation immobilière
                                </div>

                            </div>

                        </div>


                        <!-- ======================================
                             CORPS
                             ====================================== -->

                        <div class="geo-popup-body">


                            <!-- Valeur foncière -->

                            <div class="geo-popup-info">

                                <span class="geo-popup-info-icon">
                                    💶
                                </span>

                                <div>

                                    <div class="geo-popup-label">
                                        Valeur foncière
                                    </div>

                                    <div class="geo-popup-value">
                                        ${valeurFonciere}
                                    </div>

                                </div>

                            </div>


                            <!-- Date -->

                            <div class="geo-popup-info">

                                <span class="geo-popup-info-icon">
                                    📅
                                </span>

                                <div>

                                    <div class="geo-popup-label">
                                        Date de mutation
                                    </div>

                                    <div class="geo-popup-value">
                                        ${dateMutation}
                                    </div>

                                </div>

                            </div>


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


                            <!-- Caractéristiques -->

                            <div class="geo-popup-section">

                                <div class="geo-popup-section-title">
                                    Caractéristiques
                                </div>


                                <div class="geo-popup-info">

                                    <span class="geo-popup-info-icon">
                                        🏠
                                    </span>

                                    <div>

                                        <div class="geo-popup-label">
                                            Surface du bien
                                        </div>

                                        <div class="geo-popup-value">
                                            ${surfaceBien}
                                        </div>

                                    </div>

                                </div>


                                <div class="geo-popup-info">

                                    <span class="geo-popup-info-icon">
                                        📊
                                    </span>

                                    <div>

                                        <div class="geo-popup-label">
                                            Prix au m²
                                        </div>

                                        <div class="geo-popup-value">
                                            ${prixM2}
                                        </div>

                                    </div>

                                </div>

                            </div>


                            <!-- Terrains -->

                            ${tableauCultures}


                        </div>

                    </div>

                `);


                /* =================================================
                   SURVOL
                   ================================================= */

                layer.on(
                    'mouseover',
                    function () {

                        if (popupOuverture) {
                            return;
                        }

                        layer.setStyle({

                            fillColor: "#4C9BD1",

                            fillOpacity: 0.45,

                            weight: 1.5,

                            opacity: 1,

                            color: "#357FAF"

                        });

                    }
                );


                /* =================================================
                   FIN DU SURVOL
                   ================================================= */

                layer.on(
                    'mouseout',
                    function () {

                        if (popupOuverture) {
                            return;
                        }

                        layer.setStyle({

                            fillColor: "#4C9BD1",

                            fillOpacity: 0.18,

                            weight: 1,

                            opacity: 0.9,

                            color: "#357FAF"

                        });

                    }
                );


                /* =================================================
                   OUVERTURE POPUP
                   ================================================= */

                layer.on(
                    'popupopen',
                    function () {

                        popupOuverture = true;

                        layer.setStyle({

                            fillColor: "#4C9BD1",

                            fillOpacity: 0.45,

                            weight: 1.5,

                            opacity: 1,

                            color: "#357FAF"

                        });

                    }
                );


                /* =================================================
                   FERMETURE POPUP
                   ================================================= */

                layer.on(
                    'popupclose',
                    function () {

                        popupOuverture = false;

                        layer.setStyle({

                            fillColor: "#4C9BD1",

                            fillOpacity: 0.18,

                            weight: 1,

                            opacity: 0.9,

                            color: "#357FAF"

                        });

                    }
                );

            }

        });


        /* =====================================================
           AJOUT AU GROUPE
           ===================================================== */

        mutations.addLayer(
            coucheMutations
        );


        console.log(
            "Mutations dans le groupe :",
            mutations.getLayers().length
        );

    })


    /* =========================================================
       ERREUR
       ========================================================= */

    .catch(error => {

        console.error(
            "Erreur lors du chargement des mutations :",
            error
        );

    });