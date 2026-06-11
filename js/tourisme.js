let randonnees = L.layerGroup();

//Ajout de la couche randonnees.geojson
fetch('couches/tourisme/randonnees.geojson')
    .then(response => response.json())
    .then(data => {
        //Personnalisation de la couche randonnees.geojson
        L.geoJSON(data, {
            style: {
                color: "#008000",
                weight: 3
            },
            onEachFeature: function (feature, layer) {
                layer.bindPopup(
                    `<b>${feature.properties.id}</b><br>
					Distance : ${feature.properties.distance} km<br>
					Durée : ${feature.properties.dureeEstim} h`
                );
            }
        }).addTo(randonnees);
        randonnees.addTo(map);
    });