/**
 * Entwicklung über die Zeit: Stärke und Marktwert der eigenen Spieler, ein
 * Punkt je Monat.
 *
 * Die Akte zeigt bisher nur den Stand von heute. Hier wird am Monatsersten
 * für jeden Spieler des eigenen Vereins (Profis, U23, U19) festgehalten, wie
 * stark und wie viel er wert ist - höchstens MAX Punkte je Spieler, das sind
 * vier Jahre. Wer den Verein verlässt, fällt beim nächsten Monatsersten
 * heraus. Gespeichert wird im Spielstand (state.spielerVerlauf), nicht am
 * Spieler: je Punkt [Datum, Stärke, Marktwert in Tausend].
 */
"use strict";

const VerlaufEngine = {
    MAX: 48,

    _eigene(state) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const ids = new Set((club?.playerIds || []).map(String));
        return (state?.players || []).filter(p => ids.has(String(p.id)));
    },

    _wert(p) {
        return Math.round((p.value ?? p.trueMarketValue ?? 0) / 1000);
    },

    /** Am Monatsersten: einen Punkt je eigenem Spieler festhalten */
    monatsStand(state, datum = state?.currentDate) {
        if (!state || !/^01\./.test(String(datum || ""))) return 0;
        return this.erfasse(state, datum);
    },

    erfasse(state, datum = state?.currentDate) {
        if (!state || !datum) return 0;
        if (!state.spielerVerlauf || typeof state.spielerVerlauf !== "object") state.spielerVerlauf = {};
        const v = state.spielerVerlauf;
        const eigene = this._eigene(state);
        const da = new Set(eigene.map(p => String(p.id)));
        Object.keys(v).forEach(id => { if (!da.has(id)) delete v[id]; });
        let n = 0;
        eigene.forEach(p => {
            const id = String(p.id);
            const reihe = Array.isArray(v[id]) ? v[id] : (v[id] = []);
            if (reihe.length && reihe[reihe.length - 1][0] === datum) return;
            reihe.push([datum, Math.round(p.overall || 0), this._wert(p)]);
            if (reihe.length > this.MAX) reihe.splice(0, reihe.length - this.MAX);
            n++;
        });
        return n;
    },

    /** Die Punkte eines Spielers, dazu der Stand von heute */
    verlauf(state, player) {
        if (!state || !player) return [];
        const reihe = (state.spielerVerlauf && state.spielerVerlauf[String(player.id)]) || [];
        const punkte = reihe.map(([datum, staerke, wert]) => ({ datum, staerke, wert: wert * 1000 }));
        const heute = state.currentDate || "";
        if (!punkte.length || punkte[punkte.length - 1].datum !== heute) {
            punkte.push({ datum: heute, staerke: Math.round(player.overall || 0), wert: this._wert(player) * 1000, heute: true });
        }
        return punkte;
    },

    /** Was sich seit dem ersten Punkt getan hat */
    bilanz(state, player) {
        const p = this.verlauf(state, player);
        if (p.length < 2) return null;
        const a = p[0], b = p[p.length - 1];
        return { seit: a.datum, staerke: b.staerke - a.staerke, wert: b.wert - a.wert, punkte: p.length };
    }
};

if (typeof window !== "undefined") {
    window.VerlaufEngine = VerlaufEngine;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { VerlaufEngine };
}
