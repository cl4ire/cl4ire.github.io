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
   POPUP COMMERCE — fiche détaillée
   Horaires (syntaxe OSM), téléphone/email/site formatés, catégorie
   reprise de config.js (categorieCommerce/TYPES_COMMERCES).
   ========================================================= */
const JOURS_OSM = { Mo: "Lundi", Tu: "Mardi", We: "Mercredi", Th: "Jeudi", Fr: "Vendredi", Sa: "Samedi", Su: "Dimanche" };
const ORDRE_JOURS_OSM = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

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

function construirePopupCommerce(props) {
    const cat = categorieCommerce(props.type);
    const nom = premierChampValide(props, ["name", "brand"]) || cat.label;
    const adresse = [props.address, props.com_nom].filter(Boolean).join(" · ");

    const horaires = parserHorairesOsm(props.opening_hours);
    const ouvert = estOuvertMaintenant(horaires);
    const aujourdhui = jourOsmAujourdhui();

    const contacts = [];
    if (props.phone) {
        contacts.push(`<a class="popup-commerce-contact" href="tel:${echapperHtml(props.phone.replace(/\s+/g, ""))}"><i class="fa-solid fa-phone"></i>${echapperHtml(formaterTelephone(props.phone))}</a>`);
    }
    if (props.email) {
        contacts.push(`<a class="popup-commerce-contact" href="mailto:${echapperHtml(props.email)}"><i class="fa-solid fa-envelope"></i>${echapperHtml(props.email)}</a>`);
    }
    if (props.website) {
        contacts.push(`<a class="popup-commerce-contact" href="${echapperHtml(props.website)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-globe"></i>${echapperHtml(domaineSite(props.website))}</a>`);
    }

    const lignesHoraires = horaires
        ? ORDRE_JOURS_OSM.filter(j => j in horaires).map(j => {
            const plages = horaires[j];
            const texte = plages.length ? plages.join(", ") : "Fermé";
            return `<div class="popup-commerce-jour${j === aujourdhui ? " aujourdhui" : ""}"><span>${JOURS_OSM[j]}</span><strong>${echapperHtml(texte)}</strong></div>`;
        }).join("")
        : "";

    return `<div class="popup-commerce">
        <div class="popup-commerce-entete">
            <div class="popup-commerce-icon" style="background:${cat.color}"><i class="${cat.icon}"></i></div>
            <div class="popup-commerce-titre-wrap">
                <div class="popup-commerce-tag" style="color:${cat.color}">${echapperHtml(cat.label)}</div>
                <div class="popup-commerce-titre">${echapperHtml(nom)}</div>
                ${adresse ? `<div class="popup-commerce-adresse">${echapperHtml(adresse)}</div>` : ""}
            </div>
            ${horaires ? `<span class="popup-commerce-badge ${ouvert ? "ouvert" : "ferme"}"><span></span>${ouvert ? "Ouvert" : "Fermé"}</span>` : ""}
        </div>

        ${contacts.length ? `<div class="popup-commerce-section"><div class="popup-commerce-section-titre">Contact</div><div class="popup-commerce-contacts">${contacts.join("")}</div></div>` : ""}

        ${lignesHoraires ? `<div class="popup-commerce-section"><div class="popup-commerce-section-titre">Horaires</div>${lignesHoraires}</div>` : ""}
    </div>`;
}

function construirePopup(feature, layerConf) {
    const props = feature.properties || {};
    if (layerConf.id === "carburants") return construirePopupCarburant(props);
    if (layerConf.id === "commerces") return construirePopupCommerce(props);

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
