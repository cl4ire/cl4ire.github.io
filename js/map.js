//Initialisation de la carte Leaflet
		const map = L.map('map').setView([47.791528, 0.412223], 12);

		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '&copy; OpenStreetMap'
		}).addTo(map);

		//Ajout du bouton de géolocalisation
		L.control.locate({
			position: 'topleft',
			flyTo: true,
			keepCurrentZoomLevel: false
		}).addTo(map);

		//Ajout de la recherche d'adresse
		let marqueurRecherche;
		let timerRecherche;

		const searchInput = document.getElementById("search");
		const suggestions = document.getElementById("suggestions");

		searchInput.addEventListener("input", function () {
			clearTimeout(timerRecherche);
			const recherche = this.value;
			timerRecherche = setTimeout(() => {
				if (recherche.length < 3) {
					suggestions.innerHTML = "";
					return;
				}
				fetch(
					"https://api-adresse.data.gouv.fr/search/?q=" +
					encodeURIComponent(recherche) +
					"&limit=5"
				)
					.then(response => response.json())
					.then(data => {
						suggestions.innerHTML = "";
						data.features.forEach(feature => {
							const div = document.createElement("div");
							div.className = "suggestion";
							div.innerHTML = feature.properties.label;
							div.addEventListener("click", function () {
								const lat =
									feature.geometry.coordinates[1];
								const lon =
									feature.geometry.coordinates[0];
								map.setView([lat, lon], 18);
								if (marqueurRecherche) {
									map.removeLayer(marqueurRecherche);
								}
								marqueurRecherche =
									L.marker([lat, lon])
										.addTo(map)
										.bindPopup(feature.properties.label)
										.openPopup();
								suggestions.innerHTML = "";
								searchInput.value =
									feature.properties.label;
							});
							suggestions.appendChild(div);
						});
					});
			}, 300);
		});

		//Création des couches
		let epci, communes;

		//Ajout de la couche epci.geojson
		fetch('couches/epci.geojson')
			.then(response => response.json())
			.then(data => {
				//Personnalisation de la couche epci.geojson
				epci = L.geoJSON(data, {
					style: {
						color: "#00beff",
						weight: 3,
						fillOpacity: 0
					}
				});
				epci.addTo(map);
			});

		//Ajout de la couche communes.geojson
		fetch('couches/communes.geojson')
			.then(response => response.json())
			.then(data => {
				//Personnalisation de la couche communes.geojson
				communes = L.geoJSON(data, {
					style: {
						color: "#7f7f7f",
						weight: 1,
						fillOpacity: 0,
						dashArray: '5,5'
					}
				});
				communes.addTo(map);
			});

		//Contrôle du chargement des couches
		/*Promise.all([
			fetch('couches/tourisme/randonnees.geojson').then(r => r.json()),
			fetch('couches/services/bal.geojson').then(r => r.json()),
			fetch('couches/securite/dae.geojson').then(r => r.json()),
			fetch('couches/services/mairies.geojson').then(r => r.json()),
			fetch('couches/habitat/mutations_jupilles.geojson').then(r => r.json()),
			fetch('couches/famille/petiteEnfance.geojson').then(r => r.json()),
			fetch('couches/famille/education.geojson').then(r => r.json())
		]).then(([randoData, balData, daeData, mairiesData, dvfData, petiteEnfanceData, educationData]) => {
		*/
            // Création du contrôle des couches
			L.control.layers(null, {
				"🚶 Randonnées": randonnees,
				"🏠 Mutations": mutations,
				"🏛️ Mairies": mairies,
				"📮 BAL": bal,
				"❤️ DAE": dae,
				"⛽ Carburants": carburant,
                "Lieux d'accueil": petiteEnfance,
                "Education": education,
                "Sécheresse": vigieau,
                "Débroussaillement": debroussaillement,
                "Lignes ALEOP":trajets,
                "Arrêts ALEOP":arrets
			}).addTo(map);
		//});