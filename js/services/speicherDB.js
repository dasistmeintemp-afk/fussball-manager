/**
 * SpeicherDB - Der Spielstand liegt in IndexedDB statt im LocalStorage
 *
 * Der LocalStorage fasst je nach Browser fünf bis zehn Megabyte, und das
 * für die ganze Seite. Eine Welt mit zwölf Ligen, Länderspielen, Analysen
 * und mehreren Saisons Geschichte kommt dieser Grenze trotz Verdichtung
 * nahe. IndexedDB kennt diese Grenze nicht: Der Browser gibt einer Seite
 * dort einen Anteil am freien Plattenplatz, meist mehrere hundert Megabyte.
 *
 * Diese Hülle hält eine einzige Verbindung offen. Das ist wichtig für das
 * Schließen der Seite: Ein Schreibvorgang, der erst noch die Datenbank
 * öffnen müsste, käme dann zu spät. Mit offener Verbindung wird der
 * Spielstand noch im selben Augenblick übergeben und mit `commit()`
 * abgeschickt.
 *
 * Gibt es kein IndexedDB (alter Browser, manche private Fenster), bleibt
 * alles beim LocalStorage - das erledigt GameState.
 */

const SpeicherDB = {
    NAME: "fussballManager",
    STORE: "spielstaende",
    VERSION: 1,

    _db: null,
    _oeffnen: null,
    _kaputt: false,

    verfuegbar() {
        if (this._kaputt) return false;
        try {
            return typeof indexedDB !== "undefined" && indexedDB !== null && typeof indexedDB.open === "function";
        } catch (e) {
            // Firefox wirft hier in manchen Datenschutz-Einstellungen
            return false;
        }
    },

    /** Die Verbindung - beim ersten Aufruf geöffnet, danach wiederverwendet */
    oeffne() {
        if (this._db) return Promise.resolve(this._db);
        if (this._oeffnen) return this._oeffnen;
        if (!this.verfuegbar()) return Promise.reject(new Error("IndexedDB ist nicht verfügbar."));

        this._oeffnen = new Promise((resolve, reject) => {
            let anfrage;
            try {
                anfrage = indexedDB.open(this.NAME, this.VERSION);
            } catch (e) {
                reject(e);
                return;
            }
            anfrage.onupgradeneeded = () => {
                const db = anfrage.result;
                if (!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE);
            };
            anfrage.onsuccess = () => {
                const db = anfrage.result;
                // Öffnet ein anderer Tab eine neuere Version, gibt dieser nach
                db.onversionchange = () => { db.close(); this._db = null; this._oeffnen = null; };
                db.onclose = () => { this._db = null; this._oeffnen = null; };
                this._db = db;
                resolve(db);
            };
            anfrage.onerror = () => reject(anfrage.error || new Error("IndexedDB ließ sich nicht öffnen."));
            anfrage.onblocked = () => reject(new Error("IndexedDB ist durch einen anderen Tab blockiert."));
        }).catch(e => {
            this._oeffnen = null;
            this._kaputt = true;
            throw e;
        });
        return this._oeffnen;
    },

    /** Ist die Verbindung schon offen? Dann kann synchron übergeben werden. */
    bereit() {
        return !!this._db;
    },

    lies(schluessel) {
        return this.oeffne().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(this.STORE, "readonly");
            const anfrage = tx.objectStore(this.STORE).get(schluessel);
            anfrage.onsuccess = () => resolve(anfrage.result === undefined ? null : anfrage.result);
            anfrage.onerror = () => reject(anfrage.error);
        }));
    },

    /**
     * Schreibt einen Wert. Ist die Verbindung offen, geht der Wert noch in
     * diesem Aufruf an den Browser - das zählt beim Schließen der Seite.
     */
    schreibe(schluessel, wert) {
        return this.schreibeMehrere({ [schluessel]: wert }, []);
    },

    /**
     * Mehrere Werte schreiben und Schlüssel löschen - in einem Vorgang:
     * Entweder kommt alles an oder nichts. So passen Spielstand, Sicherung
     * und Verzeichnis immer zueinander.
     */
    schreibeMehrere(eintraege, loeschen = []) {
        if (this._db) return this._schreibeMit(this._db, eintraege, loeschen);
        return this.oeffne().then(db => this._schreibeMit(db, eintraege, loeschen));
    },

    _schreibeMit(db, eintraege, loeschen) {
        return new Promise((resolve, reject) => {
            let tx;
            try {
                tx = db.transaction(this.STORE, "readwrite");
                const store = tx.objectStore(this.STORE);
                Object.keys(eintraege || {}).forEach(k => store.put(eintraege[k], k));
                (loeschen || []).forEach(k => store.delete(k));
            } catch (e) {
                reject(e);
                return;
            }
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error || new Error("Schreiben in IndexedDB fehlgeschlagen."));
            tx.onabort = () => reject(tx.error || new Error("Schreiben in IndexedDB abgebrochen."));
            // Nicht auf das Ende des Skripts warten - sofort abschicken
            if (typeof tx.commit === "function") {
                try { tx.commit(); } catch (e) { /* schon abgeschickt */ }
            }
        });
    },

    loesche(schluessel) {
        return this.schreibeMehrere({}, [schluessel]);
    },

    /** Alle belegten Schlüssel - zum Aufräumen verwaister Sicherungen */
    schluessel() {
        return this.oeffne().then(db => new Promise((resolve, reject) => {
            const anfrage = db.transaction(this.STORE, "readonly").objectStore(this.STORE).getAllKeys();
            anfrage.onsuccess = () => resolve(anfrage.result || []);
            anfrage.onerror = () => reject(anfrage.error);
        }));
    },

    /**
     * Den Browser bitten, die Daten nicht bei Platzmangel zu räumen. Ohne
     * diese Bitte darf er eine selten besuchte Seite aufräumen.
     */
    bitteUmDauerhaftenSpeicher() {
        try {
            if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.persist === "function") {
                return navigator.storage.persisted()
                    .then(schon => schon || navigator.storage.persist())
                    .catch(() => false);
            }
        } catch (e) { /* ohne Storage-API */ }
        return Promise.resolve(false);
    },

    /** Belegter und verfügbarer Platz in Bytes, soweit der Browser es verrät */
    platz() {
        try {
            if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.estimate === "function") {
                return navigator.storage.estimate().then(s => ({ belegt: s.usage || 0, frei: s.quota || 0 })).catch(() => null);
            }
        } catch (e) { /* ohne Storage-API */ }
        return Promise.resolve(null);
    }
};

if (typeof window !== "undefined") {
    window.SpeicherDB = SpeicherDB;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SpeicherDB };
}
