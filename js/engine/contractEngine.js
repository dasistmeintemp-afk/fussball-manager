/**
 * ContractEngine - Vertragsverhandlungen, Gehaltsforderungen, auslaufende Verträge
 */

const ContractEngine = {
    /**
     * Ermittelt die Gehaltsforderung eines Spielers für eine Vertragsverlängerung
     */
    getExtensionDemand(player, club) {
        if (!player) return { demandWage: 20000, preferredYears: 3, preferredRole: "Stammspieler" };

        const baseWage = player.wage || 25000;
        let mult = 1.15;

        // Wenn Spieler jung mit hohem Potenzial ist
        if (player.age <= 23 && player.pot > player.overall) {
            mult += (player.pot - player.overall) * 0.02;
        }

        // Wenn Spieler hohe Gesamtstärke hat
        if (player.overall >= 85) mult += 0.20;
        else if (player.overall >= 80) mult += 0.10;

        // Alterfaktor
        if (player.age >= 33) mult -= 0.10;

        const demandWage = Math.max(10000, Math.round(baseWage * mult / 1000) * 1000);
        let preferredRole = "Stammspieler";
        if (player.overall >= 83) preferredRole = "Schlüsselspieler";
        else if (player.overall < 75) preferredRole = "Rotationsspieler";

        return {
            demandWage: demandWage,
            demandWageFormatted: (typeof Formatters !== 'undefined') ? Formatters.formatMoney(demandWage) : `${demandWage} €`,
            preferredYears: player.age >= 32 ? 2 : 3,
            preferredRole: preferredRole
        };
    },

    /**
     * Verhandelt eine Vertragsverlängerung mit einem Spieler
     */
    negotiateExtension(player, club, offeredWage, offeredYears, offeredRole) {
        if (!player || !club) return { success: false, reason: "Ungültige Parameter." };

        const demand = this.getExtensionDemand(player, club);

        if (club.wageBudget < offeredWage) {
            return {
                success: false,
                reason: "Das Vereins-Gehaltsbudget reicht für dieses Gehaltsangebot nicht aus."
            };
        }

        // Mindestgehalt akzeptiert, wenn es mindestens 90% der Forderung beträgt
        const wageRatio = offeredWage / demand.demandWage;

        if (wageRatio < 0.88) {
            return {
                success: false,
                reason: `${player.name} lehnt ab: Das Gehaltsangebot liegt deutlich unter seinen Vorstellungen (fordert ca. ${demand.demandWageFormatted} / Woche).`
            };
        }

        if (offeredYears < 1 || offeredYears > 5) {
            return {
                success: false,
                reason: "Die gewünschte Vertragslaufzeit muss zwischen 1 und 5 Jahren liegen."
            };
        }

        // Vertrag erfolgreich verlängert
        player.wage = Math.round(offeredWage);
        player.contractYears = offeredYears;
        if (offeredRole) player.squadRole = offeredRole;

        if (player.happiness) {
            player.happiness.contract = 95;
            player.happiness.overall = Math.min(100, player.happiness.overall + 10);
            player.happiness.reason = "Sehr zufrieden mit dem neuen Vertrag.";
        }
        player.morale = Math.min(100, (player.morale || 80) + 12);

        return {
            success: true,
            player: player,
            reason: `Vertrag mit ${player.name} erfolgreich um ${offeredYears} Jahre verlängert!`
        };
    },

    /**
     * Ermittelt alle Spieler eines Vereins mit auslaufendem Vertrag (<= 1 Jahr)
     */
    getExpiringContracts(state, clubId) {
        if (!state) return [];
        return state.players.filter(p => p.clubId === clubId && (p.contractYears === undefined || p.contractYears <= 1));
    },

    /**
     * Reduziert Vertragslaufzeiten am Saisonende und meldet auslaufende Verträge
     */
    processSeasonContractUpdates(state) {
        if (!state || !Array.isArray(state.players)) return;

        state.players.forEach(p => {
            if (p.contractYears !== undefined) {
                p.contractYears = Math.max(0, p.contractYears - 1);
            }

            // Auslaufende Verträge des Spielervereins warnen
            if (p.clubId === state.userClubId && p.contractYears === 1) {
                if (typeof NewsEngine !== 'undefined') {
                    NewsEngine.addMessage(state, "contract_expiring", {
                        title: `Auslaufender Vertrag: ${p.name}`,
                        sender: "Sportdirektor",
                        text: `Der Vertrag von ${p.name} läuft am Ende dieser Saison aus. Verhandeln Sie zeitnah eine Verlängerung, um einen ablösefreien Abgang zu verhindern.`,
                        priority: "high",
                        relatedEntity: { playerId: p.id }
                    });
                }
            }
        });
    }
};

if (typeof window !== "undefined") {
    window.ContractEngine = ContractEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ContractEngine };
}
