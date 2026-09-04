/**
 * App - Hauptcontroller der Anwendung
 */

class App {
    constructor() {
        this.state = null;
        this.ui = new UIManager(this);
        this.currentLiveMatch = null;
    }

    /**
     * Startet die Anwendung
     */
    start() {
        if (this.ui && typeof this.ui.init === "function") {
            this.ui.init();
        }

        const GameStateClass = typeof GameState !== "undefined"
            ? GameState
            : (typeof window !== "undefined" ? window.GameState : null);

        if (!GameStateClass) {
            console.error("[App] GameState ist nicht verfügbar. Prüfe gameState.js und Script-Reihenfolge.");
            if (this.ui) {
                this.ui.showToast("Spiel konnte nicht geladen werden: GameState fehlt.", "error", 7000);
                this.ui.showStartScreen();
            }
            return;
        }

        const savedState = (typeof GameStateClass.loadFromLocalStorage === "function")
            ? GameStateClass.loadFromLocalStorage()
            : null;

        if (savedState && savedState.userClubId) {
            this.state = savedState;
            if (this.ui) this.ui.showStartScreen();
        } else {
            if (this.ui) this.ui.showStartScreen();
        }
    }

    /**
     * Startet ein neues Spiel mit Managerprofil
     */
    startNewGame(clubId, difficulty = "normal", managerProfile = {}) {
        try {
            const GameStateClass = typeof GameState !== "undefined"
                ? GameState
                : (typeof window !== "undefined" ? window.GameState : null);

            if (!GameStateClass || typeof GameStateClass.createNewGame !== "function") {
                throw new Error("GameState.createNewGame ist nicht verfügbar. Prüfe gameState.js und die Script-Reihenfolge.");
            }

            this.state = GameStateClass.createNewGame(clubId, difficulty, managerProfile);

            if (!this.state || !this.state.userClubId) {
                throw new Error("Neuer Spielstand wurde nicht korrekt erzeugt.");
            }

            const StateValidatorClass = typeof StateValidator !== "undefined"
                ? StateValidator
                : (typeof window !== "undefined" ? window.StateValidator : null);

            if (StateValidatorClass && typeof StateValidatorClass.validateState === "function") {
                const validation = StateValidatorClass.validateState(this.state);
                if (!validation.valid) {
                    throw new Error(validation.error || "Neuer Spielstand ist ungültig.");
                }
            }

            if (typeof this.state.saveToLocalStorage === "function") {
                this.state.saveToLocalStorage();
            }

            if (this.ui) {
                this.ui.hideStartScreen();
                this.ui.switchTab("dashboard");
                this.ui.renderCurrentTab();
            }

            return {
                success: true,
                state: this.state
            };
        } catch (error) {
            console.error("[App] startNewGame fehlgeschlagen:", error);

            if (this.ui && typeof this.ui.showToast === "function") {
                this.ui.showToast(`Karriere konnte nicht gestartet werden: ${error.message}`, "error", 7000);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Startet oder beendet den aktuellen Spieltag
     */
    handleAdvanceAction() {
        if (!this.state || !this.state.userClubId) {
            this.ui.showStartScreen();
            return;
        }

        const round = this.state.schedule.find(r => r.matchday === this.state.currentMatchday);
        const userMatch = round?.matches.find(m => m.homeClubId === this.state.userClubId || m.awayClubId === this.state.userClubId);

        // Falls das Spiel des Users noch nicht gespielt wurde:
        if (userMatch && !userMatch.played) {
            // Aufstellung vor Spielbeginn validieren
            const val = this.ui.validateLineupForMatch();
            if (!val.valid) {
                this.ui.showToast(val.message, "error");
                this.ui.switchTab("tactics");
                return;
            }

            this.ui.startLiveMatchSimulation(userMatch);
            return;
        }

        // Falls das Spiel bereits gespielt wurde: Weiter zum nächsten Spieltag
        const result = SeasonEngine.advanceToNextMatchday(this.state);
        this.state.saveToLocalStorage();

        if (result.seasonEnded) {
            this.ui.showSeasonEndCelebration(result);
        } else {
            this.ui.playSound("click");
            this.ui.renderCurrentTab();
            this.ui.renderHeader();
        }
    }
}

// Global instanziieren und beim Laden starten
window.addEventListener("DOMContentLoaded", () => {
    window.appInstance = new App();
    window.appInstance.start();

    // PWA Service Worker registrieren (wenn über HTTP/HTTPS ausgeführt)
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('./service-worker.js').catch(err => {
            console.log("ServiceWorker-Registrierung übersprungen oder fehlgeschlagen:", err);
        });
    }
});

if (typeof window !== "undefined") {
    window.App = App;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { App };
}
