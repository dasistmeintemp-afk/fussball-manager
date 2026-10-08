/**
 * Test-Suite 3: Subsystem- und Engine-Tests
 */
const { testAusgewaehlt, laufzeit, zufallFuer } = require('./test_filter.js');
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
const { MatchplanEngine } = require('./js/engine/matchplanEngine.js');
const { PositionEngine } = require('./js/engine/positionEngine.js');
const { TacticsEngine } = require('./js/engine/tacticsEngine.js');
const { MatchFlowEngine } = require('./js/engine/matchFlowEngine.js');
const { EigenschaftenEngine } = require('./js/engine/eigenschaftenEngine.js');
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
const { DevelopmentPlanEngine } = require('./js/engine/developmentPlanEngine.js');
const { REAL_CLUBS_BY_LEAGUE } = require('./js/data/realClubs.js');

function runEngineTests() {
    console.log("\n=======================================================");
    console.log("   [TEST SUITE: GAME ENGINES] test_engine.js          ");
    console.log("=======================================================");

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        if (!testAusgewaehlt(name)) return;
        zufallFuer(name);
        const start = Date.now();
        try {
            fn();
            console.log(`  ✅ ${name}${laufzeit(start)}`);
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

    test("Sportdirektor: Schlägt alle zwei Wochen passende, bezahlbare Spieler vor und berät auf Wunsch", () => {
        const { SportdirektorEngine: SD } = require('./js/engine/sportdirektorEngine.js');
        const vorlage = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const bochum = vorlage.clubs.find(c => c.name === "VfL Bochum");
        const state = GameState.createNewGame(bochum.id, "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const nach = new Map(state.players.map(p => [String(p.id), p]));
        const spieler = v => nach.get(String(v.id));

        // Ein fester Sportdirektor mit Namen
        const person = SD.person(state);
        if (!person.name || SD.person(state).name !== person.name) throw new Error("Kein fester Sportdirektor");

        // Die Baustellen: sortiert nach Bedarf
        const lage = SD.lage(state);
        for (let i = 1; i < lage.gruppen.length; i++) {
            if (lage.gruppen[i - 1].bedarf < lage.gruppen[i].bedarf) throw new Error("Die Baustellen sind nicht nach Bedarf sortiert");
        }

        // Sofort-Verstärkungen: erreichbar, bezahlbar, besser als der Beste dort, einer je Verein
        const u = SD.ungenauigkeit(state);
        const stamm = SD.suche(state, { gruppe: "auto", rolle: "stamm", anzahl: 5 });
        if (!stamm.length) throw new Error("Für Bochum findet der Sportdirektor keine Verstärkung");
        const vereine = new Set();
        stamm.forEach(v => {
            const p = spieler(v);
            const gruppe = lage.gruppen.find(g => g.key === v.gruppe);
            if (p.clubId === club.id || !TransferEngine.isWithinReach(p, club, state.clubs)) throw new Error(`${p.name} ist nicht erreichbar`);
            if (v.preis > club.transferBudget) throw new Error(`${p.name} ist zu teuer`);
            if (gruppe.bester && p.overall < gruppe.bester.overall + 2 - 2 * u) throw new Error(`${p.name} ist keine Verstärkung`);
            if (p.clubId && vereine.has(p.clubId)) throw new Error("Zwei Vorschläge aus demselben Verein");
            vereine.add(p.clubId);
            if (!v.grund || !/sofort spielen/.test(v.grund)) throw new Error("Vorschlag ohne Begründung");
        });

        // Beratung nach Vorgabe: Position, Alter, Rolle
        const sturm = SD.berate(state, { gruppe: "ST", rolle: "stamm", maxAlter: 26 });
        if (sturm.vorschlaege.some(v => spieler(v).pos !== "ST" || spieler(v).age > 26)) throw new Error("Die Vorgabe Sturm bis 26 wird nicht eingehalten");
        if (!/Für den Sturm/.test(sturm.kopf) && !/niemanden/.test(sturm.kopf)) throw new Error("Die Antwort passt nicht zur Frage: " + sturm.kopf);
        if (SD.suche(state, { gruppe: "auto", rolle: "talent" }).some(v => spieler(v).age > 21)) throw new Error("Ein Talent über 21");

        // Ablösefrei: nur Vereinslose - und ein starker Vereinsloser wird gefunden
        const frei = state.players.filter(p => p.clubId && p.clubId !== club.id && p.pos === "ST")
            .sort((a, b) => b.overall - a.overall).find(p => TransferEngine.isWithinReach(p, club, state.clubs));
        const alterVerein = state.clubs.find(c => c.id === frei.clubId);
        alterVerein.playerIds = alterVerein.playerIds.filter(id => id !== frei.id);
        frei.clubId = null;
        const ablosefrei = SD.suche(state, { gruppe: "ST", rolle: "stamm", nurAblosefrei: true });
        if (!ablosefrei.some(v => v.id === frei.id) || ablosefrei.some(v => spieler(v).clubId)) throw new Error("Ablösefrei findet nicht den Vereinslosen");

        // Alle zwei Wochen ins Postfach - ohne denselben Namen gleich wieder
        const start = state.currentDayIndex || 0;
        if (SD.pruefeTag(state) !== null) throw new Error("Vorschläge schon am ersten Tag");
        state.currentDayIndex = start + 13;
        if (SD.pruefeTag(state) !== null) throw new Error("Vorschläge nach 13 Tagen");
        state.currentDayIndex = start + 14;
        if (!SD.pruefeTag(state)) throw new Error("Nach zwei Wochen keine Vorschläge");
        const erste = state.inbox[0];
        if (erste.type !== "sportdirektor" || !erste.vorschlaege.length || erste.vorschlaege.length > SD.ANZAHL) throw new Error("Falsche Vorschlagsnachricht");
        state.currentDayIndex = start + 28;
        SD.pruefeTag(state);
        const zweite = state.inbox[0];
        if (zweite === erste || zweite.vorschlaege.some(v => erste.vorschlaege.some(e => e.id === v.id))) throw new Error("Dieselben Namen zwei Wochen später");

        // Ein Suchauftrag lenkt die regelmäßigen Vorschläge
        SD.setzeAuftrag(state, { gruppe: "IV", rolle: "talent" });
        state.currentDayIndex = start + 42;
        SD.pruefeTag(state);
        const dritte = state.inbox[0];
        const imAuftrag = dritte.vorschlaege.every(v => spieler(v).pos === "IV" && spieler(v).age <= 21);
        if (!imAuftrag && !/Suchauftrag habe ich gerade niemanden/.test(dritte.body)) throw new Error("Der Suchauftrag wird übergangen");

        // Seine Einschätzung ist so gut wie der Chefscout
        club.staff = Object.assign({}, club.staff, { scout: { name: "Schwach", guete: 30 } });
        const grob = SD.ungenauigkeit(state);
        club.staff.scout = { name: "Stark", guete: 95 };
        if (!(grob > SD.ungenauigkeit(state))) throw new Error("Ein besserer Chefscout macht ihn nicht genauer");
    });

    test("Vorstand: Das Saisonziel richtet sich nach Kader, Etat und Ansehen in der eigenen Liga", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const bayern = state.clubs.find(c => c.id === "muc");
        if (bayern.vorstandsziel?.platz !== 1 || bayern.boardExpectation !== "championship") throw new Error("Der Krösus soll nicht Meister werden");
        const willkommen = state.inbox.find(m => m.type === "welcome");
        if (!/stärkste der Liga/.test(willkommen.body)) throw new Error("Die Begrüßung begründet das Ziel nicht");

        // Ein Bundesligist aus der Mitte: Kader stärken hebt das Ziel, schwächen senkt es
        const liga1 = state.clubs.filter(c => c.leagueId === bayern.leagueId);
        const nach = new Map(state.players.map(p => [p.id, p]));
        liga1.sort((a, b) => ContractEngine.vereinsNiveau(b, nach) - ContractEngine.vereinsNiveau(a, nach));
        const mitte = liga1[Math.floor(liga1.length / 2)];
        const kader = state.players.filter(p => p.clubId === mitte.id);
        const normal = BoardEngine.bestimmeZiel(state, mitte).platz;
        kader.forEach(p => { p.overall += 30; });
        const stark = BoardEngine.bestimmeZiel(state, mitte);
        kader.forEach(p => { p.overall -= 60; });
        const schwach = BoardEngine.bestimmeZiel(state, mitte);
        if (!(stark.platz < normal && normal < schwach.platz)) throw new Error(`Ziel stark/normal/schwach: ${stark.platz}/${normal}/${schwach.platz}`);
        if (stark.raenge.kader !== 1 || schwach.raenge.kader !== liga1.length) throw new Error("Der Kaderrang stimmt nicht");

        // Wer in allem Letzter ist, soll die Klasse halten - mehr nicht, aber auch nicht weniger
        const [lohn, budget, ruf] = [mitte.wageBudget, mitte.transferBudget, mitte.reputation];
        Object.assign(mitte, { wageBudget: 0, transferBudget: 0, reputation: 1 });
        const letzter = BoardEngine.bestimmeZiel(state, mitte);
        if (letzter.platz !== 16 || letzter.art !== "avoid_relegation") throw new Error(`Der Letzte soll den Klassenerhalt schaffen, nicht Platz ${letzter.platz}`);
        Object.assign(mitte, { wageBudget: lohn, transferBudget: budget, reputation: ruf });
        kader.forEach(p => { p.overall += 30; });

        // Geld und Ansehen zählen mit
        mitte.wageBudget = 1e9;
        mitte.reputation = 99;
        if (BoardEngine.bestimmeZiel(state, mitte).platz >= normal) throw new Error("Etat und Ansehen ändern das Ziel nicht");

        // Unterhalb der Bundesliga heißt das Ziel des Favoriten Aufstieg
        const zweite = state.clubs.filter(c => c.level === 2 && c.leagueId === "de_liga_2");
        zweite.sort((a, b) => ContractEngine.vereinsNiveau(b, nach) - ContractEngine.vereinsNiveau(a, nach));
        state.players.filter(p => p.clubId === zweite[0].id).forEach(p => { p.overall += 20; });
        zweite[0].wageBudget = 1e9;
        zweite[0].reputation = 99;
        const favorit = BoardEngine.bestimmeZiel(state, zweite[0]);
        if (favorit.art !== "promotion" || favorit.platz !== 1) throw new Error(`Zweitligafavorit: ${favorit.art} / Platz ${favorit.platz}`);

        // Das Vertrauen misst am Zielplatz (ohne Bonus für ein dickes Konto)
        bayern.vorstandsziel.platz = 5;
        bayern.balance = 1000000;
        const tabelle = (platz) => {
            state.standings = state.standings.filter(s => s.clubId !== "muc");
            state.standings.splice(platz - 1, 0, { clubId: "muc" });
        };
        tabelle(5);
        SeasonEngine.updateBoardConfidence(state);
        if (state.boardConfidence !== 75) throw new Error(`Auf dem Zielplatz ${state.boardConfidence} % statt 75 %`);
        tabelle(7);
        SeasonEngine.updateBoardConfidence(state);
        if (state.boardConfidence !== 65) throw new Error(`Zwei Plätze hinter dem Ziel ${state.boardConfidence} % statt 65 %`);
        if (BoardEngine.evaluateSeasonEnd(state).achieved) throw new Error("Platz 7 gilt bei Ziel 5 als erreicht");
        tabelle(4);
        if (!BoardEngine.evaluateSeasonEnd(state).achieved) throw new Error("Platz 4 gilt bei Ziel 5 nicht als erreicht");

        // Ältere Spielstände ohne berechnetes Ziel rechnen in der eigenen Liga
        delete bayern.vorstandsziel;
        bayern.boardExpectation = "avoid_relegation";
        if (BoardEngine.zielPlatz(state, bayern) !== 16) throw new Error(`Klassenerhalt heißt Platz ${BoardEngine.zielPlatz(state, bayern)}`);
        bayern.boardExpectation = "midfield";
        if (BoardEngine.zielPlatz(state, bayern) !== 9) throw new Error("Mittelfeld richtet sich nicht nach der Ligagröße");
    });

    test("Nachwuchs: Probetrainings unter dem Jahr, Sichtungstag auf Wunsch, begrenzte Plätze und mit 19 ist Schluss", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        const talente = () => YouthEngine.eigeneTalente(state).filter(t => !t.promoted);
        const vorher = talente().length;

        // Probetraining: selten, aber übers Jahr mehrmals
        if (YouthEngine.pruefeProbetraining(state, () => 0.999) !== null) throw new Error("Probetraining ohne Glück");
        const zeile = YouthEngine.pruefeProbetraining(state, () => 0);
        const probe = talente().find(t => t.quelle === "probetraining");
        if (!zeile || !probe || talente().length !== vorher + 1) throw new Error("Kein Talent aus dem Probetraining");
        if (!/Probetraining/.test(state.inbox[0].subject) || state.inbox[0].type !== "youth") throw new Error("Keine Nachricht vom Probetraining");
        const chance = YouthEngine.probetrainingChance(state, club);
        const jeSaison = chance * 250;
        if (jeSaison < 2 || jeSaison > 6) throw new Error(`Probetrainings je Saison: ${jeSaison.toFixed(1)}`);
        club.akademieSchwerpunkte = Object.assign({}, club.akademieSchwerpunkte, { einzug: "international" });
        if (YouthEngine.probetrainingChance(state, club) <= chance) throw new Error("Ein weltweites Sichtungsnetz bringt nicht mehr Probetrainings");

        // Sichtungstag: kostet, bringt ein bis zwei, dann sechs Wochen Pause
        club.balance = 10000000;
        const lage = YouthEngine.sichtungsLage(state);
        const sichtung = YouthEngine.sichtungstag(state, () => 0);
        if (!sichtung.success || sichtung.neu.length !== 2 || club.balance !== 10000000 - lage.kosten) throw new Error("Sichtungstag ohne Talente oder Kosten");
        if (!sichtung.neu.every(t => t.quelle === "sichtung" && talente().includes(t))) throw new Error("Die gesichteten Talente fehlen in der Akademie");
        const gleichNochmal = YouthEngine.sichtungstag(state, () => 0);
        if (gleichNochmal.success || !/in 42 Tagen/.test(gleichNochmal.error)) throw new Error("Zwei Sichtungstage hintereinander");
        state.currentDayIndex = (state.currentDayIndex || 0) + 42;
        if (YouthEngine.sichtungsLage(state).warten !== 0) throw new Error("Nach sechs Wochen geht kein neuer Sichtungstag");

        // Die Akademie ist begrenzt
        const { plaetze } = YouthEngine.akademiePlaetze(state, club);
        while (talente().length < plaetze) YouthEngine.generateProspects(state, club.id, { anzahl: 1, ohneKosten: true });
        if (YouthEngine.pruefeProbetraining(state, () => 0) !== null) throw new Error("Probetraining trotz voller Akademie");
        if (YouthEngine.sichtungstag(state, () => 0).success) throw new Error("Sichtungstag trotz voller Akademie");
        const frei = YouthEngine.talentFreigeben(state, probe.id);
        if (!frei.success || talente().includes(probe) || YouthEngine.akademiePlaetze(state, club).frei !== 1) throw new Error(`Freigeben macht keinen Platz (${JSON.stringify(frei.error)}, ${talente().includes(probe)}, ${JSON.stringify(YouthEngine.akademiePlaetze(state, club))})`);

        // Zum Saisonwechsel älter - mit 19 ist ohne Vertrag Schluss
        const [alt, jung] = talente();
        alt.age = 18;
        jung.age = 16;
        const gehen = YouthEngine.alterTalente(state);
        if (gehen.length !== 1 || gehen[0] !== alt || talente().includes(alt)) throw new Error("Der 19-Jährige bleibt in der Akademie");
        if (jung.age !== 17 || !talente().includes(jung)) throw new Error("Das junge Talent altert nicht oder geht");
        if (!/verlässt die Akademie/.test(state.inbox[0].subject)) throw new Error("Keine Nachricht über den Abgang");
    });

    test("Entwicklungsbericht: Zum Monatswechsel meldet der Co-Trainer, wer besser und wer schlechter wurde", () => {
        const { DevelopmentPlanEngine } = require('./js/engine/developmentPlanEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const kader = state.players.filter(p => p.clubId === "muc");
        const [aufsteiger, verletzter, ruhig] = kader;

        // Der erste Tag setzt nur den Stichtag
        if (DevelopmentPlanEngine.pruefeMonatsbericht(state, "01.08.2026") !== null) throw new Error("Bericht ohne Vormonat");
        if (DevelopmentPlanEngine.pruefeMonatsbericht(state, "20.08.2026") !== null) throw new Error("Bericht mitten im Monat");

        aufsteiger.overall += 2;
        aufsteiger.passing += 3;
        verletzter.overall -= 1;
        verletzter.injuredWeeks = 2;
        const talent = YouthEngine.eigeneTalente(state).find(t => !t.promoted);
        if (talent) talent.overall += 1;

        const zeile = DevelopmentPlanEngine.pruefeMonatsbericht(state, "01.09.2026");
        if (!zeile || !/1 besser, 1 schlechter/.test(zeile)) throw new Error("Falsche Tageszeile: " + zeile);
        const brief = state.inbox[0];
        if (brief.type !== "development" || !/August 2026/.test(brief.subject)) throw new Error("Kein Bericht über den August im Postfach");
        const b = brief.entwicklung;
        if (b.besser.length !== 1 || b.besser[0].id !== aufsteiger.id || b.besser[0].diff !== 2) throw new Error("Der Aufsteiger fehlt oder stimmt nicht");
        if (!b.besser[0].werte.some(w => w.key === "passing" && w.diff === 3)) throw new Error("Die gewachsenen Werte fehlen");
        if (b.schlechter.length !== 1 || b.schlechter[0].id !== verletzter.id || b.schlechter[0].grund !== "verletzt") throw new Error("Der Verletzte fehlt oder ohne Grund");
        if (b.gleich !== kader.length - 2 || b.besser.concat(b.schlechter).some(e => e.id === ruhig.id)) throw new Error("Wer gleich bleibt, wird nicht gezählt");
        if (talent && !b.jugend.some(t => t.id === talent.id && t.diff === 1)) throw new Error("Das Akademietalent fehlt");
        if (!brief.body.includes(aufsteiger.name) || !brief.body.includes("Nachgelassen")) throw new Error("Der Text des Berichts ist unvollständig");
        if (state.entwicklungsStand.monat !== "09.2026" || state.entwicklungsStand.werte[aufsteiger.id].o !== aufsteiger.overall) {
            throw new Error("Der neue Stichtag steht nicht");
        }

        // Im Kalender: genau ein Bericht je Monatswechsel
        const lauf = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        for (let i = 0; i < 40; i++) CalendarEngine.advanceOneDay(lauf);
        const berichte = lauf.inbox.filter(m => m.type === "development");
        if (berichte.length !== 1 || !/August/.test(berichte[0].subject)) throw new Error(`${berichte.length} Berichte nach 40 Tagen statt einem über den August`);
    });

    test("Sommerpause: Drei Wochen zum Verlängern, wer wartet, verliert Spieler an andere - dann der Saisonwechsel", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        const kader = state.players.filter(p => p.clubId === "muc" && !p.leihe)
            .sort((a, b) => b.overall - a.overall);
        const [bleibt, umworben, schwach] = [kader[0], kader[1], kader[kader.length - 1]];
        kader.forEach(p => { p.contractYears = 3; });
        [bleibt, umworben, schwach].forEach(p => { p.contractYears = 1; });
        // Beide im Alter, in dem man oft aufhört - wer unterschreibt, bleibt aber
        bleibt.age = 35;
        umworben.age = 35;
        const niveau = ContractEngine.vereinsNiveau(club, new Map(state.players.map(p => [p.id, p])));
        schwach.overall = Math.round(niveau) - 12;

        const saison = state.seasonYear;
        SeasonEngine.finishSeason(state);

        // Die Pause hängt am Kalender, ihr letzter Tag ist der Saisonwechsel
        const pause = state.calendar.filter(d => d.sommerpause);
        if (pause.length !== SeasonEngine.SOMMERPAUSE.tage || !pause[pause.length - 1].saisonwechsel) {
            throw new Error(`${pause.length} Tage Sommerpause, letzter Tag ohne Saisonwechsel`);
        }
        if (SeasonEngine.finishSeason(state) && state.calendar.filter(d => d.sommerpause).length !== pause.length) {
            throw new Error("Ein zweiter Abschluss hängt die Pause doppelt an");
        }
        const brief = state.inbox.find(m => /Sommerpause: 3 Verträge enden/.test(m.subject));
        if (!brief || !brief.body.includes(umworben.name)) throw new Error("Keine Nachricht über die Verträge, die zum Wechsel enden");
        const zumWechsel = SeasonEngine.auslaufendZumWechsel(state).map(p => p.id).sort();
        if (zumWechsel.join() !== [bleibt, umworben, schwach].map(p => p.id).sort().join()) {
            throw new Error("Falsche Spieler gelten als auslaufend zum Wechsel");
        }

        // Der Abschluss ist schon gelaufen: Weiter führt nicht mehr zu ihm,
        // sondern durch die Pause zum Saisonwechsel
        state.currentDayIndex = state.calendar.findIndex(d => d.type === "season_end");
        if (CalendarEngine.naechsterHalt(state)?.grund !== "season_change") throw new Error("Weiter führt noch einmal zum Saisonabschluss");

        // Ab in die Pause - der Weiter-Knopf kennt sein Ziel
        state.currentDayIndex = state.calendar.indexOf(pause[0]);
        const halt = CalendarEngine.naechsterHalt(state);
        if (!halt || halt.grund !== "season_change") throw new Error("In der Pause führt Weiter nicht zum Saisonwechsel");
        if (CalendarEngine.sommerpauseRest(state) !== pause.length - 1) throw new Error("Falsche Resttage der Pause");
        const schreibtisch = ManagerEngine.getAttentionItems(state).find(i => /zum Saisonwechsel/.test(i.title));
        if (!schreibtisch || schreibtisch.priority !== 0 || schreibtisch.spieler.length !== 3) {
            throw new Error("Der Schreibtisch zeigt die zum Wechsel endenden Verträge nicht oben");
        }

        // Verlängern geht in der Pause
        club.wageBudget = Math.max(club.wageBudget || 0, 1e9);
        const forderung = ContractEngine.getExtensionDemand(bleibt, club, state).demandWage;
        const ja = ContractEngine.negotiateExtension(bleibt, club, forderung, 3, "Stammspieler", 0, state);
        if (!ja.success || bleibt.contractYears !== 3) throw new Error("In der Sommerpause lässt sich nicht verlängern: " + ja.reason);

        // Wer wartet, den holt sich ein anderer - aber nur, wer für den Kader zählt
        SeasonEngine.sommerpauseTag(state, () => 0);
        if (!umworben.vorvertrag) throw new Error("Niemand wirbt um den zweitbesten Spieler");
        if (schwach.vorvertrag) throw new Error("Um einen Ergänzungsspieler wird geworben");
        if (bleibt.vorvertrag) throw new Error("Um einen verlängerten Spieler wird geworben");
        const ziel = umworben.vorvertrag.clubId;
        const zuSpaet = ContractEngine.negotiateExtension(umworben, club, 1e7, 3, "Stammspieler", 0, state);
        if (zuSpaet.success || !/unterschrieben/.test(zuSpaet.reason)) throw new Error("Nach dem Vorvertrag lässt er noch verlängern");
        if (ManagerEngine.getAttentionItems(state).find(i => /zum Saisonwechsel/.test(i.title)).spieler.some(sp => sp.id === umworben.id)) {
            throw new Error("Wer schon unterschrieben hat, steht noch zum Verlängern auf dem Schreibtisch");
        }

        // Ohne Spiel und ohne Training: Die Pause schont, sie belastet nicht
        bleibt.fitness = 80;
        let res = null;
        for (let i = 0; i < pause.length + 2 && (!res || res.type !== "season_change"); i++) {
            res = CalendarEngine.advanceOneDay(state);
            if (i === 0 && bleibt.fitness <= 80) throw new Error("In der Pause erholt sich niemand");
        }
        if (!res || res.type !== "season_change" || state.seasonYear !== saison + 1) throw new Error("Nach der Pause beginnt keine neue Saison");
        if (state.calendar.some(d => d.sommerpause) || !state.preseason?.aktiv) throw new Error("Neue Saison ohne frischen Kalender und Vorbereitung");
        if (club.vorstandsziel?.saison !== saison + 1) throw new Error("Zur neuen Saison setzt der Vorstand kein neues Ziel");
        if (!state.inbox.some(m => m.type === "welcome" && /Unser Saisonziel/.test(m.body))) throw new Error("Die Post zum Saisonstart nennt das Ziel nicht");

        if (bleibt.clubId !== "muc" || bleibt.contractYears !== 3 || !state.players.includes(bleibt)) {
            throw new Error(`Der verlängerte Spieler ist weg, hört auf oder verliert ein Jahr (${bleibt.clubId}, ${bleibt.contractYears} J., im Spiel: ${state.players.includes(bleibt)}, ${bleibt.verlaengertSaison}/${state.seasonYear})`);
        }
        if (umworben.clubId !== ziel || umworben.vorvertrag || !state.players.includes(umworben)) {
            throw new Error(`Der umworbene Spieler (${umworben.age} J.) ist nicht bei seinem neuen Verein`);
        }
        // Wer aufgehört hat, ist aus dem Spiel - sein clubId steht dann noch auf dem alten Verein
        if (state.players.includes(schwach) && schwach.clubId === "muc") throw new Error("Der nicht verlängerte Spieler bleibt");
    });

    test("Vertrag: Die Forderung passt zur Liga - in der Landesliga kein Bundesligagehalt", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const unten = Math.max(...state.clubs.map(c => c.level || 1));
        const club = state.clubs.find(c => (c.level || 1) === unten);
        const kader = state.players.filter(p => p.clubId === club.id);
        const spieler = kader[0];
        const markt = PlayerGenerator.getValueAndWage(spieler.overall, unten, spieler.age).wage;

        // Ein Spieler mit 120 € in der Woche fordert keine 10.000 €
        spieler.wage = 120;
        const forderung = ContractEngine.getExtensionDemand(spieler, club, state).demandWage;
        if (forderung <= 120 || forderung > Math.max(1000, markt * 2)) {
            throw new Error(`Forderung ${forderung} € bei 120 € Gehalt (Marktgehalt der Liga ${markt} €)`);
        }

        // Wer normal verdient, will eine Erhöhung, keine Verzehnfachung - ein
        // unterbezahlter Spieler höchstens bis in die Nähe seines Marktgehalts
        // Wer lange und gern im Verein ist, gibt zusätzlich etwas nach (ROLLE.treue):
        // ein treuer, überbezahlter 33-Jähriger landet so bei 0,9 x 0,93 seines Gehalts
        const pruefe = (p, c) => {
            const f = ContractEngine.getExtensionDemand(p, c, state).demandWage;
            const wert = PlayerGenerator.getValueAndWage(p.overall, c.level || 1, p.age).wage;
            const nachlass = ContractEngine.istTreu(p, state) ? ContractEngine.ROLLE.treue : 1;
            if (f < p.wage * 0.85 * nachlass || f > Math.max(p.wage, wert) * 1.6) {
                throw new Error(`${p.name}: ${p.wage} € -> ${f} € (Marktgehalt ${wert} €)`);
            }
        };
        kader.slice(1).forEach(p => pruefe(p, club));

        // In der Bundesliga bleibt es beim Profigehalt
        const bayern = state.clubs.find(c => c.id === "muc");
        state.players.filter(p => p.clubId === "muc").forEach(p => pruefe(p, bayern));

        // Die Stellung zählt im eigenen Kader: Der Beste ist Schlüsselspieler,
        // auch wenn er in der Landesliga nur 40 hat
        const bester = kader.slice().sort((a, b) => b.overall - a.overall)[0];
        bester.overall += 6;
        if (ContractEngine.getExtensionDemand(bester, club, state).preferredRole !== "Schlüsselspieler") {
            throw new Error("Der Beste im Landesligakader gilt nicht als Schlüsselspieler");
        }

        // Wer die Forderung für die angebotene Rolle bietet, bekommt den Vertrag
        club.wageBudget = Math.max(club.wageBudget || 0, 100000);
        const forderungStamm = ContractEngine.getExtensionDemand(spieler, club, state, "Stammspieler").demandWage;
        const res = ContractEngine.negotiateExtension(spieler, club, forderungStamm, 3, "Stammspieler", 0, state);
        if (!res.success || spieler.wage !== forderungStamm) throw new Error("Verlängerung zur Forderung scheitert: " + res.reason);

        // Die Schrittweite folgt dem Betrag
        const schritte = [[150, 10], [2500, 100], [25000, 1000], [2500000, 100000]];
        schritte.forEach(([b, s]) => {
            if (ContractEngine.schrittFuer(b) !== s) throw new Error(`Schritt für ${b}: ${ContractEngine.schrittFuer(b)} statt ${s}`);
        });
        if (ContractEngine.eingabeSchritt(450) !== 10 || ContractEngine.eingabeSchritt(120000) !== 1000) {
            throw new Error("Die Eingabefelder gehen nicht in passenden Schritten");
        }
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
    test("SaveService & MigrationService: Export, Import und Schema-Migration von v1 auf die aktuelle Version", () => {
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
        const aktuell = MigrationService.CURRENT_SAVE_VERSION;
        if (!migRes.success || migRes.saveVersion !== aktuell || migRes.state.schemaVersion !== aktuell || !migRes.state.scouting || !migRes.state.calendar || !migRes.state.competitions || !migRes.state.customFormations) {
            throw new Error(`MigrationService failed to migrate to version ${aktuell}`);
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
        // Über 36 Welten gemessen liegt die Quote im Mittel bei 88 %, je nach
        // Kader zwischen 80 und 96 % - mit 93 als Grenze schlug der Test schon
        // fehl, wenn nur der Zufall die Kader anders würfelte.
        if (quote < 66 || quote > 95) {
            throw new Error(`Der klar bessere Kader gewinnt ${quote.toFixed(0)} % der Heimspiele (erwartet 66-95 %)`);
        }
        const schnitt = tore / partien;
        if (schnitt < 2.4 || schnitt > 4.2) {
            throw new Error(`${schnitt.toFixed(2)} Tore pro Spiel in diesen Partien (erwartet 2.4-4.2)`);
        }
    });

    test("MatchEngine: Jeder Formationsplatz zählt zu seinem Mannschaftsteil (ZDM, LZM, RAV ...)", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        const vorher = { formation: club.formation, tactics: club.tactics, chemistry: club.chemistry };
        const teil = (pos) => {
            const g = PositionEngine.normalizePosition(pos) || pos;
            if (g === "TW") return "tw";
            if (["IV", "LV", "RV"].includes(g)) return "def";
            if (["DM", "ZM", "OM", "LM", "RM"].includes(g)) return "mid";
            return "att";
        };
        const schnitt = (werte) => werte.reduce((a, b) => a + b, 0) / werte.length;
        let feineNamen = 0;
        try {
            // Ohne Taktik und Chemie: Die Mannschaftsteile sind genau der
            // Schnitt der Spieler auf den Plätzen dieses Teils
            club.tactics = {};
            club.chemistry = null;
            Object.keys(FORMATION_CONFIGS).forEach(key => {
                club.formation = key;
                const slots = MatchEngine.getFormationSlots(club);
                const elf = MatchEngine.getCleanLineup(club, state.players);
                const pw = MatchEngine.calculateTeamPower(club, state.players, false, elf);
                const je = { def: [], mid: [], att: [] };
                elf.forEach((p, i) => {
                    const pos = slots[i]?.pos || p.pos;
                    if (PositionEngine.normalizePosition(pos) !== pos) feineNamen++;
                    const t = teil(pos);
                    if (je[t]) je[t].push(MatchEngine.calculateEffectivePlayerSkill(p, pos));
                });
                [["def", pw.defense], ["mid", pw.midfield], ["att", pw.attack]].forEach(([t, wert]) => {
                    if (!je[t].length) return;
                    const soll = schnitt(je[t]);
                    if (Math.abs(wert - soll) > 0.01) {
                        throw new Error(`${key}: ${t} ${wert.toFixed(1)} statt ${soll.toFixed(1)} - ein Platz zählt zum falschen Mannschaftsteil`);
                    }
                });
            });
        } finally {
            Object.assign(club, vorher);
        }
        if (feineNamen < 20) throw new Error("Die Formationen nutzen kaum feine Platznamen - der Test prüft nichts");
    });

    test("MatchEngine: Taktik verschiebt Stärke zwischen den Mannschaftsteilen, schafft aber keine", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "dor");
        const vorher = { tactics: club.tactics, chemistry: club.chemistry };
        const staerke = (tactics) => {
            club.tactics = tactics;
            return MatchEngine.calculateTeamPower(club, state.players, false);
        };
        try {
            club.chemistry = null;
            const grund = staerke({});
            // Vorher machte Gegenpressing eine Mannschaft um fünf bis sechs
            // Prozent stärker - fast halb so viel, wie zwischen dem besten und
            // dem schwächsten Bundesligakader liegt
            Object.keys(TacticsEngine.VORLAGEN).forEach(key => {
                const pw = staerke(TacticsEngine.wendeVorlageAn({}, key));
                if (Math.abs(pw.total / grund.total - 1) > 0.001) {
                    throw new Error(`Vorlage ${key}: Gesamtstärke ${pw.total.toFixed(2)} statt ${grund.total.toFixed(2)}`);
                }
            });
            // Die Ausrichtung wirkt trotzdem: mehr Angriff, weniger Abwehr
            const offensiv = staerke({ mentality: "very_offensive" });
            const defensiv = staerke({ mentality: "very_defensive" });
            if (!(offensiv.attack > defensiv.attack * 1.2 && offensiv.defense < defensiv.defense * 0.85)) {
                throw new Error(`Die Mentalität verschiebt nichts (Angriff ${offensiv.attack.toFixed(1)}/${defensiv.attack.toFixed(1)}, Abwehr ${offensiv.defense.toFixed(1)}/${defensiv.defense.toFixed(1)})`);
            }
        } finally {
            Object.assign(club, vorher);
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
        const mitBall = [];
        const ohneBall = [];
        // Dieselbe Messzeit, verteilt auf acht Spiele mit wechselndem
        // Heimrecht: Ein einzelnes Spiel streute gemessen zwischen 3,5 und
        // 8,7 Einheiten Unterschied. Vier zusammen lagen über zwanzig Seeds
        // zwischen 2,9 und 7,7 - der Ausreißer nach unten riss die Schwelle,
        // ohne dass sich an der Form etwas geändert hatte. Acht zusammen
        // lagen über zehn Seeds zwischen 3,7 und 6,8.
        const SPIELE = 8;
        for (let k = 0; k < SPIELE; k++) {
            const heimId = k % 2 ? "dor" : "muc";
            const gastId = k % 2 ? "muc" : "dor";
            const match = { id: "form" + k, played: false, homeClubId: heimId, awayClubId: gastId };
            const live = new LiveMatch(match, state.clubs.find(c => c.id === heimId),
                state.clubs.find(c => c.id === gastId), state.players);
            // Tempo 1: Dort laeuft der groesste Teil der Uebertragung als normales
            // Spiel, und genau dort schaut man sich die Mannschaftsform an.
            live.speed = 1;
            const dir = live.director;

            let frames = 0;
            // Eine Mannschaft braucht einen Moment, um ihre Form einzunehmen.
            // Gemessen wird deshalb erst, wenn der Ballbesitz kurz stabil ist -
            // so, wie man es auch mit dem Auge beurteilen wuerde.
            let besitzer = null;
            let stabilSeit = 0;

            while (!live.isFinished && frames < 60 * 1800 / SPIELE) {
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

        // Der Schnitt aus 500 Spielen schwankt um etwa ±0,08 (Streuung je
        // Spiel rund 1,8 Tore). Bei einem Mittel um 3,3 schlug die alte
        // Obergrenze 3,4 je nach Startwert zufällig an - 3,5 lässt gut zwei
        // Standardabweichungen Luft und fängt trotzdem jede echte Torflut.
        if (avgGoals < 2.2 || avgGoals > 3.5) {
            throw new Error(`Tore/Spiel außerhalb des Bereichs [2.2, 3.5]: ${avgGoals.toFixed(2)}`);
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
            // Ein ausgewechselter (etwa verletzter) Torwart geht zur Bank an
            // der Mittellinie - gemessen wird nur, wer im Tor steht
            if (live.players2D.includes(homeGk)) maxHomeGkX = Math.max(maxHomeGkX, homeGk.x);
            if (live.players2D.includes(awayGk)) minAwayGkX = Math.min(minAwayGkX, awayGk.x);
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
    test("Ligen: England, Spanien, Italien und Frankreich mit zweiter und dritter Liga, Auf- und Abstieg und Nachrüstung alter Spielstände", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });

        // Drei Stufen je Land, echte Vereine, stimmige Verweise
        ["en", "es", "it", "fr"].forEach(land => {
            [1, 2, 3].forEach(stufe => {
                const liga = LEAGUES_DATA.find(l => l.countryId === land && l.level === stufe);
                if (!liga) throw new Error(`${land}: Stufe ${stufe} fehlt`);
                const vereine = state.clubs.filter(c => c.leagueId === liga.id);
                const echt = new Set((REAL_CLUBS_BY_LEAGUE[liga.id] || []).map(c => c.name));
                if (vereine.length !== liga.teamCount || !vereine.every(c => echt.has(c.name))) {
                    throw new Error(`${liga.shortName}: ${vereine.length} Vereine, nicht alle echt`);
                }
                if (stufe > 1 && LEAGUES_DATA.find(l => l.id === liga.promotionTo)?.level !== stufe - 1) throw new Error(`${liga.shortName} steigt nicht eine Stufe auf`);
                if (stufe < 3 && !(liga.relegationTo || []).every(id => LEAGUES_DATA.some(l => l.id === id))) throw new Error(`${liga.shortName} steigt in eine Liga ab, die es nicht gibt`);
            });
        });
        const niveau = new Map(state.players.map(p => [p.id, p]));
        const schnitt = id => {
            const v = state.clubs.filter(c => c.leagueId === id);
            return v.reduce((s, c) => s + ContractEngine.vereinsNiveau(c, niveau), 0) / v.length;
        };
        if (!(schnitt("en_liga_1") > schnitt("en_liga_2") + 5 && schnitt("en_liga_2") > schnitt("en_liga_3") + 5)) {
            throw new Error("Die englischen Ligen sind nicht nach Stärke gestaffelt");
        }

        // Auf- und Abstieg: Die drei Letzten der Premier League tauschen mit den
        // ersten beiden der Championship und dem Sieger ihrer Playoffs
        const { PlayoffEngine } = require('./js/engine/playoffEngine.js');
        const tabelle = id => state.clubs.filter(c => c.leagueId === id).map(c => ({ clubId: c.id }));
        ["en_liga_1", "en_liga_2", "en_liga_3"].forEach(id => { state.standingsByLeague[id] = tabelle(id); });
        PlayoffEngine.abschliessen(state);
        const sieger = id => state.playoffs.wettbewerbe.find(w => w.ligaId === id).ergebnis.aufsteiger;
        const ab = state.standingsByLeague.en_liga_1.slice(-3).map(e => e.clubId);
        const auf = state.standingsByLeague.en_liga_2.slice(0, 2).map(e => e.clubId).concat(sieger("en_liga_2"));
        const aufAus3 = state.standingsByLeague.en_liga_3.slice(0, 2).map(e => e.clubId).concat(sieger("en_liga_3"));
        if (state.standingsByLeague.en_liga_2.slice(2, 6).every(e => e.clubId !== sieger("en_liga_2"))) throw new Error("Der Playoff-Sieger kommt nicht von Platz 3 bis 6");
        CompetitionEngine.processSeasonEndPromotionsRelegations(state);
        const ligaVon = id => state.clubs.find(c => c.id === id).leagueId;
        if (!ab.every(id => ["en_liga_2", "en_liga_3"].includes(ligaVon(id))) || !auf.every(id => ligaVon(id) === "en_liga_1")) {
            throw new Error("Zwischen Premier League und Championship wird nicht getauscht");
        }
        if (!aufAus3.every(id => ligaVon(id) === "en_liga_2")) throw new Error("Aus der League One steigt niemand auf");
        if (["en_liga_1", "en_liga_2", "en_liga_3"].some(id => state.clubs.filter(c => c.leagueId === id).length !== LEAGUES_DATA.find(l => l.id === id).teamCount)) {
            throw new Error("Nach Auf- und Abstieg stimmen die Ligagrößen nicht");
        }

        // Ein Spielstand ohne die neuen Ligen bekommt sie beim Laden
        const alt = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const neu = new Set(WorldGenerator.NACHTRAEGLICHE_LIGEN);
        const raus = new Set(alt.clubs.filter(c => neu.has(c.leagueId)).flatMap(c => c.playerIds));
        alt.clubs = alt.clubs.filter(c => !neu.has(c.leagueId));
        alt.players = alt.players.filter(p => !raus.has(p.id));
        alt.leagues = alt.leagues.filter(l => !neu.has(l.id));
        neu.forEach(id => { delete alt.otherSchedules[id]; delete alt.standingsByLeague[id]; });
        const ergebnis = MigrationService.migrateSave({ saveVersion: 8, state: alt });
        const migriert = ergebnis.state;
        WorldGenerator.NACHTRAEGLICHE_LIGEN.forEach(id => {
            const liga = LEAGUES_DATA.find(l => l.id === id);
            if (migriert.clubs.filter(c => c.leagueId === id).length !== liga.teamCount) throw new Error(`${id} fehlt nach dem Laden`);
            if (!migriert.leagues.some(l => l.id === id) || !(migriert.otherSchedules[id] || []).length) throw new Error(`${id} ohne Ligadaten oder Spielplan`);
        });
        if (!/Die Spielwelt wächst/.test(migriert.inbox[0].subject)) throw new Error("Keine Nachricht über die neuen Ligen");
        if (WorldGenerator.ergaenzeNeueLigen(migriert).length) throw new Error("Ein zweites Laden legt die Ligen doppelt an");
    });

    test("WorldGenerator: alle zwanzig Ligen gefüllt, Stärke nach Ligastufe gestaffelt", () => {
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

        // Gespeichert wird in IndexedDB; der LocalStorage ist der Notfallweg
        // und fasst in den gängigen Browsern rund fünf Millionen Zeichen. Mit
        // 384 Vereinen und gut 8300 Spielern liegt ein frischer Stand bei
        // rund 3,5 MB - 4 MB lassen Luft für das, was eine Saison anhäuft.
        if (encodedSize > 4 * 1024 * 1024) {
            throw new Error(`Kodierter Spielstand ist mit ${(encodedSize / 1048576).toFixed(2)} MB zu groß für den LocalStorage`);
        }
        if (!(encodedSize < rawSize * 0.45)) {
            throw new Error(`Kodierung spart zu wenig: ${(encodedSize / rawSize * 100).toFixed(0)} % der Rohgröße`);
        }

        const decoded = SaveCodec.decodeState(JSON.parse(JSON.stringify(encoded)));

        // Die Taktiken stehen gepackt im Stand (je Spielstil eine Vorlage) und
        // kommen exakt zurück - Werte, fehlende Anweisungen und Reihenfolge
        if (!encoded.__taktikVorlagen || !encoded.clubs.every(c => !c.tactics || c.tactics["~t"] === 1)) throw new Error("Taktiken werden nicht gepackt");
        state.clubs.forEach((c, i) => {
            if (JSON.stringify(c.tactics) !== JSON.stringify(decoded.clubs[i].tactics)) throw new Error(`Taktik von ${c.name} kommt verändert zurück`);
        });
        const sonder = JSON.parse(JSON.stringify(state));
        const [a, b] = sonder.clubs;
        delete a.tactics.pressing;
        a.tactics.eigeneAnweisung = { x: 1 };
        b.tactics = Object.fromEntries(Object.entries(b.tactics).reverse());
        const zurueck = SaveCodec.decodeState(JSON.parse(JSON.stringify(SaveCodec.encodeState(sonder))));
        [a, b].forEach((c, i) => {
            if (JSON.stringify(c.tactics) !== JSON.stringify(zurueck.clubs[i].tactics)) throw new Error("Sonderfälle der Taktik gehen verloren");
        });

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

    test("SaveCodec fmc2: neue Spielerfelder mit festem Platz, fremde Partien ohne Schiedsrichter, alte Spielstände lesbar", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        for (let i = 0; i < 2; i++) SeasonEngine.advanceToNextMatchday(state);
        const mitEigenheit = state.players.find(p => Array.isArray(p.traits) && p.traits.length);
        mitEigenheit.spielpraxis = 0.123456789;
        mitEigenheit.leihe = { stammvereinId: "x", leihvereinId: "y", lohnAnteil: 0.5 };

        // Fremde Partien: Schiedsrichter und Ticketdetails fallen weg, die
        // Zuschauer bleiben - der Schiedsrichter lässt sich neu bestimmen
        const fremd = Object.values(state.otherSchedules)[0].flatMap(r => r.matches).find(m => m.played);
        if (fremd.schiedsrichter || fremd.ticketIncome !== undefined) throw new Error("Fremde Partie behält Schiedsrichter oder Ticketdetails");
        if (!(fremd.attendance > 0)) throw new Error("Zuschauerzahl fehlt");
        const schiri = MatchEngine.schiedsrichterFuer(fremd);
        delete fremd.schiedsrichter;
        if (MatchEngine.schiedsrichterFuer(fremd).name !== schiri.name) throw new Error("Schiedsrichter lässt sich nicht gleich neu bestimmen");
        delete fremd.schiedsrichter;

        const enc = SaveCodec.encodeState(state);
        if (enc.__codec !== "fmc2") throw new Error(`Format ${enc.__codec}`);
        const rest = enc.players.map(r => r[SaveCodec.felder("player").length]).filter(r => r && typeof r === "object");
        if (rest.some(r => "traits" in r || "foot" in r || "spielpraxis" in r)) throw new Error("Neue Felder landen weiter im Restobjekt");
        const back = SaveCodec.decodeState(JSON.parse(JSON.stringify(enc)));
        const b = back.players.find(p => p.id === mitEigenheit.id);
        if (JSON.stringify(b.traits) !== JSON.stringify(mitEigenheit.traits) || b.foot !== mitEigenheit.foot) throw new Error("Eigenheiten oder Fuß verändern sich");
        if (b.spielpraxis !== 0.123 || b.leihe.lohnAnteil !== 0.5) throw new Error(`Spielpraxis ${b.spielpraxis}, Leihe ${JSON.stringify(b.leihe)}`);
        const ohne = back.players.find(p => !state.players.find(o => o.id === p.id).signatur);
        if ("signatur" in ohne) throw new Error("Fehlende neue Felder werden als null angelegt");
        const fb = Object.values(back.otherSchedules)[0].flatMap(r => r.matches).find(m => m.played);
        if (fb.attendance !== fremd.attendance || fb.soldOut !== !!fremd.soldOut) throw new Error("Zuschauer gehen verloren");

        // Ein Spielstand im alten Format fmc1 bleibt lesbar
        const format = SaveCodec.FORMAT;
        let alt;
        try { SaveCodec.FORMAT = "fmc1"; alt = JSON.parse(JSON.stringify(SaveCodec.encodeState(state))); }
        finally { SaveCodec.FORMAT = format; }
        if (alt.__codec !== "fmc1") throw new Error("Altes Format nicht nachgestellt");
        const altBack = SaveCodec.decodeState(alt);
        const a = altBack.players.find(p => p.id === mitEigenheit.id);
        if (JSON.stringify(a.traits) !== JSON.stringify(mitEigenheit.traits) || a.overall !== mitEigenheit.overall || a.leihe.lohnAnteil !== 0.5) {
            throw new Error("Altes Format wird falsch gelesen");
        }
        if (JSON.stringify(enc).length >= JSON.stringify(alt).length) throw new Error("fmc2 ist nicht kleiner als fmc1");
    });

    /** Attrappen für IndexedDB und LocalStorage, deren Antworten sofort da sind */
    function speicherAttrappen() {
        // Antworten, die sofort da sind - so bleibt der Test synchron
        const sofort = (wert, fehler) => ({
            __sofort: true,
            then(ok, nein) {
                try {
                    if (fehler) return nein ? weiter(nein(fehler)) : sofort(undefined, fehler);
                    return ok ? weiter(ok(wert)) : sofort(wert);
                } catch (e) { return sofort(undefined, e); }
            },
            catch(nein) { return this.then(null, nein); }
        });
        const weiter = (x) => (x && x.__sofort) ? x : sofort(x);
        const db = {
            daten: {}, kaputt: false, geloescht: [],
            verfuegbar() { return true; },
            oeffne() { return sofort(true); },
            lies(k) { return sofort(this.daten[k] ?? null); },
            schreibe(k, v) {
                if (this.kaputt) return sofort(undefined, Object.assign(new Error("voll"), { name: "QuotaExceededError" }));
                this.daten[k] = v; return sofort(true);
            },
            loesche(k) { delete this.daten[k]; this.geloescht.push(k); return sofort(true); },
            schreibeMehrere(eintraege, loeschen = []) {
                if (this.kaputt) return sofort(undefined, Object.assign(new Error("voll"), { name: "QuotaExceededError" }));
                Object.assign(this.daten, eintraege);
                loeschen.forEach(k => { delete this.daten[k]; this.geloescht.push(k); });
                return sofort(true);
            },
            schluessel() { return sofort(Object.keys(this.daten)); },
            bitteUmDauerhaftenSpeicher() { return sofort(false); }
        };
        const ls = {
            daten: {},
            getItem(k) { return k in this.daten ? this.daten[k] : null; },
            setItem(k, v) { this.daten[k] = String(v); },
            removeItem(k) { delete this.daten[k]; }
        };
        return { db, ls };
    }

    test("Speicher: IndexedDB mit Umzug aus dem LocalStorage, Ausweichen bei Fehlern, der jüngere Stand gewinnt", () => {
        const { db, ls } = speicherAttrappen();
        const PLATZ = GameState.SPEICHERPLATZ;
        const vorherLs = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
        globalThis.SpeicherDB = db;
        Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true, writable: true });
        try {
            // Ein Stand, wie ihn die Vorversion im LocalStorage hinterließ
            const alt = GameState.createNewGame("muc", "normal", { name: "Umzug" });
            alt.lastSaved = "2026-01-01T10:00:00.000Z";
            ls.setItem(PLATZ, JSON.stringify(SaveCodec.encodeState(alt)));

            let info = null;
            GameState.bereiteSpeicherVor().then(i => { info = i; });
            if (!info || info.ort !== "indexedDB" || !info.umgezogen) throw new Error("Kein Umzug gemeldet: " + JSON.stringify(info));
            if (ls.getItem(PLATZ) !== null) throw new Error("Der LocalStorage wurde nach dem Umzug nicht freigegeben");
            if (!db.daten[PLATZ]) throw new Error("Der Stand liegt nicht in IndexedDB");
            if (GameState.speicherort() !== "indexedDB") throw new Error("Speicherort nicht IndexedDB");

            const geladen = GameState.loadFromLocalStorage();
            if (!geladen || geladen.userClubId !== "muc" || geladen.managerName !== alt.managerName) throw new Error("Stand nach dem Umzug nicht ladbar");
            if (!GameState.getSaveSummary()) throw new Error("Keine Zusammenfassung aus dem Spiegel");

            // Speichern landet in IndexedDB, nicht im LocalStorage
            geladen.managerName = "Neu";
            if (!geladen.saveToLocalStorage(null, true)) throw new Error("Speichern meldet Fehler");
            if (!/"managerName":"Neu"/.test(db.daten[PLATZ]) || ls.getItem(PLATZ) !== null) throw new Error("Gespeichert wurde nicht in IndexedDB");

            // IndexedDB versagt: der LocalStorage springt ein ...
            db.kaputt = true;
            geladen.managerName = "Ausweiche";
            geladen.saveToLocalStorage(null, true);
            if (!/"managerName":"Ausweiche"/.test(ls.getItem(PLATZ) || "")) throw new Error("Kein Ausweichen in den LocalStorage");
            if (geladen._saveFehler) throw new Error("Ausweichen gilt fälschlich als Fehler: " + geladen._saveFehler);
            // ... und nach dem nächsten Start gilt der jüngere Stand
            db.kaputt = false;
            GameState._idbAktiv = false;
            GameState._spiegel = {};
            GameState.bereiteSpeicherVor();
            if (GameState.loadFromLocalStorage().managerName !== "Ausweiche") throw new Error("Der jüngere Stand aus dem LocalStorage verliert");
            if (ls.getItem(PLATZ) !== null || !/"managerName":"Ausweiche"/.test(db.daten[PLATZ])) throw new Error("Ausweichstand nicht zurück in IndexedDB");

            // Ein liegengebliebener älterer Stand im LocalStorage verdrängt nichts
            const aelter = JSON.parse(db.daten[PLATZ]);
            aelter.lastSaved = "2020-01-01T00:00:00.000Z";
            aelter.managerName = "Veraltet";
            ls.setItem(PLATZ, JSON.stringify(aelter));
            GameState._spiegel = {};
            GameState.bereiteSpeicherVor();
            if (GameState.loadFromLocalStorage().managerName !== "Ausweiche") throw new Error("Ein älterer Stand hat den neueren verdrängt");

            // Löschen räumt beide Speicher
            GameState.deleteSavegame();
            if (db.daten[PLATZ] || ls.getItem(PLATZ) !== null || GameState.loadFromLocalStorage() !== null) throw new Error("Löschen unvollständig");

            // Verdichteter Export lässt sich wieder einlesen
            const exp = geladen.exportToJson();
            const imp = GameState.importFromJson(exp);
            if (!imp.success || imp.state.players.length !== geladen.players.length || typeof imp.state.players[0].name !== "string") {
                throw new Error("Verdichteter Export nicht importierbar");
            }

            // Ohne IndexedDB bleibt alles beim LocalStorage
            db.verfuegbar = () => false;
            GameState._spiegel = {};
            let ohne = null;
            GameState.bereiteSpeicherVor().then(i => { ohne = i; });
            geladen.saveToLocalStorage(null, true);
            if (GameState.speicherort() !== "localStorage" || !ls.getItem(PLATZ)) throw new Error("Ohne IndexedDB wird nicht im LocalStorage gespeichert");
        } finally {
            delete globalThis.SpeicherDB;
            if (vorherLs) Object.defineProperty(globalThis, "localStorage", vorherLs);
            else delete globalThis.localStorage;
            GameState._idbAktiv = false;
            GameState._spiegel = {};
            GameState._verzeichnis = null;
            GameState._aktiverPlatz = null;
        }
    });

    test("Speicherplätze: Karrieren nebeneinander, eine Sicherung je Spielwoche, Wiederherstellen und Aufräumen", () => {
        const { db, ls } = speicherAttrappen();
        const vorherLs = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
        globalThis.SpeicherDB = db;
        Object.defineProperty(globalThis, "localStorage", { value: ls, configurable: true, writable: true });
        const plaetze = GameState.alleSpeicherplaetze();
        const sicherungenIn = (platz) => Object.keys(db.daten).filter(k => k.startsWith(platz + "__sicherung_"));
        try {
            if (plaetze.length !== 5 || plaetze[0] !== GameState.SPEICHERPLATZ) throw new Error("Platz 1 muss den bisherigen Schlüssel behalten");

            // Ein Stand der Vorfassung: nur Platz 1, kein Verzeichnis
            const alt = GameState.createNewGame("muc", "normal", { name: "Erste" });
            alt.lastSaved = "2026-01-01T10:00:00.000Z";
            db.daten[plaetze[0]] = JSON.stringify(SaveCodec.encodeState(alt));
            GameState.bereiteSpeicherVor();
            const verz = JSON.parse(db.daten[GameState.VERZEICHNIS] || "null");
            if (!verz || verz.plaetze[plaetze[0]]?.clubId !== "muc") throw new Error("Verzeichnis nicht aus dem vorhandenen Stand gebildet");
            if (GameState.aktiverPlatz() !== plaetze[0] || GameState.loadFromLocalStorage()?.userClubId !== "muc") throw new Error("Vorhandener Stand nicht auf Platz 1");

            // Eine zweite Karriere verdrängt die erste nicht
            const frei = GameState.freierPlatz();
            if (frei !== plaetze[1]) throw new Error(`Falscher freier Platz: ${frei}`);
            GameState.setzeAktivenPlatz(frei);
            const zweite = GameState.createNewGame("dor", "normal", { name: "Zweite" });
            zweite.saveToLocalStorage(null, true);
            if (!db.daten[plaetze[0]] || !db.daten[plaetze[1]]) throw new Error("Eine Karriere hat die andere überschrieben");
            if (GameState.speicherplaetze().filter(p => p.zusammenfassung).length !== 2) throw new Error("Verzeichnis kennt nicht beide Karrieren");

            // Neustart: weiter geht es mit der zuletzt gespielten, die andere wird erst bei Bedarf gelesen
            GameState._spiegel = {};
            GameState.bereiteSpeicherVor();
            if (GameState.aktiverPlatz() !== plaetze[1] || GameState.loadFromLocalStorage()?.userClubId !== "dor") throw new Error("Nicht mit der jüngsten Karriere gestartet");
            if (GameState._spiegel[plaetze[0]]) throw new Error("Der Spiegel hält mehr als den aktiven Stand");
            let s = null;
            GameState.ladePlatz(plaetze[0]).then(x => { s = x; });
            if (!s || s.userClubId !== "muc" || GameState.aktiverPlatz() !== plaetze[0]) throw new Error("Anderer Platz nicht ladbar");
            if (GameState._spiegel[plaetze[1]]) throw new Error("Der verlassene Platz bleibt im Spiegel");

            // Sicherungen: höchstens eine je Spielwoche, die letzten drei bleiben
            const jahr = s.seasonYear;
            [0, 3, 7, 14, 21].forEach(tag => { s.currentDayIndex = tag; s.saveToLocalStorage(null, true); });
            let liste = GameState.sicherungen();
            if (liste.map(x => x.tag).join() !== "21,14,7") throw new Error(`Falsche Sicherungen: ${liste.map(x => x.tag).join()}`);
            if (sicherungenIn(plaetze[0]).length !== 3) throw new Error("Die älteste Sicherung liegt noch in der Datenbank");
            if (sicherungenIn(plaetze[1]).length !== 1) throw new Error("Sicherungen des anderen Platzes berührt");
            s.seasonYear = jahr + 1;
            s.currentDayIndex = 2;
            s.saveToLocalStorage(null, true);
            if (GameState.sicherungen()[0].seasonYear !== jahr + 1) throw new Error("Neue Saison ohne Sicherung");

            // Wiederherstellen: Sicherung lesen, den jetzigen Stand sichern, mit der Sicherung weiterspielen
            const ziel = GameState.sicherungen()[2];
            let zurueck = null;
            GameState.ladeSicherung(ziel.schluessel).then(x => { zurueck = x; });
            if (!zurueck || zurueck.currentDayIndex !== ziel.tag) throw new Error("Sicherung nicht lesbar");
            s.legeSicherungAn();
            zurueck.saveToLocalStorage(null, true);
            if (GameState.loadFromLocalStorage().currentDayIndex !== ziel.tag) throw new Error("Wiederhergestellter Stand ist nicht der aktuelle");
            if (!GameState.sicherungen().some(x => x.seasonYear === jahr + 1)) throw new Error("Der Stand vor dem Wiederherstellen ging verloren");
            if (sicherungenIn(plaetze[0]).length !== GameState.SICHERUNGEN_JE_PLATZ) throw new Error("Mehr Sicherungen als vorgesehen");

            // Eine neue Karriere auf einem belegten Platz nimmt die alten Sicherungen nicht mit
            const dritte = GameState.createNewGame("lev", "normal", { name: "Dritte" });
            dritte.saveToLocalStorage(null, true);
            if (GameState.sicherungen().some(x => x.saveId !== dritte.saveId)) throw new Error("Fremde Sicherungen am neuen Spielstand");
            if (sicherungenIn(plaetze[0]).length !== GameState.sicherungen().length) throw new Error("Alte Sicherungen liegen noch in der Datenbank");

            // Kopie auf einen freien Platz: das Spiel bleibt auf seinem Platz, die Kopie ohne Sicherung
            let kopiert = false;
            dritte.sichereKopie(plaetze[2]).then(ok => { kopiert = ok; });
            if (!kopiert || GameState.speicherplaetze()[2].zusammenfassung?.clubId !== "lev" || GameState.aktiverPlatz() !== plaetze[0]) throw new Error("Kopie misslungen");
            if (GameState.sicherungen(plaetze[2]).length || sicherungenIn(plaetze[2]).length) throw new Error("Die Kopie legt eine überflüssige Sicherung an");

            // Löschen nimmt die Sicherungen mit
            GameState.deleteSavegame(plaetze[0]);
            if (db.daten[plaetze[0]] || sicherungenIn(plaetze[0]).length || GameState.speicherplaetze()[0].zusammenfassung) throw new Error("Löschen unvollständig");

            // Verwaiste Sicherungen räumt der nächste Start auf
            db.daten[plaetze[1] + "__sicherung_verwaist"] = "{}";
            GameState._spiegel = {};
            GameState.bereiteSpeicherVor();
            if (db.daten[plaetze[1] + "__sicherung_verwaist"]) throw new Error("Verwaiste Sicherung nicht aufgeräumt");
            if (sicherungenIn(plaetze[1]).length !== 1) throw new Error("Beim Aufräumen eine gültige Sicherung gelöscht");

            // Ohne IndexedDB: Plätze ja, Sicherungen nein
            db.verfuegbar = () => false;
            ls.daten = {};
            GameState._spiegel = {};
            GameState.bereiteSpeicherVor();
            GameState.setzeAktivenPlatz(plaetze[3]);
            zweite.saveToLocalStorage(null, true);
            if (!ls.getItem(plaetze[3]) || GameState.sicherungen().length || Object.keys(ls.daten).some(k => k.includes("__sicherung_"))) throw new Error("LocalStorage-Betrieb falsch");
            GameState._verzeichnis = null;
            GameState._aktiverPlatz = null;
            GameState.bereiteSpeicherVor();
            if (GameState.aktiverPlatz() !== plaetze[3] || GameState.getSaveSummary()?.clubId !== "dor") throw new Error("Ohne IndexedDB nach Neustart nicht auf dem richtigen Platz");
        } finally {
            delete globalThis.SpeicherDB;
            if (vorherLs) Object.defineProperty(globalThis, "localStorage", vorherLs);
            else delete globalThis.localStorage;
            GameState._idbAktiv = false;
            GameState._spiegel = {};
            GameState._verzeichnis = null;
            GameState._aktiverPlatz = null;
        }
    });

    test("Sofort-Ergebnis: dieselbe Livespiel-Simulation läuft ohne Bild in Häppchen bis zum Abpfiff", () => {
        const state = GameState.createNewGame("dor", "normal", { name: "Ohne Bild" });
        const runde = state.schedule[0];
        const partie = runde.matches.find(m => m.homeClubId === "dor" || m.awayClubId === "dor");
        const home = state.clubs.find(c => c.id === partie.homeClubId);
        const away = state.clubs.find(c => c.id === partie.awayClubId);
        const seite = partie.homeClubId === "dor" ? "home" : "away";
        const live = MatchEngine.createLiveMatch(partie, home, away, state.players, {
            modus: "fm", userSide: seite, delegation: { wechsel: false, taktik: false }
        });
        // Ein Stück live, dann auf Sofort-Ergebnis
        live.speed = 4;
        for (let i = 0; i < 800; i++) { live.advanceRealTime(16); live.updateBallAndPlayers(16); }
        const minuteVorher = live.minute;
        if (live.rechneOhneBild(0) !== false) throw new Error("Ein Häppchen von null Millisekunden hat schon abgepfiffen");
        if (!live.ohneBild || live.modus !== "fm") throw new Error("Ohne Bild wechselt die Simulation das Modell");
        if (!live.delegation.wechsel || !live.delegation.taktik) throw new Error("Der Co-Trainer übernimmt nicht");
        let haeppchen = 1;
        while (!live.rechneOhneBild(5)) {
            if (++haeppchen > 5000) throw new Error("Die Simulation kommt nicht zum Abpfiff");
        }
        if (haeppchen < 3) throw new Error("Das Spiel lief nicht in Häppchen, sondern in einem Zug");
        if (live._ohneBildSchritte > LiveMatch.OHNE_BILD_HOECHSTENS) throw new Error("Erst die Notbremse beendete das Spiel");
        if (!partie.played || live.minute < 90 || live.modus !== "fm") throw new Error(`Nicht sauber abgepfiffen (Minute ${live.minute}, Modus ${live.modus})`);
        if (!partie.analyse || !partie.analyse.heat || !partie.analyse.netz) throw new Error("Ohne Bild fehlen Heatmap und Passnetz");
        if (!Array.isArray(partie.playerRatings) || partie.playerRatings.length < 22) throw new Error("Keine Einzelkritiken");
        if (partie.homeGoals + partie.awayGoals > 12) throw new Error(`Unplausibles Ergebnis ${partie.homeGoals}:${partie.awayGoals}`);
        if (minuteVorher >= 90) throw new Error("Der Live-Teil lief schon bis zum Ende");

        // Ein ganzes Spiel ohne Bild von Anfang an, in einem Aufruf
        const zweite = state.schedule[1].matches.find(m => m.homeClubId === "dor" || m.awayClubId === "dor");
        const live2 = MatchEngine.createLiveMatch(zweite,
            state.clubs.find(c => c.id === zweite.homeClubId), state.clubs.find(c => c.id === zweite.awayClubId),
            state.players, { modus: "fm", userSide: zweite.homeClubId === "dor" ? "home" : "away" });
        if (!live2.rechneOhneBild() || !zweite.played || !zweite.analyse) throw new Error("Ein ganzes Spiel ohne Bild endet nicht sauber");
    });

    test("U23: Spieler hinunterschicken, Regeln für Alter und Kadergröße, Spielpraxis in der zweiten Mannschaft", () => {
        const { ReserveEngine } = require('./js/engine/reserveEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "U23" });
        const club = state.clubs.find(c => c.id === "muc");
        const kader = state.players.filter(p => club.playerIds.includes(p.id));
        const jung = kader.filter(p => p.age <= 23).sort((a, b) => b.overall - a.overall);
        const stamm = jung.find(p => club.lineup.includes(p.id)) || jung[0];
        if (!stamm) throw new Error("Kein junger Spieler im Kader");
        stamm.spielpraxis = 0.2;

        const r = ReserveEngine.hinunter(state, stamm.id);
        if (!r.success || !stamm.reserve) throw new Error("Hinunterschicken klappt nicht: " + r.error);
        if (club.lineup.includes(stamm.id) || club.bench.includes(stamm.id)) throw new Error("Er steht noch in Elf oder Bank");
        if (club.lineup.length !== 11) throw new Error("Die Elf ist nicht nachgerückt");
        if (GameState.einsatzfaehigeSpieler(club, state.players).some(p => p.id === stamm.id)) throw new Error("Er gilt noch als einsatzfähig für die Profis");
        if (ReserveEngine.hinunter(state, stamm.id).success) throw new Error("Doppelt hinunter geht");

        // Höchstens drei über 23
        const alt = kader.filter(p => p.age > 23 && !p.reserve).sort((a, b) => a.overall - b.overall);
        for (let i = 0; i < ReserveEngine.MAX_UEBERALTERT; i++) {
            const res = ReserveEngine.hinunter(state, alt[i].id);
            if (!res.success) throw new Error(`Älterer Spieler ${i + 1} darf nicht hinunter: ${res.error}`);
        }
        const vierter = ReserveEngine.hinunter(state, alt[ReserveEngine.MAX_UEBERALTERT].id);
        if (vierter.success || !/über/.test(vierter.error)) throw new Error("Der vierte Ältere darf hinunter");

        // Der Profikader darf nicht leerlaufen
        const rest = state.players.filter(p => club.playerIds.includes(p.id) && !p.reserve && p.age <= 23);
        let abgelehnt = null;
        const profis = () => ReserveEngine.profis(state, club).length;
        while (profis() > ReserveEngine.MIN_PROFIKADER && rest.length) ReserveEngine.hinunter(state, rest.shift().id);
        const naechster = rest.shift() || jung.find(p => !p.reserve);
        if (naechster) abgelehnt = ReserveEngine.hinunter(state, naechster.id);
        if (profis() < ReserveEngine.MIN_PROFIKADER) throw new Error("Profikader unter der Mindestgröße");
        if (abgelehnt && abgelehnt.success) throw new Error("Hinunter trotz zu kleinem Profikader");

        // Das Spiel der U23: Praxis und Bilanz
        const vorher = stamm.spielpraxis;
        const ergebnis = ReserveEngine.spieltag(state, club, () => 0.42);
        if (!ergebnis || !club.reserveBilanz || club.reserveBilanz.spiele !== 1) throw new Error("Kein U23-Spiel gespielt");
        if (!(stamm.spielpraxis > vorher)) throw new Error(`Spielpraxis wächst nicht (${vorher} -> ${stamm.spielpraxis})`);
        for (let i = 0; i < 40; i++) ReserveEngine.spieltag(state, club, () => 0.42);
        if (stamm.spielpraxis < 0.6 || stamm.spielpraxis > ReserveEngine.PRAXIS_WERT + 0.01) throw new Error(`Spielpraxis landet nicht beim U23-Wert (${stamm.spielpraxis})`);
        if (club.reserveBilanz.letzte.length > 6) throw new Error("Zu viele letzte Spiele gemerkt");

        // KI-Talente ohne Einsatz sammeln etwas Praxis, aber nie über die zweite Mannschaft hinaus
        const ki = state.clubs.find(c => c.id !== "muc" && c.playerIds.length > 20);
        const kiTalent = state.players.find(p => p.clubId === ki.id && p.age <= 21 && !ki.lineup.includes(p.id) && !ki.bench.includes(p.id));
        if (kiTalent) {
            kiTalent.spielpraxis = 0;
            kiTalent.injuredWeeks = 0;
            ReserveEngine.kiPraxis(state);
            if (!(kiTalent.spielpraxis > 0)) throw new Error("KI-Talent sammelt keine Praxis");
            for (let i = 0; i < 80; i++) ReserveEngine.kiPraxis(state);
            if (kiTalent.spielpraxis > ReserveEngine.KI_PRAXIS + 0.001) throw new Error("KI-Praxis steigt über die zweite Mannschaft");
        }

        // Zurückholen und Wechsel heben die U23 auf
        if (!ReserveEngine.hinauf(state, stamm.id).success || stamm.reserve) throw new Error("Zurückholen klappt nicht");
        const zweiter = ReserveEngine.spieler(state, club)[0];
        const kaeufer = state.clubs.find(c => c.id !== "muc");
        TransferEngine.executeTransfer(state, zweiter.id, kaeufer.id, 1000000, zweiter.wage, 3);
        if (zweiter.reserve) throw new Error("Nach dem Wechsel noch in der U23");
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
        // einnehmen, nicht die Highlight-Inszenierung. Gemessen über zwei
        // Spiele: Im Mittel sind es gut 60 %, ein einzelnes Spiel mit vielen
        // Toren und Karten lag aber auch schon knapp unter der Hälfte.
        let frames = 0;
        let ambientMs = 0;
        [live, new LiveMatch({ id: "tempo2", played: false, homeClubId: "muc", awayClubId: "dor" }, homeClub, awayClub, state.players)].forEach(spiel => {
            spiel.speed = 1;
            let bilder = 0;
            while (!spiel.isFinished && bilder < 60 * 1500) {
                spiel.advanceRealTime(1000 / 60);
                spiel.updateBallAndPlayers(1000 / 60);
                if (spiel.director.mode === "ambient") ambientMs += 1000 / 60;
                bilder++;
            }
            if (!spiel.isFinished) throw new Error("Livespiel wurde im Tempotest nicht beendet");
            frames += bilder;
        });

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
        [/nicht einsatzbereit/, /überlastet/, /Vertr(ag läuft|äge laufen) aus/, /unzufrieden/].forEach(erwartet => {
            if (!erwartet.test(themen)) throw new Error(`Der Schreibtisch übersieht: ${erwartet}`);
        });

        // Auslaufende Verträge stehen mit Namen da, jeder führt in die Akte
        const vertraege = items.find(i => /aus$/.test(i.title) && i.abschnitt === "vertrag");
        if (!vertraege || !vertraege.spieler.some(sp => sp.id === kader[2].id)) {
            throw new Error("Der Spieler mit auslaufendem Vertrag steht nicht einzeln im Schreibtisch");
        }

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

    test("Anlagen: Bauen kostet nach Ligastufe, Amateure bekommen Förderung und können in Raten zahlen", () => {
        const welt = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        // Gemessen an den Einnahmen einer Saison kostet der nächste Ausbau
        // in jeder Liga ungefähr gleich viel - nicht in der Landesliga das Dreifache
        [1, 3, 5, 7].forEach(stufe => {
            const club = welt.clubs.find(c => c.level === stufe);
            FacilityEngine.hole(club, 1);
            Object.assign(club.anlagen.trainingGround, { stufe: 2, zustand: 80, projekt: null });
            const saisonEinnahmen = FinanceEngine.einnahmenSchaetzung(club, welt) * 34;
            const anteil = FacilityEngine.kosten(club, "trainingGround", "ausbau", 1) / saisonEinnahmen;
            if (anteil > 0.4 || anteil < 0.02) throw new Error(`Stufe ${stufe}: Der Ausbau kostet ${Math.round(anteil * 100)} % der Saisoneinnahmen`);
        });
        const profi = FacilityEngine.kostenDetail(welt.clubs.find(c => c.level === 1), "stadium", "ausbau", 1);
        if (profi.foerderung !== 0) throw new Error("Ein Profiverein bekommt Sportstättenförderung");

        // Der FC Hanau 93 kann bauen
        const state = GameState.createNewGame("ll_han", "normal", { name: "Prüfer" });
        const han = state.clubs.find(c => c.id === "ll_han");
        FacilityEngine.hole(han, 1);
        Object.assign(han.anlagen.stadium, { stufe: 1, zustand: 80, projekt: null });
        const detail = FacilityEngine.kostenDetail(han, "stadium", "ausbau", 1);
        if (detail.foerderung <= 0 || detail.netto !== detail.brutto - detail.foerderung) throw new Error(`Keine Förderung: ${JSON.stringify(detail)}`);
        if (detail.netto > 200000) throw new Error(`Eine Tribüne kostet in der Landesliga ${detail.netto} €`);

        // Zu wenig in der Kasse: bar geht nicht, die Hausbank finanziert
        han.balance = Math.round(detail.netto * 0.5);
        const bar = FacilityEngine.starteProjekt(state, han.id, "stadium", "ausbau");
        if (bar.erfolg || !bar.ratenMoeglich) throw new Error("Ohne Geld wird bar gebaut oder keine Finanzierung angeboten");
        const bank = FacilityEngine.finanzierung(state, han, "stadium", "ausbau");
        const kasseVorher = han.balance;
        const res = FacilityEngine.starteProjekt(state, han.id, "stadium", "ausbau", { finanzierung: "raten" });
        if (!res.erfolg) throw new Error("Die Finanzierung klappt nicht: " + res.grund);
        if (kasseVorher - han.balance !== bank.anzahlung) throw new Error("Es wurde mehr als die Anzahlung abgebucht");
        const dauer = FacilityEngine.dauer("stadium", "ausbau");
        for (let i = 0; i < dauer; i++) FacilityEngine.tickSpieltag(state);
        if (han.anlagen.stadium.stufe !== 2 || han.anlagen.stadium.projekt) throw new Error("Der finanzierte Ausbau wird nicht fertig");
        const gezahlt = kasseVorher - han.balance;
        if (gezahlt !== bank.gesamt || bank.zinsen <= 0) throw new Error(`Gezahlt ${gezahlt} statt ${bank.gesamt} (mit Zinsen)`);

        // Die Bank macht nicht alles mit
        han.balance = 0;
        if (FacilityEngine.finanzierung(state, han, "youthCenter", "ausbau").moeglich) throw new Error("Ohne Anzahlung finanziert die Bank");
        if (FacilityEngine.starteProjekt(state, han.id, "youthCenter", "ausbau", { finanzierung: "raten" }).erfolg) throw new Error("Ohne Anzahlung wird gebaut");
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
                // Ab der 55. Minute: Wer zurückliegt, wechselt früher
                const w = tl.find(e => e.type === "substitution" && e.team === "home" && e.minute >= 55);
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

    test("Scouting: Ein besserer Chefscout schätzt genauer und schreibt ausführlicher", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");
        const ziele = state.players.filter(p => p.clubId && p.clubId !== "muc").slice(0, 150);
        const messe = (guete) => {
            club.staff.scout = { id: `s${guete}`, name: `Scout ${guete}`, guete, gehalt: 1000, jahre: 2 };
            let fehler = 0, punkte = 0, eigenheiten = 0, rollen = 0, n = 0;
            ziele.forEach(p => {
                p.scoutingKnowledge = null;
                const r = ScoutingEngine.scoutPlayer(state, p.id, { source: "transfer_market" }).report;
                const [a, b] = String(r.estimatedOverall).split(" - ").map(Number);
                fehler += Math.abs((Number.isFinite(b) ? (a + b) / 2 : a) - p.overall);
                punkte += r.strengths.length + r.weaknesses.length;
                eigenheiten += r.hiddenTraits.length;
                if (r.kaderRolle) rollen++;
                if (r.scout.guete !== guete || !r.zuverlaessigkeit?.label || !r.recommendation) throw new Error("Bericht ohne Scout, Verlässlichkeit oder Empfehlung");
                n++;
            });
            return { fehler: fehler / n, punkte: punkte / n, eigenheiten, rollen };
        };
        const schwach = messe(30), stark = messe(90);
        if (!(stark.fehler < schwach.fehler - 1)) {
            throw new Error(`Der gute Scout liegt nicht genauer: ${stark.fehler.toFixed(2)} gegen ${schwach.fehler.toFixed(2)}`);
        }
        if (!(stark.punkte > schwach.punkte + 1)) {
            throw new Error(`Der gute Scout nennt nicht mehr Stärken und Schwächen: ${stark.punkte.toFixed(1)} gegen ${schwach.punkte.toFixed(1)}`);
        }
        if (schwach.eigenheiten !== 0 || schwach.rollen !== 0) throw new Error("Ein 1,5-Sterne-Scout sagt schon etwas zu Charakter oder Kaderrolle");
        if (stark.rollen < ziele.length * 0.9) throw new Error("Der gute Scout ordnet die Spieler nicht in den Kader ein");

        // Ohne eigenen Chefscout schreibt eine Aushilfe - mit Abzug
        delete club.staff.scout;
        const aushilfe = ScoutingEngine.scoutInfo(state);
        if (aushilfe.eigen || aushilfe.name !== "Aushilfsscout") throw new Error("Ohne Chefscout schreibt keine Aushilfe");
    });

    test("Gegneranalyse: Der Spielanalyst entscheidet über Tiefe und Schwachstelle", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");
        club.staff.analyse = { id: "a1", name: "Guter Analyst", guete: 92, gehalt: 1000, jahre: 2 };
        const gut = OpponentAnalysisEngine.generateReport(state, "dor", "muc");
        club.staff.analyse = { id: "a2", name: "Schwacher Analyst", guete: 22, gehalt: 500, jahre: 1 };
        const schwach = OpponentAnalysisEngine.generateReport(state, "dor", "muc");
        if (gut.keyPlayers.length <= schwach.keyPlayers.length) {
            throw new Error(`Der gute Analyst stellt nicht mehr Schlüsselspieler vor: ${gut.keyPlayers.length} gegen ${schwach.keyPlayers.length}`);
        }
        if (!gut.schwachstelle || schwach.schwachstelle) throw new Error("Nur der gute Analyst soll die Schwachstelle finden");
        if (gut.analyst.name !== "Guter Analyst" || gut.genauigkeit === schwach.genauigkeit) throw new Error("Analyst oder Genauigkeit fehlen im Bericht");
    });

    test("Jugendakademie: Schwerpunkte steuern Jahrgang, Positionen, Herkunft und Kosten", () => {
        const state = GameState.createNewGame("svw", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "svw");
        club.balance = 50000000;

        const andere = Object.keys(FacilityEngine.AKADEMIE_PROFILE).filter(k => k !== club.akademieProfil);
        const r1 = YouthEngine.setzeSchwerpunkte(state, "svw", { profil: andere[0], positionen: ["TW", "ST"], jahrgang: "breite", einzug: "international" });
        if (!r1.ok || club.akademieProfil !== andere[0]) throw new Error("Schwerpunkte lassen sich nicht setzen");
        const r2 = YouthEngine.setzeSchwerpunkte(state, "svw", { profil: andere[1] });
        if (r2.ok) throw new Error("Die Ausbildung lässt sich zweimal in einer Saison umstellen");
        if (YouthEngine.setzeSchwerpunkte(state, "svw", { positionen: ["TW", "ABW", "ST"] }).ok) throw new Error("Mehr als zwei Positionsschwerpunkte angenommen");

        const vorher = club.balance;
        const talente = [];
        for (let i = 0; i < 20; i++) talente.push(...YouthEngine.generateProspects(state, "svw"));
        if (talente.length !== 100) throw new Error(`Breiter Jahrgang bringt ${talente.length / 20} statt fünf Talente`);
        const kosten = YouthEngine.einzugKosten(club, "international");
        if (kosten <= 0 || vorher - club.balance !== kosten * 20) throw new Error("Die internationale Sichtung kostet nichts");
        const schwerpunkt = talente.filter(t => ["TW", "ST", "LA", "RA"].includes(t.pos)).length / talente.length;
        if (schwerpunkt < 0.4) throw new Error(`Nur ${Math.round(schwerpunkt * 100)} % Torhüter und Angreifer trotz Schwerpunkt`);
        const ausland = talente.filter(t => t.nationality !== "Deutschland").length / talente.length;
        if (ausland < 0.35) throw new Error(`Internationale Sichtung bringt nur ${Math.round(ausland * 100)} % aus dem Ausland`);

        YouthEngine.setzeSchwerpunkte(state, "svw", { jahrgang: "spitze", einzug: "region", positionen: [] });
        const spitze = YouthEngine.generateProspects(state, "svw");
        if (spitze.length !== 2) throw new Error("Spitzenjahrgang bringt nicht zwei Talente");

        // Die KI-Vereine ziehen ihre Jahrgänge unverändert nach
        if (YouthEngine.generateProspects(state, "dor").length !== 3) throw new Error("KI-Verein bekommt keinen normalen Jahrgang");
    });

    test("Vorbereitung: Gehaltsverhandlung, Stab-Etat, Pflichtposten und Erinnerung", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");
        const pre = state.preseason;
        if (!pre || !pre.aktiv) throw new Error("Keine Vorbereitung aktiv");
        club.staff = {};
        PreseasonEngine.sichereBewerber(pre, club);

        const luecken = PreseasonEngine.pflichtLuecken(state).map(b => b.key).sort();
        if (luecken.join() !== ["cotrainer", "fitness", "medizin"].join()) throw new Error(`Pflichtposten falsch: ${luecken.join()}`);

        // Zu tief angesetzt: Er bricht ab
        const arzt = pre.bewerber.medizin[0];
        const affront = PreseasonEngine.verhandleStab(state, "medizin", arzt.id, Math.round(arzt.mindestGehalt * 0.5), 2);
        if (affront.status !== "abgebrochen" || pre.bewerber.medizin.some(b => b.id === arzt.id)) throw new Error("Ein Affront-Angebot beendet die Gespräche nicht");

        // Knapp darunter: Gegenangebot, das dann angenommen wird
        const zweiter = pre.bewerber.medizin[0];
        const knapp = Math.round(zweiter.mindestGehalt * 0.9);
        const gegen = PreseasonEngine.verhandleStab(state, "medizin", zweiter.id, knapp, 2);
        if (gegen.status !== "gegenangebot" || !(gegen.gegenangebot >= zweiter.mindestGehalt && gegen.gegenangebot <= zweiter.gehalt)) {
            throw new Error(`Kein sinnvolles Gegenangebot: ${JSON.stringify(gegen)}`);
        }
        const posteingang = (state.inbox || []).length;
        const einig = PreseasonEngine.verhandleStab(state, "medizin", zweiter.id, gegen.gegenangebot, 2);
        if (einig.status !== "einig" || club.staff.medizin?.gehalt !== gegen.gegenangebot) throw new Error("Die Einigung setzt den Arzt nicht zum vereinbarten Gehalt ein");
        const meldung = state.inbox[0];
        if (state.inbox.length !== posteingang + 1 || !/✍️/.test(meldung.subject) || !/Noch offen/.test(meldung.body)) {
            throw new Error("Die Verpflichtung wird nicht mit Etat und offenen Posten gemeldet");
        }

        // Der Etat setzt eine Grenze
        const etat = club.wageBudget;
        club.wageBudget = 1000;
        const teuer = pre.bewerber.fitness[0];
        if (PreseasonEngine.verpflichte(state, "fitness", teuer.id).ok) throw new Error("Verpflichtung über dem Stab-Etat möglich");
        club.wageBudget = etat;

        // Eine Woche vor dem Start erinnert der Sportdirektor - einmal
        pre.tagIndex = pre.dauer - 7;
        const erinnerung = PreseasonEngine.erinnere(state);
        if (!erinnerung || !erinnerung.luecken.some(b => b.key === "fitness")) throw new Error("Keine Erinnerung an die offenen Pflichtposten");
        if (PreseasonEngine.erinnere(state)) throw new Error("Die Erinnerung kommt am selben Tag doppelt");

        // Kurzfristig besetzen füllt die Lücken
        ["fitness", "cotrainer"].forEach(k => {
            const r = PreseasonEngine.besetzeKurzfristig(state, k);
            if (!r.ok) throw new Error(`${k} lässt sich nicht kurzfristig besetzen: ${r.grund}`);
        });
        if (PreseasonEngine.pflichtLuecken(state).length) throw new Error("Nach dem Besetzen bleiben Pflichtposten offen");
    });

    test("Angebote für eigene Spieler: Frist, Mehr fordern, Annehmen und Verfall", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");
        if (!state.transferMarket) state.transferMarket = { offers: [] };
        // Ein Spieler, für den sich sicher ein Käufer findet, an die Stelle,
        // die der feste Zufallswert auswählt
        const erzeuge = () => {
            const kandidat = state.players
                .filter(p => p.clubId === "muc" && p.overall >= 74)
                .sort((a, b) => a.value - b.value)[0];
            const ids = club.playerIds.filter(id => id !== kandidat.id);
            ids.splice(Math.floor(0.1 * club.playerIds.length), 0, kandidat.id);
            club.playerIds = ids;
            state.clubs.forEach(c => { if (c.id !== "muc") c.transferBudget = Math.max(c.transferBudget || 0, kandidat.value * 2); });
            const zufall = Math.random;
            Math.random = () => 0.1;
            try { TransferEngine.processAITransferMarket(state); } finally { Math.random = zufall; }
            return state.transferMarket.offers[0];
        };
        const o = erzeuge();
        if (!o || o.status !== "pending" || typeof o.frist !== "number" || o.gemeldet !== false || !(o.maxFee >= o.fee)) {
            throw new Error(`Angebot ohne Frist, Meldestatus oder Obergrenze: ${JSON.stringify(o)}`);
        }
        const punkte = ManagerEngine.getAttentionItems(state);
        if (!punkte.some(p => p.icon === "💰" && p.priority === 0)) throw new Error("Das Angebot steht nicht oben auf dem Dashboard");

        // Maßlos: Der Verein zieht zurück
        const zurueck = TransferEngine.fordereMehr(state, o.id, Math.round(o.maxFee * 1.5));
        if (zurueck.status !== "zurueckgezogen" || o.status !== "withdrawn") throw new Error("Eine maßlose Forderung lässt das Angebot stehen");

        // Knapp über der Grenze: Er bessert bis zur Grenze nach - einmal
        o.status = "pending"; o.nachgebessert = false;
        const nach = TransferEngine.fordereMehr(state, o.id, Math.round(o.maxFee * 1.1));
        if (nach.status !== "nachgebessert" || o.fee !== o.maxFee) throw new Error(`Keine Nachbesserung bis zur Grenze: ${JSON.stringify(nach)}`);
        if (TransferEngine.fordereMehr(state, o.id, o.fee + 100000).status !== "fehler") throw new Error("Es wird ein zweites Mal nachgebessert");

        // Annehmen: Der Spieler wechselt
        const r = TransferEngine.nimmAngebotAn(state, o.id);
        const spieler = state.players.find(p => p.id === o.playerId);
        if (!r.ok || spieler.clubId !== o.fromClubId || club.playerIds.includes(o.playerId)) throw new Error("Nach dem Annehmen wechselt der Spieler nicht");

        // Ein neues Angebot verfällt nach der Frist
        const zweites = erzeuge();
        if (!zweites || zweites === o) throw new Error("Kein zweites Angebot erzeugt");
        state.currentDayIndex = zweites.frist + 1;
        const verfallen = TransferEngine.pruefeAngebotsfristen(state);
        if (!verfallen.includes(zweites) || zweites.status !== "expired") throw new Error("Das Angebot verfällt nicht nach der Frist");
    });

    test("Sofort beenden: Der Co-Trainer übernimmt Wechsel und Umstellungen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const taktikVorher = JSON.stringify(heim.tactics);
        let wechsel = 0, uebernahmen = 0;
        for (let i = 0; i < 6; i++) {
            // Der Spieler entscheidet selbst - bis er auf "Sofort beenden" drückt
            const live = MatchEngine.createLiveMatch({ id: `sofort_co_${i}`, played: false, homeClubId: "muc", awayClubId: "dor" },
                heim, gast, state.players, { userSide: "home", delegation: { wechsel: false, taktik: false } });
            if (live.timeline.some(e => e.type === "substitution" && e.team === "home")) {
                throw new Error("Wer selbst wechselt, bekommt schon vorher Wechsel simuliert");
            }
            let n = 0;
            while (live.minute < 30 && n++ < 5000) live.tick();
            live.skipToEnd();
            if (!live.delegation.wechsel || !live.delegation.taktik) throw new Error("Der Co-Trainer übernimmt beim Sofort-Ergebnis nicht");
            wechsel += live.timeline.filter(e => e.type === "substitution" && e.team === "home" && e.minute > 30).length;
            if ((live.events || []).concat(live.verlauf || []).some(e => /übernimmt für den Rest/.test(e.text || ""))) uebernahmen++;
            if (JSON.stringify(heim.tactics) !== taktikVorher) throw new Error("Die Umstellungen des Co-Trainers bleiben nach dem Spiel stehen");
        }
        if (wechsel < 6) throw new Error(`Nach dem Sofort-Ergebnis wechselt der Co-Trainer kaum: ${wechsel} Wechsel in sechs Spielen`);
        if (uebernahmen === 0) throw new Error("Der Ticker sagt nicht, dass der Co-Trainer übernimmt");
    });

    test("Jugendakademie: Talente passen zur Ligastufe - auch in der Landesliga keine fünf Sterne", () => {
        const welt = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        [1, 4, 7].forEach(stufe => {
            const vorlage = welt.clubs.find(c => c.level === stufe);
            const state = GameState.createNewGame(vorlage.id, "normal", { name: "Prüfer" });
            const club = state.clubs.find(c => c.id === vorlage.id);
            const kader = state.players.filter(p => p.clubId === club.id);
            const ctx = { squadAverageAbility: PlayerRatingEngine.squadAverageAbility(kader) };
            const talente = [];
            for (let i = 0; i < 20; i++) talente.push(...YouthEngine.generateProspects(state, club.id));
            const heute = talente.map(t => PlayerRatingEngine.starsForOverall(t.overall, ctx));
            const potenzial = talente.map(t => PlayerRatingEngine.starsForOverall(t.pot, ctx));
            const schnitt = a => a.reduce((x, y) => x + y, 0) / a.length;
            if (schnitt(heute) > 3) throw new Error(`Stufe ${stufe}: Die Talente sind heute schon ${schnitt(heute).toFixed(1)} Sterne stark`);
            if (heute.some(x => x >= 5)) throw new Error(`Stufe ${stufe}: Ein Fünfzehnjähriger steht heute mit fünf Sternen da`);
            if (schnitt(potenzial) < 2.5 || schnitt(potenzial) > 4.5) {
                throw new Error(`Stufe ${stufe}: Das Potenzial liegt im Schnitt bei ${schnitt(potenzial).toFixed(1)} Sternen`);
            }
            if (talente.some(t => typeof t.trueCurrentAbility !== "number" || t.pot <= t.overall)) {
                throw new Error(`Stufe ${stufe}: Talente ohne innere Stärke oder ohne Luft nach oben`);
            }
        });

        // Ein Talent aus einem älteren Spielstand - noch wie für einen
        // Bundesligisten erzeugt - wird an die Liga angepasst
        const vorlage = welt.clubs.find(c => c.level === 7);
        const state = GameState.createNewGame(vorlage.id, "normal", { name: "Prüfer" });
        const alt = state.youthAcademy.prospects[0];
        Object.assign(alt, { overall: 58, pot: 85 });
        delete alt.trueCurrentAbility;
        delete alt.truePotentialAbility;
        if (YouthEngine.passeTalenteAnLigaAn(state, vorlage.id) < 1 || alt.overall >= 40 || typeof alt.trueCurrentAbility !== "number") {
            throw new Error(`Das alte Talent bleibt bei Stärke ${alt.overall}`);
        }
        const befoerdert = YouthEngine.promoteProspect(state, vorlage.id, alt.id, { skipNews: true });
        if (!befoerdert.success || befoerdert.player.overall !== alt.overall || befoerdert.player.trueCurrentAbility !== alt.trueCurrentAbility) {
            throw new Error("Nach der Beförderung hat das Talent andere Werte als in der Akademie");
        }
    });

    test("Trainerstab: Gehälter nach Liga und Posten, der Stab wird wirklich bezahlt", () => {
        const welt = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const grenzen = { 1: { max: 40000, rahmen: 160000 }, 7: { max: 400, rahmen: 1200 } };
        [1, 7].forEach(stufe => {
            const vorlage = welt.clubs.find(c => c.level === stufe);
            const state = GameState.createNewGame(vorlage.id, "normal", { name: "Prüfer" });
            const club = state.clubs.find(c => c.id === vorlage.id);
            const alle = Object.values(state.preseason.bewerber).flat();
            const teuerster = Math.max(...alle.map(b => b.gehalt));
            if (teuerster > grenzen[stufe].max) throw new Error(`Stufe ${stufe}: Ein Stabsmitglied verlangt ${teuerster} € je Woche`);
            if (alle.some(b => b.gehalt < 50 || b.mindestGehalt > b.gehalt)) throw new Error(`Stufe ${stufe}: Gehalt oder Mindestgehalt unplausibel`);
            const rahmen = PreseasonEngine.stabRahmen(club);
            if (rahmen > grenzen[stufe].rahmen || rahmen < PreseasonEngine.erwarteteStabKosten(club)) {
                throw new Error(`Stufe ${stufe}: Stab-Etat ${rahmen} € passt nicht zur Liga`);
            }
        });

        // Der Stab wird jede Woche bezahlt
        const state = GameState.createNewGame("muc", "normal", { name: "Prüfer" });
        const club = state.clubs.find(c => c.id === "muc");
        const arzt = state.preseason.bewerber.medizin[0];
        if (!PreseasonEngine.verpflichte(state, "medizin", arzt.id).ok) throw new Error("Arzt lässt sich nicht verpflichten");
        FinanceEngine.applyWeeklyCosts(state);
        const buchung = (state.finances?.transactions || []).find(t => t.type === "staff_wages");
        if (!buchung || buchung.amount !== -PreseasonEngine.stabLohnsumme(club)) {
            throw new Error(`Die Stabsgehälter werden nicht gebucht: ${JSON.stringify(buchung)}`);
        }
        if (PreseasonEngine.stabLohnsumme(club) <= arzt.gehalt) throw new Error("Offene Posten kosten keine Aushilfe");

        // Ein Vertrag aus der Zeit der alten Gehaltsformel wird umgerechnet
        club.staff.medizin.gehalt = 173000;
        delete club.stabGehaelterV2;
        PreseasonEngine.rechneStabGehaelterUm(state);
        if (club.staff.medizin.gehalt > 30000) throw new Error(`Der alte Vertrag bleibt bei ${club.staff.medizin.gehalt} € je Woche`);
    });

    test("Jugendakademie: Beförderte bleiben nach dem Laden befördert, der neue Jahrgang kommt am Jugendtag", () => {
        const neu = GameState.createNewGame("ll_han", "normal", { name: "Prüfer" });
        const geladen = SaveService.importJson(SaveService.exportJson(neu));
        if (!geladen.success) throw new Error("Spielstand lässt sich nicht laden: " + geladen.error);
        const state = geladen.state;
        const club = state.clubs.find(c => c.id === state.userClubId);
        // Nach dem Laden sind die beiden Listen Kopien - genau da lag der Fehler
        const offen = () => YouthEngine.eigeneTalente(state).filter(p => !p.promoted);
        const vorher = offen().length;
        const talent = offen()[0];
        if (!talent) throw new Error("Keine Talente in der Akademie");
        if (!YouthEngine.promoteProspect(state, club.id, talent.id, { skipNews: true }).success) throw new Error("Beförderung scheitert");
        if (offen().some(p => p.id === talent.id) || offen().length !== vorher - 1) throw new Error("Der Beförderte steht weiter in der Akademie");
        if (state.youthAcademy.prospects.find(p => p.id === talent.id)?.promoted !== true) throw new Error("Der Reiter Training sieht den Beförderten noch als offen");
        if (YouthEngine.promoteProspect(state, club.id, talent.id, { skipNews: true }).success) throw new Error("Ein Talent lässt sich zweimal befördern");
        if (state.players.filter(p => p.name === talent.name && p.clubId === club.id).length !== 1) throw new Error("Der Beförderte steht doppelt im Kader");

        // Der Jugendtag: drei Spieltage vorher die Vorschau, dann der Jahrgang
        const tag = YouthEngine.jugendtagSpieltag(state);
        if (tag < 10) throw new Error(`Der Jugendtag liegt schon am ${tag}. Spieltag`);
        state.inbox = [];
        state.currentMatchday = tag - 5;
        if (YouthEngine.pruefeJugendtag(state)) throw new Error("Der Jugendtag meldet sich zu früh");
        state.currentMatchday = tag - 3;
        if (!/kündigt den Jugendtag an/.test(YouthEngine.pruefeJugendtag(state) || "")) throw new Error("Keine Vorschau vor dem Jugendtag");
        if (YouthEngine.pruefeJugendtag(state)) throw new Error("Die Vorschau kommt zweimal");
        const offenVorher = offen().length;
        state.currentMatchday = tag;
        if (!/Jugendtag: \d+ neue Talente/.test(YouthEngine.pruefeJugendtag(state) || "")) throw new Error("Am Jugendtag kommt kein Jahrgang");
        if (offen().length <= offenVorher) throw new Error("Nach dem Jugendtag gibt es keine neuen Talente");
        state.currentMatchday = tag + 1;
        if (YouthEngine.pruefeJugendtag(state)) throw new Error("Der Jugendtag kommt zweimal in einer Saison");
        const betreffe = state.inbox.map(m => m.subject);
        if (!betreffe.some(b => /Jugendtag in drei Wochen/.test(b)) || !betreffe.some(b => /Jugendtag: \d+ neue Talente/.test(b))) {
            throw new Error(`Postfach ohne Jugendtag: ${JSON.stringify(betreffe)}`);
        }
        // In der nächsten Saison kommt wieder einer
        state.seasonYear = (state.seasonYear || 1) + 1;
        state.currentMatchday = tag;
        if (!YouthEngine.pruefeJugendtag(state)) throw new Error("In der nächsten Saison gibt es keinen Jugendtag");
    });

    test("Scouting: Eine Beobachtung dauert Tage bis Wochen, dann kommt ein ausführlicher Bericht", () => {
        const state = GameState.createNewGame("ll_han", "normal", { name: "Prüfer" });
        const han = state.clubs.find(c => c.id === "ll_han");
        const ligaGegner = state.players.find(p => {
            const c = state.clubs.find(x => x.id === p.clubId);
            return c && c.id !== han.id && c.leagueId === han.leagueId;
        });
        const ausland = state.players.find(p => {
            const c = state.clubs.find(x => x.id === p.clubId);
            return c && c.countryId && c.countryId !== (han.countryId || "de");
        });
        const tageLiga = ScoutingEngine.beobachtungsDauer(state, ligaGegner);
        const tageAusland = ScoutingEngine.beobachtungsDauer(state, ausland);
        if (tageLiga < 2 || tageLiga > 8) throw new Error(`Ein Ligaspieler braucht ${tageLiga} Tage`);
        if (tageAusland < 10 || tageAusland > 28 || tageAusland <= tageLiga) throw new Error(`Ein Spieler aus dem Ausland braucht ${tageAusland} Tage (Liga: ${tageLiga})`);

        state.inbox = [];
        const wissenVorher = ligaGegner.scoutingKnowledge?.knowledgeLevel || 25;
        const res = ScoutingEngine.beobachteSpieler(state, ligaGegner.id, { source: "transfer_market" });
        if (!res.success) throw new Error("Beobachtung startet nicht: " + res.error);
        if ((ligaGegner.scoutingKnowledge?.knowledgeLevel || 25) !== wissenVorher) throw new Error("Das Wissen springt sofort");
        if (ScoutingEngine.beobachteSpieler(state, ligaGegner.id).success) throw new Error("Derselbe Spieler wird zweimal beobachtet");
        const eigener = state.players.find(p => p.clubId === han.id);
        if (ScoutingEngine.beobachteSpieler(state, eigener.id).success) throw new Error("Ein eigener Spieler wird gescoutet");

        // Die Beobachtung übersteht Speichern und Laden
        const geladen = SaveService.importJson(SaveService.exportJson(state));
        if (!geladen.success || !geladen.state.scouting?.beobachtungen?.length) throw new Error("Die Beobachtung geht beim Speichern verloren");

        for (let t = 1; t < res.tage; t++) {
            if (ScoutingEngine.pruefeBeobachtungen(state).length) throw new Error(`Der Bericht kommt schon nach ${t} von ${res.tage} Tagen`);
        }
        const fertig = ScoutingEngine.pruefeBeobachtungen(state);
        if (fertig.length !== 1 || ScoutingEngine.beobachtungVon(state, ligaGegner.id)) throw new Error("Nach der Frist kommt kein Bericht");
        if (!(ligaGegner.scoutingKnowledge.knowledgeLevel > wissenVorher)) throw new Error("Der Bericht bringt kein Wissen");
        const post = state.inbox.find(m => /Scoutbericht/.test(m.subject || ""));
        if (!post || !/Stärken:/.test(post.body) || !/Empfehlung:/.test(post.body) || post.relatedEntity?.id !== ligaGegner.id) {
            throw new Error(`Kein ausführlicher Bericht im Postfach: ${JSON.stringify(post)}`);
        }
        if (!state.scouting.reports.some(r => r.playerId === ligaGegner.id)) throw new Error("Der Bericht fehlt in der Berichtsliste");

        // Der Scout hat nur begrenzt Zeit
        const andere = state.players.filter(p => p.clubId && p.clubId !== han.id).slice(0, 8);
        const ergebnisse = andere.map(p => ScoutingEngine.beobachteSpieler(state, p.id).success);
        if (ergebnisse.filter(Boolean).length !== ScoutingEngine.MAX_BEOBACHTUNGEN) throw new Error(`${ergebnisse.filter(Boolean).length} Beobachtungen gleichzeitig`);
    });

    test("Kalender: Das Weiterlaufen hält an, wenn etwas den Manager angeht (wie im FM)", () => {
        const state = GameState.createNewGame("ll_han", "normal", { name: "Prüfer" });
        const leer = { summary: { negotiations: [], training: { injuries: [] } } };
        const bekannt = () => new Set((state.inbox || []).map(m => String(m.id)));
        if (CalendarEngine.unterbrechungsGrund(state, leer, bekannt())) throw new Error("Ein ruhiger Tag hält an");

        // Ein Spielbericht oder Trainingsbericht hält nicht an ...
        let ids = bekannt();
        NewsEngine.addMessage(state, "training_report", { title: "Trainingswoche", text: "..." });
        if (CalendarEngine.unterbrechungsGrund(state, leer, ids)) throw new Error("Ein Trainingsbericht hält an");
        // ... ein Scoutbericht schon
        ids = bekannt();
        NewsEngine.addMessage(state, "scouting", { title: "Scoutbericht: Max Muster", text: "..." });
        if (!/Scoutbericht/.test(CalendarEngine.unterbrechungsGrund(state, leer, ids) || "")) throw new Error("Ein Scoutbericht hält nicht an");

        ids = bekannt();
        if (!/verletzt/.test(CalendarEngine.unterbrechungsGrund(state, { summary: { training: { injuries: ["Max Muster"] } } }, ids) || "")) {
            throw new Error("Eine Trainingsverletzung hält nicht an");
        }
        if (!/Verhandlung/.test(CalendarEngine.unterbrechungsGrund(state, { summary: { negotiations: [{ negotiation: { playerName: "Max Muster" } }] } }, ids) || "")) {
            throw new Error("Eine Antwort in der Verhandlung hält nicht an");
        }
        if (!state.transferMarket) state.transferMarket = {};
        state.transferMarket.offers = [{ status: "pending", gemeldet: false, fromClubName: "FC Test", playerName: "Max Muster" }];
        if (!/Angebot von FC Test/.test(CalendarEngine.unterbrechungsGrund(state, leer, ids) || "")) throw new Error("Ein neues Angebot hält nicht an");
    });

    test("Spielplan: Heim und Auswärts wechseln sich ab - keine langen Serien", () => {
        [16, 18, 20, 15].forEach(anzahl => {
            const clubs = Array.from({ length: anzahl }, (_, i) => ({ id: `v${i}` }));
            const plan = GameState.generateSchedule(clubs);
            clubs.forEach(c => {
                const folge = plan.map(r => {
                    const m = r.matches.find(x => x.homeClubId === c.id || x.awayClubId === c.id);
                    return m ? (m.homeClubId === c.id ? "H" : "A") : "";
                }).join("");
                const laengste = Math.max(...(folge.match(/H+|A+/g) || [""]).map(s => s.length));
                if (laengste > 4) throw new Error(`${anzahl} Vereine: ${c.id} hat ${laengste} gleiche Spiele in Folge (${folge})`);
                const heim = (folge.match(/H/g) || []).length;
                if (Math.abs(heim - folge.length / 2) > 1) throw new Error(`${c.id}: ${heim} Heimspiele von ${folge.length}`);
            });
            // Jede Paarung genau einmal zu Hause und einmal auswärts
            const paare = new Set();
            plan.forEach(r => r.matches.forEach(m => paare.add(`${m.homeClubId}-${m.awayClubId}`)));
            if (paare.size !== anzahl * (anzahl - 1)) throw new Error(`${anzahl} Vereine: ${paare.size} verschiedene Heimspiele statt ${anzahl * (anzahl - 1)}`);
        });
    });

    // ------------------------------------------------------------------
    // FM-Modus: Das Livespiel entsteht aus Entscheidungen nach Spielerwerten
    // ------------------------------------------------------------------

    const fmSpiel = (state, heimId, gastId, id, optionen = {}) => {
        const heim = state.clubs.find(c => c.id === heimId);
        const gast = state.clubs.find(c => c.id === gastId);
        const partie = { id, played: false, homeClubId: heim.id, awayClubId: gast.id };
        const live = MatchEngine.createLiveMatch(partie, heim, gast, optionen.spieler || state.players,
            Object.assign({ modus: "fm" }, optionen.live || {}));
        live.speed = optionen.speed || 1;
        const schritt = optionen.schritt || 100;
        let k = 0;
        while (!live.isFinished && k++ < 200000) {
            // Ohne updateBallAndPlayers bewegt sich niemand - und wer sich
            // nicht bewegt, kommt nie zum Abschluss
            live.advanceRealTime(schritt);
            live.updateBallAndPlayers(schritt);
            if (optionen.jeBild) optionen.jeBild(live);
        }
        return { live, partie };
    };

    test("FM-Modus: Die Zeitleiste gibt nur den Rahmen vor, Tore und Schüsse entstehen im Spiel", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "FM" });
        const { live, partie } = fmSpiel(state, "lev", "fca", "fm_rahmen");
        if (!live.isFinished) throw new Error("Das Spiel wurde nicht beendet");

        const schuesse = live.timeline.filter(e => ["goal", "save", "shot_miss"].includes(e.type));
        if (schuesse.length < 8) throw new Error(`Nur ${schuesse.length} Abschlüsse in neunzig Minuten`);
        const ohneFm = schuesse.filter(e => !e.fm);
        if (ohneFm.length) throw new Error(`${ohneFm.length} Abschlüsse stammen aus der vorab gewürfelten Zeitleiste`);
        const tore = live.timeline.filter(e => e.type === "goal");
        if (tore.length !== partie.homeGoals + partie.awayGoals) {
            throw new Error(`${tore.length} Tore in der Zeitleiste, Ergebnis ${partie.homeGoals}:${partie.awayGoals}`);
        }
        // Jeder Abschluss hat einen Schützen und eine Chancenqualität
        const ohneXg = schuesse.filter(e => !(e.xG > 0) || !(e.playerId || e.shooterId));
        if (ohneXg.length) throw new Error(`${ohneXg.length} Abschlüsse ohne Schützen oder xG`);

        // Gemessen statt gewürfelt: Ballbesitz ergibt hundert, die Passquote ist plausibel
        const st = partie.stats;
        if (Math.abs(st.possession[0] + st.possession[1] - 100) > 1) throw new Error(`Ballbesitz ${st.possession.join(":")}`);
        st.passAccuracy.forEach(q => {
            if (!(q >= 55 && q <= 95)) throw new Error(`Passquote ${st.passAccuracy.join(":")} ist nicht gemessen`);
        });
        if (!(live.timeline.passAccuracy && live.timeline.possession)) throw new Error("Die Messwerte fehlen in der Zeitleiste");
    });

    test("FM-Modus: Die technisch überlegene Elf lässt den Ball laufen und hat mehr davon", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Geduld" });
        const club = id => state.clubs.find(c => c.id === id);
        const partie = (heim, gast, id) => {
            state.players.forEach(p => { p.suspendedMatches = 0; p.injuredWeeks = 0; p.fitness = 95; });
            const m = { id, played: false, homeClubId: heim, awayClubId: gast };
            const live = MatchEngine.createLiveMatch(m, club(heim), club(gast), state.players, { modus: "fm" });
            return { m, live };
        };

        // Die Geduld folgt dem technischen Vorsprung: Bayern ist geduldig,
        // Augsburg spielt direkter, und beides bleibt in seinen Grenzen
        const { live: probe } = partie("muc", "fca", "geduld_probe");
        const flow = probe.director.flow;
        const heim = flow.geduld("home"), gast = flow.geduld("away");
        if (!(heim > 0.3 && heim <= MatchFlowEngine.GEDULD_MAX)) throw new Error(`Bayern ist nicht geduldig (${heim.toFixed(2)})`);
        if (!(gast < 0 && gast >= MatchFlowEngine.GEDULD_MIN)) throw new Error(`Augsburg spielt nicht direkter (${gast.toFixed(2)})`);

        // Und auf dem Platz: Bayern hat deutlich mehr vom Ball. Vorher waren
        // es gemessen 52 Prozent bei fast gleicher Passquote.
        let besitz = 0;
        for (let i = 0; i < 4; i++) {
            const { m, live } = partie("muc", "fca", "geduld_" + i);
            live.rechneOhneBild();
            besitz += m.stats.possession[0];
        }
        besitz /= 4;
        if (besitz < 56) throw new Error(`Bayern hat gegen Augsburg nur ${besitz.toFixed(1)} % Ballbesitz`);
    });

    test("FM-Modus: Live-Anzeige und Spielbericht zählen dasselbe - auch mit Wechsel", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "FM" });
        const heim = state.clubs.find(c => c.id === "lev");
        let gewechselt = false;
        const { live, partie } = fmSpiel(state, "lev", "fca", "fm_paritaet", {
            speed: 2, schritt: 40,
            live: { userSide: "home", delegation: { wechsel: false, taktik: false } },
            jeBild: (l) => {
                if (gewechselt || l.minute < 60) return;
                const raus = l.homeLineup.find(p => p.pos !== "TW");
                const rein = l.bank.home[0];
                if (raus && rein) l.substitute("home", raus.id, rein);
                gewechselt = true;
            }
        });
        if (!heim) throw new Error("Heimverein fehlt");
        ["shots", "shotsOnTarget", "corners", "fouls", "yellowCards", "redCards"].forEach(k => {
            const a = live.stats[k], b = partie.stats[k];
            if (a[0] !== b[0] || a[1] !== b[1]) throw new Error(`${k}: live ${a.join(":")}, Bericht ${b.join(":")}`);
        });
        if (live.homeScore !== partie.homeGoals || live.awayScore !== partie.awayGoals) {
            throw new Error(`Ergebnis live ${live.homeScore}:${live.awayScore}, Bericht ${partie.homeGoals}:${partie.awayGoals}`);
        }
    });

    test("FM-Modus: Sofort beenden übernimmt den Spielstand und rechnet den Rest weiter", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "FM" });
        const heim = state.clubs.find(c => c.id === "lev");
        const gast = state.clubs.find(c => c.id === "fca");
        const partie = { id: "fm_sofort", played: false, homeClubId: heim.id, awayClubId: gast.id };
        const live = MatchEngine.createLiveMatch(partie, heim, gast, state.players, { modus: "fm" });
        live.speed = 1;
        let k = 0;
        while (!live.isFinished && live.minute < 35 && k++ < 100000) {
            live.advanceRealTime(100);
            live.updateBallAndPlayers(100);
        }
        const stand = [live.homeScore, live.awayScore];
        live.skipToEnd();
        if (!live.isFinished) throw new Error("Nach Sofort beenden läuft das Spiel noch");
        if (partie.homeGoals < stand[0] || partie.awayGoals < stand[1]) {
            throw new Error(`Stand ${stand.join(":")} zur Pause, Endstand ${partie.homeGoals}:${partie.awayGoals}`);
        }
        const tore = live.timeline.filter(e => e.type === "goal");
        if (tore.length !== partie.homeGoals + partie.awayGoals) throw new Error("Tore und Endstand passen nicht zusammen");
    });

    test("FM-Modus: Werte entscheiden - die deutlich bessere Elf erspielt sich mehr", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "FM" });
        const WERTE = ["passing", "vision", "technique", "dribbling", "shooting", "pace", "physical",
            "defense", "positioning", "reflexes", "handling", "oneOnOne", "kicking", "stamina", "overall"];
        const heimIds = new Set(state.players.filter(p => p.clubId === "fca").map(p => p.id));
        const gastIds = new Set(state.players.filter(p => p.clubId === "boc").map(p => p.id));
        // Dieselben Spieler, nur mit anderen Werten: Der Gast wird stark, der Gastgeber schwach
        const spieler = state.players.map(p => {
            if (!heimIds.has(p.id) && !gastIds.has(p.id)) return p;
            const q = Object.assign({}, p);
            const d = gastIds.has(p.id) ? 16 : -16;
            WERTE.forEach(w => { if (typeof q[w] === "number") q[w] = Math.max(25, Math.min(99, q[w] + d)); });
            return q;
        });
        const summe = { xg: [0, 0], schuesse: [0, 0], paesse: [0, 0] };
        for (let i = 0; i < 3; i++) {
            const { partie } = fmSpiel(state, "fca", "boc", "fm_werte" + i, { spieler });
            [0, 1].forEach(j => {
                summe.xg[j] += partie.stats.xG[j];
                summe.schuesse[j] += partie.stats.shots[j];
                summe.paesse[j] += partie.stats.passAccuracy[j];
            });
        }
        if (!(summe.xg[1] > summe.xg[0] * 1.3)) throw new Error(`xG schwach ${summe.xg[0].toFixed(2)} - stark ${summe.xg[1].toFixed(2)}`);
        if (!(summe.schuesse[1] > summe.schuesse[0])) throw new Error(`Schüsse ${summe.schuesse.join(":")}`);
        if (!(summe.paesse[1] > summe.paesse[0])) throw new Error(`Passquote ${summe.paesse.join(":")}`);
    });

    test("FM-Modus: Spieler auf dem Feld tragen ihre echten Werte und Eigenschaften", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "FM" });
        const star = state.players.find(p => p.clubId === "muc" && p.signatur);
        if (!star) throw new Error("Der FC Bayern hat keinen Spieler mit Signatur");
        const w = MatchEngine.werte2D(star, star.pos);
        if (w.signatur !== star.signatur) throw new Error("Die Signatur fehlt auf dem Feld");
        if (!w.eig || Object.keys(w.eig).length === 0) throw new Error("Die Wirkung der Eigenschaften fehlt auf dem Feld");
        if (!(w.shooting > 0 && w.passing > 0)) throw new Error("Die Werte fehlen auf dem Feld");
        // Außerhalb der eigenen Position spielt er schlechter
        const fremd = MatchEngine.werte2D(star, star.pos === "TW" ? "ST" : "TW");
        if (!(fremd.passing < w.passing)) throw new Error("Die Positionseignung wirkt nicht");

        // Die Werte wirken relativ zum Niveau der Partie: Zwei Landesligisten
        // spielen auf dem Feld mit einem Schnitt von 70, das Verhältnis bleibt
        const heim = state.players.filter(p => p.clubId === "ll_han").slice(0, 11);
        const gast = state.players.filter(p => p.clubId === "ll_vil").slice(0, 11);
        const skala = MatchEngine.fmSkala([heim, gast]);
        if (!(skala > 2)) throw new Error(`Landesliga wird nur mit ${skala} skaliert`);
        const a = { pos: "ZM", overall: 26, passing: 30, fitness: 100, morale: 75, form: 7 };
        const b = Object.assign({}, a, { passing: 20 });
        const wa = MatchEngine.werte2D(a, "ZM", skala), wb = MatchEngine.werte2D(b, "ZM", skala);
        if (!(wa.overall > 55 && wa.overall < 95)) throw new Error(`Skalierte Stärke ${wa.overall}`);
        const vorher = MatchEngine.werte2D(a, "ZM").passing / MatchEngine.werte2D(b, "ZM").passing;
        if (Math.abs(wa.passing / wb.passing - vorher) > 0.02) throw new Error("Das Verhältnis zwischen zwei Spielern ändert sich");
    });

    test("FM-Modus: Die Abspielstufe ändert nicht, wie eng gedeckt wird", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Tempo" });
        const heim = state.clubs.find(c => c.id === "lev");
        const gast = state.clubs.find(c => c.id === "fca");
        // Zwei Spieler zu dicht beieinander: Nach einer Spielsekunde stehen sie
        // auf jeder Stufe gleich weit auseinander, egal in wie vielen Bildern
        const abstandNach = (speed, bilder) => {
            const live = MatchEngine.createLiveMatch({ id: "t" + speed, played: false, homeClubId: heim.id, awayClubId: gast.id },
                heim, gast, state.players, { modus: "fm" });
            live.speed = speed;
            const d = live.director;
            const a = { x: 50, y: 50 }, b = { x: 51, y: 50 };
            const laufJeSpielsekunde = d.getMotionTempo() / d.getClockRate();
            for (let i = 0; i < bilder; i++) d.separatePlayers([a, b], laufJeSpielsekunde / bilder);
            return Math.hypot(a.x - b.x, a.y - b.y);
        };
        const langsam = abstandNach(1, 8), schnell = abstandNach(4, 1);
        if (Math.abs(langsam - schnell) > 0.05) throw new Error(`Abstand nach einer Spielsekunde: ${langsam.toFixed(2)} gegen ${schnell.toFixed(2)}`);

        // Die Vorausschau des Deckers: gleiche Laufgeschwindigkeit in Spielzeit,
        // gleiches Ziel - auf jeder Stufe
        const ziel = (speed) => {
            const live = MatchEngine.createLiveMatch({ id: "v" + speed, played: false, homeClubId: heim.id, awayClubId: gast.id },
                heim, gast, state.players, { modus: "fm" });
            live.speed = speed;
            const d = live.director;
            const decker = live.players2D.find(p => p.team === "home" && p.group === "mid");
            const gegner = live.players2D.find(p => p.team === "away" && p.pos === "ST");
            // vx ist je Bildschirmsekunde: auf der schnelleren Stufe entsprechend größer
            gegner.vx = 4 * d.getMotionTempo(); gegner.vy = 0;
            d.findMarkingTarget = () => gegner;
            const z = d.deckungsZiel(decker, decker.x, decker.y, 1, { deckung: "raum" }, {}, live.ball);
            return z ? z.x : null;
        };
        const z1 = ziel(1), z4 = ziel(4);
        if (z1 !== null && z4 !== null && Math.abs(z1 - z4) > 0.5) throw new Error(`Deckungsziel ${z1.toFixed(1)} gegen ${z4.toFixed(1)}`);
    });

    test("Eigenschaften: Signaturen gehen an die Besten jeder Liga, höchstens fünf je Verein", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Sig" });
        if (state.signaturenVersion !== 1) throw new Error("Signaturen wurden nicht vergeben");
        const mit = state.players.filter(p => p.signatur);
        if (mit.length < 50) throw new Error(`Nur ${mit.length} Signaturen in der ganzen Welt`);
        mit.forEach(p => {
            if (!EigenschaftenEngine.SIGNATUREN[p.signatur]) throw new Error(`Unbekannte Signatur ${p.signatur}`);
        });
        const jeVerein = {};
        mit.forEach(p => { jeVerein[p.clubId] = (jeVerein[p.clubId] || 0) + 1; });
        const voll = Object.entries(jeVerein).filter(([, n]) => n > EigenschaftenEngine.SIGNATUR_JE_VEREIN);
        if (voll.length) throw new Error(`Zu viele Signaturen: ${voll.map(([c, n]) => c + " " + n).join(", ")}`);

        // Nur Spitzenspieler ihrer Liga, und es passt zum Profil: kein Torwart als Dribbelkünstler
        const liga = new Map(state.clubs.map(c => [c.id, c.leagueId]));
        const staerke = p => p.trueCurrentAbility ?? p.overall * 2;
        const grenzeJeLiga = {};
        state.clubs.forEach(c => {
            if (grenzeJeLiga[c.leagueId]) return;
            const alle = state.players.filter(p => liga.get(p.clubId) === c.leagueId).map(staerke).sort((a, b) => b - a);
            grenzeJeLiga[c.leagueId] = alle[Math.floor(alle.length * 0.2)] ?? 0;
        });
        const schwach = mit.filter(p => staerke(p) < grenzeJeLiga[liga.get(p.clubId)]);
        if (schwach.length > mit.length * 0.05) throw new Error(`${schwach.length} Signaturen an Spieler außerhalb der Spitze ihrer Liga`);
        const torwartFalsch = mit.filter(p => p.pos === "TW" && !["katze", "elfmetertoeter", "mentalitaet"].includes(p.signatur));
        if (torwartFalsch.length) throw new Error(`Torwart mit Feldspieler-Signatur: ${torwartFalsch[0].signatur}`);
        const feldFalsch = mit.filter(p => p.pos !== "TW" && ["katze", "elfmetertoeter"].includes(p.signatur));
        if (feldFalsch.length) throw new Error(`Feldspieler mit Torwart-Signatur: ${feldFalsch[0].signatur}`);

        // Nachreichen für alte Stände verteilt nicht doppelt
        if (EigenschaftenEngine.sicherstellen(state) !== 0) throw new Error("Signaturen wurden ein zweites Mal vergeben");
        const alt = { players: state.players.map(p => Object.assign({}, p, { signatur: undefined })), clubs: state.clubs };
        if (EigenschaftenEngine.sicherstellen(alt) < 50) throw new Error("Ein alter Spielstand bekommt keine Signaturen");
    });

    test("Eigenschaften: Signaturen und Eigenheiten wirken auf den Abschluss", () => {
        const w = (sig, traits, art, tw = null) => MatchEngine.eigenschaftsWirkung(
            { signatur: sig, traits: (traits || []).map(key => ({ key })) }, tw, art);
        if (!(w("eiskalt", [], "open").faktor >= 1.25)) throw new Error("Der Eiskalte trifft nicht öfter");
        if (!(w(null, ["knipser"], "open").faktor > 1.1)) throw new Error("Die Eigenheit Knipser wirkt nicht");
        if (w(null, [], "open").faktor !== 1) throw new Error("Ohne Eigenschaft muss alles beim Alten bleiben");
        if (!(w("zauberfuss", [], "freekick").faktor > 1.5)) throw new Error("Der Standardkünstler trifft den Freistoß nicht öfter");
        if (!(w("luftherrscher", [], "corner").faktor > 1.2)) throw new Error("Das Kopfballungeheuer wirkt nach Ecken nicht");
        const katze = w(null, [], "open", { signatur: "katze" });
        if (!(katze.faktor <= 0.8)) throw new Error("Die Katze im Tor hält nicht mehr");
        const killer = w(null, [], "penalty", { signatur: "elfmetertoeter" });
        if (!(killer.zuschlag < -0.1)) throw new Error("Der Elfmeterkiller hält nicht mehr Elfmeter");

        // Und in der Sofort-Simulation: derselbe Schütze, einmal mit Signatur
        const basis = { id: 1, overall: 75, shooting: 78, technique: 74, pace: 70, dribbling: 72, physical: 70, pos: "ST" };
        const tw = { id: 2, overall: 72, reflexes: 72, oneOnOne: 70, positioning: 70, handling: 70, pos: "TW" };
        const quote = (schuetze) => {
            let tore = 0;
            for (let i = 0; i < 6000; i++) {
                if (MatchEngine.resolveShotAttempt("through_ball", schuetze, tw, { attack: 70 }, { defense: 70 }).outcome === "goal") tore++;
            }
            return tore / 6000;
        };
        const ohne = quote(basis), mit = quote(Object.assign({}, basis, { signatur: "eiskalt" }));
        if (!(mit > ohne * 1.12)) throw new Error(`Torquote ohne ${(ohne * 100).toFixed(1)} %, mit Signatur ${(mit * 100).toFixed(1)} %`);
    });

    test("Eigenschaften: Wer gut abschließt, kommt öfter zum Abschluss", () => {
        const stark = { id: "a", pos: "ST", shooting: 86, technique: 80, overall: 80 };
        const schwach = { id: "b", pos: "LA", shooting: 55, technique: 60, overall: 64 };
        let a = 0;
        for (let i = 0; i < 3000; i++) if (MatchEngine.waehleSchuetze([stark, schwach], "through_ball").id === "a") a++;
        if (!(a / 3000 > 0.7)) throw new Error(`Der Torjäger schießt nur in ${(a / 30).toFixed(0)} % der Fälle`);
        // Nach Flanken zählt die Luft: Das Kopfballungeheuer setzt sich durch
        const kopf = { id: "k", pos: "ST", shooting: 70, physical: 70, overall: 72, signatur: "luftherrscher" };
        const klein = { id: "l", pos: "ST", shooting: 70, physical: 70, overall: 72 };
        let k = 0;
        for (let i = 0; i < 3000; i++) if (MatchEngine.waehleSchuetze([kopf, klein], "cross").id === "k") k++;
        if (!(k / 3000 > 0.58)) throw new Error(`Das Kopfballungeheuer kommt nur in ${(k / 30).toFixed(0)} % an den Ball`);
    });

    // ------------------------------------------------------------------
    // Realismus: KI-Trainer, mentale Werte, Heimvorteil
    // ------------------------------------------------------------------

    test("KI-Trainer: Der Gegner stellt bei Rückstand um und bringt eine Führung über die Zeit", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "KI" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const vorher = JSON.parse(JSON.stringify(gast.tactics));
        const stufen = ["very_defensive", "defensive", "balanced", "offensive", "very_offensive"];
        const live = MatchEngine.createLiveMatch({ id: "ki_trainer", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { userSide: "home", modus: "fm" });

        // Der eigene Verein wird nie von der KI umgestellt
        if (live._kiTrainerPunkte.home) throw new Error("Die KI stellt auch die Mannschaft des Spielers um");

        live.minute = 66; live.homeScore = 1; live.awayScore = 0;
        const r = live.kiTrainerTakt();
        const neu = stufen.indexOf(gast.tactics.mentality || "balanced");
        if (!r.length || !(neu > stufen.indexOf(vorher.mentality || "balanced"))) {
            throw new Error(`Bei Rückstand keine offensivere Einstellung: ${vorher.mentality} -> ${gast.tactics.mentality}`);
        }
        if (!r[0].text.includes(gast.name)) throw new Error("Die Umstellung des Gegners steht nicht im Ticker");

        // Spät knapp in Führung: absichern und auf Zeit spielen
        live.minute = 84; live.homeScore = 1; live.awayScore = 2;
        live._kiTrainerPunkte.away = [84];
        live.kiTrainerTakt();
        if (gast.tactics.zeitspiel !== "oft") throw new Error("Eine knappe Führung wird nicht über die Zeit gebracht");

        // Nach dem Abpfiff spielt der Gegner wieder mit seiner eigenen Taktik
        live.finishMatch();
        if (gast.tactics.mentality !== vorher.mentality || gast.tactics.zeitspiel !== vorher.zeitspiel) {
            throw new Error("Die Umstellungen des Gegners bleiben nach dem Spiel bestehen");
        }
    });

    test("KI-Trainer: In der Sofort-Simulation drückt, wer spät zurückliegt", () => {
        // Szenen in der Schlussphase: Wer zurückliegt, kommt öfter vor das Tor
        const state = GameState.createNewGame("muc", "normal", { name: "KI" });
        const heim = state.clubs.find(c => c.id === "sge");
        const gast = state.clubs.find(c => c.id === "wob");
        const szenen = (heimTore, gastTore) => {
            let heimSzenen = 0, alle = 0;
            for (let i = 0; i < 60; i++) {
                const tl = MatchEngine.generateTimeline(heim, gast, state.players,
                    { startMinute: 76, currentHomeScore: heimTore, currentAwayScore: gastTore });
                tl.filter(e => ["goal", "save", "shot_miss"].includes(e.type)).forEach(e => {
                    const angreifer = e.type === "save" ? (e.team === "home" ? "away" : "home") : e.team;
                    alle++; if (angreifer === "home") heimSzenen++;
                });
            }
            return heimSzenen / Math.max(1, alle);
        };
        const zurueck = szenen(0, 1), vorn = szenen(1, 0);
        if (!(zurueck > vorn + 0.05)) throw new Error(`Heimanteil an Abschlüssen: zurück ${(zurueck * 100).toFixed(0)} %, vorn ${(vorn * 100).toFixed(0)} %`);
    });

    test("Mentale Werte: Tagesform, Entscheidungen und Nerven hängen an der Persönlichkeit", () => {
        // Unbeständige Spieler haben gute und schlechte Tage
        const streuung = (bestaendigkeit) => {
            const p = { hiddenAttributes: { consistency: bestaendigkeit } };
            const werte = Array.from({ length: 3000 }, () => MatchEngine.tagesform(p));
            const m = werte.reduce((s, v) => s + v, 0) / werte.length;
            return Math.sqrt(werte.reduce((s, v) => s + (v - m) ** 2, 0) / werte.length);
        };
        const launisch = streuung(8), bestaendig = streuung(18);
        if (!(launisch > bestaendig * 2.5)) throw new Error(`Tagesform schwankt ${launisch.toFixed(3)} gegen ${bestaendig.toFixed(3)}`);

        const flow = new MatchFlowEngine({ fm: true });
        const klug = { vision: 88, positioning: 80, mental: { alter: 30, grosseSpiele: 17, bestaendigkeit: 16, professionalitaet: 16 } };
        const jung = { vision: 45, positioning: 50, mental: { alter: 18, grosseSpiele: 8, bestaendigkeit: 8, professionalitaet: 9 } };
        if (!(flow.entscheidungsRauschen(klug) < flow.entscheidungsRauschen(jung) - 0.2)) {
            throw new Error("Ein erfahrener Spielmacher entscheidet nicht sicherer als ein unerfahrener Spieler");
        }
        if (!(flow.nerven(klug) > flow.nerven(jung) + 4)) throw new Error("Die Nervenstärke hängt nicht an großen Spielen und Erfahrung");
        if (!(flow.konzentration(klug) > flow.konzentration(jung))) throw new Error("Die Konzentration hängt nicht an der Professionalität");

        // Vom Punkt trifft der Nervenstarke öfter
        const tw = { id: "tw", pos: "TW", team: "away", x: 96, y: 50, reflexes: 70, handling: 70, positioning: 70, oneOnOne: 70 };
        const quote = (schuetze) => {
            let tore = 0;
            for (let i = 0; i < 4000; i++) {
                if (flow.schussAusgang(schuetze, [tw], { elfmeter: true, xg: 0.76 }).ausgang === "goal") tore++;
            }
            return tore / 4000;
        };
        const basis = { id: "s", team: "home", pos: "ST", x: 85, y: 50, shooting: 75, technique: 72 };
        const kalt = quote({ ...basis, mental: klug.mental }), nervoes = quote({ ...basis, mental: jung.mental });
        if (!(kalt > nervoes + 0.03)) throw new Error(`Elfmeter: nervenstark ${(kalt * 100).toFixed(0)} %, nervös ${(nervoes * 100).toFixed(0)} %`);
    });

    test("Heimvorteil: Im Livespiel spielt die Heimelf mit dem Publikum im Rücken", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Heim" });
        const heim = state.clubs.find(c => c.id === "sge");
        const gast = state.clubs.find(c => c.id === "wob");
        const live = MatchEngine.createLiveMatch({ id: "heim", played: false, homeClubId: "sge", awayClubId: "wob" },
            heim, gast, state.players, { modus: "fm" });
        if (!(live.fmHeim > 1)) throw new Error("Kein Heimvorteil im Livespiel");
        if (Math.abs((live.fmHeim - 1) - (MatchEngine.heimvorteil(heim) - 1) * 0.5) > 1e-9) throw new Error("Der Heimvorteil im Livespiel folgt nicht dem Stadion");
        const neutral = MatchEngine.createLiveMatch({ id: "neutral", played: false, homeClubId: "sge", awayClubId: "wob", neutralerPlatz: true },
            heim, gast, state.players, { modus: "fm" });
        if (neutral.fmHeim !== 1) throw new Error("Auf neutralem Platz gibt es einen Heimvorteil");
    });

    test("Taktikbesprechung: Der Matchplan gilt nur für ein Spiel, deckt den Star und belohnt eine getroffene Schwäche", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Plan" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const match = { id: "plan_1", played: false, homeClubId: "muc", awayClubId: "dor" };

        const v = MatchplanEngine.vorschlag(state, match);
        if (!v || v.plaene.length !== Object.keys(MatchplanEngine.PLAENE).length) throw new Error("Die Besprechung bietet nicht alle Punkte an");
        if (v.ziele.some(z => z.pos === "TW")) throw new Error("Den Torwart kann man nicht in Manndeckung nehmen");

        // Mehr als zwei Punkte und Widersprüche fallen weg
        const plan = MatchplanEngine.festlegen(state, match, ["fruehStoeren", "tiefStehen", "fluegel"]);
        if (plan.punkte.length > MatchplanEngine.MAX_PUNKTE) throw new Error("Mehr als zwei Punkte im Matchplan");
        if (plan.punkte.includes("fruehStoeren") && plan.punkte.includes("tiefStehen")) throw new Error("Früh stören und tief stehen zugleich");

        // Mit Manndeckung: Der Gedeckte kommt seltener zum Abschluss
        const ziel = v.ziele[0];
        MatchplanEngine.festlegen(state, match, ["engDecken", "fruehStoeren"], ziel.id);
        const opt = MatchplanEngine.spielOptionen(state, match);
        if (!opt || opt.side !== "home") throw new Error("Der Plan gehört nicht zur eigenen Seite");
        if (opt.taktik.pressing !== "high") throw new Error("Früh stören setzt kein hohes Pressing");
        if (!opt.gedeckt[ziel.id]) throw new Error("Der Schlüsselspieler wird nicht gedeckt");
        const kandidaten = state.players.filter(p => gast.playerIds.includes(p.id) && p.pos !== "TW").slice(0, 5);
        const gedeckter = kandidaten[0];
        const zaehle = (gedeckt) => {
            let n = 0;
            for (let i = 0; i < 3000; i++) if (MatchEngine.waehleSchuetze(kandidaten, "open", null, gedeckt) === gedeckter) n++;
            return n;
        };
        const frei = zaehle(null);
        const eng = zaehle({ [gedeckter.id]: MatchplanEngine.ENG_GEDECKT });
        if (!(eng < frei * 0.75)) throw new Error(`Manndeckung wirkt nicht (${eng} gegen ${frei} Abschlüsse)`);

        // Die Anweisungen gelten nur während des Spiels
        const vorher = JSON.stringify(heim.tactics);
        MatchEngine.simulateFullMatch({ ...match }, heim, gast, state.players, { matchplan: opt });
        if (JSON.stringify(heim.tactics) !== vorher) throw new Error("Der Matchplan bleibt nach der Sofort-Simulation in der Taktik stehen");
        const live = MatchEngine.createLiveMatch({ ...match, id: "plan_live" }, heim, gast, state.players, { modus: "fm", matchplan: opt });
        if (heim.tactics.pressing !== "high") throw new Error("Im Livespiel greift der Matchplan nicht");
        if (live._vorSpiel.home.tactics.pressing === "high" && JSON.parse(vorher).pressing !== "high") {
            throw new Error("Die gewohnte Taktik wird nicht vor dem Plan gesichert");
        }
        heim.tactics = JSON.parse(vorher);

        // Ein Plan, der eine Schwäche trifft, bringt einen Bonus - einer ins Blaue nicht
        const report = { keyPlayers: [], weaknesses: [], strengths: [], attackRating: 85, midfieldRating: 80, defenseRating: 80 };
        if (!MatchplanEngine.passtZu("tiefStehen", report, gast).passt) throw new Error("Gegen einen starken Angriff passt tief stehen nicht");
        state.matchplan = { ...state.matchplan, treffer: 2 };
        if (!(MatchplanEngine.spielOptionen(state, match).bonus > 1)) throw new Error("Getroffene Schwächen bringen keinen Bonus");

        // Nach dem Spiel ist der Plan erledigt - und er hängt nur an seinem Spiel
        if (MatchplanEngine.fuerSpiel(state, { ...match, id: "anderes" })) throw new Error("Der Plan gilt auch für ein anderes Spiel");
        MatchplanEngine.abschliessen(state, match);
        if (MatchplanEngine.fuerSpiel(state, match)) throw new Error("Der Plan bleibt nach dem Spiel stehen");
    });

    test("Pressekonferenz: Fragen nach Lage, Blatt verstärkt, Kampfansage motiviert den Gegner, Versprechen wird abgerechnet", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Presse" });
        const club = state.clubs.find(c => c.id === "muc");
        // Das nächste Spiel wird zum Derby, und es läuft gerade gar nicht
        const runde = state.schedule.find(r => r.matches.some(m => (m.homeClubId === "muc" || m.awayClubId === "muc") && !m.played));
        const spiel = runde.matches.find(m => m.homeClubId === "muc" || m.awayClubId === "muc");
        spiel.isDerby = true;
        spiel.derbyTitle = "Testderby";
        club.form = ["W", "L", "L", "L"];
        state.currentMatchday = runde.matchday;

        const pk = ManagerEngine.buildPressConference(state);
        if (!pk || !pk.topicId || !pk.question || !pk.answers.length) throw new Error("Die erste Frage fehlt oben im Ergebnis");
        if (pk.fragen.length !== 3) throw new Error(`Vor einem Derby in der Krise sollten drei Fragen kommen, nicht ${pk.fragen.length}`);
        if (pk.fragen[0].topicId !== "derby") throw new Error(`Das Derby ist nicht das erste Thema (${pk.fragen[0].topicId})`);
        const themen = pk.fragen.map(f => f.topicId);
        if (!themen.includes("krise")) throw new Error("Drei Niederlagen in Folge sind kein Thema");
        if (themen.includes("form")) throw new Error("Nach der Krise wird zusätzlich noch nach der Form gefragt");
        if (new Set(pk.fragen.map(f => f.journalist)).size !== pk.fragen.length) throw new Error("Ein Journalist stellt mehrere Fragen");
        pk.fragen.forEach(f => { if (!f.medium || !f.medium.name) throw new Error(`Frage ${f.topicId} hat kein Blatt`); });
        const nochmal = ManagerEngine.buildPressConference(state);
        if (nochmal.fragen.map(f => f.topicId).join() !== themen.join()) throw new Error("Dieselbe Konferenz ändert beim erneuten Öffnen ihre Fragen");

        // Die Kampfansage: Der Boulevard verstärkt, der Gegner liest mit
        const gegnerId = pk.context.opponentId;
        const gegnerKader = state.players.filter(p => state.clubs.find(c => c.id === gegnerId).playerIds.includes(p.id));
        gegnerKader.forEach(p => { p.morale = 60; });
        const derby = pk.fragen[0];
        const res = ManagerEngine.answerPressConference(state, "derby", "kampfansage", { frage: derby, kontext: pk.context });
        if (!res.success) throw new Error(res.error);
        if (res.effects.mediaPressure !== Math.round(8 * ManagerEngine.PRESSE_MEDIEN.boulevard.faktor.mediaPressure)) {
            throw new Error("Der Boulevard verstärkt den Medienrummel nicht");
        }
        if (!res.gegnerMotiviert || gegnerKader.some(p => p.morale !== 66)) throw new Error("Die Kampfansage motiviert den Gegner nicht");
        if (!state.pressVersprechen || state.pressVersprechen.gegnerId !== gegnerId) throw new Error("Das Versprechen wird nicht vermerkt");
        if (!state.inbox.some(m => m.type === "press")) throw new Error("Die Schlagzeile landet nicht im Postfach");

        // Nach dem Spiel wird abgerechnet: verloren heißt gebrochen
        const heim = spiel.homeClubId === "muc";
        Object.assign(spiel, { played: true, homeGoals: heim ? 0 : 2, awayGoals: heim ? 2 : 0 });
        const fans = state.fanMood;
        const bilanz = ManagerEngine.versprechenPruefen(state, spiel);
        if (!bilanz || bilanz.gehalten) throw new Error("Das gebrochene Versprechen wird nicht abgerechnet");
        if (!(state.fanMood < fans)) throw new Error("Ein gebrochenes Versprechen kostet keine Fanstimmung");
        if (state.pressVersprechen) throw new Error("Das Versprechen bleibt nach dem Spiel offen");

        // Nach dem Abpfiff: Das gebrochene Versprechen ist Thema, dann nie wieder
        const nach = ManagerEngine.buildNachSpielPresse(state, spiel);
        if (!nach || !nach.nachSpiel || nach.fragen.length < 1 || nach.fragen.length > 2) throw new Error("Keine Pressekonferenz nach dem Spiel");
        if (!nach.fragen.some(f => f.topicId === "wortGehalten")) throw new Error("Das gebrochene Versprechen ist nach dem Spiel kein Thema");
        if (nach.fragen.some(f => f.topicId === "nachSieg")) throw new Error("Nach einer Niederlage wird nach dem Sieg gefragt");
        const antwort = ManagerEngine.answerPressConference(state, nach.fragen[0].topicId, nach.fragen[0].answers[0].key,
            { frage: nach.fragen[0], kontext: nach.context });
        if (!antwort.success) throw new Error(antwort.error);
        if (ManagerEngine.buildNachSpielPresse(state, spiel)) throw new Error("Die Konferenz nach dem Spiel lässt sich wiederholen");
        if (ManagerEngine.buildNachSpielPresse(state, { ...spiel, id: "test", freundschaftsspiel: true })) throw new Error("Nach einem Testspiel gibt es eine Pressekonferenz");
        ManagerEngine.NACH_SPIEL_TOPICS.forEach(topic => {
            if (topic.answers.length < 3) throw new Error(`Thema ${topic.id} hat zu wenige Antworten`);
        });
    });

    test("Verletzungen entstehen im Spiel: harte Fouls und Müdigkeit, Glasknochen öfter", () => {
        // Die Anfälligkeit zählt, das Alter auch
        const robust = { hiddenAttributes: { injuryProneness: 4 }, age: 24 };
        const glas = { hiddenAttributes: { injuryProneness: 17 }, age: 33 };
        if (!(MatchEngine.verletzungsAnfaelligkeit(glas) > MatchEngine.verletzungsAnfaelligkeit(robust) * 2)) {
            throw new Error("Ein verletzungsanfälliger Spieler verletzt sich nicht deutlich öfter");
        }
        // Wer ausgelaugt ist, zerrt sich eher
        if (!(MatchEngine.muskelRisiko(robust, 0.5) > MatchEngine.muskelRisiko(robust, 1) * 2.5)) {
            throw new Error("Müdigkeit erhöht das Muskelrisiko nicht");
        }
        // Je härter das Foul, desto eher bleibt der Gefoulte liegen
        const k = MatchEngine.KONTAKT_RISIKO;
        if (!(k.rot > k.gelb && k.gelb > k.foul)) throw new Error("Kontaktrisiko steigt nicht mit der Härte");

        // Sofort-Simulation: Verletzungen tragen ihre Art, Kontakt nur nach Fouls
        const state = GameState.createNewGame("muc", "normal", { name: "Arzt" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        let verletzt = 0;
        const arten = new Set();
        for (let i = 0; i < 160; i++) {
            const tl = MatchEngine.generateTimeline({ id: `verl_${i}`, homeClubId: "muc", awayClubId: "dor" }, heim, gast, state.players, {});
            tl.filter(e => e.type === "injury").forEach(e => {
                verletzt++;
                arten.add(e.verletzungsArt);
                const liste = MatchEngine.VERLETZUNGEN[e.verletzungsArt] || [];
                if (!liste.some(v => v.name === e.injuryName)) throw new Error(`${e.injuryName} passt nicht zur Art ${e.verletzungsArt}`);
            });
            // Im Livespiel (FM) kommen keine Verletzungen aus der Zeitleiste
            const rahmen = MatchEngine.generateTimeline({ id: `verl_fm_${i}`, homeClubId: "muc", awayClubId: "dor" }, heim, gast, state.players, { ohneVerletzungen: true });
            if (rahmen.some(e => e.type === "injury")) throw new Error("Trotz ohneVerletzungen steht eine Verletzung in der Zeitleiste");
        }
        const jeSpiel = verletzt / 160;
        if (jeSpiel < 0.2 || jeSpiel > 0.9) throw new Error(`Unrealistisch viele oder wenige Verletzungen: ${jeSpiel.toFixed(2)} je Spiel`);
        if (!arten.has("kontakt") || !arten.has("muskel")) throw new Error(`Nicht beide Arten kommen vor: ${[...arten].join(", ")}`);

        // Livespiel: Ein hartes Foul kann den Gefoulten verletzen - und der Gegner wechselt
        const live = MatchEngine.createLiveMatch({ id: "verl_live", played: false, homeClubId: "muc", awayClubId: "dor" },
            heim, gast, state.players, { modus: "fm", userSide: "home" });
        const opfer = live.players2D.find(p => p.team === "away" && p.pos !== "TW");
        let ev = null;
        for (let i = 0; i < 200 && !ev; i++) ev = live.pruefeKontaktVerletzung(opfer.id, "rot");
        if (!ev || ev.verletzungsArt !== "kontakt" || !ev.live) throw new Error("Ein Foul im Livespiel verletzt nie");
        live.processEvent({ ...ev, minute: 10 });
        if (!live.angemeldeteWechsel.some(w => w.side === "away" && w.outId === opfer.id)) {
            throw new Error("Der Gegner wechselt seinen verletzten Spieler nicht aus");
        }
    });

    test("Schiedsrichter: streng pfeift mehr und zeigt mehr Karten, Vorteil läuft weiter", () => {
        // Je Partie steht er fest
        const m = { id: "schiri_1", homeClubId: "muc", awayClubId: "dor" };
        const a = MatchEngine.schiedsrichterFuer(m);
        const b = MatchEngine.schiedsrichterFuer({ id: "schiri_1", homeClubId: "muc", awayClubId: "dor" });
        if (!a.name || a.name !== b.name || a.typ !== b.typ) throw new Error("Derselbe Spielplan bekommt einen anderen Schiedsrichter");
        const typen = new Set();
        for (let i = 0; i < 200; i++) typen.add(MatchEngine.schiedsrichterFuer({ id: `s_${i}`, homeClubId: "a", awayClubId: "b" }).typ);
        if (typen.size !== 3) throw new Error("Nicht alle Schiedsrichter-Typen kommen vor");

        // Im Mittel heben sie sich auf
        const T = MatchEngine.SCHIRI_TYPEN;
        const schnitt = (k) => 0.25 * T.streng[k] + 0.5 * T.normal[k] + 0.25 * T.grosszuegig[k];
        if (Math.abs(schnitt("pfeife") - 1) > 0.02 || Math.abs(schnitt("strenge") - 1) > 0.03) throw new Error("Die Schiedsrichter verschieben den Schnitt");

        // Ein strenger Schiedsrichter zeigt in denselben Partien mehr Karten
        const state = GameState.createNewGame("muc", "normal", { name: "Schiri" });
        const heim = state.clubs.find(c => c.id === "muc");
        const gast = state.clubs.find(c => c.id === "dor");
        const karten = (typ) => {
            let n = 0, vorteil = 0;
            for (let i = 0; i < 150; i++) {
                const tl = MatchEngine.generateTimeline({ id: `k_${typ}_${i}`, homeClubId: "muc", awayClubId: "dor", schiedsrichter: { typ, name: "Test", ...T[typ] } },
                    heim, gast, state.players, {});
                n += tl.filter(e => e.type === "yellow_card" || e.type === "red_card").length;
                vorteil += tl.filter(e => e.vorteil).length;
            }
            return { n, vorteil };
        };
        const streng = karten("streng"), gross = karten("grosszuegig");
        if (!(streng.n > gross.n * 1.3)) throw new Error(`Streng ${streng.n} Karten, großzügig ${gross.n} - kein Unterschied`);
        if (!(gross.vorteil > streng.vorteil)) throw new Error(`Der Großzügige gibt nicht öfter Vorteil (${gross.vorteil} gegen ${streng.vorteil})`);
        // Ein Foul mit Vorteil gibt keinen Freistoß
        const tl = MatchEngine.generateTimeline({ id: "vorteil_x", homeClubId: "muc", awayClubId: "dor", schiedsrichter: { typ: "grosszuegig", name: "T", ...T.grosszuegig } },
            heim, gast, state.players, {});
        tl.filter(e => e.vorteil && e.type === "foul").forEach(e => {
            if (e.direkterFreistoss || e.outcome !== "vorteil") throw new Error("Ein Foul mit Vorteil wird als Freistoß behandelt");
        });
    });

    test("Taktische Vertrautheit: Eine neue Formation kostet Stärke und wird eingeschliffen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Taktiker" });
        const club = state.clubs.find(c => c.id === "muc");
        // Ohne Aufzeichnung (KI-Vereine, alte Spielstände) sitzt alles
        if (TacticsEngine.vertrautheit(club) !== 1) throw new Error("Ohne Aufzeichnung ist die Mannschaft nicht voll eingespielt");
        TacticsEngine.vertrautheitStarten(club);
        if (TacticsEngine.vertrautheit(club) !== 1) throw new Error("Die gewohnte Taktik sitzt nicht");

        // Neue Formation und neue Spielweise
        const alteFormation = club.formation;
        club.formation = alteFormation === "4-3-3" ? "3-5-2" : "4-3-3";
        club.tactics = TacticsEngine.normalisiere({ ...club.tactics, pressing: "high", tempo: "fast", passing: "short" });
        const neu = TacticsEngine.vertrautheit(club);
        if (!(neu < 0.8)) throw new Error(`Neue Formation und Spielweise sitzen sofort (${neu})`);
        if (!(TacticsEngine.vertrautheitsFaktor(club) < 0.985)) throw new Error("Eine fremde Taktik kostet keine Stärke");

        // Spiele und Training schleifen ein
        for (let i = 0; i < 12; i++) TacticsEngine.vertrautheitUeben(club, 0.12);
        const spaeter = TacticsEngine.vertrautheit(club);
        if (!(spaeter > 0.95)) throw new Error(`Nach zwölf Spielen sitzt die Taktik nicht (${spaeter})`);
        if (club.chemistry && club.chemistry.tacticalFamiliarity !== Math.round(spaeter * 100)) throw new Error("Der Vereinswert zeigt etwas anderes an");
        // Die alte Formation ist nicht vergessen, aber nicht mehr ganz frisch
        const v = club.taktikVertrautheit.formationen[alteFormation];
        if (!(v < 1 && v >= TacticsEngine.VERTRAUT_NEU)) throw new Error("Die alte Formation verblasst nicht");

        // Die Sofort-Simulation rechnet mit dem Faktor
        club.formation = alteFormation === "4-3-3" ? "4-4-2" : "4-3-3";
        const f = TacticsEngine.vertrautheitsFaktor(club);
        if (!(f < 1)) throw new Error("Die neue Formation wirkt nicht");
    });

    test("Schwacher Fuß und Körpergröße: Abschluss und Kopfballduell", () => {
        // Größe: fest je Spieler, Torhüter und Innenverteidiger größer als Flügel
        const tw = { id: "g1", pos: "TW", physical: 70 }, aussen = { id: "g2", pos: "RA", physical: 70 };
        if (MatchEngine.koerpergroesse(tw) !== MatchEngine.koerpergroesse({ ...tw })) throw new Error("Die Größe ist nicht fest");
        let summeTw = 0, summeRa = 0;
        for (let i = 0; i < 200; i++) {
            summeTw += MatchEngine.koerpergroesse({ id: `t${i}`, pos: "TW", physical: 70 });
            summeRa += MatchEngine.koerpergroesse({ id: `r${i}`, pos: "RA", physical: 70 });
        }
        if (!(summeTw / 200 > summeRa / 200 + 8)) throw new Error("Torhüter sind nicht größer als Flügelspieler");
        if (MatchEngine.koerpergroesse({ groesse: 201, pos: "RA" }) !== 201) throw new Error("Eine gespeicherte Größe wird überschrieben");

        // Im Kopfballduell zählt die Größe
        const flow = new MatchFlowEngine({ fm: true });
        const basis = { physical: 70, positioning: 70, technique: 70, pace: 70, defense: 70, eig: {} };
        if (!(flow.kopfballWert({ ...basis, groesse: 195 }) > flow.kopfballWert({ ...basis, groesse: 172 }) + 10)) {
            throw new Error("Ein großer Spieler gewinnt kein Kopfballduell öfter");
        }
        // Bei Flanken kommt der Große öfter an den Ball
        const kandidaten = [{ id: "k1", pos: "ST", groesse: 196, shooting: 70 }, { id: "k2", pos: "ST", groesse: 170, shooting: 70 }];
        let gross = 0;
        for (let i = 0; i < 2000; i++) if (MatchEngine.waehleSchuetze(kandidaten, "cross").id === "k1") gross++;
        if (!(gross > 1200)) throw new Error(`Der Große kommt bei Flanken nicht öfter zum Abschluss (${gross} von 2000)`);

        // Schwacher Fuß: Beidfüßige nie, der Rechtsfuß links neben dem Tor öfter
        const g = new MatchFlowEngine({ fm: true, attackDir: () => 1 });
        const zaehle = (spieler) => {
            let n = 0;
            for (let i = 0; i < 3000; i++) if (g.schwacherFuss(spieler)) n++;
            return n;
        };
        if (zaehle({ team: "home", x: 88, y: 30, foot: "beidfüßig" }) !== 0) throw new Error("Ein Beidfüßiger hat einen schwachen Fuß");
        const links = zaehle({ team: "home", x: 92, y: 36, foot: "rechts" });
        const rechts = zaehle({ team: "home", x: 92, y: 64, foot: "rechts" });
        if (!(links > rechts * 1.4)) throw new Error(`Der Rechtsfuß links neben dem Tor nimmt nicht öfter den schwachen Fuß (${links} gegen ${rechts})`);
        // Im Mittel gleicht es sich aus: kein Torverlust über alle Abschlüsse
        const c = MatchEngine.SCHWACHER_FUSS;
        const mittel = (c.basis + 0.04) * c.faktorSchwach + (1 - c.basis - 0.04) * c.faktorStark;
        if (Math.abs(mittel - 1) > 0.02) throw new Error(`Der schwache Fuß verschiebt die Torquote (${mittel.toFixed(3)})`);
    });

    test("Standardvarianten: Ecken an die Pfosten, kurz, Raum- oder Manndeckung", () => {
        // Die Anweisungen gibt es im Taktik-Reiter
        ["ecken", "standardDeckung"].forEach(k => {
            if (!TacticsEngine.ANWEISUNGEN.some(a => a.key === k)) throw new Error(`Anweisung ${k} fehlt`);
        });
        const t = TacticsEngine.normalisiere({});
        if (t.ecken !== "gemischt" || t.standardDeckung !== "raum") throw new Error("Falsche Grundeinstellung der Standards");
        // Gemischt heißt: alle Varianten kommen vor
        const varianten = new Set();
        for (let i = 0; i < 300; i++) varianten.add(TacticsEngine.eckenVariante("gemischt"));
        if (varianten.size !== 3) throw new Error(`Gemischte Ecken bringen nicht alle Varianten: ${[...varianten].join(", ")}`);
        if (TacticsEngine.eckenVariante("kurz") !== "kurz") throw new Error("Eine feste Variante wird nicht gespielt");

        // An den zweiten Pfosten lohnt es sich nur mit Riesen; kurz ist von der Größe unabhängiger
        const riesen = [196, 194, 193].map((g, i) => ({ id: `r${i}`, pos: "ST", groesse: g }));
        const zwerge = [172, 173, 171].map((g, i) => ({ id: `z${i}`, pos: "ST", groesse: g }));
        const abwehr = [186, 185, 184].map((g, i) => ({ id: `v${i}`, pos: "IV", groesse: g }));
        if (!(MatchEngine.eckenVorteil("zweiterPfosten", "raum", riesen, abwehr) > MatchEngine.eckenVorteil("kurz", "raum", riesen, abwehr))) {
            throw new Error("Mit Riesen lohnt der zweite Pfosten nicht");
        }
        if (!(MatchEngine.eckenVorteil("kurz", "raum", zwerge, abwehr) > MatchEngine.eckenVorteil("zweiterPfosten", "raum", zwerge, abwehr))) {
            throw new Error("Ohne große Spieler ist die kurze Ecke nicht besser");
        }
        // Raumdeckung schützt den ersten Pfosten
        if (!(MatchEngine.eckenVorteil("ersterPfosten", "raum", riesen, abwehr) < MatchEngine.eckenVorteil("ersterPfosten", "mann", riesen, abwehr))) {
            throw new Error("Raumdeckung schützt den ersten Pfosten nicht");
        }
    });

    // Der Torwart bleibt auf der Linie, wenn der Gegner kommt - und rückt
    // heraus, wenn das Spiel weit weg ist. Vorher war es umgekehrt.
    test("Torwart: Kommt der Gegner, steht er auf der Linie zwischen den Pfosten", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const heim = state.clubs.find(c => c.id === "sge");
        const gast = state.clubs.find(c => c.id === "wob");
        const live = MatchEngine.createLiveMatch({ id: "tw_linie", played: false, homeClubId: "sge", awayClubId: "wob" },
            heim, gast, state.players, { modus: "fm" });
        const d = live.director;
        live.speed = 4;
        const nah = [], fern = [];
        let seitlichMax = 0, q = 0;
        while (!live.isFinished && q++ < 160000) {
            live.advanceRealTime(16);
            live.updateBallAndPlayers(16);
            if (q % 8 || d.mode !== "ambient" || d.deadBall) continue;
            (live.players2D || []).filter(p => p.pos === "TW" && d.carrierId !== p.id).forEach(tw => {
                const torX = d.ownGoalX(tw.team);
                const vonLinie = Math.abs(tw.x - torX);
                if (vonLinie > 40) return;
                const ball = Math.abs(live.ball.x - torX);
                if (ball < 20) {
                    nah.push(vonLinie);
                    seitlichMax = Math.max(seitlichMax, Math.abs(tw.y - 50));
                } else if (ball > 60) fern.push(vonLinie);
            });
        }
        const mw = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
        if (nah.length < 50 || fern.length < 50) throw new Error(`Zu wenige Proben: ${nah.length}/${fern.length}`);
        // Gemessen vorher: 5,1 Einheiten vor der Linie, seitlich bis 16
        if (mw(nah) > 3) throw new Error(`Torwart steht ${mw(nah).toFixed(1)} vor der Linie, wenn der Gegner kommt`);
        if (seitlichMax > 9) throw new Error(`Torwart läuft ${seitlichMax.toFixed(1)} zur Seite - weit neben den Pfosten`);
        if (mw(fern) <= mw(nah) + 2) {
            throw new Error(`Bei Ballbesitz weit vorn rückt der Torwart nicht heraus (${mw(fern).toFixed(1)} gegen ${mw(nah).toFixed(1)})`);
        }
    });

    test("Einzelgespräche: Lob, Kritik nach Charakter, Spielzeit-Versprechen und Wechselwunsch", () => {
        const { PlayerTalkEngine } = require('./js/engine/playerTalkEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const kader = state.players.filter(p => club.playerIds.includes(p.id));
        const [a, b, c, d] = kader;
        const halb = () => 0.5;

        // Lob für einen Spieler in Form kommt an - und gleich danach ist
        // kein zweites Gespräch möglich
        a.form = 7.6; a.morale = 70;
        let r = PlayerTalkEngine.fuehren(state, a.id, "loben", halb);
        if (!r.success || a.morale <= 70) throw new Error("Lob für einen starken Spieler hebt die Moral nicht");
        r = PlayerTalkEngine.fuehren(state, a.id, "kritisieren", halb);
        if (r.success) throw new Error("Zwei Gespräche am selben Tag sollten nicht gehen");
        state.currentDayIndex = (state.currentDayIndex || 0) + PlayerTalkEngine.ABKUEHLUNG;
        r = PlayerTalkEngine.fuehren(state, a.id, "kritisieren", halb);
        if (!r.success || a.morale > r.moralVorher - 8) throw new Error(`Kritik an einem starken Spieler kränkt nicht genug (${r.moralVorher} → ${a.morale})`);

        // Kritik bei schwacher Form: Der Profi nimmt sie als Ansporn, der Hitzkopf ist beleidigt
        b.form = 6.1; b.morale = 70;
        b.hiddenAttributes = { ...b.hiddenAttributes, professionalism: 19, ambition: 16, temperament: 4 };
        r = PlayerTalkEngine.fuehren(state, b.id, "kritisieren", halb);
        if (!b.ansporn || b.morale < 65) throw new Error("Der Profi nimmt Kritik nicht als Ansporn");
        c.form = 6.1; c.morale = 70;
        c.hiddenAttributes = { ...c.hiddenAttributes, professionalism: 5, ambition: 8, temperament: 19 };
        r = PlayerTalkEngine.fuehren(state, c.id, "kritisieren", halb);
        if (c.ansporn || c.morale > 62) throw new Error("Der Hitzkopf sollte Kritik übelnehmen");

        // Spielzeit versprochen - und nicht gehalten
        d.happiness = { overall: 55, playingTime: 45, contract: 70, teamPerformance: 70 };
        d.morale = 70;
        r = PlayerTalkEngine.fuehren(state, d.id, "spielzeit", halb);
        if (!r.success || !d.versprechen) throw new Error("Versprechen wurde nicht festgehalten");
        if (!PlayerTalkEngine.schreibtisch(state).some(i => i.playerId === d.id)) throw new Error("Versprechen fehlt auf dem Schreibtisch");
        const moralMitVersprechen = d.morale;
        for (let i = 0; i < PlayerTalkEngine.VERSPRECHEN_SPIELE; i++) {
            PlayerTalkEngine.nachSpiel(state, { played: true, playerRatings: [{ playerId: d.id, minutes: i === 0 ? 90 : 0 }] });
        }
        if (d.versprechen) throw new Error("Das Versprechen wurde nach der Frist nicht abgerechnet");
        if (d.morale >= moralMitVersprechen - 10) throw new Error("Ein gebrochenes Versprechen trifft den Spieler nicht");
        if (!d.wechselwunsch) throw new Error("Nach einem gebrochenen Versprechen sollte er weg wollen");
        const posten = ManagerEngine.getAttentionItems(state).find(i => i.playerId === d.id);
        if (!posten || !/wechseln/.test(posten.title)) throw new Error("Der Wechselwunsch steht nicht auf dem Schreibtisch");
        state.currentDayIndex += PlayerTalkEngine.ABKUEHLUNG;
        r = PlayerTalkEngine.fuehren(state, d.id, "wechsel_annehmen", halb);
        if (!r.success || !d.transferListed) throw new Error("Akzeptierter Wechselwunsch setzt ihn nicht auf die Transferliste");

        // Ein gehaltenes Versprechen stärkt das Vertrauen
        const e = kader[4];
        e.happiness = { overall: 55, playingTime: 45, contract: 70, teamPerformance: 70 };
        PlayerTalkEngine.fuehren(state, e.id, "spielzeit", halb);
        for (let i = 0; i < 3; i++) PlayerTalkEngine.nachSpiel(state, { played: true, playerRatings: [{ playerId: e.id, minutes: 75 }] });
        if (e.versprechen || (e.vertrauen ?? 50) <= 50) throw new Error("Gehaltenes Versprechen stärkt das Vertrauen nicht");

        // Ein Gesprächswunsch, um den sich niemand kümmert, kränkt; anhaltender
        // Frust wird zum Wechselwunsch
        const f = kader[5];
        f.morale = 70;
        f.gespraechswunsch = { seit: PlayerTalkEngine.stempel(state), grund: "spielzeit" };
        f.happiness = { overall: 30, playingTime: 20, contract: 50, teamPerformance: 30 };
        for (let t = 0; t < PlayerTalkEngine.FRUST_TAGE; t++) {
            state.currentDayIndex++;
            PlayerTalkEngine.taeglich(state, () => 0.99);
        }
        if (f.gespraechswunsch || f.morale >= 70) throw new Error("Ein übergangener Gesprächswunsch bleibt folgenlos");
        if (!f.wechselwunsch) throw new Error("Anhaltender Frust führt nicht zum Wechselwunsch");
    });

    test("Entwicklungsplan: Spielpraxis, eigener Schwerpunkt, Umschulung und Mentor", () => {
        const { DevelopmentPlanEngine: Plan } = require('./js/engine/developmentPlanEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const kader = state.players.filter(p => club.playerIds.includes(p.id));

        // Spielpraxis: Ein Spiel hebt sie bei den Startern, senkt sie bei den Zuschauern
        const gegner = state.clubs.find(c => c.id !== club.id && c.leagueId === club.leagueId);
        const partie = { id: "praxis", played: false, homeClubId: club.id, awayClubId: gegner.id };
        MatchEngine.simulateFullMatch(partie, club, gegner, state.players);
        const starter = state.players.find(p => p.id === club.lineup[0]);
        const zuschauer = kader.find(p => !club.lineup.includes(p.id) && !club.bench.includes(p.id));
        if (!(starter.spielpraxis > 0.5)) throw new Error(`Starter ohne Spielpraxis: ${starter.spielpraxis}`);
        if (zuschauer && !(zuschauer.spielpraxis < 0.5)) throw new Error(`Zuschauer gewinnt Spielpraxis: ${zuschauer.spielpraxis}`);
        const jung = { age: 19 };
        if (!(Plan.praxisFaktor({ ...jung, spielpraxis: 0.95 }) > 1.2 && Plan.praxisFaktor({ ...jung, spielpraxis: 0.05 }) < 0.85)) {
            throw new Error("Spielpraxis wirkt bei Talenten nicht auf die Entwicklung");
        }
        if (Plan.praxisFaktor({ age: 32, spielpraxis: 1 }) !== 1) throw new Error("Bei Älteren sollte die Spielpraxis nicht zählen");

        // Eigener Schwerpunkt: Wächst er, wachsen diese Werte mit
        const st = kader.find(p => p.pos === "ST");
        const vorher = { shooting: st.shooting, technique: st.technique };
        if (!Plan.setzeSchwerpunkt(state, st.id, "abschluss").success) throw new Error("Schwerpunkt lässt sich nicht setzen");
        if (Plan.setzeSchwerpunkt(state, st.id, "reflexe").success) throw new Error("Ein Feldspieler sollte keinen Torwart-Schwerpunkt bekommen");
        Plan.nachEinheit(state, st, { gewachsen: true }, () => 0.5);
        if (st.shooting !== Math.min(99, vorher.shooting + 1) || st.technique !== Math.min(99, vorher.technique + 1)) {
            throw new Error("Der Schwerpunkt lenkt das Wachstum nicht");
        }

        // Umschulung: Einheit für Einheit auf eine neue Position
        const ziel = Plan.umschulungsZiele(st).find(pos => pos === "ZM") || Plan.umschulungsZiele(st)[0];
        if (!Plan.setzeUmschulung(state, st.id, ziel).success) throw new Error("Umschulung lässt sich nicht setzen");
        let n = 0;
        while (st.umschulung && n++ < 600) Plan.nachEinheit(state, st, {}, () => 0.5);
        if (st.umschulung || !(st.positions || []).includes(ziel)) throw new Error(`Umschulung auf ${ziel} kommt nicht an (${n} Einheiten)`);
        if (n < 15) throw new Error(`Umschulung geht zu schnell (${n} Einheiten)`);

        // Mentor: Einstellung färbt ab, eine Eigenheit kann wandern
        const talent = kader.find(p => (p.age || 30) <= 23) || kader[kader.length - 1];
        talent.age = 19;
        talent.hiddenAttributes = { ...talent.hiddenAttributes, professionalism: 5 };
        talent.traits = [];
        talent.shooting = 80; talent.technique = 76;
        const mentor = kader.find(p => p.id !== talent.id && (p.age || 0) >= 28) || kader[0];
        mentor.age = Math.max(mentor.age, 28);
        mentor.hiddenAttributes = { ...mentor.hiddenAttributes, professionalism: 19 };
        mentor.traits = [{ key: "distanzschuss", text: "Sucht den Abschluss aus der Distanz." }];
        const zuJung = kader.find(p => p.id !== talent.id && p.id !== mentor.id);
        const alterVorher = zuJung.age;
        zuJung.age = 22;
        if (Plan.setzeMentor(state, talent.id, zuJung.id).success) throw new Error("Ein 22-Jähriger sollte kein Mentor sein");
        zuJung.age = alterVorher;
        if (!Plan.setzeMentor(state, talent.id, mentor.id).success) throw new Error("Mentor lässt sich nicht setzen");
        if (!(Plan.entwicklungsFaktor(state, talent) > Plan.praxisFaktor(talent))) throw new Error("Ein guter Mentor beschleunigt die Entwicklung nicht");
        for (let i = 0; i < 80; i++) Plan.nachEinheit(state, talent, {}, () => 0.9);
        if (!(talent.hiddenAttributes.professionalism > 9)) throw new Error(`Die Einstellung des Mentors färbt nicht ab (${talent.hiddenAttributes.professionalism})`);
        Plan.nachEinheit(state, talent, {}, () => 0);
        if (!talent.traits.some(t => t.key === "distanzschuss")) throw new Error("Die Eigenheit des Mentors wird nicht übernommen");
        if (!Plan.uebersicht(state).some(e => e.player.id === talent.id && e.mentor === mentor.name)) throw new Error("Übersicht zeigt den Mentor nicht");
    });

    test("Leihen: verleihen mit Gehaltsanteil, ausleihen vom Leihmarkt, Rückkehr zum Saisonende", () => {
        const { LoanEngine } = require('./js/engine/loanEngine.js');
        const { FinanceEngine } = require('./js/engine/financeEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const kader = () => state.players.filter(p => club.playerIds.includes(p.id));

        // Ein Ersatzspieler ohne Einsätze wird verliehen
        const kandidat = kader().filter(p => !club.lineup.includes(p.id) && p.pos !== "TW")
            .sort((a, b) => (a.overall || 0) - (b.overall || 0))[0];
        kandidat.contractYears = 2;
        const angebote = LoanEngine.interessenten(state, kandidat.id);
        if (!angebote.length) throw new Error("Niemand will einen Ersatzspieler ausleihen");
        const angebot = angebote[0];
        const leihverein = state.clubs.find(c => c.id === angebot.clubId);
        if ((leihverein.level || 1) < (club.level || 1)) throw new Error("Verliehen wird nicht in eine höhere Liga");
        const res = LoanEngine.verleihen(state, kandidat.id, angebot.clubId);
        if (!res.success) throw new Error(res.error);
        if (kandidat.clubId !== leihverein.id || club.playerIds.includes(kandidat.id) || !leihverein.playerIds.includes(kandidat.id)) {
            throw new Error("Der Spieler ist nicht beim Leihverein angekommen");
        }
        if (LoanEngine.verlieheneVon(state, club.id)[0] !== kandidat) throw new Error("Verliehene Spieler werden nicht gefunden");
        // Das Gehalt teilen sich beide Vereine
        const lohn = kandidat.wage;
        if (LoanEngine.lohnAnteilFuer(kandidat, leihverein.id) + LoanEngine.lohnAnteilFuer(kandidat, club.id) !== Math.round(lohn * angebot.lohnAnteil) + Math.round(lohn * (1 - angebot.lohnAnteil))) {
            throw new Error("Gehaltsanteile gehen nicht auf");
        }
        const summe = FinanceEngine.getFinanceSummary(state, club.id);
        const ohneLeihe = kader().reduce((a, p) => a + (p.wage || 0), 0);
        if (Math.abs(summe.weeklyWages - (ohneLeihe + lohn * (1 - angebot.lohnAnteil))) > 1) {
            throw new Error(`Der Stammverein zahlt seinen Anteil nicht (${summe.weeklyWages} statt ${ohneLeihe + lohn * (1 - angebot.lohnAnteil)})`);
        }
        // Verkaufen lässt sich ein verliehener Spieler nicht
        const kaeufer = state.clubs.find(c => c.id !== club.id && c.id !== leihverein.id);
        if (TransferEngine.executeTransfer(state, kandidat.id, kaeufer.id, 1000000, kandidat.wage, 3)) {
            throw new Error("Ein verliehener Spieler wurde verkauft");
        }

        // Ausleihen vom Leihmarkt: unter der Forderung geht nichts
        const markt = LoanEngine.leihmarkt(state);
        if (!markt.length) throw new Error("Der Leihmarkt ist leer");
        const ziel = markt.find(e => e.gebuehr === 0) || markt[0];
        club.balance = Math.max(club.balance || 0, (ziel.gebuehr || 0) + 1000000);
        const zuWenig = LoanEngine.ausleihen(state, ziel.playerId, Math.max(0, ziel.lohnAnteil - 0.2));
        if (zuWenig.success) throw new Error("Der Stammverein akzeptiert zu wenig Gehaltsübernahme");
        const geliehen = LoanEngine.ausleihen(state, ziel.playerId);
        if (!geliehen.success) throw new Error(geliehen.error);
        const leihspieler = state.players.find(p => String(p.id) === String(ziel.playerId));
        if (leihspieler.clubId !== club.id || !club.playerIds.includes(leihspieler.id)) throw new Error("Der Leihspieler ist nicht im Kader");

        // Monatsbericht und Rückkehr zum Saisonende
        LoanEngine.monatlich(state);
        if (!state.inbox.some(m => m.subject === "Leihbericht")) throw new Error("Kein Leihbericht im Postfach");
        const zurueck = LoanEngine.saisonende(state);
        if (zurueck.length < 2) throw new Error("Nicht alle Leihspieler sind zurückgekehrt");
        if (kandidat.clubId !== club.id || !club.playerIds.includes(kandidat.id) || kandidat.leihe) throw new Error("Der verliehene Spieler ist nicht zurück");
        if (leihspieler.clubId === club.id || club.playerIds.includes(leihspieler.id)) throw new Error("Der Leihspieler ist nicht zu seinem Verein zurück");
    });

    test("Länderspielpause: Nationalspieler reisen ab, spielen zweimal und kommen müde zurück", () => {
        const { NationalTeamEngine } = require('./js/engine/nationalTeamEngine.js');
        const { TrainingEngine } = require('./js/engine/trainingEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);

        // Vier Pausen im Kalender, je drei Länderspieltage, kein Ligaspiel dazwischen
        const tage = state.calendar.filter(d => d.type === "international");
        if (tage.length !== 12) throw new Error(`${tage.length} Länderspieltage im Kalender`);
        if (tage.some(d => !d.matchday)) throw new Error("Pausentage kennen ihre Woche nicht");
        const ersteAbreise = state.calendar.findIndex(d => d.laenderspiel === "abreise");
        const ersteRueckkehr = state.calendar.findIndex(d => d.laenderspiel === "rueckkehr");
        if (state.calendar.slice(ersteAbreise, ersteRueckkehr).some(d => d.type === "matchday")) throw new Error("Ligaspiel in der Länderspielpause");

        // Weltrangliste: die großen Fußballnationen oben
        const rang = NationalTeamEngine.rangliste(state);
        if (rang.length < 8) throw new Error(`Nur ${rang.length} Nationen treten an`);
        if (!rang.slice(0, 6).some(n => ["Deutschland", "Frankreich", "Spanien", "England", "Brasilien", "Italien"].includes(n.name))) {
            throw new Error(`Spitze der Rangliste: ${rang.slice(0, 6).map(n => n.name).join(", ")}`);
        }

        // Abreise: Die Bayern stellen Nationalspieler ab, die fehlen im Training
        const abreise = NationalTeamEngine.tag(state, "abreise");
        const weg = state.players.filter(p => p.abgestellt && club.playerIds.includes(p.id));
        if (weg.length < 3 || abreise.eigene.length !== weg.length) throw new Error(`${weg.length} Bayern abgestellt`);
        if (!state.inbox.some(m => /abgestellt/.test(m.subject))) throw new Error("Keine Nachricht zur Abstellung");
        const vorher = new Map(weg.map(p => [p.id, p.trainingLog?.sessions || 0]));
        TrainingEngine.processDailyTraining(state, "training");
        if (weg.some(p => (p.trainingLog?.sessions || 0) !== vorher.get(p.id))) throw new Error("Abgestellte trainieren im Verein mit");

        // Zwei Länderspiele: Länderspiele zählen, Vereinsstatistik bleibt
        const saisonSpiele = new Map(weg.map(p => [p.id, p.stats.matches]));
        const fitness = new Map(weg.map(p => [p.id, p.fitness]));
        const spiele = NationalTeamEngine.tag(state, "spiel", () => 0.5);
        if (spiele.length < 4) throw new Error(`${spiele.length} Länderspiele`);
        const zurueck = NationalTeamEngine.tag(state, "rueckkehr", () => 0.5);
        if (!weg.some(p => p.laenderspiele >= 2)) throw new Error("Länderspiele werden nicht gezählt");
        if (weg.some(p => p.stats.matches !== saisonSpiele.get(p.id))) throw new Error("Länderspiele landen in der Vereinsstatistik");
        if (!weg.some(p => p.fitness < fitness.get(p.id))) throw new Error("Niemand kommt müde zurück");
        if (state.players.some(p => p.abgestellt)) throw new Error("Nach der Rückkehr ist noch jemand abgestellt");
        if (!state.inbox.some(m => /Zurück von den Nationalmannschaften/.test(m.subject))) throw new Error("Kein Rückkehrbericht");
        if (zurueck.spiel.length !== spiele.length) throw new Error("Das zweite Länderspiel fehlt");
        const tore = state.players.reduce((a, p) => a + (p.laenderspielTore || 0), 0);
        const gefallen = spiele.concat(zurueck.spiel).reduce((a, s) => a + s.tore[0] + s.tore[1], 0);
        if (tore !== gefallen) throw new Error(`${gefallen} Tore gefallen, ${tore} Torschützen gezählt`);
        const akte = NationalTeamEngine.akte(weg[0]);
        if (!akte || !/Länderspiel/.test(akte.text)) throw new Error("Spielerakte kennt die Länderspiele nicht");

        // Der Kalender spielt die Pause durch
        state.calendar.forEach(d => d.completed = false);
        state.currentDayIndex = ersteAbreise;
        for (let i = ersteAbreise; i <= ersteRueckkehr; i++) CalendarEngine.advanceOneDay(state);
        if (state.players.some(p => p.abgestellt)) throw new Error("Kalender holt die Abgestellten nicht zurück");
    });

    test("Trainerprofil: Typ, Lizenz mit Lehrgang, Wirkung auf Ansprache, Talente, Berater und Angebote", () => {
        const { TrainerProfilEngine: T } = require('./js/engine/trainerProfilEngine.js');
        const { CareerEngine } = require('./js/engine/careerEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer", trainerTyp: "ausbilder" });
        const p = T.profil(state);
        if (p.typ !== "ausbilder" || p.werte.jugend !== 16) throw new Error(`Typ ${p.typ}, Jugendarbeit ${p.werte.jugend}`);
        if (p.lizenz !== "pro") throw new Error("Ein Bundesligatrainer startet ohne Pro-Lizenz");
        if (!(T.faktor(state, "jugend", 0.2) > 1.05)) throw new Error("Jugendarbeit wirkt nicht");

        // Ein Oberligatrainer hat die B-Lizenz und bekommt keine Angebote aus höheren Ligen
        const klein = GameState.createNewGame("oln_vfb", "normal", { name: "Trainer" });
        const pk = T.profil(klein);
        if (pk.lizenz !== "b") throw new Error(`Oberligatrainer mit ${pk.lizenz}`);
        if (T.darfTrainieren(pk, 3) || !T.darfTrainieren(pk, 6)) throw new Error("Lizenzgrenzen stimmen nicht");
        const angebote = CareerEngine.sucheAngebote(klein, 90);
        if (angebote.some(a => (klein.clubs.find(c => c.id === a.clubId)?.level || 9) <= 4)) throw new Error("Angebot aus einer Liga, für die die Lizenz fehlt");

        // Lehrgang: kostet, dauert, bringt Lizenz und Werte
        const verein = klein.clubs.find(c => c.id === klein.userClubId);
        verein.balance = 100000;
        const taktikVorher = pk.werte.taktik;
        const kurs = T.kursStarten(klein);
        if (!kurs.success || verein.balance !== 100000 - kurs.kosten) throw new Error("Lehrgang nicht gebucht oder nicht bezahlt");
        if (T.kursStarten(klein).success) throw new Error("Zwei Lehrgänge gleichzeitig");
        for (let i = 0; i < kurs.tage; i++) T.tag(klein);
        if (pk.lizenz !== "a" || pk.werte.taktik !== taktikVorher + 1) throw new Error("Lehrgang bringt Lizenz oder Taktik nicht");
        if (!klein.inbox.some(m => /bestanden/.test(m.subject))) throw new Error("Keine Nachricht zum bestandenen Lehrgang");

        // Motivation: Dieselbe gute Ansprache wirkt beim Motivator stärker
        const ansprache = (wert) => {
            const s = GameState.createNewGame("muc", "normal", { name: "Trainer" });
            T.profil(s).werte.motivation = wert;
            s.players.forEach(x => { x.morale = 60; });
            const ergebnisse = ManagerEngine.TEAM_TALK_TONES.map(t => ManagerEngine.applyTeamTalk(s, t.key, { phase: "prematch" }))
                .filter(r => r.success);
            return ergebnisse;
        };
        const stark = ansprache(20), schwach = ansprache(4);
        const besteStark = Math.max(...stark.map(r => r.moraleDelta)), besteSchwach = Math.max(...schwach.map(r => r.moraleDelta));
        if (!(besteStark > besteSchwach)) throw new Error(`Motivation wirkt nicht (${besteStark} gegen ${besteSchwach})`);

        // Ruf: Berater sind bei einem bekannten Trainer geduldiger
        if (!(NegotiationEngine.geduldMitRuf(state, 60) > NegotiationEngine.geduldMitRuf(klein, 60))) throw new Error("Der Ruf ändert die Geduld der Berater nicht");

        // Saisonende: Was gefordert war, wächst
        const motivationVorher = p.werte.motivation;
        const gewachsen = T.saisonende(state, { titel: 1 });
        if (!gewachsen.includes("Motivation") || p.werte.motivation !== motivationVorher + 1) throw new Error("Ein Titel stärkt die Motivation nicht");
    });

    test("Spielanalyse: Heatmap und Passnetz aus dem Livespiel, nur bei eigenen Spielen gespeichert", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const heim = state.clubs.find(c => c.id === "muc"), gast = state.clubs.find(c => c.id === "dor");
        const partie = { id: "pa", played: false, homeClubId: "muc", awayClubId: "dor" };
        const live = MatchEngine.createLiveMatch(partie, heim, gast, state.players, { modus: "fm" });
        live.speed = 4;
        let q = 0;
        while (!live.isFinished && q++ < 600000) { live.advanceRealTime(16); live.updateBallAndPlayers(16); }
        const a = partie.analyse;
        if (!a) throw new Error("Keine Positionsanalyse gespeichert");
        ["home", "away"].forEach(t => {
            if (!/^[0-9]{96}$/.test(a.heat[t])) throw new Error(`Heatmap ${t} ist keine Ziffernfolge aus 96 Feldern`);
            if (!a.heat[t].includes("9")) throw new Error("Heatmap nicht normiert");
            const n = a.netz[t];
            if (n.spieler.length < 10 || n.spieler.length > 14) throw new Error(`${n.spieler.length} Spieler im Passnetz`);
            if (n.kanten.length < 6) throw new Error(`Nur ${n.kanten.length} Passwege`);
            if (n.kanten.some(([v, z]) => !n.spieler[v] || !n.spieler[z] || v === z)) throw new Error("Passweg ohne zwei verschiedene Spieler");
            if (n.spieler.some(([, x, y]) => x < 0 || x > 100 || y < 0 || y > 100)) throw new Error("Position außerhalb des Feldes");
        });
        // In Angriffsrichtung: Der Torwart steht hinten, die Stürmer vorn
        const tw = heim.lineup[0];
        const twPos = a.netz.home.spieler.find(s => String(s[0]) === String(tw));
        if (!twPos || twPos[1] > 20) throw new Error(`Torwart steht im Schnitt bei ${twPos && twPos[1]}`);
        // Fremde Partien bleiben schlank
        MatchEngine.compactPlayedMatch(partie, false);
        if (partie.analyse) throw new Error("Verschlankte Partie behält die Analyse");
    });

    test("Wetter: Jahreszeit, Rasen nach Ligastufe, Wirkung auf Kraft, Pässe und Fernschüsse", () => {
        const { WetterEngine } = require('./js/engine/wetterEngine.js');
        if (![8, 9].includes(WetterEngine.monat({ matchday: 1 }))) throw new Error(`1. Spieltag im Monat ${WetterEngine.monat({ matchday: 1 })}`);
        if (![11, 12, 1].includes(WetterEngine.monat({ matchday: 17 }))) throw new Error("Die Hinrunde endet nicht im Winter");
        if (![4, 5].includes(WetterEngine.monat({ matchday: 34 }))) throw new Error("Der letzte Spieltag liegt nicht im Frühjahr");

        const zaehle = (md, level) => {
            const z = {};
            for (let i = 0; i < 400; i++) {
                const w = WetterEngine.fuer({ id: "w" + i, homeClubId: "h" + i, awayClubId: "g", matchday: md }, { level });
                z[w.art] = (z[w.art] || 0) + 1;
                z["platz_" + w.platz] = (z["platz_" + w.platz] || 0) + 1;
            }
            return z;
        };
        const sommer = zaehle(2, 1), winter = zaehle(17, 1), winterAmateure = zaehle(17, 7);
        if (sommer.schnee) throw new Error("Schnee im August");
        if (!(sommer.hitze > 10)) throw new Error("Keine Hitze im Sommer");
        if (!(winter.schnee > 20)) throw new Error("Kein Schnee im Winter");
        const schlecht = z => (z.platz_tief || 0) + (z.platz_hart || 0);
        if (!(schlecht(winterAmateure) > schlecht(winter) * 1.3)) throw new Error("Amateurplätze leiden nicht mehr unter dem Winter");

        // Fest bestimmt: dieselbe Partie hat dasselbe Wetter
        const m = { id: "fest", homeClubId: "muc", awayClubId: "dor", matchday: 20 };
        const a = WetterEngine.fuer(m), b = WetterEngine.fuer({ id: "fest", homeClubId: "muc", awayClubId: "dor", matchday: 20 });
        if (a.art !== b.art || a.temp !== b.temp || a.platz !== b.platz) throw new Error("Wetter ist nicht fest");

        const tief = WetterEngine.mitWirkung({ art: "starkregen", temp: 6, platz: "tief" });
        if (!(tief.pass < -0.05 && tief.ausdauer > 1.1 && tief.fern > 0)) throw new Error("Tiefer Boden im Starkregen wirkt nicht");
        if (!WetterEngine.hinweis(tief)) throw new Error("Kein Hinweis für tiefen Boden");

        // Im Livespiel: Hitze zehrt schneller an der Kraft
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const heim = state.clubs.find(c => c.id === "muc"), gast = state.clubs.find(c => c.id === "dor");
        const live = (art) => new LiveMatch({ id: "wt" + art, played: false, homeClubId: "muc", awayClubId: "dor", wetter: { art, temp: art === "hitze" ? 33 : 15, platz: "gut" } }, heim, gast, state.players);
        const heiss = live("hitze"), mild = live("bewoelkt");
        if (!heiss.wetter || heiss.wetter.art !== "hitze") throw new Error("Das Livespiel kennt das Wetter nicht");
        heiss.director.drainStamina(900); mild.director.drainStamina(900);
        const frische = l => l.players2D.reduce((s, p) => s + (p.freshness ?? 1), 0) / l.players2D.length;
        if (!(frische(heiss) < frische(mild))) throw new Error("Hitze kostet keine zusätzliche Kraft");
        // Passgenauigkeit: Der Flow kennt das Wetter
        if (!heiss.director.flow || heiss.director.flow.wetter().art !== "hitze") throw new Error("Die Spielzüge kennen das Wetter nicht");
    });

    test("Verträge: Beraterhonorar und Prämien in der Verhandlung, Kaufoption bei Leihen", () => {
        const { LoanEngine } = require('./js/engine/loanEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        club.balance = 200000000; club.transferBudget = 200000000;

        // Ein Vereinsloser: Es geht direkt um die Konditionen
        const frei = state.players.find(p => p.clubId && p.clubId !== club.id && p.pos === "ST" && p.overall >= 70);
        const alt = state.clubs.find(c => c.id === frei.clubId);
        alt.playerIds = alt.playerIds.filter(id => id !== frei.id);
        frei.clubId = null;
        frei.hiddenAttributes = Object.assign({}, frei.hiddenAttributes, { injuryProneness: 1 });
        const neg = NegotiationEngine.startTransferNegotiation(state, frei.id, club.id).negotiation;
        if (!(neg.demand.agentFee > 0)) throw new Error("Der Berater verlangt kein Honorar");
        if (neg.demand.agentFee < neg.demand.wage * 10) throw new Error("Bei Vereinslosen fällt das Honorar zu klein aus");

        // Weniger Grundgehalt, dafür Prämien: Der Spieler rechnet sie ein
        const angebot = { wage: Math.round(neg.demand.wage * 0.85), years: 3, signingBonus: neg.demand.signingBonus,
            agentFee: neg.demand.agentFee, einsatzPraemie: Math.round(neg.demand.wage * 0.25), torPraemie: Math.round(neg.demand.wage * 0.2) };
        if (NegotiationEngine.praemienWert(state, neg, angebot) < neg.demand.wage * 0.15) throw new Error("Prämien zählen in der Bewertung kaum");
        const ohnePraemien = Object.assign({}, angebot, { einsatzPraemie: 0, torPraemie: 0 });
        if (NegotiationEngine.praemienWert(state, neg, ohnePraemien) !== 0) throw new Error("Ohne Prämien kein Prämienwert");
        // Ein Angebot ohne Handgeld-Angabe übernimmt die Forderung statt NaN
        const ohneHandgeld = Object.assign({}, angebot);
        delete ohneHandgeld.signingBonus;
        NegotiationEngine.submitOffer(state, neg.id, ohneHandgeld);
        if (neg.lastOffer.signingBonus !== neg.demand.signingBonus) throw new Error(`Handgeld ohne Angabe: ${neg.lastOffer.signingBonus}`);
        NegotiationEngine.submitOffer(state, neg.id, angebot);
        neg.replyDay = NegotiationEngine.today(state);
        NegotiationEngine.processDay(state);
        if (neg.stage !== NegotiationEngine.STAGES.MEDICAL) throw new Error(`Angebot mit Prämien abgelehnt (${neg.status}, ${neg.stage})`);
        const vorher = club.balance;
        neg.replyDay = NegotiationEngine.today(state);
        // Der Medizincheck fällt auch beim robustesten Spieler in 4 % der Fälle
        // durch - hier geht es um Honorar und Prämien, nicht um ihn
        const echterZufall = Math.random;
        Math.random = () => 0.99;
        try { NegotiationEngine.processDay(state); } finally { Math.random = echterZufall; }
        if (frei.clubId !== club.id) throw new Error("Transfer nicht vollzogen");
        if (Math.round(vorher - club.balance) !== neg.agreed.signingBonus + neg.agreed.agentFee) throw new Error("Handgeld und Beraterhonorar werden nicht bezahlt");
        if (!frei.praemien || frei.praemien.einsatz !== angebot.einsatzPraemie) throw new Error("Prämien stehen nicht im Vertrag");

        // Prämien nach dem Spiel: Einsatz plus zwei Tore
        const partie = { played: true, homeClubId: club.id, awayClubId: "dor", playerRatings: [{ playerId: frei.id, minutes: 70, goals: 2 }] };
        const kontoVorSpiel = club.balance;
        const gezahlt = NegotiationEngine.zahlePraemien(state, partie);
        if (gezahlt !== angebot.einsatzPraemie + 2 * angebot.torPraemie || club.balance !== kontoVorSpiel - gezahlt) throw new Error(`Prämien falsch abgerechnet: ${gezahlt}`);
        if (NegotiationEngine.zahlePraemien(state, partie) !== 0) throw new Error("Prämien werden doppelt gezahlt");

        // Leihe mit Kaufoption
        const markt = LoanEngine.leihmarkt(state, 30);
        const ziel = markt[0];
        if (!(ziel.kaufoption > 0) || !(ziel.optionsAufschlag > 0)) throw new Error("Der Leihmarkt nennt keine Kaufoption");
        const stamm = state.clubs.find(c => c.id === ziel.clubId);
        const stammKonto = stamm.balance || 0;
        const res = LoanEngine.ausleihen(state, ziel.playerId, null, { kaufoption: true });
        if (!res.success || res.gebuehr !== ziel.gebuehr + ziel.optionsAufschlag) throw new Error("Die Kaufoption kostet keinen Aufschlag");
        const leihspieler = state.players.find(p => String(p.id) === String(ziel.playerId));
        if (leihspieler.leihe.kaufoption !== ziel.kaufoption) throw new Error("Kaufoption steht nicht in der Leihe");
        const gezogen = LoanEngine.zieheKaufoption(state, leihspieler.id);
        if (!gezogen.success) throw new Error(gezogen.error);
        if (leihspieler.leihe || leihspieler.clubId !== club.id || !club.playerIds.includes(leihspieler.id) || stamm.playerIds.includes(leihspieler.id)) {
            throw new Error("Nach der Kaufoption gehört er nicht fest zum Kader");
        }
        if ((stamm.balance || 0) < stammKonto + ziel.kaufoption) throw new Error("Der Stammverein bekommt den Kaufpreis nicht");

        // Die KI zieht ihre Optionen, wenn der Spieler eingeschlagen hat
        let seed = 3;
        const zufall = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        LoanEngine.kiLeihen(state, 40, zufall);
        const mitOption = state.players.filter(p => p.leihe && p.leihe.kaufoption);
        if (!mitOption.length) throw new Error("Keine KI-Leihe mit Kaufoption");
        mitOption.forEach(p => { p.spielpraxis = 0.8; const lv = state.clubs.find(c => c.id === p.leihe.leihvereinId); lv.balance = 1e9; });
        const kaeufer = new Map(mitOption.map(p => [p.id, p.leihe.leihvereinId]));
        LoanEngine.saisonende(state);
        const gekauft = mitOption.filter(p => p.clubId === kaeufer.get(p.id) && !p.leihe);
        if (!gekauft.length) throw new Error("Die KI zieht keine Kaufoption");
    });

    test("Kabine: Kapitän, Führungsspieler und Grüppchen - Wortführer färben ab, ein Abgang hinterlässt Unruhe", () => {
        const { DressingRoomEngine } = require('./js/engine/dressingRoomEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const h = DressingRoomEngine.hierarchie(state);
        if (h.spieler.length !== club.playerIds.length) throw new Error("Nicht jeder Spieler hat einen Platz in der Hierarchie");
        if (!h.kapitaen) throw new Error("Kein Kapitän");
        const fuehrung = h.spieler.filter(e => e.stufe === "Führungsspieler");
        if (fuehrung.length < 1 || fuehrung.length > 3) throw new Error(`${fuehrung.length} Führungsspieler`);
        // Der Kapitän ist erfahren, kein Neuling
        if ((h.kapitaen.age || 0) < 24) throw new Error(`Kapitän ist ${h.kapitaen.age} Jahre alt`);
        const deutsch = h.gruppen.find(g => g.key === "deutsch");
        if (!deutsch || deutsch.mitglieder.length < 3) throw new Error("Keine deutschsprachige Gruppe bei den Bayern");
        if (h.gruppen.some(g => g.mitglieder.length < 3)) throw new Error("Gruppe mit weniger als drei Spielern");

        // Ein Neuzugang steht als Neuzugang in der Kabine
        const neu = state.players.find(p => p.clubId && p.clubId !== club.id && p.overall > 70);
        club.balance = 1e9;
        TransferEngine.executeTransfer(state, neu.id, club.id, 1000000, neu.wage, 3);
        if (DressingRoomEngine.hierarchie(state).spieler.find(e => e.player === neu).stufe !== "Neuzugang") throw new Error("Neuzugang wird nicht erkannt");

        // Ein unzufriedener Wortführer zieht seine Gruppe runter
        const g = DressingRoomEngine.hierarchie(state).gruppen[0];
        g.mitglieder.forEach(p => { p.morale = 75; });
        g.wortfuehrer.morale = 35;
        const andere = g.mitglieder.filter(p => p !== g.wortfuehrer && p !== DressingRoomEngine.hierarchie(state).kapitaen);
        for (let i = 0; i < 5; i++) DressingRoomEngine.kabinenTag(state, club);
        if (!andere.every(p => p.morale < 75)) throw new Error("Der Wortführer färbt nicht ab");
        if (!DressingRoomEngine.schreibtisch(state).some(i => /zieht seine Gruppe runter|Kapitän/.test(i.title))) throw new Error("Schreibtisch meldet die Unruhe nicht");

        // Kapitän wechseln: Der alte ist gekränkt, der neue stolz
        state.players.forEach(p => { if (club.playerIds.includes(p.id)) p.morale = 75; });
        const alt = DressingRoomEngine.hierarchie(state).kapitaen;
        const kandidat = DressingRoomEngine.hierarchie(state).spieler.find(e => e.player !== alt && e.stufe !== "Neuzugang").player;
        const res = DressingRoomEngine.setzeKapitaen(state, kandidat.id);
        if (!res.success || DressingRoomEngine.hierarchie(state).kapitaen !== kandidat) throw new Error("Kapitän lässt sich nicht bestimmen");
        if (!(alt.morale < 75 && kandidat.morale > 75)) throw new Error("Kapitänswechsel lässt alle kalt");

        // Verkauf des Kapitäns: Unruhe in der Kabine
        state.players.forEach(p => { if (club.playerIds.includes(p.id) && p !== kandidat) p.morale = 75; });
        const kaeufer = state.clubs.find(c => c.id !== club.id && c.level === 1);
        kaeufer.balance = 1e9;
        TransferEngine.executeTransfer(state, kandidat.id, kaeufer.id, 5000000, kandidat.wage, 3);
        const rest = state.players.filter(p => club.playerIds.includes(p.id) && p !== neu);
        if (!rest.some(p => p.morale < 75)) throw new Error("Verkauf des Kapitäns bleibt ohne Folgen");
        if (!state.inbox.some(m => /Unruhe nach dem Abgang/.test(m.subject))) throw new Error("Mannschaftsrat meldet sich nicht");
        if (club.kapitaenId !== undefined) throw new Error("Verkaufter Spieler bleibt Kapitän");
    });

    test("Leihen: KI-Vereine verleihen Talente ohne Einsätze an gleich starke oder tiefere Ligen", () => {
        const { LoanEngine } = require('./js/engine/loanEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        let seed = 7;
        const zufall = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const anzahl = LoanEngine.kiLeihen(state, 30, zufall);
        const verliehen = state.players.filter(p => p.leihe);
        if (anzahl < 10 || verliehen.length !== anzahl) throw new Error(`${anzahl} KI-Leihen, ${verliehen.length} Spieler mit Leihe`);
        const weg = {}, da = {};
        verliehen.forEach(p => {
            const stamm = state.clubs.find(c => c.id === p.leihe.stammvereinId);
            const leih = state.clubs.find(c => c.id === p.leihe.leihvereinId);
            if (stamm.id === state.userClubId || leih.id === state.userClubId) throw new Error("Die KI verleiht an oder vom Nutzer");
            if ((leih.level || 1) < (stamm.level || 1) || (leih.level || 1) > (stamm.level || 1) + 2) throw new Error(`${p.name}: Liga ${stamm.level} → ${leih.level}`);
            if (p.age > 22) throw new Error(`${p.name} ist ${p.age} Jahre alt`);
            if (p.clubId !== leih.id || !leih.playerIds.includes(p.id) || stamm.playerIds.includes(p.id)) throw new Error(`${p.name} steht im falschen Kader`);
            if (p.leihe.lohnAnteil < 0.3 || p.leihe.lohnAnteil > 1) throw new Error(`Gehaltsanteil ${p.leihe.lohnAnteil}`);
            weg[stamm.id] = (weg[stamm.id] || 0) + 1;
            da[leih.id] = (da[leih.id] || 0) + 1;
        });
        if (Object.values(weg).some(n => n > 3) || Object.values(da).some(n => n > 2)) throw new Error("Grenzen je Verein überschritten");
        // Wer spielt, bleibt
        state.players.forEach(p => { if (!p.leihe) p.spielpraxis = 0.8; });
        if (LoanEngine.kiLeihen(state, 30, zufall) !== 0) throw new Error("Ein Spieler mit Spielpraxis wurde verliehen");
        // Alle kehren zum Saisonende zurück
        const zurueck = LoanEngine.saisonende(state);
        if (zurueck.length !== anzahl || state.players.some(p => p.leihe)) throw new Error("Nicht alle KI-Leihen enden zum Saisonende");
        if (zurueck.some(z => z.player.clubId !== z.stammvereinId)) throw new Error("Ein Spieler ist nicht zum Stammverein zurück");
    });

    test("Spielanalyse: Jeder Abschluss mit Ort, xG und Ausgang - nur bei eigenen Spielen gespeichert", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const heim = state.clubs.find(c => c.id === "sge");
        const gast = state.clubs.find(c => c.id === "wob");
        const partie = { id: "analyse", played: false, homeClubId: "sge", awayClubId: "wob" };
        MatchEngine.simulateFullMatch(partie, heim, gast, state.players);
        const s = partie.schuesse;
        if (!Array.isArray(s) || !s.length) throw new Error("Keine Schüsse gespeichert");
        const gesamt = partie.stats.shots[0] + partie.stats.shots[1];
        if (s.length !== gesamt) throw new Error(`${s.length} Schüsse gespeichert, Statistik zählt ${gesamt}`);
        s.forEach(z => {
            // [Minute, Seite, x, y, xG, Ergebnis, Art, Schütze, Schützen-ID]
            if (z.length !== 9 || z[2] < 50 || z[2] > 100 || z[3] < 0 || z[3] > 100 || z[4] <= 0 || z[8] === null || z[8] === undefined) throw new Error(`Ungültiger Schuss ${JSON.stringify(z)}`);
        });
        const tore = [0, 1].map(t => s.filter(z => z[1] === t && z[5] === 2).length);
        if (tore[0] !== partie.homeGoals || tore[1] !== partie.awayGoals) throw new Error(`Tore in der Schussliste ${tore} passen nicht zum Ergebnis`);
        const xg = [0, 1].map(t => s.filter(z => z[1] === t).reduce((a, z) => a + z[4] / 100, 0));
        if (Math.abs(xg[0] - partie.stats.xG[0]) > 0.06 || Math.abs(xg[1] - partie.stats.xG[1]) > 0.06) {
            throw new Error(`xG der Schussliste ${xg.map(v => v.toFixed(2))} weicht von der Statistik ${partie.stats.xG} ab`);
        }
        // Fremde Spiele werden verschlankt - die Schussliste fällt mit weg
        MatchEngine.compactPlayedMatch(partie, false);
        if (partie.schuesse) throw new Error("Verschlankte Partie behält die Schussliste");
    });

    test("Transferfenster gilt auch für den Nutzer: Käufe, Verkäufe, Klauseln und Leihen", () => {
        const { LoanEngine } = require('./js/engine/loanEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!TransferEngine.fensterInfo(state).offen) throw new Error("In der Vorbereitung ist das Fenster zu");

        // Mitten in der Hinrunde: zu
        if (state.preseason) state.preseason.aktiv = false;
        const aufTag = (filter) => {
            state.currentDayIndex = state.calendar.findIndex(filter);
            state.currentDate = state.calendar[state.currentDayIndex].date;
            state.currentMatchday = state.calendar[state.currentDayIndex].matchday || state.currentMatchday;
        };
        aufTag(d => d.type === "matchday" && d.matchday === 6);
        const info = TransferEngine.fensterInfo(state);
        if (info.offen || !/01\.01\./.test(info.text)) throw new Error(`Fenster am 6. Spieltag: ${info.text}`);
        const fremd = state.players.find(p => p.clubId && p.clubId !== club.id);
        const neg = NegotiationEngine.startTransferNegotiation(state, fremd.id, club.id);
        if (neg.success) throw new Error("Verhandlung außerhalb des Fensters eröffnet");
        // Vereinslose gehen immer
        const frei = state.players.find(p => p.clubId && p.clubId !== club.id && p.id !== fremd.id);
        const altVerein = state.clubs.find(c => c.id === frei.clubId);
        altVerein.playerIds = altVerein.playerIds.filter(id => id !== frei.id);
        frei.clubId = null;
        const negFrei = NegotiationEngine.startTransferNegotiation(state, frei.id, club.id);
        if (!negFrei.success) throw new Error(`Vereinsloser lässt sich nicht verpflichten: ${negFrei.error}`);
        // Angebote annehmen, Klauseln ziehen, verleihen: zu
        state.transferMarket.offers.push({ id: "fz", playerId: club.playerIds[3], playerName: "x", fromClubId: altVerein.id, fromClubName: altVerein.name, fee: 1000000, status: "pending" });
        if (TransferEngine.nimmAngebotAn(state, "fz").ok) throw new Error("Angebot außerhalb des Fensters angenommen");
        const mitKlausel = state.players.find(p => p.clubId && p.clubId !== club.id && TransferEngine.ausstiegsklausel(state, p));
        club.balance = 1e10;
        if (TransferEngine.zieheAusstiegsklausel(state, mitKlausel.id).success) throw new Error("Klausel außerhalb des Fensters gezogen");
        const eigener = state.players.find(p => p.id === club.playerIds[5]);
        if (!/Transferfenster/.test(LoanEngine.verleihHindernis(state, eigener) || "")) throw new Error("Verleihen außerhalb des Fensters möglich");
        // Die KI bietet außerhalb des Fensters nicht
        const vorher = state.transferMarket.offers.length;
        for (let i = 0; i < 40; i++) TransferEngine.processAITransferMarket(state);
        if (state.transferMarket.offers.length !== vorher) throw new Error("KI bietet außerhalb des Fensters");

        // Im Januar: offen
        aufTag(d => d.date.startsWith("05.01"));
        if (!TransferEngine.fensterInfo(state).offen) throw new Error("Zur Halbserie ist das Fenster zu");
        if (!NegotiationEngine.startTransferNegotiation(state, fremd.id, club.id).success) throw new Error("Im Winterfenster keine Verhandlung möglich");
    });

    test("Winterpause je Land, Boxing Day in England, Transferfenster nach Datum mit Meldungen", () => {
        const vorlage = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const vereinIn = liga => vorlage.clubs.find(c => c.leagueId === liga).id;
        const spieltage = st => st.calendar.filter(d => d.type === "matchday");
        const tm = d => { const [t, m] = d.date.split(".").map(Number); return { t, m }; };
        const zwischen = (d, von, bis) => { const { t, m } = tm(d); const w = (m < 7 ? m + 12 : m) * 100 + t; return w >= von && w <= bis; };

        // Deutschland: Pause über die Feiertage, kein Spiel vom 22.12. bis 9.1.
        const de = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const pause = de.calendar.filter(d => d.winterpause);
        if (pause.length < 10) throw new Error(`Bundesliga: nur ${pause.length} Tage Winterpause`);
        if (spieltage(de).some(d => zwischen(d, 1222, 1309))) throw new Error("Bundesliga spielt in der Winterpause");
        if (!pause.some(d => d.trainingsArt === "rest") || !pause.some(d => d.trainingsArt === "training")) throw new Error("Die Pause hat nicht freie Tage und Training");

        // England: keine Winterpause - Boxing Day, 29.12. und Neujahr sind Spieltage
        const en = GameState.createNewGame(vereinIn("en_liga_1"), "normal", { name: "Trainer" });
        if (en.calendar.some(d => d.winterpause)) throw new Error("Die Premier League macht Winterpause");
        ["26.12", "29.12", "01.01"].forEach(tag => {
            if (!spieltage(en).some(d => d.date.startsWith(tag))) throw new Error(`Premier League ohne Spieltag am ${tag}.`);
        });
        if (!spieltage(en).some(d => d.festtag === "Boxing Day")) throw new Error("Der Boxing Day heißt nicht so");

        // Nirgends wird an Heiligabend oder am ersten Weihnachtstag gespielt
        ["de_liga_1", "en_liga_1", "es_liga_1", "it_liga_1", "fr_liga_1", "en_liga_2"].forEach(liga => {
            const st = liga === "de_liga_1" ? de : (liga === "en_liga_1" ? en : GameState.createNewGame(vereinIn(liga), "normal", { name: "Trainer" }));
            if (st.calendar.some(d => ["matchday", "cup", "euro"].includes(d.type) && /^(24|25)\.12/.test(d.date))) throw new Error(`${liga} spielt an Weihnachten`);
            if (spieltage(st).length !== st.totalMatchdays) throw new Error(`${liga}: Spieltage gehen verloren`);
            // Auch die lange Championship ist vor dem Sommer fertig
            if (tm(spieltage(st)[spieltage(st).length - 1]).m >= 7) throw new Error(`${liga} spielt bis in den Sommer`);
        });

        // Das Fenster nach Datum: im Januar offen - auch in England, wo gespielt wird
        const aufTag = (st, praefix) => {
            st.currentDayIndex = st.calendar.findIndex(d => d.date.startsWith(praefix));
            st.currentDate = st.calendar[st.currentDayIndex].date;
            if (st.preseason) st.preseason.aktiv = false;
        };
        aufTag(en, "26.12");
        if (TransferEngine.istTransferfenster(en)) throw new Error("Am Boxing Day ist das Fenster schon offen");
        const zuText = TransferEngine.fensterInfo(en).text;
        if (!/öffnet am 01\.01\. Vereinslose/.test(zuText)) throw new Error(`Hinweis bei geschlossenem Fenster: ${zuText}`);
        // Der Kalendertag zählt, auch wenn currentDate (noch) nicht nachgezogen ist
        en.currentDate = "01.08.2026";
        if (TransferEngine.istTransferfenster(en)) throw new Error("Das Fenster richtet sich nach currentDate statt nach dem Kalendertag");
        aufTag(en, "01.01");
        if (!TransferEngine.istTransferfenster(en) || TransferEngine.fensterInfo(en).art !== "winter") throw new Error("Am Neujahrsspieltag ist das Winterfenster zu");
        aufTag(de, "02.02");
        if (!TransferEngine.istTransferfenster(de)) throw new Error("Am 2. Februar ist das Fenster schon zu");
        aufTag(de, "03.02");
        if (TransferEngine.istTransferfenster(de)) throw new Error("Am 3. Februar ist das Fenster noch offen");
        aufTag(de, "31.08");
        if (!TransferEngine.istTransferfenster(de)) throw new Error("Am 31. August ist das Sommerfenster zu");
        aufTag(de, "01.09");
        if (TransferEngine.istTransferfenster(de)) throw new Error("In Deutschland ist das Fenster am 1. September noch offen");
        aufTag(en, "01.09");
        if (!TransferEngine.istTransferfenster(en)) throw new Error("In England ist der 1. September kein Fenstertag");

        // Meldungen: Öffnen, letzter Tag, Schließen - je einmal
        aufTag(de, "31.12");
        delete de.transferFenster;
        if (TransferEngine.pruefeFensterwechsel(de).length) throw new Error("Meldung ohne Wechsel");
        aufTag(de, "01.01");
        if (!/Wintertransferfenster geöffnet/.test(TransferEngine.pruefeFensterwechsel(de)[0] || "") || de.inbox[0].type !== "transfer_window") throw new Error("Keine Nachricht zum Öffnen");
        if (TransferEngine.pruefeFensterwechsel(de).length) throw new Error("Dieselbe Meldung zweimal");
        aufTag(de, "02.02");
        if (!/Deadline Day/.test(TransferEngine.pruefeFensterwechsel(de)[0] || "")) throw new Error("Keine Erinnerung am letzten Tag");
        if (TransferEngine.pruefeFensterwechsel(de).length) throw new Error("Zwei Erinnerungen am letzten Tag");
        aufTag(de, "03.02");
        if (!/geschlossen/.test(TransferEngine.pruefeFensterwechsel(de)[0] || "") || !/Vorbereitung/.test(de.inbox[0].body)) throw new Error("Keine Nachricht zum Schließen");

        // In der Winterpause handeln auch die KI-Vereine, sobald das Fenster offen ist
        aufTag(de, "02.01");
        if (!de.calendar[de.currentDayIndex].winterpause) throw new Error("Der 2. Januar liegt nicht in der Bundesliga-Pause");
        let ki = 0;
        const original = TransferEngine.processAiTransferWindow;
        TransferEngine.processAiTransferWindow = (st, n) => { ki += n; return 0; };
        try {
            CalendarEngine.advanceOneDay(de);
        } finally {
            TransferEngine.processAiTransferWindow = original;
        }
        if (ki <= 0) throw new Error("In der Winterpause handelt die KI nicht");
    });

    test("Vertragsklauseln: Ausstiegsklausel ziehen und vereinbaren, Weiterverkaufsbeteiligung", () => {
        const { ContractEngine } = require('./js/engine/contractEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const fremde = state.players.filter(p => p.clubId && p.clubId !== club.id);

        // Gut jeder Fünfte fremde Spieler hat eine Klausel, eigene keine
        const mitKlausel = fremde.filter(p => TransferEngine.ausstiegsklausel(state, p));
        const anteil = mitKlausel.length / fremde.length;
        if (anteil < 0.15 || anteil > 0.3) throw new Error(`Anteil mit Klausel ${(anteil * 100).toFixed(0)} %`);
        if (TransferEngine.ausstiegsklausel(state, mitKlausel[0]) !== TransferEngine.ausstiegsklausel(state, mitKlausel[0])) throw new Error("Klausel nicht stabil");
        const eigener = state.players.find(p => p.clubId === club.id);
        if (TransferEngine.ausstiegsklausel(state, eigener)) throw new Error("Eigene Spieler haben ohne Vertrag keine Klausel");

        // Klausel ziehen: Der Verein kann nicht ablehnen
        const ziel = mitKlausel.find(p => {
            const v = state.clubs.find(c => c.id === p.clubId);
            return v && (v.reputation || 60) <= (club.reputation || 60) + 15 && !p.leihe;
        });
        const verkaeufer = state.clubs.find(c => c.id === ziel.clubId);
        const klausel = TransferEngine.ausstiegsklausel(state, ziel);
        club.balance = klausel + 5000000;
        const kontoVerkaeufer = verkaeufer.balance || 0;
        const res = TransferEngine.zieheAusstiegsklausel(state, ziel.id);
        if (!res.success) throw new Error(res.error);
        if (ziel.clubId !== club.id || club.balance !== 5000000 || (verkaeufer.balance || 0) !== kontoVerkaeufer + klausel) {
            throw new Error("Klausel gezogen, aber Spieler oder Geld nicht richtig gebucht");
        }
        if (TransferEngine.ausstiegsklausel(state, ziel)) throw new Error("Nach dem Wechsel gilt die alte Klausel weiter");

        // Eine Klausel im eigenen Vertrag senkt die Gehaltsforderung
        const spieler = state.players.find(p => p.clubId === club.id && p.id !== ziel.id && (p.value || 0) > 0);
        club.wageBudget = Math.max(club.wageBudget || 0, 1e9);
        const forderung = ContractEngine.getExtensionDemand(spieler, club).demandWage;
        const angebot = Math.round(forderung * 0.85);
        const ohne = ContractEngine.negotiateExtension(Object.assign({}, spieler), club, angebot, 3, "Stammspieler", 0);
        if (ohne.success) throw new Error("85 % der Forderung reichen ohne Klausel nicht");
        const klauselBetrag = Math.round(spieler.value * 1.5);
        const mit = ContractEngine.negotiateExtension(spieler, club, angebot, 3, "Stammspieler", klauselBetrag);
        if (!mit.success || spieler.ausstiegsklausel !== klauselBetrag) throw new Error("Mit Klausel kommt der Vertrag nicht zustande");

        // Die KI zieht eine niedrige Klausel - ablehnen geht nicht
        spieler.ausstiegsklausel = 100000;
        spieler.overall = 99;
        const gezogen = TransferEngine.pruefeAusstiegsklauseln(state, () => 0);
        if (!gezogen.some(g => g.player === spieler) || spieler.clubId === club.id) throw new Error("Die KI zieht die Klausel nicht");
        if (!state.inbox.some(m => /Ausstiegsklausel gezogen/.test(m.subject))) throw new Error("Keine Nachricht über die gezogene Klausel");

        // Weiterverkaufsbeteiligung: Beim nächsten Wechsel bekommt der alte Verein seinen Anteil
        const verkauf = state.players.find(p => p.clubId === club.id && !p.leihe);
        const kaeufer = state.clubs.find(c => c.id !== club.id && c.id !== verkaeufer.id);
        if (!state.transferMarket) state.transferMarket = { offers: [] };
        if (!Array.isArray(state.transferMarket.offers)) state.transferMarket.offers = [];
        state.transferMarket.offers.push({ id: "wv1", playerId: verkauf.id, playerName: verkauf.name, fromClubId: kaeufer.id, fromClubName: kaeufer.name, fee: 10000000, status: "pending" });
        const r = TransferEngine.nimmAngebotAn(state, "wv1", { weiterverkauf: 20 });
        if (!r.ok || r.offer.fee !== 9000000 || !verkauf.weiterverkauf || verkauf.weiterverkauf.clubId !== club.id) {
            throw new Error("Weiterverkaufsbeteiligung wird nicht vereinbart");
        }
        const dritter = state.clubs.find(c => c.id !== club.id && c.id !== kaeufer.id && c.id !== verkaeufer.id);
        const vorher = club.balance;
        const kontoKaeufer = kaeufer.balance;
        TransferEngine.executeTransfer(state, verkauf.id, dritter.id, 20000000, verkauf.wage, 3);
        if (club.balance !== vorher + 4000000) throw new Error(`Beteiligung nicht ausgezahlt (${club.balance - vorher})`);
        if (kaeufer.balance !== kontoKaeufer + 16000000) throw new Error("Der Verkäufer bekommt nicht die Ablöse abzüglich der Beteiligung");
        if (verkauf.weiterverkauf) throw new Error("Die Beteiligung gilt nach dem Weiterverkauf weiter");
    });

    test("3D-Regie: Pässe, Schüsse, Zweikämpfe, Paraden und Tore werden gemeldet - das Spiel bleibt dasselbe", () => {
        // Dasselbe Spiel zweimal mit derselben Zufallsfolge: einmal mit
        // Meldungen, einmal ohne. Die Meldungen sind reine Buchführung für die
        // 3D-Ansicht und dürfen am Ergebnis nichts ändern.
        const saat = Math.floor(Math.random() * 1e9);
        const mitSaat = (fn) => {
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
        const spiele = (melden) => mitSaat(() => {
            // Jedes Mal eine frische Welt - das Spiel verändert Kondition und Form
            const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
            const live = new LiveMatch({ id: "dreid", played: false, homeClubId: "muc", awayClubId: "dor" },
                state.clubs.find(c => c.id === "muc"), state.clubs.find(c => c.id === "dor"), state.players, { modus: "fm" });
            const alle = [];
            const echt = live.director.meldeAktion.bind(live.director);
            live.director.meldeAktion = melden
                ? (art, id, daten) => { alle.push(Object.assign({ art, id }, daten)); echt(art, id, daten); }
                : () => {};
            live.rechneOhneBild();
            return { state, live, alle };
        });
        const mit = spiele(true), ohne = spiele(false);

        const spur = l => JSON.stringify({ tore: [l.homeScore, l.awayScore], stats: l.stats, verlauf: (l.verlauf || []).map(e => [e.type, e.minute, e.playerId]) });
        if (spur(mit.live) !== spur(ohne.live)) {
            throw new Error(`Mit Meldungen ein anderes Spiel: ${mit.live.homeScore}:${mit.live.awayScore} gegen ${ohne.live.homeScore}:${ohne.live.awayScore}`);
        }

        const arten = {};
        mit.alle.forEach(a => { arten[a.art] = (arten[a.art] || 0) + 1; });
        if (!(arten.pass > 100) || !((arten.schuss || 0) + (arten.kopfball || 0) > 0) || !(arten.zweikampf > 0)) {
            throw new Error("Zu wenige Meldungen: " + JSON.stringify(arten));
        }
        // Jedes Tor mit seinem Schützen, in der Reihenfolge des Spiels
        const tore = (mit.live.verlauf || []).filter(e => e.type === "goal" && e.playerId !== undefined && e.playerId !== null).map(e => e.playerId);
        const torMeldungen = mit.alle.filter(a => a.art === "tor").map(a => a.id);
        if (JSON.stringify(tore) !== JSON.stringify(torMeldungen)) {
            throw new Error(`Torschützen ${JSON.stringify(tore)}, gemeldet ${JSON.stringify(torMeldungen)}`);
        }
        // Paraden gehören Torhütern, und gehalten wurde auch
        const spieler = new Map(mit.state.players.map(p => [p.id, p]));
        const paraden = mit.alle.filter(a => a.art === "parade");
        if (mit.live.stats.saves[0] + mit.live.stats.saves[1] > 0 && paraden.length === 0) throw new Error("Keine Parade gemeldet");
        const keinTorwart = paraden.find(a => spieler.get(a.id)?.pos !== "TW");
        if (keinTorwart) throw new Error(`Parade von ${spieler.get(keinTorwart.id)?.pos} ${keinTorwart.id}`);
        if (paraden.some(a => !(a.verzoegerung >= 0))) throw new Error("Paraden ohne Zeitpunkt");
        const fremd = mit.alle.find(a => !spieler.has(a.id));
        if (fremd) throw new Error(`Meldung für unbekannten Spieler: ${JSON.stringify(fremd)}`);
        // Die Liste am Spiel bleibt kurz und fortlaufend nummeriert
        const liste = mit.live.aktionen || [];
        if (liste.length === 0 || liste.length > 40) throw new Error(`${liste.length} Meldungen am Spiel`);
        if (liste.some((a, i) => i > 0 && a.nr !== liste[i - 1].nr + 1) || liste[liste.length - 1].nr !== mit.alle.length) {
            throw new Error("Die Meldungen sind nicht fortlaufend nummeriert");
        }
    });

    test("Welt: Wer eine Saison ohne Verein bleibt, verlässt den Profifußball - Talente bekommen eine zweite", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const Y = state.seasonYear;
        const ki = state.clubs.find(c => c.id !== state.userClubId && c.leagueId === "de_liga_1");
        const kader = ki.playerIds.map(id => state.players.find(p => p.id === id));
        // Fünf Spieler werden vereinslos - zu verschiedenen Zeitpunkten
        const machFrei = (p, alter, seit) => {
            ki.playerIds = ki.playerIds.filter(id => id !== p.id);
            ki.lineup = ki.lineup.filter(id => id !== p.id);
            ki.bench = ki.bench.filter(id => id !== p.id);
            p.clubId = null; p.contractYears = 0; p.age = alter;
            if (seit === undefined) delete p.vereinslosAb; else p.vereinslosAb = seit;
            return p;
        };
        const [lange, talent, talentLange, frisch, ohneAngabe] = kader.slice(-5);
        machFrei(lange, 26, Y - 1);
        machFrei(talent, 20, Y - 1);
        machFrei(talentLange, 20, Y - 2);
        machFrei(frisch, 26, Y);
        machFrei(ohneAngabe, 26, undefined);
        // Der Nutzer verhandelt und beobachtet einen davon
        state.negotiations = (state.negotiations || []).concat([{ id: "v1", playerId: lange.id }]);
        state.scouting = state.scouting || {};
        state.scouting.shortlist = (state.scouting.shortlist || []).concat([lange.id]);

        const r = SeasonEngine.processRetirements(state);
        const da = id => state.players.some(p => p.id === id);
        if (da(lange.id)) throw new Error("Eine ganze Saison ohne Verein - und er ist noch da");
        if (!da(talent.id)) throw new Error("Das Talent bekommt keine zweite Saison");
        if (da(talentLange.id)) throw new Error("Das Talent bleibt nach zwei Saisons ohne Verein");
        if (!da(frisch.id)) throw new Error("Wer gerade erst vereinslos wurde, ist schon weg");
        if (!da(ohneAngabe.id) || ohneAngabe.vereinslosAb !== Y) throw new Error("Ein Vereinsloser aus einem alten Spielstand bekommt keine Frist");
        if (!(r.ohneVerein >= 2)) throw new Error(`Gemeldet: ${r.ohneVerein} ohne Verein`);
        if (state.negotiations.some(n => n.playerId === lange.id) || state.scouting.shortlist.includes(lange.id)) {
            throw new Error("Verhandlung oder Beobachtung bleibt als Karteileiche zurück");
        }

        // Wer unterschreibt, ist kein Vereinsloser mehr
        TransferEngine.executeTransfer(state, frisch.id, ki.id, 0, 5000, 2);
        if (frisch.vereinslosAb !== undefined) throw new Error("Nach der Unterschrift läuft die Frist weiter");

        // Wer beim Saisonwechsel vereinslos wird, bekommt das Datum
        state.seasonYear++;
        const ablauf = kader.slice(0, 3);
        ablauf.forEach(p => { p.contractYears = 0; p.overall = 1; p.age = 34; });
        SeasonEngine.processContractExpiries(state);
        const ohneDatum = state.players.filter(p => !p.clubId && typeof p.vereinslosAb !== "number");
        if (ohneDatum.length) throw new Error(`${ohneDatum.length} Vereinslose ohne Datum`);
    });

    test("Welt: Talente wachsen auf das Niveau ihres Vereins, nicht weit darüber", () => {
        const mittel = a => a.reduce((x, y) => x + y, 0) / a.length;
        const erzeuge = (anzahl, alter, level, staerke) => Array.from({ length: anzahl },
            () => PlayerGenerator.generatePlayer("t", level, "ZM", null, { clubStrength: staerke, ageRange: alter }));
        [[1, 0.8], [4, 0.5], [7, 0.3]].forEach(([level, staerke]) => {
            // 1500 je Gruppe: Über 40 Läufe lag der Abstand im Mittel bei 2,3
            // bis 2,9 und streute um 0,3 - mit 500 um 0,4, und die Grenze riss
            // einmal bei 4,1
            const talente = erzeuge(1500, [17, 20], level, staerke);
            const gestandene = erzeuge(1500, [25, 28], level, staerke);
            const niveau = mittel(gestandene.map(p => p.overall));
            const potenzial = mittel(talente.map(p => p.pot));
            // Vorher lag das Potenzial der Talente gut 8 Punkte über den
            // gestandenen Spielern - jede Generation wurde besser als die vorige
            if (potenzial - niveau > 5) throw new Error(`Liga ${level}: Talente ${potenzial.toFixed(1)} gegen Niveau ${niveau.toFixed(1)}`);
            if (potenzial - niveau < -1) throw new Error(`Liga ${level}: Talente erreichen nicht einmal das Niveau (${potenzial.toFixed(1)} gegen ${niveau.toFixed(1)})`);
            // Ausnahmetalente gibt es, aber selten: gemessen 3 bis 8 % reichen
            // 14 Punkte über das Vereinsniveau hinaus
            const ausnahme = talente.filter(p => p.pot >= niveau + 14).length / talente.length;
            if (ausnahme < 0.01 || ausnahme > 0.12) throw new Error(`Liga ${level}: ${(ausnahme * 100).toFixed(0)} % Ausnahmetalente`);
            // Luft nach oben hat jedes Talent - außer an der Obergrenze der Welt
            // (potenzialDeckel), die schon vorher galt
            const ohneLuft = talente.find(p => p.pot < p.overall + 3 && p.pot < 89);
            if (ohneLuft) throw new Error(`Liga ${level}: ein Talent ohne Luft nach oben (${ohneLuft.overall} → ${ohneLuft.pot})`);
        });
    });

    test("Welt: Ein Absteiger verliert, wer für die neue Liga zu gut ist - bis er nicht stärker ist als die Aufsteiger", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const mittel = a => a.reduce((x, y) => x + y, 0) / a.length;
        const niveau = c => ContractEngine.vereinsNiveau(c, new Map(state.players.map(p => [p.id, p])));
        const liga = id => state.leagues.find(l => l.id === id);
        const erste = state.clubs.filter(c => c.leagueId === "de_liga_1" && c.id !== state.userClubId).sort((a, b) => niveau(b) - niveau(a));
        const zweite = state.clubs.filter(c => c.leagueId === "de_liga_2").sort((a, b) => niveau(b) - niveau(a));
        const starkAb = erste[3], schwachAb = erste[erste.length - 1];
        const normalAuf = zweite[0], starkAuf = zweite[1];
        // Ein Aufsteiger, zu dem die Stars passen und der stärker ist als jeder
        // andere passende Käufer: Bekommt er sie, dann wegen seines Vorrangs
        state.players.filter(p => starkAuf.playerIds.includes(p.id)).forEach(p => { p.overall = Math.min(99, (p.overall || 0) + 14); });
        starkAuf.balance = Math.max(starkAuf.balance || 0, 5e8);

        [starkAb, schwachAb].forEach(c => CompetitionEngine.moveClubToLeague(c, liga("de_liga_2")));
        [normalAuf, starkAuf].forEach(c => CompetitionEngine.moveClubToLeague(c, liga("de_liga_1")));
        const vorher = { n: niveau(starkAb), kader: starkAb.playerIds.length, kasse: starkAb.balance };
        const grenze = mittel(state.clubs.filter(c => c.leagueId === "de_liga_2" && c !== starkAb && c !== schwachAb).map(niveau)) + SeasonEngine.ABSTIEG.ueberNiveau;
        if (!(vorher.n > niveau(normalAuf))) throw new Error("Aufbau: Der starke Absteiger ist nicht stärker als der Aufsteiger");

        // Zufall 0: Jeder, der zu gut ist, zieht seine Klausel, und der erste
        // passende Käufer greift zu. Maßstab ist der Aufsteiger aus der Zweiten Liga.
        const r = SeasonEngine.abstiegsfolgen(state, {
            relegated: [{ clubId: starkAb.id, fromLeague: "de_liga_1", toLeague: "de_liga_2" }],
            promoted: [{ clubId: normalAuf.id, fromLeague: "de_liga_2", toLeague: "de_liga_1" }, { clubId: starkAuf.id, fromLeague: "de_liga_3", toLeague: "de_liga_1" }]
        }, () => 0);

        if (r.wechsel.length < 1 || r.wechsel.length > SeasonEngine.ABSTIEG.hoechstens) throw new Error(`${r.wechsel.length} Abgänge beim starken Absteiger`);
        r.wechsel.forEach(w => {
            const p = state.players.find(x => x.id === w.playerId);
            const neu = state.clubs.find(c => c.id === p.clubId);
            if (!(p.overall > grenze)) throw new Error(`${p.name} (${p.overall}) war nicht zu gut für die Zweite Liga (Grenze ${grenze.toFixed(1)})`);
            if (!neu || neu.level !== 1 || neu.id === state.userClubId) throw new Error(`${p.name} landet nicht bei einem KI-Verein einer ersten Liga`);
            if (!(w.abloese > 0)) throw new Error("Ohne Ablöse gewechselt");
        });
        if (r.wechsel[0].nach !== starkAuf.id) throw new Error("Der passende Aufsteiger hat keinen Vorrang");
        if (!(starkAb.balance > vorher.kasse)) throw new Error("Die Ablösen kommen beim Absteiger nicht an");
        if (starkAb.playerIds.length < Math.min(vorher.kader, WorldGenerator.SQUAD_SIZES[2])) throw new Error(`Kader nicht aufgefüllt: ${starkAb.playerIds.length}`);
        if (!(niveau(starkAb) < vorher.n)) throw new Error("Der Absteiger ist danach nicht schwächer");

        // Wer schon nicht stärker ist als die Aufsteiger, gibt niemanden ab
        const schwachVorher = schwachAb.playerIds.slice();
        if (!(niveau(schwachAb) <= niveau(starkAuf))) throw new Error("Aufbau: Der schwache Absteiger ist stärker als der Aufsteiger");
        const r3 = SeasonEngine.abstiegsfolgen(state, {
            relegated: [{ clubId: schwachAb.id, fromLeague: "de_liga_1", toLeague: "de_liga_2" }],
            promoted: [{ clubId: starkAuf.id, fromLeague: "de_liga_2", toLeague: "de_liga_1" }]
        }, () => 0);
        if (r3.wechsel.length || schwachAb.playerIds.join() !== schwachVorher.join()) {
            throw new Error("Ein Absteiger, der nicht stärker ist als die Aufsteiger, verliert trotzdem Spieler");
        }

        // Der eigene Verein: Niemand geht ungefragt, die zu Guten wollen weg
        const eigener = state.clubs.find(c => c.id === state.userClubId);
        const kaderVorher = eigener.playerIds.slice();
        CompetitionEngine.moveClubToLeague(eigener, liga("de_liga_2"));
        const r2 = SeasonEngine.abstiegsfolgen(state, { relegated: [{ clubId: eigener.id, fromLeague: "de_liga_1", toLeague: "de_liga_2" }], promoted: [] }, () => 0);
        if (r2.wechsel.length || eigener.playerIds.join() !== kaderVorher.join()) throw new Error("Beim eigenen Verein gehen Spieler ungefragt");
        if (r2.wuensche.length < 1 || r2.wuensche.length > SeasonEngine.ABSTIEG.hoechstens) throw new Error(`${r2.wuensche.length} Wechselwünsche`);
        r2.wuensche.forEach(id => {
            const p = state.players.find(x => x.id === id);
            if (!p.wechselwunsch || !state.inbox.some(m => m.subject === `${p.name} möchte wechseln`)) throw new Error(`${p.name}: kein Wechselwunsch im Postfach`);
        });
    });

    test("Welt: Karriereende ab 31 (Amateure ab 30), gemessen am eigenen Kader", () => {
        const c = (alter, staerke, niveau, stufe) => SeasonEngine.karriereendeChance({ age: alter, overall: staerke }, niveau, stufe);
        // Vorher begann es erst mit 32 - vor 31 verließ kaum jemand die Welt
        if (c(30, 78, 79, 1) !== 0) throw new Error("Ein Dreißigjähriger in der Bundesliga hört schon auf");
        if (!(c(31, 78, 79, 1) > 0)) throw new Error("Mit 31 hört in der Bundesliga niemand auf");
        if (!(c(30, 40, 41, 5) > 0)) throw new Error("In der Oberliga hört mit 30 niemand auf");
        if (c(38, 99, 79, 1) !== 1) throw new Error("Mit 38 spielt noch jemand");
        // Die Stärke zählt am eigenen Kader: in der Bundesliga wie in der Landesliga
        [[1, 79], [7, 22]].forEach(([stufe, niveau]) => {
            const traeger = c(33, niveau + 5, niveau, stufe), normal = c(33, niveau, niveau, stufe), ergaenzung = c(33, niveau - 12, niveau, stufe);
            if (!(traeger < normal && normal < ergaenzung)) throw new Error(`Stufe ${stufe}: Träger ${traeger}, normal ${normal}, Ergänzung ${ergaenzung}`);
        });
        // Mit jedem Jahr wahrscheinlicher
        for (let a = 31; a < 37; a++) if (!(c(a + 1, 78, 79, 1) > c(a, 78, 79, 1))) throw new Error(`Mit ${a + 1} nicht wahrscheinlicher als mit ${a}`);

        // In einer echten Welt: Wer mit Verein aufhört, ist mindestens 30
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const mitVerein = new Set(state.players.filter(p => p.clubId).map(p => p.id));
        const vorher = new Map(state.players.map(p => [p.id, p]));
        SeasonEngine.processRetirements(state);
        const weg = [...vorher.values()].filter(p => mitVerein.has(p.id) && !state.players.includes(p));
        if (!weg.length) throw new Error("Niemand hört auf");
        const zuJung = weg.filter(p => p.age < 30);
        if (zuJung.length) throw new Error(`${zuJung.length} Spieler unter 30 hören auf`);
    });

    test("Welt: KI-Vereine messen Verträge und Vereinslose am eigenen Kader", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const niveau = ContractEngine.niveauKarte(state);
        const landesliga = state.clubs.find(c => c.level === 7);
        const bundesliga = state.clubs.find(c => c.leagueId === "de_liga_1" && c.id !== state.userClubId);
        const nl = niveau.get(landesliga.id), nb = niveau.get(bundesliga.id);
        if (!(nl < 40) || !(nb > 70)) throw new Error(`Niveaus unplausibel: Landesliga ${nl}, Bundesliga ${nb}`);
        // Ein Stammspieler der Landesliga ist für seinen Verein so wichtig wie
        // einer der Bundesliga für seinen - vorher galt fest "ab 55"
        const stamm = { overall: Math.round(nl - 3), age: 27 };
        if (SeasonEngine.haltequote(stamm, nl) !== SeasonEngine.haltequote({ overall: Math.round(nb - 3), age: 27 }, nb)) {
            throw new Error("Der Landesligist hält seinen Stammspieler seltener als der Bundesligist");
        }
        if (SeasonEngine.haltequote({ overall: Math.round(nl - 20), age: 29 }, nl) >= SeasonEngine.haltequote(stamm, nl)) {
            throw new Error("Der Schwächste wird so gern gehalten wie der Stammspieler");
        }
        // Vereinslose: ein Bundesligaspieler heuert nicht in der Landesliga an
        if (SeasonEngine.passtZumKader({ overall: Math.round(nb) }, nl)) throw new Error("Der Landesligist holt einen Bundesligaspieler");
        if (!SeasonEngine.passtZumKader({ overall: Math.round(nl) }, nl)) throw new Error("Der Landesligist holt keinen Spieler seines Niveaus");
        if (SeasonEngine.passtZumKader({ overall: Math.round(nb - 25) }, nb)) throw new Error("Der Bundesligist holt einen viel schwächeren Spieler");
    });

    test("Nationaltrainer: Posten nach Ruf, der eigene Kader reist, Ausrichtung wirkt, der Verband zieht Bilanz", () => {
        const { NationalTeamEngine: N } = require('./js/engine/nationalTeamEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer", nationality: "Deutschland" });
        const club = state.clubs.find(c => c.id === state.userClubId);

        // Posten: jede Saison einige frei, der Ruf richtet sich nach dem Weltrang
        const posten = N.posten(state);
        const frei = posten.filter(p => p.frei);
        if (frei.length < 2) throw new Error(`${frei.length} freie Posten`);
        const fremd = posten.filter(p => p.name !== "Deutschland");
        if (!(fremd[0].anforderung > fremd[fremd.length - 1].anforderung)) throw new Error("Die Spitze verlangt nicht mehr Ruf als der Rest");
        const heimat = posten.find(p => p.name === "Deutschland");
        if (heimat && heimat.anforderung !== N.anforderung(Object.assign({}, state, { managerNationality: "Brasilien" }), heimat.rang, "Deutschland") - N.HEIMAT_BONUS) {
            throw new Error("Die Heimat verlangt nicht weniger");
        }

        // Ohne Ruf keine Nationalmannschaft
        const ziel = frei[0];
        const rufVorher = club.reputation;
        club.reputation = 5;
        const abgelehnt = N.bewerben(state, ziel.name);
        if (abgelehnt.ok || !/Ruf/.test(abgelehnt.grund)) throw new Error("Ohne Ruf angenommen: " + JSON.stringify(abgelehnt));
        club.reputation = 99;
        const besetzt = posten.find(p => !p.frei);
        if (besetzt && N.bewerben(state, besetzt.name).ok) throw new Error("Ein besetzter Posten wurde vergeben");
        const angenommen = N.bewerben(state, ziel.name);
        if (!angenommen.ok || state.nationaltrainer?.nation !== ziel.name) throw new Error("Bewerbung mit Ruf scheitert: " + JSON.stringify(angenommen));
        if (N.bewerben(state, frei[1].name).ok) throw new Error("Zwei Nationen gleichzeitig");
        if (N.freiePosten(state).includes(ziel.name)) throw new Error("Der eigene Posten gilt noch als frei");

        // Der eigene Kader reist: der Beste bleibt zu Hause, ein Ergänzungsspieler fährt mit
        const alle = N.kandidaten(state, ziel.name);
        const beste = N.nominiere({ spieler: alle });
        const extra = p => alle.filter(x => !beste.includes(x) && N.gruppe(x.pos) === N.gruppe(p.pos));
        const star = beste.find(p => extra(p).length >= 2);
        const [ersatz, naechster] = extra(star);
        // Fällt ein Berufener aus demselben Mannschaftsteil aus, rückt der
        // Nächstbeste nach - nicht der gestrichene Star. Vorher holte die
        // Nachnominierung genau ihn zurück.
        const verletzt = beste.find(p => p !== star && N.gruppe(p.pos) === N.gruppe(star.pos));
        verletzt.injuredWeeks = 3;
        const auswahl = beste.filter(p => p !== star).map(p => p.id).concat([ersatz.id]);
        N.setzeAuswahl(state, auswahl);
        N.tag(state, "abreise");
        const reist = state.laenderspielPause.kader[ziel.name].map(String);
        if (reist.includes(String(star.id))) throw new Error("Der Gestrichene reist trotzdem");
        if (!reist.includes(String(ersatz.id))) throw new Error("Der Berufene bleibt zu Hause");
        if (reist.includes(String(verletzt.id)) || reist.length !== 23) throw new Error(`Verletzt mitgereist oder nicht aufgefüllt (${reist.length})`);
        if (!reist.includes(String(naechster.id))) throw new Error("Für den Verletzten rückt nicht der Nächstbeste nach");
        const nachricht = state.inbox.find(m => /Nachnominierung/.test(m.subject));
        if (!nachricht || !nachricht.body.includes(verletzt.name) || !nachricht.body.includes(naechster.name)) {
            throw new Error("Die Nachricht zur Nachnominierung nennt nicht, wer fehlt und wer nachrückt");
        }
        // Gibt es niemand anderen mehr, kommt der Gestrichene doch
        const sperre = extra(star).filter(p => p !== ersatz);
        sperre.forEach(p => { p.injuredWeeks = 3; });
        const notfall = N.nutzerKader(state, ziel.name);
        if (!notfall.kader.includes(star) || notfall.kader.length !== 23) throw new Error("Ohne Alternative bleibt eine Lücke statt des Gestrichenen");
        sperre.forEach(p => { p.injuredWeeks = 0; });
        // Andere Nationen berufen weiter selbst
        const andere = N.nationen(state).find(n => n.name !== ziel.name);
        if (state.laenderspielPause.kader[andere.name].length !== N.nominiere(andere).length) throw new Error("Andere Nationen nominieren anders");

        // Zwei Länderspiele werden verbucht, das Vertrauen bewegt sich
        N.tag(state, "spiel");
        N.tag(state, "rueckkehr");
        if (state.nationaltrainer.spiele.length !== 2) throw new Error(`${state.nationaltrainer.spiele.length} eigene Länderspiele verbucht`);
        verletzt.injuredWeeks = 0;

        // Ausrichtung: offensiv mehr Tore auf beiden Seiten als defensiv
        // Gleich starke Gegner, damit nur die Ausrichtung zählt
        const team = (name) => {
            const nation = N.nationen(state).find(n => n.name === name) || andere;
            const kader = N.nominiere(nation);
            return Object.assign({ name, kader }, N.elf(kader), { staerke: 75 });
        };
        // Einmal nominiert - in 600 Spielen verletzt sich sonst irgendwann jeder
        const heimTeam = team(ziel.name), gastTeam = team("Gegner");
        const tore = (art) => {
            N.setzeAusrichtung(state, art);
            let s = 0, x = 7;
            const zufall = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
            for (let i = 0; i < 600; i++) { const r = N.spiele(state, heimTeam, gastTeam, zufall); s += r.tore[0] + r.tore[1]; }
            return s / 600;
        };
        state.nationaltrainer.spiele = [];
        const offensiv = tore("offensiv"), defensiv = tore("defensiv");
        if (!(offensiv > defensiv + 0.5)) throw new Error(`Tore offensiv ${offensiv.toFixed(2)}, defensiv ${defensiv.toFixed(2)}`);

        // Gemessen an der Erwartung: ein Sieg beim Stärkeren zählt, eine Niederlage beim Schwächeren kostet
        state.nationaltrainer.vertrauen = 60;
        N._verbucheNutzerSpiel(state, { name: "Stark", staerke: 85 }, { name: ziel.name, staerke: 75 }, [0, 1]);
        const nachSieg = state.nationaltrainer.vertrauen;
        N._verbucheNutzerSpiel(state, { name: ziel.name, staerke: 75 }, { name: "Schwach", staerke: 65 }, [0, 2]);
        if (!(nachSieg > 60 + 8) || !(state.nationaltrainer.vertrauen < nachSieg - 8)) throw new Error(`Vertrauen 60 → ${nachSieg} → ${state.nationaltrainer.vertrauen}`);

        // Ein Nationaltrainer mit Rückhalt hat mehr Ruf
        state.nationaltrainer.vertrauen = 70;
        state.nationaltrainer.rangBeiAntritt = 3;
        club.reputation = rufVorher > 80 ? 70 : rufVorher;
        const mit = CareerEngine.ruf(state);
        const gemerkt = state.nationaltrainer;
        state.nationaltrainer = null;
        const ohne = CareerEngine.ruf(state);
        state.nationaltrainer = gemerkt;
        if (mit !== ohne + 4) throw new Error(`Ruf mit ${mit}, ohne ${ohne}`);

        // Der Stand überlebt das Speichern
        const zurueck = SaveCodec.decodeState(JSON.parse(JSON.stringify(SaveCodec.encodeState(state))));
        if (JSON.stringify(zurueck.nationaltrainer) !== JSON.stringify(state.nationaltrainer)) throw new Error("Der Nationaltrainer überlebt das Speichern nicht");

        // Zum Saisonende: zu wenig Vertrauen - der Posten ist weg, er wird wieder frei
        state.nationaltrainer.vertrauen = N.ENTLASSUNG_UNTER - 1;
        const bilanz = N.saisonBilanz(state);
        if (!bilanz.entlassen || state.nationaltrainer) throw new Error("Trotz fehlendem Vertrauen weiter im Amt");
        if (!state.nationaltrainerAkte?.some(a => a.nation === ziel.name && a.ende === "entlassen")) throw new Error("Die Station fehlt in der Akte");
        if (!N.freiePosten(state).includes(ziel.name)) throw new Error("Der Posten wird nicht wieder frei");

        // Angebot zum Saisonstart: annehmen
        club.reputation = 99;
        const angebot = N.pruefeAngebot(state, () => 0);
        if (!angebot) throw new Error("Trotz Ruf kein Angebot");
        if (!N.nimmAngebotAn(state).ok || state.nationaltrainer?.nation !== angebot.nation || state.nationalAngebot) throw new Error("Angebot nicht angenommen");
        if (!N.ruecktritt(state) || state.nationaltrainer) throw new Error("Rücktritt klappt nicht");
        club.reputation = rufVorher;
    });

    test("Vorverträge ab Januar: Anfragen bei eigenen Spielern, eigene Angebote ablösefrei zum Saisonwechsel", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const aufTag = (praefix) => {
            state.currentDayIndex = state.calendar.findIndex(d => d.date.startsWith(praefix) && d.type !== "matchday");
            state.currentDate = state.calendar[state.currentDayIndex].date;
            if (state.preseason) state.preseason.aktiv = false;
        };
        const kader = state.players.filter(p => p.clubId === club.id).sort((a, b) => b.overall - a.overall);
        kader.forEach(p => { p.contractYears = 3; });
        const [p, q, r] = kader;
        [p, q, r].forEach(x => { x.contractYears = 1; });

        // Vor Januar fragt niemand an
        aufTag("15.12");
        if (SeasonEngine.vorvertragsZeit(state)) throw new Error("Vorverträge schon im Dezember");
        if (SeasonEngine.vorvertragTag(state, () => 0).length) throw new Error("Anfragen im Dezember");

        // Ab Januar: erst die Übersicht, dann Anfragen
        aufTag("05.01");
        const meldungen = SeasonEngine.vorvertragTag(state, () => 0);
        if (!state.inbox.some(m => /Ab heute dürfen andere Vereine anfragen: 3 Spieler/.test(m.subject))) throw new Error("Keine Übersicht zum 1. Januar");
        if (![p, q, r].every(x => x.vorvertragInteresse && x.vorvertragInteresse.clubId !== club.id)) throw new Error("Keine Anfrage trotz Zufall 0");
        if (meldungen.filter(m => /bietet .* einen Vorvertrag an/.test(m)).length !== 3) throw new Error(`Meldungen: ${meldungen.join(" | ")}`);
        const hinweise = state.inbox.filter(m => /Ab heute dürfen/.test(m.subject)).length;
        SeasonEngine.vorvertragTag(state, () => 0.99);
        if (state.inbox.filter(m => /Ab heute dürfen/.test(m.subject)).length !== hinweise) throw new Error("Die Übersicht kommt zweimal");

        // Mit einem Angebot auf dem Tisch fordert er mehr - über den Kader
        // gemessen, einzeln verschluckt die Rundung manchmal den Aufschlag
        const forderung = x => ContractEngine.getExtensionDemand(x, club, state).demandWage;
        const ohne = kader.reduce((a, x) => a + (x.vorvertragInteresse ? 0 : forderung(x)), 0);
        const mit = kader.reduce((a, x) => {
            if (x.vorvertragInteresse) return a;
            x.vorvertragInteresse = { clubId: "x", clubName: "X", tag: 0, entscheidetTag: 99 };
            const f = forderung(x);
            delete x.vorvertragInteresse;
            return a + f;
        }, 0);
        if (!(mit > ohne * 1.05)) throw new Error(`Forderungen mit Anfrage ${mit}, ohne ${ohne}`);
        const mitAnfrage = forderung(q);
        // Verlängern erledigt die Anfrage
        q.wage = 1000; club.wageBudget = Math.max(club.wageBudget || 0, mitAnfrage * 2);
        if (!ContractEngine.negotiateExtension(q, club, mitAnfrage, 3, "Stammspieler", 0, state).success) throw new Error("Verlängerung trotz Anfrage gescheitert");
        if (q.vorvertragInteresse) throw new Error("Die Anfrage bleibt nach der Verlängerung");

        // Bedenkzeit: vorher keine Entscheidung, danach Zusage oder Absage
        state.currentDayIndex = p.vorvertragInteresse.entscheidetTag - 1;
        SeasonEngine.vorvertragTag(state, () => 0);
        if (!p.vorvertragInteresse || p.vorvertrag) throw new Error("Entscheidung vor Ablauf der Bedenkzeit");
        state.currentDayIndex = p.vorvertragInteresse.entscheidetTag;
        const zielP = p.vorvertragInteresse.clubId;
        r.vorvertragInteresse.entscheidetTag = state.currentDayIndex + 5;
        SeasonEngine.vorvertragTag(state, () => 0);
        if (!p.vorvertrag || p.vorvertrag.clubId !== zielP || p.vorvertragInteresse) throw new Error("Keine Zusage trotz Zufall 0");
        if (!state.inbox.some(m => m.subject === `${p.name} unterschreibt bei ${p.vorvertrag.clubName}`)) throw new Error("Keine Meldung zur Unterschrift");
        state.currentDayIndex = r.vorvertragInteresse.entscheidetTag;
        SeasonEngine.vorvertragTag(state, () => 0.9999);
        if (r.vorvertrag || r.vorvertragInteresse) throw new Error("Absage nicht verarbeitet");
        if (!state.inbox.some(m => /sagt .* ab/.test(m.subject))) throw new Error("Keine Meldung zur Absage");

        // Wer unterschrieben hat, verlängert nicht und wird nicht verkauft
        if (ContractEngine.negotiateExtension(p, club, 999999, 3, "Stammspieler", 0, state).success) throw new Error("Verlängerung trotz Vorvertrag");
        const dritter = state.clubs.find(c => c.id !== club.id && c.id !== zielP);
        if (TransferEngine.executeTransfer(state, p.id, dritter.id, 1000000, 5000, 3)) throw new Error("Verkauf an Dritte trotz Vorvertrag");

        // Eigenes Angebot: ein Spieler eines anderen Vereins mit auslaufendem Vertrag
        const fremd = state.players.filter(x => x.clubId && x.clubId !== club.id && x.clubId !== zielP && !x.leihe)
            .sort((a, b) => b.overall - a.overall)[0];
        fremd.contractYears = 2;
        if (!/läuft nicht/.test(NegotiationEngine.vorvertragHindernis(state, fremd))) throw new Error("Vorvertrag trotz zwei Jahren Restlaufzeit");
        fremd.contractYears = 1;
        aufTag("15.12");
        if (!/1\. Januar/.test(NegotiationEngine.vorvertragHindernis(state, fremd))) throw new Error("Vorvertrag schon im Dezember");
        // Im März ist das Fenster zu - ein Vorvertrag geht trotzdem
        aufTag("10.03");
        if (TransferEngine.istTransferfenster(state)) throw new Error("Im März ist das Fenster offen");
        if (NegotiationEngine.startTransferNegotiation(state, fremd.id, club.id).success) throw new Error("Normaler Transfer bei geschlossenem Fenster");
        const res = NegotiationEngine.startTransferNegotiation(state, fremd.id, club.id, null, { vorvertrag: true });
        if (!res.success) throw new Error(`Vorvertrag nicht möglich: ${res.error}`);
        const n = res.negotiation;
        if (n.stage !== "terms" || n.demand.fee !== 0 || !n.vorvertrag) throw new Error("Die Verhandlung beginnt nicht bei den Konditionen");
        const kontoVorher = club.balance;
        NegotiationEngine.submitOffer(state, n.id, { wage: n.demand.wage, years: 4, signingBonus: n.demand.signingBonus, agentFee: n.demand.agentFee });
        state.currentDayIndex = n.replyDay;
        const schritte = NegotiationEngine.processDay(state);
        if (!schritte.some(e => e.kind === "precontract")) throw new Error(`Kein Vorvertrag: ${schritte.map(e => e.kind).join(",")}`);
        if (fremd.clubId === club.id || fremd.vorvertrag?.clubId !== club.id || fremd.vorvertrag.years !== 4) throw new Error("Der Vorvertrag steht nicht beim Spieler");
        if (!(club.balance < kontoVorher)) throw new Error("Handgeld und Honorar nicht bezahlt");
        if (NegotiationEngine.startTransferNegotiation(state, fremd.id, dritter.id).success) throw new Error("Andere verhandeln trotz Vorvertrag");

        // Der Spielstand behält alles
        const zurueck = SaveCodec.decodeState(JSON.parse(JSON.stringify(SaveCodec.encodeState(state))));
        if (zurueck.players.find(x => x.id === fremd.id).vorvertrag?.clubId !== club.id) throw new Error("Der Vorvertrag überlebt das Speichern nicht");

        // Saisonwechsel: Beide Vorverträge werden vollzogen
        p.contractYears = 0; fremd.contractYears = 0;
        const lohn = fremd.vorvertrag.wage;
        SeasonEngine.processContractExpiries(state);
        if (p.clubId !== zielP) throw new Error("Der eigene Spieler ist nicht gewechselt");
        if (fremd.clubId !== club.id || fremd.wage !== lohn || fremd.contractYears !== 4 || fremd.vorvertrag) throw new Error("Der Neuzugang ist nicht zu den vereinbarten Konditionen da");
        if (!state.inbox.some(m => /Per Vorvertrag da/.test(m.subject) && m.subject.includes(fremd.name))) throw new Error("Keine Meldung zum Neuzugang");
    });

    test("Vertragsgespräche: gewünschte Rolle, Wechselwunsch, Unzufriedenheit und Treue", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        club.wageBudget = 1e9;
        const kader = state.players.filter(p => p.clubId === club.id);
        kader.forEach(p => { p.hiddenAttributes = { ...(p.hiddenAttributes || {}), loyalty: 10 }; delete p.wechselwunsch; p.happiness = { ...(p.happiness || {}), overall: 75 }; });
        const summe = (rolle) => kader.reduce((a, p) => a + ContractEngine.getExtensionDemand(p, club, state, rolle ? rolle(p) : null).demandWage, 0);
        const wunsch = p => ContractEngine.getExtensionDemand(p, club, state).preferredRole;
        const eineDarunter = p => ContractEngine.ROLLEN[Math.min(3, ContractEngine.ROLLEN.indexOf(wunsch(p)) + 1)];

        // Eine Stufe unter dem Wunsch kostet mehr, die gewünschte Rolle nichts extra
        const basis = summe(null);
        if (summe(wunsch) !== basis) throw new Error("Die gewünschte Rolle verändert die Forderung");
        if (!(summe(eineDarunter) > basis * 1.06)) throw new Error(`Weniger Rolle, kaum mehr Geld: ${summe(eineDarunter)} gegen ${basis}`);

        // Zwei Stufen darunter unterschreibt er nicht - zu keinem Gehalt
        const stamm = kader.find(p => wunsch(p) === "Stammspieler") || kader[0];
        const soll = wunsch(stamm);
        const zweiDarunter = ContractEngine.ROLLEN[ContractEngine.ROLLEN.indexOf(soll) + 2] || "Ergänzungsspieler";
        const nein = ContractEngine.negotiateExtension(stamm, club, 1e7, 3, zweiDarunter, 0, state);
        if (nein.success || !/sieht sich als/.test(nein.reason)) throw new Error(`Zwei Stufen unter dem Wunsch: ${nein.reason}`);

        // Zukunftstalent: für einen Jungen mit Luft nach oben passend, sonst Ergänzungsspieler
        const jung = { age: 19, overall: 60, pot: 80 };
        const alt = { age: 28, overall: 70, pot: 70 };
        if (ContractEngine.rollenAbstand(jung, "Stammspieler", "Zukunftstalent") !== 0) throw new Error("Zukunftstalent passt nicht zum Talent");
        if (ContractEngine.rollenAbstand(alt, "Stammspieler", "Zukunftstalent") !== 2) throw new Error("Zukunftstalent für einen Achtundzwanzigjährigen");
        if (ContractEngine.rollenAbstand(alt, "Stammspieler", "Schlüsselspieler") !== -1) throw new Error("Die höhere Rolle zählt nicht");

        // Wechselwunsch und tiefe Unzufriedenheit: kein Gespräch
        const weg = kader.find(p => p !== stamm);
        weg.wechselwunsch = { seit: 1, grund: "Ich will weg." };
        const r1 = ContractEngine.negotiateExtension(weg, club, 1e7, 3, wunsch(weg), 0, state);
        if (r1.success || !/verlassen/.test(r1.reason)) throw new Error(`Verlängert trotz Wechselwunsch: ${r1.reason}`);
        delete weg.wechselwunsch;
        weg.happiness.overall = 20;
        const r2 = ContractEngine.negotiateExtension(weg, club, 1e7, 3, wunsch(weg), 0, state);
        if (r2.success || !/unzufrieden/.test(r2.reason)) throw new Error(`Verlängert trotz Unzufriedenheit: ${r2.reason}`);
        weg.happiness.overall = 75;
        const r3 = ContractEngine.negotiateExtension(weg, club, ContractEngine.getExtensionDemand(weg, club, state, wunsch(weg)).demandWage, 3, wunsch(weg), 0, state);
        if (!r3.success) throw new Error(`Ohne Hindernis klappt es nicht: ${r3.reason}`);

        // Treue: lange da und loyal - das spart Gehalt; ein Neuzugang ist nicht treu
        const ohneTreue = summe(null);
        kader.forEach(p => { p.hiddenAttributes.loyalty = 18; });
        const mitTreue = summe(null);
        if (!(mitTreue < ohneTreue * 0.97)) throw new Error(`Treue spart nichts: ${mitTreue} gegen ${ohneTreue}`);
        const neu = kader[1];
        neu.vereinSeit = (state.seasonYear || 1) * 1000 + 5;
        if (ContractEngine.istTreu(neu, state)) throw new Error("Ein Neuzugang gilt als treu");
        if (!ContractEngine.istTreu(kader[2], state)) throw new Error("Ein loyaler Spieler seit Spielbeginn gilt nicht als treu");
    });

    test("Vorstand: Saisonziel in der Vorbereitung verhandeln, Medienprognose", () => {
        const vorlage = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const mittel = vorlage.clubs.filter(c => c.leagueId === "de_liga_1")
            .map(c => ({ c, z: BoardEngine.bestimmeZiel(vorlage, c) }))
            .find(x => x.z.platz >= 6 && x.z.platz <= 12).c;
        const neu = () => {
            const st = GameState.createNewGame(mittel.id, "normal", { name: "Trainer" });
            return { st, club: st.clubs.find(c => c.id === st.userClubId) };
        };

        // Die Prognose der Medien steht beim Ziel und in der Begründung
        const { st, club } = neu();
        const z = club.vorstandsziel;
        if (!(z.prognose >= 1 && z.prognose <= z.n)) throw new Error(`Keine Medienprognose: ${z.prognose}`);
        if (!/Die Medien sehen uns auf Platz \d+/.test(BoardEngine.zielBegruendung(club))) throw new Error("Die Begründung nennt die Prognose nicht");
        const bayern = vorlage.clubs.find(c => c.id === "muc");
        if (BoardEngine.medienprognose(vorlage, bayern) > 2) throw new Error("Die Medien sehen den Meister nicht vorn");

        // Senken: zwei Plätze tiefer, weniger Budget, etwas weniger Vertrauen
        if (!st.preseason?.aktiv) throw new Error("Neues Spiel ohne Vorbereitung");
        const platz = z.platz, budget = club.transferBudget, vertrauen = club.confidence ?? 75;
        const r = BoardEngine.verhandleZiel(st, "senken");
        if (!r.ok || z.platz !== platz + 2 || club.transferBudget !== budget - Math.round(budget * 0.2)) throw new Error(`Senken: ${JSON.stringify(r)} Platz ${z.platz}, Budget ${club.transferBudget}`);
        if (!((club.confidence ?? 75) < vertrauen)) throw new Error("Ein niedrigeres Ziel kostet kein Vertrauen");
        if (club.boardExpectation !== z.art || BoardEngine.zielPlatz(st, club) !== platz + 2) throw new Error("Zielplatz und Art passen nicht zum neuen Ziel");
        if (!st.inbox.some(m => /Saisonziel gesenkt/.test(m.subject || m.title || ""))) throw new Error("Keine Bestätigung des Vorstands");
        if (BoardEngine.verhandleZiel(st, "erhoehen").ok) throw new Error("Zweimal verhandelt");

        // Erhöhen: zwei Plätze höher, mehr Budget
        const b = neu();
        const p2 = b.club.vorstandsziel.platz, b2 = b.club.transferBudget;
        const r2 = BoardEngine.verhandleZiel(b.st, "erhoehen");
        if (!r2.ok || b.club.vorstandsziel.platz !== p2 - 2 || b.club.transferBudget !== b2 + Math.round(b2 * 0.2)) throw new Error("Erhöhen klappt nicht");

        // Nach der Vorbereitung redet der Vorstand nicht mehr
        const c = neu();
        c.st.preseason.aktiv = false;
        const r3 = BoardEngine.verhandleZiel(c.st, "senken");
        if (r3.ok || !/Vorbereitung/.test(r3.grund)) throw new Error("Verhandelt nach der Vorbereitung");

        // Der Spielstand behält die Absprache
        const zurueck = SaveCodec.decodeState(JSON.parse(JSON.stringify(SaveCodec.encodeState(st))));
        if (zurueck.clubs.find(x => x.id === club.id).vorstandsziel.verhandelt !== "senken") throw new Error("Die Absprache überlebt das Speichern nicht");
    });

    test("Gleiche Bedingungen: KI-Elfen erholen sich wie die eigene, die Moral folgt bei allen der Form", () => {
        const { DressingRoomEngine } = require('./js/engine/dressingRoomEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const ki = state.clubs.find(c => c.leagueId === club.leagueId && c.id !== club.id);
        const kiSpieler = state.players.find(p => p.clubId === ki.id);

        // Ein Spiel kostet 15, die Woche danach holt den Großteil zurück -
        // über eine Saison pendelt sich die KI-Fitness bei rund 90 ein,
        // statt Woche für Woche weiter abzusacken
        kiSpieler.fitness = 100;
        for (let i = 0; i < 20; i++) {
            kiSpieler.fitness = Math.max(35, kiSpieler.fitness - 15);
            TrainingEngine.processWeeklyTraining(state);
        }
        if (kiSpieler.fitness < 85) throw new Error(`KI-Fitness vor dem Anpfiff nach 20 Spielen: ${kiSpieler.fitness}`);

        // Moral: dasselbe Ziel aus der Form für beide Seiten
        ki.form = ["W", "W", "D", "L", "W"];
        club.form = ["W", "W", "D", "L", "W"];
        if (DressingRoomEngine.formZiel(ki) !== DressingRoomEngine.formZiel(club)) throw new Error("Unterschiedliche Ziele bei gleicher Form");
        const ziel = DressingRoomEngine.formZiel(club);
        const kader = state.players.filter(p => club.playerIds.includes(p.id));
        const [hoch, tief] = kader;
        hoch.morale = 99; tief.morale = 30;
        for (let tag = 0; tag < 5; tag++) DressingRoomEngine.settleDaily(state);
        // Zwischen zwei Spielen bildet sich gut ein Viertel des Ausschlags zurück
        if (!(hoch.morale < 99 - (99 - ziel) * 0.25)) throw new Error(`Hohe Moral bleibt oben: ${hoch.morale.toFixed(1)} (Ziel ${ziel.toFixed(1)})`);
        if (!(tief.morale > 30 + (ziel - 30) * 0.25)) throw new Error(`Tiefe Moral erholt sich nicht: ${tief.morale.toFixed(1)}`);
        if (hoch.morale < ziel || tief.morale > ziel) throw new Error("Die Moral schießt über das Ziel hinaus");
    });

    test("Relegation und Aufstiegs-Playoffs: Formate der fünf Länder, Termine in der Sommerpause, Auf- und Abstieg", () => {
        const { PlayoffEngine } = require('./js/engine/playoffEngine.js');
        const tabellen = (st, punkte = null) => st.leagues.forEach(l => {
            const clubs = st.clubs.filter(c => c.leagueId === l.id).sort((a, b) => (b.reputation || 0) - (a.reputation || 0) || String(a.id).localeCompare(String(b.id)));
            st.standingsByLeague[l.id] = clubs.map((c, i) => ({ clubId: c.id, clubName: c.name, points: punkte ? punkte(l.id, i) : (clubs.length - i) * 3,
                played: 34, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, form: [] }));
        });
        const vorlage = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        tabellen(vorlage);
        const sechzehnter = vorlage.standingsByLeague.de_liga_1[15].clubId;
        const st = GameState.createNewGame(sechzehnter, "normal", { name: "Trainer" });
        tabellen(st);
        st.standings = st.standingsByLeague.de_liga_1;
        const platz = (liga, p) => st.standingsByLeague[liga][p - 1].clubId;
        const groessen = () => Object.fromEntries(st.leagues.map(l => [l.id, st.clubs.filter(c => c.leagueId === l.id).length]));
        const vorher = groessen();
        st.currentDayIndex = st.calendar.map(d => d.type).lastIndexOf("matchday") + 1;
        st.currentMatchday = st.totalMatchdays;
        SeasonEngine.finishSeason(st);

        // Die Formate nach den echten Regeln
        const w = id => st.playoffs.wettbewerbe.find(x => x.id === id);
        const erstes = (id, r = 0) => w(id).runden[r].paarungen.map(p => p.spiele[0]);
        const rel = erstes("po_de_liga_2")[0];
        if (rel.homeClubId !== platz("de_liga_1", 16) || rel.awayClubId !== platz("de_liga_2", 3)) throw new Error("Relegation: Hinspiel nicht beim 16. der Bundesliga gegen den Dritten der 2. Liga");
        if (erstes("po_de_liga_3")[0].homeClubId !== platz("de_liga_3", 3)) throw new Error("Relegation zur 2. Liga: Hinspiel nicht beim Drittligisten");
        const en = erstes("po_en_liga_2").map(m => m.homeClubId).sort();
        if (JSON.stringify(en) !== JSON.stringify([platz("en_liga_2", 5), platz("en_liga_2", 6)].sort())) throw new Error("Championship: Der Fünfte und Sechste haben nicht zuerst Heimrecht");
        if (w("po_es_liga_2").runden[0].paarungen[0].spiele.length !== 2) throw new Error("Segunda: kein Hin- und Rückspiel");
        const it = erstes("po_it_liga_2");
        if (w("po_it_liga_2").runden[0].paarungen.some(p => p.spiele.length !== 1) || !it.some(m => m.homeClubId === platz("it_liga_2", 5) && m.awayClubId === platz("it_liga_2", 8))) throw new Error("Serie B: Vorrunde nicht in einem Spiel beim Fünften gegen den Achten");
        if (erstes("po_fr_liga_2")[0].homeClubId !== platz("fr_liga_2", 4)) throw new Error("Ligue 2: Play-off 1 nicht beim Vierten");
        // Direkt steigen nur die ersten beiden auf - auch in alten Spielständen mit drei Plätzen
        if (JSON.stringify(PlayoffEngine.direktePlaetze({ id: "en_liga_2", promotionSpots: [1, 2, 3] })) !== "[1,2]") throw new Error("Der Dritte der Championship steigt direkt auf");

        // Termine in der Sommerpause, der Weiter-Knopf hält beim eigenen Spiel
        const tage = st.calendar.filter(d => d.cupArt === "playoff");
        if (tage.map(d => d.pauseTag).join(",") !== PlayoffEngine.TERMIN_TAGE.join(",") || !tage.every(d => d.sommerpause)) throw new Error("Die Spieltermine liegen nicht in der Sommerpause");
        const eigene = PlayoffEngine.eigenePartieAm(st, 0);
        if (!eigene || eigene.partie !== rel) throw new Error("Die eigene Relegation wird nicht gefunden");
        const halt = CalendarEngine.naechsterHalt(st);
        if (!halt || halt.grund !== "playoff" || st.calendar[halt.index] !== tage[0]) throw new Error("Der Weiter-Knopf hält nicht vor dem Relegationsspiel");
        if (!st.inbox.some(m => /Relegation zur Bundesliga: Wir sind dabei/.test(m.subject || m.title || ""))) throw new Error("Keine Nachricht zur Relegation");

        // Bis zum Saisonwechsel: alles gespielt, Auf- und Abstieg nach den Ergebnissen
        let res = null;
        for (let i = 0; i < 40 && (!res || res.type !== "season_change"); i++) res = CalendarEngine.advanceOneDay(st);
        if (!res || res.type !== "season_change") throw new Error("Kein Saisonwechsel nach der Sommerpause");
        const vj = st.playoffsVorjahr;
        if (!vj || !vj.wettbewerbe.every(x => x.fertig && x.ergebnis)) throw new Error("Nicht alle Playoffs sind entschieden");
        if (!rel.played || !w2(vj, "po_de_liga_2").runden[0].paarungen[0].spiele.every(m => m.played)) throw new Error("Die eigenen Relegationsspiele wurden nicht gespielt");
        function w2(po, id) { return po.wettbewerbe.find(x => x.id === id); }
        const relE = w2(vj, "po_de_liga_2").ergebnis;
        const nutzer = st.clubs.find(c => c.id === sechzehnter);
        if (relE.absteiger ? nutzer.leagueId !== "de_liga_2" : nutzer.leagueId !== "de_liga_1") throw new Error(`Relegation falsch umgesetzt: ${JSON.stringify(relE)}, Verein jetzt ${nutzer.leagueId}`);
        const enSieger = w2(vj, "po_en_liga_2").ergebnis.aufsteiger;
        if (st.clubs.find(c => c.id === enSieger).leagueId !== "en_liga_1") throw new Error("Der Sieger der Championship-Playoffs ist nicht aufgestiegen");
        if (JSON.stringify(groessen()) !== JSON.stringify(vorher)) throw new Error("Ligagrößen nach dem Saisonwechsel verändert");
        // Die Spiele zählen nicht zur neuen Saison
        if (st.players.filter(p => p.clubId === sechzehnter).some(p => (p.stats?.matches || 0) > 0)) throw new Error("Relegationsspiele stehen in der Statistik der neuen Saison");

        // Gleichstand: Serie B ohne Verlängerung der besser Platzierte, Segunda nach
        // Verlängerung der besser Platzierte, sonst Elfmeterschießen
        const zufall = Math.random;
        Math.random = () => 0.99;
        try {
            const a = { clubId: "x1", platz: 3, liga: "it_liga_2" }, b = { clubId: "x2", platz: 6, liga: "it_liga_2" };
            const spiel = (h, g, th, tg) => ({ homeClubId: h, awayClubId: g, homeGoals: th, awayGoals: tg, played: true });
            const pIt = { a, b, spiele: [spiel("x2", "x1", 1, 1), spiel("x1", "x2", 0, 0)] };
            PlayoffEngine.entscheide(st, { ligaId: "it_liga_2" }, pIt);
            if (pIt.sieger !== "x1" || pIt.spiele[1].verlaengerung) throw new Error("Serie B: Gleichstand nicht für den besser Platzierten ohne Verlängerung");
            const pEs = { a, b, spiele: [spiel("x2", "x1", 2, 1), spiel("x1", "x2", 1, 0)] };
            PlayoffEngine.entscheide(st, { ligaId: "es_liga_2" }, pEs);
            if (pEs.sieger !== "x1" || !pEs.spiele[1].verlaengerung || pEs.spiele[1].penaltyScore) throw new Error("Segunda: nicht Verlängerung und dann der besser Platzierte");
            const pDe = { a, b, spiele: [spiel("x1", "x2", 0, 0), spiel("x2", "x1", 1, 1)] };
            PlayoffEngine.entscheide(st, { ligaId: "de_liga_2" }, pDe);
            if (!pDe.spiele[1].penaltyScore || !pDe.sieger) throw new Error("Relegation: kein Elfmeterschießen nach Gleichstand");
        } finally {
            Math.random = zufall;
        }

        // Serie B: 15 Punkte Vorsprung des Dritten - er steigt ohne Playoffs auf
        const ohne = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        tabellen(ohne, (liga, i) => liga === "it_liga_2" && i === 2 ? 1000 : (i <= 2 ? 2000 - i : 900 - i));
        PlayoffEngine.setzeAn(ohne);
        const b = ohne.playoffs.wettbewerbe.find(x => x.id === "po_it_liga_2");
        if (!b.direkt || b.ergebnis.aufsteiger !== ohne.standingsByLeague.it_liga_2[2].clubId) throw new Error("Serie B: Der Dritte mit großem Vorsprung steigt nicht direkt auf");

        // Ein Spielstand ohne angesetzte Playoffs holt sie beim Saisonwechsel nach
        delete ohne.playoffs;
        PlayoffEngine.abschliessen(ohne);
        if (!ohne.playoffs.wettbewerbe.every(x => x.fertig)) throw new Error("Ohne angesetzte Playoffs wird beim Saisonwechsel nichts entschieden");
    });

    test("Budget umschichten: freier Gehaltsetat ins Transferbudget und zurück, nur für die laufende Saison", () => {
        const { FinanceEngine: F } = require('./js/engine/financeEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const gehaelter = F.wochengehaelter(state, club);
        club.wageBudget = Math.round(gehaelter + 50000);
        club.transferBudget = 10000000;
        const etat = club.wageBudget;
        const raum = F.umschichtSpielraum(state, club);
        if (raum.gehaltFrei !== Math.floor(etat - gehaelter)) throw new Error(`Freier Etat falsch: ${raum.gehaltFrei}`);
        // Kurs: die Wochen bis zum Saisonwechsel
        const wochen = Math.round((state.calendar.length - 1 - state.currentDayIndex) / 7);
        if (raum.wochen !== Math.max(4, Math.min(52, wochen))) throw new Error(`Wochen bis zum Saisonwechsel: ${raum.wochen} statt ${wochen}`);

        // Mehr als frei ist, geht nicht - die Verträge müssen bezahlt bleiben
        if (F.schichteUm(state, 60000).ok) throw new Error("Mehr umgeschichtet, als im Etat frei ist");
        const r = F.schichteUm(state, 20000);
        if (!r.ok || club.wageBudget !== etat - 20000 || club.transferBudget !== 10000000 + 20000 * raum.wochen) throw new Error(`Umschichtung ins Transferbudget falsch: ${JSON.stringify(r)}`);
        // Zurück: Das Transferbudget bezahlt den Etat bis Saisonende
        const zuViel = Math.floor(club.transferBudget / raum.wochen) + 1;
        if (F.schichteUm(state, -zuViel).ok) throw new Error("Mehr Gehaltsetat gekauft, als das Transferbudget hergibt");
        const r2 = F.schichteUm(state, -5000);
        if (!r2.ok || club.wageBudget !== etat - 15000) throw new Error("Umschichtung in den Gehaltsetat falsch");
        if (F.umschichtSpielraum(state, club).umgeschichtet !== 15000) throw new Error("Der Stand der Umschichtung wird nicht geführt");

        // Zum Saisonwechsel gilt wieder der Etat des Vorstands
        state.seasonYear++;
        F.budgetZuruecksetzen(state);
        if (club.wageBudget !== etat || club.budgetUmschichtung) throw new Error(`Etat nach dem Saisonwechsel: ${club.wageBudget} statt ${etat}`);
    });

    test("Mannschaftsbesprechung: Lob nach guter Serie, Forderung nach schlechter, Sperre und Abnutzung", () => {
        const { PlayerTalkEngine: T } = require('./js/engine/playerTalkEngine.js');
        const neu = (form, moral) => {
            const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
            const club = state.clubs.find(c => c.id === state.userClubId);
            club.form = form;
            const kader = state.players.filter(p => club.playerIds.includes(p.id));
            kader.forEach(p => { p.morale = moral; p.hiddenAttributes = { ...(p.hiddenAttributes || {}), professionalism: 12, ambition: 12, temperament: 12 }; });
            return { state, club, kader, schnitt: () => kader.reduce((a, p) => a + p.morale, 0) / kader.length };
        };
        const ruhig = () => 0.5;

        // Nach vier Siegen kommt Lob an, Forderungen wirken unfair
        const gut = neu(["W", "W", "W", "D", "W"], 70);
        const lob = T.mannschaftsbesprechung(gut.state, "loben", ruhig);
        if (!lob.success || lob.stimmung !== "gut" || !(gut.schnitt() > 72)) throw new Error(`Lob nach Siegen: ${JSON.stringify(lob)}, Moral ${gut.schnitt()}`);
        const gut2 = neu(["W", "W", "W", "D", "W"], 70);
        if (T.mannschaftsbesprechung(gut2.state, "fordern", ruhig).stimmung !== "schlecht") throw new Error("Forderungen nach Siegen kommen gut an");

        // Nach Niederlagen: Lob wirkt unverdient, ein Weckruf trägt - bei Profis mehr
        const schlecht = neu(["L", "L", "D", "L", "L"], 65);
        if (T.mannschaftsbesprechung(schlecht.state, "loben", ruhig).stimmung !== "schlecht") throw new Error("Lob nach Niederlagen kommt an");
        const weck = neu(["L", "L", "D", "L", "L"], 65);
        const [profi, hitzkopf] = weck.kader;
        profi.hiddenAttributes.professionalism = 18;
        hitzkopf.hiddenAttributes.temperament = 18;
        const r = T.mannschaftsbesprechung(weck.state, "fordern", ruhig);
        if (r.stimmung === "schlecht" || !(profi.morale > hitzkopf.morale)) throw new Error(`Weckruf: ${r.stimmung}, Profi ${profi.morale}, Hitzkopf ${hitzkopf.morale}`);

        // Hängende Köpfe: Druck herausnehmen hilft
        const tief = neu(["L", "D", "L", "W", "L"], 45);
        const d = T.mannschaftsbesprechung(tief.state, "druck", ruhig);
        if (d.stimmung !== "gut" || !(tief.schnitt() > 48)) throw new Error("Druck herausnehmen hilft nicht, wenn die Moral unten ist");

        // Alle zwei Wochen - danach wirkt dieselbe Ansprache nur noch halb
        if (T.mannschaftsbesprechung(gut.state, "loben", ruhig).success) throw new Error("Zwei Besprechungen hintereinander");
        if (T.besprechungGesperrt(gut.state) !== 14) throw new Error("Falsche Sperre");
        gut.state.currentDayIndex += 14;
        gut.kader.forEach(p => { p.morale = 70; });
        const wieder = T.mannschaftsbesprechung(gut.state, "loben", ruhig);
        if (!wieder.success || !wieder.abgenutzt || !(wieder.schnitt < lob.schnitt)) throw new Error("Dieselbe Ansprache nutzt sich nicht ab");
    });

    test("Startbudgets: Die Bundesliga startet nach derselben Formel wie die anderen Ligen", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const erste = state.clubs.filter(c => (c.level || 1) === 1);
        const deutsch = erste.filter(c => c.countryId === "de"), andere = erste.filter(c => c.countryId !== "de");
        const hoechstens = (liste, feld) => Math.max(...liste.map(c => c[feld] || 0));
        // Obergrenze der Formel: 8 Mio. x 3,2 x 1,12 (Spitzenklub, oberer Zufall)
        if (hoechstens(deutsch, "transferBudget") > 8000000 * 3.2 * 1.12 + 1) throw new Error(`Bundesliga über der Formel: ${hoechstens(deutsch, "transferBudget")}`);
        if (hoechstens(deutsch, "transferBudget") > hoechstens(andere, "transferBudget") * 1.3) throw new Error("Bundesliga weit über den anderen Topligen");
        if (hoechstens(deutsch, "balance") > hoechstens(andere, "balance") * 1.3) throw new Error("Kontostand der Bundesliga weit über den anderen");
        const bayern = state.clubs.find(c => c.id === "muc");
        if (!(bayern.transferBudget > 15000000)) throw new Error(`Bayern zu arm: ${bayern.transferBudget}`);
    });

    test("Klasse: Spieler werden absolut an den Ligen des eigenen Landes eingeordnet", () => {
        const { PlayerRatingEngine } = require('./js/engine/playerRatingEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const leiter = PlayerRatingEngine.klassenLeiter(state);
        const namen = leiter.stufen.map(s => s.name);
        if (namen[0] !== "Bundesliga" || !namen.includes("Regionalliga") || namen[namen.length - 1] !== "Landesliga") throw new Error(`Leiter falsch: ${namen.join(", ")}`);
        leiter.stufen.forEach((s, i) => {
            if (s.spitze < s.stamm) throw new Error(`${s.name}: Spitze unter Stammspieler`);
            if (i > 0 && !(leiter.stufen[i - 1].stamm > s.stamm)) throw new Error(`${s.name} nicht schwächer als die Stufe darüber`);
        });
        const bl = leiter.stufen[0], ll = leiter.stufen[leiter.stufen.length - 1];
        const text = (o) => PlayerRatingEngine.klasse(state, o).text;
        if (text(bl.stamm) !== "Stammspieler der Bundesliga" || text(bl.spitze) !== "Spitzenspieler der Bundesliga") throw new Error(`Bundesliga: ${text(bl.stamm)} / ${text(bl.spitze)}`);
        if (text(ll.stamm) !== "Stammspieler der Landesliga") throw new Error(`Landesliga: ${text(ll.stamm)}`);
        if (PlayerRatingEngine.klasse(state, 5).key !== "ergaenzung" || PlayerRatingEngine.klasse(state, 99).key !== "welt") throw new Error("Ränder falsch");

        // Die Spielerkarte nennt die Klasse - beim eigenen Spieler ohne "ca."
        const eigener = state.players.filter(p => p.clubId === "muc").sort((a, b) => a.overall - b.overall)[5];
        const karte = PlayerRatingEngine.calculateVisiblePlayerCard(eigener, { state, userClubId: "muc", userSquadAvgAbility: 150 });
        if (!karte.klasse || karte.abilityLabel !== karte.klasse.text) throw new Error(`Karte ohne Klasse: ${karte.abilityLabel}`);
        // Ohne Spielstand bleibt es bei den festen Schwellen
        const ohne = PlayerRatingEngine.calculateVisiblePlayerCard(eigener, { userClubId: "muc", userSquadAvgAbility: 150 });
        if (ohne.klasse !== null) throw new Error("Klasse ohne Spielstand");

        // Ein Talent bekommt ein Ziel in derselben Sprache
        const talent = Object.assign({}, eigener, { id: "talent_test", age: 18, overall: bl.stamm - 12, pot: bl.spitze + 2,
            trueCurrentAbility: (bl.stamm - 12) * 2, truePotentialAbility: (bl.spitze + 2) * 2 });
        const tk = PlayerRatingEngine.calculateVisiblePlayerCard(talent, { state, userClubId: "muc", userSquadAvgAbility: 150 });
        if (!tk.potentialKlasse || !/^Kann .* werden$/.test(tk.potentialKlasse) || !tk.potentialKlasse.includes("Bundesliga")) throw new Error(`Talent ohne Ziel: ${tk.potentialKlasse}`);
    });

    test("Wirtschaft: Fernsehgeld je Land, Ticketpreise nach Ruf, Prämien und Gehaltsquote der Spitze", () => {
        const { CupEngine } = require('./js/engine/cupEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const verein = (land, level, rang) => ({ countryId: land, level, clubStrength: rang });
        const spieltag = (land, rang) => FinanceEngine.sponsorPerMatchday(verein(land, 1, rang));
        // Die Spitze der großen Ligen liegt nah beieinander, die Breite nicht
        if (!(spieltag("en", 1) > spieltag("de", 1) && spieltag("de", 1) > spieltag("it", 1))) throw new Error("Spitze falsch geordnet");
        if (Math.abs(spieltag("es", 1) / spieltag("de", 1) - 1) > 0.1) throw new Error("LaLiga-Spitze weit weg von der Bundesliga");
        if (!(spieltag("en", 0.5) > spieltag("de", 0.5) * 1.3)) throw new Error("Premier-League-Mittelfeld nicht reicher");
        if (!(spieltag("fr", 0.5) < spieltag("de", 0.5) * 0.8)) throw new Error("Ligue-1-Mittelfeld nicht ärmer");
        if (FinanceEngine.landFaktor("xx", 0.5) !== 1) throw new Error("Unbekanntes Land nicht neutral");
        // Startbudgets folgen dem Land
        const top = (land) => state.clubs.filter(c => c.countryId === land && (c.level || 1) === 1).sort((a, b) => (b.clubStrength || 0) - (a.clubStrength || 0));
        const mitte = (land) => { const l = top(land); return l[Math.floor(l.length / 2)]; };
        if (!(mitte("en").balance > mitte("fr").balance)) throw new Error("Startkasse ignoriert das Land");
        // Ticketpreise der Bundesliga nach Ruf statt 35 € für alle
        const preise = top("de").map(c => c.ticketPrice);
        if (new Set(preise).size < 4 || top("de")[0].ticketPrice <= top("de")[top("de").length - 1].ticketPrice) throw new Error(`Ticketpreise: ${preise.join(", ")}`);
        // Europapokal: Der Sieger der Königsklasse bekommt kein halbes Jahresbudget mehr
        const ucl = CupEngine.EURO_PRAEMIE.ucl;
        if (ucl.vf + ucl.hf + ucl.finale + ucl.sieg > 40000000) throw new Error("Europapokalprämien zu hoch");
        // Spitzenklubs tragen fast denselben Anteil Gehalt wie das Mittelfeld
        const spitze = top("de")[0];
        const quote = FinanceEngine.gehaltsbudgetJeSpieltag(spitze, state) / FinanceEngine.einnahmenSchaetzung(spitze, state);
        if (!(quote >= 0.56)) throw new Error(`Gehaltsquote der Spitze ${quote.toFixed(2)}`);
    });

    test("Vorstandsanfragen: Bedenkzeit, Zustimmung nach Vertrauen, Sperre, Zuschuss zum Anlagenausbau", () => {
        const { FacilityEngine } = require('./js/engine/facilityEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        club.balance = 200000000; club.transferBudget = 50000000;
        const anlagen = FacilityEngine.hole(club, state.seasonYear);
        anlagen.trainingGround.stufe = 3; anlagen.youthCenter.stufe = 3;

        // Die Antwort kommt nach der Bedenkzeit, nicht sofort
        state.boardConfidence = 95;
        const budget = club.transferBudget;
        if (!BoardEngine.stelleAnfrage(state, "transfer").ok) throw new Error("Anfrage nicht angenommen");
        if (BoardEngine.stelleAnfrage(state, "gehalt").ok) throw new Error("Zwei Anfragen gleichzeitig");
        if (BoardEngine.anfrageTag(state, () => 0)) throw new Error("Der Vorstand entscheidet sofort");
        state.currentDayIndex += BoardEngine.ANFRAGE_BEDENKZEIT;
        const r = BoardEngine.anfrageTag(state, () => 0);
        if (!r || !r.zugestimmt || !(club.transferBudget > budget)) throw new Error(`Zustimmung bei hohem Vertrauen: ${JSON.stringify(r)}`);
        if (!state.inbox.some(m => /Vorstand stimmt zu: Mehr Transferbudget/.test(m.subject || ""))) throw new Error("Keine Antwort im Postfach");
        // Dieselbe Sache erst nach acht Wochen wieder
        if (!/erst entschieden/.test(BoardEngine.anfrageHindernis(state, "transfer"))) throw new Error("Keine Sperre nach der Entscheidung");

        // Geringes Vertrauen: kaum Aussichten, Ablehnung kostet Vertrauen und weitere Aussichten
        state.boardConfidence = 42;
        const chance = BoardEngine.anfrageChance(state, "gehalt");
        if (!(chance < 0.25)) throw new Error(`Aussichten bei wenig Vertrauen: ${chance}`);
        BoardEngine.stelleAnfrage(state, "gehalt");
        state.currentDayIndex += BoardEngine.ANFRAGE_BEDENKZEIT;
        const etat = club.wageBudget;
        const nein = BoardEngine.anfrageTag(state, () => 0.99);
        if (nein.zugestimmt || club.wageBudget !== etat || state.boardConfidence >= 42) throw new Error("Ablehnung ohne Folgen");
        if (!(BoardEngine.anfrageChance(state, "jugend") < BoardEngine.anfrageChance(state, "jugend") + 0.0001)) throw new Error("Aussichten nicht berechenbar");

        // Zuschuss: Die Hälfte des nächsten Ausbaus kommt mit dem Baubeginn
        state.boardConfidence = 95;
        const gestellt = BoardEngine.stelleAnfrage(state, "training");
        if (!gestellt.ok) throw new Error(`Zuschuss-Anfrage abgewiesen: ${gestellt.grund}`);
        state.currentDayIndex += BoardEngine.ANFRAGE_BEDENKZEIT;
        const z = BoardEngine.anfrageTag(state, () => 0);
        if (!z.zugestimmt || club.bauzuschuss?.key !== "trainingGround") throw new Error("Kein Zuschuss bewilligt");
        const preis = FacilityEngine.kostenDetail(club, "trainingGround", "ausbau", state.seasonYear).netto;
        const vorher = club.balance;
        const bau = FacilityEngine.starteProjekt(state, club.id, "trainingGround", "ausbau");
        if (!bau.erfolg && bau.erfolg !== undefined) throw new Error(`Ausbau startet nicht: ${bau.grund}`);
        if (Math.round(vorher - club.balance) !== Math.round(preis - z.betrag) || club.bauzuschuss) throw new Error(`Zuschuss nicht verrechnet: ${vorher - club.balance} statt ${preis - z.betrag}`);

        // Nur ein Zuschuss zur Zeit, und er verfällt mit dem Saisonwechsel
        club.bauzuschuss = { key: "trainingGround", betrag: 1000000, saison: state.seasonYear };
        if (!/wartet noch auf den Baubeginn/.test(BoardEngine.anfrageHindernis(state, "jugend") || "")) throw new Error(`Zweiter Zuschuss neben einem offenen: ${BoardEngine.anfrageHindernis(state, "jugend")}`);
        state.seasonYear += 1;
        if (/Zuschuss/.test(BoardEngine.anfrageHindernis(state, "jugend") || "") || club.bauzuschuss) throw new Error("Zuschuss überdauert die Saison");
    });

    test("Entwicklungsplan: Eigenheit antrainieren und ablegen - Dauer nach Alter, Einstellung, Trainerstab und Mentor", () => {
        const { DevelopmentPlanEngine: Plan } = require('./js/engine/developmentPlanEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const kader = state.players.filter(p => club.playerIds.includes(p.id));
        const p = kader.find(s => s.pos !== "TW" && (s.age || 30) <= 23) || kader.find(s => s.pos !== "TW");
        const tw = kader.find(s => s.pos === "TW");
        p.traits = []; delete p.mentorId; p.age = 22;
        p.hiddenAttributes = Object.assign({}, p.hiddenAttributes, { professionalism: 14, adaptability: 12 });

        // Was er lernen kann, hängt an den Werten - knapp darunter wird es mühsam
        p.pace = 86;
        if (Plan.lernbareEigenheiten(p).find(e => e.key === "antritt")?.schwer !== false) throw new Error("Antritt trotz Tempo 86 nicht lernbar");
        p.pace = 81;
        if (Plan.lernbareEigenheiten(p).find(e => e.key === "antritt")?.schwer !== true) throw new Error("Knapp darunter nicht als mühsam markiert");
        p.pace = 70;
        if (Plan.lernbareEigenheiten(p).some(e => e.key === "antritt")) throw new Error("Antritt mit Tempo 70");
        // Ein Torwart lernt nur Torwartsachen
        if (tw && Plan.lernbareEigenheiten(Object.assign({}, tw, { traits: [] })).some(e => !Plan.TORWART_EIGENHEITEN.includes(e.key))) throw new Error("Feldspielermarotte für den Torwart");

        // Tempo: jung und professionell schneller als alt und nachlässig, Mentor hilft
        p.pace = 86;
        const plan = { key: "antritt", art: "lernen", fortschritt: 0 };
        const jung = Plan.eigenheitTempo(state, p, plan, 1);
        const alt = Plan.eigenheitTempo(state, Object.assign({}, p, { age: 32, hiddenAttributes: { professionalism: 6, adaptability: 6 } }), plan, 1);
        if (!(jung > alt * 1.8)) throw new Error(`Alter und Einstellung zählen kaum: ${jung} gegen ${alt}`);
        if (!(Plan.eigenheitTempo(state, p, plan, 1.4) > jung)) throw new Error("Trainerstab ohne Wirkung");
        const mentor = kader.find(s => s.id !== p.id && (s.age || 0) >= Plan.MENTOR_MINDESTALTER);
        mentor.traits = [{ key: "antritt", text: "x" }];
        p.mentorId = mentor.id;
        if (Math.abs(Plan.eigenheitTempo(state, p, plan, 1) / jung - 1.3) > 0.001) throw new Error("Mentor, der es kann, beschleunigt nicht");
        delete p.mentorId;

        // Antrainieren: Die Einheiten bringen ihn hin, dann steht es in der Akte
        const start = Plan.setzeEigenheitTraining(state, p.id, "antritt", "lernen");
        if (!start.success || !(start.wochen > 0)) throw new Error(`Training startet nicht: ${start.error}`);
        if (Plan.setzeEigenheitTraining(state, p.id, "elfmeterkiller", "lernen").success) throw new Error("Torwartsache für den Feldspieler");
        let einheiten = 0;
        while (p.eigenheitTraining && einheiten < 200) { Plan.nachEinheit(state, p, { stab: 1 }, () => 0.5); einheiten++; }
        const erwartet = Plan.EIGENHEIT_EINHEITEN / jung;
        if (Math.abs(einheiten - erwartet) > 2) throw new Error(`Dauer ${einheiten} statt etwa ${Math.round(erwartet)} Einheiten`);
        if (!p.traits.some(t => t.key === "antritt" && t.text)) throw new Error("Eigenheit nicht gelernt");
        if (!state.inbox.some(m => /neue Eigenheit/.test(m.subject || ""))) throw new Error("Keine Nachricht vom Trainerstab");

        // Mehr als drei nimmt keiner an
        p.traits.push({ key: "ausdauer", text: "a" }, { key: "kopfball", text: "k" });
        if (Plan.lernbareEigenheiten(p).length) throw new Error("Vierte Eigenheit lernbar");
        if (!/ablegen/.test(Plan.setzeEigenheitTraining(state, p.id, "dribbler", "lernen").error || "")) throw new Error("Kein Hinweis aufs Ablegen");

        // Ablegen
        if (!Plan.setzeEigenheitTraining(state, p.id, "kopfball", "ablegen").success) throw new Error("Ablegen startet nicht");
        if (Plan.setzeEigenheitTraining(state, p.id, "knipser", "ablegen").success) throw new Error("Ablegen, was er nicht hat");
        // Der Plan überlebt das Speichern
        p.eigenheitTraining.fortschritt = 0.5;
        const zurueck = SaveCodec.decodeState(JSON.parse(JSON.stringify(SaveCodec.encodeState(state))));
        const gespeichert = zurueck.players.find(s => String(s.id) === String(p.id));
        if (gespeichert?.eigenheitTraining?.key !== "kopfball" || gespeichert.eigenheitTraining.fortschritt !== 0.5) throw new Error("Plan nach dem Laden verloren");
        let n = 0;
        while (p.eigenheitTraining && n < 200) { Plan.nachEinheit(state, p, { stab: 1 }, () => 0.5); n++; }
        if (p.traits.some(t => t.key === "kopfball") || p.traits.length !== 2) throw new Error("Eigenheit nicht abgelegt");
        // Was er sich unterwegs anders angewöhnt hat, beendet den Plan
        Plan.setzeEigenheitTraining(state, p.id, "ruhe", "lernen");
        if (p.eigenheitTraining) {
            p.traits.push({ key: "ruhe", text: "r" });
            Plan.nachEinheit(state, p, { stab: 1 }, () => 0.5);
            if (p.eigenheitTraining) throw new Error("Plan läuft weiter, obwohl er es schon kann");
        }
    });

    test("Ablöse in Raten: Anzahlung, Abschlag für den Verkäufer, Monatsraten und Übersicht", () => {
        const { FinanceEngine: Fin } = require('./js/engine/financeEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const andere = state.clubs.filter(c => c.id !== club.id && c.leagueId === club.leagueId);
        const verkaeufer = andere[0];
        verkaeufer.balance = 500000000;

        // Plan und Wert für den Verkäufer
        const plan = Fin.ratenPlan(10000000, "raten12");
        if (plan.anzahlung !== 5000000 || plan.monate !== 12 || Math.abs(plan.rate * 12 - 5000000) > 12) throw new Error(`Ratenplan: ${JSON.stringify(plan)}`);
        const reich = { balance: 1e9 }, klamm = { balance: 1000000 };
        const w12 = Fin.ratenWert(10000000, "raten12", reich), w24 = Fin.ratenWert(10000000, "raten24", reich);
        if (!(w12 < 10000000 && w24 < w12 && Fin.ratenWert(10000000, "raten12", klamm) < w12)) throw new Error(`Abschläge: ${w12}, ${w24}`);
        if (Fin.ratenWert(10000000, "sofort", reich) !== 10000000) throw new Error("Sofortzahlung mit Abschlag");

        // Ein Kauf in Raten: Anzahlung sofort, Rest am Monatsersten
        state.ratenzahlungen = [];
        const zweiter = state.players.find(p => p.clubId === verkaeufer.id && !p.leihe && !p.vorvertrag);
        delete zweiter.weiterverkauf;
        const vorK = club.balance, vorV = verkaeufer.balance, vorTB = club.transferBudget;
        if (!TransferEngine.executeTransfer(state, zweiter.id, club.id, 12000000, 40000, 3, { zahlweise: "raten24" })) throw new Error("Wechsel gescheitert");
        const p24 = Fin.ratenPlan(12000000, "raten24");
        if (vorK - club.balance !== p24.anzahlung || verkaeufer.balance - vorV !== p24.anzahlung || vorTB - club.transferBudget !== p24.anzahlung) {
            throw new Error(`Anzahlung falsch verbucht: ${vorK - club.balance} / ${verkaeufer.balance - vorV} statt ${p24.anzahlung}`);
        }
        const eintrag = state.ratenzahlungen.find(r => r.playerId === zweiter.id);
        if (!eintrag || eintrag.offen !== p24.rest || eintrag.zahlerId !== club.id || eintrag.empfaengerId !== verkaeufer.id) throw new Error("Kein Ratenplan angelegt");
        if (Fin.ratenUebersicht(state).schulden !== p24.rest) throw new Error("Übersicht ohne die Schulden");
        // Der Ratenplan überlebt das Speichern
        const zurueck = SaveCodec.decodeState(JSON.parse(JSON.stringify(SaveCodec.encodeState(state))));
        if (zurueck.ratenzahlungen?.[0]?.offen !== p24.rest) throw new Error("Raten nach dem Laden verloren");

        state.ratenMonat = "08.2026";
        if (Fin.zahleRaten(state, "20.08.2026") !== null) throw new Error("Rate mitten im Monat");
        let gezahlt = 0, erhalten = 0, monat = 9, jahr = 2026;
        for (let i = 0; i < 24; i++) {
            const k = club.balance, v = verkaeufer.balance;
            const zeile = Fin.zahleRaten(state, `01.${String(monat).padStart(2, "0")}.${jahr}`);
            if (!/Ablöseraten: .* gezahlt/.test(zeile || "")) throw new Error(`Monat ${i + 1} ohne Zeile: ${zeile}`);
            gezahlt += k - club.balance; erhalten += verkaeufer.balance - v;
            if (Fin.zahleRaten(state, `15.${String(monat).padStart(2, "0")}.${jahr}`) !== null) throw new Error("Zweimal im Monat gezahlt");
            monat++; if (monat > 12) { monat = 1; jahr++; }
        }
        if (gezahlt !== p24.rest || erhalten !== p24.rest || state.ratenzahlungen.length) throw new Error(`Raten: ${gezahlt} gezahlt, ${erhalten} erhalten, Rest ${p24.rest}`);

        // Zwischen zwei fremden Vereinen fließt alles sofort
        const [a, b] = andere.slice(1, 3);
        const fremd = state.players.find(p => p.clubId === a.id && !p.leihe && !p.vorvertrag);
        delete fremd.weiterverkauf;
        const vorB = b.balance;
        TransferEngine.executeTransfer(state, fremd.id, b.id, 8000000, 30000, 3, { zahlweise: "raten12" });
        if (vorB - b.balance !== 8000000 || state.ratenzahlungen.length) throw new Error("Raten zwischen fremden Vereinen");

        // Ein Angebot der KI in Raten für einen eigenen Spieler
        const eigener = state.players.find(p => p.clubId === club.id && !p.leihe && p.pos !== "TW");
        delete eigener.weiterverkauf;
        const kaeufer = andere[3];
        const vorEigen = club.balance;
        state.transferMarket.offers.push({ id: "raten_test", playerId: eigener.id, playerName: eigener.name, fromClubId: kaeufer.id, fromClubName: kaeufer.name,
            toClubId: club.id, fee: 20000000, zahlweise: "raten12", status: "pending" });
        const angenommen = TransferEngine.nimmAngebotAn(state, "raten_test");
        if (!angenommen.ok) throw new Error(`Angebot nicht angenommen: ${angenommen.grund}`);
        if (club.balance - vorEigen !== 10000000 || Fin.ratenUebersicht(state).forderungen !== 10000000) throw new Error("Verkauf in Raten falsch verbucht");
        state.ratenzahlungen = [];

        // Verhandlung: In Raten muss nur die Anzahlung ins Budget passen,
        // und der Verkäufer rechnet sie mit Abschlag
        const ziel = state.players.filter(p => p.clubId === verkaeufer.id && !p.leihe && !p.vorvertrag).sort((x, y) => (y.value || 0) - (x.value || 0))[0];
        const start = NegotiationEngine.startTransferNegotiation(state, ziel.id, club.id);
        if (!start.success) throw new Error(`Verhandlung startet nicht: ${start.error}`);
        const n = start.negotiation;
        const forderung = n.demand.fee;
        club.balance = forderung * 3; club.transferBudget = Math.round(forderung * 0.6);
        if (NegotiationEngine.submitOffer(state, n.id, { fee: forderung }).success) throw new Error("Sofortzahlung über dem Budget angenommen");
        club.balance = Math.round(forderung * 0.8);
        if (!/nicht gedeckt/.test(NegotiationEngine.submitOffer(state, n.id, { fee: forderung, zahlweise: "raten24" }).error || "")) throw new Error("Raten ohne Deckung auf dem Konto");
        club.balance = forderung * 3;
        if (!NegotiationEngine.submitOffer(state, n.id, { fee: forderung, zahlweise: "raten24" }).success) throw new Error("Raten-Angebot abgewiesen");
        const e1 = NegotiationEngine.evaluateOffer(state, n);
        if (e1.kind !== "counter") throw new Error(`Raten zum Nennwert der Forderung: ${e1.kind}`);
        if (!/In Raten wie angeboten entspräche das etwa/.test(n.log[n.log.length - 1].text)) throw new Error("Gegenforderung ohne Hinweis auf die Raten");
        NegotiationEngine.submitOffer(state, n.id, { fee: Math.round(n.demand.fee * 1.06), zahlweise: "raten12" });
        const e2 = NegotiationEngine.evaluateOffer(state, n);
        if (e2.kind !== "fee_agreed" || n.agreed.zahlweise !== "raten12") throw new Error(`Keine Einigung in Raten: ${e2.kind}`);
        n.agreed.wage = 50000; n.agreed.years = 3;
        const fertig = NegotiationEngine.completeTransfer(state, n);
        if (fertig.kind !== "completed") throw new Error(`Transfer nicht abgeschlossen: ${fertig.kind}`);
        const r = state.ratenzahlungen.find(x => x.playerId === ziel.id);
        if (!r || r.gesamt !== n.agreed.fee || r.monate !== 12) throw new Error("Kein Ratenplan nach der Verhandlung");
    });

    test("Ungereimtheiten: ein Vorstandsvertrauen, Angebote mit Frist, Gehalt nach Verkauf, Datum in der Post", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);

        // Ein Wert: Ereignisse wirken nach und klingen ab, der Verein sieht dasselbe
        const tabelle = (platz) => {
            state.standings = state.standings.filter(s => s.clubId !== club.id);
            state.standings.splice(platz - 1, 0, { clubId: club.id });
        };
        club.vorstandsziel.platz = 5; club.balance = 1000000; club.form = [];
        tabelle(5);
        SeasonEngine.updateBoardConfidence(state);
        const basis = state.boardConfidence;
        BoardEngine.stimmung(state, -10);
        if (state.boardConfidence !== basis - 10 || club.confidence !== state.boardConfidence) throw new Error("Ereignis wirkt nicht sofort auf beide");
        // Am nächsten Spieltag gilt sie noch voll, danach klingt sie ab
        SeasonEngine.updateBoardConfidence(state);
        if (state.boardConfidence !== basis - 10) throw new Error(`Nachwirkung am nächsten Spieltag: ${state.boardConfidence} (Basis ${basis})`);
        SeasonEngine.updateBoardConfidence(state);
        const nachZwei = state.boardConfidence;
        if (!(nachZwei < basis && nachZwei > basis - 10)) throw new Error(`Nachwirkung klingt nicht ab: ${nachZwei} (Basis ${basis})`);
        for (let i = 0; i < 25; i++) SeasonEngine.updateBoardConfidence(state);
        if (state.boardConfidence !== basis) throw new Error(`Nachwirkung klingt nicht ab: ${state.boardConfidence}`);
        if (BoardEngine.updateConfidence(state).confidence !== state.boardConfidence || club.confidence !== state.boardConfidence) throw new Error("Zwei Werte für das Vertrauen");
        if (!/zufrieden/.test(BoardEngine.getBoardMessage(state))) throw new Error(`Text passt nicht zum Balken: ${BoardEngine.getBoardMessage(state)}`);

        // Angebote aus alten Spielständen bekommen eine Frist
        const spieler = state.players.find(p => p.clubId === club.id && p.pos === "ST");
        const kaeufer = state.clubs.find(c => c.id !== club.id && c.leagueId === club.leagueId);
        state.transferMarket.offers.push({ id: "alt", buyerClubId: kaeufer.id, buyerClubName: kaeufer.name, playerId: spieler.id, playerName: spieler.name, fee: 30000000, status: "pending" });
        TransferEngine.pruefeAngebotsfristen(state);
        const alt = state.transferMarket.offers.find(o => o.id === "alt");
        if (typeof alt.frist !== "number" || alt.fromClubId !== kaeufer.id || alt.status !== "pending") throw new Error("Altes Angebot ohne Frist");

        // Wer an die KI verkauft wird, verdient dort mehr als bisher - nicht pauschal 50.000 €
        spieler.wage = 20000;
        delete spieler.weiterverkauf;
        if (!TransferEngine.nimmAngebotAn(state, "alt").ok) throw new Error("Verkauf gescheitert");
        if (spieler.clubId !== kaeufer.id || spieler.wage !== 24000) throw new Error(`Gehalt nach dem Verkauf: ${spieler.wage}`);

        // Die Post trägt das Datum des Kalenders
        state.currentDate = "12.09.2026";
        state.inbox = [];
        DevelopmentPlanEngine._post(state, state.players.find(p => p.clubId === club.id), "Test", "Text");
        if (state.inbox[0]?.date !== "12.09.2026") throw new Error(`Datum in der Post: ${state.inbox[0]?.date}`);
    });

    test("Realismus: Spielkultur je Liga, Elfmeter überall gleich, Gehaltsdisziplin der KI-Vereine", () => {
        // Torfreude nach Land und Klasse: LaLiga und Serie A torärmer als Bundesliga
        const faktor = (id) => MatchEngine.torKultur({ leagueId: id }, null);
        if (!(faktor("es_liga_1") < faktor("de_liga_1") && faktor("it_liga_1") < faktor("de_liga_1") && faktor("es_liga_1") < faktor("fr_liga_1"))) throw new Error("Spielkultur der Ligen falsch geordnet");
        if (!(faktor("es_liga_2") < faktor("es_liga_1"))) throw new Error("Zweite Liga nicht torärmer");
        if (MatchEngine.torKultur({ leagueId: "cl", international: true }, { leagueId: "es_liga_1" }) !== 1) throw new Error("Europapokal mit Ligakultur");
        if (MatchEngine.torKultur({ competitionId: "de_cup" }, { leagueId: "es_liga_1" }) !== faktor("es_liga_1")) throw new Error("Pokal ohne Kultur der Heimliga");

        // Wirkung auf die Abschlüsse - Elfmeter bleiben gleich
        const schuetze = { overall: 80, shooting: 80, technique: 78, pace: 75, physical: 75, dribbling: 76 };
        const torwart = { overall: 78, reflexes: 78, oneOnOne: 76, handling: 76, positioning: 76 };
        const quote = (art, f) => {
            let tore = 0;
            for (let i = 0; i < 4000; i++) {
                if (MatchEngine.resolveShotAttempt(art, schuetze, torwart, { attack: 75 }, { defense: 75 }, {}, { torFaktor: f }).outcome === "goal") tore++;
            }
            return tore / 4000;
        };
        const voll = quote("through_ball", 1), kultur = quote("through_ball", 0.75);
        if (!(kultur < voll * 0.85)) throw new Error(`Spielkultur ohne Wirkung: ${voll} gegen ${kultur}`);
        if (Math.abs(quote("penalty", 1) - quote("penalty", 0.7)) > 0.04) throw new Error("Elfmeter von der Spielkultur betroffen");

        // Gehaltsdisziplin: Wer über seine Verhältnisse zahlt, kommt halb zurück, der Nutzer nicht
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const ki = state.clubs.find(c => c.id !== state.userClubId && c.leagueId === "de_liga_1");
        const eigener = state.clubs.find(c => c.id === state.userClubId);
        const summe = (club) => state.players.filter(p => p.clubId === club.id && !p.leihe).reduce((s, p) => s + p.wage, 0);
        state.players.filter(p => p.clubId === ki.id || p.clubId === eigener.id).forEach(p => { p.wage = Math.round(p.wage * 1.5); });
        const kiVorher = summe(ki), eigenVorher = summe(eigener);
        const ziel = FinanceEngine.gehaltsbudgetJeSpieltag(ki, state);
        FinanceEngine.gehaltsDisziplin(state);
        const kiNachher = summe(ki);
        if (!(kiNachher < kiVorher && kiNachher > ziel * 0.98)) throw new Error(`Gehaltsdisziplin: ${kiVorher} -> ${kiNachher} (tragbar ${ziel})`);
        if (summe(eigener) !== eigenVorher) throw new Error("Gehälter des Nutzers angefasst");
    });

    test("Auszeichnungen: Spieler, Talent und Trainer des Monats, Saisonpreise und Elf der Saison in der eigenen Liga", () => {
        const { AuszeichnungEngine: Preise } = require('./js/engine/auszeichnungEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const liga = state.clubs.filter(c => c.leagueId === club.leagueId);
        const inLiga = new Set(liga.map(c => c.id));
        const ligaSpieler = state.players.filter(p => inLiga.has(p.clubId));
        ligaSpieler.forEach(p => { p.stats = { matches: 0, goals: 0, assists: 0, ratingSum: 0, cleanSheets: 0, minutes: 0 }; });

        // Monatsbeginn festhalten, dann einen Monat "spielen"
        if (Preise.pruefeMonat(state, "02.09.2026") !== null) throw new Error("Preis ohne abgelaufenen Monat");
        const star = ligaSpieler.find(p => p.clubId !== club.id && p.pos === "ST");
        const talent = ligaSpieler.find(p => p.age <= 21 && p.clubId === club.id) || ligaSpieler.find(p => p.age <= 21);
        talent.age = 20; star.age = 27;
        ligaSpieler.forEach(p => { p.stats.matches = 4; p.stats.ratingSum = 4 * 6.6; });
        Object.assign(star.stats, { matches: 4, goals: 6, assists: 1, ratingSum: 4 * 8.4 });
        Object.assign(talent.stats, { matches: 4, goals: 1, assists: 2, ratingSum: 4 * 7.6 });
        state.standings = state.standings.map(r => ({ ...r, played: 4, points: r.clubId === club.id ? 12 : 4, goalDiff: r.clubId === club.id ? 9 : 0 }));
        const wertVorher = star.value;
        const vertrauenVorher = state.boardConfidence;
        if (Preise.pruefeMonat(state, "17.09.2026") !== null) throw new Error("Preis mitten im Monat");
        const zeile = Preise.pruefeMonat(state, "01.10.2026");
        if (!/September 2026/.test(zeile || "")) throw new Error(`Keine Zeile zum Monatspreis: ${zeile}`);
        const monat = state.auszeichnungen.monate[0];
        if (monat.spieler.id !== star.id || monat.talent.id !== talent.id) throw new Error(`Falsche Preisträger: ${monat.spieler.name} / ${monat.talent?.name}`);
        if (!monat.trainer.istNutzer || !(state.boardConfidence > vertrauenVorher)) throw new Error("Trainer des Monats ohne Wirkung");
        if (!(star.value > wertVorher) || !star.auszeichnungen.some(a => a.art === "spielerMonat" && a.monat === "09.2026")) throw new Error("Preis nicht in der Akte");
        if (!Preise.preiseVon(star).some(p => p.name === "Spieler des Monats" && /September/.test(p.wann))) throw new Error("Akte nennt den Preis nicht");
        if (!(CareerEngine.ruf(state) >= 0)) throw new Error("Ruf nicht berechenbar");
        // Ein zweiter Aufruf im selben Monat vergibt nichts doppelt
        Preise.pruefeMonat(state, "05.10.2026");
        if (state.auszeichnungen.monate.length !== 1) throw new Error("Monatspreis doppelt vergeben");

        // Saisonpreise: nur wer genug gespielt hat, die Elf passt zu den Positionen
        ligaSpieler.forEach(p => { p.stats.matches = 30; p.stats.ratingSum = 30 * 6.7; p.stats.goals = 0; p.stats.assists = 0; });
        Object.assign(star.stats, { matches: 30, goals: 31, assists: 5, ratingSum: 30 * 7.9 });
        const kurz = ligaSpieler.find(p => p !== star && p.pos === "ST");
        Object.assign(kurz.stats, { matches: 5, goals: 9, ratingSum: 5 * 9.5 });
        // Ein Torjäger aus einer anderen Liga zählt nicht
        const fremd = state.players.find(p => p.clubId && !inLiga.has(p.clubId) && p.pos === "ST");
        fremd.stats = { matches: 30, goals: 60, assists: 0, ratingSum: 30 * 8, cleanSheets: 0, minutes: 2700 };
        const preise = Preise.saisonPreise(state, club.leagueId);
        if (preise.spieler.id !== star.id || preise.torjaeger.id !== star.id) throw new Error(`Saisonpreise: ${preise.spieler.name} / ${preise.torjaeger.name}`);
        if (preise.elf.length !== 11 || preise.elf.some(e => !Preise.ELF.some(pl => pl.platz === e.platz && pl.pos.includes(e.pos)))) throw new Error(`Elf der Saison: ${preise.elf.map(e => e.platz + ":" + e.pos).join(" ")}`);
        if (new Set(preise.elf.map(e => e.id)).size !== 11 || preise.elf.some(e => e.id === kurz.id)) throw new Error("Elf mit Doppelten oder Kurzeinsätzen");
        if (!preise.trainer || typeof preise.trainer.erwartet !== "number") throw new Error("Kein Trainer der Saison");

        // Zum Saisonende: Archiv und Preise in der eigenen Liga
        state.inbox = [];
        SeasonEngine.finishSeason(state);
        const archiv = state.history.pastSeasons[state.history.pastSeasons.length - 1];
        if (archiv.awards.topScorer.name !== star.name) throw new Error(`Torschützenkönig im Archiv: ${archiv.awards.topScorer?.name}`);
        if (!state.auszeichnungen.saisons.some(x => x.liga === club.leagueId && x.spieler.id === star.id)) throw new Error("Saisonpreise nicht gespeichert");
        if (!state.inbox.some(m => /Preise der Saison/.test(m.subject || ""))) throw new Error("Keine Post zu den Saisonpreisen");
        if (Preise.uebersicht(state, club.leagueId).letzteSaison?.spieler?.id !== star.id) throw new Error("Übersicht ohne Saisonpreise");
        const zurueck = SaveCodec.decodeState(JSON.parse(JSON.stringify(SaveCodec.encodeState(state))));
        if (!zurueck.players.find(p => p.id === star.id)?.auszeichnungen?.length || !zurueck.auszeichnungen?.saisons?.length) throw new Error("Preise nach dem Laden verloren");
    });

    test("Vereinschronik: Rekorde, Serien, Transfers, Titel, Saisonbilanz und Legenden", () => {
        const { ChronikEngine: Chronik } = require('./js/engine/chronikEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const gegner = state.clubs.filter(c => c.id !== club.id && c.leagueId === club.leagueId);
        let nr = 0;
        const spiel = (heim, tore, gegentore, zuschauer = 50000) => {
            nr++;
            const g = gegner[nr % gegner.length];
            return heim
                ? { id: `t${nr}`, played: true, homeClubId: club.id, awayClubId: g.id, homeGoals: tore, awayGoals: gegentore, attendance: zuschauer }
                : { id: `t${nr}`, played: true, homeClubId: g.id, awayClubId: club.id, homeGoals: gegentore, awayGoals: tore, attendance: zuschauer };
        };
        state.currentDate = "20.09.2026";
        Chronik.nachSpiel(state, spiel(true, 3, 0, 60000));
        const zweiterSieg = Chronik.nachSpiel(state, spiel(false, 5, 1));
        if (!/höchster Sieg/.test(zweiterSieg || "")) throw new Error(`Kein neuer Rekord gemeldet: ${zweiterSieg}`);
        const doppelt = spiel(true, 2, 1, 75000);
        Chronik.nachSpiel(state, doppelt);
        Chronik.nachSpiel(state, doppelt);
        Chronik.nachSpiel(state, spiel(true, 0, 4, 40000));
        Chronik.nachSpiel(state, spiel(true, 1, 1, 40000));
        const r = state.chronik[club.id].rekorde;
        if (r.hoechsterSieg.ergebnis !== "5:1" || r.hoechsterSieg.heim !== false) throw new Error(`Höchster Sieg: ${JSON.stringify(r.hoechsterSieg)}`);
        if (r.hoechsteNiederlage.ergebnis !== "0:4") throw new Error("Höchste Niederlage falsch");
        if (r.zuschauer.wert !== 75000) throw new Error(`Zuschauerrekord: ${r.zuschauer.wert}`);
        if (r.siegserie.wert !== 3) throw new Error(`Siegesserie: ${r.siegserie.wert} (ein Spiel doppelt gezählt?)`);
        if (r.torreichstes.wert !== 6) throw new Error("Torreichstes Spiel falsch");
        if (state.chronik[club.id].serie.ungeschlagen !== 1) throw new Error("Serie nach der Niederlage nicht neu begonnen");

        // Transfers: teuerster Kauf und Verkauf
        const verkauft = state.players.find(p => p.clubId === club.id && p.pos === "ZM");
        const gekauft = state.players.find(p => p.clubId === gegner[0].id && !p.leihe);
        delete verkauft.weiterverkauf; delete gekauft.weiterverkauf;
        TransferEngine.executeTransfer(state, gekauft.id, club.id, 42000000, 90000, 4);
        TransferEngine.executeTransfer(state, verkauft.id, gegner[1].id, 18000000, 60000, 3);
        if (r.kauf.name !== gekauft.name || r.kauf.wert !== 42000000 || r.verkauf.name !== verkauft.name) throw new Error("Transferrekorde fehlen");

        // Titel und Saisonbilanz
        CareerEngine.vermerkeTitel(state, "Meisterschaft", state.seasonYear);
        const treuer = state.players.find(p => p.clubId === club.id && p.pos === "IV");
        treuer.stats = { ...treuer.stats, matches: 34, goals: 3, assists: 2 };
        state.chronik[club.id].spieler[treuer.id] = [treuer.name, 130, 9, 6, 1, 1, "IV"];
        SeasonEngine.finishSeason(state);
        const c = state.chronik[club.id];
        if (c.saisons.length !== 1 || !c.saisons[0].platz) throw new Error(`Saisonbilanz: ${JSON.stringify(c.saisons)}`);
        if (!c.titel.some(t => t.wettbewerb === "Meisterschaft")) throw new Error("Titel nicht in der Chronik");
        if (c.spieler[treuer.id][1] !== 164) throw new Error(`Vereinsbilanz nicht fortgeschrieben: ${c.spieler[treuer.id][1]}`);
        const u = Chronik.uebersicht(state);
        if (u.meisteSpiele[0].name !== treuer.name || !u.legenden.some(l => l.name === treuer.name)) throw new Error("Rekordspieler oder Legende fehlt");
        if (Chronik.bilanz(state, treuer).spiele !== 164) throw new Error("Bilanz in der Akte falsch");
        const zurueck = SaveCodec.decodeState(JSON.parse(JSON.stringify(SaveCodec.encodeState(state))));
        if (zurueck.chronik?.[club.id]?.rekorde?.hoechsterSieg?.ergebnis !== "5:1") throw new Error("Chronik nach dem Laden verloren");
    });

    test("Trainerkarussell: Druck, Entlassung mit Schonfrist, neuer Stil und Trainereffekt, Trennung zum Saisonende", () => {
        const { TrainerwechselEngine: Karussell } = require('./js/engine/trainerwechselEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const liga = state.clubs.filter(c => c.leagueId === club.leagueId);
        const staerke = (c) => state.players.filter(p => p.clubId === c.id).map(p => p.overall).sort((a, b) => b - a).slice(0, 14).reduce((s, x) => s + x, 0);
        // Der zweitstärkste KI-Kader steht ganz unten und hat fünfmal verloren
        const kandidat = liga.filter(c => c.id !== club.id).sort((a, b) => staerke(b) - staerke(a))[1];
        const t = Karussell.trainer(state, kandidat);
        if (!t || !t.name || t.stil !== (kandidat.tactics.vorlage || t.stil)) throw new Error("Kein Trainer angelegt");
        if (Karussell.trainer(state, club) !== null) throw new Error("Der Nutzer hat einen KI-Trainer");
        if (!(Karussell.druck({ platz: 18, erwartet: 2, niederlagen: 5, abstieg: true, keller: true, ruf: 70 })
            > Karussell.druck({ platz: 3, erwartet: 2, niederlagen: 1, abstieg: false, keller: false, ruf: 70 }))) throw new Error("Druck falsch");

        state.standings = [...state.standings.filter(r => r.clubId !== kandidat.id), state.standings.find(r => r.clubId === kandidat.id)]
            .map(r => ({ ...r, played: 12 }));
        kandidat.form = ["L", "L", "L", "L", "L"];
        club.form = ["L", "L", "L", "L", "L"];
        const laune = state.players.find(p => p.clubId === kandidat.id);
        laune.morale = 60;
        const alterStil = t.stil, alterName = t.name;
        state.inbox = [];
        const wechsel = Karussell.nachSpieltag(state, () => 0);
        const w = wechsel.find(x => x.clubId === kandidat.id);
        if (!w) throw new Error("Der Verein entlässt seinen Trainer nicht");
        if (kandidat.trainer.name === alterName || kandidat.trainer.stil === alterStil || kandidat.tactics.vorlage !== kandidat.trainer.stil) throw new Error("Nachfolger ohne eigenen Stil");
        if (laune.morale !== 60 + Karussell.TRAINEREFFEKT) throw new Error("Kein Trainereffekt");
        if (!state.inbox.some(m => /Trainerwechsel bei/.test(m.subject || ""))) throw new Error("Keine Meldung in der eigenen Liga");
        if (!Karussell.dieseSaison(state, club.leagueId).some(x => x.clubId === kandidat.id)) throw new Error("Nicht im Protokoll");
        // Der Nutzer wird hier nie entlassen - dafür ist der Vorstand da
        if (wechsel.some(x => x.clubId === club.id)) throw new Error("Nutzer entlassen");
        // Schonfrist: Der Neue bekommt Zeit
        if (Karussell.nachSpieltag(state, () => 0).some(x => x.clubId === kandidat.id)) throw new Error("Keine Schonfrist");
        // Höchstens zwei Wechsel je Saison
        state.standings = state.standings.map(r => ({ ...r, played: 30 }));
        Karussell.nachSpieltag(state, () => 0);
        state.standings = state.standings.map(r => ({ ...r, played: 34 }));
        Karussell.nachSpieltag(state, () => 0);
        if (kandidat.trainerwechsel.anzahl > Karussell.JE_SAISON) throw new Error(`${kandidat.trainerwechsel.anzahl} Wechsel in einer Saison`);

        // Zum Saisonende: Wer auf einem Abstiegsplatz landet, trennt sich oft
        const absteiger = state.standings[state.standings.length - 1];
        const verein = state.clubs.find(c => c.id === absteiger.clubId);
        verein.trainer = { name: "Alt Trainer", seit: 0, stil: "ausgewogen", ruf: 60, ab: 0 };
        Karussell.saisonEnde(state, () => 0);
        if (verein.trainer.name === "Alt Trainer") throw new Error("Absteiger behält seinen Trainer trotz Würfel 0");
    });

    test("Liga-Nachrichten: Saisonvorschau, Gerüchte, die wahr werden können, und die Rundschau nach dem Spieltag", () => {
        const { LigaNachrichtenEngine: Presse } = require('./js/engine/ligaNachrichtenEngine.js');
        const { TrainerwechselEngine: Karussell } = require('./js/engine/trainerwechselEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        state.inbox = [];

        // Saisonvorschau: einmal je Saison, mit Favoriten und eigenem Platz
        const vorschau = Presse.saisonvorschau(state);
        if (!/Favoriten: .+\n?/.test(vorschau || "") || !/Platz \d+/.test(vorschau)) throw new Error(`Saisonvorschau: ${vorschau}`);
        if (Presse.saisonvorschau(state) !== null) throw new Error("Saisonvorschau doppelt");
        const tabelle = Presse.expertenTabelle(state);
        if (tabelle[0].kader > 3) throw new Error("Favorit mit schwachem Kader");

        // Gerüchte nur im offenen Fenster, und sie machen den Spieler reizvoller
        if (Presse.geruechtTag(state, false, () => 0) !== null) throw new Error("Gerücht bei geschlossenem Fenster");
        const g = Presse.geruechtTag(state, true, () => 0);
        if (!g) throw new Error("Kein Gerücht trotz offenem Fenster");
        const interessent = state.clubs.find(c => c.id === g.clubId);
        const spieler = state.players.find(p => p.id === g.playerId);
        if (interessent.leagueId !== club.leagueId || interessent.id === club.id || spieler.clubId === club.id) throw new Error("Gerücht über die falschen Vereine");
        if (Presse.reiz(interessent, spieler) !== Presse.GERUECHT_REIZ || Presse.reiz(interessent, state.players.find(p => p.id !== spieler.id)) !== 0) throw new Error("Wunschspieler ohne Reiz");
        if (!state.inbox.some(m => /Gerüchteküche/.test(m.subject || ""))) throw new Error("Gerücht nicht gemeldet");

        // Kommt der Wechsel zustande, war das Gerücht wahr
        Presse.transfer(state, { player: spieler, vonId: spieler.clubId, zuId: interessent.id, fee: 9000000 });
        if (!Presse.geruechteDieseSaison(state).some(x => x.playerId === spieler.id && x.wahr) || interessent.geruecht) throw new Error("Gerücht nicht bestätigt");

        // Rundschau nach dem Spieltag
        const runde = state.schedule.find(r => r.matchday === 1);
        runde.matches.forEach((m, i) => { m.played = true; m.homeGoals = i === 0 ? 5 : 1; m.awayGoals = i === 0 ? 0 : 1; });
        state.currentMatchday = 1;
        state.standings = GameState.calculateStandings(GameState.getLeagueClubs(state), state.schedule, 1);
        state.currentDayIndex = 10;
        Karussell.wechsle(state, state.clubs.find(c => c.leagueId === club.leagueId && c.id !== club.id && c.id !== interessent.id), { grund: "entlassung", gespielt: 1, platz: 18 });
        const zeilen = Presse.rundschau(state);
        if (!zeilen || !zeilen.some(z => /Ergebnis des Spieltags: .* 5:0/.test(z))) throw new Error(`Rundschau ohne Ergebnis des Spieltags: ${JSON.stringify(zeilen)}`);
        if (!zeilen.some(z => /das Gerücht stimmte/.test(z))) throw new Error("Rundschau ohne den Transfer");
        if (!zeilen.some(z => /Trainerwechsel/.test(z))) throw new Error("Rundschau ohne Trainerwechsel");
        if (Presse.rundschau(state) !== null) throw new Error("Zwei Rundschauen zu einem Spieltag");
        const zurueck = SaveCodec.decodeState(JSON.parse(JSON.stringify(SaveCodec.encodeState(state))));
        if (!zurueck.ligaNachrichten?.geruechte?.length) throw new Error("Gerüchte nach dem Laden verloren");
    });

    test("Testspiele zählen für keine Statistik und keine Kartensperre, Pflichtspiele schon", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const heim = state.clubs.find(c => c.id === state.userClubId);
        const gast = state.clubs.find(c => c.id !== heim.id && c.leagueId === heim.leagueId);
        const kader = state.players.filter(p => p.clubId === heim.id || p.clubId === gast.id);
        const stand = () => kader.reduce((s, p) => s + (p.stats.matches || 0) + (p.stats.goals || 0) * 100 + (p.yellowCardsTotal || 0) * 10000, 0);
        // Wer vier Gelbe hat, würde mit der fünften gesperrt
        kader.forEach(p => { p.yellowCardsTotal = 4; p.suspendedMatches = 0; });
        const vorher = stand();
        const testspiel = { id: "friendly_t", played: false, freundschaftsspiel: true, homeClubId: heim.id, awayClubId: gast.id, homeGoals: null, awayGoals: null };
        MatchEngine.simulateFullMatch(testspiel, heim, gast, state.players);
        if (!testspiel.played) throw new Error("Testspiel nicht ausgetragen");
        if (stand() !== vorher) throw new Error("Testspiel lief in die Statistik");
        if (kader.some(p => p.suspendedMatches > 0)) throw new Error("Sperre aus einem Testspiel");
        const pflicht = { id: "liga_t", played: false, homeClubId: heim.id, awayClubId: gast.id, homeGoals: null, awayGoals: null, leagueId: heim.leagueId };
        MatchEngine.simulateFullMatch(pflicht, heim, gast, state.players);
        if (!(stand() > vorher)) throw new Error("Pflichtspiel ohne Statistik");
    });

    test("Spielvorschau: Quoten aus dem Tormodell, direkter Vergleich, Torjäger und Ausfälle", () => {
        const { SpielvorschauEngine: Vorschau } = require('./js/engine/spielvorschauEngine.js');
        const { ChronikEngine: Chronik } = require('./js/engine/chronikEngine.js');
        // Gleich stark auf neutralem Platz: gleiche Chancen; zu Hause ein Vorteil
        const neutral = Vorschau.quoten(80, 80, 1, true);
        if (Math.abs(neutral.heim - neutral.gast) > 0.001 || Math.abs(neutral.heim + neutral.remis + neutral.gast - 1) > 1e-9) throw new Error("Neutrale Quoten unsymmetrisch");
        const heim = Vorschau.quoten(80, 80, 1);
        if (!(heim.heim > 0.4 && heim.heim < 0.52 && heim.remis > 0.2 && heim.remis < 0.32)) throw new Error(`Heimspiel unter Gleichen unplausibel: ${JSON.stringify(heim)}`);
        const favorit = Vorschau.quoten(88, 74, 1);
        if (!(favorit.quoteHeim < 1.5 && favorit.quoteGast > 5)) throw new Error(`Favoritenquoten: ${favorit.quoteHeim} / ${favorit.quoteGast}`);
        if (!(1 / favorit.quoteHeim + 1 / favorit.quoteRemis + 1 / favorit.quoteGast > 1.03)) throw new Error("Keine Buchmachermarge");
        if (!(Vorschau.quoten(80, 80, 0.75).remis > heim.remis)) throw new Error("Torarme Liga ohne mehr Remis");

        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const v = Vorschau.vorschau(state);
        if (!v || !v.gegner || Math.abs(v.sieg + v.remis + v.niederlage - 1) > 1e-9) throw new Error("Keine Vorschau");
        if (v.bilanz !== null) throw new Error("Bilanz ohne Duell");
        const gegner = state.clubs.find(c => c.id === v.gegner.id);
        const verletzt = state.players.filter(p => p.clubId === gegner.id).sort((a, b) => b.overall - a.overall)[0];
        verletzt.injuredWeeks = 3;
        const heimId = v.heim ? state.userClubId : gegner.id;
        Chronik.nachSpiel(state, { id: "d1", played: true, homeClubId: heimId, awayClubId: heimId === gegner.id ? state.userClubId : gegner.id,
            homeGoals: v.heim ? 2 : 0, awayGoals: v.heim ? 0 : 2 }, "Liga");
        const v2 = Vorschau.vorschau(state);
        if (!v2.bilanz || v2.bilanz.siege !== 1 || v2.bilanz.tore !== 2 || v2.bilanz.letzte[0].ergebnis !== "2:0") throw new Error(`Bilanz: ${JSON.stringify(v2.bilanz)}`);
        if (v2.ausfaelle.gegner[0]?.name !== verletzt.name) throw new Error("Wichtigster Ausfall nicht genannt");
    });

    test("Partnervereine: Ausbildungspartner mit Einsatzgarantie und Vorkaufsrecht, großer Partner mit Leihangeboten", () => {
        const { PartnerEngine: Partner } = require('./js/engine/partnerEngine.js');
        const { AIManagerEngine } = require('./js/engine/aiManagerEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        club.transferBudget = 200000000; club.balance = 300000000;

        // Ausbildungspartner: kleiner, im selben Land
        const kleine = Partner.vorschlaege(state, "klein");
        if (!kleine.length || kleine.some(c => (c.reputation || 50) > club.reputation && (c.level || 1) <= (club.level || 1))) throw new Error("Vorschläge für den kleinen Partner falsch");
        const klein = kleine[0];
        const kasseVorher = club.balance, partnerKasse = klein.balance || 0;
        if (!Partner.anbieten(state, "klein", klein.id).success) throw new Error("Kooperation abgelehnt");
        if (!(club.balance < kasseVorher) || !((klein.balance || 0) > partnerKasse)) throw new Error("Kein Jahresbeitrag");
        if (Partner.anbieten(state, "klein", kleine[1].id).success) throw new Error("Zwei Ausbildungspartner");

        // Leihe mit Einsatzgarantie: Auch ein schwacher Spieler steht in der Elf
        const leihling = state.players.filter(p => p.clubId === club.id && p.pos !== "TW" && (p.age || 30) <= 23)[0]
            || state.players.find(p => p.clubId === club.id && p.pos === "ZM");
        if (!Partner.verleihen(state, leihling.id).success) throw new Error("Verleihen zum Partner gescheitert");
        if (leihling.clubId !== klein.id || !leihling.leihe.garantie || leihling.leihe.stammvereinId !== club.id) throw new Error("Leihe ohne Garantie");
        leihling.overall = 35; leihling.injuredWeeks = 0; leihling.suspendedMatches = 0;
        AIManagerEngine.prepareClubForMatch(state, klein.id);
        if (!klein.lineup.includes(leihling.id)) throw new Error("Einsatzgarantie greift nicht");
        if (klein.lineup.length !== 11 || new Set(klein.lineup).size !== 11) throw new Error("Aufstellung kaputt");

        // Vorkaufsrecht auf das beste Talent des Partners
        const angebot = club.partnerAngebote?.klein;
        if (angebot) {
            const talent = state.players.find(p => p.id === angebot.playerId);
            const budget = club.transferBudget;
            const r = Partner.vorkaufsrecht(state);
            if (!r.success || talent.clubId !== club.id || budget - club.transferBudget !== angebot.preis) throw new Error(`Vorkaufsrecht: ${r.error}`);
            if (!(angebot.preis < (talent.value || 0))) throw new Error("Kein Vorzugspreis");
        }

        // Großer Partner: nur wer etwas gilt; Leihe ohne Gebühr, halbes Gehalt
        club.reputation = 58;
        const grosse = Partner.vorschlaege(state, "gross");
        if (!grosse.length || grosse.some(c => (c.reputation || 50) < 58 + Partner.ABSTAND)) throw new Error("Vorschläge für den großen Partner falsch");
        const gross = grosse[0];
        const r2 = Partner.anbieten(state, "gross", gross.id);
        if (!r2.success) throw new Error(`Großer Partner lehnt ab: ${r2.error}`);
        const leihe = club.partnerAngebote?.gross?.playerIds?.[0];
        if (leihe) {
            const sp = state.players.find(p => p.id === leihe);
            if (!Partner.ausleihen(state, leihe).success || sp.clubId !== club.id || sp.leihe.lohnAnteil !== Partner.LEIH_ANTEIL) throw new Error("Leihe vom großen Partner gescheitert");
        }

        // Nach drei Spielzeiten läuft die Kooperation aus
        state.seasonYear += Partner.LAUFZEIT;
        Partner.saisonstart(state);
        if (Partner.partner(state).klein || Partner.partner(state).gross) throw new Error("Kooperation läuft nicht aus");
    });

    test("Investor: 50+1, Rat des Trainers, Anspruch und Ungeduld, Rettung mit Auflagen und Punktabzug", () => {
        const { InvestorEngine: Investor } = require('./js/engine/investorEngine.js');
        const { SeasonEngine } = require('./js/engine/seasonEngine.js');
        const { TransferEngine } = require('./js/engine/transferEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);

        // 50+1: höchstens 49 %, weniger Geld, kein Konzern
        if (!Investor.fuenfzigPlusEins(club)) throw new Error("50+1 gilt nicht in Deutschland");
        const fonds = Investor.bedingungen(club, "fonds");
        if (fonds.anteil !== 49 || Math.abs(fonds.einstieg - 0.3) > 1e-9 || fonds.anspruch !== 0) throw new Error(`50+1 falsch: ${JSON.stringify(fonds)}`);

        // Der Trainer bittet um die Suche, nach ein paar Wochen kommt ein Angebot
        const r = Investor.suche(state, () => 0);
        if (!r.success || !r.sucht || !state.investorSuche) throw new Error("Suche nicht begonnen");
        if (!Investor.suche(state, () => 0).error) throw new Error("Zweite Suche in derselben Saison");
        for (let i = 0; i < Investor.SUCHE_TAGE[1] && !state.investorAngebot; i++) Investor.tag(state, () => 0);
        const a = state.investorAngebot;
        if (!a || a.anteil > 49 || a.art === "konzern") throw new Error("Kein passendes Angebot nach der Suche");

        // Der Vorstand folgt dem Rat, wenn er dem Trainer vertraut
        if (!Investor.empfehle(state, true).success) throw new Error("Rat nicht angenommen");
        state.boardConfidence = 90;
        const kasse = club.balance, etat = club.wageBudget;
        for (let i = 1; i < Investor.BEDENKZEIT; i++) Investor.tag(state, () => 0.1);
        if (!state.investorAngebot) throw new Error("Der Vorstand entscheidet vor Ablauf der Bedenkzeit");
        // Der Saisonwechsel setzt den Kalender zurück - die Frist läuft trotzdem ab
        state.currentDayIndex = 0;
        Investor.tag(state, () => 0.1);
        if (state.investorAngebot || !Investor.investor(club)) throw new Error("Der Vorstand ist dem Rat nicht gefolgt");
        if (club.balance - kasse !== a.einstieg || club.wageBudget - etat !== a.gehaltPlus) throw new Error("Einstieg ohne Geld");

        // Anspruch: Ein Konzern in England schraubt das Saisonziel hoch
        const englisch = state.clubs.filter(c => c.countryId === "en" && (c.level || 1) === 1)
            .sort((x, y) => (x.reputation || 0) - (y.reputation || 0))[10];
        const zielVorher = BoardEngine.bestimmeZiel(state, englisch).platz;
        const konzern = Investor.angebotFuer(state, englisch, "konzern");
        if (konzern.anteil !== 90 || konzern.anspruch !== 2) throw new Error("Konzern ohne 50+1 falsch");
        Investor.vollziehe(state, englisch, konzern);
        const zielNachher = BoardEngine.bestimmeZiel(state, englisch).platz;
        // Zwei Plätze Anspruch - und das Geld hebt den Etat-Rang obendrein
        if (zielNachher > Math.max(1, zielVorher - 2)) throw new Error(`Anspruch greift nicht: ${zielVorher} -> ${zielNachher}`);
        if (englisch.vorstandsziel.anspruch !== 2) throw new Error("Anspruch nicht im Saisonziel vermerkt");

        // Ungeduld: Derselbe Rückstand kostet mit Investor mehr Vertrauen
        const vertrauenBei = (mitInvestor) => {
            const gesichert = club.investor;
            if (!mitInvestor) delete club.investor;
            club.vorstandsziel = { ...(club.vorstandsziel || {}), platz: 3, leagueId: club.leagueId };
            const zeile = state.standings.findIndex(e => e.clubId === club.id);
            const [eigene] = state.standings.splice(zeile, 1);
            state.standings.splice(7, 0, eigene);
            state.vorstandStimmung = 0;
            state.jobSecurity = null;
            SeasonEngine.updateBoardConfidence(state);
            club.investor = gesichert;
            return state.boardConfidence;
        };
        club.investor = null;
        Investor.vollziehe(state, club, Investor.angebotFuer(state, club, "fonds"));
        const ohne = vertrauenBei(false), mit = vertrauenBei(true);
        if (!(mit < ohne)) throw new Error(`Investor macht nicht ungeduldiger: ${ohne} / ${mit}`);

        // Finanznot: Beim zweiten Mal an der Schuldengrenze kommt die Rettung mit Auflagen
        club.investor = null;
        club.balance = -5000000000;
        FinanceEngine.applyWeeklyCosts(state);
        if (club.auflagen) throw new Error("Auflagen schon beim ersten Mal");
        club.balance = -5000000000;
        FinanceEngine.applyWeeklyCosts(state);
        const auf = club.auflagen;
        if (!auf || club.balance !== 0 || club.transferBudget !== 0 || !Investor.investor(club) || club.investor.art !== "retter") throw new Error("Keine Rettung");
        if (!(club.wageBudget <= auf.deckel) || !Investor.gehaltsHindernis(state, club, 50000)) throw new Error("Gehaltsdeckel greift nicht");

        // Ein Verkauf zählt aufs Verkaufsziel und füllt das Transferbudget nicht
        const kaeufer = state.clubs.find(c => c.id !== club.id && (c.level || 1) === 1);
        const verkauft = state.players.filter(p => p.clubId === club.id && !p.leihe).sort((x, y) => (x.value || 0) - (y.value || 0))[5];
        kaeufer.transferBudget = 1e10; kaeufer.balance = 1e10;
        if (!TransferEngine.executeTransfer(state, verkauft.id, kaeufer.id, 1000000, 20000, 3)) throw new Error("Verkauf gescheitert");
        if (club.transferBudget !== 0) throw new Error("Verkauf füllt das Transferbudget trotz Auflage");
        if (!club.auflagen.verkauf || club.auflagen.verkauf.erloes !== 1000000) throw new Error("Verkauf zählt nicht aufs Ziel");

        // Schließt das Fenster ohne genug Verkäufe, zieht der Verband drei Punkte ab
        club.auflagen.verkauf.phase = "laeuft";
        const offen = TransferEngine.istTransferfenster;
        TransferEngine.istTransferfenster = () => false;
        try { Investor.tag(state); } finally { TransferEngine.istTransferfenster = offen; }
        if (club.punktabzug?.punkte !== Investor.AUFLAGE.abzug || club.auflagen.verkauf) throw new Error("Kein Punktabzug");
        const tabelle = GameState.calculateStandings(GameState.getLeagueClubs(state), state.schedule, 0);
        const zeile = tabelle.find(e => e.clubId === club.id);
        if (zeile.points !== -Investor.AUFLAGE.abzug || zeile.abzug !== Investor.AUFLAGE.abzug) throw new Error("Punktabzug fehlt in der Tabelle");

        // Verfehlte Saisonziele: Der Investor zieht sich zurück, der Gehaltsaufschlag endet
        club.investor = null;
        delete club.auflagen;
        Investor.vollziehe(state, club, Investor.angebotFuer(state, club, "fonds"));
        club.investor.seit = (state.seasonYear || 1) - 1;
        club.investor.geduld = 1;
        const etatMit = club.wageBudget;
        const bewertung = BoardEngine.evaluateSeasonEnd;
        BoardEngine.evaluateSeasonEnd = () => ({ achieved: false });
        try { Investor.saisonEnde(state); } finally { BoardEngine.evaluateSeasonEnd = bewertung; }
        if (Investor.investor(club) || club.wageBudget !== etatMit - club.investor.gehaltPlus) throw new Error("Kein Rückzug nach verfehltem Ziel");

        // Neue Saison: Der Punktabzug verfällt, KI-Vereine werden übernommen
        state.seasonYear = (state.seasonYear || 1) + 1;
        Investor.saisonstart(state, () => 0);
        if (club.punktabzug) throw new Error("Punktabzug verfällt nicht");
        const neu = state.clubs.filter(c => c.id !== club.id && Investor.investor(c) && c.investor.seit === state.seasonYear);
        if (neu.length < 3) throw new Error(`Zu wenige Übernahmen in der Welt: ${neu.length}`);
        if (neu.some(c => c.countryId === "de" && c.investor.anteil > 49)) throw new Error("50+1 bei KI-Übernahme verletzt");
    });

    test("Ehemalige: Rückkehr in den Trainerstab mit Herzensrabatt, Abschiedsspiel für Legenden", () => {
        const { EhemaligeEngine: Ehemalige } = require('./js/engine/ehemaligeEngine.js');
        const { ChronikEngine } = require('./js/engine/chronikEngine.js');
        const { SeasonEngine } = require('./js/engine/seasonEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === state.userClubId);
        const chronik = ChronikEngine.chronik(state);
        const eigene = state.players.filter(p => p.clubId === club.id);
        const legende = eigene.find(p => ["ZM", "DM", "OM"].includes(p.pos)) || eigene[0];
        const kurz = eigene.find(p => p !== legende);
        const fremd = state.players.find(p => p.clubId && p.clubId !== club.id);
        // Bilanzen aus früheren Saisons: 180 Spiele (Legende), 12 Spiele, 55 Spiele für uns und jetzt woanders
        chronik.spieler[legende.id] = [legende.name, 180, 41, 30, 1, 1, legende.pos];
        chronik.spieler[kurz.id] = [kurz.name, 12, 1, 0, 1, 1, kurz.pos];
        chronik.spieler[fremd.id] = [fremd.name, 55, 9, 4, 1, 1, fremd.pos];

        // Das Karriereende über den echten Ablauf
        const chanceVorher = SeasonEngine.karriereendeChance;
        const gehen = new Set([legende.id, kurz.id, fremd.id]);
        SeasonEngine.karriereendeChance = (p) => gehen.has(p.id) ? 1 : 0;
        try { SeasonEngine.processRetirements(state); } finally { SeasonEngine.karriereendeChance = chanceVorher; }
        if (state.players.some(p => gehen.has(p.id))) throw new Error("Karriereende nicht vollzogen");
        const liste = club.ehemalige || [];
        const l = liste.find(e => e.id === legende.id), f = liste.find(e => e.id === fremd.id);
        if (!l || !l.legende || !f || f.legende || liste.some(e => e.id === kurz.id)) throw new Error(`Liste der Ehemaligen falsch: ${JSON.stringify(liste.map(e => [e.name, e.spiele, e.legende]))}`);
        if (!f.zuletzt) throw new Error("Der letzte Verein fehlt");
        if (Ehemalige.offeneAbschiede(state).length !== 1) throw new Error("Kein Abschiedsspiel angeboten");

        // In der Vorbereitung bewirbt sich der Ehemalige - mit Herzensrabatt
        const chance = Ehemalige.CHANCE;
        Ehemalige.CHANCE = 1;
        try { PreseasonEngine.start(state); } finally { Ehemalige.CHANCE = chance; }
        const k = (state.preseason.bewerber[l.bereich] || []).find(b => b.ehemaliger && b.ehemaliger.id === legende.id);
        if (!k || !k.ehemaliger.legende) throw new Error("Die Legende bewirbt sich nicht");
        const markt = PreseasonEngine.rundeGehalt(PreseasonEngine.marktGehalt(club, l.bereich, k.guete));
        if (!(k.gehalt < markt)) throw new Error(`Kein Herzensrabatt: ${k.gehalt} / ${markt}`);
        const moral = state.players.find(p => p.clubId === club.id).morale ?? 70;
        if (club.staff) delete club.staff[l.bereich];
        const r = PreseasonEngine.verpflichte(state, l.bereich, k.id);
        if (!r.ok) throw new Error(`Verpflichtung gescheitert: ${r.grund}`);
        if (!club.staff[l.bereich].ehemaliger?.legende || !l.eingestellt) throw new Error("Rückkehr nicht vermerkt");
        if (!((state.players.find(p => p.clubId === club.id).morale ?? 70) > moral || moral >= 99)) throw new Error("Die Legende hebt die Stimmung nicht");
        if (Ehemalige.verfuegbar(state).some(e => e.id === legende.id)) throw new Error("Eingestellt und trotzdem verfügbar");

        // Das Abschiedsspiel: volles Haus, Geld für den Verein, Eintrag in der Chronik
        const kasse = club.balance;
        const a = Ehemalige.abschiedsspiel(state, legende.id, () => 0.5);
        if (!a.success || !(a.zuschauer > 0) || club.balance - kasse !== a.fuerVerein || !(a.fuerVerein < a.einnahmen)) throw new Error("Abschiedsspiel ohne Einnahmen");
        if (!chronik.abschiede?.[0] || chronik.abschiede[0].name !== legende.name) throw new Error("Abschiedsspiel fehlt in der Chronik");
        if (Ehemalige.abschiedsspiel(state, legende.id).success) throw new Error("Zweites Abschiedsspiel");

        // Nach vier Jahren ist der Ehemalige nicht mehr im Fußball
        state.seasonYear = (state.seasonYear || 1) + Ehemalige.JAHRE;
        if (Ehemalige.verfuegbar(state).some(e => e.id === fremd.id)) throw new Error("Nach vier Jahren noch verfügbar");
    });

    test("Vision: Plan über fünf Spielzeiten mit Fernziel und Jahreszielen, Bilanz am Saisonende", () => {
        const { VisionEngine: Vision } = require('./js/engine/visionEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        const v = Vision.vision(state);
        if (!v || v.bisSaison !== (state.seasonYear || 1) + Vision.LAUFZEIT - 1 || v.jahresziele.length !== 3) throw new Error("Vision unvollständig");
        if (v.fern.art !== "titel") throw new Error(`Bayern ohne Titelziel: ${v.fern.art}`);
        if (!state.inbox.some(m => /Vision des Vorstands/.test(m.subject || ""))) throw new Error("Keine Post zur Vision");
        // Dieselbe Lage ergibt dieselbe Vision - ohne die Zufallsfolge der Welt anzufassen
        const ziele = JSON.stringify(v.jahresziele);
        delete club.vision;
        if (JSON.stringify(Vision.vision(state).jahresziele) !== ziele) throw new Error("Vision nicht reproduzierbar");

        // Die Jahresziele messen die laufende Saison
        state.schedule.slice(0, 6).forEach(r => r.matches.forEach(m => {
            if (m.homeClubId !== "muc" && m.awayClubId !== "muc") return;
            const heim = m.homeClubId === "muc";
            Object.assign(m, { played: true, homeGoals: heim ? 3 : 0, awayGoals: heim ? 0 : 3, stats: { possession: heim ? [60, 40] : [40, 60] } });
        }));
        const w = Vision.werte(state);
        if (w.spiele !== 6 || w.toreJeSpiel !== 3 || w.gegentoreJeSpiel !== 0 || w.ballbesitz !== 60) throw new Error(`Werte falsch: ${JSON.stringify(w)}`);
        ["offensiv", "ballbesitz", "kompakt"].forEach(k => { if (Vision.erfuellt(k, w) !== true) throw new Error(`${k} nicht erfüllt`); });
        if (Vision.erfuellt("jung", w) !== null) throw new Error("Ohne Zugänge gibt es nichts zu messen");

        // Saisonende: Meister erfüllt das Fernziel, das Vertrauen steigt, Bilanz nur einmal
        const zeile = state.standings.findIndex(e => e.clubId === "muc");
        state.standings.unshift(state.standings.splice(zeile, 1)[0]);
        state.vorstandStimmung = 0;
        const vorher = state.boardConfidence ?? 75;
        const r = Vision.saisonEnde(state);
        if (!r || r.fern !== "erfuellt" || !(state.boardConfidence > vorher)) throw new Error(`Bilanz falsch: ${JSON.stringify(r)} ${vorher} -> ${state.boardConfidence}`);
        if (Vision.saisonEnde(state) !== null) throw new Error("Zweite Bilanz in derselben Saison");

        // Ein Zweitligist will aufsteigen - geschafft, sobald er eine Liga höher spielt
        const zweit = state.clubs.find(c => (c.level || 1) === 2 && c.countryId === "de");
        state.userClubId = zweit.id;
        const vz = Vision.vision(state);
        if (vz.fern.art !== "aufstieg") throw new Error(`Zweitligist ohne Aufstiegsziel: ${vz.fern.art}`);
        zweit.level = 1;
        state.seasonYear = (state.seasonYear || 1) + 1;
        Vision.saisonstart(state);
        if (zweit.vision.fern.status !== "erfuellt") throw new Error("Aufstieg nicht erkannt");
        // Nach fünf Spielzeiten gibt es eine neue Vision
        state.seasonYear = vz.bisSaison + 1;
        if (Vision.vision(state).seit !== state.seasonYear) throw new Error("Keine neue Vision nach Ablauf");
    });

    test("Kaderplanung: Verträge, Alter, Leihen und Vorverträge über drei Spielzeiten, Baustellen als Suchauftrag", () => {
        const { KaderplanungEngine: K } = require('./js/engine/kaderplanungEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        const bedarf = K.bedarf(club);
        if (Object.values(bedarf).reduce((a, b) => a + b, 0) !== 24) throw new Error(`Bedarf ergibt nicht den Kader: ${JSON.stringify(bedarf)}`);
        const kader = state.players.filter(p => p.clubId === "muc");
        const im = (plan, k, id) => plan.spalten[k].teile.flatMap(t => t.spieler).find(s => s.id === id);

        const auslaufend = kader.find(p => p.pos === "IV");
        auslaufend.contractYears = 1;
        const alt = kader.find(p => p.pos === "ZM" && p !== auslaufend);
        alt.age = 34; alt.contractYears = 3;
        const fremd = state.players.find(p => p.clubId && p.clubId !== "muc" && p.pos === "ST");
        fremd.vorvertrag = { clubId: "muc", clubName: club.name, saison: state.seasonYear };
        const leihling = kader.find(p => p.pos === "OM" || p.pos === "LA");
        const leihverein = state.clubs.find(c => c.id !== "muc" && (c.level || 1) === 2);
        leihling.leihe = { stammvereinId: "muc", leihvereinId: leihverein.id, bisSaison: state.seasonYear };
        leihling.clubId = leihverein.id; leihling.contractYears = 3;

        const p = K.plan(state);
        if (p.spalten.length !== 3 || p.spalten[0].teile.length !== 6) throw new Error("Planung hat nicht drei Spielzeiten und sechs Mannschaftsteile");
        if (!im(p, 0, auslaufend.id)?.marken.includes("vertrag") || im(p, 1, auslaufend.id)) throw new Error("Auslaufender Vertrag falsch geplant");
        if (!im(p, 0, alt.id)?.marken.includes("alter") || im(p, 1, alt.id)) throw new Error("Karriereende mit 35 nicht eingeplant");
        if (im(p, 0, fremd.id) || !im(p, 1, fremd.id)?.marken.includes("zugang")) throw new Error("Vorvertrag nicht als Zugang geplant");
        if (im(p, 0, leihling.id) || !im(p, 1, leihling.id)?.marken.includes("rueckkehr")) throw new Error("Leihrückkehrer nicht geplant");

        // Fallen die Torhüter weg, ist das eine Baustelle - mit Suchauftrag
        kader.filter(p => p.pos === "TW").slice(1).forEach(p => { p.contractYears = 1; });
        const tor = K.plan(state).spalten[1].teile.find(t => t.key === "tw");
        if (tor.status !== "luecke") throw new Error(`Torwartlücke nicht erkannt: ${tor.anzahl}/${tor.bedarf}`);
        const h = K.hinweise(state, 10).find(x => x.key === "tw");
        if (!h || !/im Tor/.test(h.text)) throw new Error(`Kein Hinweis zum Tor: ${JSON.stringify(K.hinweise(state, 10).map(x => x.text))}`);
        const r = K.suchauftrag(state, "tw");
        if (!r.success || r.assignment.position !== "TW" || r.assignment.minOverall !== p.stammStaerke) throw new Error("Suchauftrag falsch");
    });

    test("Vertragsklauseln: Steigerung, Auf- und Abstieg, Mindestablöse und Option in Verhandlung, Verlängerung und Saisonwechsel", () => {
        const { KlauselEngine: K } = require('./js/engine/klauselEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => (c.level || 1) === 2 && c.countryId === "de");
        state.userClubId = club.id;
        club.balance = 50000000; club.transferBudget = 50000000; club.wageBudget = 50000000;

        // Was die Klauseln dem Spieler wert sind
        if (!(K.faktor({ steigerung: 10 }, 3, club) > 1.09)) throw new Error("Steigerung ist ihm nichts wert");
        if (!(K.faktor({ option: true }, 3, club) < 1)) throw new Error("Eine Vereinsoption gefällt ihm");
        if (K.normalisiere({ aufstieg: 25, mindestAbloese: 1e6 }, state.clubs.find(c => c.id === "muc")).aufstieg) throw new Error("Aufstiegsklausel beim Erstligisten");

        // Verhandlung: Mit Steigerung und Mindestablöse reicht ein niedrigeres Grundgehalt
        const frei = state.players.find(p => p.clubId && p.clubId !== club.id && p.pos === "ZM" && p.overall >= 65);
        const alt = state.clubs.find(c => c.id === frei.clubId);
        alt.playerIds = alt.playerIds.filter(id => id !== frei.id);
        frei.clubId = null;
        frei.hiddenAttributes = Object.assign({}, frei.hiddenAttributes, { injuryProneness: 1 });
        const neg = NegotiationEngine.startTransferNegotiation(state, frei.id, club.id).negotiation;
        const angebot = { wage: Math.round(neg.demand.wage * 0.9), years: 3, signingBonus: neg.demand.signingBonus,
            agentFee: neg.demand.agentFee, klauseln: { steigerung: 10, mindestAbloese: 2000000, aufstieg: 7 } };
        NegotiationEngine.submitOffer(state, neg.id, angebot);
        if (neg.lastOffer.klauseln?.steigerung !== 10 || neg.lastOffer.klauseln.aufstieg) throw new Error(`Klauseln falsch übernommen: ${JSON.stringify(neg.lastOffer.klauseln)}`);
        neg.replyDay = NegotiationEngine.today(state);
        NegotiationEngine.processDay(state);
        if (neg.stage !== NegotiationEngine.STAGES.MEDICAL) throw new Error(`Angebot mit Klauseln abgelehnt (${neg.status}, ${neg.stage})`);
        neg.replyDay = NegotiationEngine.today(state);
        const echterZufall = Math.random;
        Math.random = () => 0.99;
        try { NegotiationEngine.processDay(state); } finally { Math.random = echterZufall; }
        if (frei.clubId !== club.id || frei.klauseln?.steigerung !== 10 || frei.klauseln.mindestAbloese !== 2000000) throw new Error(`Klauseln stehen nicht im Vertrag: ${JSON.stringify(frei.klauseln)}`);

        // Saisonwechsel mit Aufstieg: Steigerung und Aufstiegsklausel
        frei.klauseln.aufstieg = 25;
        const lohn = frei.wage;
        K.saisonwechsel(state, { promoted: [{ clubId: club.id }], relegated: [] });
        if (Math.abs(frei.wage - lohn * 1.1 * 1.25) > 10) throw new Error(`Gehalt nach Aufstieg: ${lohn} -> ${frei.wage}`);

        // Abstieg: Kürzung - oder er geht ablösefrei
        const kader = state.players.filter(p => p.clubId === club.id && p !== frei);
        const geht = kader[0];
        K.setze(geht, { abstieg: "ausstieg" }, club);
        frei.klauseln = { abstieg: "kuerzung" };
        const vorAbstieg = frei.wage;
        K.saisonwechsel(state, { promoted: [], relegated: [{ clubId: club.id }] });
        if (Math.abs(frei.wage - vorAbstieg * 0.7) > 10) throw new Error(`Gehalt nach Abstieg: ${vorAbstieg} -> ${frei.wage}`);
        if (geht.clubId !== null || club.playerIds.includes(geht.id)) throw new Error("Abstiegsklausel: Er ist nicht gegangen");

        // Vereinsoption: erst im letzten Vertragsjahr
        const opt = kader[1];
        opt.contractYears = 2;
        K.setze(opt, { option: true }, club);
        if (K.zieheOption(state, opt.id).success) throw new Error("Option vor dem letzten Vertragsjahr gezogen");
        opt.contractYears = 1;
        if (!K.zieheOption(state, opt.id).success || opt.contractYears !== 2 || opt.klauseln) throw new Error("Option nicht gezogen");

        // Mindestablöse: Ein Erstligist mit Geld greift im Fenster zu
        const ziel = kader[2];
        ziel.overall = 92; ziel.value = 3000000;
        K.setze(ziel, { mindestAbloese: 2500000 }, club);
        const fenster = TransferEngine.istTransferfenster;
        TransferEngine.istTransferfenster = () => true;
        let wechsel;
        try { wechsel = K.mindestAbloeseTag(state, () => 0); } finally { TransferEngine.istTransferfenster = fenster; }
        const kaeufer = state.clubs.find(c => c.id === ziel.clubId);
        if (!wechsel.length || kaeufer.level !== 1 || kaeufer.countryId !== "de" || ziel.klauseln) throw new Error(`Mindestablöse nicht gezogen: ${JSON.stringify(wechsel)}`);

        // Verlängerung: Mit einer Steigerung unterschreibt er für weniger Grundgehalt
        const v = kader.slice(3).find(p => !ContractEngine.verlaengerungsHindernis(p) && p.clubId === club.id);
        const d = ContractEngine.getExtensionDemand(v, club, state);
        const wenig = Math.round(d.demandWage * 0.84);
        if (ContractEngine.negotiateExtension(Object.assign({}, v), club, wenig, 3, d.preferredRole, 0, state).success) throw new Error("Zu wenig Gehalt ohne Klausel angenommen");
        const res = ContractEngine.negotiateExtension(v, club, wenig, 3, d.preferredRole, 0, state, { steigerung: 10 });
        if (!res.success || v.klauseln?.steigerung !== 10) throw new Error(`Verlängerung mit Steigerung: ${res.reason}`);
    });

    test("Gegneranweisungen: je Gegenspieler anlaufen, Zweikampf und schwacher Fuß - Wirkung nach seinen Stärken, Empfehlung des Analysten", () => {
        const { GegneranweisungEngine: G } = require('./js/engine/gegneranweisungEngine.js');
        const { MatchplanEngine: MP } = require('./js/engine/matchplanEngine.js');
        const { OpponentAnalysisEngine: OA } = require('./js/engine/opponentAnalysisEngine.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const gast = state.clubs.find(c => c.id === "dor");
        const match = { id: "ga", homeClubId: "muc", awayClubId: "dor" };

        // Die Tafel: die Elf ohne Torwart, der Fuß nur für Einfüßige
        const tafel = G.tafel(state, match);
        if (tafel.length < 9 || tafel.some(t => t.pos === "TW")) throw new Error(`Tafel falsch: ${tafel.length}`);
        tafel.forEach(t => { if (t.moeglich.fuss.length !== (t.foot && t.foot !== "beidfüßig" ? 1 : 0)) throw new Error(`Fuß bei ${t.name} (${t.foot})`); });

        // Die Wirkung hängt am Spieler
        const basis = { id: "x", overall: 75, technique: 75, passing: 75, dribbling: 75, physical: 75, foot: "rechts" };
        const mit = (werte, a) => G.wirkung(Object.assign({}, basis, werte), a).faktor;
        if (!(mit({ technique: 66, passing: 68 }, { anlaufen: "immer" }) < mit({}, { anlaufen: "immer" }))) throw new Error("Anlaufen trifft den Unsicheren nicht stärker");
        if (!(mit({ dribbling: 84 }, { anlaufen: "nie" }) < 1 && mit({}, { anlaufen: "nie" }) > 1)) throw new Error("Kommen lassen: Dribbler und Passgeber nicht unterschieden");
        if (!(mit({ physical: 64 }, { zweikampf: "hart" }) < mit({}, { zweikampf: "hart" }))) throw new Error("Hart angehen trifft den Schwachen nicht stärker");
        if (G.normalisiere(Object.assign({}, basis, { foot: "beidfüßig" }), { fuss: "schwach", anlaufen: "quatsch" }).fuss !== undefined) throw new Error("Schwacher Fuß bei einem Beidfüßigen");

        // Festlegen: Ungültiges fällt weg, der Matchplan nimmt die Anweisungen mit
        const ziel = tafel[0], zweiter = tafel[1];
        const je = { [ziel.id]: { anlaufen: "immer", zweikampf: "hart" }, [zweiter.id]: { zweikampf: "vorsichtig", unsinn: 1 }, fremd: { anlaufen: "immer" } };
        const gesetzt = G.festlegen(state, match, je);
        if (Object.keys(gesetzt).length !== 2 || gesetzt[zweiter.id].unsinn) throw new Error(`Festlegen: ${JSON.stringify(gesetzt)}`);
        const opt = MP.spielOptionen(state, match);
        if (!opt || opt.side !== "home" || !opt.gedeckt[ziel.id] || opt.anweisungen[ziel.id]?.zweikampf !== "hart") throw new Error(`Anweisungen ohne Plan nicht im Spiel: ${JSON.stringify(opt)}`);
        if (!(opt.bonus < 1)) throw new Error("Anlaufen kostet keine Kraft");
        // Mit enger Deckung desselben Spielers wirken beide
        const zielSpieler = state.players.find(p => String(p.id) === String(ziel.id));
        MP.festlegen(state, match, ["engDecken"], ziel.id);
        const beide = MP.spielOptionen(state, match);
        if (state.matchplan.zielId === ziel.id && !(beide.gedeckt[ziel.id] < opt.gedeckt[ziel.id])) throw new Error("Enge Deckung und Anweisung wirken nicht zusammen");

        // In der Simulation: Hart gegen alle - mehr Fouls und Karten
        const heim = state.clubs.find(c => c.id === "muc");
        delete state.matchplan;
        const zaehle = (hart) => {
            let gelb = 0, fouls = 0;
            for (let i = 0; i < 80; i++) {
                if (hart) { const alle = {}; G.elf(state, gast).forEach(p => { alle[p.id] = { zweikampf: "hart" }; }); G.festlegen(state, match, alle); }
                else G.abschliessen(state, match);
                const m = { id: "ga" + i, played: false, homeClubId: "muc", awayClubId: "dor" };
                const plan = MP.spielOptionen(state, match);
                MatchEngine.simulateFullMatch(m, heim, gast, state.players, plan ? { matchplan: plan } : {});
                gelb += m.stats.yellowCards[0]; fouls += m.stats.fouls[0];
                state.players.forEach(p => { p.fitness = 95; p.suspendedMatches = 0; p.injuredWeeks = 0; });
            }
            return { gelb, fouls };
        };
        const ohne = zaehle(false), hart = zaehle(true);
        if (!(hart.fouls > ohne.fouls && hart.gelb > ohne.gelb)) throw new Error(`Hart angehen ohne Folgen: ${JSON.stringify({ ohne, hart })}`);

        // Im Livespiel: Zweikampfhärte und schwacher Fuß je Spieler
        const { MatchFlowEngine } = require('./js/engine/matchFlowEngine.js');
        const fl = new MatchFlowEngine({ anweisung: (id) => (String(id) === String(ziel.id) ? { zweikampf: "hart", fuss: "schwach" } : null) });
        if (fl.anweisungsHaerte({ id: ziel.id }) !== 1 || fl.anweisungsHaerte({ id: zweiter.id }) !== 0) throw new Error("Zweikampfhärte je Spieler im Livespiel fehlt");

        // Der Analyst: unter zweieinhalb Sternen still, ein sehr guter sieht den Dribbler
        const echt = OA.analyst;
        try {
            OA.analyst = () => ({ name: "Blind", guete: 20, sterne: 1 });
            if (Object.keys(G.empfehlungen(state, match)).length) throw new Error("Ein schwacher Analyst empfiehlt");
            OA.analyst = () => ({ name: "Scharf", guete: 100, sterne: 5 });
            zielSpieler.dribbling = (zielSpieler.overall || 70) + 8;
            const e = G.empfehlungen(state, match)[String(ziel.id)];
            if (!e || e.anweisung.anlaufen !== "nie" || e.anweisung.zweikampf !== "vorsichtig") throw new Error(`Dribbler falsch empfohlen: ${JSON.stringify(e)}`);
        } finally { OA.analyst = echt; }

        // Nach dem Spiel sind die Anweisungen erledigt
        G.festlegen(state, match, { [ziel.id]: { anlaufen: "immer" } });
        MP.abschliessen(state, match);
        if (state.gegneranweisungen || MP.spielOptionen(state, match)) throw new Error("Anweisungen gelten über das Spiel hinaus");
    });

    test("Jugendvorschau: Der Jahrgang ist drei Spieltage vorher gesichtet, der Nachwuchsleiter beschreibt ihn, am Jugendtag kommt genau er", () => {
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        const club = state.clubs.find(c => c.id === "muc");
        const tag = YouthEngine.jugendtagSpieltag(state);
        YouthEngine.setzeSchwerpunkte(state, club.id, { einzug: "national" });
        const kosten = YouthEngine.einzugKosten(club, "national");
        const talenteVorher = YouthEngine.eigeneTalente(state).length;

        // Die Vorschau: gesichtet, aber noch nicht in der Akademie und nicht bezahlt
        state.currentMatchday = tag - 3;
        const kasse = club.balance;
        if (!YouthEngine.pruefeJugendtag(state)) throw new Error("Keine Vorschau");
        const vs = YouthEngine.vorschau(state);
        if (!vs || vs.talente.length !== YouthEngine.JAHRGAENGE.normal.anzahl) throw new Error("Kein gesichteter Jahrgang");
        if (YouthEngine.eigeneTalente(state).length !== talenteVorher || club.balance !== kasse) throw new Error("Die Vorschau nimmt schon auf oder kostet schon");
        const mail = state.inbox.find(m => /Jugendtag in drei Wochen/.test(m.subject));
        const b = YouthEngine.vorschauBericht(state, club, vs.talente);
        if (!mail || !mail.body.includes(b.bester.name) || !["golden", "gut", "ordentlich", "schwach"].includes(b.urteil)) throw new Error(`Bericht fehlt: ${mail?.body}`);

        // Andere Schwerpunkte: Die Scouts sichten neu
        const res = YouthEngine.setzeSchwerpunkte(state, club.id, { jahrgang: "breite" });
        if (!res.vorschauNeu || YouthEngine.vorschau(state).talente.length !== 5) throw new Error("Neue Schwerpunkte ändern die Vorschau nicht");
        const ids = YouthEngine.vorschau(state).talente.map(t => t.id);
        if (YouthEngine.setzeSchwerpunkte(state, club.id, { jahrgang: "breite" }).vorschauNeu) throw new Error("Ohne Änderung wird neu gesichtet");

        // Der Jugendtag: genau dieser Jahrgang, jetzt mit Sichtungskosten
        state.currentMatchday = tag;
        if (!/Jugendtag: 5 neue Talente/.test(YouthEngine.pruefeJugendtag(state) || "")) throw new Error("Am Jugendtag kommt ein anderer Jahrgang");
        const jetzt = YouthEngine.eigeneTalente(state).map(t => t.id);
        if (ids.some(id => !jetzt.includes(id))) throw new Error("Die gesichteten Talente fehlen in der Akademie");
        if (club.balance !== kasse - kosten) throw new Error(`Sichtung falsch bezahlt: ${kasse - club.balance} statt ${kosten}`);
        if (YouthEngine.vorschau(state)) throw new Error("Die Vorschau bleibt nach dem Jugendtag stehen");

        // Der Blick des Nachwuchsleiters: ein guter sieht genau, die Aushilfe nur grob
        const talente = [99, 98, 30].map((pot, i) => ({ id: `t${i}`, name: `Talent ${i}`, pos: ["ST", "ZM", "IV"][i], pot, overall: 40 }));
        club.staff = Object.assign({}, club.staff, { nachwuchs: { name: "Genau", guete: 100 } });
        const genau = YouthEngine.vorschauBericht(state, club, talente);
        if (genau.unsicher || genau.bester.name !== "Talent 0" || genau.urteil !== "golden") throw new Error(`Guter Leiter irrt: ${JSON.stringify(genau)}`);
        delete club.staff.nachwuchs;
        if (!YouthEngine.vorschauBericht(state, club, talente).unsicher) throw new Error("Die Aushilfe ist sich sicher");
        const schwach = YouthEngine.vorschauBericht(state, club, talente.map(t => ({ ...t, pot: 30 })));
        if (schwach.urteil !== "schwach") throw new Error(`Schwacher Jahrgang nicht erkannt: ${schwach.urteil}`);
    });

    test("Datenzentrale: Liga nach xG und xPunkten, Form, Spielerwerte je 90 Minuten, Vergleich nach Scoutwissen", () => {
        const { DatenzentraleEngine: D } = require('./js/engine/datenzentraleEngine.js');
        const { SaveCodec } = require('./js/services/saveCodec.js');
        const state = GameState.createNewGame("muc", "normal", { name: "Trainer" });
        for (let i = 0; i < 6; i++) SeasonEngine.advanceToNextMatchday(state);

        // xPunkte: drei Punkte verteilt, ein klares xG gewinnt meist
        const [h, g] = D.xPunkte(2.5, 0.3);
        if (!(h > 2.2 && g < 0.4) || Math.abs(D.xPunkte(1, 1)[0] - D.xPunkte(1, 1)[1]) > 1e-9) throw new Error(`xPunkte falsch: ${h}, ${g}`);

        // Liga: alle Vereine der eigenen Liga, auch ihre Spiele untereinander (Kennzahlen kz)
        const liga = D.liga(state);
        const vereine = state.clubs.filter(c => c.leagueId === state.clubs.find(x => x.id === "muc").leagueId).length;
        if (liga.length !== vereine || liga.some(z => z.spiele !== 6)) throw new Error(`Liga unvollständig: ${liga.length} von ${vereine}`);
        const gespielt = state.schedule.flatMap(t => t.matches).filter(m => m.played);
        const tore = gespielt.reduce((s2, m) => s2 + m.homeGoals + m.awayGoals, 0);
        if (liga.reduce((s2, z) => s2 + z.tore, 0) !== tore) throw new Error("Tore der Liga stimmen nicht");
        if (liga.some(z => !(z.xg > 0) || z.xPunkte > z.spiele * 3)) throw new Error("xG oder xPunkte fehlen");
        // Die Kennzahlen überstehen Speichern und Laden
        const geladen = SaveCodec.decodeState(SaveCodec.encodeState(state));
        if (D.liga(geladen).length !== vereine) throw new Error("Nach dem Laden fehlen die Kennzahlen");

        // Form: die eigenen Spiele mit Ergebnis und xG
        const form = D.form(state, "muc", 10);
        if (form.length !== 6 || form.some(f => f.ergebnis !== (f.tore[0] > f.tore[1] ? "S" : f.tore[0] === f.tore[1] ? "U" : "N"))) throw new Error("Form falsch");

        // Spieler: Minuten, Tore und xG aus den eigenen Partien
        const sp = D.spieler(state, "muc");
        const eigeneTore = form.reduce((s2, f) => s2 + f.tore[0], 0);
        const spielerTore = sp.reduce((s2, x) => s2 + x.tore, 0);
        if (!sp.length || spielerTore > eigeneTore || spielerTore < eigeneTore - 2) throw new Error(`Tore der Spieler ${spielerTore} statt ${eigeneTore}`);
        const xgTeam = liga.find(z => z.clubId === "muc").xg;
        if (Math.abs(sp.reduce((s2, x) => s2 + x.xg, 0) - xgTeam) > xgTeam * 0.25 + 0.5) throw new Error("xG der Spieler passt nicht zum Team");
        const stamm = sp.find(x => x.minuten >= D.MIN_MINUTEN_JE90);
        if (!stamm || stamm.toreJe90 === null || sp.some(x => x.minuten < D.MIN_MINUTEN_JE90 && x.toreJe90 !== null)) throw new Error("Werte je 90 falsch");

        // Vergleich: eigene Werte genau, fremde mit wenig Scoutwissen als Spanne
        const eigen = state.players.find(p => p.clubId === "muc" && p.pos === "ST");
        const fremd = state.players.find(p => p.clubId === "dor" && p.pos === "ST");
        fremd.scoutingKnowledge = { knowledgeLevel: 10 };
        const v = D.vergleich(state, eigen.id, fremd.id);
        if (!v.a.genau || v.a.werte.pace.exact !== eigen.pace) throw new Error("Eigener Spieler nicht genau");
        if (v.b.genau || v.b.werte.pace.exact !== null || !(v.b.werte.pace.max > v.b.werte.pace.min)) throw new Error("Fremder Spieler verrät seine Werte");
        if (!D.vergleichsKandidaten(state, eigen.id).some(k => k.eigen)) throw new Error("Keine eigenen Kandidaten zum Vergleich");
    });

    console.log(`\n  Ergebnis Engine-Tests: ${passed} bestanden, ${failed} fehlgeschlagen.`);
    if (failed > 0) throw new Error(`${failed} Engine-Tests fehlgeschlagen.`);
    return { passed, failed };
}

if (require.main === module) {
    runEngineTests();
}

module.exports = { runEngineTests };
