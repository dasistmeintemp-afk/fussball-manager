/**
 * Service Worker für Offline-Unterstützung und PWA-Installation
 */

const CACHE_NAME = "fm-pro-cache-v17";
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./css/style.css",
    "./manifest.json",
    "./js/core/constants.js",
    "./js/core/dom.js",
    "./js/core/formatters.js",
    "./js/core/random.js",
    "./js/core/validators.js",
    "./js/data/namePools.js",
    "./js/core/moduleResolver.js",
    "./js/data/leagueData.js",
    "./js/data/countryNamePools.js",
    "./js/data/initialData.js",
    "./js/services/migrationService.js",
    "./js/services/saveCodec.js",
    "./js/services/saveService.js",
    "./js/engine/newsEngine.js",
    "./js/engine/boardEngine.js",
    "./js/engine/financeEngine.js",
    "./js/engine/contractEngine.js",
    "./js/engine/scoutingEngine.js",
    "./js/engine/youthEngine.js",
    "./js/engine/positionEngine.js",
    "./js/engine/aiManagerEngine.js",
    "./js/engine/clubGenerator.js",
    "./js/engine/playerGenerator.js",
    "./js/engine/negotiationEngine.js",
    "./js/engine/worldGenerator.js",
    "./js/engine/competitionEngine.js",
    "./js/engine/playerRatingEngine.js",
    "./js/engine/calendarEngine.js",
    "./js/engine/opponentAnalysisEngine.js",
    "./js/engine/gameState.js",
    "./js/engine/matchFlowEngine.js",
    "./js/engine/liveMatchDirector.js",
    "./js/engine/matchEngine.js",
    "./js/engine/transferEngine.js",
    "./js/engine/trainingEngine.js",
    "./js/engine/seasonEngine.js",
    "./js/ui/uiManager.js",
    "./js/app.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    // Cache-First mit Fallback auf Network
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        }).catch(() => {
            return caches.match("./index.html");
        })
    );
});
