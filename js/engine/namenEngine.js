/**
 * NamenEngine - Erfundene Namen als Standard, eigene Namen aus einer Datei
 *
 * Vereine, Stadien, Sponsoren, die Spieler der ersten deutschen Liga und die
 * Wettbewerbe tragen erfundene Namen. Wer lieber mit anderen Namen spielt,
 * lädt in den Einstellungen eine Namensdatei (JSON). Sie ordnet Kennungen
 * Namen zu und gilt für neue Karrieren wie für die laufende:
 *
 *   {
 *     "format": "fmpro-namen-1",
 *     "titel": "Meine Namen",
 *     "wettbewerbe": { "de_liga_1": "…", "de_cup": "…", "supercup_de": "…", "ucl": "…" },
 *     "vereine": { "muc": { "name": "…", "stadion": "…", "sponsor": "…" } },
 *     "spieler": { "1": "…", "2": "…" }
 *   }
 *
 * Die Spielerkennungen 1 bis 290 sind die handgepflegten Kader der ersten
 * deutschen Liga in der Reihenfolge der Datendatei. Jeder Eintrag ist
 * freiwillig; was fehlt, behält seinen erfundenen Namen. Eine Vorlage mit
 * allen Kennungen und den erfundenen Namen lässt sich herunterladen.
 *
 * Die Datei liegt nur im Browser des Spielers. Mit dem Spiel selbst kommen
 * keine echten Namen.
 */

const NamenEngine = {
    FORMAT: "fmpro-namen-1",
    SPEICHER: "fmpro_namenspaket",
    MAX_LAENGE: 60,

    /** Erfundene Namen der Wettbewerbe */
    WETTBEWERBE: {
        de_liga_1: "1. Liga", de_liga_2: "2. Liga", de_liga_3: "3. Liga",
        en_liga_1: "Premier Division", en_liga_2: "First Division", en_liga_3: "Second Division",
        es_liga_1: "Primera División", es_liga_2: "Segunda División", es_liga_3: "Tercera División",
        it_liga_1: "Prima Divisione", it_liga_2: "Seconda Divisione", it_liga_3: "Terza Divisione",
        fr_liga_1: "Première Division", fr_liga_2: "Deuxième Division", fr_liga_3: "National",
        de_cup: "Deutschlandpokal", en_cup: "National Cup", es_cup: "Copa Nacional", it_cup: "Coppa Nazionale", fr_cup: "Coupe Nationale",
        supercup_de: "Supercup", supercup_en: "Super Cup", supercup_es: "Supercopa Nacional", supercup_it: "Supercoppa Nazionale", supercup_fr: "Supercoupe",
        ucl: "Meisterpokal", uel: "Kontinentalpokal", uecl: "Euro-Cup",
        nl_cup: "Nationale Beker", pt_cup: "Taça Nacional", be_cup: "Beker van het Land", tr_cup: "Ulusal Kupa",
        at_cup: "Österreichischer Landespokal", ch_cup: "Schweizer Landespokal", sc_cup: "Scottish National Cup", br_cup: "Copa Nacional do Brasil",
        nl_liga_1: "Hoofdklasse", pt_liga_1: "Primeira Divisão", be_liga_1: "Eerste Klasse", tr_liga_1: "Birinci Lig",
        at_liga_1: "Liga Österreich", ch_liga_1: "Nationalliga", sc_liga_1: "Scottish Division", br_liga_1: "Série Nacional",
        nl_liga_2: "Eerste Divisie", pt_liga_2: "Segunda Divisão", be_liga_2: "Tweede Klasse", tr_liga_2: "İkinci Lig",
        at_liga_2: "2. Liga Österreich", ch_liga_2: "Nationalliga B", sc_liga_2: "Scottish Second Division", br_liga_2: "Série Nacional B"
    },

    /** Erfundene Hauptsponsoren der ersten deutschen Liga, in der Reihenfolge der Vereine */
    SPONSOREN: ["Nordlicht Telekom", "Kranich Versicherungen", "Brückner Chemie", "Weidmann Software", "Altmark Energie",
        "Sternwagen Automobile", "Falkenberg Motoren", "Wildquell Getränke", "Gutshof Geflügel", "Rheintal Rück", "Mainstrom Werke",
        "Hochwald Molkerei", "Polymer Werke Ost", "Hanse Assekuranz", "Isar Fahrzeugbau", "Puls Sportartikel", "Dreistreif Sport", "Global Tech"],

    _paket: undefined,
    _standard: null,

    _daten() {
        const g = (name, pfad) => {
            if (typeof window !== "undefined" && window[name]) return window[name];
            if (typeof require !== "undefined") { try { return require(pfad)[name]; } catch (e) { return null; } }
            return null;
        };
        return {
            teams: g("INITIAL_TEAMS_DATA", "../data/initialData.js") || [],
            vereine: g("REAL_CLUBS_BY_LEAGUE", "../data/realClubs.js") || {},
            ligen: g("LEAGUES_DATA", "../data/leagueData.js") || [],
            wettbewerbe: g("COMPETITIONS_DATA", "../data/leagueData.js") || []
        };
    },

    _speicher() {
        try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (e) { return null; }
    },

    /** Die erfundenen Namen, wie sie mit dem Spiel kommen - als Namensdatei */
    standard() {
        if (this._standard) return this._standard;
        const d = this._daten();
        const p = { format: this.FORMAT, titel: "Erfundene Namen", wettbewerbe: Object.assign({}, this.WETTBEWERBE), vereine: {}, spieler: {} };
        let pid = 1;
        d.teams.forEach((c, i) => {
            p.vereine[c.id] = { name: c.name, stadion: c.stadium, sponsor: c.sponsor || this.SPONSOREN[i % this.SPONSOREN.length] };
            (c.players || []).forEach(s => { p.spieler[String(pid++)] = s.name; });
        });
        Object.values(d.vereine).forEach(liste => (liste || []).forEach(c => { p.vereine[c.id] = { name: c.name, stadion: c.stadium }; }));
        this._standard = p;
        return p;
    },

    /** Die geladene Namensdatei oder null */
    paket() {
        if (this._paket !== undefined) return this._paket;
        this._paket = null;
        const sp = this._speicher();
        if (sp) {
            try { const t = sp.getItem(this.SPEICHER); if (t) this._paket = this.pruefe(JSON.parse(t)).paket; } catch (e) { this._paket = null; }
        }
        return this._paket;
    },

    /** Name eines Wettbewerbs: aus der Namensdatei, sonst der erfundene */
    wettbewerb(id) {
        const p = this.paket();
        return (p && p.wettbewerbe && p.wettbewerbe[id]) || this.WETTBEWERBE[id] || id;
    },

    _text(wert) {
        if (typeof wert !== "string") return null;
        const t = wert.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
        return t ? t.slice(0, this.MAX_LAENGE) : null;
    },

    /**
     * Prüft eine Namensdatei und gibt eine bereinigte Fassung zurück:
     * { ok, fehler, paket, zahlen }. Unbekannte Felder fallen weg, Namen
     * werden gekürzt und von spitzen Klammern befreit.
     */
    pruefe(roh) {
        const fehler = [];
        if (!roh || typeof roh !== "object" || Array.isArray(roh)) return { ok: false, fehler: ["Die Datei enthält kein Namensobjekt."], paket: null, zahlen: {} };
        if (roh.format !== this.FORMAT) fehler.push(`Unbekanntes Format "${roh.format || "-"}" (erwartet "${this.FORMAT}").`);
        const paket = { format: this.FORMAT, titel: this._text(roh.titel) || "Eigene Namen", wettbewerbe: {}, vereine: {}, spieler: {} };
        Object.entries(roh.wettbewerbe || {}).forEach(([id, n]) => { const t = this._text(n); if (t && this.WETTBEWERBE[id]) paket.wettbewerbe[id] = t; });
        Object.entries(roh.vereine || {}).forEach(([id, v]) => {
            if (!v || typeof v !== "object") return;
            const e = {};
            ["name", "stadion", "sponsor"].forEach(k => { const t = this._text(v[k]); if (t) e[k] = t; });
            if (Object.keys(e).length) paket.vereine[String(id)] = e;
        });
        Object.entries(roh.spieler || {}).forEach(([id, n]) => { const t = this._text(n); if (t && /^\d+$/.test(id)) paket.spieler[id] = t; });
        const zahlen = { wettbewerbe: Object.keys(paket.wettbewerbe).length, vereine: Object.keys(paket.vereine).length, spieler: Object.keys(paket.spieler).length };
        if (!zahlen.wettbewerbe && !zahlen.vereine && !zahlen.spieler) fehler.push("Die Datei enthält keine Namen.");
        return { ok: fehler.length === 0, fehler, paket: fehler.length ? null : paket, zahlen };
    },

    /** Namen in die Spieldaten setzen - für den Assistenten und neue Karrieren */
    patcheDaten(paket) {
        const d = this._daten();
        const basis = this.standard();
        const voll = this._mitStandard(paket);
        let pid = 1;
        d.teams.forEach(c => {
            const v = voll.vereine[c.id] || {};
            if (v.name) c.name = v.name;
            if (v.stadion) c.stadium = v.stadion;
            c.sponsor = v.sponsor || basis.vereine[c.id]?.sponsor || null;
            (c.players || []).forEach(s => { const n = voll.spieler[String(pid++)]; if (n) s.name = n; });
        });
        Object.values(d.vereine).forEach(liste => (liste || []).forEach(c => {
            const v = voll.vereine[c.id] || {};
            if (v.name) c.name = v.name;
            if (v.stadion) c.stadium = v.stadion;
        }));
        d.ligen.forEach(l => { if (voll.wettbewerbe[l.id]) l.shortName = voll.wettbewerbe[l.id]; });
        d.wettbewerbe.forEach(w => { if (voll.wettbewerbe[w.id]) { w.name = voll.wettbewerbe[w.id]; w.shortName = voll.wettbewerbe[w.id]; } });
    },

    /** Eine Namensdatei, ergänzt um die erfundenen Namen für alles, was sie nicht nennt */
    _mitStandard(paket) {
        const s = this.standard();
        if (!paket) return s;
        const vereine = {};
        Object.keys(s.vereine).forEach(id => { vereine[id] = Object.assign({}, s.vereine[id], paket.vereine[id] || {}); });
        return {
            wettbewerbe: Object.assign({}, s.wettbewerbe, paket.wettbewerbe),
            vereine,
            spieler: Object.assign({}, s.spieler, paket.spieler)
        };
    },

    /**
     * Namen in einer laufenden Karriere setzen: Ligen, Pokale, Europapokal,
     * Vereine, Stadien, Sponsoren und die Spieler der Startkader. Ältere
     * Nachrichten behalten den Namen, unter dem sie geschrieben wurden.
     *
     * Einen Sponsor benennt sie nur um, solange es noch der vom Spielstart
     * ist (erfunden, aus der vorigen Namensdatei oder zuletzt hier gesetzt) -
     * ein später neu abgeschlossener Vertrag bleibt, wie er ist.
     */
    wendeAn(state, paket = this.paket(), vorher = null) {
        if (!state) return { vereine: 0, spieler: 0, wettbewerbe: 0 };
        const voll = this._mitStandard(paket);
        const zahl = { vereine: 0, spieler: 0, wettbewerbe: 0 };
        const setze = (ziel, feld, wert) => { if (wert && ziel[feld] !== wert) { ziel[feld] = wert; return true; } return false; };
        (state.leagues || []).forEach(l => { if (setze(l, "shortName", voll.wettbewerbe[l.id])) zahl.wettbewerbe++; });
        (state.competitions || []).forEach(w => { if (voll.wettbewerbe[w.id]) { w.name = voll.wettbewerbe[w.id]; if (setze(w, "shortName", voll.wettbewerbe[w.id])) zahl.wettbewerbe++; } });
        const eigenesLand = ((state.clubs || []).find(c => c.id === state.userClubId) || {}).countryId || "de";
        Object.entries(state.cups || {}).forEach(([id, cup]) => {
            const schluessel = cup && cup.land ? `${cup.land}_cup` : (id === "de_cup" ? `${eigenesLand}_cup` : id);
            if (cup && setze(cup, "name", voll.wettbewerbe[schluessel])) zahl.wettbewerbe++;
        });
        ["ucl", "uel", "uecl"].forEach(id => { const w = state.europeanCompetitions && state.europeanCompetitions[id]; if (w && setze(w, "name", voll.wettbewerbe[id])) zahl.wettbewerbe++; });
        const basis = this.standard();
        if (!state.namenSponsoren || typeof state.namenSponsoren !== "object") state.namenSponsoren = {};
        (state.clubs || []).forEach(c => {
            const v = voll.vereine[c.id];
            if (!v) return;
            let geaendert = setze(c, "name", v.name);
            geaendert = setze(c, "stadium", v.stadion) || geaendert;
            if (v.sponsor && c.sponsor && typeof c.sponsor === "object") {
                const bekannt = [basis.vereine[c.id]?.sponsor, vorher?.vereine?.[c.id]?.sponsor, state.namenSponsoren[c.id]];
                if (bekannt.includes(c.sponsor.name)) geaendert = setze(c.sponsor, "name", v.sponsor) || geaendert;
                if (c.sponsor.name === v.sponsor) state.namenSponsoren[c.id] = v.sponsor;
            }
            if (geaendert) zahl.vereine++;
        });
        const nachId = new Map((state.players || []).map(p => [String(p.id), p]));
        Object.entries(voll.spieler).forEach(([id, n]) => { const p = nachId.get(id); if (p && setze(p, "name", n)) zahl.spieler++; });
        const liga = (state.leagues || []).find(l => l.id === state.userLeagueId);
        if (liga) state.leagueName = liga.shortName || liga.name;
        return zahl;
    },

    /** Eine Namensdatei übernehmen. Gibt { ok, fehler, zahlen } zurück. */
    installiere(text) {
        let roh;
        try { roh = typeof text === "string" ? JSON.parse(text) : text; } catch (e) { return { ok: false, fehler: ["Die Datei ist kein gültiges JSON."], zahlen: {} }; }
        const r = this.pruefe(roh);
        if (!r.ok) return r;
        const sp = this._speicher();
        if (sp) { try { sp.setItem(this.SPEICHER, JSON.stringify(r.paket)); } catch (e) { return { ok: false, fehler: ["Die Namensdatei ließ sich nicht im Browser speichern."], zahlen: r.zahlen }; } }
        this._paket = r.paket;
        this.patcheDaten(r.paket);
        return r;
    },

    /** Zurück zu den erfundenen Namen */
    entferne() {
        const sp = this._speicher();
        if (sp) { try { sp.removeItem(this.SPEICHER); } catch (e) { /* nichts gespeichert */ } }
        this._paket = null;
        this.patcheDaten(null);
    },

    /** Die Vorlage: alle Kennungen mit den erfundenen Namen, zum Bearbeiten */
    vorlage() {
        const s = this.standard();
        return JSON.stringify(Object.assign({}, s, { titel: "Vorlage - Namen hier eintragen" }), null, 1);
    }
};

// Die erfundenen Namen festhalten, bevor eine Namensdatei sie überschreibt -
// dann eine gespeicherte Namensdatei in die Spieldaten setzen
NamenEngine.standard();
if (NamenEngine.paket()) NamenEngine.patcheDaten(NamenEngine.paket());

if (typeof window !== "undefined") {
    window.NamenEngine = NamenEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { NamenEngine };
}
