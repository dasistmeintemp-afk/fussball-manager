/**
 * CareerEngine - Die Entlassung hat Folgen
 *
 * Der Vorstand konnte bisher entlassen: `state.managerDismissed` wurde gesetzt,
 * die Nachricht landete im Postfach - und danach passierte nichts. Gemessen:
 * am 11. Spieltag entlassen, am 17. managte man denselben Verein weiter, das
 * Vertrauen war wieder bei 60. Eine Drohung, die nie eingelöst wurde.
 *
 * Diese Engine macht daraus eine Karriere: Die Station wird geschlossen und in
 * die Akte geschrieben, danach steht man ohne Verein da. Wer sich meldet, hängt
 * davon ab, was man vorzuweisen hat - wer zweimal in Folge scheitert, bekommt
 * nur noch Angebote aus tieferen Ligen. Und wer will, beendet die Laufbahn.
 */

function _carResolve(name, pfad) {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

class CareerEngine {
    /** So viele Vereine melden sich nach einer Entlassung */
    static ANZAHL_ANGEBOTE = 3;

    // ------------------------------------------------------------- Karriereakte

    /**
     * Die Karriereakte: jede Station mit Bilanz, jeder Titel, jede Entlassung.
     */
    static akte(state) {
        if (!state.career) {
            state.career = {
                stationen: [],
                titel: [],
                entlassungen: 0,
                beendet: false
            };
        }
        return state.career;
    }

    /**
     * Eine neue Station beginnt - beim Karrierestart und bei jedem Wechsel.
     */
    static beginneStation(state, clubId) {
        const akte = this.akte(state);
        const club = (state.clubs || []).find(c => c.id === clubId);
        if (!club) return null;

        const station = {
            clubId,
            clubName: club.name,
            leagueId: club.leagueId,
            vonSaison: state.seasonYear || 1,
            vonSpieltag: state.currentMatchday || 1,
            bisSaison: null,
            bisSpieltag: null,
            spiele: 0,
            siege: 0,
            unentschieden: 0,
            niederlagen: 0,
            ende: null
        };
        akte.stationen.push(station);
        return station;
    }

    /**
     * Am Saisonende wird die Bilanz der Spielzeit der laufenden Station
     * zugeschlagen.
     *
     * Die Tabelle wird gleich danach zurückgesetzt - was jetzt nicht in die
     * Akte wandert, ist verloren. Eine Station über drei Spielzeiten stünde
     * sonst am Ende mit der Bilanz einer einzigen da.
     */
    static schliesseSaisonAb(state) {
        const station = this.aktuelleStation(state);
        if (!station) return null;
        const b = this.bilanz(state);

        station.spiele = (station.spiele || 0) + b.spiele;
        station.siege = (station.siege || 0) + b.siege;
        station.unentschieden = (station.unentschieden || 0) + b.unentschieden;
        station.niederlagen = (station.niederlagen || 0) + b.niederlagen;
        station.letzteAbgeschlosseneSaison = state.seasonYear || 1;
        return station;
    }

    /** Die laufende Station */
    static aktuelleStation(state) {
        const akte = this.akte(state);
        const letzte = akte.stationen[akte.stationen.length - 1];
        return (letzte && !letzte.ende) ? letzte : null;
    }

    /**
     * Die Bilanz der laufenden Station aus der Tabelle ablesen.
     *
     * Der Saisonverlauf steht ohnehin in der Tabelle - sie noch einmal
     * mitzuzählen wäre eine zweite Wahrheit, die irgendwann auseinanderläuft.
     */
    static bilanz(state) {
        const eintrag = (state.standings || []).find(s => s.clubId === state.userClubId);
        if (!eintrag) return { spiele: 0, siege: 0, unentschieden: 0, niederlagen: 0, punkteSchnitt: 0 };

        const spiele = eintrag.played || 0;
        return {
            spiele,
            siege: eintrag.won || 0,
            unentschieden: eintrag.drawn || 0,
            niederlagen: eintrag.lost || 0,
            punkteSchnitt: spiele > 0 ? Math.round(((eintrag.points || 0) / spiele) * 100) / 100 : 0
        };
    }

    /**
     * Der Ruf des Managers.
     *
     * Er entscheidet, wer sich nach einer Entlassung meldet. Grundlage ist der
     * Ruf des Vereins, den man zuletzt betreut hat - jede Entlassung kostet,
     * jeder Titel bringt, und wer über dem Schnitt gepunktet hat, verliert
     * weniger.
     */
    static ruf(state) {
        const akte = this.akte(state);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        const basis = club ? (club.reputation || 50) : 45;

        const titelBonus = Math.min(20, (akte.titel || []).length * 6);
        const entlassungsMalus = Math.min(24, (akte.entlassungen || 0) * 8);

        const b = this.bilanz(state);
        const leistung = b.spiele >= 5 ? (b.punkteSchnitt - 1.3) * 8 : 0;

        return Math.max(8, Math.min(95, Math.round(basis + titelBonus - entlassungsMalus + leistung)));
    }

    // ------------------------------------------------------------ Entlassung

    /**
     * Die Entlassung abwickeln: Station schließen, Angebote einholen.
     *
     * Wird genau einmal je Entlassung ausgeführt - die Oberfläche darf so oft
     * nachfragen, wie sie will.
     */
    static verarbeiteEntlassung(state) {
        if (!state || !state.managerDismissed) return null;
        if (state.managerDismissed.verarbeitet) return state.managerDismissed;

        const akte = this.akte(state);
        const station = this.aktuelleStation(state) || this.beginneStation(state, state.userClubId);
        const b = this.bilanz(state);

        if (station) {
            station.bisSaison = state.seasonYear || 1;
            station.bisSpieltag = state.currentMatchday || 1;
            // Die laufende, noch nicht abgeschlossene Saison kommt dazu
            station.spiele = (station.spiele || 0) + b.spiele;
            station.siege = (station.siege || 0) + b.siege;
            station.unentschieden = (station.unentschieden || 0) + b.unentschieden;
            station.niederlagen = (station.niederlagen || 0) + b.niederlagen;
            station.ende = "entlassen";
        }

        akte.entlassungen = (akte.entlassungen || 0) + 1;

        state.managerDismissed.verarbeitet = true;
        state.managerDismissed.bilanz = b;
        state.managerDismissed.ruf = this.ruf(state);
        state.managerDismissed.angebote = this.sucheAngebote(state, state.managerDismissed.ruf);
        state.arbeitslos = true;

        return state.managerDismissed;
    }

    /**
     * Wer meldet sich?
     *
     * Nur Vereine aus Ligen, die genauso viele Spieltage haben wie die
     * bisherige - sonst passte der laufende Kalender nicht mehr zur neuen
     * Saison. Und nur solche, die sportlich gerade selbst Sorgen haben: Ein
     * Tabellenführer wechselt mitten in der Saison nicht den Trainer.
     */
    static sucheAngebote(state, ruf) {
        const spieltage = (state.schedule || []).length;
        const alteLiga = state.userLeagueId;
        const ligen = this.passendeLigen(state, spieltage);

        const kandidaten = [];
        ligen.forEach(ligaId => {
            const tabelle = ligaId === alteLiga
                ? (state.standings || [])
                : ((state.standingsByLeague || {})[ligaId] || []);
            if (!tabelle.length) return;

            // Die untere Hälfte einer Liga ist die, in der Trainer gehen
            const untereHaelfte = tabelle.slice(Math.floor(tabelle.length / 2));
            untereHaelfte.forEach((eintrag, i) => {
                if (eintrag.clubId === state.userClubId) return;
                const club = (state.clubs || []).find(c => c.id === eintrag.clubId);
                if (!club) return;

                const rep = club.reputation || 40;
                // Ein Verein holt keinen Trainer, dessen Ruf weit über oder
                // weit unter dem eigenen liegt
                const abstand = Math.abs(rep - ruf);
                if (rep > ruf + 6) return;
                if (abstand > 32) return;

                const platz = tabelle.findIndex(t => t.clubId === club.id) + 1;
                kandidaten.push({
                    clubId: club.id,
                    clubName: club.name,
                    leagueId: ligaId,
                    leagueName: this.ligaName(state, ligaId),
                    reputation: rep,
                    platz,
                    vonWievielen: tabelle.length,
                    budget: club.transferBudget || 0,
                    erwartung: club.boardExpectation || "midfield",
                    // Je näher am eigenen Ruf, desto eher kommt das Angebot
                    gewicht: abstand + (i * 0.5)
                });
            });
        });

        kandidaten.sort((a, b) => a.gewicht - b.gewicht);

        // Aus jeder Liga höchstens zwei - sonst kämen alle drei Angebote aus
        // derselben Tabelle
        const proLiga = {};
        const auswahl = [];
        for (const k of kandidaten) {
            proLiga[k.leagueId] = (proLiga[k.leagueId] || 0);
            if (proLiga[k.leagueId] >= 2) continue;
            proLiga[k.leagueId]++;
            auswahl.push(k);
            if (auswahl.length >= this.ANZAHL_ANGEBOTE) break;
        }
        return auswahl;
    }

    /** Ligen, deren Spielplan zum laufenden Kalender passt */
    static passendeLigen(state, spieltage) {
        const ligen = [];
        if (state.userLeagueId && (state.schedule || []).length === spieltage) {
            ligen.push(state.userLeagueId);
        }
        Object.keys(state.otherSchedules || {}).forEach(id => {
            if ((state.otherSchedules[id] || []).length === spieltage) ligen.push(id);
        });
        return ligen;
    }

    static ligaName(state, ligaId) {
        const liga = (state.leagues || []).find(l => l.id === ligaId);
        return liga ? (liga.shortName || liga.name) : ligaId;
    }

    // ------------------------------------------------------------- Neuanfang

    /**
     * Eine neue Station antreten.
     *
     * Der Spielplan der neuen Liga wird zum eigenen, der alte wandert zurück
     * zu den mitlaufenden Ligen. Die laufende Saison geht dort weiter, wo der
     * neue Verein gerade steht.
     */
    static uebernimm(state, clubId) {
        const club = (state.clubs || []).find(c => c.id === clubId);
        if (!club) return { erfolg: false, grund: "Verein nicht gefunden" };

        const alteLiga = state.userLeagueId;
        const neueLiga = club.leagueId;

        if (neueLiga && neueLiga !== alteLiga) {
            state.otherSchedules = state.otherSchedules || {};
            state.standingsByLeague = state.standingsByLeague || {};

            // Spielpläne tauschen: der neue wird der eigene
            const neuerPlan = state.otherSchedules[neueLiga] || [];
            state.otherSchedules[alteLiga] = state.schedule;
            state.standingsByLeague[alteLiga] = state.standings;
            delete state.otherSchedules[neueLiga];

            state.schedule = neuerPlan;
            state.totalMatchdays = neuerPlan.length || state.totalMatchdays;
            state.userLeagueId = neueLiga;
            state.standings = state.standingsByLeague[neueLiga] || [];
            state.leagueName = this.ligaName(state, neueLiga);
            state.activeCompetitionId = neueLiga;
        }

        state.userClubId = clubId;
        state.arbeitslos = false;
        state.managerDismissed = null;
        state.boardConfidence = 62;
        state.jobSecurity = { stage: "ruhig", ultimatumUntil: null, ultimatumRank: null, warnedAt: null };
        state.fanMood = 58;
        state.mediaPressure = 55;

        // Was zum alten Verein gehörte, endet mit ihm
        this.raeumeAlteVorgaenge(state, clubId);

        // Aufstellung des neuen Vereins übernehmen
        const gameState = _carResolve("GameState", "./gameState.js");
        if (gameState && typeof gameState.autoSetLineupForClub === "function") {
            gameState.autoSetLineupForClub(club, state.players);
        }

        const youth = _carResolve("YouthEngine", "./youthEngine.js");
        if (youth && typeof youth.generateProspects === "function") {
            youth.generateProspects(state, clubId);
        }

        this.beginneStation(state, clubId);

        const platz = (state.standings || []).findIndex(s => s.clubId === clubId) + 1;
        this.postfach(state, `Vorstand ${club.name}`,
            `Willkommen bei ${club.name}`,
            `Wir freuen uns, dass Sie zugesagt haben.\n\n`
            + `Die Lage ist, wie sie ist: ${platz > 0 ? `Platz ${platz} in der ${state.leagueName}` : `Wir spielen in der ${state.leagueName}`}, `
            + `und der Vorstand hat Sie geholt, weil er glaubt, dass Sie das drehen können.\n\n`
            + `Sehen Sie sich den Kader an, legen Sie die Taktik fest - und dann arbeiten wir.`,
            "welcome");

        return { erfolg: true, club, platz };
    }

    /**
     * Verhandlungen, Scoutingaufträge und Vorbereitungspläne gehören dem alten
     * Verein - sie laufen nicht mit zum neuen.
     */
    static raeumeAlteVorgaenge(state, neuerClubId) {
        if (Array.isArray(state.negotiations)) {
            state.negotiations = state.negotiations.filter(n => n.clubId === neuerClubId);
        }
        if (Array.isArray(state.scoutAssignments)) {
            state.scoutAssignments = [];
        }
        if (Array.isArray(state.transferOffers)) {
            state.transferOffers = state.transferOffers.filter(o =>
                o.fromClubId === neuerClubId || o.toClubId === neuerClubId);
        }
    }

    /**
     * Die Laufbahn beenden.
     */
    static beendeKarriere(state) {
        const akte = this.akte(state);
        akte.beendet = true;
        state.careerOver = true;
        state.arbeitslos = true;
        return this.zeugnis(state);
    }

    /**
     * Das Zeugnis: alle Stationen, alle Titel, die Gesamtbilanz.
     */
    static zeugnis(state) {
        const akte = this.akte(state);
        const gesamt = akte.stationen.reduce((s, st) => ({
            spiele: s.spiele + (st.spiele || 0),
            siege: s.siege + (st.siege || 0),
            unentschieden: s.unentschieden + (st.unentschieden || 0),
            niederlagen: s.niederlagen + (st.niederlagen || 0)
        }), { spiele: 0, siege: 0, unentschieden: 0, niederlagen: 0 });

        return {
            name: state.managerName || "Trainer",
            stationen: akte.stationen,
            titel: akte.titel || [],
            entlassungen: akte.entlassungen || 0,
            gesamt,
            siegquote: gesamt.spiele > 0 ? Math.round((gesamt.siege / gesamt.spiele) * 100) : 0
        };
    }

    /** Einen gewonnenen Titel in die Akte schreiben */
    static vermerkeTitel(state, wettbewerb, saison) {
        const akte = this.akte(state);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        akte.titel = akte.titel || [];
        akte.titel.push({
            wettbewerb,
            saison: saison || state.seasonYear || 1,
            clubName: club ? club.name : ""
        });
    }

    static postfach(state, sender, betreff, text, typ) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday || 1,
            date: `Spieltag ${state.currentMatchday || 1}`,
            sender,
            subject: betreff,
            title: betreff,
            body: text,
            text,
            read: false,
            type: typ || "board"
        });
    }
}

if (typeof window !== "undefined") {
    window.CareerEngine = CareerEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { CareerEngine };
}
