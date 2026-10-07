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
     * Eine runde Schrittweite für einen Geldbetrag: zwei Stellen unter seiner
     * Größenordnung. 150 € gehen in Zehnern, 2.500 € in Hundertern, 25.000 €
     * in Tausendern, 2,5 Mio. in Hunderttausendern.
     */
    schrittFuer(betrag) {
        const b = Math.abs(betrag || 0);
        if (b < 100) return 1;
        return Math.pow(10, Math.floor(Math.log10(b)) - 1);
    },

    /** Die Pfeiltasten eines Eingabefelds gehen feiner als die Rundung */
    eingabeSchritt(betrag) {
        return Math.max(10, this.schrittFuer(betrag) / 10);
    },

    /** Ein Betrag, gerundet auf seine Schrittweite */
    rundeBetrag(betrag) {
        const schritt = this.schrittFuer(betrag);
        return Math.round((betrag || 0) / schritt) * schritt;
    },

    /**
     * Ermittelt die Gehaltsforderung eines Spielers für eine Vertragsverlängerung.
     *
     * Vorher galt ein Mindestgehalt von 10.000 € pro Woche, gerundet auf
     * Tausender - gedacht für die Bundesliga. Ein Landesligaspieler mit 120 €
     * forderte damit plötzlich 10.000 €. Jetzt richtet sich die Forderung
     * nach dem, was er verdient, und nach dem, was ein Spieler seiner Stärke
     * in dieser Liga bekommt: Wer unter Wert bezahlt ist, will aufholen; wer
     * über Wert bezahlt ist und älter wird, gibt etwas nach. Stammspieler
     * und Talente schlagen darauf auf - gemessen am eigenen Kader, nicht an
     * festen Grenzen, die nur in der Bundesliga jemand erreicht.
     *
     * Mit state wird die Stellung im Kader gemessen (vereinsNiveau); ohne
     * fällt dieser Aufschlag weg.
     */
    getExtensionDemand(player, club, state = null) {
        if (!player) return { demandWage: 20000, preferredYears: 3, preferredRole: "Stammspieler" };

        const alter = player.age || 25;
        const gen = _ceResolve("PlayerGenerator", "./playerGenerator.js");
        const markt = gen && typeof gen.getValueAndWage === "function"
            ? gen.getValueAndWage(player.overall || 50, club?.level || 1, alter).wage
            : null;
        const aktuell = player.wage || markt || 25000;

        let basis = aktuell;
        if (markt && aktuell < markt) basis = aktuell + (markt - aktuell) * 0.7;
        else if (markt && alter >= 31) basis = Math.max(markt, aktuell * 0.9);

        const niveau = state && club
            ? this.vereinsNiveau(club, new Map((state.players || []).map(p => [p.id, p])))
            : null;
        const staerke = niveau !== null ? (player.overall || 50) - niveau : null;

        let mult = 1.1;
        // Junge Spieler mit Luft nach oben wissen, was sie wert werden
        if (alter <= 23 && player.pot > player.overall) {
            mult += Math.min(0.3, (player.pot - player.overall) * 0.015);
        }
        if (staerke !== null) {
            if (staerke >= 3) mult += 0.15;
            else if (staerke >= 0) mult += 0.05;
        }
        if (alter >= 33) mult -= 0.10;
        // Liegt ein Angebot für einen Vorvertrag auf dem Tisch, weiß er das
        if (player.vorvertragInteresse) mult += 0.1;

        const demandWage = Math.max(100, this.rundeBetrag(basis * mult));
        let preferredRole = "Stammspieler";
        if (staerke !== null) {
            if (staerke >= 3) preferredRole = "Schlüsselspieler";
            else if (staerke < -5) preferredRole = "Rotationsspieler";
        }

        return {
            demandWage: demandWage,
            demandWageFormatted: (typeof Formatters !== 'undefined') ? Formatters.formatMoney(demandWage) : `${demandWage} €`,
            preferredYears: alter >= 32 ? 2 : 3,
            preferredRole: preferredRole
        };
    },

    /**
     * Verhandelt eine Vertragsverlängerung mit einem Spieler
     */
    /**
     * Was eine Ausstiegsklausel dem Spieler wert ist: Je niedriger sie im
     * Verhältnis zum Marktwert liegt, desto eher verzichtet er auf Gehalt -
     * ein ehrgeiziger Spieler mehr als ein treuer. Gibt den Faktor auf die
     * Gehaltsforderung zurück.
     */
    klauselRabatt(player, klausel) {
        if (!klausel || klausel <= 0) return 1;
        const verhaeltnis = klausel / Math.max(1, player?.value || 1);
        let rabatt = verhaeltnis <= 1.6 ? 0.1 : (verhaeltnis <= 2.6 ? 0.06 : 0.03);
        if ((player?.hiddenAttributes?.ambition ?? 12) >= 15) rabatt += 0.02;
        return 1 - rabatt;
    },

    negotiateExtension(player, club, offeredWage, offeredYears, offeredRole, klausel = 0, state = null) {
        if (!player || !club) return { success: false, reason: "Ungültige Parameter." };
        // In der Sommerpause hat er woanders unterschrieben - zu spät
        if (player.vorvertrag) {
            return { success: false, reason: `${player.name} hat bereits bei ${player.vorvertrag.clubName} unterschrieben und geht zum Saisonwechsel.` };
        }

        const demand = this.getExtensionDemand(player, club, state);
        // Eine Ausstiegsklausel senkt die Forderung
        const rabatt = this.klauselRabatt(player, klausel);
        if (rabatt < 1) {
            demand.demandWage = this.rundeBetrag(demand.demandWage * rabatt);
            demand.demandWageFormatted = (typeof Formatters !== 'undefined') ? Formatters.formatMoney(demand.demandWage) : `${demand.demandWage} €`;
        }

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

        // Vertrag erfolgreich verlängert - eine offene Anfrage ist damit erledigt
        delete player.vorvertragInteresse;
        player.wage = Math.round(offeredWage);
        player.contractYears = offeredYears;
        // Wer gerade verlängert hat, hört zum Saisonwechsel nicht auf
        if (state && typeof state.seasonYear === "number") player.verlaengertSaison = state.seasonYear;
        if (offeredRole) player.squadRole = offeredRole;
        // Der neue Vertrag ersetzt die alte Klausel - mit oder ohne neue
        player.ausstiegsklausel = klausel > 0 ? Math.round(klausel) : 0;

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
     * Das Niveau eines Kaders: der Schnitt seiner vierzehn Besten, also
     * Stammelf und erste Wechsel. Daran misst ein Verein, wen er hält und wen
     * er holt.
     *
     * Vorher galten feste Grenzen, die nur zur Bundesliga passten (Kader
     * dort um 80): "wichtig ab 55" traf in der Landesliga (um 23) niemanden.
     * Dort ließen die Vereine deshalb jeden zweiten auslaufenden Vertrag
     * platzen, und die Lücken füllten Vereinslose aus höheren Ligen - die
     * Landesliga wurde Saison für Saison stärker. Die Grenzen relativ zum
     * Niveau entsprechen den alten für einen Bundesligakader.
     */
    vereinsNiveau(club, spielerNach) {
        const ovr = (club?.playerIds || []).map(id => spielerNach.get(id)).filter(Boolean)
            .map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 14);
        return ovr.length ? ovr.reduce((a, b) => a + b, 0) / ovr.length : null;
    },

    /** Vereins-ID -> Niveau, für alle Vereine auf einmal */
    niveauKarte(state) {
        const spielerNach = new Map((state?.players || []).map(p => [p.id, p]));
        const karte = new Map();
        (state?.clubs || []).forEach(c => {
            const n = this.vereinsNiveau(c, spielerNach);
            if (n !== null) karte.set(c.id, n);
        });
        return karte;
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

        const niveau = this.niveauKarte(state);
        let verlaengert = 0;
        state.players.forEach(p => {
            if (!p.clubId || p.clubId === state.userClubId) return;
            if ((p.contractYears ?? 0) !== 1 || p.vorvertrag) return;

            // Stärke gemessen am eigenen Kader - siehe vereinsNiveau
            const staerke = (p.overall || 50) - (niveau.get(p.clubId) ?? 80);
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
            if (staerke >= -10) chance += 0.35;
            else if (staerke >= -20) chance += 0.22;
            else if (staerke >= -28) chance += 0.10;

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
