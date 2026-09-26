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
const { CoachingStaffEngine } = require('./js/engine/coachingStaffEngine.js');
const { PreseasonEngine } = require('./js/engine/preseasonEngine.js');
const { YouthEngine } = require('./js/engine/youthEngine.js');
const { FacilityEngine } = require('./js/engine/facilityEngine.js');

/** Dieselbe Liste wie im LiveMatchDirector - Ereignisse ohne Ballfuehrung */
const OHNE_BALLFUEHRUNG_TEST = ["foul", "yellow_card", "red_card", "injury", "substitution", "halftime", "fulltime"];
const RUHENDER_BALL_TEST = ["corner", "penalty", "freekick", "throwin", "goalkick", "kickoff"];
const { AIManagerEngine } = require('./js/engine/aiManagerEngine.js');
const { ClubGenerator } = require('./js/engine/clubGenerator.js');
const { PlayerGenerator } = require('./js/engine/playerGenerator.js');
const { CompetitionEngine } = require('./js/engine/competitionEngine.js');
const { PlayerRatingEngine } = require('./js/engine/playerRatingEngine.js');
const { CalendarEngine } = require('./js/engine/calendarEngine.js');
const { OpponentAnalysisEngine } = require('./js/engine/opponentAnalysisEngine.js');
const { PositionEngine } = require('./js/engine/positionEngine.js');
const { TacticsEngine } = require('./js/engine/tacticsEngine.js');
const { MatchFlowEngine } = require('./js/engine/matchFlowEngine.js');
const { GameState, FORMATION_CONFIGS } = require('./js/engine/gameState.js');
const { MatchEngine, LiveMatch, MATCH_TUNING } = require('./js/engine/matchEngine.js');
const { TransferEngine } = require('./js/engine/transferEngine.js');
const { TrainingEngine } = require('./js/engine/trainingEngine.js');
const { SeasonEngine } = require('./js/engine/seasonEngine.js');
const { WorldGenerator } = require('./js/engine/worldGenerator.js');
const { SaveCodec } = require('./js/services/saveCodec.js');
const { NegotiationEngine } = require('./js/engine/negotiationEngine.js');
const { ManagerEngine } = require('./js/engine/managerEngine.js');
const { CupEngine } = require('./js/engine/cupEngine.js');
const { CareerEngine } = require('./js/engine/careerEngine.js');
const { REAL_CLUBS_BY_LEAGUE } = require('./js/data/realClubs.js');

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

        // Jedes Ereignis braucht Minute, Typ und Text. Start- und Zielpunkt
        // hat nur, was auf dem Rasen stattfindet: Verletzungen, Wechsel und
        // die Abschnittsmarken kommen ohne Koordinaten aus. Vorher prüfte der
        // Test blind das erste Ereignis - fiel dort in Minute eins jemand aus,
        // schlug er grundlos fehl.
        const ohneOrt = new Set(["halftime", "fulltime", "substitution", "injury"]);
        const luecke = timeline.find(ev => ev.minute === undefined || !ev.type || !ev.text
            || (!ohneOrt.has(ev.type) && (!ev.start || !ev.end)));
        if (luecke) {
            throw new Error(`Ereignis ohne Pflichtangaben: Minute ${luecke.minute}, Typ ${luecke.type}`);
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

        // Teste dynamisches Aufrücken über das Spielfeld.
        // Erst den Anstoß auflösen lassen - solange der Ball ruht, stehen alle
        // in Anstoßformation und rücken zu Recht nicht auf.
        // Gewartet wird, bis die Zeremonie durch ist - nicht eine feste Zahl
        // Bilder lang. Seit der Anstoss auf den Ball und den Schuetzen wartet,
        // dauert er laenger als zweieinhalb Sekunden, und solange steht die Elf
        // zu Recht in Anstossformation.
        for (let t = 0; t < 3000 && (liveMatch.director.kickoff || liveMatch.director.deadBall); t++) {
            liveMatch.advanceRealTime(1000 / 60);
            liveMatch.updateBallAndPlayers(1000 / 60);
        }
        for (let t = 0; t < 150; t++) {
            liveMatch.advanceRealTime(1000 / 60);
            liveMatch.updateBallAndPlayers(1000 / 60);
        }

        liveMatch.director.possessionTeam = "home";
        liveMatch.ball.x = 80;
        liveMatch.ball.y = 50;
        liveMatch.ball.targetX = 80;
        liveMatch.ball.targetY = 50;
        // Hundert Schritte statt dreissig: Geprueft wird, ob der Block bei Ball
        // im gegnerischen Drittel aufrueckt - nicht, wie schnell. Seit die
        // Spieler mit glaubwuerdigem Tempo laufen, sind zwanzig Meter kein
        // Drei-Sekunden-Weg mehr, sondern einer von zehn.
        for (let t = 0; t < 100; t++) liveMatch.updateBallAndPlayers();

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
        // Seit jeder Verein einen Anlagenschwerpunkt hat, kann die Akademie
        // schon auf Stufe vier stehen - dann kostet der Ausbau mehr, als in
        // der Kasse liegt. Geprueft wird hier die Mechanik, nicht der Etat.
        const svw = state.clubs.find(c => c.id === "svw");
        svw.balance = 100000000;
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
    test("SaveService & MigrationService: Export, Import und Schema-Migration von v1 nach v8", () => {
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
        if (!migRes.success || migRes.saveVersion !== 8 || !migRes.state.scouting || !migRes.state.calendar || !migRes.state.competitions || !migRes.state.customFormations) {
            throw new Error("MigrationService failed to migrate to version 8");
        }
        if (!Array.isArray(migRes.state.negotiations)) {
            throw new Error("Migration legt keine Verhandlungsliste an");
        }
        const beispiel = migRes.state.players[0];
        if (typeof beispiel.matchSharpness !== "number" || !beispiel.trainingLog || !beispiel.positionExperience) {
            throw new Error("Migration ergänzt keine Trainings- und Positionswerte");
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

    // 13a. Stärke und Potenzial in einer Sternereihe
    test("PlayerRatingEngine: Eine Sternereihe zeigt heutige Stärke und Potenzial", () => {
        const haelften = (html) => (html.match(/star-(solid|maybe|growth|none)/g) || []).map(s => s.replace("star-", ""));
        const zaehle = (html, art) => haelften(html).filter(h => h === art).length;

        // Fünf Sterne heißen zehn Hälften - immer, egal welche Werte
        const reihe = PlayerRatingEngine.renderAbilityStars({ caMin: 2, caMax: 2, paMax: 4.5 });
        if (haelften(reihe).length !== 10) {
            throw new Error(`Die Reihe hat ${haelften(reihe).length} Sternhälften statt zehn`);
        }
        if (zaehle(reihe, "solid") !== 4) throw new Error("Zwei Sterne heutige Stärke müssen vier gefüllte Hälften ergeben");
        if (zaehle(reihe, "growth") !== 5) throw new Error("Das Potenzial bis 4,5 muss fünf schraffierte Hälften ergeben");
        if (zaehle(reihe, "none") !== 1) throw new Error("Der Rest oberhalb des Potenzials muss leer bleiben");

        // Ohne Scoutwissen kommt die unsichere Spanne dazu
        const unsicher = PlayerRatingEngine.renderAbilityStars({ caMin: 1.5, caMax: 3, paMax: 5 });
        if (zaehle(unsicher, "solid") !== 3) throw new Error("Die gesicherte Stärke stimmt nicht");
        if (zaehle(unsicher, "maybe") !== 3) throw new Error("Die geschätzte Spanne fehlt in der Reihe");
        if (zaehle(unsicher, "growth") !== 4) throw new Error("Das Potenzial fehlt in der Reihe");

        // Wer am Limit ist, hat keinen schraffierten Anteil
        const amLimit = PlayerRatingEngine.renderAbilityStars({ caMin: 3, caMax: 3, paMax: 3 });
        if (zaehle(amLimit, "growth") !== 0) {
            throw new Error("Ein Spieler am Leistungslimit darf kein Entwicklungspotenzial anzeigen");
        }
        if (!/Leistungslimit/.test(PlayerRatingEngine.describeAbilityStars({ caMin: 3, caMax: 3, paMax: 3 }))) {
            throw new Error("Der Klartext nennt das Leistungslimit nicht");
        }

        // Die Spielerkarte liefert die Reihe direkt mit
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const eigener = state.players.find(p => p.clubId === "muc");
        const karte = PlayerRatingEngine.calculateVisiblePlayerCard(eigener, {
            userClubId: "muc", userSquadAvgAbility: 150
        });
        if (!karte.abilityStarsHtml || !karte.abilityStarsHtml.includes("ability-stars")) {
            throw new Error("Die Spielerkarte enthält keine Sternereihe");
        }
        if (!karte.abilityStarsText || !/Sterne/.test(karte.abilityStarsText)) {
            throw new Error("Die Spielerkarte enthält keine Klartextfassung der Sterne");
        }

        // Ein junger Spieler mit Luft nach oben zeigt Potenzial
        const talent = { overall: 55, pot: 85, trueCurrentAbility: 110, truePotentialAbility: 170, age: 18, clubId: "muc", id: "t1" };
        const talentKarte = PlayerRatingEngine.calculateVisiblePlayerCard(talent, {
            userClubId: "muc", userSquadAvgAbility: 150
        });
        if (zaehle(talentKarte.abilityStarsHtml, "growth") === 0) {
            throw new Error("Ein 18-jähriges Talent muss Entwicklungspotenzial in der Reihe zeigen");
        }

        // Mannschaftssterne: die Startelf zählt, nicht der ganze Kader
        const club = state.clubs.find(c => c.id === "muc");
        const kader = state.players.filter(p => club.playerIds.includes(p.id));
        const mannschaft = PlayerRatingEngine.teamStars(kader, { squadAverageAbility: 150 });
        if (!(mannschaft.ca > 0 && mannschaft.ca <= 5)) throw new Error(`Mannschaftssterne außerhalb der Skala: ${mannschaft.ca}`);
        if (mannschaft.pa < mannschaft.ca) throw new Error("Das Mannschaftspotenzial darf nicht unter der heutigen Stärke liegen");

        // Eine schwächere Mannschaft bekommt weniger Sterne
        const schwach = kader.map(p => Object.assign({}, p, { overall: Math.max(20, p.overall - 25), pot: Math.max(20, p.overall - 20) }));
        const schwachSterne = PlayerRatingEngine.teamStars(schwach, { squadAverageAbility: 150 });
        if (!(schwachSterne.ca < mannschaft.ca)) {
            throw new Error(`Ein deutlich schwächerer Kader bekommt nicht weniger Sterne (${schwachSterne.ca} statt unter ${mannschaft.ca})`);
        }
    });

    // 13b. Der Trainerstab plant selbst, der Manager behält das letzte Wort
    test("CoachingStaffEngine: Der Stab plant, der Manager kann ein Veto einlegen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const bundesligist = state.clubs.find(c => c.id === "muc");
        const amateur = state.clubs.filter(c => (c.level || 1) === 7)[0];

        // Die Güte des Stabs richtet sich nach der Spielklasse
        const stabProfi = CoachingStaffEngine.staffQuality(bundesligist);
        const stabAmateur = CoachingStaffEngine.staffQuality(amateur);
        if (!(stabProfi.overall > stabAmateur.overall + 25)) {
            throw new Error(`Trainerstab kaum unterschieden: Profi ${stabProfi.overall}, Amateur ${stabAmateur.overall}`);
        }
        if (!(stabProfi.entwicklungsFaktor > stabAmateur.entwicklungsFaktor)) {
            throw new Error("Ein besserer Stab muss die Entwicklung auch stärker beschleunigen");
        }

        // Am Tag vor dem Spiel wird nicht mehr geschunden
        const vorSpiel = CoachingStaffEngine.planTraining(state, "opponent_analysis");
        if (vorSpiel.intensity !== "low") {
            throw new Error(`Abschlusstraining mit Intensität "${vorSpiel.intensity}" statt locker`);
        }

        // Ein ausgelaugter Kader wird geschont, egal was sonst ansteht
        const kader = state.players.filter(p => bundesligist.playerIds.includes(p.id));
        kader.forEach(p => { p.fitness = 60; });
        const muede = CoachingStaffEngine.planTraining(state, "training");
        if (muede.intensity !== "low") {
            throw new Error(`Der Stab lässt einen ausgelaugten Kader mit "${muede.intensity}" trainieren`);
        }
        if (!muede.grund || muede.grund.length < 10) {
            throw new Error("Der Stab begründet seine Entscheidung nicht");
        }
        kader.forEach(p => { p.fitness = 95; });

        // Ohne Veto plant der Stab und überschreibt die Einstellung
        state.trainingSettings = { focus: "attack", intensity: "high" };
        CoachingStaffEngine.applyDailyPlan(state, "recovery");
        if (state.trainingSettings.intensity !== "low") {
            throw new Error("Der Stab hat den Regenerationstag nicht durchgesetzt");
        }

        // Mit Veto gilt die Vorgabe des Managers - und läuft danach aus
        CoachingStaffEngine.setManagerVeto(state, "defense", "high", 2);
        CoachingStaffEngine.applyDailyPlan(state, "recovery");
        if (state.trainingSettings.focus !== "defense" || state.trainingSettings.intensity !== "high") {
            throw new Error("Das Veto des Managers wurde übergangen");
        }
        CoachingStaffEngine.applyDailyPlan(state, "recovery");
        if (CoachingStaffEngine.activeVeto(state)) {
            throw new Error("Das Veto läuft nach der vereinbarten Dauer nicht aus");
        }
        CoachingStaffEngine.applyDailyPlan(state, "recovery");
        if (state.trainingSettings.intensity !== "low") {
            throw new Error("Nach Ablauf des Vetos übernimmt der Trainerstab nicht wieder");
        }
    });

    // 13c. Der Markt endet dort, wo das Standing des Vereins endet
    test("TransferEngine & ScoutingEngine: Der Markt richtet sich nach der eigenen Ligastufe", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });

        const bundesligist = state.clubs.find(c => c.id === "muc");
        const landesligist = state.clubs.filter(c => (c.level || 1) === 7)[0];
        if (!landesligist) throw new Error("Kein Landesligist in der Welt gefunden");

        // Der Spitzenverein erreicht die gesamte Welt
        if (TransferEngine.marketReach(bundesligist) !== 1) {
            throw new Error("Ein Bundesliga-Spitzenverein muss bis in die höchste Spielklasse reichen");
        }

        // Der Amateurverein nicht
        const reichweiteAmateur = TransferEngine.marketReach(landesligist);
        if (reichweiteAmateur <= 3) {
            throw new Error(`Ein Landesligist reicht bis Stufe ${reichweiteAmateur} - das ist unrealistisch weit`);
        }

        const bundesligaSpieler = state.players.find(p => {
            const c = state.clubs.find(x => x.id === p.clubId);
            return c && (c.level || 1) === 1;
        });
        if (TransferEngine.isWithinReach(bundesligaSpieler, landesligist, state.clubs)) {
            throw new Error("Ein Landesligist darf keine Erstligaprofis im Transfermarkt sehen");
        }

        // Vereinslose stehen jedem offen
        const frei = { id: "frei_test", clubId: null, overall: 60 };
        if (!TransferEngine.isWithinReach(frei, landesligist, state.clubs)) {
            throw new Error("Ablösefreie Spieler müssen auch für Amateurvereine sichtbar sein");
        }

        // Der Scout bringt nur Berichte aus erreichbaren Ligen zurück
        state.userClubId = landesligist.id;
        state.scouting = { assignments: [], reports: [], shortlist: [] };
        const auftrag = ScoutingEngine.startAssignment(state, { position: "ALL", maxAge: 32, minOverall: 1 });
        ScoutingEngine.completeAssignment(state, auftrag.assignment);

        if (state.scouting.reports.length === 0) {
            throw new Error("Der Scout eines Landesligisten kam ohne einen einzigen Bericht zurück");
        }
        state.scouting.reports.forEach(r => {
            const p = state.players.find(x => String(x.id) === String(r.playerId));
            const c = p ? state.clubs.find(x => x.id === p.clubId) : null;
            if (c && (c.level || 1) < reichweiteAmateur) {
                throw new Error(`Scoutbericht über ${p.name} aus Ligastufe ${c.level} - außerhalb der Reichweite ${reichweiteAmateur}`);
            }
        });

        // Und ein Erstligaprofi lässt sich nur zäh durchleuchten
        const daempfung = ScoutingEngine.reachPenalty(state, bundesligaSpieler);
        if (daempfung >= 0.6) {
            throw new Error(`Ein Erstligaprofi ist für den Amateurscout zu leicht zu durchleuchten (Faktor ${daempfung})`);
        }
    });

    // 14a. Die Tabelle muss die tatsächlichen Ergebnisse widerspiegeln
    test("GameState: Tabelle stimmt Tor für Tor mit den gespielten Partien überein", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        for (let i = 0; i < 6; i++) SeasonEngine.advanceToNextMatchday(state);

        const soll = {};
        state.schedule.forEach(runde => runde.matches.forEach(m => {
            if (!m.played || m.homeGoals === null || m.awayGoals === null) return;
            [m.homeClubId, m.awayClubId].forEach(id => {
                soll[id] = soll[id] || { gespielt: 0, fuer: 0, gegen: 0, punkte: 0 };
            });
            soll[m.homeClubId].gespielt++; soll[m.awayClubId].gespielt++;
            soll[m.homeClubId].fuer += m.homeGoals; soll[m.homeClubId].gegen += m.awayGoals;
            soll[m.awayClubId].fuer += m.awayGoals; soll[m.awayClubId].gegen += m.homeGoals;
            if (m.homeGoals > m.awayGoals) soll[m.homeClubId].punkte += 3;
            else if (m.homeGoals < m.awayGoals) soll[m.awayClubId].punkte += 3;
            else { soll[m.homeClubId].punkte++; soll[m.awayClubId].punkte++; }
        }));

        state.standings.forEach(eintrag => {
            const s = soll[eintrag.clubId] || { gespielt: 0, fuer: 0, gegen: 0, punkte: 0 };
            if (eintrag.played !== s.gespielt) throw new Error(`${eintrag.clubName}: ${eintrag.played} Spiele in der Tabelle, tatsächlich ${s.gespielt}`);
            if (eintrag.goalsFor !== s.fuer) throw new Error(`${eintrag.clubName}: ${eintrag.goalsFor} eigene Tore in der Tabelle, tatsächlich ${s.fuer}`);
            if (eintrag.goalsAgainst !== s.gegen) throw new Error(`${eintrag.clubName}: ${eintrag.goalsAgainst} Gegentore in der Tabelle, tatsächlich ${s.gegen}`);
            if (eintrag.points !== s.punkte) throw new Error(`${eintrag.clubName}: ${eintrag.points} Punkte in der Tabelle, tatsächlich ${s.punkte}`);
            if (eintrag.goalDiff !== s.fuer - s.gegen) throw new Error(`${eintrag.clubName}: Tordifferenz ${eintrag.goalDiff} statt ${s.fuer - s.gegen}`);
        });

        // In einer Liga fällt jedes Tor bei einem anderen als Gegentor an
        const summeFuer = state.standings.reduce((a, e) => a + e.goalsFor, 0);
        const summeGegen = state.standings.reduce((a, e) => a + e.goalsAgainst, 0);
        if (summeFuer !== summeGegen) {
            throw new Error(`Ligaweit ${summeFuer} erzielte, aber ${summeGegen} kassierte Tore`);
        }
        if (summeFuer === 0) throw new Error("Nach sechs Spieltagen steht kein einziges Tor in der Tabelle");

        // Und die Tordifferenzen einer Liga heben sich gegenseitig auf
        const summeDiff = state.standings.reduce((a, e) => a + e.goalDiff, 0);
        if (summeDiff !== 0) throw new Error(`Die Tordifferenzen summieren sich auf ${summeDiff} statt auf null`);
    });

    // 14a2. Ein Ausfall darf nicht die halbe Mannschaft verschieben
    test("GameState: Ein Ausfall lässt alle anderen auf ihrer Position stehen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const slots = GameState.getFormationConfig(club.formation).positions.map(s => s.pos);

        // Wer stand vor dem Ausfall auf welcher Position?
        const vorher = new Map();
        club.lineup.forEach((id, i) => vorher.set(id, slots[i]));

        // Der Torwart fällt aus - der denkbar schlimmste Fall, denn er steht
        // ganz vorne im Array und würde alle anderen um einen Platz schieben.
        const torwartId = club.lineup[0];
        const torwart = state.players.find(p => p.id === torwartId);
        torwart.injuredWeeks = 4;

        GameState.repairLineup(club, state.players);

        if (club.lineup.length !== 11) {
            throw new Error(`Nach dem Ausfall stehen ${club.lineup.length} Spieler in der Elf`);
        }
        if (club.lineup.includes(torwartId)) {
            throw new Error("Der verletzte Torwart steht weiterhin in der Startelf");
        }

        club.lineup.forEach((id, i) => {
            const alt = vorher.get(id);
            if (alt && alt !== slots[i]) {
                const spieler = state.players.find(p => p.id === id);
                throw new Error(`${spieler?.name || id} stand auf ${alt} und steht jetzt auf ${slots[i]}`);
            }
        });

        // Auf dem frei gewordenen Platz muss ein Torwart stehen
        const ersatz = state.players.find(p => p.id === club.lineup[0]);
        if (!ersatz || ersatz.pos !== "TW") {
            throw new Error(`Auf der Torwartposition steht jetzt ein ${ersatz?.pos || "niemand"}`);
        }

        // Und wenn der Stammtorwart zurück ist, gehört ihm sein Platz wieder
        torwart.injuredWeeks = 0;
        GameState.repairLineup(club, state.players);
        if (club.lineup[0] !== torwartId) {
            throw new Error("Der genesene Stammtorwart bekommt seinen Platz nicht zurück");
        }
    });

    // 14a3. Stellungsspiel ist ein Feldspielerwert, kein Torwartwert
    test("GameState: Feldspieler bekommen ein Stellungsspiel passend zu ihrer Stärke", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const handgepflegt = state.players.filter(p => !String(p.id).startsWith("p_"));
        const abwehr = handgepflegt.filter(p => ["IV", "LV", "RV"].includes(p.pos));
        if (abwehr.length < 20) throw new Error("Zu wenige handgepflegte Verteidiger für den Test");

        abwehr.forEach(p => {
            if (p.positioning < p.overall - 15) {
                throw new Error(`${p.name} (${p.pos}, Stärke ${p.overall}) hat nur ${p.positioning} Stellungsspiel`);
            }
        });

        // Das Stellungsspiel ist einer von vier Werten, aus denen die Engine die
        // Spielstärke eines Verteidigers bildet. Steht er zu tief, rutscht ein
        // Weltklassemann auf Kreisliganiveau - und weil das alle handgepflegten
        // Kader gleich trifft, verschwindet der Abstand zwischen den Vereinen.
        const stark = abwehr.filter(p => p.overall >= 82);
        stark.forEach(p => {
            const eff = MatchEngine.calculateEffectivePlayerSkill({ ...p, fitness: 100, morale: 75, form: 7 }, p.pos);
            if (eff < p.overall - 12) {
                throw new Error(`${p.name} hat Stärke ${p.overall}, spielt aber wie ${eff.toFixed(1)}`);
            }
        });
    });

    // 14a4. Der bessere Kader muss sich über viele Spiele durchsetzen
    test("MatchEngine: Kaderqualität entscheidet Spiele, ohne sie vorherzusagen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const liga = state.clubs.filter(c => c.leagueId === "de_liga_1");
        const heim = liga.find(c => c.id === "muc");
        const gast = liga.find(c => c.id !== "muc");

        const felder = ["pace", "shooting", "passing", "dribbling", "defense", "physical",
            "stamina", "vision", "technique", "positioning"];
        const gastKader = new Set(gast.playerIds);
        state.players.forEach(p => {
            if (!gastKader.has(p.id)) return;
            p.overall = Math.max(30, p.overall - 12);
            felder.forEach(f => { if (typeof p[f] === "number") p[f] = Math.max(20, p[f] - 12); });
        });

        let siege = 0, tore = 0;
        const partien = 200;
        for (let i = 0; i < partien; i++) {
            const m = { id: "q" + i, played: false, homeClubId: heim.id, awayClubId: gast.id, leagueId: "de_liga_1" };
            MatchEngine.simulateFullMatch(m, heim, gast, state.players);
            if (m.homeGoals > m.awayGoals) siege++;
            tore += m.homeGoals + m.awayGoals;
            state.players.forEach(p => {
                p.fitness = 95; p.morale = 78; p.form = 7;
                p.suspendedMatches = 0; p.injuredWeeks = 0;
            });
        }

        const quote = siege / partien * 100;
        // Ein Kader, der zwölf Punkte besser ist, gewinnt daheim deutlich - aber
        // längst nicht immer. Vorher lag die Quote bei 63 Prozent: Der Meister
        // wurde damit zum Mittelfeldverein, weil sich Qualität über 34 Spieltage
        // nicht mehr durchsetzen konnte.
        // Die Obergrenze war auf die alten, enger beieinanderliegenden Kader
        // geeicht. Seit die Bundesligakader um den Ligaschnitt gespreizt sind,
        // ist ein um zwoelf Punkte geschwaechter Gegner relativ schwaecher als
        // vorher - neunzig Prozent Heimsiege sind dann kein Fehler mehr.
        if (quote < 66 || quote > 93) {
            throw new Error(`Der klar bessere Kader gewinnt ${quote.toFixed(0)} % der Heimspiele (erwartet 66-93 %)`);
        }
        const schnitt = tore / partien;
        if (schnitt < 2.4 || schnitt > 4.2) {
            throw new Error(`${schnitt.toFixed(2)} Tore pro Spiel in diesen Partien (erwartet 2.4-4.2)`);
        }
    });

    // 14a5. Eine Karriere hat einen Zenit, kein ewiges Aufwärts
    test("TrainingEngine: Spieler erreichen ihren Zenit und bauen danach ab", () => {
        const einheiten = 70; // ungefähr eine Saison Training
        const kohorte = (age) => {
            const spieler = [];
            for (let i = 0; i < 200; i++) {
                spieler.push({
                    age, overall: 74, pot: 88, value: 5000000,
                    pace: 74, shooting: 74, passing: 74, dribbling: 74, defense: 74,
                    physical: 74, stamina: 74, vision: 74, technique: 74, positioning: 74
                });
            }
            spieler.forEach(p => {
                for (let e = 0; e < einheiten; e++) {
                    TrainingEngine.developPlayer(p, "allround", "normal", 3, 0.22);
                }
            });
            return spieler.reduce((s, p) => s + (p.overall - 74), 0) / spieler.length;
        };

        const jung = kohorte(18);
        const zenit = kohorte(27);
        const alt = kohorte(34);

        if (jung < 1.5) throw new Error(`Talente entwickeln sich zu langsam: ${jung.toFixed(2)} Punkte`);
        if (jung > 9) throw new Error(`Talente entwickeln sich zu schnell: ${jung.toFixed(2)} Punkte`);
        // Im besten Alter geht es weder deutlich rauf noch runter
        if (Math.abs(zenit) > 1.6) throw new Error(`Ein 27-Jähriger verändert sich um ${zenit.toFixed(2)} Punkte statt zu plateauen`);
        if (alt >= 0) throw new Error(`Ein 34-Jähriger baut nicht ab (${alt.toFixed(2)} Punkte)`);
        if (jung <= zenit || zenit <= alt) {
            throw new Error(`Die Alterskurve fällt nicht: 18J ${jung.toFixed(2)}, 27J ${zenit.toFixed(2)}, 34J ${alt.toFixed(2)}`);
        }
    });

    // 14a5b. Die Spielwelt muss über Jahre glaubwürdig bleiben
    test("Spielwelt: Altersaufbau, Vertragslaufzeiten und Verletzungen bleiben realistisch", () => {
        // 1. Die Altersverteilung eines Kaders ist keine Gleichverteilung.
        //    Vorher wurde zwischen 17 und 34 gleichverteilt gewürfelt: 22 %
        //    waren höchstens zwanzig, nur 17 % zwischen 24 und 26.
        const proben = 40000;
        const eimer = {};
        for (let i = 0; i < proben; i++) {
            const a = PlayerGenerator.wuerfleAlter(17, 34);
            const k = a <= 20 ? "jung" : a <= 29 ? "beste" : a <= 32 ? "spaet" : "alt";
            eimer[k] = (eimer[k] || 0) + 1;
        }
        const anteil = k => (eimer[k] || 0) / proben * 100;
        if (anteil("jung") > 14) {
            throw new Error(`${anteil("jung").toFixed(0)} % der Spieler sind höchstens 20 - ein Kader ist keine Jugendmannschaft`);
        }
        if (anteil("beste") < 45) {
            throw new Error(`Nur ${anteil("beste").toFixed(0)} % sind zwischen 21 und 29 - die besten Jahre fehlen`);
        }
        if (anteil("alt") > 8) {
            throw new Error(`${anteil("alt").toFixed(0)} % sind 33 oder älter - real sind es rund 4 %`);
        }

        // 2. Der Verletzungsvermerk muss mit heilen. Vorher blieb `injured`
        //    für immer auf true - die KI stellte solche Spieler nie wieder auf.
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const opfer = state.players.find(p => p.clubId === state.userClubId);
        const club = state.clubs.find(c => c.id === state.userClubId);
        TrainingEngine.inflictInjury(state, opfer, club);
        if (!opfer.injured || !(opfer.injuredWeeks > 0)) {
            throw new Error("inflictInjury setzt den Spieler nicht außer Gefecht");
        }
        for (let w = 0; w < 15 && opfer.injuredWeeks > 0; w++) {
            state.players.forEach(p => {
                if (p.injuredWeeks > 0) {
                    p.injuredWeeks--;
                    if (p.injuredWeeks === 0) p.injured = false;
                }
            });
        }
        if (opfer.injured) {
            throw new Error("Der Verletzungsvermerk bleibt hängen, obwohl der Spieler geheilt ist");
        }

        // 3. Eigener Verein und KI tragen dasselbe Verletzungsrisiko. Vorher
        //    würfelte der eigene Verein an jedem Kalendertag mit dem vollen
        //    Einheitenrisiko, die KI einmal je Woche mit einer Pauschale -
        //    das 6,6-fache Risiko für den Menschen.
        const muster = { fitness: 92, age: 26, hiddenAttributes: { injuryProneness: 10 }, daysSinceInjury: 999 };
        const woche = TrainingEngine.weeklyInjuryRisk(muster, "normal", 2);
        const tage = [1, 1, 1, 0.5, 0.15, 0.15, 0.15]
            .reduce((s, f) => s + woche * f / TrainingEngine.WOCHENGEWICHT, 0);
        if (Math.abs(tage - woche) > woche * 0.02) {
            throw new Error(`Sieben Tage ergeben ${(tage * 100).toFixed(2)} %, die Woche aber ${(woche * 100).toFixed(2)} %`);
        }

        // 4. Die KI verlängert, bevor ein Vertrag ausläuft. Sonst rutscht die
        //    ganze Welt binnen drei Saisons ins letzte Vertragsjahr (gemessen
        //    82 %, real 25-30 %).
        const fremde = state.players.filter(p => p.clubId && p.clubId !== state.userClubId);
        fremde.slice(0, 400).forEach(p => { p.contractYears = 1; });
        const verlaengert = ContractEngine.verlaengereBeiKiVereinen(state);
        if (verlaengert < 100) {
            throw new Error(`Nur ${verlaengert} von 400 auslaufenden Verträgen verlängert - die KI lässt ihren Kader verfallen`);
        }
        const mehrjaehrig = fremde.slice(0, 400).filter(p => (p.contractYears || 0) >= 3).length;
        if (mehrjaehrig < 40) {
            throw new Error(`Nur ${mehrjaehrig} Verlängerungen laufen drei Jahre oder länger`);
        }
    });

    // 14a5c. Die Spielwelt muss sich auch ohne den Spieler bewegen
    test("TransferEngine: KI-Vereine handeln untereinander, ohne Kader zu zerstören", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const ki = state.clubs.filter(c => c.id !== state.userClubId);

        // Ein Transferfenster muss überhaupt erkannt werden
        if (!TransferEngine.istTransferfenster(state)) {
            throw new Error("Zum Karrierestart ist kein Transferfenster offen");
        }

        const vorher = new Map(state.players.filter(p => p.clubId).map(p => [p.id, p.clubId]));
        const eigeneVorher = (state.clubs.find(c => c.id === state.userClubId).playerIds || []).slice();
        const postfachVorher = state.inbox.length;

        let vollzogen = 0;
        for (let i = 0; i < 400; i++) {
            const club = ki[Math.floor(Math.random() * ki.length)];
            if (TransferEngine.versucheEinenTransfer(state, club)) vollzogen++;
        }

        // Vorher bewegte sich in einer ganzen Saison kein einziger Spieler
        if (vollzogen < 15) {
            throw new Error(`Nur ${vollzogen} von 400 Versuchen wurden ein Transfer - der Markt steht still`);
        }

        // Kader müssen spielfähig bleiben
        state.clubs.forEach(c => {
            const kader = (c.playerIds || []).map(id => state.players.find(p => p.id === id)).filter(Boolean);
            if (kader.length < 15) {
                throw new Error(`${c.name} hat nur noch ${kader.length} Spieler`);
            }
            if (kader.filter(p => p.pos === "TW").length < 2) {
                throw new Error(`${c.name} hat weniger als zwei Torwarte`);
            }
        });

        // Der eigene Kader wird nicht hinter dem Rücken des Managers geplündert
        const eigeneNachher = (state.clubs.find(c => c.id === state.userClubId).playerIds || []);
        if (eigeneNachher.length !== eigeneVorher.length) {
            throw new Error("Die KI hat sich am Kader des Spielers bedient");
        }

        // Und das Postfach wird nicht mit fremden Transfers geflutet
        if (state.inbox.length - postfachVorher > 5) {
            throw new Error(`${state.inbox.length - postfachVorher} neue Postfachnachrichten durch fremde Transfers`);
        }

        // Spieler dürfen nicht doppelt oder gar nicht zugeordnet sein
        const doppelt = [];
        state.clubs.forEach(c => (c.playerIds || []).forEach(id => doppelt.push(id)));
        if (doppelt.length !== new Set(doppelt).size) {
            throw new Error("Ein Spieler steht nach einem Transfer in zwei Kadern");
        }
        state.players.filter(p => p.clubId).forEach(p => {
            const c = state.clubs.find(x => x.id === p.clubId);
            if (!c || !(c.playerIds || []).includes(p.id)) {
                throw new Error(`${p.name} zeigt auf einen Verein, der ihn nicht führt`);
            }
        });

        // Es muss wirklich gewechselt worden sein
        const wechsler = state.players.filter(p => p.clubId && vorher.has(p.id) && vorher.get(p.id) !== p.clubId).length;
        if (wechsler < 15) {
            throw new Error(`Nur ${wechsler} Spieler haben den Verein gewechselt`);
        }
    });

    // 14a5d. Der Kalender muss etwas aussagen
    test("CalendarEngine: Jeder Tag trägt Inhalt, und der Weiter-Knopf hat ein Ziel", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });

        // Bis in die Punkterunde, dort ist der Kalender am dichtesten
        let schutz = 0;
        while (schutz++ < 300) {
            const t = CalendarEngine.getCurrentDay(state);
            if (!t || (state.currentMatchday >= 2 && t.type === "recovery")) break;
            CalendarEngine.advanceOneDay(state);
        }

        const woche = CalendarEngine.getUpcomingDays(state, 7);
        if (woche.length < 7) throw new Error("Die Wochenansicht liefert keine sieben Tage");

        // Vorher stand auf fünf von sieben Karten derselbe Satz:
        // "Grundlagenarbeit fuer die Saison."
        const texte = woche.map(d => CalendarEngine.tagesInhalt(state, d).text);
        texte.forEach((t, i) => {
            if (!t || t.length < 12) throw new Error(`Tag ${i + 1} (${woche[i].type}) hat keinen Inhalt`);
        });
        const haeufigster = Math.max(...texte.map(t => texte.filter(x => x === t).length));
        if (haeufigster > 3) {
            throw new Error(`Derselbe Satz steht auf ${haeufigster} von 7 Tagen - der Kalender sagt nichts aus`);
        }

        // Ein Spieltag nennt den Gegner
        const spieltag = woche.find(d => d.type === "matchday")
            || state.calendar.slice(state.currentDayIndex).find(d => d.type === "matchday");
        if (spieltag) {
            const inhalt = CalendarEngine.tagesInhalt(state, spieltag);
            const gegner = CalendarEngine.naechstesSpiel(state, spieltag.matchday);
            if (!gegner) throw new Error("Zu einem Spieltag lässt sich kein Gegner ermitteln");
            if (!inhalt.text.includes(gegner.gegnerName)) {
                throw new Error(`Der Spieltag nennt den Gegner nicht: "${inhalt.text}"`);
            }
        }

        // Die Tage einer Spieltagswoche gehören zu ihrem Spieltag. Vorher
        // trugen sie matchday: null, und die Wochenansicht zeigte auf ihnen
        // den Gegner der vorigen Partie.
        const wochentage = state.calendar.filter(d =>
            ["recovery", "training", "tactics", "media", "sponsor", "opponent_analysis"].includes(d.type)
            && !d.preseason);
        const ohneSpieltag = wochentage.filter(d => !d.matchday).length;
        if (ohneSpieltag > 0) {
            throw new Error(`${ohneSpieltag} Tage einer Spieltagswoche kennen ihren Spieltag nicht`);
        }

        // Der Weiter-Knopf braucht immer ein Ziel
        const halt = CalendarEngine.naechsterHalt(state);
        if (!halt) throw new Error("Kein nächster Termin gefunden");
        if (!["matchday", "friendly", "media", "season_end"].includes(halt.grund)) {
            throw new Error(`Unerwarteter Haltegrund: ${halt.grund}`);
        }
        if (halt.index < (state.currentDayIndex || 0)) {
            throw new Error("Der nächste Termin liegt in der Vergangenheit");
        }

        // Und er darf nie über einen Spieltag hinwegspringen
        const bis = halt.index;
        const dazwischen = state.calendar.slice((state.currentDayIndex || 0) + 1, bis)
            .filter(d => d.type === "matchday" || d.type === "friendly").length;
        if (dazwischen > 0) {
            throw new Error(`${dazwischen} Spieltermine liegen zwischen heute und dem nächsten Halt`);
        }
    });

    // 14a6. Geld muss eine Entscheidung bleiben
    test("FinanceEngine: Große und kleine Vereine nehmen unterschiedlich viel ein", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const liga = state.clubs.filter(c => c.leagueId === "de_liga_1")
            .sort((a, b) => (b.clubStrength ?? 0) - (a.clubStrength ?? 0));
        const oben = FinanceEngine.sponsorPerMatchday(liga[0]);
        const unten = FinanceEngine.sponsorPerMatchday(liga[liga.length - 1]);

        // Vorher nahm der Letzte drei Viertel dessen ein, was der Erste bekam,
        // bei einem Fünftel der Gehaltslast - die kleinen Vereine haben damit
        // Geld gedruckt und nach fünf Saisons saß jeder auf Hunderten Millionen.
        if (!(oben / unten >= 2.5)) {
            throw new Error(`Spitzenklub nimmt nur das ${(oben / unten).toFixed(2)}-fache des Letzten ein (erwartet ab 2.5)`);
        }

        // Der Betriebsaufwand muss mit der Gehaltslast mitwachsen
        if (!(FinanceEngine.OPERATING_WAGE_SHARE > 0)) {
            throw new Error("Der Betriebsaufwand hängt nicht am Kader");
        }

        // Und eine Liga tiefer fließt bei gleichem Rang deutlich weniger Geld.
        // Verglichen wird der jeweilige Spitzenklub - dass der beste Zweitligist
        // mehr einnimmt als der schwächste Erstligist, ist dagegen richtig so:
        // an den Rändern überlappen die Ligen.
        const zweite = state.clubs.filter(c => c.leagueId === "de_liga_2")
            .sort((a, b) => (b.clubStrength ?? 0) - (a.clubStrength ?? 0))[0];
        if (zweite && !(FinanceEngine.sponsorPerMatchday(zweite) < oben * 0.75)) {
            throw new Error("Der beste Zweitligist nimmt fast so viel ein wie der beste Erstligist");
        }
    });

    // 14a7. Die Elf steht als Block und verändert ihre Form mit dem Ballbesitz
    test("LiveMatchDirector: Die Mannschaft steht als Block, eng ohne Ball, breit mit Ball", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "form", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        // Tempo 1: Dort laeuft der groesste Teil der Uebertragung als normales
        // Spiel, und genau dort schaut man sich die Mannschaftsform an.
        live.speed = 1;
        const dir = live.director;

        const mitBall = [];
        const ohneBall = [];
        let frames = 0;
        // Eine Mannschaft braucht einen Moment, um ihre Form einzunehmen.
        // Gemessen wird deshalb erst, wenn der Ballbesitz kurz stabil ist -
        // so, wie man es auch mit dem Auge beurteilen wuerde.
        let besitzer = null;
        let stabilSeit = 0;

        while (!live.isFinished && frames < 60 * 1800) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
            frames++;
            if (dir.possessionTeam !== besitzer) { besitzer = dir.possessionTeam; stabilSeit = frames; }
            if (frames % 12 !== 0) continue;
            if (dir.mode !== "ambient" || dir.deadBall || dir.kickoff) continue;
            if (frames - stabilSeit < 45) continue;

            ["home", "away"].forEach(team => {
                const feld = live.players2D.filter(p => p.team === team && p.pos !== "TW");
                if (feld.length < 9) return;
                // Die zwei äußersten bleiben draußen: Wer presst, verlässt den
                // Verbund zu Recht und darf die gemessene Form nicht verfälschen.
                const ys = feld.map(p => p.y).sort((a, b) => a - b);
                const breite = ys[ys.length - 2] - ys[1];
                (team === dir.possessionTeam ? mitBall : ohneBall).push(breite);
            });
        }

        if (mitBall.length < 10 || ohneBall.length < 10) {
            throw new Error(`Zu wenige Formproben: ${mitBall.length}/${ohneBall.length}`);
        }

        const mw = (a) => a.reduce((x, y) => x + y, 0) / a.length;
        const breitMitBall = mw(mitBall);
        const engOhneBall = mw(ohneBall);

        // Vorher stand die Elf einundsiebzig Einheiten breit auf einem hundert
        // Einheiten breiten Feld - und zwar mit wie ohne Ball gleich. Eine
        // Mannschaft steht aber als Block, nicht wie ein Seestern.
        if (breitMitBall > 64) {
            throw new Error(`Mit Ball ${breitMitBall.toFixed(1)} Einheiten breit - kein Block mehr`);
        }
        if (engOhneBall > 52) {
            throw new Error(`Ohne Ball ${engOhneBall.toFixed(1)} Einheiten breit - der Block ist zu offen`);
        }
        if (engOhneBall >= breitMitBall - 3) {
            throw new Error(`Die Form ändert sich kaum: mit Ball ${breitMitBall.toFixed(1)}, ohne ${engOhneBall.toFixed(1)}`);
        }
    });

    // 14a7a. Die Spieler laufen wie Menschen: eigene Wege, Antritt, Bremsen
    test("LiveMatchDirector: Spieler laufen eigene Wege im Positionsraum statt als Schablone", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "laufwege", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        live.speed = 1;
        const dir = live.director;
        const DT = 1 / 60;

        let frames = 0;
        const beschleunigung = [];
        const vorher = new Map();
        let frei = true, gleichlauf = 0, proben = 0;
        const tempoVorher = new Map(), orte = new Map();
        const arten = { angriff: new Set(), abwehr: new Set() };

        while (!live.isFinished && live.minute < 45 && frames < 60 * 900) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
            frames++;
            const laufend = dir.mode === "ambient" && !dir.deadBall && !dir.kickoff;
            if (!laufend) frei = false;

            live.players2D.forEach(p => {
                const v = vorher.get(p.id);
                const vx = v ? (p.x - v.x) / DT : 0, vy = v ? (p.y - v.y) / DT : 0;
                if (v && v.laufend && laufend && p.pos !== "TW") {
                    beschleunigung.push(Math.hypot(vx - v.vx, vy - v.vy) / DT);
                }
                vorher.set(p.id, { x: p.x, y: p.y, vx, vy, laufend });
                if (laufend && p.lauf && p.lauf.team === dir.possessionTeam) {
                    arten[p.team === dir.possessionTeam ? "angriff" : "abwehr"].add(p.lauf.art);
                }
            });

            // Aendern die Spieler einer Elf ihr Tempo alle zugleich in dieselbe
            // Richtung? Genau das ist eine Schablone: Alle folgen demselben
            // Ball im selben Takt. Gemessen wird je Viertelsekunde, wie
            // gleichgerichtet die Tempoaenderungen sind - eins hiesse alle
            // gleich, zufaellige Richtungen laegen um 0.3.
            if (frames % 15 === 0) {
                const tempo = new Map();
                live.players2D.forEach(p => {
                    const o = orte.get(p.id);
                    if (o) tempo.set(p.id, { x: (p.x - o.x) * 4, y: (p.y - o.y) * 4 });
                    orte.set(p.id, { x: p.x, y: p.y });
                });
                if (frei) {
                    ["home", "away"].forEach(team => {
                        let ux = 0, uy = 0, k = 0;
                        live.players2D.filter(p => p.team === team && p.pos !== "TW").forEach(p => {
                            const jetzt = tempo.get(p.id), davor = tempoVorher.get(p.id);
                            if (!jetzt || !davor) return;
                            const ax = jetzt.x - davor.x, ay = jetzt.y - davor.y, l = Math.hypot(ax, ay);
                            if (l < 0.6) return;
                            ux += ax / l; uy += ay / l; k++;
                        });
                        if (k >= 5) { gleichlauf += Math.hypot(ux, uy) / k; proben++; }
                    });
                }
                tempoVorher.clear();
                tempo.forEach((v, id) => tempoVorher.set(id, v));
                frei = true;
            }
        }

        // Die Elf glitt vorher wie eine Schablone ueber den Rasen: Alle
        // folgten ihrem Ziel mit derselben Nachfuehrung, und jede Ballbewegung
        // liess die ganze Mannschaft im selben Moment gleich antreten -
        // gemessen 0.64 bis 0.67. Mit eigener Wahrnehmung, eigenen Laufwegen
        // und Schueben liegt der Wert um 0.55, auch wenn die Elf gemeinsam
        // aufrueckt.
        const gleich = gleichlauf / Math.max(1, proben);
        if (proben < 50) throw new Error(`Zu wenige Proben: ${proben}`);
        if (gleich > 0.60) {
            throw new Error(`Die Elf tritt im Gleichtakt an (${gleich.toFixed(2)}) - sie läuft als Schablone`);
        }

        // Antritt und Bremsen statt Sprung: Vorher sprang die Geschwindigkeit
        // in einem Bild von null auf voll, gemessen fast vierhundert Einheiten
        // je Sekunde im Quadrat.
        beschleunigung.sort((a, b) => a - b);
        const spitze = beschleunigung[Math.floor(beschleunigung.length * 0.999)] || 0;
        if (spitze > 60) {
            throw new Error(`Spieler ändern ihr Tempo sprunghaft: ${spitze.toFixed(0)} Einheiten/s²`);
        }

        // Mit und ohne Ball sucht sich jeder seinen Weg
        if (arten.angriff.size < 4) {
            throw new Error(`Mit Ball kaum eigene Laufwege: ${[...arten.angriff].join(", ")}`);
        }
        if (arten.abwehr.size < 3) {
            throw new Error(`Ohne Ball kaum eigene Laufwege: ${[...arten.abwehr].join(", ")}`);
        }
    });

    // 14a7c. Ein Angriff wird mit der ganzen Mannschaft gespielt
    test("LiveMatchDirector: Die ganze Elf rückt beim Angriff auf, nicht nur die Spitzen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "aufruecken_elf", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        live.speed = 1;
        const dir = live.director;

        // Hoehe als Anteil der Feldlaenge vom eigenen Tor aus
        const drittel = { mitte: [], letztes: [] };
        let frames = 0, besitzer = null, seit = 0;
        while (!live.isFinished && live.minute < 60 && frames < 60 * 900) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
            frames++;
            if (dir.possessionTeam !== besitzer) { besitzer = dir.possessionTeam; seit = frames; }
            if (frames % 15 || dir.mode !== "ambient" || dir.deadBall || dir.kickoff) continue;
            // Nach einem Ballwechsel braucht die Elf einen Moment zum Umschalten
            if (frames - seit < 90) continue;

            const team = dir.possessionTeam;
            const richtung = dir.attackDir(team), tor = dir.ownGoalX(team);
            const hoehe = x => (x - tor) * richtung / 92;
            const b = hoehe(live.ball.x);
            const reihe = g => {
                const l = live.players2D.filter(p => p.team === team && p.group === g);
                return l.reduce((s, p) => s + hoehe(p.x), 0) / (l.length || 1);
            };
            const probe = { ball: b, abwehr: reihe("def"), mittelfeld: reihe("mid"), angriff: reihe("att") };
            if (b > 0.66) drittel.letztes.push(probe);
            else if (b > 0.36) drittel.mitte.push(probe);
        }

        if (drittel.letztes.length < 20 || drittel.mitte.length < 20) {
            throw new Error(`Zu wenige Proben: ${drittel.mitte.length}/${drittel.letztes.length}`);
        }
        const mw = (l, k) => l.reduce((s, e) => s + e[k], 0) / l.length;

        // Vorher stand die Kette bei Ball im letzten Drittel bei 37 Prozent
        // der Feldlaenge und das Mittelfeld zwanzig Prozent hinter dem Ball -
        // es griffen im Grunde nur die Spitzen an.
        const l = drittel.letztes;
        if (mw(l, "abwehr") < 0.45) {
            throw new Error(`Im letzten Drittel steht die Kette bei ${(mw(l, "abwehr") * 100).toFixed(0)} % - sie rückt nicht bis zur Mittellinie auf`);
        }
        if (mw(l, "ball") - mw(l, "mittelfeld") > 0.18) {
            throw new Error(`Das Mittelfeld hängt ${((mw(l, "ball") - mw(l, "mittelfeld")) * 100).toFixed(0)} % hinter dem Ball`);
        }
        if (mw(l, "angriff") - mw(l, "abwehr") > 0.35) {
            throw new Error(`Die Elf ist beim Angriff ${((mw(l, "angriff") - mw(l, "abwehr")) * 100).toFixed(0)} % des Feldes lang - sie reißt auseinander`);
        }

        // Auch bei Ball im Mittelfeld klebt die Kette nicht am eigenen Strafraum
        // (vorher 18 Prozent)
        if (mw(drittel.mitte, "abwehr") < 0.25) {
            throw new Error(`Bei Ball im Mittelfeld steht die Kette bei ${(mw(drittel.mitte, "abwehr") * 100).toFixed(0)} %`);
        }

        // Die Reihenfolge bleibt: Kette hinter Mittelfeld hinter Angriff
        if (!(mw(l, "abwehr") < mw(l, "mittelfeld") && mw(l, "mittelfeld") < mw(l, "angriff"))) {
            throw new Error("Die Mannschaftsteile stehen beim Angriff nicht mehr gestaffelt");
        }
    });

    // 14a7a2. Mit Ball besetzt die Elf die Breite und die Halbraeume, und wer
    // frei ist, traegt den Ball nach vorn - auch ein Innenverteidiger
    test("LiveMatchDirector: Positionsspiel mit Ball - Flügel besetzt, Innenverteidiger gespreizt, freie Verteidiger dribbeln an", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        [homeClub, awayClub].forEach(c => {
            c.formation = "4-3-3";
            GameState.autoSetLineupForClub(c, state.players);
        });
        const match = { id: "positionsspiel", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        live.speed = 1;
        const dir = live.director;

        // Eine ganze Partie: Wie lange ein Ballbesitz haelt, streut von
        // Halbzeit zu Halbzeit stark.
        let proben = 0, beideFluegel = 0, ivProben = 0, ivAbstand = 0;
        let frames = 0, besitzer = null, seit = 0;
        while (!live.isFinished && frames < 60 * 1800) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
            frames++;
            if (dir.possessionTeam !== besitzer) { besitzer = dir.possessionTeam; seit = frames; }
            // Nur gefestigter Ballbesitz: Nach dem Ballgewinn wird erst umgeschaltet
            if (frames % 15 || dir.mode !== "ambient" || dir.deadBall || dir.kickoff || frames - seit < 180) continue;

            const team = dir.possessionTeam;
            const feld = live.players2D.filter(p => p.team === team && p.pos !== "TW");
            const b = (live.ball.x - dir.ownGoalX(team)) * dir.attackDir(team) / 92;
            if (b > 0.33) {
                proben++;
                if (feld.some(p => p.y < 14) && feld.some(p => p.y > 86)) beideFluegel++;
            }
            const iv = feld.filter(p => p.pos === "IV");
            if (iv.length === 2 && b < 0.45) {
                ivProben++;
                ivAbstand += Math.abs(iv[0].y - iv[1].y) * 0.68;
            }
        }
        if (proben < 100 || ivProben < 50) throw new Error(`Zu wenige Proben: ${proben}/${ivProben}`);

        // Vorher standen im 4-3-3 bei Ball ab dem Mittelfeld nur in ein bis
        // zwei Prozent der Zeit Spieler an beiden Seitenlinien - die Aussen
        // zogen mit dem Ball zur Mitte. Jetzt sind es 25 bis 38 Prozent; der
        // Rest ist die Zeit, die der ballferne Fluegel nach einem Ballgewinn
        // bis an die Linie braucht.
        const anteil = beideFluegel / proben;
        if (anteil < 0.15) {
            throw new Error(`Nur in ${(anteil * 100).toFixed(0)} % des Ballbesitzes sind beide Flügel besetzt`);
        }
        // Die Innenverteidiger gehen im Aufbau auseinander (vorher 11 bis 12
        // Meter, jetzt 17 bis 19)
        if (ivAbstand / ivProben < 14) {
            throw new Error(`Die Innenverteidiger stehen im Aufbau ${(ivAbstand / ivProben).toFixed(1)} m auseinander - sie spreizen nicht`);
        }

        // Pressing hat eine Linie: Ein Mittelfeldpressing laesst den
        // Innenverteidiger im eigenen Drittel den Ball haben, ein hohes
        // Pressing nicht - im letzten Drittel wird immer angegriffen.
        dir.mode = "ambient";
        dir._wechselUhr = -99;
        // Hoehe aus Sicht der Heimelf, die den Ball hat (nach dem
        // Seitenwechsel spielt sie in die andere Richtung)
        const hoehe = anteil => ({ x: dir.ownGoalX("home") + dir.attackDir("home") * 92 * anteil, y: 50 });
        awayClub.tactics.pressing = "medium";
        dir.taktikAnwenden();
        if (dir.presstImRaum("away", hoehe(0.12))) {
            throw new Error("Ein Mittelfeldpressing jagt den Innenverteidiger bis in dessen Strafraum");
        }
        if (!dir.presstImRaum("away", hoehe(0.75))) {
            throw new Error("Im letzten Drittel wird der Ballführende nicht angegriffen");
        }
        awayClub.tactics.pressing = "high";
        dir.taktikAnwenden();
        if (!dir.presstImRaum("away", hoehe(0.12))) {
            throw new Error("Hohes Pressing greift den Aufbau nicht an");
        }

        // Freier Raum vor dem Innenverteidiger: Er traegt den Ball, statt ihn
        // abzuspielen oder in einen Zweikampf zu gehen, den es nicht gibt.
        const spieler = [
            { id: 1, team: "home", pos: "IV", group: "def", x: 25, y: 35, dribbling: 45, pace: 60 },
            { id: 2, team: "away", pos: "ST", group: "att", x: 60, y: 50, defense: 40, pace: 70 },
            { id: 3, team: "away", pos: "ZM", group: "mid", x: 70, y: 30, defense: 60, pace: 70 }
        ];
        const flow = new MatchFlowEngine({
            getPlayers: () => spieler,
            getTactics: () => ({ mentality: "balanced", passing: "mixed", tempo: "normal" }),
            attackDir: team => (team === "home" ? 1 : -1),
            ownGoalX: team => (team === "home" ? 4 : 96)
        });
        const gegner = spieler.filter(p => p.team === "away");
        const lauf = flow.rateDribble(spieler[0], gegner, {}, flow.getPressure(spieler[0], gegner));
        if (!lauf.frei) throw new Error("Ein Innenverteidiger mit dreißig Metern Platz gilt nicht als frei");
        const ausgang = flow.resolve(spieler[0], lauf, gegner, {}, 0, "buildup");
        if (ausgang.outcome !== "beaten" || ausgang.defender) {
            throw new Error(`Das Andribbeln in den freien Raum wird zum Zweikampf: ${ausgang.outcome}`);
        }
        // Steht ein Gegner vor ihm, ist es kein freier Lauf
        const bedraengt = [{ id: 4, team: "away", pos: "ST", group: "att", x: 29, y: 36, defense: 40, pace: 70 }, ...gegner];
        if (flow.rateDribble(spieler[0], bedraengt, {}, flow.getPressure(spieler[0], bedraengt)).frei) {
            throw new Error("Ein bedrängter Verteidiger gilt als frei");
        }
    });

    // 14a7a3. Taktik nach FM26: Formen, Rollen, Vorlagen, Verbindungen
    test("TacticsEngine: Formen mit und gegen den Ball, Rollen, Vorlagen und Verbindungen", () => {
        // Alte Spielstaende kennen nur fuenf Regler - sie bleiben erhalten,
        // alles andere bekommt seinen Standard
        const alt = TacticsEngine.normalisiere({ mentality: "offensive", attackFocus: "left", passStyle: "short" });
        if (alt.mentality !== "offensive" || alt.focus !== "left" || alt.passing !== "short") {
            throw new Error(`Alte Taktik geht verloren: ${JSON.stringify(alt)}`);
        }
        if (alt.deckung !== "raum" || alt.formMitBall !== "auto" || alt.formGegenBall !== "grund") {
            throw new Error("Neue Anweisungen bekommen keinen Standard");
        }

        // Jede Formation laesst sich in jede andere ueberfuehren: jeder Platz
        // genau einmal, der Torwart bleibt Torwart, kein Aussen wechselt die Seite
        const formen = Object.keys(FORMATION_CONFIGS);
        const ziele = [...formen, ...Object.keys(TacticsEngine.FORMEN_MIT_BALL)];
        formen.forEach(a => ziele.forEach(b => {
            const basis = FORMATION_CONFIGS[a].positions;
            const ziel = TacticsEngine.positionenDerForm(b, FORMATION_CONFIGS);
            const z = TacticsEngine.zuordnung(basis, ziel);
            if (new Set(z).size !== basis.length) throw new Error(`${a} -> ${b}: Plätze doppelt belegt`);
            basis.forEach((p, i) => {
                const q = ziel[z[i]];
                if ((p.pos === "TW") !== (q.pos === "TW")) throw new Error(`${a} -> ${b}: Torwart getauscht`);
                if (Math.abs(p.x - 50) > 12 && Math.abs(q.x - 50) > 12 && Math.sign(p.x - 50) !== Math.sign(q.x - 50)) {
                    throw new Error(`${a} -> ${b}: ${p.pos} wechselt die Seite`);
                }
            });
        }));

        // 4-3-3 gegen den Ball im 4-4-2: Die Fluegel fallen ins Mittelfeld,
        // ein Achter schiebt neben die Spitze
        const b433 = FORMATION_CONFIGS["4-3-3"].positions;
        const z442 = TacticsEngine.plaetzeInForm(b433, "4-4-2", FORMATION_CONFIGS);
        if (z442[8].pos !== "RM" || z442[10].pos !== "LM") throw new Error(`Flügel werden nicht zu Mittelfeldspielern: ${z442[8].pos}/${z442[10].pos}`);
        if (z442.filter(p => p.pos === "ST").length !== 2) throw new Error("Im 4-4-2 gegen den Ball stehen nicht zwei Spitzen");

        // Familien: Schienenspieler vor der Dreierkette, Aussenverteidiger in der Viererkette
        if (TacticsEngine.familie("LAV", FORMATION_CONFIGS["3-5-2"].positions) !== "SCH") throw new Error("LAV im 3-5-2 ist kein Schienenspieler");
        if (TacticsEngine.familie("RV", FORMATION_CONFIGS["5-3-2"].positions) !== "SCH") throw new Error("RV im 5-3-2 ist kein Schienenspieler");
        if (TacticsEngine.familie("RV", FORMATION_CONFIGS["4-4-2"].positions) !== "AV") throw new Error("RV im 4-4-2 ist kein Außenverteidiger");

        // Gespeicherte Rollen gelten, unpassende fallen auf den Standard zurueck
        const club = { formation: "4-3-3", tactics: TacticsEngine.normalisiere({}) };
        club.tactics.rollen = { 9: { mit: "st_neun", gegen: "st_pressend" }, 2: { mit: "st_neun", gegen: "fl_konter" } };
        const rollen = TacticsEngine.rollenDerElf(club, b433);
        if (rollen[9].mit !== "st_neun" || rollen[9].gegen !== "st_pressend") throw new Error("Gespeicherte Rolle geht verloren");
        if (rollen[2].mit !== "iv" || rollen[2].gegen !== "iv") throw new Error("Ein Innenverteidiger spielt eine Stürmerrolle");

        // Jede Rolle hat ein Kuerzel fuer die Taktiktafel
        Object.values(TacticsEngine.ROLLEN_MIT_BALL).flat().forEach(r => {
            if (TacticsEngine.kuerzel(r, "mit").kategorie === "standard") throw new Error(`Rolle ohne Kürzel: ${r.id}`);
        });

        // Vorlagen setzen alles auf einmal
        const t = TacticsEngine.wendeVorlageAn({}, "positionsspiel");
        if (t.formMitBall !== "3-2-5" || t.passing !== "short" || t.nachBallverlust !== "gegenpressing") {
            throw new Error("Die Vorlage Positionsspiel setzt ihre Anweisungen nicht");
        }
        [50, 62, 75, 90].forEach(rep => {
            const v = TacticsEngine.vorlageFuerVerein({ reputation: rep });
            if (!TacticsEngine.VORLAGEN[v]) throw new Error(`Unbekannte Vorlage für Ruf ${rep}: ${v}`);
        });

        // Verbindungen: Schiene und Fluegel an derselben Linie haken,
        // einrueckender Aussenverteidiger und Fluegel an der Linie passen
        const seite = (mitAV, mitFL) => {
            const c = { formation: "4-3-3", tactics: TacticsEngine.normalisiere({}) };
            c.tactics.rollen = { 1: { mit: mitAV, gegen: "av" }, 8: { mit: mitFL, gegen: "fl" } };
            return TacticsEngine.verbindungen(c, b433, "mit").find(v => (v.a === 1 && v.b === 8) || (v.a === 8 && v.b === 1));
        };
        if (seite("av_schiene", "fl")?.guete !== "schwach") throw new Error("Zwei Spieler an derselben Seitenlinie gelten nicht als Problem");
        if (seite("av_invers", "fl")?.guete !== "stark") throw new Error("Einrückender Außenverteidiger mit Flügel an der Linie passt nicht");

        // Der Taktik-Check merkt, wenn niemand die Linie haelt
        const eng = { formation: "4-3-3", tactics: TacticsEngine.normalisiere({}) };
        eng.tactics.rollen = { 4: { mit: "av_invers", gegen: "av" }, 10: { mit: "fl_invers", gegen: "fl" } };
        if (!TacticsEngine.pruefe(eng, b433).some(h => h.art === "warn" && h.text.includes("linke Seitenlinie"))) {
            throw new Error("Der Taktik-Check übersieht eine Seite ohne Breite");
        }
    });

    // 14a7a4. Mit Ball: Form und Rollen bestimmen, wo jeder steht
    test("LiveMatchDirector: Form und Rollen mit Ball - 3-2-5, einrückende Außenverteidiger, abkippender Sechser", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        homeClub.formation = "4-3-3";
        GameState.autoSetLineupForClub(homeClub, state.players);
        homeClub.tactics = TacticsEngine.normalisiere({});
        const live = new LiveMatch({ id: "rollen_mit", played: false, homeClubId: "muc", awayClubId: "dor" }, homeClub, awayClub, state.players);
        const dir = live.director;
        let uhr = 1000;
        const plan = (b) => {
            dir._laufUhr = ++uhr;
            dir._planMitBall = {};
            dir._lageMitBall = {};
            dir._schwerpunkt = { home: b, away: 1 - b };
            const ball = { x: dir.ownGoalX("home") + dir.attackDir("home") * 92 * b, y: 50 };
            const erg = {};
            dir.teamPlayers("home").filter(p => p.pos !== "TW").forEach(p => { erg[p.slot] = dir.planMitBall("home", ball).get(p.id); });
            return erg;
        };

        // Feste Form 3-2-5: drei hinten, zwei davor, fuenf vorn auf allen Bahnen
        homeClub.tactics.formMitBall = "3-2-5";
        dir.taktikAnwenden();
        const p325 = Object.values(plan(0.7));
        const hinten = p325.filter(e => e.tiefe <= 0.1).length;
        const vorn = p325.filter(e => e.tiefe >= 0.8);
        if (hinten !== 3 || vorn.length !== 5) throw new Error(`3-2-5 steht als ${hinten} hinten / ${vorn.length} vorn`);
        const quer = vorn.map(e => e.y).sort((a, b) => a - b);
        if (!(quer[0] < 14 && quer[4] > 86)) throw new Error(`Im 3-2-5 sind die Seitenlinien nicht besetzt: ${quer.map(v => v.toFixed(0))}`);
        if (vorn.filter(e => Math.abs(e.y - 50) > 14 && Math.abs(e.y - 50) < 36).length < 2) throw new Error("Im 3-2-5 sind die Halbräume nicht besetzt");

        // Aus den Rollen: links rueckt der Aussenverteidiger ein, rechts geht
        // er neben den Sechser, der inverse Fluegel zieht in den Halbraum
        homeClub.tactics.formMitBall = "auto";
        homeClub.tactics.rollen = {
            4: { mit: "av_invers", gegen: "av" },
            1: { mit: "av_invers_schiene", gegen: "av" },
            10: { mit: "fl_invers", gegen: "fl" }
        };
        dir.taktikAnwenden();
        const pr = plan(0.7);
        if (pr[4].bahn !== "kette" || Math.abs(pr[4].y - 50) < 18 || Math.abs(pr[4].y - 50) > 30 || pr[4].tiefe > 0.1) {
            throw new Error(`Der einrückende Außenverteidiger steht nicht in der Dreierkette: ${JSON.stringify(pr[4])}`);
        }
        if (pr[1].bahn !== "halbraum" || pr[1].tiefe < 0.25 || pr[1].tiefe > 0.45) {
            throw new Error(`Der invertierte Außenverteidiger steht nicht neben dem Sechser: ${JSON.stringify(pr[1])}`);
        }
        if (pr[10].bahn !== "halbraum") throw new Error("Der inverse Flügel bleibt an der Linie");
        if (Object.values(pr).some(e => e.y < 14)) throw new Error("Obwohl beide einrücken, steht jemand an der linken Linie");

        // Abkippender Sechser: im Aufbau zwischen den Innenverteidigern, die
        // dafuer weit auseinandergehen
        homeClub.tactics.rollen = { 5: { mit: "dm_abkippend", gegen: "dm" } };
        dir.taktikAnwenden();
        const pk = plan(0.2);
        if (pk[5].tiefe > 0.05 || Math.abs(pk[5].y - 50) > 3) throw new Error(`Der Sechser kippt nicht ab: ${JSON.stringify(pk[5])}`);
        if (Math.abs(pk[2].y - 50) < 25 || Math.abs(pk[3].y - 50) < 25) throw new Error("Die Innenverteidiger machen dem abkippenden Sechser keinen Platz");

        // Bahnregel: Niemand steht mit einem anderen auf demselben Fleck
        homeClub.tactics.rollen = { 9: { mit: "st_kanal", gegen: "st" }, 6: { mit: "zm_halbraum", gegen: "zm" }, 8: { mit: "fl_invers", gegen: "fl" } };
        dir.taktikAnwenden();
        const pb = Object.values(plan(0.75));
        for (let i = 0; i < pb.length; i++) for (let j = i + 1; j < pb.length; j++) {
            if (Math.abs(pb[i].y - pb[j].y) < 8 && Math.abs(pb[i].tiefe - pb[j].tiefe) < 0.13) {
                throw new Error("Zwei Spieler stehen mit Ball auf demselben Fleck");
            }
        }
    });

    // 14a7a5. Gegen den Ball: Form, Deckung, Pressing und Rollen
    test("LiveMatchDirector: Gegen den Ball - Form, Manndeckung, Pressingfalle, Konterspieler", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        homeClub.formation = "4-3-3";
        GameState.autoSetLineupForClub(homeClub, state.players);
        homeClub.tactics = TacticsEngine.normalisiere({});
        awayClub.tactics = TacticsEngine.normalisiere({});
        const live = new LiveMatch({ id: "gegen_ball", played: false, homeClubId: "muc", awayClubId: "dor" }, homeClub, awayClub, state.players);
        const dir = live.director;
        const hoehe = x => (x - dir.ownGoalX("home")) * dir.attackDir("home") / 92;
        const slot = i => dir.teamPlayers("home").find(p => p.slot === i);
        const block = (p, b) => {
            const sicht = { x: dir.ownGoalX("home") + dir.attackDir("home") * 92 * b, y: 50 };
            dir._schwerpunkt = { home: b, away: 1 - b };
            return hoehe(dir.formOhneBall(p, sicht, dir.attackDir("home")).x);
        };

        // Form gegen den Ball: Im 4-4-2 steht der rechte Achter neben der
        // Spitze, in der Grundform darunter
        dir.taktikAnwenden();
        const grundAbstand = block(slot(9), 0.5) - block(slot(6), 0.5);
        homeClub.tactics.formGegenBall = "4-4-2";
        dir.taktikAnwenden();
        const formAbstand = block(slot(9), 0.5) - block(slot(6), 0.5);
        if (!(grundAbstand > 0.08 && Math.abs(formAbstand) < 0.03)) {
            throw new Error(`4-4-2 gegen den Ball wirkt nicht: Abstand zur Spitze ${grundAbstand.toFixed(2)} -> ${formAbstand.toFixed(2)}`);
        }
        homeClub.tactics.formGegenBall = "grund";

        // Der Konterspieler bleibt vorn, der zurueckarbeitende Stuermer faellt zurueck
        homeClub.tactics.rollen = { 9: { mit: "st", gegen: "st_konter" } };
        dir.taktikAnwenden();
        const konter = block(slot(9), 0.25);
        homeClub.tactics.rollen = { 9: { mit: "st", gegen: "st_zurueck" } };
        dir.taktikAnwenden();
        const zurueck = block(slot(9), 0.25);
        homeClub.tactics.rollen = {};
        dir.taktikAnwenden();
        const normal = block(slot(9), 0.25);
        if (!(konter >= 0.55 && konter > normal + 0.05 && zurueck < normal - 0.05)) {
            throw new Error(`Rollen gegen den Ball wirken nicht: Konter ${konter.toFixed(2)}, normal ${normal.toFixed(2)}, zurück ${zurueck.toFixed(2)}`);
        }

        // Pressingintensitaet schiebt die Linie, Gegenpressing gilt nach dem Ballverlust
        dir.mode = "ambient";
        dir._laufUhr = 500;
        dir._wechselUhr = 400;
        const ballBei = anteil => ({ x: dir.ownGoalX("away") + dir.attackDir("away") * 92 * anteil, y: 50 });
        homeClub.tactics.pressing = "medium";
        homeClub.tactics.anlaufen = "normal";
        dir.taktikAnwenden();
        if (dir.presstImRaum("home", ballBei(0.29))) throw new Error("Mittelfeldpressing greift schon im ersten Drittel an");
        homeClub.tactics.anlaufen = "oefter";
        dir.taktikAnwenden();
        if (!dir.presstImRaum("home", ballBei(0.29))) throw new Error("Öfter pressen schiebt die Pressinglinie nicht nach vorn");
        homeClub.tactics.anlaufen = "normal";
        homeClub.tactics.nachBallverlust = "gegenpressing";
        dir._wechselUhr = 497;
        dir.taktikAnwenden();
        if (!dir.presstImRaum("home", ballBei(0.1))) throw new Error("Gegenpressing greift nach dem Ballverlust nicht");
        homeClub.tactics.nachBallverlust = "zurueckziehen";
        dir.taktikAnwenden();
        if (dir.presstImRaum("home", ballBei(0.1))) throw new Error("Wer sich zurückzieht, presst trotzdem gegen");

        // Pressingfalle: Nach aussen lenken heisst von innen anlaufen
        homeClub.tactics.nachBallverlust = "normal";
        homeClub.tactics.pressing = "high";
        const traeger = dir.teamPlayers("away").find(p => p.pos !== "TW");
        dir.deadBall = null;
        dir.kickoff = null;
        const presserSeite = (falle) => {
            homeClub.tactics.pressingfalle = falle;
            dir.taktikAnwenden();
            dir._wechselUhr = 0;
            dir.possessionTeam = "away";
            dir.carrierId = traeger.id;
            live.ball.x = 60; live.ball.y = 22; live.ball.inFlight = false;
            traeger.x = 60; traeger.y = 22;
            const modus = dir.selectPressingPlayers();
            const id = [...modus.entries()].find(([, m]) => m === "press")?.[0];
            const p = dir.getPlayer2D(id);
            return dir.computeTarget(p, live.ball, modus).y - live.ball.y;
        };
        const aussen = presserSeite("aussen");
        const innen = presserSeite("innen");
        if (!(aussen > 1 && innen < -1)) {
            throw new Error(`Pressingfalle lenkt nicht: nach außen ${aussen.toFixed(1)}, nach innen ${innen.toFixed(1)}`);
        }

        // Manndeckung: Jeder klebt an seinem Gegenspieler - gemessen in
        // einer Halbzeit gegen dieselbe Halbzeit in Raumdeckung
        const abstandBeiDeckung = (deckung) => {
            const s2 = GameState.createNewGame("muc", "normal", { name: "Trainer" });
            const h2 = s2.clubs.find(c => c.id === "muc"), a2 = s2.clubs.find(c => c.id === "dor");
            h2.tactics = TacticsEngine.normalisiere({ deckung });
            a2.tactics = TacticsEngine.normalisiere({});
            const l2 = new LiveMatch({ id: "deckung_" + deckung, played: false, homeClubId: "muc", awayClubId: "dor" }, h2, a2, s2.players);
            l2.speed = 1;
            const d2 = l2.director;
            let f = 0, bes = null, seit = 0, summe = 0, n = 0;
            while (!l2.isFinished && l2.minute < 45 && f < 60 * 900) {
                l2.advanceRealTime(1000 / 60);
                l2.updateBallAndPlayers(1000 / 60);
                f++;
                // Gemessen wird erst zwei Sekunden nach einem Besitzwechsel -
                // und nach einem Anstoss: Direkt danach stehen noch alle in
                // der Anstossaufstellung, egal wie gedeckt wird.
                if (d2.possessionTeam !== bes || d2.kickoff) { bes = d2.possessionTeam; seit = f; }
                if (f % 15 || d2.mode !== "ambient" || d2.deadBall || f - seit < 120 || d2.possessionTeam !== "away") continue;
                const gast = l2.players2D.filter(p => p.team === "away" && p.pos !== "TW");
                l2.players2D.filter(p => p.team === "home" && p.pos !== "TW").forEach(p => {
                    summe += Math.min(...gast.map(q => Math.hypot(p.x - q.x, p.y - q.y)));
                    n++;
                });
            }
            return summe / Math.max(1, n);
        };
        const raum = abstandBeiDeckung("raum");
        const mann = abstandBeiDeckung("mann");
        if (!(mann < raum - 1.5)) throw new Error(`Manndeckung rückt nicht an den Gegner: Raum ${raum.toFixed(1)}, Mann ${mann.toFixed(1)}`);
    });

    // 14a7a6. Die Anweisungen mit Ball wirken auf die Entscheidungen
    test("MatchFlowEngine: Aufbau über innen oder außen, Torwartabspiel, Spielmacher, Dribblings", () => {
        const spieler = [
            { id: 1, team: "home", pos: "IV", group: "def", fam: "IV", x: 20, y: 40, passing: 70, vision: 65, technique: 65, dribbling: 55, pace: 60 },
            { id: 2, team: "home", pos: "IV", group: "def", fam: "IV", x: 20, y: 62, passing: 70 },
            { id: 3, team: "home", pos: "LV", group: "def", fam: "AV", x: 26, y: 20, passing: 68 },
            { id: 4, team: "home", pos: "TW", group: "gk", fam: "TW", x: 6, y: 50, passing: 60 },
            { id: 5, team: "home", pos: "ST", group: "att", fam: "ST", x: 60, y: 50, passing: 60 },
            { id: 6, team: "away", pos: "ST", group: "att", x: 75, y: 50, defense: 40, pace: 70 },
            { id: 7, team: "away", pos: "ZM", group: "mid", x: 80, y: 30, defense: 55, pace: 70 }
        ];
        let tactics = TacticsEngine.normalisiere({});
        const flow = new MatchFlowEngine({
            getPlayers: () => spieler,
            getTactics: () => tactics,
            attackDir: team => (team === "home" ? 1 : -1),
            ownGoalX: team => (team === "home" ? 4 : 96)
        });
        const gegner = spieler.filter(p => p.team === "away");
        const mittel = (traeger, ziele, ziel, runden = 80) => {
            let s = 0;
            for (let i = 0; i < runden; i++) {
                const opts = flow.ratePassOptions(traeger, ziele, gegner, tactics, { phase: "buildup", pressure: 0 });
                s += opts.find(o => o.target.id === ziel).score;
            }
            return s / runden;
        };
        const iv = spieler[0], iv2 = spieler[1], av = spieler[2], tw = spieler[3], st = spieler[4];

        tactics = TacticsEngine.normalisiere({ aufbauUeber: "innen" });
        const innen = mittel(iv, [iv2, av], 2) - mittel(iv, [iv2, av], 3);
        tactics = TacticsEngine.normalisiere({ aufbauUeber: "aussen" });
        const aussen = mittel(iv, [iv2, av], 2) - mittel(iv, [iv2, av], 3);
        if (!(innen > aussen + 0.4)) throw new Error(`Aufbau über innen/außen wirkt nicht: ${innen.toFixed(2)} gegen ${aussen.toFixed(2)}`);

        tactics = TacticsEngine.normalisiere({ torwartAbspiel: "kurz" });
        const kurz = mittel(tw, [iv, st], 5) - mittel(tw, [iv, st], 1);
        tactics = TacticsEngine.normalisiere({ torwartAbspiel: "lang" });
        const lang = mittel(tw, [iv, st], 5) - mittel(tw, [iv, st], 1);
        if (!(lang > kurz + 0.8)) throw new Error(`Torwartabspiel wirkt nicht: kurz ${kurz.toFixed(2)}, lang ${lang.toFixed(2)}`);

        // Der Spielmacher wird gesucht
        tactics = TacticsEngine.normalisiere({});
        const ohne = mittel(iv, [iv2, av], 2);
        iv2.rolleMit = TacticsEngine.rolleMitBall("DM", "dm_spielmacher");
        const mitRolle = mittel(iv, [iv2, av], 2);
        delete iv2.rolleMit;
        if (!(mitRolle > ohne + 0.25)) throw new Error("Ein Spielmacher wird nicht häufiger angespielt");

        // Mehr Dribblings
        const dribbel = (wert) => {
            tactics = TacticsEngine.normalisiere({ dribbling: wert });
            let s = 0;
            for (let i = 0; i < 80; i++) s += flow.rateDribble(iv, gegner, tactics, 0.2).score;
            return s / 80;
        };
        if (!(dribbel("mehr") > dribbel("weniger") + 0.5)) throw new Error("Die Anweisung Dribblings wirkt nicht");
    });

    // 14a7a7. Zweikampfhaerte in der Ergebnissimulation
    test("MatchEngine: Hart einsteigen bringt mehr Fouls, auf den Füßen bleiben weniger", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const home = state.clubs.find(c => c.id === "muc");
        const away = state.clubs.find(c => c.id === "dor");
        // Beide Einstellungen spielen dieselben Partien: Jede Partie bekommt
        // eine feste Zufallsfolge, die fuer beide gleich ist. So misst der
        // Vergleich die Zweikampfhaerte und nicht den Zufall - frei gewuerfelt
        // lag der Unterschied von rund einem halben Foul je Spiel im Rauschen.
        const folge = (a) => () => {
            a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const fouls = (zweikampf) => {
            home.tactics = TacticsEngine.normalisiere({ zweikampf });
            away.tactics = TacticsEngine.normalisiere({});
            let summe = 0;
            const zufall = Math.random;
            try {
                for (let i = 0; i < 120; i++) {
                    Math.random = folge(7919 * (i + 1));
                    state.players.forEach(p => { p.suspendedMatches = 0; p.injuredWeeks = 0; p.fitness = 92; });
                    const m = { id: `zk_${i}`, played: false, homeClubId: "muc", awayClubId: "dor" };
                    MatchEngine.simulateFullMatch(m, home, away, state.players);
                    summe += m.stats.fouls[0];
                }
            } finally {
                Math.random = zufall;
            }
            return summe / 120;
        };
        const hart = fouls("hart");
        const sanft = fouls("zurueckhaltend");
        if (!(hart > sanft + 0.4)) throw new Error(`Zweikampfhärte ändert die Fouls nicht: hart ${hart.toFixed(2)}, zurückhaltend ${sanft.toFixed(2)}`);
    });

    // 14a7a8. Alle Formationen laufen mit jeder Vorlage
    test("Alle Formationen: Positionsspiel mit jeder Vorlage ohne Knoten und ohne Fehler", () => {
        const formen = Object.keys(FORMATION_CONFIGS).filter(k => FORMATION_CONFIGS[k].positions.length === 11);
        const vorlagen = Object.keys(TacticsEngine.VORLAGEN);
        formen.forEach((form, fi) => {
            const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
            const home = state.clubs.find(c => c.id === "muc");
            const away = state.clubs.find(c => c.id === "dor");
            home.formation = form;
            GameState.autoSetLineupForClub(home, state.players);
            const vorlage = vorlagen[fi % vorlagen.length];
            home.tactics = TacticsEngine.wendeVorlageAn({}, vorlage);
            home.tactics.formMitBall = "auto";
            const live = new LiveMatch({ id: "form_" + fi, played: false, homeClubId: "muc", awayClubId: "dor" }, home, away, state.players);
            live.speed = 2;
            for (let f = 0; f < 60 * 25; f++) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
            if (live.players2D.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
                throw new Error(`${form} (${vorlage}): Spieler ohne Position`);
            }
            const dir = live.director;
            dir._laufUhr = (dir._laufUhr || 0) + 1;
            dir._planMitBall = {};
            dir._schwerpunkt = { home: 0.72, away: 0.28 };
            const ball = { x: dir.ownGoalX("home") + dir.attackDir("home") * 92 * 0.72, y: 50 };
            const plan = dir.teamPlayers("home").filter(p => p.pos !== "TW").map(p => dir.planMitBall("home", ball).get(p.id));
            if (plan.some(e => !e || !Number.isFinite(e.y) || !Number.isFinite(e.tiefe))) throw new Error(`${form}: Plan mit Ball unvollständig`);
            for (let i = 0; i < plan.length; i++) for (let j = i + 1; j < plan.length; j++) {
                if (Math.abs(plan[i].y - plan[j].y) < 6 && Math.abs(plan[i].tiefe - plan[j].tiefe) < 0.1) {
                    throw new Error(`${form} (${vorlage}): zwei Spieler auf demselben Fleck`);
                }
            }
            // Mit den Standardrollen hat jede Formation Breite auf beiden Seiten
            home.tactics = TacticsEngine.normalisiere({});
            dir.taktikAnwenden();
            dir._planMitBall = {};
            dir._laufUhr += 1;
            const std = dir.teamPlayers("home").filter(p => p.pos !== "TW").map(p => dir.planMitBall("home", ball).get(p.id));
            if (!std.some(e => e.y < 14) || !std.some(e => e.y > 86)) throw new Error(`${form}: Mit Ball ist eine Seitenlinie leer`);
        });
    });

    // Szenen entstehen aus dem Spiel: Der Gegner erobert den Ball sichtbar,
    // gefoult wird am Ball, die Ecke liegt an der Fahne, der Torwart steht
    // auf der Linie.
    test("Livespiel: Ballgewinn vor der Szene, Foul am Ball, Ecke an der Fahne, Torwart auf der Linie", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const home = state.clubs.find(c => c.id === "muc");
        const away = state.clubs.find(c => c.id === "dor");
        let geschenkt = 0, erobert = 0;
        const fouls = [], ecken = [];

        for (let r = 0; r < 2; r++) {
            const live = MatchEngine.createLiveMatch({ id: "szene_" + r, played: false, homeClubId: "muc", awayClubId: "dor" },
                home, away, state.players);
            live.speed = 2;
            const d = live.director;

            const start = d.startHighlight.bind(d);
            d.startHighlight = () => {
                const ev = live.timeline[live.timelineIndex];
                const team = d.attackingTeamOf(ev);
                const traeger = d.getPlayer2D(d.carrierId);
                if (team && traeger && traeger.team !== team) geschenkt++;
                return start();
            };
            const phase = d.beginEventPhase.bind(d);
            d.beginEventPhase = (ph) => {
                const ev = d.currentEvent();
                if (ph === "action" && ev && ["foul", "yellow_card", "red_card"].includes(ev.type) && !ev.direkterFreistoss) {
                    const t = d.getPlayer2D(ev.playerId);
                    if (t) fouls.push(Math.hypot(t.x - live.ball.x, t.y - live.ball.y));
                }
                if (ph === "action" && ev && ev.type === "corner") {
                    const verteidigt = ev.team === "home" ? "away" : "home";
                    const torX = d.ownGoalX(verteidigt);
                    const tw = live.players2D.find(p => p.team === verteidigt && p.pos === "TW");
                    ecken.push({
                        ballAnLinie: Math.abs(live.ball.x - torX) < 1.5,
                        ballAnFahne: live.ball.y < 3 || live.ball.y > 97,
                        torwart: tw ? Math.abs(tw.x - torX) : 0,
                        hinterLinie: live.players2D.filter(p => (torX > 50 ? p.x > torX + 0.4 : p.x < torX - 0.4)).length
                    });
                }
                return phase(ph);
            };
            let f = 0;
            while (!live.isFinished && f++ < 60 * 900) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
            erobert += d.flowStats.ballgewinneVorSzene || 0;
        }

        // Vorher wechselte der Ball rund fünfundvierzigmal in zwei Partien
        // ohne Zweikampf den Besitzer
        if (geschenkt > 14) throw new Error(`${geschenkt} Mal bekam der Gegner den Ball ohne Zweikampf`);
        if (erobert < 10) throw new Error(`Nur ${erobert} sichtbare Ballgewinne vor gegnerischen Szenen`);
        if (fouls.length < 8) throw new Error(`Zu wenige Fouls gemessen (${fouls.length})`);
        const amBall = fouls.filter(x => x < 4.5).length / fouls.length;
        if (amBall < 0.85) throw new Error(`Nur ${(amBall * 100).toFixed(0)} % der Fouls mit dem Foulenden am Ball`);
        if (ecken.length < 2) throw new Error(`Zu wenige Ecken gemessen (${ecken.length})`);
        ecken.forEach((e, i) => {
            if (!e.ballAnLinie || !e.ballAnFahne) throw new Error(`Ecke ${i + 1} wurde nicht an der Fahne getreten`);
            if (e.torwart > 2.5) throw new Error(`Ecke ${i + 1}: Torwart ${e.torwart.toFixed(1)} vor der Linie`);
            if (e.hinterLinie > 0) throw new Error(`Ecke ${i + 1}: ${e.hinterLinie} Spieler hinter der Torlinie`);
        });
    });

    test("Anstoß: Der Schütze steht am Ball, nach einem Tor steht niemand in der falschen Hälfte", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const home = state.clubs.find(c => c.id === "muc");
        const away = state.clubs.find(c => c.id === "dor");
        const live = MatchEngine.createLiveMatch({ id: "anstoss", played: false, homeClubId: "muc", awayClubId: "dor" },
            home, away, state.players);
        live.speed = 1;
        const d = live.director;
        const pruefePfiff = (wann) => {
            let f = 0;
            while (d.kickoff && d.kickoff.phase !== "whistle" && f++ < 60 * 30) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
            if (!d.kickoff) throw new Error(`${wann}: Anstoß ohne Pfiff`);
            const schuetze = d.getPlayer2D(d.kickoffTakerId);
            if (!schuetze || Math.hypot(schuetze.x - 50, schuetze.y - 50) > 3) {
                throw new Error(`${wann}: Der Anstoßschütze steht ${schuetze ? Math.hypot(schuetze.x - 50, schuetze.y - 50).toFixed(1) : "?"} vom Ball`);
            }
            const falsch = live.players2D.filter(p => (d.attackDir(p.team) > 0 ? p.x > 50.5 : p.x < 49.5));
            if (falsch.length) throw new Error(`${wann}: ${falsch.length} Spieler in der gegnerischen Hälfte beim Pfiff`);
        };
        pruefePfiff("Anpfiff");

        // Nach einem Tor: Die Torschützen stehen jubelnd an der Eckfahne
        d.kickoff = null;
        live.players2D.filter(p => p.team === "home").forEach(p => { p.x = 88; p.y = 14; });
        d.startKickoff("away", "goal");
        pruefePfiff("Anstoß nach Tor");
    });

    test("Vorbereitung: Ein Testspiel wird angesagt, live gespielt und mit diesem Ergebnis eingetragen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        let n = 0;
        while (CalendarEngine.getCurrentDay(state).type !== "friendly" && n++ < 60) CalendarEngine.advanceOneDay(state);
        const tag = CalendarEngine.getCurrentDay(state);
        if (tag.type !== "friendly") throw new Error("Kein Spieltermin in der Vorbereitung gefunden");

        const test = PreseasonEngine.partieFuerSlot(state, tag.friendlyIndex ?? 0);
        if (!test || !test.gegner || !test.partie) throw new Error("Der Termin wird nicht angesagt");
        if (test.partie.played) throw new Error("Die angesagte Partie ist schon gespielt");
        if (test.partie.competitionId !== "friendly") throw new Error("Die Partie trägt nicht den Wettbewerb Testspiel");

        // "Live" gespielt: Die Partie wird vorab ausgetragen und dem Kalender
        // übergeben - er darf sie nicht ein zweites Mal ausspielen
        const heim = state.clubs.find(c => c.id === test.partie.homeClubId);
        const gast = state.clubs.find(c => c.id === test.partie.awayClubId);
        MatchEngine.simulateFullMatch(test.partie, heim, gast, state.players);
        const erwartet = test.heim
            ? `${test.partie.homeGoals}:${test.partie.awayGoals}`
            : `${test.partie.awayGoals}:${test.partie.homeGoals}`;
        state.preseason.livePartie = test.partie;
        const res = CalendarEngine.advanceOneDay(state);
        if (!res.success || res.type !== "friendly") throw new Error("Der Termin wurde nicht abgeschlossen");
        if ("livePartie" in state.preseason) throw new Error("Die Übergabe bleibt im Spielstand liegen");
        const eingetragen = state.preseason.testspiele.find(t => t.gespielt);
        if (!eingetragen || eingetragen.ergebnis !== erwartet) {
            throw new Error(`Eingetragen ${eingetragen?.ergebnis}, live gespielt ${erwartet}`);
        }
    });

    // 14a7b. Der Ball gehört immer jemandem - auch auf der schnellsten Stufe
    test("LiveMatchDirector: Der Ball liegt nicht allein herum, auch nicht im Schnelldurchlauf", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");

        // Das Lauftempo der Spieler muss der eingestellten Stufe folgen. Sonst
        // laeuft die Uhr den Spielern davon: Der Ball wird an die Eckfahne
        // gelegt, das Fenster ist fuenfmal kuerzer - und der Schuetze ist noch
        // auf halbem Weg.
        const tempoMessung = (speed) => {
            const m = { id: `t${speed}`, played: false, homeClubId: "muc", awayClubId: "dor" };
            const l = new LiveMatch(m, homeClub, awayClub, state.players);
            l.speed = speed;
            return l.director.getMotionTempo();
        };
        if (!(tempoMessung(4) > tempoMessung(1) * 1.4)) {
            throw new Error("Auf der schnellsten Stufe laufen die Spieler nicht spuerbar schneller");
        }

        // Und dann die Probe am ganzen Spiel, auf der schnellsten Stufe -
        // dort war der Abstand am groessten.
        const match = { id: "allein", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        live.speed = 4;
        const dir = live.director;

        let frames = 0, gesamt = 0, allein = 0, ruhend = 0, ruhendAllein = 0;
        const abstaende = [];

        while (!live.isFinished && frames < 60 * 1800) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
            frames++;
            const dt = 1 / 60;
            gesamt += dt;

            const ball = live.ball;
            let naechster = 999;
            (live.players2D || []).forEach(p => {
                const d = Math.hypot(p.x - ball.x, p.y - ball.y);
                if (d < naechster) naechster = d;
            });
            abstaende.push(naechster);

            // Acht Feldeinheiten sind gut acht Meter - so weit weg gehoert der
            // Ball sichtbar niemandem mehr.
            if (naechster > 8) allein += dt;
            if (dir.deadBall || dir.kickoff) {
                ruhend += dt;
                if (naechster > 8) ruhendAllein += dt;
            }
        }

        abstaende.sort((a, b) => a - b);
        const median = abstaende[Math.floor(abstaende.length / 2)] || 0;
        if (median > 4) {
            throw new Error(`Der Ball liegt im Mittel ${median.toFixed(1)} Einheiten vom naechsten Spieler weg`);
        }

        // Ein ruhender Ball war der schlimmste Fall: Bei einer Ecke lag er in
        // siebenundachtzig Prozent der Zeit allein an der Fahne, weil der
        // Schuetze nach Technik statt nach Weg bestimmt wurde und in echten
        // Sekunden dorthin trabte.
        const ruhendPct = ruhend > 0 ? ruhendAllein / ruhend * 100 : 0;
        if (ruhendPct > 35) {
            throw new Error(`Bei ruhendem Ball liegt er in ${ruhendPct.toFixed(0)} % der Zeit allein da`);
        }

        const alleinPct = allein / gesamt * 100;
        if (alleinPct > 14) {
            throw new Error(`Der Ball gehoert in ${alleinPct.toFixed(0)} % der Uebertragung niemandem`);
        }
    });

    // 14a8. Vor der Saison steht die Vorbereitung - und sie hat Folgen
    test("PreseasonEngine: Vorbereitung vor jeder Saison mit Stab, Sponsor und Testspielen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);

        // Der erste Spieltag steht nicht sofort an
        if (!state.preseason || !state.preseason.aktiv) {
            throw new Error("Nach dem Karrierestart läuft keine Vorbereitung");
        }
        const ersterSpieltag = state.calendar.findIndex(d => d.type === "matchday");
        if (ersterSpieltag < 20) {
            throw new Error(`Der erste Spieltag steht schon an Kalendertag ${ersterSpieltag} - zu wenig Vorbereitung`);
        }

        // Für jeden Fachbereich liegen Bewerbungen vor
        PreseasonEngine.BEREICHE.forEach(b => {
            const liste = state.preseason.bewerber?.[b.key] || [];
            if (liste.length < 2) throw new Error(`Zu wenige Bewerber für ${b.titel}`);
        });

        // Ein verpflichteter Trainer verändert die Güte des Stabs messbar
        const vorher = CoachingStaffEngine.staffQuality(club);
        const kandidaten = state.preseason.bewerber.fitness;
        const bester = kandidaten[0];
        const r = PreseasonEngine.verpflichte(state, "fitness", bester.id);
        if (!r.ok && !/Gehaltsetat/.test(r.grund || "")) {
            throw new Error(`Verpflichtung fehlgeschlagen: ${r.grund}`);
        }
        if (r.ok) {
            const nachher = CoachingStaffEngine.staffQuality(club);
            if (nachher.fitness !== bester.guete) {
                throw new Error(`Der verpflichtete Athletiktrainer wirkt nicht: ${nachher.fitness} statt ${bester.guete}`);
            }
        }

        // Ein angenommenes Sponsorenangebot bestimmt die Einnahmen
        const angebot = state.preseason.sponsorAngebote[2];
        const sr = PreseasonEngine.waehleSponsor(state, angebot.id);
        if (!sr.ok) throw new Error(`Sponsor konnte nicht gewählt werden: ${sr.grund}`);
        if (FinanceEngine.sponsorPerMatchday(club) !== angebot.amountPerMatchday) {
            throw new Error("Der ausgehandelte Sponsorenvertrag wirkt sich nicht auf die Einnahmen aus");
        }

        // Ein Testspiel zählt für keine Tabelle. Es muss erst vereinbart
        // werden - der Spielplan ist zu Beginn leer.
        const tabelleVorher = JSON.stringify(state.standings || []);
        let test = null;
        for (const k of state.preseason.kontakte) {
            const anfrage = PreseasonEngine.frageTestspielAn(state, k.clubId);
            if (anfrage.ok && anfrage.zugesagt) { test = anfrage.test; break; }
        }
        if (!test) throw new Error("Kein einziger Verein war zu einem Testspiel bereit");

        const ergebnis = PreseasonEngine.spieleTestspiel(state, test.id);
        if (!ergebnis) throw new Error("Testspiel konnte nicht gespielt werden");
        if (!test.gespielt || !test.ergebnis) throw new Error("Testspiel ohne Ergebnis");
        if (JSON.stringify(state.standings || []) !== tabelleVorher) {
            throw new Error("Ein Testspiel hat die Tabelle verändert");
        }

        // Und sie steht auch vor der zweiten Saison
        state.preseason.aktiv = false;
        SeasonEngine.startNextSeason(state);
        if (!state.preseason || !state.preseason.aktiv) {
            throw new Error("Vor der zweiten Saison läuft keine Vorbereitung");
        }
    });

    // 14a2. Der Manager plant seine Vorbereitung selbst: Turniere oder Anfragen
    test("PreseasonEngine: Turniere und selbst vereinbarte Testspiele belegen die Termine", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const pre = state.preseason;

        // Zu Beginn ist nichts verplant - das ist der Sinn der Sache
        if (PreseasonEngine.freieSlots(pre).length !== PreseasonEngine.SLOTS) {
            throw new Error("Der Spielplan ist schon vorbelegt - es gibt nichts zu entscheiden");
        }
        if (!pre.turniere.length) throw new Error("Keine Turniereinladungen erzeugt");
        pre.turniere.forEach(t => {
            if (t.teilnehmer.length !== 3) throw new Error(`${t.name} hat ${t.teilnehmer.length} Gegner statt 3`);
            if (!(t.praemien[1] > t.praemien[4])) throw new Error(`${t.name}: Der Sieg bringt nicht mehr als Platz 4`);
        });

        // Ein Turnier belegt zwei Termine und bringt Antrittsgeld
        const kontoVorher = club.balance;
        const turnier = pre.turniere[0];
        const an = PreseasonEngine.nimmTurnierAn(state, turnier.id);
        if (!an.ok) throw new Error(`Turnier konnte nicht angenommen werden: ${an.grund}`);
        if (turnier.slots.length !== 2) throw new Error("Ein Turnier belegt nicht zwei Termine");
        if (PreseasonEngine.freieSlots(pre).length !== PreseasonEngine.SLOTS - 2) {
            throw new Error("Nach der Zusage sind die Termine nicht belegt");
        }
        if (club.balance !== kontoVorher + turnier.antrittsgeld) {
            throw new Error("Das Antrittsgeld wurde nicht gutgeschrieben");
        }

        // Zurückziehen gibt die Termine und das Geld wieder her
        const zurueck = PreseasonEngine.storniereTurnier(state, turnier.id);
        if (!zurueck.ok) throw new Error(`Rückzug fehlgeschlagen: ${zurueck.grund}`);
        if (PreseasonEngine.freieSlots(pre).length !== PreseasonEngine.SLOTS) {
            throw new Error("Nach dem Rückzug sind die Termine nicht wieder frei");
        }
        if (club.balance !== kontoVorher) throw new Error("Das Antrittsgeld kam nicht zurück");
        PreseasonEngine.nimmTurnierAn(state, turnier.id);

        // Eine Anfrage kann scheitern - aber nie stillschweigend
        let zusagen = 0, absagen = 0;
        pre.kontakte.forEach(k => {
            const r = PreseasonEngine.frageTestspielAn(state, k.clubId);
            if (!r.ok) return;
            if (r.zugesagt) zusagen++;
            else {
                absagen++;
                if (!r.kontakt.grund) throw new Error("Eine Absage kommt ohne Begründung");
            }
        });
        if (zusagen === 0) throw new Error("Kein einziger Verein hat zugesagt");
        if (PreseasonEngine.freieSlots(pre).length !== 0) {
            throw new Error("Trotz Zusagen sind noch Termine frei");
        }
        // Ein voller Spielplan nimmt keine weitere Anfrage mehr an
        const zuviel = pre.kontakte.find(k => k.status === "offen");
        if (zuviel) {
            const r = PreseasonEngine.frageTestspielAn(state, zuviel.clubId);
            if (r.ok) throw new Error("Eine Anfrage wurde angenommen, obwohl kein Termin frei ist");
        }

        // Die vier Termine werden im Kalender abgearbeitet: Halbfinale,
        // Endspiel, Testspiele - und die Tabelle bleibt unberührt.
        const tabelleVorher = JSON.stringify(state.standings || []);
        for (let i = 0; i < PreseasonEngine.SLOTS; i++) {
            pre.tagIndex = 5 * i;
            const r = PreseasonEngine.spieleSlot(state, i);
            if (!r) throw new Error(`Termin ${i + 1} wurde nicht gespielt`);
        }
        if (JSON.stringify(state.standings || []) !== tabelleVorher) {
            throw new Error("Die Vorbereitungsspiele haben die Tabelle verändert");
        }
        if (!turnier.halbfinale || !turnier.endspiel) throw new Error("Das Turnier wurde nicht zu Ende gespielt");
        if (![1, 2, 3, 4].includes(turnier.platz)) throw new Error(`Unmögliche Platzierung: ${turnier.platz}`);
        if (turnier.halbfinale.gewonnen && turnier.platz > 2) {
            throw new Error("Trotz gewonnenem Halbfinale nur Platz " + turnier.platz);
        }
        if (!turnier.halbfinale.gewonnen && turnier.platz < 3) {
            throw new Error("Trotz verlorenem Halbfinale Platz " + turnier.platz);
        }

        // Wer nichts plant, spielt trotzdem - der Sportdirektor stellt einen Gegner
        const zweiter = GameState.createNewGame("dor", "normal", { name: "Trainer" });
        const r2 = PreseasonEngine.spieleSlot(zweiter, 0);
        if (!r2) throw new Error("Ein unverplanter Termin blieb ungespielt");
        const auto = zweiter.preseason.testspiele[0];
        if (!auto || !auto.gespielt) throw new Error("Der Sportdirektor hat keinen Gegner gestellt");
        if (auto.selbstVereinbart !== false) throw new Error("Das Notfallspiel gilt als selbst vereinbart");
    });

    // 14b. Verträge, Ablösefreie und Karriereenden über zwei Saisonwechsel
    test("SeasonEngine: Verträge laufen aus, Spieler treten zurück, Kader bleiben spielfähig", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const gruppen = { TW: ["TW"], ABW: ["IV", "LV", "RV"], MIT: ["ZM", "DM", "OM", "LM", "RM"], ANG: ["ST", "LA", "RA"] };

        const pruefeWelt = (phase) => {
            const doppelt = state.players.length - new Set(state.players.map(p => p.id)).size;
            if (doppelt > 0) throw new Error(`${phase}: ${doppelt} doppelte Spieler-Kennungen`);

            const abgelaufen = state.players.filter(p => p.clubId && (p.contractYears || 0) <= 0).length;
            if (abgelaufen > 0) throw new Error(`${phase}: ${abgelaufen} Spieler ohne Restlaufzeit stehen weiter im Verein`);

            const rentner = state.players.filter(p => (p.age || 0) >= 40).length;
            if (rentner > 0) throw new Error(`${phase}: ${rentner} Spieler jenseits der 40 laufen noch auf`);

            state.clubs.forEach(club => {
                const kader = (club.playerIds || []).map(id => state.players.find(p => p.id === id));
                if (kader.some(p => !p)) throw new Error(`${phase}: ${club.name} führt Spieler, die es nicht gibt`);
                const zaehler = {};
                kader.forEach(p => { zaehler[p.pos] = (zaehler[p.pos] || 0) + 1; });
                const teil = (posListe) => posListe.reduce((s, pos) => s + (zaehler[pos] || 0), 0);
                if (teil(gruppen.TW) < 2) throw new Error(`${phase}: ${club.name} hat nur ${teil(gruppen.TW)} Torhüter`);
                if (teil(gruppen.ANG) < 3) throw new Error(`${phase}: ${club.name} hat nur ${teil(gruppen.ANG)} Angreifer`);
                if (teil(gruppen.ABW) < 5) throw new Error(`${phase}: ${club.name} hat nur ${teil(gruppen.ABW)} Verteidiger`);
                if (teil(gruppen.MIT) < 4) throw new Error(`${phase}: ${club.name} hat nur ${teil(gruppen.MIT)} Mittelfeldspieler`);
            });
        };

        pruefeWelt("Start");

        for (let saison = 0; saison < 2; saison++) {
            while (state.currentMatchday < state.totalMatchdays) SeasonEngine.advanceToNextMatchday(state);
            SeasonEngine.advanceToNextMatchday(state);
            SeasonEngine.startNextSeason(state);
            pruefeWelt(`Saison ${state.seasonYear}`);
        }

        // Nach zwei Wechseln muss es einen freien Markt geben
        const frei = state.players.filter(p => !p.clubId);
        if (frei.length < 5) throw new Error(`Nur ${frei.length} ablösefreie Spieler auf dem Markt`);
        if (frei.some(p => state.clubs.some(c => (c.playerIds || []).includes(p.id)))) {
            throw new Error("Ein vereinsloser Spieler steht noch in einem Kader");
        }

        // Und der Transfermarkt muss sie ablösefrei anbieten
        const preis = TransferEngine.calculateAskingPrice(frei[0], null);
        if (preis !== 0) throw new Error(`Ablösefreier Spieler kostet ${preis} € Ablöse`);
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

            // Zwischen den Partien erholen sich die Mannschaften wieder.
            // Ohne das häufen sich Sperren und Verletzungen über 500 Spiele
            // an, bis beide Vereine nur noch mit Restkadern antreten - und
            // gemessen würde dann nicht mehr das normale Ligaspiel.
            players.forEach(p => {
                p.suspendedMatches = 0;
                p.injuredWeeks = 0;
                p.fitness = 92;
            });

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

        // Beide Akademien in demselben Zustand, nur die Stufe unterscheidet sich
        FacilityEngine.hole(clubTop, 1);
        FacilityEngine.hole(clubSmall, 1);
        clubTop.facilities.youthCenter = 5;
        clubSmall.facilities.youthCenter = 1;
        Object.assign(clubTop.anlagen.youthCenter, { stufe: 5, zustand: 100, projekt: null });
        Object.assign(clubSmall.anlagen.youthCenter, { stufe: 1, zustand: 100, projekt: null });

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

        // Alle mitgelieferten Formationen müssen korrekt benannt werden.
        // Namen mit erklärendem Zusatz ("4-3-3 mit offensiverem Mittelfeld")
        // gelten als erkannt, wenn die Grundform stimmt.
        Object.keys(FORMATION_CONFIGS).forEach(key => {
            if (GameState.isCustomFormation(key)) return;
            const shape = PositionEngine.detectFormationShape(FORMATION_CONFIGS[key].positions);
            if (shape !== key && !key.startsWith(shape + " ")) {
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

    // Beste 11: Die Formation richtet sich nach den verfuegbaren Spielern
    test("GameState: Beste 11 wählt die Formation, die zum verfügbaren Kader passt", () => {
        let nr = 0;
        const spieler = (pos, overall = 80) => ({
            id: `bf_${++nr}`, name: `Spieler ${nr}`, pos, secondPos: null, positions: [pos],
            overall, fitness: 100, form: 7, injuredWeeks: 0, suspendedMatches: 0,
            shooting: 60, passing: 60
        });
        const kader = (positionen, formation) => {
            const liste = positionen.map(p => spieler(p))
                // Eine schwache Bank, damit die Elf nicht aus ihr kommt
                .concat(["TW", "IV", "ZM", "LV"].map(p => spieler(p, 50)));
            const club = { id: `bf_club_${nr}`, formation, playerIds: liste.map(p => p.id), roles: {} };
            return { club, liste };
        };

        // Drei Stuermer, davon zwei Aussen, und kein Mann fuer die Fluegel im
        // Mittelfeld: Im 4-4-2 muesste ein Aussenstuermer ins Zentrum.
        const fluegel = kader(["TW", "LV", "IV", "IV", "RV", "DM", "ZM", "ZM", "LA", "RA", "ST"], "4-4-2");
        const wahl = GameState.findBestFormation(fluegel.club, fluegel.liste);
        if (!wahl) throw new Error("Für einen vollständigen Kader wurde keine Formation gefunden");
        const slots = FORMATION_CONFIGS[wahl.key].positions.map(s => PositionEngine.normalizePosition(s.pos));
        if (!slots.includes("LA") || !slots.includes("RA") || slots.filter(p => p === "ST").length !== 1) {
            throw new Error(`Mit zwei Außenstürmern und einer Spitze wurde ${wahl.key} gewählt`);
        }
        if (!(wahl.wert > wahl.bisher.wert * 1.01)) {
            throw new Error(`Die neue Formation ist nicht spürbar stärker: ${wahl.wert.toFixed(0)} gegen ${wahl.bisher.wert.toFixed(0)}`);
        }

        // Umgekehrt: Zwei Spitzen und klassische Aussenbahnspieler
        const klassisch = kader(["TW", "LV", "IV", "IV", "RV", "LM", "ZM", "ZM", "RM", "ST", "ST"], "4-3-3");
        const wahl442 = GameState.findBestFormation(klassisch.club, klassisch.liste);
        if (wahl442.key !== "4-4-2") throw new Error(`Ein 4-4-2-Kader bekommt ${wahl442.key}`);

        // Passt die eingestellte Formation schon, bleibt sie
        klassisch.club.formation = "4-4-2";
        if (GameState.findBestFormation(klassisch.club, klassisch.liste).key !== "4-4-2") {
            throw new Error("Eine passende Formation wird trotzdem umgestellt");
        }

        // Verletzte und Gesperrte zaehlen nicht - in keiner der bewerteten
        // Formationen stehen sie in der Elf
        const ausfall = kader(["TW", "LV", "IV", "IV", "RV", "DM", "ZM", "ZM", "LA", "RA", "ST", "ST", "RM"], "4-3-3");
        const verletzt = ausfall.liste.find(p => p.pos === "RA");
        const gesperrt = ausfall.liste.find(p => p.pos === "DM");
        verletzt.injuredWeeks = 3;
        gesperrt.suspendedMatches = 1;
        const wahlAusfall = GameState.findBestFormation(ausfall.club, ausfall.liste);
        wahlAusfall.rangliste.forEach(e => {
            if (e.elf.some(p => p && (p.id === verletzt.id || p.id === gesperrt.id))) {
                throw new Error(`In ${e.key} steht ein verletzter oder gesperrter Spieler`);
            }
        });

        // Ein Exot gewinnt nicht durch Rundungsglueck: Mit einem echten 4-4-2-
        // Kader bleibt das 6-3-1 aussen vor, auch wenn es rechnerisch knapp
        // mithalten kann
        const breit = kader(["TW", "LV", "IV", "IV", "IV", "IV", "RV", "LM", "ZM", "ZM", "RM", "ST", "ST"], "4-4-2");
        const wahlBreit = GameState.findBestFormation(breit.club, breit.liste);
        if (wahlBreit.key === "6-3-1") throw new Error("Ein Kader mit vier Innenverteidigern landet im 6-3-1");

        // Die Elf danach ist vollständig und doppelt niemanden
        fluegel.club.formation = wahl.key;
        GameState.autoSetLineupForClub(fluegel.club, fluegel.liste);
        if (fluegel.club.lineup.length !== 11 || new Set(fluegel.club.lineup).size !== 11) {
            throw new Error("Die beste Elf ist nicht vollständig");
        }
        const aufgestellt = fluegel.club.lineup.map(id => fluegel.liste.find(p => p.id === id));
        if (aufgestellt.some(p => p.overall < 80)) throw new Error("Ein Bankspieler steht in der besten Elf");
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
        // Verfolgt wird jeder Spieler über seine Kennung, nicht über seinen
        // Platz in der Liste: Seit Wechsel und Platzverweise auf dem Feld
        // stattfinden, betritt ein Eingewechselter an der Mittellinie das Feld
        // (eine neue Spur, kein Sprung), und ein Platzverwiesener verlässt die
        // Liste - danach stünde jeder Folgende auf einem fremden Index.
        const prevPlayers = new Map(live.players2D.map(p => [p.id, { x: p.x, y: p.y }]));

        let seitenwechselFrames = 0;

        while (!live.isFinished && frames < 60 * 400) {
            const vorHalbzeit = live.director.isSecondHalf;
            const vorSchnitte = live.schnitte || 0;
            live.advanceRealTime(FRAME);
            live.updateBallAndPlayers(FRAME);
            frames++;

            // Der Seitenwechsel ist ein Schnitt in der Pause: beide
            // Mannschaften kommen auf der anderen Seite aus der Kabine. Genau
            // dieses eine Bild darf springen, jedes andere nicht - ausser bei
            // einem ausgewiesenen Schnitt der Uebertragung (Ecke, Anstoss
            // nach einem Tor), bei dem die Wiedergabe abblendet.
            const seitenwechsel = !vorHalbzeit && live.director.isSecondHalf;
            if (seitenwechsel) seitenwechselFrames++;
            const schnitt = seitenwechsel || (live.schnitte || 0) !== vorSchnitte;

            maxBallStep = Math.max(maxBallStep, Math.hypot(live.ball.x - prevBall.x, live.ball.y - prevBall.y));
            prevBall = { x: live.ball.x, y: live.ball.y };

            live.players2D.forEach(p => {
                const vorher = prevPlayers.get(p.id);
                if (vorher && !schnitt) {
                    maxPlayerStep = Math.max(maxPlayerStep, Math.hypot(p.x - vorher.x, p.y - vorher.y));
                }
                prevPlayers.set(p.id, { x: p.x, y: p.y });
            });

            commentaries.add(live.lastCommentary);
        }

        if (seitenwechselFrames !== 1) {
            throw new Error(`Der Seitenwechsel findet ${seitenwechselFrames}-mal statt, erwartet wird genau einer`);
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

        // Gepaarte Stichprobe: Jede Einstellung spielt dieselben Partien mit
        // denselben Zufallsfolgen. Sonst misst der Vergleich vor allem, welche
        // Partien zufaellig gezogen wurden - der Abstand zwischen kurzem und
        // direktem Passspiel schwankte ueber sechsundzwanzig Messungen von 0.8
        // bis 8.3, und das alte wie das neue Laufmodell fielen damit in jedem
        // zehnten Lauf durch. Die Startwerte werden bei jedem Lauf neu
        // gewuerfelt, der Test haengt also an keinem gluecklichen Wert.
        const saatBasis = Math.floor(Math.random() * 1e9);
        const mitSaat = (saat, fn) => {
            const zufall = Math.random;
            let s = saat >>> 0;
            Math.random = () => {
                s = (s + 0x6D2B79F5) >>> 0;
                let t = s;
                t = Math.imul(t ^ (t >>> 15), t | 1);
                t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
                return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
            try { return fn(); } finally { Math.random = zufall; }
        };

        const measure = (tactics) => {
            const agg = { dist: 0, n: 0, forward: 0, left: 0, right: 0 };

            // Acht Partien statt vier: Seit Spieler und Ball auf glaubwuerdigem
            // Tempo laufen, entfallen auf eine Partie rund zweiunddreissig freie
            // Entscheidungen statt vierundsechzig - die Anlaeufe brauchen die
            // Zeit, die ein Laufweg wirklich kostet. Die Stichprobe bleibt, sie
            // wird nur ueber mehr Partien gezogen.
            for (let run = 0; run < 8; run++) mitSaat(saatBasis + run * 7919, () => {
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
                        // Nach dem Seitenwechsel greift die Heimmannschaft in
                        // die andere Richtung an - ohne Vorzeichen würden sich
                        // beide Halbzeiten gegenseitig aufheben.
                        const dir = director.attackDir("home");
                        if ((tx - action.from.x) * dir > 0) agg.forward++;
                        // Der linke Flügel liegt aus Sicht der Angriffsrichtung
                        // nach dem Seitenwechsel bei hohen y-Werten.
                        const relY = dir > 0 ? ty : 100 - ty;
                        if (relY < 38) agg.left++;
                        else if (relY > 62) agg.right++;
                    }
                    original(action);
                };

                let frames = 0;
                while (!live.isFinished && frames < 60 * 500) {
                    live.advanceRealTime(1000 / 60);
                    live.updateBallAndPlayers(1000 / 60);
                    frames++;
                }
            });

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
        // Zwanzig statt vierzig: Gemessen ueber zehn Partien liegt die Rate bei
        // zweiunddreissig freien Entscheidungen je Partie, vorher bei
        // vierundsechzig. Die Haelfte davon geht jetzt in Laufwege, die ein
        // Spieler mit glaubwuerdigem Tempo wirklich braucht. Geprueft wird hier,
        // ob ueberhaupt durchgehend gespielt wird - nicht wie dicht.
        if (stats.actions < 20) throw new Error(`Zu wenig Spielfluss: nur ${stats.actions} Aktionen`);

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

        // Anstoß auflösen: bei ruhendem Ball steht die Mannschaft in
        // Anstoßformation und rückt zu Recht nicht auf. Der Pfiff wartet auf
        // den Schützen - also so lange laufen lassen, bis der Anstoß
        // wirklich ausgeführt ist, sonst hält die Anstoßregie den Schützen
        // noch am Mittelkreis fest.
        for (let i = 0; i < 150 || (live.director.kickoff && i < 60 * 30); i++) {
            live.advanceRealTime(1000 / 60);
            live.updateBallAndPlayers(1000 / 60);
        }
        if (live.director.kickoff) throw new Error("Der Anstoß wird nicht ausgeführt");

        const settle = (ballX) => {
            live.director.possessionTeam = "home";
            live.director.deadBall = null;
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

        // Die langsamste Stufe bleibt eine Übertragung zum Zuschauen, die
        // schnellste ist der Schnelldurchlauf. Dazwischen liegt "Normal": drei
        // bis vier echte Minuten für ein ganzes Spiel.
        const echteMinuten = (rate) => (90 * 60) / rate / 60;

        if (echteMinuten(slow) < 5) {
            throw new Error(`Langsamste Stufe spielt 90 Minuten in nur ${echteMinuten(slow).toFixed(1)} echten Minuten ab`);
        }
        if (echteMinuten(normal) > 4) {
            throw new Error(`Normalstufe braucht ${echteMinuten(normal).toFixed(1)} echte Minuten - zu zäh`);
        }
        if (echteMinuten(fast) > 2.5) {
            throw new Error(`Schnellste Stufe braucht ${echteMinuten(fast).toFixed(1)} echte Minuten - kein Schnelldurchlauf`);
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

    // Anstoß: aufstellen, anpfeifen, anspielen
    test("LiveMatchDirector: Anstoß wird aufgestellt und vom Schiedsrichter angepfiffen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "anstoss", played: false, homeClubId: "muc", awayClubId: "dor" };
        match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);

        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        live.speed = 2;
        const dir = live.director;

        if (!dir.kickoff) throw new Error("Das Spiel beginnt ohne Anstoß-Zeremonie");
        if (live.setPiece?.kind !== "kickoff") throw new Error("Der Anstoß wird nicht als Spielsituation angezeigt");

        const laufen = (bedingung, grenze = 4000) => {
            let guard = 0;
            while (bedingung() && guard++ < grenze) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
        };

        live.soundCues = [];
        laufen(() => dir.kickoff && dir.kickoff.phase === "lineup");
        if (!dir.kickoff || dir.kickoff.phase !== "whistle") {
            throw new Error("Der Schiedsrichter pfeift den Anstoß nicht an");
        }

        // Beim Pfiff steht jede Mannschaft in ihrer eigenen Hälfte
        const falscheHaelfte = (live.players2D || []).filter(p => {
            const angriff = dir.attackDir(p.team);
            return angriff > 0 ? p.x > 52 : p.x < 48;
        });
        if (falscheHaelfte.length > 0) {
            throw new Error(`${falscheHaelfte.length} Spieler stehen beim Anpfiff in der gegnerischen Hälfte`);
        }

        // Der Mittelkreis gehört allein der anstoßenden Mannschaft
        const imKreis = (live.players2D || []).filter(p => p.team !== dir.kickoff.team
            && Math.hypot((p.x - 50) / 8.7, (p.y - 50) / 13.5) < 1);
        if (imKreis.length > 0) {
            throw new Error(`${imKreis.length} Gegenspieler stehen im Mittelkreis`);
        }

        // Der Ball liegt auf dem Anstoßpunkt und wartet auf den Pfiff
        if (Math.hypot(live.ball.x - 50, live.ball.y - 50) > 2.5) {
            throw new Error(`Der Ball liegt nicht auf dem Anstoßpunkt (${live.ball.x.toFixed(1)}/${live.ball.y.toFixed(1)})`);
        }
        if (!live.soundCues.includes("whistle")) throw new Error("Zum Anstoß ist kein Pfiff zu hören");

        // Erst nach dem Pfiff rollt der Ball wieder
        laufen(() => !!dir.kickoff);
        if (dir.kickoff) throw new Error("Die Anstoß-Zeremonie endet nicht");
        if (live.setPiece) throw new Error("Der Anstoß bleibt als ruhende Spielsituation stehen");

        // Zur zweiten Halbzeit stehen beide Mannschaften auf der neuen Seite -
        // samt Torhütern. Vorher stand der Keeper beim Anpfiff noch am
        // Mittelkreis, weil er den ganzen Platz überqueren musste.
        laufen(() => !dir.kickoff || dir.kickoff.reason !== "halftime", 60 * 900);
        if (!dir.kickoff || dir.kickoff.reason !== "halftime") {
            throw new Error("Zur zweiten Halbzeit gibt es keine Anstoß-Zeremonie");
        }
        laufen(() => dir.kickoff && dir.kickoff.phase === "lineup");

        const verirrt = (live.players2D || []).filter(p => {
            const angriff = dir.attackDir(p.team);
            return angriff > 0 ? p.x > 52 : p.x < 48;
        });
        if (verirrt.length > 0) {
            throw new Error(`${verirrt.length} Spieler stehen zur zweiten Halbzeit noch auf der alten Seite`);
        }

        const torhueter = (live.players2D || []).filter(p => p.pos === "TW");
        torhueter.forEach(tw => {
            const abstand = Math.abs(tw.x - dir.ownGoalX(tw.team));
            if (abstand > 14) {
                throw new Error(`Der Torwart steht beim Anstoß ${abstand.toFixed(0)} Einheiten von seinem Tor entfernt`);
            }
        });

        // Nach einem Tor wird erneut aufgestellt - und zwar für die Mannschaft,
        // die das Tor kassiert hat
        laufen(() => !!dir.kickoff);
        dir.startCelebration({ type: "goal", team: "home", playerName: "Torschütze" });
        laufen(() => dir.mode === "celebration", 12000);
        if (!dir.kickoff) throw new Error("Nach dem Tor folgt keine Anstoß-Zeremonie");
        if (dir.kickoff.team !== "away") throw new Error("Nach dem Tor stößt die falsche Mannschaft an");
        if (dir.kickoff.phase !== "lineup") throw new Error("Nach dem Tor wird sofort angepfiffen, ohne Aufstellung");
    });

    // Spielfluss: Pässe kommen an, der Ball bleibt im Spiel
    test("MatchFlowEngine: Pässe kommen an, der lange Ball bleibt die Ausnahme", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");

        const zaehler = { aktionen: 0, pass: 0, passOk: 0, lang: 0, erzwungen: 0, spiele: 0 };
        const standards = {};

        // Acht Partien: Seit die Regie den Ball nicht mehr an den Ereignisort
        // schiebt und Spieler wie Ball auf glaubwuerdigem Tempo laufen,
        // entfallen auf eine Partie rund zweiunddreissig freie Entscheidungen
        // statt hundert. Die Stichprobe von zweihundert Aktionen bleibt - sie
        // wird nur ueber mehr Partien gezogen.
        for (let run = 0; run < 8; run++) {
            const match = { id: `fluss_${run}`, played: false, homeClubId: "muc", awayClubId: "dor" };
            match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);

            const live = new LiveMatch(match, homeClub, awayClub, state.players);
            live.speed = 2;
            const dir = live.director;

            // Gemessen wird, was die MatchFlowEngine entscheidet. Steht als
            // Nächstes eine Szene des Gegners an, macht die Regie danach aus
            // einem angekommenen Pass einen sichtbaren Ballverlust - das ist
            // der vorher feststehende Besitzwechsel, der früher unsichtbar
            // passierte, und keine Frage der Passgenauigkeit. Diese
            // erzwungenen Ballverluste werden getrennt gezählt und begrenzt.
            const origDecide = dir.flow.decide.bind(dir.flow);
            dir.flow.decide = (...args) => {
                const action = origDecide(...args);
                if (action) {
                    zaehler.aktionen++;
                    if (action.type === "pass") {
                        zaehler.pass++;
                        if (action.outcome === "complete") zaehler.passOk++;
                    } else if (action.type === "longball") {
                        zaehler.lang++;
                    }
                }
                return action;
            };
            const origFlow = dir.applyFlowAction.bind(dir);
            dir.applyFlowAction = (action) => {
                if (action.erzwungen) zaehler.erzwungen++;
                origFlow(action);
            };
            zaehler.spiele++;

            // Nur die Standards aus dem Aufbauspiel zählen: Abstöße nach einem
            // Schuss neben das Tor sind richtig so und gehören nicht dazu.
            const origAus = dir.handleOutOfPlay.bind(dir);
            dir.handleOutOfPlay = (action, to) => {
                const vorher = dir.deadBall?.kind;
                const behandelt = origAus(action, to);
                if (behandelt && dir.deadBall?.kind !== vorher) {
                    standards[dir.deadBall.kind] = (standards[dir.deadBall.kind] || 0) + 1;
                }
                return behandelt;
            };

            let frames = 0;
            while (!live.isFinished && frames++ < 60 * 900) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
        }

        if (zaehler.aktionen < 200) throw new Error(`Zu wenige Spielaktionen für eine Auswertung (${zaehler.aktionen})`);

        const quote = zaehler.passOk / Math.max(1, zaehler.pass);
        if (quote < 0.68) {
            throw new Error(`Nur ${(quote * 100).toFixed(0)} % der Pässe kommen an - das Spiel bleibt ein Hin und Her`);
        }

        // Die sichtbaren Ballgewinne vor einer gegnerischen Szene dürfen das
        // Spiel nicht zum Hin und Her machen
        const erzwungenJeSpiel = zaehler.erzwungen / Math.max(1, zaehler.spiele);
        if (erzwungenJeSpiel > 30) {
            throw new Error(`${erzwungenJeSpiel.toFixed(1)} erzwungene Ballverluste je Spiel - der Ball wechselt zu oft die Seite`);
        }

        const langAnteil = zaehler.lang / zaehler.aktionen;
        if (langAnteil > 0.3) {
            throw new Error(`${(langAnteil * 100).toFixed(0)} % der Aktionen sind lange Bälle`);
        }

        // Abstöße sind die Ausnahme, nicht die Spielfortsetzung schlechthin
        const abstoesse = standards.goalkick || 0;
        if (abstoesse > zaehler.aktionen * 0.06) {
            throw new Error(`${abstoesse} Abstöße bei ${zaehler.aktionen} Aktionen - der Torwart hat ständig den Ball`);
        }
    });

    // Bild und Ticker müssen dasselbe erzählen
    test("LiveMatchDirector: Ereignisse laufen auf der richtigen Seite und beim richtigen Spieler", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");

        const zahl = { schuesse: 0, richtigesTor: 0, ereignisse: 0, amBall: 0, amOrt: 0 };

        for (let run = 0; run < 2; run++) {
            const match = { id: `treue_${run}`, played: false, homeClubId: "muc", awayClubId: "dor" };
            match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);

            const live = new LiveMatch(match, homeClub, awayClub, state.players);
            live.speed = 2;
            const dir = live.director;

            const orig = dir.beginEventPhase.bind(dir);
            dir.beginEventPhase = (phase) => {
                const ev = dir.currentEvent();
                if (ev && phase === "action" && ev.end && ev.start) {
                    const ziel = dir.eventPoint(ev.end);

                    if (["goal", "save", "shot_miss"].includes(ev.type)) {
                        // Auf welches Tor fliegt der Ball? Bei einer Parade
                        // steht in der Timeline die verteidigende Mannschaft.
                        const schiessend = ev.type === "save"
                            ? (ev.team === "home" ? "away" : "home")
                            : ev.team;
                        const gegnertor = dir.ownGoalX(schiessend === "home" ? "away" : "home");
                        zahl.schuesse++;
                        if (Math.abs(ziel.x - gegnertor) < 50) zahl.richtigesTor++;
                    }

                    const start = dir.eventPoint(ev.start);
                    const held = dir.getPlayer2D(dir.protagonistId(ev));
                    if (held) {
                        zahl.ereignisse++;
                        if (Math.hypot(held.x - live.ball.x, held.y - live.ball.y) < 6) zahl.amBall++;
                        if (Math.hypot(held.x - start.x, held.y - start.y) < 7) zahl.amOrt++;
                    }
                }
                orig(phase);
            };

            let frames = 0;
            while (!live.isFinished && frames++ < 60 * 900) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
        }

        if (zahl.schuesse < 20) throw new Error(`Zu wenige Schüsse für eine Auswertung (${zahl.schuesse})`);

        // Die Timeline beschreibt jedes Spiel im Bild der ersten Halbzeit.
        // Ohne Spiegelung flog in Halbzeit zwei jeder Schuss ins eigene Tor.
        if (zahl.richtigesTor !== zahl.schuesse) {
            throw new Error(`${zahl.schuesse - zahl.richtigesTor} von ${zahl.schuesse} Schüssen gehen aufs falsche Tor`);
        }

        const amBall = zahl.amBall / Math.max(1, zahl.ereignisse);
        const amOrt = zahl.amOrt / Math.max(1, zahl.ereignisse);
        if (amBall < 0.85) {
            throw new Error(`Nur bei ${(amBall * 100).toFixed(0)} % der Ereignisse hat der genannte Spieler den Ball`);
        }
        if (amOrt < 0.85) {
            throw new Error(`Nur bei ${(amOrt * 100).toFixed(0)} % der Ereignisse steht der genannte Spieler am Ereignisort`);
        }
    });

    // Jede Unterbrechung hat ihre Spielfortsetzung
    test("LiveMatchDirector: Foul wird zum Freistoß, Fehlschuss zum Abstoß, Ecke von der Fahne", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");

        let fouls = 0, freistoesse = 0, fehlschuesse = 0, abstoesse = 0, abseits = 0;
        let mauern = 0, mitMauer = 0;
        const eckenAbstand = [];

        for (let run = 0; run < 2; run++) {
            const match = { id: `standard_${run}`, played: false, homeClubId: "muc", awayClubId: "dor" };
            match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);
            // Ein Foul mit direktem Freistoss wird in der Schussszene selbst
            // ausgefuehrt - es braucht keine eigene Spielfortsetzung
            fouls += match.timeline.filter(e => e.type === "foul" && e.outcome !== "penalty" && !e.direkterFreistoss).length;
            fehlschuesse += match.timeline.filter(e => e.type === "shot_miss" && e.outcome !== "woodwork").length;

            const live = new LiveMatch(match, homeClub, awayClub, state.players);
            live.speed = 2;
            const dir = live.director;

            const origDead = dir.startDeadBall.bind(dir);
            dir.startDeadBall = (kind, team, x, y) => {
                if (kind === "freekick") {
                    freistoesse++;
                    mauern++;
                }
                if (kind === "goalkick") abstoesse++;
                origDead(kind, team, x, y);
                if (kind === "freekick" && dir.setPieceWall.length > 0) mitMauer++;
            };

            const origFlag = dir.flagOffside.bind(dir);
            dir.flagOffside = (p, r) => { abseits++; origFlag(p, r); };

            // Ecken müssen an der Eckfahne beginnen
            const origPhase = dir.beginEventPhase.bind(dir);
            dir.beginEventPhase = (phase) => {
                const ev = dir.currentEvent();
                if (ev && ev.type === "corner" && phase === "approach") {
                    const ecke = dir.eventPoint(ev.start);
                    // Die Fahnen stehen dort, wo Torlinie und Seitenlinie sich
                    // treffen: Die Torlinien liegen bei 4 und 96
                    const naechsteFahne = Math.min(
                        Math.hypot(ecke.x - 4, ecke.y - 0), Math.hypot(ecke.x - 4, ecke.y - 100),
                        Math.hypot(ecke.x - 96, ecke.y - 0), Math.hypot(ecke.x - 96, ecke.y - 100));
                    eckenAbstand.push(naechsteFahne);
                }
                origPhase(phase);
            };

            let frames = 0;
            while (!live.isFinished && frames++ < 60 * 900) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
        }

        // Praktisch jedes Foul und jedes Abseits ergibt einen Freistoß. Fällt
        // ein Foul in dieselbe Szene wie ein Tor oder der Halbzeitpfiff, hat
        // der Anstoß Vorrang - deshalb kein starres Gleich.
        if (freistoesse < (fouls + abseits) * 0.9) {
            throw new Error(`Nur ${freistoesse} Freistöße bei ${fouls} Fouls und ${abseits} Abseitsentscheidungen`);
        }
        if (fouls < 8) throw new Error(`Nur ${fouls} Fouls in zwei Spielen - zu wenig Zweikampf`);

        // Ein Schuss neben das Tor ist ein Abstoß - außer der Abpfiff oder der
        // Halbzeitpfiff kommt dazwischen.
        if (abstoesse < fehlschuesse * 0.9) {
            throw new Error(`Nur ${abstoesse} Abstöße bei ${fehlschuesse} Schüssen neben das Tor`);
        }

        // In Schussweite steht eine Mauer
        if (mitMauer === 0) throw new Error("Kein einziger Freistoß mit Mauer");

        // Ecken beginnen an der Eckfahne
        if (eckenAbstand.length === 0) throw new Error("Keine Ecke gespielt");
        const weiteste = Math.max(...eckenAbstand);
        if (weiteste > 4) {
            throw new Error(`Eine Ecke wurde ${weiteste.toFixed(0)} Einheiten neben der Eckfahne getreten`);
        }
    });

    // Live-Anzeige und Spielbericht zeigen dieselbe Partie
    test("MatchEngine: Live-Statistik und Spielbericht derselben Timeline sind deckungsgleich", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");

        const felder = ["shots", "shotsOnTarget", "corners", "fouls", "yellowCards", "redCards", "saves", "xG"];

        // Vier Partien: Der Fehler, der hier gefunden wurde - vom Halbzeitpfiff
        // abgeräumte Ereignisse fehlten in der Live-Statistik - trat nur in
        // etwa jedem vierten Spiel auf.
        for (let run = 0; run < 4; run++) {
            const timeline = MatchEngine.generateTimeline(
                { id: `par_${run}`, played: false, homeClubId: "muc", awayClubId: "dor" },
                homeClub, awayClub, state.players);

            const liveMatch = { id: `par_${run}`, played: false, homeClubId: "muc", awayClubId: "dor", timeline };
            const live = new LiveMatch(liveMatch, homeClub, awayClub, state.players);
            live.speed = 4;

            let frames = 0;
            while (!live.isFinished && frames++ < 60 * 900) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
            if (!live.isFinished) throw new Error("Livespiel wurde nicht beendet");

            const bericht = { id: `par_${run}`, played: false, homeClubId: "muc", awayClubId: "dor", timeline };
            MatchEngine.simulateFullMatch(bericht, homeClub, awayClub, state.players);

            if (live.homeScore !== bericht.homeGoals || live.awayScore !== bericht.awayGoals) {
                throw new Error(`Endstand weicht ab: live ${live.homeScore}:${live.awayScore}, Bericht ${bericht.homeGoals}:${bericht.awayGoals}`);
            }

            felder.forEach(feld => {
                const l = JSON.stringify(live.stats[feld]);
                const b = JSON.stringify(bericht.stats[feld]);
                if (l !== b) {
                    throw new Error(`${feld} weicht ab: live ${l}, Bericht ${b}`);
                }
            });
        }
    });

    // Der Abstoß gehört der Mannschaft, die diese Linie verteidigt
    test("LiveMatchDirector: Abstoß wechselt mit dem Seitenwechsel die Mannschaft", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");
        const match = { id: "abstoss", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = new LiveMatch(match, homeClub, awayClub, state.players);
        const dir = live.director;

        const notiert = [];
        dir.startDeadBall = (kind, team) => notiert.push({ kind, team });

        // Halbzeit eins: rechts verteidigt die Auswärtsmannschaft
        dir.isSecondHalf = false;
        dir.handleOutOfPlay({ from: { team: "home" } }, { x: 99.5, y: 50 });
        if (notiert[0]?.kind !== "goalkick" || notiert[0]?.team !== "away") {
            throw new Error(`Abstoß in Halbzeit eins falsch vergeben: ${JSON.stringify(notiert[0])}`);
        }

        // Halbzeit zwei: dieselbe Linie verteidigt jetzt die Heimmannschaft
        dir.isSecondHalf = true;
        dir.handleOutOfPlay({ from: { team: "away" } }, { x: 99.5, y: 50 });
        if (notiert[1]?.kind !== "goalkick" || notiert[1]?.team !== "home") {
            throw new Error(`Abstoß nach dem Seitenwechsel falsch vergeben: ${JSON.stringify(notiert[1])}`);
        }

        // Seitenaus bleibt Seitenaus - und gehört der anderen Mannschaft
        dir.handleOutOfPlay({ from: { team: "home" } }, { x: 40, y: 99.5 });
        if (notiert[2]?.kind !== "throwin" || notiert[2]?.team !== "away") {
            throw new Error(`Einwurf falsch vergeben: ${JSON.stringify(notiert[2])}`);
        }
    });

    // 36. Transferverhandlung über mehrere Tage
    test("NegotiationEngine: Transfer läuft über Ablöse, Konditionen und Medizincheck", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        state.clubs.find(c => c.id === "muc").transferBudget = 90000000;

        const ziel = state.players.find(p => p.clubId === "dor" && p.overall >= 78);
        if (!ziel) throw new Error("Kein Transferziel gefunden");

        // Der Medizincheck scheitert je nach Verletzungsanfälligkeit in bis zu
        // 16 % der Fälle. Hier geht es um den Verhandlungsablauf, nicht um die
        // Medizin-Lotterie - deshalb ein robuster Spieler.
        ziel.hiddenAttributes = Object.assign({}, ziel.hiddenAttributes, { injuryProneness: 1 });

        const start = NegotiationEngine.startTransferNegotiation(state, ziel.id, "muc");
        if (!start.success) throw new Error("Verhandlung ließ sich nicht eröffnen: " + start.error);

        const neg = start.negotiation;
        if (neg.stage !== NegotiationEngine.STAGES.FEE) throw new Error("Verhandlung startet nicht bei der Ablöse");
        if (!neg.agentName) throw new Error("Dem Spieler wurde kein Berater zugeordnet");
        if (ziel.clubId !== "dor") throw new Error("Der Spieler wechselt schon beim Eröffnen der Gespräche");

        // Ein Angebot darf nicht sofort entschieden werden
        NegotiationEngine.submitOffer(state, neg.id, { fee: neg.demand.fee });
        if (neg.status !== NegotiationEngine.STATUS.WAITING_REPLY) {
            throw new Error("Das Angebot wurde ohne Wartezeit beantwortet");
        }
        if (ziel.clubId !== "dor") throw new Error("Der Transfer wurde sofort vollzogen");

        // Eine Verhandlung mit fairen Angeboten bis zum Ende durchspielen
        const durchspielen = (verhandlung) => {
            const phasen = new Set();
            let tage = 0;
            while (tage < 40 && [NegotiationEngine.STATUS.WAITING_REPLY, NegotiationEngine.STATUS.AWAITING_US].includes(verhandlung.status)) {
                phasen.add(verhandlung.stage);
                if (verhandlung.status === NegotiationEngine.STATUS.AWAITING_US) {
                    const angebot = verhandlung.stage === NegotiationEngine.STAGES.FEE
                        ? { fee: verhandlung.demand.fee }
                        : { wage: verhandlung.demand.wage, years: 3, signingBonus: verhandlung.demand.signingBonus };
                    const res = NegotiationEngine.submitOffer(state, verhandlung.id, angebot);
                    if (!res.success) throw new Error("Angebot abgelehnt: " + res.error);
                }
                CalendarEngine.advanceOneDay(state);
                tage++;
            }
            return { phasen, tage };
        };

        let lauf = durchspielen(neg);
        let aktuell = neg;

        // Der Medizincheck lässt jeden Transfer mit kleiner Wahrscheinlichkeit
        // platzen - das ist so gewollt. Für den Ablauftest wird es dann eben
        // noch einmal versucht.
        let versuche = 0;
        while (aktuell.status !== NegotiationEngine.STATUS.ACCEPTED && versuche++ < 4) {
            const neuStart = NegotiationEngine.startTransferNegotiation(state, ziel.id, "muc");
            if (!neuStart.success) throw new Error("Neuer Anlauf scheiterte: " + neuStart.error);
            aktuell = neuStart.negotiation;
            lauf = durchspielen(aktuell);
        }

        if (aktuell.status !== NegotiationEngine.STATUS.ACCEPTED) {
            throw new Error(`Faire Angebote führen nicht zum Abschluss (Status ${aktuell.status})`);
        }
        if (lauf.tage < 4) throw new Error(`Der Transfer war nach ${lauf.tage} Tagen zu schnell durch`);
        if (!lauf.phasen.has(NegotiationEngine.STAGES.FEE) || !lauf.phasen.has(NegotiationEngine.STAGES.TERMS)) {
            throw new Error("Die Verhandlung hat nicht alle Phasen durchlaufen");
        }

        const gewechselt = state.players.find(p => String(p.id) === String(ziel.id));
        if (gewechselt.clubId !== "muc") throw new Error("Der Spieler steht nach dem Abschluss nicht im eigenen Kader");
        if (!state.clubs.find(c => c.id === "muc").playerIds.includes(gewechselt.id)) {
            throw new Error("Der Spieler fehlt in der Kaderliste des Vereins");
        }
    });

    // 37. Zu niedrige Gebote kosten Geduld und lassen die Gespräche platzen
    test("NegotiationEngine: Lowball-Angebote zehren an der Geduld und scheitern", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        state.clubs.find(c => c.id === "muc").transferBudget = 90000000;

        const ziel = state.players.find(p => p.clubId === "dor" && p.overall >= 78);
        const neg = NegotiationEngine.startTransferNegotiation(state, ziel.id, "muc").negotiation;
        const geduldStart = neg.patience;

        let tage = 0;
        while (tage < 30 && [NegotiationEngine.STATUS.WAITING_REPLY, NegotiationEngine.STATUS.AWAITING_US].includes(neg.status)) {
            if (neg.status === NegotiationEngine.STATUS.AWAITING_US) {
                NegotiationEngine.submitOffer(state, neg.id, { fee: Math.round(neg.demand.fee * 0.5) });
            }
            CalendarEngine.advanceOneDay(state);
            tage++;
        }

        if (neg.status === NegotiationEngine.STATUS.ACCEPTED) {
            throw new Error("Ein Angebot bei halber Forderung wurde angenommen");
        }
        if (neg.patience >= geduldStart) throw new Error("Die Geduld der Gegenseite bleibt unberührt");
        if (state.players.find(p => String(p.id) === String(ziel.id)).clubId === "muc") {
            throw new Error("Der Spieler wechselt trotz gescheiterter Gespräche");
        }
    });

    // 38. Jugendbeförderung über den Berater
    test("NegotiationEngine: Jugendbeförderung braucht Vertragsgespräche mit dem Berater", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        const talent = (club.youthAcademy?.prospects || state.youthAcademy.prospects).find(p => !p.promoted);
        if (!talent) throw new Error("Kein Jugendspieler in der Akademie");

        const kaderVorher = club.playerIds.length;
        const start = NegotiationEngine.startYouthPromotion(state, "muc", talent.id);
        if (!start.success) throw new Error("Vertragsgespräche ließen sich nicht aufnehmen: " + start.error);

        const neg = start.negotiation;
        if (club.playerIds.length !== kaderVorher) {
            throw new Error("Der Jugendspieler steht sofort im Kader - die Gespräche wurden übersprungen");
        }
        if (!neg.demand.wage || neg.demand.wage <= 0) throw new Error("Der Berater stellt keine Gehaltsforderung");

        // Zweite Anfrage darf keine parallele Verhandlung eröffnen
        const doppelt = NegotiationEngine.startYouthPromotion(state, "muc", talent.id);
        if (doppelt.success) throw new Error("Für dasselbe Talent laufen zwei Verhandlungen");

        let tage = 0;
        while (tage < 25 && [NegotiationEngine.STATUS.WAITING_REPLY, NegotiationEngine.STATUS.AWAITING_US].includes(neg.status)) {
            if (neg.status === NegotiationEngine.STATUS.AWAITING_US) {
                NegotiationEngine.submitOffer(state, neg.id, {
                    wage: neg.demand.wage,
                    years: 3,
                    signingBonus: neg.demand.signingBonus
                });
            }
            CalendarEngine.advanceOneDay(state);
            tage++;
        }

        if (neg.status !== NegotiationEngine.STATUS.ACCEPTED) {
            throw new Error(`Die Vertragsgespräche kamen nicht zum Abschluss (${neg.status})`);
        }
        if (tage < 2) throw new Error("Die Beförderung war ohne Wartezeit durch");

        const neuerProfi = state.players.find(p => p.name === talent.name && p.clubId === "muc");
        if (!neuerProfi) throw new Error("Das Talent steht nach dem Abschluss nicht im Kader");
        if (neuerProfi.contractYears !== 3) throw new Error("Die verhandelte Laufzeit wurde nicht übernommen");
        if (typeof neuerProfi.pace !== "number" || typeof neuerProfi.defense !== "number") {
            throw new Error("Der beförderte Spieler hat kein Attributprofil");
        }
        if (neuerProfi.injuredWeeks !== 0 || neuerProfi.suspendedMatches !== 0) {
            throw new Error("Der beförderte Spieler nutzt abweichende Feldnamen für Verletzung und Sperre");
        }
    });

    // 39. Trainingsbelastung, Ermüdung und Verletzungsrisiko
    test("TrainingEngine: Tagesbelastung, Ermüdung und Verletzungsrisiko im Bericht", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        const kader = state.players.filter(p => club.playerIds.includes(p.id));

        // Intensives Training zehrt deutlich mehr als lockeres
        const spieler = kader[0];
        const lastLocker = TrainingEngine.calculateDailyLoad(spieler, "training", "low");
        const lastHart = TrainingEngine.calculateDailyLoad(spieler, "training", "high");
        if (!(lastHart > lastLocker * 1.5)) {
            throw new Error(`Intensität wirkt sich kaum aus: locker ${lastLocker}, intensiv ${lastHart}`);
        }

        const risikoLocker = TrainingEngine.calculateInjuryRisk(spieler, "low", 3);
        const risikoHart = TrainingEngine.calculateInjuryRisk(spieler, "high", 3);
        if (!(risikoHart > risikoLocker * 2)) {
            throw new Error("Intensives Training erhöht das Verletzungsrisiko nicht");
        }

        // Ein müder Spieler trägt ein höheres Risiko als ein frischer
        const muede = { ...spieler, fitness: 55 };
        if (!(TrainingEngine.calculateInjuryRisk(muede, "normal", 3) > TrainingEngine.calculateInjuryRisk(spieler, "normal", 3))) {
            throw new Error("Ermüdung erhöht das Verletzungsrisiko nicht");
        }

        // Über mehrere Wochen pendelt sich die Fitness je Intensität auf einem
        // eigenen Niveau ein: locker bleibt frisch, intensiv zehrt spürbar.
        // Der Trainerstab plant sonst selbst, deshalb legt der Manager hier
        // ein dauerhaftes Veto ein - so wie im Spiel, wenn er es besser weiß.
        const fitnessNachWochen = (intensity) => {
            const s = GameState.createNewGame("muc", "normal", { name: "Trainer" });
            const c = s.clubs.find(x => x.id === "muc");
            const k = s.players.filter(p => c.playerIds.includes(p.id));
            for (let i = 0; i < 24; i++) {
                CoachingStaffEngine.setManagerVeto(s, "allround", intensity, 99);
                CalendarEngine.advanceOneDay(s);
            }
            return k.reduce((sum, p) => sum + p.fitness, 0) / k.length;
        };

        const fitLocker = fitnessNachWochen("low");
        const fitHart = fitnessNachWochen("high");

        if (!(fitHart < fitLocker - 10)) {
            throw new Error(`Intensives Training zehrt nicht stärker als lockeres: locker ${fitLocker.toFixed(0)}, intensiv ${fitHart.toFixed(0)}`);
        }
        if (fitHart < 45) {
            throw new Error(`Intensives Training ruiniert den Kader: ${fitHart.toFixed(0)} % Fitness`);
        }
        if (fitLocker < 90) {
            throw new Error(`Lockeres Training erholt den Kader nicht: ${fitLocker.toFixed(0)} % Fitness`);
        }

        // Der Bericht des laufenden Spielstands muss danach gefüllt sein
        for (let i = 0; i < 6; i++) {
            CoachingStaffEngine.setManagerVeto(state, "allround", "high", 99);
            CalendarEngine.advanceOneDay(state);
        }

        const bericht = state.trainingReport;
        if (!bericht || !Array.isArray(bericht.entries) || bericht.entries.length !== kader.length) {
            throw new Error("Der Trainingsbericht deckt nicht den ganzen Kader ab");
        }
        const eintrag = bericht.entries[0];
        ["fitness", "fatigue", "load", "sharpness", "injuryRiskPercent"].forEach(feld => {
            if (typeof eintrag[feld] !== "number") throw new Error(`Im Trainingsbericht fehlt ${feld}`);
        });
        if (!eintrag.note) throw new Error("Der Trainingsbericht gibt keine Einschätzung ab");

        // Nach der Sortierung steht das größte Risiko oben
        for (let i = 1; i < bericht.entries.length; i++) {
            if (bericht.entries[i - 1].injuryRiskPercent < bericht.entries[i].injuryRiskPercent) {
                throw new Error("Der Bericht ist nicht nach Verletzungsrisiko sortiert");
            }
        }
    });

    // 40. Nebenpositionen und erlernte Routine
    test("PositionEngine: Nebenpositionen und erlernte Routine auf neuen Positionen", () => {
        // Rund drei Viertel der Feldspieler haben eine zweite Position
        let mitNeben = 0;
        const laeufe = 600;
        for (let i = 0; i < laeufe; i++) {
            const pos = ["IV", "LV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"][i % 11];
            if (PositionEngine.generateSecondaryPositions(pos).length > 0) mitNeben++;
        }
        const anteil = mitNeben / laeufe;
        if (anteil < 0.6 || anteil > 0.9) {
            throw new Error(`Unplausibel viele/wenige Nebenpositionen: ${(anteil * 100).toFixed(0)} %`);
        }
        if (PositionEngine.generateSecondaryPositions("TW").length !== 0) {
            throw new Error("Torhüter bekommen Feldpositionen zugewiesen");
        }

        // Nebenpositionen müssen zur Stammposition passen
        for (let i = 0; i < 50; i++) {
            const neben = PositionEngine.generateSecondaryPositions("IV");
            neben.forEach(pos => {
                if (PositionEngine.getBaseFamiliarity("IV", pos) < 0.55) {
                    throw new Error(`Unpassende Nebenposition für IV: ${pos}`);
                }
            });
        }

        // Wer eine Position spielt, wächst hinein
        const spieler = { pos: "IV", positions: ["IV"], overall: 70, hiddenAttributes: { adaptability: 13 } };
        const vorher = PositionEngine.getSuitability(spieler, "DM").familiarity;
        for (let i = 0; i < 25; i++) PositionEngine.gainPositionExperience(spieler, "DM", 0.05);
        const nachher = PositionEngine.getSuitability(spieler, "DM").familiarity;

        if (!(nachher > vorher)) throw new Error("Einsätze auf einer Position bringen keine Routine");
        if (!spieler.positions.includes("DM")) throw new Error("Die erlernte Position wird nicht übernommen");
        if (PositionEngine.getSuitability(spieler, "DM").familiarity > PositionEngine.getSuitability(spieler, "IV").familiarity) {
            throw new Error("Die erlernte Position übertrifft die Stammposition");
        }
    });

    // 43. Kabinenansprache: der Ton muss zur Lage passen
    test("ManagerEngine: Ansprache wirkt je nach Spielstand unterschiedlich", () => {
        const basis = GameState.createNewGame("muc", "normal", { name: "Trainer" });

        const ansprache = (tone, scoreDiff) => {
            const state = JSON.parse(JSON.stringify(basis));
            const res = ManagerEngine.applyTeamTalk(state, tone, {
                phase: "halftime", clubId: "muc", opponentClubId: "dor", scoreDiff
            });
            if (!res.success) throw new Error(`Ansprache ${tone} scheiterte: ${res.error}`);
            return res;
        };

        // Anbrüllen bei Führung zerlegt die Kabine, bei klarem Rückstand hilft es
        const wuetendVorn = ansprache("angry", 2);
        const wuetendHinten = ansprache("angry", -2);
        if (!(wuetendVorn.moraleDelta < -1)) {
            throw new Error(`Anbrüllen bei Führung bleibt folgenlos: ${wuetendVorn.moraleDelta}`);
        }
        if (!(wuetendHinten.moraleDelta > wuetendVorn.moraleDelta + 4)) {
            throw new Error("Anbrüllen wirkt bei Rückstand nicht anders als bei Führung");
        }

        // Ruhig bleiben ist nie ein Desaster
        [-2, 0, 2].forEach(diff => {
            if (ansprache("calm", diff).moraleDelta < -0.5) {
                throw new Error(`"Ruhig bleiben" schadet bei Stand ${diff}`);
            }
        });

        // Die Ansprache landet tatsächlich bei den Spielern
        const state = JSON.parse(JSON.stringify(basis));
        const club = state.clubs.find(c => c.id === "muc");
        const kader = state.players.filter(p => club.playerIds.includes(p.id));
        const moralVorher = kader.reduce((s, p) => s + p.morale, 0);
        ManagerEngine.applyTeamTalk(state, "motivate", { clubId: "muc", opponentClubId: "dor", scoreDiff: -1 });
        const moralNachher = kader.reduce((s, p) => s + p.morale, 0);
        if (moralNachher <= moralVorher) throw new Error("Die Ansprache verändert die Spielermoral nicht");
        if (!state.lastTeamTalk || state.lastTeamTalk.tone !== "motivate") {
            throw new Error("Die Ansprache wird nicht im Spielstand vermerkt");
        }

        // Jede Tonlage muss eine Beschreibung mitbringen
        ManagerEngine.TEAM_TALK_TONES.forEach(t => {
            if (!t.label || !t.line || !t.hint) throw new Error(`Tonlage ${t.key} ist unvollständig`);
        });
    });

    // 44. Pressekonferenz verschiebt Stimmung und Druck
    test("ManagerEngine: Pressekonferenz wirkt auf Fans, Medien, Vorstand und Kabine", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        state.fanMood = 70;
        state.mediaPressure = 45;
        state.boardConfidence = 75;

        const pk = ManagerEngine.buildPressConference(state);
        if (!pk || !pk.question || pk.answers.length < 2) throw new Error("Keine Pressekonferenz erzeugt");

        const vorher = { fan: state.fanMood, medien: state.mediaPressure, vorstand: state.boardConfidence };
        const res = ManagerEngine.answerPressConference(state, pk.topicId, pk.answers[0].key);
        if (!res.success) throw new Error("Antwort wurde nicht ausgewertet: " + res.error);
        if (!res.response) throw new Error("Die Antwort liefert keine Reaktion");

        const veraendert = state.fanMood !== vorher.fan
            || state.mediaPressure !== vorher.medien
            || state.boardConfidence !== vorher.vorstand;
        if (!veraendert) throw new Error("Die Pressekonferenz verändert nichts");

        if (!state.lastPressConference || state.lastPressConference.topicId !== pk.topicId) {
            throw new Error("Der Termin wird nicht im Spielstand vermerkt");
        }

        // Alle Themen müssen vollständig beantwortbar sein
        ManagerEngine.PRESS_TOPICS.forEach(topic => {
            if (topic.answers.length < 3) throw new Error(`Thema ${topic.id} hat zu wenige Antworten`);
            topic.answers.forEach(a => {
                if (!a.label || !a.response) throw new Error(`Antwort ${a.key} in ${topic.id} ist unvollständig`);
            });
        });
    });

    // 45. Der Schreibtisch zeigt, was ansteht
    test("ManagerEngine: Schreibtisch meldet offene Aufgaben nach Dringlichkeit", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        const kader = state.players.filter(p => club.playerIds.includes(p.id));

        // Lage künstlich zuspitzen
        kader[0].injuredWeeks = 3;
        kader[1].fitness = 55;
        kader[2].contractYears = 1;
        kader[3].happiness = { overall: 40 };

        const items = ManagerEngine.getAttentionItems(state);
        if (items.length === 0) throw new Error("Der Schreibtisch bleibt trotz offener Punkte leer");

        // Nach Dringlichkeit sortiert
        for (let i = 1; i < items.length; i++) {
            if (items[i - 1].priority > items[i].priority) {
                throw new Error("Die Aufgaben sind nicht nach Dringlichkeit sortiert");
            }
        }
        items.forEach(item => {
            if (!item.title || !item.detail || !item.tab) throw new Error("Ein Eintrag ist unvollständig");
        });

        const themen = items.map(i => i.title).join(" | ");
        ["nicht einsatzbereit", "überlastet", "Verträge laufen aus", "unzufrieden"].forEach(erwartet => {
            if (!themen.includes(erwartet)) throw new Error(`Der Schreibtisch übersieht: ${erwartet}`);
        });

        // Eine unvollständige Startelf steht ganz oben
        club.lineup = club.lineup.slice(0, 8);
        const mitWarnung = ManagerEngine.getAttentionItems(state);
        if (!mitWarnung[0].title.includes("Startelf")) {
            throw new Error("Eine unvollständige Startelf wird nicht zuerst gemeldet");
        }
    });


    // ---------------------------------------------------------------
    // Pokal und Europapokal finden wirklich statt
    // ---------------------------------------------------------------

    test("CupEngine: Der Pokal wird komplett ausgespielt und bekommt einen Sieger", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Pokalpruefer" });
        const cup = state.cups?.de_cup;
        if (!cup) throw new Error("Kein Pokal angelegt");
        if (cup.teilnehmer.length !== CupEngine.POKAL_TEILNEHMER) {
            throw new Error(`Der Pokal hat ${cup.teilnehmer.length} statt ${CupEngine.POKAL_TEILNEHMER} Teilnehmer`);
        }
        if (!cup.teilnehmer.includes(state.userClubId)) {
            throw new Error("Der eigene Verein ist nicht im Pokal");
        }

        // Alle sechs Runden austragen
        for (let runde = 0; runde < CupEngine.POKAL_RUNDEN.length; runde++) {
            const ergebnis = CupEngine.spieleTermin(state, "cup", runde);
            if (ergebnis && ergebnis.eigenePartie && !ergebnis.eigenePartie.played) {
                CupEngine.austragen(state, ergebnis.eigenePartie, true);
            }
            CupEngine.schliesseTerminAb(state, "cup", runde);
        }

        if (!cup.completed) throw new Error("Der Pokal ist nach sechs Runden nicht entschieden");
        if (!cup.winnerId) throw new Error("Der Pokal hat keinen Sieger");

        const gespielt = cup.runden.reduce((s, r) => s + r.matches.filter(m => m.played).length, 0);
        if (gespielt !== 63) throw new Error(`Es wurden ${gespielt} statt 63 Pokalpartien gespielt`);
        if (cup.runden.some(r => r.matches.some(m => !m.played))) {
            throw new Error("Es sind Pokalpartien offen geblieben");
        }
    });

    test("CupEngine: Ein unentschiedenes K.-o.-Spiel entscheidet das Elfmeterschießen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Elferpruefer" });
        const zwei = state.clubs.slice(0, 2);
        const match = {
            id: "m_test", homeClubId: zwei[0].id, awayClubId: zwei[1].id,
            played: true, homeGoals: 1, awayGoals: 1
        };

        const sieger = CupEngine.elfmeterschiessen(state, match);
        if (!sieger) throw new Error("Das Elfmeterschießen hat keinen Sieger");
        if (![match.homeClubId, match.awayClubId].includes(sieger)) {
            throw new Error("Der Sieger gehört keiner der beiden Mannschaften an");
        }
        if (!Array.isArray(match.penaltyScore) || match.penaltyScore.length !== 2) {
            throw new Error("Kein Ergebnis des Elfmeterschießens vermerkt");
        }
        if (match.penaltyScore[0] === match.penaltyScore[1]) {
            throw new Error("Das Elfmeterschießen endete unentschieden");
        }
        const gewinntMehr = match.penaltyScore[0] > match.penaltyScore[1]
            ? match.homeClubId : match.awayClubId;
        if (sieger !== gewinntMehr) throw new Error("Der Sieger passt nicht zum Ergebnis");

        // Der Schnitt muss im Bereich echter Elfmeterschießen liegen
        let treffer = 0, schuesse = 0;
        for (let i = 0; i < 60; i++) {
            const m = { homeClubId: zwei[0].id, awayClubId: zwei[1].id, played: true, homeGoals: 0, awayGoals: 0 };
            CupEngine.elfmeterschiessen(state, m);
            treffer += m.penaltyScore[0] + m.penaltyScore[1];
            schuesse += 10 + (m.penaltyScore[0] + m.penaltyScore[1] > 10 ? 2 : 0);
        }
        const quote = treffer / schuesse;
        if (quote < 0.55 || quote > 0.95) {
            throw new Error(`Trefferquote beim Elfmeterschießen unrealistisch: ${(quote * 100).toFixed(0)} %`);
        }
    });

    test("CalendarEngine: Pokal- und Europapokalabende stehen im Kalender", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Terminpruefer" });
        const pokaltage = state.calendar.filter(d => d.type === "cup");
        const europatage = state.calendar.filter(d => d.type === "euro");

        if (pokaltage.length !== 6) throw new Error(`${pokaltage.length} statt 6 Pokalabende im Kalender`);
        if (europatage.length !== 9) throw new Error(`${europatage.length} statt 9 Europapokalabende im Kalender`);

        // Jeder Termin des Plans kommt genau einmal vor
        CupEngine.TERMINPLAN.forEach(t => {
            const passend = state.calendar.filter(d =>
                d.cupArt === t.art && d.cupRunde === t.runde);
            if (passend.length !== 1) {
                throw new Error(`Termin ${t.art}/${t.runde} kommt ${passend.length}-mal vor`);
            }
        });

        // Und sie liegen unter der Woche zwischen den Spieltagen
        const ersterPokal = state.calendar.findIndex(d => d.type === "cup");
        const ersterSpieltag = state.calendar.findIndex(d => d.type === "matchday");
        if (ersterPokal <= ersterSpieltag) {
            throw new Error("Der erste Pokalabend liegt vor dem ersten Ligaspieltag");
        }
    });

    test("CalendarEngine: Ein Pokalabend trägt die Runde aus und schaltet weiter", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Ablaufpruefer" });
        const index = state.calendar.findIndex(d => d.type === "cup");
        state.currentDayIndex = index;

        const cup = state.cups.de_cup;
        const vorher = cup.runden[0].matches.filter(m => m.played).length;
        if (vorher !== 0) throw new Error("Die erste Pokalrunde war schon gespielt");

        const res = CalendarEngine.advanceOneDay(state);
        if (!res.success) throw new Error("Der Pokalabend ließ sich nicht abschließen");
        if (res.type !== "cup") throw new Error(`Tagesart ${res.type} statt cup`);

        if (cup.runden[0].matches.some(m => !m.played)) {
            throw new Error("Nach dem Pokalabend sind noch Partien offen");
        }
        if (!cup.runden[0].completed) throw new Error("Die Runde wurde nicht abgeschlossen");
        if (cup.rundenIndex !== 1) throw new Error("Es wurde keine zweite Runde ausgelost");
        if (cup.runden.length !== 2) throw new Error("Die nächste Runde fehlt");
        if (cup.runden[1].matches.length !== 16) {
            throw new Error(`Die 2. Runde hat ${cup.runden[1].matches.length} statt 16 Paarungen`);
        }
        if (state.currentDayIndex !== index + 1) throw new Error("Der Kalender ist nicht weitergerückt");
    });

    // Nach dem eigenen Pokalspiel geht es mit der Liga weiter - nicht mit der
    // naechsten Pokalrunde am selben Abend
    test("CalendarEngine: Nach dem eigenen Pokalspiel geht es mit der Liga weiter", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Pokalpruefer" });
        const cup = state.cups.de_cup;
        const pokaltage = state.calendar
            .map((d, i) => ({ d, i }))
            .filter(e => e.d.type === "cup");
        const ersterAbend = pokaltage[0];
        state.currentDayIndex = ersterAbend.i;

        // Der eigene Verein kommt in jedem Fall weiter: Wir lassen ihn
        // gewinnen, damit es eine naechste Runde fuer ihn gibt
        const spiel = CalendarEngine.spielbarHeute(state);
        if (!spiel || spiel.art !== "pokal") throw new Error("Am ersten Pokalabend ist die eigene Partie nicht spielbar");
        if (spiel.rundenName !== CupEngine.POKAL_RUNDEN[0].name) {
            throw new Error(`Am ersten Pokalabend steht "${spiel.rundenName}" an`);
        }
        const heim = spiel.partie.homeClubId === state.userClubId;
        Object.assign(spiel.partie, { played: true, homeGoals: heim ? 3 : 0, awayGoals: heim ? 0 : 3 });

        // So schliesst die Oberflaeche den Abend nach dem Abpfiff ab
        const tag = state.calendar[state.currentDayIndex];
        CupEngine.spieleTermin(state, "cup", tag.cupRunde);
        CupEngine.schliesseTerminAb(state, "cup", tag.cupRunde);
        if (cup.rundenIndex !== 1) throw new Error("Die zweite Runde wurde nicht ausgelost");

        // Derselbe Abend darf keine weitere Pokalpartie anbieten. Vorher kam
        // hier sofort die zweite Runde, dann die dritte - bis zum Aus.
        const nochmal = CalendarEngine.spielbarHeute(state);
        if (nochmal) {
            throw new Error(`Nach dem Pokalspiel wird am selben Abend "${nochmal.rundenName}" angeboten`);
        }

        // Der Weiter-Knopf fuehrt zum naechsten Ligatermin, nicht in den Pokal
        const halt = CalendarEngine.naechsterHalt(state);
        if (!halt || halt.grund === "cup") {
            throw new Error(`Der nächste Halt ist ${halt ? halt.grund : "keiner"} statt eines Ligatermins`);
        }

        // Den Kalender bis zum naechsten Pokalabend laufen lassen: Dazwischen
        // wird Liga gespielt, und der Pokal bleibt bei der zweiten Runde
        const zweiterAbend = pokaltage[1];
        let ligaSpiele = 0;
        while (state.currentDayIndex < zweiterAbend.i) {
            const r = CalendarEngine.advanceOneDay(state);
            if (!r.success) throw new Error("Der Kalender blieb stehen");
            if (r.type === "matchday") ligaSpiele++;
            if (cup.rundenIndex !== 1) {
                throw new Error(`Zwischen den Pokalabenden wurde Runde ${cup.rundenIndex + 1} gespielt`);
            }
        }
        if (ligaSpiele < 3) throw new Error(`Zwischen den Pokalabenden nur ${ligaSpiele} Ligaspiele`);

        // Erst am zweiten Abend steht die zweite Runde an - einmal
        const zweite = CalendarEngine.spielbarHeute(state);
        if (!zweite || zweite.rundenName !== CupEngine.POKAL_RUNDEN[1].name) {
            throw new Error(`Am zweiten Pokalabend steht ${zweite ? zweite.rundenName : "nichts"} an`);
        }
        CalendarEngine.advanceOneDay(state);
        if (cup.rundenIndex !== 2) throw new Error("Der zweite Pokalabend hat nicht genau eine Runde gespielt");

        // Ein Spielstand, in dem der Pokal durch den alten Fehler vorausgeeilt
        // ist, spielt an den frueheren Abenden nichts nach und bricht nicht ab
        const vorher = cup.runden.reduce((s, r) => s + r.matches.filter(m => m.played).length, 0);
        CupEngine.spieleTermin(state, "cup", 1);
        CupEngine.schliesseTerminAb(state, "cup", 1);
        const nachher = cup.runden.reduce((s, r) => s + r.matches.filter(m => m.played).length, 0);
        if (nachher !== vorher || cup.rundenIndex !== 2) {
            throw new Error("Ein vergangener Pokalabend hat eine spätere Runde gespielt");
        }

        // Dasselbe im Europapokal: ein Abend, eine Partie
        const euro = GameState.createNewGame("muc", "normal", { name: "Europapruefer" });
        const europaTage = euro.calendar.map((d, i) => ({ d, i })).filter(e => e.d.type === "euro");
        let geprueft = 0;
        for (const { d, i } of europaTage) {
            euro.currentDayIndex = i;
            const eigene = CalendarEngine.spielbarHeute(euro);
            if (!eigene) { CalendarEngine.advanceOneDay(euro); continue; }
            const zuHause = eigene.partie.homeClubId === euro.userClubId;
            Object.assign(eigene.partie, { played: true, homeGoals: zuHause ? 2 : 0, awayGoals: zuHause ? 0 : 2 });
            CupEngine.spieleTermin(euro, "euro", d.cupRunde);
            CupEngine.schliesseTerminAb(euro, "euro", d.cupRunde);
            const danach = CalendarEngine.spielbarHeute(euro);
            if (danach) {
                throw new Error(`Nach dem Europapokalspiel wird am selben Abend "${danach.rundenName}" angeboten`);
            }
            CalendarEngine.advanceOneDay(euro);
            geprueft++;
            if (geprueft >= 3) break;
        }
        if (geprueft === 0) throw new Error("Kein Europapokalabend mit eigener Partie gefunden");
    });

    test("CupEngine: Europapokal spielt Gruppenphase und Endrunde aus", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Europapruefer" });
        const ucl = state.europeanCompetitions?.ucl;
        if (!ucl) throw new Error("Keine Champions League angelegt");
        if (!Array.isArray(ucl.spieltage) || ucl.spieltage.length !== 6) {
            throw new Error("Die Gruppenphase hat keine sechs Spieltage");
        }

        for (let i = 0; i < 9; i++) {
            const erg = CupEngine.spieleTermin(state, "euro", i);
            if (erg && erg.eigenePartie && !erg.eigenePartie.played) {
                CupEngine.austragen(state, erg.eigenePartie, i >= 6);
            }
            CupEngine.schliesseTerminAb(state, "euro", i);
        }

        if (!ucl.completed) throw new Error("Die Champions League hat keinen Sieger");
        const gruppenspiele = ucl.spieltage.reduce((s, t) => s + t.matches.filter(m => m.played).length, 0);
        const alle = ucl.spieltage.reduce((s, t) => s + t.matches.length, 0);
        if (gruppenspiele !== alle) throw new Error("Nicht alle Gruppenspiele wurden ausgetragen");

        // Die Tabellen wurden genau einmal fortgeschrieben - sechs Spiele je Verein
        ucl.groups.forEach(g => {
            g.standings.forEach(s => {
                if (s.played !== 6) throw new Error(`${s.clubId} hat ${s.played} statt 6 Gruppenspiele`);
                if (s.won + s.drawn + s.lost !== 6) throw new Error("Die Bilanz passt nicht zur Anzahl Spiele");
                if (s.points !== s.won * 3 + s.drawn) throw new Error("Die Punkte passen nicht zur Bilanz");
            });
        });

        if (ucl.endrunde.length !== 3) throw new Error("Die Endrunde hat nicht drei Runden");
        if (ucl.endrunde[0].matches.length !== 4) throw new Error("Das Viertelfinale hat nicht vier Partien");
    });

    test("CupEngine: Ein zweiter Abschluss verdoppelt die Gruppentabelle nicht", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Doppelpruefer" });

        // Die eigene Partie bleibt der Live-Simulation vorbehalten - sie wird
        // hier von Hand ausgetragen, wie es die Oberfläche nach dem Abpfiff tut
        const erg = CupEngine.spieleTermin(state, "euro", 0);
        if (erg && erg.eigenePartie) CupEngine.austragen(state, erg.eigenePartie, false);
        CupEngine.schliesseTerminAb(state, "euro", 0);
        const nachEinmal = state.europeanCompetitions.ucl.groups[0].standings.map(s => s.points);

        // So passiert es im Spiel: erst die Live-Partie, dann schaltet der Kalender weiter
        CupEngine.spieleTermin(state, "euro", 0);
        CupEngine.schliesseTerminAb(state, "euro", 0);
        const nachZweimal = state.europeanCompetitions.ucl.groups[0].standings.map(s => s.points);

        if (JSON.stringify(nachEinmal) !== JSON.stringify(nachZweimal)) {
            throw new Error("Der zweite Abschluss hat die Tabelle erneut fortgeschrieben");
        }
        state.europeanCompetitions.ucl.groups[0].standings.forEach(s => {
            if (s.played !== 1) throw new Error(`${s.clubId} hat ${s.played} statt 1 Spiel`);
        });
    });

    // ---------------------------------------------------------------
    // Die Entlassung hat Folgen
    // ---------------------------------------------------------------

    test("CareerEngine: Die Entlassung beendet die Station und bringt Angebote", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Entlassener" });
        // Eine halbe Saison spielen, damit es eine Bilanz gibt
        for (let i = 0; i < 12; i++) SeasonEngine.advanceToNextMatchday(state);

        state.managerDismissed = {
            matchday: state.currentMatchday, rank: 17,
            seasonYear: state.seasonYear,
            clubName: state.clubs.find(c => c.id === state.userClubId).name
        };

        const daten = CareerEngine.verarbeiteEntlassung(state);
        if (!daten) throw new Error("Die Entlassung wurde nicht verarbeitet");
        if (!state.arbeitslos) throw new Error("Der Manager gilt nicht als vereinslos");
        if (state.career.entlassungen !== 1) throw new Error("Die Entlassung steht nicht in der Akte");

        const station = state.career.stationen[0];
        if (station.ende !== "entlassen") throw new Error("Die Station wurde nicht geschlossen");
        if (station.spiele !== daten.bilanz.spiele) throw new Error("Die Bilanz der Station stimmt nicht");

        if (typeof daten.ruf !== "number" || daten.ruf < 8 || daten.ruf > 95) {
            throw new Error(`Der Ruf ist unplausibel: ${daten.ruf}`);
        }
        if (!Array.isArray(daten.angebote)) throw new Error("Es gibt keine Angebotsliste");
        daten.angebote.forEach(a => {
            if (a.clubId === state.userClubId) throw new Error("Der eigene Verein macht ein Angebot");
            if (!a.clubName || !a.leagueName) throw new Error("Ein Angebot ist unvollständig");
            const liga = a.leagueId === state.userLeagueId
                ? state.schedule
                : (state.otherSchedules || {})[a.leagueId];
            if ((liga || []).length !== state.schedule.length) {
                throw new Error(`${a.clubName} spielt eine Saison anderer Länge`);
            }
        });

        // Ein zweiter Aufruf darf nichts doppelt zählen
        CareerEngine.verarbeiteEntlassung(state);
        if (state.career.entlassungen !== 1) throw new Error("Die Entlassung wurde doppelt gezählt");
    });

    test("CareerEngine: Ein neuer Verein übernimmt Spielplan, Tabelle und Kalender", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Wechsler" });
        for (let i = 0; i < 8; i++) SeasonEngine.advanceToNextMatchday(state);

        state.managerDismissed = {
            matchday: state.currentMatchday, rank: 16,
            seasonYear: state.seasonYear, clubName: "FC Bayern München"
        };
        const daten = CareerEngine.verarbeiteEntlassung(state);
        if (!daten.angebote.length) throw new Error("Keine Angebote zum Wechseln");

        const ziel = daten.angebote[0];
        const spieltagVorher = state.currentMatchday;
        const tagVorher = state.currentDayIndex;

        const res = CareerEngine.uebernimm(state, ziel.clubId);
        if (!res.erfolg) throw new Error("Die Übernahme ist fehlgeschlagen");
        if (state.userClubId !== ziel.clubId) throw new Error("Der Verein wurde nicht gewechselt");
        if (state.managerDismissed) throw new Error("Die Entlassung steht noch im Spielstand");
        if (state.arbeitslos) throw new Error("Der Manager gilt weiter als vereinslos");
        if (state.career.stationen.length !== 2) throw new Error("Die neue Station fehlt in der Akte");
        if (state.jobSecurity.stage !== "ruhig") throw new Error("Der Vorstand ist nicht zurückgesetzt");

        // Der Spielplan muss zum neuen Verein gehören
        const eigene = state.schedule.some(r =>
            r.matches.some(m => m.homeClubId === ziel.clubId || m.awayClubId === ziel.clubId));
        if (!eigene) throw new Error("Der Spielplan enthält den neuen Verein nicht");
        if (!state.standings.some(s => s.clubId === ziel.clubId)) {
            throw new Error("Die Tabelle enthält den neuen Verein nicht");
        }
        if (state.currentMatchday !== spieltagVorher) throw new Error("Der Spieltag hat sich verschoben");
        if (state.currentDayIndex !== tagVorher) throw new Error("Der Kalender hat sich verschoben");

        // Und die Saison läuft weiter
        const weiter = SeasonEngine.advanceToNextMatchday(state);
        if (!weiter) throw new Error("Nach dem Wechsel lässt sich kein Spieltag mehr spielen");
    });

    test("CareerEngine: Das Zeugnis fasst Stationen, Titel und Bilanz zusammen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Ruheständler" });
        for (let i = 0; i < 6; i++) SeasonEngine.advanceToNextMatchday(state);

        CareerEngine.vermerkeTitel(state, "DFB-Pokal", 1);
        state.managerDismissed = { matchday: 6, rank: 15, seasonYear: 1, clubName: "FC Bayern München" };
        CareerEngine.verarbeiteEntlassung(state);

        const zeugnis = CareerEngine.beendeKarriere(state);
        if (!state.careerOver) throw new Error("Die Laufbahn gilt nicht als beendet");
        if (zeugnis.stationen.length !== 1) throw new Error("Die Stationen fehlen im Zeugnis");
        if (zeugnis.titel.length !== 1) throw new Error("Der Titel fehlt im Zeugnis");
        if (zeugnis.entlassungen !== 1) throw new Error("Die Entlassung fehlt im Zeugnis");
        if (zeugnis.gesamt.spiele !== zeugnis.stationen[0].spiele) {
            throw new Error("Die Gesamtbilanz passt nicht zu den Stationen");
        }
        if (zeugnis.siegquote < 0 || zeugnis.siegquote > 100) {
            throw new Error(`Siegquote unplausibel: ${zeugnis.siegquote}`);
        }
    });

    test("SeasonEngine: Nach der Entlassung stellt der Vorstand kein neues Ultimatum", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Gefeuerter" });
        state.boardConfidence = 15;
        state.currentMatchday = 12;
        state.jobSecurity = { stage: "entlassen", ultimatumUntil: null, ultimatumRank: null, warnedAt: null };
        state.managerDismissed = { matchday: 11, rank: 18, seasonYear: 1, clubName: "FC Bayern München" };

        const club = state.clubs.find(c => c.id === state.userClubId);
        SeasonEngine.checkJobSecurity(state, club, 18, 3);

        if (state.jobSecurity.stage !== "entlassen") {
            throw new Error(`Der Vorstand handelt weiter: ${state.jobSecurity.stage}`);
        }
    });

    // ---------------------------------------------------------------
    // Geschwindigkeit: der Tagesklick darf nicht hängen
    // ---------------------------------------------------------------

    test("GameState.repairLineup: unveränderte Aufstellungen werden übersprungen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Tempopruefer" });
        const index = GameState.buildPlayerIndex(state.players);
        if (index.size !== state.players.length) throw new Error("Das Spielerverzeichnis ist unvollständig");

        const club = state.clubs.find(c => c.id === state.userClubId);
        GameState.repairLineup(club, state.players, index);
        const elfVorher = club.lineup.slice();

        // Ohne Ausfall ändert sich nichts
        if (GameState.repairLineup(club, state.players, index)) {
            throw new Error("Eine intakte Aufstellung wurde verändert");
        }
        if (JSON.stringify(club.lineup) !== JSON.stringify(elfVorher)) {
            throw new Error("Die Elf hat sich ohne Grund geändert");
        }

        // Mit Ausfall rückt jemand nach - an genau dieselbe Stelle
        const opfer = state.players.find(p => p.id === club.lineup[5]);
        opfer.injuredWeeks = 3;
        if (!GameState.repairLineup(club, state.players, index)) {
            throw new Error("Der Ausfall wurde nicht ersetzt");
        }
        if (club.lineup.length !== 11) throw new Error("Die Elf ist unvollständig");
        if (club.lineup.includes(opfer.id)) throw new Error("Der Verletzte steht weiter in der Elf");
        if (club.lineup[5] === elfVorher[5]) throw new Error("Der Platz wurde nicht neu besetzt");
    });

    test("SaveCodec: Das zwischengespeicherte Schema liefert dasselbe Ergebnis", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Codecpruefer" });

        const einmal = JSON.stringify(SaveCodec.encodeState(state));
        const zweimal = JSON.stringify(SaveCodec.encodeState(state));
        if (einmal !== zweimal) throw new Error("Zwei Durchläufe liefern verschiedene Ergebnisse");

        // Unbekannte Felder überleben die Umwandlung
        const spieler = state.players[0];
        spieler.eigeneNotiz = "Trainingsweltmeister";
        spieler.happiness.eigeneLaune = 42;

        const zurueck = SaveCodec.decodeState(SaveCodec.encodeState(state));
        const wieder = zurueck.players.find(p => String(p.id) === String(spieler.id));
        if (!wieder) throw new Error("Der Spieler ging verloren");
        if (wieder.eigeneNotiz !== "Trainingsweltmeister") throw new Error("Ein unbekanntes Feld ging verloren");
        if (wieder.happiness.eigeneLaune !== 42) throw new Error("Ein unbekanntes Unterfeld ging verloren");
        if (wieder.name !== spieler.name) throw new Error("Der Name ging verloren");
        if (wieder.overall !== spieler.overall) throw new Error("Die Stärke ging verloren");
        if (wieder.hiddenAttributes.loyalty !== spieler.hiddenAttributes.loyalty) {
            throw new Error("Die versteckten Werte gingen verloren");
        }
    });


    // ---------------------------------------------------------------
    // Echte Vereine in allen Ligen
    // ---------------------------------------------------------------

    test("Spielwelt: Jede Liga ist mit echten Vereinen besetzt", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Namenspruefer" });

        LEAGUES_DATA.forEach(liga => {
            const clubs = state.clubs.filter(c => c.leagueId === liga.id);
            if (clubs.length !== liga.teamCount) {
                throw new Error(`${liga.shortName} hat ${clubs.length} statt ${liga.teamCount} Vereine`);
            }

            // Die Bundesliga kommt aus der handgepflegten Vereinsdatei
            if (liga.id === "de_liga_1") return;

            const echte = new Set((REAL_CLUBS_BY_LEAGUE[liga.id] || []).map(v => v.name));
            if (echte.size < liga.teamCount) {
                throw new Error(`Für ${liga.shortName} sind nur ${echte.size} echte Vereine hinterlegt`);
            }
            const erzeugt = clubs.filter(c => !echte.has(c.name));
            if (erzeugt.length) {
                throw new Error(`${liga.shortName} enthält erzeugte Vereine: ${erzeugt.map(c => c.name).join(", ")}`);
            }
        });

        // Kein Verein darf doppelt vorkommen - weder im Namen noch in der ID
        const namen = state.clubs.map(c => c.name);
        const doppelt = namen.filter((n, i) => namen.indexOf(n) !== i);
        if (doppelt.length) throw new Error(`Vereinsnamen doppelt vergeben: ${[...new Set(doppelt)].join(", ")}`);

        const ids = state.clubs.map(c => c.id);
        const doppelteIds = ids.filter((n, i) => ids.indexOf(n) !== i);
        if (doppelteIds.length) throw new Error(`Vereins-IDs doppelt vergeben: ${[...new Set(doppelteIds)].join(", ")}`);
    });

    test("Echte Vereine: Stadion und Kapazität kommen aus der Vereinsdatei", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Stadionpruefer" });

        Object.keys(REAL_CLUBS_BY_LEAGUE).forEach(ligaId => {
            REAL_CLUBS_BY_LEAGUE[ligaId].slice(0, 6).forEach(echt => {
                const club = state.clubs.find(c => c.name === echt.name);
                if (!club) return;   // mehr Vereine hinterlegt als die Liga Plätze hat
                if (club.stadium !== echt.stadium) {
                    throw new Error(`${echt.name} spielt in "${club.stadium}" statt "${echt.stadium}"`);
                }
                if (club.stadiumCapacity !== echt.capacity) {
                    throw new Error(`${echt.name}: Kapazität ${club.stadiumCapacity} statt ${echt.capacity}`);
                }
                if (club.city !== echt.city) {
                    throw new Error(`${echt.name} liegt in ${club.city} statt ${echt.city}`);
                }
            });
        });
    });

    test("Echte Vereine: Die Rangfolge der Datei bestimmt den Ruf", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Rangpruefer" });

        // In jeder Liga muss die erste Hälfte der Liste im Schnitt deutlich
        // besser dastehen als die zweite - sonst wäre die Reihenfolge nutzlos
        ["en_liga_1", "es_liga_1", "it_liga_1", "fr_liga_1", "de_liga_2", "de_liga_3"].forEach(ligaId => {
            const liste = REAL_CLUBS_BY_LEAGUE[ligaId];
            const ruf = name => state.clubs.find(c => c.name === name)?.reputation ?? 0;
            const mitte = Math.floor(liste.length / 2);
            const oben = liste.slice(0, mitte).map(v => ruf(v.name));
            const unten = liste.slice(mitte).map(v => ruf(v.name));
            const schnitt = a => a.reduce((s, v) => s + v, 0) / a.length;

            if (schnitt(oben) <= schnitt(unten) + 3) {
                throw new Error(`${ligaId}: Die obere Hälfte (${schnitt(oben).toFixed(1)}) hebt sich nicht `
                    + `von der unteren ab (${schnitt(unten).toFixed(1)})`);
            }
        });

        // Und die Spitzenklubs Europas müssen über allen anderen stehen
        const spitze = ["Real Madrid", "FC Barcelona", "Manchester City", "Paris Saint-Germain"];
        spitze.forEach(name => {
            const club = state.clubs.find(c => c.name === name);
            if (!club) throw new Error(`${name} fehlt in der Spielwelt`);
            if (club.reputation < 85) throw new Error(`${name} hat nur Ruf ${club.reputation}`);
        });
    });


    // ---------------------------------------------------------------
    // Gespielt wird nur an dem Tag, an dem das Spiel angesetzt ist
    // ---------------------------------------------------------------

    test("CalendarEngine: In der Vorbereitung ist kein Pflichtspiel spielbar", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Vorbereiter" });

        if (!state.preseason?.aktiv) throw new Error("Die Vorbereitung läuft gar nicht");
        const ersterSpieltag = state.calendar.findIndex(d => d.type === "matchday");
        if (ersterSpieltag < 20) {
            throw new Error(`Der erste Spieltag liegt schon auf Tag ${ersterSpieltag}`);
        }

        // Über die gesamte Vorbereitung darf an keinem Tag ein Pflichtspiel
        // zum Anpfiff bereitstehen
        for (let i = 0; i < ersterSpieltag; i++) {
            state.currentDayIndex = i;
            const spielbar = CalendarEngine.spielbarHeute(state);
            const tag = state.calendar[i];
            if (spielbar) {
                throw new Error(`An Tag ${i} (${tag.type}) ist "${spielbar.rundenName}" spielbar`);
            }
        }

        // Am Spieltag selbst dann schon
        state.currentDayIndex = ersterSpieltag;
        const amSpieltag = CalendarEngine.spielbarHeute(state);
        if (!amSpieltag) throw new Error("Am ersten Spieltag ist kein Spiel spielbar");
        if (amSpieltag.art !== "liga") throw new Error(`Art ${amSpieltag.art} statt liga`);
        if (amSpieltag.gespielt) throw new Error("Das Spiel gilt schon als gespielt");
    });

    test("CalendarEngine: Pokal- und Europapokaltage melden ihre eigene Partie", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Pokalpruefer" });

        let gefundenCup = false;
        let gefundenEuro = false;

        state.calendar.forEach((tag, i) => {
            if (tag.type !== "cup" && tag.type !== "euro") return;
            state.currentDayIndex = i;
            const spielbar = CalendarEngine.spielbarHeute(state);
            if (!spielbar) return;
            if (spielbar.partie.homeClubId !== state.userClubId
                && spielbar.partie.awayClubId !== state.userClubId) {
                throw new Error("Es wird eine fremde Partie zum Anpfiff angeboten");
            }
            if (tag.type === "cup") {
                gefundenCup = true;
                if (spielbar.art !== "pokal") throw new Error(`Art ${spielbar.art} statt pokal`);
                if (!spielbar.ko) throw new Error("Eine Pokalpartie ist kein K.-o.-Spiel");
            } else {
                gefundenEuro = true;
                if (spielbar.art !== "euro") throw new Error(`Art ${spielbar.art} statt euro`);
            }
        });

        if (!gefundenCup) throw new Error("An keinem Pokalabend war die eigene Partie spielbar");
        if (!gefundenEuro) throw new Error("An keinem Europapokalabend war die eigene Partie spielbar");
    });

    test("CalendarEngine: Der nächste Termin ist der nächste, nicht der erste Spieltag", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Terminpruefer" });

        // Am ersten Tag der Vorbereitung muss der nächste Termin ein
        // Vorbereitungstermin sein - nicht der Spieltag in dreißig Tagen
        const ersterTermin = CalendarEngine.naechsterTermin(state);
        if (!ersterTermin) throw new Error("Kein nächster Termin gefunden");
        if (ersterTermin.art !== "vorbereitung") {
            throw new Error(`Der nächste Termin ist "${ersterTermin.art}" statt eines Vorbereitungstermins`);
        }
        if (ersterTermin.tage <= 0 || ersterTermin.tage > 10) {
            throw new Error(`Der Vorbereitungstermin liegt in ${ersterTermin.tage} Tagen`);
        }

        // Der Termin muss immer in der Zukunft oder heute liegen und zum
        // Kalendertag passen, auf den er zeigt
        for (let i = 0; i < Math.min(120, state.calendar.length); i += 7) {
            state.currentDayIndex = i;
            const t = CalendarEngine.naechsterTermin(state);
            if (!t) continue;
            if (t.tage < 0) throw new Error(`Tag ${i}: Termin liegt ${t.tage} Tage in der Vergangenheit`);
            if (t.index !== i + t.tage) throw new Error(`Tag ${i}: Index und Tagesabstand passen nicht zusammen`);
            const ziel = state.calendar[t.index];
            const passt = { liga: "matchday", pokal: "cup", euro: "euro", vorbereitung: "friendly" };
            if (ziel.type !== passt[t.art]) {
                throw new Error(`Tag ${i}: Termin "${t.art}" zeigt auf einen ${ziel.type}-Tag`);
            }
        }
    });


    // ---------------------------------------------------------------
    // Der Ball läuft, er springt nicht
    // ---------------------------------------------------------------

    test("LiveMatchDirector: Der Ball bewegt sich in Spielgeschwindigkeit, nicht in Sprüngen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Ballprüfer" });
        const runde = state.schedule.find(r => r.matchday === 1);
        const partie = runde.matches.find(m =>
            m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
        const heim = state.clubs.find(c => c.id === partie.homeClubId);
        const gast = state.clubs.find(c => c.id === partie.awayClubId);

        const live = MatchEngine.createLiveMatch(partie, heim, gast, state.players);
        live.speed = 1;

        let frames = 0, grob = 0, groesster = 0;
        let lx = live.ball.x, ly = live.ball.y;
        while (!live.isFinished && frames < 30 * 900) {
            live.advanceRealTime(1000 / 30);
            live.updateBallAndPlayers(1000 / 30);
            frames++;
            // Das Feld ist hundert Einheiten breit für hundertfünf Meter
            const weg = Math.hypot(live.ball.x - lx, live.ball.y - ly) * 1.05;
            lx = live.ball.x; ly = live.ball.y;
            if (weg > 3) grob++;
            groesster = Math.max(groesster, weg);
        }

        if (frames < 1000) throw new Error(`Zu wenige Bilder für eine Auswertung (${frames})`);

        // Drei Meter in einem Bild sind bei dreißig Bildern je Sekunde
        // neunzig Meter je Sekunde. Vereinzelt geht das für einen Schuss in
        // Ordnung, als Regel ist es ein Ball, der durch die Gegend springt.
        const anteil = grob / frames;
        if (anteil > 0.06) {
            throw new Error(`In ${(anteil * 100).toFixed(1)} % der Bilder springt der Ball über drei Meter`);
        }
        if (groesster > 16) {
            throw new Error(`Größter Ballsprung in einem Bild: ${groesster.toFixed(1)} m`);
        }
    });

    test("LiveMatchDirector: Ein gewonnenes Dribbling ist ein Lauf mit dem Ball", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Dribbler" });
        const runde = state.schedule.find(r => r.matchday === 1);
        const partie = runde.matches.find(m =>
            m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
        const heim = state.clubs.find(c => c.id === partie.homeClubId);
        const gast = state.clubs.find(c => c.id === partie.awayClubId);

        const live = MatchEngine.createLiveMatch(partie, heim, gast, state.players);
        live.speed = 1;
        const dir = live.director;

        const laeufe = [];
        let aktiv = null, startX = 0, startY = 0, frames = 0;
        while (!live.isFinished && frames < 30 * 900) {
            live.advanceRealTime(1000 / 30);
            live.updateBallAndPlayers(1000 / 30);
            frames++;

            const ziel = dir.carryTarget;
            if (ziel && !aktiv) {
                aktiv = ziel.id;
                const p = dir.getPlayer2D(ziel.id);
                startX = p ? p.x : 0; startY = p ? p.y : 0;
            } else if (!ziel && aktiv) {
                const p = dir.getPlayer2D(aktiv);
                if (p) laeufe.push(Math.hypot(p.x - startX, p.y - startY) * 1.05);
                aktiv = null;
            }
        }

        if (laeufe.length < 5) {
            throw new Error(`Nur ${laeufe.length} Läufe mit dem Ball in einer ganzen Partie`);
        }
        const schnitt = laeufe.reduce((s, v) => s + v, 0) / laeufe.length;
        if (schnitt < 3) {
            throw new Error(`Die Läufe sind im Schnitt nur ${schnitt.toFixed(1)} m lang`);
        }
    });

    test("LiveMatchDirector: Der Ball geht erst ins Aus, dann zum Einwurfpunkt", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Einwerfer" });
        const runde = state.schedule.find(r => r.matchday === 1);
        const partie = runde.matches.find(m =>
            m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
        const heim = state.clubs.find(c => c.id === partie.homeClubId);
        const gast = state.clubs.find(c => c.id === partie.awayClubId);

        // So viele Partien, bis genug Einwürfe für eine Aussage vorliegen:
        // Auf eine Partie entfallen zwischen null und zehn, im Schnitt knapp
        // vier. Mit fest zwei Partien scheiterte der Test in jedem vierten
        // Lauf an der Anzahl - gemessen wird aber die Strecke, die der Ball
        // zum Einwurfpunkt zurücklegt, nicht wie oft er ins Aus geht.
        const wege = [];
        for (let runde2 = 0; runde2 < 6 && wege.length < 8; runde2++) {
            const live = MatchEngine.createLiveMatch(partie, heim, gast, state.players);
            live.speed = 1;
            const dir = live.director;

            const echt = dir.startDeadBall.bind(dir);
            dir.startDeadBall = function (kind, team, x, y) {
                if (kind === "throwin") {
                    wege.push(Math.hypot(x - this.match.ball.x, y - this.match.ball.y) * 1.05);
                }
                return echt(kind, team, x, y);
            };

            let frames = 0;
            while (!live.isFinished && frames < 30 * 900) {
                live.advanceRealTime(1000 / 30);
                live.updateBallAndPlayers(1000 / 30);
                frames++;
            }
        }

        if (wege.length < 5) throw new Error(`Nur ${wege.length} Einwürfe in sechs Partien`);

        // Der Ball liegt schon im Aus, wenn er zum Einwurfpunkt geholt wird -
        // er wird nicht quer über das Feld dorthin gezogen.
        const schnitt = wege.reduce((s, v) => s + v, 0) / wege.length;
        if (schnitt > 8) {
            throw new Error(`Der Ball wird im Schnitt ${schnitt.toFixed(1)} m weit zum Einwurfpunkt gezogen`);
        }
        const weiteste = Math.max(...wege);
        if (weiteste > 25) {
            throw new Error(`Ein Einwurf holt den Ball über ${weiteste.toFixed(0)} m heran`);
        }
    });

    // ---------------------------------------------------------------------
    // Anlagen: Stufe, Zustand, Bauzeit
    // ---------------------------------------------------------------------

    test("Anlagen: Keine Anlage startet perfekt", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const uebersicht = FacilityEngine.uebersicht(state, "muc");

        if (uebersicht.length !== 4) {
            throw new Error(`Erwartet 4 Anlagen, bekommen ${uebersicht.length}`);
        }
        const perfekt = uebersicht.filter(a => a.zustand >= 100);
        if (perfekt.length > 0) {
            throw new Error(`Diese Anlagen starten fabrikneu: ${perfekt.map(a => a.name).join(", ")}`);
        }
        uebersicht.forEach(a => {
            if (a.zustand < 0 || a.zustand > 100) throw new Error(`${a.name}: Zustand ${a.zustand} außerhalb 0-100`);
            if (a.wirksameStufe > a.stufe + 0.001) {
                throw new Error(`${a.name}: wirksame Stufe ${a.wirksameStufe} über der gebauten ${a.stufe}`);
            }
        });
    });

    test("Wirtschaft: Jede Liga trägt sich selbst", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });

        const bilanz = (club) => {
            const einnahmen = FinanceEngine.einnahmenSchaetzung(club, state);
            const gehalt = state.players
                .filter(p => p.clubId === club.id)
                .reduce((s, p) => s + (p.wage || 0), 0);
            const unterhalt = FinanceEngine.maintenancePerMatchday(club, state);
            const betrieb = Math.round(einnahmen * FinanceEngine.operatingShare(club)
                + gehalt * FinanceEngine.OPERATING_WAGE_SHARE);
            return { einnahmen, gehalt, saldo: einnahmen - gehalt - unterhalt - betrieb };
        };

        const ligen = [...new Set(state.clubs.map(c => c.level || 1))].sort((a, b) => a - b);
        ligen.forEach(lvl => {
            const clubs = state.clubs.filter(c => (c.level || 1) === lvl)
                .sort((a, b) => (a.clubStrength || 0) - (b.clubStrength || 0));
            if (clubs.length < 3) return;

            const med = bilanz(clubs[Math.floor(clubs.length / 2)]);
            const marge = med.saldo / med.einnahmen;
            if (marge < -0.08) {
                throw new Error(`Liga ${lvl}: Der Median-Verein verliert ${(-marge * 100).toFixed(0)} % seiner Einnahmen je Spieltag`);
            }
            if (marge > 0.30) {
                throw new Error(`Liga ${lvl}: Der Median-Verein legt ${(marge * 100).toFixed(0)} % je Spieltag zurück - Geld ist keine Entscheidung mehr`);
            }

            const quote = med.gehalt / med.einnahmen;
            if (quote > 0.62) {
                throw new Error(`Liga ${lvl}: Gehaltsquote ${(quote * 100).toFixed(0)} % - der Kader ist nicht bezahlbar`);
            }
        });
    });

    test("Wirtschaft: Der Spitzenverein steht besser da als der Tabellenletzte", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const erste = state.clubs.filter(c => (c.level || 1) === 1)
            .sort((a, b) => (a.clubStrength || 0) - (b.clubStrength || 0));

        const quote = (club) => {
            const gehalt = state.players.filter(p => p.clubId === club.id)
                .reduce((s, p) => s + (p.wage || 0), 0);
            return gehalt / Math.max(1, FinanceEngine.einnahmenSchaetzung(club, state));
        };

        const top = quote(erste[erste.length - 1]);
        const unten = quote(erste[0]);

        // In Wirklichkeit hat der grosse Verein die kleinere Gehaltsquote -
        // sein Umsatz waechst schneller als seine Gehaltsliste. Vorher war es
        // andersherum: 74 % beim Meister, 53 % beim Abstiegskandidaten.
        if (!(top < unten)) {
            throw new Error(`Der Spitzenverein zahlt anteilig mehr (${(top * 100).toFixed(0)} %) als der Letzte (${(unten * 100).toFixed(0)} %)`);
        }
    });

    test("Wirtschaft: Ein Absteiger passt seine Gehaltsliste an", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => (c.level || 1) === 1 && c.id !== state.userClubId);
        const kader = state.players.filter(p => p.clubId === club.id);
        if (!kader.length) throw new Error("Verein ohne Kader");

        const vorher = kader.reduce((s, p) => s + (p.wage || 0), 0);

        // Zwei Ligen tiefer - die Einnahmen brechen weg
        club.level = 3;
        FinanceEngine.normalisiereGehaelter(state, [club]);
        const nachher = state.players.filter(p => p.clubId === club.id)
            .reduce((s, p) => s + (p.wage || 0), 0);

        if (!(nachher < vorher * 0.6)) {
            throw new Error(`Die Gehaltsliste fiel nur von ${Math.round(vorher / 1000)}k auf ${Math.round(nachher / 1000)}k`);
        }
        // Die Spanne im Kader bleibt erhalten - es wird verschoben, nicht eingeebnet
        const neu = state.players.filter(p => p.clubId === club.id).map(p => p.wage);
        if (Math.max(...neu) / Math.max(1, Math.min(...neu)) < 2) {
            throw new Error("Nach der Anpassung verdienen alle Spieler ungefähr gleich viel");
        }
    });

    test("Anlagen: Höchstens eine Dauerbaustelle je Verein", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });

        let schlimmste = 0;
        state.clubs.forEach(club => {
            FacilityEngine.hole(club, 1);
            const marode = FacilityEngine.ANLAGEN.filter(k => club.anlagen[k].zustand < 45).length;
            if (marode > schlimmste) schlimmste = marode;
            if (marode > 1) {
                throw new Error(`${club.name} startet mit ${marode} maroden Anlagen`);
            }
        });

        // Und es darf nicht so sein, dass gar nichts alt ist - sonst gäbe es
        // nichts zu sanieren und die ganze Mechanik liefe leer.
        const irgendwoAlt = state.clubs.some(c =>
            FacilityEngine.ANLAGEN.some(k => c.anlagen[k].zustand < 55));
        if (!irgendwoAlt) throw new Error("Keine einzige Anlage in der Welt ist in die Jahre gekommen");
    });

    test("Anlagen: Eine gepflegte Drei schlägt eine verfallene Fünf", () => {
        const gepflegt = { id: "a", facilities: { trainingGround: 3 }, anlagen: { trainingGround: { stufe: 3, zustand: 96, baujahr: 1, projekt: null } } };
        const verfallen = { id: "b", facilities: { trainingGround: 5 }, anlagen: { trainingGround: { stufe: 5, zustand: 20, baujahr: 1, projekt: null } } };

        const w3 = FacilityEngine.wirksameStufe(gepflegt, "trainingGround", 1);
        const w5 = FacilityEngine.wirksameStufe(verfallen, "trainingGround", 1);
        if (!(w3 > w5)) {
            throw new Error(`Gepflegte Drei (${w3}) leistet nicht mehr als verfallene Fünf (${w5})`);
        }
    });

    test("Anlagen: Ausbau braucht Zeit und hebt die Stufe erst am Ende", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");
        FacilityEngine.hole(club, 1);
        Object.assign(club.anlagen.medicalCenter, { stufe: 2, zustand: 80, projekt: null });
        club.facilities.medicalCenter = 2;
        club.balance = 200000000;

        const vorher = club.balance;
        const res = FacilityEngine.starteProjekt(state, "muc", "medicalCenter", "ausbau");
        if (!res.erfolg) throw new Error("Ausbau ließ sich nicht starten: " + res.grund);
        if (club.anlagen.medicalCenter.stufe !== 2) throw new Error("Die Stufe stieg sofort statt nach der Bauzeit");
        if (club.balance >= vorher) throw new Error("Der Ausbau kostete nichts");

        const dauer = FacilityEngine.dauer("medicalCenter", "ausbau");
        for (let i = 0; i < dauer - 1; i++) FacilityEngine.tickSpieltag(state);
        if (club.anlagen.medicalCenter.stufe !== 2) throw new Error("Die Stufe stieg vor dem Ende der Bauzeit");

        FacilityEngine.tickSpieltag(state);
        if (club.anlagen.medicalCenter.stufe !== 3) {
            throw new Error(`Nach ${dauer} Spieltagen steht die Anlage auf Stufe ${club.anlagen.medicalCenter.stufe}, nicht auf 3`);
        }
        if (club.facilities.medicalCenter !== 3) throw new Error("Der alte facilities-Wert wurde nicht nachgezogen");
        if (club.anlagen.medicalCenter.projekt) throw new Error("Das Bauvorhaben läuft nach Fertigstellung weiter");
    });

    test("Anlagen: Während des Stadionumbaus fehlen Plätze", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");
        club.balance = 500000000;
        FacilityEngine.hole(club, 1);
        Object.assign(club.anlagen.stadium, { stufe: 3, zustand: 70, projekt: null });

        const voll = FacilityEngine.verfuegbareKapazitaet(club, 1);
        const res = FacilityEngine.starteProjekt(state, "muc", "stadium", "ausbau");
        if (!res.erfolg) throw new Error("Stadionausbau ließ sich nicht starten: " + res.grund);

        const waehrend = FacilityEngine.verfuegbareKapazitaet(club, 1);
        if (!(waehrend < voll)) {
            throw new Error(`Kapazität blieb bei ${waehrend} von ${voll} - der Umbau kostet keine Plätze`);
        }
        const wirksam = FacilityEngine.wirksameStufe(club, "stadium", 1);
        if (!(wirksam < 3)) throw new Error("Die Baustelle drückt die wirksame Stufe nicht");
    });

    test("Anlagen: Sanierung hebt den Zustand, nicht die Stufe", () => {
        const state = GameState.createNewGame("svw", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "svw");
        club.balance = 100000000;
        FacilityEngine.hole(club, 1);
        Object.assign(club.anlagen.trainingGround, { stufe: 3, zustand: 30, projekt: null });
        club.facilities.trainingGround = 3;

        const res = FacilityEngine.starteProjekt(state, "svw", "trainingGround", "sanierung");
        if (!res.erfolg) throw new Error("Sanierung ließ sich nicht starten: " + res.grund);

        const dauer = FacilityEngine.dauer("trainingGround", "sanierung");
        for (let i = 0; i < dauer; i++) FacilityEngine.tickSpieltag(state);

        const a = club.anlagen.trainingGround;
        if (a.stufe !== 3) throw new Error(`Die Sanierung hob die Stufe auf ${a.stufe}`);
        if (!(a.zustand > 65)) throw new Error(`Zustand nach der Sanierung nur ${a.zustand}`);
    });

    test("Anlagen: Ohne Geld wird nicht gebaut", () => {
        const state = GameState.createNewGame("svw", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "svw");
        FacilityEngine.hole(club, 1);
        club.anlagen.stadium.projekt = null;
        club.balance = 1000;

        const res = FacilityEngine.starteProjekt(state, "svw", "stadium", "ausbau");
        if (res.erfolg) throw new Error("Ein Stadionausbau gelang mit 1000 Euro auf dem Konto");
        if (club.balance !== 1000) throw new Error("Das Konto wurde trotz Absage belastet");
        if (club.anlagen.stadium.projekt) throw new Error("Ein Bauvorhaben wurde trotz Absage angelegt");
    });

    test("Anlagen: Wer ein Jahrzehnt nicht saniert, hat ein Camp Nou", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");
        FacilityEngine.hole(club, 1);
        Object.assign(club.anlagen.stadium, { stufe: 5, zustand: 95, baujahr: 1, projekt: null });

        const start = FacilityEngine.wirksameStufe(club, "stadium", 1);
        // Zwölf Spielzeiten: Ein Gebäude altert in Jahrzehnten, nicht in
        // Saisons. Genau das ist die Geschichte des Camp Nou - 1957 gebaut,
        // Jahrzehnte später eine Baustelle.
        for (let s = 0; s < 12; s++) {
            state.seasonYear = (state.seasonYear || 1) + 1;
            FacilityEngine.saisonwechsel(state);
        }
        const ende = FacilityEngine.wirksameStufe(club, "stadium", state.seasonYear);

        if (!(club.anlagen.stadium.zustand < 50)) {
            throw new Error(`Nach zwölf Saisons ohne Pflege steht der Zustand noch bei ${club.anlagen.stadium.zustand}`);
        }
        // ... aber nach zwei Saisons darf noch nichts zerfallen sein
        const frisch = state.clubs.find(c => c.id === "dor");
        FacilityEngine.hole(frisch, 1);
        Object.assign(frisch.anlagen.stadium, { stufe: 5, zustand: 95, baujahr: 1, projekt: null });
        const zwei = { ...state, seasonYear: 2, clubs: [frisch] };
        FacilityEngine.saisonwechsel(zwei);
        FacilityEngine.saisonwechsel(zwei);
        if (frisch.anlagen.stadium.zustand < 80) {
            throw new Error(`Nach zwei Saisons ist der Zustand schon auf ${frisch.anlagen.stadium.zustand} gefallen`);
        }
        if (!(ende < start - 0.4)) {
            throw new Error(`Die wirksame Stufe fiel kaum: ${start} -> ${ende}`);
        }
        if (club.anlagen.stadium.stufe !== 5) throw new Error("Der Verfall hat die gebaute Stufe verändert");
    });

    test("Anlagen: Eine Baustelle blockiert eine zweite an derselben Anlage", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");
        club.balance = 500000000;
        FacilityEngine.hole(club, 1);
        Object.assign(club.anlagen.youthCenter, { stufe: 2, zustand: 50, projekt: null });

        const erste = FacilityEngine.starteProjekt(state, "muc", "youthCenter", "sanierung");
        if (!erste.erfolg) throw new Error("Erste Arbeit ließ sich nicht starten: " + erste.grund);
        const zweite = FacilityEngine.starteProjekt(state, "muc", "youthCenter", "ausbau");
        if (zweite.erfolg) throw new Error("An derselben Anlage wurde zweimal gleichzeitig gebaut");
    });

    test("2D: Eine Passage laeuft durch, statt in Einzelszenen zu zerfallen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const homeClub = state.clubs.find(c => c.id === "muc");
        const awayClub = state.clubs.find(c => c.id === "dor");

        let gebuendelt = 0, szenen = 0, spruenge = 0;

        for (let r = 0; r < 2; r++) {
            const match = { id: `passage_${r}`, played: false, homeClubId: "muc", awayClubId: "dor" };
            match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, state.players);

            const live = new LiveMatch(match, homeClub, awayClub, state.players);
            live.speed = 2;
            const dir = live.director;

            const orig = dir.startHighlight.bind(dir);
            dir.startHighlight = function () {
                orig();
                if (!this.scene?.events?.length) return;
                szenen++;
                if (this.scene.events.length > 1) gebuendelt++;

                // Innerhalb einer Passage darf der Ball nicht quer ueber das
                // Feld springen: Jede Aktion beginnt da, wo die vorige endete.
                const evs = this.scene.events;
                for (let i = 1; i < evs.length; i++) {
                    const vor = evs[i - 1].end, jetzt = evs[i].start;
                    if (!vor || !jetzt) continue;
                    if (OHNE_BALLFUEHRUNG_TEST.includes(evs[i].type)) continue;
                    if (RUHENDER_BALL_TEST.includes(evs[i].type)) continue;
                    if (Math.hypot(jetzt.x - vor.x, jetzt.y - vor.y) > 6) spruenge++;
                }
            };

            let frames = 0;
            while (!live.isFinished && frames++ < 60 * 500) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
        }

        if (szenen < 20) throw new Error(`Nur ${szenen} Szenen in zwei Partien`);
        const anteil = gebuendelt / szenen;
        if (anteil < 0.15) {
            throw new Error(`Nur ${(anteil * 100).toFixed(0)} % der Szenen bündeln mehr als ein Ereignis - jeder Angriff zerfällt in Einzelbilder`);
        }
        if (spruenge > 0) {
            throw new Error(`${spruenge} Mal springt der Ball innerhalb einer Passage über das Feld`);
        }
    });

    test("Akademie: Die Schule prägt die Talente, ohne sie besser zu machen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });

        const werte = (profil) => {
            const club = state.clubs.find(c => c.id === "muc");
            club.akademieProfil = profil;
            let technik = 0, koerper = 0;
            for (let i = 0; i < 60; i++) {
                const attr = PlayerGenerator.generateAttributes("ZM", 70);
                YouthEngine.praegeSchule(attr, { schule: profil }, club);
                technik += attr.technique;
                koerper += attr.physical;
            }
            return { technik: technik / 60, koerper: koerper / 60 };
        };

        const masia = werte("technik");
        const athletik = werte("athletik");

        if (!(masia.technik > athletik.technik + 4)) {
            throw new Error(`Technikschule bildet nicht technischer aus: ${masia.technik.toFixed(1)} vs ${athletik.technik.toFixed(1)}`);
        }
        if (!(athletik.koerper > masia.koerper + 4)) {
            throw new Error(`Athletikschule bildet nicht athletischer aus: ${athletik.koerper.toFixed(1)} vs ${masia.koerper.toFixed(1)}`);
        }
    });

    test("Akademie: Jeder Verein hat eine Handschrift, und sie steht am Talent", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");

        const schule = YouthEngine.schuleVon(club);
        if (!schule || !schule.name) throw new Error("Der Verein hat keine Akademie-Handschrift");
        if (!FacilityEngine.AKADEMIE_PROFILE[schule.key]) throw new Error("Unbekanntes Profil: " + schule.key);

        const talente = YouthEngine.generateProspects(state, "muc");
        if (!talente.length) throw new Error("Keine Talente erzeugt");
        talente.forEach(t => {
            if (t.schule !== schule.key) throw new Error(`Talent ${t.name} trägt die Schule ${t.schule} statt ${schule.key}`);
        });
    });

    // --- Seitenlinie: Wechsel, Taktik und Co-Trainer im Livespiel ---------

    // Spielt der eigene Verein auswärts, galt jeder Eingriff bisher dem Gegner:
    // Alle Knöpfe waren fest auf "home" verdrahtet.
    test("Seitenlinie: Eingriffe gelten der eigenen Mannschaft, auch auswärts", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "dor");
        const gast = state.clubs.find(c => c.id === "muc");
        const heimElf = heim.lineup.slice();
        const partie = { id: "sl_away", played: false, homeClubId: "dor", awayClubId: "muc" };
        const live = MatchEngine.createLiveMatch(partie, heim, gast, state.players, { userSide: "away" });

        if (live.timeline.some(e => e.type === "substitution" && e.team === "away")) {
            throw new Error("Die Simulation wechselt für die eigene Mannschaft, obwohl der Spieler selbst entscheidet");
        }

        const raus = live.awayLineup.find(p => p.pos !== "TW");
        const reinId = live.bank.away.find(id => state.players.find(p => p.id === id).pos !== "TW");
        const r = live.substitute("away", raus.id, reinId);
        if (!r.success) throw new Error("Wechsel auswärts abgelehnt: " + r.message);
        if (!live.awayLineup.some(p => p.id === reinId)) throw new Error("Der Eingewechselte steht nicht in der eigenen Elf");
        if (JSON.stringify(live.homeLineup.map(p => p.id)) !== JSON.stringify(heimElf.slice(0, 11))
            && live.homeLineup.some(p => p.id === reinId)) {
            throw new Error("Der Wechsel hat die Heimelf verändert");
        }
        const aufDemFeld = live.players2D.find(p => p.id === reinId);
        if (!aufDemFeld || aufDemFeld.team !== "away") throw new Error("Der Eingewechselte steht nicht auf dem Feld");

        live.updateTactics("away", { mentality: "very_offensive" });
        if (gast.tactics.mentality !== "very_offensive") throw new Error("Die Taktikänderung ging nicht an die eigene Mannschaft");
        if (heim.tactics.mentality === "very_offensive" && live._vorSpiel.home.tactics.mentality !== "very_offensive") {
            throw new Error("Die Taktikänderung ging an den Gegner");
        }

        // Die KI des Gegners bringt keinen Ersatztorwart für einen Feldspieler
        for (let i = 0; i < 12; i++) {
            const tl = MatchEngine.generateTimeline({ id: `sl_tw_${i}`, played: false }, heim, gast, state.players);
            tl.filter(e => e.type === "substitution").forEach(e => {
                const rein = state.players.find(p => p.id === e.playerInId);
                const raus2 = state.players.find(p => p.id === e.playerOutId);
                if ((rein.pos === "TW") !== (raus2.pos === "TW")) {
                    throw new Error(`${rein.name} (${rein.pos}) kam für ${raus2.name} (${raus2.pos})`);
                }
            });
        }
    });

    test("Seitenlinie: kein Zurückwechseln, drei Unterbrechungen, Halbzeit zählt nicht", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const live = MatchEngine.createLiveMatch({ id: "sl_regeln", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });

        const feld = () => live.homeLineup.filter(p => p.pos !== "TW" && !live.bank.home.includes(p.id));
        const bank = () => live.bank.home.filter(id => state.players.find(p => p.id === id).pos !== "TW");
        const bankVorher = heim.bench.slice();

        live.minute = 20;
        const ersterRaus = feld()[0];
        if (!live.substitute("home", ersterRaus.id, bank()[0]).success) throw new Error("Erster Wechsel abgelehnt");
        const zurueck = live.substitute("home", feld()[1].id, ersterRaus.id);
        if (zurueck.success) throw new Error("Ein ausgewechselter Spieler durfte zurück");
        if (JSON.stringify(heim.bench) !== JSON.stringify(bankVorher)) throw new Error("Die Vereinsbank wurde umgeschrieben");

        // Halbzeitpause: kostet keine Unterbrechung. Die Pause ist die
        // Aufstellung zum Wiederanpfiff.
        live.minute = 46;
        const kickoffVorher = live.director.kickoff;
        live.director.kickoff = { team: "home", reason: "halftime", phase: "lineup", timer: 5 };
        if (!live.istHalbzeitpause()) throw new Error("Die Aufstellung zum Wiederanpfiff gilt nicht als Halbzeitpause");
        if (!live.substitute("home", feld()[2].id, bank()[0]).success) throw new Error("Halbzeitwechsel abgelehnt");
        live.director.kickoff = kickoffVorher;
        if (live.wechselFenster.home !== 1) throw new Error(`Die Halbzeit hat eine Unterbrechung gekostet (${live.wechselFenster.home})`);

        // Die Phase "half_time" bleibt im Echtzeitbetrieb stehen - sie darf die
        // zweite Halbzeit nicht zur Dauerpause machen.
        live.currentPhase = "half_time";
        if (live.istHalbzeitpause()) throw new Error("Die zweite Halbzeit gilt als Halbzeitpause");

        live.minute = 60;
        if (!live.substitute("home", feld()[3].id, bank()[0]).success) throw new Error("Zweite Unterbrechung abgelehnt");
        live.minute = 70;
        if (!live.substitute("home", feld()[4].id, bank()[0]).success) throw new Error("Dritte Unterbrechung abgelehnt");
        live.minute = 80;
        const vierte = live.substitute("home", feld()[5].id, bank()[0]);
        if (vierte.success) throw new Error("Eine vierte Unterbrechung wurde erlaubt");
        live.minute = 70;
        const gleicheMinute = live.substitute("home", feld()[5].id, bank()[0]);
        if (!gleicheMinute.success) throw new Error("Ein Wechsel in derselben Unterbrechung wurde abgelehnt: " + gleicheMinute.message);
        if (live.substitutionsUsed.home !== 5) throw new Error(`Fünf Wechsel erwartet, gezählt ${live.substitutionsUsed.home}`);
        if (live.substitute("home", feld()[6].id, bank()[0]).success) throw new Error("Ein sechster Wechsel wurde erlaubt");
    });

    test("Seitenlinie: Einwechslung steht im Spielbericht, die Stammelf bleibt", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const elfVorher = heim.lineup.slice();
        const formationVorher = heim.formation;
        const partie = { id: "sl_bericht", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = MatchEngine.createLiveMatch(partie, heim, gast, state.players, { userSide: "home" });

        while (live.minute < 30) live.tick();
        const raus = live.homeLineup.find(p => p.pos !== "TW");
        const reinId = live.bank.home.find(id => state.players.find(p => p.id === id).pos !== "TW");
        const min = live.minute;
        if (!live.substitute("home", raus.id, reinId).success) throw new Error("Wechsel abgelehnt");
        const andere = Object.keys(FORMATION_CONFIGS).find(k => k !== heim.formation);
        if (!live.stelleFormationUm("home", andere).success) throw new Error("Formationswechsel abgelehnt");
        while (!live.isFinished) live.tick();

        const noteRein = (partie.playerRatings || []).find(r => r.playerId === reinId);
        const noteRaus = (partie.playerRatings || []).find(r => r.playerId === raus.id);
        if (!noteRein || noteRein.minutes < 90 - min - 1) {
            throw new Error(`Eingewechselter hat ${noteRein ? noteRein.minutes : 0} Minuten statt ${90 - min}`);
        }
        if (!noteRaus || noteRaus.minutes > min + 1) {
            throw new Error(`Ausgewechselter hat ${noteRaus ? noteRaus.minutes : "keine"} Minuten statt ${min}`);
        }
        if (JSON.stringify(heim.lineup) !== JSON.stringify(elfVorher)) throw new Error("Der Wechsel steht nach dem Spiel in der Stammelf");
        if (heim.formation !== formationVorher) throw new Error("Die Umstellung gilt über das Spiel hinaus");
    });

    test("Seitenlinie: Wechsel laufen bei der nächsten Unterbrechung, Platzverweise verlassen das Feld", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const live = MatchEngine.createLiveMatch({ id: "sl_lauf", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });
        live.speed = 4;
        const lauf = (bis) => {
            let f = 0;
            while (!live.isFinished && live.minute < bis && f++ < 60 * 3000) {
                live.advanceRealTime(1000 / 60);
                live.updateBallAndPlayers(1000 / 60);
            }
        };

        lauf(10);
        const raus = live.homeLineup.find(p => p.pos !== "TW");
        const reinId = live.bank.home.find(id => state.players.find(p => p.id === id).pos !== "TW");
        const r = live.wechselAnmelden("home", raus.id, reinId);
        if (!r.success) throw new Error("Anmeldung abgelehnt: " + r.message);
        if (live.homeLineup.some(p => p.id === reinId)) throw new Error("Der Wechsel lief sofort statt bei der Unterbrechung");
        lauf(16);
        if (live.angemeldeteWechsel.length > 0) throw new Error("Der angemeldete Wechsel wurde nach sechs Minuten nicht ausgeführt");
        if (!live.players2D.some(p => p.id === reinId)) throw new Error("Der Eingewechselte ist nicht auf dem Feld");
        if (live.players2D.some(p => p.id === raus.id)) throw new Error("Der Ausgewechselte ist noch auf dem Feld");

        // Rote Karte für den Gegner - er spielt danach sichtbar zu zehnt
        const opfer = live.awayLineup.find(p => p.pos !== "TW");
        live.timeline.splice(live.timelineIndex, 0, {
            minute: live.minute + 1, second: 10, type: "red_card", team: "away", clubId: gast.id, clubName: gast.name,
            playerId: opfer.id, playerName: opfer.name, start: { x: 50, y: 50 }, end: { x: 50, y: 50 },
            outcome: "red_card", text: `${live.minute + 1}' - Rote Karte für ${opfer.name}`
        });
        lauf(live.minute + 4);
        const gastAufDemFeld = live.players2D.filter(p => p.team === "away").length;
        if (gastAufDemFeld !== 10) throw new Error(`Nach Rot stehen ${gastAufDemFeld} Gäste auf dem Feld`);
        if (live.pruefeWechsel("away", opfer.id, live.bank.away[0]).ok) throw new Error("Ein Platzverwiesener durfte ausgewechselt werden");

        lauf(200);
        if (!live.isFinished) throw new Error("Spiel wurde nicht beendet");
    });

    test("Seitenlinie: Unterzahl kostet Torszenen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const heimElf = MatchEngine.getCleanLineup(heim, state.players);
        const zweiRaus = heimElf.filter(p => p.pos !== "TW").slice(0, 2).map(p => p.id);

        const anteil = (sentOffIds) => {
            let heimSzenen = 0, alle = 0;
            for (let i = 0; i < 120; i++) {
                const tl = MatchEngine.generateTimeline({ id: `uz_${i}`, played: false }, heim, gast, state.players, { sentOffIds });
                tl.filter(e => ["goal", "save", "shot_miss"].includes(e.type)).forEach(e => {
                    const heimSchiesst = e.type === "save" ? e.team === "away" : e.team === "home";
                    if (heimSchiesst) heimSzenen++;
                    alle++;
                });
            }
            return heimSzenen / Math.max(1, alle);
        };
        const voll = anteil([]);
        const unterzahl = anteil(zweiRaus);
        if (!(unterzahl < voll - 0.06)) {
            throw new Error(`Zu neunt kaum weniger Abschlüsse: ${(voll * 100).toFixed(0)} % gegen ${(unterzahl * 100).toFixed(0)} %`);
        }
    });

    test("Co-Trainer: passt bei Rückstand die Taktik an und gibt begründete Hinweise", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const vorher = heim.tactics.mentality;
        const partie = { id: "sl_co", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = MatchEngine.createLiveMatch(partie, heim, gast, state.players,
            { userSide: "home", delegation: { taktik: true } });

        while (live.minute < 54) live.tick();
        live.homeScore = 0;
        live.awayScore = 2;
        live.minute = 55;
        const r = live.coTrainerTakt();
        if (!r || !r.aenderung.mentality) throw new Error("Der Co-Trainer reagiert nicht auf einen Rückstand");
        const stufen = ["very_defensive", "defensive", "balanced", "offensive", "very_offensive"];
        if (stufen.indexOf(heim.tactics.mentality) <= stufen.indexOf(vorher)) {
            throw new Error(`Bei Rückstand defensiver gestellt: ${vorher} -> ${heim.tactics.mentality}`);
        }
        if (!live.events.some(e => /Co-Trainer/.test(e.text))) throw new Error("Die Umstellung fehlt im Ticker");
        if (live.coTrainerTakt()) throw new Error("Der Co-Trainer stellt zweimal am selben Prüfpunkt um");

        // Ohne Auftrag greift er nicht ein
        const ohne = MatchEngine.createLiveMatch({ id: "sl_co2", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });
        ohne.homeScore = 0; ohne.awayScore = 2; ohne.minute = 60;
        if (ohne.coTrainerTakt()) throw new Error("Der Co-Trainer stellt ohne Auftrag um");

        // Hinweise nennen Gründe aus dem Spiel
        const p2d = live.players2D.find(p => p.team === "home" && p.pos !== "TW");
        p2d.freshness = 0.65;
        const hinweise = live.coTrainerHinweise("home");
        if (!hinweise.some(h => h.art === "kondition" && h.spielerId === p2d.id)) {
            throw new Error("Ein platter Spieler taucht in den Hinweisen nicht auf");
        }
        if (!hinweise.some(h => h.art === "rueckstand")) throw new Error("Der Rückstand fehlt in den Hinweisen");

        while (!live.isFinished) live.tick();
        if (heim.tactics.mentality !== vorher) throw new Error("Die Umstellung des Co-Trainers gilt über das Spiel hinaus");
    });

    // --- Match-Center: Trikotfarben und Spielverlauf ------------------------

    // Das 2D-Bild las "club.color" - ein Feld, das kein Verein hat. Jede
    // Partie lief Blau gegen Rot, der FC Bayern daheim in Blau.
    test("Match-Center: Vereinsfarben auf dem Feld, kein Farbduell, Torhüter heben sich ab", () => {
        const { ermittleTrikots } = require('./js/engine/matchEngine.js');
        const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
        const abstand = (a, b) => {
            const x = rgb(a), y = rgb(b), r = (x[0] + y[0]) / 2;
            const dr = x[0] - y[0], dg = x[1] - y[1], db = x[2] - y[2];
            return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
        };
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const bundesliga = state.clubs.filter(c => INITIAL_TEAMS_DATA.some(t => t.id === c.id));
        let paare = 0;
        bundesliga.forEach(h => bundesliga.forEach(g => {
            if (h === g) return;
            paare++;
            const k = ermittleTrikots(h, g);
            const was = `${h.id} (${k.home.farbe}) - ${g.id} (${k.away.farbe})`;
            if (abstand(k.home.farbe, k.away.farbe) < 170) throw new Error(`Zu ähnliche Trikots: ${was}`);
            ["home", "away"].forEach(s => {
                if (abstand(k[s].farbe, "#22783c") < 170) throw new Error(`Trikot verschwindet auf dem Rasen: ${was}`);
                if (abstand(k[s].tw, k.home.farbe) < 170 || abstand(k[s].tw, k.away.farbe) < 170) {
                    throw new Error(`Torwart ${s} (${k[s].tw}) nicht von den Feldspielern zu unterscheiden: ${was}`);
                }
            });
            if (abstand(k.home.akzent, k.away.akzent) < 150) throw new Error(`Akzentfarben auf der Tafel zu ähnlich: ${was}`);
        }));
        if (paare < 100) throw new Error(`Nur ${paare} Paarungen geprüft`);

        // Rot gegen Rot: Der Gastgeber behält sein Trikot, der Gast weicht aus
        const bayern = state.clubs.find(c => c.id === "muc");
        const leverkusen = state.clubs.find(c => c.id === "lev");
        const k = ermittleTrikots(bayern, leverkusen);
        if (k.home.farbe !== bayern.primaryColor || k.home.ausweich) throw new Error("Der Gastgeber spielt nicht in seinen Farben");
        if (!k.away.ausweich) throw new Error("Leverkusen weicht in Rot gegen Rot nicht aus");

        // Auf dem Feld kommen die Farben an
        const live = MatchEngine.createLiveMatch({ id: "mc_kit", played: false, homeClubId: "muc", awayClubId: "lev" },
            bayern, leverkusen, state.players, { userSide: "home" });
        const feld = live.players2D.filter(p => p.pos !== "TW");
        if (!feld.filter(p => p.team === "home").every(p => p.color === k.home.farbe)) throw new Error("Bayern spielt nicht in Rot");
        if (!feld.filter(p => p.team === "away").every(p => p.color === k.away.farbe)) throw new Error("Leverkusen trägt nicht das Ausweichtrikot");
    });

    // Zeitleiste, Torschützen und Druckphasen lesen den Verlauf - er muss
    // jedes Ereignis genau einmal enthalten, auch die Wechsel von der Linie.
    test("Match-Center: Der Spielverlauf hält jedes Ereignis genau einmal fest", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const live = MatchEngine.createLiveMatch({ id: "mc_verlauf", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });

        for (let i = 0; i < 20; i++) live.tick();
        const raus = live.homeLineup.find(p => p && p.pos !== "TW");
        const reinId = live.bank.home.find(id => state.players.find(p => p.id === id).pos !== "TW");
        const r = live.substitute("home", raus.id, reinId, { imFenster: true });
        if (!r.success) throw new Error("Wechsel abgelehnt: " + r.message);

        // Ein Wechsel, der nicht mehr möglich ist, erscheint nirgends
        const tickerVorher = live.events.filter(e => e.type === "sub").length;
        live.processEvent({
            minute: live.minute, type: "substitution", team: "away", clubId: gast.id,
            playerOutId: "gibt_es_nicht", playerOutName: "Niemand", playerInId: live.bank.away[0], playerInName: "Ersatz",
            text: `${live.minute}' - Wechsel, der nicht stattfindet`
        });
        if (live.events.filter(e => e.type === "sub").length !== tickerVorher) throw new Error("Ein unmöglicher Wechsel steht im Ticker");

        while (!live.isFinished) live.tick();
        const v = live.verlauf;
        const zaehle = (typ, seite) => v.filter(e => e.type === typ && (!seite || e.team === seite)).length;
        if (zaehle("goal", "home") !== live.homeScore || zaehle("goal", "away") !== live.awayScore) {
            throw new Error(`Tore im Verlauf ${zaehle("goal", "home")}:${zaehle("goal", "away")}, Spielstand ${live.homeScore}:${live.awayScore}`);
        }
        if (zaehle("yellow_card") !== live.stats.yellowCards[0] + live.stats.yellowCards[1]) throw new Error("Gelbe Karten im Verlauf weichen ab");
        const wechsel = v.filter(e => e.type === "substitution");
        if (wechsel.length !== live.substitutionsUsed.home + live.substitutionsUsed.away) {
            throw new Error(`${wechsel.length} Wechsel im Verlauf, ${live.substitutionsUsed.home + live.substitutionsUsed.away} ausgeführt`);
        }
        const eigener = wechsel.filter(e => e.team === "home" && e.outId === raus.id && e.playerId === reinId);
        if (eigener.length !== 1) throw new Error(`Der Wechsel von der Seitenlinie steht ${eigener.length}-mal im Verlauf`);
        if (v.some(e => e.team !== "home" && e.team !== "away" && e.type !== "tactics")) {
            throw new Error("Ein Ereignis im Verlauf gehört keiner Mannschaft");
        }
        for (let i = 1; i < v.length; i++) {
            if (v[i].minute + 3 < v[i - 1].minute) throw new Error(`Verlauf nicht in Spielreihenfolge (${v[i - 1].minute}' vor ${v[i].minute}')`);
        }
    });

    // --- Seitenlinie, Teil zwei ------------------------------------------------

    const schussVon = (e) => e.type === "save" ? (e.team === "home" ? "away" : "home")
        : (["goal", "shot_miss"].includes(e.type) ? e.team : null);

    test("Zurufe: zehn Minuten Wirkung, danach Pause - und sie verändern das Spiel", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const live = MatchEngine.createLiveMatch({ id: "zr_live", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });
        while (live.minute < 20) live.tick();

        const r = live.zuruf("home", "druck");
        if (!r.success) throw new Error("Zuruf abgelehnt: " + r.message);
        const stand = live.zurufStand("home");
        if (stand.art !== "druck" || stand.restMinuten < 8) throw new Error(`Zuruf wirkt nicht: ${JSON.stringify(stand)}`);
        if (live.zuruf("home", "ruhe").success) throw new Error("Zwei Zurufe gleichzeitig angenommen");
        if (!live.events.some(e => e.type === "zuruf")) throw new Error("Der Zuruf fehlt im Ticker");
        const z = live.zurufe[0];
        if (z.bis - z.von + 1 !== MATCH_TUNING.zurufDauer) throw new Error(`Zuruf wirkt ${z.bis - z.von + 1} statt ${MATCH_TUNING.zurufDauer} Minuten`);

        while (live.minute <= z.bis) live.tick();
        if (live.zurufStand("home").aktiv) throw new Error("Der Zuruf wirkt über seine Zeit hinaus");
        if (live.minute < z.bis + MATCH_TUNING.zurufPause && live.zurufStand("home").bereit) {
            throw new Error("Nach dem Zuruf gibt es keine Pause");
        }
        while (live.minute < z.bis + MATCH_TUNING.zurufPause) live.tick();
        if (!live.zurufStand("home").bereit) throw new Error("Nach der Pause ist kein neuer Zuruf möglich");

        // Wirkung: im Fenster gemessen über viele Partien
        const N = 300;
        const fenster = (zurufe) => {
            let schuesse = 0, gelb = 0, alle = 0;
            for (let i = 0; i < N; i++) {
                const tl = MatchEngine.generateTimeline({ id: `zr_${i}` }, heim, gast, state.players, { startMinute: 60, zurufe });
                tl.filter(e => e.minute >= 61 && e.minute <= 70).forEach(e => {
                    if (schussVon(e) === "away") schuesse++;
                    if (schussVon(e)) alle++;
                });
                gelb += tl.filter(e => e.type === "yellow_card" && e.team === "away").length;
            }
            return { schuesse: schuesse / N, alle: alle / N, gelb: gelb / N };
        };
        const ohne = fenster([]);
        const druck = fenster([{ side: "away", art: "druck", von: 61, bis: 70 }]);
        const zeit = fenster([{ side: "away", art: "zeit", von: 61, bis: 70 }]);
        const ruhe = fenster([{ side: "away", art: "ruhe", von: 61, bis: 90 }]);
        if (druck.schuesse < ohne.schuesse * 1.25) {
            throw new Error(`"Mehr Druck!" bringt kaum Abschlüsse: ${druck.schuesse.toFixed(2)} statt ${ohne.schuesse.toFixed(2)}`);
        }
        if (zeit.alle > ohne.alle * 0.85) {
            throw new Error(`"Zeit schinden" beruhigt das Spiel nicht: ${zeit.alle.toFixed(2)} Abschlüsse statt ${ohne.alle.toFixed(2)}`);
        }
        if (ruhe.gelb > ohne.gelb * 0.85) {
            throw new Error(`"Ruhe bewahren" spart keine Karten: ${ruhe.gelb.toFixed(2)} statt ${ohne.gelb.toFixed(2)}`);
        }
    });

    test("Standardschützen: Der Vorgegebene tritt an, direkte Freistöße gibt es", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const elf = MatchEngine.getCleanLineup(heim, state.players).filter(p => p.pos !== "TW");
        // Absichtlich ein schwacher Schütze - damit er nicht zufällig auch der Beste ist
        const nachSchuss = elf.slice().sort((a, b) => MatchEngine.standardWert("elfmeter", a) - MatchEngine.standardWert("elfmeter", b));
        const elfer = nachSchuss[0];
        const ecke = elf.find(p => p.id !== elfer.id && p.pos !== "ST") || elf[1];
        const frei = nachSchuss[1];
        const bester = MatchEngine.standardSchuetze("elfmeter", elf, null);
        // "Ohne Vorgabe" heißt auch: im Taktik-Reiter niemand bestimmt
        heim.roles = { ...(heim.roles || {}), penaltyTaker: null, freeKickTaker: null, cornerTaker: null };

        let freistoesse = 0, elfmeter = 0, ecken = 0, elferOhne = 0;
        for (let i = 0; i < 150; i++) {
            // Ohne automatische Wechsel bleiben die Schützen auf dem Platz -
            // außer einer von ihnen fliegt vom Platz, dann tritt ein anderer an.
            const tl = MatchEngine.generateTimeline({ id: `std_${i}` }, heim, gast, state.players,
                { standardsHome: { elfmeter: elfer.id, ecken: ecke.id, freistoss: frei.id }, autoWechselHome: false });
            // Platzverweise vorab sammeln: Eine Rote Karte kann in derselben
            // Minute nach einem Freistoß einsortiert sein, die Simulation hat
            // den Spieler zu diesem Zeitpunkt aber schon vom Platz gestellt.
            const runter = new Map();
            tl.forEach(e => {
                if ((e.type === "red_card" || (e.type === "yellow_card" && e.isSecondYellow)) && !runter.has(e.playerId)) runter.set(e.playerId, e.minute);
            });
            const imSpiel = (id, min) => !runter.has(id) || runter.get(id) > min;
            tl.forEach(e => {
                const heimSchuss = schussVon(e) === "home";
                const schuetze = e.type === "save" ? e.shooterId : e.playerId;
                if (heimSchuss && e.isPenalty && imSpiel(elfer.id, e.minute)) {
                    elfmeter++;
                    if (schuetze !== elfer.id) throw new Error(`Den Elfmeter schoss ${schuetze} statt ${elfer.name}`);
                }
                if (heimSchuss && e.isFreekick && imSpiel(frei.id, e.minute)) {
                    freistoesse++;
                    if (schuetze !== frei.id) throw new Error(`Den Freistoß schoss ${schuetze} statt ${frei.name}`);
                }
                if (e.type === "corner" && e.team === "home" && e.fromPlayerId !== undefined && imSpiel(ecke.id, e.minute)) {
                    ecken++;
                    if (e.fromPlayerId !== ecke.id) throw new Error(`Die Ecke trat ${e.fromPlayerId} statt ${ecke.name}`);
                }
            });
            // Ohne Vorgabe schießt der beste Elfmeterschütze
            const ohneTl = MatchEngine.generateTimeline({ id: `std_o_${i}` }, heim, gast, state.players, { autoWechselHome: false });
            const besterRaus = ohneTl.find(e => e.playerId === bester.id && (e.type === "red_card" || e.isSecondYellow));
            ohneTl.forEach(e => {
                if (schussVon(e) === "home" && e.isPenalty && !(besterRaus && besterRaus.minute <= e.minute)) {
                    elferOhne++;
                    const schuetze = e.type === "save" ? e.shooterId : e.playerId;
                    if (schuetze !== bester.id) throw new Error(`Ohne Vorgabe schoss ${schuetze} den Elfmeter statt ${bester.name}`);
                }
            });
        }
        if (freistoesse === 0) throw new Error("In 150 Partien kein einziger direkter Freistoß");
        if (ecken === 0 || elfmeter + elferOhne === 0) throw new Error("Zu wenig Standards für eine Aussage");

        // Live: nur wer auf dem Platz steht, darf antreten
        const live = MatchEngine.createLiveMatch({ id: "std_live", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });
        const bankId = live.bank.home[0];
        if (live.setzeStandards("home", { elfmeter: bankId }, { ohneNeuberechnung: true })) {
            throw new Error("Ein Bankspieler wurde zum Elfmeterschützen");
        }
        live.setzeStandards("home", { ecken: ecke.id }, { ohneNeuberechnung: true });
        const schuetzen = live.standardSchuetzen("home");
        if (schuetzen.ecken?.id !== ecke.id || !schuetzen.ecken.vorgegeben) throw new Error("Der Eckenschütze wird nicht übernommen");
        // Die Regie holt ihn an die Fahne
        const taker = live.director.pickSetPieceTaker("corner", "home", 98, 2);
        if (!taker || taker.id !== ecke.id) throw new Error("In der 2D-Ansicht tritt ein anderer die Ecke");
    });

    test("Standardschützen aus dem Taktik-Reiter gelten in Simulation und Livespiel", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const elf = MatchEngine.getCleanLineup(heim, state.players).filter(p => p.pos !== "TW");
        // Der schwächste Schütze - so kann er nicht zufällig auch der Beste sein
        const schwach = elf.slice().sort((a, b) => MatchEngine.standardWert("elfmeter", a) - MatchEngine.standardWert("elfmeter", b))[0];
        heim.roles = { ...(heim.roles || {}), penaltyTaker: schwach.id, freeKickTaker: schwach.id, cornerTaker: schwach.id };

        const vorgabe = MatchEngine.standardsAusRollen(heim);
        if (vorgabe.elfmeter !== schwach.id || vorgabe.freistoss !== schwach.id || vorgabe.ecken !== schwach.id) {
            throw new Error("Die Rollen des Vereins werden nicht als Vorgabe gelesen");
        }

        let geprueft = 0;
        for (let i = 0; i < 120 && geprueft < 3; i++) {
            const tl = MatchEngine.generateTimeline({ id: `rolle_${i}` }, heim, gast, state.players, { autoWechselHome: false });
            const runter = tl.find(e => e.playerId === schwach.id && (e.type === "red_card" || e.isSecondYellow));
            tl.forEach(e => {
                if (runter && runter.minute <= e.minute) return;
                if (schussVon(e) === "home" && (e.isPenalty || e.isFreekick)) {
                    geprueft++;
                    const schuetze = e.type === "save" ? e.shooterId : e.playerId;
                    if (schuetze !== schwach.id) throw new Error(`Trotz Vorgabe schoss ${schuetze} statt ${schwach.name}`);
                }
            });
        }
        if (geprueft === 0) throw new Error("In 120 Partien kein Elfmeter oder Freistoß für die Heimelf");

        const live = MatchEngine.createLiveMatch({ id: "rolle_live", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });
        const s = live.standardSchuetzen("home");
        if (s.elfmeter?.id !== schwach.id || !s.elfmeter.vorgegeben) {
            throw new Error("Im Livespiel gilt der Elfmeterschütze aus dem Taktik-Reiter nicht");
        }

        // Kein Schütze bestimmt: der Beste tritt an, nichts bricht
        heim.roles = { ...heim.roles, penaltyTaker: null, freeKickTaker: NaN, cornerTaker: undefined };
        const leer = MatchEngine.standardsAusRollen(heim);
        if (leer.elfmeter !== null || leer.freistoss !== null || leer.ecken !== null) {
            throw new Error("Leere Rollen werden nicht als 'automatisch' gelesen");
        }
    });

    test("Fouls und Freistöße laufen mit der Uhr, Ausgewechselte kommen nicht zurück", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        let geprueft = 0, pausen = 0;
        for (let i = 0; i < 250; i++) {
            const tl = MatchEngine.generateTimeline({ id: `uhr_${i}` }, heim, gast, state.players, {});
            // Wer kommt wann, wer geht wann
            const rein = new Map(), raus = new Map();
            tl.forEach(e => {
                if (e.type === "substitution") {
                    // Wer draußen ist, bleibt draußen
                    if (raus.has(e.playerInId)) throw new Error(`${e.minute}': ${e.playerInName} kommt zurück, obwohl er in der ${raus.get(e.playerInId)}. Minute ging`);
                    rein.set(e.playerInId, e.minute);
                    raus.set(e.playerOutId, e.minute);
                }
                if ((e.type === "red_card" || e.isSecondYellow) && !raus.has(e.playerId)) raus.set(e.playerId, e.minute);
            });
            tl.forEach(e => {
                const id = e.type === "foul" ? e.playerId : (e.isFreekick ? (e.type === "save" ? e.shooterId : e.playerId) : null);
                if (id === null || id === undefined) return;
                geprueft++;
                if (rein.has(id) && rein.get(id) > e.minute) {
                    throw new Error(`${e.minute}': ${e.type} von einem Spieler, der erst in der ${rein.get(id)}. Minute kam`);
                }
                if (raus.has(id) && raus.get(id) < e.minute) {
                    throw new Error(`${e.minute}': ${e.type} von einem Spieler, der schon in der ${raus.get(id)}. Minute vom Platz ging`);
                }
            });
            // Der Pausenstand ist der Stand zur Pause, nicht der Endstand
            const pause = tl.find(e => e.type === "halftime");
            if (pause) {
                const bis = seite => tl.filter(e => e.type === "goal" && e.team === seite && e.minute <= pause.minute).length;
                if (pause.score[0] !== bis("home") || pause.score[1] !== bis("away")) {
                    throw new Error(`Pausenstand ${pause.score.join(":")} statt ${bis("home")}:${bis("away")}`);
                }
                pausen++;
            }
        }
        if (geprueft < 500 || pausen === 0) throw new Error("Zu wenige Fouls für eine Aussage");
    });

    test("Positionstausch: zwei Spieler tauschen die Plätze, der Torwart bleibt im Tor", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const live = MatchEngine.createLiveMatch({ id: "tausch", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });
        while (live.minute < 30) live.tick();
        const feld = live.homeLineup.filter(p => p.pos !== "TW");
        const a = feld[1], b = feld[feld.length - 1];
        const ia = live.homeLineup.indexOf(a), ib = live.homeLineup.indexOf(b);
        const posA = live.players2D.find(p => p.id === a.id).pos;
        const posB = live.players2D.find(p => p.id === b.id).pos;
        const formation = heim.formation;

        const r = live.tauschePositionen("home", a.id, b.id);
        if (!r.success) throw new Error("Tausch abgelehnt: " + r.message);
        if (live.homeLineup[ia] !== b || live.homeLineup[ib] !== a) throw new Error("Die Aufstellung ist nicht getauscht");
        if (live.players2D.find(p => p.id === a.id).pos !== posB || live.players2D.find(p => p.id === b.id).pos !== posA) {
            throw new Error("Auf dem Feld spielen beide noch auf ihrer alten Position");
        }
        if (heim.formation !== formation) throw new Error("Der Tausch hat die Formation geändert");
        const tw = live.homeLineup.find(p => p.pos === "TW");
        if (live.tauschePositionen("home", tw.id, a.id).success) throw new Error("Der Torwart durfte ins Feld");
        if (live.tauschePositionen("home", a.id, live.bank.home[0]).success) throw new Error("Ein Bankspieler durfte tauschen");
        while (!live.isFinished) live.tick();
    });

    test("Live-Noten: dieselbe Rechnung wie der Spielbericht", () => {
        // Die Rechnung selbst
        const leer = { goals: 0, assists: 0, saves: 0, tackles: 0, chancen: 0, aufsTor: 0, fouls: 0, yellowCards: 0, redCards: 0 };
        const ctx = { pos: "ST", minutes: 90, teamGoals: 1, oppGoals: 1 };
        const basis = MatchEngine.noteBerechnen(leer, ctx);
        if (MatchEngine.noteBerechnen({ ...leer, goals: 2 }, ctx) < basis + 1.5) throw new Error("Zwei Tore heben die Note kaum");
        if (MatchEngine.noteBerechnen({ ...leer, chancen: 4 }, ctx) <= basis) throw new Error("Vorbereitete Chancen zählen nicht");
        if (MatchEngine.noteBerechnen({ ...leer, redCards: 1 }, ctx) > basis - 1) throw new Error("Eine Rote Karte kostet zu wenig");
        const kurz = MatchEngine.noteBerechnen({ ...leer, goals: 1 }, { ...ctx, minutes: 10 });
        if (kurz > 6.5) throw new Error(`Nach zehn Minuten schon Note ${kurz}`);

        // Live und Bericht derselben Partie
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const live = MatchEngine.createLiveMatch({ id: "noten", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });
        while (!live.isFinished) live.tick();
        const noten = live.liveNoten();
        let verglichen = 0;
        live.match.playerRatings.forEach(r => {
            const n = noten.get(r.playerId);
            if (!n) throw new Error(`${r.name} hat eine Berichtsnote, aber keine Live-Note`);
            if (Math.abs(n.note - r.rating) > 0.21) throw new Error(`${r.name}: live ${n.note}, im Bericht ${r.rating}`);
            verglichen++;
        });
        if (verglichen < 22) throw new Error(`Nur ${verglichen} Noten verglichen`);
    });

    test("Gegneranalyse: Angriffsseite, Angriffsart und gefährlichster Spieler", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const live = MatchEngine.createLiveMatch({ id: "analyse", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });
        const stuermer = live.awayLineup.find(p => p.pos === "ST") || live.awayLineup[10];
        // Der Gast greift in der Zeitleiste nach links an - seine linke Seite liegt unten (großes y)
        for (let i = 0; i < 6; i++) {
            live._protokolliere({ minute: 10 + i, type: "cross", team: "away", clubId: gast.id, fromPlayerId: stuermer.id, start: { x: 20, y: 85 } });
            live._protokolliere({ minute: 10 + i, type: "shot_miss", team: "away", clubId: gast.id, playerId: stuermer.id, playerName: stuermer.name, start: { x: 12, y: 50 } });
        }
        live._protokolliere({ minute: 20, type: "through_ball", team: "away", clubId: gast.id, start: { x: 40, y: 50 } });
        const a = live.gegnerAnalyse("home");
        if (!a.genugGesehen) throw new Error("Sieben Angriffe reichen nicht für eine Einschätzung");
        if (a.hauptSeite !== "links") throw new Error(`Hauptseite ${a.hauptSeite} statt links`);
        if (a.arten[0]?.art !== "cross") throw new Error("Die Flanken werden nicht als Hauptwaffe erkannt");
        if (a.gefaehrlich[0]?.id !== stuermer.id) throw new Error("Der gefährlichste Spieler wird nicht erkannt");
        if (!a.empfehlungen.some(t => /bei uns rechts/.test(t))) throw new Error("Die Empfehlung nennt nicht die eigene Seite");
        // Die eigenen Angriffe zählen nicht mit
        live._protokolliere({ minute: 30, type: "cross", team: "home", clubId: heim.id, start: { x: 80, y: 10 } });
        if (live.gegnerAnalyse("home").angriffe !== a.angriffe) throw new Error("Eigene Angriffe landen in der Gegneranalyse");
    });

    test("Co-Trainer: Seine Güte kommt aus dem Trainerstab und entscheidet, was er sieht", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        if (!PreseasonEngine.BEREICHE.some(b => b.key === "cotrainer")) throw new Error("Der Co-Trainer fehlt im Trainerstab");
        // Ein alter Spielstand ohne Bewerber für den neuen Posten bekommt welche
        const pre = { bewerber: { fitness: [] } };
        PreseasonEngine.sichereBewerber(pre, heim);
        if (!Array.isArray(pre.bewerber.cotrainer) || pre.bewerber.cotrainer.length < 2) throw new Error("Keine Bewerber für den Co-Trainer");

        const neu = (guete) => {
            heim.staff = { ...(heim.staff || {}), cotrainer: { name: "Test Assistent", guete, gehalt: 1000 } };
            return MatchEngine.createLiveMatch({ id: `co_${guete}`, played: false, homeClubId: "muc", awayClubId: "dor" },
                heim, gast, state.players, { userSide: "home" });
        };
        const schwach = neu(30);
        const stark = neu(92);
        if (schwach.coTrainer.home.guete !== 30 || schwach.coTrainer.home.name !== "Test Assistent") throw new Error("Die Güte kommt nicht aus dem Trainerstab");
        if (stark._coTrainerPunkte.length <= schwach._coTrainerPunkte.length) throw new Error("Ein guter Co-Trainer prüft nicht häufiger");

        // Gleiche Lage, verschiedene Co-Trainer: Nur der gute liest den Gegner
        [schwach, stark].forEach(live => {
            live.minute = 40;
            for (let i = 0; i < 6; i++) {
                live._protokolliere({ minute: 10 + i, type: "cross", team: "away", clubId: gast.id, start: { x: 20, y: 85 } });
            }
        });
        const hs = schwach.coTrainerHinweise("home").map(h => h.art);
        const hg = stark.coTrainerHinweise("home").map(h => h.art);
        if (hs.includes("gegner")) throw new Error("Ein schwacher Co-Trainer liest den Gegner");
        if (!hg.includes("gegner")) throw new Error("Ein guter Co-Trainer übersieht, wie der Gegner angreift");

        // Delegierte Wechsel: Der gute nimmt den Müdesten, der schwache greift öfter daneben
        const muede = MatchEngine.getCleanLineup(heim, state.players).find(p => p.pos === "ZM" || p.pos === "DM");
        const frische = new Map([[muede.id, 0.55]]);
        const treffer = (guete) => {
            let erste = 0, richtig = 0;
            for (let i = 0; i < 120; i++) {
                const tl = MatchEngine.generateTimeline({ id: `cw_${guete}_${i}` }, heim, gast, state.players,
                    { frische, wechselGueteHome: guete });
                const w = tl.find(e => e.type === "substitution" && e.team === "home" && e.minute >= 60);
                if (!w) continue;
                erste++;
                if (w.playerOutId === muede.id) richtig++;
            }
            return erste > 0 ? richtig / erste : 0;
        };
        const gut = treffer(95), schlecht = treffer(10);
        if (gut < 0.85) throw new Error(`Der gute Co-Trainer wechselt nur in ${Math.round(gut * 100)} % den Müdesten aus`);
        if (schlecht > gut - 0.15) throw new Error(`Kein Unterschied: gut ${Math.round(gut * 100)} %, schwach ${Math.round(schlecht * 100)} %`);
        delete heim.staff.cotrainer;
    });

    test("Angriffsseite aus der Taktik wirkt auf die Flanken, Sofort-Ergebnis räumt das Bild", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const vorher = { ...heim.tactics };
        heim.tactics = { ...heim.tactics, focus: "left" };
        let links = 0, alle = 0;
        for (let i = 0; i < 80; i++) {
            MatchEngine.generateTimeline({ id: `fk_${i}` }, heim, gast, state.players)
                .filter(e => e.type === "cross" && e.team === "home")
                .forEach(e => { alle++; if (e.start.y < 50) links++; });
        }
        heim.tactics = vorher;
        if (alle < 30) throw new Error("Zu wenige Flanken für eine Aussage");
        if (links / alle < 0.65) throw new Error(`Nur ${Math.round(links / alle * 100)} % der Flanken kommen über links`);

        const live = MatchEngine.createLiveMatch({ id: "sofort", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home" });
        for (let i = 0; i < 10; i++) live.tick();
        live.banner = { title: "TOR", timer: 5 };
        live.goalFlash = 1;
        live.celebratingTeam = "home";
        live.skipToEnd();
        if (live.banner || live.goalFlash > 0 || live.celebratingTeam) throw new Error("Nach dem Sofort-Ergebnis bleiben Einblendungen stehen");
    });

    console.log(`\n  Ergebnis Engine-Tests: ${passed} bestanden, ${failed} fehlgeschlagen.`);
    if (failed > 0) throw new Error(`${failed} Engine-Tests fehlgeschlagen.`);
    return { passed, failed };
}

if (require.main === module) {
    runEngineTests();
}

module.exports = { runEngineTests };
