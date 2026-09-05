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

/**
 * Merkt sich die mitgelieferten Standardformationen, damit eigene Formationen
 * jederzeit sauber ergänzt oder wieder entfernt werden können.
 */
const BUILTIN_FORMATION_KEYS = Object.keys(FORMATION_CONFIGS);

class GameState {

    /**
     * Auflösung der PositionEngine in Browser- und Node-Umgebung
     */
    static _getPositionEngine() {
        return GameState._resolveEngine('PositionEngine', './positionEngine.js');
    }

    /**
     * Liefert eine Formationskonfiguration (Standard oder eigene) mit Fallback auf 4-4-2
     */
    static getFormationConfig(formationKey) {
        return FORMATION_CONFIGS[formationKey]
            || FORMATION_CONFIGS["4-4-2"]
            || { name: "4-4-2 Standard", positions: [] };
    }

    /**
     * Prüft, ob eine Formation vom Spieler selbst erstellt wurde
     */
    static isCustomFormation(formationKey) {
        return !BUILTIN_FORMATION_KEYS.includes(formationKey);
    }

    /**
     * Standardformationen (Reihenfolge der Auslieferung)
     */
    static getBuiltinFormationKeys() {
        return [...BUILTIN_FORMATION_KEYS];
    }

    /**
     * Validiert und normalisiert die Positionen einer (eigenen) Formation.
     * Erwartet 11 Slots, exakt einen Torwart und Koordinaten innerhalb des Feldes.
     */
    static normalizeFormationPositions(positions) {
        const posEngine = GameState._getPositionEngine();
        if (!Array.isArray(positions) || positions.length !== 11) {
            return { valid: false, error: "Eine Formation benötigt genau 11 Positionen." };
        }

        const normalized = positions.map((slot, idx) => {
            const x = Math.max(3, Math.min(97, Number(slot?.x)));
            const y = Math.max(3, Math.min(97, Number(slot?.y)));
            if (!isFinite(x) || !isFinite(y)) return null;

            // Die Position folgt der Zone auf dem Feld. Nur wenn sie im Editor
            // ausdrücklich von Hand gesetzt wurde (manualPos), bleibt sie erhalten.
            let pos = slot?.pos;
            if (posEngine) {
                const manual = slot?.manualPos ? posEngine.normalizePosition(pos) : null;
                pos = manual || posEngine.detectPositionFromCoords(x, y);
            }
            pos = pos || "ZM";

            return {
                id: idx,
                pos,
                manualPos: !!slot?.manualPos,
                role: slot?.role || (posEngine?.POSITION_META?.[pos]?.name) || pos,
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10
            };
        });

        if (normalized.some(s => s === null)) {
            return { valid: false, error: "Ungültige Koordinaten in der Formation." };
        }

        const keepers = normalized.filter(s => s.pos === "TW");
        if (keepers.length !== 1) {
            return { valid: false, error: "Eine Formation braucht genau einen Torwart." };
        }

        // Ursprüngliche Reihenfolge merken, damit die Aufstellung mitsortiert
        // werden kann und jeder Spieler auf seinem Platz stehen bleibt
        normalized.forEach((slot, idx) => { slot.sourceIndex = idx; });

        // Torwart immer an Position 0, danach von hinten nach vorne sortieren
        const gk = keepers[0];
        const outfield = normalized
            .filter(s => s !== gk)
            .sort((a, b) => b.y - a.y || a.x - b.x);

        const sorted = [gk, ...outfield];
        const order = sorted.map(s => s.sourceIndex);
        const ordered = sorted.map((slot, idx) => {
            const { sourceIndex, ...rest } = slot;
            return { ...rest, id: idx };
        });

        return { valid: true, positions: ordered, order };
    }

    /**
     * Registriert die eigenen Formationen des Spielstands global,
     * damit alle Engines (Match, KI, Aufstellung) sie kennen.
     */
    static registerCustomFormations(state) {
        // Zuerst alte eigene Einträge entfernen
        Object.keys(FORMATION_CONFIGS).forEach(key => {
            if (!BUILTIN_FORMATION_KEYS.includes(key)) delete FORMATION_CONFIGS[key];
        });

        const custom = state?.customFormations;
        if (!custom || typeof custom !== 'object') return FORMATION_CONFIGS;

        Object.entries(custom).forEach(([key, config]) => {
            if (!config || !Array.isArray(config.positions)) return;
            FORMATION_CONFIGS[key] = {
                name: config.name || key,
                custom: true,
                shape: config.shape || null,
                positions: config.positions
            };
        });

        return FORMATION_CONFIGS;
    }

    /**
     * Speichert eine eigene Formation im Spielstand und registriert sie global
     */
    static saveCustomFormation(state, name, positions, existingKey = null) {
        if (!state) return { success: false, error: "Kein Spielstand geladen." };

        const cleanName = String(name || "").trim();
        if (cleanName.length < 2) {
            return { success: false, error: "Bitte einen Namen mit mindestens 2 Zeichen angeben." };
        }

        const normalized = GameState.normalizeFormationPositions(positions);
        if (!normalized.valid) {
            return { success: false, error: normalized.error };
        }

        if (!state.customFormations) state.customFormations = {};

        const key = existingKey && GameState.isCustomFormation(existingKey)
            ? existingKey
            : `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

        const posEngine = GameState._getPositionEngine();
        const shape = posEngine ? posEngine.detectFormationShape(normalized.positions) : null;

        state.customFormations[key] = {
            key,
            name: cleanName,
            custom: true,
            shape,
            createdAt: new Date().toISOString(),
            positions: normalized.positions
        };

        GameState.registerCustomFormations(state);

        return { success: true, key, shape, name: cleanName, order: normalized.order };
    }

    /**
     * Löscht eine eigene Formation und setzt betroffene Vereine auf 4-4-2 zurück
     */
    static deleteCustomFormation(state, key) {
        if (!state?.customFormations || !state.customFormations[key]) {
            return { success: false, error: "Diese Formation existiert nicht." };
        }

        delete state.customFormations[key];
        delete FORMATION_CONFIGS[key];

        (state.clubs || []).forEach(club => {
            if (club.formation === key) club.formation = "4-4-2";
        });

        GameState.registerCustomFormations(state);
        return { success: true };
    }

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
        // Eigene, im Formations-Editor erstellte Aufstellungen
        this.customFormations = {};
    }

    /**
     * Baut die komplette Fußballwelt auf: die handgepflegten Vereine der
     * ersten Liga plus alle übrigen Ligen aus dem WorldGenerator.
     *
     * Bewusst ohne Bezug zum Nutzerverein - dadurch kann der Assistent die
     * Welt schon vor der Vereinsauswahl erzeugen und alle 218 Vereine aus
     * fünf Ländern zur Auswahl anbieten.
     */
    static buildBaseWorld() {
        const world = { clubs: [], players: [] };

        let playerIdCounter = 1;
        

        // Tiefenkopie der Initialdaten gegen ungewollte Mutation
        const rawTeams = (typeof INITIAL_TEAMS_DATA !== 'undefined' && INITIAL_TEAMS_DATA) 
            ? INITIAL_TEAMS_DATA 
            : ((typeof window !== 'undefined' && window.INITIAL_TEAMS_DATA) ? window.INITIAL_TEAMS_DATA : (typeof require !== 'undefined' ? require('../data/initialData.js').INITIAL_TEAMS_DATA : []));
        const teamsData = JSON.parse(JSON.stringify(rawTeams || []));

        // Clubs klonen und Spieler initialisieren
        const SPONSOR_NAMES = [
            "Deutsche Telekom", "Telekom", "Evonik Industries", "Barmenia Versicherungen", "SAP SE",
            "Volkswagen", "Mercedes-Benz", "Red Bull", "Wiesenhof", "Talanx", "Mainova",
            "Schwarzwaldmilch", "Covestro", "Allianz", "BMW Group", "Puma SE", "Adidas", "Global Tech"
        ];

        teamsData.forEach((clubData, cIdx) => {
            const rep = clubData.reputation || 70;
            const cap = clubData.capacity || 25000;
            
            // C1 · Infrastruktur nach Prestige ableiten (Stufen 1-5)
            let stadiumLvl = 2, trainingLvl = 2, youthLvl = 1, medicalLvl = 1;
            if (rep >= 88 || cap >= 65000) {
                stadiumLvl = 5; trainingLvl = 5; youthLvl = 5; medicalLvl = 5;
            } else if (rep >= 80 || cap >= 45000) {
                stadiumLvl = 4; trainingLvl = 4; youthLvl = 4; medicalLvl = 4;
            } else if (rep >= 72 || cap >= 28000) {
                stadiumLvl = 3; trainingLvl = 3; youthLvl = 3; medicalLvl = 3;
            } else if (rep >= 64 || cap >= 18000) {
                stadiumLvl = 2; trainingLvl = 2; youthLvl = 2; medicalLvl = 2;
            } else {
                stadiumLvl = 1; trainingLvl = 1; youthLvl = 1; medicalLvl = 1;
            }

            const sponsorName = SPONSOR_NAMES[cIdx % SPONSOR_NAMES.length];
            const sponsorAmount = Math.round(rep * 18000 + (stadiumLvl * 50000));

            const club = {
                id: clubData.id,
                name: clubData.name,
                city: clubData.city,
                stadium: clubData.stadium,
                capacity: clubData.capacity,
                ticketPrice: 35, // C4 Managerregler für Ticketpreise
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
                    trainingGround: trainingLvl,
                    youthCenter: youthLvl,
                    medicalCenter: medicalLvl,
                    stadium: stadiumLvl
                },
                youthAcademy: {
                    prospects: [],
                    level: youthLvl
                },
                sponsor: {
                    name: sponsorName,
                    amountPerMatchday: sponsorAmount,
                    yearsRemaining: (cIdx % 3) + 1
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

            // Spieler anlegen
            clubData.players.forEach(pData => {
                // Positionsprofil: hinterlegte Nebenposition oder ein realistisch erzeugtes Profil
                const extraPositions = pData.secondPos
                    ? [pData.secondPos]
                    : (GameState._getPositionEngine()?.generateSecondaryPositions(pData.pos) || []);

                const player = {
                    id: playerIdCounter++,
                    clubId: club.id,
                    name: pData.name,
                    age: pData.age,
                    nationality: "Deutschland",
                    pos: pData.pos,
                    secondPos: pData.secondPos || extraPositions[0] || null,
                    positions: extraPositions,
                    overall: pData.overall,
                    pot: pData.pot,
                    trueCurrentAbility: (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine.overallToAbility(pData.overall) : (pData.overall * 2),
                    truePotentialAbility: (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine.overallToAbility(pData.pot) : (pData.pot * 2),
                    trueMarketValue: pData.value,
                    scoutingKnowledge: {
                        known: false,
                        knowledgeLevel: 25,
                        accuracy: 25,
                        lastScoutedDate: null
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

                world.players.push(player);
                club.playerIds.push(player.id);
            });

            // Automatische Erst-Aufstellung
            GameState.autoSetLineupForClub(club, world.players);

            world.clubs.push(club);
        });

        const worldGen = GameState._getWorldGenerator();
        if (worldGen) {
            worldGen.tagExistingClubs(world.clubs, "de_liga_1");
            worldGen.generateWorld(world);
        }

        return world;
    }

    /** Auflösung des WorldGenerators in Browser- und Node-Umgebung */
    static _getWorldGenerator() {
        return GameState._resolveEngine("WorldGenerator", "./worldGenerator.js");
    }

    /**
     * Liefert eine vorbereitete Welt. Der Assistent nutzt sie für die
     * Vereinsauswahl, createNewGame übernimmt anschließend genau dieselbe
     * Welt - der ausgewählte Verein hat also exakt den gezeigten Kader.
     */
    static getPreparedWorld(regenerate = false) {
        if (regenerate || !GameState._preparedWorld) {
            GameState._preparedWorld = GameState.buildBaseWorld();
        }
        return GameState._preparedWorld;
    }

    /** Vereine für die Auswahl im Assistenten, angereichert um Ligainfos */
    static getSelectableClubs() {
        const world = GameState.getPreparedWorld();
        const leagues = (typeof LEAGUES_DATA !== "undefined" && LEAGUES_DATA)
            ? LEAGUES_DATA
            : ((typeof window !== "undefined" && window.LEAGUES_DATA) ? window.LEAGUES_DATA
                : (typeof require !== "undefined" ? require("../data/leagueData.js").LEAGUES_DATA : []));

        return world.clubs.map(club => {
            const squad = world.players.filter(p => p.clubId === club.id);
            const league = leagues.find(l => l.id === club.leagueId);
            const avg = squad.length
                ? Math.round(squad.reduce((sum, p) => sum + (p.overall || 0), 0) / squad.length)
                : 0;

            return {
                id: club.id,
                name: club.name,
                city: club.city,
                stadium: club.stadium,
                capacity: club.capacity || club.stadiumCapacity || 0,
                reputation: club.reputation || 50,
                transferBudget: club.transferBudget || 0,
                wageBudget: club.wageBudget || 0,
                boardExpectation: club.boardExpectation,
                primaryColor: club.primaryColor,
                secondaryColor: club.secondaryColor,
                leagueId: club.leagueId,
                leagueName: league ? league.shortName || league.name : "",
                countryId: club.countryId || "de",
                level: club.level || 1,
                avgOverall: avg,
                squadSize: squad.length,
                // Schlanke Kaderliste für die Detailansicht im Assistenten
                players: squad.map(p => ({
                    name: p.name,
                    pos: p.pos,
                    age: p.age,
                    overall: p.overall,
                    pot: p.pot,
                    value: p.value
                }))
            };
        });
    }

    /**
     * Erstellt ein neues Spiel basierend auf den Daten
     */
    static createNewGame(userClubId, difficulty = "normal", managerProfile = {}) {
        const state = new GameState();
        // Eventuell noch registrierte Formationen eines vorherigen Spielstands entfernen
        GameState.registerCustomFormations(state);
        state.userClubId = userClubId;
        state.difficulty = difficulty;
        state.managerName = managerProfile.name || (typeof managerProfile === "string" ? managerProfile : "Trainer");
        state.managerNationality = managerProfile.nationality || "Deutschland";
        state.managerBirthdate = managerProfile.birthdate || "1985-05-15";
        state.lastSaved = new Date().toISOString();
        state.createdAt = new Date().toISOString();

        // Welt übernehmen (vom Assistenten bereits erzeugt oder jetzt gebaut)
        const world = GameState.getPreparedWorld();
        GameState._preparedWorld = null;
        state.clubs = world.clubs;
        state.players = world.players;

        const userClub = state.clubs.find(c => c.id === userClubId) || state.clubs[0];
        if (userClub) {
            state.userClubId = userClub.id;
            userClubId = userClub.id;

            // Budgetanpassung je nach Schwierigkeitsgrad für den Nutzerverein
            if (difficulty === "easy") {
                userClub.transferBudget = Math.round(userClub.transferBudget * 1.35);
                userClub.wageBudget = Math.round(userClub.wageBudget * 1.25);
                userClub.balance = Math.round(userClub.balance * 1.3);
            } else if (difficulty === "hard") {
                userClub.transferBudget = Math.round(userClub.transferBudget * 0.75);
                userClub.wageBudget = Math.round(userClub.wageBudget * 0.85);
                userClub.balance = Math.round(userClub.balance * 0.8);
            }

            // Den eigenen Kader kennt der Manager vollständig
            state.players.forEach(p => {
                if (p.clubId !== userClub.id || !p.scoutingKnowledge) return;
                p.scoutingKnowledge.known = true;
                p.scoutingKnowledge.knowledgeLevel = 90;
                p.scoutingKnowledge.accuracy = 90;
                p.scoutingKnowledge.lastScoutedDate = "Saisonstart";
            });
        }

        // Spielpläne für alle Ligen (Round Robin Hin- und Rückrunde).
        // Der Spielplan der eigenen Liga liegt in state.schedule, die
        // übrigen elf Ligen in state.otherSchedules.
        state.userLeagueId = userClub?.leagueId || "de_liga_1";
        const worldGenForSchedule = GameState._getWorldGenerator();
        if (worldGenForSchedule) {
            worldGenForSchedule.generateAllSchedules(state, state.userLeagueId);
        } else {
            state.schedule = GameState.generateSchedule(state.clubs);
            state.totalMatchdays = state.schedule.length;
        }

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
        const userLeagueClubs = state.clubs.filter(c => c.leagueId === state.userLeagueId);
        state.standings = GameState.calculateStandings(
            userLeagueClubs.length > 1 ? userLeagueClubs : state.clubs,
            state.schedule,
            1
        );

        // Multi-League, Pokale & europäische Wettbewerbe anlegen
        const leagueData = GameState._resolveLeagueData('LEAGUES_DATA');
        const countryData = GameState._resolveLeagueData('COUNTRIES_DATA');
        const compData = GameState._resolveLeagueData('COMPETITIONS_DATA');
        const compEngine = GameState._resolveEngine('CompetitionEngine', './competitionEngine.js');

        state.countries = countryData;
        state.leagues = leagueData;
        state.competitions = compData;
        state.activeCompetitionId = state.userLeagueId;
        state.standingsByLeague = state.standingsByLeague || {};
        state.standingsByLeague[state.userLeagueId] = state.standings;

        const userLeague = leagueData.find(l => l.id === state.userLeagueId);
        state.leagueName = userLeague ? (userLeague.shortName || userLeague.name) : "Liga";

        if (compEngine) {
            state.europeanCompetitions = compEngine.generateEuropeanCompetitions(state.clubs);

            // Der nationale Pokal des eigenen Landes: alle Vereine des Landes
            const cupCountry = userClub?.countryId || "de";
            const cupId = `${cupCountry}_cup`;
            const cupClubIds = state.clubs.filter(c => (c.countryId || "de") === cupCountry).map(c => c.id);
            state.cups = {};
            state.cups[cupId] = compEngine.generateCupRound(cupClubIds, "Runde 1", cupId, 1);
        }

        // Jugendspieler für Userclub erzeugen
        const youthEngine = (typeof YouthEngine !== 'undefined' && YouthEngine) 
            ? YouthEngine 
            : ((typeof window !== 'undefined' && window.YouthEngine) ? window.YouthEngine : (typeof require !== 'undefined' ? require('./youthEngine.js').YouthEngine : null));
        if (youthEngine && typeof youthEngine.generateProspects === 'function') {
            youthEngine.generateProspects(state, userClubId);
        }

        // Willkommensnachrichten
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
     * Stellt die stärkste 11 und Bank für einen Verein auf.
     * Die Zuordnung erfolgt positionsbewusst: Ein Spieler wird dort eingeplant,
     * wo seine effektive Bewertung (Stärke x Positionseignung) am höchsten ist.
     */
    static autoSetLineupForClub(club, allPlayers) {
        const clubPlayers = allPlayers.filter(p => club.playerIds.includes(p.id) && p.injuredWeeks === 0 && p.suspendedMatches === 0);

        // Nach Gesamtstärke absteigend sortieren (Basisreihenfolge für Bank & Fallbacks)
        clubPlayers.sort((a, b) => b.overall - a.overall);

        const formationConfig = GameState.getFormationConfig(club.formation);
        const neededSlots = formationConfig.positions;
        const assignedPlayerIds = [];
        const lineup = [];

        const posEngine = GameState._getPositionEngine();

        if (posEngine && typeof posEngine.assignBestLineup === "function") {
            const assigned = posEngine.assignBestLineup(clubPlayers, neededSlots);
            assigned.forEach(player => {
                if (player && !assignedPlayerIds.includes(player.id)) {
                    assignedPlayerIds.push(player.id);
                    lineup.push(player.id);
                }
            });
        } else {
            // Fallback ohne PositionEngine
            neededSlots.forEach(slot => {
                let candidate = clubPlayers.find(p => !assignedPlayerIds.includes(p.id) && (p.pos === slot.pos || p.secondPos === slot.pos));
                if (!candidate) {
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
        }

        // Bank (bis zu 7 Spieler) - Ersatztorwart hat Vorrang
        const bench = [];
        const remaining = clubPlayers.filter(p => !assignedPlayerIds.includes(p.id));
        const backupGk = remaining.find(p => p.pos === "TW");
        if (backupGk) {
            assignedPlayerIds.push(backupGk.id);
            bench.push(backupGk.id);
        }
        remaining.forEach(p => {
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
    /**
     * Auflösung der Ligadaten. Prüft Modulscope, window und require der Reihe
     * nach - ein leeres window.LEAGUES_DATA darf die require-Auflösung nicht
     * abschneiden (das passiert in den Node-Tests mit window-Attrappe).
     */
    static _resolveLeagueData(name) {
        return GameState._resolveEngine(name, '../data/leagueData.js') || [];
    }

    /** Alle Vereine einer Liga */
    static getLeagueClubs(state, leagueId) {
        if (!state || !Array.isArray(state.clubs)) return [];
        const target = leagueId || GameState.getUserLeagueId(state);
        const clubs = state.clubs.filter(c => c.leagueId === target);
        return clubs.length > 1 ? clubs : state.clubs;
    }

    /** Liga des Nutzervereins */
    static getUserLeagueId(state) {
        if (!state) return "de_liga_1";
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        return club?.leagueId || state.userLeagueId || "de_liga_1";
    }

    /** Spielplan einer beliebigen Liga (eigene Liga liegt in state.schedule) */
    static getScheduleForLeague(state, leagueId) {
        if (!state) return [];
        if (!leagueId || leagueId === GameState.getUserLeagueId(state)) return state.schedule || [];
        return (state.otherSchedules && state.otherSchedules[leagueId]) || [];
    }

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
            const codec = GameState._getSaveCodec();
            const payload = codec ? codec.encodeState(this) : this;
            localStorage.setItem(slotKey, JSON.stringify(payload));
            return true;
        } catch (e) {
            console.error("Speichern fehlgeschlagen:", e);
            return false;
        }
    }

    /**
     * Auflösung einer Engine. Prüft Modulscope, window und require der Reihe
     * nach, damit eine window-Attrappe ohne das gesuchte Modul die
     * require-Auflösung nicht abschneidet.
     */
    static _resolveEngine(name, path) {
        if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
        if (typeof window !== "undefined" && window[name]) return window[name];
        if (typeof require !== "undefined") {
            try {
                const mod = require(path);
                if (mod && mod[name]) return mod[name];
            } catch (e) { /* im Browser nicht vorhanden */ }
        }
        return null;
    }

    /** Auflösung des SaveCodec in Browser- und Node-Umgebung */
    static _getSaveCodec() {
        return GameState._resolveEngine("SaveCodec", "../services/saveCodec.js");
    }

    /**
     * Liest einen Spielstand aus dem LocalStorage und faltet das kompakte
     * Speicherformat wieder auf.
     */
    static _readStoredState(slotKey) {
        const raw = localStorage.getItem(slotKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        const codec = GameState._getSaveCodec();
        return (codec && codec.isEncoded(parsed)) ? codec.decodeState(parsed) : parsed;
    }

    /**
     * Gibt Metadaten über den Spielstand zurück (ohne den gesamten Spielstand zu laden)
     */
    static getSaveSummary(slotKey = "football_manager_savegame") {
        try {
            const parsed = GameState._readStoredState(slotKey);
            if (!parsed || !parsed.userClubId || !parsed.clubs) return null;
            const userClub = parsed.clubs.find(c => c.id === parsed.userClubId);
            const leagueClubs = parsed.clubs.filter(c => c.leagueId === userClub?.leagueId);
            const standings = GameState.calculateStandings(
                leagueClubs.length > 1 ? leagueClubs : parsed.clubs,
                parsed.schedule,
                parsed.currentMatchday - 1
            );
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
            const parsed = GameState._readStoredState(slotKey);
            if (!parsed) return null;
            const state = Object.assign(new GameState(), parsed);
            // Eigene Formationen des Spielstands wieder global bekannt machen
            GameState.registerCustomFormations(state);
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
