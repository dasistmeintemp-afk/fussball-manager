/**
 * MigrationService - Gewährleistet Abwärtskompatibilität und migriert alte Spielstände
 */

const MigrationService = {
    CURRENT_SAVE_VERSION: 5,

    /**
     * Migriert einen Spielstand auf die aktuelle Version
     */
    migrateSave(saveObj) {
        if (!saveObj || typeof saveObj !== 'object') {
            return { success: false, error: "Ungültiges Savegame-Objekt." };
        }

        let state = saveObj.state || saveObj;
        const currentVersion = saveObj.saveVersion || state.schemaVersion || 1;

        // Migration Version 1 -> Version 2: Ergänzen von Scouting, Jugend, Historie, Fazilitäten, Zufriedenheit
        if (currentVersion < 2) {
            console.log(`[MigrationService] Migriere Spielstand von Version ${currentVersion} auf Version 2...`);

            if (!state.inbox) state.inbox = [];
            if (!state.transferMarket) state.transferMarket = { offers: [], history: [], shortlist: [] };
            if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
            if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
            if (!state.finances) state.finances = { transactions: [] };
            if (!state.history) state.history = { seasons: [], champions: [], records: [] };
            if (!state.settings) state.settings = { soundEnabled: true, autosaveEnabled: true };

            // Clubs mit Fazilitäten, Sponsoren und Chemie ergänzen falls fehlend
            if (Array.isArray(state.clubs)) {
                state.clubs.forEach(club => {
                    if (!club.facilities) {
                        club.facilities = {
                            trainingGround: 2,
                            youthCenter: 1,
                            medicalCenter: 1,
                            stadium: 2
                        };
                    } else {
                        // Vereinheitlichung von alten *Level-Schlüsseln
                        if (club.facilities.trainingGroundLevel !== undefined) {
                            club.facilities.trainingGround = club.facilities.trainingGroundLevel;
                            delete club.facilities.trainingGroundLevel;
                        }
                        if (club.facilities.youthAcademyLevel !== undefined) {
                            club.facilities.youthCenter = club.facilities.youthAcademyLevel;
                            delete club.facilities.youthAcademyLevel;
                        }
                        if (club.facilities.medicalCenterLevel !== undefined) {
                            club.facilities.medicalCenter = club.facilities.medicalCenterLevel;
                            delete club.facilities.medicalCenterLevel;
                        }
                        if (club.facilities.stadiumLevel !== undefined) {
                            club.facilities.stadium = club.facilities.stadiumLevel;
                            delete club.facilities.stadiumLevel;
                        }
                    }
                    if (club.ticketPrice === undefined) {
                        club.ticketPrice = 35;
                    }
                    if (!club.youthAcademy) {
                        club.youthAcademy = {
                            prospects: [],
                            level: club.facilities.youthCenter || 1
                        };
                    }
                    if (!club.sponsor) {
                        club.sponsor = {
                            name: "Global Tech",
                            amountPerMatchday: Math.round((club.reputation || 70) * 15000),
                            yearsRemaining: 2
                        };
                    }
                    if (!club.chemistry) {
                        club.chemistry = {
                            overall: 75,
                            tacticalFamiliarity: 70,
                            dressingRoom: 75
                        };
                    }
                });
            }

            // Spieler mit Zufriedenheit und erweiterten Attributen ergänzen
            if (Array.isArray(state.players)) {
                state.players.forEach(p => {
                    if (!p.happiness) {
                        p.happiness = {
                            overall: 75,
                            playingTime: 75,
                            contract: 75,
                            teamPerformance: 75,
                            training: 75,
                            reason: "Zufrieden mit der aktuellen Situation."
                        };
                    }
                    if (p.contractYears === undefined) p.contractYears = 3;
                    if (p.form === undefined) p.form = 7;
                    if (p.morale === undefined) p.morale = 80;
                    if (p.fitness === undefined) p.fitness = 100;
                    if (p.injured === undefined) p.injured = false;
                    if (p.injuryWeeks === undefined) p.injuryWeeks = 0;
                    if (p.suspended === undefined) p.suspended = false;
                    if (p.yellowCards === undefined) p.yellowCards = 0;
                    if (p.stats === undefined) p.stats = { appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, avgRating: 0.0 };
                });
            }

            state.schemaVersion = 2;
        }

        // Migration Version 2 -> Version 3: Ergänzen von Kalender, Tagesablauf, Fanstimmung, Mediendruck und normalisiertem Postfach
        if (currentVersion < 3 || !state.calendar || !state.currentDate) {
            console.log(`[MigrationService] Migriere Spielstand auf Version 3 (Kalender & Postfach)...`);
            
            if (!state.currentDate) state.currentDate = "01.08.2026";
            if (state.currentDayIndex === undefined) state.currentDayIndex = 0;
            if (state.fanMood === undefined) state.fanMood = 75;
            if (state.mediaPressure === undefined) state.mediaPressure = 50;

            const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine) 
                ? CalendarEngine 
                : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : (typeof require !== 'undefined' ? require('../engine/calendarEngine.js').CalendarEngine : null));

            if (!Array.isArray(state.calendar) || state.calendar.length === 0) {
                if (calendarEngine && typeof calendarEngine.generateSeasonCalendar === 'function') {
                    calendarEngine.generateSeasonCalendar(state);
                }
            }

            const newsEngine = (typeof NewsEngine !== 'undefined' && NewsEngine) 
                ? NewsEngine 
                : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : (typeof require !== 'undefined' ? require('../engine/newsEngine.js').NewsEngine : null));

            if (newsEngine && typeof newsEngine.normalizeAllMessages === 'function') {
                newsEngine.normalizeAllMessages(state);
            }

            state.schemaVersion = 3;
        }

        // Migration Version 3 -> Version 4: FM-Rating-Modell (trueCurrentAbility, truePotentialAbility, hiddenAttributes, scoutingKnowledge)
        if (currentVersion < 4 || (Array.isArray(state.players) && state.players.length > 0 && state.players[0].trueCurrentAbility === undefined)) {
            console.log(`[MigrationService] Migriere Spielstand auf Version 4 (FM-Rating & Scouting-Knowledge)...`);
            
            const ratingEngine = (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) 
                ? PlayerRatingEngine 
                : ((typeof window !== 'undefined' && window.PlayerRatingEngine) ? window.PlayerRatingEngine : (typeof require !== 'undefined' ? require('../engine/playerRatingEngine.js').PlayerRatingEngine : null));

            if (Array.isArray(state.players)) {
                state.players.forEach(p => {
                    const isUser = p.clubId === state.userClubId;
                    if (p.trueCurrentAbility === undefined) {
                        p.trueCurrentAbility = ratingEngine ? ratingEngine.overallToAbility(p.overall) : (p.overall * 2);
                    }
                    if (p.truePotentialAbility === undefined) {
                        p.truePotentialAbility = ratingEngine ? ratingEngine.overallToAbility(p.pot) : (p.pot * 2);
                    }
                    if (p.trueMarketValue === undefined) {
                        p.trueMarketValue = p.value || 1000000;
                    }
                    if (!p.hiddenAttributes) {
                        p.hiddenAttributes = ratingEngine ? ratingEngine.generateHiddenAttributes(p) : {
                            professionalism: 12, ambition: 12, consistency: 12, importantMatches: 12, injuryProneness: 10, adaptability: 12, loyalty: 12, temperament: 12
                        };
                    }
                    if (!p.scoutingKnowledge) {
                        p.scoutingKnowledge = {
                            known: isUser,
                            knowledgeLevel: isUser ? 90 : 25,
                            accuracy: isUser ? 90 : 25,
                            lastScoutedDate: isUser ? "Saisonstart" : null
                        };
                    }
                });
            }

            state.schemaVersion = 4;
        }

        // Migration Version 4 -> Version 5: Multi-League & Europapokal-Wettbewerbe
        if (currentVersion < 5 || !state.competitions || !state.leagues) {
            console.log(`[MigrationService] Migriere Spielstand auf Version 5 (Multi-League & Wettbewerbe)...`);

            const leagueData = typeof LEAGUES_DATA !== 'undefined' ? LEAGUES_DATA : (typeof require !== 'undefined' ? require('../data/leagueData.js').LEAGUES_DATA : []);
            const countryData = typeof COUNTRIES_DATA !== 'undefined' ? COUNTRIES_DATA : (typeof require !== 'undefined' ? require('../data/leagueData.js').COUNTRIES_DATA : []);
            const compData = typeof COMPETITIONS_DATA !== 'undefined' ? COMPETITIONS_DATA : (typeof require !== 'undefined' ? require('../data/leagueData.js').COMPETITIONS_DATA : []);

            if (!state.countries) state.countries = countryData;
            if (!state.leagues) state.leagues = leagueData;
            if (!state.competitions) state.competitions = compData;
            if (!state.activeCompetitionId) state.activeCompetitionId = "de_liga_1";

            const compEngine = typeof CompetitionEngine !== 'undefined' ? CompetitionEngine : (typeof require !== 'undefined' ? require('../engine/competitionEngine.js').CompetitionEngine : null);
            if (compEngine && !state.europeanCompetitions && Array.isArray(state.clubs)) {
                state.europeanCompetitions = compEngine.generateEuropeanCompetitions(state.clubs);
            }
            if (compEngine && !state.cups && Array.isArray(state.clubs)) {
                state.cups = {
                    de_cup: compEngine.generateCupRound(state.clubs.map(c => c.id), "Runde 1", "de_cup", 1)
                };
            }

            state.schemaVersion = 5;
        }

        return {
            success: true,
            saveVersion: MigrationService.CURRENT_SAVE_VERSION,
            state: state
        };
    }
};

if (typeof window !== "undefined") {
    window.MigrationService = MigrationService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MigrationService };
}
