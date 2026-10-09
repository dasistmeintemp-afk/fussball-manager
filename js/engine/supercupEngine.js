/**
 * SupercupEngine - Meister gegen Pokalsieger zum Saisonauftakt
 *
 * Am letzten Tag der Vorbereitung spielt im eigenen Land der Meister gegen
 * den Pokalsieger der Vorsaison - ein Spiel, bei Gleichstand Elfmeter.
 * Hat der Meister auch den Pokal geholt, kommt der Vizemeister. In der
 * ersten Saison gibt es keine Vorsaison; dann spielen die beiden Vereine
 * mit dem größten Ruf der ersten Liga.
 *
 * Den Termin trägt der Kalender als Pokalabend (cupArt "supercup") aus,
 * über die CupEngine - Livespiel, Elfmeterschießen und Abschluss laufen
 * wie bei jeder Pokalpartie. Einen Landespokal gibt es nur im Land des
 * eigenen Vereins, deshalb auch nur dort einen Supercup.
 */

const _scResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const SupercupEngine = {
    NAMEN: { de: "Supercup", en: "Community Shield", es: "Supercopa", it: "Supercoppa", fr: "Trophée des Champions" },
    /** Prämie für den Sieger, als Anteil am Sponsorbeitrag je Spieltag */
    PRAEMIE_FAKTOR: 2,

    _land(state) {
        const eigen = (state?.clubs || []).find(c => c.id === state?.userClubId);
        return eigen?.countryId || "de";
    },

    name(state) { return this.NAMEN[this._land(state)] || "Supercup"; },

    /** Die erste Liga des eigenen Landes */
    _ersteLiga(state) {
        const land = this._land(state);
        return (state.leagues || []).find(l => l.countryId === land && (l.level || 1) === 1) || null;
    },

    /**
     * Zum Saisonwechsel, bevor Tabellen und Pokal neu beginnen: Meister und
     * Pokalsieger der abgelaufenen Saison festhalten (state.seasonYear ist
     * dann schon die neue Saison).
     */
    merkeVorlage(state) {
        const liga = this._ersteLiga(state);
        if (!liga) return null;
        const tabelle = state.userLeagueId === liga.id ? (state.standings || []) : ((state.standingsByLeague || {})[liga.id] || []);
        const meisterId = tabelle[0]?.clubId || null;
        const vizeId = tabelle[1]?.clubId || null;
        const pokal = state.cups?.de_cup;
        const pokalsiegerId = pokal && pokal.completed ? pokal.winnerId : null;
        state.supercupVorlage = { saison: state.seasonYear || 1, meisterId, vizeId, pokalsiegerId };
        return state.supercupVorlage;
    },

    /** Die Paarung dieser Saison - beim ersten Zugriff aus der Vorlage gebildet */
    paarung(state) {
        const saison = state?.seasonYear || 1;
        if (state.supercup && state.supercup.saison === saison) return state.supercup;
        const v = state.supercupVorlage && state.supercupVorlage.saison === saison ? state.supercupVorlage : null;
        let heimId = v?.meisterId || null;
        let gastId = v?.pokalsiegerId && v.pokalsiegerId !== heimId ? v.pokalsiegerId : (v?.vizeId || null);
        let grund = v ? (gastId === v.pokalsiegerId ? "Meister gegen Pokalsieger" : "Meister und Pokalsieger gegen den Vizemeister") : null;
        if (!heimId || !gastId) {
            // Erste Saison: die beiden größten Namen der ersten Liga
            const liga = this._ersteLiga(state);
            const vereine = (state.clubs || []).filter(c => c.leagueId === liga?.id).sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
            if (vereine.length < 2) return null;
            heimId = vereine[0].id; gastId = vereine[1].id;
            grund = "die beiden größten Namen der Liga";
        }
        state.supercup = {
            saison, grund, siegerId: null, abgeschlossen: false,
            partie: {
                id: `supercup_${saison}`, competitionId: "supercup", roundName: this.name(state), roundNumber: 1,
                homeClubId: heimId, awayClubId: gastId, played: false, homeGoals: null, awayGoals: null,
                isCup: true, neutralerPlatz: true, penaltyWinner: null
            }
        };
        return state.supercup;
    },

    _eigen(state, p) { return !!p && (p.partie.homeClubId === state.userClubId || p.partie.awayClubId === state.userClubId); },

    /** Für Kalender und Weiter-Knopf: die eigene Partie an diesem Abend */
    eigenePartieAm(state) {
        const p = this.paarung(state);
        if (!p || p.partie.played || !this._eigen(state, p)) return null;
        return { partie: p.partie, runde: { matches: [p.partie], roundName: this.name(state) }, wettbewerb: { id: "supercup", name: this.name(state) }, ko: true };
    },

    /** Der Abend: Ohne den eigenen Verein wird gleich gespielt, sonst übernimmt das Livespiel */
    spieleTermin(state) {
        const p = this.paarung(state);
        if (!p || p.partie.played) return { eigenePartie: null };
        if (this._eigen(state, p)) return { eigenePartie: p.partie };
        const cup = _scResolve("CupEngine", "./cupEngine.js");
        if (cup && typeof cup.austragen === "function") cup.austragen(state, p.partie, true);
        return { eigenePartie: null };
    },

    /** Sieger, Prämie, Titel und Nachricht */
    schliesseTerminAb(state) {
        const p = this.paarung(state);
        if (!p || !p.partie.played || p.abgeschlossen) return [];
        const cup = _scResolve("CupEngine", "./cupEngine.js");
        const sieger = cup && typeof cup.siegerVon === "function" ? cup.siegerVon(p.partie) : (p.partie.homeGoals >= p.partie.awayGoals ? p.partie.homeClubId : p.partie.awayClubId);
        p.siegerId = sieger;
        p.abgeschlossen = true;
        const finde = (id) => (state.clubs || []).find(c => c.id === id);
        const club = finde(sieger);
        const verlierer = finde(sieger === p.partie.homeClubId ? p.partie.awayClubId : p.partie.homeClubId);
        const fin = _scResolve("FinanceEngine", "./financeEngine.js");
        const praemie = club && fin && typeof fin.sponsorPerMatchday === "function"
            ? Math.round(fin.sponsorPerMatchday(club) * this.PRAEMIE_FAKTOR / 1000) * 1000 : 0;
        if (club && praemie > 0) {
            club.balance = (club.balance || 0) + praemie;
            if (fin && typeof fin.recordTransaction === "function") fin.recordTransaction(state, club.id, "prize", praemie, `Prämie ${this.name(state)}`);
        }
        if (sieger === state.userClubId) {
            const career = _scResolve("CareerEngine", "./careerEngine.js");
            if (career && typeof career.vermerkeTitel === "function") career.vermerkeTitel(state, this.name(state), p.saison);
        }
        const ergebnis = `${p.partie.homeGoals}:${p.partie.awayGoals}${p.partie.penaltyScore ? ` (${p.partie.penaltyScore[0]}:${p.partie.penaltyScore[1]} i. E.)` : ""}`;
        if (Array.isArray(state.inbox)) {
            state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
                date: state.currentDate || "", sender: "Sportpresse",
                subject: `🏆 ${this.name(state)}: ${club?.name || "?"} gewinnt`,
                body: `${club?.name || "?"} gewinnt den ${this.name(state)} gegen ${verlierer?.name || "?"} (${ergebnis}) - ${p.grund}.`,
                read: false, type: sieger === state.userClubId ? "board_message" : "news" });
        }
        return [`🏆 ${this.name(state)}: ${club?.name || "?"} gewinnt ${ergebnis}`];
    }
};

if (typeof window !== "undefined") {
    window.SupercupEngine = SupercupEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SupercupEngine };
}
