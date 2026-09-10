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

Toutes les couches du site affichent une fiche popup dans le même
habillage visuel (classes CSS `.popup-fiche-*`, remplaçant l'ancien style
générique `.popup-geo`, supprimé), et **chaque couche a sa propre fiche
sur mesure** dans `js/popup.js` — champs humanisés en français plutôt que
les noms de colonnes/valeurs brutes de la donnée source (souvent en
anglais, ou des codes type `type_fr: "primaire"`), horaires réellement
interprétées (`parserHorairesOsm`) plutôt qu'affichées telles quelles
quand elles existent. `construirePopup` (fin de fichier) aiguille sur
`layerConf.id` ; seule Vigieau retombe sur une fiche générique
(`construirePopupGenerique`, à partir des `titleFields`/`subtitleFields`
déclarés dans `config.js`), ses noms de champs exacts n'étant pas
garantis d'une mise à jour du fournisseur à l'autre — tout le reste a une
fiche dédiée : carburants, commerces, banques & DAB, mairies, boîtes aux
lettres, parcelles cadastrales, DPE, mutations DVF, déchèteries/tri,
consignes/casiers colis, bornes de recharge, aires de covoiturage,
marchés, aires de jeux, équipements sportifs, petite enfance, écoles,
défibrillateurs, monuments protégés, randonnées, arrêts et lignes ALÉOP,
prix immobilier par commune, zonage PLUi, aléa retrait-gonflement des
argiles. Toutes partagent les mêmes briques JS (`construireContacts`,
`construireLignesHoraires`, `construireBadgeOuvert`...) pour rester
cohérentes sans dupliquer le balisage — seules l'icône, la couleur et les
champs source changent d'une couche à l'autre. Couleurs volontairement
variées (pas que du bleu) : ardoise pour les agences bancaires,
terracotta pour les DAB, feuille pour les boîtes aux lettres, bleu
rivière conservé pour les mairies (identité "institution").

Quelques traductions/normalisations notables, découvertes en construisant
ces fiches : `type_fr`/`type` (écoles, équipements sportifs) sont des
codes bruts (`"primaire"`, `"pitch"`, `"fitness_station"`...) traduits via
un petit dictionnaire des valeurs réellement présentes sur ce territoire
(`LABELS_TYPE_ECOLE`, `LABELS_EQUIPEMENT_SPORTIF`, `LABELS_SPORT`) plutôt
qu'affichés tels quels ; les champs booléens de la couche IRVE (bornes de
recharge, schéma national data.gouv.fr) sont stockés en chaînes
`"True"`/`"False"` plutôt qu'en vrais booléens (`estVrai`) ; le téléphone/
mail de la couche "petite enfance" portent un retour à la ligne de tête
dans la donnée source, nettoyé à l'affichage ; `c_dermnt` (dernière
maintenance d'un défibrillateur) vaut exactement `"2000-01-01"` sur 8
enregistrements — une valeur-sentinelle plutôt qu'une vraie date connue,
traitée comme absente. `couches/services/airesJeu.geojson` avait le même
problème d'encodage UTF-8 doublement encodé que `banques.geojson`
précédemment (`"MarÃ§on"` au lieu de `"Marçon"`) — corrigé pareil.

Toutes les fiches (sur mesure comme générique) se terminent par un bloc
"Itinéraire" (Google Maps / Waze), ajouté en un seul point du code
(`injecterItineraire`, appelé par `construirePopup` et par
`ouvrirPopupParcelle` pour la fiche parcelle qui se construit à part)
plutôt que dupliqué dans chaque fiche : `coordonneesPourItineraire`
calcule un point représentatif de la feature (ses coordonnées pour un
point, le centre de l'anneau extérieur pour un polygone, le point médian
pour une ligne) et `construireItineraire` en fait deux liens de
navigation externe.

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

## Rouvrir la vraie popup depuis "près de chez moi" et la recherche

Cliquer sur un résultat de "près de chez moi" (`js/proximite.js`) ou sur
une suggestion locale de la barre de recherche (`js/search.js`)
construisait avant une popup à part, minimaliste, plutôt que de rouvrir
la vraie fiche déjà stylée du marqueur correspondant — d'où un rendu très
différent (et bien plus pauvre) selon qu'on cliquait sur la carte ou
depuis une de ces deux listes. Chaque entrée de l'index de recherche
(`window.indexRecherche`, alimenté par `ajouterAuIndex` dans
`js/layers.js`) garde maintenant une référence directe vers son objet
Leaflet réel (`layer`, déjà lié à sa popup via `construirePopup` au
chargement de la couche), et `ouvrirPopupIndex` (`js/layers.js`) rouvre
CETTE popup plutôt que d'en reconstruire une :

- Les cases à cocher du panneau ne sont **pas** cochées par défaut : la
  donnée est déjà chargée pour alimenter l'index dès le démarrage du
  site (couches `lazy: false`), mais sa couche Leaflet peut très bien
  n'avoir jamais été ajoutée à la carte — auquel cas `marker.openPopup()`
  ne fait rien (le marqueur n'a pas de carte). `ouvrirPopupIndex` s'assure
  donc d'abord que la couche est affichée (et sa case cochée, pour que
  le panneau reste cohérent) avant de tenter quoi que ce soit.
- Si le marqueur est actuellement replié dans un cluster,
  `marker.openPopup()` ne suffit pas non plus : `trouverGroupeCluster`
  retrouve le `L.MarkerClusterGroup` qui le contient réellement (y
  compris pour les couches catégorisées comme les commerces, où
  `souscouchesLeaflet` porte un cluster par catégorie plutôt qu'un
  seul), pour utiliser `zoomToShowLayer` à la place — la méthode que
  Leaflet.markercluster prévoit justement pour ce cas.
- Pour un résultat qui n'est PAS dans l'index (une adresse géocodée par
  l'API Adresse, dans la barre de recherche) : pas de feature/couche du
  site à réutiliser, donc un marqueur temporaire avec une popup dédiée
  mais légère (`construirePopupAdresse`), dans le même habillage que le
  reste du site plutôt que l'ancien style à part.

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
probable à atteindre en pratique. Le panneau reste ouvert après ce clic
(sur cette même vue "recherche-view") plutôt que de repasser sur l'arbre
de couches normal : sinon on perd ses critères à chaque fois qu'on
regarde le résultat, il faut rouvrir le panneau et tout ressaisir pour
affiner. Un bouton séparé "Vider la sélection sur la carte" (`rf-vider` /
`viderSelectionCarte`) retire seulement la couche de résultats surlignée,
sans toucher aux critères du formulaire — à distinguer de "Réinitialiser
les critères" (`rf-reset`) qui fait l'inverse (vide le formulaire, laisse
la carte telle quelle). Les deux actions sont volontairement séparées.

**Limites volontaires**, faute de données dans le SIG aujourd'hui :
- "Nombre de bâtiments" et "Surface bâtie" viennent de la dernière mutation
  DVF connue (`elements_locaux`) : ça ne concerne donc que les parcelles
  déjà vendues, pas la totalité du bâti existant. Pas de couche "bâtiments"
  indépendante.
- Piscine et permis de construire récents n'apparaissent pas comme
  critères : aucune source de données n'est intégrée au site pour ça. Les
  ajouter demanderait de trouver et intégrer un flux dédié (voir la logique
  déjà en place pour Vigieau/OLD/carburants/cadastre comme modèle).

## Fiche parcelle (popup cadastre)

Cliquer sur une parcelle ouvre une fiche détaillée (`construirePopupCadastre`
dans `js/popup.js`) plutôt qu'un simple popup de champs bruts : bâti, ventes
DVF, DPE, urbanisme (zone PLUi + aléa RGA) et équipements les plus proches
— même esprit "à la Parcellai.re" que la recherche foncière, appliqué à une
seule parcelle au clic. Elle réutilise `infosParcelle` (`js/recherche.js`),
la même fonction que la recherche par critères, désormais factorisée pour
servir aux deux usages sans dupliquer les jointures géométriques
DVF/DPE/PLUi/RGA.

Contrairement aux autres fiches, son contenu dépend de couches encore en
différé (mutations/DPE/PLUi/RGA, `lazy: true`) : les charger à la
construction de CHAQUE parcelle visible aurait déclenché ces 4 flux à
chaque déplacement de carte, pour rien la plupart du temps (l'utilisateur
ne clique que sur une poignée de parcelles). La popup s'ouvre donc d'abord
avec seulement référence/surface/commune (`construirePopupCadastreBase`,
contenu immédiat), puis se complète une fois les données chargées :
`layers.js` écoute l'évènement Leaflet `popupopen` de chaque parcelle
(une seule fois par parcelle, via `layer._infosChargees`) et appelle
`ouvrirPopupParcelle`, qui déclenche `chargerDonneesFoncieres` (la même
fonction que la recherche foncière — idempotente, elle ne re-télécharge
rien si déjà fait) puis remplace le contenu de la popup
(`popup.setContent(...)`) une fois prêt. La section "à proximité" (école,
commerce, mairie les plus proches — `L.LatLng.distanceTo`) n'a pas besoin
de ce chargement différé : ces couches sont `lazy: false`, donc déjà
disponibles dès le chargement initial du site. Elle ne s'affiche
volontairement que pour un terrain à bâtir (zone PLUi `U`/`AUc`, voir
`ZONES_PLUI_CONSTRUCTIBLES`) ou une parcelle qui porte déjà une maison :
sur une parcelle agricole/naturelle sans bâti, la distance à l'école ou au
commerce le plus proche n'a pas de sens. `infosParcelle` ne calcule même
pas ces distances (le plus coûteux du lot) quand ni l'un ni l'autre
n'est vrai — utile aussi pour la recherche par critères, qui appelle la
même fonction sur toutes les parcelles visibles sans jamais utiliser ce
champ.

Au passage, ce travail a mis en évidence un bug dans l'enrichissement
utilisé par la recherche foncière : le zonage PLUi était censé être filtré
par commune via son champ `insee`, or ce champ s'est avéré **systématiquement
vide** dans le flux réel (contrairement au jeu de données de test utilisé
au départ, qui le renseignait) — la zone PLUi ne remontait donc jamais, ni
dans la fiche parcelle ni dans le filtre "Zone PLUi" de la recherche.
Corrigé en cherchant directement la zone qui contient la parcelle sur
l'ensemble des zones (quelques centaines : un point-in-polygon direct
reste rapide), sans étape de regroupement par commune au préalable.
Également corrigé au passage : `elements_locaux` d'une mutation DVF peut
porter sur plusieurs parcelles à la fois (un acte notarié regroupant
plusieurs références) — le nombre de bâtiments/surface bâtie affichés ne
retient désormais que les lots dont le champ `parcelle` correspond
exactement à celle affichée.

## Couches DPE et mutations (DVF) : code couleur + popups dédiées

La fiche parcelle fait maintenant apparaître l'essentiel des mutations et
DPE au clic sur une parcelle, mais les couches "Diagnostics énergétiques"
et "Mutations immobilières (DVF)" restent utiles en tant que telles pour
un usage différent : repérer d'un coup d'œil, en scannant une zone, où se
trouvent les logements les moins performants ou les ventes les plus
chères/abordables, sans cliquer parcelle par parcelle. Pour que ça ait
vraiment cet intérêt, les deux couches sont maintenant colorées plutôt
qu'affichées dans une seule couleur uniforme, et ont leur propre popup
détaillée (avant : popup générique à champs bruts) :

- **DPE** (`iconeDpe` dans `config.js`) — un marqueur par classe
  énergétique (mêmes couleurs que les puces du formulaire de recherche
  foncière et que le badge DPE de la fiche parcelle : `couleurDpe`,
  partagée). Popup dédiée (`construirePopupDpe`) : classe DPE et GES,
  consommation/émissions, type de logement, surface, année de
  construction, énergie de chauffage/eau chaude, date d'établissement.
- **Mutations (DVF)** (`stylePrixMutation` dans `config.js`) — chaque
  parcelle vendue est colorée selon le prix/m² de sa vente la plus
  récente, avec la même échelle de couleur que la choroplethe "Prix
  immobilier par commune" (`couleurPrix`, déjà existante) ; grisée quand
  le prix/m² ne peut pas être calculé (vente de terrain nu, sans bâti).
  Popup dédiée (`construirePopupMutation`) : historique complet des
  ventes connues sur cette parcelle, même bloc que la fiche parcelle
  (`construireVentesHtml`, partagé) via `ventesDepuisMutation` (déplacée
  dans `config.js`, réutilisée aussi par `infosParcelle` dans
  `recherche.js` — un seul endroit qui sait filtrer les lots d'une
  mutation à la bonne parcelle, plutôt que trois implémentations
  différentes du même calcul).

## Déchèteries / tri

La couche `dechets` mélange trois choses différentes sous un seul champ
`type` : déchèterie (`"centre"`), composteur partagé (`"compost"`), et
point d'apport volontaire / colonnes de tri (`"container"`) — plus,
seulement pour ces derniers, jusqu'à 4 indicateurs de flux séparés
(`glass`/`paper`/`plastic_packaging`/`waste`). Avant, tout ça portait la
même icône/couleur uniforme et une popup générique à champs bruts ; les
trois sont maintenant distingués visuellement (`iconeDechet` dans
`config.js`) et ont chacun leur propre fiche popup
(`construirePopupDechet`/`construirePopupDecheterie`/
`construirePopupCompost`/`construirePopupApportVolontaire` dans
`js/popup.js`) :

- **Déchèterie** : icône entrepôt, vert foncé. Nom, commune, opérateur.
- **Composteur partagé** : icône plante, vert. Le champ `opening_hours`
  n'y porte pas de vraies horaires mais un statut d'accès en texte libre
  (`"Public"` / `"Privé"` / `"Privé - Réservé aux habitants inscrits"`) —
  affiché comme un badge Public/Accès réservé plutôt que d'essayer de le
  faire passer pour des horaires OSM.
- **Point d'apport volontaire** : marqueur "camembert"
  (`creerIconeCamembert` dans `icons.js`, un simple `conic-gradient` CSS,
  pas de canvas/SVG) — une part égale par flux trié réellement présent
  (pas de pondération par volume, cette donnée n'existe pas), aux mêmes
  couleurs que les bacs de tri en France : verre en vert, papier en bleu,
  emballages plastique en jaune, ordures ménagères en noir
  (`FLUX_TRI` dans `config.js`). La popup liste les mêmes flux en chips
  colorées ("Tri sélectif"). `resoudreIconeCouleur`/`iconePourCouche`
  (`icons.js`) ont été généralisées pour accepter soit une couleur
  unique (toutes les autres couches), soit `segments` (plusieurs
  couleurs) pour ce marqueur "camembert" — extensible à d'autres couches
  si besoin un jour, sans dupliquer le mécanisme de cache d'icônes.

Deux petites corrections de données à l'affichage (comme ailleurs sur le
site, sans modifier les fichiers sources) : `fluxActif` tolère la
coquille observée `"ye"` au lieu de `"yes"` sur un enregistrement réel ;
`operateurDechet` corrige "Syndicat **Mxte** du Val de Loir" en "Syndicat
**Mixte** du Val de Loir" (une coquille, sur les deux syndicats gérant le
territoire — SYVALORM et Syndicat Mixte du Val de Loir).

## Consignes & casiers colis (Mondial Relay, Amazon Locker, Vinted Go...)

Nouvelle couche `lockers` (groupe Services), en flux comme
Vigieau/OLD/carburants : il n'existe pas de jeu de données dédié publié
par un seul opérateur regroupant toutes les enseignes, mais ces points
sont cartographiés dans OpenStreetMap sous un tag commun
(`amenity=parcel_locker`, avec `brand`/`operator`/`network` selon
l'enseigne), interrogeable en direct via
[Overpass](https://overpass-api.de/) — pas de fichier dans le dépôt,
comme les autres couches "flux" du site.

- `BBOX_TERRITOIRE` (dans `config.js`) : rectangle englobant la comcom,
  dérivé de la boîte englobante de `couches/epci.geojson` (le polygone
  exact du territoire fait plus de 4000 sommets, bien trop pour un
  filtre Overpass `poly:` précis — un simple rectangle, élargi d'~1 km,
  suffit très largement pour un territoire de cette taille).
- `geojsonDepuisOverpass` convertit la réponse Overpass (JSON natif de
  l'API — un tableau `elements`, pas du GeoJSON) en GeoJSON standard
  pour réutiliser le même pipeline de chargement que les autres couches.
- `fetchOverpassLockers` (`config.js`) réessaie sur plusieurs miroirs
  Overpass publics l'un après l'autre (`MIROIRS_OVERPASS`) plutôt qu'un
  seul serveur fixe : l'instance principale (overpass-api.de) répond
  parfois 504 sous charge (constaté en conditions réelles), un simple
  échec ne doit pas faire tomber toute la couche. Branché via
  `layerConf.fetchPersonnalise`, un point d'extension générique ajouté à
  `chargerCouche` (`layers.js`) — une couche peut fournir sa propre
  logique de récupération (retries, miroirs...) à la place du
  fetch/transform standard, réutilisable par d'autres couches si besoin.
- `categorieLocker`/`TYPES_LOCKERS` reconnaissent l'enseigne par
  mots-clés sur `brand`/`operator`/`network`/`name` (Mondial Relay,
  Amazon Locker, Vinted Go, InPost, Chronopost, Colissimo, Relais Colis/
  Pickup, DPD, UPS Access Point, avec un repli "Autre opérateur"),
  chacune avec sa propre couleur de marqueur — même mécanisme que les
  catégories de commerces. Popup dédiée (`construirePopupLocker`) :
  enseigne, adresse (reconstruite depuis les champs `addr:*` OSM),
  horaires (beaucoup sont en `24/7`) et contact, en tolérant les deux
  conventions de balisage OSM pour le téléphone/site
  (`phone`/`website` et `contact:phone`/`contact:website`).

**Limite à avoir en tête** : la couverture dépend entièrement de ce que
les contributeurs OpenStreetMap ont déjà cartographié localement. Les
réseaux anciens et très cartographiés (Mondial Relay, Amazon Locker)
devraient bien remonter ; les réseaux récents ou en forte expansion
(Vinted Go en particulier, souvent hébergé dans des commerces déjà
existants comme des supermarchés ou des laveries plutôt que dans un
local dédié) peuvent être sous-représentés par rapport à la réalité du
terrain, sans qu'il y ait de moyen fiable de le détecter automatiquement
depuis le site. Pas de solution miracle à ça, c'est la limite du
crowdsourcing — si des casiers manquent visiblement dans une commune du
territoire, la meilleure remédiation est de les ajouter à OpenStreetMap
directement (ils remonteront alors automatiquement ici, sans rien changer
au site).

## Ce qui reste à faire

- Le fichier DVF étant volumineux même en différé, envisager de le
  simplifier avec Mapshaper si le chargement reste lent au clic.
- Ajouter les commerces comme thématique dédiée sur la page d'accueil si
  vous voulez la séparer de "Services & mairie" (actuellement dans son
  propre groupe "Commerces").
- Remplacer/compléter les icônes Font Awesome par des icônes SVG maison si
  vous voulez pousser encore plus loin l'identité graphique.
- La fiche parcelle et la recherche foncière existent maintenant toutes les
  deux ; suite logique possible : une recherche "inversée" façon
  Parcellai.re ("terrain de 800 à 1 200 m², un seul bâtiment, zone
  constructible" → liste de candidats), déjà en grande partie couverte par
  les critères actuels de la recherche foncière.
- Couche `lockers` (consignes/casiers colis) : confirmée fonctionnelle en
  conditions réelles, avec un repli sur plusieurs miroirs Overpass en cas
  de 504 du serveur principal (voir plus haut). Si malgré tout rien ne
  s'affiche en cochant la couche, la console liste chaque miroir essayé
  (`console.warn`) avant l'erreur finale — de quoi savoir lequel a
  répondu quoi, plutôt que de deviner.

## Déploiement

Le site est 100% statique : il suffit de pousser tout le dossier sur la
branche GitHub Pages, comme pour la version précédente.
