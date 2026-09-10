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
  commune. Attention au dernier segment de l'URL : `.../geojson/parcelles`
  donne bien les parcelles, `.../geojson/communes` donne les *contours de
  commune* (un type de fichier à part dans le jeu de données Etalab, pas un
  simple "regroupé par commune") — confusion qui a fait planter la couche
  une première fois. La réponse est un tableau JSON de Features (pas une
  FeatureCollection), chaque propriété confirmée en conditions réelles :
  `id`, `commune` (code INSEE), `prefixe`, `section`, `numero`, `contenance`
  (surface en m²), `arpente`, `created`, `updated`. `fusionnerCadastre`
  complète chaque parcelle (référence lisible "AB 60", nom de commune) ;
  `extraireFeatures` reste tolérant sur la forme exacte au cas où (tableau,
  FeatureCollection, ou objet regroupé) mais la forme réelle est maintenant
  connue et testée. `layers.js` accepte aussi `file` comme tableau d'URL
  (une par élément, `transform` reçoit alors le tableau des réponses) si
  jamais un seul flux EPCI ne suffit pas pour un autre besoin. Couche
  volumineuse (parcellaire complet de 24 communes, des dizaines de
  milliers de parcelles) : en plus d'être `lazy`, elle ne s'affiche qu'à
  partir du zoom 15 (`zoomMin`) et seulement les parcelles de la vue
  actuelle (`viewportOnly`), pas tout le territoire d'un coup — sinon ça
  voudrait dire construire des dizaines de milliers d'objets Leaflet en
  mémoire (illisible à l'écran et coûteux), pour l'essentiel jamais
  affichés. `layers.js`/`surveillerAffichageCouches` reconstruit la couche
  à chaque déplacement (`moveend`, avec un léger anti-rebond) à partir du
  seul sous-ensemble dont la boîte englobante touche la vue
  (`featuresDansVue`/`bboxFeature`) : les parcelles qui sortent de l'écran
  sont retirées, celles qui y entrent sont ajoutées. Mécanisme générique,
  réutilisable par toute autre couche déclarant `viewportOnly: true`.

Pour ajouter une nouvelle couche en flux du même genre : GeoJSON distant
→ il suffit de mettre une URL absolue dans `file` (avec `transform` si le
format n'est pas déjà du GeoJSON) ; WMS → `type: "wms"` avec `wmsUrl` /
`wmsLayer`. Toutes ces couches restent `lazy: true` puisqu'il s'agit de gros
volumes ou de données à ne récupérer qu'à la demande.

## Popups détaillées

Plusieurs couches ont une fiche popup dédiée dans `js/popup.js` plutôt que
la popup générique (champs bruts affichés tels quels) : carburants,
commerces, banques & DAB, mairies et boîtes aux lettres. `construirePopup`
aiguille sur `layerConf.id`. Les quatre dernières partagent la même base
visuelle (classes CSS `.popup-fiche-*`) et les mêmes briques JS
(`construireContacts`, `construireLignesHoraires`, `construireBadgeOuvert`)
pour rester cohérentes entre elles sans dupliquer le balisage — seules
l'icône, la couleur et les champs source changent d'une couche à l'autre.
Couleurs volontairement variées (pas que du bleu) : ardoise pour les
agences bancaires, terracotta pour les DAB, feuille pour les boîtes aux
lettres, bleu rivière conservé pour les mairies (identité "institution").

- **Commerces** (`construirePopupCommerce`) — catégorie reprise de
  `categorieCommerce`/`TYPES_COMMERCES` (icône + couleur), badge "Ouvert"/
  "Fermé" calculé en direct, contacts formatés (téléphone en `01 23 45 67
  89`, email, site avec juste le nom de domaine affiché) et horaires
  détaillés jour par jour avec le jour courant mis en évidence. Les
  horaires OSM (`opening_hours`) sont interprétés par un petit parseur
  maison (`parserHorairesOsm`/`developperJoursOsm`) qui couvre les motifs
  courants (`Mo-Fr 08:00-19:00`, listes de jours, `24/7`, `off`) sans
  chercher à couvrir toute la spécification (jours fériés, horaires sur
  plusieurs semaines...) — largement suffisant pour les données locales.
  Chaque section (Contact/Horaires) ne s'affiche que si la donnée existe,
  pour rester propre sur les fiches incomplètes.
- **Banques & DAB** (`construirePopupBanque`) — même flux OSM que les
  commerces (`type: "bank"` ou `"atm"`), donc mêmes horaires/badge. Icône
  et couleur diffèrent selon le type (agence vs distributeur) ; une agence
  qui a un DAB sur place (`has_atm`) l'indique par une puce dédiée, et un
  DAB isolé affiche l'enseigne qui l'opère (`operator`) s'il n'a pas de
  nom propre.
- **Mairies** (`construirePopupMairie`) — même principe horaires/contact,
  mais adapté aux champs mairies (`contact_phone`/`contact_email`/
  `contact_website`, horaires en texte libre français plutôt qu'en syntaxe
  OSM : `parserHorairesMairie` reconnaît les lignes du type "Le Mardi : de
  09h00 à 12h00" et les ramène à la même structure interne que les
  horaires OSM pour réutiliser le même code d'affichage/badge). Le champ
  `elus` (liste des membres du conseil municipal, un par ligne
  "NOM Prénom (Rôle)") est affiché dans un `<details>` replié par défaut
  (`construireElus`/`parserElus`) pour ne pas allonger la fiche — extrait
  par un motif plutôt qu'un simple découpage ligne à ligne, car les
  exports observés contiennent des doublons et parfois des lignes recollées
  sans saut de ligne ; les entrées cassées sont ignorées plutôt
  qu'affichées telles quelles, et les doublons dédupliqués par nom.
- **Boîtes aux lettres** (`construirePopupBal`) — la seule information
  utile ici est l'heure de la dernière levée (en semaine et le samedi,
  champs `HDL_SEMAINE_EXTRA`/`HDL_SAMEDI_EXTRA`, format `THH:MM:SS+00:00`
  réduit à `HH:MM`) : pas de badge ouvert/fermé, pas de contact.

Au passage, `couches/commerces/banques.geojson` contenait un problème
d'encodage (UTF-8 doublement encodé : `"CrÃ©dit Mutuel"` au lieu de
`"Crédit Mutuel"`) qui aurait rendu la nouvelle fiche moche sur les noms
accentués — corrigé en réencodant le fichier (le seul touché : les autres
couches testées n'ont pas ce problème).

## Recherche foncière ("Explorer le foncier")

Bouton "Recherche foncière" dans l'en-tête : panneau de filtres (commune,
surface de parcelle, zone PLUi, aléa RGA, ventes DVF, bâti, DPE) pour
n'afficher que les parcelles correspondantes plutôt que de cliquer une par
une. Tout est dans `js/recherche.js`.

**La recherche ne porte que sur les parcelles actuellement affichées à
l'écran**, pas sur les dizaines de milliers de parcelles du territoire
entier : il faut donc être zoomé sur une zone (niveau 15 ou plus, comme
pour l'affichage normal du cadastre) avant de chercher, sinon le panneau
l'indique et le bouton reste désactivé. C'est la même logique que le
rendu de la couche cadastre elle-même (voir plus bas) : `featuresDansVue`
(dans `layers.js`) sert aux deux.

Principe : à l'ouverture du panneau, `chargerDonneesFoncieres` récupère les
5 couches concernées (cadastre, mutations, DPE, PLUi, RGA) en tâche de fond
(sans les ajouter à la carte), puis `enrichirParcelles` calcule, pour
chaque parcelle **actuellement visible** : la mutation DVF correspondante
(référence exacte), la zone PLUi et le niveau RGA à cet endroit (le centre
de la parcelle tombe dans quelle zone ? — `pointDansFeature`, un simple
ray-casting, pas de dépendance externe), et le DPE le plus proche s'il est
à l'intérieur de la parcelle. Comme l'ensemble de départ est déjà réduit à
la vue actuelle (typiquement quelques dizaines à quelques centaines de
parcelles, pas des dizaines de milliers), ce calcul est rapide même sans
optimisation particulière. Une fois fait, changer un critère du formulaire
ne fait que relire ce résultat (`correspond`/`filtrerParcelles`), donc le
nombre de résultats se met à jour en direct sans latence.

"Afficher les parcelles correspondantes" construit une couche Leaflet à
part (`coucheRechercheActuelle`, distincte de `groupesLeaflet["cadastre"]`)
à partir du sous-ensemble filtré, l'ajoute à la carte et cadre la vue
dessus — plafonné à 3000 résultats (`LIMITE_RESULTATS`) par sécurité, même
si le fait de ne partir que de la vue actuelle rend ce plafond peu
probable à atteindre en pratique.

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
