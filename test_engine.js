/**
 * Test-Suite 3: Subsystem- und Engine-Tests
 */
const { INITIAL_TEAMS_DATA } = require('./js/data/initialData.js');
const { COUNTRIES_DATA, LEAGUES_DATA, COMPETITIONS_DATA } = require('./js/data/leagueData.js');
const { StateValidator } = require('./js/core/validators.js');
const { SaveService } = require('./js/services/saveService.js');
const { MigrationService } = require('./js/services/migrationService.js');
const { NewsEngine } = require('./js/engine/newsEngine.js');
const { BoardEngine } = require('./js/engine/boardEngine.js');
const { FinanceEngine } = require('./js/engine/financeEngine.js');
const { ContractEngine } = require('./js/engine/contractEngine.js');
const { ScoutingEngine } = require('./js/engine/scoutingEngine.js');
const { YouthEngine } = require('./js/engine/youthEngine.js');
const { AIManagerEngine } = require('./js/engine/aiManagerEngine.js');
const { ClubGenerator } = require('./js/engine/clubGenerator.js');
const { PlayerGenerator } = require('./js/engine/playerGenerator.js');
const { CompetitionEngine } = require('./js/engine/competitionEngine.js');
const { PlayerRatingEngine } = require('./js/engine/playerRatingEngine.js');
const { CalendarEngine } = require('./js/engine/calendarEngine.js');
const { OpponentAnalysisEngine } = require('./js/engine/opponentAnalysisEngine.js');
const { PositionEngine } = require('./js/engine/positionEngine.js');
const { MatchFlowEngine } = require('./js/engine/matchFlowEngine.js');
const { GameState, FORMATION_CONFIGS } = require('./js/engine/gameState.js');
const { MatchEngine, LiveMatch } = require('./js/engine/matchEngine.js');
const { TransferEngine } = require('./js/engine/transferEngine.js');
const { TrainingEngine } = require('./js/engine/trainingEngine.js');
const { SeasonEngine } = require('./js/engine/seasonEngine.js');
const { WorldGenerator } = require('./js/engine/worldGenerator.js');
const { SaveCodec } = require('./js/services/saveCodec.js');

function runEngineTests() {
    console.log("\n=======================================================");
    console.log("   [TEST SUITE: GAME ENGINES] test_engine.js          ");
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

    // 1. Initialisierung & StateValidator
    test("GameState & StateValidator: Spielstand, Spielplan und Startelf validieren", () => {
        const state = GameState.createNewGame("muc", "normal", {
            name: "Trainer Hans",
            nationality: "Deutschland",
            birthdate: "1980-01-01"
        });

        const valState = StateValidator.validateState(state);
        if (!valState.valid) throw new Error("State validation failed: " + valState.error);

        const valSched = StateValidator.validateSchedule(state);
        if (!valSched.valid) throw new Error("Schedule validation failed: " + valSched.error);

        const userClub = state.clubs.find(c => c.id === "muc");
        const valLineup = StateValidator.validateLineup(state, userClub.id);
        if (!valLineup.valid) throw new Error("Lineup validation failed: " + valLineup.error);
    });

    // 2. ClubGenerator & PlayerGenerator (Amateure & Ligapyramide)
    test("ClubGenerator & PlayerGenerator: Vereine und Spieler über Ligastufen (Level 1-7) generieren", () => {
        const genClub = ClubGenerator.generateClub({ countryId: "de", leagueId: "de_ll_1", level: 7, region: "Bayern" });
        if (!genClub.id || !genClub.name || !genClub.stadium || genClub.tier !== "amateur") {
            throw new Error("ClubGenerator for level 7 invalid");
        }
        if (!genClub.reputation || genClub.reputation > 25) {
            throw new Error(`Landesligist hat unrealistischen Ruf: ${genClub.reputation}`);
        }

        const genSquad = PlayerGenerator.generateSquad(genClub.id, 7, 22);
        if (genSquad.length !== 22) throw new Error("PlayerGenerator squad size != 22");

        const hasGk = genSquad.some(p => p.pos === "TW");
        if (!hasGk) throw new Error("Generated squad has no goalkeeper");

        const youthP = PlayerGenerator.generateYouthPlayer(genClub.id, 2, 7);
        if (!youthP.name || youthP.age < 15 || youthP.age > 18) {
            throw new Error("Generated youth player invalid");
        }
    });

    // 3. CompetitionEngine & Multi-League Daten
    test("CompetitionEngine: Spielpläne, Pokalrunden, Europapokal-Gruppen und Qualifikation", () => {
        const testClubIds = ["c1", "c2", "c3", "c4", "c5", "c6"];
        const sched = CompetitionEngine.generateRoundRobinSchedule(testClubIds, "test_league");
        if (sched.length !== 10) throw new Error("Round-robin schedule rounds count expected 10, got " + sched.length);

        const cupRound = CompetitionEngine.generateCupRound(testClubIds, "Achtelfinale", "de_cup", 1);
        if (cupRound.matches.length !== 3) throw new Error("Cup matches count expected 3, got " + cupRound.matches.length);

        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const euroComps = CompetitionEngine.generateEuropeanCompetitions(state.clubs);
        if (!euroComps.ucl || !euroComps.uel || !euroComps.uecl) {
            throw new Error("European competitions structure missing");
        }

        const qual = CompetitionEngine.qualifyEuropeanTeams(state);
        if (qual.championsLeague.length !== 4 || qual.europaLeague.length !== 2) {
            throw new Error("European qualification calculation incorrect");
        }
    });

    // 4. MatchEngine Timeline-Generierung & 2D-Synchronität
    test("MatchEngine & LiveMatch: 100% synchrone Event-Timeline für Sofortsimulation und 2D-Match", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "m_test_sync", played: false, homeClubId: "muc", awayClubId: "dor" };

        const timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);
        if (!Array.isArray(timeline) || timeline.length === 0) {
            throw new Error("MatchEngine.generateTimeline returned empty timeline");
        }

        const firstEv = timeline[0];
        if (firstEv.minute === undefined || !firstEv.type || !firstEv.text || !firstEv.start || !firstEv.end) {
            throw new Error("Timeline event is missing required attributes (minute, type, text, start, end)");
        }

        // LiveMatch mit derselben Timeline ablaufen lassen & Geschwindigkeiten testen
        match.timeline = timeline;
        const liveMatch = new LiveMatch(match, homeClub, awayClub, state.players);

        // 2D Formationen & Torwartpositionen testen
        const homeGk = liveMatch.players2D.find(p => p.team === "home" && p.pos === "TW");
        const awayGk = liveMatch.players2D.find(p => p.team === "away" && p.pos === "TW");
        const homeSt = liveMatch.players2D.find(p => p.team === "home" && (p.pos === "ST" || p.pos === "LA" || p.pos === "RA"));
        const awaySt = liveMatch.players2D.find(p => p.team === "away" && (p.pos === "ST" || p.pos === "LA" || p.pos === "RA"));

        if (!homeGk || !awayGk || homeGk.baseX > 15 || awayGk.baseX < 85) {
            throw new Error(`Torwart-Positionen im 2D-Feld fehlerhaft: Heim-TW=${homeGk?.baseX}, Auswärts-TW=${awayGk?.baseX}`);
        }

        if (homeSt && homeSt.baseX <= homeGk.baseX) {
            throw new Error(`Heim-Stürmer (${homeSt.baseX}) steht hinter dem Torwart (${homeGk.baseX})`);
        }
        if (awaySt && awaySt.baseX >= awayGk.baseX) {
            throw new Error(`Auswärts-Stürmer (${awaySt.baseX}) steht hinter dem Torwart (${awayGk.baseX})`);
        }

        // Teste dynamisches Aufrücken über das Spielfeld
        liveMatch.ball.x = 80;
        liveMatch.ball.y = 50;
        liveMatch.ball.targetX = 80;
        liveMatch.ball.targetY = 50;
        for (let t = 0; t < 30; t++) liveMatch.updateBallAndPlayers();

        if (homeSt && homeSt.x < 50) {
            throw new Error(`Heim-Stürmer rückt bei Ball im gegnerischen Drittel nicht auf: x=${homeSt.x}`);
        }
        
        liveMatch.speed = 1;
        const slowInterval = liveMatch.getTickIntervalMs();
        liveMatch.speed = 2;
        const normalInterval = liveMatch.getTickIntervalMs();
        liveMatch.speed = 4;
        const fastInterval = liveMatch.getTickIntervalMs();

        if (slowInterval <= normalInterval || normalInterval <= fastInterval) {
            throw new Error(`LiveMatch speed intervals invalid: slow=${slowInterval}, normal=${normalInterval}, fast=${fastInterval}`);
        }

        // Simuliere schrittweise Ticks mit kontrolliertem Fortschritt
        liveMatch.speed = 1;
        while (!liveMatch.isFinished && liveMatch.minute < 45) {
            liveMatch.tick();
        }

        // Sofortmodus testen
        liveMatch.skipToEnd();

        if (!liveMatch.isFinished) {
            throw new Error("LiveMatch did not finish after skipToEnd");
        }

        if (match.homeGoals !== liveMatch.homeScore || match.awayGoals !== liveMatch.awayScore) {
            throw new Error(`LiveMatch scores (${liveMatch.homeScore}:${liveMatch.awayScore}) do not match match object (${match.homeGoals}:${match.awayGoals})`);
        }

        if (!match.summaryText || !match.stats || !Array.isArray(match.events)) {
            throw new Error("Match summary or stats missing after timeline application");
        }
    });

    // 5. NewsEngine
    test("NewsEngine: Nachrichten hinzufügen, ungelesene zählen, normalisieren und als gelesen markieren", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        
        const welcome = state.inbox.find(m => m.id === "msg_welcome");
        if (!welcome || welcome.read !== false || !welcome.subject || !welcome.body) {
            throw new Error("Initiale Vorstandsmail fehlt oder ist ungültig");
        }

        NewsEngine.markAsRead(state, "msg_welcome");
        if (welcome.read !== true) throw new Error("Welcome mail was not marked as read");

        NewsEngine.addMessage(state, "board_message", {
            subject: "Saisonziel festgelegt",
            body: "Der Vorstand erwartet das Erreichen der Meisterschaft.",
            priority: "high"
        });

        const unreadCount = NewsEngine.getUnreadCount(state);
        if (unreadCount === 0) throw new Error("NewsEngine unread count is 0");
        
        const boardFiltered = NewsEngine.getFilteredMessages(state, "board");
        if (boardFiltered.length === 0) throw new Error("Filtered board messages empty");

        NewsEngine.markAllAsRead(state);
        if (NewsEngine.getUnreadCount(state) !== 0) throw new Error("NewsEngine markAllAsRead failed");
    });

    // 6. BoardEngine
    test("BoardEngine: Vorstandszufriedenheit und Entlassungsrisiko berechnen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const confUpdate = BoardEngine.updateConfidence(state);
        if (typeof confUpdate.confidence !== "number" || isNaN(confUpdate.confidence)) {
            throw new Error("BoardEngine confidence invalid");
        }
    });

    // 7. FinanceEngine
    test("FinanceEngine: Ticketeinnahmen bei Heimspielen und wöchentliche Kosten buchen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const round1 = state.schedule[0];
        const userMatch = round1.matches.find(m => m.homeClubId === "muc" || m.awayClubId === "muc");
        const ticketIncome = FinanceEngine.applyMatchdayIncome(state, userMatch);
        if (userMatch.homeClubId === "muc" && ticketIncome <= 0) throw new Error("Ticket income not applied");
        FinanceEngine.applyWeeklyCosts(state);
        const finSummary = FinanceEngine.getFinanceSummary(state, "muc");
        if (!finSummary || !Array.isArray(finSummary.transactions)) throw new Error("Finance summary failed");
    });

    // 8. ContractEngine
    test("ContractEngine: Gehaltsforderungen ermitteln und Vertrag verlängern", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const userClub = state.clubs.find(c => c.id === "muc");
        const testPlayer = state.players.find(p => p.clubId === "muc");
        const demand = ContractEngine.getExtensionDemand(testPlayer, userClub);
        const extRes = ContractEngine.negotiateExtension(testPlayer, userClub, demand.demandWage, 4, "Schlüsselspieler");
        if (!extRes.success) throw new Error("Contract extension failed: " + extRes.reason);
    });

    // 9. ScoutingEngine & PlayerRatingEngine
    test("ScoutingEngine & PlayerRatingEngine: FM-Rating-Modell, Schätzspannen, relative Sterne, Rollen und Scoutberichte", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        
        // 1. PlayerRatingEngine Tests
        const ca80 = PlayerRatingEngine.overallToAbility(80);
        if (ca80 !== 160) throw new Error("overallToAbility(80) expected 160, got " + ca80);
        const ovr160 = PlayerRatingEngine.abilityToOverall(160);
        if (ovr160 !== 80) throw new Error("abilityToOverall(160) expected 80, got " + ovr160);

        // Sternebewertung relativ zum Verein
        const starsHigh = PlayerRatingEngine.calculateStarRating(170, { squadAverageAbility: 130 });
        const starsLow = PlayerRatingEngine.calculateStarRating(170, { squadAverageAbility: 180 });
        if (starsHigh <= starsLow) throw new Error("Relative star rating calculation incorrect");

        // Positionsgewichtung & Rollen
        const striker = state.players.find(p => p.pos === "ST");
        const posRating = PlayerRatingEngine.calculatePositionWeightedRating(striker, "ST");
        if (typeof posRating !== "number" || posRating <= 0) throw new Error("calculatePositionWeightedRating failed");

        const roleRes = PlayerRatingEngine.calculateRoleRating(striker, "Stoßstürmer", { squadAverageAbility: 140 });
        if (!roleRes || !roleRes.stars || !roleRes.starsHtml) throw new Error("calculateRoleRating failed");

        const bestRoles = PlayerRatingEngine.getBestRolesForPlayer(striker, { squadAverageAbility: 140 });
        if (!bestRoles.best || !bestRoles.best.role) throw new Error("getBestRolesForPlayer failed");

        // Hidden Traits
        const traits = PlayerRatingEngine.getHiddenTraitDescriptions(striker, { knowledgeLevel: 80 });
        if (!Array.isArray(traits)) throw new Error("getHiddenTraitDescriptions must return an array");

        // Visible Player Card
        const testTarget = state.players.find(p => p.clubId !== "muc");
        const cardUnknown = PlayerRatingEngine.calculateVisiblePlayerCard(testTarget, { userClubId: "muc" });
        if (typeof cardUnknown.visibleOvr !== "string" || !cardUnknown.visibleOvr.includes("-")) {
            throw new Error("Unknown player should have an estimated OVR range");
        }
        if (!cardUnknown.bestRole || !cardUnknown.starsCaHtml) {
            throw new Error("Player card missing bestRole or starsCaHtml");
        }

        // 2. Gezieltes Scouten eines Spielers (Gegner / Transfermarkt)
        const scoutTargetRes = ScoutingEngine.scoutPlayer(state, testTarget.id, { source: "opponent_analysis", notify: true });
        if (!scoutTargetRes.success || scoutTargetRes.knowledgeLevel < 50) {
            throw new Error("scoutPlayer failed to increase knowledge");
        }
        if (!scoutTargetRes.report || !scoutTargetRes.report.starsCa) {
            throw new Error("scoutPlayer report missing starsCa");
        }

        // 3. ScoutingEngine Assignment & Report
        const scoutRes = ScoutingEngine.startAssignment(state, { position: "ST", maxAge: 24, minOverall: 75 });
        if (!scoutRes.success) throw new Error("Scouting assignment failed: " + scoutRes.error);
        ScoutingEngine.processWeeklyScouting(state);
        ScoutingEngine.processWeeklyScouting(state);
        if (state.scouting.reports.length === 0) throw new Error("Scouting reports empty after completion");

        const rep = state.scouting.reports[0];
        if (!rep || !rep.estimatedOverall || !rep.recommendation || !Array.isArray(rep.strengths)) {
            throw new Error("Scouting report structure invalid");
        }
    });

    // 10. YouthEngine
    test("YouthEngine: Jugendtalente fördern, befördern und Akademie ausbauen", () => {
        const state = GameState.createNewGame("svw", "normal", { name: "Trainer" });
        const prospect = state.youthAcademy.prospects[0];
        const promoteRes = YouthEngine.promoteProspect(state, "svw", prospect.id);
        if (!promoteRes.success) throw new Error("Youth prospect promotion failed: " + promoteRes.error);
        const upgradeRes = YouthEngine.upgradeAcademy(state, "svw");
        if (!upgradeRes.success) throw new Error("Youth academy upgrade failed: " + upgradeRes.error);
    });

    // 11. AIManagerEngine
    test("AIManagerEngine: Automatische Aufstellungen für alle KI-Vereine setzen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        AIManagerEngine.updateAllAiClubsBeforeMatchday(state);
        const dorClub = state.clubs.find(c => c.id === "dor");
        if (dorClub.lineup.length !== 11) throw new Error("AI Manager lineup length != 11");
    });

    // 12. SaveService & MigrationService
    test("SaveService & MigrationService: Export, Import und Schema-Migration von v1 nach v6", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const exportedJson = SaveService.exportJson(state);
        const importRes = SaveService.importJson(exportedJson);
        if (!importRes.success) throw new Error("SaveService import failed: " + importRes.error);

        const legacySave = {
            saveVersion: 1,
            state: {
                userClubId: "muc",
                clubs: state.clubs,
                players: state.players,
                schedule: state.schedule,
                standings: state.standings
            }
        };
        const migRes = MigrationService.migrateSave(legacySave);
        if (!migRes.success || migRes.saveVersion !== 6 || !migRes.state.scouting || !migRes.state.calendar || !migRes.state.competitions || !migRes.state.customFormations) {
            throw new Error("MigrationService failed to migrate to version 6");
        }
    });

    // 13. CalendarEngine & OpponentAnalysisEngine
    test("CalendarEngine & OpponentAnalysisEngine: Tagesfortschritt, Wochenplan und Gegneranalyse", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        
        if (!Array.isArray(state.calendar) || state.calendar.length === 0) {
            throw new Error("Calendar was not generated in GameState");
        }

        const upcoming = CalendarEngine.getUpcomingDays(state, 7);
        if (upcoming.length !== 7) throw new Error("getUpcomingDays(7) did not return 7 days");

        const curDateBefore = state.currentDate;
        const advRes = CalendarEngine.advanceOneDay(state);
        if (!advRes.success || state.currentDate === curDateBefore) {
            throw new Error("Calendar advanceOneDay failed");
        }

        const oppReport = OpponentAnalysisEngine.generateReport(state, "dor", "muc");
        if (!oppReport || oppReport.opponentClubId !== "dor" || !Array.isArray(oppReport.strengths) || !oppReport.recommendation) {
            throw new Error("OpponentAnalysisEngine generateReport invalid");
        }
        if (!Array.isArray(oppReport.keyPlayers) || oppReport.keyPlayers.length === 0 || !oppReport.keyPlayers[0].starsCaHtml) {
            throw new Error("OpponentAnalysisEngine keyPlayers missing star ratings");
        }
    });

    // 14. Volle Saison bis zum Ende simulieren
    test("SeasonEngine: Komplette Saison simulieren, Meister küren und neue Saison vorbereiten", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        while (state.currentMatchday < state.totalMatchdays) {
            SeasonEngine.advanceToNextMatchday(state);
        }
        const endSeason = SeasonEngine.advanceToNextMatchday(state);
        if (!endSeason.championClub) throw new Error("No champion club determined");

        SeasonEngine.startNextSeason(state);
        if (state.seasonYear !== 2 || state.currentMatchday !== 1) {
            throw new Error("Next season start failed");
        }
    });

    // 15. Kalibrierungstest über 500 Spiele
    test("MatchEngine Kalibrierung: 500 Spiele Liga-Mittelwerte (Tore, Schüsse, Gelb/Rot, Elfmeter, Ballbesitz)", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        // Liga-Mittelwerte nur über die eigene Liga - die Welt enthält
        // inzwischen auch Amateurvereine bis hinunter zur Landesliga
        const clubs = state.clubs.filter(c => c.leagueId === "de_liga_1");
        const players = state.players;

        if (clubs.length < 10) throw new Error("Liga-Vereine fehlen für die Kalibrierung");

        let totalGoals = 0;
        let totalShots = 0;
        let totalYellows = 0;
        let totalReds = 0;
        let totalPenalties = 0;
        const totalMatches = 500;

        for (let i = 0; i < totalMatches; i++) {
            const homeIdx = i % clubs.length;
            const awayIdx = (i + 1 + Math.floor(i / clubs.length)) % clubs.length;
            const home = clubs[homeIdx];
            const away = clubs[awayIdx];

            const match = { id: `m_calib_${i}`, played: false, homeClubId: home.id, awayClubId: away.id };
            MatchEngine.simulateFullMatch(match, home, away, players);

            // Ballbesitz Summe prüfen
            if (match.stats.possession[0] + match.stats.possession[1] !== 100) {
                throw new Error(`Ballbesitz-Summe != 100: ${match.stats.possession[0]} + ${match.stats.possession[1]}`);
            }

            totalGoals += (match.homeGoals + match.awayGoals);
            totalShots += (match.stats.shots[0] + match.stats.shots[1]);
            totalYellows += (match.stats.yellowCards[0] + match.stats.yellowCards[1]);
            totalReds += (match.stats.redCards[0] + match.stats.redCards[1]);

            // Elfmeter zählen aus Timeline
            const pens = match.events.filter(e => e.type === "goal" && e.text && e.text.includes("Elfmeter") || e.type === "save" && e.text && e.text.includes("Elfmeter"));
            totalPenalties += pens.length;

            // Die Timeline wird nach der Auswertung verworfen - sie belegte
            // rund 22 KB je Partie im Spielstand
            if (match.timeline) {
                throw new Error("Gespieltes Match trägt die Timeline weiterhin mit sich!");
            }

            // Idempotenz testen
            const goalsBefore = match.homeGoals;
            MatchEngine.applyTimelineToMatch(match, [], home, away, players);
            if (match.homeGoals !== goalsBefore) {
                throw new Error("applyTimelineToMatch ist nicht idempotent!");
            }
        }

        const avgGoals = totalGoals / totalMatches;
        const avgShotsPerTeam = totalShots / (totalMatches * 2);
        const avgYellows = totalYellows / totalMatches;
        const avgReds = totalReds / totalMatches;
        const avgPenalties = totalPenalties / totalMatches;

        if (avgGoals < 2.2 || avgGoals > 3.4) {
            throw new Error(`Tore/Spiel außerhalb des Bereichs [2.2, 3.4]: ${avgGoals.toFixed(2)}`);
        }
        if (avgShotsPerTeam < 8 || avgShotsPerTeam > 18) {
            throw new Error(`Schüsse/Team außerhalb des Bereichs [8, 18]: ${avgShotsPerTeam.toFixed(2)}`);
        }
        if (avgYellows < 2.5 || avgYellows > 6.0) {
            throw new Error(`Gelbe Karten/Spiel außerhalb des Bereichs [2.5, 6.0]: ${avgYellows.toFixed(2)}`);
        }
        if (avgReds >= 0.25) {
            throw new Error(`Rote Karten/Spiel >= 0.25: ${avgReds.toFixed(2)}`);
        }
        if (avgPenalties >= 0.50) {
            throw new Error(`Elfmeter/Spiel >= 0.50: ${avgPenalties.toFixed(2)}`);
        }
    });

    // 16. Wirksamkeitstest: Taktiken (very_defensive vs very_offensive)
    test("MatchEngine Wirksamkeit: very_defensive vs. very_offensive (je 200 Durchläufe)", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = JSON.parse(JSON.stringify(state.clubs.find(c => c.id === "muc")));
        const awayClub = JSON.parse(JSON.stringify(state.clubs.find(c => c.id === "dor")));
        const players = state.players;

        const runs = 200;
        let defGoalsFor = 0, defGoalsAgainst = 0;
        let offGoalsFor = 0, offGoalsAgainst = 0;

        // Defensive Taktik
        homeClub.tactics = { mentality: "very_defensive", pressing: "low", tempo: "slow" };
        awayClub.tactics = { mentality: "balanced", pressing: "medium", tempo: "normal" };

        for (let i = 0; i < runs; i++) {
            const mDef = { id: `m_tact_def_${i}`, played: false, homeClubId: homeClub.id, awayClubId: awayClub.id };
            MatchEngine.simulateFullMatch(mDef, homeClub, awayClub, players);
            defGoalsFor += mDef.homeGoals;
            defGoalsAgainst += mDef.awayGoals;
        }

        // Offensive Taktik
        homeClub.tactics = { mentality: "very_offensive", pressing: "high", tempo: "fast" };
        awayClub.tactics = { mentality: "balanced", pressing: "medium", tempo: "normal" };

        for (let i = 0; i < runs; i++) {
            const mOff = { id: `m_tact_off_${i}`, played: false, homeClubId: homeClub.id, awayClubId: awayClub.id };
            MatchEngine.simulateFullMatch(mOff, homeClub, awayClub, players);
            offGoalsFor += mOff.homeGoals;
            offGoalsAgainst += mOff.awayGoals;
        }

        const avgDefGoalsFor = defGoalsFor / runs;
        const avgOffGoalsFor = offGoalsFor / runs;
        const avgDefGoalsAgainst = defGoalsAgainst / runs;
        const avgOffGoalsAgainst = offGoalsAgainst / runs;

        if (avgOffGoalsFor <= avgDefGoalsFor) {
            throw new Error(`Offensive erzielte nicht mehr Tore als Defensive: Off=${avgOffGoalsFor.toFixed(2)}, Def=${avgDefGoalsFor.toFixed(2)}`);
        }
        if (avgOffGoalsAgainst <= avgDefGoalsAgainst) {
            throw new Error(`Offensive kassierte nicht mehr Gegentore als Defensive: Off=${avgOffGoalsAgainst.toFixed(2)}, Def=${avgDefGoalsAgainst.toFixed(2)}`);
        }
    });

    // 17. Finanz-Integritätstest (C3 & C4)
    test("FinanceEngine & SeasonEngine: Buchungsjournal-Integrität nach Spieltagssimulation", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const userClub = state.clubs.find(c => c.id === "muc");
        const initialBalance = userClub.balance;

        SeasonEngine.advanceToNextMatchday(state);

        const userTxns = (state.finances?.transactions || []).filter(t => t.clubId === "muc");
        if (userTxns.length === 0) {
            throw new Error("Transaktionsjournal ist nach Spieltagssimulation leer!");
        }

        const txSum = userTxns.reduce((sum, t) => sum + t.amount, 0);
        const actualBalanceDiff = userClub.balance - initialBalance;

        if (txSum !== actualBalanceDiff) {
            throw new Error(`Buchungssumme (${txSum}) weicht von tatsächlicher Kontoveränderung (${actualBalanceDiff}) ab!`);
        }
    });

    // 18. Infrastruktur-Wirksamkeitstest: Stufe 5 vs. Stufe 1 Akademie (C2 & C7)
    test("Infrastruktur-Wirksamkeit: Akademie Stufe 5 vs. Stufe 1 Talente", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const clubTop = state.clubs.find(c => c.id === "muc");
        const clubSmall = state.clubs.find(c => c.id === "svw");

        clubTop.facilities.youthCenter = 5;
        clubSmall.facilities.youthCenter = 1;

        let ovrSumTop = 0, potSumTop = 0;
        let ovrSumSmall = 0, potSumSmall = 0;
        const runs = 20;

        for (let r = 0; r < runs; r++) {
            const topProspects = YouthEngine.generateProspects(state, clubTop.id);
            const smallProspects = YouthEngine.generateProspects(state, clubSmall.id);

            topProspects.forEach(p => { ovrSumTop += p.overall; potSumTop += p.pot; });
            smallProspects.forEach(p => { ovrSumSmall += p.overall; potSumSmall += p.pot; });
        }

        const avgPotTop = potSumTop / (runs * 3);
        const avgPotSmall = potSumSmall / (runs * 3);

        if (avgPotTop <= avgPotSmall) {
            throw new Error(`Akademie Stufe 5 generiert im Mittel nicht bessere Talente als Stufe 1: Top=${avgPotTop.toFixed(1)}, Small=${avgPotSmall.toFixed(1)}`);
        }
    });

    // 19. PositionEngine: Positionseignung und Familiarität
    test("PositionEngine: Familiarität, Eignungsstufen und effektive Bewertung", () => {
        const striker = { pos: "ST", overall: 90 };
        const centreBack = { pos: "IV", overall: 80 };
        const keeper = { pos: "TW", overall: 85 };

        // Stammposition ist immer volle Stärke
        const natural = PositionEngine.getSuitability(striker, "ST");
        if (natural.familiarity !== 1 || natural.effectiveOverall !== 90) {
            throw new Error(`Stammposition muss 1.0 / volle Stärke ergeben, war ${natural.familiarity} / ${natural.effectiveOverall}`);
        }
        if (natural.level !== "natural") throw new Error(`Erwartete Stufe "natural", war "${natural.level}"`);

        // Je weiter entfernt, desto schwächer
        const stAsOm = PositionEngine.getSuitability(striker, "OM").effectiveOverall;
        const stAsZm = PositionEngine.getSuitability(striker, "ZM").effectiveOverall;
        const stAsIv = PositionEngine.getSuitability(striker, "IV").effectiveOverall;
        const stAsTw = PositionEngine.getSuitability(striker, "TW").effectiveOverall;

        if (!(90 > stAsOm && stAsOm > stAsZm && stAsZm > stAsIv && stAsIv >= stAsTw)) {
            throw new Error(`Eignung fällt nicht monoton: ST=90, OM=${stAsOm}, ZM=${stAsZm}, IV=${stAsIv}, TW=${stAsTw}`);
        }
        if (stAsIv >= 70) {
            throw new Error(`Stürmer als Innenverteidiger muss deutlich schwächer sein, war ${stAsIv}`);
        }

        // Verwandte Positionen bleiben stark
        const ivAsLv = PositionEngine.getSuitability(centreBack, "LV");
        if (ivAsLv.familiarity < 0.8) {
            throw new Error(`Innenverteidiger auf Linksverteidiger sollte gut geeignet sein, war ${ivAsLv.familiarity}`);
        }

        // Torwart ist ein Sonderfall in beide Richtungen
        if (PositionEngine.getFamiliarity(keeper, "IV") > 0.2) throw new Error("Torwart im Feld darf keine hohe Eignung haben");
        if (PositionEngine.getFamiliarity(centreBack, "TW") > 0.2) throw new Error("Feldspieler im Tor darf keine hohe Eignung haben");

        // Hinterlegte Nebenposition zählt als eingespielt
        const utility = { pos: "RV", secondPos: "DM", overall: 80 };
        if (PositionEngine.getFamiliarity(utility, "DM") < 0.9) {
            throw new Error("Hinterlegte Nebenposition muss als eingespielt gelten");
        }

        // Ranking liefert die Stammposition zuerst
        const ranking = PositionEngine.getPositionRanking(utility);
        if (ranking[0].position !== "RV") throw new Error(`Ranking beginnt nicht mit der Stammposition: ${ranking[0].position}`);
    });

    // 20. PositionEngine: Zonen und Formationserkennung
    test("PositionEngine: Zonenerkennung und automatische Formationsbenennung", () => {
        const cases = [
            [50, 95, "TW"], [50, 76, "IV"], [10, 72, "LV"], [90, 72, "RV"],
            [50, 56, "DM"], [50, 45, "ZM"], [12, 44, "LM"], [88, 44, "RM"],
            [50, 32, "OM"], [12, 20, "LA"], [88, 20, "RA"], [50, 12, "ST"]
        ];
        cases.forEach(([x, y, expected]) => {
            const detected = PositionEngine.detectPositionFromCoords(x, y);
            if (detected !== expected) {
                throw new Error(`Zone (${x}/${y}) sollte ${expected} sein, war ${detected}`);
            }
        });

        // Alle mitgelieferten Formationen müssen korrekt benannt werden
        Object.keys(FORMATION_CONFIGS).forEach(key => {
            if (GameState.isCustomFormation(key)) return;
            const shape = PositionEngine.detectFormationShape(FORMATION_CONFIGS[key].positions);
            if (shape !== key) {
                throw new Error(`Formation ${key} wurde als ${shape} erkannt`);
            }
        });
    });

    // 21. Positionsbewusste Aufstellung und Teamstärke
    test("MatchEngine & PositionEngine: Fehlbesetzungen schwächen die Mannschaft messbar", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        club.formation = "4-4-2";
        GameState.autoSetLineupForClub(club, state.players);

        const slots = FORMATION_CONFIGS["4-4-2"].positions;
        const optimalLineup = club.lineup.map(id => state.players.find(p => p.id === id));

        // Die automatische Aufstellung soll überwiegend natürliche Positionen treffen
        const naturalCount = optimalLineup.filter((p, i) => p && PositionEngine.getFamiliarity(p, slots[i].pos) >= 0.9).length;
        if (naturalCount < 8) {
            throw new Error(`Auto-Aufstellung besetzt nur ${naturalCount} von 11 Positionen passend`);
        }

        const powerOptimal = MatchEngine.calculateTeamPower(club, state.players, false);

        // Aufstellung absichtlich verdrehen (Feldspieler in umgekehrter Reihenfolge)
        const scrambled = [club.lineup[0], ...club.lineup.slice(1).reverse()];
        club.lineup = scrambled;
        const powerScrambled = MatchEngine.calculateTeamPower(club, state.players, false);

        if (!(powerScrambled.total < powerOptimal.total)) {
            throw new Error(`Verdrehte Aufstellung ist nicht schwächer: optimal=${powerOptimal.total.toFixed(1)}, verdreht=${powerScrambled.total.toFixed(1)}`);
        }

        // Ein Feldspieler im Tor muss die Torwartstärke deutlich senken
        const outfield = state.players.find(p => p.clubId === "muc" && p.pos === "ST");
        club.lineup = [outfield.id, ...club.lineup.slice(1)];
        const powerNoKeeper = MatchEngine.calculateTeamPower(club, state.players, false);
        if (!(powerNoKeeper.goalkeeper < powerOptimal.goalkeeper * 0.85)) {
            throw new Error(`Feldspieler im Tor senkt die Torwartstärke zu wenig: ${powerNoKeeper.goalkeeper.toFixed(1)} vs ${powerOptimal.goalkeeper.toFixed(1)}`);
        }
    });

    // 22. Eigene Formationen
    test("GameState: Eigene Formationen speichern, registrieren, validieren und löschen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");

        // Entwurf aus 4-4-2: beide Stürmer auf die Flügel ziehen
        const draft = FORMATION_CONFIGS["4-4-2"].positions.map(s => ({ ...s }));
        draft[9] = { ...draft[9], x: 16, y: 20 };
        draft[10] = { ...draft[10], x: 84, y: 20 };

        const saved = GameState.saveCustomFormation(state, "Flügelzange", draft);
        if (!saved.success) throw new Error("Eigene Formation konnte nicht gespeichert werden: " + saved.error);
        if (!FORMATION_CONFIGS[saved.key]) throw new Error("Eigene Formation wurde nicht global registriert");
        if (!GameState.isCustomFormation(saved.key)) throw new Error("Eigene Formation wird nicht als eigene erkannt");

        const savedPositions = FORMATION_CONFIGS[saved.key].positions;
        if (savedPositions.length !== 11) throw new Error("Gespeicherte Formation hat nicht 11 Positionen");
        if (savedPositions[0].pos !== "TW") throw new Error("Torwart steht nicht an erster Stelle");
        if (savedPositions.filter(p => p.pos === "TW").length !== 1) throw new Error("Formation hat nicht genau einen Torwart");

        // Positionen der gezogenen Slots wurden aus der Zone abgeleitet
        const wide = savedPositions.filter(p => p.pos === "LA" || p.pos === "RA");
        if (wide.length !== 2) throw new Error(`Erwartete zwei Flügelstürmer, gefunden: ${wide.length}`);

        // Reihenfolge-Abbildung erlaubt das Mitsortieren der Aufstellung
        if (!Array.isArray(saved.order) || saved.order.length !== 11) throw new Error("Speichern liefert keine Sortierreihenfolge");
        if (new Set(saved.order).size !== 11) throw new Error("Sortierreihenfolge enthält Duplikate");

        // Mit der eigenen Formation lässt sich aufstellen und simulieren
        club.formation = saved.key;
        GameState.autoSetLineupForClub(club, state.players);
        if (club.lineup.length !== 11) throw new Error("Auto-Aufstellung mit eigener Formation fehlgeschlagen");

        const opponent = state.clubs.find(c => c.id !== "muc");
        const match = { id: "custom_form_match", played: false, homeClubId: club.id, awayClubId: opponent.id };
        MatchEngine.simulateFullMatch(match, club, opponent, state.players);
        if (typeof match.homeGoals !== "number") throw new Error("Simulation mit eigener Formation fehlgeschlagen");

        // Ungültige Formationen werden abgewiesen
        const tooFew = GameState.saveCustomFormation(state, "Zu klein", draft.slice(0, 9));
        if (tooFew.success) throw new Error("Formation mit 9 Positionen wurde fälschlich akzeptiert");

        const twoKeepers = draft.map(s => ({ ...s }));
        twoKeepers[5] = { ...twoKeepers[5], x: 50, y: 95 };
        const dual = GameState.saveCustomFormation(state, "Zwei Torhüter", twoKeepers);
        if (dual.success) throw new Error("Formation mit zwei Torhütern wurde fälschlich akzeptiert");

        const noName = GameState.saveCustomFormation(state, "", draft);
        if (noName.success) throw new Error("Formation ohne Namen wurde fälschlich akzeptiert");

        // Löschen setzt betroffene Vereine zurück
        const deleted = GameState.deleteCustomFormation(state, saved.key);
        if (!deleted.success) throw new Error("Eigene Formation konnte nicht gelöscht werden");
        if (FORMATION_CONFIGS[saved.key]) throw new Error("Gelöschte Formation ist noch registriert");
        if (club.formation !== "4-4-2") throw new Error("Verein wurde nach dem Löschen nicht zurückgesetzt");
    });

    // 23. LiveMatchDirector: Echtzeit-Regie der 2D-Simulation
    test("LiveMatchDirector: flüssige Echtzeit-Simulation mit synchronem Kommentar", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "director_test", played: false, homeClubId: "muc", awayClubId: "dor" };
        match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);

        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        if (!live.director) throw new Error("LiveMatch besitzt keine Regie");

        live.speed = 2;
        const FRAME = 1000 / 60;
        let frames = 0;
        let maxBallStep = 0;
        let maxPlayerStep = 0;
        const commentaries = new Set();
        let prevBall = { x: live.ball.x, y: live.ball.y };
        const prevPlayers = live.players2D.map(p => ({ x: p.x, y: p.y }));

        while (!live.isFinished && frames < 60 * 400) {
            live.advanceRealTime(FRAME);
            live.updateBallAndPlayers(FRAME);
            frames++;

            maxBallStep = Math.max(maxBallStep, Math.hypot(live.ball.x - prevBall.x, live.ball.y - prevBall.y));
            prevBall = { x: live.ball.x, y: live.ball.y };

            live.players2D.forEach((p, i) => {
                maxPlayerStep = Math.max(maxPlayerStep, Math.hypot(p.x - prevPlayers[i].x, p.y - prevPlayers[i].y));
                prevPlayers[i].x = p.x;
                prevPlayers[i].y = p.y;
            });

            commentaries.add(live.lastCommentary);
        }

        if (!live.isFinished) throw new Error(`Spiel wurde in ${frames} Frames nicht beendet (Minute ${live.minute})`);
        if (live.timelineIndex < live.timeline.length) {
            throw new Error(`Nicht alle Ereignisse abgespielt: ${live.timelineIndex}/${live.timeline.length}`);
        }
        if (live.homeScore !== match.homeGoals || live.awayScore !== match.awayGoals) {
            throw new Error(`Endstand weicht ab: ${live.homeScore}:${live.awayScore} vs ${match.homeGoals}:${match.awayGoals}`);
        }

        // Bewegungen müssen weich sein - keine Sprünge über das halbe Feld
        if (maxBallStep > 6) throw new Error(`Ball springt pro Frame um ${maxBallStep.toFixed(1)} Feldeinheiten`);
        if (maxPlayerStep > 1.5) throw new Error(`Spieler springen pro Frame um ${maxPlayerStep.toFixed(2)} Feldeinheiten`);

        // Feld und Spielbericht gehen Hand in Hand: viele verschiedene Meldungen
        if (commentaries.size < 20) throw new Error(`Zu wenige Kommentarwechsel: ${commentaries.size}`);
        if (live.events.length === 0) throw new Error("Ticker blieb leer");
        if (!live.events.every(e => typeof e.seq === "number")) throw new Error("Ticker-Ereignisse besitzen keine laufende Nummer");

        // Alle Spieler bleiben im Feld, Torhüter bei ihrem Tor
        live.players2D.forEach(p => {
            if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) {
                throw new Error(`Spieler ${p.name} steht außerhalb des Feldes (${p.x}/${p.y})`);
            }
        });

        // Die Uhr läuft sekundengenau
        const clock = live.getClockText();
        if (!/^\d{2}:\d{2}$/.test(clock)) throw new Error(`Uhrzeitformat ungültig: ${clock}`);
    });

    // 24. Torwartverhalten und Ballführung in der Regie
    test("LiveMatchDirector: Torhüter bleiben am eigenen Tor, Ballbesitz wechselt", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "director_gk", played: false, homeClubId: "muc", awayClubId: "dor" };
        match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);

        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        const homeGk = live.players2D.find(p => p.team === "home" && p.pos === "TW");
        const awayGk = live.players2D.find(p => p.team === "away" && p.pos === "TW");

        const possessionTeams = new Set();
        let maxHomeGkX = 0;
        let minAwayGkX = 100;

        for (let i = 0; i < 60 * 120 && !live.isFinished; i++) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
            possessionTeams.add(live.director.possessionTeam);
            maxHomeGkX = Math.max(maxHomeGkX, homeGk.x);
            minAwayGkX = Math.min(minAwayGkX, awayGk.x);
        }

        if (maxHomeGkX > 30) throw new Error(`Heim-Torwart verlässt seine Hälfte (x=${maxHomeGkX.toFixed(1)})`);
        if (minAwayGkX < 70) throw new Error(`Auswärts-Torwart verlässt seine Hälfte (x=${minAwayGkX.toFixed(1)})`);
        if (possessionTeams.size < 2) throw new Error("Ballbesitz wechselt nie zwischen den Mannschaften");

        const poss = live.stats.possession;
        if (poss[0] + poss[1] !== 100) throw new Error(`Ballbesitzsumme ist ${poss[0] + poss[1]}`);
    });

    // 25. Scoutwissen bestimmt die Genauigkeit der angezeigten Werte
    test("PlayerRatingEngine: Mehr Scoutwissen liefert engere und genauere Schätzungen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const target = state.players.find(p => p.clubId !== "muc");
        const context = { userClubId: "muc", leagueDataCoverage: 100 };

        const levels = [20, 40, 60, 80];
        let lastCaSpan = Infinity;
        let lastStarSpan = Infinity;
        let lastAttrSpan = Infinity;

        levels.forEach(level => {
            target.scoutingKnowledge = { known: true, knowledgeLevel: level, accuracy: level };
            const card = PlayerRatingEngine.calculateVisiblePlayerCard(target, context);

            // Die geschätzte Spanne muss den wahren Wert immer enthalten
            const trueCa = target.trueCurrentAbility;
            if (trueCa < card.estimatedCa.min || trueCa > card.estimatedCa.max) {
                throw new Error(`Wahre Stärke ${trueCa} liegt bei ${level}% außerhalb der Schätzung ${card.estimatedCa.min}-${card.estimatedCa.max}`);
            }

            // Und mit steigendem Wissen enger werden
            const caSpan = card.estimatedCa.max - card.estimatedCa.min;
            if (caSpan >= lastCaSpan) {
                throw new Error(`Stärke-Spanne wird bei ${level}% nicht enger: ${caSpan} vs. zuvor ${lastCaSpan}`);
            }
            lastCaSpan = caSpan;

            const starSpan = card.starsCaMax - card.starsCaMin;
            if (starSpan > lastStarSpan) {
                throw new Error(`Sterne-Spanne wächst bei ${level}%: ${starSpan} vs. zuvor ${lastStarSpan}`);
            }
            lastStarSpan = starSpan;

            const attr = PlayerRatingEngine.getVisibleAttribute(target, "pace", level);
            const attrSpan = attr.max - attr.min;
            if (attr.known) throw new Error(`Attribut bei ${level}% Wissen fälschlich als gesichert gemeldet`);
            if (attrSpan >= lastAttrSpan) {
                throw new Error(`Attribut-Spanne wird bei ${level}% nicht enger: ${attrSpan} vs. zuvor ${lastAttrSpan}`);
            }
            if (attr.min > target.pace || attr.max < target.pace) {
                throw new Error(`Wahres Tempo ${target.pace} liegt außerhalb der Spanne ${attr.text}`);
            }
            lastAttrSpan = attrSpan;
        });

        // Ab voller Kenntnis exakte Werte statt Spannen
        target.scoutingKnowledge = { known: true, knowledgeLevel: 95, accuracy: 95 };
        const full = PlayerRatingEngine.calculateVisiblePlayerCard(target, context);
        if (!full.isPrecise) throw new Error("Vollständig gescouteter Spieler gilt nicht als gesichert");
        if (full.visibleOvr !== target.overall) {
            throw new Error(`Bei vollem Wissen muss die exakte Stärke erscheinen (${full.visibleOvr} statt ${target.overall})`);
        }
        if (full.starsCaMin !== full.starsCaMax) throw new Error("Bei vollem Wissen darf keine Sterne-Spanne mehr bleiben");
        const exactAttr = PlayerRatingEngine.getVisibleAttribute(target, "pace", 95);
        if (!exactAttr.known || exactAttr.exact !== target.pace) {
            throw new Error(`Attribut bei vollem Wissen nicht exakt: ${exactAttr.text}`);
        }

        // Eigene Spieler sind immer vollständig bekannt
        const ownPlayer = state.players.find(p => p.clubId === "muc");
        const ownCard = PlayerRatingEngine.calculateVisiblePlayerCard(ownPlayer, context);
        if (!ownCard.isPrecise || ownCard.visibleOvr !== ownPlayer.overall) {
            throw new Error("Eigene Spieler müssen mit exakten Werten angezeigt werden");
        }
    });

    // 26. Schätzungen sind stabil und verraten die Wahrheit nicht
    test("PlayerRatingEngine: Schätzungen sind deterministisch und geben die wahren Werte nicht preis", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const context = { userClubId: "muc", leagueDataCoverage: 100 };
        const scouted = state.players.filter(p => p.clubId !== "muc").slice(0, 12);

        let deviationSum = 0;
        scouted.forEach(p => {
            p.scoutingKnowledge = { known: false, knowledgeLevel: 25, accuracy: 25 };

            // Zweimal berechnen muss dasselbe Ergebnis liefern (kein Flackern)
            const a = PlayerRatingEngine.calculateVisiblePlayerCard(p, context);
            const b = PlayerRatingEngine.calculateVisiblePlayerCard(p, context);
            if (a.visibleOvr !== b.visibleOvr || a.starsCaMin !== b.starsCaMin) {
                throw new Error(`Schätzung für ${p.name} ist nicht stabil: ${a.visibleOvr} vs. ${b.visibleOvr}`);
            }

            const attrA = PlayerRatingEngine.getVisibleAttribute(p, "shooting", 25);
            const attrB = PlayerRatingEngine.getVisibleAttribute(p, "shooting", 25);
            if (attrA.text !== attrB.text) {
                throw new Error(`Attributschätzung für ${p.name} ist nicht stabil: ${attrA.text} vs. ${attrB.text}`);
            }

            // Bei wenig Wissen darf keine exakte Zahl erscheinen
            if (String(a.visibleOvr).indexOf("-") === -1) {
                throw new Error(`Unbekannter Spieler ${p.name} zeigt eine exakte Stärke: ${a.visibleOvr}`);
            }

            const estMid = PlayerRatingEngine.abilityToOverall(Math.round((a.estimatedCa.min + a.estimatedCa.max) / 2));
            deviationSum += Math.abs(estMid - p.overall);
        });

        // Die Schätzmitte darf nicht systematisch exakt die Wahrheit treffen -
        // sonst wäre Scouten wertlos
        const avgDeviation = deviationSum / scouted.length;
        if (avgDeviation < 0.5) {
            throw new Error(`Schätzungen treffen die Wahrheit zu genau (mittlere Abweichung ${avgDeviation.toFixed(2)} OVR)`);
        }
        if (avgDeviation > 8) {
            throw new Error(`Schätzungen weichen unrealistisch stark ab (mittlere Abweichung ${avgDeviation.toFixed(2)} OVR)`);
        }

        // Sternebewertung als Spanne darstellbar
        const html = PlayerRatingEngine.renderStarRange(2.5, 4.5);
        if (!html.includes("star-uncertain") || !html.includes("★")) {
            throw new Error("Sterne-Spanne wird nicht als Unsicherheit dargestellt");
        }
    });

    // 27. MatchFlowEngine: Bewertung von Druck, Passwegen und Optionen
    test("MatchFlowEngine: Druck, Passwege und Entscheidungen folgen der Spielsituation", () => {
        const players = [
            { id: 1, team: "home", pos: "ZM", group: "mid", x: 40, y: 50, passing: 80, vision: 80, technique: 80, dribbling: 70, pace: 70 },
            { id: 2, team: "home", pos: "ST", group: "att", x: 70, y: 50, passing: 60, pace: 85 },
            { id: 3, team: "home", pos: "IV", group: "def", x: 20, y: 50, passing: 70 },
            { id: 4, team: "away", pos: "IV", group: "def", x: 55, y: 50, defense: 80, pace: 70 },
            { id: 5, team: "away", pos: "ZM", group: "mid", x: 90, y: 50, defense: 70 }
        ];

        const flow = new MatchFlowEngine({
            getPlayers: () => players,
            getTactics: () => ({ mentality: "balanced", passing: "mixed", tempo: "normal" }),
            attackDir: team => (team === "home" ? 1 : -1),
            ownGoalX: team => (team === "home" ? 4 : 96)
        });

        const carrier = players[0];
        const opponents = players.filter(p => p.team === "away");

        // Druck: ein Gegner direkt daneben erzeugt mehr Druck als einer weit weg
        const free = flow.getPressure({ x: 10, y: 10 }, opponents);
        const marked = flow.getPressure({ x: 56, y: 50 }, opponents);
        if (!(marked > free)) throw new Error(`Druckmodell falsch: eng=${marked.toFixed(2)}, frei=${free.toFixed(2)}`);

        // Passweg: durch einen Gegner hindurch ist riskanter als daneben vorbei
        const blocked = flow.getLaneRisk(carrier, players[1], opponents);
        const open = flow.getLaneRisk(carrier, { x: 40, y: 10 }, opponents);
        if (!(blocked > open)) throw new Error(`Passwegbewertung falsch: verstellt=${blocked.toFixed(2)}, frei=${open.toFixed(2)}`);

        // Freiraum
        if (!(flow.getSpace({ x: 10, y: 10 }, opponents) > flow.getSpace({ x: 56, y: 50 }, opponents))) {
            throw new Error("Freiraumbewertung falsch");
        }

        // Spielphase aus der Ballposition
        if (flow.derivePhase({ x: 15 }, "home") !== "buildup") throw new Error("Phase im eigenen Drittel falsch erkannt");
        if (flow.derivePhase({ x: 85 }, "home") !== "final_third") throw new Error("Phase im letzten Drittel falsch erkannt");
        if (flow.derivePhase({ x: 15 }, "away") !== "final_third") throw new Error("Phase für die Auswärtsmannschaft falsch gespiegelt");

        // Entscheidung liefert eine gültige Aktion
        for (let i = 0; i < 40; i++) {
            const action = flow.decide(carrier);
            if (!action) throw new Error("Flow-Engine liefert keine Entscheidung");
            if (!["pass", "longball", "dribble"].includes(action.type)) {
                throw new Error(`Unbekannter Aktionstyp: ${action.type}`);
            }
            if (!["complete", "intercepted", "loose", "out", "beaten", "tackled"].includes(action.outcome)) {
                throw new Error(`Unbekannter Ausgang: ${action.outcome}`);
            }
            if (action.outcome === "intercepted" && action.interceptor?.team === carrier.team) {
                throw new Error("Ein Mitspieler kann den eigenen Pass nicht abfangen");
            }
        }
    });

    // 28. Taktikregler verändern das Spiel sichtbar
    test("MatchFlowEngine: Passspiel, Angriffsfokus und Mentalität wirken messbar", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");

        const measure = (tactics) => {
            const agg = { dist: 0, n: 0, forward: 0, left: 0, right: 0 };

            for (let run = 0; run < 4; run++) {
                Object.assign(homeClub.tactics, tactics);
                const match = { id: `flow_${run}_${tactics.passing}_${tactics.focus}_${tactics.mentality}`, played: false, homeClubId: "muc", awayClubId: "dor" };
                match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);

                const live = new LiveMatch(match, homeClub, awayClub, state.players);
                live.speed = 2;

                const director = live.director;
                const original = director.applyFlowAction.bind(director);
                director.applyFlowAction = (action) => {
                    // Nur echte Pässe zählen: Klärungsversuche und Spielfortsetzungen
                    // haben feste Längen und würden die Messung verwässern.
                    const isPass = action.type === "pass" || action.type === "longball";
                    if (isPass && action.from?.team === "home" && action.to) {
                        const tx = action.to.x ?? action.from.x;
                        const ty = action.to.y ?? action.from.y;
                        agg.dist += Math.hypot(tx - action.from.x, ty - action.from.y);
                        agg.n++;
                        if (tx > action.from.x) agg.forward++;
                        if (ty < 38) agg.left++;
                        else if (ty > 62) agg.right++;
                    }
                    original(action);
                };

                let frames = 0;
                while (!live.isFinished && frames < 60 * 500) {
                    live.advanceRealTime(1000 / 60);
                    live.updateBallAndPlayers(1000 / 60);
                    frames++;
                }
            }

            return {
                avgDist: agg.dist / Math.max(1, agg.n),
                forwardShare: agg.forward / Math.max(1, agg.n),
                left: agg.left,
                right: agg.right,
                n: agg.n
            };
        };

        const base = { mentality: "balanced", pressing: "medium", tempo: "normal", focus: "balanced" };

        const short = measure({ ...base, passing: "short" });
        const direct = measure({ ...base, passing: "direct" });

        if (short.n < 40 || direct.n < 40) {
            throw new Error(`Zu wenige Spielaktionen für eine Auswertung (${short.n}/${direct.n})`);
        }
        if (!(direct.avgDist > short.avgDist + 1.5)) {
            throw new Error(`Direktes Passspiel erzeugt keine längeren Pässe: kurz=${short.avgDist.toFixed(1)}, direkt=${direct.avgDist.toFixed(1)}`);
        }

        const left = measure({ ...base, passing: "mixed", focus: "left" });
        const right = measure({ ...base, passing: "mixed", focus: "right" });

        if (!(left.left > left.right)) {
            throw new Error(`Angriffsfokus links wirkt nicht: links=${left.left}, rechts=${left.right}`);
        }
        if (!(right.right > right.left)) {
            throw new Error(`Angriffsfokus rechts wirkt nicht: links=${right.left}, rechts=${right.right}`);
        }

        const offensive = measure({ ...base, passing: "mixed", mentality: "very_offensive" });
        const defensive = measure({ ...base, passing: "mixed", mentality: "very_defensive" });

        if (!(offensive.forwardShare > defensive.forwardShare + 0.12)) {
            throw new Error(`Mentalität wirkt nicht auf die Spielrichtung: offensiv=${(offensive.forwardShare * 100).toFixed(0)} %, defensiv=${(defensive.forwardShare * 100).toFixed(0)} %`);
        }

        // Aufräumen für nachfolgende Tests
        Object.assign(homeClub.tactics, base, { passing: "mixed" });
    });

    // 29. Spielfluss, Standardsituationen und Mannschaftsform im Live-Spiel
    test("LiveMatchDirector: durchgehender Spielfluss, Standards und aufrückende Mannschaft", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "flow_live", played: false, homeClubId: "muc", awayClubId: "dor" };
        match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);

        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        live.speed = 2;

        const setPieceKinds = new Set();
        const original = live.director.startDeadBall.bind(live.director);
        live.director.startDeadBall = (kind, team, x, y) => {
            setPieceKinds.add(kind);
            original(kind, team, x, y);
        };

        let frames = 0;
        let maxBallStep = 0;
        let prev = { x: live.ball.x, y: live.ball.y };
        const carriers = new Set();

        while (!live.isFinished && frames < 60 * 500) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
            frames++;
            maxBallStep = Math.max(maxBallStep, Math.hypot(live.ball.x - prev.x, live.ball.y - prev.y));
            prev = { x: live.ball.x, y: live.ball.y };
            if (live.director.carrierId) carriers.add(live.director.carrierId);
        }

        const stats = live.director.flowStats;
        if (stats.actions < 40) throw new Error(`Zu wenig Spielfluss: nur ${stats.actions} Aktionen`);

        const completionRate = stats.passesCompleted / Math.max(1, stats.actions);
        if (completionRate < 0.35 || completionRate > 0.9) {
            throw new Error(`Unrealistische Passquote: ${(completionRate * 100).toFixed(0)} %`);
        }
        if (stats.turnovers < 5) throw new Error(`Kaum Ballverluste: ${stats.turnovers}`);
        if (setPieceKinds.size === 0) throw new Error("Es gab keine einzige Standardsituation");
        if (setPieceKinds.has("corner")) {
            throw new Error("Ecken dürfen nicht aus dem Spielfluss entstehen (sonst weicht die Statistik vom Spielbericht ab)");
        }
        if (carriers.size < 12) throw new Error(`Nur ${carriers.size} verschiedene Spieler am Ball`);
        if (maxBallStep > 6) throw new Error(`Ball springt um ${maxBallStep.toFixed(1)} Feldeinheiten pro Bild`);

        // Kondition sinkt über die Spielzeit, aber nicht ins Bodenlose
        const freshness = live.players2D.map(p => p.freshness);
        const minFresh = Math.min(...freshness);
        const maxFresh = Math.max(...freshness);
        if (minFresh > 0.97) throw new Error("Die Kondition sinkt über 90 Minuten gar nicht");
        if (minFresh < 0.6) throw new Error(`Kondition fällt zu tief: ${minFresh.toFixed(2)}`);
        if (maxFresh - minFresh < 0.01) throw new Error("Alle Spieler ermüden exakt gleich stark");

        // Endstand bleibt deckungsgleich mit der Timeline
        if (live.homeScore !== match.homeGoals || live.awayScore !== match.awayGoals) {
            throw new Error("Der Spielfluss hat den Endstand verfälscht");
        }
    });

    // 30. Mannschaftsform: Aufrücken im Ballbesitz, Absichern ohne Ball
    test("LiveMatchDirector: Mannschaft rückt im Ballbesitz auf und sichert ohne Ball ab", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "shape", played: false, homeClubId: "muc", awayClubId: "dor" };
        match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);

        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        live.director.possessionTeam = "home";

        const settle = (ballX) => {
            for (let i = 0; i < 420; i++) {
                live.ball.targetX = ballX;
                live.ball.targetY = 50;
                live.updateBallAndPlayers(1000 / 60);
            }
            const home = live.players2D.filter(p => p.team === "home" && p.pos !== "TW");
            const byGroup = {};
            home.forEach(p => {
                byGroup[p.group] = byGroup[p.group] || [];
                byGroup[p.group].push(p.x);
            });
            const avg = arr => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
            return {
                def: avg(byGroup.def || [0]),
                mid: avg(byGroup.mid || [0]),
                att: avg(byGroup.att || [0])
            };
        };

        const deep = settle(20);
        const high = settle(85);

        // Staffelung: Abwehr hinter Mittelfeld hinter Angriff
        [deep, high].forEach((shape, idx) => {
            if (!(shape.def < shape.mid && shape.mid < shape.att)) {
                throw new Error(`Staffelung stimmt nicht (${idx === 0 ? "tief" : "hoch"}): ` +
                    `Abwehr ${shape.def.toFixed(0)}, Mittelfeld ${shape.mid.toFixed(0)}, Angriff ${shape.att.toFixed(0)}`);
            }
        });

        // Bei Ball im letzten Drittel rückt die ganze Mannschaft deutlich auf
        if (!(high.def > deep.def + 12)) {
            throw new Error(`Abwehrkette rückt nicht mit auf: tief ${deep.def.toFixed(0)}, hoch ${high.def.toFixed(0)}`);
        }
        if (!(high.att > 75)) {
            throw new Error(`Angriff kommt nicht in den Strafraum: ${high.att.toFixed(0)}`);
        }

        // Die verteidigende Mannschaft steht dabei tief
        const awayOutfield = live.players2D.filter(p => p.team === "away" && p.pos !== "TW");
        const awayAvg = awayOutfield.reduce((s, p) => s + p.x, 0) / awayOutfield.length;
        if (!(awayAvg > 65)) {
            throw new Error(`Verteidigende Mannschaft sichert nicht ab: Schnitt ${awayAvg.toFixed(0)}`);
        }
    });

    // 31. Die Spielwelt umfasst alle Ligen mit passend abgestuften Kadern
    test("WorldGenerator: alle zwölf Ligen gefüllt, Stärke nach Ligastufe gestaffelt", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const leagues = LEAGUES_DATA;

        leagues.forEach(league => {
            const clubs = state.clubs.filter(c => c.leagueId === league.id);
            if (clubs.length !== league.teamCount) {
                throw new Error(`${league.id} hat ${clubs.length} statt ${league.teamCount} Vereine`);
            }
            clubs.forEach(club => {
                const squad = state.players.filter(p => p.clubId === club.id);
                if (squad.length < 16) {
                    throw new Error(`${club.name} (${league.id}) hat nur ${squad.length} Spieler`);
                }
                if (!squad.some(p => p.pos === "TW")) {
                    throw new Error(`${club.name} hat keinen Torwart`);
                }
                if (club.lineup.length !== 11) {
                    throw new Error(`${club.name} hat keine vollständige Startelf (${club.lineup.length})`);
                }
                club.lineup.forEach(id => {
                    if (!state.players.some(p => p.id === id)) {
                        throw new Error(`${club.name}: Aufstellung verweist auf unbekannten Spieler ${id}`);
                    }
                });
            });
        });

        // Fünf Länder müssen vertreten sein
        const countries = new Set(state.clubs.map(c => c.countryId));
        ["de", "en", "es", "it", "fr"].forEach(id => {
            if (!countries.has(id)) throw new Error(`Land ${id} fehlt in der Spielwelt`);
        });

        // Kaderstärke muss über die Ligastufen deutlich fallen
        const avgByLevel = {};
        [1, 2, 3, 4, 5, 6, 7].forEach(level => {
            const clubIds = new Set(state.clubs.filter(c => c.level === level).map(c => c.id));
            const squad = state.players.filter(p => clubIds.has(p.clubId));
            avgByLevel[level] = squad.reduce((sum, p) => sum + p.overall, 0) / Math.max(1, squad.length);
        });

        for (let level = 1; level < 7; level++) {
            if (!(avgByLevel[level] > avgByLevel[level + 1] + 3)) {
                throw new Error(`Ligastufe ${level} (${avgByLevel[level].toFixed(1)}) ist nicht deutlich stärker als Stufe ${level + 1} (${avgByLevel[level + 1].toFixed(1)})`);
            }
        }
        if (!(avgByLevel[1] > avgByLevel[7] + 35)) {
            throw new Error(`Bundesliga (${avgByLevel[1].toFixed(1)}) und Landesliga (${avgByLevel[7].toFixed(1)}) liegen zu dicht beieinander`);
        }
    });

    // 32. Karriere in der Landesliga: eigener Spielplan, alle Ligen laufen mit
    test("WorldGenerator: Karrierestart in der Landesliga mit eigener Liga und Hintergrundligen", () => {
        const landesligist = GameState.getSelectableClubs().find(c => c.leagueId === "de_ll_1");
        if (!landesligist) throw new Error("Kein Landesligist zur Auswahl vorhanden");

        const state = GameState.createNewGame(landesligist.id, "normal", { name: "Trainer" });

        if (state.userLeagueId !== "de_ll_1") throw new Error(`Falsche Nutzerliga: ${state.userLeagueId}`);
        if (state.totalMatchdays !== 30) throw new Error(`Landesliga hat ${state.totalMatchdays} statt 30 Spieltage`);
        if (Object.keys(state.otherSchedules || {}).length !== LEAGUES_DATA.length - 1) {
            throw new Error(`Es fehlen Spielpläne fremder Ligen (${Object.keys(state.otherSchedules || {}).length})`);
        }

        // Der Spielplan der eigenen Liga enthält ausschließlich Landesligisten
        const leagueClubIds = new Set(state.clubs.filter(c => c.leagueId === "de_ll_1").map(c => c.id));
        state.schedule.forEach(round => round.matches.forEach(m => {
            if (!leagueClubIds.has(m.homeClubId) || !leagueClubIds.has(m.awayClubId)) {
                throw new Error("Der Spielplan der Landesliga enthält ligafremde Vereine");
            }
        }));

        // Ein Spieltag lässt auch die anderen Ligen mitspielen
        SeasonEngine.advanceToNextMatchday(state);
        const bundesliga = state.standingsByLeague?.de_liga_1 || [];
        if (bundesliga.length !== 18) throw new Error(`Bundesliga-Tabelle hat ${bundesliga.length} Einträge`);
        if (!bundesliga.some(entry => entry.played > 0)) {
            throw new Error("Die Bundesliga hat am ersten Spieltag nicht mitgespielt");
        }
        if (state.standings.length !== 16) {
            throw new Error(`Landesliga-Tabelle hat ${state.standings.length} statt 16 Einträge`);
        }
    });

    // 33. Europapokal wird aus den echten Startplätzen der Topligen besetzt
    test("CompetitionEngine: Europapokal aus den Startplätzen aller fünf Topligen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const comps = state.europeanCompetitions;

        ["ucl", "uel", "uecl"].forEach(id => {
            const comp = comps[id];
            if (!comp || comp.participants.length < 8) throw new Error(`${id} hat zu wenige Teilnehmer`);
            if (comp.participants.length % 4 !== 0) throw new Error(`${id}: Teilnehmerzahl passt nicht zu Vierergruppen`);
            if (comp.groups.length !== comp.participants.length / 4) throw new Error(`${id}: Gruppenzahl passt nicht`);

            const countries = new Set(comp.participants.map(cid => state.clubs.find(c => c.id === cid)?.countryId));
            if (countries.size < 4) throw new Error(`${id} wird nur aus ${countries.size} Ländern besetzt`);

            comp.participants.forEach(cid => {
                const club = state.clubs.find(c => c.id === cid);
                if (!club) throw new Error(`${id}: unbekannter Verein ${cid}`);
                if (club.level !== 1) throw new Error(`${id}: ${club.name} ist kein Erstligist`);
            });
        });

        // Kein Verein darf in zwei Wettbewerben stehen
        const all = [...comps.ucl.participants, ...comps.uel.participants, ...comps.uecl.participants];
        if (new Set(all).size !== all.length) throw new Error("Ein Verein startet in mehreren europäischen Wettbewerben");
    });

    // 34. Auf- und Abstieg über die Ligapyramide
    test("CompetitionEngine: Auf- und Abstieg erhält die Größe aller Ligen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });

        // Tabellen aller Ligen bereitstellen
        state.leagues.forEach(league => {
            const clubs = state.clubs.filter(c => c.leagueId === league.id);
            const schedule = GameState.getScheduleForLeague(state, league.id);
            state.standingsByLeague[league.id] = GameState.calculateStandings(clubs, schedule, 999);
        });

        const sizesBefore = {};
        state.leagues.forEach(l => { sizesBefore[l.id] = state.clubs.filter(c => c.leagueId === l.id).length; });

        const meister = state.standingsByLeague.de_liga_2[0].clubId;
        const result = CompetitionEngine.processSeasonEndPromotionsRelegations(state);

        if (result.promoted.length === 0) throw new Error("Es ist kein Verein aufgestiegen");
        if (result.relegated.length !== result.promoted.length) {
            throw new Error(`Auf- und Absteiger stimmen nicht überein: ${result.promoted.length} / ${result.relegated.length}`);
        }

        state.leagues.forEach(l => {
            const now = state.clubs.filter(c => c.leagueId === l.id).length;
            if (now !== sizesBefore[l.id]) {
                throw new Error(`${l.id} hat nach dem Auf-/Abstieg ${now} statt ${sizesBefore[l.id]} Vereine`);
            }
        });

        const aufsteiger = state.clubs.find(c => c.id === meister);
        if (aufsteiger.leagueId !== "de_liga_1" || aufsteiger.level !== 1) {
            throw new Error(`Der Zweitligameister ist nicht aufgestiegen (${aufsteiger.leagueId})`);
        }
    });

    // 35. Kompaktes Speicherformat: verlustfrei und klein genug für den Browser
    test("SaveCodec: Spielstand der ganzen Welt passt kodiert in den LocalStorage", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        for (let i = 0; i < 3; i++) SeasonEngine.advanceToNextMatchday(state);

        const rawSize = JSON.stringify(state).length;
        const encoded = SaveCodec.encodeState(state);
        const encodedSize = JSON.stringify(encoded).length;

        if (encodedSize > 3 * 1024 * 1024) {
            throw new Error(`Kodierter Spielstand ist mit ${(encodedSize / 1048576).toFixed(2)} MB zu groß für den LocalStorage`);
        }
        if (!(encodedSize < rawSize * 0.45)) {
            throw new Error(`Kodierung spart zu wenig: ${(encodedSize / rawSize * 100).toFixed(0)} % der Rohgröße`);
        }

        const decoded = SaveCodec.decodeState(JSON.parse(JSON.stringify(encoded)));

        if (decoded.players.length !== state.players.length) throw new Error("Spieleranzahl geht beim Dekodieren verloren");
        if (decoded.clubs.length !== state.clubs.length) throw new Error("Vereinsanzahl geht beim Dekodieren verloren");
        if (decoded.schedule.length !== state.schedule.length) throw new Error("Spielplan geht beim Dekodieren verloren");
        if (Object.keys(decoded.otherSchedules).length !== Object.keys(state.otherSchedules).length) {
            throw new Error("Spielpläne fremder Ligen gehen verloren");
        }

        // Wichtige Spielerfelder müssen identisch zurückkommen - inklusive
        // der numerischen IDs der handgepflegten Vereine
        const felder = ["id", "name", "age", "pos", "overall", "pot", "value", "wage", "clubId",
                        "trueCurrentAbility", "pace", "shooting", "defense", "injuredWeeks", "suspendedMatches"];
        state.players.forEach((original, idx) => {
            const back = decoded.players[idx];
            felder.forEach(feld => {
                if (JSON.stringify(original[feld]) !== JSON.stringify(back[feld])) {
                    throw new Error(`Spielerfeld ${feld} verändert sich: ${JSON.stringify(original[feld])} -> ${JSON.stringify(back[feld])}`);
                }
            });
        });

        // Aufstellungen müssen weiterhin auflösbar sein
        decoded.clubs.forEach(club => {
            club.lineup.forEach(id => {
                if (!decoded.players.some(p => p.id === id)) {
                    throw new Error(`${club.name}: Aufstellung nach dem Dekodieren nicht mehr auflösbar`);
                }
            });
        });

        // Ergebnisse gespielter Partien bleiben erhalten, die Timeline nicht
        let gespielt = 0;
        decoded.schedule.forEach(round => round.matches.forEach(m => {
            if (!m.played) return;
            gespielt++;
            if (typeof m.homeGoals !== "number" || typeof m.awayGoals !== "number") {
                throw new Error("Ergebnis einer gespielten Partie fehlt nach dem Dekodieren");
            }
            if (m.timeline) throw new Error("Gespielte Partie schleppt die Timeline in den Spielstand");
        }));
        if (gespielt === 0) throw new Error("Keine gespielten Partien im Spielplan gefunden");
    });

    // Taktung der 2D-Simulation: Spielaufbau muss sichtbar bleiben
    test("LiveMatchDirector: Spieltempo bleibt beobachtbar und je Stufe unterscheidbar", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "tempo", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = new LiveMatch(match, homeClub, awayClub, state.players);

        live.speed = 1;
        const slow = live.director.getBaseClockRate();
        live.speed = 2;
        const normal = live.director.getBaseClockRate();
        live.speed = 4;
        const fast = live.director.getBaseClockRate();

        if (!(slow < normal && normal < fast)) {
            throw new Error(`Uhrtempo nicht gestaffelt: langsam=${slow}, normal=${normal}, schnell=${fast}`);
        }

        // Auf der langsamsten Stufe sollen 90 Minuten mindestens acht echte
        // Minuten dauern - sonst huscht der Spielaufbau wieder vorbei.
        const minutesForFullMatch = (90 * 60) / slow / 60;
        if (minutesForFullMatch < 8) {
            throw new Error(`Langsamste Stufe spielt 90 Minuten in nur ${minutesForFullMatch.toFixed(1)} echten Minuten ab`);
        }

        // Der Ballaufbau zwischen den Höhepunkten muss den Großteil der Zeit
        // einnehmen, nicht die Highlight-Inszenierung.
        live.speed = 1;
        let frames = 0;
        let ambientMs = 0;
        while (!live.isFinished && frames < 60 * 1500) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
            if (live.director.mode === "ambient") ambientMs += 1000 / 60;
            frames++;
        }
        if (!live.isFinished) throw new Error("Livespiel wurde im Tempotest nicht beendet");

        const totalMs = frames * (1000 / 60);
        const ambientShare = ambientMs / totalMs;
        if (ambientShare < 0.5) {
            throw new Error(`Nur ${(ambientShare * 100).toFixed(0)} % Spielaufbau - zu wenig sichtbarer Spielfluss`);
        }
    });

    // Regie-Einlagen: Zeitlupe beim Tor, Standbild bei Karten
    test("LiveMatchDirector: Tor läuft in Zeitlupe, Karten unterbrechen das Spiel", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "regie", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        const dir = live.director;

        // Tor: erst Zeitlupe, dann Jubel, dann Anstoß
        dir.startCelebration({ type: "goal", team: "home", playerName: "Testtorschütze" });
        if (live.slowMotion !== 1) throw new Error("Tor startet ohne Zeitlupe");
        if (dir.getMotionScale() >= 1) throw new Error("Bewegung läuft in der Zeitlupe unverändert weiter");
        if (dir.getTimeScale() >= 0.1) throw new Error("Spieluhr läuft in der Zeitlupe zu schnell");

        let guard = 0;
        while (dir.celebrationPhase === "slowmo" && guard++ < 2000) dir.step(1 / 60, false);
        if (dir.celebrationPhase !== "jubel") throw new Error("Nach der Zeitlupe folgt kein Jubel");
        if (live.slowMotion !== 0) throw new Error("Zeitlupe endet nicht mit dem Jubel");

        guard = 0;
        while (dir.mode === "celebration" && guard++ < 4000) dir.step(1 / 60, false);
        if (live.celebratingTeam !== null) throw new Error("Jubel wird nicht aufgelöst");

        // Gelbe Karte: Spiel steht still, Schiedsrichter zeigt die Karte
        dir.bannerForEvent({
            type: "yellow_card", team: "away", playerName: "Grätscher",
            start: { x: 40, y: 60 }
        });
        if (!dir.drama || dir.drama.kind !== "card") throw new Error("Gelbe Karte unterbricht das Spiel nicht");
        if (dir.drama.card !== "yellow") throw new Error(`Falsche Karte hinterlegt: ${dir.drama.card}`);
        if (dir.getMotionScale() !== 0) throw new Error("Spieler laufen während der Unterbrechung weiter");

        // Der Unparteiische geht zum Tatort
        for (let i = 0; i < 400; i++) dir.updateReferee(1 / 60);
        if (live.refereeCard !== "yellow") throw new Error("Karte wird nicht angezeigt");
        if (Math.hypot(live.referee.x - 40, live.referee.y - 56.5) > 8) {
            throw new Error(`Schiedsrichter läuft nicht zum Tatort (${live.referee.x.toFixed(1)}/${live.referee.y.toFixed(1)})`);
        }

        // Nach Ablauf läuft das Spiel normal weiter
        guard = 0;
        while (dir.drama && guard++ < 4000) dir.updateDrama(1 / 60);
        if (live.motionFreeze) throw new Error("Standbild wird nach der Unterbrechung nicht aufgehoben");
        if (dir.getMotionScale() !== 1) throw new Error("Bewegung läuft nach der Unterbrechung nicht normal weiter");
    });

    console.log(`\n  Ergebnis Engine-Tests: ${passed} bestanden, ${failed} fehlgeschlagen.`);
    if (failed > 0) throw new Error(`${failed} Engine-Tests fehlgeschlagen.`);
    return { passed, failed };
}

if (require.main === module) {
    runEngineTests();
}

module.exports = { runEngineTests };
