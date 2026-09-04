/**
 * MatchEngine - Detaillierte Spielberechnung & synchrone 2D-Timeline-Match-Engine
 */

// Zentrale Stellschrauben für die Realismus-Balance. Hier lässt sich die
// Torquote justieren, ohne die Berechnungslogik selbst anfassen zu müssen.
const MATCH_TUNING = {
    // Basis-Torwahrscheinlichkeit je Chancentyp (wird durch Spielerqualität
    // noch nach oben/unten verschoben). Reale Konversionsraten liegen grob
    // zwischen 8% (Distanzschuss) und 16% (klare Chance).
    baseGoalChance: {
        through_ball: 0.105,
        cross: 0.07,
        dribble: 0.055,
        corner: 0.05
    },
    // Wie stark der Qualitätsunterschied (Angreifer vs. Torwart/Abwehr)
    // die Basis-Wahrscheinlichkeit verschiebt.
    skillInfluence: 380,
    // Wahrscheinlichkeit, dass ein Eckball überhaupt zu einem Torschuss führt
    cornerShotChance: 0.25,
    // Cap für maximale/minimale Torwahrscheinlichkeit pro Abschluss
    minGoalChance: 0.03,
    maxGoalChance: 0.38
};

class MatchEngine {
    /**
     * Ermittelt anhand von Schützen-/Torwartqualität und Team-Stärken, ob ein
     * Abschluss zu einem Tor, einer Parade, einem Aluminiumtreffer oder einem
     * Fehlschuss führt. Ersetzt die vorherigen, zu goldgünstigen Doppel-Zufallswerte
     * durch ein einziges, klar kalibriertes Wahrscheinlichkeitsmodell.
     */
    static resolveShotAttempt(shotType, shooter, gk, attPower, defPower) {
        const shooterSkill = shooter?.overall || 68;
        const gkSkill = gk?.overall || 68;

        const skillEdge = (shooterSkill - gkSkill) * 0.6
            + ((attPower?.attack || 62) - (defPower?.defense || 62)) * 0.35;

        const base = MATCH_TUNING.baseGoalChance[shotType] ?? 0.1;
        let pGoal = base + skillEdge / MATCH_TUNING.skillInfluence;
        pGoal = Math.min(MATCH_TUNING.maxGoalChance, Math.max(MATCH_TUNING.minGoalChance, pGoal));

        let pSave = 0.42 - skillEdge / 500;
        pSave = Math.min(0.62, Math.max(0.22, pSave));

        const pWoodwork = 0.05;

        const xG = parseFloat(Math.min(0.68, Math.max(0.03, base + skillEdge / 300)).toFixed(2));

        const roll = Math.random();
        if (roll < pGoal) return { outcome: "goal", xG };
        if (roll < pGoal + pSave) return { outcome: "saved", xG };
        if (roll < pGoal + pSave + pWoodwork) return { outcome: "woodwork", xG };
        return { outcome: "missed", xG };
    }

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

        // Erhöhte Ereignisdichte für mehr Aktionen & mitreißenden Spielfluss
        const powerDiff = homePower.total - awayPower.total;
        const baseScenesHome = Math.max(10, Math.round(15 + (powerDiff / 5) + (Math.random() * 6 - 3)));
        const baseScenesAway = Math.max(8, Math.round(13 - (powerDiff / 5) + (Math.random() * 6 - 3)));
        const totalScenes = baseScenesHome + baseScenesAway + 8; // ca. 30-42 Spielszenen pro Match

        // Verteile Spielminuten dynamisch über die gesamten 90 Minuten
        const minutes = [];
        for (let i = 0; i < totalScenes; i++) {
            const min = Math.min(90, Math.max(2, Math.floor(((i + 0.5) / totalScenes) * 90 + (Math.random() * 3 - 1.5))));
            minutes.push(min);
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
            const wingers = attLineup.filter(p => ["LA", "RA", "LM", "RM"].includes(p.pos));
            const defenders = defLineup.filter(p => ["IV", "LV", "RV", "DM"].includes(p.pos));
            const gk = defLineup.find(p => p.pos === "TW") || defLineup[0];

            const shooter = attackers.length > 0 ? attackers[Math.floor(Math.random() * attackers.length)] : (midfielders[0] || attLineup[0]);
            const passer = midfielders.length > 0 ? midfielders[Math.floor(Math.random() * midfielders.length)] : attLineup[1] || attLineup[0];
            const winger = wingers.length > 0 ? wingers[Math.floor(Math.random() * wingers.length)] : passer;
            const defender = defenders.length > 0 ? defenders[Math.floor(Math.random() * defenders.length)] : defLineup[0];

            const actionTypeRoll = Math.random();

            if (actionTypeRoll < 0.38) {
                // 1. ZENTRALER ANGRIFF / STEILPASS & TORSCHUSS
                const startX = isHome ? 32 + Math.random() * 18 : 68 - Math.random() * 18;
                const startY = 30 + Math.random() * 40;
                const midX = isHome ? 68 + Math.random() * 14 : 32 - Math.random() * 14;
                const midY = 32 + Math.random() * 36;
                const goalX = isHome ? 96 : 4;
                const goalY = 46 + Math.random() * 8;

                timeline.push({
                    minute: min,
                    second: 10,
                    type: "through_ball",
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
                    text: `${min}' - 🎯 Genialer Steilpass von ${passer?.name || "Mittelfeldakteur"} in den Lauf von ${shooter?.name || "Angreifer"}!`
                });

                // Abschlussberechnung über das zentrale, realistisch kalibrierte Modell
                const { outcome: throughOutcome, xG } = this.resolveShotAttempt("through_ball", shooter, gk, attPower, defPower);

                if (throughOutcome === "goal") {
                    // Tor!
                    timeline.push({
                        minute: min,
                        second: 24,
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
                        text: `${min}' - ⚽ TOOOOR für ${attClub.name}! ${shooter?.name || "Stürmer"} vollstreckt eiskalt im Eck nach Pass von ${passer?.name || "Vorlagengeber"}!`
                    });
                } else if (throughOutcome === "saved") {
                    // Starke Parade
                    timeline.push({
                        minute: min,
                        second: 24,
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
                        text: `${min}' - 🧤 Weltklasse-Parade! ${gk?.name || "Schlussmann"} wirft sich in den Schuss von ${shooter?.name || "Stürmer"} und lenkt ihn ab!`
                    });
                } else if (throughOutcome === "woodwork") {
                    // Aluminiumtreffer (Pfosten / Latte)
                    timeline.push({
                        minute: min,
                        second: 24,
                        type: "shot_miss",
                        team: isHome ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        playerId: shooter?.id,
                        playerName: shooter?.name,
                        start: { x: midX, y: midY },
                        end: { x: goalX, y: isHome ? (Math.random() > 0.5 ? 36 : 64) : (Math.random() > 0.5 ? 36 : 64) },
                        xG: xG,
                        outcome: "woodwork",
                        text: `${min}' - 💥 Lattenkracher! ${shooter?.name || "Angreifer"} hämmert den Ball ans Torgebälk!`
                    });
                } else {
                    // Knapper Fehlschuss
                    timeline.push({
                        minute: min,
                        second: 24,
                        type: "shot_miss",
                        team: isHome ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        playerId: shooter?.id,
                        playerName: shooter?.name,
                        start: { x: midX, y: midY },
                        end: { x: goalX, y: goalY + (Math.random() > 0.5 ? 16 : -16) },
                        xG: xG,
                        outcome: "missed",
                        text: `${min}' - Chance für ${attClub.name}: ${shooter?.name || "Spieler"} verfehlt das Tor um Haaresbreite.`
                    });
                }
            } else if (actionTypeRoll < 0.62) {
                // 2. FLÜGELANGRIFF & FLANKE IN DEN STRAFRAUM
                const flankSide = Math.random() > 0.5 ? "right" : "left";
                const startX = isHome ? 45 + Math.random() * 20 : 55 - Math.random() * 20;
                const startY = flankSide === "right" ? 82 + Math.random() * 12 : 6 + Math.random() * 12;
                const crossEndX = isHome ? 88 + Math.random() * 6 : 12 - Math.random() * 6;
                const crossEndY = 42 + Math.random() * 16;
                const goalX = isHome ? 96 : 4;
                const goalY = 48 + Math.random() * 6;

                timeline.push({
                    minute: min,
                    second: 12,
                    type: "cross",
                    team: isHome ? "home" : "away",
                    clubId: attClub.id,
                    clubName: attClub.name,
                    fromPlayerId: winger?.id,
                    fromPlayerName: winger?.name,
                    toPlayerId: shooter?.id,
                    toPlayerName: shooter?.name,
                    start: { x: startX, y: startY },
                    end: { x: crossEndX, y: crossEndY },
                    success: true,
                    text: `${min}' - ⚡ Rasante Flügelaktion: ${winger?.name || "Flügelspieler"} schlägt eine maßgenaue Flanke in den Sechzehner!`
                });

                const { outcome: crossOutcome, xG } = this.resolveShotAttempt("cross", shooter, gk, attPower, defPower);

                if (crossOutcome === "goal") {
                    // Kopfballtor / Volleytor!
                    timeline.push({
                        minute: min,
                        second: 26,
                        type: "goal",
                        team: isHome ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        playerId: shooter?.id,
                        playerName: shooter?.name,
                        assistId: winger?.id,
                        assistName: winger?.name,
                        start: { x: crossEndX, y: crossEndY },
                        end: { x: goalX, y: goalY },
                        xG: xG,
                        outcome: "goal",
                        text: `${min}' - ⚽ TOOOOR für ${attClub.name}! ${shooter?.name || "Stürmer"} wuchtet die Flanke von ${winger?.name || "Flankengeber"} per Kopf in die Maschen!`
                    });
                } else if (crossOutcome === "saved") {
                    timeline.push({
                        minute: min,
                        second: 26,
                        type: "save",
                        team: isHome ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        shooterId: shooter?.id,
                        shooterName: shooter?.name,
                        gkId: gk?.id,
                        gkName: gk?.name,
                        start: { x: crossEndX, y: crossEndY },
                        end: { x: goalX, y: goalY },
                        xG: xG,
                        outcome: "saved",
                        text: `${min}' - 🧤 ${gk?.name || "Keeper"} hechtet blitzschnell und fischt den Kopfball von ${shooter?.name || "Stürmer"} aus dem Winkel!`
                    });
                } else {
                    timeline.push({
                        minute: min,
                        second: 26,
                        type: "shot_miss",
                        team: isHome ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        playerId: shooter?.id,
                        playerName: shooter?.name,
                        start: { x: crossEndX, y: crossEndY },
                        end: { x: goalX, y: goalY + (Math.random() > 0.5 ? 20 : -20) },
                        xG: xG,
                        outcome: "missed",
                        text: `${min}' - ${shooter?.name || "Kopfballspezialist"} steigt hoch, setzt den Kopfball aber knapp über den Querbalken.`
                    });
                }
            } else if (actionTypeRoll < 0.78) {
                // 3. DRIBBLING, SCHNELLER KONTER & WEITSCHUSS
                const startX = isHome ? 25 + Math.random() * 25 : 75 - Math.random() * 25;
                const startY = 35 + Math.random() * 30;
                const dribbleEndX = isHome ? 60 + Math.random() * 15 : 40 - Math.random() * 15;
                const dribbleEndY = 38 + Math.random() * 24;
                const goalX = isHome ? 96 : 4;
                const goalY = 46 + Math.random() * 8;

                timeline.push({
                    minute: min,
                    second: 8,
                    type: "dribble",
                    team: isHome ? "home" : "away",
                    clubId: attClub.id,
                    clubName: attClub.name,
                    playerId: shooter?.id,
                    playerName: shooter?.name,
                    start: { x: startX, y: startY },
                    end: { x: dribbleEndX, y: dribbleEndY },
                    success: true,
                    text: `${min}' - 🏃‍♂️ Starkes Dribbling: ${shooter?.name || "Angreifer"} lässt zwei Gegenspieler stehen und zieht nach innen!`
                });

                const { outcome: dribbleOutcome, xG } = this.resolveShotAttempt("dribble", shooter, gk, attPower, defPower);

                if (dribbleOutcome === "goal") {
                    timeline.push({
                        minute: min,
                        second: 20,
                        type: "goal",
                        team: isHome ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        playerId: shooter?.id,
                        playerName: shooter?.name,
                        start: { x: dribbleEndX, y: dribbleEndY },
                        end: { x: goalX, y: goalY },
                        xG: xG,
                        outcome: "goal",
                        text: `${min}' - ⚽ TRAUMTOR für ${attClub.name}! ${shooter?.name || "Schütze"} hämmert den Ball aus 20 Metern unhaltbar in den Knick!`
                    });
                } else if (dribbleOutcome === "saved") {
                    timeline.push({
                        minute: min,
                        second: 20,
                        type: "save",
                        team: isHome ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        shooterId: shooter?.id,
                        shooterName: shooter?.name,
                        gkId: gk?.id,
                        gkName: gk?.name,
                        start: { x: dribbleEndX, y: dribbleEndY },
                        end: { x: goalX, y: goalY },
                        xG: xG,
                        outcome: "saved",
                        text: `${min}' - 🧤 Glanztat von ${gk?.name || "Keeper"}, der den wuchtigen Distanzkracher von ${shooter?.name || "Schütze"} entschärft.`
                    });
                } else {
                    timeline.push({
                        minute: min,
                        second: 20,
                        type: "shot_miss",
                        team: isHome ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        playerId: shooter?.id,
                        playerName: shooter?.name,
                        start: { x: dribbleEndX, y: dribbleEndY },
                        end: { x: goalX, y: goalY + (Math.random() > 0.5 ? 18 : -18) },
                        xG: xG,
                        outcome: "missed",
                        text: `${min}' - ${shooter?.name || "Schütze"} sucht den Abschluss aus der zweiten Reihe, zielt aber etwas zu hoch.`
                    });
                }
            } else if (actionTypeRoll < 0.90) {
                // 4. ECKBALL ODER FREISTOSS-STANDARDSITUATION
                const isCorner = Math.random() < 0.65;
                if (isCorner) {
                    const cPos = { x: isHome ? 98 : 2, y: Math.random() > 0.5 ? 4 : 96 };
                    const centerBox = { x: isHome ? 88 : 12, y: 50 };
                    const goalX = isHome ? 96 : 4;
                    const goalY = 48 + Math.random() * 6;

                    timeline.push({
                        minute: min,
                        second: 30,
                        type: "corner",
                        team: isHome ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        playerId: passer?.id,
                        playerName: passer?.name,
                        start: cPos,
                        end: centerBox,
                        outcome: "corner",
                        text: `${min}' - 🚩 Eckball für ${attClub.name}: ${passer?.name || "Vorlagengeber"} bringt das Leder mit Schnitt vors Tor!`
                    });

                    // Gefahr nach Eckball: nur ein Teil der Ecken führt überhaupt zu einem
                    // echten Abschluss, und davon nur ein kleiner, realistischer Anteil zum Tor.
                    if (Math.random() < MATCH_TUNING.cornerShotChance) {
                        const { outcome: cornerOutcome, xG } = this.resolveShotAttempt("corner", shooter, gk, attPower, defPower);
                        if (cornerOutcome === "goal") {
                            timeline.push({
                                minute: min,
                                second: 36,
                                type: "goal",
                                team: isHome ? "home" : "away",
                                clubId: attClub.id,
                                clubName: attClub.name,
                                playerId: shooter?.id,
                                playerName: shooter?.name,
                                assistId: passer?.id,
                                assistName: passer?.name,
                                start: centerBox,
                                end: { x: goalX, y: goalY },
                                xG: xG,
                                outcome: "goal",
                                text: `${min}' - ⚽ TOOOOR nach Ecke! ${shooter?.name || "Abnehmer"} schraubt sich am Fünfmeterraum hoch und köpft ein!`
                            });
                        } else if (cornerOutcome === "saved") {
                            timeline.push({
                                minute: min,
                                second: 36,
                                type: "save",
                                team: isHome ? "away" : "home",
                                clubId: defClub.id,
                                clubName: defClub.name,
                                shooterId: shooter?.id,
                                shooterName: shooter?.name,
                                gkId: gk?.id,
                                gkName: gk?.name,
                                start: centerBox,
                                end: { x: goalX, y: goalY },
                                xG: xG,
                                outcome: "saved",
                                text: `${min}' - 🧤 ${gk?.name || "Torwart"} klärt den Kopfball nach der Ecke stark über die Latte bzw. hält sicher!`
                            });
                        }
                    }
                } else {
                    // Freistoß
                    const fPos = { x: isHome ? 74 + Math.random() * 10 : 26 - Math.random() * 10, y: 30 + Math.random() * 40 };
                    timeline.push({
                        minute: min,
                        second: 30,
                        type: "foul",
                        team: isHome ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        playerId: defender?.id,
                        playerName: defender?.name,
                        start: fPos,
                        end: fPos,
                        outcome: "foul",
                        text: `${min}' - Foul von ${defender?.name || "Verteidiger"} (${defClub.name}) in aussichtsreicher Freistoßposition.`
                    });
                }
            } else {
                // 5. ZWEIKÄMPFE, GRÄTSCHEN, KARTEN & ELFMETER
                const fPos = { x: 30 + Math.random() * 40, y: 15 + Math.random() * 70 };
                const isPenalty = Math.random() < 0.12;
                const isRed = !isPenalty && Math.random() < 0.06;
                const isYellow = !isPenalty && !isRed && Math.random() < 0.35;

                if (isPenalty) {
                    const penSpot = { x: isHome ? 88 : 12, y: 50 };
                    const goalX = isHome ? 96 : 4;
                    const goalY = 50;
                    timeline.push({
                        minute: min,
                        second: 32,
                        type: "foul",
                        team: isHome ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        playerId: defender?.id,
                        playerName: defender?.name,
                        start: penSpot,
                        end: penSpot,
                        outcome: "penalty",
                        text: `${min}' - 🛑 PFIFF! Foul im Strafraum! Schiedsrichter zeigt auf den Punkt: ELFMETER für ${attClub.name}!`
                    });

                    if (Math.random() < 0.78) {
                        timeline.push({
                            minute: min,
                            second: 42,
                            type: "goal",
                            team: isHome ? "home" : "away",
                            clubId: attClub.id,
                            clubName: attClub.name,
                            playerId: shooter?.id,
                            playerName: shooter?.name,
                            start: penSpot,
                            end: { x: goalX, y: goalY + (Math.random() > 0.5 ? 4 : -4) },
                            xG: 0.76,
                            outcome: "goal",
                            text: `${min}' - ⚽ TOOOOR durch Elfmeter! ${shooter?.name || "Schütze"} verlädt den Torwart souverän!`
                        });
                    } else {
                        timeline.push({
                            minute: min,
                            second: 42,
                            type: "save",
                            team: isHome ? "away" : "home",
                            clubId: defClub.id,
                            clubName: defClub.name,
                            shooterId: shooter?.id,
                            shooterName: shooter?.name,
                            gkId: gk?.id,
                            gkName: gk?.name,
                            start: penSpot,
                            end: { x: goalX, y: goalY },
                            xG: 0.76,
                            outcome: "saved",
                            text: `${min}' - 🧤 GEHALTEN! ${gk?.name || "Elfmeterkiller"} pariert den Strafstoß von ${shooter?.name || "Schütze"}!`
                        });
                    }
                } else if (isRed) {
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
                } else if (isYellow) {
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
                        text: `${min}' - 🟨 Gelbe Karte für ${defender?.name || "Verteidiger"} (${defClub.name}) nach taktischem Foul.`
                    });
                } else {
                    timeline.push({
                        minute: min,
                        second: 35,
                        type: "tackle",
                        team: isHome ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        playerId: defender?.id,
                        playerName: defender?.name,
                        start: fPos,
                        end: fPos,
                        outcome: "tackle",
                        text: `${min}' - 🛡️ Perfektes Tackling: ${defender?.name || "Abwehrchef"} klärt die Situation mit einer sauberen Grätsche.`
                    });
                }
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
        this.speed = 1; // Standard: langsam / realistisch (1 = slow, 2 = normal, 4 = fast)

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
        this.ball = { x: 50, y: 50, targetX: 50, targetY: 50, speed: 0.04, holderId: null };
        this.ballTrail = [];
        this.activePlayerId = null;
        this.goalFlash = 0;
        this.players2D = this.initialize2DPositions();
        this.currentPhase = "kickoff";
        this.lastCommentary = "Das Spiel wird angepfiffen!";
    }

    getTickIntervalMs() {
        const speeds = (typeof LIVE_MATCH_SPEEDS !== 'undefined' && LIVE_MATCH_SPEEDS)
            ? LIVE_MATCH_SPEEDS
            : ((typeof window !== 'undefined' && window.LIVE_MATCH_SPEEDS) ? window.LIVE_MATCH_SPEEDS : {
                1: { tickIntervalMs: 2200, minuteStep: 1 },
                2: { tickIntervalMs: 1200, minuteStep: 1 },
                4: { tickIntervalMs: 500, minuteStep: 2 },
                slow: { tickIntervalMs: 2200, minuteStep: 1 },
                normal: { tickIntervalMs: 1200, minuteStep: 1 },
                fast: { tickIntervalMs: 500, minuteStep: 2 }
            });

        const cfg = speeds[this.speed] || speeds[1] || { tickIntervalMs: 2200, minuteStep: 1 };
        return cfg.tickIntervalMs || 2200;
    }

    getMinuteStep() {
        const speeds = (typeof LIVE_MATCH_SPEEDS !== 'undefined' && LIVE_MATCH_SPEEDS)
            ? LIVE_MATCH_SPEEDS
            : ((typeof window !== 'undefined' && window.LIVE_MATCH_SPEEDS) ? window.LIVE_MATCH_SPEEDS : null);
        const cfg = (speeds && speeds[this.speed]) ? speeds[this.speed] : { minuteStep: 1 };
        return cfg.minuteStep || 1;
    }

    initialize2DPositions() {
        const formConfigs = (typeof FORMATION_CONFIGS !== 'undefined' && FORMATION_CONFIGS)
            ? FORMATION_CONFIGS
            : ((typeof window !== 'undefined' && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS : (typeof require !== 'undefined' ? require('./gameState.js').FORMATION_CONFIGS : {}));
        const homePositions = (formConfigs && formConfigs[this.homeClub.formation]) ? formConfigs[this.homeClub.formation].positions : (formConfigs && formConfigs["4-4-2"] ? formConfigs["4-4-2"].positions : []);
        const awayPositions = (formConfigs && formConfigs[this.awayClub.formation]) ? formConfigs[this.awayClub.formation].positions : (formConfigs && formConfigs["4-4-2"] ? formConfigs["4-4-2"].positions : []);

        const players = [];

        // Heimspieler (Torwart links bei x~4, Abwehr x~16, Mittelfeld x~26-34, Sturm x~42; greift nach rechts an)
        this.homeLineup.forEach((p, idx) => {
            const slot = homePositions[idx] || { x: 50, y: 90 };
            // In FORMATION_CONFIGS: TW hat y=92 (unten am eigenen Tor), ST hat y=18 (oben an der Front)
            // Auf dem 2D-Feld (links->rechts): TW muss links sein (x nahe 0), ST muss rechts sein (x nahe 50/Mittellinie)
            const fieldX = Math.max(3, Math.min(48, ((100 - slot.y) / 100) * 44 + 4));
            const fieldY = slot.x; // Vertikale Achse (Breite des Feldes 0-100)
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
                rating: 6.0,
                locked: 0
            });
        });

        // Auswärtsspieler (Torwart rechts bei x~96, Abwehr x~84, Mittelfeld x~66-74, Sturm x~58; greift nach links an)
        this.awayLineup.forEach((p, idx) => {
            const slot = awayPositions[idx] || { x: 50, y: 90 };
            const fieldX = Math.max(52, Math.min(97, 100 - (((100 - slot.y) / 100) * 44 + 4)));
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
                rating: 6.0,
                locked: 0
            });
        });

        return players;
    }

    /**
     * Simulationsschritt (wird periodisch anhand des Tick-Intervalls aufgerufen)
     */
    tick(step = null) {
        if (this.isFinished || this.isPaused) return;

        const minuteInc = step || this.getMinuteStep();
        this.minute += minuteInc;

        // Pro Tick wird bewusst nur EIN Timeline-Event abgespielt (statt alle,
        // die bis zur aktuellen Minute fällig sind, sofort hintereinander).
        // So bleibt genug echte Zeit zwischen z.B. Steilpass und Torschuss,
        // damit Ball und Spieler die Aktion sichtbar "ausspielen" können,
        // statt dass mehrere Ereignisse unsichtbar im selben Frame passieren.
        if (this.timelineIndex < this.timeline.length && this.timeline[this.timelineIndex].minute <= this.minute) {
            const ev = this.timeline[this.timelineIndex];
            this.playTimelineEvent(ev);
            this.timelineIndex++;
        }

        // Bei Ballbesitz-Verteilung leichte Anpassungen
        if (this.stats.shots[0] + this.stats.shots[1] > 0) {
            const totalShots = Math.max(1, this.stats.shots[0] + this.stats.shots[1]);
            const homeRatio = Math.round((this.stats.shots[0] / totalShots) * 100);
            this.stats.possession[0] = Math.max(35, Math.min(65, Math.round(50 + (homeRatio - 50) * 0.3)));
            this.stats.possession[1] = 100 - this.stats.possession[0];
        }

        if (this.minute >= 90 + this.extraTime) {
            // Etwaige noch nicht abgespielte Restereignisse (z.B. wenn die Timeline
            // schneller "voll" ist als die Ticks sie konsumieren) noch einspielen,
            // damit Ergebnis & Statistik am Ende garantiert vollständig sind.
            while (this.timelineIndex < this.timeline.length) {
                this.playTimelineEvent(this.timeline[this.timelineIndex]);
                this.timelineIndex++;
            }
            this.finishMatch();
        }
    }

    /**
     * Sofortiges Zu-Ende-Spielen der Timeline (Sofortmodus)
     */
    skipToEnd() {
        while (!this.isFinished) {
            if (this.timelineIndex < this.timeline.length) {
                const ev = this.timeline[this.timelineIndex];
                this.minute = Math.max(this.minute, ev.minute);
                this.playTimelineEvent(ev);
                this.timelineIndex++;
            } else {
                this.minute = 90 + this.extraTime;
                this.finishMatch();
            }
        }
    }

    /**
     * Führt ein konkretes Timeline-Event im 2D-Feld aus
     */
    playTimelineEvent(event) {
        this.lastCommentary = event.text;
        this.activePlayerId = event.playerId || event.fromPlayerId || event.shooterId || event.toPlayerId || null;

        if (event.start && event.end) {
            this.ball.x = event.start.x;
            this.ball.y = event.start.y;
            this.ball.targetX = event.end.x;
            this.ball.targetY = event.end.y;
            this.ball.speed = (event.type === "goal" || event.type === "through_ball") ? 0.055 : 0.042;
        }

        const teamIndex = event.team === "home" ? 0 : 1;

        if (event.type === "goal") {
            if (event.team === "home") this.homeScore++; else this.awayScore++;
            this.stats.shots[teamIndex]++;
            this.stats.shotsOnTarget[teamIndex]++;
            this.stats.xG[teamIndex] = parseFloat((this.stats.xG[teamIndex] + (event.xG || 0.3)).toFixed(2));
            this.goalFlash = 1.0; // Tor-Effekt aktivieren
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
        } else if (event.type === "foul" || event.type === "tackle") {
            this.stats.fouls[teamIndex]++;
        }

        // Dynamische Spielerbewegung passend zum Event: die an der Aktion beteiligten
        // Spieler werden für ein paar Frames an die exakten Ball-Koordinaten "gelockt",
        // damit updateBallAndPlayers() ihre Position nicht sofort wieder mit der
        // generischen Formationslogik überschreibt. Dadurch sieht man Passgeber,
        // Passempfänger/Schütze und Torwart tatsächlich am Ball, statt dass der Ball
        // sichtbar durch leeren Raum fliegt.
        const LOCK_TICKS = 30;
        const startPos = event.start || event.end;
        const endPos = event.end || event.start;

        const lockPlayer = (id, pos, ticks = LOCK_TICKS) => {
            if (!id || !pos) return;
            const p = this.players2D.find(pl => pl.id === id);
            if (!p) return;
            p.x = pos.x;
            p.y = pos.y;
            p.targetX = pos.x;
            p.targetY = pos.y;
            p.locked = ticks;
        };

        // Ballgeber / Schütze startet exakt dort, wo die Aktion beginnt
        lockPlayer(event.playerId || event.fromPlayerId || event.shooterId, startPos);
        // Empfänger (bei Pässen/Flanken) bewegt sich zum Ballziel
        lockPlayer(event.toPlayerId, endPos);
        // Torwart reagiert sichtbar auf Schüsse/Paraden
        lockPlayer(event.gkId, endPos, LOCK_TICKS + 10);
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

    /**
     * Aktualisiert Ball- und Spielerkoordinaten flüssig (für jeden Frame)
     * Ermöglicht realistische Team-Verschiebungen über das gesamte Spielfeld!
     */
    updateBallAndPlayers() {
        const ballSpeed = this.ball.speed || 0.042;
        this.ball.x += (this.ball.targetX - this.ball.x) * ballSpeed;
        this.ball.y += (this.ball.targetY - this.ball.y) * ballSpeed;

        // Ball-Schweifspur (Trail) aufzeichnen
        if (!this.ballTrail) this.ballTrail = [];
        this.ballTrail.push({ x: this.ball.x, y: this.ball.y, alpha: 1.0 });
        if (this.ballTrail.length > 7) this.ballTrail.shift();
        this.ballTrail.forEach(t => t.alpha *= 0.82);

        // Goal flash abklingen lassen
        if (this.goalFlash > 0) {
            this.goalFlash = Math.max(0, this.goalFlash - 0.015);
        }

        // Wenn der Ball sein Ziel fast erreicht hat, leichtes Weiterdriften / Trudeln
        if (Math.abs(this.ball.targetX - this.ball.x) < 1.5 && Math.abs(this.ball.targetY - this.ball.y) < 1.5) {
            // Ball bleibt in der Nähe des aktuellen Geschehens
            this.ball.targetX += (Math.random() - 0.5) * 1.5;
            this.ball.targetY += (Math.random() - 0.5) * 1.5;
        }

        const ballX = this.ball.x;
        const ballY = this.ball.y;

        this.players2D.forEach(p => {
            // Spieler, die gerade aktiv an einer Timeline-Aktion beteiligt sind
            // (Passgeber, Empfänger, Torwart), werden zügig zu ihrer exakten
            // Aktionsposition gezogen statt von der generischen Formationslogik
            // "weggeschoben" zu werden. So bleiben Ball und Spieler sichtbar zusammen.
            if (p.locked > 0) {
                p.locked--;
                p.x += (p.targetX - p.x) * 0.18;
                p.y += (p.targetY - p.y) * 0.18;
                return;
            }

            const isHome = p.team === "home";
            const isGK = p.pos === "TW";
            const isDef = ["IV", "LV", "RV"].includes(p.pos);
            const isMid = ["DM", "ZM", "LM", "RM", "OM"].includes(p.pos);
            const isAtt = ["ST", "LA", "RA"].includes(p.pos);

            let pushX = 0;
            let pushY = (ballY - 50) * 0.25;

            if (isGK) {
                // Torwart bleibt in und um seinen Strafraum / Torlinie
                if (isHome) {
                    p.targetX = Math.max(3, Math.min(14, 4 + (ballX * 0.08)));
                    p.targetY = Math.max(36, Math.min(64, 50 + (ballY - 50) * 0.35));
                } else {
                    p.targetX = Math.min(97, Math.max(86, 96 - ((100 - ballX) * 0.08)));
                    p.targetY = Math.max(36, Math.min(64, 50 + (ballY - 50) * 0.35));
                }
            } else {
                // Feldspieler rücken je nach Ballposition und Rolle über das gesamte Feld auf und ab
                if (isHome) {
                    // Heim greift nach rechts an (Richtung 100)
                    if (isAtt) {
                        // Stürmer rücken bis tief in den gegnerischen Strafraum (x=50 bis x=94)
                        pushX = (ballX - 35) * 0.85;
                        p.targetX = Math.max(30, Math.min(94, p.baseX + pushX));
                    } else if (isMid) {
                        // Mittelfeldspieler bewegen sich im Bereich x=20 bis x=82
                        pushX = (ballX - 40) * 0.65;
                        p.targetX = Math.max(18, Math.min(84, p.baseX + pushX));
                    } else if (isDef) {
                        // Verteidiger rücken bei Ballbesitz bis zur Mittellinie/Gegnerhälfte auf (x=8 bis x=62)
                        pushX = (ballX - 40) * 0.45;
                        p.targetX = Math.max(6, Math.min(64, p.baseX + pushX));
                    }
                } else {
                    // Auswärts greift nach links an (Richtung 0)
                    if (isAtt) {
                        // Stürmer rücken bis tief in den gegnerischen Strafraum (x=6 bis x=50)
                        pushX = (65 - ballX) * 0.85;
                        p.targetX = Math.min(70, Math.max(6, p.baseX - pushX));
                    } else if (isMid) {
                        // Mittelfeldspieler bewegen sich im Bereich x=16 bis x=80
                        pushX = (60 - ballX) * 0.65;
                        p.targetX = Math.min(82, Math.max(16, p.baseX - pushX));
                    } else if (isDef) {
                        // Verteidiger rücken bis zur Mittellinie/Gegnerhälfte vor (x=36 bis x=92)
                        pushX = (60 - ballX) * 0.45;
                        p.targetX = Math.min(94, Math.max(36, p.baseX - pushX));
                    }
                }

                p.targetY = Math.max(6, Math.min(94, p.baseY + pushY));
            }

            // Sanfte Annäherung an die Zielposition (flüssige Animation)
            p.x += (p.targetX - p.x) * 0.04;
            p.y += (p.targetY - p.y) * 0.04;
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