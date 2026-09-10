/* =========================================================
   GÉOBERCÉ — RECHERCHE UNIFIÉE
   Une seule barre : elle interroge à la fois l'API Adresse
   (adresses officielles) et l'index local construit au fil
   du chargement des couches (mairies, boîtes aux lettres,
   assistantes maternelles, commerces...).
   ========================================================= */

function initRecherche(map, { onResultat } = {}) {

    const input = document.getElementById("search");
    const suggestions = document.getElementById("suggestions");
    let marqueurRecherche;
    let timer;

    function rechercheLocale(q) {
        const ql = q.toLowerCase();
        return window.indexRecherche
            .filter(item => item.titre.toLowerCase().includes(ql))
            .slice(0, 5);
    }

    function rechercheAdresse(q) {
        return fetch("https://api-adresse.data.gouv.fr/search/?q=" + encodeURIComponent(q) + "&limit=5")
            .then(r => r.ok ? r.json() : { features: [] })
            .then(d => d.features.map(f => ({
                titre: f.properties.label,
                sousTitre: "Adresse",
                icon: "fa-solid fa-location-dot",
                color: "#5F5E5A",
                latlng: L.latLng(f.geometry.coordinates[1], f.geometry.coordinates[0]),
                estAdresse: true
            })))
            .catch(() => []);
    }

    function afficherResultat(item) {
        if (marqueurRecherche) { map.removeLayer(marqueurRecherche); marqueurRecherche = null; }

        if (item.estAdresse) {
            /* Pas de feature/couche à réutiliser ici (adresse géocodée à
               la volée par l'API Adresse) : un marqueur temporaire avec
               une popup légère, mais dans le même habillage que le
               reste du site plutôt que l'ancien style à part. */
            map.setView(item.latlng, 18);
            marqueurRecherche = L.marker(item.latlng)
                .addTo(map)
                .bindPopup(construirePopupAdresse(item.titre, item.latlng.lat, item.latlng.lng))
                .openPopup();
        } else {
            /* Résultat de l'index local (mairie, commerce...) : rouvre
               la vraie popup, déjà stylée, du marqueur existant plutôt
               que d'en construire une nouvelle par-dessus. */
            ouvrirPopupIndex(map, item);
        }

        suggestions.innerHTML = "";
        input.value = item.titre;

        if (onResultat) onResultat();
    }

    function afficherSuggestions(items) {
        suggestions.innerHTML = "";

        if (!items.length) {
            suggestions.innerHTML = `<div class="suggestion-vide">Aucun résultat</div>`;
            return;
        }

        items.forEach(item => {
            const div = document.createElement("div");
            div.className = "suggestion";
            div.innerHTML = `
                <span class="suggestion-icon" style="color:${item.color}">
                    <i class="${item.icon}"></i>
                </span>
                <span class="suggestion-texte">
                    <span class="suggestion-titre">${item.titre}</span>
                    ${item.sousTitre ? `<span class="suggestion-sous">${item.sousTitre}</span>` : ""}
                </span>
            `;
            div.addEventListener("click", () => afficherResultat(item));
            suggestions.appendChild(div);
        });
    }

    input.addEventListener("input", function () {
        clearTimeout(timer);
        const q = this.value.trim();

        if (q.length < 2) {
            suggestions.innerHTML = "";
            return;
        }

        timer = setTimeout(() => {
            const locaux = rechercheLocale(q);

            rechercheAdresse(q).then(adresses => {
                afficherSuggestions([...locaux, ...adresses].slice(0, 8));
            });

            /* Affiche déjà les résultats locaux pendant que l'API adresse répond */
            if (locaux.length) afficherSuggestions(locaux);

        }, 300);
    });

    document.addEventListener("click", function (event) {
        const conteneur = document.getElementById("search-container");
        if (conteneur && !conteneur.contains(event.target)) {
            suggestions.innerHTML = "";
        }
    });
}
