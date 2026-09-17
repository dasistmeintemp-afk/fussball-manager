/**
 * Baut aus dem Spiel eine einzige HTML-Datei zum Verschicken.
 *
 * Das Spiel besteht aus index.html, einem Stylesheet und 42 Skriptdateien.
 * Per E-Mail oder Messenger lässt sich davon nur eine Datei sinnvoll
 * weitergeben - also wandern Stylesheet, Skripte und Icon direkt in die
 * HTML-Datei hinein, in exakt derselben Reihenfolge wie im Original.
 */
const fs = require('fs');
const path = require('path');

const WURZEL = __dirname;
const ZIEL = process.argv[2] || path.join(WURZEL, 'fussball-manager-komplett.html');

let html = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');

// Skripte und Styles dürfen nicht durch </script> im Inhalt zerrissen werden
const entschaerfen = (code) => code
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<!--/g, '<\\!--');

// 1. Stylesheet einbetten
let styles = 0;
html = html.replace(/[ \t]*<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>\s*/gi, (treffer, datei) => {
    const p = path.join(WURZEL, datei);
    if (!fs.existsSync(p)) { console.warn('  fehlt:', datei); return treffer; }
    styles++;
    return `<style>\n${fs.readFileSync(p, 'utf8')}\n</style>\n`;
});

// 2. Icon als Data-URI, damit das Tab-Symbol auch ohne Dateien daneben steht
const iconPfad = path.join(WURZEL, 'icon-192.png');
if (fs.existsSync(iconPfad)) {
    const dataUri = 'data:image/png;base64,' + fs.readFileSync(iconPfad).toString('base64');
    html = html.replace(/href=["']icon-192\.png["']/g, `href="${dataUri}"`);
}

// 3. Das Manifest zeigt auf Dateien, die es hier nicht gibt - raus damit
html = html.replace(/[ \t]*<link[^>]*rel=["']manifest["'][^>]*>\s*/gi, '');

// 4. Alle Skripte in Originalreihenfolge einbetten
let skripte = 0, fehlend = [];
html = html.replace(/[ \t]*<script[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>\s*/gi, (treffer, datei) => {
    const p = path.join(WURZEL, datei);
    if (!fs.existsSync(p)) { fehlend.push(datei); return treffer; }
    skripte++;
    return `<script>\n${entschaerfen(fs.readFileSync(p, 'utf8'))}\n</script>\n`;
});

// 5. Hinweis in den Kopf der Datei
html = html.replace(/<head>/i, `<head>
<!--
  Fußball-Manager - vollständiges Spiel in einer einzigen Datei.
  Mit einem Doppelklick im Browser öffnen. Es wird nichts installiert und
  nichts ins Internet geschickt; der Spielstand liegt im Browser des Geräts.
-->`);

fs.writeFileSync(ZIEL, html);

const groesse = fs.statSync(ZIEL).size;
console.log(`Gebündelt: ${skripte} Skripte, ${styles} Stylesheet(s)`);
if (fehlend.length) console.log(`NICHT GEFUNDEN: ${fehlend.join(', ')}`);
console.log(`Datei: ${ZIEL} (${(groesse / 1024 / 1024).toFixed(2)} MB)`);

// Gegenprobe: keine externen Verweise mehr übrig
const rest = [...html.matchAll(/(?:src|href)=["'](?!data:|#|https?:|mailto:)([^"']+)["']/gi)].map(m => m[1]);
console.log(rest.length ? `Offene externe Verweise: ${[...new Set(rest)].join(', ')}` : 'Keine externen Verweise mehr.');
