/**
 * WetterEngine - Wetter und Platzverhältnisse
 *
 * Jedes Spiel bekommt sein Wetter, passend zur Jahreszeit: im August
 * Sonne und Hitze, im Herbst Regen, im Winter Frost und Schnee. Dazu den
 * Zustand des Rasens - ein Bundesligastadion mit Rasenheizung hat auch im
 * Januar einen guten Platz, beim Landesligisten steht das Wasser.
 *
 * Das Wetter wirkt im Livespiel:
 *  - nasser Rasen macht den Ball schnell und die Pässe ungenauer, Schüsse
 *    aus der Distanz werden tückisch für den Torwart
 *  - tiefer Boden kostet Kraft und Genauigkeit
 *  - Wind verweht lange Bälle und Fernschüsse
 *  - Hitze zehrt an der Ausdauer
 *
 * Bestimmt wird es fest aus der Partie (Vereine, Spieltag), so dass dasselbe
 * Spiel nach dem Laden dasselbe Wetter hat.
 */

const WetterEngine = {
    ARTEN: {
        sonnig: { name: "Sonnig", icon: "☀️" },
        bewoelkt: { name: "Bewölkt", icon: "☁️" },
        regen: { name: "Regen", icon: "🌧️", pass: -0.02, fern: 0.08, ausdauer: 1.03, rutschig: 0.25 },
        starkregen: { name: "Starkregen", icon: "⛈️", pass: -0.04, lang: -0.02, fern: 0.12, ausdauer: 1.08, rutschig: 0.45 },
        schnee: { name: "Schneefall", icon: "🌨️", pass: -0.035, lang: -0.02, fern: 0.06, ausdauer: 1.06, rutschig: 0.35 },
        wind: { name: "Sturmböen", icon: "💨", pass: -0.005, lang: -0.06, fern: -0.08, ausdauer: 1.02 },
        hitze: { name: "Hitze", icon: "🔥", pass: -0.005, ausdauer: 1.18 }
    },

    PLAETZE: {
        gut: { name: "guter Rasen" },
        nass: { name: "nasser Rasen", pass: -0.01, fern: 0.03 },
        tief: { name: "tiefer Boden", pass: -0.03, lang: -0.01, ausdauer: 1.08 },
        hart: { name: "gefrorener Boden", pass: -0.02, ausdauer: 1.02, rutschig: 0.2 },
        trocken: { name: "trockener, harter Rasen", pass: -0.005 }
    },

    /**
     * Wahrscheinlichkeiten je Monat (Saison beginnt im August):
     * [sonnig, bewölkt, regen, starkregen, schnee, wind, hitze] und
     * Durchschnittstemperatur.
     */
    KLIMA: {
        1: { w: [10, 35, 20, 5, 22, 8, 0], t: 1 },
        2: { w: [12, 35, 22, 6, 15, 10, 0], t: 3 },
        3: { w: [18, 35, 25, 7, 3, 12, 0], t: 7 },
        4: { w: [28, 32, 25, 6, 0, 9, 0], t: 11 },
        5: { w: [40, 28, 20, 5, 0, 5, 2], t: 16 },
        6: { w: [45, 22, 15, 5, 0, 3, 10], t: 20 },
        7: { w: [45, 20, 12, 5, 0, 3, 15], t: 22 },
        8: { w: [45, 22, 12, 5, 0, 3, 13], t: 22 },
        9: { w: [35, 30, 20, 6, 0, 6, 3], t: 17 },
        10: { w: [20, 35, 28, 8, 0, 9, 0], t: 12 },
        11: { w: [12, 38, 30, 8, 4, 8, 0], t: 7 },
        12: { w: [10, 36, 22, 6, 18, 8, 0], t: 3 }
    },

    _hash(text) {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
        h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
        return (h >>> 0) / 4294967296;
    },

    /**
     * Der Monat einer Partie: aus dem Datum, sonst aus dem Spieltag. Die
     * Vorbereitung liegt im Juli und August, der erste Spieltag Ende August,
     * der letzte im Mai.
     */
    monat(match) {
        if (match?.datum) {
            const teile = String(match.datum).split(".");
            if (teile.length >= 2 && Number(teile[1]) >= 1) return Number(teile[1]);
        }
        const md = Number(match?.matchday || match?.spieltag || 0);
        if (!md) return 8;
        return ((7 + Math.floor((25 + md * 6.8) / 30.5)) % 12) + 1;
    },

    /** Wetter und Platz einer Partie - fest bestimmt und an der Partie gemerkt */
    fuer(match, heimverein = null) {
        if (!match) return this.neutral();
        if (match.wetter && match.wetter.art) return this.mitWirkung(match.wetter);
        const monat = this.monat(match);
        const klima = this.KLIMA[monat] || this.KLIMA[9];
        const schluessel = `${match.id || ""}|${match.homeClubId || ""}|${match.awayClubId || ""}|${match.matchday || ""}`;
        const z1 = this._hash(schluessel + "|w");
        const z2 = this._hash(schluessel + "|t");
        const z3 = this._hash(schluessel + "|p");
        const arten = ["sonnig", "bewoelkt", "regen", "starkregen", "schnee", "wind", "hitze"];
        const summe = klima.w.reduce((a, b) => a + b, 0);
        let r = z1 * summe;
        let art = "bewoelkt";
        for (let i = 0; i < arten.length; i++) { r -= klima.w[i]; if (r <= 0) { art = arten[i]; break; } }
        let temp = Math.round(klima.t + (z2 - 0.5) * 10);
        if (art === "hitze") temp = Math.max(temp, 29);
        if (art === "schnee") temp = Math.min(temp, 1);

        // Der Rasen: Je tiefer die Liga, desto schlechter steckt er das Wetter weg
        const stufe = heimverein?.level || 1;
        const schlecht = Math.min(0.9, 0.1 + (stufe - 1) * 0.12);
        let platz = "gut";
        if (art === "starkregen") platz = z3 < 0.35 + schlecht * 0.5 ? "tief" : "nass";
        else if (art === "regen") platz = z3 < schlecht * 0.6 ? "tief" : "nass";
        else if (art === "schnee" || temp <= -1) platz = z3 < 0.25 + schlecht * 0.6 ? "hart" : "gut";
        else if (art === "hitze") platz = z3 < 0.4 ? "trocken" : "gut";

        const wetter = { art, temp, platz };
        match.wetter = wetter;
        return this.mitWirkung(wetter);
    },

    neutral() {
        return this.mitWirkung({ art: "bewoelkt", temp: 14, platz: "gut" });
    },

    /** Wetter und Platz zu einer Wirkung zusammenrechnen */
    mitWirkung(wetter) {
        const a = this.ARTEN[wetter.art] || this.ARTEN.bewoelkt;
        const p = this.PLAETZE[wetter.platz] || this.PLAETZE.gut;
        return {
            ...wetter,
            pass: (a.pass || 0) + (p.pass || 0),
            lang: (a.lang || 0) + (p.lang || 0),
            fern: (a.fern || 0) + (p.fern || 0),
            ausdauer: (a.ausdauer || 1) * (p.ausdauer || 1),
            rutschig: Math.min(0.6, (a.rutschig || 0) + (p.rutschig || 0)),
            name: a.name,
            icon: a.icon,
            platzName: p.name
        };
    },

    /** "Starkregen, 7 °C · tiefer Boden" */
    text(match, heimverein = null) {
        const w = this.fuer(match, heimverein);
        return `${w.name}, ${w.temp} °C · ${w.platzName}`;
    },

    /** Was das Wetter für das Spiel bedeutet - für Vorschau und Co-Trainer */
    hinweis(w) {
        if (!w) return "";
        if (w.platz === "tief") return "Tiefer Boden: Das kostet Kraft, kurze Pässe bleiben hängen. Früher wechseln, öfter lang spielen.";
        if (w.art === "starkregen" || w.platz === "nass") return "Nasser Rasen: Der Ball wird schnell, Fernschüsse sind für den Torwart tückisch.";
        if (w.art === "wind") return "Starker Wind: Lange Bälle und Flanken verspringen - flach spielen lohnt sich.";
        if (w.art === "hitze") return "Hitze: Die Kraft lässt früher nach. Rotation und frühe Wechsel helfen.";
        if (w.platz === "hart") return "Gefrorener Boden: Der Ball verspringt, Zweikämpfe werden gefährlich.";
        return "";
    }
};

if (typeof window !== "undefined") {
    window.WetterEngine = WetterEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { WetterEngine };
}
