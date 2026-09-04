/**
 * ClubGenerator - Erzeugt fiktive und generische Vereine für untere Ligen und internationale Wettbewerbe
 */

class ClubGenerator {
    static CITY_PREFIXES = ["Nord", "Süd", "Ost", "West", "Bad", "Groß", "Neu", "Alt", "Ober", "Nieder"];
    static CITY_SUFFIXES = ["burg", "stadt", "heim", "hausen", "berg", "dorf", "furt", "brück", "felde", "tal", "kirchen", "ingen"];
    static CLUB_PREFIXES = ["FC", "SV", "SC", "VfB", "SpVgg", "TuS", "TSV", "FV", "VfL", "1. FC", "Borussia", "Eintracht", "Viktoria", "Fortuna", "Union", "Rot-Weiß", "Blau-Weiß", "Teutonia"];
    static STADIUM_SUFFIXES = ["-Stadion", "-Arena", "-Park", " Kampfbahn", " Sportpark", " Waldstadion", " Jahnstadion", " Am Stadtpark"];

    static PRIMARY_COLORS = ["#dc2626", "#2563eb", "#16a34a", "#eab308", "#000000", "#7c3aed", "#0284c7", "#ea580c", "#059669", "#4f46e5"];
    static SECONDARY_COLORS = ["#ffffff", "#000000", "#fbbf24", "#94a3b8", "#cbd5e1", "#f87171", "#60a5fa"];

    /**
     * Generiert einen Stadtnamen
     */
    static generateCityName() {
        const p = this.CITY_PREFIXES[Math.floor(Math.random() * this.CITY_PREFIXES.length)];
        const s = this.CITY_SUFFIXES[Math.floor(Math.random() * this.CITY_SUFFIXES.length)];
        const bases = ["München", "Berlin", "Hamburg", "Köln", "Frankfurt", "Stuttgart", "Leipzig", "Dortmund", "Essen", "Bremen", "Hannover", "Nürnberg", "Duisburg", "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster", "Karlsruhe", "Mannheim", "Augsburg", "Wiesbaden", "Mönchengladbach", "Gelsenkirchen", "Braunschweig", "Kiel", "Chemnitz", "Halle", "Magdeburg", "Freiburg", "Krefeld", "Mainz", "Lübeck", "Erfurt", "Rostock", "Kassel", "Hagen", "Potsdam", "Saarbrücken", "Hamm", "Mülheim", "Ludwigshafen", "Oldenburg", "Osnabrück", "Leverkusen", "Heidelberg", "Darmstadt", "Solingen", "Herne", "Neuss", "Regensburg", "Paderborn", "Ingolstadt", "Offenbach", "Fürth", "Ulm", "Heilbronn", "Pforzheim", "Wolfsburg", "Göttingen", "Bottrop", "Reutlingen", "Koblenz", "Bremerhaven", "Bergisch Gladbach", "Jena", "Remscheid", "Erlangen", "Moers", "Siegen", "Hildesheim", "Salzgitter", "Kaiserslautern", "Gütersloh", "Schwerin", "Witten", "Gera", "Iserlohn", "Ludwigsburg", "Hanau", "Esslingen", "Zwickau", "Düren", "Ratingen", "Tübingen", "Flensburg", "Lünen", "Villingen", "Gießen", "Marl", "Dessau", "Worms", "Konstanz", "Minden", "Velbert", "Norderstedt", "Celle", "Dorsten", "Aschaffenburg", "Kempten", "Landshut", "Bamberg", "Bayreuth", "Schweinfurt", "Passau", "Straubing", "Rosenheim", "Hof", "Coburg", "Weiden", "Amberg", "Ansbach", "Memmingen", "Kaufbeuren"];
        
        if (Math.random() > 0.4) {
            return bases[Math.floor(Math.random() * bases.length)];
        }
        return p + s;
    }

    /**
     * Generiert einen Vereinsnamen
     */
    static generateClubName(city) {
        const p = this.CLUB_PREFIXES[Math.floor(Math.random() * this.CLUB_PREFIXES.length)];
        const c = city || this.generateCityName();
        const rand = Math.random();
        if (rand > 0.6) {
            return `${p} ${c}`;
        } else if (rand > 0.3) {
            return `${c} ${p}`;
        } else {
            return `${p} ${c} 0${Math.floor(Math.random() * 9) + 1}`;
        }
    }

    /**
     * Erzeugt Stadionkapazität und Namen je nach Level
     */
    static generateStadium(cityName, level = 1) {
        let capacity = 50000;
        let suffix = this.STADIUM_SUFFIXES[Math.floor(Math.random() * this.STADIUM_SUFFIXES.length)];
        
        switch (level) {
            case 1: capacity = 30000 + Math.floor(Math.random() * 45000); break;
            case 2: capacity = 15000 + Math.floor(Math.random() * 25000); break;
            case 3: capacity = 8000 + Math.floor(Math.random() * 12000); break;
            case 4: capacity = 4000 + Math.floor(Math.random() * 8000); break; // Regionalliga
            case 5: capacity = 2000 + Math.floor(Math.random() * 4000); break; // Oberliga
            case 6: capacity = 1000 + Math.floor(Math.random() * 2000); break; // Verbandsliga
            case 7: capacity = 500 + Math.floor(Math.random() * 1200); break;  // Landesliga
            default: capacity = 1000 + Math.floor(Math.random() * 2000); break;
        }

        const stadiumName = `${cityName}${suffix}`;
        return { stadium: stadiumName, stadiumCapacity: capacity };
    }

    /**
     * Generiert Finanzen nach Ligastufe
     */
    static generateFinances(level = 1) {
        let transferBudget = 5000000;
        let wageBudget = 10000000;
        let balance = 8000000;

        switch (level) {
            case 1:
                transferBudget = 10000000 + Math.floor(Math.random() * 40000000);
                wageBudget = 25000000 + Math.floor(Math.random() * 60000000);
                balance = 15000000 + Math.floor(Math.random() * 30000000);
                break;
            case 2:
                transferBudget = 1500000 + Math.floor(Math.random() * 5000000);
                wageBudget = 6000000 + Math.floor(Math.random() * 12000000);
                balance = 3000000 + Math.floor(Math.random() * 6000000);
                break;
            case 3:
                transferBudget = 300000 + Math.floor(Math.random() * 1000000);
                wageBudget = 2000000 + Math.floor(Math.random() * 3500000);
                balance = 800000 + Math.floor(Math.random() * 1500000);
                break;
            case 4: // Regionalliga
                transferBudget = 50000 + Math.floor(Math.random() * 200000);
                wageBudget = 600000 + Math.floor(Math.random() * 1000000);
                balance = 200000 + Math.floor(Math.random() * 400000);
                break;
            case 5: // Oberliga
                transferBudget = 15000 + Math.floor(Math.random() * 50000);
                wageBudget = 200000 + Math.floor(Math.random() * 400000);
                balance = 80000 + Math.floor(Math.random() * 150000);
                break;
            case 6: // Verbandsliga
                transferBudget = 5000 + Math.floor(Math.random() * 20000);
                wageBudget = 80000 + Math.floor(Math.random() * 150000);
                balance = 30000 + Math.floor(Math.random() * 70000);
                break;
            case 7: // Landesliga
                transferBudget = 1000 + Math.floor(Math.random() * 10000);
                wageBudget = 30000 + Math.floor(Math.random() * 60000);
                balance = 10000 + Math.floor(Math.random() * 30000);
                break;
            default:
                break;
        }

        return { transferBudget, wageBudget, balance };
    }

    /**
     * Erzeugt einen kompletten Verein
     */
    static generateClub(countryId = "de", leagueId = "de_liga_1", level = 1, region = "Nord", id = null) {
        const city = this.generateCityName();
        const name = this.generateClubName(city);
        const stadiumData = this.generateStadium(city, level);
        const finances = this.generateFinances(level);

        const primaryColor = this.PRIMARY_COLORS[Math.floor(Math.random() * this.PRIMARY_COLORS.length)];
        let secondaryColor = this.SECONDARY_COLORS[Math.floor(Math.random() * this.SECONDARY_COLORS.length)];
        if (secondaryColor === primaryColor) secondaryColor = "#ffffff";

        const expectations = level === 1 ? ["championship", "top3", "midfield", "avoid_relegation"] : ["promotion", "top3", "midfield", "avoid_relegation"];
        const boardExpectation = expectations[Math.floor(Math.random() * expectations.length)];

        const clubId = id || `club_${countryId}_${leagueId}_${Math.random().toString(36).substring(2, 7)}`;

        return {
            id: clubId,
            name: name,
            city: city,
            region: region,
            countryId: countryId,
            leagueId: leagueId,
            level: level,
            tier: level <= 3 ? "professional" : level <= 4 ? "semi-pro" : "amateur",
            stadium: stadiumData.stadium,
            stadiumCapacity: stadiumData.stadiumCapacity,
            primaryColor: primaryColor,
            secondaryColor: secondaryColor,
            transferBudget: finances.transferBudget,
            wageBudget: finances.wageBudget,
            balance: finances.balance,
            boardExpectation: boardExpectation,
            formation: "4-3-3",
            tactics: {
                mentality: "balanced",
                pressing: "medium",
                tempo: "normal",
                passStyle: "mixed",
                attackFocus: "balanced",
                defensiveLine: "medium",
                risk: "normal"
            },
            lineup: [],
            bench: [],
            playerIds: [],
            form: ["-", "-", "-", "-", "-"],
            fanMood: 70 + Math.floor(Math.random() * 20),
            facilities: {
                stadiumLevel: Math.max(1, 8 - level),
                trainingGroundLevel: Math.max(1, 8 - level),
                youthAcademyLevel: Math.max(1, 8 - level),
                medicalCenterLevel: Math.max(1, 8 - level)
            }
        };
    }

    /**
     * Erzeugt N Vereine für eine Liga
     */
    static generateClubsForLeague(league, count = 18) {
        const clubs = [];
        for (let i = 0; i < count; i++) {
            const club = this.generateClub(league.countryId || "de", league.id, league.level || 1, league.region || "Zentral");
            clubs.push(club);
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
