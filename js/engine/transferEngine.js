/**
 * TransferEngine - Steuert Transferangebote, Verhandlungen, Marktwerte und Marktaktivität
 */

/** Auflösung der FinanceEngine in Browser- und Node-Umgebung */
const _getTransferFinanceEngine = () => {
    if (typeof FinanceEngine !== 'undefined' && FinanceEngine) return FinanceEngine;
    if (typeof window !== 'undefined' && window.FinanceEngine) return window.FinanceEngine;
    if (typeof require !== 'undefined') {
        try { return require('./financeEngine.js').FinanceEngine; } catch (e) { return null; }
    }
    return null;
};

/** Modulauflösung in Browser- und Node-Umgebung */
const _transferResolve = (name, pfad) => {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { return null; }
    }
    return null;
};
const _getTransferGameState = () => _transferResolve("GameState", "./gameState.js");
const _getTransferPlayerGenerator = () => _transferResolve("PlayerGenerator", "./playerGenerator.js");
const _getTransferWorldGenerator = () => _transferResolve("WorldGenerator", "./worldGenerator.js");

/** Ein zufälliger Eintrag aus einer Liste */
const _preZufall = (liste) => (Array.isArray(liste) && liste.length)
    ? liste[Math.floor(Math.random() * liste.length)]
    : null;

/**
 * Geldbeträge formatieren - funktioniert im Browser wie in Node,
 * auch wenn GameState (noch) nicht global verfügbar ist.
 */
const _formatTransferMoney = (amount) => {
    const gameState = (typeof GameState !== 'undefined' && GameState)
        ? GameState
        : ((typeof window !== 'undefined' && window.GameState)
            ? window.GameState
            : ((typeof require !== 'undefined') ? require('./gameState.js').GameState : null));

    if (gameState && typeof gameState.formatMoney === 'function') {
        return gameState.formatMoney(amount);
    }
    const value = Number(amount) || 0;
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)} Mio. €`;
    if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)} Tsd. €`;
    return `${Math.round(value)} €`;
};

class TransferEngine {
    /**
     * Wie weit reicht der Markt eines Vereins nach oben?
     *
     * Ein Landesligist hatte bisher die komplette Serie A im Transfermarkt
     * stehen. In Wahrheit sichtet ein Verein seine eigene Spielklasse und alles
     * darunter, dazu eine Stufe darüber - und wer einen großen Namen hat, wird
     * auch noch eine Etage höher zurückgerufen. Zurückgegeben wird die höchste
     * (also kleinste) Ligastufe, die überhaupt in Frage kommt.
     */
    static marketReach(club) {
        const stufe = club?.level || 1;
        const ruf = club?.reputation || 50;

        let hoechste = stufe - 1;
        if (ruf >= 68) hoechste -= 1;
        if (ruf >= 84) hoechste -= 1;

        return Math.max(1, hoechste);
    }

    /**
     * Steht dieser Spieler dem Verein überhaupt offen?
     * Vereinslose sind immer verfügbar - sie haben keine Liga, die abschreckt.
     */
    static isWithinReach(player, userClub, clubs = []) {
        if (!player) return false;
        if (!player.clubId) return true;
        if (!userClub) return true;

        const seinVerein = clubs.find(c => c.id === player.clubId);
        if (!seinVerein) return true;

        return (seinVerein.level || 1) >= TransferEngine.marketReach(userClub);
    }

    /**
     * Beschreibt die Marktreichweite in Worten - für den Hinweis über der Liste
     */
    static describeReach(userClub, leagues = []) {
        const grenze = TransferEngine.marketReach(userClub);
        const namen = leagues
            .filter(l => (l.level || 1) === grenze)
            .map(l => l.shortName || l.name);

        return {
            level: grenze,
            leagueNames: namen,
            text: grenze <= 1
                ? "Ihr Verein hat weltweit Zugang - auch Spieler der europäischen Topligen nehmen Gespräche an."
                : `Ihr Verein sichtet Spieler ab Ligastufe ${grenze} abwärts. Für höherklassige Profis fehlt Ihnen derzeit das Standing - mit sportlichem Erfolg und wachsendem Ruf ändert sich das.`
        };
    }

    /**
     * Berechnet den geforderten Ablösepreis für einen Spieler
     */
    static calculateAskingPrice(player, sellerClub) {
        // Vereinslose Spieler sind ablösefrei - es gibt niemanden, der kassiert
        if (!player.clubId) return 0;

        let base = player.value;
        // Wichtigkeitsfaktor im Verein
        if (player.overall >= 82) base *= 1.25;
        if (player.age <= 22) base *= 1.2;
        if (player.contractYears <= 1) base *= 0.75;
        if (player.contractYears >= 3) base *= 1.15;

        // Wenn auf Transferliste
        if (sellerClub && sellerClub.transferList && sellerClub.transferList.includes(player.id)) {
            base *= 0.85;
        }

        return Math.round(base);
    }

    /**
     * Bewertet ein Transferangebot der KI
     */
    static evaluateTransferOffer(state, playerId, buyerClubId, offeredFee) {
        const player = state.players.find(p => p.id === playerId);
        const buyerClub = state.clubs.find(c => c.id === buyerClubId);
        const sellerClub = state.clubs.find(c => c.id === player.clubId);

        if (!player || !buyerClub || !sellerClub) {
            return { accepted: false, reason: "Ungültige Vereine oder Spieler" };
        }

        if (buyerClub.transferBudget < offeredFee) {
            return { accepted: false, reason: "Nicht genügend Transferbudget vorhanden!" };
        }

        const askingPrice = TransferEngine.calculateAskingPrice(player, sellerClub);
        const ratio = offeredFee / askingPrice;

        if (ratio >= 0.95) {
            return { accepted: true, reason: "Angebot akzeptiert!", askingPrice };
        } else if (ratio >= 0.80) {
            // Gegenvorschlag
            const counterOffer = Math.round(askingPrice * 0.95);
            return { accepted: false, counterOffer, reason: `Angebot zu niedrig. Gegenvorschlag: ${_formatTransferMoney(counterOffer)}` };
        } else {
            return { accepted: false, reason: `Angebot abgelehnt! Die Mindestforderung liegt bei ${_formatTransferMoney(askingPrice)}.` };
        }
    }

    /**
     * Verhandelt Vertrag mit Spieler
     */
    static negotiateContract(player, buyerClub, offeredWage, contractYears, squadRole = "Stammspieler") {
        let expectedWage = player.wage;
        // Erwartungen basierend auf Gesamtstärke und Rolle
        if (squadRole === "Schlüsselspieler") expectedWage *= 1.25;
        else if (squadRole === "Stammspieler") expectedWage *= 1.1;
        else if (squadRole === "Rotation") expectedWage *= 0.95;
        else if (squadRole === "Talent") expectedWage *= 0.85;

        // Wechselaufschlag
        expectedWage = Math.round(expectedWage * 1.05);

        if (offeredWage >= expectedWage * 0.92) {
            return { success: true, message: "Spieler hat den Vertrag akzeptiert!" };
        } else {
            return {
                success: false,
                expectedWage,
                message: `Der Spieler fordert mindestens ${_formatTransferMoney(expectedWage)} Gehalt pro Woche für die Rolle "${squadRole}".`
            };
        }
    }

    /**
     * Schließt einen Transfer erfolgreich ab
     */
    static executeTransfer(state, playerId, buyerClubId, fee, wage, contractYears) {
        const player = state.players.find(p => p.id === playerId);
        const buyerClub = state.clubs.find(c => c.id === buyerClubId);
        const sellerClub = state.clubs.find(c => c.id === player.clubId);

        if (!player || !buyerClub) return false;

        // Finanzen verbuchen - inklusive Eintrag im Buchungsjournal, damit
        // Kontostand und Journal auch nach Transfers übereinstimmen
        const financeEngine = _getTransferFinanceEngine();

        buyerClub.balance -= fee;
        buyerClub.transferBudget -= fee;
        if (financeEngine && fee !== 0) {
            financeEngine.recordTransaction(state, buyerClub.id, "transfer_out", -fee, `Ablöse für ${player.name}`);
        }

        if (sellerClub) {
            sellerClub.balance += fee;
            sellerClub.transferBudget += Math.round(fee * 0.85); // 85% reinvestierbar
            if (financeEngine && fee !== 0) {
                financeEngine.recordTransaction(state, sellerClub.id, "transfer_in", fee, `Verkauf von ${player.name}`);
            }
            // Aus Kader des alten Vereins entfernen
            sellerClub.playerIds = sellerClub.playerIds.filter(id => id !== player.id);
            sellerClub.bench = sellerClub.bench.filter(id => id !== player.id);

            // Die Aufstellung nicht einfach zusammenschieben: Der Platz in
            // club.lineup bestimmt die Einsatzposition, ein Filter würde alle
            // dahinter eine Position nach vorne rücken. repairLineup schließt
            // die Lücke an genau der Stelle, an der sie entstanden ist.
            const gs = _getTransferGameState();
            if (gs && typeof gs.repairLineup === "function") {
                sellerClub.lineup = sellerClub.lineup.filter(id => id !== player.id);
                gs.repairLineup(sellerClub, state.players);
            } else {
                sellerClub.lineup = sellerClub.lineup.filter(id => id !== player.id);
            }
        }

        // Spieler aktualisieren
        player.clubId = buyerClub.id;
        player.wage = wage;
        player.contractYears = contractYears;
        player.morale = 95; // Frische Motivation beim Wechsel

        // Zum neuen Verein hinzufügen
        buyerClub.playerIds.push(player.id);
        if (buyerClub.bench.length < 7) {
            buyerClub.bench.push(player.id);
        }

        // Transfermarkt bereinigen
        if (state.transferMarket && Array.isArray(state.transferMarket.listedPlayerIds)) {
            state.transferMarket.listedPlayerIds = state.transferMarket.listedPlayerIds.filter(id => id !== player.id);
        }

        // Nachricht ins Postfach - aber nur, wenn es den eigenen Verein
        // betrifft. Seit die KI-Vereine untereinander handeln, sind das sonst
        // mehrere hundert fremde Transfers je Saison im eigenen Postfach.
        const betrifftUns = buyerClub.id === state.userClubId
            || (sellerClub && sellerClub.id === state.userClubId);
        if (!betrifftUns) return true;

        state.inbox.unshift({
            id: Date.now(),
            matchday: state.currentMatchday,
            date: `Spieltag ${state.currentMatchday}`,
            sender: "Transferabteilung",
            subject: `Transfer vollzogen: ${player.name}`,
            body: `Der Transfer von ${player.name} zu ${buyerClub.name} wurde für eine Ablösesumme von ${_formatTransferMoney(fee)} erfolgreich abgeschlossen. Der Spieler erhält einen ${contractYears}-Jahresvertrag mit einem Wochengehalt von ${_formatTransferMoney(wage)}.`,
            read: false,
            type: "transfer"
        });

        return true;
    }

    // ------------------------------------------------- Markt der KI-Vereine
    //
    // Bisher bewegte sich in der Spielwelt kein einziger Spieler: Beide
    // KI-Funktionen boten ausschliesslich auf Spieler des Nutzers, einen Weg
    // von KI-Verein A zu KI-Verein B gab es nicht. Gemessen ueber drei
    // Saisons standen danach 92 Prozent aller Spieler noch bei ihrem
    // Startverein, nach der ersten Saison sogar jeder einzelne. Ein Rivale
    // verstaerkte sich nie, man wurde nie ueberboten, und der Kader des
    // Tabellenzweiten war im Mai derselbe wie im August.

    /** Laeuft gerade ein Transferfenster? */
    static istTransferfenster(state) {
        if (state?.preseason?.aktiv) return true;
        const md = state?.currentMatchday || 0;
        const gesamt = state?.totalMatchdays || 34;
        // Ein spaetes Sommerfenster und ein Winterfenster zur Halbserie
        if (md <= 2) return true;
        const winter = Math.round(gesamt / 2);
        return md >= winter && md <= winter + 1;
    }

    /**
     * Was einem Kader fehlt.
     *
     * Verglichen wird der Ist-Bestand je Position mit dem Sollplan der
     * Ligastufe. Fehlt eine Position ganz, ist das die dringendste Luecke;
     * sonst zaehlt, wo der beste Mann des Vereins am weitesten unter dem
     * eigenen Niveau bleibt.
     */
    /**
     * Nachschlagewerk für ein Transferfenster.
     *
     * Ohne Index kostete ein einziger Transferversuch gemessen 54 Millisekunden,
     * weil für jeden der 4752 Spieler erneut über alle Spieler und Vereine
     * gesucht wurde - quadratischer Aufwand. Der Index wird einmal je Fenster
     * gebaut und danach nur noch fortgeschrieben.
     */
    static baueMarktIndex(state) {
        const spieler = new Map();
        state.players.forEach(p => spieler.set(p.id, p));

        const vereine = new Map();
        state.clubs.forEach(c => vereine.set(c.id, c));

        const nachPosition = new Map();
        state.players.forEach(p => {
            if (!nachPosition.has(p.pos)) nachPosition.set(p.pos, []);
            nachPosition.get(p.pos).push(p);
        });

        const kaderNachPos = new Map();
        state.clubs.forEach(c => {
            const m = {};
            (c.playerIds || []).forEach(id => {
                const p = spieler.get(id);
                if (p) (m[p.pos] = m[p.pos] || []).push(p);
            });
            kaderNachPos.set(c.id, m);
        });

        return { spieler, vereine, nachPosition, kaderNachPos };
    }

    /** Den Index nach einem Wechsel nachziehen */
    static aktualisiereIndex(markt, spieler, vonId, zuId) {
        if (!markt) return;
        const raus = markt.kaderNachPos.get(vonId);
        if (raus && raus[spieler.pos]) {
            raus[spieler.pos] = raus[spieler.pos].filter(p => p.id !== spieler.id);
        }
        const rein = markt.kaderNachPos.get(zuId);
        if (rein) (rein[spieler.pos] = rein[spieler.pos] || []).push(spieler);
    }

    static kaderBedarf(state, club, markt = null) {
        const gen = _getTransferPlayerGenerator();
        const welt = _getTransferWorldGenerator();
        if (!gen || typeof gen.buildSquadPlan !== "function") return null;

        const soll = (welt?.SQUAD_SIZES?.[club.level || 1]) || 20;

        const bestand = markt
            ? (markt.kaderNachPos.get(club.id) || {})
            : (() => {
                const m = {};
                (club.playerIds || []).forEach(id => {
                    const p = state.players.find(x => x.id === id);
                    if (p) (m[p.pos] = m[p.pos] || []).push(p);
                });
                return m;
            })();

        const kader = Object.values(bestand).flat();
        if (kader.length === 0) return null;

        const plan = gen.buildSquadPlan(soll);
        const bedarfZahl = {};
        plan.forEach(pos => { bedarfZahl[pos] = (bedarfZahl[pos] || 0) + 1; });

        // 1. Echte Luecken zuerst
        const luecken = Object.keys(bedarfZahl)
            .filter(pos => (bestand[pos] || []).length < bedarfZahl[pos]);
        if (luecken.length > 0 && kader.length < soll + 3) {
            return { pos: _preZufall(luecken), art: "luecke", messlatte: 0 };
        }

        // 2. Sonst die schwaechste Position gemessen am eigenen Niveau
        const niveau = kader.reduce((a, p) => a + (p.overall || 50), 0) / kader.length;
        let schwaechste = null;
        Object.keys(bedarfZahl).forEach(pos => {
            const beste = (bestand[pos] || []).map(p => p.overall || 0).sort((a, b) => b - a)[0] || 0;
            if (!schwaechste || beste < schwaechste.beste) schwaechste = { pos, beste };
        });
        if (!schwaechste) return null;
        // Nur wenn die Position wirklich hinterherhinkt
        if (schwaechste.beste >= niveau + 4) return null;
        return { pos: schwaechste.pos, art: "verstaerkung", messlatte: schwaechste.beste };
    }

    /**
     * Ein Transferfenster der KI-Vereine.
     *
     * Je Versuch sucht sich ein Verein mit Etat eine Luecke, einen passenden
     * Spieler und bietet. Der abgebende Verein verkauft nur, wenn er die
     * Position danach noch besetzt hat - sonst entstuenden Kader ohne Torwart.
     */
    static processAiTransferWindow(state, versuche = 10) {
        if (!state || !Array.isArray(state.clubs)) return 0;

        const kaeufer = state.clubs.filter(c =>
            c.id !== state.userClubId && (c.transferBudget || 0) > 250000);
        if (kaeufer.length === 0) return 0;

        const markt = this.baueMarktIndex(state);
        let vollzogen = 0;
        for (let i = 0; i < versuche; i++) {
            const club = _preZufall(kaeufer);
            if (!club) continue;
            if (this.versucheEinenTransfer(state, club, markt)) vollzogen++;
        }
        return vollzogen;
    }

    /** Ein einzelner Transferversuch eines Vereins */
    static versucheEinenTransfer(state, club, markt = null) {
        if (!markt) markt = this.baueMarktIndex(state);

        const bedarf = this.kaderBedarf(state, club, markt);
        if (!bedarf) return false;

        const eigenerRuf = club.reputation || 60;

        // Wen ein Verein überhaupt in Betracht zieht: die gesuchte Position,
        // besser als das, was er hat, und kein Spieler des Nutzers - dessen
        // Kader rührt die KI nur über ein Angebot an, das er annehmen kann.
        const kandidaten = [];
        for (const p of (markt.nachPosition.get(bedarf.pos) || [])) {
            if (p.clubId === club.id) continue;
            if (p.clubId === state.userClubId) continue;
            if ((p.injuredWeeks || 0) > 0) continue;
            if ((p.overall || 0) <= bedarf.messlatte) continue;

            const verkaeufer = p.clubId ? markt.vereine.get(p.clubId) : null;

            // Niemand gibt seinen letzten Mann auf einer Position her. Ein
            // Kader hat auf den meisten Positionen aber nur zwei Leute -
            // verlangte man drei, kam der Markt gar nicht erst in Gang
            // (gemessen scheiterten 288 von 300 Versuchen genau daran).
            // Massgeblich ist deshalb, was nach dem Verkauf uebrig bleibt:
            // beim Torwart zwei, im Feld einer.
            let istBester = false;
            if (verkaeufer) {
                const gleichePos = (markt.kaderNachPos.get(verkaeufer.id) || {})[p.pos] || [];
                const mindestNachher = p.pos === "TW" ? 2 : 1;
                if (gleichePos.length - 1 < mindestNachher) continue;

                istBester = !gleichePos.some(x => x.id !== p.id && (x.overall || 0) >= (p.overall || 0));

                // Ein Spieler wechselt nicht in eine deutlich kleinere Nummer
                if ((verkaeufer.reputation || 60) > eigenerRuf + 12) continue;
            }

            const preis = this.calculateAskingPrice(p, verkaeufer);
            if (preis > (club.transferBudget || 0)) continue;

            // Wie sehr will dieser Verein genau diesen Spieler?
            const gewinn = (p.overall || 0) - bedarf.messlatte;
            const jung = (p.age || 25) <= 24 ? 4 : 0;
            const ablauf = (p.contractYears ?? 3) <= 1 ? 5 : 0;
            kandidaten.push({ p, verkaeufer, preis, istBester, reiz: gewinn + jung + ablauf });
        }

        if (kandidaten.length === 0) return false;

        // Unter den besten fünf wird gewürfelt - sonst kaufen alle denselben
        kandidaten.sort((a, b) => b.reiz - a.reiz);
        const wahl = _preZufall(kandidaten.slice(0, 5));
        if (!wahl) return false;

        const { p, verkaeufer, preis, istBester } = wahl;

        // Das Gebot: knapp über der Forderung, damit es meist durchgeht.
        // Für den besten Mann einer Position legt der Käufer drauf.
        const aufschlag = istBester ? 1.38 : 1.0;
        const gebot = Math.round(preis * aufschlag * (0.98 + Math.random() * 0.22));
        if (gebot > (club.transferBudget || 0)) return false;

        // Der abgebende Verein muss zustimmen: Wer seinen besten Mann auf
        // einer Position hergibt, will dafür deutlich mehr sehen als für
        // einen Ersatzspieler.
        if (verkaeufer) {
            const noetig = preis * (istBester ? 1.35 : 0.95);
            if (gebot < noetig) return false;
        }

        // Das Gehalt muss in den Etat passen
        const lohn = Math.round((p.wage || 10000) * (1.05 + Math.random() * 0.25));
        const lohnsumme = (club.playerIds || [])
            .reduce((s, id) => s + (markt.spieler.get(id)?.wage || 0), 0);
        if (lohnsumme + lohn > (club.wageBudget || Infinity) * 1.1) return false;

        const laufzeit = (p.age || 25) <= 24 ? 4 : (p.age || 25) <= 30 ? 3 : 2;
        const vonId = p.clubId;
        const ok = this.executeTransfer(state, p.id, club.id, verkaeufer ? gebot : 0, lohn, laufzeit);
        if (!ok) return false;

        this.aktualisiereIndex(markt, p, vonId, club.id);

        // Für die Anzeige: die letzten Wechsel der Spielwelt
        if (!state.transferMarket) state.transferMarket = { offers: [], history: [], shortlist: [] };
        if (!Array.isArray(state.transferMarket.history)) state.transferMarket.history = [];
        state.transferMarket.history.unshift({
            playerName: p.name,
            pos: p.pos,
            overall: p.overall,
            vonId: verkaeufer?.id || null,
            von: verkaeufer?.name || "vereinslos",
            zuId: club.id,
            zu: club.name,
            fee: verkaeufer ? gebot : 0,
            matchday: state.currentMatchday || 0,
            season: state.seasonYear || 1
        });
        if (state.transferMarket.history.length > 60) {
            state.transferMarket.history = state.transferMarket.history.slice(0, 60);
        }
        return true;
    }

    /** Durchschnittliche Stärke eines Kaders */
    static kaderNiveau(state, club) {
        const kader = (club.playerIds || [])
            .map(id => state.players.find(p => p.id === id))
            .filter(Boolean);
        if (kader.length === 0) return 50;
        return kader.reduce((a, p) => a + (p.overall || 50), 0) / kader.length;
    }

    /** Wie viele Tage ein Angebot für einen eigenen Spieler gilt */
    static ANGEBOTS_FRIST = 4;

    /** Offene Angebote anderer Vereine für eigene Spieler, dringendste zuerst */
    static offeneAngebote(state) {
        return (state?.transferMarket?.offers || [])
            .filter(o => o.status === "pending")
            .sort((a, b) => (a.frist ?? Infinity) - (b.frist ?? Infinity));
    }

    /** Ein Angebot annehmen: Der Spieler wechselt zu der vereinbarten Ablöse */
    static nimmAngebotAn(state, offerId) {
        const offer = (state?.transferMarket?.offers || []).find(o => String(o.id) === String(offerId));
        if (!offer || offer.status !== "pending") return { ok: false, grund: "Das Angebot liegt nicht mehr vor." };
        const buyerId = offer.fromClubId || offer.buyerClubId;
        const ok = this.executeTransfer(state, offer.playerId, buyerId, offer.fee, 50000, 3);
        if (ok === false) return { ok: false, grund: "Der Wechsel ist gescheitert." };
        offer.status = "accepted";
        return { ok: true, offer };
    }

    /** Ein Angebot ablehnen */
    static lehneAngebotAb(state, offerId) {
        const offer = (state?.transferMarket?.offers || []).find(o => String(o.id) === String(offerId));
        if (!offer || offer.status !== "pending") return { ok: false };
        offer.status = "rejected";
        return { ok: true, offer };
    }

    /**
     * Mehr fordern.
     *
     * Der Käufer hat eine Grenze, die er nicht verrät. Liegt die Forderung
     * darunter, geht er mit. Liegt sie knapp darüber, bessert er bis zu seiner
     * Grenze nach. Ist sie maßlos, zieht er das Angebot zurück. Nachgebessert
     * wird nur einmal - danach heißt es annehmen oder ablehnen.
     */
    static fordereMehr(state, offerId, forderung) {
        const offer = (state?.transferMarket?.offers || []).find(o => String(o.id) === String(offerId));
        if (!offer || offer.status !== "pending") return { status: "fehler", text: "Das Angebot liegt nicht mehr vor." };
        const betrag = Math.round(Number(forderung) || 0);
        if (betrag <= offer.fee) return { status: "fehler", text: "Die Forderung muss über dem Angebot liegen." };
        if (offer.nachgebessert) {
            return { status: "fehler", text: `${offer.fromClubName} hat bereits nachgebessert und geht nicht weiter.` };
        }
        const grenze = offer.maxFee || Math.round(offer.fee * 1.15);
        offer.nachgebessert = true;
        if (betrag <= grenze) {
            offer.fee = betrag;
            return { status: "angenommen", offer, text: `${offer.fromClubName} geht auf ${_formatTransferMoney(betrag)} mit.` };
        }
        if (betrag > grenze * 1.3) {
            offer.status = "withdrawn";
            return { status: "zurueckgezogen", offer, text: `${offer.fromClubName} zieht das Angebot zurück - die Forderung ist ihnen zu hoch.` };
        }
        offer.fee = grenze;
        return { status: "nachgebessert", offer, text: `${offer.fromClubName} bessert auf ${_formatTransferMoney(grenze)} nach - mehr ist nicht drin.` };
    }

    /**
     * Abgelaufene Angebote verfallen. Wer nicht antwortet, hat abgelehnt -
     * der interessierte Verein meldet sich dann ab.
     */
    static pruefeAngebotsfristen(state) {
        const tag = state?.currentDayIndex || 0;
        const verfallen = [];
        (state?.transferMarket?.offers || []).forEach(o => {
            if (o.status !== "pending" || typeof o.frist !== "number") return;
            // Der Kalender zählt jede Saison von vorn - ein Angebot aus der
            // alten Saison ist mit dem Saisonwechsel verfallen
            const alteSaison = typeof o.saison === "number" && o.saison !== (state.seasonYear || 1);
            if (!alteSaison && tag <= o.frist) return;
            o.status = "expired";
            verfallen.push(o);
            if (Array.isArray(state.inbox)) {
                state.inbox.unshift({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    matchday: state.currentMatchday,
                    date: state.currentDate || `Spieltag ${state.currentMatchday}`,
                    sender: o.fromClubName || "Transfermarkt",
                    subject: `Angebot für ${o.playerName} verfallen`,
                    body: `Sie haben auf unser Angebot von ${_formatTransferMoney(o.fee)} für ${o.playerName} nicht reagiert. Wir betrachten die Sache als erledigt.`,
                    read: false,
                    type: "transfer_offer"
                });
            }
        });
        return verfallen;
    }

    /**
     * Erzeugt gelegentliche Angebote von KI-Vereinen für Spieler des Spielers
     */
    static processAITransferMarket(state) {
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        // 20% Chance pro Spieltag auf ein KI-Angebot für einen Spieler des Managers
        if (Math.random() < 0.25 && userClub.playerIds.length > 15) {
            const randomPlayerId = userClub.playerIds[Math.floor(Math.random() * userClub.playerIds.length)];
            const player = state.players.find(p => p.id === randomPlayerId);

            if (player && player.overall >= 74) {
                const aiClubs = state.clubs.filter(c => c.id !== userClub.id && c.transferBudget >= player.value * 0.9);
                if (aiClubs.length > 0) {
                    const interestedClub = aiClubs[Math.floor(Math.random() * aiClubs.length)];
                    const offerFee = Math.round(player.value * (0.95 + Math.random() * 0.3));
                    // Wie weit der Verein höchstens gehen würde - verrät er nicht
                    const maxFee = Math.min(interestedClub.transferBudget || offerFee,
                        Math.round(offerFee * (1.06 + Math.random() * 0.24)));

                    const tag = state.currentDayIndex || 0;
                    state.transferMarket.offers.unshift({
                        id: Date.now(),
                        playerId: player.id,
                        playerName: player.name,
                        playerOverall: player.overall,
                        playerPos: player.pos,
                        playerAge: player.age,
                        playerValue: player.value,
                        fromClubId: interestedClub.id,
                        fromClubName: interestedClub.name,
                        toClubId: userClub.id,
                        fee: offerFee,
                        maxFee: Math.max(offerFee, maxFee),
                        eingang: tag,
                        frist: tag + this.ANGEBOTS_FRIST,
                        saison: state.seasonYear || 1,
                        gemeldet: false,
                        status: "pending"
                    });

                    state.inbox.unshift({
                        id: Date.now() + 1,
                        matchday: state.currentMatchday,
                        date: `Spieltag ${state.currentMatchday}`,
                        sender: interestedClub.name,
                        subject: `💰 Angebot: ${_formatTransferMoney(offerFee)} für ${player.name}`,
                        body: `${interestedClub.name} bietet ${_formatTransferMoney(offerFee)} Ablösesumme für Ihren Spieler ${player.name} (${player.pos}, ${player.age} Jahre, Marktwert ${_formatTransferMoney(player.value)}).\n\nDas Angebot gilt ${this.ANGEBOTS_FRIST} Tage. Sie können annehmen, ablehnen oder mehr fordern - im Transfermarkt ganz oben.`,
                        read: false,
                        type: "transfer_offer"
                    });
                }
            }
        }
    }
}

if (typeof window !== "undefined") {
    window.TransferEngine = TransferEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TransferEngine };
}
