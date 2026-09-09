/* =========================================================
   GÉOBERCÉ — RACCOURCIS "PRÈS DE CHEZ MOI"
   Géolocalise l'utilisateur, charge la ou les couches visées
   (RACCOURCIS dans config.js), puis affiche dans le panneau
   les résultats les plus proches, triés par distance. Réutilise
   l'index de recherche déjà alimenté par layers.js.
   ========================================================= */

function formaterDistance(metres) {
    if (metres < 1000) return Math.round(metres) + " m";
    return (metres / 1000).toFixed(1).replace(".", ",") + " km";
}

function couleurRaccourci(raccourci) {
    const conf = LAYERS.find(l => l.id === raccourci.layerIds[0]);
    return (conf && conf.color) || PALETTE.ardoise;
}

function construireRaccourcis(map) {
    const conteneur = document.getElementById("hero-raccourcis");
    conteneur.innerHTML = "";

    RACCOURCIS.forEach(raccourci => {
        const couleur = couleurRaccourci(raccourci);
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "hero-tile";
        bouton.innerHTML = `
            <span class="hero-tile-icon" style="background:${couleur}"><i class="${raccourci.icon}"></i></span>
            <span class="hero-tile-label">${raccourci.label}</span>
        `;
        bouton.addEventListener("click", () => lancerRechercheProximite(map, raccourci));
        conteneur.appendChild(bouton);
    });
}

/* Affiche la vue "résultats" du panneau de couches (masque l'arbre normal) */
function ouvrirVueResultats(titre) {
    document.getElementById("layers-panel").classList.add("layers-panel-open");
    document.getElementById("layers-normal-view").hidden = true;
    document.getElementById("results-view").hidden = false;
    document.getElementById("results-title").textContent = titre;
}

function fermerResultatsProximite() {
    document.getElementById("results-view").hidden = true;
    document.getElementById("layers-normal-view").hidden = false;
}

function afficherMessageResultats(titre, message) {
    ouvrirVueResultats(titre);
    document.getElementById("results-list").innerHTML =
        `<div class="suggestion-vide">${message}</div>`;
}

function afficherResultatsProximite(map, titre, resultats) {
    ouvrirVueResultats(titre + (resultats.length ? ` · ${resultats.length} résultat(s)` : ""));

    const liste = document.getElementById("results-list");
    liste.innerHTML = "";

    if (!resultats.length) {
        liste.innerHTML = `<div class="suggestion-vide">Aucun résultat trouvé à proximité.</div>`;
        return;
    }

    resultats.forEach(item => {
        const ligne = document.createElement("button");
        ligne.type = "button";
        ligne.className = "result-item";
        ligne.innerHTML = `
            <span class="result-item-icon" style="background:${item.color}"><i class="${item.icon}"></i></span>
            <span class="result-item-texte">
                <span class="result-item-titre">${item.titre}</span>
                ${item.sousTitre ? `<span class="result-item-sous">${item.sousTitre}</span>` : ""}
            </span>
            <span class="result-item-distance">${formaterDistance(item.distance)}</span>
        `;
        ligne.addEventListener("click", () => {
            map.setView(item.latlng, 17);
            L.popup()
                .setLatLng(item.latlng)
                .setContent(`<div class="popup-geo"><div class="popup-geo-titre">${item.titre}</div>${item.sousTitre ? `<div class="popup-geo-sous">${item.sousTitre}</div>` : ""}</div>`)
                .openOn(map);
        });
        liste.appendChild(ligne);
    });
}

/* Charge une couche (si besoin) et coche sa case dans le panneau,
   pour que l'état du panneau reste cohérent avec ce qui est affiché.
   Un filet de sécurité (timeout) évite de bloquer indéfiniment
   l'affichage des résultats si le chargement échoue (couche en
   flux distant injoignable, par exemple). */
function chargerEtAfficherCouche(map, layerId) {
    return new Promise(resolve => {
        const conf = LAYERS.find(l => l.id === layerId);
        if (!conf) { resolve(); return; }

        let reglee = false;
        const resoudre = () => { if (!reglee) { reglee = true; resolve(); } };

        chargerCouche(conf, () => {
            if (reglee) return;
            if (!map.hasLayer(groupesLeaflet[layerId])) {
                groupesLeaflet[layerId].addTo(map);
            }
            const checkbox = document.getElementById("layer-" + layerId);
            if (checkbox) checkbox.checked = true;
            resoudre();
        });

        setTimeout(resoudre, 8000);
    });
}

function lancerRechercheProximite(map, raccourci) {
    fermerAccueil();
    afficherMessageResultats(raccourci.label, "Localisation en cours...");

    if (!navigator.geolocation) {
        afficherMessageResultats(raccourci.label, "La géolocalisation n'est pas disponible sur cet appareil.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            const origine = L.latLng(position.coords.latitude, position.coords.longitude);

            Promise.all(raccourci.layerIds.map(id => chargerEtAfficherCouche(map, id))).then(() => {
                const resultats = window.indexRecherche
                    .filter(item => raccourci.layerIds.includes(item.layerId))
                    .map(item => ({ ...item, distance: origine.distanceTo(item.latlng) }))
                    .sort((a, b) => a.distance - b.distance)
                    .slice(0, 15);

                map.setView(origine, 13);
                afficherResultatsProximite(map, raccourci.label, resultats);
            });
        },
        () => {
            afficherMessageResultats(raccourci.label, "Localisation refusée ou indisponible : autorisez la géolocalisation puis réessayez.");
        },
        { timeout: 10000 }
    );
}
