// Service worker GéoBercé — permet l'installation en application et un
// minimum de fonctionnement hors-ligne pour la coquille du site (HTML/CSS/JS,
// icônes). Les couches de données (GeoJSON, flux distants) restent toujours
// interrogées sur le réseau : ce ne sont pas des fichiers stables à mettre en
// cache indéfiniment.
const CACHE_VERSION = "geoberce-shell-v1";

const SHELL_FILES = [
    "./",
    "index.html",
    "css/style.css",
    "js/config.js",
    "js/icons.js",
    "js/popup.js",
    "js/layers.js",
    "js/panel.js",
    "js/search.js",
    "js/hero.js",
    "js/proximite.js",
    "js/recherche.js",
    "js/map.js",
    "img/geoberce.png",
    "img/favicon.svg",
    "img/icon-192.png",
    "img/icon-512.png",
    "manifest.webmanifest"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_FILES))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((noms) =>
            Promise.all(
                noms
                    .filter((nom) => nom !== CACHE_VERSION)
                    .map((nom) => caches.delete(nom))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    const estFichierDuSite = url.origin === self.location.origin;
    const estCouche = url.pathname.includes("/couches/");

    // Les données SIG (locales ou distantes) vont toujours au réseau : on ne
    // veut jamais servir une couche périmée depuis le cache.
    if (!estFichierDuSite || estCouche) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((reponseCache) => {
            if (reponseCache) return reponseCache;
            return fetch(event.request).then((reponseReseau) => {
                const copie = reponseReseau.clone();
                caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copie));
                return reponseReseau;
            });
        })
    );
});
