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

/** Die Taktik (Anweisungen und Rollen) - im Browser global, unter Node nachgeladen */
const _flowTaktik = () => {
    if (typeof TacticsEngine !== 'undefined' && TacticsEngine) return TacticsEngine;
    if (typeof window !== 'undefined' && window.TacticsEngine) return window.TacticsEngine;
    if (typeof require !== 'undefined') {
        try { return require('./tacticsEngine.js').TacticsEngine; } catch (e) { /* ohne Taktikmodul */ }
    }
    return null;
};

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
        // FM-Modus: Der Ballfuehrende entscheidet auch ueber Schuss und
        // Flanke, Zweikaempfe koennen Fouls sein. Ohne ihn liefert die Engine
        // nur das Spiel zwischen den Ereignissen der Zeitleiste.
        this.fm = typeof options.fm === "function" ? options.fm : (() => !!options.fm);
        // Zusatzlage fuer grosse Momente (Rueckstand, Schlussphase, Derby)
        this.lage = typeof options.lage === "function" ? options.lage : (() => ({}));
        // Der Schiedsrichter: Wie kleinlich er pfeift (pfeife), wie schnell
        // er Karten zeigt (strenge), wie gern er Vorteil gibt (vorteil)
        this.schiri = typeof options.schiri === "function" ? options.schiri : (() => null);
        // Wetter und Platz (WetterEngine.mitWirkung)
        this.wetter = typeof options.wetter === "function" ? options.wetter : (() => null);

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
        let wert = (typeof v === "number" && v > 0) ? v : fallback;
        // Ein Mentalitaetsmonster waechst in grossen Momenten ueber sich hinaus,
        // und wer in grossen Spielen nervenstark ist, auch ein wenig - wer
        // es nicht ist, verkrampft
        if (player?.team && (player.eig?.grossesSpiel || player.mental) && this.lage(player.team)?.grosserMoment) {
            wert += (player.eig?.grossesSpiel || 0) + ((player.mental?.grosseSpiele ?? 12) - 12) * 0.5;
        }
        // Wer muede ist, macht mehr Fehler - nicht nur beim Laufen
        if (this.fm() && typeof player?.freshness === "number" && player.freshness < 1 && name !== "pace" && name !== "stamina") {
            wert *= 0.88 + 0.12 * Math.max(0, (player.freshness - 0.6) / 0.4);
        }
        return wert;
    }

    /** Wirkungen der Eigenschaften eines Spielers auf dem Feld (EigenschaftenEngine) */
    eig(player) {
        return (player && player.eig) || {};
    }

    /**
     * Mentale Werte im FM-Modus.
     *
     * Entscheidungen: Wer das Spiel liest (Übersicht, Stellungsspiel,
     * Erfahrung), wählt öfter die beste Option. Alle Bewertungen tragen etwas
     * Zufall - bei ihm weniger, bei einem unerfahrenen Spieler mit wenig
     * Übersicht mehr. Liefert den Faktor auf diesen Zufall.
     */
    entscheidungsRauschen(player) {
        if (!this.fm() || !player) return 1;
        const alter = player.mental?.alter ?? 26;
        const erfahrung = Math.max(35, Math.min(95, 35 + (alter - 17) * 6));
        const lesen = this.attr(player, "vision") * 0.55 + this.attr(player, "positioning", 60) * 0.25 + erfahrung * 0.2;
        return Math.max(0.75, Math.min(1.3, 1.45 - lesen / 100 * 0.65));
    }

    /** Nervenstärke (1-20): große Spiele, Beständigkeit und Erfahrung */
    nerven(player) {
        const m = player?.mental;
        if (!m) return 12;
        const erfahrung = Math.max(8, Math.min(18, 8 + (m.alter - 18) * 0.7));
        return m.grosseSpiele * 0.5 + m.bestaendigkeit * 0.3 + erfahrung * 0.2;
    }

    /** Konzentration (1-20): Professionalität und Beständigkeit */
    konzentration(player) {
        const m = player?.mental;
        return m ? (m.professionalitaet + m.bestaendigkeit) / 2 : 12;
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
        let riskAversion = 1.0;
        if (mentality === "very_offensive") { forwardDrive = 2.3; riskAversion = 0.66; }
        else if (mentality === "offensive") { forwardDrive = 1.45; riskAversion = 0.84; }
        else if (mentality === "defensive") { forwardDrive = 0.58; riskAversion = 1.25; }
        else if (mentality === "very_defensive") { forwardDrive = 0.24; riskAversion = 1.6; }

        // Je länger eine Mannschaft den Ball hält, desto entschlossener rückt
        // sie auf - so entstehen echte Angriffszüge statt Dauerquerpässe.
        const chain = Math.min(8, context.chainLength || 0);
        forwardDrive *= 1 + chain * 0.07;
        // Der Konter kennt keine defensive Grundhaltung: Direkt nach dem
        // Ballgewinn geht es nach vorn, solange der Gegner ungeordnet ist.
        // Vorher bremste die defensive Mentalitaet auch diesen Moment - ein
        // Konterteam spielte den eroberten Ball quer und zurueck und kam
        // gemessen auf neun Schuesse gegen zweiundzwanzig.
        const kontertGerade = chain <= 4 && (_flowTaktik()?.wirkung(tactics).konter || 0) > 0;
        if (kontertGerade) forwardDrive = Math.max(forwardDrive, 1.3);

        // Die Absicht hängt daran, wo der Ball ist. Im eigenen Drittel wird
        // gesichert zirkuliert - auch quer, auch zurück -, im Mittelfeld
        // gesucht, im letzten Drittel der Abschluss vorbereitet. Ohne diese
        // Staffelung sah jeder Ballbesitz gleich aus: ein Hin und Her ohne
        // erkennbare Richtung.
        const istAufbau = context.phase === FLOW_PHASES.BUILDUP;
        const istAbschluss = context.phase === FLOW_PHASES.FINAL_THIRD;

        const progressWeight = istAufbau ? 0.72 : (istAbschluss ? 1.45 : 1.25);
        const riskWeight = istAufbau ? 2.1 : (istAbschluss ? 1.15 : 1.4);
        const spaceWeight = istAufbau ? 1.2 : 0.85;

        // Bevorzugte Passlänge
        const preferred = passing === "short" ? 13 : (passing === "direct" ? 32 : 19);

        // Die Anweisungen der Taktik und die Rolle des Ballfuehrenden
        const wk = _flowTaktik()?.wirkung(tactics) || {};
        const eigeneRolle = carrier.rolleMit || {};
        const druck = context.pressure || 0;
        // Nach dem Ballgewinn: Wer kontert, sucht sofort den Weg nach vorn,
        // wer den Ball sichert, spielt erst einmal sicher
        let progressFaktor = 1 + (eigeneRolle.passWeit || 0);
        let risikoFaktor = 1;
        if (chain <= 2 && wk.konter > 0) progressFaktor *= 1.35;
        // Tempo: Schnell spielt vertikal, langsam geduldig
        if (tactics.tempo === "fast") progressFaktor *= 1.15;
        else if (tactics.tempo === "slow") progressFaktor *= 0.92;
        if (chain <= 3 && wk.konter < 0) { progressFaktor *= 0.8; risikoFaktor = 1.3; }
        // Ballannahme: In den Lauf bringt Tiefe und nimmt mehr Risiko in Kauf,
        // in den Fuss spielt sicher
        if ((wk.ballannahme || 0) > 0) { progressFaktor *= 1.1; risikoFaktor *= 0.9; }
        else if ((wk.ballannahme || 0) < 0) { progressFaktor *= 0.93; risikoFaktor *= 1.1; }
        const istTorwart = carrier.pos === "TW";
        const freiheit = wk.freiheit || 1;

        // Befreiung: Wer tief steht, schiebt den Ball in der eigenen Haelfte
        // nicht ewig hin und her, sondern sucht nach ein, zwei Paessen den
        // langen Ball nach vorn. Vorher hielt ein tiefer Block den Ball
        // siebzig Paesse je Spiel in der eigenen Haelfte und kam gegen Bayern
        // auf 58 Prozent Ballbesitz.
        const fortschritt = dir > 0 ? carrier.x / 100 : 1 - carrier.x / 100;
        const befreien = tactics.defensiveLine === "deep" && !istTorwart && fortschritt < 0.45 && chain >= 2;
        // Konter: Der Spieler, der vorn gewartet hat, ist das erste Ziel
        const konterZiel = chain <= 3 && (wk.konter || 0) > 0;

        // Wohin das Spiel gerade strebt: der Spieler, bei dem die naechste
        // Szene beginnt. Er wird gesucht wie ein freistehender Stuermer -
        // nicht erzwungen, aber deutlich bevorzugt.
        const ziel = context.zielSpieler || null;
        const fm = this.fm();
        const rauschen = this.entscheidungsRauschen(carrier);
        const zielAbstand = ziel ? Math.hypot(carrier.x - ziel.x, carrier.y - ziel.y) : 0;

        return mates.map(mate => {
            const dist = this.distance(carrier, mate);
            if (dist < 3.5) return null;

            const laneRisk = this.getLaneRisk(carrier, mate, opponents);
            const space = this.getSpace(mate, opponents);
            const forward = (mate.x - carrier.x) * dir;

            // Passlänge: nahe an der bevorzugten Distanz ist am besten. Die
            // Toleranz war mit 26 so weit, dass ein Ball über das halbe Feld
            // genauso bewertet wurde wie einer über fünfundzwanzig Meter.
            const lengthScore = 1 - Math.min(1, Math.abs(dist - preferred) / 17);

            // Der lange Ball ist die Ausnahme, und der Abschlag muss gegen den
            // Raumgewinn ankommen können. Vorher war er auf 0.75 gedeckelt,
            // während ein weiter Ball nach vorne über den Raumgewinn auf fast
            // vier Punkte kam - jeder fünfte Ball segelte deshalb über
            // sechsunddreißig Meter, in echten Spielen ist es jeder achte.
            const longMalus = dist > 24
                ? Math.min(2.4, ((dist - 24) / 15) ** 1.4) * (passing === "direct" ? 0.62 : 1.0)
                : 0;

            // Raumgewinn zählt, Rückpässe sind nur die Notlösung. Ein Ball ist
            // aber nicht deshalb gut, weil er weit ist: Wer den Gegner um
            // fünfzehn Meter überspielt, hat das Wesentliche erreicht - alles
            // darüber ist Zufall, kein Spielaufbau. Deshalb ist die Belohnung
            // hier gedeckelt, statt mit der Offensivfreude immer weiter zu
            // wachsen.
            const nutzbarerRaumgewinn = 15;
            const progressScore = forward > 0
                // Die Kappe lag bei 1.35 und schnitt damit genau das ab, was
                // "sehr offensiv" ausmacht: Der Regler stand auf 1.7, wirkte
                // aber wie 1.35. Gemessen trennte die Mentalitaet das
                // Vorwaertsspiel nur um neun Prozentpunkte statt der
                // erwarteten zwoelf.
                ? Math.min(1, forward / nutzbarerRaumgewinn) * Math.min(2.4, forwardDrive)
                : Math.max(-0.5, forward / 45) * forwardDrive;

            // Die Mentalitaet als eigene Stimme, nicht nur als Faktor auf den
            // Raumgewinn.
            //
            // Als blosser Multiplikator verschwand sie, sobald etwas anderes
            // den Ausschlag gab - Passlaenge, freier Raum, der Weg zur
            // naechsten Szene. Und sie verschwand asymmetrisch: Ein kleiner
            // Faktor macht den Raumgewinn nur *unwichtig*, er macht den
            // Rueckpass nicht attraktiv. Eine sehr defensive Mannschaft spielte
            // deshalb fast genauso viel nach vorne wie eine sehr offensive -
            // gemessen 56 gegen 46 Prozent.
            //
            // Hier steht die Absicht selbst: Wer offensiv spielt, sucht den
            // Ball nach vorne und meidet den Rueckpass; wer defensiv spielt,
            // genau umgekehrt. Bei ausgeglichener Einstellung ist der Term
            // null - die Voreinstellung bleibt unberuehrt.
            //
            // Mit 0.55 lag der Abstand ueber drei Messungen bei 19 bis 40
            // Prozentpunkten - im unguenstigsten Fall knapp ueber der Grenze.
            // 0.75 gibt der Einstellung genug Gewicht, dass sie auch in einer
            // Partie wirkt, in der die eigene Mannschaft kaum ueber die
            // Mittellinie kommt.
            const richtung = Math.sign(forward) * Math.min(1, Math.abs(forward) / 12);
            let mentalScore = richtung * (forwardDrive - 1) * 0.75;
            // Defensiv heisst wenig Risiko - nicht, den Ball vor dem eigenen
            // Tor hin und her zu schieben. Im Aufbau lockt der Rueckpass nicht,
            // der Ball geht lieber lang aus der Gefahrenzone.
            if (istAufbau && forward < 0 && mentalScore > 0) mentalScore *= 0.25;

            // Flügelfokus: "links" ist die linke Seite aus Sicht der
            // Angriffsrichtung, nicht die linke Bildschirmhälfte. Wer nach
            // links angreift (Gastmannschaft in Halbzeit eins, Heim nach dem
            // Seitenwechsel), hat seinen linken Flügel bei hohen y-Werten -
            // deshalb wird die Koordinate dann gespiegelt.
            const focusY = dir > 0 ? mate.y : 100 - mate.y;
            let focusScore = 0;
            if (focus === "left" && focusY < 35) focusScore = 0.42;
            else if (focus === "right" && focusY > 65) focusScore = 0.42;
            else if (focus === "center" && focusY > 32 && focusY < 68) focusScore = 0.34;

            // Stürmer im letzten Drittel sind attraktive Ziele
            const roleScore = (mate.group === "att" && istAbschluss) ? 0.25 : 0;

            // Der Torwart ist im Aufbau die Notlösung, nie das Ziel einer
            // Kombination - er wird nur angespielt, wenn es vorne zu ist.
            const keeperScore = mate.pos === "TW" ? -0.55 + (context.pressure || 0) * 0.5 : 0;

            // Der Weg zur naechsten Szene: Der Zielspieler selbst ist das
            // beste Zuspiel, ein Ball, der ihm naeher kommt, das zweitbeste.
            let anlaufScore = 0;
            if (ziel) {
                if (mate.id === ziel.id) {
                    // Schwaecher als die Taktik, nicht staerker: Mit 1.3 schlug
                    // die Steuerung auf den naechsten Protagonisten jede
                    // Mentalitaet - offensiv und defensiv spielten dieselben
                    // Paesse, weil beide vor allem denselben Mann suchten.
                    anlaufScore = 0.75;
                } else {
                    const danach = Math.hypot(mate.x - ziel.x, mate.y - ziel.y);
                    anlaufScore = Math.max(-0.2, Math.min(0.38, (zielAbstand - danach) / 26));
                }
            }

            // Taktik: Aufbau ueber innen oder aussen, Rollen als bevorzugte
            // Anspielstation, Breite, der lange Ball gegen Pressing, Flanken
            let taktikScore = 0;
            const mateRolle = mate.rolleMit || {};
            const fam = mate.fam || "";
            if (istAufbau && wk.aufbauUeber === "innen" && (fam === "IV" || fam === "DM")) taktikScore += 0.3;
            if (istAufbau && wk.aufbauUeber === "aussen" && (fam === "AV" || fam === "SCH" || fam === "FL")) taktikScore += 0.3;
            taktikScore += (mateRolle.passZiel || 0) * 0.8;
            if (dist > 26 && mateRolle.lang) taktikScore += mateRolle.lang;
            const quer = Math.abs(mate.y - 50);
            if ((wk.breite || 0) > 0 && quer > 30) taktikScore += 0.2;
            if ((wk.breite || 0) < 0 && quer < 18) taktikScore += 0.2;
            if (druck > 0.55 && dist > 26) taktikScore += (wk.durchsPressing || 0) * 1.2;
            if (befreien) {
                if (dist > 24 && forward > 12) taktikScore += 0.55;
                else if (forward < 4) taktikScore -= 0.35;
            }
            if (konterZiel && mate.rolleGegen?.konter && forward > 8) taktikScore += 0.6;
            if (istAufbau && forwardDrive < 1 && dist > 26 && forward > 10) taktikScore += (1 - forwardDrive) * 0.6;
            if (istTorwart) {
                // Kurz: Innenverteidiger suchen; lang: auf die Spitze
                if (dist > 30) taktikScore -= (wk.torwartKurz || 0) * 1.2;
                else taktikScore += (wk.torwartKurz || 0) * 0.5;
                // Die bevorzugte Anspielstation des Torwarts
                const bevorzugt = {
                    iv: ["IV"], av: ["AV", "SCH"], sechser: ["DM", "ZM"], fluegel: ["FL", "SCH"], spitze: ["ST"]
                }[wk.torwartZiel];
                if (bevorzugt && bevorzugt.includes(fam)) taktikScore += 0.45;
            }
            if (istAbschluss && Math.abs(carrier.y - 50) > 25) {
                const imStrafraum = Math.abs(mate.y - 50) < 20 && (mate.x - carrier.x) * dir > -4
                    && Math.abs(mate.x - (dir > 0 ? 96 : 4)) < 18;
                if (imStrafraum) {
                    if (wk.flanken === "frueh") taktikScore += 0.35;
                    else if (wk.flanken === "wenig") taktikScore -= 0.35;
                    else if (wk.flanken === "grundlinie") taktikScore += Math.abs(carrier.x - (dir > 0 ? 96 : 4)) < 12 ? 0.3 : -0.2;
                }
            }

            // FM-Modus: Die Eigenschaften von Passgeber und Empfaenger. Wer den
            // Pass in die Tiefe sieht, spielt ihn; wer pfeilschnell ist, wird
            // gesucht; wer gern verlagert, schlaegt den Diagonalball.
            let eigScore = 0;
            if (fm) {
                const eg = this.eig(carrier);
                const em = this.eig(mate);
                if (forward > 10) eigScore += (eg.tiefenpass || 0) * 0.45 + (em.tiefenlaeufer || 0) * 0.35;
                if (Math.abs(mate.y - carrier.y) > 35 && dist > 28) eigScore += (eg.verlagerung || 0) * 0.9;
                if (istAbschluss) eigScore += (em.strafraum || 0) * 0.3;
            }

            const score = lengthScore * 0.8
                + eigScore
                + anlaufScore
                + mentalScore
                + progressScore * progressWeight * progressFaktor
                + space * spaceWeight
                + focusScore
                + roleScore
                + keeperScore
                + taktikScore
                - longMalus
                - laneRisk * riskWeight * riskAversion * risikoFaktor
                + _flowRandom.float(-0.18, 0.18) * freiheit * rauschen;

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
        const tempoBonus = tactics.tempo === "fast" ? 0.06 : (tactics.tempo === "slow" ? -0.1 : 0);
        // Die Mentalitaet gilt auch fuer den Lauf mit dem Ball: Eine defensive
        // Mannschaft geht nicht ins riskante Dribbling - in den freien Raum
        // traegt sie den Ball trotzdem. Vorher bremste "defensiv" nur den Pass
        // nach vorn, und das Dribbling wurde zur besten Option: Ein Konterteam
        // dribbelte sechzigmal je Spiel und verlor den Ball im Mittelfeld.
        const mentalDribbel = { very_offensive: 0.12, offensive: 0.06, defensive: -0.25, very_defensive: -0.4 }[tactics.mentality] || 0;

        // Der Lauf mit dem Ball war als Vorschlag chancenlos: Gemessen ueber
        // drei Partien entfielen von 744 Aktionen nur 21 auf ein Dribbling -
        // also 2,8 Prozent. In echten Spielen versucht eine Mannschaft
        // zwanzig bis dreissig Mal, ihren Gegenspieler zu ueberlaufen. Weil
        // Zuspiele bis zu drei Punkte erreichen, ein Dribbling aber kaum ueber
        // eineinhalb kam, gewann es fast nie - und auf dem Feld sah man
        // entsprechend keine Laeufe mit dem Ball.
        // Liegt vor ihm freier Raum und ist kein Gegner in der Naehe, traegt
        // er den Ball einfach nach vorn - auch ein Innenverteidiger. Vorher
        // war jeder Lauf mit dem Ball ein Zweikampf, und wer nicht dribbeln
        // konnte, spielte den Ball ab, selbst wenn vor ihm dreissig Meter frei
        // waren. Nur der Torwart bleibt in seinem Strafraum und spielt ab.
        const naechster = opponents.filter(o => o.pos !== "TW")
            .reduce((m, o) => Math.min(m, this.distance(carrier, o)), Infinity);
        const frei = carrier.pos !== "TW" && pressure < 0.35 && space > 0.45 && naechster > 8;

        // Die Anweisung (mehr oder weniger Dribblings), die Rolle (ein
        // Spielmachender Innenverteidiger traegt den Ball, ein
        // kompromissloser nie) und bis zur Grundlinie gehen
        const wk = _flowTaktik()?.wirkung(tactics) || {};
        let taktik = (wk.dribbling || 0) + (carrier.rolleMit?.dribbeln || 0) * 0.5;
        if (wk.flanken === "grundlinie" && Math.abs(carrier.y - 50) > 25) {
            const progress = dir > 0 ? carrier.x / 100 : 1 - carrier.x / 100;
            if (progress > 0.66) taktik += 0.25;
        }

        // FM-Modus: Wer gern dribbelt, tut es; wer nach innen zieht, zieht
        // vom Fluegel diagonal Richtung Tor - dorthin, wo er schiessen kann
        let eigen = 0;
        if (this.fm()) {
            const e = this.eig(carrier);
            eigen += e.dribbelWille || 0;
            const progress = dir > 0 ? carrier.x / 100 : 1 - carrier.x / 100;
            if (e.nachInnen && progress > 0.58 && Math.abs(carrier.y - 50) > 16) {
                ahead.y = carrier.y + (carrier.y < 50 ? 9 : -9);
                ahead.x = carrier.x + dir * 8;
                eigen += 0.35;
            }
        }

        const score = skill * 1.15
            + space * 0.9
            + tempoBonus
            + 0.3
            - pressure * 0.75
            + (frei ? (carrier.group === "def" ? 0.8 : 0.55) : mentalDribbel)
            + taktik
            + eigen
            + _flowRandom.float(-0.2, 0.2) * this.entscheidungsRauschen(carrier);

        return { type: "dribble", target: ahead, space, score, frei };
    }

    /**
     * Notlösung: langer Ball nach vorne
     */
    rateClearance(carrier, mates, tactics, pressure) {
        const dir = this.attackDir(carrier.team);
        const directBonus = tactics.passing === "direct" ? 0.3 : 0;

        // Ziel ist der vorderste eigene Spieler - aber in Reichweite. Ein
        // Befreiungsschlag geht in der Wirklichkeit fünfzig, sechzig Meter
        // weit, nicht über das ganze Feld: Vorher landete er beim vordersten
        // Mitspieler, auch wenn der fünfundachtzig Meter entfernt stand.
        const REICHWEITE = 42;
        const inReichweite = mates.filter(m => this.distance(carrier, m) <= REICHWEITE);
        const forwardMost = (inReichweite.length ? inReichweite : mates)
            .slice().sort((a, b) => (b.x - a.x) * dir)[0];

        const target = forwardMost && this.distance(carrier, forwardMost) <= REICHWEITE
            ? forwardMost
            : { x: carrier.x + dir * REICHWEITE * 0.8, y: _flowRandom.float(20, 80) };

        // Der Befreiungsschlag ist eine Notlösung und keine Spielidee: ohne
        // Druck steht er gar nicht zur Debatte.
        const score = pressure * 1.15
            + directBonus
            + (carrier.group === "def" ? 0.3 : -0.15)
            - 0.85
            + _flowRandom.float(-0.15, 0.15);

        return { type: "clearance", target, score };
    }

    // ------------------------------------------------------------- FM-Modus
    //
    // Im Football Manager ist das Spiel die Simulation: Jeder Ballfuehrende
    // entscheidet in jedem Moment, ob er abspielt, dribbelt, flankt oder
    // schiesst - nach seinen Werten, seiner Lage und seinen Eigenschaften.
    // Tore entstehen aus der Qualitaet der Chance und aus dem Duell zwischen
    // Schuetze und Torwart. Nichts davon steht vorher fest.

    /** Mitte der Torlinie, auf die eine Mannschaft spielt */
    gegnerTor(team) {
        return { x: this.ownGoalX(team === "home" ? "away" : "home"), y: 50 };
    }

    /** Liegt ein Punkt im Strafraum, auf den diese Mannschaft spielt? */
    imGegnerStrafraum(punkt, team) {
        if (!punkt || typeof punkt.x !== "number") return false;
        const tor = this.gegnerTor(team);
        return Math.abs(tor.x - punkt.x) < 16 && Math.abs(punkt.y - 50) < 30;
    }

    /**
     * Wie dicht der gegnerische Strafraum steht: Feldspieler darin über
     * vier hinaus. Ein tiefer Block schützt so seinen Strafraum - Pässe
     * hinein werden abgefangen, Dribblings bleiben hängen, Abschlüsse darin
     * werden verstellt. Vorher zählte nur der nächste Gegner, und gegen
     * einen tiefen Block fielen gemessen drei von vier Schüssen im Strafraum.
     */
    strafraumDichte(team) {
        if (!this.fm()) return 0;
        const tor = this.gegnerTor(team);
        const drin = this.opponentsOf(team).filter(o => o.pos !== "TW"
            && Math.abs(tor.x - o.x) < 16 && Math.abs(o.y - 50) < 30).length;
        return Math.max(0, drin - 4);
    }

    /**
     * Abstand und Sichtwinkel zum Tor in Metern. Das Feld misst 105 x 68
     * Meter, eine Einheit laengs ist also gut ein Meter, quer zwei Drittel.
     */
    torGeometrie(punkt, team) {
        const tor = this.gegnerTor(team);
        const dx = Math.max(0.5, Math.abs(tor.x - punkt.x) * 1.05);
        const dy = (punkt.y - 50) * 0.68;
        const dist = Math.hypot(dx, dy);
        // Sichtwinkel auf das 7,32 Meter breite Tor
        const winkel = Math.abs(Math.atan2(dy + 3.66, dx) - Math.atan2(dy - 3.66, dx));
        return { dist, winkel };
    }

    /**
     * Wie gut eine Chance ist (xG): aus Abstand, Winkel, Gegnerdruck und
     * verstelltem Schussweg - noch ohne den Schuetzen. Ein Schuss aus sechs
     * Metern zentral liegt bei rund 0.45, aus zwanzig Metern bei 0.07.
     */
    chancenQualitaet(schuetze, opponents, opts = {}) {
        const g = this.torGeometrie(schuetze, schuetze.team);
        let xg = 1 / (1 + Math.exp(-(-0.45 + 1.7 * g.winkel - 0.12 * g.dist)));
        if (opts.kopfball) xg *= 0.6;
        const feldspieler = opponents.filter(o => o.pos !== "TW");
        const druck = Math.min(1.2, this.getPressure(schuetze, feldspieler));
        xg *= 1 - 0.2 * Math.min(1, druck);
        const block = this.getLaneRisk(schuetze, this.gegnerTor(schuetze.team), feldspieler);
        xg *= 1 - Math.min(0.3, block * 0.2);
        // Ein dicht besetzter Strafraum verstellt Winkel und Schussbahn
        if (this.imGegnerStrafraum(schuetze, schuetze.team)) xg *= 1 - Math.min(0.4, this.strafraumDichte(schuetze.team) * 0.12);
        // Wer zwischen Ball und Tor steht, verstellt Winkel und Schussbahn:
        // Gegen einen tiefen Block kommt der Schuss selten frei
        if (this.fm()) {
            const torX = this.gegnerTor(schuetze.team).x;
            const davor = feldspieler.filter(o => Math.abs(torX - o.x) < Math.abs(torX - schuetze.x)
                && Math.abs(o.y - schuetze.y) < 24).length;
            xg *= 1 - Math.min(0.3, Math.max(0, davor - 2) * 0.08);
        }
        // Auf nassem Rasen wird der Fernschuss tückisch, im Wind verweht er
        const wetter = this.wetter();
        if (wetter && g.dist > 18 && !opts.kopfball) xg *= 1 + (wetter.fern || 0);
        return { xg: Math.max(0.01, Math.min(0.85, xg)), dist: g.dist, winkel: g.winkel, druck, block };
    }

    /** Abschlussstaerke: Fuss oder Kopf */
    abschlussWert(p, kopfball = false) {
        if (kopfball) {
            return this.attr(p, "physical") * 0.45 + this.attr(p, "positioning") * 0.25
                + this.attr(p, "shooting") * 0.3 + (this.eig(p).luft || 0) * 0.6;
        }
        return this.attr(p, "shooting") * 0.65 + this.attr(p, "technique") * 0.35;
    }

    /** Torwartstaerke - im Eins-gegen-eins zaehlt das Herauslaufen mehr */
    torwartWert(gk, nah = false) {
        if (!gk) return 40;
        return this.attr(gk, "reflexes", 60) * 0.4 + this.attr(gk, "handling", 60) * 0.2
            + this.attr(gk, "positioning", 60) * 0.2 + this.attr(gk, "oneOnOne", 60) * (nah ? 0.3 : 0.2);
    }

    /** Wie gut ein Spieler in der Luft ist */
    kopfballWert(p, angreifer = true) {
        const e = this.eig(p);
        const basis = angreifer
            ? this.attr(p, "physical") * 0.55 + this.attr(p, "positioning") * 0.25 + this.attr(p, "technique") * 0.1 + this.attr(p, "pace") * 0.1
            : this.attr(p, "physical") * 0.55 + this.attr(p, "defense") * 0.25 + this.attr(p, "positioning") * 0.2;
        // Größe zählt in der Luft: zehn Zentimeter sind gut fünf Punkte
        const groesse = typeof p.groesse === "number" ? (p.groesse - 181) * 0.55 : 0;
        return basis + groesse + (e.luft || 0) + (angreifer ? (e.strafraum || 0) * 5 : 0);
    }

    /**
     * Muss der Schütze mit dem schwachen Fuß abziehen? Beidfüßige nie; sonst
     * manchmal - und öfter, wenn er auf der Seite seines schwachen Fußes aus
     * spitzem Winkel kommt (der Rechtsfuß links neben dem Tor).
     */
    schwacherFuss(schuetze) {
        const fuss = schuetze?.foot;
        if (!fuss || fuss === "beidfüßig") return false;
        const cfg = (typeof MatchEngine !== "undefined" && MatchEngine.SCHWACHER_FUSS)
            || { basis: 0.18, falscheSeite: 0.3 };
        const dir = this.attackDir(schuetze.team);
        // Aus Sicht des Angreifers: links ist bei Angriff nach rechts oben (y < 50)
        const linkeSeite = dir > 0 ? schuetze.y < 50 : schuetze.y > 50;
        const falscheSeite = (fuss === "rechts" && linkeSeite) || (fuss === "links" && !linkeSeite);
        const g = this.torGeometrie(schuetze, schuetze.team);
        const spitz = g.winkel < 0.45 && Math.abs(schuetze.y - 50) > 9;
        return _flowRandom.chance(cfg.basis + (falscheSeite && spitz ? cfg.falscheSeite : 0));
    }

    /**
     * Den Abschluss bewerten. Der Spieler schiesst, wenn ihm die Chance gut
     * genug erscheint - und wie gut sie ihm erscheint, haengt an ihm selbst:
     * Ein Knipser schiesst eher als ein Innenverteidiger, wer gern aus der
     * Distanz abzieht, tut es auch aus fuenfundzwanzig Metern.
     */
    rateShot(carrier, opponents, tactics, pressure) {
        if (!carrier || carrier.pos === "TW") return null;
        const e = this.eig(carrier);
        const g = this.torGeometrie(carrier, carrier.team);
        const wk = _flowTaktik()?.wirkung(tactics) || {};
        const reichweite = 25 + (e.distanz ? 9 : 0) + ((wk.fernschuesse || 0) > 0 ? 4 : 0) + (e.nachInnen ? 3 : 0);
        if (g.dist > reichweite || g.winkel < 0.1) return null;

        const q = this.chancenQualitaet(carrier, opponents);
        const koennen = this.abschlussWert(carrier) / 100;
        // Wie sehr er sich den Abschluss zutraut
        const zutrauen = 0.7 + koennen * 0.55 + (e.abschluss || 0) * 2 + (e.ruhe ? 0.08 : 0)
            + (carrier.group === "att" ? 0.12 : carrier.group === "def" ? -0.2 : 0);
        let score = -0.12 + q.xg * 13 * zutrauen;
        // Im vollen Strafraum sucht er eher den Mitspieler als die Lücke
        if (this.imGegnerStrafraum(carrier, carrier.team)) score -= this.strafraumDichte(carrier.team) * 0.12;
        // Aus der Distanz schiesst, wer es kann oder soll - die anderen suchen
        // lieber den Weg in den Strafraum
        if (g.dist > 18) score += (e.distanz ? 0.55 : -0.2) + (e.abschlussDistanz || 0) * 5 + (wk.fernschuesse || 0) * 0.4;
        if (tactics.mentality === "offensive" || tactics.mentality === "very_offensive") score += 0.12;
        score += _flowRandom.float(-0.2, 0.2) * this.entscheidungsRauschen(carrier);
        // Mit dem schwachen Fuß traut er sich weniger zu
        const schwach = this.fm() ? this.schwacherFuss(carrier) : false;
        if (schwach) score -= 0.15;
        return { type: "shot", score, xg: q.xg, dist: q.dist, druck: q.druck, block: q.block, schwach };
    }

    /**
     * Den Ausgang eines Schusses wuerfeln: geblockt, vorbei, gehalten, Tor.
     *
     * Die Chance (xG) ist, was ein durchschnittlicher Schuetze gegen einen
     * durchschnittlichen Torwart daraus macht. Der Unterschied zwischen
     * beiden verschiebt die Torwahrscheinlichkeit - so wird ein Weltklasse-
     * stuermer gegen einen Aushilfskeeper zum Problem.
     *
     * opts: kopfball, freistoss, elfmeter, xg (vorgegeben)
     */
    schussAusgang(schuetze, opponents, opts = {}) {
        const e = this.eig(schuetze);
        const gk = opponents.find(o => o.pos === "TW") || null;
        const eg = gk ? this.eig(gk) : {};
        const q = opts.xg !== undefined
            ? { xg: opts.xg, dist: 11, druck: 0, block: 0 }
            : this.chancenQualitaet(schuetze, opponents, { kopfball: !!opts.kopfball });
        const nah = q.dist < 12;

        // Verteidiger im Schussweg blocken - nicht beim Elfmeter
        const feldspieler = opponents.filter(o => o.pos !== "TW");
        if (!opts.elfmeter && !opts.freistoss) {
            const pBlock = Math.max(0, Math.min(0.42, q.block * 0.34));
            if (_flowRandom.chance(pBlock)) {
                const blocker = this.findInterceptor(schuetze, this.gegnerTor(schuetze.team), feldspieler) || feldspieler[0] || null;
                return { ausgang: "blocked", xg: q.xg, gk, blocker, ecke: _flowRandom.chance(0.45) };
            }
        }

        const abschluss = opts.freistoss
            ? this.attr(schuetze, "shooting") * 0.45 + this.attr(schuetze, "technique") * 0.55
            : opts.elfmeter
                ? this.attr(schuetze, "shooting") * 0.6 + this.attr(schuetze, "technique") * 0.4
                : this.abschlussWert(schuetze, !!opts.kopfball);
        const halter = this.torwartWert(gk, nah);
        // Torhueter haben ihre Werte genau dort, wo es zaehlt; ein Schuetze
        // nur zum Teil. Gleich gute Spieler sollen sich die Waage halten.
        // Der Ausgleich ist so gewählt, dass ein durchschnittlicher Schütze
        // gegen einen durchschnittlichen Torwart im Mittel seine xG trifft
        const edge = abschluss - halter + 14;

        // Die Chance, verschoben um das Duell Schuetze gegen Torwart
        let pTor = q.xg * Math.max(0.45, Math.min(1.8, 1 + edge / 55));
        // Eigenschaften - dieselben Faktoren wie in der Sofort-Simulation
        // (MatchEngine.eigenschaftsWirkung): Abschluss und Reflexe anteilig,
        // damit eine Halbchance eine Halbchance bleibt; Elfmeter absolut
        if (opts.elfmeter) {
            pTor += (e.elfmeter || 0) + (e.abschluss || 0) * 0.3
                - (eg.twElfmeter || 0) * 0.5 - (eg.twReflex || 0) * 0.3;
        } else {
            pTor *= (1 + (e.abschluss || 0) * 2.5) * (1 - (eg.twReflex || 0) * 2);
            if (opts.freistoss) pTor *= 1 + (e.freistoss || 0) * 5;
            if (q.dist > 20) pTor *= 1 + (e.abschlussDistanz || 0) * 5;
            if (nah) pTor *= 1 - (eg.twStrafraum || 0) * 0.3;
        }
        // Ruhe vor dem Tor: Der Druck des Gegners wiegt weniger
        if (e.ruhe) pTor *= 1 + Math.min(1, q.druck) * 0.1 * e.ruhe;
        // Nervenstärke: Unter Druck und vom Punkt trifft der Nervenstarke
        // öfter, der Nervöse seltener
        if (this.fm() && schuetze.mental) {
            const nerv = (this.nerven(schuetze) - 12) / 100;
            pTor *= 1 + nerv * (opts.elfmeter ? 1.5 : 0.4 + Math.min(1, q.druck) * 0.9);
        }
        // Schwacher Fuß: Der Abschluss wird unsauberer - mit dem starken
        // sitzt er etwas besser (im Mittel gleicht es sich aus)
        const mitFuss = !opts.kopfball && !opts.elfmeter && !opts.freistoss && schuetze.foot && schuetze.foot !== "beidfüßig";
        // Ohne Vorentscheidung (Abpraller, Nachschuss) entscheidet die Lage
        const schwach = mitFuss && (opts.schwach !== undefined ? !!opts.schwach : (this.fm() && this.schwacherFuss(schuetze)));
        const fussArt = mitFuss && this.fm() ? (schwach ? "schwach" : "stark") : null;
        const fussCfg = (typeof MatchEngine !== "undefined" && MatchEngine.SCHWACHER_FUSS) || { faktorSchwach: 0.8, faktorStark: 1.05 };
        if (fussArt === "schwach") pTor *= fussCfg.faktorSchwach;
        else if (fussArt === "stark") pTor *= fussCfg.faktorStark;
        pTor = Math.max(0.005, Math.min(opts.elfmeter ? 0.93 : 0.9, pTor));

        // Aufs Tor kommt, wer sauber trifft - unabhaengig davon, ob es reicht
        let pAufsTor = 0.36 + (abschluss - 60) / 220 + q.xg * 0.45 - Math.min(1, q.druck) * 0.08
            - (fussArt === "schwach" ? 0.06 : 0);
        if (opts.elfmeter) pAufsTor = 0.95;
        pAufsTor = Math.max(pTor + 0.07, Math.min(0.9, pAufsTor));

        const wurf = Math.random();
        if (wurf < pTor) return { ausgang: "goal", xg: q.xg, gk, schwach: fussArt === "schwach" };
        if (wurf < pAufsTor) {
            // Gehalten: festgehalten, zur Ecke abgewehrt oder abgeklatscht
            const sicher = 0.3 + this.attr(gk, "handling", 60) / 280;
            const w = Math.random();
            return {
                ausgang: "saved", xg: q.xg, gk,
                festgehalten: w < sicher,
                ecke: w >= sicher && w < sicher + (1 - sicher) * 0.5
            };
        }
        // Vorbei - abgefaelscht ins Toraus gibt es Ecke
        const abgefaelscht = !opts.elfmeter && !opts.freistoss && q.block > 0.2 && _flowRandom.chance(0.35);
        return { ausgang: _flowRandom.chance(0.08) ? "woodwork" : "missed", xg: q.xg, gk, ecke: abgefaelscht };
    }

    /**
     * Die Flanke bewerten: vom Fluegel im letzten Drittel, wenn im Strafraum
     * jemand steht. Wer gern flankt, flankt; die Taktik ("frueh flanken",
     * "wenig flanken", "bis zur Grundlinie") zaehlt mit.
     */
    rateCross(carrier, mates, opponents, tactics, pressure) {
        if (!carrier || carrier.pos === "TW") return null;
        const dir = this.attackDir(carrier.team);
        const progress = dir > 0 ? carrier.x / 100 : 1 - carrier.x / 100;
        if (progress < 0.68 || Math.abs(carrier.y - 50) < 19) return null;

        const tor = this.gegnerTor(carrier.team);
        const imStrafraum = mates.filter(m => m.pos !== "TW"
            && Math.abs(m.x - tor.x) < 17 && Math.abs(m.y - 50) < 22);
        if (!imStrafraum.length) return null;

        const e = this.eig(carrier);
        const wk = _flowTaktik()?.wirkung(tactics) || {};
        const koennen = (this.attr(carrier, "passing") * 0.55 + this.attr(carrier, "technique") * 0.45) / 100;
        const amGrundlinie = Math.abs(carrier.x - tor.x) < 12;
        let taktik = 0;
        if (wk.flanken === "frueh") taktik += 0.35;
        else if (wk.flanken === "wenig") taktik -= 0.6;
        else if (wk.flanken === "grundlinie") taktik += amGrundlinie ? 0.35 : -0.3;

        const score = 0.45 + koennen * 1.1 + Math.min(3, imStrafraum.length) * 0.3
            + (e.flankeWille || 0) + taktik - pressure * 0.2
            + _flowRandom.float(-0.2, 0.2);
        return { type: "cross", score, ziele: imStrafraum };
    }

    /**
     * Die Flanke ausfuehren: Wo landet sie, wer kommt an den Ball?
     *
     * Erst die Hereingabe (eine schlechte landet beim Gegner oder im Aus),
     * dann der Torwart (kommt er raus?), dann das Kopfballduell zwischen dem
     * Zielspieler und dem naechsten Verteidiger. Gewinnt der Angreifer, ist
     * es ein Kopfball aufs Tor; sonst wird geklaert - manchmal zur Ecke.
     *
     * opts: ecke (Eckstoss), standard (Freistossflanke), pressure, phase
     */
    resolveCross(carrier, action, opponents, opts = {}) {
        const team = carrier.team;
        const dir = this.attackDir(team);
        const tor = this.gegnerTor(team);
        const e = this.eig(carrier);
        const mates = this.teamOf(team).filter(m => m.id !== carrier.id && m.pos !== "TW");
        const ziele = (action && action.ziele && action.ziele.length) ? action.ziele
            : mates.filter(m => Math.abs(m.x - tor.x) < 18 && Math.abs(m.y - 50) < 24);
        const pressure = opts.pressure || 0;
        const basis = { type: "cross", from: carrier, pressure, phase: opts.phase, ecke: !!opts.ecke, standard: !!opts.standard };

        let qualitaet = (this.attr(carrier, "passing") * 0.55 + this.attr(carrier, "technique") * 0.45) / 100
            + (e.flankeKoennen || 0) - pressure * 0.1;
        if ((opts.ecke || opts.standard) && e.eckenQualitaet) qualitaet += 0.08;

        if (!ziele.length) {
            // Niemand im Strafraum: Die Hereingabe landet beim Gegner
            const punkt = { x: tor.x - dir * 9, y: 50 + _flowRandom.float(-10, 10) };
            return { ...basis, outcome: "cleared", landung: punkt, to: punkt, verteidiger: null, eckeFolgt: false };
        }

        // Ziel ist der Beste in der Luft
        const ziel = ziele.slice().sort((a, b) => this.kopfballWert(b) - this.kopfballWert(a))[0];
        let landung = {
            x: Math.max(5, Math.min(95, ziel.x + _flowRandom.float(-2, 2))),
            y: Math.max(30, Math.min(70, ziel.y + _flowRandom.float(-3, 3)))
        };
        // Eckenvariante: an den ersten oder an den zweiten Pfosten
        const variante = opts.ecke ? (opts.variante || null) : null;
        const seite = carrier.y < 50 ? -1 : 1;
        if (variante === "ersterPfosten") {
            landung = { x: tor.x - dir * _flowRandom.float(3.5, 5.5), y: 50 + seite * _flowRandom.float(2.5, 5.5) };
        } else if (variante === "zweiterPfosten") {
            landung = { x: tor.x - dir * _flowRandom.float(5, 8), y: 50 - seite * _flowRandom.float(3.5, 7) };
        }
        // Wie der Gegner Standards verteidigt
        const deckung = (opts.ecke || opts.standard)
            ? (_flowTaktik()?.wirkung(this.getTactics(team === "home" ? "away" : "home") || {}).standardDeckung || "raum")
            : null;

        // Missglueckt: zu lang, zu kurz oder direkt in die Arme des Gegners
        const pSchlecht = Math.max(0.07, Math.min(0.36, 0.36 - qualitaet * 0.3));
        if (_flowRandom.chance(pSchlecht)) {
            if (_flowRandom.chance(0.35)) {
                // Ueber alles hinweg ins Toraus
                const aus = { x: tor.x + dir * 3, y: landung.y };
                return { ...basis, outcome: "out", landung: aus, to: aus };
            }
            const kurz = { x: tor.x - dir * _flowRandom.float(10, 20), y: landung.y };
            return { ...basis, outcome: "cleared", landung: kurz, to: kurz, verteidiger: null, eckeFolgt: _flowRandom.chance(0.15) };
        }

        // Der Torwart kommt heraus, wenn die Flanke nah ans Tor kommt
        const gk = this.opponentsOf(team).find(o => o.pos === "TW") || null;
        if (gk && Math.abs(landung.x - tor.x) < 7 && Math.abs(landung.y - 50) < 12) {
            // Scharf an den ersten Pfosten kommt der Torwart schwer heran,
            // die hohe Flanke an den zweiten eher
            const varianteFangen = variante === "ersterPfosten" ? 0.5 : (variante === "zweiterPfosten" ? 1.2 : 1);
            const pFangen = Math.min(0.6, ((this.attr(gk, "handling", 60) + this.attr(gk, "positioning", 60)) / 330
                + (this.eig(gk).twStrafraum || 0) * 0.2) * varianteFangen);
            if (_flowRandom.chance(pFangen)) return { ...basis, outcome: "claimed", landung, to: landung, gk };
        }

        // Das Kopfballduell. In Manndeckung klebt der beste Kopfballspieler
        // am gefährlichsten Gegner; im Raum geht der nächste zum Ball - und
        // die Zone am ersten Pfosten ist immer besetzt.
        const feld = opponents.filter(o => o.pos !== "TW");
        const mannDeckung = deckung === "mann" || (deckung === "gemischt" && _flowRandom.chance(0.5));
        const verteidiger = (mannDeckung
            ? feld.slice().sort((a, b) => this.kopfballWert(b, false) - this.kopfballWert(a, false))[0]
            : feld.slice().sort((a, b) => this.distance(a, landung) - this.distance(b, landung))[0]) || null;
        const angriff = this.kopfballWert(ziel, true) + qualitaet * 8;
        const zone = !mannDeckung && deckung && variante === "ersterPfosten" ? 5 : 0;
        const abwehr = verteidiger ? this.kopfballWert(verteidiger, false) + zone : 20;
        // Steht der Verteidiger weit weg, hat der Angreifer freie Bahn -
        // in Manndeckung steht er immer am Mann
        const abstand = verteidiger ? (mannDeckung ? 1.5 : this.distance(verteidiger, landung)) : 20;
        const vorsprung = Math.max(0, abstand - 3) * 2.5;
        const pKopf = Math.max(0.12, Math.min(0.82, 1 / (1 + Math.exp(-(angriff - abwehr + vorsprung - 6) / 9))));

        if (_flowRandom.chance(pKopf)) {
            return { ...basis, outcome: "header", landung, to: landung, kopfballer: ziel, verteidiger };
        }
        return {
            ...basis, outcome: "cleared", verteidiger, landung,
            to: { x: tor.x - dir * _flowRandom.float(14, 24), y: Math.max(12, Math.min(88, landung.y + _flowRandom.float(-15, 15))) },
            eckeFolgt: _flowRandom.chance(0.5)
        };
    }

    /**
     * Foul im Zweikampf: Der Verteidiger kommt zu spaet oder steigt zu hart
     * ein. Aggressive Spieler (Temperament, "geht in jeden Zweikampf") und
     * eine harte Taktik foulen oefter; wer gut dribbelt, holt Fouls heraus.
     */
    /**
     * Im eigenen Strafraum geht kaum ein Verteidiger mit vollem Risiko in den
     * Zweikampf - jeder weiss, was ein Foul dort kostet. Ohne diese Vorsicht
     * gab es gemessen fast zwei Elfmeter je Spiel statt einem alle drei.
     */
    strafraumVorsicht(carrier) {
        const tor = this.gegnerTor(carrier.team);
        return Math.abs(tor.x - carrier.x) < 16.5 && Math.abs(carrier.y - 50) < 30 ? 0.2 : 1;
    }

    foulImZweikampf(carrier, defender, haerte = 0, edge = 0) {
        const ed = this.eig(defender);
        const ea = this.eig(carrier);
        const temperament = typeof defender.temperament === "number" ? defender.temperament : 12;
        const p = 0.27 + haerte * 0.06 + (ed.haerte || 0) * 0.1 + (ea.ziehtFouls || 0)
            + (temperament - 12) * 0.012 + Math.max(0, edge) / 400;
        const pfeife = this.schiri()?.pfeife || 1;
        // Auf rutschigem Boden kommt der Verteidiger öfter zu spät
        const rutschig = 1 + (this.wetter()?.rutschig || 0) * 0.5;
        if (!_flowRandom.chance(Math.max(0.03, Math.min(0.45, p * rutschig)) * pfeife * this.strafraumVorsicht(carrier))) return null;
        return { type: "foul", outcome: "foul", from: carrier, to: { x: carrier.x, y: carrier.y }, foulender: defender, opfer: carrier };
    }

    /**
     * Foul unter Druck: Wer bedraengt den Ball haelt, wird auch mal
     * festgehalten oder umgestossen - ohne dass er dribbeln wollte.
     */
    pruefeDruckFoul(carrier, opponents, pressure, phase) {
        if (!carrier || carrier.pos === "TW" || pressure < 0.7) return null;
        const naechster = opponents.filter(o => o.pos !== "TW")
            .sort((a, b) => this.distance(carrier, a) - this.distance(carrier, b))[0];
        // Naeher als gut vier Einheiten laesst das Laufmodell zwei Spieler
        // nicht kommen - wer so nah steht, ist im Zweikampf
        if (!naechster || this.distance(carrier, naechster) > 5.5) return null;
        const ed = this.eig(naechster);
        const haerte = _flowTaktik()?.wirkung(this.getTactics(naechster.team) || {}).zweikampf || 0;
        const p = (pressure - 0.6) * 0.085 * (1 + haerte * 0.4 + (ed.haerte || 0) * 0.5 + (ed.pressing || 0) * 0.3);
        if (!_flowRandom.chance(p * (this.schiri()?.pfeife || 1) * this.strafraumVorsicht(carrier))) return null;
        return { type: "foul", outcome: "foul", from: carrier, to: { x: carrier.x, y: carrier.y }, foulender: naechster, opfer: carrier, pressure, phase };
    }

    /**
     * Trifft die Entscheidung für die nächste Aktion des Ballführenden
     */
    decide(carrier, options = {}) {
        if (!carrier) return null;
        this._kette = options.chainLength || 0;

        const team = carrier.team;
        const tactics = this.getTactics(team) || {};
        const mates = this.teamOf(team).filter(p => p.id !== carrier.id && p.pos !== "TW");
        const opponents = this.opponentsOf(team);

        const pressure = this.getPressure(carrier, opponents);
        const phase = options.phase || this.derivePhase(carrier, team);

        // Im eigenen Drittel gehört der Torwart zum Aufbau. Er ist die
        // Station, über die eine Mannschaft verlagert, wenn vorne alles
        // zusteht - und nicht mehr der Mann, der aus dem Nichts den Ball hat.
        if (phase === FLOW_PHASES.BUILDUP && carrier.pos !== "TW") {
            const keeper = this.teamOf(team).find(p => p.pos === "TW");
            if (keeper) mates.push(keeper);
        }

        const candidates = this.ratePassOptions(carrier, mates, opponents, tactics, {
            phase,
            pressure,
            chainLength: options.chainLength || 0,
            // Der Spieler, auf den die naechste Szene zulaeuft. Das Aufbauspiel
            // sucht ihn - dadurch entsteht die Szene aus dem Spiel heraus,
            // statt dass der Ball zu ihr transportiert wird.
            zielSpieler: options.zielSpieler || null
        });
        candidates.push(this.rateDribble(carrier, opponents, tactics, pressure));

        // FM-Modus: Abschluss und Flanke stehen gleichberechtigt neben dem
        // Zuspiel. Ob einer schiesst, haengt an der Lage und an seinen Werten.
        if (this.fm()) {
            const schuss = this.rateShot(carrier, opponents, tactics, pressure);
            if (schuss) candidates.push(schuss);
            const flanke = this.rateCross(carrier, mates, opponents, tactics, pressure);
            if (flanke) candidates.push(flanke);

            // Unter hohem Druck wird der Ballfuehrende auch mal umgerissen
            const foul = this.pruefeDruckFoul(carrier, opponents, pressure, phase);
            if (foul) return foul;
        }

        candidates.sort((a, b) => b.score - a.score);

        let best = candidates[0] || null;

        // Der Befreiungsschlag ist kein gleichberechtigter Vorschlag, sondern
        // die Reißleine. Als Kandidat unter Kandidaten hat er fast jede zweite
        // Aktion gewonnen - das Ergebnis war ein Spiel aus langen Bällen, von
        // denen nur die Hälfte ankam.
        // Der Kompromisslose schlaegt den Ball schon bei weniger Druck weg
        const sicher = carrier.rolleMit?.sicher || 0;
        if (!best || (pressure > 0.6 - sicher && best.score < 0.5 + sicher)) {
            best = this.rateClearance(carrier, mates, tactics, pressure);
        }

        if (!best) return null;

        return this.resolve(carrier, best, opponents, tactics, pressure, phase);
    }

    /**
     * Führt die gewählte Aktion aus und würfelt ihren Ausgang
     */
    resolve(carrier, action, opponents, tactics, pressure, phase) {
        if (action.type === "dribble") {
            return this.resolveDribble(carrier, action, opponents, tactics, pressure, phase);
        }
        if (action.type === "shot") {
            return { type: "shot", from: carrier, to: this.gegnerTor(carrier.team), pressure, phase, chance: action };
        }
        if (action.type === "cross") {
            return this.resolveCross(carrier, action, opponents, { pressure, phase });
        }
        return this.resolvePass(carrier, action, opponents, tactics, pressure, phase);
    }

    resolvePass(carrier, action, opponents, tactics, pressure, phase) {
        const isLong = action.type === "clearance" || action.dist > 32;
        const passing = this.attr(carrier, "passing");
        const vision = this.attr(carrier, "vision");
        const technique = this.attr(carrier, "technique");

        // Genauigkeit aus Attributen, gemindert durch Druck, Distanz und Passweg.
        // Profis bringen rund vier von fünf Pässen an den Mann; mit der alten
        // Grundgenauigkeit von 52 % wechselte der Ball ständig die Seite und
        // das Spiel wirkte wie ein Pingpong ohne Absicht.
        //
        // Seit die Gegner mannorientiert decken und ihren Gegenspieler eng
        // begleiten, sind Passwege und Druck spürbar größer - bei gleicher
        // Grundgenauigkeit kamen nur noch sieben von zehn Pässen an. Die
        // Grundgenauigkeit gleicht das aus.
        const skill = (passing * 0.5 + vision * 0.3 + technique * 0.2) / 100;
        let accuracy = 0.77 + skill * 0.24;
        const eg = this.fm() ? this.eig(carrier) : {};
        if (this.fm()) {
            accuracy += 0.08;
            // Im FM-Modus ist der Pass ein Duell: Passgeber gegen den Gegner,
            // der ihn bedraengt. Vorher zaehlten nur die eigenen Werte, und
            // die kaum - Bayern spielte gegen Augsburg dieselbe Passquote.
            const bedraenger = opponents.filter(o => o.pos !== "TW")
                .sort((a, b) => this.distance(carrier, a) - this.distance(carrier, b))[0];
            if (bedraenger) {
                const gegner = (this.attr(bedraenger, "defense") * 0.5 + this.attr(bedraenger, "positioning", 60) * 0.3
                    + this.attr(bedraenger, "pace") * 0.2) / 100;
                accuracy += (skill - gegner) * 0.22 * Math.min(1, pressure + 0.3);
            }
            accuracy += (skill - 0.72) * 0.12;
        }
        accuracy += eg.passKoennen || 0;
        // Konzentration: In der Schlussphase unterlaufen dem Unkonzentrierten
        // mehr Fehler, der Profi bleibt bei der Sache
        if (this.fm() && carrier.mental && (this.lage(carrier.team)?.minute || 0) >= 75) {
            accuracy += (this.konzentration(carrier) - 12) * 0.003;
        }
        // Wer druckfest ist, spielt auch bedraengt sauber
        accuracy -= pressure * 0.11 * (1 - Math.min(0.7, (eg.druckfest || 0) * 0.5));
        accuracy -= (action.laneRisk || 0) * 0.17;
        // Pässe in einen vollen Strafraum werden eher abgefangen
        const passZiel = action.target || action.to;
        if (passZiel && this.imGegnerStrafraum(passZiel, carrier.team)) {
            accuracy -= Math.min(0.16, this.strafraumDichte(carrier.team) * 0.045);
        }
        if (isLong) accuracy -= 0.13;
        // Nasser Rasen, tiefer Boden, Wind
        const wetter = this.wetter();
        if (wetter) accuracy += (wetter.pass || 0) + (isLong ? (wetter.lang || 0) : 0);
        // Schnelles Tempo kostet Genauigkeit vor allem beim Ball nach vorn;
        // dafuer trifft es eine Abwehr, die sich nach dem Ballverlust noch
        // nicht sortiert hat
        const nachVorn = (action.forward ?? 0) > 4;
        if (tactics.tempo === "fast") accuracy -= nachVorn ? 0.025 : 0.01;
        const umschalten = (this._kette ?? 9) <= 3 && (tactics.tempo === "fast" || (_flowTaktik()?.wirkung(tactics).konter || 0) > 0);
        if (umschalten && nachVorn) accuracy += 0.04;
        if (tactics.passing === "short") accuracy += 0.05;

        // Der sichere Ball zur Seite oder zurück kommt fast immer an
        if ((action.forward ?? 1) <= 0) accuracy += 0.07;

        accuracy = Math.max(0.34, Math.min(0.97, accuracy));

        const success = _flowRandom.chance(accuracy);

        if (success) {
            // In den Lauf gespielt wird nach vorn und auf Spieler, die schon
            // in Bewegung sind - nie auf den Torwart
            const annahme = _flowTaktik()?.wirkung(tactics).ballannahme || 0;
            const nachVorn = (action.forward ?? 0) > 4 && action.target?.pos !== "TW";
            const inDenLauf = nachVorn && (annahme > 0 || (annahme === 0 && _flowRandom.chance(0.3)));
            return {
                type: isLong ? "longball" : "pass",
                outcome: "complete",
                from: carrier,
                to: action.target,
                inDenLauf,
                pressure,
                phase
            };
        }

        // Fehlpass: abgefangen, frei liegend oder ins Aus
        const roll = Math.random();
        const interceptor = this.findInterceptor(carrier, action.target, opponents);
        // Ein Abwehrchef liest den Pass und faengt ihn eher ab
        const abfangen = this.fm() && interceptor ? (this.eig(interceptor).abfangen || 0) : 0;

        if (interceptor && roll < 0.55 + abfangen * 0.3) {
            // Im eigenen Strafraum abgefaelscht geht der Ball oft ins Toraus
            if (this.fm() && Math.abs(interceptor.x - this.ownGoalX(interceptor.team)) < 16
                && Math.abs(interceptor.y - 50) < 30 && _flowRandom.chance(0.22)) {
                return { type: isLong ? "longball" : "pass", outcome: "corner", from: carrier, to: { x: interceptor.x, y: interceptor.y }, interceptor, pressure, phase };
            }
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

        // Ein guter Teil der Fehlpässe bleibt im Spiel und wird zum Kampf um
        // den zweiten Ball. Nur jeder achte segelt ins Aus - sonst zerfällt
        // die Partie in eine Kette von Einwürfen.
        if (roll > 0.88) {
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

        // Andribbeln in den freien Raum: kein Zweikampf, niemand zu schlagen
        if (action.frei && (!defender || this.distance(carrier, defender) > 8)) {
            return { type: "dribble", outcome: "beaten", frei: true, from: carrier, to: action.target, defender: null, pressure, phase };
        }

        const dribbling = this.attr(carrier, "dribbling");
        const pace = this.attr(carrier, "pace");
        const defSkill = defender ? (this.attr(defender, "defense") * 0.6 + this.attr(defender, "pace") * 0.4) : 60;

        const edge = (dribbling * 0.6 + pace * 0.4) - defSkill;
        // Wer hart einsteigt, gewinnt mehr Zweikaempfe (und foult oefter -
        // das zaehlt die Timeline); wer auf den Fuessen bleibt, weniger
        const gegnerTaktik = defender ? this.getTactics(defender.team) || {} : {};
        const haerte = _flowTaktik()?.wirkung(gegnerTaktik).zweikampf || 0;
        const fm = this.fm();
        // Im FM-Modus entscheiden die Werte den Zweikampf deutlich
        let chance = 0.6 + edge / (fm ? 140 : 210) - pressure * 0.13 - haerte * 0.05;
        // In einen vollen Strafraum kommt man nicht einfach hineingedribbelt
        if (fm && this.imGegnerStrafraum(action.target, carrier.team)) chance -= Math.min(0.2, this.strafraumDichte(carrier.team) * 0.05);
        const ea = fm ? this.eig(carrier) : {};
        const ed = fm && defender ? this.eig(defender) : {};
        chance += (ea.dribbelKoennen || 0) - (ed.zweikampf || 0);
        // Im freien Raum hilft der Antritt: Wer schneller ist, ist weg
        if (fm && (action.space || 0) > 0.4) chance += ea.antritt || 0;
        chance = Math.max(0.2, Math.min(0.92, chance));

        if (_flowRandom.chance(chance)) {
            return { type: "dribble", outcome: "beaten", from: carrier, to: action.target, defender, pressure, phase };
        }

        // FM-Modus: Nicht jeder verlorene Zweikampf ist sauber gefuehrt.
        // Wer hart einsteigt oder zu spaet kommt, foult - und wer die Gegner
        // reihenweise stehen laesst, holt Fouls heraus.
        if (fm && defender) {
            const foul = this.foulImZweikampf(carrier, defender, haerte, edge);
            if (foul) return { ...foul, pressure, phase };
        }

        return { type: "dribble", outcome: "tackled", from: carrier, to: action.target, defender, pressure, phase };
    }

    /**
     * Macht aus einer Aktion einen Ballverlust, den man sieht.
     *
     * Der Spielverlauf steht vorher fest: Hat als Naechstes die andere
     * Mannschaft ihre Szene, muss sie den Ball vorher bekommen. Frueher
     * wechselte er dafuer einfach den Besitzer - der Gegner stand mit dem
     * Ball da, ohne ihn erobert zu haben, und es sah aus, als spielten sich
     * die Gegner den Ball zu. Jetzt faengt der naechste Gegner den Pass ab
     * oder gewinnt den Zweikampf. Liefert null, wenn kein Gegner nah genug ist.
     */
    alsBallverlust(carrier, action) {
        if (!carrier || !action) return null;
        const opponents = this.opponentsOf(carrier.team).filter(o => o.pos !== "TW");
        if (!opponents.length) return null;
        const naechster = (punkt) => opponents
            .slice()
            .sort((a, b) => this.distance(punkt, a) - this.distance(punkt, b))[0];

        if (action.type === "dribble") {
            const defender = naechster(carrier);
            if (!defender || this.distance(carrier, defender) > 14) return null;
            return { ...action, outcome: "tackled", defender, frei: false, erzwungen: true };
        }

        const ziel = action.to && typeof action.to.x === "number" ? action.to : carrier;
        const interceptor = this.findInterceptor(carrier, ziel, opponents) || naechster(ziel);
        if (!interceptor || this.distance(ziel, interceptor) > 22) return null;
        return { ...action, outcome: "intercepted", interceptor, erzwungen: true };
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
        // Der zweite Ball bleibt im Feld - ins Aus geht nur, was oben als
        // "out" gewürfelt wurde. Die Torlinien liegen bei 4 und 96.
        return {
            x: Math.max(5, Math.min(95, target.x + _flowRandom.float(-11, 11))),
            y: Math.max(3, Math.min(97, target.y + _flowRandom.float(-12, 12)))
        };
    }

    /**
     * Zielpunkt für einen Ball, der das Spielfeld verlässt.
     *
     * Über die Grundlinie rollt nur der zu scharf gespielte Ball nach vorne -
     * daraus wird der Abstoß des Gegners. Alles andere geht ins Seitenaus.
     * Genau so ist auch das Verhältnis im echten Spiel: auf einen Abstoß
     * kommen etliche Einwürfe. Vorher landete fast jeder zweite Fehlpass
     * hinter der Grundlinie, und der Torwart hatte ständig den Ball.
     */
    outOfPlayTarget(carrier, target) {
        const dir = this.attackDir(carrier.team);
        const x = target.x ?? carrier.x;
        const y = target.y ?? carrier.y;

        // Wie tief liegt der Zielpunkt in der gegnerischen Hälfte?
        const tiefe = dir > 0 ? x : 100 - x;

        if (tiefe > 82 && Math.abs(y - 50) < 27) {
            return { x: dir > 0 ? 101 : -1, y: Math.max(8, Math.min(92, y)) };
        }

        return { x: Math.max(4, Math.min(96, x + _flowRandom.float(-6, 6))), y: y < 50 ? -1 : 101 };
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
