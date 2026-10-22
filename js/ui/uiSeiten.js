/**
 * Eigene Seiten im Inhaltsbereich, wie im Vorbild: das Spielerprofil
 * (uiProfil.js), das Transferangebot (uiAngebot.js) und das Vereinsprofil
 * (uiVereinSeite.js).
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 * Eine Seite löst den Reiter ab, statt als Fenster darüber zu liegen.
 * Kopfleiste, Navigation und Weiter bleiben. Jede geöffnete Seite ist ein
 * Eintrag im Verlauf: Zurück (der Knopf auf der Seite, der in der
 * Kopfleiste, Alt+←, Escape, die Zurück-Taste am Handy) führt zur vorigen
 * Seite oder zum Reiter, von dem man kam. Es ist immer höchstens eine Seite
 * offen.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /** Die Seiten und ihre Elemente */
    SEITEN: { akte: "modalPlayerDetails", angebot: "angebotSeite", verein: "vereinsSeite" },

    /** Fenster, die über allem bleiben: das laufende Spiel, der Karriere-Assistent, der Saisonabschluss */
    SEITE_GESCHUETZT: ["modalLiveMatch", "modalNewGame", "modalSeasonEnd"],

    _seitenElement(art) {
        return typeof document !== "undefined" && document.getElementById ? document.getElementById(this.SEITEN[art]) : null;
    },

    /** Welche Seite offen ist: "akte", "angebot", "verein" oder null */
    offeneSeite() {
        return Object.keys(this.SEITEN).find(art => {
            const el = this._seitenElement(art);
            return !!el && !!el.style && !!el.style.display && el.style.display !== "none";
        }) || null;
    },

    /**
     * Eine Seite zeigen. Für einen neuen Inhalt: offene Fenster schließen (die
     * Seite liegt nicht über ihnen), eine andere Seite ablösen, den Reiter
     * darunter zurücktreten lassen, oben beginnen und einen Eintrag im Verlauf
     * anlegen. Zeichnet die Seite denselben Inhalt neu (nach einer Aktion),
     * bleibt alles, wie es ist.
     */
    zeigeSeite(art, id) {
        const seite = this._seitenElement(art);
        if (!seite) return;
        const bereich = document.getElementById("contentArea");
        const vorher = this.offeneSeite();
        const neu = vorher !== art || String(this._seitenId) !== String(id);
        if (neu && typeof document.querySelectorAll === "function") {
            document.querySelectorAll(".modal-overlay").forEach(m => {
                if (m.style.display && m.style.display !== "none" && !this.SEITE_GESCHUETZT.includes(m.id)) m.style.display = "none";
            });
            this.schliesseKontextmenue?.();
        }
        if (!vorher) {
            this._seitenRueckweg = { bereich: bereich ? bereich.scrollTop : 0, fenster: typeof window !== "undefined" ? (window.scrollY || 0) : 0 };
        }
        // Eine andere Seite tritt ab - ohne dass der Reiter darunter zurückkommt
        this._seiteWechselt = true;
        try {
            Object.keys(this.SEITEN).forEach(a => {
                const el = this._seitenElement(a);
                if (a !== art && el && el.style.display && el.style.display !== "none") el.style.display = "none";
            });
        } finally {
            this._seiteWechselt = false;
        }
        this._seitenArt = art;
        this._seitenId = id;
        this._seitenState = this.app?.state || null;
        seite.style.display = "block";
        if (bereich && bereich.classList) bereich.classList.add("seite-offen");
        this._beobachteSeite(art, seite, bereich);
        if (neu) {
            if (bereich) bereich.scrollTop = 0;
            if (typeof window !== "undefined" && typeof window.scrollTo === "function") window.scrollTo(0, 0);
            this.merkeSeitenVerlauf(art, id);
        }
    },

    /**
     * Wer eine Seite auf anderem Weg schließt (style.display = "none", etwa vor
     * einer Verhandlung), bringt den Reiter darunter trotzdem zurück.
     */
    _beobachteSeite(art, seite, bereich) {
        this._seitenBeobachter = this._seitenBeobachter || {};
        if (this._seitenBeobachter[art] || typeof MutationObserver === "undefined") return;
        this._seitenBeobachter[art] = new MutationObserver(() => {
            if (this._seiteWechselt || (seite.style.display && seite.style.display !== "none")) return;
            if (this._seitenArt === art) this._nachSeiteZu(bereich);
        });
        this._seitenBeobachter[art].observe(seite, { attributes: true, attributeFilter: ["style"] });
    },

    _nachSeiteZu(bereich = document.getElementById("contentArea")) {
        if (!bereich || !bereich.classList || !bereich.classList.contains("seite-offen")) return;
        if (this.offeneSeite()) return;
        bereich.classList.remove("seite-offen");
        this._seitenArt = null;
        this._seitenId = null;
        const weg = this._seitenRueckweg;
        this._seitenRueckweg = null;
        if (weg) {
            bereich.scrollTop = weg.bereich || 0;
            if (typeof window !== "undefined" && typeof window.scrollTo === "function") window.scrollTo(0, weg.fenster || 0);
        }
    },

    /** Die offene Seite schließen, ohne den Verlauf anzufassen */
    schliesseSeite() {
        const art = this.offeneSeite();
        if (!art) return false;
        this._seitenElement(art).style.display = "none";
        this._nachSeiteZu();
        return true;
    },

    /** Zurück von einer Seite: über den Verlauf, wenn sie dort steht - sonst einfach zu */
    seiteZurueck() {
        const stand = typeof history !== "undefined" ? history.state : null;
        if (stand && stand.vkSeite && (this._verlaufTiefe || 0) > 0) {
            history.back();
            return;
        }
        this.schliesseSeite();
    },

    /** Eine Seite ist ein Eintrag im Verlauf */
    merkeSeitenVerlauf(art, id) {
        if (this._ausVerlauf || !this.app?.state || typeof history === "undefined" || typeof history.pushState !== "function") return;
        const stand = typeof this._verlaufStand === "function" ? this._verlaufStand() : { vkTab: this.activeTab };
        stand.vkSeite = art;
        stand.vkId = id;
        try {
            history.pushState(stand, "");
            this._verlaufTiefe = (this._verlaufTiefe || 0) + 1;
        } catch (e) { /* ohne Verlauf geht es auch */ }
        this.aktualisiereZurueck?.();
    },

    /** Aus dem Verlauf: die Seite wieder zeigen - oder schließen, wenn es sie nicht mehr gibt */
    seiteAusVerlauf(art, id) {
        if (art === "akte" && this.findAnyPlayer?.(id)) return this.showPlayerDetailsModal(id);
        if (art === "angebot" && typeof this.zeigeAngebotSeite === "function" && this.angebotVon?.(id)) return this.zeigeAngebotSeite(id);
        if (art === "verein" && (this.app?.state?.clubs || []).some(c => String(c.id) === String(id))) return this.showClubDetailsModal(id);
        this.schliesseSeite();
    },

    /** Nach einem neuen Spieltag oder einer Aktion woanders: die offene Seite neu zeichnen */
    aktualisiereSeite() {
        const art = this.offeneSeite();
        if (!art || this._seitenId === null || this._seitenId === undefined || this._seiteZeichnet) return;
        if (this._seitenState !== this.app?.state) { this.schliesseSeite(); return; }
        if (art === "akte") {
            if (!this.findAnyPlayer(this._seitenId)) { this.schliesseSeite(); return; }
            this.showPlayerDetailsModal(this._seitenId);
        } else if (art === "angebot") {
            if (!this.angebotVon?.(this._seitenId)) { this.schliesseSeite(); return; }
            this.zeigeAngebotSeite(this._seitenId);
        } else if (art === "verein") {
            if (!(this.app.state.clubs || []).some(c => String(c.id) === String(this._seitenId))) { this.schliesseSeite(); return; }
            this.showClubDetailsModal(this._seitenId);
        }
    },

    // Die Spielerseite unter ihren gewohnten Namen
    akteOffen() { return this.offeneSeite() === "akte"; },
    zeigeAkteSeite(playerId) { this.zeigeSeite("akte", playerId); },
    schliesseAkte() { return this.offeneSeite() === "akte" ? this.schliesseSeite() : false; },
    akteZurueck() { this.seiteZurueck(); },
    aktualisiereAkte() { this.aktualisiereSeite(); }
});
