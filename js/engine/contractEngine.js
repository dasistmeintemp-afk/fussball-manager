/**
 * ContractEngine - Vertragsverhandlungen, Gehaltsforderungen, auslaufende Verträge
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _ceResolve = (globalName, path) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[globalName]; } catch (e) { return null; }
    }
    return null;
};

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

        const newsEngine = _ceResolve("NewsEngine", "./newsEngine.js");
        const auslaufend = [];

        state.players.forEach(p => {
            if (p.contractYears !== undefined) {
                p.contractYears = Math.max(0, p.contractYears - 1);
            }

            // Auslaufende Verträge des Spielervereins warnen
            if (p.clubId === state.userClubId && p.contractYears === 1) auslaufend.push(p);
        });

        // Die KI-Vereine verlängern, bevor der Vertrag ausläuft
        this.verlaengereBeiKiVereinen(state);

        if (newsEngine && typeof newsEngine.addMessage === 'function') {
            auslaufend.forEach(p => {
                newsEngine.addMessage(state, "contract_expiring", {
                    title: `Auslaufender Vertrag: ${p.name}`,
                    sender: "Sportdirektor",
                    text: `Der Vertrag von ${p.name} läuft am Ende dieser Saison aus. Verhandeln Sie zeitnah eine Verlängerung, um einen ablösefreien Abgang zu verhindern.`,
                    priority: "high",
                    relatedEntity: { playerId: p.id }
                });
            });
        }

        return auslaufend;
    },

    /**
     * Wie lange ein neuer Vertrag läuft - nach Alter, nicht nach Zufall.
     *
     * Ein Zwanzigjähriger unterschreibt lang, ein Zweiunddreißigjähriger wird
     * von Jahr zu Jahr verlängert.
     */
    laufzeitFuer(player) {
        const alter = player?.age || 25;
        if (alter <= 22) return 4 + Math.floor(Math.random() * 2);   // 4-5 Jahre
        if (alter <= 27) return 3 + Math.floor(Math.random() * 2);   // 3-4 Jahre
        if (alter <= 30) return 2 + Math.floor(Math.random() * 2);   // 2-3 Jahre
        return 1 + Math.floor(Math.random() * 2);                    // 1-2 Jahre
    },

    /**
     * Die KI verlängert, bevor ein Vertrag ausläuft - nicht erst danach.
     *
     * Vorher wurde ein Vertrag erst verlängert, wenn er schon auf null stand,
     * und dann nur um ein bis drei Jahre. Weil jede Saison ein Jahr abgeht,
     * rutschte damit die ganze Spielwelt ins letzte Vertragsjahr: Zu Beginn
     * lagen die Restlaufzeiten noch gleichmäßig bei ein bis vier Jahren
     * (24/26/25/25 %), eine Saison später gab es praktisch keinen
     * Vierjahresvertrag mehr (32/32/32/3 %), und nach drei Saisons standen
     * 82 % aller Spieler im letzten Jahr. In Wirklichkeit sind das eher 25
     * bis 30 %.
     *
     * Der eigene Verein bleibt ausgenommen - dort entscheidet der Manager.
     */
    verlaengereBeiKiVereinen(state) {
        if (!state || !Array.isArray(state.players)) return 0;

        let verlaengert = 0;
        state.players.forEach(p => {
            if (!p.clubId || p.clubId === state.userClubId) return;
            if ((p.contractYears ?? 0) !== 1) return;

            const staerke = p.overall || 50;
            const alter = p.age || 25;

            // Wen ein Verein halten will: wer stark ist, oder jung genug, um
            // noch besser zu werden. Wer alt und schwach ist, läuft aus.
            //
            // Der Sockel ist bewusst hoch: Ein Verein verlängert mit dem
            // Großteil seines Kaders, sonst müsste er ihn jede Saison neu
            // zusammenkaufen. Mit einem Sockel von 0.35 wurde rund jeder
            // zweite Durchschnittsspieler nicht verlängert - nach drei
            // Saisons trieben 387 Vereinslose durch die Welt.
            let chance = 0.48;
            if (staerke >= 70) chance += 0.35;
            else if (staerke >= 60) chance += 0.22;
            else if (staerke >= 52) chance += 0.10;

            if (alter <= 23) chance += 0.20;
            else if (alter >= 33) chance -= 0.35;
            else if (alter >= 30) chance -= 0.15;

            if (Math.random() > Math.max(0.05, Math.min(0.94, chance))) return;

            p.contractYears = this.laufzeitFuer(p);
            verlaengert++;
        });
        return verlaengert;
    }
};

if (typeof window !== "undefined") {
    window.ContractEngine = ContractEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ContractEngine };
}
