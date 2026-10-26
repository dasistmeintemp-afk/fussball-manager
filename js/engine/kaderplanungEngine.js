/**
 * KaderplanungEngine - Der Kader über drei Spielzeiten
 *
 * Die Kadertabelle zeigt, wer heute da ist. Wer plant, will wissen, wer
 * nächstes und übernächstes Jahr noch da ist: Verträge laufen aus, Leihspieler
 * kehren zurück, Vorverträge bringen Zugänge, Ältere hören auf. Die Planung
 * stellt das je Mannschaftsteil nebeneinander - gemessen an dem, was der
 * Verein auf jeder Position braucht (der Kaderplan seiner Liga):
 *
 *   Lücke  - weniger Spieler, als die Position braucht
 *   dünn   - genug Spieler, aber zu wenige auf Stammspieler-Niveau
 *            (drei Sterne nach dem eingestellten Maßstab)
 *   gut    - beides passt
 *
 * Der Sportdirektor nennt die dringendsten Baustellen; jede lässt sich
 * direkt als Scouting-Auftrag losschicken.
 */

const _kpResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const KaderplanungEngine = {
    SAISONS: 3,
    /** Ab diesem Alter (in der jeweiligen Saison) ist ein Karriereende wahrscheinlich */
    ENDE_ALTER: 35,
    /** Ab diesem Alter steht ein Hinweis dran */
    SPAET_ALTER: 33,

    /** Die Mannschaftsteile der Planung - mit den Positionen des Kaderplans */
    TEILE: [
        { key: "tw", titel: "Torwart", ort: "im Tor", positionen: ["TW"], suche: "TW", stamm: 1 },
        { key: "iv", titel: "Innenverteidigung", ort: "in der Innenverteidigung", positionen: ["IV"], suche: "IV", stamm: 2 },
        { key: "av", titel: "Außenverteidigung", ort: "in der Außenverteidigung", positionen: ["LV", "RV"], suche: "LV", stamm: 2 },
        { key: "zm", titel: "Zentrales Mittelfeld", ort: "im zentralen Mittelfeld", positionen: ["DM", "ZM"], suche: "ZM", stamm: 2 },
        { key: "om", titel: "Offensive und Flügel", ort: "in Offensive und auf den Flügeln", positionen: ["OM", "LM", "RM", "LA", "RA"], suche: "OM", stamm: 3 },
        { key: "st", titel: "Sturm", ort: "im Sturm", positionen: ["ST"], suche: "ST", stamm: 1 }
    ],

    _eigener(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },
    _teil(pos) { return this.TEILE.find(t => t.positionen.includes(pos)) || this.TEILE[3]; },

    /** Was der Verein je Mannschaftsteil braucht - aus dem Kaderplan seiner Liga */
    bedarf(club) {
        const gen = _kpResolve("PlayerGenerator", "./playerGenerator.js");
        const welt = _kpResolve("WorldGenerator", "./worldGenerator.js");
        const soll = welt?.SQUAD_SIZES?.[club?.level || 1] || 22;
        const plan = gen && typeof gen.buildSquadPlan === "function" ? gen.buildSquadPlan(soll) : [];
        const bedarf = {};
        this.TEILE.forEach(t => { bedarf[t.key] = 0; });
        plan.forEach(pos => { bedarf[this._teil(pos).key]++; });
        return bedarf;
    },

    /** Ab welcher Stärke einer Stammspieler-Niveau hat (drei Sterne) */
    _stammStaerke(state) {
        const rating = _kpResolve("PlayerRatingEngine", "./playerRatingEngine.js");
        if (!rating) return 65;
        const bezug = typeof rating.sternBezug === "function" ? rating.sternBezug(state) : 140;
        return rating.overallForStars(3, { squadAverageAbility: bezug });
    },

    /**
     * Die Planung: je Mannschaftsteil und Saison, wer da ist und wie es
     * aussieht. k = 0 ist die laufende Saison.
     */
    plan(state) {
        const club = this._eigener(state);
        if (!club) return null;
        const saison = state.seasonYear || 1;
        const bedarf = this.bedarf(club);
        const stamm = this._stammStaerke(state);
        const eigene = (state.players || []).filter(p => p.clubId === club.id || (p.leihe && p.leihe.stammvereinId === club.id));
        const kommen = (state.players || []).filter(p => p.vorvertrag && p.vorvertrag.clubId === club.id && p.clubId !== club.id);

        const spalten = [];
        for (let k = 0; k < this.SAISONS; k++) {
            const da = [];
            eigene.forEach(p => {
                const verliehen = p.leihe && p.leihe.stammvereinId === club.id && p.clubId !== club.id;
                const geliehen = p.leihe && p.leihe.leihvereinId === club.id && p.leihe.stammvereinId !== club.id;
                if (k === 0 && verliehen) return;           // ist gerade weg
                if (k > 0 && geliehen) return;              // geht zurück zu seinem Verein
                if (k > 0 && p.vorvertrag && p.vorvertrag.clubId !== club.id) return; // hat woanders unterschrieben
                const laufzeit = p.contractYears ?? p.contract?.years ?? 2;
                if (k > 0 && laufzeit <= k) return;         // Vertrag ist dann ausgelaufen
                const alter = (p.age || 25) + k;
                if (k > 0 && alter >= this.ENDE_ALTER) return; // hört wahrscheinlich auf
                const marken = [];
                if (laufzeit <= k + 1) marken.push("vertrag");
                if (alter >= this.SPAET_ALTER) marken.push("alter");
                if (k > 0 && verliehen) marken.push("rueckkehr");
                if (geliehen) marken.push("leihe");
                da.push({ id: p.id, name: p.name, pos: p.pos, alter, staerke: p.overall || 0, stamm: (p.overall || 0) >= stamm, marken });
            });
            if (k > 0) kommen.forEach(p => da.push({ id: p.id, name: p.name, pos: p.pos, alter: (p.age || 25) + k, staerke: p.overall || 0, stamm: (p.overall || 0) >= stamm, marken: ["zugang"] }));

            const teile = this.TEILE.map(t => {
                const spieler = da.filter(s => this._teil(s.pos).key === t.key).sort((a, b) => b.staerke - a.staerke);
                const stammspieler = spieler.filter(s => s.stamm).length;
                const status = spieler.length < bedarf[t.key] ? "luecke" : (stammspieler < t.stamm ? "duenn" : "gut");
                return { key: t.key, titel: t.titel, bedarf: bedarf[t.key], anzahl: spieler.length, stammspieler, stammBedarf: t.stamm, status, spieler };
            });
            spalten.push({ saison: saison + k, teile });
        }
        return { saison, stammStaerke: stamm, spalten };
    },

    /** Die dringendsten Baustellen - die früheste Saison zuerst, Lücken vor dünnen Stellen */
    hinweise(state, anzahl = 3) {
        const p = this.plan(state);
        if (!p) return [];
        const liste = [];
        p.spalten.forEach((s, k) => s.teile.forEach(t => {
            if (t.status === "gut") return;
            if (liste.some(h => h.key === t.key)) return;
            const teil = this.TEILE.find(x => x.key === t.key);
            const gehen = k > 0 ? (p.spalten[k - 1].teile.find(x => x.key === t.key)?.spieler || [])
                .filter(a => !t.spieler.some(b => b.id === a.id)).map(a => a.name) : [];
            const wann = k === 0 ? "Schon jetzt" : (k === 1 ? "Nächste Saison" : `In Saison ${s.saison}`);
            const text = t.status === "luecke"
                ? `${wann} fehlen Spieler ${teil.ort}: ${t.anzahl} von ${t.bedarf}${gehen.length ? ` - ${gehen.slice(0, 2).join(" und ")} ${gehen.length === 1 ? "geht" : "gehen"}` : ""}.`
                : `${wann} fehlt Qualität ${teil.ort}: ${t.stammspieler} von ${t.stammBedarf} auf Stammspieler-Niveau.`;
            liste.push({ key: t.key, saison: s.saison, k, status: t.status, text, suche: teil.suche, gewicht: k * 2 + (t.status === "luecke" ? 0 : 1) });
        }));
        return liste.sort((a, b) => a.gewicht - b.gewicht).slice(0, anzahl);
    },

    /**
     * Grenzen der Bedarfsanalyse (bedarfsAnalyse): Verstärkung braucht, wer in
     * einem Mannschaftsteil weniger Spieler auf dem eigenen Kaderniveau hat
     * als Stammplätze; verliehen wird höchstens bis leiheAlter, erst hinter
     * den besten leiheRang des Kaders und höchstens leiheSpielraum unter den
     * Plan des Mannschaftsteils; verkauft, wer überzählig ist und ab
     * verkaufAlter oder verkaufUnter Punkte unter dem Kaderniveau liegt;
     * verlängert, wer mit auslaufendem Vertrag höchstens verlaengernUnter
     * unter dem Niveau liegt (Junge nach Potenzial) und jünger als ENDE_ALTER - 2 ist.
     */
    ANALYSE: { leiheAlter: 22, leiheRang: 13, leiheSpielraum: 1, verkaufAlter: 31, verkaufUnter: 6, verlaengernUnter: 3 },

    /**
     * Was ein Verein braucht - für jeden Verein, auch die KI: je
     * Mannschaftsteil gemessen am Kaderplan seiner Liga und am eigenen
     * Kaderniveau. Kompakt für Transfer-, Leih- und Vertrags-KI:
     *
     *   needs             Lücke (zu wenige Spieler), Nachfolge (nächste Saison
     *                     zu wenige: Vertrag läuft aus, Karriereende), Verstärkung
     *                     (zu wenige auf Kaderniveau) - dringendste zuerst
     *   sellCandidates    überzählig und alt oder klar unter dem Niveau
     *   loanCandidates    überzählig, jung, nicht in der ersten Reihe
     *   renewalCandidates Vertrag läuft aus, und er wird gebraucht
     *   reasons           dieselben Befunde als Sätze
     *
     * Leihspieler anderer Vereine zählen zum Bestand, stehen aber nie zum
     * Verkauf, zur Leihe oder zur Verlängerung. kader: die Spieler des Vereins,
     * falls schon zur Hand (sonst aus state.players).
     */
    bedarfsAnalyse(state, club, kader = null) {
        if (!club) return null;
        const a = this.ANALYSE;
        const spieler = (kader || (state?.players || []).filter(p => p.clubId === club.id)).filter(Boolean);
        const soll = this.bedarf(club);
        const niveau = spieler.length ? spieler.reduce((s, p) => s + (p.overall || 50), 0) / spieler.length : 50;
        const rang = new Map(spieler.slice().sort((x, y) => (y.overall || 0) - (x.overall || 0)).map((p, i) => [p.id, i]));
        const laufzeit = (p) => p.contractYears ?? p.contract?.years ?? 2;
        const fremd = (p) => !!(p.leihe && p.leihe.stammvereinId !== club.id);
        const kurz = (p, teil, reason) => ({ id: p.id, name: p.name, pos: p.pos, teil, alter: p.age || 25, staerke: p.overall || 0, reason });
        const needs = [], sellCandidates = [], loanCandidates = [], renewalCandidates = [];

        this.TEILE.forEach(t => {
            const liste = spieler.filter(p => this._teil(p.pos).key === t.key).sort((x, y) => (y.overall || 0) - (x.overall || 0));
            const n = soll[t.key] || 0;
            const bleiben = liste.filter(p => !fremd(p) && laufzeit(p) > 1 && (p.age || 25) + 1 < this.ENDE_ALTER).length;
            const aufNiveau = liste.filter(p => (p.overall || 0) >= niveau).length;
            if (liste.length < n) {
                needs.push({ teil: t.key, pos: t.suche, art: "luecke", fehlen: n - liste.length, dringlich: 3,
                    reason: `${t.titel}: ${liste.length} von ${n} Spielern` });
            } else if (bleiben < n) {
                needs.push({ teil: t.key, pos: t.suche, art: "nachfolge", fehlen: n - bleiben, dringlich: 2,
                    reason: `${t.titel}: nächste Saison nur ${bleiben} von ${n} (Vertragsende, Karriereende, Leihe)` });
            } else if (aufNiveau < t.stamm) {
                needs.push({ teil: t.key, pos: t.suche, art: "verstaerkung", fehlen: t.stamm - aufNiveau, dringlich: 1,
                    reason: `${t.titel}: ${aufNiveau} von ${t.stamm} auf Kaderniveau` });
            }
            // Überzählig: die Schwächsten über dem Plan, nie einer der Stammplätze.
            // Verkauft wird nur echter Überschuss. Verliehen werden darf auch,
            // wer den Teil einen Spieler unter Plan zurücklässt, solange mehr
            // als die Stammplätze bleiben (leiheSpielraum) - die Kader stehen
            // genau auf ihrem Plan, sonst verliehe kaum ein Verein.
            const eigene = liste.filter(p => !fremd(p));
            const ueber = Math.max(0, Math.min(liste.length - n, eigene.length - t.stamm));
            const leihbar = Math.max(0, Math.min(liste.length - n + a.leiheSpielraum, eigene.length - t.stamm - 1));
            (ueber > 0 ? eigene.slice(-ueber) : []).forEach(p => {
                // Wer jung ist, wird verliehen, nicht verkauft
                if ((p.age || 25) <= a.leiheAlter) return;
                if ((p.age || 25) >= a.verkaufAlter || (p.overall || 0) < niveau - a.verkaufUnter) {
                    sellCandidates.push(kurz(p, t.key, `überzählig ${t.ort}, ${(p.age || 25) >= a.verkaufAlter ? "älter" : "unter Kaderniveau"}`));
                }
            });
            (leihbar > 0 ? eigene.slice(-leihbar) : []).forEach(p => {
                if ((p.age || 25) > a.leiheAlter || (rang.get(p.id) ?? 0) < a.leiheRang) return;
                if (sellCandidates.some(x => x.id === p.id)) return;
                loanCandidates.push(kurz(p, t.key, `${liste.length > n ? "überzählig" : "ersetzbar"} ${t.ort}, jung, braucht Spielpraxis`));
            });
            // Auslaufende Verträge derer, die der Teil braucht
            eigene.forEach(p => {
                if (laufzeit(p) > 1 || (p.age || 25) >= this.ENDE_ALTER - 2) return;
                if (sellCandidates.some(s => s.id === p.id) || loanCandidates.some(s => s.id === p.id)) return;
                const gut = (p.overall || 0) >= niveau - a.verlaengernUnter;
                const talent = (p.age || 25) <= 23 && (p.pot || 0) >= niveau;
                if (gut || talent) renewalCandidates.push(kurz(p, t.key, gut ? "Vertrag läuft aus, auf Kaderniveau" : "Vertrag läuft aus, Talent"));
            });
        });

        needs.sort((x, y) => y.dringlich - x.dringlich || y.fehlen - x.fehlen);
        const reasons = [
            ...needs.map(b => b.reason),
            ...sellCandidates.map(p => `Verkauf: ${p.name} (${p.reason})`),
            ...loanCandidates.map(p => `Leihe: ${p.name} (${p.reason})`),
            ...renewalCandidates.map(p => `Verlängern: ${p.name} (${p.reason})`)
        ];
        return { clubId: club.id, niveau: Math.round(niveau * 10) / 10, needs, sellCandidates, loanCandidates, renewalCandidates, reasons };
    },

    /** Eine Baustelle als Scouting-Auftrag: Position, Stammspieler-Niveau, nicht zu alt */
    suchauftrag(state, key) {
        const teil = this.TEILE.find(t => t.key === key);
        const scouting = _kpResolve("ScoutingEngine", "./scoutingEngine.js");
        if (!teil || !scouting || typeof scouting.startAssignment !== "function") return { success: false, error: "Scouting ist nicht verfügbar." };
        return scouting.startAssignment(state, { position: teil.suche, maxAge: 27, minOverall: this._stammStaerke(state) });
    }
};

if (typeof window !== "undefined") {
    window.KaderplanungEngine = KaderplanungEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { KaderplanungEngine };
}
