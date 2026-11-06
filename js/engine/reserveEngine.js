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
    /**
     * Die Altersregel der zweiten Mannschaften (Spielordnungen der Verbände,
     * gestützt auf § 11 der DFB-Spielordnung): Stichtag ist der 30. Juni vor
     * der Saison. Wer dann das 23. Lebensjahr vollendet hat, ist Ü23. Das
     * Alter im Spiel ist das Alter zum Saisonbeginn - Ü23 heißt also: 23
     * oder älter.
     */
    ALTERSGRENZE: 23,
    /**
     * Höchstens drei Ü23 dürfen GLEICHZEITIG auf dem Platz stehen. Im Kader
     * dürfen es mehr sein - bisher begrenzte das Spiel den Kader auf drei
     * Spieler über 23 und ließ 23-Jährige als U23 zählen.
     */
    MAX_UEBERALTERT: 3,
    MIN_PROFIKADER: 16,
    /** Spielpraxis je Partie: Profis zählen voll, die U23 zu diesem Teil */
    PRAXIS_WERT: 0.7,
    /** Was ein KI-Talent ohne Einsatz in seiner zweiten Mannschaft sammelt */
    KI_PRAXIS: 0.3,
    VERLETZUNG: 0.012,

    /** Ü23 nach dem Stichtag: am 30. Juni vor der Saison schon 23 */
    istUe23(player) {
        return (player?.age || 30) >= this.ALTERSGRENZE;
    },

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
        const regel = this.u23Regel(state, club);
        if (!regel.hat) return { ok: false, grund: regel.grund };
        if (this.profis(state, club).length - 1 < this.MIN_PROFIKADER) {
            return { ok: false, grund: `Im Profikader müssen mindestens ${this.MIN_PROFIKADER} Spieler bleiben.` };
        }
        return { ok: true, hinweis: this.ue23Hinweis(state, club, player) };
    },

    /**
     * Ein Ü23 darf in den Kader, egal wie viele es schon sind - spielen
     * können aber nur drei zugleich. Der Hinweis sagt, wenn es eng wird.
     */
    ue23Hinweis(state, club, player) {
        if (!this.istUe23(player)) return null;
        const schon = this.spieler(state, club).filter(p => p !== player && this.istUe23(p)).length;
        return schon >= this.MAX_UEBERALTERT
            ? `In der U23 stehen schon ${schon} Spieler ab ${this.ALTERSGRENZE}. Gleichzeitig auf dem Platz dürfen nur ${this.MAX_UEBERALTERT} stehen - einer sitzt dann draußen.`
            : null;
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
        if (this.istUe23(player) || (player.overall || 0) >= this._kaderSchnitt(state, club)) {
            player.morale = Math.max(0, (player.morale ?? 70) - 8);
        }
        return { success: true, player, ausElf: warDabei, hinweis: check.hinweis || null };
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
        // Aus der zweiten Mannschaft für immer hoch: jetzt ein Profi wie jeder andere
        player.zweite = undefined;
        return { success: true, player, von };
    },

    /**
     * Zwischen U23 und U19 wechseln, ohne Umweg über die Profis: in die U19
     * nur bis zum Alter der A-Jugend, in die U23 nur, wenn es eine gibt.
     */
    wechsleTeam(state, playerId) {
        const player = (state?.players || []).find(p => String(p.id) === String(playerId));
        if (!player || !player.reserve) return { success: false, error: "Er spielt weder in der U23 noch in der U19." };
        const club = (state.clubs || []).find(c => c.id === player.clubId);
        if (player.reserve === this.U19) {
            const regel = this.u23Regel(state, club);
            if (!regel.hat) return { success: false, error: regel.grund };
            const hinweis = this.ue23Hinweis(state, club, player);
            player.reserve = true;
            return { success: true, player, nach: "U23", hinweis };
        }
        const youth = _reResolve("YouthEngine", "./youthEngine.js");
        const grenze = youth?.AKADEMIE_HOECHSTALTER ?? 19;
        if ((player.age || 30) > grenze) return { success: false, error: `In der U19 spielt nur, wer höchstens ${grenze} ist.` };
        player.reserve = this.U19;
        return { success: true, player, nach: "U19" };
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
        if (player) player.zweite = undefined;
        if (player) player.nominiertAus = undefined;
    },

    _kaderSchnitt(state, club) {
        const profis = this.profis(state, club).map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 14);
        return profis.length ? profis.reduce((a, b) => a + b, 0) / profis.length : 60;
    },

    // ------------------------------------- Zweite Mannschaft nach Land und Stufe

    /**
     * Wer eine zweite Mannschaft hat und wo sie spielt - nach Land und Stufe
     * der Profis, wie in der Wirklichkeit. Bisher hatte jeder Verein eine
     * U23, auch der Landesligist, aber in keiner stand ein Spieler: Sie
     * bestand nur aus Profis, die der Trainer selbst hinunterschickte, und
     * aus Amateuren, die auffüllten.
     *
     *  - gemischt (Deutschland, Spanien, Italien): Die zweite Mannschaft
     *    spielt im Ligasystem mit - gegen die ersten Mannschaften einer
     *    tieferen Liga und ein paar andere zweite Mannschaften. Sie steigt
     *    auf und ab, aber nie in die Liga der eigenen Profis (hoechste).
     *    start: wo sie nach Stufe der Profis anfängt.
     *  - eigen (England, Frankreich, die übrigen Länder): eine eigene Liga
     *    der zweiten Mannschaften.
     * bisStufe: bis zu welcher Stufe der Profis es eine zweite Mannschaft
     * gibt. Darunter spielt der Nachwuchs in der U19, die Älteren bei den
     * Profis - so in der Landesliga.
     */
    U23_LAENDER: {
        // Höchstens 3. Liga; die eines Drittligisten nicht in der Regionalliga
        // (erst wenn die Profis in die 2. Liga aufsteigen) - so die DFB-Statuten
        de: { bisStufe: 3, art: "gemischt", start: { 1: 4, 2: 4, 3: 5 }, hoechste: { 1: 3, 2: 3, 3: 5 }, zusatz: "II" },
        es: { bisStufe: 2, art: "gemischt", start: { 1: 3, 2: 3 }, hoechste: 3, zusatz: "B" },
        it: { bisStufe: 1, art: "gemischt", start: { 1: 3 }, hoechste: 3, zusatz: "U23" },
        en: { bisStufe: 2, art: "eigen", zusatz: "U21" },
        fr: { bisStufe: 2, art: "eigen", zusatz: "B" },
        sonst: { bisStufe: 1, art: "eigen", zusatz: "U23" }
    },
    /** So viele Spieler hat die zweite Mannschaft, nach Stufe der Profis */
    U23_KADER: { 1: 22, 2: 21, 3: 20 },
    /** Die Positionen in der Reihenfolge, in der eine Mannschaft entsteht */
    KADER_PLAN: ["TW", "IV", "IV", "LV", "RV", "DM", "ZM", "ZM", "OM", "LA", "RA", "ST",
        "TW", "IV", "LV", "RV", "ST", "DM", "ZM", "LM", "RM", "IV", "ST", "OM"],
    /** Die zweite Mannschaft zahlt Nachwuchsgehälter: ein Teil dessen, was ihre Liga zahlt */
    U23_LOHN: 0.6,

    /** Die Ligen eines Landes auf einer Stufe */
    _ligenDerStufe(state, land, stufe) {
        return (state?.leagues || []).filter(l => (l.countryId || "de") === land && (l.level || 1) === stufe && !l.hintergrund);
    },

    /** Die tiefste Stufe eines Landes */
    _tiefsteStufe(state, land) {
        return (state?.leagues || []).filter(l => (l.countryId || "de") === land).reduce((m, l) => Math.max(m, l.level || 1), 1);
    },

    /** Eine feste Zahl je Verein - so bleibt die Staffel über die Jahre dieselbe */
    _hash(text) {
        let h = 2166136261;
        for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
        return h >>> 0;
    },

    /**
     * Die Regel für einen Verein: { hat, art, land, stufe, liga, hoechste,
     * tiefste, zusatz } - bei "gemischt" mit der Stufe und der Liga, in der
     * die zweite Mannschaft gerade spielt. hat: false mit grund, wenn es
     * keine gibt.
     */
    u23Regel(state, club) {
        if (!club) return { hat: false, grund: "Kein Verein." };
        const land = club.countryId || "de";
        const regel = this.U23_LAENDER[land] || this.U23_LAENDER.sonst;
        const profi = club.level || 1;
        if (profi > regel.bisStufe) {
            return { hat: false, land, zusatz: regel.zusatz,
                grund: `Eine zweite Mannschaft haben in diesem Land nur Vereine bis zur ${regel.bisStufe}. Liga. Die Jungen spielen in der U19 oder bei den Profis.` };
        }
        if (regel.art === "gemischt") {
            const tiefste = this._tiefsteStufe(state, land);
            const grenze = typeof regel.hoechste === "object" ? (regel.hoechste[profi] || profi + 1) : regel.hoechste;
            const hoechste = Math.max(grenze, profi + 1);
            const gemerkt = state?.u23Stufe && state.u23Stufe.clubId === club.id ? state.u23Stufe.stufe : null;
            const stufe = Math.max(hoechste, Math.min(tiefste, gemerkt || regel.start[profi] || hoechste));
            const ligen = this._ligenDerStufe(state, land, stufe);
            if (ligen.length && stufe > profi) {
                const liga = ligen[this._hash(club.id) % ligen.length];
                return { hat: true, art: "gemischt", land, stufe, liga, hoechste, tiefste, zusatz: regel.zusatz };
            }
        }
        return { hat: true, art: "eigen", land, zusatz: regel.zusatz, bisStufe: regel.bisStufe };
    },

    /** Warum die zweite Mannschaft nicht höher darf - für Nachrichten und den Reiter Jugend */
    grenzText(club, regel) {
        const profi = club?.level || 1;
        if (!regel || regel.art !== "gemischt") return "";
        if (regel.hoechste <= profi + 1) return "Eine zweite Mannschaft spielt nie so hoch wie die eigenen Profis.";
        if (profi >= 3) {
            return `Die zweite Mannschaft eines Vereins der ${profi}. Liga spielt höchstens in der ${regel.hoechste}. Liga - erst wenn die Profis aufsteigen, darf sie höher.`;
        }
        return `Höher als die ${regel.hoechste}. Liga spielen zweite Mannschaften nicht - darüber spielen nur erste Mannschaften.`;
    },

    /** Hat der Verein eine zweite Mannschaft? */
    hatU23(state, club) {
        return this.u23Regel(state, club).hat;
    },

    /** Stärke einer Mannschaft: die besten vierzehn ihrer Profis */
    _vereinsSchnitt(state, clubId, nachVerein = null) {
        const werte = nachVerein ? (nachVerein.get(clubId) || [])
            : (state.players || []).filter(p => p.clubId === clubId && !p.reserve).map(p => p.overall || 0);
        const w = werte.slice().sort((a, b) => b - a).slice(0, 14);
        return w.length ? w.reduce((a, b) => a + b, 0) / w.length : 55;
    },

    /** Die Profis aller Vereine nach Verein (für viele Vereine auf einmal) */
    _staerkenNachVerein(state) {
        const m = new Map();
        (state.players || []).forEach(p => {
            if (!p.clubId || p.reserve) return;
            if (!m.has(p.clubId)) m.set(p.clubId, []);
            m.get(p.clubId).push(p.overall || 0);
        });
        return m;
    },

    /** Wie stark die Vereine einer Liga im Schnitt sind */
    ligaSchnitt(state, ligaId, nachVerein = null) {
        const karte = nachVerein || this._staerkenNachVerein(state);
        const vereine = (state.clubs || []).filter(c => c.leagueId === ligaId);
        if (!vereine.length) return 55;
        return vereine.reduce((s, c) => s + this._vereinsSchnitt(state, c.id, karte), 0) / vereine.length;
    },

    /**
     * Wie stark die zweite Mannschaft sein soll - daran richten sich die
     * Spieler, die nachkommen. Im Ligasystem: etwa wie die Liga, in der sie
     * spielt (die eines Erstligisten ein Stück darüber). In einer eigenen
     * Liga: ein gutes Stück unter den Profis.
     */
    u23Ziel(state, club, regel = null) {
        const r = regel || this.u23Regel(state, club);
        const profi = this._kaderSchnitt(state, club);
        // Nie schwächer als die eigene U19 - von dort rücken die Besten auf
        const jl = _reResolve("JugendligaEngine", "./jugendligaEngine.js");
        const u19 = jl && typeof jl.basis === "function" ? jl.basis(club) : profi - 24;
        const abstand = r.hat && r.art === "gemischt" ? 22 : 12;
        return Math.min(profi - 6, Math.max(u19 + 1, profi - abstand));
    },

    /**
     * Wo die zweite Mannschaft im Ligasystem anfängt: in der Liga, deren
     * Stärke am besten zu ihr passt - die Mannschaft soll in der oberen
     * Hälfte mitspielen, nicht durchmarschieren. Nie höher als erlaubt.
     */
    startStufe(state, club, regel = null) {
        const r = regel || this.u23Regel(state, club);
        if (!r.hat || r.art !== "gemischt") return null;
        const ziel = this.u23Ziel(state, club, r) - 2;
        const karte = this._staerkenNachVerein(state);
        let beste = null;
        for (let stufe = r.hoechste; stufe <= r.tiefste; stufe++) {
            const ligen = this._ligenDerStufe(state, r.land, stufe);
            if (!ligen.length) continue;
            const liga = ligen[this._hash(club.id) % ligen.length];
            const abstand = Math.abs(this.ligaSchnitt(state, liga.id, karte) - ziel);
            if (!beste || abstand < beste.abstand) beste = { stufe, abstand };
        }
        return beste ? beste.stufe : r.stufe;
    },

    /** Die Fähigkeit (CA), die zu einer Gesamtstärke gehört */
    _caFuer(gen, overall) {
        let lo = 1, hi = 200;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (gen.toOverall(mid) < overall) lo = mid + 1; else hi = mid;
        }
        return lo;
    },

    /**
     * Ein Spieler der zweiten Mannschaft: mit Vertrag bis 23, Nachwuchsgehalt
     * und Werten, die zu seiner Stärke passen. zweite: true heißt, er kam
     * mit der zweiten Mannschaft - nicht als Profi, der hinuntergeschickt
     * wurde.
     */
    _baueSpieler(state, club, { pos, alter, staerke, potenzial, stufe }) {
        const gen = _reResolve("PlayerGenerator", "./playerGenerator.js");
        if (!gen || typeof gen.generatePlayer !== "function") return null;
        const p = gen.generatePlayer(club.id, stufe, pos, null, { countryId: club.countryId || "de", ageRange: [alter, alter] });
        const ca = this._caFuer(gen, Math.max(15, Math.round(staerke)));
        const pa = Math.min(190, Math.max(ca + 4, this._caFuer(gen, Math.round(potenzial))));
        const overall = gen.toOverall(ca);
        const attribute = gen.generateAttributes(pos, overall);
        Object.assign(p, attribute, gen.buildCharacter(pos, attribute), {
            overall, pot: Math.max(overall, gen.toOverall(pa)), trueCurrentAbility: ca, truePotentialAbility: pa
        });
        // Die Kopfwerte neu - sie folgen der Stärke, die er jetzt hat
        (gen.KOPFWERTE || []).forEach(k => { delete p[k]; });
        if (typeof gen.ergaenzeKopfwerte === "function") gen.ergaenzeKopfwerte(p);
        const wert = gen.getValueAndWage(overall, stufe, alter);
        const fin = _reResolve("FinanceEngine", "./financeEngine.js");
        const boden = fin && typeof fin.mindestlohn === "function" ? fin.mindestlohn(club) : 50;
        p.value = wert.value;
        p.trueMarketValue = wert.value;
        p.wage = Math.max(boden, Math.round(wert.wage * this.U23_LOHN / 10) * 10);
        // Bis zur letzten Saison als U23: mit 22 am Stichtag
        p.contractYears = Math.max(1, this.ALTERSGRENZE - alter);
        p.reserve = true;
        p.zweite = true;
        p.squadRole = "Zukunftstalent";
        // Aus dem eigenen Nachwuchs: kein Neuer im Verein (wie YouthEngine.spielerAusTalent)
        p.vereinSeit = (state.seasonYear || 1) * 1000 + (state.currentDayIndex || 0) - 250;
        p.spielpraxis = 0.6;
        return typeof gen.forme === "function" ? gen.forme(p) : p;
    },

    /** Ein Alter für einen neuen Spieler der zweiten Mannschaft */
    _alter(zufall, nachwuchs) {
        if (nachwuchs) return zufall() < 0.7 ? 18 : 19;
        // Nur U23 nach dem Stichtag: höchstens 22
        const gewichte = [[18, 3], [19, 4], [20, 4], [21, 3], [22, 2]];
        let r = zufall() * gewichte.reduce((s, [, g]) => s + g, 0);
        for (const [a, g] of gewichte) { r -= g; if (r < 0) return a; }
        return 20;
    },

    /** Welche Positionen der Mannschaft noch fehlen, bis sie anzahl Spieler hat */
    fehlendePositionen(vorhanden, anzahl, plan = this.KADER_PLAN) {
        const rest = {};
        vorhanden.forEach(p => { rest[p.pos] = (rest[p.pos] || 0) + 1; });
        const offen = [];
        let n = vorhanden.length;
        for (let i = 0; n < anzahl; i++) {
            const pos = plan[i % plan.length];
            if (i < plan.length && (rest[pos] || 0) > 0) { rest[pos]--; continue; }
            offen.push(pos);
            n++;
        }
        return offen;
    },

    /**
     * Die zweite Mannschaft auffüllen, bis sie ihre Größe hat - beim
     * Karrierestart mit Spielern von 18 bis 23, zum Saisonwechsel mit
     * Achtzehn- und Neunzehnjährigen aus dem eigenen Nachwuchs. Was die
     * neuen Spieler verdienen, gibt der Vorstand zum Gehaltsbudget dazu: Die
     * zweite Mannschaft geht nicht vom Geld für die Profis ab.
     * Liefert die neuen Spieler.
     */
    fuelleU23(state, club, { nachwuchs = false, zufall = Math.random } = {}) {
        const regel = this.u23Regel(state, club);
        if (!regel.hat || !Array.isArray(state.players)) return [];
        const anzahl = this.U23_KADER[club.level || 1] || 20;
        const offen = this.fehlendePositionen(this.spieler(state, club), anzahl);
        if (!offen.length) return [];
        const ziel = this.u23Ziel(state, club, regel);
        const stufe = regel.art === "gemischt" ? regel.stufe : Math.min(7, (club.level || 1) + 2);
        const neu = [];
        offen.forEach(pos => {
            const alter = this._alter(zufall, nachwuchs);
            // Die Älteren sind schon weiter; dazu eine Streuung wie in jedem Kader
            const streuung = (zufall() + zufall() - 1) * 6;
            const staerke = ziel - 2 + (alter - 20.5) * 1.4 + streuung;
            const luft = Math.max(2, (this.ALTERSGRENZE - alter) * 2.2 + Math.pow(zufall(), 1.6) * 12);
            const p = this._baueSpieler(state, club, { pos, alter, staerke, potenzial: staerke + luft, stufe });
            if (!p) return;
            state.players.push(p);
            club.playerIds.push(p.id);
            neu.push(p);
        });
        if (club.id === state.userClubId) club.wageBudget = Math.round((club.wageBudget || 0) + neu.reduce((s, p) => s + (p.wage || 0), 0));
        return neu;
    },

    /**
     * Mit 19 verlassen die Jugendspieler des U19-Kaders die A-Jugend. Wer
     * gut genug für die zweite Mannschaft ist, rückt dorthin auf - mit
     * Vertrag bis 23 und Nachwuchsgehalt. Liefert die Aufgerückten.
     */
    ausU19Aufnehmen(state, club, talente) {
        const regel = this.u23Regel(state, club);
        const youth = _reResolve("YouthEngine", "./youthEngine.js");
        const gen = _reResolve("PlayerGenerator", "./playerGenerator.js");
        if (!regel.hat || !youth || typeof youth.spielerAusTalent !== "function" || !gen) return [];
        const ziel = this.u23Ziel(state, club, regel);
        const platz = (this.U23_KADER[club.level || 1] || 20) + 2 - this.spieler(state, club).length;
        const stufe = regel.art === "gemischt" ? regel.stufe : Math.min(7, (club.level || 1) + 2);
        const fin = _reResolve("FinanceEngine", "./financeEngine.js");
        const boden = fin && typeof fin.mindestlohn === "function" ? fin.mindestlohn(club) : 50;
        const gute = (talente || []).filter(t => (t.pot || 0) >= ziel - 2 || (t.overall || 0) >= ziel - 8)
            .sort((a, b) => (b.pot || 0) - (a.pot || 0)).slice(0, Math.max(0, platz));
        const neu = gute.map(t => {
            const lohn = Math.max(boden, Math.round(gen.getValueAndWage(t.overall || 40, stufe, t.age || 19).wage * this.U23_LOHN / 10) * 10);
            const p = youth.spielerAusTalent(state, club, t, { wage: lohn, contractYears: Math.max(1, this.ALTERSGRENZE - (t.age || 19)) });
            p.wage = lohn;
            p.reserve = true;
            p.zweite = true;
            p.squadRole = "Zukunftstalent";
            if (t.u19) p.u19 = Object.assign({}, t.u19);
            state.players.push(p);
            club.playerIds.push(p.id);
            t.promoted = true;
            return p;
        });
        if (club.id === state.userClubId) club.wageBudget = Math.round((club.wageBudget || 0) + neu.reduce((s, p) => s + (p.wage || 0), 0));
        this._aufgerueckt = (this._aufgerueckt || []).concat(neu.map(p => p.name));
        return neu;
    },

    /**
     * Ein Spieler der zweiten Mannschaft geht: zu alt oder ohne zweite
     * Mannschaft. Er sucht sich als Vereinsloser einen neuen Verein; sein
     * Gehalt fällt aus dem Budget, wie es hineinkam.
     */
    _verabschiede(state, club, p) {
        club.playerIds = (club.playerIds || []).filter(id => id !== p.id);
        club.lineup = (club.lineup || []).filter(id => id !== p.id);
        club.bench = (club.bench || []).filter(id => id !== p.id);
        if (club.id === state.userClubId) club.wageBudget = Math.max(0, Math.round((club.wageBudget || 0) - (p.wage || 0)));
        p.clubId = null;
        p.contractYears = 0;
        p.vereinslosAb = state.seasonYear || 1;
        p.reserve = undefined;
        p.zweite = undefined;
        p.nominiertAus = undefined;
        p.einsatz = undefined;
    },

    /**
     * Der Trainer verlässt den Verein: Die zweite Mannschaft führt dort
     * niemand mehr. Ihre Spieler suchen sich neue Vereine, die
     * hinuntergeschickten Profis gehören wieder zum Kader, und die
     * Jugendspieler des U19-Kaders bleiben nicht als Talente in der
     * Akademie der KI stehen. Vorher blieb die U23 beim alten Verein
     * gesperrt - die KI stellt niemanden aus der U23 auf.
     */
    vereinVerlassen(state, clubId) {
        const club = (state?.clubs || []).find(c => c.id === clubId);
        if (!club) return 0;
        const ids = new Set(club.playerIds || []);
        let n = 0;
        (state.players || []).filter(p => ids.has(p.id) && (p.reserve || p.nominiertAus || p.zweite)).forEach(p => {
            if (p.zweite && (p.reserve || p.nominiertAus)) { this._verabschiede(state, club, p); n++; return; }
            p.reserve = undefined;
            p.nominiertAus = undefined;
            p.zweite = undefined;
        });
        if (club.youthAcademy && Array.isArray(club.youthAcademy.prospects)) {
            club.youthAcademy.prospects = club.youthAcademy.prospects.filter(t => t && !t.kader);
        }
        // Die Akademie des alten Vereins ist nicht mehr die eigene
        if (state.youthAcademy) state.youthAcademy.prospects = [];
        if (state.unterbau) Object.values(state.unterbau).forEach(plan => { if (plan && Array.isArray(plan.lineup)) plan.lineup = []; });
        state.u23Stufe = null;
        return n;
    },

    /**
     * Beim Karrierestart und beim Vereinswechsel: Die zweite Mannschaft des
     * eigenen Vereins bekommt ihren Kader, die U19 ihre Jugendspieler.
     * Liefert { u23, u19 } (die neuen Spieler).
     */
    richteUnterbauEin(state, zufall = Math.random) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        if (!club) return { u23: [], u19: [] };
        state.unterbauV2 = 1;
        // Die alte Stufe gehörte zum alten Verein; die neue richtet sich nach der Stärke
        if (state.u23Stufe && state.u23Stufe.clubId !== club.id) state.u23Stufe = null;
        if (!state.u23Stufe) {
            const stufe = this.startStufe(state, club);
            if (stufe) state.u23Stufe = { clubId: club.id, stufe };
        }
        const u23 = this.fuelleU23(state, club, { zufall });
        const youth = _reResolve("YouthEngine", "./youthEngine.js");
        const u19 = youth && typeof youth.fuelleU19 === "function" ? youth.fuelleU19(state, { zufall }) : [];
        // Die Liga richtet sich nach der neuen Mannschaft
        if (state.u23liga && state.u23liga.clubId !== club.id) state.u23liga = null;
        return { u23, u19 };
    },

    /**
     * Zum Saisonwechsel (nach dem Altern, nach Auf- und Abstieg):
     *  - Gibt es keine zweite Mannschaft mehr (Abstieg der Profis), gehen
     *    ihre Spieler, und die hinuntergeschickten Profis kommen zurück.
     *  - Wer über 23 ist, verlässt die zweite Mannschaft.
     *  - Die Lücken füllen Achtzehn- und Neunzehnjährige aus dem Nachwuchs.
     *  - Spielt die zweite Mannschaft im Ligasystem so hoch wie die Profis
     *    nach deren Abstieg, muss sie eine Stufe hinunter.
     * Eine Nachricht fasst es zusammen. Liefert { gehen, kommen, zurueck }.
     */
    saisonwechselUnterbau(state, zufall = Math.random) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const leer = { gehen: [], kommen: [], zurueck: [] };
        if (!club) return leer;
        const regel = this.u23Regel(state, club);
        const u23 = this.spieler(state, club);
        const gehen = [], zurueck = [];
        if (!regel.hat) {
            u23.forEach(p => {
                if (p.zweite) { this._verabschiede(state, club, p); gehen.push(p); } else { p.reserve = undefined; zurueck.push(p); }
            });
            const hatte = gehen.length || zurueck.length;
            state.u23Stufe = null;
            if (hatte) {
                this._post(state, "Nachwuchsleiter", "Keine zweite Mannschaft mehr",
                    `${regel.grund}\n\n`
                    + (gehen.length ? `Die Spieler der zweiten Mannschaft suchen sich neue Vereine: ${gehen.map(p => p.name).join(", ")}.` : "")
                    + (zurueck.length ? `${gehen.length ? "\n\n" : ""}Zurück bei den Profis: ${zurueck.map(p => p.name).join(", ")}.` : ""));
            }
            return { gehen, kommen: [], zurueck };
        }
        // Wer am Stichtag 23 ist, ist Ü23 und geht - wer als Profi hinuntergeschickt war, bleibt.
        // Hat der Trainer den Vertrag verlängert, gehört er jetzt zu den Profis.
        u23.forEach(p => {
            if (!p.zweite) return;
            if (this.istUe23(p)) {
                if ((p.contractYears || 0) > 0) { p.reserve = undefined; p.zweite = undefined; zurueck.push(p); }
                else { this._verabschiede(state, club, p); gehen.push(p); }
            } else if ((p.contractYears || 0) < 1) p.contractYears = Math.max(1, this.ALTERSGRENZE - (p.age || 20));
        });
        // Im Ligasystem: nie in der Liga der Profis oder darüber
        if (regel.art === "gemischt") state.u23Stufe = { clubId: club.id, stufe: regel.stufe };
        const kommen = this.fuelleU23(state, club, { nachwuchs: true, zufall });
        const ausU19 = this._aufgerueckt || [];
        this._aufgerueckt = [];
        if (gehen.length || kommen.length || ausU19.length || zurueck.length) {
            const ligaName = regel.art === "gemischt" ? (regel.liga.shortName || regel.liga.name) : this.LIGA.name;
            const neu = kommen.length + ausU19.length;
            this._post(state, "Nachwuchsleiter", `Zweite Mannschaft: ${neu} neu, ${gehen.length} ${gehen.length === 1 ? "geht" : "gehen"}`,
                (gehen.length ? `Zu alt für die zweite Mannschaft und jetzt vereinslos: ${gehen.map(p => `${p.name} (${p.pos})`).join(", ")}.\n\n` : "")
                + (zurueck.length ? `Mit verlängertem Vertrag jetzt bei den Profis: ${zurueck.map(p => p.name).join(", ")}.\n\n` : "")
                + (ausU19.length ? `Aus unserer U19 rücken auf: ${ausU19.join(", ")}.\n\n` : "")
                + (kommen.length ? `Neu aus dem Nachwuchs der Region: ${kommen.map(p => `${p.name} (${p.pos}, ${p.age})`).join(", ")}.\n\n` : "")
                + `Die zweite Mannschaft spielt in der neuen Saison in der ${ligaName}. Wer bei den Profis gebraucht wird, holen Sie im Reiter Jugend oder über das Menü Aktionen in seiner Akte hoch.`);
        }
        return { gehen, kommen, zurueck };
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

    /**
     * Zur neuen Saison: Teams, Spielplan und leere Tabelle (state.u23liga).
     *
     * Im Ligasystem (U23_LAENDER "gemischt") spielt die zweite Mannschaft
     * gegen die ersten Mannschaften ihrer Liga - etwa der Regionalliga - und
     * ein paar andere zweite Mannschaften; jeder mit seiner echten Stärke.
     * Sonst in einer eigenen Liga der zweiten Mannschaften des Landes, mit
     * den Vereinen bis zur Stufe, die eine haben. Ohne zweite Mannschaft:
     * null.
     */
    ligaStarte(state, zufall = Math.random) {
        const saison = state?.seasonYear || 1;
        const eigen = (state?.clubs || []).find(c => c.id === state.userClubId);
        if (state.u23liga && state.u23liga.saison === saison && (!state.u23liga.clubId || !eigen || state.u23liga.clubId === eigen.id)) return state.u23liga;
        if (!eigen) return null;
        const regel = this.u23Regel(state, eigen);
        if (!regel.hat) return null;
        const land = eigen.countryId || "de";
        const spieltage = Math.max(18, state.totalMatchdays || (state.schedule ? state.schedule.length : 34));
        const karte = this._staerkenNachVerein(state);
        const zweiteName = (c) => `${c.name} ${regel.zusatz || "U23"}`;
        // Andere zweite Mannschaften: Vereine des Landes, die eine haben
        const mitZweiter = (state.clubs || []).filter(c => c.id !== eigen.id && (c.countryId || "de") === land && this.hatU23(state, c));
        let teams, name, ligaId = null, art = regel.art;
        if (regel.art === "gemischt") {
            const ersteTeams = (state.clubs || []).filter(c => c.leagueId === regel.liga.id && c.id !== eigen.id);
            let anzahl = Math.max(this.LIGA.minTeams, Math.min(this.LIGA.maxTeams, Math.floor(spieltage / 2) + 1, ersteTeams.length + mitZweiter.length + 1));
            if (anzahl % 2) anzahl--;
            // Etwa jede fünfte Mannschaft ist eine zweite - die übrigen Plätze die Vereine der Liga
            const zweite = Math.min(mitZweiter.length, Math.max(anzahl - 1 - ersteTeams.length, Math.round((anzahl - 1) * 0.2)));
            const andereZweite = mitZweiter.slice()
                .sort((a, b) => (Math.abs((a.level || 1) - (eigen.level || 1)) - Math.abs((b.level || 1) - (eigen.level || 1))) || ((b.reputation || 0) - (a.reputation || 0)))
                .slice(0, zweite);
            const gemischt = ersteTeams.map(c => ({ c, r: zufall() })).sort((a, b) => a.r - b.r).map(x => x.c).slice(0, anzahl - 1 - andereZweite.length);
            // Die anderen zweiten Mannschaften: so stark, wie es die eigene nach ihrem Verein wäre
            const jl = _reResolve("JugendligaEngine", "./jugendligaEngine.js");
            const zweiteZiel = (c) => {
                const profi = this._vereinsSchnitt(state, c.id, karte);
                const u19 = jl && typeof jl.basis === "function" ? jl.basis(c) : profi - 24;
                return Math.min(profi - 6, Math.max(u19 + 1, profi - 22)) + 1;
            };
            teams = [{ clubId: eigen.id, name: zweiteName(eigen), staerke: null, zweite: true }]
                .concat(gemischt.map(c => ({ clubId: c.id, name: c.name, staerke: Math.round(this._vereinsSchnitt(state, c.id, karte) * 10) / 10 })))
                .concat(andereZweite.map(c => ({ clubId: c.id, name: zweiteName(c), zweite: true,
                    staerke: Math.round((zweiteZiel(c) + (zufall() - 0.5) * 6) * 10) / 10 })));
            name = regel.liga.shortName || regel.liga.name;
            ligaId = regel.liga.id;
        } else {
            const kandidaten = mitZweiter.sort((a, b) => ((a.level || 1) - (b.level || 1)) || ((b.reputation || 0) - (a.reputation || 0)));
            let anzahl = Math.max(Math.min(this.LIGA.minTeams, kandidaten.length + 1), Math.min(this.LIGA.maxTeams, Math.floor(spieltage / 2) + 1, kandidaten.length + 1));
            if (anzahl % 2) anzahl--;
            const andere = kandidaten.slice(0, anzahl - 1);
            teams = [{ clubId: eigen.id, name: zweiteName(eigen), staerke: null, zweite: true }]
                .concat(andere.map(c => ({ clubId: c.id, name: zweiteName(c), zweite: true, staerke: this.zweiteStaerke(this._vereinsSchnitt(state, c.id, karte), zufall) })));
            name = this.LIGA.name;
        }
        if (teams.length < 2) return null;
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
            saison, name, art, ligaId, stufe: regel.art === "gemischt" ? regel.stufe : null, clubId: eigen.id,
            teams, runden: hin.concat(hin.map(r => r.map(([a, b]) => [b, a]))), runde: 0,
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
            : this.elfNachPlan(verfuegbar, "u23", state?.seasonYear || 1, 0, this.MAX_UEBERALTERT).map((p, i) => ({ slot: i, pos: p.pos, spieler: p, fest: false }));
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
    elfNachPlan(kandidaten, feld, saison, mannschaftsSpiele = 0, maxUe23 = Infinity) {
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
        // In der U23 höchstens drei Ü23 zugleich auf dem Platz (maxUe23) -
        // wer darüber hinaus käme, bleibt draußen, der nächste rückt nach
        let ue23 = 0;
        const darf = (p) => {
            if (!this.istUe23(p)) return true;
            if (ue23 >= maxUe23) return false;
            ue23++;
            return true;
        };
        const torwart = reihe.find(p => p.pos === "TW" && (!this.istUe23(p) || ue23 < maxUe23));
        if (torwart) darf(torwart);
        const feldspieler = [];
        for (const p of reihe) {
            if (feldspieler.length >= (torwart ? 10 : 11)) break;
            if (p.pos !== "TW" && darf(p)) feldspieler.push(p);
        }
        return torwart ? [torwart, ...feldspieler] : feldspieler;
    },

    /** Wie viele Ü23 die Elf einer Mannschaft haben darf: nur die U23 kennt die Grenze */
    ue23Grenze(team) {
        return team === "u23" ? this.MAX_UEBERALTERT : Infinity;
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
        // In der U23 höchstens drei Ü23 zugleich - auch bei festen Plätzen
        const grenze = this.ue23Grenze(team);
        let ue23 = 0;
        // 1. Was der Trainer festgelegt hat
        platz.forEach((pl, i) => {
            const p = plan.lineup[i] != null ? nachId.get(String(plan.lineup[i])) : null;
            if (!p || vergeben.has(p)) return;
            if (this.istUe23(p)) { if (ue23 >= grenze) return; ue23++; }
            pl.spieler = p; pl.fest = true; vergeben.add(p);
        });
        // 2. Der Rest nach dem Einsatzplan - jeder auf den freien Platz, der ihm am besten liegt
        const frei = platz.filter(pl => !pl.spieler);
        if (frei.length) {
            const liga = team === "u23" ? state?.u23liga : state?.jugendliga;
            const spiele = liga && liga.saison === saison ? (liga.eigene || []).length : 0;
            const twFrei = frei.some(pl => pl.pos === "TW");
            let reihe = this.elfNachPlan(kader.filter(p => !vergeben.has(p) && (twFrei || p.pos !== "TW")), team, saison, spiele, grenze - ue23);
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
        const neu = plan.lineup.slice();
        if (alt >= 0 && alt !== slotIndex) neu[alt] = vorher ?? null;
        neu[slotIndex] = p.id;
        // Höchstens drei Ü23 zugleich auf dem Platz (Stichtag 30. Juni)
        const grenze = this.ue23Grenze(team);
        if (this.istUe23(p) && grenze < Infinity) {
            const kader = new Map(this.teamKader(state, team).map(x => [String(x.id), x]));
            const ue23 = neu.filter(id => { const x = id != null ? kader.get(String(id)) : null; return !!x && this.istUe23(x); }).length;
            if (ue23 > grenze) {
                return { success: false, error: `Gleichzeitig auf dem Platz dürfen höchstens ${grenze} Spieler stehen, die am Stichtag (30. Juni) schon ${this.ALTERSGRENZE} waren. Nehmen Sie erst einen anderen Ü23 heraus.` };
            }
        }
        plan.lineup = neu;
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

    /**
     * Gespeicherte Aufstellungen wie bei den Profis (TacticsEngine.satz…):
     * Formation, festgelegte Plätze und Mentalität unter einem Namen.
     */
    SAETZE_MAX: 6,

    saetze(state, team) {
        const plan = this.teamPlan(state, team);
        return plan && Array.isArray(plan.saetze) ? plan.saetze : [];
    },

    satzSpeichern(state, team, name) {
        const plan = this.teamPlan(state, team);
        if (!plan) return { success: false, error: "Diese Mannschaft gibt es nicht." };
        const titel = String(name || "").trim().slice(0, 28);
        if (!titel) return { success: false, error: "Bitte einen Namen eingeben." };
        const liste = this.saetze(state, team).slice();
        const i = liste.findIndex(s => String(s.name).toLowerCase() === titel.toLowerCase());
        if (i < 0 && liste.length >= this.SAETZE_MAX) return { success: false, error: `Höchstens ${this.SAETZE_MAX} gespeicherte Aufstellungen - erst eine löschen.` };
        let id = i >= 0 ? liste[i].id : null;
        while (!id) {
            const neu = `us_${Math.random().toString(36).slice(2, 8)}`;
            if (!liste.some(s => s.id === neu)) id = neu;
        }
        const satz = { id, name: titel, saison: state.seasonYear || 1, formation: plan.formation, lineup: plan.lineup.slice(), mentalitaet: plan.mentalitaet };
        if (i >= 0) liste[i] = satz; else liste.push(satz);
        plan.saetze = liste;
        return { success: true, satz, ersetzt: i >= 0 };
    },

    /** Laden: wer nicht mehr da oder nicht fit ist, dessen Platz füllt der Einsatzplan - die Vorgabe bleibt */
    satzLaden(state, team, id) {
        const plan = this.teamPlan(state, team);
        const satz = this.saetze(state, team).find(s => s.id === id);
        if (!plan || !satz) return { success: false, error: "Diese Aufstellung gibt es nicht." };
        if (this._formationVon(satz.formation)) {
            plan.formation = satz.formation;
            plan.lineup = (satz.lineup || []).slice();
        }
        if (this.MENTALITAETEN[satz.mentalitaet]) plan.mentalitaet = satz.mentalitaet;
        const kader = new Map(this.teamKader(state, team).map(p => [String(p.id), p]));
        const fehlen = (satz.lineup || []).filter(x => x != null && !(kader.get(String(x)) && this._einsatzbereit(kader.get(String(x)))))
            .map(x => kader.get(String(x))?.name || (state.players || []).find(p => String(p.id) === String(x))?.name || "ein Spieler, der nicht mehr dabei ist");
        return { success: true, satz, fehlen };
    },

    satzLoeschen(state, team, id) {
        const plan = this.teamPlan(state, team);
        const liste = this.saetze(state, team);
        const rest = liste.filter(s => s.id !== id);
        if (!plan || rest.length === liste.length) return { success: false, error: "Diese Aufstellung gibt es nicht." };
        plan.saetze = rest;
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
        const ligaName = liga.name || this.LIGA.name;
        if (meister && meister.eigen) {
            const chronik = _reResolve("ChronikEngine", "./chronikEngine.js");
            if (chronik && typeof chronik.titel === "function") chronik.titel(state, liga.art === "gemischt" ? `${ligaName} (zweite Mannschaft)` : this.LIGA.titel, liga.saison);
        }
        const wechsel = this._ligaAufAb(state, liga, tab);
        this._post(state, "Nachwuchsleiter",
            wechsel.auf ? `🏅 Die U23 steigt auf: ${wechsel.nach}` : meister && meister.eigen ? "🏅 Unsere U23 ist Meister!" : wechsel.ab ? `U23 steigt ab: ${wechsel.nach}` : `${ligaName}: ${eigen ? `Platz ${eigen.rang}` : "Saison beendet"}`,
            (meister && meister.eigen
                ? `Die U23 holt die Meisterschaft der ${ligaName} - ${meister.punkte} Punkte aus ${meister.spiele} Spielen.`
                : `Die ${ligaName} ist gespielt. Meister: ${meister ? meister.name : "-"}. Unsere U23 wird ${eigen ? `${eigen.rang}.` : "-"} mit ${eigen ? eigen.punkte : 0} Punkten.`)
            + (wechsel.text ? `\n\n${wechsel.text}` : "")
            + (bester ? `\n\nBester Torschütze unserer U23: ${bester.name} mit ${bester.tore} Toren.` : ""));
    },

    /**
     * Auf- und Abstieg der zweiten Mannschaft im Ligasystem: Der Erste
     * steigt auf - nie bis zur Liga der Profis -, die letzten drei steigen
     * ab. Gilt ab der nächsten Saison (state.u23Stufe).
     */
    _ligaAufAb(state, liga, tab) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (liga.art !== "gemischt" || !club || !liga.stufe) return {};
        const regel = this.u23Regel(state, club);
        if (!regel.hat || regel.art !== "gemischt") return {};
        const eigen = tab.find(z => z.eigen);
        if (!eigen) return {};
        const abstieg = tab.length >= 14 ? 3 : 2;
        let stufe = liga.stufe, auf = false, ab = false;
        if (eigen.rang === 1 && stufe - 1 >= regel.hoechste) { stufe--; auf = true; }
        else if (eigen.rang > tab.length - abstieg && stufe + 1 <= regel.tiefste) { stufe++; ab = true; }
        state.u23Stufe = { clubId: club.id, stufe };
        if (!auf && !ab) {
            const sperre = eigen.rang === 1 && liga.stufe - 1 < regel.hoechste;
            return sperre ? { text: `Aufsteigen darf sie nicht: ${this.grenzText(club, regel)}` } : {};
        }
        const ziel = this._ligenDerStufe(state, regel.land, stufe);
        const nach = ziel.length ? (ziel[this._hash(club.id) % ziel.length].shortName || ziel[0].name) : `${stufe}. Liga`;
        return { auf, ab, nach, text: auf ? `In der neuen Saison spielt die zweite Mannschaft in der ${nach}.` : `In der neuen Saison spielt die zweite Mannschaft eine Stufe tiefer, in der ${nach}.` };
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
