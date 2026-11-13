/**
 * Länderspielpause im Verein: Talente trainieren bei den Profis mit, und der
 * Trainer kann ein Trainingsspiel ansetzen.
 *
 * Reisen Profis zu ihren Nationalmannschaften, rücken die interessantesten
 * Spieler aus U23 und U19 für die Pause ins Training der Ersten nach
 * (ladeGaesteEin, verabschiedeGaeste). Einmal je Pause gibt es ein
 * Trainingsspiel über zweimal 45 Minuten: Erste gegen U23, Erste gegen U19
 * oder U23 gegen U19 (spiele). Fehlen der Ersten Spieler, füllen die Gäste
 * und weitere Talente sie auf. Zur Pause wird durchgewechselt, damit jeder
 * spielt - am Ende steht für jeden eine Note.
 *
 * Gerechnet wird wie in den Ligen von U23 und U19: Tore nach dem
 * Stärkeunterschied der beiden Mannschaften (ReserveEngine), kein Livespiel.
 * Das Ergebnis zählt für nichts; es bringt Spielschärfe, kostet etwas
 * Kondition und zeigt, wer sich aufdrängt.
 */
"use strict";

function _tsResolve(name, pfad) {
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

const TrainingsspielEngine = {
    PAARUNGEN: {
        erste_u23: { heim: "erste", gast: "u23", titel: "Erste gegen U23" },
        erste_u19: { heim: "erste", gast: "u19", titel: "Erste gegen U19" },
        u23_u19: { heim: "u23", gast: "u19", titel: "U23 gegen U19" }
    },
    NAMEN: { erste: "Erste Mannschaft", u23: "U23", u19: "U19" },
    /** Rang der Mannschaften: Wer gegen die höhere spielt, kann sich zeigen */
    RANG: { erste: 3, u23: 2, u19: 1 },

    WERTE: {
        // Talente im Training der Profis: je abgestelltem Profi einer, höchstens so viele
        gaesteHoechstens: 6,
        gastMoral: 3,
        gastSchaerfe: 3,
        // Kader je Mannschaft im Trainingsspiel: zwei Elf, eine je Halbzeit
        kader: 22,
        // Hat die Erste weniger, füllen weitere Talente bis hierhin auf
        auffuellen: 18,
        // Tore wie in den Ligen des Unterbaus (ReserveEngine._ligaRunde), je Halbzeit die Hälfte
        tore: 1.35,
        spanne: 22,
        // Ein Platz ohne Spieler: so viel schwächer als der Schnitt der Profis (wie u23Staerke)
        luecke: 16,
        // Was neunzig Minuten bringen und kosten
        schaerfe: 6,
        kondition: 5,
        // Wer gegen die höhere Mannschaft glänzt, wer gegen die niedrigere enttäuscht
        noteStark: 7.5,
        moralStark: 4,
        noteSchwach: 5.6,
        moralSchwach: -2,
        // So viele Spiele bleiben im Spielstand
        behalten: 6
    },

    /** Wie oft ein Platz trifft und vorbereitet (Torwart nie) */
    TOR_GEWICHT: { ST: 5, LA: 3, RA: 3, OM: 2.6, LM: 1.7, RM: 1.7, ZM: 1.4, DM: 0.7, LV: 0.4, RV: 0.4, IV: 0.5, TW: 0 },
    VORLAGE_GEWICHT: { ST: 1.6, LA: 2.6, RA: 2.6, OM: 3, LM: 2.4, RM: 2.4, ZM: 2.2, DM: 1.2, LV: 1.3, RV: 1.3, IV: 0.4, TW: 0.05 },

    _reserve() { return _tsResolve("ReserveEngine", "./reserveEngine.js"); },
    _club(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },

    /** Läuft gerade eine Länderspielpause? */
    inPause(state) {
        const kal = _tsResolve("CalendarEngine", "./calendarEngine.js");
        const tag = kal && typeof kal.getCurrentDay === "function" ? kal.getCurrentDay(state) : null;
        return !!(tag && tag.laenderspielPause);
    },

    /** Die laufende Pause dieser Saison (NationalTeamEngine.abreise legt sie an) */
    pause(state) {
        const p = state?.laenderspielPause;
        return p && p.saison === (state.seasonYear || 1) ? p : null;
    },

    /** Das Trainingsspiel dieser Pause, wenn es schon gespielt ist */
    gespielt(state) {
        const p = this.pause(state);
        if (!p) return null;
        return (state.trainingsspiele || []).find(s => s.saison === p.saison && s.pause === p.nr) || null;
    },

    _bereit(p) {
        return (p.injuredWeeks || 0) <= 0 && !p.injured && !p.abgestellt && !p.leihe;
    },

    /** Aus welcher Mannschaft einer kommt: "u23", "u19" oder "erste" */
    herkunft(state, p) {
        const r = this._reserve();
        if (p.nominiertAus) return p.nominiertAus === r?.U19 ? "u19" : "u23";
        if (p.reserve) return p.reserve === r?.U19 ? "u19" : "u23";
        return (state.players || []).includes(p) ? "erste" : "u19";
    },

    /**
     * Wie interessant ein Talent für den Trainer der Ersten ist: Potenzial vor
     * Stärke, dazu die Form in U23 oder U19 und ein Bonus für die Jungen.
     */
    interesse(state, p) {
        const r = this._reserve();
        const saison = state?.seasonYear || 1;
        const b = r ? (r.bilanz(p, "u23", saison) || r.bilanz(p, "u19", saison)) : null;
        const form = b && b.form !== null && b.spiele >= 3 ? (b.form - 6.5) * 4 : 0;
        return (p.pot || p.overall || 0) + (p.overall || 0) * 0.6 + form + Math.max(0, 21 - (p.age || 21)) * 0.8;
    },

    /** Alle Talente aus U23 und U19, die mitmachen können - die interessantesten zuerst */
    talente(state) {
        const r = this._reserve();
        if (!r) return [];
        const gesehen = new Set();
        return r.teamKader(state, "u23").concat(r.teamKader(state, "u19"))
            // Junge Profis zählen in der U19 mit, trainieren aber ohnehin oben
            .filter(p => p && this._bereit(p) && this.herkunft(state, p) !== "erste" && !gesehen.has(String(p.id)) && gesehen.add(String(p.id)))
            .sort((a, b) => (this.interesse(state, b) - this.interesse(state, a)) || (String(a.id) < String(b.id) ? -1 : 1));
    },

    /** Die Talente, die in dieser Pause bei den Profis mittrainieren */
    gaeste(state) {
        const p = this.pause(state);
        if (!p || !Array.isArray(p.gaeste)) return [];
        const alle = new Map(this.talente(state).map(t => [String(t.id), t]));
        return p.gaeste.map(id => alle.get(String(id))).filter(Boolean);
    },

    /** Wie viele Profis des eigenen Vereins gerade abgestellt sind */
    abgestellte(state) {
        const club = this._club(state);
        const ids = new Set((club?.playerIds || []).map(String));
        return (state?.players || []).filter(p => p.abgestellt && ids.has(String(p.id)));
    },

    /**
     * Abreise der Nationalspieler: Für jeden, der fehlt, rückt ein Talent ins
     * Training der Profis nach (höchstens WERTE.gaesteHoechstens).
     */
    ladeGaesteEin(state) {
        const p = this.pause(state);
        if (!p) return [];
        const fehlen = this.abgestellte(state).length;
        const gaeste = fehlen ? this.talente(state).slice(0, Math.min(this.WERTE.gaesteHoechstens, fehlen)) : [];
        p.gaeste = gaeste.map(g => g.id);
        const zeile = (g) => `• ${g.name} (${g.age}, ${g.pos}, ${this.NAMEN[this.herkunft(state, g)]})`;
        const text = gaeste.length
            ? `${fehlen} ${fehlen === 1 ? "Profi ist" : "Profis sind"} bei den Nationalmannschaften. Dafür trainieren diese Talente bis zur Rückkehr bei den Profis mit:\n`
                + gaeste.map(zeile).join("\n") + "\n\n"
            : "Aus dem Profikader ist niemand abgestellt, die Talente bleiben in ihren Mannschaften.\n\n";
        this._post(state, "Co-Trainer", "Länderspielpause: Zeit für ein Trainingsspiel",
            text + "Die Liga ruht. Im Reiter Training können Sie einmal in dieser Pause ein Trainingsspiel ansetzen: "
            + "Erste gegen U23, Erste gegen U19 oder U23 gegen U19. Fehlen der Ersten Spieler, füllen Talente sie auf. "
            + "Danach bekommen Sie für jeden Spieler eine Note.");
        return gaeste;
    },

    /** Rückkehr der Nationalspieler: Die Gäste gehen zurück - mit etwas Selbstvertrauen und Schärfe */
    verabschiedeGaeste(state) {
        const p = this.pause(state);
        const gaeste = this.gaeste(state);
        if (p) p.gaeste = [];
        gaeste.forEach(g => {
            if (typeof g.morale === "number") g.morale = Math.min(100, g.morale + this.WERTE.gastMoral);
            if (typeof g.matchSharpness === "number") g.matchSharpness = Math.min(100, g.matchSharpness + this.WERTE.gastSchaerfe);
        });
        if (gaeste.length) {
            this._post(state, "Co-Trainer", gaeste.length === 1 ? `${gaeste[0].name} trainiert wieder im Nachwuchs` : `${gaeste.length} Talente trainieren wieder im Nachwuchs`,
                `Die Nationalspieler sind zurück, die Gäste aus dem Nachwuchs gehen in ihre Mannschaften: ${gaeste.map(g => g.name).join(", ")}. `
                + "Die Tage bei den Profis haben ihnen gutgetan.");
        }
        return gaeste;
    },

    /** Was zur Wahl steht: jede Paarung mit Grund, falls sie nicht geht */
    optionen(state) {
        const inPause = this.inPause(state);
        const schon = this.gespielt(state);
        return Object.keys(this.PAARUNGEN).map(id => {
            const pa = this.PAARUNGEN[id];
            let grund = null;
            if (!inPause || !this.pause(state)) grund = "Trainingsspiele gibt es in der Länderspielpause.";
            else if (schon) grund = "In dieser Pause ist schon ein Trainingsspiel gespielt.";
            else {
                const k = this.kader(state, id);
                const knapp = [pa.heim, pa.gast].find(t => k[t].length < 7);
                if (knapp) grund = `Die ${this.NAMEN[knapp]} bekommt keine Mannschaft zusammen.`;
            }
            return { id, titel: pa.titel, ok: !grund, grund };
        });
    },

    /**
     * Die Kader beider Mannschaften einer Paarung. Die Erste: alle Profis, die
     * da sind, dazu die Gäste der Pause - und weitere Talente, bis der Kader
     * voll ist. Wer bei der Ersten aushilft, fehlt seiner eigenen Mannschaft.
     */
    kader(state, paarungId) {
        const pa = this.PAARUNGEN[paarungId];
        const r = this._reserve();
        const club = this._club(state);
        const aus = { erste: [], u23: [], u19: [] };
        if (!pa || !r || !club) return aus;
        const vergeben = new Set();
        const nimm = (liste) => liste.filter(p => !vergeben.has(String(p.id)) && vergeben.add(String(p.id)));
        if (pa.heim === "erste") {
            // Die Gäste der Pause spielen immer mit; sind mehr Profis da, als Platz ist, bleiben die schwächsten draußen
            const gaeste = this.gaeste(state);
            const stamm = new Set((club.lineup || []).map(String));
            const profis = r.profis(state, club).filter(p => this._bereit(p))
                .sort((a, b) => (stamm.has(String(b.id)) - stamm.has(String(a.id))) || ((b.overall || 0) - (a.overall || 0)))
                .slice(0, Math.max(11, this.WERTE.kader - gaeste.length));
            aus.erste = nimm(profis).map(p => ({ p, gast: null }));
            let grenze = this.WERTE.kader;
            const fuell = (kandidaten) => {
                kandidaten.forEach(t => {
                    if (aus.erste.length >= grenze || vergeben.has(String(t.id))) return;
                    // Ein zweiter Torwart reicht
                    if (t.pos === "TW" && aus.erste.filter(e => e.p.pos === "TW").length >= 2) return;
                    vergeben.add(String(t.id));
                    aus.erste.push({ p: t, gast: this.herkunft(state, t) });
                });
            };
            fuell(gaeste);
            grenze = this.WERTE.auffuellen;
            // Ohne Torwart kein Spiel: Der beste aus dem Nachwuchs rückt nach
            if (!aus.erste.some(e => e.p.pos === "TW")) { grenze = this.WERTE.kader; fuell(this.talente(state).filter(t => t.pos === "TW").slice(0, 1)); grenze = this.WERTE.auffuellen; }
            // Aufgefüllt wird aus der Mannschaft, die nicht der Gegner ist - zuerst
            const talente = this.talente(state).filter(t => t.pos !== "TW" || aus.erste.filter(e => e.p.pos === "TW").length < 2);
            const fremd = talente.filter(t => this.herkunft(state, t) !== pa.gast);
            fuell(fremd);
            if (aus.erste.length < 14) fuell(talente);
        }
        [pa.heim, pa.gast].filter(t => t !== "erste").forEach(team => {
            aus[team] = nimm(r.teamKader(state, team).filter(p => this._bereit(p)))
                .sort((a, b) => (b.overall || 0) - (a.overall || 0))
                .map(p => ({ p, gast: null }));
        });
        return aus;
    },

    /** Die Plätze der Formation einer Mannschaft */
    _plaetze(state, team) {
        const r = this._reserve();
        const club = this._club(state);
        const key = team === "erste" ? (club?.formation || club?.tactics?.formation) : r.teamPlan(state, team)?.formation;
        const f = r._formationVon(key) || r._formationVon("4-3-3") || r._formationVon(r.formationen()[0]?.key);
        return f ? f.positions.map(s => s.pos) : ["TW", "RV", "IV", "IV", "LV", "ZM", "ZM", "ZM", "RA", "ST", "LA"];
    },

    /**
     * Elf und Bank: Jeder Platz bekommt den, der dort am stärksten ist - das
     * Tor zuerst. In der Ersten spielt, wer sonst in der Startelf steht, wenn
     * er da ist (Bonus). Die Bank sind die Besten vom Rest.
     */
    stelleAuf(state, team, kader) {
        const r = this._reserve();
        const club = this._club(state);
        const stamm = new Set(team === "erste" ? (club?.lineup || []).map(String) : []);
        const frei = kader.slice();
        const plaetze = this._plaetze(state, team);
        const reihenfolge = plaetze.map((pos, i) => ({ pos, i })).sort((a, b) => (b.pos === "TW") - (a.pos === "TW"));
        const elf = new Array(plaetze.length).fill(null);
        reihenfolge.forEach(({ pos, i }) => {
            let best = null, wert = -1;
            frei.forEach(e => {
                if ((e.p.pos === "TW") !== (pos === "TW")) return;
                const w = r.staerkeAuf(e.p, pos) + (stamm.has(String(e.p.id)) ? 4 : 0);
                if (w > wert) { wert = w; best = e; }
            });
            if (best) { elf[i] = { ...best, pos }; frei.splice(frei.indexOf(best), 1); }
        });
        const bank = frei.sort((a, b) => (b.p.overall || 0) - (a.p.overall || 0)).slice(0, Math.max(0, this.WERTE.kader - 11));
        return { plaetze, elf, bank };
    },

    /**
     * Zur Pause wird durchgewechselt: Jeder von der Bank kommt auf den Platz,
     * der ihm am besten liegt - der Torwart nur ins Tor.
     */
    wechsle(elf, bank) {
        const r = this._reserve();
        const zweite = elf.map(e => (e ? { ...e } : null));
        const getauscht = new Set();
        bank.forEach(b => {
            let ziel = -1, wert = -1;
            zweite.forEach((e, i) => {
                if (getauscht.has(i)) return;
                const pos = e ? e.pos : null;
                if (!pos || (b.p.pos === "TW") !== (pos === "TW")) return;
                const w = r.platzEignung(b.p, pos);
                if (w > wert) { wert = w; ziel = i; }
            });
            if (ziel >= 0) { zweite[ziel] = { ...b, pos: zweite[ziel].pos }; getauscht.add(ziel); }
        });
        return zweite;
    },

    _staerke(elf, luecke) {
        const r = this._reserve();
        return elf.reduce((s, e) => s + (e ? r.staerkeAuf(e.p, e.pos) : luecke), 0) / Math.max(1, elf.length);
    },

    /** Der Platz ohne Seite und Zusatz: ZDM wird DM, LZM wird ZM, RIV wird IV, MS wird ST */
    _grundPos(pos) {
        const p = String(pos || "").toUpperCase();
        if (this.TOR_GEWICHT[p] !== undefined) return p;
        if (p === "MS" || p === "HS" || p.endsWith("ST")) return "ST";
        if (p.endsWith("AV")) return p[0] === "L" ? "LV" : "RV";
        const kurz = p.slice(1);
        return this.TOR_GEWICHT[kurz] !== undefined ? kurz : "ZM";
    },

    _waehle(elf, gewichte, wertVon, zufall, ohne = null) {
        const liste = elf.filter(e => e && e !== ohne).map(e => ({ e, w: (gewichte[this._grundPos(e.pos)] ?? 1) * Math.max(0.2, wertVon(e.p) / 60) }));
        const summe = liste.reduce((s, x) => s + x.w, 0);
        if (!(summe > 0)) return null;
        let z = zufall() * summe;
        for (const x of liste) { z -= x.w; if (z <= 0) return x.e; }
        return liste[liste.length - 1].e;
    },

    /**
     * Das Trainingsspiel dieser Pause spielen. Rückgabe { ok, spiel } oder
     * { ok: false, grund }.
     */
    spiele(state, paarungId, zufall = Math.random) {
        const opt = this.optionen(state).find(o => o.id === paarungId);
        if (!opt) return { ok: false, grund: "Diese Paarung gibt es nicht." };
        if (!opt.ok) return { ok: false, grund: opt.grund };
        const r = this._reserve();
        const W = this.WERTE;
        const pa = this.PAARUNGEN[paarungId];
        const club = this._club(state);
        const kader = this.kader(state, paarungId);
        const luecke = r._kaderSchnitt(state, club) - W.luecke;
        const lam = (d) => Math.max(0.12, W.tore / 2 * Math.exp(d / W.spanne));

        const teams = [pa.heim, pa.gast].map(team => {
            const a = this.stelleAuf(state, team, kader[team]);
            const zweite = this.wechsle(a.elf, a.bank);
            return { team, name: this.NAMEN[team], halb: [a.elf, zweite], tore: 0, daten: new Map() };
        });
        const eintrag = (t, e, halbzeit) => {
            const k = String(e.p.id);
            if (!t.daten.has(k)) t.daten.set(k, { e, pos: e.pos, minuten: 0, tore: 0, vorlagen: 0, gegentore: 0, start: halbzeit === 0 });
            return t.daten.get(k);
        };
        const tore = [];
        [0, 1].forEach(h => {
            const st = teams.map(t => this._staerke(t.halb[h], luecke));
            teams.forEach(t => t.halb[h].forEach(e => { if (e) eintrag(t, e, h).minuten += 45; }));
            teams.forEach((t, i) => {
                const n = r._poisson(lam(st[i] - st[1 - i]), zufall);
                for (let k = 0; k < n; k++) {
                    const schuetze = this._waehle(t.halb[h], this.TOR_GEWICHT, p => p.shooting || p.overall || 50, zufall);
                    if (!schuetze) continue;
                    const vorlage = zufall() < 0.7 ? this._waehle(t.halb[h], this.VORLAGE_GEWICHT, p => p.passing || p.overall || 50, zufall, schuetze) : null;
                    eintrag(t, schuetze, h).tore++;
                    if (vorlage) eintrag(t, vorlage, h).vorlagen++;
                    t.tore++;
                    const minute = h * 45 + 1 + Math.floor(zufall() * 45);
                    tore.push({ minute, team: t.team, name: schuetze.p.name, vorlage: vorlage ? vorlage.p.name : null });
                    // Das Gegentor trägt der Torwart der anderen Seite
                    const tw = teams[1 - i].halb[h].find(e => e && e.pos === "TW");
                    if (tw) eintrag(teams[1 - i], tw, h).gegentore++;
                }
            });
        });
        tore.sort((a, b) => a.minute - b.minute);

        // Noten: Tore, Vorlagen, Ergebnis, die eigene Stärke gegen die des Gegners, Tagesform
        const schnitt = teams.map(t => (this._staerke(t.halb[0], luecke) + this._staerke(t.halb[1], luecke)) / 2);
        const zeilen = teams.map((t, i) => {
            const ergebnis = Math.sign(t.tore - teams[1 - i].tore);
            return Array.from(t.daten.values()).map(d => {
                const p = d.e.p;
                let note = 6.3 + d.tore * 0.9 + d.vorlagen * 0.5 + ergebnis * 0.3
                    + (r.staerkeAuf(p, d.pos) - schnitt[1 - i]) * 0.04 + (zufall() - 0.5) * 1.4;
                if (d.pos === "TW") note += (d.gegentore === 0 ? 0.5 : -0.25 * d.gegentore);
                note = Math.round(Math.max(3, Math.min(10, note)) * 10) / 10;
                return { id: p.id, name: p.name, alter: p.age, pos: d.pos, eigenePos: p.pos, staerke: p.overall, note, tore: d.tore, vorlagen: d.vorlagen,
                    minuten: d.minuten, start: d.start, gast: d.e.gast, herkunft: d.e.gast || (t.team === "erste" ? "erste" : t.team), _p: p };
            }).sort((a, b) => (b.start - a.start) || (b.note - a.note));
        });

        // Wirkung: Spielschärfe und Kondition nach Minuten, Moral für die, die auffallen
        zeilen.forEach((liste, i) => {
            const gegner = teams[1 - i].team;
            liste.forEach(z => {
                const p = z._p, anteil = z.minuten / 90;
                if (typeof p.matchSharpness === "number") p.matchSharpness = Math.min(100, p.matchSharpness + W.schaerfe * anteil);
                if (typeof p.fitness === "number") p.fitness = Math.max(40, p.fitness - W.kondition * anteil);
                if (typeof p.morale !== "number") return;
                const eigenerRang = this.RANG[z.herkunft] || this.RANG[teams[i].team];
                if (z.note >= W.noteStark && eigenerRang < Math.max(this.RANG[teams[i].team], this.RANG[gegner])) p.morale = Math.min(100, p.morale + W.moralStark);
                else if (z.note <= W.noteSchwach && z.herkunft === "erste" && this.RANG[gegner] < this.RANG.erste) p.morale = Math.max(0, p.morale + W.moralSchwach);
            });
        });

        // Wer sich aufdrängt: die besten Noten von denen, die nicht zu den Profis gehören
        const auffaellig = zeilen.flat().filter(z => z.herkunft !== "erste" && z.note >= 7)
            .sort((a, b) => b.note - a.note).slice(0, 3)
            .map(z => ({ id: z.id, name: z.name, alter: z.alter, pos: z.pos, herkunft: z.herkunft, note: z.note, tore: z.tore, vorlagen: z.vorlagen }));
        const enttaeuscht = zeilen.flat().filter(z => z.herkunft === "erste" && z.note <= W.noteSchwach)
            .sort((a, b) => a.note - b.note).slice(0, 2)
            .map(z => ({ id: z.id, name: z.name, pos: z.pos, note: z.note }));

        const pause = this.pause(state);
        const spiel = {
            saison: pause.saison, pause: pause.nr, datum: state.currentDate || null, paarung: paarungId, titel: pa.titel,
            teams: teams.map((t, i) => ({
                team: t.team, name: t.name, tore: t.tore, staerke: Math.round(schnitt[i] * 10) / 10,
                spieler: zeilen[i].map(({ _p, ...rest }) => rest)
            })),
            tore, auffaellig, enttaeuscht
        };
        if (!Array.isArray(state.trainingsspiele)) state.trainingsspiele = [];
        state.trainingsspiele.unshift(spiel);
        state.trainingsspiele.length = Math.min(state.trainingsspiele.length, W.behalten);
        this._post(state, "Co-Trainer", `Trainingsspiel: ${teams[0].name} ${teams[0].tore}:${teams[1].tore} ${teams[1].name}`, this.bericht(spiel));
        return { ok: true, spiel };
    },

    /** Der Bericht fürs Postfach */
    bericht(spiel) {
        const [a, b] = spiel.teams;
        const tore = spiel.tore.length
            ? spiel.tore.map(t => `${t.minute}. ${t.name} (${this.NAMEN[t.team]})${t.vorlage ? `, Vorlage ${t.vorlage}` : ""}`).join("\n")
            : "Keine Tore.";
        const beste = (t) => t.spieler.slice().sort((x, y) => y.note - x.note).slice(0, 3).map(s => `${s.name} ${s.note.toFixed(1)}`).join(", ");
        const zahl = (z) => [z.tore ? `${z.tore} ${z.tore === 1 ? "Tor" : "Tore"}` : "", z.vorlagen ? `${z.vorlagen} ${z.vorlagen === 1 ? "Vorlage" : "Vorlagen"}` : ""].filter(Boolean).join(", ");
        let text = `${a.name} ${a.tore}:${b.tore} ${b.name}, zweimal 45 Minuten, zur Pause wurde durchgewechselt.\n\n${tore}\n\n`
            + `Beste Noten ${a.name}: ${beste(a)}\nBeste Noten ${b.name}: ${beste(b)}`;
        if (spiel.auffaellig.length) {
            text += "\n\nAufgedrängt haben sich:\n" + spiel.auffaellig.map(z => `• ${z.name} (${z.alter}, ${z.pos}, ${this.NAMEN[z.herkunft]}): Note ${z.note.toFixed(1)}${zahl(z) ? `, ${zahl(z)}` : ""}`).join("\n");
        }
        if (spiel.enttaeuscht.length) {
            text += "\n\nUnter ihren Möglichkeiten: " + spiel.enttaeuscht.map(z => `${z.name} (${z.note.toFixed(1)})`).join(", ") + ".";
        }
        return text + "\n\nAlle Noten stehen im Reiter Training.";
    },

    _post(state, absender, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: absender, subject: betreff, body: text, read: false, type: "info"
        });
    }
};

if (typeof window !== "undefined") {
    window.TrainingsspielEngine = TrainingsspielEngine;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { TrainingsspielEngine };
}
