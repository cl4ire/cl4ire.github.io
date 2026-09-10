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

## Points relais & casiers colis (Mondial Relay, Amazon Locker, Vinted Go...)

Nouvelle couche `lockers` (groupe Services), en flux comme
Vigieau/OLD/carburants : il n'existe pas de jeu de données dédié publié
par un seul opérateur regroupant toutes les enseignes, mais ces points
sont cartographiés dans OpenStreetMap, interrogeable en direct via
[Overpass](https://overpass-api.de/) — pas de fichier dans le dépôt,
comme les autres couches "flux" du site.

**Trois tags OSM différents interrogés, pas un seul.** Au départ, seul
`amenity=parcel_locker` (un vrai casier automatique) était interrogé —
ce qui ne remontait presque aucun point Mondial Relay (2 sur tout le
territoire), signalé en conditions réelles. En cause : la grande
majorité des points Mondial Relay ne sont **pas** des casiers, ce sont
des "Points Relais" hébergés dans des commerces existants (tabac,
presse, épicerie...), tagués sur le commerce lui-même via
`post_office=post_partner` (+ `post_office:brand`/
`post_office:service_provider` pour l'enseigne) — un schéma OSM à part,
bien documenté, complètement différent d'`amenity=parcel_locker`.

Un deuxième signalement en conditions réelles (des casiers connus près
d'un Leclerc absents de la couche) a mis en évidence un troisième cas :
certains casiers, notamment Amazon Locker, restent tagués selon
l'**ancien** schéma OSM `amenity=vending_machine` + `vending=parcel_pickup`
(ou `parcel_mail_in`) — officiellement déprécié au profit
d'`amenity=parcel_locker`, un bot a fait la bascule il y a plusieurs
années, mais elle n'a pas forcément atteint 100% de la base dans les
zones moins actives en contributions OSM (typiquement, un parking de
supermarché en zone rurale édité une fois puis plus jamais retouché).
Coûte rien d'interroger aussi cet ancien schéma en plus du nouveau. La
requête (`REQUETE_OVERPASS_LOCKERS`) interroge donc les trois à la fois :

- `BBOX_TERRITOIRE` (dans `config.js`) : rectangle englobant la comcom,
  dérivé de la boîte englobante de `couches/epci.geojson` (le polygone
  exact du territoire fait plus de 4000 sommets, bien trop pour un
  filtre Overpass `poly:` précis — un simple rectangle, élargi d'~1 km,
  suffit très largement pour un territoire de cette taille).
- `geojsonDepuisOverpass` convertit la réponse Overpass (JSON natif de
  l'API — un tableau `elements`, pas du GeoJSON) en GeoJSON standard :
  gère à la fois les nodes (lat/lon directs) et les ways (un point
  relais peut être tagué sur le contour d'un bâtiment plutôt qu'un
  simple point — `out center` dans la requête fournit alors un centre).
- Le filtre `["vending"~"parcel"]` (troisième branche de la requête)
  attrape aussi bien `vending=parcel_pickup` que `parcel_mail_in` ou la
  valeur combinée `parcel_pickup;parcel_mail_in` — une simple recherche
  de sous-chaîne plutôt qu'une égalité stricte, pour rester robuste aux
  variantes de valeur du même tag.
- `fetchOverpassLockers` (`config.js`) réessaie sur plusieurs miroirs
  Overpass publics l'un après l'autre (`MIROIRS_OVERPASS`) plutôt qu'un
  seul serveur fixe : l'instance principale (overpass-api.de) répond
  parfois 504 sous charge (constaté en conditions réelles), un simple
  échec ne doit pas faire tomber toute la couche. Branché via
  `layerConf.fetchPersonnalise`, un point d'extension générique ajouté à
  `chargerCouche` (`layers.js`) — une couche peut fournir sa propre
  logique de récupération (retries, miroirs...) à la place du
  fetch/transform standard, réutilisable par d'autres couches si besoin.
- Réponse mise en cache dans `localStorage` 6h (`lireCacheLockers`/
  `ecrireCacheLockers`) : Overpass, service public gratuit, demande
  explicitement à ses consommateurs de mettre en cache plutôt que de le
  solliciter en boucle pour la même requête — et c'est aussi
  concrètement ce qui a déclenché un `429 Too Many Requests` en
  conditions réelles après plusieurs tests successifs (recharger la
  page revenait à refaire la requête à chaque fois : `chargerCouche` a
  bien un garde-fou contre les doublons, mais seulement en mémoire, pas
  d'un chargement de page à l'autre). Dégrade proprement si
  `localStorage` est indisponible (navigation privée stricte, quota
  dépassé...) : retombe simplement sur le réseau à chaque fois plutôt
  que de planter.
- `categorieLocker`/`TYPES_LOCKERS` reconnaissent l'enseigne par
  mots-clés, aussi bien sur les champs d'un casier
  (`brand`/`operator`/`network`/`name`) que sur ceux d'un point relais
  (`post_office:brand`/`post_office:service_provider`) : Mondial Relay,
  Amazon Locker, Vinted Go, InPost, Chronopost, Colissimo, Relais Colis/
  Pickup, DPD, UPS Access Point, Hermes/Evri, avec un repli "Autre
  opérateur" — chacune avec sa propre couleur de marqueur, même
  mécanisme que les catégories de commerces. `estPointRelaisCommerce`
  distingue en plus les deux types de point pour l'icône (casier vs
  magasin) et pour un repère visuel dans la popup dédiée
  (`construirePopupLocker`) : enseigne, adresse (reconstruite depuis les
  champs `addr:*` OSM), horaires (beaucoup de casiers sont en `24/7`) et
  contact, en tolérant les deux conventions de balisage OSM pour le
  téléphone/site (`phone`/`website` et `contact:phone`/
  `contact:website`).

**Limite à avoir en tête, malgré les trois schémas de tags interrogés** :
la couverture dépend entièrement de ce que les contributeurs
OpenStreetMap ont déjà cartographié localement — pas de ce qui existe
réellement sur le terrain. Un casier ou un point relais bien réel mais
que personne n'a encore ajouté à OpenStreetMap (pas de node du tout,
sous aucun des trois schémas) restera invisible ici quel que soit le
nombre de variantes de tags interrogées : ce n'est pas un bug de
requête à corriger, c'est un vrai trou dans la donnée source. Les
réseaux anciens et très cartographiés (Mondial Relay, Amazon Locker)
devraient bien remonter dans l'ensemble ; les réseaux récents ou en
forte expansion (Vinted Go en particulier) peuvent rester
sous-représentés, et même les réseaux bien couverts peuvent avoir des
trous ponctuels (un point installé récemment, ou dans une zone peu
éditée sur OSM). Pas de solution miracle à ça, c'est la limite du
crowdsourcing — si un point manque visiblement quelque part sur le
territoire, la seule vraie remédiation est de l'ajouter à OpenStreetMap
directement (sur [osm.org](https://www.openstreetmap.org/), ou plus
simplement via l'appli [StreetComplete](https://streetcomplete.app/) qui
guide pas à pas pour ce genre d'ajout) : il remontera alors
automatiquement ici au prochain chargement de la couche, sans rien
changer au site.

### Combler un trou tout de suite : `couches/services/lockers_manuels.geojson`

Ajouter un point à OpenStreetMap est la bonne solution de fond (ça
profite à tout le monde, pas seulement ce site), mais ça ne dépend pas
de vous seul⋅e (quelqu'un doit valider/republier la donnée) et ça ne
règle rien dans l'immédiat. Pour un besoin ponctuel — "il y a bien un
casier là, pourquoi il n'apparaît pas" — `fetchOverpassLockers`
(`config.js`) fusionne systématiquement les résultats d'Overpass avec ce
petit fichier local, à chaque chargement de la couche (pas de cache
dessus, contrairement à Overpass : un ajout doit être visible tout de
suite). Pour ajouter un point :

1. Repérer ses coordonnées (clic droit sur le point exact dans Google
   Maps ou [osm.org](https://www.openstreetmap.org/) → "Que se
   trouve-t-il ici ?" copie le `lat, lon`).
2. Ajouter une entrée dans le tableau `features` du fichier, sur ce
   modèle (mêmes noms de champs qu'un point OpenStreetMap, pour que la
   catégorisation/couleur/popup fonctionnent sans aucune différence avec
   un point venu d'Overpass — voir `categorieLocker`/`TYPES_LOCKERS`
   dans `config.js` pour la liste des enseignes reconnues) :

   ```json
   {
     "type": "Feature",
     "geometry": { "type": "Point", "coordinates": [LONGITUDE, LATITUDE] },
     "properties": {
       "amenity": "parcel_locker",
       "brand": "Mondial Relay",
       "name": "Casier Mondial Relay - Leclerc Montval-sur-Loir",
       "addr:street": "ZAC du Chêne vert",
       "addr:city": "Montval-sur-Loir",
       "opening_hours": "24/7"
     }
   }
   ```

   Pour un point relais hébergé dans un commerce (pas un casier
   automatique), utiliser plutôt le schéma `post_office=post_partner` +
   `post_office:brand`/`post_office:service_provider` — voir la section
   ci-dessus pour le détail des champs, mêmes conventions qu'un point
   Overpass. `opening_hours` suit la syntaxe OSM habituelle
   (`Mo-Fr 08:00-19:00`, `24/7`...).
3. Vérifier que le fichier reste un JSON valide (une virgule entre deux
   objets `Feature` si vous en ajoutez plusieurs).
4. **Important** : une fois que ce point a été ajouté à OpenStreetMap
   (par vous ou quelqu'un d'autre) et qu'il remonte via Overpass, le
   retirer de ce fichier pour éviter un doublon sur la carte — ce fichier
   n'est qu'un pense-bête temporaire, pas une seconde base à maintenir en
   parallèle indéfiniment.

## Médecins, vétérinaires, bibliothèques, offices de tourisme, aires de camping-car

Cinq nouvelles couches en flux Overpass (OpenStreetMap), sur le même principe
que les points relais/casiers colis ci-dessus : `medecins` et `veterinaires`
(groupe Sécurité & santé), `bibliotheques` (groupe Services & mairie),
`officesTourisme` et `campingcar` (groupe Nature & rando). Choisies après
recherche de données pertinentes pour un portail grand public (demande
explicite : "tout avoir à un seul et même endroit"), avec validation de
l'utilisatrice avant intégration — voir aussi les pistes écartées ci-dessous.

- `creerFetchOverpass(requete, cacheCle)` (`config.js`) **généralise** la
  logique déjà utilisée pour les casiers colis (repli sur plusieurs miroirs,
  cache `localStorage` 6h) plutôt que de la dupliquer cinq fois : chaque
  couche ne fournit que sa propre requête Overpass et sa propre clé de
  cache. `geojsonDepuisElementsOverpass` convertit la réponse (nodes et
  ways, via `out center`) en GeoJSON standard — pas de fichier local de
  complément ici, contrairement aux casiers colis, ce garde-fou n'ayant de
  sens que là où un trou de couverture précis a été signalé et confirmé sur
  le terrain (voir la section dédiée plus haut).
- **Médecins** (`amenity=doctors` + `healthcare=doctor`, les deux tags
  coexistent selon le contributeur, Overpass dédoublonne de lui-même) :
  absent de toute autre couche du site (vérifié dans `commerces.geojson`,
  qui ne contient que des pharmacies/opticiens/audioprothésistes sous sa
  catégorie "Santé"), donc pas de doublon. Spécialité (`healthcare:speciality`)
  traduite via un petit dictionnaire (`LABELS_SPECIALITE_MEDECIN`,
  `js/popup.js`), repli sur "Médecin généraliste" si absente. Lien
  "Chercher un RDV sur Doctolib" (`construireLienDoctolib`) ajouté dans le
  bloc contact **seulement pour la médecine générale** (pas de
  `healthcare:speciality`, ou explicitement `general_practitioner`) :
  Doctolib n'a pas d'API publique de recherche par praticien, donc pas de
  moyen fiable de retrouver la fiche exacte d'un médecin depuis son
  nom/adresse OSM — le lien pointe vers la recherche par ville
  (`doctolib.fr/medecin-generaliste/<ville>`, schéma d'URL public vérifié),
  pas vers un profil précis (d'où le libellé "Chercher", pas "Prendre
  rendez-vous avec ce médecin"). Pas de lien pour les autres spécialités :
  plutôt ne rien afficher qu'un slug de spécialité Doctolib deviné et
  potentiellement cassé.
- **Vétérinaires** (`amenity=veterinary`) : même principe, fiche minimale
  (nom/enseigne, adresse, horaires, contact).
- **Bibliothèques & médiathèques** (`amenity=library`) : accès Internet
  (`internet_access`) et accessibilité PMR affichés quand renseignés.
- **Offices de tourisme** (`office=tourism`, + repli sur l'ancien schéma
  `tourism=information` + `information=office`).
- **Aires de camping-car** (`tourism=caravan_site`) : capacité, vidange
  sanitaire, eau potable, électricité et gratuité affichées quand
  renseignées (`sanitary_dump_station`/`drinking_water`/`power_supply`/`fee`,
  valeurs `yes`/`no` telles que balisées sur OSM, pas la convention
  `True`/`False` des flux nationaux).

Trois couches supplémentaires ajoutées ensuite, même principe, toujours
groupe Sécurité & santé :

- **Dentistes** (`amenity=dentist`) : fiche identique à celle des médecins
  (adresse, horaires, contact), sans lien Doctolib (schéma d'URL de
  recherche par spécialité non vérifié pour les dentistes, voir plus bas).
- **Casernes de pompiers** (`amenity=fire_station`) et **Gendarmerie &
  police** (`amenity=police`, `libelleForceOrdre` distingue Gendarmerie/
  Police municipale/Police nationale par mots-clés dans `operator`/`name`)
  — fiches volontairement minimales (pas d'horaires publiques à afficher,
  pas vocation à être appelées pour autre chose qu'une urgence) : un
  simple rappel du 18/112 ou du 17/112 plutôt qu'un numéro de standard qui
  inciterait à l'appeler à la place du bon numéro d'urgence.

Les huit fiches réutilisent les mêmes aides que les casiers colis
(`construireContacts`, `parserHorairesOsm`, `construireBadgeOuvert`...) via
deux petites fonctions communes (`adresseOsm`/`contactsOsm` dans
`popup.js`) plutôt que de dupliquer la reconstruction d'adresse/contact
cinq fois de plus.

**Même limite que les casiers colis** : la couverture dépend de ce que les
contributeurs OpenStreetMap ont déjà cartographié, pas de ce qui existe
réellement sur le territoire — un cabinet médical ou une aire de
camping-car bien réel mais jamais ajouté à OSM restera invisible ici. Pas
de fichier manuel de complément prévu pour l'instant (contrairement aux
casiers colis, où des trous précis avaient été signalés et confirmés) :
à ajouter le jour où un trou similaire est signalé sur l'une de ces
couches, en suivant le même modèle que `lockers_manuels.geojson`.

## France Services

Couche `franceServices` (groupe Services & mairie), sur un principe
différent des couches Overpass ci-dessus : pas de flux public filtrable
par territoire côté ANCT (contrairement à Overpass), donc **fichier
statique** dans le dépôt (`couches/services/franceServices.geojson`),
comme la plupart des couches du site — un extrait filtré du CSV national
"Liste des structures labellisées France services" (ANCT, data.gouv.fr),
fourni par l'utilisatrice le 10/09/2026 (`insee_com` sur les 24 communes du
territoire, `js/config.js` → `COMMUNES_TERRITOIRE`) : 3 points, tous
rattachés au Grand-Lucé/La Chartre-sur-le-Loir.

- Champs français gardés tels quels depuis le CSV source (`lib_fs`,
  `adresse`, `mail`, `telephone`, `prise_rdv`, `commentaire`,
  `labellisation_fs`...) plutôt que renommés, comme les autres couches du
  site (DPE, mutations, commerces...) : humanisés seulement à l'affichage
  dans `construirePopupFranceServices` (`popup.js`).
- Horaires en six champs séparés par jour (`h_lundi`...`h_samedi`,
  format `"09:00 - 12:30 / 14:00 - 17:30"`), pas en syntaxe OSM :
  `parserHorairesFranceServices` les ramène à la même structure
  `{Mo: [...], ...}` que `parserHorairesOsm` pour réutiliser
  `construireLignesHoraires`/`construireBadgeOuvert` sans dupliquer
  l'affichage.
- Un point peut être un **bus itinérant** (`format_fs: "Bus_équivalent"`
  ou `"Mobile"`) plutôt qu'un lieu fixe — cas réel sur ce territoire (le
  bus France services du Centre Social Rural de Lucé dessert toute la
  comcom en tournée, rattaché administrativement à la même adresse que
  l'espace fixe du Grand-Lucé). Afficher ses horaires comme un vrai
  horaire d'accueil sur place aurait été trompeur : la fiche affiche à la
  place une puce "Bus itinérant sur le territoire" et masque le badge
  ouvert/fermé.

**Mise à jour** : pas de mécanisme automatique (contrairement aux couches
Overpass, qui se resynchronisent seules) — retélécharger le CSV le plus
récent depuis le [dataset ANCT sur data.gouv.fr](https://www.data.gouv.fr/datasets/liste-des-structures-labellisees-france-services)
et relancer un filtre sur `insee_com` ∈ `COMMUNES_TERRITOIRE` (même
script que celui utilisé pour produire le fichier actuel : lecture CSV
`;`-séparé avec BOM UTF-8, un `Feature` par ligne retenue,
`[longitude, latitude]` depuis les colonnes `latitude`/`longitude`).

### Pistes écartées

Deux données explicitement demandées mais volontairement **non**
intégrées comme couches, faute de source de données ouverte exploitable :

- **Cadastre solaire** — `loirluceberce.cadastre-solaire.fr` existe bien et
  couvre le territoire, mais c'est un outil interactif propriétaire (édité
  par Cythelia Energy) sans export de données en masse ni couche WMS
  documentée : rien à tracer par bâtiment sur la carte sans reproduire leur
  simulateur. Décision (validée) : pas de lien ajouté au portail non plus.
- **Pharmacie de garde** — aucune donnée ouverte ni API stable identifiée
  (le service officiel `pharmacie-de-garde.ameli.fr` n'expose rien
  d'exploitable ; les alternatives sont des agrégateurs commerciaux, risque
  CGU comparable au problème initial des casiers colis). Décision
  (validée) : rien ajouté.
- **Pharmacies** — déjà présentes et catégorisées dans la couche
  `commerces` existante (catégorie "Santé") : pas de couche séparée, ça
  aurait fait doublon.
- **Remplacer OpenStreetMap par data.gouv.fr pour la couche médecins** —
  investigué à la demande explicite de l'utilisatrice, deux options
  trouvées, aucune n'est une amélioration :
  - "Annuaire santé Ameli" (dataset statique data.gouv.fr) : depuis sa
    refonte, ne contient plus les horaires de cabinet ni les tarifs
    (justement ce qu'OSM permet d'afficher aujourd'hui), mis à jour
    seulement une fois par an, et volumineux à l'échelle nationale
    (aurait nécessité un extrait déjà filtré, fourni par un humain, comme
    pour le DVF/DPE/PLUi).
  - API FHIR Annuaire Santé (ANS/esante.gouv.fr) : bien plus riche et à
    jour, mais exige une clé API personnelle liée à un compte — pas
    intégrable proprement dans un site statique GitHub Pages sans
    l'exposer publiquement dans le code source à chaque visiteur.
  Décision (validée) : couche `medecins` laissée sur OpenStreetMap/Overpass.

## EHPAD, toilettes publiques, points d'eau, itinéraires cyclables, historique des catastrophes naturelles

Cinq couches supplémentaires, suite au brainstorming avec l'utilisatrice
sur "quelles autres données seraient intéressantes" :

- **EHPAD & maisons de retraite** (`amenity=social_facility` +
  `social_facility=nursing_home`, groupe Sécurité & santé) et
  **Toilettes publiques**/**Points d'eau potable** (`amenity=toilets`/
  `drinking_water`, groupe Services & mairie) : même architecture
  Overpass que toutes les couches précédentes (`creerFetchOverpass`),
  rien de nouveau côté mécanique.
- **Itinéraires cyclables** (`velo`, groupe Nature & rando, ex. "Le Loir
  à Vélo") : premier flux Overpass sur des **relations** (`route=bicycle`)
  plutôt que de simples nœuds/ways - `out geom;` (pas `out center;`)
  pour récupérer la géométrie complète de chaque way membre,
  `geojsonDepuisRoutesVelo` (`config.js`) construit une Feature
  `MultiLineString` par relation (une ligne par way membre). Couche
  `type: "line"`, non "searchable" comme les autres lignes du site
  (`randonnees`/`reseauALEOP`) : l'indexation de recherche n'est pas
  conçue pour les géométries non ponctuelles.
- **Historique des catastrophes naturelles** (`catnat`, groupe Risques
  & prévention) : point de départ initial "zones inondables (PPRI)",
  écarté en cours de route — l'API Géorisques a bien des endpoints AZI/
  MVT/cavités/zonage sismique en accès libre, mais impossible de
  confirmer si une géométrie exploitable (polygone de zone) en sort
  réellement, seulement des descriptions de documents/atlas selon la
  documentation trouvée. Pivot vers l'endpoint **CATNAT** (arrêtés de
  catastrophe naturelle, base GASPAR), confirmé accessible sans jeton et
  interrogeable par `code_insee` (`.../api/v1/gaspar/catnat?code_insee=...`)
  — un couple requête/paramètre nettement plus simple à interroger de
  façon fiable que des polygones de zonage inconnus. Géométrie reprise
  de `couches/communes.geojson` (déjà dans le dépôt, 24 polygones) : le
  flux Géorisques ne fournit que la liste d'événements par commune,
  `fetchCatnat`/`geojsonDepuisCatnat` (`config.js`) les rattachent aux
  polygones existants. Une seule requête par commune (24 au total,
  `Promise.all`), pas de rectangle englobant possible côté cette API
  contrairement à Overpass.

  ⚠️ **Comme la couche OLD/WMS plus haut, la forme exacte de la réponse
  CATNAT n'a pas pu être vérifiée en conditions réelles** (accès réseau
  restreint pendant le développement) : l'existence et le paramétrage de
  l'endpoint sont confirmés, mais pas les noms exacts des champs par
  événement ni l'enveloppe de réponse (tableau brut ? `{data:[...]}` ?
  `{results:[...]}` ?). Le code lit plusieurs formes possibles
  (`elementsReponseCatnat`) et plusieurs noms de champs candidats par
  valeur affichée (`libelleEvenementCatnat`/`dateEvenementCatnat`,
  `js/popup.js`) plutôt que d'en supposer une seule — dégrade
  proprement vers "Aucun arrêté recensé" si la réponse ne correspond à
  aucune des formes prévues (pas de fiche cassée), mais un vrai test en
  conditions réelles reste à faire : si en cochant la couche toutes les
  communes affichent "Aucun arrêté" alors que ce n'est probablement pas
  le cas partout, inspecter la réponse réseau réelle de
  `/api/v1/gaspar/catnat?code_insee=<un code du territoire>` et ajuster
  `elementsReponseCatnat`/`libelleEvenementCatnat`/`dateEvenementCatnat`
  en conséquence. Cache `localStorage` 24h (`CACHE_CATNAT_DUREE_MS`),
  plus long que les 6h des flux Overpass : un historique d'arrêtés
  publiés change rarement, pas besoin de retaper l'API aussi souvent.

## Tous les sentiers de randonnée + points remarquables de la forêt de Bercé

Deux demandes de l'utilisatrice à la suite du brainstorming précédent.

**Randonnées** — la couche `randonnees` ne contenait qu'un seul tracé
digitalisé à la main (`couches/tourisme/randonnees.geojson`, id "J1").
Passée en flux Overpass (relations `route=hiking`, même principe que les
itinéraires cyclables : `out geom;` pour la géométrie complète), **fusionné
avec le tracé existant** plutôt que de le remplacer (`fetchRandonnees`,
même schéma flux + fichier local que les casiers colis) : on ne sait pas
si ce tracé est déjà présent dans OSM sous un autre identifiant, donc on
le garde systématiquement plutôt que de risquer de le perdre.

Pas de dénivelé/altitude disponible depuis Overpass pour calculer une
vraie durée estimée : `distanceMultiLigneKm` calcule la distance réelle
par géométrie (somme des distances haversine entre points consécutifs),
et `dureeEstim = distance / 4` reprend exactement la même convention que
le seul tracé existant avant cet ajout (J1 : 4,04 km pour 1,01 h, soit
tout juste 4 km/h) — pas une valeur inventée, la continuité du tracé
existant sert de référence. `titleFields` passé de `["id"]` à
`["name", "id"]` : les tracés OSM portent en général un vrai nom
("Sentier de la Futaie des Clos"...), contrairement à "J1".

**Points remarquables de la forêt de Bercé** — nouvelle couche
`pointsRemarquablesBerce` (groupe Nature & rando), sur le même principe
que les casiers colis : flux Overpass (arbres nommés `natural=tree`+
`name`, sources `natural=spring`, attractions `tourism=attraction`+
`name`) complété par un fichier local
(`couches/tourisme/pointsRemarquablesBerce_manuels.geojson`) pour les
sites emblématiques documentés par l'ONF (carte touristique, application
mobile) mais pas forcément cartographiés sur OpenStreetMap — repérés
avec l'utilisatrice : le **Chêne Boppe** (Futaie des Clos, plus vieux
chêne de la forêt), la **Fontaine de la Coudre** et la **Source de
l'Hermitière**. Fichier actuellement vide (mêmes coordonnées à repérer
que pour les casiers colis, voir la section dédiée plus haut pour la
marche à suivre et le format attendu) : à compléter dès que les
coordonnées de ces trois sites sont connues, ou dès qu'un signalement
similaire est fait sur un autre point remarquable.

## Parkings, vente directe à la ferme, antennes-relais, petit patrimoine rural

Quatre couches supplémentaires, suite à une nouvelle liste de pistes de
l'utilisatrice (couverture mobile, permis de construire, temps réel
ALÉOP, patrimoine, marchés de producteurs, vente à la ferme, parkings) —
certaines pistes n'ont **pas** donné de nouvelle couche, pour des raisons
concrètes détaillées ci-dessous.

- **Parkings publics** (`parkings`, `amenity=parking`) et **Vente directe
  à la ferme** (`venteFerme`, `shop=farm`, groupe Commerces) : même
  architecture Overpass que toutes les couches précédentes.
- **Petit patrimoine rural** (`patrimoineRural`, groupe Patrimoine) :
  extension du principe de `pointsRemarquablesBerce` à **tout le
  territoire** plutôt qu'à la seule forêt de Bercé — croix de chemin
  (`historic=wayside_cross`), lavoirs (`man_made=wash_house`), moulins
  (`man_made=watermill` ou `historic=mill`, deux tags concurrents selon
  le contributeur, les deux interrogés), fontaines anciennes/monumentales
  (`amenity=fountain`, à ne pas confondre avec `amenity=drinking_water`
  déjà couvert par la couche "Points d'eau potable"). `categoriePatrimoineRural`
  (`config.js`) distingue les quatre catégories par icône/couleur, réutilisée
  à la fois pour le marqueur (`iconePatrimoineRural`) et la popup.
- **Antennes-relais mobiles** (`antennes`, groupe Services) : **pivot**
  depuis l'idée initiale de couche WMS ARCEP (couverture mobile
  théorique, comme la couche OLD/débroussaillement). Le service WMS
  "Téléphonie mobile" de l'ARCEP existe bien, mais contrairement à OLD
  (où un nom de couche précis avait été documenté et utilisé), aucun nom
  de couche exploitable n'a pu être trouvé en recherche pour ce flux —
  deviner un nom au hasard aurait eu plus de chances de donner une case
  à cocher qui n'affiche jamais rien, sans piste de correction, qu'un
  vrai résultat. Repli sur OpenStreetMap (`man_made=mast` +
  `tower:type=communication` ou `communication:mobile_phone=yes`) :
  pas une carte de couverture théorique par opérateur, mais un signal
  concret et fiable (position réelle des pylônes/antennes), même
  mécanique Overpass que toutes les autres couches du site.

**Pistes évaluées mais écartées** (documentées ici plutôt que de laisser
une trace uniquement dans la conversation) :
- **SITADEL (permis de construire)** — la donnée officielle existe, mais
  le SDES documente lui-même une géolocalisation peu fiable à l'adresse
  précise (absence de préfixe de parcelle pour la plupart des communes).
  Afficher des permis à des adresses potentiellement fausses serait plus
  trompeur qu'utile sur une carte grand public. Décision (validée) :
  rien ajouté pour l'instant ; un indicateur agrégé par commune (nombre
  de permis délivrés par an, comme la couche prix immobilier) resterait
  possible si un extrait CSV filtré est fourni.
- **ALÉOP temps réel** — l'API existe bien (couverture Sarthe depuis
  2022), mais exige une clé API personnelle obtenue sur demande auprès
  de la région : même blocage que l'API FHIR Annuaire Santé pour les
  médecins, pas intégrable dans un site statique public sans exposer la
  clé à chaque visiteur. Décision (validée) : pas de suivi temps réel.
- **Marchés de producteurs** — la couche `marches` existante couvre déjà
  tous les marchés du territoire ; OpenStreetMap ne distingue pas un
  marché de producteurs d'un marché classique (même tag
  `amenity=marketplace` pour les deux), donc rien à ajouter de plus ici.

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
- **Couche `catnat` (historique des catastrophes naturelles) : À VÉRIFIER
  EN CONDITIONS RÉELLES**, voir la section dédiée plus haut — la forme
  exacte de la réponse de l'API Géorisques (CATNAT) n'a pas pu être
  confirmée pendant le développement (accès réseau restreint). Cocher la
  couche et vérifier qu'au moins une commune du territoire affiche un
  historique non vide ; si toutes les communes affichent "Aucun arrêté
  recensé" de façon suspecte, inspecter la réponse réseau réelle et
  ajuster `elementsReponseCatnat`/`libelleEvenementCatnat`/
  `dateEvenementCatnat` dans `js/config.js`/`js/popup.js`.
- **Couche `pointsRemarquablesBerce` : coordonnées du Chêne Boppe, de la
  Fontaine de la Coudre et de la Source de l'Hermitière à ajouter** dans
  `couches/tourisme/pointsRemarquablesBerce_manuels.geojson` (voir la
  section dédiée plus haut) dès qu'elles sont connues — fichier
  actuellement vide, ces trois sites n'apparaîtront sur la carte qu'une
  fois leurs coordonnées renseignées (ou trouvées sur OpenStreetMap).

## Déploiement

Le site est 100% statique : il suffit de pousser tout le dossier sur la
branche GitHub Pages, comme pour la version précédente.
