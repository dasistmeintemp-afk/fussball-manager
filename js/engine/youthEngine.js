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

    /**
     * Schwerpunkte der Akademie, die der Manager selbst setzt.
     *
     * Die Ausbildung (Technik, Athletik ...) prägt, WIE die Talente spielen.
     * Die Positionen bestimmen, WAS nachkommt, der Jahrgang, ob viele oder
     * wenige, dafür bessere kommen, und das Einzugsgebiet, wie weit die
     * Sichter reisen - das kostet, bringt aber mehr Potenzial.
     */
    SCHWERPUNKT_POSITIONEN: {
        TW: { name: "Torhüter", positionen: ["TW"] },
        ABW: { name: "Abwehr", positionen: ["IV", "LV", "RV"] },
        MF: { name: "Mittelfeld", positionen: ["DM", "ZM", "OM", "LM", "RM"] },
        ST: { name: "Angriff", positionen: ["ST", "LA", "RA"] }
    },
    JAHRGAENGE: {
        breite: { name: "Breite", anzahl: 5, pot: -4, ovr: -1, text: "Fünf Talente, im Schnitt etwas weniger Potenzial" },
        normal: { name: "Ausgewogen", anzahl: 3, pot: 0, ovr: 0, text: "Drei Talente wie gewohnt" },
        spitze: { name: "Spitze", anzahl: 2, pot: 5, ovr: 1, text: "Nur zwei Talente, dafür mit deutlich mehr Potenzial" }
    },
    EINZUG: {
        region: { name: "Region", kosten: 0, pot: 0, heimat: 0.9, text: "Talente aus dem Umland - kostet nichts" },
        national: { name: "National", kosten: 300000, pot: 2, heimat: 0.75, text: "Sichter im ganzen Land - etwas mehr Potenzial" },
        international: { name: "International", kosten: 1000000, pot: 4, heimat: 0.4, text: "Weltweites Sichtungsnetz - das meiste Potenzial" }
    },
    WELT_NATIONEN: ["Brasilien", "Argentinien", "Frankreich", "Niederlande", "Portugal", "Belgien", "Spanien", "Italien",
        "Kroatien", "Serbien", "Dänemark", "Schweden", "Nigeria", "Ghana", "Senegal", "Elfenbeinküste", "Japan",
        "Südkorea", "USA", "Kolumbien", "Uruguay", "Polen", "Österreich", "Schweiz"],

    /** Was die Sichtung je Jahrgang kostet - kleine Ligen zahlen weniger */
    einzugKosten(club, key) {
        const basis = (this.EINZUG[key] || this.EINZUG.region).kosten;
        const faktor = { 1: 1, 2: 0.6, 3: 0.35, 4: 0.2, 5: 0.12, 6: 0.08, 7: 0.05 }[club?.level || 1] ?? 0.1;
        return Math.round(basis * faktor / 1000) * 1000;
    },

    /** Die aktuellen Schwerpunkte - fehlen sie, gilt die bisherige Ausbildung */
    schwerpunkteVon(club) {
        const sp = club?.akademieSchwerpunkte || {};
        return {
            profil: club?.akademieProfil || sp.profil || "ausgewogen",
            positionen: Array.isArray(sp.positionen) ? sp.positionen.filter(k => this.SCHWERPUNKT_POSITIONEN[k]).slice(0, 2) : [],
            jahrgang: this.JAHRGAENGE[sp.jahrgang] ? sp.jahrgang : "normal",
            einzug: this.EINZUG[sp.einzug] ? sp.einzug : "region",
            profilSaison: sp.profilSaison ?? null
        };
    },

    /**
     * Setzt die Schwerpunkte der eigenen Akademie. Sie wirken auf den
     * nächsten Jahrgang - wer schon da ist, bleibt, wie er ausgebildet wurde.
     *
     * Die Ausbildungsphilosophie lässt sich nur einmal je Saison ändern:
     * Trainer, Übungen und Sichtung stellt man nicht jede Woche um.
     */
    setzeSchwerpunkte(state, clubId, aenderung = {}) {
        const club = (state?.clubs || []).find(c => c.id === clubId);
        if (!club) return { ok: false, meldung: "Verein nicht gefunden." };
        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        const profile = fac?.AKADEMIE_PROFILE || {};
        const jetzt = this.schwerpunkteVon(club);
        const saison = state.seasonYear || 1;
        const neu = { ...jetzt };

        if (aenderung.profil !== undefined && aenderung.profil !== jetzt.profil) {
            if (!profile[aenderung.profil]) return { ok: false, meldung: "Unbekannte Ausbildung." };
            if (jetzt.profilSaison === saison) {
                return { ok: false, meldung: "Die Ausbildung wurde in dieser Saison schon umgestellt." };
            }
            neu.profil = aenderung.profil;
            neu.profilSaison = saison;
            club.akademieProfil = aenderung.profil;
        }
        if (aenderung.positionen !== undefined) {
            const liste = [...new Set((aenderung.positionen || []).filter(k => this.SCHWERPUNKT_POSITIONEN[k]))];
            if (liste.length > 2) return { ok: false, meldung: "Höchstens zwei Positionsschwerpunkte." };
            neu.positionen = liste;
        }
        if (aenderung.jahrgang !== undefined) {
            if (!this.JAHRGAENGE[aenderung.jahrgang]) return { ok: false, meldung: "Unbekannte Jahrgangsgröße." };
            neu.jahrgang = aenderung.jahrgang;
        }
        if (aenderung.einzug !== undefined) {
            if (!this.EINZUG[aenderung.einzug]) return { ok: false, meldung: "Unbekanntes Einzugsgebiet." };
            neu.einzug = aenderung.einzug;
        }

        club.akademieSchwerpunkte = {
            profil: neu.profil,
            positionen: neu.positionen,
            jahrgang: neu.jahrgang,
            einzug: neu.einzug,
            profilSaison: neu.profilSaison
        };
        return { ok: true, schwerpunkte: this.schwerpunkteVon(club), kosten: this.einzugKosten(club, neu.einzug) };
    },

    /**
     * Güte des Nachwuchsleiters (nur beim eigenen Verein, der einen Stab
     * führt). Er entscheidet mit, wie gut ein Jahrgang wird und wie schnell
     * sich die Jungs entwickeln.
     */
    nachwuchsleiterGuete(state, club) {
        if (!club || !state || club.id !== state.userClubId) return null;
        const stab = _youthResolve("CoachingStaffEngine", "./coachingStaffEngine.js");
        return stab && typeof stab.staffQuality === "function" ? stab.staffQuality(club).nachwuchs : null;
    },

    /** Das Land des Vereins, in Worten wie bei den Nationalitäten */
    heimatland(state, club) {
        const daten = (typeof COUNTRIES_DATA !== "undefined" && COUNTRIES_DATA)
            ? COUNTRIES_DATA
            : ((typeof window !== "undefined" && window.COUNTRIES_DATA) ? window.COUNTRIES_DATA
                : (typeof require !== "undefined" ? (() => { try { return require("../data/leagueData.js").COUNTRIES_DATA; } catch (e) { return null; } })() : null));
        const land = (daten || []).find(c => c.id === (club?.countryId || "de"));
        return land ? land.name : "Deutschland";
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

        // Die eigenen Schwerpunkte gelten nur für den Verein des Managers -
        // die KI-Vereine ziehen ihre Jahrgänge wie gewohnt nach
        const eigen = clubId === state.userClubId && !!club;
        const sp = eigen ? this.schwerpunkteVon(club) : null;
        const jahrgang = this.JAHRGAENGE[sp?.jahrgang || "normal"];
        const einzug = this.EINZUG[sp?.einzug || "region"];
        const leiter = this.nachwuchsleiterGuete(state, club);
        // Ein guter Nachwuchsleiter holt mehr heraus, ein schwacher weniger
        const leiterBonus = leiter === null ? 0 : Math.round((leiter - 60) * 0.1);

        // Die Sichtung kostet - abgebucht, wenn der Jahrgang kommt
        if (eigen && einzug.kosten > 0) {
            const kosten = this.einzugKosten(club, sp.einzug);
            if (kosten > 0) {
                club.balance = (club.balance || 0) - kosten;
                const fin = _youthResolve("FinanceEngine", "./financeEngine.js");
                if (fin && typeof fin.recordTransaction === "function") {
                    fin.recordTransaction(state, clubId, "youth_scouting", -kosten, `Nachwuchssichtung (${einzug.name})`);
                }
            }
        }

        // Die Schule zieht ihre Lieblingspositionen häufiger - aber nie allein.
        // Gesetzte Positionsschwerpunkte wiegen noch schwerer.
        const positions = ["TW", "IV", "LV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"];
        const bevorzugt = (schule && this.SCHUL_POSITIONEN[schule.key]) || [];
        let posTopf = positions.concat(bevorzugt, bevorzugt);
        (sp?.positionen || []).forEach(k => {
            const gruppe = this.SCHWERPUNKT_POSITIONEN[k].positionen;
            // Torhüter gibt es nur einen, darum stärker gewichtet
            const gewicht = k === "TW" ? 8 : 4;
            for (let i = 0; i < gewicht; i++) posTopf = posTopf.concat(gruppe);
        });
        const namePools = (typeof NAME_POOLS !== 'undefined') ? NAME_POOLS : (typeof window !== 'undefined' ? window.NAME_POOLS : (typeof require !== 'undefined' ? require('../data/namePools.js').NAME_POOLS : {}));
        const poolFirst = (namePools && namePools.firstNames) ? namePools.firstNames : ["Max", "Lukas", "Leon", "Finn", "Elias"];
        const poolLast = (namePools && namePools.lastNames) ? namePools.lastNames : ["Müller", "Schmidt", "Weber", "Bauer", "Fischer"];
        const poolNat = (namePools && namePools.nationalities) ? namePools.nationalities : ["Deutschland"];

        // Woher die Talente kommen, hängt am Einzugsgebiet
        const heimat = eigen ? this.heimatland(state, club) : null;
        const waehleNation = () => {
            if (!eigen || !heimat) return poolNat[Math.floor(Math.random() * poolNat.length)];
            if (Math.random() < einzug.heimat) return heimat;
            const welt = sp.einzug === "international" ? this.WELT_NATIONEN : poolNat;
            return welt[Math.floor(Math.random() * welt.length)];
        };

        const newProspects = [];
        const count = eigen ? jahrgang.anzahl : 3;

        for (let i = 0; i < count; i++) {
            const firstName = poolFirst[Math.floor(Math.random() * poolFirst.length)];
            const lastName = poolLast[Math.floor(Math.random() * poolLast.length)];
            const nat = waehleNation();
            const pos = posTopf[Math.floor(Math.random() * posTopf.length)];
            const age = 15 + Math.floor(Math.random() * 3); // 15, 16 oder 17

            // Gesamtstärke und Potenzial abhängig vom Akademie-Level (C2 & C7),
            // beim eigenen Verein dazu Jahrgang, Einzugsgebiet und Nachwuchsleiter
            const potPlus = eigen ? jahrgang.pot + einzug.pot + leiterBonus : 0;
            const baseOvr = Math.round(50 + (academyLevel * 3) + Math.floor(Math.random() * 8) + (eigen ? jahrgang.ovr : 0));
            const basePot = Math.round(72 + (academyLevel * 4) + Math.floor(Math.random() * 12) + potPlus);
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
        const leiter = this.nachwuchsleiterGuete(state, club);

        const prospects = (club?.youthAcademy?.prospects) || (clubId === state.userClubId ? state.youthAcademy?.prospects : []);
        if (!Array.isArray(prospects)) return;

        prospects.forEach(prospect => {
            if (prospect.promoted || prospect.clubId !== clubId) return;

            // Chance auf Attributssteigerung abhängig vom Level - und beim
            // eigenen Verein vom Nachwuchsleiter
            const growthChance = 0.20 + (academyLvl * 0.05) + (leiter === null ? 0 : (leiter - 60) * 0.002);
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
