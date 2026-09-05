/**
 * Liga-Definitionen, Ligapyramide, Pokale und europäische Wettbewerbe
 */

let COUNTRIES_DATA = [
    { id: "de", name: "Deutschland", code: "GER", flag: "🇩🇪", reputation: 88 },
    { id: "en", name: "England", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", reputation: 95 },
    { id: "es", name: "Spanien", code: "ESP", flag: "🇪🇸", reputation: 90 },
    { id: "it", name: "Italien", code: "ITA", flag: "🇮🇹", reputation: 86 },
    { id: "fr", name: "Frankreich", code: "FRA", flag: "🇫🇷", reputation: 84 }
];

const LEAGUES_DATA = [
    // --- TOP 5 LIGEN (Level 1) ---
    {
        id: "de_liga_1",
        code: "de1",
        name: "Deutschland Liga 1",
        countryId: "de",
        shortName: "Bundesliga",
        level: 1,
        tier: "professional",
        teamCount: 18,
        matchdays: 34,
        pointsPerWin: 3,
        pointsPerDraw: 1,
        pointsPerLoss: 0,
        europeanSpots: {
            championsLeague: [1, 2, 3, 4],
            europaLeague: [5],
            conferenceLeague: [6]
        },
        relegationTo: ["de_liga_2"],
        relegationSpots: [17, 18],
        relegationPlayoff: [16]
    },
    {
        id: "en_liga_1",
        code: "en1",
        name: "England Liga 1",
        countryId: "en",
        shortName: "Premier League",
        level: 1,
        tier: "professional",
        teamCount: 20,
        matchdays: 38,
        pointsPerWin: 3,
        pointsPerDraw: 1,
        pointsPerLoss: 0,
        europeanSpots: {
            championsLeague: [1, 2, 3, 4],
            europaLeague: [5],
            conferenceLeague: [6]
        },
        relegationTo: ["en_liga_2"],
        relegationSpots: [18, 19, 20],
        relegationPlayoff: []
    },
    {
        id: "es_liga_1",
        code: "es1",
        name: "Spanien Liga 1",
        countryId: "es",
        shortName: "La Liga",
        level: 1,
        tier: "professional",
        teamCount: 20,
        matchdays: 38,
        pointsPerWin: 3,
        pointsPerDraw: 1,
        pointsPerLoss: 0,
        europeanSpots: {
            championsLeague: [1, 2, 3, 4],
            europaLeague: [5],
            conferenceLeague: [6]
        },
        relegationTo: ["es_liga_2"],
        relegationSpots: [18, 19, 20],
        relegationPlayoff: []
    },
    {
        id: "it_liga_1",
        code: "it1",
        name: "Italien Liga 1",
        countryId: "it",
        shortName: "Serie A",
        level: 1,
        tier: "professional",
        teamCount: 20,
        matchdays: 38,
        pointsPerWin: 3,
        pointsPerDraw: 1,
        pointsPerLoss: 0,
        europeanSpots: {
            championsLeague: [1, 2, 3, 4],
            europaLeague: [5],
            conferenceLeague: [6]
        },
        relegationTo: ["it_liga_2"],
        relegationSpots: [18, 19, 20],
        relegationPlayoff: []
    },
    {
        id: "fr_liga_1",
        code: "fr1",
        name: "Frankreich Liga 1",
        countryId: "fr",
        shortName: "Ligue 1",
        level: 1,
        tier: "professional",
        teamCount: 18,
        matchdays: 34,
        pointsPerWin: 3,
        pointsPerDraw: 1,
        pointsPerLoss: 0,
        europeanSpots: {
            championsLeague: [1, 2, 3],
            europaLeague: [4],
            conferenceLeague: [5]
        },
        relegationTo: ["fr_liga_2"],
        relegationSpots: [17, 18],
        relegationPlayoff: [16]
    },

    // --- DEUTSCHE LIGAPYRAMIDE (Level 2 - 7) ---
    {
        id: "de_liga_2",
        code: "de2",
        name: "Deutschland Liga 2",
        countryId: "de",
        shortName: "2. Bundesliga",
        level: 2,
        tier: "professional",
        teamCount: 18,
        matchdays: 34,
        promotionTo: "de_liga_1",
        promotionSpots: [1, 2],
        promotionPlayoff: [3],
        relegationTo: ["de_liga_3"],
        relegationSpots: [17, 18],
        relegationPlayoff: [16]
    },
    {
        id: "de_liga_3",
        code: "de3",
        name: "Deutschland Liga 3",
        countryId: "de",
        shortName: "3. Liga",
        level: 3,
        tier: "professional",
        teamCount: 20,
        matchdays: 38,
        promotionTo: "de_liga_2",
        promotionSpots: [1, 2],
        promotionPlayoff: [3],
        relegationTo: ["de_rl_nord", "de_rl_nordost", "de_rl_west", "de_rl_suedwest", "de_rl_bayern"],
        relegationSpots: [17, 18, 19, 20]
    },
    {
        id: "de_rl_west",
        code: "rlw",
        name: "Regionalliga West",
        countryId: "de",
        shortName: "Regionalliga West",
        level: 4,
        tier: "semi-pro",
        region: "West",
        teamCount: 18,
        matchdays: 34,
        promotionTo: "de_liga_3",
        promotionSpots: [1],
        relegationSpots: [15, 16, 17, 18]
    },
    {
        id: "de_rl_bayern",
        code: "rlb",
        name: "Regionalliga Bayern",
        countryId: "de",
        shortName: "Regionalliga Bayern",
        level: 4,
        tier: "semi-pro",
        region: "Süd",
        teamCount: 18,
        matchdays: 34,
        promotionTo: "de_liga_3",
        promotionSpots: [1],
        relegationSpots: [15, 16, 17, 18]
    },
    {
        id: "de_ol_nord",
        code: "oln",
        name: "Oberliga Nord",
        countryId: "de",
        shortName: "Oberliga Nord",
        level: 5,
        tier: "amateur",
        region: "Nord",
        teamCount: 16,
        matchdays: 30,
        promotionTo: "de_rl_west",
        promotionSpots: [1],
        relegationSpots: [14, 15, 16]
    },
    {
        id: "de_vl_1",
        code: "vl1",
        name: "Verbandsliga",
        countryId: "de",
        shortName: "Verbandsliga",
        level: 6,
        tier: "amateur",
        region: "Zentral",
        teamCount: 16,
        matchdays: 30,
        promotionTo: "de_ol_nord",
        promotionSpots: [1],
        relegationSpots: [14, 15, 16]
    },
    {
        id: "de_ll_1",
        code: "ll1",
        name: "Landesliga",
        countryId: "de",
        shortName: "Landesliga",
        level: 7,
        tier: "amateur",
        region: "Lokal",
        teamCount: 16,
        matchdays: 30,
        promotionTo: "de_vl_1",
        promotionSpots: [1],
        relegationSpots: [14, 15, 16]
    }
];

const COMPETITIONS_DATA = [
    // NATIONALE POKALE
    {
        id: "de_cup",
        name: "Deutschland Pokal",
        countryId: "de",
        type: "cup",
        shortName: "Nationaler Pokal",
        rounds: ["Runde 1", "Runde 2", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]
    },
    {
        id: "en_cup",
        name: "England Pokal",
        countryId: "en",
        type: "cup",
        shortName: "England Cup",
        rounds: ["Runde 1", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]
    },
    {
        id: "es_cup",
        name: "Spanien Pokal",
        countryId: "es",
        type: "cup",
        shortName: "Copa National",
        rounds: ["Runde 1", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]
    },
    {
        id: "it_cup",
        name: "Italien Pokal",
        countryId: "it",
        type: "cup",
        shortName: "Coppa National",
        rounds: ["Runde 1", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]
    },
    {
        id: "fr_cup",
        name: "Frankreich Pokal",
        countryId: "fr",
        type: "cup",
        shortName: "Coupe National",
        rounds: ["Runde 1", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]
    },

    // EUROPÄISCHE WETTBEWERBE
    {
        id: "ucl",
        name: "Champions League",
        type: "continental",
        region: "Europe",
        shortName: "Champions Cup",
        format: "group_and_knockout",
        groupsCount: 8,
        teamsPerGroup: 4,
        rounds: ["Gruppenphase", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]
    },
    {
        id: "uel",
        name: "Europa League",
        type: "continental",
        region: "Europe",
        shortName: "Europa Cup",
        format: "group_and_knockout",
        groupsCount: 8,
        teamsPerGroup: 4,
        rounds: ["Gruppenphase", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]
    },
    {
        id: "uecl",
        name: "Conference League",
        type: "continental",
        region: "Europe",
        shortName: "Conference Cup",
        format: "group_and_knockout",
        groupsCount: 8,
        teamsPerGroup: 4,
        rounds: ["Gruppenphase", "Achtelfinale", "Viertelfinale", "Halbfinale", "Finale"]
    }
];

if (typeof window !== "undefined") {
    window.COUNTRIES_DATA = COUNTRIES_DATA;
    window.LEAGUES_DATA = LEAGUES_DATA;
    window.COMPETITIONS_DATA = COMPETITIONS_DATA;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { COUNTRIES_DATA, LEAGUES_DATA, COMPETITIONS_DATA };
}
