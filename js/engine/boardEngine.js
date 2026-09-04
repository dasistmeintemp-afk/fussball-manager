/**
 * BoardEngine - Vorstandszufriedenheit, Zielverfolgung und Management-Bewertung
 */

const BoardEngine = {
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
        const totalClubs = state.clubs.length;

        let targetRank = 9;
        switch (userClub.boardExpectation) {
            case "championship": targetRank = 1; break;
            case "top3": targetRank = 3; break;
            case "top6": targetRank = 6; break;
            case "midfield": targetRank = Math.floor(totalClubs / 2); break;
            case "avoid_relegation": targetRank = totalClubs - 3; break;
            default: targetRank = 10; break;
        }

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
            const newsEngine = (typeof NewsEngine !== 'undefined') ? NewsEngine : (typeof window !== 'undefined' ? window.NewsEngine : (typeof require !== 'undefined' ? require('./newsEngine.js').NewsEngine : null));
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

        let achieved = false;
        if (userClub.boardExpectation === "championship" && rank === 1) achieved = true;
        else if (userClub.boardExpectation === "top3" && rank <= 3) achieved = true;
        else if (userClub.boardExpectation === "top6" && rank <= 6) achieved = true;
        else if (userClub.boardExpectation === "midfield" && rank <= 12) achieved = true;
        else if (userClub.boardExpectation === "avoid_relegation" && rank <= 15) achieved = true;

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
