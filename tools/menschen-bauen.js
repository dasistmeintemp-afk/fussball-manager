/**
 * Baut die Spielerkörper für die 3D-Ansicht: assets/3d/menschen.bin
 *
 * Grundlage ist der MakeHuman-Mensch (CC0): Grundnetz, Formziele, Skelett,
 * Hautbilder, Augen, Brauen, Wimpern und Frisuren, wie sie das Projekt
 * humanforge aufbereitet (Daten CC0, Laufzeitcode MIT). Geladen von
 * https://raw.githubusercontent.com/abdulrehman043/humanforge/main/assets/human/
 * - welche Dateien, steht unten in DATEIEN.
 *
 * Was hier entsteht:
 *  - ein sportlicher Mann, gedreht in die Lage der 3D-Ansicht (vorn +x,
 *    links -z, oben +y), mit Skelett aus 52 Knochen;
 *  - die Spielkleidung als eigene Stoffschicht über der Haut: Trikot, Hose,
 *    Stutzen und Schuhe (beim Torwart lange Ärmel und Handschuhe). Jede
 *    Schicht ist eine geglättete, nach außen versetzte Kopie der Haut
 *    darunter, mit einem Saum an jedem Rand; die Haut unter dem Stoff fällt
 *    weg;
 *  - Formziele für Körperbau und Gesicht, damit nicht alle gleich aussehen;
 *  - die Bilder als WebP, unverändert.
 *
 * Aufruf: node tools/menschen-bauen.js <Ordner mit den Paketdateien>
 */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const QUELLE = process.argv[2];
const ZIEL = path.join(__dirname, "..", "assets", "3d", "menschen.bin");
if (!QUELLE || !fs.existsSync(path.join(QUELLE, "manifest.json"))) {
    console.error("Aufruf: node tools/menschen-bauen.js <Ordner mit manifest.json>");
    process.exit(1);
}

const HAUT = ["young_caucasian_male", "young_caucasian_male2", "middleage_caucasian_male", "young_african_male", "middleage_african_male", "young_asian_male"];
const AUGEN = ["brown", "brownlight", "blue", "green"];
const BRAUEN = ["eyebrow001", "eyebrow004"];
const FRISUREN = ["short02", "short03", "short04", "afro01", "culturalibre_hair_02", "short01"];
const DATEIEN = ["manifest.json", "body.glb.gz", "shapes.bin.gz", "proxies/eyes-high-poly.glb.gz", "proxies/eyelashes-eyelashes01.glb.gz",
    "textures/eyelashes-eyelashes01.webp",
    ...BRAUEN.flatMap(b => [`proxies/eyebrows-${b}.glb.gz`, `textures/eyebrows-${b}.webp`]),
    ...FRISUREN.flatMap(h => [`proxies/hair-${h}.glb.gz`, `textures/hair-${h}.webp`]),
    ...HAUT.map(s => `skins/${s}_1k.webp`), ...AUGEN.map(e => `eyes/${e}.webp`)];
const fehlt = DATEIEN.filter(d => !fs.existsSync(path.join(QUELLE, d)));
if (fehlt.length) { console.error("Es fehlen: " + fehlt.join(", ")); process.exit(1); }

// ------------------------------------------------------------ Paket lesen

const TYPEN = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const BREITE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function liesGlb(buf) {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const dv = new DataView(ab);
    const jl = dv.getUint32(12, true);
    const json = JSON.parse(Buffer.from(ab, 20, jl).toString("utf8"));
    const start0 = 20 + jl + 8;
    const lies = (i) => {
        const acc = json.accessors[i], view = json.bufferViews[acc.bufferView];
        const T = TYPEN[acc.componentType], n = BREITE[acc.type];
        const out = new T(acc.count * n);
        const start = start0 + (view.byteOffset || 0) + (acc.byteOffset || 0);
        const schritt = view.byteStride || n * T.BYTES_PER_ELEMENT;
        const get = { 5120: "getInt8", 5121: "getUint8", 5122: "getInt16", 5123: "getUint16", 5125: "getUint32", 5126: "getFloat32" }[acc.componentType];
        for (let e = 0; e < acc.count; e++) for (let k = 0; k < n; k++) out[e * n + k] = dv[get](start + e * schritt + k * T.BYTES_PER_ELEMENT, true);
        return { array: out, n, normiert: !!acc.normalized };
    };
    const prim = json.meshes[0].primitives[0];
    const attr = {};
    for (const [name, idx] of Object.entries(prim.attributes)) attr[name] = lies(idx);
    return { attr, index: lies(prim.indices).array };
}

const alsFloat = (a) => {
    if (a.array instanceof Float32Array) return a.array;
    const max = !a.normiert ? 1 : a.array instanceof Uint8Array ? 255 : a.array instanceof Uint16Array ? 65535 : a.array instanceof Int8Array ? 127 : 32767;
    return Float32Array.from(a.array, v => Math.max(-1, v / max));
};

// Die Formziele liegen als Differenzen in Byte-Ebenen (so packt sie humanforge)
function ebene16(src, at, n, vorzeichen) {
    const out = vorzeichen ? new Int16Array(n) : new Uint16Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { acc = (acc + (src[at + i] | (src[at + n + i] << 8))) & 0xffff; out[i] = acc; }
    return out;
}
function ebene8(src, at, n) {
    const out = new Int16Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { acc = (acc + src[at + i]) & 0xff; out[i] = acc > 127 ? acc - 256 : acc; }
    return out;
}

const roh = (f) => { const b = fs.readFileSync(path.join(QUELLE, f)); return f.endsWith(".gz") ? zlib.gunzipSync(b) : b; };
const MAN = JSON.parse(fs.readFileSync(path.join(QUELLE, "manifest.json"), "utf8"));
const NMH = MAN.vertexCount;
const BASIS = new Float32Array(NMH * 3);
const FORMEN = new Map();
{
    const bytes = new Uint8Array(roh(MAN.shapes.file)), sh = MAN.shapes;
    for (let k = 0; k < 3; k++) {
        const q = ebene16(bytes, sh.baseOffset + k * NMH * 2, NMH, false);
        for (let i = 0; i < NMH; i++) BASIS[i * 3 + k] = sh.baseMin[k] + q[i] * sh.baseScale[k];
    }
    for (const m of sh.morphs) {
        const idx = ebene16(bytes, m.offset, m.count, false);
        const d = new Int16Array(m.count * 3);
        let at = m.offset + m.count * 2;
        for (let k = 0; k < 3; k++) {
            const v = m.bits === 8 ? ebene8(bytes, at, m.count) : ebene16(bytes, at, m.count, true);
            at += m.count * (m.bits === 8 ? 1 : 2);
            for (let i = 0; i < m.count; i++) d[i * 3 + k] = v[i];
        }
        FORMEN.set(m.name, { idx, d, scale: m.scale });
    }
}
const KOERPER = liesGlb(roh(MAN.body.file));
const teil = (id) => {
    const meta = MAN.proxies.find(p => `${p.kind}-${p.id}` === id);
    return { meta, prim: liesGlb(roh(meta.file)) };
};

// ------------------------------------------------------------ Formen

const klemm = (v) => Math.min(1, Math.max(0, v));

/** Gewichte der Grundformen aus Geschlecht, Alter, Muskeln, Gewicht ... (wie in MakeHuman) */
function makro(c) {
    const w = {};
    const g = klemm(c.gender);
    w["macro/sexF"] = Math.max(0, 1 - 2 * g);
    w["macro/sexM"] = Math.max(0, 2 * g - 1);
    const teile = (v, auf, ab) => {
        const x = klemm(v);
        const [k, menge] = x >= 0.5 ? [auf, 2 * x - 1] : [ab, 1 - 2 * x];
        w[`macro/${k}F`] = (w[`macro/${k}F`] || 0) + menge * (1 - g);
        w[`macro/${k}M`] = (w[`macro/${k}M`] || 0) + menge * g;
    };
    teile(c.muscle, "muscleUp", "muscleDown");
    teile(c.weight, "weightUp", "weightDown");
    teile(0.5 + (klemm(c.height) - 0.5) * 0.36, "heightUp", "heightDown");
    teile(c.proportions, "proportionsUp", "proportionsDown");
    const jahre = 18 + 72 * klemm(c.age);
    if (jahre < 25) { const t = (25 - jahre) / 7; w["macro/ageYoungF"] = t * (1 - g); w["macro/ageYoungM"] = t * g; }
    else { const t = (jahre - 25) / 65; w["macro/ageOldF"] = t * (1 - g); w["macro/ageOldM"] = t * g; }
    const rs = c.african + c.asian + c.caucasian || 1;
    for (const r of ["african", "asian", "caucasian"]) { const x = c[r] / rs; w[`macro/${r}F`] = x * (1 - g); w[`macro/${r}M`] = x * g; }
    return w;
}

const GRUND = { gender: 1, age: 0.1, muscle: 0.7, weight: 0.42, height: 0.55, proportions: 0.65, african: 0, asian: 0, caucasian: 1 };

/** Alle MakeHuman-Punkte für eine Einstellung, auf dem Boden, in der Lage der Ansicht */
function form(c, ziele = {}) {
    const p = Float32Array.from(BASIS);
    const plus = (name, gewicht) => {
        if (Math.abs(gewicht) < 1e-4) return;
        const m = FORMEN.get(name);
        if (!m) throw new Error("Formziel fehlt: " + name);
        const s = m.scale * gewicht;
        for (let i = 0; i < m.idx.length; i++) {
            const o = m.idx[i] * 3;
            p[o] += m.d[i * 3] * s; p[o + 1] += m.d[i * 3 + 1] * s; p[o + 2] += m.d[i * 3 + 2] * s;
        }
    };
    for (const [k, v] of Object.entries(makro({ ...GRUND, ...c }))) plus(k, v);
    for (const [k, v] of Object.entries(ziele)) plus(k, v);
    let boden = 0;
    for (const i of MAN.groundVerts) boden += p[i * 3 + 1];
    boden /= MAN.groundVerts.length;
    // MakeHuman schaut nach +z, links ist +x - die Ansicht will vorn +x, links -z
    const out = new Float32Array(p.length);
    for (let i = 0; i < NMH; i++) {
        out[i * 3] = p[i * 3 + 2];
        out[i * 3 + 1] = p[i * 3 + 1] - boden;
        out[i * 3 + 2] = -p[i * 3];
    }
    return out;
}

/** Abweichungen für Körperbau und Gesicht, als Formziele für die Grafikkarte */
const VARIANTEN = {
    kraeftig: [{ muscle: 0.95, weight: 0.55 }],
    schmal: [{ muscle: 0.5, weight: 0.26 }],
    afrikanisch: [{ african: 1, caucasian: 0 }],
    asiatisch: [{ asian: 1, caucasian: 0 }],
    reif: [{ age: 0.24 }],
    kinn: [{}, { "chin/chin-prominent-incr": 0.8, "chin/chin-bones-incr": 0.7, "chin/chin-width-incr": 0.5 }],
    nase: [{}, { "nose/nose-scale-horiz-incr": 0.6, "nose/nose-scale-vert-incr": 0.5, "nose/nose-hump-incr": 0.6 }],
    rund: [{}, { "head/head-round": 0.7, "head/head-fat-incr": 0.5 }],
    lang: [{}, { "head/head-oval": 0.8, "head/head-scale-vert-incr": 0.4, "chin/chin-height-incr": 0.5 }]
};

const P = form({});
const FORMDELTA = Object.entries(VARIANTEN).map(([name, [c, ziele]]) => {
    const q = form(c, ziele || {});
    for (let i = 0; i < q.length; i++) q[i] -= P[i];
    return { name, d: q };
});

// ------------------------------------------------------------ Vektoren und Drehungen

const v3 = (a, i) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const laenge = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = laenge(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Quaternionen [x, y, z, w]
const qMul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qDreh = (q, v) => { const p = qMul(qMul(q, [v[0], v[1], v[2], 0]), qInv(q)); return [p[0], p[1], p[2]]; };
function qVon(a, b) {
    // kürzeste Drehung von Richtung a nach b (wie THREE.Quaternion.setFromUnitVectors)
    let r = dot(a, b) + 1, q;
    if (r < 1e-6) q = Math.abs(a[0]) > Math.abs(a[2]) ? [-a[1], a[0], 0, 0] : [0, -a[2], a[1], 0];
    else { const c = kreuz(a, b); q = [c[0], c[1], c[2], r]; }
    const l = Math.hypot(...q);
    return q.map(x => x / l);
}

// ------------------------------------------------------------ Skelett

const KN = MAN.bones.map(b => b.name.replace("mixamorig:", ""));
const knochen = (name) => KN.indexOf(name);
const mittel = (idx) => { const o = [0, 0, 0]; for (const i of idx) { o[0] += P[i * 3]; o[1] += P[i * 3 + 1]; o[2] += P[i * 3 + 2]; } return mul(o, 1 / idx.length); };
const KOPF = MAN.bones.map(b => mittel(b.head));
const SPITZE = MAN.bones.map(b => mittel(b.tail));
// Jeder Knochen zeigt mit seiner y-Achse zur Spitze
const WELT = MAN.bones.map((b, i) => qVon([0, 1, 0], norm(sub(SPITZE[i], KOPF[i]))));

/**
 * Die Bewegungen der Ansicht gehen von einer Ruhehaltung aus: aufrecht,
 * Beine gerade, Arme hängen leicht abgespreizt. Der MakeHuman-Mensch steht
 * in A-Haltung - hier die Drehungen (in Weltlage), die ihn in diese
 * Ruhehaltung bringen. Füße und Zehen bleiben flach auf dem Boden.
 */
const ANPASSUNG = MAN.bones.map(() => [0, 0, 0, 1]);
const kette = (wurzel, nachfolger, ziel) => {
    const a = qVon(norm(sub(SPITZE[wurzel], KOPF[wurzel])), ziel);
    const dir2 = qDreh(a, norm(sub(SPITZE[nachfolger], KOPF[nachfolger])));
    const b = qMul(qVon(dir2, ziel), a);
    return [a, b];
};
const unterbaum = (i, q) => {
    ANPASSUNG[i] = q;
    MAN.bones.forEach((b, j) => { if (b.parent === i) unterbaum(j, q); });
};
[["Left", -1], ["Right", 1]].forEach(([s, z]) => {
    const w = 7 * Math.PI / 180;
    const [a, b] = kette(knochen(s + "Arm"), knochen(s + "ForeArm"), [0, -Math.cos(w), z * Math.sin(w)]);
    ANPASSUNG[knochen(s + "Arm")] = a;
    unterbaum(knochen(s + "ForeArm"), b);
    const [c, d] = kette(knochen(s + "UpLeg"), knochen(s + "Leg"), [0, -1, 0]);
    ANPASSUNG[knochen(s + "UpLeg")] = c;
    ANPASSUNG[knochen(s + "Leg")] = d;
});
const RUHE = WELT.map((q, i) => qMul(ANPASSUNG[i], q));

// ------------------------------------------------------------ Körper

const MH = KOERPER.attr._MH.array;
const NGL = MH.length;
const GL_GELENK = KOERPER.attr.JOINTS_0.array;
const GL_GEWICHT = alsFloat(KOERPER.attr.WEIGHTS_0);
const GL_UV = alsFloat(KOERPER.attr.TEXCOORD_0);
const DREIECKE = KOERPER.index;

// Normalen je MakeHuman-Punkt, über die Bildnähte hinweg gemittelt
function normalen(pos, index, abbild) {
    const acc = new Float32Array(NMH * 3);
    for (let t = 0; t < index.length; t += 3) {
        const a = abbild[index[t]], b = abbild[index[t + 1]], c = abbild[index[t + 2]];
        const n = kreuz(sub(v3(pos, b), v3(pos, a)), sub(v3(pos, c), v3(pos, a)));
        for (const v of [a, b, c]) { acc[v * 3] += n[0]; acc[v * 3 + 1] += n[1]; acc[v * 3 + 2] += n[2]; }
    }
    for (let i = 0; i < NMH; i++) { const n = norm(v3(acc, i)); acc.set(n, i * 3); }
    return acc;
}
const NMH_NORMAL = normalen(P, DREIECKE, MH);

// Gelenke und Gewichte je MakeHuman-Punkt (aus der ersten GL-Ecke)
const MH_GL = new Int32Array(NMH).fill(-1);
for (let i = 0; i < NGL; i++) if (MH_GL[MH[i]] < 0) MH_GL[MH[i]] = i;
const herrscher = (v) => {
    const g = MH_GL[v];
    let best = 0, k = GL_GELENK[g * 4];
    for (let j = 0; j < 4; j++) if (GL_GEWICHT[g * 4 + j] > best) { best = GL_GEWICHT[g * 4 + j]; k = GL_GELENK[g * 4 + j]; }
    return KN[k];
};
const entlang = (p, kn) => { const a = KOPF[kn], b = SPITZE[kn], ab = sub(b, a); return dot(sub(p, a), ab) / dot(ab, ab); };

// ------------------------------------------------------------ Kleidung

const STUECKE = ["hemd", "hose", "stutzen", "schuh", "handschuh"];
const GRUPPE = (n) => /Hand/.test(n) ? "hand" : /Arm$/.test(n) ? "arm" : /UpLeg/.test(n) ? "ober" : /Leg$/.test(n) ? "unter" : /Foot|ToeBase/.test(n) ? "fuss" : "rumpf";
/** Wie stark Arm, Hand, Ober- und Unterschenkel, Fuß einen Hautpunkt bewegen */
function anteile(v) {
    const g = MH_GL[v], out = { hand: 0, arm: 0, ober: 0, unter: 0, fuss: 0, rumpf: 0 };
    for (let j = 0; j < 4; j++) out[GRUPPE(KN[GL_GELENK[g * 4 + j]])] += GL_GEWICHT[g * 4 + j];
    return out;
}
const knochenLaenge = (kn) => laenge(sub(SPITZE[kn], KOPF[kn]));

/**
 * Wo ein Kleidungsstück endet - als Abstand in Metern, positiv innen,
 * null genau an der Kante. Kragen (vorn tiefer als hinten), Ärmel gut bis
 * zur Hälfte des Oberarms, Trikotsaum über der Hose, Hosenbein bis zur Mitte
 * des Oberschenkels, Stutzen ab knapp unter dem Knie, Schuh ab dem Knöchel.
 * Das sind glatte Linien über die Haut; an ihnen wird geschnitten, nicht an
 * den Kanten der Dreiecke. "band": Abstand zur nächsten Kante mit Bündchen.
 */
function feld(stueck, v, torwart) {
    const p = v3(P, v), a = anteile(v), s = p[2] < 0 ? "Left" : "Right";
    const arm = knochen(s + "Arm"), ober = knochen(s + "UpLeg"), unter = knochen(s + "Leg");
    const armig = a.arm + a.hand > 0.3, beinig = a.ober + a.unter + a.fuss > 0.3;
    if (stueck === "hemd") {
        // Rundkragen: um den Hals herum offen, vorn tiefer als hinten
        const kragen = Math.max(1.5 - 0.045 * klemm(p[0] / 0.07) - p[1], Math.min(Math.hypot(p[0] - 0.005, p[2]) - 0.078, 1.52 - p[1], Math.abs(p[2]) - 0.045));
        const aermel = torwart ? (0.5 - a.hand) * 0.08 : armig ? (0.56 - entlang(p, arm)) * knochenLaenge(arm) : 1;
        return { wert: Math.min(kragen, aermel, p[1] - 0.915), band: Math.min(kragen, aermel) };
    }
    if (stueck === "hose") {
        if (armig) return { wert: -1, band: 1 };
        const bein = beinig ? (0.44 - entlang(p, ober)) * knochenLaenge(ober) : 1;
        return { wert: Math.min(1.01 - p[1], bein), band: bein };
    }
    if (a.unter + a.fuss < 0.4 && stueck !== "handschuh") return { wert: -1, band: 1 };
    if (stueck === "stutzen") {
        const oben = (entlang(p, unter) - 0.11) * knochenLaenge(unter);
        return { wert: Math.min(oben, p[1] - 0.1), band: oben };
    }
    if (stueck === "schuh") return { wert: 0.1 - p[1], band: 1 };
    return { wert: torwart ? (a.hand - 0.5) * 0.08 : -1, band: 1 };
}

/** Wie weit der Stoff von der Haut absteht, in Metern */
function abstand(stueck, p, v) {
    const a = anteile(v), s = p[2] < 0 ? "Left" : "Right";
    if (stueck === "hemd") {
        if (a.arm + a.hand > 0.5) return 0.008 + 0.009 * klemm((entlang(p, knochen(s + "Arm")) - 0.2) / 0.36);
        // Unten hängt das Trikot locker über der Hose
        return 0.014 + 0.013 * klemm((1.04 - p[1]) / 0.12);
    }
    if (stueck === "hose") {
        if (a.ober > 0.5) return 0.009 + 0.019 * klemm(entlang(p, knochen(s + "UpLeg")) / 0.44);
        return 0.007;
    }
    if (stueck === "stutzen") {
        // Schienbeinschoner vorn
        const kn = knochen(s + "Leg"), t = entlang(p, kn);
        const vorn = klemm((p[0] - KOPF[kn][0]) / 0.04);
        return 0.0035 + 0.004 * vorn * klemm((t - 0.2) / 0.1) * klemm((0.72 - t) / 0.1);
    }
    if (stueck === "schuh") return 0.006;
    return 0.008;
}
const GLAETTEN = { hemd: 30, hose: 20, stutzen: 4, schuh: 40, handschuh: 6 };

/** Nachbarn je MakeHuman-Punkt */
const NACHBARN = Array.from({ length: NMH }, () => new Set());
for (let t = 0; t < DREIECKE.length; t += 3) {
    const a = MH[DREIECKE[t]], b = MH[DREIECKE[t + 1]], c = MH[DREIECKE[t + 2]];
    NACHBARN[a].add(b).add(c); NACHBARN[b].add(a).add(c); NACHBARN[c].add(a).add(b);
}

/**
 * Eine Stoffschicht: alle Dreiecke, die das Stück berühren, als eigene
 * Kopie. Punkte außerhalb rücken auf die Kante (dort, wo das Feld null
 * wird), das Innere wird geglättet (Taubin, schrumpft nicht) und entlang der
 * Normale nach außen versetzt. An jedem Rand ein Saum zurück zur Haut.
 */
function schicht(stueck, torwart, F, B) {
    const tris = [];
    for (let t = 0; t < DREIECKE.length; t += 3) {
        const v = [MH[DREIECKE[t]], MH[DREIECKE[t + 1]], MH[DREIECKE[t + 2]]];
        if (v.some(x => F[x] > 0)) tris.push(v);
    }
    if (!tris.length) return null;
    const punkte = new Map();
    tris.forEach(v => v.forEach(x => { if (!punkte.has(x)) punkte.set(x, punkte.size); }));
    const liste = [...punkte.keys()];
    const innen = liste.map(v => F[v] > 0);
    const nb = liste.map(v => [...NACHBARN[v]].filter(n => punkte.has(n)).map(n => punkte.get(n)));
    let pos = liste.map(v => v3(P, v));
    const band = liste.map(v => B[v]);
    liste.forEach((v, i) => {
        if (innen[i]) return;
        let summe = [0, 0, 0], b = 0, n = 0;
        nb[i].forEach(j => {
            if (!innen[j]) return;
            const u = liste[j], t = F[u] / (F[u] - F[v]);
            summe = add(summe, add(v3(P, u), mul(sub(v3(P, v), v3(P, u)), t)));
            b += B[u] + (B[v] - B[u]) * t;
            n++;
        });
        pos[i] = mul(summe, 1 / n);
        band[i] = b / n;
    });
    const frei = innen.map((x, i) => x && nb[i].every(j => innen[j]));
    for (let k = 0; k < GLAETTEN[stueck]; k++) for (const f of [0.5, -0.53]) {
        const alt = pos;
        pos = alt.map((p, i) => {
            if (!frei[i]) return p;
            const m = mul(nb[i].reduce((s, j) => add(s, alt[j]), [0, 0, 0]), 1 / nb[i].length);
            return add(p, mul(sub(m, p), f));
        });
    }
    const dreiecke = tris.map(v => v.map(x => punkte.get(x)));
    const nacc = pos.map(() => [0, 0, 0]);
    dreiecke.forEach(([a, b, c]) => {
        const n = kreuz(sub(pos[b], pos[a]), sub(pos[c], pos[a]));
        [a, b, c].forEach(i => { nacc[i] = add(nacc[i], n); });
    });
    const nor = nacc.map(norm);
    const weit = liste.map(v => abstand(stueck, v3(P, v), v));
    pos = pos.map((p, i) => add(p, mul(nor[i], weit[i])));
    if (stueck === "schuh") pos = pos.map(p => [p[0], Math.max(0.002, p[1]), p[2]]);

    // Ränder: Kanten, die nur ein Dreieck der Schicht hat
    const kanten = new Map();
    dreiecke.forEach(d => {
        for (let k = 0; k < 3; k++) {
            const a = d[k], b = d[(k + 1) % 3], c = d[(k + 2) % 3];
            const key = a < b ? a + "," + b : b + "," + a;
            const e = kanten.get(key);
            if (e) e.n++; else kanten.set(key, { a, b, c, n: 1 });
        }
    });
    const rand = [...kanten.values()].filter(e => e.n === 1);
    return { stueck, liste, pos, nor, weit, band, dreiecke, rand };
}

function kleidung(torwart) {
    const F = {}, B = {};
    STUECKE.forEach(st => {
        F[st] = new Float32Array(NMH).fill(-1); B[st] = new Float32Array(NMH).fill(1);
        for (let v = 0; v < NMH; v++) if (MH_GL[v] >= 0) { const f = feld(st, v, torwart); F[st][v] = f.wert; B[st][v] = f.band; }
    });
    const schichten = STUECKE.map(st => schicht(st, torwart, F[st], B[st])).filter(Boolean);
    // Haut, die ganz unter einem Stück liegt, fällt weg
    const haut = [];
    for (let t = 0; t < DREIECKE.length; t += 3) {
        const v = [MH[DREIECKE[t]], MH[DREIECKE[t + 1]], MH[DREIECKE[t + 2]]];
        if (!STUECKE.some(st => v.every(x => F[st][x] > 0))) haut.push(DREIECKE[t], DREIECKE[t + 1], DREIECKE[t + 2]);
    }

    // Ein Netz für alle Stücke: Punkte mit Herkunft, Stück und Abstand zum Bündchen
    const out = { pos: [], nor: [], mh: [], teil: [], saum: [], index: [] };
    const punkt = (p, n, mh, st, saum) => {
        out.pos.push(...p); out.nor.push(...norm(n)); out.mh.push(mh); out.teil.push(st); out.saum.push(saum);
        return out.mh.length - 1;
    };
    schichten.forEach(s => {
        const st = STUECKE.indexOf(s.stueck);
        const basis = s.liste.map((v, i) => punkt(s.pos[i], s.nor[i], v, st, s.band[i]));
        s.dreiecke.forEach(([a, b, c]) => out.index.push(basis[a], basis[b], basis[c]));
        // Saum: vom Stoffrand nach innen bis knapp über die Haut, nach außen gewandt
        const ring = new Map();
        const saumPunkt = (i, innen) => {
            const key = i + (innen ? "i" : "a");
            if (!ring.has(key)) {
                const p = innen ? sub(s.pos[i], mul(s.nor[i], s.weit[i] - 0.0015)) : s.pos[i];
                ring.set(key, { i: punkt(p, [0, 1, 0], s.liste[i], st, s.band[i]), n: [0, 0, 0] });
            }
            return ring.get(key);
        };
        s.rand.forEach(e => {
            const oa = saumPunkt(e.a, false), ob = saumPunkt(e.b, false), ua = saumPunkt(e.a, true), ub = saumPunkt(e.b, true);
            const weg = sub(mul(add(s.pos[e.a], s.pos[e.b]), 0.5), s.pos[e.c]);
            const pa = s.pos[e.a], pb = s.pos[e.b], qa = sub(pa, s.nor[e.a]);
            let n = kreuz(sub(pb, pa), sub(qa, pa));
            let tri = [[oa, ob, ua], [ob, ub, ua]];
            if (dot(n, weg) < 0) { tri = [[ob, oa, ua], [ub, ob, ua]]; n = mul(n, -1); }
            tri.forEach(d => out.index.push(d[0].i, d[1].i, d[2].i));
            [oa, ob, ua, ub].forEach(x => { x.n = add(x.n, add(norm(n), mul(norm(weg), 0.5))); });
        });
        ring.forEach(x => out.nor.splice(x.i * 3, 3, ...norm(x.n)));
    });
    return { haut, netz: out };
}

const FELD = kleidung(false);
const TOR = kleidung(true);

// ------------------------------------------------------------ Zusatzteile (Augen, Brauen, Haare)

/** Ein Zusatzteil an den Körper gelegt: über drei Hautpunkte und einen Versatz */
function anlegen(id) {
    const { meta, prim } = teil(id);
    const refs = prim.attr._REFS.array, refw = prim.attr._REFW.array, offs = prim.attr._OFFS.array;
    // Versatz skaliert mit den Maßen des Körpers - in MakeHuman-Lage gerechnet
    const Pmh = (i, k) => k === 0 ? -P[i * 3 + 2] : k === 1 ? P[i * 3 + 1] : P[i * 3];
    const s = meta.scale.map(([a, b, d], k) => Math.abs(Pmh(a, k) - Pmh(b, k)) / d);
    const n = refs.length / 3;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const mh = [0, 0, 0];
        for (let k = 0; k < 3; k++) {
            mh[k] = refw[i * 3] * Pmh(refs[i * 3], k) + refw[i * 3 + 1] * Pmh(refs[i * 3 + 1], k) + refw[i * 3 + 2] * Pmh(refs[i * 3 + 2], k) + offs[i * 3 + k] * s[k];
        }
        pos[i * 3] = mh[2]; pos[i * 3 + 1] = mh[1]; pos[i * 3 + 2] = -mh[0];
    }
    const index = prim.index;
    const nor = new Float32Array(n * 3);
    for (let t = 0; t < index.length; t += 3) {
        const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
        const f = kreuz(sub(v3(pos, b), v3(pos, a)), sub(v3(pos, c), v3(pos, a)));
        for (const v of [a, b, c]) { nor[v * 3] += f[0]; nor[v * 3 + 1] += f[1]; nor[v * 3 + 2] += f[2]; }
    }
    for (let i = 0; i < n; i++) nor.set(norm(v3(nor, i)), i * 3);
    const delta = (d) => {
        const out = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
            out[i * 3 + k] = refw[i * 3] * d[refs[i * 3] * 3 + k] + refw[i * 3 + 1] * d[refs[i * 3 + 1] * 3 + k] + refw[i * 3 + 2] * d[refs[i * 3 + 2] * 3 + k];
        }
        return out;
    };
    return {
        meta, pos, nor, uv: alsFloat(prim.attr.TEXCOORD_0), gelenk: prim.attr._JOINTS.array, gewicht: alsFloat(prim.attr._WEIGHTS),
        index, formen: FORMDELTA.map(f => delta(f.d))
    };
}

// ------------------------------------------------------------ Schreiben

const bloecke = [];
let laenge0 = 0;
function block(typ, arr) {
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const off = laenge0;
    bloecke.push(buf);
    laenge0 += buf.length;
    const rest = (4 - (laenge0 % 4)) % 4;
    if (rest) { bloecke.push(Buffer.alloc(rest)); laenge0 += rest; }
    return { typ, off, n: arr.length };
}
/** Lage in 16 Bit über dem Quader, Normalen in 8 Bit */
function lage(pos) {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i++) { min[i % 3] = Math.min(min[i % 3], pos[i]); max[i % 3] = Math.max(max[i % 3], pos[i]); }
    const q = new Uint16Array(pos.length);
    for (let i = 0; i < pos.length; i++) { const k = i % 3; q[i] = Math.round((pos[i] - min[k]) / ((max[k] - min[k]) || 1) * 65535); }
    return { ...block("u16", q), min, max };
}
const richtung = (nor) => block("i8n", Int8Array.from(nor, v => Math.round(Math.max(-1, Math.min(1, v)) * 127)));
const uvs = (uv) => block("u16n", Uint16Array.from(uv, v => Math.round(Math.max(0, Math.min(1, v)) * 65535)));
const gelenke = (j) => block("u8", Uint8Array.from(j));
const gewichte = (w) => {
    const out = new Uint8Array(w.length);
    for (let i = 0; i < w.length; i += 4) {
        const s = w[i] + w[i + 1] + w[i + 2] + w[i + 3] || 1;
        let rest = 255;
        for (let k = 0; k < 3; k++) { out[i + k] = Math.round(w[i + k] / s * 255); rest -= out[i + k]; }
        out[i + 3] = Math.max(0, rest);
    }
    return block("u8n", out);
};
const indizes = (ix) => block(ix.length && Math.max(...ix) > 65535 ? "u32" : "u16", ix.length && Math.max(...ix) > 65535 ? Uint32Array.from(ix) : Uint16Array.from(ix));
/** Formziele dünn: nur Punkte, die sich bewegen, Abweichung in 16 Bit */
function formziele(liste) {
    return liste.map((d, k) => {
        const idx = [], wert = [];
        let max = 0;
        for (let i = 0; i < d.length / 3; i++) {
            const l = Math.hypot(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]);
            if (l > 2e-5) { idx.push(i); wert.push(d[i * 3], d[i * 3 + 1], d[i * 3 + 2]); max = Math.max(max, Math.abs(d[i * 3]), Math.abs(d[i * 3 + 1]), Math.abs(d[i * 3 + 2])); }
        }
        const skala = max / 32767 || 1;
        return { name: FORMDELTA[k].name, idx: indizes(idx), d: block("i16", Int16Array.from(wert, v => Math.round(v / skala))), skala };
    });
}

// Körper: Haut mit Bild
const KPOS = new Float32Array(NGL * 3), KNOR = new Float32Array(NGL * 3);
for (let i = 0; i < NGL; i++) { KPOS.set(v3(P, MH[i]), i * 3); KNOR.set(v3(NMH_NORMAL, MH[i]), i * 3); }
const koerperNetz = {
    lage: lage(KPOS), normale: richtung(KNOR), uv: uvs(GL_UV), gelenk: gelenke(GL_GELENK), gewicht: gewichte(GL_GEWICHT),
    index: { feld: indizes(FELD.haut), torwart: indizes(TOR.haut) },
    formen: formziele(FORMDELTA.map(f => { const o = new Float32Array(NGL * 3); for (let i = 0; i < NGL; i++) o.set(v3(f.d, MH[i]), i * 3); return o; }))
};

function kleidungsNetz(k) {
    const n = k.netz, anzahl = n.mh.length;
    const gel = new Uint8Array(anzahl * 4), gew = new Float32Array(anzahl * 4);
    n.mh.forEach((v, i) => { const g = MH_GL[v]; for (let j = 0; j < 4; j++) { gel[i * 4 + j] = GL_GELENK[g * 4 + j]; gew[i * 4 + j] = GL_GEWICHT[g * 4 + j]; } });
    return {
        lage: lage(Float32Array.from(n.pos)), normale: richtung(n.nor), gelenk: gelenke(gel), gewicht: gewichte(gew),
        // Abstand zum nächsten Bündchen, bis 6 cm
        teil: block("u8", Uint8Array.from(n.teil)), saum: block("u8n", Uint8Array.from(n.saum, s => Math.round(klemm(s / 0.06) * 255))),
        index: indizes(n.index),
        formen: formziele(FORMDELTA.map(f => { const o = new Float32Array(anzahl * 3); n.mh.forEach((v, i) => o.set(v3(f.d, v), i * 3)); return o; }))
    };
}

function zusatzNetz(z) {
    return {
        lage: lage(z.pos), normale: richtung(z.nor), uv: uvs(z.uv), gelenk: gelenke(z.gelenk), gewicht: gewichte(z.gewicht),
        index: indizes(Array.from(z.index)), formen: formziele(z.formen)
    };
}

const bild = (datei) => block("webp", new Uint8Array(fs.readFileSync(path.join(QUELLE, datei))));

const kopfDaten = {
    format: "menschen", version: 1,
    lizenz: "MakeHuman/MPFB2 und MakeHuman-Systemteile, CC0 1.0; aufbereitet nach humanforge (MIT). Siehe assets/3d/LIZENZ.md",
    groesse: Math.max(...MAN.bones.map((b, i) => SPITZE[i][1])),
    knochen: MAN.bones.map((b, i) => {
        const el = b.parent;
        const qe = el < 0 ? [0, 0, 0, 1] : WELT[el];
        const lokal = qMul(qInv(qe), WELT[i]);
        const pos = el < 0 ? KOPF[i] : qDreh(qInv(qe), sub(KOPF[i], KOPF[el]));
        return { name: KN[i], eltern: el, pos, quat: lokal, ruhe: RUHE[i] };
    }),
    formen: FORMDELTA.map(f => f.name),
    stuecke: STUECKE,
    koerper: koerperNetz,
    kleidung: { feld: kleidungsNetz(FELD), torwart: kleidungsNetz(TOR) },
    augen: zusatzNetz(anlegen("eyes-high-poly")),
    wimpern: zusatzNetz(anlegen("eyelashes-eyelashes01")),
    brauen: BRAUEN.map(b => ({ id: b, netz: zusatzNetz(anlegen("eyebrows-" + b)), bild: bild(`textures/eyebrows-${b}.webp`) })),
    haare: FRISUREN.map(h => ({ id: h, netz: zusatzNetz(anlegen("hair-" + h)), bild: bild(`textures/hair-${h}.webp`) })),
    haut: HAUT.map(s => ({ id: s, bild: bild(`skins/${s}_1k.webp`), herkunft: s.includes("african") ? "afrikanisch" : s.includes("asian") ? "asiatisch" : "" })),
    augenbilder: AUGEN.map(e => ({ id: e, bild: bild(`eyes/${e}.webp`) })),
    wimpernbild: bild("textures/eyelashes-eyelashes01.webp")
};

const json = Buffer.from(JSON.stringify(kopfDaten), "utf8");
const pad = (4 - ((8 + json.length) % 4)) % 4;
const kopf = Buffer.alloc(8);
kopf.write("MNS1", 0, "ascii");
kopf.writeUInt32LE(json.length + pad, 4);
fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, Buffer.concat([kopf, json, Buffer.alloc(pad, 0x20), ...bloecke]));
const dreiecke = (ix) => ix.n / 3;
console.log(`Geschrieben: ${ZIEL} (${(fs.statSync(ZIEL).size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`Haut ${dreiecke(koerperNetz.index.feld)} Dreiecke (Torwart ${dreiecke(koerperNetz.index.torwart)}), Kleidung ${dreiecke(kopfDaten.kleidung.feld.index)} / ${dreiecke(kopfDaten.kleidung.torwart.index)}, Größe ${kopfDaten.groesse.toFixed(3)} m`);
