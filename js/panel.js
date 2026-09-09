/* =========================================================
   GÉOBERCÉ — PANNEAU DE COUCHES
   Généré depuis GROUPS / LAYERS (config.js) : pas besoin
   d'éditer le HTML pour ajouter une couche.
   ========================================================= */

function construirePanneauCouches(map) {
    const conteneur = document.getElementById("layers-tree");
    conteneur.innerHTML = "";

    Object.keys(GROUPS).forEach(groupId => {
        const groupe = GROUPS[groupId];
        const couchesDuGroupe = LAYERS.filter(l => l.group === groupId);
        if (!couchesDuGroupe.length) return;

        const details = document.createElement("details");
        details.className = "layer-group";
        details.open = ["services", "famille"].includes(groupId);

        const summary = document.createElement("summary");
        summary.innerHTML = `
            <span class="layer-group-icon" style="color:${groupe.color}">
                <i class="${groupe.icon}"></i>
            </span>
            <span>${groupe.label}</span>
        `;
        details.appendChild(summary);

        couchesDuGroupe.forEach(conf => {
            const ligne = document.createElement("label");
            ligne.className = "layer-item";
            ligne.dataset.label = conf.label.toLowerCase();

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = "layer-" + conf.id;

            checkbox.addEventListener("change", function () {
                if (checkbox.checked) {
                    chargerCouche(conf, () => groupesLeaflet[conf.id].addTo(map));
                } else if (groupesLeaflet[conf.id]) {
                    map.removeLayer(groupesLeaflet[conf.id]);
                }
            });

            const texte = document.createElement("span");
            texte.textContent = conf.label;
            if (conf.lazy) {
                const badge = document.createElement("span");
                badge.className = "layer-lazy-badge";
                badge.title = "Chargée à la demande (fichier volumineux)";
                badge.textContent = "●";
                texte.appendChild(badge);
            }

            ligne.appendChild(checkbox);
            ligne.appendChild(texte);
            details.appendChild(ligne);

            if (conf.legend) {
                details.appendChild(construireLegende(conf.legend));
            }
        });

        conteneur.appendChild(details);
    });
}

/* Petite légende repliable (icône + couleur par catégorie), affichée
   sous une couche dont la config déclare un tableau "legend". */
function construireLegende(categories) {
    const details = document.createElement("details");
    details.className = "layer-legend";

    const summary = document.createElement("summary");
    summary.textContent = "Voir les catégories";
    details.appendChild(summary);

    const liste = document.createElement("div");
    liste.className = "layer-legend-items";
    categories.forEach(cat => {
        const item = document.createElement("span");
        item.className = "layer-legend-item";
        item.innerHTML = `
            <span class="layer-legend-pastille" style="background:${cat.color}"><i class="${cat.icon}"></i></span>
            <span>${cat.label}</span>
        `;
        liste.appendChild(item);
    });
    details.appendChild(liste);

    return details;
}

/* Filtre texte du panneau */
function initFiltrePanneau() {
    const input = document.getElementById("layers-filter");
    input.addEventListener("input", () => {
        const q = input.value.trim().toLowerCase();
        document.querySelectorAll(".layer-item").forEach(item => {
            item.style.display = item.dataset.label.includes(q) ? "" : "none";
        });
    });
}
