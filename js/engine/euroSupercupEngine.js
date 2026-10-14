/**
 * EuroSupercupEngine - Der Europäische Supercup zum Saisonauftakt
 *
 * Zwei Tage vor dem nationalen Supercup spielt der Sieger der Königsklasse
 * gegen den Sieger der Europa League der Vorsaison - ein Spiel auf
 * neutralem Platz, bei Gleichstand Elfmeterschießen. Beide bekommen ein
 * Antrittsgeld, der Sieger eine Prämie obendrauf. In der ersten Saison gibt
 * es keine Vorsaison; dann spielt der größte Name der Königsklasse gegen den
 * größten der Europa League.
 *
 * Der Termin steht als Europapokalabend (cupArt "eurosupercup") im
 * Kalender und läuft über die CupEngine wie jede Pokalpartie. Ist der
 * eigene Verein nicht beteiligt, wird im Hintergrund gespielt.
 */

const _escResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const EuroSupercupEngine = {
    NAME: "Europäischer Supercup",
    /** Antrittsgeld für beide, dazu die Siegprämie - wie im Vorbild der UEFA */
    PRAEMIE: { antritt: 4000000, sieg: 1000000 },

    /**
     * Zum Saisonwechsel, bevor der Europapokal neu besetzt wird: die Sieger
     * der Königsklasse und der Europa League festhalten (state.seasonYear ist
     * dann schon die neue Saison).
     */
    merkeVorlage(state) {
        const ec = state?.europeanCompetitions || {};
        const sieger = (w) => (w && w.completed && w.winnerId) || null;
        state.euroSupercupVorlage = { saison: state.seasonYear || 1, uclId: sieger(ec.ucl), uelId: sieger(ec.uel) };
        return state.euroSupercupVorlage;
    },

    _groessterName(state, wettbewerb, ohne) {
        const ids = (state.europeanCompetitions?.[wettbewerb]?.participants || []).filter(id => id !== ohne);
        const vereine = ids.map(id => (state.clubs || []).find(c => c.id === id)).filter(Boolean);
        vereine.sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
        return vereine[0]?.id || null;
    },

    /** Die Paarung dieser Saison - beim ersten Zugriff aus der Vorlage gebildet */
    paarung(state) {
        const saison = state?.seasonYear || 1;
        if (state.euroSupercup && state.euroSupercup.saison === saison) return state.euroSupercup;
        const v = state.euroSupercupVorlage && state.euroSupercupVorlage.saison === saison ? state.euroSupercupVorlage : null;
        let heimId = v?.uclId || null;
        let gastId = v?.uelId && v.uelId !== heimId ? v.uelId : null;
        let grund = "Sieger der Königsklasse gegen den Sieger des zweiten Europapokals";
        if (!heimId || !gastId) {
            // Erste Saison: die größten Namen der beiden Wettbewerbe
            heimId = heimId || this._groessterName(state, "ucl", gastId);
            gastId = gastId || this._groessterName(state, "uel", heimId);
            grund = "die größten Namen der beiden großen Europapokale";
        }
        if (!heimId || !gastId) return null;
        state.euroSupercup = {
            saison, grund, siegerId: null, abgeschlossen: false,
            partie: {
                id: `eurosupercup_${saison}`, competitionId: "eurosupercup", roundName: this.NAME, roundNumber: 1,
                homeClubId: heimId, awayClubId: gastId, played: false, homeGoals: null, awayGoals: null,
                isCup: true, international: true, neutralerPlatz: true, penaltyWinner: null
            }
        };
        return state.euroSupercup;
    },

    _eigen(state, p) { return !!p && (p.partie.homeClubId === state.userClubId || p.partie.awayClubId === state.userClubId); },

    /** Für Kalender und Weiter-Knopf: die eigene Partie an diesem Abend */
    eigenePartieAm(state) {
        const p = this.paarung(state);
        if (!p || p.partie.played || !this._eigen(state, p)) return null;
        return { partie: p.partie, runde: { matches: [p.partie], roundName: this.NAME }, wettbewerb: { id: "eurosupercup", name: this.NAME }, ko: true };
    },

    /** Der Abend: Ohne den eigenen Verein wird gleich gespielt, sonst übernimmt das Livespiel */
    spieleTermin(state) {
        const p = this.paarung(state);
        if (!p || p.partie.played) return { eigenePartie: null };
        if (this._eigen(state, p)) return { eigenePartie: p.partie };
        const cup = _escResolve("CupEngine", "./cupEngine.js");
        if (cup && typeof cup.austragen === "function") cup.austragen(state, p.partie, true);
        return { eigenePartie: null };
    },

    /** Sieger, Prämien, Titel und Nachricht */
    schliesseTerminAb(state) {
        const p = this.paarung(state);
        if (!p || !p.partie.played || p.abgeschlossen) return [];
        const cup = _escResolve("CupEngine", "./cupEngine.js");
        const sieger = cup && typeof cup.siegerVon === "function" ? cup.siegerVon(p.partie) : (p.partie.homeGoals >= p.partie.awayGoals ? p.partie.homeClubId : p.partie.awayClubId);
        p.siegerId = sieger;
        p.abgeschlossen = true;
        const finde = (id) => (state.clubs || []).find(c => c.id === id);
        const club = finde(sieger);
        const verlierer = finde(sieger === p.partie.homeClubId ? p.partie.awayClubId : p.partie.homeClubId);
        const fin = _escResolve("FinanceEngine", "./financeEngine.js");
        const zahle = (c, betrag, text) => {
            if (!c || betrag <= 0) return;
            c.balance = (c.balance || 0) + betrag;
            if (fin && typeof fin.recordTransaction === "function") fin.recordTransaction(state, c.id, "prize", betrag, text);
        };
        zahle(club, this.PRAEMIE.antritt + this.PRAEMIE.sieg, `${this.NAME}: Antrittsgeld und Siegprämie`);
        zahle(verlierer, this.PRAEMIE.antritt, `${this.NAME}: Antrittsgeld`);
        if (sieger === state.userClubId) {
            const career = _escResolve("CareerEngine", "./careerEngine.js");
            if (career && typeof career.vermerkeTitel === "function") career.vermerkeTitel(state, this.NAME, p.saison);
        }
        const ergebnis = `${p.partie.homeGoals}:${p.partie.awayGoals}${p.partie.penaltyScore ? ` (${p.partie.penaltyScore[0]}:${p.partie.penaltyScore[1]} i. E.)` : ""}`;
        if (Array.isArray(state.inbox)) {
            state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
                date: state.currentDate || "", sender: "Sportpresse",
                subject: `🏆 ${this.NAME}: ${club?.name || "?"} gewinnt`,
                body: `${club?.name || "?"} gewinnt den ${this.NAME} gegen ${verlierer?.name || "?"} (${ergebnis}) - ${p.grund}.`,
                read: false, type: sieger === state.userClubId ? "board_message" : "news" });
        }
        return [`🏆 ${this.NAME}: ${club?.name || "?"} gewinnt ${ergebnis}`];
    }
};

if (typeof window !== "undefined") {
    window.EuroSupercupEngine = EuroSupercupEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { EuroSupercupEngine };
}
