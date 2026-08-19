/* =========================================================
   URBANISME — MUTATIONS IMMOBILIÈRES DVF
   ========================================================= */

let dpe  = L.layerGroup();
let mutations = L.layerGroup();
/* =========================================================
   PARCELLE MUTATION SÉLECTIONNÉE
   ========================================================= */

window.mutationLayerSelectionnee = null;


/* Style normal d'une parcelle */

function reinitialiserParcelleMutation() {

    const ancienne =
        window.mutationLayerSelectionnee;

    if (!ancienne) {
        return;
    }

    ancienne.setStyle({
        color: "#8b5e3c",
        weight: 1,
        opacity: 0.8,
        fillColor: "#c89b6d",
        fillOpacity: 0.28
    });

    window.mutationLayerSelectionnee = null;

}


/* Sélection + zoom */

function selectionnerParcelleMutation(layer) {

    /*
     * On remet l'ancienne parcelle
     * dans son état normal.
     */

    reinitialiserParcelleMutation();


    /*
     * Nouvelle parcelle sélectionnée.
     */

    window.mutationLayerSelectionnee =
        layer;


    /*
     * Couleur de sélection.
     */

    layer.setStyle({

        color: "#2f7d57",

        weight: 3,

        opacity: 1,

        fillColor: "#72c49a",

        fillOpacity: 0.55

    });


    /*
     * La place au-dessus des autres parcelles.
     */

    layer.bringToFront();


    /*
     * Zoom automatique sur la parcelle.
     */

    const bounds =
        layer.getBounds();


    if (bounds.isValid()) {

        map.flyToBounds(
            bounds,
            {
                padding: [80, 80],
                maxZoom: 18,
                duration: 0.7
            }
        );

    }

}

/* =========================================================
   OUTILS
   ========================================================= */

function escapeHtmlMutation(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function valeurMutation(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "Non renseignée";

    }

    const nombre =
        Number(value);

    if (Number.isNaN(nombre)) {

        return escapeHtmlMutation(value);

    }

    return (
        nombre.toLocaleString(
            "fr-FR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        ) + " €"
    );

}


function surfaceMutation(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "Non renseignée";

    }

    const nombre =
        Number(value);

    if (Number.isNaN(nombre)) {

        return escapeHtmlMutation(value);

    }

    return (
        nombre.toLocaleString(
            "fr-FR",
            {
                maximumFractionDigits: 0
            }
        ) + " m²"
    );

}


function dateMutation(value) {

    if (!value) {

        return "Non renseignée";

    }

    /*
     * Le fichier DVF contient actuellement
     * les dates sous la forme :
     *
     * 09/01/2025
     */

    if (
        /^\d{2}\/\d{2}\/\d{4}$/.test(
            String(value)
        )
    ) {

        return value;

    }


    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return escapeHtmlMutation(value);

    }

    return date.toLocaleDateString(
        "fr-FR"
    );

}


function nomNatureMutation(value) {

    if (!value) {

        return "Mutation immobilière";

    }

    switch (
        String(value).toLowerCase()
    ) {

        case "vente":
            return "Vente";

        case "vente en l'état futur d'achèvement":
            return "Vente en l'état futur d'achèvement";

        case "échange":
            return "Échange";

        case "adjudication":
            return "Adjudication";

        case "expropriation":
            return "Expropriation";

        default:
            return value;

    }

}


/* =========================================================
   CULTURES / PARCELLES
   ========================================================= */
const NATURES_CULTURE = {
    "T": "Terre",
    "P": "Pré",
    "J": "Jardin",
    "S": "Sol",
    "B": "Bois",
    "V": "Vigne",
    "O": "Verger",
    "L": "Landes",
    "E": "Eau"
};
function construireCulturesMutation(props) {

    if (!props.cultures) {
        return "";
    }

    const cultures = String(props.cultures)
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);

    if (!cultures.length) {
        return "";
    }

    return `
        <div class="mutation-cultures">

            ${cultures.map(code => {

                const nom =
                    NATURES_CULTURE[code] || code;

                return `
                    <span class="mutation-culture">
                        ${escapeHtmlMutation(nom)}
                    </span>
                `;

            }).join("")}

        </div>
    `;
}


/* =========================================================
   FICHE MUTATION
   ========================================================= */

function ouvrirFicheMutation(feature, layer) {

    const p = feature.properties || {};

    const historique = Array.isArray(p.historique_mutations)
        ? [...p.historique_mutations]
        : [];


    /* =====================================================
       OUTILS DE FORMATAGE
       ===================================================== */

    function formatPrix(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "Valeur non renseignée";
        }

        const nombre = Number(value);

        if (Number.isNaN(nombre)) {
            return escapeHtmlMutation(value);
        }

        return nombre.toLocaleString(
            "fr-FR",
            {
                maximumFractionDigits: 0
            }
        ) + " €";
    }


    function formatSurface(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "";
        }

        const nombre = Number(value);

        if (Number.isNaN(nombre)) {
            return escapeHtmlMutation(value);
        }

        return nombre.toLocaleString(
            "fr-FR",
            {
                maximumFractionDigits: 0
            }
        ) + " m²";
    }


    function formatPieces(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return "";
        }

        const nombre = Number(value);

        if (Number.isNaN(nombre)) {
            return "";
        }

        return (
            nombre.toLocaleString("fr-FR", {
                maximumFractionDigits: 0
            })
            +
            " pièce"
            +
            (nombre > 1 ? "s" : "")
        );
    }


    function formatDate(value) {

        if (!value) {
            return "";
        }

        return escapeHtmlMutation(value);
    }


    /* =====================================================
       NATURES DE CULTURE
       ===================================================== */

    const NATURES_CULTURE = {

        "T": "Terres",
        "P": "Prés",
        "J": "Jardins",
        "S": "Sols",
        "B": "Bois",
        "V": "Vignes",
        "O": "Vergers",
        "L": "Landes",
        "E": "Eaux",
        "AG": "Terrains d'agrément"

    };


    function nomNatureCulture(
        code,
        speciale
    ) {

        const codeNormalise =
            String(code || "")
                .trim()
                .toUpperCase();

        if (
            speciale &&
            String(speciale).trim()
        ) {

            return escapeHtmlMutation(
                String(speciale).trim()
            );

        }

        return escapeHtmlMutation(
            NATURES_CULTURE[codeNormalise]
            || codeNormalise
            || "Terrain"
        );

    }


    /* =====================================================
       TYPE DE LOCAL
       ===================================================== */

    function nomTypeLocal(
        local
    ) {

        const type =
            String(
                local.type_local || ""
            ).trim();

        if (type) {
            return type;
        }

        const code =
            String(
                local.code_type_local || ""
            ).trim();

        switch (code) {

            case "1":
                return "Maison";

            case "2":
                return "Appartement";

            case "3":
                return "Dépendance";

            case "4":
                return "Local industriel, commercial ou assimilé";

            default:
                return "Local";

        }

    }


    /* =====================================================
       ÉLÉMENTS D'UNE VENTE
       ===================================================== */

    function construireElementsMutation(
        mutation
    ) {

        const locaux =
            Array.isArray(
                mutation.elements_locaux
            )
                ? mutation.elements_locaux
                : [];


        const terrains =
            Array.isArray(
                mutation.elements_terrains
            )
                ? mutation.elements_terrains
                : [];


        let html = "";


        /* -------------------------------------------------
           LOCAUX
           ------------------------------------------------- */

        if (locaux.length) {

            html += `

                <div class="mutation-elements-section">

                    <div class="mutation-elements-title">
                        🏠 Biens bâtis
                    </div>

                    <div class="mutation-elements-list">

                        ${
                            locaux.map(
                                local => {

                                    const type =
                                        escapeHtmlMutation(
                                            nomTypeLocal(
                                                local
                                            )
                                        );

                                    const infos = [];


                                    if (
                                        local.surface_batie !== null &&
                                        local.surface_batie !== undefined &&
                                        local.surface_batie !== ""
                                    ) {

                                        infos.push(
                                            formatSurface(
                                                local.surface_batie
                                            )
                                        );

                                    }


                                    if (
                                        local.nombre_pieces !== null &&
                                        local.nombre_pieces !== undefined &&
                                        local.nombre_pieces !== ""
                                    ) {

                                        infos.push(
                                            formatPieces(
                                                local.nombre_pieces
                                            )
                                        );

                                    }


                                    if (
                                        local.surface_carrez !== null &&
                                        local.surface_carrez !== undefined &&
                                        local.surface_carrez !== ""
                                    ) {

                                        infos.push(
                                            "Carrez " +
                                            formatSurface(
                                                local.surface_carrez
                                            )
                                        );

                                    }


                                    return `

                                        <div class="mutation-element">

                                            <span class="mutation-element-icon">
                                                🏠
                                            </span>

                                            <div class="mutation-element-content">

                                                <div class="mutation-element-name">
                                                    ${type}
                                                </div>

                                                ${
                                                    infos.length
                                                        ? `
                                                            <div class="mutation-element-meta">
                                                                ${infos.join(" · ")}
                                                            </div>
                                                          `
                                                        : ""
                                                }

                                            </div>

                                        </div>

                                    `;

                                }
                            ).join("")
                        }

                    </div>

                </div>

            `;

        }


        /* -------------------------------------------------
           TERRAINS
           ------------------------------------------------- */

        if (terrains.length) {

            html += `

                <div class="mutation-elements-section">

                    <div class="mutation-elements-title">
                        🌱 Terrains
                    </div>

                    <div class="mutation-elements-list">

                        ${
                            terrains.map(
                                terrain => {

                                    const nom =
                                        nomNatureCulture(
                                            terrain.nature_culture,
                                            terrain.nature_culture_speciale
                                        );

                                    const surface =
                                        formatSurface(
                                            terrain.surface_terrain
                                        );


                                    return `

                                        <div class="mutation-element">

                                            <span class="mutation-element-icon">
                                                🌱
                                            </span>

                                            <div class="mutation-element-content">

                                                <div class="mutation-element-name">
                                                    ${nom}
                                                </div>

                                                ${
                                                    surface
                                                        ? `
                                                            <div class="mutation-element-meta">
                                                                ${surface}
                                                            </div>
                                                          `
                                                        : ""
                                                }

                                            </div>

                                        </div>

                                    `;

                                }
                            ).join("")
                        }

                    </div>

                </div>

            `;

        }


        if (!html) {

            html = `

                <div class="mutation-elements-empty">
                    Aucun détail de bien disponible.
                </div>

            `;

        }


        return html;

    }


    /* =====================================================
       UNE MUTATION
       ===================================================== */

    function afficherMutation(
        mutation,
        index
    ) {

        const annee =
            mutation.annee || "";

        const nature =
            nomNatureMutation(
                mutation.nature
            );

        const prix =
            formatPrix(
                mutation.valeur
            );


        return `

            <div
                class="
                    mutation-historique-item
                    ${index === 0 ? "recent" : ""}
                "
            >

                <button
                    type="button"
                    class="mutation-historique-toggle"
                    onclick="
                        this
                            .closest('.mutation-historique-item')
                            .classList
                            .toggle('open')
                    "
                >

                    <span class="mutation-historique-annee">
                        ${escapeHtmlMutation(
                            annee
                        )}
                    </span>


                    <span class="mutation-historique-nature">
                        ${escapeHtmlMutation(
                            nature
                        )}
                    </span>


                    <strong class="mutation-historique-prix">
                        ${prix}
                    </strong>


                    <span class="mutation-chevron">
                        ▾
                    </span>

                </button>


                <div class="mutation-historique-details">

                    ${
                        mutation.date
                            ? `
                                <div class="mutation-details-date">
                                    📅 ${formatDate(
                                        mutation.date
                                    )}
                                </div>
                              `
                            : ""
                    }


                    <div class="mutation-elements">

                        ${construireElementsMutation(
                            mutation
                        )}

                    </div>

                </div>

            </div>

        `;

    }


    /* =====================================================
       TRI HISTORIQUE
       ===================================================== */

    historique.sort(
        (a, b) => {

            const dateA =
                String(
                    a.date || ""
                );

            const dateB =
                String(
                    b.date || ""
                );

            return dateB.localeCompare(
                dateA
            );

        }
    );


    /* =====================================================
       INFORMATIONS PARCELLE
       ===================================================== */

    const commune =
        p.commune ||
        "Commune non renseignée";


    const reference =
        p.reference_parcelle ||
        "Référence non renseignée";


    const section =
        p.section || "";


    const numero =
        p.numero_parcelle || "";


    const adresse =
        p.adresse || "";


    const nbMutations =
        historique.length;


    /* =====================================================
       HISTORIQUE HTML
       ===================================================== */

    const historiqueHtml =
        historique.length

            ? historique
                .map(
                    afficherMutation
                )
                .join("")

            : `

                <div class="mutation-no-history">
                    Aucune mutation enregistrée
                    sur la période 2021–2025.
                </div>

              `;


    /* =====================================================
       FICHE
       ===================================================== */

    ouvrirFiche(`

        <div class="info-header">

            <div class="info-type">
                URBANISME
            </div>


            <div class="info-title">
                Mutation immobilière
            </div>


            <div class="info-subtitle">
                ${escapeHtmlMutation(
                    commune
                )}
            </div>


            ${
                adresse
                    ? `
                        <div class="mutation-address">
                            📍 ${escapeHtmlMutation(
                                adresse
                            )}
                        </div>
                      `
                    : ""
            }


            <div class="mutation-badge">
                🏠 ${nbMutations}
                mutation${nbMutations > 1 ? "s" : ""}
            </div>

        </div>


        <div class="info-body">


            <!-- PARCELLE -->

            <div class="info-section">

                <div class="info-section-title">
                    🌳 Parcelle cadastrale
                </div>


                <div class="info-row">

                    <span class="info-label">
                        Référence
                    </span>

                    <span class="info-value">
                        ${escapeHtmlMutation(
                            reference
                        )}
                    </span>

                </div>


                ${
                    section
                        ? `
                            <div class="info-row">

                                <span class="info-label">
                                    Section
                                </span>

                                <span class="info-value">
                                    ${escapeHtmlMutation(
                                        section
                                    )}
                                </span>

                            </div>
                          `
                        : ""
                }


                ${
                    numero
                        ? `
                            <div class="info-row">

                                <span class="info-label">
                                    Parcelle
                                </span>

                                <span class="info-value">
                                    ${escapeHtmlMutation(
                                        numero
                                    )}
                                </span>

                            </div>
                          `
                        : ""
                }

            </div>


            <!-- HISTORIQUE -->

            <div class="info-section">

                <div class="info-section-title">
                    🏠 Historique des mutations
                </div>


                <div class="mutation-historique">

                    ${historiqueHtml}

                </div>

            </div>


            <div class="mutation-source">

                Données DVF 2021–2025 —
                géométrie cadastrale IGN

            </div>


        </div>

    `);

}

/* =========================================================
   DPE
   ========================================================= */

function escapeHtmlDpe(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* ---------------------------------------------------------
   Couleur selon classe DPE
   --------------------------------------------------------- */

function couleurDpe(classe) {

    switch (
        String(classe || "").toUpperCase()
    ) {

        case "A":
            return "#16834b";

        case "B":
            return "#55a832";

        case "C":
            return "#a8c934";

        case "D":
            return "#f1d333";

        case "E":
            return "#f0a62b";

        case "F":
            return "#e36b2c";

        case "G":
            return "#c9362c";

        default:
            return "#8b9595";

    }

}


/* ---------------------------------------------------------
   Classe DPE avec badge
   --------------------------------------------------------- */

function badgeDpe(classe) {

    const valeur =
        String(classe || "?")
            .toUpperCase();

    return `
        <span
            class="dpe-badge dpe-${escapeHtmlDpe(valeur)}"
        >
            ${escapeHtmlDpe(valeur)}
        </span>
    `;

}


/* ---------------------------------------------------------
   Format nombre
   --------------------------------------------------------- */

function formatDpeNombre(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "Non renseigné";

    }

    const nombre =
        Number(value);

    if (Number.isNaN(nombre)) {

        return escapeHtmlDpe(value);

    }

    return nombre.toLocaleString(
        "fr-FR",
        {
            maximumFractionDigits: 0
        }
    );

}


/* ---------------------------------------------------------
   Format date
   --------------------------------------------------------- */

function formatDpeDate(value) {

    if (!value) {

        return "Non renseignée";

    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return escapeHtmlDpe(value);

    }

    return date.toLocaleDateString(
        "fr-FR"
    );

}


/* ---------------------------------------------------------
   FICHE DPE
   --------------------------------------------------------- */

function ouvrirFicheDpe(
    feature,
    layer
) {

    const p =
        feature.properties || {};


    const classeDpe =
        String(
            p.etiquette_dpe || ""
        ).toUpperCase();


    const classeGes =
        String(
            p.etiquette_ges || ""
        ).toUpperCase();


    const adresse =
        p.adresse ||
        "Adresse non renseignée";


    const commune =
        p.commune ||
        "Commune non renseignée";


    const surface =
        p.surface_habitable;


    const annee =
        p.annee_construction;


    const typeBatiment =
        p.type_batiment;


    ouvrirFiche(`

        <div class="info-header">

            <div class="info-type">
                URBANISME
            </div>


            <div class="info-title">
                Diagnostic de performance énergétique
            </div>


            <div class="info-subtitle">
                ${escapeHtmlDpe(
                    commune
                )}
            </div>


            <div class="dpe-header-badges">

                <div class="dpe-header-classe">

                    <span class="dpe-header-label">
                        Énergie
                    </span>

                    ${badgeDpe(
                        classeDpe
                    )}

                </div>


                <div class="dpe-header-classe">

                    <span class="dpe-header-label">
                        GES
                    </span>

                    <span
                        class="
                            dpe-badge
                            dpe-ges
                            dpe-${escapeHtmlDpe(
                                classeGes
                            )}
                        "
                    >
                        ${escapeHtmlDpe(
                            classeGes || "?"
                        )}
                    </span>

                </div>

            </div>

        </div>


        <div class="info-body">


            <!-- ADRESSE -->

            <div class="info-section">

                <div class="info-section-title">
                    📍 Adresse
                </div>


                <div class="dpe-address">

                    ${escapeHtmlDpe(
                        adresse
                    )}

                </div>

            </div>


            <!-- PERFORMANCE -->

            <div class="info-section">

                <div class="info-section-title">
                    ⚡ Performance énergétique
                </div>


                <div class="dpe-performance">

                    <div class="dpe-performance-card">

                        <div class="dpe-performance-label">
                            Consommation
                        </div>

                        <div class="dpe-performance-value">

                            ${formatDpeNombre(
                                p.consommation
                            )}

                            <small>
                                kWh/m²/an
                            </small>

                        </div>

                    </div>


                    <div class="dpe-performance-card">

                        <div class="dpe-performance-label">
                            Émissions GES
                        </div>

                        <div class="dpe-performance-value">

                            ${formatDpeNombre(
                                p.emissions_ges
                            )}

                            <small>
                                kg CO₂/m²/an
                            </small>

                        </div>

                    </div>

                </div>

            </div>


            <!-- LOGEMENT -->

            <div class="info-section">

                <div class="info-section-title">
                    🏠 Logement
                </div>


                ${
                    typeBatiment
                        ? `
                            <div class="info-row">

                                <span class="info-label">
                                    Type
                                </span>

                                <span class="info-value">
                                    ${escapeHtmlDpe(
                                        typeBatiment
                                    )}
                                </span>

                            </div>
                          `
                        : ""
                }


                ${
                    surface
                        ? `
                            <div class="info-row">

                                <span class="info-label">
                                    Surface
                                </span>

                                <span class="info-value">
                                    ${formatDpeNombre(
                                        surface
                                    )} m²
                                </span>

                            </div>
                          `
                        : ""
                }


                ${
                    annee
                        ? `
                            <div class="info-row">

                                <span class="info-label">
                                    Construction
                                </span>

                                <span class="info-value">
                                    ${escapeHtmlDpe(
                                        annee
                                    )}
                                </span>

                            </div>
                          `
                        : ""
                }


                ${
                    p.periode_construction
                        ? `
                            <div class="info-row">

                                <span class="info-label">
                                    Période
                                </span>

                                <span class="info-value">
                                    ${escapeHtmlDpe(
                                        p.periode_construction
                                    )}
                                </span>

                            </div>
                          `
                        : ""
                }

            </div>


            <!-- CHAUFFAGE -->

            ${
                p.energie_chauffage ||
                p.chauffage ||
                p.energie_ecs ||
                p.ecs

                    ? `

                        <div class="info-section">

                            <div class="info-section-title">
                                🔥 Équipements
                            </div>


                            ${
                                p.energie_chauffage
                                    ? `
                                        <div class="info-row">

                                            <span class="info-label">
                                                Chauffage
                                            </span>

                                            <span class="info-value">
                                                ${escapeHtmlDpe(
                                                    p.energie_chauffage
                                                )}
                                            </span>

                                        </div>
                                      `
                                    : ""
                            }


                            ${
                                p.chauffage
                                    ? `
                                        <div class="info-row">

                                            <span class="info-label">
                                                Installation
                                            </span>

                                            <span class="info-value">
                                                ${escapeHtmlDpe(
                                                    p.chauffage
                                                )}
                                            </span>

                                        </div>
                                      `
                                    : ""
                            }


                            ${
                                p.energie_ecs
                                    ? `
                                        <div class="info-row">

                                            <span class="info-label">
                                                Eau chaude
                                            </span>

                                            <span class="info-value">
                                                ${escapeHtmlDpe(
                                                    p.energie_ecs
                                                )}
                                            </span>

                                        </div>
                                      `
                                    : ""
                            }

                        </div>

                      `

                    : ""
            }


            <!-- DIAGNOSTIC -->

            <div class="info-section">

                <div class="info-section-title">
                    📋 Diagnostic
                </div>


                <div class="info-row">

                    <span class="info-label">
                        N° DPE
                    </span>

                    <span class="info-value">
                        ${escapeHtmlDpe(
                            p.numero_dpe
                        )}
                    </span>

                </div>


                <div class="info-row">

                    <span class="info-label">
                        Réalisé le
                    </span>

                    <span class="info-value">
                        ${formatDpeDate(
                            p.date_etablissement_dpe
                        )}
                    </span>

                </div>
              <a
    class="dpe-ademe-link"
    href="https://observatoire-dpe-audit.ademe.fr/afficher-dpe/${encodeURIComponent(p.numero_dpe)}"
    target="_blank"
    rel="noopener noreferrer"
>
    🔎 Voir ce DPE sur le site de l'ADEME
</a>

            </div>


            <div class="dpe-source">

                Source : ADEME · DPE depuis juillet 2021

            </div>

        </div>

    `);

}
/* =========================================================
   CHARGEMENT DES MUTATIONS
   ========================================================= */

fetch(
    "couches/urbanisme/parcelles_dvf_2021_2025_loir_luce_berce.geojson"
)

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
        "Mutations immobilières :",
        data.features.length,
        "parcelles chargées"
    );


    const coucheMutations =
        L.geoJSON(
            data,
            {

                style: {

                    color: "#8b5e3c",

                    weight: 1,

                    opacity: 0.8,

                    fillColor: "#c89b6d",

                    fillOpacity: 0.28

                },


                onEachFeature:
                    function(
                        feature,
                        layer
                    ) {

                        layer.on(
    "click",
    function() {

        selectionnerParcelleMutation(
            layer
        );

        ouvrirFicheMutation(
            feature,
            layer
        );

    }
);

                    }

            }
        );


    coucheMutations.addTo(
        mutations
    );


    console.log(
        "Mutations dans le groupe :",
        mutations.getLayers().length
    );

})


.catch(error => {

    console.error(
        "Erreur mutations immobilières :",
        error
    );

});

/* =========================================================
   CHARGEMENT DES DPE
   ========================================================= */

fetch(
    "couches/urbanisme/dpe_loir_luce_berce.geojson"
)

.then(response => {

    if (!response.ok) {

        throw new Error(
            `Erreur HTTP DPE : ${response.status}`
        );

    }

    return response.json();

})

.then(data => {

    console.log(
        "DPE :",
        data.features.length,
        "diagnostics chargés"
    );


    const coucheDpe =
        L.geoJSON(
            data,
            {

                pointToLayer:
                    function(
                        feature,
                        latlng
                    ) {

                        const classe =
                            String(
                                feature.properties
                                    ?.etiquette_dpe
                                    || ""
                            ).toUpperCase();


                        const couleur =
                            couleurDpe(
                                classe
                            );


                        return L.circleMarker(
                            latlng,
                            {

                                radius: 7,

                                color: "#ffffff",

                                weight: 2,

                                fillColor:
                                    couleur,

                                fillOpacity: 0.9

                            }
                        );

                    },


                onEachFeature:
                    function(
                        feature,
                        layer
                    ) {

                        layer.on(
                            "click",
                            function() {

                                /*
                                 * Sélection visuelle
                                 */

                                coucheDpe.eachLayer(
                                    autre => {

                                        if (
                                            autre
                                            !== layer
                                        ) {

                                            autre.setStyle({

                                                radius: 7,

                                                weight: 2,

                                                color: "#ffffff",

                                                fillOpacity: 0.9

                                            });

                                        }

                                    }
                                );


                                layer.setStyle({

                                    radius: 10,

                                    weight: 3,

                                    color: "#344a40",

                                    fillOpacity: 1

                                });


                                layer.bringToFront();


                                /*
                                 * Zoom
                                 */

                                map.flyTo(
                                    layer.getLatLng(),
                                    Math.max(
                                        map.getZoom(),
                                        17
                                    ),
                                    {
                                        duration: 0.6
                                    }
                                );


                                ouvrirFicheDpe(
                                    feature,
                                    layer
                                );

                            }
                        );

                    }

            }
        );


    dpe.addLayer(
        coucheDpe
    );


    console.log(
        "Couche DPE prête"
    );

});