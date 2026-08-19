/* =========================================================
   GÉOBERCÉ — CARTE PRINCIPALE
   ========================================================= */


/* =========================================================
   1. INITIALISATION DE LA CARTE
   ========================================================= */

const map = L.map('map',{zoomControl:false}).setView(
    [47.791528, 0.412223],
    12,
);
L.control.zoom({
    position: 'topright'
}).addTo(map);

/* =========================================================
   2. FOND DE CARTE
   ========================================================= */

L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
        attribution:
            '&copy; OpenStreetMap contributors &copy; CARTO',

        subdomains: 'abcd',

        maxZoom: 20
    }
).addTo(map);


/* =========================================================
   3. GÉOLOCALISATION
   ========================================================= */

L.control.locate({
    position: 'topright',
    flyTo: true,
    keepCurrentZoomLevel: false
}).addTo(map);


/* =========================================================
   4. RECHERCHE D'ADRESSE
   ========================================================= */

let marqueurRecherche;
let timerRecherche;

const searchInput =
    document.getElementById("search");

const suggestions =
    document.getElementById("suggestions");


searchInput.addEventListener(
    "input",
    function () {

        clearTimeout(timerRecherche);

        const recherche =
            this.value.trim();


        timerRecherche =
            setTimeout(() => {

                if (recherche.length < 3) {

                    suggestions.innerHTML = "";

                    return;
                }


                fetch(
                    "https://api-adresse.data.gouv.fr/search/?q=" +
                    encodeURIComponent(recherche) +
                    "&limit=5"
                )

                .then(response => {

                    if (!response.ok) {

                        throw new Error(
                            `Erreur recherche : ${response.status}`
                        );

                    }

                    return response.json();

                })

                .then(data => {

                    suggestions.innerHTML = "";


                    data.features.forEach(
                        feature => {

                            const div =
                                document.createElement(
                                    "div"
                                );


                            div.className =
                                "suggestion";


                            div.textContent =
                                feature.properties.label;


                            div.addEventListener(
                                "click",
                                function () {

                                    const lat =
                                        feature.geometry.coordinates[1];

                                    const lon =
                                        feature.geometry.coordinates[0];


                                    map.setView(
                                        [lat, lon],
                                        18
                                    );


                                    if (
                                        marqueurRecherche
                                    ) {

                                        map.removeLayer(
                                            marqueurRecherche
                                        );

                                    }


                                    marqueurRecherche =
                                        L.marker(
                                            [lat, lon]
                                        )
                                        .addTo(map)
                                        .bindPopup(
                                            feature.properties.label
                                        )
                                        .openPopup();


                                    suggestions.innerHTML =
                                        "";


                                    searchInput.value =
                                        feature.properties.label;

                                }
                            );


                            suggestions.appendChild(
                                div
                            );

                        }
                    );

                })

                .catch(error => {

                    console.error(
                        "Erreur recherche :",
                        error
                    );

                });

            }, 300);

    }
);


/* =========================================================
   FERMETURE DES SUGGESTIONS
   ========================================================= */

document.addEventListener(
    "click",
    function (event) {

        const container =
            document.getElementById(
                "search-container"
            );


        if (
            container &&
            !container.contains(
                event.target
            )
        ) {

            suggestions.innerHTML = "";

        }

    }
);


/* =========================================================
   5. COUCHES DE RÉFÉRENCE
   ========================================================= */

let epci;
let communes;


/* ---------------------------------------------------------
   EPCI
   --------------------------------------------------------- */

fetch('couches/epci.geojson')

    .then(response => response.json())

    .then(data => {

        epci =
            L.geoJSON(
                data,
                {

                    style: {

                        color: "#4d8298",

                        weight: 2,

                        opacity: 0.75,

                        fillOpacity: 0,

                        lineCap: "round",

                        lineJoin: "round"

                    }

                }
            );


        /*
         * EPCI affiché au démarrage
         */

        epci.addTo(map);


        synchroniserInterfaceCouches();

    })

    .catch(error => {

        console.error(
            "Erreur EPCI :",
            error
        );

    });


/* ---------------------------------------------------------
   COMMUNES
   --------------------------------------------------------- */

fetch('couches/communes.geojson')

    .then(response => response.json())

    .then(data => {

        communes =
            L.geoJSON(
                data,
                {

                    style: {

                        color: "#8b9496",

                        weight: 0.8,

                        opacity: 0.65,

                        fillOpacity: 0,

                        dashArray: "5,5"

                    }

                }
            );


        /*
         * Communes affichées au démarrage
         */

        communes.addTo(map);


        synchroniserInterfaceCouches();

    })

    .catch(error => {

        console.error(
            "Erreur communes :",
            error
        );

    });


/* =========================================================
   6. CONFIGURATION DES COUCHES
   ========================================================= */

/*
 * Les couches sont créées dans les autres fichiers JS
 * chargés avant map.js.
 *
 * On conserve ici ton organisation actuelle.
 */

const configurationCouches = {

    /* -----------------------------------------------------
       PATRIMOINE
       ----------------------------------------------------- */

    patrimoine: {

        nom: "Patrimoine",

        icone: "🏛️",

        classeIcone: "patrimoine",

        couches: []

    },


    /* -----------------------------------------------------
       NATURE
       ----------------------------------------------------- */

    nature: {

        nom: "Nature",

        icone: "🌿",

        classeIcone: "nature",

        couches: [

            {
                id: "vigieau",

                nom: "VigiEau - Alertes sécheresse",

                layer: vigieau

            },

            {
                id: "debroussaillement",

                nom: "Obligation Légale de Débroussaillement (OLD)",

                layer: debroussaillement

            }

        ]

    },


    /* -----------------------------------------------------
       RANDONNÉES
       ----------------------------------------------------- */

    randonnees: {

        nom: "Randonnées",

        icone: "🥾",

        classeIcone: "randonnees",

        couches: [

            {
                id: "randonnees",

                nom: "Randonnées",

                layer: randonnees

            }

        ]

    },


    /* -----------------------------------------------------
       SERVICES
       ----------------------------------------------------- */

    services: {

        nom: "Services",

        icone: "🏛️",

        classeIcone: "services",

        couches: [

            {
                id: "mairies",

                nom: "Mairies",

                layer: mairies

            },

            {
                id: "bal",

                nom: "Boîtes aux lettres",

                layer: bal

            },

            {
                id: "dae",

                nom: "Défibrillateurs",

                layer: dae

            }

        ]

    },


    /* -----------------------------------------------------
       FAMILLE
       ----------------------------------------------------- */

    famille: {

        nom: "Famille",

        icone: "👨‍👩‍👧",

        classeIcone: "famille",

        couches: [

            {
                id: "petiteEnfance",

                nom: "Petite enfance",

                layer: petiteEnfance

            },

            {
                id: "education",

                nom: "Éducation",

                layer: education

            }

        ]

    },


    /* -----------------------------------------------------
       MOBILITÉ
       ----------------------------------------------------- */

    mobilite: {

        nom: "Mobilité",

        icone: "🚌",

        classeIcone: "mobilite",

        couches: [

            {
                id: "carburant",

                nom: "Carburant",

                layer: carburant

            },

            {
                id: "trajets",

                nom: "Lignes ALEOP",

                layer: trajets

            },

            {
                id: "arrets",

                nom: "Arrêts ALEOP",

                layer: arrets

            }

        ]

    },


    /* -----------------------------------------------------
       URBANISME
       ----------------------------------------------------- */

    urbanisme: {

        nom: "Urbanisme",

        icone: "🏠",

        classeIcone: "urbanisme",

        couches: [

            {
                id: "mutations",

                nom: "Mutations immobilières",

                layer: mutations

            },

    {
        id: "dpe",
        nom: "Diagnostics de performance énergétique",
        layer: dpe
    }

        ]

    }

};


/* =========================================================
   7. ÉLÉMENTS DE L'INTERFACE
   ========================================================= */

const layersTree =
    document.getElementById(
        "layers-tree"
    );


const layersFilter =
    document.getElementById(
        "layers-filter"
    );


/* =========================================================
   8. CRÉATION D'UN GROUPE
   ========================================================= */

function creerGroupe(
    groupId,
    configuration
) {

    const groupe =
        document.createElement(
            "section"
        );


    groupe.className =
        "layer-group";


    groupe.dataset.group =
        groupId;


    groupe.innerHTML = `

        <div class="layer-group-header">

            <div class="layer-group-name">

                <span class="layer-group-icon ${configuration.classeIcone}">
                    ${configuration.icone}
                </span>

                <span>
                    ${configuration.nom}
                </span>

            </div>


            <div class="layer-group-actions">

                <span
                    class="layer-status"
                    title="État des couches"
                ></span>


                <button
                    type="button"
                    class="group-expand"
                    aria-label="Déplier ou replier"
                >
                    ˅
                </button>

            </div>

        </div>


        <div class="layer-sublist"></div>

    `;


    layersTree.appendChild(
        groupe
    );


    return groupe;

}


/* =========================================================
   9. CONSTRUIRE L'ARBRE
   ========================================================= */

function construireArbre() {

    layersTree.innerHTML = "";


    Object.entries(
        configurationCouches
    )
    .forEach(
        ([groupId, configuration]) => {


            const groupe =
                creerGroupe(
                    groupId,
                    configuration
                );


            const sousListe =
                groupe.querySelector(
                    ".layer-sublist"
                );


            configuration.couches.forEach(
                coucheConfig => {


                    const item =
                        document.createElement(
                            "label"
                        );


                    item.className =
                        "layer-subitem";


                    const checkbox =
                        document.createElement(
                            "input"
                        );


                    checkbox.type =
                        "checkbox";


                    const checkboxVisuel =
                        document.createElement(
                            "span"
                        );


                    checkboxVisuel.className =
                        "layer-checkbox";


                    const texte =
                        document.createElement(
                            "span"
                        );


                    texte.className =
                        "layer-name";


                    texte.textContent =
                        coucheConfig.nom;


                    item.appendChild(
                        checkbox
                    );


                    item.appendChild(
                        checkboxVisuel
                    );


                    item.appendChild(
                        texte
                    );


                    sousListe.appendChild(
                        item
                    );


                    /*
                     * Activation / désactivation
                     */

                    checkbox.addEventListener(
                        "change",
                        function () {


                            const layer =
                                coucheConfig.layer;


                            if (!layer) {

                                console.warn(
                                    "Couche indisponible :",
                                    coucheConfig.id
                                );

                                this.checked =
                                    false;

                                return;

                            }


                            if (
                                this.checked
                            ) {

                                map.addLayer(
                                    layer
                                );

                            }

                            else {

                                map.removeLayer(
                                    layer
                                );

                            }


                            mettreAJourGroupe(
                                groupId
                            );

                        }
                    );

                }
            );


            /*
             * Ouvrir / fermer le groupe
             */

            const header =
                groupe.querySelector(
                    ".layer-group-header"
                );


            const boutonExpand =
                groupe.querySelector(
                    ".group-expand"
                );


            header.addEventListener(
                "click",
                function () {

                    groupe.classList.toggle(
                        "collapsed"
                    );

                }
            );


            boutonExpand.addEventListener(
                "click",
                function (event) {

                    event.stopPropagation();

                    groupe.classList.toggle(
                        "collapsed"
                    );

                }
            );


            mettreAJourGroupe(
                groupId
            );

        }
    );

}


/* =========================================================
   10. MISE À JOUR DE L'ÉTAT D'UN GROUPE
   ========================================================= */

function mettreAJourGroupe(
    groupId
) {


    const configuration =
        configurationCouches[
            groupId
        ];


    if (!configuration) {

        return;

    }


    const groupe =
        document.querySelector(
            `.layer-group[data-group="${groupId}"]`
        );


    if (!groupe) {

        return;

    }


    const indicateur =
        groupe.querySelector(
            ".layer-status"
        );


    const cases =
        groupe.querySelectorAll(
            ".layer-subitem input[type='checkbox']"
        );


    let total =
        0;


    let actives =
        0;


    configuration.couches.forEach(
        (coucheConfig, index) => {


            const layer =
                coucheConfig.layer;


            /*
             * Une couche peut ne pas encore être
             * chargée au moment de la première
             * synchronisation.
             */

            if (!layer) {

                if (cases[index]) {

                    cases[index].checked =
                        false;

                }

                return;

            }


            total++;


            const active =
                map.hasLayer(
                    layer
                );


            if (active) {

                actives++;

            }


            if (cases[index]) {

                cases[index].checked =
                    active;

            }

        }
    );


    /*
     * Nettoyage de l'état précédent.
     */

    indicateur.classList.remove(
        "active",
        "partial"
    );


    /*
     * Toutes les couches actives.
     */

    if (
        total > 0 &&
        actives === total
    ) {

        indicateur.classList.add(
            "active"
        );

    }


    /*
     * Seulement une partie des couches actives.
     */

    else if (
        actives > 0
    ) {

        indicateur.classList.add(
            "partial"
        );

    }

}


/* =========================================================
   11. SYNCHRONISATION GÉNÉRALE
   ========================================================= */

function synchroniserInterfaceCouches() {


    if (
        typeof configurationCouches ===
        "undefined"
    ) {

        return;

    }


    Object.keys(
        configurationCouches
    )
    .forEach(
        groupId => {

            mettreAJourGroupe(
                groupId
            );

        }
    );

}


/* =========================================================
   12. FILTRE DES COUCHES
   ========================================================= */

layersFilter.addEventListener(
    "input",
    function () {


        const recherche =
            this.value
                .toLowerCase()
                .trim();


        document
            .querySelectorAll(
                ".layer-group"
            )
            .forEach(
                groupe => {


                    const sousCouches =
                        groupe.querySelectorAll(
                            ".layer-subitem"
                        );


                    let correspondance =
                        false;


                    sousCouches.forEach(
                        sousCouche => {


                            const texte =
                                sousCouche
                                    .textContent
                                    .toLowerCase();


                            if (
                                recherche === "" ||
                                texte.includes(
                                    recherche
                                )
                            ) {

                                sousCouche.style.display =
                                    "flex";

                                correspondance =
                                    true;

                            }

                            else {

                                sousCouche.style.display =
                                    "none";

                            }

                        }
                    );


                    if (
                        recherche !== "" &&
                        !correspondance
                    ) {

                        groupe.style.display =
                            "none";

                    }

                    else {

                        groupe.style.display =
                            "block";

                    }

                }
            );

    }
);


/* =========================================================
   13. FICHE D'INFORMATION
   ========================================================= */

const infoPanel =
    document.getElementById(
        "info-panel"
    );


const infoContent =
    document.getElementById(
        "info-content"
    );


const infoClose =
    document.getElementById(
        "info-close"
    );

function ouvrirFiche(contenu) {

    infoContent.innerHTML =
        contenu;

    infoPanel.classList.add(
        "open"
    );

    /*
     * On attend que la fiche soit réellement affichée
     * pour récupérer sa largeur.
     */
    requestAnimationFrame(() => {

        const largeur =
            infoPanel.getBoundingClientRect().width;

        document
            .querySelectorAll(
                ".leaflet-top.leaflet-right .leaflet-control"
            )
            .forEach(controle => {

                controle.style.transform =
                    `translateX(-${largeur + 15}px)`;

            });

    });

    infoPanel.scrollTop =
        0;

}


function fermerFiche() {

    infoPanel.classList.remove(
        "open"
    );

    /*
     * Retour exact à la position initiale.
     */
    document
        .querySelectorAll(
            ".leaflet-top.leaflet-right .leaflet-control"
        )
        .forEach(controle => {

            controle.style.transform =
                "";

        });

}
infoClose.addEventListener(
    "click",
    fermerFiche
);


document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape"
        ) {

            fermerFiche();

        }

    }
);


/* =========================================================
   14. INITIALISATION
   ========================================================= */

construireArbre();


/*
 * Première synchronisation.
 */

synchroniserInterfaceCouches();

/* =========================================================
   SYNCHRONISATION AUTOMATIQUE DES COUCHES
   ========================================================= */

map.on("layeradd layerremove", function () {
    synchroniserInterfaceCouches();
});

console.log(
    "GéoBercé — interface initialisée"
);

