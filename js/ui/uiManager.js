/**
 * UIManager - Rendert alle Tabs, Modale, Tabellen und steuert die 2D Canvas Match Visualisierung
 */

/**
 * Die Torlinien in Feldkoordinaten. Die Simulation legt die Tore bei x = 4
 * und x = 96; das gezeichnete Feld reicht von Torlinie zu Torlinie.
 */
const TORLINIE_LINKS = 4;
const TORLINIE_RECHTS = 96;
const FELD_LAENGE = TORLINIE_RECHTS - TORLINIE_LINKS;

class UIManager {
    constructor(app) {
        this.app = app;
        this.activeTab = "dashboard";
        this.selectedPitchSlot = null;
        this.currentFixtureMatchday = 1;
        this.liveMatchAnimFrame = null;
        this.soundEnabled = true;
        // Der Maßstab der Sterne gilt vom ersten Tag an, auch für Scoutberichte
        const bewertung = this.getRatingEngine();
        if (bewertung) bewertung.massstab = this.sternMassstab();
        this.audioCtx = null;
        this.wizardStep = 1;
        this.wizardSelectedClubId = null;
        this.selectedInboxMessageId = null;
        this.inboxFilter = "all";
        this.inboxSearch = "";

        // 2D-Rendering: vorgerenderter Rasen, Textbreiten-Cache und Feed-Status
        this.pitchBackdrop = null;
        this.pitchBackdropKey = "";
        this.textWidthCache = new Map();
        this.renderedEventCount = 0;
        this.liveStatCache = {};

        // Formations-Editor
        this.formationEditMode = false;
        this.formationDraft = null;
        this.formationDirty = false;
        this.draggingSlot = null;
    }

    /**
     * Initialisiert die UI
     */
    init() {
        // Meldungen: eine Zeile unter der Kopfleiste und die Zentrale (uiMeldungen.js)
        if (typeof this.richteMeldungenEin === "function") this.richteMeldungenEin();
        this.bindNavigation();
        this.bindGlobalEvents();
        this.bindStartScreenEvents();
        this.bindWizardEvents();
        this.bindModalDismiss();
        // Unterreiter, Suche, Zurück, Tasten, Kontextmenü, Sortieren (uiNavigation.js)
        if (typeof this.initNavigation === "function") this.initNavigation();
    }

    /**
     * Modale schließen sich per Klick auf den Hintergrund und mit Escape.
     *
     * Das kleine × oben rechts bleibt erhalten, ist aber nicht mehr der
     * einzige Weg heraus. Das Live-Spiel und der Karriere-Assistent sind
     * bewusst ausgenommen: Dort würde ein versehentlicher Klick daneben
     * ein laufendes Spiel oder eine halb ausgefüllte Karriere verwerfen.
     */
    bindModalDismiss() {
        const geschuetzt = ["modalLiveMatch", "modalNewGame", "modalSeasonEnd"];

        const schliesse = (modal) => {
            if (!modal || geschuetzt.includes(modal.id)) return false;
            modal.style.display = "none";
            return true;
        };

        document.querySelectorAll(".modal-overlay").forEach(modal => {
            modal.addEventListener("click", (event) => {
                // Nur ein Klick auf die Fläche neben dem Inhalt schließt
                if (event.target !== modal) return;
                schliesse(modal);
            });
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            const offen = [...document.querySelectorAll(".modal-overlay")]
                .filter(m => m.style.display && m.style.display !== "none");
            if (offen.length === 0) return;
            // Erledigt - die Spielerseite darunter bleibt offen
            if (schliesse(offen[offen.length - 1])) event.preventDefault();
        });
    }

    /**
     * Sichere Hilfsfunktion zur Formatierung von Geldbeträgen
     */
    formatMoneySafe(amount) {
        return UIManager.formatMoneySafe(amount);
    }

    /**
     * Formkürzel auf Deutsch: Sieg, Unentschieden, Niederlage. Gespeichert
     * wird weiter W/D/L - angezeigt wurde es bisher auch so, mitten in
     * einer Tabelle, deren Spalten S, U und N heißen.
     */
    /**
     * Geld kurz für enge Spalten: "112,5 Mio. €" statt "112.546.000 €",
     * das in der Kadertabelle auf zwei Zeilen umbrach.
     */
    geldKurz(betrag) {
        const zahl = Number(betrag) || 0;
        const abs = Math.abs(zahl);
        const vz = zahl < 0 ? "-" : "";
        // Ab einer Milliarde: "1,09 Mrd. €" statt "1090 Mio. €", das in den Kacheln abgeschnitten wurde
        if (abs >= 1e9) return `${vz}${(abs / 1e9).toFixed(2).replace(".", ",")} Mrd. €`;
        if (abs >= 1e6) return `${vz}${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1).replace(".", ",")} Mio. €`;
        if (abs >= 1e3) return `${vz}${Math.round(abs / 1e3)} Tsd. €`;
        return `${vz}${Math.round(abs)} €`;
    }

    /** Die Flagge eines Landes aus den Länderdaten - auch für die Länder im Hintergrund */
    flaggeVon(countryId) {
        const laender = (typeof COUNTRIES_DATA !== "undefined" && Array.isArray(COUNTRIES_DATA)) ? COUNTRIES_DATA : [];
        return laender.find(l => l.id === countryId)?.flag || "🌍";
    }

    /** Liegt eine Liga in einem Land im Hintergrund? */
    istHintergrundLiga(liga) {
        return !!(liga && liga.hintergrund);
    }

    /** Farbe für einen Fitnesswert: grün, gelb, rot */
    fitnessFarbe(wert) {
        const f = Number(wert) || 0;
        return f >= 85 ? "#22c55e" : (f >= 70 ? "#f59e0b" : "#ef4444");
    }

    /** Woran die Sterne gemessen werden (Einstellungen) */
    static get STERN_MASSSTAEBE() {
        return {
            kader: {
                titel: "Am eigenen Kader", kurz: "Kaderschnitt",
                text: "Drei Sterne sind der Schnitt Ihres Kaders. So sieht man sofort, wer bei Ihnen Stammspieler ist - in der Landesliga wie bei einem Spitzenklub.",
                hinweisVerein: "Sterne gemessen am Kader dieses Vereins - so wie nach der Übernahme."
            },
            liga: {
                titel: "An der eigenen Liga", kurz: "Ligaschnitt",
                text: "Drei Sterne sind der Schnitt Ihrer Liga. Ein Spitzenklub hat mehr Vier- und Fünf-Sterne-Spieler, ein Abstiegskandidat weniger.",
                hinweisVerein: "Sterne gemessen am Schnitt der Liga dieses Vereins."
            },
            welt: {
                titel: "Weltweit", kurz: "Erstligaprofi",
                text: "Drei Sterne sind ein solider Erstligaprofi. Ein Star einer großen ersten Liga hat fünf, ein Landesligaspieler einen halben.",
                hinweisVerein: "Sterne nach Weltmaßstab: drei Sterne sind ein solider Erstligaprofi."
            }
        };
    }

    /** Stimmen aus der Kurve (FanEngine) unter der Fanstimmung */
    renderFanStimmen(state) {
        const el = document.getElementById("dashFanStimmen");
        const fans = typeof FanEngine !== "undefined" ? FanEngine : null;
        if (!el || !fans) return;
        const stimmen = fans.stimmen(state, 3);
        el.hidden = !stimmen.length;
        if (!stimmen.length) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        el.innerHTML = `<div class="fan-stimmen-kopf">Aus der Kurve</div>` + stimmen.map(s => `
            <div class="fan-stimme fan-${esc(s.ton)}">
                <span class="fan-autor">@${esc(s.autor)}</span>
                <span class="fan-text">${esc(s.text)}</span>
                <span class="fan-likes" aria-label="${s.likes} Zustimmungen">♥ ${s.likes}</span>
            </div>`).join("");
    }

    /** Weltmaßstab: drei Sterne bei einer Stärke von 70 */
    static get STERN_WELT_BEZUG() { return 140; }

    /** Name eines Wettbewerbs - erfunden oder aus der Namensdatei */
    static wettbewerbName(id) {
        const namen = (typeof window !== "undefined" && window.NamenEngine)
            || (typeof require !== "undefined" ? require("../engine/namenEngine.js").NamenEngine : null);
        return namen ? namen.wettbewerb(id) : id;
    }

    /** Beschriftung der Tabellenzonen (Europapokal, Auf- und Abstieg). */
    static get ZONEN() {
        return {
            ucl: UIManager.wettbewerbName("ucl"),
            uel: UIManager.wettbewerbName("uel"),
            uecl: UIManager.wettbewerbName("uecl"),
            auf: "Aufstieg",
            po: "Aufstiegsspiele",
            rel: "Relegation",
            ab: "Abstieg"
        };
    }

    /** Tordifferenz mit Vorzeichen: +5, 0, -3. */
    vorzeichen(zahl) {
        const n = Number(zahl) || 0;
        return n > 0 ? `+${n}` : String(n);
    }

    static formKuerzel(f) {
        const k = String(f || "").toUpperCase();
        return { W: "S", D: "U", L: "N" }[k] || k;
    }

    formPunkt(f) {
        const k = String(f || "").toLowerCase();
        const titel = { w: "Sieg", d: "Unentschieden", l: "Niederlage" }[k] || "";
        // Noch nicht gespielt: ein leerer Platz statt eines Bindestrichs
        if (!titel) return `<span class="form-dot leer" title="Noch kein Spiel"></span>`;
        return `<span class="form-dot ${k}" title="${titel}">${UIManager.formKuerzel(f)}</span>`;
    }

    static formatMoneySafe(amount) {
        if (typeof GameState !== 'undefined' && typeof GameState.formatMoney === 'function') {
            return GameState.formatMoney(amount);
        }
        if (typeof Formatters !== 'undefined' && typeof Formatters.formatMoney === 'function') {
            return Formatters.formatMoney(amount, true);
        }
        if (amount === null || amount === undefined || isNaN(amount)) return "0 €";
        if (amount >= 1000000) {
            return (amount / 1000000).toFixed(2).replace(".", ",") + " Mio. €";
        }
        if (amount >= 1000) {
            return (amount / 1000).toFixed(0) + " Tsd. €";
        }
        return amount + " €";
    }

    /**
     * Sichere Hilfsfunktion für Vorstandserwartungstexte
     */
    getExpectationTextSafe(exp) {
        return UIManager.getExpectationTextSafe(exp);
    }

    static getExpectationTextSafe(exp) {
        if (typeof GameState !== 'undefined' && typeof GameState.getExpectationText === 'function') {
            return GameState.getExpectationText(exp);
        }
        if (typeof Formatters !== 'undefined' && typeof Formatters.formatExpectation === 'function') {
            return Formatters.formatExpectation(exp);
        }
        switch(exp) {
            case "championship": return "Gewinn der Meisterschaft";
            case "top3": return "Qualifikation für die Top 3";
            case "top6": return "Internationales Geschäft (Top 6)";
            case "midfield": return "Gesichertes oberes Tabellenmittelfeld";
            case "avoid_relegation": return "Klassenerhalt";
            default: return "Erfolgreiche Saison";
        }
    }

    /**
     * Ladeanzeige für alles, was spürbar dauert: Karrierestart (die ganze
     * Spielwelt entsteht), Spielstand laden, Saisonwechsel. Vorher stand die
     * Oberfläche dabei ein bis drei Sekunden still, ohne Rückmeldung.
     *
     * Im Browser zeichnet sie erst die Anzeige (ein Bildaufbau), dann läuft
     * die Arbeit. Ohne Browser (Tests) läuft die Arbeit sofort und das
     * Ergebnis kommt direkt zurück.
     */
    mitLadeanzeige(text, arbeit, unter = "") {
        const overlay = typeof document !== "undefined" && typeof document.getElementById === "function"
            ? document.getElementById("ladeOverlay") : null;
        const raf = typeof window !== "undefined" && typeof window.requestAnimationFrame === "function"
            ? window.requestAnimationFrame.bind(window) : null;
        if (!overlay || !raf || this._ladeAnzeigeLaeuft) return arbeit();
        this._ladeAnzeigeLaeuft = true;
        this.zeigeLadeanzeige(text, unter);
        const fertig = () => { this._ladeAnzeigeLaeuft = false; this.versteckeLadeanzeige(); };
        return new Promise((resolve, reject) => {
            raf(() => setTimeout(() => {
                try { resolve(arbeit()); } catch (e) { reject(e); }
            }, 0));
        }).then(r => { fertig(); return r; }, e => { fertig(); throw e; });
    }

    zeigeLadeanzeige(text, unter = "") {
        const overlay = typeof document !== "undefined" ? document.getElementById("ladeOverlay") : null;
        if (!overlay) return;
        const t = document.getElementById("ladeText");
        const u = document.getElementById("ladeUnter");
        if (t) t.textContent = text || "Einen Moment …";
        if (u) u.textContent = unter || "";
        overlay.hidden = false;
    }

    versteckeLadeanzeige() {
        const overlay = typeof document !== "undefined" ? document.getElementById("ladeOverlay") : null;
        if (overlay) overlay.hidden = true;
    }

    /**
     * Reines Filtern und Sortieren von Vereinen für die Wizard-Auswahl
     */
    static getFilteredWizardClubs(teams, { search = "", difficulty = "all", sort = "strength_desc", league = "all" } = {}) {
        if (!Array.isArray(teams)) return [];
        let filtered = [...teams];

        const searchVal = (search || "").toLowerCase().trim();
        if (searchVal) {
            filtered = filtered.filter(club => {
                const name = (club.name || "").toLowerCase();
                const city = (club.city || "").toLowerCase();
                const stadium = (club.stadium || "").toLowerCase();
                const leagueName = (club.leagueName || "").toLowerCase();
                return name.includes(searchVal) || city.includes(searchVal)
                    || stadium.includes(searchVal) || leagueName.includes(searchVal);
            });
        }

        if (league && league !== "all") {
            filtered = filtered.filter(club => club.leagueId === league);
        }

        const diffVal = difficulty || "all";
        if (diffVal === "easy") {
            filtered = filtered.filter(club => club.boardExpectation === "championship");
        } else if (diffVal === "medium") {
            filtered = filtered.filter(club => club.boardExpectation === "top3");
        } else if (diffVal === "hard") {
            filtered = filtered.filter(club =>
                club.boardExpectation === "midfield" ||
                club.boardExpectation === "avoid_relegation"
            );
        }

        const sortVal = sort || "strength_desc";
        const averageOverall = (club) => {
            if (typeof club.avgOverall === "number") return club.avgOverall;
            const squad = Array.isArray(club.players) ? club.players : [];
            return squad.length
                ? Math.round(squad.reduce((sum, p) => sum + (p.overall || 0), 0) / squad.length)
                : 0;
        };

        filtered.sort((a, b) => {
            const ovrA = averageOverall(a);
            const ovrB = averageOverall(b);

            if (sortVal === "strength_desc") return ovrB - ovrA;
            if (sortVal === "strength_asc") return ovrA - ovrB;
            if (sortVal === "budget_desc") return (b.transferBudget || 0) - (a.transferBudget || 0);
            if (sortVal === "name_asc") return (a.name || "").localeCompare(b.name || "");
            return 0;
        });

        return filtered;
    }

    /**
     * Validiert die Startelf vor Anpfiff
     */
    validateLineupForMatch() {
        if (!this.app.state || !this.app.state.userClubId) {
            this.showToast("Kein aktiver Verein ausgewählt.", "error");
            return { valid: false, message: "Bitte wählen Sie zuerst einen Verein aus." };
        }

        const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
        if (!userClub) return { valid: false, message: "Verein nicht gefunden." };

        if (!userClub.lineup || userClub.lineup.length !== 11) {
            return { valid: false, message: "Ihre Startelf muss aus genau 11 Spielern bestehen. Bitte passen Sie die Aufstellung an." };
        }

        // Spieler prüfen
        const lineupPlayers = userClub.lineup.map(id => this.app.state.players.find(p => p.id === id)).filter(Boolean);
        if (lineupPlayers.length !== 11) {
            return { valid: false, message: "Einige Spieler der Startelf sind nicht verfügbar." };
        }

        // Torwart-Prüfung (genau 1 Torwart auf Position TW)
        const goalkeepers = lineupPlayers.filter(p => p.pos === "TW");
        if (goalkeepers.length === 0) {
            return { valid: false, message: "Sie haben keinen Torwart in der Startelf aufgestellt." };
        }

        // Verletzte oder gesperrte Spieler - nach denselben Zählern, mit denen
        // "Beste 11" und die Spiel-Engine rechnen. Vorher galten hier die
        // Felder injured und suspended: Das eine blieb nach der Heilung
        // stehen, das andere setzte niemand.
        const injured = lineupPlayers.filter(p => (p.injuredWeeks || 0) > 0);
        if (injured.length > 0) {
            return { valid: false, ausfall: true, message: `Folgende Spieler in der Startelf sind verletzt: ${injured.map(p => p.name).join(", ")}. Bitte wechseln Sie diese aus.` };
        }

        const suspended = lineupPlayers.filter(p => (p.suspendedMatches || 0) > 0);
        if (suspended.length > 0) {
            return { valid: false, ausfall: true, message: `Folgende Spieler in der Startelf sind gesperrt: ${suspended.map(p => p.name).join(", ")}. Bitte wechseln Sie diese aus.` };
        }

        // Meldeliste: Im Europapokal und in Ligen mit Kaderregeln spielt nur,
        // wer gemeldet ist. Nicht Gemeldete auf der Bank fliegen still raus.
        const regeln = typeof KaderregelEngine !== "undefined" ? KaderregelEngine : null;
        const heute = this.heutigesSpiel?.();
        if (regeln && heute && heute.partie) {
            const art = regeln.artVon(this.app.state, userClub, heute.partie);
            const fehlt = regeln.nichtGemeldet(this.app.state, userClub, art, userClub.lineup);
            if (fehlt.length) {
                const namen = fehlt.map(id => lineupPlayers.find(p => p.id === id)?.name).filter(Boolean);
                return { valid: false, message: `Nicht für ${regeln.regel(userClub, art)?.name || "diesen Wettbewerb"} gemeldet: ${namen.join(", ")}. Bitte wechseln Sie sie aus oder melden Sie nach (Kader → Meldeliste).` };
            }
            userClub.bench = (userClub.bench || []).filter(id => regeln.gemeldet(this.app.state, userClub, art, id));
        }

        return { valid: true };
    }

    /**
     * Der Klang des Spiels (js/ui/klang.js): ein AudioContext für alles,
     * erzeugt beim ersten Ton. Die Effekte schaltet "Sound", die
     * Menümusik "Musik" - beides eine Vorliebe des Geräts.
     */
    klang() {
        if (this._klang) return this._klang;
        try {
            const AudioContextClass = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
            const KlangKlasse = typeof Klang !== "undefined" ? Klang : (typeof window !== "undefined" ? window.Klang : null);
            if (typeof AudioContextClass !== "function" || !KlangKlasse) return null;
            this.audioCtx = new AudioContextClass();
            this._klang = new KlangKlasse(this.audioCtx, { seed: Date.now() % 1e9, musikLautstaerke: this.musikLautstaerke ?? 0.6 });
        } catch (e) {
            console.warn("Audio nicht verfügbar:", e);
            this._klang = null;
        }
        return this._klang;
    }

    /** Spielt einen Klang (Pfiff, Jubel, Menüton ...) - siehe Klang.spiele */
    playSound(type) {
        if (!this.soundEnabled) return;
        const k = this.klang();
        if (!k) return;
        try {
            if (k.ctx.state === "suspended") k.ctx.resume();
            k.spiele(type);
        } catch (e) {
            console.warn("Klang nicht verfügbar:", e);
        }
    }

    /**
     * Die Menümusik läuft, wenn sie eingeschaltet ist und gerade kein
     * Livespiel läuft - dort spielt die Kulisse. Browser lassen Ton erst
     * nach dem ersten Tippen zu; bis dahin wartet sie.
     */
    pruefeMusik() {
        const soll = this.musikAn && this._tonFrei && !this._imLivespiel && !(typeof document !== "undefined" && document.hidden);
        const k = soll || this._klang ? this.klang() : null;
        if (!k) return;
        try {
            if (soll) {
                if (k.ctx.state === "suspended") k.ctx.resume();
                if (!k.musikLaeuft) k.starteMusik();
            } else if (k.musikLaeuft) {
                k.stoppeMusik(this._imLivespiel ? 1.5 : 0.8);
            }
        } catch (e) {
            console.warn("Musik nicht verfügbar:", e);
        }
    }

    /** Livespiel beginnt oder endet: Musik aus, Kulisse an - und umgekehrt */
    setzeLivespielTon(laeuft) {
        this._imLivespiel = !!laeuft;
        this.pruefeMusik();
    }

    musikKnopfHtml() {
        return this.musikAn
            ? `<svg class="ico" aria-hidden="true"><use href="#i-volume"/></svg><span>Musik: An</span>`
            : `<svg class="ico" aria-hidden="true"><use href="#i-volume-off"/></svg><span>Musik: Aus</span>`;
    }

    /** Ton freigeben: beim ersten Tippen, dazu Pause, wenn die Seite verborgen ist */
    richteTonEin() {
        if (typeof document === "undefined" || this._tonEingerichtet) return;
        this._tonEingerichtet = true;
        const frei = () => {
            if (this._tonFrei) return;
            this._tonFrei = true;
            const k = this._klang;
            if (k && k.ctx.state === "suspended") k.ctx.resume();
            this.pruefeMusik();
        };
        ["pointerdown", "keydown", "touchend"].forEach(art => document.addEventListener(art, frei, { once: false, passive: true }));
        document.addEventListener("visibilitychange", () => {
            const k = this._klang;
            if (!k) return;
            try {
                if (document.hidden) k.ctx.suspend();
                else if (this._tonFrei) { k.ctx.resume(); this.pruefeMusik(); }
            } catch (e) { /* ohne suspend/resume läuft es weiter */ }
        });
    }

    /**
     * Bindet Navigations-Klicks (Desktop & Mobile)
     */
    bindNavigation() {
        // Desktop Sidebar Items
        document.querySelectorAll(".nav-item").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.dataset.tab;
                this.switchTab(targetTab);
                this.playSound("click");
            });
        });

        // Mobile Bottom Nav Items
        document.querySelectorAll(".mobile-nav-item[data-tab]").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.dataset.tab;
                this.switchTab(targetTab);
                this.playSound("click");
            });
        });

        // Mobile Drawer Items ("Mehr")
        document.querySelectorAll(".mobile-drawer-item[data-tab]").forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.dataset.tab;
                this.closeMobileDrawer();
                this.switchTab(targetTab);
                this.playSound("click");
            });
        });

        // Mobile "Mehr" Button & Close
        document.getElementById("btnMobileNavMore")?.addEventListener("click", () => {
            this.toggleMobileDrawer();
            this.playSound("click");
        });

        document.getElementById("btnCloseMobileDrawer")?.addEventListener("click", () => {
            this.closeMobileDrawer();
        });

        document.getElementById("mobileDrawerOverlay")?.addEventListener("click", (e) => {
            if (e.target.id === "mobileDrawerOverlay") {
                this.closeMobileDrawer();
            }
        });

        // Responsive Window Resize für Canvas etc.
        window.addEventListener("resize", () => {
            this.resizeLiveCanvas();
        });
    }

    toggleMobileDrawer() {
        const overlay = document.getElementById("mobileDrawerOverlay");
        if (overlay) {
            overlay.style.display = overlay.style.display === "none" ? "flex" : "none";
        }
    }

    closeMobileDrawer() {
        const overlay = document.getElementById("mobileDrawerOverlay");
        if (overlay) overlay.style.display = "none";
    }

    /**
     * Tab wechseln
     */
    switchTab(tabId) {
        // Beim Verlassen des Taktik-Tabs den Formations-Editor sauber schließen
        if (this.activeTab === "tactics" && tabId !== "tactics" && this.formationEditMode) {
            this.formationEditMode = false;
            this.formationDraft = null;
            this.formationDirty = false;
            this.selectedPitchSlot = null;
            document.getElementById("tacticsPitch")?.classList.remove("editing");
            const bar = document.getElementById("formationEditorBar");
            if (bar) bar.style.display = "none";
        }

        // Ein Reiter löst eine offene Seite ab (Profil, Angebot)
        if (typeof this.schliesseSeite === "function") this.schliesseSeite();
        this.activeTab = tabId;
        // Erste Schritte: Wer einen Bereich besucht hat, hat den Schritt getan
        this.einstiegMerkeTab(tabId);
        document.querySelectorAll(".nav-item").forEach(b => {
            b.classList.toggle("active", b.dataset.tab === tabId);
        });
        document.querySelectorAll(".mobile-nav-item").forEach(b => {
            b.classList.toggle("active", b.dataset.tab === tabId);
        });
        document.querySelectorAll(".mobile-drawer-item").forEach(b => {
            b.classList.toggle("active", b.dataset.tab === tabId);
        });
        document.querySelectorAll(".tab-pane").forEach(pane => {
            pane.classList.toggle("active", pane.id === `pane-${tabId}`);
        });

        // Tab-spezifische Renderings anstoßen
        this.renderCurrentTab();
        if (typeof this.merkeVerlauf === "function") this.merkeVerlauf();
    }

    renderCurrentTab() {
        if (!this.app.state) return;
        this.renderHeader();

        switch (this.activeTab) {
            case "dashboard":
                this.renderDashboard();
                break;
            case "club":
                this.renderClub();
                break;
            case "squad":
                this.renderSquad();
                break;
            case "tactics":
                this.renderTactics();
                break;
            case "fixtures":
                this.renderFixturesAndStandings();
                break;
            case "transfers":
                this.renderTransfers();
                break;
            case "preseason":
                this.renderPreseason();
                break;
            case "training":
                this.renderTraining();
                break;
            case "youth":
                this.renderJugend();
                break;
            case "finances":
                this.renderFinances();
                break;
            case "stats":
                this.renderStats();
                break;
            case "calendar":
                this.renderCalendar();
                break;
            case "inbox":
                this.renderInbox();
                break;
            case "national":
                this.renderNational();
                break;
            case "settings":
                this.renderSettings();
                break;
        }
        // Unterreiter ohne Inhalt (etwa Preise vor dem ersten Saisonende) blenden aus
        if (typeof this.pruefeUnterreiter === "function") this.pruefeUnterreiter(`pane-${this.activeTab}`);
        // Liegt eine Seite darüber (nach Weiter oder einer Aktion), zeigt sie den neuen Stand
        if (typeof this.aktualisiereSeite === "function") this.aktualisiereSeite();
        // Beim ersten Besuch erklärt sich der Bereich selbst
        this.zeigeEinstiegErklaerung(this.activeTab);
    }

    /**
     * Einstellungen: Livespiel-Vorgaben, die bisher nur mitten in einer
     * Partie im Co-Trainer-Reiter zu finden waren.
     */
    renderSettings() {
        this.renderEinstiegEinstellungen();
        this.renderNamenEinstellungen();
        const el = document.getElementById("settingsLiveBody");
        if (!el || !this.app.state) return;
        const e = this.liveEinstellungen();
        const schalter = (gruppe, key, titel, text) => {
            const an = gruppe === "delegation" ? e.delegation[key] : e.autoOeffnen[key];
            return `<label class="coach-switch einstellung-schalter">
                    <input type="checkbox" data-gruppe="${gruppe}" data-key="${key}" ${an ? "checked" : ""}>
                    <span class="coach-switch-text"><strong>${titel}</strong><br><span class="coach-muted">${text}</span></span>
                </label>`;
        };
        const wahl = (name, aktuell, optionen) => optionen.map(([wert, titel, text]) => `
                <label class="coach-switch einstellung-schalter">
                    <input type="radio" name="${name}" value="${wert}" ${String(wert) === String(aktuell) ? "checked" : ""}>
                    <span class="coach-switch-text"><strong>${titel}</strong><br><span class="coach-muted">${text}</span></span>
                </label>`).join("");
        el.innerHTML = `
            <h4 class="einstellung-h">Was gezeigt wird</h4>
            ${wahl("liveAnsicht", e.ansicht, [
                ["schluessel", "Schlüsselszenen", "Nur Szenen mit Torgefahr, Standards vor dem Tor, Tore und Karten - das kürzeste Spiel."],
                ["hoehepunkte", "Höhepunkte", "Angriffe, Standards vor dem Tor, Tore und Karten. Ruhige Phasen laufen ohne Bild durch - das Spiel ist dasselbe."],
                ["ganz", "Ganzes Spiel", "Alle 90 Minuten."]
            ])}
            <h4 class="einstellung-h">Tempo zum Anpfiff</h4>
            ${wahl("liveTempo", e.tempo, [
                [1, "Langsam", "Echtes Abspieltempo."],
                [2, "Normal", "Knapp dreifach."],
                [4, "Schnell", "Gut sechsfach."]
            ])}
            <h4 class="einstellung-h">Dem Co-Trainer überlassen</h4>
            ${schalter("delegation", "wechsel", "Wechsel", "Er wechselt Müde und Verletzte positionsgerecht aus.")}
            ${schalter("delegation", "taktik", "Taktik anpassen", "Bei Rückstand offensiver, bei später Führung sicherer.")}
            <h4 class="einstellung-h">Seitenlinie automatisch öffnen</h4>
            ${schalter("auto", "halbzeit", "Zur Halbzeit", "Nach der Kabinenansprache.")}
            ${schalter("auto", "verletzung", "Bei einer Verletzung", "Wenn einer Ihrer Spieler nicht weiterkann.")}
            ${schalter("auto", "platzverweis", "Bei einem Platzverweis", "Um die Mannschaft neu zu ordnen.")}
        `;
        const sterne = document.getElementById("settingsSterne");
        if (sterne) {
            const aktuell = this.sternMassstab();
            sterne.innerHTML = Object.entries(UIManager.STERN_MASSSTAEBE).map(([key, m]) => `
                <label class="coach-switch einstellung-schalter">
                    <input type="radio" name="sternMassstab" value="${key}" ${key === aktuell ? "checked" : ""}>
                    <span class="coach-switch-text"><strong>${m.titel}</strong><br><span class="coach-muted">${m.text}</span></span>
                </label>`).join("");
            sterne.querySelectorAll("input[name=sternMassstab]").forEach(inp => inp.onchange = () => {
                this.setzeSternMassstab(inp.value);
                this.showToast(`Sterne: ${UIManager.STERN_MASSSTAEBE[inp.value].titel}`, "success");
            });
        }
        el.querySelectorAll("input[name=liveAnsicht], input[name=liveTempo]").forEach(inp => inp.onchange = () => {
            if (inp.name === "liveAnsicht") e.ansicht = inp.value;
            else e.tempo = Number(inp.value);
            if (typeof this.app.state.saveToLocalStorage === "function") this.app.state.saveToLocalStorage();
        });
        el.querySelectorAll("input[data-gruppe]").forEach(inp => inp.onchange = () => {
            const ziel = inp.dataset.gruppe === "delegation" ? e.delegation : e.autoOeffnen;
            ziel[inp.dataset.key] = inp.checked;
            if (typeof this.app.state.saveToLocalStorage === "function") this.app.state.saveToLocalStorage();
        });
        const sound = document.getElementById("btnToggleSound");
        if (sound) sound.innerHTML = this.soundKnopfHtml();
        this.renderSpeicherInfo();
    }

    /**
     * Der Schreibtisch des Managers: Was braucht heute eine Entscheidung?
     * Ein Klick springt direkt in den zuständigen Reiter.
     */
    renderAttentionList() {
        const state = this.app.state;
        const engine = this.getManagerEngine();
        const list = document.getElementById("dashAttentionList");
        const count = document.getElementById("dashAttentionCount");
        if (!list) return;

        const items = engine ? engine.getAttentionItems(state) : [];
        if (count) count.textContent = String(items.length);

        if (items.length === 0) {
            list.innerHTML = `<div class="attention-empty">Alles erledigt. Der Kader ist fit, die Post gelesen.</div>`;
            return;
        }

        const knopf = item => `
            <button class="attention-item" data-tab="${this.escapeHtml(item.tab)}"${item.playerId !== undefined ? ` data-player="${this.escapeHtml(String(item.playerId))}"` : ""}${item.negId ? ` data-neg="${this.escapeHtml(String(item.negId))}"` : ""}${item.offerId !== undefined ? ` data-angebot="${this.escapeHtml(String(item.offerId))}"` : ""}${item.unterreiter ? ` data-sub="${this.escapeHtml(item.unterreiter)}"` : ""}>
                <span class="attention-icon ton-${({ "🚑": "bad", "⚠️": "bad", "🩺": "bad", "📢": "bad", "🥵": "warn", "😞": "warn", "💰": "warn", "💬": "warn", "🎓": "warn", "⭐": "ok", "🤝": "ok" })[item.icon] || "info"}">${this.symbolHtml(item.icon)}</span>
                <span class="attention-text">
                    <strong>${this.escapeHtml(item.title)}</strong>
                    <span>${this.escapeHtml(item.detail)}</span>
                </span>
                <span class="attention-arrow"><svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span>
            </button>`;
        // Betrifft ein Punkt mehrere Spieler, steht jeder einzeln darunter -
        // ein Tipp auf den Namen öffnet seine Akte an der richtigen Stelle
        const namen = item => (item.spieler || []).length ? `
            <div class="attention-namen">
                ${item.spieler.map(sp => `<button class="attention-name" data-player="${this.escapeHtml(String(sp.id))}"${item.abschnitt ? ` data-abschnitt="${this.escapeHtml(item.abschnitt)}"` : ""}>${this.escapeHtml(sp.name)}${sp.pos ? ` <small>${this.escapeHtml(sp.pos)}</small>` : ""}</button>`).join("")}
            </div>` : "";
        list.innerHTML = items.map(item => (item.spieler || []).length
            ? `<div class="attention-gruppe">${knopf(item)}${namen(item)}</div>`
            : knopf(item)).join("");

        list.querySelectorAll(".attention-item").forEach(btn => {
            btn.addEventListener("click", () => {
                // Eine Verhandlung führt direkt zu ihrer Karte, ein Angebot auf seine Seite
                if (btn.dataset.neg) return this.zeigeVerhandlung(btn.dataset.neg);
                if (btn.dataset.angebot !== undefined && typeof this.zeigeAngebotSeite === "function") return this.zeigeAngebotSeite(btn.dataset.angebot);
                // Ein Gespräch führt direkt in die Akte des Spielers
                if (btn.dataset.player !== undefined) {
                    const ziel = state.players.find(p => String(p.id) === btn.dataset.player);
                    if (ziel) return this.showPlayerDetailsModal(ziel.id);
                }
                this.switchTab(btn.dataset.tab);
                // Leihangebote stehen im Unterreiter Leihen
                if (btn.dataset.sub === "leihen") document.getElementById("btnSubTransfersLoans")?.click();
                else if (btn.dataset.sub && typeof this.zeigeUnterreiter === "function") this.zeigeUnterreiter(`pane-${btn.dataset.tab}`, btn.dataset.sub);
            });
        });
        list.querySelectorAll(".attention-name").forEach(btn => {
            btn.addEventListener("click", () => {
                const ziel = state.players.find(p => String(p.id) === btn.dataset.player);
                // Ein Talent der Akademie steht nicht in der Spielerliste - die Akte findet es trotzdem
                this.showPlayerDetailsModal(ziel ? ziel.id : btn.dataset.player, { abschnitt: btn.dataset.abschnitt });
            });
        });
    }

    /**
     * Pressekonferenz am Medientag.
     *
     * Zwei bis drei Fragen, je nach Lage: Vor dem Derby fragt der Boulevard
     * nach einer Kampfansage, nach drei Niederlagen nach dem Job, bei einem
     * Angebot nach dem Spieler. Jede Antwort verschiebt Fanstimmung,
     * Medienrummel, Vorstandsvertrauen und Moral - und manche haben Folgen:
     * Eine Kampfansage liest auch der Gegner, ein Versprechen wird nach dem
     * Spiel abgerechnet, eine Schlagzeile steht am nächsten Tag im Postfach.
     */
    showPressConferenceModal(vorgabe = null, onDone = null) {
        const state = this.app.state;
        const engine = this.getManagerEngine();
        const modal = document.getElementById("modalPressConference");
        const body = document.getElementById("pressConferenceContent");
        if (!engine || !modal || !body) return;

        // Nach dem Spiel kommt die Konferenz fertig aus dem Spielbericht
        const pk = vorgabe || engine.buildPressConference(state);
        if (!pk) return;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const fragen = Array.isArray(pk.fragen) && pk.fragen.length
            ? pk.fragen
            : [{ topicId: pk.topicId, question: pk.question, answers: pk.answers, medium: null, journalist: null }];
        const summe = { fanMood: 0, mediaPressure: 0, boardConfidence: 0, squadMorale: 0 };
        let index = 0;

        const titel = document.getElementById("pcModalTitle");
        if (titel) titel.textContent = pk.nachSpiel
            ? `Nach dem Spiel: ${pk.context.ergebnis} gegen ${pk.context.opponentName}`
            : (pk.context?.opponentId
                ? `Pressekonferenz vor dem Spiel gegen ${pk.context.opponentName}`
                : "Pressekonferenz");

        // Mehr Medienrummel ist schlecht, alles andere gut
        const zeile = (label, wert, umgekehrt = false) => {
            if (!wert) return "";
            const gut = umgekehrt ? wert < 0 : wert > 0;
            return `<span>${label}: <strong style="color:${gut ? "#34d399" : "#f87171"};">${wert > 0 ? "+" : ""}${wert}</strong></span>`;
        };
        const effekte = (e) => `
            <div class="press-effects">
                ${zeile("Fanstimmung", e.fanMood)}
                ${zeile("Medienrummel", e.mediaPressure, true)}
                ${zeile("Vorstand", e.boardConfidence)}
                ${zeile("Teammoral", e.squadMorale)}
            </div>`;

        const zeigeFrage = () => {
            const f = fragen[index];
            const letzte = index === fragen.length - 1;
            body.innerHTML = `
                <div class="press-kopf">
                    ${f.medium ? `<div class="press-journalist">
                        <span class="press-medium-icon">${f.medium.icon}</span>
                        <span><strong>${esc(f.journalist)}</strong><small>${esc(f.medium.name)} · ${esc(f.medium.art)}</small></span>
                    </div>` : "<span></span>"}
                    <span class="press-fortschritt">Frage ${index + 1} von ${fragen.length}</span>
                </div>
                <p class="press-question">„${esc(f.question)}“</p>
                <div class="press-answers">
                    ${f.answers.map(a => `
                        <button class="press-answer" data-answer="${esc(a.key)}">${esc(a.label)}</button>
                    `).join("")}
                </div>
                <div id="pressResult"></div>
            `;

            body.querySelectorAll(".press-answer").forEach(btn => {
                btn.addEventListener("click", () => {
                    const res = engine.answerPressConference(state, f.topicId, btn.dataset.answer, { frage: f, kontext: pk.context });
                    if (!res.success) return;
                    Object.keys(summe).forEach(k => { summe[k] += res.effects[k] || 0; });

                    const folgen = [];
                    if (res.affectedPlayer) folgen.push(`${esc(res.affectedPlayer.name)}: ${res.affectedPlayer.delta > 0 ? "+" : ""}${res.affectedPlayer.delta} Moral`);
                    if (res.gegnerMotiviert) folgen.push(`🔥 ${esc(res.gegnerMotiviert.name)} fühlt sich herausgefordert (Moral +${res.gegnerMotiviert.delta})`);
                    if (res.versprechen) folgen.push(`🤝 Versprochen: ${res.versprechen.art === "sieg" ? "ein Sieg" : "keine Niederlage"} gegen ${esc(res.versprechen.gegnerName)} - nach dem Spiel wird abgerechnet`);
                    if (res.schlagzeile) folgen.push(`📰 Morgen in der Zeitung: „${esc(res.schlagzeile)}“`);

                    btn.classList.add("gewaehlt");
                    document.getElementById("pressResult").innerHTML = `
                        <div class="press-result">
                            <strong>${esc(res.response)}</strong>
                            ${effekte(res.effects)}
                            ${folgen.map(t => `<div class="press-player">${t}</div>`).join("")}
                            ${letzte && fragen.length > 1 ? `<div class="press-bilanz"><span class="text-muted">Bilanz des Termins</span>${effekte(summe)}</div>` : ""}
                            <button class="btn btn-primary mt-2" id="btnPressDone">${letzte ? "Termin beenden" : "Nächste Frage ▶"}</button>
                        </div>
                    `;
                    body.querySelectorAll(".press-answer").forEach(b => { b.disabled = true; });
                    this.playSound("click");

                    document.getElementById("btnPressDone").onclick = () => {
                        if (!letzte) {
                            index++;
                            zeigeFrage();
                            return;
                        }
                        beenden();
                    };
                });
            });
        };

        // Termin beenden - auch über das Kreuz, das vorher keine Wirkung
        // hatte: Die übrigen Fragen bleiben dann unbeantwortet.
        let beendet = false;
        const beenden = () => {
            if (beendet) return;
            beendet = true;
            modal.style.display = "none";
            if (onDone) {
                onDone();
                return;
            }
            this.renderCurrentTab();
            this.renderHeader();
        };
        const kreuz = document.getElementById("btnClosePressConference");
        if (kreuz) kreuz.onclick = beenden;

        zeigeFrage();
        modal.style.display = "flex";
    }

    /**
     * Header & Sidebar Quick-Status rendern
     */
    renderHeader() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        // Der Vorbereitungsreiter erscheint nur, solange die Vorbereitung
        // laeuft - mit dem ersten Spieltag verschwindet er wieder. Die Zahl
        // daneben zeigt, was noch zu erledigen ist.
        const preNav = document.getElementById("navPreseason");
        const engine = this.getPreseasonEngine();
        const vorbereitungLaeuft = !!(state.preseason && state.preseason.aktiv);
        const vorbereitungOffen = (vorbereitungLaeuft && engine) ? engine.offenePunkte(state).length : 0;
        if (preNav) {
            preNav.style.display = vorbereitungLaeuft ? "" : "none";
            const badge = document.getElementById("navPreseaonBadgeFallback")
                || document.getElementById("navPreseasonBadge");
            if (badge) {
                badge.textContent = vorbereitungOffen;
                badge.style.display = vorbereitungOffen > 0 ? "" : "none";
            }
        }

        // Auf dem Handy fehlte die Vorbereitung im Menü ganz - man konnte sie
        // dort nicht gestalten. Jetzt steht sie oben im "Mehr"-Menü, solange
        // sie läuft, und der Punkt am "Mehr"-Knopf zeigt, dass etwas offen ist.
        const mobilPre = document.getElementById("mobileNavPreseason");
        if (mobilPre) mobilPre.style.display = vorbereitungLaeuft ? "" : "none";
        const mobilPreBadge = document.getElementById("mobilePreseasonBadge");
        if (mobilPreBadge) {
            mobilPreBadge.textContent = vorbereitungOffen;
            mobilPreBadge.style.display = vorbereitungOffen > 0 ? "" : "none";
        }

        document.getElementById("headerClubName").textContent = userClub.name;
        const punkt = document.getElementById("headerClubDot");
        punkt.style.backgroundColor = userClub.primaryColor;
        // Zweitfarbe als Ring - ein weißer Verein verschwand sonst im Kopf
        punkt.style.boxShadow = `inset 0 0 0 2px ${userClub.secondaryColor || "#ffffff"}`;
        document.getElementById("headerDifficulty").textContent = state.difficulty === "easy" ? "Leicht" : state.difficulty === "hard" ? "Schwer" : "Normal";
        document.getElementById("headerSeason").textContent = state.seasonYear;
        // In der Sommerpause zählt der Kopf die Tage bis zum Saisonwechsel
        const pauseRest = this.sommerpauseRest();
        const spieltagFeld = document.getElementById("headerMatchday");
        const spieltagLabel = spieltagFeld.previousElementSibling;
        if (spieltagLabel && spieltagLabel.classList?.contains("info-label")) {
            spieltagLabel.textContent = pauseRest !== null ? "Sommerpause" : "Spieltag";
        }
        spieltagFeld.textContent = pauseRest !== null
            ? `noch ${pauseRest} ${pauseRest === 1 ? "Tag" : "Tage"}`
            : `${state.currentMatchday} / ${state.totalMatchdays}`;
        document.getElementById("headerBalance").textContent = GameState.formatMoney(userClub.balance);
        document.getElementById("headerTransferBudget").textContent = `TB: ${GameState.formatMoney(userClub.transferBudget)}`;

        document.getElementById("headerConfidenceBar").style.width = `${state.boardConfidence}%`;
        document.getElementById("headerConfidenceVal").textContent = `${state.boardConfidence}%`;

        // Der eine Weiter-Knopf sagt, wohin er springt. Vorher gab es fünf
        // Knöpfe für drei Vorgänge, und der im Kopf ging einen anderen Weg als
        // die im Kalender: Er sprang über SeasonEngine direkt zum nächsten
        // Spieltag und übersprang damit Training, Presse und Vorbereitung.
        const ziel = this.beschreibeWeiter();
        const knopf = document.getElementById("btnHeaderAdvance");
        // Zwei Zeilen: oben wann, darunter wohin. Vorher brach "Weiter zum
        // Spiel bei Blau-Weiß Gelsen…" am breiten Bildschirm auf zwei Zeilen um.
        const ziel2 = this.weiterZiel(ziel.text);
        const wann = ziel.art === "sprung" && ziel.tage > 0 ? `Weiter · ${this.wannText(ziel.tage)}` : "Heute";
        knopf.title = ziel.text;
        knopf.innerHTML = `<span class="btn-advance-text"><small class="btn-advance-wann">${this.escapeHtml(wann)}</small><span class="btn-advance-ziel">${this.escapeHtml(ziel2)}</span></span> <span class="btn-arrow"><svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span>`;
        // Auf schmalen Geräten zeigt der Knopf nur die Kurzfassung
        // (Ohne dataset - etwa im Test-DOM - brach hier der ganze Kopf ab.)
        if (knopf.dataset) knopf.dataset.kurz = ziel.kurz || "Weiter";
        // Einzelne Tage wie im Vorbild: nur sinnvoll, wenn der Hauptknopf mehrere
        // Tage überspringen würde
        const tagKnopf = document.getElementById("btnHeaderTag");
        if (tagKnopf) tagKnopf.style.display = ziel.art === "sprung" && ziel.tage > 1 ? "" : "none";

        // Sidebar Quick-Status
        const getRankSafe = (clubId) => {
            if (typeof SeasonEngine !== 'undefined' && typeof SeasonEngine.getClubRank === 'function') {
                return SeasonEngine.getClubRank(state, clubId);
            }
            if (state.standings && Array.isArray(state.standings)) {
                const idx = state.standings.findIndex(s => s.clubId === clubId);
                return idx !== -1 ? idx + 1 : "-";
            }
            return "-";
        };

        document.getElementById("sbRank").textContent = getRankSafe(userClub.id);
        const formContainer = document.getElementById("sbForm");
        formContainer.innerHTML = (userClub.form || []).map(f => this.formPunkt(f)).join("");

        // Badges
        const unreadCount = state.inbox.filter(m => !m.read).length;
        const navInboxBadge = document.getElementById("navInboxBadge");
        if (unreadCount > 0) {
            navInboxBadge.style.display = "inline-block";
            navInboxBadge.textContent = unreadCount;
        } else {
            navInboxBadge.style.display = "none";
        }
        // Ein Verband wartet auf Antwort - am Handy auch im Menü
        const natAngebot = !!(state.nationalAngebot && state.nationalAngebot.saison === (state.seasonYear || 1) && !state.nationaltrainer);
        ["navNationalBadge", "mobileNationalBadge"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = natAngebot ? "inline-block" : "none";
        });

        // Die Handy-Gegenstücke waren nur Markup - niemand setzte sie.
        const mobileInboxBadge = document.getElementById("mobileInboxBadge");
        if (mobileInboxBadge) {
            mobileInboxBadge.textContent = unreadCount;
            mobileInboxBadge.style.display = unreadCount > 0 ? "inline-block" : "none";
        }
        // Ein Verein wirbt um ein Talent: Die Frist läuft, also ans Abzeichen
        const werben = typeof this.offeneJugendAnfragen === "function" ? this.offeneJugendAnfragen(state) : 0;
        ["navYouthBadge", "mobileYouthBadge"].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = werben;
            el.style.display = werben > 0 ? "inline-block" : "none";
        });
        const mehrPunkt = document.getElementById("mobileMoreBadgeDot");
        if (mehrPunkt) {
            const preOffen = (state.preseason && state.preseason.aktiv && this.getPreseasonEngine())
                ? this.getPreseasonEngine().offenePunkte(state).length : 0;
            const angeboteOffen = (state.transferMarket?.offers || []).filter(o => o.status === "pending").length;
            mehrPunkt.style.display = (unreadCount > 0 || preOffen > 0 || angeboteOffen > 0 || natAngebot || werben > 0) ? "" : "none";
        }

        const pendingOffers = state.transferMarket.offers.filter(o => o.status === "pending").length;
        const navOffersBadge = document.getElementById("navOffersBadge");
        if (pendingOffers > 0) {
            navOffersBadge.style.display = "inline-block";
            navOffersBadge.textContent = pendingOffers;
        } else {
            navOffersBadge.style.display = "none";
        }
        const mobileOffersBadge = document.getElementById("mobileOffersBadge");
        if (mobileOffersBadge) {
            mobileOffersBadge.textContent = pendingOffers;
            mobileOffersBadge.style.display = pendingOffers > 0 ? "inline-block" : "none";
        }
    }

    /**
     * Dashboard rendern
     */
    /**
     * Die Karte "Als Nächstes" - nach dem Vorbild.
     *
     * Vorher hiess sie "Nächste Begegnung" und zeigte immer die Partie des
     * laufenden Spieltags, ganz gleich wie weit sie noch weg war. Am ersten
     * Vorbereitungstag stand dort der erste Spieltag, dreissig Tage im Voraus,
     * mit einem einsatzbereiten Knopf "2D-Live-Spiel starten" darunter - und
     * der spielte ihn dann auch wirklich.
     *
     * Jetzt zeigt die Karte den naechsten Termin, den es wirklich gibt -
     * Testspiel, Pokalabend oder Pflichtspiel -, sagt, wie viele Tage es noch
     * sind, und bietet den Anpfiff nur an dem Tag an, an dem gespielt wird.
     */
    renderNextUpCard(state, userClub) {
        const cal = this.getCalendarEngine();
        const termin = (cal && typeof cal.naechsterTermin === "function")
            ? cal.naechsterTermin(state) : null;
        const heuteSpiel = this.heutigesSpiel();

        this.renderDayRail(state, cal, termin);

        const tag = document.getElementById("dashMatchdayTag");
        const heading = document.getElementById("dashNextHeading");
        const preview = document.getElementById("dashMatchPreview");
        const note = document.getElementById("dashNextNote");
        const actions = document.getElementById("dashMatchActions");
        const btnLive = document.getElementById("btnDashLiveMatch");
        const btnInstant = document.getElementById("btnDashInstantSim");
        const btnAnalyse = document.getElementById("btnDashOpponentAnalysis");
        if (!preview || !actions) return;

        // Ein Knopf, der nicht sichtbar ist, darf auch nicht auslösen
        const sperreKnoepfe = () => {
            if (btnLive) btnLive.disabled = true;
            if (btnInstant) btnInstant.disabled = true;
        };

        // Kein Termin mehr in dieser Saison
        if (!termin) {
            preview.style.display = "none";
            actions.style.display = "none";
            sperreKnoepfe();
            if (heading) heading.textContent = "Als Nächstes";
            if (tag) tag.textContent = "Saisonende";
            if (note) {
                note.style.display = "";
                note.textContent = "Kein Spiel mehr angesetzt - die Saison läuft aus.";
            }
            return;
        }

        if (tag) tag.textContent = termin.wettbewerb;
        if (heading) heading.textContent = termin.tage === 0 ? "Heute" : "Als Nächstes";

        // Heute ist ein Testspiel: angesagt wie ein Spieltag - mit beiden
        // Mannschaften, und live oder als Sofortergebnis zu spielen. Vorher
        // lief der Termin beim Weiterklicken ungesehen durch.
        const testHeute = termin.art === "vorbereitung" && termin.tage === 0 ? this.heutigesTestspiel() : null;
        if (testHeute) {
            if (tag) tag.textContent = testHeute.art === "turnier" ? "Turnier" : "Testspiel";
            preview.style.display = "";
            const heimClub = testHeute.heim ? userClub : testHeute.gegner;
            const gastClub = testHeute.heim ? testHeute.gegner : userClub;
            DOM.setText("dashHomeName", heimClub?.name || "Heim");
            DOM.setText("dashAwayName", gastClub?.name || "Auswärts");
            this.markiereLangeNamen("dashHomeName", "dashAwayName");
            DOM.setText("dashHomeRank", "");
            DOM.setText("dashAwayRank", "");
            DOM.setText("dashVenue", testHeute.partie.neutralerPlatz ? "Neutraler Platz" : (heimClub?.stadium || ""));
            DOM.setText("dashNextWhen", testHeute.titel);
            const wappenEl = (id, club) => {
                const el = document.getElementById(id);
                if (el && club) this.setzeWappen(el, club);
            };
            wappenEl("dashHomeCrest", heimClub);
            wappenEl("dashAwayCrest", gastClub);
            actions.style.display = "";
            if (btnAnalyse) btnAnalyse.style.display = "none";
            this.zeigeMatchplanKnopf(testHeute.partie);
            btnLive.disabled = false;
            btnLive.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-play"/></svg><span>Live-Spiel starten</span>`;
            btnInstant.disabled = false;
            btnInstant.style.display = "";
            if (note) note.style.display = "none";
            return;
        }

        // Ein Vorbereitungstermin hat keine zwei Wappen - er hat ein Programm
        if (termin.art === "vorbereitung") {
            preview.style.display = "none";
            actions.style.display = "none";
            sperreKnoepfe();
            if (note) {
                note.style.display = "";
                note.innerHTML = `<strong>${this.escapeHtml(termin.titel)}</strong> ${this.wannText(termin.tage)}`
                    + `<span>${this.escapeHtml(termin.beschreibung
                        || "Noch nicht verplant - im Reiter Vorbereitung festlegen, sonst besetzt der Sportdirektor den Termin.")}</span>`;
            }
            return;
        }

        // Pflichtspiel, Pokal oder Europapokal: die beiden Mannschaften
        preview.style.display = "";
        const heimClub = termin.heim ? userClub : termin.gegner;
        const gastClub = termin.heim ? termin.gegner : userClub;

        const platz = (cid) => {
            const i = (state.standings || []).findIndex(s => s.clubId === cid);
            return i >= 0 ? `${i + 1}.` : "—";
        };

        DOM.setText("dashHomeName", heimClub?.name || "Heim");
        DOM.setText("dashAwayName", gastClub?.name || "Auswärts");
        this.markiereLangeNamen("dashHomeName", "dashAwayName");
        DOM.setText("dashHomeRank", termin.art === "liga" ? platz(heimClub?.id) : "");
        DOM.setText("dashAwayRank", termin.art === "liga" ? platz(gastClub?.id) : "");
        // Supercups und Endspiele finden auf neutralem Platz statt
        DOM.setText("dashVenue", termin.partie?.neutralerPlatz ? "Neutraler Platz" : (heimClub?.stadium || ""));
        DOM.setText("dashNextWhen", this.wannText(termin.tage));

        const wappen = (id, club) => {
            const el = document.getElementById(id);
            if (!el || !club) return;
            this.setzeWappen(el, club);
        };
        wappen("dashHomeCrest", heimClub);
        wappen("dashAwayCrest", gastClub);

        // Gespielt wird nur heute. An jedem anderen Tag sagt die Karte, wann.
        const spielbar = !!heuteSpiel && !heuteSpiel.gespielt;
        actions.style.display = "";
        if (btnAnalyse) btnAnalyse.style.display = termin.art === "liga" ? "" : "none";

        this.zeigeMatchplanKnopf(spielbar ? heuteSpiel.partie : null);
        if (spielbar) {
            btnLive.disabled = false;
            btnLive.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-play"/></svg><span>Live-Spiel starten</span>`;
            btnInstant.disabled = false;
            btnInstant.style.display = "";
            if (note) note.style.display = "none";
        } else if (heuteSpiel && heuteSpiel.gespielt) {
            const p = heuteSpiel.partie;
            btnLive.disabled = true;
            btnLive.textContent = `Beendet (${p.homeGoals}:${p.awayGoals})`;
            btnInstant.disabled = true;
            if (note) note.style.display = "none";
        } else {
            btnLive.disabled = true;
            btnLive.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-clock"/></svg><span>Anpfiff ${this.escapeHtml(this.wannText(termin.tage))}</span>`;
            btnInstant.disabled = true;
            btnInstant.style.display = "none";
            if (note) {
                note.style.display = "";
                note.innerHTML = `<strong>${this.escapeHtml(termin.titel)} ${this.wannText(termin.tage)}</strong>`
                    + `<span>${this.escapeHtml(this.wegBisZumSpiel(state, termin))}</span>`;
            }
        }
    }

    /** Der Knopf zur Taktikbesprechung - nur am Spieltag, mit Haken, wenn der Plan steht */
    zeigeMatchplanKnopf(partie) {
        const knopf = document.getElementById("btnDashMatchplan");
        if (!knopf) return;
        const engine = this.getMatchplanEngine();
        if (!partie || !engine) {
            knopf.style.display = "none";
            return;
        }
        const plan = engine.fuerSpiel(this.app.state, partie);
        const anw = typeof GegneranweisungEngine !== "undefined" ? Object.keys(GegneranweisungEngine.fuerSpiel(this.app.state, partie)).length : 0;
        knopf.style.display = "";
        knopf.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-${plan || anw ? "check" : "tactics"}"/></svg>`
            + `<span>${plan ? `Matchplan (${plan.punkte.length}${anw ? ` + ${anw}` : ""})` : (anw ? `Anweisungen (${anw})` : "Taktikbesprechung")}</span>`;
    }

    /**
     * Was zwischen heute und dem Spiel noch liegt - in einem Satz.
     */
    wegBisZumSpiel(state, termin) {
        if (termin.tage <= 0) return "";
        const bis = (state.calendar || []).slice(state.currentDayIndex || 0, termin.index);
        const zaehler = {};
        bis.forEach(t => { zaehler[t.type] = (zaehler[t.type] || 0) + 1; });

        const worte = {
            training: "Training", recovery: "Regeneration", tactics: "Taktik",
            opponent_analysis: "Gegneranalyse", media: "Pressekonferenz",
            sponsor: "Sponsorentermin", preseason: "Vorbereitung",
            matchday: "Pflichtspiel", cup: "Pokalabend", euro: "Europapokal",
            friendly: "Spieltermin", international: "Länderspieltag"
        };
        const teile = Object.keys(zaehler)
            .filter(k => worte[k])
            .sort((a, b) => zaehler[b] - zaehler[a])
            .slice(0, 3)
            .map(k => `${zaehler[k]}× ${worte[k]}`);

        return teile.length ? `Bis dahin: ${teile.join(", ")}.` : "";
    }

    /**
     * Die Tagesleiste - ein Kalenderstreifen wie im Vorbild.
     *
     * Zehn Tage nebeneinander, heute hervorgehoben, der naechste Termin
     * markiert. Sie bewegt die Zeit nicht; sie zeigt nur, wo man steht. Zeit
     * bewegt in diesem Spiel genau ein Knopf.
     */
    renderDayRail(state, cal, termin) {
        const rail = document.getElementById("dashDayRail");
        if (!rail || !cal) return;

        const tage = cal.getUpcomingDays(state, 10);
        const zielIndex = termin ? termin.index : -1;
        const start = state.currentDayIndex || 0;

        rail.innerHTML = tage.map((d, i) => {
            const heute = i === 0;
            const istZiel = (start + i) === zielIndex;
            const inhalt = cal.tagesInhalt(state, d);
            return `
                <div class="rail-day ${heute ? "is-today" : ""} ${istZiel ? "is-target" : ""} rail-${d.type}"
                     title="${this.escapeHtml(d.date)} · ${this.escapeHtml(inhalt.titel || d.title)}">
                    <span class="rail-dow">${this.escapeHtml((d.dayOfWeek || "").substring(0, 2))}</span>
                    <span class="rail-icon">${this.tagIcon(d.type)}</span>
                    <span class="rail-num">${this.escapeHtml((d.date || "").substring(0, 2))}</span>
                </div>`;
        }).join("");
    }

    renderDashboard() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        // 0. Erste Schritte einer neuen Karriere
        this.renderEinstiegKarte();

        // 1. Was als Nächstes ansteht - und ob heute gespielt wird
        this.renderNextUpCard(state, userClub);

        // 1a. Was heute ansteht
        this.renderAttentionList();

        // 1b. Kalender & Wochenplan Snapshot
        const calBadge = document.getElementById("dashCurrentDateBadge");
        if (calBadge) calBadge.textContent = state.currentDate || "01.08.2026";

        const calList = document.getElementById("dashCalendarList");
        if (calList) {
            const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine) 
                ? CalendarEngine 
                : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : null);
            
            const upcoming = calendarEngine ? calendarEngine.getUpcomingDays(state, 5) : [];
            if (upcoming.length > 0) {
                calList.innerHTML = upcoming.map((day, idx) => {
                    const isToday = idx === 0;
                    // Derselbe Inhalt wie im Kalenderreiter - nicht noch einmal
                    // eigene Symbole und Texte danebenstellen.
                    const inhalt = calendarEngine.tagesInhalt(state, day);
                    return `
                        <div class="calendar-timeline-item ${isToday ? 'current-day' : ''}">
                            <div class="cal-day-date">
                                <strong>${this.escapeHtml(day.dayOfWeek)}</strong>
                                <span>${this.escapeHtml((day.date || "").substring(0, 5))}</span>
                            </div>
                            <div class="cal-day-info">
                                <div class="cal-day-title">${this.tagIcon(day.type)} ${this.escapeHtml(this.ohneSymbol(inhalt.titel || day.title))}</div>
                                <div class="cal-day-desc">${this.escapeHtml(inhalt.text || day.description || "")}</div>
                            </div>
                            ${isToday ? '<span class="badge badge-success">HEUTE</span>' : ''}
                        </div>
                    `;
                }).join("");
            } else {
                calList.innerHTML = `<div class="empty-state-sm">Kein Kalender aktiv.</div>`;
            }
        }

        // 2. League Snapshot Table (Top 5 + User Club)
        const standingsBody = document.getElementById("dashStandingsBody");
        const tabelle = state.standings || [];
        const eigenerRang = tabelle.findIndex(s => s.clubId === userClub.id) + 1;
        // Die Spitze und das eigene Umfeld: wer vor und hinter uns steht,
        // ist wichtiger als Platz 4 und 5.
        let plaetze;
        if (eigenerRang <= 5) {
            plaetze = [1, 2, 3, 4, 5, 6];
        } else {
            plaetze = [1, 2, 3, null, eigenerRang - 1, eigenerRang, eigenerRang + 1];
        }
        plaetze = plaetze.filter(p => p === null || (p >= 1 && p <= tabelle.length));
        const zonen = this.tabellenZonen(state, this.getUserLeagueId(state), tabelle.length);

        standingsBody.innerHTML = plaetze.map(rank => {
            if (rank === null) {
                return `<tr class="tabelle-luecke"><td colspan="5">···</td></tr>`;
            }
            const s = tabelle[rank - 1];
            const isUser = s.clubId === userClub.id;
            const zone = zonen.get(rank);
            return `
                <tr class="${isUser ? 'row-user-club' : ''}" data-club-id="${this.escapeHtml(s.clubId)}">
                    <td><span class="rang${zone ? ` rang-${zone}` : ""}" title="${zone ? UIManager.ZONEN[zone] : ""}">${rank}</span></td>
                    <td class="tb-verein"><span class="tb-verein-inhalt"><span class="mini-wappen" data-club="${this.escapeHtml(s.clubId)}"></span><span class="tb-verein-name">${this.escapeHtml(s.clubName)}</span></span></td>
                    <td>${s.played}</td>
                    <td>${this.vorzeichen(s.goalDiff)}</td>
                    <td><strong>${s.points}</strong>${s.abzug ? `<sup class="tb-abzug" title="${s.abzug} Punkte Abzug">*</sup>` : ""}</td>
                </tr>
            `;
        }).join("");
        standingsBody.querySelectorAll(".mini-wappen").forEach(el => {
            const club = state.clubs.find(c => String(c.id) === el.dataset.club);
            if (club) {
                this.setzeWappen(el, club);
                el.textContent = this.vereinsKuerzel(club.name).slice(0, 1);
            }
        });
        this.bindVereinsZeilen(standingsBody);

        // 3. Board Confidence, Fan Mood & Media Pressure (D4)
        document.getElementById("dashBoardGoal").textContent = (typeof BoardEngine !== "undefined" && typeof BoardEngine.zielText === "function")
            ? BoardEngine.zielText(state, userClub)
            : GameState.getExpectationText(userClub.boardExpectation);
        document.getElementById("dashBoardFill").style.width = `${state.boardConfidence}%`;
        document.getElementById("dashBoardPct").textContent = `${state.boardConfidence}%`;

        const fanMood = state.fanMood !== undefined ? state.fanMood : 75;
        const mediaPressure = state.mediaPressure !== undefined ? state.mediaPressure : 45;

        const fanMoodFill = document.getElementById("dashFanMoodFill");
        const fanMoodPct = document.getElementById("dashFanMoodPct");
        if (fanMoodFill) fanMoodFill.style.width = `${fanMood}%`;
        if (fanMoodPct) fanMoodPct.textContent = `${fanMood}%`;
        this.renderFanStimmen(state);

        const mediaFill = document.getElementById("dashMediaFill");
        const mediaPct = document.getElementById("dashMediaPct");
        if (mediaFill) mediaFill.style.width = `${mediaPressure}%`;
        if (mediaPct) mediaPct.textContent = `${mediaPressure}%`;

        let msg = "Der Vorstand ist mit dem aktuellen Saisonverlauf zufrieden.";
        if (state.boardConfidence >= 85) msg = "Der Vorstand und die Fans sind von Ihren Leistungen begeistert!";
        else if (state.boardConfidence <= 50) msg = "Achtung: Der Vorstand fordert dringend bessere Ergebnisse!";
        document.getElementById("dashBoardMsg").textContent = msg;
        this.renderVorstandsAnfrage(state);

        // 4. Medical / Suspended List
        const medContainer = document.getElementById("dashMedicalList");
        const squad = state.players.filter(p => userClub.playerIds.includes(p.id));
        const injuredOrSuspended = squad.filter(p => p.injuredWeeks > 0 || p.suspendedMatches > 0);

        if (injuredOrSuspended.length === 0) {
            medContainer.innerHTML = `<div class="empty-state-sm">Keine verletzten oder gesperrten Spieler. Voller Kader einsatzbereit!</div>`;
        } else {
            medContainer.innerHTML = injuredOrSuspended.map(p => {
                if (p.injuredWeeks > 0) {
                    return `
                        <div class="medical-item">
                            <span class="medical-name"><svg class="ico" aria-hidden="true"><use href="#i-medical"/></svg><strong>${this.escapeHtml(p.name)}</strong> <span class="text-muted">${this.escapeHtml(p.pos)}</span></span>
                            <span class="medical-badge">${p.injuryName} (${p.injuredWeeks} Wo.)</span>
                        </div>
                    `;
                } else {
                    return `
                        <div class="medical-item">
                            <span>🟥 <strong>${p.name}</strong> (${p.pos})</span>
                            <span class="medical-badge">Gesperrt (${p.suspendedMatches} Sp.)</span>
                        </div>
                    `;
                }
            }).join("");
        }

        // 5. Recent News List (Top 3)
        const newsList = document.getElementById("dashNewsList");
        const recentInbox = state.inbox.slice(0, 3);
        if (recentInbox.length === 0) {
            newsList.innerHTML = `<div class="empty-state-sm">Keine neuen Nachrichten.</div>`;
        } else {
            // Ganze Nachricht per Klick; der Vorschautext wird per CSS auf
            // zwei Zeilen gekürzt statt immer "..." anzuhängen.
            newsList.innerHTML = recentInbox.map(item => `
                <button type="button" class="news-item-dash news-zeile${item.read ? "" : " ungelesen"}" data-msg-id="${this.escapeHtml(String(item.id))}">
                    <span class="news-zeile-text">
                        <span class="news-titel">${item.subject || item.title || "Nachricht"}</span>
                        <span class="news-vorschau">${item.body || ""}</span>
                    </span>
                    <span class="news-date">${item.date || ""}</span>
                </button>
            `).join("");
            newsList.querySelectorAll(".news-zeile").forEach(el => {
                el.addEventListener("click", () => {
                    const msg = state.inbox.find(m => String(m.id) === el.dataset.msgId);
                    if (msg) {
                        msg.read = true;
                        this.selectedInboxMessageId = String(msg.id);
                    }
                    this.switchTab("inbox");
                    this.renderHeader();
                });
            });
        }
    }

    /**
     * Spieler-ID aus einem data-Attribut auflösen.
     *
     * Die handgepflegten Vereine nutzen fortlaufende Zahlen als ID, erzeugte
     * Spieler dagegen Text (z. B. "rlw_02_5"). Ein blindes parseInt lieferte
     * für jeden erzeugten Spieler NaN - die Detailansicht blieb im gesamten
     * Amateurbereich stumm.
     */
    resolvePlayerId(raw) {
        if (raw === undefined || raw === null || raw === "") return null;
        const state = this.app?.state;
        if (state && Array.isArray(state.players)) {
            const match = state.players.find(p => String(p.id) === String(raw));
            if (match) return match.id;
        }
        return /^-?\d+$/.test(String(raw)) ? Number(raw) : raw;
    }

    /** PlayerRatingEngine in Browser und Test-Umgebung auflösen */
    getRatingEngine() {
        if (typeof PlayerRatingEngine !== "undefined" && PlayerRatingEngine) return PlayerRatingEngine;
        if (typeof window !== "undefined" && window.PlayerRatingEngine) return window.PlayerRatingEngine;
        return null;
    }

    /** CoachingStaffEngine in Browser und Test-Umgebung auflösen */
    getCoachingStaffEngine() {
        if (typeof CoachingStaffEngine !== "undefined" && CoachingStaffEngine) return CoachingStaffEngine;
        if (typeof window !== "undefined" && window.CoachingStaffEngine) return window.CoachingStaffEngine;
        return null;
    }

    /**
     * Sponsorenzahlung je Spieltag - immer aus der Finanz-Engine, damit im
     * Vereins-Reiter dieselbe Zahl steht, die dem Konto gutgeschrieben wird.
     */
    /** PreseasonEngine in Browser und Test-Umgebung aufloesen */
    getPreseasonEngine() {
        if (typeof PreseasonEngine !== "undefined" && PreseasonEngine) return PreseasonEngine;
        if (typeof window !== "undefined" && window.PreseasonEngine) return window.PreseasonEngine;
        return null;
    }

    /** PlayerGenerator in Browser und Test-Umgebung auflösen */
    getPlayerGenerator() {
        if (typeof PlayerGenerator !== "undefined" && PlayerGenerator) return PlayerGenerator;
        if (typeof window !== "undefined" && window.PlayerGenerator) return window.PlayerGenerator;
        return null;
    }

    /**
     * Findet einen Spieler - egal ob er im Profikader steht oder noch in der
     * Jugendakademie. Talente leben in einer eigenen Liste und tauchten
     * deshalb in der Spielerakte bisher gar nicht auf.
     */
    findAnyPlayer(playerId) {
        const state = this.app?.state;
        if (!state || playerId === undefined || playerId === null) return null;

        const profi = (state.players || []).find(p => String(p.id) === String(playerId));
        if (profi) return { player: profi, isProspect: false };

        const talent = (state.youthAcademy?.prospects || []).find(p => String(p.id) === String(playerId));
        if (talent) {
            const generator = this.getPlayerGenerator();
            if (generator && typeof generator.completeYouthProspect === "function") {
                generator.completeYouthProspect(talent);
            }
            return { player: talent, isProspect: true };
        }

        return null;
    }

    /**
     * Maßstab für die Sterne: der eigene Kader.
     *
     * Drei Sterne sind der Schnitt der eigenen Mannschaft, fünf Sterne heißen
     * "deutlich besser als alles, was ich habe". Ohne diesen Bezug hätte ein
     * Landesligist lauter Halbsterne und ein Bundesligist lauter Fünfer - die
     * Sterne würden gar nichts aussagen.
     */
    /**
     * Woran die Sterne gemessen werden - eine Vorliebe des Geräts, sie gilt
     * schon im Karrierestart:
     *   kader - drei Sterne sind der Schnitt des eigenen Kaders (Standard)
     *   liga  - drei Sterne sind der Schnitt der eigenen Liga
     *   welt  - drei Sterne sind ein solider Erstligaprofi (Stärke 70)
     */
    sternMassstab() {
        try {
            const wert = localStorage.getItem("sternMassstab");
            if (UIManager.STERN_MASSSTAEBE[wert]) return wert;
        } catch (e) { /* ohne Speicher gilt, was in dieser Sitzung gewählt wurde */ }
        return this._sternMassstabFallback || "kader";
    }

    setzeSternMassstab(wert) {
        if (!UIManager.STERN_MASSSTAEBE[wert]) return;
        try { localStorage.setItem("sternMassstab", wert); } catch (e) { /* gilt dann nur bis zum Neuladen */ }
        this._sternMassstabFallback = wert;
        this._starContextKey = null;
        this._wizardStarKey = null;
        // Scoutberichte und Gegneranalyse lesen den Maßstab aus der Engine
        const engine = this.getRatingEngine();
        if (engine) engine.massstab = wert;
    }

    starContext() {
        const state = this.app?.state;
        const engine = this.getRatingEngine();
        if (!state || !engine) return { squadAverageAbility: 140 };

        // Der Schnitt ändert sich nur bei Kaderbewegungen, deshalb gemerkt
        const club = state.clubs?.find(c => c.id === state.userClubId);
        const massstab = this.sternMassstab();
        const schluessel = `${massstab}|${state.userClubId}|${(club?.playerIds || []).length}|${state.currentMatchday}|${state.seasonYear}`;
        if (this._starContextKey === schluessel && this._starContext && this._starContext.state === state) return this._starContext;

        // Beide Schlüssel: calculateStarRating liest squadAverageAbility,
        // calculateVisiblePlayerCard userSquadAvgAbility. Ohne beide messen
        // Spielerakte und Kadertabelle an verschiedenen Maßstäben - derselbe
        // Spieler stand dann mit zwei und mit drei Sternen da.
        engine.massstab = massstab;
        const schnitt = engine.sternBezug(state);
        this._starContextKey = schluessel;
        // Der Spielstand reist mit: Die Spielerkarte misst daran die Klasse in Worten
        this._starContext = { squadAverageAbility: schnitt, userSquadAvgAbility: schnitt, state };
        return this._starContext;
    }

    /**
     * Sternewertung eines Spielers auf einer bestimmten Stärke - wird überall
     * dort verwendet, wo früher eine nackte OVR-Zahl stand.
     */
    starsFor(overall, options = {}) {
        const engine = this.getRatingEngine();
        if (!engine) return "★★★";
        const sterne = engine.starsForOverall(overall, this.starContext());
        return engine.renderStarChip(sterne, options);
    }

    /**
     * Die volle Sternereihe für einen Spieler: heutige Stärke gefüllt,
     * Potenzial schraffiert. Für alles, was keine Scoutingkarte hat -
     * Nachwuchsspieler, Mannschaftsteile, schnelle Übersichten.
     */
    abilityStarsFor(player, options = {}) {
        const engine = this.getRatingEngine();
        if (!engine || !player) return "";

        const kontext = options.wizardVerein ? this.wizardSpielerKontext(options.wizardVerein)
            : (options.wizard ? this.wizardStarContext() : this.starContext());
        const ca = engine.starsForOverall(player.overall ?? 50, kontext);
        const pa = Math.max(ca, engine.starsForOverall(player.pot ?? player.overall ?? 50, kontext));

        return engine.renderAbilityStars({ caMin: ca, caMax: ca, paMax: pa }, {
            compact: options.compact,
            title: options.title || engine.describeAbilityStars({ caMin: ca, caMax: ca, paMax: pa })
        });
    }

    /**
     * Die Sternereihe einer Mannschaft - für Gegner, den eigenen Verein und
     * jede Vereinsübersicht. Gemessen wird wie überall am eigenen Kader.
     */
    teamStarsFor(club, options = {}) {
        const engine = this.getRatingEngine();
        const state = this.app?.state;
        if (!engine || !club || !state) return "";

        const kader = (club.playerIds || [])
            .map(id => state.players.find(p => p.id === id))
            .filter(Boolean);
        if (kader.length === 0) return "";

        return engine.renderTeamStars(kader, this.starContext(), options);
    }

    /** Sternewert als Zahl, etwa zum Sortieren oder für Beschriftungen */
    starValueFor(overall) {
        const engine = this.getRatingEngine();
        if (!engine) return 3;
        return engine.starsForOverall(overall, this.starContext());
    }

    /**
     * Im Karrierestart gibt es noch keinen eigenen Kader. Maßstab sind dort
     * die Vereine, die zur Auswahl stehen: Drei Sterne heißen "Mittelfeld
     * dieser Auswahl", fünf Sterne "der stärkste Kader weit und breit".
     */
    wizardStarContext() {
        const teams = this.getWizardTeams() || [];
        const massstab = this.sternMassstab();
        const schluessel = `${massstab}|${teams.length}|${this.wizardSelectedLeagueId || "alle"}`;
        if (this._wizardStarKey === schluessel && this._wizardStarContext) return this._wizardStarContext;
        if (massstab === "welt") {
            this._wizardStarKey = schluessel;
            this._wizardStarContext = { squadAverageAbility: UIManager.STERN_WELT_BEZUG, userSquadAvgAbility: UIManager.STERN_WELT_BEZUG };
            return this._wizardStarContext;
        }

        const engine = this.getRatingEngine();
        const schnitte = teams
            .map(c => typeof c.avgOverall === "number"
                ? c.avgOverall
                : (Array.isArray(c.players) && c.players.length
                    ? c.players.reduce((s, p) => s + (p.overall || 0), 0) / c.players.length
                    : null))
            .filter(v => typeof v === "number" && v > 0);

        const mittel = schnitte.length
            ? schnitte.reduce((a, b) => a + b, 0) / schnitte.length
            : 58;

        const bezug = engine ? engine.overallToAbility(mittel) : 116;
        this._wizardStarKey = schluessel;
        this._wizardStarContext = { squadAverageAbility: bezug, userSquadAvgAbility: bezug };
        return this._wizardStarContext;
    }

    /**
     * Die Spieler eines Vereins im Karrierestart - gemessen wie nach der
     * Übernahme. Vorher maß der Assistent an allen Vereinen der Auswahl:
     * Bayerns Spieler hatten dort fünf Sterne und nach dem Start im Kader
     * drei oder vier.
     */
    wizardSpielerKontext(club) {
        const engine = this.getRatingEngine();
        const massstab = this.sternMassstab();
        const schnittVon = (c) => {
            if (typeof c.avgOverall === "number" && c.avgOverall > 0) return engine.overallToAbility(c.avgOverall);
            return engine.squadAverageAbility(Array.isArray(c.players) ? c.players : []);
        };
        let bezug;
        if (!engine || massstab === "welt") bezug = UIManager.STERN_WELT_BEZUG;
        else if (massstab === "liga") {
            const liga = (this.getWizardTeams() || []).filter(t => t.leagueId === club.leagueId);
            bezug = liga.length ? liga.reduce((s, t) => s + schnittVon(t), 0) / liga.length : schnittVon(club);
        } else bezug = schnittVon(club);
        return { squadAverageAbility: bezug, userSquadAvgAbility: bezug };
    }

    /** Sterne im Karrierestart - gemessen an den anderen Vereinen der Auswahl */
    wizardStarsFor(overall, options = {}) {
        const engine = this.getRatingEngine();
        if (!engine) return "★★★";
        return engine.renderStarChip(engine.starsForOverall(overall, this.wizardStarContext()), options);
    }

    /**
     * Mannschaftsstärke im Karrierestart. Dort gibt es noch keinen eigenen
     * Kader, deshalb ist der Maßstab die Auswahl, die vor einem liegt.
     */
    wizardTeamStars(players, options = {}) {
        const engine = this.getRatingEngine();
        if (!engine || !Array.isArray(players) || players.length === 0) return "";
        return engine.renderTeamStars(players, this.wizardStarContext(), options);
    }

    /**
     * Transfers & Scouting rendern
     */
    /** Auflösung der NegotiationEngine (Browser & Node) */
    getNegotiationEngine() {
        if (typeof NegotiationEngine !== "undefined" && NegotiationEngine) return NegotiationEngine;
        if (typeof window !== "undefined" && window.NegotiationEngine) return window.NegotiationEngine;
        return null;
    }

    /**
     * Nach dem eigenen Spiel den Spieltag zu Ende bringen.
     *
     * Bisher stand nach dem Abpfiff nur das eigene Ergebnis fest - die übrigen
     * Partien der Liga wurden erst beim Weiterschalten des Tages ausgespielt.
     * Die Tabelle zeigte deshalb noch den Stand von vorher, teils über Tage
     * hinweg. Jetzt läuft der Spieltag zu Ende, sobald die eigene Partie
     * abgepfiffen ist - wie im echten Fußball, wo parallel gespielt wird.
     */
    finishMatchdayAroundUser() {
        const state = this.app?.state;
        const engine = (typeof SeasonEngine !== "undefined" && SeasonEngine)
            ? SeasonEngine
            : ((typeof window !== "undefined" && window.SeasonEngine) ? window.SeasonEngine : null);
        if (!state || !engine || typeof engine.simulateRemainingMatchesOfDay !== "function") return;

        engine.simulateRemainingMatchesOfDay(state);

        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderHeader();
        if (this.activeTab === "fixtures") this.renderFixturesAndStandings();
        if (this.activeTab === "dashboard") this.renderDashboard();

        // Der Vorstand entscheidet nach dem Spieltag - wenn er sich trennt,
        // geht es hier nicht einfach weiter.
        this.pruefeEntlassung();
    }

    /** Ein Angebot für einen eigenen Spieler als Karte */
    angebotKarteHtml(o, state, userClub) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const spieler = state.players.find(p => String(p.id) === String(o.playerId));
        const wert = spieler?.value || o.playerValue || 0;
        const quote = wert > 0 ? Math.round(o.fee / wert * 100) : null;
        const rest = typeof o.frist === "number" ? Math.max(0, o.frist - (state.currentDayIndex || 0)) : null;
        const stamm = spieler && (userClub.lineup || []).some(id => String(id) === String(spieler.id));
        const quoteKlasse = quote === null ? "" : (quote >= 115 ? "gut" : (quote < 95 ? "schlecht" : ""));
        return `
            <article class="angebot-karte${rest !== null && rest <= 1 ? " dringend" : ""}">
                <header class="ak-kopf">
                    <span class="ak-verein">${esc(o.fromClubName || o.buyerClubName || "Ein Verein")}</span>
                    ${rest !== null ? `<span class="ak-frist">${rest === 0 ? "läuft heute ab" : `noch ${rest} Tag${rest === 1 ? "" : "e"}`}</span>` : ""}
                </header>
                <div class="ak-spieler" ${spieler ? `data-player-id="${spieler.id}" title="Spielerakte öffnen"` : ""}>
                    <strong>${esc(o.playerName)}</strong>
                    <span class="pos-tag pos-${this.getPosGroup(o.playerPos || spieler?.pos)}">${esc(o.playerPos || spieler?.pos || "")}</span>
                    ${spieler ? `<span class="sb-meta">${spieler.age} J. · ${stamm ? "Stammspieler" : "Ergänzung"}</span> ${this.abilityStarsFor(spieler, { compact: true })}` : ""}
                </div>
                <div class="angebot-zahlen">
                    <div><span>Angebot</span><strong>${this.geldKurz(o.fee)}</strong></div>
                    <div><span>Marktwert</span><strong>${wert ? this.geldKurz(wert) : "-"}</strong></div>
                    <div><span>Verhältnis</span><strong class="ak-quote ${quoteKlasse}">${quote !== null ? `${quote} %` : "-"}</strong></div>
                </div>
                ${o.zahlweise && typeof FinanceEngine !== "undefined" && FinanceEngine.ratenText
                    ? `<div class="ak-raten">In Raten: ${esc(FinanceEngine.ratenText(o.fee, o.zahlweise))}</div>` : ""}
                <label class="ak-wv">Weiterverkaufsbeteiligung
                    <select class="styled-select" data-wv-offer="${o.id}">
                        <option value="0">keine</option>
                        <option value="10">10 % (Ablöse −5 %)</option>
                        <option value="20">20 % (Ablöse −10 %)</option>
                    </select>
                </label>
                <div class="ak-knoepfe">
                    <button class="btn btn-sm btn-primary btn-accept-offer" data-offer-id="${o.id}">Annehmen</button>
                    <button class="btn btn-sm btn-secondary btn-more-offer" data-offer-id="${o.id}" title="Zur Seite des Angebots: Folgen, Käufer, Mehr fordern">Zum Angebot</button>
                    <button class="btn btn-sm btn-secondary btn-reject-offer" data-offer-id="${o.id}">Ablehnen</button>
                </div>
            </article>`;
    }

    /** Angebot annehmen - der Spieler wechselt sofort. Ohne Angabe gilt die Wahl auf der Karte im Transfermarkt */
    nimmAngebotAn(offerId, weiterverkauf = null) {
        const state = this.app.state;
        const wahl = weiterverkauf === null ? document.querySelector(`#aiOffersContainer [data-wv-offer="${offerId}"]`) : null;
        const prozent = weiterverkauf !== null ? weiterverkauf : parseInt(wahl?.value || "0", 10);
        const r = TransferEngine.nimmAngebotAn(state, offerId, { weiterverkauf: prozent });
        if (!r.ok) { this.showToast(r.grund || "Das Angebot liegt nicht mehr vor.", "error"); return false; }
        this.playSound("erfolg");
        this.showToast(`✅ ${r.offer.playerName} wechselt für ${this.geldKurz(r.offer.fee)} zu ${r.offer.fromClubName}.`, "success", 6000);
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderHeader();
        this.renderCurrentTab();
        return true;
    }

    lehneAngebotAb(offerId) {
        const state = this.app.state;
        const r = TransferEngine.lehneAngebotAb(state, offerId);
        if (!r.ok) return false;
        this.playSound("click");
        this.showToast(`${r.offer.fromClubName} erhält eine Absage für ${r.offer.playerName}.`, "info");
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderHeader();
        this.renderCurrentTab();
        return true;
    }

    /**
     * Neue Angebote melden sich selbst: Nach dem Weiterklicken springt die
     * Ansicht auf die Seite des ersten noch nicht gemeldeten Angebots
     * (uiAngebot.js) - aber nur, wenn gerade kein Fenster offen ist.
     */
    pruefeNeueAngebote() {
        const state = this.app.state;
        const neu = (state?.transferMarket?.offers || []).filter(o => o.status === "pending" && o.gemeldet === false);
        if (!neu.length) return false;
        const offen = [...document.querySelectorAll(".modal-overlay")].some(m => m.style.display && m.style.display !== "none");
        if (offen) return false;
        neu.forEach(o => { o.gemeldet = true; });
        this.playSound("click");
        this.zeigeAngebotSeite(neu[0].id);
        if (neu.length > 1) {
            this.showToast(`Dazu ${neu.length - 1} weitere${neu.length === 2 ? "s" : ""} Angebot${neu.length === 2 ? "" : "e"} - unten auf der Seite und im Transfermarkt ganz oben.`, "info", 6000);
        }
        return true;
    }

    renderStats() {
        const state = this.app.state;
        const eigeneLiga = this.getUserLeagueId(state);
        const ligen = state.leagues || [];

        // Bisher liefen hier alle Ligen der Welt durcheinander: Torjäger aus
        // Spanien, Vorlagengeber aus der Regionalliga. Standard ist jetzt die
        // eigene Liga, jede andere lässt sich wählen.
        const select = document.getElementById("statsLeagueSelect");
        if (!this.statsLigaId || (this.statsLigaId !== "alle" && !ligen.some(l => l.id === this.statsLigaId))) {
            this.statsLigaId = eigeneLiga;
        }
        const ligaId = this.statsLigaId;
        if (select) {
            const name = l => `${this.flaggeVon(l.countryId)} ${l.shortName || l.name}`;
            const eigene = ligen.find(l => l.id === eigeneLiga);
            const sortiert = (liste) => liste.sort((x, y) => String(x.countryId).localeCompare(String(y.countryId)) || (x.level || 1) - (y.level || 1));
            const andere = sortiert(ligen.filter(l => l.id !== eigeneLiga && !this.istHintergrundLiga(l)));
            const hintergrund = sortiert(ligen.filter(l => l.id !== eigeneLiga && this.istHintergrundLiga(l)));
            select.innerHTML = [
                eigene ? `<option value="${eigene.id}">${name(eigene)} (eigene Liga)</option>` : "",
                `<option value="alle">🌍 Alle Ligen</option>`,
                ...andere.map(l => `<option value="${l.id}">${name(l)}</option>`),
                hintergrund.length ? `<optgroup label="Weitere Länder">${hintergrund.map(l => `<option value="${l.id}">${name(l)}</option>`).join("")}</optgroup>` : ""
            ].join("");
            select.value = ligaId;
            select.onchange = () => {
                this.statsLigaId = select.value;
                this.renderStats();
            };
        }

        const vereine = new Map((state.clubs || []).map(c => [c.id, c]));
        // Die Ranglisten einer Liga zählen nur Ligaspiele - Pokal und
        // Europapokal stehen in der Akte des Spielers
        const statistik = typeof StatistikEngine !== "undefined" ? StatistikEngine : null;
        const spieler = (state.players || []).filter(p => {
            if (!p.stats) return false;
            if (ligaId === "alle") return true;
            return vereine.get(p.clubId)?.leagueId === ligaId;
        }).map(p => ({ p, s: statistik ? statistik.von(p, "liga") : p.stats }));
        const userClubId = state.userClubId;
        const ANZAHL = 8;

        const rangliste = (elId, liste, wertText, leer) => {
            const el = document.getElementById(elId);
            if (!el) return;
            el.innerHTML = liste.slice(0, ANZAHL).map(({ p, s }, i) => {
                const club = vereine.get(p.clubId);
                return `
                    <div class="leaderboard-item${p.clubId === userClubId ? " lb-eigen" : ""}">
                        <span class="lb-rank">${i + 1}</span>
                        <span class="mini-wappen" data-club="${this.escapeHtml(String(p.clubId))}"></span>
                        <span class="lb-person">
                            <span class="lb-name">${this.escapeHtml(p.name)}</span>
                            <span class="lb-club">${this.escapeHtml(club?.name || "")}</span>
                        </span>
                        <span class="lb-val">${wertText(s)}</span>
                    </div>`;
            }).join("") || `<div class="empty-state-sm">${leer}</div>`;
            el.querySelectorAll(".mini-wappen").forEach(w => {
                const club = vereine.get(w.dataset.club) || state.clubs.find(c => String(c.id) === w.dataset.club);
                if (club) {
                    this.setzeWappen(w, club);
                    w.textContent = this.vereinsKuerzel(club.name).slice(0, 1);
                }
            });
        };

        rangliste("statsTopScorers",
            spieler.filter(e => e.s.goals > 0).sort((a, b) => b.s.goals - a.s.goals),
            s => `${s.goals} <small>${s.goals === 1 ? "Tor" : "Tore"}</small>`,
            "Noch keine Tore erzielt.");

        rangliste("statsTopAssists",
            spieler.filter(e => e.s.assists > 0).sort((a, b) => b.s.assists - a.s.assists),
            s => `${s.assists} <small>Vorl.</small>`,
            "Noch keine Vorlagen erfasst.");

        rangliste("statsCleanSheets",
            spieler.filter(e => e.p.pos === "TW" && e.s.cleanSheets > 0).sort((a, b) => b.s.cleanSheets - a.s.cleanSheets),
            s => `${s.cleanSheets} <small>zu null</small>`,
            "Noch keine Zu-null-Spiele.");

        // Ein Spieler mit zwei guten Einsätzen gehört nicht vor den, der jede
        // Woche spielt: Mindesteinsätze wachsen mit der Saison.
        const meisteEinsaetze = spieler.reduce((m, e) => Math.max(m, e.s.matches || 0), 0);
        const mindestens = Math.max(2, Math.ceil(meisteEinsaetze * 0.4));
        const schnitt = s => s.ratingSum / s.matches;
        rangliste("statsTopRatings",
            spieler.filter(e => (e.s.matches || 0) >= mindestens).sort((a, b) => schnitt(b.s) - schnitt(a.s)),
            s => `${schnitt(s).toFixed(2).replace(".", ",")} <small>Ø</small>`,
            `Mindestens ${mindestens} Einsätze erforderlich.`);
        DOM.setText("statsRatingHint", `ab ${mindestens} Einsätzen`);

        if (typeof this.renderDatenzentrale === "function") this.renderDatenzentrale(state, ligaId);
        this.renderPreise(state, ligaId === "alle" ? eigeneLiga : ligaId, vereine);
        this.renderJahrespreise(state, vereine);
        this.renderTurnier(state);
        this.renderKoeffizient(state);
        this.renderKarussell(state, ligaId === "alle" ? eigeneLiga : ligaId);
        this.renderGeruechte(state, ligaId === "alle" || ligaId === eigeneLiga);

        // Historie der vergangenen Saisons
        const histBody = document.getElementById("statsHistoryBody");
        if (histBody) {
            const past = state.history?.pastSeasons || [];
            if (past.length === 0) {
                histBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aktuell läuft die erste Saison. Meister, Platzierung und Torschützenkönig werden nach Saisonende hier archiviert.</td></tr>`;
            } else {
                histBody.innerHTML = past.map(s => {
                    const myClub = state.clubs.find(c => c.id === s.userClubId);
                    const kanone = s.awards?.topScorer;
                    return `
                        <tr>
                            <td><strong>Saison ${s.season}</strong></td>
                            <td>🏆 ${this.escapeHtml(s.championName || "-")}</td>
                            <td>${this.escapeHtml(myClub?.name || 'Mein Verein')}</td>
                            <td><strong>Platz ${s.userRank}</strong></td>
                            <td>${kanone ? `${this.escapeHtml(kanone.name)} (${kanone.goals})` : "-"}</td>
                        </tr>
                    `;
                }).join("");
            }
        }
    }

    /**
     * Kalender rendern
     */
    /**
     * Der Bericht des vergangenen Tages.
     *
     * "Nächsten Tag simulieren" hat vorher nur das Datum weitergeschoben und
     * eine einzelne Zeile als Hinweis eingeblendet. Hier steht jetzt, was der
     * Trainerstab entschieden hat, wer aufgefallen ist und was im Verein
     * sonst passiert ist.
     */
    renderDayReport() {
        const card = document.getElementById("dayReportCard");
        const list = document.getElementById("dayReportList");
        const meta = document.getElementById("dayReportMeta");
        if (!card || !list) return;

        const bericht = this.app.state.lastDayReport;
        if (!bericht || !Array.isArray(bericht.messages) || bericht.messages.length === 0) {
            card.style.display = "none";
            return;
        }

        card.style.display = "";
        if (meta) meta.textContent = `${bericht.dayOfWeek || ""} ${bericht.date || ""} · ${bericht.title || ""}`.trim();
        list.innerHTML = bericht.messages
            .map(m => `<li>${this.escapeHtml(m)}</li>`)
            .join("");
    }

    renderCalendar() {
        const state = this.app.state;
        const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine) 
            ? CalendarEngine 
            : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : null);

        if (!calendarEngine) return;

        const calText = document.getElementById("calCurrentDateText");
        if (calText) calText.textContent = `${state.currentDate} (Tag ${state.currentDayIndex + 1})`;

        this.renderDayReport();

        this.renderNextMatchCard(state, calendarEngine);

        const weekGrid = document.getElementById("calendarWeekGrid");
        const upcomingWeek = calendarEngine.getUpcomingDays(state, 7);

        if (weekGrid) {
            weekGrid.innerHTML = upcomingWeek.map((day, idx) => {
                const isToday = idx === 0;
                const inhalt = calendarEngine.tagesInhalt(state, day);
                const marken = (inhalt.marken || []).slice(0, 2)
                    .map(m => `<span class="cal-mark">${m}</span>`).join("");

                return `
                    <div class="calendar-day-card ${isToday ? 'active-today' : ''} cal-type-${day.type}">
                        <div class="cal-card-top">
                            <span class="cal-dow">${day.dayOfWeek}</span>
                            <span class="cal-date">${day.date}</span>
                        </div>
                        <div class="cal-card-icon">${this.tagIcon(day.type)}</div>
                        <div class="cal-card-title">${this.ohneSymbol(inhalt.titel || day.title)}</div>
                        <div class="cal-card-desc">${inhalt.text || ""}</div>
                        ${marken ? `<div class="cal-marks">${marken}</div>` : ""}
                        ${isToday ? '<span class="cal-status-badge">HEUTE</span>' : ''}
                    </div>
                `;
            }).join("");
        }

        // Die Liste zeigt, was kommt - nicht, was war. Vorher stand dort die
        // ganze Saison ab Tag eins, fast alles abgehakt: eine Liste aus
        // Häkchen, durch die man erst scrollen musste, um zu heute zu kommen.
        const fullList = document.getElementById("calendarFullList");
        if (fullList && Array.isArray(state.calendar)) {
            const ab = state.currentDayIndex || 0;
            const kommend = state.calendar.slice(ab, ab + 28);

            fullList.innerHTML = kommend.map((d, i) => {
                const isCurrent = i === 0;
                const inhalt = calendarEngine.tagesInhalt(state, d);
                const wichtig = ["matchday", "friendly", "media", "season_end", "cup", "euro"].includes(d.type);
                return `
                    <div class="cal-full-item ${isCurrent ? 'current' : ''} ${wichtig ? 'wichtig' : ''}">
                        <div class="cal-full-date">${d.date} (${d.dayOfWeek})</div>
                        <div class="cal-full-title">
                            <span class="cal-full-kopf">${this.tagIcon(d.type)}<span>${this.ohneSymbol(inhalt.titel || d.title)}</span></span>
                            <span class="cal-full-sub">${inhalt.text || ""}</span>
                        </div>
                        <div class="cal-full-status">${isCurrent ? '⏳ Heute' : ''}</div>
                    </div>
                `;
            }).join("");

            const rest = state.calendar.length - ab - kommend.length;
            const hint = document.getElementById("calListHint");
            if (hint) {
                hint.textContent = rest > 0
                    ? `nächste ${kommend.length} Tage · ${rest} weitere bis Saisonende`
                    : `${kommend.length} Tage bis Saisonende`;
            }
        }
    }

    /** Absender-Symbol im Postfach aus dem Iconset */
    /**
     * Der monatliche Entwicklungsbericht: verbessert, nachgelassen,
     * Feinschliff an einzelnen Detailwerten, Akademie.
     * Je Spieler die Stärke vorher und nachher und die Werte, die sich am
     * meisten bewegt haben.
     */
    entwicklungsBerichtHtml(b) {
        const esc = t => this.escapeHtml(String(t ?? ""));
        const vorzeichen = d => `${d > 0 ? "+" : ""}${d}`;
        const zeile = (e, akte = true) => `
            <div class="eb-zeile${akte ? " row-clickable" : ""}"${akte ? ` data-entwicklung-akte="${esc(e.id)}" role="button" tabindex="0"` : ""}>
                <div class="eb-kopf">
                    <span class="eb-name"><strong>${esc(e.name)}</strong> <span class="text-muted">${esc(e.pos)}, ${esc(e.age)}</span></span>
                    <span class="eb-zahl">${esc(e.von)} → ${esc(e.nach)} <strong class="${e.diff > 0 ? "eb-plus" : "eb-minus"}">${vorzeichen(e.diff)}</strong></span>
                </div>
                ${(e.werte || []).length || e.grund === "verletzt" || e.grund === "Alter" ? `
                <div class="eb-werte">${(e.werte || []).map(w => `<span class="${w.diff > 0 ? "eb-plus" : "eb-minus"}">${esc(w.label)} ${vorzeichen(w.diff)}</span>`).join("")}${e.grund === "verletzt" ? `<span class="text-muted">verletzt</span>` : e.grund === "Alter" ? `<span class="text-muted">altersbedingt</span>` : ""}</div>` : ""}
            </div>`;
        const tabelle = (titel, liste, akte = true) => liste.length ? `
            <h4 class="eb-titel">${titel}</h4>
            <div class="eb-liste">${liste.map(e => zeile(e, akte)).join("")}</div>` : "";
        // Feinschliff und Spielpraxis an einzelnen Detailwerten
        const fein = b.feinschliff || [];
        const feinHtml = fein.length ? `
            <h4 class="eb-titel">🎯 Feinschliff und Spielpraxis (${fein.length})</h4>
            <div class="eb-liste">${fein.map(e => `
                <div class="eb-zeile row-clickable" data-entwicklung-akte="${esc(e.id)}" role="button" tabindex="0">
                    <div class="eb-kopf"><span class="eb-name"><strong>${esc(e.name)}</strong> <span class="text-muted">${esc(e.pos)}, ${esc(e.age)}</span></span></div>
                    <div class="eb-werte">${e.werte.map(w => `<span class="${w.diff > 0 ? "eb-plus" : "eb-minus"}">${esc(w.label)} ${vorzeichen(w.diff)}</span>`).join("")}</div>
                </div>`).join("")}</div>` : "";
        return `
            <div class="entwicklungsbericht">
                ${tabelle(`📈 Verbessert (${b.besser.length})`, b.besser) || `<p class="text-muted">Verbessert hat sich diesen Monat niemand.</p>`}
                ${tabelle(`📉 Nachgelassen (${b.schlechter.length})`, b.schlechter)}
                ${b.gleich ? `<p class="text-muted eb-gleich">${b.gleich} Spieler ${b.gleich === 1 ? "hält sein" : "halten ihr"} Niveau.</p>` : ""}
                ${feinHtml}
                ${tabelle(`🎓 Aus der Akademie (${(b.jugend || []).length})`, b.jugend || [], false)}
            </div>`;
    }

    postfachSymbol(emoji) {
        const id = ({
            "✉️": "i-mail", "👔": "i-briefcase", "⚽": "i-ball", "🔄": "i-transfer", "🏥": "i-medical",
            "🔍": "i-search", "💰": "i-wallet", "📝": "i-doc", "🎖️": "i-trophy", "📈": "i-chart", "🎯": "i-target",
            "🎓": "i-leaf"
        })[emoji] || "i-mail";
        return `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;
    }

    soundKnopfHtml() {
        return this.soundEnabled
            ? `<svg class="ico" aria-hidden="true"><use href="#i-volume"/></svg><span>Sound: Aktiviert</span>`
            : `<svg class="ico" aria-hidden="true"><use href="#i-volume-off"/></svg><span>Sound: Stummgeschaltet</span>`;
    }

    /** Wetter und Platz einer Partie mit Hinweis, was das bedeutet */
    wetterHtml(match, klasse = "") {
        if (!match || typeof WetterEngine === "undefined") return "";
        const heim = (this.app.state.clubs || []).find(c => c.id === match.homeClubId);
        const w = WetterEngine.fuer(match, heim);
        const hinweis = WetterEngine.hinweis(w);
        return `<div class="${klasse} wetter-zeile">${w.icon} <strong>${this.escapeHtml(w.name)}, ${w.temp} °C</strong> <span class="text-muted">${this.escapeHtml(w.platzName)}${hinweis ? ` - ${this.escapeHtml(hinweis)}` : ""}</span></div>`;
    }

    /** Nationalität und Länderspiele in der Spielerakte */
    nationalHtml(player) {
        if (!player || !player.nationality) return "";
        const engine = typeof NationalTeamEngine !== "undefined" ? NationalTeamEngine : null;
        const akte = engine ? engine.akte(player) : null;
        const teile = [`<span class="pd-nation">${this.escapeHtml(player.nationality)}</span>`];
        if (akte && akte.text) teile.push(`<span class="pd-caps"><svg class="ico" aria-hidden="true"><use href="#i-globe"/></svg>${this.escapeHtml(akte.text)}</span>`);
        if (akte && akte.abgestellt) teile.push(`<span class="pd-abgestellt">bei der Nationalmannschaft</span>`);
        return `<div class="pd-national">${teile.join("")}</div>`;
    }

    /** Symbol eines Kalendertags - aus dem Iconset statt als Emoji */
    tagIcon(typ) {
        const id = ({
            training: "i-dumbbell", recovery: "i-leaf", media: "i-mic", sponsor: "i-briefcase",
            tactics: "i-tactics", opponent_analysis: "i-search", matchday: "i-ball",
            season_start: "i-star", season_end: "i-trophy", preseason: "i-sun", friendly: "i-ball",
            cup: "i-trophy", euro: "i-star", international: "i-globe"
        })[typ] || "i-calendar";
        return `<svg class="ico tag-ico tag-${this.escapeHtml(String(typ || "tag"))}" aria-hidden="true"><use href="#${id}"/></svg>`;
    }

    /** Emoji-Symbole aus den Engines auf das Iconset abbilden */
    symbolHtml(emoji) {
        const id = ({
            "🚑": "i-medical", "🥵": "i-flame", "📄": "i-doc", "😞": "i-frown", "📬": "i-mail",
            "🏗️": "i-build", "⚠️": "i-alert", "🤝": "i-briefcase", "🧊": "i-leaf", "🔥": "i-flame",
            "📣": "i-mic", "💢": "i-alert", "💰": "i-wallet", "🩺": "i-medical",
            "💬": "i-chat", "📢": "i-alert", "🔁": "i-transfer", "🎓": "i-leaf", "👥": "i-users", "🌍": "i-globe", "⭐": "i-star"
        })[emoji];
        return id
            ? `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`
            : this.escapeHtml(String(emoji || ""));
    }

    /**
     * Das nächste Pflichtspiel als Karte - im Vorbild das Erste, was man
     * sieht: gegen wen, wo, welcher Tabellenplatz, welche Form.
     */
    renderNextMatchCard(state, calendarEngine) {
        const karte = document.getElementById("nextMatchCard");
        if (!karte) return;

        const n = calendarEngine.naechstesSpiel(state);
        if (!n) { karte.style.display = "none"; return; }
        karte.style.display = "";

        const eigener = state.clubs.find(c => c.id === state.userClubId);
        const heimClub = n.heim ? eigener : n.gegner;
        const gastClub = n.heim ? n.gegner : eigener;

        // Wie viele Tage sind es noch?
        const idx = (state.calendar || []).findIndex((d, i) =>
            i >= (state.currentDayIndex || 0) && d.type === "matchday");
        const tage = idx >= 0 ? idx - (state.currentDayIndex || 0) : null;

        DOM.setText("nextMatchLabel", `${n.spieltag}. Spieltag · ${state.leagueName || "Liga"}`);
        DOM.setText("nextMatchWhen",
            tage === 0 ? "heute" : tage === 1 ? "morgen" : tage > 1 ? `in ${tage} Tagen` : "");

        const seite = (club, istEigener) => `
            <div class="nm-club ${istEigener ? "nm-own" : ""}">
                <span class="nm-name">${club?.name || "-"}</span>
                <span class="nm-sub">${this.tabellenPlatzText(state, club?.id)}</span>
            </div>`;
        const home = document.getElementById("nextMatchHome");
        const away = document.getElementById("nextMatchAway");
        if (home) home.innerHTML = seite(heimClub, n.heim);
        if (away) away.innerHTML = seite(gastClub, !n.heim);

        const lage = calendarEngine.kaderLage(state);
        const hinweise = [];
        hinweise.push(n.heim ? "Heimspiel" : "Auswärtsspiel");
        if (n.gegnerForm.length) hinweise.push(`Gegner-Form: ${n.gegnerForm.map(UIManager.formKuerzel).join(" ")}`);
        if (lage.verletzt > 0) hinweise.push(`${lage.verletzt} eigene Spieler verletzt`);
        if (lage.gesperrt > 0) hinweise.push(`${lage.gesperrt} gesperrt`);
        DOM.setText("nextMatchMeta", hinweise.join("  ·  "));
        this.renderSpielvorschau(state);
    }

    /** Die aufklappbare Spielvorschau: Quoten, Bilanz, Form, Torjäger, Ausfälle */
    renderSpielvorschau(state) {
        const el = document.getElementById("nextMatchVorschau");
        const engine = typeof SpielvorschauEngine !== "undefined" ? SpielvorschauEngine : null;
        if (!el || !engine) return;
        const v = engine.vorschau(state);
        if (!v) { el.hidden = true; el.innerHTML = ""; return; }
        el.hidden = false;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const prozent = (x) => `${Math.round(x * 100)} %`;
        const quote = (x) => x.toFixed(2).replace(".", ",");
        const form = (f) => f.length ? f.map(UIManager.formKuerzel).join(" ") : "–";
        const eigenName = this.app.state.clubs.find(c => c.id === state.userClubId)?.name || "Wir";
        const b = v.bilanz;
        const ausfall = (liste) => liste.length ? liste.slice(0, 4).map(a => `${esc(a.name)} <small>${esc(a.pos)}, ${a.grund}</small>`).join(", ") + (liste.length > 4 ? ` <small>+${liste.length - 4}</small>` : "") : "keine";
        const offen = el.open;
        el.innerHTML = `
            <summary>Spielvorschau · Sieg ${prozent(v.sieg)} · Remis ${prozent(v.remis)} · Niederlage ${prozent(v.niederlage)}</summary>
            <div class="sv-raster">
                <div class="sv-zeile"><span>Quoten</span><strong>1: ${quote(v.quoten.heim)} · X: ${quote(v.quoten.remis)} · 2: ${quote(v.quoten.gast)}</strong></div>
                <div class="sv-zeile"><span>Erwartete Tore</span><strong>${String(v.erwarteteTore.heim).replace(".", ",")} : ${String(v.erwarteteTore.gast).replace(".", ",")}</strong></div>
                <div class="sv-zeile"><span>Direkter Vergleich</span><strong>${b ? `${b.siege} S · ${b.remis} U · ${b.niederlagen} N <small>${b.tore}:${b.gegentore} Tore${b.letzte[0] ? `, zuletzt ${esc(b.letzte[0].ergebnis)} (${esc(b.letzte[0].wettbewerb)})` : ""}</small>` : "<small>noch kein Duell seit Ihrem Amtsantritt</small>"}</strong></div>
                <div class="sv-zeile"><span>Form</span><strong>${esc(eigenName)} ${form(v.form.eigen)} <small>·</small> ${esc(v.gegner.name)} ${form(v.form.gegner)}</strong></div>
                <div class="sv-zeile"><span>Torjäger</span><strong>${v.torjaeger.eigen ? `${esc(v.torjaeger.eigen.name)} ${v.torjaeger.eigen.tore}` : "–"} <small>·</small> ${v.torjaeger.gegner ? `${esc(v.torjaeger.gegner.name)} ${v.torjaeger.gegner.tore}` : "–"}</strong></div>
                <div class="sv-zeile"><span>Es fehlen bei uns</span><strong>${ausfall(v.ausfaelle.eigen)}</strong></div>
                <div class="sv-zeile"><span>Es fehlen beim Gegner</span><strong>${ausfall(v.ausfaelle.gegner)}</strong></div>
            </div>`;
        el.open = offen;
    }

    tabellenPlatzText(state, clubId) {
        const i = (state.standings || []).findIndex(t => t.clubId === clubId);
        if (i < 0) return "";
        const eintrag = state.standings[i];
        return `${i + 1}. · ${eintrag.points ?? 0} Pkt`;
    }

    /**
     * Modal: Meisterfeier am Saisonende
     */
    /**
     * Führt einen einzelnen Tag im Kalender fort
     */
    /**
     * Was der Weiter-Knopf als Nächstes tut - und wie er heißt.
     *
     * Im Vorbild heißt der Knopf nie "einen Tag simulieren", sondern nennt das
     * Ziel: das Spiel, die Pressekonferenz, den nächsten Termin. Das ist
     * hier nachgebaut - ein Knopf, der immer verrät, was passiert.
     */
    beschreibeWeiter() {
        const state = this.app.state;
        const cal = this.getCalendarEngine();
        if (!state || !cal) return { art: "tag", text: "Weiter" };

        const heute = cal.getCurrentDay(state);

        // Steht heute ein eigenes Spiel an - Liga, Pokal oder Europa -, dann
        // geht es direkt hinein. Welches das ist, beantwortet der Kalender.
        const spiel = this.heutigesSpiel();
        if (spiel && !spiel.gespielt) {
            const heim = spiel.partie.homeClubId === state.userClubId;
            const gegnerId = heim ? spiel.partie.awayClubId : spiel.partie.homeClubId;
            const gegner = state.clubs.find(c => c.id === gegnerId);
            const wo = heim ? "gegen" : "bei";

            if (spiel.art === "liga") {
                return {
                    art: "spiel",
                    text: gegner ? `Spiel ${wo} ${this.kurzName(gegner.name)}` : "Spiel beginnen",
                    kurz: "Anpfiff"
                };
            }
            return {
                art: "spiel",
                text: `${spiel.rundenName} ${wo} ${this.kurzName(gegner?.name || "")}`,
                // "Europa" allein sagte nicht, dass jetzt ein Spiel ansteht
                kurz: "Anpfiff"
            };
        }

        // Heute ist ein Testspiel oder eine Turnierrunde: angesagt wie ein
        // Spieltag, mit Gegner - und live oder als Sofortergebnis zu spielen
        const test = this.heutigesTestspiel();
        if (test) {
            return { art: "spiel", text: test.titel, kurz: "Anpfiff" };
        }

        // Heute ist Medientag - erst die Pressekonferenz
        if (heute && heute.type === "media" && !this._pressDone) {
            return { art: "presse", text: "Pressekonferenz", kurz: "Presse" };
        }

        const halt = cal.naechsterHalt(state);
        if (!halt) return { art: "tag", text: "Weiter" };

        const tage = halt.index - (state.currentDayIndex || 0);

        // Der Termin ist heute - dann heisst der Knopf nach dem Termin, nicht
        // nach dem Weg dorthin.
        if (tage <= 0) {
            if (halt.grund === "friendly") {
                const pre = this.getPreseasonEngine();
                const geplant = (pre && state.preseason && typeof pre.terminBeschreibung === "function")
                    ? pre.terminBeschreibung(state, heute?.friendlyIndex ?? 0)
                    : null;
                return { art: "tag", text: geplant ? "Spieltermin austragen" : "Termin austragen", kurz: "Termin" };
            }
            if (halt.grund === "season_end") return { art: "tag", text: "Saison abschließen", kurz: "Saisonende" };
            if (halt.grund === "season_change") return { art: "tag", text: "Neue Saison beginnen", kurz: "Saisonstart" };
            if (halt.grund === "matchday") return { art: "tag", text: "Spieltag abschließen", kurz: "Spieltag" };
            if (halt.grund === "cup" || halt.grund === "euro") {
                return { art: "tag", text: "Pokalabend abschließen", kurz: "Pokal" };
            }
            if (halt.grund === "playoff") return { art: "tag", text: "Spiel abschließen", kurz: "Relegation" };
            return { art: "tag", text: "Weiter" };
        }

        const beschriftung = {
            matchday: () => {
                const n = cal.naechstesSpiel(state);
                // Voller Name: der Knopf kürzt selbst, wenn der Platz nicht reicht
                return n ? `Weiter zum Spiel ${n.heim ? "gegen" : "bei"} ${n.gegnerName}` : "Weiter zum Spieltag";
            },
            friendly: () => "Weiter zum Spieltermin",
            media: () => "Weiter zur Pressekonferenz",
            season_end: () => "Weiter zum Saisonabschluss",
            season_change: () => "Weiter zum Saisonwechsel",
            cup: () => `Weiter zum ${halt.partie?.runde?.roundName || "Pokalspiel"}`,
            euro: () => `Weiter zum ${halt.partie?.wettbewerb?.name || "Europapokal"}`,
            playoff: () => `Weiter: ${halt.partie?.wettbewerb?.name || "Relegation"}`
        };
        const kurzformen = {
            matchday: "Spiel", friendly: "Termin", media: "Presse",
            season_end: "Saisonende", season_change: "Saisonwechsel", cup: "Pokal", euro: "Europa", playoff: "Relegation"
        };
        const text = (beschriftung[halt.grund] || (() => "Weiter"))();
        return { art: "sprung", text, kurz: kurzformen[halt.grund] || "Weiter", tage, zielIndex: halt.index };
    }

    /**
     * Ein Name mit einem langen Wort ("Gelsenkirchen") wird am Handy etwas
     * kleiner gesetzt - sonst bricht er mitten im Wort um.
     */
    markiereLangeNamen(...ids) {
        ids.forEach(id => {
            const el = typeof document !== "undefined" ? document.getElementById(id) : null;
            if (!el || !el.dataset) return;
            const laengstes = Math.max(0, ...String(el.textContent || "").split(/[\s-]+/).map(w => w.length));
            if (laengstes > 10) el.dataset.lang = "1"; else delete el.dataset.lang;
        });
    }

    /** "Weiter zum Spiel bei X" -> "Spiel bei X": das "Weiter" steht im Knopf schon oben */
    weiterZiel(text) {
        const t = String(text || "Weiter").replace(/^Weiter(?: zum| zur|:)\s+/, "");
        return t.charAt(0).toUpperCase() + t.slice(1);
    }

    /** Ein Emoji am Anfang eines Titels weglassen, wenn daneben schon ein Symbol steht */
    ohneSymbol(text) {
        return String(text || "").replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "");
    }

    /** Wenn heute kein Spiel ist, sagt die Oberfläche auch, wann eines ist */
    meldeKeinSpielHeute() {
        const cal = this.getCalendarEngine();
        const termin = cal && typeof cal.naechsterTermin === "function"
            ? cal.naechsterTermin(this.app.state)
            : null;
        this.showToast(termin
            ? `Heute wird nicht gespielt. Nächster Termin: ${termin.titel} ${this.wannText(termin.tage)}.`
            : "Heute wird nicht gespielt.", "info");
    }

    /** "heute", "morgen", "in 12 Tagen" */
    wannText(tage) {
        if (tage <= 0) return "heute";
        if (tage === 1) return "morgen";
        return `in ${tage} Tagen`;
    }

    /** Vereinsnamen für einen Knopf kürzen */
    /**
     * Kürzel eines Vereins für Wappen und enge Spalten: das prägende Wort,
     * nicht das "FC" oder die "1." davor. Vorher stand "1. " im Wappen des
     * 1. FC Köln und "FC " in dem des FC Bayern.
     */
    vereinsKuerzel(name) {
        const allgemein = new Set(["FC", "SV", "SC", "VfB", "VfL", "TSG", "FSV", "RB", "SpVgg", "TSV", "BSC", "SG",
            "Borussia", "Eintracht", "Bayer", "Werder", "Hertha", "Fortuna", "Union", "Rot-Weiß", "Rot-Weiss", "AC", "AS", "CF",
            "CD", "RC", "OGC", "SS", "FK", "Real", "Club", "Sporting", "Olympique", "Stade", "Atlético", "Athletic"]);
        const teile = String(name || "").split(/\s+/).filter(t => t && !/^\d+\.?$/.test(t));
        const kern = teile.find(t => !allgemein.has(t)) || teile[0] || "?";
        return kern.replace(/[^A-Za-zÄÖÜäöüß]/g, "").slice(0, 3).toUpperCase() || "?";
    }

    /**
     * Farben eines Wappens: Grund in der Hauptfarbe, Ring in der Zweitfarbe,
     * Schrift so gewählt, dass sie auch auf weißem Grund lesbar bleibt.
     */
    wappenFarben(club) {
        const farbe = (club && club.primaryColor) || "#334155";
        const zweit = (club && club.secondaryColor) || "#ffffff";
        const hell = (hex) => {
            const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
            if (!m) return false;
            const n = parseInt(m[1], 16);
            return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.62;
        };
        const schrift = hell(farbe) ? (hell(zweit) ? "#0f172a" : zweit) : (hell(zweit) ? zweit : "#ffffff");
        return { farbe, zweit, schrift };
    }

    /** Wappen als HTML-Schnipsel für Vorlagen (Assistent, Startbildschirm) */
    wappenHtml(club, klasse = "") {
        const f = this.wappenFarben(club);
        const zeichen = this.escapeHtml(this.vereinsKuerzel(club && (club.name || club.clubName)));
        return `<span class="crest ${klasse}" style="background-color:${f.farbe};color:${f.schrift};--crest-ring:${f.zweit};" aria-hidden="true">${zeichen}</span>`;
    }

    /** Wappen in Vereinsfarben - mit lesbarer Schrift auch auf weißem Grund */
    setzeWappen(el, club) {
        const f = this.wappenFarben(club);
        el.style.backgroundColor = f.farbe;
        el.style.color = f.schrift;
        el.style.boxShadow = `inset 0 0 0 3px ${f.zweit}, 0 0 0 1px rgba(255,255,255,0.25)`;
        el.textContent = this.vereinsKuerzel(club.name);
        if (el.dataset) el.dataset.zeichen = String(el.textContent.length);
    }

    kurzName(name) {
        if (!name) return "";
        return name.length <= 18 ? name : name.slice(0, 16).trim() + "…";
    }

    getCalendarEngine() {
        if (typeof CalendarEngine !== "undefined" && CalendarEngine) return CalendarEngine;
        if (typeof window !== "undefined" && window.CalendarEngine) return window.CalendarEngine;
        return null;
    }

    /**
     * Das Spiel, das heute ansteht - oder nichts.
     *
     * Jede Stelle, die einen Anpfiff anbietet, fragt hier nach. Damit gibt es
     * genau eine Antwort auf die Frage "darf jetzt gespielt werden?", statt
     * dass Dashboard, Kopfleiste und Kalender sie sich je einzeln aus dem
     * Spielplan zusammenreimen.
     */
    heutigesSpiel() {
        const cal = this.getCalendarEngine();
        if (!cal || typeof cal.spielbarHeute !== "function") return null;
        return cal.spielbarHeute(this.app?.state);
    }

    /**
     * Das heutige Spiel anpfeifen - live.
     *
     * Gibt true zurueck, wenn ein Spiel begonnen wurde (oder die Aufstellung
     * den Anpfiff verhindert hat). false heisst: Heute ist kein Spiel.
     */
    /** Das heutige Testspiel der Vorbereitung - oder null */
    heutigesTestspiel() {
        const state = this.app?.state;
        const cal = this.getCalendarEngine();
        const pre = this.getPreseasonEngine();
        if (!state || !cal || !pre || !state.preseason || typeof pre.partieFuerSlot !== "function") return null;
        const tag = cal.getCurrentDay(state);
        if (!tag || tag.type !== "friendly" || tag.completed) return null;
        // Einmal je Tag bestimmen - sonst bekaeme jede Abfrage ein neues Objekt
        const schluessel = `${state.seasonYear || 1}_${state.currentDayIndex}`;
        if (this._testspielHeute?.schluessel === schluessel) return this._testspielHeute.test;
        const test = pre.partieFuerSlot(state, tag.friendlyIndex ?? 0);
        this._testspielHeute = { schluessel, test };
        return test;
    }

    /**
     * Ein Testspiel anpfeifen - live oder als Sofortergebnis.
     *
     * Vorher spielte der Kalender Testspiele beim Weiterklicken ungesehen aus.
     * Jetzt laufen sie wie ein Spieltag: Aufstellung pruefen, Ansprache, Spiel.
     * Das Ergebnis geht danach an den Kalender, der den Termin abschliesst.
     */
    starteTestspiel(test, sofort) {
        const state = this.app.state;
        const val = this.validateLineupForMatch();
        if (!val.valid) {
            this.meldeAufstellungsProblem(val);
            return true;
        }
        this._laufendesTestspiel = test;
        if (sofort) {
            this.startLiveMatchSimulation(test.partie, { ohneBild: true });
            return true;
        }
        this._matchplanDone = false;
        this._teamTalkDone = false;
        this.startLiveMatchSimulation(test.partie);
        return true;
    }

    /** Nach dem Abpfiff: Der Kalender traegt das gespielte Testspiel ein */
    schliesseTestspielAb(partie) {
        const state = this.app.state;
        this._laufendesTestspiel = null;
        this._testspielHeute = null;
        if (state.preseason) state.preseason.livePartie = partie;
        this.handleCalendarAdvanceDay();
    }

    starteHeutigesSpiel(sofort = false) {
        const test = this.heutigesTestspiel();
        if (test) return this.starteTestspiel(test, sofort);

        const heute = this.heutigesSpiel();
        if (!heute || heute.gespielt) return false;

        const val = this.validateLineupForMatch();
        if (!val.valid) {
            this.meldeAufstellungsProblem(val);
            return true;
        }

        // Pokal- und Europapokalpartien muessen nach dem Abpfiff ihre Runde
        // abschliessen - dafuer merkt sich die Oberflaeche den Termin.
        if (heute.art === "pokal" || heute.art === "euro") {
            const tag = this.getCalendarEngine()?.getCurrentDay(this.app.state);
            this._laufenderPokaltermin = {
                art: tag?.cupArt || (heute.art === "pokal" ? "cup" : "euro"),
                runde: tag?.cupRunde || 0,
                ko: !!heute.ko,
                partie: heute.partie
            };
        }

        if (sofort) {
            // Das Sofort-Ergebnis ist dasselbe Spiel wie live, nur ohne Bild:
            // Laufwege, Entscheidungen, Heatmap - und der Co-Trainer coacht
            this.startLiveMatchSimulation(heute.partie, { ohneBild: true });
            return true;
        }

        // Jeder Anpfiff beginnt mit Besprechung und Ansprache - auch wenn ein
        // früherer Versuch vorher abgebrochen wurde
        this._matchplanDone = false;
        this._teamTalkDone = false;
        this.startLiveMatchSimulation(heute.partie);
        return true;
    }

    /**
     * Die Elf ist nicht spielbereit. Bei einem Ausfall in der Startelf hielt
     * das Spiel bisher an: Jeder Klick auf Weiter brachte dieselbe Meldung,
     * und wer sie übersah, hing fest. Jetzt stellt der Co-Trainer auf Wunsch
     * um - nur die Ausfälle, der Rest der Elf bleibt -, dann geht es los.
     */
    meldeAufstellungsProblem(val) {
        const aktionen = val.ausfall ? [
            { text: "Co-Trainer stellt um", haupt: true, aktion: () => this.ersetzeAusfaelle(true) },
            { text: "Selbst umstellen", aktion: () => this.switchTab("tactics") }
        ] : [];
        this.showToast(val.message, "error", aktionen.length ? 15000 : 3500, { aktionen });
        this.switchTab("tactics");
    }

    /**
     * Verletzte und Gesperrte in der eigenen Elf ersetzen: Auf ihren Platz
     * rückt der beste verfügbare Ersatz, kehrt der Stammspieler zurück,
     * bekommt er ihn wieder (GameState.repairLineup). anpfiff: danach gleich
     * weiter zum Spiel.
     */
    ersetzeAusfaelle(anpfiff = false) {
        const state = this.app.state;
        const club = state?.clubs.find(c => c.id === state.userClubId);
        if (!club || typeof GameState === "undefined" || typeof GameState.repairLineup !== "function") return false;
        const vorher = (club.lineup || []).slice();
        GameState.repairLineup(club, state.players);
        const name = (id) => (state.players.find(p => p.id === id)?.name || "?").split(" ").pop();
        const wechsel = vorher.map((id, i) => [id, club.lineup[i]]).filter(([a, b]) => a !== b).map(([a, b]) => `${name(b)} für ${name(a)}`);
        this.showToast(wechsel.length ? `Der Co-Trainer hat umgestellt: ${wechsel.join(", ")}.` : "Die Elf steht schon ohne Ausfälle.", "success", 5000);
        this.renderCurrentTab();
        if (anpfiff && wechsel.length) this.handleWeiter();
        return wechsel.length > 0;
    }

    getCupEngine() {
        if (typeof CupEngine !== "undefined" && CupEngine) return CupEngine;
        if (typeof window !== "undefined" && window.CupEngine) return window.CupEngine;
        return null;
    }

    /** Die eigene Partie an einem Pokal- oder Europapokaltag */
    eigenePokalpartie(tag) {
        if (!tag || (tag.type !== "cup" && tag.type !== "euro")) return null;
        const cup = this.getCupEngine();
        if (!cup || typeof cup.eigenePartieAm !== "function") return null;
        const art = tag.cupArt || (tag.type === "cup" ? "cup" : "euro");
        return cup.eigenePartieAm(this.app.state, art, tag.cupRunde || 0);
    }

    /**
     * Der eine Weiter-Knopf: Er läuft Tag für Tag bis zum nächsten Termin,
     * an dem der Manager gebraucht wird - und geht dabei immer über den
     * Kalender, damit es nur eine Zeitrechnung gibt.
     */
    handleWeiter() {
        // Was bis hierher stehen blieb, gilt nach dem Weiterspielen nicht mehr
        if (typeof this.raeumeMeldungenAuf === "function") this.raeumeMeldungenAuf();
        // Ohne Verein läuft die Zeit nicht weiter - erst die Entscheidung
        if (this.pruefeEntlassung()) return;
        // Ohne Arzt, Athletik- und Co-Trainer beginnt die Saison nicht einfach so
        if (this.pruefePflichtpostenVorStart(() => this.handleWeiter())) return;

        const ziel = this.beschreibeWeiter();

        if (ziel.art === "spiel") {
            this.app.handleAdvanceAction();
            return;
        }
        if (ziel.art === "presse") {
            this.handleCalendarAdvanceDay();
            return;
        }
        if (ziel.art === "sprung" && ziel.tage > 1) {
            this.laufeBisTermin(ziel.tage);
            return;
        }
        this.handleCalendarAdvanceDay();
    }

    /**
     * Nur einen Tag weiter - für den, der zwischen Pressekonferenz und
     * Anpfiff jeden Trainingstag selbst sehen will.
     */
    handleEinTag() {
        if (typeof this.raeumeMeldungenAuf === "function") this.raeumeMeldungenAuf();
        if (this.pruefeEntlassung()) return;
        if (this.pruefePflichtpostenVorStart(() => this.handleEinTag())) return;
        const ziel = this.beschreibeWeiter();
        if (ziel.art === "spiel") {
            this.handleWeiter();
            return;
        }
        this.handleCalendarAdvanceDay();
    }

    /**
     * Nach dem eigenen Pokalspiel die Runde zu Ende bringen.
     *
     * Ein K.-o.-Spiel braucht einen Sieger: Steht es nach 90 Minuten
     * unentschieden, entscheidet das Elfmeterschießen - und zwar mit echten
     * Schützen, nicht per Münzwurf.
     */
    finishCupTieAroundUser() {
        const termin = this._laufenderPokaltermin;
        this._laufenderPokaltermin = null;
        const state = this.app?.state;
        const cup = this.getCupEngine();
        if (!termin || !state || !cup) return;

        const partie = termin.partie;
        if (termin.ko && partie && partie.played && partie.homeGoals === partie.awayGoals
            && !partie.penaltyWinner) {
            cup.elfmeterschiessen(state, partie);
            const sieger = state.clubs.find(c => c.id === partie.penaltyWinner);
            const stand = partie.penaltyScore || [];
            // Nach einem Endspiel gibt es keine nächste Runde
            const endspiel = termin.art === "supercup" || termin.art === "eurosupercup" || partie.roundName === "Finale";
            this.showToast(
                `🥅 Elfmeterschießen ${stand[0]}:${stand[1]} - ${sieger?.name || "Sieger"} ${endspiel ? "holt den Titel" : "steht in der nächsten Runde"}.`,
                partie.penaltyWinner === state.userClubId ? "success" : "error");
        }

        // Die übrigen Partien des Abends laufen parallel
        cup.spieleTermin(state, termin.art, termin.runde);
        const abschluss = cup.schliesseTerminAb(state, termin.art, termin.runde);
        // Relegation und Playoffs: Ist die eigene Paarung entschieden, steht es gleich da
        if (termin.art === "playoff" && Array.isArray(abschluss) && abschluss.length) {
            this.showToast(abschluss[0], "info", 6000);
        }

        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderHeader();
        this.renderCurrentTab();
    }

    /**
     * Jeder Wettbewerb hat sein eigenes Gesicht.
     *
     * Ein Pokalabend soll sich nicht anfühlen wie der 14. Spieltag: Die
     * Königsklasse ist nachtblau mit Sternenlicht, der Landespokal
     * rot-golden, der dritte Europapokal grün. Die Farben gehen als
     * CSS-Variablen an die Oberfläche, so dass Anzeigetafel, Tabelle und
     * Spielplan mitziehen, ohne dass jede Stelle den Wettbewerb kennen muss.
     */
    static WETTBEWERB_THEMEN = {
        ucl: {
            icon: "⭐", get name() { return UIManager.wettbewerbName("ucl"); }, get kurz() { return this.name; },
            accent: "#4f8bff", accent2: "#c7dcff", flaeche: "rgba(15, 30, 78, 0.92)"
        },
        uel: {
            icon: "🌍", get name() { return UIManager.wettbewerbName("uel"); }, get kurz() { return this.name; },
            accent: "#f97316", accent2: "#fdba74", flaeche: "rgba(66, 27, 4, 0.9)"
        },
        uecl: {
            icon: "🏆", get name() { return UIManager.wettbewerbName("uecl"); }, get kurz() { return this.name; },
            accent: "#22c55e", accent2: "#86efac", flaeche: "rgba(8, 48, 26, 0.9)"
        },
        cup: {
            icon: "🏆", name: "Pokal", kurz: "Pokal",
            accent: "#f5c542", accent2: "#fde68a", flaeche: "rgba(74, 20, 20, 0.92)"
        },
        supercup: {
            icon: "🏆", name: "Supercup", kurz: "Supercup",
            accent: "#f5c542", accent2: "#fde68a", flaeche: "rgba(74, 20, 20, 0.92)"
        },
        eurosupercup: {
            icon: "⭐", name: "Europäischer Supercup", kurz: "Supercup",
            accent: "#f5c542", accent2: "#c7dcff", flaeche: "rgba(15, 30, 78, 0.92)"
        },
        liga: {
            icon: "⚽", name: "Liga", kurz: "Liga",
            accent: "#38bdf8", accent2: "#7dd3fc", flaeche: "rgba(12, 16, 22, 0.92)"
        },
        friendly: {
            icon: "🥅", name: "Testspiel", kurz: "Test",
            accent: "#a78bfa", accent2: "#ddd6fe", flaeche: "rgba(35, 25, 60, 0.9)"
        },
        playoff: {
            icon: "⚔️", name: "Relegation", kurz: "Relegation",
            accent: "#f59e0b", accent2: "#fcd34d", flaeche: "rgba(60, 30, 6, 0.92)"
        }
    };

    /**
     * Die Live-Ansicht in die Farben des Wettbewerbs tauchen und oben
     * hinschreiben, worum es geht: "Meisterpokal · Viertelfinale".
     */
    setzeLiveThema(match) {
        const state = this.app?.state;
        const modal = document.getElementById("modalLiveMatch");
        if (!modal) return;

        const compId = match?.competitionId
            || (this._laufenderPokaltermin ? null : state?.userLeagueId);
        const thema = { ...this.wettbewerbsThema(compId) };
        // Relegation und Playoffs tragen ihren eigenen Namen
        if (match?.wettbewerbName) thema.name = match.wettbewerbName;
        this.setzeThema(modal, thema);

        let runde = match?.roundName
            || (match?.matchday ? `${match.matchday}. Spieltag` : "")
            || (state?.currentMatchday ? `${state.currentMatchday}. Spieltag` : "");
        // Ein Endspiel ohne Runden (Supercup) trägt seinen Namen nur einmal
        if (runde === thema.name) runde = "";

        DOM.setText("lmCompIcon", thema.icon);
        DOM.setText("lmCompName", thema.name);
        DOM.setText("lmCompRound", runde ? `· ${runde}` : "");
    }

    /** Das Thema eines Wettbewerbs - mit dem echten Namen aus dem Spielstand */
    wettbewerbsThema(compId) {
        const state = this.app?.state;
        const themen = UIManager.WETTBEWERB_THEMEN;

        if (compId && themen[compId]) {
            const thema = { ...themen[compId], id: compId };
            const w = state?.europeanCompetitions?.[compId];
            if (w?.name) thema.name = w.name;
            // Der Supercup heißt in jedem Land anders
            if (compId === "supercup" && typeof SupercupEngine !== "undefined" && SupercupEngine) thema.name = SupercupEngine.name(state);
            return thema;
        }
        if (compId && state?.cups?.[compId]) {
            return { ...themen.cup, id: compId, name: state.cups[compId].name || themen.cup.name };
        }
        if (compId === "friendly") return { ...themen.friendly, id: "friendly" };

        return {
            ...themen.liga,
            id: compId || state?.userLeagueId || "liga",
            name: (state?.leagues || []).find(l => l.id === compId)?.shortName
                || (compId === state?.userLeagueId ? (state?.leagueName || "Liga") : null)
                || state?.leagueName || "Liga"
        };
    }

    /**
     * Das Thema auf ein Element legen: Farben als Variablen, Kennung als
     * data-Attribut.
     */
    setzeThema(element, thema) {
        if (!element || !thema) return;
        element.dataset.comp = thema.id || "liga";
        element.style.setProperty("--comp-accent", thema.accent);
        element.style.setProperty("--comp-accent-2", thema.accent2);
        element.style.setProperty("--comp-flaeche", thema.flaeche);
    }

    /**
     * Was ein simulierter Pokalabend gebracht hat - in einem Satz.
     *
     * Wenn der eigene Verein beteiligt war, steht das Ergebnis vorn: Es ist
     * die Information, wegen der man hinschaut.
     */
    pokalabendMeldung(state, res) {
        const eigene = res.cup?.eigenePartie;
        if (eigene && eigene.played) {
            const heim = eigene.homeClubId === state.userClubId;
            const eigeneTore = heim ? eigene.homeGoals : eigene.awayGoals;
            const gegenTore = heim ? eigene.awayGoals : eigene.homeGoals;
            const gegner = state.clubs.find(c =>
                c.id === (heim ? eigene.awayClubId : eigene.homeClubId));
            const elfer = eigene.penaltyScore
                ? ` (${heim ? eigene.penaltyScore[0] : eigene.penaltyScore[1]}:${heim ? eigene.penaltyScore[1] : eigene.penaltyScore[0]} i. E.)`
                : "";
            return `🏆 ${eigeneTore}:${gegenTore}${elfer} gegen ${gegner?.name || "den Gegner"}`;
        }
        return res.type === "cup"
            ? "🏆 Die Pokalrunde wurde ausgespielt."
            : "⭐ Der europäische Spieltag wurde ausgetragen.";
    }

    /**
     * Urlaub (UrlaubEngine): Ziel wählen, dann läuft die Zeit bis dorthin -
     * Spiele, Pokalabende und Pressetermine übernimmt der Co-Trainer.
     */
    zeigeUrlaub() {
        const state = this.app.state;
        const engine = typeof UrlaubEngine !== "undefined" ? UrlaubEngine : null;
        const modal = document.getElementById("modalUrlaub");
        const body = document.getElementById("urlaubInhalt");
        if (!engine || !modal || !body) return;
        if (this.pruefeEntlassung()) return;
        // Ohne Arzt, Athletik- und Co-Trainer beginnt die Saison auch im Urlaub nicht
        if (this.pruefePflichtpostenVorStart(() => this.zeigeUrlaub())) return;
        const ziele = engine.ziele(state);
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        body.innerHTML = ziele.length ? `
            <p class="text-muted ul-text">Der Co-Trainer übernimmt: Er stellt auf, die Spiele werden ohne Livespiel gerechnet, die Presse spricht mit ihm. Zum Saisonende und bei einer Entlassung ist der Urlaub vorbei.</p>
            <div class="ul-ziele">${ziele.map(z => `
                <button type="button" class="ul-ziel" data-ul-tage="${z.tage}">
                    <strong>${esc(z.label)}</strong><span>${esc(z.datum)} · ${z.tage} Tage</span>
                </button>`).join("")}</div>
            <label class="ul-anhalten"><input type="checkbox" id="ulAnhalten" checked> Bei Wichtigem anhalten (Angebote, Verhandlungen, Verletzungen, wichtige Post)</label>`
            : `<p class="text-muted">In dieser Saison bleibt nichts mehr zu überspringen.</p>`;
        body.querySelectorAll("[data-ul-tage]").forEach(b => b.addEventListener("click", () => {
            modal.style.display = "none";
            this.laufeBisTermin(Number(b.dataset.ulTage), { urlaub: true, anhalten: !!document.getElementById("ulAnhalten")?.checked });
        }));
        document.getElementById("btnCloseUrlaub").onclick = () => { modal.style.display = "none"; };
        modal.style.display = "flex";
    }

    /** Mehrere Tage am Stück, aber über denselben Weg wie ein einzelner */
    laufeBisTermin(maxTage, optionen = {}) {
        const state = this.app.state;
        const cal = this.getCalendarEngine();
        if (!cal) return;
        if (this.saisonwechselHeute(cal, state)) {
            return this.mitLadeanzeige("Die neue Saison wird vorbereitet …", () => this._laufeBisTermin(cal, state, maxTage, optionen),
                "Verträge, Aufsteiger, Spielplan und Vorbereitung");
        }
        return this._laufeBisTermin(cal, state, maxTage, optionen);
    }

    /** Steht heute der Saisonwechsel an? Dann dauert der nächste Tag länger. */
    saisonwechselHeute(cal, state) {
        const heute = cal && state && typeof cal.getCurrentDay === "function" ? cal.getCurrentDay(state) : null;
        return !!(heute && heute.saisonwechsel);
    }

    _laufeBisTermin(cal, state, maxTage, optionen) {
        // Im Urlaub übernimmt der Co-Trainer die Termine - angehalten wird nur am Ziel
        const urlaub = !!optionen.urlaub;
        const urlaubEngine = urlaub && typeof UrlaubEngine !== "undefined" ? UrlaubEngine : null;
        const vorher = urlaubEngine ? urlaubEngine.stand(state) : null;

        let gelaufen = 0;
        let angehalten = null;
        let anlass = null;
        const berichte = [];
        while (gelaufen < maxTage) {
            const heute = cal.getCurrentDay(state);
            if (!heute) break;
            // Vor einem Termin, der den Manager braucht, wird angehalten
            if (!urlaub && gelaufen > 0 && ["matchday", "friendly", "media"].includes(heute.type)) break;
            if (gelaufen > 0 && heute.type === "season_end" && state._seasonFinished !== state.seasonYear) break;
            if (gelaufen > 0 && heute.saisonwechsel) break;
            // Ein Pokalabend hält nur auf, wenn der eigene Verein spielt
            if (!urlaub && gelaufen > 0 && (heute.type === "cup" || heute.type === "euro")
                && this.eigenePokalpartie(heute)) break;

            const bekannt = new Set((state.inbox || []).map(m => String(m.id)));
            const res = cal.advanceOneDay(state);
            if (!res || !res.success) break;
            gelaufen++;

            if (res.matchResult && res.matchResult.seasonEnded) {
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.showSeasonEndCelebration(res.matchResult);
                return;
            }
            if (res.type === "season_change") return this.zeigeSaisonwechsel(res);
            (res.summary?.messages || []).forEach(m => berichte.push(m));

            // Eine Entlassung beendet den Vorlauf sofort
            if (state.managerDismissed) break;

            // Wie im Vorbild: Passiert etwas, das den Manager angeht, hält die
            // Zeit an - auch zwischen zwei Terminen (im Urlaub nur, wenn gewünscht)
            anlass = (!urlaub || optionen.anhalten) && typeof cal.unterbrechung === "function"
                ? cal.unterbrechung(state, res, bekannt) : null;
            angehalten = anlass ? anlass.text : null;
            if (angehalten) break;
        }
        const urlaubsBilanz = urlaubEngine ? urlaubEngine.bilanz(vorher, urlaubEngine.stand(state), gelaufen) : null;

        const heuteNeu = cal.getCurrentDay(state);
        state.lastDayReport = {
            date: heuteNeu?.date,
            dayOfWeek: heuteNeu?.dayOfWeek,
            title: urlaubsBilanz ? `🏖️ Urlaub: ${urlaubsBilanz.text}${angehalten ? ` - angehalten: ${angehalten}` : ""}`
                : (angehalten ? `Angehalten: ${angehalten}` : `${gelaufen} Tage übersprungen`),
            messages: berichte.slice(urlaubsBilanz ? -20 : -12)
        };

        if (urlaubsBilanz) {
            this.showToast(`🏖️ Zurück aus dem Urlaub: ${urlaubsBilanz.text}.${angehalten ? ` Angehalten: ${angehalten}.` : ""}`, angehalten ? "warning" : "success", 8000);
        } else if (!angehalten) {
            this.showToast(`📅 ${gelaufen} Tage weiter - ${heuteNeu?.title || ""}`, "info");
        }
        this.renderHeader();
        this.renderCurrentTab();
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        if (!this.pruefeEntlassung()) this.pruefeNeueAngebote();
        // Wie im Vorbild: Die Meldung führt zum Anlass, und Weiter spielt weiter.
        // Öffnet sich gleich ein Fenster dafür (etwa das Angebot), ist das der Anlass -
        // dann würde die Meldung nur über seinen Knöpfen liegen.
        if (angehalten && !urlaubsBilanz && !(typeof this.einFensterOffen === "function" && this.einFensterOffen())) {
            const ansehen = () => this.zeigeAnlass(anlass);
            this.showToast(`${angehalten}.`, "warning", 12000, {
                titel: `Angehalten · ${heuteNeu?.date || ""}`,
                beiKlick: ansehen,
                aktionen: [{ text: "Ansehen", haupt: true, aktion: ansehen }]
            });
        }
    }

    /** Zum Anlass eines Anhaltens springen: Angebot, Verhandlung, Verletzter, Nachricht */
    zeigeAnlass(anlass) {
        const state = this.app.state;
        if (!anlass || !state) return;
        if (anlass.art === "verhandlung" && anlass.negId && typeof this.zeigeVerhandlung === "function" && this.zeigeVerhandlung(anlass.negId)) return;
        if (anlass.art === "angebot" && anlass.offerId !== undefined && typeof this.zeigeAngebotSeite === "function" && this.angebotVon(anlass.offerId)) {
            return this.zeigeAngebotSeite(anlass.offerId);
        }
        if (anlass.art === "angebot") {
            this.switchTab("transfers");
            document.getElementById("btnSubTransfersMarket")?.click();
            const karten = document.getElementById("aiOffersContainer");
            if (karten && typeof this.hebeHervor === "function") this.hebeHervor(karten);
            return;
        }
        if (anlass.art === "verletzung") {
            const p = (state.players || []).find(x => x.clubId === state.userClubId && x.name === anlass.spielerName);
            if (p) return this.showPlayerDetailsModal(p.id);
            return this.switchTab("squad");
        }
        if (anlass.art === "post" && anlass.msgId !== undefined) {
            const msg = (state.inbox || []).find(m => String(m.id) === String(anlass.msgId));
            if (msg) { msg.read = true; this.selectedInboxMessageId = String(msg.id); }
        }
        this.switchTab(anlass.art === "verhandlung" ? "transfers" : "inbox");
        this.renderHeader();
    }

    handleCalendarAdvanceDay() {
        const state = this.app.state;
        const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine) 
            ? CalendarEngine 
            : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : null);

        if (!calendarEngine) return;
        if (this.saisonwechselHeute(calendarEngine, state)) {
            return this.mitLadeanzeige("Die neue Saison wird vorbereitet …", () => this._handleCalendarAdvanceDay(calendarEngine, state),
                "Verträge, Aufsteiger, Spielplan und Vorbereitung");
        }
        return this._handleCalendarAdvanceDay(calendarEngine, state);
    }

    _handleCalendarAdvanceDay(calendarEngine, state) {

        // Am Medientag steht der Manager zuerst den Journalisten Rede und Antwort
        const heute = calendarEngine.getCurrentDay(state);
        if (heute && heute.type === "media" && !this._pressDone) {
            this._pressDone = true;
            this.showPressConferenceModal();
            return;
        }
        this._pressDone = false;

        const res = calendarEngine.advanceOneDay(state);
        if (res.success) {
            // Am letzten Spieltag endet die Saison. Ohne diese Abfrage wurde
            // das Saisonende im Kalender verschluckt: keine Ehrung, keine neue
            // Saison - das Spiel blieb für immer am 34. Spieltag stehen.
            if (res.matchResult && res.matchResult.seasonEnded) {
                this.playSound("abpfiff");
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.showSeasonEndCelebration(res.matchResult);
                return;
            }
            if (res.type === "season_change") return this.zeigeSaisonwechsel(res);

            if (res.type === "matchday" && res.matchResult) {
                this.playSound("pfiff_menue");
                this.showToast(`⚽ Spieltag ${state.currentMatchday - 1} wurde simuliert!`, "success");
            } else if (res.type === "cup" || res.type === "euro") {
                this.playSound("pfiff_menue");
                this.showToast(this.pokalabendMeldung(state, res), "info");
            } else {
                // Der volle Tagesbericht landet im Kalender, die Kurzfassung im Toast
                state.lastDayReport = {
                    date: res.day?.date,
                    dayOfWeek: res.day?.dayOfWeek,
                    title: res.day?.title,
                    messages: res.summary?.messages || []
                };
                const anzahl = state.lastDayReport.messages.length;
                const msg = state.lastDayReport.messages[0] || `${res.day?.title} abgeschlossen.`;
                // Das Datum steht klein darüber, der Text ohne vorangestelltes Zeichen
                const text = typeof this.meldungOhneZeichen === "function" ? this.meldungOhneZeichen(msg) : msg;
                this.showToast(`${text}${anzahl > 1 ? ` (+${anzahl - 1} weitere im Tagesbericht)` : ""}`, "info", 3500,
                    { titel: res.day?.date ? `Tagesbericht · ${res.day.date}` : "" });
            }

            this.renderHeader();
            this.renderCurrentTab();
            if (typeof state.saveToLocalStorage === "function") {
                state.saveToLocalStorage();
            }
            if (!this.pruefeEntlassung()) this.pruefeNeueAngebote();
        }
    }

    /**
     * Spult bis zum nächsten Spieltag im Kalender vor
     */
    handleCalendarAdvanceMatchday() {
        const state = this.app.state;
        const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine) 
            ? CalendarEngine 
            : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : null);

        if (!calendarEngine) return;
        if (this.pruefePflichtpostenVorStart(() => this.handleCalendarAdvanceMatchday())) return;

        const res = calendarEngine.advanceToNextMatchday(state);
        if (res.success) {
            const saisonEnde = (res.simulatedDays || [])
                .map(tag => tag.matchResult)
                .find(m => m && m.seasonEnded);
            if (saisonEnde) {
                this.playSound("abpfiff");
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.showSeasonEndCelebration(saisonEnde);
                return;
            }

            const count = res.simulatedDays?.length || 0;
            this.showToast(`⏩ ${count} Tage simuliert. Bereit für Spieltag ${state.currentMatchday}!`, "success");
            this.renderHeader();
            this.renderCurrentTab();
            if (typeof state.saveToLocalStorage === "function") {
                state.saveToLocalStorage();
            }
            this.pruefeNeueAngebote();
        }
    }

    showSeasonEndCelebration(endResult) {
        const modal = document.getElementById("modalSeasonEnd");
        const details = document.getElementById("seDetails");

        document.getElementById("seTitle").textContent = `🏆 Meister der Saison ${endResult.seasonYear}!`;
        document.getElementById("seSubtitle").textContent = `Herzlichen Glückwunsch an ${endResult.championClub.name}!`;

        // Bis zum Saisonwechsel bleibt die Sommerpause - wer jetzt noch
        // verlängern muss, steht hier mit Namen
        const state = this.app.state;
        const auslaufend = (typeof SeasonEngine !== "undefined" && typeof SeasonEngine.auslaufendZumWechsel === "function")
            ? SeasonEngine.auslaufendZumWechsel(state).sort((a, b) => (b.overall || 0) - (a.overall || 0)) : [];
        const wochen = Math.round((SeasonEngine.SOMMERPAUSE?.tage || 21) / 7);
        details.innerHTML = `
            ${this.saisonRueckblickHtml(state, endResult)}
            <div class="dash-card" style="margin-top:16px;">
                <h4>Ihr Saisonabschluss:</h4>
                <p>Ihr Verein belegt den <strong>${endResult.userRank}. Tabellenplatz</strong>.</p>
                <p>Die Saisonprämien wurden auf Ihr Vereinskonto überwiesen.</p>
            </div>
            <div class="dash-card se-pause">
                <h4><svg class="ico h-ico" aria-hidden="true"><use href="#i-sun"/></svg>Sommerpause: ${wochen} Wochen bis zum Saisonwechsel</h4>
                ${auslaufend.length ? `
                    <p>${auslaufend.length === 1 ? "Ein Vertrag endet" : `${auslaufend.length} Verträge enden`} zum Saisonwechsel. Wer bleiben soll, mit dem jetzt verlängern - andere Vereine werben schon:</p>
                    <div class="attention-namen se-namen">
                        ${auslaufend.map(p => `<button class="attention-name" data-player="${this.escapeHtml(String(p.id))}">${this.escapeHtml(p.name)} <small>${this.escapeHtml(p.pos || "")}</small></button>`).join("")}
                    </div>`
                    : `<p>Kein Vertrag läuft aus. Die Mannschaft hat frei, Sie planen die neue Saison.</p>`}
            </div>
        `;

        modal.style.display = "flex";
        this.playSound("erfolg");

        details.querySelectorAll(".attention-name").forEach(btn => btn.addEventListener("click", () => {
            modal.style.display = "none";
            this.switchTab("dashboard");
            this.showPlayerDetailsModal(this.resolvePlayerId(btn.dataset.player), { abschnitt: "vertrag" });
        }));

        const knopf = document.getElementById("btnStartNextSeason");
        knopf.innerHTML = `<span>In die Sommerpause</span><svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg>`;
        knopf.onclick = () => {
            modal.style.display = "none";
            this.switchTab("dashboard");
            this.renderHeader();
        };
        const sofort = document.getElementById("btnSkipSummerBreak");
        if (sofort) sofort.onclick = () => {
            const offen = SeasonEngine.auslaufendZumWechsel(state).filter(p => !p.vorvertrag).length;
            if (offen && typeof confirm === "function"
                && !confirm(`${offen} ${offen === 1 ? "Spieler geht" : "Spieler gehen"} dann ablösefrei. Trotzdem gleich in die neue Saison?`)) return;
            modal.style.display = "none";
            this.starteNeueSaison();
        };
    }

    /** Der Saisonrückblick (MeilensteinEngine.rueckblick) als Karte */
    saisonRueckblickHtml(state, endResult) {
        const ms = typeof MeilensteinEngine !== "undefined" ? MeilensteinEngine : null;
        const r = ms ? ms.rueckblick(state) : null;
        if (!r) return "";
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const kachel = (titel, wert, unter = "") => `<div class="rb-kachel"><span>${esc(titel)}</span><strong>${wert}</strong>${unter ? `<small>${unter}</small>` : ""}</div>`;
        const spiel = (s) => s ? `${esc(s.ergebnis)}` : "–";
        const kacheln = [
            kachel("Platz", r.platz ? `${r.platz}.` : `${endResult.userRank}.`, r.von ? `von ${r.von}${r.liga ? ` · ${esc(r.liga)}` : ""}` : ""),
            kachel("Bilanz", `${r.siege}-${r.remis}-${r.niederlagen}`, `${r.punkte ?? "–"} Punkte`),
            kachel("Tore", `${r.tore}:${r.gegentore}`, `${r.tore - r.gegentore >= 0 ? "+" : ""}${r.tore - r.gegentore}`),
            kachel("Torjäger", r.torjaeger[0] ? esc(r.torjaeger[0].name) : "–", r.torjaeger[0] ? `${r.torjaeger[0].tore} Tore` : ""),
            kachel("Bester Spieler", r.bester ? esc(r.bester.name) : "–", r.bester ? `Note ${r.bester.schnitt.toFixed(2).replace(".", ",")} in ${r.bester.spiele} Spielen` : ""),
            kachel("Höchster Ligasieg", spiel(r.hoechsterSieg), r.hoechsterSieg ? `${r.hoechsterSieg.heim ? "gegen" : "bei"} ${esc(r.hoechsterSieg.gegner)}` : ""),
            kachel("Bitterste Ligapleite", spiel(r.bittersteNiederlage), r.bittersteNiederlage ? `${r.bittersteNiederlage.heim ? "gegen" : "bei"} ${esc(r.bittersteNiederlage.gegner)}` : ""),
            kachel("Zuschauer", r.zuschauerSchnitt ? r.zuschauerSchnitt.toLocaleString("de-DE") : "–", r.zuschauerSchnitt ? "im Schnitt" : ""),
            kachel("Fanstimmung", `${r.fanStimmung} %`, r.fanStimmung >= 80 ? "Die Kurve ist begeistert" : (r.fanStimmung < 45 ? "Die Kurve murrt" : ""))
        ].join("");
        return `
            <div class="dash-card rb-karte">
                <h4>Saison ${r.saison} im Rückblick</h4>
                ${r.titel.length ? `<div class="rb-titel">${r.titel.map(t => `<span>🏆 ${esc(t)}</span>`).join("")}</div>` : ""}
                <div class="rb-raster">${kacheln}</div>
                ${r.meilensteine.length ? `<ul class="meilenstein-liste rb-meilensteine">${r.meilensteine.slice(0, 6).map(m => `<li><span aria-hidden="true">${esc(m.icon)}</span><span>${esc(m.text)}</span></li>`).join("")}</ul>` : ""}
            </div>`;
    }

    /** Tage bis zum Saisonwechsel - null außerhalb der Sommerpause */
    sommerpauseRest() {
        const cal = this.getCalendarEngine();
        return cal && typeof cal.sommerpauseRest === "function" && this.app?.state ? cal.sommerpauseRest(this.app.state) : null;
    }

    /** " in 12 Tagen" während der Sommerpause, sonst nichts */
    sommerpauseText() {
        const rest = this.sommerpauseRest();
        return rest === null ? "" : ` ${this.wannText(rest)}`;
    }

    /** Die Sommerpause überspringen: gleich zum Saisonwechsel */
    starteNeueSaison() {
        const state = this.app.state;
        return this.mitLadeanzeige("Die neue Saison wird vorbereitet …", () => {
            SeasonEngine.startNextSeason(state);
            this.zeigeSaisonwechsel({ neueSaison: state.seasonYear });
        }, "Verträge, Aufsteiger, Spielplan und Vorbereitung");
    }

    /** Nach dem Saisonwechsel: neue Saison, neue Vorbereitung */
    zeigeSaisonwechsel(res) {
        const state = this.app.state;
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.playSound("anpfiff");
        const saison = res?.neueSaison || state.seasonYear;
        if (this.frischLadenFaellig()) {
            this.ladeFrisch(saison);
            return;
        }
        this.beginneSaisonAnzeige(saison);
    }

    beginneSaisonAnzeige(saison) {
        this.showToast(`🔄 Saison ${saison} beginnt - die Vorbereitung läuft.`, "success", 6000);
        this.switchTab("dashboard");
        this.renderHeader();
    }

    /**
     * Frisch laden. Läuft das Spiel viele Saisons am Stück, ohne dass die
     * Seite neu lädt, wird es langsamer: Gemessen brauchte die zehnte Saison
     * rund das 1,45-Fache der ersten, ein frisch geladener Stand derselben
     * Saison dagegen nicht mehr als die erste. Die JavaScript-Engine sammelt
     * über die Zeit Rückmeldungen über die Datenformen an, und erst neu
     * geladene Skripte fangen damit von vorn an. Deshalb sichert das Spiel
     * nach jeweils FRISCH_NACH_SAISONS Saisonwechseln den Stand, lädt die
     * Seite neu und setzt die Karriere ohne Startbildschirm fort.
     */
    static FRISCH_NACH_SAISONS = 3;
    static FRISCH_SCHLUESSEL = "fmpro_frisch_fortsetzen";

    frischLadenFaellig() {
        if (typeof location === "undefined" || typeof location.reload !== "function" || typeof sessionStorage === "undefined") return false;
        this._saisonwechselOhneNeuladen = (this._saisonwechselOhneNeuladen || 0) + 1;
        return this._saisonwechselOhneNeuladen >= UIManager.FRISCH_NACH_SAISONS;
    }

    ladeFrisch(saison) {
        const state = this.app.state;
        this.zeigeLadeanzeige(`Saison ${saison} wird vorbereitet …`, "Das Spiel lädt sich einmal neu und bleibt dadurch flott.");
        const weiterOhne = () => { this.versteckeLadeanzeige(); this.beginneSaisonAnzeige(saison); };
        const gesichert = typeof state.sichereJetzt === "function" ? state.sichereJetzt() : false;
        (gesichert && typeof gesichert.then === "function" ? gesichert : Promise.resolve(gesichert)).then(ok => {
            // Ohne sichere Speicherung wird nicht neu geladen
            if (!ok) return weiterOhne();
            try {
                sessionStorage.setItem(UIManager.FRISCH_SCHLUESSEL, JSON.stringify({ platz: GameState.aktiverPlatz(), saison }));
            } catch (e) {
                return weiterOhne();
            }
            location.reload();
        }, weiterOhne);
    }

    /**
     * Beim Start: Kommt die Seite aus einem frischen Laden, geht es ohne
     * Startbildschirm in der Karriere weiter. Gibt zurück, ob das so ist.
     */
    nachFrischemLaden() {
        let merk = null;
        try {
            if (typeof sessionStorage === "undefined") return false;
            merk = JSON.parse(sessionStorage.getItem(UIManager.FRISCH_SCHLUESSEL) || "null");
            sessionStorage.removeItem(UIManager.FRISCH_SCHLUESSEL);
        } catch (e) {
            return false;
        }
        if (!merk || !merk.platz) return false;
        this.zeigeLadeanzeige(`Saison ${merk.saison || ""} wird vorbereitet …`.replace("  ", " "), "Der Spielstand wird geladen.");
        GameState.ladePlatz(merk.platz).then(state => {
            this.versteckeLadeanzeige();
            if (!state) {
                this.showStartScreen();
                return;
            }
            this.app.state = state;
            this.hideStartScreen();
            this.beginneSaisonAnzeige(merk.saison || state.seasonYear);
            this.renderCurrentTab();
        }, () => { this.versteckeLadeanzeige(); this.showStartScreen(); });
        return true;
    }

    /**
     * Globale Event Listeners binden
     */
    bindGlobalEvents() {
        // Spieltag starten / weiter button im Header
        document.getElementById("btnHeaderAdvance").onclick = () => {
            this.handleWeiter();
        };
        const tagKnopf = document.getElementById("btnHeaderTag");
        if (tagKnopf) tagKnopf.onclick = () => this.handleEinTag();

        // Dashboard Schnell-Aktionen
        const btnOpponent = document.getElementById("btnDashOpponentAnalysis");
        if (btnOpponent) {
            btnOpponent.onclick = () => {
                this.showOpponentAnalysisModal();
            };
        }

        // Taktikbesprechung schon vor dem Anpfiff - gilt auch fürs Sofort-Ergebnis
        const btnPlan = document.getElementById("btnDashMatchplan");
        if (btnPlan) {
            btnPlan.onclick = () => {
                const partie = this.heutigesTestspiel()?.partie || this.heutigesSpiel()?.partie;
                if (partie) this.showMatchplanModal(partie, null);
            };
        }

        const btnCloseOpp = document.getElementById("btnCloseOpponentAnalysis");
        if (btnCloseOpp) {
            btnCloseOpp.onclick = () => {
                document.getElementById("modalOpponentAnalysis").style.display = "none";
            };
        }

        const btnConfirmOpp = document.getElementById("btnConfirmOpponentAnalysis");
        if (btnConfirmOpp) {
            btnConfirmOpp.onclick = () => {
                document.getElementById("modalOpponentAnalysis").style.display = "none";
            };
        }

        // Zeit läuft nur noch über zwei Knöpfe: den Weiter-Knopf im Kopf, der
        // bis zum nächsten Termin springt, und einen Feinschritt im Kalender.
        // Vorher waren es fünf, und der im Kopf ging einen anderen Weg als die
        // anderen.
        const btnDashOpenCal = document.getElementById("btnDashOpenCalendar");
        if (btnDashOpenCal) {
            btnDashOpenCal.onclick = () => this.switchTab("calendar");
        }

        document.getElementById("btnUrlaub")?.addEventListener("click", () => this.zeigeUrlaub());
        const btnCalAdvanceDay = document.getElementById("btnCalendarAdvanceDay");
        if (btnCalAdvanceDay) {
            btnCalAdvanceDay.onclick = () => {
                this.handleCalendarAdvanceDay();
            };
        }

        // Postfach Toolbar Events
        const inboxSearch = document.getElementById("inboxSearchInput");
        if (inboxSearch) {
            inboxSearch.oninput = (e) => {
                this.inboxSearch = e.target.value;
                this.renderInbox();
            };
        }

        document.querySelectorAll("[data-inbox-filter]").forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll("[data-inbox-filter]").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.inboxFilter = btn.dataset.inboxFilter;
                this.renderInbox();
            };
        });

        const btnMarkAll = document.getElementById("btnInboxMarkAllRead");
        if (btnMarkAll) {
            btnMarkAll.onclick = () => {
                const newsEngine = (typeof NewsEngine !== 'undefined' && NewsEngine) 
                    ? NewsEngine 
                    : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : null);
                if (newsEngine && typeof newsEngine.markAllAsRead === 'function') {
                    newsEngine.markAllAsRead(this.app.state);
                }
                this.renderInbox();
                this.renderHeader();
                if (typeof this.app.state.saveToLocalStorage === "function") {
                    this.app.state.saveToLocalStorage();
                }
                this.showToast("Alle Nachrichten als gelesen markiert.", "success");
            };
        }

        // Beide Knöpfe pfeifen dasselbe Spiel an - das von heute. Vorher
        // holten sie sich die Partie des laufenden Spieltags aus dem
        // Spielplan und boten sie an, ganz gleich welcher Tag war.
        document.getElementById("btnDashLiveMatch").onclick = () => {
            if (!this.starteHeutigesSpiel(false)) this.meldeKeinSpielHeute();
        };

        document.getElementById("btnDashInstantSim").onclick = () => {
            if (!this.starteHeutigesSpiel(true)) this.meldeKeinSpielHeute();
        };

        // Auto Lineup Button
        // Beste 11: erst die Formation, die zum verfuegbaren Kader passt, dann
        // die beste Elf darin
        document.getElementById("btnAutoLineup").onclick = () => {
            const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
            const vorher = userClub.formation;
            const wahl = GameState.findBestFormation(userClub, this.app.state.players);
            if (wahl && wahl.key) userClub.formation = wahl.key;
            if (this.formationEditMode && userClub.formation !== vorher) {
                this.resetFormationDraft();
            }
            GameState.autoSetLineupForClub(userClub, this.app.state.players);
            this.selectedPitchSlot = null;
            this.playSound("click");
            this.renderTactics();

            const name = GameState.getFormationConfig(userClub.formation).name || userClub.formation;
            if (!wahl) {
                this.showToast("Zu wenige einsatzfähige Spieler - die Formation bleibt.", "warning");
            } else if (userClub.formation !== vorher) {
                const plus = wahl.bisher && wahl.bisher.wert > 0
                    ? ` (+${((wahl.wert / wahl.bisher.wert - 1) * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} % Stärke)`
                    : "";
                this.showToast(`Umgestellt auf ${name}: Diese Formation passt am besten zu deinen verfügbaren Spielern${plus}.`, "success", 5000);
            } else {
                this.showToast(`${name} passt bereits am besten zum Kader - die beste Elf steht.`, "success");
            }
        };

        // Formation Switcher
        document.getElementById("selectFormation").onchange = (e) => {
            const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
            userClub.formation = e.target.value;

            // Beim Wechsel den Editor-Entwurf mitziehen und die Elf neu ordnen
            if (this.formationEditMode) {
                this.resetFormationDraft();
            }
            GameState.autoSetLineupForClub(userClub, this.app.state.players);
            this.selectedPitchSlot = null;
            this.renderTactics();
        };

        // Formations-Editor
        const btnFormationEdit = document.getElementById("btnFormationEdit");
        if (btnFormationEdit) {
            btnFormationEdit.onclick = () => this.toggleFormationEditMode();
        }

        const btnFormationSave = document.getElementById("btnFormationSave");
        if (btnFormationSave) {
            btnFormationSave.onclick = () => this.saveCustomFormation();
        }

        const btnFormationReset = document.getElementById("btnFormationReset");
        if (btnFormationReset) {
            btnFormationReset.onclick = () => this.resetFormationDraft();
        }

        const btnFormationDelete = document.getElementById("btnFormationDelete");
        if (btnFormationDelete) {
            btnFormationDelete.onclick = () => this.deleteCustomFormation();
        }

        // Spiegeln und Feinjustage - am Handy trifft der Finger das Raster schwer
        const btnFormationSpiegeln = document.getElementById("btnFormationSpiegeln");
        if (btnFormationSpiegeln) btnFormationSpiegeln.onclick = () => this.spiegleFormation();
        document.querySelectorAll("[data-schieben]").forEach(btn => {
            btn.onclick = () => this.schiebeSlot(btn.dataset.schieben);
        });

        const inputFormationName = document.getElementById("inputFormationName");
        if (inputFormationName) {
            inputFormationName.oninput = () => { inputFormationName.dataset.touched = "1"; };
        }

        // Position eines einzelnen Slots manuell festlegen
        const selectSlotPosition = document.getElementById("selectSlotPosition");
        if (selectSlotPosition) {
            selectSlotPosition.onchange = (e) => {
                if (!this.formationEditMode || this.selectedPitchSlot === null) return;
                const slot = this.formationDraft?.[this.selectedPitchSlot];
                if (!slot) return;

                const posEngine = this.getPositionEngine();
                slot.pos = e.target.value;
                slot.manualPos = true;
                slot.role = posEngine?.POSITION_META?.[slot.pos]?.name || slot.pos;
                this.formationDirty = true;
                this.renderTactics();
            };
        }

        // Die Taktik-Anweisungen, Rollen und Formen binden sich beim Zeichnen
        // selbst (renderTaktikPanels) - es sind zu viele fuer feste IDs.

        // Rollen Dropdowns
        ["roleCaptain", "rolePenalty", "roleFreeKick", "roleCorner"].forEach(id => {
            document.getElementById(id).onchange = (e) => {
                const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
                const roleMap = { roleCaptain: "captain", rolePenalty: "penaltyTaker", roleFreeKick: "freeKickTaker", roleCorner: "cornerTaker" };
                // IDs von Jugendspielern sind Texte - parseInt machte daraus NaN
                const wert = e.target.value;
                const spieler = wert === "" ? null
                    : this.app.state.players.find(p => String(p.id) === wert);
                userClub.roles[roleMap[id]] = spieler ? spieler.id : null;
                if (typeof this.app.state.saveToLocalStorage === "function") this.app.state.saveToLocalStorage();
            };
        });

        // Filter im Kader Tab
        document.querySelectorAll("[data-filter-pos]").forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll("[data-filter-pos]").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                this.renderSquad(btn.dataset.filterPos);
            };
        });

        // Fixtures & Standings Toggle
        document.getElementById("btnToggleTable").onclick = () => {
            document.getElementById("btnToggleTable").classList.add("active");
            document.getElementById("btnToggleFixtures").classList.remove("active");
            document.getElementById("viewStandings").style.display = "block";
            document.getElementById("viewFixtures").style.display = "none";
        };

        document.getElementById("btnToggleFixtures").onclick = () => {
            document.getElementById("btnToggleFixtures").classList.add("active");
            document.getElementById("btnToggleTable").classList.remove("active");
            document.getElementById("viewFixtures").style.display = "block";
            document.getElementById("viewStandings").style.display = "none";
            this.currentFixtureMatchday = this.app.state.currentMatchday;
            this.renderFixturesAndStandings();
        };

        document.getElementById("btnPrevMatchday").onclick = () => {
            if (this.currentFixtureMatchday > 1) {
                this.currentFixtureMatchday--;
                this.renderFixturesAndStandings();
            }
        };

        document.getElementById("btnNextMatchday").onclick = () => {
            const state = this.app.state;
            const activeComp = this.activeCompetitionId || state.activeCompetitionId || this.getUserLeagueId(state);
            const rounds = this.getScheduleForLeague(state, activeComp).length || state.totalMatchdays;
            if (this.currentFixtureMatchday < rounds) {
                this.currentFixtureMatchday++;
                this.renderFixturesAndStandings();
            }
        };

        const compSelect = document.getElementById("selectCompetitionView");
        if (compSelect) {
            compSelect.onchange = (e) => {
                this.activeCompetitionId = e.target.value;
                this.renderFixturesAndStandings();
            };
        }

        // Transfer, Scouting und Leihen als Unterreiter
        const transferAnsicht = (knopf, ansicht) => {
            ["btnSubTransfersMarket", "btnSubTransfersScouting", "btnSubTransfersLoans", "btnSubTransfersSD", "btnSubTransfersListe"].forEach(id =>
                document.getElementById(id)?.classList.toggle("active", id === knopf));
            ["viewTransferMarket", "viewScoutingCenter", "viewLoans", "viewSportdirektor", "viewBeobachtung"].forEach(id =>
                id === ansicht ? DOM.show(id) : DOM.hide(id));
        };
        document.getElementById("btnSubTransfersMarket")?.addEventListener("click", () => {
            transferAnsicht("btnSubTransfersMarket", "viewTransferMarket");
        });

        document.getElementById("btnSubTransfersScouting")?.addEventListener("click", () => {
            transferAnsicht("btnSubTransfersScouting", "viewScoutingCenter");
            this.renderTransfers();
        });

        document.getElementById("btnSubTransfersLoans")?.addEventListener("click", () => {
            transferAnsicht("btnSubTransfersLoans", "viewLoans");
            this.renderLeihen();
        });

        document.getElementById("btnSubTransfersSD")?.addEventListener("click", () => {
            transferAnsicht("btnSubTransfersSD", "viewSportdirektor");
            this.renderSportdirektor();
        });

        document.getElementById("btnSubTransfersListe")?.addEventListener("click", () => {
            transferAnsicht("btnSubTransfersListe", "viewBeobachtung");
            this.renderBeobachtungsliste();
        });

        // Scout Auftrag absenden
        document.getElementById("btnStartScoutAssignment")?.addEventListener("click", () => {
            const pos = document.getElementById("scoutPosSelect")?.value || "ALL";
            const maxAge = parseInt(document.getElementById("scoutAgeSelect")?.value || "25", 10);
            // Der Auftrag wird in Sternen erteilt und in eine Stärke übersetzt
            const minStars = parseFloat(document.getElementById("scoutOvrSelect")?.value || "3.5");
            const engine = this.getRatingEngine();
            const minOvr = engine ? engine.overallForStars(minStars, this.starContext()) : 75;

            const land = document.getElementById("scoutLandSelect")?.value || "ALL";
            const res = ScoutingEngine.startAssignment(this.app.state, {
                position: pos, maxAge: maxAge, minOverall: minOvr, minStars: minStars, land
            });
            if (res.success) {
                this.playSound("click");
                this.showToast("🔭 Scout erfolgreich für die Suche entsandt!", "success");
                this.renderTransfers();
            } else {
                this.showToast(res.error || "Auftrag konnte nicht gestartet werden", "warning");
            }
        });

        // Jugendakademie ausbauen
        document.getElementById("btnUpgradeYouthAcademy")?.addEventListener("click", () => {
            const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
            if (!userClub) return;

            this.starteBau("youthCenter", "ausbau");
        });

        // Transfer Filter
        document.getElementById("tfSearch")?.addEventListener("input", () => this.renderTransfers());
        document.getElementById("tfPosFilter")?.addEventListener("change", () => this.renderTransfers());
        document.getElementById("tfRatingFilter")?.addEventListener("change", () => this.renderTransfers());
        ["tfAlterFilter", "tfPotFilter", "tfWertFilter", "tfVertragFilter", "tfLandFilter", "tfSortierung", "tfNurGescoutet"].forEach(id =>
            document.getElementById(id)?.addEventListener("change", () => this.renderTransfers()));
        document.getElementById("btnTfZuruecksetzen")?.addEventListener("click", () => {
            const s = document.getElementById("tfSearch");
            if (s) s.value = "";
            ["tfPosFilter", "tfRatingFilter", "tfAlterFilter", "tfPotFilter", "tfWertFilter", "tfVertragFilter", "tfLandFilter", "tfSortierung"].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.selectedIndex = 0;
            });
            const gescoutet = document.getElementById("tfNurGescoutet");
            if (gescoutet) gescoutet.checked = false;
            this.renderTransfers();
        });
        // Leihmarkt
        ["lmPosFilter", "lmAlterFilter", "lmStaerkeFilter", "lmRolleFilter", "lmKostenFilter"].forEach(id =>
            document.getElementById(id)?.addEventListener("change", () => this.renderLeihen()));

        // Training: Jede Änderung des Managers ist ein Veto gegen den Stab und
        // gilt für einige Tage - danach übernimmt der Trainerstab wieder.
        const vetoEinlegen = () => {
            const staff = this.getCoachingStaffEngine();
            const focus = document.querySelector('input[name="trainFocus"]:checked')?.value;
            const intensity = document.querySelector('input[name="trainIntensity"]:checked')?.value;
            if (!staff) {
                this.app.state.trainingSettings.focus = focus;
                this.app.state.trainingSettings.intensity = intensity;
                return;
            }
            const veto = staff.setManagerVeto(this.app.state, focus, intensity);
            this.showToast(
                `Ihre Vorgabe gilt für ${veto.daysRemaining} Tage: ${staff.focusLabel(veto.focus)}, ${staff.intensityLabel(veto.intensity)}.`,
                "success");
            this.renderTraining();
        };

        document.querySelectorAll('input[name="trainFocus"]').forEach(r => {
            r.addEventListener("change", vetoEinlegen);
        });

        document.querySelectorAll('input[name="trainIntensity"]').forEach(r => {
            r.addEventListener("change", vetoEinlegen);
        });

        document.getElementById("btnStaffTakeOver")?.addEventListener("click", () => {
            const staff = this.getCoachingStaffEngine();
            if (!staff) return;
            staff.clearManagerVeto(this.app.state);
            this.playSound("click");
            this.showToast("Der Trainerstab übernimmt die Trainingsplanung wieder.", "success");
            this.renderTraining();
        });

        // Quick Link Buttons
        document.getElementById("btnDashFullTable")?.addEventListener("click", () => {
            this.switchTab("fixtures");
        });
        document.getElementById("btnDashFullInbox")?.addEventListener("click", () => {
            this.switchTab("inbox");
        });

        // Settings / Save / Load / Export
        document.getElementById("btnSaveLocal").onclick = () => {
            const st = this.app.state;
            const vorgang = typeof st.sichereJetzt === "function" ? st.sichereJetzt() : Promise.resolve(st.saveToLocalStorage(null, true));
            vorgang.then(ok => {
                if (ok) {
                    this.showToast("Spielstand erfolgreich im Browser gespeichert!", "success");
                    this.renderSpeicherInfo();
                } else {
                    this.showToast(st._saveFehler || "Fehler beim Speichern des Spielstands!", "error");
                }
            });
        };

        document.getElementById("btnExportJson").onclick = () => {
            // Als Blob statt als data:-Adresse - die stößt bei mehreren
            // Megabyte in manchen Browsern an ihre Längengrenze
            const blob = new Blob([this.app.state.exportToJson()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", url);
            downloadAnchor.setAttribute("download", this.app.state.getExportFileName ? this.app.state.getExportFileName() : `Viererkette_Saison_${this.app.state.seasonYear}_Spieltag_${this.app.state.currentMatchday}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            this.showToast("Spielstand-Datei (.json) heruntergeladen!", "info");
        };

        document.getElementById("fileImportJson").onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => this.importiereSpielstand(evt.target.result);
            reader.readAsText(file);
            e.target.value = "";
        };

        document.getElementById("btnNewGamePrompt").onclick = () => {
            this.showNewGameModal();
        };

        // Der Ton ist eine Vorliebe des Geräts, nicht des Spielstands
        const lies = (key) => { try { return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null; } catch (e) { return null; } };
        const merke = (key, wert) => { try { if (typeof localStorage !== "undefined") localStorage.setItem(key, wert); } catch (e) { /* gilt dann nur für diese Sitzung */ } };
        if (lies("fm_sound") === "aus") this.soundEnabled = false;
        this.musikAn = lies("fm_musik") !== "aus";
        const vol = parseInt(lies("fm_musik_vol") || "", 10);
        this.musikLautstaerke = Number.isFinite(vol) ? Math.max(0, Math.min(100, vol)) / 100 : 0.6;
        document.getElementById("btnToggleSound").innerHTML = this.soundKnopfHtml();
        document.getElementById("btnToggleSound").onclick = () => {
            this.soundEnabled = !this.soundEnabled;
            document.getElementById("btnToggleSound").innerHTML = this.soundKnopfHtml();
            merke("fm_sound", this.soundEnabled ? "an" : "aus");
            // Ohne Effekte auch keine Kulisse
            if (!this.soundEnabled && typeof this.stopCrowdAmbience === "function") this.stopCrowdAmbience({ ohneMusik: true });
        };
        const musikKnopf = document.getElementById("btnToggleMusik");
        if (musikKnopf) {
            musikKnopf.innerHTML = this.musikKnopfHtml();
            musikKnopf.onclick = () => {
                this.musikAn = !this.musikAn;
                musikKnopf.innerHTML = this.musikKnopfHtml();
                merke("fm_musik", this.musikAn ? "an" : "aus");
                this._tonFrei = true;
                this.pruefeMusik();
            };
        }
        const regler = document.getElementById("musikLautstaerke");
        if (regler) {
            regler.value = String(Math.round(this.musikLautstaerke * 100));
            regler.oninput = () => {
                this.musikLautstaerke = Math.max(0, Math.min(100, parseInt(regler.value, 10) || 0)) / 100;
                merke("fm_musik_vol", String(Math.round(this.musikLautstaerke * 100)));
                if (this._klang) this._klang.setzeMusikLautstaerke(this.musikLautstaerke);
            };
        }
        this.richteTonEin();
    }
}

if (typeof window !== "undefined") {
    window.UIManager = UIManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIManager };
    // Die ausgelagerten Teile hängen sich an die Klasse - im Browser lädt sie
    // index.html der Reihe nach, unter Node holen wir sie hier dazu
    ["./uiAssistent.js", "./uiKader.js", "./uiTaktik.js", "./uiWettbewerbe.js", "./uiTraining.js", "./uiFinanzen.js", "./uiVerein.js", "./uiPostfach.js", "./uiDialoge.js", "./uiKarriere.js",
        "./uiSpielfeld.js", "./uiVorbereitung.js", "./uiTransfers.js", "./uiAkten.js", "./uiSeiten.js", "./uiProfil.js", "./uiProfilLaufbahn.js", "./uiAngebot.js", "./uiVereinSeite.js", "./uiSpielerdatenbank.js", "./uiLivespiel.js", "./uiLiveKacheln.js", "./uiLiveDarstellung.js", "./uiSpielbericht.js", "./uiMeldungen.js", "./uiSpeicher.js", "./uiEinstieg.js", "./uiNational.js", "./uiNavigation.js"]
        .forEach(teil => require(teil));
}
