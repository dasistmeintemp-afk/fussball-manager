/**
 * EhemaligeEngine - Wer aufhört, bleibt dem Verein verbunden
 *
 * Bisher verschwand ein Spieler mit dem Karriereende spurlos aus der Welt,
 * auch der Kapitän mit 300 Spielen. Jetzt:
 *
 *   Ehemalige    - Wer mindestens 40 Spiele für den eigenen Verein gemacht
 *                  hat (auch wenn er zuletzt woanders spielte), steht nach
 *                  dem Karriereende vier Jahre lang auf der Liste. In der
 *                  Vorbereitung bewirbt er sich mit etwas Glück für den
 *                  Trainerstab - als Co-Trainer, Analyst, Athletiktrainer,
 *                  Chefscout oder Nachwuchsleiter, je nach Position. Er
 *                  verlangt weniger als ein Fremder (Herzensverein), eine
 *                  Legende bringt etwas mehr Güte mit und hebt die Stimmung
 *                  in der Kabine.
 *   Abschied     - Hört eine Vereinslegende auf, darf der Verein ihr in
 *                  dieser Saison ein Abschiedsspiel ausrichten: volles
 *                  Stadion, die Hälfte der Einnahmen für den Verein, die
 *                  andere Hälfte für einen guten Zweck. Ergebnis und
 *                  Zuschauer stehen in der Chronik.
 */

const _ehResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const EhemaligeEngine = {
    /** So viele Spiele für den Verein, damit einer als Ehemaliger zählt */
    MIN_SPIELE: 40,
    /** So viele Jahre nach dem Karriereende kommt er als Bewerber infrage */
    JAHRE: 4,
    /** Je Vorbereitung bewirbt er sich mit dieser Chance */
    CHANCE: 0.6,
    /** Herzensverein: Er verlangt weniger als der Markt */
    RABATT: 0.85,
    /** Eine Legende bringt mehr mit - und hebt die Stimmung */
    LEGENDE_GUETE: 6,
    LEGENDE_MORAL: 3,
    /** Abschiedsspiel: Anteil der Einnahmen für den Verein (der Rest geht an einen guten Zweck) */
    ABSCHIED_ANTEIL: 0.5,
    /** Höchstens so viele Ehemalige merkt sich der Verein */
    LISTE: 40,

    /** Welche Aufgabe zu welcher Position passt - mit Gewicht */
    NEIGUNG: {
        TW: { cotrainer: 3, nachwuchs: 2, scout: 2, fitness: 1 },
        IV: { cotrainer: 4, nachwuchs: 3, fitness: 2, scout: 1 },
        AV: { nachwuchs: 3, fitness: 3, scout: 2, cotrainer: 2 },
        MF: { cotrainer: 4, analyse: 3, nachwuchs: 3 },
        ST: { scout: 4, cotrainer: 3, nachwuchs: 2 }
    },

    _eigener(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },
    _gruppe(pos) {
        if (pos === "TW") return "TW";
        if (pos === "IV") return "IV";
        if (["LV", "RV", "LM", "RM"].includes(pos)) return "AV";
        if (["DM", "ZM", "OM"].includes(pos)) return "MF";
        return "ST";
    },
    _geld(betrag) {
        const gs = _ehResolve("GameState", "./gameState.js");
        return gs && typeof gs.formatMoney === "function" ? gs.formatMoney(betrag) : `${Math.round(betrag)} €`;
    },
    _post(state, absender, betreff, text, type = "club") {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || `Saison ${state.seasonYear || 1}`, sender: absender, subject: betreff, body: text, read: false, type });
    },

    bereichFuer(pos, zufall = Math.random) {
        const n = this.NEIGUNG[this._gruppe(pos)];
        const summe = Object.values(n).reduce((s, w) => s + w, 0);
        let r = zufall() * summe;
        return Object.keys(n).find(k => (r -= n[k]) < 0) || Object.keys(n)[0];
    },

    /**
     * Aus SeasonEngine.processRetirements, bevor die Spieler die Welt
     * verlassen: Wer genug Spiele für den eigenen Verein gemacht hat, kommt
     * auf die Liste der Ehemaligen; Legenden bekommen ein Abschiedsspiel.
     */
    karriereende(state, spieler, zufall = Math.random) {
        const club = this._eigener(state);
        const chronik = _ehResolve("ChronikEngine", "./chronikEngine.js");
        if (!club || !chronik || typeof chronik.bilanz !== "function") return [];
        const titel = (state.chronik?.[club.id]?.titel || []).length;
        const neu = [];
        (spieler || []).forEach(p => {
            const b = chronik.bilanz(state, p, club.id);
            if (b.spiele < this.MIN_SPIELE) return;
            const legende = typeof chronik.istLegende === "function" && chronik.istLegende(b, titel);
            const e = {
                id: p.id, name: p.name, pos: p.pos, alter: p.age || 35, spiele: b.spiele, tore: b.tore,
                legende, staerke: p.overall || 60, saison: state.seasonYear || 1, bereich: this.bereichFuer(p.pos, zufall),
                zuletzt: p.clubId === club.id ? null : ((state.clubs || []).find(c => c.id === p.clubId)?.name || null)
            };
            neu.push(e);
            if (legende) {
                state.abschiedsspiele = Array.isArray(state.abschiedsspiele) ? state.abschiedsspiele : [];
                state.abschiedsspiele.push({ id: p.id, name: p.name, spiele: b.spiele, tore: b.tore, saison: state.seasonYear || 1, clubId: club.id, status: "offen" });
                this._post(state, "Vorstand", `🏟️ Abschiedsspiel für ${p.name}?`,
                    `${p.name} beendet die Karriere - ${b.spiele} Spiele und ${b.tore} Tore für ${club.name}. Eine Legende verdient einen Abschied vor vollem Haus.\n\n`
                    + `Im Reiter Verein können Sie in dieser Saison ein Abschiedsspiel ansetzen. Die Hälfte der Einnahmen geht an einen guten Zweck.`);
            }
        });
        if (neu.length) {
            const liste = Array.isArray(club.ehemalige) ? club.ehemalige : [];
            club.ehemalige = [...neu, ...liste].slice(0, this.LISTE);
        }
        return neu;
    },

    /** Was ein Ehemaliger im Stab taugt: Vereinsniveau, seine Klasse, Legendenstatus */
    guete(club, e, zufall = Math.random) {
        const pre = _ehResolve("PreseasonEngine", "./preseasonEngine.js");
        const basis = pre && typeof pre.stabNiveau === "function" ? pre.stabNiveau(club) : 55;
        return Math.max(25, Math.min(95, Math.round(basis + ((e.staerke || 60) - 70) * 0.25 + (e.legende ? this.LEGENDE_GUETE : 0) + (zufall() * 12 - 6))));
    },

    /** Wer gerade als Ehemaliger infrage kommt */
    verfuegbar(state, club = null) {
        club = club || this._eigener(state);
        const saison = state?.seasonYear || 1;
        return (club?.ehemalige || []).filter(e => !e.eingestellt && e.saison + this.JAHRE > saison);
    },

    /**
     * Aus PreseasonEngine.start: Ehemalige bewerben sich für den Stab - je
     * Fachbereich höchstens einer, mit Herzensrabatt.
     */
    bewerber(state, club, pre, zufall = Math.random) {
        const engine = _ehResolve("PreseasonEngine", "./preseasonEngine.js");
        if (!engine || !pre || !pre.bewerber) return [];
        const neu = [];
        this.verfuegbar(state, club).forEach(e => {
            if (zufall() >= this.CHANCE) return;
            const liste = pre.bewerber[e.bereich] = pre.bewerber[e.bereich] || [];
            if (liste.some(k => k.ehemaliger)) return;
            const bereich = engine.BEREICHE.find(b => b.key === e.bereich);
            if (!bereich) return;
            const guete = this.guete(club, e, zufall);
            const gehalt = engine.rundeGehalt(engine.marktGehalt(club, e.bereich, guete) * this.RABATT);
            const k = {
                id: `staff_ehem_${e.id}`, name: e.name, bereich: e.bereich, titel: bereich.titel, guete, gehalt,
                mindestGehalt: engine.rundeGehalt(gehalt * 0.88), alter: e.alter + (state.seasonYear - e.saison),
                ruf: typeof engine.rufText === "function" ? engine.rufText(guete) : "",
                ehemaliger: { id: e.id, spiele: e.spiele, tore: e.tore, legende: !!e.legende }
            };
            liste.unshift(k);
            neu.push(k);
        });
        return neu;
    },

    /** Aus PreseasonEngine.verpflichte: Ein Ehemaliger kehrt zurück */
    nachVerpflichtung(state, club, kandidat) {
        const ehem = kandidat?.ehemaliger;
        if (!ehem || !club) return false;
        const e = (club.ehemalige || []).find(x => String(x.id) === String(ehem.id));
        if (e) e.eingestellt = state.seasonYear || 1;
        if (club.staff?.[kandidat.bereich]) club.staff[kandidat.bereich].ehemaliger = { ...ehem };
        if (ehem.legende) {
            (state.players || []).filter(p => p.clubId === club.id).forEach(p => { p.morale = Math.min(99, (p.morale ?? 70) + this.LEGENDE_MORAL); });
        }
        return true;
    },

    /** Die offenen Abschiedsspiele - sie gelten in der Saison des Karriereendes */
    offeneAbschiede(state) {
        const saison = state?.seasonYear || 1;
        return (state?.abschiedsspiele || []).filter(a => a.status === "offen" && a.saison === saison && a.clubId === state.userClubId);
    },

    /** Das Abschiedsspiel: volles Haus, ein Torfestival, die Legende trifft */
    abschiedsspiel(state, id, zufall = Math.random) {
        const club = this._eigener(state);
        const a = this.offeneAbschiede(state).find(x => String(x.id) === String(id));
        if (!club || !a) return { success: false, error: "Dieses Abschiedsspiel gibt es nicht mehr." };
        const fac = _ehResolve("FacilityEngine", "./facilityEngine.js");
        const kapazitaet = fac && typeof fac.verfuegbareKapazitaet === "function"
            ? fac.verfuegbareKapazitaet(club, state.seasonYear || 1) : (club.stadiumCapacity || club.capacity || 20000);
        const zuschauer = Math.round(kapazitaet * Math.min(1, 0.8 + a.spiele / 1500 + a.tore / 1000 + zufall() * 0.08));
        const einnahmen = Math.round(zuschauer * (club.ticketPrice || 35) * 0.7);
        const fuerVerein = Math.round(einnahmen * this.ABSCHIED_ANTEIL);
        club.balance = (club.balance || 0) + fuerVerein;
        const fin = _ehResolve("FinanceEngine", "./financeEngine.js");
        if (fin && typeof fin.recordTransaction === "function") fin.recordTransaction(state, club.id, "ticket_income", fuerVerein, `Abschiedsspiel ${a.name}`);

        const toreLegende = 1 + Math.floor(zufall() * 3);
        const freunde = 3 + Math.floor(zufall() * 4);
        let verein = 3 + Math.floor(zufall() * 4);
        if (verein === freunde && zufall() < 0.5) verein++;
        const ergebnis = `${freunde}:${verein}`;
        a.status = "gespielt";
        Object.assign(a, { zuschauer, ergebnis, toreLegende, einnahmen, fuerVerein });

        const chronik = state.chronik?.[club.id];
        if (chronik) {
            chronik.abschiede = Array.isArray(chronik.abschiede) ? chronik.abschiede : [];
            chronik.abschiede.unshift({ name: a.name, saison: state.seasonYear || 1, zuschauer, ergebnis, toreLegende, spiele: a.spiele, tore: a.tore });
        }
        (state.players || []).filter(p => p.clubId === club.id).forEach(p => { p.morale = Math.min(99, (p.morale ?? 70) + 2); });
        const text = `${zuschauer.toLocaleString("de-DE")} Zuschauer verabschieden ${a.name}. „${a.name} & Freunde“ gegen ${club.name} endet ${ergebnis}, `
            + `${a.name} trifft ${toreLegende === 1 ? "einmal" : `${toreLegende}-mal`} und geht in der 80. Minute unter stehendem Applaus vom Platz.\n\n`
            + `Einnahmen ${this._geld(einnahmen)}: ${this._geld(fuerVerein)} für den Verein, der Rest für einen guten Zweck.`;
        this._post(state, "Vorstand", `🏟️ Abschied für ${a.name}`, text);
        return { success: true, zuschauer, ergebnis, toreLegende, einnahmen, fuerVerein, text };
    },

    /** Für den Reiter Verein */
    uebersicht(state) {
        const club = this._eigener(state);
        if (!club) return null;
        const saison = state.seasonYear || 1;
        return {
            abschiede: this.offeneAbschiede(state),
            gespielt: (state.chronik?.[club.id]?.abschiede || []).slice(0, 5),
            ehemalige: (club.ehemalige || []).slice(0, 12).map(e => ({
                ...e,
                status: e.eingestellt ? "im Stab"
                    : (e.saison + this.JAHRE > saison ? "kann sich bewerben" : "nicht mehr im Fußball")
            })),
            imStab: Object.values(club.staff || {}).filter(s => s && s.ehemaliger).map(s => ({ name: s.name, titel: s.titel, ...s.ehemaliger }))
        };
    }
};

if (typeof window !== "undefined") {
    window.EhemaligeEngine = EhemaligeEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { EhemaligeEngine };
}
