/**
 * TrainerwechselEngine - Das Trainerkarussell der KI-Vereine
 *
 * Bisher hatte kein KI-Verein einen Trainer. Seine Spielweise stand bei
 * Spielbeginn fest und blieb, wie sie war - auch beim Tabellenletzten, der
 * nach zwanzig Spieltagen elf Niederlagen gesammelt hatte. Die Liga sah in
 * der fünften Saison aus wie in der ersten.
 *
 * Jetzt hat jeder KI-Verein einen Trainer mit Namen, Ruf und Spielweise.
 * Bleibt eine Mannschaft deutlich hinter dem zurück, was ihr Kader
 * erwarten lässt, und kommt eine schlechte Serie dazu, wächst der Druck -
 * und irgendwann trennt sich der Verein. Der Nachfolger bringt seine eigene
 * Spielweise mit, und für ein paar Wochen zieht die Mannschaft mit
 * (Trainereffekt). Zum Saisonende trennen sich Vereine, die weit hinter
 * ihrem Anspruch geblieben oder abgestiegen sind.
 *
 * Geeicht auf die echten Ligen: Bundesliga und Premier League wechseln in
 * einer Saison fünf bis acht Mal den Trainer, Serie A und LaLiga eher öfter.
 */

const _twResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const TrainerwechselEngine = {
    /** Druck, ab dem ein Verein über eine Trennung nachdenkt */
    DRUCK_AB: 3.5,
    /** Chance je Spieltag je Druckpunkt darüber - und höchstens */
    CHANCE_JE_DRUCK: 0.012,
    CHANCE_MAX: 0.12,
    /** Frühestens nach so vielen Spielen der Saison, und so lange bekommt ein Neuer Zeit */
    AB_SPIELEN: 6,
    SCHONFRIST: 6,
    /** Höchstens so viele Wechsel je Verein und Saison */
    JE_SAISON: 2,
    /** Wie stark der Trainereffekt die Laune hebt */
    TRAINEREFFEKT: 6,
    /** So viele Wechsel bleiben im Protokoll - geführt für die eigene Liga und die ersten Ligen */
    PROTOKOLL: 120,
    /** Auch ohne Not trennen sich im Sommer manche Vereine von ihrem Trainer */
    SOMMER_GRUNDCHANCE: 0.06,

    _ligen() {
        const daten = _twResolve("LEAGUES_DATA", "../data/leagueData.js") || [];
        return Array.isArray(daten) ? daten : (daten.LEAGUES_DATA || []);
    },

    _land(club) {
        const liga = this._ligen().find(l => l.id === club?.leagueId);
        return liga ? liga.countryId : "de";
    },

    _name(club, zufall) {
        const gen = _twResolve("PlayerGenerator", "./playerGenerator.js");
        const pool = gen && typeof gen.resolveNamePool === "function" ? gen.resolveNamePool(this._land(club)) : null;
        const vor = pool?.firstNames?.length ? pool.firstNames : ["Thomas", "Marco", "Stefan", "Andrea", "Luis"];
        const nach = pool?.lastNames?.length ? pool.lastNames : ["Becker", "Rossi", "García", "Martin", "Smith"];
        return `${vor[Math.floor(zufall() * vor.length)]} ${nach[Math.floor(zufall() * nach.length)]}`;
    },

    _taktik() {
        return _twResolve("TacticsEngine", "./tacticsEngine.js");
    },

    /** Der Trainer eines KI-Vereins - beim ersten Blick angelegt */
    trainer(state, club, zufall = Math.random) {
        if (!club || club.id === state?.userClubId) return null;
        if (!club.trainer) {
            const t = this._taktik();
            club.trainer = {
                name: this._name(club, zufall),
                seit: state?.seasonYear || 1,
                stil: club.tactics?.vorlage || (t ? t.vorlageFuerVerein(club) : "ausgewogen"),
                ruf: Math.max(30, Math.min(92, Math.round((club.reputation || 60) + (zufall() - 0.5) * 16))),
                ab: 0
            };
        }
        return club.trainer;
    },

    stilName(key) {
        const t = this._taktik();
        const v = t && t.VORLAGEN ? t.VORLAGEN[key] : null;
        if (v) return v.name.replace(/\s*\(.*\)$/, "");
        const namen = { ausgewogen: "Ausgewogen", positionsspiel: "Positionsspiel", gegenpressing: "Gegenpressing", fluegelspiel: "Flügelspiel",
            manndeckung: "Manndeckung", konter: "Konter", direkt: "Direktes Spiel", tieferBlock: "Tiefer Block" };
        return namen[key] || key || "";
    },

    /** Kaderstärke: der Schnitt der vierzehn Besten */
    _staerke(state, club, nachVerein) {
        const werte = (nachVerein.get(club.id) || []).map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 14);
        return werte.length ? werte.reduce((s, x) => s + x, 0) / werte.length : 0;
    },

    _tabelle(state, ligaId) {
        const eigene = (state.clubs || []).find(c => c.id === state.userClubId)?.leagueId;
        if (ligaId === eigene && Array.isArray(state.standings) && state.standings.length) return state.standings;
        return (state.standingsByLeague || {})[ligaId] || [];
    },

    /**
     * Wie sehr ein Trainer wackelt: Plätze hinter dem Kaderrang, Niederlagen
     * der letzten fünf Spiele, Abstiegsplatz - ein Trainer mit großem Namen
     * hält mehr aus.
     */
    druck({ platz, erwartet, niederlagen, abstieg, keller, ruf }) {
        return Math.max(0, (platz - erwartet) * 0.6 + niederlagen * 0.9 + (abstieg ? 2.5 : 0) + (keller ? 1 : 0) - ((ruf || 60) - 60) / 40);
    },

    _niederlagen(club) {
        const form = Array.isArray(club.form) ? club.form : String(club.form || "").split("");
        return form.slice(-5).filter(g => g === "L" || g === "N").length;
    },

    /**
     * Nach jedem Spieltag: wer seinen Trainer entlässt. Gibt die Wechsel in
     * der eigenen Liga zurück (für Postfach und Tagesbericht).
     */
    nachSpieltag(state, zufall = Math.random) {
        if (!state || !Array.isArray(state.clubs)) return [];
        const nachVerein = new Map();
        (state.players || []).forEach(p => {
            if (!p.clubId) return;
            if (!nachVerein.has(p.clubId)) nachVerein.set(p.clubId, []);
            nachVerein.get(p.clubId).push(p);
        });
        const nachLiga = new Map();
        state.clubs.forEach(c => {
            if (!c.leagueId) return;
            if (!nachLiga.has(c.leagueId)) nachLiga.set(c.leagueId, []);
            nachLiga.get(c.leagueId).push(c);
        });
        const eigeneLiga = state.clubs.find(c => c.id === state.userClubId)?.leagueId;
        const wechsel = [];
        nachLiga.forEach((vereine, ligaId) => {
            const tabelle = this._tabelle(state, ligaId);
            if (!tabelle.length) return;
            const erwartet = new Map(vereine.slice().sort((a, b) => this._staerke(state, b, nachVerein) - this._staerke(state, a, nachVerein)).map((c, i) => [c.id, i + 1]));
            const abstiegAb = vereine.length - 2;
            tabelle.forEach((zeile, i) => {
                const club = vereine.find(c => c.id === zeile.clubId);
                if (!club || club.id === state.userClubId) return;
                const t = this.trainer(state, club, zufall);
                const gespielt = zeile.played || 0;
                if (gespielt < this.AB_SPIELEN || gespielt - (t.ab || 0) < this.SCHONFRIST) return;
                if ((club.trainerwechsel?.saison === (state.seasonYear || 1) ? club.trainerwechsel.anzahl : 0) >= this.JE_SAISON) return;
                const d = this.druck({ platz: i + 1, erwartet: erwartet.get(club.id) || i + 1, niederlagen: this._niederlagen(club),
                    abstieg: i + 1 > abstiegAb, keller: i + 1 > vereine.length - 4, ruf: t.ruf });
                if (d < this.DRUCK_AB) return;
                const chance = Math.min(this.CHANCE_MAX, (d - this.DRUCK_AB + 1) * this.CHANCE_JE_DRUCK);
                if (zufall() >= chance) return;
                const w = this.wechsle(state, club, { grund: "entlassung", gespielt, platz: i + 1 }, zufall);
                if (w && ligaId === eigeneLiga) wechsel.push(w);
            });
        });
        wechsel.forEach(w => this._post(state, w));
        return wechsel;
    },

    /** Zum Saisonende: wer weit hinter dem Anspruch blieb oder abstieg, trennt sich oft */
    saisonEnde(state, zufall = Math.random) {
        if (!state || !Array.isArray(state.clubs)) return [];
        const nachVerein = new Map();
        (state.players || []).forEach(p => { if (p.clubId) { if (!nachVerein.has(p.clubId)) nachVerein.set(p.clubId, []); nachVerein.get(p.clubId).push(p); } });
        const eigeneLiga = state.clubs.find(c => c.id === state.userClubId)?.leagueId;
        const wechsel = [];
        const ligen = new Set(state.clubs.map(c => c.leagueId).filter(Boolean));
        ligen.forEach(ligaId => {
            const vereine = state.clubs.filter(c => c.leagueId === ligaId);
            const tabelle = this._tabelle(state, ligaId);
            if (!tabelle.length) return;
            const erwartet = new Map(vereine.slice().sort((a, b) => this._staerke(state, b, nachVerein) - this._staerke(state, a, nachVerein)).map((c, i) => [c.id, i + 1]));
            const liga = this._ligen().find(l => l.id === ligaId);
            const abstiegsPlaetze = new Set(liga?.relegationSpots || [vereine.length - 1, vereine.length]);
            tabelle.forEach((zeile, i) => {
                const club = vereine.find(c => c.id === zeile.clubId);
                if (!club || club.id === state.userClubId) return;
                const t = this.trainer(state, club, zufall);
                const defizit = (i + 1) - (erwartet.get(club.id) || i + 1);
                const chance = abstiegsPlaetze.has(i + 1) ? 0.55 : (defizit >= 6 ? 0.5 : (defizit >= 4 ? 0.25 : this.SOMMER_GRUNDCHANCE));
                if ((t.seit === (state.seasonYear || 1) && (t.ab || 0) > 0) || zufall() >= chance) return;
                const w = this.wechsle(state, club, { grund: "saisonende", platz: i + 1 }, zufall);
                if (w && ligaId === eigeneLiga) wechsel.push(w);
            });
        });
        wechsel.forEach(w => this._post(state, w));
        return wechsel;
    },

    /** Der Verein trennt sich, ein Nachfolger mit eigener Spielweise kommt */
    wechsle(state, club, { grund = "entlassung", gespielt = 0, platz = null } = {}, zufall = Math.random) {
        const alt = this.trainer(state, club, zufall);
        if (!alt) return null;
        const taktik = this._taktik();
        let stil = alt.stil;
        for (let i = 0; i < 6 && stil === alt.stil; i++) {
            stil = taktik ? taktik.vorlageFuerVerein(club, zufall) : "ausgewogen";
        }
        const neu = {
            name: this._name(club, zufall),
            seit: state.seasonYear || 1,
            stil,
            ruf: Math.max(30, Math.min(92, Math.round((club.reputation || 60) + (zufall() - 0.55) * 16))),
            ab: grund === "saisonende" ? 0 : gespielt
        };
        // Doppelte Namen im selben Verein klingen nach einem Fehler
        if (neu.name === alt.name) neu.name = this._name(club, zufall);
        club.trainer = neu;
        if (taktik && typeof taktik.wendeVorlageAn === "function") club.tactics = taktik.wendeVorlageAn(club.tactics, stil);
        // Trainereffekt: Die Mannschaft will sich zeigen
        if (grund !== "saisonende") {
            (state.players || []).forEach(p => { if (p.clubId === club.id) p.morale = Math.min(100, (p.morale ?? 70) + this.TRAINEREFFEKT); });
        }
        const saison = state.seasonYear || 1;
        club.trainerwechsel = { saison, anzahl: (club.trainerwechsel?.saison === saison ? club.trainerwechsel.anzahl : 0) + 1 };
        const eintrag = {
            saison, datum: state.currentDate || "", clubId: club.id, verein: club.name, liga: club.leagueId,
            alt: alt.name, neu: neu.name, stil, grund, platz
        };
        if (!Array.isArray(state.trainerwechsel)) state.trainerwechsel = [];
        const eigeneLiga = (state.clubs || []).find(c => c.id === state.userClubId)?.leagueId;
        if (club.leagueId === eigeneLiga || (club.level || 1) === 1) state.trainerwechsel.push(eintrag);
        if (state.trainerwechsel.length > this.PROTOKOLL) state.trainerwechsel.splice(0, state.trainerwechsel.length - this.PROTOKOLL);
        return eintrag;
    },

    _post(state, w) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        const text = w.grund === "saisonende"
            ? `${w.verein} und Trainer ${w.alt} gehen nach der Saison getrennte Wege${w.platz ? ` (Platz ${w.platz})` : ""}. Nachfolger wird ${w.neu}, der für ${this.stilName(w.stil)} steht.`
            : `${w.verein} hat Trainer ${w.alt} entlassen${w.platz ? ` - Platz ${w.platz}` : ""}. Nachfolger ist ${w.neu}, der für ${this.stilName(w.stil)} steht. Die Mannschaft dürfte in den nächsten Wochen mit neuem Schwung auftreten.`;
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: "Sportpresse",
            subject: `🔄 Trainerwechsel bei ${w.verein}`,
            body: text,
            read: false,
            type: "news"
        });
    },

    /** Die Wechsel dieser Saison in einer Liga - für Ranglisten und Nachrichten */
    dieseSaison(state, ligaId) {
        return (state?.trainerwechsel || []).filter(w => w.liga === ligaId && w.saison === (state.seasonYear || 1));
    }
};

if (typeof window !== "undefined") {
    window.TrainerwechselEngine = TrainerwechselEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { TrainerwechselEngine };
}
