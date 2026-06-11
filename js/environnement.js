let vigieau = L.layerGroup();
let debroussaillement = L.layerGroup();

function styleVigieau(feature){

    switch(feature.properties.niveauGravite){

        case "crise":
            return {
                color:"#c0392b",
                fillColor:"#e74c3c",
                weight:2,
                fillOpacity:0.4
            };

        case "alerte_renforcee":
            return {
                color:"#d35400",
                fillColor:"#e67e22",
                weight:2,
                fillOpacity:0.4
            };

        case "alerte":
            return {
                color:"#f39c12",
                fillColor:"#f1c40f",
                weight:2,
                fillOpacity:0.4
            };

        case "vigilance":
            return {
                color:"#27ae60",
                fillColor:"#2ecc71",
                weight:2,
                fillOpacity:0.3
            };

        default:
            return {
                color:"#7f8c8d",
                fillColor:"#95a5a6",
                weight:1,
                fillOpacity:0.2
            };
    }
};

function onEachFeature(feature, layer){

    layer.bindPopup(`
        <b>${feature.properties.nom}</b><br>
        Niveau : ${feature.properties.niveauGravite}<br>
        Département : ${feature.properties.departement.nom}<br>
        Début de l'arrêté : ${
            feature.properties.arreteRestriction.dateDebut
            ? new Date(feature.properties.arreteRestriction.dateDebut).toLocaleDateString('fr-FR')
            : 'Non renseigné'
        }<br><br>

        <a href="${feature.properties.arreteRestriction.fichier}"
           target="_blank">
           Consulter l'arrêté
        </a>
    `);

};

fetch("https://regleau.s3.gra.perf.cloud.ovh.net/geojson/zones_arretes_en_vigueur.geojson")
.then(response => response.json())
.then(data => {
    data.features = data.features.filter(
    f => f.properties.departement.code === "72"
);
    L.geoJSON(data,{
        style: styleVigieau,
        onEachFeature: onEachFeature
    }).addTo(vigieau);

});

fetch("https://data.geopf.fr/wfs?SERVICE=WFS&REQUEST=GetFeature&VERSION=2.0.0&TYPENAMES=DEBROUSSAILLEMENT%3Adebroussaillement&OUTPUTFORMAT=application%2Fjson&SRSNAME=EPSG%3A4326&dept='072'")
.then(response => response.json())
.then(data => {
    L.geoJSON(data,{
        style: {
            color:"#27ae60",
        }
        }).addTo(debroussaillement);
});