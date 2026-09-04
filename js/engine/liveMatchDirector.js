/**
 * LiveMatchDirector - Regie und Bewegungsmodell der 2D-Live-Simulation
 *
 * Ziel ist ein Spielerlebnis, bei dem Spielfeld und Spielbericht Hand in Hand gehen:
 *
 *  - Die Spieluhr läuft kontinuierlich in Echtzeit statt in groben Minutensprüngen.
 *  - Jede Szene der Timeline wird als Highlight inszeniert: Der Ball läuft zum
 *    Ausgangspunkt, die beteiligten Spieler nehmen ihre Positionen ein, und der
 *    Kommentar erscheint exakt dann, wenn der Ball ankommt.
 *  - Zwischen den Highlights zirkuliert der Ball über echte Spieler des Teams,
 *    das gerade in Ballbesitz ist - inklusive Aufbaukommentar.
 *  - Alle 22 Spieler bewegen sich rollenabhängig: Die Kette verschiebt anders als
 *    das Mittelfeld, ballnahe Spieler pressen, der Torwart bleibt an seinem Tor.
 */

const _dirRandom = (typeof Random !== 'undefined' && Random)
    ? Random
    : ((typeof require !== 'undefined') ? require('../core/random.js').Random : {
        int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        float: (min, max) => Math.random() * (max - min) + min,
        choice: arr => (Array.isArray(arr) && arr.length > 0) ? arr[Math.floor(Math.random() * arr.length)] : null,
        chance: prob => Math.random() < prob,
        clamp: (val, min, max) => Math.max(min, Math.min(max, val))
    });

const _MatchFlowEngine = (typeof MatchFlowEngine !== 'undefined' && MatchFlowEngine)
    ? MatchFlowEngine
    : ((typeof window !== 'undefined' && window.MatchFlowEngine)
        ? window.MatchFlowEngine
        : ((typeof require !== 'undefined') ? require('./matchFlowEngine.js').MatchFlowEngine : null));

/**
 * Ereignisse, deren Text erst beim Eintreffen des Balls gemeldet wird
 * (Torschuss, Parade, Fehlschuss) - so passt der Kommentar zum Bild.
 */
const RESOLVE_ON_ARRIVAL = ["goal", "save", "shot_miss"];

/** Wie stark ein Mannschaftsteil der Ballbewegung über das Feld folgt */
const LINE_FOLLOW_WEIGHT = { gk: 0.10, def: 0.52, mid: 0.70, att: 0.86 };

/** Tempo (Feldeinheiten pro Sekunde) je Mannschaftsteil als Basiswert */
const LINE_BASE_SPEED = { gk: 9, def: 11, mid: 12, att: 12.5 };

const AMBIENT_COMMENTARY = [
    "{minute}' - {a} verlagert das Spiel ruhig auf {b}.",
    "{minute}' - Geduldiger Aufbau: {a} findet {b} im Zwischenraum.",
    "{minute}' - {a} treibt den Ball nach vorne und bedient {b}.",
    "{minute}' - Ballstafette über {a} und {b}, {club} kontrolliert die Partie.",
    "{minute}' - {a} sucht den Weg nach vorne und spielt auf {b}.",
    "{minute}' - {club} lässt den Ball laufen, {a} zu {b}."
];

/** Kommentare zum laufenden Spiel zwischen den Highlights */
const FLOW_COMMENTARY = {
    pass: [
        "{minute}' - {a} verlagert ruhig auf {b}.",
        "{minute}' - Sauberer Ball von {a} in den Lauf von {b}.",
        "{minute}' - {a} findet {b} im Zwischenraum.",
        "{minute}' - {club} lässt den Ball zirkulieren, {a} zu {b}.",
        "{minute}' - {a} treibt an und bedient {b}.",
        "{minute}' - Geduldiger Aufbau bei {club} über {a}."
    ],
    intercept: [
        "{minute}' - Abgefangen! {b} liest den Pass von {a}.",
        "{minute}' - {b} geht dazwischen und erobert den Ball.",
        "{minute}' - Fehlpass von {a} – {b} schaltet sofort um.",
        "{minute}' - {b} antizipiert stark und schnappt sich die Kugel."
    ],
    loose: [
        "{minute}' - {a} verstolpert den Ball, jetzt ist er frei.",
        "{minute}' - Der Ball springt {a} über den Fuß.",
        "{minute}' - Ungenau von {a}, der Ball läuft ins Niemandsland."
    ],
    dribble: [
        "{minute}' - {a} setzt sich stark im Dribbling durch!",
        "{minute}' - {a} lässt seinen Gegenspieler stehen.",
        "{minute}' - Schöne Körpertäuschung von {a}, er kommt durch."
    ],
    tackle: [
        "{minute}' - {b} grätscht {a} den Ball vom Fuß.",
        "{minute}' - Konsequent verteidigt von {b} gegen {a}.",
        "{minute}' - {a} verliert den Zweikampf gegen {b}."
    ],
    throwin: [
        "{minute}' - Einwurf für {club}.",
        "{minute}' - Der Ball ist im Seitenaus, Einwurf {club}."
    ],
    goalkick: [
        "{minute}' - Abstoß für {club}.",
        "{minute}' - Der Ball geht ins Toraus, Abstoß."
    ],
    freekick: [
        "{minute}' - Freistoß für {club} aus aussichtsreicher Position.",
        "{minute}' - Der Schiedsrichter pfeift, Freistoß {club}."
    ]
};

const AMBIENT_PRESSURE = [
    "{minute}' - {club} presst früh an und erobert den Ball durch {a}.",
    "{minute}' - Ballverlust! {a} schnappt sich die Kugel für {club}.",
    "{minute}' - {a} grätscht dazwischen, {club} schaltet um."
];

class LiveMatchDirector {
    constructor(liveMatch) {
        this.match = liveMatch;

        // Uhr in Spielsekunden (kontinuierlich statt in Minutenschritten)
        this.clock = 0;

        // Regiezustand
        this.mode = "ambient"; // ambient | highlight | celebration
        this.scene = null;
        this.phaseTimer = 0;

        // Ambient-Ballzirkulation
        this.possessionTeam = "home";
        this.carrierId = null;
        this.ambientTimer = 0;
        this.ambientInterval = 1.1;

        this.celebrationTimer = 0;
        this.elapsedReal = 0;

        this.targetPossession = Array.isArray(liveMatch?.timeline?.possession)
            ? [...liveMatch.timeline.possession]
            : [50, 50];

        // Ausgangszustand des Balls merken, damit externe Vorgaben erkannt werden
        this._lastTargetX = liveMatch?.ball?.targetX;
        this._lastTargetY = liveMatch?.ball?.targetY;

        // Ruhender Ball (Einwurf, Abstoß, Ecke, Freistoß)
        this.deadBallTimer = 0;
        this.deadBall = null;
        this.flowStats = { actions: 0, passesCompleted: 0, turnovers: 0, setPieces: 0 };

        // Ballbesitz-Mikrosimulation
        this.flow = _MatchFlowEngine ? new _MatchFlowEngine({
            getPlayers: () => this.match.players2D || [],
            getTactics: (team) => (team === "home" ? this.match.homeClub?.tactics : this.match.awayClub?.tactics) || {},
            attackDir: (team) => this.attackDir(team),
            ownGoalX: (team) => this.ownGoalX(team)
        }) : null;

        this.initPlayers();
        this.startAmbient(this.targetPossession[0] >= 50 ? "home" : "away");
    }

    // ---------------------------------------------------------------- Setup

    /**
     * Ergänzt die 2D-Spieler um Bewegungsdaten (Geschwindigkeit, Rolle, Streuung)
     */
    initPlayers() {
        const players = this.match.players2D || [];
        players.forEach((p, idx) => {
            p.vx = 0;
            p.vy = 0;
            p.seed = (idx * 1.7) % (Math.PI * 2);
            p.group = this.getGroup(p.pos);
            p.baseSpeed = (LINE_BASE_SPEED[p.group] || 11) * (0.86 + ((p.pace || 70) / 100) * 0.32);
            p.followWeight = LINE_FOLLOW_WEIGHT[p.group] || 0.7;
            p.urgency = 1;
        });
    }

    getGroup(pos) {
        if (pos === "TW") return "gk";
        if (["IV", "LV", "RV"].includes(pos)) return "def";
        if (["DM", "ZM", "OM", "LM", "RM"].includes(pos)) return "mid";
        return "att";
    }

    /** Torlinie des eigenen Tores */
    ownGoalX(team) {
        return team === "home" ? 4 : 96;
    }

    /** Angriffsrichtung: +1 = nach rechts */
    attackDir(team) {
        return team === "home" ? 1 : -1;
    }

    teamPlayers(team) {
        return (this.match.players2D || []).filter(p => p.team === team);
    }

    getPlayer2D(playerId) {
        if (playerId === null || playerId === undefined) return null;
        return (this.match.players2D || []).find(p => p.id === playerId) || null;
    }

    // ------------------------------------------------------------ Zeitlauf

    /**
     * Wie viele Spielsekunden pro echter Sekunde vergehen sollen
     */
    getClockRate() {
        const intervalMs = this.match.getTickIntervalMs();
        const minuteStep = this.match.getMinuteStep();
        const nominal = (60 * minuteStep) / (intervalMs / 1000);

        // Während eines Highlights steht die Uhr fast still, damit Minute und
        // Kommentar zum Bild passen. Dazwischen wird die Zeit aufgeholt.
        if (this.mode === "highlight" || this.mode === "celebration") return nominal * 0.12;
        return nominal * 1.35;
    }

    /** Skaliert die Dauer der Highlight-Phasen an die gewählte Geschwindigkeit */
    getSpeedScale() {
        const intervalMs = this.match.getTickIntervalMs();
        if (intervalMs >= 2000) return 1.0;
        if (intervalMs >= 1000) return 0.72;
        return 0.34;
    }

    /**
     * Haupttakt: wird vom UI in jedem Frame mit der echten Delta-Zeit aufgerufen
     */
    advanceRealTime(realMs) {
        const match = this.match;
        if (match.isFinished || match.isPaused) return;

        const dt = Math.max(0, Math.min(0.25, (Number(realMs) || 0) / 1000));
        if (dt <= 0) return;

        this.elapsedReal += dt;
        this.clock += dt * this.getClockRate();

        this.syncMinute();
        this.updatePossessionStats(dt);
        this.step(dt, false);
    }

    /**
     * Kopfloser Vorlauf um eine bestimmte Anzahl Spielsekunden
     * (wird von tick() und den Tests verwendet - ohne Animationsphasen)
     */
    advanceMatchSeconds(seconds) {
        const match = this.match;
        if (match.isFinished) return;

        this.clock += Math.max(0, seconds);
        this.syncMinute();
        this.updatePossessionStats(Math.max(0, seconds) / 30);

        // Im Sofortmodus werden alle fälligen Ereignisse direkt aufgelöst
        let guard = 0;
        while (this.hasDueEvent() && guard++ < 200) {
            const ev = this.match.timeline[this.match.timelineIndex];
            this.match.timelineIndex++;
            this.match.processEvent(ev);
            this.applyEventBallState(ev, true);
        }

        this.match.checkForFinish();
    }

    syncMinute() {
        const match = this.match;
        const minute = Math.floor(this.clock / 60);
        if (minute !== match.minute) {
            match.minute = minute;
            match.updatePhaseLabel();
        }
        match.seconds = Math.floor(this.clock % 60);
    }

    /**
     * Ballbesitzanzeige driftet realistisch zum Zielwert der Timeline
     */
    updatePossessionStats(dt) {
        const stats = this.match.stats;
        if (!stats || !Array.isArray(stats.possession)) return;

        const target = this.targetPossession[0] || 50;
        // Kurzfristige Schwankung durch das Team, das gerade am Ball ist
        const live = this.possessionTeam === "home" ? target + 6 : target - 6;
        const current = stats.possession[0];
        const next = current + (live - current) * Math.min(1, dt * 0.35);

        stats.possession[0] = Math.round(Math.max(20, Math.min(80, next)));
        stats.possession[1] = 100 - stats.possession[0];
    }

    hasDueEvent() {
        const match = this.match;
        const ev = match.timeline[match.timelineIndex];
        if (!ev) return false;
        return this.eventTime(ev) <= this.clock;
    }

    eventTime(ev) {
        return (ev.minute || 0) * 60 + (ev.second || 0);
    }

    // ------------------------------------------------------------- Regie

    step(dt, instant) {
        if (this.mode === "celebration") {
            this.celebrationTimer -= dt;
            if (this.celebrationTimer <= 0) {
                this.finishCelebration();
            }
            return;
        }

        if (this.mode === "highlight") {
            this.updateHighlight(dt);
            return;
        }

        // Ambient: warten, bis das nächste Ereignis fällig ist
        if (this.hasDueEvent()) {
            this.startHighlight();
            return;
        }

        this.updateAmbient(dt);
        this.match.checkForFinish();
    }

    /**
     * Fasst alle Ereignisse derselben Spielminute zu einem Highlight zusammen
     */
    startHighlight() {
        const match = this.match;
        const events = [];
        let guard = 0;

        while (match.timelineIndex < match.timeline.length && guard++ < 6) {
            const ev = match.timeline[match.timelineIndex];
            if (this.eventTime(ev) > this.clock) break;
            if (events.length > 0 && ev.minute !== events[0].minute) break;

            events.push(ev);
            match.timelineIndex++;
            if (events.length >= 4) break;
        }

        if (events.length === 0) return;

        // Uhr exakt auf die Ereignisminute setzen, damit Anzeige und Text passen
        this.clock = Math.max(this.clock, this.eventTime(events[0]));
        this.syncMinute();

        this.mode = "highlight";
        this.scene = { events, index: 0, phase: null };
        this.beginEventPhase("approach");
    }

    currentEvent() {
        if (!this.scene) return null;
        return this.scene.events[this.scene.index] || null;
    }

    beginEventPhase(phase) {
        const ev = this.currentEvent();
        if (!ev) {
            this.endHighlight();
            return;
        }

        const scale = this.getSpeedScale();
        const ball = this.match.ball;
        this.scene.phase = phase;

        if (phase === "approach") {
            const start = ev.start || { x: ball.x, y: ball.y };
            const dist = Math.hypot(start.x - ball.x, start.y - ball.y);
            const duration = Math.max(0.12, Math.min(0.85, dist / 70)) * scale;

            this.assignSceneRoles(ev, "approach");
            this.setBallTravel(start.x, start.y, duration, "pass");
            this.phaseTimer = duration;

            if (dist < 2) {
                // Ball liegt bereits richtig - direkt zur Aktion
                this.beginEventPhase("action");
            }
            return;
        }

        if (phase === "action") {
            const end = ev.end || ev.start || { x: ball.x, y: ball.y };
            const actionType = this.getActionType(ev);
            const duration = this.getActionDuration(ev, actionType) * scale;

            this.assignSceneRoles(ev, "action");

            // Aufbauende Ereignisse melden sich sofort, damit der Text
            // den laufenden Ball beschreibt
            if (!RESOLVE_ON_ARRIVAL.includes(ev.type)) {
                this.resolveEvent(ev);
            }

            this.setBallTravel(end.x, end.y, duration, actionType);
            this.phaseTimer = duration;
            return;
        }

        if (phase === "resolve") {
            // Torschuss & Co. werden genau beim Eintreffen des Balls gemeldet
            if (RESOLVE_ON_ARRIVAL.includes(ev.type)) {
                this.resolveEvent(ev);
            }

            const hold = (ev.type === "goal" ? 0.35 : 0.28) * scale;
            this.phaseTimer = hold;
            return;
        }
    }

    updateHighlight(dt) {
        this.phaseTimer -= dt;
        if (this.phaseTimer > 0) return;

        const phase = this.scene?.phase;
        if (phase === "approach") {
            this.beginEventPhase("action");
        } else if (phase === "action") {
            this.beginEventPhase("resolve");
        } else {
            const ev = this.currentEvent();
            if (ev && ev.type === "goal") {
                this.startCelebration(ev);
                return;
            }
            this.scene.index++;
            if (this.scene.index >= this.scene.events.length) {
                this.endHighlight();
            } else {
                this.beginEventPhase("approach");
            }
        }
    }

    endHighlight() {
        const lastEvent = this.scene?.events?.[this.scene.events.length - 1] || null;
        this.scene = null;
        this.mode = "ambient";

        // Nach einer Szene bekommt das logisch passende Team den Ball
        let nextTeam = this.possessionTeam;
        if (lastEvent) {
            if (lastEvent.type === "goal") {
                nextTeam = lastEvent.team === "home" ? "away" : "home";
            } else if (lastEvent.type === "save" || lastEvent.type === "shot_miss") {
                nextTeam = lastEvent.team === "home" ? "away" : "home";
            } else if (lastEvent.team) {
                nextTeam = lastEvent.team;
            }
        }

        this.startAmbient(nextTeam);
        this.match.checkForFinish();
    }

    startCelebration(ev) {
        this.mode = "celebration";
        this.celebrationTimer = 1.9 * this.getSpeedScale();
        this.match.celebratingTeam = ev.team;
        this.match.goalFlash = 1.0;
    }

    finishCelebration() {
        this.match.celebratingTeam = null;
        this.celebrationTimer = 0;

        // Anstoß: Ball wandert zurück zum Anstoßpunkt, Formation ordnet sich neu
        this.setBallTravel(50, 50, 0.55 * this.getSpeedScale() + 0.2, "pass");

        const scoringTeam = this.scene?.events?.[this.scene.index]?.team;
        const kickoffTeam = scoringTeam === "home" ? "away" : "home";

        this.scene.index++;
        if (this.scene.index >= this.scene.events.length) {
            this.scene = null;
            this.mode = "ambient";
            this.startAmbient(kickoffTeam);
        } else {
            this.mode = "highlight";
            this.beginEventPhase("approach");
        }
    }

    /**
     * Meldet ein Ereignis an die LiveMatch-Logik (Statistik, Ticker, Kommentar)
     */
    resolveEvent(ev) {
        if (!ev || ev._resolved) return;
        ev._resolved = true;
        this.match.processEvent(ev);
        this.applyEventBallState(ev, false);
    }

    /**
     * Setzt den Ballzustand nach einem Ereignis (nur im Sofortmodus hart)
     */
    applyEventBallState(ev, hard) {
        if (!hard || !ev?.end) return;
        const ball = this.match.ball;
        ball.x = ev.end.x;
        ball.y = ev.end.y;
        ball.targetX = ev.end.x;
        ball.targetY = ev.end.y;
        ball.originX = ev.end.x;
        ball.originY = ev.end.y;
        ball.travelElapsed = 1;
        ball.travelDuration = 1;
    }

    getActionType(ev) {
        if (ev.type === "goal" || ev.type === "save" || ev.type === "shot_miss") return "shot";
        if (ev.type === "cross" || ev.type === "corner") return "cross";
        if (ev.type === "foul" || ev.type === "tackle" || ev.type === "yellow_card"
            || ev.type === "red_card" || ev.type === "injury" || ev.type === "substitution") return "dead";
        return "pass";
    }

    getActionDuration(ev, actionType) {
        if (actionType === "shot") return 0.5;
        if (actionType === "cross") return 0.7;
        if (actionType === "dead") return 0.45;
        return 0.6;
    }

    /**
     * Weist den beteiligten Spielern für die Szene feste Zielpunkte zu,
     * damit Bild und Kommentar zusammenpassen.
     */
    assignSceneRoles(ev, phase) {
        const match = this.match;
        match.sceneRoles = new Map();

        const passerId = ev.fromPlayerId ?? (ev.type === "save" ? ev.shooterId : ev.playerId);
        const receiverId = ev.toPlayerId ?? ev.shooterId ?? ev.playerId;

        const start = ev.start || match.ball;
        const end = ev.end || start;

        const passer = this.getPlayer2D(passerId);
        const receiver = this.getPlayer2D(receiverId);
        const keeper = this.getPlayer2D(ev.gkId);

        // Ein Torwart wird nie quer über das Feld geschickt - er bleibt in
        // seinem Strafraum, auch wenn er an einer Szene beteiligt ist
        // (z. B. bei einer Verletzung).
        const setRole = (player, x, y, urgency) => {
            if (!player) return;
            if (player.pos === "TW") {
                const goalX = this.ownGoalX(player.team);
                const dir = this.attackDir(player.team);
                const limited = dir > 0
                    ? Math.min(goalX + 20, Math.max(goalX, x))
                    : Math.max(goalX - 20, Math.min(goalX, x));
                match.sceneRoles.set(player.id, { x: limited, y: 50 + (y - 50) * 0.55, urgency });
                return;
            }
            match.sceneRoles.set(player.id, { x, y, urgency });
        };

        if (passer) {
            setRole(passer, start.x, start.y, 1.6);
        }
        if (receiver && receiver !== passer) {
            const tx = phase === "approach" ? (start.x + end.x) / 2 : Math.max(4, Math.min(96, end.x - this.attackDir(receiver.team) * 5));
            const ty = phase === "approach" ? (start.y + end.y) / 2 : end.y;
            setRole(receiver, tx, ty, 1.8);
        }
        if (keeper) {
            setRole(keeper, this.ownGoalX(keeper.team) + this.attackDir(keeper.team) * 3, 50 + (end.y - 50) * 0.5, 1.7);
        }

        match.activePlayerId = (phase === "action" && receiver) ? receiver.id : (passer?.id ?? receiver?.id ?? match.activePlayerId);
    }

    // ---------------------------------------------------- Ambient-Spielfluss

    startAmbient(team) {
        this.mode = "ambient";
        this.possessionTeam = team === "away" ? "away" : "home";
        this.match.sceneRoles = null;
        this.ambientTimer = 0;
        this.ambientInterval = 0.35;
        this.pickAmbientCarrier();
    }

    pickAmbientCarrier() {
        const candidates = this.teamPlayers(this.possessionTeam).filter(p => p.pos !== "TW");
        if (candidates.length === 0) return;

        // Bevorzugt Mittelfeldspieler in Ballnähe
        const ball = this.match.ball;
        const weighted = candidates.map(p => ({
            p,
            w: (p.group === "mid" ? 1.6 : p.group === "def" ? 1.1 : 1.0) / (1 + Math.hypot(p.x - ball.x, p.y - ball.y) / 45)
        }));
        const total = weighted.reduce((s, e) => s + e.w, 0);
        let roll = Math.random() * total;
        let chosen = weighted[0].p;
        for (const entry of weighted) {
            roll -= entry.w;
            if (roll <= 0) { chosen = entry.p; break; }
        }

        this.setCarrier(chosen);

        // Der Ball läuft zum neuen Ballführenden, statt zu springen
        const dist = Math.hypot(chosen.x - ball.x, chosen.y - ball.y);
        if (dist > 1.5) {
            this.setBallTravel(chosen.x, chosen.y, Math.max(0.18, Math.min(0.7, dist / 75)), "pass");
        }
    }

    setCarrier(player) {
        if (!player) return;
        // Ballbesitzkette mitzählen (Grundlage für entschlosseneres Aufrücken)
        if (player.team === this.possessionTeam) {
            this.possessionChain = (this.possessionChain || 0) + 1;
        } else {
            this.possessionChain = 0;
            this.possessionTeam = player.team;
        }
        this.carrierId = player.id;
        this.match.ball.holderId = player.id;
        this.match.activePlayerId = player.id;
        this.match.flowPhase = this.flow ? this.flow.derivePhase(player, player.team) : null;
    }

    /**
     * Spielfluss zwischen den Highlights: echte Entscheidungen des
     * Ballführenden statt zufälliger Pässe.
     */
    updateAmbient(dt) {
        // Ruhende Bälle (Einwurf, Abstoß, Ecke, Freistoß) warten ihre Zeit ab
        if (this.deadBallTimer > 0) {
            this.deadBallTimer -= dt;
            if (this.deadBallTimer <= 0) this.resumeFromDeadBall();
            return;
        }

        this.ambientTimer += dt;
        if (this.ambientTimer < this.ambientInterval) return;
        this.ambientTimer = 0;

        const carrier = this.getPlayer2D(this.carrierId);
        if (!carrier) {
            this.pickAmbientCarrier();
            this.ambientInterval = 0.5;
            return;
        }

        if (!this.flow) {
            // Ohne Flow-Engine bleibt das alte, einfache Verhalten
            this.ambientInterval = 1.0;
            const mate = this.teamPlayers(carrier.team).find(p => p.id !== carrier.id && p.pos !== "TW");
            if (mate) {
                this.setBallTravel(mate.x, mate.y, 0.5, "pass");
                this.setCarrier(mate);
            }
            return;
        }

        const action = this.flow.decide(carrier, { chainLength: this.possessionChain || 0 });
        if (!action) {
            this.ambientInterval = 0.8;
            return;
        }

        this.applyFlowAction(action);
        this.ambientInterval = this.flow.getActionInterval(carrier.team, action.type)
            * (0.55 + this.getSpeedScale() * 0.65);
    }

    /**
     * Setzt eine Entscheidung der Flow-Engine in Ballbewegung,
     * Ballbesitzwechsel und Kommentar um.
     */
    applyFlowAction(action) {
        const from = action.from;
        const to = action.to;
        const dist = Math.hypot((to.x ?? from.x) - from.x, (to.y ?? from.y) - from.y);

        // Ball verlässt das Feld? Dann gibt es eine Standardsituation
        if (action.outcome === "out" || this.handleOutOfPlay(action, to)) {
            if (action.outcome === "out") {
                this.flowStats.turnovers++;
                this.handleOutOfPlay(action, to);
            }
            return;
        }

        const speedScale = 0.55 + this.getSpeedScale() * 0.6;
        const actionType = action.type === "longball" ? "cross" : "pass";
        const duration = Math.max(0.2, Math.min(0.95, dist / (action.type === "longball" ? 62 : 78))) * speedScale;

        this.flowStats.actions++;

        if (action.type === "dribble") {
            this.handleDribbleAction(action, duration);
            return;
        }

        if (action.outcome === "complete") {
            this.flowStats.passesCompleted++;
            this.setBallTravel(to.x, to.y, duration, actionType);
            this.setCarrier(to);
            this.narrateFlow(action);
            return;
        }

        if (action.outcome === "intercepted") {
            this.flowStats.turnovers++;
            const winner = action.interceptor;
            this.possessionTeam = winner.team;
            this.setBallTravel(winner.x, winner.y, duration * 0.9, actionType);
            this.setCarrier(winner);
            this.narrateFlow(action);
            return;
        }

        // Fehlpass ins Niemandsland: der nächste Spieler erobert den Ball
        this.flowStats.turnovers++;
        this.setBallTravel(to.x, to.y, duration, actionType);
        this.claimLooseBall(to);
        this.narrateFlow(action);
    }

    handleDribbleAction(action, duration) {
        const carrier = action.from;
        if (action.outcome === "beaten") {
            this.setBallTravel(action.to.x, action.to.y, duration * 1.1, "pass");
            this.setCarrier(carrier);
            this.narrateFlow(action);
            return;
        }

        // Zweikampf verloren: der Verteidiger übernimmt
        const defender = action.defender;
        this.flowStats.turnovers++;
        if (defender) {
            this.possessionTeam = defender.team;
            this.setBallTravel(defender.x, defender.y, duration * 0.7, "pass");
            this.setCarrier(defender);
        }
        this.narrateFlow(action);
    }

    /**
     * Der Ball liegt frei: der nächstgelegene Spieler beider Teams bekommt ihn
     */
    claimLooseBall(point) {
        const contenders = (this.match.players2D || [])
            .filter(p => p.pos !== "TW")
            .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y));

        const winner = contenders[0];
        if (!winner) return;
        this.possessionTeam = winner.team;
        this.setCarrier(winner);
    }

    // --------------------------------------------------- Standardsituationen

    /**
     * Prüft, ob ein Ball ins Aus geht, und startet die passende
     * Standardsituation. Ohne das lief der Ball bisher einfach am Rand entlang.
     */
    handleOutOfPlay(action, to) {
        const x = to.x ?? 0;
        const y = to.y ?? 0;
        const team = action.from?.team || this.possessionTeam;

        // Seitenaus -> Einwurf für den Gegner
        if (y < 1.5 || y > 98.5) {
            const spotY = y < 1.5 ? 1.5 : 98.5;
            const spotX = Math.max(4, Math.min(96, x));
            this.startDeadBall("throwin", team === "home" ? "away" : "home", spotX, spotY);
            return true;
        }

        // Toraus: Abstoß für die verteidigende Mannschaft.
        //
        // Ecken entstehen bewusst NICHT aus dem freien Spielfluss, sondern
        // ausschließlich aus der Timeline. Nur so bleiben Live-Statistik und
        // Spielbericht deckungsgleich - und eine sofort berechnete Partie hat
        // dieselbe Eckenzahl wie eine im 2D-Modus verfolgte.
        if (x < 1.5 || x > 98.5) {
            const defendingTeam = x < 1.5 ? "home" : "away";
            const goalX = x < 1.5 ? 8 : 92;
            this.startDeadBall("goalkick", defendingTeam, goalX, 50);
            return true;
        }

        return false;
    }

    /**
     * Beginnt eine ruhende Spielsituation: Ball an den Punkt, Spieler ordnen
     * sich neu, kurze Pause - danach wird ausgeführt.
     */
    startDeadBall(kind, team, x, y) {
        const speedScale = this.getSpeedScale();
        this.deadBall = { kind, team, x, y };
        this.possessionTeam = team;
        this.flowStats.setPieces++;

        // Ball rollt zum Ausführungspunkt
        const dist = Math.hypot(x - this.match.ball.x, y - this.match.ball.y);
        this.setBallTravel(x, y, Math.max(0.25, Math.min(0.9, dist / 90)) * speedScale + 0.15, "pass");

        // Ausführender Spieler: der nächstgelegene passende Spieler
        const executor = this.pickSetPieceTaker(kind, team, x, y);
        if (executor) {
            this.carrierId = executor.id;
            this.match.ball.holderId = executor.id;
            this.match.activePlayerId = executor.id;
        }

        this.deadBallTimer = (kind === "goalkick" ? 1.2 : kind === "corner" ? 1.5 : 0.85) * speedScale + 0.3;
        this.match.setPiece = { kind, team, x, y };

        const pool = FLOW_COMMENTARY[kind];
        if (pool && Math.random() < 0.8) {
            const clubName = team === "home"
                ? (this.match.homeClub?.name || "Heim")
                : (this.match.awayClub?.name || "Gast");
            this.match.lastCommentary = (_dirRandom.choice(pool) || pool[0])
                .replace("{minute}", this.match.minute)
                .replace("{club}", clubName);
        }
    }

    /**
     * Wer führt die Standardsituation aus?
     */
    pickSetPieceTaker(kind, team, x, y) {
        const squad = this.teamPlayers(team);
        if (squad.length === 0) return null;

        if (kind === "goalkick") {
            return squad.find(p => p.pos === "TW") || squad[0];
        }

        const outfield = squad.filter(p => p.pos !== "TW");
        const pool = outfield.length > 0 ? outfield : squad;

        if (kind === "corner") {
            // Eckenschützen sind bevorzugt technisch starke Flügelspieler
            return pool.slice().sort((a, b) =>
                (this.setPieceSkill(b) - this.setPieceSkill(a))
            )[0];
        }

        // Einwurf und Freistoß: der nächstgelegene Spieler
        return pool.slice().sort((a, b) =>
            Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)
        )[0];
    }

    setPieceSkill(player) {
        const t = typeof player.technique === "number" ? player.technique : 65;
        const p = typeof player.passing === "number" ? player.passing : 65;
        return t * 0.5 + p * 0.5;
    }

    /**
     * Führt die ruhende Situation aus und gibt das Spiel wieder frei
     */
    resumeFromDeadBall() {
        const info = this.deadBall;
        this.deadBall = null;
        this.deadBallTimer = 0;
        this.match.setPiece = null;

        if (!info) return;

        const taker = this.getPlayer2D(this.carrierId);
        if (!taker) {
            this.pickAmbientCarrier();
            return;
        }

        // Ecken fliegen in den Strafraum, alles andere wird normal weitergespielt
        if (info.kind === "corner") {
            const dir = this.attackDir(info.team);
            const boxX = info.x + dir * 9;
            const target = { x: boxX, y: 50 + _dirRandom.float(-9, 9) };
            this.setBallTravel(target.x, target.y, 0.75 * this.getSpeedScale() + 0.2, "cross");
            this.claimLooseBall(target);
            return;
        }

        if (info.kind === "goalkick") {
            // Abstoß: kurz aufbauen oder lang schlagen, je nach Passspiel
            const tactics = (info.team === "home" ? this.match.homeClub?.tactics : this.match.awayClub?.tactics) || {};
            const goLong = tactics.passing === "direct" || _dirRandom.chance(0.35);
            const mates = this.teamPlayers(info.team).filter(p => p.pos !== "TW");
            const dir = this.attackDir(info.team);

            let receiver;
            if (goLong) {
                receiver = mates.slice().sort((a, b) => (b.x - a.x) * dir)[0];
            } else {
                receiver = mates.filter(p => p.group === "def")
                    .sort((a, b) => Math.hypot(a.x - info.x, a.y - info.y) - Math.hypot(b.x - info.x, b.y - info.y))[0]
                    || mates[0];
            }

            if (receiver) {
                const dist = Math.hypot(receiver.x - info.x, receiver.y - info.y);
                this.setBallTravel(receiver.x, receiver.y,
                    Math.max(0.3, Math.min(1.0, dist / 70)) * this.getSpeedScale() + 0.15,
                    goLong ? "cross" : "pass");
                this.setCarrier(receiver);
            }
            return;
        }

        // Einwurf und Freistoß: normale Entscheidung der Flow-Engine
        this.ambientTimer = this.ambientInterval;
    }

    /**
     * Kommentar zum Spielfluss - sparsam, damit der Ticker nicht zugemüllt wird
     */
    narrateFlow(action) {
        const pools = {
            complete: FLOW_COMMENTARY.pass,
            intercepted: FLOW_COMMENTARY.intercept,
            loose: FLOW_COMMENTARY.loose,
            beaten: FLOW_COMMENTARY.dribble,
            tackled: FLOW_COMMENTARY.tackle
        };

        const pool = pools[action.outcome];
        if (!pool) return;

        // Aufbaupässe nur gelegentlich melden, Ballverluste fast immer
        const chatty = action.outcome === "complete" ? 0.22 : 0.75;
        if (Math.random() > chatty) return;

        const template = _dirRandom.choice(pool) || pool[0];
        const a = action.from;
        const b = action.interceptor || action.defender || action.to;
        const teamName = (name) => name === "home"
            ? (this.match.homeClub?.name || "Heim")
            : (this.match.awayClub?.name || "Gast");

        this.match.lastCommentary = template
            .replace("{minute}", this.match.minute)
            .replace("{a}", a?.name || "Der Ballführende")
            .replace("{b}", b?.name || "der Mitspieler")
            .replace("{club}", teamName(a?.team || this.possessionTeam));
    }

    // ------------------------------------------------------- Ballbewegung

    /**
     * Startet eine Ballbewegung mit fester Dauer, damit Ankunft und
     * Kommentarzeitpunkt exakt zusammenfallen.
     */
    setBallTravel(targetX, targetY, durationSeconds, actionType = "pass") {
        const ball = this.match.ball;
        ball.originX = ball.x;
        ball.originY = ball.y;
        ball.targetX = Math.max(1, Math.min(99, targetX));
        ball.targetY = Math.max(1, Math.min(99, targetY));
        ball.distance = Math.hypot(ball.targetX - ball.originX, ball.targetY - ball.originY);

        // Mindestflugzeit, damit der Ball auch im Schnelldurchlauf nie springt
        const maxSpeedPerSecond = actionType === "shot" ? 190 : (actionType === "cross" ? 130 : 110);
        const minDuration = ball.distance / maxSpeedPerSecond;

        ball.travelDuration = Math.max(0.01, durationSeconds, minDuration);
        ball.travelElapsed = 0;
        ball.actionType = actionType;

        // Merker, um extern gesetzte Ballpositionen zu erkennen
        this._lastTargetX = ball.targetX;
        this._lastTargetY = ball.targetY;
    }

    /**
     * Erlaubt es, den Ball von außen zu setzen (Debug, Tests, Sondersituationen).
     * Die Regie übernimmt die neue Position, statt sie sofort zu überschreiben.
     */
    syncExternalBallOverride() {
        const ball = this.match.ball;
        if (this._lastTargetX === undefined) return;
        if (ball.targetX === this._lastTargetX && ball.targetY === this._lastTargetY) return;

        ball.originX = ball.targetX;
        ball.originY = ball.targetY;
        ball.x = ball.targetX;
        ball.y = ball.targetY;
        ball.travelDuration = 0.01;
        ball.travelElapsed = 0.01;
        ball.distance = 0;
        ball.inFlight = false;

        this._lastTargetX = ball.targetX;
        this._lastTargetY = ball.targetY;

        // Ballführung aufgeben, damit die Vorgabe nicht sofort zurückgezogen wird
        this.carrierId = null;
        ball.holderId = null;
    }

    updateBall(dt) {
        const ball = this.match.ball;

        this.syncExternalBallOverride();

        if (ball.travelDuration === undefined) {
            ball.originX = ball.x;
            ball.originY = ball.y;
            ball.travelDuration = 0.01;
            ball.travelElapsed = 1;
            ball.distance = 0;
        }

        ball.travelElapsed = Math.min(ball.travelDuration, (ball.travelElapsed || 0) + dt);
        const t = ball.travelDuration > 0 ? ball.travelElapsed / ball.travelDuration : 1;

        // Pässe werden abgebremst, Schüsse laufen gleichmäßig durch
        const eased = ball.actionType === "shot" ? t : 1 - Math.pow(1 - t, 2.2);

        ball.x = ball.originX + (ball.targetX - ball.originX) * eased;
        ball.y = ball.originY + (ball.targetY - ball.originY) * eased;

        // Flughöhe für Schatten & Ballgröße (Flanken fliegen am höchsten)
        const arc = ball.actionType === "cross" ? 1.0 : (ball.actionType === "shot" ? 0.45 : 0.2);
        ball.height = Math.sin(Math.PI * t) * arc * Math.min(1, (ball.distance || 0) / 35);
        ball.inFlight = t < 1;

        // Ruht der Ball beim Ballführenden, wird er am Fuß mitgeführt
        if (!ball.inFlight && this.mode === "ambient") {
            const carrier = this.getPlayer2D(this.carrierId);
            if (carrier) {
                const dir = this.attackDir(carrier.team);
                const anchorX = carrier.x + dir * 1.6;
                const anchorY = carrier.y;

                // Nur wenn der Ball bereits beim Spieler ist - sonst läuft ein Pass
                if (Math.hypot(anchorX - ball.x, anchorY - ball.y) < 8) {
                    ball.x += (anchorX - ball.x) * Math.min(1, dt * 9);
                    ball.y += (anchorY - ball.y) * Math.min(1, dt * 9);
                    ball.targetX = ball.x;
                    ball.targetY = ball.y;
                    ball.originX = ball.x;
                    ball.originY = ball.y;
                    this._lastTargetX = ball.targetX;
                    this._lastTargetY = ball.targetY;
                }
            }
        }

        // Schweif für schnelle Bälle
        this.updateBallTrail(dt);
    }

    updateBallTrail(dt) {
        const match = this.match;
        const ball = match.ball;
        if (!Array.isArray(match.ballTrail)) match.ballTrail = [];

        if (ball.inFlight && (ball.distance || 0) > 6) {
            match.ballTrail.unshift({ x: ball.x, y: ball.y, life: 0.28 });
        }

        for (let i = match.ballTrail.length - 1; i >= 0; i--) {
            match.ballTrail[i].life -= dt;
            if (match.ballTrail[i].life <= 0) match.ballTrail.splice(i, 1);
        }
        if (match.ballTrail.length > 14) match.ballTrail.length = 14;
    }

    // ---------------------------------------------------- Spielerbewegung

    /**
     * Bewegt alle 22 Spieler weich zu ihren rollenabhängigen Zielpunkten
     */
    updateMotion(deltaMs) {
        const match = this.match;
        // Ohne Delta (Tests, Sofortmodus) wird ein größerer Schritt angenommen
        const dt = (typeof deltaMs === "number" && deltaMs > 0)
            ? Math.min(0.1, deltaMs / 1000)
            : 0.1;

        this.updateBall(dt);

        const ball = match.ball;
        const players = match.players2D || [];
        const pressers = this.selectPressingPlayers();

        players.forEach(p => {
            const target = this.computeTarget(p, ball, pressers);

            // Weiche Annäherung mit Geschwindigkeitsbegrenzung
            const responsiveness = 7.5 * (target.urgency || 1);
            const k = 1 - Math.exp(-responsiveness * dt);

            let dx = (target.x - p.x) * k;
            let dy = (target.y - p.y) * k;

            const maxStep = p.baseSpeed * (target.urgency || 1) * dt;
            const stepLen = Math.hypot(dx, dy);
            if (stepLen > maxStep && stepLen > 0) {
                dx *= maxStep / stepLen;
                dy *= maxStep / stepLen;
            }

            p.x += dx;
            p.y += dy;
            p.vx = dt > 0 ? dx / dt : 0;
            p.vy = dt > 0 ? dy / dt : 0;
            p.targetX = target.x;
            p.targetY = target.y;

            p.x = Math.max(2, Math.min(98, p.x));
            p.y = Math.max(3, Math.min(97, p.y));
        });

        this.separatePlayers(players, dt);

        if (match.goalFlash > 0) {
            match.goalFlash = Math.max(0, match.goalFlash - dt * 1.4);
        }
    }

    /**
     * Die zwei ballnächsten Gegenspieler pressen den Ballführenden
     */
    selectPressingPlayers() {
        const match = this.match;
        const ball = match.ball;
        const defendingTeam = this.possessionTeam === "home" ? "away" : "home";

        const sorted = this.teamPlayers(defendingTeam)
            .filter(p => p.pos !== "TW")
            .sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y));

        const set = new Set();
        if (sorted[0]) set.add(sorted[0].id);
        if (sorted[1]) set.add(sorted[1].id);
        return set;
    }

    computeTarget(p, ball, pressers) {
        const match = this.match;

        // 1. Torjubel: Torschützen zur Eckfahne, das andere Team sortiert sich
        //    für den Anstoß neu - sonst würden sich alle im eigenen Tor stapeln.
        if (this.mode === "celebration") {
            if (match.celebratingTeam === p.team) {
                // Der Torwart jubelt vor seinem eigenen Strafraum mit,
                // die Feldspieler laufen zur Eckfahne
                if (p.pos === "TW") {
                    const goalX = this.ownGoalX(p.team);
                    return { x: goalX + this.attackDir(p.team) * 16, y: 50, urgency: 1.2 };
                }
                const cornerX = p.team === "home" ? 88 : 12;
                return {
                    x: cornerX + (p.seed % 1.4) * 5,
                    y: 14 + (p.seed % 2.2) * 8,
                    urgency: 1.6
                };
            }
            return { x: p.baseX, y: p.baseY, urgency: 1.2 };
        }

        // 2. Feste Rollen während eines Highlights
        const sceneRole = match.sceneRoles?.get(p.id);
        if (sceneRole) return sceneRole;

        // 3. Torwart bleibt an seinem Tor
        if (p.pos === "TW") return this.computeKeeperTarget(p, ball);

        const attacking = p.team === this.possessionTeam;
        const dir = this.attackDir(p.team);

        // Grundverschiebung: die Mannschaft folgt dem Ball über das Feld
        const follow = p.followWeight * (attacking ? 1.12 : 0.94);
        let tx = p.baseX + (ball.x - 50) * follow;
        let ty = p.baseY + (ball.y - 50) * 0.42;

        // Angreifend breiter, verteidigend kompakter
        if (attacking) {
            ty += (p.baseY - 50) * 0.12;
            tx += dir * 2.5;
        } else {
            ty -= (p.baseY - 50) * 0.16;
            tx -= dir * 2.0;
        }

        let urgency = 1;

        // Pressing des Ballführenden
        if (pressers.has(p.id)) {
            const back = dir * -2.5;
            tx = ball.x + back;
            ty = ball.y + (p.seed % 1) * 3 - 1.5;
            urgency = 1.75;
        } else {
            const dist = Math.hypot(p.x - ball.x, p.y - ball.y);
            if (dist < 26) {
                // Ballnahe Spieler rücken zusammen bzw. bieten sich an
                const pull = (attacking ? 0.26 : 0.44) * (1 - dist / 26);
                tx += (ball.x - tx) * pull;
                ty += (ball.y - ty) * pull;
                urgency = 1.25;
            }
        }

        // Der Ballführende läuft mit dem Ball
        if (this.mode === "ambient" && p.id === this.carrierId) {
            tx = ball.x + dir * 1.2;
            ty = ball.y;
            urgency = 1.35;
        }

        // Leichte Eigenbewegung, damit nichts starr wirkt
        const t = this.elapsedReal;
        tx += Math.sin(t * 0.9 + p.seed) * 1.3;
        ty += Math.cos(t * 0.75 + p.seed * 1.7) * 1.6;

        // Auch bei einem Ball an der eigenen Grundlinie behält die Mannschaft
        // ihre Staffelung: Je offensiver die Rolle, desto weiter bleibt der
        // Spieler vom eigenen Tor entfernt.
        const goalX = this.ownGoalX(p.team);
        const minGap = p.group === "def" ? 3 : (p.group === "mid" ? 11 : 21);
        const maxGap = 92;

        if (dir > 0) tx = Math.max(goalX + minGap, Math.min(goalX + maxGap, tx));
        else tx = Math.max(goalX - maxGap, Math.min(goalX - minGap, tx));

        return { x: Math.max(2, Math.min(98, tx)), y: Math.max(4, Math.min(96, ty)), urgency };
    }

    computeKeeperTarget(p, ball) {
        const goalX = this.ownGoalX(p.team);
        const dir = this.attackDir(p.team);

        // Wie nah ist der Ball am eigenen Tor? (0 = weit weg, 1 = im Strafraum)
        const distToGoal = Math.abs(ball.x - goalX);
        const threat = Math.max(0, 1 - distToGoal / 45);

        return {
            x: goalX + dir * (2.5 + threat * 6),
            y: 50 + (ball.y - 50) * (0.3 + threat * 0.3),
            urgency: threat > 0.6 ? 1.5 : 1
        };
    }

    /**
     * Verhindert, dass Spieler exakt übereinander stehen
     */
    separatePlayers(players, dt) {
        const MIN_DIST = 3.4;
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const a = players[i];
                const b = players[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let d = Math.hypot(dx, dy);

                if (d >= MIN_DIST) continue;
                if (d < 0.001) { dx = 0.1; dy = 0.1; d = 0.14; }

                const push = ((MIN_DIST - d) / 2) * Math.min(1, dt * 12);
                const nx = (dx / d) * push;
                const ny = (dy / d) * push;

                a.x -= nx; a.y -= ny;
                b.x += nx; b.y += ny;
            }
        }
    }
}

if (typeof window !== "undefined") {
    window.LiveMatchDirector = LiveMatchDirector;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LiveMatchDirector };
}
