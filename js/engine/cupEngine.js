/**
 * CupEngine - Pokal und Europapokal, die auch stattfinden
 *
 * Bisher gab es beides nur auf dem Papier: Der Wettbewerbsreiter bot
 * "Deutschland Pokal", "Champions League", "Europa League" und "Conference
 * League" an, die Teilnehmer standen fest - aber gemessen über eine ganze
 * Saison wurde keine einzige Partie ausgetragen. Siebzig angelegte
 * Pokalspiele, null gespielt. Zwanzig Mannschaften in der Champions League,
 * null Partien. Und kein einziger von 230 Kalendertagen gehörte einem dieser
 * Wettbewerbe.
 *
 * Diese Engine macht daraus Wettbewerbe: ein K.-o.-Turnier im Pokal, eine
 * Gruppenphase mit anschließender Endrunde in Europa, Prämien für jede
 * erreichte Runde, Auslosungen und ein Sieger am Ende.
 */

function _cupResolve(name, pfad) {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

const _cupRandom = (typeof Random !== "undefined" && Random)
    ? Random
    : ((typeof require !== "undefined") ? require("../core/random.js").Random : {
        int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        chance: prob => Math.random() < prob
    });

class CupEngine {
    /** So viele Vereine spielen den Landespokal aus */
    static POKAL_TEILNEHMER = 64;

    /**
     * Die Runden des Pokals, von der ersten bis zum Endspiel.
     */
    static POKAL_RUNDEN = [
        { name: "1. Runde", teams: 64 },
        { name: "2. Runde", teams: 32 },
        { name: "Achtelfinale", teams: 16 },
        { name: "Viertelfinale", teams: 8 },
        { name: "Halbfinale", teams: 4 },
        { name: "Finale", teams: 2 }
    ];

    /** Die Endrunde in Europa - acht Mannschaften, drei Runden */
    static EURO_ENDRUNDE = [
        { name: "Viertelfinale", teams: 8 },
        { name: "Halbfinale", teams: 4 },
        { name: "Finale", teams: 2 }
    ];

    /**
     * Wann im Saisonverlauf gespielt wird.
     *
     * Die Termine liegen unter der Woche zwischen den Ligaspieltagen - so
     * entstehen englische Wochen, in denen der Kader wirklich Breite braucht.
     */
    static TERMINPLAN = [
        { nachSpieltag: 2, art: "cup", runde: 0 },
        { nachSpieltag: 4, art: "euro", runde: 0 },
        { nachSpieltag: 6, art: "euro", runde: 1 },
        { nachSpieltag: 7, art: "cup", runde: 1 },
        { nachSpieltag: 9, art: "euro", runde: 2 },
        { nachSpieltag: 12, art: "cup", runde: 2 },
        { nachSpieltag: 14, art: "euro", runde: 3 },
        { nachSpieltag: 16, art: "euro", runde: 4 },
        { nachSpieltag: 18, art: "cup", runde: 3 },
        { nachSpieltag: 20, art: "euro", runde: 5 },
        { nachSpieltag: 24, art: "cup", runde: 4 },
        { nachSpieltag: 26, art: "euro", runde: 6 },
        { nachSpieltag: 28, art: "euro", runde: 7 },
        { nachSpieltag: 30, art: "cup", runde: 5 },
        { nachSpieltag: 32, art: "euro", runde: 8 }
    ];

    /** Prämien je erreichter Runde, gemessen an der Wirtschaftskraft der Liga */
    static POKAL_PRAEMIE = [180000, 300000, 600000, 1200000, 2500000, 5000000];
    static EURO_PRAEMIE = {
        ucl: { gruppe: 2200000, vf: 9000000, hf: 14000000, finale: 20000000, sieg: 28000000 },
        uel: { gruppe: 700000, vf: 2800000, hf: 4500000, finale: 7000000, sieg: 11000000 },
        uecl: { gruppe: 350000, vf: 1300000, hf: 2200000, finale: 3400000, sieg: 5500000 }
    };

    // ----------------------------------------------------------- Aufsetzen

    /**
     * Setzt Pokal und Europapokal für eine Saison auf.
     *
     * Wird beim Karrierestart und bei jedem Saisonwechsel gerufen. Die
     * Teilnehmer Europas stehen zu diesem Zeitpunkt schon fest - sie kommen
     * aus den Abschlusstabellen der Vorsaison.
     */
    static starteSaison(state) {
        if (!state || !Array.isArray(state.clubs)) return;

        this.setzePokalAn(state);
        this.setzeEuropaAn(state);
    }

    /**
     * Der Landespokal: die stärksten Vereine des eigenen Landes, dazu der
     * eigene Verein - auch wenn er aus der Kreisliga kommt.
     */
    static setzePokalAn(state) {
        const eigener = state.clubs.find(c => c.id === state.userClubId);
        const land = eigener?.countryId || eigener?.country || null;

        const imLand = state.clubs.filter(c =>
            !land || c.countryId === land || c.country === land);
        const pool = (imLand.length >= 16 ? imLand : state.clubs).slice();

        pool.sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
        let teilnehmer = pool.slice(0, this.POKAL_TEILNEHMER).map(c => c.id);

        // Der eigene Verein ist immer dabei - sonst ist der Pokal für den
        // Spieler eines kleinen Vereins wieder nur Kulisse.
        if (state.userClubId && !teilnehmer.includes(state.userClubId)) {
            teilnehmer[teilnehmer.length - 1] = state.userClubId;
        }

        state.cups = state.cups || {};
        state.cups.de_cup = {
            id: "de_cup",
            name: this.pokalName(state),
            type: "cup",
            teilnehmer,
            rundenIndex: 0,
            runden: [this.loseAus(teilnehmer, this.POKAL_RUNDEN[0].name, "de_cup", 1)],
            ausgeschieden: [],
            completed: false,
            winnerId: null
        };
    }

    static pokalName(state) {
        const eigener = state.clubs.find(c => c.id === state.userClubId);
        const land = eigener?.countryId || eigener?.country;
        const namen = {
            de: "DFB-Pokal", en: "FA Cup", es: "Copa del Rey",
            it: "Coppa Italia", fr: "Coupe de France"
        };
        return namen[land] || "Landespokal";
    }

    /** Eine Runde auslosen */
    static loseAus(teilnehmer, rundenName, wettbewerbId, rundenNummer) {
        const gemischt = [...teilnehmer].sort(() => 0.5 - Math.random());
        const matches = [];

        for (let i = 0; i + 1 < gemischt.length; i += 2) {
            matches.push({
                id: `m_${wettbewerbId}_r${rundenNummer}_${matches.length + 1}`,
                competitionId: wettbewerbId,
                roundName: rundenName,
                roundNumber: rundenNummer,
                homeClubId: gemischt[i],
                awayClubId: gemischt[i + 1],
                played: false,
                homeGoals: null,
                awayGoals: null,
                isCup: true,
                penaltyWinner: null
            });
        }

        return { roundName: rundenName, roundNumber: rundenNummer, completed: false, matches };
    }

    /**
     * Europa: aus den Teilnehmerlisten werden Gruppen mit echtem Spielplan.
     *
     * Vorher gab es Gruppen mit Tabellen, in denen alles auf null stand - es
     * fehlte schlicht der Spielplan.
     */
    static setzeEuropaAn(state) {
        const comp = _cupResolve("CompetitionEngine", "./competitionEngine.js");
        if (!state.europeanCompetitions && comp && typeof comp.generateEuropeanCompetitions === "function") {
            state.europeanCompetitions = comp.generateEuropeanCompetitions(state.clubs, {
                leagues: state.leagues,
                standingsByLeague: state.standingsByLeague
            });
        }
        const ec = state.europeanCompetitions || {};

        Object.keys(ec).forEach(id => {
            const wettbewerb = ec[id];
            if (!wettbewerb || !Array.isArray(wettbewerb.groups)) return;

            wettbewerb.spieltage = this.baueGruppenSpieltage(wettbewerb, id);
            wettbewerb.spieltagIndex = 0;
            wettbewerb.endrunde = [];
            wettbewerb.endrundeIndex = 0;
            wettbewerb.phase = "gruppe";
            wettbewerb.completed = false;
            wettbewerb.winnerId = null;

            // Tabellen auf null zurücksetzen
            wettbewerb.groups.forEach(g => {
                g.standings = (g.teams || []).map(tid => ({
                    clubId: tid, played: 0, won: 0, drawn: 0, lost: 0,
                    goalsFor: 0, goalsAgainst: 0, points: 0
                }));
            });
        });
    }

    /**
     * Sechs Gruppenspieltage: jeder gegen jeden, hin und zurück.
     */
    static baueGruppenSpieltage(wettbewerb, id) {
        const paarungen = [
            [[0, 1], [2, 3]],
            [[3, 0], [1, 2]],
            [[0, 2], [1, 3]]
        ];

        const spieltage = [];
        for (let durchgang = 0; durchgang < 2; durchgang++) {
            paarungen.forEach((runde, idx) => {
                const matches = [];
                (wettbewerb.groups || []).forEach((g, gi) => {
                    runde.forEach(([a, b]) => {
                        const heim = durchgang === 0 ? g.teams[a] : g.teams[b];
                        const gast = durchgang === 0 ? g.teams[b] : g.teams[a];
                        if (!heim || !gast) return;
                        matches.push({
                            id: `m_${id}_g${durchgang * 3 + idx + 1}_${gi}_${matches.length}`,
                            competitionId: id,
                            roundName: `Gruppenspieltag ${durchgang * 3 + idx + 1}`,
                            groupName: g.groupName,
                            homeClubId: heim,
                            awayClubId: gast,
                            played: false,
                            homeGoals: null,
                            awayGoals: null,
                            isCup: false
                        });
                    });
                });
                spieltage.push({
                    roundName: `Gruppenspieltag ${durchgang * 3 + idx + 1}`,
                    completed: false,
                    matches
                });
            });
        }
        return spieltage;
    }

    // -------------------------------------------------------- Runde spielen

    /**
     * Spielt den Termin, der an diesem Kalendertag ansteht.
     *
     * Ist der eigene Verein beteiligt, bleibt seine Partie ungespielt - die
     * übernimmt die Live-Simulation wie einen Ligaspieltag.
     */
    static spieleTermin(state, art, rundenIndex) {
        if (art === "cup") return this.spielePokalrunde(state, rundenIndex);
        return this.spieleEuropaTermin(state, rundenIndex);
    }

    /** Den Termin abschließen - Sieger, Prämien, nächste Auslosung */
    static schliesseTerminAb(state, art, rundenIndex) {
        if (art === "cup") return this.schliessePokalrundeAb(state);
        return this.schliesseEuropaTerminAb(state, rundenIndex);
    }

    /**
     * Die eigene Partie an diesem Termin - ohne irgendetwas auszutragen.
     *
     * Der Kalender und der Weiter-Knopf müssen vorher wissen, ob der Manager
     * an diesem Abend selbst gefordert ist.
     */
    static eigenePartieAm(state, art, rundenIndex) {
        if (!state || !state.userClubId) return null;
        const meine = m => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId;

        if (art === "cup") {
            const cup = state.cups?.de_cup;
            if (!cup || cup.completed) return null;
            const runde = cup.runden[cup.rundenIndex];
            if (!runde || runde.completed) return null;
            const partie = runde.matches.find(m => !m.played && meine(m));
            return partie ? { partie, runde, wettbewerb: cup, ko: true } : null;
        }

        const ec = state.europeanCompetitions || {};
        for (const id of Object.keys(ec)) {
            const w = ec[id];
            if (!w || w.completed) continue;
            const runde = rundenIndex < 6
                ? (w.spieltage || [])[rundenIndex]
                : (w.endrunde || [])[rundenIndex - 6];
            if (!runde || runde.completed) continue;
            const partie = runde.matches.find(m => !m.played && meine(m));
            if (partie) return { partie, runde, wettbewerb: w, ko: rundenIndex >= 6 };
        }
        return null;
    }

    /** Die aktuelle Pokalrunde */
    static aktuellePokalrunde(state) {
        const cup = state.cups?.de_cup;
        if (!cup || cup.completed) return null;
        return cup.runden[cup.rundenIndex] || null;
    }

    static spielePokalrunde(state) {
        const cup = state.cups?.de_cup;
        if (!cup || cup.completed) return null;

        const runde = cup.runden[cup.rundenIndex];
        if (!runde || runde.completed) return null;

        const offen = runde.matches.filter(m => !m.played);
        const eigene = offen.find(m =>
            m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);

        offen.forEach(m => {
            if (m === eigene) return;   // die spielt der Manager selbst
            this.austragen(state, m, true);
        });

        return { art: "cup", runde, eigenePartie: eigene || null, wettbewerb: cup };
    }

    /**
     * Wenn alle Partien einer Pokalrunde gespielt sind: Sieger ermitteln,
     * Prämien zahlen, nächste Runde auslosen.
     */
    static schliessePokalrundeAb(state) {
        const cup = state.cups?.de_cup;
        if (!cup || cup.completed) return null;

        const runde = cup.runden[cup.rundenIndex];
        if (!runde || runde.matches.some(m => !m.played)) return null;

        runde.completed = true;
        const sieger = runde.matches.map(m => this.siegerVon(m));
        const verlierer = runde.matches.map(m =>
            this.siegerVon(m) === m.homeClubId ? m.awayClubId : m.homeClubId);
        cup.ausgeschieden.push(...verlierer);

        // Prämie für das Erreichen der nächsten Runde
        const praemie = this.POKAL_PRAEMIE[cup.rundenIndex] || 0;
        sieger.forEach(id => this.zahlePraemie(state, id, praemie,
            `${cup.name}: ${runde.roundName} überstanden`));

        if (sieger.length === 1) {
            cup.completed = true;
            cup.winnerId = sieger[0];
            this.meldeSieger(state, cup.name, sieger[0], cup.rundenIndex);
            return { fertig: true, sieger: sieger[0] };
        }

        cup.rundenIndex++;
        const naechste = this.POKAL_RUNDEN[cup.rundenIndex];
        cup.runden.push(this.loseAus(sieger, naechste ? naechste.name : `Runde ${cup.rundenIndex + 1}`,
            "de_cup", cup.rundenIndex + 1));

        if (sieger.includes(state.userClubId)) {
            this.postfach(state, `🏆 ${cup.name}: Weiter in die nächste Runde`,
                `${runde.roundName} überstanden. Die Auslosung für `
                + `${naechste ? naechste.name : "die nächste Runde"} ist erfolgt.`);
        } else if (cup.ausgeschieden.includes(state.userClubId)) {
            const wo = this.rundeIm(runde.roundName);
            this.postfach(state, `${cup.name}: Aus ${wo}`,
                `Das Pokalabenteuer ist ${wo} beendet.`);
        }

        return { fertig: false, runde: cup.rundenIndex };
    }

    /** Ein europäischer Termin: Gruppenspieltag oder Endrunde */
    static spieleEuropaTermin(state, index) {
        const ec = state.europeanCompetitions || {};
        const ergebnisse = [];
        let eigenePartie = null;

        Object.keys(ec).forEach(id => {
            const w = ec[id];
            if (!w || w.completed) return;

            const runde = index < 6
                ? (w.spieltage || [])[index]
                : (w.endrunde || [])[index - 6];
            if (!runde || runde.completed) return;

            const offen = runde.matches.filter(m => !m.played);
            const meine = offen.find(m =>
                m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
            if (meine) eigenePartie = meine;

            offen.forEach(m => {
                if (m === meine) return;
                this.austragen(state, m, index >= 6);
            });

            ergebnisse.push({ id, runde });
        });

        return { art: "euro", ergebnisse, eigenePartie, index };
    }

    /**
     * Nach einem europäischen Termin: Tabellen fortschreiben, und wenn die
     * Gruppenphase vorbei ist, die Endrunde besetzen.
     */
    static schliesseEuropaTerminAb(state, index) {
        const ec = state.europeanCompetitions || {};

        Object.keys(ec).forEach(id => {
            const w = ec[id];
            if (!w || w.completed) return;

            const runde = index < 6
                ? (w.spieltage || [])[index]
                : (w.endrunde || [])[index - 6];
            // Ohne diese Abfrage würde ein zweiter Aufruf - etwa wenn der
            // Manager seine Partie live spielt und der Kalender danach den Tag
            // weiterschaltet - die Gruppentabellen ein zweites Mal
            // fortschreiben.
            if (!runde || runde.completed || runde.matches.some(m => !m.played)) return;
            runde.completed = true;

            if (index < 6) {
                this.schreibeGruppenTabellen(w, runde);
                if (index === 5) this.besetzeEndrunde(state, w, id);
                return;
            }

            // Endrunde: Sieger kommen weiter
            const sieger = runde.matches.map(m => this.siegerVon(m));
            const stufe = ["vf", "hf", "finale"][index - 6] || "finale";
            const praemien = this.EURO_PRAEMIE[id] || this.EURO_PRAEMIE.uecl;
            sieger.forEach(cid => this.zahlePraemie(state, cid, praemien[stufe] || 0,
                `${w.name}: ${runde.roundName} gewonnen`));

            if (sieger.length === 1) {
                w.completed = true;
                w.winnerId = sieger[0];
                this.zahlePraemie(state, sieger[0], praemien.sieg || 0, `${w.name} gewonnen`);
                this.meldeSieger(state, w.name, sieger[0], 99);
                return;
            }

            w.endrundeIndex++;
            const naechste = this.EURO_ENDRUNDE[w.endrundeIndex];
            w.endrunde.push(this.loseAus(sieger,
                naechste ? naechste.name : "Finale", id, 100 + w.endrundeIndex));
        });
    }

    static schreibeGruppenTabellen(wettbewerb, runde) {
        runde.matches.forEach(m => {
            const gruppe = (wettbewerb.groups || []).find(g => g.groupName === m.groupName);
            if (!gruppe) return;
            const heim = gruppe.standings.find(s => s.clubId === m.homeClubId);
            const gast = gruppe.standings.find(s => s.clubId === m.awayClubId);
            if (!heim || !gast) return;

            heim.played++; gast.played++;
            heim.goalsFor += m.homeGoals; heim.goalsAgainst += m.awayGoals;
            gast.goalsFor += m.awayGoals; gast.goalsAgainst += m.homeGoals;

            if (m.homeGoals > m.awayGoals) { heim.won++; gast.lost++; heim.points += 3; }
            else if (m.homeGoals < m.awayGoals) { gast.won++; heim.lost++; gast.points += 3; }
            else { heim.drawn++; gast.drawn++; heim.points++; gast.points++; }
        });

        (wettbewerb.groups || []).forEach(g => {
            g.standings.sort((a, b) =>
                b.points - a.points
                || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
                || b.goalsFor - a.goalsFor);
        });
    }

    /** Die acht Besten der Gruppenphase spielen die Endrunde aus */
    static besetzeEndrunde(state, wettbewerb, id) {
        const kandidaten = [];
        (wettbewerb.groups || []).forEach(g => {
            g.standings.slice(0, 2).forEach((s, platz) => {
                kandidaten.push({ clubId: s.clubId, punkte: s.points, platz, diff: s.goalsFor - s.goalsAgainst });
            });
        });

        kandidaten.sort((a, b) => a.platz - b.platz || b.punkte - a.punkte || b.diff - a.diff);
        const acht = kandidaten.slice(0, 8).map(k => k.clubId);

        const praemien = this.EURO_PRAEMIE[id] || this.EURO_PRAEMIE.uecl;
        acht.forEach(cid => this.zahlePraemie(state, cid, praemien.gruppe || 0,
            `${wettbewerb.name}: Gruppenphase überstanden`));

        wettbewerb.phase = "endrunde";
        wettbewerb.endrunde = [this.loseAus(acht, "Viertelfinale", id, 100)];
        wettbewerb.endrundeIndex = 0;

        if (acht.includes(state.userClubId)) {
            this.postfach(state, `⭐ ${wettbewerb.name}: Viertelfinale erreicht`,
                `Die Gruppenphase ist überstanden. Es geht in die Endrunde der letzten acht.`);
        } else if ((wettbewerb.participants || []).includes(state.userClubId)) {
            this.postfach(state, `${wettbewerb.name}: Aus in der Gruppenphase`,
                `Die Gruppenphase ist beendet - für uns geht es nicht weiter.`);
        }
    }

    // ------------------------------------------------------------- Bausteine

    /** Eine Partie austragen. K.-o.-Spiele brauchen einen Sieger. */
    static austragen(state, match, koSpiel) {
        const matchEngine = _cupResolve("MatchEngine", "./matchEngine.js");
        const heim = state.clubs.find(c => c.id === match.homeClubId);
        const gast = state.clubs.find(c => c.id === match.awayClubId);
        if (!matchEngine || !heim || !gast) return null;

        matchEngine.simulateFullMatch(match, heim, gast, state.players);

        if (koSpiel && match.homeGoals === match.awayGoals) {
            this.elfmeterschiessen(state, match);
        }

        // Pokalpartien blähen den Spielstand sonst genauso auf wie Ligaspiele
        const eigenes = match.homeClubId === state.userClubId || match.awayClubId === state.userClubId;
        if (typeof matchEngine.compactPlayedMatch === "function") {
            matchEngine.compactPlayedMatch(match, eigenes);
        }
        return match;
    }

    /**
     * Elfmeterschießen.
     *
     * Ein K.-o.-Spiel, das unentschieden endet, braucht einen Sieger - und ein
     * Münzwurf wäre keiner. Hier schießt jede Mannschaft fünf Elfmeter, danach
     * geht es weiter, bis eine Entscheidung fällt. Wie oft getroffen wird,
     * hängt an den Schützen und am Torwart: Wer die besseren Nerven und den
     * besseren Abschluss hat, trifft häufiger. Der Ausgang steht in
     * `match.penaltyScore` und wird im Spielbericht angezeigt.
     */
    static elfmeterschiessen(state, match) {
        const quote = clubId => {
            const club = (state.clubs || []).find(c => c.id === clubId);
            if (!club) return 0.76;

            const kader = (club.playerIds || [])
                .map(id => (state.players || []).find(p => p.id === id))
                .filter(Boolean);

            const schuetzen = kader.filter(p => p.pos !== "TW")
                .map(p => ((p.shooting || p.finishing || 55) + (p.composure || p.mental || 55)) / 2)
                .sort((a, b) => b - a)
                .slice(0, 5);
            const torwart = kader.find(p => p.pos === "TW");

            const schnitt = schuetzen.length
                ? schuetzen.reduce((s, v) => s + v, 0) / schuetzen.length
                : 60;
            // Gegner-Torwart drückt die Quote, der eigene Abschluss hebt sie
            return { schnitt, keeper: torwart ? (torwart.reflexes || torwart.goalkeeping || 60) : 60 };
        };

        const heim = quote(match.homeClubId);
        const gast = quote(match.awayClubId);

        // Real trifft etwa jeder vierte Schütze nicht
        const trefferChance = (schuetze, keeper) =>
            Math.min(0.92, Math.max(0.55, 0.76 + (schuetze.schnitt - 62) * 0.004 - (keeper.keeper - 62) * 0.003));

        const chanceHeim = trefferChance(heim, gast);
        const chanceGast = trefferChance(gast, heim);

        let toreHeim = 0;
        let toreGast = 0;

        for (let i = 0; i < 5; i++) {
            if (_cupRandom.chance(chanceHeim)) toreHeim++;
            if (_cupRandom.chance(chanceGast)) toreGast++;
        }
        // Sudden Death, bis eine Runde den Unterschied macht
        let runden = 0;
        while (toreHeim === toreGast && runden < 15) {
            runden++;
            const h = _cupRandom.chance(chanceHeim);
            const g = _cupRandom.chance(chanceGast);
            if (h) toreHeim++;
            if (g) toreGast++;
        }
        if (toreHeim === toreGast) toreHeim++;   // Notbremse gegen Endlosschleifen

        match.penaltyScore = [toreHeim, toreGast];
        match.penaltyWinner = toreHeim > toreGast ? match.homeClubId : match.awayClubId;
        return match.penaltyWinner;
    }

    /** Wer ist weiter? */
    static siegerVon(match) {
        if (match.penaltyWinner) return match.penaltyWinner;
        if ((match.homeGoals || 0) > (match.awayGoals || 0)) return match.homeClubId;
        if ((match.homeGoals || 0) < (match.awayGoals || 0)) return match.awayClubId;
        return match.homeClubId;
    }

    static zahlePraemie(state, clubId, betrag, zweck) {
        if (!betrag) return;
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return;
        club.balance = (club.balance || 0) + betrag;
        club.transferBudget = (club.transferBudget || 0) + Math.round(betrag * 0.5);

        const finance = _cupResolve("FinanceEngine", "./financeEngine.js");
        if (finance && typeof finance.recordTransaction === "function") {
            finance.recordTransaction(state, clubId, "prize_money", betrag, zweck);
        }
    }

    /**
     * "Aus im Achtelfinale", aber "Aus in der 2. Runde" - die Runden haben
     * verschiedene Geschlechter, und ein falscher Artikel fällt sofort auf.
     */
    static rundeIm(name) {
        return /finale$/i.test(name || "") ? `im ${name}` : `in der ${name}`;
    }

    static meldeSieger(state, wettbewerb, clubId, rundenIndex) {
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return;
        const eigener = clubId === state.userClubId;

        // Ein Titel gehört in die Karriereakte - er entscheidet später mit,
        // wer sich nach einer Entlassung meldet.
        if (eigener) {
            const career = _cupResolve("CareerEngine", "./careerEngine.js");
            if (career && typeof career.vermerkeTitel === "function") {
                career.vermerkeTitel(state, wettbewerb, state.seasonYear);
            }
        }

        this.postfach(state,
            eigener ? `🏆 ${wettbewerb} gewonnen!` : `${wettbewerb}: ${club.name} ist Sieger`,
            eigener
                ? `Der Titel geht an uns. Ein Abend, den im Verein niemand vergisst.`
                : `${club.name} hat den Wettbewerb gewonnen.`);
    }

    static postfach(state, betreff, text) {
        if (!Array.isArray(state.inbox)) return;
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday || 0,
            date: `Spieltag ${state.currentMatchday || 0}`,
            sender: "Wettbewerbsleitung",
            subject: betreff,
            body: text,
            read: false,
            type: "competition"
        });
    }

    /**
     * Ist der eigene Verein in diesem Wettbewerb noch dabei?
     */
    static nochDabei(state, wettbewerbId) {
        if (wettbewerbId === "de_cup") {
            const cup = state.cups?.de_cup;
            if (!cup) return false;
            return cup.teilnehmer.includes(state.userClubId)
                && !cup.ausgeschieden.includes(state.userClubId);
        }
        const w = state.europeanCompetitions?.[wettbewerbId];
        if (!w) return false;
        if (w.phase === "gruppe") return (w.participants || []).includes(state.userClubId);
        const letzte = (w.endrunde || [])[w.endrundeIndex];
        return !!(letzte && letzte.matches.some(m =>
            m.homeClubId === state.userClubId || m.awayClubId === state.userClubId));
    }
}

if (typeof window !== "undefined") {
    window.CupEngine = CupEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { CupEngine };
}
