/**
 * NegotiationEngine - Mehrtägige Verhandlungen mit Vereinen und Spielerberatern
 *
 * Ein Transfer ist kein Knopfdruck. Er läuft über Tage: Erst einigt man sich
 * mit dem abgebenden Verein auf die Ablöse, dann mit dem Berater auf die
 * persönlichen Konditionen, zuletzt kommt der Medizincheck. Auch die
 * Beförderung eines Jugendspielers geht über den Berater - der erste
 * Profivertrag will verhandelt sein.
 *
 * Jede Partei antwortet erst nach ein bis drei Tagen. Wer zu niedrig bietet,
 * kostet Geduld; ist die Geduld aufgebraucht oder die Frist verstrichen,
 * platzt die Verhandlung.
 *
 * Genauso laufen Leihen (mit dem Stammverein) und Talente aus anderen
 * Akademien (Entschädigung mit dem Verein, dann die Familie). Am Deadline
 * Day antworten alle noch am selben Tag; schließt das Fenster, platzt, was
 * dafür ein offenes Fenster braucht.
 */

const _negResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));

    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const NEGOTIATION_STAGES = {
    FEE: "fee",
    TERMS: "terms",
    MEDICAL: "medical",
    // Leihe: Gehaltsanteil, Leihgebühr, Einsatzzusage und Kaufoption mit dem Stammverein
    LOAN: "loan",
    DONE: "done"
};

const NEGOTIATION_STATUS = {
    WAITING_REPLY: "waiting_reply",   // Die Gegenseite überlegt
    AWAITING_US: "awaiting_us",       // Wir sind am Zug
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    EXPIRED: "expired",
    WITHDRAWN: "withdrawn"
};

class NegotiationEngine {
    static STAGES = NEGOTIATION_STAGES;
    static STATUS = NEGOTIATION_STATUS;

    /** Einsatzzusagen bei einer Leihe, von wenig nach viel ("Talent": keine Zusage) */
    static ROLLEN = ["Talent", "Rotation", "Stammspieler"];

    /** Beraterprofile: bestimmen Tempo, Geduld und Höhe der Forderungen */
    static AGENT_PROFILES = [
        { key: "hardliner", label: "Hartnäckig", greed: 1.22, patience: 55, speed: 3, blurb: "verhandelt hart und lässt sich Zeit" },
        { key: "professional", label: "Souverän", greed: 1.08, patience: 78, speed: 2, blurb: "bleibt sachlich und antwortet zuverlässig" },
        { key: "family", label: "Familiär", greed: 0.96, patience: 92, speed: 2, blurb: "denkt an die Entwicklung des Spielers" },
        { key: "showman", label: "Lautstark", greed: 1.3, patience: 48, speed: 1, blurb: "sucht die große Bühne und die große Zahl" },
        { key: "rookie", label: "Unerfahren", greed: 0.9, patience: 85, speed: 1, blurb: "ist neu im Geschäft und schnell zufrieden" }
    ];

    static AGENT_FIRST_NAMES = ["Marco", "Jorge", "Pini", "Volker", "Elena", "Sabine", "Tomas", "Rafaela", "Kai", "Nadine", "Ferdi", "Luca", "Bernd", "Yasmin"];
    static AGENT_LAST_NAMES = ["Brandt", "Vogel", "Sartori", "Lindqvist", "Marchetti", "Okoye", "Novak", "Haller", "Reinders", "Baptista", "Yilmaz", "Kovac", "Sommer", "Delgado"];

    static getFinanceEngine() {
        return _negResolve("FinanceEngine", "./financeEngine.js");
    }

    static getNewsEngine() {
        return _negResolve("NewsEngine", "./newsEngine.js");
    }

    static getTransferEngine() {
        return _negResolve("TransferEngine", "./transferEngine.js");
    }

    static getKlauselEngine() {
        return _negResolve("KlauselEngine", "./klauselEngine.js");
    }

    static getPositionEngine() {
        return _negResolve("PositionEngine", "./positionEngine.js");
    }

    static formatMoney(amount) {
        const gameState = _negResolve("GameState", "./gameState.js");
        if (gameState && typeof gameState.formatMoney === "function") return gameState.formatMoney(amount);
        const value = Math.round(Number(amount) || 0);
        if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(2).replace(".", ",")} Mio. €`;
        if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)} Tsd. €`;
        return `${value} €`;
    }

    static today(state) {
        return (state?.currentDayIndex ?? 0);
    }

    static ensureList(state) {
        if (!Array.isArray(state.negotiations)) state.negotiations = [];
        return state.negotiations;
    }

    /** Offene Verhandlungen des Nutzervereins */
    static getOpenNegotiations(state) {
        return this.ensureList(state).filter(n =>
            n.status === NEGOTIATION_STATUS.WAITING_REPLY || n.status === NEGOTIATION_STATUS.AWAITING_US);
    }

    static findNegotiation(state, negotiationId) {
        return this.ensureList(state).find(n => String(n.id) === String(negotiationId)) || null;
    }

    /**
     * Erzeugt einen Berater. Ein Spieler behält seinen Berater dauerhaft,
     * damit sich Verhandlungen über Jahre gleich anfühlen.
     */
    static getAgentFor(player) {
        if (player && player.agent && player.agent.name) return player.agent;

        const profile = this.AGENT_PROFILES[Math.floor(Math.random() * this.AGENT_PROFILES.length)];
        const agent = {
            name: `${this.AGENT_FIRST_NAMES[Math.floor(Math.random() * this.AGENT_FIRST_NAMES.length)]} ${this.AGENT_LAST_NAMES[Math.floor(Math.random() * this.AGENT_LAST_NAMES.length)]}`,
            profile: profile.key,
            label: profile.label,
            blurb: profile.blurb,
            greed: profile.greed,
            patience: profile.patience,
            speed: profile.speed
        };

        if (player) player.agent = agent;
        return agent;
    }

    static profileOf(agent) {
        return this.AGENT_PROFILES.find(p => p.key === agent?.profile) || this.AGENT_PROFILES[1];
    }

    /** Wie viele Tage die Gegenseite für eine Antwort braucht */
    static replyDelay(agent) {
        const profile = this.profileOf(agent);
        return profile.speed + Math.floor(Math.random() * 2);
    }

    static log(negotiation, state, from, text) {
        if (!Array.isArray(negotiation.log)) negotiation.log = [];
        negotiation.log.push({
            day: this.today(state),
            date: state?.currentDate || "",
            from,
            text
        });
        if (negotiation.log.length > 40) negotiation.log = negotiation.log.slice(-40);
    }

    static notify(state, negotiation, subject, body, type = "transfer") {
        const news = this.getNewsEngine();
        if (!news || typeof news.addMessage !== "function") return;
        news.addMessage(state, type, {
            title: subject,
            sender: negotiation.agentName ? `Berater ${negotiation.agentName}` : "Transferabteilung",
            text: body,
            priority: "normal"
        });
    }

    // ------------------------------------------------------------ Transfer

    /**
     * Eröffnet eine Transferverhandlung. Der Ablauf beginnt bei der Ablöse -
     * es sei denn, der Spieler ist vereinslos oder wir verhandeln nur über
     * die persönlichen Konditionen.
     */
    static startTransferNegotiation(state, playerId, buyerClubId, openingFee = null, optionen = {}) {
        const player = state.players.find(p => String(p.id) === String(playerId));
        if (!player) return { success: false, error: "Spieler nicht gefunden." };

        const buyerClub = state.clubs.find(c => c.id === buyerClubId);
        if (!buyerClub) return { success: false, error: "Verein nicht gefunden." };
        if (player.clubId === buyerClubId) return { success: false, error: "Der Spieler steht bereits bei uns unter Vertrag." };

        const existing = this.getOpenNegotiations(state)
            .find(n => String(n.playerId) === String(playerId) && n.clubId === buyerClubId);
        if (existing) return { success: false, error: "Für diesen Spieler läuft bereits eine Verhandlung.", negotiation: existing };

        if (player.vorvertrag) {
            return { success: false, error: `${player.name} hat bereits bei ${player.vorvertrag.clubName} unterschrieben und wechselt zum Saisonwechsel.` };
        }
        const sellerClub = state.clubs.find(c => c.id === player.clubId);
        const transferEngine = this.getTransferEngine();
        const vorvertrag = !!optionen.vorvertrag;
        if (vorvertrag) {
            // Ein Vorvertrag braucht kein Fenster - er gilt erst zum Saisonwechsel
            const grund = this.vorvertragHindernis(state, player, buyerClubId);
            if (grund) return { success: false, error: grund };
        } else {
            // Außerhalb des Transferfensters wechselt nur, wer vereinslos ist.
            // Eine Verhandlung, die im Fenster beginnt, darf danach zu Ende gehen.
            const fenster = transferEngine && typeof transferEngine.fensterHindernis === "function"
                ? transferEngine.fensterHindernis(state, { vereinslos: !sellerClub }) : null;
            if (fenster) return { success: false, error: fenster };
        }
        // Nach England nur mit Arbeitserlaubnis
        const erlaubnis = this.erlaubnisPruefung(state, player, buyerClub);
        if (erlaubnis && !erlaubnis.erteilt) return { success: false, error: erlaubnis.text };
        const askingPrice = vorvertrag ? 0 : (transferEngine
            ? transferEngine.calculateAskingPrice(player, sellerClub)
            : Math.round((player.value || 1000000) * 1.15));

        const agent = this.getAgentFor(player);
        const wageDemand = this.runde((player.wage || 10000) * 1.18 * agent.greed);
        // Ablösefrei heißt nicht umsonst: Spieler und Berater wollen am
        // gesparten Geld beteiligt werden - ein höheres Handgeld, ein Honorar
        // wie bei Vereinslosen
        const ohneAbloese = vorvertrag || !sellerClub;

        const negotiation = {
            id: `neg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: "transfer",
            playerId: player.id,
            playerName: player.name,
            playerPos: player.pos,
            clubId: buyerClubId,
            sellerClubId: sellerClub ? sellerClub.id : null,
            sellerClubName: sellerClub ? sellerClub.name : "Vereinslos",
            vorvertrag,
            agentName: agent.name,
            agentProfile: agent.profile,
            agentLabel: agent.label,
            stage: sellerClub && !vorvertrag ? NEGOTIATION_STAGES.FEE : NEGOTIATION_STAGES.TERMS,
            status: NEGOTIATION_STATUS.AWAITING_US,
            openedDay: this.today(state),
            deadlineDay: this.today(state) + 14,
            replyDay: null,
            round: 0,
            patience: this.geduldMitRuf(state, agent.patience),
            demand: {
                fee: askingPrice,
                wage: wageDemand,
                years: 3,
                signingBonus: this.runde(wageDemand * (vorvertrag ? 10 : 6)),
                // Der Berater will mitverdienen: ein Teil der Ablöse plus
                // einige Wochengehälter, bei Vereinslosen mehr
                agentFee: this.beraterHonorar(askingPrice, wageDemand, ohneAbloese)
            },
            agreed: { fee: null, wage: null, years: null, signingBonus: null, agentFee: null, einsatzPraemie: 0, torPraemie: 0 },
            lastOffer: null,
            log: []
        };

        this.log(negotiation, state, "system",
            vorvertrag
                ? `Sein Vertrag bei ${sellerClub.name} läuft aus. Es geht um einen Vorvertrag: ablösefrei, Wechsel zum Saisonwechsel.`
                : (sellerClub
                    ? `Verhandlung mit ${sellerClub.name} über ${player.name} eröffnet. Geforderte Ablöse: ${this.formatMoney(askingPrice)}.`
                    : `${player.name} ist vereinslos. Es geht direkt um die persönlichen Konditionen.`));
        if (erlaubnis && erlaubnis.noetig) this.log(negotiation, state, "system", erlaubnis.text);

        if (openingFee !== null && !vorvertrag) {
            this.ensureList(state).push(negotiation);
            return this.submitOffer(state, negotiation.id, { fee: openingFee });
        }

        this.ensureList(state).push(negotiation);
        return { success: true, negotiation };
    }

    /** Die Arbeitserlaubnis (England) - oder null, wenn es keine Prüfung gibt */
    static erlaubnisPruefung(state, player, club) {
        const erlaubnis = _negResolve("ArbeitserlaubnisEngine", "./arbeitserlaubnisEngine.js");
        if (!erlaubnis || !player || !club) return null;
        return erlaubnis.pruefe(state, player, club);
    }

    /**
     * Darf ein Verein diesem Spieler einen Vorvertrag anbieten? null, wenn
     * ja - sonst der Grund. Ab dem 1. Januar geht das bei jedem, dessen
     * Vertrag zum Saisonende ausläuft, in der Sommerpause bei jedem, der
     * nicht verlängert hat. Eine Ablöse fällt nicht an, gewechselt wird zum
     * Saisonwechsel - auch bei geschlossenem Transferfenster.
     */
    static vorvertragHindernis(state, player, clubId = state?.userClubId) {
        if (!player) return "Spieler nicht gefunden.";
        if (!player.clubId) return "Er ist vereinslos - er kann sofort kommen.";
        if (player.clubId === clubId) return "Er spielt schon bei uns.";
        if (player.leihe) return "Er ist nur ausgeliehen.";
        if (player.vorvertrag) return `Er hat bereits bei ${player.vorvertrag.clubName} unterschrieben.`;
        const season = _negResolve("SeasonEngine", "./seasonEngine.js");
        if (!season || typeof season.vorvertragsZeit !== "function") return "Vorverträge sind nicht verfügbar.";
        if (!season.vertragEndetZumWechsel(state, player)) return "Sein Vertrag läuft nicht zum Saisonende aus.";
        if (!season.vorvertragsZeit(state)) return "Einen Vorvertrag darf er erst ab dem 1. Januar unterschreiben.";
        return null;
    }

    /**
     * Eröffnet die Vertragsgespräche für ein Nachwuchstalent.
     *
     * Die Beförderung ist damit kein Sofortklick mehr: Der Berater will einen
     * Erstvertrag aushandeln, und das dauert seine Tage.
     */
    static startYouthPromotion(state, clubId, prospectId) {
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };

        const prospect = this.findProspect(state, club, prospectId);
        if (!prospect) return { success: false, error: "Jugendspieler nicht gefunden." };
        if (prospect.promoted) return { success: false, error: "Der Spieler wurde bereits befördert." };
        // Einen Profivertrag gibt es erst ab dem Mindestalter des Landes
        const youth = _negResolve("YouthEngine", "./youthEngine.js");
        const zuJung = youth && typeof youth.profiHindernis === "function" ? youth.profiHindernis(club, prospect) : null;
        if (zuJung) return { success: false, error: zuJung };

        const existing = this.getOpenNegotiations(state)
            .find(n => n.type === "youth_promotion" && String(n.prospectId) === String(prospectId));
        if (existing) return { success: false, error: "Die Vertragsgespräche laufen bereits.", negotiation: existing };

        const agent = this.getAgentFor(prospect);

        // Der erste Profivertrag orientiert sich an Potenzial und Ligastufe
        const level = club.level || 1;
        const basis = { 1: 9000, 2: 3500, 3: 1600, 4: 800, 5: 400, 6: 250, 7: 150 }[level] ?? 500;
        const talentFaktor = 0.7 + ((prospect.pot || 60) / 100);
        const wageDemand = Math.max(120, Math.round(basis * talentFaktor * agent.greed / 50) * 50);

        const negotiation = {
            id: `neg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: "youth_promotion",
            prospectId: prospect.id,
            playerName: prospect.name,
            playerPos: prospect.pos,
            clubId: clubId,
            sellerClubId: null,
            sellerClubName: null,
            agentName: agent.name,
            agentProfile: agent.profile,
            agentLabel: agent.label,
            stage: NEGOTIATION_STAGES.TERMS,
            status: NEGOTIATION_STATUS.AWAITING_US,
            openedDay: this.today(state),
            deadlineDay: this.today(state) + 10,
            replyDay: null,
            round: 0,
            patience: this.geduldMitRuf(state, agent.patience),
            demand: {
                fee: 0,
                wage: wageDemand,
                years: Math.min(3, this.maxJahre(state, { type: "youth_promotion", clubId, prospectId: prospect.id })),
                signingBonus: this.runde(wageDemand * 4),
                agentFee: this.runde(wageDemand * 2)
            },
            agreed: { fee: 0, wage: null, years: null, signingBonus: null, agentFee: null, einsatzPraemie: 0, torPraemie: 0 },
            lastOffer: null,
            log: []
        };

        this.log(negotiation, state, "agent",
            `Berater ${agent.name}: "${prospect.name} ist bereit für den Profikader. Wir sprechen über ${this.formatMoney(wageDemand)} pro Woche und eine Laufzeit von drei Jahren."`);

        this.ensureList(state).push(negotiation);
        return { success: true, negotiation };
    }

    // -------------------------------------------------------------- Leihe

    /**
     * Eine Leihe verhandeln statt per Knopfdruck. Der Stammverein nennt
     * Gehaltsanteil, Leihgebühr und die Einsatzzusage, die er erwartet. Wer
     * bei uns Stammspieler wäre, will das auch zugesagt bekommen - sonst kommt
     * er nicht. Die Antwort dauert ein bis drei Tage, am Deadline Day nicht.
     */
    static startLeihVerhandlung(state, playerId, angebot = null) {
        const loan = _negResolve("LoanEngine", "./loanEngine.js");
        if (!loan) return { success: false, error: "Leihen sind nicht verfügbar." };
        const player = (state.players || []).find(p => String(p.id) === String(playerId));
        const hindernis = loan.leihHindernis(state, player);
        if (hindernis) return { success: false, error: hindernis };
        const existing = this.getOpenNegotiations(state)
            .find(n => String(n.playerId) === String(playerId) && n.clubId === state.userClubId);
        if (existing) return { success: false, error: "Für diesen Spieler läuft bereits eine Verhandlung.", negotiation: existing };
        const eintrag = loan.leihmarkt(state, Infinity).find(e => String(e.playerId) === String(playerId));
        if (!eintrag) return { success: false, error: "Sein Verein gibt ihn nicht ab." };
        const club = state.clubs.find(c => c.id === state.userClubId);
        const agent = this.getAgentFor(player);
        const wunsch = loan.rolleBei(state, player, club) || "Talent";
        const rolle = this.ROLLEN.indexOf(wunsch) > this.ROLLEN.indexOf(eintrag.rolle) ? wunsch : eintrag.rolle;

        const negotiation = {
            id: `neg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: "leihe",
            playerId: player.id,
            playerName: player.name,
            playerPos: player.pos,
            clubId: club.id,
            sellerClubId: eintrag.clubId,
            sellerClubName: eintrag.clubName,
            agentName: agent.name,
            agentProfile: agent.profile,
            agentLabel: agent.label,
            stage: NEGOTIATION_STAGES.LOAN,
            status: NEGOTIATION_STATUS.AWAITING_US,
            openedDay: this.today(state),
            deadlineDay: this.today(state) + 10,
            replyDay: null,
            round: 0,
            patience: this.geduldMitRuf(state, 70),
            demand: {
                lohnAnteil: eintrag.lohnAnteil,
                // Weiter als zwanzig Prozentpunkte geht der Stammverein nicht herunter
                minAnteil: Math.max(0.3, Math.round((eintrag.lohnAnteil - 0.2) * 20) / 20),
                gebuehr: eintrag.gebuehr,
                rolle,
                kaufoption: eintrag.kaufoption,
                optionsAufschlag: eintrag.optionsAufschlag,
                wage: eintrag.wage
            },
            agreed: {},
            lastOffer: null,
            log: []
        };
        this.log(negotiation, state, "club",
            `${eintrag.clubName} gibt ${player.name} bis zum Saisonende ab: ${Math.round(eintrag.lohnAnteil * 100)} % des Gehalts`
            + `${eintrag.gebuehr ? `, Leihgebühr ${this.formatMoney(eintrag.gebuehr)}` : ", ohne Leihgebühr"}, Einsatz als ${this.rolleText(eintrag.rolle)}.`);
        if (rolle !== eintrag.rolle) {
            this.log(negotiation, state, "agent", `Berater ${agent.name}: "Er kommt nur, wenn er als ${rolle} eingeplant ist."`);
        }
        this.ensureList(state).push(negotiation);
        if (angebot) return this.submitOffer(state, negotiation.id, angebot);
        return { success: true, negotiation };
    }

    /** "Stammspieler", "Rotation" - und "Talent" heißt: keine Einsatzzusage */
    static rolleText(rolle) {
        return rolle === "Talent" ? "Talent ohne Einsatzzusage" : rolle;
    }

    // ------------------------------------------------ Talente anderer Akademien

    /**
     * Ein Talent aus einer anderen Akademie holen - in zwei Schritten wie
     * ein Transfer: Erst die Ausbildungsentschädigung mit seinem Verein, dann
     * entscheidet die Familie. Sie wägt Ruf und Perspektive ab; ein Handgeld
     * oder die Zusage, mit den Profis zu trainieren, kann sie überzeugen.
     */
    static startFremdtalent(state, talentId) {
        const youth = _negResolve("YouthEngine", "./youthEngine.js");
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!youth || !club || typeof youth.fremdeTalente !== "function") return { success: false, error: "Nicht verfügbar." };
        const t = youth.fremdeTalente(state).find(x => String(x.id) === String(talentId));
        if (!t) return { success: false, error: "Talent nicht gefunden." };
        const existing = this.getOpenNegotiations(state)
            .find(n => n.type === "fremdtalent" && String(n.prospectId) === String(talentId));
        if (existing) return { success: false, error: "Die Gespräche laufen bereits.", negotiation: existing };
        if (youth.akademiePlaetze(state, club).frei <= 0) return { success: false, error: "Die Akademie ist voll - erst muss ein Talent gehen oder befördert werden." };
        const negotiation = {
            id: `neg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: "fremdtalent",
            prospectId: t.id,
            playerName: t.name,
            playerPos: t.pos,
            clubId: club.id,
            sellerClubId: t.vonClubId,
            sellerClubName: t.vonClubName,
            agentName: `Familie ${String(t.name).split(" ").slice(-1)[0]}`,
            agentProfile: "family",
            agentLabel: "Eltern",
            stage: NEGOTIATION_STAGES.FEE,
            status: NEGOTIATION_STATUS.AWAITING_US,
            openedDay: this.today(state),
            deadlineDay: this.today(state) + 14,
            replyDay: null,
            round: 0,
            patience: this.geduldMitRuf(state, 80),
            demand: { fee: t.betrag, signingBonus: 0, wage: 0 },
            agreed: { fee: null, signingBonus: null, perspektive: false },
            lastOffer: null,
            log: []
        };
        this.log(negotiation, state, "club",
            `${t.vonClubName} lässt ${t.name} gehen - gegen eine Ausbildungsentschädigung von ${this.formatMoney(t.betrag)}.`);
        this.ensureList(state).push(negotiation);
        return { success: true, negotiation };
    }

    // --------------------------------------------------------- Deadline Day

    /** Braucht der Abschluss ein offenes Fenster? Ein Wechsel mit Ablöse und jede Leihe */
    static brauchtFenster(negotiation) {
        if (!negotiation) return false;
        if (negotiation.type === "leihe") return true;
        return negotiation.type === "transfer" && !negotiation.vorvertrag && !!negotiation.sellerClubId;
    }

    static istDeadlineDay(state) {
        const te = this.getTransferEngine();
        return !!(te && typeof te.istDeadlineDay === "function" && te.istDeadlineDay(state));
    }

    /**
     * Ist das Fenster zu, platzt, was dafür ein offenes Fenster braucht.
     * Vorher liefen solche Verhandlungen weiter - ein Spieler kam noch eine
     * Woche nach Fensterschluss. Gibt die geplatzten zurück.
     */
    static pruefeFenster(state) {
        const te = this.getTransferEngine();
        if (!te || typeof te.fensterHindernis !== "function" || !te.fensterHindernis(state)) return [];
        const heute = this.today(state);
        return this.getOpenNegotiations(state).filter(n => this.brauchtFenster(n)).map(n => {
            n.status = NEGOTIATION_STATUS.EXPIRED;
            n.closedDay = heute;
            this.log(n, state, "system", "Das Transferfenster ist geschlossen. Der Wechsel kommt nicht mehr zustande.");
            this.notify(state, n, `Fenster zu: ${n.playerName}`,
                `Die Gespräche um ${n.playerName} waren bis zum Fensterschluss nicht abgeschlossen. Erst im nächsten Fenster geht es wieder.`);
            return { negotiation: n, kind: "expired" };
        });
    }

    /**
     * Der Morgen des Deadline Day: Was noch geprüft wird, ist sofort
     * beantwortet - sonst käme die Antwort erst mit dem Tageswechsel, und
     * auf eine Gegenforderung ließe sich nicht mehr reagieren.
     */
    static deadlineMorgen(state) {
        if (!this.istDeadlineDay(state)) return [];
        const schritte = [];
        this.getOpenNegotiations(state)
            .filter(n => n.status === NEGOTIATION_STATUS.WAITING_REPLY && this.brauchtFenster(n))
            .forEach(n => this.antworteSofort(state, n).forEach(x => schritte.push(x)));
        return schritte;
    }

    /**
     * Deadline Day: Die Gegenseite antwortet noch heute, der Medizincheck
     * folgt am selben Tag. Gibt die Schritte zurück.
     */
    static antworteSofort(state, negotiation) {
        const schritte = [];
        for (let i = 0; i < 4 && negotiation.status === NEGOTIATION_STATUS.WAITING_REPLY; i++) {
            negotiation.replyDay = this.today(state);
            const schritt = this.evaluateOffer(state, negotiation);
            if (schritt) schritte.push(schritt);
        }
        return schritte;
    }

    /**
     * Die längste Laufzeit, die in dieser Verhandlung möglich ist: Ein
     * Minderjähriger darf höchstens drei Jahre unterschreiben.
     */
    static maxJahre(state, negotiation) {
        const ce = _negResolve("ContractEngine", "./contractEngine.js");
        if (!ce || typeof ce.maxLaufzeit !== "function" || !negotiation) return 5;
        let alter = null;
        if (negotiation.type === "youth_promotion") {
            const club = (state.clubs || []).find(c => c.id === negotiation.clubId);
            alter = this.findProspect(state, club, negotiation.prospectId)?.age;
        } else if (negotiation.playerId !== undefined) {
            alter = (state.players || []).find(p => p.id === negotiation.playerId)?.age;
        }
        return ce.maxLaufzeit(alter);
    }

    static findProspect(state, club, prospectId) {
        // Beim eigenen Verein gibt es nur eine Liste der Talente
        const youth = _negResolve("YouthEngine", "./youthEngine.js");
        if (youth && typeof youth.eigeneTalente === "function" && club?.id === state?.userClubId) youth.eigeneTalente(state);
        let prospect = club?.youthAcademy?.prospects?.find(p => String(p.id) === String(prospectId));
        if (!prospect && Array.isArray(state.youthAcademy?.prospects)) {
            prospect = state.youthAcademy.prospects.find(p => String(p.id) === String(prospectId));
        }
        return prospect || null;
    }

    // ------------------------------------------------------------- Angebot

    /**
     * Wir machen ein Angebot. Die Gegenseite antwortet nicht sofort, sondern
     * meldet sich in ein bis drei Tagen zurück.
     */
    static submitOffer(state, negotiationId, offer = {}) {
        const negotiation = this.findNegotiation(state, negotiationId);
        if (!negotiation) return { success: false, error: "Verhandlung nicht gefunden." };
        if (negotiation.status !== NEGOTIATION_STATUS.AWAITING_US) {
            return { success: false, error: "Die Gegenseite ist am Zug." };
        }

        const club = state.clubs.find(c => c.id === negotiation.clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };
        // Nach Fensterschluss geht kein Angebot mehr hinaus
        if (this.brauchtFenster(negotiation) && this.pruefeFenster(state).some(s => s.negotiation === negotiation)) {
            return { success: false, error: "Das Transferfenster ist geschlossen. Der Wechsel kommt nicht mehr zustande." };
        }

        if (negotiation.type === "fremdtalent" && negotiation.stage === NEGOTIATION_STAGES.FEE) {
            const fee = Math.max(0, Math.round(Number(offer.fee) || 0));
            if (fee > Math.max(0, club.balance || 0)) return { success: false, error: "Für die Ausbildungsentschädigung reicht das Geld nicht." };
            negotiation.lastOffer = { fee };
            this.log(negotiation, state, "us", `Angebot über eine Ausbildungsentschädigung von ${this.formatMoney(fee)}.`);
        } else if (negotiation.type === "fremdtalent" && negotiation.stage === NEGOTIATION_STAGES.TERMS) {
            const bonus = Math.max(0, Math.round(Number(offer.signingBonus) || 0));
            const perspektive = !!offer.perspektive;
            if ((negotiation.agreed.fee || 0) + bonus > Math.max(0, club.balance || 0)) {
                return { success: false, error: "Entschädigung und Handgeld zusammen übersteigen den Kontostand." };
            }
            negotiation.lastOffer = { signingBonus: bonus, perspektive };
            this.log(negotiation, state, "us", `Jugendvertrag angeboten${bonus ? `, Handgeld ${this.formatMoney(bonus)}` : ", ohne Handgeld"}${perspektive ? ", Zusage: Training mit den Profis" : ""}.`);
        } else if (negotiation.stage === NEGOTIATION_STAGES.LOAN) {
            const d = negotiation.demand;
            // In Schritten von fünf Prozent
            const anteil = Math.max(0, Math.min(1, Math.round((Number(offer.lohnAnteil) || 0) * 20) / 20));
            const gebuehr = Math.max(0, Math.round(Number(offer.gebuehr) || 0));
            const rolle = this.ROLLEN.includes(offer.rolle) ? offer.rolle : d.rolle;
            const kaufoption = !!offer.kaufoption && !!d.kaufoption;
            const kosten = gebuehr + (kaufoption ? (d.optionsAufschlag || 0) : 0);
            if (kosten > Math.max(0, club.balance || 0)) return { success: false, error: "Für die Leihgebühr reicht das Geld nicht." };
            negotiation.lastOffer = { lohnAnteil: anteil, gebuehr, rolle, kaufoption };
            this.log(negotiation, state, "us",
                `Leihangebot: ${Math.round(anteil * 100)} % des Gehalts, ${gebuehr ? `Leihgebühr ${this.formatMoney(gebuehr)}` : "ohne Leihgebühr"}, Einsatz als ${this.rolleText(rolle)}`
                + `${kaufoption ? `, mit Kaufoption für ${this.formatMoney(d.kaufoption)} (Aufschlag ${this.formatMoney(d.optionsAufschlag || 0)})` : ""}.`);
        } else if (negotiation.stage === NEGOTIATION_STAGES.FEE) {
            const fee = Math.max(0, Math.round(Number(offer.fee) || 0));
            // In Raten muss nur die Anzahlung ins Transferbudget passen - die
            // Raten aber müssen auf dem Konto gedeckt sein
            const fin = this.getFinanceEngine();
            const zahlweise = fin && typeof fin.zahlweise === "function" ? fin.zahlweise(offer.zahlweise) : "sofort";
            const plan = zahlweise !== "sofort" ? fin.ratenPlan(fee, zahlweise) : null;
            const sofort = plan ? plan.anzahlung : fee;
            if (sofort > (club.transferBudget || 0)) {
                return { success: false, error: plan
                    ? `Schon die Anzahlung von ${this.formatMoney(sofort)} übersteigt das Transferbudget (verfügbar ${this.formatMoney(club.transferBudget || 0)}).`
                    : `Das Transferbudget reicht nicht: verfügbar ${this.formatMoney(club.transferBudget || 0)}.` };
            }
            if (plan) {
                const schulden = fin.ratenUebersicht(state, club.id).schulden;
                if (schulden + fee > Math.max(0, club.balance || 0)) {
                    return { success: false, error: `Die Raten wären nicht gedeckt: Mit dieser Ablöse schuldete der Verein ${this.formatMoney(schulden + fee)}, auf dem Konto liegen ${this.formatMoney(Math.max(0, club.balance || 0))}.` };
                }
            }
            negotiation.lastOffer = plan ? { fee, zahlweise } : { fee };
            this.log(negotiation, state, "us", `Angebot über eine Ablöse von ${this.formatMoney(fee)} abgegeben${plan ? ` (${fin.ratenText(fee, zahlweise)})` : ""}.`);
        } else if (negotiation.stage === NEGOTIATION_STAGES.TERMS) {
            const wage = Math.max(0, Math.round(Number(offer.wage) || 0));
            const years = Math.max(1, Math.min(5, Math.round(Number(offer.years) || 3)));
            const maxJahre = this.maxJahre(state, negotiation);
            if (years > maxJahre) {
                return { success: false, error: `${negotiation.playerName} ist minderjährig und darf höchstens ${maxJahre} Jahre unterschreiben.` };
            }
            // Ohne Angabe gilt die Forderung - Number(undefined) wäre NaN, und "??" griffe nicht
            const bonus = Math.max(0, Math.round(Number(offer.signingBonus ?? negotiation.demand.signingBonus) || 0));
            const honorar = Math.max(0, Math.round(offer.agentFee !== undefined ? Number(offer.agentFee) || 0 : (negotiation.demand.agentFee || 0)));
            const einsatzPraemie = Math.max(0, Math.round(Number(offer.einsatzPraemie) || 0));
            const torPraemie = Math.max(0, Math.round(Number(offer.torPraemie) || 0));
            // Unter einem Gehaltsdeckel (Auflage eines Geldgebers) geht kein Vertrag darüber
            const investoren = negotiation.type === "transfer"
                ? ((typeof InvestorEngine !== "undefined" && InvestorEngine) ? InvestorEngine
                    : (typeof require !== "undefined" ? (() => { try { return require("./investorEngine.js").InvestorEngine; } catch (e) { return null; } })() : null))
                : null;
            const deckel = investoren && typeof investoren.gehaltsHindernis === "function" ? investoren.gehaltsHindernis(state, club, wage) : null;
            if (deckel) return { success: false, error: deckel };
            // Weitere Klauseln (KlauselEngine): Steigerung, Auf- und Abstieg, Mindestablöse, Option
            const ke = this.getKlauselEngine();
            const klauseln = ke ? ke.normalisiere(offer.klauseln || {}, club) : {};
            negotiation.lastOffer = { wage, years, signingBonus: bonus, agentFee: honorar, einsatzPraemie, torPraemie };
            if (Object.keys(klauseln).length) negotiation.lastOffer.klauseln = klauseln;
            const praemien = (einsatzPraemie || torPraemie)
                ? `, Prämien ${this.formatMoney(einsatzPraemie)} je Einsatz und ${this.formatMoney(torPraemie)} je Tor` : "";
            const klauselText = ke && Object.keys(klauseln).length ? `; Klauseln: ${ke.texte(klauseln).join(", ")}` : "";
            this.log(negotiation, state, "us",
                `Konditionen angeboten: ${this.formatMoney(wage)} pro Woche, ${years} Jahre Laufzeit, Handgeld ${this.formatMoney(bonus)}, Beraterhonorar ${this.formatMoney(honorar)}${praemien}${klauselText}.`);
        } else {
            return { success: false, error: "In dieser Phase ist kein Angebot vorgesehen." };
        }

        negotiation.round++;
        negotiation.status = NEGOTIATION_STATUS.WAITING_REPLY;
        // Eine Familie überlegt länger als ein Verein
        negotiation.replyDay = this.today(state) + (negotiation.type === "fremdtalent" && negotiation.stage === NEGOTIATION_STAGES.TERMS
            ? 2 + Math.floor(Math.random() * 2)
            : this.replyDelay({ profile: negotiation.agentProfile }));

        // Deadline Day: keine Bedenkzeit, sonst wäre am letzten Tag nichts mehr zu machen
        if (this.brauchtFenster(negotiation) && this.istDeadlineDay(state)) {
            const schritte = this.antworteSofort(state, negotiation);
            const letzter = (negotiation.log || [])[negotiation.log.length - 1];
            return { success: true, negotiation, sofort: true, schritte,
                message: `⏰ Deadline Day - die Antwort kommt sofort: ${letzter ? letzter.text : this.describe(negotiation)}` };
        }

        return { success: true, negotiation, message: "Das Angebot liegt der Gegenseite vor. Eine Antwort dauert einige Tage." };
    }

    /** Verhandlung abbrechen */
    static withdraw(state, negotiationId) {
        const negotiation = this.findNegotiation(state, negotiationId);
        if (!negotiation) return { success: false, error: "Verhandlung nicht gefunden." };

        negotiation.status = NEGOTIATION_STATUS.WITHDRAWN;
        negotiation.closedDay = this.today(state);
        this.log(negotiation, state, "us", "Die Verhandlung wurde von uns abgebrochen.");
        return { success: true, negotiation };
    }

    // -------------------------------------------------------- Tagesablauf

    /**
     * Ein Tag vergeht: fällige Antworten werden ausgewertet, abgelaufene
     * Verhandlungen geschlossen.
     */
    static processDay(state) {
        const heute = this.today(state);
        // Fenster zu: Was dafür ein Fenster braucht, ist geplatzt
        const ereignisse = this.pruefeFenster(state);
        const deadline = this.istDeadlineDay(state);

        this.ensureList(state).forEach(negotiation => {
            if (negotiation.status !== NEGOTIATION_STATUS.WAITING_REPLY &&
                negotiation.status !== NEGOTIATION_STATUS.AWAITING_US) return;

            // Frist abgelaufen
            if (heute > negotiation.deadlineDay) {
                negotiation.status = NEGOTIATION_STATUS.EXPIRED;
                negotiation.closedDay = heute;
                this.log(negotiation, state, "agent", "Die Frist ist verstrichen. Die Gespräche sind beendet.");
                this.notify(state, negotiation, `Verhandlung geplatzt: ${negotiation.playerName}`,
                    `Die Gespräche um ${negotiation.playerName} sind ergebnislos ausgelaufen.`);
                ereignisse.push({ negotiation, kind: "expired" });
                return;
            }

            if (negotiation.status !== NEGOTIATION_STATUS.WAITING_REPLY) return;
            // Am Deadline Day wartet niemand mehr - auch nicht auf den Medizincheck
            if (deadline && this.brauchtFenster(negotiation)) {
                this.antworteSofort(state, negotiation).forEach(s => ereignisse.push(s));
                return;
            }
            if (negotiation.replyDay === null || heute < negotiation.replyDay) return;

            ereignisse.push(this.evaluateOffer(state, negotiation));
        });

        return ereignisse.filter(Boolean);
    }

    /** Die Gegenseite antwortet auf unser Angebot */
    static evaluateOffer(state, negotiation) {
        const heute = this.today(state);

        if (negotiation.stage === NEGOTIATION_STAGES.MEDICAL) {
            return this.finishMedical(state, negotiation);
        }
        if (negotiation.stage === NEGOTIATION_STAGES.LOAN) return this.bewerteLeihe(state, negotiation);
        if (negotiation.type === "fremdtalent" && negotiation.stage === NEGOTIATION_STAGES.TERMS) return this.bewerteFamilie(state, negotiation);

        const offer = negotiation.lastOffer || {};
        const istAblöse = negotiation.stage === NEGOTIATION_STAGES.FEE;
        const gefordert = istAblöse ? negotiation.demand.fee : negotiation.demand.wage;
        // Prämien ersetzen einen Teil des Grundgehalts - der Spieler rechnet
        // sie mit Abschlag ein, sie sind ja nicht sicher
        // Raten sind dem Verkäufer weniger wert als Geld auf dem Konto
        const fin = this.getFinanceEngine();
        const verkaeufer = state.clubs.find(c => c.id === negotiation.sellerClubId);
        const ablöseWert = offer.zahlweise && fin && typeof fin.ratenWert === "function"
            ? fin.ratenWert(offer.fee || 0, offer.zahlweise, verkaeufer) : (offer.fee || 0);
        // Klauseln rechnet der Spieler ins Gehalt ein - mal nimmt er dafür weniger, mal will er mehr
        const geboten = istAblöse ? ablöseWert : Math.round((offer.wage || 0) * this.klauselFaktor(state, negotiation, offer)) + this.praemienWert(state, negotiation, offer);
        const quote = gefordert > 0 ? geboten / gefordert : 1;

        // Kurze Laufzeiten kosten den Berater Provision - das schmeckt ihm nicht
        let bewertung = quote;
        if (!istAblöse) {
            const jahre = offer.years || 3;
            bewertung *= jahre <= 1 ? 0.9 : (jahre >= 4 ? 1.05 : 1.0);
            const bonusQuote = negotiation.demand.signingBonus > 0
                ? (offer.signingBonus || 0) / negotiation.demand.signingBonus
                : 1;
            // Das Honorar entscheidet der Berater selbst - darunter wird er zäh
            const honorarQuote = (negotiation.demand.agentFee || 0) > 0
                ? (offer.agentFee ?? negotiation.demand.agentFee) / negotiation.demand.agentFee
                : 1;
            bewertung = bewertung * 0.75 + Math.min(1.2, bonusQuote) * 0.13 + Math.min(1.2, honorarQuote) * 0.12;
        }

        // Annahme
        if (bewertung >= 0.97) {
            return this.acceptCurrentOffer(state, negotiation, istAblöse, offer);
        }

        // Geduld schwindet, je niedriger das Angebot ausfällt
        const verlust = Math.round((1 - Math.min(1, bewertung)) * 45) + negotiation.round * 3;
        negotiation.patience = Math.max(0, negotiation.patience - verlust);

        if (negotiation.patience <= 0 || bewertung < 0.6) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            const text = istAblöse
                ? `${negotiation.sellerClubName} bricht die Gespräche ab - das Angebot war zu weit entfernt.`
                : `Berater ${negotiation.agentName} bricht die Gespräche ab. Das Angebot war nicht seriös.`;
            this.log(negotiation, state, istAblöse ? "club" : "agent", text);
            this.notify(state, negotiation, `Verhandlung gescheitert: ${negotiation.playerName}`, text);
            return { negotiation, kind: "rejected" };
        }
        return this.counterOffer(state, negotiation, istAblöse, geboten);
    }

    /** Die Gegenseite nimmt unser Angebot an und die nächste Phase beginnt */
    static acceptCurrentOffer(state, negotiation, istAblöse, offer) {
        const heute = this.today(state);

        if (istAblöse && negotiation.type === "fremdtalent") {
            negotiation.agreed.fee = offer.fee;
            negotiation.stage = NEGOTIATION_STAGES.TERMS;
            negotiation.status = NEGOTIATION_STATUS.AWAITING_US;
            negotiation.replyDay = null;
            this.log(negotiation, state, "club",
                `${negotiation.sellerClubName} ist mit ${this.formatMoney(offer.fee)} einverstanden. Jetzt entscheidet die Familie.`);
            this.notify(state, negotiation, `Einigung mit ${negotiation.sellerClubName}: ${negotiation.playerName}`,
                `${negotiation.sellerClubName} lässt ${negotiation.playerName} für ${this.formatMoney(offer.fee)} gehen. Jetzt fehlt das Ja der Familie: Machen Sie ihr ein Angebot zum Jugendvertrag.`, "youth");
            return { negotiation, kind: "fee_agreed" };
        }
        if (istAblöse) {
            negotiation.agreed.fee = offer.fee;
            if (offer.zahlweise && offer.zahlweise !== "sofort") negotiation.agreed.zahlweise = offer.zahlweise;
            negotiation.stage = NEGOTIATION_STAGES.TERMS;
            negotiation.status = NEGOTIATION_STATUS.AWAITING_US;
            negotiation.replyDay = null;
            const fin = this.getFinanceEngine();
            const raten = negotiation.agreed.zahlweise && fin ? ` (${fin.ratenText(offer.fee, negotiation.agreed.zahlweise)})` : "";
            this.log(negotiation, state, "club",
                `${negotiation.sellerClubName} stimmt einer Ablöse von ${this.formatMoney(offer.fee)}${raten} zu. Jetzt geht es um die persönlichen Konditionen.`);
            this.notify(state, negotiation, `Einigung über die Ablöse: ${negotiation.playerName}`,
                `${negotiation.sellerClubName} akzeptiert ${this.formatMoney(offer.fee)}. Berater ${negotiation.agentName} erwartet nun Ihr Angebot über die persönlichen Konditionen (Forderung: ${this.formatMoney(negotiation.demand.wage)} pro Woche).`);
            return { negotiation, kind: "fee_agreed" };
        }

        negotiation.agreed.wage = offer.wage;
        negotiation.agreed.years = offer.years;
        negotiation.agreed.signingBonus = offer.signingBonus;
        negotiation.agreed.agentFee = offer.agentFee ?? negotiation.demand.agentFee ?? 0;
        negotiation.agreed.einsatzPraemie = offer.einsatzPraemie || 0;
        negotiation.agreed.torPraemie = offer.torPraemie || 0;
        negotiation.agreed.klauseln = offer.klauseln || null;

        if (negotiation.type === "youth_promotion") {
            return this.completeYouthPromotion(state, negotiation);
        }
        if (negotiation.vorvertrag) {
            return this.completeVorvertrag(state, negotiation);
        }

        negotiation.stage = NEGOTIATION_STAGES.MEDICAL;
        negotiation.status = NEGOTIATION_STATUS.WAITING_REPLY;
        const eilig = this.brauchtFenster(negotiation) && this.istDeadlineDay(state);
        negotiation.replyDay = eilig ? heute : heute + 2;
        this.log(negotiation, state, "agent",
            `Berater ${negotiation.agentName} ist einverstanden. Der Medizincheck ist ${eilig ? "noch für heute" : "für die nächsten Tage"} angesetzt.`);
        this.notify(state, negotiation, `Konditionen geklärt: ${negotiation.playerName}`,
            `${negotiation.playerName} ist sich mit uns einig. Der Medizincheck steht ${eilig ? "noch heute" : "in zwei Tagen"} an.`);
        return { negotiation, kind: "terms_agreed" };
    }

    /** Die Gegenseite macht einen Gegenvorschlag */
    static counterOffer(state, negotiation, istAblöse, geboten) {
        const offer = negotiation.lastOffer || {};
        // Gegenvorschlag: Die Gegenseite bewegt sich ein Stück auf uns zu.
        // Landet ihre neue Forderung auf oder unter unserem Gebot, ist die
        // Einigung erreicht - sonst würde man sich endlos gegenseitig
        // dieselbe Zahl zuschieben.
        const nachgeben = 0.04 + (negotiation.round * 0.02);
        const neueForderung = this.runde(istAblöse
            ? negotiation.demand.fee * (1 - nachgeben)
            : negotiation.demand.wage * (1 - nachgeben));

        if (neueForderung <= geboten) {
            if (istAblöse) negotiation.demand.fee = geboten;
            else negotiation.demand.wage = geboten;
            return this.acceptCurrentOffer(state, negotiation, istAblöse, offer);
        }

        if (istAblöse) {
            negotiation.demand.fee = neueForderung;
            // In Raten rechnet der Verkäufer mit Abschlag - so viel müsste es dann sein
            const inRaten = offer.zahlweise && offer.zahlweise !== "sofort" && geboten > 0;
            const nominal = inRaten ? this.runde(neueForderung * (offer.fee || 0) / geboten) : 0;
            const ratenHinweis = inRaten ? ` In Raten wie angeboten entspräche das etwa ${this.formatMoney(nominal)}.` : "";
            this.log(negotiation, state, "club",
                `${negotiation.sellerClubName} lehnt ab und fordert ${this.formatMoney(neueForderung)}.${ratenHinweis}`);
            this.notify(state, negotiation, `Gegenforderung: ${negotiation.playerName}`,
                `${negotiation.sellerClubName} lehnt ${this.formatMoney(offer.fee || geboten)}${inRaten ? " in Raten" : ""} ab und fordert ${this.formatMoney(neueForderung)}.${ratenHinweis} Verbleibende Geduld: ${negotiation.patience}%.`);
        } else {
            negotiation.demand.wage = neueForderung;
            this.log(negotiation, state, "agent",
                `Berater ${negotiation.agentName} fordert ${this.formatMoney(neueForderung)} pro Woche.`);
            this.notify(state, negotiation, `Gegenforderung: ${negotiation.playerName}`,
                `Berater ${negotiation.agentName} lehnt ${this.formatMoney(geboten)} ab und fordert ${this.formatMoney(neueForderung)} pro Woche. Verbleibende Geduld: ${negotiation.patience}%.`);
        }

        negotiation.status = NEGOTIATION_STATUS.AWAITING_US;
        negotiation.replyDay = null;
        return { negotiation, kind: "counter" };
    }

    /**
     * Der Stammverein prüft das Leihangebot: Gehaltsanteil und Gebühr wie
     * eine Ablöse, die Einsatzzusage als Bedingung. Wer weniger Einsatz
     * zusagt als verlangt, braucht mehr Geld, um zu überzeugen.
     */
    static bewerteLeihe(state, negotiation) {
        const heute = this.today(state);
        const o = negotiation.lastOffer || {};
        const d = negotiation.demand;
        const anteilQuote = d.lohnAnteil > 0 ? (o.lohnAnteil || 0) / d.lohnAnteil : 1;
        const gebuehrQuote = d.gebuehr > 0 ? (o.gebuehr || 0) / d.gebuehr : 1;
        const stufen = this.ROLLEN.indexOf(o.rolle) - this.ROLLEN.indexOf(d.rolle);
        const rollenFaktor = stufen < 0 ? Math.pow(0.85, -stufen) : 1;
        const bewertung = (d.gebuehr > 0 ? Math.min(1.2, anteilQuote) * 0.6 + Math.min(1.2, gebuehrQuote) * 0.4 : Math.min(1.2, anteilQuote)) * rollenFaktor;

        if (bewertung >= 0.97 && stufen >= 0) return this.schliesseLeihe(state, negotiation);

        const verlust = Math.round((1 - Math.min(1, bewertung)) * 45) + negotiation.round * 3;
        negotiation.patience = Math.max(0, negotiation.patience - verlust);
        if (negotiation.patience <= 0 || bewertung < 0.6) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            const text = stufen < 0
                ? `Berater ${negotiation.agentName}: "Ohne Zusage als ${d.rolle} kommt er nicht." Die Gespräche sind beendet.`
                : `${negotiation.sellerClubName} bricht die Gespräche ab - so geben wir ihn nicht her.`;
            this.log(negotiation, state, stufen < 0 ? "agent" : "club", text);
            this.notify(state, negotiation, `Leihe gescheitert: ${negotiation.playerName}`, text);
            return { negotiation, kind: "rejected" };
        }

        // Gegenvorschlag: Der Stammverein geht ein Stück herunter, die Einsatzzusage bleibt
        const nachgeben = 0.04 + negotiation.round * 0.02;
        d.lohnAnteil = Math.max(d.minAnteil || 0.3, Math.round(d.lohnAnteil * (1 - nachgeben) * 20) / 20);
        d.gebuehr = this.runde(d.gebuehr * (1 - nachgeben));
        if (stufen >= 0 && (o.lohnAnteil || 0) + 1e-9 >= d.lohnAnteil && (o.gebuehr || 0) >= d.gebuehr) return this.schliesseLeihe(state, negotiation);
        const text = `${negotiation.sellerClubName} will ${Math.round(d.lohnAnteil * 100)} % des Gehalts${d.gebuehr ? ` und ${this.formatMoney(d.gebuehr)} Leihgebühr` : ""}`
            + `${stufen < 0 ? ` - und einen Einsatz als ${d.rolle}` : ""}.`;
        this.log(negotiation, state, "club", text);
        this.notify(state, negotiation, `Gegenforderung: ${negotiation.playerName}`, `${text} Verbleibende Geduld: ${negotiation.patience}%.`);
        negotiation.status = NEGOTIATION_STATUS.AWAITING_US;
        negotiation.replyDay = null;
        return { negotiation, kind: "counter" };
    }

    /** Leihe perfekt: Er spielt bis zum Saisonende bei uns */
    static schliesseLeihe(state, negotiation) {
        const heute = this.today(state);
        const loan = _negResolve("LoanEngine", "./loanEngine.js");
        const o = negotiation.lastOffer || {};
        const d = negotiation.demand;
        const res = loan ? loan.ausleihen(state, negotiation.playerId, o.lohnAnteil, {
            kaufoption: !!o.kaufoption,
            vereinbart: { stammvereinId: negotiation.sellerClubId, gebuehr: o.gebuehr || 0, rolle: o.rolle || d.rolle, kaufoption: d.kaufoption, optionsAufschlag: d.optionsAufschlag || 0 }
        }) : { success: false, error: "Leihen sind nicht verfügbar." };
        negotiation.closedDay = heute;
        if (!res.success) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            this.log(negotiation, state, "system", `Die Leihe kommt nicht zustande: ${res.error}`);
            this.notify(state, negotiation, `Leihe gescheitert: ${negotiation.playerName}`, res.error);
            return { negotiation, kind: "failed" };
        }
        negotiation.status = NEGOTIATION_STATUS.ACCEPTED;
        negotiation.stage = NEGOTIATION_STAGES.DONE;
        negotiation.agreed = Object.assign({}, o);
        this.log(negotiation, state, "club", `${negotiation.sellerClubName} ist einverstanden: ${negotiation.playerName} spielt bis zum Saisonende für uns.`);
        return { negotiation, kind: "completed" };
    }

    /**
     * Die Familie eines fremden Talents entscheidet. Fehlt ihr etwas, sagt
     * sie, welches Handgeld sie überzeugen würde; holt ihn auch das nicht,
     * bleibt er, wo er ist.
     */
    static bewerteFamilie(state, negotiation) {
        const heute = this.today(state);
        const youth = _negResolve("YouthEngine", "./youthEngine.js");
        const club = (state.clubs || []).find(c => c.id === negotiation.clubId);
        const t = youth ? youth.fremdeTalente(state).find(x => String(x.id) === String(negotiation.prospectId)) : null;
        const o = negotiation.lastOffer || {};
        if (!youth || !club || !t) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            this.log(negotiation, state, "system", "Das Talent ist nicht mehr zu haben.");
            return { negotiation, kind: "failed" };
        }
        if (youth.fremdWille(state, club, t, { handgeld: o.signingBonus, perspektive: o.perspektive }) >= youth.FREMD_JA) {
            return this.completeFremdtalent(state, negotiation, t);
        }
        const noetig = youth.fremdHandgeldFuer(state, club, t, !!o.perspektive);
        negotiation.patience = Math.max(0, negotiation.patience - 25 - negotiation.round * 5);
        if (noetig === null || negotiation.patience <= 0) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            const text = `${negotiation.playerName} bleibt bei ${negotiation.sellerClubName}. Die Familie sieht seine Zukunft dort.`;
            this.log(negotiation, state, "agent", text);
            this.notify(state, negotiation, `Absage: ${negotiation.playerName}`, text, "youth");
            return { negotiation, kind: "rejected" };
        }
        negotiation.demand.signingBonus = noetig;
        // Die Zusage, bei den Profis mitzutrainieren, gibt es erst ab 16
        const profisMoeglich = !o.perspektive && (t.age || 0) >= (youth.MIT_PROFIS?.abAlter ?? 16);
        const mitProfis = profisMoeglich ? youth.fremdHandgeldFuer(state, club, t, true) : null;
        const alternative = mitProfis === null || mitProfis >= noetig ? ""
            : (mitProfis === 0 ? " - oder schon mit der Zusage, bei den Profis mitzutrainieren"
                : ` - mit der Zusage, bei den Profis mitzutrainieren, reichten ${this.formatMoney(mitProfis)}`);
        const text = `Die Familie zögert. Mit einem Handgeld von ${this.formatMoney(noetig)} wäre ${negotiation.playerName} dabei${alternative}.`;
        this.log(negotiation, state, "agent", text);
        this.notify(state, negotiation, `Die Familie zögert: ${negotiation.playerName}`, text, "youth");
        negotiation.status = NEGOTIATION_STATUS.AWAITING_US;
        negotiation.replyDay = null;
        return { negotiation, kind: "counter" };
    }

    /** Das fremde Talent kommt in die Akademie */
    static completeFremdtalent(state, negotiation, talent) {
        const youth = _negResolve("YouthEngine", "./youthEngine.js");
        const o = negotiation.lastOffer || {};
        const res = youth.holeFremdesTalent(state, talent.id, Math.random, {
            zugesagt: true, betrag: negotiation.agreed.fee ?? talent.betrag, handgeld: o.signingBonus || 0, perspektive: !!o.perspektive
        });
        negotiation.closedDay = this.today(state);
        if (!res.success || !res.kommt) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            this.log(negotiation, state, "system", res.error || res.text || "Der Wechsel ist gescheitert.");
            return { negotiation, kind: "failed" };
        }
        negotiation.status = NEGOTIATION_STATUS.ACCEPTED;
        negotiation.stage = NEGOTIATION_STAGES.DONE;
        negotiation.agreed.signingBonus = o.signingBonus || 0;
        negotiation.agreed.perspektive = !!o.perspektive;
        this.log(negotiation, state, "agent", `Die Familie sagt zu: ${negotiation.playerName} kommt in unsere Akademie.`);
        return { negotiation, kind: "completed", talent: res.talent };
    }

    /** Medizincheck: selten, aber er kann einen Transfer noch kippen */
    static finishMedical(state, negotiation) {
        const player = state.players.find(p => String(p.id) === String(negotiation.playerId));
        const heute = this.today(state);

        const anfälligkeit = player?.hiddenAttributes?.injuryProneness ?? 10;
        const risiko = 0.04 + Math.max(0, anfälligkeit - 10) * 0.012;

        if (Math.random() < risiko) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            this.log(negotiation, state, "system",
                "Der Medizincheck deckt eine alte Verletzung auf. Der Transfer wird abgesagt.");
            this.notify(state, negotiation, `Medizincheck nicht bestanden: ${negotiation.playerName}`,
                `${negotiation.playerName} ist beim Medizincheck durchgefallen. Der Wechsel kommt nicht zustande.`);
            return { negotiation, kind: "medical_failed" };
        }

        return this.completeTransfer(state, negotiation);
    }

    /** Transfer abschließen */
    static completeTransfer(state, negotiation) {
        const transferEngine = this.getTransferEngine();
        const heute = this.today(state);

        if (!transferEngine || typeof transferEngine.executeTransfer !== "function") {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            return { negotiation, kind: "failed" };
        }

        // Die Ausnahmeplätze können inzwischen vergeben sein
        const player = state.players.find(p => String(p.id) === String(negotiation.playerId));
        const club = state.clubs.find(c => c.id === negotiation.clubId);
        const erlaubnis = this.erlaubnisPruefung(state, player, club);
        if (erlaubnis && !erlaubnis.erteilt) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            this.log(negotiation, state, "system", `Der Wechsel scheitert an der Arbeitserlaubnis. ${erlaubnis.text}`);
            this.notify(state, negotiation, `Keine Arbeitserlaubnis: ${negotiation.playerName}`,
                `${negotiation.playerName} bekommt keine Arbeitserlaubnis. ${erlaubnis.text}`);
            return { negotiation, kind: "failed" };
        }

        const ok = transferEngine.executeTransfer(
            state,
            negotiation.playerId,
            negotiation.clubId,
            negotiation.agreed.fee || 0,
            negotiation.agreed.wage || 0,
            negotiation.agreed.years || 3,
            { zahlweise: negotiation.agreed.zahlweise }
        );

        if (!ok) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            this.log(negotiation, state, "system", "Der Wechsel konnte nicht vollzogen werden.");
            return { negotiation, kind: "failed" };
        }

        // Handgeld und Beraterhonorar getrennt verbuchen, Prämien in den Vertrag
        this.zahleNebenkosten(state, negotiation);
        this.setzePraemien(state, negotiation.playerId, negotiation.agreed);
        this.setzeKlauseln(state, negotiation.playerId, negotiation.agreed);

        negotiation.status = NEGOTIATION_STATUS.ACCEPTED;
        negotiation.stage = NEGOTIATION_STAGES.DONE;
        negotiation.closedDay = heute;
        this.log(negotiation, state, "system",
            `${negotiation.playerName} hat unterschrieben: ${this.formatMoney(negotiation.agreed.fee || 0)} Ablöse, ${this.formatMoney(negotiation.agreed.wage || 0)} pro Woche.`);
        this.notify(state, negotiation, `Transfer perfekt: ${negotiation.playerName}`,
            `${negotiation.playerName} hat einen Vertrag über ${negotiation.agreed.years} Jahre unterschrieben. Ablöse: ${this.formatMoney(negotiation.agreed.fee || 0)}, Gehalt: ${this.formatMoney(negotiation.agreed.wage || 0)} pro Woche.`);

        return { negotiation, kind: "completed" };
    }

    /**
     * Vorvertrag unterschreiben: Der Spieler bleibt bis zum Saisonwechsel bei
     * seinem Verein und kommt dann ablösefrei zu den vereinbarten
     * Konditionen. Handgeld und Honorar werden mit der Unterschrift fällig.
     */
    static completeVorvertrag(state, negotiation) {
        const heute = this.today(state);
        const player = state.players.find(p => String(p.id) === String(negotiation.playerId));
        const grund = this.vorvertragHindernis(state, player, negotiation.clubId);
        if (grund) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            this.log(negotiation, state, "system", `Der Vorvertrag kommt nicht zustande: ${grund}`);
            this.notify(state, negotiation, `Vorvertrag geplatzt: ${negotiation.playerName}`, `Der Vorvertrag kommt nicht zustande: ${grund}`);
            return { negotiation, kind: "failed" };
        }
        const club = state.clubs.find(c => c.id === negotiation.clubId);
        // Die Arbeitserlaubnis wird mit der Unterschrift beantragt - ein
        // Ausnahmeplatz ist damit belegt
        const erlaubnis = this.erlaubnisPruefung(state, player, club);
        if (erlaubnis && !erlaubnis.erteilt) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            this.log(negotiation, state, "system", `Der Vorvertrag scheitert an der Arbeitserlaubnis. ${erlaubnis.text}`);
            this.notify(state, negotiation, `Keine Arbeitserlaubnis: ${negotiation.playerName}`,
                `${negotiation.playerName} bekommt keine Arbeitserlaubnis. ${erlaubnis.text}`);
            return { negotiation, kind: "failed" };
        }
        if (erlaubnis && erlaubnis.weg === "ausnahme") {
            const engine = _negResolve("ArbeitserlaubnisEngine", "./arbeitserlaubnisEngine.js");
            engine.verbrauche(state, club);
        }
        const a = negotiation.agreed;
        player.vorvertrag = {
            clubId: negotiation.clubId,
            clubName: club ? club.name : "",
            saison: state.seasonYear,
            wage: a.wage || 0,
            years: a.years || 3,
            praemien: (a.einsatzPraemie || a.torPraemie) ? { einsatz: a.einsatzPraemie || 0, tor: a.torPraemie || 0 } : null,
            klauseln: a.klauseln || null,
            erlaubnis: !!(erlaubnis && erlaubnis.noetig)
        };
        this.zahleNebenkosten(state, negotiation);

        negotiation.status = NEGOTIATION_STATUS.ACCEPTED;
        negotiation.stage = NEGOTIATION_STAGES.DONE;
        negotiation.closedDay = heute;
        this.log(negotiation, state, "system",
            `${negotiation.playerName} unterschreibt einen Vorvertrag über ${a.years} Jahre und kommt zum Saisonwechsel ablösefrei.`);
        this.notify(state, negotiation, `Vorvertrag unterschrieben: ${negotiation.playerName}`,
            `${negotiation.playerName} hat einen Vorvertrag über ${a.years} Jahre unterschrieben. Bis zum Saisonende spielt er noch für ${negotiation.sellerClubName}, dann kommt er ablösefrei. Gehalt: ${this.formatMoney(a.wage || 0)} pro Woche.`);
        return { negotiation, kind: "precontract" };
    }

    /** Nachwuchstalent in den Profikader übernehmen */
    static completeYouthPromotion(state, negotiation) {
        const youthEngine = _negResolve("YouthEngine", "./youthEngine.js");
        const heute = this.today(state);

        if (!youthEngine || typeof youthEngine.promoteProspect !== "function") {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            return { negotiation, kind: "failed" };
        }

        const result = youthEngine.promoteProspect(state, negotiation.clubId, negotiation.prospectId, {
            wage: negotiation.agreed.wage,
            contractYears: negotiation.agreed.years,
            skipNews: true
        });

        if (!result.success) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            this.log(negotiation, state, "system", result.error || "Die Beförderung ist gescheitert.");
            return { negotiation, kind: "failed" };
        }

        this.zahleNebenkosten(state, negotiation);
        this.setzePraemien(state, result.player.id, negotiation.agreed);
        this.setzeKlauseln(state, result.player.id, negotiation.agreed);

        negotiation.status = NEGOTIATION_STATUS.ACCEPTED;
        negotiation.stage = NEGOTIATION_STAGES.DONE;
        negotiation.closedDay = heute;
        negotiation.playerId = result.player.id;

        this.log(negotiation, state, "system",
            `${negotiation.playerName} unterschreibt seinen ersten Profivertrag über ${negotiation.agreed.years} Jahre.`);
        this.notify(state, negotiation, `Erster Profivertrag: ${negotiation.playerName}`,
            `${negotiation.playerName} (${result.player.pos}, ${result.player.age} Jahre) hat für ${negotiation.agreed.years} Jahre unterschrieben und steht ab sofort im Kader. Gehalt: ${this.formatMoney(negotiation.agreed.wage || 0)} pro Woche.`,
            "youth");

        return { negotiation, kind: "promoted", player: result.player };
    }

    /** Ein bekannter Trainer bekommt mehr Geduld - ein unbekannter weniger */
    static geduldMitRuf(state, geduld) {
        const profil = _negResolve("TrainerProfilEngine", "./trainerProfilEngine.js");
        if (!profil || typeof profil.ruf !== "function") return geduld;
        const ruf = profil.ruf(state);
        return Math.max(20, Math.min(100, Math.round(geduld + (ruf - 50) / 4)));
    }

    /**
     * Beraterhonorar: ein Teil der Ablöse plus einige Wochengehälter.
     * Vorher galten mindestens 1.000 € auf Tausender gerundet - in der
     * Landesliga (Gehälter um 150 €) das Vielfache dessen, was die Formel
     * ergibt. Jetzt wird nach der Größe gerundet, mindestens auf 100 €.
     */
    static beraterHonorar(ablose, wochenlohn, vereinslos = false) {
        const roh = vereinslos ? wochenlohn * 12 : (ablose || 0) * 0.04 + wochenlohn * 4;
        return Math.max(100, this.runde(roh));
    }

    /**
     * Ein Betrag, wie ihn Menschen nennen: auf seine Größenordnung gerundet
     * (ContractEngine.rundeBetrag). Vorher standen Forderungen wie 94.702 €
     * Gehalt und 947.020 € Handgeld in der Verhandlung.
     */
    static runde(betrag) {
        const ce = _negResolve("ContractEngine", "./contractEngine.js");
        return ce && typeof ce.rundeBetrag === "function" ? ce.rundeBetrag(betrag) : Math.round(betrag || 0);
    }

    /**
     * Was Prämien dem Spieler je Woche wert sind: erwartete Einsätze und
     * Tore, mit einem Abschlag von 30 %, weil nichts davon sicher ist.
     */
    static praemienWert(state, negotiation, offer) {
        const einsatz = Number(offer?.einsatzPraemie) || 0;
        const tor = Number(offer?.torPraemie) || 0;
        if (!einsatz && !tor) return 0;
        const pos = negotiation.playerPos || "ZM";
        const toreJeSpiel = ["ST", "MS"].includes(pos) ? 0.45 : (["LA", "RA", "OM", "HS"].includes(pos) ? 0.28
            : (["ZM", "LM", "RM"].includes(pos) ? 0.12 : (pos === "TW" ? 0 : 0.05)));
        const spieleJeWoche = 0.8;
        return Math.round((einsatz * spieleJeWoche + tor * toreJeSpiel * spieleJeWoche) * 0.7);
    }

    /** Was die Klauseln des Angebots dem Spieler wert sind - als Faktor aufs Gehalt */
    static klauselFaktor(state, negotiation, offer) {
        const ke = this.getKlauselEngine();
        if (!ke || !offer?.klauseln) return 1;
        const club = (state.clubs || []).find(c => c.id === negotiation.clubId);
        return ke.faktor(offer.klauseln, offer.years || 3, club);
    }

    static setzeKlauseln(state, playerId, agreed) {
        const ke = this.getKlauselEngine();
        const player = (state.players || []).find(p => String(p.id) === String(playerId));
        if (!ke || !player) return;
        ke.setze(player, agreed.klauseln || {}, (state.clubs || []).find(c => c.id === player.clubId));
    }

    static zahleNebenkosten(state, negotiation) {
        const club = state.clubs.find(c => c.id === negotiation.clubId);
        const finance = this.getFinanceEngine();
        const posten = [
            [negotiation.agreed.signingBonus || 0, `Handgeld für ${negotiation.playerName}`],
            [negotiation.agreed.agentFee || 0, `Beraterhonorar (${negotiation.agentName || "Berater"}) für ${negotiation.playerName}`]
        ];
        posten.forEach(([betrag, text]) => {
            if (!(betrag > 0)) return;
            if (club) club.balance -= betrag;
            if (finance && typeof finance.recordTransaction === "function") {
                finance.recordTransaction(state, negotiation.clubId, "transfer_out", -betrag, text);
            }
        });
    }

    static setzePraemien(state, playerId, agreed) {
        const player = (state.players || []).find(p => String(p.id) === String(playerId));
        if (!player) return;
        if ((agreed.einsatzPraemie || 0) > 0 || (agreed.torPraemie || 0) > 0) {
            player.praemien = { einsatz: agreed.einsatzPraemie || 0, tor: agreed.torPraemie || 0 };
        } else {
            player.praemien = undefined;
        }
    }

    /**
     * Prämien nach einem Pflichtspiel des eigenen Vereins auszahlen.
     * Gibt die Summe zurück.
     */
    static zahlePraemien(state, match) {
        if (!state || !match || !Array.isArray(match.playerRatings)) return 0;
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!club || (match.homeClubId !== club.id && match.awayClubId !== club.id)) return 0;
        if (match.praemienGezahlt) return 0;
        const ids = new Set((club.playerIds || []).map(String));
        let summe = 0;
        const zeilen = [];
        match.playerRatings.forEach(r => {
            if (!ids.has(String(r.playerId)) || !(r.minutes > 0)) return;
            const p = state.players.find(x => String(x.id) === String(r.playerId));
            if (!p || !p.praemien) return;
            const betrag = (p.praemien.einsatz || 0) + (p.praemien.tor || 0) * (r.goals || 0);
            if (betrag > 0) { summe += betrag; zeilen.push(p.name); }
        });
        match.praemienGezahlt = true;
        if (summe > 0) {
            club.balance -= summe;
            const finance = this.getFinanceEngine();
            if (finance && typeof finance.recordTransaction === "function") {
                finance.recordTransaction(state, club.id, "bonus", -summe, `Prämien (${zeilen.join(", ")})`);
            }
        }
        return summe;
    }

    /**
     * Kurzfassung für die Oberfläche: Was ist der nächste Schritt?
     */
    static describe(negotiation) {
        if (!negotiation) return "";
        switch (negotiation.status) {
            case NEGOTIATION_STATUS.WAITING_REPLY:
                if (negotiation.stage === NEGOTIATION_STAGES.MEDICAL) return "Medizincheck läuft";
                if (negotiation.type === "fremdtalent" && negotiation.stage === NEGOTIATION_STAGES.TERMS) return "Die Familie überlegt";
                return negotiation.stage === NEGOTIATION_STAGES.LOAN ? "Der Stammverein prüft das Leihangebot" : "Die Gegenseite prüft unser Angebot";
            case NEGOTIATION_STATUS.AWAITING_US:
                if (negotiation.stage === NEGOTIATION_STAGES.LOAN) return "Wir sind am Zug: Leihe";
                if (negotiation.type === "fremdtalent") return negotiation.stage === NEGOTIATION_STAGES.FEE ? "Wir sind am Zug: Entschädigung" : "Wir sind am Zug: Angebot an die Familie";
                return negotiation.stage === NEGOTIATION_STAGES.FEE
                    ? "Wir sind am Zug: Ablöse"
                    : (negotiation.vorvertrag ? "Wir sind am Zug: Vorvertrag" : "Wir sind am Zug: persönliche Konditionen");
            case NEGOTIATION_STATUS.ACCEPTED:
                if (negotiation.type === "leihe") return "Leihe perfekt";
                if (negotiation.type === "fremdtalent") return "Kommt in die Akademie";
                return negotiation.vorvertrag ? "Vorvertrag unterschrieben" : "Abgeschlossen";
            case NEGOTIATION_STATUS.REJECTED: return "Gescheitert";
            case NEGOTIATION_STATUS.EXPIRED: return "Frist abgelaufen";
            case NEGOTIATION_STATUS.WITHDRAWN: return "Von uns abgebrochen";
            default: return "";
        }
    }
}

if (typeof window !== "undefined") {
    window.NegotiationEngine = NegotiationEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { NegotiationEngine };
}
