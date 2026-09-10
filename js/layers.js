/* =========================================================
   GÉOBERCÉ — CHARGEUR GÉNÉRIQUE DE COUCHES
   Une seule fonction sait charger n'importe laquelle des
   couches décrites dans config.js, selon son "type".
   ========================================================= */

const groupesLeaflet = {};      // id de couche -> L.LayerGroup / L.MarkerClusterGroup
const souscouchesLeaflet = {};  // id de couche -> { idCategorie: L.LayerGroup } (couches catégorisables, ex : commerces)
const coucheChargee = {};       // id de couche -> bool (déjà fetchée ?)
window.indexRecherche = [];  // alimenté au fur et à mesure du chargement des couches

function couleurPrix(prix) {
    if (prix === null || prix === undefined || isNaN(prix)) return "#b8c0bd";
    if (prix < 1000) return "#2e8b57";
    if (prix < 1300) return "#76a942";
    if (prix < 1600) return "#b7c94a";
    if (prix < 1900) return "#e0c83c";
    if (prix < 2200) return "#eda832";
    if (prix < 2600) return "#e47732";
    return "#c94338";
}

function ajouterAuIndex(feature, latlng, layerConf) {
    if (!layerConf.searchable || !latlng) return;
    const props = feature.properties || {};
    const titre = premierChampValide(props, layerConf.titleFields || []);
    if (!titre) return;

    const { icon, color } = resoudreIconeCouleur(feature, layerConf);

    window.indexRecherche.push({
        titre: String(titre),
        sousTitre: (layerConf.subtitleFields || [])
            .map(c => props[c]).filter(Boolean).join(" · "),
        icon: icon,
        color: color,
        latlng: latlng,
        layerId: layerConf.id,
        groupLabel: (GROUPS[layerConf.group] || {}).label || ""
    });
}

function construireCoucheDonnees(data, layerConf) {

    let cible = L.geoJSON(null, {

        pointToLayer: function (feature, latlng) {
            ajouterAuIndex(feature, latlng, layerConf);
            return L.marker(latlng, { icon: iconePourCouche(feature, layerConf) });
        },

        style: function (feature) {
            if (layerConf.styleFn) {
                return layerConf.styleFn(feature);
            }
            if (layerConf.type === "line") {
                return { color: layerConf.color, weight: 3, opacity: 0.8 };
            }
            if (layerConf.type === "polygon") {
                return { color: layerConf.color, weight: 1, fillColor: layerConf.color, fillOpacity: 0.25 };
            }
            if (layerConf.type === "choropleth") {
                const v = feature.properties[layerConf.valueField];
                return { color: "#fff", weight: 1, fillColor: couleurPrix(v), fillOpacity: 0.6 };
            }
            return {};
        },

        onEachFeature: function (feature, layer) {
            layer.bindPopup(construirePopup(feature, layerConf));
            if (layerConf.type !== "point") {
                ajouterAuIndex(feature, layer.getBounds ? layer.getBounds().getCenter() : null, layerConf);
            }
        }

    });

    cible.addData(data);

    if (layerConf.type === "point" && layerConf.cluster && typeof L.markerClusterGroup === "function") {
        const cluster = L.markerClusterGroup({ maxClusterRadius: 45, disableClusteringAtZoom: 17 });
        cluster.addLayer(cible);
        return cluster;
    }

    return cible;
}

/* Couches "catégorisables" (ex : commerces) : au lieu d'une seule couche
   Leaflet pour toute la donnée, on construit une sous-couche indépendante
   par catégorie (layerConf.categoriser renvoie l'id de catégorie pour
   chaque feature), pour que chacune soit affichable/masquable séparément
   depuis la légende (js/panel.js). groupesLeaflet[id] reste malgré tout
   un layerGroup regroupant tout, pour que la case à cocher principale
   continue de fonctionner comme les autres couches. */
function construireSousCouches(data, layerConf) {
    const categories = (layerConf.legend || [])
        .concat(layerConf.legendDefaut ? [layerConf.legendDefaut] : []);

    const featuresParCategorie = {};
    categories.forEach(cat => { featuresParCategorie[cat.id] = []; });

    (data.features || []).forEach(feature => {
        const catId = layerConf.categoriser(feature);
        if (!featuresParCategorie[catId]) featuresParCategorie[catId] = [];
        featuresParCategorie[catId].push(feature);
    });

    const sousCouches = {};
    Object.keys(featuresParCategorie).forEach(catId => {
        const features = featuresParCategorie[catId];
        if (!features.length) return;
        sousCouches[catId] = construireCoucheDonnees({ type: "FeatureCollection", features }, layerConf);
    });
    return sousCouches;
}

/* Couche image (tuiles WMS) : pas de fetch/GeoJSON, juste un flux de tuiles
   du serveur distant. Utilisé pour les couches réglementaires diffusées
   uniquement en flux OGC (ex : obligations de débroussaillement). */
function construireCoucheWMS(layerConf) {
    return L.tileLayer.wms(layerConf.wmsUrl, {
        layers: layerConf.wmsLayer,
        format: layerConf.wmsFormat || "image/png",
        version: layerConf.wmsVersion || "1.3.0",
        transparent: true,
        opacity: layerConf.opacity || 0.65,
        attribution: layerConf.attribution || ""
    });
}

function chargerCouche(layerConf, onReady, onError) {

    if (coucheChargee[layerConf.id]) {
        if (onReady) onReady();
        return;
    }

    if (layerConf.type === "wms") {
        groupesLeaflet[layerConf.id] = construireCoucheWMS(layerConf);
        coucheChargee[layerConf.id] = true;
        if (onReady) onReady();
        return;
    }

    fetch(layerConf.file)
        .then(r => {
            if (!r.ok) throw new Error("Erreur HTTP " + r.status + " sur " + layerConf.file);
            return r.json();
        })
        .then(data => {
            const geo = layerConf.transform ? layerConf.transform(data) : data;
            if (layerConf.categoriser) {
                const sousCouches = construireSousCouches(geo, layerConf);
                souscouchesLeaflet[layerConf.id] = sousCouches;
                groupesLeaflet[layerConf.id] = L.layerGroup(Object.values(sousCouches));
            } else {
                groupesLeaflet[layerConf.id] = construireCoucheDonnees(geo, layerConf);
            }
            coucheChargee[layerConf.id] = true;
            if (onReady) onReady();
        })
        .catch(err => {
            console.error("Chargement", layerConf.id, ":", err);
            if (onError) onError(err);
        });
}

/* =========================================================
   INITIALISATION : couches non différées chargées tout de
   suite (pour qu'elles alimentent la recherche dès l'ouverture
   du site) ; les couches lourdes attendent d'être cochées.
   ========================================================= */
function initialiserCouches(map) {
    LAYERS.forEach(conf => {
        if (!conf.lazy) {
            chargerCouche(conf, () => {
                if (document.getElementById("layer-" + conf.id)?.checked) {
                    groupesLeaflet[conf.id].addTo(map);
                }
            });
        }
    });
}
