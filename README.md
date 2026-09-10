# GéoBercé — Le SIG local

## Architecture

Tout est piloté depuis **`js/config.js`** : chaque couche (fichier GeoJSON,
groupe, icône, couleur, champs à afficher, chargement différé ou non) y est
décrite une seule fois. Le reste du code est générique et lit cette
configuration — pour ajouter une couche, il suffit d'ajouter une entrée dans
`LAYERS`, pas de toucher au HTML ni de dupliquer du code de chargement.

- `js/config.js` — palette, groupes, thématiques, et la liste de toutes les couches
- `js/icons.js` — icônes de marqueurs (Font Awesome, plus fiable que les emoji)
- `js/popup.js` — construction générique des popups à partir des champs déclarés
- `js/layers.js` — chargement des couches (fetch, clustering, chargement différé)
- `js/panel.js` — construction du panneau de couches depuis la config
- `js/search.js` — recherche unifiée (adresses + données locales)
- `js/hero.js` — écran d'accueil par thématiques
- `js/map.js` — initialisation de la carte et câblage de l'interface

## Points corrigés par rapport à la version précédente

- **Icônes fiables** : Font Awesome plutôt que des emoji (rendu identique sur
  tous les systèmes, y compris Linux sans police d'emoji couleur).
- **Chargement différé** : les fichiers volumineux (DVF ~26 Mo, zonage PLUi,
  RGA, DPE) ne sont fetchés que lorsque l'utilisateur coche la couche —
  ils sont repérés par un petit point orange dans le panneau.
- **Recherche unifiée** : la barre de recherche interroge maintenant à la
  fois l'API Adresse officielle et vos propres couches (mairies, boîtes
  aux lettres, assistantes maternelles, commerces...).
- **Clustering** : les points denses (boîtes aux lettres, commerces...) se
  regroupent automatiquement à dézoomer, pour éviter la superposition.
- **Identité graphique** : couleurs, typographie (Baloo 2) et logo intégrés
  dans tout le site.

## Couches en flux (données distantes, non copiées dans le dépôt)

Ces couches interrogent une source distante en direct plutôt qu'un fichier
du dépôt, dans le groupe **Risques & prévention** (**Mobilité** pour les
carburants, **Habitat & urbanisme** pour le cadastre) :

- **Vigieau** (`id: "vigieau"`) — zones sous arrêté sécheresse en vigueur,
  flux GeoJSON public mis à jour quotidiennement. La couleur (vigilance →
  jaune, alerte → orange, alerte renforcée → rouge, crise → rouge foncé) est
  déduite par mots-clés (`couleurVigieau` dans `config.js`) plutôt que par un
  nom de champ figé, pour rester robuste si le fournisseur change ses noms
  d'attributs.
- **Obligations légales de débroussaillement** (`id: "old"`) — flux WMS de
  l'IGN Géoplateforme (`type: "wms"`, géré par `construireCoucheWMS` dans
  `layers.js`). ⚠️ Le nom de couche WMS (`wmsLayer: "DEBROUSSAILLEMENT"`)
  n'a pas pu être vérifié en conditions réelles (accès réseau restreint
  pendant le développement) : si rien ne s'affiche en cochant la couche,
  vérifiez le nom exact via le GetCapabilities
  (`https://data.geopf.fr/wms-r/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`)
  et ajustez `wmsLayer` dans `js/config.js`.
- **Prix des carburants** (`id: "carburants"`) — flux instantané officiel
  (mis à jour ~10 min), filtré à 25 km autour du territoire via
  `geofilter.distance`. La réponse (format historique Opendatasoft) est
  convertie en GeoJSON par `geojsonDepuisFluxODS` (`layers.js`) avant de
  rentrer dans le pipeline générique de chargement.
- **Parcelles cadastrales** (`id: "cadastre"`) — un seul flux pour tout le
  territoire (`URL_CADASTRE_EPCI` dans `config.js`) : le bundler Etalab par
  EPCI (n° SIREN de la comcom Loir-Lucé-Bercé), plutôt qu'un fichier par
  commune. `fusionnerCadastre`/`extraireFeatures` complètent chaque
  parcelle (référence lisible, nom de commune) et restent tolérants sur la
  forme exacte de la réponse (FeatureCollection unique, tableau, ou objet
  regroupé par commune) : je n'ai pas pu vérifier en conditions réelles la
  structure précise ni les noms de propriétés (`section`, `numero`,
  `contenance`...), accès réseau restreint pendant le développement — si la
  couche ne se charge pas ou affiche des champs vides, ouvrez l'URL dans un
  navigateur pour voir la vraie forme et ajustez `fusionnerCadastre` dans
  `js/config.js` en conséquence. `layers.js` accepte aussi `file` comme
  tableau d'URL (une par élément, `transform` reçoit alors le tableau des
  réponses) si jamais un seul flux EPCI ne suffit pas pour un autre besoin.
  Couche volumineuse (parcellaire complet de 24 communes) : en plus d'être
  `lazy`, elle ne s'affiche qu'à partir du zoom 15 (`zoomMin`, mécanisme
  générique dans `layers.js`/`surveillerZoom`), comme les visualisateurs de
  cadastre habituels — sinon des dizaines de milliers de parcelles se
  superposeraient de façon illisible et coûteuse à styliser.

Pour ajouter une nouvelle couche en flux du même genre : GeoJSON distant
→ il suffit de mettre une URL absolue dans `file` (avec `transform` si le
format n'est pas déjà du GeoJSON) ; WMS → `type: "wms"` avec `wmsUrl` /
`wmsLayer`. Toutes ces couches restent `lazy: true` puisqu'il s'agit de gros
volumes ou de données à ne récupérer qu'à la demande.

## Recherche foncière ("Explorer le foncier")

Bouton "Recherche foncière" dans l'en-tête : panneau de filtres (commune,
surface de parcelle, zone PLUi, aléa RGA, ventes DVF, bâti, DPE) pour
n'afficher que les parcelles correspondantes plutôt que de cliquer une par
une. Tout est dans `js/recherche.js`.

Principe : au premier chargement du panneau, `chargerDonneesFoncieres`
récupère les 5 couches concernées (cadastre, mutations, DPE, PLUi, RGA) en
tâche de fond, sans les ajouter à la carte. `enrichirCadastre` calcule alors
**une seule fois** (résultat mis en cache) pour chaque parcelle : la
mutation DVF correspondante (référence exacte), la zone PLUi et le niveau
RGA à cet endroit (le centre de la parcelle tombe dans quelle zone ? —
`pointDansFeature`, un simple ray-casting, pas de dépendance externe), et le
DPE le plus proche s'il est à l'intérieur de la parcelle. Les recherches
géométriques sont limitées à la même commune (`grouperParChamp`) pour rester
rapides malgré le volume (dizaines de milliers de parcelles) : sans ça,
tester chaque parcelle contre chaque DPE/zone serait bien trop lent. Une
fois ce calcul fait, changer un critère du formulaire ne fait que relire ce
cache (`correspond`/`filtrerParcelles`), donc le nombre de résultats se met
à jour en direct sans latence.

"Afficher les parcelles correspondantes" construit une couche Leaflet à
part (`coucheRechercheActuelle`, distincte de `groupesLeaflet["cadastre"]`)
à partir du sous-ensemble filtré, l'ajoute à la carte et cadre la vue
dessus — plafonné à 3000 résultats (`LIMITE_RESULTATS`) pour éviter
d'afficher des dizaines de milliers de polygones si le formulaire est laissé
trop large.

**Limites volontaires**, faute de données dans le SIG aujourd'hui :
- "Nombre de bâtiments" et "Surface bâtie" viennent de la dernière mutation
  DVF connue (`elements_locaux`) : ça ne concerne donc que les parcelles
  déjà vendues, pas la totalité du bâti existant. Pas de couche "bâtiments"
  indépendante.
- Piscine et permis de construire récents n'apparaissent pas comme
  critères : aucune source de données n'est intégrée au site pour ça. Les
  ajouter demanderait de trouver et intégrer un flux dédié (voir la logique
  déjà en place pour Vigieau/OLD/carburants/cadastre comme modèle).

## Ce qui reste à faire

- Vérifier/ajuster les champs affichés dans les popups pour les couches où
  je n'ai pas pu deviner avec certitude les bons noms de colonnes.
- Le fichier DVF étant volumineux même en différé, envisager de le
  simplifier avec Mapshaper si le chargement reste lent au clic.
- Ajouter les commerces comme thématique dédiée sur la page d'accueil si
  vous voulez la séparer de "Services & mairie" (actuellement dans son
  propre groupe "Commerces").
- Remplacer/compléter les icônes Font Awesome par des icônes SVG maison si
  vous voulez pousser encore plus loin l'identité graphique.
- Suite logique du cadastre : une vraie "fiche parcelle" au clic (ventes DVF,
  DPE, zonage PLUi, aléa RGA à cet endroit, à proximité...) en croisant
  `reference_parcelle` (mutations) avec `reference`/`id` (cadastre), puis
  éventuellement une recherche par critères ("Trouver un terrain").

## Déploiement

Le site est 100% statique : il suffit de pousser tout le dossier sur la
branche GitHub Pages, comme pour la version précédente.
