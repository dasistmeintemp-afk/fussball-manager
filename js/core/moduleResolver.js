/**
 * ModuleResolver - Einheitliche Auflösung von Modulen in Browser und Node
 *
 * Das Projekt läuft ohne Buildschritt: Im Browser hängen alle Module an
 * window, in der Node-Testumgebung werden sie über require geladen. Die
 * früher verstreuten Ketten der Form
 *
 *     typeof X !== 'undefined' ? X : (typeof window !== 'undefined' ? window.X : require(...))
 *
 * brachen ab, sobald eine window-Attrappe existierte, die das gesuchte Modul
 * nicht kannte: Der require-Zweig wurde dann nie erreicht und die Auflösung
 * lieferte undefined.
 *
 * createResolver bekommt das require des aufrufenden Moduls übergeben, damit
 * relative Pfade weiterhin relativ zur aufrufenden Datei gelten.
 */

function createResolver(req) {
    // Was über require gefunden wurde, bleibt gemerkt. require ist zwar
    // selbst zwischengespeichert, löst aber jedes Mal den Pfad neu auf - in
    // den heißen Schleifen der Simulation kostete das unter Node ein Drittel
    // der Rechenzeit. Im Browser greift ohnehin der erste Zweig.
    const geladen = new Map();
    return function resolve(name, path) {
        if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
        if (typeof window !== "undefined" && window[name]) return window[name];
        if (typeof req === "function" && path) {
            const schluessel = `${name}|${path}`;
            if (geladen.has(schluessel)) return geladen.get(schluessel);
            try {
                const mod = req(path);
                // Ein Modul, das gerade noch lädt (Kreis), liefert noch
                // nichts - dann beim nächsten Mal erneut fragen
                if (mod && mod[name]) {
                    geladen.set(schluessel, mod[name]);
                    return mod[name];
                }
            } catch (e) {
                return null;
            }
        }
        return null;
    };
}

if (typeof window !== "undefined") {
    window.createResolver = createResolver;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { createResolver };
}
