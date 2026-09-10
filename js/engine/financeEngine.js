/**
 * FinanceEngine - Finanzhaushalt, Spieltagseinnahmen, Gehälter, Sponsoring und Buchhaltung
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _feResolve = (globalName, path) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[globalName]; } catch (e) { return null; }
    }
    return null;
};

const FinanceEngine = {
    /**
     * Anteil der Einnahmen, der für den laufenden Betrieb draufgeht.
     * Gehälter und Stadionunterhalt kommen obendrauf.
     */
    OPERATING_COST_SHARE: 0.05,

    /**
     * Wirtschaftskraft nach Ligastufe.
     *
     * Die Gehälter fielen von der Bundesliga zur Landesliga um den Faktor 270,
     * die Sponsorenzahlung aber nur um den Faktor acht - ein Landesligist nahm
     * 150.000 € pro Spieltag ein und zahlte 2.850 € Gehälter. Nach fünf
     * Saisons saß jeder Amateurverein auf einem zweistelligen Millionenbetrag.
     */
    LEVEL_ECONOMY: { 1: 1.0, 2: 0.55, 3: 0.28, 4: 0.15, 5: 0.11, 6: 0.09, 7: 0.08 },

    /** Sponsorenzahlung eines Vereins je Spieltag */
    sponsorPerMatchday(club) {
        if (!club) return 0;
        if (club.sponsor && club.sponsor.amountPerMatchday) return club.sponsor.amountPerMatchday;
        const faktor = this.LEVEL_ECONOMY[club.level || 1] ?? 0.05;
        return Math.round((club.reputation || 70) * 15000 * faktor);
    },

    /** Unterhalt für Stadion und Infrastruktur je Spieltag */
    maintenancePerMatchday(club) {
        if (!club) return 0;
        const stufen = club.facilities ? Object.values(club.facilities).reduce((a, b) => a + b, 0) : 5;
        const faktor = this.LEVEL_ECONOMY[club.level || 1] ?? 0.05;
        return Math.round(stufen * 25000 * faktor);
    },

    /**
     * Erfasst eine Finanztransaktion im Vereinsbuch
     */
    recordTransaction(state, clubId, type, amount, description) {
        if (!state) return null;
        if (!state.finances) state.finances = { transactions: [] };
        if (!Array.isArray(state.finances.transactions)) state.finances.transactions = [];

        // Das Buchungsjournal zeigt ausschließlich den eigenen Verein. Mit 218
        // Vereinen in der Welt würden pro Spieltag über 650 fremde Buchungen
        // anfallen und die eigenen Einträge aus dem Journal verdrängen.
        if (state.userClubId && clubId !== state.userClubId) return null;

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

        // C4: Auslastung abhängig von Reputation, Tabellenplatz, Form, fanMood, Stadionstufe
        const repFactor = ((homeClub.reputation || 70) * 1.2 + (awayClub?.reputation || 60) * 0.8) / 200;
        const stadiumLevel = homeClub.facilities?.stadium || 2;
        const stadiumBonus = (stadiumLevel - 1) * 0.03;
        const moodFactor = ((state.fanMood || 75) - 50) / 250; // -0.1 bis +0.2

        const ticketPrice = homeClub.ticketPrice || 35;
        // Preis-Elastizität: Höherer Preis senkt Auslastung, tieferer Preis füllt das Stadion
        const priceFactor = 1.0 - ((ticketPrice - 35) / 100) * 0.6;

        let baseAttendancePct = 0.62 + (repFactor * 0.2) + stadiumBonus + moodFactor;
        baseAttendancePct *= Math.max(0.4, Math.min(1.2, priceFactor));

        // Das Stadion atmet mit der Saison. Vorher war ein Spitzenverein immer
        // ausverkauft - beim Derby genauso wie beim Kellerduell im Februar.
        const gruende = [];

        // Wie läuft es gerade? Eine Serie füllt das Haus, eine Krise leert es.
        const form = (homeClub.form || []).filter(r => r && r !== "-").slice(-5);
        if (form.length >= 3) {
            const siege = form.filter(r => r === "W").length;
            const pleiten = form.filter(r => r === "L").length;
            const formEffekt = (siege - pleiten) * 0.025;
            baseAttendancePct += formEffekt;
            if (formEffekt >= 0.05) gruende.push("gute Form");
            else if (formEffekt <= -0.05) gruende.push("sportliche Krise");
        }

        // Ein Spitzenspiel zieht, ein Duell zweier Abstiegskandidaten nicht
        const tabelle = state.standingsByLeague?.[homeClub.leagueId] || state.standings || [];
        const platz = (id) => {
            const i = tabelle.findIndex(e => e.clubId === id);
            return i === -1 ? null : i + 1;
        };
        const eigenerPlatz = platz(homeClub.id);
        const gegnerPlatz = awayClub ? platz(awayClub.id) : null;
        if (eigenerPlatz !== null && gegnerPlatz !== null && tabelle.length > 4) {
            const spitzenNaehe = 1 - ((eigenerPlatz + gegnerPlatz) / 2) / tabelle.length;
            baseAttendancePct += (spitzenNaehe - 0.5) * 0.12;
            if (eigenerPlatz <= 3 && gegnerPlatz <= 3) gruende.push("Spitzenspiel");
        }

        // Und dann gibt es Spiele, die immer voll sind
        const rivalry = _feResolve("RivalryEngine", "./rivalryEngine.js");
        if (match.isDerby && rivalry && typeof rivalry.matchdayEffects === "function") {
            baseAttendancePct += rivalry.matchdayEffects(match).zuschauerBonus;
            gruende.push(match.derbyTitle || "Derby");
        }

        const randVariation = (Math.random() * 0.08) - 0.04;
        const finalPct = Math.min(1.0, Math.max(0.3, baseAttendancePct + randVariation));

        const capacity = homeClub.capacity || 30000;
        const attendance = Math.min(capacity, Math.round(capacity * finalPct));
        const ticketIncome = Math.round(attendance * ticketPrice);

        homeClub.balance = (homeClub.balance || 0) + ticketIncome;
        match.attendance = attendance;
        match.ticketIncome = ticketIncome;
        match.attendancePct = Math.round(finalPct * 100);
        match.attendanceReason = gruende.join(", ") || null;
        match.soldOut = attendance >= capacity;

        this.recordTransaction(
            state,
            homeClub.id,
            "ticket_income",
            ticketIncome,
            `Ticketeinnahmen Heimspiel vs. ${awayClub?.name || 'Gegner'} (${attendance.toLocaleString('de-DE')} Zuschauer zu ${ticketPrice} €`
                + (match.soldOut ? ", ausverkauft" : `, ${match.attendancePct} % Auslastung`) + ")"
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
            const sponsorIncome = this.sponsorPerMatchday(club);
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
            const maintenanceCosts = this.maintenancePerMatchday(club);
            club.balance -= maintenanceCosts;

            this.recordTransaction(
                state,
                club.id,
                "facility_cost",
                -maintenanceCosts,
                `Infrastruktur- und Stadionunterhalt`
            );

            // 4. Betriebsaufwand: Trainerstab, Verwaltung, Nachwuchsabteilung,
            //    Reisen, Spieltagsorganisation. Ohne diesen Posten kannte die
            //    Bilanz jedes Vereins nur eine Richtung - nach fünf Saisons
            //    saß selbst der Landesligist auf einem Millionenpolster.
            const ticketSchnitt = Math.round((club.stadiumCapacity || club.capacity || 20000) * 0.8 * (club.ticketPrice || 35) / 2);
            const operatingCosts = Math.round((sponsorIncome + ticketSchnitt) * this.OPERATING_COST_SHARE);
            club.balance -= operatingCosts;

            this.recordTransaction(
                state,
                club.id,
                "operating_cost",
                -operatingCosts,
                `Betriebsaufwand (Stab, Verwaltung, Nachwuchs, Reisen)`
            );

            // 5. Notbremse: Kein Verein rutscht unbegrenzt ins Minus. Wird die
            //    Schuldengrenze gerissen, springt der Vorstand ein - dafür ist
            //    der Transferetat für den Rest der Saison aufgebraucht.
            const schuldengrenze = -Math.round(sponsorIncome * 12);
            if ((club.balance || 0) < schuldengrenze) {
                const hilfe = schuldengrenze - club.balance;
                club.balance = schuldengrenze;
                club.transferBudget = 0;

                this.recordTransaction(
                    state,
                    club.id,
                    "board_support",
                    hilfe,
                    `Kapitalspritze des Vorstands - der Transferetat ist gestrichen`
                );

                if (club.id === state.userClubId && Array.isArray(state.inbox)) {
                    const schonGemeldet = state.inbox.some(m => m.type === "finance_warning" && m.matchday === state.currentMatchday);
                    if (!schonGemeldet) {
                        state.inbox.unshift({
                            id: Date.now() + 31,
                            matchday: state.currentMatchday,
                            date: `Spieltag ${state.currentMatchday}`,
                            sender: "Vorstand",
                            subject: "⚠️ Der Verein ist an der Schuldengrenze",
                            body: `Wir mussten Geld nachschießen, um den Spielbetrieb zu sichern. Der Transferetat ist gestrichen, bis die Bilanz wieder stimmt.\n\nSenken Sie die Gehaltslast, verkaufen Sie Spieler oder erhöhen Sie die Einnahmen.`,
                            read: false,
                            type: "finance_warning"
                        });
                    }
                }
            }
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
        const sponsorPerWeek = this.sponsorPerMatchday(club);
        const estTicketPerMatch = Math.round((club.stadiumCapacity || club.capacity || 30000) * 0.85 * (club.ticketPrice || 35));

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
