/**
 * Gemeinsame Hilfen für die Test-Suiten
 *
 *   TEST_FILTER="Leihen|Transfer" node test_runner.js   nur passende Tests ausführen
 *   TEST_ZEIT=1 node test_runner.js                     Laufzeit je Test anzeigen
 */
const muster = process.env.TEST_FILTER ? new RegExp(process.env.TEST_FILTER, "i") : null;
const zeitAnzeigen = !!process.env.TEST_ZEIT;

/** Gehört der Test zur Auswahl? Ohne TEST_FILTER laufen alle. */
function testAusgewaehlt(name) {
    return !muster || muster.test(name);
}

/** Laufzeit-Zusatz für die Ausgabe, nur mit TEST_ZEIT */
function laufzeit(start) {
    if (!zeitAnzeigen) return "";
    const ms = Date.now() - start;
    return ms >= 1000 ? ` (${(ms / 1000).toFixed(1)} s)` : ` (${ms} ms)`;
}

module.exports = { testAusgewaehlt, laufzeit };
