/**
 * PlayoffEngine - Relegation und Aufstiegs-Playoffs nach den echten Formaten
 *
 * Vorher stiegen am Saisonende nur feste Tabellenplätze auf und ab: In der
 * Championship war der Dritte einfach aufgestiegen, in der Bundesliga
 * spielte der 16. keine Relegation, obwohl die Ligadaten den Platz schon
 * kannten. Jetzt wird in der Sommerpause gespielt, so wie in Wirklichkeit:
 *
 *   Deutschland  16. Bundesliga gegen 3. der 2. Bundesliga, Hin- und
 *                Rückspiel (Hinspiel beim Erstligisten); ebenso 16. der
 *                2. Bundesliga gegen 3. der 3. Liga (Hinspiel beim
 *                Drittligisten). Bei Gleichstand Verlängerung, Elfmeter.
 *   England      Championship und League One: 3. bis 6., Halbfinale mit
 *                Hin- und Rückspiel (der Schlechtere zuerst zu Hause),
 *                Finale auf neutralem Platz.
 *   Spanien      Segunda: 3. bis 6., Halbfinale und Finale mit Hin- und
 *                Rückspiel; nach Verlängerung kommt der besser Platzierte
 *                weiter - Elfmeterschießen gibt es nicht.
 *   Italien      Serie B: 3. bis 8., Vorrunde in einem Spiel beim besser
 *                Platzierten (5.-8., 6.-7.), Halbfinale und Finale mit
 *                Hin- und Rückspiel; bei Gleichstand der besser Platzierte.
 *                Liegt der Dritte 15 Punkte vor dem Vierten, steigt er
 *                direkt auf.
 *   Frankreich   Ligue 2: 5. beim 4., der Sieger beim 3.; der Gewinner
 *                spielt die Barrage gegen den 16. der Ligue 1 (Hinspiel
 *                beim Zweitligisten).
 *
 * Gespielt wird an festen Tagen der Sommerpause. Die Partien des eigenen
 * Vereins laufen wie ein Pokalabend - live oder sofort -, alle anderen
 * rechnet die Engine. Über Auf- und Abstieg entscheidet der Saisonwechsel
 * (CompetitionEngine) mit den Ergebnissen von hier.
 */

const _poResolve = (globalName, path) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[globalName]; } catch (e) { return null; }
    }
    return null;
};

class PlayoffEngine {
    /** An diesen Tagen der Sommerpause wird gespielt (1 = erster Tag) */
    static TERMIN_TAGE = [3, 6, 9, 12, 15];

    /**
     * Die Formate, nach der unteren Liga geordnet. oben: der Erstligist, der
     * in die Relegation muss; unten: der Platz des Herausforderers.
     */
    static FORMATE = {
        de_liga_2: { art: "relegation", name: "Relegation zur Bundesliga", oben: { liga: "de_liga_1", platz: 16 }, unten: 3, hinspielBeim: "oben", regel: "elfmeter", verlaengerung: true },
        de_liga_3: { art: "relegation", name: "Relegation zur 2. Bundesliga", oben: { liga: "de_liga_2", platz: 16 }, unten: 3, hinspielBeim: "unten", regel: "elfmeter", verlaengerung: true },
        en_liga_2: { art: "playoffs", name: "Championship-Playoffs", plaetze: [3, 4, 5, 6], finale: "neutral", regel: "elfmeter", verlaengerung: true },
        en_liga_3: { art: "playoffs", name: "League-One-Playoffs", plaetze: [3, 4, 5, 6], finale: "neutral", regel: "elfmeter", verlaengerung: true },
        es_liga_2: { art: "playoffs", name: "Aufstiegs-Playoffs der Segunda", plaetze: [3, 4, 5, 6], finale: "hinrueck", regel: "besser", verlaengerung: true },
        it_liga_2: { art: "serie_b", name: "Playoffs der Serie B", plaetze: [3, 4, 5, 6, 7, 8], regel: "besser", verlaengerung: true, direktAbstand: 15 },
        fr_liga_2: { art: "barrage", name: "Play-offs und Barrage", plaetze: [3, 4, 5], oben: { liga: "fr_liga_1", platz: 16 }, regel: "elfmeter", verlaengerung: true }
    };

    /** Wie oft eine Mannschaft in der Verlängerung trifft, bei gleicher Stärke */
    static VERLAENGERUNG_TOR = 0.22;

    static cupEngine() { return _poResolve("CupEngine", "./cupEngine.js"); }

    // ------------------------------------------------------------ Aufbau

    /** Die Abschlusstabelle einer Liga */
    static tabelle(state, ligaId) {
        const t = state?.standingsByLeague?.[ligaId];
        if (Array.isArray(t) && t.length) return t;
        if (ligaId === state?.userLeagueId && Array.isArray(state.standings)) return state.standings;
        return null;
    }

    static eintrag(tabelle, platz, ligaId) {
        const e = tabelle && tabelle[platz - 1];
        return e ? { clubId: e.clubId, platz, liga: ligaId, punkte: e.points || 0 } : null;
    }

    static name(state, clubId) {
        return (state.clubs || []).find(c => c.id === clubId)?.name || "?";
    }

    /** Laufen die Playoffs dieser Saison schon? */
    static aktiv(state) {
        return !!(state?.playoffs && state.playoffs.saison === state.seasonYear);
    }

    /**
     * Zum Saisonende: Paarungen aus den Abschlusstabellen ansetzen und die
     * Termine in die Sommerpause legen. Läuft nur einmal je Saison.
     */
    static setzeAn(state) {
        if (!state || this.aktiv(state)) return state?.playoffs || null;
        const ligen = new Set((state.leagues || []).map(l => l.id));
        const wettbewerbe = [];
        Object.keys(this.FORMATE).forEach(ligaId => {
            if (!ligen.has(ligaId)) return;
            const w = this.baue(state, ligaId, this.FORMATE[ligaId]);
            if (w) wettbewerbe.push(w);
        });
        state.playoffs = { saison: state.seasonYear, wettbewerbe };
        this.legeTermineAn(state);
        wettbewerbe.forEach(w => this.meldeAnsetzung(state, w));
        return state.playoffs;
    }

    static baue(state, ligaId, f) {
        const unten = this.tabelle(state, ligaId);
        if (!unten) return null;
        const w = { id: `po_${ligaId}`, ligaId, art: f.art, name: f.name, runden: [], rundeIndex: 0, fertig: false, ergebnis: null, teilnehmer: [] };

        if (f.art === "relegation") {
            const obenTab = this.tabelle(state, f.oben.liga);
            const a = this.eintrag(obenTab, f.oben.platz, f.oben.liga);
            const b = this.eintrag(unten, f.unten, ligaId);
            if (!a || !b) return null;
            w.oben = a;
            w.teilnehmer = [a, b];
            const heimZuerst = f.hinspielBeim === "unten" ? b : a;
            w.runden.push(this.runde(state, w, "Relegation", [0, 1], [this.paarung(a, b, heimZuerst)]));
            return w;
        }

        const plaetze = (f.plaetze || []).map(p => this.eintrag(unten, p, ligaId));
        if (plaetze.some(p => !p)) return null;
        const nach = p => plaetze.find(x => x.platz === p);
        w.teilnehmer = plaetze.slice();

        if (f.art === "playoffs") {
            w.runden.push(this.runde(state, w, "Halbfinale", [0, 1], [
                this.paarung(nach(3), nach(6), nach(6)),
                this.paarung(nach(4), nach(5), nach(5))
            ]));
            return w;
        }

        if (f.art === "serie_b") {
            if (nach(3).punkte - nach(4).punkte >= (f.direktAbstand || 99)) {
                // Zu klar - der Dritte steigt ohne Playoffs auf
                w.fertig = true;
                w.direkt = true;
                w.ergebnis = { aufsteiger: nach(3).clubId };
                w.teilnehmer = [nach(3)];
                return w;
            }
            w.runden.push(this.runde(state, w, "Vorrunde", [0], [
                this.paarung(nach(5), nach(8), nach(5)),
                this.paarung(nach(6), nach(7), nach(6))
            ]));
            return w;
        }

        if (f.art === "barrage") {
            const obenTab = this.tabelle(state, f.oben.liga);
            const oben = this.eintrag(obenTab, f.oben.platz, f.oben.liga);
            if (!oben) return null;
            w.oben = oben;
            w.teilnehmer.push(oben);
            w.runden.push(this.runde(state, w, "Play-off 1", [0], [this.paarung(nach(4), nach(5), nach(4))]));
            return w;
        }
        return null;
    }

    /**
     * Eine Paarung. a ist der besser Platzierte (bei der Relegation der
     * Erstligist), heimZuerst bestreitet das erste Spiel zu Hause.
     */
    static paarung(a, b, heimZuerst) {
        return { a, b, heimZuerst: heimZuerst.clubId, spiele: [], sieger: null, text: "" };
    }

    static runde(state, w, name, termine, paarungen, optionen = {}) {
        const r = { name, termine, paarungen, fertig: false, neutral: !!optionen.neutral };
        paarungen.forEach(p => {
            const erster = p.heimZuerst === p.a.clubId ? p.a : p.b;
            const zweiter = erster === p.a ? p.b : p.a;
            termine.forEach((t, leg) => {
                const heim = leg === 0 ? erster : zweiter;
                const gast = leg === 0 ? zweiter : erster;
                p.spiele.push({
                    id: `po_${w.ligaId}_${state.seasonYear}_${w.runden.length}_${heim.clubId}_${leg}`,
                    homeClubId: heim.clubId,
                    awayClubId: gast.clubId,
                    played: false,
                    homeGoals: 0,
                    awayGoals: 0,
                    competitionId: "playoff",
                    playoffId: w.id,
                    wettbewerbName: w.name,
                    roundName: termine.length > 1 ? `${name}, ${leg === 0 ? "Hinspiel" : "Rückspiel"}` : name,
                    neutralerPlatz: !!optionen.neutral,
                    termin: t
                });
            });
        });
        return r;
    }

    /** Die Sommerpausentage, an denen gespielt wird, werden Spieltermine */
    static legeTermineAn(state) {
        if (!Array.isArray(state.calendar) || !state.playoffs) return;
        const benutzt = new Set();
        state.playoffs.wettbewerbe.forEach(w => (w.runden || []).forEach(r => r.termine.forEach(t => benutzt.add(t))));
        // Auch spätere Runden brauchen ihre Termine - sie stehen fest
        state.playoffs.wettbewerbe.forEach(w => {
            if (w.fertig) return;
            const f = this.FORMATE[w.ligaId];
            const letzter = f.art === "relegation" ? 1 : (f.art === "playoffs" ? (f.finale === "neutral" ? 2 : 3) : 4);
            for (let t = 0; t <= letzter; t++) benutzt.add(t);
        });
        [...benutzt].sort((a, b) => a - b).forEach(t => {
            const tag = state.calendar.find(d => d.sommerpause && d.pauseTag === this.TERMIN_TAGE[t] && !d.saisonwechsel);
            if (!tag) return;
            tag.type = "cup";
            tag.cupArt = "playoff";
            tag.cupRunde = t;
            tag.title = "⚔️ Relegation und Aufstiegsspiele";
            tag.description = "Wer steigt auf, wer bleibt drin? In ganz Europa wird nachgespielt.";
        });
    }

    // ------------------------------------------------------------ Spielen

    static istEigene(state, m) {
        return m.homeClubId === state.userClubId || m.awayClubId === state.userClubId;
    }

    /** Alle Partien, die an Termin t anstehen */
    static partienAm(state, t) {
        const liste = [];
        (state.playoffs?.wettbewerbe || []).forEach(w => {
            if (w.fertig) return;
            const r = w.runden[w.rundeIndex];
            if (!r || !r.termine.includes(t)) return;
            const leg = r.termine.indexOf(t);
            r.paarungen.forEach(p => {
                const m = p.spiele[leg];
                if (m) liste.push({ w, r, p, m });
            });
        });
        return liste;
    }

    /** Die eigene Partie an Termin t - ohne etwas auszutragen */
    static eigenePartieAm(state, t) {
        if (!this.aktiv(state)) return null;
        const treffer = this.partienAm(state, t).find(x => !x.m.played && this.istEigene(state, x.m));
        if (!treffer) return null;
        return {
            partie: treffer.m,
            runde: { roundName: treffer.m.roundName },
            wettbewerb: { id: "playoff", name: treffer.w.name },
            ko: false
        };
    }

    /**
     * Termin t: Alle Partien außer der eigenen werden ausgetragen (mit alle:
     * auch die eigene - beim Überspringen der Sommerpause).
     */
    static spieleTermin(state, t, { alle = false } = {}) {
        if (!this.aktiv(state)) return null;
        let eigene = null;
        this.partienAm(state, t).forEach(({ m }) => {
            if (m.played) return;
            if (!alle && this.istEigene(state, m)) { eigene = m; return; }
            this.austragen(state, m);
        });
        return { art: "playoff", eigenePartie: eigene, termin: t };
    }

    static austragen(state, m) {
        const cup = this.cupEngine();
        if (cup && typeof cup.austragen === "function") return cup.austragen(state, m, false);
        return null;
    }

    /**
     * Nach Termin t: Paarungen entscheiden, deren letztes Spiel gespielt ist,
     * und die nächste Runde ansetzen. Darf mehrfach aufgerufen werden.
     */
    static schliesseTerminAb(state, t) {
        if (!this.aktiv(state)) return [];
        const meldungen = [];
        state.playoffs.wettbewerbe.forEach(w => {
            if (w.fertig) return;
            const r = w.runden[w.rundeIndex];
            if (!r || r.termine[r.termine.length - 1] !== t) return;
            if (r.paarungen.some(p => p.spiele.some(m => !m.played))) return;
            r.paarungen.forEach(p => { if (!p.sieger) this.entscheide(state, w, p); });
            r.fertig = true;
            const naechste = this.naechsteRunde(state, w);
            let ende = null;
            if (naechste) {
                w.runden.push(naechste);
                w.rundeIndex++;
            } else {
                ende = this.schliesseAb(state, w);
            }
            const m = this.meldeRunde(state, w, r);
            if (m) meldungen.push(m);
            if (ende && r.paarungen.some(p => p.a.clubId === state.userClubId || p.b.clubId === state.userClubId)) meldungen.push(ende);
        });
        return meldungen;
    }

    /** Wer ist weiter? Tore, dann Verlängerung, dann Elfmeter oder Tabellenplatz */
    static entscheide(state, w, p) {
        const f = this.FORMATE[w.ligaId] || {};
        const tore = (clubId, mitVerl = true) => p.spiele.reduce((s, m) => {
            const heim = m.homeClubId === clubId;
            let n = heim ? (m.homeGoals || 0) : (m.awayGoals || 0);
            if (mitVerl && Array.isArray(m.verlaengerung)) n += heim ? m.verlaengerung[0] : m.verlaengerung[1];
            return s + n;
        }, 0);
        const letzte = p.spiele[p.spiele.length - 1];
        let sieger = null;
        if (tore(p.a.clubId, false) !== tore(p.b.clubId, false)) {
            sieger = tore(p.a.clubId, false) > tore(p.b.clubId, false) ? p.a : p.b;
        } else {
            // In Italien gibt es im Halbfinale und Finale keine Verlängerung
            const mitVerlaengerung = f.verlaengerung && !(f.art === "serie_b" && p.spiele.length > 1);
            if (mitVerlaengerung) this.verlaengerung(state, letzte);
            if (tore(p.a.clubId) !== tore(p.b.clubId)) {
                sieger = tore(p.a.clubId) > tore(p.b.clubId) ? p.a : p.b;
            } else if (f.regel === "besser") {
                sieger = p.a.liga === p.b.liga ? (p.a.platz <= p.b.platz ? p.a : p.b) : p.a;
                letzte.entscheidung = "Tabellenplatz";
            } else {
                const cup = this.cupEngine();
                if (!letzte.penaltyWinner && cup && typeof cup.elfmeterschiessen === "function") cup.elfmeterschiessen(state, letzte);
                sieger = letzte.penaltyWinner === p.b.clubId ? p.b : p.a;
                letzte.entscheidung = "Elfmeterschießen";
            }
        }
        p.sieger = sieger.clubId;
        p.text = this.paarungText(state, p);
        return sieger;
    }

    /**
     * Die Verlängerung wird nicht ausgespielt, sondern gerechnet: Jede
     * Mannschaft trifft mit rund 22 %, die stärkere etwas öfter.
     */
    static verlaengerung(state, m) {
        if (Array.isArray(m.verlaengerung)) return m.verlaengerung;
        const ce = _poResolve("ContractEngine", "./contractEngine.js");
        const spielerNach = new Map((state.players || []).map(p => [p.id, p]));
        const niveau = id => {
            const c = (state.clubs || []).find(x => x.id === id);
            return (ce && c && typeof ce.vereinsNiveau === "function" ? ce.vereinsNiveau(c, spielerNach) : null) || 60;
        };
        const nh = niveau(m.homeClubId), na = niveau(m.awayClubId);
        const anteil = nh / (nh + na);
        const tor = (a) => Math.random() < Math.min(0.45, this.VERLAENGERUNG_TOR * 2 * a) ? 1 : 0;
        m.verlaengerung = [tor(anteil), tor(1 - anteil)];
        return m.verlaengerung;
    }

    static naechsteRunde(state, w) {
        const f = this.FORMATE[w.ligaId];
        const r = w.runden[w.rundeIndex];
        const sieger = r.paarungen.map(p => (p.sieger === p.a.clubId ? p.a : p.b));
        const besser = (x, y) => (x.platz <= y.platz ? [x, y] : [y, x]);

        if (f.art === "playoffs" && w.rundeIndex === 0) {
            const [a, b] = besser(sieger[0], sieger[1]);
            return f.finale === "neutral"
                ? this.runde(state, w, "Finale", [2], [this.paarung(a, b, a)], { neutral: true })
                : this.runde(state, w, "Finale", [2, 3], [this.paarung(a, b, b)]);
        }
        if (f.art === "serie_b") {
            if (w.rundeIndex === 0) {
                const nach = p => w.teilnehmer.find(x => x.platz === p);
                const [vorne, hinten] = besser(sieger[0], sieger[1]);
                // Der Dritte trifft auf den schlechter platzierten Sieger der Vorrunde
                return this.runde(state, w, "Halbfinale", [1, 2], [
                    this.paarung(nach(3), hinten, hinten),
                    this.paarung(nach(4), vorne, vorne)
                ]);
            }
            if (w.rundeIndex === 1) {
                const [a, b] = besser(sieger[0], sieger[1]);
                return this.runde(state, w, "Finale", [3, 4], [this.paarung(a, b, b)]);
            }
        }
        if (f.art === "barrage") {
            if (w.rundeIndex === 0) {
                const dritter = w.teilnehmer.find(x => x.platz === 3 && x.liga === w.ligaId);
                return this.runde(state, w, "Play-off 2", [1], [this.paarung(dritter, sieger[0], dritter)]);
            }
            if (w.rundeIndex === 1) {
                return this.runde(state, w, "Barrage", [2, 3], [this.paarung(w.oben, sieger[0], sieger[0])]);
            }
        }
        return null;
    }

    static schliesseAb(state, w) {
        const p = w.runden[w.rundeIndex].paarungen[0];
        w.fertig = true;
        if (w.art === "relegation" || w.art === "barrage") {
            const unten = p.a.clubId === w.oben.clubId ? p.b : p.a;
            w.ergebnis = p.sieger === unten.clubId
                ? { aufsteiger: unten.clubId, absteiger: w.oben.clubId }
                : { aufsteiger: null, gehalten: w.oben.clubId };
        } else {
            w.ergebnis = { aufsteiger: p.sieger };
        }
        return this.meldeErgebnis(state, w);
    }

    /**
     * Zum Saisonwechsel: Was noch offen ist, wird jetzt gespielt - auch,
     * wenn der Manager die Sommerpause übersprungen hat. Ohne angesetzte
     * Playoffs (ein alter Spielstand) werden sie erst angesetzt.
     */
    static abschliessen(state) {
        if (!state) return null;
        if (!this.aktiv(state)) this.setzeAn(state);
        for (let t = 0; t < this.TERMIN_TAGE.length; t++) {
            this.spieleTermin(state, t, { alle: true });
            this.schliesseTerminAb(state, t);
        }
        return state.playoffs;
    }

    /**
     * Die Plätze einer Liga, die direkt aufsteigen: die Aufstiegsplätze ohne
     * die, die in Relegation oder Playoffs müssen. Ältere Spielstände
     * führen die Championship noch mit drei Aufstiegsplätzen.
     */
    static direktePlaetze(liga) {
        const spots = (liga?.promotionSpots && liga.promotionSpots.length) ? liga.promotionSpots : [1];
        const f = this.FORMATE[liga?.id];
        if (!f) return spots;
        const ab = f.art === "relegation" ? f.unten : Math.min(...(f.plaetze || [99]));
        return spots.filter(p => p < ab);
    }

    /** Steigt aus diesem Format sicher einer auf (Playoffs) oder nur vielleicht (Relegation)? */
    static sichererAufsteiger(ligaId) {
        const f = this.FORMATE[ligaId];
        return !!f && (f.art === "playoffs" || f.art === "serie_b");
    }

    /** Aufsteiger aus Playoffs und Relegation, nach Liga - für den Saisonwechsel */
    static aufsteiger(state) {
        return (state?.playoffs?.wettbewerbe || [])
            .filter(w => w.ergebnis && w.ergebnis.aufsteiger)
            .map(w => ({ clubId: w.ergebnis.aufsteiger, fromLeague: w.ligaId }));
    }

    /**
     * Die Playoffs zählen nicht zur neuen Saison: Ihre Einsätze, Tore und
     * Noten werden beim Saisonwechsel wieder herausgerechnet, wie es der
     * Saisonabschluss für alle getan hat.
     */
    static statistikZuruecksetzen(state) {
        const vereine = new Set();
        (state?.playoffs?.wettbewerbe || []).forEach(w => (w.teilnehmer || []).forEach(t => vereine.add(t.clubId)));
        (state.players || []).forEach(p => {
            if (!vereine.has(p.clubId) || !p.stats) return;
            ["matches", "goals", "assists", "yellowCards", "redCards", "ratingSum", "cleanSheets", "minutes"]
                .forEach(k => { p.stats[k] = 0; });
        });
    }

    // ------------------------------------------------------------ Texte

    static terminDatum(state, t) {
        const tag = (state.calendar || []).find(d => d.cupArt === "playoff" && d.cupRunde === t);
        return tag ? String(tag.date || "").slice(0, 6) : null;
    }

    /** "2:1, 0:1 - Elfmeterschießen 4:3: Bochum bleibt" */
    static paarungText(state, p) {
        const teile = p.spiele.map(m => {
            let s = `${this.name(state, m.homeClubId)} - ${this.name(state, m.awayClubId)} ${m.homeGoals}:${m.awayGoals}`;
            if (Array.isArray(m.verlaengerung)) s += ` (n. V. ${m.homeGoals + m.verlaengerung[0]}:${m.awayGoals + m.verlaengerung[1]})`;
            if (m.penaltyScore) s += `, i. E. ${m.penaltyScore[0]}:${m.penaltyScore[1]}`;
            return s;
        });
        const zusatz = p.spiele.some(m => m.entscheidung === "Tabellenplatz") ? " - Gleichstand, der besser Platzierte ist weiter" : "";
        return `${teile.join("; ")}${zusatz}`;
    }

    /** Betrifft der Wettbewerb die eigene Liga oder den eigenen Verein? */
    static betrifftUns(state, w) {
        const liga = state.userLeagueId || (state.clubs || []).find(c => c.id === state.userClubId)?.leagueId;
        return w.ligaId === liga || w.oben?.liga === liga || (w.teilnehmer || []).some(t => t.clubId === state.userClubId);
    }

    static postfach(state, betreff, text) {
        const news = _poResolve("NewsEngine", "./newsEngine.js");
        if (news && typeof news.addMessage === "function") {
            news.addMessage(state, "competition", { title: betreff, sender: "Ligaverband", text, priority: "normal" });
        } else if (Array.isArray(state.inbox)) {
            state.inbox.unshift({ id: Date.now() + Math.random(), date: state.currentDate || "", sender: "Ligaverband", subject: betreff, body: text, read: false, type: "competition" });
        }
    }

    static meldeAnsetzung(state, w) {
        if (!this.betrifftUns(state, w)) return;
        if (w.direkt) {
            this.postfach(state, `${w.name}: ${this.name(state, w.ergebnis.aufsteiger)} steigt direkt auf`,
                `Der Dritte liegt so weit vor dem Vierten, dass die Playoffs ausfallen: ${this.name(state, w.ergebnis.aufsteiger)} steigt direkt auf.`);
            return;
        }
        const r = w.runden[0];
        const dabei = (w.teilnehmer || []).some(t => t.clubId === state.userClubId);
        const termine = r.termine.map(t => this.terminDatum(state, t)).filter(Boolean);
        const paare = r.paarungen.map(p => `• ${this.name(state, p.spiele[0].homeClubId)} - ${this.name(state, p.spiele[0].awayClubId)}`).join("\n");
        this.postfach(state, dabei ? `${w.name}: Wir sind dabei` : `${w.name} angesetzt`,
            `${r.name}${termine.length ? ` am ${termine.join(" und ")}` : ""}:\n\n${paare}\n\n`
            + (dabei ? "Die Mannschaft hat in der Sommerpause noch nicht frei - erst wird nachgespielt." : "Für uns geht es um nichts mehr, wir schauen zu."));
    }

    static meldeRunde(state, w, r) {
        const eigene = r.paarungen.find(p => p.a.clubId === state.userClubId || p.b.clubId === state.userClubId);
        if (!eigene || w.fertig) return null;
        const weiter = eigene.sieger === state.userClubId;
        const betreff = weiter ? `${w.name}: weiter nach dem ${r.name}` : `${w.name}: Aus im ${r.name}`;
        this.postfach(state, betreff, `${eigene.text}.`);
        return betreff;
    }

    static meldeErgebnis(state, w) {
        if (!this.betrifftUns(state, w)) return null;
        const e = w.ergebnis;
        const p = w.runden[w.rundeIndex].paarungen[0];
        let betreff;
        if (e.absteiger) betreff = `${w.name}: ${this.name(state, e.aufsteiger)} steigt auf, ${this.name(state, e.absteiger)} ab`;
        else if (e.gehalten) betreff = `${w.name}: ${this.name(state, e.gehalten)} bleibt drin`;
        else betreff = `${w.name}: ${this.name(state, e.aufsteiger)} steigt auf`;
        this.postfach(state, betreff, `${p.text}.`);
        return betreff;
    }

    /** Was an einem Spieltermin ansteht, wenn der eigene Verein nicht spielt */
    static tagesText(state, t) {
        const partien = this.partienAm(state, t).filter(x => x.w.ligaId && this.betrifftUns(state, x.w));
        if (!partien.length) return "In ganz Europa wird um Auf- und Abstieg gespielt - ohne uns.";
        return partien.map(x => `${x.w.name}: ${this.name(state, x.m.homeClubId)} - ${this.name(state, x.m.awayClubId)}`).join(" · ");
    }
}

if (typeof window !== "undefined") {
    window.PlayoffEngine = PlayoffEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PlayoffEngine };
}
