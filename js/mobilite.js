let carburant = L.layerGroup();
let arrets = L.layerGroup();
let trajets = L.layerGroup();

// Ajout de la couche prix des carburants
		var carburantIcone = L.icon({
			iconUrl: 'img/gas-pump.png',
			iconSize: [24, 24]
		});
		fetch("https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records?limit=100&where=code_departement=72")
			.then(response => response.json())
			.then(data => {
				
				data.results.forEach(station => {
					let popup = `
				<b>${station.ville}</b><br>
				${station.adresse}<br><br>
			`;
					if (station.gazole_prix)
						popup += `⛽ Gazole : ${station.gazole_prix} €/L<br>`;
					if (station.e10_prix)
						popup += `⛽ E10 : ${station.e10_prix} €/L<br>`;
					if (station.sp95_prix)
						popup += `⛽ SP95 : ${station.sp95_prix} €/L<br>`;
					if (station.sp98_prix)
						popup += `⛽ SP98 : ${station.sp98_prix} €/L<br>`;
					L.marker([
						station.geom.lat,
						station.geom.lon
					], { icon: carburantIcone })
						.bindPopup(popup)
						.addTo(carburant);
				});
				//carburant.addTo(map);
			});

//Ajout de la couche arretsALEOP.geojson
fetch('couches/mobilite/arretsALEOP.geojson')
    .then(response => response.json())
    .then(data => {
        //Personnalisation de la couche arretsALEOP.geojson
        L.geoJSON(data, {
            style: {
                color: "#008000",
                weight: 3
            },
            onEachFeature: function (feature, layer) {
                layer.bindPopup(
                    `<b>${feature.properties.name}</b><br>
					Accès PMR : ${feature.properties.wheelchair_boarding}`
                );
            }
        }).addTo(arrets);
        arrets.addTo(map);
    });

    //Ajout de la couche .geojson
fetch('couches/mobilite/reseauALEOP.geojson')
    .then(response => response.json())
    .then(data => {
        //Personnalisation de la couche reseauALEOP.geojson
        L.geoJSON(data, {
            style: function(feature) {
                return {
                    color: feature.properties.route_color,
                    weight: 10
                };
            },
            onEachFeature: function (feature, layer) {
               layer.bindPopup(
                    `<b>${feature.properties.route_short_name}</b><br>
					${feature.properties.route_long_name}`
                );
            }
        }).addTo(trajets);
        trajets.addTo(map);
    });