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

    /**
     * Die Endrunde in Europa - sechzehn Mannschaften, vier Runden.
     *
     * Bisher kamen nur acht weiter: In der Königsklasse mit acht Gruppen
     * also nur die Gruppensieger, der Zweite war draußen wie der Letzte.
     * Jetzt spielen Gruppensieger und Zweite das Achtelfinale aus - der
     * Sieger einer Gruppe gegen einen Zweiten, nie aus derselben Gruppe
     * und nie aus demselben Land, und der Gruppensieger hat Heimrecht. In
     * den Wettbewerben mit sechs Gruppen füllen die beiden besten Zweiten
     * die gesetzten Plätze auf und die vier besten Dritten die übrigen.
     */
    static EURO_ENDRUNDE = [
        { name: "Achtelfinale", teams: 16 },
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
        { nachSpieltag: 23, art: "euro", runde: 6 },
        { nachSpieltag: 24, art: "cup", runde: 4 },
        { nachSpieltag: 26, art: "euro", runde: 7 },
        { nachSpieltag: 28, art: "euro", runde: 8 },
        { nachSpieltag: 30, art: "cup", runde: 5 },
        { nachSpieltag: 32, art: "euro", runde: 9 }
    ];

    /** Prämien je erreichter Runde, gemessen an der Wirtschaftskraft der Liga */
    static POKAL_PRAEMIE = [180000, 300000, 600000, 1200000, 2500000, 5000000];
    /**
     * Europapokal: Der Sieger der Königsklasse bekam vorher 73 Mio. - 43 %
     * des Jahresumsatzes eines Spitzenklubs. Real waren es 2023/24 rund
     * 17 % (etwa 140 Mio. EUR bei 800 Mio. Umsatz); jetzt rund 20 %.
     * Mit dem Achtelfinale ist die Summe für den Sieger gleich geblieben -
     * sie verteilt sich nur auf eine Runde mehr.
     */
    static EURO_PRAEMIE = {
        ucl: { gruppe: 600000, af: 2000000, vf: 4000000, hf: 7000000, finale: 10000000, sieg: 13000000 },
        uel: { gruppe: 200000, af: 650000, vf: 1250000, hf: 2250000, finale: 3500000, sieg: 5000000 },
        uecl: { gruppe: 100000, af: 325000, vf: 575000, hf: 1100000, finale: 1700000, sieg: 2600000 }
    };
    /** Welche Prämie zu welcher gewonnenen Runde gehört */
    static EURO_STUFE = { Achtelfinale: "af", Viertelfinale: "vf", Halbfinale: "hf", Finale: "finale" };

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

    /** Die Länder mit eigenem Pokal */
    static POKAL_LAENDER = ["de", "en", "es", "it", "fr", "nl", "pt", "be", "tr", "at", "ch", "sc", "br"];

    /** Das Land des eigenen Vereins */
    static eigenesLand(state) {
        const eigener = (state.clubs || []).find(c => c.id === state.userClubId);
        return eigener?.countryId || eigener?.country || "de";
    }

    /**
     * Der Schlüssel des eigenen Landespokals. Jedes Land hat seinen Pokal
     * unter "<land>_cup". Ältere Spielstände führen den eigenen Pokal unter
     * "de_cup", auch wenn der Verein in England spielt - bis zur nächsten
     * Saison, die alle Pokale neu anlegt.
     */
    static eigenerPokalId(state) {
        const id = `${this.eigenesLand(state)}_cup`;
        if (state?.cups?.[id]) return id;
        return state?.cups?.de_cup ? "de_cup" : id;
    }

    static eigenerPokal(state) {
        return state?.cups?.[this.eigenerPokalId(state)] || null;
    }

    /** Die Pokale der anderen Länder - sie laufen im Hintergrund mit */
    static weiterePokalIds(state) {
        const eigen = this.eigenerPokalId(state);
        return Object.keys(state?.cups || {}).filter(id => id !== eigen);
    }

    /** Wer in welchem Land den Pokal geholt hat (abgeschlossene Pokale) */
    static pokalsiegerJeLand(state) {
        const sieger = {};
        Object.entries(state?.cups || {}).forEach(([id, cup]) => {
            if (!cup || !cup.completed || !cup.winnerId) return;
            const land = cup.land || (id === "de_cup" ? this.eigenesLand(state) : id.split("_")[0]);
            sieger[land] = cup.winnerId;
        });
        return sieger;
    }

    /**
     * Die Landespokale: in jedem Land die stärksten Vereine, im eigenen
     * Land dazu der eigene Verein - auch wenn er aus der Kreisliga kommt.
     * Vorher gab es nur den Pokal des eigenen Landes; in den anderen Ländern
     * fehlten Pokalsieger, Prämien und Pokalspiele ganz.
     */
    static setzePokalAn(state) {
        const eigenesLand = this.eigenesLand(state);
        state.cups = {};
        this.POKAL_LAENDER.forEach(land => {
            const imLand = state.clubs.filter(c => (c.countryId || c.country || "de") === land);
            if (imLand.length < 8) return;
            const pool = imLand.slice().sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
            // Die Länder im Hintergrund haben zwei Ligen: Mit mehr als 32
            // Vereinen spielen sie wie die großen ab der ersten Runde (mit
            // Freilosen), Österreich, Schweiz und Schottland mit 16 ab dem
            // Achtelfinale. Wer weniger als 33 hat, fängt mit so vielen an,
            // wie die nächste Runde fasst.
            const anzahl = imLand.length > this.POKAL_RUNDEN[1].teams
                ? this.POKAL_TEILNEHMER
                : this.POKAL_RUNDEN.map(r => r.teams).find(t => t <= imLand.length);
            const teilnehmer = pool.slice(0, anzahl).map(c => c.id);

            // Der eigene Verein ist immer dabei - sonst ist der Pokal für den
            // Spieler eines kleinen Vereins wieder nur Kulisse.
            if (land === eigenesLand && state.userClubId && !teilnehmer.includes(state.userClubId)) {
                teilnehmer[teilnehmer.length - 1] = state.userClubId;
            }

            const id = `${land}_cup`;
            // Die Runden, die ein kleiner Pokal überspringt, stehen als
            // erledigt davor - so passt der Index weiter zu den Pokalabenden
            const start = Math.max(0, this.POKAL_RUNDEN.findIndex(r => r.teams === teilnehmer.length));
            const runden = this.POKAL_RUNDEN.slice(0, start).map((r, i) => ({ roundName: r.name, roundNumber: i + 1, completed: true, uebersprungen: true, matches: [] }));
            runden.push(start > 0 ? this.loseAus(teilnehmer, this.POKAL_RUNDEN[start].name, id, start + 1) : this.ersteRunde(teilnehmer, id));
            state.cups[id] = {
                id,
                land,
                name: this.pokalName(state, land),
                type: "cup",
                teilnehmer,
                rundenIndex: start,
                runden,
                ausgeschieden: [],
                completed: false,
                winnerId: null
            };
        });
    }

    /**
     * Die erste Runde. Spanien, Italien und Frankreich haben weniger als 64
     * Vereine; vorher fiel dann in einer Runde ein Verein ohne Spiel heraus,
     * und der Pokal endete eine Runde zu früh. Jetzt bekommen die stärksten
     * Vereine ein Freilos, bis die zweite Runde mit 32 aufgeht.
     */
    static ersteRunde(teilnehmer, id) {
        const runde2 = this.POKAL_RUNDEN[1].teams;
        const freilose = teilnehmer.length > runde2 ? Math.max(0, this.POKAL_TEILNEHMER - teilnehmer.length) : 0;
        const runde = this.loseAus(teilnehmer.slice(freilose), this.POKAL_RUNDEN[0].name, id, 1);
        if (freilose > 0) runde.freilose = teilnehmer.slice(0, freilose);
        return runde;
    }

    /** Name des Landespokals - erfunden oder aus der Namensdatei (NamenEngine) */
    static pokalName(state, land) {
        const namen = _cupResolve("NamenEngine", "./namenEngine.js");
        const id = `${land || this.eigenesLand(state)}_cup`;
        return (namen && namen.WETTBEWERBE[id]) ? namen.wettbewerb(id) : "Landespokal";
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
        if (art === "playoff") return _cupResolve("PlayoffEngine", "./playoffEngine.js")?.spieleTermin(state, rundenIndex) || null;
        if (art === "supercup") return _cupResolve("SupercupEngine", "./supercupEngine.js")?.spieleTermin(state) || null;
        if (art === "eurosupercup") return _cupResolve("EuroSupercupEngine", "./euroSupercupEngine.js")?.spieleTermin(state) || null;
        if (art === "cup") {
            // Die Pokale der anderen Länder spielen am selben Abend
            const eigene = this.spielePokalrunde(state, rundenIndex);
            this.weiterePokalIds(state).forEach(id => this.spielePokalrunde(state, rundenIndex, id));
            return eigene;
        }
        return this.spieleEuropaTermin(state, rundenIndex);
    }

    /** Den Termin abschließen - Sieger, Prämien, nächste Auslosung */
    static schliesseTerminAb(state, art, rundenIndex) {
        if (art === "playoff") return _cupResolve("PlayoffEngine", "./playoffEngine.js")?.schliesseTerminAb(state, rundenIndex) || [];
        if (art === "supercup") return _cupResolve("SupercupEngine", "./supercupEngine.js")?.schliesseTerminAb(state) || [];
        if (art === "eurosupercup") return _cupResolve("EuroSupercupEngine", "./euroSupercupEngine.js")?.schliesseTerminAb(state) || [];
        if (art === "cup") {
            const eigene = this.schliessePokalrundeAb(state, rundenIndex);
            this.weiterePokalIds(state).forEach(id => this.schliessePokalrundeAb(state, rundenIndex, id));
            return eigene;
        }
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
        // Relegation und Aufstiegsspiele in der Sommerpause
        if (art === "playoff") return _cupResolve("PlayoffEngine", "./playoffEngine.js")?.eigenePartieAm(state, rundenIndex) || null;
        // Meister gegen Pokalsieger zum Saisonauftakt
        if (art === "supercup") return _cupResolve("SupercupEngine", "./supercupEngine.js")?.eigenePartieAm(state) || null;
        // Sieger der Königsklasse gegen den Sieger der Europa League
        if (art === "eurosupercup") return _cupResolve("EuroSupercupEngine", "./euroSupercupEngine.js")?.eigenePartieAm(state) || null;
        const meine = m => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId;

        if (art === "cup") {
            const cup = this.eigenerPokal(state);
            if (!cup || cup.completed) return null;
            // Nur die Runde, die an diesem Abend dran ist. Vorher zählte hier
            // die laufende Runde des Pokals: War die eigene Partie gespielt und
            // die nächste Runde ausgelost, bot derselbe Abend sofort die
            // nächste Partie an - und danach die übernächste, bis zum Aus oder
            // zum Pokalsieg, während die Liga stillstand.
            if (typeof rundenIndex === "number" && cup.rundenIndex !== rundenIndex) return null;
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
        const cup = this.eigenerPokal(state);
        if (!cup || cup.completed) return null;
        return cup.runden[cup.rundenIndex] || null;
    }

    /**
     * Spielt die Pokalrunde eines Kalenderabends.
     *
     * Ist sie schon ausgetragen, passiert nichts - ein Abend spielt nie die
     * Runde eines späteren Termins vor. Hinkt der Pokal dagegen hinterher,
     * werden die offenen Runden erst nachgeholt, damit er nicht ohne Sieger
     * endet.
     */
    static spielePokalrunde(state, rundenIndex, cupId) {
        const cup = state.cups?.[cupId || this.eigenerPokalId(state)];
        if (!cup || cup.completed) return null;

        const ziel = typeof rundenIndex === "number" ? rundenIndex : cup.rundenIndex;
        let schutz = 0;
        while (!cup.completed && cup.rundenIndex < ziel && schutz++ < this.POKAL_RUNDEN.length) {
            const offen = cup.runden[cup.rundenIndex];
            if (!offen) break;
            offen.matches.filter(m => !m.played).forEach(m => this.austragen(state, m, true));
            this.schliessePokalrundeAb(state, undefined, cupId);
        }
        if (cup.completed || cup.rundenIndex !== ziel) return null;

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
    static schliessePokalrundeAb(state, rundenIndex, cupId) {
        const id = cupId || this.eigenerPokalId(state);
        const cup = state.cups?.[id];
        if (!cup || cup.completed) return null;
        // Ein Abend schließt nur seine eigene Runde ab
        if (typeof rundenIndex === "number" && cup.rundenIndex !== rundenIndex) return null;

        const runde = cup.runden[cup.rundenIndex];
        if (!runde || runde.matches.some(m => !m.played)) return null;

        runde.completed = true;
        // Wer ein Freilos hatte, ist ohne Spiel weiter
        const sieger = runde.matches.map(m => this.siegerVon(m)).concat(runde.freilose || []);
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
            // Gemeldet wird der eigene Landespokal - und ein fremder nur, wenn wir mitgespielt haben
            const land = cup.land || (id === "de_cup" ? this.eigenesLand(state) : id.split("_")[0]);
            const betrifftUns = land === this.eigenesLand(state) || (cup.teilnehmer || []).includes(state.userClubId);
            this.meldeSieger(state, cup.name, sieger[0], cup.rundenIndex, betrifftUns);
            return { fertig: true, sieger: sieger[0] };
        }

        cup.rundenIndex++;
        const naechste = this.POKAL_RUNDEN[cup.rundenIndex];
        cup.runden.push(this.loseAus(sieger, naechste ? naechste.name : `Runde ${cup.rundenIndex + 1}`,
            id, cup.rundenIndex + 1));

        if (sieger.includes(state.userClubId)) {
            const freilos = (runde.freilose || []).includes(state.userClubId);
            this.postfach(state, `🏆 ${cup.name}: Weiter in die nächste Runde`,
                `${freilos ? `Freilos ${this.rundeIm(runde.roundName)}` : `${runde.roundName} überstanden`}. Die Auslosung für `
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
            this.lerneGegnerKennen(state, runde);

            if (index < 6) {
                this.schreibeGruppenTabellen(w, runde);
                if (index === 5) this.besetzeEndrunde(state, w, id);
                return;
            }

            // Endrunde: Sieger kommen weiter
            const sieger = runde.matches.map(m => this.siegerVon(m));
            const stufe = this.EURO_STUFE[runde.roundName] || "finale";
            const praemien = this.EURO_PRAEMIE[id] || this.EURO_PRAEMIE.uecl;
            sieger.forEach(cid => this.zahlePraemie(state, cid, praemien[stufe] || 0,
                `${w.name}: ${runde.roundName} gewonnen`));

            if (sieger.length === 1) {
                w.completed = true;
                w.winnerId = sieger[0];
                this.zahlePraemie(state, sieger[0], praemien.sieg || 0, `${w.name} gewonnen`);
                // Gemeldet wird der Meisterpokal, und die anderen nur, wenn wir
                // dabei waren oder ein Verein aus dem eigenen Land gewinnt
                const siegerClub = state.clubs.find(c => c.id === sieger[0]);
                const dabei = (w.participants || []).includes(state.userClubId)
                    || (w.endrunde || []).some(r => (r.matches || []).some(m => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId));
                const betrifftUns = id === "ucl" || dabei || (siegerClub?.countryId || "de") === this.eigenesLand(state);
                this.meldeSieger(state, w.name, sieger[0], 99, betrifftUns);
                return;
            }

            w.endrundeIndex++;
            // Nach der Zahl der Sieger, nicht nach dem Index - ältere
            // Spielstände haben ihre Endrunde noch mit dem Viertelfinale begonnen
            const naechste = this.EURO_ENDRUNDE.find(r => r.teams === sieger.length);
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

    /**
     * Hat der Kalender dieser Saison einen Abend fürs Achtelfinale? Ältere
     * Spielstände haben ihren Kalender mit drei K.-o.-Abenden angelegt - dort
     * geht es bis zum Saisonende noch direkt ins Viertelfinale.
     */
    static hatAchtelfinale(state) {
        const kalender = state?.calendar;
        if (!Array.isArray(kalender) || !kalender.length) return true;
        return kalender.some(d => d && d.cupArt === "euro" && d.cupRunde === 9);
    }

    /**
     * Wer in Europa gegen einen Verein spielt, lernt dessen Land kennen:
     * Der Scout sieht sich den Gegner an, die Spiele laufen im Fernsehen,
     * man reist hin. Das Wissen über das Land wächst je Spiel ein Stück -
     * und verblasst wie jedes andere ohne Pflege wieder.
     */
    static lerneGegnerKennen(state, runde) {
        const se = _cupResolve("ScoutingEngine", "./scoutingEngine.js");
        if (!se || typeof se.erweitereLandWissen !== "function") return;
        const meine = (runde?.matches || []).find(m => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
        if (!meine) return;
        const gegner = (state.clubs || []).find(c => c.id === (meine.homeClubId === state.userClubId ? meine.awayClubId : meine.homeClubId));
        if (gegner && gegner.countryId) se.erweitereLandWissen(state, gegner.countryId, se.LAND_ZUWACHS_EUROPA || 6);
    }

    /** Die Besten der Gruppenphase spielen die Endrunde aus */
    static besetzeEndrunde(state, wettbewerb, id) {
        const mitAchtel = this.hatAchtelfinale(state);
        const anzahl = mitAchtel ? 16 : 8;
        const kandidaten = [];
        (wettbewerb.groups || []).forEach(g => {
            g.standings.slice(0, 3).forEach((s, platz) => {
                kandidaten.push({ clubId: s.clubId, gruppe: g.groupName, punkte: s.points, platz, diff: s.goalsFor - s.goalsAgainst, tore: s.goalsFor });
            });
        });

        kandidaten.sort((a, b) => a.platz - b.platz || b.punkte - a.punkte || b.diff - a.diff || b.tore - a.tore);
        const weiter = kandidaten.filter(k => k.platz < 2 || mitAchtel).slice(0, anzahl);
        const ids = weiter.map(k => k.clubId);

        const praemien = this.EURO_PRAEMIE[id] || this.EURO_PRAEMIE.uecl;
        ids.forEach(cid => this.zahlePraemie(state, cid, praemien.gruppe || 0,
            `${wettbewerb.name}: Gruppenphase überstanden`));

        wettbewerb.phase = "endrunde";
        wettbewerb.endrunde = [mitAchtel
            ? this.loseAchtelfinale(state, weiter.slice(0, anzahl / 2), weiter.slice(anzahl / 2), id)
            : this.loseAus(ids, "Viertelfinale", id, 100)];
        wettbewerb.endrundeIndex = 0;

        if (ids.includes(state.userClubId)) {
            const partie = wettbewerb.endrunde[0].matches.find(m => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
            const gegnerId = partie ? (partie.homeClubId === state.userClubId ? partie.awayClubId : partie.homeClubId) : null;
            const gegner = (state.clubs || []).find(c => c.id === gegnerId);
            const runde = mitAchtel ? "Achtelfinale" : "Viertelfinale";
            this.postfach(state, `⭐ ${wettbewerb.name}: ${runde} erreicht`,
                `Die Gruppenphase ist überstanden. Es geht in die Endrunde der letzten ${anzahl}.`
                + (gegner ? `\n\nDie Auslosung ergibt: ${gegner.name}${partie.homeClubId === state.userClubId ? " - wir haben Heimrecht." : " - auswärts."}` : ""));
        } else if ((wettbewerb.participants || []).includes(state.userClubId)) {
            this.postfach(state, `${wettbewerb.name}: Aus in der Gruppenphase`,
                `Die Gruppenphase ist beendet - für uns geht es nicht weiter.`);
        }
    }

    // ------------------------------------------------------------- Bausteine

    /**
     * Das Achtelfinale: jeder Gesetzte gegen einen Ungesetzten, nie aus
     * derselben Gruppe und nie aus demselben Land. Gelost wird wie bei der
     * echten Auslosung Zug um Zug; geht es am Ende nicht auf, wird neu
     * gezogen. Der Gesetzte hat Heimrecht.
     */
    static loseAchtelfinale(state, gesetzt, ungesetzt, wettbewerbId) {
        const land = new Map((state.clubs || []).map(c => [c.id, c.countryId]));
        const passt = (a, b, mitLand) => a.gruppe !== b.gruppe && (!mitLand || land.get(a.clubId) !== land.get(b.clubId));
        const ziehe = (mitLand) => {
            for (let versuch = 0; versuch < 60; versuch++) {
                const offen = [...ungesetzt].sort(() => 0.5 - Math.random());
                const paare = [];
                let ok = true;
                for (const g of [...gesetzt].sort(() => 0.5 - Math.random())) {
                    const i = offen.findIndex(u => passt(g, u, mitLand));
                    if (i < 0) { ok = false; break; }
                    paare.push([g, offen.splice(i, 1)[0]]);
                }
                if (ok) return paare;
            }
            return null;
        };
        const paare = ziehe(true) || ziehe(false)
            || gesetzt.map((g, i) => [g, ungesetzt[i]]).filter(([g, u]) => g && u);
        const matches = paare.map(([g, u], i) => ({
            id: `m_${wettbewerbId}_r100_${i + 1}`,
            competitionId: wettbewerbId,
            roundName: "Achtelfinale",
            roundNumber: 100,
            homeClubId: g.clubId,
            awayClubId: u.clubId,
            played: false,
            homeGoals: null,
            awayGoals: null,
            isCup: true,
            penaltyWinner: null
        }));
        return { roundName: "Achtelfinale", roundNumber: 100, completed: false, matches };
    }

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
        // Prämien gelten auch im Pokal und im Europapokal
        if (eigenes) {
            const verhandlung = (typeof NegotiationEngine !== "undefined" && NegotiationEngine)
                ? NegotiationEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./negotiationEngine.js").NegotiationEngine; } catch (e) { return null; } })() : null);
            if (verhandlung && typeof verhandlung.zahlePraemien === "function") verhandlung.zahlePraemien(state, match);
            const chronik = (typeof ChronikEngine !== "undefined" && ChronikEngine)
                ? ChronikEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./chronikEngine.js").ChronikEngine; } catch (e) { return null; } })() : null);
            if (chronik && typeof chronik.nachSpiel === "function") {
                const id = String(match.competitionId || "");
                const name = id === "supercup" ? "Supercup" : id === "eurosupercup" ? "Europäischer Supercup" : (id.endsWith("_cup") ? "Pokal" : (state.europeanCompetitions?.[id]?.name || "Europapokal"));
                chronik.nachSpiel(state, match, name);
            }
            const fans = _cupResolve("FanEngine", "./fanEngine.js");
            if (fans && typeof fans.nachSpiel === "function") {
                const id = String(match.competitionId || "");
                fans.nachSpiel(state, match, id === "supercup" ? "Supercup" : id === "eurosupercup" ? "Europäischer Supercup" : (id.endsWith("_cup") ? "Pokal" : "Europapokal"));
            }
            const meilensteine = _cupResolve("MeilensteinEngine", "./meilensteinEngine.js");
            if (meilensteine && typeof meilensteine.nachSpiel === "function") meilensteine.nachSpiel(state);
        }
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
        const gs = _cupResolve("GameState", "./gameState.js");
        const finde = gs && typeof gs.spielerMitId === "function"
            ? (id) => gs.spielerMitId(state.players || [], id)
            : (id) => (state.players || []).find(p => p.id === id);
        const quote = clubId => {
            const club = (state.clubs || []).find(c => c.id === clubId);
            if (!club) return 0.76;

            const kader = (club.playerIds || []).map(finde).filter(Boolean);

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

    /**
     * Der Sieger eines Wettbewerbs. Eine Mail gibt es nur, wenn er uns
     * betrifft (betrifftUns) - vorher kam am Saisonende für jeden Pokal der
     * Welt eine, vom brasilianischen bis zum schottischen. Der Titel steht
     * trotzdem am Wettbewerb (winnerId) und in der Historie.
     */
    static meldeSieger(state, wettbewerb, clubId, rundenIndex, betrifftUns = true) {
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

        if (!eigener && !betrifftUns) return;
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
            date: state.currentDate || `Spieltag ${state.currentMatchday || 0}`,
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
        if (state.cups?.[wettbewerbId]) {
            const cup = state.cups[wettbewerbId];
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
