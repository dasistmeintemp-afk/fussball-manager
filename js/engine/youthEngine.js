/**
 * YouthEngine - Nachwuchsakademie, Jugendförderung und Talentbeförderung
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _youthResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));

    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const YouthEngine = {
    /**
     * Die Handschrift der Akademie - welche Positionen sie bevorzugt ausbildet.
     *
     * Eine Technikschule wie La Masia bringt Mittelfeldspieler und Flügel
     * hervor, eine Zweikampfschule Innenverteidiger und Sechser. Das ist keine
     * Frage der Qualität, sondern der Ausrichtung.
     */
    SCHUL_POSITIONEN: {
        technik:   ["ZM", "OM", "LM", "RM", "LA", "RA"],
        athletik:  ["ST", "LV", "RV", "LA", "RA", "IV"],
        spielwitz: ["ZM", "OM", "DM", "IV", "TW"],
        kampf:     ["IV", "DM", "LV", "RV", "ZM"],
        ausgewogen: []
    },

    /** Das Anlagenprofil der Jugendakademie eines Vereins */
    schuleVon(club) {
        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        if (!fac || !club) return null;
        const key = club.akademieProfil || (fac.waehleProfil ? fac.waehleProfil(club) : "ausgewogen");
        if (club && !club.akademieProfil) club.akademieProfil = key;
        const profil = (fac.AKADEMIE_PROFILE || {})[key];
        return profil ? { key, ...profil } : null;
    },

    /**
     * Wie gut die Akademie gerade arbeitet.
     *
     * Nicht die gebaute Stufe zählt, sondern die wirksame: Eine Akademie, die
     * seit acht Jahren niemand angefasst hat, bildet schlechter aus als eine
     * kleinere, die gepflegt wird.
     */
    akademieStufe(state, club) {
        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        if (fac && club && typeof fac.wirksameStufe === "function") {
            return fac.wirksameStufe(club, "youthCenter", state?.seasonYear || 1);
        }
        return club?.facilities?.youthCenter || club?.youthAcademy?.level || state?.youthAcademy?.level || 1;
    },

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
        const academyLevel = this.akademieStufe(state, club);
        const schule = this.schuleVon(club);

        // Die Schule zieht ihre Lieblingspositionen häufiger - aber nie allein
        const positions = ["TW", "IV", "LV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"];
        const bevorzugt = (schule && this.SCHUL_POSITIONEN[schule.key]) || [];
        const posTopf = positions.concat(bevorzugt, bevorzugt);
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
            const pos = posTopf[Math.floor(Math.random() * posTopf.length)];
            const age = 15 + Math.floor(Math.random() * 3); // 15, 16 oder 17

            // Gesamtstärke und Potenzial abhängig vom Akademie-Level (C2 & C7)
            const baseOvr = Math.round(50 + (academyLevel * 3) + Math.floor(Math.random() * 8));
            const basePot = Math.round(72 + (academyLevel * 4) + Math.floor(Math.random() * 12));
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
                schule: schule ? schule.key : null,
                schulName: schule ? schule.name : null,
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
        const academyLvl = this.akademieStufe(state, club);

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
    promoteProspect(state, clubId, prospectId, terms = {}) {
        if (!state) return { success: false, error: "Kein State vorhanden." };
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };

        let prospect = club.youthAcademy?.prospects?.find(p => p.id === prospectId);
        if (!prospect && state.youthAcademy?.prospects) {
            prospect = state.youthAcademy.prospects.find(p => p.id === prospectId);
        }
        if (!prospect) return { success: false, error: "Jugendspieler nicht gefunden." };
        if (prospect.promoted) return { success: false, error: "Spieler wurde bereits befördert." };

        // Neuen vollwertigen Spieler in state.players erzeugen.
        // Die IDs der handgepflegten Vereine sind Zahlen, erzeugte Vereine
        // nutzen Text - deshalb wird hier eine eindeutige Text-ID gebildet.
        const newPlayerId = `youth_${clubId}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;

        const playerGen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
        const level = club.level || 1;
        const werte = playerGen && typeof playerGen.getValueAndWage === "function"
            ? playerGen.getValueAndWage(prospect.overall, level, prospect.age || 18)
            : { value: Math.round(prospect.overall * prospect.overall * 1200), wage: 8000 };

        const initialWage = Math.max(120, Math.round(terms.wage ?? werte.wage));
        const initialValue = werte.value;
        const contractYears = Math.max(1, Math.min(5, Math.round(terms.contractYears ?? 3)));

        // Attributprofil passend zur Position statt fester Zufallswerte
        const attribute = (playerGen && typeof playerGen.generateAttributes === "function")
            ? playerGen.generateAttributes(prospect.pos, prospect.overall)
            : {};

        // Die Handschrift der Schule: Ein Talent aus einer Technikschule kommt
        // mit besserem Fuss und schwaecherem Koerper heraus als eines aus einer
        // Athletikschule - gleich stark, aber anders stark.
        this.praegeSchule(attribute, prospect, club);

        const posEngine = _youthResolve("PositionEngine", "./positionEngine.js");
        const nebenpositionen = Array.isArray(prospect.positions) && prospect.positions.length > 0
            ? prospect.positions
            : (posEngine ? posEngine.generateSecondaryPositions(prospect.pos) : []);

        const newPlayer = Object.assign({
            id: newPlayerId,
            name: prospect.name,
            age: prospect.age,
            nationality: prospect.nationality || "Deutschland",
            clubId: clubId,
            pos: prospect.pos,
            secondPos: nebenpositionen[0] || null,
            positions: nebenpositionen,
            overall: prospect.overall,
            pot: prospect.pot,
            trueCurrentAbility: prospect.trueCurrentAbility || prospect.overall * 2,
            truePotentialAbility: prospect.truePotentialAbility || prospect.pot * 2,
            trueMarketValue: initialValue,
            value: initialValue,
            wage: initialWage,
            contractYears: contractYears,
            fitness: 100,
            morale: 88,
            form: 7,
            injured: false,
            injuredWeeks: 0,
            injuryWeeks: 0,
            injuryName: null,
            suspended: false,
            suspendedMatches: 0,
            yellowCards: 0,
            yellowCardsTotal: 0,
            squadRole: "Zukunftstalent",
            // Woher er kommt, bleibt an ihm haengen - ein Eigengewaechs aus
            // der Technikschule ist kein beliebiger Neuzugang.
            schule: prospect.schule || club.akademieProfil || null,
            schulName: prospect.schulName || null,
            eigengewaechsVon: club.id,
            agent: prospect.agent || null,
            happiness: {
                overall: 85,
                playingTime: 80,
                contract: 90,
                teamPerformance: 75,
                training: 85,
                reason: "Glücklich über die Beförderung in die 1. Mannschaft!"
            },
            scoutingKnowledge: {
                known: true,
                knowledgeLevel: 95,
                lastScoutedDate: "Eigene Akademie",
                reportsCount: 0,
                accuracy: 95
            },
            stats: {
                matches: 0, goals: 0, assists: 0, yellowCards: 0,
                redCards: 0, minutes: 0, cleanSheets: 0, ratingSum: 0
            }
        }, attribute);

        state.players.push(newPlayer);
        club.playerIds.push(newPlayer.id);
        prospect.promoted = true;

        if (!terms.skipNews && typeof NewsEngine !== 'undefined' && clubId === state.userClubId) {
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
     * Drückt einem Talent die Handschrift seiner Schule auf.
     *
     * Die Stärken steigen, die Schwächen sinken - in Summe bleibt der Spieler
     * ungefähr gleich stark. Das ist der Unterschied zwischen einer besseren
     * und einer anderen Ausbildung.
     */
    praegeSchule(attribute, prospect, club) {
        if (!attribute) return attribute;

        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        const key = prospect?.schule || club?.akademieProfil;
        const profil = (fac?.AKADEMIE_PROFILE || {})[key];
        if (!profil || !profil.staerken?.length) return attribute;

        const setze = (feld, delta) => {
            if (typeof attribute[feld] !== "number") return;
            attribute[feld] = Math.max(20, Math.min(99, Math.round(attribute[feld] + delta)));
        };

        profil.staerken.forEach(f => setze(f, 5 + Math.floor(Math.random() * 4)));
        (profil.schwaechen || []).forEach(f => setze(f, -(4 + Math.floor(Math.random() * 4))));

        prospect.schulName = profil.name;
        return attribute;
    },

    /**
     * Baut die Jugendakademie aus
     */
    upgradeAcademy(state, clubId) {
        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        if (!fac) return { success: false, error: "Anlagenverwaltung nicht verfügbar." };
        return fac.upgrade(state, clubId, "youthCenter");
    }
};

if (typeof window !== "undefined") {
    window.YouthEngine = YouthEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YouthEngine };
}
