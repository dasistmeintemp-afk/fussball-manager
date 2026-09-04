/**
 * MatchEngine - Detaillierte Spielberechnung & synchrone 2D-Timeline-Match-Engine
 */

class MatchEngine {
    /**
     * Berechnet die effektive Stärke eines Teams für das Spiel
     */
    static calculateTeamPower(club, allPlayers, isHome = false) {
        const lineupPlayers = (club.lineup || [])
            .map(id => allPlayers.find(p => p.id === id))
            .filter(Boolean);

        if (lineupPlayers.length === 0) {
            return { attack: 50, midfield: 50, defense: 50, goalkeeper: 50, total: 50 };
        }

        let attackSum = 0, attackCount = 0;
        let midSum = 0, midCount = 0;
        let defSum = 0, defCount = 0;
        let gkPower = 70;

        lineupPlayers.forEach(p => {
            const fitnessFactor = 0.6 + ((p.fitness || 100) / 100) * 0.4;
            const moraleFactor = 0.85 + ((p.morale || 75) / 100) * 0.2;
            const formFactor = 0.85 + ((p.form || 7.0) / 10) * 0.2;
            const effectiveSkill = (p.overall || 70) * fitnessFactor * moraleFactor * formFactor;

            if (p.pos === "TW") {
                gkPower = effectiveSkill * 1.05;
            } else if (["IV", "LV", "RV"].includes(p.pos)) {
                defSum += effectiveSkill;
                defCount++;
            } else if (["DM", "ZM", "LM", "RM", "OM"].includes(p.pos)) {
                midSum += effectiveSkill;
                midCount++;
            } else { // ST, LA, RA
                attackSum += effectiveSkill;
                attackCount++;
            }
        });

        let attack = attackCount > 0 ? attackSum / attackCount : 65;
        let midfield = midCount > 0 ? midSum / midCount : 65;
        let defense = defCount > 0 ? defSum / defCount : 65;

        // Taktische Modifikatoren
        const tactics = club.tactics || {};
        switch (tactics.mentality) {
            case "very_offensive": attack *= 1.18; defense *= 0.86; break;
            case "offensive": attack *= 1.09; defense *= 0.94; break;
            case "defensive": attack *= 0.92; defense *= 1.09; break;
            case "very_defensive": attack *= 0.82; defense *= 1.18; break;
        }

        if (tactics.pressing === "high") {
            midfield *= 1.05;
            defense *= 1.03;
        } else if (tactics.pressing === "low") {
            defense *= 1.04;
            midfield *= 0.96;
        }

        // Heimvorteil
        if (isHome) {
            attack *= 1.06;
            midfield *= 1.05;
            defense *= 1.05;
        }

        const total = (attack * 0.35 + midfield * 0.35 + defense * 0.2 + gkPower * 0.1);

        return { attack, midfield, defense, goalkeeper: gkPower, total };
    }

    /**
     * Generiert eine vollständige, deterministische Timeline von Spielszenen (Pässe, Schüsse, Paraden, Tore, Karten)
     * Diese Timeline wird 1:1 sowohl für die Sofortberechnung als auch für das 2D-LiveMatch verwendet.
     */
    static generateTimeline(match, homeClub, awayClub, allPlayers) {
        const homePower = this.calculateTeamPower(homeClub, allPlayers, true);
        const awayPower = this.calculateTeamPower(awayClub, allPlayers, false);

        const homeLineup = (homeClub.lineup || []).map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
        const awayLineup = (awayClub.lineup || []).map(id => allPlayers.find(p => p.id === id)).filter(Boolean);

        const timeline = [];

        // Berechne Anzahl der Match-Phasen / Großchancen
        const powerDiff = homePower.total - awayPower.total;
        const baseChancesHome = Math.max(2, Math.round(5 + (powerDiff / 7) + (Math.random() * 4 - 2)));
        const baseChancesAway = Math.max(1, Math.round(4 - (powerDiff / 7) + (Math.random() * 4 - 2)));
        const totalScenes = baseChancesHome + baseChancesAway + 6; // ca. 14-22 Szenen

        // Verteile Spielminuten gleichmäßig über 90 Minuten
        const minutes = [];
        for (let i = 0; i < totalScenes; i++) {
            const min = Math.min(90, Math.max(2, Math.floor(((i + 0.5) / totalScenes) * 90 + (Math.random() * 4 - 2))));
            if (!minutes.includes(min)) minutes.push(min);
        }
        minutes.sort((a, b) => a - b);

        minutes.forEach(min => {
            const homeAdvantageProb = homePower.midfield / (homePower.midfield + awayPower.midfield);
            const isHome = Math.random() < homeAdvantageProb;
            const attClub = isHome ? homeClub : awayClub;
            const defClub = isHome ? awayClub : homeClub;
            const attLineup = isHome ? homeLineup : awayLineup;
            const defLineup = isHome ? awayLineup : homeLineup;
            const attPower = isHome ? homePower : awayPower;
            const defPower = isHome ? awayPower : homePower;

            const attackers = attLineup.filter(p => ["ST", "LA", "RA", "OM"].includes(p.pos));
            const midfielders = attLineup.filter(p => ["ZM", "DM", "LM", "RM"].includes(p.pos));
            const defenders = defLineup.filter(p => ["IV", "LV", "RV", "DM"].includes(p.pos));
            const gk = defLineup.find(p => p.pos === "TW") || defLineup[0];

            const shooter = attackers.length > 0 ? attackers[Math.floor(Math.random() * attackers.length)] : (midfielders[0] || attLineup[0]);
            const passer = midfielders.length > 0 ? midfielders[Math.floor(Math.random() * midfielders.length)] : attLineup[1] || attLineup[0];
            const defender = defenders.length > 0 ? defenders[Math.floor(Math.random() * defenders.length)] : defLineup[0];

            const roll = Math.random();

            if (roll < 0.55) {
                // Torschuss-Szene mit Spielzug
                const startX = isHome ? 30 + Math.random() * 20 : 70 - Math.random() * 20;
                const startY = 20 + Math.random() * 60;
                const midX = isHome ? 65 + Math.random() * 15 : 35 - Math.random() * 15;
                const midY = 25 + Math.random() * 50;
                const goalX = isHome ? 96 : 4;
                const goalY = 45 + Math.random() * 10;

                // 1. Pass / Spielzug
                timeline.push({
                    minute: min,
                    second: 10,
                    type: "pass",
                    team: isHome ? "home" : "away",
                    clubId: attClub.id,
                    clubName: attClub.name,
                    fromPlayerId: passer?.id,
                    fromPlayerName: passer?.name,
                    toPlayerId: shooter?.id,
                    toPlayerName: shooter?.name,
                    start: { x: startX, y: startY },
                    end: { x: midX, y: midY },
                    success: true,
                    text: `${min}' - ${passer?.name || "Mittelfeldspieler"} treibt den Ball voran und bedient ${shooter?.name || "den Stürmer"}.`
                });

                // 2. Torschuss & Auswertung
                const finishQuality = (shooter ? (shooter.overall || 70) * 1.1 : 70) + (Math.random() * 30);
                const defenseQuality = (gk ? (gk.overall || 70) * 1.0 : 65) + ((defPower.defense || 60) * 0.3) + (Math.random() * 28);
                const xG = parseFloat((0.08 + Math.random() * 0.35 + (finishQuality > defenseQuality ? 0.2 : 0)).toFixed(2));

                if (finishQuality > defenseQuality + 8) {
                    // Tor!
                    timeline.push({
                        minute: min,
                        second: 25,
                        type: "goal",
                        team: isHome ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        playerId: shooter?.id,
                        playerName: shooter?.name,
                        assistId: passer?.id,
                        assistName: passer?.name,
                        start: { x: midX, y: midY },
                        end: { x: goalX, y: goalY },
                        xG: xG,
                        outcome: "goal",
                        text: `${min}' - ⚽ TOOOOR für ${attClub.name}! ${shooter?.name || "Angreifer"} trifft nach Vorlage von ${passer?.name || "Mitspieler"}!`
                    });
                } else if (finishQuality > defenseQuality - 10) {
                    // Torwartparade
                    timeline.push({
                        minute: min,
                        second: 25,
                        type: "save",
                        team: isHome ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        shooterId: shooter?.id,
                        shooterName: shooter?.name,
                        gkId: gk?.id,
                        gkName: gk?.name,
                        start: { x: midX, y: midY },
                        end: { x: goalX, y: goalY },
                        xG: xG,
                        outcome: "saved",
                        text: `${min}' - 🧤 Glanzparade! ${gk?.name || "Torwart"} rettet spektakulär gegen den Abschluss von ${shooter?.name || "Stürmer"}.`
                    });
                } else {
                    // Schuss verfehlt
                    timeline.push({
                        minute: min,
                        second: 25,
                        type: "shot_miss",
                        team: isHome ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        playerId: shooter?.id,
                        playerName: shooter?.name,
                        start: { x: midX, y: midY },
                        end: { x: goalX, y: goalY + (Math.random() > 0.5 ? 18 : -18) },
                        xG: xG,
                        outcome: "missed",
                        text: `${min}' - Schusschance für ${attClub.name}: ${shooter?.name || "Angreifer"} setzt den Ball knapp am Pfosten vorbei.`
                    });
                }
            } else if (roll < 0.78) {
                // Zweikampf / Foul / Karte
                const fPos = { x: 30 + Math.random() * 40, y: 15 + Math.random() * 70 };
                const isCard = Math.random() < 0.28;
                const isRed = isCard && Math.random() < 0.08;

                if (isRed) {
                    timeline.push({
                        minute: min,
                        second: 35,
                        type: "red_card",
                        team: isHome ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        playerId: defender?.id,
                        playerName: defender?.name,
                        start: fPos,
                        end: fPos,
                        outcome: "red_card",
                        text: `${min}' - 🟥 ROTE KARTE für ${defender?.name || "Abwehrspieler"} (${defClub.name}) nach einer Notbremse!`
                    });
                } else if (isCard) {
                    timeline.push({
                        minute: min,
                        second: 35,
                        type: "yellow_card",
                        team: isHome ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        playerId: defender?.id,
                        playerName: defender?.name,
                        start: fPos,
                        end: fPos,
                        outcome: "yellow_card",
                        text: `${min}' - 🟨 Gelbe Karte für ${defender?.name || "Verteidiger"} (${defClub.name}) nach Foulspiel an ${shooter?.name || "Gegner"}.`
                    });
                } else {
                    timeline.push({
                        minute: min,
                        second: 35,
                        type: "foul",
                        team: isHome ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        playerId: defender?.id,
                        playerName: defender?.name,
                        start: fPos,
                        end: fPos,
                        outcome: "foul",
                        text: `${min}' - Foulspiel von ${defender?.name || "Verteidiger"} (${defClub.name}). Freistoß für ${attClub.name}.`
                    });
                }
            } else {
                // Eckball
                const cPos = { x: isHome ? 98 : 2, y: Math.random() > 0.5 ? 5 : 95 };
                timeline.push({
                    minute: min,
                    second: 40,
                    type: "corner",
                    team: isHome ? "home" : "away",
                    clubId: attClub.id,
                    clubName: attClub.name,
                    playerId: passer?.id,
                    playerName: passer?.name,
                    start: cPos,
                    end: { x: isHome ? 90 : 10, y: 50 },
                    outcome: "corner",
                    text: `${min}' - 🚩 Eckball für ${attClub.name}. Gefährliche Hereingabe ins Zentrum!`
                });
            }
        });

        timeline.sort((a, b) => a.minute !== b.minute ? a.minute - b.minute : a.second - b.second);
        return timeline;
    }

    /**
     * Wendet eine Timeline deterministisch auf das Match-Objekt an
     */
    static applyTimelineToMatch(match, timeline, homeClub, awayClub, allPlayers) {
        let homeGoals = 0;
        let awayGoals = 0;
        let homeShots = 0;
        let awayShots = 0;
        let homeShotsOnTarget = 0;
        let awayShotsOnTarget = 0;
        let homeCorners = 0;
        let awayCorners = 0;
        let homeFouls = 0;
        let awayFouls = 0;
        let homeYellowCards = 0;
        let awayYellowCards = 0;
        let homeRedCards = 0;
        let awayRedCards = 0;
        let homeXg = 0.0;
        let awayXg = 0.0;

        const events = [];

        timeline.forEach(event => {
            if (event.type === "goal") {
                if (event.team === "home") homeGoals++; else awayGoals++;
                if (event.team === "home") homeShotsOnTarget++; else awayShotsOnTarget++;
                if (event.team === "home") homeShots++; else awayShots++;
                if (event.team === "home") homeXg += (event.xG || 0.3); else awayXg += (event.xG || 0.3);

                const player = allPlayers.find(p => p.id === event.playerId);
                if (player) {
                    player.stats.goals = (player.stats.goals || 0) + 1;
                    player.stats.ratingSum = (player.stats.ratingSum || 0) + 1.2;
                }
                const assistPlayer = allPlayers.find(p => p.id === event.assistId);
                if (assistPlayer) {
                    assistPlayer.stats.assists = (assistPlayer.stats.assists || 0) + 1;
                    assistPlayer.stats.ratingSum = (assistPlayer.stats.ratingSum || 0) + 0.6;
                }

                events.push({
                    minute: event.minute,
                    type: "goal",
                    clubId: event.clubId,
                    text: event.text,
                    playerId: event.playerId,
                    playerName: event.playerName,
                    assistId: event.assistId,
                    assistName: event.assistName
                });
            } else if (event.type === "save") {
                if (event.team === "away") homeShotsOnTarget++; else awayShotsOnTarget++;
                if (event.team === "away") homeShots++; else awayShots++;
                if (event.team === "away") homeXg += (event.xG || 0.15); else awayXg += (event.xG || 0.15);

                const gk = allPlayers.find(p => p.id === event.gkId);
                if (gk) gk.stats.ratingSum = (gk.stats.ratingSum || 0) + 0.3;

                events.push({
                    minute: event.minute,
                    type: "save",
                    clubId: event.clubId,
                    text: event.text
                });
            } else if (event.type === "shot_miss") {
                if (event.team === "home") homeShots++; else awayShots++;
                if (event.team === "home") homeXg += (event.xG || 0.1); else awayXg += (event.xG || 0.1);
            } else if (event.type === "corner") {
                if (event.team === "home") homeCorners++; else awayCorners++;
            } else if (event.type === "foul") {
                if (event.team === "home") homeFouls++; else awayFouls++;
            } else if (event.type === "yellow_card") {
                if (event.team === "home") { homeFouls++; homeYellowCards++; } else { awayFouls++; awayYellowCards++; }
                const player = allPlayers.find(p => p.id === event.playerId);
                if (player) {
                    player.stats.yellowCards = (player.stats.yellowCards || 0) + 1;
                    player.yellowCardsTotal = (player.yellowCardsTotal || 0) + 1;
                }
                events.push({
                    minute: event.minute,
                    type: "yellow_card",
                    clubId: event.clubId,
                    text: event.text,
                    playerId: event.playerId,
                    playerName: event.playerName
                });
            } else if (event.type === "red_card") {
                if (event.team === "home") { homeFouls++; homeRedCards++; } else { awayFouls++; awayRedCards++; }
                const player = allPlayers.find(p => p.id === event.playerId);
                if (player) {
                    player.stats.redCards = (player.stats.redCards || 0) + 1;
                    player.suspendedMatches = 2;
                }
                events.push({
                    minute: event.minute,
                    type: "red_card",
                    clubId: event.clubId,
                    text: event.text,
                    playerId: event.playerId,
                    playerName: event.playerName
                });
            }
        });

        const homeLineup = (homeClub.lineup || []).map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
        const awayLineup = (awayClub.lineup || []).map(id => allPlayers.find(p => p.id === id)).filter(Boolean);

        // Spieler-Updates
        homeLineup.forEach(p => {
            p.stats.matches = (p.stats.matches || 0) + 1;
            p.stats.minutes = (p.stats.minutes || 0) + 90;
            p.fitness = Math.max(50, (p.fitness || 100) - (10 + Math.floor(Math.random() * 8)));
            const matchRating = Math.min(10, Math.max(4.0, (6.0 + (homeGoals - awayGoals) * 0.4 + (Math.random() * 1.5 - 0.75))));
            p.stats.ratingSum = (p.stats.ratingSum || 0) + matchRating;
            p.form = parseFloat((((p.form || 7.0) * 0.7) + (matchRating * 0.3)).toFixed(1));
            if (awayGoals === 0 && p.pos === "TW") p.stats.cleanSheets = (p.stats.cleanSheets || 0) + 1;
        });

        awayLineup.forEach(p => {
            p.stats.matches = (p.stats.matches || 0) + 1;
            p.stats.minutes = (p.stats.minutes || 0) + 90;
            p.fitness = Math.max(50, (p.fitness || 100) - (10 + Math.floor(Math.random() * 8)));
            const matchRating = Math.min(10, Math.max(4.0, (6.0 + (awayGoals - homeGoals) * 0.4 + (Math.random() * 1.5 - 0.75))));
            p.stats.ratingSum = (p.stats.ratingSum || 0) + matchRating;
            p.form = parseFloat((((p.form || 7.0) * 0.7) + (matchRating * 0.3)).toFixed(1));
            if (homeGoals === 0 && p.pos === "TW") p.stats.cleanSheets = (p.stats.cleanSheets || 0) + 1;
        });

        // Formkurven
        if (Array.isArray(homeClub.form)) {
            homeClub.form.shift();
            homeClub.form.push(homeGoals > awayGoals ? "W" : homeGoals === awayGoals ? "D" : "L");
        }
        if (Array.isArray(awayClub.form)) {
            awayClub.form.shift();
            awayClub.form.push(awayGoals > homeGoals ? "W" : homeGoals === awayGoals ? "D" : "L");
        }

        // Man of the Match
        const allPlayed = [...homeLineup, ...awayLineup];
        allPlayed.sort((a, b) => ((b.stats?.goals || 0) * 3 + (b.stats?.assists || 0) * 2 + (b.overall || 70)) - ((a.stats?.goals || 0) * 3 + (a.stats?.assists || 0) * 2 + (a.overall || 70)));
        const motm = allPlayed[0] ? allPlayed[0].name : "Ausgeglichen";

        const homePossession = Math.min(75, Math.max(25, 50 + (homeGoals - awayGoals) * 3 + Math.floor(Math.random() * 8 - 4)));

        // Taktische Zusammenfassung
        let summaryText = "";
        if (homeGoals > awayGoals) {
            summaryText = `${homeClub.name} setzte sich mit ${homeGoals}:${awayGoals} gegen ${awayClub.name} durch. Mit ${homePossession}% Ballbesitz und ${homeXg.toFixed(2)} xG kontrollierten die Hausherren das Spiel. Spieler des Spiels: ${motm}.`;
        } else if (awayGoals > homeGoals) {
            summaryText = `${awayClub.name} feierte einen ${awayGoals}:${homeGoals}-Auswärtssieg bei ${homeClub.name}. Durch hohe Effizienz vor dem Tor und ${awayXg.toFixed(2)} xG entführten die Gäste verdient alle drei Punkte.`;
        } else {
            summaryText = `In einem intensiven Duell trennten sich ${homeClub.name} und ${awayClub.name} ${homeGoals}:${awayGoals} unentschieden (${homeXg.toFixed(2)} : ${awayXg.toFixed(2)} xG).`;
        }

        match.played = true;
        match.homeGoals = homeGoals;
        match.awayGoals = awayGoals;
        match.events = events;
        match.timeline = timeline;
        match.summaryText = summaryText;
        match.stats = {
            possession: [homePossession, 100 - homePossession],
            shots: [Math.max(homeGoals, homeShots), Math.max(awayGoals, awayShots)],
            shotsOnTarget: [Math.max(homeGoals, homeShotsOnTarget), Math.max(awayGoals, awayShotsOnTarget)],
            corners: [homeCorners || 3, awayCorners || 2],
            fouls: [homeFouls || 8, awayFouls || 9],
            yellowCards: [homeYellowCards, awayYellowCards],
            redCards: [homeRedCards, awayRedCards],
            passAccuracy: [83, 81],
            tacklesWon: [65, 62],
            saves: [awayShotsOnTarget, homeShotsOnTarget],
            motm: motm,
            xG: [parseFloat(homeXg.toFixed(2)), parseFloat(awayXg.toFixed(2))]
        };

        return match;
    }

    /**
     * Schnelle Hintergrund-Simulation für Matches (nutzt dieselbe Timeline)
     */
    static simulateFullMatch(match, homeClub, awayClub, allPlayers) {
        const timeline = match.timeline && match.timeline.length > 0 
            ? match.timeline 
            : this.generateTimeline(match, homeClub, awayClub, allPlayers);

        return this.applyTimelineToMatch(match, timeline, homeClub, awayClub, allPlayers);
    }

    /**
     * Erstellt eine interaktive LiveMatch-Instanz für die 2D-Live-Simulation
     */
    static createLiveMatch(match, homeClub, awayClub, allPlayers) {
        return new LiveMatch(match, homeClub, awayClub, allPlayers);
    }
}

/**
 * Klasse zur Durchführung der Live 2D Match Simulation (spielt Timeline synchron ab)
 */
class LiveMatch {
    constructor(match, homeClub, awayClub, allPlayers) {
        this.match = match;
        this.homeClub = homeClub;
        this.awayClub = awayClub;
        this.allPlayers = allPlayers;

        this.homeLineup = (homeClub.lineup || []).map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
        this.awayLineup = (awayClub.lineup || []).map(id => allPlayers.find(p => p.id === id)).filter(Boolean);

        // Timeline generieren falls noch nicht vorhanden
        if (!match.timeline || match.timeline.length === 0) {
            match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, allPlayers);
        }
        this.timeline = match.timeline;
        this.timelineIndex = 0;

        this.minute = 0;
        this.seconds = 0;
        this.extraTime = 0;
        this.homeScore = 0;
        this.awayScore = 0;
        this.isFinished = false;
        this.isPaused = false;
        this.speed = 1;

        // Live Stats
        this.stats = {
            possession: [50, 50],
            possessionTicks: [0, 0],
            shots: [0, 0],
            shotsOnTarget: [0, 0],
            corners: [0, 0],
            fouls: [0, 0],
            yellowCards: [0, 0],
            redCards: [0, 0],
            passAccuracy: [82, 80],
            xG: [0.0, 0.0]
        };

        this.events = [];
        this.substitutionsUsed = { home: 0, away: 0 };
        this.maxSubstitutions = 5;

        // 2D Match Visualizer Zustand
        this.ball = { x: 50, y: 50, targetX: 50, targetY: 50, speed: 0.1, holderId: null };
        this.players2D = this.initialize2DPositions();
        this.currentPhase = "kickoff";
        this.lastCommentary = "Das Spiel wird angepfiffen!";
    }

    initialize2DPositions() {
        const formConfigs = (typeof FORMATION_CONFIGS !== 'undefined' && FORMATION_CONFIGS) 
            ? FORMATION_CONFIGS 
            : ((typeof window !== 'undefined' && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS : (typeof require !== 'undefined' ? require('./gameState.js').FORMATION_CONFIGS : {}));
        const homePositions = (formConfigs && formConfigs[this.homeClub.formation]) ? formConfigs[this.homeClub.formation].positions : (formConfigs && formConfigs["4-4-2"] ? formConfigs["4-4-2"].positions : []);
        const awayPositions = (formConfigs && formConfigs[this.awayClub.formation]) ? formConfigs[this.awayClub.formation].positions : (formConfigs && formConfigs["4-4-2"] ? formConfigs["4-4-2"].positions : []);

        const players = [];

        // Heimspieler (spielt links -> rechts)
        this.homeLineup.forEach((p, idx) => {
            const slot = homePositions[idx] || { x: 50, y: 50 };
            const fieldX = slot.y * 0.45;
            const fieldY = slot.x;
            players.push({
                id: p.id,
                name: p.name,
                number: idx + 1,
                pos: p.pos,
                team: "home",
                baseX: fieldX,
                baseY: fieldY,
                x: fieldX,
                y: fieldY,
                targetX: fieldX,
                targetY: fieldY,
                color: this.homeClub.primaryColor || "#dc2626",
                textColor: this.homeClub.secondaryColor || "#ffffff",
                rating: 6.0
            });
        });

        // Auswärtsspieler (spielt rechts -> links)
        this.awayLineup.forEach((p, idx) => {
            const slot = awayPositions[idx] || { x: 50, y: 50 };
            const fieldX = 100 - (slot.y * 0.45);
            const fieldY = slot.x;
            players.push({
                id: p.id,
                name: p.name,
                number: idx + 1,
                pos: p.pos,
                team: "away",
                baseX: fieldX,
                baseY: fieldY,
                x: fieldX,
                y: fieldY,
                targetX: fieldX,
                targetY: fieldY,
                color: this.awayClub.primaryColor || "#2563eb",
                textColor: this.awayClub.secondaryColor || "#ffffff",
                rating: 6.0
            });
        });

        return players;
    }

    /**
     * Simulationsschritt
     */
    tick() {
        if (this.isFinished || this.isPaused) return;

        this.seconds += 3 * this.speed;
        if (this.seconds >= 60) {
            this.minute += Math.floor(this.seconds / 60);
            this.seconds = this.seconds % 60;
        }

        // Timeline-Events für aktuelle Minute/Sekunde abspielen
        while (this.timelineIndex < this.timeline.length && this.timeline[this.timelineIndex].minute <= this.minute) {
            const ev = this.timeline[this.timelineIndex];
            this.playTimelineEvent(ev);
            this.timelineIndex++;
        }

        this.updateBallAndPlayers();

        if (this.minute >= 90 + this.extraTime) {
            this.finishMatch();
        }
    }

    /**
     * Führt ein konkretes Timeline-Event im 2D-Feld aus
     */
    playTimelineEvent(event) {
        this.lastCommentary = event.text;

        if (event.start && event.end) {
            this.ball.x = event.start.x;
            this.ball.y = event.start.y;
            this.ball.targetX = event.end.x;
            this.ball.targetY = event.end.y;
        }

        const teamIndex = event.team === "home" ? 0 : 1;

        if (event.type === "goal") {
            if (event.team === "home") this.homeScore++; else this.awayScore++;
            this.stats.shots[teamIndex]++;
            this.stats.shotsOnTarget[teamIndex]++;
            this.stats.xG[teamIndex] = parseFloat((this.stats.xG[teamIndex] + (event.xG || 0.3)).toFixed(2));
            this.addEvent("goal", event.clubId, event.text, { id: event.playerId, name: event.playerName }, { id: event.assistId, name: event.assistName });
        } else if (event.type === "save") {
            const attIndex = event.team === "home" ? 1 : 0;
            this.stats.shots[attIndex]++;
            this.stats.shotsOnTarget[attIndex]++;
            this.stats.xG[attIndex] = parseFloat((this.stats.xG[attIndex] + (event.xG || 0.15)).toFixed(2));
            this.addEvent("save", event.clubId, event.text);
        } else if (event.type === "shot_miss") {
            this.stats.shots[teamIndex]++;
            this.stats.xG[teamIndex] = parseFloat((this.stats.xG[teamIndex] + (event.xG || 0.1)).toFixed(2));
        } else if (event.type === "corner") {
            this.stats.corners[teamIndex]++;
            this.addEvent("corner", event.clubId, event.text);
        } else if (event.type === "yellow_card") {
            this.stats.fouls[teamIndex]++;
            this.stats.yellowCards[teamIndex]++;
            this.addEvent("yellow_card", event.clubId, event.text, { id: event.playerId, name: event.playerName });
        } else if (event.type === "red_card") {
            this.stats.fouls[teamIndex]++;
            this.stats.redCards[teamIndex]++;
            this.addEvent("red_card", event.clubId, event.text, { id: event.playerId, name: event.playerName });
        } else if (event.type === "foul") {
            this.stats.fouls[teamIndex]++;
        }

        // Spielerbewegung in Richtung Event-Zone
        this.players2D.forEach(p => {
            if (p.id === event.playerId || p.id === event.fromPlayerId) {
                p.targetX = event.start.x;
                p.targetY = event.start.y;
            } else if (p.id === event.toPlayerId) {
                p.targetX = event.end.x;
                p.targetY = event.end.y;
            }
        });
    }

    addEvent(type, clubId, text, mainPlayer = null, assistPlayer = null) {
        this.events.push({
            minute: this.minute,
            type,
            clubId,
            text,
            playerId: mainPlayer?.id,
            playerName: mainPlayer?.name,
            assistId: assistPlayer?.id,
            assistName: assistPlayer?.name
        });
    }

    updateBallAndPlayers() {
        const ballSpeed = 0.12 * this.speed;
        this.ball.x += (this.ball.targetX - this.ball.x) * ballSpeed;
        this.ball.y += (this.ball.targetY - this.ball.y) * ballSpeed;

        if (Math.abs(this.ball.targetX - this.ball.x) < 2 && Math.abs(this.ball.targetY - this.ball.y) < 2) {
            this.ball.targetX = 20 + Math.random() * 60;
            this.ball.targetY = 20 + Math.random() * 60;
        }

        this.players2D.forEach(p => {
            const driftX = (Math.random() - 0.5) * 3;
            const driftY = (Math.random() - 0.5) * 3;
            p.targetX = Math.max(5, Math.min(95, p.baseX + (this.ball.x - 50) * 0.2 + driftX));
            p.targetY = Math.max(8, Math.min(92, p.baseY + (this.ball.y - 50) * 0.15 + driftY));

            p.x += (p.targetX - p.x) * 0.06 * this.speed;
            p.y += (p.targetY - p.y) * 0.06 * this.speed;
        });
    }

    substitute(teamType, playerOutId, playerInId) {
        const club = teamType === "home" ? this.homeClub : this.awayClub;
        const lineup = teamType === "home" ? this.homeLineup : this.awayLineup;

        if (this.substitutionsUsed[teamType] >= this.maxSubstitutions) {
            return { success: false, message: "Maximales Auswechselkontingent (5) bereits erschöpft!" };
        }

        const outIndex = (club.lineup || []).indexOf(playerOutId);
        const inBenchIndex = (club.bench || []).indexOf(playerInId);

        if (outIndex === -1 || inBenchIndex === -1) {
            return { success: false, message: "Spieler nicht in Startelf oder Bank gefunden." };
        }

        const playerOut = this.allPlayers.find(p => p.id === playerOutId);
        const playerIn = this.allPlayers.find(p => p.id === playerInId);

        club.lineup[outIndex] = playerInId;
        club.bench.splice(inBenchIndex, 1);
        club.bench.push(playerOutId);

        lineup[outIndex] = playerIn;

        const p2d = this.players2D.find(p => p.id === playerOutId);
        if (p2d && playerIn) {
            p2d.id = playerIn.id;
            p2d.name = playerIn.name;
            p2d.pos = playerIn.pos;
        }

        this.substitutionsUsed[teamType]++;
        const eventText = `${this.minute}' - 🔄 Auswechslung ${club.name}: ${playerIn?.name} kommt für ${playerOut?.name}.`;
        this.addEvent("sub", club.id, eventText);
        this.lastCommentary = eventText;

        return { success: true, message: `Auswechslung erfolgreich: ${playerIn?.name} für ${playerOut?.name}` };
    }

    updateTactics(teamType, newTactics) {
        const club = teamType === "home" ? this.homeClub : this.awayClub;
        club.tactics = Object.assign(club.tactics || {}, newTactics);
        const eventText = `${this.minute}' - 📋 Traineranweisung bei ${club.name}: Mentalität auf "${club.tactics.mentality}" angepasst.`;
        this.addEvent("tactics", club.id, eventText);
        this.lastCommentary = eventText;
    }

    finishMatch() {
        this.isFinished = true;
        MatchEngine.applyTimelineToMatch(this.match, this.timeline, this.homeClub, this.awayClub, this.allPlayers);
        this.homeScore = this.match.homeGoals;
        this.awayScore = this.match.awayGoals;
        this.lastCommentary = `Abpfiff! Das Spiel endet ${this.homeScore}:${this.awayScore}.`;
    }
}

if (typeof window !== "undefined") {
    window.MatchEngine = MatchEngine;
    window.LiveMatch = LiveMatch;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MatchEngine, LiveMatch };
}
