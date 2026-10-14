/**
 * Assistent: Startbildschirm, neue Karriere, Liga- und Vereinswahl.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Startbildschirm anzeigen & Savegame-Info rendern
     */
    showStartScreen() {
        const overlay = document.getElementById("startScreenOverlay");
        if (overlay) overlay.style.display = "flex";
        this.renderStartScreenSaveInfo();
    },

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
    },

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

        // Eine Namensdatei schon vor der ersten Karriere
        document.getElementById("startNamenInput")?.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) this.ladeNamensdatei(file);
            e.target.value = "";
        });
        this.zeigeNamensstand();

        document.getElementById("btnStartAbout")?.addEventListener("click", () => this.zeigeKurzanleitung());

        document.getElementById("btnCloseAboutModal")?.addEventListener("click", () => {
            document.getElementById("modalAboutGame").style.display = "none";
        });
        document.getElementById("btnDismissAbout")?.addEventListener("click", () => {
            document.getElementById("modalAboutGame").style.display = "none";
        });
    },

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
    },

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
    },

    /** Beschriftung des Weiter-Knopfs: "Weiter" oder im letzten Schritt "Karriere starten" */
    setzeWizardWeiter(btn, letzterSchritt) {
        if (!btn) return;
        btn.innerHTML = `<span>${letzterSchritt ? "Karriere starten" : "Weiter"}</span><svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg>`;
    },

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
    },

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
    },

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
    },

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
    },

    /** Bezeichnung der Spielklasse */
    wizardTierLabel(tier) {
        if (tier === "semi-pro") return "Halbprofis";
        if (tier === "amateur") return "Amateurliga";
        return "Profiliga";
    },

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
            const W = id => this.constructor.wettbewerbName(id);
            if (e.championsLeague?.length) zeilen.push([W("ucl"), plaetze(e.championsLeague), "ucl"]);
            if (e.europaLeague?.length) zeilen.push([W("uel"), plaetze(e.europaLeague), "uel"]);
            if (e.conferenceLeague?.length) zeilen.push([W("uecl"), plaetze(e.conferenceLeague), "uecl"]);
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
    },

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
    },

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
    },

    setWizardStep(step) {
        this.wizardStep = step;
        this.renderWizardStep();
    },

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
    },

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

        const filtered = this.constructor.getFilteredWizardClubs(teams, {
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
    },

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
                    <div class="cd-sterne-hinweis">${esc(this.constructor.STERN_MASSSTAEBE[this.sternMassstab()].hinweisVerein)}</div>
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
    },

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
    },

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
    },
});
