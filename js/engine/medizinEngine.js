/**
 * MedizinEngine - Wie ein Verletzter behandelt wird: fitspritzen, früher
 * zurückholen oder intensive Reha.
 *
 * Bisher heilte jede Verletzung stur nach Plan, Woche für Woche, und der
 * Trainer konnte nur warten. Jetzt entscheidet er mit dem Mannschaftsarzt:
 *
 *   Fitspritzen         bei leichten Verletzungen (Prellung, Verhärtung,
 *                       Stauchung, Zerrung). Der Spieler steht sofort zur
 *                       Verfügung, spielt aber angeschlagen, bis die
 *                       Verletzung ausgeheilt wäre: Er trainiert nicht mit,
 *                       kommt nicht über 85 % Kondition, und nach jedem
 *                       Einsatz kann die Verletzung aufbrechen - dann als
 *                       schwerere (aus der Zerrung wird ein Muskelfaserriss).
 *   Früher zurückholen  dasselbe in der letzten Woche einer mittleren oder
 *                       schweren Verletzung.
 *   Intensive Reha      ab zwei Wochen Ausfall. Kostet Geld und verkürzt den
 *                       Ausfall, je nach Mannschaftsarzt und medizinischem
 *                       Zentrum um ein Fünftel bis knapp die Hälfte. Einmal
 *                       je Verletzung.
 *
 * Das Risiko je Einsatz hängt an der Verletzung, der Restdauer, der
 * Anfälligkeit des Spielers und dem Mannschaftsarzt. Spritzen lassen sich
 * jederzeit absetzen: Dann fällt der Spieler für die Restdauer wieder aus.
 *
 * Nur für den eigenen Verein und nur für die erste Mannschaft - in der U23
 * und U19 spritzt kein Verein fit.
 */

function _medResolve(name, pfad) {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { return null; }
    }
    return null;
}

const MedizinEngine = {
    /**
     * Die Verletzungen des Spiels: wie schwer, wie riskant ein Einsatz je
     * Spiel bei einer Woche Restdauer, und was daraus wird, wenn sie aufbricht.
     */
    VERLETZUNGEN: {
        "Prellung":         { schwere: "leicht", risiko: 0.06, folge: { name: "Knochenprellung", weeks: 3 } },
        "Muskelverhärtung": { schwere: "leicht", risiko: 0.10, folge: { name: "Zerrung", weeks: 2 } },
        "Knöchelstauchung": { schwere: "leicht", risiko: 0.12, folge: { name: "Bänderdehnung", weeks: 4 } },
        "Zerrung":          { schwere: "leicht", risiko: 0.16, folge: { name: "Muskelfaserriss", weeks: 3 } },
        "Muskelverletzung": { schwere: "leicht", risiko: 0.14, folge: { name: "Muskelfaserriss", weeks: 3 } },
        "Muskelfaserriss":  { schwere: "mittel", risiko: 0.22, folge: { name: "Muskelbündelriss", weeks: 6 } },
        "Bänderdehnung":    { schwere: "mittel", risiko: 0.20, folge: { name: "Bänderriss", weeks: 7 } },
        "Knochenprellung":  { schwere: "mittel", risiko: 0.18, folge: { name: "Knochenprellung", weeks: 5 } },
        "Muskelbündelriss": { schwere: "schwer", risiko: 0.25, folge: { name: "Muskelbündelriss", weeks: 9 } },
        "Bänderriss":       { schwere: "schwer", risiko: 0.25, folge: { name: "Bänderriss", weeks: 10 } },
        "Meniskusschaden":  { schwere: "schwer", risiko: 0.25, folge: { name: "Meniskusriss", weeks: 10 } },
        "Meniskusriss":     { schwere: "schwer", risiko: 0.28, folge: { name: "Meniskusriss", weeks: 12 } },
        "Kreuzbandanriss":  { schwere: "schwer", risiko: 0.30, folge: { name: "Kreuzbandriss", weeks: 20 } },
        "Kreuzbandriss":    { schwere: "schwer", risiko: 0.30, folge: { name: "Kreuzbandriss", weeks: 24 } }
    },

    /** Grundrisiko je Schwere, wenn die Verletzung nicht in der Liste steht */
    RISIKO_UNBEKANNT: { leicht: 0.14, mittel: 0.2, schwer: 0.28 },

    /** Wie viel Kondition ein Angeschlagener höchstens hat */
    KONDITION_ANGESCHLAGEN: 85,

    /** Intensive Reha: Kosten je Woche Restdauer nach Ligastufe */
    REHA_KOSTEN: { 1: 20000, 2: 10000, 3: 5000, 4: 2500, 5: 1500, 6: 1000, 7: 600 },

    /** Ab hier rät der Arzt ab (Risiko je Spiel) */
    RAT: { vertretbar: 0.12, abraten: 0.25 },

    /** Wo eine Verletzung aufgebrochen ist - bis zum nächsten Tag (meldungenAbholen) */
    _aufgebrochen: [],

    _club(state, player) {
        return (state?.clubs || []).find(c => c.id === player?.clubId) || null;
    },

    _spieler(state, id) {
        return (state?.players || []).find(p => p && String(p.id) === String(id)) || null;
    },

    /** Die Verletzung mit Schwere, Grundrisiko und Folge */
    art(player) {
        const a = player?.angeschlagen;
        const name = (a ? a.name : player?.injuryName) || "";
        const wochen = a ? a.wochen : (player?.injuredWeeks || 0);
        const bekannt = this.VERLETZUNGEN[name] || this.VERLETZUNGEN[name.replace(/\s*\(.*\)\s*$/, "")];
        if (bekannt) return { name, schwere: bekannt.schwere, risiko: bekannt.risiko, folge: bekannt.folge };
        const schwere = wochen <= 2 ? "leicht" : (wochen <= 4 ? "mittel" : "schwer");
        return { name: name || "Verletzung", schwere, risiko: this.RISIKO_UNBEKANNT[schwere],
            folge: { name: name || "Verletzung", weeks: Math.max(2, wochen + 2) } };
    },

    /** Mannschaftsarzt: Güte (10-97) und Name, falls einer verpflichtet ist */
    arzt(club) {
        const stab = _medResolve("CoachingStaffEngine", "./coachingStaffEngine.js");
        const guete = stab && typeof stab.staffQuality === "function" && club ? stab.staffQuality(club).medizin : 50;
        return { guete: Math.max(10, Math.min(97, guete ?? 50)), name: club?.staff?.medizin?.name || null };
    },

    /** Stufe des medizinischen Zentrums */
    zentrum(state, club) {
        const fe = _medResolve("FacilityEngine", "./facilityEngine.js");
        if (fe && typeof fe.stufeGerundet === "function" && club) return fe.stufeGerundet(club, "medicalCenter", state?.seasonYear || 1);
        return club?.facilities?.medicalCenter || 1;
    },

    _anfaelligkeit(player) {
        const me = _medResolve("MatchEngine", "./matchEngine.js");
        if (me && typeof me.verletzungsAnfaelligkeit === "function") return me.verletzungsAnfaelligkeit(player);
        const h = player?.hiddenAttributes?.injuryProneness ?? 10;
        return (0.45 + h / 18) * (1 + Math.max(0, (player?.age ?? 26) - 30) * 0.05);
    },

    /**
     * Risiko, dass die Verletzung bei einem Einsatz aufbricht (0,02 bis 0,6).
     * Je länger sie noch dauern würde, desto riskanter: Bei zwei Wochen
     * Restdauer anderthalbmal so hoch wie bei einer.
     */
    risiko(player, club = null) {
        const a = player?.angeschlagen;
        const wochen = Math.max(1, a ? a.wochen : (player?.injuredWeeks || 1));
        const art = this.art(player);
        const arzt = this.arzt(club);
        const r = art.risiko * (1 + 0.5 * (wochen - 1)) * this._anfaelligkeit(player) * (1.35 - arzt.guete / 150);
        return Math.max(0.02, Math.min(0.6, r));
    },

    /** Was der Arzt zum Risiko sagt */
    rat(risiko) {
        if (risiko < this.RAT.vertretbar) return { stufe: "gut", text: "Vertretbar" };
        if (risiko < this.RAT.abraten) return { stufe: "mittel", text: "Mit Risiko" };
        return { stufe: "schlecht", text: "Der Arzt rät ab" };
    },

    /** Wochen, die die intensive Reha spart */
    rehaErsparnis(state, club, wochen) {
        if (wochen < 2) return 0;
        const anteil = Math.max(0.12, Math.min(0.45,
            0.18 + (this.zentrum(state, club) - 1) * 0.05 + (this.arzt(club).guete - 50) / 500));
        return Math.max(1, Math.min(wochen - 1, Math.floor(wochen * anteil)));
    },

    rehaKosten(club, wochen) {
        return (this.REHA_KOSTEN[club?.level || 1] || 1000) * Math.max(1, wochen);
    },

    /**
     * Was bei diesem Spieler geht - mit Gründen, wenn etwas nicht geht.
     * { spritze, reha, absetzen }, je null, wenn es nicht zur Wahl steht.
     */
    optionen(state, player) {
        const erg = { spritze: null, reha: null, absetzen: null };
        const club = this._club(state, player);
        if (!player || !club || club.id !== state?.userClubId) return erg;

        if (player.angeschlagen) {
            const risiko = this.risiko(player, club);
            erg.absetzen = { ok: true, wochen: player.angeschlagen.wochen, risiko, rat: this.rat(risiko), name: player.angeschlagen.name };
            return erg;
        }

        const wochen = player.injuredWeeks || 0;
        if (wochen <= 0) return erg;
        const art = this.art(player);
        const frueh = art.schwere !== "leicht";

        let grund = null;
        if (player.reserve) grund = "In der U23 und U19 spritzt der Verein niemanden fit.";
        else if (frueh && wochen > 1) grund = `Zum Fitspritzen zu schwer (${art.name}). Früher zurückholen geht erst in der letzten Woche der Reha, noch sind es ${wochen} Wochen.`;
        const risiko = this.risiko(player, club);
        erg.spritze = {
            ok: !grund, grund, art: frueh ? "frueh" : "spritze",
            titel: frueh ? "Früher zurückholen" : "Fitspritzen",
            risiko, rat: this.rat(risiko), folge: art.folge, wochen, name: art.name
        };

        const kosten = this.rehaKosten(club, wochen);
        const ersparnis = this.rehaErsparnis(state, club, wochen);
        let rgrund = null;
        if (player.reha) rgrund = "Er ist schon in der intensiven Reha.";
        else if (wochen < 2) rgrund = "Bei einer Woche Ausfall lässt sich nichts mehr abkürzen.";
        else if ((club.balance || 0) < kosten) rgrund = "Dafür reicht das Geld auf dem Konto nicht.";
        erg.reha = { ok: !rgrund, grund: rgrund, kosten, ersparnis, wochen, zentrum: this.zentrum(state, club) };
        return erg;
    },

    /** Steht eine Behandlung zur Wahl? (für Menüs) */
    behandelbar(state, player) {
        const o = this.optionen(state, player);
        return !!(o.spritze || o.reha || o.absetzen);
    },

    /** Fitspritzen oder früher zurückholen: Der Spieler ist sofort einsatzbereit */
    fitspritzen(state, playerId) {
        const p = this._spieler(state, playerId);
        const o = this.optionen(state, p).spritze;
        if (!o) return { ok: false, grund: "Er ist nicht verletzt." };
        if (!o.ok) return { ok: false, grund: o.grund };
        p.angeschlagen = { name: o.name, wochen: p.injuredWeeks, art: o.art, saison: state.seasonYear || 1, tag: state.currentDayIndex || 0 };
        p.injuredWeeks = 0;
        p.injured = false;
        p.fitness = Math.min(p.fitness ?? 60, this.KONDITION_ANGESCHLAGEN);
        return { ok: true, risiko: o.risiko, wochen: p.angeschlagen.wochen, art: o.art,
            text: `${p.name} ist ${o.art === "frueh" ? "früher zurück" : "fitgespritzt"} und spielt angeschlagen (noch ${p.angeschlagen.wochen} ${p.angeschlagen.wochen === 1 ? "Woche" : "Wochen"}, Risiko je Einsatz ${Math.round(o.risiko * 100)} %).` };
    },

    /** Spritzen absetzen: Er fällt für die Restdauer wieder aus */
    absetzen(state, playerId) {
        const p = this._spieler(state, playerId);
        const a = p?.angeschlagen;
        if (!a) return { ok: false, grund: "Er bekommt keine Spritzen." };
        p.injuredWeeks = Math.max(1, a.wochen);
        p.injured = true;
        p.injuryName = a.name;
        p.angeschlagen = null;
        this._ausDerAufstellung(state, p);
        return { ok: true, wochen: p.injuredWeeks, text: `${p.name} wird geschont und fällt noch ${p.injuredWeeks} ${p.injuredWeeks === 1 ? "Woche" : "Wochen"} aus.` };
    },

    /** Intensive Reha: kostet, verkürzt den Ausfall */
    intensiveReha(state, playerId) {
        const p = this._spieler(state, playerId);
        const o = this.optionen(state, p).reha;
        if (!o) return { ok: false, grund: "Er ist nicht verletzt." };
        if (!o.ok) return { ok: false, grund: o.grund };
        const club = this._club(state, p);
        club.balance = (club.balance || 0) - o.kosten;
        const fe = _medResolve("FinanceEngine", "./financeEngine.js");
        if (fe && typeof fe.recordTransaction === "function") {
            fe.recordTransaction(state, club.id, "medizin", -o.kosten, `Intensive Reha: ${p.name} (${p.injuryName || "Verletzung"})`);
        }
        const vorher = p.injuredWeeks;
        p.injuredWeeks = Math.max(1, vorher - o.ersparnis);
        p.reha = { name: p.injuryName || "Verletzung", gespart: vorher - p.injuredWeeks, kosten: o.kosten };
        return { ok: true, kosten: o.kosten, gespart: vorher - p.injuredWeeks, wochen: p.injuredWeeks,
            text: `${p.name} geht in die intensive Reha: ${vorher - p.injuredWeeks} ${vorher - p.injuredWeeks === 1 ? "Woche" : "Wochen"} weniger, noch ${p.injuredWeeks}.` };
    },

    /** Wer wieder ausfällt, verlässt Startelf und Bank - die Lücke schließt GameState */
    _ausDerAufstellung(state, p) {
        const club = this._club(state, p);
        if (!club) return;
        if (Array.isArray(club.bench)) club.bench = club.bench.filter(id => id !== p.id);
        const gs = _medResolve("GameState", "./gameState.js");
        if (gs && typeof gs.repairLineup === "function") gs.repairLineup(club, state.players);
        else if (Array.isArray(club.lineup)) club.lineup = club.lineup.filter(id => id !== p.id);
    },

    /**
     * Nach einem Spiel (MatchEngine.applyTimelineToMatch): Wer angeschlagen
     * gespielt hat, bei dem kann die Verletzung aufbrechen. Wer sich im Spiel
     * neu verletzt hat, nimmt die alte Verletzung mit in die Pause.
     * eintraege: [{ player, club }], verletzungen: die Liste des Spiels.
     */
    nachDemSpiel(eintraege, verletzungen, zufall = Math.random) {
        (eintraege || []).forEach(({ player: p, club }) => {
            const a = p?.angeschlagen;
            if (!a) return;
            const neu = (verletzungen || []).find(v => String(v.playerId) === String(p.id));
            if (neu) {
                p.injuredWeeks = (p.injuredWeeks || neu.weeks || 1) + Math.max(0, a.wochen);
                neu.weeks = p.injuredWeeks;
                p.angeschlagen = null;
                return;
            }
            const risiko = this.risiko(p, club);
            if (zufall() >= risiko) return;
            const folge = this.art(p).folge;
            const wochen = Math.max(folge.weeks, a.wochen + 1);
            p.injuredWeeks = wochen;
            p.injured = true;
            p.injuryName = folge.name;
            p.fitness = Math.max(30, (p.fitness ?? 80) - 15);
            p.daysSinceInjury = 0;
            p.angeschlagen = null;
            const eintrag = { playerId: p.id, playerName: p.name, clubId: club?.id, injuryName: folge.name, weeks: wochen, aufgebrochen: a.name };
            if (Array.isArray(verletzungen)) verletzungen.push(eintrag);
            this._aufgebrochen.push({ ...eintrag, art: a.art });
        });
    },

    /**
     * Am nächsten Tag: Die medizinische Abteilung meldet, wo eine Verletzung
     * aufgebrochen ist. Liefert die Zeilen für die Tageszusammenfassung.
     */
    meldungenAbholen(state) {
        if (!this._aufgebrochen.length || !state) return [];
        const offen = this._aufgebrochen;
        this._aufgebrochen = [];
        const zeilen = [];
        offen.forEach(m => {
            if (m.clubId !== state.userClubId) return;
            const p = this._spieler(state, m.playerId);
            if (!p) return;
            if (Array.isArray(state.inbox)) {
                state.inbox.unshift({
                    id: Date.now() + Math.floor(Math.random() * 1000),
                    matchday: state.currentMatchday,
                    date: state.currentDate || `Spieltag ${state.currentMatchday}`,
                    sender: "Medizinische Abteilung",
                    subject: `Verletzung aufgebrochen: ${p.name}`,
                    body: `${p.name} hat ${m.art === "frueh" ? "zu früh wieder" : "fitgespritzt"} gespielt, dabei ist die Verletzung aufgebrochen (vorher: ${m.aufgebrochen}). Neue Diagnose: ${m.injuryName}, voraussichtlich ${m.weeks} ${m.weeks === 1 ? "Woche" : "Wochen"} Ausfall.`,
                    read: false,
                    type: "injury",
                    relatedEntity: { type: "player", id: p.id }
                });
            }
            zeilen.push(`🚑 ${p.name}: ${m.aufgebrochen} aufgebrochen, ${m.injuryName} (${m.weeks} Wo.)`);
        });
        return zeilen;
    },

    /**
     * Eine Woche vorbei (SeasonEngine.advanceToNextMatchday): Der
     * Angeschlagene ist eine Woche näher dran - nach der Restdauer ist die
     * Verletzung ausgeheilt.
     */
    wocheVorbei(state, p) {
        const a = p?.angeschlagen;
        if (!a) return;
        a.wochen--;
        if (a.wochen > 0) return;
        p.angeschlagen = null;
        p.reha = null;
        if (p.clubId === state?.userClubId && Array.isArray(state.inbox)) {
            state.inbox.unshift({
                id: Date.now() + 5,
                matchday: state.currentMatchday,
                date: state.currentDate || `Spieltag ${state.currentMatchday}`,
                sender: "Medizinische Abteilung",
                subject: `Beschwerdefrei: ${p.name}`,
                body: `${p.name} ist beschwerdefrei, die Verletzung (${a.name}) ist ausgeheilt. Er braucht keine Spritzen mehr und trainiert wieder voll mit.`,
                read: false,
                type: "injury_healed",
                relatedEntity: { type: "player", id: p.id }
            });
        }
    }
};

if (typeof window !== "undefined") {
    window.MedizinEngine = MedizinEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { MedizinEngine };
}
