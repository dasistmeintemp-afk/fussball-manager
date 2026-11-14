/**
 * Kontrastmodus für Farbschwäche.
 *
 * Gut und schlecht standen überall in Grün und Rot - für rund jeden zwölften
 * Mann kaum zu unterscheiden. Im Kontrastmodus werden die Zustandsfarben zu
 * Blau, Gelb und Orange (unterscheidbar bei jeder Form der Farbschwäche),
 * gedämpfter Text wird heller, Rahmen kräftiger. Im 2D-Spiel tragen die
 * Mannschaften Blau und Gelb statt der Vereinsfarben, die Torhüter Weiß und
 * Schwarz.
 *
 * Gesetzt wird ein Merkmal am Wurzelelement (data-kontrast="an"), die Farben
 * stehen in css/glanz.css. Die Wahl gilt für dieses Gerät, wie die Farben.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    KONTRAST_SPEICHER: "viererkette-kontrast",

    /** Trikots im Kontrastmodus: Heim blau, Gast gelb - bei jeder Farbschwäche zu trennen */
    KONTRAST_TRIKOTS: {
        home: { farbe: "#1f6fd1", text: "#ffffff", akzent: "#56b4e9", tw: "#ffffff" },
        away: { farbe: "#f0e442", text: "#111827", akzent: "#f0e442", tw: "#111827" }
    },

    kontrastAn() {
        try {
            if (typeof localStorage !== "undefined") return localStorage.getItem(this.KONTRAST_SPEICHER) === "an";
        } catch (e) { /* ohne Speicher gilt, was in dieser Sitzung gewählt wurde */ }
        return !!this._kontrastFallback;
    },

    setzeKontrast(an) {
        try { if (typeof localStorage !== "undefined") localStorage.setItem(this.KONTRAST_SPEICHER, an ? "an" : "aus"); } catch (e) { /* gilt dann nur bis zum Neuladen */ }
        this._kontrastFallback = !!an;
        this.wendeKontrastAn();
        // Ein laufendes Spiel zieht sofort nach
        if (this.app?.currentLiveMatch) this.kontrastTrikots(this.app.currentLiveMatch);
    },

    /** Das Merkmal am Wurzelelement setzen (beim Laden und bei jeder Änderung) */
    wendeKontrastAn() {
        const root = typeof document !== "undefined" ? document.documentElement : null;
        if (!root || !root.dataset) return;
        if (this.kontrastAn()) root.dataset.kontrast = "an";
        else delete root.dataset.kontrast;
    },

    /**
     * Die Trikots eines Livespiels auf Blau und Gelb stellen - oder zurück auf
     * die Vereinsfarben, wenn der Modus aus ist.
     */
    kontrastTrikots(liveMatch) {
        if (!liveMatch || !liveMatch.kits) return false;
        const an = this.kontrastAn();
        if (!liveMatch._vereinsTrikots) {
            liveMatch._vereinsTrikots = { home: { ...liveMatch.kits.home }, away: { ...liveMatch.kits.away } };
        }
        if (!an && !liveMatch._kontrast) return false;
        ["home", "away"].forEach(team => {
            const kit = an ? { ...liveMatch._vereinsTrikots[team], ...this.KONTRAST_TRIKOTS[team] } : { ...liveMatch._vereinsTrikots[team] };
            liveMatch.kits[team] = kit;
            (liveMatch.players2D || []).forEach(p => {
                if (p.team !== team) return;
                p.color = kit.farbe;
                p.textColor = kit.text;
            });
        });
        liveMatch._kontrast = an;
        return an;
    },

    /** Der Schalter unter "Spielstand & Optionen", bei den Farben */
    kontrastEinstellungHtml() {
        return `
            <label class="coach-switch einstellung-schalter">
                <input type="checkbox" id="kontrastSchalter" ${this.kontrastAn() ? "checked" : ""}>
                <span class="coach-switch-text"><strong>Kontrastmodus</strong><br><span class="coach-muted">Für Farbschwäche: Blau, Gelb und Orange statt Grün und Rot, hellerer Text, kräftigere Rahmen. Im 2D-Spiel tragen die Mannschaften Blau und Gelb.</span></span>
            </label>`;
    },

    bindeKontrastEinstellung(el) {
        const schalter = el ? el.querySelector("#kontrastSchalter") : null;
        if (!schalter) return;
        schalter.onchange = () => {
            this.setzeKontrast(schalter.checked);
            this.showToast?.(`Kontrastmodus ${schalter.checked ? "an" : "aus"}`, "success");
        };
    }
});
