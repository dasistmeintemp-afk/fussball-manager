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
 *
 * Verbesserungen gegenüber der Vorversion:
 *  1. Reservationspreis + Walk-Away pro Verhandlung (Gegenseite ertastet,
 *     nicht gegen die öffentliche Forderung gerechnet).
 *  2. Persönliche Agenda des Beraters (Ausstiegsklausel, Stammplatz,
 *     schneller Wechsel, Handgeld) beeinflusst Bewertung und Abbruch.
 *  3. Geduld/Frist/Zeitdruck hängen vom Profil, der Agenda und dem
 *     Deadline Day ab - linearer Abbau ist ersetzt.
 *  4. Gegenvorschlag kommt als Paket (Gehalt, Bonus, Laufzeit, Honorar,
 *     Klausel) statt als eine einzige sinkende Zahl.
 *  5. Warnung vor dem Abbruch ("letztes Angebot") + Beziehungsschaden
 *     beim Berater, der sich auf künftige Verhandlungen auswirkt.
 *  6. Kleinere Punkte: deterministischer RNG, Medizincheck-Risiko mit
 *     Alter und Vorgeschichte, Frist nach Profil.
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
    LOAN: "loan",
    DONE: "done"
};

const NEGOTIATION_STATUS = {
    WAITING_REPLY: "waiting_reply",
    AWAITING_US: "awaiting_us",
    ACCEPTED: "accepted",
    REJECTED: "rejected",
    EXPIRED: "expired",
    WITHDRAWN: "withdrawn"
};

// Gewichte für die Bewertung persönlicher Konditionen. Wird mit dem
// Agenda-Bonus kombiniert, nicht mehr hart im Code verrechnet.
const TERMS_GEWICHTE = {
    wage: 0.75,
    bonus: 0.13,
    agentFee: 0.12
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

    /**
     * Deterministischer Zufall, wo möglich. Der Rest der Codebasis nutzt
     * Math.random() - wo wir im Verhandlungsfluss sind, greifen wir auf
     * state.rng zurück, wenn vorhanden. Sonst bleibt es beim globalen RNG.
     */
    static rnd(state, ...args) {
        if (state && state.rng && typeof state.rng === "function") return state.rng();
        if (state && state.rng && typeof state.rng.next === "function") return state.rng.next();
        return Math.random();
    }

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
            speed: profile.speed,
            // Narben aus früheren Verhandlungen - werden weiter unten
            // in Forderung und Geduld eingerechnet. Neue Berater starten bei 0.
            vergiftet: 0
        };

        if (player) player.agent = agent;
        return agent;
    }

    static profileOf(agent) {
        return this.AGENT_PROFILES.find(p => p.key === agent?.profile) || this.AGENT_PROFILES[1];
    }

    /**
     * Wählt eine persönliche Agenda des Beraters. Bestimmt, was er
     * auf jeden Fall durchsetzen will - unabhängig vom Geld. Wird beim
     * Erzeugen der Verhandlung auf negotiation.agenda gesetzt.
     */
    static waehleAgenda(state, player, agent, kontext) {
        if (!player) return null;
        // Ein sehr junger Spieler will vor allem Stammplatz-Perspektive.
        if (kontext === "youth" || (player.age || 30) < 21) {
            return this.rnd(state) < 0.5
                ? { type: "stammplatz", prio: "hart" }
                : { type: "schneller_wechsel", prio: "weich" };
        }
        // Ein Star mit wenig Restvertrag will die Ausstiegsklausel.
        if ((player.age || 30) >= 26) {
            return this.rnd(state) < 0.4
                ? { type: "ausstiegsklausel", prio: "hart" }
                : { type: "handgeld", prio: "weich" };
        }
        const würfel = this.rnd(state);
        if (würfel < 0.25) return { type: "ausstiegsklausel", prio: "hart" };
        if (würfel < 0.50) return { type: "handgeld", prio: "weich" };
        if (würfel < 0.75) return { type: "stammplatz", prio: "hart" };
        return null; // manche Berater sind einfach nur am Geld interessiert
    }

    /** Erfüllt das Angebot die Agenda? Wird in evaluateOffer genutzt. */
    static agendaErfuellt(negotiation, offer) {
        const agenda = negotiation.agenda;
        if (!agenda) return false;
        const klauseln = offer?.klauseln || {};
        switch (agenda.type) {
            case "ausstiegsklausel": return !!klauseln.ausstieg;
            case "stammplatz": return !!(offer?.rolle === "Stammspieler" || offer?.stammplatz);
            case "handgeld": return (offer?.signingBonus || 0) >= (negotiation.demand.signingBonus || 0) * 0.9;
            case "schneller_wechsel": return true; // Agenda ist hier nur erzählerisch
            default: return false;
        }
    }

    /**
     * Reservationspreis: der versteckte Wert, unter dem die Gegenseite
     * nicht verkauft. Wird beim Start der Verhandlung einmal gewürfelt und
     * bleibt - so lernt der Spieler, den Wert zu ertasten.
     */
    static wuerfleReservation(state, forderung, spanne = 0.15, minFaktor = 0.82) {
        const fakt = minFaktor + this.rnd(state) * spanne;
        return this.runde((forderung || 0) * Math.min(1, fakt));
    }

    /** Wie viele Tage die Gegenseite für eine Antwort braucht */
    static replyDelay(agent) {
        const profile = this.profileOf(agent);
        return profile.speed + Math.floor(Math.random() * 2);
    }

    /** Frist: hängt vom Beraterprofil ab, nicht mehr fest 14/10/14 */
    static fristFuer(agent, basis = 14) {
        const profile = this.profileOf(agent);
        return Math.max(6, basis - (profile.speed - 2) * 2);
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

    /**
     * Post zur Verhandlung - mit dem Stand darunter (standText) und dem
     * Spieler als Verweis.
     */
    static notify(state, negotiation, subject, body, type = "transfer", priority = "normal") {
        const news = this.getNewsEngine();
        if (!news || typeof news.addMessage !== "function") return;
        const stand = this.standText(state, negotiation);
        news.addMessage(state, type, {
            title: subject,
            sender: negotiation.agentName ? `Berater ${negotiation.agentName}` : "Transferabteilung",
            text: stand ? `${body}\n\n${stand}` : body,
            priority,
            relatedEntity: negotiation.playerId !== undefined && negotiation.playerId !== null ? { type: "player", id: negotiation.playerId } : null
        });
    }

    /**
     * Der Stand einer Verhandlung in wenigen Zeilen: Phase, Runde, unser
     * letztes Angebot gegen die Forderung, Abstand, Geduld, Frist.
     */
    static standText(state, negotiation) {
        if (!negotiation) return "";
        const zeilen = [`Stand: ${this.describe(negotiation)}${negotiation.round ? ` · Runde ${negotiation.round}` : ""}`];
        const offen = negotiation.status === NEGOTIATION_STATUS.WAITING_REPLY || negotiation.status === NEGOTIATION_STATUS.AWAITING_US;
        const d = negotiation.demand || {}, o = negotiation.lastOffer || {};
        const vergleich = (label, angebot, forderung, einheit = "") => {
            if (!(forderung > 0)) return;
            const abstand = angebot > 0 ? Math.round((forderung - angebot) / forderung * 100) : null;
            zeilen.push(`${label}: Forderung ${this.formatMoney(forderung)}${einheit}`
                + (angebot > 0 ? `, unser Angebot ${this.formatMoney(angebot)}${einheit}${abstand > 0 ? ` (${abstand} % darunter)` : ""}` : ""));
        };
        if (offen && negotiation.stage === NEGOTIATION_STAGES.FEE && negotiation.type !== "fremdtalent") vergleich("Ablöse", o.fee, d.fee);
        if (offen && negotiation.stage === NEGOTIATION_STAGES.TERMS && negotiation.type !== "fremdtalent") vergleich("Gehalt", o.wage, d.wage, " pro Woche");
        if (negotiation.agreed?.fee > 0 && negotiation.stage !== NEGOTIATION_STAGES.FEE) zeilen.push(`Ablöse vereinbart: ${this.formatMoney(negotiation.agreed.fee)}`);
        if (offen && typeof negotiation.patience === "number") zeilen.push(`Geduld der Gegenseite: ${negotiation.patience} %`);
        // Gewarnt: die Gegenseite hat mit Abbruch gedroht
        if (negotiation.gewarnt && offen) zeilen.push("Die Gegenseite hat mit Abbruch gedroht.");
        if (offen && typeof negotiation.deadlineDay === "number") {
            const rest = negotiation.deadlineDay - this.today(state);
            zeilen.push(rest > 0 ? `Frist: noch ${rest} ${rest === 1 ? "Tag" : "Tage"}` : "Frist: heute");
        }
        return zeilen.length > 1 ? zeilen.join("\n") : "";
    }

    // ------------------------------------------------------------ Transfer

    /**
     * Eröffnet eine Transferverhandlung.
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
            const grund = this.vorvertragHindernis(state, player, buyerClubId);
            if (grund) return { success: false, error: grund };
        } else {
            const fenster = transferEngine && typeof transferEngine.fensterHindernis === "function"
                ? transferEngine.fensterHindernis(state, { vereinslos: !sellerClub }) : null;
            if (fenster) return { success: false, error: fenster };
        }
        const erlaubnis = this.erlaubnisPruefung(state, player, buyerClub);
        if (erlaubnis && !erlaubnis.erteilt) return { success: false, error: erlaubnis.text };
        const askingPrice = vorvertrag ? 0 : (transferEngine
            ? transferEngine.calculateAskingPrice(player, sellerClub)
            : Math.round((player.value || 1000000) * 1.15));

        const agent = this.getAgentFor(player);
        // Narben aus früheren Verhandlungen: höhere Forderung, weniger Geduld
        const narbe = agent.vergiftet || 0;
        const wageDemand = this.runde((player.wage || 10000) * 1.18 * agent.greed * (1 + 0.06 * narbe));
        const ohneAbloese = vorvertrag || !sellerClub;

        // Reservationspreis + Walk-Away-Schwelle. Beim Ablöse-Fall
        // orientiert sich die Reserve am askingPrice, bei vereinslosen
        // Spielern gibt es keine Reserve.
        const reservation = {
            fee: sellerClub && !vorvertrag
                ? this.wuerfleReservation(state, askingPrice, 0.14, 0.80)
                : 0,
            wage: this.wuerfleReservation(state, wageDemand, 0.10, 0.88),
            walkAway: 0.70 + this.rnd(state) * 0.06 // zwischen 70 und 76 %
        };

        // Agenda des Beraters
        const agenda = this.waehleAgenda(state, player, agent, "transfer");

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
            deadlineDay: this.today(state) + this.fristFuer(agent, 14),
            replyDay: null,
            round: 0,
            patience: this.geduldMitRuf(state, agent.patience) - 10 * narbe,
            // Neue Felder
            reservation,
            agenda,
            gewarnt: false,
            zeitdruck: 0,
            letzterGegenvorschlag: null,
            demand: {
                fee: askingPrice,
                wage: wageDemand,
                years: 3,
                signingBonus: this.runde(wageDemand * (vorvertrag ? 10 : 6)),
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
        if (agenda) {
            const text = {
                ausstiegsklausel: "Der Berater will eine Ausstiegsklausel im Vertrag.",
                stammplatz: "Der Berater will eine Stammplatzgarantie.",
                handgeld: "Der Berater legt Wert auf ein hohes Handgeld.",
                schneller_wechsel: "Der Berater drängt auf einen zügigen Abschluss."
            }[agenda.type];
            if (text) this.log(negotiation, state, "agent", `Berater ${agent.name}: "${text}"`);
        }

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
     * Darf ein Verein diesem Spieler einen Vorvertrag anbieten?
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
     */
    static startYouthPromotion(state, clubId, prospectId) {
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };

        const prospect = this.findProspect(state, club, prospectId);
        if (!prospect) return { success: false, error: "Jugendspieler nicht gefunden." };
        if (prospect.promoted) return { success: false, error: "Der Spieler wurde bereits befördert." };
        const youth = _negResolve("YouthEngine", "./youthEngine.js");
        const zuJung = youth && typeof youth.profiHindernis === "function" ? youth.profiHindernis(club, prospect) : null;
        if (zuJung) return { success: false, error: zuJung };

        const existing = this.getOpenNegotiations(state)
            .find(n => n.type === "youth_promotion" && String(n.prospectId) === String(prospectId));
        if (existing) return { success: false, error: "Die Vertragsgespräche laufen bereits.", negotiation: existing };

        const agent = this.getAgentFor(prospect);
        const narbe = agent.vergiftet || 0;

        const level = club.level || 1;
        const basis = { 1: 9000, 2: 3500, 3: 1600, 4: 800, 5: 400, 6: 250, 7: 150 }[level] ?? 500;
        const talentFaktor = 0.7 + ((prospect.pot || 60) / 100);
        const wageDemand = Math.max(120, Math.round(basis * talentFaktor * agent.greed * (1 + 0.06 * narbe) / 50) * 50);

        const reservation = {
            wage: this.wuerfleReservation(state, wageDemand, 0.08, 0.90),
            walkAway: 0.68 + this.rnd(state) * 0.06
        };
        const agenda = this.waehleAgenda(state, prospect, agent, "youth");

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
            deadlineDay: this.today(state) + this.fristFuer(agent, 10),
            replyDay: null,
            round: 0,
            patience: this.geduldMitRuf(state, agent.patience) - 10 * narbe,
            reservation,
            agenda,
            gewarnt: false,
            zeitdruck: 0,
            letzterGegenvorschlag: null,
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
        if (agenda?.type === "stammplatz") {
            this.log(negotiation, state, "agent", `"Und er will eine Perspektive als Stammspieler - sonst unterschreibt er nicht."`);
        }

        this.ensureList(state).push(negotiation);
        return { success: true, negotiation };
    }

    // -------------------------------------------------------------- Leihe

    /**
     * Eine Leihe verhandeln statt per Knopfdruck.
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
        const narbe = agent.vergiftet || 0;
        const wunsch = loan.rolleBei(state, player, club) || "Talent";
        const rolle = this.ROLLEN.indexOf(wunsch) > this.ROLLEN.indexOf(eintrag.rolle) ? wunsch : eintrag.rolle;

        // Reserve: der Stammverein geht beim Lohnanteil und bei der
        // Gebühr jeweils bis zu einem gewissen Punkt herunter.
        const reservation = {
            lohnAnteil: Math.max(0.3, eintrag.lohnAnteil - 0.15 - this.rnd(state) * 0.10),
            gebuehr: this.runde(eintrag.gebuehr * (0.72 + this.rnd(state) * 0.10)),
            walkAway: 0.68 + this.rnd(state) * 0.06
        };

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
            deadlineDay: this.today(state) + this.fristFuer(agent, 10),
            replyDay: null,
            round: 0,
            patience: this.geduldMitRuf(state, 70) - 8 * narbe,
            reservation,
            agenda: null,
            gewarnt: false,
            zeitdruck: 0,
            letzterGegenvorschlag: null,
            demand: {
                lohnAnteil: eintrag.lohnAnteil,
                minAnteil: Math.max(0.3, Math.round((eintrag.lohnAnteil - 0.2) * 20) / 20),
                gebuehr: eintrag.gebuehr,
                rolle,
                kaufoption: eintrag.kaufoption,
                optionsAufschlag: eintrag.optionsAufschlag,
                wage: eintrag.wage,
                rueckholrecht: (player.age || 30) <= 23,
                dauer: "saison"
            },
            agreed: {},
            lastOffer: null,
            log: []
        };
        this.log(negotiation, state, "club",
            `${eintrag.clubName} gibt ${player.name} bis zum Saisonende ab: ${Math.round(eintrag.lohnAnteil * 100)} % des Gehalts`
            + `${eintrag.gebuehr ? `, Leihgebühr ${this.formatMoney(eintrag.gebuehr)}` : ", ohne Leihgebühr"}, Einsatz als ${this.rolleText(eintrag.rolle)}`
            + `${negotiation.demand.rueckholrecht ? ", mit Rückholrecht im Winter" : ""}.`);
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
     * Ein Talent aus einer anderen Akademie holen.
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

        const reservation = {
            fee: this.wuerfleReservation(state, t.betrag, 0.08, 0.92),
            walkAway: 0.75 + this.rnd(state) * 0.06
        };

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
            reservation,
            agenda: null,
            gewarnt: false,
            zeitdruck: 0,
            letzterGegenvorschlag: null,
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

    /** Braucht der Abschluss ein offenes Fenster? */
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
     * Der Morgen des Deadline Day: sofortige Antworten.
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
     * Deadline Day: Die Gegenseite antwortet noch heute.
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
     * Wir machen ein Angebot. Die Gegenseite antwortet nicht sofort.
     */
    static submitOffer(state, negotiationId, offer = {}) {
        const negotiation = this.findNegotiation(state, negotiationId);
        if (!negotiation) return { success: false, error: "Verhandlung nicht gefunden." };
        if (negotiation.status !== NEGOTIATION_STATUS.AWAITING_US) {
            return { success: false, error: "Die Gegenseite ist am Zug." };
        }

        const club = state.clubs.find(c => c.id === negotiation.clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };
        if (this.brauchtFenster(negotiation) && this.pruefeFenster(state).some(s => s.negotiation === negotiation)) {
            return { success: false, error: "Das Transferfenster ist geschlossen. Der Wechsel kommt nicht mehr zustande." };
        }

        // Eine Agenda, die eine Stammplatzgarantie verlangt, wird
        // schon hier abgeprüft - sonst wartet der Spieler nur auf das Nein.
        if (negotiation.agenda?.type === "stammplatz" && negotiation.stage === NEGOTIATION_STAGES.TERMS
            && offer.rolle && offer.rolle !== "Stammspieler" && !offer.stammplatz) {
            this.log(negotiation, state, "agent",
                `Berater ${negotiation.agentName}: "Ohne Stammplatz-Zusage unterschreibt ${negotiation.playerName} nicht - dann können wir uns das sparen."`);
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
            const anteil = Math.max(0, Math.min(1, Math.round((Number(offer.lohnAnteil) || 0) * 20) / 20));
            const gebuehr = Math.max(0, Math.round(Number(offer.gebuehr) || 0));
            const rolle = this.ROLLEN.includes(offer.rolle) ? offer.rolle : d.rolle;
            const kaufoption = !!offer.kaufoption && !!d.kaufoption;
            const te = this.getTransferEngine();
            const sommer = te && typeof te.fensterInfo === "function" && te.fensterInfo(state).art === "sommer";
            const dauer = offer.dauer === "winter" && sommer ? "winter" : "saison";
            const rueckholrecht = offer.rueckholrecht === undefined ? !!d.rueckholrecht : !!offer.rueckholrecht;
            const kosten = gebuehr + (kaufoption ? (d.optionsAufschlag || 0) : 0);
            if (kosten > Math.max(0, club.balance || 0)) return { success: false, error: "Für die Leihgebühr reicht das Geld nicht." };
            negotiation.lastOffer = { lohnAnteil: anteil, gebuehr, rolle, kaufoption, dauer, rueckholrecht };
            this.log(negotiation, state, "us",
                `Leihangebot ${dauer === "winter" ? "bis zur Winterpause" : "bis zum Saisonende"}: ${Math.round(anteil * 100)} % des Gehalts, ${gebuehr ? `Leihgebühr ${this.formatMoney(gebuehr)}` : "ohne Leihgebühr"}, Einsatz als ${this.rolleText(rolle)}`
                + `${kaufoption ? `, mit Kaufoption für ${this.formatMoney(d.kaufoption)} (Aufschlag ${this.formatMoney(d.optionsAufschlag || 0)})` : ""}`
                + `${rueckholrecht ? ", mit Rückholrecht" : ", ohne Rückholrecht"}.`);
        } else if (negotiation.stage === NEGOTIATION_STAGES.FEE) {
            const fee = Math.max(0, Math.round(Number(offer.fee) || 0));
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
            const bonus = Math.max(0, Math.round(Number(offer.signingBonus ?? negotiation.demand.signingBonus) || 0));
            const honorar = Math.max(0, Math.round(offer.agentFee !== undefined ? Number(offer.agentFee) || 0 : (negotiation.demand.agentFee || 0)));
            const einsatzPraemie = Math.max(0, Math.round(Number(offer.einsatzPraemie) || 0));
            const torPraemie = Math.max(0, Math.round(Number(offer.torPraemie) || 0));
            const investoren = negotiation.type === "transfer"
                ? ((typeof InvestorEngine !== "undefined" && InvestorEngine) ? InvestorEngine
                    : (typeof require !== "undefined" ? (() => { try { return require("./investorEngine.js").InvestorEngine; } catch (e) { return null; } })() : null))
                : null;
            const deckel = investoren && typeof investoren.gehaltsHindernis === "function" ? investoren.gehaltsHindernis(state, club, wage) : null;
            if (deckel) return { success: false, error: deckel };
            const ke = this.getKlauselEngine();
            const klauseln = ke ? ke.normalisiere(offer.klauseln || {}, club) : {};
            negotiation.lastOffer = { wage, years, signingBonus: bonus, agentFee: honorar, einsatzPraemie, torPraemie };
            if (Object.keys(klauseln).length) negotiation.lastOffer.klauseln = klauseln;
            if (offer.rolle) negotiation.lastOffer.rolle = offer.rolle;
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
        negotiation.replyDay = this.today(state) + (negotiation.type === "fremdtalent" && negotiation.stage === NEGOTIATION_STAGES.TERMS
            ? 2 + Math.floor(Math.random() * 2)
            : this.replyDelay({ profile: negotiation.agentProfile }));

        if (this.brauchtFenster(negotiation) && this.istDeadlineDay(state)) {
            // Deadline Day: Die Gegenseite weiß, dass wir unter Druck stehen
            negotiation.zeitdruck = (negotiation.zeitdruck || 0) + 1;
            const schritte = this.antworteSofort(state, negotiation);
            const letzter = (negotiation.log || [])[negotiation.log.length - 1];
            return { success: true, negotiation, sofort: true, schritte,
                message: `⏰ Deadline Day - die Antwort kommt sofort: ${letzter ? letzter.text : this.describe(negotiation)}` };
        }

        const letzter = (negotiation.log || [])[negotiation.log.length - 1];
        const tage = Math.max(1, (negotiation.replyDay || 0) - this.today(state));
        this.notify(state, negotiation, `Angebot abgegeben: ${negotiation.playerName}`,
            `${letzter ? letzter.text : "Unser Angebot liegt vor."} Eine Antwort erwarten wir in etwa ${tage} ${tage === 1 ? "Tag" : "Tagen"}.`, "transfer", "low");
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
        const ereignisse = this.pruefeFenster(state);
        const deadline = this.istDeadlineDay(state);

        this.ensureList(state).forEach(negotiation => {
            if (negotiation.status !== NEGOTIATION_STATUS.WAITING_REPLY &&
                negotiation.status !== NEGOTIATION_STATUS.AWAITING_US) return;

            // Zeitdruck-Effekt: Am Deadline Day verliert die Gegenseite
            // nicht mehr Geduld (sie weiß, dass wir es sind, die zittern),
            // aber die Forderung steigt leicht.
            if (deadline && this.brauchtFenster(negotiation)) {
                negotiation.zeitdruck = (negotiation.zeitdruck || 0) + 0.5;
            }

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
            if (deadline && this.brauchtFenster(negotiation)) {
                this.antworteSofort(state, negotiation).forEach(s => ereignisse.push(s));
                return;
            }
            if (negotiation.replyDay === null || heute < negotiation.replyDay) return;
            // Verspätete Antworten kosten die Gegenseite Geduld
            const verspaetung = heute - negotiation.replyDay;
            if (verspaetung > 0) {
                negotiation.patience = Math.max(0, negotiation.patience - verspaetung * 4);
                if (negotiation.patience <= 0) {
                    negotiation.status = NEGOTIATION_STATUS.EXPIRED;
                    negotiation.closedDay = heute;
                    this.log(negotiation, state, "system", "Die Gegenseite hat die Geduld verloren und lässt die Verhandlung ruhen.");
                    this.notify(state, negotiation, `Keine Einigung: ${negotiation.playerName}`,
                        `Die Gespräche um ${negotiation.playerName} sind eingeschlafen.`);
                    ereignisse.push({ negotiation, kind: "expired" });
                    return;
                }
            }

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
        const fin = this.getFinanceEngine();
        const verkaeufer = state.clubs.find(c => c.id === negotiation.sellerClubId);
        const ablöseWert = offer.zahlweise && fin && typeof fin.ratenWert === "function"
            ? fin.ratenWert(offer.fee || 0, offer.zahlweise, verkaeufer) : (offer.fee || 0);

        // Bewertung gegen Reservationspreis, nicht gegen Forderung
        const reserv = negotiation.reservation || { fee: gefordert, wage: gefordert, walkAway: 0.7 };
        const ziel = istAblöse ? reserv.fee : reserv.wage;
        const geboten = istAblöse
            ? ablöseWert
            : Math.round((offer.wage || 0) * this.klauselFaktor(state, negotiation, offer)) + this.praemienWert(state, negotiation, offer);

        const quote = ziel > 0 ? geboten / ziel : 1;

        // Walk-Away: zu weit weg - kein "nur ein bisschen zu niedrig"
        if (quote < reserv.walkAway) {
            return this.rejectWalkAway(state, negotiation, istAblöse, quote);
        }

        // Zeitdruck schlägt auf die Bewertung durch
        const druck = negotiation.zeitdruck ? Math.min(0.10, negotiation.zeitdruck * 0.03) : 0;

        let bewertung = quote * (1 - druck);

        if (!istAblöse) {
            const jahre = offer.years || 3;
            bewertung *= jahre <= 1 ? 0.9 : (jahre >= 4 ? 1.05 : 1.0);
            const bonusQuote = negotiation.demand.signingBonus > 0
                ? (offer.signingBonus || 0) / negotiation.demand.signingBonus
                : 1;
            const honorarQuote = (negotiation.demand.agentFee || 0) > 0
                ? (offer.agentFee ?? negotiation.demand.agentFee) / negotiation.demand.agentFee
                : 1;
            // Gewichte kommen jetzt aus einer Konstante
            bewertung = bewertung * TERMS_GEWICHTE.wage
                + Math.min(1.2, bonusQuote) * TERMS_GEWICHTE.bonus
                + Math.min(1.2, honorarQuote) * TERMS_GEWICHTE.agentFee;

            // Agenda-Bonus
            if (negotiation.agenda && this.agendaErfuellt(negotiation, offer)) {
                bewertung += negotiation.agenda.prio === "hart" ? 0.10 : 0.04;
            } else if (negotiation.agenda && negotiation.agenda.prio === "hart" && !this.agendaErfuellt(negotiation, offer)) {
                // harte Agenda nicht erfüllt: kleine Strafe, aber kein Abbruch
                bewertung -= 0.03;
            }
        }

        // Annahme
        if (bewertung >= 0.97) {
            return this.acceptCurrentOffer(state, negotiation, istAblöse, offer);
        }

        // Geduld sinkt - abhängig von Abweichung, Runde und Agenda
        const verlust = Math.round((1 - Math.min(1, bewertung)) * 45) + negotiation.round * 3;
        negotiation.patience = Math.max(0, negotiation.patience - verlust);

        if (negotiation.patience <= 0 || bewertung < 0.6) {
            // Erst warnen, dann abbrechen
            if (!negotiation.gewarnt) {
                negotiation.gewarnt = true;
                negotiation.patience = 25;
                const text = istAblöse
                    ? `${negotiation.sellerClubName}: "So wird das nichts. Ein letztes Angebot - oder wir brechen ab."`
                    : `Berater ${negotiation.agentName}: "Letztes Angebot, sonst sind wir raus."`;
                this.log(negotiation, state, istAblöse ? "club" : "agent", text);
                this.notify(state, negotiation, `Letzte Warnung: ${negotiation.playerName}`, text);
                return { negotiation, kind: "warning" };
            }
            return this.rejectFinal(state, negotiation, istAblöse);
        }
        return this.counterOffer(state, negotiation, istAblöse, geboten);
    }

    /** Walk-Away: Die Gegenseite steigt sofort aus - ihre Geduld ist damit am Ende. */
    static rejectWalkAway(state, negotiation, istAblöse, quote) {
        const heute = this.today(state);
        negotiation.status = NEGOTIATION_STATUS.REJECTED;
        negotiation.patience = 0;
        negotiation.closedDay = heute;
        this.merkeBeziehungsschaden(state, negotiation);
        const text = istAblöse
            ? `${negotiation.sellerClubName} bricht die Gespräche sofort ab - das Angebot ist zu weit entfernt.`
            : `Berater ${negotiation.agentName} bricht die Gespräche sofort ab. So weit kann er nicht heruntergehen.`;
        this.log(negotiation, state, istAblöse ? "club" : "agent", text);
        this.notify(state, negotiation, `Verhandlung gescheitert: ${negotiation.playerName}`, text);
        return { negotiation, kind: "rejected" };
    }

    /** Endgültiger Abbruch nach Warnung. */
    static rejectFinal(state, negotiation, istAblöse) {
        const heute = this.today(state);
        negotiation.status = NEGOTIATION_STATUS.REJECTED;
        negotiation.closedDay = heute;
        this.merkeBeziehungsschaden(state, negotiation);
        const text = istAblöse
            ? `${negotiation.sellerClubName} bricht die Gespräche ab - das Angebot war nicht seriös.`
            : `Berater ${negotiation.agentName} bricht die Gespräche ab. Das war kein seriöses Angebot.`;
        this.log(negotiation, state, istAblöse ? "club" : "agent", text);
        this.notify(state, negotiation, `Verhandlung gescheitert: ${negotiation.playerName}`, text);
        return { negotiation, kind: "rejected" };
    }

    /** Beziehungsschaden: Der Berater merkt sich das. */
    static merkeBeziehungsschaden(state, negotiation) {
        const player = state.players?.find(p => String(p.id) === String(negotiation.playerId));
        const agent = player?.agent;
        if (agent) {
            agent.vergiftet = Math.min(3, (agent.vergiftet || 0) + 1);
        }
    }

    /** Die Gegenseite nimmt unser Angebot an */
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
        if (offer.rolle) negotiation.agreed.rolle = offer.rolle;

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

    /**
     * Gegenvorschlag als Paket. Die Gegenseite bewegt sich in
     * mehreren Dimensionen gleichzeitig: Gehalt/Lohn sinkt, Bonus bleibt
     * stabil, Laufzeit wird verlängert, Agenda wird eingefordert. Bei
     * Stillstand geht kaum noch etwas.
     */
    static counterOffer(state, negotiation, istAblöse, geboten) {
        const offer = negotiation.lastOffer || {};
        const d = negotiation.demand;

        // Stagnation: ähnelt das neue Angebot dem letzten Vorschlag?
        const aehneln = (a, b) => {
            if (!a || !b) return false;
            const keys = Object.keys(a).filter(k => typeof a[k] === "number" && a[k] > 0);
            return keys.length > 0 && keys.every(k => Math.abs((b[k] || 0) - a[k]) / a[k] < 0.02);
        };
        const stagnation = aehneln(negotiation.letzterGegenvorschlag, offer);
        const nachgeben = stagnation ? 0.01 : (0.04 + negotiation.round * 0.015);

        let neueForderung;
        if (istAblöse) {
            neueForderung = this.runde(d.fee * (1 - nachgeben));
            if (neueForderung <= geboten) {
                d.fee = geboten;
                return this.acceptCurrentOffer(state, negotiation, true, offer);
            }
            d.fee = neueForderung;
            const inRaten = offer.zahlweise && offer.zahlweise !== "sofort" && geboten > 0;
            const nominal = inRaten ? this.runde(neueForderung * (offer.fee || 0) / geboten) : 0;
            const ratenHinweis = inRaten ? ` In Raten wie angeboten entspräche das etwa ${this.formatMoney(nominal)}.` : "";
            negotiation.status = NEGOTIATION_STATUS.AWAITING_US;
            negotiation.replyDay = null;
            negotiation.letzterGegenvorschlag = offer;
            this.log(negotiation, state, "club",
                `${negotiation.sellerClubName} lehnt ab und fordert ${this.formatMoney(neueForderung)}.${ratenHinweis}`);
            this.notify(state, negotiation, `Gegenforderung: ${negotiation.playerName}`,
                `${negotiation.sellerClubName} lehnt ${this.formatMoney(offer.fee || geboten)}${inRaten ? " in Raten" : ""} ab und fordert ${this.formatMoney(neueForderung)}.${ratenHinweis}`);
            return { negotiation, kind: "counter" };
        }

        // Persönliche Konditionen: Paket statt einer Zahl
        const neueWage = this.runde(d.wage * (1 - nachgeben));
        const neuerBonus = this.runde((d.signingBonus || 0) * (1 - nachgeben * 0.4));
        const neuesHonorar = this.runde((d.agentFee || 0) * (1 - nachgeben * 0.3));
        const neueJahre = Math.max(offer.years || 3, Math.min(4, 3));
        d.wage = neueWage;
        d.signingBonus = neuerBonus;
        d.agentFee = neuesHonorar;
        d.years = neueJahre;

        // Agenda einfordern
        let agendaText = "";
        if (negotiation.agenda && !this.agendaErfuellt(negotiation, offer)) {
            if (negotiation.agenda.type === "ausstiegsklausel") {
                d.klauseln = Object.assign({}, offer.klauseln || {}, { ausstieg: this.runde(neueWage * 60) });
                agendaText = " - und er will eine Ausstiegsklausel sehen.";
            } else if (negotiation.agenda.type === "stammplatz") {
                agendaText = " - ohne Zusage als Stammspieler bleibt es dabei.";
            } else if (negotiation.agenda.type === "handgeld") {
                agendaText = " - beim Handgeld gibt es keinen Spielraum.";
            }
        }

        negotiation.status = NEGOTIATION_STATUS.AWAITING_US;
        negotiation.replyDay = null;
        negotiation.letzterGegenvorschlag = offer;
        this.log(negotiation, state, "agent",
            `Berater ${negotiation.agentName}: ${this.formatMoney(neueWage)} pro Woche, Handgeld ${this.formatMoney(neuerBonus)}, ${neueJahre} Jahre, Honorar ${this.formatMoney(neuesHonorar)}${agendaText}`);
        this.notify(state, negotiation, `Gegenforderung: ${negotiation.playerName}`,
            `Berater ${negotiation.agentName} fordert ${this.formatMoney(neueWage)} pro Woche, Handgeld ${this.formatMoney(neuerBonus)}, ${neueJahre} Jahre Laufzeit, Honorar ${this.formatMoney(neuesHonorar)}${agendaText}`);
        return { negotiation, kind: "counter" };
    }

    /**
     * Der Stammverein prüft das Leihangebot.
     */
    static bewerteLeihe(state, negotiation) {
        const heute = this.today(state);
        const o = negotiation.lastOffer || {};
        const d = negotiation.demand;
        const reserv = negotiation.reservation || { lohnAnteil: 0.3, gebuehr: 0, walkAway: 0.7 };

        const gebuehrSoll = (d.gebuehr || 0) * (o.dauer === "winter" ? 0.5 : 1);
        // Bewertung gegen Reserve, nicht gegen Forderung
        const anteilQuote = reserv.lohnAnteil > 0 ? (o.lohnAnteil || 0) / reserv.lohnAnteil : 1;
        const gebuehrQuote = reserv.gebuehr > 0 ? (o.gebuehr || 0) / reserv.gebuehr : (gebuehrSoll > 0 ? 1 : 1);
        const stufen = this.ROLLEN.indexOf(o.rolle) - this.ROLLEN.indexOf(d.rolle);
        const rollenFaktor = stufen < 0 ? Math.pow(0.85, -stufen) : 1;
        const rueckFaktor = d.rueckholrecht && !o.rueckholrecht ? 0.9 : 1;
        const druck = negotiation.zeitdruck ? Math.min(0.08, negotiation.zeitdruck * 0.02) : 0;
        const bewertung = ((gebuehrSoll > 0 ? Math.min(1.2, anteilQuote) * 0.6 + Math.min(1.2, gebuehrQuote) * 0.4 : Math.min(1.2, anteilQuote)) * rollenFaktor * rueckFaktor) * (1 - druck);

        if (bewertung >= 0.97 && stufen >= 0) return this.schliesseLeihe(state, negotiation);

        // Walk-Away
        if (bewertung < reserv.walkAway) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            this.merkeBeziehungsschaden(state, negotiation);
            const text = stufen < 0
                ? `Berater ${negotiation.agentName}: "Ohne Zusage als ${d.rolle} kommt er nicht." Die Gespräche sind beendet.`
                : `${negotiation.sellerClubName} bricht die Gespräche ab - so geben wir ihn nicht her.`;
            this.log(negotiation, state, stufen < 0 ? "agent" : "club", text);
            this.notify(state, negotiation, `Leihe gescheitert: ${negotiation.playerName}`, text);
            return { negotiation, kind: "rejected" };
        }

        // Erst warnen
        if (bewertung < 0.6 && !negotiation.gewarnt) {
            negotiation.gewarnt = true;
            negotiation.patience = 25;
            const text = `${negotiation.sellerClubName}: "So wird das nichts. Ein letztes Leihangebot."`;
            this.log(negotiation, state, "club", text);
            this.notify(state, negotiation, `Letzte Warnung: ${negotiation.playerName}`, text);
            return { negotiation, kind: "warning" };
        }
        if (bewertung < 0.6) {
            return this.rejectFinal(state, negotiation, false);
        }

        const verlust = Math.round((1 - Math.min(1, bewertung)) * 45) + negotiation.round * 3;
        negotiation.patience = Math.max(0, negotiation.patience - verlust);

        // Gegenvorschlag: Stammverein geht herunter
        const nachgeben = 0.04 + negotiation.round * 0.02;
        d.lohnAnteil = Math.max(d.minAnteil || 0.3, Math.round(d.lohnAnteil * (1 - nachgeben) * 20) / 20);
        d.gebuehr = this.runde(d.gebuehr * (1 - nachgeben));
        const fehltRueck = d.rueckholrecht && !o.rueckholrecht;
        if (stufen >= 0 && !fehltRueck && (o.lohnAnteil || 0) + 1e-9 >= d.lohnAnteil && (o.gebuehr || 0) >= (d.gebuehr || 0) * (o.dauer === "winter" ? 0.5 : 1)) return this.schliesseLeihe(state, negotiation);
        const gebuehrJetzt = this.runde((d.gebuehr || 0) * (o.dauer === "winter" ? 0.5 : 1));
        const text = `${negotiation.sellerClubName} will ${Math.round(d.lohnAnteil * 100)} % des Gehalts${gebuehrJetzt ? ` und ${this.formatMoney(gebuehrJetzt)} Leihgebühr` : ""}`
            + `${stufen < 0 ? ` - und einen Einsatz als ${d.rolle}` : ""}${fehltRueck ? `${stufen < 0 ? "" : " -"} und ein Rückholrecht` : ""}.`;
        this.log(negotiation, state, "club", text);
        negotiation.status = NEGOTIATION_STATUS.AWAITING_US;
        negotiation.replyDay = null;
        this.notify(state, negotiation, `Gegenforderung: ${negotiation.playerName}`, text);
        return { negotiation, kind: "counter" };
    }

    /** Leihe perfekt */
    static schliesseLeihe(state, negotiation) {
        const heute = this.today(state);
        const loan = _negResolve("LoanEngine", "./loanEngine.js");
        const o = negotiation.lastOffer || {};
        const d = negotiation.demand;
        const res = loan ? loan.ausleihen(state, negotiation.playerId, o.lohnAnteil, {
            kaufoption: !!o.kaufoption,
            vereinbart: { stammvereinId: negotiation.sellerClubId, gebuehr: o.gebuehr || 0, rolle: o.rolle || d.rolle, kaufoption: d.kaufoption, optionsAufschlag: d.optionsAufschlag || 0,
                dauer: o.dauer || "saison", rueckholrecht: !!o.rueckholrecht }
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
        this.log(negotiation, state, "club", `${negotiation.sellerClubName} ist einverstanden: ${negotiation.playerName} spielt ${o.dauer === "winter" ? "bis zur Winterpause" : "bis zum Saisonende"} für uns.`);
        return { negotiation, kind: "completed" };
    }

    /**
     * Die Familie eines fremden Talents entscheidet.
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
        // Erst warnen
        if (negotiation.patience <= 0 && !negotiation.gewarnt) {
            negotiation.gewarnt = true;
            negotiation.patience = 20;
            const text = `Die Familie zögert stark. Ein letztes Angebot könnte sie überzeugen.`;
            this.log(negotiation, state, "agent", text);
            this.notify(state, negotiation, `Letzte Warnung: ${negotiation.playerName}`, text, "youth");
            return { negotiation, kind: "warning" };
        }
        if (noetig === null || negotiation.patience <= 0) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            const text = `${negotiation.playerName} bleibt bei ${negotiation.sellerClubName}. Die Familie sieht seine Zukunft dort.`;
            this.log(negotiation, state, "agent", text);
            this.notify(state, negotiation, `Absage: ${negotiation.playerName}`, text, "youth");
            return { negotiation, kind: "rejected" };
        }
        negotiation.demand.signingBonus = noetig;
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

    /**
     * Medizincheck: Risiko hängt nicht nur von injuryProneness ab,
     * sondern auch von Alter und Vorgeschichte. Ein 34-Jähriger mit
     * Kreuzbandriss-Historie fällt häufiger durch als ein 21-Jähriger.
     */
    static finishMedical(state, negotiation) {
        const player = state.players.find(p => String(p.id) === String(negotiation.playerId));
        const heute = this.today(state);

        const anfälligkeit = player?.hiddenAttributes?.injuryProneness ?? 10;
        const alter = player?.age || 25;
        const alterFaktor = alter >= 30 ? (alter - 29) * 0.01 : 0;
        const vorverletzungen = Array.isArray(player?.injuryHistory) ? Math.min(3, player.injuryHistory.length) : 0;
        const vorFaktor = vorverletzungen * 0.008;

        const risiko = 0.04 + Math.max(0, anfälligkeit - 10) * 0.012 + alterFaktor + vorFaktor;

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
     * Vorvertrag unterschreiben.
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
     * Beraterhonorar.
     */
    static beraterHonorar(ablose, wochenlohn, vereinslos = false) {
        const roh = vereinslos ? wochenlohn * 12 : (ablose || 0) * 0.04 + wochenlohn * 4;
        return Math.max(100, this.runde(roh));
    }

    /**
     * Ein Betrag, wie ihn Menschen nennen.
     */
    static runde(betrag) {
        const ce = _negResolve("ContractEngine", "./contractEngine.js");
        return ce && typeof ce.rundeBetrag === "function" ? ce.rundeBetrag(betrag) : Math.round(betrag || 0);
    }

    /**
     * Was Prämien dem Spieler je Woche wert sind.
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