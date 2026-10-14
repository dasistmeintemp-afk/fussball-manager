/**
 * MeilensteinEngine - Meilensteine, Trophäenschrank und Saisonrückblick
 *
 * Eine Karriere besteht nicht nur aus der Tabelle von heute. Das hundertste
 * Spiel als Trainer, der fünfzigste Treffer des Kapitäns, die fünfte Saison
 * beim selben Verein: Solche Momente gingen bisher unter. Jetzt meldet das
 * Spiel sie, und die Vereinsseite führt sie.
 *
 *   Trainer:  Ligaspiele und Ligasiege als Trainer, die Zahl der Titel,
 *             Spielzeiten beim selben Verein
 *   Spieler:  Pflichtspiele und Tore für den eigenen Verein (aus der
 *             Vereinschronik, die laufende Saison eingeschlossen)
 *
 * Zum Saisonende fasst rueckblick() die Spielzeit zusammen: Platz, Bilanz,
 * Torjäger, bester Spieler, höchster Sieg, bitterste Niederlage,
 * Zuschauer, Titel und die Meilensteine der Saison. trophaeen() ordnet die
 * Titel eines Vereins für den Trophäenschrank.
 */

const _msResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const MeilensteinEngine = {
    TRAINER_SPIELE: [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000],
    TRAINER_SIEGE: [25, 50, 100, 150, 200, 300, 400, 500],
    TITEL: [1, 3, 5, 10, 15, 20, 25],
    SAISONS_IM_VEREIN: [3, 5, 10, 15, 20],
    SPIELER_SPIELE: [50, 100, 150, 200, 250, 300, 400, 500],
    SPIELER_TORE: [25, 50, 75, 100, 150, 200, 250],
    MAX: 80,

    _liste(state) {
        if (!Array.isArray(state.meilensteine)) state.meilensteine = [];
        return state.meilensteine;
    },

    _schon(state, schluessel) {
        if (!state.meilensteinSchluessel || typeof state.meilensteinSchluessel !== "object") state.meilensteinSchluessel = {};
        if (state.meilensteinSchluessel[schluessel]) return true;
        state.meilensteinSchluessel[schluessel] = state.seasonYear || 1;
        return false;
    },

    _vermerke(state, schluessel, icon, text, art, fanText = null) {
        if (this._schon(state, schluessel)) return null;
        const eintrag = { saison: state.seasonYear || 1, datum: state.currentDate || "", icon, text, art };
        const liste = this._liste(state);
        liste.unshift(eintrag);
        if (liste.length > this.MAX) liste.length = this.MAX;
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday || 1,
            date: state.currentDate || "", sender: "Vereinschronik", subject: `${icon} Meilenstein: ${text}`,
            body: `${text}.\n\nDer Eintrag steht in der Vereinschronik unter "Meilensteine".`,
            read: false, type: "chronik"
        });
        const fans = _msResolve("FanEngine", "./fanEngine.js");
        if (fanText && fans && typeof fans.poste === "function") fans.poste(state, fanText, "jubel", "meilenstein");
        return eintrag;
    },

    /** Ligaspiele und -siege als Trainer über alle Stationen, die laufende Saison eingeschlossen */
    trainerBilanz(state) {
        const career = _msResolve("CareerEngine", "./careerEngine.js");
        const akte = state.career || { stationen: [] };
        let spiele = 0, siege = 0;
        (akte.stationen || []).forEach(st => { spiele += st.spiele || 0; siege += st.siege || 0; });
        const offen = (akte.stationen || []).slice(-1)[0];
        const schonAbgeschlossen = offen && !offen.ende && offen.letzteAbgeschlosseneSaison === (state.seasonYear || 1);
        if (offen && !offen.ende && !schonAbgeschlossen && career && typeof career.bilanz === "function") {
            const b = career.bilanz(state);
            spiele += b.spiele || 0; siege += b.siege || 0;
        }
        return { spiele, siege };
    },

    /** Nach jedem Pflichtspiel des eigenen Vereins */
    nachSpiel(state) {
        if (!state || !state.userClubId) return [];
        const neu = [];
        const dazu = (e) => { if (e) neu.push(e); };
        const name = state.managerName || "Der Trainer";

        const t = this.trainerBilanz(state);
        this.TRAINER_SPIELE.filter(n => t.spiele >= n).slice(-1).forEach(n =>
            dazu(this._vermerke(state, `trainer_spiele_${n}`, "🎖️", `${name}: ${n}. Ligaspiel als Trainer`, "trainer")));
        this.TRAINER_SIEGE.filter(n => t.siege >= n).slice(-1).forEach(n =>
            dazu(this._vermerke(state, `trainer_siege_${n}`, "🎖️", `${name}: ${n}. Ligasieg als Trainer`, "trainer")));

        const chronik = _msResolve("ChronikEngine", "./chronikEngine.js");
        if (chronik && typeof chronik.bilanz === "function") {
            const club = (state.clubs || []).find(c => c.id === state.userClubId);
            (state.players || []).filter(p => p.clubId === state.userClubId).forEach(p => {
                const b = chronik.bilanz(state, p);
                const verein = club ? club.name : "den Verein";
                this.SPIELER_SPIELE.filter(n => b.spiele >= n).slice(-1).forEach(n =>
                    dazu(this._vermerke(state, `spiele_${state.userClubId}_${p.id}_${n}`, "👕", `${p.name}: ${n}. Pflichtspiel für ${verein}`, "spieler",
                        `${n} Spiele für uns! Danke für alles, ${p.name}.`)));
                this.SPIELER_TORE.filter(n => b.tore >= n).slice(-1).forEach(n =>
                    dazu(this._vermerke(state, `tore_${state.userClubId}_${p.id}_${n}`, "⚽", `${p.name}: ${n}. Pflichtspieltor für ${verein}`, "spieler",
                        `${n} Tore für den Verein - ${p.name}, du bist eine Legende!`)));
            });
        }
        return neu;
    },

    /** Nach einem Titel (CareerEngine.vermerkeTitel) */
    nachTitel(state, wettbewerb) {
        const zahl = ((state.career && state.career.titel) || []).length;
        if (!this.TITEL.includes(zahl)) return null;
        const name = state.managerName || "Der Trainer";
        return this._vermerke(state, `titel_${zahl}`, "🏆", zahl === 1 ? `${name}: der erste Titel als Trainer (${wettbewerb})` : `${name}: ${zahl}. Titel als Trainer (${wettbewerb})`, "titel");
    },

    /** Zum Saisonende: Spielzeiten beim selben Verein */
    saisonende(state) {
        const c = state && state.chronik && state.chronik[state.userClubId];
        if (!c) return null;
        const jahre = (state.seasonYear || 1) - (c.seit || state.seasonYear || 1) + 1;
        if (!this.SAISONS_IM_VEREIN.includes(jahre)) return null;
        const club = (state.clubs || []).find(x => x.id === state.userClubId);
        return this._vermerke(state, `saisons_${state.userClubId}_${jahre}`, "📅", `${state.managerName || "Der Trainer"}: ${jahre}. Saison bei ${club ? club.name : "diesem Verein"}`, "trainer");
    },

    /** Die Titel eines Vereins für den Trophäenschrank: je Wettbewerb Anzahl und Saisons */
    trophaeen(state, clubId = state && state.userClubId) {
        const c = state && state.chronik && state.chronik[clubId];
        const gruppen = new Map();
        ((c && c.titel) || []).forEach(t => {
            const art = this.art(t.wettbewerb);
            const schluessel = `${art}|${t.wettbewerb}`;
            if (!gruppen.has(schluessel)) gruppen.set(schluessel, { wettbewerb: t.wettbewerb, art, saisons: [] });
            gruppen.get(schluessel).saisons.push(t.saison);
        });
        const ordnung = { meister: 0, europa: 1, pokal: 2, supercup: 3, sonst: 4 };
        return [...gruppen.values()].map(g => Object.assign(g, { anzahl: g.saisons.length, saisons: g.saisons.sort((a, b) => a - b) }))
            .sort((a, b) => (ordnung[a.art] - ordnung[b.art]) || (b.anzahl - a.anzahl));
    },

    /** Welche Art Titel? Bestimmt Symbol und Reihenfolge im Schrank */
    art(wettbewerb) {
        const w = String(wettbewerb || "").toLowerCase();
        if (w.startsWith("meisterschaft")) return "meister";
        if (/supercup|super cup|supercopa|supercoppa|supercoupe/.test(w)) return "supercup";
        const namen = _msResolve("NamenEngine", "./namenEngine.js");
        const ec = namen ? ["ucl", "uel", "uecl"].map(id => namen.wettbewerb(id).toLowerCase()) : [];
        if (ec.includes(w) || /europa|champions|conference|meisterpokal|kontinental|euro-cup/.test(w)) return "europa";
        if (/pokal|cup|copa|coppa|coupe/.test(w)) return "pokal";
        return "sonst";
    },

    /** Die Saison in Zahlen - für den Saisonabschluss */
    rueckblick(state) {
        if (!state || !state.userClubId) return null;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return null;
        const tabelle = Array.isArray(state.standings) ? state.standings : [];
        const zeile = tabelle.find(r => r.clubId === club.id) || {};
        const platz = tabelle.findIndex(r => r.clubId === club.id) + 1;
        const name = id => ((state.clubs || []).find(c => c.id === id) || {}).name || "?";

        let sieg = null, niederlage = null, zuschauer = 0, heimspiele = 0;
        (state.schedule || []).forEach(r => (r.matches || []).forEach(m => {
            if (!m.played || (m.homeClubId !== club.id && m.awayClubId !== club.id)) return;
            const heim = m.homeClubId === club.id;
            const t = heim ? m.homeGoals : m.awayGoals, g = heim ? m.awayGoals : m.homeGoals;
            const d = t - g;
            const eintrag = { ergebnis: `${t}:${g}`, gegner: name(heim ? m.awayClubId : m.homeClubId), heim, diff: d, tore: t, gegentore: g };
            if (d > 0 && (!sieg || d > sieg.diff || (d === sieg.diff && t > sieg.tore))) sieg = eintrag;
            if (d < 0 && (!niederlage || d < niederlage.diff || (d === niederlage.diff && g > niederlage.gegentore))) niederlage = eintrag;
            if (heim && m.attendance > 0) { zuschauer += m.attendance; heimspiele++; }
        }));

        const kader = (state.players || []).filter(p => p.clubId === club.id);
        const torjaeger = kader.filter(p => p.stats && p.stats.goals > 0)
            .sort((a, b) => b.stats.goals - a.stats.goals || (a.stats.matches || 0) - (b.stats.matches || 0))
            .slice(0, 3).map(p => ({ id: p.id, name: p.name, tore: p.stats.goals }));
        const bewertet = kader.filter(p => p.stats && (p.stats.matches || 0) >= 8 && p.stats.ratingSum > 0)
            .map(p => ({ id: p.id, name: p.name, schnitt: p.stats.ratingSum / p.stats.matches, spiele: p.stats.matches }))
            .sort((a, b) => b.schnitt - a.schnitt);
        const saison = state.seasonYear || 1;
        const board = _msResolve("BoardEngine", "./boardEngine.js");
        return {
            saison, verein: club.name, liga: state.leagueName || "", platz: platz || null, von: tabelle.length,
            punkte: zeile.points ?? null, siege: zeile.won || 0, remis: zeile.drawn || 0, niederlagen: zeile.lost || 0,
            tore: zeile.goalsFor || 0, gegentore: zeile.goalsAgainst || 0,
            ziel: board && typeof board.zielText === "function" ? board.zielText(state, club) : null,
            torjaeger, bester: bewertet[0] ? Object.assign(bewertet[0], { schnitt: Math.round(bewertet[0].schnitt * 100) / 100 }) : null,
            hoechsterSieg: sieg, bittersteNiederlage: niederlage,
            zuschauerSchnitt: heimspiele ? Math.round(zuschauer / heimspiele) : null,
            fanStimmung: Math.round(state.fanMood ?? 70),
            titel: ((state.career && state.career.titel) || []).filter(t => t.saison === saison).map(t => t.wettbewerb),
            meilensteine: this._liste(state).filter(m => m.saison === saison)
        };
    }
};

if (typeof window !== "undefined") {
    window.MeilensteinEngine = MeilensteinEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { MeilensteinEngine };
}
