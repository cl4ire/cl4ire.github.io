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
  d'attributs. Filtré à la boîte englobante du territoire depuis
  `couches/epci.geojson` (`clipperAuTerritoire`, voir plus bas "Filtrage
  territorial de Vigieau") : le flux couvre toute la France, inutile de
  construire des centaines de polygones hors zone.
- **Vigicrues** — retiré (voir "Vigicrues : retiré (CORS)" plus bas) : le
  flux distant bloque les requêtes venant d'un autre site (CORS), aucun
  fix possible côté code sur un site 100% statique sans serveur relais.
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

### "Rechercher ici" (recherche foncière après un déplacement de carte)

Signalé en conditions réelles : le panneau reste ouvert après une
première recherche (voir plus haut), mais si l'utilisatrice déplace la
carte pendant que le panneau reste affiché, les résultats enrichis
(`resultatsEnrichis`) restent silencieusement basés sur l'**ancienne**
vue - aucun signal ne prévenait qu'il fallait rouvrir/relancer la
recherche pour la nouvelle zone. Bouton **"Rechercher ici"** ajouté
(`rf-ici`), masqué par défaut, affiché dès que la carte bouge (`moveend`)
tant que le panneau recherche est ouvert (vérifié via son attribut
`hidden`, pas seulement à l'enregistrement de l'écouteur — un seul
écouteur enregistré une fois pour toutes, pas à chaque ouverture du
panneau). Cliquer dessus relance le même chargement/enrichissement que
l'ouverture initiale du panneau (`chargerEtEnrichirVueActuelle`,
factorisée entre les deux usages) sur la nouvelle vue, puis masque à
nouveau le bouton.

### "À proximité" : détection du bâti par géométrie, pas par l'historique DVF

Signalé en conditions réelles : la fiche parcelle n'affichait "à
proximité" (école/commerce/mairie les plus proches) que pour un terrain
constructible (zone PLUi U/AUc) ou une parcelle ayant `nbBatiments > 0`
— ce dernier signal venant uniquement de la **dernière mutation DVF
connue** (voir plus haut), donc absent pour toute parcelle avec une
maison jamais revendue depuis la mise en place du DVF. Cas réel
rencontré : un corps de ferme en zone agricole (A), jamais vendu,
n'affichait donc jamais "à proximité" alors qu'il y a bien une maison
dessus.

Corrigé en interrogeant une **vraie donnée de bâti** plutôt que
l'historique des ventes : la couche "bâtiments" du même bundler
cadastre-etalab que les parcelles (`URL_BATIMENTS_EPCI`, un des 8 flux
du jeu de données Etalab — sections, feuilles, lieux-dits, parcelles,
subdivisions fiscales, préfixes, communes, **bâtiments**), chargée à la
demande (`chargerBatiments`, `js/recherche.js`) en parallèle des 5
couches déjà utilisées par la recherche foncière. `aUnBatiment` teste
si le centre d'au moins un bâtiment tombe dans la parcelle
(`pointDansFeature`, déjà utilisé pour PLUi/RGA), **indépendamment du
zonage PLUi et de l'historique de vente** — remplace donc le critère
"agricole = jamais de maison" par un vrai test géométrique. `nbBatiments`
(DVF) reste néanmoins vérifié EN PLUS (pas à la place) dans la condition
finale : filet de sécurité si le chargement de la couche bâtiments
échoue (dégrade silencieusement vers un tableau vide, voir
`chargerBatiments`), pour ne rien perdre par rapport au comportement
précédent dans ce cas précis.

⚠️ **Comme pour d'autres flux ajoutés cette session, le nom exact de ce
flux ("batiments") et la forme de sa géométrie (polygone de contour
supposé, avec repli sur un point si jamais fourni ainsi) n'ont pas pu
être vérifiés en conditions réelles** (accès réseau restreint pendant
le développement, `cadastre.data.gouv.fr` bloqué). Dégrade silencieusement
vers l'ancien comportement (zone PLUi seule) en cas d'échec de
chargement, mais un test en conditions réelles reste à faire : cocher
qu'une parcelle agricole connue pour avoir une maison affiche bien
"à proximité" une fois ce correctif en ligne.

Pour rester rapide même sur un lot de plusieurs centaines de parcelles
visibles (pas seulement une seule au clic) : `bboxUnion`/`batimentsDansBbox`
réduisent d'abord la couche bâtiments (potentiellement volumineuse à
l'échelle de l'EPCI) à la seule emprise du lot de parcelles concerné,
avant le test point-dans-polygone parcelle par parcelle — même principe
que `featuresDansVue` (layers.js) mais sur l'emprise d'un lot de
features plutôt que sur la vue de la carte, pour rester utilisable
aussi bien en lot qu'au clic sur une seule parcelle.

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

> **Mise à jour** : cette couche a depuis été convertie en fichier
> statique (`couches/services/lockers_osm.geojson`), pour les raisons
> détaillées dans "Couches converties en fichiers statiques" plus bas.
> La section ci-dessous décrit l'architecture Overpass **d'origine**,
> gardée pour l'historique des tags/schémas OSM identifiés (toujours
> valables pour comprendre les données) ; `fetchOverpassLockers`,
> `MIROIRS_OVERPASS`, `geojsonDepuisOverpass` et le cache
> `localStorage` qu'elle décrit n'existent plus dans le code.

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

> **Mise à jour** : `medecins`, `veterinaires` et `dentistes` ont depuis
> été **supprimées** (0 à 3 résultats réels sur le territoire une fois
> filtré précisément — voir "Couches converties en fichiers statiques"
> plus bas pour les chiffres et la décision) ; `bibliotheques`,
> `officesTourisme` et `campingcar` ont été converties en fichiers
> statiques mais gardées. La section ci-dessous décrit l'architecture
> Overpass **d'origine** de ces cinq couches, gardée pour l'historique
> des tags OSM identifiés ; `creerFetchOverpass`/
> `geojsonDepuisElementsOverpass` qu'elle décrit n'existent plus dans le
> code, et les fiches Doctolib/vétérinaire/dentiste ont été retirées de
> `js/popup.js`.

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

> **Mise à jour** : `ehpad`, `toilettes`, `fontaines` (points d'eau) et
> `velo` ont depuis été converties en fichiers statiques (voir "Couches
> converties en fichiers statiques" plus bas) — seule `catnat` reste un
> vrai flux en direct, non concernée par cette conversion. La section
> ci-dessous décrit l'architecture Overpass **d'origine** des couches
> converties, gardée pour l'historique des tags OSM identifiés.

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

> **Mise à jour** : `randonnees` et `pointsRemarquablesBerce` ont depuis
> été converties en fichiers statiques fusionnés avec leurs fichiers
> manuels respectifs (voir "Couches converties en fichiers statiques"
> plus bas) — le principe "flux + fichier local" décrit ci-dessous reste
> valable, seul le "flux" est maintenant lui aussi un fichier figé plutôt
> qu'une requête Overpass en direct. `fetchRandonnees`/
> `geojsonDepuisRandonnees`/`fetchPointsBerce`/`geojsonDepuisPointsBerce`
> qu'elle décrit n'existent plus dans le code, remplacées par la fonction
> générique `fusionnerFeatureCollections`.

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

> **Mise à jour** : `venteFerme` a depuis été **supprimée** (0 résultat
> réel une fois filtré précisément sur le territoire — voir "Couches
> converties en fichiers statiques" plus bas) ; `parkings`, `antennes`
> et `patrimoineRural` ont été converties en fichiers statiques mais
> gardées (respectivement 247, 33 et 35 résultats réels, largement
> suffisant). `construirePopupVenteFerme` a été retirée de
> `js/popup.js`.

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
  territoire** plutôt qu'à la seule forêt de Bercé — calvaires
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

  **Symbologie par opérateur** (retour de l'utilisatrice) : `iconeAntenne`
  (`js/config.js`) colore chaque marqueur selon le champ `operator` -
  Orange, Bouygues (bleu), SFR (rouge), Free (gris), et un gris clair
  distinct pour "autres" (opérateurs d'infrastructure comme TDF/ATC
  France/Itas Tim - propriétaires du pylône, pas forcément l'opérateur
  qui l'exploite - et les antennes sans `operator` renseigné, environ un
  tiers du fichier). Comparaison par mot-clé (`operator.includes(...)`)
  plutôt que valeur exacte, vérifiée sur les 33 features réelles du
  fichier avant d'écrire la liste : plusieurs variantes existent pour un
  même opérateur ("Orange" et "Orange Services Fixes", "Free Mobile" et
  "IFW-Free").

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

## Historique : de "une requête Overpass par couche" à "une requête combinée"

Signalé en conditions réelles : les couches en flux Overpass "avaient du
mal" (erreurs fréquentes en cochant les cases). Cause la plus probable :
avec une quinzaine de couches ajoutées progressivement, chacune avec sa
**propre** requête, cocher plusieurs cases revenait à déclencher autant de
requêtes séparées vers le même service public gratuit, chacune avec son
propre risque d'échec (surcharge du serveur, 429...). Le service public
Overpass demande explicitement à ses gros consommateurs de grouper leurs
requêtes plutôt que d'en multiplier de petites.

Une première fusion en une seule requête combinée (16 couches "points
simples" derrière un seul appel réseau + cache) a nettement réduit le
nombre de requêtes, et a aussi révélé un vrai bug de concurrence corrigé
au passage (plusieurs couches cochées "en même temps" déclenchaient
chacune sa propre requête réseau malgré la requête partagée, car chacune
voyait "pas encore de cache" avant que la première requête n'ait eu le
temps d'aboutir et de l'écrire). Cette étape intermédiaire a ensuite été
**remplacée entièrement** par la conversion en fichiers statiques
décrite dans la section suivante, qui règle le problème à la racine
(plus de requête réseau du tout à l'affichage) plutôt que de seulement
le rendre moins fréquent — tout le code Overpass "en direct"
(`creerFetchOverpass`, `MIROIRS_OVERPASS`, les requêtes combinées, la
classification par tags...) a été retiré du dépôt à cette occasion.

## Couches converties en fichiers statiques (performance + précision territoriale)

Retour direct de l'utilisatrice, après avoir testé le site en conditions
réelles : les couches en flux Overpass mettaient du temps à charger,
renvoyaient souvent une erreur, et surtout **dépassaient le territoire
Loir-Lucé-Bercé** — remarqué en comparant l'étendue réelle affichée à
celle des 24 communes de la comcom. Cause exacte du débordement :
`BBOX_TERRITOIRE`/`BBOX_OVERPASS` filtrait par un simple **rectangle**
englobant (le vrai polygone du territoire, `couches/epci.geojson`, fait
plus de 4000 sommets — bien trop pour un filtre Overpass `poly:`
précis), donc tout point OSM dans ce rectangle mais hors du polygone
réel (communes limitrophes) remontait quand même. Plutôt que de
continuer à interroger Overpass en direct à chaque chargement, en
espérant qu'il réponde et en acceptant ce débordement, la donnée a été
**extraite une fois puis figée en fichiers statiques**, filtrés avec
précision sur le vrai polygone.

**Méthode** : deux requêtes Overpass QL (toutes les catégories de points
en une seule requête `out center;`, plus une requête séparée sur les
relations `route=bicycle`/`route=hiking` en `out geom;`) exécutées côté
utilisatrice sur [overpass-turbo.eu](https://overpass-turbo.eu/) — cette
étape reste manuelle et ponctuelle, pas un flux : ce site ne peut pas
joindre directement l'API Overpass depuis son environnement de
développement, overpass-turbo.eu est resté le seul moyen pratique
d'obtenir un export. Chaque export GeoJSON a ensuite été retraité par un
petit script Python (hors dépôt, jetable) qui :
1. filtre chaque point/ligne par un vrai test point-dans-polygone (ray
   casting) contre la géométrie de `couches/epci.geojson`, pas contre sa
   simple boîte englobante ;
2. répartit les points restants vers la bonne couche par leurs tags OSM
   (même logique de correspondance que l'ancien `classifierElementCombine`,
   portée en Python) ;
3. retire les propriétés méta ajoutées par l'export Overpass Turbo
   (`@id`, `@geometry`) ;
4. pour les sentiers/itinéraires, calcule `distance` (somme des
   distances haversine entre points consécutifs) et `dureeEstim`
   (`distance / 4`, même convention 4 km/h que le tracé "J1" existant) ;
5. écrit un fichier `.geojson` par couche dans `couches/<groupe>/`.

**Résultat mesuré sur l'export réel** (12/09/2026) : sur 643 points
récupérés dans le rectangle englobant, seuls **412 (64%) tombent
réellement dans le polygone du territoire** — 231 points (36%) étaient
donc un pur débordement sur les communes limitrophes, confirmant
directement le problème signalé. Comptages réels par couche après
filtrage précis :

| Couche | Points réels sur le territoire |
|---|---|
| Parkings publics | 247 |
| Petit patrimoine rural | 35 |
| Antennes-relais mobiles | 33 |
| Toilettes publiques | 29 |
| Points remarquables (forêt de Bercé) | 16 |
| EHPAD & maisons de retraite | 10 |
| Casernes de pompiers | 9 |
| Bibliothèques & médiathèques | 8 |
| Points d'eau potable | 8 |
| Itinéraires cyclables (relations) | 8 |
| Offices de tourisme | 4 |
| Gendarmerie & police | 4 |
| Points relais & casiers colis | 4 |
| Sentiers de randonnée (relations) | 6 |
| Médecins | 3 |
| Aires de camping-car | 1 |
| Vétérinaires | 1 |
| Dentistes | 0 |
| Vente directe à la ferme | 0 |

**Trois couches supprimées** : `medecins`, `veterinaires`, `dentistes` —
ce filtrage précis confirme, avec des chiffres réels, l'impression de
terrain remontée par l'utilisatrice ("la couche médecin est super vide
en vrai") : 3, 1 et 0 résultats sur l'ensemble du territoire, bien trop
peu pour qu'une couche dédiée ait un intérêt. **Une quatrième** couche
supprimée pour la même raison, quoique jamais mise en avant côté
utilisatrice : `venteFerme` (vente directe à la ferme), 0 résultat réel —
le seul point vu en flux Overpass n'existait que dans la zone de
débordement, hors du vrai territoire. Les fonctions de popup dédiées
(`construirePopupMedecin` et ses aides Doctolib, `construirePopupVeterinaire`,
`construirePopupDentiste`, `construirePopupVenteFerme`) et l'entrée
"Le médecin le plus proche" des raccourcis d'accueil (`RACCOURCIS`) ont
été retirées avec les couches.

**Deux résultats à l'inverse de l'intuition, gardés malgré tout** :
- **EHPAD & maisons de retraite** : 10 résultats réels — l'utilisatrice
  avait demandé à vérifier cette couche en même temps que
  médecins/vétérinaires/dentistes, en craignant qu'elle soit vide de la
  même façon ; ce n'est **pas** le cas, la couche est bien fournie sur ce
  territoire et reste donc en place sans changement.
- **Aires de camping-car** : un seul résultat réel, mais gardée quand
  même — contrairement à médecins/vétérinaires/dentistes, une seule aire
  de camping-car sur une comcom rurale de cette taille est un résultat
  plausible en soi, pas un signe de trou de couverture OSM à corriger
  (une commune ne va pas avoir dix aires de camping-car).

**Couches conservées avec un fichier de complément manuel** — même
principe qu'avant (flux + fichier local), sauf que le "flux" est
maintenant lui aussi un fichier statique : `layers.js` accepte `file`
comme un tableau d'URL (une par fichier), `transform` reçoit alors le
tableau des réponses. Une nouvelle fonction générique,
`fusionnerFeatureCollections` (`config.js`), remplace les anciennes
fonctions de fusion dédiées (`geojsonDepuisOverpass`,
`geojsonDepuisRandonnees`, `geojsonDepuisPointsBerce`) — un simple
`flatMap` sur les deux `FeatureCollection` :
- **Points relais & casiers colis** (`lockers`) :
  `couches/services/lockers_osm.geojson` (4 points figés) +
  `couches/services/lockers_manuels.geojson` (toujours modifiable à la
  main, voir la section dédiée plus haut — l'utilisatrice y ajoute
  elle-même les casiers Mondial Relay pas encore couverts).
- **Randonnées** (`randonnees`) : `couches/tourisme/randonnees_osm.geojson`
  (6 tracés OSM figés, avec distance/durée calculées) +
  `couches/tourisme/randonnees.geojson` (le tracé "J1" digitalisé à la
  main, toujours présent, gardé systématiquement même si son tracé
  recoupe en partie un circuit OSM voisin repéré dans cet export —
  "Circuit de Carnuta à Bercé" — sans certitude que ce soit le même
  itinéraire sous un autre identifiant).
- **Points remarquables de la forêt de Bercé** (`pointsRemarquablesBerce`) :
  `couches/tourisme/pointsRemarquablesBerce_osm.geojson` (16 points OSM
  figés) + `couches/tourisme/pointsRemarquablesBerce_manuels.geojson`
  (toujours vide — coordonnées du Chêne Boppe/Fontaine de la
  Coudre/Source de l'Hermitière toujours à renseigner, voir "Ce qui
  reste à faire").

**Conséquence pratique** : toutes ces couches sont désormais de simples
fichiers `.geojson` du dépôt comme la grande majorité des autres couches
du site (aucune requête réseau à l'affichage, aucun risque d'erreur
Overpass, plus de débordement territorial possible) — et, les fichiers
étant petits, elles sont passées de `lazy: true` à `lazy: false` :
chargées au démarrage comme les autres couches légères, sans le badge
"chargée à la demande" qui n'a plus lieu d'être.

**Limite à garder en tête, qui ne disparaît pas avec la conversion** :
la couverture reste celle qu'avaient les contributeurs OpenStreetMap au
moment de l'extraction (12/09/2026) — figée, donc elle ne se met plus à
jour automatiquement comme le ferait un vrai flux. Un point ajouté à OSM
après cette date n'apparaîtra pas ici tout seul ; si un trou de
couverture est signalé, la remédiation est la même qu'avant (ajouter le
point sur OpenStreetMap), mais il faudra refaire l'extraction (nouvel
export overpass-turbo.eu + nouveau passage du script de filtrage) pour
qu'il apparaisse sur ce site — plus un simple rechargement de page.
Restent en flux **réellement en direct**, non concernées par cette
conversion : `catnat` (API Géorisques, pas Overpass) et les couches
`carburants`/Vigieau/OLD (autres API, voir les sections dédiées).

## Couches sans popup (`sansPopup`)

Retour direct de l'utilisatrice : sur ce territoire, certaines couches
n'ont presque jamais rien à raconter au-delà de leur titre générique -
les données OSM correspondantes sont trop souvent réduites au strict
tag minimum. Plutôt que de garder une fiche qui n'affiche quasi jamais
que "Point d'eau potable" ou "Parking" sans la moindre information
utile, trois couches sont passées en `sansPopup: true` (`config.js`) :
**parkings**, **points d'eau potable**, **antennes-relais mobiles**.
Le marqueur reste affiché et cliquable pour le survol/la recherche/le
zoom cluster comme n'importe quelle autre couche (`ajouterAuIndex`
n'est pas concerné) - seul `onEachFeature` (`layers.js`) saute l'appel
à `layer.bindPopup(...)` pour ces couches, donc cliquer dessus n'ouvre
simplement rien. Les fonctions `construirePopupFontaine`/
`construirePopupParking`/`construirePopupAntenne` devenues inutilisées
ont été supprimées plutôt que laissées en code mort.

**Aires de jeux** a rejoint la liste plus tard (même retour, même
raison) : vérifié sur les 14 features du fichier, aucune n'a de `name`
renseigné, `min_age`/`max_age`/`access` chacun sur une seule. En
vérifiant, `searchable: true` s'est avéré déjà inerte pour cette couche
avant même ce changement : `ajouterAuIndex` (`layers.js`) exige un
titre non vide (issu de `titleFields`, donc `name` ici) pour indexer une
entrée - `name` étant systématiquement absent, aucune des 14 aires de
jeux n'a jamais été indexée. Laissé tel quel (le flag redevient actif de
lui-même si `name` finit par être renseigné un jour dans OSM), pas
retiré pour ce que ça change concrètement aujourd'hui.

D'autres couches au contenu parfois tout aussi pauvre (toilettes
publiques, petit patrimoine rural) ont volontairement été **gardées**
avec leur fiche complète : décision explicite de l'utilisatrice de ne
pas toutes les simplifier au même niveau, ces deux-là restant plus
souvent renseignées en pratique (horaires/accessibilité pour les
toilettes, au moins un nom pour le petit patrimoine).

## Raccourcis "près de chez moi" : besoins concrets + filtre par sous-catégorie

Retour direct : les raccourcis de la page d'accueil (`RACCOURCIS`,
`config.js`) reflétaient plutôt ce qui existait techniquement dans le
SIG que de vrais besoins du quotidien. Recomposés autour de questions
qu'une personne se pose vraiment ("où est-ce que je dépose mon
courrier ?", "la boulangerie la plus proche ?") plutôt que des noms de
couches : boîtes aux lettres, boulangerie, pharmacie, stations essence,
médecin, points relais/casiers colis, commerces, écoles,
défibrillateurs. Retiré : "Assistante maternelle" (utile, mais à un
public bien plus restreint que les autres raccourcis).

Nouveauté nécessaire pour "boulangerie"/"pharmacie" : ces deux
catégories ne sont pas des couches à part, ce sont des sous-types de la
couche `commerces` (champ `type`, valeurs OSM `bakery`/`pharmacy`) —
jusqu'ici, un raccourci "près de chez moi" ne pouvait cibler qu'une
couche entière (`layerIds`), pas un sous-ensemble. Champ optionnel
`filtre` ajouté aux entrées de `RACCOURCIS` : une fonction qui reçoit
un élément de l'index de recherche et renvoie vrai/faux, appliquée en
plus du filtre par couche dans `lancerRechercheProximite`
(`js/proximite.js`). `item.layer.feature` donne accès aux propriétés
brutes du point (Leaflet attache automatiquement le Feature GeoJSON
d'origine à chaque layer d'un `L.geoJSON`) sans rien stocker de plus
dans l'index de recherche lui-même — mécanisme générique, réutilisable
pour n'importe quel autre sous-type futur (ex. "boucherie", "coiffeur"...).

## Formulaire de contact (bugs/idées)

Bouton "Un bug à signaler ? Une idée à proposer ?" ajouté au bas de la
modale "À propos" (pas un nouveau bouton dans la barre du haut, déjà
chargée - voir la section précédente) : site 100% statique GitHub Pages,
donc pas de vrai envoi de formulaire possible sans un service tiers.
Choisi avec l'utilisatrice : un lien vers les issues GitHub du dépôt
aurait exigé un compte GitHub de la part du visiteur, écarté au profit
d'un envoi par email accessible à n'importe qui.

**Première version : un lien `mailto:`** - ouvrait le client mail du
visiteur avec le sujet/corps pré-remplis, plutôt qu'un vrai envoi. Retour
direct de l'utilisatrice ("c'est un peu nul... ça envoie rien, ça ouvre
une appli") : remplacé par un vrai envoi au clic via **Web3Forms**
(`https://api.web3forms.com/submit`, `WEB3FORMS_ACCESS_KEY` dans
`js/map.js`) - service pensé justement pour les sites statiques sans
backend : la clé d'accès (liée à `swallowage@proton.me`, `EMAIL_CONTACT`)
est publique par conception, pas un secret à protéger, contrairement à
des identifiants SMTP qu'on ne pourrait jamais mettre dans du JS
exposé publiquement. Le bouton se désactive pendant l'envoi et affiche un
message de statut (`#contact-statut`) : succès (champ vidé) ou échec avec
un repli explicite vers `swallowage@proton.me` en direct.

## Servitudes d'utilité publique (SUP), démographie INSEE

Ajouts suite à un brief détaillé de l'utilisatrice (issu d'un autre
outil) évaluant les données pertinentes à croiser avec ce qui existe déjà
plutôt que d'empiler de nouveaux points sur la carte. Plusieurs pistes du
brief ont été écartées avant même d'être tentées, pour des raisons
concrètes :
- **Transport temps réel + calcul d'itinéraire "sans voiture"** : le
  temps réel ALÉOP demande une clé API personnelle (même blocage déjà
  rencontré et documenté plus haut dans ce fichier) ; un vrai calcul
  d'itinéraire multimodal est un moteur de routing complet (type
  OpenTripPlanner), hors de portée d'un site statique sans serveur.
- **Base Permanente des Équipements (BPE) INSEE** : fichier national
  volumineux, nécessiterait un extrait déjà filtré sur le territoire
  fourni par l'utilisatrice (même contrainte que France Services) -
  pas tenté faute d'extrait disponible pour l'instant.
- **Chantiers/travaux de voirie locaux** : aucune source de données
  ouverte identifiée qui couvrirait 24 communes rurales de cette taille
  (contrairement à une grande ville) - la comcom/les mairies n'ont
  vraisemblablement pas de flux public pour ça.
- **Couches nature (ZNIEFF, Natura 2000, forêts, cours d'eau)** :
  tentées en flux WMS (`data.geopf.fr/wms-r/wms`), puis **retirées** sur
  retour direct de l'utilisatrice après les avoir testées en ligne -
  trop lourdes à charger pour ce qu'elles apportaient concrètement à un
  usage communal/administratif (contrairement à SUP ou démographie,
  directement utiles à une fiche parcelle ou un dashboard commune).

### Servitudes d'utilité publique (fiche parcelle)

Nouvelle section "Urbanisme" enrichie dans la fiche parcelle (couche
`cadastre`) : en plus de la zone PLUi et de l'aléa RGA déjà affichés,
un badge "🟠 N servitude(s) d'utilité publique" avec le libellé de
chacune (monument historique à proximité, canalisation de gaz, risque
naturel...) quand la parcelle en porte au moins une - rien du tout sinon,
comme demandé ("affiche que si nécessaire").

- **Source** : Géoportail de l'Urbanisme (GPU), via l'API Carto de l'IGN
  (`https://apicarto.ign.fr/api/gpu/assiette-sup-s`), interrogée avec la
  géométrie de la parcelle en paramètre (`fetchSupPourParcelle`,
  `js/recherche.js`) - pas de préchargement pour tout le territoire
  comme le cadastre : une servitude peut concerner n'importe quel point,
  un filtre par bbox n'apporterait rien qu'un vrai filtre géométrique
  par parcelle ne fasse déjà, pour un coût d'un seul petit appel réseau
  par clic sur une parcelle plutôt qu'un flux volumineux à charger d'un
  coup.
- **Déclenchement** : en parallèle du reste des données foncières
  (`Promise.all` dans `ouvrirPopupParcelle`, `js/popup.js`), pas après -
  un appel réseau de plus qui ne doit pas retarder l'affichage des
  infos déjà en local si le service SUP est lent ou injoignable.
- **Nomenclature** : `LABELS_SUP` (`js/recherche.js`) traduit les codes
  de catégorie officiels (AC1 = monument historique, I3 = canalisation
  de gaz, PM1 = risque naturel...) les plus probables sur un territoire
  rural, avec repli sur le libellé déjà fourni par l'API puis sur le
  code brut si la catégorie n'est pas dans cette liste.
- **Dégradation** : `.catch(() => [])` en cas d'échec (réseau, format de
  réponse inattendu) - une section "Servitudes" simplement absente,
  jamais une fiche cassée.

✅ **Endpoint et champs confirmés en conditions réelles.** Contrairement
à la première version de cette section, `libelleSup` (`js/recherche.js`)
lit désormais les vrais noms de champs renvoyés par l'API (confirmés via
la console du navigateur par l'utilisatrice) : `suptype` (code catégorie,
ex. `"ac1"`), `nomsuplitt` (nom littéral du générateur, ex. `"Hôtel
Maillard"`) et `typeass` (libellé du type d'assiette, ex. `"Périmètre
des abords"`) en repli si le code n'est pas reconnu dans `LABELS_SUP`.
AC1 = "Monument historique (abords)" est bien la bonne catégorie. Un
`console.warn` reste en place dans `libelleSup` si un jour un code
inconnu apparaît, pour diagnostiquer sans casser l'affichage. La
servitude a aussi sa propre section dans la fiche parcelle (avant
mélangée à "Urbanisme" avec PLUi/RGA, retour direct de l'utilisatrice
sur la confusion visuelle que ça créait).

### Démographie INSEE ("Mon territoire en chiffres")

Couche choroplèthe `demographie` (groupe Habitat & urbanisme, à côté de
"Prix immobilier par commune"), **complète pour les 24 communes** grâce
à deux extraits Insee - Statistiques locales fournis par l'utilisatrice
(complétant la population déjà disponible via `couches/communes.geojson`,
IGN ADMIN-EXPRESS) :
- `population` (2023), `revenu_median` (médiane du niveau de vie 2023,
  €/an), `nb_entreprises` (nombre d'établissements Insee/REE 2024 - pas
  le nombre de sociétés au sens strict, terminologie la plus courante
  utilisée par les communes pour ce type de chiffre)
- `nb_logements` (2023) et `part_logements_vacants` (%)
- `evolution_annuelle_2017_2023` (%, taux **annuel moyen** Insee sur la
  période - pas une variation cumulée sur 10 ans, étiqueté avec sa
  vraie période dans la popup plutôt que d'afficher "sur 10 ans" comme
  une première version du code le faisait avant d'avoir de vraies
  données)
- `part_moins_25`/`part_25_64`/`part_65_plus` (%, calculés à partir des
  effectifs Insee par tranche d'âge - moins de 25 ans / 25-64 ans / 65
  ans et plus, pas la répartition 0-14/65+ imaginée dans une première
  version du schéma avant d'avoir les vraies tranches disponibles)

Deux extraits vérifiés avant fusion (24 codes INSEE correspondant
exactement à `COMMUNES_TERRITOIRE`, population/revenu/établissements
identiques entre les deux fichiers) - voir le `_lisezmoi` de
`couches/urbanisme/demographie_communes.geojson`.

`construirePopupDemographie` (`js/popup.js`) n'affiche que les champs
réellement présents, comme demandé à l'origine - reste vrai même
maintenant que l'extrait est complet : un futur extrait partiel (une
seule des deux sources par exemple) continuerait de s'afficher
correctement. Couleur de la choroplèthe : `couleurPopulation`
(`js/layers.js`), une échelle séquentielle à une seule teinte plutôt que
rouge/vert (`couleurPrix`) - une population plus ou moins nombreuse
n'est pas "bonne" ou "mauvaise" comme peut l'être un prix au m², une
échelle à jugement de valeur serait trompeuse ici.

## Popups qui se fermaient près des bords de carte

Retour direct de l'utilisatrice : une popup touchant presque le bord du
cadre de carte se fermait toute seule à l'ouverture. Cause trouvée :
`.leaflet-popup-content:has(.popup-fiche) { width: 340px !important; }`
(et l'équivalent pour `.popup-carburant`) forçait une largeur en CSS qui
entrait en conflit avec le calcul interne de Leaflet
(`_updateLayout`/`_adjustPan`), qui lit lui-même les dimensions du
contenu pour décider de combien décaler la carte (`autoPan`) afin que la
popup reste visible - un `!important` en dehors de ce mécanisme fausse
ce calcul.

Corrigé en retirant ces `width: ... !important;` du CSS (les conteneurs
internes `.popup-fiche`/`.popup-carburant` ont déjà leur propre largeur,
sans `!important`, que Leaflet mesure correctement) et en passant plutôt
`maxWidth`/`autoPanPadding` via le mécanisme prévu par Leaflet
lui-même : `layer.bindPopup(html, OPTIONS_POPUP)` avec
`OPTIONS_POPUP = { maxWidth: 420, autoPanPadding: [24, 24] }`
(`js/layers.js`), repris pour toutes les popups du site (couches,
adresses).

⚠️ **Symptôme non reproduit à l'identique dans cet environnement de
développement** (sandbox sans accès réseau complet) : le bug CSS/JS
trouvé est réel et corrigé, mais je n'ai pas pu observer la popup se
fermer d'elle-même ni avant ni après le correctif dans mes tests -
seulement une marge d'`autoPan` insuffisante près des bords (passée de
5px à 24px avec le correctif). À confirmer en ligne ; si le problème
persiste, il faudra creuser ailleurs (ex. un gestionnaire de clic global
qui fermerait la popup par erreur).

## Panneau des couches : agrandi et repliable

Deux retours groupés de l'utilisatrice : la liste des couches et le
formulaire de recherche foncière se sentaient à l'étroit, et il
manquait un moyen de replier le panneau pour libérer de la place sur la
carte (puis le rouvrir).

- **Largeur** : `#layers-panel` passé de 280px à 340px (`css/style.css`).
- **Repli/réouverture sur PC** : le bouton "Couches" (`#menu-button`,
  désormais toujours visible, plus seulement sur mobile) et la croix de
  fermeture (`#layers-close`) appellent `togglerPanneauCouches()`
  (`js/map.js`), qui bascule une classe `layers-panel-hidden`
  (`display: none`) - la carte reprend aussitôt l'espace libéré
  (`#map` est `flex: 1` juste à côté) via `map.invalidateSize()`, que
  Leaflet a besoin qu'on appelle explicitement pour redessiner les
  tuiles sur la nouvelle largeur de son conteneur.
- **Cohabitation avec le mode mobile existant** : le panneau utilisait
  déjà une classe `layers-panel-open` pour le glissement hors-champ en
  `@media (max-width: 780px)` (`transform`, pas `display`). Les deux
  mécanismes cohabitent sans se marcher dessus : chaque règle CSS
  ignore la classe qui ne la concerne pas. Point d'attention corrigé en
  cours de route : au chargement de la page, aucune des deux classes
  n'est posée (le panneau est déjà visuellement ouvert sur PC et fermé
  sur mobile par défaut, uniquement via l'absence de classe) - une
  première version du code se fiait à `layers-panel-open` pour détecter
  l'état courant et ratait donc le tout premier clic sur PC (rien ne se
  repliait). `panneauEstOuvert()` (`js/map.js`) vérifie maintenant la
  bonne classe selon la largeur d'écran (`window.matchMedia`) plutôt que
  de supposer que les deux classes sont toujours renseignées.
- **Réouverture automatique** : `ouvrirVuePanneau` (`js/panel.js`,
  utilisée par "Près de chez moi" et "Recherche foncière") retire aussi
  `layers-panel-hidden` - un raccourci déclenché panneau replié le
  rouvre plutôt que de rester invisible.

Testé via Playwright (largeur du panneau, premier clic sur PC, aller-retour
repli/réouverture, réouverture automatique sur "Près de chez moi", glissement
mobile inchangé) : voir `js/map.js`/`js/panel.js`.

## Illiwap (actualités/alertes) et dashboard par commune

Suite à un retour de l'utilisatrice : quasi toutes les communes du
territoire utilisent Illiwap pour leurs actualités/alertes (travaux,
sorties, coupures d'eau...), avec l'idée de les faire remonter sur
GéoBercé sans alourdir la carte thématique existante.

- **URLs dérivées, pas collectées à la main** : chaque commune a sa
  propre "station" publique Illiwap sous la forme
  `station.illiwap.com/fr/public/<code_insee>/actu/embed` - confirmé
  par l'utilisatrice avec le 72248 (Pruillé-l'Éguillé). Comme
  `COMMUNES_TERRITOIRE` (`js/config.js`) a déjà les 24 codes INSEE,
  `urlIllwapEmbed()` génère les 24 liens directement, sans avoir à les
  demander un par un. La CC Loir-Lucé-Bercé elle-même a un identifiant à
  part (`ILLIWAP_TERRITOIRE = "cc-loir-luce-berce"`, pas de code INSEE
  pour une intercommunalité), fourni par l'utilisatrice.
- **Iframe, pas RSS/JSON** : en inspectant le réseau de la page embed
  Illiwap (F12, fourni par l'utilisatrice), aucun flux JSON/XML séparé -
  le contenu est rendu côté serveur directement dans le document HTML de
  l'iframe. Impossible donc d'en tirer un badge de notifications non
  lues (pas de liste d'articles lisible en JS, et de toute façon une
  iframe reste cross-origin, illisible depuis notre JS même si un flux
  existait) - la seule option réaliste était l'embed direct.
- **Chargée à la demande, jamais 24 d'avance** : aucune iframe Illiwap
  n'existe dans le DOM tant qu'on n'a pas explicitement ouvert la vue
  correspondante (`ouvrirVueActu`/`ouvrirDashboardCommune`,
  `js/communes.js`) - une seule active à la fois. En quittant la vue
  (bouton retour), le `src` est vidé (`about:blank` pour l'actu
  territoire ; le conteneur entier est vidé pour le dashboard commune)
  plutôt que laissée tourner en arrière-plan masquée par `[hidden]` -
  répond directement à "je ne veux pas que ça alourdisse notre carte".

### Actualités (territoire) : menu déroulant, pas le panneau des couches

Icône 📢 dans la barre du haut (`#actu-button`), à côté d'"À propos" :
ouvre un menu déroulant ancré sous l'icône avec l'iframe Illiwap de la
CC (`toggleActuDropdown`, `js/communes.js`), plutôt que la vue par
commune qui, elle, reste dans le panneau des couches. Retour direct de
l'utilisatrice après une première version qui ouvrait tout le panneau :
un simple coup d'œil aux actus du territoire n'a pas besoin de prendre
toute la place, contrairement au dashboard commune (mairie + chiffres +
actus) qui a plus de contenu et bénéficie du panneau complet.

- **Fermeture** : clic sur la croix, ou n'importe où en dehors du menu
  (écouteur sur `document`, même principe que les suggestions de
  recherche) - src de l'iframe vidé à la fermeture, comme pour la vue
  commune.
- **Positionnement mobile** : `position: fixed` ancré à la barre du haut
  (pas `absolute` sous le bouton) - sur petit écran, le bouton n'est pas
  forcément au bord droit de la barre (d'autres boutons peuvent suivre),
  donc un ancrage relatif au bouton pouvait pousser le menu hors de
  l'écran côté gauche ; trouvé et corrigé en testant sur 375px avant
  livraison.

### Dashboard par commune

Une vue dédiée par commune (mairie, chiffres clés, actualités Illiwap de
la commune), accessible de deux façons complémentaires :

- **Sélecteur sur l'écran d'accueil** (`#hero-commune-select`, une liste
  déroulante plutôt que 24 tuiles supplémentaires qui auraient surchargé
  l'accueil à côté des raccourcis thématiques) - le choix le plus
  découvrable pour qui ne pense pas spontanément à cliquer sur la carte.
- **Clic direct sur la commune** sur la carte (limites communales,
  `couches/communes.geojson`, déjà affichées mais sans interaction
  jusqu'ici). Point technique : un contour sans remplissage
  (`fill: false`, valeur d'origine) ne capte un clic Leaflet que tout
  près du trait, pas au milieu de la commune - remplacé par une
  `fillOpacity` quasi nulle (`0.02`) pour rendre toute la surface
  cliquable sans rien changer visuellement. Aucun conflit avec les
  marqueurs/couches par-dessus (mairies, commerces...) : chaque élément
  interactif a déjà son propre `bindPopup`/gestionnaire de clic, et
  Leaflet fait remonter l'événement au premier élément interactif sous
  le curseur sans le laisser continuer plus loin - vérifié par un test
  Playwright avec un vrai clic souris (pas simulé en JS) sur un marqueur
  mairie : sa popup s'ouvre normalement, le dashboard commune ne se
  déclenche pas.

Contenu du dashboard (`construireDashboardCommune`, `js/communes.js`),
trois blocs indépendants, chacun absent s'il n'a rien à montrer :
- **Mairie(s)** : `couches/services/mairies.geojson`, déjà en local
  (horaires, téléphone, email, site web) - une commune nouvelle avec
  plusieurs mairies déléguées (ex. Loir en Vallée) affiche une carte par
  mairie. Le rapprochement nom de commune (champ `commune` du fichier
  mairies, aux graphies parfois différentes - tirets, majuscules, "œ"
  qui ne se décompose pas comme un accent normal) ↔ `COMMUNES_TERRITOIRE`
  passe par `normaliserNomCommune()` (`js/config.js`), vérifié sans nom
  orphelin des deux côtés sur les 24 communes.
- **Chiffres clés** : réutilise directement `construirePopupDemographie`
  (`js/popup.js`), déjà conditionnelle par champ.
- **Actualités Illiwap** de la commune.

⚠️ **Iframe testée pour le chargement/l'affichage, pas pour son contenu
réel** : `station.illiwap.com` n'est pas joignable depuis cet
environnement de développement (bloqué par le proxy réseau), donc
impossible de vérifier ici que chaque page embed affiche effectivement
les bonnes actualités - seule l'URL générée (`urlIllwapEmbed`) et son
insertion dans le DOM au bon moment ont pu être testées.

## Indicateur de chargement des couches en flux

Retour direct de l'utilisatrice : cocher une couche "en flux" (Vigieau,
Vigicrues, SUP, Overpass...) ne donnait aucun signe de vie pendant les
quelques secondes d'attente - impossible de savoir si ça fonctionnait ou
pas. `retirerBadgeEtat`/le gestionnaire de la case à cocher
(`js/panel.js`) affichent maintenant un badge à côté du libellé de la
couche :
- **Pendant le chargement** : une icône qui tourne (`fa-circle-notch
  fa-spin`), retirée dès que `chargerCouche` (`js/layers.js`) appelle
  son callback `onReady`.
- **En cas d'échec** : une icône d'avertissement (avec une infobulle
  "recochez pour réessayer") plutôt qu'un badge de chargement qui
  tournerait indéfiniment - la case est aussi décochée automatiquement,
  pour ne pas laisser une case cochée sans rien sur la carte (trompeur).
  Recocher relance `chargerCouche` depuis zéro : `coucheChargee[id]`
  reste `false` après un échec, pas besoin d'une logique de retry à
  part.

Le badge est recherché dans le DOM (`texte.querySelector(".layer-etat-badge")`)
à chaque changement d'état plutôt que suivi par une seule variable de
fermeture : une première version de ce code perdait la référence de
l'ancien badge en le remplaçant par le nouveau sans le retirer, laissant
un spinner orphelin indéfiniment affiché à côté du badge d'erreur -
trouvé en testant le scénario d'échec puis de nouvelle tentative.

## Ordre des icônes de la barre du haut

Retour direct de l'utilisatrice : l'ordre n'était pas cohérent (Accueil,
Recherche foncière, Actualités, À propos, Couches). Réordonné en
Accueil → Couches → Recherche foncière → Actualités → À propos
(`#topbar-actions` dans `index.html`) - la barre de recherche générale
(adresse/lieu/service) reste à sa place actuelle, bien visible entre le
logo et ces icônes, plutôt qu'intercalée parmi elles : c'est l'outil
principal du site, la mélanger avec des icônes utilitaires la ferait
paraître moins importante qu'elle ne l'est. Réorganisation par ID
uniquement (aucun sélecteur CSS/JS du site ne dépendait de leur ordre
dans le DOM), sans risque de régression.

**Mise à jour** : retour de l'utilisatrice - Recherche foncière et
À propos partagent le même gabarit de bouton (icône + libellé masqué
sur mobile, voir juste en dessous), plus cohérent de les mettre l'un à
côté de l'autre plutôt que de les séparer par les Actualités. Ordre
final : Accueil → Couches → Actualités → Recherche foncière → À propos.
Vérifié que rien ne dépend de l'ordre exact dans le DOM (toujours par
ID, `#topbar-actions` reste en `display:flex` simple sans
`nth-child`), et que la visite guidée (étapes "Couches" puis
"Actualités") continue de cibler les bons éléments par sélecteur CSS,
pas par position - testée entièrement, aucune régression.

Au passage, `#recherche-button` a maintenant un `title="Recherche
foncière"` (infobulle au survol) : son libellé texte est masqué sur
petit écran (icône seule, `@media max-width: 780px`), l'infobulle
comble ce manque de clarté sans reprendre la place qu'occuperait un
libellé toujours visible.

### Boutons mal alignés sur mobile (+ débordement à 320px)

Retour direct de l'utilisatrice ("les boutons en haut sont pas très
bien alignés sur mobile"). En mesurant les cinq boutons de
`#topbar-actions` sur plusieurs largeurs réelles (320 à 414px), deux
causes distinctes :
- **Accueil/Couches/Actualités** sont en icône seule à taille fixe
  (38×38, `border-radius:999px`/`10px`) depuis le début, mais
  **Recherche foncière** et **À propos** n'avaient jamais reçu le même
  traitement : tailles en `padding` variable selon leur contenu texte
  (29px de haut pour Recherche foncière, 30 à **42px** pour "À propos"
  selon que son texte tienne sur une ou deux lignes à telle largeur
  précise) - cinq boutons côte à côte à des hauteurs différentes, d'où
  le désalignement visuel.
- Corrigé en alignant `#recherche-button`/`#about-button` sur le même
  gabarit icône-seule 38×38 que les trois autres dans
  `@media (max-width: 780px)` (`#about-button` a gagné une icône
  `fa-circle-info`, comme Recherche foncière avait déjà `fa-sliders` -
  texte masqué, infobulle au survol à la place). Un texte de taille fixe
  ne peut plus jamais passer à la ligne : plus aucune variation de
  hauteur possible, quelle que soit la largeur exacte de l'écran.

**Débordement découvert en testant la correction** (pas présent avant,
mais pas non plus créé par elle : déjà là, juste plus visible une fois
les boutons uniformisés) : à 320px de large (iPhone SE, bas de gamme
Android), même une fois la barre de recherche réduite à zéro, la simple
somme des cinq boutons + leurs espacements dépassait encore la largeur
de l'écran de 27px - "À propos" se retrouvait hors champ, nécessitant
un défilement horizontal pour l'atteindre. Resserré dans
`@media (max-width: 420px)` (boutons à 34×34 au lieu de 38×38,
espacements réduits) : plus aucun débordement horizontal vérifié de
320px à 1920px.

## Visite guidée (première visite)

Suite de bulles qui met en avant quelques éléments clés (recherche,
raccourcis, dashboard commune, couches, actualités), affichée
automatiquement à la première visite. Fait maison en JS/CSS pur
(`js/tour.js`) plutôt qu'avec une librairie de tour guidé tierce
(Intro.js, Shepherd...), pour rester dans le même style visuel que le
reste du site et ne pas ajouter de dépendance externe de plus.

- **5 étapes** : barre de recherche, raccourcis "près de chez moi",
  sélecteur de commune, bouton "Couches", bouton "Actualités"
  (`ETAPES_VISITE` dans `js/tour.js`) - une étape dont l'élément cible
  serait absent du DOM est sautée automatiquement plutôt que de mettre
  en avant du vide.
- **Effet spot** : un unique `box-shadow: 0 0 0 9999px rgba(...)` sur un
  petit rectangle positionné exactement sur la cible (`#tour-spot`)
  assombrit tout l'écran sauf cet élément - pas de masque/clip-path à
  calculer pour "découper" un calque semi-transparent.
- **Une seule fois** : mémorisé dans `localStorage`
  (`geoberce_visite_vue`) une fois terminée ou passée ; en échec
  d'accès (navigation privée stricte), la visite se relance à chaque
  fois plutôt que de bloquer quoi que ce soit - dégradation sans casse.
- **Rejouable** depuis "À propos" (`#tour-relancer`) : rouvre aussi
  l'écran d'accueil au passage, pour que les étapes qui s'appuient
  dessus (raccourcis, sélecteur de commune) restent visibles même si
  l'utilisatrice l'avait déjà fermé.
- **Bloque les clics en arrière-plan** tant qu'elle n'est pas fermée
  (comportement voulu, pas juste un effet de bord) : `#tour` couvre tout
  l'écran, seuls les boutons "Suivant"/"Passer" de la bulle restent
  cliquables - un visiteur pressé peut passer la visite en un clic à
  n'importe quelle étape.

## Itinéraires (randonnées, vélo) : couleurs distinctes, clic plus tolérant, surbrillance

Trois retours groupés de l'utilisatrice sur ces deux couches en ligne :
les tracés se mélangeaient tous dans la même couleur, cliquer dessus
retombait souvent sur le contour de la commune en dessous, et rien
n'indiquait quel tracé était sélectionné.

- **Couleur par itinéraire** : `couleurItineraire` (`js/config.js`)
  attribue une couleur distincte à chaque tracé, dans l'ordre
  d'apparition et par couche (rando et vélo ont chacune leur propre
  compteur, pas mélangés). Une première version utilisait un hash de
  l'identifiant du tracé plutôt qu'un compteur - testé, et un hash peut
  faire retomber deux itinéraires sur la même couleur même avec très peu
  d'entrées (8 tracés vélo ne donnaient que 5 couleurs distinctes en
  pratique) ; le compteur garantit une couleur unique tant que le nombre
  d'itinéraires d'une couche ne dépasse pas la taille de la palette (8
  teintes, rouge volontairement exclu - déjà réservé aux couleurs
  d'alerte/risque ailleurs sur le site).
- **Zone de clic élargie** : une ligne fine (3px visible) est difficile
  à cliquer précisément, et sans marge un clic à côté retombait sur le
  contour de commune en dessous (lui-même rendu cliquable depuis le
  dashboard par commune) plutôt que sur l'itinéraire. `construireCoucheDonnees`
  (`js/layers.js`) superpose désormais, pour toute couche `type: "line"`,
  une polyligne invisible bien plus large (`weight: 16`, `opacity: 0`)
  sur la ligne visible d'origine (devenue `interactive: false`, purement
  décorative) : toute l'interaction (popup, surbrillance) passe par
  cette zone de clic élargie, sans rien changer à l'apparence. Générique
  à toutes les couches en ligne du site (randonnées, vélo, lignes
  ALÉOP, Vigicrues), pas seulement aux deux couches concernées par le
  retour initial.
- **Surbrillance au clic** : `surbrillerLigne`/`retirerSurbrillanceLigne`
  (fermées sur chaque appel de `construireCoucheDonnees`, donc une
  sélection en cours côté rando n'efface pas une sélection en cours côté
  vélo) épaississent et opacifient la ligne visible du tracé sélectionné
  (`bringToFront` en plus, pour qu'elle passe au-dessus des tracés
  voisins), remise à son style d'origine à la fermeture de la popup ou
  au clic sur un autre tracé - une seule surbrillance active à la fois
  par couche.

## Refonte de l'écran d'accueil : dashboard commune, raccourcis en une ligne, recherche de parcelle rapide

Trois retours groupés de l'utilisatrice : la recherche foncière n'était
pas mentionnée dans la visite guidée ("il va falloir faire un truc à
part pour elle"), les raccourcis thématiques prenaient trop de place, et
elle voulait un accès plus direct à la recherche de parcelle depuis
l'accueil plutôt que de passer par le bouton dédié.

**Nouvel ordre de l'accueil** (`index.html`) : sélecteur de commune
(dashboard) → raccourcis thématiques → "Rechercher une parcelle" → "Voir
plus de thématiques" → "Voir la carte complète".

- **Raccourcis en une seule ligne** : `#hero-raccourcis` passé d'une
  grille qui s'étalait sur plusieurs lignes à une rangée à défilement
  horizontal (`overflow-x: auto`, `scroll-snap-type: x proximity`) -
  tous les raccourcis restent accessibles, juste par un glissement
  latéral plutôt qu'en scrollant toute la page verticalement. "Voir plus
  de thématiques" (`#hero-tiles`) garde sa grille classique, inchangée.
- **Recherche de parcelle rapide** (`#hero-parcelle`, `js/recherche.js`) :
  quatre champs simplifiés (commune, surface minimale, constructible,
  DPE connu) plutôt qu'un formulaire complet en double sur l'accueil -
  au clic sur "Rechercher", ils préremplissent le panneau "Recherche
  foncière" existant (tous ses filtres avancés restent disponibles pour
  affiner) et lancent la recherche immédiatement, sans réutiliser de
  logique de filtrage dupliquée :
  - **"Constructible"** réutilise `ZONES_PLUI_CONSTRUCTIBLES` (déjà
    présent dans le code pour la fiche parcelle) via une nouvelle option
    `constructible` ajoutée au champ "Zone PLUi" du panneau complet
    (`correspond()` la traite comme un raccourci pour "U ou AUc") -
    utilisable aussi directement depuis le panneau complet, pas
    seulement via ce raccourci.
  - **"DPE connu"** coche les 7 classes DPE à la fois dans le panneau :
    `correspond()` exclut déjà une parcelle sans étiquette DPE dès qu'au
    moins une classe est cochée, donc cocher les 7 revient exactement à
    "n'importe quelle classe, du moment qu'elle existe".
  - **Contournement volontaire de la limite "vue actuelle"** : la
    recherche foncière ne porte normalement que sur les parcelles
    affichées à l'écran (voir l'en-tête de `js/recherche.js`), pour ne
    pas charger les dizaines de milliers de parcelles du territoire
    entier d'un coup. Une recherche rapide avec une commune choisie n'a
    pas ce problème (quelques centaines à quelques milliers de parcelles
    par commune, pas le territoire entier) : `chargerEtEnrichirCommune`
    filtre directement `donneesBrutes["cadastre"]` (déjà chargé en
    entier) par code INSEE, sans avoir besoin d'être déjà zoomé dessus.
    Sans commune choisie ("Toutes les communes"), la recherche rapide
    retombe sur le comportement habituel (vue actuelle) : si la carte
    n'est pas assez zoomée, le même message d'invite à zoomer s'affiche
    que dans le panneau complet - pas une limitation nouvelle, celle qui
    existe déjà pour tout le monde.
- **Visite guidée mise à jour** (`js/tour.js`) : réordonnée pour suivre
  le nouvel ordre de l'accueil, avec une étape dédiée à
  `#hero-parcelle`.

Testé (données mockées) : recherche rapide avec commune + surface min
affiche exactement les parcelles attendues sur la carte (vérifié avec
trois parcelles de test, deux exclues à raison - mauvaise commune, ou
surface insuffisante) ; les trois autres champs (préremplissage
commune/surface/plui, "constructible" et "DPE connu") vérifiés
directement sur `correspond()` avec des cas couvrant chaque branche.

## Horaires saisonnières (été/hiver) pour les déchèteries

L'utilisatrice enrichit ses couches depuis le projet QGIS livré plus
haut, et voulait savoir comment différencier les horaires été/hiver
d'une déchèterie dans le champ `opening_hours`.

`parserHorairesOsm` (`js/popup.js`) ne couvrait volontairement qu'un
sous-ensemble de la syntaxe OSM (jours de la semaine + plages horaires,
voir "Ne couvre pas toute la spécification..." dans son commentaire) -
ni les jours fériés (`PH`), ni les plages saisonnières. Étendu pour
gérer ces dernières : un bloc peut désormais commencer par une plage de
mois ("`Apr-Sep: Mo-Sa 09:00-19:00`"), qui n'est retenue que si la date
actuelle y tombe - `dateOsmDansPlage` gère aussi les plages à cheval sur
l'année civile ("`Oct-Mar`"). Exemple complet pour une déchèterie :
`Apr-Sep: Mo-Sa 09:00-19:00; Oct-Mar: Mo-Sa 09:00-17:00`.

**Mise à jour** : retour de l'utilisatrice - un changement de saison ne
tombe pas toujours pile au 1er du mois ("à partir du 15 juin", horaires
d'été des déchèteries typiquement mi-juin à mi-septembre). Le jour du
mois est maintenant lui aussi optionnel dans la plage ("`Jun 15-Sep
15: Mo-Sa 09:00-19:00`"), représenté en un entier "mois×100+jour" pour
comparer date de début/fin et date du jour d'un coup - un mois seul
("`Apr-Sep:`") reste valide, équivalent à "du 1er au dernier jour de
ces mois" (jour par défaut 1 pour le début, 31 pour la fin).

Le format renvoyé par `parserHorairesOsm` ne change pas (toujours
`{Mo: [...], ...}` pour la semaine en cours) : tous les appelants
existants (mairies, commerces...) affichent donc automatiquement la
bonne saison sans aucune modification de leur côté - seule la fiche
qui reçoit le résultat n'a pas connaissance des saisons, elle voit
simplement "les horaires de cette semaine". Pas d'indication visuelle
du genre "vous consultez les horaires d'été" : sur simple demande si
besoin plus tard.

**Trouvé en implémentant** : `construirePopupDecheterie` n'affichait en
fait jamais les horaires, même quand le champ est renseigné - contact/
opérateur oui, mais pas `opening_hours`. Corrigé au passage (même
mécanique que les commerces : badge "Ouvert"/"Fermé" +
`construireLignesHoraires`) puisque sans ça, les horaires que
l'utilisatrice s'apprêtait à ajouter ne se seraient affichés nulle
part.

Testé (horaires mockées, en changeant artificiellement la date système)
sur les deux granularités : mois entiers (juillet et avril → été,
décembre et février → hiver, y compris "Oct-Mar" à cheval sur l'année
civile) et jour précis (`Jun 15-Sep 15:`/`Sep 16-Jun 14:` - le 14 juin
encore en hiver, le 15 déjà en été, le 15 septembre encore en été, le
16 déjà en hiver, vérifiés un par un). Un format non saisonnier
existant, et des plages non reconnues, continuent de fonctionner comme
avant (testés en non-régression).

**Mise à jour** : retour de l'utilisatrice - une fois les vraies
horaires saisies dans `couches/services/dechets.geojson`, aucune des
trois déchèteries n'affichait ses horaires dans la popup. En cause,
deux écarts entre la donnée réellement saisie à la main et la syntaxe
stricte que `parserHorairesOsm` acceptait :

- `Sept 15-Jun 14: ...` (abréviation française à 4 lettres) au lieu du
  `Sep` anglais à 3 lettres attendu par la regex de plage saisonnière -
  le mois entier échouait donc à être reconnu comme une saison.
  `dateOsmDansPlage` compare désormais seulement les 3 premières lettres
  du mot (insensible à la casse), ce qui accepte `Sep` comme `Sept`
  sans rien changer pour les formats déjà corrects.
- `Mo,Fr,Sa:9:30-12:30` (`:` entre la liste de jours et les horaires)
  au lieu de l'espace attendu (`Mo,Fr,Sa 9:30-12:30`) - la recherche du
  premier espace pour séparer les deux ne trouvait rien et ignorait le
  bloc entier. La liste de jours est maintenant repérée par motif
  (`Mo`/`Tu`/`We`/`Th`/`Fr`/`Sa`/`Su` et leurs plages/listes) plutôt que
  par position, et ce qui suit (espace, `:`, ou les deux) est retiré
  quel que soit le séparateur réellement utilisé.

Un bloc qui, malgré ça, ne redonne pas une liste d'horaires valides
(ex. deux plages saisonnières collées sans point-virgule entre elles,
un vrai oubli de saisie plutôt qu'une variante de format) est
maintenant ignoré silencieusement au lieu d'afficher du texte
tronqué/corrompu dans la popup - mieux vaut ne rien montrer pour ce
jour-là que quelque chose de faux. Vérifié sur l'ensemble des valeurs
`opening_hours` réellement présentes dans le dépôt (108 valeurs
distinctes, tous types de couches confondus) : aucune sortie
corrompue, aucun format qui marchait avant qui casse maintenant.

## Indicateur de chargement du panneau recherche foncière

Retour de l'utilisatrice : depuis l'accueil, la recherche rapide de
parcelle (`#hero-parcelle`) ouvre bien le panneau complet, mais pendant
le chargement des données foncières (`chargerDonneesFoncieres`, peut
prendre plusieurs secondes la première fois - cadastre, DVF, DPE, SUP,
bâtiments) rien ne montrait clairement que ça travaillait, donnant
l'impression que la recherche ne fonctionnait pas.

Le message `#rf-statut` ("Chargement des données...") existait déjà
mais restait un texte statique discret. Il porte maintenant une icône
`fa-circle-notch fa-spin` (même motif que le chargement de la fiche
parcelle dans les popups, `.popup-fiche-chargement`) et une classe
`.rf-statut-chargement` (couleur primaire, icône+texte centrés) tant
que le chargement est en cours. Cette classe est retirée dès que
`mettreAJourStatut()` affiche un vrai résultat (nombre de parcelles),
ou que le message "zoomez pour lancer une recherche" s'affiche à la
place (carte pas assez zoomée) - dans les deux cas ce n'est plus un
état de chargement. Comme `chargerDonneesFoncieres` est idempotente
(couches déjà chargées mises en cache), les ouvertures suivantes du
panneau affichent le spinner un instant à peine, le temps que
`mettreAJourStatut()` s'exécute.

## Légende des antennes-relais (couleur par opérateur)

La couleur par opérateur (voir plus haut, "Parkings, vente directe à
la ferme, antennes-relais...") n'était visible qu'en devinant sur la
carte - aucune légende n'indiquait à quoi correspondait chaque
couleur. `OPERATEURS_ANTENNES` (`js/config.js`) porte maintenant un
`label`/`icon` par opérateur en plus de sa couleur, plus une entrée par
défaut `OPERATEUR_ANTENNE_DEFAUT` ("Autre / non renseigné"), et la
couche `antennes` déclare `legend`/`legendDefaut`/`categoriser` -
exactement le même mécanisme déjà utilisé par les commerces
(`TYPES_COMMERCES`/`categoriePourFeature`, voir `construireLegende`
dans `js/panel.js`) : une légende repliable apparaît sous la couche
dans le panneau, avec une case à cocher par opérateur (affichable/
masquable indépendamment, comme les catégories de commerces) en plus
d'expliquer les couleurs. Vérifié sur les 33 antennes réelles du
fichier : la répartition par catégorie (Orange 5, SFR 5, Bouygues 1,
Free 3, Autre 19) correspond à celle déjà validée pour la coloration
des marqueurs, et la légende générée affiche bien les 5 entrées avec
les bonnes couleurs/libellés.

## Fermer la recherche foncière vide automatiquement la sélection

Retour direct de l'utilisatrice : fermer le panneau recherche foncière
(flèche retour, ou le "×" du panneau pendant que cette vue est
affichée) laissait les parcelles surlignées sur la carte, obligeant à
cliquer "Vider la sélection" séparément - contre-intuitif, fermer le
panneau devrait suffire à en effacer les traces sur la carte.

`fermerRechercheFonciere(map)` (`js/recherche.js`) enchaîne
`viderSelectionCarte(map)` (déjà existant, utilisé par le bouton
"Vider la sélection sur la carte") puis `fermerVuesPanneau()`, branché
sur la flèche retour (`#recherche-back`, `js/map.js`) à la place de
`fermerVuesPanneau` seul. Le "×" qui ferme le panneau entier
(`#layers-close`) ne passe pas par cette même route (il ne change pas
de vue, juste la visibilité du panneau) : vide donc la sélection
séparément, seulement si la vue recherche foncière était affichée au
moment du clic - pas d'effet si on ferme le panneau depuis l'arbre de
couches normal, où il n'y a de toute façon rien à vider.

Testé : fermeture par la flèche retour (removeLayer appelé, bouton
"Vider" redésactivé, vue normale réaffichée) et par le "×" dans les
deux cas (vue recherche affichée → vide ; vue normale affichée → ne
touche à rien).

## Vigicrues : retiré (CORS)

Retour direct de l'utilisatrice ("vigieau et vigicrue ne fonctionnent
pas"). Confirmé en conditions réelles (console du navigateur, capture
d'écran fournie par l'utilisatrice) :

```
Access to fetch at 'https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.geojson'
from origin 'https://cl4ire.github.io' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

`vigicrues.gouv.fr` ne renvoie pas l'en-tête CORS nécessaire pour être
interrogé en JavaScript depuis un site tiers (le contraire de Vigieau ou
des autres flux du site, tous conçus pour la réutilisation externe) :
son service `InfoVigiCru.geojson` est fait pour son propre site, pas
pour être consommé par d'autres. Aucun correctif possible côté code sur
un site 100% statique GitHub Pages, sans serveur pour servir de relais
(proxy) entre le navigateur et ce flux - contrairement à une simple
erreur de nom de champ, ce n'est pas quelque chose qu'on peut corriger
en ajustant `js/config.js`.

Couche entièrement retirée (`couleurVigicrues`/`construirePopupVigicrues`
supprimées de `js/config.js`/`js/popup.js`, entrée retirée de `LAYERS`)
plutôt que laissée dans le panneau à échouer systématiquement au clic -
même logique que le retrait de ZNIEFF/Natura2000/forêts plus haut.

Alternative envisagée avec l'utilisatrice : Hub'Eau
(`hubeau.eaufrance.fr`), l'API officielle française conçue pour l'usage
externe (contrairement à celle de Vigicrues) - propose bien plus que la
seule vigilance crues (hydrométrie, qualité de l'eau, piézométrie...).
Non vérifiable depuis cet environnement (accès réseau restreint au
moment d'écrire ceci) : reste à explorer en conditions réelles pour
confirmer les endpoints/schémas exacts avant toute implémentation.

## Filtrage territorial de Vigieau

Retour direct de l'utilisatrice : Vigieau finit par s'afficher mais
prend "un temps assez long" (flux national, plusieurs centaines de
zones pour toute la France) - elle demandait s'il était possible de le
limiter à notre territoire pour alléger le chargement.

`bboxTerritoire` (`js/layers.js`), calculée une fois dans le fetch de
`couches/epci.geojson` déjà existant (`js/map.js`, via `bboxFeature`
déjà utilisé pour `featuresDansVue`), donne la boîte englobante du
territoire. `clipperAuTerritoire` (`js/config.js`, branché en
`transform` sur la couche `vigieau`) ne garde que les features dont la
boîte englobante touche cette zone (+ 0,15° de marge, environ 15-17km)
: un simple test d'intersection de rectangles plutôt qu'un filtre exact
sur le polygone précis de l'EPCI (4000+ sommets, inutilement coûteux
pour un filtre de performance) - les zones Vigieau étant souvent à
l'échelle du bassin versant ou du département, bien plus grandes que
notre territoire, la marge évite d'en exclure une par excès de
précision. Si `bboxTerritoire` n'est pas encore prêt (epci.geojson pas
encore résolu au moment du clic sur la couche), ne filtre rien plutôt
que de tout masquer.

Le filtrage réduit le nombre d'objets Leaflet construits (donc le temps
de rendu), pas la taille du fichier téléchargé lui-même : le flux reste
un seul gros GeoJSON national à récupérer en entier avant de pouvoir le
filtrer côté client, aucune pagination/filtre côté serveur disponible
sur ce flux public.

Testé : une zone dans le territoire et une juste à la marge sont
conservées, une zone très éloignée (region parisienne/alpes) est
exclue ; sans `bboxTerritoire` disponible, rien n'est filtré (repli de
sécurité vérifié).

**Mise à jour** : retour de l'utilisatrice, avec capture d'écran de la
console - `net::ERR_TIMED_OUT` puis `TypeError: Failed to fetch` sur le
flux Vigieau. Le filtrage territorial ci-dessus réduit le rendu, pas le
téléchargement (voir plus haut) : le fichier national reste entier à
récupérer avant de pouvoir le filtrer, et un objet S3 statique ne permet
aucun filtre géographique côté serveur - plus exposé qu'un flux plus
léger à un aléa réseau ponctuel qui fait dépasser le délai avant la fin
du transfert.

`fetchAvecReessai`/`fetchVigieau` (`js/config.js`, branché en
`fetchPersonnalise` sur la couche `vigieau` à la place de `file` - même
mécanisme que `fetchCatnat` pour l'historique des catastrophes
naturelles) : jusqu'à 3 tentatives avant d'abandonner pour de bon,
plutôt qu'un seul essai qui échoue au moindre aléa réseau transitoire.
N'élimine pas le risque si le service est réellement indisponible ou le
fichier durablement trop lent à charger (affiche alors le badge
d'erreur normal du panneau), mais couvre le cas le plus courant d'un
blocage ponctuel.

Testé (fetch remplacé temporairement pour simuler des échecs) : réussit
après 2 échecs suivis d'un succès (3 tentatives consommées), abandonne
proprement après 3 échecs consécutifs (pas de boucle infinie), et ne
fait qu'un seul appel quand tout se passe bien du premier coup.

## Popup Vigieau : "[object Object]" au lieu des horaires/restrictions

Retour direct de l'utilisatrice, avec capture d'écran : la popup
Vigieau affichait des `[object Object]` à la place de certains champs
(`ArreteRestriction`, `Restrictions`). Cause : `construirePopupGenerique`
(`js/popup.js`) - seul appelant restant de la popup "générique" -
affichait n'importe quelle propriété restante via un simple template
string, sans distinguer un texte/nombre d'un objet ou tableau imbriqué;
`${valeur}` sur un objet JS donne littéralement le texte "[object
Object]" plutôt qu'une erreur qui aurait alerté plus tôt. Les données
Vigieau réelles imbriquent justement les restrictions par usage dans
`Restrictions` (tableau d'objets) et les infos de l'arrêté dans
`ArreteRestriction` (objet).

`estValeurSimple` (`js/popup.js`) filtre désormais toute valeur qui
n'est pas un texte/nombre/booléen, aussi bien pour le titre, le
sous-titre que le tableau de détails restants - mieux vaut omettre un
champ imbriqué que d'afficher du texte incompréhensible. Une fiche
dédiée qui présenterait le détail des restrictions par usage (le
contenu le plus utile de `Restrictions`) reste possible, mais demande
de connaître le schéma exact des objets imbriqués - non vérifiable
depuis cet environnement (accès réseau restreint), à faire depuis une
capture des propriétés réelles d'une zone si voulu plus tard.

Testé sur une feature simulée reprenant les champs réels observés dans
la capture d'écran (`IdSandre`, `Code`, `Type`, `ArreteRestriction`
objet, `Restrictions` tableau d'objets) : plus aucun "[object Object]"
dans le HTML généré, les champs simples (IdSandre/Code/Type) s'affichent
normalement.

**Mise à jour** : retour de l'utilisatrice - une fois "[object Object]"
supprimé, la popup n'affichait plus grand-chose d'utile (3 champs
numériques/codes, plus de détail sur le type d'alerte ni les
restrictions par usage) : `estValeurSimple` a stoppé le bug visuel mais
n'apporte pas de remplacement, alors que `Restrictions` est justement le
contenu le plus utile de cette couche. Une fiche dédiée demande le
schéma exact des objets imbriqués (noms des sous-champs dans
`Restrictions`/`ArreteRestriction`) - non vérifiable depuis cet
environnement (accès réseau restreint aux domaines concernés) ; en
attente d'une capture des propriétés réelles d'une zone fournie par
l'utilisatrice pour construire une fiche complète plutôt que deviner
une nouvelle fois des noms de champs.

**Mise à jour** : schéma réel fourni par l'utilisatrice
(`donneesBrutes["vigieau"][0].properties` copié depuis la console).
Champs confirmés : `nom` (nom de zone), `code`, `type` ("AEP"/"SUP"/
"SOU"), `niveauGravite` (chaîne, ex. "vigilance"), `departement`
(objet `{code, nom}`), `arreteRestriction` (objet : `numero`,
`dateDebut`, `dateFin`, `dateSignature`, `fichier` - lien PDF vers
l'arrêté), `restrictions` (tableau de ~20 à ~25 usages réglementés,
chacun avec `nom`/`thematique`/`description` et un booléen
`concerneXxx` par public concerné). Confirme au passage l'hypothèse
initiale : les clés `IdSandre`/`ArreteRestriction`/`Restrictions` en
PascalCase vues dans la première capture d'écran n'étaient que
l'habillage de la popup générique (`humaniser()`), pas la vraie casse
des champs (`idSandre`/`arreteRestriction`/`restrictions`, camelCase).

`niveauVigieau` (`js/config.js`) : classification par mot-clé
(vigilance/alerte/alerte renforcée/crise) partagée entre la couleur du
polygone (`couleurVigieau`) ET le badge de la popup, pour qu'ils ne
puissent jamais afficher deux niveaux différents pour la même zone -
`couleurVigieau` déjà écrite ainsi avant la confirmation du champ,
gardée volontairement tolérante à une valeur composée ou renommée
plutôt que de basculer sur une égalité stricte maintenant que le nom
exact est connu.

`construirePopupVigieau` (`js/popup.js`) remplace la popup générique
pour cette couche : titre + niveau (badge coloré) + type d'eau/
département en sous-titre, numéro d'arrêté + date d'entrée en vigueur
+ lien vers le PDF complet, et le détail des usages réglementés dans un
`<details>` repliable (`.popup-fiche-repliable`, renommée depuis
`.popup-fiche-elus` - générique dès le départ dans son CSS, seul le nom
de classe supposait le conseil municipal ; `construireElus` mis à jour
en même temps, aucun changement de comportement). Limité aux usages où
`concerneParticulier` est vrai (public de ce site) plutôt que les ~23
usages complets, souvent majoritairement agricoles/professionnels à ce
niveau de gravité - le lien PDF reste le repli pour le détail complet.
`titleFields`/`subtitleFields` retirés de la config de la couche
(devenus inutiles, seule couche à les avoir jamais utilisés).

Testé sur le vrai payload fourni (zone "LATHAN", Maine-et-Loire,
niveau "vigilance", arrêté avec date et lien PDF, 4 usages dont 3
concernant les particuliers) : rendu HTML complet vérifié, aucun
"[object Object]", couleur du badge et du polygone identiques pour les
5 niveaux de gravité connus + un niveau inconnu (repli gris "Niveau non
identifié" vérifié). Conseil municipal (`construireElus`) revérifié
après le renommage de classe partagée : rendu identique.

## Décompte d'entités par commune

Retour direct de l'utilisatrice : compléter le dashboard commune avec
"1 boulangerie, 1 banque, 2 assistantes maternelles, 2 écoles..."
plutôt que de laisser deviner ce qui existe sur place - aucune donnée
externe, tout est déjà chargé au démarrage du site (commerces, banques,
écoles, petite enfance, équipements sportifs, aires de jeux sont toutes
`lazy: false`, voir `js/config.js`).

`COUCHES_DECOMPTE_COMMUNE`/`featuresCommune`/`decompteEntitesCommune`/
`construireBlocDecompte` (`js/communes.js`) : la plupart des couches
portent déjà `com_insee` (filtrage direct), sauf `petiteEnfance` (champ
absent de la donnée source) - `parGeometrie` bascule sur un test
point-dans-polygone (`pointDansFeature`, déjà utilisé par la recherche
foncière) contre le contour de la commune. `grouper` (optionnel) éclate
le total en sous-catégories (ex. commerces par `categorieCommerce`,
écoles par `type_fr`, sport par `sport`) plutôt qu'un seul chiffre par
couche - c'est le niveau de détail demandé, pas juste "5 commerces".
Réutilise `LABELS_TYPE_ECOLE`/`LABELS_SPORT` déjà définies dans
`js/popup.js` pour les popups de ces couches, pas de doublon.

**Trouvé en implémentant** : `com_insee` est une chaîne dans certains
fichiers (`commerces`, `education`, `equipementSportif`) mais un nombre
JSON dans d'autres (`banques`, `airesJeu`) - vérifié en conditions
réelles. Une comparaison stricte (`===`) aurait donc silencieusement
renvoyé zéro résultat pour ces deux couches sur toutes les communes ;
`featuresCommune` compare désormais via `String(...)` des deux côtés.

**Trouvé au passage** : `LABELS_TYPE_ECOLE` (`js/popup.js`) utilisait des
clés sans accent (`elementaire`, `college`, `lycee`) alors que la vraie
donnée (`education.geojson`) porte `type_fr` accentué
(`élémentaire`/`collège`/`lycée`) - la table ne servait donc à rien pour
ces trois types, le rendu restait correct par coïncidence grâce au repli
`capitaliserPremiere`. Corrigé (clés accentuées). `LABELS_SPORT`
complétée avec les valeurs `sport` réellement présentes mais absentes de
la table (`running`, `handball`, `billiards`, `skateboard`,
`volleyball`, `cycling`, `motocross`, `ultralight_aviation`), plus
`labelSport` qui traduit chaque partie d'une valeur combinée
("basketball;handball;soccer", observée une fois dans la donnée) plutôt
que de l'afficher brute.

Testé : couverture géométrique de `petiteEnfance` (70/70 features
assignées à une commune, `pointDansFeature` sur les 24 contours réels -
aucune perte) ; décompte sur plusieurs communes réelles (rendu HTML
vérifié, aucun "[object Object]", tous les libellés en français) ;
balayage des 24 communes sans erreur.

## Redimensionnement du panneau des couches

Retour direct de l'utilisatrice. `#layers-resize-handle` (bande de 6px
sur le bord droit de `#layers-panel`, `index.html`/`css/style.css`) +
`initRedimensionnementPanneau` (`js/map.js`) : glisser change la largeur
du panneau entre 280 et 640px, mémorisée dans `localStorage`
(`geoberce_largeur_panneau`) pour rester d'une visite à l'autre.
`map.invalidateSize()` à chaque déplacement, comme pour l'ouverture/
fermeture du panneau (même besoin : Leaflet ne redétecte pas seul un
changement de taille de son conteneur). Desktop seulement (poignée
masquée sous 780px, voir `@media`) : sur mobile le panneau est un
panneau plein écran qui glisse, pas une colonne redimensionnable.

**Trouvé en implémentant** : la poignée était positionnée à cheval sur
le bord (`right: -3px`), or `#layers-panel` a `overflow-y: auto` - ce
qui bascule aussi `overflow-x` à `auto` (comportement standard CSS dès
qu'un seul axe n'est pas `visible`), coupant tout ce qui dépassait le
bord droit (invisible ET impossible à cliquer). Corrigée en la plaçant
entièrement à l'intérieur (`right: 0`).

Testé (glissements simulés à la souris) : largeur qui suit le curseur,
bornes mini/maxi respectées, persistance en `localStorage` et
restauration vérifiées, y compris avec une valeur aberrante en stockage
(bornée à 640px plutôt que d'appliquer une largeur absurde).

## Qualité de l'eau potable (Hub'Eau) sur le dashboard commune

Suite à l'idée de l'utilisatrice de raccrocher Hub'Eau (évoquée en
retirant Vigicrues, bloqué par CORS) : exploration de deux pistes,
qualité de l'eau potable et qualité de l'air.

**Qualité de l'air écartée** : l'indice ATMO officiel n'est calculé que
pour les 7 plus grosses agglomérations de la région Pays de la Loire
(Nantes, Angers, Le Mans, Saint-Nazaire, Cholet, La Roche-sur-Yon,
Laval) - confirmé par l'utilisatrice sur l'API ouverte d'Air Pays de la
Loire (`data.airpl.org`), aucune commune du territoire (rural, aucune
de ces 7 villes) n'y a de valeur mesurée. Afficher un indice pour
notre territoire aurait été trompeur (donnée absente ou non
représentative) : abandonné plutôt que bricolé.

**Qualité de l'eau potable retenue** : Hub'Eau
(`hubeau.eaufrance.fr/api/v1/qualite_eau_potable/resultats_dis`),
schéma confirmé en conditions réelles par l'utilisatrice (résultat réel
pour Montval-sur-Loir, collé directement depuis un onglet ouvert sur
l'API - contrôle sanitaire réglementaire, pas un flux corrigible/
approximatif). Champ clé : `conclusion_conformite_prelevement`, une
phrase de synthèse déjà lisible ("Eau d'alimentation conforme aux
exigences de qualité en vigueur pour l'ensemble des paramètres
mesurés."), répétée sur toutes les lignes d'un même prélèvement
(`code_prelevement`) - la ligne la plus récente (`size=1&sort=desc`)
suffit donc à donner le dernier verdict sans agréger côté client.
`reseaux[0].nom` donne le nom du réseau de distribution en plus.

`chargerQualiteEauCommune`/`construireBlocQualiteEau`
(`js/communes.js`) : classement conforme/non conforme par mot-clé sur
la phrase de conclusion (comme Vigieau) plutôt qu'une valeur
d'énumération figée - seule "C" (conforme) a été confirmée pour
`conformite_limites_bact_prelevement`/`conformite_limites_pc_prelevement`,
pas la ou les valeurs de non-conformité.

Chargé à part du reste du dashboard (`ouvrirDashboardCommune`, même
fichier) plutôt que dans le même `Promise.all` que mairies/démographie
: c'est un appel réseau externe (latence/fiabilité imprévisibles),
contrairement aux deux autres qui ne lisent que des fichiers locaux du
dépôt - le reste du dashboard ne doit pas attendre après lui pour
s'afficher. Le résultat est injecté dans `#commune-qualite-eau` une
fois le contenu principal déjà affiché (pas directement sur la
promesse Hub'Eau) : sinon, dans le cas limite où Hub'Eau répondrait
plus vite que la lecture des fichiers locaux, le conteneur n'existerait
pas encore dans le DOM et le résultat se perdrait silencieusement -
trouvé en testant. Échec (CORS, réseau, commune sans donnée) : le
conteneur reste simplement vide, comme les autres sections du dashboard
qui n'ont rien à montrer.

Testé : rendu conforme (vert) et non conforme (terracotta) sur le vrai
payload fourni par l'utilisatrice, dégradation silencieuse vérifiée
(résultat `null`, aucune trace visible), intégration complète au
dashboard (bloc injecté au bon endroit après le contenu principal).

## Dashboard commune : panneau latéral → page plein écran

Retour direct de l'utilisatrice : le dashboard commune (mairie,
chiffres clés, décompte d'entités, qualité de l'eau, actualités) était
à l'étroit dans la colonne du panneau des couches (280-640px) une fois
enrichi de tout ce contenu.

`#commune-page` (`index.html`) sort du panneau des couches
(`#layers-panel`) : devient un enfant direct de `#app`, au même niveau
que `#hero`/`#map`/`#layers-panel`, avec `position: absolute; inset: 0`
- même principe que `#hero` (l'écran d'accueil), mais son propre
habillage : en-tête fixe (bouton retour + nom de la commune) et contenu
centré sur une largeur de lecture confortable (640px) plutôt que le
prompt centré de l'accueil. `z-index: 600`, au-dessus de `#hero`
(500) : nécessaire pour "Accueil" depuis la page commune (voir plus
bas).

`ouvrirDashboardCommune`/`fermerVueCommune` (`js/communes.js`) affichent/
masquent directement `#commune-page` (`hidden`) au lieu de passer par
`ouvrirVuePanneau("commune-view")`/`fermerVuesPanneau()` - `"commune-view"`
retiré de `VUES_PANNEAU` (`js/panel.js`), le dashboard commune n'est
plus une vue du panneau. Plus besoin de `map.invalidateSize()` non plus
: `#commune-page` est un calque par-dessus la carte, pas un changement
de largeur du conteneur de la carte.

**Trouvé en implémentant** : le bouton "Accueil" (`home-button`,
`js/map.js`) ne fermait que les résultats "près de chez moi" avant
d'ouvrir l'accueil - `#commune-page` (`z-index: 600`, au-dessus de
`#hero`) resterait donc affiché par-dessus, rendant "Accueil" invisible
depuis la page commune. Corrigé en fermant aussi `#commune-page` dans
ce même gestionnaire.

Testé : ouverture/fermeture (dashboard rempli avec des données de
démonstration, capture d'écran desktop et mobile envoyée à
l'utilisatrice), clic réel sur "Retour à la carte" vérifié, et confirmé
qu'aucune référence à l'ancien `#commune-view` ne subsiste dans le
code.

**Mise à jour** : retour direct de l'utilisatrice sur cette 1ère
version - "illisible, tout en longueur, ça sert à rien", simplement
empilée verticalement en reprenant le contenu de l'ancien panneau
latéral sans vraiment exploiter la largeur disponible. Demande
explicite de ne pas repartir de cette mise en page et d'en faire "de
jolies choses".

Repensé en `.commune-grille` (`css/style.css`) : vraie grille de cartes
(`display:grid; grid-template-columns: repeat(auto-fit, minmax(260px,
1fr))`) qui se réorganise seule selon la largeur d'écran, plutôt qu'une
colonne unique. Trois cartes compactes côte à côte (démographie,
mairie, qualité de l'eau), puis deux cartes pleine largeur
(`.commune-carte-large` : décompte d'entités, actualités). Même motif
visuel que `.hero-tile`/`#hero-parcelle` déjà établis ailleurs sur le
site (fond blanc, bordure fine, 14px de rayon) plutôt qu'une nouvelle
esthétique à part.

- **`construireCarteDemographie`** (`js/communes.js`, remplace
  l'usage de `construirePopupDemographie` dans le dashboard -
  `construirePopupDemographie` elle-même inchangée, toujours utilisée
  pour la popup de la couche démographie) : gros chiffre population en
  avant-plan ("carte hero", fond en dégradé léger) plutôt qu'une liste
  de lignes égales entre elles, chiffres secondaires (logements,
  établissements, revenu médian) en dessous.
- **`construireCarteDecompte`** (remplace `construireBlocDecompte`) :
  la longue liste à plat pointée comme illisible devient une grille de
  tuiles (icône colorée + chiffre + libellé), groupée en trois
  sous-sections thématiques (Commerces & services, Éducation & petite
  enfance, Sport & loisirs - `titreGroupe` ajouté à
  `COUCHES_DECOMPTE_COMMUNE`) plutôt qu'une seule liste mélangeant
  boulangeries et terrains de foot. Couleur de chaque tuile reprise de
  la couleur déjà utilisée pour cette couche sur la carte (`color`
  ajouté à `COUCHES_DECOMPTE_COMMUNE`, cohérent avec `config.js`
  plutôt qu'une palette inventée à part).
- **`construireCarteMairie`**/**`construireCarteQualiteEau`** : même
  contenu qu'avant, sur les nouvelles classes `.commune-carte`/
  `.commune-ligne` (pas `.popup-fiche-section`, dont le padding/bordure
  pensés pour l'empilement dans une popup étroite auraient fait doublon
  avec le padding propre de `.commune-carte`).

Testé (captures d'écran desktop et mobile envoyées à l'utilisatrice,
dashboard rempli avec des données de démonstration incluant les 6
couches du décompte) : grille à 3 colonnes sur desktop qui passe à 1
colonne sur mobile, tuiles du décompte groupées et colorées comme
prévu (33 tuiles réparties en 3 groupes sur l'exemple testé), aucune
erreur JS liée au nouveau code.

## Dashboard commune : polish de la grille de cartes

Retour direct de l'utilisatrice sur la grille de cartes ci-dessus,
quatre points :

- **Carte "Qualité de l'eau" plus courte que ses voisines** : bug CSS
  Grid, pas un problème de contenu. `#commune-qualite-eau` (le `<div>`
  vide créé par `construireDashboardCommune`, rempli plus tard une fois
  Hub'Eau résolu) s'étire bien à la hauteur de la ligne par défaut de la
  grille (`align-items: stretch`), mais la carte `.commune-carte`
  injectée dedans ensuite via `innerHTML` n'hérite pas de cet
  étirement - elle ne prend que la hauteur de son propre contenu.
  Corrigé en donnant `height: 100%` à `.commune-carte` et
  explicitement à `#commune-qualite-eau`/son contenu (`css/style.css`).
- **Trou à droite de la carte eau** : rempli avec une nouvelle carte
  "Prix immobilier" (`construireCartePrixImmobilier`, `js/communes.js`)
  - prix médian au m² et nombre de ventes, à partir de
    `donneesBrutes["prixImmobilier"]` déjà chargé en mémoire
    (`lazy:false`, `couches/urbanisme/prix_immobilier_communes.geojson`) :
    aucun nouvel appel réseau. Même piège `com_insee`/`code_insee`
    texte-vs-nombre déjà rencontré pour `banques`/`airesJeu` :
    comparaison via `String(f.properties.code_insee) === codeInsee`.
- **Clic sur une tuile du décompte → ouvre la carte sur ce service** :
  chaque `.commune-tuile` porte désormais `data-couche` (l'id de sa
  couche). `initClicTuilesDecompte` (`js/communes.js`) écoute les clics
  par délégation sur `#commune-contenu` (branché une seule fois, son
  contenu étant entièrement réécrit à chaque ouverture de commune) :
  ferme le dashboard, re-zoome sur la commune puis réutilise
  `chargerEtAfficherCouche` (déjà existante dans `js/proximite.js`,
  utilisée par la recherche) pour charger/afficher/cocher la couche
  correspondante - pas de nouvelle logique de chargement de couche à
  maintenir en double.
- **Une icône par service, pas par couche** : les fonctions `grouper`
  de `COUCHES_DECOMPTE_COMMUNE` renvoient maintenant `{label, icon}` au
  lieu d'un simple libellé. `categorieCommerce` avait déjà une icône
  par sous-catégorie (réutilisée telle quelle) ; trois nouvelles tables
  ajoutées pour les autres couches groupées (`ICONES_ECOLE`,
  `ICONES_PETITE_ENFANCE`, `ICONES_SPORT`), avec une icône générique de
  repli (`fa-graduation-cap`/`fa-baby`/`fa-medal`) pour toute valeur
  absente de la table plutôt qu'une erreur.

Testé (Playwright, données réelles de `couches/commerces/`,
`couches/famille/`, `couches/services/urbanisme` chargées directement -
`donneesBrutes` rempli à la main dans le test car `initialiserCouches`
ne tourne pas dans cet environnement sandbox) : les trois cartes
compactes (mairie, qualité de l'eau, prix immobilier) font
effectivement la même hauteur (127px chacune sur l'exemple testé), la
carte prix immobilier s'affiche avec les vraies données, 36 tuiles avec
des icônes distinctes par sous-catégorie confirmées, clic sur une tuile
vérifié : appelle bien `chargerEtAfficherCouche` avec l'id de couche
attendu et referme le dashboard. Capture d'écran envoyée à
l'utilisatrice.

## Qualité de l'eau potable : vraie couche sur la carte

Retour direct de l'utilisatrice sur la carte "Qualité de l'eau
potable" du dashboard commune (ci-dessus) : elle s'attendait à une
vraie couche sur la carte, pas seulement une carte dans le dashboard.
Après discussion sur la pertinence (Hub'Eau ne renvoie pas de
coordonnées précises, un résultat est rattaché à une commune/UDI, pas
à un point) : choroplèthe sur les polygones communaux existants
(`couches/communes.geojson`) plutôt qu'un marqueur ponctuel qui
inventerait une localisation absente de la donnée - même solution déjà
retenue pour "Historique des catastrophes naturelles" (CATNAT), un cas
identique (donnée par commune, pas de géométrie propre). Chargement en
direct (pas de fichier statique pré-généré) : retour direct de
l'utilisatrice après avoir pesé les deux options, jugé pas assez lourd
pour justifier un fichier à régénérer périodiquement.

Nouvelle couche `qualiteEau` (`js/config.js`, groupe "urbanisme", à
côté de démographie/prix immobilier) :

- **`fetchQualiteEauTerritoire`** : récupère `couches/communes.geojson`
  (géométrie, déjà dans le dépôt) et `recupererQualiteEauTerritoire`
  (un appel Hub'Eau par commune du territoire - 24 appels, l'API ne
  filtre pas sur plusieurs communes à la fois) en parallèle, même
  construction que `fetchCatnat`.
- **Cache localStorage 24h** (`CACHE_QUALITE_EAU_CLE`, même mécanisme
  que `CACHE_CATNAT_CLE`) : un contrôle sanitaire ne change pas d'un
  chargement de page à l'autre, évite de refaire les 24 appels à
  chaque visite/session.
- **`geojsonDepuisQualiteEau`** : fusionne le résultat Hub'Eau de
  chaque commune dans les propriétés de son polygone
  (`qualite_eau_resultat`), une Feature par commune.
- **`styleQualiteEau`** : vert si conforme, rouge (`#AD4826`) si non
  conforme (même test de mot-clé que `construireCarteQualiteEau` du
  dashboard, sur `conclusion_conformite_prelevement` -
  `qualiteEauNonConforme` partagée entre couleur de couche et texte de
  popup pour qu'elles ne puissent jamais se contredire), gris si aucun
  résultat récent pour la commune.
- **`construirePopupQualiteEau`** (`js/popup.js`) : même contenu que la
  carte du dashboard (statut, réseau, date du dernier contrôle),
  adapté au gabarit popup (`popup-fiche`) plutôt qu'au gabarit carte
  (`commune-carte`).

**Trouvé en implémentant** : `URL_HUBEAU_EAU_POTABLE` était déjà
déclarée dans `js/communes.js` (carte du dashboard, ajoutée dans un
tour précédent) - la redéclarer dans `js/config.js` pour la nouvelle
couche provoquait une vraie `SyntaxError` ("Identifier ... has already
been declared") au chargement du site, les scripts du site partageant
tous le même global (pas de modules ES). Corrigé en gardant une seule
déclaration, dans `js/config.js` (chargé avant `js/communes.js`, donc
avant que le dashboard en ait besoin) : `js/communes.js` réutilise
maintenant cette même constante plutôt que d'en redéclarer une.

Testé (Playwright, appels Hub'Eau interceptés avec des réponses
réalistes - conforme, non conforme, et une commune sans résultat -
puisque ce sandbox n'a de toute façon pas accès à Hub'Eau en direct) :
les 24 communes du territoire fusionnées avec leurs polygones
(`fetchQualiteEauTerritoire` + `geojsonDepuisQualiteEau`), couleurs
vérifiées pour les trois cas (vert/rouge/gris), popup vérifiée
(statut, réseau, date), cache localStorage vérifié à l'écriture ET à
la lecture (deuxième appel avec le réseau Hub'Eau explicitement coupé
côté test : toujours 24 communes, bien servi depuis le cache). Rendu
Leaflet réel (couleur effective des polygones sur la carte) non
vérifiable dans ce sandbox (Leaflet lui-même n'y charge pas, limite
déjà documentée ailleurs dans ce fichier) - le panneau des couches
utilisant la même construction générique que les autres choroplèthes
déjà en production (démographie, prix immobilier, CATNAT), aucune
raison de fonctionner différemment en conditions réelles.

## Cours d'eau (rivières, ruisseaux)

Demande directe de l'utilisatrice, envisagée un temps via Hub'Eau -
mais Hub'Eau ne fournit que des stations de mesure ponctuelles, pas le
tracé du réseau hydrographique lui-même. Le tracé vient donc
d'OpenStreetMap, avec la même méthode que les autres couches OSM du
site (voir "Couches converties en fichiers statiques" plus haut) :
export overpass-turbo.eu sur le rectangle englobant le territoire
(`way["waterway"~"^(river|stream|canal|drain|ditch)$"]`), envoyé par
l'utilisatrice, puis filtré côté script par un vrai test
point-dans-polygone contre `couches/epci.geojson` - 1431 tronçons dans
l'export brut, 401 réellement dans le territoire une fois le
débordement sur les communes limitrophes écarté (couches/tourisme/cours_eau.geojson).
Une ligne est gardée dès qu'au moins un de ses points tombe dans le
polygone plutôt que d'être découpée pile à la frontière : un cours
d'eau qui sort du territoire sur quelques mètres reste lisible d'un
seul tenant.

Nouvelle couche `coursEau` (`js/config.js`, groupe "tourisme" - à côté
des points remarquables de la forêt de Bercé) :

- **`styleCoursEau`** : épaisseur dégressive par type (rivière 3px,
  canal 2,5px, ruisseau 1,5px, fossé/drain 1px) plutôt qu'un trait
  uniforme qui aurait noyé les vraies rivières (Le Loir, la Veuve...)
  au milieu des centaines de petits fossés agricoles. Tronçons
  intermittents (`intermittent=yes`, peuvent s'assécher en été) en
  trait plus clair et pointillé - même code visuel que le contour EPCI
  déjà en pointillés (`js/map.js`).
- **`construirePopupCoursEau`** (`js/popup.js`) : nom si disponible
  (172 tronçons sur 401 sont nommés), type (rivière/ruisseau/canal/
  fossé), alerte "intermittent" et mention des passages busés/souterrains
  (`tunnel=culvert`, 99 tronçons - explique une ligne qui semble
  s'interrompre sans raison sur la carte).

Testé (Playwright : fichier chargé directement, `L.geoJSON`/rendu
Leaflet réel non vérifiable dans ce sandbox comme les autres couches -
voir plus haut) : 401 tronçons confirmés (284 ruisseaux, 54 rivières,
51 fossés, 11 fossés de drainage, 1 canal), styles vérifiés pour les
trois cas (rivière épaisse, tronçon intermittent en pointillé clair,
fossé fin), popups vérifiées (nom + type pour une rivière nommée,
libellé générique "Ruisseau" pour un tronçon sans nom, alerte
"peut s'assécher en été" pour un tronçon intermittent).

## Commerces fermés définitivement (sans supprimer le point)

Retour direct de l'utilisatrice : un commerce qui ferme ne doit pas
disparaître de la carte (le point reste pertinent si un repreneur
arrive un jour) - juste être signalé comme fermé plutôt que supprimé
de `couches/commerces/commerces.geojson`.

**`COMMERCES_FERMES`** (`js/config.js`) : petite liste manuelle tenue
directement en JS, par `osm_id` (déjà présent dans chaque fiche,
stable d'un export à l'autre) - même convention que les autres petites
listes manuelles de ce fichier (`COMMUNES_TERRITOIRE`,
`TYPES_COMMERCES`...), pas de fichier séparé à fetcher pour une
poignée d'entrées éditées à la main au fil des signalements. Pour
signaler une fermeture : ajouter une entrée avec l'`osm_id` du
commerce (visible dans les propriétés de sa fiche) ; pour un
rétablissement (repreneur), retirer l'entrée.

Effets d'une entrée dans `COMMERCES_FERMES` :

- **`iconeCommerce`** (`js/config.js`) : icône inchangée (toujours
  identifiable comme boulangerie/restaurant/...) mais en gris neutre
  plutôt que la couleur de sa catégorie - pas un rouge d'alerte, qui
  suggèrerait un problème plutôt qu'une simple fermeture.
- **`construirePopupCommerce`** (`js/popup.js`) : badge "Fermé
  définitivement" (nouvelle variante `.popup-fiche-badge.ferme-def`,
  gris neutre - distincte du badge rouge "Fermé" existant, qui parle
  des horaires du jour, pas de fermeture définitive), avec la date/note
  éventuelle. Contact et horaires masqués : les montrer quand même
  serait trompeur (numéro qui ne répond plus, horaires caducs).
- **`lancerRechercheProximite`** (`js/proximite.js`) : exclu des
  résultats "près de chez moi" - recommander une adresse fermée irait à
  l'encontre du but de cette fonction. Reste en revanche trouvable par
  la recherche texte classique (utile pour confirmer "oui, c'est bien
  fermé" plutôt que de ne rien trouver).

Testé (Playwright) : icône et popup vérifiées avant/après ajout d'une
entrée de test (badge, note, date, horaires/contact masqués), commerce
non concerné inchangé, icône revenue à la normale après retrait de
l'entrée.

## Cours d'eau : tronçons fusionnés par cours d'eau

Retour direct de l'utilisatrice : le tracé OSM des cours d'eau (voir
plus haut) était morcelé en de nombreux petits tronçons (un `way` par
section entre deux intersections/changements de tag, convention OSM
normale) - un même cours d'eau nommé pouvait ainsi apparaître en une
douzaine de bouts distincts, chacun avec sa propre popup/zone de clic.

Script Python jetable (`shapely.ops.linemerge`, même esprit "hors
dépôt" que le script de filtrage territorial) : regroupe les 401
tronçons par `name` (172 tronçons nommés, 25 noms distincts - les 229
tronçons sans nom, en général de petits fossés isolés, n'ont rien pour
être identifiés comme faisant partie du même cours d'eau, donc jamais
fusionnés), puis recolle bout à bout tous les tronçons d'un même nom
qui se touchent exactement. Résultat : **401 tronçons → 297** ; les
rivières simples deviennent une seule ligne continue (L'Yre : 21 → 1,
Ruisseau de Dauvers : 20 → 1, Le Dinan : 12 → 1, Le Ponceau : 12 → 1).

Le Loir (25 → 19) et La Dême (11 → 11, aucune fusion) ne se réduisent
pas complètement à une seule ligne : deux raisons différentes, toutes
les deux réelles plutôt qu'un problème de méthode : (1) de vrais
embranchements à trois tronçons ou plus au même point (bras de moulin,
courants sur l'histoire de ces rivières - vérifié : 5 points à degré 3
rien que sur La Dême), où `linemerge` refuse à raison de choisir une
direction plutôt qu'une autre ; (2) de vrais trous dans le tracé OSM
(deux tronçons voisins du même cours d'eau qui ne se touchent pas du
tout, jusqu'à 3,6 km d'écart mesuré sur un cas du Loir) - un maillage
incomplet côté OpenStreetMap, rien à fusionner sans inventer une
géométrie qui n'existe pas dans la donnée source.

Propriétés recalculées par nom (pas par ligne fusionnée individuelle -
un embranchement partage son point de jonction entre plusieurs bras,
réattribuer fiablement chaque tronçon d'origine à son bras exact
n'aurait servi à rien vu la donnée : `waterway`/`intermittent` ne
varient quasiment jamais en cours de route pour un même cours d'eau
nommé) : `waterway` le plus fréquent du groupe, `intermittent=yes`
seulement si TOUS les tronçons du nom le sont, `ref:sandre` gardé s'il
est identique partout dans le groupe. Le champ `tunnel` (passage busé)
est en revanche abandonné à la fusion - resterait pertinent seulement
sur le petit tronçon concerné, pas sur toute une rivière fusionnée.

Testé (Playwright, même suite que plus haut rejouée sur le fichier
fusionné) : 297 tronçons confirmés, styles et popups toujours corrects
après la fusion (rivière épaisse, tronçon intermittent en pointillé
clair, fossé fin, popup nom/type).

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
- **Rafraîchir les couches converties en fichiers statiques** (voir
  "Couches converties en fichiers statiques" plus haut) : la donnée
  OpenStreetMap de ces couches est figée à la date de l'extraction
  (12/09/2026), elle ne se met plus à jour seule. Si un trou de
  couverture est signalé sur l'une d'elles, ou simplement pour
  rafraîchir périodiquement : réexécuter les deux requêtes Overpass QL
  sur [overpass-turbo.eu](https://overpass-turbo.eu/), exporter chaque
  résultat en GeoJSON, puis repasser le filtrage point-dans-polygone sur
  `couches/epci.geojson` avant d'écraser les fichiers `couches/**/*.geojson`
  concernés.
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
- **Couche "bâtiments" (`URL_BATIMENTS_EPCI`, détection du bâti pour "à
  proximité") : À VÉRIFIER EN CONDITIONS RÉELLES**, voir la section
  dédiée plus haut — nom de flux et schéma de géométrie non confirmés
  (accès réseau restreint pendant le développement). Vérifier qu'une
  parcelle agricole connue pour avoir une maison affiche bien "à
  proximité" dans sa fiche ; si ce n'est jamais le cas, inspecter la
  réponse réseau réelle de `URL_BATIMENTS_EPCI` et ajuster
  `pointBatiment`/le nom du flux dans `js/recherche.js` en conséquence.

## Déploiement

Le site est 100% statique : il suffit de pousser tout le dossier sur la
branche GitHub Pages, comme pour la version précédente.
