/**
 * SpielWerk - Das eigene Spiel im Hintergrund rechnen (Web Worker)
 *
 * Seit Stufe 3 der 2D-Simulation rechnet jedes eigene Spiel das 2D-Modell,
 * auch wenn niemand zuschaut - im Urlaub etwa. Ein Spiel dauert so zwei bis
 * drei Sekunden, und so lange stand die Oberfläche still: 21 Tage Urlaub
 * waren gemessen ein einziger Block von fast zwölf Sekunden.
 *
 * Jetzt rechnet ein Web Worker das Spiel - derselbe Code, nur in einem
 * eigenen Faden. Hin geht ein Paket mit allem, was die Partie braucht (das
 * Spiel, beide Vereine, ihre Spieler, die Uhr fürs Einspielen), zurück kommt
 * dasselbe nach dem Abpfiff. Es wird in die Objekte des Spielstands
 * übernommen, bevor der Kalender den Tag abschließt. Der findet die Partie
 * gespielt vor und macht weiter wie immer: Tabelle, Finanzen, Kabine,
 * Spielbericht.
 *
 * Der Worker lädt dieselben Skripte wie die Seite, nur ohne die Oberfläche:
 * über das Netz, wenn die Seite von einem Server kommt, sonst aus den in die
 * Einzeldatei eingebetteten Skripten (data-quelle). Geht etwas schief - kein
 * Worker, eine per file:// geöffnete Seite, ein Fehler im Worker -, rechnet
 * das Spiel wie bisher auf der Seite selbst.
 */

const _swResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

/**
 * Der Worker selbst. Er läuft als eigenes Skript, deshalb steht hier nur,
 * was vor dem Laden der Engine nötig ist: window zeigt auf den Worker, damit
 * sich die Module dort genauso anmelden wie auf der Seite.
 */
function _spielWerkKern() {
    self.window = self;
    self.onmessage = function (e) {
        const d = e.data || {};
        if (d.art === "laden") {
            try {
                importScripts.apply(self, d.urls);
                self.postMessage({ art: "bereit" });
            } catch (err) {
                self.postMessage({ art: "fehler", text: String((err && err.message) || err) });
            }
            return;
        }
        if (d.art === "spiel") {
            try {
                self.postMessage({ art: "ergebnis", id: d.id, antwort: self.SpielWerk.rechne(d.paket) });
            } catch (err) {
                self.postMessage({ art: "fehler", id: d.id, text: String((err && err.stack) || err) });
            }
        }
    };
}

const SpielWerk = {
    /** Was der Worker lädt: alles außer der Oberfläche */
    QUELLEN: /^(?:\.\/)?js\/(?:core|data|services|engine)\//,
    /** Länger darf ein Spiel im Hintergrund nicht brauchen, dann rechnet die Seite (ms) */
    HOECHSTENS_MS: 30000,
    /** Nach so langer Ruhe gibt der Worker seinen Speicher frei (ms) */
    RUHE_MS: 90000,

    _worker: null,
    _bereit: null,
    _kaputt: false,
    _quellen: undefined,
    _skript: null,
    _auftraege: new Map(),
    _naechste: 1,
    _ruhe: null,

    /** Lässt sich im Hintergrund rechnen? Nur im Browser und mit ladbaren Skripten. */
    verfuegbar() {
        if (this._kaputt) return false;
        if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined"
            || typeof URL.createObjectURL !== "function" || typeof document === "undefined"
            || typeof document.querySelectorAll !== "function") return false;
        return this.quellen(document) !== null;
    },

    /**
     * Die Skripte für den Worker in der Reihenfolge der Seite: als Adresse
     * (vom Server) oder als Text (eingebettet in die Einzeldatei). null, wenn
     * eines nicht ladbar ist - aus einer per file:// geöffneten Seite darf ein
     * Worker keine Dateien nachladen.
     */
    quellen(doc) {
        if (this._quellen !== undefined) return this._quellen;
        const liste = [];
        let ladbar = true;
        Array.from(doc.querySelectorAll("script")).forEach(s => {
            const src = s.getAttribute("src");
            const pfad = s.getAttribute("data-quelle") || src || "";
            if (!this.QUELLEN.test(pfad)) return;
            if (src) {
                if (!/^https?:/i.test(s.src || "")) ladbar = false;
                liste.push({ pfad, url: s.src });
            } else {
                liste.push({ pfad, text: s.textContent || "" });
            }
        });
        const vollstaendig = liste.some(q => /matchEngine\.js$/.test(q.pfad)) && liste.some(q => /spielWerk\.js$/.test(q.pfad));
        this._quellen = ladbar && vollstaendig ? liste : null;
        return this._quellen;
    },

    _blob(text) {
        return URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
    },

    /**
     * Das Skript des Workers. Vom Server lädt er die Engine nach
     * (importScripts). Aus der Einzeldatei steckt sie gleich mit drin: Eine
     * per file:// geöffnete Seite darf dem Worker keine einzelnen Adressen
     * zum Nachladen geben, ein einziges Skript schon. Die Skripte stehen
     * hintereinander wie auf der Seite - doppelte globale Namen gibt es
     * nicht (pruefung.js).
     */
    _workerSkript(quellen) {
        const kern = `(${_spielWerkKern.toString()})();`;
        if (quellen.every(q => q.url)) return { text: kern, urls: quellen.map(q => q.url) };
        return { text: [kern, ...quellen.map(q => q.text), "self.postMessage({ art: \"bereit\" });"].join("\n;\n"), urls: null };
    },

    /** Den Worker starten und die Engine laden lassen - einmal, dann bleibt er bereit */
    _starte() {
        if (this._bereit) return this._bereit;
        const quellen = this.quellen(document);
        if (!quellen) return Promise.reject(new Error("Skripte nicht ladbar"));
        // Einmal gebaut, auch für einen Neustart nach der Ruhepause
        if (!this._skript) {
            const s = this._workerSkript(quellen);
            this._skript = { url: this._blob(s.text), urls: s.urls };
        }
        let worker;
        try {
            worker = new Worker(this._skript.url);
        } catch (e) {
            return Promise.reject(e);
        }
        this._worker = worker;
        this._bereit = new Promise((resolve, reject) => {
            this._laden = { resolve, reject };
            this._ladeUhr = setTimeout(() => this._abbruch("Laden dauert zu lange"), this.HOECHSTENS_MS);
        });
        worker.onmessage = (e) => this._antwort(e.data || {});
        worker.onerror = (e) => {
            if (e && typeof e.preventDefault === "function") e.preventDefault();
            this._abbruch((e && e.message) || "Fehler im Worker");
        };
        if (this._skript.urls) worker.postMessage({ art: "laden", urls: this._skript.urls });
        return this._bereit;
    },

    _antwort(d) {
        if (d.art === "bereit") {
            clearTimeout(this._ladeUhr);
            if (this._laden) this._laden.resolve(true);
            this._laden = null;
            return;
        }
        const auftrag = d.id !== undefined ? this._auftraege.get(d.id) : null;
        if (!auftrag) {
            if (d.art === "fehler") this._abbruch(d.text);
            return;
        }
        this._auftraege.delete(d.id);
        clearTimeout(auftrag.uhr);
        if (d.art === "ergebnis") {
            auftrag.resolve(d.antwort);
            this._ruheStellen();
        } else {
            auftrag.reject(new Error(d.text || "Fehler im Worker"));
            this._abbruch(d.text);
        }
    },

    /**
     * Etwas ging schief: Der Worker hört auf, und für den Rest der Sitzung
     * rechnet wieder die Seite selbst - lieber langsamer als falsch.
     */
    _abbruch(grund) {
        if (typeof console !== "undefined") console.warn("[SpielWerk] Hintergrund aus, die Seite rechnet selbst:", grund);
        this._kaputt = true;
        clearTimeout(this._ladeUhr);
        if (this._laden) this._laden.reject(new Error(grund || "Abbruch"));
        this._laden = null;
        this._auftraege.forEach(a => { clearTimeout(a.uhr); a.reject(new Error(grund || "Abbruch")); });
        this._auftraege.clear();
        this.beende();
    },

    _ruheStellen() {
        clearTimeout(this._ruhe);
        if (this._auftraege.size > 0) return;
        this._ruhe = setTimeout(() => { if (this._auftraege.size === 0) this.beende(); }, this.RUHE_MS);
    },

    /** Den Worker beenden (er startet beim nächsten Spiel neu) */
    beende() {
        clearTimeout(this._ruhe);
        if (this._worker) {
            try { this._worker.terminate(); } catch (e) { /* schon beendet */ }
        }
        this._worker = null;
        this._bereit = null;
    },

    /** Ein Paket im Worker rechnen lassen. Liefert ein Promise mit der Antwort. */
    imHintergrund(paket) {
        return this._starte().then(() => new Promise((resolve, reject) => {
            clearTimeout(this._ruhe);
            const id = this._naechste++;
            const uhr = setTimeout(() => {
                if (!this._auftraege.has(id)) return;
                this._auftraege.delete(id);
                reject(new Error("Zeitüberschreitung"));
                this._abbruch("Spiel dauert zu lange");
            }, this.HOECHSTENS_MS);
            this._auftraege.set(id, { resolve, reject, uhr });
            this._worker.postMessage({ art: "spiel", id, paket });
        }));
    },

    /**
     * Was die Partie braucht: das Spiel, beide Vereine und alle ihre Spieler.
     * Das Paket hält die Objekte des Spielstands - kopiert wird beim Senden.
     */
    paket(state, match, heim, gast, optionen = {}) {
        const ids = new Set();
        [heim, gast].forEach(c => ["playerIds", "lineup", "bench"].forEach(k => (c[k] || []).forEach(id => ids.add(String(id)))));
        const vereine = new Set([heim.id, gast.id]);
        const spieler = (state.players || []).filter(p => p && (vereine.has(p.clubId) || ids.has(String(p.id))));
        return {
            match, heim, gast, spieler,
            uhr: { seasonYear: state.seasonYear, currentDayIndex: state.currentDayIndex },
            optionen: { userSide: optionen.userSide || null, matchplan: optionen.matchplan || null },
            ...(typeof optionen.seed === "number" ? { seed: optionen.seed } : {})
        };
    },

    /**
     * Ein Paket rechnen - im Worker, und unter Node für die Prüfung. Exakt
     * der Weg des Hauptfadens (MatchEngine.spieleOhneBild); mit seed läuft
     * der Zufall fest, damit sich beide Wege vergleichen lassen.
     */
    rechne(paket) {
        const ME = _swResolve("MatchEngine", "./matchEngine.js");
        const T = _swResolve("TacticsEngine", "./tacticsEngine.js");
        const { match, heim, gast, spieler } = paket;
        // Die Uhr fürs Einspielen, wie der Kalender sie stellt - für diese beiden Vereine
        const vorher = T ? { uhr: T.uhr, lager: T.lager, stand: T._lagerStand } : null;
        if (T && typeof T.stelleUhr === "function") T.stelleUhr({ ...(paket.uhr || {}), clubs: [heim, gast] });
        const zufall = Math.random;
        if (typeof paket.seed === "number") Math.random = this.zufall(paket.seed);
        try {
            ME.spieleOhneBild(match, heim, gast, spieler, paket.optionen || {});
        } finally {
            Math.random = zufall;
            if (vorher) { T.uhr = vorher.uhr; T.lager = vorher.lager; T._lagerStand = vorher.stand; }
        }
        return { match, heim, gast, spieler };
    },

    /** Fester Zufall für den Abgleich (mulberry32) */
    zufall(seed) {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    /**
     * Den Rückweg übernehmen: Die Objekte des Spielstands bleiben dieselben
     * (die Runde, die Kaderlisten, alles, was auf sie zeigt), nur ihr Inhalt
     * ist der nach dem Abpfiff.
     */
    uebernehmen(antwort, ziele) {
        const ersetze = (alt, neu) => {
            if (!alt || !neu || typeof alt !== "object") return;
            Object.keys(alt).forEach(k => { if (!(k in neu)) delete alt[k]; });
            Object.assign(alt, neu);
        };
        ersetze(ziele.match, antwort.match);
        ersetze(ziele.heim, antwort.heim);
        ersetze(ziele.gast, antwort.gast);
        const nachId = new Map((ziele.spieler || []).map(p => [String(p.id), p]));
        (antwort.spieler || []).forEach(p => ersetze(nachId.get(String(p.id)), p));
    },

    /**
     * Das eigene Spiel des Tages vorab im Hintergrund rechnen - bevor der
     * Kalender den Tag abschließt: das Ligaspiel am Spieltag, die Partie am
     * Pokal- oder Europapokalabend und das Testspiel der Vorbereitung.
     * Vorbereitet wird es wie im Kalender (Meldeliste, Matchplan), und was
     * nach dem Abpfiff kommt (Elfmeterschießen, Prämien, Chronik), läuft
     * danach über denselben Weg wie sonst.
     *
     * Liefert ein Promise (true: im Hintergrund gespielt) oder null, wenn
     * heute nichts im Hintergrund zu rechnen ist. rechner ersetzt in der
     * Prüfung den Worker.
     */
    vorab(state, heute, rechner = (paket) => this.imHintergrund(paket)) {
        const termin = this.vorbereiten(state, heute);
        if (!termin) return null;
        let gesendet;
        try {
            gesendet = rechner(termin.paket);
        } catch (e) {
            return null;
        }
        const fertig = Promise.resolve(gesendet).then(antwort => this.fertigstellen(termin, antwort), () => false);
        // Für die Ladeanzeige: wer gerade spielt
        fertig.titel = `${termin.heim.name || ""} – ${termin.gast.name || ""}`;
        return fertig;
    },

    /** Was heute im Hintergrund zu rechnen ist, vorbereitet wie im Kalender - oder null */
    vorbereiten(state, heute) {
        if (!state || !heute || heute.completed) return null;
        const ME = _swResolve("MatchEngine", "./matchEngine.js");
        if (!ME || !ME.EIGENES_SPIEL_2D) return null;
        const termin = heute.type === "friendly" ? this._testspiel(state, heute)
            : (heute.type === "matchday" ? this._ligaspiel(state, heute)
                : (heute.type === "cup" || heute.type === "euro" ? this._pokalspiel(state, heute) : null));
        if (!termin) return null;
        const T = _swResolve("TacticsEngine", "./tacticsEngine.js");
        if (T && typeof T.stelleUhr === "function") T.stelleUhr(state);
        termin.paket = this.paket(state, termin.match, termin.heim, termin.gast, termin.optionen);
        return termin;
    },

    /** Die Antwort übernehmen und abschließen, was nach dem Abpfiff kommt. true: gespielt. */
    fertigstellen(termin, antwort) {
        // Inzwischen anders gespielt (die Seite war schneller): nichts überschreiben
        if (!antwort || termin.match.played) return false;
        this.uebernehmen(antwort, termin.paket);
        if (!termin.match.played) return false;
        termin.danach();
        return true;
    },

    /** Am Spieltag: das eigene Ligaspiel, vorbereitet wie im Kalender (Meldeliste, Matchplan) */
    _ligaspiel(state, heute) {
        // In der Länderspielpause ändert der Morgen noch den Kader - dort rechnet der Tag selbst
        if (heute.laenderspiel) return null;
        const runde = (state.schedule || []).find(r => r.matchday === state.currentMatchday);
        const eigen = (m) => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId;
        const match = runde && Array.isArray(runde.matches) ? runde.matches.find(m => !m.played && eigen(m)) : null;
        if (!match) return null;
        const heim = (state.clubs || []).find(c => c.id === match.homeClubId);
        const gast = (state.clubs || []).find(c => c.id === match.awayClubId);
        if (!heim || !gast) return null;
        // Mit dem ersten Spieltag ist die Vorbereitung vorbei - wie am Morgen im Kalender
        const pre = _swResolve("PreseasonEngine", "./preseasonEngine.js");
        if (state.preseason && state.preseason.aktiv && pre && typeof pre.beende === "function") pre.beende(state);
        const eigener = match.homeClubId === state.userClubId ? heim : gast;
        const regeln = _swResolve("KaderregelEngine", "./kaderregelEngine.js");
        if (regeln && typeof regeln.arten === "function" && regeln.arten(state, eigener).includes("liga")) {
            regeln.passeAufstellungAn(state, eigener, "liga");
        }
        const planEngine = _swResolve("MatchplanEngine", "./matchplanEngine.js");
        const plan = planEngine ? planEngine.spielOptionen(state, match) : null;
        return {
            match, heim, gast,
            optionen: { userSide: eigener === heim ? "home" : "away", matchplan: plan },
            danach: () => { if (plan && planEngine) planEngine.abschliessen(state, match); }
        };
    },

    /**
     * Am Pokal- oder Europapokalabend: die eigene Partie, sofern sie schon
     * ausgelost ist. Danach trägt CupEngine.austragen sie aus wie sonst -
     * die Partie ist dann gespielt, es folgen Elfmeterschießen, Prämien,
     * Chronik und Fans; der Abend selbst lässt sie aus (wie nach einem Livespiel).
     */
    _pokalspiel(state, heute) {
        const art = heute.cupArt || (heute.type === "cup" ? "cup" : "euro");
        // Supercups und Relegation entstehen erst am Abend selbst
        if (art !== "cup" && art !== "euro") return null;
        const cup = _swResolve("CupEngine", "./cupEngine.js");
        if (!cup || typeof cup.eigenePartieAm !== "function" || typeof cup.austragen !== "function") return null;
        const runde = heute.cupRunde || 0;
        const eigene = cup.eigenePartieAm(state, art, runde);
        const match = eigene && eigene.partie;
        if (!match || match.played) return null;
        const heim = (state.clubs || []).find(c => c.id === match.homeClubId);
        const gast = (state.clubs || []).find(c => c.id === match.awayClubId);
        if (!heim || !gast) return null;
        const eigener = match.homeClubId === state.userClubId ? heim : gast;
        const regeln = _swResolve("KaderregelEngine", "./kaderregelEngine.js");
        if (regeln && typeof regeln.artVon === "function") regeln.passeAufstellungAn(state, eigener, regeln.artVon(state, eigener, match));
        return {
            match, heim, gast,
            optionen: { userSide: eigener === heim ? "home" : "away" },
            danach: () => cup.austragen(state, match, cup.elfmeterAm(art, runde))
        };
    },

    /** In der Vorbereitung: das Testspiel des Tages, übergeben wie ein live verfolgtes */
    _testspiel(state, heute) {
        const pre = _swResolve("PreseasonEngine", "./preseasonEngine.js");
        if (!pre || !state.preseason || typeof pre.partieFuerSlot !== "function") return null;
        const test = pre.partieFuerSlot(state, heute.friendlyIndex ?? 0);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!test || !test.partie || test.partie.played || !test.gegner || !club) return null;
        const heim = test.heim ? club : test.gegner;
        const gast = test.heim ? test.gegner : club;
        return {
            match: test.partie, heim, gast,
            optionen: { userSide: test.heim ? "home" : "away" },
            danach: () => { state.preseason.livePartie = test.partie; }
        };
    }
};

if (typeof window !== "undefined") {
    window.SpielWerk = SpielWerk;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SpielWerk };
}
