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

/**
 * Tempostufen der Liveübertragung.
 *
 * matchSecondsPerRealSecond ist der eigentliche Tempo-Regler: Er bestimmt, wie
 * schnell die Spieluhr laeuft. tickIntervalMs/minuteStep gelten weiterhin fuer
 * den Minutentakt der Sofortsimulation und als Rueckfallebene ohne Regie -
 * zusaetzlich steuert tickIntervalMs ueber LiveMatchDirector.getSpeedScale,
 * wie lang eine inszenierte Szene in echten Sekunden dauern darf.
 *
 * Gemessen an ganzen Partien dauerte "Normal" vorher fuenf echte Minuten und
 * "Schnell" knapp drei - fuer ein Spiel, das man nebenbei verfolgt, zu lang.
 * Jetzt sind es rund sechs, vier und zwei Minuten, wobei "Langsam" bewusst die
 * Stufe zum Zuschauen bleibt: Dort muss der Ballaufbau zwischen den
 * Hoehepunkten mehr als die Haelfte der Uebertragung ausmachen.
 */
/**
 * Die Geschwindigkeitsstufen sind Abspielgeschwindigkeiten - nicht drei
 * verschiedene Spiele.
 *
 * Vorher skalierte die Spieluhr linear mit der Stufe, die Bewegung auf dem
 * Feld aber nur mit der Wurzel: Wer schneller zusah, bekam eine Uhr, die den
 * Spielern davonlief. Gemessen war das keine Tempostufe, sondern eine andere
 * Simulation - auf "Langsam" entfielen 37 Prozent der Uebertragung auf Szenen
 * und es gab 258 freie Spielaktionen, auf "Schnell" 70 Prozent und ganze drei.
 * Die schnellste Stufe zeigte kein Fussballspiel mehr, sondern eine Diaschau
 * aus Skriptszenen.
 *
 * Jetzt laeuft eine einzige, glaubwuerdige Simulation, und die Stufe bestimmt,
 * wie schnell sie abgespielt wird - wie bei einem Videorekorder. Uhr, Laufwege
 * und Ballflug skalieren gemeinsam, also sieht "Schnell" aus wie derselbe
 * Fussball im Vorlauf und nicht wie ein anderes Spiel.
 *
 * abspielTempo ist der Faktor; matchSecondsPerRealSecond ist daraus abgeleitet
 * (Grundtakt 8 Spielsekunden je Bildschirmsekunde) und bleibt fuer alles
 * stehen, was die Zahl direkt liest.
 *
 * Gemessen ueber drei Partien je Stufe: 854 / 299 / 133 Sekunden, also rund
 * vierzehn, fuenf und zwei Minuten - und dabei auf jeder Stufe dieselben Werte
 * fuer Ballflug (rund 42 %), Szenenanteil (31 bis 33 %) und freie
 * Spielaktionen (200 bis 220 je Partie). Genau das heisst "eine Simulation,
 * drei Abspielgeschwindigkeiten".
 *
 * "Langsam" ist damit die Stufe, auf der Fussball wie Fussball aussieht:
 * Spieler laufen mit 2.8 Metern je Sekunde im Mittel, der Ball mit 16.7 - das
 * sind die Werte einer echten Uebertragung. "Normal" und "Schnell" zeigen
 * dasselbe Spiel im Vorlauf.
 */
const LIVE_MATCH_SPEEDS = {
    1: { key: "slow", label: "Langsam", tickIntervalMs: 1800, minuteStep: 1, abspielTempo: 1.0, matchSecondsPerRealSecond: 8 },
    2: { key: "normal", label: "Normal", tickIntervalMs: 900, minuteStep: 1, abspielTempo: 2.9, matchSecondsPerRealSecond: 23.2 },
    4: { key: "fast", label: "Schnell", tickIntervalMs: 380, minuteStep: 2, abspielTempo: 6.5, matchSecondsPerRealSecond: 52 },
    slow: { key: "slow", label: "Langsam", tickIntervalMs: 1800, minuteStep: 1, abspielTempo: 1.0, matchSecondsPerRealSecond: 8 },
    normal: { key: "normal", label: "Normal", tickIntervalMs: 900, minuteStep: 1, abspielTempo: 2.9, matchSecondsPerRealSecond: 23.2 },
    fast: { key: "fast", label: "Schnell", tickIntervalMs: 380, minuteStep: 2, abspielTempo: 6.5, matchSecondsPerRealSecond: 52 }
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
