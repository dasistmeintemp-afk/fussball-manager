/**
 * StatistikEngine - Die Saisonstatistik eines Spielers je Wettbewerb
 *
 * p.stats zählt alle Pflichtspiele zusammen: Liga, Pokal, Supercup,
 * Relegation und Europapokal. Die Torjägerliste einer Liga, die Preise der
 * Liga und der Torjäger Europas zählten deshalb Pokal- und Europapokaltore
 * mit - ein Stürmer mit Champions League stand allein dadurch vorn.
 *
 * Jetzt führt jeder Spieler daneben, was davon im Pokal (dazu Supercup und
 * Relegation) und im Europapokal geschah. Die Liga ist der Rest. Gespeichert
 * wird das schlank als Zahlenreihe und nur, wenn es etwas zu zählen gibt -
 * die meisten Spieler spielen nie international.
 */

const StatistikEngine = {
    /** Die Wettbewerbsarten neben der Liga */
    NEBEN: { pokal: "statsPokal", europa: "statsEuropa" },
    /** Reihenfolge der gespeicherten Zahlen */
    FELDER: ["matches", "minutes", "goals", "assists", "ratingSum", "cleanSheets"],
    EUROPA: ["ucl", "uel", "uecl"],

    /** Zu welchem Wettbewerb eine Partie zählt: "liga", "pokal", "europa" - Testspiele zu keinem */
    art(match) {
        if (!match || match.freundschaftsspiel) return null;
        const id = String(match.competitionId || "");
        if (id === "friendly") return null;
        if (this.EUROPA.includes(id) || match.international) return "europa";
        if (match.isCup || id === "supercup" || id === "playoff" || /_cup$/.test(id)) return "pokal";
        return "liga";
    },

    /**
     * Ein Spiel buchen - nachdem es in p.stats gezählt wurde. Für die Liga
     * gibt es nichts zu tun, sie ist, was übrig bleibt.
     */
    buche(player, art, werte) {
        const feld = this.NEBEN[art];
        if (!player || !feld) return;
        const reihe = Array.isArray(player[feld]) ? player[feld] : [0, 0, 0, 0, 0, 0];
        reihe[0] += 1;
        reihe[1] += werte.minutes || 0;
        reihe[2] += werte.goals || 0;
        reihe[3] += werte.assists || 0;
        reihe[4] += Math.round((werte.rating || 0) * 10);
        reihe[5] += werte.cleanSheet ? 1 : 0;
        player[feld] = reihe;
    },

    _ausReihe(reihe) {
        const r = Array.isArray(reihe) ? reihe : [];
        return { matches: r[0] || 0, minutes: r[1] || 0, goals: r[2] || 0, assists: r[3] || 0, ratingSum: (r[4] || 0) / 10, cleanSheets: r[5] || 0 };
    },

    /**
     * Die Statistik eines Spielers in einem Wettbewerb: "liga", "pokal",
     * "europa" oder "alle". Immer ein Objekt mit denselben Feldern wie p.stats.
     */
    von(player, art = "liga") {
        const st = player?.stats || {};
        const gesamt = {
            matches: st.matches || 0, minutes: st.minutes || 0, goals: st.goals || 0, assists: st.assists || 0,
            ratingSum: st.ratingSum || 0, cleanSheets: st.cleanSheets || 0
        };
        if (art === "alle") return gesamt;
        if (this.NEBEN[art]) return this._ausReihe(player?.[this.NEBEN[art]]);
        const pokal = this._ausReihe(player?.statsPokal);
        const europa = this._ausReihe(player?.statsEuropa);
        const liga = {};
        this.FELDER.forEach(f => { liga[f] = Math.max(0, gesamt[f] - pokal[f] - europa[f]); });
        liga.ratingSum = Math.round(liga.ratingSum * 100) / 100;
        return liga;
    },

    /** Zum Saisonwechsel, zusammen mit p.stats */
    zuruecksetzen(player) {
        if (!player) return;
        // Nicht löschen: delete versetzt das Objekt in den langsamen Wörterbuchmodus
        if (player.statsPokal !== undefined) player.statsPokal = undefined;
        if (player.statsEuropa !== undefined) player.statsEuropa = undefined;
    }
};

if (typeof window !== "undefined") {
    window.StatistikEngine = StatistikEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { StatistikEngine };
}
