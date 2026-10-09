/**
 * DatenzentraleEngine - Was die Spiele der eigenen Liga verraten
 *
 * Jede Partie der eigenen Liga hält ihre Statistik fest: Ballbesitz,
 * Schüsse, Passquote, xG, die Schüsse einzeln und die Noten je Spieler.
 * Bisher stand davon nur der Spielbericht der einzelnen Partie. Die
 * Datenzentrale legt es zusammen:
 *
 *   Liga      - je Verein Tore und xG, für und gegen, Schüsse, Ballbesitz,
 *               Passquote und die Punkte, die die Chancen hergegeben hätten
 *               (xPunkte). Wer weit über seinen xPunkten steht, hat Glück.
 *   Form      - die letzten Spiele eines Vereins: Ergebnis und xG.
 *   Spieler   - je Spieler Einsätze, Minuten, Tore, Vorlagen, Note, Schüsse
 *               und xG, dazu je 90 Minuten.
 *   Vergleich - zwei Spieler nebeneinander: Werte (so genau, wie der Scout
 *               sie kennt), Saison und je 90 Minuten.
 *
 * Detaildaten gibt es nur für die eigene Liga - die anderen Ligen speichern
 * aus Platzgründen nur Ergebnisse.
 */

const _dzResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const DatenzentraleEngine = {
    /** Ab so vielen Minuten zählen die Werte je 90 Minuten */
    MIN_MINUTEN_JE90: 270,

    FELD_WERTE: [
        ["pace", "Tempo"], ["shooting", "Schuss"], ["passing", "Passen"], ["dribbling", "Dribbling"], ["technique", "Technik"],
        ["defense", "Defensive"], ["physical", "Physis"], ["stamina", "Ausdauer"], ["vision", "Übersicht"]
    ],
    TORWART_WERTE: [
        ["reflexes", "Reflexe"], ["handling", "Fangsicherheit"], ["oneOnOne", "Eins gegen eins"], ["positioning", "Stellungsspiel"],
        ["kicking", "Abschlag"], ["passing", "Passen"], ["physical", "Physis"]
    ],

    /**
     * Die gespielten Partien der eigenen Liga mit Kennzahlen. Die eigenen
     * Spiele behalten ihre ganze Statistik, die übrigen sieben Kennzahlen
     * (MatchEngine.compactPlayedMatch, Feld kz).
     */
    partien(state) {
        return (state?.schedule || []).flatMap(t => (t.matches || []).map(m => {
            if (!m.played) return null;
            if (m.stats) return { ...m, matchday: t.matchday };
            if (!Array.isArray(m.kz)) return null;
            const k = m.kz;
            return { ...m, matchday: t.matchday, stats: { xG: [k[0] / 100, k[1] / 100], shots: [k[2], k[3]], possession: [k[4], 100 - k[4]], passAccuracy: [k[5], k[6]] } };
        })).filter(Boolean);
    },

    /** Wahrscheinlichkeit für k Tore bei einem Erwartungswert lambda (Poisson) */
    _poisson(lambda, k) {
        let p = Math.exp(-lambda);
        for (let i = 1; i <= k; i++) p *= lambda / i;
        return p;
    },

    /** Die Punkte, die zwei xG-Werte im Mittel einbringen: [heim, gast] */
    xPunkte(xgHeim, xgGast) {
        let sieg = 0, remis = 0, niederlage = 0;
        for (let a = 0; a <= 10; a++) {
            const pa = this._poisson(Math.max(0, xgHeim || 0), a);
            for (let b = 0; b <= 10; b++) {
                const p = pa * this._poisson(Math.max(0, xgGast || 0), b);
                if (a > b) sieg += p; else if (a === b) remis += p; else niederlage += p;
            }
        }
        return [sieg * 3 + remis, niederlage * 3 + remis];
    },

    /** Je Verein der eigenen Liga: Tore, xG, Schüsse, Ballbesitz, Passquote, Punkte und xPunkte */
    liga(state) {
        const zeilen = new Map();
        const zeile = (id) => {
            if (!zeilen.has(id)) {
                const c = (state.clubs || []).find(x => x.id === id);
                zeilen.set(id, { clubId: id, name: c?.name || id, spiele: 0, tore: 0, gegentore: 0, xg: 0, xga: 0,
                    schuesse: 0, schuesseGegen: 0, ballbesitz: 0, passquote: 0, punkte: 0, xPunkte: 0 });
            }
            return zeilen.get(id);
        };
        this.partien(state).forEach(m => {
            const s = m.stats;
            const xg = Array.isArray(s.xG) ? s.xG : [0, 0];
            const xp = this.xPunkte(xg[0], xg[1]);
            [[m.homeClubId, 0], [m.awayClubId, 1]].forEach(([id, i]) => {
                const z = zeile(id), j = 1 - i;
                const eigene = i === 0 ? m.homeGoals : m.awayGoals, fremde = i === 0 ? m.awayGoals : m.homeGoals;
                z.spiele++;
                z.tore += eigene || 0; z.gegentore += fremde || 0;
                z.xg += xg[i] || 0; z.xga += xg[j] || 0;
                z.schuesse += s.shots?.[i] || 0; z.schuesseGegen += s.shots?.[j] || 0;
                z.ballbesitz += s.possession?.[i] || 50; z.passquote += s.passAccuracy?.[i] || 0;
                z.punkte += eigene > fremde ? 3 : (eigene === fremde ? 1 : 0);
                z.xPunkte += xp[i];
            });
        });
        const r1 = (x) => Math.round(x * 10) / 10;
        return [...zeilen.values()].map(z => ({
            ...z,
            xg: r1(z.xg), xga: r1(z.xga), xgDiff: r1(z.xg - z.xga), xPunkte: r1(z.xPunkte),
            glueck: r1(z.punkte - z.xPunkte),
            schuesseJeSpiel: r1(z.schuesse / Math.max(1, z.spiele)),
            ballbesitz: Math.round(z.ballbesitz / Math.max(1, z.spiele)),
            passquote: Math.round(z.passquote / Math.max(1, z.spiele))
        })).sort((a, b) => b.xPunkte - a.xPunkte);
    },

    /** Die letzten Spiele eines Vereins, älteste zuerst: Ergebnis und xG */
    form(state, clubId, anzahl = 10) {
        const name = (id) => (state.clubs || []).find(c => c.id === id)?.name || id;
        return this.partien(state).filter(m => m.homeClubId === clubId || m.awayClubId === clubId)
            .sort((a, b) => (a.matchday || 0) - (b.matchday || 0)).slice(-anzahl)
            .map(m => {
                const heim = m.homeClubId === clubId;
                const xg = Array.isArray(m.stats.xG) ? m.stats.xG : [0, 0];
                const tore = heim ? [m.homeGoals, m.awayGoals] : [m.awayGoals, m.homeGoals];
                return {
                    spieltag: m.matchday, heim, gegner: name(heim ? m.awayClubId : m.homeClubId),
                    tore, xg: heim ? [xg[0], xg[1]] : [xg[1], xg[0]],
                    ergebnis: tore[0] > tore[1] ? "S" : (tore[0] === tore[1] ? "U" : "N")
                };
            });
    },

    /**
     * Je Spieler eines Vereins: aus den Noten der Partien (Einsätze, Minuten,
     * Tore, Vorlagen, Note) und den Schüssen (Anzahl, xG). Die Schüsse tragen
     * nur den Nachnamen - zugeordnet wird innerhalb der Elf der Partie; wo
     * zwei denselben Nachnamen haben, bleibt der Schuss ohne Schützen.
     */
    spieler(state, clubId) {
        const werte = new Map();
        const eintrag = (id, name, pos) => {
            if (!werte.has(String(id))) werte.set(String(id), { id, name, pos, spiele: 0, minuten: 0, tore: 0, vorlagen: 0, notenSumme: 0, schuesse: 0, xg: 0 });
            return werte.get(String(id));
        };
        this.partien(state).forEach(m => {
            const seite = m.homeClubId === clubId ? 0 : (m.awayClubId === clubId ? 1 : -1);
            if (seite < 0) return;
            const eigene = (m.playerRatings || []).filter(r => r.clubId === clubId && (r.minutes || 0) > 0);
            const nachName = new Map(), nachId = new Map();
            eigene.forEach(r => {
                const e = eintrag(r.playerId, r.name, r.pos);
                e.spiele++; e.minuten += r.minutes || 0; e.tore += r.goals || 0; e.vorlagen += r.assists || 0;
                e.notenSumme += r.rating || 0;
                const nach = String(r.name || "").split(" ").slice(-1)[0];
                nachName.set(nach, nachName.has(nach) ? null : e);
                nachId.set(String(r.playerId), e);
            });
            (m.schuesse || []).forEach(([, team, , , xg, , , name, id]) => {
                if (team !== seite) return;
                const e = (id !== undefined && id !== null ? nachId.get(String(id)) : null) || nachName.get(name);
                if (!e) return;
                e.schuesse++; e.xg += (xg || 0) / 100;
            });
        });
        return [...werte.values()].map(e => {
            const je90 = e.minuten >= this.MIN_MINUTEN_JE90 ? 90 / e.minuten : null;
            const r2 = (x) => Math.round(x * 100) / 100;
            return {
                ...e,
                note: e.spiele ? Math.round(e.notenSumme / e.spiele * 100) / 100 : null,
                xg: r2(e.xg),
                toreJe90: je90 ? r2(e.tore * je90) : null,
                vorlagenJe90: je90 ? r2(e.vorlagen * je90) : null,
                xgJe90: je90 ? r2(e.xg * je90) : null,
                schuesseJe90: je90 ? r2(e.schuesse * je90) : null
            };
        }).sort((a, b) => b.minuten - a.minuten);
    },

    /** Wie gut kennt der Verein den Spieler? Eigene ganz, fremde nach Scoutwissen */
    _wissen(state, p) {
        if (!p) return 0;
        if (p.clubId === state.userClubId) return 100;
        const rating = _dzResolve("PlayerRatingEngine", "./playerRatingEngine.js");
        if (!rating || typeof rating.calculateVisiblePlayerCard !== "function") return p.scoutingKnowledge?.knowledgeLevel || 25;
        return rating.calculateVisiblePlayerCard(p, { userClubId: state.userClubId, leagueDataCoverage: 85, state }).confidence;
    },

    /**
     * Zwei Spieler nebeneinander. Die Werte so, wie der Verein sie kennt:
     * bei fremden Spielern mit wenig Scoutwissen als Spanne.
     */
    vergleich(state, idA, idB) {
        const finde = (id) => (state.players || []).find(p => String(p.id) === String(id)) || null;
        const a = finde(idA), b = finde(idB);
        if (!a || !b) return null;
        const rating = _dzResolve("PlayerRatingEngine", "./playerRatingEngine.js");
        const torhueter = a.pos === "TW" && b.pos === "TW";
        const liste = torhueter ? this.TORWART_WERTE : this.FELD_WERTE;
        const seite = (p) => {
            const wissen = this._wissen(state, p);
            const club = (state.clubs || []).find(c => c.id === p.clubId);
            const saison = this._saison(state, p);
            const sicht = (k) => rating && typeof rating.getVisibleAttribute === "function"
                ? rating.getVisibleAttribute(p, k, wissen)
                : { known: true, exact: p[k], min: p[k], max: p[k], text: String(p[k] ?? "?") };
            const klasse = rating && typeof rating.klasse === "function" && wissen >= 88 ? rating.klasse(state, p.overall).text : null;
            return {
                id: p.id, name: p.name, pos: p.pos, alter: p.age, verein: club?.name || "vereinslos",
                wissen, genau: wissen >= 88, klasse,
                werte: Object.fromEntries(liste.map(([k]) => [k, sicht(k)])),
                marktwert: p.value || 0, gehalt: p.wage || 0, vertrag: p.contractYears ?? null,
                saison
            };
        };
        return { torhueter, werte: liste.map(([k, label]) => ({ key: k, label })), a: seite(a), b: seite(b) };
    },

    /** Die Saison eines Spielers: aus den Zählern am Spieler (alle Ligen) */
    _saison(state, p) {
        const s = p.stats || {};
        const min = s.minutes || 0;
        const je90 = min >= this.MIN_MINUTEN_JE90 ? 90 / min : null;
        const r2 = (x) => Math.round(x * 100) / 100;
        return {
            spiele: s.matches || 0, minuten: min, tore: s.goals || 0, vorlagen: s.assists || 0,
            note: s.matches ? Math.round((s.ratingSum || 0) / s.matches * 100) / 100 : null,
            toreJe90: je90 ? r2((s.goals || 0) * je90) : null,
            vorlagenJe90: je90 ? r2((s.assists || 0) * je90) : null
        };
    },

    /** Wen man zum Vergleich anbietet: eigene Spieler und Beobachtete derselben Position zuerst */
    vergleichsKandidaten(state, id, anzahl = 30) {
        const p = (state.players || []).find(x => String(x.id) === String(id));
        if (!p) return [];
        const gruppe = (pos) => pos === "TW" ? "tw" : (["IV", "LV", "RV"].includes(pos) ? "abw" : (["DM", "ZM", "OM", "LM", "RM"].includes(pos) ? "mf" : "st"));
        const beobachtet = new Set((state.scouting?.shortlist || state.shortlist || []).map(x => String(x?.id ?? x)));
        return (state.players || [])
            .filter(x => x !== p && x.clubId && gruppe(x.pos) === gruppe(p.pos)
                && (x.clubId === state.userClubId || beobachtet.has(String(x.id)) || (x.scoutingKnowledge?.knowledgeLevel || 0) >= 50))
            .sort((x, y) => (x.clubId === state.userClubId ? 0 : 1) - (y.clubId === state.userClubId ? 0 : 1) || (y.overall || 0) - (x.overall || 0))
            .slice(0, anzahl)
            .map(x => ({ id: x.id, name: x.name, pos: x.pos, verein: (state.clubs || []).find(c => c.id === x.clubId)?.name || "", eigen: x.clubId === state.userClubId }));
    }
};

if (typeof window !== "undefined") {
    window.DatenzentraleEngine = DatenzentraleEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { DatenzentraleEngine };
}
