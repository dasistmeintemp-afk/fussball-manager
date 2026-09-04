/**
 * PlayerGenerator - Erzeugt realistische Spieler für Vereine aller Ligastufen
 */

class PlayerGenerator {
    static POSITIONS = ["TW", "IV", "LV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"];
    static SQUAD_DISTRIBUTION = [
        "TW", "TW", "TW",
        "IV", "IV", "IV", "IV",
        "LV", "LV", "RV", "RV",
        "DM", "DM", "ZM", "ZM", "ZM",
        "LM", "RM", "OM", "OM",
        "LA", "RA", "ST", "ST", "ST"
    ];

    /**
     * Ermittelt CA & PA-Bandbreiten je nach Ligastufe
     */
    static getAbilityRangeForLevel(level = 1) {
        switch (level) {
            case 1: return { minCA: 130, maxCA: 185, minPA: 135, maxPA: 195 }; // Top-5 / Bundesliga
            case 2: return { minCA: 110, maxCA: 150, minPA: 115, maxPA: 165 }; // 2. Liga
            case 3: return { minCA: 95, maxCA: 135, minPA: 100, maxPA: 145 };  // 3. Liga
            case 4: return { minCA: 75, maxCA: 115, minPA: 80, maxPA: 130 };   // Regionalliga
            case 5: return { minCA: 55, maxCA: 95, minPA: 60, maxPA: 115 };    // Oberliga
            case 6: return { minCA: 40, maxCA: 75, minPA: 45, maxPA: 95 };     // Verbandsliga
            case 7: return { minCA: 25, maxCA: 60, minPA: 30, maxPA: 80 };     // Landesliga
            default: return { minCA: 50, maxCA: 90, minPA: 55, maxPA: 110 };
        }
    }

    /**
     * Erzeugt einen einzelnen Spieler
     */
    static generatePlayer(clubId, level = 1, preferredPosition = null, customId = null) {
        const pool = typeof NAME_POOLS !== "undefined" ? NAME_POOLS : {
            firstNames: ["Lukas", "Leon", "Finn", "Maximilian", "Paul", "Julian", "David", "Tim", "Tobias", "Marco"],
            lastNames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz"],
            nationalities: ["Deutschland", "Deutschland", "Österreich", "Schweiz", "Frankreich", "Spanien", "Italien"]
        };

        const firstName = pool.firstNames[Math.floor(Math.random() * pool.firstNames.length)];
        const lastName = pool.lastNames[Math.floor(Math.random() * pool.lastNames.length)];
        const nationality = pool.nationalities[Math.floor(Math.random() * pool.nationalities.length)];

        const pos = preferredPosition || this.POSITIONS[Math.floor(Math.random() * this.POSITIONS.length)];
        const age = 17 + Math.floor(Math.random() * 18); // 17 - 34

        const abilityRange = this.getAbilityRangeForLevel(level);
        const caSpread = abilityRange.maxCA - abilityRange.minCA;
        const baseCA = abilityRange.minCA + Math.floor(Math.random() * caSpread);

        // Alterseinfluss auf CA / PA
        let trueCA = baseCA;
        let truePA = Math.max(trueCA, trueCA + Math.floor(Math.random() * (abilityRange.maxPA - trueCA + 1)));

        if (age <= 21) {
            trueCA = Math.max(20, trueCA - Math.floor(Math.random() * 20));
            truePA = Math.min(200, trueCA + 15 + Math.floor(Math.random() * 35));
        } else if (age >= 31) {
            trueCA = Math.max(30, trueCA - (age - 30) * 3);
            truePA = trueCA;
        }

        const overall = typeof PlayerRatingEngine !== "undefined" 
            ? PlayerRatingEngine.abilityToOverall(trueCA) 
            : Math.min(99, Math.max(30, Math.round(trueCA / 2)));
            
        const pot = typeof PlayerRatingEngine !== "undefined" 
            ? PlayerRatingEngine.abilityToOverall(truePA) 
            : Math.min(99, Math.max(30, Math.round(truePA / 2)));

        // Marktwert und Gehalt nach Ligastufe und Stärke
        let value = 100000;
        let wage = 25000;

        if (level === 1) {
            value = Math.round(Math.pow(overall / 40, 4) * 200000);
            wage = Math.round(value * 0.08 + 100000);
        } else if (level === 2) {
            value = Math.round(Math.pow(overall / 45, 3.5) * 80000);
            wage = Math.round(value * 0.07 + 40000);
        } else if (level === 3) {
            value = Math.round(Math.pow(overall / 50, 3.2) * 30000);
            wage = Math.round(value * 0.06 + 15000);
        } else if (level === 4) { // Semi-Pro
            value = Math.round(Math.pow(overall / 55, 3) * 10000);
            wage = Math.round(value * 0.05 + 5000);
        } else { // Amateur
            value = Math.max(1000, Math.round((overall - 20) * 800));
            wage = Math.max(500, Math.round((overall - 20) * 120));
        }

        const id = customId || `p_${clubId}_${pos}_${Math.random().toString(36).substring(2, 8)}`;

        const hiddenAttributes = typeof PlayerRatingEngine !== "undefined"
            ? PlayerRatingEngine.generateHiddenAttributes({ age, overall })
            : { professionalism: 12, ambition: 12, consistency: 12, importantMatches: 12, injuryProneness: 8, loyalty: 14 };

        return {
            id: id,
            name: `${firstName} ${lastName}`,
            age: age,
            nationality: nationality,
            pos: pos,
            clubId: clubId,
            overall: overall,
            pot: pot,
            trueCurrentAbility: trueCA,
            truePotentialAbility: truePA,
            trueMarketValue: value,
            value: value,
            wage: wage,
            contractYears: 1 + Math.floor(Math.random() * 4),
            fitness: 90 + Math.floor(Math.random() * 11),
            morale: 75 + Math.floor(Math.random() * 20),
            form: 6.5 + parseFloat((Math.random() * 1.5).toFixed(1)),
            injured: false,
            injuryWeeks: 0,
            suspended: false,
            suspensionMatches: 0,
            yellowCardsSeason: 0,
            stats: {
                matches: 0,
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
                minutes: 0,
                cleanSheets: 0,
                ratingSum: 0
            },
            hiddenAttributes: hiddenAttributes,
            scoutingKnowledge: {
                known: false,
                knowledgeLevel: 25,
                lastScoutedDate: null,
                reportsCount: 0,
                accuracy: 25
            },
            happiness: {
                overall: 75,
                playingTime: 75,
                contract: 75,
                teamPerformance: 75,
                training: 75,
                reason: ""
            }
        };
    }

    /**
     * Erzeugt einen kompletten Kader für einen Verein
     */
    static generateSquad(clubId, level = 1, squadSize = 22) {
        const squad = [];
        const distribution = this.SQUAD_DISTRIBUTION.slice(0, squadSize);

        distribution.forEach((pos, idx) => {
            const player = this.generatePlayer(clubId, level, pos, `p_${clubId}_${idx + 1}`);
            squad.push(player);
        });

        return squad;
    }

    /**
     * Generiert einen Jugendspieler
     */
    static generateYouthPlayer(clubId, academyLevel = 1, level = 1) {
        const pool = typeof NAME_POOLS !== "undefined" ? NAME_POOLS : {
            firstNames: ["Lukas", "Leon", "Finn", "Maximilian", "Noah"],
            lastNames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber"],
            nationalities: ["Deutschland"]
        };

        const firstName = pool.firstNames[Math.floor(Math.random() * pool.firstNames.length)];
        const lastName = pool.lastNames[Math.floor(Math.random() * pool.lastNames.length)];
        const pos = this.POSITIONS[Math.floor(Math.random() * this.POSITIONS.length)];
        const age = 15 + Math.floor(Math.random() * 3); // 15-17

        const abilityRange = this.getAbilityRangeForLevel(level);
        const baseCA = Math.max(25, abilityRange.minCA - 35 + (academyLevel * 5) + Math.floor(Math.random() * 20));
        const truePA = Math.min(200, baseCA + 30 + (academyLevel * 12) + Math.floor(Math.random() * 25));

        const overall = typeof PlayerRatingEngine !== "undefined"
            ? PlayerRatingEngine.abilityToOverall(baseCA)
            : Math.round(baseCA / 2);

        const pot = typeof PlayerRatingEngine !== "undefined"
            ? PlayerRatingEngine.abilityToOverall(truePA)
            : Math.round(truePA / 2);

        return {
            id: `youth_${clubId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: `${firstName} ${lastName}`,
            age: age,
            nationality: "Deutschland",
            pos: pos,
            overall: overall,
            pot: pot,
            trueCurrentAbility: baseCA,
            truePotentialAbility: truePA,
            developmentRate: 1.0 + (academyLevel * 0.1),
            promoted: false
        };
    }
}

if (typeof window !== "undefined") {
    window.PlayerGenerator = PlayerGenerator;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PlayerGenerator };
}
