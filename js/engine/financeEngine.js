/**
 * FinanceEngine - Finanzhaushalt, Spieltagseinnahmen, Gehälter, Sponsoring und Buchhaltung
 */

const FinanceEngine = {
    /**
     * Erfasst eine Finanztransaktion im Vereinsbuch
     */
    recordTransaction(state, clubId, type, amount, description) {
        if (!state) return null;
        if (!state.finances) state.finances = { transactions: [] };
        if (!Array.isArray(state.finances.transactions)) state.finances.transactions = [];

        const txn = {
            id: "txn_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            clubId: clubId,
            date: `Saison ${state.seasonYear || 1}, Spieltag ${state.currentMatchday || 1}`,
            matchday: state.currentMatchday || 1,
            season: state.seasonYear || 1,
            type: type, // 'ticket_income', 'sponsor_income', 'wages', 'transfer_in', 'transfer_out', 'facility_cost', 'bonus'
            amount: amount,
            description: description || ""
        };

        state.finances.transactions.unshift(txn);

        // Historie begrenzen
        if (state.finances.transactions.length > 300) {
            state.finances.transactions = state.finances.transactions.slice(0, 300);
        }

        return txn;
    },

    /**
     * Berechnet die Ticketeinnahmen und Zuschauerzahl für ein Heimspiel
     */
    applyMatchdayIncome(state, match) {
        if (!state || !match) return 0;
        const homeClub = state.clubs.find(c => c.id === match.homeClubId);
        const awayClub = state.clubs.find(c => c.id === match.awayClubId);
        if (!homeClub) return 0;

        // Stadionauslastung abhängig von Reputation und Form
        const repFactor = ((homeClub.reputation || 70) + (awayClub?.reputation || 60)) / 200;
        const baseAttendancePct = 0.70 + (repFactor * 0.28);
        const randVariation = (Math.random() * 0.08) - 0.04;
        const finalPct = Math.min(1.0, Math.max(0.4, baseAttendancePct + randVariation));

        const capacity = homeClub.capacity || 30000;
        const attendance = Math.round(capacity * finalPct);
        const avgTicketPrice = 35; // 35 Euro Durchschnittspreis
        const ticketIncome = Math.round(attendance * avgTicketPrice);

        homeClub.balance = (homeClub.balance || 0) + ticketIncome;
        match.attendance = attendance;
        match.ticketIncome = ticketIncome;

        this.recordTransaction(
            state, 
            homeClub.id, 
            "ticket_income", 
            ticketIncome, 
            `Ticketeinnahmen Heimspiel vs. ${awayClub?.name || 'Gegner'} (${attendance.toLocaleString('de-DE')} Zuschauer)`
        );

        return ticketIncome;
    },

    /**
     * Verbucht wöchentliche Gehälter, Sponsoring und Unterhaltskosten aller Vereine
     */
    applyWeeklyCosts(state) {
        if (!state || !Array.isArray(state.clubs)) return;

        state.clubs.forEach(club => {
            // 1. Sponsoreneinnahmen
            const sponsorIncome = club.sponsor?.amountPerMatchday || Math.round((club.reputation || 70) * 15000);
            club.balance = (club.balance || 0) + sponsorIncome;
            this.recordTransaction(
                state, 
                club.id, 
                "sponsor_income", 
                sponsorIncome, 
                `Sponsorenzahlung Spieltag ${state.currentMatchday}`
            );

            // 2. Spielergehälter
            const clubPlayers = state.players.filter(p => p.clubId === club.id);
            const totalWeeklyWages = clubPlayers.reduce((sum, p) => sum + (p.wage || 10000), 0);
            club.balance -= totalWeeklyWages;

            this.recordTransaction(
                state, 
                club.id, 
                "wages", 
                -totalWeeklyWages, 
                `Spielergehälter Spieltag ${state.currentMatchday} (${clubPlayers.length} Spieler)`
            );

            // 3. Stadion- & Infrastrukturunterhalt
            const facilityLevel = club.facilities ? Object.values(club.facilities).reduce((a, b) => a + b, 0) : 5;
            const maintenanceCosts = Math.round(facilityLevel * 25000);
            club.balance -= maintenanceCosts;

            this.recordTransaction(
                state, 
                club.id, 
                "facility_cost", 
                -maintenanceCosts, 
                `Infrastruktur- und Stadionunterhalt`
            );
        });
    },

    /**
     * Erstellt eine detaillierte Finanzübersicht für einen Verein
     */
    getFinanceSummary(state, clubId) {
        if (!state) return null;
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return null;

        const clubPlayers = state.players.filter(p => p.clubId === clubId);
        const weeklyWages = clubPlayers.reduce((sum, p) => sum + (p.wage || 0), 0);
        const sponsorPerWeek = club.sponsor?.amountPerMatchday || Math.round((club.reputation || 70) * 15000);
        const estTicketPerMatch = Math.round((club.capacity || 30000) * 0.85 * 35);

        const txns = (state.finances?.transactions || []).filter(t => t.clubId === clubId);

        return {
            balance: club.balance || 0,
            transferBudget: club.transferBudget || 0,
            wageBudget: club.wageBudget || 0,
            currentWeeklyWages: weeklyWages,
            wageBudgetRemaining: (club.wageBudget || 0) - weeklyWages,
            estimatedWeeklyIncome: sponsorPerWeek + Math.round(estTicketPerMatch / 2),
            estimatedWeeklyExpenses: weeklyWages + 100000,
            transactions: txns.slice(0, 20)
        };
    }
};

if (typeof window !== "undefined") {
    window.FinanceEngine = FinanceEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FinanceEngine };
}
