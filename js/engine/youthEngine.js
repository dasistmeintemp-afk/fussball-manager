/**
 * YouthEngine - Nachwuchsakademie, Jugendförderung und Talentbeförderung
 */

const YouthEngine = {
    /**
     * Erzeugt neue Jugendspieler für die Akademie eines Vereins
     */
    generateProspects(state, clubId) {
        if (!state) return [];
        if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
        if (!Array.isArray(state.youthAcademy.prospects)) state.youthAcademy.prospects = [];

        const club = state.clubs.find(c => c.id === clubId);
        const academyLevel = club?.facilities?.youthCenter || state.youthAcademy.level || 1;

        const positions = ["TW", "IV", "LV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"];
        const namePools = (typeof NAME_POOLS !== 'undefined') ? NAME_POOLS : (typeof window !== 'undefined' ? window.NAME_POOLS : (typeof require !== 'undefined' ? require('../data/namePools.js').NAME_POOLS : {}));
        const poolFirst = (namePools && namePools.firstNames) ? namePools.firstNames : ["Max", "Lukas", "Leon", "Finn", "Elias"];
        const poolLast = (namePools && namePools.lastNames) ? namePools.lastNames : ["Müller", "Schmidt", "Weber", "Bauer", "Fischer"];
        const poolNat = (namePools && namePools.nationalities) ? namePools.nationalities : ["Deutschland"];

        const newProspects = [];
        const count = 3;

        for (let i = 0; i < count; i++) {
            const firstName = poolFirst[Math.floor(Math.random() * poolFirst.length)];
            const lastName = poolLast[Math.floor(Math.random() * poolLast.length)];
            const nat = poolNat[Math.floor(Math.random() * poolNat.length)];
            const pos = positions[Math.floor(Math.random() * positions.length)];
            const age = 15 + Math.floor(Math.random() * 3); // 15, 16 oder 17

            // Gesamtstärke und Potenzial abhängig vom Akademie-Level
            const baseOvr = 50 + (academyLevel * 2) + Math.floor(Math.random() * 8);
            const basePot = 72 + (academyLevel * 3) + Math.floor(Math.random() * 12);
            const pot = Math.min(94, Math.max(baseOvr + 8, basePot));

            const prospect = {
                id: "youth_" + Date.now() + "_" + i + "_" + Math.floor(Math.random() * 1000),
                clubId: clubId,
                name: `${firstName} ${lastName}`,
                age: age,
                nationality: nat,
                pos: pos,
                overall: baseOvr,
                pot: pot,
                developmentRate: 1.0 + (academyLevel * 0.1),
                promoted: false
            };

            state.youthAcademy.prospects.push(prospect);
            newProspects.push(prospect);
        }

        return newProspects;
    },

    /**
     * Wöchentliches Jugendtraining zur Weiterentwicklung der Talente
     */
    trainProspects(state, clubId) {
        if (!state || !state.youthAcademy || !Array.isArray(state.youthAcademy.prospects)) return;

        state.youthAcademy.prospects.forEach(prospect => {
            if (prospect.promoted || prospect.clubId !== clubId) return;

            // Chance auf Attributssteigerung
            if (Math.random() < 0.25 && prospect.overall < prospect.pot) {
                prospect.overall += 1;
            }
        });
    },

    /**
     * Befördert ein Akademie-Talent in die 1. Mannschaft
     */
    promoteProspect(state, clubId, prospectId) {
        if (!state) return { success: false, error: "Kein State vorhanden." };
        const prospect = state.youthAcademy?.prospects.find(p => p.id === prospectId);
        if (!prospect) return { success: false, error: "Jugendspieler nicht gefunden." };
        if (prospect.promoted) return { success: false, error: "Spieler wurde bereits befördert." };

        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };

        // Neuen vollwertigen Spieler in state.players erzeugen
        const maxPlayerId = (state.players && state.players.length > 0)
            ? state.players.reduce((max, p) => Math.max(max, (p && p.id) ? p.id : 0), 0)
            : 100;
        const newPlayerId = maxPlayerId + 1;
        const initialWage = 8000;
        const initialValue = Math.round(prospect.overall * prospect.overall * 1200);

        const newPlayer = {
            id: newPlayerId,
            name: prospect.name,
            age: prospect.age,
            nationality: prospect.nationality || "Deutschland",
            clubId: clubId,
            pos: prospect.pos,
            overall: prospect.overall,
            pot: prospect.pot,
            value: initialValue,
            wage: initialWage,
            contractYears: 3,
            fitness: 100,
            morale: 88,
            form: 7,
            injured: false,
            injuryWeeks: 0,
            suspended: false,
            yellowCards: 0,
            squadRole: "Zukunftstalent",
            happiness: {
                overall: 85,
                playingTime: 80,
                contract: 90,
                teamPerformance: 75,
                training: 85,
                reason: "Glücklich über die Beförderung in die 1. Mannschaft!"
            },
            stats: { appearances: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, avgRating: 0.0 },
            // Basiswerte
            pace: 70 + Math.floor(Math.random() * 15),
            shooting: 60 + Math.floor(Math.random() * 15),
            passing: 65 + Math.floor(Math.random() * 15),
            dribbling: 65 + Math.floor(Math.random() * 15),
            defense: 55 + Math.floor(Math.random() * 15),
            physical: 65 + Math.floor(Math.random() * 15),
            stamina: 75,
            vision: 68,
            technique: 70
        };

        state.players.push(newPlayer);
        prospect.promoted = true;

        if (typeof NewsEngine !== 'undefined') {
            NewsEngine.addMessage(state, "youth", {
                title: `Nachwuchstalent befördert: ${newPlayer.name}`,
                sender: "Jugendakademie",
                text: `${newPlayer.name} (${newPlayer.pos}, ${newPlayer.age} Jahre, Stärke: ${newPlayer.overall}) hat seinen ersten Profivertrag unterschrieben und steht ab sofort im Kader!`,
                priority: "high",
                relatedEntity: { playerId: newPlayer.id }
            });
        }

        return { success: true, player: newPlayer };
    },

    /**
     * Baut die Jugendakademie aus
     */
    upgradeAcademy(state, clubId) {
        if (!state) return { success: false, error: "Kein State vorhanden." };
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };

        if (!club.facilities) club.facilities = { trainingGround: 2, youthCenter: 1, medicalCenter: 1, stadium: 2 };
        const currentLevel = club.facilities.youthCenter || 1;

        if (currentLevel >= 5) {
            return { success: false, error: "Jugendakademie hat bereits die maximale Ausbaustufe (Level 5) erreicht." };
        }

        const cost = currentLevel * 2500000; // 2.5 Mio., 5.0 Mio., etc.
        if (club.balance < cost) {
            return { success: false, error: `Nicht genug Budget. Ausbau auf Stufe ${currentLevel + 1} kostet ${(cost / 1000000).toFixed(1)} Mio. €.` };
        }

        club.balance -= cost;
        club.facilities.youthCenter += 1;
        if (state.youthAcademy) state.youthAcademy.level = club.facilities.youthCenter;

        if (typeof FinanceEngine !== 'undefined') {
            FinanceEngine.recordTransaction(state, club.id, "facility_cost", -cost, `Ausbau der Jugendakademie auf Stufe ${club.facilities.youthCenter}`);
        }

        return {
            success: true,
            newLevel: club.facilities.youthCenter,
            message: `Jugendakademie erfolgreich auf Stufe ${club.facilities.youthCenter} ausgebaut!`
        };
    }
};

if (typeof window !== "undefined") {
    window.YouthEngine = YouthEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YouthEngine };
}
