/**
 * BoardEngine - Vorstandszufriedenheit, Zielverfolgung und Management-Bewertung
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _boardResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));

    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const BoardEngine = {
    /**
     * Das Saisonziel des Vorstands - gemessen an dem, was der Verein hat.
     *
     * Vorher stand das Ziel einmal fest: abgeleitet aus einer Vereinsstärke
     * beim Erzeugen der Welt, und geändert nur pauschal bei Auf- oder Abstieg
     * ("Klassenerhalt" nach jedem Aufstieg, "Aufstieg" nach jedem Abstieg).
     * Wer den Kader verstärkte oder verkaufte, bekam dasselbe Ziel. Jetzt
     * schaut der Vorstand vor jeder Saison auf drei Dinge, jeweils als Rang
     * in der eigenen Liga: die Stärke des Kaders (60 %), den Etat aus
     * Gehalts- und Transferbudget (20 %) und das Ansehen des Vereins (20 %).
     * Daraus ergibt sich, wo der Verein hingehört; einen Platz Spielraum gibt
     * der Vorstand dazu. Schlechter als den ersten Nichtabstiegsplatz
     * verlangt er nie. Wer klar vorn liegt, soll Meister werden oder
     * aufsteigen.
     *
     * Mitten in der Saison (lage = aktueller Platz) trifft sich der Vorstand
     * in der Mitte zwischen dem, was der Kader hergibt, und der Tabelle.
     */
    ZIEL_GEWICHTE: { kader: 0.6, etat: 0.2, ruf: 0.2, spielraum: 1 },

    /** Die Liga eines Vereins - beim Spielstart steht sie noch nicht im Spielstand */
    ligaVon(state, club) {
        const ausState = (state?.leagues || []).find(l => l.id === club?.leagueId);
        if (ausState) return ausState;
        const wg = _boardResolve('WorldGenerator', './worldGenerator.js');
        const alle = wg && typeof wg.getLeagues === 'function' ? wg.getLeagues() : [];
        return (alle || []).find(l => l.id === club?.leagueId) || null;
    },

    bestimmeZiel(state, club, lage = null) {
        if (!state || !club) return null;
        const liga = this.ligaVon(state, club);
        const vereine = (state.clubs || []).filter(c => c.leagueId === club.leagueId);
        const n = vereine.length || liga?.teamCount || 18;
        const ce = _boardResolve('ContractEngine', './contractEngine.js');
        const spielerNach = new Map((state.players || []).map(p => [p.id, p]));
        const rang = (wert) => vereine
            .map(c => ({ id: c.id, v: wert(c) }))
            .sort((a, b) => b.v - a.v)
            .findIndex(x => x.id === club.id) + 1;

        const raenge = {
            kader: rang(c => (ce && typeof ce.vereinsNiveau === 'function' ? ce.vereinsNiveau(c, spielerNach) : null) ?? 0),
            etat: rang(c => (c.wageBudget || 0) * 52 + (c.transferBudget || 0)),
            ruf: rang(c => c.reputation || 0)
        };
        const G = this.ZIEL_GEWICHTE;
        const erwartet = raenge.kader * G.kader + raenge.etat * G.etat + raenge.ruf * G.ruf;

        let platz = erwartet < 1.5 ? 1 : Math.round(erwartet) + G.spielraum;
        if (typeof lage === 'number' && lage > platz) platz = Math.round((platz + lage) / 2);
        const { rettung } = this.grenzen(state, club);
        platz = Math.max(1, Math.min(platz, rettung, n));
        const art = this.artFuer(state, club, platz);

        club.boardExpectation = art;
        club.vorstandsziel = {
            platz, art, n, leagueId: club.leagueId, saison: state.seasonYear || 1, raenge, erwartet: Math.round(erwartet * 10) / 10,
            prognose: this.medienprognose(state, club)
        };
        return club.vorstandsziel;
    },

    /** Ligagröße, letzter Nichtabstiegsplatz und Aufstiegsplätze */
    grenzen(state, club) {
        const liga = this.ligaVon(state, club);
        const n = (state.clubs || []).filter(c => c.leagueId === club.leagueId).length || liga?.teamCount || 18;
        const abstieg = Array.isArray(liga?.relegationSpots) ? liga.relegationSpots : [];
        const rettung = abstieg.length ? Math.min(...abstieg) - 1 : n;
        const aufstieg = (liga?.level || 1) > 1 && Array.isArray(liga?.promotionSpots) ? liga.promotionSpots.length : 0;
        return { n, rettung, aufstieg };
    },

    /** Welche Art Ziel ein Platz ist: Meisterschaft, Aufstieg, Top 3 ... */
    artFuer(state, club, platz) {
        const { n, rettung, aufstieg } = this.grenzen(state, club);
        if (platz === 1 && !aufstieg) return "championship";
        if (aufstieg && platz <= aufstieg) return "promotion";
        if (platz <= 3) return "top3";
        if (platz <= 6) return "top6";
        if (platz <= Math.ceil(n / 2)) return "midfield";
        if (platz < rettung) return "lower_mid";
        return "avoid_relegation";
    },

    /**
     * Wo die Medien den Verein sehen: die Liga nach Kaderstärke (drei
     * Viertel) und Ansehen (ein Viertel), ohne Etat und ohne Spielraum.
     * Sie liegt oft neben dem Ziel des Vorstands - mal darüber, mal darunter.
     */
    medienprognose(state, club) {
        const vereine = (state?.clubs || []).filter(c => c.leagueId === club?.leagueId);
        if (!vereine.length) return null;
        const ce = _boardResolve('ContractEngine', './contractEngine.js');
        const spielerNach = new Map((state.players || []).map(p => [p.id, p]));
        const rangVon = (wert) => {
            const reihe = vereine.map(c => ({ id: c.id, v: wert(c) })).sort((a, b) => b.v - a.v);
            return new Map(reihe.map((x, i) => [x.id, i + 1]));
        };
        const kader = rangVon(c => (ce && typeof ce.vereinsNiveau === 'function' ? ce.vereinsNiveau(c, spielerNach) : null) ?? 0);
        const ruf = rangVon(c => c.reputation || 0);
        const tabelle = vereine
            .map(c => ({ id: c.id, w: kader.get(c.id) * 0.75 + ruf.get(c.id) * 0.25 + (kader.get(c.id) / 1000) }))
            .sort((a, b) => a.w - b.w);
        return tabelle.findIndex(x => x.id === club.id) + 1;
    },

    /**
     * Über das Saisonziel lässt der Vorstand einmal je Vorbereitung mit sich
     * reden: annehmen, zwei Plätze tiefer gegen weniger Transferbudget oder
     * zwei Plätze höher gegen mehr. Vorher stand das Ziel einfach fest.
     */
    ZIEL_VERHANDLUNG: { plaetze: 2, budget: 0.2, vertrauen: 3 },

    /** Lässt sich gerade über das Ziel reden? null, wenn ja - sonst der Grund */
    zielHindernis(state, club) {
        if (!club?.vorstandsziel) return "Es gibt noch kein Saisonziel.";
        if (!state?.preseason?.aktiv) return "Über das Saisonziel spricht der Vorstand nur in der Vorbereitung.";
        if (club.vorstandsziel.verhandelt) return "Das Saisonziel ist für diese Saison besprochen.";
        return null;
    },

    /**
     * richtung: "annehmen", "senken" oder "erhoehen". Gibt { ok, platz,
     * budget } zurück oder { ok: false, grund }.
     */
    verhandleZiel(state, richtung) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const grund = this.zielHindernis(state, club);
        if (grund) return { ok: false, grund };
        const z = club.vorstandsziel;
        const V = this.ZIEL_VERHANDLUNG;
        if (richtung === "annehmen") {
            z.verhandelt = "angenommen";
            return { ok: true, platz: z.platz, budget: 0 };
        }
        const { rettung } = this.grenzen(state, club);
        const neu = richtung === "senken" ? Math.min(rettung, z.platz + V.plaetze) : Math.max(1, z.platz - V.plaetze);
        if (neu === z.platz) {
            return { ok: false, grund: richtung === "senken" ? "Weniger als den Klassenerhalt verlangt der Vorstand ohnehin nicht." : "Mehr als Platz 1 geht nicht." };
        }
        const budget = Math.max(0, club.transferBudget || 0);
        const betrag = Math.round(budget * V.budget);
        if (richtung === "senken") {
            club.transferBudget = budget - betrag;
            club.confidence = Math.max(10, (club.confidence ?? 75) - V.vertrauen);
        } else {
            club.transferBudget = budget + betrag;
            club.confidence = Math.min(100, (club.confidence ?? 75) + V.vertrauen);
        }
        const vorher = z.platz;
        z.platz = neu;
        z.art = this.artFuer(state, club, neu);
        z.verhandelt = richtung;
        z.vorher = vorher;
        z.budgetAenderung = richtung === "senken" ? -betrag : betrag;
        club.boardExpectation = z.art;

        const news = _boardResolve('NewsEngine', './newsEngine.js');
        const gs = _boardResolve('GameState', './gameState.js');
        const geld = (b) => gs && typeof gs.formatMoney === 'function' ? gs.formatMoney(b) : `${b} €`;
        if (news && typeof news.createBoardMessage === 'function') {
            news.createBoardMessage(state, {
                title: richtung === "senken" ? `Saisonziel gesenkt: Platz ${neu}` : `Saisonziel erhöht: Platz ${neu}`,
                text: richtung === "senken"
                    ? `Der Vorstand geht mit: Platz ${neu} oder besser statt Platz ${vorher}. Dafür kürzen wir das Transferbudget um ${geld(betrag)}. Begeistert sind wir nicht.`
                    : `Der Vorstand nimmt Sie beim Wort: Platz ${neu} oder besser statt Platz ${vorher}. Dafür gibt es ${geld(betrag)} mehr Transferbudget.`,
                priority: "normal"
            });
        }
        return { ok: true, platz: neu, budget: z.budgetAenderung };
    },

    /** Der Platz, den der Vorstand erwartet - auch für ältere Spielstände */
    zielPlatz(state, club) {
        const z = club?.vorstandsziel;
        if (z && typeof z.platz === 'number' && z.leagueId === club.leagueId) return z.platz;
        const liga = this.ligaVon(state, club);
        const n = (state?.standings || []).length || liga?.teamCount || 18;
        const abstieg = Array.isArray(liga?.relegationSpots) && liga.relegationSpots.length ? Math.min(...liga.relegationSpots) - 1 : n - 3;
        switch (club?.boardExpectation) {
            case "championship": return 1;
            case "promotion": return Math.max(1, (liga?.promotionSpots || [1]).length);
            case "top3": return 3;
            case "top6": return 6;
            case "midfield": return Math.ceil(n / 2);
            case "lower_mid": return Math.max(Math.ceil(n / 2) + 1, abstieg - 2);
            case "avoid_relegation": return abstieg;
            default: return Math.ceil(n / 2);
        }
    },

    /** "Platz 5 oder besser - Platz unter den ersten sechs" */
    zielText(state, club) {
        const gs = _boardResolve('GameState', './gameState.js');
        const art = club?.boardExpectation;
        const text = gs && typeof gs.getExpectationText === 'function' ? gs.getExpectationText(art) : String(art || "");
        const platz = this.zielPlatz(state, club);
        return platz === 1 ? text : `${text} (Platz ${platz} oder besser)`;
    },

    /** Warum der Vorstand das verlangt - für die Post zum Saisonstart */
    zielBegruendung(club) {
        const z = club?.vorstandsziel;
        if (!z || !z.raenge) return "";
        const stelle = r => r === 1 ? "der stärkste" : `der ${r}.-stärkste`;
        return `Unser Kader ist ${stelle(z.raenge.kader).replace("stärkste", "stärkste der Liga")}, `
            + `beim Etat liegen wir auf Rang ${z.raenge.etat}, beim Ansehen auf Rang ${z.raenge.ruf} von ${z.n}.`
            + (typeof z.prognose === "number" ? ` Die Medien sehen uns auf Platz ${z.prognose}.` : "");
    },

    // ------------------------------------------------ Anfragen an den Vorstand

    /**
     * Der Trainer kann den Vorstand um etwas bitten: mehr Transferbudget,
     * einen höheren Gehaltsetat oder einen Zuschuss für den Ausbau von
     * Trainingsgelände oder Jugendzentrum. Der Vorstand berät ein paar Tage
     * und entscheidet nach Vertrauen, Tabellenlage und Kasse. Wer abblitzt
     * und weiter drängt, verliert Vertrauen und Aussichten; über dieselbe
     * Sache redet der Vorstand erst nach einer Weile wieder (sperre, Tage).
     */
    ANFRAGEN: {
        transfer: { label: "Mehr Transferbudget", sperre: 56 },
        gehalt: { label: "Höherer Gehaltsetat", sperre: 56 },
        training: { label: "Zuschuss zum Ausbau des Trainingsgeländes", anlage: "trainingGround", sperre: 112 },
        jugend: { label: "Zuschuss zum Ausbau des Jugendzentrums", anlage: "youthCenter", sperre: 112 }
    },
    ANFRAGE_BEDENKZEIT: 3,

    stempel(state) {
        return (state?.seasonYear || 1) * 1000 + (state?.currentDayIndex || 0);
    },

    eigenerVerein(state) {
        return (state?.clubs || []).find(c => c.id === state?.userClubId) || null;
    },

    /** Darf der Trainer jetzt darum bitten? null, wenn ja - sonst der Grund */
    anfrageHindernis(state, key) {
        const club = this.eigenerVerein(state);
        const a = this.ANFRAGEN[key];
        if (!club || !a) return "Diese Anfrage gibt es nicht.";
        if (state.vorstandsAnfrage) return "Der Vorstand berät noch über Ihre letzte Anfrage.";
        const letztes = club.vorstandsanfragen?.[key]?.letztes;
        if (typeof letztes === "number") {
            const rest = a.sperre - (this.stempel(state) - letztes);
            if (rest > 0) return `Darüber hat der Vorstand erst entschieden - wieder in ${rest} Tagen.`;
        }
        if ((club.balance || 0) <= 0) return "Die Kasse ist leer - Geld gibt der Vorstand gerade nicht.";
        if (a.anlage) {
            const fac = _boardResolve('FacilityEngine', './facilityEngine.js');
            const anlage = fac && typeof fac.hole === "function" ? fac.hole(club, state.seasonYear || 1)[a.anlage] : null;
            if (anlage && anlage.stufe >= 5) return "Die Anlage hat schon die höchste Stufe.";
            if (anlage && anlage.projekt) return "An der Anlage wird schon gebaut.";
            const zuschuss = this.offenerZuschuss(state, club);
            if (zuschuss) return zuschuss.key === a.anlage
                ? "Der Zuschuss ist schon bewilligt - er wartet auf den Baubeginn."
                : "Ein bewilligter Zuschuss wartet noch auf den Baubeginn.";
        }
        return null;
    },

    /** Der bewilligte Bauzuschuss dieser Saison - er verfällt mit dem Saisonwechsel */
    offenerZuschuss(state, club) {
        const z = club && club.bauzuschuss;
        if (!z) return null;
        if (z.saison !== (state.seasonYear || 1)) { delete club.bauzuschuss; return null; }
        return z;
    },

    /** Eine Anfrage einreichen - die Antwort kommt nach ein paar Tagen */
    stelleAnfrage(state, key) {
        const grund = this.anfrageHindernis(state, key);
        if (grund) return { ok: false, grund };
        const jetzt = this.stempel(state);
        state.vorstandsAnfrage = { key, tag: jetzt, entscheidetTag: jetzt + this.ANFRAGE_BEDENKZEIT };
        return { ok: true, tage: this.ANFRAGE_BEDENKZEIT };
    },

    /** Wie wahrscheinlich der Vorstand zustimmt - für Anzeige und Entscheidung */
    anfrageChance(state, key) {
        const club = this.eigenerVerein(state);
        if (!club) return 0;
        // Das Vertrauen, das der Manager im Kopf der Seite sieht
        let chance = (this.vertrauen(state, club) - 40) / 60;
        const platz = (state.standings || []).findIndex(e => e.clubId === club.id) + 1;
        const gespielt = (state.standings || [])[0]?.played || 0;
        if (platz && gespielt >= 3) {
            const ziel = this.zielPlatz(state, club);
            if (platz <= ziel) chance += 0.15;
            else if (platz > ziel + 3) chance -= 0.25;
        }
        const kasse = club.balance || 0;
        const budget = club.transferBudget || 0;
        if (kasse > budget * 1.5) chance += 0.1;
        else if (kasse < budget) chance -= 0.15;
        const abgelehnt = club.vorstandsanfragen?.abgelehnt?.saison === state.seasonYear ? club.vorstandsanfragen.abgelehnt.anzahl : 0;
        chance -= abgelehnt * 0.1;
        return Math.max(0.05, Math.min(0.9, chance));
    },

    /** Das angezeigte Vorstandsvertrauen (state.boardConfidence), sonst das des Vereins */
    vertrauen(state, club) {
        return typeof state?.boardConfidence === "number" ? state.boardConfidence : (club?.confidence ?? 75);
    },

    /** Was der Vorstand bei Zustimmung gibt */
    anfrageBetrag(state, key) {
        const club = this.eigenerVerein(state);
        const ce = _boardResolve('ContractEngine', './contractEngine.js');
        const runde = b => ce && typeof ce.rundeBetrag === "function" ? ce.rundeBetrag(b) : Math.round(b);
        const kasse = Math.max(0, club?.balance || 0);
        if (key === "transfer") {
            const frei = kasse - (club.transferBudget || 0);
            return frei > 0 ? runde(Math.min(frei * 0.5, Math.max(kasse * 0.05, (club.transferBudget || 0) * 0.15))) : 0;
        }
        if (key === "gehalt") return runde((club.wageBudget || 0) * 0.1);
        const a = this.ANFRAGEN[key];
        const fac = _boardResolve('FacilityEngine', './facilityEngine.js');
        if (!a?.anlage || !fac || typeof fac.kostenDetail !== "function") return 0;
        return runde(fac.kostenDetail(club, a.anlage, "ausbau", state.seasonYear || 1).netto * 0.5);
    },

    /** Täglich: Ist die Bedenkzeit um, entscheidet der Vorstand */
    anfrageTag(state, zufall = Math.random) {
        const offen = state?.vorstandsAnfrage;
        if (!offen || this.stempel(state) < offen.entscheidetTag) return null;
        delete state.vorstandsAnfrage;
        return this.entscheideAnfrage(state, offen.key, zufall);
    },

    entscheideAnfrage(state, key, zufall = Math.random) {
        const club = this.eigenerVerein(state);
        const a = this.ANFRAGEN[key];
        if (!club || !a) return null;
        const betrag = this.anfrageBetrag(state, key);
        const ja = betrag > 0 && zufall() < this.anfrageChance(state, key);
        const news = _boardResolve('NewsEngine', './newsEngine.js');
        const gs = _boardResolve('GameState', './gameState.js');
        const geld = b => gs && typeof gs.formatMoney === "function" ? gs.formatMoney(b) : `${b} €`;
        if (!club.vorstandsanfragen) club.vorstandsanfragen = {};
        club.vorstandsanfragen[key] = { letztes: this.stempel(state), ergebnis: ja ? "ja" : "nein" };

        let betreff, text;
        if (ja) {
            if (key === "transfer") {
                club.transferBudget = Math.round((club.transferBudget || 0) + betrag);
                text = `Der Vorstand stockt das Transferbudget um ${geld(betrag)} auf. Wir erwarten, dass das Geld gut angelegt wird.`;
            } else if (key === "gehalt") {
                club.wageBudget = Math.round((club.wageBudget || 0) + betrag);
                text = `Der Gehaltsetat steigt um ${geld(betrag)} pro Woche. Halten Sie ihn ein.`;
            } else {
                club.bauzuschuss = { key: a.anlage, betrag, saison: state.seasonYear };
                text = `Der Vorstand übernimmt die Hälfte des nächsten Ausbaus: ${geld(betrag)} kommen dazu, sobald die Arbeiten beginnen.`;
            }
            betreff = `Vorstand stimmt zu: ${a.label}`;
        } else {
            const ab = club.vorstandsanfragen.abgelehnt;
            club.vorstandsanfragen.abgelehnt = { saison: state.seasonYear, anzahl: (ab && ab.saison === state.seasonYear ? ab.anzahl : 0) + 1 };
            const vertrauen = this.vertrauen(state, club);
            const malus = vertrauen < 50 ? 4 : 2;
            club.confidence = Math.max(10, (club.confidence ?? 75) - malus);
            if (typeof state.boardConfidence === "number") state.boardConfidence = Math.max(10, state.boardConfidence - malus);
            const grund = betrag <= 0 ? "Es ist schlicht kein Geld dafür da."
                : (vertrauen < 50 ? "Erst müssen die Ergebnisse stimmen."
                    : "Im Moment sehen wir keinen Anlass dafür.");
            betreff = `Vorstand lehnt ab: ${a.label}`;
            text = `${grund} Wir kommen in ein paar Wochen darauf zurück, wenn sich etwas ändert.`;
        }
        if (news && typeof news.createBoardMessage === "function") {
            news.createBoardMessage(state, { title: betreff, text, priority: "normal" });
        }
        return { zugestimmt: ja, key, betrag, betreff };
    },

    /**
     * Aktualisiert die Vorstandszufriedenheit basierend auf Tabelle, Zielen, Finanzen und Form
     */
    updateConfidence(state) {
        if (!state || !state.userClubId) return;

        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        const standings = state.standings || [];
        const rankIndex = standings.findIndex(s => s.clubId === state.userClubId);
        const rank = rankIndex !== -1 ? rankIndex + 1 : 10;
        // Der Zielplatz gilt in der eigenen Liga - vorher wurde hier mit der
        // Zahl aller Vereine der Welt gerechnet ("Mittelfeld" = Platz 100)
        const targetRank = this.zielPlatz(state, userClub);

        // Basis-Berechnung nach Tabellenposition
        const rankDiff = targetRank - rank; // Positiv = besser als Ziel, Negativ = schlechter
        let newConf = userClub.confidence || 75;

        // Schrittweise Anpassung
        if (rankDiff > 2) {
            newConf += 2;
        } else if (rankDiff > 0) {
            newConf += 1;
        } else if (rankDiff < -3) {
            newConf -= 3;
        } else if (rankDiff < 0) {
            newConf -= 1;
        }

        // Einfluss der Finanzen
        if (userClub.balance < 0) {
            newConf -= 2;
        }
        if (userClub.wageBudget < 0) {
            newConf -= 1;
        }

        // Form der letzten Spiele
        const formArr = Array.isArray(userClub.form) ? userClub.form : (userClub.form ? String(userClub.form).split("") : []);
        const lastGames = formArr.slice(-3);
        const winsInLast = lastGames.filter(g => g === "W" || g === "S").length;
        const lossesInLast = lastGames.filter(g => g === "L" || g === "N").length;

        if (winsInLast >= 2) newConf += 1;
        if (lossesInLast >= 2) newConf -= 2;

        // Grenzen einhalten (10% bis 100%)
        newConf = Math.max(10, Math.min(100, Math.round(newConf)));
        userClub.confidence = newConf;

        // Vorstandsnachricht bei kritischer Zufriedenheit
        if (newConf < 35 && (!userClub.lastWarningMatchday || state.currentMatchday - userClub.lastWarningMatchday > 4)) {
            userClub.lastWarningMatchday = state.currentMatchday;
            const newsEngine = _boardResolve('NewsEngine', './newsEngine.js');
            if (newsEngine) {
                newsEngine.createBoardMessage(state, {
                    title: "Krise: Ultimatum des Vorstands",
                    text: `Sehr geehrter Manager, der Vorstand ist mit den jüngsten Leistungen und Tabellenplatz ${rank} äußerst unzufrieden. Wir erwarten in den kommenden Spielen eine spürbare Leistungssteigerung!`,
                    priority: "high"
                });
            }
        }

        return {
            confidence: newConf,
            targetRank: targetRank,
            currentRank: rank,
            message: this.getBoardMessage(state)
        };
    },

    /**
     * Liefert eine passende textuelle Zusammenfassung der Vorstandsstimmung
     */
    getBoardMessage(state) {
        if (!state || !state.userClubId) return "Keine Daten verfügbar.";
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return "";

        const conf = userClub.confidence || 75;
        if (conf >= 85) return "Der Vorstand ist begeistert von Ihrer Arbeit und vollauf zufrieden!";
        if (conf >= 70) return "Der Vorstand ist mit dem aktuellen Saisonverlauf und den Fortschritten zufrieden.";
        if (conf >= 50) return "Der Vorstand beobachtet die Situation aufmerksam. Es gibt noch Raum für Verbesserungen.";
        if (conf >= 35) return "Der Vorstand ist besorgt über die jüngsten Resultate. Die Saisonziele sind in Gefahr.";
        return "Alarmstufe Rot: Der Vorstand fordert sofortige Ergebnisse, andernfalls droht die Freistellung!";
    },

    /**
     * Saisonschluss-Bewertung
     */
    evaluateSeasonEnd(state) {
        if (!state || !state.userClubId) return { grade: "B", text: "" };
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const standings = state.standings || [];
        const rankIndex = standings.findIndex(s => s.clubId === state.userClubId);
        const rank = rankIndex !== -1 ? rankIndex + 1 : 10;

        const achieved = rank <= this.zielPlatz(state, userClub);

        return {
            achieved: achieved,
            finalRank: rank,
            confidence: userClub.confidence || 75,
            message: achieved 
                ? `Herzlichen Glückwunsch! Das Saisonziel wurde mit Platz ${rank} erfolgreich erreicht.`
                : `Das Saisonziel wurde mit Platz ${rank} leider verfehlt.`
        };
    }
};

if (typeof window !== "undefined") {
    window.BoardEngine = BoardEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BoardEngine };
}
