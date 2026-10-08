/**
 * JahrespreisEngine - Die Gala nach der Saison, über alle Ligen hinweg
 *
 * Die Saisonpreise (AuszeichnungEngine) gelten je Liga: Der beste Spieler
 * der Ligue 1 und der beste der Bundesliga stehen nebeneinander, ohne dass
 * jemand fragt, wer von beiden der Beste ist. Jetzt gibt es am Saisonende
 * eine Wahl über die fünf ersten Ligen und den Europapokal:
 *
 *   Weltfußballer   - die drei Besten auf dem Podest. Gewertet wird die
 *                     Saison (Noten, Tore, Vorlagen), die Stärke der Liga und
 *                     was gewonnen wurde - ein Meister mit Henkelpott schlägt
 *                     den Torschützen eines Mittelfeldklubs. Und wie bei jeder
 *                     Wahl zählt der Name ein wenig mit.
 *   Talent          - der beste Spieler bis 21 aus den ersten beiden Ligen.
 *   Torjäger Europas - Ligatore mit Faktor: zwei in den ersten Ligen,
 *                     anderthalb in den zweiten, sonst einer.
 *   Trainer         - wer am meisten gewonnen und am weitesten über seinem
 *                     Kader gelandet ist.
 *   Elf des Jahres  - im 4-3-3, je Platz der Beste der Wahl.
 *
 * Wer ausgezeichnet wird, trägt es in der Akte, ist mehr wert und besser
 * gelaunt. Gewinnt der eigene Trainer, steigt sein Ruf.
 */

const _jpResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const JahrespreisEngine = {
    /** Anteil der Ligaspiele, den ein Spieler für die Wahl gespielt haben muss */
    MIN_ANTEIL: 0.6,
    TALENT_ALTER: 21,
    /** So viele Jahrgänge bleiben gespeichert */
    GEMERKT: 10,
    /** Abzug je Punkt, den die Liga schwächer ist als die stärkste */
    LIGA_ABZUG: 0.03,
    /** Was ein Titel in der Wahl bringt */
    TITEL_BONUS: { ucl: 0.32, uel: 0.12, uecl: 0.05, meister: 0.14, pokal: 0.05, uclFinale: 0.12 },
    /** So viel zählt ein Trainer des Jahres für den Ruf (ein Trainer der Saison: 3) */
    TRAINER_RUF: 5,
    /** Ein großer Name zieht Stimmen - je Stärkepunkt über 78 */
    NAME_BONUS: 0.012,
    /** Torfaktor je Ligastufe für den Torjäger Europas */
    TORFAKTOR: { 1: 2, 2: 1.5 },
    /** Lohn für die Preisträger: Marktwert und Laune */
    LOHN: {
        weltfussballer: [0.15, 8], podest: [0.08, 5], talentJahr: [0.12, 6],
        torjaegerEuropa: [0.06, 4], elfJahr: [0.04, 3]
    },

    NAMEN: {
        weltfussballer: "Weltfußballer des Jahres", talentJahr: "Talent des Jahres",
        torjaegerEuropa: "Torjäger Europas", elfJahr: "Elf des Jahres"
    },

    _preise() { return _jpResolve("AuszeichnungEngine", "./auszeichnungEngine.js"); },

    _ligen(state, stufe) {
        return (state.leagues || []).filter(l => (l.level || 1) === stufe).map(l => l.id);
    },

    _tabelle(state, ligaId) {
        const eigene = (state.clubs || []).find(c => c.id === state.userClubId)?.leagueId;
        if (ligaId === eigene && Array.isArray(state.standings) && state.standings.length) return state.standings;
        return (state.standingsByLeague || {})[ligaId] || [];
    },

    /** Stärke je Verein: Schnitt der besten elf */
    _vereinsStaerke(state) {
        const je = new Map();
        (state.players || []).forEach(p => {
            if (!p || !p.clubId) return;
            if (!je.has(p.clubId)) je.set(p.clubId, []);
            je.get(p.clubId).push(p.overall || 0);
        });
        const st = new Map();
        je.forEach((werte, id) => {
            const elf = werte.sort((a, b) => b - a).slice(0, 11);
            st.set(id, elf.reduce((s, x) => s + x, 0) / Math.max(1, elf.length));
        });
        return st;
    },

    /** Was jeder Verein in dieser Saison gewonnen hat: clubId -> [{ art, name }] */
    titel(state) {
        const titel = new Map();
        const dazu = (id, art, name) => {
            if (!id) return;
            if (!titel.has(id)) titel.set(id, []);
            titel.get(id).push({ art, name });
        };
        this._ligen(state, 1).forEach(ligaId => {
            const t = this._tabelle(state, ligaId);
            const liga = (state.leagues || []).find(l => l.id === ligaId);
            if (t[0] && (t[0].played || 0) > 0) dazu(t[0].clubId, "meister", `Meister ${liga?.shortName || liga?.name || ""}`.trim());
        });
        Object.values(state.cups || {}).forEach(c => { if (c && c.completed && c.winnerId) dazu(c.winnerId, "pokal", c.name || "Pokal"); });
        const ec = state.europeanCompetitions || {};
        Object.keys(ec).forEach(id => {
            const w = ec[id];
            if (!w || !w.completed || !w.winnerId) return;
            dazu(w.winnerId, id, w.name || id.toUpperCase());
            // Der Finalist der Königsklasse bekommt auch Stimmen
            if (id === "ucl") {
                const finale = (w.endrunde || [])[(w.endrunde || []).length - 1];
                const m = finale && (finale.matches || [])[0];
                const zweiter = m ? (m.homeClubId === w.winnerId ? m.awayClubId : m.homeClubId) : null;
                if (zweiter && zweiter !== w.winnerId) dazu(zweiter, "uclFinale", `Finale ${w.name || "Königsklasse"}`);
            }
        });
        return titel;
    },

    _titelBonus(liste) {
        return (liste || []).reduce((s, t) => s + (this.TITEL_BONUS[t.art] || 0), 0);
    },

    /**
     * Alle Spieler der Wahl mit ihrer Wertung. Aus den ersten Ligen - und auf
     * Wunsch (Talent) auch aus den zweiten.
     */
    kandidaten(state, stufen = [1], kontext = null) {
        const k = kontext || this._kontext(state);
        const preise = this._preise();
        const ligen = new Set(stufen.flatMap(s => this._ligen(state, s)));
        const vereine = new Map((state.clubs || []).filter(c => ligen.has(c.leagueId)).map(c => [c.id, c]));
        const runden = new Map();
        vereine.forEach(c => runden.set(c.leagueId, (runden.get(c.leagueId) || 0) + 1));
        return (state.players || []).filter(p => p && vereine.has(p.clubId)).map(p => {
            const club = vereine.get(p.clubId);
            const s = p.stats || {};
            const spiele = s.matches || 0;
            const minSpiele = Math.max(3, Math.round(Math.max(1, ((runden.get(club.leagueId) || 2) - 1) * 2) * this.MIN_ANTEIL));
            if (spiele < minSpiele) return null;
            const leistung = preise && typeof preise.wertung === "function"
                ? preise.wertung(spiele, s.goals || 0, s.assists || 0, s.ratingSum || 0)
                : (s.ratingSum || 0) / spiele;
            const ligaAbzug = Math.max(0, (k.staerksteLiga - (k.ligaStaerke.get(club.leagueId) || k.staerksteLiga))) * this.LIGA_ABZUG
                + ((club.level || 1) - 1) * 0.5;
            const titel = k.titel.get(club.id) || [];
            const wert = leistung - ligaAbzug + this._titelBonus(titel) + Math.max(0, (p.overall || 0) - 78) * this.NAME_BONUS;
            return { p, club, spiele, tore: s.goals || 0, vorlagen: s.assists || 0, note: (s.ratingSum || 0) / spiele, titel, wert };
        }).filter(Boolean).sort((a, b) => b.wert - a.wert);
    },

    _kontext(state) {
        const staerke = this._vereinsStaerke(state);
        const ligaStaerke = new Map();
        this._ligen(state, 1).forEach(ligaId => {
            const werte = (state.clubs || []).filter(c => c.leagueId === ligaId).map(c => staerke.get(c.id) || 0).filter(x => x > 0);
            if (werte.length) ligaStaerke.set(ligaId, werte.reduce((s, x) => s + x, 0) / werte.length);
        });
        return { staerke, ligaStaerke, staerksteLiga: Math.max(0, ...ligaStaerke.values()), titel: this.titel(state) };
    },

    /** Torjäger Europas: Ligatore mal Faktor der Stufe, über alle Ligen */
    torjaeger(state) {
        const vereine = new Map((state.clubs || []).map(c => [c.id, c]));
        const statistik = _jpResolve("StatistikEngine", "./statistikEngine.js");
        let bester = null;
        (state.players || []).forEach(p => {
            const club = p && vereine.get(p.clubId);
            if (!club || !((p?.stats?.goals || 0) > 0)) return;
            const liga = statistik ? statistik.von(p, "liga") : p.stats;
            const tore = liga.goals || 0;
            if (tore <= 0) return;
            const punkte = tore * (this.TORFAKTOR[club.level || 1] || 1);
            if (!bester || punkte > bester.punkte || (punkte === bester.punkte && (liga.matches || 0) < bester.spiele)) {
                bester = { p, club, tore, punkte, spiele: liga.matches || 0 };
            }
        });
        return bester;
    },

    /**
     * Trainer des Jahres: Titel zählen am meisten, dazu wie weit ein Verein
     * über dem Platz landet, den ihm sein Kader verspricht.
     */
    trainer(state, kontext = null) {
        const k = kontext || this._kontext(state);
        const punkte = { ucl: 3, meister: 2, uel: 1.5, uecl: 0.8, pokal: 0.6, uclFinale: 0.8 };
        let bester = null;
        this._ligen(state, 1).forEach(ligaId => {
            const tabelle = this._tabelle(state, ligaId);
            // Eine Tabelle ohne Spiele sagt nichts über den Trainer
            if (!tabelle.some(r => (r.played || 0) > 0)) return;
            const erwartet = new Map(tabelle.map(r => r.clubId)
                .sort((a, b) => (k.staerke.get(b) || 0) - (k.staerke.get(a) || 0))
                .map((id, i) => [id, i + 1]));
            tabelle.forEach((r, i) => {
                const platz = i + 1;
                const sprung = (erwartet.get(r.clubId) || platz) - platz;
                const titel = k.titel.get(r.clubId) || [];
                const wert = titel.reduce((s, t) => s + (punkte[t.art] || 0), 0) + Math.max(0, sprung) * 0.35 - (platz - 1) * 0.02;
                if (!bester || wert > bester.wert) bester = { clubId: r.clubId, platz, erwartet: erwartet.get(r.clubId) || platz, titel, wert, ligaId };
            });
        });
        if (!bester) return null;
        const club = (state.clubs || []).find(c => c.id === bester.clubId);
        const titelText = bester.titel.map(t => t.name).join(", ");
        const karussell = _jpResolve("TrainerwechselEngine", "./trainerwechselEngine.js");
        const kopf = club && bester.clubId !== state.userClubId && karussell && typeof karussell.trainer === "function"
            ? karussell.trainer(state, club) : null;
        return {
            clubId: bester.clubId, verein: club?.name || "", name: kopf?.name || null, platz: bester.platz, erwartet: bester.erwartet,
            grund: titelText || `Platz ${bester.platz} mit einem Kader für Platz ${bester.erwartet}`,
            istNutzer: bester.clubId === state.userClubId
        };
    },

    _eintrag(k, extra = {}) {
        return k ? {
            id: k.p.id, name: k.p.name, pos: k.p.pos, alter: k.p.age, clubId: k.p.clubId,
            spiele: k.spiele, tore: k.tore, vorlagen: k.vorlagen,
            note: k.note !== undefined ? Math.round(k.note * 100) / 100 : undefined,
            titel: (k.titel || []).map(t => t.name), ...extra
        } : null;
    },

    /** Die Preise des Jahres - ohne zu vergeben */
    ermittle(state) {
        if (!state) return null;
        const kontext = this._kontext(state);
        const wahl = this.kandidaten(state, [1], kontext);
        if (!wahl.length) return null;
        const podest = wahl.slice(0, 3).map((k, i) => this._eintrag(k, { platz: i + 1 }));
        const talent = this.kandidaten(state, [1, 2], kontext).find(k => (k.p.age || 30) <= this.TALENT_ALTER) || null;
        const tj = this.torjaeger(state);

        const preise = this._preise();
        const elfPlaetze = (preise && preise.ELF) || [];
        const vergeben = new Set();
        const elf = elfPlaetze.map(platz => {
            const k = wahl.find(x => !vergeben.has(x.p.id) && platz.pos.includes(x.p.pos));
            if (!k) return null;
            vergeben.add(k.p.id);
            return this._eintrag(k, { platz: platz.platz });
        }).filter(Boolean);

        return {
            saison: state.seasonYear || 1,
            weltfussballer: podest,
            talent: this._eintrag(talent),
            torjaeger: tj ? { id: tj.p.id, name: tj.p.name, pos: tj.p.pos, clubId: tj.p.clubId, tore: tj.tore, punkte: tj.punkte, spiele: tj.spiele } : null,
            trainer: this.trainer(state, kontext),
            elf
        };
    },

    _ehre(state, eintrag, art, extra = {}) {
        if (!eintrag) return null;
        const p = (state.players || []).find(x => String(x.id) === String(eintrag.id));
        if (!p) return null;
        if (!Array.isArray(p.auszeichnungen)) p.auszeichnungen = [];
        p.auszeichnungen.push({ art, saison: state.seasonYear || 1, ...extra });
        const [wert, laune] = this.LOHN[extra.platz > 1 ? "podest" : art] || [0, 0];
        if (typeof p.value === "number") p.value = Math.round(p.value * (1 + wert));
        p.morale = Math.min(100, (p.morale ?? 70) + laune);
        return p;
    },

    /**
     * Zum Saisonende, nach den Preisen der Ligen und vor dem Zurücksetzen der
     * Statistik: wählen, ehren, speichern, berichten.
     */
    verleihen(state) {
        const jahr = this.ermittle(state);
        if (!jahr) return null;
        if (!Array.isArray(state.jahrespreise)) state.jahrespreise = [];
        state.jahrespreise = state.jahrespreise.filter(j => j.saison !== jahr.saison);
        state.jahrespreise.push(jahr);
        if (state.jahrespreise.length > this.GEMERKT) state.jahrespreise.splice(0, state.jahrespreise.length - this.GEMERKT);

        jahr.weltfussballer.forEach(e => this._ehre(state, e, "weltfussballer", { platz: e.platz }));
        this._ehre(state, jahr.talent, "talentJahr");
        this._ehre(state, jahr.torjaeger, "torjaegerEuropa");
        jahr.elf.forEach(e => this._ehre(state, e, "elfJahr"));

        this._post(state, jahr);
        // Der eigene Trainer: Vertrauen des Vorstands, und sein Ruf zählt die
        // Gala mit (AuszeichnungEngine.trainerPreise)
        if (jahr.trainer && jahr.trainer.istNutzer) {
            const board = _jpResolve("BoardEngine", "./boardEngine.js");
            if (board && typeof board.stimmung === "function") board.stimmung(state, 6);
        }
        return jahr;
    },

    _post(state, jahr) {
        if (!Array.isArray(state.inbox)) return;
        const verein = (id) => (state.clubs || []).find(c => c.id === id)?.name || "";
        const eigen = (e) => e && e.clubId === state.userClubId;
        const zeile = (e) => `${e.name} (${verein(e.clubId)})`;
        const [erster, ...rest] = jahr.weltfussballer;
        const eigene = [...jahr.weltfussballer, jahr.talent, jahr.torjaeger, ...jahr.elf].filter(eigen);
        const namen = [...new Set(eigene.map(e => e.name))];
        const text = [
            `Weltfußballer des Jahres: ${zeile(erster)} - Note ${String(erster.note).replace(".", ",")}, ${erster.tore} Tore, ${erster.vorlagen} Vorlagen${erster.titel.length ? `, ${erster.titel.join(", ")}` : ""}.`,
            rest.length ? `Dahinter: ${rest.map(e => `${e.platz}. ${zeile(e)}`).join(", ")}.` : null,
            jahr.talent ? `Talent des Jahres: ${zeile(jahr.talent)}, ${jahr.talent.alter} Jahre.` : null,
            jahr.torjaeger ? `Torjäger Europas: ${zeile(jahr.torjaeger)} mit ${jahr.torjaeger.tore} Ligatoren.` : null,
            jahr.trainer ? `Trainer des Jahres: ${jahr.trainer.istNutzer ? "Sie" : (jahr.trainer.name ? `${jahr.trainer.name} (${jahr.trainer.verein})` : `der Trainer von ${jahr.trainer.verein}`)} - ${jahr.trainer.grund}.` : null,
            "",
            `Elf des Jahres: ${jahr.elf.map(e => `${e.platz} ${e.name}`).join(", ")}`,
            namen.length ? `\nAus Ihrem Kader ausgezeichnet: ${namen.join(", ")}.` : null
        ].filter(x => x !== null).join("\n");
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || "", sender: "Fußballverband", subject: `🌍 Die Gala des Jahres: ${erster.name} ist Weltfußballer`,
            body: text, read: false, type: namen.length || jahr.trainer?.istNutzer ? "board_message" : "award"
        });
    },

    /** Die letzten Jahrespreise - für die Ranglisten */
    letzte(state) {
        const liste = Array.isArray(state?.jahrespreise) ? state.jahrespreise : [];
        return liste.length ? liste[liste.length - 1] : null;
    },

    /** Für die Akte */
    name(a) {
        if (a.art === "weltfussballer") return a.platz > 1 ? `Weltfußballer-Wahl, Platz ${a.platz}` : this.NAMEN.weltfussballer;
        return this.NAMEN[a.art] || null;
    }
};

if (typeof window !== "undefined") {
    window.JahrespreisEngine = JahrespreisEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { JahrespreisEngine };
}
