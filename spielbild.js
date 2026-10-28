/**
 * Messlauf: Wie sieht das 2D-Spiel aus? Spielbild je Taktik und Standards
 *
 * Spielt Partien im 2D-Modell (FM-Modus, dieselbe Simulation wie das
 * Livespiel und das Sofort-Ergebnis) und misst, was auf dem Platz zu sehen
 * sein soll:
 *
 *  - Spielfluss je Taktik: Pässe, Passquote, Passfolgen (Pässe je Ballbesitz
 *    und Anteil mit vier und mehr), Ballverluste nach ihrem Grund, wie oft
 *    ein zweiter Ball bei der eigenen Elf bleibt, Dribblings gegen den Mann,
 *    lange Bälle, Flanken, Ecken, Fouls, Ballbesitz, Tore und Schüsse,
 *    Ballgewinne im letzten Drittel des Gegners.
 *  - Ball und Ballführender gehören zusammen: Anteil der Bilder, in denen
 *    der Ballführende weiter als vier Einheiten vom liegenden Ball steht,
 *    und Sprünge des Balls über sechs Einheiten ohne ausgewiesenen Schnitt.
 *  - Ecken: im Moment der Ausführung Schütze, Ball, Fahne, Strafraum,
 *    Torwart - und was aus ihnen wird.
 *
 *   node spielbild.js [Spiele je Taktik] [--taktik neutral,ballbesitz] [--tempo 1|2|4] [--saat n]
 *
 * Die Taktik spielt Frankfurt, im Wechsel daheim und auswärts, gegen
 * Wolfsburg in der Grundeinstellung. Beide sind etwa gleich stark - die
 * Unterschiede kommen aus der Taktik. Ohne --tempo rechnet der Lauf wie das
 * Sofort-Ergebnis (schnellste Stufe, LiveMatch.OHNE_BILD_SCHRITT_MS), mit
 * --tempo in Bildern zu 1/60 s auf der gewählten Stufe - wie im Browser.
 *
 * Der Test "Spielbild" nutzt dieselben Messungen.
 */
"use strict";

const { GameState } = require("./js/engine/gameState.js");
const { MatchEngine, LiveMatch } = require("./js/engine/matchEngine.js");
const { TacticsEngine } = require("./js/engine/tacticsEngine.js");

/** Die Taktiken des Vergleichs - jeweils nur die Anweisungen, die das Spielbild ausmachen */
const TAKTIKEN = {
    neutral: {},
    ballbesitz: { passing: "short", tempo: "slow", durchsPressing: "spielen", nachBallgewinn: "ballsichern", torwartAbspiel: "kurz", abschluss: "herausspielen" },
    direkt: { passing: "direct", tempo: "fast", nachBallgewinn: "kontern", torwartAbspiel: "lang", durchsPressing: "lang" },
    hochPressing: { pressing: "high", anlaufen: "oefter", defensiveLine: "high", nachBallverlust: "gegenpressing" },
    tieferBlock: { pressing: "low", anlaufen: "seltener", defensiveLine: "deep", mentality: "defensive", kompaktheit: "eng", nachBallverlust: "zurueckziehen", nachBallgewinn: "kontern" },
    fluegel: { focus: "right", breite: "breit", flanken: "frueh", aussenRechts: "hinterlaufen" },
    zentrum: { focus: "center", breite: "eng" }
};

/** Wiederholbarer Zufall (derselbe Generator wie in eichung.js) */
function setzeSaat(saat) {
    let s = saat | 0;
    Math.random = () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function leereWerte() {
    return {
        spiele: 0, paesse: 0, angekommen: 0, besitz: 0, ketten: [], verluste: {}, zweiteBaelle: 0, zweiteBaelleBehalten: 0,
        dribblings: 0, getragen: 0, abgedreht: 0, lang: 0, klaerungen: 0, konter: 0, flanken: 0, ecken: 0, schuesse: 0, tore: 0,
        gegnerSchuesse: 0, gegnerTore: 0, ballgewinneVorn: 0,
        // beide Mannschaften zusammen
        toreGesamt: 0, schuesseGesamt: 0, eckenGesamt: 0, foulsGesamt: 0,
        halterBilder: 0, halterWeg: 0, spruenge: 0, ecke: [],
        formMit: { n: 0, linie: 0, laenge: 0, breite: 0 }, formGegen: { n: 0, linie: 0, laenge: 0, breite: 0 }
    };
}

/**
 * Misst eine Ecke im Moment der Ausführung (vor resumeFromDeadBall). Liefert
 * die Prüfwerte - fehlerhaft ist sie, wenn eines der Kriterien verletzt ist.
 * Gezählt wird hier selbst, nicht mit der Prüfung der Regie: Der Messlauf
 * soll sie kontrollieren, nicht ihr glauben. Im und am Strafraum heißt: bis
 * 18 Einheiten vor der Torlinie (der Strafraum ist 14,5 tief) und bis 31
 * neben der Mitte (29,6).
 */
function eckeBeiAusfuehrung(d) {
    const info = d.deadBall;
    const ball = d.match.ball;
    const schuetze = d.getPlayer2D(d.carrierId);
    const gegner = info.team === "home" ? "away" : "home";
    const torX = d.ownGoalX(gegner);
    const imRaum = (p) => p.pos !== "TW" && Math.abs(p.x - torX) <= 18 && Math.abs(p.y - 50) <= 31;
    const tw = d.teamPlayers(gegner).find(p => p.pos === "TW");
    const twZiel = tw ? d.torwartBeimStandard(tw, info) : null;
    const drittel = (d.match.players2D || []).filter(p => p.pos !== "TW" && Math.abs(p.x - torX) <= 34).length;
    // Wen der Ticker nennt (fromPlayerId der Ecke) - es sei denn, er hat den Platz inzwischen verlassen
    let genannt = null;
    for (let i = (d.match.timelineIndex || 0) - 1; i >= 0; i--) {
        const ev = d.match.timeline[i];
        if (ev && ev.type === "corner") { genannt = ev.fromPlayerId ?? null; break; }
    }
    return {
        halbzeit: d.isSecondHalf ? 2 : 1,
        wieImTicker: genannt === null || genannt === d.carrierId || !d.getPlayer2D(genannt),
        schuetze: schuetze ? Math.hypot(schuetze.x - ball.x, schuetze.y - ball.y) : Infinity,
        schuetzeRichtig: !!schuetze && schuetze.team === info.team && schuetze.pos !== "TW",
        imFlug: !!ball.inFlight,
        anDerFahne: Math.abs(ball.x - torX) < 1.5 && (ball.y < 3 || ball.y > 97),
        fahneRichtig: Math.abs(info.x - torX) < 1.5 && (info.y < 3 || info.y > 97),
        angreifer: d.teamPlayers(info.team).filter(p => p.id !== d.carrierId && imRaum(p)).length,
        verteidiger: d.teamPlayers(gegner).filter(imRaum).length,
        torwart: tw && twZiel ? Math.hypot(tw.x - twZiel.x, tw.y - twZiel.y) : 0,
        drittel
    };
}

/** Eine Ecke ist sauber, wenn Schütze, Ball, Fahne und Aufstellung stimmen */
function eckeFehler(e) {
    const f = [];
    if (!e.schuetzeRichtig) f.push("kein Schütze");
    if (e.wieImTicker === false) f.push("ein anderer Schütze als im Ticker");
    if (e.schuetze > 3) f.push(`Schütze ${e.schuetze.toFixed(1)} vom Ball`);
    if (e.imFlug) f.push("Ball noch unterwegs");
    if (!e.anDerFahne || !e.fahneRichtig) f.push("nicht an der richtigen Fahne");
    if (e.angreifer < 4) f.push(`${e.angreifer} Angreifer im Strafraum`);
    if (e.verteidiger < 5) f.push(`${e.verteidiger} Verteidiger im Strafraum`);
    if (e.torwart > 3.5) f.push(`Torwart ${e.torwart.toFixed(1)} neben seinem Platz`);
    if (e.drittel < 8) f.push(`${e.drittel} Feldspieler im letzten Drittel`);
    return f;
}

/**
 * Die Form einer Elf in diesem Moment: wie hoch ihre letzte Linie steht und
 * wie lang sie ist (Anteil des Feldes vom eigenen Tor, ohne Torwart), wie
 * breit sie ist (in Einheiten quer) - getrennt mit und gegen den Ball.
 */
function formMessen(d, seite, w) {
    const feld = d.teamPlayers(seite).filter(p => p.pos !== "TW");
    if (feld.length < 7) return;
    const tiefe = feld.map(p => (p.x - d.ownGoalX(seite)) * d.attackDir(seite) / 92).sort((a, b) => a - b);
    const quer = feld.map(p => p.y).sort((a, b) => a - b);
    // Die zweittiefste und zweithöchste Position - ein Ausreißer zählt nicht
    const f = d.possessionTeam === seite ? w.formMit : w.formGegen;
    f.n++;
    f.linie += tiefe[1];
    f.laenge += tiefe[tiefe.length - 2] - tiefe[1];
    f.breite += quer[quer.length - 2] - quer[1];
}

/**
 * Eine Partie messen. seite: die Mannschaft, deren Spielbild zählt.
 * opts.tempo: Abspielstufe (1, 2, 4) in Bildern zu 1/60 s - ohne wie das
 * Sofort-Ergebnis.
 */
function messeSpiel(state, home, away, seite, opts = {}, w = leereWerte()) {
    state.players.forEach(p => { p.suspendedMatches = 0; p.injuredWeeks = 0; p.fitness = 95; });
    const live = MatchEngine.createLiveMatch({ id: `spielbild_${w.spiele}_${home.id}_${away.id}`, played: false, homeClubId: home.id, awayClubId: away.id },
        home, away, state.players, { modus: "fm" });
    const d = live.director;
    const dir = () => d.attackDir(seite);

    let besitz = null;
    const fortschritt = (p, team) => (p.x - d.ownGoalX(team)) * d.attackDir(team) / 92;
    const abspielen = d.applyFlowAction.bind(d);
    d.applyFlowAction = function (a) {
        const team = a.from && a.from.team;
        if (team && (!besitz || besitz.team !== team)) {
            if (besitz && besitz.team === seite) w.ketten.push(besitz.paesse);
            besitz = { team, paesse: 0, aktionen: 0, start: fortschritt(a.from, team) };
        }
        // Konter: in der eigenen Hälfte erobert, nach höchstens vier Aktionen im letzten Drittel
        if (team) besitz.aktionen++;
        if (team === seite && !besitz.konter && besitz.start < 0.5 && besitz.aktionen <= 4 && fortschritt(a.from, team) > 0.66) {
            besitz.konter = true;
            w.konter++;
        }
        if (team === seite && a.klaerung) w.klaerungen++;
        if (team === seite) {
            if (a.type === "dribble" && a.abdrehen) w.abgedreht++;
            else if (a.type === "dribble" && a.frei) w.getragen++;
            else if (a.type === "dribble" && !a.zugriff) w.dribblings++;
            if (a.type === "longball") w.lang++;
            const grund = a.outcome === "intercepted" ? "abgefangen"
                : a.outcome === "tackled" ? (a.zugriff ? "pressing" : "zweikampf")
                    : a.outcome === "loose" ? "zweiter_ball"
                        : a.outcome === "out" ? "aus" : null;
            if (grund) w.verluste[grund] = (w.verluste[grund] || 0) + 1;
            if (a.outcome === "loose") w._offen = true;
        } else if (team && (a.outcome === "intercepted" || a.outcome === "tackled")) {
            const sieger = a.interceptor || a.defender;
            if (sieger && sieger.team === seite && (sieger.x - d.ownGoalX(seite)) * dir() / 92 > 0.66) w.ballgewinneVorn++;
        }
        if (besitz && (a.type === "pass" || a.type === "longball") && a.outcome === "complete") besitz.paesse++;
        return abspielen(a);
    };
    // Wer den zweiten Ball nach einem verstolperten Zuspiel bekommt
    const freierBall = d.claimLooseBall.bind(d);
    d.claimLooseBall = function (punkt) {
        const r = freierBall(punkt);
        if (w._offen) {
            w._offen = false;
            w.zweiteBaelle++;
            if (d.possessionTeam === seite) w.zweiteBaelleBehalten++;
        }
        return r;
    };
    const flanke = d.fmFlanke.bind(d);
    d.fmFlanke = function (flanker, r) {
        if (flanker && flanker.team === seite && r && !r.ecke && !r.standard) w.flanken++;
        if (r && r.ecke && w.ecke.length && w.ecke[w.ecke.length - 1].ausgang === null) w.ecke[w.ecke.length - 1].ausgang = r.outcome + (r.eckeFolgt ? "_ecke" : "");
        return flanke(flanker, r);
    };
    const ausfuehren = d.resumeFromDeadBall.bind(d);
    d.resumeFromDeadBall = function () {
        if (d.deadBall && d.deadBall.kind === "corner") w.ecke.push({ ...eckeBeiAusfuehrung(d), tempo: opts.tempo || 4, ausgang: null });
        return ausfuehren();
    };

    let schnitte = live.schnitte || 0, vorher = null, bilder = 0;
    const schritt = opts.tempo ? 1000 / 60 : LiveMatch.OHNE_BILD_SCHRITT_MS;
    live.speed = opts.tempo || 4;
    while (!live.isFinished && bilder++ < 90000) {
        live.isPaused = false;
        live.advanceRealTime(schritt);
        live.updateBallAndPlayers(schritt);
        const ball = live.ball;
        if (vorher && (live.schnitte || 0) === schnitte && Math.hypot(ball.x - vorher.x, ball.y - vorher.y) > 6) w.spruenge++;
        schnitte = live.schnitte || 0;
        vorher = { x: ball.x, y: ball.y };
        if (d.mode === "ambient" && !d.deadBall && !d.kickoff && !ball.inFlight && ball.holderId !== null && ball.holderId !== undefined) {
            const halter = d.getPlayer2D(ball.holderId);
            w.halterBilder++;
            if (halter && Math.hypot(halter.x - ball.x, halter.y - ball.y) > 4) w.halterWeg++;
        }
        // Die Form der Elf, jedes zwanzigste Bild im freien Spiel: Höhe der
        // letzten Linie und Länge (Anteil des Feldes vom eigenen Tor), Breite
        if (bilder % 20 === 0 && d.mode === "ambient" && !d.deadBall && !d.kickoff) formMessen(d, seite, w);
    }
    if (besitz && besitz.team === seite) w.ketten.push(besitz.paesse);

    const i = seite === "home" ? 0 : 1;
    const st = live.stats, fm = live.fmStats;
    w.spiele++;
    w.paesse += fm.paesse[i];
    w.angekommen += fm.angekommen[i];
    w.besitz += fm.besitz[i] / Math.max(1, fm.besitz[0] + fm.besitz[1]);
    w.ecken += st.corners[i];
    w.schuesse += st.shots[i];
    w.gegnerSchuesse += st.shots[1 - i];
    w.tore += i === 0 ? live.homeScore : live.awayScore;
    w.gegnerTore += i === 0 ? live.awayScore : live.homeScore;
    w.toreGesamt += live.homeScore + live.awayScore;
    w.schuesseGesamt += st.shots[0] + st.shots[1];
    w.eckenGesamt += st.corners[0] + st.corners[1];
    w.foulsGesamt += st.fouls[0] + st.fouls[1];
    w.notfall = (w.notfall || 0) + (d.flowStats.standardNotfall || 0);
    w.nachgestellt = (w.nachgestellt || 0) + (d.flowStats.standardNachgestellt || 0);
    return w;
}

/** Mittelwerte einer Form (formMessen) */
function form(f) {
    const n = Math.max(1, f.n);
    return { linie: f.linie / n, laenge: f.laenge / n, breite: f.breite / n };
}

/** Kennzahlen einer Messreihe */
function kennzahlen(w) {
    const n = Math.max(1, w.spiele);
    const k = w.ketten;
    const verluste = Object.values(w.verluste).reduce((a, b) => a + b, 0);
    return {
        spiele: w.spiele,
        paesse: w.paesse / n,
        passquote: w.paesse ? w.angekommen / w.paesse : 0,
        besitz: w.besitz / n,
        kette: k.length ? k.reduce((a, b) => a + b, 0) / k.length : 0,
        kette4: k.length ? k.filter(x => x >= 4).length / k.length : 0,
        verluste: verluste / n,
        verlustGruende: Object.fromEntries(Object.entries(w.verluste).map(([g, v]) => [g, v / n])),
        zweiterBallBehalten: w.zweiteBaelle ? w.zweiteBaelleBehalten / w.zweiteBaelle : null,
        dribblings: w.dribblings / n,
        lang: w.lang / n,
        langAnteil: w.paesse ? w.lang / w.paesse : 0,
        klaerungen: w.klaerungen / n,
        konter: w.konter / n,
        flanken: w.flanken / n,
        ecken: w.ecken / n,
        schuesse: w.schuesse / n,
        gegnerSchuesse: w.gegnerSchuesse / n,
        tore: w.tore / n,
        gegnerTore: w.gegnerTore / n,
        ballgewinneVorn: w.ballgewinneVorn / n,
        toreGesamt: w.toreGesamt / n,
        schuesseGesamt: w.schuesseGesamt / n,
        eckenGesamt: w.eckenGesamt / n,
        foulsGesamt: w.foulsGesamt / n,
        halterWeg: w.halterBilder ? w.halterWeg / w.halterBilder : 0,
        spruenge: w.spruenge / n,
        formMit: form(w.formMit),
        formGegen: form(w.formGegen)
    };
}

/**
 * Eine Taktik über n Partien: Frankfurt mit der Taktik, im Wechsel daheim
 * und auswärts, gegen Wolfsburg in der Grundeinstellung.
 */
function messeTaktik(state, anweisungen, n, opts = {}) {
    const T = TacticsEngine;
    const a = state.clubs.find(c => c.id === (opts.mit || "sge"));
    const b = state.clubs.find(c => c.id === (opts.gegen || "wob"));
    const vorher = [{ ...(a.tactics || {}) }, { ...(b.tactics || {}) }];
    const w = leereWerte();
    try {
        for (let i = 0; i < n; i++) {
            setzeSaat((opts.saat || 1000) + i);
            a.tactics = T.normalisiere({ ...T.normalisiere({}), ...anweisungen });
            b.tactics = T.normalisiere({});
            const daheim = i % 2 === 0;
            messeSpiel(state, daheim ? a : b, daheim ? b : a, daheim ? "home" : "away", opts, w);
        }
    } finally {
        a.tactics = vorher[0];
        b.tactics = vorher[1];
    }
    return w;
}

/** Die Ecken einer Messreihe zusammengefasst */
function eckenBericht(ecken) {
    const fehlerhaft = ecken.map(e => ({ e, f: eckeFehler(e) })).filter(x => x.f.length);
    const ausgang = {};
    ecken.forEach(e => { const k = e.ausgang || "kurz"; ausgang[k] = (ausgang[k] || 0) + 1; });
    const median = (xs) => { const s = xs.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    return {
        n: ecken.length,
        fehlerhaft: fehlerhaft.length,
        beispiele: fehlerhaft.slice(0, 5).map(x => x.f.join(", ")),
        zweiteHalbzeit: ecken.filter(e => e.halbzeit === 2).length,
        schuetzeMedian: median(ecken.map(e => e.schuetze)),
        schuetzeMax: ecken.reduce((m, e) => Math.max(m, e.schuetze), 0),
        angreiferMin: ecken.reduce((m, e) => Math.min(m, e.angreifer), Infinity),
        verteidigerMin: ecken.reduce((m, e) => Math.min(m, e.verteidiger), Infinity),
        ausgang
    };
}

function zeile(name, z) {
    const p = (x) => (x * 100).toFixed(0) + " %";
    const g = Object.entries(z.verlustGruende).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ");
    return `${name.padEnd(13)} Pässe ${z.paesse.toFixed(0)} · Quote ${p(z.passquote)} · Besitz ${p(z.besitz)} · je Ballbesitz ${z.kette.toFixed(2)} · ab 4 ${p(z.kette4)}`
        + ` · lang ${z.lang.toFixed(1)} (${p(z.langAnteil)}, davon Klärungen ${z.klaerungen.toFixed(1)}) · Konter ${z.konter.toFixed(1)}`
        + ` · Dribblings ${z.dribblings.toFixed(1)} · Flanken ${z.flanken.toFixed(1)}\n`
        + `${"".padEnd(13)} Ballverluste ${z.verluste.toFixed(1)} (${g})${z.zweiterBallBehalten === null ? "" : ` · zweiter Ball behalten ${p(z.zweiterBallBehalten)}`}`
        + ` · Gewinne vorn ${z.ballgewinneVorn.toFixed(1)} · Schüsse ${z.schuesse.toFixed(1)}:${z.gegnerSchuesse.toFixed(1)} · Tore ${z.tore.toFixed(2)}:${z.gegnerTore.toFixed(2)}\n`
        + `${"".padEnd(13)} Partie: Tore ${z.toreGesamt.toFixed(2)} · Schüsse ${z.schuesseGesamt.toFixed(1)} · Ecken ${z.eckenGesamt.toFixed(1)} · Fouls ${z.foulsGesamt.toFixed(1)}`
        + ` · Ballführender weg ${(z.halterWeg * 100).toFixed(2)} % · Sprünge ${z.spruenge.toFixed(1)}\n`
        + `${"".padEnd(13)} Form mit Ball: letzte Linie ${p(z.formMit.linie)}, Länge ${p(z.formMit.laenge)}, Breite ${z.formMit.breite.toFixed(0)}`
        + ` · gegen den Ball: letzte Linie ${p(z.formGegen.linie)}, Länge ${p(z.formGegen.laenge)}, Breite ${z.formGegen.breite.toFixed(0)}`;
}

if (require.main === module) {
    const args = process.argv.slice(2);
    const wert = (schalter) => { const i = args.indexOf(schalter); return i >= 0 ? args[i + 1] : null; };
    const n = Number(args.find((a, i) => /^\d+$/.test(a) && !["--tempo", "--saat"].includes(args[i - 1]))) || 6;
    const tempo = wert("--tempo") ? Number(wert("--tempo")) : null;
    const saat = Number(wert("--saat")) || 1000;
    const auswahl = (wert("--taktik") || Object.keys(TAKTIKEN).join(",")).split(",").filter(k => TAKTIKEN[k]);
    setzeSaat(4242);
    const state = GameState.createNewGame("muc", "normal", { name: "Spielbild" });
    const start = Date.now();
    const alleEcken = [];
    auswahl.forEach(name => {
        const w = messeTaktik(state, TAKTIKEN[name], n, { tempo, saat });
        alleEcken.push(...w.ecke);
        console.log(zeile(name, kennzahlen(w)));
    });
    const e = eckenBericht(alleEcken);
    console.log(`Ecken: ${e.n} ausgeführt, ${e.fehlerhaft} fehlerhaft${e.beispiele.length ? " (" + e.beispiele.join(" | ") + ")" : ""}, ${e.zweiteHalbzeit} in Halbzeit zwei`
        + ` · Schütze im Median ${e.schuetzeMedian.toFixed(1)}, höchstens ${e.schuetzeMax.toFixed(1)} vom Ball · mindestens ${e.angreiferMin} Angreifer und ${e.verteidigerMin} Verteidiger im Strafraum`
        + ` · danach ${JSON.stringify(e.ausgang)} (${((Date.now() - start) / 1000).toFixed(0)} s)`);
}

module.exports = { TAKTIKEN, setzeSaat, messeSpiel, messeTaktik, kennzahlen, eckenBericht, eckeFehler, eckeBeiAusfuehrung, leereWerte };
