let petiteEnfance = L.layerGroup(),education = L.layerGroup();

//Ajout de la couche petiteEnfance.geojson
fetch('couches/famille/petiteEnfance.geojson')
    .then(response => response.json())
    .then(data => {
        //Personnalisation de la couche petiteEnfance.geojson
        L.geoJSON(data, {
            /*pointToLayer: function (feature, latlng) {
                return L.marker(latlng, {
                    icon: balIcon
                });
            },*/
            onEachFeature: function (feature, layer) {
                layer.bindPopup(
                    `<b>${feature.properties.nom}</b><br>
                    <i>${feature.properties.type}</i><br>
                    Adresse : ${feature.properties.adresse}<br>
                    Téléphone : ${feature.properties.telephone ? `<a href="tel:${feature.properties.telephone}">${feature.properties.telephone}</a>` : 'Non renseigné'}<br>
                    Mail : ${feature.properties.mail ? `<a href="mailto:${feature.properties.mail}">${feature.properties.mail}</a>` : 'Non renseigné'}<br>`
                );
            }
        }).addTo(petiteEnfance);
        //petiteEnfance.addTo(map);
    });

//Ajout de la couche education.geojson
fetch('couches/famille/education.geojson')
    .then(response => response.json())
    .then(data => {
        //Personnalisation de la couche education.geojson
        L.geoJSON(data, {
            /*pointToLayer: function (feature, latlng) {
                return L.marker(latlng, {
                    icon: balIcon
                });
            },*/
            onEachFeature: function (feature, layer) {
                layer.bindPopup(
                    `<b>${feature.properties.name}</b><br>
                    Type : ${feature.properties.type_fr}<br>
                    Statut : ${feature.properties.statut}<br>
                    `
                );
            }
        }).addTo(education);
        //education.addTo(map);
    });