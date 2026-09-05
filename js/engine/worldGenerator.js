/**
 * WorldGenerator - Baut die komplette Fußballwelt auf
 *
 * Aus den Ligadefinitionen entsteht eine Welt mit den fünf großen
 * europäischen Erstligen und der deutschen Pyramide hinunter bis zur
 * Landesliga. Jeder Verein bekommt einen eigenen Kader, dessen Stärke sich
 * nach Ligastufe und Ruf des Vereins richtet: Ein Landesligist spielt mit
 * Spielern um 20 Gesamtstärke, ein Bundesliga-Spitzenklub um 80.
 */

const _wgResolve = (globalName, path, exportName) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[exportName || globalName]; } catch (e) { return null; }
    }
    return null;
};

class WorldGenerator {
    /** Kadergröße nach Ligastufe - Amateure haben kleinere Kader */
    static SQUAD_SIZES = { 1: 22, 2: 21, 3: 20, 4: 19, 5: 18, 6: 18, 7: 18 };

    static getLeagues() {
        return _wgResolve("LEAGUES_DATA", "../data/leagueData.js", "LEAGUES_DATA") || [];
    }

    static getCountries() {
        return _wgResolve("COUNTRIES_DATA", "../data/leagueData.js", "COUNTRIES_DATA") || [];
    }

    static getClubGenerator() {
        return _wgResolve("ClubGenerator", "./clubGenerator.js", "ClubGenerator");
    }

    static getPlayerGenerator() {
        return _wgResolve("PlayerGenerator", "./playerGenerator.js", "PlayerGenerator");
    }

    static getGameState() {
        return _wgResolve("GameState", "./gameState.js", "GameState");
    }

    /**
     * Ordnet den bereits vorhandenen (handgepflegten) Vereinen ihre Liga zu
     * und leitet aus ihrem Ruf eine Stärkeposition innerhalb der Liga ab.
     */
    static tagExistingClubs(clubs, leagueId = "de_liga_1") {
        const league = this.getLeagues().find(l => l.id === leagueId);
        const country = this.getCountries().find(c => c.id === (league?.countryId || "de"));
        if (!clubs || clubs.length === 0) return clubs;

        const reputations = clubs.map(c => c.reputation || 60);
        const minRep = Math.min(...reputations);
        const maxRep = Math.max(...reputations);
        const span = Math.max(1, maxRep - minRep);

        clubs.forEach(club => {
            club.leagueId = club.leagueId || leagueId;
            club.level = club.level || league?.level || 1;
            club.countryId = club.countryId || league?.countryId || "de";
            club.tier = club.tier || (club.level <= 3 ? "professional" : club.level <= 4 ? "semi-pro" : "amateur");
            club.clubStrength = ((club.reputation || 60) - minRep) / span;
            if (club.stadiumCapacity === undefined) club.stadiumCapacity = club.capacity || 30000;
        });

        if (country && league) league.countryReputation = country.reputation;
        return clubs;
    }

    /**
     * Erzeugt alle fehlenden Vereine samt Kadern.
     *
     * @param {Object} state Spielstand mit clubs[] und players[]
     * @param {Object} options { skipLeagueIds: [] } - Ligen, die bereits gefüllt sind
     */
    static generateWorld(state, options = {}) {
        const leagues = this.getLeagues();
        const countries = this.getCountries();
        const clubGen = this.getClubGenerator();
        const playerGen = this.getPlayerGenerator();

        if (!clubGen || !playerGen || leagues.length === 0) {
            return { clubsCreated: 0, playersCreated: 0 };
        }

        if (!Array.isArray(state.clubs)) state.clubs = [];
        if (!Array.isArray(state.players)) state.players = [];

        const usedNames = new Set(state.clubs.map(c => c.name));
        const usedCities = new Set(state.clubs.map(c => c.city).filter(Boolean));

        let clubsCreated = 0;
        let playersCreated = 0;

        leagues.forEach(league => {
            const existing = state.clubs.filter(c => c.leagueId === league.id);
            const missing = (league.teamCount || 18) - existing.length;
            const country = countries.find(c => c.id === league.countryId);

            if (missing <= 0) return;

            const newClubs = clubGen.generateClubsForLeague(league, missing, {
                usedNames,
                usedCities,
                startIndex: existing.length,
                countryReputation: country ? country.reputation : 88
            });

            newClubs.forEach((club, idx) => {
                // Stärkeposition innerhalb der Liga für den Kaderaufbau merken
                const total = league.teamCount || 18;
                const rank = existing.length + idx;
                club.clubStrength = total > 1 ? Math.max(0, Math.min(1, 1 - rank / (total - 1))) : 0.5;

                const squad = playerGen.generateSquad(
                    club.id,
                    league.level || 1,
                    this.SQUAD_SIZES[league.level] || 18,
                    { clubStrength: club.clubStrength, countryId: league.countryId || "de" }
                );

                squad.forEach(player => {
                    state.players.push(player);
                    club.playerIds.push(player.id);
                });
                playersCreated += squad.length;

                const gameState = this.getGameState();
                if (gameState && typeof gameState.autoSetLineupForClub === "function") {
                    gameState.autoSetLineupForClub(club, state.players);
                }

                state.clubs.push(club);
                clubsCreated++;
            });
        });

        return { clubsCreated, playersCreated };
    }

    /**
     * Erzeugt für jede Liga einen eigenen Spielplan.
     * Der Spielplan der Nutzerliga bleibt in state.schedule, alle anderen
     * landen in state.otherSchedules.
     */
    static generateAllSchedules(state, userLeagueId) {
        const leagues = this.getLeagues();
        const gameState = this.getGameState();
        if (!gameState) return;

        state.otherSchedules = {};
        state.standingsByLeague = state.standingsByLeague || {};

        leagues.forEach(league => {
            const clubs = state.clubs.filter(c => c.leagueId === league.id);
            if (clubs.length < 2) return;

            const schedule = gameState.generateSchedule(clubs);
            schedule.forEach(round => round.matches.forEach(m => { m.leagueId = league.id; }));

            if (league.id === userLeagueId) {
                state.schedule = schedule;
                state.totalMatchdays = schedule.length;
            } else {
                state.otherSchedules[league.id] = schedule;
            }

            state.standingsByLeague[league.id] = gameState.calculateStandings(clubs, schedule, 0);
        });
    }

    /** Liefert den Spielplan einer beliebigen Liga */
    static getSchedule(state, leagueId) {
        if (!state) return [];
        const userLeagueId = this.getUserLeagueId(state);
        if (leagueId === userLeagueId) return state.schedule || [];
        return (state.otherSchedules && state.otherSchedules[leagueId]) || [];
    }

    static getUserLeagueId(state) {
        if (!state) return "de_liga_1";
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        return club?.leagueId || state.userLeagueId || "de_liga_1";
    }
}

if (typeof window !== "undefined") {
    window.WorldGenerator = WorldGenerator;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { WorldGenerator };
}
