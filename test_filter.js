/**
 * Gemeinsame Hilfen für die Test-Suiten
 *
 *   TEST_FILTER="Leihen|Transfer" node test_runner.js   nur passende Tests ausführen
 *   TEST_ZEIT=1 node test_runner.js                     Laufzeit je Test anzeigen
 *   TEST_SCHNELL=1 node test_runner.js                  ohne die langsamen Tests (unten)
 *   TEST_TEIL=2/4 node test_runner.js                   nur jeden vierten Test, beginnend beim zweiten -
 *                                                       so teilt sich die Suite auf parallele Läufe auf
 */
const muster = process.env.TEST_FILTER ? new RegExp(process.env.TEST_FILTER, "i") : null;
const zeitAnzeigen = !!process.env.TEST_ZEIT;
const schnell = !!process.env.TEST_SCHNELL;

/**
 * Die Tests, die einzeln länger als eine Viertelminute laufen (gemessen mit
 * TEST_ZEIT=1). Zusammen brauchen sie gut zwölf Minuten - im schnellen Lauf
 * fallen sie weg. Vor einem Merge läuft trotzdem die ganze Suite.
 */
const LANGSAM = [
    "SeasonEngine: Verträge laufen aus",
    "SeasonEngine: Komplette Saison simulieren",
    "GameState: Tabelle stimmt Tor für Tor",
    "MatchEngine Kalibrierung: 500 Spiele",
    "MatchEngine Wirksamkeit: very_defensive vs. very_offensive",
    "LiveMatchDirector: Die Mannschaft steht als Block",
    "Alle Formationen: Positionsspiel mit jeder Vorlage"
];
let uebersprungen = 0;

const teil = (() => {
    const m = /^(\d+)\/(\d+)$/.exec(process.env.TEST_TEIL || "");
    if (!m) return null;
    const k = Number(m[1]), n = Number(m[2]);
    if (n < 1 || k < 1 || k > n) throw new Error(`TEST_TEIL=${process.env.TEST_TEIL}: erwartet k/n mit 1 <= k <= n`);
    return { k, n };
})();
let testNummer = 0;

/**
 * Feste Zufallswerte: Jeder Test bekommt einen eigenen Startwert aus seinem
 * Namen. Ein Test liefert damit allein dasselbe Ergebnis wie in der ganzen
 * Suite, und ein Kalibrierungstest schlägt nicht mehr an einem Tag fehl und
 * am nächsten nicht.
 *   TEST_SEED=1234     anderer Startwert für alle Tests
 *   TEST_SEED=zufall   echter Zufall wie früher
 */
const ECHTER_ZUFALL = Math.random;
const startwert = process.env.TEST_SEED === "zufall" ? null : Number(process.env.TEST_SEED || 20251001);

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

/** Vor jedem Test: Zufall auf den Startwert dieses Tests setzen */
function zufallFuer(name) {
    if (startwert === null) { Math.random = ECHTER_ZUFALL; return; }
    let h = 2166136261 ^ startwert;
    for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
    Math.random = mulberry32(h >>> 0);
}

/** Gehört der Test zur Auswahl? Ohne TEST_FILTER laufen alle. */
function testAusgewaehlt(name) {
    if (muster && !muster.test(name)) return false;
    // Reihum verteilt: Die Reihenfolge der Tests ist fest, also auch die Teile
    if (teil && (testNummer++ % teil.n) !== teil.k - 1) return false;
    // Ein ausdrücklich gefilterter Test läuft auch im schnellen Lauf
    if (schnell && !muster && LANGSAM.some(anfang => name.startsWith(anfang))) {
        uebersprungen++;
        console.log(`  ⏭  ${name} (langsam, übersprungen)`);
        return false;
    }
    return true;
}

/** Wie viele langsame Tests der schnelle Lauf ausgelassen hat */
function uebersprungeneTests() {
    return uebersprungen;
}

/** Laufzeit-Zusatz für die Ausgabe, nur mit TEST_ZEIT */
function laufzeit(start) {
    if (!zeitAnzeigen) return "";
    const ms = Date.now() - start;
    return ms >= 1000 ? ` (${(ms / 1000).toFixed(1)} s)` : ` (${ms} ms)`;
}

/** Läuft dieser Prozess die Teile, die es nur einmal braucht (statische Prüfung)? */
function ersterTeil() {
    return !teil || teil.k === 1;
}

module.exports = { testAusgewaehlt, laufzeit, zufallFuer, uebersprungeneTests, ersterTeil, LANGSAM };
