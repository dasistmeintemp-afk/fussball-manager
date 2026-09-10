/**
 * SeasonEngine - Spieltagsabwicklung, wöchentliche Finanzen, Tabellenaktualisierung und Saisonübergang
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _resolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));

    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();
const _getMatchEngine = () => _resolve('MatchEngine', './matchEngine.js');
const _getGameState = () => _resolve('GameState', './gameState.js');
const _getTrainingEngine = () => _resolve('TrainingEngine', './trainingEngine.js');
const _getTransferEngine = () => _resolve('TransferEngine', './transferEngine.js');
const _getAIManagerEngine = () => _resolve('AIManagerEngine', './aiManagerEngine.js');
const _getScoutingEngine = () => _resolve('ScoutingEngine', './scoutingEngine.js');
const _getYouthEngine = () => _resolve('YouthEngine', './youthEngine.js');
const _getBoardEngine = () => _resolve('BoardEngine', './boardEngine.js');
const _getNewsEngine = () => _resolve('NewsEngine', './newsEngine.js');
const _getContractEngine = () => _resolve('ContractEngine', './contractEngine.js');
const _getFinanceEngine = () => _resolve('FinanceEngine', './financeEngine.js');

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
        const financeEngine = _getFinanceEngine();

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

        // 3. Wöchentliches Training der KI-Vereine (der eigene Verein
        // trainiert tageweise über den Kalender)
        const trainingEngine = _getTrainingEngine();
        if (trainingEngine && typeof trainingEngine.processWeeklyTraining === 'function') {
            trainingEngine.processWeeklyTraining(state);
        }

        // Der Spieltag kostet Substanz: Einsatzminuten zehren an Fitness und
        // bringen Spielschärfe. Danach ist der Trainingsbericht wieder aktuell.
        if (trainingEngine && typeof trainingEngine.applyMatchdayStrain === 'function') {
            trainingEngine.applyMatchdayStrain(state);
        }

        // Laufende Verhandlungen einen Schritt weiterbringen
        const negotiationEngine = _resolve('NegotiationEngine', './negotiationEngine.js');
        if (negotiationEngine && typeof negotiationEngine.processDay === 'function') {
            negotiationEngine.processDay(state);
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

        // Der Saisonabschluss darf nur ein einziges Mal wirken. Jeder weitere
        // Aufruf hätte die ganze Welt um ein weiteres Jahr altern lassen,
        // Verträge erneut verkürzt und die Prämien noch einmal ausgeschüttet -
        // und genau das passierte, solange man am Saisonende weiterklickte.
        if (state._seasonFinished === state.seasonYear) {
            return {
                seasonEnded: true,
                seasonYear: state.seasonYear,
                championClub,
                userRank,
                standings: state.standings
            };
        }
        state._seasonFinished = state.seasonYear;

        // Preisgelder ausschütten - in jeder Liga, und in der Höhe, die zur
        // Liga passt. Vorher gab es feste 21 Millionen für den Ersten, egal ob
        // Bundesliga oder Landesliga, und nur in der Liga des Nutzers.
        const financeEngine = _getFinanceEngine();
        const tabellen = [state.standings];
        Object.keys(state.standingsByLeague || {}).forEach(ligaId => {
            const tabelle = state.standingsByLeague[ligaId];
            if (Array.isArray(tabelle) && tabelle !== state.standings) tabellen.push(tabelle);
        });

        tabellen.forEach(tabelle => {
            (tabelle || []).forEach((entry, index) => {
                const club = state.clubs.find(c => c.id === entry.clubId);
                if (!club) return;

                const sponsor = (financeEngine && typeof financeEngine.sponsorPerMatchday === 'function')
                    ? financeEngine.sponsorPerMatchday(club)
                    : Math.round((club.reputation || 70) * 15000);

                const prizeMoney = Math.max(Math.round(sponsor * 0.9), Math.round(sponsor * Math.max(1, 14 - index) * 0.9));
                club.balance += prizeMoney;
                club.transferBudget += Math.round(prizeMoney * 0.7);
            });
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

        // Spieler altern um 1 Jahr
        state.players.forEach(player => {
            player.age += 1;
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

        // Verträge um ein Jahr kürzen; wessen Vertrag danach im letzten Jahr
        // steht, über den bekommt der Nutzer eine Warnung ins Postfach und
        // hat eine ganze Saison Zeit, zu verlängern.
        const contractEngine = _getContractEngine();
        if (contractEngine && typeof contractEngine.processSeasonContractUpdates === 'function') {
            contractEngine.processSeasonContractUpdates(state);
        } else {
            state.players.forEach(player => {
                player.contractYears = Math.max(0, (player.contractYears || 0) - 1);
            });
        }

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
    /**
     * Auslaufende Verträge abwickeln.
     *
     * Bisher zählte finishSeason die Laufzeiten herunter, und damit hatte es
     * sich: Nach einer Saison stand rund ein Viertel der Spielwelt ohne
     * Restlaufzeit da und blieb trotzdem im Verein. Jetzt verlängern die
     * Vereine mit ihren Leistungsträgern von selbst, alle anderen werden
     * ablösefrei - und wer Lücken im Kader hat, greift auf dem freien Markt zu.
     */
    /**
     * Karriereenden abwickeln.
     *
     * Die Spieler wurden Saison für Saison ein Jahr älter, aber niemand hörte
     * je auf. Nach ein paar Jahren wäre die halbe Liga im Rentenalter
     * aufgelaufen. Jetzt tritt ab, wer zu alt geworden ist - die Klasse eines
     * Spielers verlängert seine Laufbahn, ein Ergänzungsspieler hört früher auf.
     */
    static processRetirements(state) {
        if (!Array.isArray(state.players)) return { retired: 0 };

        const abschied = [];
        state.players.forEach(player => {
            const alter = player.age || 25;
            if (alter < 32) return;

            let chance = (alter - 31) * 0.16;
            const klasse = player.overall || 50;
            if (klasse >= 78) chance -= 0.18;
            else if (klasse < 55) chance += 0.12;
            if (alter >= 39) chance = 1;

            if (Math.random() < chance) abschied.push(player);
        });

        if (abschied.length === 0) return { retired: 0, names: [] };

        const gehende = new Set(abschied.map(p => p.id));
        const eigene = [];

        abschied.forEach(player => {
            const club = state.clubs.find(c => c.id === player.clubId);
            if (club) {
                club.playerIds = (club.playerIds || []).filter(id => id !== player.id);
                club.lineup = (club.lineup || []).filter(id => id !== player.id);
                club.bench = (club.bench || []).filter(id => id !== player.id);
                club.transferList = (club.transferList || []).filter(id => id !== player.id);
                if (club.id === state.userClubId) eigene.push(`${player.name} (${player.age})`);
            }
        });

        state.players = state.players.filter(p => !gehende.has(p.id));

        // Verweise aufräumen, damit keine Karteileichen zurückbleiben
        if (state.transferMarket && Array.isArray(state.transferMarket.listedPlayerIds)) {
            state.transferMarket.listedPlayerIds = state.transferMarket.listedPlayerIds.filter(id => !gehende.has(id));
        }
        if (state.transferMarket && Array.isArray(state.transferMarket.offers)) {
            state.transferMarket.offers = state.transferMarket.offers.filter(o => !gehende.has(o.playerId));
        }
        if (Array.isArray(state.negotiations)) {
            state.negotiations = state.negotiations.filter(n => !gehende.has(n.playerId));
        }
        if (state.scouting) {
            ["assignments", "reports", "shortlist"].forEach(feld => {
                if (!Array.isArray(state.scouting[feld])) return;
                state.scouting[feld] = state.scouting[feld].filter(e => {
                    const id = (e && typeof e === "object") ? e.playerId : e;
                    return !gehende.has(id);
                });
            });
        }

        if (eigene.length > 0 && Array.isArray(state.inbox)) {
            state.inbox.unshift({
                id: Date.now() + 22,
                matchday: state.totalMatchdays,
                date: `Saison ${state.seasonYear} Abschluss`,
                sender: "Sportdirektor",
                subject: `${eigene.length} Spieler beend${eigene.length === 1 ? "et" : "en"} die Karriere`,
                body: `Folgende Spieler hängen die Schuhe an den Nagel:\n\n${eigene.map(n => `• ${n}`).join("\n")}\n\nWir danken für die geleisteten Dienste und suchen rechtzeitig nach Nachfolgern.`,
                read: false,
                type: "retirement"
            });
        }

        return { retired: abschied.length, names: abschied.map(p => p.name) };
    }

    static processContractExpiries(state) {
        const abgaenge = [];
        const eigeneAbgaenge = [];

        state.players.forEach(player => {
            if ((player.contractYears || 0) > 0) return;
            if (!player.clubId) { abgaenge.push(player); return; }

            const club = state.clubs.find(c => c.id === player.clubId);
            if (!club) {
                player.clubId = null;
                abgaenge.push(player);
                return;
            }

            const istNutzerverein = club.id === state.userClubId;

            if (!istNutzerverein) {
                // Die KI hält, wer stark oder jung ist, und lässt den Rest ziehen
                const wichtig = (player.overall || 50) >= 55 || (player.age || 25) <= 23;
                const haltequote = wichtig ? 0.88 : 0.45;
                if (Math.random() < haltequote) {
                    player.contractYears = 1 + Math.floor(Math.random() * 3);
                    return;
                }
            }

            club.playerIds = (club.playerIds || []).filter(id => id !== player.id);
            club.lineup = (club.lineup || []).filter(id => id !== player.id);
            club.bench = (club.bench || []).filter(id => id !== player.id);
            player.clubId = null;
            player.contractYears = 0;

            abgaenge.push(player);
            if (istNutzerverein) eigeneAbgaenge.push(player.name);
        });

        // Vereine unter Sollstärke bedienen sich auf dem freien Markt
        const worldGen = _resolve('WorldGenerator', './worldGenerator.js');
        const sollGroesse = (club) => {
            const level = club.level || 1;
            return (worldGen && worldGen.SQUAD_SIZES && worldGen.SQUAD_SIZES[level]) || 19;
        };

        const playerGen = _resolve('PlayerGenerator', './playerGenerator.js');
        const frei = abgaenge.filter(p => !p.clubId);

        /** Welche Positionen fehlen dem Kader gegenüber dem Sollplan? */
        const offenePositionen = (club, ziel) => {
            if (!playerGen || typeof playerGen.buildSquadPlan !== 'function') return [];
            const ist = {};
            (club.playerIds || []).forEach(id => {
                const p = state.players.find(sp => sp.id === id);
                if (p) ist[p.pos] = (ist[p.pos] || 0) + 1;
            });
            const rest = Object.assign({}, ist);
            const offen = [];
            playerGen.buildSquadPlan(ziel).forEach(pos => {
                if ((rest[pos] || 0) > 0) rest[pos]--;
                else offen.push(pos);
            });

            // Das Existenzminimum zuerst - ohne zweiten Torwart nützt der
            // beste Innenverteidiger nichts.
            const kritisch = (worldGen && typeof worldGen.fehlendeMindestbesetzung === 'function')
                ? worldGen.fehlendeMindestbesetzung(ist)
                : [];
            return kritisch.concat(offen);
        };

        // Ein Teil der Ablösefreien bleibt auf dem Markt, damit der Nutzer sich
        // dort auch wirklich bedienen kann - sonst haben die KI-Vereine schon
        // am ersten Tag jeden Vertragslosen weggeschnappt.
        const reserve = Math.max(15, Math.round(frei.length * 0.15));

        // Die angesehenen Vereine greifen zuerst zu
        const reihenfolge = state.clubs.slice().sort((a, b) => (b.reputation || 50) - (a.reputation || 50));
        reihenfolge.forEach(club => {
            // Beim eigenen Verein wird nur die Not gelindert - wer den Kader
            // darüber hinaus auffüllen will, geht selbst auf den Transfermarkt.
            const soll = sollGroesse(club);
            const ziel = club.id === state.userClubId ? Math.min(20, soll) : soll;
            let fehlend = ziel - (club.playerIds || []).length;
            if (fehlend <= 0) return;

            // Erst die Lücken schließen, die wirklich weh tun: Ohne zweiten
            // Torwart oder ohne Stürmer nützt der beste Innenverteidiger nichts.
            const gesucht = offenePositionen(club, soll);
            const grenze = 40 + (club.reputation || 50) * 0.55;
            frei.sort((a, b) => (b.overall || 0) - (a.overall || 0));

            const greifen = (filter) => {
                const idx = frei.findIndex(p => filter(p) && (p.overall || 0) <= grenze);
                if (idx >= 0) return frei.splice(idx, 1)[0];
                const ersatz = frei.findIndex(filter);
                return ersatz >= 0 ? frei.splice(ersatz, 1)[0] : null;
            };

            const untergrenze = club.id === state.userClubId ? 0 : reserve;
            while (fehlend > 0 && frei.length > untergrenze) {
                const pos = gesucht.shift();
                const gewaehlt = pos
                    ? (greifen(p => p.pos === pos) || greifen(p => (p.positions || []).includes(pos)) || greifen(() => true))
                    : greifen(() => true);
                if (!gewaehlt) break;

                gewaehlt.clubId = club.id;
                gewaehlt.contractYears = 1 + Math.floor(Math.random() * 3);
                club.playerIds.push(gewaehlt.id);
                fehlend--;
            }
        });

        // Was der freie Markt nicht hergab - etwa nach einem Aufstieg in eine
        // Liga mit größeren Kadern - kommt aus der Nachwuchsabteilung.
        if (worldGen && typeof worldGen.fillUpExistingSquads === 'function' && playerGen) {
            worldGen.fillUpExistingSquads(state, worldGen.getLeagues(), playerGen, {
                sizeFor: (club, voll) => club.id === state.userClubId ? Math.min(20, voll) : voll,
                mindestJugend: 5
            });
        }

        if (eigeneAbgaenge.length > 0 && Array.isArray(state.inbox)) {
            state.inbox.unshift({
                id: Date.now() + 21,
                matchday: 1,
                date: `Saisonstart ${state.seasonYear + 1}`,
                sender: "Sportdirektor",
                subject: `${eigeneAbgaenge.length} Vertrag${eigeneAbgaenge.length === 1 ? "" : "e"} ausgelaufen`,
                body: `Folgende Spieler haben uns ablösefrei verlassen, weil ihr Vertrag nicht verlängert wurde:\n\n${eigeneAbgaenge.map(n => `• ${n}`).join("\n")}\n\nWir haben den Kader notdürftig aufgefüllt. Auf dem Transfermarkt stehen weitere ablösefreie Spieler bereit - suchen Sie sich in Ruhe die passenden Verstärkungen aus.`,
                read: false,
                type: "contract"
            });
        }

        return { abgaenge: abgaenge.length, ohneVerein: state.players.filter(p => !p.clubId).length };
    }

    static startNextSeason(state) {
        state.seasonYear++;
        state.currentMatchday = 1;
        state._seasonFinished = null;

        // Karriereenden und Verträge abwickeln, bevor Aufstellungen und
        // Tabellen neu entstehen
        SeasonEngine.processRetirements(state);
        SeasonEngine.processContractExpiries(state);

        const gameState = _getGameState();

        // Auf- und Abstieg über die gesamte Ligapyramide abwickeln
        const competitionEngine = _resolve('CompetitionEngine', './competitionEngine.js');

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
        const worldGen = _resolve('WorldGenerator', './worldGenerator.js');

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

        // Etat neu aufstellen. Vorher wuchs der Transferetat Saison für Saison
        // weiter, weil jede Prämie oben draufkam - nach fünf Jahren stand ein
        // dreistelliger Millionenbetrag zur Verfügung, ohne dass ihn je jemand
        // ausgab. Jetzt richtet er sich nach Kontostand und Jahresumsatz.
        const finanzen = _getFinanceEngine();
        if (finanzen && typeof finanzen.sponsorPerMatchday === 'function') {
            state.clubs.forEach(club => {
                const jahresumsatz = (finanzen.sponsorPerMatchday(club)
                    + Math.round((club.stadiumCapacity || club.capacity || 20000) * 0.8 * (club.ticketPrice || 35) / 2)) * 34;
                const etat = Math.min(Math.max(0, (club.balance || 0)) * 0.35, jahresumsatz * 0.6);
                club.transferBudget = Math.max(0, Math.round(etat));
            });
        }

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

        // Neuen Spielkalender auslegen. Ohne das blieb der alte, abgelaufene
        // Kalender stehen: Die zweite Saison ließ sich über den Kalender gar
        // nicht spielen, weil der Zeiger schon auf dem letzten Tag stand.
        const calendarEngine = _resolve('CalendarEngine', './calendarEngine.js');
        if (calendarEngine && typeof calendarEngine.generateSeasonCalendar === 'function') {
            state.calendar = [];
            state.currentDayIndex = 0;
            calendarEngine.generateSeasonCalendar(state);
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
