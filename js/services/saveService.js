/**
 * SaveService - Robuster Speicherservice für LocalStorage, Export, Import und Validierung
 */

const STORAGE_KEY = "footballManagerSave_v2";
const LEGACY_STORAGE_KEY = "footballManagerSave";

const SaveService = {
    /**
     * Auflösung der Hilfsdienste. Prüft Modulscope, window und require der
     * Reihe nach - eine window-Attrappe ohne das gesuchte Modul darf die
     * require-Auflösung nicht abschneiden.
     */
    _resolve(name, path) {
        if (typeof globalThis !== 'undefined' && globalThis[name]) return globalThis[name];
        if (typeof window !== 'undefined' && window[name]) return window[name];
        if (typeof require !== 'undefined') {
            try {
                const mod = require(path);
                if (mod && mod[name]) return mod[name];
            } catch (e) { /* im Browser nicht vorhanden */ }
        }
        return null;
    },

    _codec() {
        return this._resolve('SaveCodec', './saveCodec.js');
    },

    _saveVersion() {
        return this._resolve('MigrationService', './migrationService.js')?.CURRENT_SAVE_VERSION || 6;
    },

    /**
     * Speichert den aktuellen Spielstand im LocalStorage.
     *
     * Eine komplette Fußballwelt mit zwölf Ligen bringt über 4000 Spieler mit
     * und belegt als rohes JSON knapp 6 MB - mehr, als der LocalStorage der
     * Browser üblicherweise zulässt. Der SaveCodec verdichtet Spieler und
     * Spielpläne deshalb auf rund ein Fünftel.
     */
    save(state) {
        if (!state) return { success: false, error: "Kein State zum Speichern vorhanden." };

        state.lastSavedAt = new Date().toISOString();

        const codec = this._codec();
        const payload = {
            saveVersion: this._saveVersion(),
            gameVersion: "0.2.0",
            createdAt: state.createdAt || new Date().toISOString(),
            lastSavedAt: state.lastSavedAt,
            state: codec ? codec.encodeState(state) : state
        };

        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            }
            return { success: true, timestamp: state.lastSavedAt };
        } catch (e) {
            console.error("[SaveService] Fehler beim Speichern im LocalStorage:", e);
            return { success: false, error: "LocalStorage-Speicherlimit erreicht oder blockiert." };
        }
    },

    /**
     * Lädt den Spielstand aus dem LocalStorage
     */
    load() {
        if (typeof localStorage === 'undefined') return null;

        try {
            let rawData = localStorage.getItem(STORAGE_KEY);
            if (!rawData) {
                // Fallback für Legacy-Key
                rawData = localStorage.getItem(LEGACY_STORAGE_KEY);
            }
            if (!rawData) return null;

            const parsed = JSON.parse(rawData);

            // Kompakt gespeicherte Spielstände zuerst wieder auffalten
            const codec = this._codec();
            if (codec && parsed.state && codec.isEncoded(parsed.state)) {
                parsed.state = codec.decodeState(parsed.state);
            }

            const migrator = (typeof MigrationService !== 'undefined') ? MigrationService : (typeof window !== 'undefined' ? window.MigrationService : null);
            const validator = (typeof StateValidator !== 'undefined') ? StateValidator : (typeof window !== 'undefined' ? window.StateValidator : null);

            const migrationResult = migrator 
                ? migrator.migrateSave(parsed) 
                : { success: true, state: parsed.state || parsed };

            if (!migrationResult.success) {
                console.error("[SaveService] Migration fehlgeschlagen:", migrationResult.error);
                return null;
            }

            const state = migrationResult.state;
            const val = validator 
                ? validator.validateState(state) 
                : { valid: true };

            if (!val.valid) {
                console.warn("[SaveService] Geladener Spielstand unvollständig:", val.error);
            }

            return state;
        } catch (e) {
            console.error("[SaveService] Fehler beim Laden des Spielstands:", e);
            return null;
        }
    },

    /**
     * Prüft, ob ein Spielstand vorhanden ist
     */
    exists() {
        if (typeof localStorage === 'undefined') return false;
        return !!(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY));
    },

    /**
     * Löscht den Spielstand
     */
    delete() {
        if (typeof localStorage === 'undefined') return;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    },

    /**
     * Ruft eine Zusammenfassung des Spielstands für das Startmenü ab
     */
    getSummary() {
        const state = this.load();
        if (!state || !state.userClubId) return null;

        const club = state.clubs.find(c => c.id === state.userClubId);
        const standings = state.standings || [];
        const rankIndex = standings.findIndex(s => s.clubId === state.userClubId);
        const rank = rankIndex !== -1 ? rankIndex + 1 : "-";

        return {
            clubId: state.userClubId,
            clubName: club ? club.name : "Unbekannt",
            seasonYear: state.seasonYear || 1,
            currentMatchday: state.currentMatchday || 1,
            totalMatchdays: state.totalMatchdays || 34,
            rank: rank,
            lastSaved: state.lastSavedAt || state.createdAt || new Date().toISOString(),
            managerName: state.manager?.name || "Manager",
            managerNationality: state.manager?.nationality || "Deutschland",
            difficulty: state.difficulty || "normal"
        };
    },

    /**
     * Exportiert den Spielstand als JSON-String
     */
    exportJson(state) {
        if (!state) return null;
        const payload = {
            saveVersion: this._saveVersion(),
            gameVersion: "0.2.0",
            exportDate: new Date().toISOString(),
            state: state
        };
        return JSON.stringify(payload);
    },

    /**
     * Importiert und validiert einen JSON-String
     */
    importJson(jsonString) {
        try {
            if (!jsonString || typeof jsonString !== 'string') {
                return { success: false, error: "Leerer oder ungültiger JSON-String." };
            }

            const parsed = JSON.parse(jsonString);

            const codec = this._codec();
            if (codec && parsed.state && codec.isEncoded(parsed.state)) {
                parsed.state = codec.decodeState(parsed.state);
            }

            const validator = (typeof StateValidator !== 'undefined') ? StateValidator : (typeof window !== 'undefined' ? window.StateValidator : null);
            const migrator = (typeof MigrationService !== 'undefined') ? MigrationService : (typeof window !== 'undefined' ? window.MigrationService : null);

            const val = validator
                ? validator.validateSavePayload(parsed)
                : { valid: true, state: parsed.state || parsed };

            if (!val.valid) {
                return { success: false, error: val.error || "Ungültiges Spielstand-Format." };
            }

            const migration = migrator
                ? migrator.migrateSave(parsed)
                : { success: true, state: val.state };

            if (!migration.success) {
                return { success: false, error: migration.error || "Migration fehlgeschlagen." };
            }

            const finalState = migration.state;
            this.save(finalState);

            return { success: true, state: finalState };
        } catch (e) {
            console.error("[SaveService] Import-Fehler:", e);
            return { success: false, error: `Syntaxfehler beim Einlesen: ${e.message}` };
        }
    }
};

if (typeof window !== "undefined") {
    window.SaveService = SaveService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SaveService };
}
