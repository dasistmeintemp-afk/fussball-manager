/**
 * AIManagerEngine - Intelligente Aufstellungen, Taktiken und Transfers für KI-Vereine
 */

const AIManagerEngine = {
    /**
     * Wählt die beste Aufstellung für einen KI-Verein unter Berücksichtigung von Verletzungen & Sperren
     */
    prepareClubForMatch(state, clubId) {
        if (!state) return;
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return;

        const allPlayers = state.players.filter(p => p.clubId === clubId);
        const available = allPlayers.filter(p => !p.injured && !p.suspended);

        // Fallback-Formation
        const formationKey = club.formation || "4-4-2";
        const formConfigs = (typeof FORMATION_CONFIGS !== 'undefined' && FORMATION_CONFIGS) 
            ? FORMATION_CONFIGS 
            : ((typeof window !== 'undefined' && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS : (typeof require !== 'undefined' ? require('./gameState.js').FORMATION_CONFIGS : (state.formationConfigs || {})));
        const formConfig = (formConfigs && formConfigs[formationKey]) || null;

        const starters = [];
        const usedIds = new Set();

        // 1. Torwart finden
        const gks = available.filter(p => p.pos === "TW").sort((a, b) => b.overall - a.overall);
        if (gks.length > 0) {
            starters.push(gks[0].id);
            usedIds.add(gks[0].id);
        } else {
            // Not-Torwart
            const fallbackGk = available.sort((a, b) => (b.goalkeeping || b.overall) - (a.goalkeeping || a.overall))[0];
            if (fallbackGk) {
                starters.push(fallbackGk.id);
                usedIds.add(fallbackGk.id);
            }
        }

        // 2. Feldspieler nach Positionen der Formation besetzen
        if (formConfig && formConfig.positions) {
            const outfieldSlots = formConfig.positions.filter(slot => slot.pos !== "TW");

            outfieldSlots.forEach(slot => {
                // Exakte Positionsübereinstimmung
                let candidate = available
                    .filter(p => !usedIds.has(p.id) && (p.pos === slot.pos || p.secondPos === slot.pos))
                    .sort((a, b) => b.overall - a.overall)[0];

                // Falls kein passender Spieler, bester verbleibender Feldspieler
                if (!candidate) {
                    candidate = available
                        .filter(p => !usedIds.has(p.id) && p.pos !== "TW")
                        .sort((a, b) => b.overall - a.overall)[0];
                }

                // Absoluter Fallback falls Kader zu klein
                if (!candidate) {
                    candidate = available.filter(p => !usedIds.has(p.id))[0];
                }

                if (candidate) {
                    starters.push(candidate.id);
                    usedIds.add(candidate.id);
                }
            });
        }

        // 3. Auffüllen falls weniger als 11
        if (starters.length < 11) {
            const remaining = available.filter(p => !usedIds.has(p.id)).sort((a, b) => b.overall - a.overall);
            for (const rem of remaining) {
                if (starters.length >= 11) break;
                starters.push(rem.id);
                usedIds.add(rem.id);
            }
        }

        // 4. Ersatzbank bestimmen (bis zu 7 Spieler)
        const bench = available
            .filter(p => !usedIds.has(p.id))
            .sort((a, b) => b.overall - a.overall)
            .slice(0, 7)
            .map(p => p.id);

        club.lineup = starters;
        club.bench = bench;
    },

    /**
     * Aktualisiert alle KI-Vereine vor dem Spieltag (Aufstellung & Taktik)
     */
    updateAllAiClubsBeforeMatchday(state) {
        if (!state || !Array.isArray(state.clubs)) return;

        const round = state.schedule?.find(r => r.matchday === state.currentMatchday);

        state.clubs.forEach(club => {
            if (club.id === state.userClubId) return; // Spieler-Team nicht überschreiben

            // Aufstellung setzen
            this.prepareClubForMatch(state, club.id);

            // Taktik anpassen basierend auf Gegner
            if (round) {
                const match = round.matches?.find(m => m.homeClubId === club.id || m.awayClubId === club.id);
                if (match) {
                    const opponentId = match.homeClubId === club.id ? match.awayClubId : match.homeClubId;
                    this.chooseTactics(state, club.id, opponentId);
                }
            }
        });
    },

    /**
     * Wählt die passende Taktik für ein Spiel
     */
    chooseTactics(state, clubId, opponentId) {
        const club = state.clubs.find(c => c.id === clubId);
        const opponent = state.clubs.find(c => c.id === opponentId);
        if (!club || !opponent) return;

        const clubRep = club.reputation || 70;
        const oppRep = opponent.reputation || 70;
        const diff = clubRep - oppRep;

        if (diff >= 10) {
            club.mentality = "offensive";
            club.pressing = "high";
            club.tempo = "fast";
        } else if (diff <= -10) {
            club.mentality = "defensive";
            club.pressing = "low";
            club.tempo = "normal";
        } else {
            club.mentality = "balanced";
            club.pressing = "medium";
            club.tempo = "normal";
        }
    },

    /**
     * Erzeugt gelegentlich KI-Transferangebote für Spieler
     */
    generateAiTransferOffers(state) {
        if (!state || !Array.isArray(state.clubs) || state.currentMatchday % 3 !== 0) return;

        // KI-Käufer auswählen mit gutem Transferbudget
        const aiClubs = state.clubs.filter(c => c.id !== state.userClubId && c.transferBudget > 5000000);
        if (aiClubs.length === 0) return;

        const buyer = aiClubs[Math.floor(Math.random() * aiClubs.length)];

        // Spieler suchen (z. B. vom User-Kader oder anderen Vereinen)
        const userPlayers = state.players.filter(p => p.clubId === state.userClubId && !p.injured && p.overall >= 74);
        if (userPlayers.length > 0 && Math.random() < 0.35) {
            const targetPlayer = userPlayers[Math.floor(Math.random() * userPlayers.length)];
            const offerFee = Math.round(targetPlayer.value * (1.0 + (Math.random() * 0.25)));

            if (buyer.transferBudget >= offerFee) {
                // Angebot ins Postfach legen
                const offerObj = {
                    id: "offer_" + Date.now(),
                    buyerClubId: buyer.id,
                    buyerClubName: buyer.name,
                    playerId: targetPlayer.id,
                    playerName: targetPlayer.name,
                    fee: offerFee,
                    feeFormatted: (typeof Formatters !== 'undefined') ? Formatters.formatMoney(offerFee) : `${offerFee} €`,
                    playerValue: targetPlayer.value,
                    wage: Math.round(targetPlayer.wage * 1.2),
                    status: "pending"
                };

                if (!state.transferMarket) state.transferMarket = { offers: [], history: [], shortlist: [] };
                if (!Array.isArray(state.transferMarket.offers)) state.transferMarket.offers = [];
                state.transferMarket.offers.push(offerObj);

                const newsEngine = (typeof NewsEngine !== 'undefined') ? NewsEngine : (typeof window !== 'undefined' ? window.NewsEngine : null);
                if (newsEngine) {
                    newsEngine.addMessage(state, "transfer_offer", {
                        title: `Transferangebot für ${targetPlayer.name}`,
                        sender: `${buyer.name}`,
                        text: `${buyer.name} bietet eine Ablösesumme von ${offerObj.feeFormatted} für Ihren Spieler ${targetPlayer.name} (Marktwert: ${(targetPlayer.value / 1000000).toFixed(1)} Mio. €).`,
                        priority: "high",
                        relatedEntity: offerObj
                    });
                }
            }
        }
    }
};

if (typeof window !== "undefined") {
    window.AIManagerEngine = AIManagerEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIManagerEngine };
}
