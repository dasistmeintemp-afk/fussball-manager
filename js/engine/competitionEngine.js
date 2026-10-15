/**
 * CompetitionEngine - Verwaltet Ligen, Pokalwettbewerbe, Europapokale und Auf-/Abstieg
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _compResolve = (globalName, path) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[globalName]; } catch (e) { return null; }
    }
    return null;
};

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
     * der europäischen Erstligen zusammen.
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
        // Nachrücker je Land in Tabellenfolge
        const reserves = {};
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

            // Die Fünfjahreswertung (KoeffizientEngine) vergibt die Plätze je
            // Land neu; ohne sie gelten die Ligadaten
            const spots = (options.spotsByCountry && options.spotsByCountry[league.countryId]) || league.europeanSpots;
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

            // Der Pokalsieger spielt Europa League. Steht er schon in einem
            // Europapokal, bekommt der nächstplatzierte Verein der Liga den
            // Platz - so wie in allen fünf Ländern.
            // Die Länder im Hintergrund haben ihre Startplätze ohne den
            // Pokalsieger geeicht (Fünfjahreswertung) - ihr Pokal bleibt
            // ohne Europapokalplatz.
            const pokalsieger = !league.hintergrund && options.pokalsieger && options.pokalsieger[league.countryId];
            if (pokalsieger) {
                const sieger = allClubs.find(c => c.id === pokalsieger);
                const club = sieger && !taken.has(sieger.id) ? sieger : ranked.find(c => !taken.has(c.id));
                if (club) {
                    qualified.uel.push(club.id);
                    taken.add(club.id);
                }
            }

            // Conference League: die nächstbesten der Tabelle, so viele wie
            // das Land Plätze hat
            ranked.filter(c => !taken.has(c.id)).slice(0, (spots.conferenceLeague || []).length).forEach(club => {
                qualified.uecl.push(club.id);
                taken.add(club.id);
            });

            // Die nächstbesten Vereine rücken bei Bedarf nach
            reserves[league.countryId] = ranked.filter(club => !taken.has(club.id));
        });

        // Fallback für Spielstände ohne Ligazuordnung
        if (qualified.ucl.length === 0) {
            const byReputation = [...allClubs].sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
            qualified.ucl = byReputation.slice(0, 16).map(c => c.id);
            qualified.uel = byReputation.slice(16, 32).map(c => c.id);
            qualified.uecl = byReputation.slice(32, 48).map(c => c.id);
        }

        // Freie Plätze gehen reihum an die Länder, in der Reihenfolge der
        // Fünfjahreswertung, jeweils an den nächstplatzierten Verein. Vorher
        // rückten die Vereine mit dem größten Ruf aus allen Ligen nach - und
        // weil deutsche Mittelfeldvereine im Datensatz viel Ruf haben, stellte
        // Deutschland bis zu acht schwache Vereine in der Conference League.
        // Die drückten den Länderschnitt, und Deutschland fiel in der
        // Fünfjahreswertung dauerhaft auf den letzten Platz.
        // Ohne Wertung (erste Saison) gilt die Reihenfolge der echten
        // Fünfjahreswertung, wie sie auch die KoeffizientEngine vorbelegt
        const spots = options.spotsByCountry || {};
        const vorgabe = ["en", "it", "es", "de", "fr", "nl", "pt", "be", "tr", "at", "ch", "sc"];
        const rang = (l) => spots[l]?.rang || (vorgabe.indexOf(l) + 1) || 99;
        const laender = Object.keys(reserves).sort((a, b) => rang(a) - rang(b));
        let reihum = 0;
        const naechster = () => {
            for (let k = 0; k < laender.length; k++) {
                const land = laender[(reihum + k) % laender.length];
                const club = reserves[land].find(c => !taken.has(c.id));
                if (club) { reihum = (reihum + k + 1) % laender.length; return club; }
            }
            return null;
        };
        const fillTo = (bucket, target) => {
            while (qualified[bucket].length < target) {
                const club = naechster();
                if (!club) break;
                qualified[bucket].push(club.id);
                taken.add(club.id);
            }
            // Auf ein Vielfaches von vier kürzen, damit die Gruppen aufgehen
            const groups = Math.floor(qualified[bucket].length / 4);
            qualified[bucket] = qualified[bucket].slice(0, groups * 4);
        };

        // Mit den kleineren Ländern acht Gruppen in der Königsklasse, sechs in
        // den beiden anderen Wettbewerben - eine Welt nur aus den großen fünf
        // füllt wie bisher fünf und vier
        const breit = Object.keys(reserves).length > 5;
        fillTo("ucl", breit ? 32 : 20);
        fillTo("uel", breit ? 24 : 16);
        fillTo("uecl", breit ? 24 : 16);

        const lose = (ids) => CompetitionEngine.loseGruppen(ids, allClubs);
        return {
            ucl: CompetitionEngine.createEuropeanCup("ucl", CompetitionEngine.wettbewerbName("ucl"), lose(qualified.ucl)),
            uel: CompetitionEngine.createEuropeanCup("uel", CompetitionEngine.wettbewerbName("uel"), lose(qualified.uel)),
            uecl: CompetitionEngine.createEuropeanCup("uecl", CompetitionEngine.wettbewerbName("uecl"), lose(qualified.uecl))
        };
    }

    /**
     * Gruppenauslosung mit Töpfen und Länderschutz.
     *
     * Vorher wurden die Gruppen der Reihe nach aus der Teilnehmerliste
     * geschnitten - und die war nach Ländern sortiert. In der Königsklasse
     * spielten vier deutsche Vereine in Gruppe A, vier englische in Gruppe B.
     * Die Punkte blieben im Land, und die Fünfjahreswertung maß kaum, wie
     * stark ein Land ist.
     *
     * Jetzt wie im echten Wettbewerb: vier Töpfe nach Ruf, aus jedem Topf ein
     * Verein je Gruppe, nie zwei Vereine eines Landes in derselben Gruppe.
     * Zurück kommt die Teilnehmerliste in Gruppenfolge (je vier am Stück).
     */
    static loseGruppen(ids, allClubs = []) {
        const anzahl = Math.floor((ids || []).length / 4);
        if (anzahl < 2) return (ids || []).slice();
        const verein = new Map((allClubs || []).map(c => [c.id, c]));
        const land = (id) => verein.get(id)?.countryId || id;
        const sortiert = ids.slice(0, anzahl * 4)
            .sort((a, b) => (verein.get(b)?.reputation || 0) - (verein.get(a)?.reputation || 0));

        for (let versuch = 0; versuch < 40; versuch++) {
            const gruppen = Array.from({ length: anzahl }, () => []);
            let geklappt = true;
            for (let topf = 0; topf < 4 && geklappt; topf++) {
                const imTopf = sortiert.slice(topf * anzahl, (topf + 1) * anzahl).sort(() => Math.random() - 0.5);
                // Wer die wenigsten freien Gruppen hat, wird zuerst gezogen
                const frei = (id) => gruppen.filter(g => g.length === topf && !g.some(x => land(x) === land(id)));
                while (imTopf.length) {
                    imTopf.sort((a, b) => frei(a).length - frei(b).length);
                    const id = imTopf.shift();
                    const moeglich = frei(id);
                    if (!moeglich.length) { geklappt = false; break; }
                    moeglich[Math.floor(Math.random() * moeglich.length)].push(id);
                }
            }
            if (geklappt) return gruppen.flat();
        }
        // Geht es nicht auf (zu viele Vereine eines Landes), dann eben ohne
        // Länderschutz - aber weiter mit Töpfen
        const gruppen = Array.from({ length: anzahl }, () => []);
        for (let topf = 0; topf < 4; topf++) {
            sortiert.slice(topf * anzahl, (topf + 1) * anzahl).sort(() => Math.random() - 0.5)
                .forEach((id, i) => gruppen[i].push(id));
        }
        return gruppen.flat();
    }

    /** Name eines Wettbewerbs - erfunden oder aus der Namensdatei */
    static wettbewerbName(id) {
        const namen = (typeof window !== "undefined" && window.NamenEngine)
            || (typeof require !== "undefined" ? require("./namenEngine.js").NamenEngine : null);
        return namen ? namen.wettbewerb(id) : id;
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
        const playoffs = _compResolve("PlayoffEngine", "./playoffEngine.js");

        state.leagues.forEach(child => {
            if (!child.promotionTo) return;
            const table = standingsByLeague[child.id];
            if (!Array.isArray(table) || table.length === 0) return;

            // Direkt steigen nur die Plätze vor den Aufstiegsspielen auf -
            // wer über Relegation oder Playoffs hochkommt, steht unten
            const spots = playoffs && typeof playoffs.direktePlaetze === "function"
                ? playoffs.direktePlaetze(child)
                : ((child.promotionSpots && child.promotionSpots.length) ? child.promotionSpots : [1]);
            spots.forEach(pos => {
                const entry = table[pos - 1];
                if (!entry) return;
                if (!risingByParent.has(child.promotionTo)) risingByParent.set(child.promotionTo, []);
                risingByParent.get(child.promotionTo).push({ clubId: entry.clubId, fromLeague: child.id });
            });
        });
        // Die Sieger von Relegation und Aufstiegs-Playoffs
        if (playoffs && typeof playoffs.aufsteiger === "function") {
            playoffs.aufsteiger(state).forEach(r => {
                const child = state.leagues.find(l => l.id === r.fromLeague);
                if (!child || !child.promotionTo) return;
                if (!risingByParent.has(child.promotionTo)) risingByParent.set(child.promotionTo, []);
                const liste = risingByParent.get(child.promotionTo);
                if (!liste.some(x => x.clubId === r.clubId)) liste.push(r);
            });
        }

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
