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

/* Cache pour ne pas reconstruire la même icône plusieurs fois */
const iconeCache = {};

function iconePourCouche(layerConf) {
    const cle = layerConf.id;
    if (!iconeCache[cle]) {
        iconeCache[cle] = creerIcone(layerConf.icon, layerConf.color);
    }
    return iconeCache[cle];
}
