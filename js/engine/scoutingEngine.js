/**
 * ScoutingEngine - Scouts beauftragen, Talente sichten und Spielerberichte erstellen
 */

const ScoutingEngine = {
    /**
     * Startet einen neuen Scouting-Auftrag
     */
    startAssignment(state, criteria = {}) {
        if (!state) return { success: false, error: "Kein State vorhanden." };
        if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
        if (!Array.isArray(state.scouting.assignments)) state.scouting.assignments = [];

        if (state.scouting.assignments.filter(a => a.status === "active").length >= 3) {
            return { success: false, error: "Maximale Anzahl gleichzeitiger Scout-Aufträge (3) erreicht." };
        }

        const assignment = {
            id: "scout_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            position: criteria.position || "ALL",
            maxAge: criteria.maxAge || 26,
            minOverall: criteria.minOverall || 70,
            matchdaysRemaining: 2,
            status: "active",
            createdMatchday: state.currentMatchday || 1
        };

        state.scouting.assignments.push(assignment);

        return { success: true, assignment: assignment };
    },

    /**
     * Verarbeitet laufende Scouting-Aufträge am Ende jedes Spieltags
     */
    processWeeklyScouting(state) {
        if (!state || !state.scouting || !Array.isArray(state.scouting.assignments)) return;

        state.scouting.assignments.forEach(assignment => {
            if (assignment.status !== "active") return;

            assignment.matchdaysRemaining -= 1;

            if (assignment.matchdaysRemaining <= 0) {
                assignment.status = "completed";
                this.completeAssignment(state, assignment);
            }
        });
    },

    /**
     * Schließt einen Scouting-Auftrag ab und generiert Berichte
     */
    completeAssignment(state, assignment) {
        if (!state || !Array.isArray(state.players)) return;
        if (!Array.isArray(state.scouting.reports)) state.scouting.reports = [];

        // Passende Spieler filtern
        let pool = state.players.filter(p => p.clubId !== state.userClubId && !p.injured);

        if (assignment.position && assignment.position !== "ALL") {
            pool = pool.filter(p => p.pos === assignment.position || p.secondPos === assignment.position);
        }
        if (assignment.maxAge) {
            pool = pool.filter(p => p.age <= assignment.maxAge);
        }
        if (assignment.minOverall) {
            pool = pool.filter(p => p.overall >= assignment.minOverall);
        }

        // Zufällig bis zu 3 passende Spieler auswählen
        const shuffled = pool.sort(() => 0.5 - Math.random()).slice(0, 3);

        shuffled.forEach(player => {
            const report = this.generatePlayerReport(player, state);
            state.scouting.reports.unshift(report);
        });

        // Nachricht senden
        const newsEng = (typeof NewsEngine !== 'undefined' && NewsEngine) 
            ? NewsEngine 
            : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : null);

        if (newsEng && typeof newsEng.addMessage === 'function') {
            newsEng.addMessage(state, "scouting", {
                title: "Scouting-Auftrag abgeschlossen",
                sender: "Chefscout",
                text: `Unser Scouting-Team hat die Beobachtung für die Position ${assignment.position} abgeschlossen und ${shuffled.length} vielversprechende Spielerberichte vorgelegt.`,
                priority: "normal"
            });
        }
    },

    /**
     * Gezieltes Scouten eines konkreten Spielers (aus Gegneranalyse, Transfermarkt, Kader, Spielbericht)
     */
    scoutPlayer(state, playerId, options = {}) {
        if (!state || !Array.isArray(state.players)) {
            return { success: false, error: "Ungültiger Spielstand." };
        }

        const player = state.players.find(p => p.id === playerId || String(p.id) === String(playerId));
        if (!player) {
            return { success: false, error: "Spieler nicht gefunden." };
        }

        const source = options.source || "transfer_market";
        const scoutQuality = options.scoutQuality || 75;
        const amount = options.amount || (source === "opponent_analysis" ? 35 : (source === "quick" ? 25 : 40));

        this.increaseKnowledge(player, amount, scoutQuality);
        player.scoutingKnowledge.lastScoutedDate = state.currentDate || "Aktuell";

        const report = this.generatePlayerReport(player, state, options);

        if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
        if (!Array.isArray(state.scouting.reports)) state.scouting.reports = [];

        // Vorherige Berichte für diesen Spieler aktualisieren oder anheften
        const existingIdx = state.scouting.reports.findIndex(r => String(r.playerId) === String(player.id));
        if (existingIdx !== -1) {
            state.scouting.reports[existingIdx] = report;
        } else {
            state.scouting.reports.unshift(report);
        }

        if (options.notify) {
            const newsEng = (typeof NewsEngine !== 'undefined' && NewsEngine) 
                ? NewsEngine 
                : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : null);
            if (newsEng && typeof newsEng.addMessage === 'function') {
                newsEng.addMessage(state, "scouting", {
                    title: `Scoutbericht: ${player.name}`,
                    sender: "Scouting-Abteilung",
                    text: `Unser Scout hat ${player.name} (${player.pos}, ${player.age} Jahre) analysiert. Aktuelle Einschätzung: ${report.starsCa} Sterne (${report.abilityLabel}).`,
                    priority: "normal"
                });
            }
        }

        return {
            success: true,
            report,
            player,
            knowledgeLevel: player.scoutingKnowledge.knowledgeLevel
        };
    },

    /**
     * Erhöht das Scouting-Wissen über einen Spieler
     */
    increaseKnowledge(player, amount = 25, scoutQuality = 70) {
        if (!player.scoutingKnowledge) {
            player.scoutingKnowledge = { known: false, knowledgeLevel: 25, accuracy: 25, reportsCount: 0 };
        }
        const effectiveGain = Math.round(amount * (scoutQuality / 70));
        player.scoutingKnowledge.reportsCount = (player.scoutingKnowledge.reportsCount || 0) + 1;
        player.scoutingKnowledge.knowledgeLevel = Math.min(95, (player.scoutingKnowledge.knowledgeLevel || 25) + effectiveGain);
        player.scoutingKnowledge.accuracy = player.scoutingKnowledge.knowledgeLevel;
        return player.scoutingKnowledge;
    },

    /**
     * Ermittelt den aktuellen Wissensstand zu einem Spieler
     */
    getScoutingKnowledge(player, userClubId = null) {
        if (!player) return { known: false, knowledgeLevel: 0, accuracy: 0 };
        const isUserPlayer = player.clubId && userClubId && player.clubId === userClubId;
        if (isUserPlayer) {
            return { known: true, knowledgeLevel: 95, accuracy: 95, reportsCount: 10 };
        }
        return player.scoutingKnowledge || { known: false, knowledgeLevel: 25, accuracy: 25, reportsCount: 0 };
    },

    /**
     * Erstellt einen detaillierten Spieler-Scoutbericht mit Schätzspannen, Konfidenz und Stärken/Schwächen
     */
    generatePlayerReport(player, state = null, options = {}) {
        // Spieler-Scouting-Knowledge anheben falls nicht vorhanden
        if (!player.scoutingKnowledge) {
            player.scoutingKnowledge = { known: false, knowledgeLevel: 25, accuracy: 25, reportsCount: 0 };
        }
        player.scoutingKnowledge.reportsCount = (player.scoutingKnowledge.reportsCount || 0) + 1;
        if (!options.skipGain) {
            player.scoutingKnowledge.knowledgeLevel = Math.min(95, (player.scoutingKnowledge.knowledgeLevel || 25) + (options.amount || 25));
            player.scoutingKnowledge.accuracy = player.scoutingKnowledge.knowledgeLevel;
        }
        player.scoutingKnowledge.lastScoutedDate = state ? state.currentDate : "Aktuell";

        const ratingEngine = (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine)
            ? PlayerRatingEngine
            : ((typeof window !== 'undefined' && window.PlayerRatingEngine) ? window.PlayerRatingEngine : (typeof require !== 'undefined' ? require('./playerRatingEngine.js').PlayerRatingEngine : null));

        let card = null;
        if (ratingEngine && typeof ratingEngine.calculateVisiblePlayerCard === 'function') {
            card = ratingEngine.calculateVisiblePlayerCard(player, {
                userClubId: state ? state.userClubId : null,
                leagueDataCoverage: 85
            });
        }

        const estOvr = card ? card.visibleOvr : `${Math.max(50, player.overall - 2)} - ${Math.min(99, player.overall + 2)}`;
        const estPot = card ? card.visiblePot : `${Math.max(50, player.pot - 2)} - ${Math.min(99, player.pot + 3)}`;
        const conf = card ? card.confidence : player.scoutingKnowledge.knowledgeLevel;

        let recommendation = "Beobachten";
        if (player.pot >= 85 || player.overall >= 82) recommendation = "Top-Kaufempfehlung";
        else if (player.pot >= 80) recommendation = "Guter Transferkandidat";
        else if (player.overall <= 68 && player.pot <= 72) recommendation = "Keine Verpflichtung empfohlen";

        // Stärken & Schwächen
        const strengths = [];
        const weaknesses = [];
        if (player.pace >= 78) strengths.push("Hohes Grundtempo & Dynamik");
        if (player.shooting >= 75) strengths.push("Abschlussstärke im Sechzehner");
        if (player.passing >= 78) strengths.push("Präzises Pass- & Aufbauspiel");
        if (player.defense >= 75) strengths.push("Zweikampfstärke & Stellungsspiel");
        if (player.dribbling >= 78) strengths.push("Technisch versiertes 1-gegen-1");
        if (strengths.length === 0) strengths.push("Solide Grundfitness", "Teamorientierte Spielweise");

        if (player.pace <= 60) weaknesses.push("Geringes Antrittstempo");
        if (player.stamina <= 65) weaknesses.push("Konditionelle Schwächen über 90 Minuten");
        if (player.defense <= 50 && player.pos !== 'ST' && player.pos !== 'TW') weaknesses.push("Mäßiges Defensivverhalten");
        if (weaknesses.length === 0) weaknesses.push("Ausbaufähiges Kopfballspiel");

        const scoutNames = ["Karl Weber", "Markus Becker", "Sven Lindemann", "Christoph Baum", "Jürgen Schmidt"];
        const scoutName = options.scoutName || scoutNames[Math.abs(Number(player.id || 0)) % scoutNames.length];

        return {
            id: "rep_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            playerId: player.id,
            playerName: player.name,
            clubId: player.clubId,
            position: player.pos,
            age: player.age,
            scoutName: scoutName,
            source: options.source || "allgemein",
            confidence: conf,
            estimatedOverall: estOvr,
            estimatedPotential: estPot,
            starsCa: card ? card.starsCa : 3.0,
            starsPa: card ? card.starsPa : 3.5,
            starsCaHtml: card ? card.starsCaHtml : "★★★☆☆",
            starsPaHtml: card ? card.starsPaHtml : "★★★★☆",
            bestRole: card ? card.bestRole : { role: "Allrounder", stars: 3.0, starsHtml: "★★★☆☆" },
            alternativeRole: card ? card.alternativeRole : null,
            abilityLabel: card ? card.abilityLabel : "Ligaspieler",
            potentialLabel: card ? card.potentialLabel : "Entwicklungspotenzial",
            strengths: strengths,
            weaknesses: weaknesses,
            hiddenTraits: card ? card.hiddenTraits : [],
            actualOverall: player.overall,
            actualPotential: player.pot,
            marketValueFormatted: card ? card.visibleValueText : ((typeof Formatters !== 'undefined') ? Formatters.formatMoney(player.value, true) : `${player.value} €`),
            recommendation: recommendation,
            summary: `Spieler mit ${card ? card.abilityLabel : "guter Qualität"}. Empfohlene Hauptrolle: ${card?.bestRole?.role || "Stammspieler"}.`,
            date: state ? state.currentDate : `Saison ${player.season || 1}`
        };
    }
};

if (typeof window !== "undefined") {
    window.ScoutingEngine = ScoutingEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScoutingEngine };
}
