/**
 * Test-Suite 1: Daten-Integrität und Strukturprüfungen (initialData.js)
 */
const { INITIAL_TEAMS_DATA } = require('./js/data/initialData.js');

function runDataTests() {
    console.log("\n=======================================================");
    console.log("   [TEST SUITE: DATA INTEGRITY] initialData.js        ");
    console.log("=======================================================");

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ ${name}`);
            console.error(`     Fehler: ${err.message}`);
            failed++;
        }
    }

    test("INITIAL_TEAMS_DATA ist ein valides Array mit Daten", () => {
        if (!Array.isArray(INITIAL_TEAMS_DATA)) throw new Error("INITIAL_TEAMS_DATA ist kein Array");
        if (INITIAL_TEAMS_DATA.length === 0) throw new Error("INITIAL_TEAMS_DATA ist leer");
    });

    test("INITIAL_TEAMS_DATA enthält genau 18 Vereine", () => {
        if (INITIAL_TEAMS_DATA.length !== 18) {
            throw new Error(`Erwartet 18 Vereine, erhalten: ${INITIAL_TEAMS_DATA.length}`);
        }
    });

    test("Jeder Verein besitzt alle Pflichtfelder und eindeutige IDs", () => {
        const seenIds = new Set();
        const validExpectations = ["championship", "top3", "midfield", "avoid_relegation"];

        INITIAL_TEAMS_DATA.forEach((club, index) => {
            if (!club.id || typeof club.id !== "string") throw new Error(`Club #${index} hat ungültige ID`);
            if (seenIds.has(club.id)) throw new Error(`Doppelte Club-ID: ${club.id}`);
            seenIds.add(club.id);

            if (!club.name || typeof club.name !== "string") throw new Error(`Club ${club.id} hat keinen Namen`);
            if (!club.city || typeof club.city !== "string") throw new Error(`Club ${club.id} hat keine Stadt`);
            if (!club.stadium || typeof club.stadium !== "string") throw new Error(`Club ${club.id} hat kein Stadion`);
            if (typeof club.capacity !== "number" || club.capacity <= 0 || isNaN(club.capacity)) {
                throw new Error(`Club ${club.id} hat ungültige Kapazität`);
            }
            if (typeof club.transferBudget !== "number" || club.transferBudget < 0 || isNaN(club.transferBudget)) {
                throw new Error(`Club ${club.id} hat ungültiges Transferbudget`);
            }
            if (typeof club.wageBudget !== "number" || club.wageBudget <= 0 || isNaN(club.wageBudget)) {
                throw new Error(`Club ${club.id} hat ungültiges Gehaltsbudget`);
            }
            if (!validExpectations.includes(club.boardExpectation)) {
                throw new Error(`Club ${club.id} hat ungültige Vorstandserwartung: ${club.boardExpectation}`);
            }
            if (!Array.isArray(club.players) || club.players.length < 11) {
                throw new Error(`Club ${club.id} hat weniger als 11 Spieler`);
            }
        });
    });

    test("Jeder Verein hat mindestens einen Torwart (pos: 'TW')", () => {
        INITIAL_TEAMS_DATA.forEach(club => {
            const tws = club.players.filter(p => p.pos === "TW");
            if (tws.length < 1) throw new Error(`Club ${club.name} (${club.id}) hat keinen Torwart!`);
        });
    });

    test("Alle Spieler besitzen vollständige Attribute ohne NaN-Werte", () => {
        const validPositions = ["TW", "IV", "LV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"];

        INITIAL_TEAMS_DATA.forEach(club => {
            club.players.forEach(p => {
                if (!p.name) throw new Error(`Spieler in ${club.name} hat keinen Namen`);
                if (!validPositions.includes(p.pos)) throw new Error(`Spieler ${p.name} hat ungültige Position: ${p.pos}`);
                if (typeof p.age !== "number" || p.age < 15 || p.age > 45 || isNaN(p.age)) {
                    throw new Error(`Spieler ${p.name} hat ungültiges Alter: ${p.age}`);
                }
                if (typeof p.overall !== "number" || p.overall < 40 || p.overall > 99 || isNaN(p.overall)) {
                    throw new Error(`Spieler ${p.name} hat ungültigen Gesamtwert: ${p.overall}`);
                }
                if (typeof p.pot !== "number" || p.pot < p.overall || isNaN(p.pot)) {
                    throw new Error(`Spieler ${p.name} hat ungültiges Potenzial: ${p.pot} (OVR: ${p.overall})`);
                }
                if (typeof p.value !== "number" || p.value < 0 || isNaN(p.value)) {
                    throw new Error(`Spieler ${p.name} hat ungültigen Marktwert: ${p.value}`);
                }
                if (typeof p.wage !== "number" || p.wage < 0 || isNaN(p.wage)) {
                    throw new Error(`Spieler ${p.name} hat ungültiges Gehalt: ${p.wage}`);
                }
                if (p.pos === "TW") {
                    if (typeof p.reflexes !== "number" || isNaN(p.reflexes)) throw new Error(`TW ${p.name} fehlt Reflex-Wert`);
                    if (typeof p.handling !== "number" || isNaN(p.handling)) throw new Error(`TW ${p.name} fehlt Handling-Wert`);
                } else {
                    if (typeof p.pace !== "number" || isNaN(p.pace)) throw new Error(`Feldspieler ${p.name} fehlt Pace-Wert`);
                    if (typeof p.shooting !== "number" || isNaN(p.shooting)) throw new Error(`Feldspieler ${p.name} fehlt Shooting-Wert`);
                }
            });
        });
    });

    test("Node.js und Browser Export-Verfügbarkeit", () => {
        const fs = require('fs');
        const content = fs.readFileSync('./js/data/initialData.js', 'utf8');
        if (!content.includes('window.INITIAL_TEAMS_DATA = INITIAL_TEAMS_DATA;')) {
            throw new Error("window.INITIAL_TEAMS_DATA Export fehlt in initialData.js");
        }
        if (!content.includes('module.exports = { INITIAL_TEAMS_DATA };')) {
            throw new Error("module.exports fehlt in initialData.js");
        }
    });

    console.log(`\n  Ergebnis Data-Tests: ${passed} bestanden, ${failed} fehlgeschlagen.`);
    if (failed > 0) throw new Error(`${failed} Data-Tests fehlgeschlagen.`);
    return { passed, failed };
}

if (require.main === module) {
    runDataTests();
}

module.exports = { runDataTests };
