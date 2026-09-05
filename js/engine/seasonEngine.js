/**
 * SeasonEngine - Spieltagsabwicklung, wöchentliche Finanzen, Tabellenaktualisierung und Saisonübergang
 */

const _getMatchEngine = () => typeof MatchEngine !== 'undefined' ? MatchEngine : (typeof window !== 'undefined' ? window.MatchEngine : (typeof require !== 'undefined' ? require('./matchEngine.js').MatchEngine : null));
const _getGameState = () => typeof GameState !== 'undefined' ? GameState : (typeof window !== 'undefined' ? window.GameState : (typeof require !== 'undefined' ? require('./gameState.js').GameState : null));
const _getTrainingEngine = () => typeof TrainingEngine !== 'undefined' ? TrainingEngine : (typeof window !== 'undefined' ? window.TrainingEngine : (typeof require !== 'undefined' ? require('./trainingEngine.js').TrainingEngine : null));
const _getTransferEngine = () => typeof TransferEngine !== 'undefined' ? TransferEngine : (typeof window !== 'undefined' ? window.TransferEngine : (typeof require !== 'undefined' ? require('./transferEngine.js').TransferEngine : null));
const _getAIManagerEngine = () => typeof AIManagerEngine !== 'undefined' ? AIManagerEngine : (typeof window !== 'undefined' ? window.AIManagerEngine : (typeof require !== 'undefined' ? require('./aiManagerEngine.js').AIManagerEngine : null));
const _getScoutingEngine = () => typeof ScoutingEngine !== 'undefined' ? ScoutingEngine : (typeof window !== 'undefined' ? window.ScoutingEngine : (typeof require !== 'undefined' ? require('./scoutingEngine.js').ScoutingEngine : null));
const _getYouthEngine = () => typeof YouthEngine !== 'undefined' ? YouthEngine : (typeof window !== 'undefined' ? window.YouthEngine : (typeof require !== 'undefined' ? require('./youthEngine.js').YouthEngine : null));
const _getBoardEngine = () => typeof BoardEngine !== 'undefined' ? BoardEngine : (typeof window !== 'undefined' ? window.BoardEngine : (typeof require !== 'undefined' ? require('./boardEngine.js').BoardEngine : null));
const _getNewsEngine = () => typeof NewsEngine !== 'undefined' ? NewsEngine : (typeof window !== 'undefined' ? window.NewsEngine : (typeof require !== 'undefined' ? require('./newsEngine.js').NewsEngine : null));
const _getContractEngine = () => typeof ContractEngine !== 'undefined' ? ContractEngine : (typeof window !== 'undefined' ? window.ContractEngine : (typeof require !== 'undefined' ? require('./contractEngine.js').ContractEngine : null));
const _getFinanceEngine = () => typeof FinanceEngine !== 'undefined' ? FinanceEngine : (typeof window !== 'undefined' ? window.FinanceEngine : (typeof require !== 'undefined' ? require('./financeEngine.js').FinanceEngine : null));

class SeasonEngine {
    /**
     * Führt alle verbleibenden Spiele des aktuellen Spieltags im Hintergrund aus
     */
    static simulateRemainingMatchesOfDay(state) {
        const round = state.schedule.find(r => r.matchday === state.currentMatchday);
        if (!round) return;

        const matchEngine = _getMatchEngine();

        round.matches.forEach(match => {
            if (!match.played) {
                const homeClub = state.clubs.find(c => c.id === match.homeClubId);
                const awayClub = state.clubs.find(c => c.id === match.awayClubId);
                if (homeClub && awayClub && matchEngine) {
                    matchEngine.simulateFullMatch(match, homeClub, awayClub, state.players);
                }
            }
            // Nur die eigenen Partien behalten Einzelkritiken und Ereignisse
            if (matchEngine && typeof matchEngine.compactPlayedMatch === 'function') {
                const isUserMatch = match.homeClubId === state.userClubId || match.awayClubId === state.userClubId;
                matchEngine.compactPlayedMatch(match, isUserMatch);
            }
        });

        // Die übrigen elf Ligen laufen im Hintergrund mit
        SeasonEngine.simulateOtherLeagues(state);

        // Tabelle aktualisieren
        const gameState = _getGameState();
        if (gameState && typeof gameState.calculateStandings === 'function') {
            state.standings = gameState.calculateStandings(gameState.getLeagueClubs(state), state.schedule, state.currentMatchday);
            state.standingsByLeague = state.standingsByLeague || {};
            state.standingsByLeague[gameState.getUserLeagueId(state)] = state.standings;
        }
    }

    /**
     * Spielt alle übrigen Ligen der Welt bis zum passenden Spieltag durch.
     *
     * Die Ligen haben unterschiedlich viele Spieltage (30, 34 oder 38). Damit
     * am Saisonende überall dieselbe Anzahl Runden gespielt ist, wird der
     * Fortschritt anteilig auf die eigene Liga umgerechnet. Ergebnisse fremder
     * Ligen werden sofort auf das Ergebnis eingedampft - alles andere würde
     * den Spielstand um ein Vielfaches aufblähen.
     */
    static simulateOtherLeagues(state) {
        if (!state.otherSchedules) return;

        const matchEngine = _getMatchEngine();
        const gameState = _getGameState();
        if (!matchEngine || !gameState) return;

        const userTotal = Math.max(1, state.totalMatchdays || (state.schedule ? state.schedule.length : 34));
        const progress = Math.min(1, (state.currentMatchday || 1) / userTotal);

        Object.keys(state.otherSchedules).forEach(leagueId => {
            const schedule = state.otherSchedules[leagueId];
            if (!Array.isArray(schedule) || schedule.length === 0) return;

            const targetRound = Math.min(schedule.length, Math.ceil(progress * schedule.length));
            const clubs = state.clubs.filter(c => c.leagueId === leagueId);
            if (clubs.length < 2) return;

            const clubById = new Map(clubs.map(c => [c.id, c]));

            schedule.forEach(round => {
                if (round.matchday > targetRound) return;
                round.matches.forEach(match => {
                    if (match.played) return;
                    const homeClub = clubById.get(match.homeClubId);
                    const awayClub = clubById.get(match.awayClubId);
                    if (!homeClub || !awayClub) return;

                    matchEngine.simulateFullMatch(match, homeClub, awayClub, state.players);
                    matchEngine.compactPlayedMatch(match, false);
                });
            });

            state.standingsByLeague = state.standingsByLeague || {};
            state.standingsByLeague[leagueId] = gameState.calculateStandings(clubs, schedule, targetRound);
        });
    }

    /**
     * Schließt den aktuellen Spieltag ab und bereitet den nächsten vor
     */
    static advanceToNextMatchday(state) {
        // 1. Zuerst alle Spiele des Tages sicherstellen
        SeasonEngine.simulateRemainingMatchesOfDay(state);

        const userClub = state.clubs.find(c => c.id === state.userClubId);

        // 2. Wöchentliche Finanzen & Spieltagseinnahmen sauber über FinanceEngine abrechnen (C3)
        const financeEngine = (typeof FinanceEngine !== 'undefined' && FinanceEngine)
            ? FinanceEngine
            : ((typeof window !== 'undefined' && window.FinanceEngine) ? window.FinanceEngine : (typeof require !== 'undefined' ? require('./financeEngine.js').FinanceEngine : null));

        if (financeEngine) {
            // Wöchentliche Kosten & Sponsoren verbuchen
            financeEngine.applyWeeklyCosts(state);

            // Ticketeinnahmen für alle Heimspiele dieses Spieltags verbuchen
            const round = state.schedule.find(r => r.matchday === state.currentMatchday);
            if (round && Array.isArray(round.matches)) {
                round.matches.forEach(m => {
                    financeEngine.applyMatchdayIncome(state, m);
                });
            }
        }

        // 3. Wöchentliches Training & Entwicklung
        const trainingEngine = _getTrainingEngine();
        if (trainingEngine && typeof trainingEngine.processWeeklyTraining === 'function') {
            trainingEngine.processWeeklyTraining(state);
        }

        // 4. Verletzungen & Sperren um 1 reduzieren
        state.players.forEach(p => {
            if (p.injuredWeeks > 0) {
                p.injuredWeeks--;
                if (p.injuredWeeks === 0 && p.clubId === state.userClubId) {
                    state.inbox.unshift({
                        id: Date.now() + 3,
                        matchday: state.currentMatchday,
                        date: `Spieltag ${state.currentMatchday}`,
                        sender: "Medizinische Abteilung",
                        subject: `Fit: ${p.name} kehrt zurück!`,
                        body: `${p.name} hat sich vollständig von seiner Verletzung erholt und steht Ihnen ab sofort wieder für die Startelf zur Verfügung!`,
                        read: false,
                        type: "injury_healed"
                    });
                }
            }

            if (p.suspendedMatches > 0) {
                p.suspendedMatches--;
                if (p.suspendedMatches === 0 && p.clubId === state.userClubId) {
                    state.inbox.unshift({
                        id: Date.now() + 4,
                        matchday: state.currentMatchday,
                        date: `Spieltag ${state.currentMatchday}`,
                        sender: "Sportgericht / Ligaverband",
                        subject: `Sperre abgelaufen: ${p.name}`,
                        body: `Die Sperre für ${p.name} ist abgelaufen. Der Spieler ist für das nächste Spiel wieder spielberechtigt.`,
                        read: false,
                        type: "suspension_cleared"
                    });
                }
            }
        });

        // 5. KI-Transfermarkt Aktivität & KI-Manager
        const transferEngine = _getTransferEngine();
        if (transferEngine && typeof transferEngine.processAITransferMarket === 'function') {
            transferEngine.processAITransferMarket(state);
        }

        const aiManagerEngine = _getAIManagerEngine();
        if (aiManagerEngine) {
            if (typeof aiManagerEngine.generateAiTransferOffers === 'function') {
                aiManagerEngine.generateAiTransferOffers(state);
            }
            if (typeof aiManagerEngine.updateAllAiClubsBeforeMatchday === 'function') {
                aiManagerEngine.updateAllAiClubsBeforeMatchday(state);
            }
        }

        // 6. Scouting & Jugendakademie Updates
        const scoutingEngine = _getScoutingEngine();
        if (scoutingEngine && typeof scoutingEngine.processWeeklyScouting === 'function') {
            scoutingEngine.processWeeklyScouting(state);
        }

        const youthEngine = _getYouthEngine();
        if (youthEngine && typeof youthEngine.trainProspects === 'function') {
            youthEngine.trainProspects(state, state.userClubId);
        }

        // 7. Vorstandszufriedenheit berechnen
        SeasonEngine.updateBoardConfidence(state);
        const boardEngine = _getBoardEngine();
        if (boardEngine && typeof boardEngine.updateConfidence === 'function') {
            boardEngine.updateConfidence(state);
        }

        // 7. Spieltag hochzählen oder Saisonende einläuten
        if (state.currentMatchday < state.totalMatchdays) {
            state.currentMatchday++;
            // Vorschau-Nachricht auf den neuen Spieltag
            const nextRound = state.schedule.find(r => r.matchday === state.currentMatchday);
            const nextMatch = nextRound?.matches.find(m => m.homeClubId === userClub.id || m.awayClubId === userClub.id);
            if (nextMatch) {
                const opponentId = nextMatch.homeClubId === userClub.id ? nextMatch.awayClubId : nextMatch.homeClubId;
                const opponent = state.clubs.find(c => c.id === opponentId);
                const isHome = nextMatch.homeClubId === userClub.id;

                state.inbox.unshift({
                    id: Date.now() + 5,
                    matchday: state.currentMatchday,
                    date: `Spieltag ${state.currentMatchday}`,
                    sender: "Co-Trainer",
                    subject: `Spieltag ${state.currentMatchday}: Vorbericht gegen ${opponent?.name}`,
                    body: `Am ${state.currentMatchday}. Spieltag treffen wir ${isHome ? "vor heimischer Kulisse" : "auswärts"} auf ${opponent?.name} (Tabellenplatz: ${SeasonEngine.getClubRank(state, opponentId)}).\n\nBereiten Sie die Mannschaft im Taktik- und Aufstellungsmenü optimal auf die Begegnung vor!`,
                    read: false,
                    type: "preview"
                });
            }
            return { seasonEnded: false };
        } else {
            // SAISONENDE!
            return SeasonEngine.finishSeason(state);
        }
    }

    /**
     * Ermittelt den Tabellenplatz eines Vereins
     */
    static getClubRank(state, clubId) {
        const index = state.standings.findIndex(s => s.clubId === clubId);
        return index !== -1 ? `${index + 1}.` : "-";
    }

    /**
     * Berechnet die Zufriedenheit des Vorstands
     */
    static updateBoardConfidence(state) {
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        const rankIndex = state.standings.findIndex(s => s.clubId === userClub.id);
        const currentRank = rankIndex !== -1 ? rankIndex + 1 : 6;

        let targetRank = 6;
        if (userClub.boardExpectation === "championship") targetRank = 1;
        else if (userClub.boardExpectation === "top3") targetRank = 3;
        else if (userClub.boardExpectation === "midfield") targetRank = 7;
        else if (userClub.boardExpectation === "avoid_relegation") targetRank = 10;

        const diff = targetRank - currentRank; // Positiv = besser als Ziel, Negativ = schlechter
        let newConfidence = 75 + (diff * 5);

        // Finanzieller Bonus / Malus
        if (userClub.balance < 0) newConfidence -= 15;
        if (userClub.balance > 25000000) newConfidence += 5;

        state.boardConfidence = Math.min(100, Math.max(10, Math.round(newConfidence)));
    }

    /**
     * Saisonabschluss, Meisterehrung, Prämien und Vorbereitung der nächsten Saison
     */
    static finishSeason(state) {
        const championEntry = state.standings[0];
        const championClub = state.clubs.find(c => c.id === championEntry.clubId);
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const userRank = state.standings.findIndex(s => s.clubId === userClub.id) + 1;

        // Preisgelder ausschütten
        state.standings.forEach((entry, index) => {
            const club = state.clubs.find(c => c.id === entry.clubId);
            if (club) {
                const prizeMoney = Math.max(1000000, (14 - index) * 1500000);
                club.balance += prizeMoney;
                club.transferBudget += Math.round(prizeMoney * 0.7);
            }
        });

        // Saisonauszeichnungen ermitteln (E5)
        const sortedScorers = [...state.players].filter(p => (p.stats.goals || 0) > 0).sort((a, b) => (b.stats.goals || 0) - (a.stats.goals || 0));
        const topScorer = sortedScorers[0] || null;

        const sortedAssists = [...state.players].filter(p => (p.stats.assists || 0) > 0).sort((a, b) => (b.stats.assists || 0) - (a.stats.assists || 0));
        const topAssister = sortedAssists[0] || null;

        const ratedPlayers = [...state.players].filter(p => (p.stats.matches || 0) >= 10).sort((a, b) => ((b.stats.ratingSum || 0) / (b.stats.matches || 1)) - ((a.stats.ratingSum || 0) / (a.stats.matches || 1)));
        const playerOfTheSeason = ratedPlayers[0] || null;

        // Historie archivieren
        state.history.pastSeasons.push({
            season: state.seasonYear,
            championId: championClub.id,
            championName: championClub.name,
            standings: JSON.parse(JSON.stringify(state.standings)),
            userClubId: userClub.id,
            userRank,
            awards: {
                topScorer: topScorer ? { name: topScorer.name, goals: topScorer.stats.goals, clubId: topScorer.clubId } : null,
                topAssists: topAssister ? { name: topAssister.name, assists: topAssister.stats.assists, clubId: topAssister.clubId } : null,
                playerOfTheSeason: playerOfTheSeason ? { name: playerOfTheSeason.name, rating: ((playerOfTheSeason.stats.ratingSum || 0) / (playerOfTheSeason.stats.matches || 1)).toFixed(2), clubId: playerOfTheSeason.clubId } : null
            }
        });

        // Spieler altern um 1 Jahr & Verträge um 1 Jahr reduzieren
        state.players.forEach(player => {
            player.age += 1;
            player.contractYears = Math.max(0, player.contractYears - 1);
            player.stats.matches = 0;
            player.stats.goals = 0;
            player.stats.assists = 0;
            player.stats.yellowCards = 0;
            player.stats.redCards = 0;
            player.stats.ratingSum = 0;
            player.stats.cleanSheets = 0;
            player.stats.minutes = 0;
            player.fitness = 100;
            player.injuredWeeks = 0;
            player.suspendedMatches = 0;
        });

        // Abschlussbericht im Postfach
        state.inbox.unshift({
            id: Date.now() + 10,
            matchday: state.totalMatchdays,
            date: `Saison ${state.seasonYear} Abschluss`,
            sender: "Ligavorstand",
            subject: `🏆 Saisonabschluss Saison ${state.seasonYear} - Herzlichen Glückwunsch an ${championClub.name}!`,
            body: `Die Saison ${state.seasonYear} ist offiziell beendet!\n\nDeutscher Meister ist **${championClub.name}**!\nIhr Verein ${userClub.name} beendet die Saison auf dem **${userRank}. Tabellenplatz**.\n\nAlle Vereine haben ihre Saisonprämien erhalten. Wir starten in Kürze in die Vorbereitung auf die Saison ${state.seasonYear + 1}!`,
            read: false,
            type: "season_end"
        });

        return {
            seasonEnded: true,
            seasonYear: state.seasonYear,
            championClub,
            userRank,
            standings: state.standings
        };
    }

    /**
     * Startet die neue Saison (Saison N+1)
     */
    static startNextSeason(state) {
        state.seasonYear++;
        state.currentMatchday = 1;

        const gameState = _getGameState();

        // Auf- und Abstieg über die gesamte Ligapyramide abwickeln
        const competitionEngine = (typeof CompetitionEngine !== 'undefined' && CompetitionEngine)
            ? CompetitionEngine
            : ((typeof window !== 'undefined' && window.CompetitionEngine) ? window.CompetitionEngine
                : (typeof require !== 'undefined' ? require('./competitionEngine.js').CompetitionEngine : null));

        let movements = { promoted: [], relegated: [] };
        if (competitionEngine && typeof competitionEngine.processSeasonEndPromotionsRelegations === 'function') {
            movements = competitionEngine.processSeasonEndPromotionsRelegations(state);
        }

        // Europapokal aus den Abschlusstabellen der fünf Topligen neu besetzen
        if (competitionEngine && typeof competitionEngine.generateEuropeanCompetitions === 'function') {
            state.europeanCompetitions = competitionEngine.generateEuropeanCompetitions(state.clubs, {
                leagues: state.leagues,
                standingsByLeague: state.standingsByLeague
            });
        }

        // Spielpläne aller Ligen neu auslosen
        const worldGen = (typeof WorldGenerator !== 'undefined' && WorldGenerator)
            ? WorldGenerator
            : ((typeof window !== 'undefined' && window.WorldGenerator) ? window.WorldGenerator
                : (typeof require !== 'undefined' ? require('./worldGenerator.js').WorldGenerator : null));

        const userLeagueId = gameState ? gameState.getUserLeagueId(state) : state.userLeagueId;
        state.userLeagueId = userLeagueId;

        if (worldGen && typeof worldGen.generateAllSchedules === 'function') {
            worldGen.generateAllSchedules(state, userLeagueId);
        } else if (gameState && typeof gameState.generateSchedule === 'function') {
            state.schedule = gameState.generateSchedule(state.clubs);
            state.totalMatchdays = state.schedule.length;
        }

        const userLeague = (state.leagues || []).find(l => l.id === userLeagueId);
        if (userLeague) state.leagueName = userLeague.shortName || userLeague.name;

        // Form zurücksetzen
        state.clubs.forEach(club => {
            club.form = ["-", "-", "-", "-", "-"];
            // Kader automatisch aufstellen
            if (gameState && typeof gameState.autoSetLineupForClub === 'function') {
                gameState.autoSetLineupForClub(club, state.players);
            }
        });

        // Tabelle zurücksetzen
        if (gameState && typeof gameState.calculateStandings === 'function') {
            state.standings = gameState.calculateStandings(gameState.getLeagueClubs(state), state.schedule, 1);
            state.standingsByLeague = state.standingsByLeague || {};
            state.standingsByLeague[userLeagueId] = state.standings;
        }

        // Auf- oder Abstieg des eigenen Vereins vermelden
        const userMove = [...movements.promoted, ...movements.relegated].find(m => m.clubId === state.userClubId);
        if (userMove) {
            const target = (state.leagues || []).find(l => l.id === userMove.toLeague);
            const isPromotion = movements.promoted.some(m => m.clubId === state.userClubId);
            state.inbox.unshift({
                id: Date.now() + 16,
                matchday: 1,
                date: `Saisonstart ${state.seasonYear}`,
                sender: "Ligavorstand",
                subject: isPromotion ? "🎉 Aufstieg geschafft!" : "Abstieg besiegelt",
                body: isPromotion
                    ? `Herzlichen Glückwunsch! Ihr Verein spielt in der neuen Saison in der ${target ? target.shortName || target.name : "höheren Liga"}.`
                    : `Der Abstieg ist besiegelt. Ihr Verein tritt in der neuen Saison in der ${target ? target.shortName || target.name : "tieferen Liga"} an.`,
                read: false,
                type: isPromotion ? "promotion" : "relegation"
            });
        }

        // Neue Jugendspieler generieren
        const youthEngine = _getYouthEngine();
        if (youthEngine && typeof youthEngine.generateProspects === 'function') {
            youthEngine.generateProspects(state, state.userClubId);
        }

        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const formatMoney = (gameState && typeof gameState.formatMoney === 'function')
            ? gameState.formatMoney
            : (amt) => `${amt} €`;

        state.inbox.unshift({
            id: Date.now() + 15,
            matchday: 1,
            date: `Saisonstart ${state.seasonYear}`,
            sender: "Vorstand " + (userClub ? userClub.name : "Verein"),
            subject: `Willkommen in Saison ${state.seasonYear}!`,
            body: `Eine neue Spielzeit beginnt! Nutzen Sie die Vorbereitungsphase, um den Transfermarkt zu sondieren und die Taktik abzustimmen.\n\nAktuelles Transferbudget: ${formatMoney(userClub ? userClub.transferBudget : 0)}. Auf eine erfolgreiche Saison!`,
            read: false,
            type: "welcome"
        });
    }
}

if (typeof window !== "undefined") {
    window.SeasonEngine = SeasonEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SeasonEngine };
}
