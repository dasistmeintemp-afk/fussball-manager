/**
 * YouthEngine - Nachwuchsakademie, Jugendförderung und Talentbeförderung
 */

/**
 * FacilityEngine - Universelle Infrastruktur-Verwaltung & Ausbauten (C6)
 */
const FacilityEngine = {
    FACILITY_NAMES: {
        trainingGround: "Trainingsgelände",
        youthCenter: "Jugendakademie",
        medicalCenter: "Medizinisches Zentrum",
        stadium: "Stadionausbau"
    },

    FACILITY_COSTS: {
        trainingGround: [1500000, 3000000, 6000000, 12000000],
        youthCenter: [2000000, 4000000, 8000000, 16000000],
        medicalCenter: [1200000, 2500000, 5000000, 10000000],
        stadium: [3000000, 7000000, 15000000, 30000000]
    },

    upgrade(state, clubId, facilityKey) {
        if (!state) return { success: false, error: "Kein State vorhanden." };
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };

        if (!club.facilities) {
            club.facilities = { trainingGround: 2, youthCenter: 1, medicalCenter: 1, stadium: 2 };
        }

        const curLvl = club.facilities[facilityKey] || 1;
        if (curLvl >= 5) {
            return { success: false, error: `${FacilityEngine.FACILITY_NAMES[facilityKey] || facilityKey} hat bereits die maximale Stufe 5 erreicht.` };
        }

        const costList = FacilityEngine.FACILITY_COSTS[facilityKey] || [2000000, 4000000, 8000000, 15000000];
        const cost = costList[curLvl - 1] || (curLvl * 2500000);

        if (club.balance < cost) {
            return {
                success: false,
                error: `Nicht genug Budget. Ausbau auf Stufe ${curLvl + 1} kostet ${(cost / 1000000).toFixed(1)} Mio. €.`
            };
        }

        club.balance -= cost;
        club.facilities[facilityKey] = curLvl + 1;

        if (facilityKey === "youthCenter") {
            if (club.youthAcademy) club.youthAcademy.level = club.facilities.youthCenter;
            if (club.id === state.userClubId && state.youthAcademy) {
                state.youthAcademy.level = club.facilities.youthCenter;
            }
        } else if (facilityKey === "stadium") {
            // Stadionkapazität vergrößern (+15-20%)
            club.capacity = Math.round((club.capacity || 25000) * 1.15);
        }

        const financeEngine = (typeof FinanceEngine !== 'undefined') ? FinanceEngine : ((typeof window !== 'undefined') ? window.FinanceEngine : null);
        if (financeEngine && typeof financeEngine.recordTransaction === 'function') {
            financeEngine.recordTransaction(
                state,
                club.id,
                "facility_cost",
                -cost,
                `Ausbau: ${FacilityEngine.FACILITY_NAMES[facilityKey] || facilityKey} auf Stufe ${club.facilities[facilityKey]}`
            );
        }

        return {
            success: true,
            newLevel: club.facilities[facilityKey],
            message: `${FacilityEngine.FACILITY_NAMES[facilityKey] || facilityKey} erfolgreich auf Stufe ${club.facilities[facilityKey]} ausgebaut!`
        };
    }
};

const YouthEngine = {
    /**
     * Erzeugt neue Jugendspieler für die Akademie eines Vereins (C7: auch KI-Vereine)
     */
    generateProspects(state, clubId) {
        if (!state) return [];
        if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
        if (!Array.isArray(state.youthAcademy.prospects)) state.youthAcademy.prospects = [];

        const club = state.clubs.find(c => c.id === clubId);
        if (club && !club.youthAcademy) {
            club.youthAcademy = { prospects: [], level: club.facilities?.youthCenter || 1 };
        }
        const academyLevel = club?.facilities?.youthCenter || club?.youthAcademy?.level || state.youthAcademy.level || 1;

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

            // Gesamtstärke und Potenzial abhängig vom Akademie-Level (C2 & C7)
            const baseOvr = 50 + (academyLevel * 3) + Math.floor(Math.random() * 8);
            const basePot = 72 + (academyLevel * 4) + Math.floor(Math.random() * 12);
            const pot = Math.min(95, Math.max(baseOvr + 8, basePot));

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

            if (club && club.youthAcademy) {
                club.youthAcademy.prospects.push(prospect);
            }
            if (clubId === state.userClubId) {
                state.youthAcademy.prospects.push(prospect);
            }
            newProspects.push(prospect);
        }

        return newProspects;
    },

    /**
     * Wöchentliches Jugendtraining zur Weiterentwicklung der Talente
     */
    trainProspects(state, clubId) {
        if (!state) return;
        const club = state.clubs?.find(c => c.id === clubId);
        const academyLvl = club?.facilities?.youthCenter || 1;

        const prospects = (club?.youthAcademy?.prospects) || (clubId === state.userClubId ? state.youthAcademy?.prospects : []);
        if (!Array.isArray(prospects)) return;

        prospects.forEach(prospect => {
            if (prospect.promoted || prospect.clubId !== clubId) return;

            // Chance auf Attributssteigerung abhängig vom Level
            const growthChance = 0.20 + (academyLvl * 0.05);
            if (Math.random() < growthChance && prospect.overall < prospect.pot) {
                prospect.overall += 1;
            }
        });
    },

    /**
     * Befördert ein Akademie-Talent in die 1. Mannschaft
     */
    promoteProspect(state, clubId, prospectId) {
        if (!state) return { success: false, error: "Kein State vorhanden." };
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };

        let prospect = club.youthAcademy?.prospects?.find(p => p.id === prospectId);
        if (!prospect && state.youthAcademy?.prospects) {
            prospect = state.youthAcademy.prospects.find(p => p.id === prospectId);
        }
        if (!prospect) return { success: false, error: "Jugendspieler nicht gefunden." };
        if (prospect.promoted) return { success: false, error: "Spieler wurde bereits befördert." };

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
            injuredWeeks: 0,
            suspended: false,
            suspendedMatches: 0,
            yellowCards: 0,
            yellowCardsTotal: 0,
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
        club.playerIds.push(newPlayer.id);
        prospect.promoted = true;

        if (typeof NewsEngine !== 'undefined' && clubId === state.userClubId) {
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
        return FacilityEngine.upgrade(state, clubId, "youthCenter");
    }
};

if (typeof window !== "undefined") {
    window.FacilityEngine = FacilityEngine;
    window.YouthEngine = YouthEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FacilityEngine, YouthEngine };
}
