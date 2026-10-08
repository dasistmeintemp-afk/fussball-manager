/**
 * LaufbahnEngine - Die Saisons eines Spielers
 *
 * Zum Saisonwechsel wurden Spiele, Tore, Vorlagen und Noten jedes Spielers
 * auf null gesetzt - archiviert wurde nichts. Eine Akte mit der Laufbahn
 * Saison für Saison gab es deshalb nicht.
 *
 * Jetzt bekommt jeder Spieler mit Einsätzen zum Saisonende eine Zeile:
 *   [Saison, Verein, Spiele, Tore, Vorlagen, Note × 100]
 * Wechselt er unter dem Jahr den Verein (Transfer oder Leihe), wird der
 * Stand bis dahin dem alten Verein gutgeschrieben - so stehen beide Vereine
 * mit ihren Spielen in der Laufbahn. Gespeichert werden die letzten zwölf
 * Zeilen; Spieler ohne Einsatz bekommen keine.
 */

const LaufbahnEngine = {
    MAX_ZEILEN: 12,

    _saison(state) { return state?.seasonYear || 1; },

    /** Die Teile dieser Saison zusammengezählt: [Spiele, Tore, Vorlagen, Notensumme × 10] */
    _summe(teile) {
        return teile.reduce((s, t) => [s[0] + t[2], s[1] + t[3], s[2] + t[4], s[3] + t[5]], [0, 0, 0, 0]);
    },

    /** Was seit dem letzten Wechsel dazukam */
    _rest(p, teile) {
        const st = p.stats || {};
        const s = this._summe(teile);
        return [(st.matches || 0) - s[0], (st.goals || 0) - s[1], (st.assists || 0) - s[2], Math.round((st.ratingSum || 0) * 10) - s[3]];
    },

    /**
     * Der Spieler verlässt den Verein (Transfer, Leihe, Rückkehr): Was er
     * bis jetzt in dieser Saison geleistet hat, gehört dem alten Verein.
     */
    wechsel(state, p, vonClubId) {
        if (!p || !p.stats || !vonClubId) return;
        const saison = this._saison(state);
        const teile = (p.laufbahnTeile || []).filter(t => t[0] === saison);
        const r = this._rest(p, teile);
        if (r[0] <= 0) { if (teile.length) p.laufbahnTeile = teile; else delete p.laufbahnTeile; return; }
        p.laufbahnTeile = teile.concat([[saison, vonClubId, r[0], r[1], r[2], r[3]]]);
    },

    /** Die Zeilen dieser Saison, so wie sie bisher stehen (Teile und der laufende Rest) */
    laufendeSaison(state, p) {
        const saison = this._saison(state);
        const teile = (p.laufbahnTeile || []).filter(t => t[0] === saison);
        const r = this._rest(p, teile);
        const zeilen = teile.slice();
        if (r[0] > 0 && p.clubId) zeilen.push([saison, p.clubId, r[0], r[1], r[2], r[3]]);
        return zeilen.map(t => [t[0], t[1], t[2], t[3], t[4], t[2] > 0 ? Math.round(t[5] * 10 / t[2]) : 0]);
    },

    /** Zum Saisonende - bevor die Zähler auf null gehen */
    saisonAbschluss(state) {
        (state?.players || []).forEach(p => {
            const zeilen = this.laufendeSaison(state, p);
            delete p.laufbahnTeile;
            if (!zeilen.length) return;
            const alt = Array.isArray(p.laufbahn) ? p.laufbahn : [];
            p.laufbahn = alt.concat(zeilen).slice(-this.MAX_ZEILEN);
        });
    },

    /**
     * Für die Akte: alle Zeilen mit Vereinsnamen, die laufende Saison
     * markiert, dazu die Summe.
     */
    tabelle(state, p) {
        const name = (id) => (state.clubs || []).find(c => c.id === id)?.name || "—";
        const archiv = (Array.isArray(p?.laufbahn) ? p.laufbahn : []).map(z => ({ laufend: false, z }));
        const jetzt = p ? this.laufendeSaison(state, p).map(z => ({ laufend: true, z })) : [];
        const zeilen = archiv.concat(jetzt).map(({ laufend, z }) => ({
            saison: z[0], clubId: z[1], verein: name(z[1]), spiele: z[2], tore: z[3], vorlagen: z[4],
            note: z[2] > 0 && z[5] ? z[5] / 100 : null, laufend
        }));
        const summe = zeilen.reduce((s, z) => ({ spiele: s.spiele + z.spiele, tore: s.tore + z.tore, vorlagen: s.vorlagen + z.vorlagen,
            notenSumme: s.notenSumme + (z.note || 0) * z.spiele }), { spiele: 0, tore: 0, vorlagen: 0, notenSumme: 0 });
        return {
            zeilen: zeilen.reverse(),
            summe: { spiele: summe.spiele, tore: summe.tore, vorlagen: summe.vorlagen, note: summe.spiele ? Math.round(summe.notenSumme / summe.spiele * 100) / 100 : null }
        };
    }
};

if (typeof window !== "undefined") {
    window.LaufbahnEngine = LaufbahnEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { LaufbahnEngine };
}
