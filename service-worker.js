/**
 * Service Worker für Offline-Unterstützung und PWA-Installation
 */

const CACHE_NAME = "fm-pro-cache-v80";
const ASSETS_TO_CACHE = [
    "./",
    "./index.html",
    "./css/style.css",
    "./css/design.css",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png",
    "./js/core/constants.js",
    "./js/core/dom.js",
    "./js/core/formatters.js",
    "./js/core/random.js",
    "./js/core/validators.js",
    "./js/data/namePools.js",
    "./js/core/moduleResolver.js",
    "./js/data/leagueData.js",
    "./js/data/countryNamePools.js",
    "./js/data/realClubs.js",
    "./js/data/initialData.js",
    "./js/services/migrationService.js",
    "./js/services/saveCodec.js",
    "./js/services/saveService.js",
    "./js/services/speicherDB.js",
    "./js/engine/newsEngine.js",
    "./js/engine/boardEngine.js",
    "./js/engine/financeEngine.js",
    "./js/engine/contractEngine.js",
    "./js/engine/scoutingEngine.js",
    "./js/engine/youthEngine.js",
    "./js/engine/positionEngine.js",
    "./js/engine/tacticsEngine.js",
    "./js/engine/aiManagerEngine.js",
    "./js/engine/clubGenerator.js",
    "./js/engine/playerGenerator.js",
    "./js/engine/negotiationEngine.js",
    "./js/engine/sportdirektorEngine.js",
    "./js/engine/managerEngine.js",
    "./js/engine/worldGenerator.js",
    "./js/engine/competitionEngine.js",
    "./js/engine/playerRatingEngine.js",
    "./js/engine/facilityEngine.js",
    "./js/engine/cupEngine.js",
    "./js/engine/playoffEngine.js",
    "./js/engine/careerEngine.js",
    "./js/engine/calendarEngine.js",
    "./js/engine/opponentAnalysisEngine.js",
    "./js/engine/matchplanEngine.js",
    "./js/engine/gameState.js",
    "./js/engine/eigenschaftenEngine.js",
    "./js/engine/matchFlowEngine.js",
    "./js/engine/liveMatchDirector.js",
    "./js/engine/matchEngine.js",
    "./js/engine/transferEngine.js",
    "./js/engine/trainingEngine.js",
    "./js/engine/preseasonEngine.js",
    "./js/engine/coachingStaffEngine.js",
    "./js/engine/dressingRoomEngine.js",
    "./js/engine/playerTalkEngine.js",
    "./js/engine/developmentPlanEngine.js",
    "./js/engine/loanEngine.js",
    "./js/engine/reserveEngine.js",
    "./js/engine/nationalTeamEngine.js",
    "./js/engine/wetterEngine.js",
    "./js/engine/trainerProfilEngine.js",
    "./js/engine/rivalryEngine.js",
    "./js/engine/seasonEngine.js",
    "./js/ui/uiManager.js",
    "./js/ui/uiSpielfeld.js",
    "./js/ui/uiVorbereitung.js",
    "./js/ui/uiTransfers.js",
    "./js/ui/uiAkten.js",
    "./js/ui/uiLivespiel.js",
    "./js/ui/uiSpielbericht.js",
    "./js/ui/uiSpeicher.js",
    "./js/ui/uiEinstieg.js",
    "./js/ui/uiNational.js",
    "./js/vendor/three.min.js",
    "./js/ui/spielfeld3d.js",
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
