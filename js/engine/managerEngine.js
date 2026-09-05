/**
 * ManagerEngine - Die Arbeit am Menschen: Ansprachen, Pressekonferenzen
 * und die Frage, was heute eigentlich ansteht
 *
 * Ein Fußballmanager verwaltet keine Tabellen, er redet mit Leuten. Vor dem
 * Anpfiff und in der Halbzeit entscheidet der Ton der Ansprache mit, ob die
 * Mannschaft befreit aufspielt oder verkrampft. Auf der Pressekonferenz kann
 * man Druck vom Team nehmen - oder ihn erhöhen.
 */

const _mgrResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));

    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

class ManagerEngine {
    /**
     * Die fünf Tonlagen einer Ansprache.
     *
     * fit(kontext) liefert -1 bis +1: Wie gut passt dieser Ton zur Lage?
     * Wer ein 3:0 führendes Team anbrüllt, erreicht das Gegenteil.
     */
    static TEAM_TALK_TONES = [
        {
            key: "calm",
            icon: "🧊",
            label: "Ruhig bleiben",
            line: "Kein Grund zur Hektik. Wir spielen unser Spiel, so wie wir es trainiert haben.",
            hint: "Wirkt fast immer ein wenig, nie viel. Die sichere Bank."
        },
        {
            key: "motivate",
            icon: "🔥",
            label: "Anfeuern",
            line: "Das ist unser Spiel! Geht raus und holt euch, was euch gehört!",
            hint: "Stark, wenn die Mannschaft Rückenwind braucht - Favoriten überdreht es."
        },
        {
            key: "demand",
            icon: "📣",
            label: "Mehr fordern",
            line: "Das war zu wenig. Ich will Laufbereitschaft sehen, und zwar von jedem.",
            hint: "Erreicht Profis. Bei einer verunsicherten Mannschaft geht es nach hinten los."
        },
        {
            key: "trust",
            icon: "🤝",
            label: "Vertrauen aussprechen",
            line: "Ich glaube an diese Mannschaft. Ihr müsst nichts beweisen, spielt einfach.",
            hint: "Fängt Verunsicherte auf, verpufft bei einer selbstbewussten Truppe."
        },
        {
            key: "angry",
            icon: "💢",
            label: "Lautstark werden",
            line: "So nicht! Wenn sich das nicht ändert, sitzen hier gleich andere auf dem Platz.",
            hint: "Das ganz große Besteck. Wirkt bei klarem Rückstand - sonst zerlegt es die Kabine."
        }
    ];

    /** Fragen der Journalisten. Jede Antwort verschiebt Stimmung und Druck. */
    static PRESS_TOPICS = [
        {
            id: "form",
            question: (ctx) => ctx.formTrend >= 0
                ? `Ihre Mannschaft ist gut in Form. Reicht das für ${ctx.opponentName}?`
                : `Zuletzt lief es nicht. Was macht Ihnen Hoffnung gegen ${ctx.opponentName}?`,
            answers: [
                { key: "confident", label: "Wir gewinnen dieses Spiel.", fanMood: 4, mediaPressure: 6, morale: 3, board: 2,
                  response: "Eine klare Ansage - die Fans feiern sie, die Journalisten notieren sie." },
                { key: "humble", label: "Wir nehmen jedes Spiel, wie es kommt.", fanMood: 0, mediaPressure: -4, morale: 1, board: 1,
                  response: "Sachlich und unaufgeregt. Der Druck bleibt handlich." },
                { key: "deflect", label: "Fragen Sie mich das nach dem Abpfiff.", fanMood: -3, mediaPressure: -6, morale: 0, board: -1,
                  response: "Kurz angebunden. Die Presse schreibt über etwas anderes." }
            ]
        },
        {
            id: "player",
            question: (ctx) => `${ctx.playerName} steht in der Kritik. Halten Sie an ihm fest?`,
            answers: [
                { key: "defend", label: "Er hat mein volles Vertrauen.", fanMood: 1, mediaPressure: 2, morale: 5, board: 0,
                  response: "Die Rückendeckung kommt in der Kabine an.", targetMorale: 12 },
                { key: "neutral", label: "Er weiß, woran er arbeiten muss.", fanMood: 0, mediaPressure: 0, morale: 0, board: 1,
                  response: "Eine Antwort ohne Angriffsfläche." },
                { key: "criticise", label: "Diese Leistung war nicht akzeptabel.", fanMood: 3, mediaPressure: 4, morale: -4, board: 1,
                  response: "Klartext. Der Betroffene hat es im Radio gehört.", targetMorale: -15 }
            ]
        },
        {
            id: "board",
            question: () => "Der Vorstand hat ein Saisonziel ausgegeben. Ist das realistisch?",
            answers: [
                { key: "ambitious", label: "Wir wollen mehr als das.", fanMood: 5, mediaPressure: 8, morale: 2, board: 4,
                  response: "Große Worte. Daran werden Sie gemessen." },
                { key: "loyal", label: "Das Ziel ist genau richtig gesetzt.", fanMood: 1, mediaPressure: 0, morale: 1, board: 3,
                  response: "Der Vorstand hört das gern." },
                { key: "honest", label: "Dafür brauchen wir noch Verstärkung.", fanMood: -2, mediaPressure: -3, morale: -1, board: -3,
                  response: "Ehrlich, aber der Vorstand fühlt sich vorgeführt." }
            ]
        },
        {
            id: "fans",
            question: (ctx) => `Die Anhänger von ${ctx.clubName} erwarten Ergebnisse. Spüren Sie das?`,
            answers: [
                { key: "embrace", label: "Diese Fans sind unser zwölfter Mann.", fanMood: 6, mediaPressure: 2, morale: 2, board: 1,
                  response: "Die Kurve nimmt das auf." },
                { key: "focus", label: "Wir konzentrieren uns auf den Platz.", fanMood: -1, mediaPressure: -2, morale: 1, board: 1,
                  response: "Nüchtern. Niemand regt sich auf." },
                { key: "shield", label: "Der Druck darf nicht auf die Spieler durchschlagen.", fanMood: -2, mediaPressure: -7, morale: 4, board: 0,
                  response: "Sie stellen sich vor die Mannschaft - die Spieler danken es Ihnen." }
            ]
        }
    ];

    static getGameState() {
        return _mgrResolve("GameState", "./gameState.js");
    }

    static getNewsEngine() {
        return _mgrResolve("NewsEngine", "./newsEngine.js");
    }

    static clubOf(state, clubId) {
        return (state.clubs || []).find(c => c.id === (clubId || state.userClubId)) || null;
    }

    static squadOf(state, club) {
        if (!club) return [];
        return (state.players || []).filter(p => club.playerIds.includes(p.id));
    }

    // ------------------------------------------------------------ Ansprache

    /**
     * Lage vor der Ansprache: Wer ist Favorit, wie steht es, wie ist die
     * Stimmung? Daraus ergibt sich, welcher Ton passt.
     */
    static buildTalkContext(state, options = {}) {
        const club = this.clubOf(state, options.clubId);
        const squad = this.squadOf(state, club).filter(p => (p.injuredWeeks || 0) === 0);

        const opponent = options.opponentClubId
            ? this.clubOf(state, options.opponentClubId)
            : null;

        const avgMorale = squad.length
            ? squad.reduce((s, p) => s + (p.morale || 70), 0) / squad.length
            : 70;

        const eigenerRuf = club?.reputation || 50;
        const gegnerRuf = opponent?.reputation || eigenerRuf;

        return {
            phase: options.phase === "halftime" ? "halftime" : "prematch",
            clubId: club?.id || null,
            clubName: club?.name || "Ihr Verein",
            opponentName: opponent?.name || "den Gegner",
            isFavourite: eigenerRuf >= gegnerRuf + 6,
            isUnderdog: eigenerRuf <= gegnerRuf - 6,
            scoreDiff: options.scoreDiff || 0,
            avgMorale: Math.round(avgMorale),
            squadSize: squad.length
        };
    }

    /**
     * Wie gut passt ein Ton zur Lage? -1 (kontraproduktiv) bis +1 (ideal).
     */
    static toneFit(toneKey, ctx) {
        const fuehrt = ctx.scoreDiff > 0;
        const zurueck = ctx.scoreDiff < 0;
        const klarZurueck = ctx.scoreDiff <= -2;
        const verunsichert = ctx.avgMorale < 62;
        const selbstbewusst = ctx.avgMorale > 82;

        switch (toneKey) {
            case "calm":
                // Immer solide, glänzt aber nie
                return fuehrt ? 0.55 : (klarZurueck ? 0.1 : 0.35);

            case "motivate":
                if (ctx.isUnderdog) return 0.8;
                if (zurueck) return 0.65;
                if (ctx.isFavourite && selbstbewusst) return -0.15; // überdreht
                return 0.4;

            case "demand":
                if (ctx.isFavourite && !fuehrt) return 0.75;
                if (verunsichert) return -0.5;
                if (fuehrt) return 0.2;
                return 0.3;

            case "trust":
                if (verunsichert) return 0.85;
                if (ctx.isUnderdog) return 0.55;
                if (selbstbewusst) return 0.05;
                return 0.35;

            case "angry":
                if (klarZurueck) return 0.6;
                if (zurueck && ctx.isFavourite) return 0.35;
                if (fuehrt) return -0.85;   // zerstört eine gute Stimmung
                return -0.4;

            default:
                return 0;
        }
    }

    /**
     * Führt die Ansprache aus.
     *
     * Jeder Spieler reagiert eigen: Ein Profi nimmt Kritik sachlich, ein
     * Temperamentbündel explodiert in beide Richtungen. Ergebnis sind
     * Moral- und Formänderungen sowie ein paar Reaktionen zum Nachlesen.
     */
    static applyTeamTalk(state, toneKey, options = {}) {
        const tone = this.TEAM_TALK_TONES.find(t => t.key === toneKey);
        if (!tone) return { success: false, error: "Unbekannte Ansprache." };

        const ctx = this.buildTalkContext(state, options);
        const club = this.clubOf(state, options.clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };

        const squad = this.squadOf(state, club).filter(p => (p.injuredWeeks || 0) === 0);
        const fit = this.toneFit(toneKey, ctx);

        const reaktionen = [];
        let moralSumme = 0;

        squad.forEach(player => {
            const hidden = player.hiddenAttributes || {};
            const temperament = hidden.temperament ?? 10;   // 1-20
            const professionalism = hidden.professionalism ?? 10;

            // Temperament verstärkt jede Ansprache, Professionalität dämpft sie
            const verstaerkung = 0.55 + (temperament / 20) * 0.9;
            const daempfung = toneKey === "angry" || toneKey === "demand"
                ? 1.25 - (professionalism / 20) * 0.5   // Profis stecken Kritik weg
                : 1.0;

            const wirkung = fit * verstaerkung * daempfung;
            const moralDelta = Math.round(wirkung * 9);
            const formDelta = Math.round(wirkung * 4) / 10;

            player.morale = Math.max(25, Math.min(100, (player.morale || 70) + moralDelta));
            player.form = Math.max(4, Math.min(10, (player.form || 7) + formDelta));

            moralSumme += moralDelta;

            if (Math.abs(moralDelta) >= 5 && reaktionen.length < 3) {
                reaktionen.push({
                    playerId: player.id,
                    name: player.name,
                    positive: moralDelta > 0,
                    text: moralDelta > 0
                        ? `${player.name} nickt und klatscht in die Hände.`
                        : `${player.name} schaut zu Boden und sagt nichts.`
                });
            }
        });

        const schnitt = squad.length ? moralSumme / squad.length : 0;
        let fazit;
        if (schnitt >= 4) fazit = "Die Mannschaft geht mit breiter Brust auf den Platz.";
        else if (schnitt >= 1.5) fazit = "Die Worte kommen an, die Körpersprache stimmt.";
        else if (schnitt > -1.5) fazit = "Die Ansprache verpufft weitgehend.";
        else if (schnitt > -4) fazit = "Ein paar Spieler wirken verunsichert.";
        else fazit = "Die Kabine ist still. Das war die falsche Ansprache.";

        // Der Vorstand bekommt mit, wie die Mannschaft eingestellt ist
        if (club.chemistry) {
            club.chemistry.dressingRoom = Math.max(30, Math.min(100,
                (club.chemistry.dressingRoom || 70) + Math.round(schnitt * 0.8)));
        }

        state.lastTeamTalk = {
            tone: toneKey,
            phase: ctx.phase,
            matchday: state.currentMatchday,
            moraleDelta: Math.round(schnitt * 10) / 10,
            summary: fazit
        };

        return {
            success: true,
            tone,
            line: tone.line,
            moraleDelta: Math.round(schnitt * 10) / 10,
            summary: fazit,
            reactions: reaktionen,
            fit: Math.round(fit * 100) / 100
        };
    }

    // ----------------------------------------------------- Pressekonferenz

    /**
     * Stellt die Frage des Tages zusammen. Der Bezug (Gegner, Spieler in der
     * Kritik) kommt aus dem laufenden Spielstand.
     */
    static buildPressConference(state) {
        const club = this.clubOf(state);
        if (!club) return null;

        const squad = this.squadOf(state, club);
        const round = (state.schedule || []).find(r => r.matchday === state.currentMatchday);
        const match = round?.matches?.find(m => m.homeClubId === club.id || m.awayClubId === club.id);
        const opponentId = match
            ? (match.homeClubId === club.id ? match.awayClubId : match.homeClubId)
            : null;
        const opponent = opponentId ? this.clubOf(state, opponentId) : null;

        // Spieler in der Kritik: schwächste Form im Kader
        const kritik = [...squad].sort((a, b) => (a.form || 7) - (b.form || 7))[0];

        const form = club.form || [];
        const formTrend = form.filter(f => f === "S").length - form.filter(f => f === "N").length;

        const ctx = {
            clubName: club.name,
            opponentName: opponent ? opponent.name : "den nächsten Gegner",
            playerName: kritik ? kritik.name : "unser Kapitän",
            playerId: kritik ? kritik.id : null,
            formTrend
        };

        // Thema wechselt mit dem Spieltag, bleibt aber innerhalb eines Tages stabil
        const topic = this.PRESS_TOPICS[(state.currentDayIndex || 0) % this.PRESS_TOPICS.length];

        return {
            topicId: topic.id,
            question: topic.question(ctx),
            answers: topic.answers.map(a => ({ key: a.key, label: a.label })),
            context: ctx
        };
    }

    /** Wertet die gegebene Antwort aus */
    static answerPressConference(state, topicId, answerKey) {
        const topic = this.PRESS_TOPICS.find(t => t.id === topicId);
        if (!topic) return { success: false, error: "Unbekanntes Thema." };

        const answer = topic.answers.find(a => a.key === answerKey);
        if (!answer) return { success: false, error: "Unbekannte Antwort." };

        const club = this.clubOf(state);
        const squad = this.squadOf(state, club);

        state.fanMood = Math.max(10, Math.min(100, (state.fanMood ?? 70) + answer.fanMood));
        state.mediaPressure = Math.max(0, Math.min(100, (state.mediaPressure ?? 45) + answer.mediaPressure));
        state.boardConfidence = Math.max(0, Math.min(100, (state.boardConfidence ?? 75) + answer.board));

        squad.forEach(p => {
            p.morale = Math.max(25, Math.min(100, (p.morale || 70) + answer.morale));
        });

        // Wer namentlich genannt wurde, reagiert besonders
        const ctx = this.buildPressConference(state)?.context;
        let betroffen = null;
        if (answer.targetMorale && ctx?.playerId) {
            betroffen = squad.find(p => String(p.id) === String(ctx.playerId));
            if (betroffen) {
                betroffen.morale = Math.max(20, Math.min(100, betroffen.morale + answer.targetMorale));
            }
        }

        state.lastPressConference = {
            topicId,
            answerKey,
            matchday: state.currentMatchday,
            response: answer.response
        };

        return {
            success: true,
            response: answer.response,
            effects: {
                fanMood: answer.fanMood,
                mediaPressure: answer.mediaPressure,
                boardConfidence: answer.board,
                squadMorale: answer.morale
            },
            affectedPlayer: betroffen ? { id: betroffen.id, name: betroffen.name, delta: answer.targetMorale } : null
        };
    }

    // ------------------------------------------------ Was heute ansteht

    /**
     * Die Liste für den Schreibtisch: Was braucht heute eine Entscheidung?
     *
     * Sortiert nach Dringlichkeit, damit der erste Blick auf das Dashboard
     * genügt, um zu wissen, was zu tun ist.
     */
    static getAttentionItems(state) {
        const club = this.clubOf(state);
        if (!club) return [];

        const squad = this.squadOf(state, club);
        const items = [];

        // 1. Verhandlungen, bei denen wir am Zug sind
        const negotiation = _mgrResolve("NegotiationEngine", "./negotiationEngine.js");
        if (negotiation) {
            const amZug = negotiation.getOpenNegotiations(state)
                .filter(n => n.clubId === club.id && n.status === negotiation.STATUS.AWAITING_US);
            amZug.forEach(n => items.push({
                priority: 1,
                icon: "🤝",
                tab: "transfers",
                title: `${n.playerName}: Wir sind am Zug`,
                detail: `${negotiation.describe(n)} · noch ${Math.max(0, n.deadlineDay - (state.currentDayIndex || 0))} Tage Frist`
            }));
        }

        // 2. Gesperrte und verletzte Stammspieler
        const ausfaelle = squad.filter(p => (p.injuredWeeks || 0) > 0 || (p.suspendedMatches || 0) > 0);
        if (ausfaelle.length > 0) {
            items.push({
                priority: 2,
                icon: "🚑",
                tab: "squad",
                title: `${ausfaelle.length} Spieler nicht einsatzbereit`,
                detail: ausfaelle.slice(0, 3).map(p => p.name).join(", ") + (ausfaelle.length > 3 ? " …" : "")
            });
        }

        // 3. Überlastete Spieler vor dem Spieltag
        const muede = squad.filter(p => (p.injuredWeeks || 0) === 0 && (p.fitness ?? 100) < 70);
        if (muede.length > 0) {
            items.push({
                priority: 3,
                icon: "🥵",
                tab: "training",
                title: `${muede.length} Spieler sind überlastet`,
                detail: "Trainingsintensität senken oder rotieren, sonst steigt das Verletzungsrisiko."
            });
        }

        // 4. Auslaufende Verträge
        const auslaufend = squad.filter(p => (p.contractYears ?? 3) <= 1);
        if (auslaufend.length > 0) {
            items.push({
                priority: 4,
                icon: "📄",
                tab: "squad",
                title: `${auslaufend.length} Verträge laufen aus`,
                detail: auslaufend.slice(0, 3).map(p => p.name).join(", ") + (auslaufend.length > 3 ? " …" : "")
            });
        }

        // 5. Unzufriedene Spieler
        const unzufrieden = squad.filter(p => (p.happiness?.overall ?? 75) < 50);
        if (unzufrieden.length > 0) {
            items.push({
                priority: 5,
                icon: "😞",
                tab: "squad",
                title: `${unzufrieden.length} Spieler sind unzufrieden`,
                detail: unzufrieden.slice(0, 3).map(p => p.name).join(", ") + (unzufrieden.length > 3 ? " …" : "")
            });
        }

        // 6. Ungelesene Post
        const ungelesen = (state.inbox || []).filter(m => !m.read).length;
        if (ungelesen > 0) {
            items.push({
                priority: 6,
                icon: "📬",
                tab: "inbox",
                title: `${ungelesen} ungelesene Nachricht${ungelesen === 1 ? "" : "en"}`,
                detail: "Vorstand, Berater und Medizinabteilung melden sich."
            });
        }

        // 7. Aufstellung unvollständig
        if ((club.lineup || []).length < 11) {
            items.unshift({
                priority: 0,
                icon: "⚠️",
                tab: "tactics",
                title: "Die Startelf ist unvollständig",
                detail: `Nur ${(club.lineup || []).length} von 11 Plätzen besetzt.`
            });
        }

        return items.sort((a, b) => a.priority - b.priority).slice(0, 6);
    }
}

if (typeof window !== "undefined") {
    window.ManagerEngine = ManagerEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { ManagerEngine };
}
