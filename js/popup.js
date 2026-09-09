/* =========================================================
   GÉOBERCÉ — POPUPS
   Popup générique + fiche détaillée pour les stations carburant.
   ========================================================= */

const CHAMPS_MASQUES = new Set([
    "osm_id", "osm_type", "full_id", "gid", "id", "wikidata",
    "marker-color", "X", "Y", "Xlong", "Ylat", "gpu_doc_id",
    "gpu_status", "gpu_timestamp", "partition", "idurba", "idzone",
    "c_gid", "c_etat_valid", "c_x_coor2", "c_y_coor2",
    "c_lat_coor1", "c_long_coor1", "c_xy_precis", "c_id_adr"
]);

function humaniser(cle) {
    return cle
        .replace(/_/g, " ")
        .replace(/^c /, "")
        .replace(/\b\w/g, l => l.toUpperCase());
}

function premierChampValide(props, champs) {
    for (const c of champs) {
        if (props[c] !== undefined && props[c] !== null && props[c] !== "" && props[c] !== "NULL") {
            return props[c];
        }
    }
    return null;
}

function echapperHtml(valeur) {
    return String(valeur ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function parserValeur(valeur) {
    if (valeur === undefined || valeur === null || valeur === "") return null;
    if (typeof valeur !== "string") return valeur;
    try { return JSON.parse(valeur); } catch (_) { return valeur; }
}

function listeValeurs(valeur) {
    if (Array.isArray(valeur)) return valeur.map(String).filter(Boolean);
    if (valeur === null || valeur === undefined || valeur === "") return [];
    return String(valeur)
        .split(/\s*;\s*|\s*\/\/\s*/)
        .map(v => v.trim())
        .filter(Boolean);
}

function nomCarburant(nom) {
    return {
        "Gazole": "Gazole",
        "SP95": "SP95",
        "SP98": "SP98",
        "E10": "SP95-E10",
        "E85": "E85",
        "GPLc": "GPL"
    }[nom] || nom;
}

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

    return carburants
        .filter(c => props[c.champ] !== undefined || disponibles.has(c.nom) || indisponibles.has(c.nom))
        .map(c => {
            const prix = Number(props[c.champ]);
            let statut = "Disponible";
            let classe = "disponible";

            if (definitives.has(c.nom)) {
                statut = "Rupture définitive";
                classe = "rupture";
            } else if (temporaires.has(c.nom)) {
                statut = "Rupture temporaire";
                classe = "rupture";
            } else if (indisponibles.has(c.nom) || !disponibles.has(c.nom) || !Number.isFinite(prix)) {
                statut = "Indisponible";
                classe = "indisponible";
            }

            return {
                nom: nomCarburant(c.nom),
                prix: Number.isFinite(prix) ? prix : null,
                maj: props[c.maj],
                statut,
                classe
            };
        });
}

function formaterPrix(prix) {
    return prix === null ? "—" : `${prix.toFixed(3).replace(".", ",")} €`;
}

function formaterMaj(date) {
    if (!date) return "";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return `maj. ${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function normaliserHeure(heure) {
    if (!heure) return null;
    return String(heure).replace(".", ":");
}

function construireHoraires(props) {
    const horaires = parserValeur(props.horaires);
    const automate = String(props.horaires_automate_24_24 || "").toLowerCase() === "oui";
    const jours = horaires && Array.isArray(horaires.jour) ? horaires.jour : [];
    const maintenant = new Date();
    const jourId = maintenant.getDay() === 0 ? 7 : maintenant.getDay();
    const aujourdHui = jours.find(j => String(j["@id"]) === String(jourId));

    let ouvert = null;
    let detailAujourdhui = "Horaires non renseignés";

    if (automate) {
        ouvert = true;
        detailAujourdhui = "Automate CB accessible 24h/24";
    } else if (aujourdHui) {
        if (aujourdHui["@ferme"] === "1") {
            ouvert = false;
            detailAujourdhui = "Fermé aujourd'hui";
        } else if (aujourdHui.horaire) {
            const ouverture = normaliserHeure(aujourdHui.horaire["@ouverture"]);
            const fermeture = normaliserHeure(aujourdHui.horaire["@fermeture"]);
            detailAujourdhui = `${ouverture} – ${fermeture}`;

            if (ouverture && fermeture) {
                const [oh, om] = ouverture.split(":").map(Number);
                const [fh, fm] = fermeture.split(":").map(Number);
                const debut = oh * 60 + om;
                const fin = fh * 60 + fm;
                const minute = maintenant.getHours() * 60 + maintenant.getMinutes();
                ouvert = debut === fin ? true : (debut < fin ? minute >= debut && minute < fin : minute >= debut || minute < fin);
            }
        }
    }

    let statut = "Horaires inconnus";
    let classe = "inconnu";
    if (ouvert === true) { statut = "Ouvert"; classe = "ouvert"; }
    if (ouvert === false) { statut = "Fermé"; classe = "ferme"; }

    const lignes = jours.map(j => {
        let texte = "Fermé";
        if (j["@ferme"] !== "1" && j.horaire) {
            texte = `${normaliserHeure(j.horaire["@ouverture"]) || "—"} – ${normaliserHeure(j.horaire["@fermeture"]) || "—"}`;
        }
        return `<div class="popup-carburant-jour"><span>${echapperHtml(j["@nom"] || "")}</span><strong>${echapperHtml(texte)}</strong></div>`;
    }).join("");

    return { automate, statut, classe, detailAujourdhui, lignes };
}

function construireServices(props) {
    const services = listeValeurs(props.services_service || props.services);
    if (!services.length) return "";

    const icones = {
        "Station de gonflage": "fa-solid fa-wind",
        "Lavage automatique": "fa-solid fa-spray-can-sparkles",
        "Lavage manuel": "fa-solid fa-soap",
        "Bornes électriques": "fa-solid fa-charging-station",
        "DAB (Distributeur automatique de billets)": "fa-solid fa-money-bill-wave",
        "Automate CB 24/24": "fa-solid fa-credit-card",
        "Piste poids lourds": "fa-solid fa-truck",
        "Location de véhicule": "fa-solid fa-car",
        "Vente de gaz domestique (Butane, Propane)": "fa-solid fa-fire-flame-simple",
        "Boutique alimentaire": "fa-solid fa-basket-shopping",
        "Toilettes publiques": "fa-solid fa-restroom",
        "Wifi": "fa-solid fa-wifi"
    };

    return `<div class="popup-carburant-services">${services.map(service => `
        <span class="popup-service"><i class="${icones[service] || "fa-solid fa-circle-check"}"></i>${echapperHtml(service)}</span>
    `).join("")}</div>`;
}

function construirePopupCarburant(props) {
    const nom = premierChampValide(props, ["enseigne", "nom", "brand"]) || "Station-service";
    const adresse = [props.adresse, props.cp, props.ville].filter(Boolean).join(" · ");
    const prix = construirePrixCarburants(props);
    const horaires = construireHoraires(props);
    const services = construireServices(props);
    const stationId = props.id ? `Station n°${props.id}` : "Prix mis à jour régulièrement";

    const lignesPrix = prix.map(c => `
        <div class="popup-carburant-prix ${c.classe}">
            <div class="popup-carburant-nom"><span class="popup-carburant-pastille"></span>${echapperHtml(c.nom)}</div>
            <div class="popup-carburant-valeur">${formaterPrix(c.prix)}</div>
            <div class="popup-carburant-statut">${echapperHtml(c.statut)}</div>
        </div>
    `).join("");

    const horairesComplets = horaires.lignes ? `
        <details class="popup-carburant-horaires">
            <summary><span><i class="fa-regular fa-clock"></i> Horaires</span><span>${echapperHtml(horaires.detailAujourdhui)}</span></summary>
            <div class="popup-carburant-horaires-liste">${horaires.lignes}</div>
        </details>
    ` : "";

    return `<div class="popup-carburant">
        <div class="popup-carburant-entete">
            <div class="popup-carburant-icon"><i class="fa-solid fa-gas-pump"></i></div>
            <div class="popup-carburant-titre-wrap">
                <div class="popup-carburant-tag">Station-service</div>
                <div class="popup-carburant-titre">${echapperHtml(nom)}</div>
                <div class="popup-carburant-adresse">${echapperHtml(adresse)}</div>
            </div>
            <span class="popup-carburant-badge ${horaires.classe}"><span></span>${echapperHtml(horaires.statut)}</span>
        </div>

        <div class="popup-carburant-section">
            <div class="popup-carburant-section-titre"><span>Prix des carburants</span><small>€/L</small></div>
            <div class="popup-carburant-prix-liste">${lignesPrix || `<div class="popup-carburant-vide">Aucun prix disponible.</div>`}</div>
            <div class="popup-carburant-source">${echapperHtml(stationId)}</div>
        </div>

        <div class="popup-carburant-section">
            <div class="popup-carburant-section-titre"><span>Horaires</span></div>
            <div class="popup-carburant-aujourdhui ${horaires.classe}">
                <span><i class="fa-regular fa-clock"></i> Aujourd'hui</span>
                <strong>${echapperHtml(horaires.detailAujourdhui)}</strong>
            </div>
            ${horairesComplets}
        </div>

        ${services ? `<div class="popup-carburant-section"><div class="popup-carburant-section-titre"><span>Services</span></div>${services}</div>` : ""}
    </div>`;
}

function construirePopup(feature, layerConf) {
    const props = feature.properties || {};

    if (layerConf.id === "carburants") {
        return construirePopupCarburant(props);
    }

    const titre =
        premierChampValide(props, layerConf.titleFields || []) ||
        layerConf.label;

    const sousInfos = (layerConf.subtitleFields || [])
        .map(c => props[c])
        .filter(v => v !== undefined && v !== null && v !== "" && v !== "NULL");

    let html = `<div class="popup-geo">`;
    html += `<div class="popup-geo-tag" style="color:${layerConf.color}">${echapperHtml(layerConf.label)}</div>`;
    html += `<div class="popup-geo-titre">${echapperHtml(titre)}</div>`;

    if (sousInfos.length) {
        html += `<div class="popup-geo-sous">${sousInfos.map(echapperHtml).join(" · ")}</div>`;
    }

    const reste = Object.keys(props).filter(k =>
        !CHAMPS_MASQUES.has(k) &&
        !(layerConf.titleFields || []).includes(k) &&
        !(layerConf.subtitleFields || []).includes(k) &&
        props[k] !== null && props[k] !== "" && props[k] !== "NULL"
    ).slice(0, 6);

    if (reste.length) {
        html += `<dl class="popup-geo-details">`;
        reste.forEach(k => {
            html += `<dt>${echapperHtml(humaniser(k))}</dt><dd>${echapperHtml(props[k])}</dd>`;
        });
        html += `</dl>`;
    }

    html += `</div>`;
    return html;
}
