/**
 * KaderregelEngine - Meldelisten für den Europapokal, die Premier League und La Liga
 *
 * Bisher durfte jeder Spieler des Kaders in jedem Wettbewerb spielen. Im
 * Vorbild und in Wirklichkeit gibt es Meldelisten:
 *
 *   Europapokal  - Liste A mit höchstens 25 Spielern, davon mindestens acht
 *                  im Land ausgebildet. Fehlen welche, schrumpft die Liste
 *                  um genau so viele Plätze. Liste B für junge Spieler (bis
 *                  21), die seit zwei Saisons im Verein sind oder aus der
 *                  eigenen Jugend kommen - ohne Obergrenze.
 *   Premier League - 25 Spieler, höchstens 17 davon über 21 und nicht im
 *                  Land ausgebildet. Wer 21 oder jünger ist, zählt nicht mit.
 *   La Liga      - 25 Spieler über 21, höchstens drei ohne EU-Pass. Wie in
 *                  Spanien zählen Spieler aus den AKP-Staaten (Cotonou-
 *                  Abkommen) wie EU-Bürger, und Südamerikaner bekommen nach
 *                  zwei Saisons im Land den spanischen Pass. Das Spiel kennt
 *                  nur die Zeit im Verein; die zählt.
 *
 * "Im Land ausgebildet" kennt das Spiel nicht aus den Jugendjahren der
 * Spieler. Es gilt, wer aus der eigenen Jugend kommt oder die Nationalität
 * des Landes hat (für England auch Wales) - eine Annäherung, die für die
 * allermeisten Spieler stimmt.
 *
 * Gemeldet wird bis zum ersten Spiel des Wettbewerbs, nachgemeldet im
 * Winterfenster. Wer bis dahin keine Liste abgibt, bekommt den Vorschlag
 * des Co-Trainers. Wer nicht gemeldet ist, darf in diesem Wettbewerb nicht
 * spielen. Für KI-Vereine gilt der Vorschlag - sie stellen ohnehin ihre
 * Besten auf.
 */

const _krResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const KaderregelEngine = {
    REGELN: {
        europa: { name: "Europapokal", max: 25, minLokal: 8, listeB: true },
        liga_en_liga_1: { name: "Premier League", max: 25, maxFremd: 17, u21frei: true },
        liga_es_liga_1: { name: "La Liga", max: 25, maxNichtEU: 3, u21frei: true }
    },
    /** EU, EWR und die Schweiz */
    EU: ["Belgien", "Bulgarien", "Dänemark", "Deutschland", "Estland", "Finnland", "Frankreich", "Griechenland", "Irland",
        "Italien", "Kroatien", "Lettland", "Litauen", "Luxemburg", "Malta", "Niederlande", "Österreich", "Polen", "Portugal",
        "Rumänien", "Schweden", "Slowakei", "Slowenien", "Spanien", "Tschechien", "Ungarn", "Zypern",
        "Norwegen", "Island", "Liechtenstein", "Schweiz"],
    /** AKP-Staaten: in Spanien keine Nicht-EU-Spieler */
    AKP: ["Senegal", "Nigeria", "Ghana", "Mali", "Elfenbeinküste", "Kamerun", "Guinea", "Burkina Faso", "DR Kongo", "Benin",
        "Gambia", "Gabun", "Togo", "Angola", "Kap Verde", "Äquatorialguinea", "Jamaika", "Haiti", "Südafrika", "Sambia", "Simbabwe"],
    /** Iberoamerika: nach zwei Jahren im Land spanischer Pass */
    IBERO: ["Argentinien", "Brasilien", "Uruguay", "Kolumbien", "Chile", "Mexiko", "Paraguay", "Ecuador", "Peru", "Venezuela",
        "Bolivien", "Costa Rica", "Honduras", "Panama", "Guatemala", "El Salvador", "Dominikanische Republik", "Kuba"],
    LAND_NATION: {
        de: ["Deutschland"], en: ["England", "Wales"], es: ["Spanien"], it: ["Italien"], fr: ["Frankreich"]
    },
    U21: 21,

    _club(state, clubId = state?.userClubId) {
        return (state?.clubs || []).find(c => c.id === clubId) || null;
    },

    _kader(state, club) {
        const gs = _krResolve("GameState", "./gameState.js");
        const finde = gs && typeof gs.spielerMitId === "function"
            ? (id) => gs.spielerMitId(state.players, id)
            : (id) => (state.players || []).find(p => p.id === id);
        return (club?.playerIds || []).map(finde).filter(p => p && !p.leihe?.verliehenAn);
    },

    /** Im Land ausgebildet: aus der eigenen Jugend oder mit der Nationalität des Landes */
    lokal(p, club) {
        if (!p || !club) return false;
        if (p.eigengewaechsVon && p.eigengewaechsVon === club.id) return true;
        return (this.LAND_NATION[club.countryId] || []).includes(p.nationality);
    },

    /**
     * Hat der Spieler (für die Regeln des Vereinslandes) einen EU-Pass?
     * Gilt nur für Spanien; anderswo zählt die Regel nicht.
     */
    eu(state, p, club) {
        if (!p) return false;
        if (this.EU.includes(p.nationality)) return true;
        if (club?.countryId !== "es") return true;
        if (this.AKP.includes(p.nationality)) return true;
        if (this.IBERO.includes(p.nationality)) {
            // Wer schon zum Start der Karriere im Kader stand, ist lange im Land
            if (typeof p.vereinSeit !== "number") return true;
            return (state?.seasonYear || 1) - Math.floor(p.vereinSeit / 1000) >= 2;
        }
        return false;
    },

    /**
     * Zum Start einer Karriere: Wer in einem Verein mit Grenze über der Zahl
     * der Spieler ohne EU-Pass liegt, bei dem haben die schwächsten davon
     * den Pass des Landes (in Spanien aufgewachsen). Sonst stünde mancher
     * erzeugte Kader gleich mit fünf Nicht-EU-Spielern da.
     */
    gleicheStartkaderAn(state) {
        const pass = { es: "Spanien" };
        (state?.clubs || []).forEach(club => {
            const r = this.regel(club, "liga");
            if (!r || r.maxNichtEU == null || !pass[club.countryId]) return;
            const ohne = this._kader(state, club).filter(p => !this.eu(state, p, club)).sort((a, b) => (b.overall || 0) - (a.overall || 0));
            ohne.slice(r.maxNichtEU).forEach(p => { p.nationality = pass[club.countryId]; });
        });
    },

    /** Liste B: bis 21, aus der eigenen Jugend oder seit zwei Saisons im Verein */
    fuerListeB(state, p, club) {
        if (!p || (p.age || 99) > this.U21) return false;
        if (p.eigengewaechsVon && p.eigengewaechsVon === club.id) return true;
        // Wer schon zum Start der Karriere im Kader stand, gilt als lange im Verein
        if (typeof p.vereinSeit !== "number") return true;
        return (state.seasonYear || 1) - Math.floor(p.vereinSeit / 1000) >= 2;
    },

    /** Welche Listen braucht der Verein in dieser Saison: "europa", "liga" */
    arten(state, club = this._club(state)) {
        const arten = [];
        if (!club) return arten;
        const ec = state.europeanCompetitions || {};
        const imEuropapokal = Object.values(ec).some(w => (w.groups || []).some(g => (g.teams || []).includes(club.id))
            || (w.teams || []).includes?.(club.id));
        if (imEuropapokal) arten.push("europa");
        if (this.REGELN[`liga_${club.leagueId}`]) arten.push("liga");
        return arten;
    },

    regel(club, art) {
        return art === "europa" ? this.REGELN.europa : this.REGELN[`liga_${club?.leagueId}`] || null;
    },

    /**
     * Prüft eine Liste: { ok, fehler: [...], zahlen }. a = gemeldete Spieler
     * (Liste A bzw. Ligaliste), b = Liste B (nur Europapokal).
     */
    pruefe(state, club, art, liste) {
        const r = this.regel(club, art);
        const fehler = [];
        if (!r) return { ok: true, fehler, zahlen: {} };
        const nachId = new Map(this._kader(state, club).map(p => [p.id, p]));
        const a = (liste?.a || []).map(id => nachId.get(id)).filter(Boolean);
        const b = (liste?.b || []).map(id => nachId.get(id)).filter(Boolean);
        const zahlen = { a: a.length, b: b.length, max: r.max };
        if (art === "europa") {
            const lokal = a.filter(p => this.lokal(p, club)).length;
            const platz = r.max - Math.max(0, r.minLokal - lokal);
            Object.assign(zahlen, { lokal, minLokal: r.minLokal, platz });
            if (a.length > platz) fehler.push(lokal < r.minLokal
                ? `Liste A: ${a.length} Spieler, erlaubt sind ${platz} - es fehlen ${r.minLokal - lokal} im Land ausgebildete.`
                : `Liste A: ${a.length} statt höchstens ${r.max} Spieler.`);
            const falschB = b.filter(p => !this.fuerListeB(state, p, club));
            if (falschB.length) fehler.push(`Nicht für Liste B zugelassen: ${falschB.map(p => p.name).join(", ")}.`);
        } else {
            const zaehlt = a.filter(p => !(r.u21frei && (p.age || 99) <= this.U21));
            Object.assign(zahlen, { zaehlt: zaehlt.length });
            if (zaehlt.length > r.max) fehler.push(`${zaehlt.length} Spieler über ${this.U21} gemeldet, erlaubt sind ${r.max}.`);
            if (r.maxFremd != null) {
                const fremd = zaehlt.filter(p => !this.lokal(p, club)).length;
                Object.assign(zahlen, { fremd, maxFremd: r.maxFremd });
                if (fremd > r.maxFremd) fehler.push(`${fremd} Spieler über ${this.U21} sind nicht im Land ausgebildet, erlaubt sind ${r.maxFremd}.`);
            }
            if (r.maxNichtEU != null) {
                // Die Grenze gilt für alle Gemeldeten, auch die jungen
                const nichtEU = a.filter(p => !this.eu(state, p, club)).length;
                Object.assign(zahlen, { nichtEU, maxNichtEU: r.maxNichtEU });
                if (nichtEU > r.maxNichtEU) fehler.push(`${nichtEU} Spieler ohne EU-Pass gemeldet, erlaubt sind ${r.maxNichtEU}.`);
            }
        }
        return { ok: fehler.length === 0, fehler, zahlen };
    },

    /** Der Vorschlag des Co-Trainers: die Besten, so dass die Regeln aufgehen */
    vorschlag(state, club, art) {
        const r = this.regel(club, art);
        const kader = this._kader(state, club).slice().sort((x, y) => (y.overall || 0) - (x.overall || 0));
        if (!r) return { a: kader.map(p => p.id), b: [] };
        if (art === "europa") {
            const b = kader.filter(p => this.fuerListeB(state, p, club));
            const rest = kader.filter(p => !b.includes(p));
            const lokale = rest.filter(p => this.lokal(p, club));
            // Erst die Besten, solange Platz ist - die lokalen Plätze bleiben frei
            const a = [];
            // Freigehalten werden nur Plätze für Ausgebildete, die es auch gibt
            const nochLokal = () => Math.max(0, Math.min(r.minLokal, lokale.length) - a.filter(p => this.lokal(p, club)).length);
            const platz = () => r.max - Math.max(0, r.minLokal - Math.min(r.minLokal, lokale.length));
            rest.forEach(p => {
                if (a.length >= platz()) return;
                const freiFuerFremde = platz() - a.length - nochLokal();
                if (this.lokal(p, club) || freiFuerFremde > 0) a.push(p);
            });
            return { a: a.map(p => p.id), b: b.map(p => p.id) };
        }
        const jung = kader.filter(p => r.u21frei && (p.age || 99) <= this.U21);
        const alt = kader.filter(p => !jung.includes(p));
        const a = [];
        const ohneEUPlatz = (p) => r.maxNichtEU != null && !this.eu(state, p, club)
            && a.filter(x => !this.eu(state, x, club)).length >= r.maxNichtEU;
        alt.forEach(p => {
            if (a.length >= r.max) return;
            if (r.maxFremd != null) {
                const fremd = a.filter(x => !this.lokal(x, club)).length;
                if (!this.lokal(p, club) && fremd >= r.maxFremd) return;
            }
            if (ohneEUPlatz(p)) return;
            a.push(p);
        });
        jung.forEach(p => { if (!ohneEUPlatz(p)) a.push(p); });
        return { a: a.map(p => p.id), b: [] };
    },

    _speicher(state) {
        const saison = state.seasonYear || 1;
        if (!state.meldelisten || state.meldelisten.saison !== saison) state.meldelisten = { saison };
        return state.meldelisten;
    },

    /** Die Liste des eigenen Vereins - abgegeben oder (noch) der Vorschlag */
    liste(state, art, club = this._club(state)) {
        if (!club) return null;
        if (club.id === state.userClubId) {
            const s = this._speicher(state);
            if (s[art]) return s[art];
        }
        return Object.assign(this.vorschlag(state, club, art), { vorschlag: true });
    },

    /** Der erste Tag des Wettbewerbs im Kalender - bis dahin wird gemeldet */
    meldeschluss(state, art) {
        const kal = state.calendar || [];
        const typ = art === "europa" ? "euro" : "matchday";
        return kal.findIndex(d => d.type === typ);
    },

    /** Darf jetzt gemeldet werden? Vor dem ersten Spiel und im Winterfenster */
    offen(state, art) {
        const schluss = this.meldeschluss(state, art);
        if (schluss < 0 || (state.currentDayIndex || 0) < schluss) return true;
        const te = _krResolve("TransferEngine", "./transferEngine.js");
        const tag = (state.calendar || [])[state.currentDayIndex || 0];
        // Nach dem Meldeschluss nur im Fenster nach dem Datum - nicht in der Vorbereitung
        const probe = Object.assign({}, state, { preseason: null });
        return !!(te && typeof te.istTransferfenster === "function" && te.istTransferfenster(probe) && !tag?.preseason);
    },

    /** Liste abgeben. Gibt { ok, fehler } zurück */
    festlegen(state, art, liste) {
        const club = this._club(state);
        if (!club || !this.arten(state, club).includes(art)) return { ok: false, fehler: ["Für diesen Wettbewerb gibt es keine Meldeliste."] };
        if (!this.offen(state, art)) return { ok: false, fehler: ["Die Meldefrist ist abgelaufen - nachgemeldet wird im Winterfenster."] };
        const sauber = { a: [...new Set(liste?.a || [])], b: art === "europa" ? [...new Set(liste?.b || [])] : [] };
        const p = this.pruefe(state, club, art, sauber);
        if (!p.ok) return { ok: false, fehler: p.fehler };
        this._speicher(state)[art] = sauber;
        return { ok: true, fehler: [] };
    },

    /** Darf der Spieler in diesem Wettbewerb spielen? */
    gemeldet(state, club, art, playerId) {
        if (!this.arten(state, club).includes(art)) return true;
        const l = this.liste(state, art, club);
        return !!l && (l.a.includes(playerId) || (l.b || []).includes(playerId));
    },

    /** Zu welcher Liste eine Partie gehört - oder null */
    artVon(state, club, match) {
        if (!match) return null;
        const id = String(match.competitionId || "");
        if (["ucl", "uel", "uecl"].includes(id)) return "europa";
        if (match.isCup || id === "supercup" || id === "playoff" || /_cup$/.test(id) || match.freundschaftsspiel) return null;
        return this.REGELN[`liga_${club?.leagueId}`] ? "liga" : null;
    },

    /** Die nicht gemeldeten Spieler einer Aufstellung */
    nichtGemeldet(state, club, art, ids) {
        if (!art) return [];
        return (ids || []).filter(id => !this.gemeldet(state, club, art, id));
    },

    /**
     * Für Spiele ohne Livespiel (Urlaub, Co-Trainer): Nicht gemeldete
     * Spieler raus, gemeldete von der Bank rein.
     */
    passeAufstellungAn(state, club, art) {
        if (!art || !club) return 0;
        const raus = this.nichtGemeldet(state, club, art, club.lineup);
        if (!raus.length) {
            club.bench = (club.bench || []).filter(id => this.gemeldet(state, club, art, id));
            return 0;
        }
        const gs = _krResolve("GameState", "./gameState.js");
        const kandidaten = (club.bench || []).concat(club.playerIds || [])
            .filter((id, i, a) => a.indexOf(id) === i && !club.lineup.includes(id) && this.gemeldet(state, club, art, id))
            .map(id => gs && gs.spielerMitId ? gs.spielerMitId(state.players, id) : state.players.find(p => p.id === id))
            .filter(p => p && !p.injured && !(p.injuredWeeks > 0) && !(p.suspendedMatches > 0));
        raus.forEach(id => {
            const alt = state.players.find(p => p.id === id);
            const i = club.lineup.indexOf(id);
            const ersatz = kandidaten.sort((x, y) => ((y.pos === alt?.pos) - (x.pos === alt?.pos)) || (y.overall || 0) - (x.overall || 0)).shift();
            if (ersatz && i >= 0) club.lineup[i] = ersatz.id;
        });
        club.bench = (club.bench || []).filter(id => !club.lineup.includes(id) && this.gemeldet(state, club, art, id));
        return raus.length;
    },

    /**
     * Täglich: Zum Meldeschluss gilt der Vorschlag, wenn keine Liste da ist -
     * mit einer Nachricht. Gibt eine Zeile für den Tagesbericht zurück.
     */
    tag(state) {
        const club = this._club(state);
        if (!club) return null;
        const zeilen = [];
        this.arten(state, club).forEach(art => {
            const schluss = this.meldeschluss(state, art);
            if ((state.currentDayIndex || 0) !== schluss - 1) return;
            const s = this._speicher(state);
            if (s[art]) return;
            s[art] = this.vorschlag(state, club, art);
            const name = this.regel(club, art)?.name || art;
            if (Array.isArray(state.inbox)) {
                state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday, date: state.currentDate || "",
                    sender: "Co-Trainer", subject: `📋 Meldeliste ${name} abgegeben`,
                    body: `Morgen ist Meldeschluss für ${name}. Weil keine Liste vorlag, habe ich unseren Vorschlag gemeldet: ${s[art].a.length} Spieler${s[art].b.length ? ` auf Liste A und ${s[art].b.length} auf Liste B` : ""}. Wer nicht gemeldet ist, darf in diesem Wettbewerb nicht spielen. Nachmelden geht im Winterfenster.`,
                    read: false, type: "board_message" });
            }
            zeilen.push(`📋 Meldeliste ${name}: Vorschlag des Co-Trainers gemeldet`);
        });
        return zeilen.length ? zeilen.join(" · ") : null;
    }
};

if (typeof window !== "undefined") {
    window.KaderregelEngine = KaderregelEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { KaderregelEngine };
}
