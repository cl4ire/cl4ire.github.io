/* =========================================================
   FAMILLE
   ========================================================= */

let petiteEnfance = L.layerGroup();
let education = L.layerGroup();


/* =========================================================
   UTILITAIRE — ÉCHAPPEMENT HTML
   ========================================================= */

function escapeHtmlFamille(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   UTILITAIRE — TEXTE
   ========================================================= */

function texteFamille(value, defaut = "Non renseigné") {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {

        return defaut;

    }

    return escapeHtmlFamille(
        String(value).trim()
    );

}


/* =========================================================
   PETITE ENFANCE
   ========================================================= */

fetch(
    "couches/famille/petiteEnfance.geojson"
)

.then(response => {

    if (!response.ok) {

        throw new Error(
            `Erreur HTTP petite enfance : ${response.status}`
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
                            icon:
                                iconsSIG.petiteEnfance
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

                            const p =
                                feature.properties || {};


                            const nom =
                                texteFamille(
                                    p.nom,
                                    "Accueil petite enfance"
                                );


                            const type =
                                texteFamille(
                                    p.type,
                                    "Mode d'accueil"
                                );


                            const adresse =
                                texteFamille(
                                    p.adresse
                                );


                            const telephone =
                                p.telephone
                                    ? String(
                                        p.telephone
                                    ).trim()
                                    : "";


                            const mail =
                                p.mail
                                    ? String(
                                        p.mail
                                    ).trim()
                                    : "";


                            const ficheCAF =
                                p.ficheCAF
                                    ? String(
                                        p.ficheCAF
                                    ).trim()
                                    : "";


                            /* =================================
                               TYPE DE STRUCTURE
                               ================================= */

                            let badgeClasse =
                                "famille-badge-neutral";


                            if (
                                String(p.type)
                                    .toLowerCase()
                                    .includes("crèche")
                            ) {

                                badgeClasse =
                                    "famille-badge-creche";

                            }

                            else if (
                                String(p.type)
                                    .toLowerCase()
                                    .includes("relais")
                            ) {

                                badgeClasse =
                                    "famille-badge-relais";

                            }

                            else if (
                                String(p.type)
                                    .toLowerCase()
                                    .includes("assistant")
                            ) {

                                badgeClasse =
                                    "famille-badge-assistant";

                            }


                            ouvrirFiche(`

                                <div class="info-header">

                                    <div class="info-type">
                                        FAMILLE
                                    </div>


                                    <div class="info-title">
                                        ${nom}
                                    </div>

                                    <div
                                        class="
                                            famille-badge
                                            ${badgeClasse}
                                        "
                                    >
                                        👶 ${type}
                                    </div>

                                </div>


                                <div class="info-body">


                                    <!-- =========================
                                         LOCALISATION
                                         ========================= -->

                                    <div class="info-section">

                                        <div class="info-section-title">
                                            📍 Localisation
                                        </div>


                                        <div class="info-row">

                                            <span class="info-label">
                                                Adresse
                                            </span>


                                            <span class="info-value">
                                                ${adresse}
                                            </span>

                                        </div>

                                    </div>


                                    <!-- =========================
                                         CONTACT
                                         ========================= -->

                                    <div class="info-section">

                                        <div class="info-section-title">
                                            Contact
                                        </div>


                                        ${
                                            telephone
                                                ? `

                                                    <div
                                                        class="
                                                            info-row
                                                        "
                                                    >

                                                        <span
                                                            class="
                                                                info-label
                                                            "
                                                        >
                                                            ☎ Téléphone
                                                        </span>


                                                        <a
                                                            href="tel:${escapeHtmlFamille(telephone)}"
                                                            class="
                                                                info-value
                                                                famille-link
                                                            "
                                                        >
                                                            ${escapeHtmlFamille(
                                                                telephone
                                                            )}
                                                        </a>

                                                    </div>

                                                  `
                                                : ""
                                        }


                                        ${
                                            mail
                                                ? `

                                                    <div
                                                        class="
                                                            info-row
                                                        "
                                                    >

                                                        <span
                                                            class="
                                                                info-label
                                                            "
                                                        >
                                                            ✉ Email
                                                        </span>


                                                        <a
                                                            href="mailto:${escapeHtmlFamille(mail)}"
                                                            class="
                                                                info-value
                                                                famille-link
                                                            "
                                                        >
                                                            ${escapeHtmlFamille(
                                                                mail
                                                            )}
                                                        </a>

                                                    </div>

                                                  `
                                                : ""
                                        }


                                        ${
                                            !telephone &&
                                            !mail

                                                ? `

                                                    <div
                                                        class="
                                                            info-description
                                                        "
                                                    >
                                                        Aucun contact
                                                        renseigné.
                                                    </div>

                                                  `

                                                : ""
                                        }

                                    </div>


                                    <!-- =========================
                                         FICHE CAF
                                         ========================= -->

                                    ${
                                        ficheCAF
                                            ? `

                                                <div
                                                    class="
                                                        famille-action
                                                    "
                                                >

                                                    <a
                                                        href="${escapeHtmlFamille(ficheCAF)}"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="
                                                            famille-caf-link
                                                        "
                                                    >
                                                        👶 Voir la fiche
                                                        officielle
                                                        sur monenfant.fr ↗
                                                    </a>

                                                </div>

                                              `
                                            : ""
                                    }


                                </div>

                            `);

                        }
                    );

                }

        }
    )
    .addTo(
        petiteEnfance
    );


    console.log(
        "Petite enfance :",
        data.features.length,
        "structures chargées"
    );

})


.catch(error => {

    console.error(
        "Erreur lors du chargement de la petite enfance :",
        error
    );

});


/* =========================================================
   ÉDUCATION
   ========================================================= */

fetch(
    "couches/famille/education.geojson"
)

.then(response => {

    if (!response.ok) {

        throw new Error(
            `Erreur HTTP éducation : ${response.status}`
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
                            icon:
                                iconsSIG.education
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

                            const p =
                                feature.properties || {};


                            /*
                             * Certains objets n'ont pas de nom.
                             * Dans ce cas on construit un titre
                             * à partir du type et de la commune.
                             */

                            const type =
                                p.type_fr ||
                                "Établissement scolaire";


                            const commune =
                                p.com_nom ||
                                "";


                            const nom =
                                p.name ||
                                `${type}${commune ? ` — ${commune}` : ""}`;


                            const statut =
                                p.statut;


                            const refUAI =
                                p.ref_uai;


                            const wikidata =
                                p.wikidata;


                            /* =================================
                               BADGE STATUT
                               ================================= */

                            const statutTexte =
                                statut === "public"
                                    ? "Public"
                                    : statut === "private"
                                        ? "Privé"
                                        : "Statut non renseigné";


                            const statutClasse =
                                statut === "public"
                                    ? "famille-badge-public"
                                    : statut === "private"
                                        ? "famille-badge-prive"
                                        : "famille-badge-neutral";


                            ouvrirFiche(`

                                <div class="info-header">

                                    <div class="info-type">
                                        FAMILLE
                                    </div>


                                    <div class="info-title">
                                        ${escapeHtmlFamille(
                                            nom
                                        )}
                                    </div>

                                    <div
                                        class="
                                            famille-badges
                                        "
                                    >

                                        <span
                                            class="
                                                famille-badge
                                                famille-badge-education
                                            "
                                        >
                                            🎓 ${escapeHtmlFamille(
                                                type
                                            )}
                                        </span>


                                        <span
                                            class="
                                                famille-badge
                                                ${statutClasse}
                                            "
                                        >
                                            ${escapeHtmlFamille(
                                                statutTexte
                                            )}
                                        </span>

                                    </div>

                                </div>


                                <div class="info-body">


                                    <!-- =========================
                                         ÉTABLISSEMENT
                                         ========================= -->

                                    <div class="info-section">

                                        <div class="info-section-title">
                                            🏫 Établissement
                                        </div>


                                        <div class="info-row">

                                            <span class="info-label">
                                                Type
                                            </span>


                                            <span class="info-value">
                                                ${texteFamille(
                                                    type
                                                )}
                                            </span>

                                        </div>


                                        <div class="info-row">

                                            <span class="info-label">
                                                Commune
                                            </span>


                                            <span class="info-value">
                                                ${texteFamille(
                                                    commune
                                                )}
                                            </span>

                                        </div>


                                        ${
                                            statut
                                                ? `

                                                    <div
                                                        class="
                                                            info-row
                                                        "
                                                    >

                                                        <span
                                                            class="
                                                                info-label
                                                            "
                                                        >
                                                            Statut
                                                        </span>


                                                        <span
                                                            class="
                                                                info-value
                                                            "
                                                        >
                                                            ${escapeHtmlFamille(
                                                                statutTexte
                                                            )}
                                                        </span>

                                                    </div>

                                                  `
                                                : ""
                                        }

                                    </div>


                                    <!-- =========================
                                         IDENTIFICATION
                                         ========================= -->

                                    ${
                                        refUAI ||
                                        wikidata
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
                                                        Identification
                                                    </div>


                                                    ${
                                                        refUAI
                                                            ? `

                                                                <div
                                                                    class="
                                                                        info-row
                                                                    "
                                                                >

                                                                    <span
                                                                        class="
                                                                            info-label
                                                                        "
                                                                    >
                                                                        Référence UAI
                                                                    </span>


                                                                    <span
                                                                        class="
                                                                            info-value
                                                                        "
                                                                    >
                                                                        ${escapeHtmlFamille(
                                                                            refUAI
                                                                        )}
                                                                    </span>

                                                                </div>

                                                              `
                                                            : ""
                                                    }


                                                    ${
                                                        wikidata
                                                            ? `

                                                                <div
                                                                    class="
                                                                        info-row
                                                                    "
                                                                >

                                                                    <span
                                                                        class="
                                                                            info-label
                                                                        "
                                                                    >
                                                                        Wikidata
                                                                    </span>


                                                                    <a
                                                                        href="https://www.wikidata.org/wiki/${escapeHtmlFamille(wikidata)}"
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        class="
                                                                            info-value
                                                                            famille-link
                                                                        "
                                                                    >
                                                                        ${escapeHtmlFamille(
                                                                            wikidata
                                                                        )} ↗
                                                                    </a>

                                                                </div>

                                                              `
                                                            : ""
                                                    }

                                                </div>

                                              `
                                            : ""
                                    }


                                </div>

                            `);

                        }
                    );

                }

        }
    )
    .addTo(
        education
    );


    console.log(
        "Éducation :",
        data.features.length,
        "établissements chargés"
    );

})


.catch(error => {

    console.error(
        "Erreur lors du chargement de l'éducation :",
        error
    );

});