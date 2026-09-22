/* =========================================================
   GÉOBERCÉ — DASHBOARD PAR COMMUNE
   Page plein écran dédiée à une commune du territoire (#commune-page,
   index.html - retour direct de l'utilisatrice : trop à l'étroit dans
   la colonne du panneau des couches une fois enrichi) : mairie(s)
   (couches/services/mairies.geojson, déjà en local), chiffres clés
   (couche demographie déjà construite), décompte d'entités locales,
   qualité de l'eau potable (Hub'Eau) et actualités Illiwap de la
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

/* =========================================================
   QUALITÉ DE L'EAU POTABLE (Hub'Eau)
   Retour direct de l'utilisatrice : compléter le dashboard commune
   avec une info du quotidien en plus des chiffres statiques. Hub'Eau
   ("Qualité de l'eau potable", api/v1/qualite_eau_potable/resultats_dis)
   est une API publique pensée pour la réutilisation externe (contrairement
   à Vigicrues, retiré plus haut pour blocage CORS) - schéma confirmé en
   conditions réelles par l'utilisatrice (résultat réel pour la commune
   72071/Montval-sur-Loir, collé depuis un onglet ouvert directement sur
   l'API).
   Une seule requête (size=1, sort=desc) suffit : chaque ligne porte déjà
   conclusion_conformite_prelevement, une phrase de synthèse pour TOUT le
   prélèvement (pas juste le paramètre de cette ligne - répétée sur
   chacune de ses lignes, vérifié dans l'exemple réel), donc la plus
   récente ligne toutes couches confondues donne directement le dernier
   verdict sans avoir à tout agréger côté client. */
const URL_HUBEAU_EAU_POTABLE = "https://hubeau.eaufrance.fr/api/v1/qualite_eau_potable/resultats_dis";
const qualiteEauEnCache = {}; // code_insee -> Promise
function chargerQualiteEauCommune(codeInsee) {
    if (qualiteEauEnCache[codeInsee]) return qualiteEauEnCache[codeInsee];
    const url = `${URL_HUBEAU_EAU_POTABLE}?code_commune=${codeInsee}&size=1&sort=desc`;
    qualiteEauEnCache[codeInsee] = fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(d => (d && d.data && d.data[0]) || null)
        .catch(() => null);
    return qualiteEauEnCache[codeInsee];
}

/* Classement conforme/non conforme par mot-clé sur la phrase de
   conclusion plutôt qu'une valeur d'énumération figée (comme pour
   Vigieau) : seule "C" (conforme) a été confirmée en conditions
   réelles pour conformite_limites_bact_prelevement/
   conformite_limites_pc_prelevement, la ou les valeurs de non-
   conformité ne le sont pas - la phrase reste lisible et fiable dans
   les deux cas. */
function construireBlocQualiteEau(resultat) {
    if (!resultat || !resultat.conclusion_conformite_prelevement) return "";
    const nonConforme = /non\s+conforme/i.test(resultat.conclusion_conformite_prelevement);
    const couleur = nonConforme ? PALETTE.terracotta : PALETTE.feuille;
    const reseau = resultat.reseaux && resultat.reseaux[0] && resultat.reseaux[0].nom;
    const precisions = [
        reseau ? `Réseau ${reseau}` : null,
        resultat.date_prelevement ? `dernier contrôle le ${formaterDateSeule(resultat.date_prelevement)}` : null
    ].filter(Boolean).join(" · ");

    return `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-droplet" style="color:${couleur}"></i>Qualité de l'eau potable</div>
        <div class="popup-fiche-ligne">${echapperHtml(resultat.conclusion_conformite_prelevement)}</div>
        ${precisions ? `<div class="popup-fiche-precision">${echapperHtml(precisions)}</div>` : ""}
    </div>`;
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

/* =========================================================
   DÉCOMPTE D'ENTITÉS PAR COMMUNE
   Retour direct de l'utilisatrice : compléter le dashboard avec un
   décompte ("1 boulangerie, 1 banque, 2 assistantes maternelles, 2
   écoles...") plutôt que de laisser deviner ce qui existe sur la
   commune. Aucune donnée externe : tout est déjà chargé au démarrage du
   site (les six couches ci-dessous sont toutes lazy:false, voir
   config.js) - un simple comptage sur donneesBrutes, pas un nouvel
   appel réseau.
   La plupart des couches portent déjà com_insee (filtrage direct) ;
   petiteEnfance n'a pas ce champ dans la donnée source, d'où
   parGeometrie (test point-dans-polygone via pointDansFeature, déjà
   utilisé par la recherche foncière, sur le contour de la commune
   chargé dans couchesCommunesParInsee, js/map.js).
   grouper (optionnel) éclate le total en sous-catégories plutôt qu'un
   seul chiffre par couche - correspond au niveau de détail demandé
   ("1 boulangerie" et pas juste "5 commerces"). Sans grouper, une seule
   ligne pour toute la couche (ex. Aires de jeux).
   LABELS_TYPE_ECOLE : réutilise la constante déjà définie dans
   js/popup.js pour construirePopupEcole, pas de doublon. */
const COUCHES_DECOMPTE_COMMUNE = [
    { id: "commerces", icon: "fa-solid fa-basket-shopping", grouper: f => categorieCommerce(f.properties.type).label },
    { id: "banques", icon: "fa-solid fa-money-bill-wave", grouper: f => f.properties.type === "atm" ? "Distributeur (DAB)" : "Agence bancaire" },
    { id: "education", icon: "fa-solid fa-graduation-cap", grouper: f => LABELS_TYPE_ECOLE[f.properties.type_fr] || "École" },
    { id: "petiteEnfance", icon: "fa-solid fa-baby", parGeometrie: true, grouper: f => f.properties.type || "Petite enfance" },
    { id: "equipementSportif", icon: "fa-solid fa-futbol", grouper: f => labelSport(f.properties.sport) || "Équipement sportif" },
    { id: "airesJeu", icon: "fa-solid fa-child-reaching", label: "Aires de jeux" }
];

function featuresCommune(conf, codeInsee) {
    const donnees = donneesBrutes[conf.id] || [];
    /* String(...) plutôt qu'une égalité stricte : com_insee est une chaîne
       dans certains fichiers (commerces, education...) mais un nombre JSON
       dans d'autres (banques, airesJeu) - vérifié en conditions réelles,
       pas une supposition. Une comparaison stricte aurait silencieusement
       filtré ces couches à zéro résultat partout. */
    if (!conf.parGeometrie) return donnees.filter(f => f.properties && String(f.properties.com_insee) === codeInsee);

    const communeFeature = (typeof couchesCommunesParInsee !== "undefined" && couchesCommunesParInsee[codeInsee]) ? couchesCommunesParInsee[codeInsee].feature : null;
    if (!communeFeature) return [];
    return donnees.filter(f => f.geometry && f.geometry.type === "Point" && pointDansFeature(f.geometry.coordinates, communeFeature));
}

/* Liste à plat (pas groupée par couche) : une ligne par sous-catégorie
   trouvée, triée par effectif décroissant au sein de chaque couche -
   c'est ce qui s'affiche tel quel dans le dashboard, dans l'ordre de
   COUCHES_DECOMPTE_COMMUNE. */
function decompteEntitesCommune(codeInsee) {
    const lignes = [];
    COUCHES_DECOMPTE_COMMUNE.forEach(conf => {
        const features = featuresCommune(conf, codeInsee);
        if (!features.length) return;
        if (!conf.grouper) {
            lignes.push({ icon: conf.icon, label: conf.label, n: features.length });
            return;
        }
        const compte = {};
        features.forEach(f => {
            const cle = conf.grouper(f);
            compte[cle] = (compte[cle] || 0) + 1;
        });
        Object.keys(compte).sort((a, b) => compte[b] - compte[a])
            .forEach(cle => lignes.push({ icon: conf.icon, label: cle, n: compte[cle] }));
    });
    return lignes;
}

function construireBlocDecompte(codeInsee) {
    const lignes = decompteEntitesCommune(codeInsee);
    if (!lignes.length) return "";
    return `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-list-check"></i>En chiffres sur la commune</div>
        ${lignes.map(l => `<div class="popup-fiche-jour"><span><i class="${l.icon}"></i> ${echapperHtml(l.label)}</span><strong>${l.n}</strong></div>`).join("")}
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
    const blocDecompte = construireBlocDecompte(codeInsee);

    return `
        ${blocsMairie}
        ${blocDemographie}
        ${blocDecompte}
        <div id="commune-qualite-eau"><!-- Rempli séparément une fois Hub'Eau résolu, voir ouvrirDashboardCommune --></div>
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
    document.getElementById("commune-page").hidden = false;

    /* Hub'Eau (qualité de l'eau) démarré tout de suite, en parallèle du
       Promise.all ci-dessous, pour ne pas perdre de temps - mais
       #commune-qualite-eau (créé par construireDashboardCommune) n'existe
       pas encore dans le DOM à cet instant : le remplissage est donc
       chaîné APRÈS l'affichage du contenu principal plutôt que sur cette
       promesse directement, sinon une réponse Hub'Eau plus rapide que la
       lecture des fichiers locaux (cas limite, improbable mais possible)
       chercherait un élément qui n'existe pas encore et perdrait
       silencieusement le résultat. Le reste du dashboard ne l'attend
       jamais pour s'afficher : c'est un appel réseau externe, latence/
       fiabilité imprévisibles, contrairement à mairies/démographie qui ne
       font que lire des fichiers locaux du dépôt. */
    const promesseQualiteEau = chargerQualiteEauCommune(codeInsee);

    Promise.all([mairiesPourCommune(nom), chargerDemographieCommunes()]).then(([mairies, demoFeatures]) => {
        const demoFeature = demoFeatures.find(f => f.properties && f.properties.commune === codeInsee);
        document.getElementById("commune-contenu").innerHTML = construireDashboardCommune(codeInsee, mairies, demoFeature);
        promesseQualiteEau.then(resultat => {
            const cible = document.getElementById("commune-qualite-eau");
            if (cible) cible.innerHTML = construireBlocQualiteEau(resultat);
        });
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

/* "Actualités" (icône de la barre du haut) : le flux Illiwap de la CC
   elle-même, pour qui reste sur la carte thématique du territoire
   plutôt que de choisir une commune précise. En menu déroulant ancré
   sous l'icône plutôt que dans le panneau des couches (comme la vue
   par commune, restée telle quelle) - retour direct de l'utilisatrice,
   ça n'a pas besoin de prendre la place de tout le panneau pour un
   simple coup d'œil aux actus du territoire. */
function toggleActuDropdown(forcerOuvert) {
    const dropdown = document.getElementById("actu-dropdown");
    const seraOuvert = forcerOuvert !== undefined ? forcerOuvert : dropdown.hidden;
    dropdown.hidden = !seraOuvert;
    /* "about:blank", pas "" : un src vide se résout à l'URL de la page
       courante et ferait recharger index.html dans sa propre iframe.
       Vidée à la fermeture plutôt que laissée tourner en arrière-plan
       (masquée via [hidden], pas déchargée pour autant) - explicitement
       demandé par l'utilisatrice ("je ne veux pas que ça alourdisse
       notre carte"). */
    document.getElementById("actu-iframe").src = seraOuvert ? urlIllwapEmbed(ILLIWAP_TERRITOIRE) : "about:blank";
}

function fermerVueCommune() {
    document.getElementById("commune-page").hidden = true;
    document.getElementById("commune-contenu").innerHTML = "";
}
