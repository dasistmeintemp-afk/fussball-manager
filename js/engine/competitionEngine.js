/**
 * CompetitionEngine - Verwaltet Ligen, Pokalwettbewerbe, Europapokale und Auf-/Abstieg
 */

class CompetitionEngine {
    /**
     * Erzeugt einen Spielplan (Hin- und Rückrunde) für eine beliebige Anzahl an Vereinen
     */
    static generateRoundRobinSchedule(clubIds, leagueId = "de_liga_1") {
        const teams = [...clubIds];
        if (teams.length % 2 !== 0) {
            teams.push(null); // Freilos
        }

        const numTeams = teams.length;
        const numRounds = (numTeams - 1) * 2;
        const matchesPerRound = numTeams / 2;
        const schedule = [];

        for (let round = 0; round < numRounds; round++) {
            const isSecondHalf = round >= (numTeams - 1);
            const roundMatches = [];

            for (let match = 0; match < matchesPerRound; match++) {
                let home = (round + match) % (numTeams - 1);
                let away = (numTeams - 1 - match + round) % (numTeams - 1);

                if (match === 0) {
                    away = numTeams - 1;
                }

                let homeTeam = teams[home];
                let awayTeam = teams[away];

                if (isSecondHalf) {
                    const temp = homeTeam;
                    homeTeam = awayTeam;
                    awayTeam = temp;
                }

                if (homeTeam !== null && awayTeam !== null) {
                    roundMatches.push({
                        id: `m_${leagueId}_r${round + 1}_${match + 1}`,
                        competitionId: leagueId,
                        matchday: round + 1,
                        homeClubId: homeTeam,
                        awayClubId: awayTeam,
                        played: false,
                        homeGoals: null,
                        awayGoals: null,
                        events: [],
                        timeline: [],
                        stats: null,
                        summaryText: ""
                    });
                }
            }

            schedule.push({
                matchday: round + 1,
                competitionId: leagueId,
                completed: false,
                matches: roundMatches
            });
        }

        return schedule;
    }

    /**
     * Erzeugt eine K.O.-Pokalrunde
     */
    static generateCupRound(participants, roundName, cupId = "de_cup", roundNumber = 1) {
        const shuffled = [...participants].sort(() => 0.5 - Math.random());
        const matches = [];

        for (let i = 0; i < shuffled.length; i += 2) {
            if (i + 1 < shuffled.length) {
                matches.push({
                    id: `m_${cupId}_r${roundNumber}_${Math.floor(i / 2) + 1}`,
                    competitionId: cupId,
                    roundName: roundName,
                    roundNumber: roundNumber,
                    homeClubId: shuffled[i],
                    awayClubId: shuffled[i + 1],
                    played: false,
                    homeGoals: null,
                    awayGoals: null,
                    events: [],
                    timeline: [],
                    stats: null,
                    isCup: true,
                    penaltyWinner: null
                });
            }
        }

        return {
            roundName: roundName,
            roundNumber: roundNumber,
            cupId: cupId,
            completed: false,
            matches: matches
        };
    }

    /**
     * Erzeugt europäische Wettbewerbe (Champions League, Europa League, Conference League)
     */
    static generateEuropeanCompetitions(allClubs) {
        // Clubs nach Stärke / Reputation sortieren
        const eligibleClubs = [...allClubs].sort((a, b) => {
            const ovrA = a.players?.length ? a.players.reduce((sum, p) => sum + (p.overall || 0), 0) / a.players.length : 70;
            const ovrB = b.players?.length ? b.players.reduce((sum, p) => sum + (p.overall || 0), 0) / b.players.length : 70;
            return ovrB - ovrA;
        });

        const uclTeams = eligibleClubs.slice(0, 16).map(c => c.id);
        const uelTeams = eligibleClubs.slice(16, 32).map(c => c.id);
        const ueclTeams = eligibleClubs.slice(32, 48).map(c => c.id);

        const createCupStructure = (id, name, teams) => {
            const groups = [];
            for (let g = 0; g < 4; g++) {
                const groupTeams = teams.slice(g * 4, (g + 1) * 4);
                if (groupTeams.length >= 2) {
                    groups.push({
                        groupName: `Gruppe ${String.fromCharCode(65 + g)}`,
                        teams: groupTeams,
                        standings: groupTeams.map(tid => ({
                            clubId: tid,
                            played: 0,
                            won: 0,
                            drawn: 0,
                            lost: 0,
                            goalsFor: 0,
                            goalsAgainst: 0,
                            points: 0
                        }))
                    });
                }
            }

            return {
                id: id,
                name: name,
                type: "continental",
                participants: teams,
                groups: groups,
                currentRound: "Gruppenphase",
                completed: false,
                winnerId: null
            };
        };

        return {
            ucl: createCupStructure("ucl", "Champions League", uclTeams),
            uel: createCupStructure("uel", "Europa League", uelTeams),
            uecl: createCupStructure("uecl", "Conference League", ueclTeams)
        };
    }

    /**
     * Ermittelt die Europapokal-Qualifikanten am Saisonende
     */
    static qualifyEuropeanTeams(state) {
        const standings = state.standings || [];
        const top4 = standings.slice(0, 4).map(s => s.clubId);
        const uel = standings.slice(4, 6).map(s => s.clubId);
        const uecl = standings.slice(6, 7).map(s => s.clubId);

        return {
            championsLeague: top4,
            europaLeague: uel,
            conferenceLeague: uecl
        };
    }

    /**
     * Führt Auf- und Abstieg zwischen Ligen durch
     */
    static processSeasonEndPromotionsRelegations(state) {
        if (!state.leagues || state.leagues.length <= 1) return { promoted: [], relegated: [] };

        const promoted = [];
        const relegated = [];

        // Für verbundene Ligen
        state.leagues.forEach(league => {
            if (league.relegationTo && league.relegationTo.length > 0) {
                const leagueStandings = (state.standingsByLeague && state.standingsByLeague[league.id]) || [];
                if (leagueStandings.length >= 18) {
                    const rel1 = leagueStandings[leagueStandings.length - 1]?.clubId;
                    const rel2 = leagueStandings[leagueStandings.length - 2]?.clubId;
                    if (rel1) relegated.push({ clubId: rel1, fromLeague: league.id, toLeague: league.relegationTo[0] });
                    if (rel2) relegated.push({ clubId: rel2, fromLeague: league.id, toLeague: league.relegationTo[0] });
                }
            }
        });

        return { promoted, relegated };
    }
}

if (typeof window !== "undefined") {
    window.CompetitionEngine = CompetitionEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { CompetitionEngine };
}
