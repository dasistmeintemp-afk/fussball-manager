/**
 * FinanceEngine - Finanzhaushalt, Spieltagseinnahmen, Gehälter, Sponsoring und Buchhaltung
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _feResolve = (globalName, path) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[globalName]; } catch (e) { return null; }
    }
    return null;
};

const FinanceEngine = {
    /**
     * Anteil der Einnahmen, der für den laufenden Betrieb draufgeht.
     * Gehälter und Stadionunterhalt kommen obendrauf.
     *
     * Mit fünf Prozent blieb jedem Verein Saison für Saison ein zweistelliger
     * Millionenbetrag übrig, der nie wieder ausgegeben wurde: Nach fünf Jahren
     * lag die durchschnittliche Vereinskasse bei 253 Millionen, der Transferetat
     * bei 45. Geld war damit keine Entscheidung mehr - man konnte sich alles
     * leisten, und das nahm dem Transfermarkt jede Bedeutung.
     *
     * Ein Fußballverein gibt aus, was er einnimmt. Neben Gehältern und
     * Stadionunterhalt kostet der Betrieb Ablösesummen und deren Abschreibung,
     * Beraterhonorare, Scouting, Nachwuchsleistungszentrum, Verwaltung und
     * Reisen - zusammen der größte Posten nach den Gehältern.
     */
    OPERATING_COST_SHARE: 0.26,

    /**
     * Der Betriebsaufwand je Ligastufe - ein Apparat wächst nicht im gleichen
     * Maß wie der Umsatz.
     *
     * Mit einem festen Viertel für alle bezahlte die erste Liga drauf: Der
     * Median-Erstligist nahm 1,65 Mio je Spieltag ein und gab 809k für
     * Gehälter (49 % - realistisch), 500k für Unterhalt und 571k für den
     * Betrieb aus. Zusammen 114 % des Umsatzes, also 228k Verlust je
     * Spieltag oder rund acht Millionen je Saison. Gemessen über eine ganze
     * Saison waren es sogar 26 Millionen, und nach einer Saison stand die
     * Hälfte aller Erstligisten im Minus - während die Stufen zwei bis sieben
     * durchweg Gewinn machten.
     *
     * Ein großer Verein verwaltet nicht fünfmal so viel, nur weil er fünfmal
     * so viel einnimmt: Geschäftsstelle, Nachwuchs und Reisen skalieren
     * schwächer als der Umsatz. Unten dagegen frisst schon der Grundbetrieb
     * einen spürbaren Anteil - und dort ist die Gehaltslast winzig: In der
     * ersten Liga gehen 42 % des Umsatzes an die Spieler, in der siebten nur
     * 3 %. Was die Kader nicht kosten, kostet der Apparat.
     *
     * Seit die Gehälter an das Budget des Vereins gebunden sind (siehe
     * GEHALTSQUOTE), trägt der Kader in jeder Liga einen ähnlichen Anteil. Der
     * Apparat darf deshalb oben etwas weniger fressen als vorher - der
     * Erstligist verlor sonst weiter Geld, obwohl seine Gehaltsliste passte.
     *
     * Unten muss der Anteil dagegen deutlich hoeher liegen, als er es tat: Ein
     * Amateurverein hat kaum Gehaelter, aber trotzdem Platzmiete, Schiedsrichter,
     * Fahrten, Ausruestung und eine Jugendabteilung. Mit einem halben Anteil
     * legte die siebte Liga jeden Spieltag 30 Prozent ihrer Einnahmen zurueck.
     */
    OPERATING_COST_BY_LEVEL: { 1: 0.24, 2: 0.36, 3: 0.44, 4: 0.53, 5: 0.59, 6: 0.63, 7: 0.66 },

    /** Betriebsaufwandsquote eines Vereins */
    operatingShare(club) {
        return this.OPERATING_COST_BY_LEVEL[club?.level || 1] ?? this.OPERATING_COST_SHARE;
    },

    /**
     * Ein Teil des Apparats hängt am Kader, nicht am Umsatz: Wer 24 Profis
     * beschäftigt, unterhält auch die Betreuer, Ärzte und Berater dazu. Ohne
     * diesen Anteil würde ein Verein mit teurem Kader und kleinem Stadion
     * unrealistisch gut dastehen.
     */
    OPERATING_WAGE_SHARE: 0.16,

    /**
     * Wirtschaftskraft nach Ligastufe.
     *
     * Die Gehälter fielen von der Bundesliga zur Landesliga um den Faktor 270,
     * die Sponsorenzahlung aber nur um den Faktor acht - ein Landesligist nahm
     * 150.000 € pro Spieltag ein und zahlte 2.850 € Gehälter. Nach fünf
     * Saisons saß jeder Amateurverein auf einem zweistelligen Millionenbetrag.
     *
     * Nach unten muss die Kurve steiler fallen, als sie es tat: Mit 0.08 nahm
     * ein Siebtligist 91.000 € je Spieltag ein - drei Millionen je Saison für
     * einen Verein, der in Wirklichkeit mit einem sechsstelligen Etat auskommt.
     * Er legte damit jeden Spieltag 36.000 € zurück, während die Bundesliga
     * draufzahlte.
     */
    LEVEL_ECONOMY: { 1: 1.0, 2: 0.40, 3: 0.17, 4: 0.075, 5: 0.038, 6: 0.026, 7: 0.019 },

    /**
     * Wirtschaftskraft nach Land - vor allem das Fernsehgeld. Vorher verdiente
     * der Zehnte der Premier League so viel wie der Zehnte der Bundesliga.
     * Umsatz je Erstligist 2023/24 (Deloitte Annual Review of Football
     * Finance 2025): Premier League rund 370 Mio. EUR, Bundesliga 211, LaLiga
     * 190, Serie A und Ligue 1 je rund 145.
     *
     * Der Vorsprung liegt vor allem in der Breite: Die Spitzenklubs der großen
     * Ligen setzen ähnlich viel um, der Vierzehnte der Premier League aber ein
     * Vielfaches seines Gegenstücks in Italien oder Frankreich. Deshalb zwei
     * Faktoren gegenüber der Bundesliga: auf den Sockel (Fernsehgeld, das alle
     * bekommen) und auf die Spanne (was der Rang dazubringt).
     */
    LAND_ECONOMY: {
        en: { sockel: 2.3, spanne: 1.0 },
        de: { sockel: 1.0, spanne: 1.0 },
        es: { sockel: 0.75, spanne: 1.0 },
        it: { sockel: 0.6, spanne: 0.75 },
        fr: { sockel: 0.5, spanne: 0.75 }
    },

    /** Die Länderfaktoren eines Landes (unbekanntes Land: wie die Bundesliga) */
    landWirtschaft(countryId) {
        return this.LAND_ECONOMY[countryId || "de"] || { sockel: 1, spanne: 1 };
    },

    /** Wie viel mehr oder weniger ein Verein dieses Rangs im Land umsetzt als in der Bundesliga */
    landFaktor(countryId, rang = 0.5) {
        const l = this.landWirtschaft(countryId);
        const r = Math.pow(Math.max(0, Math.min(1, rang)), this.SPONSOR_KURVE);
        return (this.SPONSOR_SOCKEL * l.sockel + r * this.SPONSOR_SPANNE * l.spanne) / (this.SPONSOR_SOCKEL + r * this.SPONSOR_SPANNE);
    },

    /**
     * Sockel und Spanne der Sponsorenzahlung innerhalb einer Liga.
     *
     * Vorher hingen die Einnahmen fast linear am Ruf: Der FC München nahm
     * 1.91 Millionen je Spieltag ein, der FC Augsburg 1.50 - ein Viertel
     * weniger, bei einem Fünftel der Gehaltslast. Die kleinen Vereine haben
     * damit Geld gedruckt: Über eine Saison legte Schalke 36.9 Millionen
     * zurück, Frankfurt 41.9, während München bei plus 0.9 landete. Nach fünf
     * Saisons lag die durchschnittliche Vereinskasse bei einer Viertelmilliarde.
     *
     * In Wirklichkeit ist der Abstand gewaltig: Ein Spitzenklub setzt ein
     * Vielfaches eines Abstiegskandidaten um. Gemessen wird der Rang innerhalb
     * der eigenen Liga, damit dieselbe Rechnung in der Bundesliga und in der
     * Landesliga funktioniert.
     *
     * Der Sockel war zu hoch und die Spanne zu klein: Meister und Absteiger
     * trennte der Faktor 2,2, ihre Gehaltslisten aber der Faktor 2,9. Genau
     * deshalb stand der Spitzenverein bei 74 % Gehaltsquote und der Mittelfeld-
     * verein bei 46 % - andersherum, als es sein müsste.
     */
    SPONSOR_SOCKEL: 320000,
    SPONSOR_SPANNE: 2400000,

    /** Wie stark die Zahlung mit dem Rang steigt (>1 bevorzugt die Spitze) */
    SPONSOR_KURVE: 1.5,

    /** Sponsorenzahlung eines Vereins je Spieltag */
    sponsorPerMatchday(club) {
        if (!club) return 0;

        // Ein in der Vorbereitung ausgehandelter Vertrag gilt. Der gespeicherte
        // Betrag wurde vorher bewusst ignoriert, weil ihn niemand aushandeln
        // konnte und er nur eine veraltete Zahl bei der Vereinsgruendung war -
        // jetzt waehlt der Manager sein Angebot selbst aus, und dann muss es
        // auch das sein, was auf dem Konto landet.
        if (club.sponsor && club.sponsor.amountPerMatchday > 0 && club.sponsor.ausgehandelt) {
            return club.sponsor.amountPerMatchday;
        }

        const faktor = this.LEVEL_ECONOMY[club.level || 1] ?? 0.05;
        const rang = typeof club.clubStrength === "number"
            ? Math.max(0, Math.min(1, club.clubStrength))
            : 0.5;
        const land = this.landWirtschaft(club.countryId);
        return Math.round((this.SPONSOR_SOCKEL * land.sockel + Math.pow(rang, this.SPONSOR_KURVE) * this.SPONSOR_SPANNE * land.spanne) * faktor);
    },

    /**
     * Was ein Verein je Spieltag ungefähr einnimmt.
     *
     * Ohne Tabellenplatz, Form und Gegner - die Zahl soll nur die Größenordnung
     * treffen, damit sich ein Gehaltsbudget daran bemessen lässt. Heimspiele
     * gibt es nur jeden zweiten Spieltag, deshalb die Halbierung.
     */
    einnahmenSchaetzung(club, state = null) {
        if (!club) return 0;
        const fac = _feResolve("FacilityEngine", "./facilityEngine.js");
        const kapazitaet = (fac && typeof fac.verfuegbareKapazitaet === "function")
            ? fac.verfuegbareKapazitaet(club, state?.seasonYear || 1)
            : (club.stadiumCapacity || club.capacity || 20000);

        const ticket = kapazitaet * 0.78 * (club.ticketPrice || 35) / 2;
        return Math.round(this.sponsorPerMatchday(club) + ticket);
    },

    /**
     * Wie viel von den Einnahmen an die Spieler gehen darf.
     *
     * Gemessen ging die Rechnung vorher nicht auf: Der Median-Erstligist zahlte
     * 59 Prozent seiner Einnahmen an Gehälter und verlor 421.000 € je Spieltag
     * - nach vier Saisons standen 86 von 96 Erstligisten im Minus, während die
     * siebte Liga jeden Spieltag Geld zurücklegte. Die Pyramide stand auf dem
     * Kopf.
     *
     * Der Grund war struktureller Natur: Gehälter entstehen aus der Kaderstärke,
     * Einnahmen aus dem Rang in der Liga. Das sind zwei verschiedene Achsen, und
     * in der Mitte der Tabelle klafften sie auseinander.
     *
     * Deshalb wird es jetzt andersherum gerechnet: Ein Verein baut den Kader,
     * den er bezahlen kann - so wie in Wirklichkeit auch. Je tiefer die Liga,
     * desto kleiner der Anteil: Ein Amateurverein zahlt Aufwandsentschädigungen,
     * keine Gehälter. Und der Spitzenverein zahlt einen kleineren Anteil als der
     * Abstiegskandidat, weil sein Umsatz schneller wächst als seine Gehaltsliste.
     */
    GEHALTSQUOTE: { 1: 0.60, 2: 0.48, 3: 0.38, 4: 0.30, 5: 0.24, 6: 0.20, 7: 0.17 },

    gehaltsbudgetJeSpieltag(club, state = null) {
        if (!club) return 0;
        const grund = this.GEHALTSQUOTE[club.level || 1] ?? 0.30;
        const rang = typeof club.clubStrength === "number"
            ? Math.max(0, Math.min(1, club.clubStrength))
            : 0.5;
        // Wer oben steht, gab vorher anteilig weniger aus (bis 18 % Abschlag):
        // Gemessen lag die Gehaltsquote der Spitzenklubs dann bei 30 % ihrer
        // Einnahmen, und sie legten Saison für Saison 70 bis 140 Mio. zurück.
        // Jetzt ist der Abschlag klein.
        return Math.round(this.einnahmenSchaetzung(club, state) * grund * (1 - rang * 0.05));
    },

    /**
     * Die Kadergehälter auf das legen, was der Verein tragen kann.
     *
     * Wird einmal nach dem Aufbau der Welt gerufen und danach bei jedem
     * Ligawechsel: Ein Absteiger kann die Bundesligagehälter nicht weiterzahlen,
     * ein Aufsteiger muss mehr bieten.
     *
     * Die Spanne innerhalb des Kaders bleibt erhalten - es werden alle Gehälter
     * mit demselben Faktor verschoben, nicht eingeebnet. Und der Faktor ist
     * begrenzt, damit ein Ausreißer keinen Kader verzerrt.
     */
    normalisiereGehaelter(state, clubs = null) {
        if (!state || !Array.isArray(state.players)) return 0;
        const liste = clubs || state.clubs || [];

        const nachVerein = new Map();
        state.players.forEach(p => {
            if (!nachVerein.has(p.clubId)) nachVerein.set(p.clubId, []);
            nachVerein.get(p.clubId).push(p);
        });

        let angepasst = 0;
        liste.forEach(club => {
            const kader = nachVerein.get(club.id);
            if (!kader || !kader.length) return;

            const ist = kader.reduce((s, p) => s + (p.wage || 0), 0);
            if (ist <= 0) return;
            const ziel = this.gehaltsbudgetJeSpieltag(club, state);
            if (ziel <= 0) return;

            const faktor = Math.max(0.25, Math.min(3.0, ziel / ist));
            if (Math.abs(faktor - 1) < 0.02) return;

            kader.forEach(p => {
                p.wage = Math.max(120, Math.round((p.wage || 0) * faktor / 10) * 10);
            });
            angepasst++;
        });

        return angepasst;
    },

    /**
     * Gehaltsdisziplin der KI-Vereine zum Saisonwechsel.
     *
     * Jeder Wechsel legt beim Gehalt fünf bis dreißig Prozent drauf, jede
     * Verlängerung ebenso - angeglichen wurde aber nur bei Auf- und Abstieg.
     * Gemessen lagen die Erstligisten nach drei Saisons bei 115 % dessen, was
     * sie tragen können, und Saison für Saison verloren mehr Vereine Geld.
     * Wer über der Grenze liegt, kommt jetzt auf halbem Weg zurück: Spieler
     * gehen, Verträge werden neu verhandelt. Der eigene Verein bleibt außen
     * vor - dort entscheidet der Trainer.
     */
    GEHALT_GRENZE: 1.08,

    gehaltsDisziplin(state) {
        if (!state || !Array.isArray(state.players)) return 0;
        const nachVerein = new Map();
        state.players.forEach(p => {
            if (!p.clubId || p.leihe) return;
            if (!nachVerein.has(p.clubId)) nachVerein.set(p.clubId, []);
            nachVerein.get(p.clubId).push(p);
        });
        let angepasst = 0;
        (state.clubs || []).forEach(club => {
            if (club.id === state.userClubId) return;
            const kader = nachVerein.get(club.id);
            if (!kader || !kader.length) return;
            const ist = kader.reduce((s, p) => s + (p.wage || 0), 0);
            const ziel = this.gehaltsbudgetJeSpieltag(club, state);
            if (!(ist > 0) || !(ziel > 0)) return;
            const quote = ist / ziel;
            if (quote <= this.GEHALT_GRENZE) return;
            const faktor = Math.sqrt(1 / quote);
            kader.forEach(p => { p.wage = Math.max(120, Math.round((p.wage || 0) * faktor / 10) * 10); });
            angepasst++;
        });
        return angepasst;
    },

    /**
     * Unterhalt für Stadion und Infrastruktur je Spieltag
     *
     * Zwei Dinge machen den Unterhalt zu einer echten Last:
     *
     * Er wächst quadratisch mit der Größe. Ein Stadion für achtzigtausend
     * kostet mehr als vier für zwanzigtausend - Sicherheitsdienst, Rasen,
     * Beleuchtung, Sanitär skalieren nicht linear. Wer alles auf Stufe fünf
     * baut, zahlt dafür jeden Spieltag.
     *
     * Und was verfällt, kostet mehr, nicht weniger. Flickwerk an einer maroden
     * Anlage ist teurer als die Pflege einer intakten. Das ist der Grund, eine
     * Sanierung nicht ewig aufzuschieben.
     */
    maintenancePerMatchday(club, state = null) {
        if (!club) return 0;
        const faktor = this.LEVEL_ECONOMY[club.level || 1] ?? 0.05;

        const fac = (typeof FacilityEngine !== "undefined" && FacilityEngine)
            ? FacilityEngine
            : ((typeof window !== "undefined" && window.FacilityEngine) ? window.FacilityEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./facilityEngine.js").FacilityEngine; } catch (e) { return null; } })() : null));

        if (fac && Array.isArray(fac.ANLAGEN)) {
            const anlagen = fac.hole(club, state?.seasonYear || 1);
            let summe = 0;
            fac.ANLAGEN.forEach(key => {
                const a = anlagen?.[key];
                if (!a) return;
                const flickwerk = 1 + (100 - Math.max(0, Math.min(100, a.zustand))) / 100 * 0.55;
                summe += a.stufe * a.stufe * 1500 * flickwerk;
            });
            return Math.round(summe * faktor);
        }

        const stufen = club.facilities ? Object.values(club.facilities).reduce((a, b) => a + b, 0) : 5;
        return Math.round(stufen * 25000 * faktor);
    },

    /**
     * Erfasst eine Finanztransaktion im Vereinsbuch
     */
    recordTransaction(state, clubId, type, amount, description) {
        if (!state) return null;
        if (!state.finances) state.finances = { transactions: [] };
        if (!Array.isArray(state.finances.transactions)) state.finances.transactions = [];

        // Das Buchungsjournal zeigt ausschließlich den eigenen Verein. Mit 218
        // Vereinen in der Welt würden pro Spieltag über 650 fremde Buchungen
        // anfallen und die eigenen Einträge aus dem Journal verdrängen.
        if (state.userClubId && clubId !== state.userClubId) return null;

        const txn = {
            id: "txn_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            clubId: clubId,
            date: `Saison ${state.seasonYear || 1}, Spieltag ${state.currentMatchday || 1}`,
            matchday: state.currentMatchday || 1,
            season: state.seasonYear || 1,
            type: type, // 'ticket_income', 'sponsor_income', 'wages', 'staff_wages', 'transfer_in', 'transfer_out', 'facility_cost', 'bonus'
            amount: amount,
            description: description || ""
        };

        state.finances.transactions.unshift(txn);

        // Historie begrenzen
        if (state.finances.transactions.length > 300) {
            state.finances.transactions = state.finances.transactions.slice(0, 300);
        }

        return txn;
    },

    /**
     * Berechnet die Ticketeinnahmen und Zuschauerzahl für ein Heimspiel
     */
    applyMatchdayIncome(state, match) {
        if (!state || !match) return 0;
        const homeClub = state.clubs.find(c => c.id === match.homeClubId);
        const awayClub = state.clubs.find(c => c.id === match.awayClubId);
        if (!homeClub) return 0;

        // C4: Auslastung abhängig von Reputation, Tabellenplatz, Form, fanMood, Stadionstufe
        const repFactor = ((homeClub.reputation || 70) * 1.2 + (awayClub?.reputation || 60) * 0.8) / 200;
        const stadiumLevel = (typeof FacilityEngine !== "undefined" && FacilityEngine?.stufeGerundet)
            ? FacilityEngine.stufeGerundet(homeClub, "stadium", state.seasonYear || 1)
            : (homeClub.facilities?.stadium || 2);
        const stadiumBonus = (stadiumLevel - 1) * 0.03;
        const moodFactor = ((state.fanMood || 75) - 50) / 250; // -0.1 bis +0.2

        const ticketPrice = homeClub.ticketPrice || 35;
        // Preis-Elastizität: Höherer Preis senkt Auslastung, tieferer Preis füllt das Stadion
        const priceFactor = 1.0 - ((ticketPrice - 35) / 100) * 0.6;

        let baseAttendancePct = 0.62 + (repFactor * 0.2) + stadiumBonus + moodFactor;
        baseAttendancePct *= Math.max(0.4, Math.min(1.2, priceFactor));

        // Das Stadion atmet mit der Saison. Vorher war ein Spitzenverein immer
        // ausverkauft - beim Derby genauso wie beim Kellerduell im Februar.
        const gruende = [];

        // Wie läuft es gerade? Eine Serie füllt das Haus, eine Krise leert es.
        const form = (homeClub.form || []).filter(r => r && r !== "-").slice(-5);
        if (form.length >= 3) {
            const siege = form.filter(r => r === "W").length;
            const pleiten = form.filter(r => r === "L").length;
            const formEffekt = (siege - pleiten) * 0.025;
            baseAttendancePct += formEffekt;
            if (formEffekt >= 0.05) gruende.push("gute Form");
            else if (formEffekt <= -0.05) gruende.push("sportliche Krise");
        }

        // Ein Spitzenspiel zieht, ein Duell zweier Abstiegskandidaten nicht
        const tabelle = state.standingsByLeague?.[homeClub.leagueId] || state.standings || [];
        const platz = (id) => {
            const i = tabelle.findIndex(e => e.clubId === id);
            return i === -1 ? null : i + 1;
        };
        const eigenerPlatz = platz(homeClub.id);
        const gegnerPlatz = awayClub ? platz(awayClub.id) : null;
        if (eigenerPlatz !== null && gegnerPlatz !== null && tabelle.length > 4) {
            const spitzenNaehe = 1 - ((eigenerPlatz + gegnerPlatz) / 2) / tabelle.length;
            baseAttendancePct += (spitzenNaehe - 0.5) * 0.12;
            if (eigenerPlatz <= 3 && gegnerPlatz <= 3) gruende.push("Spitzenspiel");
        }

        // Und dann gibt es Spiele, die immer voll sind
        const rivalry = _feResolve("RivalryEngine", "./rivalryEngine.js");
        if (match.isDerby && rivalry && typeof rivalry.matchdayEffects === "function") {
            baseAttendancePct += rivalry.matchdayEffects(match).zuschauerBonus;
            gruende.push(match.derbyTitle || "Derby");
        }

        const randVariation = (Math.random() * 0.08) - 0.04;
        const finalPct = Math.min(1.0, Math.max(0.3, baseAttendancePct + randVariation));

        // Waehrend eines Stadionumbaus fehlen Raenge - Barcelona spielte
        // waehrend der Sanierung des Camp Nou vor der halben Kulisse.
        const facEngine = (typeof FacilityEngine !== "undefined" && FacilityEngine)
            ? FacilityEngine
            : ((typeof window !== "undefined" && window.FacilityEngine) ? window.FacilityEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./facilityEngine.js").FacilityEngine; } catch (e) { return null; } })() : null));

        const capacity = (facEngine && typeof facEngine.verfuegbareKapazitaet === "function")
            ? facEngine.verfuegbareKapazitaet(homeClub, state.seasonYear || 1)
            : (homeClub.capacity || 30000);
        const attendance = Math.min(capacity, Math.round(capacity * finalPct));
        const ticketIncome = Math.round(attendance * ticketPrice);

        homeClub.balance = (homeClub.balance || 0) + ticketIncome;
        match.attendance = attendance;
        match.ticketIncome = ticketIncome;
        match.attendancePct = Math.round(finalPct * 100);
        match.attendanceReason = gruende.join(", ") || null;
        match.soldOut = attendance >= capacity;

        this.recordTransaction(
            state,
            homeClub.id,
            "ticket_income",
            ticketIncome,
            `Ticketeinnahmen Heimspiel vs. ${awayClub?.name || 'Gegner'} (${attendance.toLocaleString('de-DE')} Zuschauer zu ${ticketPrice} €`
                + (match.soldOut ? ", ausverkauft" : `, ${match.attendancePct} % Auslastung`) + ")"
        );

        return ticketIncome;
    },

    /**
     * Verbucht wöchentliche Gehälter, Sponsoring und Unterhaltskosten aller Vereine
     */
    applyWeeklyCosts(state) {
        if (!state || !Array.isArray(state.clubs)) return;

        // Gehälter einmal je Verein aufsummieren statt für jeden der
        // dreihundert Vereine erneut durch alle viertausendachthundert Spieler
        // zu laufen.
        const lohnsumme = new Map();
        const kadergroesse = new Map();
        (state.players || []).forEach(p => {
            if (!p || !p.clubId) return;
            // Ein Leihspieler kostet beide Vereine - nach vereinbartem Anteil
            const anteil = p.leihe ? Math.max(0, Math.min(1, p.leihe.lohnAnteil ?? 1)) : 1;
            lohnsumme.set(p.clubId, (lohnsumme.get(p.clubId) || 0) + (p.wage || 10000) * anteil);
            if (p.leihe && anteil < 1) {
                const stamm = p.leihe.stammvereinId;
                lohnsumme.set(stamm, (lohnsumme.get(stamm) || 0) + (p.wage || 10000) * (1 - anteil));
            }
            kadergroesse.set(p.clubId, (kadergroesse.get(p.clubId) || 0) + 1);
        });

        state.clubs.forEach(club => {
            // 1. Sponsoreneinnahmen
            const sponsorIncome = this.sponsorPerMatchday(club);
            club.balance = (club.balance || 0) + sponsorIncome;
            this.recordTransaction(
                state, 
                club.id, 
                "sponsor_income", 
                sponsorIncome, 
                `Sponsorenzahlung Spieltag ${state.currentMatchday}`
            );

            // 2. Spielergehälter
            const totalWeeklyWages = lohnsumme.get(club.id) || 0;
            const anzahlSpieler = kadergroesse.get(club.id) || 0;
            club.balance -= totalWeeklyWages;

            this.recordTransaction(
                state,
                club.id,
                "wages",
                -totalWeeklyWages,
                `Spielergehälter Spieltag ${state.currentMatchday} (${anzahlSpieler} Spieler)`
            );

            // 3. Stadion- & Infrastrukturunterhalt
            const maintenanceCosts = this.maintenancePerMatchday(club, state);
            club.balance -= maintenanceCosts;

            this.recordTransaction(
                state,
                club.id,
                "facility_cost",
                -maintenanceCosts,
                `Infrastruktur- und Stadionunterhalt`
            );

            // 4. Betriebsaufwand: Trainerstab, Verwaltung, Nachwuchsabteilung,
            //    Reisen, Spieltagsorganisation. Ohne diesen Posten kannte die
            //    Bilanz jedes Vereins nur eine Richtung - nach fünf Saisons
            //    saß selbst der Landesligist auf einem Millionenpolster.
            const ticketSchnitt = Math.round((club.stadiumCapacity || club.capacity || 20000) * 0.8 * (club.ticketPrice || 35) / 2);
            let operatingCosts = Math.round(
                (sponsorIncome + ticketSchnitt) * this.operatingShare(club)
                + totalWeeklyWages * this.OPERATING_WAGE_SHARE);

            // 4a. Der eigene Trainerstab wird mit seinen echten Gehältern
            //     bezahlt - wer teuer verpflichtet, zahlt mehr, wer spart,
            //     spart. Der übliche Stabsanteil geht dafür aus dem
            //     Betriebsaufwand heraus, ein durchschnittlicher Stab kostet
            //     also so viel wie bisher.
            const vorbereitung = club.staff ? _feResolve("PreseasonEngine", "./preseasonEngine.js") : null;
            if (vorbereitung && typeof vorbereitung.stabLohnsumme === "function") {
                // Verträge aus der Zeit der alten Gehaltsformel vorher umrechnen
                if (typeof vorbereitung.rechneStabGehaelterUm === "function") vorbereitung.rechneStabGehaelterUm(state);
                const stabLohn = vorbereitung.stabLohnsumme(club);
                club.balance -= stabLohn;
                this.recordTransaction(state, club.id, "staff_wages", -stabLohn, "Trainerstab (Gehälter)");
                operatingCosts = Math.max(Math.round(operatingCosts * 0.5),
                    operatingCosts - vorbereitung.erwarteteStabKosten(club));
            }
            club.balance -= operatingCosts;

            this.recordTransaction(
                state,
                club.id,
                "operating_cost",
                -operatingCosts,
                club.staff ? "Betriebsaufwand (Verwaltung, Nachwuchs, Reisen)" : "Betriebsaufwand (Stab, Verwaltung, Nachwuchs, Reisen)"
            );

            // 5. Notbremse: Kein Verein rutscht unbegrenzt ins Minus. Wird die
            //    Schuldengrenze gerissen, springt der Vorstand ein - dafür ist
            //    der Transferetat für den Rest der Saison aufgebraucht.
            const schuldengrenze = -Math.round(sponsorIncome * 12);
            if ((club.balance || 0) < schuldengrenze) {
                const hilfe = schuldengrenze - club.balance;
                club.balance = schuldengrenze;
                club.transferBudget = 0;

                this.recordTransaction(
                    state,
                    club.id,
                    "board_support",
                    hilfe,
                    `Kapitalspritze des Vorstands - der Transferetat ist gestrichen`
                );

                if (club.id === state.userClubId && Array.isArray(state.inbox)) {
                    const schonGemeldet = state.inbox.some(m => m.type === "finance_warning" && m.matchday === state.currentMatchday);
                    if (!schonGemeldet) {
                        state.inbox.unshift({
                            id: Date.now() + 31,
                            matchday: state.currentMatchday,
                            date: state.currentDate || `Spieltag ${state.currentMatchday}`,
                            sender: "Vorstand",
                            subject: "⚠️ Der Verein ist an der Schuldengrenze",
                            body: `Wir mussten Geld nachschießen, um den Spielbetrieb zu sichern. Der Transferetat ist gestrichen, bis die Bilanz wieder stimmt.\n\nSenken Sie die Gehaltslast, verkaufen Sie Spieler oder erhöhen Sie die Einnahmen.`,
                            read: false,
                            type: "finance_warning"
                        });
                    }
                }
            }
        });
    },

    /**
     * Budgets umschichten: Was im Gehaltsetat frei ist, lässt sich ins
     * Transferbudget schieben - und umgekehrt. Der Kurs sind die Wochen bis
     * zum Saisonwechsel: Ein Euro Wochengehalt ist für den Rest der Saison
     * so viel wert. Die Umschichtung gilt für diese Saison; zum Wechsel steht
     * der Gehaltsetat wieder dort, wo der Vorstand ihn haben will. Vorher
     * lagen beide Budgets fest - wer Platz in der Gehaltsliste hatte, konnte
     * ihn für keinen Transfer nutzen.
     */
    UMSCHICHTEN: { minWochen: 4, maxWochen: 52 },

    /** Laufende Wochengehälter eines Vereins (Leihen anteilig) */
    wochengehaelter(state, club) {
        const s = this.getFinanceSummary(state, club?.id);
        return s ? s.currentWeeklyWages : 0;
    },

    /** Wochen bis zum Saisonwechsel - danach richtet sich der Kurs */
    restWochen(state) {
        const U = this.UMSCHICHTEN;
        const kalender = Array.isArray(state?.calendar) ? state.calendar : null;
        if (!kalender || !kalender.length) return 26;
        const tage = Math.max(0, kalender.length - 1 - (state.currentDayIndex || 0));
        return Math.max(U.minWochen, Math.min(U.maxWochen, Math.round(tage / 7)));
    },

    /** Wie viel sich gerade in welche Richtung schieben lässt */
    umschichtSpielraum(state, club = null) {
        club = club || (state?.clubs || []).find(c => c.id === state?.userClubId);
        if (!club) return null;
        const wochen = this.restWochen(state);
        const gehaelter = this.wochengehaelter(state, club);
        return {
            wochen,
            gehaelter,
            gehaltFrei: Math.max(0, Math.floor((club.wageBudget || 0) - gehaelter)),
            transferMoeglich: Math.max(0, Math.floor((club.transferBudget || 0) / wochen)),
            umgeschichtet: club.budgetUmschichtung && club.budgetUmschichtung.saison === state.seasonYear ? club.budgetUmschichtung.jeWoche : 0
        };
    },

    /**
     * jeWoche > 0: vom Gehaltsetat ins Transferbudget, < 0: umgekehrt.
     * Gibt { ok, transfer, jeWoche, wochen } oder { ok: false, grund } zurück.
     */
    schichteUm(state, jeWoche) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const raum = this.umschichtSpielraum(state, club);
        const betrag = Math.round(Number(jeWoche) || 0);
        if (!club || !raum) return { ok: false, grund: "Kein Verein." };
        if (!betrag) return { ok: false, grund: "Kein Betrag angegeben." };
        if (betrag > raum.gehaltFrei) {
            return { ok: false, grund: `Im Gehaltsetat sind nur ${this.geld(raum.gehaltFrei)} pro Woche frei - die laufenden Verträge müssen bezahlt bleiben.` };
        }
        if (-betrag > raum.transferMoeglich) {
            return { ok: false, grund: `Dafür reicht das Transferbudget nicht: ${this.geld(-betrag)} pro Woche kosten bis zum Saisonwechsel ${this.geld(-betrag * raum.wochen)}.` };
        }
        const transfer = betrag * raum.wochen;
        club.wageBudget = Math.round((club.wageBudget || 0) - betrag);
        club.transferBudget = Math.round((club.transferBudget || 0) + transfer);
        const bisher = club.budgetUmschichtung && club.budgetUmschichtung.saison === state.seasonYear ? club.budgetUmschichtung.jeWoche : 0;
        club.budgetUmschichtung = { saison: state.seasonYear, jeWoche: bisher + betrag };
        return { ok: true, transfer, jeWoche: betrag, wochen: raum.wochen };
    },

    /** Zum Saisonwechsel: Der Gehaltsetat kommt zurück, wo er vor der Umschichtung war */
    budgetZuruecksetzen(state) {
        (state?.clubs || []).forEach(club => {
            const u = club.budgetUmschichtung;
            if (!u || u.saison >= (state.seasonYear || 0)) return;
            club.wageBudget = Math.round((club.wageBudget || 0) + (u.jeWoche || 0));
            delete club.budgetUmschichtung;
        });
    },

    // ------------------------------------------------ Ablöse in Raten
    //
    // Eine Ablöse muss nicht auf einmal fließen: Ein Teil wird sofort fällig,
    // der Rest in Monatsraten. Der Käufer schont damit sein Budget, der
    // Verkäufer wartet auf sein Geld - und rechnet deshalb mit einem
    // Abschlag. Wer knapp bei Kasse ist, braucht das Geld jetzt und rechnet
    // mit einem größeren.

    ZAHLWEISEN: {
        sofort: { label: "Sofort", anzahlung: 1, monate: 0, abschlag: 0 },
        raten12: { label: "Raten über 12 Monate", anzahlung: 0.5, monate: 12, abschlag: 0.08 },
        raten24: { label: "Raten über 24 Monate", anzahlung: 0.35, monate: 24, abschlag: 0.15 }
    },

    /** Zusätzlicher Abschlag auf die Raten, wenn der Verkäufer das Geld dringend braucht */
    RATEN_ABSCHLAG_KNAPP: 0.1,

    zahlweise(key) {
        return this.ZAHLWEISEN[key] ? key : "sofort";
    },

    /** Anzahlung, Monatsrate und Zahl der Raten einer Ablöse */
    ratenPlan(fee, zahlweise) {
        const z = this.ZAHLWEISEN[this.zahlweise(zahlweise)];
        const betrag = Math.max(0, Math.round(Number(fee) || 0));
        if (!z.monate || !betrag) return { zahlweise: "sofort", anzahlung: betrag, rate: 0, monate: 0, rest: 0 };
        const anzahlung = Math.round(betrag * z.anzahlung);
        const rest = betrag - anzahlung;
        return { zahlweise: this.zahlweise(zahlweise), anzahlung, rate: Math.round(rest / z.monate), monate: z.monate, rest };
    },

    /** Braucht der Verkäufer das Geld sofort? */
    istKnapp(verkaeufer, fee) {
        return !!verkaeufer && (verkaeufer.balance || 0) < fee * 0.5;
    },

    /** Was eine Ablöse in dieser Zahlweise dem Verkäufer heute wert ist */
    ratenWert(fee, zahlweise, verkaeufer = null) {
        const plan = this.ratenPlan(fee, zahlweise);
        if (!plan.monate) return plan.anzahlung;
        const z = this.ZAHLWEISEN[plan.zahlweise];
        const abschlag = z.abschlag + (this.istKnapp(verkaeufer, fee) ? this.RATEN_ABSCHLAG_KNAPP : 0);
        return Math.round(plan.anzahlung + plan.rest * (1 - abschlag));
    },

    /** "50 % sofort, Rest in 12 Monatsraten zu je 1,2 Mio. €" */
    ratenText(fee, zahlweise) {
        const plan = this.ratenPlan(fee, zahlweise);
        if (!plan.monate) return "sofort fällig";
        return `${this.geld(plan.anzahlung)} sofort, Rest in ${plan.monate} Monatsraten zu je ${this.geld(plan.rate)}`;
    },

    /** "08.2026" aus "15.08.2026" */
    _monat(datum) {
        const m = /^\d{1,2}\.(\d{1,2})\.(\d{4})$/.exec(String(datum || ""));
        return m ? `${m[1].padStart(2, "0")}.${m[2]}` : null;
    },

    /** Eine Ratenvereinbarung anlegen - nur, wo der eigene Verein beteiligt ist */
    legeRatenAn(state, { zahlerId, empfaengerId, player, fee, zahlweise }) {
        const plan = this.ratenPlan(fee, zahlweise);
        if (!state || !plan.monate || !zahlerId || !empfaengerId) return null;
        if (zahlerId !== state.userClubId && empfaengerId !== state.userClubId) return null;
        if (!Array.isArray(state.ratenzahlungen)) state.ratenzahlungen = [];
        if (!state.ratenMonat) state.ratenMonat = this._monat(state.currentDate);
        const eintrag = {
            id: `rate_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            zahlerId, empfaengerId,
            playerId: player?.id ?? null, playerName: player?.name || "Spieler",
            gesamt: Math.round(fee), rate: plan.rate, offen: plan.rest,
            monate: plan.monate, gezahlt: 0
        };
        state.ratenzahlungen.push(eintrag);
        return eintrag;
    },

    /** Offene Raten des eigenen Vereins: was wir schulden, was uns zusteht */
    ratenUebersicht(state, clubId = state?.userClubId) {
        const liste = (Array.isArray(state?.ratenzahlungen) ? state.ratenzahlungen : [])
            .filter(r => r.offen > 0 && (r.zahlerId === clubId || r.empfaengerId === clubId))
            .map(r => {
                const wir = r.zahlerId === clubId;
                const andererId = wir ? r.empfaengerId : r.zahlerId;
                const anderer = (state.clubs || []).find(c => c.id === andererId);
                return {
                    ...r, richtung: wir ? "zahlen" : "erhalten",
                    verein: anderer ? anderer.name : "unbekannt",
                    restRaten: r.monate - r.gezahlt
                };
            });
        const summe = (richtung) => liste.filter(r => r.richtung === richtung).reduce((s, r) => s + r.offen, 0);
        const monat = (richtung) => liste.filter(r => r.richtung === richtung)
            .reduce((s, r) => s + (r.restRaten <= 1 ? r.offen : Math.min(r.rate, r.offen)), 0);
        return {
            liste,
            schulden: summe("zahlen"), forderungen: summe("erhalten"),
            naechsterMonat: { zahlen: monat("zahlen"), erhalten: monat("erhalten") }
        };
    },

    /**
     * Am Monatsersten sind die Raten fällig. Wird jeden Tag gerufen und
     * bucht nur beim Monatswechsel. Liefert die Zeile für den Tagesbericht,
     * wenn der eigene Verein gezahlt oder bekommen hat - sonst null.
     */
    zahleRaten(state, datum = state?.currentDate) {
        const monat = this._monat(datum);
        if (!state || !monat) return null;
        if (!state.ratenMonat) { state.ratenMonat = monat; return null; }
        if (state.ratenMonat === monat) return null;
        state.ratenMonat = monat;
        const liste = Array.isArray(state.ratenzahlungen) ? state.ratenzahlungen : [];
        if (!liste.length) return null;

        let gezahlt = 0, erhalten = 0;
        liste.forEach(r => {
            if (!(r.offen > 0)) return;
            const zahler = (state.clubs || []).find(c => c.id === r.zahlerId);
            const empfaenger = (state.clubs || []).find(c => c.id === r.empfaengerId);
            const letzte = r.monate - r.gezahlt <= 1;
            const betrag = letzte ? r.offen : Math.min(r.rate, r.offen);
            r.offen -= betrag;
            r.gezahlt += 1;
            const text = `Rate ${r.gezahlt}/${r.monate}: ${r.playerName}`;
            if (zahler) {
                zahler.balance = (zahler.balance || 0) - betrag;
                zahler.transferBudget = Math.max(0, (zahler.transferBudget || 0) - betrag);
                this.recordTransaction(state, zahler.id, "transfer_out", -betrag, `Ablöse ${text}`);
            }
            if (empfaenger) {
                empfaenger.balance = (empfaenger.balance || 0) + betrag;
                empfaenger.transferBudget = (empfaenger.transferBudget || 0) + Math.round(betrag * 0.85);
                this.recordTransaction(state, empfaenger.id, "transfer_in", betrag, `Ablöse ${text}`);
            }
            if (r.zahlerId === state.userClubId) gezahlt += betrag;
            if (r.empfaengerId === state.userClubId) erhalten += betrag;
        });
        state.ratenzahlungen = liste.filter(r => r.offen > 0);
        if (!gezahlt && !erhalten) return null;
        const teile = [];
        if (gezahlt) teile.push(`${this.geld(gezahlt)} gezahlt`);
        if (erhalten) teile.push(`${this.geld(erhalten)} erhalten`);
        return `💶 Ablöseraten: ${teile.join(", ")}.`;
    },

    geld(betrag) {
        const gs = _feResolve("GameState", "./gameState.js");
        if (gs && typeof gs.formatMoney === "function") return gs.formatMoney(betrag);
        return `${Math.round(betrag)} €`;
    },

    /**
     * Erstellt eine detaillierte Finanzübersicht für einen Verein
     */
    getFinanceSummary(state, clubId) {
        if (!state) return null;
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return null;

        const clubPlayers = state.players.filter(p => p.clubId === clubId);
        // Leihspieler zählen anteilig - beim Leihverein und beim Stammverein
        const anteil = (p) => p.leihe ? Math.max(0, Math.min(1, p.leihe.lohnAnteil ?? 1)) : 1;
        const weeklyWages = clubPlayers.reduce((sum, p) => sum + (p.wage || 0) * anteil(p), 0)
            + state.players.filter(p => p.leihe && p.leihe.stammvereinId === clubId)
                .reduce((sum, p) => sum + (p.wage || 0) * (1 - anteil(p)), 0);
        const sponsorPerWeek = this.sponsorPerMatchday(club);
        const estTicketPerMatch = Math.round((club.stadiumCapacity || club.capacity || 30000) * 0.85 * (club.ticketPrice || 35));

        const txns = (state.finances?.transactions || []).filter(t => t.clubId === clubId);

        return {
            balance: club.balance || 0,
            transferBudget: club.transferBudget || 0,
            wageBudget: club.wageBudget || 0,
            currentWeeklyWages: weeklyWages,
            wageBudgetRemaining: (club.wageBudget || 0) - weeklyWages,
            estimatedWeeklyIncome: sponsorPerWeek + Math.round(estTicketPerMatch / 2),
            estimatedWeeklyExpenses: weeklyWages + 100000,
            transactions: txns.slice(0, 20)
        };
    }
};

if (typeof window !== "undefined") {
    window.FinanceEngine = FinanceEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FinanceEngine };
}
