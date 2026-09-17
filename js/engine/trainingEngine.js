/**
 * TrainingEngine - Wöchentliches Training, Fitness-Regeneration, Spielerentwicklung & Verletzungen
 */

class TrainingEngine {
    /** Intensitätsstufen: Belastung, Entwicklung und Risiko hängen daran */
    static INTENSITY_PROFILE = {
        low:    { load: 4.5, gain: 0.7,  risk: 0.5, recovery: 1.3, label: "Locker" },
        normal: { load: 7.5, gain: 1.0,  risk: 1.0, recovery: 1.0, label: "Normal" },
        high:   { load: 12,  gain: 1.35, risk: 2.1, recovery: 0.8, label: "Intensiv" }
    };

    /**
     * Tagesbelastung eines Spielers.
     *
     * Ermüdung, Alter und Verletzungsanfälligkeit entscheiden, wie hart eine
     * Einheit einschlägt. Der Wert wandert in den Trainingsbericht, damit
     * zwischen den Spieltagen sichtbar wird, wer kurz vor dem Überziehen steht.
     */
    static calculateDailyLoad(player, dayType, intensity = "normal") {
        const profil = this.INTENSITY_PROFILE[intensity] || this.INTENSITY_PROFILE.normal;

        const TAGESFAKTOR = {
            recovery: 0.25,
            rest: 0.0,
            training: 1.0,
            tactics: 0.65,
            opponent_analysis: 0.4,
            media: 0.2,
            sponsor: 0.2,
            matchday: 2.4,
            season_start: 0.5,
            season_end: 0.0
        };

        const faktor = TAGESFAKTOR[dayType] ?? 0.6;
        let last = profil.load * faktor;

        // Wer schon müde ist, den kostet dieselbe Einheit mehr
        const ermuedung = 100 - (player.fitness ?? 100);
        last *= 1 + (ermuedung / 100) * 0.5;

        // Ältere Spieler stecken Belastung schlechter weg
        const alter = player.age || 25;
        if (alter >= 32) last *= 1.25;
        else if (alter >= 29) last *= 1.12;
        else if (alter <= 20) last *= 1.05;

        // Ausdauer federt ab
        const ausdauer = player.stamina || 70;
        last *= 1.25 - (ausdauer / 100) * 0.4;

        return Math.max(0, Math.round(last * 10) / 10);
    }

    /**
     * Verletzungsrisiko der nächsten Einheit in Prozent.
     *
     * Damit sieht man vor dem Spieltag, wen man besser schont: Ein müder,
     * anfälliger Routinier im intensiven Training kommt schnell über 8 %,
     * ein frischer Zwanzigjähriger bleibt unter 1 %.
     */
    static calculateInjuryRisk(player, intensity = "normal", medicalLevel = 1) {
        const profil = this.INTENSITY_PROFILE[intensity] || this.INTENSITY_PROFILE.normal;

        let risiko = 0.006 * profil.risk;

        const ermuedung = 100 - (player.fitness ?? 100);
        risiko *= 1 + (ermuedung / 100) * 2.4;

        const anfaelligkeit = player.hiddenAttributes?.injuryProneness ?? 10;
        risiko *= 0.6 + (anfaelligkeit / 20) * 1.2;

        const alter = player.age || 25;
        if (alter >= 33) risiko *= 1.6;
        else if (alter >= 30) risiko *= 1.25;

        // Wer gerade erst zurück ist, bleibt gefährdet
        if ((player.daysSinceInjury ?? 999) < 21) risiko *= 1.5;

        risiko *= 1 - Math.min(0.55, (medicalLevel - 1) * 0.14);

        return Math.max(0.0005, Math.min(0.25, risiko));
    }

    /**
     * Was eine Trainingswoche an Belastung wiegt.
     *
     * Der eigene Verein trainiert Tag fuer Tag ueber den Kalender, die
     * KI-Vereine einmal je Woche. Eine typische Woche bringt drei
     * Trainingseinheiten, eine Taktikeinheit und drei ruhige Tage.
     */
    static WOCHENGEWICHT = 3 * 1.0 + 1 * 0.5 + 3 * 0.15;

    /**
     * Verletzungsrisiko eines Spielers ueber eine ganze Woche.
     *
     * Das ist die gemeinsame Waehrung beider Wege. Vorher wuerfelte der eigene
     * Verein an jedem Kalendertag mit dem vollen Einheitenrisiko, die KI nur
     * einmal je Woche mit einer festen Pauschale - der Mensch trug damit das
     * 6,6-fache Risiko der Rechner. Und weil die Pauschale der KI weder Alter
     * noch Ermuedung noch das Medizinzentrum kannte, nuetzte ihr ein guter
     * Arzt nichts.
     */
    static weeklyInjuryRisk(player, intensity = "normal", medicalLevel = 1) {
        const proEinheit = this.calculateInjuryRisk(player, intensity, medicalLevel);
        return Math.min(0.5, proEinheit * this.WOCHENGEWICHT);
    }

    /**
     * Trainingsbericht für einen Verein: Last, Ermüdung, Spielschärfe,
     * Verletzungsrisiko und Entwicklung der letzten Tage je Spieler.
     */
    static buildTrainingReport(state, clubId) {
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { entries: [], clubId, day: state.currentDayIndex || 0 };

        const intensity = clubId === state.userClubId
            ? (state.trainingSettings?.intensity || "normal")
            : "normal";
        const focus = clubId === state.userClubId
            ? (state.trainingSettings?.focus || "allround")
            : "allround";
        const medicalLevel = club.facilities?.medicalCenter || 1;

        const kader = state.players.filter(p => club.playerIds.includes(p.id));
        const heute = state.currentDayIndex || 0;

        const entries = kader.map(player => {
            const ermuedung = Math.max(0, Math.min(100, 100 - (player.fitness ?? 100)));
            const risiko = this.calculateInjuryRisk(player, intensity, medicalLevel);
            const last = this.calculateDailyLoad(player, "training", intensity);
            const schaerfe = Math.max(0, Math.min(100, player.matchSharpness ?? 60));

            let hinweis = "";
            if (player.injuredWeeks > 0) hinweis = `Verletzt: ${player.injuryName || "Behandlung"} (${player.injuredWeeks} Wo.)`;
            else if (ermuedung >= 45) hinweis = "Deutlich überlastet - Pause dringend empfohlen";
            else if (ermuedung >= 28) hinweis = "Müde, sollte geschont werden";
            else if (risiko >= 0.05) hinweis = "Erhöhtes Verletzungsrisiko";
            else if (schaerfe < 40) hinweis = "Fehlt an Spielpraxis";
            else hinweis = "Belastbar";

            return {
                playerId: player.id,
                name: player.name,
                pos: player.pos,
                age: player.age,
                fitness: Math.round(player.fitness ?? 100),
                fatigue: Math.round(ermuedung),
                load: last,
                sharpness: Math.round(schaerfe),
                injuryRiskPercent: Math.round(risiko * 1000) / 10,
                injuredWeeks: player.injuredWeeks || 0,
                developmentWeek: Math.round(((player.trainingLog?.gain) || 0) * 100) / 100,
                sessions: player.trainingLog?.sessions || 0,
                note: hinweis
            };
        });

        entries.sort((a, b) => b.injuryRiskPercent - a.injuryRiskPercent);

        return {
            clubId,
            day: heute,
            date: state.currentDate || "",
            intensity,
            focus,
            entries
        };
    }

    /**
     * Eine Trainingseinheit an einem einzelnen Kalendertag.
     *
     * Das Training läuft dadurch nicht mehr im Wochenblock ab, sondern Tag für
     * Tag - die Belastung baut sich sichtbar auf und wieder ab.
     */
    static processDailyTraining(state, dayType = "training") {
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!club) return { sessions: 0, injuries: [] };

        const intensity = state.trainingSettings?.intensity || "normal";
        const focus = state.trainingSettings?.focus || "allround";
        const profil = this.INTENSITY_PROFILE[intensity] || this.INTENSITY_PROFILE.normal;
        const medicalLevel = club.facilities?.medicalCenter || 1;
        const trainingLevel = club.facilities?.trainingGround || 2;

        // Die Güte des Trainerstabs entscheidet mit, wie viel eine Einheit
        // bringt: Beim Landesligisten leitet ein Übungsleiter das Training,
        // beim Spitzenklub eine ganze Abteilung.
        const staffEngine = (typeof CoachingStaffEngine !== "undefined" && CoachingStaffEngine)
            ? CoachingStaffEngine
            : ((typeof window !== "undefined" && window.CoachingStaffEngine) ? window.CoachingStaffEngine
                : (typeof require !== "undefined" ? require("./coachingStaffEngine.js").CoachingStaffEngine : null));
        const stab = staffEngine ? staffEngine.staffQuality(club) : null;
        const stabFaktor = stab?.entwicklungsFaktor ?? 1;

        const kader = state.players.filter(p => club.playerIds.includes(p.id));
        const verletzungen = [];
        let einheiten = 0;

        kader.forEach(player => {
            if (!player.trainingLog) player.trainingLog = { sessions: 0, gain: 0, load: 0 };
            if (typeof player.matchSharpness !== "number") player.matchSharpness = 60;
            player.daysSinceInjury = (player.daysSinceInjury ?? 999) + 1;

            if (player.injuredWeeks > 0) {
                // Reha statt Training
                player.fitness = Math.min(85, (player.fitness ?? 60) + 2);
                player.matchSharpness = Math.max(0, player.matchSharpness - 1.5);
                return;
            }

            const ermuedungVorher = Math.max(0, 100 - (player.fitness ?? 100));
            const last = this.calculateDailyLoad(player, dayType, intensity);
            player.trainingLog.load = Math.round((player.trainingLog.load * 0.75 + last) * 10) / 10;

            // Erholung gegen Belastung. Ein ausgeruhter Körper regeneriert
            // wenig, ein ausgelaugter umso mehr - dadurch pendelt sich die
            // Fitness bei jeder Intensität auf einem eigenen Niveau ein,
            // statt endlos weiter abzurutschen.
            const erholungsBasis = (5.5 + trainingLevel * 1.1) * profil.recovery;
            const erholung = erholungsBasis *
                (0.55 + (ermuedungVorher / 100) * 1.7) *
                (dayType === "recovery" || dayType === "rest" ? 1.7 : 1);
            player.fitness = Math.max(20, Math.min(100, (player.fitness ?? 100) + erholung - last));

            // Spielschärfe: Training hält sie, nur Spiele bringen sie hoch
            player.matchSharpness = Math.max(0, Math.min(100,
                player.matchSharpness + (dayType === "training" ? 0.8 : -0.4)));

            if (dayType === "training" || dayType === "tactics") {
                einheiten++;
                player.trainingLog.sessions++;
                const vorher = player.overall;
                this.developPlayer(player, focus, intensity, trainingLevel, profil.gain * 0.22 * stabFaktor);
                player.trainingLog.gain += (player.overall - vorher);
                player.trainingLog.lastGain = player.overall - vorher;

                // Auf der eigenen Position wächst die Routine, wer woanders
                // aufgestellt ist, lernt die neue Position kennen
                const posEngine = (typeof PositionEngine !== "undefined" && PositionEngine)
                    ? PositionEngine
                    : ((typeof window !== "undefined" && window.PositionEngine) ? window.PositionEngine
                        : (typeof require !== "undefined" ? require("./positionEngine.js").PositionEngine : null));

                if (posEngine && typeof posEngine.gainPositionExperience === "function") {
                    const slotIndex = club.lineup.indexOf(player.id);
                    if (slotIndex >= 0) {
                        const gameState = (typeof GameState !== "undefined" && GameState) ? GameState : null;
                        const slots = gameState ? gameState.getFormationConfig(club.formation)?.positions : null;
                        const slotPos = slots && slots[slotIndex] ? slots[slotIndex].pos : null;
                        if (slotPos && slotPos !== player.pos) {
                            posEngine.gainPositionExperience(player, slotPos, 0.012);
                        }
                    }
                }
            }

            // Der Tagesanteil einer Woche - so summieren sich sieben Tage auf
            // genau das Wochenrisiko, mit dem auch die KI-Vereine rechnen.
            const tagesanteil = (dayType === "training" ? 1 : dayType === "tactics" ? 0.5 : 0.15)
                / TrainingEngine.WOCHENGEWICHT;
            const risiko = this.weeklyInjuryRisk(player, intensity, medicalLevel) * tagesanteil;

            if (Math.random() < risiko) {
                this.inflictInjury(state, player, club);
                player.daysSinceInjury = 0;
                verletzungen.push(player.name);
            }
        });

        state.trainingReport = this.buildTrainingReport(state, club.id);

        return Object.assign(
            { sessions: einheiten, injuries: verletzungen },
            this.beobachtungenDesTages(kader, dayType, focus)
        );
    }

    /**
     * Was der Trainerstab heute gesehen hat.
     *
     * Ein Tag, an dem nur "Training absolviert" dasteht, ist kein Tag. Hier
     * entstehen die Sätze, die im Tagesbericht auftauchen: Wer einen Sprung
     * gemacht hat, wer über seine Grenze geht, wer aus dem Formtief kommt.
     */
    static beobachtungenDesTages(kader, dayType, focus) {
        const standouts = [];
        const concerns = [];
        const trainingstag = dayType === "training" || dayType === "tactics";

        const einsatzbereit = kader.filter(p => (p.injuredWeeks || 0) <= 0);
        if (einsatzbereit.length === 0) return { standouts, concerns };

        if (trainingstag) {
            // Wer heute einen Schritt gemacht hat
            const gewachsen = einsatzbereit
                .filter(p => (p.trainingLog?.lastGain || 0) > 0)
                .sort((a, b) => (b.trainingLog.lastGain) - (a.trainingLog.lastGain));

            gewachsen.slice(0, 2).forEach(p => {
                const jung = (p.age || 25) <= 21;
                standouts.push(jung
                    ? `${p.name} (${p.age}) macht einen Sprung - der Stab traut ihm den nächsten Schritt zu.`
                    : `${p.name} hat sich in der Einheit verbessert.`);
            });

            // Wer heute besonders gut drauf war, auch ohne Wertsprung
            if (standouts.length === 0) {
                const stark = einsatzbereit
                    .filter(p => (p.fitness ?? 100) > 88 && (p.morale ?? 75) > 82)
                    .sort((a, b) => (b.morale || 0) - (a.morale || 0))[0];
                if (stark) standouts.push(`${stark.name} zieht die Einheit mit - bester Mann des Tages.`);
            }
        }

        // Überlastung: der wichtigste Hinweis vor dem Spieltag
        const ueberzogen = einsatzbereit
            .filter(p => (p.fitness ?? 100) < 68)
            .sort((a, b) => (a.fitness ?? 100) - (b.fitness ?? 100));
        ueberzogen.slice(0, 2).forEach(p => {
            concerns.push(`${p.name} ist bei ${Math.round(p.fitness)} % Kondition - hier droht eine Überlastung.`);
        });

        // Unzufriedenheit fällt im Training auf, lange bevor sie eskaliert
        const unzufrieden = einsatzbereit
            .filter(p => (p.morale ?? 75) < 55)
            .sort((a, b) => (a.morale || 0) - (b.morale || 0))[0];
        if (unzufrieden) {
            concerns.push(`${unzufrieden.name} wirkt lustlos (Moral ${Math.round(unzufrieden.morale)} %) - ein Gespräch wäre angebracht.`);
        }

        // Wer aus einer Verletzung zurückkommt, braucht Aufbau
        const aufbau = kader.filter(p => (p.injuredWeeks || 0) <= 0 && (p.daysSinceInjury ?? 999) < 8)[0];
        if (aufbau) {
            concerns.push(`${aufbau.name} ist zurück im Mannschaftstraining, aber noch nicht bei hundert Prozent.`);
        }

        return { standouts, concerns };
    }

    /**
     * Nachwirkungen des Spieltags auf den eigenen Kader.
     *
     * Neunzig Minuten kosten deutlich mehr Substanz als eine Trainingseinheit,
     * bringen dafür Spielschärfe. Wer nur auf der Bank saß, verliert sie.
     */
    static applyMatchdayStrain(state) {
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!club) return;

        const round = (state.schedule || []).find(r => r.matchday === state.currentMatchday);
        const match = round?.matches?.find(m => m.homeClubId === club.id || m.awayClubId === club.id);
        const einsatzMinuten = new Map();

        (match?.playerRatings || []).forEach(rating => {
            einsatzMinuten.set(String(rating.playerId), rating.minutes || 0);
        });

        state.players.forEach(player => {
            if (!club.playerIds.includes(player.id)) return;
            if (player.injuredWeeks > 0) return;

            const minuten = einsatzMinuten.get(String(player.id)) ?? 0;
            if (minuten <= 0) {
                // Ohne Einsatz rostet die Spielschärfe langsam ein
                player.matchSharpness = Math.max(0, (player.matchSharpness ?? 60) - 4);
                return;
            }

            const anteil = Math.min(1, minuten / 90);
            const ausdauer = player.stamina || 70;
            const verschleiss = (16 + anteil * 16) * (1.25 - (ausdauer / 100) * 0.4);

            player.fitness = Math.max(20, (player.fitness ?? 100) - verschleiss);
            player.matchSharpness = Math.min(100, (player.matchSharpness ?? 60) + anteil * 16);

            // Wer auf einer fremden Position spielt, lernt sie dabei kennen
            const posEngine = (typeof PositionEngine !== "undefined" && PositionEngine)
                ? PositionEngine
                : ((typeof window !== "undefined" && window.PositionEngine) ? window.PositionEngine
                    : (typeof require !== "undefined" ? require("./positionEngine.js").PositionEngine : null));

            const gameState = (typeof GameState !== "undefined" && GameState) ? GameState : null;
            if (posEngine && gameState && typeof posEngine.gainPositionExperience === "function") {
                const slotIndex = club.lineup.indexOf(player.id);
                const slots = gameState.getFormationConfig(club.formation)?.positions;
                const slotPos = slotIndex >= 0 && slots && slots[slotIndex] ? slots[slotIndex].pos : null;
                if (slotPos && slotPos !== player.pos) {
                    posEngine.gainPositionExperience(player, slotPos, 0.05 * anteil);
                }
            }
        });

        state.trainingReport = this.buildTrainingReport(state, club.id);
    }

    /**
     * Führt das wöchentliche Training für alle Vereine durch
     */
    static processWeeklyTraining(state) {
        state.clubs.forEach(club => {
            // Der eigene Verein trainiert Tag für Tag über den Kalender -
            // eine zusätzliche Wochenrunde würde ihn doppelt entwickeln.
            if (club.id === state.userClubId) return;

            const clubPlayers = state.players.filter(p => club.playerIds.includes(p.id));
            const focus = club.id === state.userClubId ? (state.trainingSettings.focus || "allround") : "allround";
            const intensity = club.id === state.userClubId ? (state.trainingSettings.intensity || "normal") : "normal";

            const trainingLvl = club?.facilities?.trainingGround || 2;
            const medicalLvl = club?.facilities?.medicalCenter || 1;

            clubPlayers.forEach(player => {
                // 1. Fitness-Regeneration (C2: beeinflusst durch trainingGround)
                let fitnessGain = 7 + trainingLvl * 1.5;
                if (focus === "regeneration") fitnessGain = 14 + trainingLvl * 2;
                if (intensity === "low") fitnessGain += 4;
                if (intensity === "high") fitnessGain -= 3;

                player.fitness = Math.min(100, player.fitness + Math.round(fitnessGain));

                // 2. Moral-Entwicklung
                if (player.stats.matches > 0 && player.form >= 7.0) {
                    player.morale = Math.min(100, player.morale + 1);
                } else if (player.form <= 5.5) {
                    player.morale = Math.max(40, player.morale - 1);
                }

                // 3. Attributs- und Stärkeentwicklung (C2: trainingGround verstärkt Entwicklung)
                TrainingEngine.developPlayer(player, focus, intensity, trainingLvl);

                // 4. Verletzungsrisiko beim Training - dieselbe Rechnung wie
                //    beim eigenen Verein. Die alte Pauschale kannte weder
                //    Alter noch Ermuedung noch Anfaelligkeit, und ein gutes
                //    Medizinzentrum half der KI kaum.
                const wochenRisiko = TrainingEngine.weeklyInjuryRisk(player, intensity, medicalLvl);
                if ((player.injuredWeeks || 0) === 0 && Math.random() < wochenRisiko) {
                    TrainingEngine.inflictInjury(state, player, club);
                }
            });
        });
    }

    /**
     * Entwickelt einen Spieler basierend auf Fokus, Alter und Potenzial
     */
    /**
     * Die Alterskurve eines Fußballers.
     *
     * Vorher kannte die Entwicklung nur eine Richtung: Wer unter dreißig war,
     * wurde jede Saison besser, und schlechter wurde überhaupt erst ab
     * zweiunddreißig jemand. Gemessen über eine Saison hieß das: Von 1083
     * Spielern zwischen 17 und 20 verbesserten sich 1082 - im Schnitt um 6.7
     * Punkte - und selbst die 27- bis 29-Jährigen legten noch 2.6 Punkte zu,
     * ohne dass ein einziger von ihnen je nachließ. Die ganze Liga stieg so um
     * dreieinhalb Punkte pro Saison; nach fünf Jahren war aus dem
     * Abstiegskandidaten rechnerisch ein Spitzenteam und die Sternewertung
     * sagte nichts mehr aus.
     *
     * Echte Karrieren verlaufen anders: Es geht schnell aufwärts bis Anfang
     * zwanzig, um das siebenundzwanzigste Lebensjahr ist das Niveau erreicht,
     * danach geht es wieder abwärts - erst kaum merklich, ab Mitte dreißig
     * deutlich. Und in jedem Alter gibt es Spieler, die stehen bleiben oder
     * nachlassen: eine hartnäckige Verletzung, ein verlorener Stammplatz, der
     * ausbleibende letzte Schritt.
     *
     * "wachstum" und "abbau" sind Wahrscheinlichkeiten je Trainingseinheit.
     */
    static ALTERSKURVE = [
        { bis: 19, wachstum: 0.150, abbau: 0.004 },
        { bis: 22, wachstum: 0.105, abbau: 0.006 },
        { bis: 25, wachstum: 0.048, abbau: 0.012 },
        { bis: 27, wachstum: 0.022, abbau: 0.020 },
        { bis: 29, wachstum: 0.010, abbau: 0.032 },
        { bis: 31, wachstum: 0.004, abbau: 0.052 },
        { bis: 33, wachstum: 0.002, abbau: 0.082 },
        { bis: 99, wachstum: 0.000, abbau: 0.120 }
    ];

    static alterskurveFuer(age) {
        return this.ALTERSKURVE.find(k => (age || 25) <= k.bis) || this.ALTERSKURVE[this.ALTERSKURVE.length - 1];
    }

    static developPlayer(player, focus, intensity, facilityLevel = 2, scale = 1) {
        const kurve = this.alterskurveFuer(player.age);
        const potentialRoom = player.pot - player.overall;

        // Je näher einer an seinem Potenzial ist, desto zäher die letzten
        // Schritte. Sonst erreicht jeder Spieler sein Maximum in zwei Saisons.
        const naeheZumPotenzial = potentialRoom <= 0 ? 0 : Math.min(1, potentialRoom / 12);

        let growthChance = kurve.wachstum * (0.35 + naeheZumPotenzial * 0.65) * scale;
        growthChance *= 0.8 + (facilityLevel - 1) * 0.12;

        if (focus === "youth" && player.age <= 22) growthChance *= 1.35;
        if (intensity === "high") growthChance *= 1.15;

        // Der Abbau lässt sich mit guter Arbeit verzögern, aber nicht aufhalten
        let declineChance = kurve.abbau * scale * (1.18 - (facilityLevel - 1) * 0.06);
        if (intensity === "low") declineChance *= 1.1;

        if (potentialRoom > 0 && Math.random() < growthChance) {
            player.overall = Math.min(player.pot, player.overall + 1);
            player.value = Math.round(player.value * 1.08); // Marktwert steigt

            // Spezifische Attribute je nach Trainingsfokus steigern
            if (focus === "attack") {
                player.shooting = Math.min(99, player.shooting + 1);
                player.dribbling = Math.min(99, player.dribbling + 1);
            } else if (focus === "defense") {
                player.defense = Math.min(99, player.defense + 1);
                player.physical = Math.min(99, player.physical + 1);
            } else if (focus === "technique") {
                player.technique = Math.min(99, player.technique + 1);
                player.passing = Math.min(99, player.passing + 1);
            } else if (focus === "tactics") {
                player.vision = Math.min(99, player.vision + 1);
                player.positioning = Math.min(99, player.positioning + 1);
            } else if (focus === "fitness") {
                player.stamina = Math.min(99, player.stamina + 1);
                player.pace = Math.min(99, player.pace + 1);
            }
            return;
        }

        // Nachlassen: im besten Alter selten, später der Normalfall
        if (Math.random() < declineChance && player.overall > 45) {
            player.overall -= 1;
            player.pace = Math.max(35, (player.pace ?? 60) - 1);
            player.stamina = Math.max(40, (player.stamina ?? 60) - 1);
            player.value = Math.max(150000, Math.round(player.value * 0.9));
        }
    }

    /**
     * Erzeugt eine Verletzung für einen Spieler
     */
    static inflictInjury(state, player, club) {
        const injuryTypes = [
            { name: "Muskelverhärtung", weeks: 1, severity: "leicht" },
            { name: "Knöchelstauchung", weeks: 2, severity: "leicht" },
            { name: "Muskelfaserriss", weeks: 3, severity: "mittel" },
            { name: "Bänderdehnung", weeks: 4, severity: "mittel" },
            { name: "Meniskusschaden", weeks: 6, severity: "schwer" },
            { name: "Kreuzbandanriss", weeks: 10, severity: "schwer" }
        ];

        const roll = Math.random();
        let selectedInjury;
        if (roll < 0.6) selectedInjury = injuryTypes[Math.floor(Math.random() * 2)];
        else if (roll < 0.9) selectedInjury = injuryTypes[2 + Math.floor(Math.random() * 2)];
        else selectedInjury = injuryTypes[4 + Math.floor(Math.random() * 2)];

        player.injuredWeeks = selectedInjury.weeks;
        player.injuryName = selectedInjury.name;
        player.injured = true;
        player.fitness = Math.max(40, player.fitness - 20);
        player.matchSharpness = Math.max(0, (player.matchSharpness ?? 60) - 25);
        player.daysSinceInjury = 0;

        // Aus Startelf / Bank nehmen wenn verletzt. Der Platz in der
        // Aufstellung bestimmt die Einsatzposition - würde der Verletzte hier
        // einfach herausgefiltert, rückten alle dahinter eine Position auf.
        // Deshalb schließt GameState.repairLineup die Lücke gleich darauf an
        // genau der Stelle, an der sie entstanden ist.
        club.bench = club.bench.filter(id => id !== player.id);

        const gameStateRef = (typeof GameState !== "undefined" && GameState)
            ? GameState
            : ((typeof window !== "undefined" && window.GameState) ? window.GameState
                : (typeof require !== "undefined" ? require("./gameState.js").GameState : null));
        if (gameStateRef && typeof gameStateRef.repairLineup === "function") {
            gameStateRef.repairLineup(club, state.players);
        } else {
            club.lineup = club.lineup.filter(id => id !== player.id);
        }

        if (club.id === state.userClubId) {
            state.inbox.unshift({
                id: Date.now(),
                matchday: state.currentMatchday,
                date: `Spieltag ${state.currentMatchday}`,
                sender: "Medizinische Abteilung",
                subject: `Verletzung: ${player.name}`,
                body: `Schlechte Nachrichten: Unser Spieler ${player.name} hat sich im Training eine Verletzung zugezogen (${selectedInjury.name}). Die voraussichtliche Ausfallzeit beträgt ${selectedInjury.weeks} Woche(n). Bitte passen Sie Ihre Aufstellung an!`,
                read: false,
                type: "injury"
            });
        }
    }
}

if (typeof window !== "undefined") {
    window.TrainingEngine = TrainingEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TrainingEngine };
}
