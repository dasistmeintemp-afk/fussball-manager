/**
 * AuszeichnungEngine - Spieler, Talent und Trainer des Monats, Saisonpreise
 *
 * Bisher gab es nur den "Mann des Spiels" und am Saisonende einen
 * Torschützenkönig und einen Spieler der Saison - ermittelt über alle 384
 * Vereine der Welt, so dass in der Bundesliga-Chronik ein Torjäger aus der
 * Landesliga stehen konnte. Eine Saison hatte damit kaum Momente, an die
 * man sich erinnert.
 *
 * Jetzt:
 *   Monatspreise   - in der eigenen Liga am Monatsersten: Spieler, Talent
 *                    (bis 21) und Trainer des Monats, gemessen an dem, was im
 *                    Monat geschah (Noten, Tore, Vorlagen, Punkte).
 *   Saisonpreise   - in der eigenen Liga und den fünf ersten Ligen: Spieler
 *                    und Talent der Saison, Torjäger, Trainer der Saison (wer
 *                    am weitesten über seinem Kader landet) und die Elf der
 *                    Saison im 4-3-3.
 *
 * Wer ausgezeichnet wird, trägt es in der Akte, ist etwas mehr wert und
 * etwas besser gelaunt. Ein Preis für den eigenen Trainer stärkt seinen Ruf
 * und das Vertrauen des Vorstands.
 */

const _auszResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const AuszeichnungEngine = {
    /** Mindestens so viele Spiele im Monat, um Spieler des Monats zu werden */
    MONAT_MIN_SPIELE: 3,
    /** Ein Talent ist, wer höchstens so alt ist */
    TALENT_ALTER: 21,
    /** Anteil der Spieltage, den ein Spieler für einen Saisonpreis gespielt haben muss */
    SAISON_MIN_ANTEIL: 0.5,
    /** So viele Monats- und Saisonpreise bleiben gespeichert */
    MONATE_GEMERKT: 24,
    SAISONS_GEMERKT: 10,

    MONATE: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
        "August", "September", "Oktober", "November", "Dezember"],

    /** Die Elf der Saison im 4-3-3 - welche Positionen in welchen Mannschaftsteil passen */
    ELF: [
        { platz: "TW", pos: ["TW"] },
        { platz: "RV", pos: ["RV"] },
        { platz: "IV", pos: ["IV"] },
        { platz: "IV", pos: ["IV"] },
        { platz: "LV", pos: ["LV"] },
        { platz: "ZM", pos: ["DM", "ZM", "OM"] },
        { platz: "ZM", pos: ["DM", "ZM", "OM"] },
        { platz: "ZM", pos: ["ZM", "OM", "DM"] },
        { platz: "RA", pos: ["RA", "RM"] },
        { platz: "ST", pos: ["ST"] },
        { platz: "LA", pos: ["LA", "LM"] }
    ],

    _monat(datum) {
        const m = /^\d{1,2}\.(\d{1,2})\.(\d{4})$/.exec(String(datum || ""));
        return m ? `${m[1].padStart(2, "0")}.${m[2]}` : null;
    },

    monatsName(monat) {
        const [m, j] = String(monat || "").split(".");
        const name = this.MONATE[Number(m) - 1];
        return name ? `${name} ${j}` : "";
    },

    _ligaVon(state) {
        const club = (state?.clubs || []).find(c => c.id === state.userClubId);
        return club ? club.leagueId : null;
    },

    /** Die Ligen mit Saisonpreisen: die eigene und die ersten Ligen der fünf Länder */
    preisLigen(state) {
        const ligen = new Set();
        const eigene = this._ligaVon(state);
        if (eigene) ligen.add(eigene);
        const daten = _auszResolve("LEAGUES_DATA", "../data/leagueData.js") || [];
        (Array.isArray(daten) ? daten : (daten.LEAGUES_DATA || [])).forEach(l => { if (l.level === 1) ligen.add(l.id); });
        if (ligen.size <= 1) {
            (state.clubs || []).forEach(c => { if ((c.level || 1) === 1 && c.leagueId) ligen.add(c.leagueId); });
        }
        return [...ligen];
    },

    _vereineDerLiga(state, ligaId) {
        return (state.clubs || []).filter(c => c.leagueId === ligaId);
    },

    _spielerDerLiga(state, ligaId) {
        const ids = new Set(this._vereineDerLiga(state, ligaId).map(c => c.id));
        return (state.players || []).filter(p => p && ids.has(p.clubId));
    },

    _tabelle(state, ligaId) {
        if (ligaId === this._ligaVon(state) && Array.isArray(state.standings) && state.standings.length) return state.standings;
        return (state.standingsByLeague || {})[ligaId] || [];
    },

    /** Wertung für einen Preis: Notenschnitt, dazu Tore und Vorlagen je Spiel */
    wertung(spiele, tore, vorlagen, notenSumme) {
        if (!spiele) return 0;
        return notenSumme / spiele + 0.25 * (tore + 0.6 * vorlagen) / spiele;
    },

    _eintrag(p, extra = {}) {
        return p ? { id: p.id, name: p.name, pos: p.pos, alter: p.age, clubId: p.clubId, ...extra } : null;
    },

    // ---------------------------------------------------------- Monatspreise

    /** Der Stand zum Monatsbeginn: Statistik der Spieler und Punkte der Vereine der eigenen Liga */
    monatsStand(state, monat) {
        const liga = this._ligaVon(state);
        const spieler = {};
        this._spielerDerLiga(state, liga).forEach(p => {
            const s = p.stats || {};
            spieler[p.id] = [s.matches || 0, s.goals || 0, s.assists || 0, Math.round((s.ratingSum || 0) * 10) / 10];
        });
        const vereine = {};
        this._tabelle(state, liga).forEach(r => { vereine[r.clubId] = [r.points || 0, r.played || 0, r.goalDiff || 0]; });
        return { monat, liga, saison: state.seasonYear || 1, spieler, vereine };
    },

    /**
     * Wird jeden Tag gerufen und zeichnet beim Monatswechsel aus. Gibt die
     * Zeile für den Tagesbericht zurück, oder null.
     */
    pruefeMonat(state, datum = state?.currentDate) {
        const monat = this._monat(datum);
        if (!state || !monat) return null;
        const alt = state.auszeichnungStand;
        if (!alt || alt.saison !== (state.seasonYear || 1) || alt.liga !== this._ligaVon(state)) {
            state.auszeichnungStand = this.monatsStand(state, monat);
            return null;
        }
        if (alt.monat === monat) return null;
        const preis = this.vergebeMonat(state, alt);
        state.auszeichnungStand = this.monatsStand(state, monat);
        return preis ? this.monatsZeile(state, preis) : null;
    },

    /** Spieler, Talent und Trainer eines abgelaufenen Monats */
    monatsPreise(state, stand) {
        const kandidaten = [];
        this._spielerDerLiga(state, stand.liga).forEach(p => {
            const vorher = stand.spieler[p.id] || [0, 0, 0, 0];
            const s = p.stats || {};
            const spiele = (s.matches || 0) - vorher[0];
            if (spiele <= 0) return;
            const tore = (s.goals || 0) - vorher[1];
            const vorlagen = (s.assists || 0) - vorher[2];
            const noten = (s.ratingSum || 0) - vorher[3];
            kandidaten.push({ p, spiele, tore, vorlagen, schnitt: noten / spiele, wert: this.wertung(spiele, tore, vorlagen, noten) });
        });
        const genug = kandidaten.filter(k => k.spiele >= this.MONAT_MIN_SPIELE);
        if (!genug.length) return null;
        genug.sort((a, b) => b.wert - a.wert);
        const bester = genug[0];
        // Das Talent ist der beste andere junge Spieler - einer allein räumt nicht beide Preise ab
        const talent = genug.filter(k => k !== bester && (k.p.age || 30) <= this.TALENT_ALTER)[0] || null;

        let trainer = null;
        this._tabelle(state, stand.liga).forEach(r => {
            const v = stand.vereine[r.clubId] || [0, 0, 0];
            const spiele = (r.played || 0) - v[1];
            if (spiele < this.MONAT_MIN_SPIELE) return;
            const schnitt = ((r.points || 0) - v[0]) / spiele;
            const diff = (r.goalDiff || 0) - v[2];
            if (!trainer || schnitt > trainer.schnitt || (schnitt === trainer.schnitt && diff > trainer.diff)) {
                trainer = { clubId: r.clubId, schnitt, diff, punkte: (r.points || 0) - v[0], spiele };
            }
        });

        const kurz = (k) => k ? this._eintrag(k.p, { spiele: k.spiele, tore: k.tore, vorlagen: k.vorlagen, note: Math.round(k.schnitt * 100) / 100 }) : null;
        const verein = trainer ? (state.clubs || []).find(c => c.id === trainer.clubId) : null;
        return {
            monat: stand.monat, saison: stand.saison, liga: stand.liga,
            spieler: kurz(bester),
            talent: kurz(talent),
            trainer: trainer ? {
                clubId: trainer.clubId, verein: verein ? verein.name : "",
                punkte: trainer.punkte, spiele: trainer.spiele, istNutzer: trainer.clubId === state.userClubId
            } : null
        };
    },

    _speichern(state) {
        if (!state.auszeichnungen || typeof state.auszeichnungen !== "object") state.auszeichnungen = { monate: [], saisons: [] };
        if (!Array.isArray(state.auszeichnungen.monate)) state.auszeichnungen.monate = [];
        if (!Array.isArray(state.auszeichnungen.saisons)) state.auszeichnungen.saisons = [];
        return state.auszeichnungen;
    },

    /** Einen Preis an einem Spieler festhalten - mit kleinem Lohn */
    _ehre(state, eintrag, art, wertPlus, laune) {
        if (!eintrag) return null;
        const p = (state.players || []).find(x => String(x.id) === String(eintrag.id));
        if (!p) return null;
        if (!Array.isArray(p.auszeichnungen)) p.auszeichnungen = [];
        p.auszeichnungen.push({ art, saison: state.seasonYear || 1, ...(eintrag.monat ? { monat: eintrag.monat } : {}) });
        if (typeof p.value === "number") p.value = Math.round(p.value * (1 + wertPlus));
        p.morale = Math.min(100, (p.morale ?? 70) + laune);
        return p;
    },

    vergebeMonat(state, stand) {
        const preis = this.monatsPreise(state, stand);
        if (!preis) return null;
        const speicher = this._speichern(state);
        speicher.monate.push(preis);
        if (speicher.monate.length > this.MONATE_GEMERKT) speicher.monate.splice(0, speicher.monate.length - this.MONATE_GEMERKT);

        const name = this.monatsName(preis.monat);
        const sp = this._ehre(state, preis.spieler && { ...preis.spieler, monat: preis.monat }, "spielerMonat", 0.03, 5);
        const ta = this._ehre(state, preis.talent && { ...preis.talent, monat: preis.monat }, "talentMonat", 0.04, 4);

        const eigen = (p) => p && p.clubId === state.userClubId;
        if (eigen(sp)) this._post(state, `🏅 ${sp.name} ist Spieler des Monats ${name}`,
            `${sp.name} wurde zum Spieler des Monats ${name} gewählt: ${preis.spieler.spiele} Spiele, ${preis.spieler.tore} Tore, ${preis.spieler.vorlagen} Vorlagen, Notenschnitt ${String(preis.spieler.note).replace(".", ",")}.`);
        if (eigen(ta)) this._post(state, `🌱 ${ta.name} ist Talent des Monats ${name}`,
            `${ta.name} (${ta.age}) wurde zum Talent des Monats ${name} gewählt.`);
        if (preis.trainer && preis.trainer.istNutzer) {
            this._trainerPreis(state, `🎖️ Trainer des Monats ${name}`,
                `Sie sind Trainer des Monats ${name}: ${preis.trainer.punkte} Punkte aus ${preis.trainer.spiele} Spielen.`, 2);
        }
        return preis;
    },

    monatsZeile(state, preis) {
        const verein = (id) => ((state.clubs || []).find(c => c.id === id) || {}).name || "";
        const teile = [];
        if (preis.spieler) teile.push(`Spieler: ${preis.spieler.name} (${verein(preis.spieler.clubId)})`);
        if (preis.trainer) teile.push(`Trainer: ${preis.trainer.istNutzer ? "Sie" : preis.trainer.verein}`);
        return teile.length ? `🏅 ${this.monatsName(preis.monat)} - ${teile.join(", ")}` : null;
    },

    _trainerPreis(state, betreff, text, vertrauen) {
        this._post(state, betreff, text, "Ligaverband");
        const board = _auszResolve("BoardEngine", "./boardEngine.js");
        if (board && typeof board.stimmung === "function") board.stimmung(state, vertrauen);
    },

    _post(state, betreff, text, absender = "Ligaverband") {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: absender,
            subject: betreff,
            body: text,
            read: false,
            type: "award"
        });
    },

    /** Wie oft der eigene Trainer ausgezeichnet wurde - zählt für seinen Ruf */
    trainerPreise(state) {
        const a = state?.auszeichnungen;
        if (!a) return 0;
        return (a.monate || []).filter(m => m.trainer && m.trainer.istNutzer).length * 1
            + (a.saisons || []).filter(s => s.trainer && s.trainer.istNutzer).length * 3;
    },

    // ---------------------------------------------------------- Saisonpreise

    /**
     * Zum Saisonende - vor dem Zurücksetzen der Statistik: den laufenden
     * Monat abschließen und die Saisonpreise vergeben. Liefert die Preise
     * der eigenen Liga.
     */
    saisonAbschluss(state) {
        if (!state) return null;
        const stand = state.auszeichnungStand;
        if (stand && stand.saison === (state.seasonYear || 1) && stand.liga === this._ligaVon(state)) {
            this.vergebeMonat(state, stand);
        }
        state.auszeichnungStand = null;
        const speicher = this._speichern(state);
        const eigeneLiga = this._ligaVon(state);
        let eigene = null;
        this.preisLigen(state).forEach(liga => {
            const preise = this.saisonPreise(state, liga);
            if (!preise) return;
            speicher.saisons.push(preise);
            if (liga === eigeneLiga) eigene = preise;
            this._ehre(state, preise.spieler, "spielerSaison", 0.08, 6);
            this._ehre(state, preise.talent, "talentSaison", 0.08, 5);
            if (preise.torjaeger) this._ehre(state, preise.torjaeger, "torjaeger", 0.04, 3);
            (preise.elf || []).forEach(e => this._ehre(state, e, "elfSaison", 0.02, 2));
        });
        const ligen = new Set(speicher.saisons.map(s => s.saison));
        if (ligen.size > this.SAISONS_GEMERKT) {
            const behalten = [...ligen].sort((a, b) => b - a).slice(0, this.SAISONS_GEMERKT);
            speicher.saisons = speicher.saisons.filter(s => behalten.includes(s.saison));
        }
        if (eigene) this._saisonPost(state, eigene);
        return eigene;
    },

    saisonPreise(state, ligaId) {
        const vereine = this._vereineDerLiga(state, ligaId);
        if (vereine.length < 2) return null;
        const runden = Math.max(1, (vereine.length - 1) * 2);
        const minSpiele = Math.max(3, Math.round(runden * this.SAISON_MIN_ANTEIL));
        const kandidaten = this._spielerDerLiga(state, ligaId)
            .map(p => {
                const s = p.stats || {};
                const spiele = s.matches || 0;
                return { p, spiele, tore: s.goals || 0, vorlagen: s.assists || 0, schnitt: spiele ? (s.ratingSum || 0) / spiele : 0,
                    wert: this.wertung(spiele, s.goals || 0, s.assists || 0, s.ratingSum || 0) };
            })
            .filter(k => k.spiele > 0);
        const genug = kandidaten.filter(k => k.spiele >= minSpiele).sort((a, b) => b.wert - a.wert);
        if (!genug.length) return null;
        const kurz = (k) => k ? this._eintrag(k.p, { spiele: k.spiele, tore: k.tore, vorlagen: k.vorlagen, note: Math.round(k.schnitt * 100) / 100 }) : null;

        const talent = kandidaten.filter(k => k !== genug[0] && (k.p.age || 30) <= this.TALENT_ALTER && k.spiele >= Math.round(minSpiele * 0.6))
            .sort((a, b) => b.wert - a.wert)[0] || null;
        const torjaeger = kandidaten.filter(k => k.tore > 0)
            .sort((a, b) => b.tore - a.tore || a.spiele - b.spiele)[0] || null;

        // Elf der Saison: je Platz der Beste, der dort zu Hause ist
        const vergeben = new Set();
        const elf = this.ELF.map(platz => {
            const k = genug.find(x => !vergeben.has(x.p.id) && platz.pos.includes(x.p.pos));
            if (!k) return null;
            vergeben.add(k.p.id);
            return kurz(k) && { ...kurz(k), platz: platz.platz };
        }).filter(Boolean);

        return {
            saison: state.seasonYear || 1, liga: ligaId,
            spieler: kurz(genug[0]),
            talent: kurz(talent),
            torjaeger: torjaeger ? kurz(torjaeger) : null,
            trainer: this.trainerDerSaison(state, ligaId, vereine),
            elf
        };
    },

    /**
     * Trainer der Saison: wer mit seinem Kader am weitesten über dem landet,
     * was man ihm zugetraut hat. Erwartet wird der Rang der Kaderstärke.
     */
    trainerDerSaison(state, ligaId, vereine) {
        const tabelle = this._tabelle(state, ligaId);
        if (!tabelle.length) return null;
        const staerke = (club) => {
            const werte = (state.players || []).filter(p => p.clubId === club.id).map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 14);
            return werte.length ? werte.reduce((s, x) => s + x, 0) / werte.length : 0;
        };
        const erwartet = new Map(vereine.slice().sort((a, b) => staerke(b) - staerke(a)).map((c, i) => [c.id, i + 1]));
        let bester = null;
        tabelle.forEach((r, i) => {
            const platz = i + 1;
            const sprung = (erwartet.get(r.clubId) || platz) - platz;
            // Bei gleichem Sprung zählt der bessere Platz - ein Meister schlägt einen Mittelfeldklub
            if (!bester || sprung > bester.sprung || (sprung === bester.sprung && platz < bester.platz)) {
                bester = { clubId: r.clubId, sprung, platz, erwartet: erwartet.get(r.clubId) || platz };
            }
        });
        if (!bester) return null;
        const verein = vereine.find(c => c.id === bester.clubId);
        return { clubId: bester.clubId, verein: verein ? verein.name : "", platz: bester.platz, erwartet: bester.erwartet,
            istNutzer: bester.clubId === state.userClubId };
    },

    _saisonPost(state, preise) {
        const verein = (id) => ((state.clubs || []).find(c => c.id === id) || {}).name || "";
        const zeile = (titel, e, extra = "") => e ? `${titel}: ${e.name} (${verein(e.clubId)})${extra}` : null;
        const eigene = (preise.elf || []).filter(e => e.clubId === state.userClubId);
        const text = [
            zeile("Spieler der Saison", preise.spieler, preise.spieler ? `, Note ${String(preise.spieler.note).replace(".", ",")}` : ""),
            zeile("Talent der Saison", preise.talent),
            zeile("Torjäger", preise.torjaeger, preise.torjaeger ? `, ${preise.torjaeger.tore} Tore` : ""),
            preise.trainer ? `Trainer der Saison: ${preise.trainer.istNutzer ? "Sie" : preise.trainer.verein} (Platz ${preise.trainer.platz}, erwartet ${preise.trainer.erwartet})` : null,
            "",
            "Elf der Saison: " + (preise.elf || []).map(e => `${e.platz} ${e.name}`).join(", "),
            eigene.length ? `\nAus Ihrem Kader dabei: ${eigene.map(e => e.name).join(", ")}.` : ""
        ].filter(x => x !== null).join("\n");
        this._post(state, `🏆 Die Preise der Saison`, text);
        if (preise.trainer && preise.trainer.istNutzer) {
            this._trainerPreis(state, "🎖️ Trainer der Saison",
                `Sie sind Trainer der Saison: Platz ${preise.trainer.platz} mit einem Kader, dem man Platz ${preise.trainer.erwartet} zugetraut hat.`, 5);
        }
    },

    // -------------------------------------------------------------- Anzeige

    /** Die Preise eines Spielers in Worten - für die Akte */
    preiseVon(player) {
        const namen = {
            spielerMonat: "Spieler des Monats", talentMonat: "Talent des Monats", spielerSaison: "Spieler der Saison",
            talentSaison: "Talent der Saison", torjaeger: "Torjäger", elfSaison: "Elf der Saison"
        };
        return (Array.isArray(player?.auszeichnungen) ? player.auszeichnungen : [])
            .map(a => ({ ...a, name: namen[a.art] || a.art, wann: a.monat ? this.monatsName(a.monat) : `Saison ${a.saison}` }));
    },

    /** Für die Ranglisten: die Monatspreise dieser Saison und die letzten Saisonpreise der Liga */
    uebersicht(state, ligaId = this._ligaVon(state)) {
        const a = state?.auszeichnungen || { monate: [], saisons: [] };
        const monate = (a.monate || []).filter(m => m.liga === ligaId && m.saison === (state.seasonYear || 1));
        const saisons = (a.saisons || []).filter(s => s.liga === ligaId).sort((x, y) => y.saison - x.saison);
        return { monate, letzteSaison: saisons[0] || null };
    }
};

if (typeof window !== "undefined") {
    window.AuszeichnungEngine = AuszeichnungEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { AuszeichnungEngine };
}
