/**
 * SpielvorschauEngine - Was man vor dem nächsten Spiel wissen will
 *
 * Die Karte "Nächstes Spiel" nannte Gegner, Ort, Tabellenplatz und Form.
 * Die Vorschau ergänzt, was in jeder Sportzeitung vor dem Anpfiff steht:
 *
 *   Quoten       - aus einem einfachen Tormodell: Beide Mannschaften
 *                  erwarten Tore nach ihrer Stärke, mit Heimvorteil und der
 *                  Spielkultur der Liga; daraus Sieg, Remis, Niederlage und
 *                  Buchmacherquoten mit üblicher Marge.
 *   Bilanz       - der direkte Vergleich, seit der Trainer im Verein ist
 *                  (aus der Vereinschronik).
 *   Torjäger     - der beste Torschütze beider Mannschaften in dieser Saison.
 *   Ausfälle     - wer bei beiden verletzt oder gesperrt fehlt, die
 *                  wichtigsten zuerst.
 */

const _svResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const SpielvorschauEngine = {
    /** Tore, die eine Mannschaft im Schnitt erwartet, bevor Stärke und Ort zählen */
    TORE_JE_TEAM: 1.45,
    /**
     * Wie stark ein Punkt Teamstärke die erwarteten Tore verschiebt, und der
     * Heimvorteil. Geeicht an der Spiel-Engine: je 250 simulierte Partien
     * zwischen Bundesligisten (Bayern gegen Schalke 86 % Siege, Augsburg
     * gegen Leipzig 11 %), gerechnet mit den neutralen Stärken.
     */
    STAERKE_GEWICHT: 0.075,
    HEIM: 0.2,
    /** Marge der Buchmacher */
    MARGE: 0.06,

    _poisson(lambda, k) {
        let p = Math.exp(-lambda);
        for (let i = 1; i <= k; i++) p *= lambda / i;
        return p;
    },

    /**
     * Wahrscheinlichkeiten und Quoten aus den Stärken: erwartete Tore je
     * Seite, daraus über Poisson Heimsieg, Remis und Auswärtssieg.
     */
    quoten(heimStaerke, gastStaerke, kultur = 1, neutral = false) {
        const diff = heimStaerke - gastStaerke;
        const basis = this.TORE_JE_TEAM * kultur;
        const lh = basis * Math.exp(this.STAERKE_GEWICHT * diff + (neutral ? 0 : this.HEIM));
        const la = basis * Math.exp(-this.STAERKE_GEWICHT * diff);
        let heim = 0, remis = 0, gast = 0;
        for (let i = 0; i <= 10; i++) {
            const pi = this._poisson(lh, i);
            for (let j = 0; j <= 10; j++) {
                const p = pi * this._poisson(la, j);
                if (i > j) heim += p; else if (i === j) remis += p; else gast += p;
            }
        }
        const summe = heim + remis + gast;
        // Die Marge verteilt sich auf alle drei Ausgänge; unter 1,04 bietet niemand an
        const quote = (p) => Math.max(1.04, Math.round(100 / (p / summe + this.MARGE / 3)) / 100);
        return {
            heim: heim / summe, remis: remis / summe, gast: gast / summe,
            quoteHeim: quote(heim), quoteRemis: quote(remis), quoteGast: quote(gast),
            toreHeim: Math.round(lh * 100) / 100, toreGast: Math.round(la * 100) / 100
        };
    },

    /** Die Stärke ohne Heimbonus - der Heimvorteil kommt im Modell einmal dazu */
    _staerke(state, club) {
        const me = _svResolve("MatchEngine", "./matchEngine.js");
        if (!me || typeof me.calculateTeamPower !== "function") return 70;
        return me.calculateTeamPower(club, state.players, false).total || 70;
    },

    _torjaeger(state, club) {
        return (state.players || []).filter(p => p.clubId === club.id && (p.stats?.goals || 0) > 0)
            .sort((a, b) => (b.stats.goals || 0) - (a.stats.goals || 0))[0] || null;
    },

    /** Wer fehlt: verletzt oder gesperrt, die Stärksten zuerst */
    ausfaelle(state, club) {
        return (state.players || []).filter(p => p.clubId === club.id && ((p.injuredWeeks || 0) > 0 || (p.suspendedMatches || 0) > 0))
            .sort((a, b) => (b.overall || 0) - (a.overall || 0))
            .map(p => ({ id: p.id, name: p.name, pos: p.pos, grund: (p.injuredWeeks || 0) > 0 ? "verletzt" : "gesperrt" }));
    },

    /** Die Vorschau auf das nächste Ligaspiel des eigenen Vereins - oder null */
    vorschau(state) {
        const kalender = _svResolve("CalendarEngine", "./calendarEngine.js");
        const n = kalender && typeof kalender.naechstesSpiel === "function" ? kalender.naechstesSpiel(state) : null;
        if (!n || !n.gegner) return null;
        const eigener = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!eigener) return null;
        const heimClub = n.heim ? eigener : n.gegner;
        const gastClub = n.heim ? n.gegner : eigener;
        const me = _svResolve("MatchEngine", "./matchEngine.js");
        const kultur = me && typeof me.torKultur === "function" ? me.torKultur(n.partie, heimClub) : 1;
        const q = this.quoten(this._staerke(state, heimClub), this._staerke(state, gastClub), kultur, !!n.partie?.neutralerPlatz);

        const chronik = state.chronik?.[state.userClubId];
        const duell = chronik?.duelle?.[n.gegner.id] || null;
        const tabelle = state.standings || [];
        const platz = (id) => { const i = tabelle.findIndex(t => t.clubId === id); return i >= 0 ? { platz: i + 1, punkte: tabelle[i].points || 0 } : null; };
        const torjaeger = (club) => { const p = this._torjaeger(state, club); return p ? { id: p.id, name: p.name, tore: p.stats.goals } : null; };
        return {
            spieltag: n.spieltag, heim: n.heim, gegner: { id: n.gegner.id, name: n.gegner.name },
            // aus Sicht des eigenen Vereins
            sieg: n.heim ? q.heim : q.gast, remis: q.remis, niederlage: n.heim ? q.gast : q.heim,
            quoten: { heim: q.quoteHeim, remis: q.quoteRemis, gast: q.quoteGast },
            erwarteteTore: { heim: q.toreHeim, gast: q.toreGast },
            bilanz: duell ? { siege: duell.s, remis: duell.u, niederlagen: duell.n, tore: duell.t, gegentore: duell.g, letzte: duell.letzte || [] } : null,
            tabelle: { eigen: platz(eigener.id), gegner: platz(n.gegner.id) },
            form: { eigen: (eigener.form || []).filter(f => f && f !== "-").slice(-5), gegner: n.gegnerForm || [] },
            torjaeger: { eigen: torjaeger(eigener), gegner: torjaeger(n.gegner) },
            ausfaelle: { eigen: this.ausfaelle(state, eigener), gegner: this.ausfaelle(state, n.gegner) }
        };
    }
};

if (typeof window !== "undefined") {
    window.SpielvorschauEngine = SpielvorschauEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SpielvorschauEngine };
}
