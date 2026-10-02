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
    /** Bis zu diesem Alter bekommt ein Vereinsloser eine zweite Saison, einen Verein zu finden */
    static VEREINSLOS_TALENT_ALTER = 21;

    /**
     * So viele Spieler bis 21 hält jeder Verein mindestens; fehlen sie, kommen
     * Talente aus dem Nachwuchs nach. Es waren fünf - fast ein Viertel des
     * Kaders, doppelt so viel, wie die Altersverteilung der erzeugten Welt
     * hergibt (rund 2,5 je Kader). Jede Saison mussten so Hunderte Talente
     * nachrücken, und die Verdrängten trieben vereinslos durch die Welt.
     * Mit drei altert die Welt über acht Saisons auf rund 28 Jahre im Schnitt,
     * die Ligastufen bleiben aber stabil; vier ließ die unteren Ligen stärker
     * driften.
     */
    static MINDEST_JUGEND = 3;

    /**
     * Gemessen am Niveau des eigenen Kaders (Schnitt der vierzehn Besten):
     * Ein KI-Verein hält einen auslaufenden Vertrag eher, wenn der Spieler
     * höchstens so weit darunter liegt, und holt Vereinslose aus diesem Band.
     */
    static HALTEN_UNTER_NIVEAU = 12;
    static FREI_UEBER_NIVEAU = 6;
    static FREI_UNTER_NIVEAU = 12;

    /**
     * Wie wahrscheinlich ein KI-Verein einen auslaufenden Vertrag verlängert:
     * Wer jung ist oder nicht weit unter dem Kader liegt, bleibt meist.
     * Vorher hieß "wichtig" fest Gesamtstärke 55 - in den Amateurligen traf
     * das niemanden, und jeder zweite Vertrag lief aus.
     */
    static haltequote(player, niveau) {
        const wichtig = (player.age || 25) <= 23
            || (player.overall || 50) >= (niveau ?? 80) - SeasonEngine.HALTEN_UNTER_NIVEAU;
        return wichtig ? 0.88 : 0.45;
    }

    /**
     * Was ein Abstieg kostet. Bisher nahm ein Absteiger seinen ganzen Kader
     * mit: Bundesliga-Absteiger lagen danach im Schnitt 2,1 Punkte über den
     * Aufsteigern, die ihren Platz einnahmen (Schnitt der vierzehn Besten,
     * vier Startwerte, fünf Saisons) - jeder Tausch hob die Zweite Liga und
     * nahm der Bundesliga etwas Breite.
     *
     * Jetzt kann gehen, wer mehr als ueberNiveau über dem Schnitt der neuen
     * Liga liegt: mit dieser Wahrscheinlichkeit, höchstens so viele je
     * Verein, zum Bruchteil der üblichen Ablöse - aber nur, bis der Absteiger
     * nicht mehr stärker ist als die Aufsteiger. Ohne diese Bremse lagen
     * Absteiger danach 1,7 (Zweite Liga) und 3,9 Punkte (Dritte Liga) unter
     * den Aufsteigern, und die Dritte Liga verlor Stärke. Mit ihr: -0,1 und
     * -1,4.
     */
    static ABSTIEG = { ueberNiveau: 3, chance: 0.85, hoechstens: 6, abloese: 0.6 };

    /**
     * Nach dem Abstieg: Die zu guten Spieler eines KI-Absteigers wechseln in
     * die Liga, die er verlassen hat, bevorzugt zu den Aufsteigern - zu einem
     * Verein, zu dessen Kader sie passen (passtZumKader) und der die Ablöse
     * bezahlen kann. Die Lücke füllen Spieler, die zur neuen Liga passen.
     * Beim eigenen Verein entscheidet der Nutzer: Die Spieler äußern einen
     * Wechselwunsch.
     */
    static abstiegsfolgen(state, movements, zufall = Math.random) {
        const ergebnis = { wechsel: [], wuensche: [] };
        const absteiger = (movements && movements.relegated) || [];
        const contractEngine = _getContractEngine();
        const transferEngine = _getTransferEngine();
        if (!absteiger.length || !contractEngine || !transferEngine) return ergebnis;

        const A = SeasonEngine.ABSTIEG;
        const spielerNach = new Map(state.players.map(p => [p.id, p]));
        const niveauVon = c => contractEngine.vereinsNiveau(c, spielerNach);
        const absteigerIds = new Set(absteiger.map(m => m.clubId));
        const aufsteigerIds = new Set(((movements && movements.promoted) || []).map(m => m.clubId));
        const ligaName = id => { const l = (state.leagues || []).find(x => x.id === id); return l ? (l.shortName || l.name) : "höheren Liga"; };
        const verkaeufer = new Set();
        const niveauOhne = (club, ohne) => contractEngine.vereinsNiveau(
            { playerIds: (club.playerIds || []).filter(id => !ohne.has(id)) }, spielerNach);
        // Wie stark sind die, die aus der neuen Liga aufsteigen? So weit - und
        // nicht weiter - gibt ein Absteiger ab. Gemessen vor allen Wechseln.
        const aufsteigerNiveau = new Map();
        ((movements && movements.promoted) || []).forEach(m => {
            const n = niveauVon(state.clubs.find(c => c.id === m.clubId) || {});
            if (typeof n !== "number") return;
            const l = aufsteigerNiveau.get(m.fromLeague) || [];
            l.push(n);
            aufsteigerNiveau.set(m.fromLeague, l);
        });

        absteiger.forEach(m => {
            const club = state.clubs.find(c => c.id === m.clubId);
            if (!club) return;
            // Der Maßstab ist die neue Liga ohne die, die gerade von oben kommen
            const ziel = state.clubs.filter(c => c.leagueId === m.toLeague && !absteigerIds.has(c.id))
                .map(niveauVon).filter(n => typeof n === "number");
            if (!ziel.length) return;
            const grenze = ziel.reduce((a, b) => a + b, 0) / ziel.length + A.ueberNiveau;
            const vonLiga = (state.leagues || []).find(l => l.id === m.fromLeague);
            const vonStufe = vonLiga ? (vonLiga.level || 1) : 1;
            const zuGut = (club.playerIds || []).map(id => spielerNach.get(id))
                .filter(p => p && !p.leihe && (p.overall || 0) > grenze)
                .sort((a, b) => (b.overall || 0) - (a.overall || 0))
                .slice(0, A.hoechstens);
            // Ist der Absteiger nicht mehr stärker als die Aufsteiger, die seinen
            // Platz einnehmen, bleibt der Rest
            const aufsteiger = aufsteigerNiveau.get(m.toLeague);
            const halt = aufsteiger ? aufsteiger.reduce((a, b) => a + b, 0) / aufsteiger.length : null;
            const gehen = new Set();
            const genug = () => halt !== null && niveauOhne(club, gehen) <= halt;

            if (club.id === state.userClubId) {
                const gespraeche = _resolve('PlayerTalkEngine', './playerTalkEngine.js');
                zuGut.forEach(p => {
                    if (genug() || p.wechselwunsch || zufall() >= A.chance || !gespraeche) return;
                    gespraeche.wechselwunschAeussern(state, p, `Ich will weiter in der ${ligaName(m.fromLeague)} spielen.`);
                    ergebnis.wuensche.push(p.id);
                    gehen.add(p.id);
                });
                return;
            }

            zuGut.forEach(p => {
                if (genug() || zufall() >= A.chance) return;
                const preis = Math.round(transferEngine.calculateAskingPrice(p, club) * A.abloese);
                // Infrage kommt jeder KI-Verein der Liga, die der Absteiger
                // verlässt, oder einer Liga darüber - auch im Ausland
                const kaeufer = state.clubs
                    .filter(c => (c.level || 1) <= vonStufe && c.id !== state.userClubId && !absteigerIds.has(c.id))
                    .map(c => ({ c, n: niveauVon(c) }))
                    .filter(x => typeof x.n === "number" && SeasonEngine.passtZumKader(p, x.n) && (x.c.balance || 0) >= preis)
                    // Aufsteiger zuerst, dann die alte Liga, dann wer ihn am dringendsten braucht
                    .sort((a, b) => (aufsteigerIds.has(b.c.id) - aufsteigerIds.has(a.c.id))
                        || ((b.c.leagueId === m.fromLeague) - (a.c.leagueId === m.fromLeague))
                        || (a.n - b.n));
                const wahl = kaeufer[Math.floor(zufall() * Math.min(3, kaeufer.length))];
                if (!wahl) return;
                const lohn = Math.round((p.wage || 10000) * 1.1);
                const laufzeit = (p.age || 25) <= 24 ? 4 : (p.age || 25) <= 30 ? 3 : 2;
                if (transferEngine.executeTransfer(state, p.id, wahl.c.id, preis, lohn, laufzeit)) {
                    ergebnis.wechsel.push({ playerId: p.id, von: club.id, nach: wahl.c.id, abloese: preis });
                    verkaeufer.add(club.id);
                    gehen.add(p.id);
                }
            });
        });

        // Die Lücken füllen Spieler, die zur neuen Liga passen - nur bei den
        // Verkäufern, alle anderen Kader bleiben, wie sie sind
        const worldGen = _resolve('WorldGenerator', './worldGenerator.js');
        const playerGen = _resolve('PlayerGenerator', './playerGenerator.js');
        if (verkaeufer.size && worldGen && typeof worldGen.fillUpExistingSquads === 'function' && playerGen) {
            worldGen.fillUpExistingSquads(state, worldGen.getLeagues(), playerGen, {
                sizeFor: (club, voll) => verkaeufer.has(club.id) ? voll : (club.playerIds || []).length
            });
        }
        return ergebnis;
    }

    /**
     * Karriereende. Bisher begann es erst mit 32 und hing an festen
     * Stärkegrenzen ("ab 78 später, unter 55 früher") - in den Bundesligen
     * spielte so fast jeder länger, in den Amateurligen fast jeder kürzer.
     * Vor 31 verließ kaum jemand die Welt, wer ging, war im Schnitt fast 33:
     * Die Mitte alterte durch (22 bis 26 Jahre: 43 % → 29 % in drei
     * Saisons), der Altersschnitt stieg in acht Saisons von 26 auf 28.
     *
     * Jetzt beginnt es mit 31, in den Amateurligen (ab Stufe 5: Beruf,
     * Familie) mit 30, und steigt je Jahr um jeJahr. Die Stärke zählt
     * gemessen am eigenen Kader: Ein Leistungsträger (traeger Punkte über
     * dem Niveau) hängt eher ein Jahr dran, ein Ergänzungsspieler
     * (ergaenzung Punkte darunter) hört eher auf.
     */
    static KARRIEREENDE = { ab: 31, amateurAb: 30, amateurStufe: 5, jeJahr: 0.15, traeger: 3, ergaenzung: 8, bonus: 0.15, malus: 0.12, spaetestens: 38 };

    static karriereendeChance(player, niveau, stufe) {
        const K = SeasonEngine.KARRIEREENDE;
        const alter = player.age || 25;
        if (alter >= K.spaetestens) return 1;
        const beginn = (stufe || 1) >= K.amateurStufe ? K.amateurAb : K.ab;
        if (alter < beginn) return 0;
        let chance = (alter - beginn + 1) * K.jeJahr;
        if (typeof niveau === "number") {
            const klasse = player.overall || 0;
            if (klasse >= niveau + K.traeger) chance -= K.bonus;
            else if (klasse < niveau - K.ergaenzung) chance += K.malus;
        }
        return Math.max(0, Math.min(1, chance));
    }

    /** Passt ein Vereinsloser zu einem Kader dieses Niveaus? */
    static passtZumKader(player, niveau) {
        if (typeof niveau !== "number") return true;
        const s = player.overall || 0;
        return s <= niveau + SeasonEngine.FREI_UEBER_NIVEAU && s >= niveau - SeasonEngine.FREI_UNTER_NIVEAU;
    }

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
                    // Der Matchplan aus der Taktikbesprechung gilt auch, wenn
                    // das eigene Spiel ohne Livespiel berechnet wird
                    const planEngine = _resolve('MatchplanEngine', './matchplanEngine.js');
                    const plan = planEngine ? planEngine.spielOptionen(state, match) : null;
                    matchEngine.simulateFullMatch(match, homeClub, awayClub, state.players, plan ? { matchplan: plan } : {});
                    if (plan) planEngine.abschliessen(state, match);
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
        const financeEngine = _getFinanceEngine();
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

                    // Auch fremde Ligen spielen vor Zuschauern. Vorher wurden
                    // die Ticketeinnahmen nur fuer die eigene Liga verbucht,
                    // waehrend applyWeeklyCosts Gehaelter, Unterhalt und
                    // Betrieb bei allen 218 Vereinen der Welt abzog. Zweihundert
                    // Vereine zahlten damit jeden Spieltag, ohne je Eintritt
                    // einzunehmen - gemessen verlor der Median-Erstligist
                    // ausserhalb der eigenen Liga rund zwoelf Millionen je
                    // Saison, und nach einer Saison stand die Haelfte aller
                    // Erstligisten im Minus.
                    if (financeEngine && typeof financeEngine.applyMatchdayIncome === "function") {
                        financeEngine.applyMatchdayIncome(state, match);
                    }

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

        // 2b. Bauvorhaben kommen einen Spieltag voran - bei allen Vereinen
        SeasonEngine.tickAnlagen(state);

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

        // Und das Ergebnis kommt in der Kabine an. Vorher ließ ein 5:0 die
        // Mannschaft exakt so zurück wie ein 0:4.
        const dressingRoom = _resolve('DressingRoomEngine', './dressingRoomEngine.js');
        if (dressingRoom && typeof dressingRoom.processMatch === 'function') {
            const runde = (state.schedule || []).find(r => r.matchday === state.currentMatchday);
            const eigenesSpiel = runde?.matches?.find(m => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
            if (eigenesSpiel && eigenesSpiel.played) {
                state.lastDressingRoom = dressingRoom.processMatch(state, eigenesSpiel);
                // Was auf der Pressekonferenz versprochen wurde, wird jetzt abgerechnet
                const manager = _resolve('ManagerEngine', './managerEngine.js');
                if (manager && typeof manager.versprechenPruefen === 'function') {
                    manager.versprechenPruefen(state, eigenesSpiel);
                }
                // ... und was einem Spieler unter vier Augen versprochen wurde
                const gespraeche = _resolve('PlayerTalkEngine', './playerTalkEngine.js');
                if (gespraeche && typeof gespraeche.nachSpiel === 'function') {
                    gespraeche.nachSpiel(state, eigenesSpiel);
                }
                // Einsatz- und Torprämien aus den Verträgen auszahlen
                const verhandlung = _resolve('NegotiationEngine', './negotiationEngine.js');
                if (verhandlung && typeof verhandlung.zahlePraemien === 'function') {
                    verhandlung.zahlePraemien(state, eigenesSpiel);
                }
                // Die zweite Mannschaft spielt am selben Spieltag
                const reserve = _resolve('ReserveEngine', './reserveEngine.js');
                if (reserve && typeof reserve.nachSpieltag === 'function') {
                    reserve.nachSpieltag(state);
                }
                // Was gespielt wurde, sitzt danach besser
                const taktik = _resolve('TacticsEngine', './tacticsEngine.js');
                const eigenerVerein = state.clubs.find(c => c.id === state.userClubId);
                if (taktik && typeof taktik.vertrautheitUeben === 'function' && eigenerVerein) {
                    // Ein Taktiker schleift die Abläufe schneller ein
                    const profilT = _resolve('TrainerProfilEngine', './trainerProfilEngine.js');
                    taktik.vertrautheitUeben(eigenerVerein, 0.12 * (profilT ? profilT.faktor(state, "taktik", 0.25) : 1));
                }
            }
            // Die Gegner haben ebenfalls eine Kabine - sonst spielt der Nutzer
            // das ganze Jahr gegen dauerhaft bestens gelaunte Mannschaften
            if (typeof dressingRoom.settleAiClubs === 'function') {
                dressingRoom.settleAiClubs(state);
            }
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
                // Das Kennzeichen muss mit heilen. Vorher wurde nur die
                // Restdauer heruntergezaehlt, `injured` blieb fuer immer auf
                // true - und damit galt ein Spieler, der sich einmal verletzt
                // hatte, dauerhaft als verletzt: Die KI stellte ihn nie wieder
                // auf (aiManagerEngine filtert auf !injured), das Scouting
                // uebersah ihn, und die Warnung in der Aufstellung blieb
                // stehen. Nach einer halben Saison hingen so ueber 250 Spieler
                // in diesem Zustand fest.
                if (p.injuredWeeks === 0) p.injured = false;
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

        // Die Vereine untereinander handeln ebenfalls - aber nur, solange ein
        // Fenster offen ist. Ohne diesen Weg bewegte sich in der ganzen
        // Spielwelt kein einziger Spieler.
        if (transferEngine && typeof transferEngine.processAiTransferWindow === 'function'
            && typeof transferEngine.istTransferfenster === 'function'
            && transferEngine.istTransferfenster(state)) {
            transferEngine.processAiTransferWindow(state, 400);
            // ... und verleihen junge Spieler, die bei ihnen nicht spielen
            const leihen = _resolve('LoanEngine', './loanEngine.js');
            if (leihen && typeof leihen.kiLeihen === 'function') leihen.kiLeihen(state, 25);
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

                // Ein Derby kündigt sich an - das ist kein Spiel wie jedes andere
                const derbyKopf = nextMatch.isDerby
                    ? `🔥 ${nextMatch.derbyTitle}: `
                    : "";
                const derbyText = nextMatch.isDerby
                    ? `\n\nDas ist kein Spieltag wie jeder andere. Die Stadt spricht seit Wochen über nichts anderes, `
                      + `das Stadion wird voll, und die Kabine weiß genau, was auf dem Spiel steht. `
                      + `Ein Sieg trägt uns durch Wochen - eine Niederlage auch, nur andersherum.`
                    : "";

                state.inbox.unshift({
                    id: Date.now() + 5,
                    matchday: state.currentMatchday,
                    date: `Spieltag ${state.currentMatchday}`,
                    sender: "Co-Trainer",
                    subject: `${derbyKopf}Spieltag ${state.currentMatchday}: Vorbericht gegen ${opponent?.name}`,
                    body: `Am ${state.currentMatchday}. Spieltag treffen wir ${isHome ? "vor heimischer Kulisse" : "auswärts"} auf ${opponent?.name} (Tabellenplatz: ${SeasonEngine.getClubRank(state, opponentId)}).${derbyText}\n\nBereiten Sie die Mannschaft im Taktik- und Aufstellungsmenü optimal auf die Begegnung vor!`,
                    read: false,
                    type: nextMatch.isDerby ? "derby_preview" : "preview"
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

        SeasonEngine.checkJobSecurity(state, userClub, currentRank, targetRank);
    }

    /**
     * Der Vorstand macht Ernst.
     *
     * Bisher konnte das Vertrauen auf fünfundzwanzig Prozent fallen, ohne dass
     * je etwas geschah - der Balken im Kopf der Seite war reine Dekoration und
     * der Satz "Der Vorstand fordert dringend bessere Ergebnisse" eine leere
     * Drohung. Jetzt gibt es erst ein Gespräch, dann ein Ultimatum mit einer
     * klaren Frist, und wer sie verstreichen lässt, wird entlassen.
     *
     * Man muss dafür nichts verstehen: Es steht wörtlich im Postfach, was
     * verlangt wird und bis wann.
     */
    static checkJobSecurity(state, userClub, currentRank, targetRank) {
        // Wer schon entlassen ist, bekommt kein zweites Ultimatum. Solange die
        // Entscheidung über die nächste Station offen ist, ruht der Vorstand.
        if (state.managerDismissed) return;

        if (!state.jobSecurity) {
            state.jobSecurity = { stage: "ruhig", ultimatumUntil: null, ultimatumRank: null, warnedAt: null };
        }

        const lage = state.jobSecurity;
        const vertrauen = state.boardConfidence;
        const spieltag = state.currentMatchday || 1;

        // Ein laufendes Ultimatum läuft irgendwann ab
        if (lage.stage === "ultimatum" && lage.ultimatumUntil !== null) {
            if (currentRank <= lage.ultimatumRank) {
                lage.stage = "ruhig";
                lage.ultimatumUntil = null;
                SeasonEngine.boardMessage(state, "🤝 Der Vorstand stellt sich hinter Sie",
                    `Sie haben geliefert. Mit Tabellenplatz ${currentRank} haben Sie die Vorgabe erfüllt.\n\n`
                    + `Das Ultimatum ist vom Tisch. Machen Sie weiter so.`, "board_relief");
                return;
            }

            if (spieltag >= lage.ultimatumUntil) {
                lage.stage = "entlassen";
                state.managerDismissed = {
                    matchday: spieltag,
                    rank: currentRank,
                    seasonYear: state.seasonYear,
                    clubName: userClub.name
                };
                SeasonEngine.boardMessage(state, "❌ Der Vorstand beendet die Zusammenarbeit",
                    `Die gesetzte Frist ist verstrichen, ohne dass sich die sportliche Lage gebessert hat. `
                    + `Zum ${spieltag}. Spieltag steht ${userClub.name} auf Platz ${currentRank}.\n\n`
                    + `Der Vorstand hat entschieden, sich von Ihnen zu trennen. Wir danken für Ihre Arbeit.`,
                    "board_dismissal");
                return;
            }
        }

        // Vor dem sechsten Spieltag bekommt jeder Trainer Zeit
        if (spieltag < 6) return;

        // Ultimatum: Es steht wirklich schlecht
        if (vertrauen <= 28 && lage.stage !== "ultimatum") {
            const frist = Math.min(state.totalMatchdays || 34, spieltag + 5);
            const zielPlatz = Math.max(1, Math.min(currentRank - 2, targetRank + 3));

            lage.stage = "ultimatum";
            lage.ultimatumUntil = frist;
            lage.ultimatumRank = zielPlatz;

            SeasonEngine.boardMessage(state, "⏳ Ultimatum des Vorstands",
                `So kann es nicht weitergehen. ${userClub.name} steht auf Platz ${currentRank}, `
                + `erwartet war Platz ${targetRank} oder besser.\n\n`
                + `Sie haben bis zum ${frist}. Spieltag Zeit, die Mannschaft mindestens auf Platz ${zielPlatz} zu führen. `
                + `Gelingt das nicht, trennen wir uns.`, "board_ultimatum");
            return;
        }

        // Warnung: Es läuft nicht rund
        if (vertrauen <= 45 && lage.stage === "ruhig") {
            lage.stage = "warnung";
            lage.warnedAt = spieltag;
            SeasonEngine.boardMessage(state, "⚠️ Der Vorstand ist besorgt",
                `Wir haben uns die Entwicklung angesehen und sind unzufrieden. Platz ${currentRank} `
                + `entspricht nicht dem, was wir uns vorgenommen haben.\n\n`
                + `Wir erwarten in den kommenden Wochen eine deutliche Steigerung.`, "board_warning");
            return;
        }

        // Entspannung, wenn es wieder läuft
        if (vertrauen >= 62 && lage.stage === "warnung") {
            lage.stage = "ruhig";
            SeasonEngine.boardMessage(state, "👍 Der Vorstand ist wieder zufrieden",
                `Die Entwicklung stimmt wieder. Platz ${currentRank} liest sich deutlich besser.\n\n`
                + `Wir sehen der weiteren Saison gelassen entgegen.`, "board_relief");
        }
    }

    /** Kurze Nachricht des Vorstands ins Postfach */
    static boardMessage(state, subject, body, type) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: `Spieltag ${state.currentMatchday}`,
            sender: "Vorstand",
            subject,
            body,
            read: false,
            type: type || "board_message"
        });
    }

    /**
     * Saisonabschluss, Meisterehrung, Prämien und Vorbereitung der nächsten Saison
     */
    /** Bauvorhaben aller Vereine einen Spieltag weiterbringen */
    static tickAnlagen(state) {
        const fac = _resolve('FacilityEngine', './facilityEngine.js');
        if (fac && typeof fac.tickSpieltag === 'function') fac.tickSpieltag(state);
    }

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

        // Leihspieler kehren zurück, bevor Verträge und Kader abgerechnet werden
        const leihen = _resolve('LoanEngine', './loanEngine.js');
        if (leihen && typeof leihen.saisonende === 'function') {
            leihen.saisonende(state);
        }

        // Die Saison in die Karriereakte schreiben: die Bilanz der Station und,
        // wenn es dazu gereicht hat, den Meistertitel.
        const careerEngine = _resolve('CareerEngine', './careerEngine.js');
        if (careerEngine && typeof careerEngine.schliesseSaisonAb === 'function') {
            if (championEntry.clubId === state.userClubId) {
                careerEngine.vermerkeTitel(state,
                    `Meisterschaft ${state.leagueName || "Liga"}`, state.seasonYear);
            }
            careerEngine.schliesseSaisonAb(state);
        }

        // Der Trainer wächst mit seinen Aufgaben: Titel, eingebaute Talente,
        // eingespielte Taktik, viele Transfers, viele Gespräche
        const trainerProfil = _resolve('TrainerProfilEngine', './trainerProfilEngine.js');
        if (trainerProfil && typeof trainerProfil.saisonende === 'function') {
            const eigener = state.clubs.find(c => c.id === state.userClubId);
            const kader = state.players.filter(p => eigener && eigener.playerIds.includes(p.id));
            const taktikE = _resolve('TacticsEngine', './tacticsEngine.js');
            trainerProfil.saisonende(state, {
                titel: championEntry.clubId === state.userClubId ? 1 : 0,
                talente: kader.filter(p => (p.age || 30) <= 21 && (p.stats?.matches || 0) >= 10).length,
                vertrautheit: taktikE && typeof taktikE.vertrautheit === 'function' && eigener ? taktikE.vertrautheit(eigener) : 0,
                transfers: kader.filter(p => typeof p.vereinSeit === 'number' && Math.floor(p.vereinSeit / 1000) === (state.seasonYear || 1)).length,
                gespraeche: kader.filter(p => p.gespraech?.letztes && Math.floor(p.gespraech.letztes / 1000) === (state.seasonYear || 1)).length
            });
        }

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

        // Der Verband zieht Bilanz, falls der Manager eine Nation betreut
        const national = _resolve('NationalTeamEngine', './nationalTeamEngine.js');
        if (national && typeof national.saisonBilanz === 'function') national.saisonBilanz(state);

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
        let ohneVerein = 0;
        // Stärke gemessen am eigenen Kader, Stufe der eigenen Liga
        const contractEngine = _getContractEngine();
        const niveau = contractEngine && typeof contractEngine.niveauKarte === 'function'
            ? contractEngine.niveauKarte(state) : new Map();
        const stufe = new Map((state.clubs || []).map(c => [c.id, c.level || 1]));
        state.players.forEach(player => {
            // Wer eine ganze Saison ohne Verein war, verlässt den Profifußball.
            // Bisher blieb jeder Vereinslose für immer in der Welt: Nach fünf
            // Saisons waren es 584, die meisten jung und zu schwach für jeden
            // Verein, der sie hätte brauchen können.
            if (!player.clubId) {
                if (typeof player.vereinslosAb !== "number") player.vereinslosAb = state.seasonYear;
                const frist = (player.age || 25) <= SeasonEngine.VEREINSLOS_TALENT_ALTER ? 2 : 1;
                if (player.vereinslosAb <= (state.seasonYear || 0) - frist) {
                    abschied.push(player);
                    ohneVerein++;
                    return;
                }
            }
            const chance = SeasonEngine.karriereendeChance(player, niveau.get(player.clubId), stufe.get(player.clubId));
            if (chance > 0 && Math.random() < chance) abschied.push(player);
        });

        if (abschied.length === 0) return { retired: 0, names: [], ohneVerein: 0 };

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

        return { retired: abschied.length, names: abschied.map(p => p.name), ohneVerein };
    }

    static processContractExpiries(state) {
        const abgaenge = [];
        const eigeneAbgaenge = [];

        // Jeder Verein misst an seinem eigenen Kader, wen er hält und wen er
        // holt (ContractEngine.vereinsNiveau) - gemessen vor den Abgängen
        const contractEngine = _getContractEngine();
        const niveau = contractEngine && typeof contractEngine.niveauKarte === 'function'
            ? contractEngine.niveauKarte(state) : new Map();

        state.players.forEach(player => {
            if ((player.contractYears || 0) > 0) return;
            if (!player.clubId) { abgaenge.push(player); return; }

            const club = state.clubs.find(c => c.id === player.clubId);
            if (!club) {
                player.clubId = null;
                player.vereinslosAb = state.seasonYear;
                abgaenge.push(player);
                return;
            }

            const istNutzerverein = club.id === state.userClubId;

            if (!istNutzerverein) {
                if (Math.random() < SeasonEngine.haltequote(player, niveau.get(club.id))) {
                    player.contractYears = 1 + Math.floor(Math.random() * 3);
                    return;
                }
            }

            club.playerIds = (club.playerIds || []).filter(id => id !== player.id);
            club.lineup = (club.lineup || []).filter(id => id !== player.id);
            club.bench = (club.bench || []).filter(id => id !== player.id);
            player.clubId = null;
            player.contractYears = 0;
            player.vereinslosAb = state.seasonYear;

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
            frei.sort((a, b) => (b.overall || 0) - (a.overall || 0));

            // Geholt wird, wer zum Kader passt: nicht viel stärker - der
            // spielt lieber eine Liga höher - und nicht viel schwächer. Bisher
            // hing die Obergrenze am Ruf und lag selbst in der Landesliga bei
            // rund 50, und fand sich darunter niemand, nahm der Verein den
            // Besten, der übrig war. So stiegen Vereinslose aus höheren Ligen
            // ab und machten die unteren Ligen Saison für Saison stärker.
            // Was der Markt nicht hergibt, kommt aus dem Nachwuchs.
            const n = niveau.get(club.id);
            const greifen = (filter) => {
                const idx = frei.findIndex(p => filter(p) && SeasonEngine.passtZumKader(p, n));
                return idx >= 0 ? frei.splice(idx, 1)[0] : null;
            };

            const untergrenze = club.id === state.userClubId ? 0 : reserve;
            while (fehlend > 0 && frei.length > untergrenze) {
                const pos = gesucht.shift();
                const gewaehlt = pos
                    ? (greifen(p => p.pos === pos) || greifen(p => (p.positions || []).includes(pos)) || greifen(() => true))
                    : greifen(() => true);
                if (!gewaehlt) break;

                gewaehlt.clubId = club.id;
                delete gewaehlt.vereinslosAb;
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
                mindestJugend: SeasonEngine.MINDEST_JUGEND
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

        // Neue Saison, neue freie Posten bei den Nationalmannschaften - wer
        // genug Ruf hat, bekommt vielleicht ein Angebot
        const nationalEngine = _resolve('NationalTeamEngine', './nationalTeamEngine.js');
        if (nationalEngine && typeof nationalEngine.pruefeAngebot === 'function') nationalEngine.pruefeAngebot(state);

        // Wer sich zum Star entwickelt hat, bekommt seine Signatur - die
        // Anteile je Liga werden neu aufgefüllt, bestehende bleiben
        const eigenschaften = _resolve('EigenschaftenEngine', './eigenschaftenEngine.js');
        if (eigenschaften && typeof eigenschaften.vergebeSignaturen === 'function') eigenschaften.vergebeSignaturen(state);

        const gameState = _getGameState();

        // Auf- und Abstieg über die gesamte Ligapyramide abwickeln
        const competitionEngine = _resolve('CompetitionEngine', './competitionEngine.js');

        let movements = { promoted: [], relegated: [] };
        if (competitionEngine && typeof competitionEngine.processSeasonEndPromotionsRelegations === 'function') {
            movements = competitionEngine.processSeasonEndPromotionsRelegations(state);
        }
        // Wer für die neue Liga zu gut ist, bleibt nicht unbedingt
        SeasonEngine.abstiegsfolgen(state, movements);

        // Europapokal aus den Abschlusstabellen der fünf Topligen neu besetzen
        if (competitionEngine && typeof competitionEngine.generateEuropeanCompetitions === 'function') {
            state.europeanCompetitions = competitionEngine.generateEuropeanCompetitions(state.clubs, {
                leagues: state.leagues,
                standingsByLeague: state.standingsByLeague
            });
        }

        // Die Anlagen werden ein Jahr aelter. Wer nie saniert, steht
        // irgendwann mit einem grossen, maroden Stadion da.
        const facilityEngine = _resolve('FacilityEngine', './facilityEngine.js');
        if (facilityEngine && typeof facilityEngine.saisonwechsel === 'function') {
            facilityEngine.saisonwechsel(state);
        }

        // Auf- und Absteiger haben ueber Nacht eine andere Wirtschaftskraft.
        //
        // Ein Absteiger kann die Bundesligagehaelter nicht weiterzahlen, ein
        // Aufsteiger muss mehr bieten. Ohne diesen Abgleich schleppte ein
        // Absteiger seine alte Gehaltsliste in eine Liga mit einem Drittel der
        // Einnahmen und war binnen einer Saison zahlungsunfaehig.
        const finanzenGehalt = _getFinanceEngine();
        if (finanzenGehalt && typeof finanzenGehalt.normalisiereGehaelter === 'function') {
            const gewechselt = (movements?.promoted || []).concat(movements?.relegated || [])
                .map(m => state.clubs.find(c => c.id === (m.clubId || m.id || m)))
                .filter(Boolean);
            if (gewechselt.length) finanzenGehalt.normalisiereGehaelter(state, gewechselt);
        }

        // Pokal neu auslosen und den europäischen Wettbewerben ihren Spielplan
        // geben - sonst stünden auch in der neuen Saison nur Teilnehmerlisten
        // ohne eine einzige Partie im Speicher.
        const cupEngine = _resolve('CupEngine', './cupEngine.js');
        if (cupEngine && typeof cupEngine.starteSaison === 'function') {
            cupEngine.starteSaison(state);
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

        // Die Vorbereitung beginnt: Trainerstab, Sponsoren, Testspiele. Sie
        // steht vor jeder Saison, nicht nur vor der ersten.
        const preseasonEngine = (typeof PreseasonEngine !== "undefined" && PreseasonEngine)
            ? PreseasonEngine
            : ((typeof window !== "undefined" && window.PreseasonEngine) ? window.PreseasonEngine
                : (typeof require !== "undefined" ? require("./preseasonEngine.js").PreseasonEngine : null));
        if (preseasonEngine && typeof preseasonEngine.start === "function") {
            preseasonEngine.start(state);
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

        // Neue Jugendspieler kommen nicht mehr zum Saisonstart, sondern am
        // Jugendtag im Frühjahr (YouthEngine.pruefeJugendtag). Die Liste der
        // eigenen Talente wird hier nur zusammengeführt.
        const youthEngine = _getYouthEngine();
        if (youthEngine && typeof youthEngine.eigeneTalente === 'function') {
            youthEngine.eigeneTalente(state);
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
