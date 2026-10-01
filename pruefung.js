/**
 * Statische Prüfung des Quelltexts - ohne Abhängigkeiten
 *
 *   node pruefung.js
 *
 * Findet Fehler, die keine Testsuite zuverlässig bemerkt:
 *  1. Syntaxfehler in irgendeiner Skriptdatei
 *  2. Doppelte Methodennamen in einer Klasse - die spätere überschreibt die
 *     frühere stillschweigend (so ging einmal das Annehmen von
 *     Transferangeboten verloren)
 *  3. Doppelte globale Namen zwischen den klassischen Skripten - im Browser
 *     teilen sie sich einen Namensraum, ein zweites "const X" bricht das
 *     ganze Skript ab, Node merkt davon nichts
 *  4. Skripte, die index.html lädt, die aber im Service Worker fehlen (die
 *     App startet offline dann nicht), und Dateien unter js/, die gar nicht
 *     geladen werden
 *
 * Beendet sich mit Code 1, sobald etwas gefunden wird.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const WURZEL = __dirname;
const fehler = [];

function alleSkripte(ordner) {
    return fs.readdirSync(ordner, { withFileTypes: true }).flatMap(e => {
        const p = path.join(ordner, e.name);
        if (e.isDirectory()) return alleSkripte(p);
        return e.name.endsWith(".js") ? [p] : [];
    });
}

/**
 * Zeichenketten, Vorlagen, Kommentare und reguläre Ausdrücke durch
 * Leerzeichen ersetzen - Zeilenumbrüche bleiben, damit Zeilennummern
 * stimmen. Danach lassen sich Klammern zählen.
 */
function entkerne(quelle) {
    const aus = quelle.split("");
    const leer = (von, bis) => { for (let k = von; k < bis; k++) if (aus[k] !== "\n") aus[k] = " "; };
    const vorlagenTiefe = [];   // Klammertiefe, bei der ein ${...} in einer Vorlage beginnt
    let tiefe = 0;
    let i = 0;
    let letztes = "";           // letztes bedeutsames Zeichen (für die Erkennung von /regex/)
    let letztesWort = "";

    const vorlageLesen = (start) => {
        // start zeigt auf das Zeichen nach ` oder nach }
        let j = start;
        while (j < quelle.length) {
            const c = quelle[j];
            if (c === "\\") { j += 2; continue; }
            if (c === "`") { leer(start, j); return { ende: j + 1, offen: false }; }
            if (c === "$" && quelle[j + 1] === "{") { leer(start, j); return { ende: j + 2, offen: true }; }
            j++;
        }
        leer(start, j);
        return { ende: j, offen: false };
    };

    while (i < quelle.length) {
        const c = quelle[i];
        const n = quelle[i + 1];
        if (c === "/" && n === "/") {
            const e = quelle.indexOf("\n", i);
            const ende = e < 0 ? quelle.length : e;
            leer(i, ende); i = ende; continue;
        }
        if (c === "/" && n === "*") {
            const e = quelle.indexOf("*/", i + 2);
            const ende = e < 0 ? quelle.length : e + 2;
            leer(i, ende); i = ende; continue;
        }
        if (c === "'" || c === '"') {
            let j = i + 1;
            while (j < quelle.length && quelle[j] !== c && quelle[j] !== "\n") j += quelle[j] === "\\" ? 2 : 1;
            leer(i + 1, j); i = j + 1; letztes = c; continue;
        }
        if (c === "`") {
            const r = vorlageLesen(i + 1);
            if (r.offen) { vorlagenTiefe.push(tiefe); tiefe++; }
            i = r.ende; letztes = "`"; continue;
        }
        if (c === "/") {
            const regexMoeglich = !letztes || "(,=:[!&|?{};+-*%<>~^".includes(letztes)
                || ["return", "typeof", "case", "in", "of", "new", "delete", "void", "throw"].includes(letztesWort);
            if (regexMoeglich) {
                let j = i + 1, klasse = false;
                while (j < quelle.length && quelle[j] !== "\n") {
                    const d = quelle[j];
                    if (d === "\\") { j += 2; continue; }
                    if (d === "[") klasse = true;
                    else if (d === "]") klasse = false;
                    else if (d === "/" && !klasse) break;
                    j++;
                }
                leer(i + 1, j); i = j + 1; letztes = "/"; letztesWort = ""; continue;
            }
        }
        if (c === "{") tiefe++;
        if (c === "}") {
            tiefe--;
            if (vorlagenTiefe.length && vorlagenTiefe[vorlagenTiefe.length - 1] === tiefe) {
                vorlagenTiefe.pop();
                const r = vorlageLesen(i + 1);
                if (r.offen) { vorlagenTiefe.push(tiefe); tiefe++; }
                i = r.ende; letztes = "`"; continue;
            }
        }
        if (/[A-Za-z_$0-9]/.test(c)) {
            let j = i;
            while (j < quelle.length && /[A-Za-z_$0-9]/.test(quelle[j])) j++;
            letztesWort = quelle.slice(i, j);
            letztes = "a";
            i = j; continue;
        }
        if (!/\s/.test(c)) { letztes = c; letztesWort = ""; }
        i++;
    }
    return aus.join("");
}

/**
 * Doppelte Methoden je Klasse - über alle Dateien hinweg. Ausgelagerte Teile
 * ("Object.assign(Klasse.prototype, { ... })", siehe js/ui/ui*.js) zählen zur
 * Klasse: Eine Methode, die dort und im Klassenkörper steht, überschreibt
 * still die aus der Klasse.
 */
const methodenJeKlasse = new Map();   // Klasse -> Map(Schlüssel -> "datei:zeile")
function doppelteMethoden(datei, kern) {
    const zeilen = kern.split("\n");
    const stapel = [];   // { name, tiefe }
    let tiefe = 0;
    zeilen.forEach((zeile, nr) => {
        const klasse = zeile.match(/\bclass\s+([A-Za-z_$][\w$]*)[^{]*\{/)
            || zeile.match(/\b([A-Z][\w$]*)\)?\.prototype,\s*\{\s*$/);
        if (klasse) {
            stapel.push({ name: klasse[1], tiefe: tiefe + 1 });
            if (!methodenJeKlasse.has(klasse[1])) methodenJeKlasse.set(klasse[1], new Map());
        }
        const oben = stapel[stapel.length - 1];
        if (oben && tiefe === oben.tiefe && !klasse) {
            const m = zeile.match(/^\s*(static\s+)?(async\s+)?(get\s+|set\s+)?\*?\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)?\s*\{?/);
            if (m && !["if", "for", "while", "switch", "catch", "return", "function"].includes(m[4])) {
                const schluessel = `${m[1] ? "static " : ""}${m[3] ? m[3].trim() + " " : ""}${m[4]}`;
                const methoden = methodenJeKlasse.get(oben.name);
                if (methoden.has(schluessel)) {
                    fehler.push(`${datei}:${nr + 1}: ${oben.name}.${schluessel} ist doppelt (zuerst in ${methoden.get(schluessel)}) - die spätere überschreibt die frühere`);
                } else {
                    methoden.set(schluessel, `${datei}:${nr + 1}`);
                }
            }
        }
        for (const c of zeile) {
            if (c === "{") tiefe++;
            if (c === "}") {
                tiefe--;
                if (stapel.length && tiefe < stapel[stapel.length - 1].tiefe) stapel.pop();
            }
        }
    });
}

/** Namen, die ein klassisches Skript auf oberster Ebene anlegt */
function globaleNamen(kern) {
    const namen = [];
    let tiefe = 0;
    kern.split("\n").forEach((zeile, nr) => {
        if (tiefe === 0) {
            const m = zeile.match(/^\s*(const|let|class|function)\s+([A-Za-z_$][\w$]*)/);
            if (m) namen.push({ name: m[2], art: m[1], zeile: nr + 1 });
            const d = zeile.match(/^\s*(?:const|let)\s*\{([^}]*)\}\s*=/);
            if (d) d[1].split(",").forEach(teil => {
                const n = teil.split(":").pop().split("=")[0].trim();
                if (n) namen.push({ name: n, zeile: nr + 1, entpackt: true });
            });
        }
        for (const c of zeile) {
            if (c === "{" || c === "(" || c === "[") tiefe++;
            if (c === "}" || c === ")" || c === "]") tiefe--;
        }
    });
    return namen;
}

/** Quelltext einer Deklaration ab Zeile "start" bis zur schließenden Klammer */
function funktionsText(quelle, kernZeilen, start) {
    let tiefe = 0, offen = false;
    for (let z = start; z < kernZeilen.length; z++) {
        for (const c of kernZeilen[z]) {
            if (c === "{") { tiefe++; offen = true; }
            if (c === "}") tiefe--;
        }
        if (offen && tiefe <= 0) return quelle.slice(start, z + 1).join("\n").trim();
    }
    return quelle[start].trim();
}

// ---------------------------------------------------------------- Ablauf

const skripte = alleSkripte(path.join(WURZEL, "js"));
const rel = p => path.relative(WURZEL, p).split(path.sep).join("/");
const kerne = new Map();

// 1. Syntax
skripte.concat(["service-worker.js", "build-einzeldatei.js"].map(d => path.join(WURZEL, d)).filter(fs.existsSync)).forEach(p => {
    const quelle = fs.readFileSync(p, "utf8");
    try {
        new vm.Script(quelle, { filename: rel(p) });
    } catch (e) {
        fehler.push(`${rel(p)}: Syntaxfehler - ${e.message}`);
        return;
    }
    kerne.set(p, entkerne(quelle));
});

// Fremdbibliotheken (js/vendor) sind minifiziert - Syntax ja, Stilprüfungen nein
const istFremd = p => rel(p).startsWith("js/vendor/");

// 2. Doppelte Methoden
kerne.forEach((kern, p) => { if (!istFremd(p)) doppelteMethoden(rel(p), kern); });

// 3. Globale Namen der Skripte, die index.html lädt
const html = fs.readFileSync(path.join(WURZEL, "index.html"), "utf8");
const geladen = [...html.matchAll(/<script\s+src="([^"]+\.js)"/g)].map(m => m[1]);
const vergeben = new Map();
geladen.forEach(src => {
    const p = path.join(WURZEL, src);
    if (!fs.existsSync(p)) { fehler.push(`index.html lädt ${src}, die Datei fehlt`); return; }
    const kern = kerne.get(p);
    if (!kern || istFremd(p)) return;
    // Entpackte Namen ("const { X } = require(...)") stehen in den Dateien
    // hinter einer Node-Weiche und sind im Browser kein Problem
    const quelle = fs.readFileSync(p, "utf8").split("\n");
    globaleNamen(kern).filter(n => !n.entpackt).forEach(n => {
        n.text = funktionsText(quelle, kern.split("\n"), n.zeile - 1);
        if (vergeben.has(n.name)) {
            const frueher = vergeben.get(n.name);
            // Zwei gleichlautende Funktionsdeklarationen sind erlaubt und harmlos;
            // weichen sie voneinander ab, gewinnt still die spätere
            if (n.art === "function" && frueher.art === "function") {
                if (n.text !== frueher.text) fehler.push(`${src}:${n.zeile}: Funktion "${n.name}" überschreibt die abweichende aus ${frueher.src}:${frueher.zeile}`);
                return;
            }
            fehler.push(`${src}:${n.zeile}: globaler Name "${n.name}" ist schon in ${frueher.src}:${frueher.zeile} vergeben - der Browser bricht das Skript ab`);
        } else {
            vergeben.set(n.name, { src, zeile: n.zeile, art: n.art, text: n.text });
        }
    });
});

// 4. Service Worker und ungeladene Dateien
const sw = fs.existsSync(path.join(WURZEL, "service-worker.js")) ? fs.readFileSync(path.join(WURZEL, "service-worker.js"), "utf8") : "";
geladen.forEach(src => {
    if (sw && !sw.includes(src)) fehler.push(`service-worker.js: ${src} fehlt im Cache - offline startet die App nicht`);
});
// Bei Bedarf nachgeladen statt beim Start: Datei -> wer sie lädt. Der Lader
// muss den Pfad kennen, und offline vorrätig muss sie trotzdem sein.
const NACHGELADEN = { "js/vendor/three.min.js": "js/ui/spielfeld3d.js" };
Object.entries(NACHGELADEN).forEach(([datei, lader]) => {
    const quelle = fs.existsSync(path.join(WURZEL, lader)) ? fs.readFileSync(path.join(WURZEL, lader), "utf8") : "";
    if (!quelle.includes(datei)) fehler.push(`${lader}: lädt ${datei} nicht nach`);
    if (geladen.includes(datei)) fehler.push(`${datei}: steht in index.html, soll aber erst bei Bedarf laden`);
    if (sw && !sw.includes(datei)) fehler.push(`service-worker.js: ${datei} fehlt im Cache - offline geht die 3D-Ansicht nicht`);
});
skripte.map(rel).forEach(src => {
    if (!geladen.includes(src) && !NACHGELADEN[src]) fehler.push(`${src}: wird von index.html nicht geladen`);
});

if (fehler.length) {
    console.error(`❌ Prüfung: ${fehler.length} Befund(e)`);
    fehler.forEach(f => console.error("  " + f));
    process.exit(1);
}
console.log(`✅ Prüfung: ${kerne.size} Dateien ohne Befund (Syntax, doppelte Methoden, globale Namen, Service Worker)`);
