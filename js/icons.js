/* =========================================================
   GÉOBERCÉ — ICÔNES DE MARQUEURS
   Icônes Font Awesome (police vectorielle) plutôt que des
   emoji : rendu identique sur tous les systèmes/navigateurs,
   contrairement aux emoji qui dépendent des polices installées.
   ========================================================= */

function creerIcone(faClass, couleur) {
    return L.divIcon({
        className: "geo-marker",
        html: `
            <div class="geo-marker-icon" style="background:${couleur};">
                <i class="${faClass}"></i>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -16]
    });
}

/* Certaines couches (ex : commerces) veulent une icône/couleur différente
   par entité plutôt qu'une seule pour toute la couche : layerConf.iconePourFeature,
   quand il existe, prend le dessus sur icon/color fixes de la couche. */
function resoudreIconeCouleur(feature, layerConf) {
    if (layerConf.iconePourFeature) {
        const r = layerConf.iconePourFeature(feature);
        if (r) return r;
    }
    return { icon: layerConf.icon, color: layerConf.color };
}

/* Cache pour ne pas reconstruire la même icône plusieurs fois */
const iconeCache = {};

function iconePourCouche(feature, layerConf) {
    const { icon, color } = resoudreIconeCouleur(feature, layerConf);
    const cle = layerConf.id + "|" + icon + "|" + color;
    if (!iconeCache[cle]) {
        iconeCache[cle] = creerIcone(icon, color);
    }
    return iconeCache[cle];
}
