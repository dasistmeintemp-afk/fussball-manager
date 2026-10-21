/**
 * ScoutingEngine - Scouts beauftragen, Talente sichten und Spielerberichte erstellen
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _seResolve = (globalName, path) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[globalName]; } catch (e) { return null; }
    }
    return null;
};

/** Feste Zahl zwischen -1 und +1 je Schlüssel (FNV-1a) */
const _seZahl = (schluessel, zusatz) => {
    const text = `${schluessel}|${zusatz}`;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (((hash >>> 0) % 2001) - 1000) / 1000;
};

/** Güte in Sternen - dieselbe Umrechnung wie im Trainerstab */
const _seSterne = (guete) => Math.max(0.5, Math.min(5, Math.round((1 + ((Number(guete) || 50) - 25) / 18) * 2) / 2));

const ScoutingEngine = {
    /**
     * Wie viel bringt ein Scoutbericht über einen Spieler aus einer höheren
     * Liga?
     *
     * Einen Kreisligaspieler schaut sich der Scout an einem Nachmittag an. An
     * einen Serie-A-Profi kommt er kaum heran: keine Trainingsbesuche, keine
     * Gespräche mit dem Umfeld, nur das, was ohnehin im Fernsehen läuft. Jede
     * Ligastufe Unterschied kostet daher spürbar Ertrag.
     */
    reachPenalty(state, player) {
        if (!state || !player || !player.clubId) return 1;

        const userClub = (state.clubs || []).find(c => c.id === state.userClubId);
        const seinVerein = (state.clubs || []).find(c => c.id === player.clubId);
        if (!userClub || !seinVerein) return 1;

        const transferEngine = _seResolve("TransferEngine", "./transferEngine.js");
        const reichweite = transferEngine && typeof transferEngine.marketReach === "function"
            ? transferEngine.marketReach(userClub)
            : 1;

        // Innerhalb der Reichweite arbeitet der Scout ungehindert
        const abstand = reichweite - (seinVerein.level || 1);
        if (abstand <= 0) return 1;

        return Math.max(0.2, 1 - abstand * 0.3);
    },

    /**
     * Wissen je Land
     *
     * Im Vorbild kennt ein Verein nicht die ganze Welt. Im eigenen Land ist
     * jeder Spieler bekannt, aus der Ferne nur die Stars und ein Teil der
     * übrigen. Wie viel, hängt am Ruf des Landes, am Netzwerk des Vereins,
     * am Chefscout und an der Nähe: Ein Verein aus Deutschland kennt sich in
     * Österreich besser aus als in der Türkei.
     *
     * Scout-Aufträge mit Länderfokus bauen das Wissen aus, beobachtete
     * Spieler tragen ein wenig bei. Ohne Pflege verblasst es wieder bis auf
     * das Grundwissen. Gespeichert wird nur der Zugewinn je Land - so
     * stimmt das Grundwissen auch nach einem Vereinswechsel.
     */
    NACHBARN: {
        de: ["at", "ch", "nl"], at: ["de", "ch"], ch: ["de", "at", "fr", "it"],
        en: ["sc"], sc: ["en"], fr: ["be", "ch"], be: ["fr", "nl"], nl: ["be", "de"],
        es: ["pt"], pt: ["es", "br"], br: ["pt"], it: ["ch"], tr: []
    },
    LAND_ZUWACHS_AUFTRAG: 14,
    /**
     * Scouts je Region.
     *
     * Der Chefscout reist mit einem Auftrag ins Ausland und kommt wieder;
     * was er dort lernt, verblasst. Ein Regionalscout lebt in seiner Region:
     * Solange er angestellt ist, kennt der Verein deren Länder deutlich
     * besser (+25 Grundwissen, bis 95 %), Aufträge mit Länderfokus dort
     * bringen anderthalbmal so viel, und er meldet sich von selbst, wenn er
     * ein Talent gesehen hat - im Schnitt alle vier Spieltage, mit Bericht.
     * Er kostet je Spieltag Gehalt; wie viele ein Verein halten kann, hängt
     * an der Liga.
     */
    REGIONEN: {
        britannien: { name: "Britische Inseln", laender: ["en", "sc"] },
        benelux: { name: "Benelux", laender: ["nl", "be"] },
        iberien: { name: "Iberische Halbinsel", laender: ["es", "pt"] },
        frankreich: { name: "Frankreich", laender: ["fr"] },
        alpen: { name: "Alpenraum", laender: ["de", "at", "ch"] },
        italien: { name: "Italien", laender: ["it"] },
        tuerkei: { name: "Türkei", laender: ["tr"] },
        suedamerika: { name: "Südamerika", laender: ["br"] }
    },
    REGION_WISSEN: 25,
    REGION_MAX: { 1: 3, 2: 2, 3: 1 },
    REGION_KOSTEN: { 1: 15000, 2: 7000, 3: 3500 },
    REGION_FUND: 0.25,
    LAND_ZUWACHS_BEOBACHTUNG: 1,
    /** Je Europapokalspiel gegen einen Verein aus dem Land */
    LAND_ZUWACHS_EUROPA: 6,
    LAND_VERBLASSEN: 0.5,

    _laenderDaten() {
        return _seResolve("COUNTRIES_DATA", "../data/leagueData.js") || [];
    },

    /** Vereine nach id - gemerkt je Vereinsliste, die Karten fragen tausendfach */
    _vereinsKarten: new WeakMap(),
    _vereine(state) {
        const clubs = state?.clubs || [];
        let karte = this._vereinsKarten.get(clubs);
        if (!karte || karte.size !== clubs.length) {
            karte = new Map(clubs.map(c => [c.id, c]));
            this._vereinsKarten.set(clubs, karte);
        }
        return karte;
    },

    /** Die Länder mit eigenen Ligen in diesem Spielstand */
    laender(state) {
        const mitVereinen = new Set((state?.clubs || []).map(c => c.countryId).filter(Boolean));
        return this._laenderDaten().filter(l => mitVereinen.has(l.id));
    },

    landName(land) {
        return this._laenderDaten().find(l => l.id === land)?.name || String(land || "").toUpperCase();
    },

    /**
     * Was der Verein ohne eigene Arbeit über ein Land weiß (0 bis 100).
     * Gemerkt je Spielstand, solange Verein, Ruf und Chefscout gleich
     * bleiben - die Spielerkarten fragen tausendfach danach.
     */
    _grundSpeicher: new WeakMap(),
    grundWissen(state, land) {
        const club = this._vereine(state).get(state?.userClubId);
        const heim = club?.countryId || "de";
        if (!land || land === heim) return 100;
        const schluessel = `${state?.userClubId}|${club?.reputation}|${club?.level}|${club?.staff?.scout?.name || ""}|${club?.staff?.scout?.guete ?? ""}|${Object.keys(this.regionalScouts(state)).sort().join(",")}`;
        let gemerkt = state && typeof state === "object" ? this._grundSpeicher.get(state) : null;
        if (!gemerkt || gemerkt.schluessel !== schluessel) {
            gemerkt = { schluessel, werte: {} };
            if (state && typeof state === "object") this._grundSpeicher.set(state, gemerkt);
        }
        if (gemerkt.werte[land] === undefined) {
            const ruf = this._laenderDaten().find(l => l.id === land)?.reputation ?? 70;
            const basis = ruf * 0.6 - 20;
            const netz = Math.max(0, Math.min(25, ((club?.reputation || 50) - 50) * 0.5));
            const scout = (this.scoutInfo(state).guete - 60) * 0.2;
            const nachbar = (this.NACHBARN[heim] || []).includes(land) ? 15 : 0;
            const region = this.hatRegionalScout(state, land) ? this.REGION_WISSEN : 0;
            gemerkt.werte[land] = Math.max(5, Math.min(region ? 95 : 90, Math.round(basis + netz + scout + nachbar + region)));
        }
        return gemerkt.werte[land];
    },

    _landSpeicher(state) {
        if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
        if (!state.scouting.laender || typeof state.scouting.laender !== "object") state.scouting.laender = {};
        return state.scouting.laender;
    },

    /** Das Wissen über ein Land heute: Grundwissen plus Zugewinn */
    landWissen(state, land) {
        const grund = this.grundWissen(state, land);
        if (grund >= 100) return 100;
        const zugewinn = Number(state?.scouting?.laender?.[land]) || 0;
        return Math.min(100, Math.round(grund + zugewinn));
    },

    /** Mehr Wissen über ein Land - bis 100 */
    erweitereLandWissen(state, land, menge) {
        if (!state || !land) return 0;
        const grund = this.grundWissen(state, land);
        if (grund >= 100) return 100;
        const speicher = this._landSpeicher(state);
        speicher[land] = Math.min(100 - grund, (Number(speicher[land]) || 0) + menge);
        return this.landWissen(state, land);
    },

    /** Jeden Spieltag verblasst der Zugewinn ein wenig */
    verblasseLandWissen(state) {
        const speicher = state?.scouting?.laender;
        if (!speicher) return;
        Object.keys(speicher).forEach(land => {
            const rest = (Number(speicher[land]) || 0) - this.LAND_VERBLASSEN;
            if (rest > 0) speicher[land] = Math.round(rest * 10) / 10;
            else delete speicher[land];
        });
    },

    /**
     * In welchem Land ein Spieler spielt. Vereinslose zählen zu ihrer
     * Nation, sofern es dort eine Liga gibt - sonst gelten sie als bekannt.
     */
    landVon(state, player, vereine = null) {
        if (!player) return null;
        if (player.clubId) {
            const verein = (vereine || this._vereine(state)).get(player.clubId);
            if (verein) return verein.countryId || "de";
        }
        return this._laenderDaten().find(l => l.name === player.nationality)?.id || null;
    },

    /**
     * Wer auf dem Markt sichtbar ist. Liefert eine Prüffunktion, die für
     * tausende Spieler schnell genug ist (Wissen je Land vorab berechnet).
     *
     * Bekannt sind: alle Spieler aus Ländern mit vollem Wissen, Stars von
     * überall (ab etwa 86 Stärke kennt sie jeder), Spieler mit eigenem
     * Scoutbericht oder auf der Beobachtungsliste - und vom Rest ein Anteil,
     * der dem Wissen über das Land entspricht. Wer bekannt ist, steht fest
     * je Spieler und bleibt es, solange das Wissen nicht sinkt.
     */
    sichtbarkeit(state) {
        const vereine = new Map((state?.clubs || []).map(c => [c.id, c]));
        const wissen = {};
        const wissenVon = (land) => {
            if (!land) return 100;
            if (wissen[land] === undefined) wissen[land] = this.landWissen(state, land);
            return wissen[land];
        };
        const gemerkt = new Set((state?.scouting?.shortlist || []).map(x => String(typeof x === "object" ? x.playerId ?? x.id : x)));
        (state?.scouting?.beobachtungen || []).forEach(b => gemerkt.add(String(b.playerId)));
        const istSichtbar = (p) => {
            if (!p) return false;
            if (p.clubId && p.clubId === state.userClubId) return true;
            const w = wissenVon(this.landVon(state, p, vereine));
            if (w >= 100) return true;
            if ((p.scoutingKnowledge?.reportsCount || 0) > 0 || gemerkt.has(String(p.id))) return true;
            const ruhm = Math.max(0, Math.min(1, ((p.overall || 0) - 72) / 14));
            const anteil = w / 100;
            return (_seZahl(p.id, "landsicht") + 1) / 2 < anteil + (1 - anteil) * ruhm;
        };
        return { istSichtbar, wissenVon, vereine };
    },

    /**
     * Wie viel die Einschätzung eines Spielers taugt, über den noch kein
     * eigener Bericht vorliegt: aus einem gut bekannten Land fast so viel
     * wie aus dem eigenen, aus der Ferne deutlich weniger
     */
    landFaktor(state, player) {
        if (!state || !player || (player.scoutingKnowledge?.reportsCount || 0) > 0) return 1;
        const w = this.landWissen(state, this.landVon(state, player));
        return 0.7 + 0.3 * w / 100;
    },

    /**
     * Startet einen neuen Scouting-Auftrag
     */
    startAssignment(state, criteria = {}) {
        if (!state) return { success: false, error: "Kein State vorhanden." };
        if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
        if (!Array.isArray(state.scouting.assignments)) state.scouting.assignments = [];

        if (state.scouting.assignments.filter(a => a.status === "active").length >= 3) {
            return { success: false, error: "Maximale Anzahl gleichzeitiger Scout-Aufträge (3) erreicht." };
        }

        // Mit Länderfokus reist der Scout ins Ausland und bleibt länger weg
        const land = criteria.land && criteria.land !== "ALL" ? criteria.land : null;
        if (land) {
            const userClub = (state.clubs || []).find(c => c.id === state.userClubId);
            const te = _seResolve("TransferEngine", "./transferEngine.js");
            const reich = te && typeof te.marketReach === "function" && userClub ? te.marketReach(userClub) : 1;
            if (!(state.clubs || []).some(c => c.countryId === land && (c.level || 1) >= reich)) {
                return { success: false, error: `Die Ligen in ${this.landName(land)} liegen außerhalb der Reichweite Ihres Vereins.` };
            }
        }
        const ausland = land && this.grundWissen(state, land) < 100;
        const assignment = {
            id: "scout_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            position: criteria.position || "ALL",
            maxAge: criteria.maxAge || 26,
            minOverall: criteria.minOverall || 70,
            land,
            matchdaysRemaining: ausland ? 3 : 2,
            status: "active",
            createdMatchday: state.currentMatchday || 1
        };

        state.scouting.assignments.push(assignment);

        return { success: true, assignment: assignment };
    },

    /**
     * Verarbeitet laufende Scouting-Aufträge am Ende jedes Spieltags
     */
    processWeeklyScouting(state) {
        if (!state || !state.scouting) return;
        this.verblasseLandWissen(state);
        this.regionalFunde(state);
        if (!Array.isArray(state.scouting.assignments)) return;

        state.scouting.assignments.forEach(assignment => {
            if (assignment.status !== "active") return;

            assignment.matchdaysRemaining -= 1;

            if (assignment.matchdaysRemaining <= 0) {
                assignment.status = "completed";
                this.completeAssignment(state, assignment);
            }
        });
    },

    // ------------------------------------------------------ Regionalscouts

    regionalScouts(state) {
        const r = state?.scouting?.regionen;
        return r && typeof r === "object" ? r : {};
    },

    regionVon(land) {
        return Object.keys(this.REGIONEN).find(k => this.REGIONEN[k].laender.includes(land)) || null;
    },

    hatRegionalScout(state, land) {
        const region = this.regionVon(land);
        return !!(region && this.regionalScouts(state)[region]);
    },

    /** Wie viele Regionalscouts der eigene Verein halten kann, und was einer je Spieltag kostet */
    regionRahmen(state) {
        const club = this._vereine(state).get(state?.userClubId);
        const stufe = club?.level || 1;
        return { max: this.REGION_MAX[stufe] || 0, kosten: this.REGION_KOSTEN[stufe] || 0, stufe };
    },

    /** Die Regionen zur Auswahl: nur, wo es Länder mit Ligen gibt und nicht nur die Heimat */
    regionen(state) {
        const mitLiga = new Set(this.laender(state).map(l => l.id));
        const heim = this._vereine(state).get(state?.userClubId)?.countryId || "de";
        const aktiv = this.regionalScouts(state);
        return Object.keys(this.REGIONEN)
            .map(key => ({ key, ...this.REGIONEN[key], laender: this.REGIONEN[key].laender.filter(l => mitLiga.has(l) && l !== heim) }))
            .filter(r => r.laender.length)
            .map(r => Object.assign(r, { aktiv: !!aktiv[r.key], seit: aktiv[r.key]?.seit || null }));
    },

    stelleRegionalScoutEin(state, key) {
        if (!this.REGIONEN[key]) return { success: false, error: "Unbekannte Region." };
        if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
        const aktiv = this.regionalScouts(state);
        if (aktiv[key]) return { success: false, error: "Dort ist schon ein Scout." };
        if (!this.regionen(state).some(r => r.key === key)) return { success: false, error: "In dieser Region gibt es nichts zu beobachten." };
        const { max } = this.regionRahmen(state);
        if (Object.keys(aktiv).length >= max) {
            return { success: false, error: max ? `Mehr als ${max} Regionalscouts trägt der Etat in dieser Liga nicht.` : "In dieser Liga hält sich kein Verein Regionalscouts." };
        }
        state.scouting.regionen = Object.assign({}, aktiv, { [key]: { seit: state.seasonYear || 1 } });
        return { success: true };
    },

    entlasseRegionalScout(state, key) {
        const aktiv = this.regionalScouts(state);
        if (!aktiv[key]) return { success: false, error: "Dort ist kein Scout." };
        const neu = Object.assign({}, aktiv);
        delete neu[key];
        state.scouting.regionen = neu;
        return { success: true };
    },

    /** Was die Regionalscouts je Spieltag kosten */
    regionKosten(state) {
        const n = Object.keys(this.regionalScouts(state)).length;
        return n * this.regionRahmen(state).kosten;
    },

    /**
     * Ein Regionalscout meldet sich, wenn er ein Talent gesehen hat: jung,
     * mit Perspektive über dem eigenen Kader, in Reichweite des Vereins und
     * noch ohne Bericht. Er sieht nicht alles - aus den fünf
     * vielversprechendsten greift er einen.
     */
    regionalFunde(state, zufall = Math.random) {
        const aktiv = Object.keys(this.regionalScouts(state));
        if (!aktiv.length || !Array.isArray(state.players)) return [];
        const club = this._vereine(state).get(state.userClubId);
        if (!club) return [];
        const kader = state.players.filter(p => p.clubId === club.id).map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 11);
        const niveau = kader.length ? kader.reduce((a, b) => a + b, 0) / kader.length : 60;
        const te = _seResolve("TransferEngine", "./transferEngine.js");
        const vereine = this._vereine(state);
        const funde = [];
        aktiv.forEach(key => {
            if (zufall() >= this.REGION_FUND) return;
            const laender = new Set(this.REGIONEN[key].laender);
            const kandidaten = state.players.filter(p => p.clubId && p.clubId !== club.id && (p.age || 30) <= 21
                && (p.pot || 0) >= niveau + 3 && !((p.scoutingKnowledge?.reportsCount || 0) > 0)
                && laender.has(this.landVon(state, p, vereine))
                && (!te || typeof te.isWithinReach !== "function" || te.isWithinReach(p, club, state.clubs)))
                .sort((a, b) => (b.pot || 0) - (a.pot || 0))
                .slice(0, 5);
            if (!kandidaten.length) return;
            const p = kandidaten[Math.floor(zufall() * kandidaten.length)];
            const res = this.scoutPlayer(state, p.id, { source: "regionalscout" });
            if (!res || res.success === false) return;
            funde.push(p);
            const verein = vereine.get(p.clubId);
            const news = _seResolve("NewsEngine", "./newsEngine.js");
            if (news && typeof news.addMessage === "function") {
                news.addMessage(state, "scouting", {
                    title: `🔭 Regionalscout ${this.REGIONEN[key].name}: ein Talent`,
                    sender: `Scout ${this.REGIONEN[key].name}`,
                    text: `${p.name} (${p.age}, ${p.pos}) bei ${verein ? verein.name : "seinem Verein"} ist mir aufgefallen. Der Bericht liegt in der Scouting-Zentrale.`,
                    priority: "normal"
                });
            }
        });
        return funde;
    },

    /**
     * Schließt einen Scouting-Auftrag ab und generiert Berichte
     */
    completeAssignment(state, assignment) {
        if (!state || !Array.isArray(state.players)) return;
        if (!Array.isArray(state.scouting.reports)) state.scouting.reports = [];

        // Passende Spieler filtern
        let pool = state.players.filter(p => p.clubId !== state.userClubId && !p.injured);

        // Der Scout fährt nur dorthin, wo der Verein auch Chancen hätte.
        // Sonst kam der Chefscout eines Landesligisten mit drei Berichten über
        // Mailänder Stammspieler zurück.
        const userClub = (state.clubs || []).find(c => c.id === state.userClubId);
        const transferEngine = _seResolve("TransferEngine", "./transferEngine.js");
        if (userClub && transferEngine && typeof transferEngine.isWithinReach === "function") {
            pool = pool.filter(p => transferEngine.isWithinReach(p, userClub, state.clubs));
        }

        // Mit Länderfokus sucht der Scout nur dort - und lernt das Land kennen
        if (assignment.land) {
            const vereine = new Map((state.clubs || []).map(c => [c.id, c]));
            pool = pool.filter(p => this.landVon(state, p, vereine) === assignment.land);
        }
        if (assignment.position && assignment.position !== "ALL") {
            pool = pool.filter(p => p.pos === assignment.position || p.secondPos === assignment.position);
        }
        if (assignment.maxAge) {
            pool = pool.filter(p => p.age <= assignment.maxAge);
        }
        // Die Kriterien prüft der Scout mit seinen eigenen Augen: Ein schwacher
        // Scout bringt auch Spieler mit, die unter der verlangten Stärke
        // liegen, und übersieht manchen, der sie erfüllt.
        const scout = this.scoutInfo(state);
        const schwaeche = Math.max(0, 100 - scout.guete);
        const gesehen = p => (p.overall || 0) + _seZahl(`${p.id}|${scout.name}`, "auftrag") * schwaeche * 0.1;
        if (assignment.minOverall) {
            pool = pool.filter(p => gesehen(p) >= assignment.minOverall);
        }

        // Ein guter Scout bringt die besten Treffer, ein schwacher greift
        // mehr oder weniger zufällig zu. Und er bringt mehr Berichte mit.
        const anzahl = scout.sterne >= 4 ? 4 : (scout.sterne < 2 ? 2 : 3);
        const wertung = p => gesehen(p) * 0.6 + (p.pot || p.overall || 0) * 0.4
            + (Math.random() - 0.5) * schwaeche * 0.4;
        const auswahl = pool
            .map(p => ({ p, w: wertung(p) }))
            .sort((a, b) => b.w - a.w)
            .slice(0, anzahl)
            .map(e => e.p);

        const landVorher = assignment.land ? this.landWissen(state, assignment.land) : null;
        auswahl.forEach(player => {
            this.increaseKnowledge(player, Math.max(4, Math.round(30 * this.reachPenalty(state, player) * this.landFaktor(state, player))), scout.guete * this.bewertungsFaktor(state));
            const report = this.generatePlayerReport(player, state, { source: "auftrag", skipGain: true });
            state.scouting.reports.unshift(report);
        });
        // Das Land kennt der Scout danach besser - ein guter mehr als ein schwacher
        let landText = "";
        if (assignment.land) {
            const regional = this.hatRegionalScout(state, assignment.land) ? 1.5 : 1;
            const nachher = this.erweitereLandWissen(state, assignment.land, Math.round(this.LAND_ZUWACHS_AUFTRAG * scout.guete / 70 * regional));
            if (nachher > landVorher) {
                landText = ` Das Wissen über ${this.landName(assignment.land)} steigt von ${landVorher} auf ${nachher} %.`;
            }
        }

        // Nachricht senden
        const newsEng = (typeof NewsEngine !== 'undefined' && NewsEngine) 
            ? NewsEngine 
            : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : null);

        if (newsEng && typeof newsEng.addMessage === 'function') {
            newsEng.addMessage(state, "scouting", {
                title: "Scouting-Auftrag abgeschlossen",
                sender: scout.eigen ? `${scout.name} (Chefscout)` : "Scouting-Abteilung",
                text: `Die Beobachtung für die Position ${assignment.position}${assignment.land ? ` in ${this.landName(assignment.land)}` : ""} ist abgeschlossen: ${auswahl.length} Spielerberichte liegen vor.`
                    + landText
                    + (auswahl.length === 0 ? " Passende Spieler in Reichweite des Vereins gab es nicht - vielleicht mit anderen Kriterien." : "")
                    + (scout.sterne < 3 ? " Mit diesem Scouting bleiben die Berichte grob - ein besserer Chefscout sähe mehr." : ""),
                priority: "normal"
            });
        }
    },

    /**
     * Gezieltes Scouten eines konkreten Spielers (aus Gegneranalyse, Transfermarkt, Kader, Spielbericht)
     */
    scoutPlayer(state, playerId, options = {}) {
        if (!state || !Array.isArray(state.players)) {
            return { success: false, error: "Ungültiger Spielstand." };
        }

        const player = state.players.find(p => p.id === playerId || String(p.id) === String(playerId));
        if (!player) {
            return { success: false, error: "Spieler nicht gefunden." };
        }

        const source = options.source || "transfer_market";
        // Wie viel ein Bericht bringt, hängt am eigenen Chefscout
        const scoutQuality = options.scoutQuality || this.scoutInfo(state).guete;
        const basis = options.amount || (source === "opponent_analysis" ? 35 : (source === "quick" ? 25 : 40));

        // An einen Profi aus einer deutlich höheren Liga kommt der Scout nur
        // schwer heran - ein Bericht bringt dann weit weniger Klarheit.
        // In einem Land, das der Scout kaum kennt, bringt der erste Bericht
        // weniger - ihm fehlen Kontakte und Vergleichsmaßstab
        const daempfung = this.reachPenalty(state, player) * this.landFaktor(state, player);
        const amount = Math.max(4, Math.round(basis * daempfung));

        this.increaseKnowledge(player, amount, scoutQuality * this.bewertungsFaktor(state));
        const land = this.landVon(state, player);
        if (land) this.erweitereLandWissen(state, land, this.LAND_ZUWACHS_BEOBACHTUNG);
        player.scoutingKnowledge.lastScoutedDate = state.currentDate || "Aktuell";

        // Das Wissen ist oben schon gewachsen - der Bericht zählt nicht doppelt
        const report = this.generatePlayerReport(player, state, { ...options, skipGain: true });

        if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
        if (!Array.isArray(state.scouting.reports)) state.scouting.reports = [];

        // Vorherige Berichte für diesen Spieler aktualisieren oder anheften
        const existingIdx = state.scouting.reports.findIndex(r => String(r.playerId) === String(player.id));
        if (existingIdx !== -1) {
            state.scouting.reports[existingIdx] = report;
        } else {
            state.scouting.reports.unshift(report);
        }

        if (options.notify) {
            const newsEng = (typeof NewsEngine !== 'undefined' && NewsEngine) 
                ? NewsEngine 
                : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : null);
            if (newsEng && typeof newsEng.addMessage === 'function') {
                newsEng.addMessage(state, "scouting", {
                    title: `Scoutbericht: ${player.name}`,
                    sender: report.scout.eigen ? `${report.scout.name} (Chefscout)` : "Scouting-Abteilung",
                    text: `Bericht über ${player.name} (${player.pos}, ${player.age} Jahre): ${report.starsCa} Sterne (${report.abilityLabel}). `
                        + `Empfehlung: ${report.recommendation}. Verlässlichkeit: ${report.zuverlaessigkeit.label}.`,
                    priority: "normal"
                });
            }
        }

        return {
            success: true,
            report,
            player,
            knowledgeLevel: player.scoutingKnowledge.knowledgeLevel
        };
    },

    /** Wie viele Spieler der Scout gleichzeitig beobachten kann */
    MAX_BEOBACHTUNGEN: 5,

    /**
     * Wie lange eine Beobachtung dauert - in Tagen.
     *
     * Vorher kam der Bericht auf Knopfdruck, und das Wissen sprang im selben
     * Augenblick. Im Vorbild fährt der Scout hin: Ein Spieler aus der
     * eigenen Liga ist nach ein paar Tagen gesehen, einer aus dem Ausland
     * braucht Wochen. Außerhalb der eigenen Reichweite (eine deutlich höhere
     * Liga) kommt der Scout schwer heran, ein guter Scout ist schneller, und
     * wer viele Spieler gleichzeitig beobachten lässt, wartet länger.
     */
    beobachtungsDauer(state, player, options = {}) {
        const userClub = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const seinVerein = (state?.clubs || []).find(c => c.id === player?.clubId);
        let tage;
        if (!seinVerein || !userClub) tage = 4;                                 // vereinslos: Probetraining
        else if (seinVerein.leagueId === userClub.leagueId) tage = 4;           // eigene Liga
        else if ((seinVerein.countryId || "de") === (userClub.countryId || "de")) {
            tage = 6 + Math.abs((seinVerein.level || 1) - (userClub.level || 1));
        } else {
            // Ausland: In einem bekannten Land geht es schneller
            tage = 9 + (100 - this.landWissen(state, seinVerein.countryId)) / 12;
        }

        tage *= 1 + (1 - this.reachPenalty(state, player)) * 1.2;
        const scout = this.scoutInfo(state);
        tage *= 1.35 - scout.sterne * 0.1;
        if (options.source === "opponent_analysis") tage *= 0.6;               // den Gegner sieht er ohnehin
        const laufend = (state?.scouting?.beobachtungen || []).length;
        tage *= 1 + laufend * 0.12;
        tage += _seZahl(`${player?.id}|${scout.name}`, "reise");                // mal ein Tag mehr, mal weniger
        return Math.max(2, Math.min(28, Math.round(tage)));
    },

    // --------------------------------------------------- Beobachtungsliste

    /** So viele Spieler passen auf die Beobachtungsliste */
    LISTE_MAX: 60,

    _listenId(x) {
        return String((x && typeof x === "object") ? (x.playerId ?? x.id) : x);
    },

    /** Steht ein Spieler auf der Beobachtungsliste (state.scouting.shortlist)? */
    istGemerkt(state, playerId) {
        return (state?.scouting?.shortlist || []).some(x => this._listenId(x) === String(playerId));
    },

    /**
     * Einen Spieler auf die Beobachtungsliste setzen oder herunternehmen.
     * an: true / false, ohne Angabe umschalten. Eigene Spieler kommen
     * nicht darauf. Gespeichert wird die Spieler-ID wie in state.players,
     * so wie es Saisonwechsel und Datenzentrale schon lesen.
     */
    merke(state, playerId, an = null) {
        if (!state) return { success: false, error: "Ungültiger Spielstand." };
        const player = (state.players || []).find(x => String(x.id) === String(playerId));
        if (!player) return { success: false, error: "Spieler nicht gefunden." };
        const drauf = this.istGemerkt(state, playerId);
        const soll = an === null ? !drauf : !!an;
        if (soll && player.clubId && player.clubId === state.userClubId) {
            return { success: false, error: "Eigene Spieler stehen nicht auf der Beobachtungsliste." };
        }
        if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
        if (!Array.isArray(state.scouting.shortlist)) state.scouting.shortlist = [];
        if (soll && !drauf) {
            if (state.scouting.shortlist.length >= this.LISTE_MAX) {
                return { success: false, error: `Die Beobachtungsliste ist voll (${this.LISTE_MAX} Spieler).` };
            }
            state.scouting.shortlist.push(player.id);
        } else if (!soll && drauf) {
            state.scouting.shortlist = state.scouting.shortlist.filter(x => this._listenId(x) !== String(playerId));
        }
        return { success: true, gemerkt: soll, player };
    },

    /**
     * Die Beobachtungsliste zum Anzeigen: je Spieler Verein, Vertrag, ob ein
     * Bericht vorliegt oder ein Scout unterwegs ist, und was sich getan hat
     * (vereinslos, Vertrag läuft aus, auf der Transferliste, verliehen).
     * Wer inzwischen bei uns spielt, fällt heraus.
     */
    beobachtungsliste(state) {
        const ids = (state?.scouting?.shortlist || []).map(x => this._listenId(x));
        if (!ids.length) return [];
        const spieler = new Map((state.players || []).map(p => [String(p.id), p]));
        const vereine = new Map((state.clubs || []).map(c => [c.id, c]));
        return ids.map(id => spieler.get(id)).filter(p => p && p.clubId !== state.userClubId).map(p => {
            const vertrag = p.contractYears ?? p.contract?.years ?? null;
            const hinweise = [];
            if (!p.clubId) hinweise.push({ text: "vereinslos", art: "gut" });
            else if (vertrag !== null && vertrag <= 1) hinweise.push({ text: "Vertrag läuft aus", art: "gut" });
            if (p.transferListed) hinweise.push({ text: "auf der Transferliste", art: "gut" });
            if (p.leihe) hinweise.push({ text: "verliehen", art: "" });
            if ((p.injuredWeeks || 0) > 0) hinweise.push({ text: `verletzt (${p.injuredWeeks} Wo.)`, art: "schlecht" });
            return {
                player: p,
                verein: vereine.get(p.clubId) || null,
                vertrag,
                bericht: (p.scoutingKnowledge?.reportsCount || 0) > 0,
                beobachtung: this.beobachtungVon(state, p.id),
                hinweise
            };
        });
    },

    /** Die laufende Beobachtung eines Spielers oder null */
    beobachtungVon(state, playerId) {
        return (state?.scouting?.beobachtungen || []).find(b => String(b.playerId) === String(playerId)) || null;
    },

    /**
     * Einen Spieler beobachten lassen. Der Bericht kommt nach einigen Tagen
     * ins Postfach (siehe pruefeBeobachtungen) - erst dann wächst das Wissen.
     */
    beobachteSpieler(state, playerId, options = {}) {
        if (!state || !Array.isArray(state.players)) return { success: false, error: "Ungültiger Spielstand." };
        const player = state.players.find(p => String(p.id) === String(playerId));
        if (!player) return { success: false, error: "Spieler nicht gefunden." };
        if (player.clubId && player.clubId === state.userClubId) {
            return { success: false, error: "Die eigenen Spieler kennt der Trainerstab ohnehin." };
        }
        if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
        if (!Array.isArray(state.scouting.beobachtungen)) state.scouting.beobachtungen = [];

        const laufend = this.beobachtungVon(state, player.id);
        if (laufend) {
            return {
                success: false, beobachtung: laufend,
                error: `${player.name} wird bereits beobachtet - der Bericht kommt in etwa ${laufend.tageRest} Tag(en).`
            };
        }
        if (state.scouting.beobachtungen.length >= this.MAX_BEOBACHTUNGEN) {
            return {
                success: false,
                error: `Der Scout ist ausgelastet: ${state.scouting.beobachtungen.length} Spieler sind in Beobachtung. Warten Sie auf die ersten Berichte.`
            };
        }

        const tage = this.beobachtungsDauer(state, player, options);
        const scout = this.scoutInfo(state);
        const verein = (state.clubs || []).find(c => c.id === player.clubId);
        const beobachtung = {
            id: `beob_${player.id}_${state.currentDate || ""}`,
            playerId: player.id,
            playerName: player.name,
            clubName: verein?.name || "vereinslos",
            source: options.source || "transfer_market",
            tage,
            tageRest: tage,
            start: state.currentDate || null,
            scoutName: scout.name
        };
        state.scouting.beobachtungen.push(beobachtung);
        return { success: true, beobachtung, tage, scout, player };
    },

    /**
     * Ein Tag vergeht: Laufende Beobachtungen rücken vor, fertige liefern
     * ihren ausführlichen Bericht ins Postfach. Gibt die fertigen zurück.
     */
    pruefeBeobachtungen(state) {
        const liste = state?.scouting?.beobachtungen;
        if (!Array.isArray(liste) || liste.length === 0) return [];
        liste.forEach(b => { b.tageRest -= 1; });
        const fertig = liste.filter(b => b.tageRest <= 0);
        state.scouting.beobachtungen = liste.filter(b => b.tageRest > 0);

        const ergebnisse = [];
        fertig.forEach(b => {
            const res = this.scoutPlayer(state, b.playerId, { source: b.source });
            if (!res.success) return;
            const newsEng = _seResolve("NewsEngine", "./newsEngine.js");
            if (newsEng && typeof newsEng.addMessage === "function") {
                newsEng.addMessage(state, "scouting", {
                    title: `Scoutbericht: ${res.player.name}`,
                    sender: res.report.scout.eigen ? `${res.report.scout.name} (Chefscout)` : "Scouting-Abteilung",
                    text: this.berichtText(res.report, res.player, state, b),
                    priority: "normal",
                    relatedEntity: { type: "player", id: res.player.id }
                });
            }
            ergebnisse.push({ beobachtung: b, report: res.report, player: res.player, knowledgeLevel: res.knowledgeLevel });
        });
        return ergebnisse;
    },

    /** Der Bericht in Worten, wie ihn der Scout ins Postfach schreibt */
    berichtText(report, player, state, beobachtung = null) {
        const verein = (state?.clubs || []).find(c => c.id === player.clubId);
        const sterne = (x) => String(x).replace(".", ",");
        const zeilen = [
            `${player.name} · ${player.pos} · ${player.age} Jahre · ${verein ? verein.name : "vereinslos"}`
                + (beobachtung ? ` · ${beobachtung.tage} Tage beobachtet` : ""),
            "",
            `Stärke heute: ${sterne(report.starsCaMin)}${report.starsCaMax !== report.starsCaMin ? ` bis ${sterne(report.starsCaMax)}` : ""} Sterne · Potenzial bis ${sterne(report.starsPaMax)} Sterne`,
            `${report.abilityLabel} · ${report.potentialLabel}`
        ];
        if (report.bestRole?.role) zeilen.push(`Beste Rolle: ${report.bestRole.role}${report.alternativeRole?.role ? ` (auch ${report.alternativeRole.role})` : ""}`);
        if (report.kaderRolle) zeilen.push(`${report.kaderRolle.text}.`);
        zeilen.push("", "Stärken:", ...report.strengths.map(s => `• ${s}`));
        zeilen.push("", "Schwächen:", ...report.weaknesses.map(s => `• ${s}`));
        if (report.hiddenTraits?.length) zeilen.push("", "Charakter:", ...report.hiddenTraits.map(s => `• ${String(s).replace(/<[^>]+>/g, "")}`));
        zeilen.push("", `Marktwert: ${report.marketValueFormatted}`,
            `Empfehlung: ${report.recommendation}`,
            `Verlässlichkeit: ${report.zuverlaessigkeit.label} (Wissen ${player.scoutingKnowledge?.knowledgeLevel || 0} %)`);
        if (report.summary) zeilen.push("", report.summary);
        return zeilen.join("\n");
    },

    /** Ein Trainer mit gutem Auge holt aus jedem Bericht mehr heraus */
    bewertungsFaktor(state) {
        const profil = (typeof TrainerProfilEngine !== "undefined" && TrainerProfilEngine)
            ? TrainerProfilEngine
            : (typeof require !== "undefined" ? (() => { try { return require("./trainerProfilEngine.js").TrainerProfilEngine; } catch (e) { return null; } })() : null);
        return profil && state ? profil.faktor(state, "bewertung", 0.2) : 1;
    },

    /**
     * Erhöht das Scouting-Wissen über einen Spieler
     */
    increaseKnowledge(player, amount = 25, scoutQuality = 70) {
        if (!player.scoutingKnowledge) {
            player.scoutingKnowledge = { known: false, knowledgeLevel: 25, accuracy: 25, reportsCount: 0 };
        }
        const effectiveGain = Math.round(amount * (scoutQuality / 70));
        player.scoutingKnowledge.reportsCount = (player.scoutingKnowledge.reportsCount || 0) + 1;
        player.scoutingKnowledge.knowledgeLevel = Math.min(95, (player.scoutingKnowledge.knowledgeLevel || 25) + effectiveGain);
        player.scoutingKnowledge.accuracy = player.scoutingKnowledge.knowledgeLevel;
        return player.scoutingKnowledge;
    },

    /**
     * Ermittelt den aktuellen Wissensstand zu einem Spieler
     */
    getScoutingKnowledge(player, userClubId = null) {
        if (!player) return { known: false, knowledgeLevel: 0, accuracy: 0 };
        const isUserPlayer = player.clubId && userClubId && player.clubId === userClubId;
        if (isUserPlayer) {
            return { known: true, knowledgeLevel: 95, accuracy: 95, reportsCount: 10 };
        }
        return player.scoutingKnowledge || { known: false, knowledgeLevel: 25, accuracy: 25, reportsCount: 0 };
    },

    /**
     * Wer schreibt den Bericht? Der eigene Chefscout - oder, solange der
     * Posten offen ist, eine Aushilfe mit entsprechend schwächerem Blick.
     * Die Güte kommt aus dem Trainerstab, die Sterne sind dieselbe Sprache
     * wie bei den Spielern.
     */
    scoutInfo(state) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const stab = _seResolve("CoachingStaffEngine", "./coachingStaffEngine.js");
        const guete = (stab && club) ? stab.staffQuality(club).scout : 60;
        const mitglied = club?.staff?.scout;
        return {
            name: mitglied?.name || "Aushilfsscout",
            guete: typeof guete === "number" ? guete : 60,
            sterne: _seSterne(guete),
            eigen: !!mitglied
        };
    },

    /**
     * Um wie viel verschätzt sich ein Scout bei einem Spieler (in CA-Punkten)?
     *
     * Fest je Scout und Spieler: Derselbe Scout sieht denselben Spieler immer
     * gleich falsch, ein anderer sieht ihn anders. Bei jungen Spielern liegt
     * das Potenzial weiter daneben. Mehr Beobachtung dämpft den Fehler etwas,
     * beseitigt ihn aber nicht - dafür braucht es einen besseren Scout.
     */
    urteilsFehler(player, scout) {
        const schwaeche = Math.max(0, 100 - (scout?.guete ?? 60));
        const wissen = player?.scoutingKnowledge?.knowledgeLevel || 25;
        const daempfung = 1 - 0.35 * Math.max(0, Math.min(1, (wissen - 25) / 70));
        const jung = (player?.age || 25) <= 21 ? 1.3 : 1;
        const schluessel = `${player?.id}|${scout?.name || "scout"}`;
        return {
            ca: Math.round(_seZahl(schluessel, "urteil-ca") * schwaeche * 0.2 * daempfung),
            pa: Math.round(_seZahl(schluessel, "urteil-pa") * schwaeche * 0.3 * jung * daempfung)
        };
    },

    /** Was der Scout über die einzelnen Fähigkeiten sagen kann */
    ATTRIBUT_TEXTE: {
        pace: ["Hohes Grundtempo und starker Antritt", "Fehlt es an Antrittsschnelligkeit"],
        shooting: ["Abschlussstark im Strafraum", "Harmlos im Abschluss"],
        passing: ["Präzises Passspiel im Aufbau", "Ungenau im Passspiel"],
        dribbling: ["Stark im Eins-gegen-eins am Ball", "Verliert im Dribbling oft den Ball"],
        defense: ["Zweikampfstark mit gutem Stellungsspiel", "Anfällig in der Rückwärtsbewegung"],
        physical: ["Robust, kaum vom Ball zu trennen", "Körperlich oft unterlegen"],
        stamina: ["Läuft 90 Minuten durch", "Baut konditionell früh ab"],
        vision: ["Sieht Pässe, die andere nicht sehen", "Wenig Übersicht unter Druck"],
        technique: ["Saubere Ballannahme und Technik", "Technisch ungeschliffen"],
        reflexes: ["Starke Reflexe auf der Linie", "Reagiert auf der Linie zu spät"],
        handling: ["Sichere Hände, kaum Abpraller", "Lässt Bälle abprallen"],
        oneOnOne: ["Stark im direkten Duell mit dem Stürmer", "Unsicher im direkten Duell"],
        positioning: ["Gutes Stellungsspiel im Tor", "Steht im Tor oft falsch"],
        kicking: ["Starker Abstoß, leitet Angriffe ein", "Schwaches Spiel mit dem Fuß"],
        decisions: ["Trifft fast immer die richtige Entscheidung", "Wählt oft die falsche Option"],
        anticipation: ["Ahnt Pässe und Laufwege voraus", "Reagiert oft einen Schritt zu spät"],
        composure: ["Eiskalt, wenn es darauf ankommt", "Wird in engen Momenten nervös"],
        concentration: ["Neunzig Minuten hellwach", "Leistet sich Konzentrationsfehler"],
        workRate: ["Arbeitet unermüdlich gegen den Ball", "Arbeitet zu wenig nach hinten"],
        teamwork: ["Spielt immer für die Mannschaft", "Sucht oft die eigene Lösung statt den Mitspieler"],
        leadership: ["Geht voran und reißt andere mit", "Taucht ab, wenn die Mannschaft Halt braucht"],
        offTheBall: ["Bietet sich ständig an und findet die Lücke", "Ohne Ball kaum anspielbar"]
    },

    /** Welche Schwächen für eine Position überhaupt ins Gewicht fallen */
    RELEVANT: {
        TW: ["reflexes", "handling", "oneOnOne", "positioning", "kicking", "concentration"],
        ABW: ["defense", "physical", "pace", "passing", "stamina", "anticipation", "concentration"],
        MF: ["passing", "vision", "technique", "stamina", "dribbling", "defense", "decisions", "workRate", "teamwork"],
        ST: ["shooting", "pace", "dribbling", "technique", "physical", "composure", "offTheBall"]
    },

    positionsGruppe(pos) {
        if (pos === "TW") return "TW";
        if (["IV", "LV", "RV"].includes(pos)) return "ABW";
        if (["ST", "LA", "RA"].includes(pos)) return "ST";
        return "MF";
    },

    /**
     * Stärken und Schwächen, wie der Scout sie sieht. Jeder Wert wird durch
     * seine Brille betrachtet - ein schwacher Scout lobt auch mal das
     * Falsche. Wie viele Punkte er nennt, hängt an seinen Sternen.
     */
    staerkenUndSchwaechen(player, scout) {
        const gruppe = this.positionsGruppe(player.pos);
        const kandidaten = gruppe === "TW"
            ? this.RELEVANT.TW.concat(["decisions", "composure", "leadership"])
            : ["pace", "shooting", "passing", "dribbling", "defense", "physical", "stamina", "vision", "technique",
                "decisions", "anticipation", "composure", "concentration", "workRate", "teamwork", "leadership", "offTheBall"];
        const schwaeche = Math.max(0, 100 - scout.guete);
        const schluessel = `${player.id}|${scout.name}`;
        const gesehen = kandidaten
            .filter(a => typeof player[a] === "number")
            .map(a => ({ a, w: player[a] + _seZahl(schluessel, a) * schwaeche * 0.12 }));
        if (gesehen.length === 0) return { strengths: ["Solide Grundausbildung"], weaknesses: ["Noch zu wenig gesehen"] };

        const schnitt = gesehen.reduce((s, e) => s + e.w, 0) / gesehen.length;
        const s = scout.sterne;
        const anzahlStark = s >= 4 ? 4 : s >= 3 ? 3 : s >= 2 ? 2 : 1;
        const anzahlSchwach = s >= 4 ? 3 : s >= 3 ? 2 : 1;

        const strengths = [...gesehen]
            .sort((a, b) => b.w - a.w)
            .filter(e => e.w >= schnitt + 3)
            .slice(0, anzahlStark)
            .map(e => this.ATTRIBUT_TEXTE[e.a][0]);
        const relevant = this.RELEVANT[gruppe];
        const weaknesses = [...gesehen]
            .filter(e => relevant.includes(e.a))
            .sort((a, b) => a.w - b.w)
            .filter(e => e.w <= schnitt - 4)
            .slice(0, anzahlSchwach)
            .map(e => this.ATTRIBUT_TEXTE[e.a][1]);

        if (strengths.length === 0) strengths.push("Ausgeglichenes Profil ohne herausragende Stärke");
        if (weaknesses.length === 0) weaknesses.push("Keine auffällige Schwäche erkannt");
        return { strengths, weaknesses };
    },

    /**
     * Wo stünde der Spieler in unserem Kader? Verglichen wird die geschätzte
     * Stärke mit den eigenen Spielern derselben Mannschaftsteils - die kennt
     * der Verein genau.
     */
    kaderRolle(state, player, geschaetzteCa) {
        if (!state || !Array.isArray(state.players)) return null;
        const gruppe = this.positionsGruppe(player.pos);
        const eigene = state.players
            .filter(p => p.clubId === state.userClubId && p.id !== player.id && this.positionsGruppe(p.pos) === gruppe)
            .map(p => p.trueCurrentAbility || (p.overall || 60) * 2);
        const plaetze = { TW: 1, ABW: 4, MF: 4, ST: 2 }[gruppe];
        const rang = eigene.filter(ca => ca > geschaetzteCa).length;
        const teil = { TW: "Torwart", ABW: "Verteidiger", MF: "Mittelfeldspieler", ST: "Angreifer" }[gruppe];
        if (rang === 0) return { key: "bester", text: `Wäre sofort unser bester ${teil}` };
        if (rang < plaetze) return { key: "stamm", text: "Wäre bei uns Stammspieler" };
        if (rang < plaetze * 2) return { key: "rotation", text: "Wäre bei uns Rotationsspieler" };
        return { key: "ergaenzung", text: "Wäre bei uns nur Ergänzung" };
    },

    /** Wie sehr man sich auf den Bericht verlassen kann */
    zuverlaessigkeit(scoutGuete, konfidenz) {
        const wert = 0.55 * scoutGuete + 0.45 * konfidenz;
        if (wert >= 72) return { key: "hoch", label: "Sehr verlässlich", farbe: "#22c55e" };
        if (wert >= 58) return { key: "gut", label: "Verlässlich", farbe: "#4ade80" };
        if (wert >= 44) return { key: "mittel", label: "Mit Vorsicht", farbe: "#facc15" };
        return { key: "gering", label: "Unsicher", farbe: "#ef4444" };
    },

    /** Potenzial in Worten - aus der Schätzung, nicht aus den wahren Werten */
    potenzialText(caMitte, paMitte, alter, scout) {
        if (scout.sterne < 2 && alter <= 23) return "Potenzial kaum einzuschätzen";
        const diff = paMitte - caMitte;
        if (paMitte >= 165 && diff >= 20 && alter <= 23) return "Top-Talent";
        if (diff >= 20 && alter <= 24) return "Großes Entwicklungspotenzial";
        if (diff >= 10 && alter <= 26) return "Kann sich noch deutlich steigern";
        if (diff >= 5) return "Etwas Luft nach oben";
        return "Am Leistungslimit";
    },

    /**
     * Erstellt einen Spielerbericht.
     *
     * Was drinsteht, hängt am Scout: Seine Güte verschiebt die geschätzte
     * Stärke und das Potenzial (ein schwacher Scout liegt auch mal eine
     * Sternhälfte daneben), bestimmt, wie viele Stärken und Schwächen er
     * benennt, ob er etwas zum Charakter sagen kann und ob er den Spieler
     * in unseren Kader einordnet. Die Empfehlung folgt seiner Schätzung,
     * nicht den wahren Werten.
     */
    generatePlayerReport(player, state = null, options = {}) {
        if (!player.scoutingKnowledge) {
            player.scoutingKnowledge = { known: false, knowledgeLevel: 25, accuracy: 25, reportsCount: 0 };
        }
        if (!options.skipGain) {
            player.scoutingKnowledge.reportsCount = (player.scoutingKnowledge.reportsCount || 0) + 1;
            player.scoutingKnowledge.knowledgeLevel = Math.min(95, (player.scoutingKnowledge.knowledgeLevel || 25) + (options.amount || 25));
            player.scoutingKnowledge.accuracy = player.scoutingKnowledge.knowledgeLevel;
        }
        player.scoutingKnowledge.lastScoutedDate = state ? state.currentDate : "Aktuell";

        const scout = options.scout || this.scoutInfo(state);
        if (options.scoutName) scout.name = options.scoutName;

        const ratingEngine = _seResolve("PlayerRatingEngine", "./playerRatingEngine.js");

        // Die Sterne messen sich am eingestellten Maßstab (Standard: eigener Kader)
        const eigene = state && Array.isArray(state.players)
            ? state.players.filter(p => p.clubId === state.userClubId)
            : [];
        const kaderSchnitt = ratingEngine && typeof ratingEngine.sternBezug === "function" && state
            ? ratingEngine.sternBezug(state)
            : (eigene.length
                ? Math.round(eigene.reduce((s, p) => s + (p.trueCurrentAbility || (p.overall || 60) * 2), 0) / eigene.length)
                : 140);

        let card = null;
        if (ratingEngine && typeof ratingEngine.calculateVisiblePlayerCard === "function") {
            card = ratingEngine.calculateVisiblePlayerCard(player, {
                state,
                userClubId: state ? state.userClubId : null,
                userSquadAvgAbility: kaderSchnitt,
                leagueDataCoverage: 85,
                urteil: this.urteilsFehler(player, scout)
            });
        }

        const konfidenz = card ? card.confidence : player.scoutingKnowledge.knowledgeLevel;
        const caMitte = card ? Math.round((card.estimatedCa.min + card.estimatedCa.max) / 2) : (player.overall || 60) * 2;
        const paMitte = card ? Math.round((card.estimatedPa.min + card.estimatedPa.max) / 2) : (player.pot || 70) * 2;
        const starsCa = card ? card.starsCa : 3.0;
        const starsPa = card ? card.starsPa : 3.5;
        const alter = player.age || 25;

        // Empfehlung aus der Schätzung des Scouts
        let recommendation;
        if (konfidenz < 30 && scout.sterne < 2.5) recommendation = "Weiter beobachten";
        else if (starsCa >= 3.5) recommendation = "Top-Kaufempfehlung";
        else if (starsPa >= 4 && alter <= 23) recommendation = "Talent mit Perspektive";
        else if (starsCa >= 3) recommendation = "Guter Transferkandidat";
        else if (starsPa >= 3 && alter <= 21) recommendation = "Beobachten";
        else recommendation = "Keine Verpflichtung empfohlen";

        const { strengths, weaknesses } = this.staerkenUndSchwaechen(player, scout);

        // Zum Charakter kann nur ein guter Scout etwas sagen
        const alleEigenheiten = card ? card.hiddenTraits : [];
        const maxEigenheiten = scout.sterne >= 4.5 ? alleEigenheiten.length
            : scout.sterne >= 3.5 ? 4
            : scout.sterne >= 2.5 ? 2 : 0;
        const hiddenTraits = alleEigenheiten.slice(0, maxEigenheiten);

        const kaderRolle = scout.sterne >= 2 ? this.kaderRolle(state, player, caMitte) : null;
        const zuverlaessigkeit = this.zuverlaessigkeit(scout.guete, konfidenz);
        const potentialLabel = this.potenzialText(caMitte, paMitte, alter, scout);
        const abilityLabel = card ? card.abilityLabel : "Ligaspieler";

        // Das Fazit klingt je nach Scout ausführlich oder knapp
        const fazitTeile = [];
        if (scout.sterne >= 3) {
            fazitTeile.push(`${abilityLabel.replace(/^ca\. /, "")}. ${potentialLabel}.`);
            if (card?.potentialKlasse) fazitTeile.push(`${card.potentialKlasse}.`);
            if (kaderRolle) fazitTeile.push(`${kaderRolle.text}.`);
            if (card?.bestRole?.role) fazitTeile.push(`Am besten als ${card.bestRole.role}.`);
        } else if (scout.sterne >= 2) {
            fazitTeile.push(`Erster Eindruck: ${abilityLabel.replace(/^ca\. /, "")}.`);
            if (kaderRolle) fazitTeile.push(`${kaderRolle.text}.`);
        } else {
            fazitTeile.push("Ein erster Eindruck, mehr lässt sich nicht sagen.");
        }

        return {
            id: "rep_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            playerId: player.id,
            playerName: player.name,
            clubId: player.clubId,
            position: player.pos,
            age: player.age,
            scoutName: scout.name,
            scout: { name: scout.name, guete: scout.guete, sterne: scout.sterne, eigen: !!scout.eigen },
            source: options.source || "allgemein",
            confidence: konfidenz,
            zuverlaessigkeit,
            estimatedOverall: card ? card.visibleOvr : `${Math.max(1, (player.overall || 60) - 4)} - ${Math.min(99, (player.overall || 60) + 4)}`,
            estimatedPotential: card ? card.visiblePot : `${Math.max(1, (player.pot || 70) - 5)} - ${Math.min(99, (player.pot || 70) + 5)}`,
            starsCa,
            starsPa,
            starsCaMin: card ? card.starsCaMin : starsCa,
            starsCaMax: card ? card.starsCaMax : starsCa,
            starsPaMax: card ? card.starsPaMax : starsPa,
            starsCaHtml: card ? card.starsCaHtml : "★★★☆☆",
            starsPaHtml: card ? card.starsPaHtml : "★★★★☆",
            abilityStarsHtml: card ? card.abilityStarsHtml : "",
            bestRole: card ? card.bestRole : { role: "Allrounder", stars: 3.0, starsHtml: "★★★☆☆" },
            alternativeRole: scout.sterne >= 3 && card ? card.alternativeRole : null,
            abilityLabel,
            potentialLabel,
            strengths,
            weaknesses,
            hiddenTraits,
            kaderRolle,
            marketValueFormatted: card ? card.visibleValueText : ((typeof Formatters !== 'undefined') ? Formatters.formatMoney(player.value, true) : `${player.value} €`),
            recommendation,
            summary: fazitTeile.join(" "),
            date: state ? state.currentDate : `Saison ${player.season || 1}`
        };
    }
};

if (typeof window !== "undefined") {
    window.ScoutingEngine = ScoutingEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScoutingEngine };
}
