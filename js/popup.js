/* =========================================================
   GÉOBERCÉ — POPUPS GÉNÉRIQUES
   Un seul formateur, utilisé par toutes les couches : il essaie
   les champs candidats définis dans config.js, et à défaut,
   affiche proprement les propriétés disponibles.
   ========================================================= */

/* Champs techniques à ne jamais afficher tels quels dans le "reste" */
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

function construirePopup(feature, layerConf) {
    const props = feature.properties || {};

    const titre =
        premierChampValide(props, layerConf.titleFields || []) ||
        layerConf.label;

    const sousInfos = (layerConf.subtitleFields || [])
        .map(c => props[c])
        .filter(v => v !== undefined && v !== null && v !== "" && v !== "NULL");

    let html = `<div class="popup-geo">`;
    html += `<div class="popup-geo-tag" style="color:${layerConf.color}">${layerConf.label}</div>`;
    html += `<div class="popup-geo-titre">${titre}</div>`;

    if (sousInfos.length) {
        html += `<div class="popup-geo-sous">${sousInfos.join(" · ")}</div>`;
    }

    /* Reste des propriétés utiles, pour ne rien perdre de la donnée source */
    const reste = Object.keys(props).filter(k =>
        !CHAMPS_MASQUES.has(k) &&
        !(layerConf.titleFields || []).includes(k) &&
        !(layerConf.subtitleFields || []).includes(k) &&
        props[k] !== null && props[k] !== "" && props[k] !== "NULL"
    ).slice(0, 6);

    if (reste.length) {
        html += `<dl class="popup-geo-details">`;
        reste.forEach(k => {
            html += `<dt>${humaniser(k)}</dt><dd>${props[k]}</dd>`;
        });
        html += `</dl>`;
    }

    html += `</div>`;
    return html;
}
