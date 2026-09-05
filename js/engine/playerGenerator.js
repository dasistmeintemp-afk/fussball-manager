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
     * Auflösung der PlayerRatingEngine in Browser- und Node-Umgebung.
     *
     * Ohne diese Auflösung griff in Node eine Ersatzformel mit einer
     * Untergrenze von 30 Gesamtstärke - alle Amateurspieler kamen dadurch
     * exakt auf 30 heraus, unabhängig von der Ligastufe.
     */
    static getRatingEngine() {
        if (typeof PlayerRatingEngine !== "undefined" && PlayerRatingEngine) return PlayerRatingEngine;
        if (typeof window !== "undefined" && window.PlayerRatingEngine) return window.PlayerRatingEngine;
        if (typeof require !== "undefined") {
            try {
                return require("./playerRatingEngine.js").PlayerRatingEngine;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /** Rechnet interne Fähigkeit in Gesamtstärke um (mit sauberem Fallback) */
    static toOverall(ability) {
        const engine = this.getRatingEngine();
        if (engine) return engine.abilityToOverall(ability);
        return Math.max(1, Math.min(99, Math.round(ability / 2)));
    }

    /**
     * Auflösung der PositionEngine in Browser- und Node-Umgebung
     */
    static getPositionEngine() {
        if (typeof PositionEngine !== "undefined" && PositionEngine) return PositionEngine;
        if (typeof window !== "undefined" && window.PositionEngine) return window.PositionEngine;
        if (typeof require !== "undefined") {
            try {
                return require("./positionEngine.js").PositionEngine;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /**
     * Ermittelt CA & PA-Bandbreiten je nach Ligastufe.
     *
     * Die Stufen sind bewusst weit auseinander: Ein Landesligaspieler (Stufe 7)
     * liegt bei rund 12-30 Gesamtstärke, ein Bundesligaspieler (Stufe 1) bei
     * 65-92. Zwischen benachbarten Stufen bleibt jedoch eine Überschneidung,
     * damit ein Spitzenklub der 2. Liga stärker besetzt sein kann als ein
     * Abstiegskandidat der Bundesliga.
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
     * Verschiebt die Bandbreite einer Ligastufe nach dem Ruf des Vereins.
     *
     * clubStrength 0 = schwächster Klub der Liga, 1 = stärkster.
     * Dadurch bekommt der Meisterschaftsanwärter einer Liga spürbar bessere
     * Spieler als der Aufsteiger - und die Stufen überschneiden sich
     * realistisch an den Rändern.
     */
    static getAbilityRangeForClub(level = 1, clubStrength = 0.5) {
        const range = this.getAbilityRangeForLevel(level);
        const strength = Math.max(0, Math.min(1, clubStrength));

        const caSpan = range.maxCA - range.minCA;
        const paSpan = range.maxPA - range.minPA;
        const caShift = Math.round((strength - 0.5) * caSpan * 0.45);
        const paShift = Math.round((strength - 0.5) * paSpan * 0.45);

        return {
            minCA: Math.max(15, range.minCA + caShift),
            maxCA: Math.min(200, range.maxCA + caShift),
            minPA: Math.max(20, range.minPA + paShift),
            maxPA: Math.min(200, range.maxPA + paShift)
        };
    }

    /**
     * Länderspezifische Namenspools. Ein spanischer Zweitligist soll keine
     * Mannschaft voller "Müller" stellen.
     */
    static resolveNamePool(countryId) {
        const pools = (typeof COUNTRY_NAME_POOLS !== "undefined" && COUNTRY_NAME_POOLS)
            ? COUNTRY_NAME_POOLS
            : ((typeof window !== "undefined" && window.COUNTRY_NAME_POOLS) ? window.COUNTRY_NAME_POOLS : null);

        if (pools && countryId && pools[countryId]) return pools[countryId];
        if (pools && pools.de) return pools.de;

        if (typeof NAME_POOLS !== "undefined" && NAME_POOLS) return NAME_POOLS;
        if (typeof window !== "undefined" && window.NAME_POOLS) return window.NAME_POOLS;
        return {
            firstNames: ["Lukas", "Leon", "Finn", "Maximilian", "Paul", "Julian", "David", "Tim", "Tobias", "Marco"],
            lastNames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz"],
            nationalities: ["Deutschland", "Deutschland", "Österreich", "Schweiz", "Frankreich", "Spanien", "Italien"]
        };
    }

    /**
     * Marktwert und Wochengehalt.
     *
     * Der Marktwert folgt einer Exponentialkurve über die Gesamtstärke - so
     * kostet ein 83er Stürmer rund 38 Mio., ein 46er Regionalligaspieler gut
     * 100.000 Euro. Der Ligafaktor bildet ab, dass dieselbe Stärke in einer
     * schwächeren Liga weniger Marktwert erzeugt.
     */
    static getValueAndWage(overall, level = 1, age = 25) {
        const LEVEL_VALUE_FACTOR = { 1: 1.0, 2: 0.7, 3: 0.5, 4: 0.35, 5: 0.25, 6: 0.18, 7: 0.12 };
        const LEVEL_BASE_WAGE = { 1: 8000, 2: 3000, 3: 1500, 4: 700, 5: 350, 6: 200, 7: 120 };

        const levelFactor = LEVEL_VALUE_FACTOR[level] ?? 0.2;
        const baseWage = LEVEL_BASE_WAGE[level] ?? 300;

        // Alterskurve: Höhepunkt des Marktwerts zwischen 23 und 28
        let ageFactor = 1.0;
        if (age <= 21) ageFactor = 1.12;
        else if (age <= 28) ageFactor = 1.0;
        else if (age <= 31) ageFactor = 0.72;
        else if (age <= 33) ageFactor = 0.48;
        else ageFactor = 0.3;

        const raw = 150000 * Math.pow(1.13, overall - 40) * levelFactor * ageFactor;
        const value = Math.max(1000, Math.round(raw / 1000) * 1000);
        const wage = Math.max(150, Math.round((value * 0.002 + baseWage) / 50) * 50);

        return { value, wage };
    }

    /**
     * Erzeugt einen einzelnen Spieler
     */
    static generatePlayer(clubId, level = 1, preferredPosition = null, customId = null, options = {}) {
        const pool = this.resolveNamePool(options.countryId);

        const firstName = pool.firstNames[Math.floor(Math.random() * pool.firstNames.length)];
        const lastName = pool.lastNames[Math.floor(Math.random() * pool.lastNames.length)];
        const nationality = pool.nationalities[Math.floor(Math.random() * pool.nationalities.length)];

        const pos = preferredPosition || this.POSITIONS[Math.floor(Math.random() * this.POSITIONS.length)];
        const age = 17 + Math.floor(Math.random() * 18); // 17 - 34

        // Nebenpositionen: nicht jeder Spieler kann überall spielen
        const positionEngine = this.getPositionEngine();
        const secondaryPositions = positionEngine ? positionEngine.generateSecondaryPositions(pos) : [];

        // Die Kaderstärke richtet sich nach Ligastufe UND Ruf des Vereins
        const abilityRange = this.getAbilityRangeForClub(level, options.clubStrength ?? 0.5);
        const caSpread = Math.max(1, abilityRange.maxCA - abilityRange.minCA);
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

        const overall = this.toOverall(trueCA);
        const pot = Math.max(overall, this.toOverall(truePA));

        const { value, wage } = this.getValueAndWage(overall, level, age);

        const id = customId || `p_${clubId}_${pos}_${Math.random().toString(36).substring(2, 8)}`;

        const ratingEngine = this.getRatingEngine();
        const hiddenAttributes = ratingEngine
            ? ratingEngine.generateHiddenAttributes({ age, overall })
            : { professionalism: 12, ambition: 12, consistency: 12, importantMatches: 12, injuryProneness: 8, adaptability: 12, loyalty: 14, temperament: 12 };

        const knownByUser = options.knownByUser === true;

        return Object.assign({
            id: id,
            name: `${firstName} ${lastName}`,
            age: age,
            nationality: nationality,
            pos: pos,
            secondPos: secondaryPositions[0] || null,
            positions: secondaryPositions,
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
            // Feldnamen identisch zu den handgepflegten Vereinen aus initialData.js -
            // sonst greifen Aufstellungs- und Sperrprüfungen ins Leere.
            injured: false,
            injuredWeeks: 0,
            injuryWeeks: 0,
            injuryName: null,
            suspended: false,
            suspendedMatches: 0,
            yellowCards: 0,
            yellowCardsTotal: 0,
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
                known: knownByUser,
                knowledgeLevel: knownByUser ? 90 : 25,
                lastScoutedDate: knownByUser ? "Saisonstart" : null,
                reportsCount: 0,
                accuracy: knownByUser ? 90 : 25
            },
            happiness: {
                overall: 75,
                playingTime: 75,
                contract: 75,
                teamPerformance: 75,
                training: 75,
                reason: "Zufrieden mit der aktuellen Situation."
            }
        }, this.generateAttributes(pos, overall));
    }

    /**
     * Erzeugt ein Attributprofil passend zu Position und Gesamtstärke.
     *
     * Ohne diese Werte fällt die Match-Engine für jedes Attribut auf die
     * Gesamtstärke zurück - alle erzeugten Spieler spielen dann auf jeder
     * Position gleich gut und Scout- sowie Detailansichten bleiben leer.
     */
    static generateAttributes(pos, overall) {
        const jitter = (base, spread = 6) => Math.max(1, Math.min(99, Math.round(base + (Math.random() * 2 - 1) * spread)));
        const o = overall;

        if (pos === "TW") {
            return {
                reflexes: jitter(o + 2, 4),
                handling: jitter(o, 4),
                oneOnOne: jitter(o, 5),
                positioning: jitter(o, 4),
                kicking: jitter(o - 4, 8),
                pace: jitter(Math.min(o, 55), 8),
                shooting: jitter(20, 6),
                passing: jitter(o - 12, 8),
                dribbling: jitter(35, 8),
                defense: jitter(25, 6),
                physical: jitter(o - 3, 6),
                stamina: jitter(o - 4, 6),
                vision: jitter(o - 8, 7),
                technique: jitter(o - 8, 7)
            };
        }

        // Gewichtungen je Positionsgruppe: relativer Auf-/Abschlag zur Gesamtstärke
        const PROFILES = {
            IV: { defense: 6, physical: 5, positioning: 4, pace: -4, passing: -3, dribbling: -8, shooting: -18, vision: -6, technique: -5, stamina: 2 },
            LV: { defense: 3, pace: 5, stamina: 6, physical: 0, positioning: 1, passing: 0, dribbling: 1, shooting: -12, vision: -3, technique: 0 },
            RV: { defense: 3, pace: 5, stamina: 6, physical: 0, positioning: 1, passing: 0, dribbling: 1, shooting: -12, vision: -3, technique: 0 },
            DM: { defense: 5, passing: 3, stamina: 5, physical: 3, positioning: 3, vision: 1, technique: 0, dribbling: -3, pace: -3, shooting: -8 },
            ZM: { passing: 5, vision: 5, stamina: 5, technique: 3, defense: -1, dribbling: 1, physical: -1, positioning: 0, pace: -2, shooting: -3 },
            LM: { passing: 3, stamina: 6, pace: 4, dribbling: 3, technique: 2, vision: 2, defense: -4, physical: -3, positioning: -2, shooting: -4 },
            RM: { passing: 3, stamina: 6, pace: 4, dribbling: 3, technique: 2, vision: 2, defense: -4, physical: -3, positioning: -2, shooting: -4 },
            OM: { vision: 6, technique: 6, passing: 5, dribbling: 5, shooting: 2, pace: 1, defense: -16, physical: -8, positioning: -6, stamina: -1 },
            LA: { pace: 8, dribbling: 7, technique: 5, shooting: 2, vision: 0, passing: -1, defense: -20, physical: -8, positioning: -8, stamina: 0 },
            RA: { pace: 8, dribbling: 7, technique: 5, shooting: 2, vision: 0, passing: -1, defense: -20, physical: -8, positioning: -8, stamina: 0 },
            ST: { shooting: 8, pace: 4, physical: 4, dribbling: 2, technique: 2, vision: -1, passing: -4, defense: -22, positioning: -4, stamina: -1 }
        };

        const profile = PROFILES[pos] || PROFILES.ZM;
        const attrs = {};
        ["pace", "shooting", "passing", "dribbling", "defense", "physical", "stamina", "vision", "technique", "positioning"].forEach(key => {
            attrs[key] = jitter(o + (profile[key] || 0), 5);
        });

        // Feldspieler brauchen die Torwartwerte nur als Notnagel
        attrs.reflexes = jitter(20, 6);
        attrs.handling = jitter(20, 6);
        attrs.oneOnOne = jitter(20, 6);
        attrs.kicking = jitter(o - 20, 8);

        return attrs;
    }

    /**
     * Erzeugt einen kompletten Kader für einen Verein
     */
    static generateSquad(clubId, level = 1, squadSize = 22, options = {}) {
        const squad = [];
        const distribution = this.SQUAD_DISTRIBUTION.slice(0, squadSize);

        distribution.forEach((pos, idx) => {
            const player = this.generatePlayer(clubId, level, pos, `p_${clubId}_${idx + 1}`, options);
            squad.push(player);
        });

        // Innerhalb des Kaders gibt es Stammspieler und Ergänzung: die
        // Startelf ist im Schnitt etwas stärker als die hinteren Plätze.
        squad.sort((a, b) => b.overall - a.overall);
        squad.forEach((p, idx) => {
            p.squadRole = idx < 4 ? "Schlüsselspieler"
                : idx < 11 ? "Stammspieler"
                : idx < 16 ? "Rotationsspieler"
                : (p.age <= 21 ? "Zukunftstalent" : "Ergänzungsspieler");
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

        const overall = this.toOverall(baseCA);
        const pot = Math.max(overall, this.toOverall(truePA));

        return {
            id: `youth_${clubId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: `${firstName} ${lastName}`,
            age: age,
            nationality: "Deutschland",
            pos: pos,
            secondPos: (this.getPositionEngine()?.generateSecondaryPositions(pos) || [])[0] || null,
            positions: this.getPositionEngine()?.generateSecondaryPositions(pos) || [],
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
