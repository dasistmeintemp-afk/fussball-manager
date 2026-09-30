/**
 * MatchplanEngine - Die Taktikbesprechung vor dem Anpfiff
 *
 * Die Taktik im Taktik-Reiter ist die Grundordnung einer Mannschaft. Vor
 * einem Spiel bereitet ein Trainer seine Elf aber auf diesen einen Gegner
 * vor: Wer deckt den besten Mann? Stören wir den Aufbau früh oder lassen wir
 * sie kommen? Genau das ist der Matchplan.
 *
 * Bis zu zwei Punkte kann der Trainer festlegen. Sie gelten nur für dieses
 * Spiel - danach steht wieder die gewohnte Taktik. Trifft ein Punkt eine
 * Schwäche, die der Spielanalyst gefunden hat, ist die Mannschaft sichtbar
 * besser eingestellt. Wie genau die Analyse ist, hängt am Analysten: Ein
 * schwacher übersieht Schwächen, und ein Plan ins Blaue greift nicht.
 */

const _mpResolve = (globalName, path) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[globalName]; } catch (e) { return null; }
    }
    return null;
};

const MatchplanEngine = {
    /** Höchstens so viele Punkte - mehr behält keine Mannschaft im Kopf */
    MAX_PUNKTE: 2,

    /** Bonus auf die Werte je Punkt, der eine echte Schwäche trifft */
    BONUS_JE_TREFFER: 0.015,

    /** So viel verliert der eng gedeckte Spieler */
    ENG_GEDECKT: 0.92,

    PLAENE: {
        engDecken: {
            icon: "🎯", name: "Schlüsselspieler eng decken",
            text: "Ein Spieler bleibt an ihm dran - er bekommt kaum Luft zum Spielen.",
            braucht: "ziel"
        },
        fruehStoeren: {
            icon: "⚡", name: "Früh stören",
            text: "Hoch anlaufen und den Aufbau des Gegners unter Druck setzen.",
            taktik: { pressing: "high", anlaufen: "oefter", defensiveLine: "high" }
        },
        tiefStehen: {
            icon: "🧱", name: "Tief stehen, schnell umschalten",
            text: "Die Räume eng machen und nach Ballgewinn sofort nach vorn.",
            taktik: { defensiveLine: "deep", pressing: "low", kompaktheit: "eng", nachBallgewinn: "kontern" }
        },
        fluegel: {
            icon: "↔️", name: "Über die Flügel",
            text: "Breit spielen, die Außen suchen und früh flanken.",
            taktik: { breite: "breit", flanken: "frueh", focus: "balanced", attackFocus: "balanced" }
        },
        zentrum: {
            icon: "⬆️", name: "Durch die Mitte",
            text: "Kurze Wege durchs Zentrum, schnelle Doppelpässe.",
            taktik: { breite: "eng", focus: "center", attackFocus: "center" }
        },
        ballbesitz: {
            icon: "🔄", name: "Ball laufen lassen",
            text: "Geduldig aufbauen und den Gegner laufen lassen.",
            taktik: { passing: "short", tempo: "slow" }
        },
        schwachstelle: {
            icon: "🔎", name: "Die Schwachstelle anlaufen",
            text: "Angriffe gezielt über den schwächsten Mann des Gegners.",
            braucht: "schwachstelle"
        }
    },

    /**
     * Passt ein Punkt zu dem, was die Analyse über den Gegner weiß?
     * Liefert { passt, grund }. Ohne Analyse (oder mit einem Analysten, der
     * nichts findet) passt nichts - dann ist der Plan eine Vermutung.
     */
    passtZu(key, report, gegner, zielId = null) {
        if (!report) return { passt: false, grund: "" };
        const t = (gegner && gegner.tactics) || {};
        switch (key) {
            case "engDecken": {
                // Es lohnt nur gegen den Mann, der aus seiner Elf herausragt
                const feld = this.deckungsZiele(report);
                const bester = feld[0];
                const ziel = zielId !== null && zielId !== undefined
                    ? feld.find(k => String(k.id) === String(zielId)) : bester;
                const ragtHeraus = bester && (bester.danger === "Hoch" || (bester.overall || 0) >= (report.avgOverall || 0) + 6);
                if (!ragtHeraus) return { passt: false, grund: "Kein Spieler ragt so heraus, dass es sich lohnt." };
                return ziel && bester && String(ziel.id) === String(bester.id)
                    ? { passt: true, grund: `${bester.name} ist ihr gefährlichster Mann.` }
                    : { passt: false, grund: `Der Gefährlichste ist ${bester.name}.` };
            }
            case "fruehStoeren":
                if (report.midfieldRating <= 73 || (report.weaknesses || []).some(w => /Pressing/.test(w))) {
                    return { passt: true, grund: "Ihr Zentrum verliert unter Druck viele Bälle." };
                }
                return t.passing === "short"
                    ? { passt: true, grund: "Sie bauen kurz auf - früher Druck trifft sie." }
                    : { passt: false, grund: "Ihr Aufbau wirkt pressingresistent." };
            case "tiefStehen":
                return report.attackRating >= 80 || t.defensiveLine === "high"
                    ? { passt: true, grund: report.attackRating >= 80 ? "Ihr Angriff ist ihre Stärke - Räume eng machen." : "Hinter ihrer hohen Kette ist Platz für Konter." }
                    : { passt: false, grund: "Ihr Angriff ist keine große Gefahr." };
            case "fluegel":
                return t.kompaktheit === "eng" || t.breite === "eng"
                    ? { passt: true, grund: "Sie verteidigen eng - außen ist Platz." }
                    : { passt: false, grund: "Sie stehen breit genug." };
            case "zentrum":
                return t.breite === "breit" || (report.defenseRating || 80) <= 72
                    ? { passt: true, grund: t.breite === "breit" ? "Sie ziehen das Spiel breit - innen öffnen sich Lücken." : "Ihre Innenverteidigung wackelt." }
                    : { passt: false, grund: "Das Zentrum ist dicht." };
            case "ballbesitz":
                return t.pressing === "low" || t.defensiveLine === "deep"
                    ? { passt: true, grund: "Sie lassen uns kommen - den Ball in Ruhe laufen lassen." }
                    : { passt: false, grund: "Gegen ihr Pressing ist Geduld riskant." };
            case "schwachstelle":
                return report.schwachstelle
                    ? { passt: true, grund: report.schwachstelle.text }
                    : { passt: false, grund: "Der Analyst hat keine Schwachstelle gefunden." };
            default:
                return { passt: false, grund: "" };
        }
    },

    /** Wen man eng decken kann: die Schlüsselspieler ohne den Torwart */
    deckungsZiele(report) {
        return (report?.keyPlayers || []).filter(k => k.pos !== "TW");
    },

    /** Der Schlüssel, unter dem ein Plan an seinem Spiel hängt */
    spielSchluessel(state, match) {
        if (!match) return null;
        return `${state?.seasonYear || 1}|${match.id || ""}|${match.homeClubId}|${match.awayClubId}`;
    },

    /**
     * Alles für die Besprechung: Analyse des Gegners und die möglichen
     * Punkte - mit dem Hinweis des Analysten, was passt.
     */
    vorschlag(state, match) {
        if (!state || !match) return null;
        const eigen = state.userClubId;
        const gegnerId = match.homeClubId === eigen ? match.awayClubId : match.homeClubId;
        const gegner = (state.clubs || []).find(c => c.id === gegnerId);
        const analyse = _mpResolve("OpponentAnalysisEngine", "./opponentAnalysisEngine.js");
        const report = analyse ? analyse.generateReport(state, gegnerId, eigen) : null;
        // Der Analyst sagt nur, was er sieht: Unter drei Sternen bleibt er vage
        const sieht = (report?.analyst?.sterne || 0) >= 2.5;
        const plaene = Object.keys(this.PLAENE).map(key => {
            const p = this.PLAENE[key];
            const urteil = this.passtZu(key, report, gegner);
            const verfuegbar = p.braucht === "schwachstelle" ? !!report?.schwachstelle
                : p.braucht === "ziel" ? this.deckungsZiele(report).length > 0 : true;
            return { key, ...p, verfuegbar, empfohlen: sieht && urteil.passt, grund: sieht ? urteil.grund : "" };
        });
        return {
            gegnerId, gegnerName: gegner?.name || "Gegner",
            report, plaene,
            ziele: this.deckungsZiele(report).slice(0, 4).map(k => ({ id: k.id, name: k.name, pos: k.pos, danger: k.danger })),
            gespeichert: this.fuerSpiel(state, match)
        };
    },

    /**
     * Den Plan festlegen. Punkte, die nicht verfügbar sind, und alles über
     * zwei Punkte hinaus fallen weg.
     */
    festlegen(state, match, keys = [], zielId = null) {
        if (!state || !match) return null;
        const v = this.vorschlag(state, match);
        const gueltig = [...new Set(keys)].filter(k => v.plaene.find(p => p.key === k && p.verfuegbar))
            .slice(0, this.MAX_PUNKTE);
        // Flügel und Mitte, früh stören und tief stehen schließen sich aus
        const widerspruch = [["fluegel", "zentrum"], ["fruehStoeren", "tiefStehen"]];
        widerspruch.forEach(([a, b]) => {
            if (gueltig.includes(a) && gueltig.includes(b)) gueltig.splice(gueltig.indexOf(b), 1);
        });
        const ziel = gueltig.includes("engDecken")
            ? (v.ziele.find(z => String(z.id) === String(zielId)) || v.ziele[0] || null) : null;
        const gegner = (state.clubs || []).find(c => c.id === v.gegnerId);
        const treffer = gueltig.filter(k => this.passtZu(k, v.report, gegner, ziel ? ziel.id : null).passt).length;
        state.matchplan = {
            schluessel: this.spielSchluessel(state, match),
            clubId: state.userClubId,
            punkte: gueltig,
            zielId: ziel ? ziel.id : null,
            zielName: ziel ? ziel.name : null,
            treffer,
            schwachstelleId: gueltig.includes("schwachstelle") ? (v.report?.schwachstelle?.id ?? null) : null
        };
        return state.matchplan;
    },

    /** Der Plan für dieses Spiel - oder null */
    fuerSpiel(state, match) {
        const plan = state?.matchplan;
        if (!plan || !match || plan.schluessel !== this.spielSchluessel(state, match)) return null;
        return plan;
    },

    /**
     * Was der Plan an einer Partie ändert - für Livespiel und Sofort-
     * Simulation dieselben Angaben:
     *   side    - die Seite des eigenen Vereins
     *   taktik  - Anweisungen nur für dieses Spiel
     *   bonus   - Faktor auf die Werte (trifft der Plan Schwächen)
     *   gedeckt - { id: Faktor } für den eng gedeckten Gegenspieler
     */
    spielOptionen(state, match) {
        const plan = this.fuerSpiel(state, match);
        if (!plan) return null;
        const side = match.homeClubId === plan.clubId ? "home" : (match.awayClubId === plan.clubId ? "away" : null);
        if (!side) return null;
        const taktik = {};
        plan.punkte.forEach(k => Object.assign(taktik, this.PLAENE[k]?.taktik || {}));
        // Über die Schwachstelle: dorthin, wo sie steht
        if (plan.punkte.includes("schwachstelle") && plan.schwachstelleId !== null) {
            const p = (state.players || []).find(x => x.id === plan.schwachstelleId);
            if (p && ["LV", "LM", "LA"].includes(p.pos)) Object.assign(taktik, { focus: "right", attackFocus: "right" });
            else if (p && ["RV", "RM", "RA"].includes(p.pos)) Object.assign(taktik, { focus: "left", attackFocus: "left" });
            else Object.assign(taktik, { focus: "center", attackFocus: "center" });
        }
        const gedeckt = {};
        if (plan.zielId !== null && plan.zielId !== undefined) gedeckt[plan.zielId] = this.ENG_GEDECKT;
        return {
            side,
            taktik,
            bonus: 1 + Math.min(this.MAX_PUNKTE, plan.treffer || 0) * this.BONUS_JE_TREFFER,
            gedeckt,
            punkte: plan.punkte.slice()
        };
    },

    /** Nach dem Spiel ist der Plan erledigt */
    abschliessen(state, match) {
        if (this.fuerSpiel(state, match)) delete state.matchplan;
    }
};

if (typeof window !== "undefined") {
    window.MatchplanEngine = MatchplanEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { MatchplanEngine };
}
