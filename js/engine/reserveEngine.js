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

    // ------------------------------------------------------------ U23-Liga

    /**
     * Die U23 spielt eine eigene Liga gegen die zweiten Mannschaften anderer
     * Vereine aus dem Land - so viele, dass jeder Spieltag der Profis ein
     * Spieltag der U23 ist (34 Spieltage: 18 Teams). Vorher spielte sie
     * jede Woche gegen einen gedachten Gegner, ohne Tabelle.
     */
    LIGA: { name: "U23-Liga", titel: "U23-Meisterschaft", minTeams: 10, maxTeams: 24, abstand: 11 },

    /** Stärke der zweiten Mannschaft eines Vereins: etwas unter den Profis */
    zweiteStaerke(schnitt, zufall = Math.random) {
        return Math.round((schnitt - this.LIGA.abstand + (zufall() - 0.5) * 6) * 10) / 10;
    },

    /** Zur neuen Saison: Teams, Spielplan und leere Tabelle (state.u23liga) */
    ligaStarte(state, zufall = Math.random) {
        const saison = state?.seasonYear || 1;
        if (state.u23liga && state.u23liga.saison === saison) return state.u23liga;
        const eigen = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!eigen) return null;
        const land = eigen.countryId || "de";
        const spieltage = Math.max(18, state.totalMatchdays || (state.schedule ? state.schedule.length : 34));
        const kandidaten = (state.clubs || []).filter(c => c.id !== eigen.id && (c.countryId || "de") === land)
            .sort((a, b) => (Math.abs((a.level || 1) - (eigen.level || 1)) - Math.abs((b.level || 1) - (eigen.level || 1)))
                || ((b.reputation || 0) - (a.reputation || 0)));
        let anzahl = Math.max(this.LIGA.minTeams, Math.min(this.LIGA.maxTeams, Math.floor(spieltage / 2) + 1, kandidaten.length + 1));
        if (anzahl % 2) anzahl--;
        const andere = kandidaten.slice(0, anzahl - 1);
        // Stärke der anderen: ihre Profis (die besten vierzehn) minus Abstand
        const nachVerein = new Map(andere.map(c => [c.id, []]));
        (state.players || []).forEach(p => { if (nachVerein.has(p.clubId) && !p.reserve) nachVerein.get(p.clubId).push(p.overall || 0); });
        const schnitt = (werte) => { const w = werte.sort((a, b) => b - a).slice(0, 14); return w.length ? w.reduce((a, b) => a + b, 0) / w.length : 55; };
        const teams = [{ clubId: eigen.id, name: `${eigen.name} U23`, staerke: null }]
            .concat(andere.map(c => ({ clubId: c.id, name: `${c.name} U23`, staerke: this.zweiteStaerke(schnitt(nachVerein.get(c.id)), zufall) })));
        // Doppelrunde nach dem Kreisverfahren
        const n = teams.length;
        const idx = teams.map((_, i) => i);
        const hin = [];
        for (let r = 0; r < n - 1; r++) {
            const runde = [];
            for (let i = 0; i < n / 2; i++) {
                const a = idx[i], b = idx[n - 1 - i];
                runde.push(r % 2 === 0 ? [a, b] : [b, a]);
            }
            hin.push(runde);
            idx.splice(1, 0, idx.pop());
        }
        const liga = state.u23liga = {
            saison, name: this.LIGA.name, teams, runden: hin.concat(hin.map(r => r.map(([a, b]) => [b, a]))), runde: 0,
            tabelle: teams.map(() => [0, 0, 0, 0, 0, 0]),      // s, u, n, tore, gegentore, punkte
            eigene: [], torschuetzen: {}, meister: null
        };
        // Ein älterer Spielstand mitten in der Saison: die schon gespielten
        // Spieltage nachholen, damit die Liga mit den Profis endet
        const vorbei = Math.min(liga.runden.length, Math.max(0, (state.currentMatchday || 1) - 1));
        if (vorbei > 0) {
            const eigeneStaerke = this.u23Staerke(state, eigen).staerke;
            const lam = (d) => Math.max(0.25, 1.35 * Math.exp(d / 22));
            while (liga.runde < vorbei) {
                const paarung = liga.runden[liga.runde].find(([h, a]) => h === 0 || a === 0);
                const heim = paarung[0] === 0, gegnerIndex = heim ? paarung[1] : paarung[0];
                const diff = eigeneStaerke - liga.teams[gegnerIndex].staerke;
                const tore = this._poisson(lam(diff + (heim ? 2 : 0)), zufall), gegentore = this._poisson(lam(-diff + (heim ? 0 : 2)), zufall);
                this._ligaRunde(state, liga, liga.runden[liga.runde], eigeneStaerke, { tore, gegentore, heim, gegnerIndex }, zufall);
            }
        }
        return liga;
    },

    /** Eine Runde: die eigene Partie steht fest, die übrigen werden gespielt */
    _ligaRunde(state, liga, runde, eigeneStaerke, eigenes, zufall) {
        const staerke = (i) => (i === 0 ? eigeneStaerke : liga.teams[i].staerke);
        const lam = (d) => Math.max(0.25, 1.35 * Math.exp(d / 22));
        const buche = (i, t, g) => {
            const z = liga.tabelle[i];
            z[3] += t; z[4] += g;
            if (t > g) { z[0]++; z[5] += 3; } else if (t === g) { z[1]++; z[5]++; } else z[2]++;
        };
        runde.forEach(([h, a]) => {
            let th, ta;
            if (h === 0 || a === 0) {
                th = eigenes.heim ? eigenes.tore : eigenes.gegentore;
                ta = eigenes.heim ? eigenes.gegentore : eigenes.tore;
                liga.eigene.push({ runde: liga.runde + 1, gegner: liga.teams[eigenes.gegnerIndex].name, heim: eigenes.heim, tore: eigenes.tore, gegentore: eigenes.gegentore, schuetzen: [] });
            } else {
                const diff = staerke(h) - staerke(a);
                th = this._poisson(lam(diff + 2), zufall);
                ta = this._poisson(lam(-diff), zufall);
            }
            buche(h, th, ta); buche(a, ta, th);
        });
        liga.runde++;
    },

    /**
     * Die Elf der U23 und ihre Stärke: die besten Elf, fehlende Plätze
     * füllen Amateure und A-Jugendliche auf (ein gutes Stück schwächer).
     */
    u23Staerke(state, club, kader = null) {
        const verfuegbar = kader || this.spieler(state, club).filter(p => (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0);
        // Die Elf auf den Plätzen der Formation (nur die eigene U23 hat eine)
        const aufstellung = club && club.id === state?.userClubId
            ? this.aufstellung(state, "u23", verfuegbar)
            : this.elfNachPlan(verfuegbar, "u23", state?.seasonYear || 1, 0).map((p, i) => ({ slot: i, pos: p.pos, spieler: p, fest: false }));
        const elf = aufstellung.filter(pl => pl.spieler).map(pl => pl.spieler);
        const profiSchnitt = this._kaderSchnitt(state, club);
        const auffuellen = Math.max(0, 11 - elf.length);
        const staerke = (aufstellung.reduce((s, pl) => s + (pl.spieler ? this.staerkeAuf(pl.spieler, pl.pos) : 0), 0) + auffuellen * (profiSchnitt - 16)) / 11;
        return { elf, auffuellen, staerke, profiSchnitt, aufstellung };
    },

    // ------------------------------------------------------------ Einsatzplan

    /**
     * Der Einsatzplan für U23 und U19: wer wie oft spielt und wo.
     *
     * Bisher stellten beide Mannschaften immer die elf Stärksten auf, ohne
     * Rücksicht auf Positionen. Wer schwächer war, spielte nie und kam ohne
     * Spielpraxis kaum voran - genau dafür ist die zweite Mannschaft aber da.
     * Jetzt bekommt jeder eine Rolle und, wenn gewünscht, eine Position.
     * Ohne Plan bleibt es bei den Besten, jetzt mit genau einem Torwart.
     */
    EINSATZ: {
        auto: { label: "Automatisch", text: "Spielt, wenn er zu den Besten gehört" },
        stamm: { label: "Stammspieler", text: "Spielt immer, wenn er fit ist" },
        rotation: { label: "Rotation", text: "Spielt etwa jedes zweite Spiel" },
        bedarf: { label: "Bei Bedarf", text: "Spielt nur, wenn sonst die Elf nicht voll wird" },
        schonen: { label: "Schonen", text: "Spielt nicht" }
    },
    /** Wo einer in der U23 oder U19 spielen kann - der Torwart bleibt im Tor */
    PLAN_POSITIONEN: ["IV", "LV", "RV", "DM", "ZM", "LM", "RM", "OM", "LA", "RA", "ST"],
    /**
     * Positionserfahrung je Spiel auf einer fremden Position: wie bei den
     * Profis (TrainingEngine, 0,05 für neunzig Minuten), mal dem Anteil, den
     * das Spiel an Praxis bringt (U23 0,7, U19 0,6)
     */
    POSITION_JE_SPIEL: 0.05,

    einsatzVon(p) {
        const e = p?.einsatz || {};
        return { rolle: this.EINSATZ[e.rolle] ? e.rolle : "auto", pos: e.pos || null };
    },

    /** U23 und U19 des eigenen Vereins - Talente der Akademie eingeschlossen */
    unterbauSpieler(state, playerId) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const jl = _reResolve("JugendligaEngine", "./jugendligaEngine.js");
        const alle = this.spieler(state, club).concat(jl && typeof jl.eigeneSpieler === "function" ? jl.eigeneSpieler(state) : []);
        return alle.find(p => String(p.id) === String(playerId)) || null;
    },

    /** Rolle und Position im Einsatzplan setzen; undefined lässt den Teil, wie er ist */
    setzeEinsatz(state, playerId, rolle, pos) {
        const p = this.unterbauSpieler(state, playerId);
        if (!p) return { success: false, error: "Er spielt weder in der U23 noch in der U19." };
        if (rolle !== undefined && !this.EINSATZ[rolle]) return { success: false, error: "Diese Rolle gibt es nicht." };
        if (pos && (p.pos === "TW" || !this.PLAN_POSITIONEN.includes(pos))) return { success: false, error: "Auf dieser Position kann er nicht spielen." };
        const alt = this.einsatzVon(p);
        const neu = { rolle: rolle === undefined ? alt.rolle : rolle, pos: pos === undefined ? alt.pos : (pos && pos !== p.pos ? pos : null) };
        p.einsatz = neu.rolle === "auto" && !neu.pos ? undefined : neu;
        return { success: true, einsatz: this.einsatzVon(p) };
    },

    /** Was einer in der Elf beiträgt: auf einer fremden Position weniger (wie im Spiel) */
    einsatzStaerke(p) {
        const pos = this.einsatzVon(p).pos;
        if (!pos) return p.overall || 0;
        const me = _reResolve("MatchEngine", "./matchEngine.js");
        const mod = me && typeof me.getPositionModifier === "function" ? me.getPositionModifier(p, pos) : 1;
        return (p.overall || 0) * (0.5 + 0.5 * mod);
    },

    /**
     * Die Elf nach dem Einsatzplan: zuerst die Stammspieler, dann die
     * Rotation, die an der Reihe ist (höchstens halb so viele Spiele wie die
     * Mannschaft), dann wer automatisch zu den Besten gehört, dann die übrige
     * Rotation (wer am wenigsten gespielt hat, zuerst) und zuletzt die für
     * den Notfall. Geschonte spielen nicht. Im Tor steht genau einer.
     */
    elfNachPlan(kandidaten, feld, saison, mannschaftsSpiele = 0) {
        const spiele = (p) => (p[feld] && p[feld].saison === saison ? p[feld].spiele : 0);
        const stufe = (p) => {
            const r = this.einsatzVon(p).rolle;
            if (r === "stamm") return 0;
            if (r === "rotation") return spiele(p) * 2 <= mannschaftsSpiele ? 1 : 3;
            if (r === "auto") return 2;
            if (r === "bedarf") return 4;
            return 9;
        };
        const reihe = (kandidaten || []).filter(p => stufe(p) < 9)
            .sort((a, b) => (stufe(a) - stufe(b)) || (stufe(a) === 3 ? spiele(a) - spiele(b) : 0) || (this.einsatzStaerke(b) - this.einsatzStaerke(a)));
        const torwart = reihe.find(p => p.pos === "TW");
        const feldspieler = reihe.filter(p => p.pos !== "TW").slice(0, torwart ? 10 : 11);
        return torwart ? [torwart, ...feldspieler] : feldspieler;
    },

    /** Nach dem Spiel: Wer auf einer fremden Position stand, lernt sie (wie bei den Profis) */
    lerneAufPosition(p, praxis, auf = null) {
        const pos = auf && auf !== p.pos ? auf : this.einsatzVon(p).pos;
        const pe = _reResolve("PositionEngine", "./positionEngine.js");
        if (!pos || pos === p.pos || !pe || typeof pe.gainPositionExperience !== "function") return null;
        return pe.gainPositionExperience(p, pos, this.POSITION_JE_SPIEL * praxis);
    },

    // ------------------------------------------- Aufstellung von U23 und U19

    /**
     * U23 und U19 wie die Profis: eine Formation, eine Startelf auf festen
     * Plätzen und eine Mentalität (state.unterbau.u23 / .u19).
     *
     * Bisher stellte sich die Elf allein aus dem Einsatzplan, ohne Formation:
     * Wer spielte, stand irgendwo, und zählte mit seiner Stärke, egal ob als
     * Linksverteidiger im Sturm. Jetzt steht jeder auf einem Platz der
     * Formation und bringt dort, was er auf dieser Position kann. Plätze,
     * die der Trainer festlegt, bleiben so, solange der Spieler fit ist; die
     * übrigen füllt der Einsatzplan - jeder auf den Platz, der ihm am besten
     * liegt.
     */
    MANNSCHAFTEN: { u23: "U23", u19: "U19" },
    MENTALITAETEN: {
        defensiv: { label: "Defensiv", text: "Tief stehen, wenig zulassen - vorne kommt weniger", eigen: 0.86, gegner: 0.84 },
        ausgewogen: { label: "Ausgewogen", text: "Wie es das Spiel hergibt", eigen: 1, gegner: 1 },
        offensiv: { label: "Offensiv", text: "Früh nach vorn - mehr Tore auf beiden Seiten", eigen: 1.14, gegner: 1.12 }
    },
    STANDARD_FORMATION: "4-4-2",

    /** Plan einer Mannschaft - wird beim ersten Zugriff angelegt */
    teamPlan(state, team) {
        if (!this.MANNSCHAFTEN[team] || !state) return null;
        if (!state.unterbau || typeof state.unterbau !== "object") state.unterbau = {};
        const plan = state.unterbau[team] || (state.unterbau[team] = {});
        if (!this._formationVon(plan.formation)) plan.formation = this.STANDARD_FORMATION;
        if (!Array.isArray(plan.lineup)) plan.lineup = [];
        if (!this.MENTALITAETEN[plan.mentalitaet]) plan.mentalitaet = "ausgewogen";
        return plan;
    },

    /** Alle Formationen der Spielwelt (Browser und Node) */
    _konfigs() {
        if (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS) return FORMATION_CONFIGS;
        return _reResolve("FORMATION_CONFIGS", "./gameState.js") || {};
    },

    /** Eine Formation, die es gibt - eigene Entwürfe der Profis zählen nicht */
    _formationVon(key) {
        const cfg = key ? this._konfigs()[key] : null;
        return cfg && !cfg.custom && Array.isArray(cfg.positions) && cfg.positions.length === 11 ? cfg : null;
    },

    /** Die Formationen, die eine Unterbau-Mannschaft spielen kann */
    formationen() {
        return Object.keys(this._konfigs()).filter(key => this._formationVon(key))
            .map(key => ({ key, name: this._konfigs()[key].name || key }));
    },

    /** Die Plätze der Formation einer Mannschaft */
    teamSlots(state, team) {
        const plan = this.teamPlan(state, team);
        return plan ? this._formationVon(plan.formation).positions : [];
    },

    /** Wer zur Mannschaft gehört: U23 die zweite Mannschaft, U19 Akademie und junge Profis */
    teamKader(state, team) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        if (!club) return [];
        if (team === "u23") return this.spieler(state, club);
        const jl = _reResolve("JugendligaEngine", "./jugendligaEngine.js");
        return jl && typeof jl.eigeneSpieler === "function" ? jl.eigeneSpieler(state) : [];
    },

    _einsatzbereit(p) {
        return (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0 && !p.abgestellt;
    },

    /** Wie gut einer auf einem Platz steht (0 bis 1): die eigene Position zählt voll */
    platzEignung(p, pos) {
        if (!p || !pos) return 0;
        if (p.pos === pos) return 1;
        if (pos === "TW" || p.pos === "TW") return 0.15;
        const me = _reResolve("MatchEngine", "./matchEngine.js");
        return me && typeof me.getPositionModifier === "function" ? me.getPositionModifier(p, pos) : 0.7;
    },

    /** Was einer auf einem Platz beiträgt - wie einsatzStaerke, nur für den Platz */
    staerkeAuf(p, pos) {
        return (p.overall || 0) * (0.5 + 0.5 * this.platzEignung(p, pos));
    },

    /**
     * Die Startelf auf den Plätzen der Formation:
     * [{ slot, pos, spieler | null, fest }] - fest heißt vom Trainer gesetzt.
     * Wer fehlt (verletzt, gesperrt, nicht mehr im Team), dessen Platz füllt
     * der Einsatzplan; reicht der Kader nicht, bleibt er leer (Amateure).
     */
    aufstellung(state, team, kandidaten = null) {
        const plan = this.teamPlan(state, team);
        if (!plan) return [];
        const slots = this._formationVon(plan.formation).positions;
        const saison = state?.seasonYear || 1;
        const kader = (kandidaten || this.teamKader(state, team)).filter(p => this._einsatzbereit(p));
        const nachId = new Map(kader.map(p => [String(p.id), p]));
        const platz = slots.map((s, i) => ({ slot: i, pos: s.pos, spieler: null, fest: false }));
        const vergeben = new Set();
        // 1. Was der Trainer festgelegt hat
        platz.forEach((pl, i) => {
            const p = plan.lineup[i] != null ? nachId.get(String(plan.lineup[i])) : null;
            if (p && !vergeben.has(p)) { pl.spieler = p; pl.fest = true; vergeben.add(p); }
        });
        // 2. Der Rest nach dem Einsatzplan - jeder auf den freien Platz, der ihm am besten liegt
        const frei = platz.filter(pl => !pl.spieler);
        if (frei.length) {
            const liga = team === "u23" ? state?.u23liga : state?.jugendliga;
            const spiele = liga && liga.saison === saison ? (liga.eigene || []).length : 0;
            let reihe = this.elfNachPlan(kader.filter(p => !vergeben.has(p)), team, saison, spiele);
            const twFrei = frei.some(pl => pl.pos === "TW");
            if (!twFrei) reihe = reihe.filter(p => p.pos !== "TW");
            const feldFrei = frei.filter(pl => pl.pos !== "TW").length;
            const tw = twFrei ? reihe.find(p => p.pos === "TW") : null;
            reihe = (tw ? [tw] : []).concat(reihe.filter(p => p.pos !== "TW").slice(0, feldFrei));
            reihe.forEach(p => {
                const wunsch = this.einsatzVon(p).pos;
                const offen = frei.filter(pl => !pl.spieler && (p.pos === "TW") === (pl.pos === "TW"));
                if (!offen.length) return;
                const best = offen.reduce((b, pl) => {
                    const wert = this.platzEignung(p, pl.pos) + (wunsch && wunsch === pl.pos ? 0.5 : 0);
                    return wert > b.wert ? { pl, wert } : b;
                }, { pl: null, wert: -1 }).pl;
                if (best) { best.spieler = p; vergeben.add(p); }
            });
            // Ohne eigenen Torwart hütet ein Amateur das Tor - kein Feldspieler
        }
        return platz;
    },

    /** Den Trainer einen Spieler auf einen Platz stellen lassen (null macht den Platz wieder frei) */
    setzeAufPlatz(state, team, slotIndex, playerId) {
        const plan = this.teamPlan(state, team);
        if (!plan) return { success: false, error: "Diese Mannschaft gibt es nicht." };
        const slots = this._formationVon(plan.formation).positions;
        if (!(slotIndex >= 0 && slotIndex < slots.length)) return { success: false, error: "Diesen Platz gibt es nicht." };
        while (plan.lineup.length < slots.length) plan.lineup.push(null);
        if (playerId == null) { plan.lineup[slotIndex] = null; return { success: true }; }
        const p = this.teamKader(state, team).find(x => String(x.id) === String(playerId));
        if (!p) return { success: false, error: `Er spielt nicht in der ${this.MANNSCHAFTEN[team]}.` };
        if (!this._einsatzbereit(p)) return { success: false, error: `${p.name} ist nicht einsatzbereit.` };
        // Stand er schon woanders, tauschen beide die Plätze
        const alt = plan.lineup.findIndex(id => id != null && String(id) === String(p.id));
        const vorher = plan.lineup[slotIndex];
        if (alt >= 0 && alt !== slotIndex) plan.lineup[alt] = vorher ?? null;
        plan.lineup[slotIndex] = p.id;
        // Wer eingeteilt wird, wird nicht mehr geschont
        if (this.einsatzVon(p).rolle === "schonen") this.setzeEinsatz(state, p.id, "auto", undefined);
        return { success: true };
    },

    /** Formation wechseln: festgelegte Spieler bleiben, wo die Position passt */
    setzeFormation(state, team, formation) {
        const plan = this.teamPlan(state, team);
        const neu = this._formationVon(formation);
        if (!plan || !neu) return { success: false, error: "Diese Formation gibt es nicht." };
        const alt = this._formationVon(plan.formation).positions;
        const fest = plan.lineup.map((id, i) => (id != null ? { id, pos: alt[i]?.pos } : null)).filter(Boolean);
        const lineup = neu.positions.map(() => null);
        // Erst gleiche Position, dann die Reihenfolge
        fest.forEach(f => {
            const i = neu.positions.findIndex((s, k) => lineup[k] == null && s.pos === f.pos);
            if (i >= 0) { lineup[i] = f.id; f.gesetzt = true; }
        });
        fest.filter(f => !f.gesetzt && f.pos !== "TW").forEach(f => {
            const i = neu.positions.findIndex((s, k) => lineup[k] == null && s.pos !== "TW");
            if (i >= 0) lineup[i] = f.id;
        });
        plan.formation = formation;
        plan.lineup = lineup;
        return { success: true };
    },

    setzeMentalitaet(state, team, mentalitaet) {
        const plan = this.teamPlan(state, team);
        if (!plan || !this.MENTALITAETEN[mentalitaet]) return { success: false, error: "Diese Mentalität gibt es nicht." };
        plan.mentalitaet = mentalitaet;
        return { success: true };
    },

    /** Alle Plätze wieder dem Einsatzplan überlassen */
    automatischAufstellen(state, team) {
        const plan = this.teamPlan(state, team);
        if (!plan) return { success: false };
        plan.lineup = [];
        return { success: true };
    },

    /** Stärke der Elf auf ihren Plätzen; leere Plätze zählen mit dem Wert der Aushilfen */
    staerkeDerElf(aufstellung, aushilfe) {
        const summe = aufstellung.reduce((s, pl) => s + (pl.spieler ? this.staerkeAuf(pl.spieler, pl.pos) : aushilfe), 0);
        return summe / Math.max(1, aufstellung.length);
    },

    /** Torgefahr je Platz - so treffen vor allem die Vorderen */
    TORGEFAHR: { ST: 5, LA: 3, RA: 3, OM: 3, LM: 2, RM: 2, ZM: 1.5, DM: 0.7, LV: 0.5, RV: 0.5, IV: 0.5, TW: 0 },

    /** Die Tabelle, sortiert: [{ rang, name, eigen, spiele, s, u, n, tore, gegentore, punkte }] */
    ligaTabelle(state) {
        const liga = state && state.u23liga;
        if (!liga) return [];
        return liga.teams.map((t, i) => {
            const z = liga.tabelle[i];
            return { name: t.name, clubId: t.clubId, eigen: i === 0, spiele: z[0] + z[1] + z[2], s: z[0], u: z[1], n: z[2], tore: z[3], gegentore: z[4], punkte: z[5] };
        }).sort((a, b) => (b.punkte - a.punkte) || ((b.tore - b.gegentore) - (a.tore - a.gegentore)) || (b.tore - a.tore) || a.name.localeCompare(b.name))
            .map((z, i) => Object.assign(z, { rang: i + 1 }));
    },

    _ligaSaisonende(state, liga) {
        const tab = this.ligaTabelle(state);
        const meister = tab[0];
        liga.meister = meister ? meister.name : null;
        const eigen = tab.find(z => z.eigen);
        const bester = Object.values(liga.torschuetzen).sort((a, b) => b.tore - a.tore)[0];
        if (meister && meister.eigen) {
            const chronik = _reResolve("ChronikEngine", "./chronikEngine.js");
            if (chronik && typeof chronik.titel === "function") chronik.titel(state, this.LIGA.titel, liga.saison);
        }
        this._post(state, "Nachwuchsleiter",
            meister && meister.eigen ? "🏅 Unsere U23 ist Meister!" : `${this.LIGA.name}: ${eigen ? `Platz ${eigen.rang}` : "Saison beendet"}`,
            (meister && meister.eigen
                ? `Die U23 holt die Meisterschaft der ${this.LIGA.name} - ${meister.punkte} Punkte aus ${meister.spiele} Spielen.`
                : `Die ${this.LIGA.name} ist gespielt. Meister: ${meister ? meister.name : "-"}. Unsere U23 wird ${eigen ? `${eigen.rang}.` : "-"} mit ${eigen ? eigen.punkte : 0} Punkten.`)
            + (bester ? `\n\nBester Torschütze unserer U23: ${bester.name} mit ${bester.tore} Toren.` : ""));
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
        // Die eigene Partie der U23-Liga an diesem Spieltag - sie wird auch
        // gespielt, wenn niemand in der U23 steht: dann mit Amateuren
        const liga = club.id === state.userClubId ? this.ligaStarte(state) : null;
        const ligaRunde = liga && liga.runde < liga.runden.length ? liga.runden[liga.runde] : null;
        if (!kader.length && !ligaRunde) return null;

        const { elf, auffuellen, staerke: eigene, profiSchnitt, aufstellung } = this.u23Staerke(state, club, kader);
        const platzVon = new Map(aufstellung.filter(pl => pl.spieler).map(pl => [pl.spieler, pl.pos]));
        // Der Gegner: in der Liga die angesetzte zweite Mannschaft, sonst
        // eine, die im Mittel etwas schwächer ist als die eigenen Profis
        const paarung = ligaRunde ? ligaRunde.find(([h, a]) => h === 0 || a === 0) : null;
        const gegnerIndex = paarung ? (paarung[0] === 0 ? paarung[1] : paarung[0]) : null;
        const gegner = gegnerIndex !== null ? liga.teams[gegnerIndex].staerke : profiSchnitt - 11 + (zufall() - 0.5) * 10;
        const heim = paarung ? paarung[0] === 0 : true;
        const diff = eigene - gegner;
        const lam = (d) => Math.max(0.25, 1.35 * Math.exp(d / 22));
        // Die Mentalität: offensiv mehr Tore auf beiden Seiten, defensiv weniger
        const ment = club.id === state.userClubId ? this.MENTALITAETEN[this.teamPlan(state, "u23").mentalitaet] : this.MENTALITAETEN.ausgewogen;
        // Der Heimvorteil (zwei Punkte) gilt für den, der zu Hause spielt
        const tore = this._poisson(lam(diff + (heim ? 2 : 0)) * ment.eigen, zufall);
        const gegentore = this._poisson(lam(-diff + (heim ? 0 : 2)) * ment.gegner, zufall);

        const meldungen = [];
        if (ligaRunde) this._ligaRunde(state, liga, ligaRunde, eigene, { tore, gegentore, heim, gegnerIndex }, zufall);
        elf.forEach(p => {
            p.spielpraxis = Math.round(((p.spielpraxis ?? 0.5) * 0.82 + this.PRAXIS_WERT * 0.18) * 1000) / 1000;
            p.matchSharpness = Math.min(100, (p.matchSharpness ?? 60) + 6);
            p.fitness = Math.max(40, (p.fitness ?? 100) - 6);
            this.lerneAufPosition(p, this.PRAXIS_WERT, platzVon.get(p));
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

        // Torschützen nach dem Platz in der Formation: vorne trifft man öfter
        const gewicht = elf.map(p => (this.TORGEFAHR[platzVon.get(p) || p.pos] ?? 1) * Math.max(1, (p.overall || 40) - 35));
        const summe = gewicht.reduce((s, x) => s + x, 0);
        const schuetzen = [];
        const toreVon = new Map();
        for (let i = 0; i < tore && elf.length && summe > 0; i++) {
            let r = zufall() * summe, k = 0;
            while (k < elf.length - 1 && r > gewicht[k]) { r -= gewicht[k]; k++; }
            const s = elf[k];
            schuetzen.push(s.name); toreVon.set(s, (toreVon.get(s) || 0) + 1);
        }
        if (liga && ligaRunde) {
            toreVon.forEach((n, s) => {
                const e = liga.torschuetzen[String(s.id)] || (liga.torschuetzen[String(s.id)] = { name: s.name, tore: 0 });
                e.tore += n;
            });
            const letztes = liga.eigene[liga.eigene.length - 1];
            if (letztes) letztes.schuetzen = schuetzen.slice();
            if (liga.runde >= liga.runden.length) this._ligaSaisonende(state, liga);
        }
        // Jeder in der Elf bekommt seine Note - so sieht man, wer sich aufdrängt
        const saison = state.seasonYear || 1;
        const schnitt = elf.length ? elf.reduce((s, p) => s + (p.overall || 0), 0) / elf.length : 50;
        elf.forEach(p => this.bucheEinsatz(p, "u23", saison,
            this.note(p, toreVon.get(p) || 0, tore - gegentore, schnitt, `u23|${saison}|${state.currentMatchday || 0}`), toreVon.get(p) || 0));

        const bilanz = club.reserveBilanz || (club.reserveBilanz = { spiele: 0, s: 0, u: 0, n: 0, tore: 0, gegentore: 0, letzte: [] });
        bilanz.spiele++;
        bilanz.tore += tore;
        bilanz.gegentore += gegentore;
        if (tore > gegentore) bilanz.s++; else if (tore === gegentore) bilanz.u++; else bilanz.n++;
        const ergebnis = { matchday: state.currentMatchday || 0, tore, gegentore, schuetzen, auffuellen, elf: elf.map(p => p.id),
            gegner: gegnerIndex !== null ? liga.teams[gegnerIndex].name : null, heim };
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
