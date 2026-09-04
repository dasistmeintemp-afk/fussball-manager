/**
 * UIManager - Rendert alle Tabs, Modale, Tabellen und steuert die 2D Canvas Match Visualisierung
 */

class UIManager {
    constructor(app) {
        this.app = app;
        this.activeTab = "dashboard";
        this.selectedPitchSlot = null;
        this.currentFixtureMatchday = 1;
        this.liveMatchAnimFrame = null;
        this.soundEnabled = true;
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
    }

    /**
     * Sichere Hilfsfunktion zur Formatierung von Geldbeträgen
     */
    formatMoneySafe(amount) {
        return UIManager.formatMoneySafe(amount);
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
    }

    /**
     * Rendert die Savegame-Informationen auf dem Startbildschirm
     */
    renderStartScreenSaveInfo() {
        const summary = GameState.getSaveSummary();
        const detailsContainer = document.getElementById("startSaveDetailsContent");
        const continueBtn = document.getElementById("btnStartContinueGame");
        const continueSubText = document.getElementById("startContinueSubText");

        if (summary) {
            continueBtn.disabled = false;
            if (continueSubText) {
                continueSubText.textContent = `${summary.clubName} • Saison ${summary.seasonYear}, Spieltag ${summary.currentMatchday}`;
            }

            const dateStr = new Date(summary.lastSaved).toLocaleString("de-DE", {
                day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
            });

            const diffName = summary.difficulty === "easy" ? "Leicht" : summary.difficulty === "hard" ? "Schwer" : "Normal";

            detailsContainer.innerHTML = `
                <div class="save-card-summary">
                    <div class="save-club-badge">
                        <span class="save-club-dot" style="background-color: var(--accent-primary);"></span>
                        <div>
                            <div class="save-club-name">${summary.clubName}</div>
                            <div style="font-size:12px; color:var(--text-muted);">Manager: ${summary.managerName} (${summary.managerNationality})</div>
                        </div>
                    </div>

                    <div class="save-meta-grid">
                        <div class="save-meta-item">
                            <span class="save-meta-label">Wettbewerb</span>
                            <span class="save-meta-val">${summary.leagueName}</span>
                        </div>
                        <div class="save-meta-item">
                            <span class="save-meta-label">Fortschritt</span>
                            <span class="save-meta-val">Saison ${summary.seasonYear} (Spieltag ${summary.currentMatchday}/${summary.totalMatchdays})</span>
                        </div>
                        <div class="save-meta-item">
                            <span class="save-meta-label">Tabellenplatz</span>
                            <span class="save-meta-val">${summary.userRank}. Platz</span>
                        </div>
                        <div class="save-meta-item">
                            <span class="save-meta-label">Schwierigkeitsgrad</span>
                            <span class="save-meta-val">${diffName}</span>
                        </div>
                    </div>

                    <div class="save-timestamp">
                        🕒 Zuletzt gespeichert: <strong>${dateStr}</strong>
                    </div>

                    <div style="display:flex; gap:10px; margin-top:8px;">
                        <button class="btn btn-sm btn-primary" id="btnQuickLoadGame" style="flex:1;">▶ Spielstand fortsetzen</button>
                        <button class="btn btn-sm btn-danger" id="btnDeleteLocalSave" title="Spielstand löschen">🗑️</button>
                    </div>
                </div>
            `;

            document.getElementById("btnQuickLoadGame")?.addEventListener("click", () => {
                const loaded = GameState.loadFromLocalStorage();
                if (loaded) {
                    this.app.state = loaded;
                    this.hideStartScreen();
                    this.switchTab("dashboard");
                    this.showToast(`Spielstand geladen: ${loaded.managerName} bei ${loaded.clubs.find(c => c.id === loaded.userClubId)?.name}`, "success");
                }
            });

            document.getElementById("btnDeleteLocalSave")?.addEventListener("click", () => {
                if (confirm("Möchten Sie diesen Spielstand wirklich unwiderruflich löschen?")) {
                    GameState.deleteSavegame();
                    this.renderStartScreenSaveInfo();
                    this.showToast("Spielstand wurde gelöscht.", "info");
                }
            });
        } else {
            continueBtn.disabled = true;
            if (continueSubText) continueSubText.textContent = "Kein lokaler Spielstand gefunden";
            detailsContainer.innerHTML = `
                <div class="no-save-placeholder">
                    <span class="placeholder-icon">📂</span>
                    <p>Noch kein aktiver Spielstand im Browser gespeichert.</p>
                    <span class="placeholder-hint">Klicke auf "Neues Spiel starten", um deine Trainerkarriere zu beginnen.</span>
                </div>
            `;
        }
    }

    /**
     * Startbildschirm-Events binden
     */
    bindStartScreenEvents() {
        document.getElementById("btnStartNewGame")?.addEventListener("click", () => {
            this.showNewGameModal();
        });

        document.getElementById("btnStartContinueGame")?.addEventListener("click", () => {
            const loaded = GameState.loadFromLocalStorage();
            if (loaded) {
                this.app.state = loaded;
                this.hideStartScreen();
                this.switchTab("dashboard");
                this.showToast(`Willkommen zurück, ${loaded.managerName}!`, "success");
            }
        });

        document.getElementById("startFileInput")?.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const res = GameState.importFromJson(evt.target.result);
                if (res.success && res.state) {
                    this.app.state = res.state;
                    this.app.state.saveToLocalStorage();
                    this.hideStartScreen();
                    this.switchTab("dashboard");
                    this.showToast("Spielstand erfolgreich importiert!", "success");
                } else {
                    this.showToast(res.error || "Ungültiges Spielstand-Format!", "error");
                }
            };
            reader.readAsText(file);
        });

        document.getElementById("btnStartAbout")?.addEventListener("click", () => {
            document.getElementById("modalAboutGame").style.display = "flex";
        });

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

        modal.style.display = "flex";
        this.wizardStep = 1;
        this.wizardSelectedClubId = null;
        this.resetWizardClubFilters();
        this.renderWizardStep();
    }

    /**
     * Setzt die Filter der Vereinsauswahl im Assistenten zurück
     */
    resetWizardClubFilters() {
        const searchInput = document.getElementById("filterClubSearch");
        const sortSelect = document.getElementById("filterClubSort");
        const difficultySelect = document.getElementById("filterClubDifficulty");

        if (searchInput) searchInput.value = "";
        if (sortSelect) sortSelect.value = "strength_desc";
        if (difficultySelect) difficultySelect.value = "all";
    }

    /**
     * Reines Filtern und Sortieren von Vereinen für die Wizard-Auswahl
     */
    static getFilteredWizardClubs(teams, { search = "", difficulty = "all", sort = "strength_desc" } = {}) {
        if (!Array.isArray(teams)) return [];
        let filtered = [...teams];

        const searchVal = (search || "").toLowerCase().trim();
        if (searchVal) {
            filtered = filtered.filter(club => {
                const name = (club.name || "").toLowerCase();
                const city = (club.city || "").toLowerCase();
                const stadium = (club.stadium || "").toLowerCase();
                return name.includes(searchVal) || city.includes(searchVal) || stadium.includes(searchVal);
            });
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
        filtered.sort((a, b) => {
            const playersA = Array.isArray(a.players) ? a.players : [];
            const playersB = Array.isArray(b.players) ? b.players : [];

            const ovrA = playersA.length
                ? Math.round(playersA.reduce((sum, p) => sum + (p.overall || 0), 0) / playersA.length)
                : 0;

            const ovrB = playersB.length
                ? Math.round(playersB.reduce((sum, p) => sum + (p.overall || 0), 0) / playersB.length)
                : 0;

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
        // Step indicator nodes
        document.querySelectorAll(".wizard-step-node").forEach(node => {
            const nodeStep = parseInt(node.dataset.step, 10);
            node.classList.toggle("active", nodeStep === this.wizardStep);
        });

        // Step contents
        const s1 = document.getElementById("wizardStep1");
        const s2 = document.getElementById("wizardStep2");
        const s3 = document.getElementById("wizardStep3");
        if (s1) s1.style.display = this.wizardStep === 1 ? "block" : "none";
        if (s2) s2.style.display = this.wizardStep === 2 ? "block" : "none";
        if (s3) s3.style.display = this.wizardStep === 3 ? "block" : "none";

        const backBtn = document.getElementById("btnWizardBack");
        const nextBtn = document.getElementById("btnWizardNext");

        if (backBtn) backBtn.style.display = this.wizardStep > 1 ? "block" : "none";

        if (this.wizardStep === 3) {
            if (nextBtn) {
                nextBtn.textContent = "Karriere starten ▶";
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
                            <span>👈 Bitte wählen Sie links einen Verein aus, um detaillierte Kaderanalysen, Finanzen und Vorstandserwartungen einzusehen.</span>
                        </div>
                    `;
                }
            }
        } else {
            if (nextBtn) {
                nextBtn.textContent = "Weiter ▶";
                nextBtn.disabled = false;
            }
        }
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

        const teams = Array.isArray(window.INITIAL_TEAMS_DATA)
            ? window.INITIAL_TEAMS_DATA
            : (typeof INITIAL_TEAMS_DATA !== "undefined" && Array.isArray(INITIAL_TEAMS_DATA) ? INITIAL_TEAMS_DATA : []);

        console.log("[Wizard] INITIAL_TEAMS_DATA Status:", {
            windowType: typeof window !== "undefined" ? typeof window.INITIAL_TEAMS_DATA : "no-window",
            isArray: Array.isArray(teams),
            length: teams.length
        });

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

        const searchVal = (searchInput?.value || "").toLowerCase().trim();
        const sortVal = sortSelect?.value || "strength_desc";
        const diffVal = difficultySelect?.value || "all";

        const filtered = UIManager.getFilteredWizardClubs(teams, {
            search: searchVal,
            difficulty: diffVal,
            sort: sortVal
        });

        console.log("[Wizard] Vereinsfilter Ergebnis:", {
            totalTeams: teams.length,
            filteredTeams: filtered.length,
            searchVal,
            sortVal,
            diffVal
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

        listContainer.innerHTML = filtered.map(club => {
            const players = Array.isArray(club.players) ? club.players : [];
            const ovr = players.length
                ? Math.round(players.reduce((sum, p) => sum + (p.overall || 0), 0) / players.length)
                : 0;

            const isSelected = this.wizardSelectedClubId === club.id;

            return `
                <div class="club-list-item ${isSelected ? "selected" : ""}" data-club-id="${club.id}">
                    <div class="club-item-left">
                        <div class="club-color-badge" style="background: ${club.primaryColor || "#334155"}; border: 1px solid ${club.secondaryColor || "#fff"};"></div>
                        <div>
                            <div class="club-item-title">${club.name || "Unbekannter Verein"}</div>
                            <div class="club-item-sub">${club.city || "Unbekannte Stadt"} • ${club.stadium || "Unbekanntes Stadion"}</div>
                        </div>
                    </div>
                    <div class="club-item-right">
                        <span class="club-item-ovr">${ovr}</span>
                        <span style="font-size:11px; color:#34d399;">${this.formatMoneySafe(club.transferBudget || 0)}</span>
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

                const nextBtn = document.getElementById("btnWizardNext");
                if (nextBtn) {
                    nextBtn.disabled = false;
                    nextBtn.textContent = "Karriere starten ▶";
                }

                this.playSound("click");
            });
        });
    }

    /**
     * Detaillierte Vereins- und Kaderanalyse für die Vereinsauswahl
     */
    renderWizardClubDetails(clubId) {
        const panel = document.getElementById("clubDetailPanel");
        if (!panel) return;

        const teams = Array.isArray(window.INITIAL_TEAMS_DATA)
            ? window.INITIAL_TEAMS_DATA
            : (typeof INITIAL_TEAMS_DATA !== "undefined" && Array.isArray(INITIAL_TEAMS_DATA) ? INITIAL_TEAMS_DATA : []);
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
        const avgOvr = players.length ? Math.round(players.reduce((sum, p) => sum + (p.overall || 0), 0) / players.length) : 0;
        const avgAge = players.length ? (players.reduce((sum, p) => sum + (p.age || 0), 0) / players.length).toFixed(1) : "0";
        const totalValue = players.reduce((sum, p) => sum + (p.value || 0), 0);

        // Top Spieler & Talente
        const sortedPlayers = [...players].sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const topPlayers = sortedPlayers.slice(0, 3);
        const topTalents = [...players].filter(p => (p.age || 99) <= 22).sort((a, b) => (b.pot || 0) - (a.pot || 0)).slice(0, 2);

        panel.innerHTML = `
            <div class="club-detail-container">
                <div class="cd-header">
                    <div class="cd-title-wrap">
                        <span class="cd-badge" style="background: ${club.primaryColor || '#334155'}; border: 1px solid ${club.secondaryColor || '#fff'};"></span>
                        <div>
                            <div class="cd-name">${club.name}</div>
                            <div class="cd-city">📍 ${club.city || ''} • 🏟️ ${club.stadium || ''} (${(club.capacity || 0).toLocaleString('de-DE')} Plätze)</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span class="ovr-badge ovr-high" style="font-size:16px;">${avgOvr} OVR</span>
                    </div>
                </div>

                <div class="cd-grid-meta">
                    <div class="cd-box">
                        <div class="cd-box-title">Transferbudget</div>
                        <div class="cd-box-val" style="color:#34d399;">${this.formatMoneySafe(club.transferBudget || 0)}</div>
                    </div>
                    <div class="cd-box">
                        <div class="cd-box-title">Gehaltsbudget / Woche</div>
                        <div class="cd-box-val">${this.formatMoneySafe(club.wageBudget || 0)}</div>
                    </div>
                    <div class="cd-box">
                        <div class="cd-box-title">Kadergesamtwert</div>
                        <div class="cd-box-val">${this.formatMoneySafe(totalValue)}</div>
                    </div>
                    <div class="cd-box">
                        <div class="cd-box-title">Durchschnittsalter</div>
                        <div class="cd-box-val">${avgAge} Jahre</div>
                    </div>
                </div>

                <div class="cd-box" style="border-left: 4px solid var(--accent-gold);">
                    <div class="cd-box-title">🎯 Vorstandsziel für Saison 1:</div>
                    <div style="font-size:15px; font-weight:700; color:#f59e0b; margin-top:2px;">
                        ${this.getExpectationTextSafe(club.boardExpectation)}
                    </div>
                </div>

                <div>
                    <div class="cd-section-title">⭐ Schlüssel- & Top-Spieler</div>
                    <div class="cd-player-list">
                        ${topPlayers.map(p => `
                            <div class="cd-player-row">
                                <div><strong>${p.name}</strong> <span class="text-muted">(${p.pos})</span></div>
                                <div><span class="cd-tag">⭐ ${p.overall} OVR</span> <span class="text-muted">${this.formatMoneySafe(p.value)}</span></div>
                            </div>
                        `).join("")}
                    </div>
                </div>

                ${topTalents.length > 0 ? `
                    <div>
                        <div class="cd-section-title">🚀 Top-Talente im Kader</div>
                        <div class="cd-player-list">
                            ${topTalents.map(p => `
                                <div class="cd-player-row">
                                    <div><strong>${p.name}</strong> <span class="text-muted">(${p.pos}, ${p.age} J.)</span></div>
                                    <div><span class="cd-tag" style="background:rgba(16, 185, 129, 0.2); color:#34d399;">Potenzial: ${p.pot}</span></div>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                ` : ''}

                <div class="cd-action-btn-wrap">
                    <button class="btn btn-primary btn-lg" id="btnAdoptClub" style="width:100%;">
                        ✅ Diesen Verein übernehmen & Saison starten
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

            const teams = Array.isArray(window.INITIAL_TEAMS_DATA)
                ? window.INITIAL_TEAMS_DATA
                : (typeof INITIAL_TEAMS_DATA !== "undefined" && Array.isArray(INITIAL_TEAMS_DATA) ? INITIAL_TEAMS_DATA : []);

            const selectedClub = teams.find(c => c.id === this.wizardSelectedClubId);
            if (!selectedClub) {
                this.showToast("Der ausgewählte Verein wurde nicht gefunden.", "error");
                return;
            }

            const managerName = document.getElementById("inputManagerName")?.value.trim() || "Trainer Schmidt";
            const managerNationality = document.getElementById("inputManagerNationality")?.value || "Deutschland";
            const managerBirthdate = document.getElementById("inputManagerBirthdate")?.value || "1985-05-15";
            const difficulty = document.getElementById("selectDifficulty")?.value || "normal";

            const result = this.app.startNewGame(this.wizardSelectedClubId, difficulty, {
                name: managerName,
                nationality: managerNationality,
                birthdate: managerBirthdate
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
            this.showToast(`Karriere erfolgreich gestartet! Viel Erfolg bei ${clubName}!`, "success");
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
     * Passt die Canvas-Auflösung an Containergröße und Pixeldichte an.
     * Ohne diese Skalierung wird das Spielfeld auf HiDPI-Displays unscharf
     * gestreckt und wirkt beim Scrollen ruckelig.
     */
    resizeLiveCanvas() {
        const canvas = document.getElementById("livePitchCanvas");
        const wrapper = canvas?.parentElement;
        if (!canvas || !wrapper) return false;

        const PITCH_RATIO = 105 / 68; // Länge zu Breite eines echten Spielfeldes
        const available = wrapper.clientWidth - 8;
        if (available <= 0) return false;

        const maxHeight = Math.max(220, wrapper.clientHeight - 74);
        let cssWidth = Math.min(available, 1100);
        let cssHeight = cssWidth / PITCH_RATIO;

        if (cssHeight > maxHeight) {
            cssHeight = maxHeight;
            cssWidth = cssHeight * PITCH_RATIO;
        }

        const dpr = Math.min(2.5, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
        const pixelWidth = Math.round(cssWidth * dpr);
        const pixelHeight = Math.round(cssHeight * dpr);

        const changed = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
        if (changed) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
            this.pitchBackdrop = null; // Rasen muss neu gezeichnet werden
        }

        canvas.style.width = `${Math.round(cssWidth)}px`;
        canvas.style.height = `${Math.round(cssHeight)}px`;

        return changed;
    }

    /**
     * Zeichnet Rasen, Linien und Tore einmalig in ein Offscreen-Canvas.
     * Pro Frame wird nur noch dieses Bild kopiert - das spart bei 60 fps
     * hunderte Zeichenbefehle und beseitigt das Ruckeln.
     */
    buildPitchBackdrop(width, height) {
        const canvas = (typeof document !== "undefined") ? document.createElement("canvas") : null;
        if (!canvas) return null;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        const margin = Math.round(Math.min(width, height) * 0.035);
        const pitchX = margin;
        const pitchY = margin;
        const pitchW = width - margin * 2;
        const pitchH = height - margin * 2;
        const midX = pitchX + pitchW / 2;
        const midY = pitchY + pitchH / 2;
        const unit = pitchW / 105; // ein Meter in Pixeln

        // Rasen mit Mähstreifen
        ctx.fillStyle = "#0b4227";
        ctx.fillRect(0, 0, width, height);

        const stripes = 14;
        const stripeW = pitchW / stripes;
        for (let i = 0; i < stripes; i++) {
            ctx.fillStyle = (i % 2 === 0) ? "#15803d" : "#137236";
            ctx.fillRect(pitchX + i * stripeW, pitchY, stripeW + 1, pitchH);
        }

        // Flutlicht-Stimmung
        const glow = ctx.createRadialGradient(midX, midY, pitchH * 0.1, midX, midY, pitchW * 0.7);
        glow.addColorStop(0, "rgba(255, 255, 255, 0.07)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0.28)");
        ctx.fillStyle = glow;
        ctx.fillRect(pitchX, pitchY, pitchW, pitchH);

        // Linien
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = Math.max(1.5, unit * 0.14);

        ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);
        ctx.beginPath();
        ctx.moveTo(midX, pitchY);
        ctx.lineTo(midX, pitchY + pitchH);
        ctx.stroke();

        const centreRadius = unit * 9.15;
        ctx.beginPath();
        ctx.arc(midX, midY, centreRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(midX, midY, Math.max(2, unit * 0.3), 0, Math.PI * 2);
        ctx.fill();

        // Strafraum (16,5 m x 40,3 m) und Torraum (5,5 m x 18,3 m)
        const penW = unit * 16.5;
        const penH = (pitchH / 68) * 40.3;
        const goalAreaW = unit * 5.5;
        const goalAreaH = (pitchH / 68) * 18.3;
        const penSpot = unit * 11;

        [0, 1].forEach(side => {
            const isLeft = side === 0;
            const boxX = isLeft ? pitchX : pitchX + pitchW - penW;
            ctx.strokeRect(boxX, midY - penH / 2, penW, penH);

            const gaX = isLeft ? pitchX : pitchX + pitchW - goalAreaW;
            ctx.strokeRect(gaX, midY - goalAreaH / 2, goalAreaW, goalAreaH);

            const spotX = isLeft ? pitchX + penSpot : pitchX + pitchW - penSpot;
            ctx.beginPath();
            ctx.arc(spotX, midY, Math.max(1.8, unit * 0.28), 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            if (isLeft) ctx.arc(spotX, midY, centreRadius, -0.93, 0.93);
            else ctx.arc(spotX, midY, centreRadius, Math.PI - 0.93, Math.PI + 0.93);
            ctx.stroke();
        });

        // Eckviertelkreise
        const cornerR = unit * 1;
        ctx.beginPath(); ctx.arc(pitchX, pitchY, cornerR, 0, Math.PI / 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(pitchX, pitchY + pitchH, cornerR, -Math.PI / 2, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(pitchX + pitchW, pitchY, cornerR, Math.PI / 2, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(pitchX + pitchW, pitchY + pitchH, cornerR, Math.PI, Math.PI * 1.5); ctx.stroke();

        // Tore inklusive angedeutetem Netz
        const goalH = (pitchH / 68) * 7.32;
        const goalDepth = unit * 2;
        ctx.lineWidth = Math.max(2, unit * 0.2);
        [0, 1].forEach(side => {
            const gx = side === 0 ? pitchX - goalDepth : pitchX + pitchW;
            ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
            ctx.fillRect(gx, midY - goalH / 2, goalDepth, goalH);
            ctx.strokeStyle = "#ffffff";
            ctx.strokeRect(gx, midY - goalH / 2, goalDepth, goalH);

            ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
            ctx.lineWidth = 1;
            for (let n = 1; n < 4; n++) {
                const ny = midY - goalH / 2 + (goalH / 4) * n;
                ctx.beginPath();
                ctx.moveTo(gx, ny);
                ctx.lineTo(gx + goalDepth, ny);
                ctx.stroke();
            }
            ctx.lineWidth = Math.max(2, unit * 0.2);
        });

        return { canvas, pitchX, pitchY, pitchW, pitchH, midX, midY, unit };
    }

    /**
     * Textbreiten werden gecacht - measureText pro Spieler und Frame
     * ist einer der teuersten Aufrufe im Canvas-Rendering.
     */
    measureCached(ctx, text, font) {
        const key = `${font}|${text}`;
        let width = this.textWidthCache.get(key);
        if (width === undefined) {
            ctx.font = font;
            width = ctx.measureText(text).width;
            this.textWidthCache.set(key, width);
            if (this.textWidthCache.size > 400) this.textWidthCache.clear();
        }
        return width;
    }

    /**
     * Tab wechseln
     */
    switchTab(tabId) {
        this.activeTab = tabId;
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
        }
    }

    /**
     * Header & Sidebar Quick-Status rendern
     */
    renderHeader() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        document.getElementById("headerClubName").textContent = userClub.name;
        document.getElementById("headerClubDot").style.backgroundColor = userClub.primaryColor;
        document.getElementById("headerDifficulty").textContent = state.difficulty === "easy" ? "Leicht" : state.difficulty === "hard" ? "Schwer" : "Normal";
        document.getElementById("headerSeason").textContent = state.seasonYear;
        document.getElementById("headerMatchday").textContent = `${state.currentMatchday} / ${state.totalMatchdays}`;
        document.getElementById("headerBalance").textContent = GameState.formatMoney(userClub.balance);
        document.getElementById("headerTransferBudget").textContent = `TB: ${GameState.formatMoney(userClub.transferBudget)}`;

        document.getElementById("headerConfidenceBar").style.width = `${state.boardConfidence}%`;
        document.getElementById("headerConfidenceVal").textContent = `${state.boardConfidence}%`;

        // Advance Button Beschriftung
        const round = state.schedule.find(r => r.matchday === state.currentMatchday);
        const userMatch = round?.matches.find(m => m.homeClubId === userClub.id || m.awayClubId === userClub.id);
        const isMatchPlayed = userMatch ? userMatch.played : false;

        document.getElementById("btnHeaderAdvance").innerHTML = isMatchPlayed
            ? `<span>Nächster Spieltag</span> <span class="btn-arrow">➔</span>`
            : `<span>Spieltag starten</span> <span class="btn-arrow">➔</span>`;

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
        formContainer.innerHTML = (userClub.form || []).map(f => `<span class="form-dot ${f.toLowerCase()}">${f}</span>`).join("");

        // Badges
        const unreadCount = state.inbox.filter(m => !m.read).length;
        const navInboxBadge = document.getElementById("navInboxBadge");
        if (unreadCount > 0) {
            navInboxBadge.style.display = "inline-block";
            navInboxBadge.textContent = unreadCount;
        } else {
            navInboxBadge.style.display = "none";
        }

        const pendingOffers = state.transferMarket.offers.filter(o => o.status === "pending").length;
        const navOffersBadge = document.getElementById("navOffersBadge");
        if (pendingOffers > 0) {
            navOffersBadge.style.display = "inline-block";
            navOffersBadge.textContent = pendingOffers;
        } else {
            navOffersBadge.style.display = "none";
        }
    }

    /**
     * Dashboard rendern
     */
    renderDashboard() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        // 1. Next Match Preview
        const round = state.schedule.find(r => r.matchday === state.currentMatchday);
        const userMatch = round?.matches.find(m => m.homeClubId === userClub.id || m.awayClubId === userClub.id);

        document.getElementById("dashMatchdayTag").textContent = `Spieltag ${state.currentMatchday}`;

        if (userMatch) {
            const homeClub = state.clubs.find(c => c.id === userMatch.homeClubId);
            const awayClub = state.clubs.find(c => c.id === userMatch.awayClubId);

            const getRank = (cid) => {
                if (typeof SeasonEngine !== 'undefined' && typeof SeasonEngine.getClubRank === 'function') {
                    return SeasonEngine.getClubRank(state, cid);
                }
                if (state.standings && Array.isArray(state.standings)) {
                    const idx = state.standings.findIndex(s => s.clubId === cid);
                    return idx !== -1 ? idx + 1 : "-";
                }
                return "-";
            };

            document.getElementById("dashHomeName").textContent = homeClub.name;
            document.getElementById("dashAwayName").textContent = awayClub.name;
            document.getElementById("dashHomeRank").textContent = getRank(homeClub.id);
            document.getElementById("dashAwayRank").textContent = getRank(awayClub.id);
            document.getElementById("dashVenue").textContent = homeClub.stadium;

            const homeCrest = document.getElementById("dashHomeCrest");
            homeCrest.style.backgroundColor = homeClub.primaryColor;
            homeCrest.textContent = homeClub.name.substring(0, 3).toUpperCase();

            const awayCrest = document.getElementById("dashAwayCrest");
            awayCrest.style.backgroundColor = awayClub.primaryColor;
            awayCrest.textContent = awayClub.name.substring(0, 3).toUpperCase();

            // Action Buttons anzeigen / deaktivieren falls schon gespielt
            const btnLive = document.getElementById("btnDashLiveMatch");
            const btnInstant = document.getElementById("btnDashInstantSim");

            if (userMatch.played) {
                btnLive.disabled = true;
                btnLive.textContent = `Beendet (${userMatch.homeGoals}:${userMatch.awayGoals})`;
                btnInstant.disabled = true;
            } else {
                btnLive.disabled = false;
                btnLive.textContent = `▶ 2D-Live-Spiel starten`;
                btnInstant.disabled = false;
            }
        }

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
                    let typeIcon = "📅";
                    if (day.type === "training") typeIcon = "🏋️";
                    if (day.type === "recovery") typeIcon = "🧘";
                    if (day.type === "media") typeIcon = "🎙️";
                    if (day.type === "sponsor") typeIcon = "🤝";
                    if (day.type === "tactics") typeIcon = "📋";
                    if (day.type === "opponent_analysis") typeIcon = "🔍";
                    if (day.type === "matchday") typeIcon = "⚽";
                    if (day.type === "season_start") typeIcon = "⭐";

                    return `
                        <div class="calendar-timeline-item ${isToday ? 'current-day' : ''}">
                            <div class="cal-day-date">
                                <strong>${day.dayOfWeek}</strong>
                                <span>${day.date.substring(0, 5)}</span>
                            </div>
                            <div class="cal-day-info">
                                <div class="cal-day-title">${typeIcon} ${day.title}</div>
                                <div class="cal-day-desc">${day.description}</div>
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
        const top5 = state.standings.slice(0, 5);
        const userStanding = state.standings.find(s => s.clubId === userClub.id);
        const displayed = [...top5];

        if (userStanding && !top5.some(s => s.clubId === userClub.id)) {
            displayed.push(userStanding);
        }

        standingsBody.innerHTML = displayed.map(s => {
            const isUser = s.clubId === userClub.id;
            const rank = state.standings.indexOf(s) + 1;
            return `
                <tr class="${isUser ? 'row-user-club' : ''}">
                    <td><strong>${rank}</strong></td>
                    <td>${s.clubName}</td>
                    <td>${s.played}</td>
                    <td>${s.goalDiff > 0 ? '+' + s.goalDiff : s.goalDiff}</td>
                    <td><strong>${s.points}</strong></td>
                </tr>
            `;
        }).join("");

        // 3. Board Confidence, Fan Mood & Media Pressure (D4)
        document.getElementById("dashBoardGoal").textContent = GameState.getExpectationText(userClub.boardExpectation);
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
                            <span>🏥 <strong>${p.name}</strong> (${p.pos})</span>
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
            newsList.innerHTML = recentInbox.map(item => `
                <div class="news-item-dash">
                    <div>
                        <h5>${item.subject}</h5>
                        <p>${item.body.substring(0, 95)}...</p>
                    </div>
                    <span class="news-date">${item.date}</span>
                </div>
            `).join("");
        }
    }

    /**
     * Kader rendern mit Filter
     */
    renderSquad(posFilter = "all") {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

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

            const card = ratingEngine ? ratingEngine.calculateVisiblePlayerCard(p, { userClubId: userClub.id, leagueDataCoverage: 95 }) : null;
            const starsCa = card ? card.starsCaHtml : "★★★☆☆";
            const starsPa = card ? card.starsPaHtml : "★★★★☆";
            const roleName = card?.bestRole?.role || p.squadRole || "Stammspieler";
            const abilityText = card?.abilityLabel || "Guter Spieler";
            const valText = card ? card.visibleValueText : this.formatMoneySafe(p.value);

            return `
                <tr>
                    <td>${statusBadge}</td>
                    <td><strong>${p.name}</strong> <span style="font-size:11px; color:var(--text-muted);">(${p.squadRole || 'Kader'})</span></td>
                    <td><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span></td>
                    <td>${p.age}</td>
                    <td>
                        <span title="${abilityText} (${p.overall} OVR)" style="color:#f59e0b; font-size:13px; font-weight:600;">${starsCa}</span>
                        <div style="font-size:10px; color:var(--text-muted);">${abilityText}</div>
                    </td>
                    <td><span title="Entwicklungspotenzial" style="color:#38bdf8; font-size:12px;">${starsPa}</span></td>
                    <td><span class="role-chip" title="${roleName}">${roleName}</span></td>
                    <td>
                        <span class="mini-bar"><span class="mini-bar-fill" style="width:${p.fitness}%"></span></span>
                        ${p.fitness}%
                    </td>
                    <td>${happyIcon} ${happyOverall}%</td>
                    <td>${p.form.toFixed(1)}</td>
                    <td>${valText}</td>
                    <td>${this.formatMoneySafe(p.wage)}</td>
                    <td>${p.contractYears} J.</td>
                    <td>
                        <button class="btn btn-sm btn-secondary btn-player-details" data-player-id="${p.id}">Details</button>
                    </td>
                </tr>
            `;
        }).join("");

        // Event Listeners für Details
        document.querySelectorAll(".btn-player-details").forEach(btn => {
            btn.addEventListener("click", () => {
                const pId = parseInt(btn.dataset.playerId, 10);
                this.showPlayerDetailsModal(pId);
            });
        });
    }

    getPosGroup(pos) {
        if (pos === "TW") return "tw";
        if (["IV", "LV", "RV"].includes(pos)) return "def";
        if (["DM", "ZM", "OM", "LM", "RM"].includes(pos)) return "mid";
        return "att";
    }

    /**
     * Aufstellung & Taktik rendern
     */
    renderTactics() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        // Formation Dropdown
        const selectFormation = document.getElementById("selectFormation");
        selectFormation.value = userClub.formation || "4-4-2";

        // Taktik Einstellungen
        document.getElementById("tacMentality").value = userClub.tactics?.mentality || "balanced";
        document.getElementById("tacPressing").value = userClub.tactics?.pressing || "medium";
        document.getElementById("tacTempo").value = userClub.tactics?.tempo || "normal";
        document.getElementById("tacPassing").value = userClub.tactics?.passing || "mixed";
        document.getElementById("tacFocus").value = userClub.tactics?.focus || "balanced";

        // 2D Pitch Slots rendern
        const pitchLayer = document.getElementById("pitchPlayersLayer");
        pitchLayer.innerHTML = "";

        const formConfigs = (typeof FORMATION_CONFIGS !== 'undefined' && FORMATION_CONFIGS) 
            ? FORMATION_CONFIGS 
            : ((typeof window !== 'undefined' && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS : (typeof require !== 'undefined' ? require('../engine/gameState.js').FORMATION_CONFIGS : {}));
        const formConfig = (formConfigs && formConfigs[userClub.formation]) || (formConfigs && formConfigs["4-4-2"]) || { name: "4-4-2 Standard", positions: [] };
        const slots = formConfig.positions;

        slots.forEach((slot, index) => {
            const playerId = userClub.lineup[index];
            const player = state.players.find(p => p.id === playerId);

            const node = document.createElement("div");
            node.className = `pitch-node ${this.selectedPitchSlot === index ? 'selected' : ''}`;
            node.style.left = `${slot.x}%`;
            node.style.top = `${slot.y}%`;
            node.dataset.slotIndex = index;

            const isSelected = this.selectedPitchSlot === index;

            node.innerHTML = `
                <div class="pitch-node-shirt" style="background: ${userClub.primaryColor}; color: ${userClub.secondaryColor}; ${isSelected ? 'border-color: #f59e0b; box-shadow: 0 0 12px #f59e0b;' : ''}">
                    ${player ? player.overall : '?'}
                </div>
                <div class="pitch-node-name">
                    ${player ? player.name.split(' ').pop() : 'Leer'} (${slot.pos})
                </div>
            `;

            node.addEventListener("click", () => {
                this.handlePitchSlotClick(index);
            });

            pitchLayer.appendChild(node);
        });

        // Ersatzbank rendern
        const benchContainer = document.getElementById("benchSlots");
        benchContainer.innerHTML = "";

        const squadPlayers = state.players.filter(p => userClub.playerIds.includes(p.id));
        const benchPlayers = userClub.bench.map(id => squadPlayers.find(p => p.id === id)).filter(Boolean);
        const reservePlayers = squadPlayers.filter(p => !userClub.lineup.includes(p.id) && !userClub.bench.includes(p.id));

        [...benchPlayers, ...reservePlayers].forEach(p => {
            const isBench = userClub.bench.includes(p.id);
            const isInj = p.injuredWeeks > 0;
            const isSusp = p.suspendedMatches > 0;

            const benchEl = document.createElement("div");
            benchEl.className = "bench-node";
            benchEl.innerHTML = `
                <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span>
                <strong>${p.name}</strong> (${p.overall})
                ${isInj ? '🚑' : isSusp ? '🟥' : isBench ? '<span style="color:#34d399">Bank</span>' : '<span style="color:#94a3b8">Res</span>'}
            `;

            benchEl.addEventListener("click", () => {
                this.handleBenchPlayerClick(p.id);
            });

            benchContainer.appendChild(benchEl);
        });

        // Rollen Dropdowns befüllen
        const lineupPlayers = userClub.lineup.map(id => state.players.find(p => p.id === id)).filter(Boolean);
        const populateRoleSelect = (elId, currentId) => {
            const el = document.getElementById(elId);
            el.innerHTML = lineupPlayers.map(p => `
                <option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name} (${p.pos}, OVR ${p.overall})</option>
            `).join("");
        };

        populateRoleSelect("roleCaptain", userClub.roles.captain);
        populateRoleSelect("rolePenalty", userClub.roles.penaltyTaker);
        populateRoleSelect("roleFreeKick", userClub.roles.freeKickTaker);
        populateRoleSelect("roleCorner", userClub.roles.cornerTaker);
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
    renderFixturesAndStandings() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const activeComp = this.activeCompetitionId || "de_liga_1";

        const compSelect = document.getElementById("selectCompetitionView");
        if (compSelect) compSelect.value = activeComp;

        const tbody = document.getElementById("fullStandingsBody");
        const fixturesList = document.getElementById("fixturesList");

        if (activeComp === "de_cup") {
            // Pokal-Runde rendern
            const cup = state.cups?.de_cup;
            if (cup) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" style="text-align:center; padding:16px; font-weight:700; color:#f59e0b;">
                            🏆 Deutschland Pokal - Aktuelle Runde: ${cup.roundName || "Runde 1"}
                        </td>
                    </tr>
                ` + cup.matches.map((m, idx) => {
                    const home = state.clubs.find(c => c.id === m.homeClubId);
                    const away = state.clubs.find(c => c.id === m.awayClubId);
                    const score = m.played ? `${m.homeGoals} : ${m.awayGoals}` : "noch nicht gespielt";
                    const isUser = home?.id === userClub?.id || away?.id === userClub?.id;
                    return `
                        <tr class="${isUser ? 'row-user-club' : ''}">
                            <td><strong>${idx + 1}</strong></td>
                            <td colspan="5"><strong>${home?.name || 'Heim'}</strong> vs <strong>${away?.name || 'Auswärts'}</strong></td>
                            <td colspan="4"><span class="badge ${m.played ? 'badge-status-fit' : ''}">${score}</span></td>
                        </tr>
                    `;
                }).join("");

                document.getElementById("fixtureMatchdayTitle").textContent = `Pokal: ${cup.roundName || "Runde 1"}`;
                fixturesList.innerHTML = cup.matches.map(m => {
                    const home = state.clubs.find(c => c.id === m.homeClubId);
                    const away = state.clubs.find(c => c.id === m.awayClubId);
                    const isUserMatch = home?.id === userClub?.id || away?.id === userClub?.id;
                    const scoreText = m.played ? `${m.homeGoals} : ${m.awayGoals}` : "vs";

                    return `
                        <div class="fixture-card ${isUserMatch ? 'user-match' : ''}">
                            <div class="fixture-team home">${home?.name || 'Heim'}</div>
                            <div class="fixture-score-badge">${scoreText}</div>
                            <div class="fixture-team away">${away?.name || 'Auswärts'}</div>
                        </div>
                    `;
                }).join("");
            }
            return;
        }

        if (["ucl", "uel", "uecl"].includes(activeComp)) {
            // Europapokal Gruppen rendern
            const euroComp = state.europeanCompetitions?.[activeComp];
            if (euroComp && euroComp.groups) {
                let html = "";
                euroComp.groups.forEach(g => {
                    html += `
                        <tr style="background: rgba(56, 189, 248, 0.15);">
                            <td colspan="10" style="font-weight:700; color:#38bdf8;">${euroComp.name} - ${g.groupName}</td>
                        </tr>
                    `;
                    g.standings.forEach((s, idx) => {
                        const club = state.clubs.find(c => c.id === s.clubId);
                        const isUser = s.clubId === userClub?.id;
                        html += `
                            <tr class="${isUser ? 'row-user-club' : ''}">
                                <td><strong>${idx + 1}</strong></td>
                                <td><strong>${club?.name || s.clubId}</strong></td>
                                <td>${s.played}</td>
                                <td>${s.won}</td>
                                <td>${s.drawn}</td>
                                <td>${s.lost}</td>
                                <td>${s.goalsFor}:${s.goalsAgainst}</td>
                                <td>${s.goalsFor - s.goalsAgainst}</td>
                                <td><strong>${s.points}</strong></td>
                                <td><span class="badge ${idx < 2 ? 'badge-status-fit' : ''}">${idx < 2 ? 'Qualifiziert' : 'Gruppe'}</span></td>
                            </tr>
                        `;
                    });
                });
                tbody.innerHTML = html;
                document.getElementById("fixtureMatchdayTitle").textContent = `${euroComp.name} - Gruppenphase`;
                fixturesList.innerHTML = `<div class="text-muted text-center" style="padding:20px;">Europapokal-Spiele finden an den internationalen Spieltagen im Kalender statt.</div>`;
            }
            return;
        }

        // 1. Standard-Liga Tabelle rendern
        tbody.innerHTML = state.standings.map((s, idx) => {
            const isUser = s.clubId === userClub.id;
            return `
                <tr class="${isUser ? 'row-user-club' : ''}">
                    <td><strong>${idx + 1}</strong></td>
                    <td><strong>${s.clubName}</strong></td>
                    <td>${s.played}</td>
                    <td>${s.won}</td>
                    <td>${s.drawn}</td>
                    <td>${s.lost}</td>
                    <td>${s.goalsFor}:${s.goalsAgainst}</td>
                    <td>${s.goalDiff > 0 ? '+' + s.goalDiff : s.goalDiff}</td>
                    <td><strong>${s.points}</strong></td>
                    <td>
                        <div class="form-indicators">
                            ${s.form.map(f => `<span class="form-dot ${f.toLowerCase()}">${f}</span>`).join("")}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        // 2. Spielplan rendern
        document.getElementById("fixtureMatchdayTitle").textContent = `Spieltag ${this.currentFixtureMatchday} von ${state.totalMatchdays}`;
        const round = state.schedule.find(r => r.matchday === this.currentFixtureMatchday);

        if (round) {
            fixturesList.innerHTML = round.matches.map(m => {
                const home = state.clubs.find(c => c.id === m.homeClubId);
                const away = state.clubs.find(c => c.id === m.awayClubId);
                const isUserMatch = home.id === userClub.id || away.id === userClub.id;
                const scoreText = m.played ? `${m.homeGoals} : ${m.awayGoals}` : "vs";

                return `
                    <div class="fixture-card ${isUserMatch ? 'user-match' : ''}">
                        <div class="fixture-team home">${home.name}</div>
                        <div class="fixture-score-badge">${scoreText}</div>
                        <div class="fixture-team away">${away.name}</div>
                    </div>
                `;
            }).join("");
        }
    }

    /**
     * Transfers & Scouting rendern
     */
    renderTransfers() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        // 1. Eingehende KI-Angebote
        const offersContainer = document.getElementById("aiOffersContainer");
        const offersList = document.getElementById("aiOffersList");
        const pendingOffers = (state.transferMarket?.offers || []).filter(o => o.status === "pending");

        if (offersContainer && offersList) {
            if (pendingOffers.length > 0) {
                offersContainer.style.display = "block";
                offersList.innerHTML = pendingOffers.map(o => `
                    <div class="news-item-dash">
                        <div>
                            <strong>${o.fromClubName || o.buyerClubName || 'Ein Verein'}</strong> bietet <strong>${o.feeFormatted || GameState.formatMoney(o.fee)}</strong> für <strong>${o.playerName}</strong>.
                        </div>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-sm btn-primary btn-accept-offer" data-offer-id="${o.id}">Annehmen</button>
                            <button class="btn btn-sm btn-secondary btn-reject-offer" data-offer-id="${o.id}">Ablehnen</button>
                        </div>
                    </div>
                `).join("");

                document.querySelectorAll(".btn-accept-offer").forEach(b => {
                    b.addEventListener("click", () => {
                        const oId = b.dataset.offerId;
                        const offer = state.transferMarket.offers.find(o => String(o.id) === String(oId));
                        if (offer) {
                            const buyerId = offer.fromClubId || offer.buyerClubId;
                            TransferEngine.executeTransfer(state, offer.playerId, buyerId, offer.fee, 50000, 3);
                            offer.status = "accepted";
                            this.playSound("goal");
                            this.renderTransfers();
                            this.renderHeader();
                        }
                    });
                });

                document.querySelectorAll(".btn-reject-offer").forEach(b => {
                    b.addEventListener("click", () => {
                        const oId = b.dataset.offerId;
                        const offer = state.transferMarket.offers.find(o => String(o.id) === String(oId));
                        if (offer) {
                            offer.status = "rejected";
                            this.playSound("click");
                            this.renderTransfers();
                            this.renderHeader();
                        }
                    });
                });
            } else {
                offersContainer.style.display = "none";
            }
        }

        // 2. Transfermarkt Tabelle
        const searchVal = document.getElementById("tfSearch")?.value.toLowerCase() || "";
        const posVal = document.getElementById("tfPosFilter")?.value || "all";
        const minRating = parseInt(document.getElementById("tfRatingFilter")?.value || "0", 10);

        let marketPlayers = state.players.filter(p => p.clubId !== userClub.id);

        if (searchVal) marketPlayers = marketPlayers.filter(p => p.name.toLowerCase().includes(searchVal));
        if (posVal !== "all") marketPlayers = marketPlayers.filter(p => p.pos === posVal);
        if (minRating > 0) marketPlayers = marketPlayers.filter(p => p.overall >= minRating);

        marketPlayers.sort((a, b) => b.overall - a.overall);

        const ratingEngine = (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine : ((typeof window !== 'undefined' && window.PlayerRatingEngine) ? window.PlayerRatingEngine : null);

        const tbody = document.getElementById("transferTableBody");
        if (tbody) {
            tbody.innerHTML = marketPlayers.map(p => {
                const club = state.clubs.find(c => c.id === p.clubId);
                const card = ratingEngine ? ratingEngine.calculateVisiblePlayerCard(p, { userClubId: state.userClubId, leagueDataCoverage: 85 }) : null;

                const starsDisplay = card ? card.starsCaHtml : "★★★☆☆";
                const potStarsDisplay = card ? card.starsPaHtml : "★★★★☆";
                const roleDisplay = card?.bestRole?.role || "Allrounder";
                const abilityText = card ? card.abilityLabel : "Unbekannt";
                const valDisplay = card ? card.visibleValueText : this.formatMoneySafe(p.value);
                const confPercent = card ? card.confidence : (p.scoutingKnowledge?.knowledgeLevel || 30);
                const confBadgeClass = confPercent >= 70 ? "badge-success" : confPercent >= 40 ? "badge-warning" : "badge-neutral";

                return `
                    <tr>
                        <td>
                            <strong>${p.name}</strong>
                            <div style="font-size:10px; color:var(--text-muted);">${p.nationality || 'Profi'}</div>
                        </td>
                        <td>${club ? club.name : 'Vereinslos'}</td>
                        <td><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span></td>
                        <td>${p.age}</td>
                        <td>
                            <span title="${abilityText}" style="color:#f59e0b; font-size:13px; font-weight:600;">${starsDisplay}</span>
                            <div style="font-size:10px; color:var(--text-muted);">${abilityText}</div>
                        </td>
                        <td>
                            <span title="Potenzial: ${card?.potentialLabel || ''}" style="color:#38bdf8; font-size:12px;">${potStarsDisplay}</span>
                        </td>
                        <td><span class="badge badge-neutral" style="font-size:11px; color:var(--accent-primary); border:1px solid rgba(56,189,248,0.3);">${roleDisplay}</span></td>
                        <td><strong>${valDisplay}</strong></td>
                        <td><span class="badge ${confBadgeClass}" style="font-size:11px;">${confPercent}%</span></td>
                        <td>${this.formatMoneySafe(p.wage)}</td>
                        <td>${p.contractYears} J.</td>
                        <td>
                            <div style="display:flex; gap:6px;">
                                <button class="btn btn-sm btn-secondary btn-scout-direct" data-player-id="${p.id}" title="Scouten für präzisere Daten">🔍 Scouten</button>
                                <button class="btn btn-sm btn-primary btn-bid-player" data-player-id="${p.id}">Verhandeln</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");

            document.querySelectorAll(".btn-bid-player").forEach(btn => {
                btn.addEventListener("click", () => {
                    const pId = parseInt(btn.dataset.playerId, 10);
                    this.showTransferOfferModal(pId);
                });
            });

            document.querySelectorAll(".btn-scout-direct").forEach(btn => {
                btn.addEventListener("click", () => {
                    const pId = parseInt(btn.dataset.playerId, 10);
                    const scoutingEngine = (typeof ScoutingEngine !== 'undefined' && ScoutingEngine)
                        ? ScoutingEngine
                        : ((typeof window !== 'undefined' && window.ScoutingEngine) ? window.ScoutingEngine : null);

                    if (scoutingEngine && typeof scoutingEngine.scoutPlayer === 'function') {
                        const res = scoutingEngine.scoutPlayer(state, pId, { source: "transfer_market", notify: true });
                        if (res.success) {
                            this.playSound("whistle");
                            this.showToast(`Scoutbericht für ${res.player.name} erstellt! Wissen auf ${res.knowledgeLevel}% gestiegen.`, "success");
                            this.renderTransfers();
                        }
                    }
                });
            });
        }

        // 3. Scouting Aufträge & Berichte
        const assignList = document.getElementById("scoutAssignmentsList");
        if (assignList) {
            const assignments = (state.scouting?.assignments || []).filter(a => a.status === "active");
            if (assignments.length === 0) {
                assignList.innerHTML = `<div class="empty-state-sm">Keine aktiven Scouting-Aufträge. Entsenden Sie oben einen Scout.</div>`;
            } else {
                assignList.innerHTML = assignments.map(a => `
                    <div class="news-item-dash" style="justify-content: space-between;">
                        <div>
                            🔭 <strong>Scout-Fokus:</strong> Position: ${a.position} | Alter bis: ${a.maxAge} | Mindeststärke: ${a.minOverall} OVR
                        </div>
                        <span class="header-tag" style="background:var(--accent-primary); color:#000;">⏳ Noch ${a.matchdaysRemaining} Spieltag(e)</span>
                    </div>
                `).join("");
            }
        }

        const repList = document.getElementById("scoutReportsList");
        if (repList) {
            const reports = state.scouting?.reports || [];
            if (reports.length === 0) {
                repList.innerHTML = `<div class="empty-state-sm">Noch keine Scoutberichte eingetroffen.</div>`;
            } else {
                repList.innerHTML = reports.map(r => `
                    <div class="news-item-dash" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div>
                            <strong>${r.playerName}</strong> (${r.position}, ${r.age} J.) • Geschätzte Stärke: <strong>${r.estimatedOverall}</strong> • Potenzial: <strong>${r.estimatedPotential}</strong>
                            <div style="font-size:12px; color:var(--text-muted); margin-top:3px;">Marktwert: ${r.marketValueFormatted} • Empfehlung: <span style="color:#38bdf8;">${r.recommendation}</span></div>
                        </div>
                        <button class="btn btn-sm btn-primary btn-scout-bid" data-player-id="${r.playerId}">Verhandeln</button>
                    </div>
                `).join("");

                document.querySelectorAll(".btn-scout-bid").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const pId = parseInt(btn.dataset.playerId, 10);
                        this.showTransferOfferModal(pId);
                    });
                });
            }
        }
    }

    /**
     * Training rendern & Jugendakademie anzeigen
     */
    renderTraining() {
        const state = this.app.state;
        const currentFocus = state.trainingSettings?.focus || "allround";
        const currentIntensity = state.trainingSettings?.intensity || "normal";

        const focusRadio = document.querySelector(`input[name="trainFocus"][value="${currentFocus}"]`);
        if (focusRadio) focusRadio.checked = true;

        const intensityRadio = document.querySelector(`input[name="trainIntensity"][value="${currentIntensity}"]`);
        if (intensityRadio) intensityRadio.checked = true;

        // Jugendakademie rendern
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const levelBadge = document.getElementById("youthAcademyLevelBadge");
        if (levelBadge && userClub) {
            const level = userClub.facilities?.youthCenter || state.youthAcademy?.level || 1;
            levelBadge.textContent = `Akademie: Stufe ${level}`;
        }

        const prospectsBody = document.getElementById("youthProspectsBody");
        if (prospectsBody) {
            const prospects = (state.youthAcademy?.prospects || []).filter(p => !p.promoted);
            if (prospects.length === 0) {
                prospectsBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Aktuell keine unbeförderten Jugendspieler in der Akademie.</td></tr>`;
            } else {
                prospectsBody.innerHTML = prospects.map(p => `
                    <tr>
                        <td><strong>${p.name}</strong></td>
                        <td><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span></td>
                        <td>${p.age} Jahre</td>
                        <td><span class="ovr-badge ovr-low">${p.overall} OVR</span></td>
                        <td><strong style="color:#38bdf8;">⭐ ${p.pot}</strong></td>
                        <td>
                            <button class="btn btn-sm btn-primary btn-promote-prospect" data-prospect-id="${p.id}">Profi-Vertrag (Befördern)</button>
                        </td>
                    </tr>
                `).join("");

                document.querySelectorAll(".btn-promote-prospect").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const prId = btn.dataset.prospectId;
                        const res = YouthEngine.promoteProspect(state, userClub.id, prId);
                        if (res.success) {
                            this.playSound("goal");
                            this.showToast(`🎉 ${res.player.name} wurde in die 1. Mannschaft befördert!`, "success");
                            this.renderTraining();
                            this.renderHeader();
                        } else {
                            this.showToast(res.error || "Beförderung fehlgeschlagen", "error");
                        }
                    });
                });
            }
        }
    }

    /**
     * Finanzen & Buchungsjournal rendern
     */
    renderFinances() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        const squad = state.players.filter(p => userClub.playerIds.includes(p.id));
        const weeklyWages = squad.reduce((sum, p) => sum + (p.wage || 0), 0);
        const sponsorWeekly = userClub.sponsor?.amountPerMatchday || Math.round((userClub.reputation || 70) * 15000);
        const matchIncomeEst = Math.round((userClub.capacity || 30000) * 0.85 * (userClub.ticketPrice || 35));

        DOM.setText("finBalance", GameState.formatMoney(userClub.balance));
        DOM.setText("finTransferBudget", GameState.formatMoney(userClub.transferBudget));
        DOM.setText("finWageBudget", GameState.formatMoney(userClub.wageBudget));
        DOM.setText("finWageCosts", GameState.formatMoney(weeklyWages));
        DOM.setText("finCapacity", `${(userClub.capacity || 0).toLocaleString("de-DE")} Plätze`);
        DOM.setText("finMatchdayIncome", `ca. ${GameState.formatMoney(matchIncomeEst)}`);
        DOM.setText("finSponsorWeekly", GameState.formatMoney(sponsorWeekly));
        DOM.setText("finFanbase", `${(userClub.fanBase || 0).toLocaleString("de-DE")} Fans`);

        // Fazilitäten
        if (userClub.facilities) {
            DOM.setText("facTraining", `Stufe ${userClub.facilities.trainingGround || 1}`);
            DOM.setText("facYouth", `Stufe ${userClub.facilities.youthCenter || 1}`);
            DOM.setText("facMedical", `Stufe ${userClub.facilities.medicalCenter || 1}`);
            DOM.setText("facStadium", `Stufe ${userClub.facilities.stadium || 1}`);
        }

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
    renderClub() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        DOM.setText("clubTabName", userClub.name);
        DOM.setText("clubTabCity", userClub.city || "Deutschland");
        DOM.setText("clubTabReputation", userClub.reputation || 70);
        DOM.setText("clubTabFanbase", (userClub.fanBase || 25000).toLocaleString("de-DE"));
        DOM.setText("clubTabFanMood", state.fanMood || 75);
        DOM.setText("clubTabChemistry", userClub.chemistry?.overall || 75);

        DOM.setText("clubTabStadium", userClub.stadium || "Stadion");
        DOM.setText("clubTabCapacity", (userClub.capacity || 30000).toLocaleString("de-DE"));
        DOM.setText("clubTabStadiumLvl", `Stufe ${userClub.facilities?.stadium || 2}`);

        // Sponsor
        DOM.setText("clubTabSponsorName", userClub.sponsor?.name || "Global Tech");
        DOM.setText("clubTabSponsorAmount", `${GameState.formatMoney(userClub.sponsor?.amountPerMatchday || 1000000)} / Spieltag`);
        DOM.setText("clubTabSponsorYears", userClub.sponsor?.yearsRemaining || 2);

        // Facility Stufen
        DOM.setText("lvlTrainingGround", `Stufe ${userClub.facilities?.trainingGround || 2} / 5`);
        DOM.setText("lvlYouthCenter", `Stufe ${userClub.facilities?.youthCenter || 1} / 5`);
        DOM.setText("lvlMedicalCenter", `Stufe ${userClub.facilities?.medicalCenter || 1} / 5`);
        DOM.setText("lvlStadium", `Stufe ${userClub.facilities?.stadium || 2} / 5`);

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

        // Upgrade Buttons
        document.querySelectorAll(".btn-upgrade-fac").forEach(btn => {
            btn.onclick = () => {
                const facKey = btn.dataset.facility;
                const facilityEngine = (typeof FacilityEngine !== 'undefined') ? FacilityEngine : null;
                if (facilityEngine) {
                    const res = facilityEngine.upgrade(state, userClub.id, facKey);
                    if (res.success) {
                        this.playSound("whistle");
                        this.showToast(res.message, "success");
                        this.renderClub();
                        this.renderHeader();
                    } else {
                        this.showToast(res.error, "error");
                    }
                }
            };
        });
    }

    /**
     * Statistiken & Saisonhistorie rendern
     */
    renderStats() {
        const state = this.app.state;

        // Top Scorers
        const scorers = [...state.players].filter(p => p.stats.goals > 0);
        scorers.sort((a, b) => b.stats.goals - a.stats.goals);
        const topScorersEl = document.getElementById("statsTopScorers");
        if (topScorersEl) {
            topScorersEl.innerHTML = scorers.slice(0, 5).map((p, i) => {
                const club = state.clubs.find(c => c.id === p.clubId);
                return `
                    <div class="leaderboard-item">
                        <span class="lb-rank">${i + 1}.</span>
                        <span class="lb-name">${p.name}</span>
                        <span class="lb-club">${club?.name || ''}</span>
                        <span class="lb-val">${p.stats.goals} ⚽</span>
                    </div>
                `;
            }).join("") || `<div class="empty-state-sm">Noch keine Tore erzielt.</div>`;
        }

        // Top Assists
        const assists = [...state.players].filter(p => p.stats.assists > 0);
        assists.sort((a, b) => b.stats.assists - a.stats.assists);
        const topAssistsEl = document.getElementById("statsTopAssists");
        if (topAssistsEl) {
            topAssistsEl.innerHTML = assists.slice(0, 5).map((p, i) => {
                const club = state.clubs.find(c => c.id === p.clubId);
                return `
                    <div class="leaderboard-item">
                        <span class="lb-rank">${i + 1}.</span>
                        <span class="lb-name">${p.name}</span>
                        <span class="lb-club">${club?.name || ''}</span>
                        <span class="lb-val">${p.stats.assists} 🎯</span>
                    </div>
                `;
            }).join("") || `<div class="empty-state-sm">Noch keine Vorlagen erfasst.</div>`;
        }

        // Clean Sheets
        const keepers = [...state.players].filter(p => p.pos === "TW" && p.stats.cleanSheets > 0);
        keepers.sort((a, b) => b.stats.cleanSheets - a.stats.cleanSheets);
        const cleanSheetsEl = document.getElementById("statsCleanSheets");
        if (cleanSheetsEl) {
            cleanSheetsEl.innerHTML = keepers.slice(0, 5).map((p, i) => {
                const club = state.clubs.find(c => c.id === p.clubId);
                return `
                    <div class="leaderboard-item">
                        <span class="lb-rank">${i + 1}.</span>
                        <span class="lb-name">${p.name}</span>
                        <span class="lb-club">${club?.name || ''}</span>
                        <span class="lb-val">${p.stats.cleanSheets} 🧤</span>
                    </div>
                `;
            }).join("") || `<div class="empty-state-sm">Noch keine Zu-Null-Spiele.</div>`;
        }

        // Best Ratings
        const rated = [...state.players].filter(p => p.stats.matches >= 2);
        rated.sort((a, b) => (b.stats.ratingSum / b.stats.matches) - (a.stats.ratingSum / a.stats.matches));
        const topRatingsEl = document.getElementById("statsTopRatings");
        if (topRatingsEl) {
            topRatingsEl.innerHTML = rated.slice(0, 5).map((p, i) => {
                const club = state.clubs.find(c => c.id === p.clubId);
                const avg = (p.stats.ratingSum / p.stats.matches).toFixed(2);
                return `
                    <div class="leaderboard-item">
                        <span class="lb-rank">${i + 1}.</span>
                        <span class="lb-name">${p.name}</span>
                        <span class="lb-club">${club?.name || ''}</span>
                        <span class="lb-val">${avg} ⭐</span>
                    </div>
                `;
            }).join("") || `<div class="empty-state-sm">Mindestens 2 Spiele erforderlich.</div>`;
        }

        // Historie der vergangenen Saisons
        const histBody = document.getElementById("statsHistoryBody");
        if (histBody) {
            const past = state.history?.pastSeasons || [];
            if (past.length === 0) {
                histBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Aktuell läuft Saison 1. Historische Daten werden nach Saisonende archiviert.</td></tr>`;
            } else {
                histBody.innerHTML = past.map(s => {
                    const myClub = state.clubs.find(c => c.id === s.userClubId);
                    return `
                        <tr>
                            <td><strong>Saison ${s.season}</strong></td>
                            <td>🏆 ${s.championName}</td>
                            <td>${myClub?.name || 'Mein Verein'}</td>
                            <td><strong>Platz ${s.userRank}</strong></td>
                        </tr>
                    `;
                }).join("");
            }
        }
    }

    /**
     * Kalender rendern
     */
    renderCalendar() {
        const state = this.app.state;
        const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine) 
            ? CalendarEngine 
            : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : null);

        if (!calendarEngine) return;

        const calText = document.getElementById("calCurrentDateText");
        if (calText) calText.textContent = `${state.currentDate} (Tag ${state.currentDayIndex + 1})`;

        const weekGrid = document.getElementById("calendarWeekGrid");
        const upcomingWeek = calendarEngine.getUpcomingDays(state, 7);

        if (weekGrid) {
            weekGrid.innerHTML = upcomingWeek.map((day, idx) => {
                const isToday = idx === 0;
                let icon = "📅";
                if (day.type === "training") icon = "🏋️";
                if (day.type === "recovery") icon = "🧘";
                if (day.type === "media") icon = "🎙️";
                if (day.type === "sponsor") icon = "🤝";
                if (day.type === "tactics") icon = "📋";
                if (day.type === "opponent_analysis") icon = "🔍";
                if (day.type === "matchday") icon = "⚽";
                if (day.type === "season_start") icon = "⭐";
                if (day.type === "season_end") icon = "🏆";

                return `
                    <div class="calendar-day-card ${isToday ? 'active-today' : ''}">
                        <div class="cal-card-top">
                            <span class="cal-dow">${day.dayOfWeek}</span>
                            <span class="cal-date">${day.date}</span>
                        </div>
                        <div class="cal-card-icon">${icon}</div>
                        <div class="cal-card-title">${day.title}</div>
                        <div class="cal-card-desc">${day.description}</div>
                        ${isToday ? '<span class="cal-status-badge">AKTUELL</span>' : ''}
                    </div>
                `;
            }).join("");
        }

        const fullList = document.getElementById("calendarFullList");
        if (fullList && Array.isArray(state.calendar)) {
            fullList.innerHTML = state.calendar.map((d, i) => {
                const isPast = i < state.currentDayIndex;
                const isCurrent = i === state.currentDayIndex;
                return `
                    <div class="cal-full-item ${isPast ? 'past' : ''} ${isCurrent ? 'current' : ''}">
                        <div class="cal-full-date">${d.date} (${d.dayOfWeek})</div>
                        <div class="cal-full-title">${d.title}</div>
                        <div class="cal-full-status">${isPast ? '✓ Erledigt' : isCurrent ? '⏳ Heute' : 'Ausstehend'}</div>
                    </div>
                `;
            }).join("");
        }
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

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="empty-state-sm" style="padding:24px; text-align:center;">Keine passenden Nachrichten im Postfach gefunden.</div>`;
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
            else if (msg.type === "transfer_done" || msg.type === "transfer_offer") { icon = "🔄"; typeLabel = "Transfer"; }
            else if (msg.type === "training_report" || msg.type === "injury") { icon = "🏥"; typeLabel = "Training / Lazarett"; }
            else if (msg.type === "scout_report") { icon = "🔍"; typeLabel = "Scouting"; }
            else if (msg.type === "finance_warning" || msg.type === "sponsor") { icon = "💰"; typeLabel = "Finanzen"; }

            const displayDate = msg.date || "Saisonstart";

            return `
                <div class="inbox-item ${isUnread ? 'unread' : ''} ${isSelected ? 'selected' : ''}" data-msg-id="${msg.id}">
                    <div class="inbox-item-topline">
                        <div class="inbox-sender-wrap">
                            <span class="inbox-icon">${icon}</span>
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
                    this.selectedInboxMessageId = msgId;
                    this.renderInbox();
                    this.renderInboxDetail(message);
                    this.renderHeader();
                    if (typeof this.app.state.saveToLocalStorage === "function") {
                        this.app.state.saveToLocalStorage();
                    }
                }
            });
        });

        // Detailansicht für die ausgewählte Nachricht rendern
        const currentMsg = state.inbox.find(m => String(m.id) === String(this.selectedInboxMessageId)) || filtered[0];
        if (currentMsg) {
            this.renderInboxDetail(currentMsg);
        }
    }

    renderInboxDetail(msg) {
        const detailContainer = document.getElementById("inboxDetail");
        if (!detailContainer) return;

        let icon = "✉️";
        let typeLabel = "Info";
        if (msg.type === "board_message" || msg.type === "welcome") { icon = "👔"; typeLabel = "Vorstand"; }
        else if (msg.type === "match_report" || msg.type === "match_preview") { icon = "⚽"; typeLabel = "Spiel"; }
        else if (msg.type === "transfer_done" || msg.type === "transfer_offer") { icon = "🔄"; typeLabel = "Transfer"; }
        else if (msg.type === "training_report" || msg.type === "injury") { icon = "🏥"; typeLabel = "Training / Lazarett"; }
        else if (msg.type === "scout_report") { icon = "🔍"; typeLabel = "Scouting"; }
        else if (msg.type === "finance_warning" || msg.type === "sponsor") { icon = "💰"; typeLabel = "Finanzen"; }

        const formattedBody = (msg.body || msg.text || "").replace(/\n/g, "<br>");
        const displayDate = msg.date || "Saisonstart";

        detailContainer.innerHTML = `
            <div class="inbox-detail-header">
                <div class="inbox-detail-title-row">
                    <h2>${icon} ${msg.subject || msg.title || 'Nachricht'}</h2>
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
        `;
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

            <div class="opponent-stats-grid" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px;">
                <div class="dash-card text-center" style="padding:12px;">
                    <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Kaderstärke</span>
                    <h4 style="font-size:20px; color:#38bdf8; margin:4px 0 0 0;">${report.avgOverall}</h4>
                </div>
                <div class="dash-card text-center" style="padding:12px;">
                    <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Angriff</span>
                    <h4 style="font-size:20px; color:#f59e0b; margin:4px 0 0 0;">${report.attackRating}</h4>
                </div>
                <div class="dash-card text-center" style="padding:12px;">
                    <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Mittelfeld</span>
                    <h4 style="font-size:20px; color:#22c55e; margin:4px 0 0 0;">${report.midfieldRating}</h4>
                </div>
                <div class="dash-card text-center" style="padding:12px;">
                    <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Abwehr & TW</span>
                    <h4 style="font-size:20px; color:#a855f7; margin:4px 0 0 0;">${report.defenseRating} / ${report.gkRating}</h4>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
                <div class="dash-card" style="border-left:3px solid #22c55e;">
                    <h4 style="color:#22c55e; margin-bottom:10px;">🟢 Stärken des Gegners</h4>
                    <ul style="padding-left:18px; margin:0; font-size:13px;">
                        ${report.strengths.map(s => `<li>${s}</li>`).join("")}
                    </ul>
                </div>
                <div class="dash-card" style="border-left:3px solid #ef4444;">
                    <h4 style="color:#ef4444; margin-bottom:10px;">🔴 Schwachstellen</h4>
                    <ul style="padding-left:18px; margin:0; font-size:13px;">
                        ${report.weaknesses.map(w => `<li>${w}</li>`).join("")}
                    </ul>
                </div>
            </div>

            <div class="dash-card" style="margin-bottom:20px; background:rgba(56, 189, 248, 0.05); border:1px solid rgba(56, 189, 248, 0.25);">
                <h4 style="color:#38bdf8; margin-bottom:6px;">📋 Taktische Tendenz & Cheftrainer-Empfehlung</h4>
                <p style="font-size:13px; margin-bottom:8px;"><strong>Taktik des Gegners:</strong> ${report.tacticalTrend}</p>
                <p style="font-size:13px; color:#f8fafc; margin:0;"><strong>💡 Trainer-Rat:</strong> ${report.recommendation}</p>
            </div>

            <div class="dash-card">
                <h4 style="margin-bottom:12px;">⭐ Schlüsselspieler im Fokus & Scouting</h4>
                <div style="display:flex; gap:14px; flex-wrap:wrap;">
                    ${report.keyPlayers.map(p => `
                        <div style="background:rgba(255,255,255,0.04); padding:10px 14px; border-radius:8px; border:1px solid var(--border-color); flex:1; min-width:180px; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <strong>${p.name}</strong>
                                    <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span>
                                </div>
                                <div style="margin-top:6px; font-size:13px; color:#f59e0b;">
                                    ${p.starsCaHtml} <span style="font-size:11px; color:var(--text-muted);">(${p.abilityLabel})</span>
                                </div>
                                <div style="font-size:11px; color:var(--accent-primary); margin-top:2px;">
                                    Rolle: <strong>${p.bestRole?.role || 'Stammspieler'}</strong>
                                </div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                                    Gefahr: <span class="badge ${p.dangerBadgeClass}" style="font-size:10px; padding:2px 6px;">${p.danger}</span> • Scouthinweis: <strong>${p.confidence}%</strong>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-secondary btn-scout-opponent-player mt-2" data-player-id="${p.id}" style="width:100%;">
                                🔍 Spieler scouten
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
                const pId = parseInt(btn.dataset.playerId, 10);
                const scoutingEngine = (typeof ScoutingEngine !== 'undefined' && ScoutingEngine) 
                    ? ScoutingEngine 
                    : ((typeof window !== 'undefined' && window.ScoutingEngine) ? window.ScoutingEngine : null);

                if (scoutingEngine && typeof scoutingEngine.scoutPlayer === 'function') {
                    const res = scoutingEngine.scoutPlayer(state, pId, { source: "opponent_analysis", notify: true });
                    if (res.success) {
                        this.playSound("whistle");
                        this.showToast(`Scoutbericht für ${res.player.name} angefordert! Scouting-Wissen: ${res.knowledgeLevel}%`, "success");
                        this.showOpponentAnalysisModal();
                    }
                }
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
                    <span class="ovr-badge ovr-high">${player.overall} OVR</span>
                    <p class="text-muted">Potenzial: ⭐ ${player.pot}</p>
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
                <label>Ablösesumme bieten (€):</label>
                <input type="number" id="offerFeeInput" class="styled-input" value="${askingPriceEst}" step="100000" min="100000">
            </div>

            <div class="tactic-field">
                <label>Wochengehalt bieten (€):</label>
                <input type="number" id="offerWageInput" class="styled-input" value="${Math.round(player.wage * 1.1)}" step="5000" min="5000">
            </div>

            <div class="tactic-field">
                <label>Vertragslaufzeit:</label>
                <select id="offerYearsSelect" class="styled-select">
                    <option value="2">2 Jahre</option>
                    <option value="3" selected>3 Jahre</option>
                    <option value="4">4 Jahre</option>
                    <option value="5">5 Jahre</option>
                </select>
            </div>

            <div class="tactic-field">
                <label>Rolle im Team:</label>
                <select id="offerRoleSelect" class="styled-select">
                    <option value="Schlüsselspieler">Schlüsselspieler</option>
                    <option value="Stammspieler" selected>Stammspieler</option>
                    <option value="Rotation">Rotationsspieler</option>
                    <option value="Talent">Nachwuchstalent</option>
                </select>
            </div>

            <div id="transferFeedback" style="margin-top:14px; font-size:13px; font-weight:600;"></div>

            <div class="modal-footer" style="padding:16px 0 0 0;">
                <button class="btn btn-secondary" id="btnCancelBid">Abbrechen</button>
                <button class="btn btn-primary" id="btnSubmitBid">Angebot einreichen</button>
            </div>
        `;

        modal.style.display = "flex";

        document.getElementById("btnCancelBid").onclick = () => {
            modal.style.display = "none";
        };
        document.getElementById("btnCloseTransferOffer").onclick = () => {
            modal.style.display = "none";
        };

        document.getElementById("btnSubmitBid").onclick = () => {
            const fee = parseInt(document.getElementById("offerFeeInput").value, 10);
            const wage = parseInt(document.getElementById("offerWageInput").value, 10);
            const years = parseInt(document.getElementById("offerYearsSelect").value, 10);
            const role = document.getElementById("offerRoleSelect").value;

            const feedback = document.getElementById("transferFeedback");

            // 1. Verein verhandeln
            const clubEval = TransferEngine.evaluateTransferOffer(state, player.id, userClub.id, fee);
            if (!clubEval.accepted) {
                feedback.style.color = "#ef4444";
                feedback.textContent = `❌ ${clubEval.reason}`;
                return;
            }

            // 2. Spieler verhandeln
            const playerEval = TransferEngine.negotiateContract(player, userClub, wage, years, role);
            if (!playerEval.success) {
                feedback.style.color = "#ef4444";
                feedback.textContent = `❌ ${playerEval.message}`;
                return;
            }

            // Transfer durchführen!
            TransferEngine.executeTransfer(state, player.id, userClub.id, fee, wage, years);
            feedback.style.color = "#34d399";
            feedback.textContent = "✅ Transfer erfolgreich abgeschlossen! Der Spieler wechselt in Ihren Kader.";
            this.playSound("goal");

            setTimeout(() => {
                modal.style.display = "none";
                this.renderCurrentTab();
                this.renderHeader();
            }, 1200);
        };
    }

    /**
     * Modal: Spieler Details & Vertragsverlängerung
     */
    showPlayerDetailsModal(playerId) {
        const state = this.app.state;
        const player = state.players.find(p => p.id === playerId);
        const club = state.clubs.find(c => c.id === player.clubId);
        if (!player) return;

        const modal = document.getElementById("modalPlayerDetails");
        const body = document.getElementById("playerDetailsContent");
        document.getElementById("pdPlayerName").textContent = `${player.name} (${player.pos})`;

        const happy = player.happiness || { overall: 75, playingTime: 75, contract: 75, teamPerformance: 75, reason: "Zufrieden mit der Rolle im Team." };
        const isUserClub = player.clubId === state.userClubId;
        const demand = (typeof ContractEngine !== 'undefined' && isUserClub) ? ContractEngine.getExtensionDemand(player, club) : { demandWage: Math.round((player.wage || 20000) * 1.15) };

        const ratingEngine = (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine : ((typeof window !== 'undefined' && window.PlayerRatingEngine) ? window.PlayerRatingEngine : null);
        const card = ratingEngine ? ratingEngine.calculateVisiblePlayerCard(player, { userClubId: state.userClubId, leagueDataCoverage: 85 }) : null;

        let traitsHtml = "";
        if (card && card.hiddenTraits && card.hiddenTraits.length > 0) {
            traitsHtml = `
                <div class="dash-card mb-3" style="padding:14px; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2);">
                    <h4 style="font-size:13px; margin-bottom:8px; color:#38bdf8;">🧠 Persönlichkeit & Beobachtungen</h4>
                    <ul style="margin:0; padding-left:18px; font-size:12px; color:#e2e8f0; line-height:1.5;">
                        ${card.hiddenTraits.map(t => `<li>${t}</li>`).join("")}
                    </ul>
                </div>
            `;
        }

        let contractSectionHtml = "";
        if (isUserClub) {
            contractSectionHtml = `
                <div class="dash-card mt-3" style="padding:14px; background: rgba(30, 41, 59, 0.7); border:1px solid rgba(255,255,255,0.1);">
                    <h4 style="font-size:14px; margin-bottom:8px; color:#38bdf8;">💼 Vertragsverlängerung verhandeln</h4>
                    <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Forderung des Spielers: ca. <strong>${GameState.formatMoney(demand.demandWage)} / Woche</strong></p>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
                        <div>
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Neues Gehalt (€ / Wo.):</label>
                            <input type="number" id="extWageInput" class="styled-input" style="width:100%;" value="${demand.demandWage}" step="1000">
                        </div>
                        <div>
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Laufzeit:</label>
                            <select id="extYearsSelect" class="styled-select" style="width:100%;">
                                <option value="1">1 Jahr</option>
                                <option value="2">2 Jahre</option>
                                <option value="3" selected>3 Jahre</option>
                                <option value="4">4 Jahre</option>
                                <option value="5">5 Jahre</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Zugesagte Kaderrolle:</label>
                        <select id="extRoleSelect" class="styled-select" style="width:100%;">
                            <option value="Schlüsselspieler" ${player.squadRole === 'Schlüsselspieler' ? 'selected' : ''}>Schlüsselspieler (Höchste Wichtigkeit)</option>
                            <option value="Stammspieler" ${player.squadRole === 'Stammspieler' || !player.squadRole ? 'selected' : ''}>Stammspieler (Regelmäßige Startelf)</option>
                            <option value="Rotationsspieler" ${player.squadRole === 'Rotationsspieler' ? 'selected' : ''}>Rotationsspieler (Teilzeit-Einsätze)</option>
                            <option value="Ergänzungsspieler" ${player.squadRole === 'Ergänzungsspieler' ? 'selected' : ''}>Ergänzungsspieler (Backup)</option>
                            <option value="Zukunftstalent" ${player.squadRole === 'Zukunftstalent' ? 'selected' : ''}>Zukunftstalent</option>
                        </select>
                    </div>

                    <div id="extFeedback" style="font-size:13px; margin-bottom:10px;"></div>
                    <button class="btn btn-primary" id="btnSubmitExtension" style="width:100%;">Neuen Vertrag anbieten</button>
                </div>
            `;
        }

        let scoutExternalHtml = "";
        if (!isUserClub) {
            scoutExternalHtml = `
                <div style="display:flex; gap:10px; margin-top:14px;">
                    <button class="btn btn-secondary" id="btnPdScoutPlayer" style="flex:1;">🔍 Spieler jetzt scouten</button>
                    <button class="btn btn-primary" id="btnPdBidPlayer" style="flex:1;">💼 Transfer verhandeln</button>
                </div>
            `;
        }

        const starsCaHtml = card ? card.starsCaHtml : "★★★☆☆";
        const starsPaHtml = card ? card.starsPaHtml : "★★★★☆";
        const abilityLabel = card ? card.abilityLabel : "Ligaspieler";
        const potentialLabel = card ? card.potentialLabel : "Entwicklungspotenzial";
        const bestRoleName = card?.bestRole?.role || "Allrounder";
        const bestRoleStars = card?.bestRole?.starsHtml || "★★★☆☆";
        const altRoleName = card?.alternativeRole?.role || null;
        const altRoleStars = card?.alternativeRole?.starsHtml || null;

        body.innerHTML = `
            <div class="player-detail-top">
                <div class="player-detail-meta">
                    <span class="pos-tag pos-${this.getPosGroup(player.pos)}" style="font-size:13px;">${player.pos}</span>
                    <span style="font-size:14px; margin-left:8px; color:var(--text-muted);">${club ? club.name : ''} • Alter: ${player.age}</span>
                </div>
                <div class="player-detail-rating">
                    <div class="player-detail-stars">${starsCaHtml}</div>
                    <div class="player-detail-label">${abilityLabel}</div>
                </div>
            </div>

            <!-- Rollen & Potenzial -->
            <div class="player-role-summary-card">
                <div class="player-role-box">
                    <span class="role-box-label">Hauptrolle</span>
                    <div class="role-box-main">
                        <span class="role-name">${bestRoleName}</span>
                        <span class="role-stars">${bestRoleStars}</span>
                    </div>
                    ${altRoleName ? `<div class="role-box-sub">Alt: ${altRoleName} <span>${altRoleStars}</span></div>` : ''}
                </div>

                <div class="player-role-box">
                    <span class="role-box-label">Potenzial</span>
                    <div class="role-box-main">
                        <span class="role-stars role-stars-potential">${starsPaHtml}</span>
                    </div>
                    <div class="role-box-sub">${potentialLabel}</div>
                </div>
            </div>

            <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap:14px; margin-bottom:16px;">
                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:13px; margin-bottom:8px; color:var(--text-muted);">Offensive & Technik</h4>
                    <div class="club-stat-line"><span>Tempo:</span><strong>${player.pace}</strong></div>
                    <div class="club-stat-line"><span>Schuss:</span><strong>${player.shooting}</strong></div>
                    <div class="club-stat-line"><span>Passen:</span><strong>${player.passing}</strong></div>
                    <div class="club-stat-line"><span>Dribbling:</span><strong>${player.dribbling}</strong></div>
                    <div class="club-stat-line"><span>Technik:</span><strong>${player.technique}</strong></div>
                </div>

                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:13px; margin-bottom:8px; color:var(--text-muted);">Defensive & Physis</h4>
                    <div class="club-stat-line"><span>Defensive:</span><strong>${player.defense}</strong></div>
                    <div class="club-stat-line"><span>Physis:</span><strong>${player.physical}</strong></div>
                    <div class="club-stat-line"><span>Ausdauer:</span><strong>${player.stamina}</strong></div>
                    <div class="club-stat-line"><span>Übersicht:</span><strong>${player.vision}</strong></div>
                    <div class="club-stat-line"><span>Stellungsspiel:</span><strong>${player.positioning}</strong></div>
                </div>
            </div>

            <!-- Zufriedenheit & Rolle -->
            <div class="dash-card mb-3" style="padding:14px;">
                <h4 style="font-size:13px; margin-bottom:8px; color:var(--text-muted);">😊 Spielerzufriedenheit & Status</h4>
                <div class="club-stat-line"><span>Kaderrolle:</span><strong>${player.squadRole || 'Kader'}</strong></div>
                <div class="club-stat-line"><span>Gesamtzufriedenheit:</span><strong>${happy.overall}%</strong></div>
                <div class="club-stat-line"><span>Spielzeit / Vertrag:</span><span>${happy.playingTime}% / ${happy.contract}%</span></div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:4px; font-style:italic;">"${happy.reason || 'Zufrieden mit der Situation.'}"</div>
            </div>

            ${traitsHtml}

            <div class="finance-stat-row">
                <span>Saison-Statistiken:</span>
                <strong>${player.stats.matches} Spiele | ${player.stats.goals} Tore | ${player.stats.assists} Assists | Notenschnitt: ${(player.stats.matches > 0 ? (player.stats.ratingSum / player.stats.matches).toFixed(2) : '-')}</strong>
            </div>
            <div class="finance-stat-row">
                <span>Marktwert:</span>
                <strong>${card ? card.visibleValueText : this.formatMoneySafe(player.value)}</strong>
            </div>
            <div class="finance-stat-row">
                <span>Gehalt:</span>
                <strong>${this.formatMoneySafe(player.wage)} / Woche</strong>
            </div>
            <div class="finance-stat-row">
                <span>Vertragslaufzeit:</span>
                <strong>${player.contractYears} Jahr(e)</strong>
            </div>

            ${scoutExternalHtml}
            ${contractSectionHtml}
        `;

        modal.style.display = "flex";
        this.playSound("click");

        // External buttons binden
        if (!isUserClub) {
            document.getElementById("btnPdScoutPlayer")?.addEventListener("click", () => {
                const scoutingEngine = (typeof ScoutingEngine !== 'undefined' && ScoutingEngine)
                    ? ScoutingEngine
                    : ((typeof window !== 'undefined' && window.ScoutingEngine) ? window.ScoutingEngine : null);
                if (scoutingEngine && typeof scoutingEngine.scoutPlayer === 'function') {
                    const res = scoutingEngine.scoutPlayer(state, player.id, { source: "player_profile", notify: true });
                    if (res.success) {
                        this.playSound("whistle");
                        this.showToast(`Scoutbericht für ${player.name} erstellt! Wissen auf ${res.knowledgeLevel}% gestiegen.`, "success");
                        this.showPlayerDetailsModal(player.id);
                    }
                }
            });

            document.getElementById("btnPdBidPlayer")?.addEventListener("click", () => {
                modal.style.display = "none";
                this.showTransferOfferModal(player.id);
            });
        }

        document.getElementById("btnClosePlayerDetails").onclick = () => {
            modal.style.display = "none";
        };

        // Event-Binding für Vertragsverlängerung
        const submitExtBtn = document.getElementById("btnSubmitExtension");
        if (submitExtBtn && isUserClub) {
            submitExtBtn.onclick = () => {
                const offWage = parseInt(document.getElementById("extWageInput").value, 10);
                const offYears = parseInt(document.getElementById("extYearsSelect").value, 10);
                const offRole = document.getElementById("extRoleSelect").value;
                const feedback = document.getElementById("extFeedback");

                const res = ContractEngine.negotiateExtension(player, club, offWage, offYears, offRole);
                if (res.success) {
                    feedback.style.color = "#34d399";
                    feedback.textContent = `✅ ${res.reason}`;
                    this.playSound("goal");
                    this.showToast(`Vertrag mit ${player.name} erfolgreich verlängert!`, "success");
                    this.app.state.saveToLocalStorage();
                    setTimeout(() => {
                        this.showPlayerDetailsModal(player.id);
                        this.renderSquad();
                        this.renderHeader();
                    }, 1200);
                } else {
                    feedback.style.color = "#ef4444";
                    feedback.textContent = `❌ ${res.reason}`;
                    this.showToast(res.reason, "error");
                }
            };
        }
    }

    /**
     * Startet die 2D Live Match Simulation im Vollbild-Modal
     */
    startLiveMatchSimulation(match) {
        const state = this.app.state;
        const homeClub = state.clubs.find(c => c.id === match.homeClubId);
        const awayClub = state.clubs.find(c => c.id === match.awayClubId);

        const liveMatch = MatchEngine.createLiveMatch(match, homeClub, awayClub, state.players);
        this.app.currentLiveMatch = liveMatch;

        const modal = document.getElementById("modalLiveMatch");
        modal.style.display = "flex";

        document.getElementById("lmHomeName").textContent = homeClub.name;
        document.getElementById("lmAwayName").textContent = awayClub.name;
        document.getElementById("lmHomeScore").textContent = "0";
        document.getElementById("lmAwayScore").textContent = "0";
        document.getElementById("lmMinute").textContent = "0";
        document.getElementById("lmEventFeed").innerHTML = "";

        this.playSound("whistle");

        // Live Subs Controls vorbereiten
        this.renderLiveSubsControls(liveMatch);

        const canvas = document.getElementById("livePitchCanvas");
        const ctx = canvas.getContext("2d");

        // Statistikfelder nur bei Änderung anfassen (weniger Layout-Arbeit)
        const setText = (id, value) => {
            if (this.liveStatCache[id] === value) return;
            this.liveStatCache[id] = value;
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        const setWidth = (id, value) => {
            const key = `w_${id}`;
            if (this.liveStatCache[key] === value) return;
            this.liveStatCache[key] = value;
            const el = document.getElementById(id);
            if (el) el.style.width = value;
        };

        this.liveStatCache = {};
        this.renderedEventCount = 0;

        const updateLiveUI = () => {
            setText("lmHomeScore", String(liveMatch.homeScore));
            setText("lmAwayScore", String(liveMatch.awayScore));
            setText("lmMinute", String(liveMatch.minute));
            setText("lmCommentary", liveMatch.lastCommentary);

            const clockEl = document.getElementById("lmClock");
            if (clockEl) setText("lmClock", liveMatch.getClockText ? liveMatch.getClockText() : `${liveMatch.minute}:00`);

            setText("lmStatPossHome", `${liveMatch.stats.possession[0]}%`);
            setText("lmStatPossAway", `${liveMatch.stats.possession[1]}%`);
            setWidth("lmBarPossHome", `${liveMatch.stats.possession[0]}%`);
            setWidth("lmBarPossAway", `${liveMatch.stats.possession[1]}%`);

            setText("lmStatShotsHome", `${liveMatch.stats.shots[0]} (${liveMatch.stats.shotsOnTarget[0]})`);
            setText("lmStatShotsAway", `${liveMatch.stats.shots[1]} (${liveMatch.stats.shotsOnTarget[1]})`);

            setText("lmStatXgHome", liveMatch.stats.xG[0].toFixed(2));
            setText("lmStatXgAway", liveMatch.stats.xG[1].toFixed(2));

            setText("lmStatCornersHome", String(liveMatch.stats.corners[0]));
            setText("lmStatCornersAway", String(liveMatch.stats.corners[1]));

            setText("lmStatFoulsHome", String(liveMatch.stats.fouls[0]));
            setText("lmStatFoulsAway", String(liveMatch.stats.fouls[1]));

            // Ticker: nur neue Ereignisse einfügen statt die Liste neu aufzubauen.
            // Die laufende Nummer funktioniert auch, wenn die Ereignisliste
            // bereits ihre Maximallänge erreicht hat.
            const feed = document.getElementById("lmEventFeed");
            const newestSeq = liveMatch.events[0]?.seq || 0;
            if (feed && newestSeq > this.renderedEventCount) {
                const fresh = liveMatch.events.filter(e => (e.seq || 0) > this.renderedEventCount);
                for (let i = fresh.length - 1; i >= 0; i--) {
                    const node = document.createElement("div");
                    node.className = `ticker-event ticker-${fresh[i].type || "info"}`;
                    node.textContent = fresh[i].text;
                    feed.insertBefore(node, feed.firstChild);
                }
                this.renderedEventCount = newestSeq;
                while (feed.childElementCount > 60) feed.removeChild(feed.lastChild);
            }
        };

        const render2DCanvas = () => {
            if (!this.pitchBackdrop || this.pitchBackdrop.canvas.width !== canvas.width || this.pitchBackdrop.canvas.height !== canvas.height) {
                this.pitchBackdrop = this.buildPitchBackdrop(canvas.width, canvas.height);
            }
            const bg = this.pitchBackdrop;
            if (!bg) return;

            const { pitchX, pitchY, pitchW, pitchH, midX, midY } = bg;
            const scale = pitchW / 105;

            // 1. Vorgerenderter Rasen
            ctx.drawImage(bg.canvas, 0, 0);

            const toX = px => pitchX + (px / 100) * pitchW;
            const toY = py => pitchY + (py / 100) * pitchH;

            // 2. Ballschweif
            const trail = liveMatch.ballTrail || [];
            if (trail.length > 1) {
                ctx.lineCap = "round";
                for (let i = 0; i < trail.length - 1; i++) {
                    const alpha = Math.max(0, trail[i].life / 0.28) * 0.5;
                    if (alpha <= 0.02) continue;
                    ctx.beginPath();
                    ctx.moveTo(toX(trail[i].x), toY(trail[i].y));
                    ctx.lineTo(toX(trail[i + 1].x), toY(trail[i + 1].y));
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.lineWidth = scale * 0.5;
                    ctx.stroke();
                }
                ctx.lineCap = "butt";
            }

            const radius = Math.max(7, scale * 1.25);
            const numberFont = `bold ${Math.round(radius * 0.95)}px 'Inter', system-ui, sans-serif`;
            const nameFont = `600 ${Math.round(radius * 0.82)}px 'Inter', system-ui, sans-serif`;

            // 3. Schatten aller Spieler in einem Durchgang
            ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
            liveMatch.players2D.forEach(p => {
                ctx.beginPath();
                ctx.ellipse(toX(p.x) + radius * 0.16, toY(p.y) + radius * 0.34, radius * 0.95, radius * 0.48, 0, 0, Math.PI * 2);
                ctx.fill();
            });

            // 4. Spieler
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.12;

            liveMatch.players2D.forEach(p => {
                const px = toX(p.x);
                const py = toY(p.y);
                const isActive = liveMatch.activePlayerId === p.id;

                if (isActive) {
                    ctx.beginPath();
                    ctx.arc(px, py, radius * 1.55 * pulse, 0, Math.PI * 2);
                    ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
                    ctx.lineWidth = Math.max(1.5, radius * 0.16);
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.fillStyle = p.color || "#3b82f6";
                ctx.fill();

                // Leichte Aufhellung oben statt eines teuren Verlaufs pro Spieler
                ctx.beginPath();
                ctx.arc(px - radius * 0.24, py - radius * 0.28, radius * 0.58, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
                ctx.fill();

                ctx.beginPath();
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
                ctx.lineWidth = Math.max(1, radius * 0.13);
                ctx.stroke();

                ctx.fillStyle = p.textColor || "#ffffff";
                ctx.font = numberFont;
                ctx.fillText(p.number, px, py + radius * 0.05);
            });

            // 5. Namensschilder nur für die Spieler rund um den Ball - das hält
            //    das Bild lesbar und spart Zeichenaufwand
            const ball = liveMatch.ball;
            const nearBall = liveMatch.players2D
                .filter(p => liveMatch.activePlayerId === p.id || Math.hypot(p.x - ball.x, p.y - ball.y) < 26)
                .slice(0, 10);

            nearBall.forEach(p => {
                const lastName = p.name ? p.name.split(" ").pop() : "";
                if (!lastName) return;

                const px = toX(p.x);
                const py = toY(p.y);
                const textWidth = this.measureCached(ctx, lastName, nameFont);
                const padX = radius * 0.42;
                const pillH = radius * 1.12;
                const pillY = py + radius * 1.1;

                ctx.fillStyle = "rgba(15, 23, 42, 0.82)";
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(px - textWidth / 2 - padX, pillY, textWidth + padX * 2, pillH, pillH / 2);
                } else {
                    ctx.rect(px - textWidth / 2 - padX, pillY, textWidth + padX * 2, pillH);
                }
                ctx.fill();

                ctx.fillStyle = "#f1f5f9";
                ctx.font = nameFont;
                ctx.fillText(lastName, px, pillY + pillH / 2);
            });

            // 6. Ball mit Flughöhe (Schatten wandert, Ball wird größer)
            const bx = toX(ball.x);
            const by = toY(ball.y);
            const height = ball.height || 0;
            const ballR = Math.max(3.5, scale * 0.62) * (1 + height * 0.45);

            ctx.beginPath();
            ctx.ellipse(bx + ballR * 0.4 + height * scale * 1.2, by + ballR * 0.8 + height * scale * 1.6,
                ballR * 0.9, ballR * 0.45, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 0, 0, ${0.45 - height * 0.15})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(bx, by - height * scale * 1.4, ballR, 0, Math.PI * 2);
            ctx.fillStyle = "#f8fafc";
            ctx.fill();
            ctx.strokeStyle = "rgba(15, 23, 42, 0.75)";
            ctx.lineWidth = Math.max(1, ballR * 0.22);
            ctx.stroke();

            // 7. Torjubel-Effekt inklusive Torschütze
            if (liveMatch.goalFlash > 0) {
                const alpha = Math.min(1, liveMatch.goalFlash);
                ctx.save();
                ctx.fillStyle = `rgba(250, 204, 21, ${alpha * 0.18})`;
                ctx.fillRect(pitchX, pitchY, pitchW, pitchH);

                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
                ctx.shadowBlur = 16;

                ctx.font = `800 ${Math.round(pitchH * 0.13)}px 'Inter', system-ui, sans-serif`;
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fillText("TOOOOR!", midX, midY - pitchH * 0.04);

                const scorer = liveMatch.lastScorerName;
                if (scorer) {
                    ctx.font = `700 ${Math.round(pitchH * 0.055)}px 'Inter', system-ui, sans-serif`;
                    ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
                    ctx.fillText(scorer, midX, midY + pitchH * 0.07);
                }
                ctx.restore();
            }
        };

        this.resizeLiveCanvas();
        let lastFrameTime = performance.now();

        const tickLoop = (now) => {
            if (liveMatch.isFinished) {
                cancelAnimationFrame(this.liveMatchAnimFrame);
                this.liveMatchAnimFrame = null;
                if (this.liveResizeHandler) {
                    window.removeEventListener("resize", this.liveResizeHandler);
                    this.liveResizeHandler = null;
                }
                updateLiveUI();
                render2DCanvas();
                this.playSound("whistle");
                setTimeout(() => {
                    modal.style.display = "none";
                    this.showMatchReportModal(match);
                }, 1500);
                return;
            }

            // Delta-Zeit begrenzen, damit ein Tabwechsel keinen Sprung verursacht
            const deltaMs = Math.min(120, now - lastFrameTime);
            lastFrameTime = now;

            const prevScore = liveMatch.homeScore + liveMatch.awayScore;

            liveMatch.advanceRealTime(deltaMs);
            liveMatch.updateBallAndPlayers(deltaMs);

            if (liveMatch.homeScore + liveMatch.awayScore > prevScore) {
                this.playSound("goal");
            }

            updateLiveUI();
            render2DCanvas();

            this.liveMatchAnimFrame = requestAnimationFrame(tickLoop);
        };

        // Canvas an Fenstergröße anpassen, solange das Modal offen ist
        this.liveResizeHandler = () => {
            if (this.resizeLiveCanvas()) render2DCanvas();
        };
        window.addEventListener("resize", this.liveResizeHandler);

        this.liveMatchAnimFrame = requestAnimationFrame(tickLoop);

        // Controls Binden
        document.getElementById("btnLmPause").onclick = () => {
            liveMatch.isPaused = !liveMatch.isPaused;
            document.getElementById("btnLmPause").textContent = liveMatch.isPaused ? "▶ Weiter" : "⏸ Pause";
            lastFrameTime = performance.now();
        };

        document.querySelectorAll(".speed-btn").forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const speedVal = btn.dataset.speed;
                liveMatch.speed = isNaN(speedVal) ? speedVal : parseInt(speedVal, 10);
                lastFrameTime = performance.now();
            };
        });

        document.getElementById("btnLmSkip").onclick = () => {
            liveMatch.skipToEnd();
            updateLiveUI();
            render2DCanvas();
        };

        // Subtabs
        document.querySelectorAll(".live-subtab").forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll(".live-subtab").forEach(t => t.classList.remove("active"));
                document.querySelectorAll(".live-subtab-pane").forEach(p => p.classList.remove("active"));
                tab.classList.add("active");
                document.getElementById(`lmSubtab-${tab.dataset.subtab}`).classList.add("active");
            };
        });

        document.getElementById("lmLiveMentality").onchange = (e) => {
            liveMatch.updateTactics("home", { mentality: e.target.value });
        };
        const livePressingEl = document.getElementById("lmLivePressing");
        if (livePressingEl) {
            livePressingEl.onchange = (e) => {
                liveMatch.updateTactics("home", { pressing: e.target.value });
            };
        }
        const liveTempoEl = document.getElementById("lmLiveTempo");
        if (liveTempoEl) {
            liveTempoEl.onchange = (e) => {
                liveMatch.updateTactics("home", { tempo: e.target.value });
            };
        }
    }

    renderLiveSubsControls(liveMatch) {
        const subsContainer = document.getElementById("lmLiveSubsList");
        const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);

        const subsCounter = document.getElementById("lmSubsCounter");
        if (subsCounter) {
            subsCounter.textContent = `${liveMatch.substitutionsUsed?.home || 0} / 5`;
        }

        subsContainer.innerHTML = `
            <div style="font-size:12px; margin-bottom:8px; color:var(--text-muted);">
                Klicken Sie auf einen Startelf-Spieler und dann auf einen Bank-Spieler:
            </div>
            <div class="live-sub-picker">
                <h5>Startelf (Auswechseln):</h5>
                <select id="selectSubOut" class="styled-select mb-2">
                    ${userClub.lineup.map(id => {
                        const p = this.app.state.players.find(pl => pl.id === id);
                        return `<option value="${p.id}">${p.name} (${p.pos}, Fitness: ${p.fitness}%)</option>`;
                    }).join("")}
                </select>

                <h5>Einwechselspieler (Bank):</h5>
                <select id="selectSubIn" class="styled-select mb-2">
                    ${userClub.bench.map(id => {
                        const p = this.app.state.players.find(pl => pl.id === id);
                        return `<option value="${p.id}">${p.name} (${p.pos}, OVR: ${p.overall})</option>`;
                    }).join("")}
                </select>

                <button class="btn btn-sm btn-primary" id="btnExecuteSub">Auswechslung durchführen</button>
            </div>
        `;

        document.getElementById("btnExecuteSub").onclick = () => {
            const outId = parseInt(document.getElementById("selectSubOut").value, 10);
            const inId = parseInt(document.getElementById("selectSubIn").value, 10);
            const res = liveMatch.substitute("home", outId, inId);
            if (res.success) {
                this.playSound("whistle");
                this.showToast(res.message, "success");
                this.renderLiveSubsControls(liveMatch);
            } else {
                this.showToast(res.message, "error");
            }
        };
    }

    /**
     * Modal: Spielbericht nach Abpfiff
     */
    showMatchReportModal(match) {
        const state = this.app.state;
        const home = state.clubs.find(c => c.id === match.homeClubId);
        const away = state.clubs.find(c => c.id === match.awayClubId);

        const modal = document.getElementById("modalMatchReport");
        const body = document.getElementById("matchReportContent");

        const goals = match.events.filter(e => e.type === "goal");
        const cards = match.events.filter(e => e.type === "yellow_card" || e.type === "red_card");
        const injuries = match.injuries || [];
        const suspensions = match.suspensions || [];

        const homeRatings = (match.playerRatings || []).filter(r => r.clubId === home.id);
        const awayRatings = (match.playerRatings || []).filter(r => r.clubId === away.id);

        const renderRatingsTable = (ratings, teamName) => {
            if (!ratings || ratings.length === 0) return '<div class="text-muted" style="font-size:12px;">Keine Noten verfügbar</div>';
            return `
                <div style="margin-bottom:12px;">
                    <h5 style="font-size:13px; font-weight:700; margin-bottom:6px; color:var(--text-primary);">${teamName}</h5>
                    <table style="width:100%; font-size:12px; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted); text-align:left;">
                                <th style="padding:4px 2px;">Spieler</th>
                                <th style="padding:4px 2px; text-align:center;">Pos</th>
                                <th style="padding:4px 2px; text-align:center;">Min</th>
                                <th style="padding:4px 2px; text-align:center;">T/A/P</th>
                                <th style="padding:4px 2px; text-align:center;">Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ratings.map(r => {
                                const tap = `${r.goals || 0}/${r.assists || 0}/${r.saves || 0}`;
                                const noteColor = r.rating >= 7.5 ? "#10b981" : (r.rating <= 5.8 ? "#ef4444" : "var(--accent-gold)");
                                return `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                        <td style="padding:4px 2px;">${r.name} ${r.cards || ''}</td>
                                        <td style="padding:4px 2px; text-align:center; color:var(--text-muted);">${r.pos}</td>
                                        <td style="padding:4px 2px; text-align:center;">${r.minutes}'</td>
                                        <td style="padding:4px 2px; text-align:center; font-size:11px; color:var(--text-muted);">${tap}</td>
                                        <td style="padding:4px 2px; text-align:center; font-weight:700; color:${noteColor};">${r.rating.toFixed(1)}</td>
                                    </tr>
                                `;
                            }).join("")}
                        </tbody>
                    </table>
                </div>
            `;
        };

        body.innerHTML = `
            <div style="text-align:center; padding:16px 0; border-bottom:1px solid var(--border-color); margin-bottom:16px;">
                <h1 style="font-size:36px; font-weight:800; color:var(--accent-gold);">${match.homeGoals} : ${match.awayGoals}</h1>
                <h3 style="margin-top:4px;">${home.name} vs ${away.name}</h3>
                <p class="text-muted" style="font-size:13px;">${home.stadium}</p>
            </div>

            ${match.summaryText ? `
                <div style="font-size:13px; line-height:1.4; padding:10px 14px; background:rgba(255,255,255,0.03); border-radius:6px; margin-bottom:16px; border-left:3px solid var(--accent-gold);">
                    ${match.summaryText}
                </div>
            ` : ''}

            ${match.manOfTheMatch ? `
                <div class="dash-card" style="padding:12px; text-align:center; background:rgba(245, 158, 11, 0.1); border-color:#f59e0b; margin-bottom:16px;">
                    ⭐ <strong>Man of the Match:</strong> ${match.manOfTheMatch.name} (${match.manOfTheMatch.clubName}) — Note <strong>${match.manOfTheMatch.rating}</strong>
                </div>
            ` : ''}

            <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:14px; margin-bottom:10px;">⚽ Torschützen</h4>
                    ${goals.length > 0 ? goals.map(g => `<div>${g.text}</div>`).join("") : '<div class="text-muted">Keine Tore</div>'}
                </div>
                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:14px; margin-bottom:10px;">🟨 Karten & Disziplin</h4>
                    ${cards.length > 0 ? cards.map(c => `<div>${c.text}</div>`).join("") : '<div class="text-muted">Faires Spiel ohne Platzverweise</div>'}
                </div>
            </div>

            ${(injuries.length > 0 || suspensions.length > 0) ? `
                <div class="dash-card" style="padding:14px; margin-bottom:16px; background:rgba(239, 68, 68, 0.05); border-color:rgba(239, 68, 68, 0.3);">
                    <h4 style="font-size:14px; margin-bottom:10px; color:#ef4444;">🚑 Verletzungen & Sperren</h4>
                    ${injuries.map(inj => `<div style="font-size:13px;">🩹 <strong>${inj.playerName}</strong>: ${inj.injuryName} (${inj.weeks} Wochen Ausfall)</div>`).join("")}
                    ${suspensions.map(s => `<div style="font-size:13px;">🚫 <strong>${s.playerName}</strong>: ${s.reason} (${s.matches} Spiel(e) gesperrt)</div>`).join("")}
                </div>
            ` : ''}

            <div class="dash-card" style="padding:14px; margin-bottom:16px;">
                <h4 style="font-size:14px; margin-bottom:12px;">⭐ Spielernoten & Leistungsdaten</h4>
                <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap:16px;">
                    <div>${renderRatingsTable(homeRatings, home.name)}</div>
                    <div>${renderRatingsTable(awayRatings, away.name)}</div>
                </div>
            </div>

            <div class="dash-card" style="padding:14px;">
                <h4 style="font-size:14px; margin-bottom:12px;">📊 Spielstatistik</h4>
                <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap:12px;">
                    <div class="club-stat-line"><span>Ballbesitz:</span><strong>${match.stats.possession[0]}% - ${match.stats.possession[1]}%</strong></div>
                    <div class="club-stat-line"><span>Passquote:</span><strong>${match.stats.passAccuracy ? `${match.stats.passAccuracy[0]}% - ${match.stats.passAccuracy[1]}%` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Zweikämpfe gewonnen:</span><strong>${match.stats.tacklesWon ? `${match.stats.tacklesWon[0]}% - ${match.stats.tacklesWon[1]}%` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Schüsse gesamt:</span><strong>${match.stats.shots[0]} - ${match.stats.shots[1]}</strong></div>
                    <div class="club-stat-line"><span>Schüsse aufs Tor:</span><strong>${match.stats.shotsOnTarget[0]} - ${match.stats.shotsOnTarget[1]}</strong></div>
                    <div class="club-stat-line"><span>Expected Goals (xG):</span><strong>${match.stats.xG[0]} - ${match.stats.xG[1]}</strong></div>
                    <div class="club-stat-line"><span>Eckbälle:</span><strong>${match.stats.corners ? `${match.stats.corners[0]} - ${match.stats.corners[1]}` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Fouls:</span><strong>${match.stats.fouls ? `${match.stats.fouls[0]} - ${match.stats.fouls[1]}` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Gelbe Karten:</span><strong>${match.stats.yellowCards ? `${match.stats.yellowCards[0]} - ${match.stats.yellowCards[1]}` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Rote Karten:</span><strong>${match.stats.redCards ? `${match.stats.redCards[0]} - ${match.stats.redCards[1]}` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Torwartparaden:</span><strong>${match.stats.saves ? `${match.stats.saves[0]} - ${match.stats.saves[1]}` : '-'}</strong></div>
                </div>
            </div>
        `;

        modal.style.display = "flex";
        document.getElementById("btnCloseReport").onclick = () => {
            modal.style.display = "none";
            this.renderCurrentTab();
            this.renderHeader();
        };
    }

    /**
     * Modal: Meisterfeier am Saisonende
     */
    /**
     * Führt einen einzelnen Tag im Kalender fort
     */
    handleCalendarAdvanceDay() {
        const state = this.app.state;
        const calendarEngine = (typeof CalendarEngine !== 'undefined' && CalendarEngine) 
            ? CalendarEngine 
            : ((typeof window !== 'undefined' && window.CalendarEngine) ? window.CalendarEngine : null);

        if (!calendarEngine) return;

        const res = calendarEngine.advanceOneDay(state);
        if (res.success) {
            if (res.type === "matchday" && res.matchResult) {
                this.playSound("whistle");
                this.showToast(`⚽ Spieltag ${state.currentMatchday - 1} wurde simuliert!`, "success");
            } else {
                const msg = res.summary?.messages?.[0] || `${res.day?.title} abgeschlossen.`;
                this.showToast(`📅 ${res.day?.date}: ${msg}`, "info");
            }

            this.renderHeader();
            this.renderCurrentTab();
            if (typeof state.saveToLocalStorage === "function") {
                state.saveToLocalStorage();
            }
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

        const res = calendarEngine.advanceToNextMatchday(state);
        if (res.success) {
            const count = res.simulatedDays?.length || 0;
            this.showToast(`⏩ ${count} Tage simuliert. Bereit für Spieltag ${state.currentMatchday}!`, "success");
            this.renderHeader();
            this.renderCurrentTab();
            if (typeof state.saveToLocalStorage === "function") {
                state.saveToLocalStorage();
            }
        }
    }

    showSeasonEndCelebration(endResult) {
        const modal = document.getElementById("modalSeasonEnd");
        const details = document.getElementById("seDetails");

        document.getElementById("seTitle").textContent = `🏆 Meister der Saison ${endResult.seasonYear}!`;
        document.getElementById("seSubtitle").textContent = `Herzlichen Glückwunsch an ${endResult.championClub.name}!`;

        details.innerHTML = `
            <div class="dash-card" style="margin-top:16px;">
                <h4>Ihr Saisonabschluss:</h4>
                <p>Ihr Verein belegt den <strong>${endResult.userRank}. Tabellenplatz</strong>.</p>
                <p>Die Saisonprämien wurden auf Ihr Vereinskonto überwiesen.</p>
            </div>
        `;

        modal.style.display = "flex";
        this.playSound("goal");

        document.getElementById("btnStartNextSeason").onclick = () => {
            SeasonEngine.startNextSeason(this.app.state);
            modal.style.display = "none";
            this.renderCurrentTab();
            this.renderHeader();
            this.playSound("whistle");
        };
    }

    /**
     * Globale Event Listeners binden
     */
    bindGlobalEvents() {
        // Spieltag starten / weiter button im Header
        document.getElementById("btnHeaderAdvance").onclick = () => {
            this.app.handleAdvanceAction();
        };

        // Dashboard Schnell-Aktionen
        const btnOpponent = document.getElementById("btnDashOpponentAnalysis");
        if (btnOpponent) {
            btnOpponent.onclick = () => {
                this.showOpponentAnalysisModal();
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

        // Kalender Tagesfortschritt Buttons
        const btnDashAdvanceDay = document.getElementById("btnDashAdvanceDay");
        if (btnDashAdvanceDay) {
            btnDashAdvanceDay.onclick = () => {
                this.handleCalendarAdvanceDay();
            };
        }

        const btnDashAdvanceMatchday = document.getElementById("btnDashAdvanceMatchday");
        if (btnDashAdvanceMatchday) {
            btnDashAdvanceMatchday.onclick = () => {
                this.handleCalendarAdvanceMatchday();
            };
        }

        const btnCalAdvanceDay = document.getElementById("btnCalendarAdvanceDay");
        if (btnCalAdvanceDay) {
            btnCalAdvanceDay.onclick = () => {
                this.handleCalendarAdvanceDay();
            };
        }

        const btnCalAdvanceMatchday = document.getElementById("btnCalendarAdvanceMatchday");
        if (btnCalAdvanceMatchday) {
            btnCalAdvanceMatchday.onclick = () => {
                this.handleCalendarAdvanceMatchday();
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

        document.getElementById("btnDashLiveMatch").onclick = () => {
            const val = this.validateLineupForMatch();
            if (!val.valid) {
                this.showToast(val.message, "error");
                this.switchTab("tactics");
                return;
            }

            const state = this.app.state;
            const round = state.schedule.find(r => r.matchday === state.currentMatchday);
            const userMatch = round?.matches.find(m => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
            if (userMatch && !userMatch.played) {
                this.startLiveMatchSimulation(userMatch);
            }
        };

        document.getElementById("btnDashInstantSim").onclick = () => {
            const val = this.validateLineupForMatch();
            if (!val.valid) {
                this.showToast(val.message, "error");
                this.switchTab("tactics");
                return;
            }

            const state = this.app.state;
            const round = state.schedule.find(r => r.matchday === state.currentMatchday);
            const userMatch = round?.matches.find(m => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
            if (userMatch && !userMatch.played) {
                const home = state.clubs.find(c => c.id === userMatch.homeClubId);
                const away = state.clubs.find(c => c.id === userMatch.awayClubId);
                MatchEngine.simulateFullMatch(userMatch, home, away, state.players);
                this.playSound("whistle");
                this.showMatchReportModal(userMatch);
            }
        };

        // Auto Lineup Button
        document.getElementById("btnAutoLineup").onclick = () => {
            const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
            GameState.autoSetLineupForClub(userClub, this.app.state.players);
            this.playSound("click");
            this.renderTactics();
        };

        // Formation Switcher
        document.getElementById("selectFormation").onchange = (e) => {
            const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
            userClub.formation = e.target.value;
            this.renderTactics();
        };

        // Taktik Dropdowns
        ["tacMentality", "tacPressing", "tacTempo", "tacPassing", "tacFocus"].forEach(id => {
            document.getElementById(id).onchange = (e) => {
                const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
                const key = id.replace("tac", "").toLowerCase();
                const map = { mentality: "mentality", pressing: "pressing", tempo: "tempo", passing: "passing", focus: "focus" };
                userClub.tactics[map[key]] = e.target.value;
            };
        });

        // Rollen Dropdowns
        ["roleCaptain", "rolePenalty", "roleFreeKick", "roleCorner"].forEach(id => {
            document.getElementById(id).onchange = (e) => {
                const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
                const roleMap = { roleCaptain: "captain", rolePenalty: "penaltyTaker", roleFreeKick: "freeKickTaker", roleCorner: "cornerTaker" };
                userClub.roles[roleMap[id]] = parseInt(e.target.value, 10);
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
            if (this.currentFixtureMatchday < this.app.state.totalMatchdays) {
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

        // Transfer & Scouting Subtabs
        document.getElementById("btnSubTransfersMarket")?.addEventListener("click", () => {
            document.getElementById("btnSubTransfersMarket")?.classList.add("active");
            document.getElementById("btnSubTransfersScouting")?.classList.remove("active");
            DOM.show("viewTransferMarket");
            DOM.hide("viewScoutingCenter");
        });

        document.getElementById("btnSubTransfersScouting")?.addEventListener("click", () => {
            document.getElementById("btnSubTransfersScouting")?.classList.add("active");
            document.getElementById("btnSubTransfersMarket")?.classList.remove("active");
            DOM.show("viewScoutingCenter");
            DOM.hide("viewTransferMarket");
            this.renderTransfers();
        });

        // Scout Auftrag absenden
        document.getElementById("btnStartScoutAssignment")?.addEventListener("click", () => {
            const pos = document.getElementById("scoutPosSelect")?.value || "ALL";
            const maxAge = parseInt(document.getElementById("scoutAgeSelect")?.value || "25", 10);
            const minOvr = parseInt(document.getElementById("scoutOvrSelect")?.value || "75", 10);

            const res = ScoutingEngine.startAssignment(this.app.state, { position: pos, maxAge: maxAge, minOverall: minOvr });
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

            const res = YouthEngine.upgradeAcademy(this.app.state, userClub.id);
            if (res.success) {
                this.playSound("goal");
                this.showToast(res.message, "success");
                this.renderTraining();
                this.renderFinances();
                this.renderHeader();
            } else {
                this.showToast(res.error, "error");
            }
        });

        // Transfer Filter
        document.getElementById("tfSearch")?.addEventListener("input", () => this.renderTransfers());
        document.getElementById("tfPosFilter")?.addEventListener("change", () => this.renderTransfers());
        document.getElementById("tfRatingFilter")?.addEventListener("change", () => this.renderTransfers());

        // Training Settings
        document.querySelectorAll('input[name="trainFocus"]').forEach(r => {
            r.addEventListener("change", (e) => {
                this.app.state.trainingSettings.focus = e.target.value;
            });
        });

        document.querySelectorAll('input[name="trainIntensity"]').forEach(r => {
            r.addEventListener("change", (e) => {
                this.app.state.trainingSettings.intensity = e.target.value;
            });
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
            const ok = this.app.state.saveToLocalStorage();
            if (ok) {
                this.showToast("Spielstand erfolgreich im Browser gespeichert!", "success");
            } else {
                this.showToast("Fehler beim Speichern des Spielstands!", "error");
            }
        };

        document.getElementById("btnLoadLocal").onclick = () => {
            const loaded = GameState.loadFromLocalStorage();
            if (loaded) {
                this.app.state = loaded;
                this.renderCurrentTab();
                this.showToast("Spielstand erfolgreich geladen!", "success");
            } else {
                this.showToast("Kein gespeicherter Spielstand im Browser gefunden.", "warning");
            }
        };

        document.getElementById("btnExportJson").onclick = () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(this.app.state.exportToJson());
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", this.app.state.getExportFileName ? this.app.state.getExportFileName() : `FM_Pro_Save_Saison_${this.app.state.seasonYear}_Spieltag_${this.app.state.currentMatchday}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            this.showToast("Spielstand-Datei (.json) heruntergeladen!", "info");
        };

        document.getElementById("fileImportJson").onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                const res = GameState.importFromJson(evt.target.result);
                if (res.success && res.state) {
                    this.app.state = res.state;
                    this.app.state.saveToLocalStorage();
                    this.renderCurrentTab();
                    this.showToast("Spielstand-Datei erfolgreich importiert!", "success");
                } else {
                    this.showToast(res.error || "Ungültige Spielstand-Datei!", "error");
                }
            };
            reader.readAsText(file);
        };

        document.getElementById("btnNewGamePrompt").onclick = () => {
            this.showNewGameModal();
        };

        document.getElementById("btnToggleSound").onclick = () => {
            this.soundEnabled = !this.soundEnabled;
            document.getElementById("btnToggleSound").textContent = this.soundEnabled ? "🔊 Sound: Aktiviert" : "🔇 Sound: Stummgeschaltet";
        };
    }
}

if (typeof window !== "undefined") {
    window.UIManager = UIManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIManager };
}
