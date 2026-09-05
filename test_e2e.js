/**
 * Test-Suite 4: End-to-End Karriere-Flow, LiveMatch und Mehr-Saison-Simulation
 */
const { INITIAL_TEAMS_DATA } = require('./js/data/initialData.js');
const { GameState, FORMATION_CONFIGS } = require('./js/engine/gameState.js');
const { MatchEngine, LiveMatch } = require('./js/engine/matchEngine.js');
const { NewsEngine } = require('./js/engine/newsEngine.js');
const { CalendarEngine } = require('./js/engine/calendarEngine.js');
const { OpponentAnalysisEngine } = require('./js/engine/opponentAnalysisEngine.js');
const { TransferEngine } = require('./js/engine/transferEngine.js');
const { TrainingEngine } = require('./js/engine/trainingEngine.js');
const { SeasonEngine } = require('./js/engine/seasonEngine.js');
const { PositionEngine } = require('./js/engine/positionEngine.js');
const { SaveService } = require('./js/services/saveService.js');
const { MigrationService } = require('./js/services/migrationService.js');

function runE2ETests() {
    console.log("\n=======================================================");
    console.log("   [TEST SUITE: E2E & INTEGRATION] test_e2e.js        ");
    console.log("=======================================================");

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ ${name}`);
            console.error(`     Fehler: ${err.message}`);
            failed++;
        }
    }

    // 1. Initialisierung mit verschiedenen Vereinen und Schwierigkeitsgraden
    test("E2E: Karriere-Start mit verschiedenen Vereinen (muc, dor, lev, svw)", () => {
        ['muc', 'dor', 'lev', 'svw'].forEach(clubId => {
            const s = GameState.createNewGame(clubId, 'easy', { name: 'Trainer Max' });
            if (!s.userClubId || s.userClubId !== clubId) throw new Error(`Spielstand für ${clubId} fehlerhaft`);
            const c = s.clubs.find(club => club.id === clubId);
            if (!c || c.lineup.length !== 11) throw new Error(`Club ${clubId} besitzt keine gültige Startelf`);
        });
    });

    const state = GameState.createNewGame('dor', 'normal', { name: 'Trainer Edin' });

    // 2. Testen aller Formationen
    test("E2E: Alle 7 Formationen mit Auto-Aufstellung validieren", () => {
        const testFormations = Object.keys(FORMATION_CONFIGS);
        const dorClub = state.clubs.find(c => c.id === 'dor');
        testFormations.forEach(form => {
            dorClub.formation = form;
            GameState.autoSetLineupForClub(dorClub, state.players);
            if (dorClub.lineup.length !== 11) throw new Error(`Lineup für Formation ${form} fehlgeschlagen!`);
        });
    });

    // 3. Testen der LiveMatch Simulation im Detail
    test("E2E: 2D-LiveMatch mit Ticker, Positionen, Spielerwechsel und Abpfiff", () => {
        const round1 = state.schedule[0];
        const dorMatch = round1.matches.find(m => m.homeClubId === 'dor' || m.awayClubId === 'dor');
        const homeClub = state.clubs.find(c => c.id === dorMatch.homeClubId);
        const awayClub = state.clubs.find(c => c.id === dorMatch.awayClubId);

        const liveMatch = MatchEngine.createLiveMatch(dorMatch, homeClub, awayClub, state.players);
        if (liveMatch.players2D.length !== 22) {
            throw new Error(`LiveMatch players2D Anzahl != 22 (ist ${liveMatch.players2D.length})`);
        }

        // Auswechslung während des Live-Spiels testen
        const dorClub = state.clubs.find(c => c.id === 'dor');
        const isHome = dorMatch.homeClubId === 'dor';
        const starterId = dorClub.lineup[0];
        const benchId = dorClub.bench[0];
        const subResult = liveMatch.substitute(isHome ? 'home' : 'away', starterId, benchId);
        if (!subResult.success) throw new Error("Auswechslung im LiveMatch fehlgeschlagen");

        // LiveMatch bis zum Ende durchtickern
        while (!liveMatch.isFinished) {
            liveMatch.tick();
        }

        if (liveMatch.minute < 90) throw new Error(`LiveMatch vorzeitig beendet bei Minute ${liveMatch.minute}`);
        if (typeof liveMatch.homeScore !== "number" || typeof liveMatch.awayScore !== "number") {
            throw new Error("LiveMatch Endstand ungültig");
        }
    });

    // 4. Testen des Trainings
    test("E2E: Wöchentliches Teamtraining mit Fokus und Intensität", () => {
        const dorClub = state.clubs.find(c => c.id === 'dor');
        dorClub.trainingFocus = "attack";
        state.trainingSettings.focus = "attack";
        state.trainingSettings.intensity = "high";
        TrainingEngine.processWeeklyTraining(state);
    });

    // 5. Testen von Transferverhandlungen & Kauf
    test("E2E: Transfermarkt-Angebot, Vertragsverhandlung und Transfervollzug", () => {
        const dorClub = state.clubs.find(c => c.id === 'dor');
        const sellerPlayer = state.players.find(p => p.clubId === 'muc' && p.overall > 80);
        const askPrice = TransferEngine.calculateAskingPrice(sellerPlayer, state.clubs.find(c => c.id === 'muc'));
        const evalOffer = TransferEngine.evaluateTransferOffer(state, sellerPlayer.id, 'dor', askPrice);
        if (!evalOffer.accepted) throw new Error("Transferangebot zum Marktwert wurde unerwartet abgelehnt");

        const contractEval = TransferEngine.negotiateContract(sellerPlayer, dorClub, Math.round(sellerPlayer.wage * 1.35), 4, 'Schlüsselspieler');
        if (!contractEval.success) throw new Error("Vertragsangebot wurde abgelehnt: " + contractEval.message);

        const transferSuccess = TransferEngine.executeTransfer(state, sellerPlayer.id, 'dor', askPrice, Math.round(sellerPlayer.wage * 1.35), 4);
        if (!transferSuccess) throw new Error("Transferdurchführung fehlgeschlagen");
        if (sellerPlayer.clubId !== 'dor') throw new Error("Spieler nach Transfer nicht bei BVB");
    });

    // 6. Testen des Postfachs und Kalender-Tagesablaufs
    test("E2E: Postfach-Workflows, Vorstandsmail als gelesen markieren, Kalendersimulation und Gegneranalyse", () => {
        const testState = GameState.createNewGame('lev', 'normal', { name: 'Trainer Xabi' });
        
        // 1. Willkommens-Mail prüfen & lesen
        const welcomeMsg = testState.inbox.find(m => m.id === "msg_welcome");
        if (!welcomeMsg || welcomeMsg.read !== false) throw new Error("Welcome message unread status invalid");
        
        NewsEngine.markAsRead(testState, "msg_welcome");
        if (welcomeMsg.read !== true) throw new Error("Welcome message was not marked read");
        
        // 2. Kalender-Tagesfortschritt
        const initialDate = testState.currentDate;
        const dayAdv = CalendarEngine.advanceOneDay(testState);
        if (!dayAdv.success || testState.currentDate === initialDate) {
            throw new Error("Calendar advanceOneDay failed");
        }

        // Bis zum Spieltag vorspulen
        const matchdayAdv = CalendarEngine.advanceToNextMatchday(testState);
        if (!matchdayAdv.success) throw new Error("Calendar advanceToNextMatchday failed");

        // 3. Gegneranalyse vor Spielstart
        const round = testState.schedule.find(r => r.matchday === testState.currentMatchday);
        const userMatch = round.matches.find(m => m.homeClubId === 'lev' || m.awayClubId === 'lev');
        const opponentId = userMatch.homeClubId === 'lev' ? userMatch.awayClubId : userMatch.homeClubId;

        const analysisReport = OpponentAnalysisEngine.generateReport(testState, opponentId, 'lev');
        if (!analysisReport || !analysisReport.opponentName || !analysisReport.recommendation) {
            throw new Error("Opponent analysis failed");
        }
    });

    // 7. Volle Saisons durchspielen (2 Saisons)
    test("E2E: Vollständige 2-Saisons-Simulation mit Meisterkürung und neuem Spielplan", () => {
        let seasonsToSim = 2;
        for (let s = 1; s <= seasonsToSim; s++) {
            while (state.currentMatchday < state.totalMatchdays) {
                SeasonEngine.advanceToNextMatchday(state);
            }
            const endSeason = SeasonEngine.advanceToNextMatchday(state);
            if (!endSeason.championClub) throw new Error(`Saison ${s} hat keinen Meister gekürt`);

            // Nächste Saison starten
            SeasonEngine.startNextSeason(state);
            if (state.totalMatchdays !== 34) throw new Error(`Saison ${state.seasonYear} hat keine 34 Spieltage`);
        }
    });

    // 8. Kompletter Ablauf: eigene Formation zeichnen, aufstellen, live spielen, speichern
    test("E2E: Eigene Formation erstellen, live spielen und über den Spielstand behalten", () => {
        const s = GameState.createNewGame("muc", "normal", { name: "Trainer Eigenbau" });
        const club = s.clubs.find(c => c.id === "muc");
        const opponent = s.clubs.find(c => c.id === "dor");

        // Der Manager zieht aus dem 4-2-3-1 ein eigenes 3-4-3
        const draft = FORMATION_CONFIGS["4-2-3-1"].positions.map(p => ({ ...p }));
        draft[1] = { ...draft[1], x: 30, y: 74 };   // Linksverteidiger rückt ein
        draft[4] = { ...draft[4], x: 70, y: 74 };   // Rechtsverteidiger rückt ein
        draft[5] = { ...draft[5], x: 14, y: 46 };   // Sechser wird Schienenspieler links
        draft[7] = { ...draft[7], x: 16, y: 20 };   // Flügel wird Linksaußen
        draft[9] = { ...draft[9], x: 84, y: 20 };   // Flügel wird Rechtsaußen

        const saved = GameState.saveCustomFormation(s, "Dreierkette Offensiv", draft);
        if (!saved.success) throw new Error("Eigene Formation konnte nicht gespeichert werden: " + saved.error);

        club.formation = saved.key;
        GameState.autoSetLineupForClub(club, s.players);

        const positions = FORMATION_CONFIGS[saved.key].positions;
        if (positions.length !== 11) throw new Error("Eigene Formation hat nicht 11 Positionen");

        // Die Elf ist positionsbewusst besetzt
        const lineupPlayers = club.lineup.map(id => s.players.find(p => p.id === id));
        if (lineupPlayers.some(p => !p)) throw new Error("Aufstellung enthält unbekannte Spieler");
        if (new Set(club.lineup).size !== 11) throw new Error("Aufstellung enthält doppelte Spieler");
        if (PositionEngine.normalizePosition(lineupPlayers[0].pos) !== "TW") {
            throw new Error(`Auf der Torwartposition steht ein ${lineupPlayers[0].pos}`);
        }

        const avgFit = lineupPlayers.reduce((sum, p, i) => sum + PositionEngine.getFamiliarity(p, positions[i].pos), 0) / 11;
        if (avgFit < 0.85) throw new Error(`Aufstellung passt im Mittel nur zu ${(avgFit * 100).toFixed(0)} % zur Formation`);

        // Live-Spiel mit der eigenen Formation in Echtzeit durchspielen
        const round = s.schedule[0];
        const userMatch = round.matches.find(m => m.homeClubId === "muc" || m.awayClubId === "muc");
        const home = s.clubs.find(c => c.id === userMatch.homeClubId);
        const away = s.clubs.find(c => c.id === userMatch.awayClubId);

        const live = MatchEngine.createLiveMatch(userMatch, home, away, s.players);
        if (live.players2D.length !== 22) throw new Error("Live-Spiel hat nicht 22 Spieler im Feld");

        // Hier geht es um die eigene Formation, nicht um die Taktung: auf der
        // schnellsten Stufe ist die Partie nach gut 170 Sekunden Spielzeit durch.
        live.speed = 4;

        let frames = 0;
        while (!live.isFinished && frames < 60 * 400) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
            frames++;
        }
        if (!live.isFinished) throw new Error("Live-Spiel mit eigener Formation wurde nicht beendet");
        if (userMatch.homeGoals === undefined) throw new Error("Ergebnis wurde nicht auf das Spiel übertragen");

        // Der Spielstand behält die eigene Formation über Export und Import
        const exported = SaveService.exportJson(s);
        const parsed = JSON.parse(exported);
        if (!parsed.state.customFormations || !parsed.state.customFormations[saved.key]) {
            throw new Error("Eigene Formation fehlt im exportierten Spielstand");
        }

        // Nach dem Laden werden eigene Formationen wieder global registriert
        GameState.registerCustomFormations({ customFormations: {} });
        if (FORMATION_CONFIGS[saved.key]) throw new Error("Eigene Formation wurde nicht abgemeldet");

        const migrated = MigrationService.migrateSave(parsed);
        if (!migrated.success) throw new Error("Migration des Spielstands mit eigener Formation fehlgeschlagen");
        GameState.registerCustomFormations(migrated.state);
        if (!FORMATION_CONFIGS[saved.key]) throw new Error("Eigene Formation wurde nach dem Laden nicht registriert");

        // Aufräumen, damit nachfolgende Tests unbeeinflusst bleiben
        GameState.registerCustomFormations({ customFormations: {} });
    });

    console.log(`\n  Ergebnis E2E-Tests: ${passed} bestanden, ${failed} fehlgeschlagen.`);
    if (failed > 0) throw new Error(`${failed} E2E-Tests fehlgeschlagen.`);
    return { passed, failed };
}

if (require.main === module) {
    runE2ETests();
}

module.exports = { runE2ETests };
