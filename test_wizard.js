/**
 * Test-Suite 2: Wizard-Logik, Filter, UI-Simulation und Regressionsprüfungen
 */
const fs = require('fs');
const { INITIAL_TEAMS_DATA } = require('./js/data/initialData.js');
const { GameState, FORMATION_CONFIGS } = require('./js/engine/gameState.js');
const { UIManager } = require('./js/ui/uiManager.js');

global.GameState = GameState;
global.FORMATION_CONFIGS = FORMATION_CONFIGS;

function runWizardTests() {
    console.log("\n=======================================================");
    console.log("   [TEST SUITE: WIZARD & UI REGRESSION] test_wizard.js ");
    console.log("=======================================================");

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        try {
            fn();
            console.log(`  ✅ ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ ${name}`);
            console.error(`     Fehler: ${err.message}`);
            if (err.stack) console.error(err.stack);
            failed++;
        }
    }

    // 1. Filter-Unit-Tests
    test("Wizard Filter: Standard ohne Filter liefert alle 18 Vereine", () => {
        const res = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA);
        if (res.length !== 18) throw new Error(`Erwartet 18 Vereine, erhalten: ${res.length}`);
    });

    test("Wizard Filter: Leere Suche / Leerzeichen filtert nicht", () => {
        const res1 = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { search: "" });
        const res2 = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { search: "   " });
        if (res1.length !== 18 || res2.length !== 18) throw new Error("Leere Suche hat fälschlicherweise gefiltert");
    });

    test("Wizard Filter: Suche nach Vereinsnamen (z.B. 'München', 'Dortmund', 'Bayer')", () => {
        const muc = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { search: "München" });
        if (muc.length !== 1 || muc[0].id !== "muc") throw new Error("Suche nach 'München' fehlgeschlagen");

        const dor = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { search: "dortmund" });
        if (dor.length !== 1 || dor[0].id !== "dor") throw new Error("Suche nach 'dortmund' fehlgeschlagen");

        const lev = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { search: "bayer" });
        if (lev.length !== 1 || lev[0].id !== "lev") throw new Error("Suche nach 'bayer' fehlgeschlagen");
    });

    test("Wizard Filter: Suche nach Stadt und Stadionname", () => {
        const frankfurt = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { search: "Frankfurt" });
        if (frankfurt.length !== 1 || frankfurt[0].id !== "sge") throw new Error("Suche nach Stadt 'Frankfurt' fehlgeschlagen");

        const arena = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { search: "Westfalen" });
        if (arena.length !== 1 || arena[0].id !== "dor") throw new Error("Suche nach Stadion 'Westfalen' fehlgeschlagen");
    });

    test("Wizard Filter: Schwierigkeit 'easy' (Meisterschaftsfavoriten)", () => {
        const easy = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { difficulty: "easy" });
        if (easy.length !== 2 || !easy.every(c => c.boardExpectation === "championship")) {
            throw new Error(`Filter 'easy' fehlgeschlagen (Erhalten: ${easy.length})`);
        }
    });

    test("Wizard Filter: Schwierigkeit 'medium' (Top 3 Anwärter)", () => {
        const med = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { difficulty: "medium" });
        if (med.length !== 3 || !med.every(c => c.boardExpectation === "top3")) {
            throw new Error(`Filter 'medium' fehlgeschlagen (Erhalten: ${med.length})`);
        }
    });

    test("Wizard Filter: Schwierigkeit 'hard' (Mittelfeld / Klassenerhalt)", () => {
        const hard = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { difficulty: "hard" });
        if (hard.length !== 13 || !hard.every(c => c.boardExpectation === "midfield" || c.boardExpectation === "avoid_relegation")) {
            throw new Error(`Filter 'hard' fehlgeschlagen (Erhalten: ${hard.length})`);
        }
    });

    test("Wizard Filter: Ungültige Schwierigkeit verhält sich wie 'all'", () => {
        const fallback = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { difficulty: "unknown_value" });
        if (fallback.length !== 18) throw new Error("Ungültige Schwierigkeit hat nicht alle Vereine geliefert");
    });

    test("Wizard Filter: Sortierungen (Stärke, Budget, Alphabetisch)", () => {
        const sDesc = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { sort: "strength_desc" });
        const sAsc = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { sort: "strength_asc" });
        const bDesc = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { sort: "budget_desc" });
        const nAsc = UIManager.getFilteredWizardClubs(INITIAL_TEAMS_DATA, { sort: "name_asc" });

        if (sDesc[0].name !== "FC München" && sDesc[0].name !== "Bayer Leverkusen") {
            throw new Error("Sortierung nach Stärke absteigend unerwartet");
        }
        if (bDesc[0].transferBudget < bDesc[bDesc.length - 1].transferBudget) {
            throw new Error("Sortierung nach Budget absteigend fehlgeschlagen");
        }
        if (nAsc[0].name.localeCompare(nAsc[nAsc.length - 1].name) > 0) {
            throw new Error("Alphabetische Sortierung fehlgeschlagen");
        }
    });

    test("Wizard Filter: Robuste Edge-Case-Behandlung (null, undefined, unvollständige Objekte)", () => {
        const edge1 = UIManager.getFilteredWizardClubs(null);
        if (!Array.isArray(edge1) || edge1.length !== 0) throw new Error("null teams schlägt nicht sicher fehl");

        const edge2 = UIManager.getFilteredWizardClubs(undefined);
        if (!Array.isArray(edge2) || edge2.length !== 0) throw new Error("undefined teams schlägt nicht sicher fehl");

        const faultyClubList = [
            { id: "c1" }, // missing name, city, stadium, players
            { id: "c2", name: "Test Team", players: [] }
        ];
        const edge3 = UIManager.getFilteredWizardClubs(faultyClubList, { search: "test", sort: "strength_desc" });
        if (edge3.length !== 1 || edge3[0].id !== "c2") throw new Error("Fehlerhafte Club-Objekte crashen Filter");
    });

    // 2. Regressionstests im Source-Code
    test("Regression: showNewGameModal() Methodendefinition darf nur exakt einmal in uiManager.js vorkommen", () => {
        const uiCode = fs.readFileSync('./js/ui/uiManager.js', 'utf8');
        const matches = uiCode.match(/showNewGameModal\s*\(\s*\)\s*\{/g) || [];
        if (matches.length !== 1) {
            throw new Error(`showNewGameModal() Definition kommt ${matches.length}-mal in uiManager.js vor (erwartet: 1)`);
        }
    });

    test("Regression: Legacy-IDs clubSelectionGrid und btnConfirmStartGame dürfen nicht in JS verwendet werden", () => {
        const uiCode = fs.readFileSync('./js/ui/uiManager.js', 'utf8');
        if (uiCode.includes('clubSelectionGrid')) {
            throw new Error("Veraltete ID 'clubSelectionGrid' in uiManager.js gefunden");
        }
        if (uiCode.includes('btnConfirmStartGame')) {
            throw new Error("Veraltete ID 'btnConfirmStartGame' in uiManager.js gefunden");
        }
        if (uiCode.includes('club-select-card')) {
            throw new Error("Veraltete CSS-Klasse 'club-select-card' in uiManager.js gefunden");
        }
    });

    // 3. Script-Reihenfolge in index.html
    test("Script-Reihenfolge in index.html ist konsistent und vollständig", () => {
        const html = fs.readFileSync('./index.html', 'utf8');

        const posInitialData = html.indexOf('src="js/data/initialData.js"');
        const posDom = html.indexOf('src="js/core/dom.js"');
        const posSave = html.indexOf('src="js/services/saveService.js"');
        const posGameState = html.indexOf('src="js/engine/gameState.js"');
        const posUi = html.indexOf('src="js/ui/uiManager.js"');
        const posApp = html.indexOf('src="js/app.js"');

        if (posInitialData === -1) throw new Error("initialData.js fehlt in index.html");
        if (posUi === -1) throw new Error("uiManager.js fehlt in index.html");
        if (posApp === -1) throw new Error("app.js fehlt in index.html");

        if (posInitialData > posUi) throw new Error("initialData.js muss vor uiManager.js geladen werden");
        if (posDom !== -1 && posDom > posUi) throw new Error("dom.js muss vor uiManager.js geladen werden");
        if (posSave !== -1 && posSave > posGameState) throw new Error("saveService.js muss vor gameState.js geladen werden");
        if (posUi > posApp) throw new Error("uiManager.js muss vor app.js geladen werden");

        // PositionEngine und die 2D-Regie müssen vor ihren Nutzern geladen werden
        const posPositionEngine = html.indexOf('src="js/engine/positionEngine.js"');
        const posDirector = html.indexOf('src="js/engine/liveMatchDirector.js"');
        const posMatchEngine = html.indexOf('src="js/engine/matchEngine.js"');
        const posAiManager = html.indexOf('src="js/engine/aiManagerEngine.js"');

        if (posPositionEngine === -1) throw new Error("positionEngine.js fehlt in index.html");
        if (posDirector === -1) throw new Error("liveMatchDirector.js fehlt in index.html");
        if (posPositionEngine > posGameState) throw new Error("positionEngine.js muss vor gameState.js geladen werden");
        if (posPositionEngine > posAiManager) throw new Error("positionEngine.js muss vor aiManagerEngine.js geladen werden");
        if (posDirector > posMatchEngine) throw new Error("liveMatchDirector.js muss vor matchEngine.js geladen werden");

        // Alle eingebundenen Skripte müssen auch offline verfügbar sein
        const sw = fs.readFileSync('./service-worker.js', 'utf8');
        const scriptSrcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
        scriptSrcs.forEach(srcPath => {
            if (!sw.includes(`"./${srcPath}"`)) {
                throw new Error(`Script ${srcPath} fehlt im Service-Worker-Cache`);
            }
        });
    });

    // 4. Service Worker Cache & Activation Prüfung
    test("Service Worker implementiert Versions-Cache und automatisches Löschen alter Caches", () => {
        const sw = fs.readFileSync('./service-worker.js', 'utf8');
        if (!sw.includes("addEventListener('activate'") && !sw.includes('addEventListener("activate"')) {
            throw new Error("Service Worker fehlt der 'activate' Event Listener");
        }
        if (!sw.includes("caches.delete")) {
            throw new Error("Service Worker löscht alte Caches nicht via caches.delete()");
        }
        if (!sw.includes("CACHE_NAME")) {
            throw new Error("Service Worker hat keine CACHE_NAME Definition");
        }
    });

    // 5. DOM & UI-Mocking Simulationstests
    test("Node-Import: GameState.formatMoney und getExpectationText existieren", () => {
        if (typeof GameState.formatMoney !== "function") {
            throw new Error("GameState.formatMoney ist keine Funktion!");
        }
        if (typeof GameState.getExpectationText !== "function") {
            throw new Error("GameState.getExpectationText ist keine Funktion!");
        }
        const formatted = GameState.formatMoney(25000000);
        if (!formatted.includes("Mio") || !formatted.includes("25")) {
            throw new Error(`Unerwartete Geldausgabe: ${formatted}`);
        }
        const expText = GameState.getExpectationText("championship");
        if (!expText.includes("Meisterschaft")) {
            throw new Error(`Unerwarteter Erwartungstext: ${expText}`);
        }
    });

    test("Browser-Global-Simulation: window.GameState wird gesetzt, wenn gameState.js geladen wird", () => {
        const vm = require('vm');
        const code = fs.readFileSync('./js/engine/gameState.js', 'utf8');
        const mockWindow = {};
        const context = vm.createContext({
            window: mockWindow,
            localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
            console: console,
            Array: Array,
            Object: Object,
            Math: Math,
            Date: Date,
            JSON: JSON,
            Set: Set,
            String: String,
            Number: Number,
            parseFloat: parseFloat,
            parseInt: parseInt,
            isNaN: isNaN
        });
        vm.runInContext(code, context);

        if (!mockWindow.GameState) {
            throw new Error("window.GameState wurde in gameState.js nicht auf dem window-Objekt exportiert!");
        }
        if (typeof mockWindow.GameState.formatMoney !== "function") {
            throw new Error("window.GameState.formatMoney ist keine Funktion auf dem window-Objekt!");
        }
        if (typeof mockWindow.GameState.getExpectationText !== "function") {
            throw new Error("window.GameState.getExpectationText ist keine Funktion auf dem window-Objekt!");
        }
        if (!mockWindow.FORMATION_CONFIGS) {
            throw new Error("window.FORMATION_CONFIGS wurde in gameState.js nicht auf dem window-Objekt exportiert!");
        }
    });

    test("Browser-Global-Simulation: Alle Core-, Engine- und Service-Module binden sich an window.*", () => {
        const vm = require('vm');
        const files = [
            './js/core/constants.js',
            './js/core/dom.js',
            './js/core/formatters.js',
            './js/core/random.js',
            './js/core/validators.js',
            './js/data/namePools.js',
            './js/data/leagueData.js',
            './js/data/initialData.js',
            './js/services/migrationService.js',
            './js/services/saveService.js',
            './js/engine/newsEngine.js',
            './js/engine/boardEngine.js',
            './js/engine/financeEngine.js',
            './js/engine/contractEngine.js',
            './js/engine/scoutingEngine.js',
            './js/engine/youthEngine.js',
            './js/engine/aiManagerEngine.js',
            './js/engine/clubGenerator.js',
            './js/engine/playerGenerator.js',
            './js/engine/competitionEngine.js',
            './js/engine/playerRatingEngine.js',
            './js/engine/calendarEngine.js',
            './js/engine/opponentAnalysisEngine.js',
            './js/engine/gameState.js',
            './js/engine/matchEngine.js',
            './js/engine/transferEngine.js',
            './js/engine/trainingEngine.js',
            './js/engine/seasonEngine.js',
            './js/ui/uiManager.js',
            './js/app.js'
        ];

        const mockWindow = {
            addEventListener: () => {}
        };
        const context = vm.createContext({
            window: mockWindow,
            localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
            document: { addEventListener: () => {}, querySelectorAll: () => [], getElementById: () => null },
            navigator: {},
            console: console,
            Array: Array, Object: Object, Math: Math, Date: Date, JSON: JSON, Set: Set, String: String, Number: Number, parseFloat: parseFloat, parseInt: parseInt, isNaN: isNaN
        });

        files.forEach(file => {
            const code = fs.readFileSync(file, 'utf8');
            vm.runInContext(code, context);
        });

        const expectedGlobals = [
            'APP_VERSION', 'DOM', 'Formatters', 'Random', 'StateValidator',
            'NAME_POOLS', 'LEAGUES_DATA', 'COMPETITIONS_DATA', 'COUNTRIES_DATA', 'INITIAL_TEAMS_DATA',
            'MigrationService', 'SaveService',
            'NewsEngine', 'BoardEngine', 'FinanceEngine', 'ContractEngine',
            'ScoutingEngine', 'YouthEngine', 'AIManagerEngine', 'ClubGenerator', 'PlayerGenerator', 'CompetitionEngine',
            'PlayerRatingEngine', 'CalendarEngine', 'OpponentAnalysisEngine',
            'GameState', 'MatchEngine', 'TransferEngine', 'TrainingEngine', 'SeasonEngine',
            'UIManager', 'App'
        ];

        expectedGlobals.forEach(name => {
            if (!mockWindow[name]) {
                throw new Error(`Global window.${name} fehlt nach Laden der Datei`);
            }
        });
    });

    test("Wizard-Render: formatMoneySafe und getExpectationTextSafe funktionieren als ausfallsichere Fallbacks", () => {
        const resFormatted = UIManager.formatMoneySafe(12500000);
        if (!resFormatted || !resFormatted.includes("12,5") && !resFormatted.includes("12.5") && !resFormatted.includes("12500000")) {
            throw new Error(`formatMoneySafe liefert unerwartetes Format: ${resFormatted}`);
        }

        const resExp = UIManager.getExpectationTextSafe("championship");
        if (!resExp || !resExp.includes("Meisterschaft")) {
            throw new Error(`getExpectationTextSafe liefert unerwartetes Format: ${resExp}`);
        }
    });

    test("UI Simulation & Regression: Wizard-Ablauf, Schritt 3 Vereinsauswahl & Detail-Rendern ohne Exception", () => {
        // Minimaler DOM-Mock
        const domElements = {};
        function createMockElement(id, tag = "div") {
            const el = {
                id,
                tagName: tag.toUpperCase(),
                style: {},
                className: "",
                classList: {
                    add: (c) => { el.className += ` ${c}`; },
                    remove: (c) => { el.className = el.className.replace(new RegExp(`\\b${c}\\b`, "g"), "").trim(); },
                    contains: (c) => el.className.includes(c)
                },
                value: "",
                innerHTML: "",
                textContent: "",
                disabled: false,
                children: [],
                remove: () => {},
                appendChild: (child) => { el.children.push(child); return child; },
                removeChild: (child) => {
                    const idx = el.children.indexOf(child);
                    if (idx !== -1) el.children.splice(idx, 1);
                    return child;
                },
                listeners: {},
                addEventListener: (evt, fn) => {
                    el.listeners[evt] = el.listeners[evt] || [];
                    el.listeners[evt].push(fn);
                },
                dispatchEvent: (evt) => {
                    (el.listeners[evt] || []).forEach(fn => fn({ target: el }));
                },
                querySelectorAll: (sel) => {
                    if (sel === ".club-list-item") {
                        const items = [];
                        const matches = (el.innerHTML || "").match(/class="club-list-item[^"]*"\s+data-club-id="([^"]+)"/g) || [];
                        matches.forEach(m => {
                            const clubIdMatch = m.match(/data-club-id="([^"]+)"/);
                            const clubId = clubIdMatch ? clubIdMatch[1] : null;
                            const itemEl = createMockElement(`item_${clubId}`);
                            itemEl.dataset = { clubId };
                            items.push(itemEl);
                        });
                        return items;
                    }
                    return [];
                }
            };
            domElements[id] = el;
            return el;
        }

        // Benötigte Mock-Elemente anlegen
        createMockElement("modalNewGame");
        createMockElement("clubSelectionList");
        createMockElement("clubDetailPanel");
        createMockElement("btnWizardNext", "button");
        createMockElement("btnWizardPrev", "button");
        createMockElement("filterClubSearch", "input");
        createMockElement("filterClubSort", "select");
        createMockElement("filterClubDifficulty", "select");
        createMockElement("inputManagerName", "input");
        createMockElement("inputManagerNationality", "input");
        createMockElement("inputManagerBirthdate", "input");
        createMockElement("selectDifficulty", "select");
        createMockElement("startScreenOverlay");

        const mockBody = createMockElement("body", "body");
        mockBody.appendChild = (child) => {};
        mockBody.removeChild = (child) => {};

        global.document = {
            body: mockBody,
            getElementById: (id) => domElements[id] || createMockElement(id),
            querySelectorAll: (sel) => [],
            createElement: (tag) => createMockElement(`dyn_${tag}_${Date.now()}_${Math.random()}`, tag)
        };
        global.window = {
            INITIAL_TEAMS_DATA,
            GameState,
            FORMATION_CONFIGS,
            UIManager
        };

        const mockApp = {
            state: null,
            startNewGame: (clubId, diff, mgr) => {
                mockApp.state = GameState.createNewGame(clubId, diff, mgr);
                return { success: true, state: mockApp.state };
            }
        };

        const ui = new UIManager(mockApp);

        // 1. Wizard öffnen
        ui.showNewGameModal();
        if (domElements["modalNewGame"].style.display !== "flex") throw new Error("Modal wurde nicht geöffnet");
        if (ui.wizardStep !== 1) throw new Error("Wizard startet nicht bei Schritt 1");
        if (ui.wizardSelectedClubId !== null) throw new Error("wizardSelectedClubId nicht initial null");

        // 2. Schritt 3 ansteuern (Vereinsauswahl)
        ui.setWizardStep(3);
        if (ui.wizardStep !== 3) throw new Error("Schritt 3 konnte nicht gesetzt werden");

        const listHtml = domElements["clubSelectionList"].innerHTML;
        if (!listHtml.includes("FC München") || !listHtml.includes("Borussia Dortmund")) {
            throw new Error("Vereinsliste hat in Schritt 3 keine Vereinskarten gerendert");
        }

        // 3. Verein auswählen (z.B. FC München)
        ui.wizardSelectedClubId = "muc";
        ui.renderWizardClubs();
        ui.renderWizardClubDetails("muc");

        const detailHtml = domElements["clubDetailPanel"].innerHTML;
        if (!detailHtml.includes("FC München") || !detailHtml.includes("Bavaria Arena")) {
            throw new Error("Detailpanel zeigt Vereinsdaten von FC München nicht an");
        }

        // 4. Karriere bestätigen
        ui.confirmStartGameWithSelectedClub();
        if (!mockApp.state || mockApp.state.userClubId !== "muc") {
            throw new Error("Karrierestart hat userClubId 'muc' nicht in app.state gesetzt");
        }
    });

    // 6. Mobile & Responsive PWA Checks
    test("Mobile & Responsive PWA-Prüfungen: HTML, CSS und Manifest-Integrität", () => {
        const html = fs.readFileSync('./index.html', 'utf8');
        const css = fs.readFileSync('./css/style.css', 'utf8');
        const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));

        // Viewport Meta
        if (!html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">')) {
            throw new Error("Viewport Meta Tag fehlt oder ist nicht responsiv konfiguriert");
        }

        // Manifest Link
        if (!html.includes('rel="manifest" href="manifest.json"')) {
            throw new Error("Manifest ist in index.html nicht korrekt verlinkt");
        }

        // Manifest Validierung
        if (manifest.display !== "standalone" || manifest.orientation !== "portrait-primary") {
            throw new Error("Manifest PWA display oder orientation ungültig");
        }

        // CSS Mobile Media Queries
        if (!css.includes("@media (max-width: 1200px)") || !css.includes("@media (max-width: 900px)") || !css.includes("@media (max-width: 640px)") || !css.includes("@media (max-width: 420px)")) {
            throw new Error("Responsive CSS Media Queries für 1200px, 900px, 640px und 420px fehlen!");
        }

        // Horizontal Scrollable Tables & Touch Targets
        if (!css.includes("overflow-x: auto") || !css.includes("-webkit-overflow-scrolling: touch")) {
            throw new Error("Tabellen-Scrollbarkeit (overflow-x: auto) fehlt im CSS");
        }
        if (!css.includes(".mobile-bottom-nav") || !css.includes(".mobile-drawer")) {
            throw new Error("Mobile Bottom Navigation oder Drawer CSS-Klassen fehlen");
        }

        // HTML Mobile Navigation
        if (!html.includes('class="mobile-bottom-nav"') || !html.includes('id="mobileDrawerOverlay"')) {
            throw new Error("Mobile Bottom Navigation oder Mobile Drawer fehlt im HTML");
        }

        // Kritische statische IDs und dynamische Hooks
        const requiredStaticIds = [
            "app", "startScreenOverlay", "btnStartNewGame", "btnStartContinueGame", "startFileInput",
            "modalNewGame", "btnWizardNext", "btnWizardBack", "clubSelectionList", "clubDetailPanel",
            "filterClubSearch", "filterClubSort", "filterClubDifficulty",
            "pane-dashboard", "pane-squad", "pane-tactics", "pane-fixtures", "pane-calendar",
            "pane-transfers", "pane-training", "pane-finances", "pane-stats", "pane-inbox", "pane-settings",
            "btnDashLiveMatch", "btnDashInstantSim", "btnDashOpponentAnalysis", "btnHeaderAdvance",
            "livePitchCanvas", "modalLiveMatch", "inboxList", "inboxDetail",
            // Formations-Editor & Live-Uhr
            "selectFormation", "btnFormationEdit", "formationEditorBar", "formationShapeBadge",
            "selectSlotPosition", "chkFormationSnap", "inputFormationName", "btnFormationSave",
            "btnFormationReset", "btnFormationDelete", "pitchGridOverlay", "lmClock"
        ];

        requiredStaticIds.forEach(id => {
            if (!html.includes(`id="${id}"`)) {
                throw new Error(`Kritische DOM-ID '#${id}' fehlt in index.html!`);
            }
        });

        const uiJs = fs.readFileSync('./js/ui/uiManager.js', 'utf8');
        if (!uiJs.includes('btnAdoptClub')) {
            throw new Error("Dynamischer Hook 'btnAdoptClub' fehlt in uiManager.js");
        }

        const requiredTabs = [
            "dashboard", "squad", "tactics", "fixtures", "calendar",
            "transfers", "training", "finances", "stats", "inbox", "settings"
        ];

        requiredTabs.forEach(tab => {
            if (!html.includes(`data-tab="${tab}"`)) {
                throw new Error(`Kritisches data-tab="${tab}" fehlt in index.html!`);
            }
        });
    });

    // 7. UI Layout Polish: Postfach, Rollenkarten, Dashboard-Timeline & Role-Chips
    test("UI Layout Polish: CSS-Klassen & semantische Templates für Postfach, Timeline und Spielerrollen", () => {
        const css = fs.readFileSync('./css/style.css', 'utf8');
        const uiJs = fs.readFileSync('./js/ui/uiManager.js', 'utf8');

        // CSS-Prüfungen
        const requiredCssClasses = [
            ".calendar-timeline-item",
            ".cal-day-date",
            ".cal-day-info",
            ".cal-day-title",
            ".cal-day-desc",
            ".inbox-item-topline",
            ".inbox-sender-wrap",
            ".inbox-date",
            ".inbox-detail-title-row",
            ".inbox-detail-meta-grid",
            ".inbox-detail-date",
            ".player-role-summary-card",
            ".player-role-box",
            ".role-box-label",
            ".role-box-main",
            ".role-name",
            ".role-stars",
            ".role-chip",
            ".player-detail-top"
        ];

        requiredCssClasses.forEach(cls => {
            if (!css.includes(cls)) {
                throw new Error(`CSS-Klasse '${cls}' fehlt im Stylesheet!`);
            }
        });

        // Template-Prüfungen in uiManager.js
        if (!uiJs.includes('class="inbox-item-topline"') || !uiJs.includes('class="inbox-sender-wrap"')) {
            throw new Error("Postfach-Template in uiManager.js verwendet nicht die neuen Klassen .inbox-item-topline / .inbox-sender-wrap");
        }
        if (!uiJs.includes('class="inbox-detail-title-row"') || !uiJs.includes('class="inbox-detail-meta-grid"')) {
            throw new Error("Postfach-Detail in uiManager.js verwendet nicht die neuen Klassen .inbox-detail-title-row / .inbox-detail-meta-grid");
        }
        if (!uiJs.includes('class="player-role-summary-card"') || !uiJs.includes('class="player-role-box"')) {
            throw new Error("Spieler-Detail in uiManager.js verwendet nicht .player-role-summary-card / .player-role-box");
        }
        if (!uiJs.includes('class="role-chip"')) {
            throw new Error("Kader-Tabelle in uiManager.js verwendet nicht .role-chip");
        }
    });

    console.log(`\n  Ergebnis Wizard-Tests: ${passed} bestanden, ${failed} fehlgeschlagen.`);
    if (failed > 0) throw new Error(`${failed} Wizard-Tests fehlgeschlagen.`);
    return { passed, failed };
}

if (require.main === module) {
    runWizardTests();
}

module.exports = { runWizardTests };
