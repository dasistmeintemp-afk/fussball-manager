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
    SEASON_END: "season_end"
};

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

        // Startdatum festlegen: 2026-08-01 (Samstag vor Spieltag 1)
        const startDate = new Date(2026, 7, 1); // 1. August 2026
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

        // Für jeden Spieltag eine typische Vorbereitungswoche generieren
        for (let md = 1; md <= totalMatchdays; md++) {
            // 1. Regeneration / Analyse
            calendar.push({
                id: `day_${dayCounter}`,
                dayIndex: dayCounter,
                date: this.formatDate(currentDate),
                dateObj: new Date(currentDate).toISOString(),
                dayOfWeek: this.getDayName(currentDate),
                type: CALENDAR_DAY_TYPES.RECOVERY,
                title: "Regeneration & Erholung",
                description: "Leichte Erholungseinheit. Spieler frischen ihre Fitness auf.",
                matchday: null,
                actionsAvailable: ["recovery", "training", "physio"],
                completed: false
            });
            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;

            // 2. Team-Trainingstag
            calendar.push({
                id: `day_${dayCounter}`,
                dayIndex: dayCounter,
                date: this.formatDate(currentDate),
                dateObj: new Date(currentDate).toISOString(),
                dayOfWeek: this.getDayName(currentDate),
                type: CALENDAR_DAY_TYPES.TRAINING,
                title: "Schwerpunkt-Training",
                description: "Intensives Mannschaftstraining gemäß gewähltem Trainingsfokus.",
                matchday: null,
                actionsAvailable: ["training", "individual_training"],
                completed: false
            });
            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;

            // 3. Medien- / Sponsorentag (abwechselnd)
            const isMedia = md % 2 === 1;
            calendar.push({
                id: `day_${dayCounter}`,
                dayIndex: dayCounter,
                date: this.formatDate(currentDate),
                dateObj: new Date(currentDate).toISOString(),
                dayOfWeek: this.getDayName(currentDate),
                type: isMedia ? CALENDAR_DAY_TYPES.MEDIA : CALENDAR_DAY_TYPES.SPONSOR,
                title: isMedia ? "Pressekonferenz & Medientermin" : "Sponsorenempfang & Partnertreffen",
                description: isMedia 
                    ? "Stellen Sie sich den Fragen der Journalisten vor dem kommenden Spieltag." 
                    : "Pflege der Klub-Sponsoren. Generiert wichtige Zusatzeinnahmen.",
                matchday: null,
                actionsAvailable: isMedia ? ["press", "interview"] : ["sponsor", "finance"],
                completed: false
            });
            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;

            // 4. Taktikanalyse
            calendar.push({
                id: `day_${dayCounter}`,
                dayIndex: dayCounter,
                date: this.formatDate(currentDate),
                dateObj: new Date(currentDate).toISOString(),
                dayOfWeek: this.getDayName(currentDate),
                type: CALENDAR_DAY_TYPES.TACTICS,
                title: "Taktik- & Standardschulung",
                description: "Einstudieren von Spielzügen und Standardsituationen (Ecken, Freistöße).",
                matchday: null,
                actionsAvailable: ["tactics", "setpieces"],
                completed: false
            });
            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;

            // 5. Gegneranalyse & Abschlusstraining
            calendar.push({
                id: `day_${dayCounter}`,
                dayIndex: dayCounter,
                date: this.formatDate(currentDate),
                dateObj: new Date(currentDate).toISOString(),
                dayOfWeek: this.getDayName(currentDate),
                type: CALENDAR_DAY_TYPES.OPPONENT_ANALYSIS,
                title: `Gegnervorbereitung: Spieltag ${md}`,
                description: "Detaillierte Analyse des nächsten Gegners und finales Anschwitzen.",
                matchday: md,
                actionsAvailable: ["analysis", "lineup", "tactics"],
                completed: false
            });
            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;

            // 6. SPIELTAG
            calendar.push({
                id: `day_${dayCounter}`,
                dayIndex: dayCounter,
                date: this.formatDate(currentDate),
                dateObj: new Date(currentDate).toISOString(),
                dayOfWeek: this.getDayName(currentDate),
                type: CALENDAR_DAY_TYPES.MATCHDAY,
                title: `⚽ ${md}. Spieltag: Liga 1`,
                description: `Offizieller Ligaspieltag ${md}. Alle Begegnungen der Liga werden ausgetragen.`,
                matchday: md,
                actionsAvailable: ["match", "lineup", "live_match"],
                completed: false
            });
            currentDate.setDate(currentDate.getDate() + 1);
            dayCounter++;
        }

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
    advanceOneDay(state) {
        if (!state) return { success: false, error: "Kein State" };
        if (!Array.isArray(state.calendar) || state.calendar.length === 0) {
            this.generateSeasonCalendar(state);
        }

        const currentDay = this.getCurrentDay(state);
        if (!currentDay) {
            return { success: false, error: "Ungültiger Kalendertag" };
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

    /**
     * Simuliert schnell bis zum nächsten Spieltag vor
     */
    advanceToNextMatchday(state) {
        if (!state) return { success: false, error: "Kein State" };
        const results = [];
        let safetyCounter = 0;

        while (safetyCounter < 10) {
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
        const players = state.players.filter(p => userClub && userClub.playerIds.includes(p.id));
        const newsEngine = (typeof NewsEngine !== 'undefined' && NewsEngine) 
            ? NewsEngine 
            : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : (typeof require !== 'undefined' ? require('./newsEngine.js').NewsEngine : null));

        const summary = {
            type: currentDay.type,
            title: currentDay.title,
            messages: []
        };

        // 1. Regeneration
        if (currentDay.type === CALENDAR_DAY_TYPES.RECOVERY) {
            players.forEach(p => {
                if (p.fitness < 100) {
                    p.fitness = Math.min(100, p.fitness + 5 + Math.floor(Math.random() * 5));
                }
            });
            summary.messages.push("Fitness des Kaders regeneriert (+5 bis +10%).");
        }

        // 2. Trainingstag
        else if (currentDay.type === CALENDAR_DAY_TYPES.TRAINING) {
            const focus = state.trainingSettings?.focus || "allround";
            const intensity = state.trainingSettings?.intensity || "normal";
            let fitnessDelta = intensity === "high" ? -4 : (intensity === "low" ? 0 : -2);
            
            players.forEach(p => {
                p.fitness = Math.max(50, p.fitness + fitnessDelta);
                p.form = Math.min(100, Math.max(40, p.form + (Math.random() > 0.5 ? 1 : 0)));
                
                // Talent-Chance
                if (p.age <= 21 && Math.random() < 0.15 && p.overall < p.pot) {
                    p.overall = Math.min(p.pot, p.overall + 1);
                    if (newsEngine) {
                        newsEngine.addMessage(state, "training_report", {
                            subject: `Entwicklungssprung: ${p.name}`,
                            sender: "Cheftrainer",
                            body: `${p.name} (Talent, ${p.age} Jahre) hat im Training überzeugt und seine Gesamtstärke auf ${p.overall} gesteigert!`,
                            priority: "normal"
                        });
                    }
                }
            });

            // Verletzungsrisiko bei harter Intensität
            if (intensity === "high" && Math.random() < 0.05 && players.length > 0) {
                const injured = players[Math.floor(Math.random() * players.length)];
                if (injured && injured.injuredWeeks === 0) {
                    injured.injuredWeeks = 1 + Math.floor(Math.random() * 2);
                    if (newsEngine) {
                        newsEngine.createInjuryNews(state, injured, injured.injuredWeeks, "Muskelverhärtung im Training");
                    }
                }
            }

            summary.messages.push(`Training absolviert (Schwerpunkt: ${focus}, Intensität: ${intensity}).`);
        }

        // 3. Medientag / Pressekonferenz
        else if (currentDay.type === CALENDAR_DAY_TYPES.MEDIA) {
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
            if (userClub && userClub.chemistry) {
                userClub.chemistry.tacticalFamiliarity = Math.min(100, (userClub.chemistry.tacticalFamiliarity || 70) + 2);
                userClub.chemistry.overall = Math.min(100, (userClub.chemistry.overall || 70) + 1);
            }
            summary.messages.push("Taktikschulung abgeschlossen. Taktische Vertrautheit +2%.");
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

        return summary;
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
