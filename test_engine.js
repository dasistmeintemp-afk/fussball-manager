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
const { GameState, FORMATION_CONFIGS } = require('./js/engine/gameState.js');
const { MatchEngine, LiveMatch } = require('./js/engine/matchEngine.js');
const { TransferEngine } = require('./js/engine/transferEngine.js');
const { TrainingEngine } = require('./js/engine/trainingEngine.js');
const { SeasonEngine } = require('./js/engine/seasonEngine.js');

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
        const genClub = ClubGenerator.generateClub("de", "de_ll_1", 7, "Bayern");
        if (!genClub.id || !genClub.name || !genClub.stadium || genClub.tier !== "amateur") {
            throw new Error("ClubGenerator for level 7 invalid");
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
    test("SaveService & MigrationService: Export, Import und Schema-Migration von v1 nach v5", () => {
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
        if (!migRes.success || migRes.saveVersion !== 5 || !migRes.state.scouting || !migRes.state.calendar || !migRes.state.competitions) {
            throw new Error("MigrationService failed to migrate to version 5");
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
        const clubs = state.clubs;
        const players = state.players;

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

            // Idempotenz testen
            const goalsBefore = match.homeGoals;
            MatchEngine.applyTimelineToMatch(match, match.timeline, home, away, players);
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

    console.log(`\n  Ergebnis Engine-Tests: ${passed} bestanden, ${failed} fehlgeschlagen.`);
    if (failed > 0) throw new Error(`${failed} Engine-Tests fehlgeschlagen.`);
    return { passed, failed };
}

if (require.main === module) {
    runEngineTests();
}

module.exports = { runEngineTests };
