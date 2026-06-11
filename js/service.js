let bal = L.layerGroup(),mairies = L.layerGroup();

//Personnalisation icône bal.geojson
		const balIcon = L.icon({
			iconUrl: 'img/mailbox.png',
			iconSize: [16, 16],
			iconAnchor: [16, 16],
			popupAnchor: [0, 0]
		});
		//Ajout de la couche bal.geojson
		fetch('couches/services/bal.geojson')
			.then(response => response.json())
			.then(data => {
				//Personnalisation de la couche bal.geojson
				L.geoJSON(data, {
					pointToLayer: function (feature, latlng) {
						return L.marker(latlng, {
							icon: balIcon
						});
					},
					onEachFeature: function (feature, layer) {
						layer.bindPopup(
							`Heure de levée - Semaine : ${feature.properties.HDL_SEMAINE_EXTRA ? feature.properties.HDL_SEMAINE_EXTRA.substring(1, 6) : 'Non renseigné'}<br>
					Heure de levée - Samedi : ${feature.properties.HDL_SAMEDI_EXTRA ? feature.properties.HDL_SAMEDI_EXTRA.substring(1, 6) : 'Non renseigné'}`
						);
					}
				}).addTo(bal);
				//bal.addTo(map);
			});
//Personnalisation icône mairie.geojson
		const mairieIcon = L.icon({
			iconUrl: 'img/mairie.png',
			iconSize: [16, 16],
			iconAnchor: [16, 16],
			popupAnchor: [0, 0]
		});
		//Ajout de la couche mairies.geojson
		fetch('couches/services/mairies.geojson')
			.then(response => response.json())
			.then(data => {
				//Personnalisation de la couche mairie.geojson
				L.geoJSON(data, {
					pointToLayer: function (feature, latlng) {
						return L.marker(latlng, {
							icon: mairieIcon
						});
					},
					onEachFeature: function (feature, layer) {
						layer.bindPopup(
							`<b>${feature.properties.name}</b><br>
					Site internet : ${feature.properties.contact_website ? `<a href="${feature.properties.contact_website}" target="_blank">Visiter le site</a>` : 'Non renseigné'}<br>
					Mail : ${feature.properties.contact_email ? `<a href="mailto:${feature.properties.contact_email}">${feature.properties.contact_email}</a>` : 'Non renseigné'}<br>
					Téléphone : ${feature.properties.contact_phone ? `<a href="tel:${feature.properties.contact_phone}">${feature.properties.contact_phone}</a>` : 'Non renseigné'}<br>
					<br>
					<b>Heures d'ouverture :</b><br>
					${feature.properties.opening_hours.replace(/\n/g, '<br>')}
					<br>
					<br>
					<b>Conseil municipal :</b><br>
					${feature.properties.elus.replace(/\r?\n/g, '<br>')}
					`
						);
					}
				}).addTo(mairies);
				mairies.addTo(map);
			});