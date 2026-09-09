/* =========================================================
   GÉOBERCÉ — CHARGEUR GÉNÉRIQUE DE COUCHES
   Une seule fonction sait charger n'importe laquelle des
   couches décrites dans config.js, selon son "type".
   ========================================================= */

const groupesLeaflet = {};   // id de couche -> L.LayerGroup / L.MarkerClusterGroup
const coucheChargee = {};    // id de couche -> bool (déjà fetchée ?)
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

    window.indexRecherche.push({
        titre: String(titre),
        sousTitre: (layerConf.subtitleFields || [])
            .map(c => props[c]).filter(Boolean).join(" · "),
        icon: layerConf.icon,
        color: layerConf.color,
        latlng: latlng,
        layerId: layerConf.id,
        groupLabel: (GROUPS[layerConf.group] || {}).label || ""
    });
}

function construireCoucheDonnees(data, layerConf) {

    let cible = L.geoJSON(null, {

        pointToLayer: function (feature, latlng) {
            ajouterAuIndex(feature, latlng, layerConf);
            return L.marker(latlng, { icon: iconePourCouche(layerConf) });
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

function chargerCouche(layerConf, onReady) {

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
            const couche = construireCoucheDonnees(geo, layerConf);
            groupesLeaflet[layerConf.id] = couche;
            coucheChargee[layerConf.id] = true;
            if (onReady) onReady();
        })
        .catch(err => console.error("Chargement", layerConf.id, ":", err));
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
