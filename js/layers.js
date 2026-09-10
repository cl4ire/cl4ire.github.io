/* =========================================================
   GÉOBERCÉ — CHARGEUR GÉNÉRIQUE DE COUCHES
   Une seule fonction sait charger n'importe laquelle des
   couches décrites dans config.js, selon son "type".
   ========================================================= */

const groupesLeaflet = {};      // id de couche -> L.LayerGroup / L.MarkerClusterGroup
const souscouchesLeaflet = {};  // id de couche -> { idCategorie: L.LayerGroup } (couches catégorisables, ex : commerces)
const coucheChargee = {};       // id de couche -> bool (déjà fetchée ?)
const donneesBrutes = {};       // id de couche -> tableau de Features GeoJSON brutes (croisements/recherches, ex : recherche foncière)
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

    /* layerConf.file peut être une seule URL, ou un tableau (ex : cadastre,
       un fichier par commune) : dans ce cas on récupère tout en parallèle
       et on passe le tableau de réponses à transform() pour fusion. */
    const urls = Array.isArray(layerConf.file) ? layerConf.file : [layerConf.file];

    Promise.all(urls.map(url => fetch(url).then(r => {
        if (!r.ok) throw new Error("Erreur HTTP " + r.status + " sur " + url);
        return r.json();
    })))
        .then(reponses => {
            const data = urls.length > 1 ? reponses : reponses[0];
            const geo = layerConf.transform ? layerConf.transform(data) : data;
            donneesBrutes[layerConf.id] = geo.features || [];
            if (layerConf.viewportOnly) {
                /* Rien construit tout de suite : trop de features pour tout
                   garder en objets Leaflet en mémoire (ex : cadastre, des
                   dizaines de milliers de parcelles). Un layerGroup vide en
                   attendant qu'actualiserCoucheViewport le remplisse par le
                   sous-ensemble réellement visible. */
                groupesLeaflet[layerConf.id] = L.layerGroup();
            } else if (layerConf.categoriser) {
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

/* Certaines couches volumineuses (ex : cadastre) ne s'affichent qu'à
   partir d'un certain niveau de zoom (layerConf.zoomMin), comme les
   visualisateurs de cadastre habituels : dézoomé sur tout le territoire,
   des dizaines de milliers de parcelles ne seraient ni lisibles, ni
   tenables en performance. */
function coucheDoitEtreVisible(conf, map) {
    return !conf.zoomMin || map.getZoom() >= conf.zoomMin;
}

/* ---------- Rendu limité à l'écran (layerConf.viewportOnly) ---------- */

/* Boîte englobante [minLon, minLat, maxLon, maxLat] d'une feature,
   suffisante pour un test d'intersection avec la vue (pas besoin d'être
   exacte au pixel près). */
function bboxFeature(feature) {
    const geom = feature.geometry;
    let coords;
    if (!geom) return null;
    if (geom.type === "Polygon") coords = geom.coordinates.flat(1);
    else if (geom.type === "MultiPolygon") coords = geom.coordinates.flat(2);
    else if (geom.type === "Point") coords = [geom.coordinates];
    else return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    coords.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    });
    return [minX, minY, maxX, maxY];
}

function bboxIntersecteVue(bbox, bounds) {
    if (!bbox) return false;
    return bbox[0] <= bounds.getEast() && bbox[2] >= bounds.getWest() &&
        bbox[1] <= bounds.getNorth() && bbox[3] >= bounds.getSouth();
}

/* Sous-ensemble des features d'une couche dont la boîte englobante
   touche la vue actuelle de la carte. Utilisé à la fois pour le rendu
   (actualiserCoucheViewport) et par la recherche foncière, pour que les
   deux travaillent sur le même "ce qui est affiché à l'écran". */
function featuresDansVue(layerId, map) {
    const bounds = map.getBounds();
    return (donneesBrutes[layerId] || []).filter(f => bboxIntersecteVue(bboxFeature(f), bounds));
}

/* Reconstruit la couche Leaflet d'une couche "viewportOnly" à partir du
   seul sous-ensemble actuellement visible, et remplace l'ancienne sur la
   carte. Bien plus léger que de garder des dizaines de milliers d'objets
   Leaflet en mémoire pour une couche comme le cadastre. */
function actualiserCoucheViewport(conf, map) {
    if (!coucheDoitEtreVisible(conf, map)) {
        if (groupesLeaflet[conf.id] && map.hasLayer(groupesLeaflet[conf.id])) {
            map.removeLayer(groupesLeaflet[conf.id]);
        }
        return;
    }

    const visibles = featuresDansVue(conf.id, map);
    const nouvelle = construireCoucheDonnees({ type: "FeatureCollection", features: visibles }, conf);

    if (groupesLeaflet[conf.id] && map.hasLayer(groupesLeaflet[conf.id])) {
        map.removeLayer(groupesLeaflet[conf.id]);
    }
    groupesLeaflet[conf.id] = nouvelle;
    nouvelle.addTo(map);
}

/* Surveille zoom ET déplacement (moveend couvre les deux) pour : masquer/
   afficher les couches à seuil de zoom (zoomMin), et reconstruire les
   couches "viewportOnly" sur la zone actuellement visible. Un léger
   anti-rebond évite de reconstruire à chaque pixel pendant un survol
   rapide (zoom + déplacement enchaînés). */
function surveillerAffichageCouches(map) {
    let enAttente = null;

    map.on("moveend", () => {
        clearTimeout(enAttente);
        enAttente = setTimeout(() => {
            LAYERS.forEach(conf => {
                if (!coucheChargee[conf.id]) return;
                const checkbox = document.getElementById("layer-" + conf.id);
                if (!checkbox || !checkbox.checked) return;

                if (conf.viewportOnly) {
                    actualiserCoucheViewport(conf, map);
                    return;
                }
                if (!conf.zoomMin) return;

                const doitEtreVisible = coucheDoitEtreVisible(conf, map);
                const estSurCarte = map.hasLayer(groupesLeaflet[conf.id]);
                if (doitEtreVisible && !estSurCarte) groupesLeaflet[conf.id].addTo(map);
                if (!doitEtreVisible && estSurCarte) map.removeLayer(groupesLeaflet[conf.id]);
            });
        }, 150);
    });
}
