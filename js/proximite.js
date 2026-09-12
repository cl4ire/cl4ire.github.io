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
    ouvrirVuePanneau("results-view");
    document.getElementById("results-title").textContent = titre;
}

function fermerResultatsProximite() {
    fermerVuesPanneau();
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
        /* Rouvre la vraie popup (stylée) du marqueur plutôt que d'en
           construire une nouvelle, pauvre, à la volée : voir
           ouvrirPopupIndex (layers.js), qui gère aussi le cas d'un
           marqueur replié dans un cluster. */
        ligne.addEventListener("click", () => ouvrirPopupIndex(map, item));
        liste.appendChild(ligne);
    });
}

/* Charge une couche (si besoin) et coche sa case dans le panneau,
   pour que l'état du panneau reste cohérent avec ce qui est affiché.
   Un échec de chargement (couche en flux distant injoignable) résout
   immédiatement au lieu de laisser l'utilisateur attendre. Le timeout
   n'est qu'un filet de sécurité en dernier recours (il doit rester
   généreux : sur un réseau mobile lent, une requête peut légitimement
   prendre plusieurs secondes avant d'aboutir). */
function chargerEtAfficherCouche(map, layerId) {
    return new Promise(resolve => {
        const conf = LAYERS.find(l => l.id === layerId);
        if (!conf) { resolve(); return; }

        let reglee = false;
        const resoudre = () => { if (!reglee) { reglee = true; resolve(); } };

        chargerCouche(conf, () => {
            if (!map.hasLayer(groupesLeaflet[layerId])) {
                groupesLeaflet[layerId].addTo(map);
            }
            const checkbox = document.getElementById("layer-" + layerId);
            if (checkbox) checkbox.checked = true;
            resoudre();
        }, resoudre);

        setTimeout(resoudre, 20000);
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
            afficherMessageResultats(raccourci.label, "Recherche des résultats les plus proches...");

            Promise.all(raccourci.layerIds.map(id => chargerEtAfficherCouche(map, id))).then(() => {
                /* `filtre` (optionnel) : restreint une couche à une seule
                   sous-catégorie plutôt qu'à la couche entière - ex. "la
                   boulangerie la plus proche" ne doit chercher que parmi
                   les commerces de type "bakery", pas tous les commerces.
                   item.layer.feature : Leaflet attache automatiquement le
                   Feature GeoJSON d'origine à chaque layer d'un L.geoJSON,
                   donc ses propriétés brutes restent accessibles ici sans
                   rien stocker de plus dans l'index de recherche. */
                const resultats = window.indexRecherche
                    .filter(item => raccourci.layerIds.includes(item.layerId))
                    .filter(item => !raccourci.filtre || raccourci.filtre(item))
                    .map(item => ({ ...item, distance: origine.distanceTo(item.latlng) }))
                    .sort((a, b) => a.distance - b.distance)
                    .slice(0, 15);

                map.setView(origine, 13);
                afficherResultatsProximite(map, raccourci.label, resultats);
            });
        },
        erreur => {
            const message = erreur.code === erreur.PERMISSION_DENIED
                ? "Localisation refusée : autorisez la géolocalisation dans les réglages de votre navigateur puis réessayez."
                : "Localisation indisponible pour le moment : réessayez dans un instant.";
            afficherMessageResultats(raccourci.label, message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
}
