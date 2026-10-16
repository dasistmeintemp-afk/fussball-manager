/**
 * ReserveEngine - Die zweite Mannschaft (U23)
 *
 * Bisher gab es nur zwei Wege zu Spielpraxis: in die erste Elf oder auf
 * Leihe. Ein Neunzehnjähriger, der im Profikader auf der Tribüne sitzt,
 * verkümmerte - seine Spielpraxis sank Woche für Woche, und mit ihr das
 * Entwicklungstempo.
 *
 * Jetzt kann er in die U23. Dort spielt er an jedem Spieltag der Profis ein
 * eigenes Spiel gegen eine zweite Mannschaft:
 *  - Er sammelt Spielpraxis, nicht ganz so viel wie bei den Profis (die
 *    Liga ist schwächer), aber deutlich mehr als auf der Tribüne.
 *  - Er bleibt im Rhythmus (Spielschärfe), kann sich aber auch verletzen.
 *  - Er steht den Profis nicht zur Verfügung: nicht in der Elf, nicht auf
 *    der Bank. Wer ihn braucht, holt ihn zurück.
 *
 * Regeln wie in der Wirklichkeit: Höchstens drei Spieler über 23 dürfen
 * mitspielen (etwa nach einer Verletzung), und im Profikader müssen
 * genug Spieler bleiben, um eine Elf und eine Bank zu stellen.
 *
 * Die KI-Vereine haben ihre zweite Mannschaft ohne eigene Verwaltung: Ihre
 * Talente bis 21, die bei den Profis nicht spielen, sammeln ein wenig Praxis.
 */

function _reResolve(name, pfad) {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { return null; }
    }
    return null;
}

const ReserveEngine = {
    ALTERSGRENZE: 23,
    MAX_UEBERALTERT: 3,
    MIN_PROFIKADER: 16,
    /** Spielpraxis je Partie: Profis zählen voll, die U23 zu diesem Teil */
    PRAXIS_WERT: 0.7,
    /** Was ein KI-Talent ohne Einsatz in seiner zweiten Mannschaft sammelt */
    KI_PRAXIS: 0.3,
    VERLETZUNG: 0.012,

    istReserve(player) {
        return !!player?.reserve;
    },

    /**
     * reserve: true heißt U23, "u19" heißt U19. Beide stehen den Profis
     * nicht zur Verfügung - überall, wo das zählt, reicht die Frage, ob
     * reserve gesetzt ist.
     */
    U19: "u19",
    inU19(player) {
        return player?.reserve === this.U19;
    },

    /** Die U23 eines Vereins */
    spieler(state, club) {
        const ids = new Set(club?.playerIds || []);
        return (state?.players || []).filter(p => ids.has(p.id) && p.reserve && p.reserve !== this.U19);
    },

    /** Die Profis eines Vereins in der U19 */
    spielerU19(state, club) {
        const ids = new Set(club?.playerIds || []);
        return (state?.players || []).filter(p => ids.has(p.id) && p.reserve === this.U19);
    },

    /** Der Profikader ohne die U23 */
    profis(state, club) {
        const ids = new Set(club?.playerIds || []);
        return (state?.players || []).filter(p => ids.has(p.id) && !p.reserve);
    },

    /** Darf er hinunter? Gründe, warum nicht, als Text */
    pruefe(state, player) {
        const club = (state?.clubs || []).find(c => c.id === player?.clubId);
        if (!player || !club) return { ok: false, grund: "Spieler nicht gefunden." };
        if (!club.playerIds.includes(player.id)) return { ok: false, grund: "Er gehört nicht zum Kader." };
        if (player.reserve) return { ok: false, grund: `${player.name} spielt schon in der ${player.reserve === this.U19 ? "U19" : "U23"}.` };
        if (player.abgestellt) return { ok: false, grund: `${player.name} ist gerade bei der Nationalmannschaft.` };
        if ((player.age || 30) > this.ALTERSGRENZE) {
            const alte = this.spieler(state, club).filter(p => (p.age || 30) > this.ALTERSGRENZE).length;
            if (alte >= this.MAX_UEBERALTERT) {
                return { ok: false, grund: `In der U23 spielen schon ${this.MAX_UEBERALTERT} Spieler über ${this.ALTERSGRENZE}.` };
            }
        }
        if (this.profis(state, club).length - 1 < this.MIN_PROFIKADER) {
            return { ok: false, grund: `Im Profikader müssen mindestens ${this.MIN_PROFIKADER} Spieler bleiben.` };
        }
        return { ok: true };
    },

    /** In die U23 schicken */
    hinunter(state, playerId) {
        const player = (state?.players || []).find(p => String(p.id) === String(playerId));
        const check = this.pruefe(state, player);
        if (!check.ok) return { success: false, error: check.grund };
        const club = state.clubs.find(c => c.id === player.clubId);
        player.reserve = true;
        player.nominiertAus = undefined;
        // Aus Elf und Bank nehmen - die Aufstellung rückt nach
        const warDabei = (club.lineup || []).includes(player.id) || (club.bench || []).includes(player.id);
        const gs = _reResolve("GameState", "./gameState.js");
        if (warDabei && gs && typeof gs.repairLineup === "function") gs.repairLineup(club, state.players);
        // Wer aus der Stammelf fällt, ist nicht begeistert
        if ((player.age || 30) > this.ALTERSGRENZE || (player.overall || 0) >= this._kaderSchnitt(state, club)) {
            player.morale = Math.max(0, (player.morale ?? 70) - 8);
        }
        return { success: true, player, ausElf: warDabei };
    },

    /** In den Profikader zurückholen - aus der U23 wie aus der U19, auch einen nur für den Spieltag Nominierten für immer */
    hinauf(state, playerId) {
        const player = (state?.players || []).find(p => String(p.id) === String(playerId));
        if (player && player.nominiertAus) {
            const von = player.nominiertAus === this.U19 ? "U19" : "U23";
            player.nominiertAus = undefined;
            return { success: true, player, von };
        }
        if (!player || !player.reserve) return { success: false, error: "Er spielt weder in der U23 noch in der U19." };
        const von = player.reserve === this.U19 ? "U19" : "U23";
        player.reserve = undefined;
        return { success: true, player, von };
    },

    // ----------------------------------------------- Nur für den Spieltag

    /**
     * Nur für den nächsten Spieltag zu den Profis, wie im Vorbild: bei einer
     * kurzen Verletzungswelle oder einer Sperre. Er steht für Elf und Bank
     * bereit - auch im Pokal dazwischen - und geht nach dem nächsten
     * Ligaspiel von selbst zurück in seine Mannschaft (nominiertAus).
     */
    nominieren(state, playerId) {
        const player = (state?.players || []).find(p => String(p.id) === String(playerId));
        if (!player || !player.reserve) return { success: false, error: "Er spielt weder in der U23 noch in der U19." };
        const von = player.reserve === this.U19 ? "U19" : "U23";
        player.nominiertAus = player.reserve;
        player.reserve = undefined;
        return { success: true, player, von };
    },

    /** Einen Nominierten sofort zurückschicken (oder alle nach dem Spieltag) */
    zurueckNachNominierung(state, player) {
        if (!player || !player.nominiertAus) return false;
        const club = (state?.clubs || []).find(c => c.id === player.clubId);
        const youth = _reResolve("YouthEngine", "./youthEngine.js");
        // Wer inzwischen gewechselt, verliehen oder zu alt für die U19 ist, bleibt, wo er ist
        const weiterU19 = player.nominiertAus === this.U19 && (player.age || 30) > (youth?.AKADEMIE_HOECHSTALTER ?? 19);
        if (club && club.id === state.userClubId && !player.leihe && !weiterU19) player.reserve = player.nominiertAus;
        player.nominiertAus = undefined;
        return !!player.reserve;
    },

    /** Nach dem Ligaspieltag: Die Nominierten gehen zurück in U23 und U19 */
    nominierteZurueck(state) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const zurueck = (state?.players || []).filter(p => p.nominiertAus).filter(p => this.zurueckNachNominierung(state, p));
        if (club && zurueck.length) {
            const gs = _reResolve("GameState", "./gameState.js");
            if (gs && typeof gs.repairLineup === "function") gs.repairLineup(club, state.players);
            this._post(state, "Co-Trainer", zurueck.length === 1 ? `${zurueck[0].name} ist zurück` : `${zurueck.length} Nominierte sind zurück`,
                zurueck.map(p => `${p.name} spielt wieder in der ${p.reserve === this.U19 ? "U19" : "U23"}.`).join(" ")
                + " Für den nächsten Spieltag nominieren Sie sie im Kader-Reiter erneut, oder holen Sie sie ganz zu den Profis.");
        }
        return zurueck;
    },

    /**
     * Darf ein Profi in die U19? Nur wer noch im Alter der A-Jugend ist
     * (YouthEngine.AKADEMIE_HOECHSTALTER), und im Profikader müssen genug
     * bleiben.
     */
    pruefeU19(state, player) {
        const club = (state?.clubs || []).find(c => c.id === player?.clubId);
        if (!player || !club || !club.playerIds.includes(player.id)) return { ok: false, grund: "Er gehört nicht zum Kader." };
        if (player.reserve) return { ok: false, grund: `${player.name} spielt schon in der ${player.reserve === this.U19 ? "U19" : "U23"}.` };
        if (player.abgestellt) return { ok: false, grund: `${player.name} ist gerade bei der Nationalmannschaft.` };
        const youth = _reResolve("YouthEngine", "./youthEngine.js");
        const grenze = youth?.AKADEMIE_HOECHSTALTER ?? 19;
        if ((player.age || 30) > grenze) return { ok: false, grund: `In der U19 spielt nur, wer höchstens ${grenze} ist.` };
        if (this.profis(state, club).length - 1 < this.MIN_PROFIKADER) {
            return { ok: false, grund: `Im Profikader müssen mindestens ${this.MIN_PROFIKADER} Spieler bleiben.` };
        }
        return { ok: true };
    },

    /** In die U19 schicken: Er spielt dort mit, bis Sie ihn zurückholen */
    hinunterU19(state, playerId) {
        const player = (state?.players || []).find(p => String(p.id) === String(playerId));
        const check = this.pruefeU19(state, player);
        if (!check.ok) return { success: false, error: check.grund };
        const club = state.clubs.find(c => c.id === player.clubId);
        player.reserve = this.U19;
        player.nominiertAus = undefined;
        const warDabei = (club.lineup || []).includes(player.id) || (club.bench || []).includes(player.id);
        const gs = _reResolve("GameState", "./gameState.js");
        if (warDabei && gs && typeof gs.repairLineup === "function") gs.repairLineup(club, state.players);
        // Wer in der Elf stand oder zu den Besten gehört, ist nicht begeistert - wie bei der U23
        if (warDabei || (player.overall || 0) >= this._kaderSchnitt(state, club)) {
            player.morale = Math.max(0, (player.morale ?? 70) - 8);
        }
        return { success: true, player, ausElf: warDabei };
    },

    // ----------------------------------------------- Leistung je Spieler

    /**
     * Die Note eines Spielers in einem Spiel von U23 oder U19: Tore, das
     * Ergebnis, wie er im Vergleich zur Elf steht, und ein Anteil Tagesform.
     * Gewürfelt wird nach einer festen Zahl je Spieler und Spiel - der
     * Zufall der Simulation bleibt unberührt.
     */
    note(p, tore, ergebnis, schnitt, schluessel) {
        const gen = _reResolve("PlayerGenerator", "./playerGenerator.js");
        const h = gen && typeof gen._hashZahl === "function" ? gen._hashZahl(`${p.id}|${schluessel}|note`) : 0;
        const n = 6.3 + tore * 0.9 + (ergebnis > 0 ? 0.3 : (ergebnis < 0 ? -0.3 : 0))
            + ((p.overall || 50) - schnitt) * 0.04 + h * 0.7;
        return Math.round(Math.max(3, Math.min(10, n)) * 10) / 10;
    },

    /** Eine Partie in die Bilanz des Spielers (u23 oder u19) eintragen */
    bucheEinsatz(p, feld, saison, note, tore) {
        const b = p[feld] && p[feld].saison === saison ? p[feld] : { saison, spiele: 0, tore: 0, noten: 0, letzte: [] };
        b.spiele++;
        b.tore += tore;
        b.noten = Math.round((b.noten + note) * 10) / 10;
        b.letzte = [note].concat(b.letzte || []).slice(0, 3);
        p[feld] = b;
        return b;
    },

    /** Saisonbilanz in U23 oder U19: Spiele, Tore, Schnitt, Form (letzte drei) */
    bilanz(p, feld, saison) {
        const b = p?.[feld];
        if (!b || (saison !== undefined && b.saison !== saison) || !b.spiele) return null;
        const form = b.letzte.length ? b.letzte.reduce((s, x) => s + x, 0) / b.letzte.length : null;
        return { spiele: b.spiele, tore: b.tore, schnitt: Math.round(b.noten / b.spiele * 100) / 100, form: form === null ? null : Math.round(form * 100) / 100 };
    },

    /** Ab dieser Form (Schnitt der letzten drei, mindestens drei Spiele) drängt sich einer auf */
    IN_FORM: 7.2,

    /** Beim Vereinswechsel, bei Leihe oder Karriereende gilt die U23 nicht mehr */
    entlasse(player) {
        if (player && player.reserve) player.reserve = undefined;
        if (player) player.nominiertAus = undefined;
    },

    _kaderSchnitt(state, club) {
        const profis = this.profis(state, club).map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 14);
        return profis.length ? profis.reduce((a, b) => a + b, 0) / profis.length : 60;
    },

    // ------------------------------------------------------------ Spieltag

    /**
     * Das Spiel der U23 an einem Spieltag der Profis. Die Elf stellt sich
     * aus den Spielern der U23; fehlen welche, füllen Amateure und
     * A-Jugendliche auf (ein gutes Stück schwächer).
     */
    spieltag(state, club, zufall = Math.random) {
        if (!state || !club) return null;
        const kader = this.spieler(state, club).filter(p => (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0);
        if (!kader.length) return null;

        const elf = kader.slice().sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 11);
        const profiSchnitt = this._kaderSchnitt(state, club);
        const auffuellen = Math.max(0, 11 - elf.length);
        const amateur = profiSchnitt - 16;
        const eigene = (elf.reduce((s, p) => s + (p.overall || 0), 0) + auffuellen * amateur) / 11;
        // Der Gegner: eine zweite Mannschaft, im Mittel etwas schwächer als die Profis
        const gegner = profiSchnitt - 11 + (zufall() - 0.5) * 10;
        const diff = eigene - gegner;
        const lam = (d) => Math.max(0.25, 1.35 * Math.exp(d / 22));
        const tore = this._poisson(lam(diff + 2), zufall);
        const gegentore = this._poisson(lam(-diff), zufall);

        const meldungen = [];
        elf.forEach(p => {
            p.spielpraxis = Math.round(((p.spielpraxis ?? 0.5) * 0.82 + this.PRAXIS_WERT * 0.18) * 1000) / 1000;
            p.matchSharpness = Math.min(100, (p.matchSharpness ?? 60) + 6);
            p.fitness = Math.max(40, (p.fitness ?? 100) - 6);
            if (zufall() < this.VERLETZUNG) {
                p.injuredWeeks = 1 + Math.floor(zufall() * 3);
                p.injuryName = "Muskelverletzung (U23)";
                meldungen.push(`${p.name} hat sich in der U23 verletzt (${p.injuredWeeks} ${p.injuredWeeks === 1 ? "Woche" : "Wochen"}).`);
            }
        });
        // Wer in der U23 ohne Einsatz bleibt, sitzt eben auf deren Bank
        kader.filter(p => !elf.includes(p)).forEach(p => {
            p.spielpraxis = Math.round(((p.spielpraxis ?? 0.5) * 0.82) * 1000) / 1000;
        });

        // Torschützen grob aus den Offensiven
        const vorne = elf.filter(p => ["ST", "LA", "RA", "OM", "LM", "RM"].includes(p.pos)).concat(elf);
        const schuetzen = [];
        const toreVon = new Map();
        for (let i = 0; i < tore; i++) {
            const s = vorne[Math.floor(zufall() * Math.min(vorne.length, elf.length + 3))] || elf[0];
            if (s) { schuetzen.push(s.name); toreVon.set(s, (toreVon.get(s) || 0) + 1); }
        }
        // Jeder in der Elf bekommt seine Note - so sieht man, wer sich aufdrängt
        const saison = state.seasonYear || 1;
        const schnitt = elf.reduce((s, p) => s + (p.overall || 0), 0) / elf.length;
        elf.forEach(p => this.bucheEinsatz(p, "u23", saison,
            this.note(p, toreVon.get(p) || 0, tore - gegentore, schnitt, `u23|${saison}|${state.currentMatchday || 0}`), toreVon.get(p) || 0));

        const bilanz = club.reserveBilanz || (club.reserveBilanz = { spiele: 0, s: 0, u: 0, n: 0, tore: 0, gegentore: 0, letzte: [] });
        bilanz.spiele++;
        bilanz.tore += tore;
        bilanz.gegentore += gegentore;
        if (tore > gegentore) bilanz.s++; else if (tore === gegentore) bilanz.u++; else bilanz.n++;
        const ergebnis = { matchday: state.currentMatchday || 0, tore, gegentore, schuetzen, auffuellen, elf: elf.map(p => p.id) };
        bilanz.letzte.unshift(ergebnis);
        bilanz.letzte = bilanz.letzte.slice(0, 6);
        return { ...ergebnis, meldungen };
    },

    /**
     * Nach dem Spiel der Profis: Die U23 des Nutzers spielt. Die KI-Vereine
     * geben ihren Talenten ohne Einsatz ein wenig Praxis.
     */
    nachSpieltag(state, zufall = Math.random) {
        if (!state || !Array.isArray(state.clubs)) return null;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const ergebnis = club ? this.spieltag(state, club, zufall) : null;
        if (ergebnis && ergebnis.meldungen.length) this._post(state, "U23", "Verletzung in der zweiten Mannschaft", ergebnis.meldungen.join(" "));
        this.kiPraxis(state);
        return ergebnis;
    },

    /**
     * Für die KI: Ein Talent bis 21, das bei den Profis weder in der Elf
     * noch auf der Bank stand, spielt in der zweiten Mannschaft. Die
     * Spielpraxis-Rechnung nach der Partie hat ihm null Minuten angerechnet;
     * hier kommt der Anteil der zweiten Mannschaft dazu.
     */
    kiPraxis(state) {
        const kaderVon = new Map();
        state.clubs.forEach(c => {
            if (c.id === state.userClubId) return;
            kaderVon.set(c.id, new Set([...(c.lineup || []), ...(c.bench || [])]));
        });
        let n = 0;
        (state.players || []).forEach(p => {
            const imSpiel = kaderVon.get(p.clubId);
            if (!imSpiel || (p.age || 30) > 21 || imSpiel.has(p.id) || (p.injuredWeeks || 0) > 0) return;
            // Nur hinauf zum Niveau der zweiten Mannschaft, nie darüber
            const jetzt = p.spielpraxis ?? 0.5;
            if (jetzt >= this.KI_PRAXIS) return;
            p.spielpraxis = Math.round((jetzt + (this.KI_PRAXIS - jetzt) * 0.18) * 1000) / 1000;
            n++;
        });
        return n;
    },

    _poisson(lambda, zufall) {
        const l = Math.exp(-lambda);
        let k = 0, p = 1;
        do { k++; p *= zufall(); } while (p > l && k < 12);
        return k - 1;
    },

    _post(state, absender, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: absender, subject: betreff, body: text, read: false, type: "info"
        });
    }
};

if (typeof window !== "undefined") {
    window.ReserveEngine = ReserveEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { ReserveEngine };
}
