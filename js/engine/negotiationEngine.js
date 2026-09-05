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
    static startTransferNegotiation(state, playerId, buyerClubId, openingFee = null) {
        const player = state.players.find(p => String(p.id) === String(playerId));
        if (!player) return { success: false, error: "Spieler nicht gefunden." };

        const buyerClub = state.clubs.find(c => c.id === buyerClubId);
        if (!buyerClub) return { success: false, error: "Verein nicht gefunden." };
        if (player.clubId === buyerClubId) return { success: false, error: "Der Spieler steht bereits bei uns unter Vertrag." };

        const existing = this.getOpenNegotiations(state)
            .find(n => String(n.playerId) === String(playerId) && n.clubId === buyerClubId);
        if (existing) return { success: false, error: "Für diesen Spieler läuft bereits eine Verhandlung.", negotiation: existing };

        const sellerClub = state.clubs.find(c => c.id === player.clubId);
        const transferEngine = this.getTransferEngine();
        const askingPrice = transferEngine
            ? transferEngine.calculateAskingPrice(player, sellerClub)
            : Math.round((player.value || 1000000) * 1.15);

        const agent = this.getAgentFor(player);
        const wageDemand = Math.round((player.wage || 10000) * 1.18 * agent.greed);

        const negotiation = {
            id: `neg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: "transfer",
            playerId: player.id,
            playerName: player.name,
            playerPos: player.pos,
            clubId: buyerClubId,
            sellerClubId: sellerClub ? sellerClub.id : null,
            sellerClubName: sellerClub ? sellerClub.name : "Vereinslos",
            agentName: agent.name,
            agentProfile: agent.profile,
            agentLabel: agent.label,
            stage: sellerClub ? NEGOTIATION_STAGES.FEE : NEGOTIATION_STAGES.TERMS,
            status: NEGOTIATION_STATUS.AWAITING_US,
            openedDay: this.today(state),
            deadlineDay: this.today(state) + 14,
            replyDay: null,
            round: 0,
            patience: agent.patience,
            demand: {
                fee: askingPrice,
                wage: wageDemand,
                years: 3,
                signingBonus: Math.round(wageDemand * 6)
            },
            agreed: { fee: null, wage: null, years: null, signingBonus: null },
            lastOffer: null,
            log: []
        };

        this.log(negotiation, state, "system",
            sellerClub
                ? `Verhandlung mit ${sellerClub.name} über ${player.name} eröffnet. Geforderte Ablöse: ${this.formatMoney(askingPrice)}.`
                : `${player.name} ist vereinslos. Es geht direkt um die persönlichen Konditionen.`);

        if (openingFee !== null) {
            this.ensureList(state).push(negotiation);
            return this.submitOffer(state, negotiation.id, { fee: openingFee });
        }

        this.ensureList(state).push(negotiation);
        return { success: true, negotiation };
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
            patience: agent.patience,
            demand: {
                fee: 0,
                wage: wageDemand,
                years: 3,
                signingBonus: Math.round(wageDemand * 4)
            },
            agreed: { fee: 0, wage: null, years: null, signingBonus: null },
            lastOffer: null,
            log: []
        };

        this.log(negotiation, state, "agent",
            `Berater ${agent.name}: "${prospect.name} ist bereit für den Profikader. Wir sprechen über ${this.formatMoney(wageDemand)} pro Woche und eine Laufzeit von drei Jahren."`);

        this.ensureList(state).push(negotiation);
        return { success: true, negotiation };
    }

    static findProspect(state, club, prospectId) {
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

        if (negotiation.stage === NEGOTIATION_STAGES.FEE) {
            const fee = Math.max(0, Math.round(Number(offer.fee) || 0));
            if (fee > (club.transferBudget || 0)) {
                return { success: false, error: `Das Transferbudget reicht nicht: verfügbar ${this.formatMoney(club.transferBudget || 0)}.` };
            }
            negotiation.lastOffer = { fee };
            this.log(negotiation, state, "us", `Angebot über eine Ablöse von ${this.formatMoney(fee)} abgegeben.`);
        } else if (negotiation.stage === NEGOTIATION_STAGES.TERMS) {
            const wage = Math.max(0, Math.round(Number(offer.wage) || 0));
            const years = Math.max(1, Math.min(5, Math.round(Number(offer.years) || 3)));
            const bonus = Math.max(0, Math.round(Number(offer.signingBonus) ?? negotiation.demand.signingBonus));
            negotiation.lastOffer = { wage, years, signingBonus: bonus };
            this.log(negotiation, state, "us",
                `Konditionen angeboten: ${this.formatMoney(wage)} pro Woche, ${years} Jahre Laufzeit, Handgeld ${this.formatMoney(bonus)}.`);
        } else {
            return { success: false, error: "In dieser Phase ist kein Angebot vorgesehen." };
        }

        negotiation.round++;
        negotiation.status = NEGOTIATION_STATUS.WAITING_REPLY;
        negotiation.replyDay = this.today(state) + this.replyDelay({ profile: negotiation.agentProfile });

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
        const ereignisse = [];

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

        const offer = negotiation.lastOffer || {};
        const istAblöse = negotiation.stage === NEGOTIATION_STAGES.FEE;
        const gefordert = istAblöse ? negotiation.demand.fee : negotiation.demand.wage;
        const geboten = istAblöse ? (offer.fee || 0) : (offer.wage || 0);
        const quote = gefordert > 0 ? geboten / gefordert : 1;

        // Kurze Laufzeiten kosten den Berater Provision - das schmeckt ihm nicht
        let bewertung = quote;
        if (!istAblöse) {
            const jahre = offer.years || 3;
            bewertung *= jahre <= 1 ? 0.9 : (jahre >= 4 ? 1.05 : 1.0);
            const bonusQuote = negotiation.demand.signingBonus > 0
                ? (offer.signingBonus || 0) / negotiation.demand.signingBonus
                : 1;
            bewertung = bewertung * 0.85 + Math.min(1.2, bonusQuote) * 0.15;
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

        if (istAblöse) {
            negotiation.agreed.fee = offer.fee;
            negotiation.stage = NEGOTIATION_STAGES.TERMS;
            negotiation.status = NEGOTIATION_STATUS.AWAITING_US;
            negotiation.replyDay = null;
            this.log(negotiation, state, "club",
                `${negotiation.sellerClubName} stimmt einer Ablöse von ${this.formatMoney(offer.fee)} zu. Jetzt geht es um die persönlichen Konditionen.`);
            this.notify(state, negotiation, `Einigung über die Ablöse: ${negotiation.playerName}`,
                `${negotiation.sellerClubName} akzeptiert ${this.formatMoney(offer.fee)}. Berater ${negotiation.agentName} erwartet nun Ihr Angebot über die persönlichen Konditionen (Forderung: ${this.formatMoney(negotiation.demand.wage)} pro Woche).`);
            return { negotiation, kind: "fee_agreed" };
        }

        negotiation.agreed.wage = offer.wage;
        negotiation.agreed.years = offer.years;
        negotiation.agreed.signingBonus = offer.signingBonus;

        if (negotiation.type === "youth_promotion") {
            return this.completeYouthPromotion(state, negotiation);
        }

        negotiation.stage = NEGOTIATION_STAGES.MEDICAL;
        negotiation.status = NEGOTIATION_STATUS.WAITING_REPLY;
        negotiation.replyDay = heute + 2;
        this.log(negotiation, state, "agent",
            `Berater ${negotiation.agentName} ist einverstanden. Der Medizincheck ist für die nächsten Tage angesetzt.`);
        this.notify(state, negotiation, `Konditionen geklärt: ${negotiation.playerName}`,
            `${negotiation.playerName} ist sich mit uns einig. Der Medizincheck steht in zwei Tagen an.`);
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
        const neueForderung = istAblöse
            ? Math.round(negotiation.demand.fee * (1 - nachgeben))
            : Math.round(negotiation.demand.wage * (1 - nachgeben) / 50) * 50;

        if (neueForderung <= geboten) {
            if (istAblöse) negotiation.demand.fee = geboten;
            else negotiation.demand.wage = geboten;
            return this.acceptCurrentOffer(state, negotiation, istAblöse, offer);
        }

        if (istAblöse) {
            negotiation.demand.fee = neueForderung;
            this.log(negotiation, state, "club",
                `${negotiation.sellerClubName} lehnt ab und fordert ${this.formatMoney(neueForderung)}.`);
            this.notify(state, negotiation, `Gegenforderung: ${negotiation.playerName}`,
                `${negotiation.sellerClubName} lehnt ${this.formatMoney(geboten)} ab und fordert ${this.formatMoney(neueForderung)}. Verbleibende Geduld: ${negotiation.patience}%.`);
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

        const ok = transferEngine.executeTransfer(
            state,
            negotiation.playerId,
            negotiation.clubId,
            negotiation.agreed.fee || 0,
            negotiation.agreed.wage || 0,
            negotiation.agreed.years || 3
        );

        if (!ok) {
            negotiation.status = NEGOTIATION_STATUS.REJECTED;
            negotiation.closedDay = heute;
            this.log(negotiation, state, "system", "Der Wechsel konnte nicht vollzogen werden.");
            return { negotiation, kind: "failed" };
        }

        // Handgeld getrennt verbuchen
        const bonus = negotiation.agreed.signingBonus || 0;
        if (bonus > 0) {
            const club = state.clubs.find(c => c.id === negotiation.clubId);
            const finance = this.getFinanceEngine();
            if (club) club.balance -= bonus;
            if (finance && typeof finance.recordTransaction === "function") {
                finance.recordTransaction(state, negotiation.clubId, "transfer_out", -bonus, `Handgeld für ${negotiation.playerName}`);
            }
        }

        negotiation.status = NEGOTIATION_STATUS.ACCEPTED;
        negotiation.stage = NEGOTIATION_STAGES.DONE;
        negotiation.closedDay = heute;
        this.log(negotiation, state, "system",
            `${negotiation.playerName} hat unterschrieben: ${this.formatMoney(negotiation.agreed.fee || 0)} Ablöse, ${this.formatMoney(negotiation.agreed.wage || 0)} pro Woche.`);
        this.notify(state, negotiation, `Transfer perfekt: ${negotiation.playerName}`,
            `${negotiation.playerName} hat einen Vertrag über ${negotiation.agreed.years} Jahre unterschrieben. Ablöse: ${this.formatMoney(negotiation.agreed.fee || 0)}, Gehalt: ${this.formatMoney(negotiation.agreed.wage || 0)} pro Woche.`);

        return { negotiation, kind: "completed" };
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

        const bonus = negotiation.agreed.signingBonus || 0;
        if (bonus > 0) {
            const club = state.clubs.find(c => c.id === negotiation.clubId);
            const finance = this.getFinanceEngine();
            if (club) club.balance -= bonus;
            if (finance && typeof finance.recordTransaction === "function") {
                finance.recordTransaction(state, negotiation.clubId, "transfer_out", -bonus, `Handgeld für ${negotiation.playerName}`);
            }
        }

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

    /**
     * Kurzfassung für die Oberfläche: Was ist der nächste Schritt?
     */
    static describe(negotiation) {
        if (!negotiation) return "";
        switch (negotiation.status) {
            case NEGOTIATION_STATUS.WAITING_REPLY:
                return negotiation.stage === NEGOTIATION_STAGES.MEDICAL
                    ? "Medizincheck läuft"
                    : "Die Gegenseite prüft unser Angebot";
            case NEGOTIATION_STATUS.AWAITING_US:
                return negotiation.stage === NEGOTIATION_STAGES.FEE
                    ? "Wir sind am Zug: Ablöse"
                    : "Wir sind am Zug: persönliche Konditionen";
            case NEGOTIATION_STATUS.ACCEPTED: return "Abgeschlossen";
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
