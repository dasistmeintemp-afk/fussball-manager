/**
 * TransferEngine - Steuert Transferangebote, Verhandlungen, Marktwerte und Marktaktivität
 */

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
     * Berechnet den geforderten Ablösepreis für einen Spieler
     */
    static calculateAskingPrice(player, sellerClub) {
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

        // Finanzen verbuchen
        buyerClub.balance -= fee;
        buyerClub.transferBudget -= fee;

        if (sellerClub) {
            sellerClub.balance += fee;
            sellerClub.transferBudget += Math.round(fee * 0.85); // 85% reinvestierbar
            // Aus Kader des alten Vereins entfernen
            sellerClub.playerIds = sellerClub.playerIds.filter(id => id !== player.id);
            sellerClub.lineup = sellerClub.lineup.filter(id => id !== player.id);
            sellerClub.bench = sellerClub.bench.filter(id => id !== player.id);
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
        state.transferMarket.listedPlayerIds = state.transferMarket.listedPlayerIds.filter(id => id !== player.id);

        // Nachricht ins Postfach
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

                    state.transferMarket.offers.unshift({
                        id: Date.now(),
                        playerId: player.id,
                        playerName: player.name,
                        playerOverall: player.overall,
                        playerPos: player.pos,
                        fromClubId: interestedClub.id,
                        fromClubName: interestedClub.name,
                        toClubId: userClub.id,
                        fee: offerFee,
                        status: "pending"
                    });

                    state.inbox.unshift({
                        id: Date.now() + 1,
                        matchday: state.currentMatchday,
                        date: `Spieltag ${state.currentMatchday}`,
                        sender: interestedClub.name,
                        subject: `Transferangebot für ${player.name}`,
                        body: `${interestedClub.name} bietet ${_formatTransferMoney(offerFee)} Ablösesumme für Ihren Spieler ${player.name} (${player.pos}, Gesamtstärke ${player.overall}). Sie können das Angebot im Transfermenü prüfen und annehmen oder ablehnen.`,
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
