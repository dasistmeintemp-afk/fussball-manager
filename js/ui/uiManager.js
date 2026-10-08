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
        this.createToastContainer();
        this.bindNavigation();
        this.bindGlobalEvents();
        this.bindStartScreenEvents();
        this.bindWizardEvents();
        this.bindModalDismiss();
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
            schliesse(offen[offen.length - 1]);
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
        if (abs >= 1e6) return `${vz}${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1).replace(".", ",")} Mio. €`;
        if (abs >= 1e3) return `${vz}${Math.round(abs / 1e3)} Tsd. €`;
        return `${vz}${Math.round(abs)} €`;
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
                text: "Drei Sterne sind ein solider Erstligaprofi. Ein Bundesliga-Star hat fünf, ein Landesligaspieler einen halben.",
                hinweisVerein: "Sterne nach Weltmaßstab: drei Sterne sind ein solider Erstligaprofi."
            }
        };
    }

    /** Weltmaßstab: drei Sterne bei einer Stärke von 70 */
    static get STERN_WELT_BEZUG() { return 140; }

    /** Beschriftung der Tabellenzonen (Europapokal, Auf- und Abstieg). */
    static get ZONEN() {
        return {
            ucl: "Champions League",
            uel: "Europa League",
            uecl: "Conference League",
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
     * Erstellt den Toast-Container im DOM
     */
    createToastContainer() {
        if (!document.getElementById("toastContainer")) {
            const tc = document.createElement("div");
            tc.id = "toastContainer";
            tc.className = "toast-container";
            document.body.appendChild(tc);
        }
    }

    /**
     * Zeigt eine Toast-Meldung an
     */
    showToast(message, type = "info", duration = 3500) {
        const tc = document.getElementById("toastContainer") || document.body;
        const toast = document.createElement("div");
        toast.className = `toast-item ${type}`;
        
        let icon = "ℹ️";
        if (type === "success") icon = "✅";
        if (type === "error") icon = "⚠️";
        if (type === "warning") icon = "🔔";

        toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
        tc.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(50px)";
            toast.style.transition = "all 0.3s ease";
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /**
     * Startbildschirm anzeigen & Savegame-Info rendern
     */
    showStartScreen() {
        const overlay = document.getElementById("startScreenOverlay");
        if (overlay) overlay.style.display = "flex";
        this.renderStartScreenSaveInfo();
    }

    /**
     * Startbildschirm ausblenden
     */
    hideStartScreen() {
        const overlay = document.getElementById("startScreenOverlay");
        if (overlay) overlay.style.display = "none";

        // Wer mitten in einer offenen Entlassung gespeichert hat, landet nicht
        // stillschweigend wieder im Verein, aus dem er geflogen ist.
        const state = this.app?.state;
        if (state && state.careerOver) {
            const career = this.getCareerEngine();
            if (career) this.zeigeZeugnis(career.zeugnis(state));
            return;
        }
        this.pruefeEntlassung();
    }

    /**
     * Startbildschirm-Events binden
     */
    bindStartScreenEvents() {
        document.getElementById("btnStartNewGame")?.addEventListener("click", () => {
            this.showNewGameModal();
        });

        // Weiter mit der zuletzt gespielten Karriere
        document.getElementById("btnStartContinueGame")?.addEventListener("click", () => {
            const platz = GameState.juengsterPlatz();
            if (platz) this.ladeSpielstand(platz);
        });

        document.getElementById("startFileInput")?.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => this.importiereSpielstand(evt.target.result);
            reader.readAsText(file);
            // Dieselbe Datei soll sich ein zweites Mal wählen lassen
            e.target.value = "";
        });

        document.getElementById("btnStartAbout")?.addEventListener("click", () => this.zeigeKurzanleitung());

        document.getElementById("btnCloseAboutModal")?.addEventListener("click", () => {
            document.getElementById("modalAboutGame").style.display = "none";
        });
        document.getElementById("btnDismissAbout")?.addEventListener("click", () => {
            document.getElementById("modalAboutGame").style.display = "none";
        });
    }

    /**
     * Modal: Setup-Assistent (Neues Spiel starten)
     */
    showNewGameModal() {
        const modal = document.getElementById("modalNewGame");
        if (!modal) {
            console.error("Modal #modalNewGame wurde nicht gefunden.");
            this.showToast("Der Karriere-Assistent konnte nicht geöffnet werden.", "error");
            return;
        }

        // Die neue Karriere bekommt einen eigenen Platz und überschreibt
        // keine laufende - sind alle belegt, wird vorher gefragt
        this.zielPlatzNeueKarriere = this.waehleZielPlatz("Die neue Karriere");
        if (!this.zielPlatzNeueKarriere) return;

        modal.style.display = "flex";
        this.wizardStep = 1;
        this.wizardSelectedClubId = null;
        this.wizardSelectedLeagueId = this.wizardSelectedLeagueId || "de_liga_1";
        this.resetWizardClubFilters();
        this.waehleSchwierigkeit(document.getElementById("selectDifficulty")?.value || "normal");
        // Erklärungen für den ersten Einstieg: an, solange es keine andere
        // Karriere gibt - wer schon eine hat, kennt das Spiel meist
        const erkl = document.getElementById("inputErklaerungen");
        if (erkl) erkl.checked = GameState.speicherplaetze().every(p => !p.zusammenfassung);
        this.renderWizardStep();
    }

    /** Schwierigkeitskarten und das (verborgene) Auswahlfeld gleichziehen */
    waehleSchwierigkeit(wert) {
        const gueltig = ["easy", "normal", "hard"].includes(wert) ? wert : "normal";
        const select = document.getElementById("selectDifficulty");
        if (select) select.value = gueltig;
        document.querySelectorAll(".difficulty-card").forEach(karte => {
            const an = karte.dataset.diff === gueltig;
            karte.classList.toggle("selected", an);
            if (typeof karte.setAttribute === "function") karte.setAttribute("aria-checked", an ? "true" : "false");
        });
        this.renderWizardSummary();
    }

    /** Beschriftung des Weiter-Knopfs: "Weiter" oder im letzten Schritt "Karriere starten" */
    setzeWizardWeiter(btn, letzterSchritt) {
        if (!btn) return;
        btn.innerHTML = `<span>${letzterSchritt ? "Karriere starten" : "Weiter"}</span><svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg>`;
    }

    /**
     * Die linke Leiste des Assistenten: was bisher gewählt ist. So sieht man
     * in Schritt drei noch, mit welchem Namen und in welcher Liga man antritt.
     */
    renderWizardSummary() {
        const el = document.getElementById("wizardSummary");
        if (!el) return;
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        const name = (document.getElementById("inputManagerName")?.value || "").trim();
        const herkunft = document.getElementById("inputManagerNationality")?.value || "";
        const stufe = { easy: "Leicht", normal: "Normal", hard: "Schwer" }[document.getElementById("selectDifficulty")?.value] || "Normal";

        const teams = this.getWizardTeams();
        const liga = this.wizardSelectedLeagueId
            ? this.getWizardLeagues(teams).find(l => l.id === this.wizardSelectedLeagueId)
            : null;
        const club = this.wizardSelectedClubId
            ? teams.find(c => String(c.id) === String(this.wizardSelectedClubId))
            : null;

        el.innerHTML = `
            <div class="ws-title">Deine Karriere</div>
            <div class="ws-row"><span class="ws-label">Manager</span><span class="ws-val">${name ? esc(name) : "–"}</span></div>
            <div class="ws-row"><span class="ws-label">Herkunft</span><span class="ws-val">${esc(herkunft) || "–"}</span></div>
            <div class="ws-row"><span class="ws-label">Stufe</span><span class="ws-val">${stufe}</span></div>
            <div class="ws-row"><span class="ws-label">Liga</span><span class="ws-val">${liga ? `${liga.flag} ${esc(liga.shortName)}` : "–"}</span></div>
            <div class="ws-club${club ? "" : " ws-leer"}">
                ${club ? this.wappenHtml(club, "crest-md") : '<span class="crest crest-md crest-leer" aria-hidden="true">?</span>'}
                <span class="ws-club-text">
                    <span class="ws-label">Verein</span>
                    <span class="ws-val">${club ? esc(club.name) : "noch offen"}</span>
                </span>
            </div>
        `;
    }

    /**
     * Setzt die Filter der Vereinsauswahl im Assistenten zurück
     */
    resetWizardClubFilters() {
        const searchInput = document.getElementById("filterClubSearch");
        const sortSelect = document.getElementById("filterClubSort");
        const difficultySelect = document.getElementById("filterClubDifficulty");
        const leagueSelect = document.getElementById("filterClubLeague");

        if (searchInput) searchInput.value = "";
        if (sortSelect) sortSelect.value = "strength_desc";
        if (difficultySelect) difficultySelect.value = "all";
        // Die Liga bleibt: sie ist die Entscheidung aus Schritt zwei und kein Filter
        if (leagueSelect && this.wizardSelectedLeagueId) leagueSelect.value = this.wizardSelectedLeagueId;
    }

    /**
     * Alle wählbaren Vereine der Spielwelt.
     *
     * Die Auswahl umfasst inzwischen 218 Vereine aus fünf Ländern - von der
     * Champions-League-Anwärterin bis zum Landesligisten. Die Welt wird dabei
     * genau einmal erzeugt und später unverändert vom Karrierestart
     * übernommen: der gewählte Verein hat also exakt den gezeigten Kader.
     */
    getWizardTeams() {
        const gameState = (typeof GameState !== "undefined" && GameState)
            ? GameState
            : ((typeof window !== "undefined" && window.GameState) ? window.GameState : null);

        if (gameState && typeof gameState.getSelectableClubs === "function") {
            try {
                const clubs = gameState.getSelectableClubs();
                if (Array.isArray(clubs) && clubs.length > 0) return clubs;
            } catch (err) {
                console.error("[Wizard] Weltgenerierung fehlgeschlagen, nutze Startdaten:", err);
            }
        }

        return Array.isArray(window.INITIAL_TEAMS_DATA)
            ? window.INITIAL_TEAMS_DATA
            : (typeof INITIAL_TEAMS_DATA !== "undefined" && Array.isArray(INITIAL_TEAMS_DATA) ? INITIAL_TEAMS_DATA : []);
    }

    /**
     * Alle Ligen der Spielwelt mit ihren Kennzahlen.
     *
     * Grundlage sind die Ligadaten; die Vereinszahl kommt aus der tatsächlich
     * erzeugten Welt, damit im Assistenten keine Wunschzahl steht.
     */
    getWizardLeagues(teams) {
        const ligen = (typeof LEAGUES_DATA !== "undefined" && Array.isArray(LEAGUES_DATA))
            ? LEAGUES_DATA
            : (Array.isArray(window.LEAGUES_DATA) ? window.LEAGUES_DATA : []);
        const laender = (typeof COUNTRIES_DATA !== "undefined" && Array.isArray(COUNTRIES_DATA))
            ? COUNTRIES_DATA
            : (Array.isArray(window.COUNTRIES_DATA) ? window.COUNTRIES_DATA : []);

        const anzahl = new Map();
        (Array.isArray(teams) ? teams : []).forEach(club => {
            if (!club.leagueId) return;
            anzahl.set(club.leagueId, (anzahl.get(club.leagueId) || 0) + 1);
        });

        // Ohne Ligadaten bleiben immerhin die Ligen der geladenen Vereine
        if (ligen.length === 0) {
            const ausVereinen = new Map();
            (Array.isArray(teams) ? teams : []).forEach(club => {
                if (!club.leagueId || ausVereinen.has(club.leagueId)) return;
                ausVereinen.set(club.leagueId, {
                    id: club.leagueId,
                    name: club.leagueName || club.leagueId,
                    shortName: club.leagueName || club.leagueId,
                    level: club.level || 1,
                    countryId: club.countryId || "de",
                    countryName: "",
                    flag: "🏳️",
                    clubCount: 0
                });
            });
            const liste = [...ausVereinen.values()];
            liste.forEach(l => { l.clubCount = anzahl.get(l.id) || 0; });
            return liste.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
        }

        const landInfo = (id) => laender.find(c => c.id === id) || null;

        return ligen.map(liga => {
            const land = landInfo(liga.countryId);
            return {
                id: liga.id,
                name: liga.name,
                shortName: liga.shortName || liga.name,
                level: liga.level || 1,
                tier: liga.tier || "professional",
                countryId: liga.countryId,
                countryName: land?.name || liga.countryId,
                countryReputation: land?.reputation || 0,
                flag: land?.flag || "🏳️",
                matchdays: liga.matchdays,
                teamCount: liga.teamCount,
                clubCount: anzahl.get(liga.id) || liga.teamCount || 0,
                pointsPerWin: liga.pointsPerWin ?? 3,
                pointsPerDraw: liga.pointsPerDraw ?? 1,
                europeanSpots: liga.europeanSpots || null,
                promotionTo: liga.promotionTo || null,
                promotionSpots: liga.promotionSpots || null,
                relegationTo: liga.relegationTo || null
            };
        }).sort((a, b) =>
            // Deutschland zuerst - dort liegt die ganze Ligapyramide bis zur
            // Landesliga, der Rest folgt nach Ansehen des Landes
            (a.countryId === "de" ? 0 : 1) - (b.countryId === "de" ? 0 : 1)
            || (b.countryReputation - a.countryReputation)
            || a.countryName.localeCompare(b.countryName)
            || (a.level - b.level)
        );
    }

    /** Bezeichnung der Spielklasse */
    wizardTierLabel(tier) {
        if (tier === "semi-pro") return "Halbprofis";
        if (tier === "amateur") return "Amateurliga";
        return "Profiliga";
    }

    /**
     * Ligaauswahl in Schritt 2: alle Ligen, nach Ländern gruppiert.
     *
     * Vorher stand hier eine fest verdrahtete Karte mit der Bundesliga, obwohl
     * die Spielwelt zwölf Ligen kennt - man konnte also nichts auswählen und
     * bekam trotzdem in Schritt drei sämtliche Vereine aller Ligen angeboten.
     */
    renderWizardLeagues() {
        const grid = document.getElementById("leaguePickGrid");
        const detail = document.getElementById("leagueDetailCard");
        if (!grid) return;

        const teams = this.getWizardTeams();
        const ligen = this.getWizardLeagues(teams);
        if (ligen.length === 0) {
            grid.innerHTML = `<div class="text-muted" style="padding:16px;">Keine Ligadaten gefunden.</div>`;
            return;
        }

        if (!ligen.some(l => l.id === this.wizardSelectedLeagueId)) {
            this.wizardSelectedLeagueId = ligen[0].id;
        }

        // Nach Ländern gruppieren, damit die Pyramide erkennbar bleibt
        const gruppen = [];
        ligen.forEach(liga => {
            let gruppe = gruppen.find(g => g.countryId === liga.countryId);
            if (!gruppe) {
                gruppe = { countryId: liga.countryId, name: liga.countryName, flag: liga.flag, ligen: [] };
                gruppen.push(gruppe);
            }
            gruppe.ligen.push(liga);
        });
        gruppen.forEach(g => g.ligen.sort((a, b) => a.level - b.level));

        const ico = (name) => `<svg class="ico" aria-hidden="true"><use href="#${name}"/></svg>`;
        grid.innerHTML = gruppen.map(gruppe => `
            <section class="league-country-group">
                <div class="league-country-title">
                    <span class="lc-flag">${gruppe.flag}</span>
                    <span class="lc-name">${this.escapeHtml(gruppe.name)}</span>
                    <span class="lc-count">${gruppe.ligen.length} ${gruppe.ligen.length === 1 ? "Liga" : "Ligen"}</span>
                </div>
                <div class="league-pick-row">
                    ${gruppe.ligen.map(liga => `
                        <button type="button"
                                class="league-pick-card${liga.id === this.wizardSelectedLeagueId ? " selected" : ""}"
                                data-league="${this.escapeHtml(liga.id)}" data-tier="${this.escapeHtml(liga.tier)}">
                            <span class="lp-level" title="${liga.level}. Spielklasse">${liga.level}</span>
                            <span class="lp-body">
                                <strong class="lp-name">${this.escapeHtml(liga.shortName)}</strong>
                                <span class="lp-meta">${liga.clubCount} Vereine · ${this.wizardTierLabel(liga.tier)}</span>
                            </span>
                            <span class="lp-check">${ico("i-check")}</span>
                        </button>
                    `).join("")}
                </div>
            </section>
        `).join("");

        grid.querySelectorAll(".league-pick-card").forEach(btn => {
            btn.addEventListener("click", () => this.selectWizardLeague(btn.dataset.league));
        });

        if (!detail) return;

        const liga = ligen.find(l => l.id === this.wizardSelectedLeagueId) || ligen[0];
        const plaetze = (liste) => {
            if (!Array.isArray(liste) || !liste.length) return "";
            return liste.length > 1 && liste[liste.length - 1] - liste[0] === liste.length - 1
                ? `Platz ${liste[0]}–${liste[liste.length - 1]}`
                : `Platz ${liste.join(", ")}`;
        };
        const zeilen = [];
        if (liga.europeanSpots) {
            const e = liga.europeanSpots;
            if (e.championsLeague?.length) zeilen.push(["Champions League", plaetze(e.championsLeague), "ucl"]);
            if (e.europaLeague?.length) zeilen.push(["Europa League", plaetze(e.europaLeague), "uel"]);
            if (e.conferenceLeague?.length) zeilen.push(["Conference League", plaetze(e.conferenceLeague), "uecl"]);
        }
        const po = typeof PlayoffEngine !== "undefined" ? PlayoffEngine : null;
        if (liga.promotionTo) {
            const ziel = ligen.find(l => l.id === liga.promotionTo);
            zeilen.push([`Aufstieg${ziel ? ` in die ${ziel.shortName}` : ""}`, plaetze(po ? po.direktePlaetze(liga) : (liga.promotionSpots || [1])), "auf"]);
            const f = po?.FORMATE?.[liga.id];
            if (f) zeilen.push([f.name, plaetze(f.art === "relegation" ? [f.unten] : f.plaetze), "po"]);
        }
        Object.keys(po?.FORMATE || {}).forEach(id => {
            const f = po.FORMATE[id];
            if (f.oben && f.oben.liga === liga.id) zeilen.push([f.name, `Platz ${f.oben.platz}`, "rel"]);
        });
        if (liga.relegationTo && liga.relegationTo.length) zeilen.push(["Abstieg", "in die nächsttiefere Klasse", "ab"]);
        if (!liga.promotionTo && !liga.europeanSpots) zeilen.push(["Ligaspitze", "Kein Aufstieg möglich", ""]);

        detail.innerHTML = `
            <div class="league-option-card selected">
                <div class="lo-head">
                    <span class="league-badge-big">${liga.flag}</span>
                    <div class="lo-title">
                        <span class="lo-kicker">${this.escapeHtml(liga.countryName)} · ${liga.level}. Spielklasse</span>
                        <h3>${this.escapeHtml(liga.shortName)}</h3>
                    </div>
                </div>
                <div class="league-meta-grid">
                    <div class="l-meta-item">
                        <span class="l-meta-label">Vereine</span>
                        <span class="l-meta-val">${liga.clubCount}</span>
                    </div>
                    <div class="l-meta-item">
                        <span class="l-meta-label">Spieltage</span>
                        <span class="l-meta-val">${liga.matchdays || (liga.clubCount - 1) * 2}</span>
                    </div>
                    <div class="l-meta-item">
                        <span class="l-meta-label">Niveau</span>
                        <span class="l-meta-val l-meta-text">${this.wizardTierLabel(liga.tier)}</span>
                    </div>
                    <div class="l-meta-item">
                        <span class="l-meta-label">Punkte</span>
                        <span class="l-meta-val l-meta-text">${liga.pointsPerWin}/${liga.pointsPerDraw}/0</span>
                    </div>
                </div>
                <div class="lo-zonen">
                    ${zeilen.map(([was, wo, zone]) => `
                        <div class="lo-zone">
                            <span class="rang ${zone ? `rang-${zone}` : "rang-leer"}" aria-hidden="true"></span>
                            <span class="lo-zone-was">${this.escapeHtml(was)}</span>
                            <span class="lo-zone-wo">${this.escapeHtml(wo)}</span>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }

    /** Wählt eine Liga für die Karriere und richtet Schritt 3 darauf aus */
    selectWizardLeague(leagueId) {
        if (!leagueId || leagueId === this.wizardSelectedLeagueId) return;

        this.wizardSelectedLeagueId = leagueId;

        // Ein Verein aus einer anderen Liga darf nicht ausgewählt bleiben
        const gewaehlt = this.getWizardTeams().find(c => String(c.id) === String(this.wizardSelectedClubId));
        if (gewaehlt && gewaehlt.leagueId !== leagueId) {
            this.wizardSelectedClubId = null;
        }

        this.renderWizardLeagues();
        this.renderWizardSummary();

        const select = document.getElementById("filterClubLeague");
        if (select) select.value = leagueId;
    }

    /**
     * Füllt die Ligaauswahl über der Vereinsliste.
     *
     * Es gibt bewusst kein "Alle Ligen" mehr: Eine Karriere beginnt in genau
     * einer Liga, also stehen hier auch nur deren Vereine zur Wahl. Wer die
     * Liga wechseln möchte, tut das hier oder in Schritt zwei - beides bleibt
     * synchron.
     */
    populateWizardLeagueFilter(teams) {
        const select = document.getElementById("filterClubLeague");
        if (!select) return;

        const ligen = this.getWizardLeagues(teams).filter(l => l.clubCount > 0);
        if (ligen.length === 0) return;

        if (!ligen.some(l => l.id === this.wizardSelectedLeagueId)) {
            this.wizardSelectedLeagueId = ligen[0].id;
        }

        if (!select._leagueFilterFilled) {
            select.innerHTML = ligen
                .map(l => `<option value="${this.escapeHtml(l.id)}">${l.flag} ${this.escapeHtml(l.name)} (${l.clubCount})</option>`)
                .join("");
            select._leagueFilterFilled = true;

            if (typeof select.addEventListener === "function") {
                select.addEventListener("change", () => {
                    this.selectWizardLeague(select.value);
                    this.renderWizardClubs();
                });
            }
        }

        select.value = this.wizardSelectedLeagueId;
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

    setWizardStep(step) {
        this.wizardStep = step;
        this.renderWizardStep();
    }

    renderWizardStep() {
        const SCHRITTE = 3;
        // Schrittanzeige: aktuell, erledigt, offen
        document.querySelectorAll(".wizard-step-node").forEach(node => {
            const nodeStep = parseInt(node.dataset.step, 10);
            node.classList.toggle("active", nodeStep === this.wizardStep);
            node.classList.toggle("done", nodeStep < this.wizardStep);
        });
        const balken = document.getElementById("wizardProgressBar");
        if (balken) balken.style.width = `${Math.round((this.wizardStep / SCHRITTE) * 100)}%`;
        const zaehler = document.getElementById("wizardStepCounter");
        if (zaehler) zaehler.textContent = `Schritt ${this.wizardStep} von ${SCHRITTE}`;

        // Step contents
        const s1 = document.getElementById("wizardStep1");
        const s2 = document.getElementById("wizardStep2");
        const s3 = document.getElementById("wizardStep3");
        if (s1) s1.style.display = this.wizardStep === 1 ? "block" : "none";
        if (s2) s2.style.display = this.wizardStep === 2 ? "block" : "none";
        if (s3) s3.style.display = this.wizardStep === 3 ? "block" : "none";

        const backBtn = document.getElementById("btnWizardBack");
        const nextBtn = document.getElementById("btnWizardNext");

        if (backBtn) backBtn.style.display = this.wizardStep > 1 ? "inline-flex" : "none";

        if (this.wizardStep === 2) {
            this.renderWizardLeagues();
        }

        if (this.wizardStep === 3) {
            if (nextBtn) {
                this.setzeWizardWeiter(nextBtn, true);
                nextBtn.disabled = !this.wizardSelectedClubId;
            }
            this.renderWizardClubs();
            if (this.wizardSelectedClubId) {
                this.renderWizardClubDetails(this.wizardSelectedClubId);
            } else {
                const panel = document.getElementById("clubDetailPanel");
                if (panel) {
                    panel.innerHTML = `
                        <div class="club-detail-placeholder">
                            <svg class="ico" aria-hidden="true"><use href="#i-shield"/></svg>
                            <span>Wähle links einen Verein, um Kader, Finanzen und die Erwartungen des Vorstands zu sehen.</span>
                        </div>
                    `;
                }
            }
        } else if (nextBtn) {
            this.setzeWizardWeiter(nextBtn, false);
            nextBtn.disabled = false;
        }

        // Nach dem Schrittwechsel oben anfangen - sonst steht man am Handy
        // mitten in der Vereinsliste des vorigen Besuchs
        const body = typeof document.querySelector === "function" ? document.querySelector(".wizard-body") : null;
        if (body && typeof body.scrollTo === "function") body.scrollTo(0, 0);

        this.renderWizardSummary();
    }

    /**
     * Filtert und rendert die Vereinsauswahl im Assistenten
     */
    renderWizardClubs() {
        const listContainer = document.getElementById("clubSelectionList");

        if (!listContainer) {
            console.error("Element #clubSelectionList wurde nicht gefunden.");
            this.showToast("Die Vereinsliste konnte nicht geladen werden.", "error");
            return;
        }

        const teams = this.getWizardTeams();
        this.populateWizardLeagueFilter(teams);

        if (!teams.length) {
            listContainer.innerHTML = `
                <div class="text-muted" style="padding:20px; text-align:center;">
                    Keine Vereinsdaten gefunden. Bitte prüfen Sie, ob <strong>js/data/initialData.js</strong> korrekt geladen wurde.
                </div>
            `;
            return;
        }

        const searchInput = document.getElementById("filterClubSearch");
        const sortSelect = document.getElementById("filterClubSort");
        const difficultySelect = document.getElementById("filterClubDifficulty");

        const leagueSelect = document.getElementById("filterClubLeague");

        const searchVal = (searchInput?.value || "").toLowerCase().trim();
        const sortVal = sortSelect?.value || "strength_desc";
        const diffVal = difficultySelect?.value || "all";
        // Gespielt wird in genau einer Liga - der aus Schritt zwei
        const leagueVal = leagueSelect?.value || this.wizardSelectedLeagueId || "all";

        const filtered = UIManager.getFilteredWizardClubs(teams, {
            search: searchVal,
            difficulty: diffVal,
            sort: sortVal,
            league: leagueVal
        });

        if (!filtered.length) {
            listContainer.innerHTML = `
                <div class="text-muted" style="padding:20px; text-align:center;">
                    <div style="font-weight:700; margin-bottom:8px;">Keine Vereine für diesen Filter gefunden.</div>
                    <div style="font-size:12px;">
                        Suche: <strong>${searchVal || "keine"}</strong><br>
                        Schwierigkeit: <strong>${diffVal}</strong><br>
                        Geladene Vereine insgesamt: <strong>${teams.length}</strong>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btnResetClubFilters" style="margin-top:12px;">
                        Filter zurücksetzen
                    </button>
                </div>
            `;

            document.getElementById("btnResetClubFilters")?.addEventListener("click", () => {
                this.resetWizardClubFilters();
                this.renderWizardClubs();
            });

            return;
        }

        // Kurzform der Vorstandserwartung als Etikett in der Liste
        const ZIEL = {
            championship: ["Titel", "ziel-titel"],
            top3: ["Top 3", "ziel-top"],
            promotion: ["Aufstieg", "ziel-top"],
            top6: ["Top 6", "ziel-top"],
            midfield: ["Mittelfeld", "ziel-mitte"],
            lower_mid: ["Mittelfeld", "ziel-mitte"],
            avoid_relegation: ["Klassenerhalt", "ziel-unten"]
        };

        listContainer.innerHTML = filtered.map(club => {
            const players = Array.isArray(club.players) ? club.players : [];
            const isSelected = this.wizardSelectedClubId === club.id;
            const ziel = ZIEL[club.boardExpectation];

            return `
                <div class="club-list-item ${isSelected ? "selected" : ""}" data-club-id="${club.id}" role="button" tabindex="0"
                     aria-label="${this.escapeHtml([club.name, club.city, club.leagueName].filter(Boolean).join(", "))}">
                    ${this.wappenHtml(club, "crest-md")}
                    <div class="club-item-left">
                        <div class="club-item-title">${this.escapeHtml(club.name || "Unbekannter Verein")}</div>
                        <div class="club-item-sub">${this.escapeHtml(club.city || "Unbekannte Stadt")}${ziel ? ` <span class="ziel-tag ${ziel[1]}">${ziel[0]}</span>` : ""}</div>
                    </div>
                    <div class="club-item-right">
                        <span class="club-item-ovr">${this.wizardTeamStars(players, { compact: true })}</span>
                        <span class="club-item-budget">${this.formatMoneySafe(club.transferBudget || 0)}</span>
                    </div>
                </div>
            `;
        }).join("");

        listContainer.querySelectorAll(".club-list-item").forEach(item => {
            item.addEventListener("click", () => {
                const clubId = item.dataset.clubId;

                if (!clubId) {
                    this.showToast("Dieser Verein konnte nicht ausgewählt werden.", "error");
                    return;
                }

                this.wizardSelectedClubId = clubId;
                this.renderWizardClubs();
                this.renderWizardClubDetails(clubId);
                this.renderWizardSummary();

                const nextBtn = document.getElementById("btnWizardNext");
                if (nextBtn) {
                    nextBtn.disabled = false;
                    this.setzeWizardWeiter(nextBtn, true);
                }

                // Am Handy steht das Detail unter der Liste - dorthin springen
                const panel = document.getElementById("clubDetailPanel");
                if (panel && typeof window !== "undefined" && window.matchMedia
                    && window.matchMedia("(max-width: 1200px)").matches && typeof panel.scrollIntoView === "function") {
                    panel.scrollIntoView({ behavior: "smooth", block: "start" });
                }

                this.playSound("click");
            });
            item.addEventListener("keydown", (e) => {
                if (e && (e.key === "Enter" || e.key === " ")) {
                    if (typeof e.preventDefault === "function") e.preventDefault();
                    if (typeof item.click === "function") item.click();
                }
            });
        });
    }

    /**
     * Detaillierte Vereins- und Kaderanalyse für die Vereinsauswahl
     */
    renderWizardClubDetails(clubId) {
        const panel = document.getElementById("clubDetailPanel");
        if (!panel) return;

        const teams = this.getWizardTeams();
        const club = teams.find(c => c.id === clubId);
        if (!club) {
            panel.innerHTML = `
                <div class="club-detail-placeholder">
                    <span>⚠️ Verein konnte nicht gefunden werden. Bitte wählen Sie erneut einen Verein aus.</span>
                </div>
            `;
            return;
        }

        const players = Array.isArray(club.players) ? club.players : [];
        const avgAge = players.length ? (players.reduce((sum, p) => sum + (p.age || 0), 0) / players.length).toFixed(1).replace(".", ",") : "0";
        const totalValue = players.reduce((sum, p) => sum + (p.value || 0), 0);
        const ico = (name) => `<svg class="ico" aria-hidden="true"><use href="#${name}"/></svg>`;
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        const farben = this.wappenFarben(club);
        const FLAGS = { de: "🇩🇪", en: "🏴", es: "🇪🇸", it: "🇮🇹", fr: "🇫🇷" };

        // Top Spieler & Talente
        const sortedPlayers = [...players].sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const topPlayers = sortedPlayers.slice(0, 3);
        const topTalents = [...players].filter(p => (p.age || 99) <= 22).sort((a, b) => (b.pot || 0) - (a.pot || 0)).slice(0, 2);
        const spielerZeile = (p, zusatz) => `
            <div class="cd-player-row">
                <span class="pos-tag cd-pos">${esc(p.pos)}</span>
                <span class="cd-player-name"><strong>${esc(p.name)}</strong>${zusatz ? `<span class="text-muted">${zusatz}</span>` : ""}</span>
                <span class="cd-player-stars">${this.abilityStarsFor(p, { wizardVerein: club, compact: true })}</span>
            </div>`;

        panel.innerHTML = `
            <div class="club-detail-container" style="--club-farbe:${farben.farbe};--club-zweit:${farben.zweit};">
                <div class="cd-hero">
                    ${this.wappenHtml(club, "crest-xl")}
                    <div class="cd-hero-text">
                        <span class="cd-kicker">${FLAGS[club.countryId] || ""} ${esc(club.leagueName || "")}${club.level ? ` · Ligastufe ${club.level}` : ""}</span>
                        <div class="cd-name">${esc(club.name)}</div>
                        <div class="cd-city">
                            <span>${ico("i-pin")}${esc(club.city || "")}</span>
                            <span>${ico("i-stadium")}${esc(club.stadium || "")} · ${(club.capacity || 0).toLocaleString("de-DE")} Plätze</span>
                        </div>
                    </div>
                </div>

                <div class="cd-strength">
                    <span class="cd-label">Kaderstärke</span>
                    <span class="cd-squad-rating team-strength-stars" title="Kaderstärke im Vergleich zu den übrigen Vereinen">${this.wizardTeamStars(players)}</span>
                </div>

                <div class="cd-grid-meta">
                    <div class="cd-box">
                        <div class="cd-box-title">Transferbudget</div>
                        <div class="cd-box-val cd-val-geld">${this.formatMoneySafe(club.transferBudget || 0)}</div>
                    </div>
                    <div class="cd-box">
                        <div class="cd-box-title">Gehälter / Woche</div>
                        <div class="cd-box-val">${this.formatMoneySafe(club.wageBudget || 0)}</div>
                    </div>
                    <div class="cd-box">
                        <div class="cd-box-title">Kaderwert</div>
                        <div class="cd-box-val">${this.formatMoneySafe(totalValue)}</div>
                    </div>
                    <div class="cd-box">
                        <div class="cd-box-title">Altersschnitt</div>
                        <div class="cd-box-val">${avgAge} J.</div>
                    </div>
                </div>

                <div class="cd-goal">
                    ${ico("i-target")}
                    <div>
                        <div class="cd-label">Vorstandsziel Saison 1</div>
                        <div class="cd-goal-text">${esc(this.getExpectationTextSafe(club.boardExpectation))}</div>
                    </div>
                </div>

                <div>
                    <div class="cd-section-title">Schlüsselspieler</div>
                    <div class="cd-sterne-hinweis">${esc(UIManager.STERN_MASSSTAEBE[this.sternMassstab()].hinweisVerein)}</div>
                    <div class="cd-player-list">
                        ${topPlayers.map(p => spielerZeile(p, "")).join("")}
                    </div>
                </div>

                ${topTalents.length > 0 ? `
                    <div>
                        <div class="cd-section-title">Talente</div>
                        <div class="cd-player-list">
                            ${topTalents.map(p => spielerZeile(p, ` · ${p.age} J.`)).join("")}
                        </div>
                    </div>
                ` : ""}

                <div class="cd-action-btn-wrap">
                    <button class="btn btn-primary btn-lg" id="btnAdoptClub" type="button">
                        <span>${esc(club.name)} übernehmen</span>${ico("i-arrow")}
                    </button>
                </div>
            </div>
        `;

        document.getElementById("btnAdoptClub")?.addEventListener("click", () => {
            this.confirmStartGameWithSelectedClub();
        });
    }

    /**
     * Startet die Karriere mit den im Assistenten gewählten Einstellungen
     */
    confirmStartGameWithSelectedClub() {
        try {
            if (!this.wizardSelectedClubId) {
                this.showToast("Bitte wählen Sie zuerst einen Verein aus.", "warning");
                return;
            }

            const teams = this.getWizardTeams();
            const selectedClub = teams.find(c => c.id === this.wizardSelectedClubId);
            if (!selectedClub) {
                this.showToast("Der ausgewählte Verein wurde nicht gefunden.", "error");
                return;
            }

            const managerName = document.getElementById("inputManagerName")?.value.trim() || "Trainer Schmidt";
            const managerNationality = document.getElementById("inputManagerNationality")?.value || "Deutschland";
            const managerBirthdate = document.getElementById("inputManagerBirthdate")?.value || "1985-05-15";
            const difficulty = document.getElementById("selectDifficulty")?.value || "normal";

            const trainerTyp = document.getElementById("inputTrainerTyp")?.value || "allrounder";
            const erklaerungen = document.getElementById("inputErklaerungen")?.checked !== false;
            const platz = this.zielPlatzNeueKarriere || GameState.freierPlatz() || GameState.aeltesterPlatz();
            this.beziehePlatz(platz);
            const result = this.app.startNewGame(this.wizardSelectedClubId, difficulty, {
                name: managerName,
                nationality: managerNationality,
                birthdate: managerBirthdate,
                trainerTyp,
                erklaerungen
            });

            if (!result || result.success === false || !this.app.state || !this.app.state.userClubId) {
                console.error("[Wizard] Karriere-Start fehlgeschlagen:", {
                    result,
                    state: this.app.state
                });
                this.showToast(result?.error || "Karriere konnte nicht gestartet werden.", "error", 7000);
                return;
            }

            const modal = document.getElementById("modalNewGame");
            if (modal) modal.style.display = "none";

            this.hideStartScreen();
            this.switchTab("dashboard");
            this.renderCurrentTab();
            this.playSound("whistle");

            const clubName = this.app.state?.clubs?.find(c => c.id === this.app.state.userClubId)?.name || selectedClub.name;
            this.showToast(`Karriere erfolgreich gestartet! Viel Erfolg bei ${clubName}! (Speicherplatz ${GameState.platzNummer(platz)})`, "success");
        } catch (err) {
            console.error("[Wizard] Fehler in confirmStartGameWithSelectedClub:", err);
            this.showToast(`Fehler beim Karrierestart: ${err.message}`, "error", 7000);
        }
    }

    /**
     * Binden der Wizard-Schritt-Events
     */
    bindWizardEvents() {
        document.querySelectorAll(".wizard-step-node").forEach(node => {
            node.addEventListener("click", () => {
                const targetStep = parseInt(node.dataset.step, 10);
                if (targetStep < this.wizardStep) {
                    this.setWizardStep(targetStep);
                } else if (targetStep === 2 && this.wizardStep === 1) {
                    const name = document.getElementById("inputManagerName")?.value.trim();
                    if (!name) {
                        this.showToast("Bitte geben Sie einen Trainernamen ein.", "warning");
                        return;
                    }
                    this.setWizardStep(2);
                } else if (targetStep === 3 && this.wizardStep <= 2) {
                    const name = document.getElementById("inputManagerName")?.value.trim();
                    if (!name) {
                        this.showToast("Bitte geben Sie einen Trainernamen ein.", "warning");
                        return;
                    }
                    this.setWizardStep(3);
                }
            });
        });

        document.getElementById("btnCloseWizard")?.addEventListener("click", () => {
            document.getElementById("modalNewGame").style.display = "none";
        });

        document.querySelectorAll(".difficulty-card").forEach(karte => {
            karte.addEventListener("click", () => this.waehleSchwierigkeit(karte.dataset.diff));
        });
        ["inputManagerName", "inputManagerNationality"].forEach(id => {
            const feld = document.getElementById(id);
            if (feld) {
                feld.addEventListener("input", () => this.renderWizardSummary());
                feld.addEventListener("change", () => this.renderWizardSummary());
            }
        });

        document.getElementById("btnWizardBack")?.addEventListener("click", () => {
            if (this.wizardStep > 1) {
                this.setWizardStep(this.wizardStep - 1);
            }
        });

        document.getElementById("btnWizardNext")?.addEventListener("click", () => {
            if (this.wizardStep === 1) {
                const name = document.getElementById("inputManagerName")?.value.trim();
                if (!name) {
                    this.showToast("Bitte geben Sie einen Trainernamen ein.", "warning");
                    return;
                }
                this.setWizardStep(2);
            } else if (this.wizardStep === 2) {
                this.setWizardStep(3);
            } else if (this.wizardStep === 3) {
                this.confirmStartGameWithSelectedClub();
            }
        });

        document.getElementById("filterClubSearch")?.addEventListener("input", () => this.renderWizardClubs());
        document.getElementById("filterClubSort")?.addEventListener("change", () => this.renderWizardClubs());
        document.getElementById("filterClubDifficulty")?.addEventListener("change", () => this.renderWizardClubs());
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

        // Verletzte oder gesperrte Spieler
        const injured = lineupPlayers.filter(p => p.injured);
        if (injured.length > 0) {
            return { valid: false, message: `Folgende Spieler in der Startelf sind verletzt: ${injured.map(p => p.name).join(", ")}. Bitte wechseln Sie diese aus.` };
        }

        const suspended = lineupPlayers.filter(p => p.suspended > 0);
        if (suspended.length > 0) {
            return { valid: false, message: `Folgende Spieler in der Startelf sind gesperrt: ${suspended.map(p => p.name).join(", ")}. Bitte wechseln Sie diese aus.` };
        }

        return { valid: true };
    }

    /**
     * Töne synthetisieren (Web Audio API)
     */
    playSound(type) {
        if (!this.soundEnabled) return;
        try {
            if (!this.audioCtx && typeof window !== "undefined") {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (typeof AudioContextClass === "function") {
                    this.audioCtx = new AudioContextClass();
                }
            }
            if (!this.audioCtx) return;
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            if (type === "whistle") {
                // Pfiff: Hoher Sinus-Ton mit kurzer Frequenzmodulation
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(2200, now);
                osc.frequency.exponentialRampToValueAtTime(1800, now + 0.25);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.3);
            } else if (type === "goal") {
                // Torjubel: Akkord & Aufsteigende Fanfare
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = "triangle";
                    osc.frequency.setValueAtTime(freq, now + i * 0.08);
                    gain.gain.setValueAtTime(0.15, now + i * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.6);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + i * 0.08);
                    osc.stop(now + i * 0.08 + 0.6);
                });
            } else if (type === "gasp") {
                // Raunen im Stadion bei einer vergebenen Chance
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(180, now);
                osc.frequency.exponentialRampToValueAtTime(90, now + 0.55);
                gain.gain.setValueAtTime(0.0001, now);
                gain.gain.exponentialRampToValueAtTime(0.06, now + 0.12);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.6);
            } else if (type === "click") {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(800, now);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.05);
            }
        } catch (e) {
            console.warn("Audio Context nicht verfügbar:", e);
        }
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
        // Beim ersten Besuch erklärt sich der Bereich selbst
        this.zeigeEinstiegErklaerung(this.activeTab);
    }

    /**
     * Einstellungen: Livespiel-Vorgaben, die bisher nur mitten in einer
     * Partie im Co-Trainer-Reiter zu finden waren.
     */
    renderSettings() {
        this.renderEinstiegEinstellungen();
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
        el.innerHTML = `
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
            <button class="attention-item" data-tab="${this.escapeHtml(item.tab)}"${item.playerId !== undefined ? ` data-player="${this.escapeHtml(String(item.playerId))}"` : ""}${item.negId ? ` data-neg="${this.escapeHtml(String(item.negId))}"` : ""}>
                <span class="attention-icon ton-${({ "🚑": "bad", "⚠️": "bad", "🩺": "bad", "📢": "bad", "🥵": "warn", "😞": "warn", "💰": "warn", "💬": "warn", "🤝": "ok" })[item.icon] || "info"}">${this.symbolHtml(item.icon)}</span>
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
                // Eine Verhandlung führt direkt zu ihrer Karte
                if (btn.dataset.neg) return this.zeigeVerhandlung(btn.dataset.neg);
                // Ein Gespräch führt direkt in die Akte des Spielers
                if (btn.dataset.player !== undefined) {
                    const ziel = state.players.find(p => String(p.id) === btn.dataset.player);
                    if (ziel) return this.showPlayerDetailsModal(ziel.id);
                }
                this.switchTab(btn.dataset.tab);
            });
        });
        list.querySelectorAll(".attention-name").forEach(btn => {
            btn.addEventListener("click", () => {
                const ziel = state.players.find(p => String(p.id) === btn.dataset.player);
                if (ziel) this.showPlayerDetailsModal(ziel.id, { abschnitt: btn.dataset.abschnitt });
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
                        modal.style.display = "none";
                        if (onDone) {
                            onDone();
                            return;
                        }
                        this.renderCurrentTab();
                        this.renderHeader();
                    };
                });
            });
        };

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
        knopf.innerHTML = `<span class="btn-advance-text">${ziel.text}</span> <span class="btn-arrow"><svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></span>`;
        // Auf schmalen Geräten zeigt der Knopf nur die Kurzfassung
        // (Ohne dataset - etwa im Test-DOM - brach hier der ganze Kopf ab.)
        if (knopf.dataset) knopf.dataset.kurz = ziel.kurz || "Weiter";
        // Einzelne Tage wie im FM: nur sinnvoll, wenn der Hauptknopf mehrere
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
        const mehrPunkt = document.getElementById("mobileMoreBadgeDot");
        if (mehrPunkt) {
            const preOffen = (state.preseason && state.preseason.aktiv && this.getPreseasonEngine())
                ? this.getPreseasonEngine().offenePunkte(state).length : 0;
            const angeboteOffen = (state.transferMarket?.offers || []).filter(o => o.status === "pending").length;
            mehrPunkt.style.display = (unreadCount > 0 || preOffen > 0 || angeboteOffen > 0 || natAngebot) ? "" : "none";
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
     * Die Karte "Als Nächstes" - nach dem Vorbild von FM und EA FC.
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
        DOM.setText("dashHomeRank", termin.art === "liga" ? platz(heimClub?.id) : "");
        DOM.setText("dashAwayRank", termin.art === "liga" ? platz(gastClub?.id) : "");
        DOM.setText("dashVenue", heimClub?.stadium || "");
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
        knopf.style.display = "";
        knopf.innerHTML = `<svg class="ico" aria-hidden="true"><use href="#i-${plan ? "check" : "tactics"}"/></svg>`
            + `<span>${plan ? `Matchplan (${plan.punkte.length})` : "Taktikbesprechung"}</span>`;
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
     * Die Tagesleiste - wie der Kalenderstreifen in EA FC.
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
                                <div class="cal-day-title">${this.tagIcon(day.type)} ${this.escapeHtml(inhalt.titel || day.title)}</div>
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
                    <td><strong>${s.points}</strong></td>
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
     * Kader rendern mit Filter
     */
    /**
     * Eine Leiste mit Kennzahlen-Kacheln - wie der Kopf der Vereinsseite.
     * kacheln: [{ titel, wert, extra (HTML), klasse }]
     */
    renderKennzahlen(elId, kacheln) {
        const el = document.getElementById(elId);
        if (!el) return;
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        el.innerHTML = kacheln.map(k =>
            `<div class="vk-kachel${k.klasse ? " " + k.klasse : ""}"><span>${esc(k.titel)}</span><strong>${esc(k.wert)}</strong>${k.extra || ""}</div>`).join("");
    }

    /**
     * Die Kabine: Kapitän, Führungsspieler, Grüppchen mit Wortführer und
     * Stimmung, dazu wer keinen Anschluss findet.
     */
    /** Die Mannschaftsbesprechung in der Kabinen-Karte: vier Ansprachen, Sperre, letzte Antwort */
    besprechungHtml(state) {
        const talk = this.getPlayerTalkEngine();
        if (!talk || typeof talk.mannschaftsbesprechung !== "function") return "";
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const gesperrt = talk.besprechungGesperrt(state);
        const club = state.clubs.find(c => c.id === state.userClubId);
        const zuletzt = club?.besprechung?.thema;
        const r = this._letzteBesprechung;
        const antwort = r ? `<div class="kb-antwort kba-${r.stimmung}">
                ${r.kapitaen ? `<strong>${esc(r.kapitaen)}:</strong> ` : ""}„${esc(r.antwort)}“
                <span class="text-muted">Moral im Schnitt ${r.schnitt > 0 ? "+" : ""}${String(r.schnitt).replace(".", ",")}${r.abgenutzt ? " - dieselbe Ansprache wie zuletzt, sie nutzt sich ab" : ""}.</span>
            </div>` : "";
        return `
            <div class="kb-besprechung">
                <span class="kb-label">Mannschaftsbesprechung</span>
                <div class="kb-besprechung-knoepfe">
                    ${Object.entries(talk.BESPRECHUNG_THEMEN).map(([key, t]) => `
                        <button class="btn btn-sm btn-secondary" data-besprechung="${key}" title="${esc(t.text)}" ${gesperrt ? "disabled" : ""}>
                            ${esc(t.label)}${key === zuletzt ? " (zuletzt)" : ""}
                        </button>`).join("")}
                </div>
                <p class="text-muted kb-hinweis">${gesperrt
                    ? `Die nächste Besprechung ist in ${gesperrt} Tag${gesperrt === 1 ? "" : "en"} möglich.`
                    : "Alle zwei Wochen. Was ankommt, hängt an Ergebnissen, Stimmung und Tabelle - und am Charakter der Spieler."}</p>
                ${antwort}
            </div>`;
    }

    renderKabine() {
        const box = document.getElementById("squadKabine");
        const engine = typeof DressingRoomEngine !== "undefined" ? DressingRoomEngine : null;
        if (!box || !engine || typeof engine.hierarchie !== "function") return;
        const state = this.app.state;
        const h = engine.hierarchie(state);
        if (!h.spieler.length) { box.innerHTML = ""; return; }
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const link = (p) => `<a href="#" data-kabine-spieler="${esc(p.id)}">${esc(p.name)}</a>`;
        const balken = (wert) => {
            const w = Math.max(0, Math.min(100, Math.round(wert)));
            const klasse = w >= 72 ? "gut" : (w >= 55 ? "mittel" : "schlecht");
            return `<span class="kb-balken"><i class="kb-${klasse}" style="width:${w}%"></i></span><span class="kb-wert">${w}</span>`;
        };
        const fuehrung = h.spieler.filter(e => e.stufe === "Führungsspieler");
        const neu = h.spieler.filter(e => e.stufe === "Neuzugang");
        const allein = h.spieler.filter(e => e.allein && e.sprache !== "deutsch");
        const optionen = h.spieler.slice().sort((a, b) => b.einfluss - a.einfluss)
            .map(e => `<option value="${esc(e.player.id)}"${e.player === h.kapitaen ? " selected" : ""}>${esc(e.player.name)} · Einfluss ${e.einfluss}</option>`).join("");
        box.innerHTML = `
            <div class="kb-kopf">
                <h3><svg class="ico" aria-hidden="true"><use href="#i-users"/></svg>Kabine</h3>
                <label class="kb-kapitaen">Kapitän
                    <select id="kabineKapitaen">${optionen}</select>
                </label>
            </div>
            ${this.besprechungHtml(state)}
            <div class="kb-stufen">
                <div><span class="kb-label">Führungsspieler</span>${fuehrung.length ? fuehrung.map(e => link(e.player)).join(", ") : "<span class=\"text-muted\">niemand</span>"}</div>
                <div><span class="kb-label">Neu in der Kabine</span>${neu.length ? neu.map(e => link(e.player)).join(", ") : "<span class=\"text-muted\">niemand</span>"}</div>
            </div>
            <div class="kb-gruppen">
                ${h.gruppen.map(g => `
                    <div class="kb-gruppe">
                        <div class="kb-gruppe-kopf"><strong>${esc(g.name)}</strong><span class="text-muted">${g.mitglieder.length} Spieler</span></div>
                        <div class="kb-zeile"><span class="kb-label">Stimmung</span>${balken(g.stimmung)}</div>
                        <div class="kb-zeile"><span class="kb-label">Wortführer</span>${link(g.wortfuehrer)}</div>
                    </div>`).join("")}
            </div>
            ${allein.length ? `<div class="hint-box mt-2">Ohne Landsleute im Kader: ${allein.map(e => link(e.player)).join(", ")}. Wer sich schwer anpasst, verliert dadurch Moral.</div>` : ""}
            <p class="text-muted kb-hinweis">Ist ein Wortführer unzufrieden, färbt das auf seine Gruppe ab, beim Kapitän auf alle. Wer einen Führungsspieler verkauft, hat ein paar Tage Unruhe.</p>`;
        box.querySelectorAll("[data-kabine-spieler]").forEach(a => a.addEventListener("click", (e) => {
            e.preventDefault();
            const ziel = state.players.find(p => String(p.id) === a.dataset.kabineSpieler);
            if (ziel) this.showPlayerDetailsModal(ziel.id);
        }));
        box.querySelectorAll("[data-besprechung]").forEach(btn => btn.addEventListener("click", () => {
            const talk = this.getPlayerTalkEngine();
            const res = talk ? talk.mannschaftsbesprechung(state, btn.dataset.besprechung) : null;
            if (!res || !res.success) { this.showToast(res?.error || "Die Besprechung kam nicht zustande.", "error"); return; }
            this._letzteBesprechung = res;
            this.playSound("click");
            this.showToast(`Mannschaftsbesprechung: ${res.stimmung === "gut" ? "kam an" : res.stimmung === "schlecht" ? "ging daneben" : "gemischtes Echo"}.`,
                res.stimmung === "gut" ? "success" : (res.stimmung === "schlecht" ? "error" : "info"));
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderSquad?.();
        }));
        const wahl = document.getElementById("kabineKapitaen");
        if (wahl) wahl.addEventListener("change", () => {
            const res = engine.setzeKapitaen(state, wahl.value);
            if (!res.success) { this.showToast(res.error, "error"); return; }
            this.showToast(res.vorher && res.vorher !== res.kapitaen
                ? `${res.kapitaen.name} ist neuer Kapitän. ${res.vorher.name} muss das erst verdauen.`
                : `${res.kapitaen.name} ist Kapitän.`, "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderKabine();
        });
    }

    renderSquad(posFilter = "all") {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        // Wer gerade verliehen ist, steht nicht im Kader - aber hier darunter
        const verliehenBox = document.getElementById("squadLoanedOut");
        const leihEngine = this.getLoanEngine();
        if (verliehenBox && leihEngine) {
            const weg = leihEngine.verlieheneVon(state, userClub.id);
            verliehenBox.style.display = weg.length ? "" : "none";
            verliehenBox.innerHTML = weg.length
                ? `<strong>Verliehen:</strong> ${weg.map(p => `<a href="#" data-verliehen="${this.escapeHtml(String(p.id))}">${this.escapeHtml(p.name)}</a> (${this.escapeHtml(state.clubs.find(c => c.id === p.leihe.leihvereinId)?.name || "?")})`).join(", ")}`
                : "";
            verliehenBox.querySelectorAll("[data-verliehen]").forEach(a => a.addEventListener("click", (e) => {
                e.preventDefault();
                const ziel = state.players.find(p => String(p.id) === a.dataset.verliehen);
                if (ziel) this.showPlayerDetailsModal(ziel.id);
            }));
        }

        this.renderKabine();
        this.renderReserve();

        // Kennzahlen des ganzen Kaders - unabhaengig vom Filter
        const kader = state.players.filter(p => userClub.playerIds.includes(p.id));
        if (kader.length) {
            const alter = kader.reduce((s, p) => s + (p.age || 0), 0) / kader.length;
            const wert = kader.reduce((s, p) => s + (p.value || 0), 0);
            const gehalt = kader.reduce((s, p) => s + (p.wage || 0), 0);
            const ausfall = kader.filter(p => (p.injuredWeeks || 0) > 0 || (p.suspendedMatches || 0) > 0).length;
            const fit = Math.round(kader.reduce((s, p) => s + (p.fitness ?? 100), 0) / kader.length);
            const auslaufend = kader.filter(p => (p.contractYears ?? p.contract?.years ?? 2) <= 1).length;
            this.renderKennzahlen("squadKennzahlen", [
                { titel: "Spieler", wert: String(kader.length), extra: `<small>Ø ${alter.toFixed(1).replace(".", ",")} Jahre</small>` },
                { titel: "Marktwert", wert: this.geldKurz(wert), extra: `<small>gesamt</small>` },
                { titel: "Gehälter", wert: this.geldKurz(gehalt), extra: `<small>pro Woche</small>` },
                { titel: "Fitness", wert: `${fit} %`, extra: `<span class="vk-balken"><i style="width:${fit}%"></i></span>`, klasse: fit < 80 ? "warnung" : "" },
                { titel: "Ausfälle", wert: String(ausfall), extra: `<small>verletzt oder gesperrt</small>`, klasse: ausfall >= 3 ? "gefahr" : "" },
                { titel: "Verträge", wert: String(auslaufend), extra: `<small>laufen bald aus</small>`, klasse: auslaufend >= 4 ? "warnung" : "" },
                { titel: "★★★ heißt", wert: UIManager.STERN_MASSSTAEBE[this.sternMassstab()].kurz, extra: `<small>Maßstab in den Einstellungen</small>` }
            ]);
        }

        let players = state.players.filter(p => userClub.playerIds.includes(p.id));

        if (posFilter === "TW") players = players.filter(p => p.pos === "TW");
        else if (posFilter === "DEF") players = players.filter(p => ["IV", "LV", "RV"].includes(p.pos));
        else if (posFilter === "MID") players = players.filter(p => ["DM", "ZM", "OM", "LM", "RM"].includes(p.pos));
        else if (posFilter === "ATT") players = players.filter(p => ["ST", "LA", "RA"].includes(p.pos));

        // Nach Position und Stärke sortieren
        players.sort((a, b) => (b.trueCurrentAbility || b.overall * 2) - (a.trueCurrentAbility || a.overall * 2));

        const ratingEngine = (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) 
            ? PlayerRatingEngine 
            : ((typeof window !== 'undefined' && window.PlayerRatingEngine) ? window.PlayerRatingEngine : null);

        const tbody = document.getElementById("squadTableBody");
        tbody.innerHTML = players.map(p => {
            const isLineup = userClub.lineup.includes(p.id);
            const isBench = userClub.bench.includes(p.id);
            let statusBadge = `<span class="badge-status-fit">Fit</span>`;
            if (p.injuredWeeks > 0) statusBadge = `<span class="badge-status-inj">🚑 ${p.injuredWeeks} Wo.</span>`;
            else if (p.suspendedMatches > 0) statusBadge = `<span class="badge-status-susp">🟥 ${p.suspendedMatches} Sp.</span>`;
            else if (isLineup) statusBadge = `<span class="badge-status-lineup">Startelf</span>`;
            else if (isBench) statusBadge = `<span class="badge-status-bench">Bank</span>`;

            const happyOverall = p.happiness?.overall || 75;
            const happyIcon = happyOverall >= 80 ? "😊" : happyOverall >= 60 ? "😐" : "😞";

            const card = ratingEngine ? ratingEngine.calculateVisiblePlayerCard(p, Object.assign({ userClubId: userClub.id, leagueDataCoverage: 95 }, this.starContext())) : null;
            // Eine Reihe für beides: gefüllt ist die heutige Stärke,
            // schraffiert das, was noch aus ihm werden kann
            const sterne = card ? card.abilityStarsHtml : "";
            const roleName = card?.bestRole?.role || p.squadRole || "Stammspieler";
            const abilityText = card?.abilityLabel || "Guter Spieler";
            // Den eigenen Spieler kennt man genau - also die kurze, exakte Zahl
            const valText = this.geldKurz(p.value);
            const fitness = Math.round(p.fitness ?? 100);

            // Nebenpositionen sichtbar machen: nicht jeder kann überall spielen
            const secondary = (Array.isArray(p.positions) ? p.positions : [])
                .filter(pos => pos && pos !== p.pos)
                .slice(0, 2);
            const secondaryHtml = secondary.length
                ? secondary.map(pos => `<span class="pos-tag pos-secondary" title="Nebenposition">${pos}</span>`).join("")
                : "";

            const form = (Number(p.form) || 0).toFixed(1).replace(".", ",");
            return `
                <tr class="row-clickable" data-player-id="${p.id}" title="Details zu ${this.escapeHtml(p.name)} öffnen">
                    <td class="sq-status">${statusBadge}</td>
                    <td class="sq-name"><strong>${this.escapeHtml(p.name)}</strong>${this.signaturMarke(p)}<span class="squad-role-hint">${p.reserve ? "U23" : (p.leihe ? "Leihspieler" : this.escapeHtml(p.squadRole || "Kader"))} · ${p.age} J.</span></td>
                    <td class="sq-pos nowrap">
                        <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span>${secondaryHtml}
                    </td>
                    <td class="sq-alter">${p.age}</td>
                    <td class="sq-staerke nowrap">
                        ${sterne}
                        <div class="squad-ability-hint">${abilityText}</div>
                    </td>
                    <td class="sq-rolle"><span class="role-chip" title="${roleName}">${roleName}</span></td>
                    <td class="sq-fit nowrap">
                        <span class="mini-bar"><span class="mini-bar-fill" style="width:${fitness}%;background:${this.fitnessFarbe(fitness)}"></span></span>${fitness}%
                    </td>
                    <td class="sq-moral nowrap" title="Moral">${happyIcon} ${happyOverall}%</td>
                    <td class="sq-form">${form}</td>
                    <td class="sq-wert nowrap">${valText}</td>
                    <td class="sq-gehalt nowrap">${this.geldKurz(p.wage)}</td>
                    <td class="sq-vertrag nowrap">${p.vorvertrag ? `<span title="Geht zum Saisonwechsel zu ${this.escapeHtml(p.vorvertrag.clubName)}">✍️</span> ` : ""}${p.contractYears} J.</td>
                    <td class="sq-meta">Form ${form} · ${valText} · ${this.geldKurz(p.wage)}/Wo · ${p.vorvertrag ? `geht zu ${this.escapeHtml(p.vorvertrag.clubName)}` : `${p.contractYears} J. Vertrag`}</td>
                    <td class="sq-aktion">
                        <button class="btn btn-sm btn-secondary btn-player-details" data-player-id="${p.id}" aria-label="Details zu ${this.escapeHtml(p.name)}">›</button>
                    </td>
                </tr>
            `;
        }).join("");

        // Ein Klick irgendwo in der Zeile öffnet die Spielerdetails
        tbody.querySelectorAll("tr.row-clickable").forEach(row => {
            row.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                const pId = this.resolvePlayerId(row.dataset.playerId);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            });
        });

        document.querySelectorAll(".btn-player-details").forEach(btn => {
            btn.addEventListener("click", () => {
                const pId = this.resolvePlayerId(btn.dataset.playerId);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            });
        });
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

    getPosGroup(pos) {
        if (pos === "TW") return "tw";
        if (["IV", "LV", "RV"].includes(pos)) return "def";
        if (["DM", "ZM", "OM", "LM", "RM"].includes(pos)) return "mid";
        return "att";
    }

    /**
     * Auflösung der PositionEngine (Browser & Node)
     */
    getPositionEngine() {
        if (typeof PositionEngine !== "undefined" && PositionEngine) return PositionEngine;
        if (typeof window !== "undefined" && window.PositionEngine) return window.PositionEngine;
        return null;
    }

    /**
     * Alle verfügbaren Formationen (Standard + eigene) als Liste
     */
    getFormationOptions() {
        const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS)
            ? FORMATION_CONFIGS
            : ((typeof window !== "undefined" && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS : {});

        return Object.entries(configs).map(([key, cfg]) => ({
            key,
            name: cfg.name || key,
            custom: !!cfg.custom
        }));
    }

    /**
     * Positionen der aktuell angezeigten Formation.
     * Im Bearbeitungsmodus wird der Entwurf verwendet, sonst die gespeicherte Formation.
     */
    getActiveFormationPositions(userClub) {
        if (this.formationEditMode && Array.isArray(this.formationDraft)) {
            return this.formationDraft;
        }
        const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS)
            ? FORMATION_CONFIGS
            : ((typeof window !== "undefined" && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS : {});
        const cfg = configs[userClub.formation] || configs["4-4-2"] || { positions: [] };
        return cfg.positions || [];
    }

    /**
     * Aufstellung & Taktik rendern
     */
    renderTactics() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;
        // Bevor etwas umgestellt wird: Was jetzt eingestellt ist, sitzt
        const taktikModul = this.getTacticsEngine();
        if (taktikModul && typeof taktikModul.vertrautheitStarten === "function") taktikModul.vertrautheitStarten(userClub);

        const posEngine = this.getPositionEngine();

        // Formations-Dropdown mit Standard- und eigenen Formationen befüllen
        const selectFormation = document.getElementById("selectFormation");
        if (selectFormation) {
            const options = this.getFormationOptions();
            const builtins = options.filter(o => !o.custom);
            const customs = options.filter(o => o.custom);

            const optionHtml = (o) => `<option value="${o.key}">${o.name}</option>`;
            let html = builtins.map(optionHtml).join("");
            if (customs.length > 0) {
                html += `<optgroup label="Eigene Formationen">${customs.map(optionHtml).join("")}</optgroup>`;
            }
            selectFormation.innerHTML = html;
            selectFormation.value = userClub.formation || "4-4-2";
            if (!selectFormation.value) {
                userClub.formation = "4-4-2";
                selectFormation.value = "4-4-2";
            }
        }

        const slots = this.getActiveFormationPositions(userClub);

        // Taktik nach Phasen: Spielstil, Formen mit und gegen den Ball,
        // Rollen, Anweisungen, Check
        const T = this.getTacticsEngine();
        if (T) T.normalisiere(userClub.tactics || (userClub.tactics = {}));
        this.renderTaktikPanels(userClub, slots);

        // Die Ansicht ueber dem Feld: Aufstellung, mit oder gegen den Ball
        const ansicht = (!this.formationEditMode && T) ? (this.taktikAnsicht || "grund") : "grund";
        document.querySelectorAll("#tacAnsicht [data-ansicht]").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.ansicht === ansicht);
            btn.disabled = !!this.formationEditMode;
            btn.onclick = () => { this.taktikAnsicht = btn.dataset.ansicht; this.renderTactics(); };
        });
        const configs = (typeof FORMATION_CONFIGS !== "undefined") ? FORMATION_CONFIGS : {};
        // "Beide": die Spieler stehen in der Form mit Ball, ihr Platz gegen
        // den Ball ist als Schatten daneben - mit dem Weg dazwischen
        const formAnsicht = ansicht === "beide" ? "mit" : ansicht;
        const vorschau = (T && formAnsicht !== "grund") ? T.vorschau(userClub, slots, formAnsicht, configs) : null;
        const schatten = (T && ansicht === "beide") ? T.vorschau(userClub, slots, "gegen", configs) : null;
        const rollenElf = T ? T.rollenDerElf(userClub, slots) : [];
        const anzeige = Object.assign({ rollen: true, sterne: true, namen: true, verbindungen: true, eignung: true }, this.taktikAnzeige || {});
        this.taktikAnzeige = anzeige;
        const pitchEl = document.getElementById("tacticsPitch");
        if (pitchEl) {
            pitchEl.classList.toggle("ansicht-mit", ansicht === "mit" || ansicht === "beide");
            pitchEl.classList.toggle("ansicht-gegen", ansicht === "gegen");
            pitchEl.classList.toggle("ohne-rollen", !anzeige.rollen || !T);
            pitchEl.classList.toggle("ohne-sterne", !anzeige.sterne);
            pitchEl.classList.toggle("ohne-namen", !anzeige.namen);
            pitchEl.classList.toggle("ohne-eignung", !anzeige.eignung);
        }
        document.querySelectorAll("#tacAuge [data-anzeige]").forEach(cb => {
            cb.checked = !!anzeige[cb.dataset.anzeige];
            cb.onchange = () => { anzeige[cb.dataset.anzeige] = cb.checked; this.renderTactics(); };
        });
        // Wo ein Knoten auf dem Feld steht (die Vorschau leicht gestaucht,
        // damit die Namensschilder nicht am Feldrand abgeschnitten werden)
        const anzeigeOrt = (liste, i) => liste ? { x: 50 + (liste[i].x - 50) * 0.84, y: liste[i].y } : { x: slots[i].x, y: slots[i].y };
        const orte = slots.map((_, i) => anzeigeOrt(vorschau, i));

        // Die Linien: wer zusammenspielt, wie gut die Rollen passen - oder in
        // "Beide" der Weg jedes Spielers zwischen den Formen
        const linksSvg = document.getElementById("tacLinks");
        if (linksSvg) {
            let svg = "";
            if (T && ansicht === "beide" && schatten) {
                slots.forEach((_, i) => {
                    const a = anzeigeOrt(schatten, i), b = orte[i];
                    svg += `<line class="weg" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
                    svg += `<ellipse class="geist" cx="${a.x}" cy="${a.y}" rx="2.1" ry="1.4"/>`;
                });
            } else if (T && anzeige.verbindungen && !this.formationEditMode) {
                const phase = ansicht === "gegen" ? "gegen" : "mit";
                T.verbindungen(userClub, slots, phase).forEach(v => {
                    const a = orte[v.a], b = orte[v.b];
                    svg += `<line class="link-${v.guete}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"><title>${this.escapeHtml(v.text)}</title></line>`;
                });
            }
            linksSvg.innerHTML = svg;
        }

        // 2D Pitch Slots rendern
        const pitchLayer = document.getElementById("pitchPlayersLayer");
        pitchLayer.innerHTML = "";

        const misfits = [];

        slots.forEach((slot, index) => {
            const playerId = userClub.lineup[index];
            const player = state.players.find(p => p.id === playerId);

            const node = document.createElement("div");
            node.className = `pitch-node ${this.selectedPitchSlot === index ? "selected" : ""}`;
            const ort = orte[index];
            node.style.left = `${ort.x}%`;
            node.style.top = `${ort.y}%`;
            node.dataset.slotIndex = index;
            // Die Rolle als Kuerzel wie im FM26 - kombiniert beide Rollen
            let rolleHtml = "";
            if (rollenElf[index] && T) {
                const rm = T.rolleMitBall(rollenElf[index].familie, rollenElf[index].mit);
                const rg = T.rolleGegenBall(rollenElf[index].familie, rollenElf[index].gegen);
                const km = T.kuerzel(rm, "mit"), kg = T.kuerzel(rg, "gegen");
                const badge = (k, r, gegen) => `<span class="rolle-badge kat-${k.kategorie}${gegen ? " gegen" : ""}" title="${this.escapeHtml((gegen ? "Gegen den Ball: " : "Mit Ball: ") + r.name)}">${this.escapeHtml(k.text)}</span>`;
                const teile = ansicht === "mit" ? [badge(km, rm, false)]
                    : ansicht === "gegen" ? [badge(kg, rg, true)]
                        : [badge(km, rm, false), badge(kg, rg, true)];
                rolleHtml = `<div class="rolle-badges">${teile.join("")}</div>`;
            }

            const isSelected = this.selectedPitchSlot === index;

            // Eignung des Spielers auf genau dieser Position
            let fit = null;
            if (player && posEngine) {
                fit = posEngine.getSuitability(player, slot.pos);
                if (fit.familiarity < 0.7) {
                    misfits.push({ player, slot, fit });
                }
            }

            // Auf dem Trikot stehen Sterne, keine Zahl: Sie sagen sofort, ob
            // der Spieler für diese Position im eigenen Kader gut genug ist.
            const wirkStaerke = player ? (fit ? fit.effectiveOverall : player.overall) : null;
            const shirtValue = player
                ? this.starsFor(wirkStaerke, { title: `${player.name} auf ${slot.pos}`, color: "inherit" })
                : "–";
            const fitClass = fit ? `fit-${fit.level}` : "";
            const selectedStyle = isSelected ? "border-color:#f59e0b; box-shadow:0 0 12px #f59e0b;" : "";

            node.innerHTML = `
                <div class="pitch-node-shirt ${fitClass}" style="background: ${userClub.primaryColor}; color: ${userClub.secondaryColor}; ${selectedStyle}">
                    <span class="shirt-wert">${shirtValue}</span>
                    <span class="pitch-node-pos">${slot.pos}</span>
                </div>
                ${rolleHtml}
                <div class="pitch-node-name">
                    <span class="spielername">${player ? this.escapeHtml(player.name.split(" ").pop()) : "Leer"}</span>
                    ${fit ? `<span class="pitch-node-fit" style="color:${fit.color};">${fit.shortLabel}${fit.penalty > 0 ? ` −${fit.penalty}` : ""}</span>` : ""}
                </div>
            `;

            if (this.formationEditMode) {
                node.addEventListener("pointerdown", (e) => this.startSlotDrag(e, index));
            } else {
                node.addEventListener("click", () => this.handlePitchSlotClick(index));
            }

            pitchLayer.appendChild(node);
        });

        document.getElementById("tacticsPitch")?.classList.toggle("editing", this.formationEditMode);
        this.renderFormationEditorBar(userClub, slots);

        // Ersatzbank rendern
        const benchContainer = document.getElementById("benchSlots");
        benchContainer.innerHTML = "";

        const squadPlayers = state.players.filter(p => userClub.playerIds.includes(p.id));
        const benchPlayers = userClub.bench.map(id => squadPlayers.find(p => p.id === id)).filter(Boolean);
        const reservePlayers = squadPlayers.filter(p => !userClub.lineup.includes(p.id) && !userClub.bench.includes(p.id));

        // Ist ein Slot gewählt, zeigt die Bank die Eignung für genau diese Position
        const targetSlot = (this.selectedPitchSlot !== null) ? slots[this.selectedPitchSlot] : null;

        [...benchPlayers, ...reservePlayers].forEach(p => {
            const isBench = userClub.bench.includes(p.id);
            const isInj = p.injuredWeeks > 0;
            const isSusp = p.suspendedMatches > 0;

            const benchEl = document.createElement("div");
            benchEl.className = "bench-node";

            let fitHtml = "";
            if (targetSlot && posEngine) {
                const fit = posEngine.getSuitability(p, targetSlot.pos);
                fitHtml = `<span class="bench-fit" style="color:${fit.color};" title="${fit.label} auf ${targetSlot.pos}">
                    ${targetSlot.pos}: ${this.starsFor(fit.effectiveOverall, { color: fit.color })}
                </span>`;
            }

            benchEl.innerHTML = `
                <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span>
                <strong>${this.escapeHtml(p.name)}</strong> ${this.starsFor(p.overall, { title: `Stärke im Vergleich zum eigenen Kader` })}
                ${fitHtml}
                ${isInj ? "🚑" : isSusp ? "🟥" : isBench ? '<span style="color:#34d399">Bank</span>' : '<span style="color:#94a3b8">Res</span>'}
            `;

            benchEl.addEventListener("click", () => {
                this.handleBenchPlayerClick(p.id);
            });

            benchContainer.appendChild(benchEl);
        });

        this.renderLineupWarnings(misfits);

        // Rollen Dropdowns befüllen
        const lineupPlayers = userClub.lineup.map(id => state.players.find(p => p.id === id)).filter(Boolean);
        // "Automatisch" heißt: der Beste auf dem Platz. Vorher stand hier
        // immer der erste Spieler der Liste, auch wenn niemand bestimmt war.
        const populateRoleSelect = (elId, currentId, autoText = "Automatisch (der Beste auf dem Platz)") => {
            const el = document.getElementById(elId);
            const bestimmt = lineupPlayers.some(p => String(p.id) === String(currentId));
            el.innerHTML = `<option value="" ${bestimmt ? "" : "selected"}>${autoText}</option>` +
                lineupPlayers.map(p => `
                <option value="${this.escapeHtml(String(p.id))}" ${String(p.id) === String(currentId) ? "selected" : ""}>${this.escapeHtml(p.name)} (${p.pos}, ${this.starValueFor(p.overall).toFixed(1).replace(".", ",")} Sterne)</option>
            `).join("");
        };

        populateRoleSelect("roleCaptain", userClub.roles.captain, "Nicht bestimmt");
        populateRoleSelect("rolePenalty", userClub.roles.penaltyTaker);
        populateRoleSelect("roleFreeKick", userClub.roles.freeKickTaker);
        populateRoleSelect("roleCorner", userClub.roles.cornerTaker);
    }

    getTacticsEngine() {
        if (typeof TacticsEngine !== "undefined" && TacticsEngine) return TacticsEngine;
        if (typeof window !== "undefined" && window.TacticsEngine) return window.TacticsEngine;
        return null;
    }

    /** Taktik geaendert: speichern und neu zeichnen */
    taktikGeaendert(userClub, opts = {}) {
        if (opts.angepasst !== false && userClub.tactics) userClub.tactics.vorlageAngepasst = true;
        if (typeof this.app.state.saveToLocalStorage === "function") this.app.state.saveToLocalStorage();
        this.renderTactics();
    }

    /**
     * Die Taktik-Karten: Spielstil, Formen, Rollen, Anweisungen, Check.
     * Alles wird aus dem Taktikmodul gezeichnet - kommt dort eine Anweisung
     * oder Rolle dazu, erscheint sie hier von selbst.
     */
    renderTaktikPanels(userClub, slots) {
        const T = this.getTacticsEngine();
        if (!T) return;
        const t = userClub.tactics;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const configs = (typeof FORMATION_CONFIGS !== "undefined") ? FORMATION_CONFIGS : {};

        // Spielstil
        const vorlageSel = document.getElementById("tacVorlage");
        if (vorlageSel) {
            const aktuell = t.vorlage && T.VORLAGEN[t.vorlage] ? t.vorlage : "";
            vorlageSel.innerHTML = `<option value="">Eigene Taktik</option>` + Object.entries(T.VORLAGEN)
                .map(([k, v]) => `<option value="${esc(k)}" ${k === aktuell && !t.vorlageAngepasst ? "selected" : ""}>${esc(v.name)}${k === aktuell && t.vorlageAngepasst ? " (angepasst)" : ""}</option>`).join("");
            if (aktuell && t.vorlageAngepasst) vorlageSel.value = "";
            vorlageSel.onchange = (e) => {
                if (!e.target.value) return;
                T.wendeVorlageAn(t, e.target.value);
                t.vorlageAngepasst = false;
                this.taktikGeaendert(userClub, { angepasst: false });
                this.showToast(`Spielstil „${T.VORLAGEN[e.target.value].name}“ übernommen.`, "success");
            };
            const text = document.getElementById("tacVorlageText");
            if (text) text.textContent = aktuell ? T.VORLAGEN[aktuell].beschreibung : "Alle Einstellungen von Hand.";
        }

        // Formen mit und gegen den Ball
        const mitSel = document.getElementById("tacFormMit");
        if (mitSel) {
            const liste = T.formenMitBall(configs);
            const eigen = liste.filter(f => f.key === "auto" || f.key === "grund");
            const nurMit = liste.filter(f => f.nurMitBall);
            const rest = liste.filter(f => !f.nurMitBall && f.key !== "auto" && f.key !== "grund");
            const opt = f => `<option value="${esc(f.key)}" ${f.key === t.formMitBall ? "selected" : ""}>${esc(f.name)}</option>`;
            mitSel.innerHTML = eigen.map(opt).join("")
                + `<optgroup label="Formen mit Ball">${nurMit.map(opt).join("")}</optgroup>`
                + `<optgroup label="Formationen">${rest.map(opt).join("")}</optgroup>`;
            mitSel.onchange = (e) => { t.formMitBall = e.target.value; this.taktikAnsicht = "mit"; this.taktikGeaendert(userClub); };
        }
        const gegenSel = document.getElementById("tacFormGegen");
        if (gegenSel) {
            gegenSel.innerHTML = T.formenGegenBall(configs)
                .map(f => `<option value="${esc(f.key)}" ${f.key === t.formGegenBall ? "selected" : ""}>${esc(f.name)}</option>`).join("");
            gegenSel.onchange = (e) => { t.formGegenBall = e.target.value; this.taktikAnsicht = "gegen"; this.taktikGeaendert(userClub); };
        }

        // Aufstellung wie im FM26: eine Zeile je Spieler, die Rolle der
        // gewaehlten Phase mit Kuerzel, dazu Staerke und Kondition
        const rollenEl = document.getElementById("tacRollen");
        if (rollenEl) {
            const state = this.app.state;
            const rollen = T.rollenDerElf(userClub, slots);
            if (this.rollenPhase !== "gegen") this.rollenPhase = "mit";
            // Die Tafel und die Tabelle zeigen dieselbe Phase
            if (this.taktikAnsicht === "gegen") this.rollenPhase = "gegen";
            else if (this.taktikAnsicht === "mit") this.rollenPhase = "mit";
            const phase = this.rollenPhase;
            document.querySelectorAll("#tacRollenPhase [data-phase]").forEach(b => {
                b.classList.toggle("active", b.dataset.phase === phase);
                b.onclick = () => {
                    this.rollenPhase = b.dataset.phase;
                    if (this.taktikAnsicht === "mit" || this.taktikAnsicht === "gegen") this.taktikAnsicht = b.dataset.phase;
                    this.renderTactics();
                };
            });
            const ratingEngine = this.getRatingEngine ? this.getRatingEngine() : null;
            const ivAnzahl = slots.filter(q => this.getPositionEngine()?.normalizePosition(q.pos) === "IV").length;
            rollenEl.innerHTML = `
                <div class="aufst-kopfzeile" aria-hidden="true">
                    <span>Pos.</span><span>Spieler</span><span>Rolle ${phase === "gegen" ? "gegen den Ball" : "mit Ball"}</span><span>Kond.</span>
                </div>` + slots.map((slot, i) => {
                const r = rollen[i];
                const spieler = state.players.find(p => p.id === userClub.lineup[i]);
                const liste = phase === "gegen"
                    ? T.rollenGegenBall(r.familie)
                    : T.rollenMitBall(r.familie).filter(x => !x.nurDreier || ivAnzahl >= 3);
                const aktuelleId = phase === "gegen" ? r.gegen : r.mit;
                const rolle = phase === "gegen" ? T.rolleGegenBall(r.familie, r.gegen) : T.rolleMitBall(r.familie, r.mit);
                const kz = T.kuerzel(rolle, phase);
                const aktiv = this.selectedPitchSlot === i;
                const card = spieler && ratingEngine ? ratingEngine.calculateVisiblePlayerCard(spieler, Object.assign({ userClubId: userClub.id, leagueDataCoverage: 95 }, this.starContext())) : null;
                const fit = Math.round(spieler?.fitness ?? 100);
                const fitKlasse = fit >= 85 ? "gut" : (fit >= 70 ? "mittel" : "schwach");
                const nachname = spieler ? spieler.name.split(" ").slice(-1)[0] : "Leer";
                const vorname = spieler ? spieler.name.split(" ").slice(0, -1).join(" ") : "";
                return `
                    <div class="rollen-zeile ${aktiv ? "aktiv" : ""}" data-rollen-slot="${i}">
                        <span class="pos-tag pos-${this.getPosGroup(slot.pos)}">${esc(slot.pos)}</span>
                        <span class="aufst-spieler">
                            <span class="aufst-name">${vorname ? `<small>${esc(vorname.charAt(0))}.</small> ` : ""}${esc(nachname)}</span>
                            <span class="aufst-sterne">${card ? card.abilityStarsHtml : ""}</span>
                        </span>
                        <span class="aufst-rolle">
                            <span class="rolle-badge kat-${esc(kz.kategorie)}${phase === "gegen" ? " gegen" : ""}">${esc(kz.text)}</span>
                            <select class="styled-select" data-rolle-${phase}="${i}" aria-label="Rolle von ${esc(nachname)}" title="${esc(rolle.beschreibung)}">
                                ${liste.map(x => `<option value="${esc(x.id)}" ${x.id === aktuelleId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}
                            </select>
                        </span>
                        <span class="aufst-kond ${fitKlasse}" title="Kondition ${fit} %"><i style="width:${Math.max(4, Math.min(100, fit))}%"></i><b>${fit}</b></span>
                        ${aktiv ? `<div class="rollen-text"><strong>${esc(rolle.name)}:</strong> ${esc(rolle.beschreibung)}</div>` : ""}
                    </div>`;
            }).join("");
            const setze = (i, feld, wert) => {
                const aktuell = T.rollenDerElf(userClub, slots)[i];
                t.rollen[i] = { mit: aktuell.mit, gegen: aktuell.gegen, [feld]: wert };
                this.selectedPitchSlot = i;
                this.taktikGeaendert(userClub);
            };
            rollenEl.querySelectorAll("[data-rolle-mit]").forEach(sel => {
                sel.onchange = (e) => setze(Number(sel.dataset.rolleMit), "mit", e.target.value);
                sel.onclick = (e) => e.stopPropagation();
            });
            rollenEl.querySelectorAll("[data-rolle-gegen]").forEach(sel => {
                sel.onchange = (e) => setze(Number(sel.dataset.rolleGegen), "gegen", e.target.value);
                sel.onclick = (e) => e.stopPropagation();
            });
            rollenEl.querySelectorAll("[data-rollen-slot]").forEach(z => {
                z.onclick = () => {
                    const i = Number(z.dataset.rollenSlot);
                    this.selectedPitchSlot = this.selectedPitchSlot === i ? null : i;
                    this.renderTactics();
                };
            });
        }

        // Wie eingespielt die Mannschaft auf diese Taktik ist
        const vertrautEl = document.getElementById("tacVertrautheit");
        if (vertrautEl && T && typeof T.vertrautheitDetails === "function") {
            const d = T.vertrautheitDetails(userClub);
            const prozent = Math.round(d.gesamt * 100);
            const farbe = prozent >= 85 ? "#4ade80" : (prozent >= 65 ? "#facc15" : "#f87171");
            const kosten = Math.round((1 - T.vertrautheitsFaktor(userClub)) * 1000) / 10;
            vertrautEl.innerHTML = `
                <div class="vertrautheit-kopf">
                    <span>Taktische Vertrautheit</span>
                    <strong style="color:${farbe};">${prozent} %</strong>
                </div>
                <div class="vertrautheit-balken"><span style="width:${prozent}%; background:${farbe};"></span></div>
                <div class="vertrautheit-text">
                    ${d.formation < 0.85 ? `Die Formation <strong>${esc(userClub.formation || "")}</strong> ist noch neu (${Math.round(d.formation * 100)} %). ` : ""}
                    ${d.neu.length ? `Noch nicht eingespielt: ${d.neu.map(n => `${esc(n.label)} „${esc(n.wert)}“ (${Math.round(n.vertraut * 100)} %)`).join(", ")}. ` : ""}
                    ${kosten > 0.2 ? `Das kostet im Spiel etwa ${String(kosten).replace(".", ",")} % Stärke - Spiele und Taktiktraining schleifen es ein.` : "Die Mannschaft kennt ihre Abläufe."}
                </div>`;
        }

        // Mannschaftsanweisungen als Kacheln, getrennt nach Mit Ball und
        // Gegen den Ball - wie im FM26
        const anwEl = document.getElementById("tacAnweisungen");
        if (anwEl) {
            if (this.anwPhase !== "gegenBall") this.anwPhase = "mitBall";
            document.querySelectorAll("#tacAnwPhase [data-phase]").forEach(b => {
                b.classList.toggle("active", b.dataset.phase === this.anwPhase);
                b.setAttribute("aria-selected", b.dataset.phase === this.anwPhase ? "true" : "false");
                b.onclick = () => { this.anwPhase = b.dataset.phase; this.renderTactics(); };
            });
            const liste = T.ANWEISUNGEN.filter(a => a.phase === this.anwPhase);
            anwEl.innerHTML = liste.map(a => {
                const wert = T.wert(t, a.key);
                const index = Math.max(0, a.optionen.findIndex(o => o.value === wert));
                const option = a.optionen[index];
                const geaendert = wert !== a.standard;
                // Die Skala zeigt, wo der Wert zwischen den Optionen liegt
                const skala = a.optionen.length <= 5
                    ? `<span class="anw-skala" aria-hidden="true">${a.optionen.map((o, i) => `<i class="${i === index ? "an" : ""}"></i>`).join("")}</span>`
                    : "";
                return `
                    <label class="anw-kachel${geaendert ? " geaendert" : ""}" ${a.hilfe ? `title="${esc(a.hilfe)}"` : ""}>
                        <span class="anw-kopf">
                            <svg class="ico" aria-hidden="true"><use href="#${esc(a.icon || "i-sliders")}"/></svg>
                            <span class="anw-titel">${esc(a.label)}</span>
                        </span>
                        <span class="anw-wert">${esc(option ? option.label : wert)}</span>
                        ${skala}
                        <select data-anweisung="${a.key}" aria-label="${esc(a.label)}">
                            ${a.optionen.map(o => `<option value="${esc(o.value)}" ${o.value === wert ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
                        </select>
                    </label>`;
            }).join("");
            anwEl.querySelectorAll("[data-anweisung]").forEach(sel => {
                sel.onchange = (e) => {
                    t[sel.dataset.anweisung] = e.target.value;
                    if (sel.dataset.anweisung === "focus") t.attackFocus = e.target.value;
                    this.taktikGeaendert(userClub);
                };
            });
        }

        // Verbindungen mit Erklaerung - auf dem Handy gibt es kein Hovern
        const verbEl = document.getElementById("tacVerbindungen");
        if (verbEl) {
            const phase = this.taktikAnsicht === "gegen" ? "gegen" : "mit";
            const state = this.app.state;
            const nameVon = i => {
                const sp = state.players.find(p => p.id === userClub.lineup[i]);
                return sp ? sp.name.split(" ").pop() : slots[i].pos;
            };
            const reihenfolge = { schwach: 0, stark: 1, gut: 2 };
            const liste = T.verbindungen(userClub, slots, phase).sort((a, b) => reihenfolge[a.guete] - reihenfolge[b.guete]);
            verbEl.innerHTML = `<li class="gut"><strong>${phase === "gegen" ? "Gegen den Ball" : "Mit Ball"}</strong></li>` + liste
                .map(v => `<li class="${v.guete}"><strong>${esc(nameVon(v.a))} – ${esc(nameVon(v.b))}:</strong> ${esc(v.text)}</li>`).join("");
        }

        // Taktik-Check
        const checkEl = document.getElementById("tacCheck");
        if (checkEl) {
            checkEl.innerHTML = T.pruefe(userClub, slots)
                .map(h => `<li class="${h.art === "warn" ? "warn" : ""}">${esc(h.text)}</li>`).join("");
        }
    }

    escapeHtml(text) {
        return String(text ?? "").replace(/[&<>"']/g, ch => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[ch]));
    }

    /** Die Signatur-Eigenschaft eines Topspielers (Name, Symbol, Text) oder null */
    signaturVon(player) {
        const eig = (typeof EigenschaftenEngine !== "undefined") ? EigenschaftenEngine
            : (typeof window !== "undefined" ? window.EigenschaftenEngine : null);
        return eig && player ? eig.signaturVon(player) : null;
    }

    /** Kleines Symbol hinter dem Namen in Listen - mit Namen als Tooltip */
    signaturMarke(player) {
        const s = this.signaturVon(player);
        return s ? ` <span class="signatur-mini" title="${this.escapeHtml(s.name + ": " + s.text)}">${s.icon}</span>` : "";
    }

    /**
     * Hinweisbox mit Spielern, die deutlich außerhalb ihrer Position spielen
     */
    renderLineupWarnings(misfits) {
        const benchSection = document.querySelector(".bench-section");
        if (!benchSection) return;

        let box = document.getElementById("lineupWarnings");
        if (!box) {
            box = document.createElement("div");
            box.id = "lineupWarnings";
            box.className = "lineup-warning";
            benchSection.parentElement.appendChild(box);
        }

        if (!misfits || misfits.length === 0) {
            box.style.display = "none";
            return;
        }

        const items = misfits
            .sort((a, b) => a.fit.familiarity - b.fit.familiarity)
            .slice(0, 5)
            .map(m => `<li><strong>${this.escapeHtml(m.player.name)}</strong> (${m.player.pos}) auf ${m.slot.pos}: ${m.fit.label} · ${m.player.overall} → <strong>${m.fit.effectiveOverall}</strong></li>`)
            .join("");

        box.style.display = "block";
        box.innerHTML = `
            <strong>⚠️ Spieler außerhalb ihrer Position</strong>
            <ul style="margin:6px 0 0 16px; padding:0;">${items}</ul>
        `;
    }

    // ------------------------------------------------------- Formations-Editor

    /**
     * Zustand der Editorleiste aktualisieren
     */
    renderFormationEditorBar(userClub, slots) {
        const bar = document.getElementById("formationEditorBar");
        const btnEdit = document.getElementById("btnFormationEdit");
        if (!bar || !btnEdit) return;

        bar.style.display = this.formationEditMode ? "flex" : "none";
        btnEdit.innerHTML = this.formationEditMode
            ? '<svg class="ico" aria-hidden="true"><use href="#i-check"/></svg><span>Bearbeitung beenden</span>'
            : '<svg class="ico" aria-hidden="true"><use href="#i-edit"/></svg><span>Formation bearbeiten</span>';
        btnEdit.classList.toggle("btn-primary", this.formationEditMode);

        if (!this.formationEditMode) return;

        const posEngine = this.getPositionEngine();
        const badge = document.getElementById("formationShapeBadge");
        if (badge && posEngine) {
            badge.textContent = posEngine.detectFormationShape(slots);
        }

        // Positionsauswahl für den markierten Slot
        const select = document.getElementById("selectSlotPosition");
        if (select && posEngine) {
            const slot = (this.selectedPitchSlot !== null) ? slots[this.selectedPitchSlot] : null;
            if (!slot) {
                select.innerHTML = `<option value="">– Spieler auswählen –</option>`;
                select.disabled = true;
            } else {
                select.disabled = false;
                select.innerHTML = posEngine.ALL_POSITIONS.map(p =>
                    `<option value="${p}" ${p === slot.pos ? "selected" : ""}>${p} – ${posEngine.POSITION_META[p].name}</option>`
                ).join("");
            }
        }

        const hint = document.getElementById("formationEditorHint");
        if (hint) {
            hint.textContent = this.formationDirty
                ? "Geändert – als eigene Formation speichern, um die Aufstellung zu behalten."
                : "Spieler mit der Maus (oder dem Finger) auf dem Raster verschieben.";
        }

        const nameInput = document.getElementById("inputFormationName");
        if (nameInput && !nameInput.dataset.touched) {
            const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS) ? FORMATION_CONFIGS : (window.FORMATION_CONFIGS || {});
            const current = configs[userClub.formation];
            nameInput.value = (current && current.custom) ? current.name : "";
            nameInput.placeholder = `z. B. ${posEngine ? posEngine.detectFormationShape(slots) : "4-4-2"} Gegenpressing`;
        }

        const btnDelete = document.getElementById("btnFormationDelete");
        if (btnDelete) {
            const isCustom = GameState.isCustomFormation(userClub.formation);
            btnDelete.style.display = isCustom ? "inline-flex" : "none";
        }
    }

    /**
     * Bearbeitungsmodus umschalten
     */
    toggleFormationEditMode() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        this.formationEditMode = !this.formationEditMode;

        if (this.formationEditMode) {
            // Arbeitskopie der aktuellen Formation anlegen
            const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS) ? FORMATION_CONFIGS : (window.FORMATION_CONFIGS || {});
            const cfg = configs[userClub.formation] || configs["4-4-2"];
            this.formationDraft = (cfg?.positions || []).map(s => ({ ...s }));
            this.formationDirty = false;
            const nameInput = document.getElementById("inputFormationName");
            if (nameInput) delete nameInput.dataset.touched;
        } else {
            if (this.formationDirty) {
                this.showToast("Änderungen verworfen – nicht gespeicherte Formation.", "info");
            }
            this.formationDraft = null;
            this.formationDirty = false;
            this.selectedPitchSlot = null;
        }

        this.playSound("click");
        this.renderTactics();
    }

    /**
     * Zieht einen Spieler frei über das Raster
     */
    startSlotDrag(event, slotIndex) {
        if (!this.formationEditMode || !Array.isArray(this.formationDraft)) return;

        const pitch = document.getElementById("tacticsPitch");
        const node = event.currentTarget;
        if (!pitch || !node) return;

        event.preventDefault();
        this.selectedPitchSlot = slotIndex;
        node.classList.add("dragging");
        node.setPointerCapture?.(event.pointerId);

        const snapEnabled = () => document.getElementById("chkFormationSnap")?.checked !== false;
        const posEngine = this.getPositionEngine();

        const moveTo = (clientX, clientY) => {
            const rect = pitch.getBoundingClientRect();
            let x = ((clientX - rect.left) / rect.width) * 100;
            let y = ((clientY - rect.top) / rect.height) * 100;

            x = Math.max(4, Math.min(96, x));
            y = Math.max(4, Math.min(96, y));

            if (snapEnabled()) {
                // 20 Spalten x 12 Reihen wie im Raster-Overlay
                x = Math.round(x / 5) * 5;
                y = Math.round(y / (100 / 12)) * (100 / 12);
                x = Math.max(4, Math.min(96, x));
                y = Math.max(4, Math.min(96, y));
            }

            const slot = this.formationDraft[slotIndex];
            slot.x = Math.round(x * 10) / 10;
            slot.y = Math.round(y * 10) / 10;

            // Position folgt automatisch der Zone, solange sie nicht manuell gesetzt wurde
            if (posEngine && !slot.manualPos) {
                const detected = posEngine.detectPositionFromCoords(slot.x, slot.y);
                slot.pos = detected;
                slot.role = posEngine.POSITION_META[detected]?.name || detected;
            }

            node.style.left = `${slot.x}%`;
            node.style.top = `${slot.y}%`;
            const posBadge = node.querySelector(".pitch-node-pos");
            if (posBadge) posBadge.textContent = slot.pos;

            this.formationDirty = true;
        };

        const onMove = (e) => moveTo(e.clientX, e.clientY);

        const onUp = () => {
            node.classList.remove("dragging");
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            this.renderTactics();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    }

    /**
     * Eigene Formation speichern
     */
    saveCustomFormation() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub || !Array.isArray(this.formationDraft)) return;

        const nameInput = document.getElementById("inputFormationName");
        const posEngine = this.getPositionEngine();
        const shape = posEngine ? posEngine.detectFormationShape(this.formationDraft) : "Eigene";
        const name = (nameInput?.value || "").trim() || `${shape} (eigene)`;

        const existingKey = GameState.isCustomFormation(userClub.formation) ? userClub.formation : null;
        const result = GameState.saveCustomFormation(state, name, this.formationDraft, existingKey);

        if (!result.success) {
            this.showToast(result.error, "error");
            return;
        }

        // Die Slots werden beim Speichern von hinten nach vorne sortiert -
        // die Aufstellung wird identisch umsortiert, damit jeder Spieler
        // auf genau der Position stehen bleibt, auf die er gezogen wurde.
        if (Array.isArray(result.order) && Array.isArray(userClub.lineup)) {
            userClub.lineup = result.order.map(sourceIndex => userClub.lineup[sourceIndex]).filter(id => id !== undefined);
        }

        userClub.formation = result.key;
        this.formationDraft = (FORMATION_CONFIGS[result.key].positions || []).map(s => ({ ...s }));
        this.formationDirty = false;
        this.selectedPitchSlot = null;

        if (nameInput) delete nameInput.dataset.touched;

        this.playSound("click");
        this.showToast(`Formation "${result.name}" (${result.shape}) gespeichert.`, "success");
        this.renderTactics();
    }

    /**
     * Entwurf auf die gespeicherte Formation zurücksetzen
     */
    resetFormationDraft() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS) ? FORMATION_CONFIGS : (window.FORMATION_CONFIGS || {});
        const cfg = configs[userClub.formation] || configs["4-4-2"];
        this.formationDraft = (cfg?.positions || []).map(s => ({ ...s }));
        this.formationDirty = false;
        this.selectedPitchSlot = null;
        this.renderTactics();
    }

    /**
     * Eigene Formation löschen
     */
    deleteCustomFormation() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub || !GameState.isCustomFormation(userClub.formation)) return;

        const key = userClub.formation;
        const result = GameState.deleteCustomFormation(state, key);
        if (!result.success) {
            this.showToast(result.error, "error");
            return;
        }

        this.formationEditMode = false;
        this.formationDraft = null;
        this.formationDirty = false;
        this.selectedPitchSlot = null;
        GameState.autoSetLineupForClub(userClub, state.players);

        this.showToast("Eigene Formation gelöscht – zurück auf 4-4-2.", "info");
        this.renderTactics();
    }

    handlePitchSlotClick(slotIndex) {
        if (this.selectedPitchSlot === slotIndex) {
            this.selectedPitchSlot = null;
        } else if (this.selectedPitchSlot !== null) {
            // Tausche zwei Startelf-Spieler
            const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
            const temp = userClub.lineup[this.selectedPitchSlot];
            userClub.lineup[this.selectedPitchSlot] = userClub.lineup[slotIndex];
            userClub.lineup[slotIndex] = temp;
            this.selectedPitchSlot = null;
            this.playSound("click");
        } else {
            this.selectedPitchSlot = slotIndex;
            this.playSound("click");
        }
        this.renderTactics();
    }

    handleBenchPlayerClick(playerId) {
        const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
        if (this.selectedPitchSlot !== null) {
            // Tausche ausgewählten Startelf-Slot mit diesem Bankspieler
            const oldPlayerId = userClub.lineup[this.selectedPitchSlot];
            userClub.lineup[this.selectedPitchSlot] = playerId;

            // Aus Bank/Reserve entfernen und alten Spieler dort einfügen
            userClub.bench = userClub.bench.filter(id => id !== playerId);
            if (oldPlayerId && !userClub.bench.includes(oldPlayerId) && userClub.bench.length < 7) {
                userClub.bench.push(oldPlayerId);
            }

            this.selectedPitchSlot = null;
            this.playSound("click");
            this.renderTactics();
        }
    }

    /**
     * Spielplan & Tabelle rendern
     */
    /**
     * Welche Tabellenplätze wohin führen - genau nach den Regeln, die die
     * CompetitionEngine am Saisonende anwendet: Europapokalplätze der
     * Topligen, Aufstiegsplätze laut Ligadefinition und so viele Absteiger,
     * wie aus den Ligen darunter aufsteigen.
     */
    tabellenZonen(state, ligaId, anzahl) {
        const zonen = new Map();
        const ligen = state.leagues || [];
        const liga = ligen.find(l => l.id === ligaId);
        if (!liga || !anzahl) return zonen;

        const eu = liga.europeanSpots;
        if (eu && (liga.level || 1) === 1) {
            (eu.championsLeague || []).forEach(p => zonen.set(p, "ucl"));
            (eu.europaLeague || []).forEach(p => zonen.set(p, "uel"));
            (eu.conferenceLeague || []).forEach(p => zonen.set(p, "uecl"));
        }
        if (ligen.length > 1) {
            const po = typeof PlayoffEngine !== "undefined" ? PlayoffEngine : null;
            const direkt = l => po ? po.direktePlaetze(l) : ((l.promotionSpots && l.promotionSpots.length) ? l.promotionSpots : [1]);
            if (liga.promotionTo) {
                direkt(liga).forEach(p => zonen.set(p, "auf"));
                // Relegation oder Aufstiegs-Playoffs
                const f = po?.FORMATE?.[liga.id];
                if (f) (f.art === "relegation" ? [f.unten] : (f.plaetze || [])).forEach(p => zonen.set(p, "po"));
            }
            const kinder = ligen.filter(l => l.promotionTo === liga.id);
            // Aus Playoffs steigt sicher einer auf - aus der Relegation nur vielleicht
            const aufsteiger = kinder.reduce((summe, l) => summe + direkt(l).length + (po && po.sichererAufsteiger(l.id) ? 1 : 0), 0);
            const absteiger = Math.min(aufsteiger, anzahl - 1);
            for (let p = anzahl - absteiger + 1; p <= anzahl; p++) zonen.set(p, "ab");
            kinder.forEach(l => {
                const f = po?.FORMATE?.[l.id];
                if (f && f.oben && f.oben.liga === liga.id) zonen.set(f.oben.platz, "rel");
            });
        }
        return zonen;
    }

    renderFixturesAndStandings() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const userLeagueId = this.getUserLeagueId(state);
        const activeComp = this.activeCompetitionId || state.activeCompetitionId || userLeagueId;

        this.populateCompetitionSelect(state, activeComp);

        // Der gewählte Wettbewerb färbt den ganzen Reiter
        this.setzeThema(document.getElementById("pane-fixtures"),
            this.wettbewerbsThema(activeComp));

        const tbody = document.getElementById("fullStandingsBody");
        const fixturesList = document.getElementById("fixturesList");
        const tabelle = document.getElementById("fullStandingsTable");
        const legende = document.getElementById("standingsLegend");
        if (legende) legende.innerHTML = "";

        // Pokal- und Endrunden haben keine Tabellenspalten; der Kopf "Platz,
        // Spiele, Punkte" stand dort über Paarungen und Ergebnissen.
        const cupIds = Object.keys(state.cups || {});
        const europa = ["ucl", "uel", "uecl"].includes(activeComp);
        const endrunde = europa && (state.europeanCompetitions?.[activeComp]?.endrunde || []).length > 0;
        if (tabelle) tabelle.classList.toggle("tabelle-runden", cupIds.includes(activeComp) || endrunde);

        if (cupIds.includes(activeComp)) {
            this.renderPokalTableau(state, state.cups[activeComp], tbody, fixturesList, userClub);
            return;
        }
        if (activeComp === "playoffs") {
            if (tabelle) tabelle.classList.add("tabelle-runden");
            this.renderPlayoffs(state, state.playoffs || state.playoffsVorjahr, tbody, fixturesList, userClub);
            return;
        }

        if (europa) {
            this.renderEuropapokal(state, state.europeanCompetitions?.[activeComp], tbody, fixturesList, userClub);
            return;
        }

        // 1. Standard-Liga Tabelle rendern - auch für fremde Ligen der Welt
        const isOwnLeague = activeComp === userLeagueId;
        const table = isOwnLeague
            ? state.standings
            : ((state.standingsByLeague && state.standingsByLeague[activeComp]) || []);

        if (!table.length) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-muted" style="text-align:center; padding:20px;">Für diesen Wettbewerb liegt noch keine Tabelle vor.</td></tr>`;
            if (fixturesList) fixturesList.innerHTML = "";
            return;
        }

        const zonen = this.tabellenZonen(state, activeComp, table.length);
        tbody.innerHTML = table.map((s, idx) => {
            const isUser = s.clubId === userClub.id;
            const zone = zonen.get(idx + 1);
            const club = state.clubs.find(c => c.id === s.clubId);
            const naechsteZone = zonen.get(idx + 2);
            const grenze = zone !== naechsteZone && idx < table.length - 1 ? " zonen-grenze" : "";
            return `
                <tr class="${isUser ? 'row-user-club' : ''}${grenze}" data-club-id="${this.escapeHtml(s.clubId)}">
                    <td class="tb-platz"><span class="rang${zone ? ` rang-${zone}` : ""}" title="${zone ? UIManager.ZONEN[zone] : ""}">${idx + 1}</span></td>
                    <td class="tb-verein"><span class="tb-verein-inhalt"><span class="mini-wappen" data-club="${this.escapeHtml(s.clubId)}"></span><strong>${this.escapeHtml(s.clubName || club?.name || "")}</strong></span></td>
                    <td class="tb-sp">${s.played}</td>
                    <td class="tb-s">${s.won}</td>
                    <td class="tb-u">${s.drawn}</td>
                    <td class="tb-n">${s.lost}</td>
                    <td class="tb-tore nowrap">${s.goalsFor}:${s.goalsAgainst}</td>
                    <td class="tb-diff">${this.vorzeichen(s.goalDiff)}</td>
                    <td class="tb-pkt"><strong>${s.points}</strong></td>
                    <td class="tb-form">
                        <div class="form-indicators">
                            ${(s.form || []).map(f => this.formPunkt(f)).join("")}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
        tbody.querySelectorAll(".mini-wappen").forEach(el => {
            const club = state.clubs.find(c => String(c.id) === el.dataset.club);
            if (club) {
                this.setzeWappen(el, club);
                el.textContent = this.vereinsKuerzel(club.name).slice(0, 1);
            }
        });
        // Ein Klick auf einen Verein öffnet seine Details
        this.bindVereinsZeilen(tbody);
        if (legende) {
            const genutzt = [...new Set(zonen.values())];
            legende.innerHTML = genutzt.map(z =>
                `<span class="legende-eintrag"><span class="rang rang-${z}"></span>${UIManager.ZONEN[z]}</span>`
            ).join("");
        }

        // 2. Spielplan rendern
        const schedule = this.getScheduleForLeague(state, activeComp);
        const totalRounds = schedule.length || state.totalMatchdays;
        const matchday = Math.min(Math.max(1, this.currentFixtureMatchday), Math.max(1, totalRounds));

        document.getElementById("fixtureMatchdayTitle").textContent = `Spieltag ${matchday} von ${totalRounds}`;
        const round = schedule.find(r => r.matchday === matchday);

        if (round) {
            fixturesList.innerHTML = round.matches.map(m => {
                const home = state.clubs.find(c => c.id === m.homeClubId);
                const away = state.clubs.find(c => c.id === m.awayClubId);
                const isUserMatch = home?.id === userClub.id || away?.id === userClub.id;
                const scoreText = m.played ? `${m.homeGoals} : ${m.awayGoals}` : "vs";

                // Ein Derby steht im Spielplan, nicht im Kleingedruckten
                const derby = m.isDerby
                    ? `<div class="fixture-derby">🔥 ${this.escapeHtml(m.derbyTitle || "Derby")}</div>`
                    : "";
                const zuschauer = m.played && m.attendance
                    ? `<div class="fixture-crowd">${m.attendance.toLocaleString("de-DE")} Zuschauer${m.soldOut ? " · ausverkauft" : ""}</div>`
                    : "";

                return `
                    <div class="fixture-card ${isUserMatch ? 'user-match' : ''} ${m.isDerby ? 'derby-match' : ''}">
                        ${derby}
                        <div class="fixture-team home${home ? " vd-link" : ""}" ${home ? `data-club-link="${this.escapeHtml(home.id)}"` : ""}>${this.escapeHtml(home?.name || "Heim")}</div>
                        <div class="fixture-score-badge">${scoreText}</div>
                        <div class="fixture-team away${away ? " vd-link" : ""}" ${away ? `data-club-link="${this.escapeHtml(away.id)}"` : ""}>${this.escapeHtml(away?.name || "Auswärts")}</div>
                        ${zuschauer}
                    </div>
                `;
            }).join("");
            // Auch im Spielplan führt ein Vereinsname zu den Details
            fixturesList.querySelectorAll("[data-club-link]").forEach(el => {
                el.onclick = () => this.showClubDetailsModal(el.dataset.clubLink);
            });
        } else {
            fixturesList.innerHTML = `<div class="text-muted text-center" style="padding:20px;">Für diesen Spieltag liegen keine Partien vor.</div>`;
        }
    }

    /**
     * Das Pokal-Tableau: alle gespielten Runden, die aktuelle oben.
     *
     * Vorher stand hier eine einzige, nie ausgetragene erste Runde - der
     * Wettbewerb bestand aus 32 Paarungen, die nie ein Ergebnis bekamen.
     */
    /**
     * Relegation und Aufstiegs-Playoffs: alle Länder, Runde für Runde, mit
     * Hin- und Rückspiel, Verlängerung und Elfmeterschießen. Der Wettbewerb
     * des eigenen Landes steht oben.
     */
    renderPlayoffs(state, po, tbody, fixturesList, userClub) {
        const titel = document.getElementById("fixtureMatchdayTitle");
        const esc = t => this.escapeHtml(t == null ? "" : String(t));
        const name = id => state.clubs.find(c => c.id === id)?.name || "?";
        if (!po || !Array.isArray(po.wettbewerbe) || !po.wettbewerbe.length) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-muted" style="text-align:center;padding:20px;">In dieser Saison gibt es keine Relegation.</td></tr>`;
            if (fixturesList) fixturesList.innerHTML = "";
            return;
        }
        const land = state.clubs.find(c => c.id === state.userClubId)?.countryId;
        const reihe = [...po.wettbewerbe].sort((a, b) =>
            ((a.ligaId || "").startsWith(land + "_") ? 0 : 1) - ((b.ligaId || "").startsWith(land + "_") ? 0 : 1));
        if (titel) titel.textContent = po.saison === state.seasonYear ? "Relegation und Aufstiegsspiele" : "Relegation und Aufstiegsspiele der Vorsaison";

        const stand = w => {
            const e = w.ergebnis;
            if (!w.fertig || !e) return "läuft";
            if (w.direkt) return `${name(e.aufsteiger)} steigt direkt auf`;
            if (e.absteiger) return `${name(e.aufsteiger)} steigt auf, ${name(e.absteiger)} ab`;
            if (e.gehalten) return `${name(e.gehalten)} bleibt drin`;
            return `${name(e.aufsteiger)} steigt auf`;
        };
        const ergebnis = m => {
            if (!m.played) return "offen";
            let t = `${m.homeGoals} : ${m.awayGoals}`;
            if (Array.isArray(m.verlaengerung)) t += ` <small>(n. V. ${m.homeGoals + m.verlaengerung[0]}:${m.awayGoals + m.verlaengerung[1]})</small>`;
            if (m.penaltyScore) t += ` <small>(${m.penaltyScore[0]}:${m.penaltyScore[1]} i. E.)</small>`;
            return t;
        };
        tbody.innerHTML = reihe.map(w => {
            const kopf = `<tr style="background: rgba(245, 158, 11, 0.15);"><td colspan="10" style="font-weight:700; color:#f59e0b;">⚔️ ${esc(w.name)} · ${esc(stand(w))}</td></tr>`;
            const runden = (w.runden || []).map(r => {
                const zeilen = r.paarungen.map(p => p.spiele.map((m, i) => {
                    const isUser = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                    const weiter = i === p.spiele.length - 1 && p.sieger ? name(p.sieger) : "";
                    return `<tr class="${isUser ? "row-user-club" : ""}">
                        <td colspan="5">${esc(name(m.homeClubId))} – ${esc(name(m.awayClubId))}${p.spiele.length > 1 ? ` <small class="text-muted">${i === 0 ? "Hinspiel" : "Rückspiel"}</small>` : ""}</td>
                        <td colspan="3"><span class="badge ${m.played ? "badge-status-fit" : ""}">${ergebnis(m)}</span></td>
                        <td colspan="2">${esc(weiter)}</td>
                    </tr>`;
                }).join("")).join("");
                return `<tr><td colspan="10" class="text-muted" style="font-size:12px;">${esc(r.name)}</td></tr>${zeilen}`;
            }).join("");
            return kopf + runden;
        }).join("");

        // Spielplan: die eigenen Partien, sonst die des eigenen Landes
        if (fixturesList) {
            const eigene = reihe.filter(w => (w.teilnehmer || []).some(t => t.clubId === userClub?.id));
            const quelle = eigene.length ? eigene : reihe.slice(0, 1);
            const karten = quelle.flatMap(w => (w.runden[w.rundeIndex]?.paarungen || []).flatMap(p => p.spiele)).map(m => {
                const isUserMatch = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                return `<div class="fixture-card ${isUserMatch ? "user-match" : ""}">
                    <div class="fixture-team home">${esc(name(m.homeClubId))}</div>
                    <div class="fixture-score-badge">${m.played ? ergebnis(m) : "vs"}</div>
                    <div class="fixture-team away">${esc(name(m.awayClubId))}</div>
                </div>`;
            });
            fixturesList.innerHTML = karten.join("");
        }
    }

    renderPokalTableau(state, cup, tbody, fixturesList, userClub) {
        const titel = document.getElementById("fixtureMatchdayTitle");
        if (!cup || !Array.isArray(cup.runden)) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-muted" style="text-align:center;padding:20px;">Für diesen Pokal liegt noch kein Tableau vor.</td></tr>`;
            if (fixturesList) fixturesList.innerHTML = "";
            return;
        }

        const aktuelle = cup.runden[cup.rundenIndex] || cup.runden[cup.runden.length - 1];
        const sieger = cup.winnerId ? state.clubs.find(c => c.id === cup.winnerId) : null;

        if (titel) {
            titel.textContent = sieger
                ? `${cup.name}: Sieger ${sieger.name}`
                : `${cup.name}: ${aktuelle?.roundName || "Auslosung"}`;
        }

        // Tabelle: der Weg durch das Turnier, Runde für Runde
        tbody.innerHTML = [...cup.runden].reverse().map(runde => {
            const kopf = `
                <tr style="background: rgba(245, 158, 11, 0.15);">
                    <td colspan="10" style="font-weight:700; color:#f59e0b;">
                        🏆 ${this.escapeHtml(runde.roundName)}
                        ${runde.completed ? "" : " · läuft"}
                    </td>
                </tr>`;

            const zeilen = runde.matches.map(m => {
                const home = state.clubs.find(c => c.id === m.homeClubId);
                const away = state.clubs.find(c => c.id === m.awayClubId);
                const isUser = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                const elfer = m.penaltyScore ? ` <small>(${m.penaltyScore[0]}:${m.penaltyScore[1]} i. E.)</small>` : "";
                const score = m.played ? `${m.homeGoals} : ${m.awayGoals}${elfer}` : "offen";
                const weiter = m.played ? this.siegerName(state, m) : "";
                return `
                    <tr class="${isUser ? 'row-user-club' : ''}">
                        <td colspan="5">${this.escapeHtml(home?.name || "Heim")} – ${this.escapeHtml(away?.name || "Auswärts")}</td>
                        <td colspan="3"><span class="badge ${m.played ? 'badge-status-fit' : ''}">${score}</span></td>
                        <td colspan="2">${this.escapeHtml(weiter)}</td>
                    </tr>`;
            }).join("");

            return kopf + zeilen;
        }).join("");

        // Spielplan: die aktuelle Runde als Karten
        if (fixturesList && aktuelle) {
            fixturesList.innerHTML = aktuelle.matches.map(m => {
                const home = state.clubs.find(c => c.id === m.homeClubId);
                const away = state.clubs.find(c => c.id === m.awayClubId);
                const isUserMatch = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                const elfer = m.penaltyScore ? ` (${m.penaltyScore[0]}:${m.penaltyScore[1]} i. E.)` : "";
                const scoreText = m.played ? `${m.homeGoals} : ${m.awayGoals}${elfer}` : "vs";
                return `
                    <div class="fixture-card ${isUserMatch ? 'user-match' : ''}">
                        <div class="fixture-team home">${this.escapeHtml(home?.name || "Heim")}</div>
                        <div class="fixture-score-badge">${scoreText}</div>
                        <div class="fixture-team away">${this.escapeHtml(away?.name || "Auswärts")}</div>
                    </div>`;
            }).join("");
        }
    }

    siegerName(state, match) {
        const cup = this.getCupEngine();
        if (!cup || typeof cup.siegerVon !== "function") return "";
        const club = state.clubs.find(c => c.id === cup.siegerVon(match));
        return club ? `${club.name} weiter` : "";
    }

    /**
     * Europapokal: Gruppentabellen in der Gruppenphase, Tableau in der
     * Endrunde.
     */
    renderEuropapokal(state, comp, tbody, fixturesList, userClub) {
        const titel = document.getElementById("fixtureMatchdayTitle");
        if (!comp) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-muted" style="text-align:center;padding:20px;">Dieser Wettbewerb läuft gerade nicht.</td></tr>`;
            if (fixturesList) fixturesList.innerHTML = "";
            return;
        }

        const inEndrunde = (comp.endrunde || []).length > 0;

        if (inEndrunde) {
            const sieger = comp.winnerId ? state.clubs.find(c => c.id === comp.winnerId) : null;
            if (titel) {
                titel.textContent = sieger
                    ? `${comp.name}: Sieger ${sieger.name}`
                    : `${comp.name} - Endrunde`;
            }
            tbody.innerHTML = [...comp.endrunde].reverse().map(runde => {
                const kopf = `
                    <tr style="background: rgba(56, 189, 248, 0.15);">
                        <td colspan="10" style="font-weight:700; color:#38bdf8;">⭐ ${this.escapeHtml(runde.roundName)}</td>
                    </tr>`;
                const zeilen = runde.matches.map(m => {
                    const home = state.clubs.find(c => c.id === m.homeClubId);
                    const away = state.clubs.find(c => c.id === m.awayClubId);
                    const isUser = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                    const elfer = m.penaltyScore ? ` <small>(${m.penaltyScore[0]}:${m.penaltyScore[1]} i. E.)</small>` : "";
                    return `
                        <tr class="${isUser ? 'row-user-club' : ''}">
                            <td colspan="6">${this.escapeHtml(home?.name || "Heim")} – ${this.escapeHtml(away?.name || "Auswärts")}</td>
                            <td colspan="4"><span class="badge ${m.played ? 'badge-status-fit' : ''}">${m.played ? `${m.homeGoals} : ${m.awayGoals}${elfer}` : "offen"}</span></td>
                        </tr>`;
                }).join("");
                return kopf + zeilen;
            }).join("");

            if (fixturesList) {
                const aktuelle = comp.endrunde[comp.endrundeIndex] || comp.endrunde[comp.endrunde.length - 1];
                fixturesList.innerHTML = (aktuelle?.matches || []).map(m => {
                    const home = state.clubs.find(c => c.id === m.homeClubId);
                    const away = state.clubs.find(c => c.id === m.awayClubId);
                    const isUserMatch = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                    return `
                        <div class="fixture-card ${isUserMatch ? 'user-match' : ''}">
                            <div class="fixture-team home">${this.escapeHtml(home?.name || "Heim")}</div>
                            <div class="fixture-score-badge">${m.played ? `${m.homeGoals} : ${m.awayGoals}` : "vs"}</div>
                            <div class="fixture-team away">${this.escapeHtml(away?.name || "Auswärts")}</div>
                        </div>`;
                }).join("");
            }
            return;
        }

        // Gruppenphase
        tbody.innerHTML = (comp.groups || []).map(g => {
            const kopf = `
                <tr style="background: rgba(56, 189, 248, 0.15);">
                    <td colspan="10" style="font-weight:700; color:#38bdf8;">${this.escapeHtml(comp.name)} - ${this.escapeHtml(g.groupName)}</td>
                </tr>`;
            const zeilen = (g.standings || []).map((s, idx) => {
                const club = state.clubs.find(c => c.id === s.clubId);
                const isUser = s.clubId === userClub?.id;
                return `
                    <tr class="${isUser ? 'row-user-club' : ''}${idx === 1 ? ' zonen-grenze' : ''}">
                        <td class="tb-platz"><span class="rang${idx < 2 ? ' rang-ucl' : ''}">${idx + 1}</span></td>
                        <td class="tb-verein"><strong>${this.escapeHtml(club?.name || s.clubId)}</strong></td>
                        <td class="tb-sp">${s.played}</td>
                        <td class="tb-s">${s.won}</td>
                        <td class="tb-u">${s.drawn}</td>
                        <td class="tb-n">${s.lost}</td>
                        <td class="tb-tore nowrap">${s.goalsFor}:${s.goalsAgainst}</td>
                        <td class="tb-diff">${this.vorzeichen(s.goalsFor - s.goalsAgainst)}</td>
                        <td class="tb-pkt"><strong>${s.points}</strong></td>
                        <td class="tb-form"><span class="badge ${idx < 2 ? 'badge-status-fit' : ''}">${idx < 2 ? 'Weiter' : 'Gruppe'}</span></td>
                    </tr>`;
            }).join("");
            return kopf + zeilen;
        }).join("");

        const spieltag = (comp.spieltage || [])[comp.spieltagIndex || 0]
            || (comp.spieltage || []).find(t => !t.completed)
            || (comp.spieltage || [])[(comp.spieltage || []).length - 1];

        if (titel) titel.textContent = `${comp.name} - ${spieltag?.roundName || "Gruppenphase"}`;

        if (fixturesList) {
            fixturesList.innerHTML = (spieltag?.matches || []).map(m => {
                const home = state.clubs.find(c => c.id === m.homeClubId);
                const away = state.clubs.find(c => c.id === m.awayClubId);
                const isUserMatch = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                return `
                    <div class="fixture-card ${isUserMatch ? 'user-match' : ''}">
                        <div class="fixture-team home">${this.escapeHtml(home?.name || "Heim")}</div>
                        <div class="fixture-score-badge">${m.played ? `${m.homeGoals} : ${m.awayGoals}` : "vs"}</div>
                        <div class="fixture-team away">${this.escapeHtml(away?.name || "Auswärts")}</div>
                    </div>`;
            }).join("")
                || `<div class="text-muted text-center" style="padding:20px;">Für diesen Spieltag liegen keine Partien vor.</div>`;
        }
    }

    /** Liga des Nutzervereins */
    getUserLeagueId(state) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        return club?.leagueId || state.userLeagueId || "de_liga_1";
    }

    /** Spielplan einer beliebigen Liga */
    getScheduleForLeague(state, leagueId) {
        if (!leagueId || leagueId === this.getUserLeagueId(state)) return state.schedule || [];
        return (state.otherSchedules && state.otherSchedules[leagueId]) || [];
    }

    /**
     * Baut die Wettbewerbsauswahl aus der tatsächlichen Spielwelt: alle zwölf
     * Ligen, der nationale Pokal und die drei europäischen Wettbewerbe.
     */
    populateCompetitionSelect(state, activeComp) {
        const select = document.getElementById("selectCompetitionView");
        if (!select) return;

        const FLAGS = { de: "🇩🇪", en: "🏴", es: "🇪🇸", it: "🇮🇹", fr: "🇫🇷" };
        const leagues = [...(state.leagues || [])].sort((a, b) =>
            (a.countryId || "").localeCompare(b.countryId || "") || (a.level || 1) - (b.level || 1));

        const options = leagues.map(l =>
            `<option value="${this.escapeHtml(l.id)}">${FLAGS[l.countryId] || "🏆"} ${this.escapeHtml(l.shortName || l.name)}</option>`);

        Object.keys(state.cups || {}).forEach(cupId => {
            const comp = (state.competitions || []).find(c => c.id === cupId);
            const name = state.cups[cupId]?.name || comp?.name || cupId;
            options.push(`<option value="${this.escapeHtml(cupId)}">🏆 ${this.escapeHtml(name)}</option>`);
        });

        [["ucl", "⭐ Champions League"], ["uel", "🌍 Europa League"], ["uecl", "🏆 Conference League"]].forEach(([id, label]) => {
            if (state.europeanCompetitions?.[id]) {
                options.push(`<option value="${id}">${label}</option>`);
            }
        });
        if (state.playoffs || state.playoffsVorjahr) {
            options.push(`<option value="playoffs">⚔️ Relegation & Playoffs${state.playoffs ? "" : " (Vorjahr)"}</option>`);
        }

        const signature = options.length + "|" + (state.seasonYear || 1);
        if (select._competitionSignature !== signature) {
            select.innerHTML = options.join("");
            select._competitionSignature = signature;
        }
        select.value = activeComp;
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

    /**
     * Training rendern & Jugendakademie anzeigen
     */
    /**
     * Die individuellen Pläne im Trainings-Reiter: alle mit Plan, dazu die
     * jungen Spieler mit ihrer Spielpraxis - wer nicht spielt, ist ein
     * Kandidat für eine Leihe.
     */
    renderTrainingsPlaene() {
        const body = document.getElementById("trainingPlaeneBody");
        const engine = this.getDevelopmentPlanEngine();
        if (!body || !engine) return;
        const state = this.app.state;
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!club) return;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const ids = new Set(club.playerIds.map(String));
        const kader = state.players.filter(p => ids.has(String(p.id)));
        const zeilen = kader
            .filter(p => p.trainingsfokus || p.umschulung || p.mentorId || (p.age || 30) <= 23)
            .sort((a, b) => (a.age || 0) - (b.age || 0));
        const meta = document.getElementById("trainingPlaeneMeta");
        if (meta) meta.textContent = `${kader.filter(p => p.trainingsfokus || p.umschulung || p.mentorId).length} mit Plan`;
        if (!zeilen.length) {
            body.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Noch keine individuellen Pläne.</td></tr>`;
            return;
        }
        body.innerHTML = zeilen.map(p => {
            const praxis = Math.round((typeof p.spielpraxis === "number" ? p.spielpraxis : 0.5) * 100);
            const mentor = p.mentorId ? state.players.find(m => String(m.id) === String(p.mentorId)) : null;
            return `
                <tr class="clickable-row" data-player-id="${esc(p.id)}">
                    <td><strong>${esc(p.name)}</strong> <span class="text-muted">${esc(p.pos)}</span></td>
                    <td>${p.age}</td>
                    <td><span class="${praxis < 30 && (p.age || 30) <= 23 ? "text-warning" : ""}">${praxis} %</span></td>
                    <td>${p.trainingsfokus ? esc(engine.SCHWERPUNKTE[p.trainingsfokus]?.label) : "-"}</td>
                    <td>${p.umschulung ? `${esc(p.umschulung.pos)} · ${engine.umschulungsStand(p)} %` : "-"}</td>
                    <td>${mentor ? esc(mentor.name) : "-"}</td>
                </tr>`;
        }).join("");
        body.querySelectorAll("tr[data-player-id]").forEach(tr => tr.addEventListener("click", () => {
            const ziel = state.players.find(p => String(p.id) === tr.dataset.playerId);
            if (ziel) this.showPlayerDetailsModal(ziel.id);
        }));
    }

    renderTraining() {
        const state = this.app.state;
        const currentFocus = state.trainingSettings?.focus || "allround";
        const currentIntensity = state.trainingSettings?.intensity || "normal";

        const focusRadio = document.querySelector(`input[name="trainFocus"][value="${currentFocus}"]`);
        if (focusRadio) focusRadio.checked = true;

        const intensityRadio = document.querySelector(`input[name="trainIntensity"][value="${currentIntensity}"]`);
        if (intensityRadio) intensityRadio.checked = true;

        this.renderCoachingStaffCard();
        this.renderTrainingsPlaene();

        // Jugendakademie rendern
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const levelBadge = document.getElementById("youthAcademyLevelBadge");
        if (levelBadge && userClub) {
            const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
            const anlage = userClub.anlagen?.youthCenter;
            const level = anlage?.stufe ?? userClub.facilities?.youthCenter ?? state.youthAcademy?.level ?? 1;
            const schule = (typeof YouthEngine !== "undefined" && YouthEngine.schuleVon)
                ? YouthEngine.schuleVon(userClub) : null;

            let text = `Akademie: Stufe ${level}`;
            if (anlage && fac) text += ` · ${fac.zustandsText(anlage.zustand)}`;
            if (schule) text += ` · ${schule.name}`;
            if (anlage?.projekt) {
                text += ` · Umbau (noch ${anlage.projekt.restSpieltage} ST)`;
            }
            levelBadge.textContent = text;
            levelBadge.title = anlage
                ? `Wirksame Stufe: ${fac ? fac.wirksameStufe(userClub, "youthCenter", state.seasonYear || 1) : level}`
                  + ` — Zustand ${Math.round(anlage.zustand)} %`
                : "";
            // Der Knopf zeigt den echten Preis statt fester 2,5 Millionen
            const knopf = document.getElementById("btnUpgradeYouthAcademy");
            if (knopf && fac) {
                const preis = level < 5 ? fac.kosten(userClub, "youthCenter", "ausbau", state.seasonYear || 1) : 0;
                knopf.textContent = level >= 5 ? "Akademie: höchste Stufe"
                    : anlage?.projekt ? "Akademie im Umbau"
                    : `Akademie ausbauen (${this.geldKurz(preis)})`;
                knopf.disabled = level >= 5 || !!anlage?.projekt;
            }
        }

        this.renderTrainingReport();
        this.renderAkademieSchwerpunkte(state, userClub);
        this.renderAkademieZugang(state);

        const engine = this.getNegotiationEngine();
        const prospectsBody = document.getElementById("youthProspectsBody");
        if (prospectsBody) {
            // Nach dem Laden standen die Talente in zwei getrennten Listen -
            // die Beförderung erschien dann hier nicht
            const youthListe = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : window.YouthEngine;
            const alleTalente = youthListe && typeof youthListe.eigeneTalente === "function"
                ? youthListe.eigeneTalente(state)
                : (state.youthAcademy?.prospects || []);
            const prospects = alleTalente.filter(p => !p.promoted);
            if (prospects.length === 0) {
                prospectsBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Aktuell keine unbeförderten Jugendspieler in der Akademie.</td></tr>`;
            } else {
                const laufende = engine
                    ? engine.getOpenNegotiations(state).filter(n => n.type === "youth_promotion")
                    : [];

                // Ältere Spielstände kennen noch keine Talentwerte - nachrüsten,
                // sonst bliebe die Spielerakte des Jungen leer
                const generator = this.getPlayerGenerator();
                if (generator && typeof generator.completeYouthProspect === "function") {
                    let ergaenzt = false;
                    prospects.forEach(p => { if (generator.completeYouthProspect(p)) ergaenzt = true; });
                    // Talente, die noch wie für einen Bundesligisten erzeugt
                    // wurden, bekommen ligagerechte Werte
                    const youth = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : window.YouthEngine;
                    if (youth && typeof youth.passeTalenteAnLigaAn === "function"
                        && youth.passeTalenteAnLigaAn(state, state.userClubId) > 0) ergaenzt = true;
                    if (ergaenzt && typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                }

                prospectsBody.innerHTML = prospects.map(p => {
                    const gespraech = laufende.find(n => String(n.prospectId) === String(p.id));

                    const standHtml = gespraech
                        ? `<div style="font-size:12px;">
                               <strong>${this.escapeHtml(gespraech.agentName)}</strong>
                               <div class="text-muted">${this.escapeHtml(engine.describe(gespraech))}</div>
                           </div>`
                        : `<span class="text-muted" style="font-size:12px;">Noch keine Gespräche</span>`;

                    const aktion = gespraech
                        ? `<button class="btn btn-sm btn-secondary btn-goto-negotiation" data-neg-id="${this.escapeHtml(gespraech.id)}">Zur Verhandlung</button>`
                        : `<button class="btn btn-sm btn-primary btn-promote-prospect" data-prospect-id="${p.id}">Vertragsgespräche aufnehmen</button>
                           <button class="btn btn-sm btn-secondary btn-release-prospect" data-prospect-id="${p.id}" title="Platz in der Akademie freimachen">Freigeben</button>`;
                    const quelle = ({ probetraining: "Probetraining", sichtung: "Sichtungstag" })[p.quelle];

                    return `
                    <tr class="row-clickable" data-prospect-id="${p.id}" title="Spielerakte von ${this.escapeHtml(p.name)} öffnen">
                        <td><strong>${this.escapeHtml(p.name)}</strong>${quelle ? ` <span class="talent-quelle">${quelle}</span>` : ""}</td>
                        <td><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span></td>
                        <td>${p.age} Jahre</td>
                        <td colspan="2">${this.abilityStarsFor(p)}</td>
                        <td>${standHtml}</td>
                        <td>${aktion}</td>
                    </tr>
                `;
                }).join("");

                // Ein Klick auf die Zeile öffnet die vollständige Spielerakte
                prospectsBody.querySelectorAll("tr.row-clickable").forEach(row => {
                    row.addEventListener("click", (e) => {
                        if (e.target.closest("button")) return;
                        this.showPlayerDetailsModal(row.dataset.prospectId);
                    });
                });

                // Die Beförderung läuft über den Berater und dauert einige Tage
                document.querySelectorAll(".btn-promote-prospect").forEach(btn => {
                    btn.addEventListener("click", () => {
                        if (!engine) {
                            this.showToast("Verhandlungen sind derzeit nicht verfügbar.", "error");
                            return;
                        }
                        const res = engine.startYouthPromotion(state, userClub.id, btn.dataset.prospectId);
                        if (res.success) {
                            this.playSound("click");
                            this.showToast(
                                `Berater ${res.negotiation.agentName} verhandelt über den Erstvertrag. Erste Forderung: ${this.formatMoneySafe(res.negotiation.demand.wage)} pro Woche.`,
                                "success", 6000);
                            // Gleich zur Verhandlung: Der Berater wartet auf unser Angebot
                            this.zeigeVerhandlung(res.negotiation.id);
                        } else {
                            this.showToast(res.error || "Gespräche konnten nicht aufgenommen werden.", "error");
                        }
                    });
                });

                document.querySelectorAll(".btn-release-prospect").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const youth = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : window.YouthEngine;
                        const talent = prospects.find(t => String(t.id) === btn.dataset.prospectId);
                        if (!youth || !talent) return;
                        if (typeof confirm === "function" && !confirm(`${talent.name} aus der Akademie freigeben?`)) return;
                        const res = youth.talentFreigeben(state, talent.id);
                        if (!res.success) return this.showToast(res.error, "error");
                        this.showToast(`${talent.name} verlässt die Akademie.`, "info");
                        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                        this.renderTraining();
                    });
                });

                document.querySelectorAll(".btn-goto-negotiation").forEach(btn => {
                    btn.addEventListener("click", () => this.zeigeVerhandlung(btn.dataset.negId));
                });
            }
        }
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
                <label class="ak-wv">Weiterverkaufsbeteiligung
                    <select class="styled-select" data-wv-offer="${o.id}">
                        <option value="0">keine</option>
                        <option value="10">10 % (Ablöse −5 %)</option>
                        <option value="20">20 % (Ablöse −10 %)</option>
                    </select>
                </label>
                <div class="ak-knoepfe">
                    <button class="btn btn-sm btn-primary btn-accept-offer" data-offer-id="${o.id}">Annehmen</button>
                    <button class="btn btn-sm btn-secondary btn-more-offer" data-offer-id="${o.id}"${o.nachgebessert ? " disabled title=\"Der Verein hat schon nachgebessert\"" : ""}>Mehr fordern</button>
                    <button class="btn btn-sm btn-secondary btn-reject-offer" data-offer-id="${o.id}">Ablehnen</button>
                </div>
            </article>`;
    }

    /** Angebot annehmen - der Spieler wechselt sofort */
    nimmAngebotAn(offerId) {
        const state = this.app.state;
        const wahl = document.querySelector(`[data-wv-offer="${offerId}"]`);
        const r = TransferEngine.nimmAngebotAn(state, offerId, { weiterverkauf: parseInt(wahl?.value || "0", 10) });
        if (!r.ok) { this.showToast(r.grund || "Das Angebot liegt nicht mehr vor.", "error"); return false; }
        this.playSound("goal");
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
     * Ein Angebot im Dialog: beim Eingang oder wenn man mehr fordern will.
     * Mehr fordern geht einmal - der Käufer geht mit, bessert bis zu seiner
     * Grenze nach oder zieht zurück, wenn es maßlos wird.
     */
    zeigeAngebotDialog(offerId, fordern = false) {
        const state = this.app.state;
        const o = (state.transferMarket?.offers || []).find(x => String(x.id) === String(offerId));
        if (!o || o.status !== "pending") return;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const vorschlag = Math.round(o.fee * 1.2 / 50000) * 50000;
        const kannFordern = !o.nachgebessert;

        const html = `
            <div class="angebot-dialog">${this.angebotKarteHtml(o, state, club).replace(/<div class="ak-knoepfe">[\s\S]*?<\/div>/, "")}</div>
            ${kannFordern ? `<div class="verh-eingabe" style="margin-top:12px;">
                <label>Ihre Forderung (Ablöse)
                    <input type="number" id="angebotForderung" class="styled-input" min="0" step="50000" value="${vorschlag}">
                </label>
            </div>
            <div class="verh-antwort" id="angebotAntwort">${fordern ? "Nachgebessert wird nur einmal. Wer zu viel verlangt, verliert das Angebot." : ""}</div>`
            : `<div class="verh-antwort">${esc(o.fromClubName)} hat bereits nachgebessert - jetzt heißt es annehmen oder ablehnen.</div>`}`;

        const knoepfe = [
            { text: "Später entscheiden", klasse: "btn-secondary" },
            { text: "Ablehnen", klasse: "btn-secondary", aktion: () => { this.lehneAngebotAb(o.id); } }
        ];
        if (kannFordern) {
            knoepfe.push({
                text: "Mehr fordern", klasse: "btn-secondary", aktion: () => {
                    const betrag = Number(document.getElementById("angebotForderung")?.value) || 0;
                    const r = TransferEngine.fordereMehr(state, o.id, betrag);
                    if (r.status === "fehler") {
                        const a = document.getElementById("angebotAntwort");
                        if (a) a.innerHTML = `<span style="color:var(--accent-danger);">${esc(r.text)}</span>`;
                        return false;
                    }
                    if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                    this.showToast(r.text, r.status === "zurueckgezogen" ? "warning" : "info", 6000);
                    this.renderHeader();
                    this.renderCurrentTab();
                    // Wer mitgeht oder nachbessert, wartet auf die Antwort
                    if (r.status !== "zurueckgezogen") setTimeout(() => this.zeigeAngebotDialog(o.id), 0);
                }
            });
        }
        knoepfe.push({ text: `Annehmen (${this.geldKurz(o.fee)})`, klasse: "btn-primary", aktion: () => { this.nimmAngebotAn(o.id); } });

        this.zeigeEntscheidung({
            titel: `💰 Angebot für ${o.playerName}`,
            html,
            knoepfe,
            nachOeffnen: (inhalt) => {
                const feld = inhalt.querySelector("#angebotForderung");
                if (feld && fordern) feld.focus();
            }
        });
    }

    /**
     * Neue Angebote melden sich selbst: Nach dem Weiterklicken geht für das
     * erste noch nicht gemeldete Angebot ein Dialog auf - aber nur, wenn
     * gerade kein anderes Fenster offen ist.
     */
    pruefeNeueAngebote() {
        const state = this.app.state;
        const neu = (state?.transferMarket?.offers || []).filter(o => o.status === "pending" && o.gemeldet === false);
        if (!neu.length) return false;
        const offen = [...document.querySelectorAll(".modal-overlay")].some(m => m.style.display && m.style.display !== "none");
        if (offen) return false;
        neu.forEach(o => { o.gemeldet = true; });
        this.playSound("click");
        this.zeigeAngebotDialog(neu[0].id);
        if (neu.length > 1) {
            this.showToast(`Dazu ${neu.length - 1} weitere${neu.length === 2 ? "s" : ""} Angebot${neu.length === 2 ? "" : "e"} - alle im Transfermarkt ganz oben.`, "info", 6000);
        }
        return true;
    }

    /**
     * Schwerpunkte der Jugendakademie: Ausbildung, Positionen, Jahrgang und
     * Einzugsgebiet. Alles wirkt auf den nächsten Jahrgang; darunter steht,
     * was der Manager damit bekommt und was es kostet.
     */
    /**
     * Woher die Talente kommen: Jugendtag, Probetrainings unter dem Jahr und
     * der Sichtungstag, den der Manager selbst ansetzt.
     */
    renderAkademieZugang(state) {
        const box = document.getElementById("youthZugang");
        const youth = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : (typeof window !== "undefined" ? window.YouthEngine : null);
        if (!box || !youth || typeof youth.sichtungsLage !== "function") return;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const lage = youth.sichtungsLage(state);
        const chance = youth.probetrainingChance(state, club);
        const wochen = Math.max(1, Math.round(1 / chance / 7));
        const jugendtag = youth.jugendtagSpieltag(state);
        const jugendtagText = (state.youthAcademy?.jugendtagSaison === state.seasonYear)
            ? "Der Jugendtag dieser Saison war schon"
            : `Jugendtag um den ${jugendtag}. Spieltag`;
        const knopf = lage.warten > 0
            ? `<button class="btn btn-sm btn-secondary" disabled>Nächster Sichtungstag in ${lage.warten} Tagen</button>`
            : lage.plaetze.frei <= 0
                ? `<button class="btn btn-sm btn-secondary" disabled>Akademie voll</button>`
                : `<button class="btn btn-sm btn-primary" id="btnSichtungstag">Sichtungstag ansetzen (${this.formatMoneySafe(lage.kosten)})</button>`;
        box.innerHTML = `
            <div class="akademie-zugang">
                <div class="akademie-zugang-text">
                    <strong>${lage.plaetze.belegt} von ${lage.plaetze.plaetze} Plätzen belegt</strong>
                    <span>${this.escapeHtml(jugendtagText)} · Probetrainings etwa alle ${wochen} Wochen · Mit ${youth.AKADEMIE_HOECHSTALTER} ist ohne Vertrag Schluss</span>
                </div>
                ${knopf}
            </div>`;
        document.getElementById("btnSichtungstag")?.addEventListener("click", () => {
            const res = youth.sichtungstag(state);
            if (!res.success) return this.showToast(res.error, "error");
            this.playSound("click");
            this.showToast(`🎓 Sichtungstag: ${res.neu.map(t => t.name).join(", ")} ${res.neu.length === 1 ? "kommt" : "kommen"} in die Akademie.`, "success", 6000);
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderHeader();
            this.renderTraining();
        });
    }

    renderAkademieSchwerpunkte(state, club) {
        const box = document.getElementById("youthSchwerpunkte");
        const youth = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine
            : ((typeof window !== "undefined" && window.YouthEngine) ? window.YouthEngine : null);
        if (!box || !club || !youth || typeof youth.schwerpunkteVon !== "function") return;

        const fac = (typeof FacilityEngine !== "undefined" && FacilityEngine) ? FacilityEngine
            : ((typeof window !== "undefined" && window.FacilityEngine) ? window.FacilityEngine : null);
        const profile = fac?.AKADEMIE_PROFILE || {};
        const sp = youth.schwerpunkteVon(club);
        const saison = state.seasonYear || 1;
        const profilGesperrt = sp.profilSaison === saison;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const ATTR = {
            technique: "Technik", passing: "Passspiel", dribbling: "Dribbling", physical: "Physis", pace: "Tempo",
            stamina: "Ausdauer", vision: "Übersicht", positioning: "Stellungsspiel", defense: "Zweikampf"
        };

        const chip = (gruppe, wert, text, aktiv, titel = "", gesperrt = false) =>
            `<button type="button" class="sp-chip${aktiv ? " aktiv" : ""}" data-sp="${gruppe}" data-wert="${esc(wert)}"`
            + `${titel ? ` title="${esc(titel)}"` : ""}${gesperrt && !aktiv ? " disabled" : ""}>${esc(text)}</button>`;

        const profilChips = Object.entries(profile).map(([key, p]) => {
            const titel = p.staerken?.length
                ? `Stärker: ${p.staerken.map(a => ATTR[a] || a).join(", ")}${p.schwaechen?.length ? ` · schwächer: ${p.schwaechen.map(a => ATTR[a] || a).join(", ")}` : ""}`
                : "Keine Handschrift - alle Fähigkeiten gleich gewichtet";
            return chip("profil", key, p.name, sp.profil === key, titel, profilGesperrt);
        }).join("");
        const posChips = Object.entries(youth.SCHWERPUNKT_POSITIONEN).map(([key, g]) =>
            chip("positionen", key, g.name, sp.positionen.includes(key), g.positionen.join(", "))).join("");
        const jahrgangChips = Object.entries(youth.JAHRGAENGE).map(([key, j]) =>
            chip("jahrgang", key, `${j.name} (${j.anzahl})`, sp.jahrgang === key, j.text)).join("");
        const einzugChips = Object.entries(youth.EINZUG).map(([key, e]) => {
            const kosten = youth.einzugKosten(club, key);
            return chip("einzug", key, `${e.name}${kosten > 0 ? ` · ${this.geldKurz(kosten)}` : ""}`, sp.einzug === key, e.text);
        }).join("");

        // Der Nachwuchsleiter entscheidet mit
        const stab = this.getCoachingStaffEngine();
        const leiterGuete = stab ? stab.staffQuality(club).nachwuchs : null;
        const leiter = club.staff?.nachwuchs;
        const leiterBonus = typeof youth.leiterBonus === "function" ? youth.leiterBonus(state, club) : 0;
        const leiterText = leiterGuete === null ? ""
            : leiterBonus > 0 ? `holt mehr aus jedem Jahrgang heraus (Potenzial +${leiterBonus})`
            : leiterBonus < 0 ? `kostet jeden Jahrgang Potenzial (${leiterBonus})${leiter ? "" : " - der Posten ist offen"}`
            : "arbeitet solide";

        const jahrgang = youth.JAHRGAENGE[sp.jahrgang];
        const einzug = youth.EINZUG[sp.einzug];
        const potSumme = jahrgang.pot + einzug.pot + leiterBonus;
        const kosten = youth.einzugKosten(club, sp.einzug);
        // Wann der nächste Jahrgang kommt: am Jugendtag im Frühjahr
        const tagJugend = typeof youth.jugendtagSpieltag === "function" ? youth.jugendtagSpieltag(state) : null;
        const schonGewesen = state.youthAcademy?.jugendtagSaison === (state.seasonYear || 1);
        const jugendtagText = tagJugend === null ? "zum Saisonstart"
            : schonGewesen ? `am Jugendtag der nächsten Saison (um den ${tagJugend}. Spieltag)`
            : (() => {
                const rest = tagJugend - (state.currentMatchday || 1);
                return `am Jugendtag um den ${tagJugend}. Spieltag`
                    + (rest > 1 ? ` (noch ${rest} Spieltage)` : rest === 1 ? " (nächster Spieltag)" : "");
            })();
        const posText = sp.positionen.length
            ? sp.positionen.map(k => youth.SCHWERPUNKT_POSITIONEN[k].name).join(" und ")
            : "alle Positionen";

        box.innerHTML = `
            ${leiterGuete !== null ? `<div class="akademie-leiter">🎓 <span class="stab-info-titel">Nachwuchsleiter</span>
                <strong>${esc(leiter?.name || "Posten offen · Aushilfe")}</strong> ${this.stabSterneHtml(leiterGuete)}
                <span class="text-muted">${esc(leiterText)}</span></div>` : ""}
            <div class="sp-gruppe">
                <div class="sp-titel">Ausbildung <span class="sp-hinweis">${profilGesperrt ? "in dieser Saison schon umgestellt" : "einmal je Saison änderbar"}</span></div>
                <div class="sp-reihe">${profilChips}</div>
            </div>
            <div class="sp-gruppe">
                <div class="sp-titel">Positionen <span class="sp-hinweis">bis zu zwei Schwerpunkte</span></div>
                <div class="sp-reihe">${posChips}</div>
            </div>
            <div class="sp-gruppe">
                <div class="sp-titel">Jahrgang</div>
                <div class="sp-reihe">${jahrgangChips}</div>
            </div>
            <div class="sp-gruppe">
                <div class="sp-titel">Einzugsgebiet <span class="sp-hinweis">Kosten je Jahrgang</span></div>
                <div class="sp-reihe">${einzugChips}</div>
            </div>
            <div class="sp-fazit">Nächster Jahrgang ${jugendtagText}: <strong>${jahrgang.anzahl} Talente</strong>, Schwerpunkt ${esc(posText)},
                Potenzial <strong>${potSumme >= 0 ? "+" : ""}${potSumme}</strong> gegenüber einem normalen Jahrgang${kosten > 0 ? `, Sichtung ${this.geldKurz(kosten)}` : ""}.</div>`;

        box.querySelectorAll(".sp-chip").forEach(btn => {
            btn.addEventListener("click", () => {
                const gruppe = btn.dataset.sp;
                const wert = btn.dataset.wert;
                let aenderung;
                if (gruppe === "positionen") {
                    const liste = sp.positionen.includes(wert)
                        ? sp.positionen.filter(k => k !== wert)
                        : [...sp.positionen, wert];
                    // Beim dritten Klick fällt der älteste Schwerpunkt heraus
                    aenderung = { positionen: liste.slice(-2) };
                } else {
                    aenderung = { [gruppe]: wert };
                }
                const res = youth.setzeSchwerpunkte(state, club.id, aenderung);
                if (!res.ok) {
                    this.showToast(res.meldung, "warning");
                    return;
                }
                if (gruppe === "profil") {
                    this.showToast(`Die Akademie bildet ab dem nächsten Jahrgang als ${profile[wert]?.name || wert} aus.`, "success");
                }
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderTraining();
            });
        });
    }

    /**
     * Der Trainerstab und sein aktueller Plan.
     *
     * Der Manager sieht, wer gerade entscheidet und warum. Ändert er einen
     * Schwerpunkt, wird daraus automatisch ein Veto - hier steht dann, wie
     * lange es noch gilt.
     */
    renderCoachingStaffCard() {
        const body = document.getElementById("staffPlanBody");
        const tag = document.getElementById("staffQualityTag");
        const btn = document.getElementById("btnStaffTakeOver");
        if (!body) return;

        const state = this.app.state;
        const staff = this.getCoachingStaffEngine();
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!staff || !club) return;

        const stab = staff.staffQuality(club);
        const veto = staff.activeVeto(state);
        const plan = state.trainingSettings?.lastPlan;

        if (tag) {
            tag.textContent = `${stab.titel} · ${stab.overall}`;
            tag.style.background = stab.overall >= 68 ? "rgba(34,197,94,0.18)"
                : stab.overall >= 48 ? "rgba(56,189,248,0.18)" : "rgba(148,163,184,0.18)";
        }

        const fach = (name, wert) => `
            <div class="stab-fach">
                <span class="stab-fach-name">${name}</span>
                <span class="mini-bar"><span class="mini-bar-fill" style="width:${wert}%"></span></span>
                <strong>${wert}</strong>
            </div>`;

        const planText = plan
            ? `<div class="hint-box" style="margin:10px 0 0;">
                   <strong>${plan.vomManager ? "Ihre Vorgabe" : "Plan des Stabs"}:</strong>
                   ${this.escapeHtml(staff.focusLabel(plan.focus))}, ${this.escapeHtml(staff.intensityLabel(plan.intensity))}<br>
                   <span class="text-muted">${this.escapeHtml(plan.grund || "")}</span>
               </div>`
            : `<div class="hint-box" style="margin:10px 0 0;">Der Stab plant die erste Einheit, sobald der nächste Tag beginnt.</div>`;

        body.innerHTML = `
            <p class="text-muted" style="margin:0 0 10px; font-size:12px;">
                Sie führen den Verein, nicht die Trainingsgruppe: Der Stab plant die Einheiten selbst.
                Ändern Sie Schwerpunkt oder Intensität, gilt Ihre Vorgabe für ${staff.VETO_DAUER_TAGE} Tage.
            </p>
            <div class="stab-faecher">
                ${fach("Co-Trainer (Livespiel)", stab.coTrainer ?? stab.analyse)}
                ${fach("Athletik & Fitness", stab.fitness)}
                ${fach("Spielanalyse", stab.analyse)}
                ${fach("Medizinische Abteilung", stab.medizin)}
                ${fach("Nachwuchsarbeit", stab.nachwuchs)}
            </div>
            ${planText}
            ${veto ? `<div style="margin-top:8px; color:#f59e0b; font-weight:600; font-size:12px;">
                ⏳ Ihr Veto gilt noch ${veto.daysRemaining} Tag(e).</div>` : ""}
        `;

        if (btn) btn.style.display = veto ? "inline-flex" : "none";
    }

    /**
     * Trainingsbericht zwischen den Spieltagen: Belastung, Ermüdung,
     * Spielschärfe, Verletzungsrisiko und Entwicklung je Spieler.
     */
    renderTrainingReport() {
        const state = this.app.state;
        const body = document.getElementById("trainingReportBody");
        const meta = document.getElementById("trainingReportMeta");
        if (!body) return;

        const trainingEngine = (typeof TrainingEngine !== "undefined" && TrainingEngine)
            ? TrainingEngine
            : ((typeof window !== "undefined" && window.TrainingEngine) ? window.TrainingEngine : null);

        const report = (trainingEngine && typeof trainingEngine.buildTrainingReport === "function")
            ? trainingEngine.buildTrainingReport(state, state.userClubId)
            : state.trainingReport;

        if (!report || !Array.isArray(report.entries) || report.entries.length === 0) {
            body.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Noch kein Trainingstag absolviert.</td></tr>`;
            return;
        }

        const INTENSITAET = { low: "Locker", normal: "Normal", high: "Intensiv" };
        if (meta) {
            meta.textContent = `${report.date || "Aktuell"} · Intensität: ${INTENSITAET[report.intensity] || report.intensity}`;
        }

        body.innerHTML = report.entries.map(e => {
            const risikoFarbe = e.injuryRiskPercent >= 5 ? "#f87171" : e.injuryRiskPercent >= 2 ? "#f59e0b" : "#34d399";
            const ermuedungFarbe = e.fatigue >= 45 ? "#f87171" : e.fatigue >= 28 ? "#f59e0b" : "#34d399";
            const entwicklung = e.developmentWeek > 0
                ? `<span style="color:#34d399;">+${e.developmentWeek}</span>`
                : (e.developmentWeek < 0 ? `<span style="color:#f87171;">${e.developmentWeek}</span>` : `<span class="text-muted">–</span>`);

            return `
                <tr class="row-clickable" data-player-id="${e.playerId}" title="Details zu ${this.escapeHtml(e.name)} öffnen">
                    <td class="nowrap"><strong>${this.escapeHtml(e.name)}</strong> <span class="text-muted" style="font-size:11px;">${e.age} J.</span></td>
                    <td><span class="pos-tag pos-${this.getPosGroup(e.pos)}">${e.pos}</span></td>
                    <td class="nowrap">
                        <span class="mini-bar"><span class="mini-bar-fill" style="width:${Math.round(e.fitness)}%;background:${this.fitnessFarbe(e.fitness)}"></span></span>
                        ${Math.round(e.fitness)}%
                    </td>
                    <td><strong style="color:${ermuedungFarbe};">${Math.round(e.fatigue)}</strong></td>
                    <td>${String(e.load).replace(".", ",")}</td>
                    <td class="nowrap">
                        <span class="mini-bar"><span class="mini-bar-fill" style="width:${Math.round(e.sharpness)}%; background:#38bdf8;"></span></span>
                        ${Math.round(e.sharpness)}%
                    </td>
                    <td class="nowrap"><strong style="color:${risikoFarbe};">${e.injuryRiskPercent.toFixed(1).replace(".", ",")} %</strong></td>
                    <td>${entwicklung}</td>
                    <td style="font-size:12px; color:var(--text-muted);">${this.escapeHtml(e.note)}</td>
                </tr>
            `;
        }).join("");

        body.querySelectorAll("tr.row-clickable").forEach(row => {
            row.addEventListener("click", () => {
                const pId = this.resolvePlayerId(row.dataset.playerId);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            });
        });
    }

    /**
     * Finanzen & Buchungsjournal rendern
     */
    /**
     * Budgets umschichten: freier Gehaltsetat ins Transferbudget und zurück.
     * Der Kurs (Wochen bis zum Saisonwechsel) steht dabei, damit klar ist,
     * was ein Euro Wochengehalt wert ist.
     */
    renderUmschichten(state, club) {
        const el = document.getElementById("finUmschichten");
        const fin = typeof FinanceEngine !== "undefined" ? FinanceEngine : null;
        if (!el || !fin || typeof fin.umschichtSpielraum !== "function") return;
        const raum = fin.umschichtSpielraum(state, club);
        if (!raum) { el.innerHTML = ""; return; }
        const schritt = ContractEngine.eingabeSchritt(Math.max(raum.gehaltFrei, raum.transferMoeglich, 1000));
        const vorschlag = ContractEngine.rundeBetrag(Math.max(raum.gehaltFrei, raum.transferMoeglich) / 2) || 0;
        const stand = raum.umgeschichtet
            ? `<div class="muted-note">Diese Saison umgeschichtet: ${this.geldKurz(Math.abs(raum.umgeschichtet))} pro Woche ${raum.umgeschichtet > 0 ? "aus dem Gehaltsetat ins Transferbudget" : "aus dem Transferbudget in den Gehaltsetat"}. Zum Saisonwechsel gilt wieder der Etat des Vorstands.</div>` : "";
        el.innerHTML = `
            <h4>Budget umschichten</h4>
            <p class="muted-note">1 € pro Woche entspricht ${raum.wochen} € Transferbudget - so viele Wochen sind es noch bis zum Saisonwechsel.
                Frei im Gehaltsetat: <strong>${this.geldKurz(raum.gehaltFrei)}</strong> pro Woche.</p>
            <div class="umschichten-zeile">
                <label>Betrag je Woche (€)
                    <input type="number" id="umschichtBetrag" class="styled-input" min="0" step="${schritt}" value="${vorschlag}">
                </label>
                <span class="umschichten-vorschau" id="umschichtVorschau"></span>
            </div>
            <div class="umschichten-knoepfe">
                <button class="btn btn-sm btn-secondary" id="btnUmschichtTransfer" ${raum.gehaltFrei <= 0 ? "disabled" : ""}>Ins Transferbudget</button>
                <button class="btn btn-sm btn-secondary" id="btnUmschichtGehalt" ${raum.transferMoeglich <= 0 ? "disabled" : ""}>In den Gehaltsetat</button>
            </div>
            ${stand}`;
        const eingabe = document.getElementById("umschichtBetrag");
        const vorschau = () => {
            const b = Math.max(0, Number(eingabe.value) || 0);
            DOM.setText("umschichtVorschau", b ? `= ${this.geldKurz(b * raum.wochen)} Transferbudget` : "");
        };
        eingabe?.addEventListener("input", vorschau);
        vorschau();
        const ausfuehren = (richtung) => {
            const b = Math.max(0, Number(eingabe.value) || 0) * richtung;
            const r = fin.schichteUm(state, b);
            if (!r.ok) { this.showToast(r.grund, "error"); return; }
            this.showToast(richtung > 0
                ? `${this.geldKurz(r.jeWoche)} pro Woche ins Transferbudget: +${this.geldKurz(r.transfer)}.`
                : `${this.geldKurz(-r.jeWoche)} pro Woche mehr Gehaltsetat für ${this.geldKurz(-r.transfer)} Transferbudget.`, "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderFinances();
            this.renderHeader();
        };
        document.getElementById("btnUmschichtTransfer")?.addEventListener("click", () => ausfuehren(1));
        document.getElementById("btnUmschichtGehalt")?.addEventListener("click", () => ausfuehren(-1));
    }

    /**
     * Anfragen an den Vorstand auf der Vorstandskarte: was man erbitten
     * kann, wie die Aussichten stehen, und ob gerade beraten wird.
     */
    renderVorstandsAnfrage(state) {
        const el = document.getElementById("dashBoardAnfrage");
        const board = typeof BoardEngine !== "undefined" ? BoardEngine : null;
        if (!el || !board || !board.ANFRAGEN) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const offen = state.vorstandsAnfrage;
        if (offen) {
            const rest = Math.max(0, offen.entscheidetTag - board.stempel(state));
            el.innerHTML = `<div class="ba-kopf">Anfrage an den Vorstand</div>
                <div class="muted-note">„${esc(board.ANFRAGEN[offen.key]?.label)}“ liegt vor - Antwort ${this.wannText(rest)}.</div>`;
            return;
        }
        const aussicht = c => c >= 0.6 ? "gut" : (c >= 0.35 ? "offen" : "schlecht");
        const optionen = Object.entries(board.ANFRAGEN).map(([key, a]) => {
            const grund = board.anfrageHindernis(state, key);
            return `<option value="${key}" ${grund ? "disabled" : ""}>${esc(a.label)}${grund ? "" : ` · Aussichten ${aussicht(board.anfrageChance(state, key))}`}</option>`;
        }).join("");
        el.innerHTML = `<div class="ba-kopf">Anfrage an den Vorstand</div>
            <div class="ba-zeile">
                <select class="styled-select" id="vorstandsAnfrageWahl">${optionen}</select>
                <button class="btn btn-sm btn-secondary" id="btnVorstandsAnfrage">Anfragen</button>
            </div>
            <div class="muted-note">Der Vorstand berät ein paar Tage. Wer abblitzt und weiter drängt, verliert Vertrauen.</div>`;
        document.getElementById("btnVorstandsAnfrage")?.addEventListener("click", () => {
            const key = document.getElementById("vorstandsAnfrageWahl")?.value;
            const r = board.stelleAnfrage(state, key);
            if (!r.ok) { this.showToast(r.grund, "error"); return; }
            this.showToast(`Die Anfrage liegt dem Vorstand vor. Antwort in ${r.tage} Tagen.`, "info");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderVorstandsAnfrage(state);
        });
    }

    renderFinances() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        const squad = state.players.filter(p => userClub.playerIds.includes(p.id));
        const weeklyWages = squad.reduce((sum, p) => sum + (p.wage || 0), 0);
        // Die Sponsorenzahlung kommt aus der Finanz-Engine, damit im Verein
        // dieselbe Zahl steht, die auch gebucht wird.
        const sponsorWeekly = this.sponsorProSpieltag(userClub);
        const matchIncomeEst = Math.round((userClub.capacity || 30000) * 0.85 * (userClub.ticketPrice || 35));

        const gehaltsQuote = userClub.wageBudget ? Math.round(weeklyWages / userClub.wageBudget * 100) : 0;
        this.renderKennzahlen("finKennzahlen", [
            { titel: "Kontostand", wert: this.geldKurz(userClub.balance || 0), klasse: (userClub.balance || 0) < 0 ? "gefahr" : "" },
            { titel: "Transferbudget", wert: this.geldKurz(userClub.transferBudget || 0) },
            { titel: "Gehälter / Woche", wert: this.geldKurz(weeklyWages),
                extra: `<span class="vk-balken"><i style="width:${Math.min(100, gehaltsQuote)}%"></i></span><small>${gehaltsQuote} % des Budgets</small>`,
                klasse: gehaltsQuote > 100 ? "gefahr" : (gehaltsQuote > 90 ? "warnung" : "") },
            { titel: "Sponsor / Spieltag", wert: this.geldKurz(sponsorWeekly) },
            { titel: "Heimspiel", wert: this.geldKurz(matchIncomeEst), extra: `<small>geschätzte Einnahmen</small>` }
        ]);

        DOM.setText("finBalance", GameState.formatMoney(userClub.balance));
        DOM.setText("finTransferBudget", GameState.formatMoney(userClub.transferBudget));
        DOM.setText("finWageBudget", GameState.formatMoney(userClub.wageBudget));
        DOM.setText("finWageCosts", GameState.formatMoney(weeklyWages));
        DOM.setText("finCapacity", `${(userClub.capacity || 0).toLocaleString("de-DE")} Plätze`);
        DOM.setText("finMatchdayIncome", `ca. ${GameState.formatMoney(matchIncomeEst)}`);
        DOM.setText("finSponsorWeekly", GameState.formatMoney(sponsorWeekly));
        DOM.setText("finFanbase", `${(userClub.fanBase || 0).toLocaleString("de-DE")} Fans`);

        this.renderFacilityCosts(userClub);
        this.renderUmschichten(state, userClub);

        // Transaktionshistorie (D5)
        const txnsBody = document.getElementById("finTransactionsBody");
        if (txnsBody) {
            const txns = (state.finances?.transactions || []).filter(t => t.clubId === userClub.id).slice(0, 30);
            if (txns.length === 0) {
                txnsBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Noch keine Buchungen erfasst.</td></tr>`;
            } else {
                txnsBody.innerHTML = txns.map(t => {
                    const isPositive = t.amount >= 0;
                    const amountFormatted = (isPositive ? "+" : "") + GameState.formatMoney(t.amount);
                    const color = isPositive ? "#34d399" : "#f87171";
                    return `
                        <tr>
                            <td><span style="font-size:12px; color:var(--text-muted);">${t.date}</span></td>
                            <td>${t.description}</td>
                            <td><strong style="color:${color};">${amountFormatted}</strong></td>
                        </tr>
                    `;
                }).join("");
            }
        }
    }

    /**
     * Vereins-Tab rendern (D3 & C6)
     */
    /**
     * Der Kopf der Vereinsseite: Wappen, Liga und die Kennzahlen als Kacheln -
     * so beginnt im FM26 die Vereinsseite.
     */
    renderVereinsKopf(state, club, plaetze) {
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        const crest = document.getElementById("clubHeroCrest");
        if (crest) this.setzeWappen(crest, club);
        const hero = document.getElementById("clubHero");
        if (hero) hero.style.setProperty("--vk-farbe", this.wappenFarben(club).farbe + "40");
        const liga = (state.leagues || []).find(l => l.id === club.leagueId);
        DOM.setText("clubHeroLiga", liga?.shortName || liga?.name || state.leagueName || "Liga");
        DOM.setText("clubHeroName", club.name);
        DOM.setText("clubHeroOrt", [club.city, club.stadium].filter(Boolean).join(" · "));

        const tabelle = (state.standings || []);
        const platzIndex = tabelle.findIndex(s => s.clubId === club.id);
        const ruf = Math.round(club.reputation || 60);
        const stimmung = Math.round(state.fanMood || 75);
        const chemie = Math.round(club.chemistry?.overall || 75);
        const balken = (wert) => `<span class="vk-balken"><i style="width:${Math.max(3, Math.min(100, wert))}%"></i></span>`;
        const kacheln = [
            ["Tabellenplatz", platzIndex >= 0 ? `${platzIndex + 1}.` : "—", `<small>${tabelle.length ? `von ${tabelle.length}` : ""}</small>`],
            ["Ruf", `${ruf}`, balken(ruf)],
            ["Fans", (club.fanBase || 25000).toLocaleString("de-DE"), `<small>${(plaetze || club.capacity || 0).toLocaleString("de-DE")} Plätze</small>`],
            ["Stimmung", `${stimmung} %`, balken(stimmung)],
            ["Teamchemie", `${chemie} %`, balken(chemie)],
            ["Kontostand", this.geldKurz ? this.geldKurz(club.balance || 0) : GameState.formatMoney(club.balance || 0), `<small>${esc(club.sponsor?.name || "")}</small>`]
        ];
        const el = document.getElementById("clubHeroKacheln");
        if (el) {
            el.innerHTML = kacheln.map(([titel, wert, extra]) =>
                `<div class="vk-kachel"><span>${esc(titel)}</span><strong>${esc(wert)}</strong>${extra || ""}</div>`).join("");
        }
    }

    /** Das Trainerprofil: fünf Werte, Lizenz mit Lehrgang, Ruf */
    renderTrainerProfil() {
        const box = document.getElementById("clubTrainerProfil");
        const engine = typeof TrainerProfilEngine !== "undefined" ? TrainerProfilEngine : null;
        if (!box || !engine) return;
        const state = this.app.state;
        const u = engine.uebersicht(state);
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const balken = (w) => `<span class="tp-balken"><i style="width:${Math.round(w / 20 * 100)}%"></i></span><b>${w}</b>`;
        const kurs = u.kurs
            ? `<div class="hint-box">Lehrgang zur ${esc(u.kurs.ziel)} läuft - noch ${u.kurs.tageOffen} Tage.</div>`
            : (u.naechsterKurs
                ? `<button class="btn btn-secondary" id="btnTrainerKurs">Lehrgang ${esc(u.naechsterKurs.name)} belegen (${this.geldKurz(u.naechsterKurs.kosten)}, ${u.naechsterKurs.tage} Tage)</button>`
                : `<div class="text-muted" style="font-size:13px;">Höchste Lizenz erreicht.</div>`);
        box.innerHTML = `
            <div class="card-header"><h3>Trainerprofil: ${esc(state.managerName || "Trainer")}</h3><span class="header-tag">${esc(u.typ)}</span></div>
            <div class="tp-raster">
                <div class="tp-werte">
                    ${u.werte.map(w => `<div class="tp-zeile" title="${esc(w.text)}"><span class="tp-name">${esc(w.name)}</span>${balken(w.wert)}</div>`).join("")}
                </div>
                <div class="tp-seite">
                    <div class="tp-kennzahl"><span>Lizenz</span><strong>${esc(u.lizenz)}</strong></div>
                    <div class="tp-kennzahl"><span>Hier verlangt</span><strong class="${u.erfuellt ? "" : "text-danger"}">${esc(u.pflicht)}</strong></div>
                    <div class="tp-kennzahl"><span>Ruf</span><strong>${u.ruf} / 100</strong></div>
                    ${kurs}
                </div>
            </div>
            <p class="text-muted tp-hinweis">Am Saisonende wächst, was gefordert war: Titel stärken die Motivation, eingebaute Talente die Jugendarbeit, Transfers die Spielerbewertung. Die Lizenz entscheidet, welche Vereine Ihnen ein Angebot machen dürfen.</p>`;
        document.getElementById("btnTrainerKurs")?.addEventListener("click", () => {
            const res = engine.kursStarten(state);
            this.showToast(res.success ? `Lehrgang gebucht: ${res.tage} Tage.` : res.error, res.success ? "success" : "error");
            if (res.success) {
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderTrainerProfil();
                this.renderHeader?.();
            }
        });
    }

    renderClub() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;
        this.renderTrainerProfil();

        DOM.setText("clubTabName", userClub.name);
        DOM.setText("clubTabCity", userClub.city || "Deutschland");
        DOM.setText("clubTabReputation", userClub.reputation || 70);
        DOM.setText("clubTabFanbase", (userClub.fanBase || 25000).toLocaleString("de-DE"));
        DOM.setText("clubTabFanMood", state.fanMood || 75);
        DOM.setText("clubTabChemistry", userClub.chemistry?.overall || 75);

        const facEngine = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
        const nutzbar = facEngine
            ? facEngine.verfuegbareKapazitaet(userClub, state.seasonYear || 1)
            : (userClub.capacity || 30000);
        const vollePlaetze = userClub.stadiumCapacity || userClub.capacity || 30000;

        DOM.setText("clubTabStadium", userClub.stadium || "Stadion");
        DOM.setText("clubTabCapacity", nutzbar < vollePlaetze
            ? `${nutzbar.toLocaleString("de-DE")} (Umbau, sonst ${vollePlaetze.toLocaleString("de-DE")})`
            : vollePlaetze.toLocaleString("de-DE"));
        DOM.setText("clubTabStadiumLvl", facEngine
            ? `Stufe ${userClub.anlagen?.stadium?.stufe ?? userClub.facilities?.stadium ?? 2}`
              + ` (${facEngine.zustandsText(userClub.anlagen?.stadium?.zustand ?? 100)})`
            : `Stufe ${userClub.facilities?.stadium || 2}`);

        this.renderVereinsKopf(state, userClub, nutzbar);

        // Sponsor
        DOM.setText("clubTabSponsorName", userClub.sponsor?.name || "Global Tech");
        DOM.setText("clubTabSponsorAmount", `${GameState.formatMoney(this.sponsorProSpieltag(userClub))} / Spieltag`);
        DOM.setText("clubTabSponsorYears", userClub.sponsor?.yearsRemaining || 2);

        // Anlagen: Stufe, Zustand, Baustellen
        this.renderFacilities(userClub);

        // Ticketpreis Slider
        const slider = document.getElementById("inputTicketPrice");
        const valText = document.getElementById("valTicketPrice");
        const forecastText = document.getElementById("txtTicketForecast");

        if (slider) {
            slider.value = userClub.ticketPrice || 35;
            if (valText) valText.textContent = `${slider.value} €`;
            
            const updateForecast = (price) => {
                const rep = userClub.reputation || 70;
                const priceFactor = 1.0 - ((price - 35) / 100) * 0.6;
                const estPct = Math.round(Math.min(100, Math.max(35, (0.68 + (rep / 200) * 0.22) * priceFactor * 100)));
                if (forecastText) forecastText.textContent = `Prognostizierte Auslastung: ~${estPct}% (Kapazität: ${userClub.capacity.toLocaleString('de-DE')})`;
            };
            updateForecast(slider.value);

            slider.oninput = (e) => {
                const p = parseInt(e.target.value, 10);
                userClub.ticketPrice = p;
                if (valText) valText.textContent = `${p} €`;
                updateForecast(p);
            };
        }

    }

    /**
     * Was jede Anlage je Spieltag kostet.
     *
     * Vorher standen hier vier Stufenzahlen, die schon im Verein-Reiter
     * stehen. Interessant ist an dieser Stelle etwas anderes: dass eine
     * verfallene Anlage teurer im Unterhalt ist als eine gepflegte. Das ist
     * der Grund, eine Sanierung nicht ewig aufzuschieben - und man sieht ihn
     * nur, wenn die Rechnung aufgeschlüsselt dasteht.
     */
    renderFacilityCosts(userClub) {
        const host = document.getElementById("finFacilityRows");
        if (!host) return;

        const state = this.app.state;
        const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
        const finance = (typeof FinanceEngine !== "undefined") ? FinanceEngine : null;
        if (!fac || !finance) { host.innerHTML = ""; return; }

        const saison = state.seasonYear || 1;
        const anlagen = fac.hole(userClub, saison);
        const ligaFaktor = finance.LEVEL_ECONOMY?.[userClub.level || 1] ?? 0.05;

        const ICONS = {
            stadium: '<svg class="ico" aria-hidden="true"><use href="#i-stadium"/></svg>',
            trainingGround: '<svg class="ico" aria-hidden="true"><use href="#i-dumbbell"/></svg>',
            youthCenter: '<svg class="ico" aria-hidden="true"><use href="#i-leaf"/></svg>',
            medicalCenter: '<svg class="ico" aria-hidden="true"><use href="#i-medical"/></svg>'
        };

        let summe = 0;
        host.innerHTML = fac.ANLAGEN.map(key => {
            const a = anlagen?.[key];
            if (!a) return "";

            // Dieselbe Rechnung wie in maintenancePerMatchday
            const flickwerk = 1 + (100 - Math.max(0, Math.min(100, a.zustand))) / 100 * 0.55;
            const kosten = Math.round(a.stufe * a.stufe * 1500 * flickwerk * ligaFaktor);
            const gepflegt = Math.round(a.stufe * a.stufe * 1500 * ligaFaktor);
            const aufschlag = kosten - gepflegt;
            summe += kosten;

            const hinweis = aufschlag > 0
                ? `<span class="unterhalt-aufschlag">+${GameState.formatMoney(aufschlag)} durch Zustand</span>`
                : "";

            return `
                <div class="finance-stat-row unterhalt-zeile">
                    <span class="unterhalt-name">
                        <span class="unterhalt-titel">${ICONS[key] || ""} ${fac.FACILITY_NAMES[key]}</span>
                        <span class="unterhalt-sub">Stufe ${a.stufe} &middot; ${fac.zustandsText(a.zustand)}</span>
                    </span>
                    <span class="unterhalt-betrag">
                        <strong>${GameState.formatMoney(kosten)}</strong>
                        ${hinweis}
                    </span>
                </div>`;
        }).join("");

        DOM.setText("finFacilityTotal", `${GameState.formatMoney(summe)} / Spieltag`);
    }

    /**
     * Die Anlagen des Vereins.
     *
     * Eine Anlage ist keine Zahl von eins bis fünf, die man einmal hochkauft.
     * Sie hat eine Stufe - was sie könnte - und einen Zustand - was sie davon
     * noch leistet. Das Camp Nou war Stufe fünf und trotzdem eine Baustelle.
     * Deshalb zeigt jede Karte beides und bietet zwei verschiedene Arbeiten an:
     * Ausbauen hebt die Stufe, Sanieren holt den Zustand zurück.
     */
    renderFacilities(userClub) {
        const host = document.getElementById("facilityGrid");
        if (!host) return;

        const state = this.app.state;
        const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
        if (!fac || typeof fac.uebersicht !== "function") {
            host.innerHTML = `<p class="text-muted">Anlagendaten nicht verfügbar.</p>`;
            return;
        }

        const ICONS = {
            stadium: '<svg class="ico" aria-hidden="true"><use href="#i-stadium"/></svg>',
            trainingGround: '<svg class="ico" aria-hidden="true"><use href="#i-dumbbell"/></svg>',
            youthCenter: '<svg class="ico" aria-hidden="true"><use href="#i-leaf"/></svg>',
            medicalCenter: '<svg class="ico" aria-hidden="true"><use href="#i-medical"/></svg>'
        };
        const NUTZEN = {
            stadium: "Mehr Plätze, mehr Zuschauereinnahmen, lauterer Heimvorteil.",
            trainingGround: "Schnellere Entwicklung und bessere Erholung zwischen den Spielen.",
            youthCenter: "Mehr und bessere Talente aus dem eigenen Nachwuchs.",
            medicalCenter: "Weniger Verletzungen, kürzere Ausfallzeiten."
        };

        const geld = (b) => (typeof GameState !== "undefined" && GameState.formatMoney)
            ? GameState.formatMoney(b) : `${Math.round(b / 1000)} Tsd. €`;

        const zustandsFarbe = (z) => z >= 80 ? "#10b981" : z >= 60 ? "#84cc16"
            : z >= 42 ? "#f59e0b" : "#ef4444";

        const kasse = userClub.balance || 0;
        const liste = fac.uebersicht(state, userClub.id);

        host.innerHTML = liste.map(a => {
            // Stufenbalken: die volle Stufe hell, der Verfall als halber Balken
            const pips = [1, 2, 3, 4, 5].map(i => {
                if (i <= Math.floor(a.wirksameStufe)) return `<div class="fac-pip on"></div>`;
                if (i <= a.stufe) return `<div class="fac-pip part"></div>`;
                return `<div class="fac-pip"></div>`;
            }).join("");

            const verlust = a.stufe - a.wirksameStufe;
            const stufenText = verlust >= 0.15
                ? `Stufe ${a.stufe} &middot; wirksam <strong>${a.wirksameStufe.toFixed(1)}</strong>`
                : `Stufe <strong>${a.stufe}</strong> / 5`;

            let extra = "";
            if (a.key === "stadium" && a.vollKapazitaet) {
                extra = a.kapazitaet < a.vollKapazitaet
                    ? `<p class="fac-note">Zurzeit nutzbar: <strong>${a.kapazitaet.toLocaleString("de-DE")}</strong>
                       von ${a.vollKapazitaet.toLocaleString("de-DE")} Plätzen.</p>`
                    : `<p class="fac-note">Kapazität: <strong>${a.vollKapazitaet.toLocaleString("de-DE")}</strong> Plätze.</p>`;
            }
            if (a.key === "youthCenter" && a.profil) {
                const st = (a.profil.staerken || []).length
                    ? `Die Schule bringt vor allem ${this.profilWorte(a.profil.staerken)} hervor.`
                    : `Die Schule bildet breit aus, ohne besondere Handschrift.`;
                extra += `<div class="fac-profil"><strong>${a.profil.name}</strong><br>${st}</div>`;
            }

            let bau = "";
            if (a.projekt) {
                const anteil = Math.round((1 - a.projekt.restSpieltage / a.projekt.spieltage) * 100);
                bau = `
                    <div class="fac-bau">
                        🏗️ <strong>${a.projekt.art === "ausbau" ? `Ausbau auf Stufe ${a.stufe + 1}` : "Sanierung"}</strong>
                        läuft &middot; noch ${a.projekt.restSpieltage} Spieltage.<br>
                        Betrieb eingeschränkt um ${Math.round(a.projekt.beeintraechtigung * 100)} %.
                        <div class="fac-bau-fortschritt"><span style="width:${anteil}%"></span></div>
                    </div>`;
            }

            const sperre = !!a.projekt;
            const maxStufe = a.stufe >= 5;
            const neuwertig = a.zustand >= 85;

            const ausbauBtn = `
                <button class="btn btn-sm btn-primary btn-fac" data-facility="${a.key}" data-art="ausbau"
                        ${sperre || maxStufe ? "disabled" : ""}
                        title="${maxStufe ? "Stufe 5 ist die höchste" : `${a.dauerAusbau} Spieltage Bauzeit`}">
                    Ausbauen
                    <small>${maxStufe ? "Stufe 5 erreicht" : `${geld(a.kostenAusbau)} &middot; ${a.dauerAusbau} ST`}</small>
                </button>`;

            const sanierBtn = `
                <button class="btn btn-sm btn-secondary btn-fac" data-facility="${a.key}" data-art="sanierung"
                        ${sperre || neuwertig ? "disabled" : ""}
                        title="${neuwertig ? "Noch in gutem Zustand" : `${a.dauerSanierung} Spieltage Bauzeit`}">
                    Sanieren
                    <small>${neuwertig ? "nicht nötig" : `${geld(a.kostenSanierung)} &middot; ${a.dauerSanierung} ST`}</small>
                </button>`;

            const teuer = !sperre && !maxStufe && a.kostenAusbau > kasse;
            const bank = a.finanzierungAusbau;
            const hinweisGeld = teuer
                ? `<p class="fac-note" style="color:#f59e0b;">Für den Ausbau fehlen ${geld(a.kostenAusbau - kasse)}.`
                  + (bank?.moeglich ? ` Die Hausbank finanziert: ${geld(bank.anzahlung)} Anzahlung, dann ${geld(bank.rate)} je Spieltag.` : "")
                  + `</p>`
                : "";
            const hinweisFoerderung = !sperre && !maxStufe && a.foerderungAusbau > 0
                ? `<p class="fac-note">Sportstättenförderung: Die Stadt trägt ${Math.round(a.foerderQuote * 100)} % (${geld(a.foerderungAusbau)}).</p>`
                : "";

            return `
                <div class="fac-card ${a.projekt ? "is-building" : ""}">
                    <div class="fac-head">
                        <h4 class="fac-titel">${ICONS[a.key] || ""} ${a.name}</h4>
                        <span class="fac-stufe">${stufenText}</span>
                    </div>
                    <div class="fac-pips">${pips}</div>
                    <div class="fac-zustand">
                        <span>Zustand: <strong style="color:${zustandsFarbe(a.zustand)};">${a.zustandsText}</strong></span>
                        <span>${a.zustand} %${a.alter > 0 ? ` &middot; ${a.alter} J. alt` : " &middot; neu"}</span>
                    </div>
                    <div class="fac-bar"><span style="width:${a.zustand}%; background:${zustandsFarbe(a.zustand)};"></span></div>
                    <p class="fac-note">${NUTZEN[a.key] || ""}</p>
                    ${extra}
                    ${bau}
                    <div class="fac-actions">${ausbauBtn}${sanierBtn}</div>
                    ${hinweisFoerderung}
                    ${hinweisGeld}
                </div>`;
        }).join("");

        host.querySelectorAll(".btn-fac").forEach(btn => {
            btn.onclick = () => this.starteBau(btn.dataset.facility, btn.dataset.art);
        });
    }

    /**
     * Ein Bauvorhaben mit Blick auf die Rechnung starten: Baukosten,
     * Fördermittel, Eigenanteil - und, wenn die Kasse nicht reicht, die
     * Finanzierung über die Hausbank.
     */
    starteBau(key, art) {
        const state = this.app.state;
        const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : window.FacilityEngine;
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!fac || !club) return;
        const saison = state.seasonYear || 1;
        const anlage = fac.hole(club, saison)?.[key];
        if (!anlage) return;
        const name = fac.FACILITY_NAMES[key];
        const geld = (b) => GameState.formatMoney(b);
        const detail = fac.kostenDetail(club, key, art, saison);
        const bank = fac.finanzierung(state, club, key, art);
        const kasse = club.balance || 0;
        const barGeht = kasse >= detail.netto;
        const dauer = fac.dauer(key, art);
        const stoerung = Math.round(((fac.BEEINTRAECHTIGUNG[key] || {})[art] || 0.2) * 100);

        const starte = (finanzierung) => {
            const res = fac.starteProjekt(state, club.id, key, art, finanzierung ? { finanzierung } : {});
            if (!res.erfolg) {
                this.showToast(res.grund, "error", 6000);
                return false;
            }
            this.playSound("whistle");
            this.showToast(`${res.name}: ${art === "ausbau" ? "Ausbau" : "Sanierung"} begonnen — ${res.spieltage} Spieltage`
                + (res.rate ? `, ${geld(res.rate)} je Spieltag an die Bank.` : `, ${geld(res.kosten)}.`), "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderClub();
            this.renderTraining();
            this.renderHeader();
            return true;
        };

        const zeile = (t, w, stark = false) => `<div${stark ? ` class="bau-eigen"` : ""}><span>${t}</span><strong>${w}</strong></div>`;
        const html = `
            <p><strong>${name}</strong>: ${art === "ausbau" ? `Ausbau von Stufe ${anlage.stufe} auf ${anlage.stufe + 1}` : `Sanierung (Zustand ${Math.round(anlage.zustand)} %)`}.
               ${dauer} Spieltage Bauzeit, der Betrieb läuft so lange um ${stoerung} % eingeschränkt.</p>
            <div class="verh-zahlen bau-rechnung">
                ${zeile("Baukosten", geld(detail.brutto))}
                ${detail.foerderung > 0 ? zeile(`Sportstättenförderung (${Math.round(detail.quote * 100)} %)`, `− ${geld(detail.foerderung)}`) : ""}
                ${zeile("Eigenanteil", geld(detail.netto), true)}
                ${zeile("In der Kasse", geld(kasse))}
            </div>
            ${bank.moeglich
                ? `<p class="muted-note">Hausbank: ${geld(bank.anzahlung)} Anzahlung, danach ${geld(bank.rate)} je Spieltag über ${bank.spieltage} Spieltage.
                   Zinsen ${geld(bank.zinsen)}, zusammen ${geld(bank.gesamt)}.</p>`
                : `<p class="muted-note">Hausbank: ${this.escapeHtml(bank.grund || "keine Finanzierung möglich")}</p>`}
            ${!barGeht && !bank.moeglich ? `<p style="color:var(--accent-danger);">Es fehlen ${geld(detail.netto - kasse)} - so lässt sich nicht bauen.</p>` : ""}`;

        const knoepfe = [{ text: "Abbrechen", klasse: "btn-secondary" }];
        if (bank.moeglich) knoepfe.push({ text: "In Raten finanzieren", klasse: barGeht ? "btn-secondary" : "btn-primary", aktion: () => starte("raten") });
        if (barGeht) knoepfe.push({ text: `Sofort bezahlen (${this.geldKurz(detail.netto)})`, klasse: "btn-primary", aktion: () => starte(null) });
        this.zeigeEntscheidung({ titel: art === "ausbau" ? "Ausbau planen" : "Sanierung planen", html, knoepfe });
    }

    /** "Techniker, Passgeber und Dribbler" statt "technique, passing, dribbling" */
    profilWorte(schluessel) {
        const W = {
            technique: "Techniker", passing: "Passgeber", dribbling: "Dribbler",
            pace: "Sprinter", physical: "Athleten", stamina: "Dauerläufer",
            vision: "Spielmacher", positioning: "Raumdeuter", defense: "Zweikämpfer"
        };
        const worte = schluessel.map(k => W[k] || k);
        if (worte.length <= 1) return worte[0] || "";
        return `${worte.slice(0, -1).join(", ")} und ${worte[worte.length - 1]}`;
    }

    /**
     * Statistiken & Saisonhistorie rendern
     */
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
            const flagge = { de: "🇩🇪", en: "🏴", es: "🇪🇸", it: "🇮🇹", fr: "🇫🇷" };
            const name = l => `${flagge[l.countryId] || "🌍"} ${l.shortName || l.name}`;
            const eigene = ligen.find(l => l.id === eigeneLiga);
            const andere = ligen
                .filter(l => l.id !== eigeneLiga)
                .sort((x, y) => String(x.countryId).localeCompare(String(y.countryId)) || (x.level || 1) - (y.level || 1));
            select.innerHTML = [
                eigene ? `<option value="${eigene.id}">${name(eigene)} (eigene Liga)</option>` : "",
                `<option value="alle">🌍 Alle Ligen</option>`,
                ...andere.map(l => `<option value="${l.id}">${name(l)}</option>`)
            ].join("");
            select.value = ligaId;
            select.onchange = () => {
                this.statsLigaId = select.value;
                this.renderStats();
            };
        }

        const vereine = new Map((state.clubs || []).map(c => [c.id, c]));
        const spieler = (state.players || []).filter(p => {
            if (!p.stats) return false;
            if (ligaId === "alle") return true;
            return vereine.get(p.clubId)?.leagueId === ligaId;
        });
        const userClubId = state.userClubId;
        const ANZAHL = 8;

        const rangliste = (elId, liste, wertText, leer) => {
            const el = document.getElementById(elId);
            if (!el) return;
            el.innerHTML = liste.slice(0, ANZAHL).map((p, i) => {
                const club = vereine.get(p.clubId);
                return `
                    <div class="leaderboard-item${p.clubId === userClubId ? " lb-eigen" : ""}">
                        <span class="lb-rank">${i + 1}</span>
                        <span class="mini-wappen" data-club="${this.escapeHtml(String(p.clubId))}"></span>
                        <span class="lb-person">
                            <span class="lb-name">${this.escapeHtml(p.name)}</span>
                            <span class="lb-club">${this.escapeHtml(club?.name || "")}</span>
                        </span>
                        <span class="lb-val">${wertText(p)}</span>
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
            spieler.filter(p => p.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals),
            p => `${p.stats.goals} <small>Tore</small>`,
            "Noch keine Tore erzielt.");

        rangliste("statsTopAssists",
            spieler.filter(p => p.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists),
            p => `${p.stats.assists} <small>Vorl.</small>`,
            "Noch keine Vorlagen erfasst.");

        rangliste("statsCleanSheets",
            spieler.filter(p => p.pos === "TW" && p.stats.cleanSheets > 0).sort((a, b) => b.stats.cleanSheets - a.stats.cleanSheets),
            p => `${p.stats.cleanSheets} <small>zu null</small>`,
            "Noch keine Zu-null-Spiele.");

        // Ein Spieler mit zwei guten Einsätzen gehört nicht vor den, der jede
        // Woche spielt: Mindesteinsätze wachsen mit der Saison.
        const meisteEinsaetze = spieler.reduce((m, p) => Math.max(m, p.stats.matches || 0), 0);
        const mindestens = Math.max(2, Math.ceil(meisteEinsaetze * 0.4));
        const schnitt = p => p.stats.ratingSum / p.stats.matches;
        rangliste("statsTopRatings",
            spieler.filter(p => (p.stats.matches || 0) >= mindestens).sort((a, b) => schnitt(b) - schnitt(a)),
            p => `${schnitt(p).toFixed(2).replace(".", ",")} <small>Ø</small>`,
            `Mindestens ${mindestens} Einsätze erforderlich.`);
        DOM.setText("statsRatingHint", `ab ${mindestens} Einsätzen`);

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
                        <div class="cal-card-title">${inhalt.titel || day.title}</div>
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
                            ${this.tagIcon(d.type)} ${inhalt.titel || d.title}
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
     * Der monatliche Entwicklungsbericht: verbessert, nachgelassen, Akademie.
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
        return `
            <div class="entwicklungsbericht">
                ${tabelle(`📈 Verbessert (${b.besser.length})`, b.besser) || `<p class="text-muted">Verbessert hat sich diesen Monat niemand.</p>`}
                ${tabelle(`📉 Nachgelassen (${b.schlechter.length})`, b.schlechter)}
                ${b.gleich ? `<p class="text-muted eb-gleich">${b.gleich} Spieler ${b.gleich === 1 ? "hält sein" : "halten ihr"} Niveau.</p>` : ""}
                ${tabelle(`🎓 Aus der Akademie (${(b.jugend || []).length})`, b.jugend || [], false)}
            </div>`;
    }

    postfachSymbol(emoji) {
        const id = ({
            "✉️": "i-mail", "👔": "i-briefcase", "⚽": "i-ball", "🔄": "i-transfer", "🏥": "i-medical",
            "🔍": "i-search", "💰": "i-wallet", "📝": "i-doc", "🎖️": "i-trophy", "📈": "i-chart", "🎯": "i-target"
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
            "💬": "i-chat", "📢": "i-alert", "🔁": "i-transfer", "🎓": "i-user", "👥": "i-users", "🌍": "i-globe"
        })[emoji];
        return id
            ? `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`
            : this.escapeHtml(String(emoji || ""));
    }

    /**
     * Das nächste Pflichtspiel als Karte - in FM und EA FC das Erste, was man
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
    }

    tabellenPlatzText(state, clubId) {
        const i = (state.standings || []).findIndex(t => t.clubId === clubId);
        if (i < 0) return "";
        const eintrag = state.standings[i];
        return `${i + 1}. · ${eintrag.points ?? 0} Pkt`;
    }

    /**
     * Postfach rendern
     */
    renderInbox() {
        const state = this.app.state;
        const listContainer = document.getElementById("inboxList");
        const newsEngine = (typeof NewsEngine !== 'undefined' && NewsEngine) 
            ? NewsEngine 
            : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : null);

        if (newsEngine && typeof newsEngine.normalizeAllMessages === 'function') {
            newsEngine.normalizeAllMessages(state);
        }

        const filtered = newsEngine && typeof newsEngine.getFilteredMessages === 'function'
            ? newsEngine.getFilteredMessages(state, this.inboxFilter, this.inboxSearch)
            : state.inbox;

        // Die Detailansicht steht am Handy mitten in der Liste - vor dem
        // Neuzeichnen zurück an ihren Platz, sonst ginge sie mit verloren
        const detail = document.getElementById("inboxDetail");
        if (detail && detail.parentElement === listContainer) listContainer.parentElement.appendChild(detail);

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="empty-state-sm" style="padding:24px; text-align:center;">Keine passenden Nachrichten im Postfach gefunden.</div>`;
            if (detail) {
                detail.classList.remove("inbox-detail-inline");
                detail.classList.toggle("inbox-detail-zu", this.postfachSchmal());
            }
            return;
        }

        // Falls noch keine Nachricht selektiert ist, erste sichtbare Nachricht wählen
        if (!this.selectedInboxMessageId || !state.inbox.some(m => String(m.id) === String(this.selectedInboxMessageId))) {
            this.selectedInboxMessageId = String(filtered[0].id);
        }

        listContainer.innerHTML = filtered.map(msg => {
            const isSelected = String(msg.id) === String(this.selectedInboxMessageId);
            const isUnread = !msg.read;
            const priorityBadge = msg.priority === "high" ? '<span class="msg-priority-badge">Wichtig</span>' : '';

            let icon = "✉️";
            let typeLabel = "Info";
            if (msg.type === "board_message" || msg.type === "welcome") { icon = "👔"; typeLabel = "Vorstand"; }
            else if (msg.type === "match_report" || msg.type === "match_preview") { icon = "⚽"; typeLabel = "Spiel"; }
            else if (msg.type === "transfer_done" || msg.type === "transfer_offer" || msg.type === "transfer_window") { icon = "🔄"; typeLabel = "Transfer"; }
            else if (msg.type === "training_report" || msg.type === "injury") { icon = "🏥"; typeLabel = "Training / Lazarett"; }
            else if (msg.type === "scout_report" || msg.type === "scouting") { icon = "🔍"; typeLabel = "Scouting"; }
            else if (msg.type === "finance_warning" || msg.type === "sponsor") { icon = "💰"; typeLabel = "Finanzen"; }
            else if (msg.type === "contract" || msg.type === "contract_expiring") { icon = "📝"; typeLabel = "Verträge"; }
            else if (msg.type === "retirement") { icon = "🎖️"; typeLabel = "Karriereende"; }
            else if (msg.type === "development") { icon = "📈"; typeLabel = "Entwicklung"; }
            else if (msg.type === "sportdirektor") { icon = "🎯"; typeLabel = "Sportdirektor"; }

            const displayDate = msg.date || "Saisonstart";

            return `
                <div class="inbox-item ${isUnread ? 'unread' : ''} ${isSelected ? 'selected' : ''}" data-msg-id="${msg.id}">
                    <div class="inbox-item-topline">
                        <div class="inbox-sender-wrap">
                            <span class="inbox-icon">${this.postfachSymbol(icon)}</span>
                            <span class="inbox-sender">${msg.sender || 'System'}</span>
                        </div>
                        <span class="inbox-date">${displayDate}</span>
                    </div>
                    <div class="inbox-item-title">${msg.subject || msg.title || 'Nachricht'}</div>
                    <div class="inbox-item-meta">
                        <span class="inbox-type">${typeLabel}</span>
                        ${priorityBadge}
                    </div>
                </div>
            `;
        }).join("");

        // Klick-Events auf Nachrichtenliste
        listContainer.querySelectorAll(".inbox-item").forEach(item => {
            item.addEventListener("click", () => {
                const msgId = String(item.dataset.msgId);
                const message = state.inbox.find(m => String(m.id) === msgId);
                if (message) {
                    message.read = true;
                    // Am Handy klappt ein zweiter Tipp die Nachricht wieder zu
                    const zuklappen = this.postfachSchmal() && this.inboxOffen === msgId;
                    this.inboxOffen = zuklappen ? null : msgId;
                    this.selectedInboxMessageId = msgId;
                    this.renderInbox();
                    this.renderHeader();
                    if (typeof this.app.state.saveToLocalStorage === "function") {
                        this.app.state.saveToLocalStorage();
                    }
                    // Die geöffnete Nachricht samt Eintrag in den Blick holen -
                    // eine darüber zugeklappte hat ihn womöglich nach oben gezogen
                    const offen = !zuklappen && this.postfachSchmal()
                        ? [...listContainer.querySelectorAll(".inbox-item")].find(el => el.dataset.msgId === msgId) : null;
                    if (offen && typeof offen.scrollIntoView === "function") offen.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });

        // Detailansicht für die ausgewählte Nachricht rendern
        const currentMsg = state.inbox.find(m => String(m.id) === String(this.selectedInboxMessageId)) || filtered[0];
        if (currentMsg) {
            this.renderInboxDetail(currentMsg);
        }
        this.platziereInboxDetail(listContainer, detail);
    }

    /** Einspaltiges Postfach (Handy, Tablet): dieselbe Grenze wie im Stylesheet */
    postfachSchmal() {
        return typeof window !== "undefined" && typeof window.matchMedia === "function"
            && window.matchMedia("(max-width: 1200px)").matches;
    }

    /**
     * Wo die Nachricht steht. Breit: rechts neben der Liste. Schmal stand sie
     * unter der ganzen Liste - wer eine Nachricht antippte, musste erst ans
     * Ende scrollen. Jetzt klappt sie direkt unter ihrem Eintrag auf, und
     * ohne Antippen bleibt sie zu.
     */
    platziereInboxDetail(listContainer, detail) {
        if (!detail || !listContainer) return;
        const layout = listContainer.parentElement;
        const schmal = this.postfachSchmal();
        const eintrag = schmal && this.inboxOffen
            ? [...listContainer.querySelectorAll(".inbox-item")].find(el => el.dataset.msgId === String(this.inboxOffen)) : null;
        listContainer.querySelectorAll(".inbox-item.offen").forEach(el => el.classList.remove("offen"));
        if (eintrag) {
            eintrag.classList.add("offen");
            eintrag.after(detail);
        } else if (detail.parentElement !== layout) {
            layout.appendChild(detail);
        }
        detail.classList.toggle("inbox-detail-inline", !!eintrag);
        detail.classList.toggle("inbox-detail-zu", schmal && !eintrag);

        // Dreht jemand das Handy oder zieht das Fenster breiter, wechselt die Ansicht mit
        if (!this._postfachBreite && typeof window !== "undefined" && typeof window.matchMedia === "function") {
            this._postfachBreite = window.matchMedia("(max-width: 1200px)");
            const neu = () => { if (this.activeTab === "inbox") this.renderInbox(); };
            if (typeof this._postfachBreite.addEventListener === "function") this._postfachBreite.addEventListener("change", neu);
            else if (typeof this._postfachBreite.addListener === "function") this._postfachBreite.addListener(neu);
        }
    }

    renderInboxDetail(msg) {
        const detailContainer = document.getElementById("inboxDetail");
        if (!detailContainer) return;

        let icon = "✉️";
        let typeLabel = "Info";
        if (msg.type === "board_message" || msg.type === "welcome") { icon = "👔"; typeLabel = "Vorstand"; }
        else if (msg.type === "match_report" || msg.type === "match_preview") { icon = "⚽"; typeLabel = "Spiel"; }
        else if (msg.type === "transfer_done" || msg.type === "transfer_offer" || msg.type === "transfer_window") { icon = "🔄"; typeLabel = "Transfer"; }
        else if (msg.type === "training_report" || msg.type === "injury") { icon = "🏥"; typeLabel = "Training / Lazarett"; }
        else if (msg.type === "scout_report" || msg.type === "scouting") { icon = "🔍"; typeLabel = "Scouting"; }
        else if (msg.type === "finance_warning" || msg.type === "sponsor") { icon = "💰"; typeLabel = "Finanzen"; }
        else if (msg.type === "contract" || msg.type === "contract_expiring") { icon = "📝"; typeLabel = "Verträge"; }
        else if (msg.type === "retirement") { icon = "🎖️"; typeLabel = "Karriereende"; }
        else if (msg.type === "development") { icon = "📈"; typeLabel = "Entwicklung"; }
        else if (msg.type === "sportdirektor") { icon = "🎯"; typeLabel = "Sportdirektor"; }

        let formattedBody = (msg.body || msg.text || "").replace(/\n/g, "<br>");
        const displayDate = msg.date || "Saisonstart";

        // Ein Scoutbericht erscheint als Berichtskarte, mit dem Weg zur Akte
        // und zum Angebot
        const state = this.app?.state;
        const spielerId = msg.relatedEntity?.type === "player" ? msg.relatedEntity.id
            : (msg.relatedEntity?.playerId ?? null);
        const spieler = spielerId !== null && state ? state.players.find(p => String(p.id) === String(spielerId)) : null;
        let aktionen = "";
        if (spieler) {
            const bericht = (state.scouting?.reports || []).find(r => String(r.playerId) === String(spieler.id));
            if (bericht && (msg.type === "scouting" || msg.type === "scout_report")) {
                formattedBody = `<div class="scout-berichte">${this.scoutBerichtHtml(bericht, state)}</div>`;
            }
            const eigener = spieler.clubId === state.userClubId;
            aktionen = `
                <div class="inbox-detail-aktionen">
                    <button class="btn btn-secondary btn-sm" data-inbox-akte="${this.escapeHtml(spieler.id)}"><svg class="ico" aria-hidden="true"><use href="#i-clipboard"/></svg><span>Spielerakte</span></button>
                    ${eigener ? "" : `<button class="btn btn-primary btn-sm" data-inbox-angebot="${this.escapeHtml(spieler.id)}">Verhandeln</button>`}
                    ${eigener && /^contract/.test(msg.type || "") ? `<button class="btn btn-primary btn-sm" data-inbox-vertrag="${this.escapeHtml(spieler.id)}">Vertrag verlängern</button>` : ""}
                </div>`;
        }

        // Der Entwicklungsbericht als Tabelle, jeder Name führt in die Akte
        if (msg.type === "development" && msg.entwicklung) {
            formattedBody = this.entwicklungsBerichtHtml(msg.entwicklung);
        }
        // Die Vorschläge des Sportdirektors als Karten mit Akte und Angebot
        if (msg.type === "sportdirektor" && Array.isArray(msg.vorschlaege) && typeof this.sdVorschlagHtml === "function") {
            const einleitung = String(msg.body || "").split("\n\n")[0];
            formattedBody = `<p>${this.escapeHtml(einleitung)}</p><div class="sd-liste">${msg.vorschlaege.map(v => this.sdVorschlagHtml(v)).join("")}</div>`
                + `<p class="text-muted" style="font-size:12px;">Wonach er sucht, können Sie ihm im Transfermarkt unter Sportdirektor sagen.</p>`;
        }

        detailContainer.innerHTML = `
            <div class="inbox-detail-header">
                <div class="inbox-detail-title-row">
                    <h2><span class="inbox-detail-icon">${this.postfachSymbol(icon)}</span>${msg.subject || msg.title || 'Nachricht'}</h2>
                    <span class="inbox-detail-date">${displayDate}</span>
                </div>
                <div class="inbox-detail-meta-grid">
                    <div>
                        <span class="meta-label">Absender</span>
                        <strong style="color:var(--text-main); font-size:13px;">${msg.sender || 'System'}</strong>
                    </div>
                    <div>
                        <span class="meta-label">Kategorie</span>
                        <strong style="color:var(--text-main); font-size:13px;">${typeLabel}</strong>
                    </div>
                </div>
            </div>
            <div class="inbox-detail-body">
                ${formattedBody}
            </div>
            ${aktionen}
        `;
        if (msg.type === "sportdirektor" && typeof this.bindeSdKarten === "function") this.bindeSdKarten(detailContainer);
        detailContainer.querySelectorAll("[data-entwicklung-akte]").forEach(el => el.addEventListener("click", () => {
            const pId = this.resolvePlayerId(el.dataset.entwicklungAkte);
            if (pId !== null) this.showPlayerDetailsModal(pId);
        }));
        detailContainer.querySelector("[data-inbox-akte]")?.addEventListener("click", (e) => {
            const pId = this.resolvePlayerId(e.currentTarget.dataset.inboxAkte);
            if (pId !== null) this.showPlayerDetailsModal(pId);
        });
        detailContainer.querySelector("[data-inbox-vertrag]")?.addEventListener("click", (e) => {
            const pId = this.resolvePlayerId(e.currentTarget.dataset.inboxVertrag);
            if (pId !== null) this.showPlayerDetailsModal(pId, { abschnitt: "vertrag" });
        });
        detailContainer.querySelector("[data-inbox-angebot]")?.addEventListener("click", (e) => {
            const pId = this.resolvePlayerId(e.currentTarget.dataset.inboxAngebot);
            if (pId !== null) this.showTransferOfferModal(pId);
        });
    }

    /**
     * Mannschaftsvergleich in Sternen.
     *
     * Zahlen wie "Angriff 81" sagen einem Manager wenig, solange er nicht
     * weiß, was seine eigene Mannschaft dort stehen hat. Nebeneinander in
     * derselben Sternesprache sieht man sofort, wo man überlegen ist und wo
     * es eng wird.
     */
    buildTeamComparisonHtml(eigenerClub, gegnerClub) {
        const engine = this.getRatingEngine();
        const state = this.app?.state;
        if (!engine || !state || !eigenerClub || !gegnerClub) return "";

        const kaderVon = (club) => (club.playerIds || [])
            .map(id => state.players.find(p => p.id === id))
            .filter(Boolean);

        const TEILE = [
            { name: "Tor", positionen: ["TW"] },
            { name: "Abwehr", positionen: ["IV", "LV", "RV"] },
            { name: "Mittelfeld", positionen: ["ZM", "DM", "OM", "LM", "RM"] },
            { name: "Angriff", positionen: ["ST", "LA", "RA"] }
        ];

        const kontext = this.starContext();
        const eigen = kaderVon(eigenerClub);
        const gegner = kaderVon(gegnerClub);

        // Ein Mannschaftsteil zählt nur mit seinen Besten - die Ersatzbank
        // steht am Spieltag nicht auf dem Platz.
        const teilSterne = (kader, positionen, anzahl) => {
            const passend = kader
                .filter(p => positionen.includes(p.pos) && (p.injuredWeeks || 0) <= 0)
                .sort((a, b) => (b.overall || 0) - (a.overall || 0))
                .slice(0, anzahl);
            if (passend.length === 0) return null;
            return engine.renderTeamStars(passend, kontext, { compact: true });
        };

        const zeilen = TEILE.map(teil => {
            const anzahl = teil.name === "Tor" ? 1 : teil.name === "Angriff" ? 3 : 4;
            const meins = teilSterne(eigen, teil.positionen, anzahl);
            const seins = teilSterne(gegner, teil.positionen, anzahl);
            if (!meins || !seins) return "";
            return `
                <div class="team-compare-row">
                    <div class="team-compare-side">${meins}</div>
                    <div class="team-compare-label">${teil.name}</div>
                    <div class="team-compare-side">${seins}</div>
                </div>`;
        }).join("");

        return `
            <div class="dash-card mb-3">
                <div class="team-compare-head">
                    <span>${this.escapeHtml(eigenerClub.name)}</span>
                    <span class="text-muted">Mannschaftsvergleich</span>
                    <span>${this.escapeHtml(gegnerClub.name)}</span>
                </div>
                <div class="team-compare-row team-compare-total">
                    <div class="team-compare-side">${engine.renderTeamStars(eigen, kontext)}</div>
                    <div class="team-compare-label">Gesamt</div>
                    <div class="team-compare-side">${engine.renderTeamStars(gegner, kontext)}</div>
                </div>
                ${zeilen}
                <div class="star-legend" style="justify-content:center;">
                    <span><i class="star-solid"></i> heutige Stärke</span>
                    <span><i class="star-growth"></i> Potenzial der Mannschaft</span>
                </div>
            </div>`;
    }

    /**
     * Modal: Gegneranalyse vor Spielbeginn anzeigen
     */
    showOpponentAnalysisModal() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const round = state.schedule.find(r => r.matchday === state.currentMatchday);
        const userMatch = round?.matches.find(m => m.homeClubId === userClub.id || m.awayClubId === userClub.id);

        if (!userMatch) {
            this.showToast("Kein anstehendes Spiel für die Gegneranalyse gefunden.", "warning");
            return;
        }

        const opponentId = userMatch.homeClubId === userClub.id ? userMatch.awayClubId : userMatch.homeClubId;
        const opponentEngine = (typeof OpponentAnalysisEngine !== 'undefined' && OpponentAnalysisEngine) 
            ? OpponentAnalysisEngine 
            : ((typeof window !== 'undefined' && window.OpponentAnalysisEngine) ? window.OpponentAnalysisEngine : null);

        if (!opponentEngine) return;

        const report = opponentEngine.generateReport(state, opponentId, userClub.id);
        if (!report) return;

        const modal = document.getElementById("modalOpponentAnalysis");
        const content = document.getElementById("opponentAnalysisContent");

        // Mannschaftsvergleich in Sternen: Wo sind wir besser, wo schlechter?
        const gegnerClub = state.clubs.find(c => c.id === opponentId);
        const vergleichHtml = this.buildTeamComparisonHtml(userClub, gegnerClub);

        content.innerHTML = `
            <div class="scout-report-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                <div>
                    <h3 style="font-size:22px; color:#f8fafc; margin-bottom:4px;">${report.opponentName}</h3>
                    <p class="text-muted" style="margin:0;">🏟️ ${report.stadium} • Tabellenplatz: <strong>#${report.rank}</strong> • Voraussichtlich: <strong>${report.likelyFormation}</strong></p>
                </div>
                <div style="text-align:right;">
                    <span class="badge ${report.dangerClass}" style="font-size:13px; padding:6px 12px;">Einstufung: ${report.dangerLevel}</span>
                </div>
            </div>

            ${report.analyst ? `<div class="stab-info mb-3">
                <div class="stab-info-kopf">
                    <span class="stab-info-titel">📋 Analyse</span>
                    <strong>${this.escapeHtml(report.analyst.name)}</strong>
                    ${this.stabSterneHtml(report.analyst.guete)}
                    <span class="sb-zuv" style="--zuv:${report.analyst.sterne >= 3 ? "#4ade80" : (report.analyst.sterne >= 2 ? "#facc15" : "#ef4444")};">${report.genauigkeit}</span>
                </div>
                ${report.analyst.sterne < 3 ? `<div class="stab-info-text">Ein besserer Spielanalyst läse die Mannschaftsteile genauer, stellt mehr Schlüsselspieler vor und findet die Schwachstelle in ihrer Elf.</div>` : ""}
            </div>` : ""}

            ${vergleichHtml}

            ${report.schwachstelle ? `<div class="dash-card mb-3" style="border-left:3px solid var(--accent-gold);">
                <h4 style="color:var(--accent-gold); margin-bottom:6px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-target"/></svg>Schwachstelle in ihrer Elf</h4>
                <p style="font-size:13px; margin:0;">${this.escapeHtml(report.schwachstelle.text)}</p>
            </div>` : ""}

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
                <div class="dash-card" style="border-left:3px solid #22c55e;">
                    <h4 style="color:#22c55e; margin-bottom:10px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-up"/></svg>Stärken des Gegners</h4>
                    <ul style="padding-left:18px; margin:0; font-size:13px;">
                        ${report.strengths.map(s => `<li>${s}</li>`).join("")}
                    </ul>
                </div>
                <div class="dash-card" style="border-left:3px solid #ef4444;">
                    <h4 style="color:#ef4444; margin-bottom:10px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-alert"/></svg>Schwachstellen</h4>
                    <ul style="padding-left:18px; margin:0; font-size:13px;">
                        ${report.weaknesses.map(w => `<li>${w}</li>`).join("")}
                    </ul>
                </div>
            </div>

            <div class="dash-card" style="margin-bottom:20px; background:rgba(56, 189, 248, 0.05); border:1px solid rgba(56, 189, 248, 0.25);">
                <h4 style="color:#38bdf8; margin-bottom:6px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-clipboard"/></svg>Taktische Tendenz & Cheftrainer-Empfehlung</h4>
                <p style="font-size:13px; margin-bottom:8px;"><strong>Taktik des Gegners:</strong> ${report.tacticalTrend}</p>
                <p style="font-size:13px; color:#f8fafc; margin:0;"><strong>💡 Trainer-Rat:</strong> ${report.recommendation}</p>
            </div>

            <div class="dash-card">
                <h4 style="margin-bottom:12px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-star"/></svg>Schlüsselspieler im Fokus & Scouting</h4>
                <div style="display:flex; gap:14px; flex-wrap:wrap;">
                    ${report.keyPlayers.map(p => `
                        <div style="background:rgba(255,255,255,0.04); padding:10px 14px; border-radius:8px; border:1px solid var(--border-color); flex:1; min-width:180px; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <strong>${p.name}</strong>
                                    <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span>
                                </div>
                                <div style="margin-top:6px; font-size:13px; color:#f59e0b;">
                                    ${p.abilityStarsHtml || p.starsCaHtml} <span style="font-size:11px; color:var(--text-muted);">(${p.abilityLabel})</span>
                                </div>
                                <div style="font-size:11px; color:var(--accent-primary); margin-top:2px;">
                                    Rolle: <strong>${p.bestRole?.role || 'Stammspieler'}</strong>
                                </div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                                    Gefahr: <span class="badge ${p.dangerBadgeClass}" style="font-size:10px; padding:2px 6px;">${p.danger}</span> • Scouthinweis: <strong>${p.confidence}%</strong>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-secondary btn-scout-opponent-player mt-2" data-player-id="${p.id}" style="width:100%;" ${this.beobachtungsText(p.id) ? "disabled" : ""}>
                                ${this.beobachtungsText(p.id) ? `👁 In Beobachtung (${this.beobachtungsText(p.id)})` : "🔍 Spieler beobachten"}
                            </button>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;

        modal.style.display = "flex";
        this.playSound("click");

        content.querySelectorAll(".btn-scout-opponent-player").forEach(btn => {
            btn.addEventListener("click", () => {
                const pId = this.resolvePlayerId(btn.dataset.playerId);
                const scoutingEngine = (typeof ScoutingEngine !== 'undefined' && ScoutingEngine) 
                    ? ScoutingEngine 
                    : ((typeof window !== 'undefined' && window.ScoutingEngine) ? window.ScoutingEngine : null);

                if (scoutingEngine) this.beobachte(pId, "opponent_analysis", () => this.showOpponentAnalysisModal());
            });
        });
    }

    /**
     * Modal: Transferangebot Verhandlungsdialog
     */
    showTransferOfferModal(playerId) {
        const state = this.app.state;
        const player = state.players.find(p => p.id === playerId);
        const sellerClub = state.clubs.find(c => c.id === player.clubId);
        const userClub = state.clubs.find(c => c.id === state.userClubId);

        if (!player || !sellerClub || !userClub) return;

        const modal = document.getElementById("modalTransferOffer");
        const body = document.getElementById("transferOfferContent");
        document.getElementById("toModalTitle").textContent = `Verhandlung: ${player.name}`;

        const askingPriceEst = TransferEngine.calculateAskingPrice(player, sellerClub);

        body.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
                <div>
                    <h4>${player.name} (${player.pos})</h4>
                    <p class="text-muted">Aktueller Verein: ${sellerClub.name}</p>
                </div>
                <div style="text-align:right;">
                    <div>${this.starsFor(player.overall, { title: "Stärke im Vergleich zum eigenen Kader" })}</div>
                    <p class="text-muted">Potenzial: ${this.starsFor(player.pot, { color: "#38bdf8", title: "Mögliche Entwicklung" })}</p>
                </div>
            </div>

            <div class="finance-stat-row">
                <span>Marktwert:</span>
                <strong>${GameState.formatMoney(player.value)}</strong>
            </div>
            <div class="finance-stat-row">
                <span>Geschätzte Mindestforderung:</span>
                <strong style="color:#f59e0b;">ca. ${GameState.formatMoney(askingPriceEst)}</strong>
            </div>
            <div class="finance-stat-row">
                <span>Ihr Transferbudget:</span>
                <strong style="color:#34d399;">${GameState.formatMoney(userClub.transferBudget)}</strong>
            </div>

            <div class="tactic-field" style="margin-top:16px;">
                <label>Eröffnungsangebot Ablöse (€):</label>
                <input type="number" id="offerFeeInput" class="styled-input" value="${askingPriceEst}" step="100000" min="0">
            </div>

            <div class="hint-box" style="margin-top:12px;">
                So läuft es ab: Zuerst einigen wir uns mit ${this.escapeHtml(sellerClub.name)} auf die Ablöse,
                danach verhandelt der Berater über Gehalt, Laufzeit und Handgeld, zum Schluss folgt der Medizincheck.
                Jede Antwort dauert ein bis drei Tage – den Stand sehen Sie im Reiter <strong>Transfers</strong>.
            </div>

            <div id="transferFeedback" style="margin-top:14px; font-size:13px; font-weight:600;"></div>

            <div class="modal-footer" style="padding:16px 0 0 0;">
                <button class="btn btn-secondary" id="btnCancelBid">Abbrechen</button>
                <button class="btn btn-primary" id="btnSubmitBid">Verhandlung eröffnen</button>
            </div>
        `;

        modal.style.display = "flex";

        document.getElementById("btnCancelBid").onclick = () => {
            modal.style.display = "none";
        };
        document.getElementById("btnCloseTransferOffer").onclick = () => {
            modal.style.display = "none";
        };

        // Der Transfer ist kein Knopfdruck mehr: Hier wird nur die
        // Verhandlung eröffnet, der Rest läuft über die nächsten Tage.
        document.getElementById("btnSubmitBid").onclick = () => {
            const fee = Number(document.getElementById("offerFeeInput").value) || 0;
            const feedback = document.getElementById("transferFeedback");
            const engine = this.getNegotiationEngine();

            if (!engine) {
                feedback.style.color = "#ef4444";
                feedback.textContent = "❌ Verhandlungen sind derzeit nicht verfügbar.";
                return;
            }

            const res = engine.startTransferNegotiation(state, player.id, userClub.id, fee);
            if (!res.success) {
                feedback.style.color = "#ef4444";
                feedback.textContent = `❌ ${res.error}`;
                return;
            }

            feedback.style.color = "#34d399";
            feedback.textContent = `✅ Angebot über ${this.formatMoneySafe(fee)} liegt ${sellerClub.name} vor. Berater ${res.negotiation.agentName} begleitet die Gespräche.`;
            this.playSound("click");

            setTimeout(() => {
                modal.style.display = "none";
                this.switchTab("transfers");
                this.renderHeader();
            }, 1400);
        };
    }

    /**
     * Startet die 2D Live Match Simulation im Vollbild-Modal
     */
    /** Auflösung der ManagerEngine (Browser & Node) */
    getManagerEngine() {
        if (typeof ManagerEngine !== "undefined" && ManagerEngine) return ManagerEngine;
        if (typeof window !== "undefined" && window.ManagerEngine) return window.ManagerEngine;
        return null;
    }

    getMatchplanEngine() {
        if (typeof MatchplanEngine !== "undefined" && MatchplanEngine) return MatchplanEngine;
        if (typeof window !== "undefined" && window.MatchplanEngine) return window.MatchplanEngine;
        return null;
    }

    /**
     * Taktikbesprechung vor dem Anpfiff: Die Analyse des Gegners auf einen
     * Blick und bis zu zwei Punkte für genau dieses Spiel. Der Analyst sagt
     * dazu, was er von jedem Punkt hält - so gut, wie er hinschaut.
     *
     * onDone läuft nach "Festlegen" wie nach "Ohne Plan"; ohne onDone (Aufruf
     * vom Dashboard) wird der Plan nur gespeichert.
     */
    showMatchplanModal(match, onDone = null) {
        const state = this.app.state;
        const engine = this.getMatchplanEngine();
        const modal = document.getElementById("modalMatchplan");
        const body = document.getElementById("matchplanContent");
        const v = engine && match ? engine.vorschlag(state, match) : null;
        if (!engine || !modal || !body || !v) {
            if (onDone) onDone();
            return;
        }

        const r = v.report || {};
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const auswahl = new Set(v.gespeichert ? v.gespeichert.punkte : []);
        let zielId = v.gespeichert?.zielId ?? (v.ziele[0]?.id ?? null);
        const sieht = (r.analyst?.sterne || 0) >= 2.5;
        const gegensatz = { fluegel: "zentrum", zentrum: "fluegel", fruehStoeren: "tiefStehen", tiefStehen: "fruehStoeren" };
        const heim = match.homeClubId === state.userClubId;
        // Der Schiedsrichter steht mit der Ansetzung fest - ein strenger
        // bestraft harte Zweikämpfe, ein großzügiger lässt laufen
        const schiri = typeof MatchEngine !== "undefined" && MatchEngine.schiedsrichterFuer
            ? MatchEngine.schiedsrichterFuer(match) : null;

        document.getElementById("mpModalTitle").textContent = `Taktikbesprechung: ${v.gegnerName}`;

        const analyseHtml = `
            <div class="mp-analyse">
                <div class="mp-lage">
                    <span>${heim ? "Heimspiel" : "Auswärtsspiel"} gegen <strong>${esc(v.gegnerName)}</strong></span>
                    ${r.likelyFormation ? `<span class="mp-chip">Voraussichtlich ${esc(r.likelyFormation)}</span>` : ""}
                    ${r.dangerLevel ? `<span class="badge ${esc(r.dangerClass)}">${esc(r.dangerLevel)}</span>` : ""}
                </div>
                ${schiri ? `<div class="mp-analyst">🟨 Schiedsrichter <strong>${esc(schiri.name)}</strong> <span class="text-muted">${esc(schiri.art)} - ${esc(schiri.text)}</span></div>` : ""}
                ${this.wetterHtml(match, "mp-analyst")}
                ${r.analyst ? `<div class="mp-analyst">
                    📋 <strong>${esc(r.analyst.name)}</strong> ${this.stabSterneHtml(r.analyst.guete)}
                    <span class="text-muted">${esc(r.genauigkeit || "")}${sieht ? "" : " - zu ungenau für klare Empfehlungen"}</span>
                </div>` : ""}
                ${r.tacticalTrend ? `<p class="mp-trend">${esc(r.tacticalTrend)}</p>` : ""}
                <div class="mp-spalten">
                    <div><h5 class="mp-plus">Stärken</h5><ul>${(r.strengths || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>
                    <div><h5 class="mp-minus">Schwächen</h5><ul>${(r.weaknesses || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>
                </div>
                ${r.schwachstelle ? `<div class="mp-schwach">🔎 ${esc(r.schwachstelle.text)}</div>` : ""}
                ${(r.keyPlayers || []).length ? `<div class="mp-schluessel">
                    <span class="text-muted">Schlüsselspieler:</span>
                    ${r.keyPlayers.map(k => `<span class="mp-chip"><span class="pos-tag pos-${this.getPosGroup(k.pos)}">${esc(k.pos)}</span> ${esc(k.name)}${k.danger === "Hoch" ? " ⚠️" : ""}</span>`).join("")}
                </div>` : ""}
            </div>`;

        const karten = v.plaene.map(p => `
            <button class="mp-karte" data-key="${p.key}" ${p.verfuegbar ? "" : "disabled"}>
                <span class="mp-icon">${p.icon}</span>
                <span class="mp-text">
                    <strong>${esc(p.name)}</strong>
                    <span class="mp-beschreibung">${esc(p.text)}</span>
                    ${!p.verfuegbar ? `<span class="mp-grund">${p.braucht === "schwachstelle" ? "Der Analyst hat keine Schwachstelle gefunden." : "Kein Schlüsselspieler bekannt."}</span>`
                        : p.empfohlen ? `<span class="mp-empfehlung">📋 ${esc(p.grund)}</span>`
                        : (sieht && p.grund ? `<span class="mp-grund">${esc(p.grund)}</span>` : "")}
                </span>
            </button>`).join("");

        body.innerHTML = `
            ${analyseHtml}
            <div class="mp-kopfzeile">
                <h4>Ihr Plan für dieses Spiel</h4>
                <span class="mp-zaehler" id="mpZaehler"></span>
            </div>
            <p class="mp-hinweis">Bis zu zwei Punkte. Sie gelten nur für diese Partie - danach steht wieder Ihre gewohnte Taktik.
                Trifft ein Punkt eine echte Schwäche des Gegners, ist die Mannschaft spürbar besser eingestellt.</p>
            <div class="mp-karten">${karten}</div>
            <div class="mp-ziel" id="mpZiel" style="display:none;">
                <label for="mpZielWahl">Eng decken:</label>
                <select id="mpZielWahl" class="styled-input">
                    ${v.ziele.map(z => `<option value="${esc(z.id)}" ${String(z.id) === String(zielId) ? "selected" : ""}>${esc(z.name)} (${esc(z.pos)})${z.danger === "Hoch" ? " - gefährlich" : ""}</option>`).join("")}
                </select>
            </div>
            <div class="mp-aktionen">
                <button class="btn btn-secondary" id="btnMatchplanOhne">${onDone ? "Ohne Besprechung" : "Plan verwerfen"}</button>
                <button class="btn btn-primary" id="btnMatchplanFest">${onDone ? "Weiter zur Ansprache ▶" : "Plan festlegen"}</button>
            </div>
        `;

        const zeichne = () => {
            body.querySelectorAll(".mp-karte").forEach(btn => btn.classList.toggle("aktiv", auswahl.has(btn.dataset.key)));
            const zaehler = document.getElementById("mpZaehler");
            if (zaehler) zaehler.textContent = `${auswahl.size} / ${engine.MAX_PUNKTE}`;
            const ziel = document.getElementById("mpZiel");
            if (ziel) ziel.style.display = auswahl.has("engDecken") && v.ziele.length ? "" : "none";
            const fest = document.getElementById("btnMatchplanFest");
            if (fest && !onDone) fest.disabled = auswahl.size === 0;
        };

        body.querySelectorAll(".mp-karte").forEach(btn => {
            btn.addEventListener("click", () => {
                const key = btn.dataset.key;
                if (auswahl.has(key)) {
                    auswahl.delete(key);
                } else {
                    // Was sich widerspricht, fliegt raus - früh stören und tief
                    // stehen gleichzeitig kann keine Mannschaft
                    if (gegensatz[key]) auswahl.delete(gegensatz[key]);
                    if (auswahl.size >= engine.MAX_PUNKTE) {
                        this.showToast(`Höchstens ${engine.MAX_PUNKTE} Punkte - mehr behält keine Mannschaft im Kopf.`, "warning");
                        return;
                    }
                    auswahl.add(key);
                }
                this.playSound("click");
                zeichne();
            });
        });
        const zielWahl = document.getElementById("mpZielWahl");
        if (zielWahl) zielWahl.onchange = () => { zielId = zielWahl.value; };

        const schliessen = () => {
            modal.style.display = "none";
            if (onDone) onDone();
        };
        document.getElementById("btnMatchplanOhne").onclick = () => {
            engine.abschliessen(state, match);
            if (!onDone) this.showToast("Kein Matchplan - es gilt die gewohnte Taktik.", "info");
            schliessen();
            if (!onDone) this.renderDashboard();
        };
        document.getElementById("btnMatchplanFest").onclick = () => {
            if (auswahl.size === 0) {
                engine.abschliessen(state, match);
                schliessen();
                return;
            }
            const plan = engine.festlegen(state, match, [...auswahl], zielId);
            const namen = plan.punkte.map(k => k === "engDecken" && plan.zielName
                ? `${plan.zielName} eng decken` : engine.PLAENE[k].name);
            const urteil = sieht && plan.treffer >= plan.punkte.length ? " Der Analyst ist überzeugt."
                : sieht && plan.treffer === 0 ? " Der Analyst hat Zweifel." : "";
            this.showToast(`Matchplan steht: ${namen.join(", ")}.${urteil}`, "success");
            schliessen();
            if (!onDone) this.renderDashboard();
        };
        const x = document.getElementById("btnCloseMatchplan");
        if (x) x.onclick = () => { modal.style.display = "none"; };

        zeichne();
        modal.style.display = "flex";
    }

    /**
     * Kabinenansprache vor dem Anpfiff oder in der Halbzeit.
     *
     * Der Ton wird nicht bewertet, sondern wirkt: Wer eine 2:0 führende
     * Mannschaft anbrüllt, nimmt ihr die Lockerheit. Die Wirkung landet in
     * Moral und Form und damit direkt in der Spielstärke.
     */
    showTeamTalkModal(options = {}, onDone = null) {
        const state = this.app.state;
        const engine = this.getManagerEngine();
        const modal = document.getElementById("modalTeamTalk");
        const body = document.getElementById("teamTalkContent");

        if (!engine || !modal || !body) {
            if (onDone) onDone(null);
            return;
        }

        const ctx = engine.buildTalkContext(state, options);
        const istHalbzeit = ctx.phase === "halftime";

        const lage = istHalbzeit
            ? (ctx.scoreDiff > 0 ? `Sie führen mit ${ctx.scoreDiff} Tor${ctx.scoreDiff === 1 ? "" : "en"}.`
                : ctx.scoreDiff < 0 ? `Sie liegen mit ${Math.abs(ctx.scoreDiff)} Tor${ctx.scoreDiff === -1 ? "" : "en"} zurück.`
                : "Es steht unentschieden.")
            : (ctx.isFavourite ? `Ihre Mannschaft geht als Favorit in das Spiel gegen ${this.escapeHtml(ctx.opponentName)}.`
                : ctx.isUnderdog ? `Gegen ${this.escapeHtml(ctx.opponentName)} sind Sie Außenseiter.`
                : `Ein Spiel auf Augenhöhe gegen ${this.escapeHtml(ctx.opponentName)}.`);

        const stimmung = ctx.avgMorale >= 82 ? "Die Mannschaft strotzt vor Selbstvertrauen."
            : ctx.avgMorale >= 62 ? "Die Stimmung in der Kabine ist gelöst."
            : "Die Mannschaft wirkt verunsichert.";

        document.getElementById("ttModalTitle").textContent = istHalbzeit
            ? "Halbzeitansprache"
            : "Ansprache vor dem Anpfiff";

        // Vor dem Anpfiff steht der Matchplan noch einmal auf der Tafel
        const planEngine = this.getMatchplanEngine();
        const plan = !istHalbzeit && planEngine && state.matchplan && state.matchplan.clubId === state.userClubId ? state.matchplan : null;
        const planZeile = plan && plan.punkte.length
            ? `<p class="tt-plan">📋 Matchplan: ${plan.punkte.map(k => this.escapeHtml(k === "engDecken" && plan.zielName
                ? `${plan.zielName} eng decken` : (planEngine.PLAENE[k]?.name || k))).join(" · ")}</p>`
            : "";

        body.innerHTML = `
            <p class="team-talk-situation">${lage} ${stimmung}</p>
            ${planZeile}
            <div class="team-talk-options">
                ${engine.TEAM_TALK_TONES.map(t => `
                    <button class="team-talk-option" data-tone="${t.key}">
                        <span class="tt-icon">${t.icon}</span>
                        <span class="tt-body">
                            <strong>${this.escapeHtml(t.label)}</strong>
                            <span class="tt-line">„${this.escapeHtml(t.line)}"</span>
                            <span class="tt-hint">${this.escapeHtml(t.hint)}</span>
                        </span>
                    </button>
                `).join("")}
            </div>
            <div id="teamTalkResult"></div>
        `;

        modal.style.display = "flex";

        body.querySelectorAll(".team-talk-option").forEach(btn => {
            btn.addEventListener("click", () => {
                const res = engine.applyTeamTalk(state, btn.dataset.tone, options);
                if (!res.success) return;

                const farbe = res.moraleDelta >= 1.5 ? "#34d399" : res.moraleDelta <= -1.5 ? "#f87171" : "#94a3b8";
                document.getElementById("teamTalkResult").innerHTML = `
                    <div class="team-talk-result">
                        <strong style="color:${farbe};">${this.escapeHtml(res.summary)}</strong>
                        <div class="tt-delta">Moral im Schnitt ${res.moraleDelta > 0 ? "+" : ""}${res.moraleDelta}</div>
                        ${res.reactions.map(r => `<div class="tt-reaction ${r.positive ? "positive" : "negative"}">${this.escapeHtml(r.text)}</div>`).join("")}
                        <button class="btn btn-primary mt-2" id="btnTeamTalkContinue">
                            ${istHalbzeit ? "Zweite Halbzeit ▶" : "Auf den Platz ▶"}
                        </button>
                    </div>
                `;
                body.querySelectorAll(".team-talk-option").forEach(b => { b.disabled = true; });
                this.playSound("click");

                document.getElementById("btnTeamTalkContinue").onclick = () => {
                    modal.style.display = "none";
                    if (onDone) onDone(res);
                };
            });
        });
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
     * In FM heißt der Knopf nie "einen Tag simulieren", sondern nennt das
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
                return n ? `Weiter zum Spiel ${n.heim ? "gegen" : "bei"} ${this.kurzName(n.gegnerName)}` : "Weiter zum Spieltag";
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
            this.showToast(val.message, "error");
            this.switchTab("tactics");
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
            this.showToast(val.message, "error");
            this.switchTab("tactics");
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
            this.showToast(
                `🥅 Elfmeterschießen ${stand[0]}:${stand[1]} - ${sieger?.name || "Sieger"} steht in der nächsten Runde.`,
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
     * Champions League ist nachtblau mit Sternenlicht, der Landespokal
     * rot-golden, die Conference League grün. Die Farben gehen als
     * CSS-Variablen an die Oberfläche, so dass Anzeigetafel, Tabelle und
     * Spielplan mitziehen, ohne dass jede Stelle den Wettbewerb kennen muss.
     */
    static WETTBEWERB_THEMEN = {
        ucl: {
            icon: "⭐", name: "Champions League", kurz: "UCL",
            accent: "#4f8bff", accent2: "#c7dcff", flaeche: "rgba(15, 30, 78, 0.92)"
        },
        uel: {
            icon: "🌍", name: "Europa League", kurz: "UEL",
            accent: "#f97316", accent2: "#fdba74", flaeche: "rgba(66, 27, 4, 0.9)"
        },
        uecl: {
            icon: "🏆", name: "Conference League", kurz: "UECL",
            accent: "#22c55e", accent2: "#86efac", flaeche: "rgba(8, 48, 26, 0.9)"
        },
        cup: {
            icon: "🏆", name: "Pokal", kurz: "Pokal",
            accent: "#f5c542", accent2: "#fde68a", flaeche: "rgba(74, 20, 20, 0.92)"
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
     * hinschreiben, worum es geht: "Champions League · Viertelfinale".
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

        const runde = match?.roundName
            || (match?.matchday ? `${match.matchday}. Spieltag` : "")
            || (state?.currentMatchday ? `${state.currentMatchday}. Spieltag` : "");

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

    getCareerEngine() {
        if (typeof CareerEngine !== "undefined" && CareerEngine) return CareerEngine;
        if (typeof window !== "undefined" && window.CareerEngine) return window.CareerEngine;
        return null;
    }

    /**
     * Prüft nach jedem Zeitschritt, ob der Vorstand die Zusammenarbeit beendet
     * hat - und hält dann alles an.
     *
     * Vorher wurde `state.managerDismissed` gesetzt und von niemandem gelesen:
     * Man wurde entlassen und managte am nächsten Spieltag weiter denselben
     * Verein.
     *
     * Gibt true zurück, wenn die Entlassung den Ablauf unterbrochen hat.
     */
    pruefeEntlassung() {
        const state = this.app?.state;
        const career = this.getCareerEngine();
        if (!state || !career) return false;
        if (!state.managerDismissed || state.careerOver) return false;
        if (this._entlassungOffen) return true;

        const daten = career.verarbeiteEntlassung(state);
        if (!daten) return false;

        this._entlassungOffen = true;
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.zeigeEntlassung(daten);
        return true;
    }

    /**
     * Das Ende einer Station: was war, und was jetzt möglich ist.
     */
    zeigeEntlassung(daten) {
        const state = this.app.state;
        const modal = document.getElementById("modalDismissal");
        if (!modal) return;

        const b = daten.bilanz || { spiele: 0, siege: 0, unentschieden: 0, niederlagen: 0, punkteSchnitt: 0 };

        DOM.setText("dismissSubtitle",
            `${daten.clubName} trennt sich zum ${daten.matchday}. Spieltag von Ihnen.`);

        const body = document.getElementById("dismissBody");
        if (body) {
            body.innerHTML = `
                <div class="dash-card">
                    <h4>Ihre Bilanz bei ${this.escapeHtml(daten.clubName)}</h4>
                    <div class="dismiss-stats">
                        <div><span>${b.spiele}</span><small>Spiele</small></div>
                        <div><span>${b.siege}</span><small>Siege</small></div>
                        <div><span>${b.unentschieden}</span><small>Remis</small></div>
                        <div><span>${b.niederlagen}</span><small>Pleiten</small></div>
                        <div><span>${b.punkteSchnitt}</span><small>Punkte/Spiel</small></div>
                    </div>
                    <p class="text-muted" style="margin-top:10px;">
                        Tabellenplatz zum Zeitpunkt der Trennung: <strong>${daten.rank}.</strong> ·
                        Ihr Ruf in der Branche: <strong>${daten.ruf}</strong> von 100
                    </p>
                </div>
            `;
        }

        const offers = document.getElementById("dismissOffers");
        const angebote = daten.angebote || [];
        if (offers) {
            offers.innerHTML = angebote.length
                ? `<h4 class="dismiss-offers-title">Diese Vereine würden Sie nehmen</h4>`
                    + angebote.map((a, i) => `
                        <button class="dismiss-offer" data-offer="${i}">
                            <div class="dismiss-offer-main">
                                <strong>${this.escapeHtml(a.clubName)}</strong>
                                <span class="dismiss-offer-league">${this.escapeHtml(a.leagueName)}</span>
                            </div>
                            <div class="dismiss-offer-meta">
                                Platz ${a.platz} von ${a.vonWievielen} ·
                                Etat ${this.formatMoneySafe(a.budget)} ·
                                Ziel: ${this.erwartungText(a.erwartung)}
                            </div>
                        </button>
                    `).join("")
                : `<p class="text-muted" style="text-align:center; padding:12px;">
                       Im Moment sucht kein Verein einen Trainer mit Ihrem Werdegang.
                       Es bleibt nur, die Laufbahn zu beenden.
                   </p>`;

            offers.querySelectorAll("[data-offer]").forEach(btn => {
                btn.onclick = () => {
                    const angebot = angebote[parseInt(btn.dataset.offer, 10)];
                    if (!angebot) return;
                    this.nimmTrainerAngebotAn(angebot);
                };
            });
        }

        const btnEnde = document.getElementById("btnEndCareer");
        if (btnEnde) btnEnde.onclick = () => this.beendeLaufbahn();

        modal.style.display = "flex";
        this.playSound("click");
    }

    erwartungText(key) {
        return ({
            championship: "Meisterschaft", top3: "unter die ersten Drei",
            midfield: "gesichertes Mittelfeld", avoid_relegation: "Klassenerhalt"
        })[key] || "Mittelfeld";
    }

    /**
     * Ein Trainerangebot annehmen und bei einem neuen Verein anfangen.
     * Hieß früher wie das Annehmen eines Transferangebots - und überschrieb
     * es: Ein Angebot für einen eigenen Spieler ließ sich nicht annehmen.
     */
    nimmTrainerAngebotAn(angebot) {
        const state = this.app.state;
        const career = this.getCareerEngine();
        if (!career) return;

        const res = career.uebernimm(state, angebot.clubId);
        if (!res.erfolg) {
            this.showToast(res.grund || "Der Wechsel hat nicht geklappt.", "error");
            return;
        }

        this._entlassungOffen = false;
        const modal = document.getElementById("modalDismissal");
        if (modal) modal.style.display = "none";

        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage(null, true);
        this.showToast(`🤝 Sie übernehmen ${res.club.name}.`, "success");
        this.renderHeader();
        this.switchTab("dashboard");
    }

    /** Die Laufbahn beenden - und das Zeugnis zeigen */
    beendeLaufbahn() {
        const state = this.app.state;
        const career = this.getCareerEngine();
        if (!career) return;

        const zeugnis = career.beendeKarriere(state);
        this._entlassungOffen = false;

        const modal = document.getElementById("modalDismissal");
        if (modal) modal.style.display = "none";
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage(null, true);

        this.zeigeZeugnis(zeugnis);
    }

    zeigeZeugnis(zeugnis) {
        const modal = document.getElementById("modalCareerEnd");
        if (!modal) return;

        DOM.setText("careerEndSubtitle",
            `${zeugnis.name} · ${zeugnis.stationen.length} Station${zeugnis.stationen.length === 1 ? "" : "en"} · `
            + `${zeugnis.titel.length} Titel · ${zeugnis.siegquote} % Siege`);

        const details = document.getElementById("careerEndDetails");
        if (details) {
            const stationen = zeugnis.stationen.map(s => `
                <div class="career-station">
                    <div class="career-station-club">${this.escapeHtml(s.clubName)}</div>
                    <div class="career-station-time">
                        Saison ${s.vonSaison}${s.bisSaison && s.bisSaison !== s.vonSaison ? `–${s.bisSaison}` : ""}
                        · ${s.spiele} Spiele, ${s.siege} S / ${s.unentschieden} U / ${s.niederlagen} N
                        ${s.ende === "entlassen" ? " · entlassen" : ""}
                    </div>
                </div>
            `).join("");

            const titel = zeugnis.titel.length
                ? `<h4 style="margin-top:14px;">Titel</h4>`
                    + zeugnis.titel.map(t =>
                        `<div class="career-title-row">🏆 ${this.escapeHtml(t.wettbewerb)} · Saison ${t.saison} · ${this.escapeHtml(t.clubName)}</div>`).join("")
                : `<p class="text-muted" style="margin-top:14px;">Ohne Titel - aber nicht ohne Geschichten.</p>`;

            details.innerHTML = `
                <div class="dash-card" style="text-align:left;">
                    <h4>Stationen</h4>
                    ${stationen || '<p class="text-muted">Keine Stationen verzeichnet.</p>'}
                    ${titel}
                    <p class="text-muted" style="margin-top:14px;">
                        Gesamt: ${zeugnis.gesamt.spiele} Spiele ·
                        ${zeugnis.gesamt.siege} Siege ·
                        ${zeugnis.entlassungen} Entlassung${zeugnis.entlassungen === 1 ? "" : "en"}
                    </p>
                </div>
            `;
        }

        const btn = document.getElementById("btnCareerEndNewGame");
        if (btn) {
            btn.onclick = () => {
                modal.style.display = "none";
                this.showStartScreen();
            };
        }

        modal.style.display = "flex";
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

    /** Mehrere Tage am Stück, aber über denselben Weg wie ein einzelner */
    laufeBisTermin(maxTage) {
        const state = this.app.state;
        const cal = this.getCalendarEngine();
        if (!cal) return;

        let gelaufen = 0;
        let angehalten = null;
        const berichte = [];
        while (gelaufen < maxTage) {
            const heute = cal.getCurrentDay(state);
            if (!heute) break;
            // Vor einem Termin, der den Manager braucht, wird angehalten
            if (gelaufen > 0 && ["matchday", "friendly", "media"].includes(heute.type)) break;
            if (gelaufen > 0 && heute.type === "season_end" && state._seasonFinished !== state.seasonYear) break;
            if (gelaufen > 0 && heute.saisonwechsel) break;
            // Ein Pokalabend hält nur auf, wenn der eigene Verein spielt
            if (gelaufen > 0 && (heute.type === "cup" || heute.type === "euro")
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

            // Wie im FM: Passiert etwas, das den Manager angeht, hält die
            // Zeit an - auch zwischen zwei Terminen
            angehalten = typeof cal.unterbrechungsGrund === "function"
                ? cal.unterbrechungsGrund(state, res, bekannt) : null;
            if (angehalten) break;
        }

        const heuteNeu = cal.getCurrentDay(state);
        state.lastDayReport = {
            date: heuteNeu?.date,
            dayOfWeek: heuteNeu?.dayOfWeek,
            title: angehalten ? `Angehalten: ${angehalten}` : `${gelaufen} Tage übersprungen`,
            messages: berichte.slice(-12)
        };

        if (angehalten) {
            this.showToast(`⏸ ${heuteNeu?.date || ""}: ${angehalten}. Weiter geht es mit dem nächsten Klick.`, "warning", 6000);
        } else {
            this.showToast(`📅 ${gelaufen} Tage weiter - ${heuteNeu?.title || ""}`, "info");
        }
        this.renderHeader();
        this.renderCurrentTab();
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        if (!this.pruefeEntlassung()) this.pruefeNeueAngebote();
    }

    handleCalendarAdvanceDay() {
        const state = this.app.state;
        const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine) 
            ? CalendarEngine 
            : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : null);

        if (!calendarEngine) return;

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
                this.playSound("whistle");
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.showSeasonEndCelebration(res.matchResult);
                return;
            }
            if (res.type === "season_change") return this.zeigeSaisonwechsel(res);

            if (res.type === "matchday" && res.matchResult) {
                this.playSound("whistle");
                this.showToast(`⚽ Spieltag ${state.currentMatchday - 1} wurde simuliert!`, "success");
            } else if (res.type === "cup" || res.type === "euro") {
                this.playSound("whistle");
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
                this.showToast(
                    `📅 ${res.day?.date}: ${msg}${anzahl > 1 ? ` (+${anzahl - 1} weitere im Tagesbericht)` : ""}`,
                    "info");
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
                this.playSound("whistle");
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
            <div class="dash-card" style="margin-top:16px;">
                <h4>Ihr Saisonabschluss:</h4>
                <p>Ihr Verein belegt den <strong>${endResult.userRank}. Tabellenplatz</strong>.</p>
                <p>Die Saisonprämien wurden auf Ihr Vereinskonto überwiesen.</p>
            </div>
            <div class="dash-card se-pause">
                <h4>☀️ Sommerpause: ${wochen} Wochen bis zum Saisonwechsel</h4>
                ${auslaufend.length ? `
                    <p>${auslaufend.length === 1 ? "Ein Vertrag endet" : `${auslaufend.length} Verträge enden`} zum Saisonwechsel. Wer bleiben soll, mit dem jetzt verlängern - andere Vereine werben schon:</p>
                    <div class="attention-namen se-namen">
                        ${auslaufend.map(p => `<button class="attention-name" data-player="${this.escapeHtml(String(p.id))}">${this.escapeHtml(p.name)} <small>${this.escapeHtml(p.pos || "")}</small></button>`).join("")}
                    </div>`
                    : `<p>Kein Vertrag läuft aus. Die Mannschaft hat frei, Sie planen die neue Saison.</p>`}
            </div>
        `;

        modal.style.display = "flex";
        this.playSound("goal");

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
        SeasonEngine.startNextSeason(state);
        this.zeigeSaisonwechsel({ neueSaison: state.seasonYear });
    }

    /** Nach dem Saisonwechsel: neue Saison, neue Vorbereitung */
    zeigeSaisonwechsel(res) {
        const state = this.app.state;
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.playSound("whistle");
        this.showToast(`🔄 Saison ${res?.neueSaison || state.seasonYear} beginnt - die Vorbereitung läuft.`, "success", 6000);
        this.switchTab("dashboard");
        this.renderHeader();
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
            ["btnSubTransfersMarket", "btnSubTransfersScouting", "btnSubTransfersLoans", "btnSubTransfersSD"].forEach(id =>
                document.getElementById(id)?.classList.toggle("active", id === knopf));
            ["viewTransferMarket", "viewScoutingCenter", "viewLoans", "viewSportdirektor"].forEach(id =>
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

        // Scout Auftrag absenden
        document.getElementById("btnStartScoutAssignment")?.addEventListener("click", () => {
            const pos = document.getElementById("scoutPosSelect")?.value || "ALL";
            const maxAge = parseInt(document.getElementById("scoutAgeSelect")?.value || "25", 10);
            // Der Auftrag wird in Sternen erteilt und in eine Stärke übersetzt
            const minStars = parseFloat(document.getElementById("scoutOvrSelect")?.value || "3.5");
            const engine = this.getRatingEngine();
            const minOvr = engine ? engine.overallForStars(minStars, this.starContext()) : 75;

            const res = ScoutingEngine.startAssignment(this.app.state, {
                position: pos, maxAge: maxAge, minOverall: minOvr, minStars: minStars
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
            downloadAnchor.setAttribute("download", this.app.state.getExportFileName ? this.app.state.getExportFileName() : `FM_Pro_Save_Saison_${this.app.state.seasonYear}_Spieltag_${this.app.state.currentMatchday}.json`);
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
        try {
            if (typeof localStorage !== "undefined" && localStorage.getItem("fm_sound") === "aus") this.soundEnabled = false;
        } catch (e) { /* ohne Speicher bleibt der Ton an */ }
        document.getElementById("btnToggleSound").innerHTML = this.soundKnopfHtml();
        document.getElementById("btnToggleSound").onclick = () => {
            this.soundEnabled = !this.soundEnabled;
            document.getElementById("btnToggleSound").innerHTML = this.soundKnopfHtml();
            try {
                if (typeof localStorage !== "undefined") localStorage.setItem("fm_sound", this.soundEnabled ? "an" : "aus");
            } catch (e) { /* nicht speicherbar - gilt dann nur für diese Sitzung */ }
        };
    }
}

if (typeof window !== "undefined") {
    window.UIManager = UIManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIManager };
    // Die ausgelagerten Teile hängen sich an die Klasse - im Browser lädt sie
    // index.html der Reihe nach, unter Node holen wir sie hier dazu
    ["./uiSpielfeld.js", "./uiVorbereitung.js", "./uiTransfers.js", "./uiAkten.js", "./uiLivespiel.js", "./uiSpielbericht.js", "./uiSpeicher.js", "./uiEinstieg.js", "./uiNational.js"]
        .forEach(teil => require(teil));
}
