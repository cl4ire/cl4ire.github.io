/* =========================================================
   ICÔNES — GÉOBERCÉ
   ========================================================= */

function creerIconeSIG(emoji, classe) {

    return L.divIcon({

        className: 'geo-marker',

        html: `
            <div class="geo-marker-icon ${classe}">
                <span>${emoji}</span>
            </div>
        `,

        iconSize: [34, 34],

        iconAnchor: [17, 17],

        popupAnchor: [0, -20]

    });
}


/* =========================================================
   BIBLIOTHÈQUE D'ICÔNES
   ========================================================= */

const iconsSIG = {

    mairie: creerIconeSIG(
        '🏛️',
        'geo-marker-mairie'
    ),

    bal: creerIconeSIG(
        '📮',
        'geo-marker-bal'
    ),

    dae: creerIconeSIG(
        '❤️',
        'geo-marker-dae'
    ),

    carburant: creerIconeSIG(
        '⛽',
        'geo-marker-carburant'
    ),

    petiteEnfance: creerIconeSIG(
        '👶',
        'geo-marker-petite-enfance'
    ),

    education: creerIconeSIG(
        '🎓',
        'geo-marker-education'
    ),

    transport: creerIconeSIG(
        '🚌',
        'geo-marker-transport'
    )

};