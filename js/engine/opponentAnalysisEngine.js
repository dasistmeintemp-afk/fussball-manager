/**
 * OpponentAnalysisEngine - Detaillierte taktische und statistische Gegneranalyse vor Spieltagen
 */

const _oaResolve = (globalName, path) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[globalName]; } catch (e) { return null; }
    }
    return null;
};

const OpponentAnalysisEngine = {
    /**
     * Wer die Analyse schreibt: der Spielanalyst aus dem Trainerstab. Ohne
     * eigenen Analysten behilft sich der Verein - mit spürbar schwächerem
     * Blick (Abzug für den offenen Posten im Trainerstab).
     */
    analyst(state, userClub) {
        const stab = _oaResolve("CoachingStaffEngine", "./coachingStaffEngine.js");
        const guete = stab && userClub ? stab.staffQuality(userClub).analyse : 60;
        const mitglied = userClub?.staff?.analyse;
        const sterne = Math.max(0.5, Math.min(5, Math.round((1 + ((Number(guete) || 50) - 25) / 18) * 2) / 2));
        return { name: mitglied?.name || "Videoanalyse", guete: guete ?? 60, sterne, eigen: !!mitglied };
    },

    /**
     * Erstellt einen detaillierten Scoutingbericht für den kommenden Gegner.
     *
     * Wie genau er ist, hängt am Spielanalysten: Ein schwacher liest die
     * Mannschaftsteile ungenauer (und benennt dann auch mal die falsche
     * Stärke), stellt weniger Schlüsselspieler vor und findet keine
     * Schwachstelle in der gegnerischen Elf.
     */
    generateReport(state, opponentClubId, userClubId) {
        if (!state) return null;
        const opponent = state.clubs.find(c => c.id === opponentClubId);
        const userClub = state.clubs.find(c => c.id === userClubId);
        if (!opponent) return null;
        const analyst = this.analyst(state, userClub);
        const schwaeche = Math.max(0, 100 - analyst.guete);
        const blick = (wert, teil) => {
            const text = `${opponent.id}|${analyst.name}|${teil}`;
            let hash = 2166136261;
            for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
            const zahl = (((hash >>> 0) % 2001) - 1000) / 1000;
            return Math.round(wert + zahl * schwaeche * 0.08);
        };

        const allPlayers = state.players.filter(p => opponent.playerIds.includes(p.id));
        const lineupPlayers = state.players.filter(p => opponent.lineup.includes(p.id));
        const availableLineup = lineupPlayers.length > 0 ? lineupPlayers : allPlayers.slice(0, 11);

        // Mannschaftsstärke & Bereichsratings berechnen
        const avgOverall = Math.round(allPlayers.reduce((s, p) => s + p.overall, 0) / (allPlayers.length || 1));
        
        const goalkeepers = availableLineup.filter(p => p.pos === "TW");
        const defenders = availableLineup.filter(p => ["IV", "LV", "RV"].includes(p.pos));
        const midfielders = availableLineup.filter(p => ["DM", "ZM", "OM", "LM", "RM"].includes(p.pos));
        const attackers = availableLineup.filter(p => ["ST", "LA", "RA"].includes(p.pos));

        const defenseRating = blick(defenders.length ? Math.round(defenders.reduce((s, p) => s + p.overall, 0) / defenders.length) : avgOverall, "abw");
        const midfieldRating = blick(midfielders.length ? Math.round(midfielders.reduce((s, p) => s + p.overall, 0) / midfielders.length) : avgOverall, "mf");
        const attackRating = blick(attackers.length ? Math.round(attackers.reduce((s, p) => s + p.overall, 0) / attackers.length) : avgOverall, "st");
        const gkRating = blick(goalkeepers.length ? goalkeepers[0].overall : avgOverall, "tw");

        // Top-Spieler ermitteln mit Scouting- & Sterne-Analyse
        const ratingEngine = (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) 
            ? PlayerRatingEngine 
            : ((typeof window !== 'undefined' && window.PlayerRatingEngine) ? window.PlayerRatingEngine : (typeof require !== 'undefined' ? require('./playerRatingEngine.js').PlayerRatingEngine : null));

        const userSquad = userClub ? state.players.filter(p => userClub.playerIds.includes(p.id)) : [];
        const userSquadAvgCa = userSquad.length 
            ? Math.round(userSquad.reduce((s, p) => s + (p.trueCurrentAbility || (p.overall * 2)), 0) / userSquad.length)
            : 140;

        const sortedPlayers = [...allPlayers].sort((a, b) => (b.trueCurrentAbility || b.overall * 2) - (a.trueCurrentAbility || a.overall * 2));
        const topScorer = [...allPlayers].sort((a, b) => (b.stats?.goals || 0) - (a.stats?.goals || 0))[0];
        const topAssister = [...allPlayers].sort((a, b) => (b.stats?.assists || 0) - (a.stats?.assists || 0))[0];

        // Ein guter Analyst stellt mehr Schlüsselspieler vor - und sieht sie
        // genauer (dieselbe Schätzung wie in den Scoutberichten)
        const scouting = _oaResolve("ScoutingEngine", "./scoutingEngine.js");
        const anzahlSchluessel = analyst.sterne >= 3.5 ? 4 : (analyst.sterne < 2 ? 2 : 3);
        const evaluatedKeyPlayers = sortedPlayers.slice(0, anzahlSchluessel).map(p => {
            let card = null;
            if (ratingEngine && typeof ratingEngine.calculateVisiblePlayerCard === 'function') {
                card = ratingEngine.calculateVisiblePlayerCard(p, {
                    userClubId: userClubId,
                    userSquadAvgAbility: userSquadAvgCa,
                    leagueDataCoverage: 85,
                    urteil: scouting && typeof scouting.urteilsFehler === "function" ? scouting.urteilsFehler(p, analyst) : null
                });
            }
            const starsCa = card ? card.starsCa : 3.0;
            const starsCaHtml = card ? card.starsCaHtml : "★★★☆☆";
            const starsPaHtml = card ? card.starsPaHtml : "★★★★☆";
            const abilityStarsHtml = card ? card.abilityStarsHtml : "";
            const abilityLabel = card ? card.abilityLabel : "Stammspieler";
            const bestRole = card ? card.bestRole : { role: "Allrounder", stars: 3.0, starsHtml: "★★★☆☆" };
            const confidence = card ? card.confidence : (p.scoutingKnowledge?.knowledgeLevel || 25);
            const danger = starsCa >= 4.0 ? "Hoch" : (starsCa >= 3.0 ? "Mittel" : "Gering");
            const dangerBadgeClass = starsCa >= 4.0 ? "badge-danger" : (starsCa >= 3.0 ? "badge-warning" : "badge-info");

            return {
                id: p.id,
                name: p.name,
                pos: p.pos,
                age: p.age,
                overall: p.overall,
                starsCa,
                starsCaHtml,
                starsPaHtml,
                abilityStarsHtml,
                abilityLabel,
                bestRole,
                confidence,
                danger,
                dangerBadgeClass,
                goals: p.stats?.goals || 0,
                assists: p.stats?.assists || 0
            };
        });

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

        // Die schwächste Stelle der voraussichtlichen Elf findet nur ein
        // Analyst, der genau hinschaut
        let schwachstelle = null;
        if (analyst.sterne >= 3 && availableLineup.length > 0) {
            const feld = availableLineup.filter(p => p.pos !== "TW");
            const kandidat = [...(feld.length ? feld : availableLineup)].sort((a, b) => a.overall - b.overall)[0];
            if (kandidat) {
                const langsam = (kandidat.pace || 70) < 62;
                const zweikampf = (kandidat.defense || 70) < 55 && ["IV", "LV", "RV", "DM"].includes(kandidat.pos);
                const grund = langsam ? "fehlt das Tempo - mit Läufen in die Tiefe anlaufen"
                    : zweikampf ? "wackelt im Zweikampf - dort das Dribbling suchen"
                    : "ist der schwächste Mann ihrer Elf - Angriffe über seine Seite lenken";
                schwachstelle = { id: kandidat.id, name: kandidat.name, pos: kandidat.pos, text: `${kandidat.name} (${kandidat.pos}) ${grund}.` };
            }
        }

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
            keyPlayers: evaluatedKeyPlayers,
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
            dangerClass: dangerClass,
            schwachstelle,
            analyst,
            genauigkeit: analyst.sterne >= 4 ? "Sehr genau" : analyst.sterne >= 3 ? "Genau" : analyst.sterne >= 2 ? "Grob" : "Nur ein Eindruck"
        };
    }
};

if (typeof window !== "undefined") {
    window.OpponentAnalysisEngine = OpponentAnalysisEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OpponentAnalysisEngine };
}
