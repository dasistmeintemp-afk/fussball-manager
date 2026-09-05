/**
 * ClubGenerator - Erzeugt Vereine für alle Ligen der Spielwelt
 *
 * Die Vereine sind frei erfunden, folgen aber den Namensmustern ihres Landes:
 * In England spielen "Rovers" und "Wanderers", in Spanien "Real" und
 * "Deportivo", in Italien "AC" und "Calcio". Stadiongröße, Etat und Ruf
 * richten sich nach Ligastufe und Position innerhalb der Liga.
 */

class ClubGenerator {
    static PRIMARY_COLORS = ["#dc2626", "#2563eb", "#16a34a", "#eab308", "#111827", "#7c3aed", "#0284c7", "#ea580c", "#059669", "#4f46e5", "#be123c", "#0f766e"];
    static SECONDARY_COLORS = ["#ffffff", "#000000", "#fbbf24", "#94a3b8", "#cbd5e1", "#f87171", "#60a5fa"];

    /** Ruf-Bandbreiten je Ligastufe: [Minimum, Spannweite] */
    static REPUTATION_BANDS = {
        1: [60, 32],
        2: [47, 16],
        3: [37, 13],
        4: [27, 11],
        5: [19, 9],
        6: [13, 7],
        7: [7, 6]
    };

    static getPool(countryId) {
        const pools = (typeof COUNTRY_NAME_POOLS !== "undefined" && COUNTRY_NAME_POOLS)
            ? COUNTRY_NAME_POOLS
            : ((typeof window !== "undefined" && window.COUNTRY_NAME_POOLS)
                ? window.COUNTRY_NAME_POOLS
                : (typeof require !== "undefined" ? require("../data/countryNamePools.js").COUNTRY_NAME_POOLS : null));

        if (!pools) return null;
        return pools[countryId] || pools.de;
    }

    static pick(list, fallback = "") {
        if (!Array.isArray(list) || list.length === 0) return fallback;
        return list[Math.floor(Math.random() * list.length)];
    }

    /**
     * Erzeugt einen Vereinsnamen im Stil des Landes.
     * usedNames verhindert Dubletten innerhalb einer Spielwelt.
     */
    static generateClubName(countryId, city, usedNames = null) {
        const pool = this.getPool(countryId);
        if (!pool) return `FC ${city}`;

        for (let attempt = 0; attempt < 25; attempt++) {
            let name;

            if (countryId === "en") {
                const suffix = this.pick(pool.clubSuffixes, "United");
                const prefix = this.pick(pool.clubPrefixes, "");
                name = prefix ? `${prefix} ${city} ${suffix}`.trim() : `${city} ${suffix}`;
            } else if (countryId === "de") {
                const prefix = this.pick(pool.clubPrefixes, "FC");
                const roll = Math.random();
                if (roll > 0.65) name = `${prefix} ${city}`;
                else if (roll > 0.35) name = `${city}er ${prefix}`;
                else name = `${prefix} ${city} 19${10 + Math.floor(Math.random() * 89)}`;
            } else {
                const prefix = this.pick(pool.clubPrefixes, "FC");
                name = Math.random() > 0.25 ? `${prefix} ${city}` : `${city} ${prefix}`;
            }

            if (!usedNames || !usedNames.has(name)) {
                if (usedNames) usedNames.add(name);
                return name;
            }
        }

        const unique = `${this.pick(pool.clubPrefixes, "FC")} ${city} ${Math.floor(Math.random() * 90) + 10}`;
        if (usedNames) usedNames.add(unique);
        return unique;
    }

    /**
     * Stadionkapazität: Ligastufe gibt die Bandbreite vor, der Ruf des
     * Vereins entscheidet, wo er darin landet.
     */
    static generateStadium(cityName, level = 1, clubStrength = 0.5, countryId = "de") {
        const RANGES = {
            1: [26000, 82000],
            2: [12000, 42000],
            3: [6000, 22000],
            4: [3000, 12000],
            5: [1500, 6000],
            6: [800, 3000],
            7: [400, 1600]
        };
        const [min, max] = RANGES[level] || [1000, 4000];
        const s = Math.max(0, Math.min(1, clubStrength));
        const capacity = Math.round(min + (max - min) * (s * 0.75 + Math.random() * 0.25));

        const pool = this.getPool(countryId);
        const suffix = this.pick(pool ? pool.stadiumSuffixes : ["-Stadion"], "-Stadion");

        return { stadium: `${cityName}${suffix}`, stadiumCapacity: capacity };
    }

    /**
     * Etat nach Ligastufe und Ruf. Der Faktor sorgt dafür, dass der
     * Meisterschaftsanwärter einer Liga ein Vielfaches des Aufsteigers hat.
     */
    static generateFinances(level = 1, clubStrength = 0.5) {
        const BASE = {
            1: { transfer: 8000000, wage: 900000, balance: 14000000 },
            2: { transfer: 1500000, wage: 220000, balance: 3500000 },
            3: { transfer: 400000, wage: 70000, balance: 1000000 },
            4: { transfer: 90000, wage: 22000, balance: 260000 },
            5: { transfer: 25000, wage: 8000, balance: 90000 },
            6: { transfer: 9000, wage: 3500, balance: 40000 },
            7: { transfer: 3000, wage: 1600, balance: 18000 }
        };
        const base = BASE[level] || BASE[5];
        const s = Math.max(0, Math.min(1, clubStrength));
        // 0,45x für den Schlusslicht-Etat, 3,2x für den Spitzenklub
        const factor = 0.45 + Math.pow(s, 1.4) * 2.75;
        const jitter = 0.88 + Math.random() * 0.24;

        return {
            transferBudget: Math.round(base.transfer * factor * jitter),
            wageBudget: Math.round(base.wage * factor * jitter),
            balance: Math.round(base.balance * factor * jitter)
        };
    }

    /** Ruf eines Vereins aus Ligastufe, Rangfolge und Landesstärke */
    static calculateReputation(level = 1, clubStrength = 0.5, countryReputation = 88) {
        const [min, span] = this.REPUTATION_BANDS[level] || [15, 8];
        const s = Math.max(0, Math.min(1, clubStrength));
        const countryBonus = level === 1 ? Math.round((countryReputation - 86) / 3) : 0;
        return Math.max(1, Math.min(99, Math.round(min + span * s) + countryBonus));
    }

    /**
     * Erzeugt einen kompletten Verein
     */
    static generateClub(options = {}) {
        const countryId = options.countryId || "de";
        const leagueId = options.leagueId || "de_liga_1";
        const level = options.level || 1;
        const clubStrength = options.clubStrength ?? 0.5;
        const pool = this.getPool(countryId);

        const city = options.city || this.pick(pool ? pool.cities : [], "Neustadt");
        const name = options.name || this.generateClubName(countryId, city, options.usedNames);
        const stadiumData = this.generateStadium(city, level, clubStrength, countryId);
        const finances = this.generateFinances(level, clubStrength);
        const reputation = this.calculateReputation(level, clubStrength, options.countryReputation ?? 88);

        const primaryColor = this.pick(this.PRIMARY_COLORS, "#2563eb");
        let secondaryColor = this.pick(this.SECONDARY_COLORS, "#ffffff");
        if (secondaryColor === primaryColor) secondaryColor = "#ffffff";

        // Erwartungshaltung des Vorstands passt zur Platzierung in der Liga
        let boardExpectation;
        if (clubStrength >= 0.85) boardExpectation = level === 1 ? "championship" : "promotion";
        else if (clubStrength >= 0.6) boardExpectation = "top3";
        else if (clubStrength >= 0.3) boardExpectation = "midfield";
        else boardExpectation = "avoid_relegation";

        const clubId = options.id || `${options.code || "gen"}_${Math.random().toString(36).substring(2, 7)}`;

        return {
            id: clubId,
            name: name,
            city: city,
            region: options.region || "Zentral",
            countryId: countryId,
            leagueId: leagueId,
            level: level,
            tier: level <= 3 ? "professional" : level <= 4 ? "semi-pro" : "amateur",
            stadium: stadiumData.stadium,
            stadiumCapacity: stadiumData.stadiumCapacity,
            capacity: stadiumData.stadiumCapacity,
            reputation: reputation,
            fanBase: Math.round(stadiumData.stadiumCapacity * (3 + Math.random() * 6)),
            primaryColor: primaryColor,
            secondaryColor: secondaryColor,
            transferBudget: finances.transferBudget,
            wageBudget: finances.wageBudget,
            balance: finances.balance,
            ticketPrice: Math.max(6, Math.round((reputation / 2.2) + Math.random() * 8)),
            boardExpectation: boardExpectation,
            formation: this.pick(["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "5-3-2"], "4-3-3"),
            tactics: {
                mentality: "balanced",
                pressing: "medium",
                tempo: "normal",
                passStyle: "mixed",
                passing: "mixed",
                attackFocus: "balanced",
                defensiveLine: "medium",
                risk: "normal"
            },
            roles: { captain: null, penaltyTaker: null, freeKickTaker: null, cornerTaker: null },
            trainingFocus: "allround",
            lineup: [],
            bench: [],
            playerIds: [],
            form: ["-", "-", "-", "-", "-"],
            fanMood: Math.round(60 + clubStrength * 25),
            facilities: {
                stadium: Math.max(1, Math.min(5, 6 - level)),
                trainingGround: Math.max(1, Math.min(5, 6 - level)),
                youthCenter: Math.max(1, Math.min(5, 6 - level)),
                medicalCenter: Math.max(1, Math.min(5, 6 - level))
            },
            youthAcademy: {
                prospects: [],
                level: Math.max(1, Math.min(5, 6 - level))
            }
        };
    }

    /**
     * Erzeugt N Vereine für eine Liga. Die Vereine bekommen eine absteigende
     * Stärkeleiter, damit die Liga eine glaubwürdige Hierarchie hat.
     */
    static generateClubsForLeague(league, count = null, options = {}) {
        const total = count || league.teamCount || 18;
        const usedNames = options.usedNames || new Set();
        const usedCities = options.usedCities || new Set();
        const startIndex = options.startIndex || 0;
        const pool = this.getPool(league.countryId || "de");
        const clubs = [];

        for (let i = 0; i < total; i++) {
            // Stärkeleiter von 1 (Spitzenreiter) bis 0 (Schlusslicht), leicht verrauscht
            const ladder = total > 1 ? 1 - (i / (total - 1)) : 0.5;
            const clubStrength = Math.max(0, Math.min(1, ladder + (Math.random() - 0.5) * 0.12));

            let city = this.pick(pool ? pool.cities : [], "Neustadt");
            for (let attempt = 0; attempt < 12 && usedCities.has(city); attempt++) {
                city = this.pick(pool ? pool.cities : [], "Neustadt");
            }
            usedCities.add(city);

            const index = startIndex + i + 1;
            clubs.push(this.generateClub({
                countryId: league.countryId || "de",
                countryReputation: options.countryReputation ?? 88,
                leagueId: league.id,
                level: league.level || 1,
                region: league.region || "Zentral",
                clubStrength: clubStrength,
                city: city,
                usedNames: usedNames,
                code: league.code || "gen",
                id: `${league.code || "gen"}_${String(index).padStart(2, "0")}`
            }));
        }

        return clubs;
    }
}

if (typeof window !== "undefined") {
    window.ClubGenerator = ClubGenerator;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { ClubGenerator };
}
