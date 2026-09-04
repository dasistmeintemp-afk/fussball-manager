/**
 * OpponentAnalysisEngine - Detaillierte taktische und statistische Gegneranalyse vor Spieltagen
 */

const OpponentAnalysisEngine = {
    /**
     * Erstellt einen detaillierten Scoutingbericht für den kommenden Gegner
     */
    generateReport(state, opponentClubId, userClubId) {
        if (!state) return null;
        const opponent = state.clubs.find(c => c.id === opponentClubId);
        const userClub = state.clubs.find(c => c.id === userClubId);
        if (!opponent) return null;

        const allPlayers = state.players.filter(p => opponent.playerIds.includes(p.id));
        const lineupPlayers = state.players.filter(p => opponent.lineup.includes(p.id));
        const availableLineup = lineupPlayers.length > 0 ? lineupPlayers : allPlayers.slice(0, 11);

        // Mannschaftsstärke & Bereichsratings berechnen
        const avgOverall = Math.round(allPlayers.reduce((s, p) => s + p.overall, 0) / (allPlayers.length || 1));
        
        const goalkeepers = availableLineup.filter(p => p.pos === "TW");
        const defenders = availableLineup.filter(p => ["IV", "LV", "RV"].includes(p.pos));
        const midfielders = availableLineup.filter(p => ["DM", "ZM", "OM", "LM", "RM"].includes(p.pos));
        const attackers = availableLineup.filter(p => ["ST", "LA", "RA"].includes(p.pos));

        const defenseRating = defenders.length ? Math.round(defenders.reduce((s, p) => s + p.overall, 0) / defenders.length) : avgOverall;
        const midfieldRating = midfielders.length ? Math.round(midfielders.reduce((s, p) => s + p.overall, 0) / midfielders.length) : avgOverall;
        const attackRating = attackers.length ? Math.round(attackers.reduce((s, p) => s + p.overall, 0) / attackers.length) : avgOverall;
        const gkRating = goalkeepers.length ? goalkeepers[0].overall : avgOverall;

        // Top-Spieler ermitteln
        const sortedPlayers = [...allPlayers].sort((a, b) => b.overall - a.overall);
        const topScorer = [...allPlayers].sort((a, b) => (b.stats?.goals || 0) - (a.stats?.goals || 0))[0];
        const topAssister = [...allPlayers].sort((a, b) => (b.stats?.assists || 0) - (a.stats?.assists || 0))[0];

        // Formkurve
        const form = opponent.form || ["-", "-", "-", "-", "-"];
        const recentWins = form.filter(r => r === "W").length;
        const recentLosses = form.filter(r => r === "L").length;

        // Tabellenrang
        let rank = 1;
        if (Array.isArray(state.standings)) {
            const foundIdx = state.standings.findIndex(s => s.clubId === opponent.id);
            if (foundIdx !== -1) rank = foundIdx + 1;
        }

        // Stärken und Schwächen identifizieren
        const strengths = [];
        const weaknesses = [];

        if (attackRating >= 80) {
            strengths.push("Hocheffektive Offensive mit hoher Trefferquote");
        } else if (attackRating <= 72) {
            weaknesses.push("Harmloser Sturm mit mangelnder Durchschlagskraft");
        }

        if (defenseRating >= 80) {
            strengths.push("Kompakter Abwehrriegel mit starkem Stellungsspiel");
        } else if (defenseRating <= 72) {
            weaknesses.push("Lückenhafte Verteidigung bei schnellen Umschaltmomenten");
        }

        if (midfieldRating >= 80) {
            strengths.push("Dominantes Mittelfeld mit hoher Ballsicherheit");
        } else if (midfieldRating <= 72) {
            weaknesses.push("Pressinganfälliges Zentrum mit vielen Ballverlusten");
        }

        if (recentWins >= 3) {
            strengths.push("Starkes Selbstvertrauen nach jüngster Siegesserie");
        } else if (recentLosses >= 3) {
            weaknesses.push("Verunsicherte Mannschaft nach Formtief");
        }

        if (strengths.length === 0) strengths.push("Ausgeglichene Mannschaft ohne gravierende Spitzen");
        if (weaknesses.length === 0) weaknesses.push("Solide Grundordnung über alle Mannschaftsteile");

        // Taktische Tendenz
        let tacticalTrend = "Ausgeglichenes Spiel mit kontrolliertem Aufbau";
        if (attackRating > defenseRating + 4) {
            tacticalTrend = "Offensivdrang über die Außenbahnen mit frühem Pressing";
        } else if (defenseRating > attackRating + 4) {
            tacticalTrend = "Tiefstehende Verteidigung mit Fokus auf schnelle Konter";
        }

        // Taktik-Empfehlung für den Spieler
        let recommendation = "Ausgewogene Spielweise: Das Zentrum verdichten und Standards nutzen.";
        if (defenseRating <= 74) {
            recommendation = "Offensive Mentalität: Früh attackieren und Schüsse aus allen Lagen suchen.";
        } else if (attackRating >= 82) {
            recommendation = "Defensive Stabilität: Tief stehen, Räume eng machen und auf Konter lauern.";
        } else if (midfieldRating <= 73) {
            recommendation = "Hohes Pressing: Den Gegner früh im Spielaufbau zu Fehlern zwingen.";
        }

        // Risikoeinschätzung (Gefahr)
        const userAvg = userClub 
            ? Math.round(state.players.filter(p => userClub.playerIds.includes(p.id)).reduce((s, p) => s + p.overall, 0) / (userClub.playerIds.length || 1))
            : 75;

        let dangerLevel = "Ausgeglichen";
        let dangerClass = "badge-neutral";
        if (avgOverall >= userAvg + 4) {
            dangerLevel = "Sehr Schwer (Außenseiter)";
            dangerClass = "badge-danger";
        } else if (avgOverall > userAvg + 1) {
            dangerLevel = "Schwer";
            dangerClass = "badge-warning";
        } else if (avgOverall < userAvg - 4) {
            dangerLevel = "Leicht (Favorit)";
            dangerClass = "badge-success";
        } else if (avgOverall < userAvg - 1) {
            dangerLevel = "Machbar";
            dangerClass = "badge-info";
        }

        return {
            opponentClubId: opponent.id,
            opponentName: opponent.name,
            stadium: opponent.stadium,
            city: opponent.city,
            primaryColor: opponent.primaryColor,
            rank: rank,
            form: form,
            avgOverall: avgOverall,
            attackRating: attackRating,
            midfieldRating: midfieldRating,
            defenseRating: defenseRating,
            gkRating: gkRating,
            likelyFormation: opponent.formation || "4-4-2",
            tacticalTrend: tacticalTrend,
            keyPlayers: sortedPlayers.slice(0, 3).map(p => ({
                id: p.id,
                name: p.name,
                pos: p.pos,
                overall: p.overall,
                goals: p.stats?.goals || 0,
                assists: p.stats?.assists || 0
            })),
            topScorer: topScorer && (topScorer.stats?.goals || 0) > 0 ? {
                name: topScorer.name,
                goals: topScorer.stats.goals
            } : null,
            topAssister: topAssister && (topAssister.stats?.assists || 0) > 0 ? {
                name: topAssister.name,
                assists: topAssister.stats.assists
            } : null,
            strengths: strengths,
            weaknesses: weaknesses,
            recommendation: recommendation,
            dangerLevel: dangerLevel,
            dangerClass: dangerClass
        };
    }
};

if (typeof window !== "undefined") {
    window.OpponentAnalysisEngine = OpponentAnalysisEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OpponentAnalysisEngine };
}
