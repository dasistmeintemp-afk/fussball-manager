/**
 * Vereinsfarben in der ganzen Oberfläche.
 *
 * Die Oberfläche hängt an einer Akzentfarbe (--accent-rgb in css/style.css):
 * Knöpfe, aktive Reiter, Markierungen, Balken, Rahmen. Sie war fest
 * Limette, egal für welchen Verein man arbeitet. Jetzt nimmt sie die Farbe
 * des eigenen Vereins an - beim Laden, beim neuen Spiel und beim
 * Vereinswechsel, denn renderHeader ruft wendeVereinsfarbenAn auf.
 *
 * Gesetzt werden nur CSS-Variablen am Wurzelelement; alles, was sie nutzt,
 * folgt von selbst. Die Zustandsfarben (gut, Warnung, schlecht) bleiben,
 * wie sie sind - ein roter Verein soll keine Warnungen verwischen.
 *
 * Lesbarkeit: Eine dunkle Vereinsfarbe würde auf den dunklen Flächen
 * verschwinden. Sie wird aufgehellt, bis sie gegen die dunkelste
 * Kartenfläche einen Kontrast von 4,5:1 hat. Schwarz-weiße Vereine haben
 * keine Farbe, die trägt: Sie bekommen Silber. Die Schrift auf Akzentflächen
 * ist dunkel oder weiß, je nachdem, was mehr Kontrast gibt.
 *
 * Wer das ruhige Grundthema lieber hat, stellt es unter "Spielstand &
 * Optionen" zurück. Die Wahl gilt für dieses Gerät, wie das Menü.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype
 * (wie uiKopfmenue.js).
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    FARBEN_SPEICHER: "viererkette-farben",

    FARBEN_ARTEN: {
        verein: { titel: "Vereinsfarben", text: "Knöpfe, Markierungen und Rahmen in der Farbe des eigenen Vereins - aufgehellt, wo sie sonst nicht lesbar wäre." },
        flutlicht: { titel: "Flutlicht", text: "Das ruhige Grundthema: Graphit mit Limette, für jeden Verein gleich." }
    },

    /** Dunkelste Kartenfläche (--surface-3), gegen die der Akzent lesbar sein muss */
    FARBEN_FLAECHE: [29, 37, 48],
    /** Ab dieser Buntheit (größter minus kleinster Kanal) trägt eine Farbe als Akzent */
    FARBEN_MIN_BUNT: 60,
    FARBEN_SILBER: [207, 214, 223],

    farbenArt() {
        try {
            const wert = localStorage.getItem(this.FARBEN_SPEICHER);
            if (this.FARBEN_ARTEN[wert]) return wert;
        } catch (e) { /* ohne Speicher gilt, was in dieser Sitzung gewählt wurde */ }
        return this._farbenArt || "verein";
    },

    setzeFarbenArt(art) {
        if (!this.FARBEN_ARTEN[art]) return;
        try { localStorage.setItem(this.FARBEN_SPEICHER, art); } catch (e) { /* gilt dann nur bis zum Neuladen */ }
        this._farbenArt = art;
        const state = this.app && this.app.state;
        this.wendeVereinsfarbenAn(state ? (state.clubs || []).find(c => c.id === state.userClubId) : null);
    },

    /**
     * Akzent aus den Vereinsfarben: { rgb: [r, g, b], hover, tinte } oder
     * null ohne Verein. Erst die Hauptfarbe, ist sie grau, die Zweitfarbe.
     */
    vereinsAkzent(club) {
        if (!club) return null;
        const zuRgb = (wert) => {
            let m = /^#?([0-9a-f]{6})$/i.exec(String(wert || "").trim());
            if (!m) {
                const k = /^#?([0-9a-f]{3})$/i.exec(String(wert || "").trim());
                if (!k) return null;
                m = [k[0], k[1].split("").map(c => c + c).join("")];
            }
            const n = parseInt(m[1], 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        };
        const bunt = (c) => Math.max(...c) - Math.min(...c);
        const farben = [club.primaryColor, club.secondaryColor].map(zuRgb).filter(Boolean);
        let farbe = farben.find(c => bunt(c) >= this.FARBEN_MIN_BUNT) || (farben.length ? this.FARBEN_SILBER : null);
        if (!farbe) return null;
        const hell = (c) => c.map(v => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        }).reduce((summe, v, i) => summe + v * [0.2126, 0.7152, 0.0722][i], 0);
        const kontrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const flaeche = hell(this.FARBEN_FLAECHE);
        for (let i = 0; i < 24 && kontrast(hell(farbe), flaeche) < 4.5; i++) {
            farbe = farbe.map(v => Math.round(v + (255 - v) * 0.12));
        }
        const hover = farbe.map(v => Math.round(v + (255 - v) * 0.25));
        const l = hell(farbe);
        const tinte = kontrast(l, hell([11, 16, 4])) >= kontrast(l, 1) ? "#0b1004" : "#ffffff";
        return { rgb: farbe, hover: `rgb(${hover.join(", ")})`, tinte };
    },

    /** Setzt die Variablen am Wurzelelement - oder nimmt sie zurück (Flutlicht, kein Verein) */
    wendeVereinsfarbenAn(club) {
        const root = typeof document !== "undefined" ? document.documentElement : null;
        if (!root || !root.style) return;
        const akzent = this.farbenArt() === "verein" ? this.vereinsAkzent(club) : null;
        const schluessel = akzent ? akzent.rgb.join(",") : "";
        if (this._vereinsAkzent === schluessel) return;
        this._vereinsAkzent = schluessel;
        const namen = ["--accent-rgb", "--accent-primary-hover", "--accent-ink", "--rahmen-feld"];
        if (!akzent) {
            namen.forEach(n => root.style.removeProperty(n));
            if (root.dataset) delete root.dataset.farben;
            return;
        }
        root.style.setProperty("--accent-rgb", akzent.rgb.join(", "));
        root.style.setProperty("--accent-primary-hover", akzent.hover);
        root.style.setProperty("--accent-ink", akzent.tinte);
        root.style.setProperty("--rahmen-feld", `rgba(${akzent.rgb.join(", ")}, 0.6)`);
        if (root.dataset) root.dataset.farben = "verein";
    },

    /** Einstellung unter "Spielstand & Optionen" */
    renderFarbenEinstellung() {
        const el = typeof document !== "undefined" && document.getElementById ? document.getElementById("settingsFarben") : null;
        if (!el) return;
        const aktuell = this.farbenArt();
        el.innerHTML = Object.entries(this.FARBEN_ARTEN).map(([key, f]) => `
            <label class="coach-switch einstellung-schalter">
                <input type="radio" name="farbenArt" value="${key}" ${key === aktuell ? "checked" : ""}>
                <span class="coach-switch-text"><strong>${f.titel}</strong><br><span class="coach-muted">${f.text}</span></span>
            </label>`).join("");
        el.querySelectorAll("input[name=farbenArt]").forEach(inp => inp.onchange = () => {
            this.setzeFarbenArt(inp.value);
            this.showToast(`Farben: ${this.FARBEN_ARTEN[inp.value].titel}`, "success");
        });
    }
});
