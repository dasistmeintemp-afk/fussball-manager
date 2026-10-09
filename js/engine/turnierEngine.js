/**
 * TurnierEngine - Weltmeisterschaft und Europameisterschaft im Sommer
 *
 * Bisher gab es Länderspiele nur in den Pausen der Saison. Im Vorbild und
 * in Wirklichkeit ist der Sommer alle zwei Jahre ein Turniersommer: Die EM
 * 2028, die WM 2030, die EM 2032 ... Wer dort spielt, fehlt am Anfang der
 * Vorbereitung, kommt müde zurück - und als Weltmeister mit mehr Marktwert.
 *
 * Gespielt wird in den drei Wochen der Sommerpause:
 *   EM - die 16 stärksten europäischen Nationen, vier Gruppen, dann
 *        Viertelfinale, Halbfinale, Finale.
 *   WM - die 32 stärksten Nationen, acht Gruppen, dann Achtelfinale bis
 *        Finale.
 * Je Gruppe kommen die ersten zwei weiter. Endet ein K.-o.-Spiel
 * unentschieden, entscheidet das Elfmeterschießen. Die Spiele rechnet die
 * NationalTeamEngine wie jedes Länderspiel (Tore, Müdigkeit, Verletzungen,
 * Länderspiele in der Akte). Betreut der Manager eine Nation, zählen die
 * Turnierspiele für seine Bilanz.
 */

const _tuResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const TurnierEngine = {
    /** Das erste Kalenderjahr der Karriere: Saison 1 ist 2026/27, ihr Sommer 2027 */
    STARTJAHR: 2026,
    EUROPA: ["Deutschland", "Niederlande", "Frankreich", "Österreich", "England", "Schweiz", "Norwegen", "Spanien",
        "Belgien", "Dänemark", "Kroatien", "Polen", "Portugal", "Türkei", "Italien", "Serbien", "Wales", "Schottland",
        "Irland", "Albanien", "Schweden", "Ungarn", "Tschechien", "Ukraine", "Griechenland", "Rumänien", "Slowakei",
        "Slowenien", "Bosnien-Herzegowina", "Island", "Finnland", "Nordirland", "Georgien"],
    /** An welchen Tagen der Sommerpause gespielt wird */
    TAGE: {
        em: { gruppe: [2, 5, 8], ko: [11, 14, 17] },
        wm: { gruppe: [2, 5, 8], ko: [11, 14, 17, 20] }
    },
    RUNDEN: { 16: "Achtelfinale", 8: "Viertelfinale", 4: "Halbfinale", 2: "Finale" },
    /** Müdigkeit beim Start in die Vorbereitung, Lohn für den Titel */
    MUEDE: 15,
    TITEL_WERT: 0.1,

    _nt() { return _tuResolve("NationalTeamEngine", "./nationalTeamEngine.js"); },

    /** Welches Turnier im Sommer nach dieser Saison ansteht - oder null */
    art(state) {
        const jahr = this.STARTJAHR + (state?.seasonYear || 1);
        if (jahr % 4 === 0) return "em";
        if (jahr % 4 === 2) return "wm";
        return null;
    },

    name(art, jahr) { return `${art === "em" ? "Europameisterschaft" : "Weltmeisterschaft"} ${jahr}`; },
    kurz(art) { return art === "em" ? "EM" : "WM"; },

    _index(state) {
        return new Map((state.players || []).map(p => [String(p.id), p]));
    },

    /** Am ersten Tag der Sommerpause: Teilnehmer, Gruppen, Kader */
    starte(state) {
        const art = this.art(state);
        const nt = this._nt();
        if (!art || !nt || (state.turnier && state.turnier.saison === state.seasonYear)) return state.turnier || null;
        const jahr = this.STARTJAHR + (state.seasonYear || 1);
        const nationen = nt.nationen(state).filter(n => art === "wm" || this.EUROPA.includes(n.name));
        const teams = nationen.map(n => {
            const kader = nt.nominiere(n);
            return { name: n.name, kader: kader.map(p => p.id), staerke: nt.elf(kader).staerke };
        }).filter(t => t.kader.length >= 16).sort((a, b) => b.staerke - a.staerke);
        const groesse = art === "wm" ? 32 : 16;
        const anzahl = Math.min(groesse, Math.floor(teams.length / 4) * 4);
        if (anzahl < 8) return null;
        const dabei = teams.slice(0, anzahl);
        // Töpfe: die Stärksten verteilt, je einer pro Gruppe
        const gruppenZahl = anzahl / 4;
        const gruppen = Array.from({ length: gruppenZahl }, (_, i) => ({ name: `Gruppe ${String.fromCharCode(65 + i)}`, teams: [] }));
        dabei.forEach((t, i) => {
            const topf = Math.floor(i / gruppenZahl);
            const g = topf % 2 === 0 ? i % gruppenZahl : gruppenZahl - 1 - (i % gruppenZahl);
            gruppen[g].teams.push(t.name);
        });
        const index = this._index(state);
        dabei.forEach(t => t.kader.forEach(id => { const p = index.get(String(id)); if (p) p.abgestellt = t.name; }));
        state.turnier = {
            saison: state.seasonYear || 1, art, jahr, name: this.name(art, jahr),
            teams: Object.fromEntries(dabei.map(t => [t.name, { kader: t.kader }])),
            gruppen: gruppen.map(g => ({ name: g.name, teams: g.teams, spiele: [] })),
            ko: [], siegerName: null, torjaeger: null, abgeschlossen: false
        };
        this._post(state, `🏆 ${state.turnier.name} beginnt`, this._startText(state));
        return state.turnier;
    },

    _startText(state) {
        const t = state.turnier;
        const eigene = (state.players || []).filter(p => p.clubId === state.userClubId && p.abgestellt && t.teams[p.abgestellt]);
        return `${Object.keys(t.teams).length} Nationen spielen um den Titel: ${t.gruppen.map(g => `${g.name}: ${g.teams.join(", ")}`).join("; ")}.`
            + (eigene.length ? `\n\nAus unserem Kader dabei: ${eigene.map(p => `${p.name} (${p.abgestellt})`).join(", ")}. Sie kommen müde in die Vorbereitung.` : "");
    },

    _team(state, name, index) {
        const nt = this._nt();
        const kader = (state.turnier.teams[name]?.kader || []).map(id => index.get(String(id)))
            .filter(p => p && !(p.injuredWeeks > 0));
        return Object.assign({ name, kader }, nt.elf(kader));
    },

    _spiel(state, heim, gast, ko, zufall) {
        const nt = this._nt();
        const index = this._index(state);
        const e = nt.spiele(state, this._team(state, heim, index), this._team(state, gast, index), zufall);
        const spiel = { h: heim, a: gast, t: e.tore, s: e.torschuetzen.map(x => x.id) };
        if (ko && e.tore[0] === e.tore[1]) {
            // Elfmeterschießen: leichte Vorteile für die Stärkere
            const sh = this._team(state, heim, index).staerke, sa = this._team(state, gast, index).staerke;
            spiel.elfmeter = zufall() < 0.5 + Math.max(-0.15, Math.min(0.15, (sh - sa) / 40)) ? heim : gast;
        }
        return spiel;
    },

    sieger(spiel) {
        if (spiel.t[0] > spiel.t[1]) return spiel.h;
        if (spiel.t[1] > spiel.t[0]) return spiel.a;
        return spiel.elfmeter || null;
    },

    /** Die Tabelle einer Gruppe */
    tabelle(gruppe) {
        const z = new Map(gruppe.teams.map(n => [n, { name: n, sp: 0, s: 0, u: 0, n: 0, tore: 0, gegen: 0, punkte: 0 }]));
        gruppe.spiele.forEach(sp => {
            const h = z.get(sp.h), a = z.get(sp.a);
            h.sp++; a.sp++; h.tore += sp.t[0]; h.gegen += sp.t[1]; a.tore += sp.t[1]; a.gegen += sp.t[0];
            if (sp.t[0] > sp.t[1]) { h.s++; a.n++; h.punkte += 3; } else if (sp.t[1] > sp.t[0]) { a.s++; h.n++; a.punkte += 3; } else { h.u++; a.u++; h.punkte++; a.punkte++; }
        });
        return [...z.values()].sort((x, y) => y.punkte - x.punkte || (y.tore - y.gegen) - (x.tore - x.gegen) || y.tore - x.tore);
    },

    /** Ein Tag der Sommerpause - gibt Zeilen für den Tagesbericht zurück */
    tag(state, pauseTag, zufall = Math.random) {
        if (!this.art(state)) return [];
        if (pauseTag === 1) return this.starte(state) ? [`🏆 ${state.turnier.name}: Die Nationen reisen an`] : [];
        const t = state.turnier;
        if (!t || t.saison !== state.seasonYear || t.abgeschlossen) return [];
        const plan = this.TAGE[t.art];
        const zeilen = [];
        const g = plan.gruppe.indexOf(pauseTag);
        if (g >= 0) {
            // Spieltag g der Gruppe: 0-1 2-3, 0-2 1-3, 0-3 1-2
            const paare = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]][g];
            t.gruppen.forEach(gr => paare.forEach(([i, j]) => gr.spiele.push(this._spiel(state, gr.teams[i], gr.teams[j], false, zufall))));
            zeilen.push(`🏆 ${this.kurz(t.art)}: ${g + 1}. Gruppenspieltag`);
            if (g === 2) this._ersteKoRunde(t);
            return zeilen.concat(this._eigeneNation(state, g === 2 ? "Gruppenphase" : null));
        }
        const k = plan.ko.indexOf(pauseTag);
        if (k >= 0 && t.ko[k] && !t.ko[k].fertig) {
            const runde = t.ko[k];
            runde.spiele = runde.paare.map(([h, a]) => this._spiel(state, h, a, true, zufall));
            runde.fertig = true;
            const weiter = runde.spiele.map(sp => this.sieger(sp));
            if (weiter.length === 1) {
                this._abschluss(state, weiter[0]);
                return [`🏆 ${t.name}: ${weiter[0]} ist ${t.art === "em" ? "Europameister" : "Weltmeister"}`];
            }
            t.ko.push({ name: this.RUNDEN[weiter.length], paare: Array.from({ length: weiter.length / 2 }, (_, i) => [weiter[2 * i], weiter[2 * i + 1]]), spiele: [], fertig: false });
            zeilen.push(`🏆 ${this.kurz(t.art)}: ${runde.name} gespielt`);
            return zeilen.concat(this._eigeneNation(state, runde.name));
        }
        return zeilen;
    },

    _ersteKoRunde(t) {
        const tabellen = t.gruppen.map(g => this.tabelle(g));
        // Kreuzweise: Erster A gegen Zweiter B, Erster B gegen Zweiter A ...
        const paare = [];
        for (let i = 0; i < tabellen.length; i += 2) {
            paare.push([tabellen[i][0].name, tabellen[i + 1][1].name]);
            paare.push([tabellen[i + 1][0].name, tabellen[i][1].name]);
        }
        t.ko.push({ name: this.RUNDEN[paare.length * 2], paare, spiele: [], fertig: false });
    },

    /** Für den Nationaltrainer: Weiter oder raus? */
    _eigeneNation(state, phase) {
        const nation = state.nationaltrainer?.nation;
        const t = state.turnier;
        if (!phase || !nation || !t.teams[nation]) return [];
        const naechste = t.ko[t.ko.length - 1];
        const weiter = !!naechste && !naechste.fertig && naechste.paare.some(p => p.includes(nation));
        this._post(state, weiter ? `🏆 ${nation} ist weiter` : `🏆 ${nation} scheidet aus`,
            weiter ? `Nach der ${phase} geht es weiter: ${naechste.name}.` : `Für ${nation} ist das Turnier nach der ${phase} vorbei.`);
        return [weiter ? `🏆 ${nation} steht in der Runde: ${naechste.name}` : `🏆 ${nation} scheidet aus`];
    },

    _abschluss(state, siegerName) {
        const t = state.turnier;
        t.siegerName = siegerName;
        t.abgeschlossen = true;
        // Torjäger des Turniers
        const tore = new Map();
        t.gruppen.forEach(g => g.spiele.forEach(sp => sp.s.forEach(id => tore.set(String(id), (tore.get(String(id)) || 0) + 1))));
        t.ko.forEach(r => (r.spiele || []).forEach(sp => sp.s.forEach(id => tore.set(String(id), (tore.get(String(id)) || 0) + 1))));
        const index = this._index(state);
        const [tjId, tjTore] = [...tore.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
        const tj = tjId ? index.get(tjId) : null;
        t.torjaeger = tj ? { id: tj.id, name: tj.name, nation: tj.nationality, tore: tjTore } : null;
        // Titel in die Akte, Marktwert und Laune
        const titelArt = t.art === "em" ? "europameister" : "weltmeister";
        (t.teams[siegerName]?.kader || []).forEach(id => {
            const p = index.get(String(id));
            if (!p) return;
            if (!Array.isArray(p.auszeichnungen)) p.auszeichnungen = [];
            p.auszeichnungen.push({ art: titelArt, saison: t.saison, jahr: t.jahr });
            if (typeof p.value === "number") p.value = Math.round(p.value * (1 + this.TITEL_WERT));
            p.morale = Math.min(100, (p.morale ?? 70) + 10);
        });
        if (tj) {
            if (!Array.isArray(tj.auszeichnungen)) tj.auszeichnungen = [];
            tj.auszeichnungen.push({ art: "turnierTorjaeger", saison: t.saison, jahr: t.jahr, turnier: this.kurz(t.art) });
        }
        const finale = t.ko[t.ko.length - 1].spiele[0];
        const eigene = (t.teams[siegerName]?.kader || []).map(id => index.get(String(id))).filter(p => p && p.clubId === state.userClubId);
        this._post(state, `🏆 ${siegerName} gewinnt die ${t.name}`,
            `Finale: ${finale.h} - ${finale.a} ${finale.t[0]}:${finale.t[1]}${finale.elfmeter ? " (im Elfmeterschießen)" : ""}.`
            + (t.torjaeger ? ` Torschützenkönig: ${t.torjaeger.name} (${t.torjaeger.nation}) mit ${t.torjaeger.tore} Toren.` : "")
            + (eigene.length ? `\n\nAus unserem Kader ${t.art === "em" ? "Europameister" : "Weltmeister"}: ${eigene.map(p => p.name).join(", ")}.` : ""));
    },

    /**
     * Zum Saisonwechsel: Die Turnierspieler kehren zurück - müde, die
     * Ausgeschiedenen etwas enttäuscht.
     */
    rueckkehr(state) {
        const t = state.turnier;
        if (!t || t.saison !== state.seasonYear || t.zurueck) return 0;
        const index = this._index(state);
        let n = 0;
        Object.entries(t.teams).forEach(([name, team]) => team.kader.forEach(id => {
            const p = index.get(String(id));
            if (!p || p.abgestellt !== name) return;
            p.abgestellt = null;
            p.fitness = Math.max(40, (p.fitness ?? 90) - this.MUEDE);
            if (name !== t.siegerName) p.morale = Math.max(0, (p.morale ?? 70) - 3);
            n++;
        }));
        t.zurueck = true;
        return n;
    },

    _post(state, betreff, text) {
        if (!Array.isArray(state.inbox)) return;
        state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday, date: state.currentDate || "",
            sender: "Fußballverband", subject: betreff, body: text, read: false, type: "news" });
    },

    /** Für die Akte */
    titelName(a) {
        if (a.art === "weltmeister") return `Weltmeister ${a.jahr || ""}`.trim();
        if (a.art === "europameister") return `Europameister ${a.jahr || ""}`.trim();
        if (a.art === "turnierTorjaeger") return `Torschützenkönig ${a.turnier || ""} ${a.jahr || ""}`.trim();
        return null;
    }
};

if (typeof window !== "undefined") {
    window.TurnierEngine = TurnierEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { TurnierEngine };
}
