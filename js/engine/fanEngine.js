/**
 * FanEngine - Die Kurve meldet sich zu Wort
 *
 * Die Fanstimmung (state.fanMood) bewegte sich bisher nur auf
 * Pressekonferenzen und um einen Zufallspunkt am Medientag. Ein 5:0 im
 * Derby ließ die Kurve so kalt wie ein 0:4 beim Aufsteiger.
 *
 * Jetzt folgt sie den Ergebnissen: Siege heben sie, Niederlagen drücken
 * sie, gemessen an der Erwartung (wer als Außenseiter gewinnt, wird
 * gefeiert; wer als Favorit verliert, bekommt es zu hören), am Abstand und
 * daran, ob es ein Derby war. Langsam zieht sie zurück zur Mitte.
 *
 * Dazu kommen Stimmen aus der Kurve: nach jedem Pflichtspiel zwei, drei
 * kurze Beiträge von Fans (zum Ergebnis, zu einem Spieler, zur Serie oder
 * zur Tabelle), nach großen Transfers ebenso. Die Übersicht zeigt die
 * jüngsten.
 */

const FanEngine = {
    MAX_STIMMEN: 30,
    MITTE: 70,
    /** Wie stark ein Ergebnis die Stimmung bewegt */
    WIRKUNG: { sieg: 4, niederlage: -4, ueberraschung: 3, jeTor: 1, derby: 1.6, rueckzug: 0.06 },

    _zufall() { return Math.random(); },
    _wahl(liste) { return liste[Math.floor(this._zufall() * liste.length) % liste.length]; },

    _nicks: ["Kurvenkind", "Dauerkarte", "Auswärtsfahrer", "Stehplatz", "Blockfahne", "Zaunfahne", "Fanbus", "Trommler",
        "Nordkurve", "Südkurve", "Oberrang", "Gegengerade", "Vereinsbrille", "Schalträger", "Choreo", "Flutlicht"],
    _vornamen: ["Bernd", "Moni", "Kalle", "Steffi", "Jürgen", "Anja", "Ole", "Lina", "Udo", "Tanja", "Hakan", "Jule", "Rolf", "Mia", "Sven", "Petra"],

    autor() {
        const n = this._wahl(this._nicks);
        const r = this._zufall();
        if (r < 0.34) return `${n}_${10 + Math.floor(this._zufall() * 89)}`;
        if (r < 0.67) return `${this._wahl(this._vornamen)}_${n}`;
        return `${n}${1900 + Math.floor(this._zufall() * 110)}`;
    },

    _liste(state) {
        if (!Array.isArray(state.fanStimmen)) state.fanStimmen = [];
        return state.fanStimmen;
    },

    _poste(state, text, ton, anlass) {
        const liste = this._liste(state);
        liste.unshift({
            id: `fan_${(state.seasonYear || 1)}_${state.currentDayIndex || 0}_${liste.length}_${Math.floor(this._zufall() * 1e6)}`,
            saison: state.seasonYear || 1, datum: state.currentDate || "", autor: this.autor(), text, ton, anlass,
            likes: Math.round(5 + this._zufall() * (ton === "jubel" || ton === "frust" ? 400 : 120))
        });
        if (liste.length > this.MAX_STIMMEN) liste.length = this.MAX_STIMMEN;
    },

    /** Die jüngsten Stimmen */
    stimmen(state, anzahl = 3) {
        return (state && Array.isArray(state.fanStimmen) ? state.fanStimmen : []).slice(0, anzahl);
    },

    _setzeStimmung(state, delta) {
        const vorher = state.fanMood ?? this.MITTE;
        let wert = vorher + delta;
        wert += (this.MITTE - wert) * this.WIRKUNG.rueckzug;
        state.fanMood = Math.round(Math.max(10, Math.min(100, wert)));
        return state.fanMood - vorher;
    },

    /** Erwartung aus Sicht des eigenen Vereins: +1 klarer Favorit, -1 klarer Außenseiter */
    erwartung(eigen, gegner, heim) {
        const diff = ((eigen && eigen.reputation) || 60) - ((gegner && gegner.reputation) || 60);
        return Math.max(-1, Math.min(1, diff / 12 + (heim ? 0.15 : -0.15)));
    },

    /**
     * Nach jedem Pflichtspiel des eigenen Vereins. Gibt die Änderung der
     * Stimmung zurück (oder null, wenn das Spiel nicht zählt oder schon
     * gezählt hat).
     */
    nachSpiel(state, match, wettbewerb = "Liga") {
        if (!state || !match || !match.played) return null;
        const heim = match.homeClubId === state.userClubId;
        if (!heim && match.awayClubId !== state.userClubId) return null;
        const schluessel = `${state.seasonYear || 1}:${match.id ?? `${match.homeClubId}-${match.awayClubId}-${match.matchday ?? ""}-${wettbewerb}`}`;
        if (state.fanLetztesSpiel === schluessel) return null;
        state.fanLetztesSpiel = schluessel;

        const eigen = (state.clubs || []).find(c => c.id === state.userClubId);
        const gegner = (state.clubs || []).find(c => c.id === (heim ? match.awayClubId : match.homeClubId));
        const tore = heim ? match.homeGoals : match.awayGoals;
        const gegentore = heim ? match.awayGoals : match.homeGoals;
        const diff = tore - gegentore;
        const e = this.erwartung(eigen, gegner, heim);
        const derby = !!match.derbyTitle;
        const W = this.WIRKUNG;

        let delta = 0;
        if (diff > 0) delta = W.sieg + Math.max(0, -e) * W.ueberraschung + Math.max(0, diff - 2) * W.jeTor;
        else if (diff < 0) delta = W.niederlage - Math.max(0, e) * W.ueberraschung - Math.max(0, -diff - 2) * W.jeTor;
        else delta = e > 0.4 ? -1.5 : (e < -0.4 ? 1.5 : 0);
        if (derby) delta *= W.derby;
        const aenderung = this._setzeStimmung(state, delta);

        // Serie aus der Chronik, sonst aus der Form
        const serie = this._serie(state, eigen, diff);
        this._stimmenNachSpiel(state, { eigen, gegner, tore, gegentore, diff, e, derby, derbyTitel: match.derbyTitle, wettbewerb, match, heim, serie });
        return aenderung;
    },

    _serie(state, eigen, diff) {
        const chronik = state.chronik && eigen ? state.chronik[eigen.id] : null;
        const s = chronik && chronik.serie ? chronik.serie : null;
        const lauf = state.fanSerie || { siege: 0, niederlagen: 0, sieglos: 0 };
        lauf.siege = diff > 0 ? lauf.siege + 1 : 0;
        lauf.niederlagen = diff < 0 ? lauf.niederlagen + 1 : 0;
        lauf.sieglos = diff > 0 ? 0 : lauf.sieglos + 1;
        state.fanSerie = lauf;
        return { siege: s && typeof s.siege === "number" ? Math.max(s.siege, lauf.siege) : lauf.siege, niederlagen: lauf.niederlagen, sieglos: lauf.sieglos };
    },

    _spielerDesSpiels(state, match, eigenId) {
        const spieler = new Map((state.players || []).map(p => [String(p.id), p]));
        const motm = match.manOfTheMatch;
        const motmId = motm && typeof motm === "object" ? motm.playerId ?? motm.id : motm;
        const held = motmId !== undefined && motmId !== null ? spieler.get(String(motmId)) : null;
        const ereignisse = Array.isArray(match.events) ? match.events : [];
        const tore = new Map();
        ereignisse.filter(e => e && e.type === "goal" && e.clubId === eigenId && e.playerName).forEach(e => tore.set(e.playerName, (tore.get(e.playerName) || 0) + 1));
        const rot = ereignisse.find(e => e && e.type === "red_card" && e.clubId === eigenId && e.playerName);
        const besterTorschuetze = [...tore.entries()].sort((a, b) => b[1] - a[1])[0] || null;
        return {
            held: held && held.clubId === eigenId ? held.name : null,
            torschuetze: besterTorschuetze ? { name: besterTorschuetze[0], tore: besterTorschuetze[1] } : null,
            rot: rot ? rot.playerName : null
        };
    },

    _stimmenNachSpiel(state, l) {
        const g = l.gegner ? l.gegner.name : "den Gegner";
        const erg = `${l.tore}:${l.gegentore}`;
        const trainer = state.managerName ? state.managerName.split(" ").pop() : "der Trainer";
        const pick = (liste) => this._wahl(liste);

        // 1. Zum Ergebnis
        let text, ton;
        if (l.derby && l.diff > 0) { ton = "jubel"; text = pick([`DERBYSIEG! ${erg} gegen ${g} - die Stadt gehört uns!`, `${l.derbyTitel || "Derby"} gewonnen. Ich geh heute nicht mehr schlafen.`, `${erg} im Derby. Das erzähl ich noch meinen Enkeln.`]); }
        else if (l.derby && l.diff < 0) { ton = "frust"; text = pick([`Derbyniederlage. Ich trau mich morgen nicht ins Büro.`, `${erg} gegen ${g}. Im Derby. Mir fehlen die Worte.`, `Alles verlieren, nur nicht das Derby. Und dann das.`]); }
        else if (l.diff >= 3) { ton = "jubel"; text = pick([`${erg}! Ich hab immer noch Gänsehaut.`, `Was für ein Abend. ${erg} gegen ${g} - so macht Fußball Spaß!`, `${l.tore} Tore. Ich hab irgendwann aufgehört zu zählen.`]); }
        else if (l.diff > 0 && l.e < -0.3) { ton = "jubel"; text = pick([`Gegen ${g} gewonnen - wer hätte das gedacht?`, `Keiner hat an uns geglaubt. ${erg}!`, `Die Großen haben auch nur zwei Beine. ${erg} gegen ${g}!`]); }
        else if (l.diff > 0) { ton = "jubel"; text = pick([`Drei Punkte, so muss das!`, `Arbeitssieg gegen ${g}. Nimmt man gern mit.`, `${erg}. Nicht schön, aber selten. Egal!`, `Sieg ist Sieg. Weiter so, Jungs!`]); }
        else if (l.diff === 0 && l.e > 0.4) { ton = "frust"; text = pick([`Nur ein Punkt gegen ${g}? Das ist zu wenig.`, `${erg}. Zwei Punkte verschenkt, und jeder hat's gesehen.`, `Gegen so einen Gegner muss man gewinnen.`]); }
        else if (l.diff === 0) { ton = "neutral"; text = pick([`Ein Punkt. Kann man mitnehmen, muss man nicht feiern.`, `${erg} gegen ${g}. Leistungsgerecht, würde ich sagen.`, `Unentschieden. Die Kurve war besser als das Spiel.`]); }
        else if (l.diff <= -3) { ton = "frust"; text = pick([`${erg}. So eine Leistung will ich nicht noch mal sehen.`, `Ich hab für das Auswärtsticket Urlaub genommen. Für DAS.`, `${erg} gegen ${g}. Da muss jetzt mal jemand was sagen.`]); }
        else if (l.e > 0.3) { ton = "frust"; text = pick([`Gegen ${g} verlieren? Peinlich.`, `${erg} gegen ${g}. Ich versteh's nicht.`, `Das war heute nix. Gar nix.`]); }
        else { ton = "neutral"; text = pick([`Verloren, aber gekämpft. Kopf hoch.`, `${erg}. Gegen ${g} kann man verlieren. Muss man aber nicht.`, `Nächste Woche wieder. Wir stehen hinter euch.`]); }
        if (l.wettbewerb && l.wettbewerb !== "Liga" && l.diff > 0 && !l.derby && this._zufall() < 0.5) text = `${l.wettbewerb}: ${text}`;
        this._poste(state, text, ton, "spiel");

        // 2. Zu einem Spieler
        const s = this._spielerDesSpiels(state, l.match, l.eigen && l.eigen.id);
        if (s.rot && this._zufall() < 0.8) this._poste(state, pick([`Unnötige Rote von ${s.rot}. Das kostet uns noch was.`, `${s.rot}, was sollte das?`, `Mit zehn Mann wird's nicht leichter. Danke, ${s.rot}.`]), "frust", "spieler");
        else if (s.torschuetze && s.torschuetze.tore >= 2) this._poste(state, pick([`${s.torschuetze.name} mit ${s.torschuetze.tore} Toren - Fußballgott!`, `Gebt ${s.torschuetze.name} einen neuen Vertrag. Sofort.`, `${s.torschuetze.tore} Buden von ${s.torschuetze.name}. Mein neues Trikot steht fest.`]), "jubel", "spieler");
        else if (s.held && l.diff >= 0) this._poste(state, pick([`${s.held} heute überragend.`, `Ohne ${s.held} hätten wir das nicht geholt.`, `${s.held} hat heute für zwei gerannt.`]), "jubel", "spieler");
        else if (s.torschuetze && l.diff > 0) this._poste(state, pick([`Schönes Tor von ${s.torschuetze.name}!`, `${s.torschuetze.name} trifft, wir gewinnen. So einfach.`]), "jubel", "spieler");

        // 3. Zur Lage - Serie oder Tabelle (nicht nach jedem Spiel)
        const tabelle = Array.isArray(state.standings) ? state.standings : [];
        const platz = tabelle.findIndex(r => r.clubId === (l.eigen && l.eigen.id)) + 1;
        if (l.serie.siege >= 3) this._poste(state, pick([`${l.serie.siege} Siege am Stück. Die Kurve träumt.`, `${l.serie.siege} Siege in Folge - wer soll uns aufhalten?`]), "jubel", "serie");
        else if (l.serie.niederlagen >= 3) this._poste(state, pick([`${l.serie.niederlagen} Niederlagen in Folge. ${trainer}, so geht das nicht weiter.`, `${l.serie.niederlagen} Pleiten am Stück. Ich will Lösungen sehen.`]), "frust", "serie");
        else if (l.serie.sieglos >= 5) this._poste(state, `${l.serie.sieglos} Spiele ohne Sieg. Wird langsam Zeit.`, "frust", "serie");
        else if (platz === 1 && tabelle.length && l.wettbewerb === "Liga" && this._zufall() < 0.6) this._poste(state, pick([`Tabellenführer! Ich mach mal einen Screenshot.`, `Ganz oben. Da gehören wir hin.`]), "jubel", "tabelle");
        else if (platz && tabelle.length && platz > tabelle.length - 3 && l.wettbewerb === "Liga" && this._zufall() < 0.6) this._poste(state, pick([`Abstiegsplatz. Jetzt zählt jeder Punkt.`, `Unten drin. Wir bleiben trotzdem laut.`]), "frust", "tabelle");
    },

    /** Nach einem Transfer des eigenen Vereins: richtung "zugang" oder "abgang" */
    nachTransfer(state, spieler, richtung, ablose = 0) {
        if (!state || !spieler) return null;
        const eigen = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!eigen) return null;
        const kader = (state.players || []).filter(p => p.clubId === eigen.id && p.id !== spieler.id).map(p => p.overall || 0).sort((a, b) => b - a);
        const spitze = kader.slice(0, 5);
        const schnitt = spitze.length ? spitze.reduce((s, x) => s + x, 0) / spitze.length : 60;
        const stark = (spieler.overall || 0) >= schnitt - 1;
        const pick = (liste) => this._wahl(liste);
        if (richtung === "zugang") {
            if (!stark) return null;
            this._poste(state, pick([`${spieler.name} kommt! Ich hab gerade mein Trikot bestellt.`, `Was für ein Transfer. ${spieler.name} bei uns - unfassbar.`, `${spieler.name}! Jetzt wird angegriffen.`]), "jubel", "transfer");
            return this._setzeStimmung(state, 3);
        }
        if (!stark) return null;
        this._poste(state, pick([`${spieler.name} verkauft? Das tut weh.`, `Unseren Besten abgeben. ${spieler.name}, wir werden dich vermissen.`, `Für Geld kann man keine Tore schießen. ${spieler.name} fehlt uns jetzt schon.`]), "frust", "transfer");
        return this._setzeStimmung(state, -3);
    }
};

if (typeof window !== "undefined") {
    window.FanEngine = FanEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { FanEngine };
}
