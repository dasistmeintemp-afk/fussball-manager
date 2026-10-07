/**
 * BoardEngine - Vorstandszufriedenheit, Zielverfolgung und Management-Bewertung
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _boardResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));

    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const BoardEngine = {
    /**
     * Das Saisonziel des Vorstands - gemessen an dem, was der Verein hat.
     *
     * Vorher stand das Ziel einmal fest: abgeleitet aus einer Vereinsstärke
     * beim Erzeugen der Welt, und geändert nur pauschal bei Auf- oder Abstieg
     * ("Klassenerhalt" nach jedem Aufstieg, "Aufstieg" nach jedem Abstieg).
     * Wer den Kader verstärkte oder verkaufte, bekam dasselbe Ziel. Jetzt
     * schaut der Vorstand vor jeder Saison auf drei Dinge, jeweils als Rang
     * in der eigenen Liga: die Stärke des Kaders (60 %), den Etat aus
     * Gehalts- und Transferbudget (20 %) und das Ansehen des Vereins (20 %).
     * Daraus ergibt sich, wo der Verein hingehört; einen Platz Spielraum gibt
     * der Vorstand dazu. Schlechter als den ersten Nichtabstiegsplatz
     * verlangt er nie. Wer klar vorn liegt, soll Meister werden oder
     * aufsteigen.
     *
     * Mitten in der Saison (lage = aktueller Platz) trifft sich der Vorstand
     * in der Mitte zwischen dem, was der Kader hergibt, und der Tabelle.
     */
    ZIEL_GEWICHTE: { kader: 0.6, etat: 0.2, ruf: 0.2, spielraum: 1 },

    /** Die Liga eines Vereins - beim Spielstart steht sie noch nicht im Spielstand */
    ligaVon(state, club) {
        const ausState = (state?.leagues || []).find(l => l.id === club?.leagueId);
        if (ausState) return ausState;
        const wg = _boardResolve('WorldGenerator', './worldGenerator.js');
        const alle = wg && typeof wg.getLeagues === 'function' ? wg.getLeagues() : [];
        return (alle || []).find(l => l.id === club?.leagueId) || null;
    },

    bestimmeZiel(state, club, lage = null) {
        if (!state || !club) return null;
        const liga = this.ligaVon(state, club);
        const vereine = (state.clubs || []).filter(c => c.leagueId === club.leagueId);
        const n = vereine.length || liga?.teamCount || 18;
        const ce = _boardResolve('ContractEngine', './contractEngine.js');
        const spielerNach = new Map((state.players || []).map(p => [p.id, p]));
        const rang = (wert) => vereine
            .map(c => ({ id: c.id, v: wert(c) }))
            .sort((a, b) => b.v - a.v)
            .findIndex(x => x.id === club.id) + 1;

        const raenge = {
            kader: rang(c => (ce && typeof ce.vereinsNiveau === 'function' ? ce.vereinsNiveau(c, spielerNach) : null) ?? 0),
            etat: rang(c => (c.wageBudget || 0) * 52 + (c.transferBudget || 0)),
            ruf: rang(c => c.reputation || 0)
        };
        const G = this.ZIEL_GEWICHTE;
        const erwartet = raenge.kader * G.kader + raenge.etat * G.etat + raenge.ruf * G.ruf;

        let platz = erwartet < 1.5 ? 1 : Math.round(erwartet) + G.spielraum;
        if (typeof lage === 'number' && lage > platz) platz = Math.round((platz + lage) / 2);
        const abstieg = Array.isArray(liga?.relegationSpots) ? liga.relegationSpots : [];
        const rettung = abstieg.length ? Math.min(...abstieg) - 1 : n;
        platz = Math.max(1, Math.min(platz, rettung, n));

        const aufstieg = (liga?.level || 1) > 1 && Array.isArray(liga?.promotionSpots) ? liga.promotionSpots.length : 0;
        let art;
        if (platz === 1 && !aufstieg) art = "championship";
        else if (aufstieg && platz <= aufstieg) art = "promotion";
        else if (platz <= 3) art = "top3";
        else if (platz <= 6) art = "top6";
        else if (platz <= Math.ceil(n / 2)) art = "midfield";
        else if (platz < rettung) art = "lower_mid";
        else art = "avoid_relegation";

        club.boardExpectation = art;
        club.vorstandsziel = { platz, art, n, leagueId: club.leagueId, saison: state.seasonYear || 1, raenge, erwartet: Math.round(erwartet * 10) / 10 };
        return club.vorstandsziel;
    },

    /** Der Platz, den der Vorstand erwartet - auch für ältere Spielstände */
    zielPlatz(state, club) {
        const z = club?.vorstandsziel;
        if (z && typeof z.platz === 'number' && z.leagueId === club.leagueId) return z.platz;
        const liga = this.ligaVon(state, club);
        const n = (state?.standings || []).length || liga?.teamCount || 18;
        const abstieg = Array.isArray(liga?.relegationSpots) && liga.relegationSpots.length ? Math.min(...liga.relegationSpots) - 1 : n - 3;
        switch (club?.boardExpectation) {
            case "championship": return 1;
            case "promotion": return Math.max(1, (liga?.promotionSpots || [1]).length);
            case "top3": return 3;
            case "top6": return 6;
            case "midfield": return Math.ceil(n / 2);
            case "lower_mid": return Math.max(Math.ceil(n / 2) + 1, abstieg - 2);
            case "avoid_relegation": return abstieg;
            default: return Math.ceil(n / 2);
        }
    },

    /** "Platz 5 oder besser - Platz unter den ersten sechs" */
    zielText(state, club) {
        const gs = _boardResolve('GameState', './gameState.js');
        const art = club?.boardExpectation;
        const text = gs && typeof gs.getExpectationText === 'function' ? gs.getExpectationText(art) : String(art || "");
        const platz = this.zielPlatz(state, club);
        return platz === 1 ? text : `${text} (Platz ${platz} oder besser)`;
    },

    /** Warum der Vorstand das verlangt - für die Post zum Saisonstart */
    zielBegruendung(club) {
        const z = club?.vorstandsziel;
        if (!z || !z.raenge) return "";
        const stelle = r => r === 1 ? "der stärkste" : `der ${r}.-stärkste`;
        return `Unser Kader ist ${stelle(z.raenge.kader).replace("stärkste", "stärkste der Liga")}, `
            + `beim Etat liegen wir auf Rang ${z.raenge.etat}, beim Ansehen auf Rang ${z.raenge.ruf} von ${z.n}.`;
    },

    /**
     * Aktualisiert die Vorstandszufriedenheit basierend auf Tabelle, Zielen, Finanzen und Form
     */
    updateConfidence(state) {
        if (!state || !state.userClubId) return;

        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        const standings = state.standings || [];
        const rankIndex = standings.findIndex(s => s.clubId === state.userClubId);
        const rank = rankIndex !== -1 ? rankIndex + 1 : 10;
        // Der Zielplatz gilt in der eigenen Liga - vorher wurde hier mit der
        // Zahl aller Vereine der Welt gerechnet ("Mittelfeld" = Platz 100)
        const targetRank = this.zielPlatz(state, userClub);

        // Basis-Berechnung nach Tabellenposition
        const rankDiff = targetRank - rank; // Positiv = besser als Ziel, Negativ = schlechter
        let newConf = userClub.confidence || 75;

        // Schrittweise Anpassung
        if (rankDiff > 2) {
            newConf += 2;
        } else if (rankDiff > 0) {
            newConf += 1;
        } else if (rankDiff < -3) {
            newConf -= 3;
        } else if (rankDiff < 0) {
            newConf -= 1;
        }

        // Einfluss der Finanzen
        if (userClub.balance < 0) {
            newConf -= 2;
        }
        if (userClub.wageBudget < 0) {
            newConf -= 1;
        }

        // Form der letzten Spiele
        const formArr = Array.isArray(userClub.form) ? userClub.form : (userClub.form ? String(userClub.form).split("") : []);
        const lastGames = formArr.slice(-3);
        const winsInLast = lastGames.filter(g => g === "W" || g === "S").length;
        const lossesInLast = lastGames.filter(g => g === "L" || g === "N").length;

        if (winsInLast >= 2) newConf += 1;
        if (lossesInLast >= 2) newConf -= 2;

        // Grenzen einhalten (10% bis 100%)
        newConf = Math.max(10, Math.min(100, Math.round(newConf)));
        userClub.confidence = newConf;

        // Vorstandsnachricht bei kritischer Zufriedenheit
        if (newConf < 35 && (!userClub.lastWarningMatchday || state.currentMatchday - userClub.lastWarningMatchday > 4)) {
            userClub.lastWarningMatchday = state.currentMatchday;
            const newsEngine = _boardResolve('NewsEngine', './newsEngine.js');
            if (newsEngine) {
                newsEngine.createBoardMessage(state, {
                    title: "Krise: Ultimatum des Vorstands",
                    text: `Sehr geehrter Manager, der Vorstand ist mit den jüngsten Leistungen und Tabellenplatz ${rank} äußerst unzufrieden. Wir erwarten in den kommenden Spielen eine spürbare Leistungssteigerung!`,
                    priority: "high"
                });
            }
        }

        return {
            confidence: newConf,
            targetRank: targetRank,
            currentRank: rank,
            message: this.getBoardMessage(state)
        };
    },

    /**
     * Liefert eine passende textuelle Zusammenfassung der Vorstandsstimmung
     */
    getBoardMessage(state) {
        if (!state || !state.userClubId) return "Keine Daten verfügbar.";
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return "";

        const conf = userClub.confidence || 75;
        if (conf >= 85) return "Der Vorstand ist begeistert von Ihrer Arbeit und vollauf zufrieden!";
        if (conf >= 70) return "Der Vorstand ist mit dem aktuellen Saisonverlauf und den Fortschritten zufrieden.";
        if (conf >= 50) return "Der Vorstand beobachtet die Situation aufmerksam. Es gibt noch Raum für Verbesserungen.";
        if (conf >= 35) return "Der Vorstand ist besorgt über die jüngsten Resultate. Die Saisonziele sind in Gefahr.";
        return "Alarmstufe Rot: Der Vorstand fordert sofortige Ergebnisse, andernfalls droht die Freistellung!";
    },

    /**
     * Saisonschluss-Bewertung
     */
    evaluateSeasonEnd(state) {
        if (!state || !state.userClubId) return { grade: "B", text: "" };
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const standings = state.standings || [];
        const rankIndex = standings.findIndex(s => s.clubId === state.userClubId);
        const rank = rankIndex !== -1 ? rankIndex + 1 : 10;

        const achieved = rank <= this.zielPlatz(state, userClub);

        return {
            achieved: achieved,
            finalRank: rank,
            confidence: userClub.confidence || 75,
            message: achieved 
                ? `Herzlichen Glückwunsch! Das Saisonziel wurde mit Platz ${rank} erfolgreich erreicht.`
                : `Das Saisonziel wurde mit Platz ${rank} leider verfehlt.`
        };
    }
};

if (typeof window !== "undefined") {
    window.BoardEngine = BoardEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BoardEngine };
}
