/* =========================================================
   GÉOBERCÉ — RECHERCHE FONCIÈRE
   Panneau "Explorer le foncier" : recherche de parcelles par critères
   (surface, urbanisme, ventes DVF, DPE...) plutôt que clic par clic.

   Les critères disponibles sont volontairement limités à ce que les
   données déjà présentes dans le SIG permettent de calculer avec
   confiance :
   - surface de parcelle, commune : directement dans le cadastre.
   - zone PLUi, aléa RGA : rapprochement géométrique (le centre de la
     parcelle tombe-t-il dans telle zone ?).
   - ventes, bâti (nombre/surface) : dernière mutation DVF connue pour
     cette parcelle (elements_locaux) - donc seulement pour les
     parcelles ayant déjà été vendues, pas la totalité du bâti existant.
   - DPE : le DPE le plus proche géographiquement, à l'intérieur de la
     parcelle.
   Piscine et permis récents ne sont pas dans les données du site
   aujourd'hui : ces critères n'apparaissent pas plutôt que d'afficher
   un filtre qui ne filtrerait rien.

   La recherche porte sur les parcelles actuellement affichées à l'écran
   (même logique que le rendu de la couche cadastre, voir layers.js/
   featuresDansVue), pas sur les dizaines de milliers de parcelles du
   territoire entier : ça allège à la fois le calcul (jointures
   géométriques avec DPE/PLUi/RGA) et reste cohérent avec ce qu'on voit
   sur la carte. Il faut donc être zoomé sur une zone avant de chercher.
   ========================================================= */

const COUCHES_RECHERCHE = ["cadastre", "mutations", "dpe", "zonagePLUi", "rga"];

const LABELS_PLUI = {
    U: "U — Zone urbaine", AUc: "AUc — À urbaniser (constructible)",
    AUs: "AUs — À urbaniser (stricte)", A: "A — Zone agricole", N: "N — Zone naturelle"
};
/* Zones où construire est possible dès aujourd'hui (contrairement à AUs,
   qui attend l'ouverture à l'urbanisation) : sert à décider si "à
   proximité" a un sens sur la fiche parcelle (popup.js), pas seulement
   les zones agricoles/naturelles où ça n'intéresse personne. */
const ZONES_PLUI_CONSTRUCTIBLES = ["U", "AUc"];
const LABELS_RGA = { 1: "Faible", 2: "Moyen", 3: "Fort" };
const CLASSES_DPE = ["A", "B", "C", "D", "E", "F", "G"];
const LIMITE_RESULTATS = 3000;

let resultatsEnrichis = null;        // parcelles visibles à l'ouverture, enrichies une fois
let coucheRechercheActuelle = null;  // couche Leaflet des résultats affichés

function zoomMinCadastre() {
    const conf = LAYERS.find(l => l.id === "cadastre");
    return (conf && conf.zoomMin) || 0;
}

/* ---------- Géométrie (sans dépendance externe) ---------- */

function centroideFeature(feature) {
    const geom = feature.geometry;
    let anneau;
    if (geom && geom.type === "Polygon") anneau = geom.coordinates[0];
    else if (geom && geom.type === "MultiPolygon") anneau = geom.coordinates[0][0];
    else return null;
    let sx = 0, sy = 0;
    anneau.forEach(([x, y]) => { sx += x; sy += y; });
    return [sx / anneau.length, sy / anneau.length];
}

function pointDansAnneau(pt, anneau) {
    let dedans = false;
    for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
        const xi = anneau[i][0], yi = anneau[i][1];
        const xj = anneau[j][0], yj = anneau[j][1];
        const traverse = ((yi > pt[1]) !== (yj > pt[1])) &&
            (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
        if (traverse) dedans = !dedans;
    }
    return dedans;
}

function pointDansFeature(pt, feature) {
    const geom = feature && feature.geometry;
    if (!pt || !geom) return false;
    if (geom.type === "Polygon") return pointDansAnneau(pt, geom.coordinates[0]);
    if (geom.type === "MultiPolygon") return geom.coordinates.some(poly => pointDansAnneau(pt, poly[0]));
    return false;
}

function grouperParChamp(features, champ) {
    const groupes = {};
    features.forEach(f => {
        const cle = (f.properties || {})[champ];
        (groupes[cle] = groupes[cle] || []).push(f);
    });
    return groupes;
}

/* ---------- Chargement + enrichissement (une seule fois) ---------- */

function chargerDonneesFoncieres() {
    return Promise.all(COUCHES_RECHERCHE.map(id => new Promise(resolve => {
        const conf = LAYERS.find(l => l.id === id);
        chargerCouche(conf, resolve, resolve);
    })));
}

/* Index pré-calculés une seule fois pour tout un lot de parcelles
   (recherche par critères) : dvfParReference permet un accès direct par
   référence de parcelle (O(1)) plutôt qu'un .find() sur ~11 000
   mutations à chaque parcelle, dpeParCommune réduit le nombre de DPE à
   tester au point-in-polygon en les groupant par code INSEE au préalable
   (fiable : contrairement au zonage PLUi ci-dessous, ce champ est
   toujours renseigné dans le flux DPE). Pour un usage ponctuel (une
   seule parcelle, ex. popup au clic), infosParcelle reconstruit ces
   index à la volée si on ne les lui fournit pas : le coût est le même
   qu'une seule itération du lot, donc négligeable pour un clic isolé. */
function construireIndicesFonciers() {
    const mutations = donneesBrutes["mutations"] || [];
    const dpePoints = donneesBrutes["dpe"] || [];
    const dvfParReference = {};
    mutations.forEach(f => { dvfParReference[f.properties.reference_parcelle] = f; });
    return { dvfParReference, dpeParCommune: grouperParChamp(dpePoints, "code_insee") };
}

/* Couches déjà chargées au démarrage (lazy: false dans config.js), donc
   toujours disponibles dans donneesBrutes sans chargement supplémentaire
   : sert au "à proximité" de la fiche parcelle. */
const CATEGORIES_PROXIMITE = [
    { layerId: "education", titre: "École la plus proche" },
    { layerId: "commerces", titre: "Commerce le plus proche" },
    { layerId: "mairies", titre: "Mairie la plus proche" }
];

function plusProche(centre, layerId) {
    const features = donneesBrutes[layerId] || [];
    if (!centre || !features.length) return null;
    const origine = L.latLng(centre[1], centre[0]);
    let distanceMin = Infinity;
    features.forEach(f => {
        const pt = (f.geometry && f.geometry.type === "Point") ? f.geometry.coordinates : centroideFeature(f);
        if (!pt) return;
        const d = origine.distanceTo(L.latLng(pt[1], pt[0]));
        if (d < distanceMin) distanceMin = d;
    });
    return Number.isFinite(distanceMin) ? distanceMin : null;
}

/* Calcule toutes les infos foncières d'UNE parcelle : mutation DVF
   correspondante (référence exacte), zone PLUi et niveau RGA à cet
   endroit (le centre de la parcelle tombe dans quelle zone ?), DPE le
   plus proche s'il est à l'intérieur de la parcelle, et distance aux
   équipements les plus proches. Le zonage PLUi n'est PAS groupé par
   commune comme le sont DPE/mutations : son champ "insee" s'est avéré
   systématiquement vide dans le flux réel (contrairement à ce que
   laissait supposer le jeu de données de test utilisé au départ), le
   grouper aurait donc fait échouer la recherche de zone à tous les
   coups. Pas grave en pratique : quelques centaines de zones, un simple
   point-in-polygon sur l'ensemble reste rapide. Pour les ventes,
   "elements_locaux"/"elements_terrains" d'une mutation DVF peuvent
   porter sur plusieurs parcelles à la fois (un même acte notarié
   regroupant plusieurs références) : on ne garde que les lots dont le
   champ "parcelle" correspond exactement à celle affichée, sinon le
   nombre de bâtiments/surface bâtie compterait aussi ceux des parcelles
   voisines vendues dans le même acte. */
function infosParcelle(feature, indices) {
    const { dvfParReference, dpeParCommune } = indices || construireIndicesFonciers();
    const zonesPLUi = donneesBrutes["zonagePLUi"] || [];
    const zonesRGA = donneesBrutes["rga"] || [];
    const p = feature.properties;
    const centre = centroideFeature(feature);

    const dvf = dvfParReference[p.id] || null;
    const dpe = (dpeParCommune[p.commune] || [])
        .find(f => pointDansFeature(f.geometry.coordinates, feature)) || null;
    const plui = zonesPLUi.find(zone => pointDansFeature(centre, zone)) || null;
    const rga = zonesRGA.find(zone => pointDansFeature(centre, zone)) || null;

    /* ventesDepuisMutation (config.js) : partagée avec le style et le
       popup de la couche "mutations" elle-même, pour ne pas dupliquer
       ce calcul (filtrage des lots à la seule parcelle concernée). */
    const ventes = ventesDepuisMutation(dvf);

    const typezonePLUi = plui ? plui.properties.typezone : null;
    const nbBatiments = ventes[0] ? ventes[0].nbBatiments : null;

    /* "À proximité" n'a de sens que pour un terrain à bâtir ou une
       parcelle qui porte déjà une maison (voir ZONES_PLUI_CONSTRUCTIBLES
       plus haut) : sur une parcelle agricole/naturelle sans bâti, ni
       personne ne s'en sert, ni la recherche par critères qui n'affiche
       jamais ce champ — inutile de calculer la distance aux équipements
       les plus proches (le plus coûteux de ce qui précède) à chaque fois. */
    const proximite = (ZONES_PLUI_CONSTRUCTIBLES.includes(typezonePLUi) || nbBatiments)
        ? CATEGORIES_PROXIMITE
            .map(cat => {
                const distance = plusProche(centre, cat.layerId);
                return distance !== null ? { titre: cat.titre, distance } : null;
            })
            .filter(Boolean)
        : [];

    return {
        commune: p.commune, communeNom: p.commune_nom, surface: p.surface_m2,
        adresse: dvf ? dvf.properties.adresse : null,
        typezonePLUi,
        libellePLUi: plui ? (plui.properties.libelong || plui.properties.libelle) : null,
        niveauRGA: rga ? rga.properties.niveau : null,
        ventes, nbBatiments,
        surfaceBatie: ventes[0] ? ventes[0].surfaceBatie : null,
        dpe: dpe ? {
            classe: dpe.properties.etiquette_dpe, conso: dpe.properties.consommation,
            anneeConstruction: dpe.properties.annee_construction
        } : null,
        proximite
    };
}

/* Pour chaque parcelle cadastrale (déjà réduite aux seules parcelles
   visibles à l'écran, voir ouvrirRecherche) : ne garde que le sous-
   ensemble compact utile au filtrage (voir correspond()), calculé via
   infosParcelle ci-dessus. */
function enrichirParcelles(parcelles) {
    const indices = construireIndicesFonciers();
    parcelles.forEach(parcelle => {
        const infos = infosParcelle(parcelle, indices);
        const derniereVente = infos.ventes[0] || null;
        parcelle._recherche = {
            commune: infos.commune, surface: infos.surface,
            typezonePLUi: infos.typezonePLUi, niveauRGA: infos.niveauRGA,
            dvf: infos.ventes.length > 0,
            prixVente: derniereVente ? derniereVente.valeur : null,
            anneeVente: derniereVente ? derniereVente.annee : null,
            nbBatiments: infos.nbBatiments, surfaceBatie: infos.surfaceBatie,
            etiquetteDpe: infos.dpe ? infos.dpe.classe : null
        };
    });

    resultatsEnrichis = parcelles;
    return parcelles;
}

/* ---------- Filtrage ---------- */

function lireCriteres() {
    const val = id => document.getElementById(id).value.trim();
    const num = id => { const v = val(id); return v === "" ? null : Number(v); };

    return {
        commune: val("rf-commune") || null,
        surfaceMin: num("rf-surface-min"), surfaceMax: num("rf-surface-max"),
        typezonePLUi: val("rf-plui") || null,
        niveauRGA: val("rf-rga") ? Number(val("rf-rga")) : null,
        aEuUneVente: document.getElementById("rf-vente").checked,
        prixMin: num("rf-prix-min"), prixMax: num("rf-prix-max"),
        anneeVenteMin: num("rf-annee-vente-min"), anneeVenteMax: num("rf-annee-vente-max"),
        nbBatimentsMin: num("rf-batiments-min"), surfaceBatieMin: num("rf-surface-batie-min"),
        dpe: CLASSES_DPE.filter(c => document.getElementById("rf-dpe-" + c).checked)
    };
}

function correspond(r, c) {
    if (c.commune && r.commune !== c.commune) return false;
    if (c.surfaceMin != null && (r.surface == null || r.surface < c.surfaceMin)) return false;
    if (c.surfaceMax != null && (r.surface == null || r.surface > c.surfaceMax)) return false;
    if (c.typezonePLUi && r.typezonePLUi !== c.typezonePLUi) return false;
    if (c.niveauRGA != null && r.niveauRGA !== c.niveauRGA) return false;
    if (c.aEuUneVente && !r.dvf) return false;
    if (c.prixMin != null && (r.prixVente == null || r.prixVente < c.prixMin)) return false;
    if (c.prixMax != null && (r.prixVente == null || r.prixVente > c.prixMax)) return false;
    if (c.anneeVenteMin != null && (r.anneeVente == null || r.anneeVente < c.anneeVenteMin)) return false;
    if (c.anneeVenteMax != null && (r.anneeVente == null || r.anneeVente > c.anneeVenteMax)) return false;
    if (c.nbBatimentsMin != null && (r.nbBatiments == null || r.nbBatiments < c.nbBatimentsMin)) return false;
    if (c.surfaceBatieMin != null && (r.surfaceBatie == null || r.surfaceBatie < c.surfaceBatieMin)) return false;
    if (c.dpe.length && (!r.etiquetteDpe || !c.dpe.includes(r.etiquetteDpe))) return false;
    return true;
}

function filtrerParcelles(criteres) {
    return (resultatsEnrichis || []).filter(feature => correspond(feature._recherche, criteres));
}

/* ---------- Affichage des résultats sur la carte ---------- */

function afficherResultatsRecherche(map, features) {
    if (coucheRechercheActuelle) {
        map.removeLayer(coucheRechercheActuelle);
        coucheRechercheActuelle = null;
    }
    if (groupesLeaflet["cadastre"] && map.hasLayer(groupesLeaflet["cadastre"])) {
        map.removeLayer(groupesLeaflet["cadastre"]);
        const checkbox = document.getElementById("layer-cadastre");
        if (checkbox) checkbox.checked = false;
    }
    const boutonVider = document.getElementById("rf-vider");
    if (!features.length) {
        if (boutonVider) boutonVider.disabled = true;
        return;
    }

    const conf = LAYERS.find(l => l.id === "cadastre");
    coucheRechercheActuelle = construireCoucheDonnees(
        { type: "FeatureCollection", features },
        { ...conf, styleFn: () => ({ color: PALETTE.terracotta, weight: 2, fillColor: PALETTE.terracotta, fillOpacity: 0.35 }) }
    );
    coucheRechercheActuelle.addTo(map);
    if (boutonVider) boutonVider.disabled = false;

    const bounds = L.geoJSON({ type: "FeatureCollection", features }).getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 17, padding: [40, 40] });
}

/* Retire uniquement les parcelles surlignées par la dernière recherche
   affichée sur la carte, sans toucher aux critères du formulaire (voir
   reinitialiserFormulaire ci-dessus, qui fait l'inverse) : les deux
   actions sont volontairement séparées, l'une pour repartir sur des
   critères vierges, l'autre pour juste faire de la place sur la carte
   avant une nouvelle recherche. */
function viderSelectionCarte(map) {
    if (coucheRechercheActuelle) {
        map.removeLayer(coucheRechercheActuelle);
        coucheRechercheActuelle = null;
    }
    const boutonVider = document.getElementById("rf-vider");
    if (boutonVider) boutonVider.disabled = true;
}

/* ---------- Formulaire ---------- */

function optionsCommune() {
    return `<option value="">Toutes les communes</option>` +
        Object.keys(COMMUNES_TERRITOIRE).sort((a, b) => COMMUNES_TERRITOIRE[a].localeCompare(COMMUNES_TERRITOIRE[b]))
            .map(insee => `<option value="${insee}">${COMMUNES_TERRITOIRE[insee]}</option>`).join("");
}

function construireFormulaire() {
    const conteneur = document.getElementById("recherche-contenu");
    conteneur.innerHTML = `
        <form id="recherche-form">
            <label class="rf-champ">
                <span>Commune</span>
                <select id="rf-commune">${optionsCommune()}</select>
            </label>

            <div class="rf-groupe">
                <div class="rf-groupe-titre">Parcelle</div>
                <label class="rf-champ rf-champ-plage">
                    <span>Surface (m²)</span>
                    <span class="rf-plage"><input type="number" id="rf-surface-min" min="0" placeholder="min"> → <input type="number" id="rf-surface-max" min="0" placeholder="max"></span>
                </label>
                <label class="rf-champ">
                    <span>Zone PLUi</span>
                    <select id="rf-plui">
                        <option value="">Toutes les zones</option>
                        ${Object.keys(LABELS_PLUI).map(k => `<option value="${k}">${LABELS_PLUI[k]}</option>`).join("")}
                    </select>
                </label>
                <label class="rf-champ">
                    <span>Aléa retrait-gonflement des argiles</span>
                    <select id="rf-rga">
                        <option value="">Indifférent</option>
                        ${Object.keys(LABELS_RGA).map(k => `<option value="${k}">${LABELS_RGA[k]}</option>`).join("")}
                    </select>
                </label>
            </div>

            <div class="rf-groupe">
                <div class="rf-groupe-titre">Bâti <small>(estimé depuis la dernière vente connue)</small></div>
                <label class="rf-champ">
                    <span>Nombre de bâtiments (min)</span>
                    <input type="number" id="rf-batiments-min" min="0">
                </label>
                <label class="rf-champ">
                    <span>Surface bâtie (min, m²)</span>
                    <input type="number" id="rf-surface-batie-min" min="0">
                </label>
                <div class="rf-champ">
                    <span>Classe DPE</span>
                    <div class="rf-dpe-liste">
                        ${CLASSES_DPE.map(c => `
                            <label class="rf-dpe-chip rf-dpe-${c}">
                                <input type="checkbox" id="rf-dpe-${c}">${c}
                            </label>
                        `).join("")}
                    </div>
                </div>
            </div>

            <div class="rf-groupe">
                <div class="rf-groupe-titre">Ventes (DVF)</div>
                <label class="rf-champ rf-champ-inline">
                    <input type="checkbox" id="rf-vente">
                    <span>A eu une vente connue</span>
                </label>
                <label class="rf-champ rf-champ-plage">
                    <span>Prix (€)</span>
                    <span class="rf-plage"><input type="number" id="rf-prix-min" min="0" placeholder="min"> → <input type="number" id="rf-prix-max" min="0" placeholder="max"></span>
                </label>
                <label class="rf-champ rf-champ-plage">
                    <span>Année de vente</span>
                    <span class="rf-plage"><input type="number" id="rf-annee-vente-min" min="2014" max="2030" placeholder="min"> → <input type="number" id="rf-annee-vente-max" min="2014" max="2030" placeholder="max"></span>
                </label>
            </div>

            <div id="rf-statut" class="rf-statut">Chargement des données...</div>

            <div class="rf-actions">
                <button type="submit" id="rf-appliquer" class="rf-bouton-principal" disabled>Afficher les parcelles correspondantes</button>
                <button type="button" id="rf-vider" class="rf-bouton-secondaire" disabled>Vider la sélection sur la carte</button>
                <button type="button" id="rf-reset" class="rf-bouton-secondaire">Réinitialiser les critères</button>
            </div>
        </form>
    `;
}

function compterResultats() {
    return filtrerParcelles(lireCriteres()).length;
}

function mettreAJourStatut() {
    const statut = document.getElementById("rf-statut");
    const bouton = document.getElementById("rf-appliquer");
    if (!statut || !resultatsEnrichis) return;

    const n = compterResultats();
    if (n === 0) {
        statut.textContent = "Aucune parcelle ne correspond à ces critères.";
    } else if (n > LIMITE_RESULTATS) {
        statut.textContent = `${n.toLocaleString("fr-FR")} parcelles correspondent : affinez la recherche pour en afficher moins de ${LIMITE_RESULTATS.toLocaleString("fr-FR")}.`;
    } else {
        statut.textContent = `${n.toLocaleString("fr-FR")} parcelle(s) correspondante(s).`;
    }
    bouton.disabled = n === 0 || n > LIMITE_RESULTATS;
}

function reinitialiserFormulaire() {
    document.getElementById("recherche-form").reset();
    mettreAJourStatut();
}

function ouvrirRecherche(map) {
    fermerAccueil();
    ouvrirVuePanneau("recherche-view");
    construireFormulaire();

    const form = document.getElementById("recherche-form");
    form.addEventListener("input", mettreAJourStatut);
    form.addEventListener("submit", event => {
        event.preventDefault();
        /* Le panneau reste ouvert sur cette même vue (contrairement à
           l'ancien comportement qui repassait sur l'arbre de couches) :
           sinon on perd ses critères de recherche à chaque affichage,
           et il faut rouvrir le panneau pour en essayer d'autres. */
        afficherResultatsRecherche(map, filtrerParcelles(lireCriteres()));
    });
    document.getElementById("rf-vider").addEventListener("click", () => viderSelectionCarte(map));
    document.getElementById("rf-reset").addEventListener("click", reinitialiserFormulaire);

    const statut = document.getElementById("rf-statut");
    const zoomMin = zoomMinCadastre();
    if (map.getZoom() < zoomMin) {
        statut.textContent = `Zoomez sur une zone du territoire (niveau ${zoomMin} ou plus) pour lancer une recherche : elle ne porte que sur les parcelles affichées à l'écran.`;
        return;
    }

    chargerDonneesFoncieres().then(() => {
        const visibles = featuresDansVue("cadastre", map);
        enrichirParcelles(visibles);
        document.getElementById("rf-appliquer").disabled = false;
        mettreAJourStatut();
    });
}
