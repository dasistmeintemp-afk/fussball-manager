/**
 * Service Worker für Offline-Unterstützung und PWA-Installation
 */

const CACHE_NAME = "fm-pro-cache-v212";
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
    "./js/engine/namenEngine.js",
    "./js/services/migrationService.js",
    "./js/services/saveCodec.js",
    "./js/services/kompressor.js",
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
    "./js/engine/statistikEngine.js",
    "./js/engine/auszeichnungEngine.js",
    "./js/engine/jahrespreisEngine.js",
    "./js/engine/chronikEngine.js",
    "./js/engine/trainerwechselEngine.js",
    "./js/engine/ligaNachrichtenEngine.js",
    "./js/engine/spielvorschauEngine.js",
    "./js/engine/partnerEngine.js",
    "./js/engine/investorEngine.js",
    "./js/engine/ehemaligeEngine.js",
    "./js/engine/visionEngine.js",
    "./js/engine/kaderplanungEngine.js",
    "./js/engine/kaderregelEngine.js",
    "./js/engine/arbeitserlaubnisEngine.js",
    "./js/engine/koeffizientEngine.js",
    "./js/engine/turnierEngine.js",
    "./js/engine/finanzregelEngine.js",
    "./js/engine/klauselEngine.js",
    "./js/engine/careerEngine.js",
    "./js/engine/calendarEngine.js",
    "./js/engine/opponentAnalysisEngine.js",
    "./js/engine/matchplanEngine.js",
    "./js/engine/gegneranweisungEngine.js",
    "./js/engine/datenzentraleEngine.js",
    "./js/engine/jobmarktEngine.js",
    "./js/engine/laufbahnEngine.js",
    "./js/engine/urlaubEngine.js",
    "./js/engine/supercupEngine.js",
    "./js/engine/euroSupercupEngine.js",
    "./js/engine/konferenzEngine.js",
    "./js/engine/fanEngine.js",
    "./js/engine/meilensteinEngine.js",
    "./js/engine/medienEngine.js",
    "./js/engine/jugendligaEngine.js",
    "./js/engine/atmosphaereEngine.js",
    "./js/engine/gameState.js",
    "./js/engine/eigenschaftenEngine.js",
    "./js/engine/ballPhysik.js",
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
    "./js/engine/spielWerk.js",
    "./js/ui/klang.js",
    "./js/ui/uiManager.js",
    "./js/ui/uiSpielfeld.js",
    "./js/ui/uiVorbereitung.js",
    "./js/ui/uiAssistent.js",
    "./js/ui/uiKader.js",
    "./js/ui/uiTaktik.js",
    "./js/ui/uiWettbewerbe.js",
    "./js/ui/uiWettbewerbSeite.js",
    "./js/ui/uiTraining.js",
    "./js/ui/uiFinanzen.js",
    "./js/ui/uiVerein.js",
    "./js/ui/uiPostfach.js",
    "./js/ui/uiDialoge.js",
    "./js/ui/uiKarriere.js",
    "./js/ui/uiTransfers.js",
    "./js/ui/uiAkten.js",
    "./js/ui/uiSeiten.js",
    "./js/ui/uiProfil.js",
    "./js/ui/uiProfilLaufbahn.js",
    "./js/ui/uiAngebot.js",
    "./js/ui/uiVereinSeite.js",
    "./js/ui/uiSpielerdatenbank.js",
    "./js/ui/uiLivespiel.js",
    "./js/ui/uiLiveKacheln.js",
    "./js/ui/uiLiveDarstellung.js",
    "./js/ui/uiSpielbericht.js",
    "./js/ui/uiMeldungen.js",
    "./js/ui/uiKopfmenue.js",
    "./js/ui/uiFarben.js",
    "./js/ui/uiPortal.js",
    "./js/ui/uiWettbewerbUebersicht.js",
    "./js/ui/uiDaten.js",
    "./js/ui/uiSpeicher.js",
    "./js/ui/uiEinstieg.js",
    "./js/ui/uiNational.js",
    "./js/ui/uiNavigation.js",
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
