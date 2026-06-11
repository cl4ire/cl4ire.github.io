let dae = L.layerGroup();

//Personnalisation icône dae.geojson
		const daeIcon = L.icon({
			iconUrl: 'img/dae.png',
			iconSize: [16, 16],
			iconAnchor: [16, 16],
			popupAnchor: [0, 0]
		});
		//Ajout de la couche dae.geojson
		fetch('couches/securite/dae.geojson')
			.then(response => response.json())
			.then(data => {
				//Personnalisation de la couche dae.geojson
				L.geoJSON(data, {
					pointToLayer: function (feature, latlng) {
						return L.marker(latlng, {
							icon: daeIcon
						});
					},
					onEachFeature: function (feature, layer) {
						layer.bindPopup(
							`
					<b>${feature.properties.c_nom}</b><br>
					Adresse : ${[feature.properties.c_adr_num, feature.properties.c_adr_voie].filter(Boolean).join(' ')}<br>
					Commune : ${feature.properties.c_com_nom ? feature.properties.c_com_nom : 'Non renseigné'}<br>
					<br>
					<b>Informations complémentaires :</b><br>
					Accès : ${feature.properties.c_acc ? feature.properties.c_acc.replace(/\r?\n/g, '<br>') : 'Non renseigné'}<br>
					${feature.properties.c_acc_complt ? feature.properties.c_acc_complt.replace(/\r?\n/g, '<br>') : 'Non renseigné'}
					`
						);
					}
				}).addTo(dae);
				//dae.addTo(map);
			});