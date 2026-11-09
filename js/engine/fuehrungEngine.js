/**
 * FuehrungEngine - Entscheidungen des Trainers in der Kabine: Strafe nach
 * einem Platzverweis und Sonderprämie vor einem Spiel.
 *
 * Strafe nach glatt Rot (Geldstrafe, Abmahnung, Nachsicht):
 *   Die Geldstrafe bringt einen Wochenlohn in die Kasse. Ob der Spieler
 *   daraus lernt, hängt an seiner Professionalität: Ein Profi reißt sich
 *   zusammen (Temperament sinkt, er sieht künftig seltener Karten), ein
 *   anderer ist nur gekränkt. Die Mannschaft sieht, dass durchgegriffen
 *   wird. Die Abmahnung ist milder und wirkt nur bei sehr Professionellen.
 *   Nachsicht hebt seine Stimmung, ändert aber nichts.
 *
 * Sonderprämie fürs nächste Ligaspiel:
 *   Der Trainer lobt eine Prämie aus (ein Teil der Wochengehälter). Die
 *   Moral der Profis steigt sofort. Gezahlt wird nur bei einem Sieg; ohne
 *   Sieg ist die Mannschaft enttäuscht. Höchstens alle fünf Spieltage -
 *   sonst wird die Prämie zur Gewohnheit.
 */

function _fuResolve(name, pfad) {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { return null; }
    }
    return null;
}

const FuehrungEngine = {
    /** Ab welcher Professionalität eine Strafe wirkt, und was sie an der Moral kostet */
    STRAFE: {
        geldstrafe: { einsichtAb: 11, moralEinsicht: -3, moralTrotz: -12, team: 1 },
        abmahnung: { einsichtAb: 14, moralEinsicht: -1, moralTrotz: -4, team: 0 },
        nachsicht: { moral: 2 }
    },

    /** Sonderprämie: Anteil der Wochengehälter, Moral sofort, Enttäuschung ohne Sieg, Pause in Spieltagen */
    PRAEMIE: { anteil: 0.5, moral: 5, enttaeuschung: -3, pause: 5 },

    _club(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },

    _profis(state) {
        const club = this._club(state);
        if (!club) return [];
        const ids = new Set(club.playerIds || []);
        return (state.players || []).filter(p => ids.has(p.id) && !p.reserve);
    },

    _moral(p, delta) {
        p.morale = Math.max(5, Math.min(100, (p.morale ?? 75) + delta));
    },

    _post(state, betreff, text, playerId = null) {
        if (!Array.isArray(state.inbox)) return;
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday}`, sender: "Co-Trainer",
            subject: betreff, body: text, read: false, type: "board_message",
            ...(playerId !== null ? { relatedEntity: { type: "player", id: playerId } } : {})
        });
    },

    // ------------------------------------------------------------ Strafe

    /** Steht bei diesem Spieler eine Strafe zur Entscheidung? */
    strafeOffen(state, p) {
        return !!(p && p.strafeOffen && p.clubId === state?.userClubId);
    },

    /** Nach dem Spieltag: Platzverweise der eigenen Profis melden (einmal) */
    meldePlatzverweise(state) {
        const gemeldet = [];
        this._profis(state).forEach(p => {
            if (p.strafeOffen !== true) return;
            p.strafeOffen = "gemeldet";
            this._post(state, `Platzverweis: ${p.name}`,
                `${p.name} hat glatt Rot gesehen und fehlt gesperrt. Wollen Sie ihn zur Rechenschaft ziehen? In seiner Akte steht unter Aktionen „Platzverweis ahnden“: Geldstrafe (${this.wochenlohn(p).toLocaleString("de-DE")} €), Abmahnung oder Nachsicht.`, p.id);
            gemeldet.push(p.id);
        });
        return gemeldet;
    },

    wochenlohn(p) { return Math.round(p?.wage || 0); },

    /** Geldstrafe, Abmahnung oder Nachsicht */
    ahnde(state, playerId, art) {
        const p = (state?.players || []).find(x => String(x.id) === String(playerId));
        if (!this.strafeOffen(state, p)) return { ok: false, grund: "Hier steht keine Strafe an." };
        const regel = this.STRAFE[art];
        if (!regel) return { ok: false, grund: "Unbekannte Strafe." };
        const club = this._club(state);
        p.strafeOffen = null;
        if (art === "nachsicht") {
            this._moral(p, regel.moral);
            return { ok: true, art, einsicht: false, text: `Sie belassen es bei einem Gespräch. ${p.name} ist erleichtert.` };
        }
        const h = p.hiddenAttributes || {};
        const einsicht = (h.professionalism ?? 12) >= regel.einsichtAb;
        let betrag = 0;
        if (art === "geldstrafe") {
            betrag = this.wochenlohn(p);
            club.balance = (club.balance || 0) + betrag;
            const fe = _fuResolve("FinanceEngine", "./financeEngine.js");
            if (fe && typeof fe.recordTransaction === "function") fe.recordTransaction(state, club.id, "other", betrag, `Geldstrafe: ${p.name} (Platzverweis)`);
        }
        this._moral(p, einsicht ? regel.moralEinsicht : regel.moralTrotz);
        if (einsicht && p.hiddenAttributes && typeof h.temperament === "number") p.hiddenAttributes.temperament = Math.max(3, h.temperament - 1);
        if (regel.team) this._profis(state).forEach(q => { if (q !== p) this._moral(q, regel.team); });
        const was = art === "geldstrafe" ? `zahlt ${betrag.toLocaleString("de-DE")} € Strafe` : "ist abgemahnt";
        return { ok: true, art, einsicht, betrag,
            text: einsicht ? `${p.name} ${was} und nimmt es an. Er will sich künftig besser im Griff haben.`
                : `${p.name} ${was} und fühlt sich ungerecht behandelt.` };
    },

    // ------------------------------------------------------------ Sonderprämie

    /** Was die Prämie kostet und ob sie gerade geht */
    praemie(state) {
        const club = this._club(state);
        if (!club) return null;
        const s = state.sonderpraemie || {};
        const betrag = Math.round(this._profis(state).reduce((n, p) => n + (p.wage || 0), 0) * this.PRAEMIE.anteil / 1000) * 1000;
        const spieltag = state.currentMatchday || 1;
        let grund = null;
        if (s.aktiv) grund = "Die Prämie fürs nächste Ligaspiel ist schon ausgelobt.";
        else if (typeof s.letzter === "number" && s.saison === (state.seasonYear || 1) && spieltag - s.letzter < this.PRAEMIE.pause) {
            grund = `Die letzte Sonderprämie ist erst ${spieltag - s.letzter} Spieltage her. Frühestens nach ${this.PRAEMIE.pause} wirkt sie wieder.`;
        } else if ((club.balance || 0) < betrag) grund = "Dafür reicht das Geld auf dem Konto nicht.";
        return { ok: !grund, grund, betrag, aktiv: !!s.aktiv, moral: this.PRAEMIE.moral };
    },

    /** Prämie ausloben: Die Moral der Profis steigt sofort */
    lobeAus(state) {
        const o = this.praemie(state);
        if (!o) return { ok: false, grund: "Kein Verein." };
        if (!o.ok) return { ok: false, grund: o.grund };
        state.sonderpraemie = { aktiv: true, betrag: o.betrag, spieltag: state.currentMatchday || 1, saison: state.seasonYear || 1 };
        this._profis(state).forEach(p => this._moral(p, this.PRAEMIE.moral));
        return { ok: true, betrag: o.betrag, text: `Sonderprämie ausgelobt: ${o.betrag.toLocaleString("de-DE")} € bei einem Sieg im nächsten Ligaspiel.` };
    },

    /** Nach dem Ligaspiel (FinanceEngine.bucheErfolgspraemie): zahlen oder enttäuscht sein */
    rechneAb(state, match) {
        const s = state?.sonderpraemie;
        if (!s || !s.aktiv || !match) return null;
        const club = this._club(state);
        const heim = match.homeClubId === state.userClubId, gast = match.awayClubId === state.userClubId;
        if (!club || (!heim && !gast)) return null;
        const eigene = heim ? match.homeGoals : match.awayGoals, fremde = heim ? match.awayGoals : match.homeGoals;
        const sieg = eigene > fremde;
        state.sonderpraemie = { aktiv: false, letzter: state.currentMatchday || 1, saison: state.seasonYear || 1 };
        if (sieg) {
            club.balance = (club.balance || 0) - s.betrag;
            const fe = _fuResolve("FinanceEngine", "./financeEngine.js");
            if (fe && typeof fe.recordTransaction === "function") fe.recordTransaction(state, club.id, "bonus", -s.betrag, `Sonderprämie (${eigene}:${fremde})`);
            this._post(state, "Sonderprämie verdient", `Die Mannschaft hat ${eigene}:${fremde} gewonnen und sich die Sonderprämie von ${s.betrag.toLocaleString("de-DE")} € verdient.`);
        } else {
            this._profis(state).forEach(p => this._moral(p, this.PRAEMIE.enttaeuschung));
            this._post(state, "Sonderprämie verpasst", `Kein Sieg (${eigene}:${fremde}), also keine Sonderprämie. Die Mannschaft ist enttäuscht.`);
        }
        return { sieg, betrag: sieg ? s.betrag : 0 };
    }
};

if (typeof window !== "undefined") {
    window.FuehrungEngine = FuehrungEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { FuehrungEngine };
}
