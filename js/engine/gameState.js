/**
 * GameState - Zentrales State Management, Spielstand-Verwaltung und Liga-Generierung
 */

let FORMATION_CONFIGS = {
    "4-4-2": {
        name: "4-4-2 Standard",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 4, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 5, pos: "LM", role: "Linkes Mittelfeld", x: 15, y: 45 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld", x: 38, y: 48 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld", x: 62, y: 48 },
            { id: 8, pos: "RM", role: "Rechtes Mittelfeld", x: 85, y: 45 },
            { id: 9, pos: "ST", role: "Stürmer links", x: 38, y: 20 },
            { id: 10, pos: "ST", role: "Stürmer rechts", x: 62, y: 20 }
        ]
    },
    "4-3-3": {
        name: "4-3-3 Offensiv",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 4, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 5, pos: "DM", role: "Defensives Mittelfeld", x: 50, y: 55 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld links", x: 32, y: 42 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 68, y: 42 },
            { id: 8, pos: "LA", role: "Linksaußen", x: 18, y: 22 },
            { id: 9, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 },
            { id: 10, pos: "RA", role: "Rechtsaußen", x: 82, y: 22 }
        ]
    },
    "4-2-3-1": {
        name: "4-2-3-1 Ausgewogen",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 4, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 5, pos: "DM", role: "Defensives Mittelfeld", x: 38, y: 56 },
            { id: 6, pos: "DM", role: "Defensives Mittelfeld", x: 62, y: 56 },
            { id: 7, pos: "LM", role: "Linkes Mittelfeld / Flügel", x: 20, y: 36 },
            { id: 8, pos: "OM", role: "Offensives Mittelfeld", x: 50, y: 34 },
            { id: 9, pos: "RM", role: "Rechtes Mittelfeld / Flügel", x: 80, y: 36 },
            { id: 10, pos: "ST", role: "Stoßstürmer", x: 50, y: 18 }
        ]
    },
    "3-5-2": {
        name: "3-5-2 Kompakt",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "IV", role: "Innenverteidiger links", x: 26, y: 75 },
            { id: 2, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 77 },
            { id: 3, pos: "IV", role: "Innenverteidiger rechts", x: 74, y: 75 },
            { id: 4, pos: "LM", role: "Schienenspieler links", x: 12, y: 48 },
            { id: 5, pos: "DM", role: "Defensives Mittelfeld", x: 50, y: 58 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld", x: 34, y: 42 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld", x: 66, y: 42 },
            { id: 8, pos: "RM", role: "Schienenspieler rechts", x: 88, y: 48 },
            { id: 9, pos: "ST", role: "Stürmer links", x: 38, y: 20 },
            { id: 10, pos: "ST", role: "Stürmer rechts", x: 62, y: 20 }
        ]
    },
    "5-3-2": {
        name: "5-3-2 Defensiv",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "LV", role: "Außenverteidiger links", x: 12, y: 70 },
            { id: 2, pos: "IV", role: "Innenverteidiger links", x: 32, y: 76 },
            { id: 3, pos: "IV", role: "Innenverteidiger zentral", x: 50, y: 78 },
            { id: 4, pos: "IV", role: "Innenverteidiger rechts", x: 68, y: 76 },
            { id: 5, pos: "RV", role: "Außenverteidiger rechts", x: 88, y: 70 },
            { id: 6, pos: "DM", role: "Defensives Mittelfeld", x: 50, y: 54 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld links", x: 32, y: 44 },
            { id: 8, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 68, y: 44 },
            { id: 9, pos: "ST", role: "Konterstürmer links", x: 38, y: 20 },
            { id: 10, pos: "ST", role: "Konterstürmer rechts", x: 62, y: 20 }
        ]
    },
    "4-1-4-1": {
        name: "4-1-4-1 Mittelfelddominanz",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 4, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 5, pos: "DM", role: "Sechser / Regisseur", x: 50, y: 58 },
            { id: 6, pos: "LM", role: "Linkes Mittelfeld", x: 16, y: 40 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld", x: 38, y: 38 },
            { id: 8, pos: "ZM", role: "Zentrales Mittelfeld", x: 62, y: 38 },
            { id: 9, pos: "RM", role: "Rechtes Mittelfeld", x: 84, y: 40 },
            { id: 10, pos: "ST", role: "Solospitze", x: 50, y: 18 }
        ]
    },
    "4-3-1-2": {
        name: "4-3-1-2 Raute",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 4, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 5, pos: "DM", role: "Defensives Mittelfeld", x: 50, y: 58 },
            { id: 6, pos: "ZM", role: "Halbposition links", x: 30, y: 46 },
            { id: 7, pos: "ZM", role: "Halbposition rechts", x: 70, y: 46 },
            { id: 8, pos: "OM", role: "Zehner / Spielmacher", x: 50, y: 34 },
            { id: 9, pos: "ST", role: "Stürmer links", x: 38, y: 19 },
            { id: 10, pos: "ST", role: "Stürmer rechts", x: 62, y: 19 }
        ]
    }
};

class GameState {
    constructor() {
        this.saveId = "save_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
        this.version = "0.2.0";
        this.schemaVersion = 2;
        this.createdAt = new Date().toISOString();
        this.lastSaved = new Date().toISOString();
        this.userClubId = null;
        this.managerName = "Trainer";
        this.managerNationality = "Deutschland";
        this.managerBirthdate = "1985-05-15";
        this.difficulty = "normal"; // easy, normal, hard
        this.leagueName = "Deutschland Liga 1";
        this.seasonYear = 1;
        this.currentMatchday = 1;
        this.totalMatchdays = 34; // 18 Vereine = 34 Spieltage
        this.boardConfidence = 75; // 0 - 100%
        this.clubs = [];
        this.players = [];
        this.schedule = []; // Matchdays array
        this.standings = [];
        this.inbox = [];
        this.transferMarket = {
            listedPlayerIds: [],
            offers: [], // { id, playerId, fromClubId, toClubId, fee, wage, contractYears, status: 'pending'|'accepted'|'rejected' }
            history: [],
            shortlist: []
        };
        this.trainingSettings = {
            focus: "allround", // fitness, attack, defense, technique, tactics, regeneration, youth
            intensity: "normal" // low, normal, high
        };
        this.scouting = {
            assignments: [],
            reports: [],
            shortlist: []
        };
        this.youthAcademy = {
            prospects: [],
            level: 1
        };
        this.finances = {
            transactions: []
        };
        this.history = {
            pastSeasons: [],
            matchReports: {} // matchId -> report
        };
        this.settings = {
            soundEnabled: true,
            autosaveEnabled: true
        };
    }

    /**
     * Erstellt ein neues Spiel basierend auf den Daten
     */
    static createNewGame(userClubId, difficulty = "normal", managerProfile = {}) {
        const state = new GameState();
        state.userClubId = userClubId;
        state.difficulty = difficulty;
        state.managerName = managerProfile.name || (typeof managerProfile === "string" ? managerProfile : "Trainer");
        state.managerNationality = managerProfile.nationality || "Deutschland";
        state.managerBirthdate = managerProfile.birthdate || "1985-05-15";
        state.lastSaved = new Date().toISOString();
        state.createdAt = new Date().toISOString();

        let playerIdCounter = 1;
        state.clubs = [];
        state.players = [];

        // Tiefenkopie der Initialdaten gegen ungewollte Mutation
        const rawTeams = (typeof INITIAL_TEAMS_DATA !== 'undefined' && INITIAL_TEAMS_DATA) 
            ? INITIAL_TEAMS_DATA 
            : ((typeof window !== 'undefined' && window.INITIAL_TEAMS_DATA) ? window.INITIAL_TEAMS_DATA : (typeof require !== 'undefined' ? require('../data/initialData.js').INITIAL_TEAMS_DATA : []));
        const teamsData = JSON.parse(JSON.stringify(rawTeams || []));

        // Clubs klonen und Spieler initialisieren
        teamsData.forEach(clubData => {
            const club = {
                id: clubData.id,
                name: clubData.name,
                city: clubData.city,
                stadium: clubData.stadium,
                capacity: clubData.capacity,
                balance: clubData.balance,
                transferBudget: clubData.transferBudget,
                wageBudget: clubData.wageBudget,
                reputation: clubData.reputation,
                fanBase: clubData.fanBase,
                boardExpectation: clubData.boardExpectation,
                primaryColor: clubData.primaryColor,
                secondaryColor: clubData.secondaryColor,
                confidence: 75,
                facilities: {
                    trainingGround: 2,
                    youthCenter: 1,
                    medicalCenter: 1,
                    stadium: 2
                },
                sponsor: {
                    name: "Global Tech",
                    amountPerMatchday: Math.round((clubData.reputation || 70) * 15000),
                    yearsRemaining: 2
                },
                chemistry: {
                    overall: 75,
                    tacticalFamiliarity: 70,
                    dressingRoom: 75
                },
                playerIds: [],
                lineup: [], // 11 Player IDs
                bench: [],  // up to 7 Player IDs
                formation: "4-4-2",
                tactics: {
                    mentality: "balanced", // very_defensive, defensive, balanced, offensive, very_offensive
                    pressing: "medium",    // low, medium, high
                    tempo: "normal",       // slow, normal, fast
                    passing: "mixed",      // short, mixed, direct
                    focus: "balanced",     // left, center, right, balanced
                    defensiveLine: "medium", // deep, medium, high
                    risk: "normal"         // cautious, normal, bold
                },
                roles: {
                    captain: null,
                    penaltyTaker: null,
                    freeKickTaker: null,
                    cornerTaker: null
                },
                trainingFocus: "allround",
                form: ["-", "-", "-", "-", "-"] // Letzte 5 Spiele: W, D, L
            };

            // Budgetanpassung je nach Schwierigkeitsgrad für User-Club
            if (club.id === userClubId) {
                if (difficulty === "easy") {
                    club.transferBudget = Math.round(club.transferBudget * 1.35);
                    club.wageBudget = Math.round(club.wageBudget * 1.25);
                    club.balance = Math.round(club.balance * 1.3);
                } else if (difficulty === "hard") {
                    club.transferBudget = Math.round(club.transferBudget * 0.75);
                    club.wageBudget = Math.round(club.wageBudget * 0.85);
                    club.balance = Math.round(club.balance * 0.8);
                }
            }

            // Spieler anlegen
            clubData.players.forEach(pData => {
                const player = {
                    id: playerIdCounter++,
                    clubId: club.id,
                    name: pData.name,
                    age: pData.age,
                    nationality: "Deutschland",
                    pos: pData.pos,
                    secondPos: pData.secondPos || null,
                    overall: pData.overall,
                    pot: pData.pot,
                    trueCurrentAbility: (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine.overallToAbility(pData.overall) : (pData.overall * 2),
                    truePotentialAbility: (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine.overallToAbility(pData.pot) : (pData.pot * 2),
                    trueMarketValue: pData.value,
                    scoutingKnowledge: {
                        known: club.id === userClubId,
                        knowledgeLevel: club.id === userClubId ? 90 : 25,
                        accuracy: club.id === userClubId ? 90 : 25,
                        lastScoutedDate: club.id === userClubId ? "Saisonstart" : null
                    },
                    hiddenAttributes: (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine.generateHiddenAttributes(pData) : {
                        professionalism: 12, ambition: 12, consistency: 12, importantMatches: 12, injuryProneness: 10, adaptability: 12, loyalty: 12, temperament: 12
                    },
                    value: pData.value,
                    wage: pData.wage,
                    contractYears: Math.floor(Math.random() * 3) + 2, // 2-4 Jahre
                    fitness: 100,
                    morale: 80 + Math.floor(Math.random() * 15),
                    form: 7.0,
                    injured: false,
                    injuredWeeks: 0,
                    injuryWeeks: 0,
                    injuryName: null,
                    suspended: false,
                    suspendedMatches: 0,
                    yellowCards: 0,
                    yellowCardsTotal: 0,
                    squadRole: pData.overall >= 84 ? "Schlüsselspieler" : pData.overall >= 78 ? "Stammspieler" : "Rotationsspieler",
                    happiness: {
                        overall: 75,
                        playingTime: 75,
                        contract: 75,
                        teamPerformance: 75,
                        training: 75,
                        reason: "Zufrieden mit der aktuellen Situation."
                    },
                    stats: {
                        matches: 0,
                        goals: 0,
                        assists: 0,
                        yellowCards: 0,
                        redCards: 0,
                        minutes: 0,
                        ratingSum: 0,
                        cleanSheets: 0
                    },
                    // Attribute
                    reflexes: pData.reflexes || 30,
                    handling: pData.handling || 30,
                    oneOnOne: pData.oneOnOne || 30,
                    positioning: pData.positioning || 30,
                    kicking: pData.kicking || 30,
                    pace: pData.pace || 70,
                    shooting: pData.shooting || 65,
                    passing: pData.passing || 70,
                    dribbling: pData.dribbling || 70,
                    defense: pData.defense || 60,
                    physical: pData.physical || 70,
                    stamina: pData.stamina || 75,
                    vision: pData.vision || 70,
                    technique: pData.technique || 70
                };

                state.players.push(player);
                club.playerIds.push(player.id);
            });

            // Automatische Erst-Aufstellung
            GameState.autoSetLineupForClub(club, state.players);

            state.clubs.push(club);
        });

        // Spielplan generieren (Round Robin Hin- und Rückrunde)
        state.schedule = GameState.generateSchedule(state.clubs);
        state.totalMatchdays = state.schedule.length;

        // Kalender erzeugen
        const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine) 
            ? CalendarEngine 
            : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : (typeof require !== 'undefined' ? require('./calendarEngine.js').CalendarEngine : null));
        if (calendarEngine && typeof calendarEngine.generateSeasonCalendar === 'function') {
            calendarEngine.generateSeasonCalendar(state);
        } else {
            state.currentDate = "01.08.2026";
            state.currentDayIndex = 0;
            state.calendar = [];
        }

        // Immersion & Stimmung
        state.fanMood = 75;
        state.mediaPressure = 45;

        // Tabelle initialisieren
        state.standings = GameState.calculateStandings(state.clubs, state.schedule, 1);

        // Multi-League, Pokale & europäische Wettbewerbe anlegen
        const leagueData = typeof LEAGUES_DATA !== 'undefined' ? LEAGUES_DATA : (typeof window !== 'undefined' ? window.LEAGUES_DATA : (typeof require !== 'undefined' ? require('../data/leagueData.js').LEAGUES_DATA : []));
        const countryData = typeof COUNTRIES_DATA !== 'undefined' ? COUNTRIES_DATA : (typeof window !== 'undefined' ? window.COUNTRIES_DATA : (typeof require !== 'undefined' ? require('../data/leagueData.js').COUNTRIES_DATA : []));
        const compData = typeof COMPETITIONS_DATA !== 'undefined' ? COMPETITIONS_DATA : (typeof window !== 'undefined' ? window.COMPETITIONS_DATA : (typeof require !== 'undefined' ? require('../data/leagueData.js').COMPETITIONS_DATA : []));
        const compEngine = typeof CompetitionEngine !== 'undefined' ? CompetitionEngine : (typeof window !== 'undefined' ? window.CompetitionEngine : (typeof require !== 'undefined' ? require('./competitionEngine.js').CompetitionEngine : null));

        state.countries = countryData;
        state.leagues = leagueData;
        state.competitions = compData;
        state.activeCompetitionId = "de_liga_1";
        state.standingsByLeague = {
            "de_liga_1": state.standings
        };

        if (compEngine) {
            state.europeanCompetitions = compEngine.generateEuropeanCompetitions(state.clubs);
            state.cups = {
                de_cup: compEngine.generateCupRound(state.clubs.map(c => c.id), "Runde 1", "de_cup", 1)
            };
        }

        // Jugendspieler für Userclub erzeugen
        const youthEngine = (typeof YouthEngine !== 'undefined' && YouthEngine) 
            ? YouthEngine 
            : ((typeof window !== 'undefined' && window.YouthEngine) ? window.YouthEngine : (typeof require !== 'undefined' ? require('./youthEngine.js').YouthEngine : null));
        if (youthEngine && typeof youthEngine.generateProspects === 'function') {
            youthEngine.generateProspects(state, userClubId);
        }

        // Willkommensnachrichten
        const userClub = state.clubs.find(c => c.id === userClubId);
        state.inbox.push({
            id: "msg_welcome",
            matchday: 1,
            date: "Saisonstart",
            sender: "Vorstand " + userClub.name,
            title: "Herzlich willkommen als neuer Manager!",
            subject: "Herzlich willkommen als neuer Manager!",
            text: `Herzlich willkommen beim ${userClub.name}, Trainer ${state.managerName}!\n\nDer Vorstand und die Fans setzen großes Vertrauen in Ihre Arbeit. Unser Saisonziel für diese Spielzeit lautet: ${GameState.getExpectationText(userClub.boardExpectation)}.\n\nIhr aktuelles Transferbudget beträgt ${GameState.formatMoney(userClub.transferBudget)}. Wir wünschen Ihnen viel Erfolg für die kommende Saison!`,
            body: `Herzlich willkommen beim ${userClub.name}, Trainer ${state.managerName}!\n\nDer Vorstand und die Fans setzen großes Vertrauen in Ihre Arbeit. Unser Saisonziel für diese Spielzeit lautet: ${GameState.getExpectationText(userClub.boardExpectation)}.\n\nIhr aktuelles Transferbudget beträgt ${GameState.formatMoney(userClub.transferBudget)}. Wir wünschen Ihnen viel Erfolg für die kommende Saison!`,
            read: false,
            priority: "high",
            type: "welcome"
        });

        return state;
    }

    /**
     * Stellt die stärkste 11 und Bank für einen Verein auf
     */
    static autoSetLineupForClub(club, allPlayers) {
        const clubPlayers = allPlayers.filter(p => club.playerIds.includes(p.id) && p.injuredWeeks === 0 && p.suspendedMatches === 0);
        
        // Nach Gesamtstärke absteigend sortieren
        clubPlayers.sort((a, b) => b.overall - a.overall);

        const formationConfig = FORMATION_CONFIGS[club.formation] || FORMATION_CONFIGS["4-4-2"];
        const neededSlots = formationConfig.positions;
        const assignedPlayerIds = [];
        const lineup = [];

        // Finde für jede Position den besten passenden Spieler
        neededSlots.forEach(slot => {
            let candidate = clubPlayers.find(p => !assignedPlayerIds.includes(p.id) && (p.pos === slot.pos || p.secondPos === slot.pos));
            if (!candidate) {
                // Fallback: TW für TW, Feldspieler für Feldspieler
                if (slot.pos === "TW") {
                    candidate = clubPlayers.find(p => !assignedPlayerIds.includes(p.id) && p.pos === "TW");
                } else {
                    candidate = clubPlayers.find(p => !assignedPlayerIds.includes(p.id) && p.pos !== "TW");
                }
            }
            if (!candidate) {
                candidate = clubPlayers.find(p => !assignedPlayerIds.includes(p.id));
            }
            if (candidate) {
                assignedPlayerIds.push(candidate.id);
                lineup.push(candidate.id);
            }
        });

        // Bank (bis zu 7 Spieler)
        const bench = [];
        clubPlayers.forEach(p => {
            if (!assignedPlayerIds.includes(p.id) && bench.length < 7) {
                assignedPlayerIds.push(p.id);
                bench.push(p.id);
            }
        });

        club.lineup = lineup;
        club.bench = bench;

        // Rollen setzen falls nicht belegt
        if (lineup.length > 0) {
            club.roles.captain = club.roles.captain || lineup[0];
            
            // Beste Schützen ermitteln
            const shooters = lineup.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
            shooters.sort((a, b) => b.shooting - a.shooting);
            club.roles.penaltyTaker = shooters[0]?.id || lineup[0];

            const passers = [...shooters].sort((a, b) => b.passing - a.passing);
            club.roles.freeKickTaker = passers[0]?.id || lineup[0];
            club.roles.cornerTaker = passers[1]?.id || passers[0]?.id || lineup[0];
        }
    }

    /**
     * Generiert einen kompletten Hin- und Rückrunden-Spielplan nach Berger-System
     */
    static generateSchedule(clubs) {
        let teamIds = clubs.map(c => c.id);
        const isOdd = teamIds.length % 2 !== 0;
        if (isOdd) {
            teamIds.push("BYE");
        }
        const numTeams = teamIds.length;
        const rounds = [];
        const halfSeasonRounds = numTeams - 1;
        const matchesPerRound = numTeams / 2;

        const teams = [...teamIds];

        // Hinrunde (halfSeasonRounds Spieltage)
        for (let round = 0; round < halfSeasonRounds; round++) {
            const roundMatches = [];
            for (let match = 0; match < matchesPerRound; match++) {
                const home = teams[match];
                const away = teams[numTeams - 1 - match];

                if (home !== "BYE" && away !== "BYE") {
                    // Wechselweises Heimrecht zur Balance
                    if (round % 2 === 1 && match === 0) {
                        roundMatches.push({ homeClubId: away, awayClubId: home, played: false, homeGoals: null, awayGoals: null, events: [] });
                    } else {
                        roundMatches.push({ homeClubId: home, awayClubId: away, played: false, homeGoals: null, awayGoals: null, events: [] });
                    }
                }
            }
            rounds.push({ matchday: round + 1, matches: roundMatches });

            // Rotation für Round-Robin (erstes Team fixieren)
            const fixed = teams[0];
            const rest = teams.slice(1);
            rest.unshift(rest.pop());
            teams.splice(0, teams.length, fixed, ...rest);
        }

        // Rückrunde (gespiegelte Heim-/Auswärtsspiele)
        for (let round = 0; round < halfSeasonRounds; round++) {
            const roundMatches = rounds[round].matches.map(m => ({
                homeClubId: m.awayClubId,
                awayClubId: m.homeClubId,
                played: false,
                homeGoals: null,
                awayGoals: null,
                events: []
            }));
            rounds.push({ matchday: halfSeasonRounds + round + 1, matches: roundMatches });
        }

        return rounds;
    }

    /**
     * Berechnet die Ligatabelle
     */
    static calculateStandings(clubs, schedule, upToMatchday = 999) {
        const table = clubs.map(club => ({
            clubId: club.id,
            clubName: club.name,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
            points: 0,
            form: [...club.form]
        }));

        schedule.forEach(round => {
            if (round.matchday <= upToMatchday) {
                round.matches.forEach(m => {
                    if (m.played && m.homeGoals !== null && m.awayGoals !== null) {
                        const homeEntry = table.find(t => t.clubId === m.homeClubId);
                        const awayEntry = table.find(t => t.clubId === m.awayClubId);

                        if (homeEntry && awayEntry) {
                            homeEntry.played++;
                            awayEntry.played++;
                            homeEntry.goalsFor += m.homeGoals;
                            homeEntry.goalsAgainst += m.awayGoals;
                            awayEntry.goalsFor += m.awayGoals;
                            awayEntry.goalsAgainst += m.homeGoals;

                            if (m.homeGoals > m.awayGoals) {
                                homeEntry.won++;
                                homeEntry.points += 3;
                                awayEntry.lost++;
                            } else if (m.homeGoals < m.awayGoals) {
                                awayEntry.won++;
                                awayEntry.points += 3;
                                homeEntry.lost++;
                            } else {
                                homeEntry.drawn++;
                                homeEntry.points += 1;
                                awayEntry.drawn++;
                                awayEntry.points += 1;
                            }

                            homeEntry.goalDiff = homeEntry.goalsFor - homeEntry.goalsAgainst;
                            awayEntry.goalDiff = awayEntry.goalsFor - awayEntry.goalsAgainst;
                        }
                    }
                });
            }
        });

        // Sortierung: Punkte -> Tordifferenz -> Tore -> Name
        table.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            return a.clubName.localeCompare(b.clubName);
        });

        return table;
    }

    /**
     * Hilfsfunktion zur Formatierung von Geldbeträgen
     */
    static formatMoney(amount) {
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(2).replace(".", ",") + " Mio. €";
        }
        if (amount >= 1000) {
            return (amount / 1000).toFixed(0) + " Tsd. €";
        }
        return amount + " €";
    }

    /**
     * Erwartungstext für den Vorstand
     */
    static getExpectationText(exp) {
        switch(exp) {
            case "championship": return "Gewinn der Meisterschaft";
            case "top3": return "Qualifikation für die Top 3";
            case "midfield": return "Gesichertes oberes Tabellenmittelfeld";
            case "avoid_relegation": return "Klassenerhalt";
            default: return "Erfolgreiche Saison";
        }
    }

    /**
     * Speichern in LocalStorage
     */
    saveToLocalStorage(slotKey = "football_manager_savegame") {
        try {
            this.lastSaved = new Date().toISOString();
            const serialized = JSON.stringify(this);
            localStorage.setItem(slotKey, serialized);
            return true;
        } catch (e) {
            console.error("Speichern fehlgeschlagen:", e);
            return false;
        }
    }

    /**
     * Gibt Metadaten über den Spielstand zurück (ohne den gesamten Spielstand zu laden)
     */
    static getSaveSummary(slotKey = "football_manager_savegame") {
        try {
            const raw = localStorage.getItem(slotKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed.userClubId || !parsed.clubs) return null;
            const userClub = parsed.clubs.find(c => c.id === parsed.userClubId);
            const standings = GameState.calculateStandings(parsed.clubs, parsed.schedule, parsed.currentMatchday - 1);
            const userRank = standings.findIndex(s => s.clubId === parsed.userClubId) + 1;

            return {
                saveId: parsed.saveId || "save_legacy",
                managerName: parsed.managerName || "Trainer",
                managerNationality: parsed.managerNationality || "Deutschland",
                clubId: parsed.userClubId,
                clubName: userClub ? userClub.name : "Unbekannt",
                leagueName: parsed.leagueName || "Deutschland Liga 1",
                seasonYear: parsed.seasonYear || 1,
                currentMatchday: parsed.currentMatchday || 1,
                totalMatchdays: parsed.totalMatchdays || (parsed.schedule ? parsed.schedule.length : 34),
                userRank: userRank > 0 ? userRank : 1,
                lastSaved: parsed.lastSaved || new Date().toISOString(),
                difficulty: parsed.difficulty || "normal",
                balance: userClub ? userClub.balance : 0
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * Lädt aus LocalStorage
     */
    static loadFromLocalStorage(slotKey = "football_manager_savegame") {
        try {
            const raw = localStorage.getItem(slotKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const state = Object.assign(new GameState(), parsed);
            return state;
        } catch (e) {
            console.error("Laden fehlgeschlagen:", e);
            return null;
        }
    }

    /**
     * Löscht den Spielstand aus LocalStorage
     */
    static deleteSavegame(slotKey = "football_manager_savegame") {
        try {
            localStorage.removeItem(slotKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Generiert einen sauberen Dateinamen für den Export
     */
    getExportFileName() {
        const clubClean = (this.clubs.find(c => c.id === this.userClubId)?.name || "club").toLowerCase().replace(/[^a-z0-9]/g, "-");
        return `fm-save-${clubClean}-saison-${this.seasonYear}-spieltag-${this.currentMatchday}.json`;
    }

    /**
     * Exportieren als JSON String
     */
    exportToJson() {
        this.lastSaved = new Date().toISOString();
        return JSON.stringify(this, null, 2);
    }

    /**
     * Importieren aus JSON String mit robuster Validierung
     */
    static importFromJson(jsonString) {
        try {
            if (!jsonString || typeof jsonString !== "string") {
                throw new Error("Leere oder ungültige Datei");
            }
            const parsed = JSON.parse(jsonString);
            if (!parsed.clubs || !Array.isArray(parsed.clubs) || parsed.clubs.length === 0) {
                throw new Error("Fehlende Vereinsdaten im Spielstand.");
            }
            if (!parsed.players || !Array.isArray(parsed.players) || parsed.players.length === 0) {
                throw new Error("Fehlende Spielerdaten im Spielstand.");
            }
            if (!parsed.schedule || !Array.isArray(parsed.schedule)) {
                throw new Error("Fehlender Spielplan im Spielstand.");
            }
            if (!parsed.userClubId) {
                throw new Error("Kein ausgewählter Benutzer-Verein im Spielstand vorhanden.");
            }

            const state = Object.assign(new GameState(), parsed);
            return { success: true, state };
        } catch (e) {
            console.error("Import fehlgeschlagen:", e);
            return { success: false, error: e.message || "Ungültiges Format" };
        }
    }
}

if (typeof window !== "undefined") {
    window.GameState = GameState;
    window.FORMATION_CONFIGS = FORMATION_CONFIGS;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState, FORMATION_CONFIGS };
}
