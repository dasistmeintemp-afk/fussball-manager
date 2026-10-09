/**
 * VisionEngine - Der Plan des Vorstands über mehrere Spielzeiten
 *
 * Bisher kannte der Vorstand nur das Saisonziel. Wer drei Jahre lang
 * Mittelmaß ablieferte, aber jedes Jahr knapp über dem Ziel landete, galt als
 * Erfolg - und wer eine Mannschaft aufbaute, bekam dafür nichts gutgeschrieben.
 * Jetzt legt der Vorstand bei Amtsantritt eine Vision über fünf Spielzeiten
 * fest:
 *
 *   Sportlich   - ein Ziel mit Frist: Aufstieg, Europapokal, Meisterschaft
 *                 oder sich oben festsetzen - je nachdem, wo der Verein steht.
 *   Spielweise  - offensiv, das Spiel bestimmen oder kompakt verteidigen.
 *                 Gemessen an Toren, Ballbesitz und Gegentoren der Saison.
 *   Kader       - Eigengewächse einbauen oder junge Spieler holen.
 *   Finanzen    - ohne Schulden wirtschaften oder im Gehaltsrahmen bleiben.
 *
 * Jede Saison bewertet der Vorstand die Jahresziele; das Fernziel zählt zur
 * Frist. Erfüllt hebt das Vertrauen, verfehlt kostet es. Nach fünf
 * Spielzeiten oder beim Vereinswechsel gibt es eine neue Vision.
 */

const _viResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const VisionEngine = {
    LAUFZEIT: 5,
    /** Wirkung auf das Vertrauen je Ziel - und beim Fernziel zur Frist */
    WIRKUNG: { erfuellt: 3, verfehlt: -3, fernErfuellt: 8, fernVerfehlt: -8 },

    /** Die Jahresziele: Wie gemessen wird und ab wann es reicht */
    JAHRESZIELE: {
        offensiv: { bereich: "Spielweise", text: "Offensiver, mitreißender Fußball", einheit: "Tore je Spiel", soll: 1.7, richtung: 1, messe: (w) => w.toreJeSpiel },
        ballbesitz: { bereich: "Spielweise", text: "Das Spiel bestimmen", einheit: "% Ballbesitz", soll: 54, richtung: 1, messe: (w) => w.ballbesitz },
        kompakt: { bereich: "Spielweise", text: "Kompakt und schwer zu schlagen", einheit: "Gegentore je Spiel", soll: 1.2, richtung: -1, messe: (w) => w.gegentoreJeSpiel },
        jugend: { bereich: "Kader", text: "Eigengewächse in die erste Mannschaft", einheit: "Eigengewächse mit 10+ Einsätzen", soll: 2, richtung: 1, messe: (w) => w.eigengewaechse },
        jung: { bereich: "Kader", text: "Junge Spieler verpflichten", einheit: "% der Zugänge bis 23", soll: 50, richtung: 1, messe: (w) => w.jungeZugaenge },
        schuldenfrei: { bereich: "Finanzen", text: "Ohne Schulden wirtschaften", einheit: "Kontostand", soll: 0, richtung: 1, messe: (w) => w.kontostand, geld: true },
        gehaltsrahmen: { bereich: "Finanzen", text: "Im Gehaltsrahmen bleiben", einheit: "% des Gehaltsetats", soll: 100, richtung: -1, messe: (w) => w.gehaltsquote }
    },

    _eigener(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },
    /** Die laufende Station des Trainers - eine neue Station bringt eine neue Vision */
    _station(state) {
        const karriere = _viResolve("CareerEngine", "./careerEngine.js");
        const s = karriere && typeof karriere.aktuelleStation === "function" ? karriere.aktuelleStation(state) : null;
        return s ? `${s.clubId}|${s.vonSaison}|${s.vonSpieltag}` : `${state?.userClubId}`;
    },
    _liga(state, club) {
        const ligen = _viResolve("LEAGUES_DATA", "../data/leagueData.js") || [];
        const liste = Array.isArray(ligen) ? ligen : (ligen.LEAGUES_DATA || []);
        return liste.find(l => l.id === club?.leagueId) || (state?.leagues || []).find(l => l.id === club?.leagueId) || null;
    },
    _geld(betrag) {
        const gs = _viResolve("GameState", "./gameState.js");
        return gs && typeof gs.formatMoney === "function" ? gs.formatMoney(betrag) : `${Math.round(betrag)} €`;
    },
    _post(state, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || `Saison ${state.seasonYear || 1}`, sender: "Vorstand", subject: betreff, body: text, read: false, type: "board" });
    },

    /** Wo der Kader in der eigenen Liga steht (1 = stärkster) */
    _kaderRang(state, club) {
        const z = club?.vorstandsziel;
        if (z && z.raenge && z.leagueId === club.leagueId && z.saison === (state.seasonYear || 1)) return { rang: z.raenge.kader, n: z.n };
        const ce = _viResolve("ContractEngine", "./contractEngine.js");
        const vereine = (state.clubs || []).filter(c => c.leagueId === club.leagueId);
        const spielerNach = new Map((state.players || []).map(p => [p.id, p]));
        const wert = (c) => ce && typeof ce.vereinsNiveau === "function" ? (ce.vereinsNiveau(c, spielerNach) ?? 0) : (c.reputation || 0);
        const reihe = vereine.map(c => ({ id: c.id, v: wert(c) })).sort((a, b) => b.v - a.v);
        return { rang: reihe.findIndex(x => x.id === club.id) + 1, n: vereine.length || 18 };
    },

    /** Das Fernziel: was der Verein in welcher Frist erreichen soll */
    fernziel(state, club) {
        const liga = this._liga(state, club);
        const { rang, n } = this._kaderRang(state, club);
        const saison = state.seasonYear || 1;
        const level = club.level || 1;
        const europa = liga?.europeanSpots ? Math.max(...Object.values(liga.europeanSpots).flat()) : 0;
        if (level > 1) {
            const schnell = rang <= 4;
            return { art: "aufstieg", text: `Aufstieg ${schnell ? "innerhalb von zwei Spielzeiten" : "innerhalb von vier Spielzeiten"}`, bisSaison: saison + (schnell ? 1 : 3), level };
        }
        if (rang <= 2) return { art: "titel", text: "Meisterschaft in den nächsten drei Spielzeiten", bisSaison: saison + 2, level };
        if (europa && rang <= europa + 2) return { art: "europa", text: "Europapokal in den nächsten drei Spielzeiten", bisSaison: saison + 2, platz: europa, level };
        if (rang <= Math.ceil(n * 0.66)) return { art: "obereHaelfte", text: "In der oberen Tabellenhälfte festsetzen - bis zur vierten Spielzeit", bisSaison: saison + 3, platz: Math.floor(n / 2), level };
        return { art: "etablieren", text: "In der Liga etablieren: kein Abstieg in fünf Spielzeiten", bisSaison: saison + 4, level };
    },

    /** Die Vision für den eigenen Verein - neu bei Amtsantritt, Vereinswechsel oder nach fünf Spielzeiten */
    /** Fester Zufall aus Verein und Saison - die Zufallsfolge der Welt bleibt unberührt */
    _fest(club, saison) {
        let h = 2166136261;
        const text = `${club.id}|${saison}`;
        for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
        let a = h >>> 0;
        return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    },

    vision(state, zufall = null) {
        const club = this._eigener(state);
        if (!club) return null;
        const saison = state.seasonYear || 1;
        const v = club.vision;
        if (v && v.station === this._station(state) && v.bisSaison >= saison) return v;
        return this.lege(state, club, zufall);
    },

    lege(state, club, zufall = null) {
        const saison = state.seasonYear || 1;
        zufall = zufall || this._fest(club, saison);
        const ruf = club.reputation || 50;
        const wahl = (liste) => liste[Math.floor(zufall() * liste.length) % liste.length];
        const spielweise = ruf >= 75 ? wahl(["offensiv", "ballbesitz"]) : (ruf >= 55 ? wahl(["offensiv", "ballbesitz", "kompakt"]) : wahl(["kompakt", "offensiv"]));
        const fac = _viResolve("FacilityEngine", "./facilityEngine.js");
        const jugendStufe = fac && typeof fac.hole === "function" ? (fac.hole(club, saison)?.youthCenter?.stufe ?? 2) : (club.facilities?.youthCenter ?? 2);
        const kader = jugendStufe >= 3 ? "jugend" : "jung";
        const finanzen = (club.balance || 0) < (club.transferBudget || 0) * 1.5 ? "schuldenfrei" : "gehaltsrahmen";
        club.vision = {
            seit: saison, bisSaison: saison + this.LAUFZEIT - 1, station: this._station(state),
            fern: { ...this.fernziel(state, club), status: "laeuft" },
            jahresziele: [spielweise, kader, finanzen],
            bilanz: []
        };
        const z = club.vision;
        this._post(state, "🧭 Die Vision des Vorstands",
            `Für die nächsten ${this.LAUFZEIT} Spielzeiten haben wir uns vorgenommen:\n\n`
            + `• ${z.fern.text}\n`
            + z.jahresziele.map(k => `• ${this.JAHRESZIELE[k].text} (jede Saison)`).join("\n")
            + `\n\nDas Saisonziel bleibt daneben bestehen. Jedes Jahr ziehen wir Bilanz - im Reiter Verein steht, wie weit wir sind.`);
        return z;
    },

    /** Was die laufende Saison bisher hergibt - für die Jahresziele */
    werte(state, club = null) {
        club = club || this._eigener(state);
        if (!club) return null;
        const saison = state.seasonYear || 1;
        const spiele = [];
        (state.schedule || []).forEach(r => (r.matches || []).forEach(m => {
            if (!m.played || (m.homeClubId !== club.id && m.awayClubId !== club.id)) return;
            const heim = m.homeClubId === club.id;
            spiele.push({
                tore: heim ? m.homeGoals : m.awayGoals, gegentore: heim ? m.awayGoals : m.homeGoals,
                ballbesitz: Array.isArray(m.stats?.possession) ? m.stats.possession[heim ? 0 : 1] : null
            });
        }));
        const n = spiele.length;
        const mit = spiele.filter(s => typeof s.ballbesitz === "number");
        const kader = (state.players || []).filter(p => p.clubId === club.id);
        const zugaenge = kader.filter(p => typeof p.vereinSeit === "number" && Math.floor(p.vereinSeit / 1000) === saison && !p.eigengewaechsVon);
        const fin = _viResolve("FinanceEngine", "./financeEngine.js");
        const lohn = fin && typeof fin.wochengehaelter === "function" ? fin.wochengehaelter(state, club) : kader.reduce((s, p) => s + (p.wage || 0), 0);
        return {
            spiele: n,
            toreJeSpiel: n ? Math.round(spiele.reduce((s, x) => s + x.tore, 0) / n * 100) / 100 : null,
            gegentoreJeSpiel: n ? Math.round(spiele.reduce((s, x) => s + x.gegentore, 0) / n * 100) / 100 : null,
            ballbesitz: mit.length ? Math.round(mit.reduce((s, x) => s + x.ballbesitz, 0) / mit.length) : null,
            eigengewaechse: kader.filter(p => p.eigengewaechsVon === club.id && (p.stats?.matches || 0) >= 10).length,
            jungeZugaenge: zugaenge.length >= 2 ? Math.round(zugaenge.filter(p => (p.age || 30) <= 23).length / zugaenge.length * 100) : null,
            zugaenge: zugaenge.length,
            kontostand: club.balance || 0,
            gehaltsquote: club.wageBudget > 0 ? Math.round(lohn / club.wageBudget * 100) : null
        };
    },

    /** Steht ein Jahresziel gerade? true, false - oder null, wenn es noch nichts zu messen gibt */
    erfuellt(key, w) {
        const z = this.JAHRESZIELE[key];
        const ist = z ? z.messe(w) : null;
        if (ist === null || ist === undefined) return null;
        return z.richtung > 0 ? ist >= z.soll : ist <= z.soll;
    },

    /** Zum Saisonende: Bilanz der Jahresziele und des Fernziels */
    saisonEnde(state) {
        const club = this._eigener(state);
        const v = club?.vision;
        if (!v) return null;
        const saison = state.seasonYear || 1;
        if (v.bilanz.some(b => b.saison === saison)) return null;
        const w = this.werte(state, club);
        const vorstand = _viResolve("BoardEngine", "./boardEngine.js");
        const W = this.WIRKUNG;
        let wirkung = 0;
        const ergebnisse = v.jahresziele.map(key => {
            const ok = this.erfuellt(key, w);
            const status = ok === null ? "offen" : (ok ? "erfuellt" : "verfehlt");
            if (status === "erfuellt") wirkung += W.erfuellt;
            if (status === "verfehlt") wirkung += W.verfehlt;
            return { key, status, ist: this.JAHRESZIELE[key].messe(w) };
        });

        // Das Fernziel: erreicht? (der Aufstieg wird zum Saisonstart geprüft)
        const tabelle = state.standings || [];
        const platz = tabelle.findIndex(e => e.clubId === club.id) + 1;
        const liga = this._liga(state, club);
        const f = v.fern;
        if (f.status === "laeuft" && platz > 0) {
            const abstieg = Array.isArray(liga?.relegationSpots) && liga.relegationSpots.includes(platz);
            if (f.art === "titel" && platz === 1) f.status = "erfuellt";
            else if ((f.art === "europa" || f.art === "obereHaelfte") && platz <= f.platz) f.status = "erfuellt";
            else if (f.art === "etablieren" && abstieg) f.status = "verfehlt";
            else if (f.art === "etablieren" && saison >= f.bisSaison) f.status = "erfuellt";
            else if (f.art !== "aufstieg" && saison >= f.bisSaison) f.status = "verfehlt";
            if (f.status === "erfuellt") wirkung += W.fernErfuellt;
            if (f.status === "verfehlt") wirkung += W.fernVerfehlt;
        }
        v.bilanz.push({ saison, platz, ergebnisse, fern: f.status });
        if (wirkung && vorstand && typeof vorstand.stimmung === "function") vorstand.stimmung(state, wirkung);

        const zeile = (e) => {
            const z = this.JAHRESZIELE[e.key];
            const ist = e.ist === null || e.ist === undefined ? "nicht messbar" : (z.geld ? this._geld(e.ist) : `${String(e.ist).replace(".", ",")} ${z.einheit}`);
            return `${e.status === "erfuellt" ? "✅" : (e.status === "verfehlt" ? "❌" : "➖")} ${z.text}: ${ist}`;
        };
        this._post(state, "🧭 Bilanz der Vision",
            `Saison ${saison} im Blick auf unsere Vision:\n\n${ergebnisse.map(zeile).join("\n")}\n`
            + `${f.status === "erfuellt" ? "✅" : (f.status === "verfehlt" ? "❌" : "⏳")} ${f.text}`
            + (f.status === "laeuft" ? ` (Frist: Saison ${f.bisSaison})` : "")
            + `\n\n${wirkung > 0 ? "Der Vorstand ist zufrieden mit dem Weg." : (wirkung < 0 ? "Der Vorstand erwartet, dass wir auf Kurs kommen." : "Der Vorstand wartet ab.")}`);
        return { ergebnisse, fern: f.status, wirkung };
    },

    /** Zum Saisonstart: Ist der Aufstieg geschafft? Ist die Vision abgelaufen? */
    saisonstart(state) {
        const club = this._eigener(state);
        const v = club?.vision;
        if (!v) return this.vision(state);
        const f = v.fern;
        if (f.art === "aufstieg" && f.status === "laeuft") {
            const vorstand = _viResolve("BoardEngine", "./boardEngine.js");
            if ((club.level || 1) < f.level) {
                f.status = "erfuellt";
                if (vorstand) vorstand.stimmung(state, this.WIRKUNG.fernErfuellt);
            } else if ((state.seasonYear || 1) > f.bisSaison) {
                f.status = "verfehlt";
                if (vorstand) vorstand.stimmung(state, this.WIRKUNG.fernVerfehlt);
            }
        }
        return this.vision(state);
    },

    /** Für den Reiter Verein */
    uebersicht(state) {
        const club = this._eigener(state);
        const v = this.vision(state);
        if (!club || !v) return null;
        const w = this.werte(state, club);
        return {
            seit: v.seit, bisSaison: v.bisSaison,
            fern: v.fern,
            jahresziele: v.jahresziele.map(key => {
                const z = this.JAHRESZIELE[key];
                return { key, bereich: z.bereich, text: z.text, einheit: z.einheit, soll: z.soll, richtung: z.richtung, geld: !!z.geld, ist: z.messe(w), steht: this.erfuellt(key, w) };
            }),
            bilanz: v.bilanz.slice(-5).reverse(),
            spiele: w.spiele
        };
    }
};

if (typeof window !== "undefined") {
    window.VisionEngine = VisionEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { VisionEngine };
}
