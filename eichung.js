/**
 * Messlauf: Zeitleiste gegen 2D-Modell (Stufe 3 der 2D-Simulation)
 *
 * Das eigene Spiel rechnet das 2D-Modell, alle anderen Spiele der Welt die
 * Zeitleiste. Beide sollen gleich viele Tore, Schüsse, Ecken und Fouls
 * bringen und gleich oft die Heimelf und den Favoriten gewinnen lassen -
 * sonst spielte die eigene Mannschaft in einer anderen Welt als der Rest
 * der Liga.
 *
 * Der Lauf spielt dieselben Paarungen aus der ersten deutschen und der
 * ersten englischen Liga mit beiden Engines, jede Paarung in beiden
 * Richtungen, und vergleicht. Mit --schreiben passt er die Eichung der
 * Zeitleiste an (MATCH_TUNING.eichung2D in js/engine/matchEngine.js):
 * Torchancen, Zahl der Szenen, Paraden, Ecken und Fouls. Weil
 * mehr Szenen auch mehr Tore und Ecken bringen, rechnet er das heraus; ein
 * zweiter Lauf bestätigt das Ergebnis.
 *
 *   node eichung.js [Spiele 2D] [Spiele Zeitleiste] [--schreiben] [--merke datei | --nimm datei]
 *
 * Das 2D-Modell braucht je Spiel ein, zwei Sekunden, die Zeitleiste
 * Millisekunden. Mit --merke schreibt der Lauf die Werte des 2D-Modells in
 * eine Datei, mit --nimm liest er sie von dort - so lässt sich die
 * Zeitleiste mehrmals nacheichen, ohne das 2D-Modell neu zu rechnen.
 *
 * Der Test "Zeitleiste und 2D-Modell" nutzt denselben Lauf und schlägt an,
 * wenn beide auseinanderlaufen.
 */
"use strict";

const path = require("path");
const fs = require("fs");
const { GameState } = require("./js/engine/gameState.js");
const { MatchEngine, MATCH_TUNING } = require("./js/engine/matchEngine.js");

/** Paarungen aus der ersten deutschen und englischen Liga, jede in beiden Richtungen */
function paarungen(state) {
    const paare = [];
    ["de_liga_1", "en_liga_1"].forEach(liga => {
        const clubs = state.clubs.filter(c => c.leagueId === liga);
        for (let i = 0; i < clubs.length; i++) {
            const h = clubs[i], a = clubs[(i * 7 + 3) % clubs.length];
            if (h.id === a.id) continue;
            paare.push([h, a], [a, h]);
        }
    });
    // Abwechselnd aus beiden Ligen, damit auch ein kurzer Lauf beide trifft
    const de = paare.filter(([h]) => h.leagueId === "de_liga_1"), en = paare.filter(([h]) => h.leagueId === "en_liga_1");
    const gemischt = [];
    for (let i = 0; i < Math.max(de.length, en.length); i++) {
        if (de[i]) gemischt.push(de[i]);
        if (en[i]) gemischt.push(en[i]);
    }
    return gemischt;
}

/** Stärke einer Elf: Schnitt der besten elf */
function staerke(state, club) {
    const k = state.players.filter(p => p.clubId === club.id).sort((a, b) => b.overall - a.overall).slice(0, 11);
    return k.reduce((s, p) => s + p.overall, 0) / Math.max(1, k.length);
}

/** Spielt die Paarungen mit einer Engine und mittelt */
function messlauf(state, paare, zweiD) {
    const s = { n: 0, tore: 0, schuesse: 0, aufsTor: 0, ecken: 0, fouls: 0, heim: 0, remis: 0, favN: 0, favSieg: 0 };
    paare.forEach(([h, a], i) => {
        state.players.forEach(p => { p.suspendedMatches = 0; p.injuredWeeks = 0; p.fitness = 95; });
        const m = { id: `eichung_${zweiD ? "2d" : "zl"}_${i}`, played: false, homeClubId: h.id, awayClubId: a.id };
        if (zweiD) MatchEngine.spieleOhneBild(m, h, a, state.players);
        else MatchEngine.simulateFullMatch(m, h, a, state.players);
        const st = m.stats || {};
        const summe = (k) => (st[k] || [0, 0]).reduce((x, y) => x + y, 0);
        s.n++;
        s.tore += m.homeGoals + m.awayGoals;
        s.schuesse += summe("shots");
        s.aufsTor += summe("shotsOnTarget");
        s.ecken += summe("corners");
        s.fouls += summe("fouls");
        if (m.homeGoals > m.awayGoals) s.heim++;
        else if (m.homeGoals === m.awayGoals) s.remis++;
        const vorsprung = staerke(state, h) - staerke(state, a);
        if (Math.abs(vorsprung) >= 2) {
            s.favN++;
            if ((vorsprung > 0 && m.homeGoals > m.awayGoals) || (vorsprung < 0 && m.awayGoals > m.homeGoals)) s.favSieg++;
        }
    });
    const n = Math.max(1, s.n);
    return {
        n: s.n,
        tore: s.tore / n, schuesse: s.schuesse / n, aufsTor: s.aufsTor / n, ecken: s.ecken / n, fouls: s.fouls / n,
        heim: s.heim / n, remis: s.remis / n, favorit: s.favN ? s.favSieg / s.favN : null
    };
}

/** Beide Engines auf denselben Paarungen - das 2D-Modell auf Wunsch aus einem früheren Lauf */
function vergleiche(n2d = 60, nZeit = 400, state = null, zweiD = null) {
    const welt = state || GameState.createNewGame("muc", "normal", { name: "Eichung" });
    const paare = paarungen(welt);
    const reihe = (n) => Array.from({ length: n }, (_, i) => paare[i % paare.length]);
    return { zweiD: zweiD || messlauf(welt, reihe(n2d), true), zeitleiste: messlauf(welt, reihe(nZeit), false) };
}

/** Die neue Eichung der Zeitleiste aus einem Vergleich */
function neueEichung(alt, v) {
    // Gedämpft: Jeder Lauf rauscht, ein voller Schritt schösse über
    const q = (a, b) => 1 + (Math.max(0.6, Math.min(1.6, b > 0 ? a / b : 1)) - 1) * 0.7;
    const szenen = q(v.zweiD.schuesse, v.zeitleiste.schuesse);
    const r2 = (x) => Math.round(x * 100) / 100;
    return {
        tore: r2(alt.tore * q(v.zweiD.tore, v.zeitleiste.tore) / szenen),
        szenen: r2(alt.szenen * szenen),
        // Paraden sind die Schüsse aufs Tor ohne die Tore
        paraden: r2(alt.paraden * q(v.zweiD.aufsTor - v.zweiD.tore, v.zeitleiste.aufsTor - v.zeitleiste.tore) / szenen),
        ecken: r2(alt.ecken * q(v.zweiD.ecken, v.zeitleiste.ecken) / szenen),
        fouls: r2(alt.fouls * q(v.zweiD.fouls, v.zeitleiste.fouls) / Math.sqrt(szenen))
    };
}

function zeile(name, w) {
    const p = (x) => (x * 100).toFixed(0) + " %";
    return `${name.padEnd(11)} ${String(w.n).padStart(4)} Spiele: Tore ${w.tore.toFixed(2)} · Schüsse ${w.schuesse.toFixed(1)}`
        + ` · aufs Tor ${w.aufsTor.toFixed(1)} · Ecken ${w.ecken.toFixed(1)} · Fouls ${w.fouls.toFixed(1)}`
        + ` · Heimsiege ${p(w.heim)} · Remis ${p(w.remis)} · Favorit ${w.favorit === null ? "-" : p(w.favorit)}`;
}

if (require.main === module) {
    const zahlen = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
    const schreiben = process.argv.includes("--schreiben");
    // Wiederholbar: derselbe Zufall bei jedem Lauf
    let saat = 4242;
    Math.random = () => { saat = (saat + 0x6D2B79F5) | 0; let t = Math.imul(saat ^ (saat >>> 15), 1 | saat); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const start = Date.now();
    const datei = (schalter) => { const i = process.argv.indexOf(schalter); return i > 0 ? process.argv[i + 1] : null; };
    const nimm = datei("--nimm"), merke = datei("--merke");
    const v = vergleiche(zahlen[0] || 60, zahlen[1] || 400, null, nimm ? JSON.parse(fs.readFileSync(nimm, "utf8")) : null);
    if (merke) fs.writeFileSync(merke, JSON.stringify(v.zweiD));
    console.log(zeile("2D-Modell", v.zweiD));
    console.log(zeile("Zeitleiste", v.zeitleiste));
    const alt = { ...MATCH_TUNING.eichung2D };
    const neu = neueEichung(alt, v);
    console.log(`Eichung jetzt ${JSON.stringify(alt)}, vorgeschlagen ${JSON.stringify(neu)} (${((Date.now() - start) / 1000).toFixed(0)} s)`);
    if (schreiben) {
        const datei = path.join(__dirname, "js", "engine", "matchEngine.js");
        const text = fs.readFileSync(datei, "utf8");
        const muster = /eichung2D: \{ tore: [\d.]+, szenen: [\d.]+, paraden: [\d.]+, ecken: [\d.]+, fouls: [\d.]+ \}/;
        if (!muster.test(text)) { console.error("eichung2D nicht gefunden"); process.exit(1); }
        fs.writeFileSync(datei, text.replace(muster, `eichung2D: { tore: ${neu.tore}, szenen: ${neu.szenen}, paraden: ${neu.paraden}, ecken: ${neu.ecken}, fouls: ${neu.fouls} }`));
        console.log("Geschrieben. Ein zweiter Lauf bestätigt die Eichung.");
    }
}

module.exports = { vergleiche, messlauf, paarungen, neueEichung };
