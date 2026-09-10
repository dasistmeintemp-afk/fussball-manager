/**
 * RivalryEngine - Derbys, Rivalitäten und was daran hängt
 *
 * Ein Spieltag fühlte sich an wie der nächste. Dabei weiß jeder, der einmal in
 * ein Stadion gegangen ist, dass es Spiele gibt, die anders sind: das Derby
 * gegen den Nachbarn, das Duell mit dem alten Erzfeind. Volles Haus, lautere
 * Kurve, härtere Zweikämpfe - und hinterher zählt das Ergebnis doppelt.
 *
 * Dafür muss niemand etwas lernen oder einstellen. Es steht im Spielplan,
 * es steht im Vorbericht, und man merkt es an der Stimmung danach.
 */

class RivalryEngine {
    /**
     * Feste Rivalitäten der handgepflegten Vereine.
     *
     * Bewusst nur die, die auch jemand kennt, der nur gelegentlich Fußball
     * schaut - alles Weitere entsteht ohnehin aus der Nachbarschaft.
     */
    static FESTE_RIVALITAETEN = [
        { paar: ["dor", "s04"], titel: "Revierderby", schaerfe: 3 },
        { paar: ["muc", "dor"], titel: "Der Klassiker", schaerfe: 3 },
        { paar: ["muc", "n1860"], titel: "Münchner Stadtderby", schaerfe: 3 },
        { paar: ["koe", "b04"], titel: "Rheinisches Derby", schaerfe: 2 },
        { paar: ["koe", "bmg"], titel: "Rheinisches Derby", schaerfe: 3 },
        { paar: ["bmg", "dor"], titel: "Borussen-Duell", schaerfe: 2 },
        { paar: ["hsv", "svw"], titel: "Nordderby", schaerfe: 3 },
        { paar: ["fcu", "her"], titel: "Berliner Stadtderby", schaerfe: 3 },
        { paar: ["s04", "boc"], titel: "Revierduell", schaerfe: 2 },
        { paar: ["sge", "m05"], titel: "Rhein-Main-Derby", schaerfe: 2 },
        { paar: ["vfb", "tsg"], titel: "Baden-Württemberg-Derby", schaerfe: 2 },
        { paar: ["rbl", "s04"], titel: "Brisantes Duell", schaerfe: 1 }
    ];

    /**
     * Ist diese Paarung ein besonderes Spiel? Liefert Titel und Schärfe, sonst null.
     *
     * Neben den festen Rivalitäten zählt die Nachbarschaft: Zwei Vereine aus
     * derselben Stadt sind immer ein Stadtderby, und wer in derselben Liga aus
     * benachbarten Orten kommt, spielt zumindest ein Nachbarschaftsduell.
     */
    static findRivalry(clubA, clubB) {
        if (!clubA || !clubB || clubA.id === clubB.id) return null;

        const fest = this.FESTE_RIVALITAETEN.find(r =>
            (r.paar[0] === clubA.id && r.paar[1] === clubB.id) ||
            (r.paar[1] === clubA.id && r.paar[0] === clubB.id));
        if (fest) return { titel: fest.titel, schaerfe: fest.schaerfe };

        // Gleiche Stadt heißt immer Derby
        if (clubA.city && clubB.city && clubA.city === clubB.city) {
            return { titel: `${clubA.city}er Stadtderby`, schaerfe: 3 };
        }

        // Ein Topspiel ist die Ausnahme, nicht die Regel: Es braucht die
        // beiden Aushängeschilder einer Liga. Vorher galt jede Paarung ab
        // Ruf 78 als Topspiel - in der Bundesliga waren das hundert Spiele
        // pro Saison, und damit war keines mehr besonders.
        const rufA = clubA.reputation || 50;
        const rufB = clubB.reputation || 50;
        if (clubA.leagueId === clubB.leagueId && rufA >= 85 && rufB >= 85) {
            return { titel: "Topspiel", schaerfe: 1 };
        }

        return null;
    }

    /**
     * Markiert alle Partien eines Spielplans, die ein Derby sind.
     * Läuft einmal beim Aufbau der Saison.
     */
    static tagSchedule(state, schedule) {
        if (!Array.isArray(schedule)) return 0;
        const clubById = new Map((state.clubs || []).map(c => [c.id, c]));
        let markiert = 0;

        schedule.forEach(runde => {
            (runde.matches || []).forEach(match => {
                const heim = clubById.get(match.homeClubId);
                const gast = clubById.get(match.awayClubId);
                const rivalitaet = this.findRivalry(heim, gast);
                if (rivalitaet) {
                    match.isDerby = true;
                    match.derbyTitle = rivalitaet.titel;
                    match.derbyIntensity = rivalitaet.schaerfe;
                    markiert++;
                }
            });
        });

        return markiert;
    }

    /** Markiert alle Spielpläne der Welt */
    static tagAllSchedules(state) {
        let markiert = this.tagSchedule(state, state.schedule);
        Object.values(state.otherSchedules || {}).forEach(plan => {
            markiert += this.tagSchedule(state, plan);
        });
        return markiert;
    }

    /**
     * Die nächsten Rivalenduelle des eigenen Vereins - für Vorbericht und
     * Kalender.
     */
    static upcomingDerbies(state, anzahl = 3) {
        const treffer = [];
        (state.schedule || []).forEach(runde => {
            if (runde.matchday < (state.currentMatchday || 1)) return;
            (runde.matches || []).forEach(match => {
                if (!match.isDerby || match.played) return;
                if (match.homeClubId !== state.userClubId && match.awayClubId !== state.userClubId) return;
                const gegnerId = match.homeClubId === state.userClubId ? match.awayClubId : match.homeClubId;
                const gegner = (state.clubs || []).find(c => c.id === gegnerId);
                treffer.push({
                    matchday: runde.matchday,
                    titel: match.derbyTitle,
                    gegner: gegner?.name || "Gegner",
                    heim: match.homeClubId === state.userClubId
                });
            });
        });
        return treffer.slice(0, anzahl);
    }

    /**
     * Was ein Derby am Spieltag verändert.
     *
     * Volleres Stadion, lautere Kurve, mehr Zweikämpfe - und für die Kabine
     * zählt das Ergebnis doppelt (darum kümmert sich die DressingRoomEngine).
     */
    static matchdayEffects(match) {
        if (!match || !match.isDerby) {
            return { zuschauerBonus: 0, stimmungBonus: 0, haerte: 1 };
        }
        const schaerfe = match.derbyIntensity || 2;
        return {
            zuschauerBonus: 0.04 + schaerfe * 0.03,
            stimmungBonus: schaerfe * 4,
            haerte: 1 + schaerfe * 0.09
        };
    }
}

if (typeof window !== "undefined") {
    window.RivalryEngine = RivalryEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { RivalryEngine };
}
