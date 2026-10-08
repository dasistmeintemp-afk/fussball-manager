/**
 * InvestorEngine - Geldgeber, Übernahmen und Rettung mit Auflagen
 *
 * Bisher gehörte jeder Verein sich selbst, und Geld kam nur aus dem
 * Spielbetrieb, aus Prämien und Transfers. Wer an die Schuldengrenze stieß,
 * bekam vom Vorstand wortlos Geld nachgeschossen - so oft wie nötig. Jetzt:
 *
 *   Investoren  - Ein Mäzen, ein Investmentfonds oder ein Konzern steigt
 *                 ein. Er bringt Geld zum Einstieg und jedes Jahr, dazu einen
 *                 höheren Gehaltsetat - und Ansprüche: Das Saisonziel liegt
 *                 höher, und der Vorstand verliert schneller die Geduld.
 *                 Verfehlt der Verein die Ziele zu oft, zieht der Investor
 *                 sich zurück.
 *   50+1        - In Deutschland bleibt die Mehrheit beim Verein. Ein
 *                 Investor bringt weniger Geld und hat weniger Einfluss;
 *                 Konzerne steigen nicht ein.
 *   Der Trainer - wird gefragt: Ein Angebot liegt dem Vorstand drei Wochen
 *                 vor, der Trainer kann zu- oder abraten. Einmal je Saison
 *                 kann er den Vorstand bitten, sich nach einem Geldgeber
 *                 umzusehen.
 *   Finanznot   - Reißt der Verein die Schuldengrenze ein zweites Mal in
 *                 einer Saison, rettet ihn ein Geldgeber - mit Auflagen:
 *                 keine Ablösen bis Saisonende, ein Gehaltsdeckel bis zum
 *                 Ende der nächsten Saison und ein Verkaufsziel bis zum Ende
 *                 des nächsten Transferfensters. Wer das Verkaufsziel
 *                 verfehlt, dem zieht der Verband drei Punkte ab.
 *   Die Welt    - Auch KI-Vereine werden übernommen und geben das Geld aus.
 */

const _ivResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const InvestorEngine = {
    /**
     * Die Arten von Geldgebern. Geld als Anteil am Jahresumsatz, Gehalt als
     * Aufschlag auf den Gehaltsetat, Anspruch in Tabellenplätzen, Faktor und
     * Schwelle für die Geduld des Vorstands, Geduld in verfehlten Saisons.
     */
    ARTEN: {
        maezen: { name: "Mäzen", einstieg: 0.25, jaehrlich: 0.08, gehalt: 0.06, anspruch: 0, faktor: 1.0, schwelle: 0, geduld: 3, anteil: 30 },
        fonds: { name: "Investmentfonds", einstieg: 0.5, jaehrlich: 0.15, gehalt: 0.12, anspruch: 1, faktor: 1.35, schwelle: 5, geduld: 2, anteil: 60 },
        konzern: { name: "Konzern", einstieg: 1.0, jaehrlich: 0.3, gehalt: 0.25, anspruch: 2, faktor: 1.6, schwelle: 9, geduld: 1, anteil: 90 },
        retter: { name: "Geldgeber in der Not", einstieg: 0, jaehrlich: 0, gehalt: 0, anspruch: 0, faktor: 1.15, schwelle: 3, geduld: 2, anteil: 50 }
    },
    /** 50+1: höchstens 49 % der Anteile, weniger Geld, halber Einfluss */
    FUENFZIG_PLUS_EINS: { laender: ["de"], anteil: 49, geld: 0.6 },
    /** So lange liegt ein Angebot dem Vorstand vor (Tage) */
    BEDENKZEIT: 21,
    /** Die Suche nach einem Geldgeber: Dauer in Tagen und Erfolgsaussicht */
    SUCHE_TAGE: [14, 42],
    SUCHE_ERFOLG: 0.7,
    /** Ein Angebot von selbst zum Saisonstart - bei leerer Kasse eher */
    CHANCE_SAISON: 0.08,
    CHANCE_KLAMM: 0.15,
    /** Auflagen: Gehaltsdeckel (Anteil der Gehaltssumme), Verkaufsziel, Punktabzug */
    AUFLAGE: { gehalt: 0.92, verkauf: 0.25, abzug: 3 },
    /** Übernahmen von KI-Vereinen je Land und Saison (Erwartungswert) */
    KI_UEBERNAHMEN: { en: 0.6, it: 0.4, fr: 0.4, es: 0.25, de: 0.15 },
    /** Je Saison zieht sich ein Investor eines KI-Vereins mit dieser Chance zurück */
    KI_RUECKZUG: 0.08,
    /** Höchstens so viele Vereine einer Liga haben einen Investor */
    KI_HOECHSTENS: 0.3,

    NAMEN: {
        familie: {
            de: ["Brenner", "Kessler", "Lindemann", "Vogt", "Hartwig", "Seidel"],
            en: ["Whitmore", "Ashford", "Hale", "Pembrook", "Langley", "Thornton"],
            es: ["Ibarra", "Soler", "Montero", "Arrieta", "Valcárcel"],
            it: ["Ferraro", "Galli", "Moretti", "Castellani", "Benedetti"],
            fr: ["Lambert", "Moreau", "Girard", "Duval", "Marchand"]
        },
        stamm: ["Nordstern", "Altmark", "Bluewater", "Meridian", "Atlas", "Lumen", "Falkenstein", "Orion", "Silverline", "Castell", "Harbor", "Westgate"],
        fonds: ["Capital", "Sports Partners", "Holdings", "Equity"],
        konzern: ["Group", "Industries", "Konzern"]
    },

    _club(state, id) { return (state?.clubs || []).find(c => c.id === id) || null; },
    _eigener(state) { return this._club(state, state?.userClubId); },
    _land(club) {
        if (club?.countryId) return club.countryId;
        const ligen = _ivResolve("LEAGUES_DATA", "../data/leagueData.js") || [];
        const liste = Array.isArray(ligen) ? ligen : (ligen.LEAGUES_DATA || []);
        return liste.find(l => l.id === club?.leagueId)?.countryId || "de";
    },
    _geld(betrag) {
        const gs = _ivResolve("GameState", "./gameState.js");
        return gs && typeof gs.formatMoney === "function" ? gs.formatMoney(betrag) : `${Math.round(betrag)} €`;
    },
    _runde(betrag) { return Math.round(betrag / 100000) * 100000; },
    _post(state, absender, betreff, text, type = "board") {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`, sender: absender, subject: betreff, body: text, read: false, type });
    },
    _buche(state, club, betrag, text) {
        const fin = _ivResolve("FinanceEngine", "./financeEngine.js");
        if (fin && typeof fin.recordTransaction === "function") fin.recordTransaction(state, club.id, "investor", betrag, text);
    },

    /** Der Jahresumsatz, an dem sich das Geld der Investoren bemisst */
    umsatz(state, club) {
        const fin = _ivResolve("FinanceEngine", "./financeEngine.js");
        const je = fin && typeof fin.einnahmenSchaetzung === "function" ? fin.einnahmenSchaetzung(club, state) : 0;
        return Math.max(2000000, je * 34);
    },

    fuenfzigPlusEins(club) { return this.FUENFZIG_PLUS_EINS.laender.includes(this._land(club)); },

    /** Was ein Geldgeber dieser Art bei diesem Verein bedeutet - mit 50+1 gerechnet */
    bedingungen(club, art) {
        const a = this.ARTEN[art] || this.ARTEN.maezen;
        if (!this.fuenfzigPlusEins(club) || art === "retter") return { ...a };
        const R = this.FUENFZIG_PLUS_EINS;
        return {
            ...a,
            einstieg: a.einstieg * R.geld, jaehrlich: a.jaehrlich * R.geld, gehalt: a.gehalt * R.geld,
            anspruch: Math.max(0, a.anspruch - 1), faktor: 1 + (a.faktor - 1) / 2, schwelle: Math.round(a.schwelle / 2),
            anteil: Math.min(a.anteil, R.anteil)
        };
    },

    /** Der aktive Investor eines Vereins - oder null */
    investor(club) {
        return club && club.investor && club.investor.aktiv !== false ? club.investor : null;
    },

    /** Wie viel schneller der Vorstand die Geduld verliert: { faktor, schwelle } */
    ungeduld(club) {
        const inv = this.investor(club);
        return inv ? { faktor: inv.faktor || 1, schwelle: inv.schwelle || 0 } : { faktor: 1, schwelle: 0 };
    },

    /** Um so viele Plätze liegt das Saisonziel höher */
    anspruch(club) {
        return this.investor(club)?.anspruch || 0;
    },

    _name(club, art, zufall) {
        const N = this.NAMEN;
        const wahl = (liste) => liste[Math.floor(zufall() * liste.length) % liste.length];
        if (art === "maezen" || art === "retter") {
            const familie = N.familie[this._land(club)] || N.familie.de;
            return art === "maezen" ? `Familie ${wahl(familie)}` : `${wahl(N.stamm)} ${wahl(N.fonds)}`;
        }
        return `${wahl(N.stamm)} ${wahl(art === "konzern" ? N.konzern : N.fonds)}`;
    },

    /** Welche Art Geldgeber sich für einen Verein interessiert */
    _artFuer(club, zufall) {
        const ruf = club.reputation || 50;
        const arten = ["maezen", "fonds"];
        if (ruf >= 55 && (club.level || 1) <= 2 && !this.fuenfzigPlusEins(club)) arten.push("konzern");
        if ((club.level || 1) >= 3) return zufall() < 0.7 ? "maezen" : "fonds";
        return arten[Math.floor(zufall() * arten.length) % arten.length];
    },

    /** Ein Angebot für einen Verein: Geld, Anteil, Ansprüche */
    angebotFuer(state, club, art, zufall = Math.random) {
        const b = this.bedingungen(club, art);
        const umsatz = this.umsatz(state, club);
        return {
            art, name: this._name(club, art, zufall), anteil: b.anteil,
            einstieg: this._runde(umsatz * b.einstieg), jaehrlich: this._runde(umsatz * b.jaehrlich),
            gehaltPlus: Math.round((club.wageBudget || 0) * b.gehalt / 1000) * 1000,
            anspruch: b.anspruch, faktor: b.faktor, schwelle: b.schwelle, geduld: b.geduld,
            fuenfzigPlusEins: this.fuenfzigPlusEins(club) && art !== "retter"
        };
    },

    /** Ein Angebot an den eigenen Verein: Es liegt dem Vorstand drei Wochen vor */
    bieteAn(state, art = null, zufall = Math.random) {
        const club = this._eigener(state);
        if (!club || this.investor(club) || state.investorAngebot) return null;
        const a = this.angebotFuer(state, club, art || this._artFuer(club, zufall), zufall);
        // Ein Tageszähler statt eines Datums: Zum Saisonstart springt der
        // Kalender zurück, eine Frist nach Kalendertag liefe dann nie ab
        state.investorAngebot = { ...a, clubId: club.id, saison: state.seasonYear || 1, tage: this.BEDENKZEIT, empfehlung: null };
        const regel = a.fuenfzigPlusEins ? ` Wegen der 50+1-Regel bleibt die Mehrheit beim Verein: ${a.anteil} % der Anteile.` : ` Angeboten sind ${a.anteil} % der Anteile.`;
        this._post(state, "Vorstand", `💼 Ein Investor will einsteigen: ${a.name}`,
            `${a.name} (${this.ARTEN[a.art].name}) möchte bei uns einsteigen.${regel}\n\n`
            + `Zum Einstieg ${this._geld(a.einstieg)}, danach ${this._geld(a.jaehrlich)} je Saison, der Gehaltsetat steigt um ${this._geld(a.gehaltPlus)} pro Woche.`
            + (a.anspruch ? ` Dafür erwartet der Investor mehr: Das Saisonziel läge ${a.anspruch === 1 ? "einen Platz" : `${a.anspruch} Plätze`} höher, und wir müssten schneller liefern.` : " Der Investor stellt keine sportlichen Forderungen.")
            + `\n\nWir entscheiden in ${this.BEDENKZEIT} Tagen. Ihre Meinung zählt - im Reiter Verein können Sie zu- oder abraten.`);
        return state.investorAngebot;
    },

    /** Der Trainer rät zu oder ab */
    empfehle(state, dafuer) {
        const a = state?.investorAngebot;
        if (!a) return { success: false, error: "Es liegt kein Angebot vor." };
        a.empfehlung = dafuer ? "dafuer" : "dagegen";
        return { success: true };
    },

    /** Der Vorstand entscheidet - meist so, wie der Trainer rät, wenn er ihm vertraut */
    entscheide(state, zufall = Math.random) {
        const a = state?.investorAngebot;
        const club = this._eigener(state);
        if (!a || !club) return null;
        delete state.investorAngebot;
        const vorstand = _ivResolve("BoardEngine", "./boardEngine.js");
        const vertrauen = vorstand && typeof vorstand.vertrauen === "function" ? vorstand.vertrauen(state, club) : 60;
        let ja;
        let gefolgt = true;
        if (a.empfehlung) {
            gefolgt = zufall() < 0.5 + vertrauen / 200;
            ja = gefolgt ? a.empfehlung === "dafuer" : a.empfehlung !== "dafuer";
        } else {
            ja = zufall() < ((club.balance || 0) < 0 ? 0.8 : 0.5);
        }
        club.investorHistorie = club.investorHistorie || [];
        if (!ja) {
            club.investorHistorie.push({ saison: state.seasonYear || 1, name: a.name, art: a.art, ergebnis: "abgelehnt" });
            this._post(state, "Vorstand", `Kein Einstieg von ${a.name}`,
                (a.empfehlung === "dagegen" && gefolgt ? "Wir sind Ihrem Rat gefolgt: " : "")
                + `Der Vorstand hat das Angebot von ${a.name} abgelehnt. Der Verein bleibt, wie er ist.`
                + (!gefolgt ? " Wir wissen, dass Sie es anders gesehen haben." : ""));
            if (!gefolgt && vorstand) vorstand.stimmung(state, -2);
            return { angenommen: false, gefolgt };
        }
        this.vollziehe(state, club, a);
        if (!gefolgt && vorstand) vorstand.stimmung(state, -2);
        return { angenommen: true, gefolgt };
    },

    /** Der Einstieg: Geld aufs Konto, Etat hoch, Ansprüche festhalten */
    vollziehe(state, club, a) {
        const saison = state.seasonYear || 1;
        club.balance = (club.balance || 0) + a.einstieg;
        club.transferBudget = Math.max(0, (club.transferBudget || 0) + Math.round(a.einstieg * 0.6));
        club.wageBudget = Math.round((club.wageBudget || 0) + a.gehaltPlus);
        if (a.einstieg) this._buche(state, club, a.einstieg, `Einstieg ${a.name}`);
        club.investor = {
            aktiv: true, art: a.art, name: a.name, anteil: a.anteil, seit: saison, jaehrlich: a.jaehrlich, gehaltPlus: a.gehaltPlus,
            anspruch: a.anspruch, faktor: a.faktor, schwelle: a.schwelle, geduld: a.geduld, geduldMax: a.geduld,
            fuenfzigPlusEins: !!a.fuenfzigPlusEins, gezahlt: a.einstieg
        };
        club.investorHistorie = club.investorHistorie || [];
        club.investorHistorie.push({ saison, name: a.name, art: a.art, ergebnis: "eingestiegen" });
        if (club.id === state.userClubId && a.art !== "retter") {
            this._post(state, "Vorstand", `🤝 ${a.name} steigt ein`,
                `${a.name} übernimmt ${a.anteil} % der Anteile. ${this._geld(a.einstieg)} gehen aufs Konto, ${this._geld(Math.round(a.einstieg * 0.6))} davon ins Transferbudget. `
                + `Der Gehaltsetat steigt um ${this._geld(a.gehaltPlus)} pro Woche.`
                + (a.anspruch ? `\n\nAb dem nächsten Saisonziel erwartet der Investor ${a.anspruch === 1 ? "einen Platz" : `${a.anspruch} Plätze`} mehr - und er schaut schon jetzt genauer hin.` : ""));
        }
        return club.investor;
    },

    /** Der Rückzug: Das jährliche Geld und der Gehaltsaufschlag enden */
    zieheZurueck(state, club, grund) {
        const inv = this.investor(club);
        if (!inv) return false;
        inv.aktiv = false;
        inv.bis = state.seasonYear || 1;
        club.wageBudget = Math.max(0, Math.round((club.wageBudget || 0) - (inv.gehaltPlus || 0)));
        club.investorHistorie = club.investorHistorie || [];
        club.investorHistorie.push({ saison: state.seasonYear || 1, name: inv.name, art: inv.art, ergebnis: "zurückgezogen" });
        if (club.id === state.userClubId) {
            this._post(state, "Vorstand", `${inv.name} zieht sich zurück`,
                `${grund} ${inv.name} verkauft die Anteile zurück. Das jährliche Geld fällt weg, der Gehaltsetat sinkt um ${this._geld(inv.gehaltPlus || 0)} pro Woche.`);
        }
        return true;
    },

    // ------------------------------------------------ Suche durch den Trainer

    sucheHindernis(state) {
        const club = this._eigener(state);
        if (!club) return "Kein Verein.";
        if (this.investor(club)) return `${club.investor.name} ist schon eingestiegen.`;
        if (state.investorAngebot) return "Ein Angebot liegt dem Vorstand schon vor.";
        if (state.investorSuche) return "Der Vorstand sucht bereits.";
        if (club.investorSucheSaison === (state.seasonYear || 1)) return "Darüber hat der Vorstand in dieser Saison schon gesprochen.";
        return null;
    },

    /** Wie gern der Vorstand sucht: Vertrauen, und wer klamm ist, sucht lieber */
    sucheChance(state) {
        const club = this._eigener(state);
        const vorstand = _ivResolve("BoardEngine", "./boardEngine.js");
        const vertrauen = vorstand && typeof vorstand.vertrauen === "function" ? vorstand.vertrauen(state, club) : 60;
        return Math.max(0.1, Math.min(0.9, 0.35 + (vertrauen - 50) / 100 + ((club?.balance || 0) < 0 ? 0.25 : 0)));
    },

    /** Der Trainer bittet den Vorstand, sich nach einem Geldgeber umzusehen */
    suche(state, zufall = Math.random) {
        const grund = this.sucheHindernis(state);
        if (grund) return { success: false, error: grund };
        const club = this._eigener(state);
        club.investorSucheSaison = state.seasonYear || 1;
        if (zufall() >= this.sucheChance(state)) {
            return { success: true, sucht: false, text: "Der Vorstand will keinen Investor - der Verein soll aus eigener Kraft wachsen." };
        }
        const [von, bis] = this.SUCHE_TAGE;
        state.investorSuche = { clubId: club.id, tage: von + Math.floor(zufall() * (bis - von + 1)), erfolg: zufall() < this.SUCHE_ERFOLG };
        return { success: true, sucht: true, text: "Der Vorstand hört sich um. In ein paar Wochen wissen wir mehr." };
    },

    // ------------------------------------------------ Finanznot und Auflagen

    /**
     * Aus FinanceEngine: Der eigene Verein ist an der Schuldengrenze, der
     * Vorstand hat nachgeschossen. Beim zweiten Mal in einer Saison kommt
     * die Rettung mit Auflagen. Gibt true zurück, wenn sie kam.
     */
    schuldengrenze(state, club) {
        if (!club || club.id !== state.userClubId) return false;
        const saison = state.seasonYear || 1;
        const n = club.finanznot && club.finanznot.saison === saison ? club.finanznot.mal + 1 : 1;
        club.finanznot = { saison, mal: n };
        if (n < 2 || club.auflagen) return false;
        this.rette(state, club);
        return true;
    },

    rette(state, club) {
        const saison = state.seasonYear || 1;
        const schulden = Math.max(0, -(club.balance || 0));
        let inv = this.investor(club);
        let name;
        if (inv) {
            inv.geduld = Math.max(0, (inv.geduld || 1) - 1);
            name = inv.name;
        } else {
            const a = this.angebotFuer(state, club, "retter");
            inv = this.vollziehe(state, club, a);
            name = a.name;
        }
        club.balance = 0;
        if (schulden) this._buche(state, club, schulden, `Rettung durch ${name}`);
        club.transferBudget = 0;

        const fin = _ivResolve("FinanceEngine", "./financeEngine.js");
        const lohn = fin && typeof fin.wochengehaelter === "function" ? fin.wochengehaelter(state, club) : (club.wageBudget || 0);
        const deckel = Math.round(lohn * this.AUFLAGE.gehalt / 1000) * 1000;
        const gehaltMinus = Math.max(0, (club.wageBudget || 0) - deckel);
        club.wageBudget = Math.round((club.wageBudget || 0) - gehaltMinus);

        const kaderwert = (state.players || []).filter(p => p.clubId === club.id && !p.leihe).reduce((s, p) => s + (p.value || 0), 0);
        const ziel = this._runde(Math.max(500000, Math.min(kaderwert * 0.2, Math.max(this.umsatz(state, club) * 0.05, schulden * this.AUFLAGE.verkauf))));
        const te = _ivResolve("TransferEngine", "./transferEngine.js");
        const offen = !!(te && typeof te.istTransferfenster === "function" && te.istTransferfenster(state));
        const fenster = this._naechstesFenster(state, te, offen);
        club.auflagen = {
            seit: saison, geber: name, sperreBisSaison: saison, deckel, gehaltMinus, deckelBisSaison: saison + 1,
            verkauf: { ziel, erloes: 0, phase: offen ? "alt" : "vor", fenster }
        };
        const vorstand = _ivResolve("BoardEngine", "./boardEngine.js");
        if (vorstand && typeof vorstand.stimmung === "function") vorstand.stimmung(state, -8);
        this._post(state, "Vorstand", "🚨 Finanznot: Rettung mit Auflagen",
            `Zum zweiten Mal in dieser Saison standen wir an der Schuldengrenze. ${name} übernimmt die Schulden von ${this._geld(schulden)} - aber nicht ohne Bedingungen:\n\n`
            + `• Bis Saisonende keine Ablösen. Was Verkäufe einbringen, tilgt Schulden und fließt nicht ins Transferbudget.\n`
            + `• Gehaltsdeckel bis zum Ende der nächsten Saison: höchstens ${this._geld(deckel)} pro Woche. Neue Verträge darüber gehen nicht durch.\n`
            + `• Verkäufe von mindestens ${this._geld(ziel)} bis zum Ende des ${fenster === "winter" ? "Winter" : "Sommer"}transferfensters. Verfehlen wir das, zieht der Verband ${this.AUFLAGE.abzug} Punkte ab.`);
        return club.auflagen;
    },

    _naechstesFenster(state, te, offen) {
        if (offen && te && typeof te.offenesFenster === "function") return te.offenesFenster(state)?.art === "sommer" ? "winter" : "sommer";
        const heute = te && typeof te.heute === "function" ? te.heute(state) : null;
        return heute && heute.monat >= 7 ? "winter" : "sommer";
    },

    /** Keine Ablösen, solange die Auflage gilt */
    transferSperre(state, club) {
        const a = club?.auflagen;
        return !!(a && a.sperreBisSaison >= (state?.seasonYear || 1));
    },

    /** Warum ein neuer Vertrag am Gehaltsdeckel scheitert - oder null */
    gehaltsHindernis(state, club, wage) {
        const a = club?.auflagen;
        if (!a || !a.deckel || a.deckelBisSaison < (state?.seasonYear || 1)) return null;
        const fin = _ivResolve("FinanceEngine", "./financeEngine.js");
        const lohn = fin && typeof fin.wochengehaelter === "function" ? fin.wochengehaelter(state, club) : 0;
        if (lohn + wage <= a.deckel) return null;
        return `Auflage von ${a.geber}: Die Gehaltssumme darf ${this._geld(a.deckel)} pro Woche nicht übersteigen (jetzt ${this._geld(lohn)}).`;
    },

    /** Aus TransferEngine: Ein Verkauf zählt aufs Verkaufsziel. true = Erlös nicht ins Transferbudget */
    nachVerkauf(state, club, erloes) {
        const a = club?.auflagen;
        if (!a) return false;
        const v = a.verkauf;
        if (v && erloes > 0) {
            v.erloes += erloes;
            if (v.erloes >= v.ziel) {
                delete a.verkauf;
                if (club.id === state.userClubId) {
                    this._post(state, "Vorstand", "✅ Verkaufsauflage erfüllt",
                        `Mit ${this._geld(v.erloes)} aus Verkäufen haben wir die Auflage von ${a.geber} erfüllt. Ein Punktabzug droht nicht mehr.`);
                }
            }
        }
        return this.transferSperre(state, club);
    },

    /** Täglich: das Verkaufsziel, die Entscheidung über ein Angebot, die Suche */
    tag(state, zufall = Math.random) {
        const club = this._eigener(state);
        if (!club) return null;
        let zeile = null;
        // Nach einem Vereinswechsel des Trainers gilt nichts mehr davon
        if (state.investorAngebot && state.investorAngebot.clubId && state.investorAngebot.clubId !== club.id) delete state.investorAngebot;
        if (state.investorSuche && state.investorSuche.clubId && state.investorSuche.clubId !== club.id) delete state.investorSuche;

        // Erst über ein offenes Angebot entscheiden, dann die Suche - ein
        // heute gefundenes Angebot hat seine volle Bedenkzeit
        if (state.investorAngebot && --state.investorAngebot.tage <= 0) {
            const name = state.investorAngebot.name;
            const r = this.entscheide(state, zufall);
            if (r) zeile = r.angenommen ? `🤝 ${name} steigt ein.` : `Der Vorstand lehnt ${name} ab.`;
        }

        if (state.investorSuche && --state.investorSuche.tage <= 0) {
            const erfolg = state.investorSuche.erfolg;
            delete state.investorSuche;
            if (erfolg && !this.investor(club) && !state.investorAngebot) {
                this.bieteAn(state, null, zufall);
                zeile = "💼 Ein Investor will einsteigen - der Vorstand fragt nach Ihrer Meinung.";
            } else if (!erfolg) {
                this._post(state, "Vorstand", "Kein Geldgeber gefunden",
                    "Wir haben uns umgehört, aber niemand will im Moment bei uns einsteigen. Vielleicht später.");
            }
        }

        const v = club.auflagen?.verkauf;
        if (v) {
            const te = _ivResolve("TransferEngine", "./transferEngine.js");
            const offen = !!(te && typeof te.istTransferfenster === "function" && te.istTransferfenster(state));
            if (v.phase === "alt" && !offen) v.phase = "vor";
            else if (v.phase === "vor" && offen) v.phase = "laeuft";
            else if (v.phase === "laeuft" && !offen) {
                delete club.auflagen.verkauf;
                club.punktabzug = { punkte: this.AUFLAGE.abzug, saison: state.seasonYear || 1, grund: "Verkaufsauflage verfehlt" };
                this._tabelleNeu(state);
                this._post(state, "Verband", `⚖️ ${this.AUFLAGE.abzug} Punkte Abzug`,
                    `${club.name} hat die Verkaufsauflage verfehlt: ${this._geld(v.erloes)} von ${this._geld(v.ziel)}. Der Verband zieht ${this.AUFLAGE.abzug} Punkte ab.`);
                zeile = `⚖️ ${this.AUFLAGE.abzug} Punkte Abzug - die Verkaufsauflage ist verfehlt.`;
            }
        }
        return zeile;
    },

    /** Der Abzug soll sofort in der Tabelle stehen, nicht erst nach dem nächsten Spieltag */
    _tabelleNeu(state) {
        const gs = _ivResolve("GameState", "./gameState.js");
        if (!gs || typeof gs.calculateStandings !== "function" || typeof gs.getLeagueClubs !== "function" || !Array.isArray(state.schedule)) return;
        state.standings = gs.calculateStandings(gs.getLeagueClubs(state), state.schedule, state.currentMatchday || 0);
        const liga = typeof gs.getUserLeagueId === "function" ? gs.getUserLeagueId(state) : null;
        if (liga) { state.standingsByLeague = state.standingsByLeague || {}; state.standingsByLeague[liga] = state.standings; }
    },

    // ------------------------------------------------ Saisonwechsel

    /** Zum Saisonende: Hat der Verein geliefert? Sonst wird der Investor ungeduldig */
    saisonEnde(state) {
        const club = this._eigener(state);
        const inv = this.investor(club);
        if (!inv || inv.seit === (state.seasonYear || 1)) return null;
        const vorstand = _ivResolve("BoardEngine", "./boardEngine.js");
        const bilanz = vorstand && typeof vorstand.evaluateSeasonEnd === "function" ? vorstand.evaluateSeasonEnd(state) : null;
        if (!bilanz) return null;
        if (bilanz.achieved) {
            inv.geduld = Math.min(inv.geduldMax || 1, (inv.geduld || 0) + 1);
            return { zufrieden: true };
        }
        inv.geduld = (inv.geduld || 0) - 1;
        if (inv.geduld <= 0) {
            this.zieheZurueck(state, club, "Das Saisonziel ist wieder verfehlt.");
            return { zufrieden: false, rueckzug: true };
        }
        this._post(state, "Vorstand", `${inv.name} ist unzufrieden`,
            `Das Saisonziel ist verfehlt, und ${inv.name} hat das deutlich gemacht. Noch eine solche Saison, und der Investor zieht sich zurück.`);
        return { zufrieden: false, rueckzug: false };
    },

    /**
     * Zum Saisonstart (nach der Etatplanung): das jährliche Geld, Übernahmen
     * in der Welt, Auflagen und ein mögliches Angebot an den eigenen Verein.
     * Punktabzüge der alten Saison verfallen.
     */
    saisonstart(state, zufall = Math.random) {
        if (!state || !Array.isArray(state.clubs)) return;
        const saison = state.seasonYear || 1;
        state.clubs.forEach(c => {
            if (c.punktabzug && c.punktabzug.saison < saison) delete c.punktabzug;
            const inv = this.investor(c);
            if (!inv) return;
            if (c.id !== state.userClubId && zufall() < this.KI_RUECKZUG) { this.zieheZurueck(state, c, ""); return; }
            if (inv.jaehrlich && !this.transferSperre(state, c)) {
                c.balance = (c.balance || 0) + inv.jaehrlich;
                c.transferBudget = (c.transferBudget || 0) + Math.round(inv.jaehrlich * 0.8);
                inv.gezahlt = (inv.gezahlt || 0) + inv.jaehrlich;
                this._buche(state, c, inv.jaehrlich, `Kapital von ${inv.name}`);
            }
        });

        const eigener = this._eigener(state);
        const a = eigener?.auflagen;
        if (a) {
            if (a.sperreBisSaison >= saison) eigener.transferBudget = 0;
            if (a.deckel && a.deckelBisSaison < saison) {
                eigener.wageBudget = Math.round((eigener.wageBudget || 0) + (a.gehaltMinus || 0));
                delete a.deckel;
                this._post(state, "Vorstand", "Gehaltsdeckel aufgehoben",
                    `Die Auflage von ${a.geber} ist erfüllt: Der Gehaltsdeckel fällt, der Gehaltsetat steigt wieder um ${this._geld(a.gehaltMinus || 0)} pro Woche.`);
            }
            if (a.sperreBisSaison < saison && !a.deckel && !a.verkauf) delete eigener.auflagen;
        }

        this.kiUebernahmen(state, zufall);

        if (eigener && !this.investor(eigener) && !state.investorAngebot && !eigener.auflagen) {
            const chance = this.CHANCE_SAISON + ((eigener.balance || 0) < 0 ? this.CHANCE_KLAMM : 0);
            if (zufall() < chance) this.bieteAn(state, null, zufall);
        }
    },

    /** Übernahmen von KI-Vereinen in den beiden obersten Ligen jedes Landes */
    kiUebernahmen(state, zufall = Math.random) {
        const nachLand = new Map();
        state.clubs.forEach(c => {
            if (c.id === state.userClubId || (c.level || 1) > 2 || !c.leagueId) return;
            const land = this._land(c);
            if (!nachLand.has(land)) nachLand.set(land, []);
            nachLand.get(land).push(c);
        });
        const eigeneLiga = this._eigener(state)?.leagueId;
        const neu = [];
        nachLand.forEach((vereine, land) => {
            const erwartung = this.KI_UEBERNAHMEN[land] || 0.1;
            if (zufall() >= erwartung) return;
            const kandidaten = vereine.filter(c => {
                if (this.investor(c)) return false;
                const liga = vereine.filter(x => x.leagueId === c.leagueId);
                return liga.filter(x => this.investor(x)).length < Math.floor(liga.length * this.KI_HOECHSTENS);
            });
            if (!kandidaten.length) return;
            // Mittelgroße Vereine mit Luft nach oben sind am reizvollsten
            const gewicht = (c) => Math.max(1, 30 - Math.abs((c.reputation || 50) - 62)) * ((c.level || 1) === 1 ? 2 : 1);
            const summe = kandidaten.reduce((s, c) => s + gewicht(c), 0);
            let r = zufall() * summe;
            const club = kandidaten.find(c => (r -= gewicht(c)) < 0) || kandidaten[0];
            const a = this.angebotFuer(state, club, this._artFuer(club, zufall), zufall);
            this.vollziehe(state, club, a);
            neu.push({ club, a });
            if (club.leagueId === eigeneLiga) {
                this._post(state, "Liga-Rundschau", `💼 Übernahme: ${a.name} steigt bei ${club.name} ein`,
                    `${a.name} (${this.ARTEN[a.art].name}) übernimmt ${a.anteil} % bei ${club.name} und bringt ${this._geld(a.einstieg)} mit. Ein neuer Konkurrent auf dem Transfermarkt.`, "news");
            }
        });
        return neu;
    },

    /** Für die Anzeige im Reiter Verein */
    uebersicht(state) {
        const club = this._eigener(state);
        if (!club) return null;
        const inv = this.investor(club);
        const a = state.investorAngebot;
        const auf = club.auflagen;
        return {
            fuenfzigPlusEins: this.fuenfzigPlusEins(club),
            investor: inv ? { ...inv, artName: this.ARTEN[inv.art]?.name || inv.art } : null,
            angebot: a ? { ...a, artName: this.ARTEN[a.art]?.name || a.art, tage: Math.max(1, a.tage) } : null,
            suche: state.investorSuche ? true : false,
            sucheHindernis: this.sucheHindernis(state),
            sucheChance: this.sucheChance(state),
            auflagen: auf ? {
                geber: auf.geber, sperre: this.transferSperre(state, club),
                deckel: auf.deckel && auf.deckelBisSaison >= (state.seasonYear || 1) ? auf.deckel : null, deckelBisSaison: auf.deckelBisSaison,
                verkauf: auf.verkauf ? { ...auf.verkauf } : null
            } : null,
            punktabzug: club.punktabzug || null,
            historie: (club.investorHistorie || []).slice(-5).reverse()
        };
    }
};

if (typeof window !== "undefined") {
    window.InvestorEngine = InvestorEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { InvestorEngine };
}
