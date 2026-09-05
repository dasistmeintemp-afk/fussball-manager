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
    /**
     * Setzt die drei europäischen Wettbewerbe aus den echten Qualifikanten
     * der fünf Topligen zusammen.
     *
     * Grundlage sind die europeanSpots der Ligadefinition: Deutschland und
     * Frankreich stellen weniger Startplätze als England, Spanien und Italien.
     * Liegt bereits eine Abschlusstabelle vor, entscheidet die Platzierung;
     * zum Start einer Karriere wird nach dem Ruf der Vereine gesetzt.
     */
    static generateEuropeanCompetitions(allClubs, options = {}) {
        const leagues = options.leagues || CompetitionEngine._resolveLeagues();
        const standingsByLeague = options.standingsByLeague || {};

        const qualified = { ucl: [], uel: [], uecl: [] };
        const reserves = [];
        const taken = new Set();

        const topLeagues = leagues.filter(l => (l.level || 1) === 1 && l.europeanSpots);

        topLeagues.forEach(league => {
            const leagueClubs = allClubs.filter(c => c.leagueId === league.id);
            if (leagueClubs.length === 0) return;

            // Rangfolge: echte Tabelle, sonst nach Ruf
            const table = standingsByLeague[league.id];
            let ranked;
            if (Array.isArray(table) && table.length > 0) {
                ranked = table.map(entry => leagueClubs.find(c => c.id === entry.clubId)).filter(Boolean);
            } else {
                ranked = [...leagueClubs].sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
            }

            const spots = league.europeanSpots;
            const assign = (positions, bucket) => {
                (positions || []).forEach(pos => {
                    const club = ranked[pos - 1];
                    if (club && !taken.has(club.id)) {
                        qualified[bucket].push(club.id);
                        taken.add(club.id);
                    }
                });
            };

            assign(spots.championsLeague, "ucl");
            assign(spots.europaLeague, "uel");
            assign(spots.conferenceLeague, "uecl");

            // Die nächstbesten Vereine rücken bei Bedarf nach
            ranked.forEach(club => {
                if (!taken.has(club.id)) reserves.push(club);
            });
        });

        // Fallback für Spielstände ohne Ligazuordnung
        if (qualified.ucl.length === 0) {
            const byReputation = [...allClubs].sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
            qualified.ucl = byReputation.slice(0, 16).map(c => c.id);
            qualified.uel = byReputation.slice(16, 32).map(c => c.id);
            qualified.uecl = byReputation.slice(32, 48).map(c => c.id);
        }

        reserves.sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
        const fillTo = (bucket, target) => {
            while (qualified[bucket].length < target && reserves.length > 0) {
                const club = reserves.shift();
                qualified[bucket].push(club.id);
                taken.add(club.id);
            }
            // Auf ein Vielfaches von vier kürzen, damit die Gruppen aufgehen
            const groups = Math.floor(qualified[bucket].length / 4);
            qualified[bucket] = qualified[bucket].slice(0, groups * 4);
        };

        fillTo("ucl", 20);
        fillTo("uel", 16);
        fillTo("uecl", 16);

        return {
            ucl: CompetitionEngine.createEuropeanCup("ucl", "Champions League", qualified.ucl),
            uel: CompetitionEngine.createEuropeanCup("uel", "Europa League", qualified.uel),
            uecl: CompetitionEngine.createEuropeanCup("uecl", "Conference League", qualified.uecl)
        };
    }

    /** Baut Gruppenphase und Grundgerüst eines europäischen Wettbewerbs */
    static createEuropeanCup(id, name, teams) {
        const groups = [];
        const groupCount = Math.floor(teams.length / 4);

        for (let g = 0; g < groupCount; g++) {
            const groupTeams = teams.slice(g * 4, (g + 1) * 4);
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
    }

    /** Auflösung der Ligadefinitionen in Browser- und Node-Umgebung */
    static _resolveLeagues() {
        if (typeof LEAGUES_DATA !== "undefined" && LEAGUES_DATA) return LEAGUES_DATA;
        if (typeof window !== "undefined" && window.LEAGUES_DATA) return window.LEAGUES_DATA;
        if (typeof require !== "undefined") {
            try { return require("../data/leagueData.js").LEAGUES_DATA; } catch (e) { return []; }
        }
        return [];
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
     * Führt Auf- und Abstieg zwischen allen verbundenen Ligen durch.
     *
     * Für jede Liga wird gezählt, wie viele Vereine von unten aufsteigen -
     * genauso viele steigen aus ihr ab. Dadurch behalten alle Ligen ihre
     * Mannschaftszahl, auch wenn mehrere Staffeln in dieselbe Liga aufsteigen
     * (etwa die beiden Regionalligen in die 3. Liga).
     */
    static processSeasonEndPromotionsRelegations(state) {
        if (!state.leagues || state.leagues.length <= 1) return { promoted: [], relegated: [] };

        const promoted = [];
        const relegated = [];
        const standingsByLeague = state.standingsByLeague || {};
        const clubById = new Map((state.clubs || []).map(c => [c.id, c]));

        // Aufsteiger nach Zielliga gruppieren
        const risingByParent = new Map();

        state.leagues.forEach(child => {
            if (!child.promotionTo) return;
            const table = standingsByLeague[child.id];
            if (!Array.isArray(table) || table.length === 0) return;

            const spots = (child.promotionSpots && child.promotionSpots.length) ? child.promotionSpots : [1];
            spots.forEach(pos => {
                const entry = table[pos - 1];
                if (!entry) return;
                if (!risingByParent.has(child.promotionTo)) risingByParent.set(child.promotionTo, []);
                risingByParent.get(child.promotionTo).push({ clubId: entry.clubId, fromLeague: child.id });
            });
        });

        risingByParent.forEach((risers, parentId) => {
            const parent = state.leagues.find(l => l.id === parentId);
            if (!parent) return;

            const parentTable = standingsByLeague[parentId];
            const dropCount = Math.min(risers.length, Array.isArray(parentTable) ? parentTable.length - 1 : 0);
            if (dropCount <= 0) return;

            const droppers = parentTable.slice(parentTable.length - dropCount);

            // Absteiger landen in der Staffel, aus der ihr Gegenpart aufsteigt
            droppers.forEach((entry, idx) => {
                const targetLeagueId = risers[idx].fromLeague;
                const club = clubById.get(entry.clubId);
                if (!club) return;
                CompetitionEngine.moveClubToLeague(club, state.leagues.find(l => l.id === targetLeagueId));
                relegated.push({ clubId: club.id, fromLeague: parentId, toLeague: targetLeagueId });
            });

            risers.slice(0, dropCount).forEach(riser => {
                const club = clubById.get(riser.clubId);
                if (!club) return;
                CompetitionEngine.moveClubToLeague(club, parent);
                promoted.push({ clubId: club.id, fromLeague: riser.fromLeague, toLeague: parentId });
            });
        });

        return { promoted, relegated };
    }

    /**
     * Verschiebt einen Verein in eine andere Liga und passt Ruf und Etat an.
     * Der Kader bleibt unverändert - ein Aufsteiger startet also bewusst als
     * Außenseiter in der höheren Liga.
     */
    static moveClubToLeague(club, league) {
        if (!club || !league) return;

        const oldLevel = club.level || 1;
        const newLevel = league.level || 1;
        const step = oldLevel - newLevel; // positiv = Aufstieg

        club.leagueId = league.id;
        club.level = newLevel;
        club.countryId = league.countryId || club.countryId || "de";
        club.tier = newLevel <= 3 ? "professional" : newLevel <= 4 ? "semi-pro" : "amateur";
        club.reputation = Math.max(1, Math.min(99, Math.round((club.reputation || 40) + step * 6)));
        club.boardExpectation = step > 0 ? "avoid_relegation" : "promotion";

        const budgetFactor = step > 0 ? 2.2 : 0.5;
        club.transferBudget = Math.round((club.transferBudget || 0) * budgetFactor);
        club.wageBudget = Math.round((club.wageBudget || 0) * budgetFactor);
    }
}

if (typeof window !== "undefined") {
    window.CompetitionEngine = CompetitionEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { CompetitionEngine };
}
