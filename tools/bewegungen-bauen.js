/**
 * Baut die aufgenommenen Bewegungen der 3D-Spieler: assets/3d/bewegungen.json
 *
 * Quelle ist die Bewegungsdatenbank der Carnegie Mellon University
 * (mocap.cs.cmu.edu) in der BVH-Fassung von Bruce Hahne, gespiegelt unter
 * https://raw.githubusercontent.com/meshula/cmu-mocap/master/data/
 * CMU stellt die Daten ohne Einschränkung frei, auch für kommerzielle
 * Projekte; die BVH-Fassung fügt keine Einschränkung hinzu.
 *
 * Aus jeder Aufnahme wird ein Stück geschnitten (ein Doppelschritt beim
 * Laufen, der Schuss um den Ballkontakt, der Sprung um den höchsten Punkt)
 * und auf die Ruhehaltung der Ansicht übertragen: aufrecht, Beine gerade,
 * Arme hängend, Blick nach +x, links -z. Gespeichert wird je Bild und
 * Knochen die Drehung gegenüber dem Elternknochen - in Weltachsen der
 * Ruhehaltung, so wie Menschen3D._treibe sie erwartet - und der Versatz
 * des Beckens. Die Vorwärtsbewegung fällt weg: Wohin ein Spieler läuft,
 * bestimmt die Simulation.
 *
 * Aufruf: node tools/bewegungen-bauen.js <Ordner mit den .bvh-Dateien> [--analyse]
 */
"use strict";
const fs = require("fs");
const path = require("path");

const QUELLE = process.argv[2];
const ANALYSE = process.argv.includes("--analyse");
const ZIEL = path.join(__dirname, "..", "assets", "3d", "bewegungen.json");
if (!QUELLE || !fs.existsSync(QUELLE)) {
    console.error("Aufruf: node tools/bewegungen-bauen.js <Ordner mit .bvh-Dateien> [--analyse]");
    process.exit(1);
}

// ------------------------------------------------------------ Mathematik

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// Quaternionen [x, y, z, w]
const qMul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qDreh = (q, v) => { const p = qMul(qMul(q, [v[0], v[1], v[2], 0]), qInv(q)); return [p[0], p[1], p[2]]; };
const qAchse = (achse, w) => { const s = Math.sin(w / 2); return [achse[0] * s, achse[1] * s, achse[2] * s, Math.cos(w / 2)]; };
function qVon(a, b) {
    const r = dot(a, b) + 1;
    let q;
    if (r < 1e-6) q = Math.abs(a[0]) > Math.abs(a[2]) ? [-a[1], a[0], 0, 0] : [0, -a[2], a[1], 0];
    else { const c = kreuz(a, b); q = [c[0], c[1], c[2], r]; }
    const l = Math.hypot(...q);
    return q.map(x => x / l);
}
function qSlerp(a, b, t) {
    let c = dot(a, b) + a[3] * b[3];
    if (c < 0) { b = b.map(x => -x); c = -c; }
    if (c > 0.9995) return norm4(a.map((x, i) => x + (b[i] - x) * t));
    const th = Math.acos(c), s = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return a.map((x, i) => x * wa + b[i] * wb);
}
const norm4 = (q) => { const l = Math.hypot(...q) || 1; return q.map(x => x / l); };

// ------------------------------------------------------------ BVH lesen

function liesBvh(text) {
    const w = text.split(/\s+/).filter(Boolean);
    let i = 0;
    const gelenke = [];
    const lies = (eltern) => {
        const art = w[i++];
        const name = w[i++];
        if (w[i++] !== "{") throw new Error("BVH: { erwartet");
        const g = { name, eltern, offset: null, kanaele: [], ende: null };
        if (art !== "End") gelenke.push(g);
        while (w[i] !== "}") {
            const t = w[i++];
            if (t === "OFFSET") g.offset = [+w[i++], +w[i++], +w[i++]];
            else if (t === "CHANNELS") { const n = +w[i++]; for (let k = 0; k < n; k++) g.kanaele.push(w[i++]); }
            else if (t === "JOINT") { i--; lies(gelenke.indexOf(g)); }
            else if (t === "End") { i--; const e = lies(gelenke.indexOf(g)); g.ende = e.offset; }
        }
        i++;
        return g;
    };
    if (w[i++] !== "HIERARCHY") throw new Error("BVH: HIERARCHY fehlt");
    lies(-1);
    if (w[i++] !== "MOTION") throw new Error("BVH: MOTION fehlt");
    i++; const bilder = +w[i++];
    i += 2; const dauer = +w[i++];
    const n = gelenke.reduce((s, g) => s + g.kanaele.length, 0);
    const werte = new Float64Array(bilder * n);
    for (let k = 0; k < werte.length; k++) werte[k] = +w[i++];
    return { gelenke, bilder, dauer, n, werte };
}

const RAD = Math.PI / 180;
/** Weltlage aller Gelenke in einem Bild: Drehung und Ort (Einheiten der Datei) */
function vorwaerts(bvh, b) {
    const welt = [];
    let k = b * bvh.n;
    bvh.gelenke.forEach((g, j) => {
        let pos = [0, 0, 0], q = [0, 0, 0, 1];
        g.kanaele.forEach(c => {
            const v = bvh.werte[k++];
            if (c === "Xposition") pos[0] = v; else if (c === "Yposition") pos[1] = v; else if (c === "Zposition") pos[2] = v;
            else if (c === "Xrotation") q = qMul(q, qAchse([1, 0, 0], v * RAD));
            else if (c === "Yrotation") q = qMul(q, qAchse([0, 1, 0], v * RAD));
            else if (c === "Zrotation") q = qMul(q, qAchse([0, 0, 1], v * RAD));
        });
        if (g.eltern < 0) welt.push({ q, p: add(g.offset, pos) });
        else {
            const e = welt[g.eltern];
            welt.push({ q: qMul(e.q, q), p: add(e.p, qDreh(e.q, g.offset)) });
        }
    });
    return welt;
}

// ------------------------------------------------------------ Übertragen

/** Zielknochen (MakeHuman-Namen) und woher sie ihre Drehung bekommen */
const ZUORDNUNG = {
    Hips: "Hips", Spine: "LowerBack", Spine1: "Spine", Spine2: "Spine1", Neck: "Neck1", Head: "Head",
    LeftShoulder: "LeftShoulder", LeftArm: "LeftArm", LeftForeArm: "LeftForeArm", LeftHand: "LeftHand",
    RightShoulder: "RightShoulder", RightArm: "RightArm", RightForeArm: "RightForeArm", RightHand: "RightHand",
    LeftUpLeg: "LeftUpLeg", LeftLeg: "LeftLeg", LeftFoot: "LeftFoot", LeftToeBase: "LeftToeBase",
    RightUpLeg: "RightUpLeg", RightLeg: "RightLeg", RightFoot: "RightFoot", RightToeBase: "RightToeBase"
};
const ELTERN = {
    Hips: null, Spine: "Hips", Spine1: "Spine", Spine2: "Spine1", Neck: "Spine2", Head: "Neck",
    LeftShoulder: "Spine2", LeftArm: "LeftShoulder", LeftForeArm: "LeftArm", LeftHand: "LeftForeArm",
    RightShoulder: "Spine2", RightArm: "RightShoulder", RightForeArm: "RightArm", RightHand: "RightForeArm",
    LeftUpLeg: "Hips", LeftLeg: "LeftUpLeg", LeftFoot: "LeftLeg", LeftToeBase: "LeftFoot",
    RightUpLeg: "Hips", RightLeg: "RightUpLeg", RightFoot: "RightLeg", RightToeBase: "RightFoot"
};
const ZIELE = Object.keys(ZUORDNUNG);
// Schlüsselbein des MakeHuman-Menschen in Ruhe (in der Lage der Datei: vorn +z, links +x)
const SCHLUESSELBEIN = { Left: norm([0.131, -0.070, 0.005]), Right: norm([-0.133, -0.059, 0.003]) };

/**
 * Wie die Gelenke der Datei in die Ruhehaltung der Ansicht kommen (in
 * Weltachsen der Datei): Arme aus der T-Haltung hängend, 7° abgespreizt,
 * Beine gerade nach unten, Schlüsselbeine wie beim MakeHuman-Menschen.
 */
function ruheAnpassung(bvh) {
    const idx = (n) => bvh.gelenke.findIndex(g => g.name === n);
    const richtung = (n) => {
        const kinder = bvh.gelenke.filter(g => g.eltern === idx(n));
        const o = kinder.length ? kinder[0].offset : bvh.gelenke[idx(n)].ende;
        return norm(o);
    };
    const a = {};
    ZIELE.forEach(z => { a[z] = [0, 0, 0, 1]; });
    [["Left", 1], ["Right", -1]].forEach(([s, x]) => {
        const w = 7 * RAD, haengen = [x * Math.sin(w), -Math.cos(w), 0];
        a[s + "Shoulder"] = qVon(richtung(s + "Shoulder"), SCHLUESSELBEIN[s]);
        a[s + "Arm"] = qVon(richtung(s + "Arm"), haengen);
        a[s + "ForeArm"] = qVon(richtung(s + "ForeArm"), haengen);
        a[s + "Hand"] = a[s + "ForeArm"];
        a[s + "UpLeg"] = qVon(richtung(s + "UpLeg"), [0, -1, 0]);
        a[s + "Leg"] = qVon(richtung(s + "Leg"), [0, -1, 0]);
    });
    return a;
}

// Datei (vorn +z, links +x) -> Ansicht (vorn +x, links -z): 90° um y
const DREH = qAchse([0, 1, 0], Math.PI / 2);
const inAnsicht = (q) => qMul(qMul(DREH, q), qInv(DREH));
const ortInAnsicht = (p) => [p[2], p[1], -p[0]];

/** Ein Bild als Weltdrehungen der Zielknochen gegenüber der Ruhehaltung (Lage der Ansicht) */
function haltung(bvh, welt, anpassung) {
    const idx = (n) => bvh.gelenke.findIndex(g => g.name === n);
    const out = {};
    ZIELE.forEach(z => { out[z] = inAnsicht(qMul(welt[idx(ZUORDNUNG[z])].q, qInv(anpassung[z]))); });
    return out;
}

// ------------------------------------------------------------ Schneiden

const MASS = 0.056444; // eine Einheit der CMU-Dateien in Metern

function auswerten(datei) {
    const bvh = liesBvh(fs.readFileSync(path.join(QUELLE, datei), "utf8"));
    const idx = (n) => bvh.gelenke.findIndex(g => g.name === n);
    const bilder = [];
    for (let b = 0; b < bvh.bilder; b++) bilder.push(vorwaerts(bvh, b));
    const boden = Math.min(...bilder.map(w => Math.min(w[idx("LeftToeBase")].p[1], w[idx("RightToeBase")].p[1], w[idx("LeftFoot")].p[1], w[idx("RightFoot")].p[1])));
    // Hüfthöhe über dem Zehengelenk in der Ruhehaltung der Ansicht (Beine
    // gerade): die Kette Hüfte - Knie - Knöchel - Zehe mit den Drehungen,
    // die die Datei in diese Haltung bringen
    const anpassung = ruheAnpassung(bvh);
    let p = [0, 0, 0];
    let g = bvh.gelenke[idx("LeftToeBase")];
    const kette = [];
    while (g && g.eltern >= 0) { kette.unshift(g); g = bvh.gelenke[g.eltern]; }
    kette.forEach(k => {
        const eltern = bvh.gelenke[k.eltern].name;
        p = add(p, qDreh(anpassung[eltern] || [0, 0, 0, 1], k.offset));
    });
    return { datei, bvh, idx, bilder, boden, standHoehe: -p[1], anpassung };
}

function analyse(a) {
    const { bvh, idx, bilder } = a;
    const fps = Math.round(1 / bvh.dauer);
    const h = (n, w) => (w[idx(n)].p[1] - a.boden) * MASS;
    const fussTempo = (n, b) => b > 0 ? Math.hypot(...sub(bilder[b][idx(n)].p, bilder[b - 1][idx(n)].p)) * MASS * fps : 0;
    const wurzel = bilder.map(w => w[idx("Hips")].p);
    const weg = Math.hypot(wurzel[wurzel.length - 1][0] - wurzel[0][0], wurzel[wurzel.length - 1][2] - wurzel[0][2]) * MASS;
    console.log(`\n${a.datei}: ${bvh.bilder} Bilder, ${fps} fps, ${(bvh.bilder / fps).toFixed(2)} s, Weg ${weg.toFixed(2)} m, Tempo ${(weg / (bvh.bilder / fps)).toFixed(2)} m/s, Stand ${(a.standHoehe * MASS).toFixed(2)} m`);
    let zeile = "";
    for (let b = 0; b < bvh.bilder; b += Math.max(1, Math.round(fps / 15))) {
        const w = bilder[b];
        zeile += `${b}:${h("LeftToeBase", w).toFixed(2)}/${h("RightToeBase", w).toFixed(2)} h${h("Hips", w).toFixed(2)} v${fussTempo("LeftToeBase", b).toFixed(1)}/${fussTempo("RightToeBase", b).toFixed(1)}  `;
    }
    console.log(zeile);
}

// ------------------------------------------------------------ Stücke

const ZIEL_FPS = 30;
// Hüfte des MakeHuman-Menschen über seinem Zehengelenk (in seinem eigenen
// Maß, vor der Größe des Spielers) - Versatz und Tempo gelten in diesem Maß
const HUEFTE_ZIEL = 0.968;

const winkelY = (q) => { const v = qDreh(q, [1, 0, 0]); return Math.atan2(-v[2], v[0]); };

/** Linker Fuß setzt auf: Zehe kommt herunter, nachdem sie oben war */
function aufsetzen(a, seite = "Left") {
    const { bilder, idx } = a;
    const h = bilder.map(w => (w[idx(seite + "ToeBase")].p[1] - a.boden) * MASS);
    const min = Math.min(...h.slice(1)), max = Math.max(...h.slice(1));
    const out = [];
    let oben = false;
    for (let b = 2; b < h.length; b++) {
        if (h[b] > min + 0.55 * (max - min)) oben = true;
        if (oben && h[b] < min + 0.15 * (max - min) && h[b] <= h[b - 1]) { out.push(b); oben = false; }
    }
    return out;
}

/** Wo der Körper ruhig steht: das ruhigste Fenster */
function ruhig(a, sekunden) {
    const { bvh, bilder, idx } = a;
    const fps = Math.round(1 / bvh.dauer), n = Math.round(sekunden * fps);
    let best = null;
    for (let b = 1; b + n < bvh.bilder; b += 4) {
        let unruhe = 0;
        for (let k = b + 1; k < b + n; k++) {
            for (const g of ["Hips", "LeftToeBase", "RightToeBase", "LeftHand", "RightHand"]) unruhe += Math.hypot(...sub(bilder[k][idx(g)].p, bilder[k - 1][idx(g)].p));
        }
        if (!best || unruhe < best.unruhe) best = { b, unruhe };
    }
    return best.b;
}

/**
 * Ein Stück ausschneiden, auf 30 Bilder je Sekunde bringen und in die
 * Lage der Ansicht drehen: Laufrichtung (oder Blick beim Kontakt) nach +x,
 * die Vorwärtsbewegung herausgerechnet, Becken als Versatz zur Ruhe.
 */
function stueck(a, von, bis, { schleife = false, kontakt = null, bein = null } = {}) {
    const { bvh, bilder, idx } = a;
    const fps = Math.round(1 / bvh.dauer);
    // Boden: das tiefste Zehengelenk im Stück - irgendwann steht ein Fuß flach
    let boden = Infinity;
    for (let b = von; b <= bis; b++) boden = Math.min(boden, bilder[b][idx("LeftToeBase")].p[1], bilder[b][idx("RightToeBase")].p[1]);
    const wurzel = (b) => ortInAnsicht(bilder[b][idx("Hips")].p).map((x, k) => k === 1 ? (x - boden) * MASS : x * MASS);
    const welt = (b) => haltung(bvh, bilder[b], a.anpassung);
    // Richtung: beim Laufen die Strecke, sonst der Blick des Beckens um den Kontakt
    let psi;
    const r0 = wurzel(von), r1 = wurzel(bis);
    if (schleife) psi = Math.atan2(-(r1[2] - r0[2]), r1[0] - r0[0]);
    else {
        const um = kontakt ?? Math.round((von + bis) / 2);
        let sx = 0, sz = 0;
        for (let b = Math.max(1, um - 12); b <= Math.min(bvh.bilder - 1, um + 12); b++) { const w = winkelY(welt(b).Hips); sx += Math.cos(w); sz += Math.sin(w); }
        psi = Math.atan2(sz, sx);
    }
    const G = qAchse([0, 1, 0], -psi);
    const k = HUEFTE_ZIEL / (a.standHoehe * MASS);
    const anzahl = Math.max(2, Math.round((bis - von) / fps * ZIEL_FPS) + (schleife ? 0 : 1));
    const q = [], h = [];
    for (let t = 0; t < anzahl; t++) {
        const s = von + t * (bis - von) / (schleife ? anzahl : anzahl - 1);
        const b0 = Math.min(bvh.bilder - 1, Math.floor(s)), b1 = Math.min(bvh.bilder - 1, b0 + 1), u = s - b0;
        const w0 = welt(b0), w1 = welt(b1);
        const F = {};
        ZIELE.forEach(z => { F[z] = qMul(G, qSlerp(w0[z], w1[z], u)); });
        ZIELE.forEach(z => {
            const e = ELTERN[z];
            let lokal = e ? qMul(qInv(F[e]), F[z]) : F[z];
            if (lokal[3] < 0) lokal = lokal.map(x => -x);
            q.push(...lokal);
        });
        // Becken: Vorwärtsbewegung als Gerade herausrechnen, der Rest bleibt.
        // Beim Schuss und Sprung geht die Gerade durch den Kontakt: Dort
        // steht das Becken genau an seinem Platz.
        const p = add(mul(wurzel(b0), 1 - u), mul(wurzel(b1), u));
        const anker = kontakt !== null ? kontakt : von, rA = kontakt !== null ? wurzel(kontakt) : r0;
        const linie = add(rA, mul(sub(r1, r0), (s - anker) / (bis - von)));
        const rest = qDreh(G, [p[0] - linie[0], 0, p[2] - linie[2]]);
        h.push(rest[0] * k, (p[1] - a.standHoehe * MASS) * k, rest[2] * k);
    }
    const strecke = Math.hypot(r1[0] - r0[0], r1[2] - r0[2]);
    return {
        bilder: anzahl, schleife,
        dauer: (bis - von) / fps,
        tempo: schleife ? +(strecke / ((bis - von) / fps) * k).toFixed(3) : undefined,
        kontakt: kontakt !== null ? +((kontakt - von) / fps * ZIEL_FPS).toFixed(2) : undefined,
        bein: bein || undefined,
        q: Buffer.from(Int16Array.from(q, x => Math.round(Math.max(-1, Math.min(1, x)) * 32767)).buffer).toString("base64"),
        h: Buffer.from(Int16Array.from(h, x => Math.round(x * 10000)).buffer).toString("base64")
    };
}

/**
 * Ein Doppelschritt, vom Aufsetzen eines Fußes bis zum nächsten Mal.
 * Der Takt aller Läufe beginnt beim linken Fuß; beginnt das Stück mit dem
 * rechten, liegt es einen halben Takt versetzt.
 */
function zyklus(datei, nr = 0) {
    const a = auswerten(datei);
    let s = aufsetzen(a, "Left"), versatz = 0;
    if (s.length < 2 + nr) { s = aufsetzen(a, "Right"); versatz = 0.5; }
    if (s.length < 2 + nr) throw new Error(datei + ": zu wenige Schritte");
    return Object.assign(stueck(a, s[nr], s[nr + 1], { schleife: true }), { versatz });
}

/** Der Schuss um den Kontakt: schnellste Zehe des Schussbeins */
function schuss(datei, vor = 0.85, nach = 0.75) {
    const a = auswerten(datei);
    const { bvh, bilder, idx } = a;
    const fps = Math.round(1 / bvh.dauer);
    let best = 0, kontakt = 0, bein = "rechts";
    for (let b = 2; b < bvh.bilder; b++) {
        for (const [n, s] of [["RightToeBase", "rechts"], ["LeftToeBase", "links"]]) {
            const v = Math.hypot(...sub(bilder[b][idx(n)].p, bilder[b - 1][idx(n)].p));
            if (v > best) { best = v; kontakt = b; bein = s; }
        }
    }
    return stueck(a, Math.max(1, kontakt - Math.round(vor * fps)), Math.min(bvh.bilder - 1, kontakt + Math.round(nach * fps)), { kontakt, bein });
}

/** Der Sprung um den höchsten Punkt des Beckens */
function sprung(datei, vor = 0.75, nach = 0.7) {
    const a = auswerten(datei);
    const { bvh, bilder, idx } = a;
    const fps = Math.round(1 / bvh.dauer);
    let hoch = 1;
    for (let b = 1; b < bvh.bilder; b++) if (bilder[b][idx("Hips")].p[1] > bilder[hoch][idx("Hips")].p[1]) hoch = b;
    return stueck(a, Math.max(1, hoch - Math.round(vor * fps)), Math.min(bvh.bilder - 1, hoch + Math.round(nach * fps)), { kontakt: hoch });
}

/** Ruhig stehen: vor- und zurückgespielt, damit keine Naht entsteht */
function stand(datei, sekunden = 2) {
    const a = auswerten(datei);
    const fps = Math.round(1 / a.bvh.dauer);
    const b = ruhig(a, sekunden);
    return Object.assign(stueck(a, b, b + Math.round(sekunden * fps)), { pendel: true });
}

const dateien = fs.readdirSync(QUELLE).filter(f => f.endsWith(".bvh")).sort();
if (ANALYSE) {
    const nur = process.argv.slice(3).filter(x => !x.startsWith("--"));
    dateien.filter(d => !nur.length || nur.some(n => d.startsWith(n))).forEach(d => analyse(auswerten(d)));
    process.exit(0);
}

const STUECKE = {
    stand: () => stand("10_02.bvh"),
    gehen: () => zyklus("16_15.bvh", 1),
    traben: () => zyklus("16_35.bvh"),
    laufen: () => zyklus("09_01.bvh"),
    schuss: () => schuss("10_03.bvh"),
    pass: () => schuss("11_01.bvh", 0.7, 0.6),
    sprung: () => sprung("13_39.bvh")
};
const clips = {};
Object.entries(STUECKE).forEach(([name, bau]) => {
    clips[name] = bau();
    const c = clips[name];
    console.log(`${name}: ${c.bilder} Bilder, ${c.dauer.toFixed(2)} s${c.tempo ? ", " + c.tempo + " m/s" : ""}${c.kontakt !== undefined ? ", Kontakt bei Bild " + c.kontakt : ""}${c.bein ? ", Bein " + c.bein : ""}`);
});
const json = {
    format: "bewegungen", version: 1, fps: ZIEL_FPS,
    lizenz: "Carnegie Mellon University Motion Capture Database (mocap.cs.cmu.edu), frei nutzbar; BVH-Fassung von Bruce Hahne",
    knochen: ZIELE, eltern: ZIELE.map(z => ZIELE.indexOf(ELTERN[z])),
    clips
};
fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, JSON.stringify(json));
console.log(`Geschrieben: ${ZIEL} (${(fs.statSync(ZIEL).size / 1024).toFixed(0)} KB)`);
