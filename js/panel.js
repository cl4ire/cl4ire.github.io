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
                details.appendChild(construireLegende(conf, map));
            }
        });

        conteneur.appendChild(details);
    });
}

/* Petite légende repliable (icône + couleur par catégorie), affichée
   sous une couche dont la config déclare un tableau "legend". Chaque
   catégorie a sa propre case à cocher : avec beaucoup de données (ex :
   commerces), ça permet de n'afficher que certaines catégories plutôt
   que de tout charger d'un bloc. Repose sur layerConf.categoriser côté
   layers.js, qui construit une sous-couche Leaflet par catégorie. */
function construireLegende(conf, map) {
    const categories = (conf.legend || []).concat(conf.legendDefaut ? [conf.legendDefaut] : []);

    const details = document.createElement("details");
    details.className = "layer-legend";

    const summary = document.createElement("summary");
    summary.textContent = "Voir les catégories";
    details.appendChild(summary);

    const liste = document.createElement("div");
    liste.className = "layer-legend-items";

    categories.forEach(cat => {
        const item = document.createElement("label");
        item.className = "layer-legend-item";
        item.innerHTML = `
            <input type="checkbox" checked>
            <span class="layer-legend-pastille" style="background:${cat.color}"><i class="${cat.icon}"></i></span>
            <span>${cat.label}</span>
        `;

        item.querySelector("input").addEventListener("change", function () {
            const couche = (souscouchesLeaflet[conf.id] || {})[cat.id];
            if (!couche) return;
            if (this.checked) {
                map.addLayer(couche);
            } else {
                map.removeLayer(couche);
            }
        });

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
