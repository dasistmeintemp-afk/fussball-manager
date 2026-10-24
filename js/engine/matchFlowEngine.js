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

/** Der Ball als Körper (Stufe 1) - im Browser global, unter Node nachgeladen */
const _flowPhysik = () => {
    if (typeof BallPhysik !== 'undefined' && BallPhysik) return BallPhysik;
    if (typeof window !== 'undefined' && window.BallPhysik) return window.BallPhysik;
    if (typeof require !== 'undefined') {
        try { return require('./ballPhysik.js').BallPhysik; } catch (e) { /* ohne Ballphysik */ }
    }
    return null;
};

/** Spielphasen des Ballbesitzes */
const FLOW_PHASES = {
    GOAL_KICK: "goalkick",
    BUILDUP: "buildup",
    PROGRESSION: "progression",
    FINAL_THIRD: "final_third",
    TRANSITION: "transition"
};

class MatchFlowEngine {
    /** Absicherung beim Dribbling: Umkreis um den Zielpunkt und Abzug je weiterem Verteidiger */
    static ABSICHERUNG_RADIUS = 9;
    static ABSICHERUNG_JE_HELFER = 0.06;
    static ABSICHERUNG_MAX = 0.18;

    /**
     * Ballphysik (Stufe 1): Streuung eines Zuspiels. Aus der Genauigkeit des
     * Passgebers (dieselbe Rechnung wie bisher, nur ohne Passweg und vollen
     * Strafraum - die stecken jetzt in der Geometrie) wird eine Abweichung in
     * Richtung (Bogenmaß) und Tempo (Anteil). Gemessen und geeicht in
     * physik_mess: siehe README.
     */
    static PASS_STREUUNG = { winkel0: 0.02, winkel: 0.2, tempo0: 0.05, tempo: 0.32 };
    /**
     * Reaktionszeiten beim Zuspiel in Laufzeit-Sekunden: Der Angespielte weiß,
     * dass der Ball kommt; ein Gegner reagiert mit seiner Spielübersicht
     * (p.reaktion aus Antizipation und Übersicht), ein Mitspieler lässt den
     * Ball zum Angespielten durch.
     */
    static PASS_REAKTION = { empfaenger: 0.05, gegner: 1.0, mitspieler: 0.15 };
    /** Wie oft der schwache Fuß ran muss (zur falschen Seite öfter) und wie viel mehr er streut */
    static PASS_SCHWACHER_FUSS = { basis: 0.15, falscheSeite: 0.35, streuung: 1.4 };

    /**
     * Stufe 2: Wann der Ballführende den Moment erkennt (lageAmBall). Ein
     * Ball nach vorn in den freien Raum mit offenem Passweg wird sofort
     * gespielt, wenn er mindestens so gut ist (steil; je Sekunde am Ball
     * etwas weniger), eine Torchance ab dieser Qualität (schuss, xG) sofort
     * genutzt, unter starkem Druck (druck) der sichere Ball direkt gespielt.
     */
    static MOMENT = { steil: 2.3, nachlass: 0.35, schuss: 0.14, druck: 0.95, vorn: 8, weg: 0.3, raum: 0.5 };

    /**
     * Ballführung (lageAmBall): Wie weit ein Spieler den Ball in den freien
     * Raum trägt - geprüft von weit nach nah, in Feldeinheiten - und wie viel
     * Platz der Zielpunkt und der Weg dorthin brauchen. Vorher waren es immer
     * sechs Einheiten: Gemessen trug ein Spieler den Ball im Mittel sechs,
     * sieben Meter, auch wenn vor ihm das halbe Feld frei war. Die
     * Anweisung "Dribblings": Bei weniger braucht er mehr Platz (weniger)
     * und trägt höchstens elf Einheiten weit, bei mehr reicht weniger (mehr).
     */
    static TRAGEN = { weiten: [15, 11, 7], raum: 0.4, druck: 0.45, weniger: 0.15, mehr: 0.06 };

    /**
     * Ein Dribbling gegen einen Gegenspieler ist die Ausnahme: Abzug auf seine
     * Bewertung. Vorher versuchte eine Elf in dreizehn Minuten Spielgeschehen
     * bis zu siebzig Dribblings im Zweikampf und verlor davon bis zu dreißig -
     * der Ball wechselte ständig den Besitzer, Passfolgen kamen kaum zustande.
     * In echten Spielen sind es über neunzig Minuten dreißig bis vierzig.
     */
    static DRIBBEL_DUELL = 0.6;

    /**
     * Der sichere Ball unter Druck (ratePassOptions): Ab diesem Druck bekommt
     * ein Zuspiel mit freiem Passweg zu einem freien Mitspieler - auch quer
     * oder zurück - einen Zuschlag. So reißt eine Passfolge nicht ab, sobald
     * ein Gegner kommt; vor dem Tor gilt das nicht.
     */
    static SICHERHEIT = { druck: 0.6, wert: 0.5 };

    /**
     * Abschirmen und wegdrehen (rateAbdrehen): ab welchem Druck, wie weit, die
     * Grundbewertung, das Gewicht des freien Raums - und wie oft es gelingt
     * (halten, verschoben um Ruhe am Ball gegen Zweikampfstärke).
     */
    static ABDREHEN = { druck: 0.6, weite: 6, basis: 0, raum: 0.5, halten: 0.9 };

    /**
     * Standards herausholen: In der gegnerischen Hälfte sucht der Ballführende
     * den Kontakt und holt öfter ein Foul heraus (foul), abgewehrte Flanken
     * und geblockte Schüsse gehen öfter zur Ecke (ecke). Vorher wirkte die
     * Anweisung nur in der Zeitleiste.
     */
    static STANDARDS_HOLEN = { foul: 1.3, ecke: 1.6 };

    /**
     * Flanken nach Anweisung (rateCross): Früh flankt schon ab fruehAb des
     * Feldes, auch auf Mitspieler bis fruehRaum Einheiten vor dem Tor, kaum
     * zieht kräftig ab, bis zur Grundlinie flankt erst dort. Mit -0.6 für
     * "kaum" kamen gemessen fünf Prozent weniger Flanken. gegnerWehr: Abzug
     * je Stufe, wenn der Gegner Flanken verhindern soll (Zuschlag bei zulassen).
     */
    static FLANKEN_TAKTIK = { fruehAb: 0.58, fruehRaum: 24, frueh: 0.45, wenig: -1.2, grundlinie: 0.4, vorGrundlinie: -0.9, gegnerWehr: 0.25 };

    /**
     * Zugriff (zugriff): Ein Pressingspieler, der bis auf abstand Einheiten
     * am Ballführenden ist, geht dazwischen - je Entscheidungstakt mit
     * basis, verschoben um seine Zweikampfstärke gegen die Ballsicherheit
     * des Gegners (wert) und die Härte der Anweisung (haerte). Wie oft, sagt
     * auch die Intensität: je Stufe "Pressing auslösen" (anlaufen), hohes
     * Pressing im Aufbau des Gegners (hoch) und das Gegenpressing nach dem
     * Ballverlust (gegenpressing) - siehe zugriffAmBall. Vorher nahm
     * im 2D-Spiel kein Verteidiger von sich aus den Ball ab: Pressing setzte
     * nur unter Druck, und gemessen wurde der Ball bei hohem Pressing nicht
     * höher erobert als bei tiefem.
     */
    static ZUGRIFF = { abstand: 5, basis: 0.02, wert: 0.35, haerte: 0.025, min: 0.005, max: 0.2, anlaufen: 0.015, hoch: 0.025, gegenpressing: 0.025, foul: 0.6 };

    /** Wie stark Tempo und Zeitspiel (takt in lageAmBall) die Schwellen für Steilpass und Druckball verschieben */
    static TAKT_MOMENT = { steil: 0.3, druck: 0.15 };

    /** Abschlussfreude je Mentalität (rateShot) */
    static MENTAL_SCHUSS = { very_offensive: 0.25, offensive: 0.12, defensive: -0.1, very_defensive: -0.2 };

    /**
     * Ab dieser Weite geht der Pass hoch (resolvePass). Beim Abschlag des
     * Torwarts zählt für den Passweg nur das letzte Stück ab "ab". Für
     * Feldspieler galt das anfangs auch: Dann schlugen sie gemessen 27 statt
     * 14 Prozent ihrer Pässe lang, und die Passfolgen rissen ab.
     */
    static LANG_HOCH = { weite: 32, ab: 0.75 };

    /** Abzug für den langen Ball beim Torwart je Einstellung "Abstöße" (ratePassOptions) */
    static TORWART_LANG = { kurz: 1, gemischt: 0.45, lang: 0.12 };

    /**
     * Abschluss nach Anweisung (rateShot). Distanzschüsse: Reichweite und
     * Zuschlag ab achtzehn Metern, je Stufe. Geduld: Wer herausspielt, lässt
     * die halbe Chance außerhalb des Strafraums liegen, wer früh abschließt,
     * nimmt sie. Vorher las rateShot einen Schlüssel, den es nicht gab, und
     * beide Anweisungen wirkten nur in der Zeitleiste. Als halbe Chance gilt
     * ein Abschluss unter halbeChance xG.
     */
    static ABSCHLUSS_TAKTIK = { reichweite: 4, weit: 0.45, herausspielen: 0.35, frueh: 0.4, halbeChance: 0.12 };

    /**
     * Stufe 5: Die Eichung des 2D-Modells in Zielkorridoren (Tore, Schüsse,
     * Passquote, Ecken, Fouls, Standardtore - siehe README). Mit der
     * Ballphysik verschoben sich alle Zahlen; diese Werte holen sie in die
     * Korridore zurück. Gemessen mit physik_mess und eich_detail über
     * Hunderte Spiele.
     *
     * - annahme: Wie oft ein Ball bei der Annahme wegspringt - Grundwert, je
     *   Einheit Tempo über ab, je Druck, beim hohen Ball
     * - schussLust, flankenLust: Zuschlag auf die Bewertung von Abschluss und
     *   Flanke (vorher kamen 20 statt 25 Schüsse und 9 statt 15 Flanken)
     * - ecke: Wie oft eine Kopfballabwehr nach der Flanke, eine Faust des
     *   Torwarts, ein geblockter und ein abgefälschter Schuss ins Toraus
     *   gehen. Mit Zugriff und gespielten Abstößen fielen gemessen 7,6 statt
     *   8,5 Ecken, die Zeitleiste lag bei 8,8.
     * - foul: Faktor auf Fouls im Zweikampf und unter Druck, im eigenen
     *   Strafraum (Elfmeter) zusätzlich vorsichtiger. Seit Feldspieler
     *   seltener lang schlagen, gibt es mehr Zweikämpfe am Ball: gemessen
     *   26,2 Fouls je Partie bei 1,2 und 1,75, die Zeitleiste lag bei 23,4.
     * - standard: Bei Ecke und Freistoßflanke ist der Strafraum voll - der
     *   Torwart kommt später heraus (twReaktion), und die einstudierte
     *   Variante bringt den Angreifern einen Vorteil im Kopfballduell
     *   (kopfball). Vorher fing der Torwart fast jede dritte Ecke, und nur
     *   jede sechste brachte einen Kopfball.
     * - tore: Faktor auf die Torwahrscheinlichkeit eines Abschlusses aus dem
     *   Spiel und nach Standards (Elfmeter ausgenommen)
     */
    static EICHUNG = {
        annahme: { basis: 0.012, ab: 11, jeTempo: 0.008, druck: 0.05, hoch: 0.07 },
        schussLust: 0.62,
        flankenLust: 0.35,
        ecke: { kopfball: 0.75, faust: 0.5, block: 0.55, abgefaelscht: 0.45 },
        foul: { zweikampf: 1.05, druck: 1.54, strafraum: 0.14 },
        standard: { twReaktion: 0.14, kopfball: 7 },
        tore: 0.91
    };

    // Geduld am Ball (siehe qualitaetsVorsprung): Bisher spielten Bayern und
    // Augsburg denselben Fußball - gemessen 52 Prozent Ballbesitz für Bayern
    // bei fast gleicher Passquote. Jetzt lässt die technisch überlegene Elf
    // den Ball laufen, und die unterlegene sucht schneller den Weg nach vorn.
    static GEDULD = 8;             // Vorsprung in der Ruhe am Ball -> Geduld
    static GEDULD_MAX = 0.9;
    static GEDULD_MIN = -0.5;      // der Unterlegene spielt direkter, aber nicht kopflos
    static GEDULD_QUER = 3;        // Gewicht des sicheren Balls quer oder zurück
    static ZUSAMMEN_WAHL = 0.18;   // Vorliebe für den gut verbundenen Mitspieler (TacticsEngine.zusammenspiel)
    static GEDULD_MITTE = 0.75;    // im Mittelfeld etwas weniger als im Aufbau

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
        // Gegneranweisungen des Trainers für einzelne Spieler (GegneranweisungEngine)
        this.anweisung = typeof options.anweisung === "function" ? options.anweisung : (() => null);
        // Zusammenspiel zweier Spieler (die Linien der Taktiktafel), 0 = neutral
        this.zusammenspiel = typeof options.zusammenspiel === "function" ? options.zusammenspiel : (() => 0);
        // Stufe 1: Der Ball als Körper (BallPhysik). Ohne sie wird der Ausgang
        // eines Zuspiels gewürfelt wie bisher.
        this.physik = typeof options.physik === "function" ? options.physik : (() => !!options.physik);
        // Wo der Ball liegt - die Flugbahn beginnt am Fuß, nicht in der Körpermitte
        this.getBall = typeof options.getBall === "function" ? options.getBall : (() => null);

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
    getLaneRisk(from, to, opponents, hoch = false) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq < 1) return 0;

        let risk = 0;
        opponents.forEach(o => {
            // Projektion des Gegners auf die Passlinie
            let t = ((o.x - from.x) * dx + (o.y - from.y) * dy) / lenSq;
            if (t < 0.05 || t > 0.95) return;
            // Ein hoher Ball fliegt über die Gegner hinweg: Es zählt nur, wer
            // dort steht, wo er herunterkommt (MatchFlowEngine.LANG_HOCH).
            // Vorher galt für ihn derselbe Passweg wie für den flachen Ball,
            // und kein Torwart schlug gemessen je weiter als 35 Meter ab -
            // auch nicht bei "Abstöße lang".
            if (hoch && t < MatchFlowEngine.LANG_HOCH.ab) return;

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

    /**
     * Was ein Detailwert (Kopfball, Flanken, Tackling ...) über die groben
     * Werte hinaus beisteuert. Steht im FM-Modus in den Feldwerten
     * (MatchEngine.werte2D), sonst null.
     */
    fein(player, name) {
        const v = player?.fein?.[name];
        return typeof v === "number" ? v : 0;
    }

    attr(player, name, fallback = 70) {
        const v = player?.[name];
        let wert = (typeof v === "number" && v > 0) ? v : fallback;
        // Ein Zuruf von der Seitenlinie wirkt, solange er nachhallt (LiveMatchDirector.zurufAnSpieler)
        const zuruf = player?.zuruf?.plus?.[name];
        if (zuruf) wert += zuruf;
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
        // Mit Kopfwerten zählen vor allem die Entscheidungen selbst
        const lesen = typeof player.decisions === "number"
            ? this.attr(player, "decisions") * 0.45 + this.attr(player, "vision") * 0.3
                + this.attr(player, "positioning", 60) * 0.1 + erfahrung * 0.15
            : this.attr(player, "vision") * 0.55 + this.attr(player, "positioning", 60) * 0.25 + erfahrung * 0.2;
        return Math.max(0.75, Math.min(1.3, 1.45 - lesen / 100 * 0.65));
    }

    /**
     * Ein Kopfwert auf der Skala der versteckten Werte (1-20, Mitte 12).
     * Im Spiel liegen die Werte um 70 (MatchEngine.fmSkala) - vier Punkte
     * dort sind einer hier. null, wenn der Spieler den Wert nicht kennt.
     */
    kopf20(player, key) {
        const v = player?.[key];
        return typeof v === "number" ? 12 + (v + (player.zuruf?.plus?.[key] || 0) - 70) / 4 : null;
    }

    /**
     * Nervenstärke (1-20): vor allem der Kopfwert, dazu große Spiele und
     * Erfahrung - und wer einen Anführer auf dem Platz hat, bleibt ruhiger.
     */
    nerven(player) {
        const m = player?.mental;
        const komp = this.kopf20(player, "composure");
        if (!m && komp === null) return 12;
        const alter = m?.alter ?? 26;
        const grosseSpiele = m?.grosseSpiele ?? 12;
        const erfahrung = Math.max(8, Math.min(18, 8 + (alter - 18) * 0.7));
        const basis = komp === null
            ? grosseSpiele * 0.5 + (m?.bestaendigkeit ?? 12) * 0.3 + erfahrung * 0.2
            : komp * 0.6 + grosseSpiele * 0.25 + erfahrung * 0.15;
        return basis + this.fuehrung(player.team);
    }

    /**
     * Führung: Der stärkste Anführer auf dem Platz gibt den anderen Halt.
     * Auf der Skala der Nerven, um null - eine Elf ohne Anführer verliert
     * gut einen halben Punkt, eine mit einem großen gewinnt fast einen.
     * Einmal je Spielminute gerechnet: Wechsel und Platzverweise zählen.
     */
    fuehrung(team) {
        if (!team) return 0;
        const minute = Math.floor(this.lage(team)?.minute || 0);
        this._fuehrung = this._fuehrung || {};
        const gemerkt = this._fuehrung[team];
        if (gemerkt && gemerkt.minute === minute) return gemerkt.wert;
        let beste = null;
        this.teamOf(team).forEach(p => {
            if (typeof p.leadership === "number" && (beste === null || p.leadership > beste)) beste = p.leadership;
        });
        const wert = beste === null ? 0 : Math.max(-0.6, Math.min(0.9, (beste - 82) * 0.06));
        this._fuehrung[team] = { minute, wert };
        return wert;
    }

    /**
     * Ruhe am Ball (0-1): Technik, Passspiel, Dribbling und Nerven - was
     * einen Spieler unter Druck den Ball behalten lässt.
     */
    ruheAmBall(player) {
        return (this.attr(player, "technique") * 0.45 + this.attr(player, "passing") * 0.3
            + this.attr(player, "dribbling") * 0.1 + this.nerven(player) * 5 * 0.15) / 100;
    }

    /**
     * Technischer Vorsprung einer Mannschaft: Schnitt der Ruhe am Ball ihrer
     * Feldspieler minus den des Gegners. Einmal je Spielminute gerechnet -
     * Wechsel und Platzverweise zählen also mit.
     */
    qualitaetsVorsprung(team) {
        const minute = Math.floor(this.lage(team)?.minute || 0);
        this._vorsprung = this._vorsprung || {};
        const gemerkt = this._vorsprung[team];
        if (gemerkt && gemerkt.minute === minute) return gemerkt.wert;
        const schnitt = (t) => {
            const feld = this.teamOf(t).filter(p => p.pos !== "TW");
            return feld.length ? feld.reduce((summe, p) => summe + this.ruheAmBall(p), 0) / feld.length : 0.7;
        };
        const wert = schnitt(team) - schnitt(team === "home" ? "away" : "home");
        this._vorsprung[team] = { minute, wert };
        return wert;
    }

    /**
     * Geduld einer Mannschaft am Ball (-0.5 bis 0.9): positiv, wer technisch
     * überlegen ist und den Ball laufen lassen kann, negativ, wer unterlegen
     * ist und ihn unter Druck nicht lange hält. Gleich gute Mannschaften
     * liegen bei null - für sie bleibt alles, wie es war.
     */
    geduld(team) {
        if (!this.fm()) return 0;
        return Math.max(MatchFlowEngine.GEDULD_MIN,
            Math.min(MatchFlowEngine.GEDULD_MAX, this.qualitaetsVorsprung(team) * MatchFlowEngine.GEDULD));
    }

    /** Konzentration (1-20): der Kopfwert - ohne ihn Professionalität und Beständigkeit */
    konzentration(player) {
        const k = this.kopf20(player, "concentration");
        if (k !== null) return k;
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
        // Defensiv heißt vorsichtig, nicht rückwärts: Mit 0.24 spielte eine
        // sehr defensive Elf gemessen nur acht Prozent ihrer Pässe nach vorn
        // und hielt den Ball zu achtzig Prozent - Ballgeschiebe vor dem
        // eigenen Tor statt tief stehen und lösen
        else if (mentality === "defensive") { forwardDrive = 0.88; riskAversion = 1.25; }
        else if (mentality === "very_defensive") { forwardDrive = 0.72; riskAversion = 1.6; }

        // Je länger eine Mannschaft den Ball hält, desto entschlossener rückt
        // sie auf - so entstehen echte Angriffszüge statt Dauerquerpässe.
        const chain = Math.min(8, context.chainLength || 0);
        // Der Geduldige rückt mit jeder Station langsamer auf, der
        // Unterlegene schneller
        const geduld = this.geduld(carrier.team);
        forwardDrive *= 1 + chain * 0.07 * (1 - geduld * 0.5);
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

        // Die Anweisungen der Taktik und die Rolle des Ballfuehrenden
        const wk = _flowTaktik()?.wirkung(tactics) || {};

        // Bevorzugte Passlänge - beim Torwart nach der Einstellung "Abstöße"
        const twPasslaenge = carrier.pos === "TW" && wk.torwartKurz ? (wk.torwartKurz > 0 ? 12 : 45) : null;
        const preferred = twPasslaenge || (passing === "short" ? 13 : (passing === "direct" ? 32 : 19));
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
        // Ball sichern: Erst die Form einnehmen, der Ball geht in den freien Fuß.
        // Mit 0.8 und 1.3 spielte die Elf gemessen genauso schnell nach vorn wie ohne Anweisung.
        const sichern = chain <= 3 && wk.konter < 0;
        if (sichern) { progressFaktor *= 0.55; risikoFaktor = 1.6; }
        // Ballannahme: In den Lauf bringt Tiefe und nimmt mehr Risiko in Kauf,
        // in den Fuss spielt sicher
        if ((wk.ballannahme || 0) > 0) { progressFaktor *= 1.1; risikoFaktor *= 0.9; }
        else if ((wk.ballannahme || 0) < 0) { progressFaktor *= 0.93; risikoFaktor *= 1.1; }
        const istTorwart = carrier.pos === "TW";
        const freiheit = wk.freiheit || 1;
        const sicherheit = this.sicherheitsFaktor(tactics, wk);

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

            const laneRisk = this.getLaneRisk(carrier, mate, opponents, istTorwart && dist > MatchFlowEngine.LANG_HOCH.weite);
            const space = this.getSpace(mate, opponents);
            const forward = (mate.x - carrier.x) * dir;

            // Passlänge: nahe an der bevorzugten Distanz ist am besten. Die
            // Toleranz war mit 26 so weit, dass ein Ball über das halbe Feld
            // genauso bewertet wurde wie einer über fünfundzwanzig Meter.
            // Beim Torwart zählt, wie weit der Ball nach vorn geht: Der
            // Außenverteidiger an der Seitenlinie ist in Feldeinheiten weit
            // weg, aber kein langer Ball
            const lengthScore = 1 - Math.min(1, Math.abs((twPasslaenge ? Math.max(0, forward) : dist) - preferred) / 17);

            // Der lange Ball ist die Ausnahme, und der Abschlag muss gegen den
            // Raumgewinn ankommen können. Vorher war er auf 0.75 gedeckelt,
            // während ein weiter Ball nach vorne über den Raumgewinn auf fast
            // vier Punkte kam - jeder fünfte Ball segelte deshalb über
            // sechsunddreißig Meter, in echten Spielen ist es jeder achte.
            // Der Torwart schlägt lang, wenn es die Taktik will (TORWART_LANG):
            // Vorher galt für ihn derselbe Abzug wie für jeden, und auch bei
            // "Abstöße lang" kam gemessen kein Ball über fünfunddreißig Meter.
            const twLang = istTorwart ? MatchFlowEngine.TORWART_LANG[wk.torwartKurz > 0 ? "kurz" : (wk.torwartKurz < 0 ? "lang" : "gemischt")] : 1;
            const longMalus = dist > 24
                ? Math.min(2.4, ((dist - 24) / 15) ** 1.4) * (passing === "direct" ? 0.62 : 1.0) * twLang
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
            // Defensiv lockt der Rückpass nicht - der Ball nach vorn kostet
            // etwas, und mehr, wo der Passweg nicht frei ist
            let mentalScore = forwardDrive >= 1 || forward > 0
                ? richtung * (forwardDrive - 1) * (forwardDrive >= 1 ? 0.75 : 0.75 * (0.45 + 0.55 * Math.min(1, laneRisk * 2.5)))
                : 0;
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
            if ((wk.breite || 0) > 0 && quer > 30) taktikScore += 0.32;
            if ((wk.breite || 0) < 0 && quer < 18) taktikScore += 0.2;
            if (druck > 0.55 && dist > 26) taktikScore += (wk.durchsPressing || 0) * 1.2;
            if (befreien) {
                if (dist > 24 && forward > 12) taktikScore += 0.55;
                else if (forward < 4) taktikScore -= 0.35;
            }
            if (konterZiel && mate.rolleGegen?.konter && forward > 8) taktikScore += 0.6;
            if (istAufbau && forwardDrive < 1 && dist > 26 && forward > 10) taktikScore += (1 - forwardDrive) * 0.6;
            if (istTorwart) {
                // Kurz: Innenverteidiger suchen; lang: weit nach vorn
                if (forward > 30) taktikScore -= (wk.torwartKurz || 0) * 1.2;
                else taktikScore += (wk.torwartKurz || 0) * 0.5;
                // Die bevorzugte Anspielstation des Torwarts
                const bevorzugt = {
                    iv: ["IV"], av: ["AV", "SCH"], sechser: ["DM", "ZM"], fluegel: ["FL", "SCH"], spitze: ["ST"]
                }[wk.torwartZiel];
                if (bevorzugt && bevorzugt.includes(fam)) taktikScore += 0.45;
                // Schnell abgeworfen sucht er den freien Mann vorn für den
                // Gegenstoß, ruhig den sicheren Ball
                if ((wk.torwartSchnell || 0) > 0 && forward > 12 && space > 0.5) taktikScore += 0.35;
                else if ((wk.torwartSchnell || 0) < 0 && forward > 25) taktikScore -= 0.25;
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

            // Herausspielen: Der Ball soll in den Strafraum, nicht davor
            if (istAbschluss && wk.abschluss === "herausspielen" && this.imGegnerStrafraum(mate, carrier.team)) {
                taktikScore += MatchFlowEngine.ABSCHLUSS_TAKTIK.herausspielen * 0.7;
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

            // Geduld: Wer überlegen ist, spielt den sicheren Ball quer oder
            // zurück, bis sich eine Lücke auftut; wer unterlegen ist, meidet
            // ihn. Vor dem Tor gilt das nicht - dort zählt der Abschluss.
            const geduldScore = (geduld !== 0 && !istAbschluss && forward <= 3 && laneRisk < 0.35 && mate.pos !== "TW")
                ? geduld * MatchFlowEngine.GEDULD_QUER * (istAufbau ? 1 : MatchFlowEngine.GEDULD_MITTE)
                : 0;

            // Unter Druck der sichere Ball zum freien Mitspieler - wie gern,
            // sagt die Taktik (sicherheitsFaktor). Nach dem Ballgewinn mit
            // "Ball sichern" auch ohne Druck.
            const sicherScore = (fm && !istAbschluss && (druck > MatchFlowEngine.SICHERHEIT.druck || sichern)
                && laneRisk < 0.3 && space > 0.45 && mate.pos !== "TW") ? MatchFlowEngine.SICHERHEIT.wert * sicherheit : 0;

            // Die Linien der Taktiktafel: Gut verbundene Spieler suchen sich,
            // wo Rollen sich beißen oder ein Neuer noch fremd ist, seltener
            const zusammenScore = this.zusammenspiel(carrier, mate) * MatchFlowEngine.ZUSAMMEN_WAHL;

            const score = lengthScore * 0.8
                + geduldScore
                + sicherScore
                + eigScore
                + zusammenScore
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
     * Wie gern die Elf unter Druck den sicheren Ball spielt (SICHERHEIT):
     * Kurzpassspiel, geduldiges Tempo, defensive Mentalität und Durchspielen
     * mehr, direktes Spiel, hohes Tempo, Offensive und Überspielen weniger.
     */
    sicherheitsFaktor(tactics, wk) {
        const f = 1 + ({ short: 0.3, direct: -0.5 }[tactics.passing] || 0)
            + ({ slow: 0.2, fast: -0.3 }[tactics.tempo] || 0)
            + ({ very_defensive: 0.2, defensive: 0.1, offensive: -0.15, very_offensive: -0.3 }[tactics.mentality] || 0)
            - (wk.durchsPressing || 0) * 1.5;
        return Math.max(0.1, Math.min(1.8, f));
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
            + (frei ? (carrier.group === "def" ? 0.8 : 0.55) : mentalDribbel - MatchFlowEngine.DRIBBEL_DUELL)
            // Im freien Raum gegen den Ball laufen zählt doppelt: Wer weniger
            // dribbeln soll, spielt dort ab, statt den Ball zu treiben -
            // vorher änderte die Anweisung an diesen Läufen kaum etwas
            + taktik + (frei ? (wk.dribbling || 0) : 0)
            // Kreative Freiheit: Der Freie versucht eher etwas, der Disziplinierte spielt ab
            + ((wk.freiheit || 1) - 1) * 0.2
            + eigen
            + _flowRandom.float(-0.2, 0.2) * this.entscheidungsRauschen(carrier);

        return { type: "dribble", target: ahead, space, score, frei };
    }

    /**
     * Abschirmen und wegdrehen: Steht ein Gegner dicht am Ballführenden und
     * ist kein Pass gut, schirmt er den Ball ab und dreht mit ihm vom Gegner
     * weg in den freiesten Raum, meist zur Seite oder zurück. Danach sucht er
     * die nächste Anspielstation. Vorher blieb in dieser Lage nur der
     * Zweikampf: Neun von zehn Entscheidungen fielen unter starkem Druck, und
     * wer dann ins Dribbling ging, hatte im Mittel keinen brauchbaren Pass -
     * der Ball wechselte ständig den Besitzer.
     */
    rateAbdrehen(carrier, opponents, pressure) {
        const a = MatchFlowEngine.ABDREHEN;
        if (!carrier || carrier.pos === "TW" || pressure < a.druck) return null;
        const dribbling = _flowTaktik()?.wirkung(this.getTactics(carrier.team) || {}).dribbling || 0;
        const gegner = opponents.filter(o => o.pos !== "TW")
            .sort((p, q) => this.distance(carrier, p) - this.distance(carrier, q))[0];
        if (!gegner) return null;
        const dx = carrier.x - gegner.x, dy = carrier.y - gegner.y;
        const len = Math.hypot(dx, dy) || 1;
        let bester = null;
        for (const winkel of [0, 0.6, -0.6, 1.1, -1.1]) {
            const c = Math.cos(winkel), s = Math.sin(winkel);
            const ziel = {
                x: carrier.x + (dx * c - dy * s) / len * a.weite,
                y: carrier.y + (dx * s + dy * c) / len * a.weite
            };
            if (ziel.x < 3 || ziel.x > 97 || ziel.y < 3 || ziel.y > 97) continue;
            const raum = this.getSpace(ziel, opponents);
            if (!bester || raum > bester.raum) bester = { ziel, raum };
        }
        if (!bester) return null;
        const ruhe = (this.attr(carrier, "technique") + this.attr(carrier, "dribbling")) / 200;
        const koerper = (this.fein(carrier, "strength") + this.fein(carrier, "balance")) * 0.004;
        const score = a.basis + ruhe * 0.4 + koerper + bester.raum * a.raum - pressure * 0.15 + dribbling * 0.5
            + _flowRandom.float(-0.15, 0.15) * this.entscheidungsRauschen(carrier);
        return { type: "dribble", abdrehen: true, target: bester.ziel, space: bester.raum, score, frei: false };
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
    // Im Vorbild ist das Spiel die Simulation: Jeder Ballfuehrende
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
    abschlussWert(p, kopfball = false, fern = false) {
        if (kopfball) {
            return this.attr(p, "physical") * 0.45 + this.attr(p, "positioning") * 0.25
                + this.attr(p, "shooting") * 0.3 + (this.eig(p).luft || 0) * 0.6 + this.fein(p, "heading") * 0.6;
        }
        // Im Strafraum zählt der Abschluss, von weiter weg der Distanzschuss
        return this.attr(p, "shooting") * 0.65 + this.attr(p, "technique") * 0.35
            + this.fein(p, fern ? "longShots" : "finishing") * 0.65;
    }

    /** Torwartstaerke - im Eins-gegen-eins zaehlt das Herauslaufen mehr */
    torwartWert(gk, nah = false) {
        if (!gk) return 40;
        return this.attr(gk, "reflexes", 60) * 0.4 + this.attr(gk, "handling", 60) * 0.2
            + this.attr(gk, "positioning", 60) * 0.2 + this.attr(gk, "oneOnOne", 60) * (nah ? 0.3 : 0.2)
            + (nah ? this.fein(gk, "rushingOut") * 0.3 : 0);
    }

    /** Wie gut ein Spieler in der Luft ist */
    kopfballWert(p, angreifer = true) {
        const e = this.eig(p);
        const basis = angreifer
            ? this.attr(p, "physical") * 0.55 + this.attr(p, "positioning") * 0.25 + this.attr(p, "technique") * 0.1 + this.attr(p, "pace") * 0.1
            : this.attr(p, "physical") * 0.55 + this.attr(p, "defense") * 0.25 + this.attr(p, "positioning") * 0.2;
        // Größe zählt in der Luft: zehn Zentimeter sind gut fünf Punkte
        const groesse = typeof p.groesse === "number" ? (p.groesse - 181) * 0.55 : 0;
        // Dazu Kopfball und Sprungkraft - beim Verteidiger auch die
        // Manndeckung, bei beiden der Mut, dorthin zu gehen, wo es wehtut
        const detail = (angreifer
            ? this.fein(p, "heading") * 0.55 + this.fein(p, "jumpingReach") * 0.3
            : this.fein(p, "heading") * 0.35 + this.fein(p, "jumpingReach") * 0.35 + this.fein(p, "marking") * 0.2)
            + this.fein(p, "bravery") * 0.15;
        return basis + groesse + detail + (e.luft || 0) + (angreifer ? (e.strafraum || 0) * 5 : 0);
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
        // Auf den schwachen Fuß gedrängt: Er muss öfter mit dem anderen ran
        const gedraengt = this.anweisung(schuetze.id)?.fuss === "schwach" ? 0.15 : 0;
        return _flowRandom.chance(cfg.basis + gedraengt + (falscheSeite && spitz ? cfg.falscheSeite : 0));
    }

    /** Gegneranweisung "hart angehen" (+1) oder "nicht einsteigen" (-1) gegen diesen Spieler */
    anweisungsHaerte(spieler) {
        const z = spieler ? this.anweisung(spieler.id)?.zweikampf : null;
        return z === "hart" ? 1 : (z === "vorsichtig" ? -1 : 0);
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
        const at = MatchFlowEngine.ABSCHLUSS_TAKTIK;
        const weitschuss = wk.weitschuesse || 0;
        const geduld = wk.abschluss === "herausspielen" ? -1 : (wk.abschluss === "weitschuss" ? 1 : 0);
        const reichweite = 25 + (e.distanz ? 9 : 0) + weitschuss * at.reichweite + (e.nachInnen ? 3 : 0) + (geduld > 0 ? 3 : 0);
        if (g.dist > reichweite || g.winkel < 0.1) return null;

        const q = this.chancenQualitaet(carrier, opponents);
        const koennen = this.abschlussWert(carrier, false, g.dist > 18) / 100;
        // Wie sehr er sich den Abschluss zutraut
        const zutrauen = 0.7 + koennen * 0.55 + (e.abschluss || 0) * 2 + (e.ruhe ? 0.08 : 0)
            + (carrier.group === "att" ? 0.12 : carrier.group === "def" ? -0.2 : 0);
        let score = -0.12 + q.xg * 13 * zutrauen;
        // Im vollen Strafraum sucht er eher den Mitspieler als die Lücke
        if (this.imGegnerStrafraum(carrier, carrier.team)) score -= this.strafraumDichte(carrier.team) * 0.12;
        // Aus der Distanz schiesst, wer es kann oder soll - die anderen suchen
        // lieber den Weg in den Strafraum
        if (g.dist > 18) score += (e.distanz ? 0.55 : -0.2) + (e.abschlussDistanz || 0) * 5 + weitschuss * at.weit;
        // Geduld: die halbe Chance von außerhalb des Strafraums
        if (geduld && (q.xg < at.halbeChance || !this.imGegnerStrafraum(carrier, carrier.team))) {
            score += geduld > 0 ? at.frueh : -at.herausspielen;
        }
        score += MatchFlowEngine.MENTAL_SCHUSS[tactics.mentality] || 0;
        score += _flowRandom.float(-0.2, 0.2) * this.entscheidungsRauschen(carrier);
        // Mit dem schwachen Fuß traut er sich weniger zu
        const schwach = this.fm() ? this.schwacherFuss(carrier) : false;
        if (schwach) score -= 0.15;
        if (this.mitPhysik()) score += MatchFlowEngine.EICHUNG.schussLust;
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
                return { ausgang: "blocked", xg: q.xg, gk, blocker, ecke: _flowRandom.chance(MatchFlowEngine.EICHUNG.ecke.block * this.standardsHolen(schuetze, "ecke")) };
            }
        }

        const abschluss = opts.freistoss
            ? this.attr(schuetze, "shooting") * 0.45 + this.attr(schuetze, "technique") * 0.55 + this.fein(schuetze, "freeKicks")
            : opts.elfmeter
                ? this.attr(schuetze, "shooting") * 0.6 + this.attr(schuetze, "technique") * 0.4 + this.fein(schuetze, "penalties")
                : this.abschlussWert(schuetze, !!opts.kopfball, (q.dist || 0) > 18);
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
        // Stufe 5: Mit der Ballphysik fielen 2,65 statt rund drei Tore je Spiel
        if (!opts.elfmeter && this.mitPhysik()) pTor *= MatchFlowEngine.EICHUNG.tore;
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
        const abgefaelscht = !opts.elfmeter && !opts.freistoss && q.block > 0.2 && _flowRandom.chance(MatchFlowEngine.EICHUNG.ecke.abgefaelscht * this.standardsHolen(schuetze, "ecke"));
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
        const wk = _flowTaktik()?.wirkung(tactics) || {};
        const ft = MatchFlowEngine.FLANKEN_TAKTIK;
        // Früh flanken: schon aus dem Halbfeld, nicht erst am Strafraum
        if (progress < (wk.flanken === "frueh" ? ft.fruehAb : 0.68) || Math.abs(carrier.y - 50) < 19) return null;

        const tor = this.gegnerTor(carrier.team);
        // Wer früh flankt, flankt auch auf die, die erst in den Strafraum laufen
        const vorTor = wk.flanken === "frueh" ? ft.fruehRaum : 17;
        const imStrafraum = mates.filter(m => m.pos !== "TW"
            && Math.abs(m.x - tor.x) < vorTor && Math.abs(m.y - 50) < 22);
        if (!imStrafraum.length) return null;

        const e = this.eig(carrier);
        const koennen = (this.attr(carrier, "passing") * 0.55 + this.attr(carrier, "technique") * 0.45 + this.fein(carrier, "crossing")) / 100;
        const amGrundlinie = Math.abs(carrier.x - tor.x) < 12;
        let taktik = 0;
        if (wk.flanken === "frueh") taktik += ft.frueh;
        else if (wk.flanken === "wenig") taktik += ft.wenig;
        else if (wk.flanken === "grundlinie") taktik += amGrundlinie ? ft.grundlinie : ft.vorGrundlinie;

        // Wer Flanken verhindern soll, stellt den Flankenlauf zu; wer sie
        // zulässt, lässt ihn gewähren (siehe selectPressingPlayers)
        const gegnerWehr = _flowTaktik()?.wirkung(this.getTactics(carrier.team === "home" ? "away" : "home") || {}).flankenVerhindern || 0;
        const score = 0.45 + koennen * 1.1 + Math.min(3, imStrafraum.length) * 0.3
            + (e.flankeWille || 0) + taktik - pressure * 0.2 - gegnerWehr * ft.gegnerWehr
            + (this.mitPhysik() ? MatchFlowEngine.EICHUNG.flankenLust : 0)
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

        // Die Hereingabe: Flanken aus dem Spiel, Ecken vom Eckenspezialisten
        let qualitaet = (this.attr(carrier, "passing") * 0.55 + this.attr(carrier, "technique") * 0.45
            + this.fein(carrier, opts.ecke ? "corners" : "crossing")) / 100
            + (e.flankeKoennen || 0) - pressure * 0.1;
        if ((opts.ecke || opts.standard) && e.eckenQualitaet) qualitaet += 0.08;

        if (!ziele.length) {
            // Niemand im Strafraum: Die Hereingabe landet beim Gegner
            const punkt = { x: tor.x - dir * 9, y: 50 + _flowRandom.float(-10, 10) };
            return { ...basis, outcome: "cleared", landung: punkt, to: punkt, verteidiger: null, eckeFolgt: false };
        }

        // Ziel ist der Beste in der Luft - die flache Hereingabe sucht den,
        // der am nächsten am Elfmeterpunkt einläuft
        const art = (opts.ecke || opts.standard) ? null
            : (_flowTaktik()?.wirkung(this.getTactics(team) || {}).flankenart || "gemischt");
        const elfer = { x: tor.x - dir * 9, y: 50 };
        const ziel = art === "flach"
            ? ziele.slice().sort((a, b) => this.distance(a, elfer) - this.distance(b, elfer))[0]
            : ziele.slice().sort((a, b) => this.kopfballWert(b) - this.kopfballWert(a))[0];
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

        if (this.mitPhysik()) {
            return this.resolveCrossPhysik(carrier, opts, basis, { qualitaet, ziel, landung, deckung, variante, art });
        }

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
            const pFangen = Math.min(0.6, ((this.attr(gk, "handling", 60) + this.attr(gk, "positioning", 60)
                + this.fein(gk, "aerialReach") + this.fein(gk, "commandOfArea")) / 330
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
     * Stufe 1 der 2D-Simulation: Die Flanke wird geschlagen, nicht gewürfelt.
     *
     * Der Ball fliegt mit einer Streuung aus der Qualität der Hereingabe zum
     * geplanten Punkt. Wer zuerst unter ihm ist, zählt (BallPhysik.wettlauf):
     * Der Torwart kommt im Strafraum mit den Händen höher, Kopfbälle reichen
     * so hoch, wie einer springt. Sind Angreifer und Verteidiger fast
     * gleichzeitig dort, entscheidet das Kopfballduell - mit einem Vorteil für
     * den, der früher da ist. Was keiner erreicht, geht ins Aus oder springt
     * auf und wird zum zweiten Ball.
     */
    static FLANKE_DUELL = 0.3;     // so knapp hintereinander geht es ins Duell (Laufzeit-Sekunden)
    /** Streuung der Hereingabe in Einheiten: Grundwert und Zuschlag je fehlender Qualität */
    static FLANKE_STREUUNG = { basis: 1.0, je: 6 };
    // Flankenart (resolveCrossPhysik): Scheitelhöhe in Metern und Tempo,
    // je [min, max, Grundwert, je Einheit Weite]
    static FLANKEN_ART = {
        flach: { hoehe: [0.9, 1.3, 0.8, 0.01], tempo: [20, 28, 19, 0.25] },
        hoch: { hoehe: [6, 9.5, 4, 0.14], tempo: [13, 18, 12, 0.12] }
    };

    resolveCrossPhysik(carrier, opts, basis, plan) {
        const P = _flowPhysik();
        const team = carrier.team;
        const dir = this.attackDir(team);
        const tor = this.gegnerTor(team);
        const { qualitaet, deckung, variante, art } = plan;
        const holen = (opts.ecke || opts.standard) ? 1 : this.standardsHolen(carrier, "ecke");

        // Die Hereingabe streut: zu kurz, zu lang, zu nah an den Torwart
        const streu = MatchFlowEngine.FLANKE_STREUUNG.basis + Math.max(0, 0.95 - qualitaet) * MatchFlowEngine.FLANKE_STREUUNG.je;
        const landung = {
            x: plan.landung.x + _flowRandom.gaussian(0, streu),
            y: plan.landung.y + _flowRandom.gaussian(0, streu * 1.2)
        };
        const start = this.abspielPunkt(carrier);
        const weite = Math.max(4, Math.hypot(landung.x - start.x, landung.y - start.y));
        const winkel = Math.atan2(landung.y - start.y, landung.x - start.x);
        // Scharf an den ersten Pfosten kommt sie flacher; eine Flanke ist ein
        // Ball in Kopfhöhe, keine Kerze. Die Flankenart der Taktik: flach und
        // scharf unter Kniehöhe - angenommen wird sie mit dem Fuß -, hoch und
        // weich für die Kopfballspieler. Vorher galt sie nur in der Zeitleiste.
        const fa = MatchFlowEngine.FLANKEN_ART[art] || null;
        const hoehe = fa ? Math.max(fa.hoehe[0], Math.min(fa.hoehe[1], fa.hoehe[2] + weite * fa.hoehe[3]))
            : (variante === "ersterPfosten" ? 3.2 : Math.max(3, Math.min(7, 2.5 + weite * 0.09)));
        const tempo = fa ? Math.max(fa.tempo[0], Math.min(fa.tempo[1], fa.tempo[2] + weite * fa.tempo[3]))
            : Math.max(16, Math.min(24, 15 + weite * 0.18));
        const bahn = P.hoch(start, winkel, weite, { hoehe, tempo, aufprall: art === "flach" ? 0.6 : 0.35 });

        // Wer im Strafraum auf die Flanke geht, weiß, dass sie kommt; in
        // Manndeckung klebt der Verteidiger an seinem Mann
        const mannDeckung = deckung === "mann" || (deckung === "gemischt" && _flowRandom.chance(0.5));
        const imStrafraum = (q) => Math.abs(q.x - tor.x) < 18 && Math.abs(q.y - 50) < 24;
        const reaktion = (p) => {
            if (p.team === team) return imStrafraum(p) ? 0.08 : (p.reaktion ?? 0.3) + 0.1;
            if (p.pos === "TW") {
                const ruhig = (this.attr(p, "positioning", 60) - 60) / 400 + this.fein(p, "commandOfArea") * 0.01;
                const voll = (opts.ecke || opts.standard) ? MatchFlowEngine.EICHUNG.standard.twReaktion : 0;
                return Math.max(0.1, 0.3 + voll - ruhig - (this.eig(p).twStrafraum || 0) * 0.1);
            }
            return Math.max(0.08, (p.reaktion ?? 0.3) * (mannDeckung ? 0.6 : 0.9));
        };
        const { reihenfolge, aus } = this.ballRennen(bahn, [carrier.id], reaktion);
        const physik = { bahn, art: "hoch" };
        if (!reihenfolge.length) {
            const ende = aus ? aus.punkt : P.punkt(bahn, bahn.ruhe);
            return { ...basis, outcome: "out", landung: ende, to: ende, physik: { ...physik, t: aus ? aus.t : bahn.ruhe, punkt: ende } };
        }
        const erster = reihenfolge[0];
        const fenster = erster.t + MatchFlowEngine.FLANKE_DUELL;
        const angreifer = reihenfolge.find(e => e.p.team === team && e.p.pos !== "TW" && e.t <= fenster) || null;
        const verteidiger = reihenfolge.find(e => e.p.team !== team && e.p.pos !== "TW" && e.t <= fenster) || null;
        const gk = reihenfolge.find(e => e.p.team !== team && e.p.pos === "TW" && e.t <= fenster) || null;
        const treffen = (e) => Object.assign(physik, { t: e.t, punkt: e.punkt, h: e.h, jaeger: [e.p.id] });
        const klaerung = (von) => ({
            x: tor.x - dir * _flowRandom.float(14, 24),
            y: Math.max(12, Math.min(88, von.y + _flowRandom.float(-15, 15)))
        });

        // Der Torwart ist vor den Angreifern da: Er fängt oder faustet
        if (gk && (!angreifer || gk.t <= angreifer.t)) {
            treffen(gk);
            const p = gk.p;
            const varianteFangen = variante === "ersterPfosten" ? 0.6 : (variante === "zweiterPfosten" ? 1.1 : 1);
            const pFangen = Math.max(0.3, Math.min(0.9, ((this.attr(p, "handling", 60) + this.attr(p, "positioning", 60)
                + this.fein(p, "aerialReach") + this.fein(p, "commandOfArea")) / 175 - 0.05
                + (this.eig(p).twStrafraum || 0) * 0.15) * varianteFangen - (angreifer ? 0.15 : 0)));
            if (_flowRandom.chance(pFangen)) return { ...basis, outcome: "claimed", landung: gk.punkt, to: gk.punkt, gk: p, physik };
            return { ...basis, outcome: "cleared", verteidiger: p, landung: gk.punkt, to: klaerung(gk.punkt), eckeFolgt: _flowRandom.chance(MatchFlowEngine.EICHUNG.ecke.faust * holen), physik };
        }

        // Kopfballduell, wenn beide fast gleichzeitig unter dem Ball sind
        let angreiferGewinnt = !!angreifer && !verteidiger;
        if (angreifer && verteidiger) {
            const zone = !mannDeckung && deckung && variante === "ersterPfosten" ? 5 : 0;
            const angriff = this.kopfballWert(angreifer.p, true) + qualitaet * 8
                + ((opts.ecke || opts.standard) ? MatchFlowEngine.EICHUNG.standard.kopfball : 0);
            const abwehr = this.kopfballWert(verteidiger.p, false) + zone;
            const vorsprung = (verteidiger.t - angreifer.t) * 25;
            const pKopf = Math.max(0.1, Math.min(0.85, 1 / (1 + Math.exp(-(angriff - abwehr + vorsprung - 6) / 9))));
            angreiferGewinnt = _flowRandom.chance(pKopf);
            physik.duell = [angreifer.p.id, verteidiger.p.id];
        }

        if (angreiferGewinnt) {
            treffen(angreifer);
            if (angreifer.p.id !== undefined && verteidiger) physik.jaeger.push(verteidiger.p.id);
            const nahAmTor = Math.abs(angreifer.punkt.x - tor.x) < 15 && Math.abs(angreifer.punkt.y - 50) < 18;
            if (!nahAmTor) {
                // Zu weit vom Tor für einen Abschluss: Er nimmt den Ball an
                return { ...basis, outcome: "gehalten", landung: angreifer.punkt, to: angreifer.punkt, annehmer: angreifer.p, physik };
            }
            return {
                ...basis, outcome: "header", landung: angreifer.punkt, to: angreifer.punkt,
                kopfballer: angreifer.p, verteidiger: verteidiger ? verteidiger.p : null,
                kopfball: angreifer.h > P.ANNAHME_HOEHE, physik
            };
        }
        const wer = verteidiger || erster;
        treffen(wer);
        if (angreifer) physik.jaeger.push(angreifer.p.id);
        return {
            ...basis, outcome: "cleared", verteidiger: wer.p.team !== team ? wer.p : null, landung: wer.punkt,
            to: klaerung(wer.punkt), eckeFolgt: wer.h > P.ANNAHME_HOEHE && _flowRandom.chance(MatchFlowEngine.EICHUNG.ecke.kopfball * holen), physik
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
        const imStrafraum = Math.abs(tor.x - carrier.x) < 16.5 && Math.abs(carrier.y - 50) < 30;
        return imStrafraum ? (this.mitPhysik() ? MatchFlowEngine.EICHUNG.foul.strafraum : 0.2) : 1;
    }

    /** Faktor für "Standards herausholen" in der gegnerischen Hälfte (siehe STANDARDS_HOLEN) */
    standardsHolen(spieler, art) {
        if (!spieler || !_flowTaktik()?.wirkung(this.getTactics(spieler.team) || {}).standards) return 1;
        const fortschritt = (spieler.x - this.ownGoalX(spieler.team)) * this.attackDir(spieler.team) / 92;
        return fortschritt > 0.5 ? MatchFlowEngine.STANDARDS_HOLEN[art] : 1;
    }

    /**
     * Der Pressingspieler geht dazwischen (siehe ZUGRIFF): Ballverlust, Foul
     * oder nichts. Liefert eine Aktion wie ein verlorenes Dribbling.
     */
    zugriff(carrier, verteidiger, intensitaet = 0) {
        const z = MatchFlowEngine.ZUGRIFF;
        if (!carrier || !verteidiger || carrier.pos === "TW") return null;
        const halten = (this.attr(carrier, "technique") + this.attr(carrier, "dribbling")) / 200
            + (this.fein(carrier, "strength") + this.fein(carrier, "balance") + this.fein(carrier, "composure")) * 0.003;
        const gegen = this.attr(verteidiger, "defense") / 100
            + (this.fein(verteidiger, "tackling") + this.fein(verteidiger, "aggression")) * 0.003;
        const haerte = (_flowTaktik()?.wirkung(this.getTactics(verteidiger.team) || {}).zweikampf || 0) + this.anweisungsHaerte(carrier);
        const p = Math.max(z.min, Math.min(z.max, z.basis + intensitaet + (gegen - halten) * z.wert + haerte * z.haerte));
        if (!_flowRandom.chance(p)) return null;
        const pressure = this.getPressure(carrier, this.opponentsOf(carrier.team));
        if (this.fm()) {
            const foul = this.foulImZweikampf(carrier, verteidiger, haerte, (halten - gegen) * 100, z.foul);
            if (foul) return { ...foul, pressure, zugriff: true };
        }
        return { type: "dribble", outcome: "tackled", from: carrier, to: { x: carrier.x, y: carrier.y }, defender: verteidiger, pressure, zugriff: true };
    }

    foulImZweikampf(carrier, defender, haerte = 0, edge = 0, faktor = 1) {
        const ed = this.eig(defender);
        const ea = this.eig(carrier);
        // Die Aggressivität enthält das Temperament (2,2 Punkte je Stufe) und
        // dazu, was den Spieler sonst ausmacht. Ohne Detailwerte zählt das
        // Temperament allein - im Mittel dasselbe.
        const aggressiv = (defender.fein
            ? this.fein(defender, "aggression") * 0.0055
            : ((typeof defender.temperament === "number" ? defender.temperament : 12) - 12) * 0.012)
            + (defender.zuruf?.plus?.aggression || 0) * 0.0055;
        const p = 0.27 + haerte * 0.06 + (ed.haerte || 0) * 0.1 + (ea.ziehtFouls || 0)
            + aggressiv + Math.max(0, edge) / 400;
        const pfeife = this.schiri()?.pfeife || 1;
        // Auf rutschigem Boden kommt der Verteidiger öfter zu spät
        const rutschig = 1 + (this.wetter()?.rutschig || 0) * 0.5;
        const eich = this.mitPhysik() ? MatchFlowEngine.EICHUNG.foul.zweikampf : 1;
        if (!_flowRandom.chance(Math.max(0.03, Math.min(0.45, p * rutschig)) * pfeife * eich * this.strafraumVorsicht(carrier)
            * this.standardsHolen(carrier, "foul") * faktor)) return null;
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
        const haerte = (_flowTaktik()?.wirkung(this.getTactics(naechster.team) || {}).zweikampf || 0) + this.anweisungsHaerte(carrier);
        const p = (pressure - 0.6) * 0.085 * (1 + haerte * 0.4 + (ed.haerte || 0) * 0.5 + (ed.pressing || 0) * 0.3);
        const eich = this.mitPhysik() ? MatchFlowEngine.EICHUNG.foul.druck : 1;
        if (!_flowRandom.chance(p * (this.schiri()?.pfeife || 1) * eich * this.strafraumVorsicht(carrier)
            * this.standardsHolen(carrier, "foul"))) return null;
        return { type: "foul", outcome: "foul", from: carrier, to: { x: carrier.x, y: carrier.y }, foulender: naechster, opfer: carrier, pressure, phase };
    }

    /**
     * Stufe 2 der 2D-Simulation: Was der Ballführende sieht, während er den
     * Ball hat - im Takt von etwa einer Viertelsekunde, nicht erst, wenn die
     * Annahme vorbei ist.
     *
     * - gelegenheit: Jetzt spielen. Ein Mitspieler ist vorn in den freien
     *   Raum gestartet und der Passweg offen, eine Torchance ist da, oder er
     *   steht so unter Druck, dass er den sicheren Ball direkt spielt.
     * - absicht: Wen er gerade anspielen würde - das liest, wer vorausahnt.
     * - tragen: Freier Raum vor ihm, er läuft mit dem Ball hinein.
     * - kopfHoch: Er hat Zeit und schaut nach vorn - der Moment für die Läufe
     *   in die Tiefe.
     */
    lageAmBall(carrier, ctx = {}) {
        if (!carrier) return null;
        const team = carrier.team;
        const dir = this.attackDir(team);
        const tactics = this.getTactics(team) || {};
        const mates = this.teamOf(team).filter(p => p.id !== carrier.id && p.pos !== "TW");
        const opponents = this.opponentsOf(team);
        const pressure = this.getPressure(carrier, opponents);
        const phase = this.derivePhase(carrier, team);
        const optionen = this.ratePassOptions(carrier, mates, opponents, tactics, {
            phase, pressure, chainLength: ctx.chainLength || 0
        }).sort((a, b) => b.score - a.score);
        const beste = optionen[0] || null;
        const m = MatchFlowEngine.MOMENT;
        const zeit = ctx.zeitAmBall || 0;
        // Tempo und Zeitspiel (ctx.takt, über 1 = geduldiger): Bei hohem Tempo
        // kommt der Steilpass früher und der Ball unter Druck schneller weg,
        // geduldig und auf Zeit wartet er länger. Vorher wirkte das Tempo nur
        // auf die Annahme - und die endet meist mit so einem Moment: Gemessen
        // blieb der Ball bei hohem Tempo nur fünf Prozent kürzer am Fuß.
        const takt = ctx.takt || 1;
        const steilSchwelle = m.steil * (1 + (takt - 1) * MatchFlowEngine.TAKT_MOMENT.steil);
        const druckSchwelle = m.druck * (1 + (takt - 1) * MatchFlowEngine.TAKT_MOMENT.druck);

        let gelegenheit = null;
        const steil = optionen.find(o => o.forward > m.vorn && o.laneRisk < m.weg && o.space > m.raum && o.target.pos !== "TW");
        if (steil && steil.score >= steilSchwelle - zeit * m.nachlass) gelegenheit = "steil";
        if (!gelegenheit && this.fm() && carrier.pos !== "TW") {
            const g = this.torGeometrie(carrier, team);
            // Wer früh abschließen soll, sieht den Moment eher, wer herausspielt, später
            const geduld = (_flowTaktik()?.wirkung(tactics) || {}).abschluss;
            const schwelle = m.schuss * (geduld === "weitschuss" ? 0.7 : (geduld === "herausspielen" ? 1.3 : 1));
            if (g.dist < 22 && this.chancenQualitaet(carrier, opponents).xg >= schwelle) gelegenheit = "schuss";
        }
        if (!gelegenheit && pressure > druckSchwelle && beste && beste.laneRisk < m.weg) gelegenheit = "druck";

        const fortschritt = dir > 0 ? carrier.x / 100 : 1 - carrier.x / 100;
        // So weit in den freien Raum, wie Ziel und Weg frei sind
        const t = MatchFlowEngine.TRAGEN;
        const lust = Math.sign(_flowTaktik()?.wirkung(tactics).dribbling || 0);
        const raumNoetig = t.raum + (lust < 0 ? t.weniger : (lust > 0 ? -t.mehr : 0));
        let vor = null;
        if (carrier.pos !== "TW" && pressure < t.druck && fortschritt < 0.85) {
            for (const weite of (lust < 0 ? t.weiten.slice(1) : t.weiten)) {
                const punkt = { x: carrier.x + dir * weite, y: carrier.y + (50 - carrier.y) * 0.01 * weite };
                const mitte = { x: (carrier.x + punkt.x) / 2, y: (carrier.y + punkt.y) / 2 };
                const fort = dir > 0 ? punkt.x / 100 : 1 - punkt.x / 100;
                if (fort > 0.9) continue;
                if (this.getSpace(punkt, opponents) > raumNoetig && (weite <= 7 || this.getSpace(mitte, opponents) > raumNoetig)) { vor = punkt; break; }
            }
        }
        const ziel = (gelegenheit && steil) ? steil : beste;
        return {
            gelegenheit,
            absicht: ziel ? { id: ziel.target.id, x: ziel.target.x, y: ziel.target.y } : null,
            tragen: vor,
            kopfHoch: pressure < 0.4 && fortschritt > 0.3,
            pressure
        };
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
        const abdrehen = this.rateAbdrehen(carrier, opponents, pressure);
        if (abdrehen) candidates.push(abdrehen);

        // FM-Modus: Abschluss und Flanke stehen gleichberechtigt neben dem
        // Zuspiel. Ob einer schiesst, haengt an der Lage und an seinen Werten.
        if (this.fm()) {
            const schuss = this.rateShot(carrier, opponents, tactics, pressure);
            if (schuss) candidates.push(schuss);
            const flanke = this.rateCross(carrier, mates, opponents, tactics, pressure);
            if (flanke) candidates.push(flanke);

            // Unter hohem Druck wird der Ballfuehrende auch mal umgerissen -
            // es sei denn, er spielt den Ball direkt, bevor der Gegner da ist
            if (!options.direkt) {
                const foul = this.pruefeDruckFoul(carrier, opponents, pressure, phase);
                if (foul) return foul;
            }
        }

        candidates.sort((a, b) => b.score - a.score);

        let best = candidates[0] || null;

        // Der Befreiungsschlag ist kein gleichberechtigter Vorschlag, sondern
        // die Reißleine. Als Kandidat unter Kandidaten hat er fast jede zweite
        // Aktion gewonnen - das Ergebnis war ein Spiel aus langen Bällen, von
        // denen nur die Hälfte ankam.
        // Der Kompromisslose schlaegt den Ball schon bei weniger Druck weg
        const sicher = carrier.rolleMit?.sicher || 0;
        // Weggeschlagen wird in der eigenen Hälfte. Weiter vorn spielt der
        // Bedrängte den besten Ball, den er hat, auch quer oder zurück - sonst
        // endete fast jede Passfolge im Mittelfeld mit einem langen Ball ins
        // Nichts, sobald ein Gegner kam.
        const eigeneHaelfte = (this.attackDir(team) > 0 ? carrier.x : 100 - carrier.x) < 50;
        if (!best || (eigeneHaelfte && pressure > 0.6 - sicher && best.score < 0.5 + sicher)) {
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
        const isLong = action.type === "clearance" || action.dist > MatchFlowEngine.LANG_HOCH.weite;
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
                // Wer den Pass vorausahnt, steht schon im Weg
                const gegner = (typeof bedraenger.anticipation === "number"
                    ? this.attr(bedraenger, "defense") * 0.45 + this.attr(bedraenger, "positioning", 60) * 0.2
                        + this.attr(bedraenger, "anticipation") * 0.2 + this.attr(bedraenger, "pace") * 0.15
                    : this.attr(bedraenger, "defense") * 0.5 + this.attr(bedraenger, "positioning", 60) * 0.3
                        + this.attr(bedraenger, "pace") * 0.2) / 100;
                accuracy += (skill - gegner) * 0.22 * Math.min(1, pressure + 0.3);
            }
            accuracy += (skill - 0.72) * 0.12;
        }
        accuracy += eg.passKoennen || 0;
        // Teamwork: Wer füreinander spielt, findet sich blind
        if (this.fm() && typeof carrier.teamwork === "number" && typeof action.target?.teamwork === "number") {
            accuracy += ((this.attr(carrier, "teamwork") + this.attr(action.target, "teamwork")) / 2 - 72) * 0.0008;
        }
        // Konzentration: In der Schlussphase unterlaufen dem Unkonzentrierten
        // mehr Fehler, der Profi bleibt bei der Sache
        if (this.fm() && carrier.mental && (this.lage(carrier.team)?.minute || 0) >= 75) {
            accuracy += (this.konzentration(carrier) - 12) * 0.003;
        }
        // Wer druckfest ist, spielt auch bedraengt sauber
        accuracy -= pressure * 0.11 * (1 - Math.min(0.7, (eg.druckfest || 0) * 0.5));
        // Mit Ballphysik entscheidet die Geometrie, ob der Passweg zu ist
        const geometrisch = this.mitPhysik();
        if (!geometrisch) accuracy -= (action.laneRisk || 0) * 0.17;
        // Pässe in einen vollen Strafraum werden eher abgefangen
        const passZiel = action.target || action.to;
        if (!geometrisch && passZiel && this.imGegnerStrafraum(passZiel, carrier.team)) {
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

        if (geometrisch && action.target) {
            return this.resolvePassPhysik(carrier, action, opponents, tactics, pressure, phase, accuracy, isLong);
        }

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
        // Ein Abwehrchef liest den Pass und faengt ihn eher ab - und wer
        // vorausahnt, ist früher am Ball
        const abfangen = this.fm() && interceptor ? (this.eig(interceptor).abfangen || 0) : 0;
        const ahnung = this.fm() && interceptor && typeof interceptor.anticipation === "number"
            ? (this.attr(interceptor, "anticipation") - 74) / 100 * 0.25 : 0;

        if (interceptor && roll < 0.55 + abfangen * 0.3 + ahnung) {
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

    /** Ballphysik eingeschaltet - und geladen? */
    mitPhysik() {
        return this.fm() && this.physik() && !!_flowPhysik();
    }

    /** Liegt ein Punkt im Strafraum vor dem eigenen Tor der Mannschaft? */
    imEigenenStrafraum(punkt, team) {
        return Math.abs(punkt.x - this.ownGoalX(team)) < 16.5 && Math.abs(punkt.y - 50) < 22;
    }

    /**
     * Wo die Flugbahn beginnt: am Ball. Auch wenn der Spieler noch nicht ganz
     * bei ihm ist - sonst spränge der Ball beim Abspiel zum Spieler.
     */
    abspielPunkt(carrier) {
        const ball = this.getBall();
        const p = ball && typeof ball.x === "number" ? { x: ball.x, y: ball.y } : { x: carrier.x, y: carrier.y };
        // Am Fuß eines Spielers an der Grundlinie liegt der Ball rechnerisch
        // oft knapp dahinter - gespielt wird er aber im Feld. Ohne diese
        // Grenze galten zwei von drei Flanken von der Grundlinie sofort als Aus.
        const l = _flowPhysik()?.LINIEN || { x0: 3.2, x1: 96.8, y0: 1.5, y1: 98.5 };
        return {
            x: Math.max(l.x0 + 0.4, Math.min(l.x1 - 0.4, p.x)),
            y: Math.max(l.y0 + 0.4, Math.min(l.y1 - 0.4, p.y))
        };
    }

    /**
     * Der Wettlauf zum Ball mit den Regeln des Spiels: Der Torwart kommt nur
     * im eigenen Strafraum heraus und nimmt dort die Hände.
     */
    ballRennen(bahn, ohne, reaktion) {
        const P = _flowPhysik();
        const alle = this.getPlayers().filter(p => p && !ohne.includes(p.id));
        return P.wettlauf(bahn, alle, {
            reaktion,
            radius: p => (p.pos === "TW" ? P.RADIUS_TW : P.RADIUS),
            reichweite: p => P.reichweite(p, p.pos === "TW"),
            darf: (p, q) => p.pos !== "TW" || this.imEigenenStrafraum(q, p.team)
        });
    }

    /**
     * Stufe 1 der 2D-Simulation: Der Pass wird gespielt, nicht gewürfelt.
     *
     * Der Passgeber spielt den Ball mit Richtung und Tempo auf den
     * Mitspieler - in den Lauf vor ihn, wenn er schon unterwegs ist -, mit
     * einer Streuung aus seiner Genauigkeit. Lange Bälle gehen hoch. Dann
     * entscheidet der Wettlauf (BallPhysik.wettlauf), wer zuerst dran ist:
     * Der Angespielte kommt dem Ball entgegen, ein Gegner, der den Pass
     * liest, geht dazwischen, ein verunglückter Ball landet beim Nächsten
     * oder im Aus. Ein scharfer, hoher oder bedrängter Ball springt bei der
     * Annahme weg.
     *
     * Liefert dieselben Ausgänge wie resolvePass, dazu physik: die Bahn, den
     * Zeitpunkt (Laufzeit-Sekunden) und den Punkt, an dem der Ball
     * erreicht wird - die Regie spielt genau diese Bahn ab.
     */
    resolvePassPhysik(carrier, action, opponents, tactics, pressure, phase, accuracy, isLong) {
        const P = _flowPhysik();
        const typ = isLong ? "longball" : "pass";
        const ziel = action.target;
        const dir = this.attackDir(carrier.team);
        const annahme = _flowTaktik()?.wirkung(tactics).ballannahme || 0;
        const nachVorn = (action.forward ?? 0) > 4 && ziel.pos !== "TW";
        const inDenLauf = nachVorn && (annahme > 0 || (annahme === 0 && _flowRandom.chance(0.3)));
        const start = this.abspielPunkt(carrier);
        // In den Lauf: dorthin, wo der Läufer sein wird, wenn der Ball ankommt.
        // Wer schon nach vorn läuft, bekommt ihn vor die Füße seines Laufs.
        let zielPunkt = { x: ziel.x, y: ziel.y };
        if (inDenLauf) {
            const vx = ziel.lvx || 0, vy = ziel.lvy || 0;
            const unterwegs = vx * dir > 1;
            const tSchaetz = Math.hypot(ziel.x - start.x, ziel.y - start.y) / 19;
            zielPunkt = unterwegs
                ? { x: ziel.x + vx * tSchaetz + dir * 1.5, y: ziel.y + vy * tSchaetz }
                : { x: ziel.x + dir * 4.5, y: ziel.y };
            zielPunkt.x = Math.max(6, Math.min(94, zielPunkt.x));
            zielPunkt.y = Math.max(4, Math.min(96, zielPunkt.y));
        }
        const weite = Math.max(1, Math.hypot(zielPunkt.x - start.x, zielPunkt.y - start.y));
        const winkel = Math.atan2(zielPunkt.y - start.y, zielPunkt.x - start.x);

        // Die Streuung: Wer genau spielt, trifft Richtung und Tempo - mit dem
        // schwachen Fuß weniger gut. Ein Rechtsfuß, der nach links spielen
        // muss, nimmt öfter den linken.
        const st = MatchFlowEngine.PASS_STREUUNG;
        const fehler = 1 - accuracy;
        const quer = (zielPunkt.y - start.y) * dir;
        const falscheSeite = (carrier.foot === "rechts" && quer < -3) || (carrier.foot === "links" && quer > 3);
        const schwach = carrier.foot && carrier.foot !== "beidfüßig"
            && _flowRandom.chance(MatchFlowEngine.PASS_SCHWACHER_FUSS.basis + (falscheSeite ? MatchFlowEngine.PASS_SCHWACHER_FUSS.falscheSeite : 0));
        const mal = schwach ? MatchFlowEngine.PASS_SCHWACHER_FUSS.streuung : 1;
        const w = winkel + _flowRandom.gaussian(0, (st.winkel0 + fehler * st.winkel) * mal);
        const dosierung = Math.max(0.55, 1 + _flowRandom.gaussian(0, (st.tempo0 + fehler * st.tempo) * mal));
        const hoch = isLong || action.type === "clearance";
        const bahn = hoch
            ? P.hoch(start, w, weite * dosierung)
            : P.flach(start, w, P.passTempo(weite) * dosierung);

        // Wie weit kommt der Ball am Angespielten vorbei?
        const tPlan = Math.min(P.zeitBis(bahn, weite), bahn.ruhe);
        const amZiel = P.punkt(bahn, tPlan);
        const abweichung = Math.hypot(amZiel.x - zielPunkt.x, amZiel.y - zielPunkt.y);

        const re = MatchFlowEngine.PASS_REAKTION;
        const reaktion = (p) => {
            if (p.team === carrier.team) {
                if (p.id === ziel.id) return re.empfaenger + Math.min(0.3, abweichung * 0.05);
                // Ein Mitspieler lässt den Ball zum Angespielten durch, solange
                // er auf ihn zuläuft
                const eigene = (p.reaktion ?? 0.3) + re.mitspieler;
                return abweichung < 3 ? Math.max(eigene, tPlan + 0.2) : eigene;
            }
            // Ein Abwehrchef liest den Pass und ist früher am Ball
            const abfangen = this.eig(p).abfangen || 0;
            return Math.max(0.08, (p.reaktion ?? 0.3) * re.gegner - abfangen * 0.08);
        };
        const { reihenfolge, aus } = this.ballRennen(bahn, [carrier.id], reaktion);
        const erster = reihenfolge[0] || null;
        const physik = { bahn, art: hoch ? "hoch" : "flach", abweichung };

        if (!erster) {
            const ende = aus ? aus.punkt : P.punkt(bahn, bahn.ruhe);
            return { type: typ, outcome: "out", from: carrier, to: ende, pressure, phase,
                physik: { ...physik, t: aus ? aus.t : bahn.ruhe, punkt: ende } };
        }
        const p = erster.p;
        physik.t = erster.t;
        physik.punkt = erster.punkt;
        physik.h = erster.h;
        // Zur Seite springt ein Ball, den einer nur halb erwischt
        const weg = (von) => {
            const w2 = Math.atan2(bahn.uy, bahn.ux) + _flowRandom.float(-1.1, 1.1);
            const s = _flowRandom.float(2.5, 6);
            return { x: Math.max(5, Math.min(95, von.x + Math.cos(w2) * s)), y: Math.max(3, Math.min(97, von.y + Math.sin(w2) * s)) };
        };

        if (p.team === carrier.team) {
            // Die Annahme: Ein scharfer, hoher oder bedrängter Ball springt weg
            const v = P.tempo(bahn, erster.t);
            const druck = this.getPressure(p, opponents);
            const technik = (this.attr(p, "technique") - 70) / 400 + this.fein(p, "firstTouch") * 0.004;
            const an = MatchFlowEngine.EICHUNG.annahme;
            const pFehl = Math.max(0.005, Math.min(0.4, an.basis + Math.max(0, v - an.ab) * an.jeTempo + druck * an.druck
                + (erster.h > P.ANNAHME_HOEHE ? an.hoch : 0) - technik));
            if (!erster.liegend && _flowRandom.chance(pFehl)) {
                return { type: typ, outcome: "loose", from: carrier, to: weg(erster.punkt), verstolpert: p, pressure, phase, physik };
            }
            return { type: typ, outcome: "complete", from: carrier, to: p, inDenLauf: inDenLauf && p.id === ziel.id,
                umgeleitet: p.id !== ziel.id, pressure, phase, physik };
        }

        // Der Gegner ist zuerst dran. Ein hoher Ball wird oft nur weggeköpft.
        if (erster.h > P.ANNAHME_HOEHE && _flowRandom.chance(0.45)) {
            return { type: typ, outcome: "loose", from: carrier, to: weg(erster.punkt), abgewehrt: p, pressure, phase, physik };
        }
        // Im eigenen Strafraum abgefaelscht geht der Ball oft ins Toraus
        if (this.imEigenenStrafraum(erster.punkt, p.team) && p.pos !== "TW" && _flowRandom.chance(0.22)) {
            return { type: typ, outcome: "corner", from: carrier, to: { x: erster.punkt.x, y: erster.punkt.y }, interceptor: p, pressure, phase, physik };
        }
        return { type: typ, outcome: "intercepted", from: carrier, to: ziel, interceptor: p, pressure, phase, physik };
    }

    resolveDribble(carrier, action, opponents, tactics, pressure, phase) {
        const defender = opponents
            .filter(o => o.pos !== "TW")
            .sort((a, b) => this.distance(carrier, a) - this.distance(carrier, b))[0];

        // Andribbeln in den freien Raum: kein Zweikampf, niemand zu schlagen
        if (action.frei && (!defender || this.distance(carrier, defender) > 8)) {
            return { type: "dribble", outcome: "beaten", frei: true, from: carrier, to: action.target, defender: null, pressure, phase };
        }

        // Abschirmen und wegdrehen: gelingt meist - gegen einen zweikampfstarken
        // Gegner seltener, wer ruhig am Ball und kräftig ist, öfter
        if (action.abdrehen && defender) {
            const ruhe = (this.attr(carrier, "technique") + this.attr(carrier, "dribbling")) / 200
                + (this.fein(carrier, "strength") + this.fein(carrier, "balance")) * 0.004;
            const gegen = this.attr(defender, "defense") / 100 + this.fein(defender, "tackling") * 0.004;
            const halten = Math.max(0.6, Math.min(0.95, MatchFlowEngine.ABDREHEN.halten + (ruhe - gegen) * 0.5));
            if (_flowRandom.chance(halten)) {
                return { type: "dribble", outcome: "beaten", frei: true, abdrehen: true, from: carrier, to: action.target, defender: null, pressure, phase };
            }
            if (this.fm()) {
                const gegnerTaktik = this.getTactics(defender.team) || {};
                const haerte = (_flowTaktik()?.wirkung(gegnerTaktik).zweikampf || 0) + this.anweisungsHaerte(carrier);
                const foul = this.foulImZweikampf(carrier, defender, haerte, (ruhe - gegen) * 100);
                if (foul) return { ...foul, pressure, phase };
            }
            return { type: "dribble", outcome: "tackled", abdrehen: true, from: carrier, to: action.target, defender, pressure, phase };
        }

        const dribbling = this.attr(carrier, "dribbling");
        const pace = this.attr(carrier, "pace");
        const defSkill = !defender ? 60 : (typeof defender.anticipation === "number"
            ? this.attr(defender, "defense") * 0.5 + this.attr(defender, "pace") * 0.35 + this.attr(defender, "anticipation") * 0.15
            : this.attr(defender, "defense") * 0.6 + this.attr(defender, "pace") * 0.4) + this.fein(defender, "tackling") * 0.5
            // Wer kräftig und bissig ist, setzt sich öfter durch
            + this.fein(defender, "strength") * 0.15 + this.fein(defender, "aggression") * 0.1;

        // Wer die Balance hält, bleibt im Kontakt auf den Beinen
        const edge = (dribbling * 0.6 + pace * 0.4 + this.fein(carrier, "agility") * 0.4 + this.fein(carrier, "balance") * 0.2) - defSkill;
        // Wer hart einsteigt, gewinnt mehr Zweikaempfe (und foult oefter -
        // das zaehlt die Timeline); wer auf den Fuessen bleibt, weniger
        const gegnerTaktik = defender ? this.getTactics(defender.team) || {} : {};
        const haerte = (_flowTaktik()?.wirkung(gegnerTaktik).zweikampf || 0) + (defender ? this.anweisungsHaerte(carrier) : 0);
        const fm = this.fm();
        // Im FM-Modus entscheiden die Werte den Zweikampf deutlich
        let chance = 0.6 + edge / (fm ? 140 : 210) - pressure * 0.13 - haerte * 0.05;
        // In einen vollen Strafraum kommt man nicht einfach hineingedribbelt
        if (fm && this.imGegnerStrafraum(action.target, carrier.team)) chance -= Math.min(0.2, this.strafraumDichte(carrier.team) * 0.05);
        // Absicherung: Wer den ersten Verteidiger stehen lässt, läuft im
        // kompakten Block gleich in den zweiten. Bisher zählte nur der
        // nächste Gegner - gegen einen tiefen Block gelangen dem Favoriten so
        // fast zwanzig Dribblings je Spiel. Ein Helfer in der Nähe ist im
        // Mittelfeld normal und zählt nicht; jeder weitere schon.
        if (fm && defender && action.target) {
            const helfer = opponents.filter(o => o !== defender && o.pos !== "TW"
                && this.distance(action.target, o) < MatchFlowEngine.ABSICHERUNG_RADIUS).length;
            chance -= Math.min(MatchFlowEngine.ABSICHERUNG_MAX, Math.max(0, helfer - 1) * MatchFlowEngine.ABSICHERUNG_JE_HELFER);
        }
        const ea = fm ? this.eig(carrier) : {};
        const ed = fm && defender ? this.eig(defender) : {};
        chance += (ea.dribbelKoennen || 0) - (ed.zweikampf || 0);
        // Im freien Raum hilft der Antritt: Wer schneller ist, ist weg
        if (fm && (action.space || 0) > 0.4) chance += (ea.antritt || 0) + this.fein(carrier, "acceleration") * 0.004;
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
