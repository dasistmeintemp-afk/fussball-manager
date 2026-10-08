/**
 * CalendarEngine - Verwaltet den Saisonkalender, Tagesablauf und Events zwischen Spieltagen
 */

const CALENDAR_DAY_TYPES = {
    TRAINING: "training",
    RECOVERY: "recovery",
    TACTICS: "tactics",
    OPPONENT_ANALYSIS: "opponent_analysis",
    MEDIA: "media",
    SPONSOR: "sponsor",
    MATCHDAY: "matchday",
    REST: "rest",
    SEASON_START: "season_start",
    SEASON_END: "season_end",
    // Die Wochen vor dem ersten Spieltag: Stab zusammenstellen, Sponsor
    // aushandeln, Testspiele bestreiten.
    PRESEASON: "preseason",
    FRIENDLY: "friendly",
    // Die englischen Wochen: Pokal und Europapokal liegen zwischen den
    // Ligaspieltagen. Vorher gab es beide Wettbewerbe nur im Menü.
    CUP: "cup",
    EURO: "euro",
    // Länderspielpause: Die Nationalspieler reisen ab, die Liga ruht
    INTERNATIONAL: "international",
    // Die Wochen zwischen letztem Spieltag und Saisonwechsel: frei für die
    // Mannschaft, Zeit für Vertragsgespräche
    SUMMER_BREAK: "summer_break",
    // Zwei Wochen nach der Hinrunde: frei über die Feiertage, dann Training -
    // und das Wintertransferfenster ist offen
    WINTER_BREAK: "winter_break"
};

/**
 * Weihnachten und Jahreswechsel je Land, nach den Spielplänen 2024/25.
 *
 * pause.ab: Ab diesem Tag ruht die Liga; pause.weiter: der erste Spieltag
 * danach. Die Bundesliga pausiert gut zweieinhalb Wochen (zurück am 10.1.),
 * die Ligue 1 ab Mitte Dezember (zurück am 3.1.), LaLiga zehn Tage. Die
 * Premier League kennt keine Winterpause: Sie spielt am Boxing Day, am 29.
 * Dezember und an Neujahr. Die Serie A spielt ebenfalls durch, um den 29.12.
 * und am 5.1. Das Wintertransferfenster hängt nicht daran - es ist überall im
 * Januar offen (TransferEngine.FENSTER).
 */
const FESTTAGE = {
    de: { pause: { ab: [12, 22], weiter: [1, 10] } },
    fr: { pause: { ab: [12, 16], weiter: [1, 3] } },
    es: { pause: { ab: [12, 23], weiter: [1, 3] } },
    it: { festtage: [[12, 29, "Spieltag zwischen den Jahren"], [1, 5, "Dreikönigsspieltag"]] },
    en: { festtage: [[12, 26, "Boxing Day"], [12, 29, "Spieltag zwischen den Jahren"], [1, 1, "Neujahrsspieltag"]] }
};

function _getNationalTeamEngine() {
    if (typeof NationalTeamEngine !== "undefined" && NationalTeamEngine) return NationalTeamEngine;
    if (typeof window !== "undefined" && window.NationalTeamEngine) return window.NationalTeamEngine;
    if (typeof require !== "undefined") {
        try { return require("./nationalTeamEngine.js").NationalTeamEngine; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

function _getPreseasonEngine() {
    if (typeof PreseasonEngine !== "undefined" && PreseasonEngine) return PreseasonEngine;
    if (typeof window !== "undefined" && window.PreseasonEngine) return window.PreseasonEngine;
    if (typeof require !== "undefined") {
        try { return require("./preseasonEngine.js").PreseasonEngine; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

function _getCupEngineCal() {
    if (typeof CupEngine !== "undefined" && CupEngine) return CupEngine;
    if (typeof window !== "undefined" && window.CupEngine) return window.CupEngine;
    if (typeof require !== "undefined") {
        try { return require("./cupEngine.js").CupEngine; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

function _getCalFacilityEngine() {
    if (typeof FacilityEngine !== "undefined" && FacilityEngine) return FacilityEngine;
    if (typeof window !== "undefined" && window.FacilityEngine) return window.FacilityEngine;
    if (typeof require !== "undefined") {
        try { return require("./facilityEngine.js").FacilityEngine; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

function _getTransferEngineCal() {
    if (typeof TransferEngine !== "undefined" && TransferEngine) return TransferEngine;
    if (typeof window !== "undefined" && window.TransferEngine) return window.TransferEngine;
    if (typeof require !== "undefined") {
        try { return require("./transferEngine.js").TransferEngine; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

/** Der Vorstand - für Anfragen, die nach ein paar Tagen beantwortet werden */
function _getBoardEngineCal() {
    if (typeof BoardEngine !== "undefined" && BoardEngine) return BoardEngine;
    if (typeof window !== "undefined" && window.BoardEngine) return window.BoardEngine;
    if (typeof require !== "undefined") {
        try { return require("./boardEngine.js").BoardEngine; } catch (e) { return null; }
    }
    return null;
}

const CalendarEngine = {
    DAY_TYPES: CALENDAR_DAY_TYPES,

    /**
     * Generiert einen vollständigen Saisonkalender basierend auf Spieltagen
     * Pro Spieltage-Woche werden ca. 6 Tage (Mo-Sa) generiert:
     * Mo: Regeneration / Erholung
     * Di: Teamtraining (Fokus)
     * Mi: Medien- / Sponsoren-Event
     * Do: Taktiktraining
     * Fr: Gegneranalyse
     * Sa: Spieltag
     * So: Erholung
     */
    generateSeasonCalendar(state) {
        if (!state) return [];
        const totalMatchdays = state.totalMatchdays || (state.schedule ? state.schedule.length : 34);
        const calendar = [];

        // Startdatum: 1. August der laufenden Saison. Die Saisonzählung beginnt
        // bei 1, deshalb der Versatz - sonst stünde in jeder Saison wieder 2026
        // im Kalender.
        const saison = Math.max(1, state.seasonYear || 1);
        const startDate = new Date(2025 + saison, 7, 1);
        let currentDate = new Date(startDate);
        let dayCounter = 1;

        // Tag 1: Saisonstart / Willkommen
        calendar.push({
            id: `day_${dayCounter}`,
            dayIndex: dayCounter,
            date: this.formatDate(currentDate),
            dateObj: new Date(currentDate).toISOString(),
            dayOfWeek: this.getDayName(currentDate),
            type: CALENDAR_DAY_TYPES.SEASON_START,
            title: "Saisonvorbereitung & Karrierestart",
            description: "Willkommen im Verein! Überprüfen Sie Ihren Kader und legen Sie die Taktik fest.",
            matchday: null,
            matchIds: [],
            actionsAvailable: ["training", "tactics", "scouting", "transfers"],
            completed: false
        });

        currentDate.setDate(currentDate.getDate() + 1);
        dayCounter++;

        // Die Vorbereitung: vier Wochen, in denen der Manager arbeitet, bevor
        // es zaehlt. Vorher stand der erste Spieltag sofort an - es gab nichts
        // zu entscheiden, bevor Punkte vergeben wurden.
        const preseasonEngine = _getPreseasonEngine();
        const vorbereitungsTage = preseasonEngine ? preseasonEngine.DAUER_TAGE : 24;
        let testspielNr = 0;

        for (let v = 1; v <= vorbereitungsTage; v++) {
            // Alle fuenf Tage ein Testspiel - dazwischen Training und Arbeit
            const istTestspiel = v % 5 === 0 && testspielNr < 4;
            if (istTestspiel) testspielNr++;

            const art = istTestspiel
                ? CALENDAR_DAY_TYPES.FRIENDLY
                : (v % 5 === 1 ? CALENDAR_DAY_TYPES.PRESEASON
                    : (v % 5 === 3 ? CALENDAR_DAY_TYPES.RECOVERY : CALENDAR_DAY_TYPES.TRAINING));

            calendar.push({
                id: `day_${dayCounter}`,
                dayIndex: dayCounter,
                date: this.formatDate(currentDate),
                dateObj: new Date(currentDate).toISOString(),
                dayOfWeek: this.getDayName(currentDate),
                type: art,
                title: istTestspiel
                    ? `Spieltermin ${testspielNr}`
                    : (art === CALENDAR_DAY_TYPES.PRESEASON ? "Vorbereitung: Stab, Sponsoren, Planung"
                        : (art === CALENDAR_DAY_TYPES.RECOVERY ? "Regeneration" : "Vorbereitungstraining")),
                description: istTestspiel
                    ? "Testspiel oder Turnierrunde - was hier gespielt wird, planen Sie im Reiter Vorbereitung."
                    : (art === CALENDAR_DAY_TYPES.PRESEASON
                        ? "Bewerbungen sichten, Sponsorenangebote prüfen, den Kader planen."
                        : "Grundlagenarbeit für die Saison."),
                matchday: null,
                friendlyIndex: istTestspiel ? testspielNr - 1 : null,
                actionsAvailable: ["preseason", "training", "tactics", "transfers"],
                preseason: true,
                completed: false
            });

            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;
        }

        // Pokal und Europapokal liegen unter der Woche zwischen den
        // Ligaspieltagen - genau daraus entstehen die englischen Wochen, in
        // denen ein Kader Breite braucht.
        const cupEngine = _getCupEngineCal();
        const termine = cupEngine ? (cupEngine.TERMINPLAN || []) : [];
        const offeneTermine = termine.slice();

        const legeTerminAn = (termin) => {
            const istPokal = termin.art === "cup";
            calendar.push({
                id: `day_${dayCounter}`,
                dayIndex: dayCounter,
                date: this.formatDate(currentDate),
                dateObj: new Date(currentDate).toISOString(),
                dayOfWeek: this.getDayName(currentDate),
                type: istPokal ? CALENDAR_DAY_TYPES.CUP : CALENDAR_DAY_TYPES.EURO,
                title: istPokal ? "🏆 Pokalabend" : "⭐ Europapokal-Abend",
                description: istPokal
                    ? "Der Landespokal wird ausgespielt - ein Spiel, eine Runde, kein zweiter Versuch."
                    : "Internationaler Spieltag. Europa spielt unter Flutlicht.",
                matchday: null,
                cupArt: termin.art,
                cupRunde: termin.runde,
                actionsAvailable: ["match", "lineup", "live_match"],
                completed: false
            });
            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;
        };

        // Viermal in der Saison ruht die Liga für die Nationalmannschaften
        const nationalEngine = _getNationalTeamEngine();
        const pausen = new Set(nationalEngine ? nationalEngine.pausenNachSpieltag(totalMatchdays) : []);
        const legePauseAn = (md) => {
            const tage = [
                { type: CALENDAR_DAY_TYPES.INTERNATIONAL, schritt: "abreise", title: "🌍 Länderspielpause: Abreise",
                    description: "Die Nationalspieler reisen zu ihren Auswahlteams. Wer bleibt, trainiert weiter." },
                { type: CALENDAR_DAY_TYPES.TRAINING, schritt: null, title: "Training mit dem Restkader",
                    description: "Die Liga ruht. Zeit für die, die sonst wenig spielen." },
                { type: CALENDAR_DAY_TYPES.INTERNATIONAL, schritt: "spiel", title: "🌍 Länderspieltag",
                    description: "Die Nationalmannschaften spielen. Daumen drücken, dass alle heil bleiben." },
                { type: CALENDAR_DAY_TYPES.INTERNATIONAL, schritt: "rueckkehr", title: "🌍 Länderspieltag und Rückkehr",
                    description: "Das zweite Länderspiel - danach kommen die Abgestellten zurück." }
            ];
            tage.forEach(t => {
                calendar.push({
                    id: `day_${dayCounter}`,
                    dayIndex: dayCounter,
                    date: this.formatDate(currentDate),
                    dateObj: new Date(currentDate).toISOString(),
                    dayOfWeek: this.getDayName(currentDate),
                    type: t.type,
                    title: t.title,
                    description: t.description,
                    // Die Pause gehört zur Woche vor dem nächsten Spieltag
                    matchday: Math.min(totalMatchdays, md + 1),
                    laenderspiel: t.schritt,
                    laenderspielPause: true,
                    actionsAvailable: ["training", "tactics", "transfers"],
                    completed: false
                });
                currentDate.setDate(currentDate.getDate() + 1);
                dayCounter++;
            });
        };

        // Weihnachten und Jahreswechsel richten sich nach dem Land der eigenen
        // Liga (FESTTAGE). Vorher folgte überall der 18. Spieltag eine Woche
        // auf den 17. - gespielt wurde auch an Heiligabend.
        const regel = FESTTAGE[this.landDerLiga(state)] || FESTTAGE.de;
        const ersteJahr = startDate.getFullYear();
        const datum = ([monat, tag]) => new Date(monat >= 7 ? ersteJahr : ersteJahr + 1, monat - 1, tag);
        const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
        const tageBis = (d) => Math.round((d - currentDate) / 86400000);
        const festtage = (regel.festtage || []).map(([m, t, name]) => ({ datum: datum([m, t]), name }));
        const genutzt = new Set();
        let winterpauseGelegt = false;

        const tag = (felder) => {
            calendar.push(Object.assign({
                id: `day_${dayCounter}`,
                dayIndex: dayCounter,
                date: this.formatDate(currentDate),
                dateObj: new Date(currentDate).toISOString(),
                dayOfWeek: this.getDayName(currentDate),
                completed: false
            }, felder));
            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;
        };

        // Die Winterpause: die ersten Tage frei, dann Training für die Rückrunde
        const legeWinterpauseAn = (md, tage) => {
            const frei = Math.max(1, Math.round(tage * 0.4));
            for (let t = 1; t <= tage; t++) {
                const istFrei = t <= frei;
                tag({
                    type: CALENDAR_DAY_TYPES.WINTER_BREAK,
                    title: istFrei ? "❄️ Winterpause: frei" : "❄️ Winterpause: Training",
                    description: istFrei
                        ? "Die Mannschaft hat über die Feiertage frei."
                        : "Die Vorbereitung auf die Rückrunde läuft.",
                    matchday: md,
                    winterpause: true,
                    trainingsArt: istFrei ? CALENDAR_DAY_TYPES.REST : CALENDAR_DAY_TYPES.TRAINING,
                    actionsAvailable: ["training", "tactics", "transfers"]
                });
            }
        };

        // Die Tage einer Spieltagswoche. Normal sind es fünf vor dem Spiel;
        // in englischen Wochen und an den Festtagen weniger.
        const vorbereitungstag = {
            recovery: () => ({ type: CALENDAR_DAY_TYPES.RECOVERY, title: "Regeneration & Erholung",
                description: "Leichte Erholungseinheit. Spieler frischen ihre Fitness auf.",
                actionsAvailable: ["recovery", "training", "physio"] }),
            training: () => ({ type: CALENDAR_DAY_TYPES.TRAINING, title: "Schwerpunkt-Training",
                description: "Intensives Mannschaftstraining gemäß gewähltem Trainingsfokus.",
                actionsAvailable: ["training", "individual_training"] }),
            media: () => ({ type: CALENDAR_DAY_TYPES.MEDIA, title: "Pressekonferenz & Medientermin",
                description: "Stellen Sie sich den Fragen der Journalisten vor dem kommenden Spieltag.",
                actionsAvailable: ["press", "interview"] }),
            sponsor: () => ({ type: CALENDAR_DAY_TYPES.SPONSOR, title: "Sponsorenempfang & Partnertreffen",
                description: "Pflege der Klub-Sponsoren. Generiert wichtige Zusatzeinnahmen.",
                actionsAvailable: ["sponsor", "finance"] }),
            tactics: () => ({ type: CALENDAR_DAY_TYPES.TACTICS, title: "Taktik- & Standardschulung",
                description: "Einstudieren von Spielzügen und Standardsituationen (Ecken, Freistöße).",
                actionsAvailable: ["tactics", "setpieces"] }),
            opponent_analysis: (md) => ({ type: CALENDAR_DAY_TYPES.OPPONENT_ANALYSIS, title: `Gegnervorbereitung: Spieltag ${md}`,
                description: "Detaillierte Analyse des nächsten Gegners und finales Anschwitzen.",
                actionsAvailable: ["analysis", "lineup", "tactics"] })
        };
        const wochenplan = (vorTage, md) => {
            const presse = md % 2 === 1 ? "media" : "sponsor";
            const plaene = [
                [],
                ["opponent_analysis"],
                ["recovery", "opponent_analysis"],
                ["recovery", "training", "opponent_analysis"],
                ["recovery", "training", presse, "opponent_analysis"],
                ["recovery", "training", presse, "tactics", "opponent_analysis"],
                ["recovery", "training", "training", presse, "tactics", "opponent_analysis"],
                ["recovery", "training", "training", presse, "tactics", "training", "opponent_analysis"]
            ];
            return plaene[Math.max(0, Math.min(plaene.length - 1, vorTage))];
        };

        // Mehr Spieltage, als die Wochen einer Saison hergeben (Championship:
        // 46, Segunda División: 42): Einige Runden liegen unter der Woche
        let englischeRunden = Math.max(0, totalMatchdays - 38);
        const verschobeneTermine = [];

        for (let md = 1; md <= totalMatchdays; md++) {
            let laenge = 6;
            if (englischeRunden > 0 && md >= 4 && md % 4 === 2) {
                laenge = 3;
                englischeRunden--;
            }

            // Winterpause: Fiele der Spieltag in sie, geht die Liga vorher in die Pause
            if (regel.pause && !winterpauseGelegt && plus(currentDate, laenge - 1) >= datum(regel.pause.ab)) {
                winterpauseGelegt = true;
                laenge = 6;
                const pausentage = tageBis(plus(datum(regel.pause.weiter), -(laenge - 1)));
                if (pausentage > 0) legeWinterpauseAn(md, pausentage);
            }

            // Festtage: Boxing Day, der 29.12. und Neujahr in England - der
            // Spieltag rückt auf den Festtag, die Woche wird kürzer
            let besonders = null;
            const fest = festtage.find(f => !genutzt.has(+f.datum) && tageBis(f.datum) >= 1 && tageBis(f.datum) <= laenge + 1);
            if (fest) {
                genutzt.add(+fest.datum);
                laenge = tageBis(fest.datum) + 1;
                besonders = fest.name;
            }
            // Heiligabend und der erste Weihnachtstag sind spielfrei - gespielt
            // wird vorher, am 23.
            const spieldatum = plus(currentDate, laenge - 1);
            if (spieldatum.getMonth() === 11 && (spieldatum.getDate() === 24 || spieldatum.getDate() === 25)) {
                laenge = Math.max(2, laenge - (spieldatum.getDate() - 23));
            }

            // Die Tage vor dem Spiel - sie gehören zum Spieltag, sonst zeigt die
            // Wochenansicht auf ihnen den falschen Gegner
            wochenplan(laenge - 1, md).forEach(art => tag(Object.assign(vorbereitungstag[art](md), { matchday: md })));

            // Der Spieltag
            tag({
                type: CALENDAR_DAY_TYPES.MATCHDAY,
                title: besonders ? `⚽ ${md}. Spieltag: ${besonders}` : `⚽ ${md}. Spieltag: Liga 1`,
                description: `Offizieller Ligaspieltag ${md}. Alle Begegnungen der Liga werden ausgetragen.`,
                matchday: md,
                festtag: besonders || undefined,
                actionsAvailable: ["match", "lineup", "live_match"]
            });

            // Unter der Woche: Pokal oder Europapokal - aber nicht mitten in den
            // Festtagen, dann eben danach
            const festNah = festtage.some(f => !genutzt.has(+f.datum) && tageBis(f.datum) >= 0 && tageBis(f.datum) <= 4);
            for (let t = offeneTermine.length - 1; t >= 0; t--) {
                if (offeneTermine[t].nachSpieltag !== md) continue;
                verschobeneTermine.push(offeneTermine[t]);
                offeneTermine.splice(t, 1);
            }
            if (!festNah) {
                verschobeneTermine.splice(0).forEach(legeTerminAn);
            }

            // Länderspielpause
            if (pausen.has(md)) legePauseAn(md);
        }
        verschobeneTermine.splice(0).forEach(legeTerminAn);

        // In kleineren Ligen ist die Saison kürzer als der Terminplan. Was
        // dann noch offen ist, wird vor dem Saisonende nachgeholt - sonst
        // bliebe der Pokal ohne Sieger.
        offeneTermine.forEach(legeTerminAn);

        // Tag: Saisonabschluss
        calendar.push({
            id: `day_${dayCounter}`,
            dayIndex: dayCounter,
            date: this.formatDate(currentDate),
            dateObj: new Date(currentDate).toISOString(),
            dayOfWeek: this.getDayName(currentDate),
            type: CALENDAR_DAY_TYPES.SEASON_END,
            title: "🏆 Saisonabschluss & Ehrungen",
            description: "Die Saison ist beendet. Meisterehrung, Finanzausschüttungen und Saisonanalyse.",
            matchday: null,
            actionsAvailable: ["season_review", "next_season"],
            completed: false
        });

        state.calendar = calendar;
        state.currentDayIndex = 0;
        state.currentDate = calendar[0].date;
        return calendar;
    },

    /**
     * Die Sommerpause an den Kalender hängen.
     *
     * Vorher folgte auf den letzten Spieltag sofort der Saisonwechsel: Wer
     * bis dahin nicht verlängert hatte, verlor seine Spieler, ohne noch
     * reagieren zu können. Jetzt liegen einige Wochen dazwischen. Die
     * Mannschaft hat frei, der Manager verhandelt - und der letzte Tag ist
     * der Saisonwechsel selbst. Gibt die Zahl der angehängten Tage zurück
     * (0, wenn die Pause schon im Kalender steht).
     */
    legeSommerpauseAn(state, tage = 21) {
        if (!state || !Array.isArray(state.calendar) || state.calendar.length === 0) return 0;
        if (state.calendar.some(d => d.sommerpause)) return 0;

        const letzter = state.calendar[state.calendar.length - 1];
        const datum = letzter.dateObj ? new Date(letzter.dateObj) : new Date(2026 + Math.max(1, state.seasonYear || 1), 4, 31);
        let nr = (letzter.dayIndex || state.calendar.length) + 1;
        for (let t = 1; t <= tage; t++) {
            datum.setDate(datum.getDate() + 1);
            const wechsel = t === tage;
            state.calendar.push({
                id: `day_${nr}`,
                dayIndex: nr,
                date: this.formatDate(datum),
                dateObj: new Date(datum).toISOString(),
                dayOfWeek: this.getDayName(datum),
                type: CALENDAR_DAY_TYPES.SUMMER_BREAK,
                title: wechsel ? "🔄 Saisonwechsel" : "☀️ Sommerpause",
                description: wechsel
                    ? "Auslaufende Verträge enden, Auf- und Absteiger wechseln die Liga, die Vorbereitung beginnt."
                    : "Die Mannschaft hat frei. Zeit, Verträge zu verlängern und die neue Saison zu planen.",
                matchday: null,
                sommerpause: true,
                pauseTag: t,
                pauseTage: tage,
                saisonwechsel: wechsel,
                actionsAvailable: ["contracts", "squad"],
                completed: false
            });
            nr++;
        }
        return tage;
    },

    /** Das Land der eigenen Liga - danach richten sich Feiertage und Pausen */
    landDerLiga(state) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        return club?.countryId || "de";
    },

    /** Wie viele Tage der Sommerpause noch bleiben - null außerhalb von ihr */
    sommerpauseRest(state) {
        const heute = this.getCurrentDay(state);
        if (!heute || !heute.sommerpause) return null;
        return Math.max(0, (heute.pauseTage || 0) - (heute.pauseTag || 0));
    },

    /**
     * Gibt den aktuellen Tag zurück
     */
    getCurrentDay(state) {
        if (!state) return null;
        if (!Array.isArray(state.calendar) || state.calendar.length === 0) {
            this.generateSeasonCalendar(state);
        }
        const idx = state.currentDayIndex || 0;
        return state.calendar[idx] || state.calendar[state.calendar.length - 1];
    },

    // ------------------------------------------------------- Inhalt der Tage
    //
    // Der Kalender war eine Liste aus Titeln und einem Satz, der auf fuenf von
    // sieben Tagen derselbe war: "Grundlagenarbeit fuer die Saison." Kein
    // Gegner, kein Spiel, kein Grund hinzuschauen. In FM und EA FC traegt der
    // Kalender dagegen die Woche: Man sieht, gegen wen es geht, wer angeschlagen
    // ist, worauf trainiert wird und was demnaechst entschieden werden muss.

    /**
     * Das Pflichtspiel des eigenen Vereins.
     *
     * Ohne Spieltagsnummer das naechste ungespielte; mit Nummer genau das
     * dieses Spieltags. Letzteres braucht die Wochenansicht: Sie zeigt sieben
     * Tage, und die Tage nach dem naechsten Spiel gehoeren schon zum
     * uebernaechsten Gegner. Vorher stand auf allen sieben Karten derselbe
     * Gegner - auch auf denen, die nach dieser Partie liegen.
     */
    naechstesSpiel(state, spieltag = null) {
        if (!state || !Array.isArray(state.schedule)) return null;
        const eigene = state.userClubId;

        const runden = spieltag
            ? state.schedule.filter(r => r.matchday === spieltag)
            : state.schedule;

        for (const runde of runden) {
            const partie = (runde.matches || []).find(m =>
                (spieltag || !m.played) && (m.homeClubId === eigene || m.awayClubId === eigene));
            if (!partie) continue;

            const heim = partie.homeClubId === eigene;
            const gegnerId = heim ? partie.awayClubId : partie.homeClubId;
            const gegner = (state.clubs || []).find(c => c.id === gegnerId);
            const tabelle = state.standings || [];
            const platz = tabelle.findIndex(t => t.clubId === gegnerId) + 1;

            return {
                partie,
                spieltag: runde.matchday,
                heim,
                gegner,
                gegnerName: gegner?.name || "Gegner",
                gegnerPlatz: platz > 0 ? platz : null,
                gegnerForm: (gegner?.form || []).filter(f => f && f !== "-").slice(-5)
            };
        }
        return null;
    },

    /** Wie viele Spieler gerade ausfallen */
    kaderLage(state) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return { verletzt: 0, gesperrt: 0, muede: 0, kader: 0 };

        const kader = (club.playerIds || [])
            .map(id => (state.players || []).find(p => p.id === id))
            .filter(Boolean);

        return {
            kader: kader.length,
            verletzt: kader.filter(p => (p.injuredWeeks || 0) > 0).length,
            gesperrt: kader.filter(p => (p.suspendedMatches || 0) > 0).length,
            muede: kader.filter(p => (p.fitness ?? 100) < 75 && (p.injuredWeeks || 0) <= 0).length
        };
    },

    /**
     * Was an diesem Tag ansteht - als Satz, der etwas aussagt.
     *
     * Rueckgabe: { titel, text, marken[] }. Die Marken sind kurze Hinweise
     * fuer die Anzeige ("3 verletzt", "Transferfenster"), der Text die Zeile
     * darunter.
     */
    tagesInhalt(state, day) {
        if (!day) return { titel: "", text: "", marken: [] };

        const marken = [];
        const lage = this.kaderLage(state);
        // Der Gegner richtet sich nach dem Spieltag, zu dem dieser Tag
        // gehoert - nicht nach dem, der heute als naechster ansteht.
        const naechstes = this.naechstesSpiel(state, day.matchday || null);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);

        // Ausfälle sind nur dort eine Meldung, wo sie etwas ändern: vor dem
        // Spiel und in der Gegnervorbereitung. Auf jeder Tageskarte zu stehen
        // macht sie zu Tapete.
        const vorDemSpiel = day.type === CALENDAR_DAY_TYPES.MATCHDAY
            || day.type === CALENDAR_DAY_TYPES.OPPONENT_ANALYSIS;
        if (vorDemSpiel && lage.verletzt > 0) marken.push(`${lage.verletzt} verletzt`);
        if (vorDemSpiel && lage.gesperrt > 0) marken.push(`${lage.gesperrt} gesperrt`);

        // Ein Heimspiel waehrend des Stadionumbaus ist eine andere Partie:
        // Ein Teil der Raenge ist gesperrt, und das sieht man an den Einnahmen.
        if (day.type === CALENDAR_DAY_TYPES.MATCHDAY && club?.anlagen) {
            const fac = _getCalFacilityEngine();
            (fac?.ANLAGEN || []).forEach(k => {
                const p = club.anlagen[k]?.projekt;
                if (!p) return;
                marken.push(k === "stadium"
                    ? `Stadionumbau (noch ${p.restSpieltage})`
                    : `${fac.FACILITY_NAMES[k]}: Baustelle`);
            });
        }

        const gegnerSatz = () => {
            if (!naechstes) return "Kein Pflichtspiel angesetzt.";
            const wo = naechstes.heim ? "zu Hause gegen" : "auswärts bei";
            const rang = naechstes.gegnerPlatz ? `, Tabellenplatz ${naechstes.gegnerPlatz}` : "";
            return `${wo} ${naechstes.gegnerName}${rang}`;
        };

        switch (day.type) {
            case CALENDAR_DAY_TYPES.MATCHDAY: {
                if (!naechstes) {
                    return { titel: day.title, text: "Der Spieltag wird ausgetragen.", marken };
                }
                const form = naechstes.gegnerForm.length
                    ? ` Letzte Spiele: ${naechstes.gegnerForm.map(f => ({ W: "S", D: "U", L: "N" }[f] || f)).join(" ")}.`
                    : "";
                marken.unshift(naechstes.heim ? "Heimspiel" : "Auswärtsspiel");
                return {
                    titel: `${naechstes.spieltag}. Spieltag`,
                    text: `${naechstes.heim ? "Gegen" : "Bei"} ${naechstes.gegnerName}${naechstes.gegnerPlatz ? ` (${naechstes.gegnerPlatz}.)` : ""}.${form}`,
                    marken
                };
            }

            case CALENDAR_DAY_TYPES.OPPONENT_ANALYSIS:
                return {
                    titel: "Gegnervorbereitung",
                    text: `Videoanalyse und Abschlusstraining ${gegnerSatz()}.`,
                    marken
                };

            case CALENDAR_DAY_TYPES.TRAINING: {
                const fokus = this.FOKUS_TEXT[state.trainingSettings?.focus || "allround"] || "Grundlagen";
                const intensitaet = this.INTENSITAET_TEXT[state.trainingSettings?.intensity || "normal"] || "normal";
                if (lage.muede >= 3) marken.push(`${lage.muede} belastet`);
                return {
                    titel: day.title,
                    text: `Schwerpunkt ${fokus}, Intensität ${intensitaet}.`
                        + (lage.muede >= 4 ? ` ${lage.muede} Spieler sind deutlich belastet.` : ""),
                    marken
                };
            }

            case CALENDAR_DAY_TYPES.RECOVERY:
                if (lage.muede > 0) marken.push(`${lage.muede} unter 75 %`);
                return {
                    titel: "Regeneration",
                    text: lage.muede > 0
                        ? `Lockere Einheit - ${lage.muede === 1 ? "ein Spieler liegt" : `${lage.muede} Spieler liegen`} unter 75 % Fitness.`
                        : "Lockere Einheit, die Mannschaft ist frisch.",
                    marken
                };

            case CALENDAR_DAY_TYPES.TACTICS:
                return {
                    titel: "Taktiktraining",
                    text: `Abläufe und Standards ${gegnerSatz()}.`,
                    marken
                };

            case CALENDAR_DAY_TYPES.MEDIA:
                return {
                    titel: "Pressekonferenz",
                    text: naechstes
                        ? `Die Journalisten fragen nach dem Spiel ${gegnerSatz()}.`
                        : "Die Journalisten fragen nach der Lage im Verein.",
                    marken: [...marken, "Ihre Antwort zählt"]
                };

            case CALENDAR_DAY_TYPES.SPONSOR:
                return {
                    titel: "Sponsorentermin",
                    text: club?.sponsor?.name
                        ? `Empfang bei ${club.sponsor.name}.`
                        : "Empfang der Partner des Vereins.",
                    marken
                };

            case CALENDAR_DAY_TYPES.PRESEASON: {
                const pre = _getPreseasonEngine();
                const offen = (pre && state.preseason) ? pre.offenePunkte(state) : [];
                if (offen.length) marken.push(`${offen.length} offen`);
                return {
                    titel: "Vorbereitung",
                    text: offen.length ? offen.slice(0, 2).join(" · ") : "Alles erledigt - die Mannschaft ist bereit.",
                    marken
                };
            }

            case CALENDAR_DAY_TYPES.FRIENDLY: {
                const pre = _getPreseasonEngine();
                const geplant = (pre && state.preseason && typeof pre.terminBeschreibung === "function")
                    ? pre.terminBeschreibung(state, day.friendlyIndex ?? 0)
                    : null;
                return {
                    titel: day.title,
                    text: geplant || "Noch nicht verplant - der Sportdirektor besetzt den Termin kurzfristig.",
                    marken
                };
            }

            case CALENDAR_DAY_TYPES.CUP:
            case CALENDAR_DAY_TYPES.EURO:
                return this.pokalInhalt(state, day, marken);

            case CALENDAR_DAY_TYPES.SEASON_START:
                return { titel: day.title, text: "Kader sichten, Taktik festlegen, Vorbereitung planen.", marken };

            case CALENDAR_DAY_TYPES.SEASON_END:
                return { titel: day.title, text: "Meisterehrung, Abrechnung und Planung der neuen Saison.", marken };

            default:
                return { titel: day.title, text: day.description || "", marken };
        }
    },

    /**
     * Was an einem Pokal- oder Europapokalabend ansteht.
     *
     * Spielt der eigene Verein, steht hier der Gegner und die Runde; ist er
     * ausgeschieden, steht hier, was ohne ihn gespielt wird.
     */
    pokalInhalt(state, day, marken) {
        const cupEngine = _getCupEngineCal();
        const art = day.cupArt || (day.type === CALENDAR_DAY_TYPES.CUP ? "cup" : "euro");
        const runde = day.cupRunde || 0;

        const eigene = (cupEngine && typeof cupEngine.eigenePartieAm === "function")
            ? cupEngine.eigenePartieAm(state, art, runde)
            : null;

        if (eigene) {
            const heim = eigene.partie.homeClubId === state.userClubId;
            const gegnerId = heim ? eigene.partie.awayClubId : eigene.partie.homeClubId;
            const gegner = (state.clubs || []).find(c => c.id === gegnerId);
            const lage = this.kaderLage(state);
            if (lage.verletzt > 0) marken.push(`${lage.verletzt} verletzt`);
            marken.unshift(heim ? "Heimspiel" : "Auswärtsspiel");
            if (eigene.ko) marken.push("K.-o.-Spiel");

            return {
                titel: `${eigene.wettbewerb.name} · ${eigene.runde.roundName}`,
                text: `${heim ? "Gegen" : "Bei"} ${gegner?.name || "unbekannt"}.`
                    + (eigene.ko ? " Wer verliert, ist raus." : ""),
                marken
            };
        }

        if (art === "playoff") {
            const po = typeof PlayoffEngine !== "undefined" ? PlayoffEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./playoffEngine.js").PlayoffEngine; } catch (e) { return null; } })() : null);
            return { titel: "Relegation und Aufstiegsspiele", text: po ? po.tagesText(state, runde) : "", marken };
        }

        if (art === "cup") {
            const cup = state.cups?.de_cup;
            const raus = cup && (cup.ausgeschieden || []).includes(state.userClubId);
            const rundenName = cupEngine?.POKAL_RUNDEN?.[runde]?.name || "Pokalrunde";
            let text = "Die Pokalrunde wird ausgetragen.";
            if (raus) {
                text = "Ohne uns - der Pokal wird ohne unsere Beteiligung weitergespielt.";
            } else if (cup && cup.completed) {
                text = "Der Pokal ist entschieden.";
            } else if (cup && runde > cup.rundenIndex) {
                text = `${rundenName} - die Auslosung folgt nach der ${cup.runden[cup.rundenIndex]?.roundName || "laufenden Runde"}.`;
            } else if (cup && runde < cup.rundenIndex) {
                text = `${rundenName} - bereits ausgespielt.`;
            }
            return { titel: cup ? cup.name : "Pokalabend", text, marken };
        }

        return {
            titel: "Europapokal",
            text: "Internationaler Spieltag. Für uns steht heute nichts an.",
            marken
        };
    },

    FOKUS_TEXT: {
        allround: "Grundlagen", attack: "Offensive", defense: "Defensive",
        fitness: "Athletik", technique: "Technik", regeneration: "Regeneration",
        setpieces: "Standards", tactics: "Taktik"
    },

    INTENSITAET_TEXT: { low: "locker", normal: "normal", high: "hoch" },

    /**
     * Darf der Manager jetzt ein Spiel bestreiten - und welches?
     *
     * Das ist die einzige Stelle, die das entscheidet. Vorher fragte jede
     * Schaltflaeche den Spielplan selbst: Das Dashboard suchte die Partie des
     * laufenden Spieltags und bot sie an, ganz gleich, welcher Kalendertag
     * gerade war. In der Vorbereitung stand der erste Spieltag damit dreissig
     * Tage zu frueh zum Anpfiff bereit - ein Klick auf "Sofort berechnen"
     * spielte ihn aus, waehrend der Kalender noch auf Tag null stand. Vier
     * Wochen Vorbereitung, Testspiele und Turniere waren damit uebersprungen,
     * und der Kalender lief spaeter in denselben Spieltag noch einmal hinein.
     *
     * Rueckgabe: null, wenn heute nicht gespielt wird.
     */
    spielbarHeute(state) {
        if (!state || !state.userClubId) return null;
        const tag = this.getCurrentDay(state);
        if (!tag) return null;

        if (tag.type === CALENDAR_DAY_TYPES.MATCHDAY) {
            const runde = (state.schedule || []).find(r => r.matchday === state.currentMatchday);
            const partie = (runde?.matches || []).find(m =>
                m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
            if (!partie) return null;
            return {
                art: "liga",
                partie,
                gespielt: !!partie.played,
                rundenName: `${state.currentMatchday}. Spieltag`,
                wettbewerbId: state.userLeagueId,
                wettbewerbName: state.leagueName || "Liga",
                ko: false
            };
        }

        if (tag.type === CALENDAR_DAY_TYPES.CUP || tag.type === CALENDAR_DAY_TYPES.EURO) {
            const cupEngine = _getCupEngineCal();
            if (!cupEngine || typeof cupEngine.eigenePartieAm !== "function") return null;
            const art = tag.cupArt || (tag.type === CALENDAR_DAY_TYPES.CUP ? "cup" : "euro");
            const eigene = cupEngine.eigenePartieAm(state, art, tag.cupRunde || 0);
            if (!eigene) return null;
            return {
                art: tag.type === CALENDAR_DAY_TYPES.CUP ? "pokal" : "euro",
                partie: eigene.partie,
                gespielt: !!eigene.partie.played,
                rundenName: eigene.runde.roundName,
                wettbewerbId: eigene.wettbewerb.id || art,
                wettbewerbName: eigene.wettbewerb.name || "Pokal",
                ko: !!eigene.ko
            };
        }

        return null;
    },

    /**
     * Der naechste Termin, an dem der eigene Verein spielt.
     *
     * Anders als `naechsterHalt` zaehlt hier nur, was wirklich ein Spiel ist -
     * Pflichtspiel, Pokalabend oder Vorbereitungstermin. Die Karte auf dem
     * Dashboard lebt davon: Sie soll sagen, was als Naechstes kommt und wann,
     * statt unbesehen den ersten Spieltag anzuzeigen.
     */
    naechsterTermin(state) {
        if (!state || !Array.isArray(state.calendar)) return null;
        const start = state.currentDayIndex || 0;
        const cupEngine = _getCupEngineCal();
        const pre = _getPreseasonEngine();

        for (let i = start; i < state.calendar.length; i++) {
            const tag = state.calendar[i];
            const tage = i - start;

            if (tag.type === CALENDAR_DAY_TYPES.MATCHDAY) {
                const spiel = this.naechstesSpiel(state, tag.matchday || null);
                if (!spiel || spiel.partie.played) continue;
                return {
                    art: "liga", index: i, tage, tag,
                    titel: `${spiel.spieltag}. Spieltag`,
                    wettbewerb: state.leagueName || "Liga",
                    partie: spiel.partie,
                    heim: spiel.heim,
                    gegner: spiel.gegner,
                    gegnerName: spiel.gegnerName,
                    gegnerPlatz: spiel.gegnerPlatz
                };
            }

            if (tag.type === CALENDAR_DAY_TYPES.CUP || tag.type === CALENDAR_DAY_TYPES.EURO) {
                if (!cupEngine || typeof cupEngine.eigenePartieAm !== "function") continue;
                const art = tag.cupArt || (tag.type === CALENDAR_DAY_TYPES.CUP ? "cup" : "euro");
                const eigene = cupEngine.eigenePartieAm(state, art, tag.cupRunde || 0);
                if (!eigene) continue;
                const heim = eigene.partie.homeClubId === state.userClubId;
                const gegnerId = heim ? eigene.partie.awayClubId : eigene.partie.homeClubId;
                const gegner = (state.clubs || []).find(c => c.id === gegnerId);
                return {
                    art: tag.type === CALENDAR_DAY_TYPES.CUP ? "pokal" : "euro",
                    index: i, tage, tag,
                    titel: eigene.runde.roundName,
                    wettbewerb: eigene.wettbewerb.name || "Pokal",
                    partie: eigene.partie,
                    heim,
                    gegner,
                    gegnerName: gegner?.name || "Gegner",
                    gegnerPlatz: null,
                    ko: !!eigene.ko
                };
            }

            if (tag.type === CALENDAR_DAY_TYPES.FRIENDLY) {
                const geplant = (pre && state.preseason && typeof pre.terminBeschreibung === "function")
                    ? pre.terminBeschreibung(state, tag.friendlyIndex ?? 0)
                    : null;
                return {
                    art: "vorbereitung", index: i, tage, tag,
                    titel: tag.title || "Spieltermin",
                    wettbewerb: "Vorbereitung",
                    beschreibung: geplant,
                    offen: !geplant
                };
            }
        }
        return null;
    },

    /**
     * Der naechste Termin, an dem der Manager gebraucht wird.
     *
     * Danach richtet sich der eine Weiter-Knopf: Er sagt, wohin er springt,
     * statt "1 Tag simulieren" oder "Zum naechsten Spieltag" nebeneinander
     * anzubieten.
     */
    naechsterHalt(state) {
        if (!state || !Array.isArray(state.calendar)) return null;
        const start = (state.currentDayIndex || 0);

        for (let i = start; i < state.calendar.length; i++) {
            const tag = state.calendar[i];
            const heute = i === start;

            if (tag.type === CALENDAR_DAY_TYPES.MATCHDAY) {
                return { index: i, tag, grund: "matchday", heute };
            }
            // Ein Pokalabend hält den Manager nur auf, wenn er selbst spielt -
            // sonst läuft der Kalender darüber hinweg wie über jeden anderen
            // Tag.
            if (tag.type === CALENDAR_DAY_TYPES.CUP || tag.type === CALENDAR_DAY_TYPES.EURO) {
                const cupEngine = _getCupEngineCal();
                const art = tag.cupArt || (tag.type === CALENDAR_DAY_TYPES.CUP ? "cup" : "euro");
                const eigene = (cupEngine && typeof cupEngine.eigenePartieAm === "function")
                    ? cupEngine.eigenePartieAm(state, art, tag.cupRunde || 0)
                    : null;
                if (eigene) {
                    return { index: i, tag, grund: art === "cup" || art === "euro" ? art : "playoff", heute, partie: eigene };
                }
                continue;
            }
            if (tag.type === CALENDAR_DAY_TYPES.FRIENDLY) {
                return { index: i, tag, grund: "friendly", heute };
            }
            if (tag.type === CALENDAR_DAY_TYPES.MEDIA) {
                return { index: i, tag, grund: "media", heute };
            }
            // Ist die Saison schon abgeschlossen, führt der Weg gleich durch
            // die Sommerpause zum Saisonwechsel
            if (tag.type === CALENDAR_DAY_TYPES.SEASON_END && state._seasonFinished !== state.seasonYear) {
                return { index: i, tag, grund: "season_end", heute };
            }
            if (tag.saisonwechsel) {
                return { index: i, tag, grund: "season_change", heute };
            }
        }
        return null;
    },

    /** Post, bei der das Weiterlaufen anhält - Spielberichte und Trainingsberichte nicht */
    WICHTIGE_POST: ["scouting", "transfer_offer", "transfer_done", "injury", "board_message", "youth", "contract_expiring", "facility"],

    /**
     * Wie im Football Manager: Das Weiterlaufen hält nicht nur an festen
     * Terminen, sondern auch dann, wenn an einem Tag etwas passiert, das den
     * Manager angeht - ein Angebot, eine Antwort in einer Verhandlung, eine
     * Verletzung, ein Scoutbericht, wichtige Post. Vorher lief der Knopf vom
     * Medientag bis zum Anpfiff durch, und alles dazwischen stand erst
     * hinterher im Postfach.
     *
     * res ist das Ergebnis von advanceOneDay, bekannteIds die Nachrichten,
     * die vor dem Tag schon im Postfach lagen. Liefert den Grund oder null.
     */
    unterbrechungsGrund(state, res, bekannteIds = new Set()) {
        if (!state) return null;
        const angebot = (state.transferMarket?.offers || []).find(o => o.status === "pending" && o.gemeldet === false);
        if (angebot) return `💰 Angebot von ${angebot.fromClubName || "einem Verein"} für ${angebot.playerName || "einen Spieler"}`;
        const verhandlung = (res?.summary?.negotiations || []).find(s => s && s.negotiation);
        if (verhandlung) return `💬 Neues in der Verhandlung um ${verhandlung.negotiation.playerName}`;
        const verletzt = res?.summary?.training?.injuries?.[0];
        if (verletzt) return `⚠️ ${verletzt} hat sich im Training verletzt`;
        const post = (state.inbox || []).find(m => m && !bekannteIds.has(String(m.id))
            && (this.WICHTIGE_POST.includes(m.type) || m.priority === "high"));
        if (post) return `✉️ ${post.subject || post.title || "Neue Nachricht"}`;
        return null;
    },

    /**
     * Holt die nächsten X Tage ab dem aktuellen Tag
     */
    getUpcomingDays(state, count = 7) {
        if (!state) return [];
        if (!Array.isArray(state.calendar) || state.calendar.length === 0) {
            this.generateSeasonCalendar(state);
        }
        const idx = state.currentDayIndex || 0;
        return state.calendar.slice(idx, idx + count);
    },

    /**
     * Simuliert genau einen Tag vorwärts
     */
    /**
     * Ein Tag weiter - und danach der Blick aufs Transferfenster: Hat es
     * sich geöffnet oder geschlossen, ist heute sein letzter Tag?
     */
    advanceOneDay(state) {
        const res = this._tagWeiter(state);
        // Eine Anfrage an den Vorstand: Nach der Bedenkzeit kommt die Antwort
        const vorstand = _getBoardEngineCal();
        if (res && res.success && vorstand && typeof vorstand.anfrageTag === "function") {
            const antwort = vorstand.anfrageTag(state);
            if (antwort && res.summary && Array.isArray(res.summary.messages)) res.summary.messages.unshift(`👔 ${antwort.betreff}`);
        }
        const te = _getTransferEngineCal();
        if (res && res.success && te && typeof te.pruefeFensterwechsel === "function") {
            const meldungen = te.pruefeFensterwechsel(state, this.getCurrentDay(state));
            if (meldungen.length) {
                if (res.summary && Array.isArray(res.summary.messages)) meldungen.forEach(m => res.summary.messages.unshift(m));
                res.fenster = meldungen;
            }
        }
        return res;
    },

    _tagWeiter(state) {
        if (!state) return { success: false, error: "Kein State" };
        if (!Array.isArray(state.calendar) || state.calendar.length === 0) {
            this.generateSeasonCalendar(state);
        }

        // Ein Spielstand, der schon nach dem letzten Spieltag stand, bekommt
        // seine Sommerpause nachträglich
        if (state._seasonFinished === state.seasonYear) this.legeSommerpauseAn(state);

        const currentDay = this.getCurrentDay(state);
        if (!currentDay) {
            return { success: false, error: "Ungültiger Kalendertag" };
        }

        // Am letzten Tag der Sommerpause beginnt die neue Saison
        if (currentDay.saisonwechsel) {
            const seasonEngine = (typeof SeasonEngine !== 'undefined' && SeasonEngine)
                ? SeasonEngine
                : ((typeof window !== 'undefined' && window.SeasonEngine) ? window.SeasonEngine : (typeof require !== 'undefined' ? require('./seasonEngine.js').SeasonEngine : null));
            const alteSaison = state.seasonYear;
            currentDay.completed = true;
            if (seasonEngine) seasonEngine.startNextSeason(state);
            return {
                success: true,
                type: "season_change",
                alteSaison,
                neueSaison: state.seasonYear,
                day: currentDay,
                nextDay: this.getCurrentDay(state)
            };
        }

        // Vorbereitung: Der Fortschritt zaehlt mit, damit die Oberflaeche
        // zeigen kann, wie viel Zeit bis zum ersten Spieltag bleibt.
        if (currentDay.preseason && state.preseason && state.preseason.aktiv) {
            state.preseason.tagIndex = Math.min(state.preseason.dauer,
                (state.preseason.tagIndex || 0) + 1);

            // Die Vorbereitung ist die Zeit, in der sich die Kader der Welt
            // umbauen. Verteilt auf die vier Wochen statt an einem Tag - so
            // sieht man im Postfach und in der Tabelle, wie sich die Rivalen
            // nach und nach verstaerken.
            const transferEngine = _getTransferEngineCal();
            if (transferEngine && typeof transferEngine.processAiTransferWindow === "function") {
                transferEngine.processAiTransferWindow(state, 220);
            }
            // Die KI verleiht in der Vorbereitung ihre Talente ohne Einsätze
            const leihen = (typeof LoanEngine !== "undefined" && LoanEngine)
                ? LoanEngine
                : ((typeof window !== "undefined" && window.LoanEngine) ? window.LoanEngine : (typeof require !== "undefined" ? require("./loanEngine.js").LoanEngine : null));
            if (leihen && typeof leihen.kiLeihen === "function") leihen.kiLeihen(state, 6);
        }

        // In der Winterpause handeln auch die KI-Vereine - verteilt auf die
        // zwei Wochen, nicht nur an den Spieltagen danach
        if (currentDay.winterpause) {
            const transferEngine = _getTransferEngineCal();
            if (transferEngine && typeof transferEngine.processAiTransferWindow === "function"
                && typeof transferEngine.istTransferfenster === "function" && transferEngine.istTransferfenster(state)) {
                transferEngine.processAiTransferWindow(state, transferEngine.WINTER_KI_JE_TAG || 40);
            }
        }

        // Testspiel: zaehlt fuer keine Tabelle, aber fuer Spielpraxis
        if (currentDay.type === CALENDAR_DAY_TYPES.FRIENDLY) {
            const preseasonEngine = _getPreseasonEngine();
            let ergebnis = null;
            // Was an diesem Termin gespielt wird, hat der Manager selbst
            // geplant: ein Testspiel, eine Turnierrunde - oder nichts, dann
            // besetzt die Engine den Termin kurzfristig.
            if (preseasonEngine && state.preseason && typeof preseasonEngine.spieleSlot === "function") {
                // Live verfolgt: Die Oberflaeche reicht die gespielte Partie
                // herein, statt sie ein zweites Mal ausspielen zu lassen
                const gespielt = state.preseason.livePartie || null;
                delete state.preseason.livePartie;
                ergebnis = preseasonEngine.spieleSlot(state, currentDay.friendlyIndex ?? 0, gespielt);
            }
            currentDay.completed = true;
            if (state.currentDayIndex < state.calendar.length - 1) {
                state.currentDayIndex++;
                state.currentDate = state.calendar[state.currentDayIndex].date;
            }
            return {
                success: true,
                type: "friendly",
                friendly: ergebnis,
                day: currentDay,
                nextDay: this.getCurrentDay(state)
            };
        }

        // Pokal- und Europapokalabend: Die Partien der Welt werden ausgetragen,
        // die eigene übernimmt der Computer nur, wenn der Manager sie nicht
        // selbst gespielt hat.
        if (currentDay.type === CALENDAR_DAY_TYPES.CUP
            || currentDay.type === CALENDAR_DAY_TYPES.EURO) {
            const cupEngine = _getCupEngineCal();
            const art = currentDay.cupArt || (currentDay.type === CALENDAR_DAY_TYPES.CUP ? "cup" : "euro");
            const runde = currentDay.cupRunde || 0;
            let ergebnis = null;

            if (cupEngine) {
                ergebnis = cupEngine.spieleTermin(state, art, runde);
                const eigene = ergebnis && ergebnis.eigenePartie;
                if (eigene && !eigene.played) {
                    // Relegation und Playoffs entscheidet die PlayoffEngine über
                    // beide Spiele - ein einzelnes Remis ist dort kein Elfmeterfall
                    cupEngine.austragen(state, eigene, art === "cup" || (art === "euro" && runde >= 6));
                }
                cupEngine.schliesseTerminAb(state, art, runde);
            }
            // In der Sommerpause läuft der Tag sonst weiter wie jeder andere:
            // Verhandlungen, Erholung, Vereine werben um auslaufende Verträge
            const tagesBericht = currentDay.sommerpause ? this.applyDailyEffects(state, currentDay) : null;

            currentDay.completed = true;
            if (state.currentDayIndex < state.calendar.length - 1) {
                state.currentDayIndex++;
                state.currentDate = state.calendar[state.currentDayIndex].date;
            }
            return {
                success: true,
                type: currentDay.type,
                cup: ergebnis,
                summary: tagesBericht || undefined,
                day: currentDay,
                nextDay: this.getCurrentDay(state)
            };
        }

        // Länderspielpause: abstellen, spielen, zurückholen - der Rest des
        // Kaders trainiert ganz normal weiter (unten, mit den Tageseffekten)
        let laenderspiel = null;
        if (currentDay.laenderspiel) {
            const nationalEngine = _getNationalTeamEngine();
            if (nationalEngine) laenderspiel = nationalEngine.tag(state, currentDay.laenderspiel);
        }

        // Mit dem ersten Spieltag ist die Vorbereitung vorbei
        if (currentDay.type === CALENDAR_DAY_TYPES.MATCHDAY
            && state.preseason && state.preseason.aktiv) {
            const preseasonEngine = _getPreseasonEngine();
            if (preseasonEngine && typeof preseasonEngine.beende === "function") {
                preseasonEngine.beende(state);
            }
        }

        // Wenn heute ein Spieltag ist, muss das Spiel simuliert werden
        if (currentDay.type === CALENDAR_DAY_TYPES.MATCHDAY) {
            const seasonEngine = (typeof SeasonEngine !== 'undefined' && SeasonEngine) 
                ? SeasonEngine 
                : ((typeof window !== 'undefined' && window.SeasonEngine) ? window.SeasonEngine : (typeof require !== 'undefined' ? require('./seasonEngine.js').SeasonEngine : null));

            if (seasonEngine && typeof seasonEngine.advanceToNextMatchday === 'function') {
                const matchResult = seasonEngine.advanceToNextMatchday(state);
                currentDay.completed = true;
                
                // Kalenderindex um 1 weiterrücken
                if (state.currentDayIndex < state.calendar.length - 1) {
                    state.currentDayIndex++;
                    state.currentDate = state.calendar[state.currentDayIndex].date;
                }
                
                return {
                    success: true,
                    type: "matchday",
                    matchResult: matchResult,
                    day: currentDay,
                    nextDay: this.getCurrentDay(state)
                };
            }
        }

        // Tägliche Effekte anwenden (Training, Medien, Finanzen, Scouting)
        const dailySummary = this.applyDailyEffects(state, currentDay);
        // Der Lizenzlehrgang des Trainers läuft nebenher
        const trainerProfil = (typeof TrainerProfilEngine !== "undefined" && TrainerProfilEngine)
            ? TrainerProfilEngine
            : (typeof require !== "undefined" ? (() => { try { return require("./trainerProfilEngine.js").TrainerProfilEngine; } catch (e) { return null; } })() : null);
        const lehrgang = trainerProfil ? trainerProfil.tag(state) : null;
        if (lehrgang && dailySummary) dailySummary.messages.unshift(`🎓 Lizenzlehrgang bestanden: ${trainerProfil.LIZENZEN[lehrgang.bestanden].name}`);
        if (laenderspiel && dailySummary) {
            dailySummary.laenderspiel = laenderspiel;
            const meldung = this.laenderspielMeldung(state, currentDay.laenderspiel, laenderspiel);
            if (meldung) dailySummary.messages.unshift(meldung);
        }
        currentDay.completed = true;

        // Zum nächsten Tag wechseln
        if (state.currentDayIndex < state.calendar.length - 1) {
            state.currentDayIndex++;
            state.currentDate = state.calendar[state.currentDayIndex].date;
        }

        return {
            success: true,
            type: currentDay.type,
            summary: dailySummary,
            day: currentDay,
            nextDay: this.getCurrentDay(state)
        };
    },

    /** Eine Zeile für den Tagesbericht der Länderspielpause */
    laenderspielMeldung(state, schritt, ergebnis) {
        if (!ergebnis) return null;
        if (schritt === "abreise") {
            const n = (ergebnis.eigene || []).length;
            return n ? `🌍 ${n} Spieler bei ihren Nationalmannschaften` : "🌍 Länderspielpause - niemand aus dem Kader ist berufen";
        }
        const spiele = schritt === "rueckkehr" ? ergebnis.spiel : ergebnis;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        const eigene = new Set((club?.playerIds || []).map(String));
        const tore = (spiele || []).flatMap(s => s.torschuetzen).filter(t => eigene.has(String(t.id))).map(t => t.name);
        const teil = tore.length ? `Tore von ${[...new Set(tore)].join(", ")}` : "kein Tor aus dem eigenen Kader";
        if (schritt === "rueckkehr") {
            const verletzt = (ergebnis.zurueck?.verletzt || []).length;
            return `🌍 Länderspiele: ${teil}. Die Abgestellten sind zurück${verletzt ? `, ${verletzt} verletzt` : ""}.`;
        }
        return `🌍 Länderspiele: ${teil}.`;
    },

    /**
     * Simuliert schnell bis zum nächsten Spieltag vor
     */
    advanceToNextMatchday(state) {
        if (!state) return { success: false, error: "Kein State" };
        const results = [];
        let safetyCounter = 0;

        // Zwischen zwei Spieltagen können Pokalabend und Länderspielpause liegen
        while (safetyCounter < 20) {
            safetyCounter++;
            const currentDay = this.getCurrentDay(state);
            if (!currentDay) break;

            if (currentDay.type === CALENDAR_DAY_TYPES.MATCHDAY) {
                // Am Spieltag angekommen -> stoppen, damit der User Aufstellung wählen oder Live-Spiel schauen kann
                break;
            }

            const step = this.advanceOneDay(state);
            results.push(step);
            if (!step.success) break;
        }

        return {
            success: true,
            simulatedDays: results,
            currentDay: this.getCurrentDay(state)
        };
    },

    /**
     * Führt tägliche Effekte je nach Tagesart aus
     */
    applyDailyEffects(state, currentDay) {
        const userClub = state.clubs.find(c => c.id === state.userClubId);

        const summary = {
            type: currentDay.type,
            title: currentDay.title,
            messages: []
        };

        // 1. Der Trainerstab plant den Tag - sofern der Manager ihn lässt.
        // Ein Manager stellt keine Hütchen auf; er gibt die Richtung vor und
        // legt notfalls ein Veto ein.
        const staffEngine = (typeof CoachingStaffEngine !== 'undefined' && CoachingStaffEngine)
            ? CoachingStaffEngine
            : ((typeof window !== 'undefined' && window.CoachingStaffEngine) ? window.CoachingStaffEngine : (typeof require !== 'undefined' ? require('./coachingStaffEngine.js').CoachingStaffEngine : null));

        // In der Sommerpause und an freien Tagen der Winterpause hat die
        // Mannschaft frei: kein Plan, nur Erholung
        const trainingsArt = currentDay.sommerpause ? CALENDAR_DAY_TYPES.REST : (currentDay.trainingsArt || currentDay.type);
        if (staffEngine && typeof staffEngine.applyDailyPlan === 'function' && trainingsArt !== CALENDAR_DAY_TYPES.REST) {
            summary.plan = staffEngine.applyDailyPlan(state, trainingsArt);
        }

        // 2. Trainingsbetrieb: Belastung, Erholung, Entwicklung und Risiko
        // laufen jetzt Tag für Tag statt im Wochenblock.
        const trainingEngine = (typeof TrainingEngine !== 'undefined' && TrainingEngine)
            ? TrainingEngine
            : ((typeof window !== 'undefined' && window.TrainingEngine) ? window.TrainingEngine : (typeof require !== 'undefined' ? require('./trainingEngine.js').TrainingEngine : null));

        if (trainingEngine && typeof trainingEngine.processDailyTraining === 'function') {
            const tag = trainingEngine.processDailyTraining(state, trainingsArt);
            summary.training = tag;

            if (summary.plan) {
                const kopf = summary.plan.vomManager
                    ? "🧑‍💼 Ihre Vorgabe"
                    : `🧑‍🏫 ${summary.plan.stabTitel || "Trainerstab"}`;
                summary.messages.push(`${kopf}: ${staffEngine.focusLabel(summary.plan.focus)}, ${staffEngine.intensityLabel(summary.plan.intensity)}. ${summary.plan.grund}`);
            }

            // Wer stach heraus, wer hing hinterher?
            if (Array.isArray(tag.standouts)) {
                tag.standouts.forEach(s => summary.messages.push(`📈 ${s}`));
            }
            if (Array.isArray(tag.concerns)) {
                tag.concerns.forEach(s => summary.messages.push(`📉 ${s}`));
            }

            tag.injuries.forEach(name => {
                summary.messages.push(`⚠️ ${name} hat sich im Training verletzt.`);
            });
            // Entwicklungsplan: Umschulungen und was sich einer beim Mentor abschaut
            (tag.plan || []).forEach(m => summary.messages.push(m));
        }

        // Einmal im Monat: Leihbericht und Nachfragen der Stammvereine
        const leihen = (typeof LoanEngine !== 'undefined' && LoanEngine)
            ? LoanEngine
            : ((typeof window !== 'undefined' && window.LoanEngine) ? window.LoanEngine : (typeof require !== 'undefined' ? require('./loanEngine.js').LoanEngine : null));
        const heute = (state.seasonYear || 1) * 1000 + (state.currentDayIndex || 0);
        if (typeof state.leihberichtTag !== 'number') state.leihberichtTag = heute;
        if (leihen && typeof leihen.monatlich === 'function' && heute - state.leihberichtTag >= 28) {
            state.leihberichtTag = heute;
            leihen.monatlich(state).forEach(m => summary.messages.push(m));
        }

        // Am Monatswechsel: der Entwicklungsbericht des Co-Trainers
        const planEngine = (typeof DevelopmentPlanEngine !== 'undefined' && DevelopmentPlanEngine)
            ? DevelopmentPlanEngine
            : ((typeof window !== 'undefined' && window.DevelopmentPlanEngine) ? window.DevelopmentPlanEngine
                : (typeof require !== 'undefined' ? (() => { try { return require('./developmentPlanEngine.js').DevelopmentPlanEngine; } catch (e) { return null; } })() : null));
        if (planEngine && typeof planEngine.pruefeMonatsbericht === 'function') {
            const zeile = planEngine.pruefeMonatsbericht(state, currentDay.date);
            if (zeile) summary.messages.push(zeile);
        }

        // Die Sportpresse: Saisonvorschau zum Start, Gerüchte im offenen Fenster
        const presse = (typeof LigaNachrichtenEngine !== 'undefined' && LigaNachrichtenEngine)
            ? LigaNachrichtenEngine
            : ((typeof window !== 'undefined' && window.LigaNachrichtenEngine) ? window.LigaNachrichtenEngine
                : (typeof require !== 'undefined' ? (() => { try { return require('./ligaNachrichtenEngine.js').LigaNachrichtenEngine; } catch (e) { return null; } })() : null));
        if (presse && typeof presse.saisonvorschau === 'function') {
            if (!currentDay.sommerpause && presse.saisonvorschau(state)) summary.messages.push("📰 Die Saisonvorschau der Presse liegt im Postfach.");
            const markt = _getTransferEngineCal ? _getTransferEngineCal() : null;
            const offen = markt && typeof markt.istTransferfenster === 'function' ? markt.istTransferfenster(state) : false;
            const geruecht = presse.geruechtTag(state, offen);
            if (geruecht) summary.messages.push(`🗞️ Gerüchteküche: ${geruecht.spieler} zu ${geruecht.verein}?`);
        }

        // Am Monatsersten: Spieler, Talent und Trainer des Monats
        const preise = (typeof AuszeichnungEngine !== 'undefined' && AuszeichnungEngine)
            ? AuszeichnungEngine
            : ((typeof window !== 'undefined' && window.AuszeichnungEngine) ? window.AuszeichnungEngine
                : (typeof require !== 'undefined' ? (() => { try { return require('./auszeichnungEngine.js').AuszeichnungEngine; } catch (e) { return null; } })() : null));
        if (preise && typeof preise.pruefeMonat === 'function') {
            const zeile = preise.pruefeMonat(state, currentDay.date);
            if (zeile) summary.messages.push(zeile);
        }

        // Am Monatsersten: fällige Ablöseraten
        const ratenEngine = (typeof FinanceEngine !== 'undefined' && FinanceEngine)
            ? FinanceEngine
            : ((typeof window !== 'undefined' && window.FinanceEngine) ? window.FinanceEngine
                : (typeof require !== 'undefined' ? (() => { try { return require('./financeEngine.js').FinanceEngine; } catch (e) { return null; } })() : null));
        if (ratenEngine && typeof ratenEngine.zahleRaten === 'function') {
            const zeile = ratenEngine.zahleRaten(state, currentDay.date);
            if (zeile) summary.messages.push(zeile);
        }

        // Die Vision des Vorstands - neu bei Amtsantritt und nach einem Vereinswechsel
        const vision = (typeof VisionEngine !== 'undefined' && VisionEngine)
            ? VisionEngine
            : ((typeof window !== 'undefined' && window.VisionEngine) ? window.VisionEngine
                : (typeof require !== 'undefined' ? (() => { try { return require('./visionEngine.js').VisionEngine; } catch (e) { return null; } })() : null));
        if (vision && typeof vision.vision === 'function') vision.vision(state);

        // Investoren: Angebot, Suche und Verkaufsauflage
        const investoren = (typeof InvestorEngine !== 'undefined' && InvestorEngine)
            ? InvestorEngine
            : ((typeof window !== 'undefined' && window.InvestorEngine) ? window.InvestorEngine
                : (typeof require !== 'undefined' ? (() => { try { return require('./investorEngine.js').InvestorEngine; } catch (e) { return null; } })() : null));
        if (investoren && typeof investoren.tag === 'function') {
            const zeile = investoren.tag(state);
            if (zeile) summary.messages.push(zeile);
        }

        // Der Trainer auf dem Markt: Antworten auf Bewerbungen, verfallene Angebote
        const jobmarkt = (typeof JobmarktEngine !== 'undefined' && JobmarktEngine)
            ? JobmarktEngine
            : ((typeof window !== 'undefined' && window.JobmarktEngine) ? window.JobmarktEngine
                : (typeof require !== 'undefined' ? (() => { try { return require('./jobmarktEngine.js').JobmarktEngine; } catch (e) { return null; } })() : null));
        if (jobmarkt && typeof jobmarkt.tag === 'function') {
            const zeile = jobmarkt.tag(state);
            if (zeile) summary.messages.push(zeile);
        }

        // 1b. Lücken in den Aufstellungen schließen. Wer sich verletzt, fällt
        // aus Elf und Bank - ohne Nachrücker stand ein Verein nach ein paar
        // Wochen dauerhaft mit zehn Mann da.
        const gameState = (typeof GameState !== 'undefined' && GameState)
            ? GameState
            : ((typeof window !== 'undefined' && window.GameState) ? window.GameState : (typeof require !== 'undefined' ? require('./gameState.js').GameState : null));

        if (gameState && typeof gameState.repairLineup === 'function') {
            // Das Spielerverzeichnis wird einmal gebaut und an alle Vereine
            // weitergereicht - nicht je Verein neu.
            const index = typeof gameState.buildPlayerIndex === 'function'
                ? gameState.buildPlayerIndex(state.players)
                : null;
            const eigeneGeaendert = userClub ? gameState.repairLineup(userClub, state.players, index) : false;
            state.clubs.forEach(club => {
                if (club !== userClub) gameState.repairLineup(club, state.players, index);
            });
            if (eigeneGeaendert) {
                summary.messages.push("Die Aufstellung wurde um die Ausfälle ergänzt.");
            }
        }

        // 1c. Angebote für eigene Spieler haben eine Frist, und die Vorbereitung
        // erinnert an offene Pflichtposten im Trainerstab
        const transferEngineTag = _getTransferEngineCal();
        if (transferEngineTag && typeof transferEngineTag.pruefeAngebotsfristen === "function") {
            transferEngineTag.pruefeAngebotsfristen(state).forEach(o => {
                summary.messages.push(`💰 Das Angebot von ${o.fromClubName} für ${o.playerName} ist verfallen.`);
            });
        }
        const youthEngineTag = (typeof YouthEngine !== "undefined" && YouthEngine)
            ? YouthEngine
            : ((typeof window !== "undefined" && window.YouthEngine) ? window.YouthEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./youthEngine.js").YouthEngine; } catch (e) { return null; } })() : null));
        if (youthEngineTag && typeof youthEngineTag.pruefeJugendtag === "function") {
            const jugend = youthEngineTag.pruefeJugendtag(state);
            if (jugend) summary.messages.push(jugend);
            // Unter dem Jahr: ein Talent aus dem Probetraining
            const probe = typeof youthEngineTag.pruefeProbetraining === "function" ? youthEngineTag.pruefeProbetraining(state) : null;
            if (probe) summary.messages.push(probe);
        }
        // Alle zwei Wochen: die Spielervorschläge des Sportdirektors
        const sportdirektor = (typeof SportdirektorEngine !== "undefined" && SportdirektorEngine)
            ? SportdirektorEngine
            : ((typeof window !== "undefined" && window.SportdirektorEngine) ? window.SportdirektorEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./sportdirektorEngine.js").SportdirektorEngine; } catch (e) { return null; } })() : null));
        if (sportdirektor && typeof sportdirektor.pruefeTag === "function") {
            const vorschlag = sportdirektor.pruefeTag(state);
            if (vorschlag) summary.messages.push(vorschlag);
        }
        // Beobachtungen der Scouts: Nach einigen Tagen kommt der Bericht
        const scoutingEngineTag = (typeof ScoutingEngine !== "undefined" && ScoutingEngine)
            ? ScoutingEngine
            : ((typeof window !== "undefined" && window.ScoutingEngine) ? window.ScoutingEngine
                : (typeof require !== "undefined" ? (() => { try { return require("./scoutingEngine.js").ScoutingEngine; } catch (e) { return null; } })() : null));
        if (scoutingEngineTag && typeof scoutingEngineTag.pruefeBeobachtungen === "function") {
            scoutingEngineTag.pruefeBeobachtungen(state).forEach(f => {
                summary.messages.push(`🔍 Scoutbericht über ${f.player.name}: ${f.report.recommendation} (Postfach).`);
            });
        }
        const preseasonEngineTag = _getPreseasonEngine();
        if (preseasonEngineTag && typeof preseasonEngineTag.erinnere === "function") {
            const erinnerung = preseasonEngineTag.erinnere(state);
            if (erinnerung) {
                summary.messages.push(`⚠️ Noch ${erinnerung.rest} Tag(e) bis zum Saisonstart: ${erinnerung.luecken.map(b => b.titel).join(", ")} fehlt.`);
            }
        }

        // 2. Verhandlungen mit Vereinen und Beratern laufen weiter
        const negotiationEngine = (typeof NegotiationEngine !== 'undefined' && NegotiationEngine)
            ? NegotiationEngine
            : ((typeof window !== 'undefined' && window.NegotiationEngine) ? window.NegotiationEngine : (typeof require !== 'undefined' ? require('./negotiationEngine.js').NegotiationEngine : null));

        if (negotiationEngine && typeof negotiationEngine.processDay === 'function') {
            const schritte = negotiationEngine.processDay(state);
            summary.negotiations = schritte;
            schritte.forEach(schritt => {
                if (!schritt || !schritt.negotiation) return;
                summary.messages.push(`💬 ${schritt.negotiation.playerName}: ${negotiationEngine.describe(schritt.negotiation)}`);
            });
        }

        // 2b. Andere Vereine werben um Spieler mit auslaufendem Vertrag: ab
        // Januar mit Anfrage und Bedenkzeit, in der Sommerpause direkt
        const seasonEngineTag = (typeof SeasonEngine !== 'undefined' && SeasonEngine)
            ? SeasonEngine
            : ((typeof window !== 'undefined' && window.SeasonEngine) ? window.SeasonEngine : (typeof require !== 'undefined' ? require('./seasonEngine.js').SeasonEngine : null));
        if (currentDay.sommerpause) {
            if (seasonEngineTag && typeof seasonEngineTag.sommerpauseTag === 'function') {
                seasonEngineTag.sommerpauseTag(state).forEach(m => summary.messages.push(m));
            }
        } else if (seasonEngineTag && typeof seasonEngineTag.vorvertragTag === 'function') {
            seasonEngineTag.vorvertragTag(state).forEach(m => summary.messages.push(m));
        }

        // 3. Medientag / Pressekonferenz
        if (currentDay.type === CALENDAR_DAY_TYPES.MEDIA) {
            state.mediaPressure = state.mediaPressure || 50;
            // Ausgeglichene Pressearbeit stabilisiert Medien und Fans
            state.fanMood = Math.min(100, Math.max(20, (state.fanMood || 75) + (Math.random() > 0.4 ? 1 : -1)));
            summary.messages.push("Pressekonferenz vor dem Spieltag erfolgreich abgehalten.");
        }

        // 4. Sponsorentag
        else if (currentDay.type === CALENDAR_DAY_TYPES.SPONSOR) {
            const bonusIncome = 50000 + Math.floor(Math.random() * 50000);
            if (userClub) {
                userClub.budget = (userClub.budget || 0) + bonusIncome;
                const financeEngine = (typeof FinanceEngine !== 'undefined' && FinanceEngine) 
                    ? FinanceEngine 
                    : ((typeof window !== 'undefined' && window.FinanceEngine) ? window.FinanceEngine : (typeof require !== 'undefined' ? require('./financeEngine.js').FinanceEngine : null));
                if (financeEngine && typeof financeEngine.recordTransaction === 'function') {
                    financeEngine.recordTransaction(state, userClub.id, "sponsor_event", bonusIncome, "Sponsoren-Aktivierungstag Bonus");
                }
            }
            summary.messages.push(`Sponsorentermin abgeschlossen. Einnahmen: +${bonusIncome.toLocaleString('de-DE')} €.`);
        }

        // 5. Taktikschulung
        else if (currentDay.type === CALENDAR_DAY_TYPES.TACTICS) {
            const taktik = (typeof TacticsEngine !== 'undefined' && TacticsEngine)
                ? TacticsEngine
                : ((typeof window !== 'undefined' && window.TacticsEngine) ? window.TacticsEngine : (typeof require !== 'undefined' ? require('./tacticsEngine.js').TacticsEngine : null));
            if (userClub && userClub.chemistry) {
                userClub.chemistry.tacticalFamiliarity = Math.min(100, (userClub.chemistry.tacticalFamiliarity || 70) + 2);
                userClub.chemistry.overall = Math.min(100, (userClub.chemistry.overall || 70) + 1);
            }
            // Eine Taktikeinheit schleift die aktuelle Formation und Spielweise ein
            if (userClub && taktik && typeof taktik.vertrautheitUeben === 'function') {
                const profilT = (typeof TrainerProfilEngine !== "undefined" && TrainerProfilEngine)
                    ? TrainerProfilEngine
                    : (typeof require !== "undefined" ? (() => { try { return require("./trainerProfilEngine.js").TrainerProfilEngine; } catch (e) { return null; } })() : null);
                const wert = taktik.vertrautheitUeben(userClub, 0.08 * (profilT ? profilT.faktor(state, "taktik", 0.25) : 1), 0);
                summary.messages.push(`Taktikschulung abgeschlossen. Die Mannschaft ist zu ${Math.round(wert * 100)} % mit ihrer Taktik vertraut.`);
            } else {
                summary.messages.push("Taktikschulung abgeschlossen. Taktische Vertrautheit +2%.");
            }
        }

        // 6. Gegneranalyse
        else if (currentDay.type === CALENDAR_DAY_TYPES.OPPONENT_ANALYSIS) {
            summary.messages.push("Detaillierter Gegner-Scoutingbericht liegt im Postfach bereit.");
        }

        // Scouting & Jugendfortschritt täglich leicht weiterlaufen lassen
        if (state.scouting && Array.isArray(state.scouting.assignments)) {
            state.scouting.assignments.forEach(a => {
                if (a.status === "active" && a.matchdaysRemaining > 0 && Math.random() < 0.2) {
                    a.matchdaysRemaining = Math.max(0, a.matchdaysRemaining - 1);
                }
            });
        }

        // 6b. Die Kabine beruhigt sich langsam wieder. Ohne das bliebe eine
        // Mannschaft nach einer Klatsche für immer am Boden.
        const dressingRoom = (typeof DressingRoomEngine !== 'undefined' && DressingRoomEngine)
            ? DressingRoomEngine
            : ((typeof window !== 'undefined' && window.DressingRoomEngine) ? window.DressingRoomEngine : (typeof require !== 'undefined' ? require('./dressingRoomEngine.js').DressingRoomEngine : null));

        if (dressingRoom && typeof dressingRoom.settleDaily === 'function') {
            dressingRoom.settleDaily(state);
        }

        // 7. Vereinsleben: Zwischen den Spieltagen passiert im echten Verein
        // ständig etwas. Ohne das war "nächsten Tag simulieren" ein Knopf, der
        // nur das Datum weiterschob.
        this.clubLifeEvents(state, currentDay, userClub).forEach(m => summary.messages.push(m));

        return summary;
    },

    /**
     * Kleine Ereignisse aus dem Vereinsalltag.
     *
     * Nichts davon entscheidet eine Saison - aber zusammen sorgen sie dafür,
     * dass ein Dienstag nach etwas aussieht. Pro Tag kommt höchstens eines
     * durch, damit der Bericht lesbar bleibt.
     */
    clubLifeEvents(state, currentDay, userClub) {
        if (!userClub) return [];

        const kaderIds = new Set(userClub.playerIds);
        const kader = state.players.filter(p => kaderIds.has(p.id));
        if (kader.length === 0) return [];

        const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];
        const ereignisse = [];

        // a) Ein Spieler sucht das Gespräch - und wartet auf eine Antwort.
        // Vorher stieg seine Zufriedenheit dabei von selbst um vier Punkte,
        // ohne dass der Manager ein Wort gesagt hatte.
        const gespraeche = (typeof PlayerTalkEngine !== 'undefined' && PlayerTalkEngine)
            ? PlayerTalkEngine
            : ((typeof window !== 'undefined' && window.PlayerTalkEngine) ? window.PlayerTalkEngine : (typeof require !== 'undefined' ? require('./playerTalkEngine.js').PlayerTalkEngine : null));
        if (gespraeche && typeof gespraeche.taeglich === 'function') {
            gespraeche.taeglich(state).forEach(m => ereignisse.push(m));
        }

        // b) Ein Talent aus der Akademie drängt nach oben
        const talente = (state.youthAcademy?.prospects || []).filter(t => !t.promoted);
        if (talente.length > 0 && Math.random() < 0.1) {
            const t = zufall(talente);
            ereignisse.push(`🎓 Der Nachwuchstrainer meldet ${t.name} (${t.pos}, ${t.age}) für das Mannschaftstraining an.`);
        }

        // c) Die Medizinabteilung meldet sich
        const angeschlagen = kader.filter(p => (p.injuredWeeks || 0) <= 0 && (p.fitness ?? 100) < 65);
        if (angeschlagen.length > 0 && Math.random() < 0.14) {
            const p = zufall(angeschlagen);
            ereignisse.push(`🏥 Die Medizinabteilung rät, ${p.name} eine Einheit auszusetzen.`);
        }

        // d) Presse und Umfeld
        if (currentDay.type === CALENDAR_DAY_TYPES.MEDIA || Math.random() < 0.08) {
            const stimmung = state.fanMood || 75;
            const themen = stimmung >= 78
                ? [`📰 Die Lokalpresse lobt die Entwicklung der Mannschaft.`,
                   `📰 Ein Fanclub lädt die Mannschaft zum Grillabend - die Stimmung im Umfeld ist ausgezeichnet.`]
                : stimmung >= 55
                    ? [`📰 Die Presse fragt nach der Ausrichtung für die kommenden Wochen.`,
                       `📰 Im Umfeld wird über die Aufstellung diskutiert.`]
                    : [`📰 Kritische Töne in der Presse - das Umfeld wird ungeduldig.`,
                       `📰 Ein Fanbanner fordert Veränderungen.`];
            ereignisse.push(zufall(themen));
        }

        // e) Der Vorstand schaut auf die Zahlen
        if (Math.random() < 0.06) {
            const kontostand = userClub.balance || 0;
            ereignisse.push(kontostand < 0
                ? `👔 Der Vorstand mahnt: Das Konto steht bei ${(kontostand / 1e6).toFixed(1).replace(".", ",")} Mio. €.`
                : `👔 Der Vorstand ist mit der wirtschaftlichen Entwicklung zufrieden.`);
        }

        // Höchstens zwei Meldungen am Tag, sonst ertrinkt der Bericht
        return ereignisse.slice(0, 2);
    },

    formatDate(d) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    },

    getDayName(d) {
        const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
        return days[d.getDay()];
    }
};

if (typeof window !== "undefined") {
    window.CalendarEngine = CalendarEngine;
    window.CALENDAR_DAY_TYPES = CALENDAR_DAY_TYPES;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalendarEngine, CALENDAR_DAY_TYPES };
}
