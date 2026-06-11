let mutations = L.layerGroup();

//#region Ajout de la couche mutations_jupilles.geojson
		fetch('couches/habitat/mutations_jupilles.geojson')
			.then(response => response.json())
			.then(data => {
				//Personnalisation de la couche mutations_jupilles.geojson
				L.geoJSON(data, {
					style: {
						fillColor: "#3498db",
						fillOpacity: .5,
						weight: .2,
						opacity: 1,
						color: "#000000"
					},
					onEachFeature: function (feature, layer) {
						let popupOuverture = false;
						//Cration du tableau des surfaces au sol
						let cultures = feature.properties.nature_cul
							? feature.properties.nature_cul.split(',')
							: [];

						let surfaces = feature.properties.surface_te
							? feature.properties.surface_te.split(',')
							: [];

						let tableauCultures = `
				<table style="border-collapse:collapse;width:100%;">
					<tr>
						<th style="border:1px solid #ccc;padding:4px;">Terrain</th>
						<th style="border:1px solid #ccc;padding:4px;">Surface (m²)</th>
					</tr>
				`;

						for (let i = 0; i < cultures.length; i++) {
							tableauCultures += `
					<tr>
						<td style="border:1px solid #ccc;padding:4px;">${cultures[i]}</td>
						<td style="border:1px solid #ccc;padding:4px;text-align:right;">
							${surfaces[i]
									? Number(surfaces[i]).toLocaleString('fr-FR')
									: '-'}
						</td>
					</tr>`;
						}

						tableauCultures += '</table>';
						//Pop-up
						layer.bindPopup(
							`
					<b>${feature.properties.nature_mut}</b><br>
					<img src="img/tag.png" height="16px"/> ${feature.properties.valeur_fon ? feature.properties.valeur_fon.toLocaleString('fr-FR') + ' €' : 'Non renseigné'}<br>
					<img src="img/calendar.png" height="16px"/> ${feature.properties.date_mutat ? new Date(feature.properties.date_mutat).toLocaleDateString('fr-FR') : 'Non renseigné'}<br>
					<img src="img/pin.png" height="16px"/> ${[feature.properties.adresse_nu, feature.properties.adresse_su, feature.properties.adresse_no].filter(Boolean).join(' ')}<br>
					<br>
					<img src="img/house.png" height="16px"/> ${feature.properties.surface_re ? feature.properties.surface_re.toLocaleString('fr-FR') + ' m²' : 'Non renseigné'}<br>
					Prix au m² : ${feature.properties.prix_m2 ? feature.properties.prix_m2.toLocaleString('fr-FR') + ' €/m²' : 'Non renseigné'}<br><br>
					${tableauCultures}
					`
						),
							layer.on('mouseover', function () {
								if (popupOuverture) return;
								layer.setStyle({
									fillColor: "#2980b9",
									fillOpacity: 1,
									weight: .2,
									opacity: 1,
									color: "#000000"
								});
							}),
							layer.on('mouseout', function () {
								if (popupOuverture) return;
								layer.setStyle({
									fillColor: "#3498db",
									fillOpacity: .5,
									weight: .2,
									opacity: 1,
									color: "#000000"
								});
							}),
							layer.on('popupopen', function () {
								popupOuverture = true;
								layer.setStyle({
									fillColor: "#2980b9",
									fillOpacity: 1,
									weight: .2,
									opacity: 1,
									color: "#000000"
								});
							}),
							layer.on('popupclose', function () {
								popupOuverture = false;
								layer.setStyle({
									fillColor: "#3498db",
									fillOpacity: .5,
									weight: .2,
									opacity: 1,
									color: "#000000"
								});
							})
					}
				});
				//mutations.addTo(map);
			});
//#endregion