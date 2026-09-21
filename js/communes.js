/* =========================================================
   GÉOBERCÉ — DASHBOARD PAR COMMUNE
   Vue du panneau dédiée à une commune du territoire : mairie(s)
   (couches/services/mairies.geojson, déjà en local), chiffres clés
   (couche demographie déjà construite) et actualités Illiwap de la
   commune (iframe chargée à la demande, jamais 24 d'avance).
   ========================================================= */

let mairiesEnCache = null;
function chargerMairies() {
    if (mairiesEnCache) return mairiesEnCache;
    mairiesEnCache = fetch("couches/services/mairies.geojson")
        .then(r => r.ok ? r.json() : { features: [] })
        .then(d => d.features)
        .catch(() => []);
    return mairiesEnCache;
}

let demographieEnCache = null;
function chargerDemographieCommunes() {
    if (demographieEnCache) return demographieEnCache;
    demographieEnCache = fetch("couches/urbanisme/demographie_communes.geojson")
        .then(r => r.ok ? r.json() : { features: [] })
        .then(d => d.features)
        .catch(() => []);
    return demographieEnCache;
}

function mairiesPourCommune(nomCommune) {
    const cible = normaliserNomCommune(nomCommune);
    return chargerMairies().then(features => features.filter(f => normaliserNomCommune(f.properties.commune) === cible));
}

function construireBlocMairie(props) {
    const lignes = [
        props.opening_hours ? `<div class="popup-fiche-ligne"><i class="fa-solid fa-clock"></i> ${echapperHtml(props.opening_hours).replace(/\n/g, "<br>")}</div>` : null,
        props.contact_phone ? `<div class="popup-fiche-ligne"><i class="fa-solid fa-phone"></i> <a href="tel:${echapperHtml(props.contact_phone.replace(/\s+/g, ""))}">${echapperHtml(props.contact_phone)}</a></div>` : null,
        props.contact_email ? `<div class="popup-fiche-ligne"><i class="fa-solid fa-envelope"></i> <a href="mailto:${echapperHtml(props.contact_email)}">${echapperHtml(props.contact_email)}</a></div>` : null,
        props.contact_website ? `<div class="popup-fiche-ligne"><i class="fa-solid fa-globe"></i> <a href="${echapperHtml(props.contact_website)}" target="_blank" rel="noopener">Site internet</a></div>` : null
    ].filter(Boolean);

    return `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-landmark"></i>${echapperHtml(props.name || "Mairie")}</div>
        ${lignes.length ? lignes.join("") : `<div class="popup-fiche-vide">Aucune information disponible.</div>`}
    </div>`;
}

/* demographieFeature n'a que population de fiable pour l'instant (reprise
   de couches/communes.geojson, voir _lisezmoi du fichier) - les autres
   champs (revenu, logements...) restent à fournir, construirePopupDemographie
   (js/popup.js) n'affiche déjà que ce qui est réellement présent. */
function construireDashboardCommune(codeInsee, mairies, demographieFeature) {
    const blocsMairie = mairies.length
        ? mairies.map(m => construireBlocMairie(m.properties)).join("")
        : `<div class="popup-fiche-section"><div class="popup-fiche-vide">Aucune donnée de mairie disponible pour cette commune.</div></div>`;

    const aDesChiffres = demographieFeature && Object.keys(demographieFeature.properties || {}).some(k => typeof demographieFeature.properties[k] === "number");
    const blocDemographie = aDesChiffres ? construirePopupDemographie(demographieFeature.properties) : "";

    return `
        ${blocsMairie}
        ${blocDemographie}
        <div class="popup-fiche-section">
            <div class="popup-fiche-section-titre"><i class="fa-solid fa-bullhorn"></i>Actualités (Illiwap)</div>
            <div class="illiwap-embed">
                <iframe src="${urlIllwapEmbed(codeInsee)}" title="Actualités Illiwap" loading="lazy"></iframe>
            </div>
        </div>
    `;
}

function ouvrirDashboardCommune(map, codeInsee) {
    const nom = COMMUNES_TERRITOIRE[codeInsee];
    if (!nom) return;

    if (typeof zoomerSurCommune === "function") zoomerSurCommune(map, codeInsee);

    document.getElementById("commune-titre").innerHTML = `<i class="fa-solid fa-signs-post"></i> ${echapperHtml(nom)}`;
    document.getElementById("commune-contenu").innerHTML = `<div class="popup-fiche-vide" style="padding:16px 18px;">Chargement...</div>`;
    ouvrirVuePanneau("commune-view");

    Promise.all([mairiesPourCommune(nom), chargerDemographieCommunes()]).then(([mairies, demoFeatures]) => {
        const demoFeature = demoFeatures.find(f => f.properties && f.properties.commune === codeInsee);
        document.getElementById("commune-contenu").innerHTML = construireDashboardCommune(codeInsee, mairies, demoFeature);
    });
}

/* Sélecteur de commune de l'écran d'accueil : une seule liste plutôt que
   24 tuiles (comme les raccourcis thématiques) qui auraient surchargé
   l'accueil pour un usage plus ponctuel. */
function construireSelecteurCommunes(map) {
    const select = document.getElementById("hero-commune-select");
    if (!select) return;

    Object.keys(COMMUNES_TERRITOIRE)
        .sort((a, b) => COMMUNES_TERRITOIRE[a].localeCompare(COMMUNES_TERRITOIRE[b], "fr"))
        .forEach(code => {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = COMMUNES_TERRITOIRE[code];
            select.appendChild(option);
        });

    select.addEventListener("change", () => {
        if (!select.value) return;
        ouvrirDashboardCommune(map, select.value);
        fermerAccueil();
        select.value = "";
    });
}

/* Vue "Actualités" (icône de la barre du haut) : le flux Illiwap de la
   CC elle-même, pour qui reste sur la carte thématique du territoire
   plutôt que de choisir une commune précise. */
function ouvrirVueActu() {
    document.getElementById("actu-iframe").src = urlIllwapEmbed(ILLIWAP_TERRITOIRE);
    ouvrirVuePanneau("actu-view");
}

/* Retire le src de l'iframe en quittant la vue plutôt que de la laisser
   tourner en arrière-plan (masquée via [hidden], pas déchargée pour
   autant) - explicitement demandé par l'utilisatrice ("je ne veux pas
   que ça alourdisse notre carte"). */
function fermerVueActu() {
    /* "about:blank", pas "" : un src vide se résout à l'URL de la page
       courante et ferait recharger index.html dans sa propre iframe. */
    document.getElementById("actu-iframe").src = "about:blank";
    fermerVuesPanneau();
}

function fermerVueCommune() {
    document.getElementById("commune-contenu").innerHTML = "";
    fermerVuesPanneau();
}
