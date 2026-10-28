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
     * Die Wechselbilanz je Liga und Saison für die Wettbewerbsseite: Zugänge,
     * Abgänge, wie viele davon aus dem Ausland kamen, Ausgaben, Einnahmen und
     * die letzten zwölf Zugänge. Klein gehalten, sie steht im Spielstand.
     */
    static merkeLigaWechsel(state, player, von, zu, fee) {
        if (!state || !player || !zu) return;
        const saison = state.seasonYear || 1;
        const buch = state.ligaWechsel || (state.ligaWechsel = {});
        const bilanz = (ligaId) => {
            if (!ligaId) return null;
            if (!buch[ligaId] || buch[ligaId].saison !== saison) {
                buch[ligaId] = { saison, zu: 0, ab: 0, ausland: 0, ausgaben: 0, einnahmen: 0, liste: [] };
            }
            return buch[ligaId];
        };
        const betrag = Math.max(0, Number(fee) || 0);
        const rein = bilanz(zu.leagueId);
        if (rein) {
            rein.zu++;
            rein.ausgaben += betrag;
            if (von && von.countryId && zu.countryId && von.countryId !== zu.countryId) rein.ausland++;
            rein.liste.push({ s: player.name, p: player.id, v: von ? von.name : "vereinslos", z: zu.id, f: betrag, d: state.currentDate || "" });
            if (rein.liste.length > 12) rein.liste.splice(0, rein.liste.length - 12);
        }
        const raus = von ? bilanz(von.leagueId) : null;
        if (raus) {
            raus.ab++;
            raus.einnahmen += betrag;
        }
    }

    /** Arbeitserlaubnis (England): null, wenn sie erteilt würde - sonst der Grund */
    static erlaubnisHindernis(state, player, club) {
        const erlaubnis = _transferResolve("ArbeitserlaubnisEngine", "./arbeitserlaubnisEngine.js");
        if (!erlaubnis || !player || !club) return null;
        const pruefung = erlaubnis.pruefe(state, player, club);
        return pruefung.erteilt ? null : pruefung.text;
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
     * Verfügbarkeit erfragen, wie im Vorbild: Was sagt der Verein, wenn man
     * unverbindlich nach einem Spieler fragt? Die Antwort folgt derselben
     * Forderung, mit der eine Verhandlung eröffnet würde
     * (calculateAskingPrice), gerundet - dazu, was einem Wechsel im Weg
     * steht. Liefert { stufe, titel, text, preis, hinweise } oder null für
     * eigene Spieler.
     *
     *   frei          - vereinslos, sofort zu haben
     *   verkauf       - auf der Transferliste, der Verein will ihn abgeben
     *   gespraechsbereit - Vertrag läuft aus, der Verein hört zu
     *   offen         - nicht auf dem Markt, für ein gutes Angebot zu haben
     *   schluessel    - Leistungsträger mit langem Vertrag: Der Verein will
     *                   ihn nicht abgeben, unter der Forderung braucht man
     *                   nicht anzufragen
     *   vergeben      - schon für einen anderen Verein unterschrieben
     */
    static verfuegbarkeit(state, player, kaeuferId = state?.userClubId) {
        if (!player || (player.clubId && player.clubId === kaeuferId)) return null;
        const runde = (b) => {
            if (!b) return 0;
            const stelle = Math.pow(10, Math.max(0, Math.floor(Math.log10(b)) - 1));
            return Math.round(b / stelle) * stelle;
        };
        // Eine Auskunft, kein Angebot: "um 26 Mio. €", nicht "25,97 Mio. €"
        const geld = (b) => {
            const r = runde(b);
            return r >= 1e6 ? `${(r / 1e6).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio. €`
                : `${Math.round(r / 1000).toLocaleString("de-DE")} Tsd. €`;
        };
        const hinweise = [];
        const verein = (state.clubs || []).find(c => c.id === player.clubId) || null;
        const kaeufer = (state.clubs || []).find(c => c.id === kaeuferId) || null;
        const fenster = this.fensterHindernis(state, { vereinslos: !verein });
        if (fenster) hinweise.push(fenster);
        const erlaubnis = typeof NegotiationEngine !== "undefined" && typeof NegotiationEngine.erlaubnisPruefung === "function" && kaeufer
            ? NegotiationEngine.erlaubnisPruefung(state, player, kaeufer) : null;
        if (erlaubnis && !erlaubnis.erteilt) hinweise.push(erlaubnis.text);
        const klausel = typeof this.ausstiegsklausel === "function" ? this.ausstiegsklausel(state, player) : null;
        if (klausel) hinweise.push(`Ausstiegsklausel über ${geld(klausel)} - wer sie zahlt, muss nicht verhandeln.`);

        if (player.vorvertrag && player.vorvertrag.clubId !== kaeuferId) {
            return { stufe: "vergeben", titel: "Schon vergeben", preis: null, hinweise,
                text: `${player.name} hat bereits bei ${player.vorvertrag.clubName || "einem anderen Verein"} unterschrieben und wechselt zum Saisonende.` };
        }
        if (!verein) {
            return { stufe: "frei", titel: "Vereinslos", preis: 0, hinweise,
                text: `${player.name} ist ohne Verein und kann sofort unterschreiben - ohne Ablöse, aber mit Handgeld.` };
        }
        const preis = this.calculateAskingPrice(player, verein);
        if (player.leihe && player.leihe.stammvereinId && player.leihe.stammvereinId !== verein.id) {
            const stamm = (state.clubs || []).find(c => c.id === player.leihe.stammvereinId);
            hinweise.unshift(`Er ist nur ausgeliehen. Über einen Wechsel entscheidet ${stamm ? stamm.name : "sein Stammverein"}.`);
        }
        if (player.transferListed || (verein.transferList || []).includes(player.id)) {
            return { stufe: "verkauf", titel: "Steht zum Verkauf", preis, hinweise,
                text: `${verein.name} will ${player.name} abgeben. Ab etwa ${geld(preis)} ist man gesprächsbereit.` };
        }
        // Leistungsträger: unter den drei Besten des Kaders
        const kader = (state.players || []).filter(p => p.clubId === verein.id && !p.reserve);
        const rang = kader.filter(p => (p.overall || 0) > (player.overall || 0)).length;
        if (rang < 3 && (player.contractYears ?? 0) >= 2) {
            return { stufe: "schluessel", titel: "Schlüsselspieler", preis, hinweise,
                text: `${player.name} gehört zu den wichtigsten Spielern von ${verein.name}, abgeben will man ihn eigentlich nicht. Unter ${geld(preis)} braucht man gar nicht erst anzufragen.` };
        }
        if ((player.contractYears ?? 0) <= 1) {
            return { stufe: "gespraechsbereit", titel: "Gesprächsbereit", preis, hinweise,
                text: `Sein Vertrag läuft aus. ${verein.name} würde ihn lieber jetzt verkaufen als ablösefrei ziehen lassen: um ${geld(preis)}.` };
        }
        return { stufe: "offen", titel: "Nicht auf dem Markt", preis, hinweise,
            text: `${verein.name} sucht keinen Käufer, würde ein gutes Angebot aber anhören: um ${geld(preis)}.` };
    }

    /**
     * Was ein Spieler beim Wechsel ungefähr verdienen will, als Spanne je
     * Woche: sein Gehalt mit Wechselaufschlag mal dem Zuschlag seines
     * Beraters (NegotiationEngine.startTransferNegotiation). Den Berater
     * kennt man erst nach einer Verhandlung - bis dahin die ganze Spanne
     * von genügsam bis gierig, danach die eine Zahl.
     */
    static gehaltsSpanne(player) {
        const basis = (player?.wage || 10000) * 1.18;
        const ne = _transferResolve("NegotiationEngine", "./negotiationEngine.js");
        // Gerundet wie die Forderung in der Verhandlung
        const runde = ne && typeof ne.runde === "function" ? (b) => ne.runde(b) : (b) => Math.round(b / 100) * 100;
        if (player?.agent && typeof player.agent.greed === "number") {
            const forderung = runde(basis * player.agent.greed);
            return { min: forderung, max: forderung, bekannt: true };
        }
        const gier = (ne?.AGENT_PROFILES || []).map(a => a.greed);
        return {
            min: runde(basis * (gier.length ? Math.min(...gier) : 0.9)),
            max: runde(basis * (gier.length ? Math.max(...gier) : 1.3)),
            bekannt: false
        };
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
    /**
     * Den Wechsel vollziehen. optionen.zahlweise ("raten12", "raten24")
     * teilt die Ablöse: Die Anzahlung fließt sofort, der Rest in
     * Monatsraten (FinanceEngine.zahleRaten).
     */
    static executeTransfer(state, playerId, buyerClubId, fee, wage, contractYears, optionen = {}) {
        // Mit dem Verzeichnis des Markttags, sonst über die Liste
        const ausIndex = optionen.index instanceof Map ? optionen.index.get(playerId) : null;
        const player = ausIndex && ausIndex.id === playerId ? ausIndex : state.players.find(p => p.id === playerId);
        const buyerClub = state.clubs.find(c => c.id === buyerClubId);
        if (!player || !buyerClub) return false;
        // Ein verliehener Spieler gehört seinem Stammverein - verkauft wird
        // er erst, wenn er zurück ist
        if (player.leihe) return false;
        // Wer per Vorvertrag woanders unterschrieben hat, wechselt nur dorthin
        if (player.vorvertrag && player.vorvertrag.clubId !== buyerClubId) return false;
        // Nach England nur mit Arbeitserlaubnis - bei einem Vorvertrag wurde
        // sie schon bei der Unterschrift erteilt (optionen.erlaubnis)
        const erlaubnis = _transferResolve("ArbeitserlaubnisEngine", "./arbeitserlaubnisEngine.js");
        if (erlaubnis && optionen.erlaubnis !== true) {
            const pruefung = erlaubnis.pruefe(state, player, buyerClub);
            if (!pruefung.erteilt) return false;
            if (pruefung.weg === "ausnahme") erlaubnis.verbrauche(state, buyerClub);
        }
        const sellerClub = state.clubs.find(c => c.id === player.clubId);

        // Finanzen verbuchen - inklusive Eintrag im Buchungsjournal, damit
        // Kontostand und Journal auch nach Transfers übereinstimmen
        const financeEngine = _getTransferFinanceEngine();
        // Raten gibt es nur, wenn ein Verein die Ablöse bekommt - und nur bei
        // Wechseln, an denen der eigene Verein beteiligt ist
        const eigener = buyerClub.id === state.userClubId || (sellerClub && sellerClub.id === state.userClubId);
        const plan = sellerClub && eigener && optionen.zahlweise && financeEngine && typeof financeEngine.ratenPlan === "function"
            ? financeEngine.ratenPlan(fee, optionen.zahlweise) : null;
        const inRaten = !!(plan && plan.monate);
        const sofort = inRaten ? plan.anzahlung : fee;

        buyerClub.balance -= sofort;
        buyerClub.transferBudget -= sofort;
        if (financeEngine && sofort !== 0) {
            financeEngine.recordTransaction(state, buyerClub.id, "transfer_out", -sofort, `Ablöse für ${player.name}${inRaten ? " (Anzahlung)" : ""}`);
        }

        // Weiterverkaufsbeteiligung: Ein früherer Verein bekommt seinen Anteil
        // an dieser Ablöse - der Verkäufer entsprechend weniger
        let beteiligung = 0;
        const wv = player.weiterverkauf;
        if (wv && fee > 0 && sellerClub && wv.clubId !== sellerClub.id) {
            const frueher = state.clubs.find(c => c.id === wv.clubId);
            if (frueher) {
                beteiligung = Math.round(fee * wv.prozent / 100);
                frueher.balance = (frueher.balance || 0) + beteiligung;
                frueher.transferBudget = (frueher.transferBudget || 0) + Math.round(beteiligung * 0.85);
                if (financeEngine) financeEngine.recordTransaction(state, frueher.id, "transfer_in", beteiligung, `Weiterverkaufsbeteiligung ${player.name}`);
                if (frueher.id === state.userClubId && Array.isArray(state.inbox)) {
                    state.inbox.unshift({
                        id: Date.now() + 7,
                        matchday: state.currentMatchday,
                        date: state.currentDate || `Spieltag ${state.currentMatchday}`,
                        sender: "Transferabteilung",
                        subject: `Weiterverkauf: ${player.name}`,
                        body: `${player.name} wechselt von ${sellerClub.name} zu ${buyerClub.name}. Aus der vereinbarten Beteiligung (${wv.prozent} %) erhalten wir ${_formatTransferMoney(beteiligung)}.`,
                        read: false,
                        type: "transfer"
                    });
                }
            }
        }
        if (fee > 0 && sellerClub) player.weiterverkauf = undefined;

        // Teuerster Kauf und Verkauf in die Vereinschronik
        const chronik = (typeof ChronikEngine !== "undefined" && ChronikEngine)
            ? ChronikEngine
            : (typeof require !== "undefined" ? (() => { try { return require("./chronikEngine.js").ChronikEngine; } catch (e) { return null; } })() : null);
        if (chronik && typeof chronik.transfer === "function") chronik.transfer(state, player, fee, buyerClub.id, sellerClub ? sellerClub.id : null);

        // Geht ein Wortführer aus der eigenen Kabine, merkt die Mannschaft das
        if (sellerClub && sellerClub.id === state.userClubId) {
            const kabine = (typeof DressingRoomEngine !== "undefined" && DressingRoomEngine)
                ? DressingRoomEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./dressingRoomEngine.js").DressingRoomEngine; } catch (e) { return null; } })() : null);
            if (kabine && typeof kabine.spielerGeht === "function") kabine.spielerGeht(state, player);
        }

        if (sellerClub) {
            // Die Beteiligung des früheren Vereins geht von der ersten Zahlung ab
            sellerClub.balance += sofort - beteiligung;
            // Unter Auflagen (InvestorEngine) zählt der Erlös aufs Verkaufsziel und tilgt Schulden
            const investoren = (typeof InvestorEngine !== "undefined" && InvestorEngine)
                ? InvestorEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./investorEngine.js").InvestorEngine; } catch (e) { return null; } })() : null);
            const gesperrt = !!(investoren && typeof investoren.nachVerkauf === "function" && investoren.nachVerkauf(state, sellerClub, fee - beteiligung));
            if (!gesperrt) sellerClub.transferBudget += Math.round((sofort - beteiligung) * 0.85); // 85% reinvestierbar
            if (financeEngine && sofort !== 0) {
                financeEngine.recordTransaction(state, sellerClub.id, "transfer_in", sofort - beteiligung, `Verkauf von ${player.name}${inRaten ? " (Anzahlung)" : ""}`);
            }
            if (inRaten) {
                financeEngine.legeRatenAn(state, { zahlerId: buyerClub.id, empfaengerId: sellerClub.id, player, fee, zahlweise: plan.zahlweise });
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
                // Das Spielerverzeichnis des Markts mitgeben - sonst baut jeder
                // KI-Transfer eins über alle Spieler der Welt neu
                gs.repairLineup(sellerClub, state.players, optionen.index instanceof Map ? optionen.index : null);
            } else {
                sellerClub.lineup = sellerClub.lineup.filter(id => id !== player.id);
            }
        }

        // Was er in dieser Saison beim alten Verein geleistet hat, bleibt dort (LaufbahnEngine)
        const laufbahn = (typeof LaufbahnEngine !== "undefined" && LaufbahnEngine)
            ? LaufbahnEngine
            : (typeof require !== "undefined" ? (() => { try { return require("./laufbahnEngine.js").LaufbahnEngine; } catch (e) { return null; } })() : null);
        if (laufbahn && player.clubId) laufbahn.wechsel(state, player, player.clubId);

        // Spieler aktualisieren
        player.clubId = buyerClub.id;
        player.wage = wage;
        player.contractYears = contractYears;
        player.morale = 95; // Frische Motivation beim Wechsel
        // Ab heute neu in der Kabine
        player.vereinSeit = (state.seasonYear || state.season || 1) * 1000 + (state.currentDayIndex || 0);
        // Die U23 des alten Vereins gilt beim neuen nicht, ebenso wenig sein Jugendvertrag
        player.reserve = undefined;
        player.jugendvertrag = undefined;
        // Seine Rolle folgt dem Rang im neuen Kader. Vorher nahm er sie vom
        // alten Verein mit: Der Schlüsselspieler eines Drittligisten blieb es
        // auch als Ersatzmann beim Spitzenklub.
        const rollenGen = _getTransferPlayerGenerator();
        if (rollenGen && typeof rollenGen.rolleImKader === "function") {
            const kader = optionen.index instanceof Map
                ? (buyerClub.playerIds || []).map(id => optionen.index.get(id)).filter(p => p && p.clubId === buyerClub.id)
                : state.players.filter(p => p.clubId === buyerClub.id);
            player.squadRole = rollenGen.rolleImKader(kader, player);
        }
        player.nominiertAus = undefined;
        player.leihListe = undefined;
        // Die Transferliste galt beim alten Verein
        player.transferListed = false;
        // Beim neuen Verein gibt es eine neue Rückennummer (GameState.rueckennummern)
        player.trikot = undefined;
        player.vereinslosAb = undefined;
        // Die Klauseln (KlauselEngine) gehören zum alten Vertrag
        player.klauseln = undefined;

        // Zum neuen Verein hinzufügen
        buyerClub.playerIds.push(player.id);
        if (buyerClub.bench.length < 7) {
            buyerClub.bench.push(player.id);
        }

        // Ein Neuzugang mit Zugkraft verkauft Trikots
        if (financeEngine && typeof financeEngine.nachTransfer === "function") financeEngine.nachTransfer(state, player, buyerClub);

        // Transfermarkt bereinigen
        if (state.transferMarket && Array.isArray(state.transferMarket.listedPlayerIds)) {
            state.transferMarket.listedPlayerIds = state.transferMarket.listedPlayerIds.filter(id => id !== player.id);
        }
        if (state.transferMarket && Array.isArray(state.transferMarket.ablosefrei)) {
            state.transferMarket.ablosefrei = state.transferMarket.ablosefrei.filter(id => id !== player.id);
        }

        // Für die Wettbewerbsseite: Wechsel je Liga und Saison
        TransferEngine.merkeLigaWechsel(state, player, sellerClub, buyerClub, fee);

        // Nachricht ins Postfach - aber nur, wenn es den eigenen Verein
        // betrifft. Seit die KI-Vereine untereinander handeln, sind das sonst
        // mehrere hundert fremde Transfers je Saison im eigenen Postfach.
        const betrifftUns = buyerClub.id === state.userClubId
            || (sellerClub && sellerClub.id === state.userClubId);
        if (!betrifftUns) return true;

        // Die Kurve meldet sich zu großen Zu- und Abgängen
        const fans = (typeof FanEngine !== "undefined" && FanEngine)
            || (typeof require !== "undefined" ? (() => { try { return require("./fanEngine.js").FanEngine; } catch (e) { return null; } })() : null);
        if (fans && typeof fans.nachTransfer === "function") {
            fans.nachTransfer(state, player, buyerClub.id === state.userClubId ? "zugang" : "abgang", fee);
        }

        state.inbox.unshift({
            id: Date.now(),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday}`,
            sender: "Transferabteilung",
            subject: `Transfer vollzogen: ${player.name}`,
            body: `Der Transfer von ${player.name} zu ${buyerClub.name} wurde für eine Ablösesumme von ${_formatTransferMoney(fee)} erfolgreich abgeschlossen`
                + (inRaten ? ` (${_formatTransferMoney(plan.anzahlung)} sofort, Rest in ${plan.monate} Monatsraten zu je ${_formatTransferMoney(plan.rate)})` : "")
                + `. Der Spieler erhält einen ${contractYears}-Jahresvertrag mit einem Wochengehalt von ${_formatTransferMoney(wage)}.`,
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

    /** Wie viele Transferversuche die KI je Tag der Winterpause macht */
    static WINTER_KI_JE_TAG = 30;

    /**
     * Die Transferfenster nach Kalenderdatum, wie 2025/26: Der Sommer endet
     * in Deutschland und Frankreich am 31. August, in England, Spanien und
     * Italien am 1. September. Im Winter ist überall der Januar offen, bis
     * zum 2. Februar - in Spanien und Italien ab dem 2. Januar. Das Fenster
     * hängt nicht an der Winterpause: Die Premier League spielt über die
     * Feiertage durch, und trotzdem wird im Januar gehandelt.
     */
    static FENSTER = {
        sommerBis: { de: [8, 31], fr: [8, 31], en: [9, 1], es: [9, 1], it: [9, 1] },
        winterVon: { de: [1, 1], fr: [1, 1], en: [1, 1], es: [1, 2], it: [1, 2] },
        winterBis: [2, 2]
    };

    /** Das Kalenderdatum des Spielstands - aus "TT.MM.JJJJ" */
    static heute(state) {
        // Der Kalendertag zählt; currentDate ist nur seine Kopie
        const tag = Array.isArray(state?.calendar) ? state.calendar[state.currentDayIndex || 0] : null;
        const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(tag?.date || state?.currentDate || ""));
        return m ? { tag: Number(m[1]), monat: Number(m[2]), jahr: Number(m[3]) } : null;
    }

    static landVon(state) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        return club?.countryId || "de";
    }

    /**
     * Die Grenzen der Fenster in Spieltagen - nur noch für Spielstände ohne
     * Kalenderdatum
     */
    static fensterGrenzen(state) {
        const gesamt = state?.totalMatchdays || 34;
        const halbserie = Math.round(gesamt / 2);
        return { sommerBis: 2, halbserie, winterVon: halbserie + 1, winterBis: halbserie + 2 };
    }

    /**
     * Welches Fenster gerade offen ist: { art: "sommer" | "winter", bis: [Monat, Tag] }
     * oder null
     */
    static offenesFenster(state) {
        if (state?.preseason?.aktiv) {
            return { art: "sommer", bis: this.FENSTER.sommerBis[this.landVon(state)] || [9, 1] };
        }
        const heute = this.heute(state);
        const tag = Array.isArray(state?.calendar) ? state.calendar[state.currentDayIndex || 0] : null;
        if (!heute || !tag) {
            // Ohne Kalender: wie früher nach Spieltagen
            const md = state?.currentMatchday || 0;
            const g = this.fensterGrenzen(state);
            if (md <= g.sommerBis) return { art: "sommer", bisSpieltag: g.sommerBis };
            return md >= g.winterVon && md <= g.winterBis ? { art: "winter", bisSpieltag: g.winterBis } : null;
        }
        if (tag.sommerpause) return null;
        const land = this.landVon(state);
        const wert = ([m, t]) => m * 100 + t;
        const jetzt = heute.monat * 100 + heute.tag;
        const sommerBis = this.FENSTER.sommerBis[land] || [9, 1];
        if (jetzt >= 701 && jetzt <= wert(sommerBis)) return { art: "sommer", bis: sommerBis };
        const winterVon = this.FENSTER.winterVon[land] || [1, 1];
        if (jetzt >= wert(winterVon) && jetzt <= wert(this.FENSTER.winterBis)) return { art: "winter", bis: this.FENSTER.winterBis };
        return null;
    }

    static _datumText([monat, tag]) {
        return `${String(tag).padStart(2, "0")}.${String(monat).padStart(2, "0")}.`;
    }

    /**
     * Das Transferfenster aus Sicht des Nutzers: offen oder zu, und bis
     * wann bzw. ab wann. Es gilt für alle Vereine gleich - vorher kaufte die
     * KI nur in den Fenstern, der Nutzer aber jederzeit.
     */
    static fensterInfo(state) {
        const f = this.offenesFenster(state);
        const name = art => art === "winter" ? "Wintertransferfenster" : "Sommertransferfenster";
        if (f) {
            const bis = f.bis ? `bis ${this._datumText(f.bis)}` : `bis nach dem ${f.bisSpieltag}. Spieltag`;
            return { offen: true, art: f.art, bis: f.bis || null, bisSpieltag: f.bisSpieltag || null, text: `${name(f.art)} offen ${bis}` };
        }
        const heute = this.heute(state);
        const tag = Array.isArray(state?.calendar) ? state.calendar[state.currentDayIndex || 0] : null;
        let oeffnet;
        if (heute && tag && !tag.sommerpause && heute.monat >= 7) {
            oeffnet = `am ${this._datumText(this.FENSTER.winterVon[this.landVon(state)] || [1, 1])}`;
        } else if (!heute || !tag) {
            const g = this.fensterGrenzen(state);
            oeffnet = (state?.currentMatchday || 0) < g.winterVon ? `in der Winterpause (nach dem ${g.halbserie}. Spieltag)` : "mit der Vorbereitung auf die neue Saison";
        } else {
            oeffnet = "mit der Vorbereitung auf die neue Saison";
        }
        return { offen: false, oeffnet, text: `Transferfenster geschlossen - es öffnet ${oeffnet}${oeffnet.endsWith(".") ? "" : "."} Vereinslose Spieler lassen sich jederzeit verpflichten.` };
    }

    /** Warum gerade kein Transfer geht - oder null */
    static fensterHindernis(state, { vereinslos = false } = {}) {
        if (vereinslos) return null;
        const info = this.fensterInfo(state);
        return info.offen ? null : info.text;
    }

    /** Laeuft gerade ein Transferfenster? */
    static istTransferfenster(state) {
        return !!this.offenesFenster(state);
    }

    /**
     * Ist heute der letzte Tag des Fensters? Nach Datum - ohne Kalender am
     * letzten Spieltag des Fensters. heute ist der Kalendertag, sonst der,
     * auf dem der Manager steht.
     */
    static istDeadlineDay(state, heute = null) {
        const info = this.fensterInfo(state);
        if (!info.offen) return false;
        if (info.bis) {
            const datum = this.heute(state);
            return !!(datum && datum.monat === info.bis[0] && datum.tag === info.bis[1]);
        }
        const tag = heute || (Array.isArray(state?.calendar) ? state.calendar[state.currentDayIndex || 0] : null);
        return !!(tag && tag.type === "matchday" && tag.matchday === info.bisSpieltag);
    }

    /**
     * Wie viele Transferversuche die KI an einem Spieltag im Fenster macht.
     * Das Winterfenster dauert jetzt einen Monat statt zwei Spieltagen - je
     * Spieltag wird dort deshalb weniger versucht.
     */
    static kiVersucheJeSpieltag(state) {
        const f = this.offenesFenster(state);
        return f && f.art === "winter" ? 200 : 400;
    }

    /**
     * Öffnet oder schließt sich ein Fenster, steht es im Postfach - und am
     * letzten Tag kommt eine Erinnerung. Vorher öffnete und schloss das
     * Fenster still; wer nicht in den Transfermarkt sah, verpasste es.
     * heute ist der Kalendertag, auf dem der Manager jetzt steht. Gibt die
     * Zeilen für den Tagesbericht zurück.
     */
    static pruefeFensterwechsel(state, heute = null) {
        if (!state) return [];
        const info = this.fensterInfo(state);
        const merk = state.transferFenster || (state.transferFenster = {});
        const meldungen = [];
        const post = (betreff, text) => {
            if (!Array.isArray(state.inbox)) state.inbox = [];
            state.inbox.unshift({
                id: Date.now() + Math.floor(Math.random() * 100000),
                matchday: state.currentMatchday,
                date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
                sender: "Transferabteilung",
                subject: betreff,
                body: text,
                read: false,
                type: "transfer_window"
            });
            meldungen.push(`${betreff}.`);
        };

        if (typeof merk.offen !== "boolean") {
            merk.offen = info.offen;
        } else if (merk.offen !== info.offen) {
            merk.offen = info.offen;
            if (info.offen) {
                post(`🟢 ${info.art === "winter" ? "Wintertransferfenster" : "Sommertransferfenster"} geöffnet`,
                    `${info.bis ? `Bis zum ${this._datumText(info.bis)}` : `Bis nach dem ${info.bisSpieltag}. Spieltag`} lassen sich Spieler kaufen, verkaufen und verleihen. `
                    + `Auch die anderen Vereine sind jetzt auf dem Markt - mit Angeboten für unsere Spieler ist zu rechnen.`);
            } else {
                post("🔒 Transferfenster geschlossen",
                    `Ab jetzt wechseln nur noch vereinslose Spieler. Das nächste Fenster öffnet ${info.oeffnet}.`);
                // Was bis zum Schluss nicht unterschrieben war, platzt jetzt
                const verhandlung = _transferResolve("NegotiationEngine", "./negotiationEngine.js");
                const geplatzt = verhandlung && typeof verhandlung.pruefeFenster === "function" ? verhandlung.pruefeFenster(state) : [];
                if (geplatzt.length) meldungen.push(`${geplatzt.length === 1 ? `Die Verhandlung um ${geplatzt[0].negotiation.playerName} ist` : `${geplatzt.length} Verhandlungen sind`} mit dem Fenster geplatzt.`);
            }
        }

        // Der letzte Tag des Fensters
        if (this.istDeadlineDay(state, heute)) {
            const schluessel = `${state.seasonYear || 1}-${info.art}`;
            if (merk.deadline !== schluessel) {
                merk.deadline = schluessel;
                post("⏰ Deadline Day: das Transferfenster schließt",
                    `Heute ist der letzte Tag des ${info.art === "winter" ? "Winter" : "Sommer"}transferfensters - ${info.bis ? "heute Abend" : `nach dem ${info.bisSpieltag}. Spieltag`} ist Schluss. `
                    + `Vereine und Berater antworten heute sofort, auch der Medizincheck geht noch am selben Tag. `
                    + `Was bis heute Abend nicht unterschrieben ist, platzt; vereinslose Spieler bleiben danach zu haben.`);
            }
        }
        return meldungen;
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
        // Die Stärksten zuerst: Die Suche nach Verstärkungen bricht ab, sobald
        // niemand mehr besser ist als das, was ein Verein schon hat
        nachPosition.forEach(liste => liste.sort((a, b) => (b.overall || 0) - (a.overall || 0)));

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

        const niveau = kader.reduce((a, p) => a + (p.overall || 50), 0) / kader.length;

        // 1. Echte Luecken zuerst. Gesucht wird ab zehn Punkten unter dem
        // eigenen Niveau - vorher lag die Messlatte bei null: Die Suche lief
        // über alle Spieler der Position, und der Verein nahm den stärksten,
        // den er bezahlen konnte, auch weit über seiner Liga.
        const luecken = Object.keys(bedarfZahl)
            .filter(pos => (bestand[pos] || []).length < bedarfZahl[pos]);
        if (luecken.length > 0 && kader.length < soll + 3) {
            return { pos: _preZufall(luecken), art: "luecke", messlatte: Math.max(0, niveau - 10), niveau };
        }

        // 2. Sonst die schwaechste Position gemessen am eigenen Niveau
        let schwaechste = null;
        Object.keys(bedarfZahl).forEach(pos => {
            const beste = (bestand[pos] || []).map(p => p.overall || 0).sort((a, b) => b - a)[0] || 0;
            if (!schwaechste || beste < schwaechste.beste) schwaechste = { pos, beste };
        });
        if (!schwaechste) return null;
        // Nur wenn die Position wirklich hinterherhinkt
        if (schwaechste.beste >= niveau + 4) return null;
        return { pos: schwaechste.pos, art: "verstaerkung", messlatte: schwaechste.beste, niveau };
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
        vollzogen += this.talentsuche(state, markt, Math.max(1, Math.round(versuche * this.TALENT_ANTEIL)));
        return vollzogen;
    }

    /** Anteil der Versuche eines Fenstertags, in denen ein Verein ein Talent sucht */
    static TALENT_ANTEIL = 0.05;
    static TALENT_ALTER = 21;

    /**
     * Talentsuche: Vereine holen junge Spieler aus tieferen Ligen, die das
     * Zeug für ihre Mannschaft haben.
     *
     * Ohne diesen Weg waren die unteren Ligen fast geschlossen: Wer sich dort
     * entwickelte, blieb. Gemessen sank der Schnitt der Kader im Unterbau
     * jede Saison, die beste Elf aber stieg - die Talente verdrängten die
     * Älteren, und kein Verein eine Liga höher holte sie. Die sechste Liga
     * legte so 0,2 bis 0,3 Punkte je Saison zu.
     *
     * Gesucht wird, wer höchstens 21 ist, in einer tieferen Liga spielt, bald
     * mithalten kann (höchstens zwölf Punkte unter dem Kaderniveau) und das
     * Potenzial dafür hat. Ab der dritten Liga nur im eigenen Land.
     */
    static talentsuche(state, markt, versuche) {
        const kaeufer = state.clubs.filter(c => c.id !== state.userClubId && (c.level || 1) <= 5 && (c.transferBudget || 0) > 0);
        if (!kaeufer.length || versuche <= 0) return 0;
        const talente = state.players.filter(p => p.clubId && p.clubId !== state.userClubId && !p.leihe && !p.vorvertrag
            && (p.age || 30) <= this.TALENT_ALTER && (p.injuredWeeks || 0) <= 0)
            .sort((a, b) => (b.pot || 0) - (a.pot || 0));
        let vollzogen = 0;
        const erlaubnis = _transferResolve("ArbeitserlaubnisEngine", "./arbeitserlaubnisEngine.js");
        for (let i = 0; i < versuche; i++) {
            const club = _preZufall(kaeufer);
            if (!club) continue;
            const mitErlaubnis = erlaubnis && erlaubnis.gilt(club) ? erlaubnis : null;
            const niveau = this.kaderNiveau(state, club);
            const budget = club.transferBudget || 0;
            const lohnsumme = (club.playerIds || []).reduce((s, id) => s + (markt.spieler.get(id)?.wage || 0), 0);
            const p = talente.find(t => {
                if (t.clubId === club.id || (t.pot || 0) < niveau - 2) return false;
                if ((t.overall || 0) < niveau - 12) return false;
                const verkaeufer = markt.vereine.get(t.clubId);
                if (!verkaeufer || (verkaeufer.level || 1) <= (club.level || 1)) return false;
                if ((club.level || 1) >= 3 && verkaeufer.countryId !== club.countryId) return false;
                const gleichePos = (markt.kaderNachPos.get(verkaeufer.id) || {})[t.pos] || [];
                if (gleichePos.length - 1 < (t.pos === "TW" ? 2 : 1)) return false;
                if (this.calculateAskingPrice(t, verkaeufer) > budget) return false;
                if (lohnsumme + (t.wage || 0) * 1.2 > (club.wageBudget || Infinity) * 1.15) return false;
                return !mitErlaubnis || mitErlaubnis.erlaubt(state, t, club);
            });
            if (!p) continue;
            const verkaeufer = markt.vereine.get(p.clubId);
            const preis = this.calculateAskingPrice(p, verkaeufer);
            const vonId = p.clubId;
            if (!this.executeTransfer(state, p.id, club.id, preis, Math.round((p.wage || 1000) * 1.2), 4, { index: markt.spieler })) continue;
            this.aktualisiereIndex(markt, p, vonId, club.id);
            talente.splice(talente.indexOf(p), 1);
            vollzogen++;
        }
        return vollzogen;
    }

    /** Ab so viel über dem Kaderniveau des Käufers geht ein junger Spieler nicht zwei Ligen hinunter */
    static ABSTIEG_ZU_GUT = 6;

    /** Ein einzelner Transferversuch eines Vereins */
    static versucheEinenTransfer(state, club, markt = null) {
        if (!markt) markt = this.baueMarktIndex(state);

        const bedarf = this.kaderBedarf(state, club, markt);
        if (!bedarf) return false;

        const eigenerRuf = club.reputation || 60;
        const nachrichten = (typeof LigaNachrichtenEngine !== "undefined" && LigaNachrichtenEngine) ? LigaNachrichtenEngine
            : (typeof require !== "undefined" ? (() => { try { return require("./ligaNachrichtenEngine.js").LigaNachrichtenEngine; } catch (e) { return null; } })() : null);

        // Wen ein Verein überhaupt in Betracht zieht: die gesuchte Position,
        // besser als das, was er hat, und kein Spieler des Nutzers - dessen
        // Kader rührt die KI nur über ein Angebot an, das er annehmen kann.
        const kandidaten = [];
        // Gewählt wird unter den fünf reizvollsten. Der Reiz ist der Gewinn an
        // Stärke plus höchstens neun Punkte Zuschlag (jung, Vertragsende) -
        // wer selbst damit nicht mehr unter die besten fünf käme, beendet die
        // Suche. Nur der Wunschspieler aus der Gerüchteküche hat mehr Zuschlag;
        // ihn prüft der Verein in dem Fall noch eigens. Vorher lief die Suche
        // für einen Unterhausverein durch fast alle Spieler der Position, und
        // mit den Etats nach einigen Saisons wurden die Fenstertage um die
        // Hälfte langsamer.
        const ZUSCHLAG_MAX = 9;
        const wunschId = nachrichten && club.geruecht ? String(club.geruecht.playerId) : null;
        // La Liga: Wer schon drei Spieler ohne EU-Pass hat, holt keinen
        // weiteren - er dürfte ihn nicht melden
        const regeln = (typeof KaderregelEngine !== "undefined" && KaderregelEngine) ? KaderregelEngine
            : (typeof require !== "undefined" ? (() => { try { return require("./kaderregelEngine.js").KaderregelEngine; } catch (e) { return null; } })() : null);
        const ligaRegel = regeln ? regeln.regel(club, "liga") : null;
        const passVoll = !!(ligaRegel && ligaRegel.maxNichtEU != null
            && regeln._kader(state, club).filter(x => !regeln.eu(state, x, club)).length >= ligaRegel.maxNichtEU);
        // England: nur, wer eine Arbeitserlaubnis bekäme
        const erlaubnis = _transferResolve("ArbeitserlaubnisEngine", "./arbeitserlaubnisEngine.js");
        const mitErlaubnis = erlaubnis && erlaubnis.gilt(club) ? erlaubnis : null;
        const alsNeuzugang = { vereinSeit: (state.seasonYear || 1) * 1000 };
        const besteReize = [];
        const pruefe = (p) => {
            if (p.clubId === club.id) return null;
            if (p.clubId === state.userClubId) return null;
            if (p.leihe) return null;
            if ((p.injuredWeeks || 0) > 0) return null;
            if (passVoll && !regeln.eu(state, Object.assign({ nationality: p.nationality }, alsNeuzugang), club)) return null;
            // Billige Vorprüfung: Unter 63,75 % des Marktwerts (Vertragsende,
            // Transferliste) geht kein Verein herunter - wer selbst dann zu
            // teuer ist, braucht keine weitere Prüfung
            const budget = club.transferBudget || 0;
            if (p.clubId && (p.value || 0) * 0.6375 > budget) return null;

            const verkaeufer = p.clubId ? markt.vereine.get(p.clubId) : null;
            // Ein Spieler wechselt nicht in eine deutlich kleinere Nummer
            if (verkaeufer && (verkaeufer.reputation || 60) > eigenerRuf + 12) return null;
            // Und kein junger Spieler geht zwei Ligen hinunter, wenn er für die
            // Elf des Käufers klar zu gut ist. Gemessen trugen genau diese
            // Wechsel dazu bei, dass die unteren Ligen Saison für Saison
            // stärker wurden.
            if (verkaeufer && (club.level || 1) - (verkaeufer.level || 1) >= 2 && (p.age || 25) < 30
                && (p.overall || 0) > (bedarf.niveau ?? bedarf.messlatte) + this.ABSTIEG_ZU_GUT) return null;

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
                if (gleichePos.length - 1 < mindestNachher) return null;

                istBester = !gleichePos.some(x => x.id !== p.id && (x.overall || 0) >= (p.overall || 0));
            }

            const preis = this.calculateAskingPrice(p, verkaeufer);
            if (preis > budget) return null;
            if (mitErlaubnis && !mitErlaubnis.erlaubt(state, p, club)) return null;

            // Wie sehr will dieser Verein genau diesen Spieler? Ein
            // Wunschspieler aus der Gerüchteküche reizt mehr
            const gewinn = (p.overall || 0) - bedarf.messlatte;
            const jung = (p.age || 25) <= 24 ? 4 : 0;
            const ablauf = (p.contractYears ?? 3) <= 1 ? 5 : 0;
            const wunsch = nachrichten && typeof nachrichten.reiz === "function" ? nachrichten.reiz(club, p) : 0;
            return { p, verkaeufer, preis, istBester, reiz: gewinn + jung + ablauf + wunsch };
        };
        const aufnehmen = (k) => {
            if (!k) return;
            kandidaten.push(k);
            besteReize.push(k.reiz);
            besteReize.sort((a, b) => b - a);
            if (besteReize.length > 5) besteReize.length = 5;
        };
        const liste = markt.nachPosition.get(bedarf.pos) || [];
        let wunschGeprueft = false;
        for (let i = 0; i < liste.length; i++) {
            const p = liste[i];
            // Die Liste ist nach Stärke sortiert - ab hier ist keiner mehr besser
            if ((p.overall || 0) <= bedarf.messlatte) break;
            if (besteReize.length >= 5 && (p.overall || 0) - bedarf.messlatte + ZUSCHLAG_MAX < besteReize[4]) {
                if (wunschId && !wunschGeprueft) {
                    const w = liste.slice(i).find(x => String(x.id) === wunschId && (x.overall || 0) > bedarf.messlatte);
                    if (w) aufnehmen(pruefe(w));
                }
                break;
            }
            if (wunschId && String(p.id) === wunschId) wunschGeprueft = true;
            aufnehmen(pruefe(p));
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
        const ok = this.executeTransfer(state, p.id, club.id, verkaeufer ? gebot : 0, lohn, laufzeit, { index: markt.spieler });
        if (!ok) return false;

        this.aktualisiereIndex(markt, p, vonId, club.id);
        // Für die Rundschau der eigenen Liga - und ob ein Gerücht stimmte
        if (nachrichten && typeof nachrichten.transfer === "function") {
            nachrichten.transfer(state, { player: p, vonId, zuId: club.id, fee: verkaeufer ? gebot : 0 });
        }

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
        const gs = _getTransferGameState();
        const finde = gs && typeof gs.spielerMitId === "function"
            ? (id) => gs.spielerMitId(state.players, id)
            : (id) => state.players.find(p => p.id === id);
        const kader = (club.playerIds || []).map(finde).filter(Boolean);
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
    /**
     * Ein Angebot annehmen. Mit weiterverkauf (Prozent) behält der Verein
     * einen Anteil an einem späteren Weiterverkauf - dafür zahlt der Käufer
     * jetzt die Hälfte dieses Prozentsatzes weniger.
     */
    static nimmAngebotAn(state, offerId, { weiterverkauf = 0 } = {}) {
        const offer = (state?.transferMarket?.offers || []).find(o => String(o.id) === String(offerId));
        if (!offer || offer.status !== "pending") return { ok: false, grund: "Das Angebot liegt nicht mehr vor." };
        const fenster = this.fensterHindernis(state);
        if (fenster) return { ok: false, grund: fenster };
        const buyerId = offer.fromClubId || offer.buyerClubId;
        const prozent = [0, 10, 20].includes(Number(weiterverkauf)) ? Number(weiterverkauf) : 0;
        if (prozent) offer.fee = Math.round(offer.fee * (1 - prozent / 200));
        const player = state.players.find(p => p.id === offer.playerId);
        const verkaeuferId = player?.clubId;
        // Beim neuen Verein verdient er etwas mehr als bisher - wie bei jedem
        // anderen Wechsel unter KI-Vereinen. Vorher bekam jeder pauschal
        // 50.000 € pro Woche, der Drittligaspieler wie der Nationalspieler.
        const lohn = offer.wage || Math.round((player?.wage || 10000) * 1.2);
        const laufzeit = (player?.age || 25) <= 24 ? 4 : (player?.age || 25) <= 30 ? 3 : 2;
        const ok = this.executeTransfer(state, offer.playerId, buyerId, offer.fee, lohn, laufzeit, { zahlweise: offer.zahlweise });
        if (ok === false) return { ok: false, grund: "Der Wechsel ist gescheitert." };
        if (prozent && player) player.weiterverkauf = { clubId: verkaeuferId, prozent };
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
        const vorher = offer.fee;
        offer.nachgebessert = true;
        let ergebnis;
        if (betrag <= grenze) {
            offer.fee = betrag;
            ergebnis = { status: "angenommen", offer, text: `${offer.fromClubName} geht auf ${_formatTransferMoney(betrag)} mit.` };
        } else if (betrag > grenze * 1.3) {
            offer.status = "withdrawn";
            ergebnis = { status: "zurueckgezogen", offer, text: `${offer.fromClubName} zieht das Angebot zurück - die Forderung ist ihnen zu hoch.` };
        } else {
            offer.fee = grenze;
            ergebnis = { status: "nachgebessert", offer, text: `${offer.fromClubName} bessert auf ${_formatTransferMoney(grenze)} nach - mehr ist nicht drin.` };
        }
        this.postZurForderung(state, offer, vorher, betrag, ergebnis);
        return ergebnis;
    }

    /**
     * Die Antwort auf die eigene Gegenforderung kommt auch per Post - mit
     * Angebot vorher, Forderung und Stand. Vorher stand sie nur als Hinweis
     * auf dem Bildschirm und war danach nirgends nachzulesen.
     */
    static postZurForderung(state, offer, vorher, forderung, ergebnis) {
        const news = _transferResolve("NewsEngine", "./newsEngine.js");
        if (!news || typeof news.addMessage !== "function") return;
        const stand = ergebnis.status === "zurueckgezogen" ? "Das Angebot ist vom Tisch."
            : `Es liegt jetzt bei ${_formatTransferMoney(offer.fee)}${typeof offer.frist === "number" ? ` und gilt noch ${Math.max(0, offer.frist - (state.currentDayIndex || 0))} Tage` : ""}. Weiter nachbessern wird ${offer.fromClubName} nicht.`;
        const betreff = { angenommen: "Forderung akzeptiert", nachgebessert: "Nachgebessert", zurueckgezogen: "Angebot zurückgezogen" }[ergebnis.status];
        news.addMessage(state, "transfer", {
            title: `${betreff}: ${offer.playerName}`,
            sender: offer.fromClubName || "Transfermarkt",
            text: `${ergebnis.text}

Angebot vorher: ${_formatTransferMoney(vorher)} · unsere Forderung: ${_formatTransferMoney(forderung)}
${stand}`,
            priority: ergebnis.status === "zurueckgezogen" ? "high" : "normal",
            relatedEntity: offer.playerId !== undefined ? { type: "player", id: offer.playerId } : null
        });
    }

    /**
     * Abgelaufene Angebote verfallen. Wer nicht antwortet, hat abgelehnt -
     * der interessierte Verein meldet sich dann ab.
     */
    static pruefeAngebotsfristen(state) {
        const tag = state?.currentDayIndex || 0;
        const verfallen = [];
        (state?.transferMarket?.offers || []).forEach(o => {
            if (o.status !== "pending") return;
            // Angebote aus älteren Spielständen kamen ohne Frist - sie
            // bekommen ab heute die übliche
            if (typeof o.frist !== "number") {
                o.frist = tag + this.ANGEBOTS_FRIST;
                o.saison = state.seasonYear || 1;
                if (!o.fromClubId && o.buyerClubId) { o.fromClubId = o.buyerClubId; o.fromClubName = o.buyerClubName; }
                return;
            }
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
                    type: "transfer_offer",
                    offerId: o.id,
                    relatedEntity: o.playerId !== undefined ? { type: "player", id: o.playerId } : null
                });
            }
        });
        return verfallen;
    }

    // --------------------------------------------------- Vertragsklauseln

    /**
     * Die Ausstiegsklausel eines Spielers - oder null.
     *
     * Was im Vertrag steht (player.ausstiegsklausel; 0 heißt: keine), gilt.
     * Für Spieler fremder Vereine, deren Verträge nie verhandelt wurden,
     * ergibt sich die Klausel fest aus ihrer ID: gut jeder Fünfte hat eine,
     * zwischen dem 1,8- und 3,3-fachen Marktwert.
     */
    static ausstiegsklausel(state, player) {
        if (!player) return null;
        if (typeof player.ausstiegsklausel === "number") return player.ausstiegsklausel > 0 ? player.ausstiegsklausel : null;
        if (!player.clubId || player.clubId === state?.userClubId) return null;
        let h = 2166136261;
        String(player.id).split("").forEach(ch => { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; });
        h = (h ^ (h >>> 13)) >>> 0;
        if (h % 100 >= 22) return null;
        const faktor = 1.8 + ((h >>> 8) % 7) * 0.25;
        return Math.max(100000, Math.round((player.value || 0) * faktor / 100000) * 100000);
    }

    /**
     * Die Ausstiegsklausel eines fremden Spielers ziehen: Sein Verein kann
     * nicht ablehnen - der Spieler aber schon, wenn der Schritt für ihn zu
     * klein ist.
     */
    static zieheAusstiegsklausel(state, playerId) {
        const player = state.players.find(p => String(p.id) === String(playerId));
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!player || !userClub) return { success: false, error: "Unbekannter Spieler." };
        if (player.clubId === userClub.id) return { success: false, error: "Er spielt schon für Sie." };
        if (player.leihe) return { success: false, error: "Er ist gerade verliehen." };
        const klausel = this.ausstiegsklausel(state, player);
        if (!klausel) return { success: false, error: "Sein Vertrag hat keine Ausstiegsklausel." };
        const fenster = this.fensterHindernis(state);
        if (fenster) return { success: false, error: fenster };
        const erlaubnis = this.erlaubnisHindernis(state, player, userClub);
        if (erlaubnis) return { success: false, error: erlaubnis };
        if ((userClub.balance || 0) < klausel) return { success: false, error: "Für die Klausel reicht das Geld nicht." };
        const verein = state.clubs.find(c => c.id === player.clubId);
        if (verein && (verein.reputation || 60) > (userClub.reputation || 60) + 15) {
            return { success: false, error: `${player.name} will nicht zu Ihnen - der Schritt ist ihm zu klein.` };
        }
        const lohn = Math.round((player.wage || 10000) * 1.15);
        const laufzeit = (player.age || 25) <= 26 ? 4 : 3;
        const ok = this.executeTransfer(state, player.id, userClub.id, klausel, lohn, laufzeit);
        if (!ok) return { success: false, error: "Der Wechsel ist gescheitert." };
        // Der neue Vertrag hat keine Klausel mehr
        player.ausstiegsklausel = 0;
        return { success: true, klausel, lohn, laufzeit };
    }

    /**
     * KI-Vereine ziehen die Klausel eines Spielers des Nutzers: Der Nutzer
     * kann nicht ablehnen. Gezogen wird, wenn ein Verein es sich leisten
     * kann, kein deutlich kleinerer ist und der Spieler ihn verstärkt.
     */
    static pruefeAusstiegsklauseln(state, zufall = Math.random) {
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub || !this.istTransferfenster(state)) return [];
        const gezogen = [];
        const kader = state.players.filter(p => p.clubId === userClub.id && !p.leihe && (p.ausstiegsklausel || 0) > 0);
        kader.forEach(player => {
            if (zufall() >= 0.08) return;
            const klausel = player.ausstiegsklausel;
            const kaeufer = state.clubs.filter(c => c.id !== userClub.id
                && (c.transferBudget || 0) >= klausel
                && (c.reputation || 60) >= (userClub.reputation || 60) - 5
                && (player.overall || 0) >= this.kaderNiveau(state, c) + 2);
            if (!kaeufer.length) return;
            const kaeuferClub = kaeufer[Math.floor(zufall() * kaeufer.length)];
            const lohn = Math.round((player.wage || 10000) * 1.25);
            if (!this.executeTransfer(state, player.id, kaeuferClub.id, klausel, lohn, 4)) return;
            player.ausstiegsklausel = 0;
            gezogen.push({ player, club: kaeuferClub, klausel });
            state.inbox.unshift({
                id: Date.now() + Math.floor(zufall() * 1000),
                matchday: state.currentMatchday,
                date: state.currentDate || `Spieltag ${state.currentMatchday}`,
                sender: kaeuferClub.name,
                subject: `Ausstiegsklausel gezogen: ${player.name}`,
                body: `${kaeuferClub.name} hat die Ausstiegsklausel von ${player.name} gezogen und ${_formatTransferMoney(klausel)} überwiesen. Der Wechsel ist vollzogen - ablehnen ließ er sich nicht.`,
                read: false,
                type: "transfer"
            });
        });
        return gezogen;
    }

    /** Die so vielen Besten eines Kaders wecken Interesse anderer Vereine */
    static BEGEHRT_AB_RANG = 6;

    /**
     * Erzeugt gelegentliche Angebote von KI-Vereinen für Spieler des Spielers
     */
    static processAITransferMarket(state) {
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        // Wer eine Ausstiegsklausel hat, kann einfach gekauft werden
        this.pruefeAusstiegsklauseln(state);
        // Ebenso eine Mindestablöse - für höherklassige Vereine
        const klauselEngine = (typeof KlauselEngine !== "undefined" && KlauselEngine)
            ? KlauselEngine
            : (typeof require !== "undefined" ? (() => { try { return require("./klauselEngine.js").KlauselEngine; } catch (e) { return null; } })() : null);
        if (klauselEngine && typeof klauselEngine.mindestAbloeseTag === "function") klauselEngine.mindestAbloeseTag(state);

        // Angebote gibt es nur, solange das Transferfenster offen ist
        if (!this.istTransferfenster(state)) return;

        // Wer auf der Transferliste steht oder wechseln will, spricht sich
        // herum: Für ihn kommen öfter Angebote - und etwas niedrigere, weil
        // jeder weiß, dass er weg will.
        const gelistet = userClub.playerIds
            .map(id => state.players.find(p => p.id === id))
            .filter(p => p && (p.transferListed || p.wechselwunsch) && !p.leihe);
        const chance = gelistet.length ? 0.45 : 0.25;

        // 25 % Chance je Spieltag im Fenster auf ein KI-Angebot für einen Spieler des Managers
        if (Math.random() < chance && userClub.playerIds.length > 15) {
            const randomPlayerId = userClub.playerIds[Math.floor(Math.random() * userClub.playerIds.length)];
            const player = gelistet.length && Math.random() < 0.65
                ? gelistet[Math.floor(Math.random() * gelistet.length)]
                : state.players.find(p => p.id === randomPlayerId);
            const verkaeuflich = player && gelistet.includes(player);

            // Begehrt ist, wer zu den Besten seines Kaders gehört. Vorher galt
            // eine feste Stärke von 74 - ein Verein aus der dritten Liga bekam
            // so nie ein Angebot, auch nicht für seinen besten Mann.
            const kader = userClub.playerIds.map(id => state.players.find(p => p.id === id)).filter(p => p && !p.leihe)
                .sort((x, y) => (y.overall || 0) - (x.overall || 0));
            const begehrt = player && (kader.indexOf(player) > -1 && kader.indexOf(player) < this.BEGEHRT_AB_RANG);

            if (player && !player.leihe && (player.overall >= 74 || begehrt || verkaeuflich)) {
                // Für einen Spieler auf der Transferliste bieten Vereine, bei
                // denen er spielen würde (abnehmer). Vorher bot jeder ab dem
                // eigenen Ruf minus 15: der Spitzenklub für den Ersatzmann
                // eines Viertligisten, nie aber ein Verein eine Liga tiefer.
                const frei = verkaeuflich && this.istAblosefrei(state, player);
                const passend = verkaeuflich ? this.abnehmer(state, player, { ablosefrei: frei }) : [];
                const treffer = passend.length ? passend[Math.floor(Math.random() * passend.length)] : null;
                let interestedClub = treffer ? treffer.club : null;
                if (!interestedClub) {
                    // Wer bietet, ist mindestens ein ähnlich großer Verein - für einen
                    // Spieler auf der Transferliste auch ein etwas kleinerer
                    const rufGrenze = (userClub.reputation || 50) - (verkaeuflich ? 15 : 5);
                    // Nach England bietet nur, wer die Arbeitserlaubnis bekäme - sonst
                    // nähme der Manager an und der Wechsel scheiterte erst danach
                    const aiClubs = state.clubs.filter(c => c.id !== userClub.id && c.transferBudget >= player.value * 0.9
                        && (c.reputation || 50) >= rufGrenze && !this.erlaubnisHindernis(state, player, c));
                    interestedClub = aiClubs.length ? aiClubs[Math.floor(Math.random() * aiClubs.length)] : null;
                }
                if (interestedClub) this.legeAngebotVor(state, player, interestedClub, { verkaeuflich, ablosefrei: frei, lohn: treffer?.lohn });
            }
        }
    }

    /**
     * Ein Angebot eines KI-Vereins für einen Spieler des Managers anlegen,
     * mit Post samt Frist und Knöpfen. verkaeuflich: Er steht zum Verkauf,
     * das Angebot fällt etwas niedriger aus. ablosefrei: Der Verein bietet
     * keine Ablöse, würde auf Nachfrage aber eine kleine zahlen. lohn: was
     * er dort verdienen würde (sonst 20 % mehr als bisher).
     */
    static legeAngebotVor(state, player, interestedClub, { verkaeuflich = false, ablosefrei = false, lohn = null } = {}) {
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub || !player || !interestedClub) return null;
        // Ein kleiner Verein bietet für einen Spieler auf der Liste, was er hat
        const roh = Math.round(player.value * (verkaeuflich ? 0.8 + Math.random() * 0.25 : 0.95 + Math.random() * 0.3));
        const offerFee = ablosefrei ? 0 : (verkaeuflich ? Math.min(roh, Math.max(0, Math.round(interestedClub.transferBudget || 0))) : roh);
        // Wie weit der Verein höchstens gehen würde - verrät er nicht. Wer
        // ablösefrei übernimmt, legt auf Nachfrage höchstens ein Viertel
        // des Marktwerts hin.
        const maxFee = ablosefrei
            ? Math.max(0, Math.min(interestedClub.transferBudget || 0, Math.round(player.value * (0.1 + Math.random() * 0.15))))
            : Math.min(interestedClub.transferBudget || offerFee, Math.round(offerFee * (1.06 + Math.random() * 0.24)));
        // Wer das Geld nicht auf dem Konto hat, bietet Raten an -
        // und manchmal auch, wer es einfach strecken will
        const fin = _getTransferFinanceEngine();
        const knapp = (interestedClub.balance || 0) < offerFee * 1.5;
        const zahlweise = !ablosefrei && fin && fin.ZAHLWEISEN && Math.random() < (knapp ? 0.6 : 0.2)
            ? (Math.random() < 0.65 ? "raten12" : "raten24") : "sofort";
        // Für das Warten legt er etwas drauf
        const aufschlag = zahlweise === "raten24" ? 1.08 : (zahlweise === "raten12" ? 1.04 : 1);
        const angebot = Math.round(offerFee * aufschlag);
        const zahlText = zahlweise !== "sofort" ? ` (${fin.ratenText(angebot, zahlweise)})` : "";

        const tag = state.currentDayIndex || 0;
        // Eindeutig, auch wenn im selben Durchlauf mehrere Angebote
        // kommen - mit der Millisekunde allein trugen zwei dieselbe
        // Kennung, und Annehmen traf womöglich das andere
        let offerId = Date.now() * 1000;
        while (state.transferMarket.offers.some(o => o.id === offerId)) offerId++;
        const offer = {
            id: offerId,
            playerId: player.id,
            playerName: player.name,
            playerOverall: player.overall,
            playerPos: player.pos,
            playerAge: player.age,
            playerValue: player.value,
            fromClubId: interestedClub.id,
            fromClubName: interestedClub.name,
            toClubId: userClub.id,
            fee: angebot,
            maxFee: Math.max(angebot, Math.round(maxFee * aufschlag)),
            ...(zahlweise !== "sofort" ? { zahlweise } : {}),
            ...(lohn > 0 ? { wage: lohn } : {}),
            ...(ablosefrei ? { ablosefrei: true } : {}),
            eingang: tag,
            frist: tag + this.ANGEBOTS_FRIST,
            saison: state.seasonYear || 1,
            gemeldet: false,
            status: "pending"
        };
        state.transferMarket.offers.unshift(offer);

        const lohnText = lohn > 0 ? ` Er würde dort ${_formatTransferMoney(lohn)} pro Woche verdienen.` : "";
        state.inbox.unshift({
            id: `angebot_${offerId}`,
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday}`,
            sender: interestedClub.name,
            subject: ablosefrei
                ? `🤝 Angebot: ${interestedClub.name} übernimmt ${player.name} ablösefrei`
                : `💰 Angebot: ${_formatTransferMoney(angebot)} für ${player.name}${zahlweise !== "sofort" ? " in Raten" : ""}`,
            body: (ablosefrei
                ? `${interestedClub.name} würde Ihren Spieler ${player.name} (${player.pos}, ${player.age} Jahre, Marktwert ${_formatTransferMoney(player.value)}) ablösefrei übernehmen.${lohnText}`
                : `${interestedClub.name} bietet ${_formatTransferMoney(angebot)} Ablösesumme${zahlText} für Ihren Spieler ${player.name} (${player.pos}, ${player.age} Jahre, Marktwert ${_formatTransferMoney(player.value)}).${lohnText}`)
                + `\n\nDas Angebot gilt ${this.ANGEBOTS_FRIST} Tage. Sie können annehmen, ablehnen oder mehr fordern - im Transfermarkt ganz oben.`,
            read: false,
            type: "transfer_offer",
            // Damit das Postfach Frist, Anhang und Knöpfe kennt
            offerId,
            relatedEntity: { type: "player", id: player.id },
            priority: "high"
        });
        return offer;
    }

    // ------------------------------------------- Abgeben, auch im Unterhaus
    //
    // Einen Spieler loszuwerden war vor allem unten schwer: Auf die
    // Transferliste setzte ihn nur sein eigener Wechselwunsch, Angebote kamen
    // von Vereinen, bei denen er nie gespielt hätte, und wer keinen
    // Abnehmer fand, blieb bis zum Vertragsende auf der Gehaltsliste.

    /** Wie weit ein Abnehmer über oder unter der eigenen Liga spielen darf */
    static ABNEHMER_STUFEN = { hoch: 1, tief: 2 };

    /** Nach wie vielen Tagen der Berater denselben Spieler wieder anbieten kann */
    static SUCHE_ABSTAND = 7;

    /** Kleiner darf der Kader durch Abgaben nicht werden */
    static MINDESTKADER = 16;

    /** Welcher Anteil des Restgehalts bei einer Vertragsauflösung fällig wird */
    static ABFINDUNG_ANTEIL = 0.5;

    static _liste(state, name) {
        if (!state.transferMarket) state.transferMarket = { listedPlayerIds: [], offers: [], history: [], shortlist: [] };
        if (!Array.isArray(state.transferMarket[name])) state.transferMarket[name] = [];
        return state.transferMarket[name];
    }

    /** Steht er ablösefrei zur Verfügung? */
    static istAblosefrei(state, player) {
        return !!player && (state?.transferMarket?.ablosefrei || []).includes(player.id);
    }

    /** Warum ein eigener Spieler nicht abgegeben werden kann - oder null */
    static abgabeHindernis(state, player) {
        if (!player || player.clubId !== state.userClubId) return "Nur Spieler des eigenen Vereins.";
        if (player.leihe) return "Er ist verliehen.";
        if (player.vorvertrag) return `Er hat bei ${player.vorvertrag.clubName || "einem anderen Verein"} unterschrieben.`;
        const club = state.clubs.find(c => c.id === state.userClubId);
        if ((club?.playerIds || []).length <= this.MINDESTKADER) return `Der Kader ist mit ${this.MINDESTKADER} Spielern zu klein, um jemanden abzugeben.`;
        return null;
    }

    /**
     * Was er bei einem Verein verdienen würde: nach dessen Liga, nicht weit
     * weg vom bisherigen Gehalt. Weniger gibt es nur eine Liga tiefer - wer
     * in derselben Liga oder höher wechselt, verdient mindestens so viel
     * wie bisher.
     */
    static lohnBei(player, club, eigeneStufe = null) {
        const gen = _getTransferPlayerGenerator();
        const bisher = player.wage || 1000;
        const dort = gen && typeof gen.getValueAndWage === "function"
            ? gen.getValueAndWage(player.overall || 50, club.level || 1, player.age || 25).wage : bisher;
        const tiefer = eigeneStufe !== null && (club.level || 1) > eigeneStufe;
        const boden = tiefer ? bisher * 0.7 : ((club.level || 1) < (eigeneStufe ?? 99) ? bisher * 1.1 : bisher);
        return Math.round(Math.max(boden, Math.min(bisher * 1.25, dort)) / 10) * 10;
    }

    /**
     * Wer einen Spieler des Managers nehmen würde: Vereine eine Liga höher
     * bis zwei tiefer, bei denen er spielen würde (LoanEngine.rolleBei), die
     * wenigstens die halbe Ablöse aufbringen und die Arbeitserlaubnis bekämen. Ins Ausland
     * geht es nur in den ersten beiden Ligen. Die besten zuerst - Stammplatz
     * vor Rotation, dann wie klar er sich durchsetzen würde.
     * ablosefrei: Die Ablöse zählt nicht. streuung: etwas Zufall in der
     * Reihenfolge (0 für eine feste Vorschau).
     */
    static abnehmer(state, player, { ablosefrei = false, anzahl = 6, streuung = 0.4 } = {}) {
        const loan = _transferResolve("LoanEngine", "./loanEngine.js");
        const eigener = player ? state.clubs.find(c => c.id === player.clubId) : null;
        if (!eigener || !loan || typeof loan.rolleBei !== "function") return [];
        const stufe = eigener.level || 1;
        // Wer weniger als die halbe Ablöse hat, bietet nicht - darüber bietet
        // ein kleiner Verein, was er hat (legeAngebotVor)
        const preis = ablosefrei ? 0 : Math.round((player.value || 0) * 0.45);
        const liste = [];
        state.clubs.forEach(c => {
            if (c.id === eigener.id) return;
            const s = c.level || 1;
            if (s < stufe - this.ABNEHMER_STUFEN.hoch || s > stufe + this.ABNEHMER_STUFEN.tief) return;
            if (c.countryId !== eigener.countryId && (s > 2 || stufe > 2)) return;
            if ((c.transferBudget || 0) < preis) return;
            const rolle = loan.rolleBei(state, player, c);
            if (!rolle) return;
            if (this.erlaubnisHindernis(state, player, c)) return;
            const vorsprung = (player.overall || 50) - loan.niveau(state, c);
            liste.push({
                club: c, clubId: c.id, clubName: c.name, stufe: s, rolle,
                lohn: this.lohnBei(player, c, stufe),
                wert: (rolle === "Stammspieler" ? 2 : 1) + Math.min(vorsprung, 6) * 0.05 + (streuung ? Math.random() * streuung : 0)
            });
        });
        return liste.sort((a, b) => b.wert - a.wert).slice(0, anzahl);
    }

    /** Auf die Transferliste - zum Verkauf oder ablösefrei */
    static aufTransferliste(state, playerId, { ablosefrei = false } = {}) {
        const player = state.players.find(p => p.id === playerId);
        const hindernis = this.abgabeHindernis(state, player);
        if (hindernis) return { success: false, error: hindernis };
        player.transferListed = true;
        const frei = this._liste(state, "ablosefrei");
        const i = frei.indexOf(player.id);
        if (ablosefrei && i < 0) frei.push(player.id);
        if (!ablosefrei && i >= 0) frei.splice(i, 1);
        return { success: true, player, ablosefrei };
    }

    /** Von der Transferliste nehmen. Einen erfüllten Wechselwunsch nimmt das nicht zurück. */
    static vonTransferliste(state, playerId) {
        const player = state.players.find(p => p.id === playerId);
        if (!player || player.clubId !== state.userClubId) return { success: false, error: "Nur Spieler des eigenen Vereins." };
        player.transferListed = false;
        const frei = this._liste(state, "ablosefrei");
        if (frei.includes(player.id)) state.transferMarket.ablosefrei = frei.filter(id => id !== player.id);
        return { success: true, player };
    }

    /** Wie viele Tage es noch dauert, bis er wieder angeboten werden kann (0: jetzt) */
    static sucheGesperrt(state, player) {
        const zuletzt = player ? state?.transferMarket?.suche?.[player.id] : null;
        if (!zuletzt || zuletzt.saison !== (state.seasonYear || 1)) return 0;
        return Math.max(0, this.SUCHE_ABSTAND - ((state.currentDayIndex || 0) - zuletzt.tag));
    }

    /**
     * Verein suchen: Der Spieler wird den passenden Vereinen angeboten (und
     * steht damit auf der Transferliste). Wer ihn will, bietet sofort - mit
     * Frist und Knöpfen wie jedes andere Angebot. Findet sich keiner, sagt
     * der Sportdirektor, was bleibt: ablösefrei abgeben oder den Vertrag
     * auflösen.
     */
    static vereinSuchen(state, playerId, { ablosefrei = null } = {}) {
        const player = state.players.find(p => p.id === playerId);
        const hindernis = this.abgabeHindernis(state, player) || this.fensterHindernis(state);
        if (hindernis) return { success: false, error: hindernis };
        const rest = this.sucheGesperrt(state, player);
        if (rest) return { success: false, error: `Er wurde gerade erst angeboten - in ${rest} Tag${rest === 1 ? "" : "en"} wieder.` };
        const tag = state.currentDayIndex || 0;
        const saison = state.seasonYear || 1;
        const suche = state.transferMarket.suche || (state.transferMarket.suche = {});
        const frei = ablosefrei === null ? this.istAblosefrei(state, player) : !!ablosefrei;
        this.aufTransferliste(state, player.id, { ablosefrei: frei });
        suche[player.id] = { tag, saison };

        const kandidaten = this.abnehmer(state, player, { ablosefrei: frei, anzahl: 5 });
        const angebote = [];
        const absagen = [];
        kandidaten.forEach((k, i) => {
            const schonDa = state.transferMarket.offers.some(o => o.status === "pending" && o.playerId === player.id && o.fromClubId === k.clubId);
            // Der Verein, zu dem er am besten passt, greift fast immer zu; die
            // übrigen eher für einen Stammplatz - ablösefrei sowieso
            const chance = i === 0 ? 0.9 : (k.rolle === "Stammspieler" ? 0.6 : 0.4) + (frei ? 0.2 : 0);
            if (!schonDa && angebote.length < 3 && Math.random() < chance) {
                angebote.push(this.legeAngebotVor(state, player, k.club, { verkaeuflich: true, ablosefrei: frei, lohn: k.lohn }));
            } else if (!schonDa) {
                absagen.push(k.clubName);
            }
        });
        if (!angebote.length) {
            const news = _transferResolve("NewsEngine", "./newsEngine.js");
            const rat = frei
                ? `Bleibt der Vertrag aufzulösen - die Abfindung läge bei ${_formatTransferMoney(this.abfindung(state, player))}.`
                : "Ablösefrei hätte er bessere Karten. Oder Sie lösen den Vertrag auf.";
            if (news && typeof news.addMessage === "function") {
                news.addMessage(state, "transfer", {
                    title: `Kein Abnehmer für ${player.name}`,
                    sender: "Sportdirektor",
                    text: kandidaten.length
                        ? `Wir haben ${player.name} ${kandidaten.length} Vereinen angeboten, bei denen er spielen würde (${absagen.join(", ")}). Im Moment beißt keiner an. ${rat}`
                        : `Für ${player.name} gibt es keinen Verein, bei dem er spielen würde und der ${frei ? "ihn nimmt" : "die Ablöse zahlen kann"}. ${rat}`,
                    priority: "normal",
                    relatedEntity: { type: "player", id: player.id }
                });
            }
        }
        return { success: true, player, angebote, absagen, kandidaten: kandidaten.length, ablosefrei: frei };
    }

    /**
     * Was es kostet, den Vertrag aufzulösen: die Hälfte des Gehalts, das
     * bis zum Vertragsende noch fällig wäre, mindestens vier Wochen. Der
     * Kalender zählt jede Saison ab Tag 0.
     */
    static abfindung(state, player) {
        if (!player) return 0;
        const wochenSeit = Math.min(51, Math.floor((state?.currentDayIndex || 0) / 7));
        const jahre = Math.max(1, player.contractYears || 1);
        const wochen = Math.max(4, (jahre - 1) * 52 + (52 - wochenSeit));
        return Math.round((player.wage || 0) * wochen * this.ABFINDUNG_ANTEIL / 100) * 100;
    }

    /**
     * Den Vertrag auflösen: Der Verein zahlt die Abfindung, der Spieler ist
     * vereinslos und kann sofort woanders unterschreiben. Das geht auch
     * außerhalb des Transferfensters.
     */
    static vertragAufloesen(state, playerId) {
        const player = state.players.find(p => p.id === playerId);
        const hindernis = this.abgabeHindernis(state, player);
        if (hindernis) return { success: false, error: hindernis };
        const club = state.clubs.find(c => c.id === state.userClubId);
        const summe = this.abfindung(state, player);
        if ((club.balance || 0) < summe) return { success: false, error: `Für die Abfindung von ${_formatTransferMoney(summe)} fehlt das Geld.` };

        club.balance -= summe;
        const fin = _getTransferFinanceEngine();
        if (fin && summe > 0) fin.recordTransaction(state, club.id, "abfindung", -summe, `Abfindung ${player.name}`);

        const kabine = _transferResolve("DressingRoomEngine", "./dressingRoomEngine.js");
        if (kabine && typeof kabine.spielerGeht === "function") kabine.spielerGeht(state, player);
        const laufbahn = _transferResolve("LaufbahnEngine", "./laufbahnEngine.js");
        if (laufbahn && typeof laufbahn.wechsel === "function") laufbahn.wechsel(state, player, club.id);

        club.playerIds = (club.playerIds || []).filter(id => id !== player.id);
        club.bench = (club.bench || []).filter(id => id !== player.id);
        // Die Lücke in der Aufstellung an ihrer Stelle schließen (wie bei executeTransfer)
        club.lineup = (club.lineup || []).filter(id => id !== player.id);
        const gs = _getTransferGameState();
        if (gs && typeof gs.repairLineup === "function") gs.repairLineup(club, state.players);

        player.clubId = null;
        player.contractYears = 0;
        player.vereinslosAb = state.seasonYear || 1;
        player.transferListed = false;
        player.wechselwunsch = undefined;
        player.reserve = undefined;
        player.jugendvertrag = undefined;
        player.nominiertAus = undefined;
        player.leihListe = undefined;
        player.trikot = undefined;
        player.klauseln = undefined;
        player.praemien = undefined;
        state.transferMarket.offers.forEach(o => { if (o.status === "pending" && o.playerId === player.id) o.status = "withdrawn"; });
        if (Array.isArray(state.transferMarket.ablosefrei)) state.transferMarket.ablosefrei = state.transferMarket.ablosefrei.filter(id => id !== player.id);

        state.inbox.unshift({
            id: Date.now() + 3,
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday}`,
            sender: "Sportdirektor",
            subject: `Vertrag aufgelöst: ${player.name}`,
            body: `Der Vertrag mit ${player.name} ist aufgelöst. Er erhält eine Abfindung von ${_formatTransferMoney(summe)} und ist ab sofort vereinslos.`,
            read: false,
            type: "transfer",
            relatedEntity: { type: "player", id: player.id }
        });
        return { success: true, player, abfindung: summe };
    }
}

if (typeof window !== "undefined") {
    window.TransferEngine = TransferEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TransferEngine };
}
