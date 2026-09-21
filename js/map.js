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

fetch("couches/communes.geojson")
    .then(r => r.json())
    .then(data => {
        L.geoJSON(data, { style: { color: PALETTE.ardoise, weight: 1, fill: false, opacity: 0.5 } }).addTo(map);
    })
    .catch(err => console.error("communes.geojson :", err));


/* ---------- 3. Couches de données, panneau, recherche, accueil ---------- */
initialiserCouches(map);
surveillerAffichageCouches(map);
construirePanneauCouches(map);
initFiltrePanneau();
construireEcranAccueil(map);
construireRaccourcis(map);

initRecherche(map, {
    onResultat: () => {
        const hero = document.getElementById("hero");
        if (hero && !hero.classList.contains("hero-hidden")) fermerAccueil();
    }
});


/* ---------- 4. Interactions d'interface ---------- */
document.getElementById("menu-button").addEventListener("click", () => {
    document.getElementById("layers-panel").classList.toggle("layers-panel-open");
});

document.getElementById("layers-close").addEventListener("click", () => {
    document.getElementById("layers-panel").classList.remove("layers-panel-open");
});

document.getElementById("about-button").addEventListener("click", () => {
    document.getElementById("about-modal").classList.add("modal-open");
});

document.getElementById("about-close").addEventListener("click", () => {
    document.getElementById("about-modal").classList.remove("modal-open");
});

/* Formulaire de contact (bugs/idées) : pas de backend sur un site 100%
   statique GitHub Pages, donc pas de vrai envoi depuis la page - le
   bouton construit un lien mailto (type + message pré-remplis en sujet/
   corps) et laisse le client mail du visiteur gérer l'envoi réel, comme
   n'importe quel lien "contactez-nous" d'un site statique. */
const EMAIL_CONTACT = "swallowage@proton.me";
document.getElementById("contact-envoyer").addEventListener("click", () => {
    const type = document.getElementById("contact-type").value;
    const message = document.getElementById("contact-message").value.trim();
    const sujet = type === "bug" ? "[GéoBercé] Signalement de bug" : "[GéoBercé] Proposition d'idée";
    const corps = message || "(décrivez ici votre message)";
    window.location.href = `mailto:${EMAIL_CONTACT}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
});

document.getElementById("home-button").addEventListener("click", () => {
    fermerResultatsProximite();
    ouvrirAccueil();
});

document.getElementById("results-back").addEventListener("click", fermerResultatsProximite);

document.getElementById("recherche-button").addEventListener("click", () => ouvrirRecherche(map));
document.getElementById("recherche-back").addEventListener("click", fermerVuesPanneau);
