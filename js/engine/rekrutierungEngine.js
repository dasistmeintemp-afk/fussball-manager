/**
 * RekrutierungEngine - was die Rekrutierung des eigenen Vereins auf einen
 * Blick braucht, wie im Vorbild
 *
 *   Wechsel      - die eigenen Zugänge und Abgänge je Saison, mit Ablöse und
 *                  Leihen (TransferEngine.executeTransfer, LoanEngine merken
 *                  sie hier)
 *   Verträge     - Laufzeiten des Kaders in vier Stufen und je Spieler ein
 *                  Rat: Vertrag anbieten, Entscheidung vertagen oder nicht
 *                  verlängern, mit Grund
 *   Klauseln     - Ausstiegsklauseln bei uns und solche, die wir zahlen könnten
 *   Transferbörse
 *     Gesuche    - wir schreiben aus, wen wir suchen (Positionen, Spielzeit,
 *                  Kauf oder Leihe, Alter). Die Vereine der Welt antworten
 *                  in den Tagen danach mit Spielern, die sie abgeben würden;
 *                  der Sportdirektor hebt die passendsten hervor.
 *     Gesuche anderer Vereine - was die übrigen Vereine suchen (aus ihrer
 *                  Kaderplanung). Wer bei uns überzählig ist, lässt sich
 *                  direkt anbieten; der Verein antwortet mit einem Angebot
 *                  oder sagt ab.
 *
 * Kein Zufall bei Antworten und Gesuchen: Was ein Verein sucht und wann er
 * antwortet, folgt aus einer festen Prüfsumme - gleiche Welt, gleiche Antwort.
 */

const _rkResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const RekrutierungEngine = {
    /** Wie viele eigene Wechsel der Spielstand behält */
    WECHSEL_MAX: 120,
    /** Höchstens so viele eigene Gesuche gleichzeitig */
    GESUCHE_MAX: 5,
    /** Ein Gesuch läuft so viele Tage, dann ist es erledigt */
    GESUCH_TAGE: 30,
    /** Antworten kommen frühestens nach einem, spätestens nach sechs Tagen */
    ANTWORT_TAGE: [1, 6],

    POSITIONEN: ["TW", "IV", "LV", "RV", "DM", "ZM", "LM", "RM", "OM", "LA", "RA", "ST"],

    /**
     * Spielzeit, die man einem Neuen verspricht - gemessen am Schnitt der
     * besten 14 im eigenen Kader (niveau): ab bis (jeweils einschließlich).
     */
    SPIELZEIT: {
        egal: { titel: "Egal", ab: -Infinity, bis: Infinity },
        star: { titel: "Star", ab: 3, bis: Infinity },
        stamm: { titel: "Stammspieler", ab: -2, bis: Infinity },
        rotation: { titel: "Rotation", ab: -6, bis: 2 },
        breite: { titel: "Kaderbreite", ab: -Infinity, bis: -3 },
        talent: { titel: "Talent", ab: -Infinity, bis: Infinity, maxAlter: 21 }
    },

    ART: { transfer: "Kauf", leihe: "Leihe", beides: "Kauf oder Leihe" },

    _te() { return _rkResolve("TransferEngine", "./transferEngine.js"); },
    _kp() { return _rkResolve("KaderplanungEngine", "./kaderplanungEngine.js"); },
    _eigener(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },
    _heute(state) { return (state?.seasonYear || 1) * 1000 + (state?.currentDayIndex || 0); },

    _hash(text) {
        let h = 2166136261;
        String(text).split("").forEach(ch => { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; });
        return h >>> 0;
    },

    /** Schnitt der besten 14 eines Vereins (ohne Unterbau) */
    niveau(state, clubId) {
        const besten = (state?.players || []).filter(p => p.clubId === clubId && !p.reserve)
            .map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 14);
        return besten.length ? besten.reduce((s, x) => s + x, 0) / besten.length : 60;
    },

    // ------------------------------------------------------------ Wechsel

    _buch(state) {
        if (!state.rekrutierung) state.rekrutierung = {};
        const r = state.rekrutierung;
        if (!Array.isArray(r.wechsel)) r.wechsel = [];
        if (!Array.isArray(r.gesuche)) r.gesuche = [];
        if (!Array.isArray(r.angeboten)) r.angeboten = [];
        return r;
    },

    /**
     * Einen Wechsel des eigenen Vereins merken. von/zu: die Vereine (null =
     * vereinslos), leihe: nur ausgeliehen.
     */
    merke(state, player, von, zu, fee = 0, leihe = false) {
        if (!state || !player) return;
        const eigen = state.userClubId;
        const art = zu && zu.id === eigen ? "zu" : (von && von.id === eigen ? "ab" : null);
        if (!art) return;
        const anderer = art === "zu" ? von : zu;
        const buch = this._buch(state);
        buch.wechsel.unshift({
            saison: state.seasonYear || 1, tag: state.currentDayIndex || 0, datum: state.currentDate || "",
            art, leihe: !!leihe, pId: player.id, name: player.name, pos: player.pos, alter: player.age,
            vereinId: anderer ? anderer.id : null, verein: anderer ? anderer.name : "vereinslos",
            fee: Math.max(0, Math.round(Number(fee) || 0))
        });
        if (buch.wechsel.length > this.WECHSEL_MAX) buch.wechsel.length = this.WECHSEL_MAX;
    },

    /** Die Wechsel einer Saison: Zugänge, Abgänge, Ausgaben, Einnahmen */
    wechsel(state, saison = state?.seasonYear || 1) {
        const liste = (state?.rekrutierung?.wechsel || []).filter(w => w.saison === saison);
        const zu = liste.filter(w => w.art === "zu"), ab = liste.filter(w => w.art === "ab");
        return {
            saison, zu, ab,
            ausgaben: zu.reduce((s, w) => s + w.fee, 0),
            einnahmen: ab.reduce((s, w) => s + w.fee, 0)
        };
    },

    // ------------------------------------------------------------ Verträge

    /** Monate bis zum Vertragsende (30.06. nach den Restjahren) */
    monateRest(state, player) {
        const heute = String(state?.calendar?.[state?.currentDayIndex || 0]?.date || state?.currentDate || "");
        const m = heute.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        const jahre = Math.max(0, Number(player?.contractYears ?? 0));
        if (!m) return jahre * 12;
        const monat = Number(m[2]), jahr = Number(m[3]);
        const start = Number(String(state?.calendar?.[0]?.date || "").slice(-4)) || jahr;
        const tag = state?.calendar?.[state?.currentDayIndex || 0];
        // Wie UIManager.vertragsEnde: in der Sommerpause ist das laufende Jahr schon abgezogen
        const endJahr = start + (tag?.sommerpause ? 1 : 0) + jahre;
        return Math.max(0, (endJahr - jahr) * 12 + (6 - monat));
    },

    /**
     * Der Kader nach Vertragslaufzeit - und je Spieler ein Rat. Nicht
     * jeder auslaufende Vertrag ist ein Problem: Wer gebraucht wird, bekommt
     * einen Vertrag; wer überzählig oder zu alt ist, nicht; wer noch lange
     * Vertrag hat oder gerade erst unterschrieben hat, kann warten.
     */
    vertraege(state) {
        const club = this._eigener(state);
        if (!club) return null;
        // Die zweite Mannschaft hat Verträge bis 23 - die regelt sie selbst
        const kader = (state.players || []).filter(p => p.clubId === club.id && !(p.leihe && p.leihe.stammvereinId !== club.id) && !(p.zweite && p.reserve));
        const kp = this._kp();
        const analyse = kp && typeof kp.bedarfsAnalyse === "function" ? kp.bedarfsAnalyse(state, club, kader) : null;
        const verlaengern = new Map((analyse?.renewalCandidates || []).map(x => [x.id, x.reason]));
        const verkaufen = new Map((analyse?.sellCandidates || []).map(x => [x.id, x.reason]));
        const niveau = this.niveau(state, club.id);
        const fe = _rkResolve("FinanceEngine", "./financeEngine.js");
        const gehaltsbudget = Math.max(1, club.wageBudget || (fe && typeof fe.gehaltNachRolle === "function" ? fe.gehaltNachRolle(state, club).budget : 1));
        const rang = new Map(kader.slice().sort((a, b) => (b.overall || 0) - (a.overall || 0)).map((p, i) => [p.id, i]));
        const saison = state.seasonYear || 1;
        const stufen = { m6: 0, m12: 0, j2: 0, mehr: 0 };

        const liste = kader.map(p => {
            const monate = this.monateRest(state, p);
            if (monate <= 6) stufen.m6++; else if (monate <= 12) stufen.m12++; else if (monate <= 24) stufen.j2++; else stufen.mehr++;
            const frisch = typeof p.vereinSeit === "number" && Math.floor(p.vereinSeit / 1000) === saison;
            let rat, grund;
            if (p.vorvertrag && p.vorvertrag.clubId !== club.id) { rat = "nicht"; grund = `Hat schon bei ${p.vorvertrag.clubName || "einem anderen Verein"} unterschrieben`; }
            else if (verkaufen.has(p.id)) { rat = "nicht"; grund = verkaufen.get(p.id).replace(/^./, c => c.toUpperCase()); }
            else if (monate > 24) { rat = "vertagen"; grund = "Der Vertrag läuft noch lange"; }
            else if (frisch) { rat = "vertagen"; grund = "Erst kürzlich unterschrieben"; }
            else if (verlaengern.has(p.id)) { rat = "anbieten"; grund = verlaengern.get(p.id).replace(/^./, c => c.toUpperCase()); }
            else if ((p.age || 25) >= 33 && (p.overall || 0) < niveau) { rat = "nicht"; grund = "Zu alt für einen neuen Vertrag"; }
            else if ((p.overall || 0) < niveau - 6 && !((p.age || 25) <= 21 && (p.pot || 0) >= niveau)) { rat = "nicht"; grund = "Nicht gut genug für den Kader"; }
            else if ((rang.get(p.id) ?? 99) < 5) { rat = "anbieten"; grund = "Einer der wichtigsten Spieler"; }
            else if ((p.age || 25) <= 21 && (p.pot || 0) >= niveau) { rat = "anbieten"; grund = "Hat das Zeug zum Stammspieler"; }
            else if (monate <= 12) { rat = "anbieten"; grund = "Wird im Kader gebraucht"; }
            else { rat = "vertagen"; grund = "Noch Zeit bis zur Entscheidung"; }
            return { p, monate, rat, grund, anteil: (p.wage || 0) / gehaltsbudget };
        }).sort((a, b) => a.monate - b.monate || (b.p.overall || 0) - (a.p.overall || 0));

        return {
            anzahl: kader.length, stufen, liste,
            auslaufend: liste.filter(z => z.monate <= 12),
            rat: { anbieten: liste.filter(z => z.rat === "anbieten").length, vertagen: liste.filter(z => z.rat === "vertagen").length, nicht: liste.filter(z => z.rat === "nicht").length }
        };
    },

    // ------------------------------------------------------------ Klauseln

    /**
     * Ausstiegsklauseln: bei uns (für wie viel uns einer verlassen kann) und
     * bei Spielern anderer Vereine, die wir mit dem Transferbudget ziehen
     * könnten. kandidaten: die Spieler, die man überhaupt kennt (sonst alle).
     */
    klauseln(state, kandidaten = null) {
        const club = this._eigener(state);
        const te = this._te();
        if (!club || !te || typeof te.ausstiegsklausel !== "function") return null;
        const eigene = (state.players || []).filter(p => p.clubId === club.id);
        const bei = (p) => te.ausstiegsklausel(state, p);
        const unsere = eigene.map(p => ({ p, betrag: typeof p.ausstiegsklausel === "number" ? p.ausstiegsklausel : (p.klauseln?.mindestAbloese || 0) })).filter(x => x.betrag > 0);
        const budget = Math.max(0, club.transferBudget || 0);
        // Fremde zählen nur, wenn sie erreichbar sind und dem Kader helfen
        // könnten (höchstens 6 unter dem Schnitt der besten 14)
        const niveau = this.niveau(state, club.id);
        const fremde = (kandidaten || state.players || []).filter(p => p.clubId && p.clubId !== club.id
            && (p.overall || 0) >= niveau - 6
            && (typeof te.isWithinReach !== "function" || te.isWithinReach(p, club, state.clubs)));
        const ziehbar = [];
        let fremdAlle = 0;
        fremde.forEach(p => {
            const b = bei(p);
            if (!b) return;
            fremdAlle++;
            if (b <= budget) ziehbar.push({ p, betrag: b });
        });
        const vertrag = eigene.filter(p => p.klauseln && Object.keys(p.klauseln).length).length;
        return {
            alle: unsere.length + fremdAlle + vertrag, bei: unsere.length + vertrag, fremd: fremdAlle,
            unsere, unsereSumme: unsere.reduce((s, x) => s + x.betrag, 0),
            ziehbar: ziehbar.sort((a, b) => (b.p.overall || 0) - (a.p.overall || 0)), ziehbarSumme: ziehbar.reduce((s, x) => s + x.betrag, 0),
            vertragsklauseln: vertrag
        };
    },

    // ------------------------------------------------------------ Transferbörse: eigene Gesuche

    gesuche(state) {
        return this._buch(state).gesuche;
    },

    /**
     * Ein Gesuch ausschreiben: { positionen, spielzeit, art, alterVon,
     * alterBis }. Alles andere wird ergänzt.
     */
    gesuchAnlegen(state, angaben = {}) {
        const buch = this._buch(state);
        const offen = buch.gesuche.filter(g => !this._abgelaufen(state, g));
        if (offen.length >= this.GESUCHE_MAX) return { success: false, error: `Höchstens ${this.GESUCHE_MAX} Gesuche gleichzeitig - beenden Sie erst eines.` };
        const positionen = (Array.isArray(angaben.positionen) ? angaben.positionen : [angaben.positionen]).filter(p => this.POSITIONEN.includes(p));
        if (!positionen.length) return { success: false, error: "Wählen Sie mindestens eine Position." };
        const spielzeit = this.SPIELZEIT[angaben.spielzeit] ? angaben.spielzeit : "egal";
        const art = this.ART[angaben.art] ? angaben.art : "transfer";
        let alterVon = Math.max(15, Math.min(40, Math.round(Number(angaben.alterVon) || 16)));
        let alterBis = Math.max(15, Math.min(40, Math.round(Number(angaben.alterBis) || 35)));
        if (alterBis < alterVon) [alterVon, alterBis] = [alterBis, alterVon];
        const heute = this._heute(state);
        const gesuch = {
            id: `ges_${heute}_${buch.gesuche.length}_${this._hash(positionen.join() + spielzeit + art) % 1000}`,
            positionen, spielzeit, art, alterVon, alterBis,
            tag: heute, saison: state.seasonYear || 1, bisTag: (state.currentDayIndex || 0) + this.GESUCH_TAGE
        };
        buch.gesuche.unshift(gesuch);
        return { success: true, gesuch };
    },

    gesuchLoeschen(state, id) {
        const buch = this._buch(state);
        const vorher = buch.gesuche.length;
        buch.gesuche = buch.gesuche.filter(g => g.id !== id);
        return vorher !== buch.gesuche.length;
    },

    _abgelaufen(state, g) {
        return g.saison !== (state.seasonYear || 1) || (state.currentDayIndex || 0) > g.bisTag;
    },

    /** In Worten: "IV, LV · Stammspieler · Kauf · 20-27 Jahre" */
    gesuchText(g) {
        return `${g.positionen.join(", ")} · ${this.SPIELZEIT[g.spielzeit].titel} · ${this.ART[g.art]} · ${g.alterVon}–${g.alterBis} Jahre`;
    },

    /**
     * Die Kaderanalyse jedes Vereins (KaderplanungEngine.bedarfsAnalyse) mit
     * seinem Kader - für einen Tag gemerkt, die Analyse aller Vereine kostet
     * etwas und Gesuche, Antworten und Abgabe brauchen sie alle.
     */
    _analysen(state) {
        const schluessel = `${state.seasonYear || 1}|${state.currentDayIndex || 0}|${(state.players || []).length}`;
        if (this._tag && this._tag.schluessel === schluessel && this._tag.state === state) return this._tag.karte;
        const kp = this._kp();
        const jeVerein = new Map();
        (state.players || []).forEach(p => {
            if (!p.clubId) return;
            if (!jeVerein.has(p.clubId)) jeVerein.set(p.clubId, []);
            jeVerein.get(p.clubId).push(p);
        });
        const karte = new Map();
        (state.clubs || []).forEach(c => {
            const kader = jeVerein.get(c.id) || [];
            if (!kader.length || !kp || typeof kp.bedarfsAnalyse !== "function") return;
            karte.set(c.id, { kader, analyse: kp.bedarfsAnalyse(state, c, kader) });
        });
        this._tag = { schluessel, state, karte };
        return karte;
    },

    /**
     * Wen die Vereine abgeben würden - je Verein aus seiner Kaderplanung
     * (überzählig zum Verkauf oder zur Leihe), dazu wer auf der
     * Transferliste steht oder einen auslaufenden Vertrag hat. Für einen
     * Tag gemerkt, die Analyse aller Vereine kostet etwas.
     */
    abgabe(state) {
        const karte = new Map();
        const setze = (p, art) => {
            const alt = karte.get(p.id) || { verkauf: false, leihe: false };
            alt[art] = true;
            karte.set(p.id, alt);
        };
        this._analysen(state).forEach(({ kader, analyse }, clubId) => {
            if (clubId === state.userClubId) return;
            const frei = kader.filter(p => !p.leihe && !p.vorvertrag);
            frei.forEach(p => { if (p.transferListed || (p.contractYears ?? 2) <= 1) setze(p, "verkauf"); });
            const nach = new Map(frei.map(p => [p.id, p]));
            (analyse.sellCandidates || []).forEach(x => { const p = nach.get(x.id); if (p) setze(p, "verkauf"); });
            (analyse.loanCandidates || []).forEach(x => { const p = nach.get(x.id); if (p) setze(p, "leihe"); });
        });
        return karte;
    },

    /**
     * Die Antworten auf ein Gesuch: Spieler, die ihr Verein abgeben würde,
     * die zum Gesuch passen und zu uns wollen könnten. Jeder Verein meldet
     * sich an seinem Tag (ANTWORT_TAGE). Der Sportdirektor empfiehlt die
     * zwei passendsten. Liefert { antworten, ausstehend }.
     */
    antworten(state, gesuch, { max = 12 } = {}) {
        const club = this._eigener(state);
        const te = this._te();
        if (!club || !gesuch || !te) return { antworten: [], ausstehend: 0 };
        const karte = this.abgabe(state);
        const k = typeof te.interesseKontext === "function" ? te.interesseKontext(state, club.id) : null;
        const niveau = k ? k.niveau : this.niveau(state, club.id);
        const sz = this.SPIELZEIT[gesuch.spielzeit] || this.SPIELZEIT.egal;
        const heute = this._heute(state);
        const [minT, maxT] = this.ANTWORT_TAGE;
        const zielMitte = gesuch.spielzeit === "star" ? niveau + 5 : gesuch.spielzeit === "stamm" ? niveau + 1
            : gesuch.spielzeit === "rotation" ? niveau - 2 : gesuch.spielzeit === "breite" ? niveau - 6 : niveau;
        const passend = [];
        let ausstehend = 0;
        (state.players || []).forEach(p => {
            const frei = karte.get(p.id);
            if (!frei) return;
            if (!gesuch.positionen.includes(p.pos)) return;
            if ((p.age || 25) < gesuch.alterVon || (p.age || 25) > gesuch.alterBis) return;
            if (gesuch.art === "transfer" && !frei.verkauf) return;
            if (gesuch.art === "leihe" && !frei.leihe) return;
            const abstand = (p.overall || 0) - niveau;
            if (abstand < sz.ab || abstand > sz.bis) return;
            if (sz.maxAlter && ((p.age || 25) > sz.maxAlter || (p.pot || 0) < niveau)) return;
            if (typeof te.isWithinReach === "function" && !te.isWithinReach(p, club, state.clubs)) return;
            const interesse = typeof te.interesse === "function" ? te.interesse(state, p, club.id, k) : null;
            if (interesse && (interesse.stufe === "ausgeschlossen" || interesse.stufe === "abgeneigt")) return;
            // Wann sein Verein antwortet: fest je Gesuch und Spieler
            const tag = gesuch.tag + minT + this._hash(`${gesuch.id}|${p.id}`) % (maxT - minT + 1);
            if (tag > heute) { ausstehend++; return; }
            const art = gesuch.art === "beides" ? (frei.verkauf ? "transfer" : "leihe") : gesuch.art;
            const guete = -Math.abs((p.overall || 0) - zielMitte) * 2
                + ({ interessiert: 6, offen: 3, zoegert: 0 }[interesse?.stufe] || 0)
                + ((p.pot || 0) > (p.overall || 0) + 4 && (p.age || 30) <= 23 ? 3 : 0);
            passend.push({ p, art, interesse, guete, verein: k ? k.vereine.get(p.clubId) : null });
        });
        passend.sort((a, b) => b.guete - a.guete || (b.p.overall || 0) - (a.p.overall || 0));
        const antworten = passend.slice(0, max).map((a, i) => Object.assign(a, { empfohlen: i < 2 }));
        return { antworten, ausstehend, anzahl: passend.length };
    },

    // ------------------------------------------------------------ Transferbörse: Gesuche anderer Vereine

    /**
     * Was die übrigen Vereine suchen - aus ihrer Kaderplanung, in Reichweite
     * unserer Spieler (zwei Klassen über bis zwei unter uns). art: "transfer"
     * oder "leihe": wer knapp bei Kasse ist, leiht lieber. Für einen Tag gemerkt.
     */
    fremdeGesuche(state) {
        const club = this._eigener(state);
        const kp = this._kp();
        if (!club || !kp) return [];
        const schluessel = `${state.seasonYear || 1}|${state.currentDayIndex || 0}|${(state.players || []).length}`;
        if (this._fremde && this._fremde.schluessel === schluessel && this._fremde.state === state) return this._fremde.liste;
        const stufe = club.level || 1;
        const analysen = this._analysen(state);
        const liste = [];
        (state.clubs || []).forEach(c => {
            if (c.id === club.id) return;
            const s = c.level || 1;
            if (s < stufe - 1 || s > stufe + 2) return;
            const a = analysen.get(c.id)?.analyse;
            const n = a?.needs?.[0];
            if (!n) return;
            const teil = kp.TEILE.find(t => t.key === n.teil);
            if (!teil) return;
            const h = this._hash(`${c.id}|${n.teil}|${state.seasonYear || 1}`);
            const knapp = (c.transferBudget || 0) < (a.niveau >= 70 ? 4e6 : 4e5);
            const art = knapp ? "leihe" : (h % 4 === 0 ? "beides" : "transfer");
            const spielzeit = n.art === "verstaerkung" ? "stamm" : (n.art === "luecke" ? "rotation" : "breite");
            const jung = h % 5 === 0;
            liste.push({
                id: `fg_${c.id}_${n.teil}`, clubId: c.id, verein: c.name, stufe: s, ruf: c.reputation || 50, countryId: c.countryId,
                teil: n.teil, titel: teil.titel, positionen: teil.positionen.slice(), spielzeit, art,
                alterVon: jung ? 17 : 20, alterBis: jung ? 23 : 31, niveau: a.niveau, budget: Math.max(0, c.transferBudget || 0),
                grund: n.reason, dringlich: n.dringlich
            });
        });
        liste.sort((x, y) => y.dringlich - x.dringlich || y.ruf - x.ruf);
        this._fremde = { schluessel, state, liste };
        return liste;
    },

    /** Eigene Spieler, die zu einem fremden Gesuch passen */
    passendeEigene(state, gesuch) {
        const club = this._eigener(state);
        if (!club || !gesuch) return [];
        return (state.players || []).filter(p => p.clubId === club.id && !p.leihe && !p.vorvertrag
            && gesuch.positionen.includes(p.pos)
            && (p.age || 25) >= gesuch.alterVon && (p.age || 25) <= gesuch.alterBis
            && this._passtSpielzeit(p, gesuch));
    },

    _passtSpielzeit(p, gesuch) {
        const abstand = (p.overall || 0) - (gesuch.niveau || 60);
        const sz = this.SPIELZEIT[gesuch.spielzeit] || this.SPIELZEIT.egal;
        return abstand >= sz.ab - 1 && abstand <= sz.bis + 4;
    },

    /** Eigene Gesuche anderer Vereine, für die wir einen passenden Spieler hätten */
    gelegenheiten(state) {
        return this.fremdeGesuche(state).map(g => ({ g, passend: this.passendeEigene(state, g) })).filter(x => x.passend.length);
    },

    /**
     * Einen eigenen Spieler auf ein fremdes Gesuch anbieten. Der Verein
     * antwortet sofort: Passt er zu dem, was er sucht, und reicht das Geld,
     * kommt ein Angebot (Transfer: TransferEngine.legeAngebotVor, Leihe:
     * LoanEngine) - sonst eine Absage mit Grund. Jedes Angebot steht in der
     * Liste der angebotenen Spieler.
     */
    anbieten(state, playerId, gesuchId) {
        const club = this._eigener(state);
        const player = (state.players || []).find(p => String(p.id) === String(playerId));
        const gesuch = this.fremdeGesuche(state).find(g => g.id === gesuchId);
        if (!club || !player || player.clubId !== club.id) return { success: false, error: "Spieler nicht gefunden." };
        if (!gesuch) return { success: false, error: "Das Gesuch gibt es nicht mehr." };
        const buch = this._buch(state);
        if (buch.angeboten.some(a => a.pId === player.id && a.clubId === gesuch.clubId && a.saison === (state.seasonYear || 1))) {
            return { success: false, error: `${player.name} wurde ${gesuch.verein} schon angeboten.` };
        }
        const verein = (state.clubs || []).find(c => c.id === gesuch.clubId);
        const te = this._te();
        const le = _rkResolve("LoanEngine", "./loanEngine.js");
        const eintrag = { pId: player.id, name: player.name, pos: player.pos, clubId: gesuch.clubId, verein: gesuch.verein,
            art: gesuch.art, saison: state.seasonYear || 1, tag: state.currentDayIndex || 0, ergebnis: "abgelehnt", text: "" };
        const absage = (text) => { eintrag.text = text; buch.angeboten.unshift(eintrag); if (buch.angeboten.length > 40) buch.angeboten.length = 40; return { success: true, angebot: false, text: `${gesuch.verein}: ${text}`, eintrag }; };

        if (!gesuch.positionen.includes(player.pos)) return absage("Wir suchen eine andere Position.");
        if (!this._passtSpielzeit(player, gesuch)) {
            return absage((player.overall || 0) < (gesuch.niveau || 60) ? "Er ist uns nicht stark genug." : "So einen können wir uns nicht leisten - er wäre bei uns unterfordert.");
        }
        if ((player.age || 25) < gesuch.alterVon || (player.age || 25) > gesuch.alterBis) return absage(`Wir suchen jemanden zwischen ${gesuch.alterVon} und ${gesuch.alterBis}.`);
        const hindernis = te && typeof te.fensterHindernis === "function" ? te.fensterHindernis(state) : null;
        if (hindernis) return { success: false, error: hindernis };

        // Leihe, wenn der Verein leihen will oder das Geld für einen Kauf fehlt
        const preis = Math.round((player.value || 0) * 0.45);
        const leihe = gesuch.art === "leihe" || (gesuch.art === "beides" && (verein?.transferBudget || 0) < preis);
        if (leihe) {
            if (!le) return absage("Gerade keine Leihe möglich.");
            const hind = le.verleihHindernis(state, player);
            if (hind) return { success: false, error: hind };
            if (!player.leihListe) le.zurLeiheAnbieten(state, player.id, { einsatz: "Rotation" });
            const interessent = le.interessenten(state, player.id, Infinity).find(i => i.clubId === gesuch.clubId);
            const angebot = interessent ? le._legeLeihangebotAn(state, player, interessent) : null;
            if (!angebot) return absage("Zu diesen Bedingungen leihen wir ihn nicht aus.");
            eintrag.ergebnis = "angebot"; eintrag.art = "leihe"; eintrag.text = `Leihangebot: ${Math.round(angebot.lohnAnteil * 100)} % des Gehalts`;
            buch.angeboten.unshift(eintrag);
            return { success: true, angebot: true, text: `${gesuch.verein} will ${player.name} ausleihen - das Angebot steht unter Leihen.`, eintrag };
        }
        if ((verein?.transferBudget || 0) < preis) return absage("Für eine Ablöse fehlt uns das Geld.");
        const offer = te && typeof te.legeAngebotVor === "function" ? te.legeAngebotVor(state, player, verein, { verkaeuflich: true }) : null;
        if (!offer) return absage("Wir haben es uns anders überlegt.");
        eintrag.ergebnis = "angebot"; eintrag.art = "transfer"; eintrag.fee = offer.fee; eintrag.text = "Angebot über die Ablöse";
        buch.angeboten.unshift(eintrag);
        return { success: true, angebot: true, text: `${gesuch.verein} bietet für ${player.name} - das Angebot steht unter Transferaktivität.`, eintrag, offer };
    },

    /** Die angebotenen Spieler dieser Saison */
    angeboten(state) {
        const saison = state?.seasonYear || 1;
        return (state?.rekrutierung?.angeboten || []).filter(a => a.saison === saison);
    }
};

if (typeof window !== "undefined") {
    window.RekrutierungEngine = RekrutierungEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { RekrutierungEngine };
}
