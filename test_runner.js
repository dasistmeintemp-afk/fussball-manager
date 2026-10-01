/**
 * Zentraler Test-Runner für alle Test-Suiten des Fußballmanagers
 */
const { runDataTests } = require('./test_data.js');
const { runWizardTests } = require('./test_wizard.js');
const { runEngineTests } = require('./test_engine.js');
const { runE2ETests } = require('./test_e2e.js');
const { execFileSync } = require('child_process');

/** Statische Prüfung (Syntax, doppelte Methoden, globale Namen) als eigene Suite */
function runPruefung() {
    if (process.env.TEST_FILTER || !require('./test_filter.js').ersterTeil()) return { passed: 0, failed: 0 };
    try {
        console.log("\n  " + execFileSync(process.execPath, [require('path').join(__dirname, 'pruefung.js')], { encoding: "utf8" }).trim());
        return { passed: 1, failed: 0 };
    } catch (err) {
        console.error(String(err.stderr || err.message));
        return { passed: 0, failed: 1 };
    }
}

function runAllSuites() {
    console.log("================================================================================");
    console.log("             🏆 FM PRO - AUTOMATISIERTE TESTSUITE & VALIDIERUNG                ");
    console.log("================================================================================");

    let totalPassed = 0;
    let totalFailed = 0;
    const suiteResults = [];

    const suites = [
        { name: "Statische Prüfung (pruefung.js)", fn: runPruefung },
        { name: "Datenintegrität & Struktur (test_data.js)", fn: runDataTests },
        { name: "Wizard, Filter & UI Regression (test_wizard.js)", fn: runWizardTests },
        { name: "Game Engines & Subsysteme (test_engine.js)", fn: runEngineTests },
        { name: "E2E Karriere- & Saison-Simulation (test_e2e.js)", fn: runE2ETests }
    ];

    for (const s of suites) {
        try {
            const res = s.fn();
            totalPassed += res.passed;
            totalFailed += res.failed;
            suiteResults.push({ name: s.name, passed: res.passed, failed: res.failed, status: res.failed === 0 ? "OK" : "FAILED" });
        } catch (err) {
            totalFailed++;
            suiteResults.push({ name: s.name, passed: 0, failed: 1, status: "ERROR", error: err.message });
        }
    }

    console.log("\n================================================================================");
    console.log("                         📊 GESAMTÜBERSICHT DER TESTS                          ");
    console.log("================================================================================");
    suiteResults.forEach(r => {
        const icon = r.failed === 0 ? "✅" : "❌";
        console.log(`  ${icon} ${r.name.padEnd(55)} [${r.passed} Bestanden, ${r.failed} Fehler]`);
    });

    console.log("--------------------------------------------------------------------------------");
    console.log(`  Gesamtergebnis: ${totalPassed} Tests erfolgreich, ${totalFailed} Tests fehlgeschlagen.`);
    const ausgelassen = require('./test_filter.js').uebersprungeneTests();
    if (ausgelassen) console.log(`  Schneller Lauf: ${ausgelassen} langsame Tests ausgelassen - vor dem Merge die ganze Suite laufen lassen.`);
    console.log("================================================================================");

    if (totalFailed === 0) {
        console.log("\n🎉 Alle Tests bestanden!\n");
        process.exit(0);
    } else {
        console.error(`\n❌ Test fehlgeschlagen: ${totalFailed} Fehler in den Test-Suiten aufgetreten.\n`);
        process.exit(1);
    }
}

if (require.main === module) {
    runAllSuites();
}

module.exports = { runAllSuites };
