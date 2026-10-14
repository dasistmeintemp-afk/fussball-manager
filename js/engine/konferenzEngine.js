/**
 * KonferenzEngine - Die anderen Plätze während des eigenen Ligaspiels
 *
 * Bisher lief das eigene Spiel allein: Was in den anderen Stadien passierte,
 * erfuhr man erst nach dem Abpfiff in der Tabelle. Gerade am Saisonende -
 * Abstiegskampf, Meisterschaft, Europapokalplätze - lebt ein Spieltag aber
 * davon, dass es irgendwo anders gerade 1:0 steht.
 *
 * Beim Anpfiff des eigenen Ligaspiels rechnet die Engine die übrigen
 * Partien des Spieltags. Das hätte der Saisonablauf ohnehin getan, nur
 * später; die Partien sind danach gespielt und werden nicht noch einmal
 * gerechnet. Während des Spiels liefert sie den Zwischenstand jeder Partie
 * zur laufenden Minute, die Tore seit der letzten Abfrage und die
 * Tabelle, wie sie gerade stünde.
 */

const _kfResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const KonferenzEngine = {
    /**
     * Die Konferenz zum eigenen Ligaspiel - oder null, wenn die Partie kein
     * Ligaspiel des laufenden Spieltags ist (Pokal, Europapokal, Testspiel).
     */
    bereite(state, partie) {
        if (!state || !partie || !Array.isArray(state.schedule)) return null;
        const gleich = m => m === partie || (m.homeClubId === partie.homeClubId && m.awayClubId === partie.awayClubId);
        const runde = state.schedule.find(r => r.matchday === state.currentMatchday && (r.matches || []).some(gleich));
        if (!runde) return null;

        const me = _kfResolve("MatchEngine", "./matchEngine.js");
        const gs = _kfResolve("GameState", "./gameState.js");
        const verein = new Map((state.clubs || []).map(c => [c.id, c]));
        const partien = [];
        runde.matches.forEach(m => {
            if (gleich(m)) return;
            const heim = verein.get(m.homeClubId), gast = verein.get(m.awayClubId);
            if (!heim || !gast) return;
            if (!m.played) {
                if (!me || typeof me.simulateFullMatch !== "function") return;
                me.simulateFullMatch(m, heim, gast, state.players);
            }
            const tore = (m.events || [])
                .filter(e => e && e.type === "goal" && (e.clubId === heim.id || e.clubId === gast.id))
                .map(e => ({ minute: Number(e.minute) || 0, clubId: e.clubId, spieler: e.playerName || "" }))
                .sort((a, b) => a.minute - b.minute);
            // Passt die Liste nicht zum Endstand (alte Partie ohne Ereignisse),
            // fallen die Tore gleichmäßig über das Spiel
            const soll = [[heim.id, m.homeGoals || 0], [gast.id, m.awayGoals || 0]];
            const stimmt = soll.every(([id, n]) => tore.filter(t => t.clubId === id).length === n);
            const toreFertig = stimmt ? tore : soll.flatMap(([id, n]) => Array.from({ length: n }, (_, i) => ({ minute: Math.round((i + 1) * 90 / (n + 1)), clubId: id, spieler: "" })))
                .sort((a, b) => a.minute - b.minute);
            partien.push({
                homeClubId: heim.id, awayClubId: gast.id, heim: heim.name, gast: gast.name,
                tore: toreFertig, endstand: [m.homeGoals || 0, m.awayGoals || 0]
            });
        });

        const ligaId = runde.leagueId || partie.leagueId || (verein.get(partie.homeClubId) || {}).leagueId;
        const ligaVereine = (state.clubs || []).filter(c => c.leagueId === ligaId);
        const basis = gs && typeof gs.calculateStandings === "function"
            ? gs.calculateStandings(ligaVereine.length ? ligaVereine : (state.clubs || []), state.schedule, runde.matchday - 1)
            : [];
        return {
            spieltag: runde.matchday,
            ligaId,
            eigene: { homeClubId: partie.homeClubId, awayClubId: partie.awayClubId },
            partien,
            basis: basis.map((r, i) => ({
                clubId: r.clubId, clubName: r.clubName, rang: i + 1, played: r.played,
                won: r.won, drawn: r.drawn, lost: r.lost, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points
            }))
        };
    },

    /** Zwischenstand jeder Partie zur Minute; nach dem Abpfiff der Endstand */
    stand(konf, minute, fertig = false) {
        if (!konf) return [];
        return konf.partien.map(p => {
            if (fertig) return { partie: p, heim: p.endstand[0], gast: p.endstand[1] };
            const bis = p.tore.filter(t => t.minute <= minute);
            return { partie: p, heim: bis.filter(t => t.clubId === p.homeClubId).length, gast: bis.filter(t => t.clubId === p.awayClubId).length };
        });
    },

    /** Tore auf den anderen Plätzen zwischen zwei Minuten (von ausgeschlossen) */
    neueTore(konf, von, bis) {
        if (!konf) return [];
        const neu = [];
        konf.partien.forEach(p => p.tore.forEach(t => {
            if (t.minute > von && t.minute <= bis) {
                const vorher = p.tore.filter(x => x.minute <= t.minute);
                neu.push({
                    partie: p, minute: t.minute, clubId: t.clubId, spieler: t.spieler,
                    heim: vorher.filter(x => x.clubId === p.homeClubId).length,
                    gast: vorher.filter(x => x.clubId === p.awayClubId).length
                });
            }
        }));
        return neu.sort((a, b) => a.minute - b.minute);
    },

    /**
     * Die Tabelle, wie sie gerade stünde: Stand vor dem Spieltag plus alle
     * Zwischenstände, das eigene Spiel eingeschlossen. Jede Zeile kennt ihren
     * Rang vor dem Spieltag (vorher).
     */
    liveTabelle(konf, minute, eigenerStand, fertig = false) {
        if (!konf) return [];
        const zeilen = new Map(konf.basis.map(r => [r.clubId, Object.assign({}, r, { vorher: r.rang, live: false })]));
        const buche = (heimId, gastId, h, g) => {
            const a = zeilen.get(heimId), b = zeilen.get(gastId);
            if (!a || !b) return;
            a.played++; b.played++; a.live = true; b.live = true;
            a.goalsFor += h; a.goalsAgainst += g; b.goalsFor += g; b.goalsAgainst += h;
            if (h > g) { a.won++; b.lost++; a.points += 3; }
            else if (h < g) { b.won++; a.lost++; b.points += 3; }
            else { a.drawn++; b.drawn++; a.points++; b.points++; }
        };
        this.stand(konf, minute, fertig).forEach(s => buche(s.partie.homeClubId, s.partie.awayClubId, s.heim, s.gast));
        if (eigenerStand) buche(konf.eigene.homeClubId, konf.eigene.awayClubId, eigenerStand[0] || 0, eigenerStand[1] || 0);
        const liste = [...zeilen.values()];
        liste.forEach(r => { r.goalDiff = r.goalsFor - r.goalsAgainst; });
        liste.sort((a, b) => (b.points - a.points) || (b.goalDiff - a.goalDiff) || (b.goalsFor - a.goalsFor)
            || String(a.clubName).localeCompare(String(b.clubName)));
        liste.forEach((r, i) => { r.rang = i + 1; });
        return liste;
    }
};

if (typeof window !== "undefined") {
    window.KonferenzEngine = KonferenzEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { KonferenzEngine };
}
