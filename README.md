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

Trois couches interrogent une source distante en direct plutôt qu'un fichier
du dépôt, dans le groupe **Risques & prévention** (et **Mobilité** pour les
carburants) :

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

Pour ajouter une nouvelle couche en flux du même genre : GeoJSON distant
→ il suffit de mettre une URL absolue dans `file` (avec `transform` si le
format n'est pas déjà du GeoJSON) ; WMS → `type: "wms"` avec `wmsUrl` /
`wmsLayer`. Toutes ces couches restent `lazy: true` puisqu'il s'agit de gros
volumes ou de données à ne récupérer qu'à la demande.

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

## Déploiement

Le site est 100% statique : il suffit de pousser tout le dossier sur la
branche GitHub Pages, comme pour la version précédente.
