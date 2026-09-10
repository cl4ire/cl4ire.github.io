/* =========================================================
   GÉOBERCÉ — POPUPS
   Popup générique + fiche détaillée pour les stations carburant.
   ========================================================= */

const CHAMPS_MASQUES = new Set([
    "osm_id", "osm_type", "full_id", "gid", "id", "wikidata",
    "marker-color", "X", "Y", "Xlong", "Ylat", "gpu_doc_id",
    "gpu_status", "gpu_timestamp", "partition", "idurba", "idzone",
    "c_gid", "c_etat_valid", "c_x_coor2", "c_y_coor2",
    "c_lat_coor1", "c_long_coor1", "c_xy_precis", "c_id_adr",
    "commune", "prefixe", "section", "numero", "contenance",
    "arpente", "created", "updated"
]);

function humaniser(cle) { return cle.replace(/_/g, " ").replace(/^c /, "").replace(/\b\w/g, l => l.toUpperCase()); }
function premierChampValide(props, champs) {
    for (const c of champs) if (props[c] !== undefined && props[c] !== null && props[c] !== "" && props[c] !== "NULL") return props[c];
    return null;
}
function echapperHtml(valeur) {
    return String(valeur ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function parserValeur(valeur) {
    if (valeur === undefined || valeur === null || valeur === "") return null;
    if (typeof valeur !== "string") return valeur;
    try { return JSON.parse(valeur); } catch (_) { return valeur; }
}
function listeValeurs(valeur) {
    if (Array.isArray(valeur)) return valeur.map(String).filter(Boolean);
    if (valeur === null || valeur === undefined || valeur === "") return [];
    return String(valeur).split(/\s*;\s*|\s*\/\/\s*/).map(v => v.trim()).filter(Boolean);
}
function nomCarburant(nom) { return { "Gazole": "Gazole", "SP95": "SP95", "SP98": "SP98", "E10": "SP95-E10", "E85": "E85", "GPLc": "GPL" }[nom] || nom; }

function construirePrixCarburants(props) {
    const carburants = [
        { nom: "Gazole", champ: "gazole_prix", maj: "gazole_maj" },
        { nom: "SP95", champ: "sp95_prix", maj: "sp95_maj" },
        { nom: "SP98", champ: "sp98_prix", maj: "sp98_maj" },
        { nom: "E10", champ: "e10_prix", maj: "e10_maj" },
        { nom: "E85", champ: "e85_prix", maj: "e85_maj" },
        { nom: "GPLc", champ: "gplc_prix", maj: "gplc_maj" }
    ];
    const disponibles = new Set(listeValeurs(props.carburants_disponibles));
    const indisponibles = new Set(listeValeurs(props.carburants_indisponibles));
    const temporaires = new Set(listeValeurs(props.carburants_rupture_temporaire));
    const definitives = new Set(listeValeurs(props.carburants_rupture_definitive));

    return carburants.filter(c => props[c.champ] !== undefined || disponibles.has(c.nom) || indisponibles.has(c.nom)).map(c => {
        const prix = Number(props[c.champ]);
        let statut = "Disponible", classe = "disponible";
        if (definitives.has(c.nom)) { statut = "Rupture définitive"; classe = "rupture"; }
        else if (temporaires.has(c.nom)) { statut = "Rupture temporaire"; classe = "rupture"; }
        else if (indisponibles.has(c.nom) || !disponibles.has(c.nom) || !Number.isFinite(prix)) { statut = "Indisponible"; classe = "indisponible"; }
        return { nom: nomCarburant(c.nom), prix: Number.isFinite(prix) ? prix : null, maj: props[c.maj], statut, classe };
    });
}
function formaterPrix(prix) { return prix === null ? "—" : `${prix.toFixed(3).replace(".", ",")} €`; }
function formaterMaj(date) {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function construireServices(props) {
    const services = listeValeurs(props.services_service || props.services);
    if (!services.length) return "";
    const icones = {
        "Station de gonflage": "fa-solid fa-wind", "Lavage automatique": "fa-solid fa-spray-can-sparkles", "Lavage manuel": "fa-solid fa-soap",
        "Bornes électriques": "fa-solid fa-charging-station", "DAB (Distributeur automatique de billets)": "fa-solid fa-money-bill-wave",
        "Automate CB 24/24": "fa-solid fa-credit-card", "Piste poids lourds": "fa-solid fa-truck", "Location de véhicule": "fa-solid fa-car",
        "Vente de gaz domestique (Butane, Propane)": "fa-solid fa-fire-flame-simple", "Boutique alimentaire": "fa-solid fa-basket-shopping",
        "Toilettes publiques": "fa-solid fa-restroom", "Wifi": "fa-solid fa-wifi"
    };
    return `<div class="popup-carburant-services">${services.map(service => `<span class="popup-service"><i class="${icones[service] || "fa-solid fa-circle-check"}"></i>${echapperHtml(service)}</span>`).join("")}</div>`;
}

function construirePopupCarburant(props) {
    const nom = premierChampValide(props, ["enseigne", "nom", "brand"]) || "Station-service";
    const adresse = [props.adresse, props.cp, props.ville].filter(Boolean).join(" · ");
    const prix = construirePrixCarburants(props);

    const datesMaj = prix.map(c => c.maj).filter(Boolean).map(d => new Date(d)).filter(d => !Number.isNaN(d.getTime()));
    const derniereMaj = datesMaj.length ? new Date(Math.max(...datesMaj.map(d => d.getTime()))) : null;

    const lignesPrix = prix.map(c => `
        <div class="popup-carburant-prix ${c.classe}">
            <div class="popup-carburant-nom"><span class="popup-carburant-pastille"></span>${echapperHtml(c.nom)}</div>
            <div class="popup-carburant-valeur">${formaterPrix(c.prix)}</div>
            <div class="popup-carburant-statut">${echapperHtml(c.statut)}</div>
        </div>
    `).join("");

    const services = construireServices(props);

    return `<div class="popup-carburant">
        <div class="popup-carburant-entete">
            <div class="popup-carburant-icon"><i class="fa-solid fa-gas-pump"></i></div>
            <div class="popup-carburant-titre-wrap">
                <div class="popup-carburant-tag">Station-service</div>
                <div class="popup-carburant-titre">${echapperHtml(nom)}</div>
                <div class="popup-carburant-adresse">${echapperHtml(adresse)}</div>
            </div>
        </div>

        <div class="popup-carburant-section">
            <div class="popup-carburant-section-titre"><span>Prix des carburants</span><small>€/L</small></div>
            <div class="popup-carburant-prix-liste">${lignesPrix || `<div class="popup-carburant-vide">Aucun prix disponible.</div>`}</div>
            ${derniereMaj ? `<div style="margin-top:8px;text-align:right;font-size:8.5px;color:#8A8882;"><i class="fa-regular fa-clock"></i> Mis à jour le ${echapperHtml(formaterMaj(derniereMaj))}</div>` : ""}
        </div>

        ${services ? `<div class="popup-carburant-section"><div class="popup-carburant-section-titre"><span>Services</span></div>${services}</div>` : ""}
    </div>`;
}

/* =========================================================
   POPUPS "FICHE" — commerces, banques & DAB, mairies, boîtes aux
   lettres. Base commune (horaires, contact, badge ouvert/fermé)
   factorisée ci-dessous ; chaque couche ne fournit que ses propres
   champs et sa couleur/icône (voir construirePopup en bas de fichier).
   ========================================================= */
const JOURS_OSM = { Mo: "Lundi", Tu: "Mardi", We: "Mercredi", Th: "Jeudi", Fr: "Vendredi", Sa: "Samedi", Su: "Dimanche" };
const ORDRE_JOURS_OSM = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const JOUR_FR_VERS_OSM = {
    "lundi": "Mo", "mardi": "Tu", "mercredi": "We", "jeudi": "Th",
    "vendredi": "Fr", "samedi": "Sa", "dimanche": "Su"
};

function jourOsmAujourdhui() {
    return ORDRE_JOURS_OSM[(new Date().getDay() + 6) % 7]; // getDay() : 0 = dimanche
}

/* Développe "Mo-Fr" ou "Mo,We,Fr" en liste de jours OSM. Ne couvre pas
   toute la spécification opening_hours (jours fériés "PH", horaires sur
   plusieurs semaines...), seulement les motifs les plus courants dans
   les données OSM locales : c'est suffisant pour rendre les horaires
   lisibles sans essayer de tout couvrir. */
function developperJoursOsm(plage) {
    const resultat = [];
    plage.split(",").forEach(morceau => {
        morceau = morceau.trim();
        if (morceau.includes("-")) {
            const [debut, fin] = morceau.split("-");
            let i = ORDRE_JOURS_OSM.indexOf(debut);
            const j = ORDRE_JOURS_OSM.indexOf(fin);
            if (i === -1 || j === -1) return;
            while (true) {
                resultat.push(ORDRE_JOURS_OSM[i]);
                if (i === j) break;
                i = (i + 1) % 7;
            }
        } else if (ORDRE_JOURS_OSM.includes(morceau)) {
            resultat.push(morceau);
        }
    });
    return resultat;
}

function parserHorairesOsm(valeur) {
    if (!valeur || typeof valeur !== "string") return null;
    if (/^24\/7$/i.test(valeur.trim())) {
        const tous = {};
        ORDRE_JOURS_OSM.forEach(j => { tous[j] = ["00:00-24:00"]; });
        return tous;
    }
    const horaires = {};
    let auMoinsUn = false;
    valeur.split(";").forEach(bloc => {
        bloc = bloc.trim();
        const espace = bloc.indexOf(" ");
        if (espace === -1) return;
        const jours = developperJoursOsm(bloc.slice(0, espace));
        const horaireBrut = bloc.slice(espace + 1).trim();
        if (!jours.length) return;
        auMoinsUn = true;
        jours.forEach(j => {
            horaires[j] = /^off$|^closed$/i.test(horaireBrut) ? [] : horaireBrut.split(",").map(s => s.trim());
        });
    });
    return auMoinsUn ? horaires : null;
}

/* Horaires en texte libre français, tels qu'exportés pour les mairies
   ("Le Mardi : de 09h00 à 12h00\nLe Vendredi : de 14h00 à 18h00"), une
   ligne par jour. On les ramène à la même structure {Mo: [...], ...}
   que parserHorairesOsm pour pouvoir réutiliser estOuvertMaintenant et
   l'affichage jour par jour. Ne couvre que ce motif (jour + une ou
   plusieurs plages "de Xh à Y"), pas de spécification plus large à
   gérer ici : les données sont déjà rédigées à la main par les mairies. */
function parserHorairesMairie(texte) {
    if (!texte || typeof texte !== "string") return null;
    const horaires = {};
    let auMoinsUn = false;
    texte.split("\n").forEach(ligne => {
        const m = ligne.trim().match(/^(?:l['’]|le\s+|la\s+)?\s*(\p{L}+)\s*:?\s*(.*)$/iu);
        if (!m) return;
        const jour = JOUR_FR_VERS_OSM[m[1].toLowerCase()];
        if (!jour) return;
        const plages = [];
        const re = /(\d{1,2})h(\d{2})?\s*(?:à|a)\s*(\d{1,2})h(\d{2})?/gi;
        let plage;
        while ((plage = re.exec(m[2])) !== null) {
            const h1 = plage[1].padStart(2, "0"), m1 = (plage[2] || "00").padStart(2, "0");
            const h2 = plage[3].padStart(2, "0"), m2 = (plage[4] || "00").padStart(2, "0");
            plages.push(`${h1}:${m1}-${h2}:${m2}`);
        }
        if (plages.length) { horaires[jour] = plages; auMoinsUn = true; }
    });
    return auMoinsUn ? horaires : null;
}

function estOuvertMaintenant(horaires) {
    if (!horaires) return null;
    const plages = horaires[jourOsmAujourdhui()];
    if (!plages || !plages.length) return false;
    const maintenant = new Date();
    const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
    return plages.some(p => {
        const m = p.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
        if (!m) return false;
        const debut = Number(m[1]) * 60 + Number(m[2]);
        const fin = (Number(m[3]) * 60 + Number(m[4])) || 24 * 60; // "24:00" -> minuit le lendemain
        return minutes >= debut && minutes < fin;
    });
}

function formaterTelephone(tel) {
    if (!tel) return null;
    const local = tel.replace(/[^\d+]/g, "").replace(/^\+33/, "0");
    if (/^0\d{9}$/.test(local)) return local.match(/.{2}/g).join(" ");
    return tel;
}

function domaineSite(url) {
    try {
        return new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "");
    } catch (_) {
        return url;
    }
}

/* Met en majuscule la première lettre de chaque mot, pour les champs
   fournis tout en capitales (adresses des boîtes aux lettres...). */
function capitaliserMots(texte) {
    if (!texte) return "";
    return String(texte).toLowerCase().replace(/(^|[\s'-])\p{L}/gu, l => l.toUpperCase());
}

/* Liens de contact génériques (téléphone/email/site), réutilisés par
   toutes les fiches. `champs` permet d'adapter les noms de propriétés
   d'une couche à l'autre (ex. contact_phone pour les mairies). */
function construireContacts(props, champs = {}) {
    const { tel = "phone", email = "email", site = "website" } = champs;
    const contacts = [];
    if (props[tel]) {
        contacts.push(`<a class="popup-fiche-contact" href="tel:${echapperHtml(String(props[tel]).replace(/\s+/g, ""))}"><i class="fa-solid fa-phone"></i>${echapperHtml(formaterTelephone(props[tel]))}</a>`);
    }
    if (props[email]) {
        contacts.push(`<a class="popup-fiche-contact" href="mailto:${echapperHtml(props[email])}"><i class="fa-solid fa-envelope"></i>${echapperHtml(props[email])}</a>`);
    }
    if (props[site]) {
        contacts.push(`<a class="popup-fiche-contact" href="${echapperHtml(props[site])}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-globe"></i>${echapperHtml(domaineSite(props[site]))}</a>`);
    }
    return contacts;
}

/* Liste jour par jour à partir d'un objet horaires {Mo: [...], ...},
   jour courant mis en évidence. */
function construireLignesHoraires(horaires) {
    if (!horaires) return "";
    const aujourdhui = jourOsmAujourdhui();
    return ORDRE_JOURS_OSM.filter(j => j in horaires).map(j => {
        const plages = horaires[j];
        const texte = plages.length ? plages.join(", ") : "Fermé";
        return `<div class="popup-fiche-jour${j === aujourdhui ? " aujourdhui" : ""}"><span>${JOURS_OSM[j]}</span><strong>${echapperHtml(texte)}</strong></div>`;
    }).join("");
}

function construireBadgeOuvert(horaires) {
    if (!horaires) return "";
    const ouvert = estOuvertMaintenant(horaires);
    return `<span class="popup-fiche-badge ${ouvert ? "ouvert" : "ferme"}"><span></span>${ouvert ? "Ouvert" : "Fermé"}</span>`;
}

/* Élus d'une mairie, format "NOM Prénom (Rôle)\n..." — extraction par
   motif plutôt qu'un split ligne à ligne strict, car certains exports
   comportent des doublons/lignes recollées sans saut de ligne : une
   simple recherche globale de "Nom (Rôle)" ignore proprement ce qui ne
   correspond pas plutôt que de planter ou d'afficher du texte cassé. */
function parserElus(texte) {
    if (!texte || typeof texte !== "string") return [];
    const re = /([A-ZÀ-Ý][\wÀ-ÖØ-öø-ÿ'’-]*(?:\s+[A-ZÀ-Ýa-zà-öø-ÿ][\wÀ-ÖØ-öø-ÿ'’-]*)*)\s*\(([^()]+)\)/g;
    const vus = new Set();
    const elus = [];
    let m;
    while ((m = re.exec(texte)) !== null) {
        const nom = m[1].trim(), role = m[2].trim();
        const cle = nom.toUpperCase();
        if (vus.has(cle)) continue;
        vus.add(cle);
        elus.push({ nom, role });
    }
    return elus;
}

function construireElus(texte) {
    const elus = parserElus(texte);
    if (!elus.length) return "";
    const lignes = elus.map(e => `<div class="popup-fiche-elu"><strong>${echapperHtml(e.nom)}</strong><span>${echapperHtml(e.role)}</span></div>`).join("");
    return `<details class="popup-fiche-elus">
        <summary><span>Conseil municipal (${elus.length})</span><i class="fa-solid fa-chevron-right"></i></summary>
        <div class="popup-fiche-elus-liste">${lignes}</div>
    </details>`;
}

function construirePopupCommerce(props) {
    const cat = categorieCommerce(props.type);
    const nom = premierChampValide(props, ["name", "brand"]) || cat.label;
    const adresse = [props.address, props.com_nom].filter(Boolean).join(" · ");
    const horaires = parserHorairesOsm(props.opening_hours);
    const contacts = construireContacts(props);
    const lignesHoraires = construireLignesHoraires(horaires);

    return `<div class="popup-fiche">
        <div class="popup-fiche-entete">
            <div class="popup-fiche-icon" style="background:${cat.color}"><i class="${cat.icon}"></i></div>
            <div class="popup-fiche-titre-wrap">
                <div class="popup-fiche-tag" style="color:${cat.color}">${echapperHtml(cat.label)}</div>
                <div class="popup-fiche-titre">${echapperHtml(nom)}</div>
                ${adresse ? `<div class="popup-fiche-adresse">${echapperHtml(adresse)}</div>` : ""}
            </div>
            ${construireBadgeOuvert(horaires)}
        </div>

        ${contacts.length ? `<div class="popup-fiche-section"><div class="popup-fiche-section-titre">Contact</div><div class="popup-fiche-contacts">${contacts.join("")}</div></div>` : ""}

        ${lignesHoraires ? `<div class="popup-fiche-section"><div class="popup-fiche-section-titre">Horaires</div>${lignesHoraires}</div>` : ""}
    </div>`;
}

/* Banque (agence) ou distributeur automatique (DAB) : même flux OSM,
   distingué par le champ "type". Terracotta pour les DAB, pour éviter
   que tout le SIG tourne autour du même bleu institutionnel. */
function construirePopupBanque(props) {
    const estDab = props.type === "atm";
    const style = estDab
        ? { icon: "fa-solid fa-money-bill-wave", color: PALETTE.terracotta, tag: "Distributeur (DAB)" }
        : { icon: "fa-solid fa-building-columns", color: PALETTE.ardoise, tag: "Banque" };
    const nom = premierChampValide(props, ["name", "brand", "operator"]) || style.tag;
    const horaires = parserHorairesOsm(props.opening_hours);
    const contacts = construireContacts(props);
    const lignesHoraires = construireLignesHoraires(horaires);
    const operateur = props.operator && props.operator !== nom ? props.operator : null;

    return `<div class="popup-fiche">
        <div class="popup-fiche-entete">
            <div class="popup-fiche-icon" style="background:${style.color}"><i class="${style.icon}"></i></div>
            <div class="popup-fiche-titre-wrap">
                <div class="popup-fiche-tag" style="color:${style.color}">${echapperHtml(style.tag)}</div>
                <div class="popup-fiche-titre">${echapperHtml(nom)}</div>
                ${props.com_nom ? `<div class="popup-fiche-adresse">${echapperHtml(props.com_nom)}</div>` : ""}
                ${operateur ? `<div class="popup-fiche-puce" style="color:${style.color}"><i class="fa-solid fa-building"></i>Opéré par ${echapperHtml(operateur)}</div>` : ""}
                ${!estDab && props.has_atm ? `<div class="popup-fiche-puce" style="color:${PALETTE.terracotta}"><i class="fa-solid fa-money-bill-wave"></i>Distributeur sur place</div>` : ""}
            </div>
            ${construireBadgeOuvert(horaires)}
        </div>

        ${contacts.length ? `<div class="popup-fiche-section"><div class="popup-fiche-section-titre">Contact</div><div class="popup-fiche-contacts">${contacts.join("")}</div></div>` : ""}

        ${lignesHoraires ? `<div class="popup-fiche-section"><div class="popup-fiche-section-titre">Horaires</div>${lignesHoraires}</div>` : ""}
    </div>`;
}

/* Mairie (ou mairie déléguée) : horaires en texte libre plutôt que
   syntaxe OSM (parserHorairesMairie), et liste du conseil municipal
   repliée par défaut (<details>) pour ne pas alourdir la fiche. */
function construirePopupMairie(props) {
    const tag = props.amenity || "Mairie";
    const nom = premierChampValide(props, ["name"]) || tag;
    const horaires = parserHorairesMairie(props.opening_hours);
    const contacts = construireContacts(props, { tel: "contact_phone", email: "contact_email", site: "contact_website" });
    const lignesHoraires = construireLignesHoraires(horaires);
    const elus = construireElus(props.elus);

    return `<div class="popup-fiche">
        <div class="popup-fiche-entete">
            <div class="popup-fiche-icon" style="background:${PALETTE.riviere}"><i class="fa-solid fa-landmark"></i></div>
            <div class="popup-fiche-titre-wrap">
                <div class="popup-fiche-tag" style="color:${PALETTE.riviere}">${echapperHtml(tag)}</div>
                <div class="popup-fiche-titre">${echapperHtml(nom)}</div>
                ${props.commune ? `<div class="popup-fiche-adresse">${echapperHtml(props.commune)}</div>` : ""}
            </div>
            ${construireBadgeOuvert(horaires)}
        </div>

        ${contacts.length ? `<div class="popup-fiche-section"><div class="popup-fiche-section-titre">Contact</div><div class="popup-fiche-contacts">${contacts.join("")}</div></div>` : ""}

        ${lignesHoraires ? `<div class="popup-fiche-section"><div class="popup-fiche-section-titre">Horaires</div>${lignesHoraires}</div>` : ""}

        ${elus ? `<div class="popup-fiche-section">${elus}</div>` : ""}
    </div>`;
}

/* Boîte aux lettres La Poste : juste les heures de levée (dernier
   passage du facteur), en semaine et le samedi — pas d'autre info
   utile sur cette couche, donc pas de badge ouvert/fermé ici. */
function extraireHeureLevee(valeur) {
    if (!valeur) return null;
    const m = String(valeur).match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : null;
}

function construirePopupBal(props) {
    /* "NULL" en toutes lettres, pas une vraie valeur nulle : convention
       de ce flux pour un numéro de voie manquant (déjà rencontrée
       ailleurs, voir premierChampValide/parserValeur). */
    const numero = (props.VA_NO_VOIE && props.VA_NO_VOIE !== "NULL") ? `${props.VA_NO_VOIE} ` : "";
    const voie = capitaliserMots(props.LB_VOIE_EXT);
    const nom = (numero + voie).trim() || "Boîte aux lettres";
    const adresse = [props.CO_POSTAL, capitaliserMots(props.LB_COM)].filter(Boolean).join(" · ");
    const semaine = extraireHeureLevee(props.HDL_SEMAINE_EXTRA);
    const samedi = extraireHeureLevee(props.HDL_SAMEDI_EXTRA);

    const lignes = [
        semaine ? `<div class="popup-fiche-jour"><span>Du lundi au vendredi</span><strong>${echapperHtml(semaine)}</strong></div>` : "",
        samedi ? `<div class="popup-fiche-jour"><span>Le samedi</span><strong>${echapperHtml(samedi)}</strong></div>` : ""
    ].join("");

    return `<div class="popup-fiche">
        <div class="popup-fiche-entete">
            <div class="popup-fiche-icon" style="background:${PALETTE.feuille}"><i class="fa-solid fa-envelope"></i></div>
            <div class="popup-fiche-titre-wrap">
                <div class="popup-fiche-tag" style="color:${PALETTE.feuille}">Boîte aux lettres</div>
                <div class="popup-fiche-titre">${echapperHtml(nom)}</div>
                ${adresse ? `<div class="popup-fiche-adresse">${echapperHtml(adresse)}</div>` : ""}
            </div>
        </div>

        ${lignes ? `<div class="popup-fiche-section"><div class="popup-fiche-section-titre">Levée du courrier</div>${lignes}</div>` : ""}
    </div>`;
}

/* =========================================================
   POPUP PARCELLE (cadastre) — fiche "à la Parcellai.re" : bâti, ventes
   DVF, DPE, urbanisme (zone PLUi/aléa RGA) et équipements les plus
   proches. Contrairement aux autres fiches, son contenu dépend de
   couches encore en différé (mutations/DPE/PLUi/RGA) : la popup s'ouvre
   d'abord avec juste référence/surface (construirePopupCadastreBase),
   puis se complète une fois les données chargées (voir
   ouvrirPopupParcelle, appelée depuis layers.js au premier "popupopen"
   de chaque parcelle plutôt qu'à la construction de toutes les
   parcelles visibles, sans quoi chaque déplacement de carte
   déclencherait ces chargements pour rien).
   ========================================================= */
function formaterMontant(valeur) {
    return typeof valeur === "number" ? valeur.toLocaleString("fr-FR") + " €" : null;
}

/* couleurDpe et ventesDepuisMutation vivent dans config.js : partagées
   avec l'icône par classe de la couche DPE et le style par prix/m² de
   la couche mutations (voir js/config.js), pas seulement cette popup. */

/* Bloc "Ventes connues", partagé entre la fiche parcelle (ci-dessous) et
   la popup de la couche "mutations" elle-même (voir plus bas). */
function construireVentesHtml(ventes) {
    if (!ventes.length) return "";
    return `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-euro-sign"></i>Ventes connues</div>
        ${ventes.map(v => `<div class="popup-fiche-vente">
            <span>${v.annee ? echapperHtml(String(v.annee)) : "—"}</span>
            <strong>${formaterMontant(v.valeur) || "—"}</strong>
            <span class="popup-fiche-vente-m2">${v.prixM2 ? v.prixM2.toLocaleString("fr-FR") + " €/m²" : ""}</span>
        </div>`).join("")}
    </div>`;
}

function construirePopupCadastreEntete(props) {
    return `<div class="popup-fiche-entete">
        <div class="popup-fiche-icon" style="background:${PALETTE.ardoise}"><i class="fa-solid fa-draw-polygon"></i></div>
        <div class="popup-fiche-titre-wrap">
            <div class="popup-fiche-tag" style="color:${PALETTE.ardoise}">Parcelle cadastrale</div>
            <div class="popup-fiche-titre">${echapperHtml(props.reference || "—")}</div>
            <div class="popup-fiche-adresse">${echapperHtml(props.commune_nom || "")}</div>
        </div>
        ${props.surface_m2 ? `<span class="popup-fiche-badge info">${Math.round(props.surface_m2).toLocaleString("fr-FR")} m²</span>` : ""}
    </div>`;
}

function construirePopupCadastreBase(props) {
    return `<div class="popup-fiche popup-fiche-parcelle">
        ${construirePopupCadastreEntete(props)}
        <div class="popup-fiche-chargement"><i class="fa-solid fa-circle-notch fa-spin"></i>Chargement des informations foncières…</div>
    </div>`;
}

function construirePopupCadastre(props, infos) {
    const bati = infos.nbBatiments ? `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-house"></i>Bâti</div>
        <div class="popup-fiche-ligne">${infos.nbBatiments} bâtiment${infos.nbBatiments > 1 ? "s" : ""}${infos.surfaceBatie ? ` · ${Math.round(infos.surfaceBatie)} m²` : ""}</div>
    </div>` : "";

    const ventes = construireVentesHtml(infos.ventes);

    const dpe = infos.dpe && infos.dpe.classe ? `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-bolt"></i>DPE</div>
        <div class="popup-fiche-ligne">
            <span class="popup-fiche-dpe-classe" style="background:${couleurDpe(infos.dpe.classe)}">${echapperHtml(infos.dpe.classe)}</span>
            ${infos.dpe.conso ? `${Math.round(infos.dpe.conso)} kWh/m²/an` : ""}
        </div>
    </div>` : "";

    const urbanisme = (infos.typezonePLUi || infos.niveauRGA) ? `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-building-shield"></i>Urbanisme</div>
        ${infos.typezonePLUi ? `<div class="popup-fiche-ligne">Zone ${echapperHtml(infos.typezonePLUi)}${infos.libellePLUi ? ` <span class="popup-fiche-precision">${echapperHtml(infos.libellePLUi)}</span>` : ""}</div>` : ""}
        ${infos.niveauRGA ? `<div class="popup-fiche-ligne">Aléa argiles : ${echapperHtml(LABELS_RGA[infos.niveauRGA] || String(infos.niveauRGA))}</div>` : ""}
    </div>` : "";

    /* infos.proximite n'est déjà rempli par infosParcelle (recherche.js)
       que pour un terrain à bâtir ou une parcelle qui porte déjà une
       maison — sur une parcelle agricole/naturelle sans bâti, la
       distance à l'école ou au commerce le plus proche n'intéresse
       personne, donc on ne la calcule même pas. */
    const proximite = infos.proximite.length ? `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-location-dot"></i>À proximité</div>
        ${infos.proximite.map(p => `<div class="popup-fiche-jour"><span>${echapperHtml(p.titre)}</span><strong>${formaterDistance(p.distance)}</strong></div>`).join("")}
    </div>` : "";

    const rien = !bati && !ventes && !dpe && !urbanisme && !proximite
        ? `<div class="popup-fiche-section"><div class="popup-fiche-vide">Aucune information supplémentaire disponible pour cette parcelle.</div></div>` : "";

    return `<div class="popup-fiche popup-fiche-parcelle">
        ${construirePopupCadastreEntete({ ...props, commune_nom: infos.adresse ? `${infos.adresse} · ${props.commune_nom}` : props.commune_nom })}
        ${bati}${ventes}${dpe}${urbanisme}${proximite}${rien}
    </div>`;
}

/* Déclenchée au premier "popupopen" de chaque parcelle (voir layers.js) :
   charge les couches foncières encore différées (idempotent, chargerCouche
   ne re-télécharge rien si déjà fait), calcule les infos de cette seule
   parcelle, puis remplace le contenu "chargement..." par la fiche complète. */
function ouvrirPopupParcelle(feature, layer) {
    if (layer._infosChargees) return;
    layer._infosChargees = true;
    chargerDonneesFoncieres().then(() => {
        const infos = infosParcelle(feature);
        const popup = layer.getPopup();
        if (popup) popup.setContent(construirePopupCadastre(feature.properties, infos));
    });
}

/* =========================================================
   POPUP DPE — même fiche que la section DPE de la parcelle, mais pour
   la couche "Diagnostics énergétiques" prise isolément : un DPE de plus
   qu'une donnée croisée avec une parcelle précise.
   ========================================================= */
function formaterDateSeule(date) {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function capitaliserPremiere(texte) {
    return texte ? String(texte).charAt(0).toUpperCase() + String(texte).slice(1) : "";
}

function construirePopupDpe(props) {
    const classe = props.etiquette_dpe;
    const couleur = couleurDpe(classe);
    const nom = premierChampValide(props, ["adresse"]) || (props.type_batiment ? capitaliserPremiere(props.type_batiment) : "Diagnostic énergétique");

    const energie = (classe || props.consommation) ? `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-bolt"></i>Énergie</div>
        <div class="popup-fiche-ligne">
            ${classe ? `<span class="popup-fiche-dpe-classe" style="background:${couleur}">${echapperHtml(classe)}</span>` : ""}
            ${props.consommation ? `${Math.round(props.consommation)} kWh/m²/an` : ""}
        </div>
        ${(props.etiquette_ges || props.emissions_ges) ? `<div class="popup-fiche-ligne" style="margin-top:6px">
            ${props.etiquette_ges ? `<span class="popup-fiche-dpe-classe" style="background:${couleurDpe(props.etiquette_ges)}">${echapperHtml(props.etiquette_ges)}</span>` : ""}
            ${props.emissions_ges ? `${Math.round(props.emissions_ges)} kgCO²/m²/an <span class="popup-fiche-precision">(gaz à effet de serre)</span>` : ""}
        </div>` : ""}
    </div>` : "";

    const detailsLogement = [
        props.type_batiment ? capitaliserPremiere(props.type_batiment) : "",
        props.surface_habitable ? `${Math.round(props.surface_habitable)} m²` : "",
        props.annee_construction ? `construit en ${props.annee_construction}` : (props.periode_construction || "")
    ].filter(Boolean);
    const logement = detailsLogement.length ? `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-house"></i>Logement</div>
        <div class="popup-fiche-ligne">${detailsLogement.map(echapperHtml).join(" · ")}</div>
    </div>` : "";

    const chauffage = [props.energie_chauffage, props.energie_ecs].filter(Boolean);
    const sectionChauffage = chauffage.length ? `<div class="popup-fiche-section">
        <div class="popup-fiche-section-titre"><i class="fa-solid fa-fire-flame-simple"></i>Chauffage</div>
        <div class="popup-fiche-ligne">${chauffage.map(echapperHtml).join(" · ")}</div>
    </div>` : "";

    const dateEtablissement = formaterDateSeule(props.date_etablissement_dpe);

    return `<div class="popup-fiche">
        <div class="popup-fiche-entete">
            <div class="popup-fiche-icon" style="background:${couleur}"><i class="fa-solid fa-bolt"></i></div>
            <div class="popup-fiche-titre-wrap">
                <div class="popup-fiche-tag" style="color:${couleur}">Diagnostic énergétique</div>
                <div class="popup-fiche-titre">${echapperHtml(nom)}</div>
                ${props.commune ? `<div class="popup-fiche-adresse">${echapperHtml(props.commune)}</div>` : ""}
            </div>
        </div>
        ${energie}${logement}${sectionChauffage}
        ${dateEtablissement ? `<div class="popup-fiche-section"><div class="popup-fiche-precision"><i class="fa-regular fa-clock"></i> Diagnostic établi le ${echapperHtml(dateEtablissement)}</div></div>` : ""}
    </div>`;
}

/* =========================================================
   POPUP MUTATION — couche "Mutations immobilières (DVF)" prise
   isolément (par opposition à la fiche parcelle, qui la croise avec le
   cadastre) : réutilise ventesDepuisMutation/construireVentesHtml comme
   la fiche parcelle, colorée avec la même échelle que le style de la
   couche (stylePrixMutation dans config.js) pour rester cohérent entre
   le remplissage de la parcelle sur la carte et sa popup.
   ========================================================= */
function construirePopupMutation(props, feature) {
    const ventes = ventesDepuisMutation(feature);
    const couleur = ventes[0] && ventes[0].prixM2 ? couleurPrix(ventes[0].prixM2) : PALETTE.terracotta;
    const nom = premierChampValide(props, ["adresse"]) || `Parcelle ${[props.section, props.numero_parcelle].filter(Boolean).join(" ")}`.trim() || "Vente immobilière";
    const adresse = [props.code_postal, props.commune].filter(Boolean).join(" · ");
    const ventesHtml = construireVentesHtml(ventes);

    return `<div class="popup-fiche">
        <div class="popup-fiche-entete">
            <div class="popup-fiche-icon" style="background:${couleur}"><i class="fa-solid fa-file-invoice-dollar"></i></div>
            <div class="popup-fiche-titre-wrap">
                <div class="popup-fiche-tag" style="color:${couleur}">Vente immobilière (DVF)</div>
                <div class="popup-fiche-titre">${echapperHtml(nom)}</div>
                ${adresse ? `<div class="popup-fiche-adresse">${echapperHtml(adresse)}</div>` : ""}
            </div>
            ${props.nb_mutations > 1 ? `<span class="popup-fiche-badge info">${props.nb_mutations} ventes</span>` : ""}
        </div>
        ${ventesHtml || `<div class="popup-fiche-section"><div class="popup-fiche-vide">Aucune vente exploitable (pas de surface bâtie associée) sur cette parcelle.</div></div>`}
    </div>`;
}

/* =========================================================
   POPUP DÉCHÈTERIE / TRI — trois fiches différentes selon le champ
   "type" (voir iconeDechet dans config.js pour la même distinction côté
   marqueur) : déchèterie, composteur partagé, point d'apport volontaire.
   ========================================================= */
function construirePopupDechet(props) {
    if (props.type === "centre") return construirePopupDecheterie(props);
    if (props.type === "compost") return construirePopupCompost(props);
    return construirePopupApportVolontaire(props);
}

function construirePopupDecheterie(props) {
    const operateur = operateurDechet(props.operator);
    return `<div class="popup-fiche">
        <div class="popup-fiche-entete">
            <div class="popup-fiche-icon" style="background:${PALETTE.foret}"><i class="fa-solid fa-warehouse"></i></div>
            <div class="popup-fiche-titre-wrap">
                <div class="popup-fiche-tag" style="color:${PALETTE.foret}">Déchèterie</div>
                <div class="popup-fiche-titre">${echapperHtml(props.name || "Déchèterie")}</div>
                ${props.com_nom ? `<div class="popup-fiche-adresse">${echapperHtml(props.com_nom)}</div>` : ""}
                ${operateur ? `<div class="popup-fiche-puce" style="color:${PALETTE.foret}"><i class="fa-solid fa-building"></i>Gérée par ${echapperHtml(operateur)}</div>` : ""}
            </div>
        </div>
    </div>`;
}

function construirePopupCompost(props) {
    const acces = (props.opening_hours || "").trim();
    const public_ = /^public/i.test(acces);
    const operateur = operateurDechet(props.operator);
    return `<div class="popup-fiche">
        <div class="popup-fiche-entete">
            <div class="popup-fiche-icon" style="background:${PALETTE.feuille}"><i class="fa-solid fa-seedling"></i></div>
            <div class="popup-fiche-titre-wrap">
                <div class="popup-fiche-tag" style="color:${PALETTE.feuille}">Composteur partagé</div>
                <div class="popup-fiche-titre">${echapperHtml(props.name || "Composteur partagé")}</div>
                ${props.com_nom ? `<div class="popup-fiche-adresse">${echapperHtml(props.com_nom)}</div>` : ""}
                ${operateur ? `<div class="popup-fiche-puce" style="color:${PALETTE.feuille}"><i class="fa-solid fa-building"></i>Géré par ${echapperHtml(operateur)}</div>` : ""}
            </div>
            ${acces ? `<span class="popup-fiche-badge ${public_ ? "ouvert" : "ferme"}"><span></span>${public_ ? "Public" : "Accès réservé"}</span>` : ""}
        </div>
        ${(acces && acces.toLowerCase() !== "public") ? `<div class="popup-fiche-section"><div class="popup-fiche-precision">${echapperHtml(acces)}</div></div>` : ""}
    </div>`;
}

function construirePopupApportVolontaire(props) {
    const flux = fluxPresents(props);
    const couleur = flux[0] ? flux[0].color : PALETTE.ardoise;
    const operateur = operateurDechet(props.operator);
    const chips = flux.map(f => `<span class="popup-fiche-flux" style="color:${f.color}"><span></span>${echapperHtml(f.label)}</span>`).join("");

    return `<div class="popup-fiche">
        <div class="popup-fiche-entete">
            <div class="popup-fiche-icon" style="background:${couleur}"><i class="fa-solid fa-recycle"></i></div>
            <div class="popup-fiche-titre-wrap">
                <div class="popup-fiche-tag" style="color:${couleur}">Point d'apport volontaire</div>
                <div class="popup-fiche-titre">${echapperHtml(props.name || "Point d'apport volontaire")}</div>
                ${props.com_nom ? `<div class="popup-fiche-adresse">${echapperHtml(props.com_nom)}</div>` : ""}
                ${operateur ? `<div class="popup-fiche-puce" style="color:${couleur}"><i class="fa-solid fa-building"></i>Géré par ${echapperHtml(operateur)}</div>` : ""}
            </div>
        </div>
        ${chips ? `<div class="popup-fiche-section"><div class="popup-fiche-section-titre"><i class="fa-solid fa-recycle"></i>Tri sélectif</div><div class="popup-fiche-flux-liste">${chips}</div></div>` : ""}
    </div>`;
}

function construirePopup(feature, layerConf) {
    const props = feature.properties || {};
    if (layerConf.id === "carburants") return construirePopupCarburant(props);
    if (layerConf.id === "commerces") return construirePopupCommerce(props);
    if (layerConf.id === "banques") return construirePopupBanque(props);
    if (layerConf.id === "mairies") return construirePopupMairie(props);
    if (layerConf.id === "bal") return construirePopupBal(props);
    if (layerConf.id === "cadastre") return construirePopupCadastreBase(props);
    if (layerConf.id === "dpe") return construirePopupDpe(props);
    if (layerConf.id === "mutations") return construirePopupMutation(props, feature);
    if (layerConf.id === "dechets") return construirePopupDechet(props);

    const titre = premierChampValide(props, layerConf.titleFields || []) || layerConf.label;
    const sousInfos = (layerConf.subtitleFields || []).map(c => props[c]).filter(v => v !== undefined && v !== null && v !== "" && v !== "NULL");
    let html = `<div class="popup-geo">`;
    html += `<div class="popup-geo-tag" style="color:${layerConf.color}">${echapperHtml(layerConf.label)}</div>`;
    html += `<div class="popup-geo-titre">${echapperHtml(titre)}</div>`;
    if (sousInfos.length) html += `<div class="popup-geo-sous">${sousInfos.map(echapperHtml).join(" · ")}</div>`;
    const reste = Object.keys(props).filter(k => !CHAMPS_MASQUES.has(k) && !(layerConf.titleFields || []).includes(k) && !(layerConf.subtitleFields || []).includes(k) && props[k] !== null && props[k] !== "" && props[k] !== "NULL").slice(0, 6);
    if (reste.length) {
        html += `<dl class="popup-geo-details">`;
        reste.forEach(k => { html += `<dt>${echapperHtml(humaniser(k))}</dt><dd>${echapperHtml(props[k])}</dd>`; });
        html += `</dl>`;
    }
    html += `</div>`;
    return html;
}
