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
     *
     * Über eine ganze Saison gemessen reichte das noch nicht: Von der zweiten
     * bis zur siebten Liga blieben jedem Verein 12 bis 17 % seines Umsatzes
     * (Sponsor, Eintritt, Prämien gegen Gehälter, Unterhalt und Betrieb). Nach
     * fünf Saisons hatte ein Sechstligist das Vierzehnfache seines
     * Startguthabens auf dem Konto, ein Drittligist das Neunfache - und mit dem
     * Konto wuchs der Transferetat, mit dem Etat die Stärke der unteren Ligen.
     * Jetzt bleiben dort rund 3 bis 5 % übrig.
     */
    OPERATING_COST_BY_LEVEL: { 1: 0.24, 2: 0.45, 3: 0.55, 4: 0.65, 5: 0.67, 6: 0.74, 7: 0.78 },

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
    OPERATING_WAGE_SHARE: 0.05,

    /**
     * Erfolgsprämien: Je Ligasieg bekommt die Mannschaft ein Viertel, je
     * Remis acht Prozent der Lohnsumme eines Spieltags, der Meister am
     * Saisonende das Anderthalbfache (seasonEngine, Tabellenprämie).
     *
     * Vorher kostete Erfolg nichts: Der stärkste Verein jeder Liga legte in
     * einer Saison 28 bis 31 % seines Umsatzes zurück, das Mittelfeld 0 bis
     * 15 %. Im Mittel gewinnt ein Verein gut ein Drittel seiner Spiele - das
     * kostet rund 11 % der Lohnsumme. Um genau so viel ist der Anteil des
     * Betriebsaufwands an den Gehältern gesunken (OPERATING_WAGE_SHARE von
     * 0,16 auf 0,05): Der Durchschnittsverein steht wie vorher da, wer viel
     * gewinnt, zahlt mehr, wer wenig gewinnt, spart.
     */
    ERFOLGSPRAEMIE: { sieg: 0.25, remis: 0.08, meister: 1.5 },

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
        fr: { sockel: 0.5, spanne: 0.75 },
        // Die Länder im Hintergrund: Wenige große Vereine, dahinter wenig
        // Fernsehgeld (Umsatz je Erstligist zwischen gut 10 und 45 Mio. EUR)
        nl: { sockel: 0.12, spanne: 0.42 },
        pt: { sockel: 0.1, spanne: 0.42 },
        tr: { sockel: 0.14, spanne: 0.4 },
        br: { sockel: 0.14, spanne: 0.38 },
        be: { sockel: 0.1, spanne: 0.3 },
        at: { sockel: 0.07, spanne: 0.24 },
        ch: { sockel: 0.07, spanne: 0.24 },
        sc: { sockel: 0.06, spanne: 0.28 }
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

    /**
     * Die kommerziellen Einnahmen eines Vereins je Spieltag: Sponsoren,
     * Vermarktung und Fanartikel zusammen, nach Liga, Land und Rang.
     */
    kommerzBasis(club) {
        if (!club) return 0;
        const faktor = this.LEVEL_ECONOMY[club.level || 1] ?? 0.05;
        const rang = typeof club.clubStrength === "number"
            ? Math.max(0, Math.min(1, club.clubStrength))
            : 0.5;
        const land = this.landWirtschaft(club.countryId);
        return Math.round((this.SPONSOR_SOCKEL * land.sockel + Math.pow(rang, this.SPONSOR_KURVE) * this.SPONSOR_SPANNE * land.spanne) * faktor);
    },

    /** Sponsorenzahlung eines Vereins je Spieltag - ohne die Fanartikel */
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
        return Math.round(this.kommerzBasis(club) * (1 - this.FANARTIKEL.anteil));
    },

    /**
     * Fanartikel: Trikots, Schals, der Fanshop.
     *
     * Bisher steckten sie unsichtbar in der Sponsorenzahlung - ein Star im
     * Kader oder eine Meistersaison änderten daran nichts. Jetzt sind sie
     * ein eigener Posten: rund ein Achtel der kommerziellen Einnahmen, und wie
     * viel davon ankommt, hängt am Verein. Der Tabellenplatz zählt, die
     * Stimmung der eigenen Fans, und vor allem die Stars: Wer weit über dem
     * Niveau seiner Liga spielt, verkauft Trikots. Ein großer Neuzugang
     * bringt einige Wochen lang einen Schub.
     *
     * Im Schnitt einer Liga kommt so viel herein wie vorher; zusammen mit
     * der um denselben Anteil kleineren Sponsorenzahlung bleibt die Bilanz
     * der Welt, wie sie war. Der Spitzenverein mit Stars verkauft bis zum
     * Doppelten, der Abstiegskandidat ohne Namen gut die Hälfte.
     */
    FANARTIKEL: {
        anteil: 0.12,
        sockel: 0.74,
        tabelle: 0.3,
        /** Ab so vielen Punkten über dem Ligaschnitt zieht ein Spieler, je Punkt so viel, je Spieler höchstens */
        starAb: 4, jePunkt: 0.025, jeSpielerMax: 0.16, starsMax: 0.5,
        stimmung: 0.004,
        neuzugang: { plus: 0.35, tage: 56, abSterne: 0.1 },
        min: 0.45, max: 2.2
    },

    /** Was die Fanartikel bei einem durchschnittlichen Verein dieser Größe bringen */
    fanartikelBasis(club) {
        return Math.round(this.kommerzBasis(club) * this.FANARTIKEL.anteil);
    },

    /** Kommerzielle Einnahmen je Spieltag: Sponsor plus die übliche Summe aus Fanartikeln */
    kommerzJeSpieltag(club) {
        return this.sponsorPerMatchday(club) + this.fanartikelBasis(club);
    },

    /** Das Niveau einer Liga (beste Elf je Verein), wie es beim Anlegen der Welt war */
    _ligaNiveau(state, leagueId) {
        if (!state.ligaNiveau || typeof state.ligaNiveau !== "object") {
            const welt = _feResolve("WorldGenerator", "./worldGenerator.js");
            state.ligaNiveau = welt && typeof welt.ligaNiveau === "function" ? welt.ligaNiveau(state) : {};
        }
        return state.ligaNiveau[leagueId];
    },

    /** Wie sehr ein Spieler im Fanshop zieht (0 = gar nicht) */
    zugkraft(player, niveau) {
        const F = this.FANARTIKEL;
        if (!player || typeof niveau !== "number") return 0;
        const ueber = (player.overall || 0) - niveau - F.starAb;
        return ueber > 0 ? Math.min(F.jeSpielerMax, ueber * F.jePunkt) : 0;
    },

    /**
     * Der Faktor auf die Fanartikel-Basis. sterne: die Summe der Zugkraft
     * im Kader (sonst wird sie hier gezählt).
     */
    fanartikelFaktor(state, club, sterne = null) {
        const F = this.FANARTIKEL;
        if (!club) return 1;
        if (sterne === null) {
            const niveau = this._ligaNiveau(state, club.leagueId);
            const ids = new Set(club.playerIds || []);
            sterne = (state.players || []).filter(p => ids.has(p.id))
                .reduce((s, p) => s + this.zugkraft(p, niveau), 0);
        }
        let f = F.sockel + Math.min(F.starsMax, sterne);
        const tabelle = (state.standingsByLeague || {})[club.leagueId] || [];
        const i = tabelle.findIndex(z => z.clubId === club.id);
        const platz = i >= 0 && tabelle.length > 1 && (tabelle[i].played || 0) >= 3
            ? 1 - i / (tabelle.length - 1)
            : (typeof club.clubStrength === "number" ? club.clubStrength : 0.5);
        f += F.tabelle * platz;
        if (club.id === state.userClubId) f += ((state.fanMood ?? 70) - 70) * F.stimmung;
        const e = club.trikotEffekt;
        const heute = state.currentDayIndex || 0;
        if (e && heute < e.bisTag) f += e.plus * (e.bisTag - heute) / F.neuzugang.tage;
        return Math.max(F.min, Math.min(F.max, f));
    },

    /** Fanartikel-Einnahmen eines Vereins für einen Spieltag */
    fanartikelJeSpieltag(state, club, sterne = null) {
        return Math.round(this.fanartikelBasis(club) * this.fanartikelFaktor(state, club, sterne));
    },

    /** Das meistverkaufte Trikot im Kader: der Spieler mit der größten Zugkraft */
    bestseller(state, club) {
        if (!club) return null;
        const niveau = this._ligaNiveau(state, club.leagueId);
        const ids = new Set(club.playerIds || []);
        const heute = state.currentDayIndex || 0;
        const e = club.trikotEffekt && heute < club.trikotEffekt.bisTag ? club.trikotEffekt : null;
        let bester = null;
        (state.players || []).forEach(p => {
            if (!ids.has(p.id)) return;
            const wert = this.zugkraft(p, niveau) + (e && String(e.playerId) === String(p.id) ? 1 : 0)
                + (p.overall || 0) / 1000;
            if (!bester || wert > bester.wert) bester = { p, wert };
        });
        return bester ? bester.p : null;
    },

    /**
     * Ein Neuzugang mit Zugkraft: Einige Wochen lang verkauft der Fanshop
     * mehr. Für den eigenen Verein gibt es eine Nachricht.
     */
    nachTransfer(state, player, club) {
        const F = this.FANARTIKEL;
        if (!state || !player || !club) return null;
        const zug = this.zugkraft(player, this._ligaNiveau(state, club.leagueId));
        if (zug < F.neuzugang.abSterne) return null;
        const heute = state.currentDayIndex || 0;
        const plus = Math.round(F.neuzugang.plus * Math.min(1, zug / F.jeSpielerMax) * 100) / 100;
        const alt = club.trikotEffekt && heute < club.trikotEffekt.bisTag ? club.trikotEffekt : null;
        if (alt && alt.plus >= plus) return null;
        club.trikotEffekt = { playerId: player.id, name: player.name, plus, bisTag: heute + F.neuzugang.tage };
        if (club.id === state.userClubId && Array.isArray(state.inbox)) {
            const extra = Math.round(this.fanartikelBasis(club) * plus);
            state.inbox.unshift({
                id: Date.now() + 41,
                matchday: state.currentMatchday,
                date: state.currentDate || `Spieltag ${state.currentMatchday}`,
                sender: "Fanshop",
                subject: `👕 Das Trikot von ${player.name} ist der Renner`,
                body: `Seit der Verpflichtung von ${player.name} stehen die Fans vor dem Fanshop Schlange. In den nächsten Wochen rechnen wir mit bis zu ${this.geld(extra)} mehr Fanartikel-Umsatz je Spieltag - danach flacht es langsam ab.`,
                read: false,
                type: "finance"
            });
        }
        return club.trikotEffekt;
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
        return Math.round(this.kommerzJeSpieltag(club) + ticket);
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

    /** Gewicht des letzten Heimspiels im gleitenden Ticketschnitt */
    TICKET_SCHNITT_GEWICHT: 0.2,

    /** Eintritt je Spieltag (jedes zweite ist ein Heimspiel): gemessen oder, solange es keinen Schnitt gibt, geschätzt */
    ticketJeSpieltag(club) {
        if (!club) return 0;
        if (typeof club.ticketSchnitt === "number") return Math.round(club.ticketSchnitt / 2);
        return Math.round((club.stadiumCapacity || club.capacity || 20000) * 0.8 * (club.ticketPrice || 35) / 2);
    },

    /**
     * Was ein Spieler mindestens bekommt, je Woche. In der siebten Liga zahlt
     * ein kleiner Verein Aufwandsentschädigungen von ein paar hundert Euro im
     * Monat. Mit 120 € für jeden lag der kleinste Landesligist über dem, was
     * er einnimmt, und verlor Spieltag für Spieltag Geld.
     */
    MINDESTLOHN: { 6: 80, 7: 50 },

    mindestlohn(club) {
        return this.MINDESTLOHN[club?.level || 1] ?? 120;
    },

    /**
     * Das Gehaltsbudget, das der Vorstand freigibt: was der Verein trägt,
     * mit etwas Spielraum - und nie unter dem, was er heute schon zahlt.
     * Vorher kam das Budget aus einer festen Tabelle je Ligastufe, die
     * Gehälter aber aus den Einnahmen. In der siebten Liga lag die
     * Gehaltsliste dadurch im Schnitt bei 219 % des Budgets, in der zweiten
     * bei 116 %, und die KI-Vereine darunter konnten kaum je einen Spieler
     * kaufen.
     */
    GEHALTSRAHMEN: { spielraum: 1.1, ueberIst: 1.03 },

    gehaltsrahmen(state, club, lohnsumme = null) {
        if (!club) return 0;
        const ist = lohnsumme ?? (state?.players || []).filter(p => p.clubId === club.id && !p.leihe).reduce((s, p) => s + (p.wage || 0), 0);
        const tragbar = this.gehaltsbudgetJeSpieltag(club, state);
        return Math.round(Math.max(tragbar * this.GEHALTSRAHMEN.spielraum, ist * this.GEHALTSRAHMEN.ueberIst) / 10) * 10;
    },

    /** Das Gehaltsbudget für mehrere Vereine neu setzen (alle, wenn keine Liste) */
    setzeGehaltsrahmen(state, clubs = null) {
        if (!state || !Array.isArray(state.players)) return 0;
        const lohn = new Map();
        state.players.forEach(p => { if (p.clubId && !p.leihe) lohn.set(p.clubId, (lohn.get(p.clubId) || 0) + (p.wage || 0)); });
        const liste = clubs || state.clubs || [];
        liste.forEach(club => { club.wageBudget = this.gehaltsrahmen(state, club, lohn.get(club.id) || 0); });
        return liste.length;
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

            const boden = this.mindestlohn(club);
            kader.forEach(p => {
                p.wage = Math.max(boden, Math.round((p.wage || 0) * faktor / 10) * 10);
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
            const boden = this.mindestlohn(club);
            kader.forEach(p => { p.wage = Math.max(boden, Math.round((p.wage || 0) * faktor / 10) * 10); });
            angepasst++;
        });
        return angepasst;
    },

    /**
     * Was die KI-Vereine mit Überschüssen tun - zum Saisonwechsel.
     *
     * Der laufende Betrieb wirft Geld ab: Ein Bundesligist nahm je Saison
     * rund 53 Mio. ein (Zuschauer, Sponsor, Fanartikel) und gab 48 Mio. aus,
     * dazu kamen Prämien. Bisher floss erst ab dem Doppelten der üblichen
     * Rücklage etwas ab - die Kassen wuchsen in fünf Saisons auf das Zwei-
     * bis Dreifache, in der Bundesliga im Schnitt von 15 auf 44 Mio.
     *
     * Ein echter Verein legt Überschüsse nicht auf die hohe Kante. Was über
     * dem 1,1-Fachen der üblichen Rücklage liegt, verteilt die KI:
     * - 50 % in Anlagen und Tilgung (Stadion, Trainingsgelände, Nachwuchs,
     *   Kredite) - das Geld verlässt die Kasse
     * - 35 % zusätzlich in den Transferetat der neuen Saison
     * - und wer Geld hat, zahlt mehr Gehalt: bis zu 5 % je Saison, nie über
     *   die Grenze des Tragbaren (GEHALT_GRENZE) hinaus
     * Der eigene Verein bleibt außen vor - dort entscheidet der Manager.
     *
     * Gemessen über fünf Saisons: Der mittlere Bundesligist steht nach dem
     * Saisonwechsel bei 14 bis 23 Mio. statt bei 25 Mio. schon nach zwei
     * Saisons und weiter steigend; in England, Spanien und den kleinen
     * Ländern pendeln die Kassen ebenso um die übliche Rücklage.
     */
    INVESTITION: { ruecklage: 1.1, anlagen: 0.5, kader: 0.35, gehaltPlus: 0.05 },

    investiereUeberschuesse(state) {
        const gen = _feResolve("ClubGenerator", "./clubGenerator.js");
        if (!state || !Array.isArray(state.clubs) || !gen || typeof gen.kontostandRichtwert !== "function") return 0;
        const I = this.INVESTITION;
        const lohn = new Map(), kader = new Map();
        (state.players || []).forEach(p => {
            if (!p.clubId || p.leihe) return;
            lohn.set(p.clubId, (lohn.get(p.clubId) || 0) + (p.wage || 0));
            if (!kader.has(p.clubId)) kader.set(p.clubId, []);
            kader.get(p.clubId).push(p);
        });
        let angepasst = 0;
        state.clubs.forEach(club => {
            if (club.id === state.userClubId) return;
            club.kaderInvestition = 0;
            const ziel = gen.kontostandRichtwert(club.level || 1, club.clubStrength ?? 0.5, club.countryId) * I.ruecklage;
            const ueber = (club.balance || 0) - ziel;
            if (!(ueber > 0)) return;
            const anlagen = Math.round(ueber * I.anlagen);
            club.balance = Math.round(club.balance - anlagen);
            club.investiert = Math.round((club.investiert || 0) + anlagen);
            club.kaderInvestition = Math.round(ueber * I.kader);
            // Gehälter: höchstens 5 %, höchstens bis an die Grenze des
            // Tragbaren, und nur so viel, wie ein Viertel des Überschusses
            // über eine Saison deckt
            const jetzt = lohn.get(club.id) || 0;
            const tragbar = this.gehaltsbudgetJeSpieltag(club, state) * this.GEHALT_GRENZE;
            if (jetzt > 0 && tragbar > jetzt) {
                const faktor = Math.min(1 + I.gehaltPlus, tragbar / jetzt, 1 + (ueber * 0.25) / (jetzt * 34));
                if (faktor > 1.001) (kader.get(club.id) || []).forEach(p => { p.wage = Math.round((p.wage || 0) * faktor / 10) * 10; });
            }
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
        // Was Personal, Dienstleister und Auflagen kosten, folgt der
        // Wirtschaftskraft des Landes: Ein Stadion in Graz kostet nicht, was
        // eines in Dortmund kostet. Ohne diesen Faktor verlor der mittlere
        // Erstligist in Österreich je Spieltag ein Drittel seiner Einnahmen.
        // Nach oben bleibt es beim Maßstab der Bundesliga - mehr Fernsehgeld
        // macht den Rasen in England nicht teurer.
        const rang = typeof club.clubStrength === "number" ? club.clubStrength : 0.5;
        const land = Math.min(1, this.landFaktor(club.countryId, rang));
        const faktor = (this.LEVEL_ECONOMY[club.level || 1] ?? 0.05) * land;

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

        // Die Kaderkostenquote zählt jede Buchung des eigenen Vereins mit
        const regeln = _feResolve("FinanzregelEngine", "./finanzregelEngine.js");
        if (regeln && typeof regeln.buche === "function") regeln.buche(state, type, amount);

        const txn = {
            id: "txn_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            clubId: clubId,
            date: `Saison ${state.seasonYear || 1}, Spieltag ${state.currentMatchday || 1}`,
            matchday: state.currentMatchday || 1,
            season: state.seasonYear || 1,
            type: type, // 'ticket_income', 'sponsor_income', 'wages', 'staff_wages', 'transfer_in', 'transfer_out', 'facility_cost', 'bonus'
            // Der Kalendermonat ("2026-08") - für Einnahmen und Ausgaben des Monats
            monat: this.monatVon(state),
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
    /**
     * Lohnsumme eines Spieltags je Verein (wie in applyWeeklyCosts, Leihen nach
     * Anteil) - einmal je Tag gerechnet, nicht für jedes Spiel neu.
     */
    lohnsummen(state) {
        const stempel = `${state.seasonYear || 1}|${state.currentDayIndex || 0}|${(state.players || []).length}`;
        if (this._lohnCache && this._lohnCache.state === state && this._lohnCache.stempel === stempel) return this._lohnCache.map;
        const map = new Map();
        (state.players || []).forEach(p => {
            if (!p || !p.clubId) return;
            const anteil = p.leihe ? Math.max(0, Math.min(1, p.leihe.lohnAnteil ?? 1)) : 1;
            map.set(p.clubId, (map.get(p.clubId) || 0) + (p.wage || 10000) * anteil);
            if (p.leihe && anteil < 1 && p.leihe.stammvereinId) {
                map.set(p.leihe.stammvereinId, (map.get(p.leihe.stammvereinId) || 0) + (p.wage || 10000) * (1 - anteil));
            }
        });
        this._lohnCache = { state, stempel, map };
        return map;
    },

    /**
     * Sieg- und Remisprämie nach einem Ligaspiel, für beide Vereine
     * (ERFOLGSPRAEMIE). Liefert die gebuchten Beträge { heim, gast }.
     */
    bucheErfolgspraemie(state, match) {
        if (!state || !match || typeof match.homeGoals !== "number" || typeof match.awayGoals !== "number") return null;
        if (match.praemieGebucht) return null;
        match.praemieGebucht = true;
        const lohn = this.lohnsummen(state);
        const satz = (eigene, fremde) => eigene > fremde ? this.ERFOLGSPRAEMIE.sieg : (eigene === fremde ? this.ERFOLGSPRAEMIE.remis : 0);
        const ergebnis = {};
        [["heim", match.homeClubId, match.homeGoals, match.awayGoals, match.awayClubId],
            ["gast", match.awayClubId, match.awayGoals, match.homeGoals, match.homeClubId]].forEach(([seite, id, eigene, fremde, gegnerId]) => {
            const club = state.clubs.find(c => c.id === id);
            const betrag = club ? Math.round((lohn.get(id) || 0) * satz(eigene, fremde)) : 0;
            ergebnis[seite] = betrag;
            if (!club || betrag <= 0) return;
            club.balance = (club.balance || 0) - betrag;
            if (club.id === state.userClubId) {
                const gegner = state.clubs.find(c => c.id === gegnerId);
                this.recordTransaction(state, club.id, "bonus", -betrag,
                    `${eigene > fremde ? "Siegprämie" : "Remisprämie"} (${eigene}:${fremde} gegen ${gegner ? gegner.name : "den Gegner"})`);
            }
        });
        return ergebnis;
    },

    applyMatchdayIncome(state, match) {
        if (!state || !match) return 0;
        const homeClub = state.clubs.find(c => c.id === match.homeClubId);
        const awayClub = state.clubs.find(c => c.id === match.awayClubId);
        if (!homeClub) return 0;
        // Erfolg kostet: Sieg- und Remisprämie für beide Mannschaften
        this.bucheErfolgspraemie(state, match);

        // C4: Auslastung abhängig von Reputation, Tabellenplatz, Form, fanMood, Stadionstufe
        const repFactor = ((homeClub.reputation || 70) * 1.2 + (awayClub?.reputation || 60) * 0.8) / 200;
        const stadiumLevel = (typeof FacilityEngine !== "undefined" && FacilityEngine?.stufeGerundet)
            ? FacilityEngine.stufeGerundet(homeClub, "stadium", state.seasonYear || 1)
            : (homeClub.facilities?.stadium || 2);
        const stadiumBonus = (stadiumLevel - 1) * 0.03;
        // Die Fanstimmung im Spielstand ist die des eigenen Vereins. Vorher
        // füllte sie jedes Stadion der Welt mit: Waren die eigenen Fans
        // begeistert, kamen auch in Lens und Wigan mehr Zuschauer.
        const stimmung = homeClub.id === state.userClubId ? (state.fanMood || 75) : 75;
        const moodFactor = (stimmung - 50) / 250; // -0.1 bis +0.2

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
        const ticketIncome = Math.round(attendance * ticketPrice * this.heimspielAnteil(state, homeClub));

        homeClub.balance = (homeClub.balance || 0) + ticketIncome;
        // Was ein Heimspiel wirklich einbringt, als gleitender Schnitt - daran
        // misst sich der Betriebsaufwand (applyWeeklyCosts)
        homeClub.ticketSchnitt = Math.round(typeof homeClub.ticketSchnitt === "number"
            ? homeClub.ticketSchnitt * (1 - this.TICKET_SCHNITT_GEWICHT) + ticketIncome * this.TICKET_SCHNITT_GEWICHT
            : ticketIncome);
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
     * Wie viel eines Heimspiels in die Kasse geht, damit Eintritt und Kosten
     * über die Saison zusammenpassen.
     *
     * Gehälter, Sponsor, Unterhalt und Betrieb werden für alle Vereine der
     * Welt einmal je Spieltag der eigenen Liga gebucht - 34-mal, wenn der
     * eigene Verein in der Bundesliga spielt. Eintritt gab es dagegen für
     * jedes echte Heimspiel: In der Championship mit 24 Vereinen sind das 23
     * statt 17. Gemessen legte ein Zweitligist in England so 21 % seines
     * Umsatzes zurück, ein Drittligist 24 %. Und spielte der eigene Verein in
     * der Championship, zahlten die Bundesligisten 46-mal Gehalt bei 17
     * Heimspielen. Jetzt bringt jede Saison so viel Eintritt, wie die
     * Rechnung je Spieltag unterstellt: ein Heimspiel je zwei Spieltage.
     */
    heimspielAnteil(state, club) {
        if (!state || !club) return 1;
        const takt = (state.schedule || []).length || state.totalMatchdays || 0;
        const eigen = club.leagueId === state.userLeagueId
            ? takt
            : ((state.otherSchedules || {})[club.leagueId] || []).length;
        if (!(takt > 0) || !(eigen > 0)) return 1;
        return Math.max(0.5, Math.min(2, takt / eigen));
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
        // Die Zugkraft der Kader für den Fanshop, im selben Durchlauf
        const sterne = new Map();
        const ligaVon = new Map(state.clubs.map(c => [c.id, c.leagueId]));
        const niveauJe = new Map();
        const niveauVon = (leagueId) => {
            if (!niveauJe.has(leagueId)) niveauJe.set(leagueId, this._ligaNiveau(state, leagueId));
            return niveauJe.get(leagueId);
        };
        (state.players || []).forEach(p => {
            if (!p || !p.clubId) return;
            const zug = this.zugkraft(p, niveauVon(ligaVon.get(p.clubId)));
            if (zug > 0) sterne.set(p.clubId, (sterne.get(p.clubId) || 0) + zug);
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

            // 1b. Fanartikel: Trikots, Schals, Fanshop
            const fanartikel = this.fanartikelJeSpieltag(state, club, sterne.get(club.id) || 0);
            club.balance += fanartikel;
            this.recordTransaction(state, club.id, "merch_income", fanartikel, `Fanartikel und Trikots Spieltag ${state.currentMatchday}`);
            const kommerzSchnitt = sponsorIncome + this.fanartikelBasis(club);

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
            // Gemessen an dem, was die Heimspiele wirklich einbringen. Vorher
            // stand hier immer ein zu 80 % gefülltes Stadion: Ein schwacher
            // Verein vor halbleeren Rängen zahlte Betriebskosten für
            // Zuschauer, die nicht kamen, und verlor Spieltag für Spieltag Geld.
            const ticketSchnitt = this.ticketJeSpieltag(club);
            let operatingCosts = Math.round(
                (kommerzSchnitt + ticketSchnitt) * this.operatingShare(club)
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

            // 4b. Regionalscouts des eigenen Vereins
            if (club.id === state.userClubId) {
                const scouting = _feResolve("ScoutingEngine", "./scoutingEngine.js");
                const regional = scouting && typeof scouting.regionKosten === "function" ? scouting.regionKosten(state) : 0;
                if (regional > 0) {
                    club.balance -= regional;
                    this.recordTransaction(state, club.id, "scouting", -regional, "Regionalscouts (Gehälter)");
                }
                // 4c. Die Talente der Akademie bekommen ihre Ausbildungsvergütung
                const jugend = _feResolve("YouthEngine", "./youthEngine.js");
                const verguetung = jugend && typeof jugend.ausbildungsVerguetung === "function" ? jugend.ausbildungsVerguetung(state) : 0;
                if (verguetung > 0) {
                    club.balance -= verguetung;
                    this.recordTransaction(state, club.id, "youth_academy", -verguetung, "Ausbildungsvergütung der Akademie");
                }
            }

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
            const schuldengrenze = -Math.round(kommerzSchnitt * 12);
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

                // Beim zweiten Mal in einer Saison rettet ein Geldgeber - mit Auflagen
                const investoren = club.id === state.userClubId ? _feResolve("InvestorEngine", "./investorEngine.js") : null;
                const gerettet = !!(investoren && typeof investoren.schuldengrenze === "function" && investoren.schuldengrenze(state, club));

                if (!gerettet && club.id === state.userClubId && Array.isArray(state.inbox)) {
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
    // ------------------------------------------------------------ Finanzseite
    // Für die Kacheln der Finanzseite wie im Vorbild (uiFinanzen.js):
    // Kontoverlauf, Monatsbilanz, Sponsoren, Gehälter nach Kaderrolle,
    // Schulden und eine Prognose. Gerechnet wird nur aus dem, was gebucht
    // ist oder fest vereinbart - eine Prognose sagt, was sie weglässt.

    /** Der Kalendermonat einer Buchung: "2026-08" */
    monatVon(state) {
        const d = String(state?.currentDate || state?.calendar?.[state?.currentDayIndex || 0]?.date || "");
        const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d);
        return m ? `${m[3]}-${m[2]}` : null;
    },

    /** Höchstens so viele Monatsstände (drei Jahre) */
    VERLAUF_MAX: 36,

    /** Am Monatsersten: den Kontostand des eigenen Vereins festhalten */
    monatsStand(state, datum = state?.currentDate) {
        if (!state || !/^01\./.test(String(datum || ""))) return;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return;
        if (!state.finances) state.finances = { transactions: [] };
        const verlauf = Array.isArray(state.finances.verlauf) ? state.finances.verlauf : [];
        if (verlauf.length && verlauf[verlauf.length - 1].datum === datum) return;
        verlauf.push({ datum, saldo: Math.round(club.balance || 0) });
        state.finances.verlauf = verlauf.slice(-this.VERLAUF_MAX);
    },

    /** Der Kontoverlauf: die Monatsstände und heute */
    kontoVerlauf(state) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const punkte = (state?.finances?.verlauf || []).map(v => ({ datum: v.datum, saldo: v.saldo }));
        const heute = state?.currentDate || "";
        if (club && (!punkte.length || punkte[punkte.length - 1].datum !== heute)) punkte.push({ datum: heute, saldo: Math.round(club.balance || 0), heute: true });
        return punkte;
    },

    /** Einnahmen und Ausgaben eines Monats (Standard: der laufende), nach Art */
    monatsBilanz(state, monat = this.monatVon(state)) {
        const id = state?.userClubId;
        const r = { monat, einnahmen: 0, ausgaben: 0, nachArt: {} };
        (state?.finances?.transactions || []).forEach(t => {
            if (t.clubId !== id || t.monat !== monat) return;
            if (t.amount >= 0) r.einnahmen += t.amount; else r.ausgaben -= t.amount;
            r.nachArt[t.type] = (r.nachArt[t.type] || 0) + t.amount;
        });
        return r;
    },

    /** Summen der laufenden Saison nach Art der Buchung */
    saisonBuchungen(state) {
        const id = state?.userClubId, saison = state?.seasonYear || 1;
        const r = { einnahmen: 0, ausgaben: 0, nachArt: {} };
        (state?.finances?.transactions || []).forEach(t => {
            if (t.clubId !== id || (t.season || 1) !== saison) return;
            if (t.amount >= 0) r.einnahmen += t.amount; else r.ausgaben -= t.amount;
            r.nachArt[t.type] = (r.nachArt[t.type] || 0) + t.amount;
        });
        return r;
    },

    /**
     * Sponsoring der Saison: der Hauptsponsor mit dem, was je Spieltag
     * gebucht wird, mal den Spieltagen; dazu was an Fanartikeln,
     * Sponsorenaktionen und vom Investor gebucht ist.
     */
    sponsoring(state, club) {
        const spieltage = state?.totalMatchdays || 34;
        const s = this.saisonBuchungen(state).nachArt;
        const posten = [
            { art: "haupt", name: club?.sponsor?.name ? `Hauptsponsor: ${club.sponsor.name}` : "Hauptsponsor", betrag: Math.round(this.sponsorPerMatchday(club) * spieltage),
                hinweis: club?.sponsor?.yearsRemaining ? `noch ${club.sponsor.yearsRemaining} ${club.sponsor.yearsRemaining === 1 ? "Saison" : "Saisons"}` : "" },
            { art: "fanartikel", name: "Fanartikel und Trikots", betrag: Math.max(0, s.merch_income || 0), hinweis: "bisher gebucht" },
            { art: "aktion", name: "Sponsorenaktionen", betrag: Math.max(0, s.sponsor_event || 0), hinweis: "bisher gebucht" },
            { art: "investor", name: "Investor", betrag: Math.max(0, s.investor || 0), hinweis: "bisher gebucht" }
        ].filter((p, i) => i === 0 || p.betrag > 0);
        return { posten, summe: posten.reduce((a, p) => a + p.betrag, 0) };
    },

    /** Reihenfolge der Kaderrollen für die Gehaltskachel */
    ROLLEN_REIHE: ["Schlüsselspieler", "Stammspieler", "Rotationsspieler", "Ergänzungsspieler", "Toptalent", "Zukunftstalent"],

    /** Wochengehälter nach Kaderrolle: Anzahl und Summe je Rolle */
    gehaltNachRolle(state, club) {
        const kader = (state?.players || []).filter(p => p.clubId === club?.id);
        const rolle = (p) => p.squadRole === "Rotation" ? "Rotationsspieler" : (p.squadRole || "Ohne Rolle");
        const map = new Map(this.ROLLEN_REIHE.map(r => [r, { rolle: r, anzahl: 0, summe: 0, spieler: [] }]));
        kader.forEach(p => {
            const r = rolle(p);
            if (!map.has(r)) map.set(r, { rolle: r, anzahl: 0, summe: 0, spieler: [] });
            const e = map.get(r);
            e.anzahl++;
            e.summe += p.wage || 0;
            // Wer zur Gruppe gehört - die Kachel klappt sie auf
            e.spieler.push({ id: p.id, name: p.name, pos: p.pos, wage: p.wage || 0, vertrag: p.contractYears ?? null });
        });
        const liste = [...map.values()];
        liste.forEach(e => e.spieler.sort((a, b) => b.wage - a.wage));
        return { liste, summe: liste.reduce((a, e) => a + e.summe, 0), budget: club?.wageBudget || 0 };
    },

    /** Was der Verein schuldet und was ihm zusteht: Ablöseraten und Baukredite */
    schulden(state, club) {
        const raten = this.ratenUebersicht(state, club?.id);
        const anlagen = _feResolve("FacilityEngine", "./facilityEngine.js");
        const bau = anlagen && typeof anlagen.offeneBaukredite === "function" ? anlagen.offeneBaukredite(state, club) : 0;
        const bauRate = (club?.baukredite || []).reduce((a, k) => a + (k.rate || 0), 0);
        return {
            raten: raten.schulden, forderungen: raten.forderungen, baukredite: bau,
            gesamt: raten.schulden + bau,
            naechsterMonat: raten.naechsterMonat.zahlen + bauRate * 4
        };
    },

    /**
     * Prognose bis zum Saisonende und für die Saison danach: aus dem, was je
     * Spieltag im Schnitt hereinkommt und hinausgeht. Ab drei Spieltagen aus
     * den Buchungen dieser Saison, davor aus den Schätzungen. Transfers,
     * Prämien und Investor bleiben draußen - sie lassen sich nicht planen.
     */
    PROGNOSE_OHNE: ["transfer_in", "transfer_out", "prize", "prize_money", "investor"],

    prognose(state, club) {
        const gesamt = state?.totalMatchdays || 34;
        const gespielt = Math.max(0, (state?.currentMatchday || 1) - 1);
        const rest = Math.max(0, gesamt - gespielt);
        let ein = 0, aus = 0;
        (state?.finances?.transactions || []).forEach(t => {
            if (t.clubId !== state.userClubId || (t.season || 1) !== (state.seasonYear || 1) || this.PROGNOSE_OHNE.includes(t.type)) return;
            if (t.amount >= 0) ein += t.amount; else aus -= t.amount;
        });
        let einJe, ausJe;
        if (gespielt >= 3) {
            einJe = ein / gespielt;
            ausJe = aus / gespielt;
        } else {
            const s = this.getFinanceSummary(state, club?.id) || {};
            einJe = s.estimatedWeeklyIncome || 0;
            ausJe = s.estimatedWeeklyExpenses || 0;
        }
        const saldo = club?.balance || 0;
        const saisonende = Math.round(saldo + (einJe - ausJe) * rest);
        return {
            ausBuchungen: gespielt >= 3,
            nettoJeSpieltag: Math.round(einJe - ausJe),
            diese: { saldo: saisonende, umsatz: Math.round(ein + einJe * rest), transferbudget: club?.transferBudget || 0 },
            naechste: { saldo: Math.round(saisonende + (einJe - ausJe) * gesamt), umsatz: Math.round(einJe * gesamt) }
        };
    },

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
        const fanartikelPerWeek = this.fanartikelJeSpieltag(state, club);
        const estTicketPerMatch = Math.round((club.stadiumCapacity || club.capacity || 30000) * 0.85 * (club.ticketPrice || 35));

        const txns = (state.finances?.transactions || []).filter(t => t.clubId === clubId);

        return {
            balance: club.balance || 0,
            transferBudget: club.transferBudget || 0,
            wageBudget: club.wageBudget || 0,
            currentWeeklyWages: weeklyWages,
            wageBudgetRemaining: (club.wageBudget || 0) - weeklyWages,
            estimatedWeeklyIncome: sponsorPerWeek + fanartikelPerWeek + Math.round(estTicketPerMatch / 2),
            fanartikelPerWeek,
            estimatedWeeklyExpenses: Math.round(weeklyWages * (1 + this.OPERATING_WAGE_SHARE)
                + (sponsorPerWeek + this.fanartikelBasis(club) + this.ticketJeSpieltag(club)) * this.operatingShare(club)
                + this.maintenancePerMatchday(club, state)),
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
