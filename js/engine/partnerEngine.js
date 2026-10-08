/**
 * PartnerEngine - Kooperationen mit einem kleineren und einem größeren Verein
 *
 * Große Vereine parken ihre Talente bei einem befreundeten Klub, der sie
 * spielen lässt; kleine Vereine bekommen von einem großen Partner Spieler
 * geliehen, die dort nicht zum Zug kommen. Bisher gab es das nicht - jede
 * Leihe ging an irgendeinen Interessenten, mit ungewissen Einsätzen.
 *
 * Der eigene Verein kann zwei Partner haben, je für drei Spielzeiten:
 *   Ausbildungspartner - ein kleinerer Verein (tiefere Liga oder deutlich
 *                        kleiner). Er kostet einen Jahresbeitrag. Dafür:
 *                        Leihen dorthin mit Einsatzgarantie (er spielt jedes
 *                        Spiel, wenn er fit ist), und zum Saisonstart das
 *                        beste Talent des Partners mit Vorkaufsrecht.
 *   Großer Partner     - ein deutlich größerer Verein. Er bietet zum
 *                        Saisonstart junge Spieler zur Leihe an, ohne Gebühr
 *                        und mit halbem Gehalt.
 */

const _ptResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const PartnerEngine = {
    LAUFZEIT: 3,
    /** Jahresbeitrag an den Ausbildungspartner: Anteil am Jahresumsatz */
    BEITRAG: 0.004,
    /** Das Vorkaufsrecht: Preis gemessen am Marktwert */
    VORKAUF_PREIS: 0.6,
    /** Leihen beim großen Partner: Gehaltsanteil */
    LEIH_ANTEIL: 0.5,
    /** Ab so viel Ansehen Unterschied gilt ein Verein als kleiner bzw. größer */
    ABSTAND: 12,

    _club(state, id) { return (state?.clubs || []).find(c => c.id === id) || null; },
    _eigener(state) { return this._club(state, state?.userClubId); },
    _land(club) {
        const ligen = _ptResolve("LEAGUES_DATA", "../data/leagueData.js") || [];
        const liste = Array.isArray(ligen) ? ligen : (ligen.LEAGUES_DATA || []);
        return liste.find(l => l.id === club?.leagueId)?.countryId || null;
    },
    _geld(betrag) {
        const gs = _ptResolve("GameState", "./gameState.js");
        return gs && typeof gs.formatMoney === "function" ? gs.formatMoney(betrag) : `${Math.round(betrag)} €`;
    },
    _post(state, absender, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`, sender: absender, subject: betreff, body: text, read: false, type: "club" });
    },

    /** Die aktuellen Partner: { klein, gross } mit Verein und Laufzeit */
    partner(state) {
        const club = this._eigener(state);
        const p = club?.partner || {};
        const aktiv = (e) => e && e.bisSaison >= (state.seasonYear || 1) ? { ...e, club: this._club(state, e.clubId) } : null;
        return { klein: aktiv(p.klein), gross: aktiv(p.gross) };
    },

    /** Wer als Partner infrage kommt - die naheliegenden zuerst */
    vorschlaege(state, art, anzahl = 4) {
        const eigener = this._eigener(state);
        if (!eigener) return [];
        const land = this._land(eigener);
        const ruf = eigener.reputation || 50;
        const stufe = eigener.level || 1;
        // Zweite Mannschaften gehören zu ihrem Verein - Partner werden sie nicht
        const reserve = (c) => /\s(II|U23|B)$/.test(String(c.name || ""));
        return (state.clubs || []).filter(c => {
            if (c.id === eigener.id || reserve(c)) return false;
            if (art === "klein") return this._land(c) === land && ((c.level || 1) > stufe || (c.reputation || 50) <= ruf - this.ABSTAND) && (c.level || 1) <= stufe + 2;
            return (c.reputation || 50) >= ruf + this.ABSTAND;
        })
            .map(c => ({ club: c, abstand: Math.abs((c.reputation || 50) - (art === "klein" ? ruf - 20 : ruf + 15)) + (this._land(c) === land ? 0 : 6) }))
            .sort((a, b) => a.abstand - b.abstand)
            .slice(0, anzahl)
            .map(x => x.club);
    },

    /**
     * Eine Kooperation anbieten. Ein kleinerer Verein sagt gern zu. Ein
     * größerer nur, wenn der eigene Verein und der Trainer etwas gelten.
     */
    anbieten(state, art, clubId) {
        const eigener = this._eigener(state);
        const partner = this._club(state, clubId);
        if (!eigener || !partner || !["klein", "gross"].includes(art)) return { success: false, error: "Diesen Verein gibt es nicht." };
        if (this.partner(state)[art]) return { success: false, error: "Es besteht schon eine Kooperation - erst kündigen." };
        if (!this.vorschlaege(state, art, Infinity).some(c => c.id === clubId)) {
            return { success: false, error: art === "klein" ? "Der Verein ist nicht kleiner als Ihrer." : "Der Verein ist nicht deutlich größer als Ihrer." };
        }
        if (art === "gross") {
            const karriere = _ptResolve("CareerEngine", "./careerEngine.js");
            const trainerRuf = karriere && typeof karriere.ruf === "function" ? karriere.ruf(state) : 50;
            const reicht = (eigener.reputation || 50) + trainerRuf * 0.3 >= (partner.reputation || 50) - 5;
            if (!reicht) return { success: false, error: `${partner.name} lehnt ab - ein Partner auf Augenhöhe wäre ihnen lieber.` };
        }
        eigener.partner = eigener.partner || {};
        eigener.partner[art] = { clubId, seit: state.seasonYear || 1, bisSaison: (state.seasonYear || 1) + this.LAUFZEIT - 1 };
        if (art === "klein") this._beitrag(state);
        this.saisonAngebote(state, art);
        this._post(state, partner.name, `🤝 Kooperation mit ${partner.name}`,
            art === "klein"
                ? `${partner.name} ist für ${this.LAUFZEIT} Spielzeiten unser Ausbildungspartner. Wer dorthin verliehen wird, spielt. Und das beste Talent des Partners bekommen wir zuerst angeboten.`
                : `${partner.name} ist für ${this.LAUFZEIT} Spielzeiten unser Partner. Zum Saisonstart bieten sie uns junge Spieler zur Leihe an.`);
        return { success: true };
    },

    kuendigen(state, art) {
        const eigener = this._eigener(state);
        if (!eigener?.partner?.[art]) return { success: false, error: "Es besteht keine Kooperation." };
        delete eigener.partner[art];
        if (eigener.partnerAngebote) delete eigener.partnerAngebote[art];
        return { success: true };
    },

    /** Der Jahresbeitrag an den Ausbildungspartner */
    _beitrag(state) {
        const eigener = this._eigener(state);
        const p = this.partner(state).klein;
        if (!eigener || !p || !p.club) return 0;
        const fin = _ptResolve("FinanceEngine", "./financeEngine.js");
        const umsatz = fin && typeof fin.einnahmenSchaetzung === "function" ? fin.einnahmenSchaetzung(eigener, state) * 34 : 20000000;
        const betrag = Math.max(20000, Math.round(umsatz * this.BEITRAG / 10000) * 10000);
        eigener.balance = (eigener.balance || 0) - betrag;
        p.club.balance = (p.club.balance || 0) + betrag;
        if (fin && typeof fin.recordTransaction === "function") fin.recordTransaction(state, eigener.id, "other", -betrag, `Kooperationsbeitrag ${p.club.name}`);
        return betrag;
    },

    /** Zum Saisonstart: Beitrag, Vorkaufsrecht und Leihangebote - abgelaufene Partner enden */
    saisonstart(state) {
        const eigener = this._eigener(state);
        if (!eigener?.partner) return;
        ["klein", "gross"].forEach(art => {
            const e = eigener.partner[art];
            if (e && e.bisSaison < (state.seasonYear || 1)) {
                const club = this._club(state, e.clubId);
                delete eigener.partner[art];
                if (eigener.partnerAngebote) delete eigener.partnerAngebote[art];
                this._post(state, club?.name || "Partner", "Kooperation ausgelaufen",
                    `Die Kooperation mit ${club?.name || "dem Partner"} ist ausgelaufen. Im Reiter Verein lässt sie sich neu schließen.`);
            }
        });
        if (this.partner(state).klein) this._beitrag(state);
        this.saisonAngebote(state, "klein");
        this.saisonAngebote(state, "gross");
    },

    /** Was der Partner in dieser Saison anbietet */
    saisonAngebote(state, art) {
        const eigener = this._eigener(state);
        const p = this.partner(state)[art];
        if (!eigener || !p || !p.club) return null;
        eigener.partnerAngebote = eigener.partnerAngebote || {};
        const kader = (state.players || []).filter(x => x.clubId === p.club.id && !x.leihe && !x.vorvertrag);
        if (art === "klein") {
            const talent = kader.filter(x => (x.age || 30) <= 20).sort((a, b) => (b.pot || b.overall || 0) - (a.pot || a.overall || 0))[0];
            eigener.partnerAngebote.klein = talent
                ? { saison: state.seasonYear || 1, playerId: talent.id, preis: Math.round((talent.value || 0) * this.VORKAUF_PREIS / 10000) * 10000 }
                : null;
        } else {
            const leihe = kader.filter(x => (x.age || 30) <= 23).sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 2);
            eigener.partnerAngebote.gross = leihe.length ? { saison: state.seasonYear || 1, playerIds: leihe.map(x => x.id) } : null;
        }
        return eigener.partnerAngebote[art];
    },

    /** Das Talent mit Vorkaufsrecht verpflichten */
    vorkaufsrecht(state) {
        const eigener = this._eigener(state);
        const a = eigener?.partnerAngebote?.klein;
        const p = a ? (state.players || []).find(x => String(x.id) === String(a.playerId)) : null;
        const partner = this.partner(state).klein;
        if (!a || !p || !partner || a.saison !== (state.seasonYear || 1) || p.clubId !== partner.clubId) return { success: false, error: "Das Angebot gilt nicht mehr." };
        const te = _ptResolve("TransferEngine", "./transferEngine.js");
        const fenster = te && typeof te.fensterHindernis === "function" ? te.fensterHindernis(state) : null;
        if (fenster) return { success: false, error: fenster };
        if (a.preis > (eigener.transferBudget || 0)) return { success: false, error: `Das Transferbudget reicht nicht: ${this._geld(a.preis)} nötig.` };
        const lohn = Math.round((p.wage || 2000) * 1.3);
        if (!te.executeTransfer(state, p.id, eigener.id, a.preis, lohn, 4)) return { success: false, error: "Der Wechsel ist gescheitert." };
        delete eigener.partnerAngebote.klein;
        return { success: true, player: p, preis: a.preis };
    },

    /** Einen eigenen Spieler zum Ausbildungspartner verleihen - mit Einsatzgarantie */
    verleihen(state, playerId) {
        const partner = this.partner(state).klein;
        const loans = _ptResolve("LoanEngine", "./loanEngine.js");
        const p = (state.players || []).find(x => String(x.id) === String(playerId));
        if (!partner || !partner.club) return { success: false, error: "Kein Ausbildungspartner." };
        if (!loans) return { success: false, error: "Leihen sind nicht verfügbar." };
        const hindernis = loans.verleihHindernis(state, p);
        if (hindernis) return { success: false, error: hindernis };
        const eigener = this._eigener(state);
        loans._wechsle(state, p, eigener, partner.club);
        delete p.reserve;
        p.leihe = {
            stammvereinId: eigener.id, leihvereinId: partner.club.id, bisSaison: state.seasonYear || 1,
            lohnAnteil: this.LEIH_ANTEIL, rolle: "Stammspieler", garantie: true, seit: loans._stempel(state),
            startSpiele: p.stats?.matches || 0, startTore: p.stats?.goals || 0, startNoten: p.stats?.ratingSum || 0
        };
        p.morale = Math.min(99, (p.morale ?? 75) + 6);
        delete p.versprechen; delete p.mentorId;
        this._post(state, "Transferabteilung", `${p.name} zum Ausbildungspartner`,
            `${p.name} spielt bis zum Saisonende bei ${partner.club.name} - mit Einsatzgarantie. Der Partner übernimmt die Hälfte seines Gehalts.`);
        return { success: true };
    },

    /** Einen Spieler vom großen Partner ausleihen - ohne Gebühr, halbes Gehalt */
    ausleihen(state, playerId) {
        const eigener = this._eigener(state);
        const a = eigener?.partnerAngebote?.gross;
        const partner = this.partner(state).gross;
        const loans = _ptResolve("LoanEngine", "./loanEngine.js");
        const p = (state.players || []).find(x => String(x.id) === String(playerId));
        if (!a || !partner || !p || !(a.playerIds || []).some(id => String(id) === String(playerId)) || p.clubId !== partner.clubId) {
            return { success: false, error: "Das Angebot gilt nicht mehr." };
        }
        const hindernis = loans ? loans.leihHindernis(state, p) : "Leihen sind nicht verfügbar.";
        if (hindernis) return { success: false, error: hindernis };
        loans._wechsle(state, p, partner.club, eigener);
        delete p.reserve;
        p.leihe = {
            stammvereinId: partner.club.id, leihvereinId: eigener.id, bisSaison: state.seasonYear || 1,
            lohnAnteil: this.LEIH_ANTEIL, rolle: "Talent", seit: loans._stempel(state), gebuehr: 0, kaufoption: null,
            startSpiele: p.stats?.matches || 0, startTore: p.stats?.goals || 0, startNoten: p.stats?.ratingSum || 0
        };
        a.playerIds = a.playerIds.filter(id => String(id) !== String(playerId));
        this._post(state, "Transferabteilung", `${p.name} vom Partner ausgeliehen`,
            `${p.name} kommt bis zum Saisonende von ${partner.club.name}. Wir zahlen die Hälfte seines Gehalts, eine Leihgebühr fällt nicht an.`);
        return { success: true };
    },

    /**
     * Für die Aufstellung der KI: Wer mit Einsatzgarantie geliehen ist,
     * spielt - für den Schwächsten im selben Mannschaftsteil.
     */
    garantiereEinsaetze(club, starters, slots, kader) {
        const gruppe = (pos) => pos === "TW" ? "tw" : (["IV", "LV", "RV"].includes(pos) ? "abw" : (["DM", "ZM", "OM", "LM", "RM"].includes(pos) ? "mit" : "ang"));
        const nachId = new Map(kader.map(p => [p.id, p]));
        kader.filter(p => p.leihe && p.leihe.garantie && p.leihe.leihvereinId === club.id && !starters.includes(p.id)
            && !(p.injuredWeeks > 0) && !(p.suspendedMatches > 0)).forEach(p => {
            let platz = -1, wert = Infinity;
            starters.forEach((id, i) => {
                const s = nachId.get(id);
                if (!s || (s.leihe && s.leihe.garantie)) return;
                if (gruppe(slots[i]?.pos || s.pos) !== gruppe(p.pos)) return;
                if ((s.overall || 0) < wert) { wert = s.overall || 0; platz = i; }
            });
            if (platz >= 0) starters[platz] = p.id;
        });
        return starters;
    }
};

if (typeof window !== "undefined") {
    window.PartnerEngine = PartnerEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PartnerEngine };
}
