/**
 * GameState - Zentrales State Management, Spielstand-Wartung und präzise Formations-Konfiguration
 */

let FORMATION_CONFIGS = {
    "4-4-2": {
        name: "4-4-2 Standard",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "RM", role: "Rechtes Mittelfeld", x: 85, y: 45 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld", x: 62, y: 48 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld", x: 38, y: 48 },
            { id: 8, pos: "LM", role: "Linkes Mittelfeld", x: 15, y: 45 },
            { id: 9, pos: "ST", role: "Stürmer rechts", x: 62, y: 20 },
            { id: 10, pos: "ST", role: "Stürmer links", x: 38, y: 20 }
        ]
    },
    "4-4-2 Raute": {
        name: "4-4-2 Raute",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "ZDM", role: "Defensives Mittelfeld", x: 50, y: 58 },
            { id: 6, pos: "RZM", role: "Rechtes zentrales Mittelfeld", x: 70, y: 46 },
            { id: 7, pos: "LZM", role: "Linkes zentrales Mittelfeld", x: 30, y: 46 },
            { id: 8, pos: "ZOM", role: "Zentrales offensives Mittelfeld", x: 50, y: 34 },
            { id: 9, pos: "ST", role: "Stürmer rechts", x: 62, y: 19 },
            { id: 10, pos: "ST", role: "Stürmer links", x: 38, y: 19 }
        ]
    },
    "4-3-3": {
        name: "4-3-3 Offensiv",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "ZDM", role: "Defensives Mittelfeld", x: 50, y: 55 },
            { id: 6, pos: "RZM", role: "Rechtes zentrales Mittelfeld", x: 68, y: 42 },
            { id: 7, pos: "LZM", role: "Linkes zentrales Mittelfeld", x: 32, y: 42 },
            { id: 8, pos: "RA", role: "Rechtsaußen", x: 82, y: 22 },
            { id: 9, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 },
            { id: 10, pos: "LA", role: "Linksaußen", x: 18, y: 22 }
        ]
    },
    "4-3-3 mit offensiverem Mittelfeld": {
        name: "4-3-3 Offensives Mittelfeld",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 68, y: 46 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld", x: 50, y: 42 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld links", x: 32, y: 46 },
            { id: 8, pos: "RA", role: "Rechtsaußen", x: 82, y: 22 },
            { id: 9, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 },
            { id: 10, pos: "LA", role: "Linksaußen", x: 18, y: 22 }
        ]
    },
    "4-2-3-1": {
        name: "4-2-3-1 Ausgewogen",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "ZDM", role: "Defensives Mittelfeld rechts", x: 62, y: 56 },
            { id: 6, pos: "ZDM", role: "Defensives Mittelfeld links", x: 38, y: 56 },
            { id: 7, pos: "RA", role: "Rechtsaußen", x: 80, y: 36 },
            { id: 8, pos: "ZOM", role: "Zentrales offensives Mittelfeld", x: 50, y: 34 },
            { id: 9, pos: "LA", role: "Linksaußen", x: 20, y: 36 },
            { id: 10, pos: "ST", role: "Stoßstürmer", x: 50, y: 18 }
        ]
    },
    "4-2-2-2": {
        name: "4-2-2-2 Doppel-Zehn",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "ZDM", role: "Defensives Mittelfeld rechts", x: 62, y: 56 },
            { id: 6, pos: "ZDM", role: "Defensives Mittelfeld links", x: 38, y: 56 },
            { id: 7, pos: "ROM", role: "Rechtes offensives Mittelfeld", x: 68, y: 36 },
            { id: 8, pos: "LOM", role: "Linkes offensives Mittelfeld", x: 32, y: 36 },
            { id: 9, pos: "ST", role: "Stürmer rechts", x: 62, y: 20 },
            { id: 10, pos: "ST", role: "Stürmer links", x: 38, y: 20 }
        ]
    },
    "4-1-4-1": {
        name: "4-1-4-1 Mittelfelddominanz",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "ZDM", role: "Defensives Mittelfeld", x: 50, y: 58 },
            { id: 6, pos: "RM", role: "Rechtes Mittelfeld", x: 84, y: 40 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 62, y: 38 },
            { id: 8, pos: "ZM", role: "Zentrales Mittelfeld links", x: 38, y: 38 },
            { id: 9, pos: "LM", role: "Linkes Mittelfeld", x: 16, y: 40 },
            { id: 10, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 }
        ]
    },
    "4-5-1": {
        name: "4-5-1 Kompakt",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "RM", role: "Rechtes Mittelfeld", x: 85, y: 45 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 66, y: 48 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld", x: 50, y: 50 },
            { id: 8, pos: "ZM", role: "Zentrales Mittelfeld links", x: 34, y: 48 },
            { id: 9, pos: "LM", role: "Linkes Mittelfeld", x: 15, y: 45 },
            { id: 10, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 }
        ]
    },
    "4-1-2-3": {
        name: "4-1-2-3 Asymmetrisch",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "ZDM", role: "Defensives Mittelfeld", x: 50, y: 58 },
            { id: 6, pos: "RZM", role: "Rechtes zentrales Mittelfeld", x: 66, y: 42 },
            { id: 7, pos: "LZM", role: "Linkes zentrales Mittelfeld", x: 34, y: 42 },
            { id: 8, pos: "RA", role: "Rechtsaußen", x: 82, y: 22 },
            { id: 9, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 },
            { id: 10, pos: "LA", role: "Linksaußen", x: 18, y: 22 }
        ]
    },
    "4-4-1-1": {
        name: "4-4-1-1 Hängende Spitze",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 85, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 62, y: 75 },
            { id: 3, pos: "IV", role: "Innenverteidiger links", x: 38, y: 75 },
            { id: 4, pos: "LV", role: "Linksverteidiger", x: 15, y: 72 },
            { id: 5, pos: "RM", role: "Rechtes Mittelfeld", x: 85, y: 45 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 62, y: 48 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld links", x: 38, y: 48 },
            { id: 8, pos: "LM", role: "Linkes Mittelfeld", x: 15, y: 45 },
            { id: 9, pos: "HS", role: "Hängende Spitze / ZOM", x: 50, y: 30 },
            { id: 10, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 }
        ]
    },
    "3-4-3": {
        name: "3-4-3 Offensiv",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "IV", role: "Rechter Innenverteidiger", x: 74, y: 75 },
            { id: 2, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 77 },
            { id: 3, pos: "IV", role: "Linker Innenverteidiger", x: 26, y: 75 },
            { id: 4, pos: "RAV", role: "Rechter Außenverteidiger / Schienenspieler", x: 88, y: 48 },
            { id: 5, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 62, y: 50 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld links", x: 38, y: 50 },
            { id: 7, pos: "LAV", role: "Linker Außenverteidiger / Schienenspieler", x: 12, y: 48 },
            { id: 8, pos: "RA", role: "Rechtsaußen", x: 80, y: 22 },
            { id: 9, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 },
            { id: 10, pos: "LA", role: "Linksaußen", x: 20, y: 22 }
        ]
    },
    "3-5-2": {
        name: "3-5-2 Kompakt",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "IV", role: "Rechter Innenverteidiger", x: 74, y: 75 },
            { id: 2, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 77 },
            { id: 3, pos: "IV", role: "Linker Innenverteidiger", x: 26, y: 75 },
            { id: 4, pos: "RAV", role: "Rechter Schienenspieler", x: 88, y: 48 },
            { id: 5, pos: "ZM", role: "Zentrales Mittelfeld", x: 66, y: 42 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld", x: 50, y: 58 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld", x: 34, y: 42 },
            { id: 8, pos: "LAV", role: "Linker Schienenspieler", x: 12, y: 48 },
            { id: 9, pos: "ST", role: "Stürmer rechts", x: 62, y: 20 },
            { id: 10, pos: "ST", role: "Stürmer links", x: 38, y: 20 }
        ]
    },
    "3-4-1-2": {
        name: "3-4-1-2 Offensiv",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "IV", role: "Rechter Innenverteidiger", x: 74, y: 75 },
            { id: 2, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 77 },
            { id: 3, pos: "IV", role: "Linker Innenverteidiger", x: 26, y: 75 },
            { id: 4, pos: "RAV", role: "Rechter Schienenspieler", x: 88, y: 48 },
            { id: 5, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 62, y: 50 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld links", x: 38, y: 50 },
            { id: 7, pos: "LAV", role: "Linker Schienenspieler", x: 12, y: 48 },
            { id: 8, pos: "ZOM", role: "Zentrales offensives Mittelfeld", x: 50, y: 34 },
            { id: 9, pos: "ST", role: "Stürmer rechts", x: 62, y: 20 },
            { id: 10, pos: "ST", role: "Stürmer links", x: 38, y: 20 }
        ]
    },
    "3-4-2-1": {
        name: "3-4-2-1 Modern",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "IV", role: "Rechter Innenverteidiger", x: 74, y: 75 },
            { id: 2, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 77 },
            { id: 3, pos: "IV", role: "Linker Innenverteidiger", x: 26, y: 75 },
            { id: 4, pos: "RAV", role: "Rechter Schienenspieler", x: 88, y: 55 },
            { id: 5, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 62, y: 50 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld links", x: 38, y: 50 },
            { id: 7, pos: "LAV", role: "Linker Schienenspieler", x: 12, y: 55 },
            { id: 8, pos: "HS", role: "Hängende Spitze rechts", x: 68, y: 32 },
            { id: 9, pos: "HS", role: "Hängende Spitze links", x: 32, y: 32 },
            { id: 10, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 }
        ]
    },
    "3-3-3-1": {
        name: "3-3-3-1 Taktisch",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "IV", role: "Rechter Innenverteidiger", x: 74, y: 75 },
            { id: 2, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 77 },
            { id: 3, pos: "IV", role: "Linker Innenverteidiger", x: 26, y: 75 },
            { id: 4, pos: "RV", role: "Rechter Außenverteidiger", x: 82, y: 56 },
            { id: 5, pos: "ZDM", role: "Defensives Mittelfeld", x: 50, y: 58 },
            { id: 6, pos: "LV", role: "Linker Außenverteidiger", x: 18, y: 56 },
            { id: 7, pos: "RA", role: "Rechtsaußen", x: 82, y: 34 },
            { id: 8, pos: "ZOM", role: "Zentrales offensives Mittelfeld", x: 50, y: 34 },
            { id: 9, pos: "LA", role: "Linksaußen", x: 18, y: 34 },
            { id: 10, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 }
        ]
    },
    "5-3-2": {
        name: "5-3-2 Defensiv",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 88, y: 70 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 68, y: 76 },
            { id: 3, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 78 },
            { id: 4, pos: "IV", role: "Innenverteidiger links", x: 32, y: 76 },
            { id: 5, pos: "LV", role: "Linksverteidiger", x: 12, y: 70 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 68, y: 44 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld", x: 50, y: 54 },
            { id: 8, pos: "ZM", role: "Zentrales Mittelfeld links", x: 32, y: 44 },
            { id: 9, pos: "ST", role: "Stürmer rechts", x: 62, y: 20 },
            { id: 10, pos: "ST", role: "Stürmer links", x: 38, y: 20 }
        ]
    },
    "5-4-1": {
        name: "5-4-1 Bollwerk",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 88, y: 68 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 68, y: 76 },
            { id: 3, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 78 },
            { id: 4, pos: "IV", role: "Innenverteidiger links", x: 32, y: 76 },
            { id: 5, pos: "LV", role: "Linksverteidiger", x: 12, y: 68 },
            { id: 6, pos: "RM", role: "Rechtes Mittelfeld", x: 82, y: 45 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 62, y: 48 },
            { id: 8, pos: "ZM", role: "Zentrales Mittelfeld links", x: 38, y: 48 },
            { id: 9, pos: "LM", role: "Linkes Mittelfeld", x: 18, y: 45 },
            { id: 10, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 }
        ]
    },
    "5-2-3": {
        name: "5-2-3 Konter",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 88, y: 70 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 68, y: 76 },
            { id: 3, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 78 },
            { id: 4, pos: "IV", role: "Innenverteidiger links", x: 32, y: 76 },
            { id: 5, pos: "LV", role: "Linksverteidiger", x: 12, y: 70 },
            { id: 6, pos: "ZDM", role: "Defensives Mittelfeld rechts", x: 62, y: 55 },
            { id: 7, pos: "ZDM", role: "Defensives Mittelfeld links", x: 38, y: 55 },
            { id: 8, pos: "RA", role: "Rechtsaußen", x: 82, y: 22 },
            { id: 9, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 },
            { id: 10, pos: "LA", role: "Linksaußen", x: 18, y: 22 }
        ]
    },
    "5-3-1-1": {
        name: "5-3-1-1 Defensiver Block",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechtsverteidiger", x: 88, y: 70 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 68, y: 76 },
            { id: 3, pos: "IV", role: "Zentraler Innenverteidiger", x: 50, y: 78 },
            { id: 4, pos: "IV", role: "Innenverteidiger links", x: 32, y: 76 },
            { id: 5, pos: "LV", role: "Linksverteidiger", x: 12, y: 70 },
            { id: 6, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 68, y: 44 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld", x: 50, y: 50 },
            { id: 8, pos: "ZM", role: "Zentrales Mittelfeld links", x: 32, y: 44 },
            { id: 9, pos: "HS", role: "Hängende Spitze / ZOM", x: 50, y: 30 },
            { id: 10, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 }
        ]
    },
    "6-3-1": {
        name: "6-3-1 Ultra-Defensiv",
        positions: [
            { id: 0, pos: "TW", role: "Torwart", x: 50, y: 92 },
            { id: 1, pos: "RV", role: "Rechter Außenverteidiger", x: 90, y: 72 },
            { id: 2, pos: "IV", role: "Innenverteidiger rechts", x: 74, y: 76 },
            { id: 3, pos: "IV", role: "Innenverteidiger halb-rechts", x: 58, y: 78 },
            { id: 4, pos: "IV", role: "Innenverteidiger halb-links", x: 42, y: 78 },
            { id: 5, pos: "IV", role: "Innenverteidiger links", x: 26, y: 76 },
            { id: 6, pos: "LV", role: "Linker Außenverteidiger", x: 10, y: 72 },
            { id: 7, pos: "ZM", role: "Zentrales Mittelfeld rechts", x: 68, y: 48 },
            { id: 8, pos: "ZM", role: "Zentrales Mittelfeld", x: 50, y: 52 },
            { id: 9, pos: "ZM", role: "Zentrales Mittelfeld links", x: 32, y: 48 },
            { id: 10, pos: "ST", role: "Mittelstürmer", x: 50, y: 18 }
        ]
    }
};

/**
 * Merkt sich die mitgelieferten Standardformationen, damit eigene Formationen
 * jederzeit sauber ergänzt oder wieder entfernt werden können.
 */
const BUILTIN_FORMATION_KEYS = Object.keys(FORMATION_CONFIGS);

class GameState {

    /** Um so viel muss eine andere Formation besser sein, damit umgestellt wird */
    static FORMATION_TOLERANZ = 0.004;

    /**
     * Abschlag je Platz in der Formationsliste: Je ungewoehnlicher ein System,
     * desto deutlicher muss sein Vorteil sein. Das 4-4-2 steht vorn, das 6-3-1
     * hinten; eigene Formationen zaehlen wie die Mitte der Liste.
     */
    static FORMATION_EXOTIK = 0.001;

    /**
     * Auflösung der PositionEngine in Browser- und Node-Umgebung
     */
    static _getPositionEngine() {
        return GameState._resolveEngine('PositionEngine', './positionEngine.js');
    }

    /**
     * Liefert eine Formationskonfiguration (Standard oder eigene) mit Fallback auf 4-4-2
     */
    static getFormationConfig(formationKey) {
        return FORMATION_CONFIGS[formationKey]
            || FORMATION_CONFIGS["4-4-2"]
            || { name: "4-4-2 Standard", positions: [] };
    }

    /**
     * Prüft, ob eine Formation vom Spieler selbst erstellt wurde
     */
    static isCustomFormation(formationKey) {
        return !BUILTIN_FORMATION_KEYS.includes(formationKey);
    }

    /**
     * Standardformationen (Reihenfolge der Auslieferung)
     */
    static getBuiltinFormationKeys() {
        return [...BUILTIN_FORMATION_KEYS];
    }

    /**
     * Validiert und normalisiert die Positionen einer (eigenen) Formation.
     * Erwartet 11 Slots, exakt einen Torwart und Koordinaten innerhalb des Feldes.
     */
    static normalizeFormationPositions(positions) {
        const posEngine = GameState._getPositionEngine();
        if (!Array.isArray(positions) || positions.length !== 11) {
            return { valid: false, error: "Eine Formation benötigt genau 11 Positionen." };
        }

        const normalized = positions.map((slot, idx) => {
            const x = Math.max(3, Math.min(97, Number(slot?.x)));
            const y = Math.max(3, Math.min(97, Number(slot?.y)));
            if (!isFinite(x) || !isFinite(y)) return null;

            let pos = slot?.pos;
            if (posEngine) {
                const manual = slot?.manualPos ? posEngine.normalizePosition(pos) : null;
                pos = manual || posEngine.detectPositionFromCoords(x, y);
            }
            pos = pos || "ZM";

            return {
                id: idx,
                pos,
                manualPos: !!slot?.manualPos,
                role: slot?.role || (posEngine?.POSITION_META?.[pos]?.name) || pos,
                x: Math.round(x * 10) / 10,
                y: Math.round(y * 10) / 10
            };
        });

        if (normalized.some(s => s === null)) {
            return { valid: false, error: "Ungültige Koordinaten in der Formation." };
        }

        const keepers = normalized.filter(s => s.pos === "TW");
        if (keepers.length !== 1) {
            return { valid: false, error: "Eine Formation braucht genau einen Torwart." };
        }

        normalized.forEach((slot, idx) => { slot.sourceIndex = idx; });

        const gk = keepers[0];
        const outfield = normalized
            .filter(s => s !== gk)
            .sort((a, b) => b.y - a.y || a.x - b.x);

        const sorted = [gk, ...outfield];
        const order = sorted.map(s => s.sourceIndex);
        const ordered = sorted.map((slot, idx) => {
            const { sourceIndex, ...rest } = slot;
            return { ...rest, id: idx };
        });

        return { valid: true, positions: ordered, order };
    }

    /**
     * Registriert die eigenen Formationen des Spielstands global,
     * damit alle Engines (Match, KI, Aufstellung) sie kennen.
     */
    static registerCustomFormations(state) {
        Object.keys(FORMATION_CONFIGS).forEach(key => {
            if (!BUILTIN_FORMATION_KEYS.includes(key)) delete FORMATION_CONFIGS[key];
        });

        const custom = state?.customFormations;
        if (!custom || typeof custom !== 'object') return FORMATION_CONFIGS;

        Object.entries(custom).forEach(([key, config]) => {
            if (!config || !Array.isArray(config.positions)) return;
            FORMATION_CONFIGS[key] = {
                name: config.name || key,
                custom: true,
                shape: config.shape || null,
                positions: config.positions
            };
        });

        return FORMATION_CONFIGS;
    }

    /**
     * Speichert eine eigene Formation im Spielstand und registriert sie global
     */
    static saveCustomFormation(state, name, positions, existingKey = null) {
        if (!state) return { success: false, error: "Kein Spielstand geladen." };

        const cleanName = String(name || "").trim();
        if (cleanName.length < 2) {
            return { success: false, error: "Bitte einen Namen mit mindestens 2 Zeichen angeben." };
        }

        const normalized = GameState.normalizeFormationPositions(positions);
        if (!normalized.valid) {
            return { success: false, error: normalized.error };
        }

        if (!state.customFormations) state.customFormations = {};

        const key = existingKey && GameState.isCustomFormation(existingKey)
            ? existingKey
            : `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

        const posEngine = GameState._getPositionEngine();
        const shape = posEngine ? posEngine.detectFormationShape(normalized.positions) : null;

        state.customFormations[key] = {
            key,
            name: cleanName,
            custom: true,
            shape,
            createdAt: new Date().toISOString(),
            positions: normalized.positions
        };

        GameState.registerCustomFormations(state);

        return { success: true, key, shape, name: cleanName, order: normalized.order };
    }

    /**
     * Löscht eine eigene Formation und setzt betroffene Vereine auf 4-4-2 zurück
     */
    static deleteCustomFormation(state, key) {
        if (!state?.customFormations || !state.customFormations[key]) {
            return { success: false, error: "Diese Formation existiert nicht." };
        }

        delete state.customFormations[key];
        delete FORMATION_CONFIGS[key];

        (state.clubs || []).forEach(club => {
            if (club.formation === key) club.formation = "4-4-2";
        });

        GameState.registerCustomFormations(state);
        return { success: true };
    }

    constructor() {
        this.saveId = "save_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
        this.version = "0.2.0";
        this.schemaVersion = 2;
        this.createdAt = new Date().toISOString();
        this.lastSaved = new Date().toISOString();
        this.userClubId = null;
        this.managerName = "Trainer";
        this.managerNationality = "Deutschland";
        this.managerBirthdate = "1985-05-15";
        this.difficulty = "normal";
        this.leagueName = "Deutschland Liga 1";
        this.seasonYear = 1;
        this.currentMatchday = 1;
        this.totalMatchdays = 34;
        this.boardConfidence = 75;
        this.clubs = [];
        this.players = [];
        this.schedule = [];
        this.standings = [];
        this.inbox = [];
        this.transferMarket = {
            listedPlayerIds: [],
            offers: [],
            history: [],
            shortlist: []
        };
        this.trainingSettings = {
            focus: "allround",
            intensity: "normal"
        };
        this.scouting = {
            assignments: [],
            reports: [],
            shortlist: []
        };
        this.youthAcademy = {
            prospects: [],
            level: 1
        };
        this.finances = {
            transactions: []
        };
        this.history = {
            pastSeasons: [],
            matchReports: {}
        };
        this.settings = {
            soundEnabled: true,
            autosaveEnabled: true
        };
        this.customFormations = {};
        // Laufende Verhandlungen mit Vereinen und Beratern
        this.negotiations = [];
    }

    static buildBaseWorld() {
        const world = { clubs: [], players: [] };
        let playerIdCounter = 1;

        const nationalitaeten = (typeof INITIAL_NATIONALITIES !== 'undefined' && INITIAL_NATIONALITIES)
            ? INITIAL_NATIONALITIES
            : ((typeof window !== 'undefined' && window.INITIAL_NATIONALITIES) ? window.INITIAL_NATIONALITIES : (typeof require !== 'undefined' ? (require('../data/initialData.js').INITIAL_NATIONALITIES || {}) : {}));
        const rawTeams = (typeof INITIAL_TEAMS_DATA !== 'undefined' && INITIAL_TEAMS_DATA)
            ? INITIAL_TEAMS_DATA
            : ((typeof window !== 'undefined' && window.INITIAL_TEAMS_DATA) ? window.INITIAL_TEAMS_DATA : (typeof require !== 'undefined' ? require('../data/initialData.js').INITIAL_TEAMS_DATA : []));
        const teamsData = JSON.parse(JSON.stringify(rawTeams || []));

        const SPONSOR_NAMES = [
            "Deutsche Telekom", "Telekom", "Evonik Industries", "Barmenia Versicherungen", "SAP SE",
            "Volkswagen", "Mercedes-Benz", "Red Bull", "Wiesenhof", "Talanx", "Mainova",
            "Schwarzwaldmilch", "Covestro", "Allianz", "BMW Group", "Puma SE", "Adidas", "Global Tech"
        ];

        teamsData.forEach((clubData, cIdx) => {
            const rep = clubData.reputation || 70;
            const cap = clubData.capacity || 25000;

            let stadiumLvl = 2, trainingLvl = 2, youthLvl = 1, medicalLvl = 1;
            if (rep >= 88 || cap >= 65000) {
                stadiumLvl = 5; trainingLvl = 5; youthLvl = 5; medicalLvl = 5;
            } else if (rep >= 80 || cap >= 45000) {
                stadiumLvl = 4; trainingLvl = 4; youthLvl = 4; medicalLvl = 4;
            } else if (rep >= 72 || cap >= 28000) {
                stadiumLvl = 3; trainingLvl = 3; youthLvl = 3; medicalLvl = 3;
            } else if (rep >= 64 || cap >= 18000) {
                stadiumLvl = 2; trainingLvl = 2; youthLvl = 2; medicalLvl = 2;
            } else {
                stadiumLvl = 1; trainingLvl = 1; youthLvl = 1; medicalLvl = 1;
            }

            const sponsorName = SPONSOR_NAMES[cIdx % SPONSOR_NAMES.length];
            const sponsorAmount = Math.round(rep * 18000 + (stadiumLvl * 50000));

            const club = {
                id: clubData.id,
                name: clubData.name,
                city: clubData.city,
                stadium: clubData.stadium,
                capacity: clubData.capacity,
                // Nach Ruf wie in allen Ligen (ClubGenerator), mit dem deutschen
                // Abschlag: Stehplätze und 50+1 halten die Preise niedrig.
                // Vorher zahlte man in München und in Heidenheim dieselben 35 EUR.
                ticketPrice: Math.max(6, Math.round(((rep / 2.2) + Math.random() * 8) * 0.8)),
                balance: clubData.balance,
                transferBudget: clubData.transferBudget,
                wageBudget: clubData.wageBudget,
                reputation: clubData.reputation,
                fanBase: clubData.fanBase,
                boardExpectation: clubData.boardExpectation,
                primaryColor: clubData.primaryColor,
                secondaryColor: clubData.secondaryColor,
                confidence: 75,
                facilities: {
                    trainingGround: trainingLvl,
                    youthCenter: youthLvl,
                    medicalCenter: medicalLvl,
                    stadium: stadiumLvl
                },
                youthAcademy: {
                    prospects: [],
                    level: youthLvl
                },
                sponsor: {
                    name: sponsorName,
                    amountPerMatchday: sponsorAmount,
                    yearsRemaining: (cIdx % 3) + 1
                },
                chemistry: {
                    overall: 75,
                    tacticalFamiliarity: 70,
                    dressingRoom: 75
                },
                playerIds: [],
                lineup: [],
                bench: [],
                formation: "4-4-2",
                tactics: {
                    mentality: "balanced",
                    pressing: "medium",
                    tempo: "normal",
                    passing: "mixed",
                    focus: "balanced",
                    defensiveLine: "medium",
                    risk: "normal"
                },
                roles: {
                    captain: null,
                    penaltyTaker: null,
                    freeKickTaker: null,
                    cornerTaker: null
                },
                trainingFocus: "allround",
                form: ["-", "-", "-", "-", "-"]
            };

            clubData.players.forEach(pData => {
                const extraPositions = pData.secondPos
                    ? [pData.secondPos]
                    : (GameState._getPositionEngine()?.generateSecondaryPositions(pData.pos) || []);

                const player = {
                    id: playerIdCounter++,
                    clubId: club.id,
                    name: pData.name,
                    age: pData.age,
                    nationality: pData.nationality || nationalitaeten[pData.name] || "Deutschland",
                    pos: pData.pos,
                    secondPos: pData.secondPos || extraPositions[0] || null,
                    positions: extraPositions,
                    overall: pData.overall,
                    pot: pData.pot,
                    trueCurrentAbility: (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine.overallToAbility(pData.overall) : (pData.overall * 2),
                    truePotentialAbility: (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine.overallToAbility(pData.pot) : (pData.pot * 2),
                    trueMarketValue: pData.value,
                    scoutingKnowledge: {
                        known: false,
                        knowledgeLevel: 25,
                        accuracy: 25,
                        lastScoutedDate: null
                    },
                    hiddenAttributes: (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine.generateHiddenAttributes(pData) : {
                        professionalism: 12, ambition: 12, consistency: 12, importantMatches: 12, injuryProneness: 10, adaptability: 12, loyalty: 12, temperament: 12
                    },
                    value: pData.value,
                    wage: pData.wage,
                    contractYears: Math.floor(Math.random() * 3) + 2,
                    fitness: 100,
                    morale: 80 + Math.floor(Math.random() * 15),
                    form: 7.0,
                    injured: false,
                    injuredWeeks: 0,
                    injuryWeeks: 0,
                    injuryName: null,
                    suspended: false,
                    suspendedMatches: 0,
                    yellowCards: 0,
                    yellowCardsTotal: 0,
                    squadRole: pData.overall >= 84 ? "Schlüsselspieler" : pData.overall >= 78 ? "Stammspieler" : "Rotationsspieler",
                    happiness: {
                        overall: 75,
                        playingTime: 75,
                        contract: 75,
                        teamPerformance: 75,
                        training: 75,
                        reason: "Zufrieden mit der aktuellen Situation."
                    },
                    stats: {
                        matches: 0,
                        goals: 0,
                        assists: 0,
                        yellowCards: 0,
                        redCards: 0,
                        minutes: 0,
                        ratingSum: 0,
                        cleanSheets: 0
                    },
                    reflexes: pData.reflexes || 30,
                    handling: pData.handling || 30,
                    oneOnOne: pData.oneOnOne || 30,
                    positioning: pData.positioning || GameState.stellungsspielAus(pData),
                    kicking: pData.kicking || 30,
                    pace: pData.pace || 70,
                    shooting: pData.shooting || 65,
                    passing: pData.passing || 70,
                    dribbling: pData.dribbling || 70,
                    defense: pData.defense || 60,
                    physical: pData.physical || 70,
                    stamina: pData.stamina || 75,
                    vision: pData.vision || 70,
                    technique: pData.technique || 70
                };

                world.players.push(player);
                club.playerIds.push(player.id);
            });

            GameState.autoSetLineupForClub(club, world.players);
            world.clubs.push(club);
        });

        const worldGen = GameState._getWorldGenerator();
        if (worldGen) {
            worldGen.tagExistingClubs(world.clubs, "de_liga_1");
            worldGen.generateWorld(world);
        }

        // Jeder Verein baut den Kader, den er bezahlen kann.
        //
        // Die Gehälter entstehen beim Erzeugen eines Spielers aus seiner Stärke,
        // die Einnahmen aber aus dem Rang des Vereins in seiner Liga. Ohne
        // diesen Abgleich klafften beide in der Tabellenmitte auseinander: Der
        // Median-Erstligist verlor 421.000 € je Spieltag, während ein
        // Siebtligist jeden Spieltag Geld zurücklegte.
        const finance = GameState._resolveEngine("FinanceEngine", "./financeEngine.js");
        if (finance && typeof finance.normalisiereGehaelter === "function") {
            finance.normalisiereGehaelter(world);
        }

        return world;
    }

    static _getWorldGenerator() {
        return GameState._resolveEngine("WorldGenerator", "./worldGenerator.js");
    }

    static getPreparedWorld(regenerate = false) {
        if (regenerate || !GameState._preparedWorld) {
            GameState._preparedWorld = GameState.buildBaseWorld();
        }
        return GameState._preparedWorld;
    }

    static getSelectableClubs() {
        const world = GameState.getPreparedWorld();
        const leagues = (typeof LEAGUES_DATA !== "undefined" && LEAGUES_DATA)
            ? LEAGUES_DATA
            : ((typeof window !== "undefined" && window.LEAGUES_DATA) ? window.LEAGUES_DATA
                : (typeof require !== "undefined" ? require("../data/leagueData.js").LEAGUES_DATA : []));

        return world.clubs.map(club => {
            const squad = world.players.filter(p => p.clubId === club.id);
            const league = leagues.find(l => l.id === club.leagueId);
            const avg = squad.length
                ? Math.round(squad.reduce((sum, p) => sum + (p.overall || 0), 0) / squad.length)
                : 0;

            return {
                id: club.id,
                name: club.name,
                city: club.city,
                stadium: club.stadium,
                capacity: club.capacity || club.stadiumCapacity || 0,
                reputation: club.reputation || 50,
                transferBudget: club.transferBudget || 0,
                wageBudget: club.wageBudget || 0,
                boardExpectation: club.boardExpectation,
                primaryColor: club.primaryColor,
                secondaryColor: club.secondaryColor,
                leagueId: club.leagueId,
                leagueName: league ? league.shortName || league.name : "",
                countryId: club.countryId || "de",
                level: club.level || 1,
                avgOverall: avg,
                squadSize: squad.length,
                players: squad.map(p => ({
                    name: p.name,
                    pos: p.pos,
                    age: p.age,
                    overall: p.overall,
                    pot: p.pot,
                    value: p.value
                }))
            };
        });
    }

    static createNewGame(userClubId, difficulty = "normal", managerProfile = {}) {
        const state = new GameState();
        GameState.registerCustomFormations(state);
        state.userClubId = userClubId;
        state.difficulty = difficulty;
        state.managerName = managerProfile.name || (typeof managerProfile === "string" ? managerProfile : "Trainer");
        state.managerNationality = managerProfile.nationality || "Deutschland";
        state.managerBirthdate = managerProfile.birthdate || "1985-05-15";
        // Der Trainertyp legt die Startwerte des Trainerprofils fest
        if (managerProfile.trainerTyp) state.trainerTyp = managerProfile.trainerTyp;
        state.lastSaved = new Date().toISOString();
        state.createdAt = new Date().toISOString();

        const world = GameState.getPreparedWorld();
        GameState._preparedWorld = null;
        state.clubs = world.clubs;
        state.players = world.players;

        const userClub = state.clubs.find(c => c.id === userClubId) || state.clubs[0];
        if (userClub) {
            state.userClubId = userClub.id;
            userClubId = userClub.id;

            if (difficulty === "easy") {
                userClub.transferBudget = Math.round(userClub.transferBudget * 1.35);
                userClub.wageBudget = Math.round(userClub.wageBudget * 1.25);
                userClub.balance = Math.round(userClub.balance * 1.3);
            } else if (difficulty === "hard") {
                userClub.transferBudget = Math.round(userClub.transferBudget * 0.75);
                userClub.wageBudget = Math.round(userClub.wageBudget * 0.85);
                userClub.balance = Math.round(userClub.balance * 0.8);
            }

            state.players.forEach(p => {
                if (p.clubId !== userClub.id || !p.scoutingKnowledge) return;
                p.scoutingKnowledge.known = true;
                p.scoutingKnowledge.knowledgeLevel = 90;
                p.scoutingKnowledge.accuracy = 90;
                p.scoutingKnowledge.lastScoutedDate = "Saisonstart";
            });
        }

        // Jeder Verein bekommt eine vollstaendige Taktik: Rollen, Formen mit
        // und gegen den Ball, Anweisungen. Die KI-Vereine spielen dabei nicht
        // alle gleich - ihr Stil haengt an ihrer Staerke: Grosse spielen eher
        // Ballbesitz und Pressing, kleine stehen tiefer und kontern.
        const taktik = GameState._resolveEngine('TacticsEngine', './tacticsEngine.js');
        if (taktik) {
            state.clubs.forEach(club => {
                club.tactics = club.id === state.userClubId
                    ? taktik.normalisiere(club.tactics)
                    : taktik.wendeVorlageAn(club.tactics, taktik.vorlageFuerVerein(club));
            });
        }

        state.userLeagueId = userClub?.leagueId || "de_liga_1";
        const worldGenForSchedule = GameState._getWorldGenerator();
        if (worldGenForSchedule) {
            worldGenForSchedule.generateAllSchedules(state, state.userLeagueId);
        } else {
            state.schedule = GameState.generateSchedule(state.clubs);
            state.totalMatchdays = state.schedule.length;
        }

        const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine)
            ? CalendarEngine
            : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : (typeof require !== 'undefined' ? require('./calendarEngine.js').CalendarEngine : null));
        if (calendarEngine && typeof calendarEngine.generateSeasonCalendar === 'function') {
            calendarEngine.generateSeasonCalendar(state);
        } else {
            state.currentDate = "01.08.2026";
            state.currentDayIndex = 0;
            state.calendar = [];
        }

        // Das Saisonziel misst der Vorstand an Kader, Etat und Ansehen -
        // vor der Vorbereitung, weil der ehrgeizige Sponsor darauf setzt
        const boardEngine = GameState._resolveEngine('BoardEngine', './boardEngine.js');
        const zielUser = state.clubs.find(c => c.id === userClubId);
        if (boardEngine && typeof boardEngine.bestimmeZiel === 'function' && zielUser) {
            boardEngine.bestimmeZiel(state, zielUser);
        }

        // Die Vorbereitung beginnt: Trainerstab, Sponsoren, Testspiele. Sie
        // steht vor jeder Saison, nicht nur vor der ersten.
        const preseasonEngine = (typeof PreseasonEngine !== "undefined" && PreseasonEngine)
            ? PreseasonEngine
            : ((typeof window !== "undefined" && window.PreseasonEngine) ? window.PreseasonEngine
                : (typeof require !== "undefined" ? require("./preseasonEngine.js").PreseasonEngine : null));
        if (preseasonEngine && typeof preseasonEngine.start === "function") {
            preseasonEngine.start(state);
        }


        state.fanMood = 75;
        state.mediaPressure = 45;

        const userLeagueClubs = state.clubs.filter(c => c.leagueId === state.userLeagueId);
        state.standings = GameState.calculateStandings(
            userLeagueClubs.length > 1 ? userLeagueClubs : state.clubs,
            state.schedule,
            1
        );

        const leagueData = GameState._resolveLeagueData('LEAGUES_DATA');
        const countryData = GameState._resolveLeagueData('COUNTRIES_DATA');
        const compData = GameState._resolveLeagueData('COMPETITIONS_DATA');
        const compEngine = GameState._resolveEngine('CompetitionEngine', './competitionEngine.js');

        state.countries = countryData;
        state.leagues = leagueData;
        state.competitions = compData;
        state.activeCompetitionId = state.userLeagueId;
        state.standingsByLeague = state.standingsByLeague || {};
        state.standingsByLeague[state.userLeagueId] = state.standings;

        const userLeague = leagueData.find(l => l.id === state.userLeagueId);
        state.leagueName = userLeague ? (userLeague.shortName || userLeague.name) : "Liga";

        if (compEngine) {
            state.europeanCompetitions = compEngine.generateEuropeanCompetitions(state.clubs);
        }

        // Pokal und Europapokal bekommen einen Spielplan, der auch abgearbeitet
        // wird. Vorher stand nur eine erste Pokalrunde im Speicher, die nie
        // jemand austrug, und die europäischen Gruppen hatten gar keine
        // Partien.
        const cupEngine = GameState._resolveEngine('CupEngine', './cupEngine.js');
        if (cupEngine && typeof cupEngine.starteSaison === 'function') {
            cupEngine.starteSaison(state);
        }

        // Die Karriereakte beginnt mit der ersten Station. Sie entscheidet
        // später, wer sich meldet, wenn der Vorstand die Zusammenarbeit beendet.
        const careerEngine = GameState._resolveEngine('CareerEngine', './careerEngine.js');
        if (careerEngine && typeof careerEngine.beginneStation === 'function') {
            careerEngine.beginneStation(state, userClubId);
        }

        const youthEngine = (typeof YouthEngine !== 'undefined' && YouthEngine)
            ? YouthEngine
            : ((typeof window !== 'undefined' && window.YouthEngine) ? window.YouthEngine : (typeof require !== 'undefined' ? require('./youthEngine.js').YouthEngine : null));
        if (youthEngine && typeof youthEngine.generateProspects === 'function') {
            youthEngine.generateProspects(state, userClubId);
        }

        const zielSatz = boardEngine && typeof boardEngine.zielText === 'function'
            ? boardEngine.zielText(state, userClub)
            : GameState.getExpectationText(userClub.boardExpectation);
        const zielGrund = boardEngine && typeof boardEngine.zielBegruendung === 'function'
            ? boardEngine.zielBegruendung(userClub) : "";
        state.inbox.push({
            id: "msg_welcome",
            matchday: 1,
            date: "Saisonstart",
            sender: "Vorstand " + userClub.name,
            title: "Herzlich willkommen als neuer Manager!",
            subject: "Herzlich willkommen als neuer Manager!",
            text: `Herzlich willkommen beim ${userClub.name}, Trainer ${state.managerName}!\n\nDer Vorstand und die Fans setzen großes Vertrauen in Ihre Arbeit. Unser Saisonziel für diese Spielzeit lautet: ${zielSatz}.${zielGrund ? ` ${zielGrund}` : ""}\n\nIhr aktuelles Transferbudget beträgt ${GameState.formatMoney(userClub.transferBudget)}. Wir wünschen Ihnen viel Erfolg für die kommende Saison!`,
            body: `Herzlich willkommen beim ${userClub.name}, Trainer ${state.managerName}!\n\nDer Vorstand und die Fans setzen großes Vertrauen in Ihre Arbeit. Unser Saisonziel für diese Spielzeit lautet: ${zielSatz}.${zielGrund ? ` ${zielGrund}` : ""}\n\nIhr aktuelles Transferbudget beträgt ${GameState.formatMoney(userClub.transferBudget)}. Wir wünschen Ihnen viel Erfolg für die kommende Saison!`,
            read: false,
            priority: "high",
            type: "welcome"
        });

        // Die Vision des Vorstands über mehrere Spielzeiten (VisionEngine)
        const visionEngine = GameState._resolveEngine("VisionEngine", "./visionEngine.js");
        if (visionEngine && typeof visionEngine.vision === "function") visionEngine.vision(state);

        // Die Stars jeder Liga bekommen ihre Signatur-Eigenschaft
        GameState.sichereSignaturen(state);

        // Geführter Einstieg (js/ui/uiEinstieg.js) - abwählbar im Assistenten
        if (managerProfile.erklaerungen !== false) state.einstieg = GameState.neuerEinstieg(state);

        return state;
    }

    /**
     * Der Stand des geführten Einstiegs: welche ersten Schritte erledigt und
     * welche Erklärungen weggeklickt sind. Reine Anzeige - das Spiel selbst
     * fragt ihn nicht ab.
     */
    static neuerEinstieg(state) {
        return { schritte: {}, gesehen: {}, aus: false, karteAus: false, startTag: state?.currentDayIndex || 0 };
    }

    /** Signatur-Eigenschaften der Topspieler - auch für ältere Spielstände */
    static sichereSignaturen(state) {
        const eig = GameState._resolveEngine("EigenschaftenEngine", "./eigenschaftenEngine.js");
        if (eig && typeof eig.sicherstellen === "function") eig.sicherstellen(state);
    }

    /**
     * Stellungsspiel für handgepflegte Spieler ableiten.
     *
     * "positioning" ist ein Feldspielerwert - er beschreibt, ob einer zur
     * richtigen Zeit am richtigen Ort steht. In der Vereinsdatei ist er nur
     * bei den Torhütern hinterlegt; alle übrigen Spieler bekamen deshalb den
     * Vorgabewert 30, der eigentlich für die Torwartwerte eines Feldspielers
     * gedacht war.
     *
     * Für Innen- und Außenverteidiger ist das Stellungsspiel einer von vier
     * Werten, aus denen die Spielstärke gebildet wird. Ein Weltklasse-
     * verteidiger rutschte damit rechnerisch auf Kreisliganiveau: Joshua Kimm,
     * Gesamtstärke 87, kam auf effektive 66. Weil der Fehler alle handgepflegten
     * Kader gleichmäßig traf, schrumpfte der Abstand zwischen dem besten und
     * dem schwächsten Bundesligakader von neun auf fünf Punkte - und damit
     * auch der Abstand in der Tabelle am Saisonende.
     *
     * Die Zuschläge entsprechen denen, mit denen der Spielergenerator
     * erzeugte Spieler ausstattet.
     */
    static STELLUNGSSPIEL_PROFIL = {
        IV: 4, LV: 1, RV: 1, DM: 3, ZM: 0,
        LM: -2, RM: -2, OM: -6, LA: -8, RA: -8, ST: -4
    };

    static stellungsspielAus(pData) {
        const staerke = pData?.overall || 68;
        if (!pData || pData.pos === "TW") return staerke;
        const zuschlag = GameState.STELLUNGSSPIEL_PROFIL[pData.pos] ?? 0;
        return Math.max(20, Math.min(99, Math.round(staerke + zuschlag)));
    }

    /**
     * Ausgefallene Spieler in Startelf und Bank ersetzen.
     *
     * Verletzte und Gesperrte werden aus der Aufstellung genommen - bisher
     * blieb die Lücke einfach stehen. Über eine Saison rutschte der Kader so
     * dauerhaft auf zehn Mann, und ein Livespiel ließ sich gar nicht mehr
     * starten. Hier rückt der beste verfügbare Ersatz nach; die übrige
     * Aufstellung des Trainers bleibt unangetastet.
     *
     * Entscheidend ist dabei die *Position im Array*: Die Einsatzposition
     * eines Spielers ergibt sich aus seinem Platz in der Aufstellung. Wer den
     * Ausfall einfach herausfiltert, lässt alle dahinter um einen Platz
     * aufrücken - der Torwart steht dann in der Innenverteidigung, der
     * Mittelstürmer auf dem Flügel. Nach ein paar Ausfällen spielte die halbe
     * Mannschaft auf fremden Positionen, ohne dass man es der Aufstellung
     * ansah. Deshalb bleibt jeder Platz hier erhalten: Ein Ausfall hinterlässt
     * eine Lücke, die genau dort wieder gefüllt wird.
     *
     * Gibt true zurück, wenn etwas verändert wurde.
     */
    /**
     * Ein Nachschlagewerk aller Spieler nach ID.
     *
     * Wer die Aufstellungen aller Vereine prüft, braucht es genau einmal -
     * nicht je Verein neu. Vorher baute `repairLineup` diese Map bei jedem
     * Aufruf auf: dreihundert Vereine mal viertausendachthundert Spieler,
     * jeden Kalendertag. Das waren rund 1,4 Millionen Einträge pro Tag und
     * damit der größte Einzelposten am Tagesklick.
     */
    static buildPlayerIndex(allPlayers) {
        const byId = new Map();
        if (Array.isArray(allPlayers)) {
            allPlayers.forEach(p => { if (p) byId.set(p.id, p); });
        }
        return byId;
    }

    static repairLineup(club, allPlayers, playerIndex = null) {
        if (!club || !Array.isArray(club.playerIds) || !Array.isArray(allPlayers)) return false;

        const byId = playerIndex instanceof Map ? playerIndex : GameState.buildPlayerIndex(allPlayers);

        const kaderIds = new Set(club.playerIds);
        const einsatzfaehig = (id) => {
            const p = byId.get(id);
            return !!p && kaderIds.has(id)
                && (p.injuredWeeks || 0) <= 0
                && (p.suspendedMatches || 0) <= 0
                // Wer in der zweiten Mannschaft spielt, steht den Profis nicht zur Verfügung
                && !p.reserve;
        };

        // An den allermeisten Tagen ist an den allermeisten Aufstellungen
        // nichts zu tun. Diese Prüfung kostet ein paar Nachschläge und erspart
        // das Sortieren und Neubesetzen einer vollständigen Elf.
        const ohneVertretung = !club.lineupCover || Object.keys(club.lineupCover).length === 0;
        if (ohneVertretung
            && Array.isArray(club.lineup) && club.lineup.length === 11
            && Array.isArray(club.bench) && club.bench.length > 0
            && new Set(club.lineup).size === 11
            && club.lineup.every(einsatzfaehig)
            && club.bench.every(einsatzfaehig)) {
            return false;
        }

        const lineupVorher = Array.isArray(club.lineup) ? club.lineup.slice() : [];
        const benchVorher = Array.isArray(club.bench) ? club.bench.slice() : [];

        const posEngine = GameState._getPositionEngine();
        const bewerte = (player, pos) => {
            if (posEngine && typeof posEngine.getEffectiveRating === "function") {
                return posEngine.getEffectiveRating(player, pos);
            }
            return (player.overall || 0) - (player.pos === pos ? 0 : 8);
        };

        const slots = (GameState.getFormationConfig(club.formation).positions || []).map(s => s.pos);
        const plaetze = new Array(slots.length || 11).fill(null);
        lineupVorher.slice(0, plaetze.length).forEach((id, i) => { plaetze[i] = id; });

        // Wer für wen einspringt, wird notiert. Kommt der Stammspieler zurück,
        // bekommt er seinen Platz wieder - sonst behielte die Vertretung das
        // Trikot bis zum Saisonende, und der Kader würde von Ausfall zu
        // Ausfall schwächer, ohne dass der Manager je etwas falsch gemacht hat.
        const vertretungen = (club.lineupCover && typeof club.lineupCover === "object")
            ? { ...club.lineupCover } : {};
        const zurueckAufBank = [];

        Object.keys(vertretungen).forEach(schluessel => {
            const platz = Number(schluessel);
            const eintrag = vertretungen[schluessel] || {};
            const stammId = eintrag.stamm;
            const vertreterId = eintrag.vertreter;

            // Hat der Manager den Platz selbst neu besetzt, gilt seine Wahl
            if (!(platz >= 0 && platz < plaetze.length) || plaetze[platz] !== vertreterId) {
                delete vertretungen[schluessel];
                return;
            }
            if (plaetze.includes(stammId)) { delete vertretungen[schluessel]; return; }
            if (!einsatzfaehig(stammId)) return; // noch nicht zurück

            plaetze[platz] = stammId;
            if (vertreterId) zurueckAufBank.push(vertreterId);
            delete vertretungen[schluessel];
        });

        // Ausfälle hinterlassen ihre Lücke - der Platz bleibt bestehen
        const ausgefallen = new Map();
        plaetze.forEach((id, i) => {
            if (!id) return;
            if (!einsatzfaehig(id)) { ausgefallen.set(i, id); plaetze[i] = null; return; }
            if (plaetze.indexOf(id) !== i) plaetze[i] = null; // Doppelnennung
        });

        const inElf = new Set(plaetze.filter(Boolean));
        const bench = benchVorher.filter(id => einsatzfaehig(id) && !inElf.has(id));
        const vergeben = new Set([...inElf, ...bench]);
        const frei = club.playerIds
            .filter(id => einsatzfaehig(id) && !vergeben.has(id))
            .map(id => byId.get(id));

        const offeneSlots = [];
        plaetze.forEach((id, i) => { if (!id) offeneSlots.push(i); });

        if (offeneSlots.length === 0 && zurueckAufBank.length === 0) {
            const unveraendert = plaetze.length === lineupVorher.length
                && plaetze.every((id, i) => lineupVorher[i] === id)
                && bench.length === benchVorher.length
                && bench.every((id, i) => benchVorher[i] === id);
            if (unveraendert) {
                club.lineupCover = vertretungen;
                return false;
            }
        }

        // Zuerst von der Bank, dann aus dem Restkader nachrücken - immer für
        // genau die Position, die frei geworden ist
        const ersatzbank = [
            ...zurueckAufBank.map(id => byId.get(id)).filter(p => p && einsatzfaehig(p.id)),
            ...bench.map(id => byId.get(id)).filter(Boolean),
            ...frei
        ];

        offeneSlots.forEach(platz => {
            const gesucht = slots[platz] || "ZM";
            ersatzbank.sort((a, b) => bewerte(b, gesucht) - bewerte(a, gesucht));
            const gewaehlt = ersatzbank.shift();
            if (!gewaehlt) return;
            plaetze[platz] = gewaehlt.id;
            const bankIdx = bench.indexOf(gewaehlt.id);
            if (bankIdx >= 0) bench.splice(bankIdx, 1);
            const freiIdx = frei.indexOf(gewaehlt);
            if (freiIdx >= 0) frei.splice(freiIdx, 1);

            const stammId = ausgefallen.get(platz);
            if (stammId && stammId !== gewaehlt.id) {
                vertretungen[platz] = { stamm: stammId, vertreter: gewaehlt.id };
            }
        });

        // Wer verdrängt wurde und keinen Platz fand, setzt sich auf die Bank
        ersatzbank.forEach(p => {
            if (!p || bench.includes(p.id) || plaetze.includes(p.id)) return;
            if (zurueckAufBank.includes(p.id) && bench.length < 7) bench.unshift(p.id);
        });

        const lineup = plaetze.filter(Boolean);
        club.lineupCover = vertretungen;

        // Bank wieder auffüllen, Ersatztorwart zuerst
        const restlich = frei.filter(p => !lineup.includes(p.id) && !bench.includes(p.id));
        const hatBankKeeper = bench.some(id => byId.get(id)?.pos === "TW");
        if (!hatBankKeeper) {
            const keeper = restlich.find(p => p.pos === "TW");
            if (keeper && bench.length < 7) {
                bench.push(keeper.id);
                restlich.splice(restlich.indexOf(keeper), 1);
            }
        }
        restlich.sort((a, b) => (b.overall || 0) - (a.overall || 0));
        restlich.forEach(p => {
            if (bench.length < 7 && !bench.includes(p.id)) bench.push(p.id);
        });

        const veraendert = lineup.length !== lineupVorher.length
            || bench.length !== benchVorher.length
            || lineup.some((id, i) => lineupVorher[i] !== id)
            || bench.some((id, i) => benchVorher[i] !== id);

        club.lineup = lineup;
        club.bench = bench;

        return veraendert;
    }

    /** Aufstellungen aller Vereine prüfen und Lücken schließen */
    static repairAllLineups(state) {
        if (!state || !Array.isArray(state.clubs)) return 0;
        const index = GameState.buildPlayerIndex(state.players);
        let repariert = 0;
        state.clubs.forEach(club => {
            if (GameState.repairLineup(club, state.players, index)) repariert++;
        });
        return repariert;
    }

    /** Die Spieler eines Kaders, die spielen koennen: nicht verletzt, nicht gesperrt */
    static einsatzfaehigeSpieler(club, allPlayers) {
        const kaderIds = new Set(club?.playerIds || []);
        return (allPlayers || []).filter(p => kaderIds.has(p.id) && p.injuredWeeks === 0 && p.suspendedMatches === 0 && !p.reserve);
    }

    /**
     * Wie gut eine Formation zu den verfuegbaren Spielern passt: die Staerke
     * der besten Elf, die sich damit aufstellen laesst - jeder Spieler mit
     * seiner effektiven Bewertung auf dem Platz, den er dort bekommt.
     */
    static bewerteFormation(formationKey, spieler) {
        const posEngine = GameState._getPositionEngine();
        const slots = FORMATION_CONFIGS[formationKey]?.positions || [];
        if (!posEngine || slots.length !== 11) return { key: formationKey, wert: 0, elf: [] };

        const elf = posEngine.assignBestLineup(spieler, slots);
        let wert = 0;
        elf.forEach((p, i) => {
            if (p) wert += posEngine.scorePlayerForSlot(p, slots[i].pos);
        });
        return { key: formationKey, wert, elf };
    }

    /**
     * Die Formation, die am besten zu den verfuegbaren Spielern passt.
     *
     * "Beste 11 automatisch aufstellen" besetzte bisher nur die eingestellte
     * Formation - wer drei starke Fluegelspieler und nur einen Stuermer hatte,
     * bekam im 4-4-2 trotzdem einen Aussenspieler in die Spitze gestellt.
     * Jetzt wird jede Formation mit dem Kader durchgespielt, auch die eigenen.
     *
     * Bei einem breiten Kader liegen viele Formationen fast gleichauf - gemessen
     * trennten die beste und die zehntbeste oft nur wenige Zehntel Prozent. Die
     * reine Summe brachte dann Zufallssieger hervor, bei jedem zwanzigsten
     * Verein ein 6-3-1. Deshalb muss ein ungewoehnliches System seinen Vorteil
     * deutlicher zeigen als ein gebraeuchliches, und die bisherige Formation
     * bleibt, solange keine andere spuerbar besser ist. Umgestellt wird, wenn
     * eine Formation den Kader wirklich besser nutzt - etwa weil sonst ein
     * Fluegelspieler im Sturm aushelfen muesste.
     */
    static findBestFormation(club, allPlayers) {
        const spieler = GameState.einsatzfaehigeSpieler(club, allPlayers);
        if (spieler.length < 11) return null;

        const reihenfolge = Object.keys(FORMATION_CONFIGS);
        const platz = key => BUILTIN_FORMATION_KEYS.includes(key)
            ? reihenfolge.indexOf(key)
            : Math.round(BUILTIN_FORMATION_KEYS.length / 2);
        const rangliste = reihenfolge
            .map(key => GameState.bewerteFormation(key, spieler))
            .filter(e => e.wert > 0)
            .map(e => ({ ...e, gewichtet: e.wert * (1 - GameState.FORMATION_EXOTIK * platz(e.key)) }))
            .sort((a, b) => b.wert - a.wert);
        if (rangliste.length === 0) return null;

        const beste = rangliste.reduce((a, b) => (b.gewichtet > a.gewichtet ? b : a));
        const bisher = rangliste.find(e => e.key === club.formation) || null;
        const wahl = (bisher && bisher.gewichtet >= beste.gewichtet * (1 - GameState.FORMATION_TOLERANZ))
            ? bisher
            : beste;
        return { key: wahl.key, wert: wahl.wert, bisher, beste, rangliste };
    }

    static autoSetLineupForClub(club, allPlayers) {
        const clubPlayers = GameState.einsatzfaehigeSpieler(club, allPlayers);
        clubPlayers.sort((a, b) => b.overall - a.overall);

        const formationConfig = GameState.getFormationConfig(club.formation);
        const neededSlots = formationConfig.positions;
        const assignedPlayerIds = [];
        const lineup = [];

        const posEngine = GameState._getPositionEngine();

        if (posEngine && typeof posEngine.assignBestLineup === "function") {
            const assigned = posEngine.assignBestLineup(clubPlayers, neededSlots);
            assigned.forEach(player => {
                if (player && !assignedPlayerIds.includes(player.id)) {
                    assignedPlayerIds.push(player.id);
                    lineup.push(player.id);
                }
            });
        } else {
            neededSlots.forEach(slot => {
                let candidate = clubPlayers.find(p => !assignedPlayerIds.includes(p.id) && (p.pos === slot.pos || p.secondPos === slot.pos));
                if (!candidate) {
                    if (slot.pos === "TW") {
                        candidate = clubPlayers.find(p => !assignedPlayerIds.includes(p.id) && p.pos === "TW");
                    } else {
                        candidate = clubPlayers.find(p => !assignedPlayerIds.includes(p.id) && p.pos !== "TW");
                    }
                }
                if (!candidate) {
                    candidate = clubPlayers.find(p => !assignedPlayerIds.includes(p.id));
                }
                if (candidate) {
                    assignedPlayerIds.push(candidate.id);
                    lineup.push(candidate.id);
                }
            });
        }

        const bench = [];
        const remaining = clubPlayers.filter(p => !assignedPlayerIds.includes(p.id));
        const backupGk = remaining.find(p => p.pos === "TW");
        if (backupGk) {
            assignedPlayerIds.push(backupGk.id);
            bench.push(backupGk.id);
        }
        remaining.forEach(p => {
            if (!assignedPlayerIds.includes(p.id) && bench.length < 7) {
                assignedPlayerIds.push(p.id);
                bench.push(p.id);
            }
        });

        club.lineup = lineup;
        club.bench = bench;

        if (lineup.length > 0) {
            club.roles.captain = club.roles.captain || lineup[0];
            const shooters = lineup.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
            shooters.sort((a, b) => b.shooting - a.shooting);
            club.roles.penaltyTaker = shooters[0]?.id || lineup[0];

            const passers = [...shooters].sort((a, b) => b.passing - a.passing);
            club.roles.freeKickTaker = passers[0]?.id || lineup[0];
            club.roles.cornerTaker = passers[1]?.id || passers[0]?.id || lineup[0];
        }
    }

    static generateSchedule(clubs) {
        let teamIds = clubs.map(c => c.id);
        const isOdd = teamIds.length % 2 !== 0;
        if (isOdd) {
            teamIds.push("BYE");
        }
        const numTeams = teamIds.length;
        const rounds = [];
        const halfSeasonRounds = numTeams - 1;
        const matchesPerRound = numTeams / 2;

        const teams = [...teamIds];

        for (let round = 0; round < halfSeasonRounds; round++) {
            const roundMatches = [];
            for (let match = 0; match < matchesPerRound; match++) {
                const home = teams[match];
                const away = teams[numTeams - 1 - match];

                if (home !== "BYE" && away !== "BYE") {
                    // Heimrecht nach Berger: Beim Rundlauf wandert jeder
                    // Verein Runde für Runde eine Paarung weiter. Galt vorher
                    // "linke Seite hat Heimrecht", hatte ein Verein erst sieben
                    // Heimspiele am Stück und dann fünfzehn Auswärtsspiele.
                    // Mit wechselndem Heimrecht je Paarung wechseln sich Heim
                    // und Auswärts ab - höchstens drei in Folge, wie in einer
                    // echten Liga. Der feste Verein wechselt je Runde.
                    const tauschen = match === 0 ? round % 2 === 1 : match % 2 === 1;
                    if (tauschen) {
                        roundMatches.push({ homeClubId: away, awayClubId: home, played: false, homeGoals: null, awayGoals: null, events: [] });
                    } else {
                        roundMatches.push({ homeClubId: home, awayClubId: away, played: false, homeGoals: null, awayGoals: null, events: [] });
                    }
                }
            }
            rounds.push({ matchday: round + 1, matches: roundMatches });

            const fixed = teams[0];
            const rest = teams.slice(1);
            rest.unshift(rest.pop());
            teams.splice(0, teams.length, fixed, ...rest);
        }

        for (let round = 0; round < halfSeasonRounds; round++) {
            const roundMatches = rounds[round].matches.map(m => ({
                homeClubId: m.awayClubId,
                awayClubId: m.homeClubId,
                played: false,
                homeGoals: null,
                awayGoals: null,
                events: []
            }));
            rounds.push({ matchday: halfSeasonRounds + round + 1, matches: roundMatches });
        }

        return rounds;
    }

    static _resolveLeagueData(name) {
        return GameState._resolveEngine(name, '../data/leagueData.js') || [];
    }

    static getLeagueClubs(state, leagueId) {
        if (!state || !Array.isArray(state.clubs)) return [];
        const target = leagueId || GameState.getUserLeagueId(state);
        const clubs = state.clubs.filter(c => c.leagueId === target);
        return clubs.length > 1 ? clubs : state.clubs;
    }

    static getUserLeagueId(state) {
        if (!state) return "de_liga_1";
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        return club?.leagueId || state.userLeagueId || "de_liga_1";
    }

    static getScheduleForLeague(state, leagueId) {
        if (!state) return [];
        if (!leagueId || leagueId === GameState.getUserLeagueId(state)) return state.schedule || [];
        return (state.otherSchedules && state.otherSchedules[leagueId]) || [];
    }

    static calculateStandings(clubs, schedule, upToMatchday = 999) {
        const table = clubs.map(club => ({
            clubId: club.id,
            clubName: club.name,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
            // Ein Punktabzug des Verbands (InvestorEngine) zählt von Anfang an
            points: -((club.punktabzug && club.punktabzug.punkte) || 0),
            abzug: (club.punktabzug && club.punktabzug.punkte) || 0,
            form: [...club.form]
        }));

        schedule.forEach(round => {
            if (round.matchday <= upToMatchday) {
                round.matches.forEach(m => {
                    if (m.played && m.homeGoals !== null && m.awayGoals !== null) {
                        const homeEntry = table.find(t => t.clubId === m.homeClubId);
                        const awayEntry = table.find(t => t.clubId === m.awayClubId);

                        if (homeEntry && awayEntry) {
                            homeEntry.played++;
                            awayEntry.played++;
                            // Die Tore des Gastes gingen bisher ebenfalls auf
                            // das Konto des Gastgebers. Dadurch stand bei jeder
                            // Mannschaft dieselbe Zahl vor und hinter dem
                            // Doppelpunkt, die Tordifferenz war immer null und
                            // der Gast blieb bei 0:0 stehen.
                            homeEntry.goalsFor += m.homeGoals;
                            homeEntry.goalsAgainst += m.awayGoals;
                            awayEntry.goalsFor += m.awayGoals;
                            awayEntry.goalsAgainst += m.homeGoals;

                            if (m.homeGoals > m.awayGoals) {
                                homeEntry.won++;
                                homeEntry.points += 3;
                                awayEntry.lost++;
                            } else if (m.homeGoals < m.awayGoals) {
                                awayEntry.won++;
                                awayEntry.points += 3;
                                homeEntry.lost++;
                            } else {
                                homeEntry.drawn++;
                                homeEntry.points += 1;
                                awayEntry.drawn++;
                                awayEntry.points += 1;
                            }

                            homeEntry.goalDiff = homeEntry.goalsFor - homeEntry.goalsAgainst;
                            awayEntry.goalDiff = awayEntry.goalsFor - awayEntry.goalsAgainst;
                        }
                    }
                });
            }
        });

        table.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            return a.clubName.localeCompare(b.clubName);
        });

        return table;
    }

    static formatMoney(amount) {
        // Negative Beträge liefen bisher an allen Stufen vorbei und kamen als
        // Rohzahl heraus - im Buchungsjournal stand "-1150387 €".
        const zahl = Number(amount) || 0;
        const vorzeichen = zahl < 0 ? "-" : "";
        const betrag = Math.abs(zahl);
        if (betrag >= 1000000) {
            return vorzeichen + (betrag / 1000000).toFixed(2).replace(".", ",") + " Mio. €";
        }
        if (betrag >= 1000) {
            return vorzeichen + (betrag / 1000).toFixed(0) + " Tsd. €";
        }
        return vorzeichen + Math.round(betrag) + " €";
    }

    static getExpectationText(exp) {
        switch(exp) {
            case "championship": return "Gewinn der Meisterschaft";
            case "promotion": return "Aufstieg";
            case "top3": return "Qualifikation für die Top 3";
            case "top6": return "Ein Platz unter den ersten sechs";
            case "midfield": return "Gesichertes oberes Tabellenmittelfeld";
            case "lower_mid": return "Ein sicherer Platz im Mittelfeld";
            case "avoid_relegation": return "Klassenerhalt";
            default: return "Erfolgreiche Saison";
        }
    }

    /**
     * Speichert den Spielstand.
     *
     * Ein Durchgang kostet gemessen 310 Millisekunden, davon 305 allein für
     * das Codieren - und gespeichert wird an siebzehn Stellen: Tageswechsel,
     * Trainerverpflichtung, Sponsorwahl, Turnier-Zusage, Aufstellung. Jeder
     * dieser Klicks stand damit eine Drittelsekunde still.
     *
     * Deshalb wird jetzt gebündelt: Der Aufruf merkt sich nur, dass etwas zu
     * sichern ist, und der eigentliche Schreibvorgang läuft kurz darauf,
     * wenn der Browser ohnehin Luft hat. Mehrere Aufrufe hintereinander
     * kosten so einen einzigen Durchgang statt fünf.
     *
     * `sofort` erzwingt das synchrone Schreiben - beim Verlassen der Seite
     * oder vor einem Export darf nichts in der Warteschlange hängen.
     */
    /**
     * Wie lange gesammelt wird, bevor wirklich geschrieben wird.
     *
     * Ein Speichervorgang kostet auch nach der Beschleunigung des Codecs rund
     * sechzig Millisekunden, in denen die Oberfläche steht. Wer den
     * Weiter-Knopf mehrmals hintereinander drückt, soll das nicht bei jedem
     * Klick spüren - eine Sekunde Sammelzeit fasst eine ganze Klickfolge zu
     * einem einzigen Schreibvorgang zusammen. Verloren gehen kann dabei
     * nichts: `flushSave` schreibt beim Verlassen der Seite sofort.
     */
    static SAVE_SAMMELZEIT_MS = 1000;

    /** Der erste Speicherplatz - unter diesem Namen lag der Spielstand schon immer */
    static SPEICHERPLATZ = "football_manager_savegame";

    /**
     * Mehrere Karrieren nebeneinander, dazu Sicherungskopien.
     *
     * Bisher gab es genau einen Spielstand: Eine neue Karriere überschrieb
     * die alte, und ein beschädigter Stand war das Ende der Karriere. Jetzt
     * gibt es fünf Plätze. Platz 1 behält den alten Schlüssel, ein
     * vorhandener Stand liegt also ohne Umzug dort.
     *
     * Je Platz hält das Spiel die letzten drei Sicherungen, höchstens eine je
     * Spielwoche: Liegt die jüngste Sicherung sieben Spieltage im Kalender
     * zurück oder in einer früheren Saison, wird der Stand beim Speichern
     * zusätzlich als Sicherung abgelegt, und die älteste fällt heraus.
     * Sicherungen gibt es nur mit IndexedDB - der LocalStorage fasst kaum
     * einen einzigen Stand.
     *
     * Das Verzeichnis kennt zu jedem Platz und jeder Sicherung eine kurze
     * Zusammenfassung (Verein, Saison, Spieltag, Datum). So zeigt der
     * Startbildschirm alle Karrieren, ohne jeden Stand ganz einzulesen. In
     * IndexedDB wird es im selben Vorgang geschrieben wie der Stand selbst
     * und kann deshalb nicht von ihm abweichen.
     */
    static PLATZ_ANZAHL = 5;
    static VERZEICHNIS = "football_manager_verzeichnis";
    static SICHERUNGEN_JE_PLATZ = 3;
    static SICHERUNG_ABSTAND_TAGE = 7;

    /**
     * Wo der Spielstand liegt.
     *
     * Bisher stand er im LocalStorage, und der fasst je nach Browser nur
     * fünf bis zehn Megabyte. Jetzt liegt er in IndexedDB, sobald
     * `bereiteSpeicherVor` die Datenbank geöffnet hat - der LocalStorage
     * bleibt Ausweichquartier, wenn es kein IndexedDB gibt oder ein
     * Schreibvorgang dort scheitert.
     *
     * `_spiegel` hält den zuletzt gesicherten Text des aktiven Platzes. Damit
     * bleiben Laden und Zusammenfassung synchron, obwohl IndexedDB nur
     * asynchron liest: Gelesen wird einmal beim Start, danach kennt der
     * Spiegel jeden neuen Stand, weil er ihn selbst geschrieben hat. Andere
     * Plätze und Sicherungen liest `ladePlatz` bei Bedarf nach.
     */
    static _idbAktiv = false;
    static _spiegel = {};
    static _letzteSicherung = null;
    static _aktiverPlatz = null;
    static _verzeichnis = null;

    static _platz(slotKey) {
        return slotKey || GameState._aktiverPlatz || GameState.SPEICHERPLATZ;
    }

    static platzSchluessel(nr) {
        return nr > 1 ? `${GameState.SPEICHERPLATZ}_${nr}` : GameState.SPEICHERPLATZ;
    }

    static platzNummer(slotKey) {
        return GameState.alleSpeicherplaetze().indexOf(slotKey) + 1;
    }

    static alleSpeicherplaetze() {
        return Array.from({ length: GameState.PLATZ_ANZAHL }, (_, i) => GameState.platzSchluessel(i + 1));
    }

    /** Auf diesen Platz speichert das laufende Spiel */
    static aktiverPlatz() {
        return GameState._platz(null);
    }

    static setzeAktivenPlatz(slotKey) {
        if (!GameState.alleSpeicherplaetze().includes(slotKey)) throw new Error(`Unbekannter Speicherplatz: ${slotKey}`);
        const bisher = GameState.aktiverPlatz();
        // Den Text des verlassenen Platzes nicht für nichts im Speicher halten
        if (bisher !== slotKey && GameState._idbAktiv) delete GameState._spiegel[bisher];
        GameState._aktiverPlatz = slotKey;
    }

    static _getSpeicherDB() {
        return GameState._resolveEngine("SpeicherDB", "../services/speicherDB.js");
    }

    /** Wo der Spielstand gerade landet - für die Einstellungen */
    static speicherort() {
        return GameState._idbAktiv ? "indexedDB" : "localStorage";
    }

    /** Gibt es Sicherungskopien? Nur mit IndexedDB. */
    static sicherungenMoeglich() {
        return GameState._idbAktiv;
    }

    static _leeresVerzeichnis() {
        return { version: 1, plaetze: {}, sicherungen: {} };
    }

    static _alsVerzeichnis(roh) {
        let v = roh;
        if (typeof v === "string") {
            try { v = JSON.parse(v); } catch (e) { v = null; }
        }
        if (!v || typeof v !== "object") return GameState._leeresVerzeichnis();
        if (!v.plaetze || typeof v.plaetze !== "object") v.plaetze = {};
        if (!v.sicherungen || typeof v.sicherungen !== "object") v.sicherungen = {};
        return v;
    }

    /**
     * Das Verzeichnis aller Plätze. Ohne IndexedDB liegt es im LocalStorage
     * und wird beim ersten Zugriff gelesen - fehlt es dort, wird es aus den
     * vorhandenen Ständen gebildet.
     */
    static verzeichnis() {
        if (GameState._verzeichnis) return GameState._verzeichnis;
        const v = GameState._alsVerzeichnis(GameState._idbAktiv ? null : GameState._lsLies(GameState.VERZEICHNIS));
        if (!GameState._idbAktiv) {
            GameState.alleSpeicherplaetze().forEach(k => {
                if (v.plaetze[k]) return;
                const z = GameState._zusammenfassungAusText(GameState._lsLies(k));
                if (z) v.plaetze[k] = z;
            });
        }
        GameState._verzeichnis = v;
        return v;
    }

    /** Alle Plätze mit Nummer und Zusammenfassung (null = frei) */
    static speicherplaetze() {
        const v = GameState.verzeichnis();
        const aktiv = GameState.aktiverPlatz();
        return GameState.alleSpeicherplaetze().map((schluessel, i) => ({
            schluessel,
            nr: i + 1,
            aktiv: schluessel === aktiv,
            zusammenfassung: v.plaetze[schluessel] || null
        }));
    }

    /** Die Sicherungen eines Platzes, die jüngste zuerst */
    static sicherungen(slotKey = null) {
        return (GameState.verzeichnis().sicherungen[GameState._platz(slotKey)] || []).slice();
    }

    static freierPlatz() {
        return GameState.speicherplaetze().find(p => !p.zusammenfassung)?.schluessel || null;
    }

    /** Der am längsten nicht gespielte Platz - ihn ersetzt eine neue Karriere, wenn alles belegt ist */
    static aeltesterPlatz() {
        const belegt = GameState.speicherplaetze().filter(p => p.zusammenfassung);
        if (!belegt.length) return GameState.SPEICHERPLATZ;
        belegt.sort((a, b) => (Date.parse(a.zusammenfassung.lastSaved) || 0) - (Date.parse(b.zusammenfassung.lastSaved) || 0));
        return belegt[0].schluessel;
    }

    /** Der zuletzt gespielte Platz - mit ihm geht es auf dem Startbildschirm weiter */
    static juengsterPlatz() {
        const belegt = GameState.speicherplaetze().filter(p => p.zusammenfassung);
        if (!belegt.length) return null;
        belegt.sort((a, b) => (Date.parse(b.zusammenfassung.lastSaved) || 0) - (Date.parse(a.zusammenfassung.lastSaved) || 0));
        return belegt[0].schluessel;
    }

    static _lsLies(schluessel) {
        try { return localStorage.getItem(schluessel); } catch (e) { return null; }
    }

    static _lsEntferne(schluessel) {
        try { localStorage.removeItem(schluessel); } catch (e) { /* ohne LocalStorage */ }
    }

    saveToLocalStorage(slotKey = null, sofort = false) {
        slotKey = GameState._platz(slotKey);
        if (!sofort && typeof setTimeout === "function") {
            this._saveAusstehend = slotKey;
            if (this._saveTimer) return true;
            this._saveTimer = setTimeout(() => {
                this._saveTimer = null;
                const ziel = this._saveAusstehend || slotKey;
                this._saveAusstehend = null;
                this.saveToLocalStorage(ziel, true);
            }, GameState.SAVE_SAMMELZEIT_MS);
            return true;
        }
        return this._schreibeJetzt(slotKey);
    }

    /**
     * Den Stand sofort schreiben.
     * `sicherung`: "faellig" (Standard) legt eine Sicherung an, wenn eine
     * Spielwoche um ist, "immer" in jedem Fall, "nie" gar nicht.
     */
    _schreibeJetzt(slotKey, sicherung = "faellig") {
        try {
            this.lastSaved = new Date().toISOString();
            const codec = GameState._getSaveCodec();
            const payload = codec ? codec.encodeState(this) : this;
            const text = JSON.stringify(payload);
            const zusammenfassung = GameState._zusammenfassungAus(this);
            if (GameState._idbAktiv) {
                if (slotKey === GameState.aktiverPlatz()) GameState._spiegel[slotKey] = text;
                GameState._sichereInIdb(this, slotKey, text, zusammenfassung, sicherung);
                return true;
            }
            localStorage.setItem(slotKey, text);
            if (slotKey === GameState.aktiverPlatz()) GameState._spiegel[slotKey] = text;
            GameState._trageEinLs(slotKey, zusammenfassung);
            this._saveFehler = null;
            return true;
        } catch (e) {
            // Ein fehlgeschlagener Speichervorgang wurde bisher nur auf die
            // Konsole geschrieben, und kein Aufrufer prüfte den Rückgabewert.
            // Man spielte also weiter und verlor beim nächsten Laden alles.
            console.error("Speichern fehlgeschlagen:", e);
            this._saveFehler = GameState._speicherfehlerText(e);
            GameState._meldeSpeicherfehler(this._saveFehler);
            return false;
        }
    }

    /** Ohne IndexedDB: das Verzeichnis im LocalStorage nachführen */
    static _trageEinLs(slotKey, zusammenfassung) {
        const v = GameState.verzeichnis();
        if (zusammenfassung) v.plaetze[slotKey] = zusammenfassung;
        try {
            localStorage.setItem(GameState.VERZEICHNIS, JSON.stringify(v));
        } catch (e) {
            // Das Verzeichnis lässt sich aus den Ständen neu bilden
            console.warn("Verzeichnis der Spielstände nicht gesichert:", e);
        }
    }

    static _speicherfehlerText(e) {
        return (e && e.name === "QuotaExceededError")
            ? "Der Speicher des Browsers ist voll - der Spielstand konnte nicht gesichert werden. Exportieren Sie ihn als Datei."
            : `Der Spielstand konnte nicht gesichert werden (${e?.name || "Fehler"}).`;
    }

    /** Fortschritt im Spiel in Kalendertagen, über Saisons hinweg vergleichbar */
    static _spieltage(z) {
        return (Number(z?.seasonYear) || 0) * 1000 + (Number(z?.tag) || 0);
    }

    /**
     * Ist eine Sicherung fällig? Ja, wenn keine vorhandene Sicherung aus den
     * letzten sieben Kalendertagen vor dem jetzigen Stand stammt. Wer eine
     * ältere Sicherung zurückholt, bekommt so bald wieder eine frische.
     */
    static _sicherungFaellig(sicherungen, z) {
        const jetzt = GameState._spieltage(z);
        return !sicherungen.some(s => {
            const abstand = jetzt - GameState._spieltage(s);
            return abstand >= 0 && abstand < GameState.SICHERUNG_ABSTAND_TAGE;
        });
    }

    /**
     * In IndexedDB schreiben: Stand, Verzeichnis und eine fällige Sicherung
     * in einem Vorgang. Die Vorgänge laufen in der Reihenfolge, in der sie
     * angestoßen wurden - der letzte Stand gewinnt also immer.
     * Scheitert IndexedDB, springt der LocalStorage ein, solange der Stand
     * hineinpasst. Ein Stand dort ist dann immer der neueste; gelingt der
     * nächste Schreibvorgang in IndexedDB, wird er wieder freigegeben.
     */
    static _sichereInIdb(state, slotKey, text, zusammenfassung, sicherung = "faellig") {
        const db = GameState._getSpeicherDB();
        const v = GameState.verzeichnis();
        const eintraege = { [slotKey]: text };
        const loeschen = [];
        let liste = (v.sicherungen[slotKey] || []).slice();
        // Eine andere Karriere auf diesem Platz: Die alten Sicherungen gehören nicht zu ihr
        const vorher = v.plaetze[slotKey];
        if (vorher && zusammenfassung && vorher.saveId !== zusammenfassung.saveId) {
            liste.forEach(s => loeschen.push(s.schluessel));
            liste = [];
        }
        let neu = null;
        if (zusammenfassung && (sicherung === "immer" || (sicherung === "faellig" && GameState._sicherungFaellig(liste, zusammenfassung)))) {
            neu = `${slotKey}__sicherung_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
            eintraege[neu] = text;
            liste.unshift(Object.assign({}, zusammenfassung, { schluessel: neu }));
            while (liste.length > GameState.SICHERUNGEN_JE_PLATZ) loeschen.push(liste.pop().schluessel);
        }
        if (zusammenfassung) v.plaetze[slotKey] = zusammenfassung;
        v.sicherungen[slotKey] = liste;
        eintraege[GameState.VERZEICHNIS] = JSON.stringify(v);

        const vorgang = db.schreibeMehrere(eintraege, loeschen).then(() => {
            GameState._lsEntferne(slotKey);
            state._saveFehler = null;
            return true;
        }).catch(fehler => {
            console.error("Speichern in IndexedDB fehlgeschlagen:", fehler);
            // Die Sicherung kam nicht an - nicht anbieten, was es nicht gibt
            if (neu && v.sicherungen[slotKey]) v.sicherungen[slotKey] = v.sicherungen[slotKey].filter(s => s.schluessel !== neu);
            try {
                localStorage.setItem(slotKey, text);
                state._saveFehler = null;
                return true;
            } catch (e) {
                state._saveFehler = GameState._speicherfehlerText(fehler && fehler.name === "QuotaExceededError" ? fehler : e);
                GameState._meldeSpeicherfehler(state._saveFehler);
                return false;
            }
        });
        GameState._letzteSicherung = vorgang;
        return vorgang;
    }

    /**
     * Beim Start: Datenbank öffnen, das Verzeichnis und den zuletzt
     * gespielten Stand einlesen. Stände aus dem LocalStorage ziehen nach
     * IndexedDB um; liegen in beiden Speichern Stände für denselben Platz,
     * gilt der jüngere. Fehlt das Verzeichnis (erster Start dieser Fassung),
     * wird es einmalig aus den Ständen gebildet.
     */
    static bereiteSpeicherVor() {
        GameState._verzeichnis = null;
        GameState._aktiverPlatz = null;
        const db = GameState._getSpeicherDB();
        if (!db || !db.verfuegbar()) {
            GameState._idbAktiv = false;
            GameState._aktiverPlatz = GameState.juengsterPlatz();
            return Promise.resolve({ ort: "localStorage" });
        }
        const plaetze = GameState.alleSpeicherplaetze();
        let verzeichnisText = null;
        const lsTexte = {};
        const idbTexte = {};
        return db.oeffne()
            .then(() => db.lies(GameState.VERZEICHNIS))
            .then(text => {
                verzeichnisText = typeof text === "string" ? text : null;
                plaetze.forEach(k => { const t = GameState._lsLies(k); if (t) lsTexte[k] = t; });
                // Die Kette beginnt bei der Datenbank selbst, nicht bei einem
                // fremden Promise - so bleibt sie in deren Takt
                let kette = db.oeffne();
                plaetze.filter(k => !verzeichnisText || lsTexte[k]).forEach(k => {
                    kette = kette
                        .then(() => db.lies(k))
                        .then(t => { idbTexte[k] = typeof t === "string" ? t : null; });
                });
                return kette;
            })
            .then(() => {
                const v = GameState._alsVerzeichnis(verzeichnisText);
                const eintraege = {};
                let umgezogen = false;
                plaetze.forEach(k => {
                    if (!(k in idbTexte)) return;
                    const idbText = idbTexte[k];
                    const lsText = lsTexte[k] || null;
                    let text = idbText;
                    if (lsText && (!idbText || GameState._gespeichertAm(lsText) >= GameState._gespeichertAm(idbText))) {
                        text = lsText;
                        eintraege[k] = lsText;
                        umgezogen = true;
                    }
                    const z = text ? GameState._zusammenfassungAusText(text) : null;
                    if (z) v.plaetze[k] = z;
                    else delete v.plaetze[k];
                    if (text) GameState._spiegel[k] = text;
                });
                GameState._verzeichnis = v;
                GameState._idbAktiv = true;
                const aktiv = GameState.juengsterPlatz() || GameState.SPEICHERPLATZ;
                GameState._aktiverPlatz = aktiv;
                // Nur den aktiven Stand im Speicher halten
                Object.keys(GameState._spiegel).forEach(k => { if (k !== aktiv) delete GameState._spiegel[k]; });
                db.bitteUmDauerhaftenSpeicher();
                const geaendert = Object.keys(eintraege).length > 0 || !verzeichnisText;
                if (geaendert) eintraege[GameState.VERZEICHNIS] = JSON.stringify(v);
                return (geaendert ? db.schreibeMehrere(eintraege, []) : db.oeffne())
                    .then(() => {
                        // Erst wenn IndexedDB den Stand sicher hat, den LocalStorage freigeben
                        Object.keys(lsTexte).forEach(k => GameState._lsEntferne(k));
                        GameState._lsEntferne(GameState.VERZEICHNIS);
                    }, e => {
                        // Gelesen werden konnte - also bei IndexedDB bleiben und
                        // den LocalStorage als Ausweichquartier stehen lassen
                        console.warn("Umzug nach IndexedDB nicht geschrieben, der LocalStorage bleibt:", e);
                    })
                    .then(() => {
                        if (GameState._spiegel[aktiv] || !v.plaetze[aktiv]) return null;
                        return db.lies(aktiv).then(t => { if (typeof t === "string") GameState._spiegel[aktiv] = t; });
                    })
                    .then(() => GameState._raeumeSicherungenAuf(db, v))
                    .then(() => ({ ort: "indexedDB", umgezogen }));
            })
            .catch(e => {
                console.warn("IndexedDB nicht nutzbar, der Spielstand bleibt im LocalStorage:", e);
                GameState._idbAktiv = false;
                GameState._verzeichnis = null;
                GameState._aktiverPlatz = GameState.juengsterPlatz();
                return { ort: "localStorage", fehler: e?.message || String(e) };
            });
    }

    /**
     * Sicherungen, die kein Verzeichnis mehr kennt (etwa nach einem
     * abgebrochenen Schreibvorgang), belegen nur Platz - weg damit.
     */
    static _raeumeSicherungenAuf(db, v) {
        if (typeof db.schluessel !== "function") return null;
        const bekannt = new Set();
        Object.values(v.sicherungen).forEach(liste => (liste || []).forEach(s => bekannt.add(s.schluessel)));
        return db.schluessel()
            .then(alle => {
                const verwaist = (alle || []).filter(k => typeof k === "string" && k.includes("__sicherung_") && !bekannt.has(k));
                return verwaist.length ? db.schreibeMehrere({}, verwaist) : true;
            })
            .catch(e => console.warn("Aufräumen der Sicherungen übersprungen:", e));
    }

    /** Zeitpunkt eines gespeicherten Stands, ohne ihn ganz aufzufalten */
    static _gespeichertAm(text) {
        try {
            const roh = JSON.parse(text);
            return Date.parse(roh?.lastSaved || "") || 0;
        } catch (e) {
            return 0;
        }
    }

    /** Sicherstellen, dass nichts mehr in der Warteschlange hängt */
    flushSave(slotKey = null) {
        if (this._saveTimer && typeof clearTimeout === "function") {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        const ziel = this._saveAusstehend || GameState._platz(slotKey);
        this._saveAusstehend = null;
        return this.saveToLocalStorage(ziel, true);
    }

    /** Wie flushSave, wartet aber, bis der Stand wirklich geschrieben ist */
    sichereJetzt(slotKey = null) {
        const ok = this.flushSave(slotKey);
        if (GameState._idbAktiv && GameState._letzteSicherung) return GameState._letzteSicherung;
        return Promise.resolve(ok);
    }

    /** Eine gesammelte, noch nicht geschriebene Sicherung verwerfen - etwa wenn der Platz gelöscht wird */
    verwirfAusstehendes() {
        if (this._saveTimer && typeof clearTimeout === "function") clearTimeout(this._saveTimer);
        this._saveTimer = null;
        this._saveAusstehend = null;
    }

    /** Von Hand eine Sicherung anlegen, auch wenn noch keine Spielwoche um ist */
    legeSicherungAn() {
        this.verwirfAusstehendes();
        if (!GameState._idbAktiv) return Promise.resolve(false);
        const ok = this._schreibeJetzt(GameState.aktiverPlatz(), "immer");
        return ok ? GameState._letzteSicherung : Promise.resolve(false);
    }

    /** Den laufenden Stand zusätzlich auf einen anderen Platz kopieren */
    sichereKopie(zielPlatz) {
        if (!GameState.alleSpeicherplaetze().includes(zielPlatz) || zielPlatz === GameState.aktiverPlatz()) {
            return Promise.resolve(false);
        }
        this.flushSave();
        const ok = this._schreibeJetzt(zielPlatz, "nie");
        if (GameState._idbAktiv && ok) return GameState._letzteSicherung;
        return Promise.resolve(ok);
    }

    /** Ein Speicherfehler darf nicht stumm bleiben */
    static _meldeSpeicherfehler(text) {
        if (typeof window === "undefined") return;
        // Nicht bei jedem Versuch aufs Neue anschlagen
        if (window.__speicherfehlerGemeldet === text) return;
        window.__speicherfehlerGemeldet = text;
        const ui = window.appInstance?.ui;
        if (ui && typeof ui.showToast === "function") {
            ui.showToast(text, "error");
        } else if (typeof window.alert === "function") {
            window.alert(text);
        }
    }

    static _resolveEngine(name, path) {
        if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
        if (typeof window !== "undefined" && window[name]) return window[name];
        if (typeof require !== "undefined") {
            try {
                const mod = require(path);
                if (mod && mod[name]) return mod[name];
            } catch (e) { /* im Browser nicht vorhanden */ }
        }
        return null;
    }

    static _getSaveCodec() {
        return GameState._resolveEngine("SaveCodec", "../services/saveCodec.js");
    }

    /** Der gespeicherte Text: aus dem Spiegel, wenn IndexedDB führt */
    static _gespeicherterText(slotKey) {
        slotKey = GameState._platz(slotKey);
        if (GameState._idbAktiv) return GameState._spiegel[slotKey] || null;
        return localStorage.getItem(slotKey);
    }

    /** Den Text eines Platzes oder einer Sicherung holen, notfalls aus IndexedDB */
    static _liesText(schluessel) {
        if (!GameState._idbAktiv) return Promise.resolve(GameState._lsLies(schluessel));
        if (GameState._spiegel[schluessel]) return Promise.resolve(GameState._spiegel[schluessel]);
        return GameState._getSpeicherDB().lies(schluessel).then(t => (typeof t === "string" ? t : null));
    }

    static _ausText(raw) {
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const codec = GameState._getSaveCodec();
        return (codec && codec.isEncoded(parsed)) ? codec.decodeState(parsed) : parsed;
    }

    static _readStoredState(slotKey) {
        return GameState._ausText(GameState._gespeicherterText(slotKey));
    }

    static _zuState(daten) {
        if (!daten) return null;
        const state = Object.assign(new GameState(), daten);
        GameState.registerCustomFormations(state);
        GameState.sichereSignaturen(state);
        return state;
    }

    /**
     * Was Startbildschirm und Speicherplätze über einen Stand zeigen. Geht
     * mit einem eingelesenen Stand ebenso wie mit dem laufenden Spiel.
     */
    static _zusammenfassungAus(parsed) {
        try {
            if (!parsed || !parsed.userClubId || !parsed.clubs) return null;
            const userClub = parsed.clubs.find(c => c.id === parsed.userClubId);
            const leagueClubs = parsed.clubs.filter(c => c.leagueId === userClub?.leagueId);
            const standings = GameState.calculateStandings(
                leagueClubs.length > 1 ? leagueClubs : parsed.clubs,
                parsed.schedule,
                parsed.currentMatchday - 1
            );
            const userRank = standings.findIndex(s => s.clubId === parsed.userClubId) + 1;

            return {
                saveId: parsed.saveId || "save_legacy",
                managerName: parsed.managerName || "Trainer",
                managerNationality: parsed.managerNationality || "Deutschland",
                clubId: parsed.userClubId,
                clubName: userClub ? userClub.name : "Unbekannt",
                // Für das Wappen auf der Weiterspielen-Karte
                primaryColor: userClub?.primaryColor || null,
                secondaryColor: userClub?.secondaryColor || null,
                leagueName: parsed.leagueName || "Deutschland Liga 1",
                seasonYear: parsed.seasonYear || 1,
                currentMatchday: parsed.currentMatchday || 1,
                totalMatchdays: parsed.totalMatchdays || (parsed.schedule ? parsed.schedule.length : 34),
                userRank: userRank > 0 ? userRank : 1,
                lastSaved: parsed.lastSaved || new Date().toISOString(),
                difficulty: parsed.difficulty || "normal",
                balance: userClub ? userClub.balance : 0,
                // Kalendertag im Spiel - daran misst sich der Abstand der Sicherungen
                currentDate: parsed.currentDate || null,
                tag: parsed.currentDayIndex || 0
            };
        } catch (e) {
            return null;
        }
    }

    static _zusammenfassungAusText(text) {
        try {
            return text ? GameState._zusammenfassungAus(GameState._ausText(text)) : null;
        } catch (e) {
            return null;
        }
    }

    static getSaveSummary(slotKey = null) {
        slotKey = GameState._platz(slotKey);
        const bekannt = GameState.verzeichnis().plaetze[slotKey];
        if (bekannt) return bekannt;
        try {
            return GameState._zusammenfassungAus(GameState._readStoredState(slotKey));
        } catch (e) {
            return null;
        }
    }

    static loadFromLocalStorage(slotKey = null) {
        try {
            return GameState._zuState(GameState._readStoredState(slotKey));
        } catch (e) {
            console.error("Laden fehlgeschlagen:", e);
            return null;
        }
    }

    /**
     * Einen Platz laden und zum aktiven machen. Asynchron, weil ein anderer
     * als der zuletzt gespielte Platz erst aus IndexedDB gelesen wird.
     */
    static ladePlatz(slotKey = null) {
        slotKey = GameState._platz(slotKey);
        return GameState._liesText(slotKey).then(text => {
            const state = GameState._zuState(GameState._ausText(text));
            if (!state) return null;
            GameState.setzeAktivenPlatz(slotKey);
            if (GameState._idbAktiv) GameState._spiegel[slotKey] = text;
            return state;
        }).catch(e => {
            console.error("Laden fehlgeschlagen:", e);
            return null;
        });
    }

    /** Eine Sicherung einlesen. Gespeichert wird sie erst, wenn man mit ihr weiterspielt. */
    static ladeSicherung(schluessel) {
        if (!GameState._idbAktiv || !schluessel) return Promise.resolve(null);
        return GameState._getSpeicherDB().lies(schluessel)
            .then(text => GameState._zuState(GameState._ausText(typeof text === "string" ? text : null)))
            .catch(e => {
                console.error("Sicherung nicht lesbar:", e);
                return null;
            });
    }

    /** Einen Platz mit allen seinen Sicherungen löschen */
    static deleteSavegame(slotKey = null) {
        slotKey = GameState._platz(slotKey);
        delete GameState._spiegel[slotKey];
        const v = GameState.verzeichnis();
        const sicherungen = (v.sicherungen[slotKey] || []).map(s => s.schluessel);
        delete v.plaetze[slotKey];
        delete v.sicherungen[slotKey];
        const db = GameState._getSpeicherDB();
        if (GameState._idbAktiv && db) {
            db.schreibeMehrere({ [GameState.VERZEICHNIS]: JSON.stringify(v) }, [slotKey, ...sicherungen])
                .catch(e => console.error("Löschen in IndexedDB fehlgeschlagen:", e));
        }
        try {
            localStorage.removeItem(slotKey);
            if (!GameState._idbAktiv) localStorage.setItem(GameState.VERZEICHNIS, JSON.stringify(v));
            return true;
        } catch (e) {
            return GameState._idbAktiv;
        }
    }

    getExportFileName() {
        const clubClean = (this.clubs.find(c => c.id === this.userClubId)?.name || "club").toLowerCase().replace(/[^a-z0-9]/g, "-");
        return `fm-save-${clubClean}-saison-${this.seasonYear}-spieltag-${this.currentMatchday}.json`;
    }

    /**
     * Der Spielstand als Datei. Verdichtet wie im Browserspeicher - die
     * eingerückte Rohfassung war für eine Welt nach ein paar Saisons über
     * zwanzig Megabyte groß.
     */
    exportToJson() {
        this.lastSaved = new Date().toISOString();
        const codec = GameState._getSaveCodec();
        return JSON.stringify(codec ? codec.encodeState(this) : this);
    }

    static importFromJson(jsonString) {
        try {
            if (!jsonString || typeof jsonString !== "string") {
                throw new Error("Leere oder ungültige Datei");
            }
            let parsed = JSON.parse(jsonString);
            const codec = GameState._getSaveCodec();
            if (codec && codec.isEncoded(parsed)) parsed = codec.decodeState(parsed);
            if (!parsed.clubs || !Array.isArray(parsed.clubs) || parsed.clubs.length === 0) {
                throw new Error("Fehlende Vereinsdaten im Spielstand.");
            }
            if (!parsed.players || !Array.isArray(parsed.players) || parsed.players.length === 0) {
                throw new Error("Fehlende Spielerdaten im Spielstand.");
            }
            if (!parsed.schedule || !Array.isArray(parsed.schedule)) {
                throw new Error("Fehlender Spielplan im Spielstand.");
            }
            if (!parsed.userClubId) {
                throw new Error("Kein ausgewählter Benutzer-Verein im Spielstand vorhanden.");
            }

            const state = Object.assign(new GameState(), parsed);
            GameState.registerCustomFormations(state);
            GameState.sichereSignaturen(state);
            return { success: true, state };
        } catch (e) {
            console.error("Import fehlgeschlagen:", e);
            return { success: false, error: e.message || "Ungültiges Format" };
        }
    }
}

if (typeof window !== "undefined") {
    window.GameState = GameState;
    window.FORMATION_CONFIGS = FORMATION_CONFIGS;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameState, FORMATION_CONFIGS };
}