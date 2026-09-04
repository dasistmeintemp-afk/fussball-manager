/**
 * MatchFlowEngine - Ballbesitz-Mikrosimulation zwischen den Highlights
 *
 * Bisher wurde der Ball zwischen zwei Timeline-Ereignissen zufällig hin- und
 * hergeschoben. Das machte gut die Hälfte der Spielzeit aus und wirkte dadurch
 * beliebig. Diese Engine trifft stattdessen echte Spielentscheidungen:
 *
 *  - Wie stark steht der Ballführende unter Druck?
 *  - Welche Anspielstationen sind frei, welche Passwege zugestellt?
 *  - Lohnt sich ein Dribbling, ein Verlagern, ein langer Ball, ein Rückpass?
 *  - Wer fängt einen Fehlpass ab, wer gewinnt den Zweikampf?
 *
 * Grundlage sind die Spielerattribute und die sieben Taktikregler des Vereins.
 * Die Engine liefert dem Regisseur reine Handlungsbeschreibungen zurück; das
 * Animieren und Auswerten bleibt dort.
 *
 * Wichtig: Alle zählbaren Ereignisse (Tore, Schüsse, Karten, Fouls, Ecken)
 * kommen weiterhin ausschließlich aus der Timeline. Diese Engine erzeugt nur
 * das Spiel dazwischen, damit Live-Statistik und Spielbericht deckungsgleich
 * bleiben.
 */

const _flowRandom = (typeof Random !== 'undefined' && Random)
    ? Random
    : ((typeof require !== 'undefined') ? require('../core/random.js').Random : {
        float: (min, max) => Math.random() * (max - min) + min,
        int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        choice: arr => (Array.isArray(arr) && arr.length > 0) ? arr[Math.floor(Math.random() * arr.length)] : null,
        chance: prob => Math.random() < prob,
        clamp: (val, min, max) => Math.max(min, Math.min(max, val))
    });

/** Spielphasen des Ballbesitzes */
const FLOW_PHASES = {
    GOAL_KICK: "goalkick",
    BUILDUP: "buildup",
    PROGRESSION: "progression",
    FINAL_THIRD: "final_third",
    TRANSITION: "transition"
};

class MatchFlowEngine {
    constructor(options = {}) {
        // Zugriff auf die Spieler des Feldes und die Vereinsdaten
        this.getPlayers = options.getPlayers || (() => []);
        this.getTactics = options.getTactics || (() => ({}));
        this.attackDir = options.attackDir || (team => (team === "home" ? 1 : -1));
        this.ownGoalX = options.ownGoalX || (team => (team === "home" ? 4 : 96));

        this.phase = FLOW_PHASES.BUILDUP;
    }

    // ------------------------------------------------------------- Hilfsmittel

    teamOf(team) {
        return this.getPlayers().filter(p => p.team === team);
    }

    opponentsOf(team) {
        return this.getPlayers().filter(p => p.team !== team);
    }

    distance(a, b) {
        return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0));
    }

    /**
     * Wie stark wird ein Spieler bedrängt? 0 = frei, 1 = eng gedeckt.
     */
    getPressure(player, opponents) {
        let pressure = 0;
        opponents.forEach(o => {
            const d = this.distance(player, o);
            if (d < 16) pressure += (1 - d / 16) ** 1.5;
        });
        return Math.min(1.6, pressure);
    }

    /**
     * Wie zugestellt ist ein Passweg? 0 = frei, 1 = dicht.
     * Bewertet wird der Abstand der Gegenspieler zur Verbindungslinie.
     */
    getLaneRisk(from, to, opponents) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1) return 0;

        let risk = 0;
        opponents.forEach(o => {
            // Projektion des Gegners auf die Passlinie
            let t = ((o.x - from.x) * dx + (o.y - from.y) * dy) / lenSq;
            if (t < 0.05 || t > 0.95) return;

            const px = from.x + dx * t;
            const py = from.y + dy * t;
            const dist = Math.hypot(o.x - px, o.y - py);

            if (dist < 9) {
                // Gegner nahe am Ziel stören mehr als solche direkt beim Passgeber
                risk += (1 - dist / 9) * (0.5 + t * 0.5);
            }
        });
        return Math.min(1.4, risk);
    }

    /**
     * Freiraum um einen Spieler (0 = eingekesselt, 1 = viel Platz)
     */
    getSpace(player, opponents) {
        let nearest = 40;
        opponents.forEach(o => {
            const d = this.distance(player, o);
            if (d < nearest) nearest = d;
        });
        return Math.min(1, nearest / 18);
    }

    attr(player, name, fallback = 70) {
        const v = player?.[name];
        return (typeof v === "number" && v > 0) ? v : fallback;
    }

    /**
     * Aktuelle Spielphase aus der Ballposition ableiten
     */
    derivePhase(ball, team) {
        const dir = this.attackDir(team);
        // Fortschritt in Angriffsrichtung: 0 = eigenes Tor, 1 = gegnerisches Tor
        const progress = dir > 0 ? ball.x / 100 : 1 - ball.x / 100;

        if (progress < 0.28) return FLOW_PHASES.BUILDUP;
        if (progress < 0.62) return FLOW_PHASES.PROGRESSION;
        return FLOW_PHASES.FINAL_THIRD;
    }

    // ------------------------------------------------------- Entscheidungslogik

    /**
     * Bewertet alle Anspielstationen des Ballführenden.
     */
    ratePassOptions(carrier, mates, opponents, tactics, context = {}) {
        const dir = this.attackDir(carrier.team);
        const focus = tactics.focus || tactics.attackFocus || "balanced";
        const passing = tactics.passing || "mixed";
        const mentality = tactics.mentality || "balanced";

        // Wie viel Risiko darf ein Pass haben?
        let forwardDrive = 1.0;
        if (mentality === "very_offensive") forwardDrive = 1.45;
        else if (mentality === "offensive") forwardDrive = 1.2;
        else if (mentality === "defensive") forwardDrive = 0.8;
        else if (mentality === "very_defensive") forwardDrive = 0.6;

        // Je länger eine Mannschaft den Ball hält, desto entschlossener rückt
        // sie auf - so entstehen echte Angriffszüge statt Dauerquerpässe.
        const chain = Math.min(8, context.chainLength || 0);
        forwardDrive *= 1 + chain * 0.07;

        // Bevorzugte Passlänge
        const preferred = passing === "short" ? 14 : (passing === "direct" ? 34 : 22);

        return mates.map(mate => {
            const dist = this.distance(carrier, mate);
            if (dist < 3.5) return null;

            const laneRisk = this.getLaneRisk(carrier, mate, opponents);
            const space = this.getSpace(mate, opponents);
            const forward = (mate.x - carrier.x) * dir;

            // Passlänge: nahe an der bevorzugten Distanz ist am besten
            const lengthScore = 1 - Math.min(1, Math.abs(dist - preferred) / 42);

            // Raumgewinn zählt, Rückpässe sind nur die Notlösung
            const progressScore = forward > 0
                ? Math.min(1, forward / 30) * forwardDrive
                : Math.max(-0.45, forward / 45);

            // Flügelfokus
            let focusScore = 0;
            if (focus === "left" && mate.y < 35) focusScore = 0.28;
            else if (focus === "right" && mate.y > 65) focusScore = 0.28;
            else if (focus === "center" && mate.y > 32 && mate.y < 68) focusScore = 0.24;

            // Stürmer im letzten Drittel sind attraktive Ziele
            const roleScore = (mate.group === "att" && context.phase === FLOW_PHASES.FINAL_THIRD) ? 0.25 : 0;

            const score = lengthScore * 0.8
                + progressScore * 1.25
                + space * 0.85
                + focusScore
                + roleScore
                - laneRisk * 1.35
                + _flowRandom.float(-0.18, 0.18);

            return { type: "pass", target: mate, dist, laneRisk, space, forward, score };
        }).filter(Boolean);
    }

    /**
     * Bewertet ein Dribbling des Ballführenden
     */
    rateDribble(carrier, opponents, tactics, pressure) {
        const dir = this.attackDir(carrier.team);
        const dribbling = this.attr(carrier, "dribbling");
        const pace = this.attr(carrier, "pace");

        // Wie viel Platz liegt vor ihm?
        const ahead = { x: carrier.x + dir * 12, y: carrier.y };
        const space = this.getSpace(ahead, opponents);

        const skill = (dribbling * 0.6 + pace * 0.4) / 100;
        const tempoBonus = tactics.tempo === "fast" ? 0.15 : (tactics.tempo === "slow" ? -0.1 : 0);

        const score = skill * 1.15
            + space * 0.9
            + tempoBonus
            - pressure * 0.75
            + _flowRandom.float(-0.2, 0.2);

        return { type: "dribble", target: ahead, space, score };
    }

    /**
     * Notlösung: langer Ball nach vorne
     */
    rateClearance(carrier, mates, tactics, pressure) {
        const dir = this.attackDir(carrier.team);
        const directBonus = tactics.passing === "direct" ? 0.3 : 0;

        // Ziel ist der vorderste eigene Spieler
        const forwardMost = mates.slice().sort((a, b) => (b.x - a.x) * dir)[0];
        const target = forwardMost || { x: carrier.x + dir * 30, y: 50 };

        const score = pressure * 0.9
            + directBonus
            + (carrier.group === "def" ? 0.25 : -0.1)
            - 0.35
            + _flowRandom.float(-0.15, 0.15);

        return { type: "clearance", target, score };
    }

    /**
     * Trifft die Entscheidung für die nächste Aktion des Ballführenden
     */
    decide(carrier, options = {}) {
        if (!carrier) return null;

        const team = carrier.team;
        const tactics = this.getTactics(team) || {};
        const mates = this.teamOf(team).filter(p => p.id !== carrier.id && p.pos !== "TW");
        const opponents = this.opponentsOf(team);

        const pressure = this.getPressure(carrier, opponents);
        const phase = options.phase || this.derivePhase(carrier, team);

        const candidates = this.ratePassOptions(carrier, mates, opponents, tactics, {
            phase,
            chainLength: options.chainLength || 0
        });
        candidates.push(this.rateDribble(carrier, opponents, tactics, pressure));
        candidates.push(this.rateClearance(carrier, mates, tactics, pressure));

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];

        return this.resolve(carrier, best, opponents, tactics, pressure, phase);
    }

    /**
     * Führt die gewählte Aktion aus und würfelt ihren Ausgang
     */
    resolve(carrier, action, opponents, tactics, pressure, phase) {
        if (action.type === "dribble") {
            return this.resolveDribble(carrier, action, opponents, tactics, pressure, phase);
        }
        return this.resolvePass(carrier, action, opponents, tactics, pressure, phase);
    }

    resolvePass(carrier, action, opponents, tactics, pressure, phase) {
        const isLong = action.type === "clearance" || action.dist > 32;
        const passing = this.attr(carrier, "passing");
        const vision = this.attr(carrier, "vision");
        const technique = this.attr(carrier, "technique");

        // Genauigkeit aus Attributen, gemindert durch Druck, Distanz und Passweg
        const skill = (passing * 0.5 + vision * 0.3 + technique * 0.2) / 100;
        let accuracy = 0.52 + skill * 0.46;
        accuracy -= pressure * 0.16;
        accuracy -= (action.laneRisk || 0) * 0.22;
        if (isLong) accuracy -= 0.14;
        if (tactics.tempo === "fast") accuracy -= 0.04;
        if (tactics.passing === "short") accuracy += 0.05;

        accuracy = Math.max(0.28, Math.min(0.97, accuracy));

        const success = _flowRandom.chance(accuracy);

        if (success) {
            return {
                type: isLong ? "longball" : "pass",
                outcome: "complete",
                from: carrier,
                to: action.target,
                pressure,
                phase
            };
        }

        // Fehlpass: abgefangen, frei liegend oder ins Aus
        const roll = Math.random();
        const interceptor = this.findInterceptor(carrier, action.target, opponents);

        if (interceptor && roll < 0.55) {
            return {
                type: isLong ? "longball" : "pass",
                outcome: "intercepted",
                from: carrier,
                to: action.target,
                interceptor,
                pressure,
                phase
            };
        }

        // Rund ein Fünftel der Fehlpässe landet im Aus - das erzeugt die
        // Einwürfe, Abstöße und Ecken, die ein Spiel erst gliedern.
        if (roll > 0.72) {
            return {
                type: isLong ? "longball" : "pass",
                outcome: "out",
                from: carrier,
                to: this.outOfPlayTarget(carrier, action.target),
                pressure,
                phase
            };
        }

        return {
            type: isLong ? "longball" : "pass",
            outcome: "loose",
            from: carrier,
            to: this.scatterTarget(action.target),
            pressure,
            phase
        };
    }

    resolveDribble(carrier, action, opponents, tactics, pressure, phase) {
        const defender = opponents
            .filter(o => o.pos !== "TW")
            .sort((a, b) => this.distance(carrier, a) - this.distance(carrier, b))[0];

        const dribbling = this.attr(carrier, "dribbling");
        const pace = this.attr(carrier, "pace");
        const defSkill = defender ? (this.attr(defender, "defense") * 0.6 + this.attr(defender, "pace") * 0.4) : 60;

        const edge = (dribbling * 0.6 + pace * 0.4) - defSkill;
        let chance = 0.55 + edge / 210 - pressure * 0.13;
        chance = Math.max(0.2, Math.min(0.92, chance));

        if (_flowRandom.chance(chance)) {
            return { type: "dribble", outcome: "beaten", from: carrier, to: action.target, defender, pressure, phase };
        }

        return { type: "dribble", outcome: "tackled", from: carrier, to: action.target, defender, pressure, phase };
    }

    /**
     * Wer kann einen Fehlpass abfangen? Der Gegner am dichtesten an der Passlinie.
     */
    findInterceptor(from, to, opponents) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1) return opponents[0] || null;

        let best = null;
        let bestDist = Infinity;

        opponents.forEach(o => {
            let t = ((o.x - from.x) * dx + (o.y - from.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const px = from.x + dx * t;
            const py = from.y + dy * t;
            const d = Math.hypot(o.x - px, o.y - py);
            if (d < bestDist) {
                bestDist = d;
                best = o;
            }
        });

        return bestDist < 14 ? best : null;
    }

    /**
     * Streut ein Ziel, damit ein verunglückter Ball nicht exakt ankommt
     */
    scatterTarget(target) {
        return {
            x: target.x + _flowRandom.float(-14, 14),
            y: target.y + _flowRandom.float(-16, 16)
        };
    }

    /**
     * Zielpunkt für einen Ball, der das Spielfeld verlässt.
     * Es wird die nächstgelegene Linie gewählt, damit die daraus folgende
     * Standardsituation zur Spielsituation passt.
     */
    outOfPlayTarget(carrier, target) {
        const x = target.x ?? carrier.x;
        const y = target.y ?? carrier.y;

        const distToSide = Math.min(y, 100 - y);
        const distToGoalLine = Math.min(x, 100 - x);

        // Nahe der Grundlinie wird es ein Toraus, sonst ein Seitenaus
        if (distToGoalLine < distToSide * 0.8) {
            return { x: x < 50 ? -1 : 101, y: Math.max(4, Math.min(96, y + _flowRandom.float(-10, 10))) };
        }
        return { x: Math.max(4, Math.min(96, x + _flowRandom.float(-8, 8))), y: y < 50 ? -1 : 101 };
    }

    /**
     * Zeit bis zur nächsten Aktion (in echten Sekunden), abhängig vom Tempo
     */
    getActionInterval(team, actionType) {
        const tactics = this.getTactics(team) || {};
        // Kürzere Abstände lassen das Spiel durchgehend lebendig wirken
        let base = 0.72;
        if (tactics.tempo === "fast") base = 0.55;
        else if (tactics.tempo === "slow") base = 0.95;
        if (tactics.passing === "short") base *= 0.88;
        if (tactics.passing === "direct") base *= 1.1;

        if (actionType === "dribble") base *= 1.15;
        if (actionType === "longball") base *= 1.2;

        return base * _flowRandom.float(0.8, 1.25);
    }
}

if (typeof window !== "undefined") {
    window.MatchFlowEngine = MatchFlowEngine;
    window.FLOW_PHASES = FLOW_PHASES;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MatchFlowEngine, FLOW_PHASES };
}
