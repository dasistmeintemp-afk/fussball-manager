/**
 * CoachingStaffEngine - Trainerstab, Trainingsplanung und das Veto des Managers
 *
 * Ein Manager stellt keine Hütchen auf. Er stellt einen Stab ein, gibt die
 * Richtung vor und greift ein, wenn ihm etwas nicht passt. Genau so läuft es
 * jetzt: Der Fitnesstrainer plant jeden Tag selbst - nach Kondition, Ausfällen
 * und dem nächsten Gegner - und der Manager kann jederzeit ein Veto einlegen.
 *
 * Wie gut der Stab dabei ist, hängt an der Ligastufe, am Trainingsgelände und
 * am Ruf des Vereins. Ein Landesligist hat einen Übungsleiter mit
 * Trainerschein, ein Spitzenklub eine ganze Abteilung.
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _csResolve = (globalName, path) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[globalName]; } catch (e) { return null; }
    }
    return null;
};

class CoachingStaffEngine {
    /** Wie lange ein Veto des Managers gilt, bevor der Stab wieder übernimmt */
    static VETO_DAUER_TAGE = 7;

    /** Titel des Stabs je nach Güte */
    static STAB_STUFEN = [
        { ab: 82, titel: "Weltklasse-Trainerteam", kurz: "Weltklasse" },
        { ab: 68, titel: "Erfahrener Profistab", kurz: "Erfahren" },
        { ab: 54, titel: "Solider Trainerstab", kurz: "Solide" },
        { ab: 40, titel: "Kleiner Trainerstab", kurz: "Klein" },
        { ab: 0, titel: "Übungsleiter mit Trainerschein", kurz: "Amateur" }
    ];

    /**
     * Güte des Trainerstabs eines Vereins.
     *
     * Die Ligastufe gibt den Rahmen vor, das Trainingsgelände und der Ruf
     * verschieben ihn. Daraus ergeben sich die einzelnen Fachbereiche.
     */
    static staffQuality(club) {
        if (!club) return { overall: 50, fitness: 50, analyse: 50, medizin: 50, nachwuchs: 50, titel: "Trainerstab", kurz: "Solide" };

        const STUFEN_BASIS = { 1: 74, 2: 64, 3: 56, 4: 48, 5: 42, 6: 37, 7: 33 };
        const basis = STUFEN_BASIS[club.level || 1] ?? 45;

        const gelaende = club.facilities?.trainingGround || 2;
        const medizin = club.facilities?.medicalCenter || 1;
        const jugend = club.facilities?.youthCenter || 1;
        const ruf = club.reputation || 50;

        const overall = Math.max(15, Math.min(96, Math.round(
            basis + (gelaende - 2) * 2.6 + (ruf - 50) * 0.13
        )));

        const stufe = this.STAB_STUFEN.find(s => overall >= s.ab) || this.STAB_STUFEN[this.STAB_STUFEN.length - 1];

        return {
            overall,
            fitness: Math.max(10, Math.min(97, Math.round(overall + (gelaende - 2) * 3))),
            analyse: Math.max(10, Math.min(97, Math.round(overall + (ruf - 50) * 0.12))),
            medizin: Math.max(10, Math.min(97, Math.round(overall + (medizin - 1) * 5))),
            nachwuchs: Math.max(10, Math.min(97, Math.round(overall + (jugend - 1) * 5))),
            titel: stufe.titel,
            kurz: stufe.kurz,
            // Wie stark der Stab die Entwicklung der Spieler beschleunigt.
            // Ein Amateurstab bremst spürbar, ein Weltklasseteam beschleunigt.
            entwicklungsFaktor: Math.max(0.55, Math.min(1.45, 0.55 + (overall / 100) * 0.95))
        };
    }

    /** Liegt ein gültiges Veto des Managers vor? */
    static activeVeto(state) {
        const veto = state?.trainingSettings?.managerVeto;
        if (!veto || !veto.focus || (veto.daysRemaining || 0) <= 0) return null;
        return veto;
    }

    /**
     * Der Manager übergeht den Stab. Die Vorgabe gilt für einige Tage, danach
     * übernimmt der Trainerstab wieder von selbst.
     */
    static setManagerVeto(state, focus, intensity, tage = null) {
        if (!state) return null;
        if (!state.trainingSettings) state.trainingSettings = {};

        state.trainingSettings.managerVeto = {
            focus: focus || state.trainingSettings.focus || "allround",
            intensity: intensity || state.trainingSettings.intensity || "normal",
            daysRemaining: tage ?? this.VETO_DAUER_TAGE,
            setAt: state.currentDate || null
        };
        state.trainingSettings.focus = state.trainingSettings.managerVeto.focus;
        state.trainingSettings.intensity = state.trainingSettings.managerVeto.intensity;

        return state.trainingSettings.managerVeto;
    }

    /** Der Manager gibt das Training wieder aus der Hand */
    static clearManagerVeto(state) {
        if (state?.trainingSettings) state.trainingSettings.managerVeto = null;
    }

    /**
     * Wie fit ist die Mannschaft, und was drückt gerade?
     */
    static squadCondition(state, club) {
        const kader = (club?.playerIds || [])
            .map(id => state.players.find(p => p.id === id))
            .filter(Boolean);

        const einsatzbereit = kader.filter(p => (p.injuredWeeks || 0) <= 0);
        const fitness = einsatzbereit.length
            ? einsatzbereit.reduce((s, p) => s + (p.fitness ?? 100), 0) / einsatzbereit.length
            : 100;
        const schaerfe = einsatzbereit.length
            ? einsatzbereit.reduce((s, p) => s + (p.matchSharpness ?? 60), 0) / einsatzbereit.length
            : 60;

        return {
            kaderGroesse: kader.length,
            einsatzbereit: einsatzbereit.length,
            verletzt: kader.length - einsatzbereit.length,
            fitness: Math.round(fitness * 10) / 10,
            schaerfe: Math.round(schaerfe * 10) / 10,
            jung: kader.filter(p => (p.age || 25) <= 21).length,
            muede: einsatzbereit.filter(p => (p.fitness ?? 100) < 72).map(p => p.name)
        };
    }

    /**
     * Wo drückt der Schuh sportlich? Ergibt sich aus der eigenen Bilanz.
     */
    static sportlicheSchwaeche(state, club) {
        const tabelle = state.standings || [];
        const eigen = tabelle.find(e => e.clubId === club.id);
        if (!eigen || (eigen.played || 0) < 3) return null;

        const schnittFuer = eigen.goalsFor / eigen.played;
        const schnittGegen = eigen.goalsAgainst / eigen.played;

        if (schnittGegen >= 1.8 && schnittGegen > schnittFuer) return "defense";
        if (schnittFuer <= 0.9) return "attack";
        return null;
    }

    /**
     * Der Trainerstab plant den Tag.
     *
     * Zuerst zählt die Kondition: Wer ausgelaugt ist, wird nicht noch härter
     * rangenommen. Danach der Kalender - vor dem Spiel wird angeschwitzt, nicht
     * geschunden. Erst dann kommt die sportliche Baustelle.
     */
    static planTraining(state, dayType = "training") {
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!club) return null;

        const stab = this.staffQuality(club);
        const lage = this.squadCondition(state, club);

        let intensity = "normal";
        let focus = "allround";
        let grund = "Ausgewogene Einheit, es steht nichts Besonderes an.";

        // 1. Erholungs- und Medientage sind gesetzt
        if (dayType === "recovery" || dayType === "rest") {
            intensity = "low";
            focus = "regeneration";
            grund = "Regenerationstag - Auslaufen, Massage, keine Belastung.";
        }
        // 2. Am Tag vor dem Spiel wird nur noch angeschwitzt
        else if (dayType === "opponent_analysis") {
            intensity = "low";
            focus = "tactics";
            grund = "Abschlusstraining vor dem Spieltag: Standards und Frische, keine Substanz verbrennen.";
        }
        else if (dayType === "media" || dayType === "sponsor") {
            intensity = "low";
            focus = "regeneration";
            grund = "Termintag - die Einheit bleibt kurz.";
        }
        // 3. Der Zustand des Kaders schlägt alles andere
        else if (lage.fitness < 74) {
            intensity = "low";
            focus = "regeneration";
            grund = `Die Mannschaft ist ausgelaugt (Ø ${lage.fitness} % Kondition). Wir nehmen Last raus.`;
        }
        else if (lage.verletzt >= 4) {
            intensity = "low";
            focus = "fitness";
            grund = `${lage.verletzt} Ausfälle im Kader - wir fahren die Intensität herunter und arbeiten an der Robustheit.`;
        }
        else if (lage.fitness < 84) {
            intensity = "normal";
            focus = "fitness";
            grund = `Die Kondition liegt bei Ø ${lage.fitness} %. Wir halten die Belastung im Rahmen und arbeiten an der Grundlage.`;
        }
        // 4. Frischer Kader: Zeit für die eigentliche Arbeit
        else {
            const schwaeche = this.sportlicheSchwaeche(state, club);
            intensity = lage.fitness >= 91 ? "high" : "normal";

            if (schwaeche === "defense") {
                focus = "defense";
                grund = "Wir kassieren zu viele Gegentore. Diese Woche steht die Defensivordnung im Mittelpunkt.";
            } else if (schwaeche === "attack") {
                focus = "attack";
                grund = "Vorne fehlt der Ertrag. Wir arbeiten am Abschluss und am letzten Pass.";
            } else if (lage.schaerfe < 55) {
                focus = "fitness";
                grund = `Die Spielschärfe ist niedrig (Ø ${lage.schaerfe}). Wir bringen Tempo in die Einheiten.`;
            } else if ((club.chemistry?.tacticalFamiliarity || 70) < 72) {
                focus = "tactics";
                grund = "Die taktische Vertrautheit ist noch dünn. Wir schulen Abläufe und Automatismen.";
            } else if (lage.jung >= 5 && stab.nachwuchs >= 55) {
                focus = "youth";
                grund = "Der Kader ist jung und der Stab traut sich zu, die Talente gezielt weiterzubringen.";
            } else {
                focus = "allround";
                grund = intensity === "high"
                    ? "Der Kader ist topfit - wir nutzen die Woche für eine harte, breite Einheit."
                    : "Ausgewogene Einheit ohne besonderen Schwerpunkt.";
            }
        }

        // 5. Ein schwacher Stab trifft nicht immer die richtige Wahl
        const trefferquote = 0.55 + (stab.fitness / 100) * 0.45;
        let danebengegriffen = false;
        if (Math.random() > trefferquote && dayType === "training") {
            const alternativen = ["allround", "attack", "defense", "technique", "fitness"];
            focus = alternativen[Math.floor(Math.random() * alternativen.length)];
            grund = `${stab.titel}: Der Stab setzt auf ${this.focusLabel(focus)} - eine Einschätzung, über die man streiten kann.`;
            danebengegriffen = true;
        }

        return { focus, intensity, grund, stab, lage, danebengegriffen };
    }

    /**
     * Setzt den Tagesplan - es sei denn, der Manager hat ein Veto eingelegt.
     * Gibt zurück, was heute trainiert wird und warum.
     */
    static applyDailyPlan(state, dayType = "training") {
        if (!state) return null;
        if (!state.trainingSettings) state.trainingSettings = { focus: "allround", intensity: "normal" };

        const veto = this.activeVeto(state);
        if (veto) {
            veto.daysRemaining = Math.max(0, veto.daysRemaining - 1);
            state.trainingSettings.focus = veto.focus;
            state.trainingSettings.intensity = veto.intensity;

            const auslaufend = veto.daysRemaining === 0;
            if (auslaufend) state.trainingSettings.managerVeto = null;

            const plan = {
                focus: veto.focus,
                intensity: veto.intensity,
                vomManager: true,
                daysRemaining: veto.daysRemaining,
                grund: auslaufend
                    ? "Umgesetzt wie angewiesen. Ab morgen übernimmt wieder der Trainerstab."
                    : `Der Stab führt Ihre Anweisung aus - noch ${veto.daysRemaining} Tag(e), dann plant er wieder selbst.`
            };
            state.trainingSettings.lastPlan = plan;
            return plan;
        }

        const vorschlag = this.planTraining(state, dayType);
        if (!vorschlag) return null;

        state.trainingSettings.focus = vorschlag.focus;
        state.trainingSettings.intensity = vorschlag.intensity;

        const plan = {
            focus: vorschlag.focus,
            intensity: vorschlag.intensity,
            vomManager: false,
            stabTitel: vorschlag.stab.titel,
            stabGuete: vorschlag.stab.overall,
            grund: vorschlag.grund,
            danebengegriffen: vorschlag.danebengegriffen
        };
        state.trainingSettings.lastPlan = plan;
        return plan;
    }

    static focusLabel(focus) {
        const LABELS = {
            allround: "Allroundtraining",
            attack: "Offensive",
            defense: "Defensive",
            technique: "Technik",
            tactics: "Taktik",
            fitness: "Athletik",
            youth: "Nachwuchsförderung",
            regeneration: "Regeneration"
        };
        return LABELS[focus] || focus;
    }

    static intensityLabel(intensity) {
        const LABELS = { low: "locker", normal: "normal", high: "intensiv" };
        return LABELS[intensity] || intensity;
    }
}

if (typeof window !== "undefined") {
    window.CoachingStaffEngine = CoachingStaffEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { CoachingStaffEngine };
}
