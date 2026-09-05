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

/**
 * Geschwindigkeitsprofile des Livespiels. Im Browser liegen sie global vor,
 * unter Node werden sie nachgeladen - sonst liefe die Uhr in Tests mit einem
 * anderen Tempo als im Spiel.
 */
const _dirSpeeds = () => {
    if (typeof LIVE_MATCH_SPEEDS !== 'undefined' && LIVE_MATCH_SPEEDS) return LIVE_MATCH_SPEEDS;
    if (typeof window !== 'undefined' && window.LIVE_MATCH_SPEEDS) return window.LIVE_MATCH_SPEEDS;
    if (typeof require !== 'undefined') {
        try { return require('../core/constants.js').LIVE_MATCH_SPEEDS; } catch (e) { /* ohne Bundler */ }
    }
    return null;
};

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

/**
 * Wie stark rückt ein Mannschaftsteil im Ballbesitz mit auf?
 * Die Kette bleibt zurück, das Mittelfeld schiebt nach, der Angriff geht ganz vor.
 */
const GROUP_PUSH = { gk: 0.25, def: 0.85, mid: 1.1, att: 1.5 };

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
    ],
    kickoff: [
        "{minute}' - Anstoß für {club}, der Ball rollt.",
        "{minute}' - {club} eröffnet das Spiel nach dem Pfiff.",
        "{minute}' - Das Spiel ist freigegeben, {club} am Ball."
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

        // Halbzeit Status für Seitenwechsel
        this.isSecondHalf = false;
        // Restzeit des Seitenwechsels: solange traben alle auf ihre neue Seite
        this.sideSwapTimer = 0;

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
        this.celebrationPhase = null;
        this.elapsedReal = 0;

        // Spielunterbrechung mit Regie (Karte, Verletzung, Elfmeterentscheidung)
        this.drama = null;

        // Der Unparteiische läuft im Diagonalsystem schräg hinter dem Ball her
        this.referee = { x: 50, y: 58 };
        liveMatch.referee = this.referee;

        this.targetPossession = Array.isArray(liveMatch?.timeline?.possession)
            ? [...liveMatch.timeline.possession]
            : [50, 50];

        // Ausgangszustand des Balls merken, damit externe Vorgaben erkannt werden
        this._lastTargetX = liveMatch?.ball?.targetX;
        this._lastTargetY = liveMatch?.ball?.targetY;

        // Ruhender Ball (Einwurf, Abstoß, Ecke, Freistoß, Anstoß)
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

        // Start mit einem Anstoß anstelle von reinem "startAmbient"
        this.mode = "ambient";
        this.startDeadBall("kickoff", this.targetPossession[0] >= 50 ? "home" : "away", 50, 50);
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
            // Frische: sinkt über die 90 Minuten und bremst den Spieler
            if (typeof p.freshness !== "number") p.freshness = 1;
            p.sprinting = false;
            p.facing = this.attackDir(p.team) > 0 ? 0 : Math.PI;
        });
    }

    /**
     * Mannschaftsteil einer Position.
     *
     * Die Formationen benennen Halbpositionen fein (ZDM, RZM, LOM ...). Ohne
     * Übersetzung landete jeder Sechser im Sturm - die Mannschaft stand auf
     * dem Feld dadurch komplett falsch.
     */
    getGroup(pos) {
        const posEngine = (typeof PositionEngine !== "undefined" && PositionEngine)
            ? PositionEngine
            : ((typeof window !== "undefined" && window.PositionEngine) ? window.PositionEngine
                : (typeof require !== "undefined" ? require("./positionEngine.js").PositionEngine : null));

        const clean = (posEngine && typeof posEngine.normalizePosition === "function")
            ? (posEngine.normalizePosition(pos) || pos)
            : pos;

        if (clean === "TW") return "gk";
        if (["IV", "LV", "RV"].includes(clean)) return "def";
        if (["DM", "ZM", "OM", "LM", "RM"].includes(clean)) return "mid";
        return "att";
    }

    /** Torlinie des eigenen Tores, wechselt in Halbzeit 2 die Seite */
    ownGoalX(team) {
        const x = team === "home" ? 4 : 96;
        return this.isSecondHalf ? 100 - x : x;
    }

    /** Angriffsrichtung: +1 = nach rechts, wechselt in Halbzeit 2 die Seite */
    attackDir(team) {
        const dir = team === "home" ? 1 : -1;
        return this.isSecondHalf ? -dir : dir;
    }

    teamPlayers(team) {
        return (this.match.players2D || []).filter(p => p.team === team);
    }

    getPlayer2D(playerId) {
        if (playerId === null || playerId === undefined) return null;
        return (this.match.players2D || []).find(p => p.id === playerId) || null;
    }

    // ------------------------------------------------------------ Zeitlauf

    getClockRate() {
        return this.getBaseClockRate() * this.getTimeScale();
    }

    getBaseClockRate() {
        const speeds = _dirSpeeds();
        const cfg = speeds ? (speeds[this.match.speed] || speeds[1]) : null;
        if (cfg && cfg.matchSecondsPerRealSecond > 0) return cfg.matchSecondsPerRealSecond;

        const intervalMs = this.match.getTickIntervalMs();
        const minuteStep = this.match.getMinuteStep();
        return (60 * minuteStep) / (intervalMs / 1000);
    }

    getTimeScale() {
        if (this.drama) return this.drama.timeScale;
        if (this.mode === "celebration") {
            return this.celebrationPhase === "slowmo" ? 0.04 : 0.12;
        }
        if (this.mode === "highlight") return 0.45;
        if (this.deadBall) return 0.55;
        return 1;
    }

    getMotionScale() {
        if (this.match.motionFreeze) return 0;
        if (this.mode === "celebration" && this.celebrationPhase === "slowmo") return 0.28;
        if (this.drama) return 0.15;
        return 1;
    }

    getSpeedScale() {
        const intervalMs = this.match.getTickIntervalMs();
        if (intervalMs >= 2000) return 1.0;
        if (intervalMs >= 1000) return 0.72;
        return 0.34;
    }

    advanceRealTime(realMs) {
        const match = this.match;
        if (match.isFinished || match.isPaused) return;

        const dt = Math.max(0, Math.min(0.25, (Number(realMs) || 0) / 1000));
        if (dt <= 0) return;

        this.elapsedReal += dt;
        const matchSecondsDelta = dt * this.getClockRate();
        this.clock += matchSecondsDelta;

        this.drainStamina(matchSecondsDelta);
        this.updateBanner(dt);
        this.syncMinute();
        this.updatePossessionStats(dt);
        this.updateReferee(dt);

        if (this.updateDrama(dt)) return;

        this.step(dt, false);
    }

    startDrama(kind, options = {}) {
        const scale = this.getSpeedScale();
        this.drama = {
            kind,
            timer: (options.duration || 1.5) * scale,
            timeScale: options.timeScale !== undefined ? options.timeScale : 0.05,
            freeze: options.freeze !== false,
            refereeTarget: options.refereeTarget || null,
            card: options.card || null
        };

        this.match.drama = { kind, card: this.drama.card };
        this.match.motionFreeze = this.drama.freeze;
    }

    updateDrama(dt) {
        if (!this.drama) return false;

        this.drama.timer -= dt;
        if (this.drama.timer > 0) return true;

        this.drama = null;
        this.match.drama = null;
        this.match.motionFreeze = false;
        this.match.refereeCard = null;
        return false;
    }

    updateReferee(dt) {
        const ref = this.referee;
        const ball = this.match.ball;
        let tx;
        let ty;

        if (this.drama && this.drama.refereeTarget) {
            tx = this.drama.refereeTarget.x;
            ty = this.drama.refereeTarget.y - 3.5;
        } else if (this.mode === "celebration") {
            tx = 50;
            ty = 57;
        } else {
            tx = ball.x - (this.possessionTeam === "home" ? 8 : -8);
            ty = ball.y + (ball.y < 50 ? 8 : -8);
        }

        const k = Math.min(1, dt * 1.8);
        ref.x += (tx - ref.x) * k;
        ref.y += (ty - ref.y) * k;
        ref.x = Math.max(3, Math.min(97, ref.x));
        ref.y = Math.max(4, Math.min(96, ref.y));

        this.match.referee = ref;
        this.match.refereeCard = this.drama ? this.drama.card : null;
    }

    advanceMatchSeconds(seconds) {
        const match = this.match;
        if (match.isFinished) return;

        this.clock += Math.max(0, seconds);
        this.syncMinute();
        this.updatePossessionStats(Math.max(0, seconds) / 30);

        let guard = 0;
        while (this.hasDueEvent() && guard++ < 200) {
            const ev = this.match.timeline[this.match.timelineIndex];
            this.match.timelineIndex++;
            this.match.processEvent(ev);
            this.applyEventBallState(ev, true);
        }

        this.match.checkForFinish();
    }

    drainStamina(matchSeconds) {
        if (!(matchSeconds > 0)) return;

        (this.match.players2D || []).forEach(p => {
            const stamina = typeof p.stamina === "number" ? p.stamina : 75;
            const endurance = Math.max(0.35, 1.35 - stamina / 100);
            const rate = (p.sprinting ? 0.00009 : 0.00003) * endurance;
            p.freshness = Math.max(0.6, (p.freshness ?? 1) - rate * matchSeconds);
        });
    }

    syncMinute() {
        const match = this.match;
        const minute = Math.floor(this.clock / 60);
        if (minute !== match.minute) {
            const previous = match.minute;
            match.minute = minute;
            match.updatePhaseLabel();
            this.checkPhaseBanners(previous, minute);
        }
        match.seconds = Math.floor(this.clock % 60);
    }

    /** Führt den Seitenwechsel (Positionen & Richtungen spiegeln) durch */
    /**
     * Seitenwechsel zur zweiten Halbzeit.
     *
     * Gespiegelt wird nur das taktische Grundgerüst. Die Spieler traben
     * anschließend selbst auf ihre neue Hälfte - würde man auch ihre
     * aktuellen Koordinaten spiegeln, sprängen in einem einzigen Bild
     * zweiundzwanzig Spieler quer über den Platz.
     */
    swapSides() {
        this.isSecondHalf = true;
        const players = this.match.players2D || [];

        players.forEach(p => {
            // Grundpositionen spiegeln
            p.baseX = 100 - p.baseX;
            p.baseY = 100 - p.baseY;
        });

        // Referee ebenfalls spiegeln
        this.referee.x = 100 - this.referee.x;
        this.referee.y = 100 - this.referee.y;

        // Während des Seitenwechsels laufen alle zügig auf ihre neue Position
        this.sideSwapTimer = 9;

        this._teamLineBase = {}; // Zwischenspeicher leeren
    }

    checkPhaseBanners(previousMinute, minute) {
        if (previousMinute < 1 && minute >= 1) {
            this.showBanner("ANPFIFF", `${this.match.homeClub?.name || "Heim"} – ${this.match.awayClub?.name || "Gast"}`);
        } else if (previousMinute < 45 && minute >= 45) {
            const extra = this.match.timeline?.extraTime?.firstHalf;
            this.showBanner("HALBZEIT", extra ? `+${extra} Minuten Nachspielzeit` : null, "rgba(30, 41, 59, 0.94)");
        } else if (previousMinute < 46 && minute >= 46) {
            this.showBanner("ZWEITE HALBZEIT", `${this.match.homeScore} : ${this.match.awayScore}`);

            // Seitenwechsel und Anstoß für die 2. Halbzeit durchführen
            if (!this.isSecondHalf) {
                this.swapSides();
                const kickoffTeam = this.targetPossession[0] >= 50 ? "away" : "home";
                this.startDeadBall("kickoff", kickoffTeam, 50, 50);
                // Der Anstoß wartet, bis beide Mannschaften die Seiten
                // tatsächlich getauscht haben
                this.deadBallTimer = Math.max(this.deadBallTimer, this.sideSwapTimer);
            }
        } else if (previousMinute < 90 && minute >= 90) {
            const extra = this.match.timeline?.extraTime?.secondHalf;
            this.showBanner("NACHSPIELZEIT", extra ? `+${extra} Minuten` : null, "rgba(120, 53, 15, 0.92)");
        }
    }

    showBanner(title, subtitle = null, color = null) {
        this.match.banner = {
            title,
            subtitle,
            color: color || "rgba(15, 23, 42, 0.92)",
            timer: 2.6 * Math.max(0.5, this.getSpeedScale())
        };
    }

    updateBanner(dt) {
        const banner = this.match.banner;
        if (!banner) return;
        banner.timer -= dt;
        if (banner.timer <= 0) this.match.banner = null;
    }

    updatePossessionStats(dt) {
        const stats = this.match.stats;
        if (!stats || !Array.isArray(stats.possession)) return;

        const target = this.targetPossession[0] || 50;
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
            if (this.celebrationTimer > 0) return;

            if (this.celebrationPhase === "slowmo") {
                this.celebrationPhase = "jubel";
                this.celebrationTimer = 3.0 * this.getSpeedScale();
                this.match.slowMotion = 0;

                const info = this.match.celebrationInfo;
                this.showBanner(
                    "⚽ TOR!",
                    info ? `${info.scorer || "Torschütze"} · ${info.clubName || ""} · ${info.score}` : null,
                    "rgba(21, 128, 61, 0.94)"
                );
                this.cueSound("crowd");
                return;
            }

            this.finishCelebration();
            return;
        }

        if (this.mode === "highlight") {
            this.updateHighlight(dt);
            return;
        }

        if (this.hasDueEvent()) {
            this.startHighlight();
            return;
        }

        this.updateAmbient(dt);
        this.match.checkForFinish();
    }

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

        this.clock = Math.max(this.clock, this.eventTime(events[0]));
        this.syncMinute();

        const attackingTeam = this.attackingTeamOf(events[0]);
        if (attackingTeam) {
            this.possessionTeam = attackingTeam;
            this.possessionChain = 0;
        }

        this.mode = "highlight";
        this.scene = { events, index: 0, phase: null };
        this.beginEventPhase("approach");
    }

    attackingTeamOf(ev) {
        if (!ev || !ev.team) return null;
        const defensiveEvents = ["save", "foul", "tackle", "yellow_card", "red_card"];
        if (defensiveEvents.includes(ev.type)) {
            return ev.team === "home" ? "away" : "home";
        }
        if (ev.type === "substitution" || ev.type === "injury") return null;
        return ev.team;
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
                this.beginEventPhase("action");
            }
            return;
        }

        if (phase === "action") {
            const end = ev.end || ev.start || { x: ball.x, y: ball.y };
            const actionType = this.getActionType(ev);
            const duration = this.getActionDuration(ev, actionType) * scale;

            this.assignSceneRoles(ev, "action");

            if (!RESOLVE_ON_ARRIVAL.includes(ev.type)) {
                this.resolveEvent(ev);
            }

            this.setBallTravel(end.x, end.y, duration, actionType);
            this.phaseTimer = duration;
            return;
        }

        if (phase === "resolve") {
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
        this.celebrationPhase = "slowmo";
        this.celebrationTimer = 1.1 * this.getSpeedScale();
        this.scoringTeam = ev.team;
        this.match.celebratingTeam = ev.team;
        this.match.goalFlash = 1.0;
        this.match.slowMotion = 1;
        this.match.celebrationInfo = {
            scorer: ev.playerName || null,
            assist: ev.assistName || null,
            team: ev.team,
            clubName: ev.team === "home"
                ? (this.match.homeClub?.name || "Heim")
                : (this.match.awayClub?.name || "Gast"),
            score: `${this.match.homeScore}:${this.match.awayScore}`
        };
    }

    finishCelebration() {
        this.match.celebratingTeam = null;
        this.match.slowMotion = 0;
        this.match.celebrationInfo = null;
        this.celebrationPhase = null;
        this.celebrationTimer = 0;

        // Anstoß hat immer die Mannschaft, die das Tor kassiert hat
        const scoringTeam = this.scene?.events?.[this.scene.index]?.team || this.scoringTeam;
        const kickoffTeam = scoringTeam === "home" ? "away" : "home";
        this.scoringTeam = null;

        if (!this.scene) {
            this.mode = "ambient";
            this.startDeadBall("kickoff", kickoffTeam, 50, 50);
            return;
        }

        this.scene.index++;
        if (this.scene.index >= this.scene.events.length) {
            this.scene = null;
            this.mode = "ambient";
            this.startDeadBall("kickoff", kickoffTeam, 50, 50);
        } else {
            this.mode = "highlight";
            this.beginEventPhase("approach");
        }
    }

    resolveEvent(ev) {
        if (!ev || ev._resolved) return;
        ev._resolved = true;
        this.match.processEvent(ev);
        this.applyEventBallState(ev, false);
        this.bannerForEvent(ev);
    }

    cueSound(name) {
        if (!Array.isArray(this.match.soundCues)) this.match.soundCues = [];
        if (this.match.soundCues.length < 8) this.match.soundCues.push(name);
    }

    bannerForEvent(ev) {
        const club = ev.team === "home"
            ? (this.match.homeClub?.name || "Heim")
            : (this.match.awayClub?.name || "Gast");

        if (ev.type === "foul" || ev.type === "yellow_card" || ev.type === "red_card") {
            this.cueSound("whistle");
        } else if (ev.type === "goal") {
            this.cueSound("goal");
        } else if (ev.type === "save" || ev.type === "shot_miss") {
            this.cueSound("gasp");
        }

        const tatort = ev.start || ev.end || null;

        if (ev.type === "yellow_card") {
            this.showBanner(ev.isSecondYellow ? "🟨🟥 GELB-ROT" : "🟨 GELBE KARTE",
                `${ev.playerName || "Spieler"} · ${club}`, "rgba(133, 100, 4, 0.94)");
            this.startDrama("card", {
                duration: ev.isSecondYellow ? 2.4 : 1.6,
                card: ev.isSecondYellow ? "second_yellow" : "yellow",
                refereeTarget: tatort
            });
        } else if (ev.type === "red_card") {
            this.showBanner("🟥 ROTE KARTE", `${ev.playerName || "Spieler"} · ${club}`, "rgba(127, 29, 29, 0.94)");
            this.startDrama("card", { duration: 2.8, card: "red", refereeTarget: tatort });
        } else if (ev.type === "substitution") {
            this.showBanner("🔄 WECHSEL", `${ev.playerInName || "?"} für ${ev.playerOutName || "?"} · ${club}`, "rgba(6, 78, 59, 0.94)");
            this.startDrama("substitution", { duration: 1.3, timeScale: 0.1 });
        } else if (ev.type === "injury") {
            this.showBanner("🚑 VERLETZUNG", `${ev.playerName || "Spieler"} · ${club}`, "rgba(127, 29, 29, 0.9)");
            this.startDrama("injury", { duration: 2.2, refereeTarget: tatort });
        } else if (ev.type === "foul" && (ev.outcome === "penalty" || ev.isPenalty)) {
            this.showBanner("🛑 ELFMETER!", club, "rgba(30, 64, 175, 0.94)");
            this.startDrama("penalty", { duration: 2.4, refereeTarget: ev.end || tatort });
        }
    }

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

        const dist = Math.hypot(chosen.x - ball.x, chosen.y - ball.y);
        if (dist > 1.5) {
            this.setBallTravel(chosen.x, chosen.y, Math.max(0.18, Math.min(0.7, dist / 75)), "pass");
        }
    }

    setCarrier(player) {
        if (!player) return;
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

    updateAmbient(dt) {
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

    applyFlowAction(action) {
        const from = action.from;
        const to = action.to;
        const dist = Math.hypot((to.x ?? from.x) - from.x, (to.y ?? from.y) - from.y);

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

        const defender = action.defender;
        this.flowStats.turnovers++;
        if (defender) {
            this.possessionTeam = defender.team;
            this.setBallTravel(defender.x, defender.y, duration * 0.7, "pass");
            this.setCarrier(defender);
        }
        this.narrateFlow(action);
    }

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

    handleOutOfPlay(action, to) {
        const x = to.x ?? 0;
        const y = to.y ?? 0;
        const team = action.from?.team || this.possessionTeam;

        if (y < 1.5 || y > 98.5) {
            const spotY = y < 1.5 ? 1.5 : 98.5;
            const spotX = Math.max(4, Math.min(96, x));
            this.startDeadBall("throwin", team === "home" ? "away" : "home", spotX, spotY);
            return true;
        }

        if (x < 1.5 || x > 98.5) {
            const defendingTeam = x < 1.5 ? "home" : "away";
            const goalX = x < 1.5 ? 8 : 92;
            this.startDeadBall("goalkick", defendingTeam, goalX, 50);
            return true;
        }

        return false;
    }

    startDeadBall(kind, team, x, y) {
        const speedScale = this.getSpeedScale();
        this.deadBall = { kind, team, x, y };
        this.possessionTeam = team;
        this.flowStats.setPieces++;

        const dist = Math.hypot(x - this.match.ball.x, y - this.match.ball.y);
        this.setBallTravel(x, y, Math.max(0.25, Math.min(0.9, dist / 90)) * speedScale + 0.15, "pass");

        const executor = this.pickSetPieceTaker(kind, team, x, y);
        if (executor) {
            this.carrierId = executor.id;
            this.match.ball.holderId = executor.id;
            this.match.activePlayerId = executor.id;
        }

        this.deadBallTimer = (kind === "goalkick" ? 1.2 : kind === "corner" ? 1.5 : 0.85) * speedScale + 0.3;
        if (kind !== "throwin") this.cueSound("whistle");
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

    pickSetPieceTaker(kind, team, x, y) {
        const squad = this.teamPlayers(team);
        if (squad.length === 0) return null;

        if (kind === "goalkick") {
            return squad.find(p => p.pos === "TW") || squad[0];
        }

        const outfield = squad.filter(p => p.pos !== "TW");
        const pool = outfield.length > 0 ? outfield : squad;

        if (kind === "corner") {
            return pool.slice().sort((a, b) =>
                (this.setPieceSkill(b) - this.setPieceSkill(a))
            )[0];
        }

        return pool.slice().sort((a, b) =>
            Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)
        )[0];
    }

    setPieceSkill(player) {
        const t = typeof player.technique === "number" ? player.technique : 65;
        const p = typeof player.passing === "number" ? player.passing : 65;
        return t * 0.5 + p * 0.5;
    }

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

        // Anstoß-Verarbeitung: Kurzer Pass zum nächsten Mitspieler zurück
        if (info.kind === "kickoff") {
            const mates = this.teamPlayers(info.team).filter(p => p.pos !== "TW" && p.id !== this.carrierId);
            const receiver = mates.sort((a, b) =>
                Math.hypot(a.x - info.x, a.y - info.y) - Math.hypot(b.x - info.x, b.y - info.y)
            )[0];

            if (receiver) {
                const dist = Math.hypot(receiver.x - info.x, receiver.y - info.y);
                this.setBallTravel(receiver.x, receiver.y,
                    Math.max(0.3, Math.min(0.8, dist / 70)) * this.getSpeedScale() + 0.15,
                    "pass");
                this.setCarrier(receiver);
            } else {
                this.ambientTimer = this.ambientInterval;
            }
            return;
        }

        if (info.kind === "corner") {
            const dir = this.attackDir(info.team);
            const boxX = info.x + dir * 9;
            const target = { x: boxX, y: 50 + _dirRandom.float(-9, 9) };
            this.setBallTravel(target.x, target.y, 0.75 * this.getSpeedScale() + 0.2, "cross");
            this.claimLooseBall(target);
            return;
        }

        if (info.kind === "goalkick") {
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

        this.ambientTimer = this.ambientInterval;
    }

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

    setBallTravel(targetX, targetY, durationSeconds, actionType = "pass") {
        const ball = this.match.ball;
        ball.originX = ball.x;
        ball.originY = ball.y;
        ball.targetX = Math.max(1, Math.min(99, targetX));
        ball.targetY = Math.max(1, Math.min(99, targetY));
        ball.distance = Math.hypot(ball.targetX - ball.originX, ball.targetY - ball.originY);

        const maxSpeedPerSecond = actionType === "shot" ? 190 : (actionType === "cross" ? 130 : 110);
        const minDuration = ball.distance / maxSpeedPerSecond;

        ball.travelDuration = Math.max(0.01, durationSeconds, minDuration);
        ball.travelElapsed = 0;
        ball.actionType = actionType;

        this._lastTargetX = ball.targetX;
        this._lastTargetY = ball.targetY;
    }

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

        const eased = ball.actionType === "shot" ? t : 1 - Math.pow(1 - t, 2.2);

        ball.x = ball.originX + (ball.targetX - ball.originX) * eased;
        ball.y = ball.originY + (ball.targetY - ball.originY) * eased;

        const arc = ball.actionType === "cross" ? 1.0 : (ball.actionType === "shot" ? 0.45 : 0.2);
        ball.height = Math.sin(Math.PI * t) * arc * Math.min(1, (ball.distance || 0) / 35);
        ball.inFlight = t < 1;

        if (!ball.inFlight && this.mode === "ambient") {
            const carrier = this.getPlayer2D(this.carrierId);
            if (carrier) {
                const dir = this.attackDir(carrier.team);
                const anchorX = carrier.x + dir * 1.6;
                const anchorY = carrier.y;

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

    updateMotion(deltaMs) {
        const match = this.match;
        const rawDt = (typeof deltaMs === "number" && deltaMs > 0)
            ? Math.min(0.1, deltaMs / 1000)
            : 0.1;

        const dt = rawDt * this.getMotionScale();

        this.updateBall(dt);

        const ball = match.ball;
        const players = match.players2D || [];
        const pressers = this.selectPressingPlayers();

        if (dt <= 0) {
            players.forEach(p => { p.vx = 0; p.vy = 0; p.speed = 0; });
            if (match.goalFlash > 0) {
                match.goalFlash = Math.max(0, match.goalFlash - rawDt * 1.4);
            }
            return;
        }

        if (this.sideSwapTimer > 0) this.sideSwapTimer = Math.max(0, this.sideSwapTimer - dt);

        players.forEach(p => {
            const target = this.sideSwapTimer > 0
                ? { x: p.baseX, y: p.baseY, urgency: 1.25 }
                : this.computeTarget(p, ball, pressers);

            const responsiveness = 7.5 * (target.urgency || 1);
            const k = 1 - Math.exp(-responsiveness * dt);

            let dx = (target.x - p.x) * k;
            let dy = (target.y - p.y) * k;

            const maxStep = p.baseSpeed * (target.urgency || 1) * (0.62 + p.freshness * 0.38) * dt;
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

            const speed = Math.hypot(p.vx, p.vy);
            if (speed > 0.6) {
                const desired = Math.atan2(p.vy, p.vx);
                let diff = desired - p.facing;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                p.facing += diff * Math.min(1, dt * 9);
            }
            p.speed = speed;

            p.x = Math.max(2, Math.min(98, p.x));
            p.y = Math.max(3, Math.min(97, p.y));
        });

        this.separatePlayers(players, dt);

        if (match.goalFlash > 0) {
            match.goalFlash = Math.max(0, match.goalFlash - rawDt * 1.4);
        }
    }

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

        if (this.mode === "celebration") {
            if (match.celebratingTeam === p.team) {
                if (p.pos === "TW") {
                    const goalX = this.ownGoalX(p.team);
                    return { x: goalX + this.attackDir(p.team) * 16, y: 50, urgency: 1.2 };
                }
                const cornerX = p.team === "home" ? (this.isSecondHalf ? 12 : 88) : (this.isSecondHalf ? 88 : 12);
                return {
                    x: cornerX + (p.seed % 1.4) * 5,
                    y: 14 + (p.seed % 2.2) * 8,
                    urgency: 1.6
                };
            }
            return { x: p.baseX, y: p.baseY, urgency: 1.2 };
        }

        const sceneRole = match.sceneRoles?.get(p.id);
        if (sceneRole) return sceneRole;

        if (p.pos === "TW") return this.computeKeeperTarget(p, ball);

        const attacking = p.team === this.possessionTeam;
        const dir = this.attackDir(p.team);

        if (this.deadBall) {
            const setPieceTarget = this.computeSetPieceTarget(p, this.deadBall);
            if (setPieceTarget) return setPieceTarget;
        }

        const ballProgress = dir > 0 ? ball.x / 100 : 1 - ball.x / 100;

        let tx;
        let ty = p.baseY + (ball.y - 50) * 0.42;

        if (attacking) {
            const push = Math.max(0, ballProgress - 0.35) * 55;
            const groupPush = GROUP_PUSH[p.group] ?? 1.0;
            tx = p.baseX + dir * push * groupPush + dir * 2.5;

            ty += (p.baseY - 50) * 0.14;
        } else {
            const follow = p.followWeight * 0.94;
            tx = p.baseX + (ball.x - 50) * follow - dir * 2.0;
            ty -= (p.baseY - 50) * 0.16;
        }

        let urgency = 1;
        let sprinting = false;

        if (!attacking && p.group === "def") {
            const line = this.getDefensiveLineX(p.team, ball);
            tx = line + (p.baseX - this.getTeamLineBase(p.team)) * 0.35;
        }

        if (attacking && (p.pos === "LV" || p.pos === "RV")) {
            const onHisSide = Math.abs(ball.y - p.baseY) < 30;
            const inFinalThird = dir > 0 ? ball.x > 58 : ball.x < 42;
            if (onHisSide && inFinalThird) {
                tx += dir * 16;
                ty += (p.baseY < 50 ? -6 : 6);
                urgency = 1.45;
                sprinting = true;
            }
        }

        if (attacking && p.group === "att") {
            const advanced = dir > 0 ? ball.x > 45 : ball.x < 55;
            if (advanced) {
                tx += dir * 9;
                urgency = 1.3;
                sprinting = true;
            }
        }

        if (pressers.has(p.id)) {
            const back = dir * -2.5;
            tx = ball.x + back;
            ty = ball.y + (p.seed % 1) * 3 - 1.5;
            urgency = 1.85;
            sprinting = true;
        } else if (!attacking && p.group !== "def") {
            const mark = this.findMarkingTarget(p);
            if (mark) {
                tx = mark.x - dir * 3.5;
                ty = mark.y + (p.seed % 1) * 2 - 1;
                urgency = 1.2;
            }
        } else {
            const dist = Math.hypot(p.x - ball.x, p.y - ball.y);
            if (dist < 26) {
                const pull = (attacking ? 0.26 : 0.44) * (1 - dist / 26);
                tx += (ball.x - tx) * pull;
                ty += (ball.y - ty) * pull;
                urgency = 1.25;
            }
        }

        if (this.mode === "ambient" && p.id === this.carrierId) {
            tx = ball.x + dir * 1.2;
            ty = ball.y;
            urgency = 1.4;
            sprinting = true;
        }

        const t = this.elapsedReal;
        tx += Math.sin(t * 0.9 + p.seed) * 1.3;
        ty += Math.cos(t * 0.75 + p.seed * 1.7) * 1.6;

        const goalX = this.ownGoalX(p.team);
        const minGap = p.group === "def" ? 3 : (p.group === "mid" ? 11 : 21);
        const maxGap = 92;

        if (dir > 0) tx = Math.max(goalX + minGap, Math.min(goalX + maxGap, tx));
        else tx = Math.max(goalX - maxGap, Math.min(goalX - minGap, tx));

        p.sprinting = sprinting;

        return { x: Math.max(2, Math.min(98, tx)), y: Math.max(4, Math.min(96, ty)), urgency };
    }

    getDefensiveLineX(team, ball) {
        const dir = this.attackDir(team);
        const goalX = this.ownGoalX(team);
        const tactics = (team === "home" ? this.match.homeClub?.tactics : this.match.awayClub?.tactics) || {};

        let depth = 30;
        if (tactics.defensiveLine === "high") depth = 42;
        else if (tactics.defensiveLine === "deep") depth = 20;

        const ballAdvance = dir > 0 ? ball.x : 100 - ball.x;
        const line = Math.max(10, Math.min(depth + 18, ballAdvance - 12));

        return dir > 0 ? goalX + line : goalX - line;
    }

    getTeamLineBase(team) {
        if (!this._teamLineBase) this._teamLineBase = {};
        if (this._teamLineBase[team] === undefined) {
            const defenders = this.teamPlayers(team).filter(p => p.group === "def");
            const list = defenders.length > 0 ? defenders : this.teamPlayers(team);
            this._teamLineBase[team] = list.reduce((s, p) => s + p.baseX, 0) / (list.length || 1);
        }
        return this._teamLineBase[team];
    }

    findMarkingTarget(player) {
        const opponents = this.teamPlayers(player.team === "home" ? "away" : "home")
            .filter(o => o.pos !== "TW" && o.id !== this.carrierId);

        let best = null;
        let bestDist = 26;
        opponents.forEach(o => {
            const d = Math.hypot(o.x - player.x, o.y - player.y);
            if (d < bestDist) { bestDist = d; best = o; }
        });
        return best;
    }

    computeSetPieceTarget(p, info) {
        const dir = this.attackDir(info.team);
        const isTaker = p.id === this.carrierId;

        // Anstoß: Die eigene Mannschaft muss sich strikt in der eigenen Hälfte aufhalten
        if (info.kind === "kickoff") {
            if (isTaker) {
                return { x: info.x, y: info.y, urgency: 1.7 };
            }
            if (p.pos === "TW") return this.computeKeeperTarget(p, this.match.ball);

            const pDir = this.attackDir(p.team);
            // Begrenzung auf die korrekte Spielfeldhälfte
            const ownHalfX = pDir > 0 ? Math.min(p.baseX, 48) : Math.max(p.baseX, 52);

            return { x: ownHalfX, y: p.baseY, urgency: 1.2 };
        }

        if (isTaker) {
            return { x: info.x - dir * 1.5, y: info.y, urgency: 1.7 };
        }

        if (p.pos === "TW") return this.computeKeeperTarget(p, this.match.ball);

        const attacking = p.team === info.team;

        if (info.kind === "corner") {
            const boxX = info.x + dir * (attacking ? 10 : 7);
            const spread = (p.seed % 3) - 1;
            return {
                x: boxX + spread * 3,
                y: 42 + (p.seed % 5) * 4,
                urgency: 1.4
            };
        }

        if (info.kind === "goalkick") {
            if (attacking) {
                return { x: p.baseX + dir * 4, y: p.baseY + (p.baseY < 50 ? -5 : 5), urgency: 1.1 };
            }
            return { x: p.baseX - dir * 6, y: p.baseY, urgency: 1.1 };
        }

        if (info.kind === "throwin") {
            const dist = Math.hypot(p.x - info.x, p.y - info.y);
            if (dist < 28) {
                const offset = attacking ? 8 : 5;
                return {
                    x: info.x + dir * (p.seed % 2 === 0 ? offset : -offset * 0.6),
                    y: info.y + (info.y < 50 ? 1 : -1) * (6 + (p.seed % 4) * 4),
                    urgency: 1.25
                };
            }
        }

        return null;
    }

    computeKeeperTarget(p, ball) {
        const goalX = this.ownGoalX(p.team);
        const dir = this.attackDir(p.team);

        const distToGoal = Math.abs(ball.x - goalX);
        const threat = Math.max(0, 1 - distToGoal / 45);

        return {
            x: goalX + dir * (2.5 + threat * 6),
            y: 50 + (ball.y - 50) * (0.3 + threat * 0.3),
            urgency: threat > 0.6 ? 1.5 : 1
        };
    }

    separatePlayers(players, dt) {
        const MIN_DIST = 4.2;
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