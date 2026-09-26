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
     * Startet einen neuen Scouting-Auftrag
     */
    startAssignment(state, criteria = {}) {
        if (!state) return { success: false, error: "Kein State vorhanden." };
        if (!state.scouting) state.scouting = { assignments: [], reports: [], shortlist: [] };
        if (!Array.isArray(state.scouting.assignments)) state.scouting.assignments = [];

        if (state.scouting.assignments.filter(a => a.status === "active").length >= 3) {
            return { success: false, error: "Maximale Anzahl gleichzeitiger Scout-Aufträge (3) erreicht." };
        }

        const assignment = {
            id: "scout_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            position: criteria.position || "ALL",
            maxAge: criteria.maxAge || 26,
            minOverall: criteria.minOverall || 70,
            matchdaysRemaining: 2,
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
        if (!state || !state.scouting || !Array.isArray(state.scouting.assignments)) return;

        state.scouting.assignments.forEach(assignment => {
            if (assignment.status !== "active") return;

            assignment.matchdaysRemaining -= 1;

            if (assignment.matchdaysRemaining <= 0) {
                assignment.status = "completed";
                this.completeAssignment(state, assignment);
            }
        });
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

        auswahl.forEach(player => {
            this.increaseKnowledge(player, Math.max(4, Math.round(30 * this.reachPenalty(state, player))), scout.guete);
            const report = this.generatePlayerReport(player, state, { source: "auftrag", skipGain: true });
            state.scouting.reports.unshift(report);
        });

        // Nachricht senden
        const newsEng = (typeof NewsEngine !== 'undefined' && NewsEngine) 
            ? NewsEngine 
            : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : null);

        if (newsEng && typeof newsEng.addMessage === 'function') {
            newsEng.addMessage(state, "scouting", {
                title: "Scouting-Auftrag abgeschlossen",
                sender: scout.eigen ? `${scout.name} (Chefscout)` : "Scouting-Abteilung",
                text: `Die Beobachtung für die Position ${assignment.position} ist abgeschlossen: ${auswahl.length} Spielerberichte liegen vor.`
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
        const daempfung = this.reachPenalty(state, player);
        const amount = Math.max(4, Math.round(basis * daempfung));

        this.increaseKnowledge(player, amount, scoutQuality);
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
        kicking: ["Starker Abstoß, leitet Angriffe ein", "Schwaches Spiel mit dem Fuß"]
    },

    /** Welche Schwächen für eine Position überhaupt ins Gewicht fallen */
    RELEVANT: {
        TW: ["reflexes", "handling", "oneOnOne", "positioning", "kicking"],
        ABW: ["defense", "physical", "pace", "passing", "stamina"],
        MF: ["passing", "vision", "technique", "stamina", "dribbling", "defense"],
        ST: ["shooting", "pace", "dribbling", "technique", "physical"]
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
            ? this.RELEVANT.TW
            : ["pace", "shooting", "passing", "dribbling", "defense", "physical", "stamina", "vision", "technique"];
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

        // Die Sterne messen sich am eigenen Kader
        const eigene = state && Array.isArray(state.players)
            ? state.players.filter(p => p.clubId === state.userClubId)
            : [];
        const kaderSchnitt = eigene.length
            ? Math.round(eigene.reduce((s, p) => s + (p.trueCurrentAbility || (p.overall || 60) * 2), 0) / eigene.length)
            : 140;

        let card = null;
        if (ratingEngine && typeof ratingEngine.calculateVisiblePlayerCard === "function") {
            card = ratingEngine.calculateVisiblePlayerCard(player, {
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
            if (kaderRolle) fazitTeile.push(`${kaderRolle.text}.`);
            if (card?.bestRole?.role) fazitTeile.push(`Am besten als ${card.bestRole.role}.`);
        } else if (scout.sterne >= 2) {
            fazitTeile.push(`Macht den Eindruck eines ${abilityLabel.replace(/^ca\. /, "")}.`);
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
