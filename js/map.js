/* =========================================================
   GÉOBERCÉ — CARTE PRINCIPALE
   ========================================================= */

/* ---------- 1. Carte + fond de carte ---------- */
const map = L.map("map", { zoomControl: false }).setView([47.791528, 0.412223], 12);

L.control.zoom({ position: "topright" }).addTo(map);

L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_33ph_1_a60cba5d2b6752f8d0e80255", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 20
}).addTo(map);

L.control.locate({ position: "topright", flyTo: true, keepCurrentZoomLevel: false }).addTo(map);


/* ---------- 2. Couches de référence (limites communes / EPCI) ---------- */
fetch("couches/epci.geojson")
    .then(r => r.json())
    .then(data => {
        L.geoJSON(data, { style: { color: PALETTE.riviere, weight: 2, fill: false, dashArray: "4 3" } }).addTo(map);
    })
    .catch(err => console.error("epci.geojson :", err));

/* couchesCommunesParInsee : une entrée par commune (code_insee -> layer
   Leaflet), remplie une fois le fetch résolu - sert à zoomer sur la bonne
   commune depuis le dashboard (js/communes.js), sélecteur d'accueil ou
   clic sur la carte, sans reparser le fichier à chaque fois. */
const couchesCommunesParInsee = {};

fetch("couches/communes.geojson")
    .then(r => r.json())
    .then(data => {
        L.geoJSON(data, {
            /* fillOpacity quasi nulle plutôt que fill:false : un contour
               sans remplissage ne capte les clics que tout près du trait
               chez Leaflet, pas au milieu de la commune - au clic, comme
               partout ailleurs sur le site, un marqueur/élément par-dessus
               (mairie, commerce...) qui a déjà son propre gestionnaire de
               clic (bindPopup) intercepte l'événement avant qu'il
               n'atteigne ce contour, donc pas de conflit à gérer nous-
               mêmes : ce clic ne se déclenche que sur une zone vide. */
            style: { color: PALETTE.ardoise, weight: 1, fillOpacity: 0.02, fillColor: "#ffffff", opacity: 0.5 },
            onEachFeature: (feature, layer) => {
                const code = feature.properties && feature.properties.code_insee;
                if (!code || !COMMUNES_TERRITOIRE[code]) return;
                couchesCommunesParInsee[code] = layer;
                layer.on("click", () => ouvrirDashboardCommune(map, code));
                layer.on("mouseover", () => layer.setStyle({ weight: 2 }));
                layer.on("mouseout", () => layer.setStyle({ weight: 1 }));
            }
        }).addTo(map);
    })
    .catch(err => console.error("communes.geojson :", err));

function zoomerSurCommune(map, codeInsee) {
    const layer = couchesCommunesParInsee[codeInsee];
    if (layer) map.fitBounds(layer.getBounds(), { maxZoom: 14 });
}


/* ---------- 3. Couches de données, panneau, recherche, accueil ---------- */
initialiserCouches(map);
surveillerAffichageCouches(map);
construirePanneauCouches(map);
initFiltrePanneau();
construireEcranAccueil(map);
construireRaccourcis(map);
construireSelecteurCommunes(map);
initHeroParcelle(map);
demarrerVisiteSiPremiereFois();

initRecherche(map, {
    onResultat: () => {
        const hero = document.getElementById("hero");
        if (hero && !hero.classList.contains("hero-hidden")) fermerAccueil();
    }
});


/* ---------- 4. Interactions d'interface ---------- */
/* Deux classes pour un seul état, chacune lue par un mécanisme d'affichage
   différent selon la largeur d'écran : "layers-panel-open" pilote le
   glissement hors-champ sur mobile (transform, voir la media query dans
   style.css), "layers-panel-hidden" pilote la disparition/réapparition
   sur PC (display:none, où le panneau prenait toute la place en
   permanence avant - retour direct de l'utilisatrice). Basculées
   ensemble, toujours en opposition l'une de l'autre, plutôt que de
   deviner la largeur d'écran actuelle en JS : chaque règle CSS ignore
   simplement la classe qui ne la concerne pas. */
function panneauEstOuvert() {
    /* "Ouvert" n'a pas le même signal selon la largeur d'écran : sur mobile,
       le panneau est fermé par défaut (absence de "layers-panel-open", hors
       champ via transform) ; sur PC, il est ouvert par défaut (absence de
       "layers-panel-hidden", display normal). Comme aucune des deux classes
       n'est posée au chargement de la page, se fier uniquement à
       "layers-panel-open" fait rater le tout premier clic sur PC (le
       panneau semblait déjà "ouvert" faute de classe, donc rien ne se
       repliait) - d'où la vérification adaptée à la largeur d'écran ici. */
    const panel = document.getElementById("layers-panel");
    if (window.matchMedia("(max-width: 780px)").matches) {
        return panel.classList.contains("layers-panel-open");
    }
    return !panel.classList.contains("layers-panel-hidden");
}

function togglerPanneauCouches(forcerOuvert) {
    const panel = document.getElementById("layers-panel");
    const seraOuvert = forcerOuvert !== undefined ? forcerOuvert : !panneauEstOuvert();
    panel.classList.toggle("layers-panel-open", seraOuvert);
    panel.classList.toggle("layers-panel-hidden", !seraOuvert);
    /* Sur PC, la carte reprend immédiatement l'espace libéré (#map est
       flex:1 juste à côté) : Leaflet ne redétecte pas seul un
       changement de taille de son conteneur, invalidateSize() le force
       à recalculer/redessiner les tuiles sur la nouvelle largeur. Sans
       effet notable sur mobile (le panneau y est en position absolute,
       la carte ne change pas réellement de taille), mais un appel de
       plus ne coûte rien. */
    map.invalidateSize();
}

document.getElementById("menu-button").addEventListener("click", () => togglerPanneauCouches());
document.getElementById("layers-close").addEventListener("click", () => togglerPanneauCouches(false));

document.getElementById("actu-button").addEventListener("click", () => toggleActuDropdown());
document.getElementById("actu-dropdown-close").addEventListener("click", () => toggleActuDropdown(false));
document.addEventListener("click", event => {
    const wrap = document.querySelector(".actu-wrap");
    if (wrap && !wrap.contains(event.target) && !document.getElementById("actu-dropdown").hidden) {
        toggleActuDropdown(false);
    }
});

document.getElementById("commune-back").addEventListener("click", fermerVueCommune);

document.getElementById("about-button").addEventListener("click", () => {
    document.getElementById("about-modal").classList.add("modal-open");
});

document.getElementById("about-close").addEventListener("click", () => {
    document.getElementById("about-modal").classList.remove("modal-open");
});

document.getElementById("tour-relancer").addEventListener("click", () => {
    document.getElementById("about-modal").classList.remove("modal-open");
    demarrerVisiteGuidee();
});

/* Formulaire de contact (bugs/idées) : pas de backend sur un site 100%
   statique GitHub Pages, donc pas de serveur mail à nous - Web3Forms
   reçoit la requête et fait l'envoi réel à notre place (clé liée à
   swallowage@proton.me, pas de compte/mot de passe à gérer côté site).
   Remplace l'ancien lien mailto, qui ouvrait le client mail du visiteur
   au lieu d'envoyer directement - retour direct de l'utilisatrice. */
const EMAIL_CONTACT = "swallowage@proton.me";
const WEB3FORMS_ACCESS_KEY = "f8e3cf6f-6ad8-42dd-b403-1ad9728373f6";
document.getElementById("contact-envoyer").addEventListener("click", () => {
    const bouton = document.getElementById("contact-envoyer");
    const statut = document.getElementById("contact-statut");
    const type = document.getElementById("contact-type").value;
    const message = document.getElementById("contact-message").value.trim();

    if (!message) {
        statut.textContent = "Merci de décrire votre message avant l'envoi.";
        statut.className = "contact-statut contact-statut-erreur";
        return;
    }

    const sujet = type === "bug" ? "[GéoBercé] Signalement de bug" : "[GéoBercé] Proposition d'idée";
    bouton.disabled = true;
    statut.textContent = "Envoi en cours...";
    statut.className = "contact-statut";

    fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
            access_key: WEB3FORMS_ACCESS_KEY,
            subject: sujet,
            type: type === "bug" ? "Bug" : "Idée",
            message
        })
    })
        .then(r => r.json())
        .then(data => {
            if (!data.success) throw new Error(data.message || "Échec de l'envoi");
            statut.textContent = "Message envoyé, merci !";
            statut.className = "contact-statut contact-statut-succes";
            document.getElementById("contact-message").value = "";
        })
        .catch(() => {
            statut.textContent = `L'envoi a échoué. Réessayez, ou écrivez-nous directement à ${EMAIL_CONTACT}.`;
            statut.className = "contact-statut contact-statut-erreur";
        })
        .finally(() => { bouton.disabled = false; });
});

document.getElementById("home-button").addEventListener("click", () => {
    fermerResultatsProximite();
    ouvrirAccueil();
});

document.getElementById("results-back").addEventListener("click", fermerResultatsProximite);

document.getElementById("recherche-button").addEventListener("click", () => ouvrirRecherche(map));
document.getElementById("recherche-back").addEventListener("click", fermerVuesPanneau);
