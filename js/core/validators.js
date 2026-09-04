/**
 * StateValidator - Zentrale Validierungslogik für Spielzustand, Aufstellung, Spielplan und Transfers
 */

const StateValidator = {
    /**
     * Prüft, ob ein Spielstand grundlegend valide ist
     */
    validateState(state) {
        if (!state || typeof state !== 'object') {
            return { valid: false, error: "Ungültiges State-Objekt." };
        }
        if (!state.userClubId) {
            return { valid: false, error: "Kein Nutzerverein ausgewählt." };
        }
        if (!Array.isArray(state.clubs) || state.clubs.length < 2) {
            return { valid: false, error: "Zu wenige Vereine vorhanden." };
        }
        if (!Array.isArray(state.players) || state.players.length === 0) {
            return { valid: false, error: "Keine Spieler in der Datenbank." };
        }
        if (!Array.isArray(state.schedule) || state.schedule.length === 0) {
            return { valid: false, error: "Kein Spielplan generiert." };
        }
        if (!Array.isArray(state.standings) || state.standings.length === 0) {
            return { valid: false, error: "Tabelle fehlt." };
        }

        // Spielerzuordnung prüfen
        for (const p of state.players) {
            if (p.clubId && !state.clubs.some(c => c.id === p.clubId)) {
                return { valid: false, error: `Spieler ${p.name} ist einem nicht existierenden Verein zugeordnet: ${p.clubId}` };
            }
        }

        return { valid: true };
    },

    /**
     * Prüft die Auswahl eines Vereins
     */
    validateClubSelection(state, clubId) {
        if (!state || !Array.isArray(state.clubs)) {
            return { valid: false, error: "Keine Vereinsliste verfügbar." };
        }
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) {
            return { valid: false, error: `Verein mit ID '${clubId}' existiert nicht.` };
        }
        return { valid: true, club };
    },

    /**
     * Prüft den Spielplan auf Vollständigkeit und Fehlerfreiheit
     */
    validateSchedule(state) {
        if (!state || !Array.isArray(state.schedule) || state.schedule.length === 0) {
            return { valid: false, error: "Spielplan ist leer." };
        }

        const clubIds = state.clubs.map(c => c.id);
        const matchdayCount = state.schedule.length;

        for (const round of state.schedule) {
            const participatingTeams = new Set();
            for (const match of round.matches) {
                if (match.homeClubId === match.awayClubId) {
                    return { valid: false, error: `Verein ${match.homeClubId} spielt an Spieltag ${round.matchday} gegen sich selbst.` };
                }
                if (participatingTeams.has(match.homeClubId)) {
                    return { valid: false, error: `Verein ${match.homeClubId} ist an Spieltag ${round.matchday} doppelt angesetzt.` };
                }
                if (participatingTeams.has(match.awayClubId)) {
                    return { valid: false, error: `Verein ${match.awayClubId} ist an Spieltag ${round.matchday} doppelt angesetzt.` };
                }
                participatingTeams.add(match.homeClubId);
                participatingTeams.add(match.awayClubId);
            }
        }

        return { valid: true, matchdayCount };
    },

    /**
     * Prüft die Startelf eines Vereins vor Spielbeginn
     */
    validateLineup(state, clubId) {
        if (!state) return { valid: false, error: "Kein Spielstand geladen." };
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { valid: false, error: "Verein nicht gefunden." };

        const lineupIds = club.lineup || [];
        if (lineupIds.length !== 11) {
            return { 
                valid: false, 
                error: `Die Startelf muss aus genau 11 Spielern bestehen (aktuell: ${lineupIds.length}).` 
            };
        }

        // Duplikate prüfen
        const uniqueIds = new Set(lineupIds);
        if (uniqueIds.size !== 11) {
            return { valid: false, error: "Ein Spieler ist mehrfach in der Startelf aufgestellt." };
        }

        const starters = lineupIds.map(id => state.players.find(p => p.id === id)).filter(Boolean);
        if (starters.length !== 11) {
            return { valid: false, error: "Einige aufgestellte Spieler existieren nicht im Kader." };
        }

        // Torwart-Prüfung
        const gkCount = starters.filter(p => p.pos === "TW").length;
        if (gkCount === 0) {
            return { valid: false, error: "In der Startelf fehlt ein Torwart (TW)." };
        }
        if (gkCount > 1) {
            return { valid: false, error: "In der Startelf darf sich maximal 1 Torwart befinden." };
        }

        // Verletzungen & Sperren
        for (const p of starters) {
            if (p.injured) {
                return { valid: false, error: `Der aufgestellte Spieler ${p.name} ist verletzt (${p.injuryWeeks} Wochen verbleibend).` };
            }
            if (p.suspended) {
                return { valid: false, error: `Der aufgestellte Spieler ${p.name} ist für dieses Spiel gesperrt.` };
            }
        }

        return { valid: true };
    },

    /**
     * Prüft ein Transferangebot auf Machbarkeit und Budget
     */
    validateTransfer(state, payload) {
        const { buyerClubId, sellerClubId, playerId, fee, wage } = payload;
        const buyer = state.clubs.find(c => c.id === buyerClubId);
        const player = state.players.find(p => p.id === playerId);

        if (!buyer) return { valid: false, error: "Kaufender Verein existiert nicht." };
        if (!player) return { valid: false, error: "Spieler existiert nicht." };
        if (player.clubId !== sellerClubId) return { valid: false, error: "Spieler gehört nicht zum Verkäufer-Verein." };
        if (buyer.transferBudget < fee) return { valid: false, error: "Nicht genügend Transferbudget vorhanden." };
        if (buyer.wageBudget < wage) return { valid: false, error: "Gehaltsbudget reicht für dieses Gehalt nicht aus." };

        return { valid: true };
    },

    /**
     * Prüft eine Save-Payload beim Import
     */
    validateSavePayload(saveObj) {
        if (!saveObj || typeof saveObj !== 'object') {
            return { valid: false, error: "Ungültiges Dateiformat. Keine JSON-Objektstruktur." };
        }
        if (!saveObj.state && !saveObj.clubs) {
            return { valid: false, error: "Datei enthält keinen gültigen Fußballmanager-Spielstand." };
        }
        const state = saveObj.state || saveObj;
        if (!state.clubs || !state.players || !state.schedule) {
            return { valid: false, error: "Spielstand ist unvollständig (Clubs, Spieler oder Spielplan fehlen)." };
        }
        return { valid: true, state };
    }
};

if (typeof window !== "undefined") {
    window.StateValidator = StateValidator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StateValidator };
}
