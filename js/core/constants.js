/**
 * Zentral definierte Konstanten für den Fußballmanager
 */

const APP_VERSION = "0.2.0";
const SAVE_SCHEMA_VERSION = 2;

const BOARD_EXPECTATIONS = {
    CHAMPIONSHIP: "championship",
    TOP3: "top3",
    MIDFIELD: "midfield",
    AVOID_RELEGATION: "avoid_relegation"
};

const DIFFICULTIES = {
    EASY: "easy",
    NORMAL: "normal",
    HARD: "hard"
};

const PLAYER_POSITIONS = {
    GK: "TW",
    CB: "IV",
    LB: "LV",
    RB: "RV",
    DM: "DM",
    CM: "ZM",
    AM: "OM",
    LM: "LM",
    RM: "RM",
    LW: "LA",
    RW: "RA",
    ST: "ST"
};

const POSITION_ROLES = {
    TW: "Torwart",
    IV: "Innenverteidiger",
    LV: "Linksverteidiger",
    RV: "Rechtsverteidiger",
    DM: "Defensives Mittelfeld",
    ZM: "Zentrales Mittelfeld",
    OM: "Offensives Mittelfeld",
    LM: "Linkes Mittelfeld",
    RM: "Rechtes Mittelfeld",
    LA: "Linksaußen",
    RA: "Rechtsaußen",
    ST: "Stürmer"
};

const TACTICS_CONFIG = {
    MENTALITIES: {
        VERY_DEFENSIVE: "very_defensive",
        DEFENSIVE: "defensive",
        BALANCED: "balanced",
        OFFENSIVE: "offensive",
        VERY_OFFENSIVE: "very_offensive"
    },
    PRESSING: {
        LOW: "low",
        MEDIUM: "medium",
        HIGH: "high"
    },
    TEMPO: {
        SLOW: "slow",
        NORMAL: "normal",
        FAST: "fast"
    },
    PASSING: {
        SHORT: "short",
        MIXED: "mixed",
        DIRECT: "direct"
    },
    ATTACK_FOCUS: {
        LEFT: "left",
        CENTER: "center",
        RIGHT: "right",
        BALANCED: "balanced"
    },
    DEFENSIVE_LINE: {
        DEEP: "deep",
        MEDIUM: "medium",
        HIGH: "high"
    },
    RISK: {
        SAFE: "safe",
        NORMAL: "normal",
        RISKY: "risky"
    }
};

const TRAINING_TYPES = {
    ALLROUND: "allround",
    FITNESS: "fitness",
    REGENERATION: "regeneration",
    ATTACK: "attack",
    DEFENSE: "defense",
    TACTICS: "tactics",
    YOUTH: "youth",
    GOALKEEPER: "goalkeeper",
    SET_PIECES: "set_pieces"
};

const TRAINING_INTENSITY = {
    LOW: "low",
    NORMAL: "normal",
    HIGH: "high"
};

const SQUAD_ROLES = {
    KEY_PLAYER: "Schlüsselspieler",
    STARTER: "Stammspieler",
    ROTATION: "Rotationsspieler",
    BACKUP: "Ergänzungsspieler",
    TALENT: "Zukunftstalent"
};

const INJURY_TYPES = {
    LIGHT: { name: "Leichte Blessur", minWeeks: 1, maxWeeks: 2 },
    MEDIUM: { name: "Muskelverletzung", minWeeks: 3, maxWeeks: 6 },
    HEAVY: { name: "Bänder- oder Sehnenriss", minWeeks: 8, maxWeeks: 16 }
};

const NEWS_TYPES = {
    MATCH_PREVIEW: "match_preview",
    MATCH_REPORT: "match_report",
    INJURY: "injury",
    SUSPENSION: "suspension",
    TRANSFER_OFFER: "transfer_offer",
    TRANSFER_DONE: "transfer_done",
    CONTRACT_EXPIRING: "contract_expiring",
    TRAINING_REPORT: "training_report",
    BOARD_MESSAGE: "board_message",
    FINANCES: "finances",
    SCOUTING: "scouting",
    YOUTH: "youth",
    SEASON_START: "season_start",
    SEASON_END: "season_end"
};

// matchSecondsPerRealSecond bestimmt, wie schnell die Spieluhr im 2D-Livespiel
// läuft. Der Wert ist der eigentliche Tempo-Regler: 90 Minuten dauern damit
// rund sieben (langsam), drei (normal) beziehungsweise anderthalb echte
// Minuten. Während Höhepunkten, Standards und der Anstoß-Zeremonie bremst die
// Regie die Uhr ohnehin ab, sodass die entscheidenden Szenen in Ruhe laufen.
// tickIntervalMs/minuteStep gelten weiterhin für den Minutentakt der
// Sofortsimulation und als Rückfallebene ohne Regie.
const LIVE_MATCH_SPEEDS = {
    1: { key: "slow", label: "Langsam", tickIntervalMs: 2200, minuteStep: 1, matchSecondsPerRealSecond: 13 },
    2: { key: "normal", label: "Normal", tickIntervalMs: 1200, minuteStep: 1, matchSecondsPerRealSecond: 30 },
    4: { key: "fast", label: "Schnell", tickIntervalMs: 500, minuteStep: 2, matchSecondsPerRealSecond: 66 },
    slow: { key: "slow", label: "Langsam", tickIntervalMs: 2200, minuteStep: 1, matchSecondsPerRealSecond: 13 },
    normal: { key: "normal", label: "Normal", tickIntervalMs: 1200, minuteStep: 1, matchSecondsPerRealSecond: 30 },
    fast: { key: "fast", label: "Schnell", tickIntervalMs: 500, minuteStep: 2, matchSecondsPerRealSecond: 66 }
};

if (typeof window !== "undefined") {
    window.APP_VERSION = APP_VERSION;
    window.SAVE_SCHEMA_VERSION = SAVE_SCHEMA_VERSION;
    window.BOARD_EXPECTATIONS = BOARD_EXPECTATIONS;
    window.DIFFICULTIES = DIFFICULTIES;
    window.PLAYER_POSITIONS = PLAYER_POSITIONS;
    window.POSITION_ROLES = POSITION_ROLES;
    window.TACTICS_CONFIG = TACTICS_CONFIG;
    window.TRAINING_TYPES = TRAINING_TYPES;
    window.TRAINING_INTENSITY = TRAINING_INTENSITY;
    window.SQUAD_ROLES = SQUAD_ROLES;
    window.INJURY_TYPES = INJURY_TYPES;
    window.NEWS_TYPES = NEWS_TYPES;
    window.LIVE_MATCH_SPEEDS = LIVE_MATCH_SPEEDS;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        APP_VERSION,
        SAVE_SCHEMA_VERSION,
        BOARD_EXPECTATIONS,
        DIFFICULTIES,
        PLAYER_POSITIONS,
        POSITION_ROLES,
        TACTICS_CONFIG,
        TRAINING_TYPES,
        TRAINING_INTENSITY,
        SQUAD_ROLES,
        INJURY_TYPES,
        NEWS_TYPES,
        LIVE_MATCH_SPEEDS
    };
}
