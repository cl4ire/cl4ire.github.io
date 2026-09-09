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
        });

        conteneur.appendChild(details);
    });
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
