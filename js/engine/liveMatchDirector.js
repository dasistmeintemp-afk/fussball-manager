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

/** Taktik (Rollen, Formen mit und gegen den Ball, Anweisungen) */
const _dirTaktik = () => {
    if (typeof TacticsEngine !== 'undefined' && TacticsEngine) return TacticsEngine;
    if (typeof window !== 'undefined' && window.TacticsEngine) return window.TacticsEngine;
    if (typeof require !== 'undefined') {
        try { return require('./tacticsEngine.js').TacticsEngine; } catch (e) { /* ohne Taktikmodul */ }
    }
    return null;
};

/** Die Formationen (auch eigene) fuer die Zuordnung der Formen */
const _dirFormationen = () => {
    if (typeof FORMATION_CONFIGS !== 'undefined' && FORMATION_CONFIGS) return FORMATION_CONFIGS;
    if (typeof window !== 'undefined' && window.FORMATION_CONFIGS) return window.FORMATION_CONFIGS;
    if (typeof require !== 'undefined') {
        try { return require('./gameState.js').FORMATION_CONFIGS; } catch (e) { /* ohne Spielstand */ }
    }
    return {};
};

/**
 * Ereignisse, deren Text erst beim Eintreffen des Balls gemeldet wird
 * (Torschuss, Parade, Fehlschuss) - so passt der Kommentar zum Bild.
 */
const RESOLVE_ON_ARRIVAL = ["goal", "save", "shot_miss"];

/**
 * Ereignisse, bei denen niemand den Ball führt: Ein Foul ist ein Zweikampf,
 * kein Zuspiel, und wer gefoult wurde, steht nicht in der Timeline.
 */
const OHNE_BALLFUEHRUNG = ["foul", "yellow_card", "red_card", "injury", "substitution", "halftime", "fulltime"];

/** Ereignisse, bei denen ein Gegenspieler den Ballfuehrenden foult */
const FOUL_ARTEN = ["foul", "yellow_card", "red_card"];

/** Zaesuren, ueber die hinweg keine Szene weiterlaeuft */
const SZENEN_ENDE = ["halftime", "fulltime", "substitution", "goal", "injury", "red_card"];

/** Ruhende Baelle haben ihren festen Platz auf dem Feld */
const RUHENDER_BALL = ["corner", "penalty", "freekick", "throwin", "goalkick", "kickoff"];

/**
 * Ereignisse, deren Ort nicht vorgeschrieben ist.
 *
 * Ein Schuss muss aus einer Schussposition kommen, eine Flanke vom Fluegel.
 * Ein Steilpass, ein Dribbling oder ein Zweikampf passiert dagegen dort, wo
 * der Spieler gerade steht - fuer die darf die Szene zu ihm kommen.
 */
const ORTSFREI = ["through_ball", "dribble", "tackle", "pass"];

/**
 * Tempo (Feldeinheiten pro Sekunde) je Mannschaftsteil als Basiswert.
 *
 * Gemessen liefen die Spieler mit vierzehn Metern je Sekunde im Median und
 * zweiundzwanzig im oberen Zehntel - ein Weltklassesprinter schafft zehn.
 * Auf dem Bildschirm sah das nicht nach Fussball aus, sondern nach Flipper:
 * Zweiundzwanzig Spieler, die mit Mopedgeschwindigkeit ueber den Platz
 * schiessen.
 *
 * Halbiert liegt der Median bei knapp acht und die Spitze bei knapp dreissig.
 * Immer noch schneller als echt - das Spiel ist neunundzwanzigfach gerafft und
 * kaeme sonst nirgends an -, aber in einer Groessenordnung, in der eine
 * Bewegung als Lauf lesbar ist und nicht als Sprung.
 */
const LINE_BASE_SPEED = { gk: 2.1, def: 2.5, mid: 2.8, att: 2.9 };

/** Wie sehr ein Spieler im Anlauf zulegt - ein Sprint, keine Rakete */
const ANLAUF_URGENZ = 2.2;

/**
 * Was niemand ueberschreitet, egal wie dringend es ist.
 *
 * Ein Weltklassesprinter laeuft zehn Meter je Sekunde. Auf dem gerafften
 * Bildschirm darf es mehr sein, sonst kaeme niemand rechtzeitig an - aber
 * dreiundvierzig Meter je Sekunde, wie gemessen, ist kein Sprint mehr,
 * sondern ein Sprung. Diese Decke gilt ueber alle Dringlichkeiten hinweg.
 */
const SPRINT_DECKE = 6.5;

/**
 * Wer im Angriff die Breite haelt. Fluegelspieler und Aussenverteidiger
 * schieben nicht mit ein, wenn die eigene Mannschaft den Ball hat - sie ziehen
 * das Feld auseinander. Ohne Ball ruecken auch sie in den Block.
 */
const BREITE_ROLLEN = ["LM", "RM", "LA", "RA", "LV", "RV"];

/**
 * Der Raum, den eine Position bespielt - laengs (x) und quer (y) um den Platz
 * im Verbund, in Feldeinheiten.
 *
 * Vorher stand jeder Spieler exakt auf seinem Formationspunkt, verschoben um
 * dieselbe Strecke wie alle anderen. Gemessen liefen im Schnitt drei Viertel
 * einer Elf in dieselbe Richtung, und fast niemand stand je still: Die ganze
 * Mannschaft glitt wie eine Schablone mit dem Ball ueber den Rasen.
 *
 * Im Fussball ist die Formation ein Rahmen, kein Gitter. Ein Innenverteidiger
 * weicht kaum von seinem Platz, ein Achter pendelt ueber die halbe Breite, ein
 * Stuermer laeuft sich frei, kommt entgegen oder geht in die Tiefe. Innerhalb
 * dieses Raums sucht sich jeder Spieler selbst seinen Weg.
 */
const POSITIONS_RADIUS = {
    IV: { x: 4, y: 4.5 }, LV: { x: 7, y: 5 }, RV: { x: 7, y: 5 },
    DM: { x: 6, y: 7 }, ZM: { x: 8, y: 8.5 }, OM: { x: 8, y: 9 },
    LM: { x: 9, y: 6 }, RM: { x: 9, y: 6 },
    ST: { x: 8, y: 9 }, LA: { x: 8.5, y: 7 }, RA: { x: 8.5, y: 7 }
};

/**
 * Antritt und Bremsen in Feldeinheiten je Sekunde im Quadrat.
 *
 * Die Spieler folgten ihrem Ziel bisher ohne jede Masse: Die Geschwindigkeit
 * sprang in einem Bild von null auf voll und zurueck, jede Richtungsaenderung
 * war ein Knick. Ein Mensch muss antreten, und wer die Richtung wechselt, muss
 * erst abbremsen - daraus entstehen die Boegen, an denen man einen Lauf als
 * Lauf erkennt.
 */
const ANTRITT = 6.5;
const BREMSKRAFT = 11;

/** Wie lange ein Spieler bei seinem gewaehlten Laufweg bleibt (Sekunden) */
const LAUFWEG_DAUER = { angriff: [1.6, 4.2], abwehr: [2.2, 5.0] };

/** Wie lange nach einem Ballverlust die Mannschaft umschaltet (Sekunden) */
const UMSCHALT_DAUER = 2.2;

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
    andribbeln: [
        "{minute}' - {a} hat Platz und dribbelt an.",
        "{minute}' - Niemand greift {a} an - er trägt den Ball nach vorn.",
        "{minute}' - {a} nutzt den freien Raum und rückt mit dem Ball auf."
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
        "{minute}' - Der Schiedsrichter pfeift, Freistoß für {club}.",
        "{minute}' - Freistoß {club}, der Ball wird zurechtgelegt."
    ],
    freekick_gefaehrlich: [
        "{minute}' - Freistoß für {club} aus aussichtsreicher Position, die Mauer stellt sich.",
        "{minute}' - Gefährlicher Freistoß für {club} - der Schiedsrichter misst die Mauer ab."
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
    /**
     * Hoechstgeschwindigkeit des Balls je Spielart, in Feldeinheiten je
     * Bildschirmsekunde. Eine Einheit ist gut ein Meter.
     *
     * Hier stand vorher nichts - der Deckel lag bei hundertzehn fuer einen
     * Pass, also hundertfuenfzehn Metern je Sekunde. Schneller als jeder
     * Schuss, den es je gab. Gemessen sprang der Ball dadurch in jedem
     * sechsten Bild ueber drei Meter weiter: genau der Eindruck eines Balls,
     * der durch die Gegend springt.
     *
     * Die Spieluhr laeuft gut zwoelffach gerafft, ein Pass darf auf dem
     * Bildschirm also schneller sein als auf dem Rasen - aber er muss als
     * Pass erkennbar bleiben.
     *
     * Gemessen war es vor allem das obere Ende, das nicht stimmte: Der Median
     * lag bei vierunddreissig Metern je Sekunde, das obere Zehntel aber bei
     * siebzig - und ein Schuss durfte mit sechsundsiebzig fliegen, dreimal so
     * schnell wie ein echter. Das war das Springen durch die Gegend.
     *
     * Also sind die Spitzen gekappt statt jeden kurzen Pass gebremst: Flanke
     * und Schuss liegen jetzt auf Passniveau. Gemessen faellt das obere
     * Zehntel von siebzig auf fuenfundfuenfzig, der Median von vierunddreissig
     * auf neunundzwanzig - und das Aufbauspiel verliert dabei fast nichts,
     * waehrend eine gleichmaessige Bremsung ein Drittel der Aktionen kostete.
     */
    static BALL_TEMPO = { pass: 19, cross: 17, shot: 21, dead: 18 };

    /**
     * Wie lange der Ball zwischen zwei Etappen einer Kombination bei einem
     * Spieler liegt - kuerzeste und laengste Annahme.
     *
     * Die Anlaufplanung rechnet mit der laengsten: Ein Anlauf, der zu frueh
     * endet, laesst den im Ticker genannten Spieler ohne Ball dastehen - ein
     * Anlauf, der zu lange dauert, kostet nur einen Augenblick.
     */
    static ETAPPEN_ANNAHME = [0.14, 0.26];

    /**
     * Wie schnell ein Spieler einen liegenden Ball zu sich heranholt, in
     * Feldeinheiten je Bildschirmsekunde.
     *
     * Er rollt ihn sich zu, er reisst ihn nicht heran: ohne diese Grenze
     * sprang der Ball beim Aufnehmen ueber mehrere Meter in einem Bild.
     */
    static AUFNAHME_TEMPO = 72;

    /**
     * Wie lange vor einem Ereignis das Aufbauspiel beginnt, es zu suchen -
     * in Spielsekunden.
     *
     * Die Regie holte den Ball bisher zur Szene: Sobald ein Ereignis faellig
     * war, wanderte er ueber bis zu drei Stationen quer ueber das Feld zu dem
     * Spieler, den der Ticker nennt. Gemessen verbrachte die Uebertragung
     * damit dreissig bis fuenfzig Prozent ihrer Zeit im Anlauf, und der Ball
     * war die halbe Partie unterwegs.
     *
     * Jetzt laeuft es andersherum: Das Aufbauspiel bekommt den kommenden
     * Protagonisten als Ziel und sucht ihn mit gewoehnlichen Zuspielen. Hat er
     * den Ball, wenn das Ereignis faellig wird, entfaellt der Anlauf ganz -
     * die Szene entsteht aus dem Spiel, statt an es angeklebt zu werden.
     */
    static ANLAUF_VORLAUF = 75;

    /**
     * Wie lange ein Spieler den Ball annimmt, bevor er ihn weiterspielt -
     * in Bildschirmsekunden.
     *
     * Ohne diese Pause verliess der Ball den Fuss im selben Moment, in dem er
     * ankam; er war dadurch weit mehr als die Haelfte der Partie unterwegs. Im
     * Fussball liegt er die meiste Zeit bei jemandem.
     *
     * Zwei Zehntelsekunden waren dafuer zu wenig: Der Zyklus aus Flug und
     * Annahme dauerte kaum laenger als der Flug selbst, also war der Ball
     * sechsundfuenfzig Prozent der Uebertragung in der Luft. Mit anderthalb bis
     * knapp drei Sekunden am Fuss faellt das auf sechsundvierzig, und die Zahl
     * der freien Entscheidungen bleibt bei ueber zweihundert je Partie.
     *
     * Der Wert ist Bildschirmzeit und wird durch die Abspielgeschwindigkeit
     * geteilt - im Vorlauf nimmt man schneller an.
     */
    static ANNAHME = [1.4, 2.8];

    /**
     * Wie weit eine Szene nach vorne greift - in Spielsekunden.
     *
     * Eine Passage ist keine Minute: Aufbau, Verlagerung und Abschluss liegen
     * in der Zeitleiste oft eine halbe Minute auseinander, standen aber als
     * drei getrennte Szenen mit drei getrennten Anlaeufen da. Mit diesem
     * Fenster laeuft der Angriff durch, und geschnitten wird danach.
     */
    static SZENEN_FENSTER = 100;

    /**
     * Wie frueh die andere Mannschaft den Ball erobert, wenn ihr die naechste
     * Szene gehoert - in Spielsekunden.
     *
     * Die Zeitleiste steht vorher fest. Gehoerte die naechste Szene dem
     * Gegner, wechselte der Ball beim Anpfiff der Szene einfach den Besitzer:
     * gemessen fuenfundvierzigmal je Partie, ohne Zweikampf und ohne
     * abgefangenen Pass. Danach spielte der Gegner den Ball ueber die
     * Mitspieler zum genannten Spieler - fuer den Zuschauer sah das aus, als
     * spielten sich die Gegner den Ball zu. Jetzt wird der Ball vorher
     * erobert: Ein Pass wird abgefangen, ein Dribbling gestoppt.
     */
    static BALLVERLUST_VORLAUF = 30;

    /**
     * Wie lange eine faellige Szene auf diese Eroberung wartet - in
     * Bildschirmsekunden des Grundtempos, damit das freie Spiel auf jeder
     * Abspielstufe Zeit fuer zwei, drei Ballkontakte hat. In Spielzeit
     * gemessen blieb auf der schnellen Stufe nicht einmal eine Sekunde.
     * Hoechstens aber eine Spielminute: Das Ereignis steht minutengenau
     * im Ticker.
     */
    static BALLVERLUST_GNADE = 4.5;
    static BALLVERLUST_GNADE_SPIELZEIT = 60;

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
        // Mindestdauer einer Anlaufphase (ruhender Ball wird zurechtgelegt)
        this.phaseMinRest = 0;
        // Wer führt das aktuelle Ereignis aus?
        this.sceneProtagonist = null;

        // Ambient-Ballzirkulation
        this.possessionTeam = "home";
        this.carrierId = null;
        this.ambientTimer = 0;
        this.ambientInterval = 1.1;
        // Laufweg eines Spielers, der den Ball mitnimmt
        this.carryTarget = null;
        // Vorgemerkte Spielfortsetzung, sobald der Ball im Aus liegt
        this._offenerStandard = null;
        // Ballannahme: solange sie laeuft, bleibt der Ball beim Spieler
        this._annahmeTimer = 0;

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

        // Anstoß-Zeremonie: beide Mannschaften stellen sich auf, dann pfeift
        // der Schiedsrichter an. Solange läuft die Uhr nur im Schneckentempo.
        this.kickoff = null;
        this.kickoffPartnerId = null;
        // Wer steht bei einem Freistoß in der Mauer?
        this.setPieceWall = [];
        // Sperre in Sekunden, damit nicht zweimal hintereinander Abseits kommt
        this.abseitsSperre = 0;
        // Gepfiffener Elfmeter, dessen Ausführung noch aussteht
        this.pendingPenalty = null;

        // Ballbesitz-Mikrosimulation
        this.flow = _MatchFlowEngine ? new _MatchFlowEngine({
            getPlayers: () => this.match.players2D || [],
            getTactics: (team) => (team === "home" ? this.match.homeClub?.tactics : this.match.awayClub?.tactics) || {},
            attackDir: (team) => this.attackDir(team),
            ownGoalX: (team) => this.ownGoalX(team)
        }) : null;

        this.initPlayers();

        // Start mit einer richtigen Anstoß-Zeremonie statt eines Anpfiffs ins Nichts
        this.mode = "ambient";
        this.startKickoff(this.targetPossession[0] >= 50 ? "home" : "away", "matchstart");
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
            p.urgency = 1;
            // Frische: sinkt über die 90 Minuten und bremst den Spieler
            if (typeof p.freshness !== "number") p.freshness = 1;
            p.sprinting = false;
            p.facing = this.attackDir(p.team) > 0 ? 0 : Math.PI;

            // Die eigene Rolle ohne Seitenzusatz (ZDM -> DM, LAV -> LV)
            p.rolle = this.normRolle(p.pos);
            // Spielverstaendnis: Wer das Spiel liest, reagiert frueher auf
            // Ballverlust und Verlagerung.
            const lesen = Math.max(0, Math.min(1, ((p.vision || 65) - 40) / 55));
            p.reaktion = 0.42 - lesen * 0.28 + ((idx * 0.37) % 1) * 0.08;
            p.traegheit = 0.5 - lesen * 0.22 + ((idx * 0.53) % 1) * 0.1;
            // Laufgeschwindigkeit und Absicht ueberleben einen Wechsel oder
            // eine Umstellung - sonst bliebe die ganze Elf kurz stehen.
            if (typeof p.lvx !== "number") { p.lvx = 0; p.lvy = 0; }
            if (!p.sicht) p.sicht = { x: this.match.ball?.x ?? 50, y: this.match.ball?.y ?? 50 };
            if (typeof p.slot !== "number") p.slot = Math.max(0, (p.number || 1) - 1);
        });
        // Nach einem Wechsel, einer Umstellung oder einem Platzverweis stimmt
        // die gemerkte Tiefe der Formation nicht mehr.
        this._tiefenRahmen = {};
        this.taktikAnwenden();
    }

    // ---------------------------------------------------------------- Taktik

    /**
     * Rollen und Formen der Taktik auf die Spieler legen: Wer welche Rolle mit
     * und gegen den Ball spielt und wo er in der Form mit und gegen den Ball
     * steht. Neu gerechnet wird bei jeder Umstellung - auch waehrend des
     * Spiels, wenn der Trainer eingreift.
     */
    taktikAnwenden() {
        const T = _dirTaktik();
        this._mannZuordnung = {};
        this._taktikCache = {};
        if (!T) return;
        const configs = _dirFormationen();
        ["home", "away"].forEach(team => {
            const club = team === "home" ? this.match.homeClub : this.match.awayClub;
            if (!club) return;
            const tactics = T.normalisiere(club.tactics || (club.tactics = {}));
            const positions = (configs[club.formation] || configs["4-4-2"] || {}).positions || [];
            const rollen = positions.length ? T.rollenDerElf(club, positions) : [];
            const mit = positions.length && tactics.formMitBall !== "auto" && tactics.formMitBall !== "grund"
                ? T.plaetzeInForm(positions, tactics.formMitBall, configs) : null;
            const gegen = positions.length ? T.plaetzeInForm(positions, tactics.formGegenBall, configs) : null;
            this.teamPlayers(team).forEach(p => {
                const r = rollen[p.slot] || null;
                p.fam = r ? r.familie : null;
                p.rolleMit = r ? T.rolleMitBall(r.familie, r.mit) : null;
                p.rolleGegen = r ? T.rolleGegenBall(r.familie, r.gegen) : null;
                p.formMit = mit ? mit[p.slot] || null : null;
                p.formGegen = gegen ? gegen[p.slot] || null : null;
            });
        });
    }

    /**
     * Die Taktik einer Mannschaft mit ihren Zahlen. Einmal je Bild gerechnet,
     * damit eine Umstellung im Spiel sofort gilt.
     */
    taktik(team) {
        const uhr = this._laufUhr || 0;
        if (!this._taktikCache) this._taktikCache = {};
        const c = this._taktikCache[team];
        if (c && c.uhr === uhr) return c;
        const T = _dirTaktik();
        const club = team === "home" ? this.match.homeClub : this.match.awayClub;
        const tactics = club?.tactics || {};
        const w = T ? T.wirkung(tactics) : {
            pressingLinie: { high: 0, medium: 0.33, low: 0.5 }[tactics.pressing] ?? 0.33, presser: 2, pressTempo: 1.85,
            gegenpressing: 2.2, rueckzugEile: 1.6, konter: 0, deckung: "raum", zoneFaktor: 1, falle: "keine",
            kompakt: 0, abseitsfalle: false, breite: 0, freiheit: 1, aussen: { links: "normal", rechts: "normal" },
            flankenVerhindern: 0, abstossStoeren: false
        };
        const neu = { uhr, t: tactics, w, formMitBall: tactics.formMitBall || "auto" };
        this._taktikCache[team] = neu;
        return neu;
    }

    /**
     * Wo "links" liegt - aus Sicht der Mannschaft in ihre Angriffsrichtung:
     * Wer nach rechts spielt, hat links die kleinen y-Werte.
     */
    linksVorzeichen(team) {
        return -this.attackDir(team);
    }

    /** Querposition aus einer Form (Formationskoordinaten) auf das Feld */
    querAusForm(x, team) {
        return this.attackDir(team) > 0 ? x : 100 - x;
    }

    /**
     * Manndeckung: Wer wen deckt. Jeder Feldspieler bekommt einen Gegenspieler
     * - der eigene Tiefste den gegnerischen Vordersten, Seite gegen Seite.
     * Die Zuordnung steht fuer das Spiel; nach einem Wechsel wird sie neu
     * gerechnet.
     */
    mannZuordnung(team) {
        if (!this._mannZuordnung) this._mannZuordnung = {};
        if (this._mannZuordnung[team]) return this._mannZuordnung[team];
        const T = _dirTaktik();
        const eigene = this.teamPlayers(team).filter(p => p.pos !== "TW");
        const gegner = this.teamPlayers(team === "home" ? "away" : "home").filter(p => p.pos !== "TW");
        const zuordnung = new Map();
        if (!T || !eigene.length || !gegner.length) return (this._mannZuordnung[team] = zuordnung);
        const tiefe = q => this.formationsTiefe(q);
        const n = Math.max(eigene.length, gegner.length);
        const kosten = [];
        for (let i = 0; i < n; i++) {
            kosten.push([]);
            for (let j = 0; j < n; j++) {
                const a = eigene[i], b = gegner[j];
                if (!a || !b) { kosten[i].push(0); continue; }
                const quer = a.baseY - b.baseY;
                const laengs = 60 * (tiefe(a) - (1 - tiefe(b)));
                kosten[i].push(quer * quer + laengs * laengs);
            }
        }
        const z = T._ungarisch(kosten);
        eigene.forEach((p, i) => { if (gegner[z[i]]) zuordnung.set(p.id, gegner[z[i]].id); });
        this._mannZuordnung[team] = zuordnung;
        return zuordnung;
    }

    /**
     * Ein Spieler hat das Feld verlassen (Platzverweis). Alles, was noch auf
     * ihn zeigt, wird geloest - sonst hielte ein Mann den Ball, der gar nicht
     * mehr auf dem Platz steht.
     */
    spielerEntfernt(playerId) {
        const match = this.match;
        if (this.carrierId === playerId) this.carrierId = null;
        if (match.ball && match.ball.holderId === playerId) match.ball.holderId = null;
        if (match.activePlayerId === playerId) match.activePlayerId = null;
        if (this.sceneProtagonist === playerId) this.sceneProtagonist = null;
        if (this.kickoffTakerId === playerId) this.kickoffTakerId = null;
        if (this.kickoffPartnerId === playerId) this.kickoffPartnerId = null;
        if (this._routeHolder === playerId) this._routeHolder = null;
        if (this.carryTarget && this.carryTarget.id === playerId) this.carryTarget = null;
        if (match.sceneRoles instanceof Map) match.sceneRoles.delete(playerId);
        if (Array.isArray(this.setPieceWall)) {
            this.setPieceWall = this.setPieceWall.filter(id => id !== playerId);
        }
        this.initPlayers();
    }

    /**
     * Mannschaftsteil einer Position.
     *
     * Die Formationen benennen Halbpositionen fein (ZDM, RZM, LOM ...). Ohne
     * Übersetzung landete jeder Sechser im Sturm - die Mannschaft stand auf
     * dem Feld dadurch komplett falsch.
     */
    getGroup(pos) {
        const clean = this.normRolle(pos);

        if (clean === "TW") return "gk";
        if (["IV", "LV", "RV"].includes(clean)) return "def";
        if (["DM", "ZM", "OM", "LM", "RM"].includes(clean)) return "mid";
        return "att";
    }

    /** Die Position ohne Seiten- und Halbraumzusatz (ZDM -> DM, LAV -> LV) */
    normRolle(pos) {
        const posEngine = (typeof PositionEngine !== "undefined" && PositionEngine)
            ? PositionEngine
            : ((typeof window !== "undefined" && window.PositionEngine) ? window.PositionEngine
                : (typeof require !== "undefined" ? require("./positionEngine.js").PositionEngine : null));

        return (posEngine && typeof posEngine.normalizePosition === "function")
            ? (posEngine.normalizePosition(pos) || pos)
            : pos;
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
        // Während sich beide Mannschaften zum Anstoß aufstellen, kriecht die
        // Uhr - sonst würde die Zeremonie bei schnellem Tempo mehrere
        // Spielminuten verschlingen.
        if (this.kickoff) return 0.32;
        // Der Anlauf einer Szene ist Aufbauarbeit: Der Schütze geht an die
        // Eckfahne, der Strafraum füllt sich. Das darf dauern, ohne dass
        // dabei halbe Spielminuten verstreichen.
        //
        // Die Bremswerte waren allerdings so kräftig, dass die Höhepunkte die
        // halbe Übertragung ausmachten: Auf schnellster Stufe entfielen von
        // 168 Sekunden Spieldauer 81 auf den Normalbetrieb und 81 auf die
        // Zeitlupe. Eine Szene darf sich abheben, aber nicht das Spiel
        // anhalten.
        if (this.mode === "highlight" && this.scene?.phase === "approach") {
            return this.deadBall ? 0.42 : 0.62;
        }
        if (this.mode === "highlight") return 0.72;
        if (this.deadBall) return 0.78;
        return 1;
    }

    getMotionScale() {
        if (this.match.motionFreeze) return 0;
        if (this.mode === "celebration" && this.celebrationPhase === "slowmo") return 0.28;
        if (this.drama) return 0.15;
        return 1;
    }

    /**
     * Wie schnell die Spieler laufen dürfen, gemessen am gewählten Tempo.
     *
     * Die Spieler bewegten sich in echten Sekunden - immer gleich schnell,
     * egal welche Stufe eingestellt war. Die Uhr lief auf der schnellsten
     * Stufe aber fünfmal so schnell. Damit lief das Spiel den Spielern davon:
     * Der Ball wurde an die Eckfahne gelegt, das Fenster für die Ausführung
     * war fünfmal kürzer - und der Schütze war noch auf halbem Weg. Gemessen
     * lag der Ball bei einer Ecke auf der schnellsten Stufe in siebenundacht-
     * zig Prozent der Zeit allein, weiter als acht Einheiten von jedem
     * Spieler entfernt. Genau das sieht aus wie ein Ball, der ohne Zutun
     * durch die Gegend fliegt.
     *
     * Der Ausweg war lange die Wurzel: Bewegung nur halb so stark raffen wie
     * die Uhr. Damit war aber jede Stufe eine andere Simulation. Jetzt laeuft
     * die Bewegung genau so schnell wie die Uhr - eine hoehere Stufe ist ein
     * Vorlauf, kein anderes Spiel.
     */
    getMotionTempo() {
        return this.getAbspielTempo();
    }

    /**
     * Die gewaehlte Abspielgeschwindigkeit - eins ist Grundtempo.
     *
     * Uhr, Laufwege und Ballflug haengen alle hieran, damit eine hoehere Stufe
     * dasselbe Spiel im Vorlauf zeigt und nicht ein anderes.
     */
    getAbspielTempo() {
        const speeds = _dirSpeeds();
        const cfg = speeds ? (speeds[this.match.speed] || speeds[1]) : null;
        if (cfg && cfg.abspielTempo > 0) return cfg.abspielTempo;
        // Ohne Konstantentabelle aus dem Tickabstand herleiten
        return Math.max(0.5, Math.min(6, 1800 / Math.max(1, this.match.getTickIntervalMs())));
    }

    /**
     * Wie lang eine inszenierte Szene in Bildschirmsekunden dauern darf.
     *
     * Der Wert war aus dem Tickabstand gerastert: 0.78 / 0.39 / 0.16. Die
     * Abspielgeschwindigkeiten sind aber 1.0 / 2.9 / 4.8 - auf "Normal" bekam
     * eine Szene damit anderthalbmal so viel Spielzeit wie auf "Langsam". Das
     * ist der Unterschied zwischen einem Vorlauf und einem anderen Spiel.
     *
     * Jetzt ist es genau der Kehrwert der Abspielgeschwindigkeit: Eine Szene
     * dauert auf jeder Stufe gleich viele Spielsekunden und nur unterschiedlich
     * viele Bildschirmsekunden.
     */
    getSpeedScale() {
        return 0.78 / this.getAbspielTempo();
    }

    /**
     * Rechnet eine im Grundtempo gemessene Dauer in Bildschirmzeit um.
     *
     * Ueberall im Regiewerk stehen feste Sekundenwerte - wie lange ein Anlauf
     * dauern darf, wie lange ein Ball liegen bleibt. Sie waren in echten
     * Sekunden gemeint und blieben deshalb gleich, waehrend die Uhr schneller
     * lief: Auf "Schnell" verschlang derselbe Anlauf das Fuenffache an
     * Spielzeit. Gemessen blieben von 377 freien Spielaktionen je Partie noch
     * 64 uebrig - der Rest der Uebertragung war Szene.
     *
     * Wer eine Dauer in Spielzeit meint, schickt sie hier durch.
     */
    bildschirmZeit(basisSekunden) {
        return basisSekunden / this.getAbspielTempo();
    }

    /**
     * Balltempo der gewaehlten Abspielgeschwindigkeit.
     *
     * BALL_TEMPO ist in Einheiten je Bildschirmsekunde des Grundtempos
     * angeschrieben. Ohne diesen Faktor flog der Ball auf jeder Stufe gleich
     * schnell ueber den Bildschirm - in Spielzeit gerechnet also auf
     * "Schnell" fuenfmal langsamer. Genau daher kam die Messung, nach der der
     * Ball auf der schnellsten Stufe dreiundachtzig Prozent der Uebertragung
     * in der Luft war.
     */
    ballTempo(actionType) {
        const basis = LiveMatchDirector.BALL_TEMPO[actionType] || LiveMatchDirector.BALL_TEMPO.pass;
        return basis * this.getAbspielTempo();
    }

    advanceRealTime(realMs) {
        const match = this.match;
        if (match.isFinished || match.isPaused) return;

        const dt = Math.max(0, Math.min(0.25, (Number(realMs) || 0) / 1000));
        if (dt <= 0) return;

        this.elapsedReal += dt;
        const matchSecondsDelta = dt * this.getClockRate();
        this.clock += matchSecondsDelta;

        if (this.abseitsSperre > 0) this.abseitsSperre = Math.max(0, this.abseitsSperre - dt);

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
        } else if (this.kickoff) {
            // Zum Anpfiff steht der Unparteiische am Mittelkreis
            tx = 50 + (this.kickoff.team === "home" ? -7 : 7);
            ty = this.kickoff.phase === "whistle" ? 40 : 36;
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
            // Wer angeschlagen weiterspielt, humpelt - langsamer als jeder Muede.
            if (p.verletzt) p.freshness = Math.min(p.freshness, 0.62);
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

    /**
     * Seitenwechsel zur zweiten Halbzeit.
     *
     * Der Wechsel passiert in der Pause, also zwischen zwei Spielabschnitten:
     * Beide Mannschaften kommen auf der anderen Seite aus der Kabine. Deshalb
     * werden Grundgerüst und aktuelle Positionen gespiegelt - liefe stattdessen
     * jeder Spieler quer über den Platz, stünde der Torwart beim Anpfiff noch
     * am Mittelkreis. Anschließend rückt die anschließende Anstoß-Zeremonie
     * alle auf ihre Anstoßposition.
     */
    swapSides() {
        this.isSecondHalf = true;
        const players = this.match.players2D || [];

        players.forEach(p => {
            p.baseX = 100 - p.baseX;
            p.baseY = 100 - p.baseY;
            p.x = 100 - p.x;
            p.y = 100 - p.y;
            p.vx = 0;
            p.vy = 0;
            p.speed = 0;
            p.facing = (p.facing || 0) + Math.PI;
        });

        // Referee ebenfalls spiegeln
        this.referee.x = 100 - this.referee.x;
        this.referee.y = 100 - this.referee.y;

        // Kurzer Moment, in dem sich alle sortieren
        this.sideSwapTimer = 2;

        this._tiefenRahmen = {}; // Zwischenspeicher leeren
        this._schwerpunkt = {};
        this._lageMitBall = {};
    }

    checkPhaseBanners(previousMinute, minute) {
        // "ANPFIFF" und "ZWEITE HALBZEIT" blendet die Anstoss-Zeremonie selbst
        // ein, sobald der Schiedsrichter pfeift - nicht der Minutenzaehler.
        if (previousMinute < 45 && minute >= 45) {
            const extra = this.match.timeline?.extraTime?.firstHalf;
            this.showBanner("HALBZEIT", extra ? `+${extra} Minuten Nachspielzeit` : null, "rgba(30, 41, 59, 0.94)");
        } else if (previousMinute < 46 && minute >= 46) {
            // Seitenwechsel und Anstoß für die 2. Halbzeit durchführen
            if (!this.isSecondHalf) {
                this.swapSides();
                const kickoffTeam = this.targetPossession[0] >= 50 ? "away" : "home";
                // Die Zeremonie wartet von sich aus, bis alle auf der neuen
                // Seite stehen - erst dann pfeift der Schiedsrichter an.
                this.startKickoff(kickoffTeam, "halftime");

                // Der Seitenwechsel ist ein Schnitt: Beide Mannschaften kommen
                // aus der Kabine und stellen sich gleich auf ihrer neuen Seite
                // auf. Vorher wurden nur die Positionen vom Ende der ersten
                // Halbzeit gespiegelt - wer tief in der gegnerischen Hälfte
                // stand, stand danach wieder dort und schaffte den Weg bis zum
                // Pfiff oft nicht. Der Anstoß lief dann mit Stürmern in der
                // falschen Hälfte.
                (this.match.players2D || []).forEach(p => {
                    const ziel = this.computeSetPieceTarget(p, this.deadBall);
                    if (!ziel) return;
                    p.x = ziel.x;
                    p.y = ziel.y;
                    p.targetX = ziel.x;
                    p.targetY = ziel.y;
                });
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

        // Eine Anstoß-Zeremonie wird nicht von einem fälligen Ereignis
        // überrannt - erst pfeift der Schiedsrichter an, dann geht es weiter.
        //
        // Dasselbe gilt für einen ruhenden Ball. Der Schutz fehlte hier, was
        // erst mit der schnelleren Spieluhr auffiel: Ereignisse werden nun
        // früher fällig und überrannten den Abstoß nach einem Schuss neben das
        // Tor - von neunzehn Fehlschüssen wurden nur noch fünfzehn ausgeführt.
        // Eine Spielfortsetzung darf nicht verschluckt werden, nur weil das
        // nächste Ereignis drängt.
        // Eine vorgemerkte Spielfortsetzung wird nicht von einer Szene
        // ueberrannt - sonst bliebe der Ball an der Seitenlinie liegen und
        // der naechste Anlauf muesste ihn von dort quer ueber das Feld holen.
        if (!this.kickoff && !this.deadBall && !this._offenerStandard && this.hasDueEvent()
            && !this.wartetAufBallgewinn()) {
            this.startHighlight();
            return;
        }

        this.updateAmbient(dt);
        this.match.checkForFinish();
    }

    /**
     * Wohin das Spiel vor einer Ecke laeuft: zum Schuetzen, den der Ticker
     * nennt - seine Hereingabe wird zur Ecke abgewehrt, und er steht dann
     * schon nahe der Fahne. Ohne Namen der am weitesten vorn stehende
     * Spieler auf der Seite der Ecke.
     */
    eckenZiel(ev) {
        const schuetze = this.getPlayer2D(this.protagonistId(ev));
        if (schuetze && schuetze.pos !== "TW" && schuetze.team === ev.team) return schuetze;
        const punkt = this.eventPoint(ev.start);
        if (!punkt || !ev.team) return null;
        const dir = this.attackDir(ev.team);
        const wert = (p) => p.x * dir - Math.abs(p.y - punkt.y) * 0.35;
        return this.teamPlayers(ev.team)
            .filter(p => p.pos !== "TW")
            .sort((a, b) => wert(b) - wert(a))[0] || null;
    }

    /**
     * Der Schnitt zur Eckfahne.
     *
     * Im Fernsehen wie im FM sieht man nicht, wie der Schuetze quer ueber
     * den Platz zur Fahne trabt und sich der Strafraum fuellt - es wird
     * geschnitten, und die Ecke ist fast aufgebaut. Vorher lag der Ball in
     * der Wiedergabe sekundenlang allein an der Fahne. Die letzten Schritte
     * laufen die Spieler sichtbar.
     */
    schnittZurEcke() {
        const info = this.deadBall;
        if (!info || info.kind !== "corner") return;
        const schuetze = this.getPlayer2D(this.sceneProtagonist) || this.getPlayer2D(this.carrierId);
        const dir = this.attackDir(info.team);
        (this.match.players2D || []).forEach(p => {
            let ziel;
            if (schuetze && p.id === schuetze.id) {
                ziel = { x: info.x - dir * 1.5, y: info.y + (info.y < 50 ? 1.2 : -1.2) };
                p.x = ziel.x - dir * 1.2;
                p.y = ziel.y + (info.y < 50 ? 1.5 : -1.5);
            } else {
                ziel = this.computeSetPieceTarget(p, info);
                if (!ziel) return;
                const rest = 0.22;
                p.x = ziel.x + (p.x - ziel.x) * rest;
                p.y = ziel.y + (p.y - ziel.y) * rest;
            }
            if (typeof p.vx === "number") { p.vx = 0; p.vy = 0; }
        });
        // Nach dem Schnitt steht die Ecke einen Moment, bevor sie kommt.
        // Eine Einblendung gibt es bewusst nicht: Sie laege oben ueber dem
        // Bild - genau dort, wo bei einer Ecke auf dieser Seite die Fahne steht.
        this.phaseMinRest = Math.max(this.phaseMinRest || 0, 0.9 * this.getSpeedScale() + this.bildschirmZeit(0.3));
    }

    /**
     * Eine Ecke entsteht, weil der Ball ueber die Torlinie geht.
     *
     * Vorher lag er einfach an der Fahne: Er rollte als ruhender Ball von da,
     * wo gerade gespielt wurde, quer ueber den Platz dorthin - die Ecke kam
     * aus dem Nichts. Jetzt wird die Hereingabe abgewehrt und geht zwischen
     * Pfosten und Fahne ins Aus. Erst dann wird der Ball an der Fahne
     * hingelegt.
     */
    eckeEinleiten(fahne, team, scale) {
        const ball = this.match.ball;
        const gegner = team === "home" ? "away" : "home";
        const torX = this.ownGoalX(gegner);
        const dir = this.attackDir(team);
        const seite = fahne.y < 50 ? -1 : 1;
        const aus = { x: torX + dir * 1.6, y: 50 + seite * _dirRandom.float(9, 28) };

        this.ballRoute = [
            { x: aus.x, y: aus.y, holderId: null, type: "cross" },
            { x: fahne.x, y: fahne.y, holderId: null, type: "dead" }
        ];
        this._routeScale = scale;
        this._routeHolder = null;
        this._routeDauer = this.etappenDauer(Math.hypot(aus.x - ball.x, aus.y - ball.y), scale)
            + LiveMatchDirector.ETAPPEN_ANNAHME[1] * scale
            + this.etappenDauer(Math.hypot(fahne.x - aus.x, fahne.y - aus.y), scale);
        this.startNextRouteLeg();
    }

    /**
     * Wen der Foulende foult.
     *
     * Die Zeitleiste nennt nur den Taeter - und waehlt ihn, ohne zu wissen,
     * wo er gerade steht. Gemessen stand er beim Pfiff im Median achtzehn
     * Einheiten vom Ball entfernt: Der Freistoss entstand, ohne dass ein
     * Gegner in der Naehe war. Gefoult wird deshalb der Gegenspieler, der
     * dem Taeter am naechsten steht - oder der Ballfuehrende, wenn der Taeter
     * schon bei ihm ist.
     */
    foulOpfer(ev, nurVorschau = false) {
        const team = this.attackingTeamOf(ev);
        if (!team) return null;
        const taeter = this.getPlayer2D(ev.playerId);
        const traeger = this.getPlayer2D(this.carrierId);
        const traegerPasst = traeger && traeger.team === team && traeger.pos !== "TW";
        if (!taeter) return traegerPasst ? traeger : null;
        if (traegerPasst && Math.hypot(taeter.x - traeger.x, taeter.y - traeger.y) < 12) return traeger;
        const kandidaten = this.teamPlayers(team).filter(p => p.pos !== "TW");
        if (!kandidaten.length) return nurVorschau ? null : traeger;
        return kandidaten.sort((a, b) =>
            Math.hypot(a.x - taeter.x, a.y - taeter.y) - Math.hypot(b.x - taeter.x, b.y - taeter.y))[0];
    }

    /**
     * Das Foul findet beim Gefoulten statt: Sein Ort wird zum Ereignisort.
     * Ein Elfmeterfoul bleibt im Strafraum.
     */
    verankereFoul(ev, opfer) {
        if (!ev || !opfer || ev.direkterFreistoss) return;
        let x = opfer.x;
        let y = opfer.y;
        if (ev.outcome === "penalty") {
            const torX = this.ownGoalX(ev.team);
            const dir = this.attackDir(ev.team);
            const tiefe = Math.max(2.5, Math.min(13.5, (x - torX) * dir));
            x = torX + dir * tiefe;
            y = Math.max(24, Math.min(76, y));
        }
        const rohX = this.isSecondHalf ? 100 - x : x;
        const rohY = this.isSecondHalf ? 100 - y : y;
        ev.start = { x: rohX, y: rohY };
        ev.end = { x: rohX, y: rohY };
    }

    /**
     * Die Mannschaft, die als Naechstes ihre Szene hat, wenn sie den Ball
     * gerade nicht hat - sonst null.
     */
    kommenderBesitzwechsel(team, vorlauf = LiveMatchDirector.BALLVERLUST_VORLAUF) {
        const ev = this.match.timeline[this.match.timelineIndex];
        if (!ev || !team) return null;
        const szenenTeam = this.attackingTeamOf(ev);
        if (!szenenTeam || szenenTeam === team) return null;
        if (this.eventTime(ev) - this.clock > vorlauf) return null;
        return szenenTeam;
    }

    /**
     * Eine faellige Szene wartet kurz, bis ihre Mannschaft den Ball im Spiel
     * erobert hat - statt ihn geschenkt zu bekommen.
     */
    wartetAufBallgewinn() {
        const ev = this.match.timeline[this.match.timelineIndex];
        if (!ev || !this.flow) return false;
        const traeger = this.getPlayer2D(this.carrierId);
        if (!traeger) return false;
        if (!this.kommenderBesitzwechsel(traeger.team, Infinity)) return false;
        if (this.clock - this.eventTime(ev) > LiveMatchDirector.BALLVERLUST_GNADE_SPIELZEIT) return false;
        // Gewartet wird ab dem Moment, ab dem gespielt wird: War das
        // Ereignis schon faellig, als die vorige Szene endete, bekommt das
        // freie Spiel trotzdem seine Zeit fuer die Eroberung.
        const index = this.match.timelineIndex;
        if (!this._ballgewinnWarten || this._ballgewinnWarten.index !== index) {
            this._ballgewinnWarten = { index, seit: this.elapsedReal || 0 };
        }
        const seit = Math.max(this._ballgewinnWarten.seit, this._freiesSpielSeitReal || 0);
        return (this.elapsedReal || 0) - seit < this.bildschirmZeit(LiveMatchDirector.BALLVERLUST_GNADE);
    }

    startHighlight() {
        const match = this.match;
        const events = [];
        let guard = 0;

        // Eine Szene endet in genau einer Spielfortsetzung: Ein Foul gibt einen
        // Freistoß, ein Schuss neben das Tor einen Abstoß. Werden beide in
        // dieselbe Szene gepackt, geht zwangsläufig eine der beiden verloren -
        // mit der schnelleren Spieluhr wurden mehr Ereignisse gleichzeitig
        // fällig, und es fehlten mal Abstöße, mal Freistöße. Deshalb bündelt
        // eine Szene höchstens ein Ereignis, das den Ball aus dem Spiel bringt.
        // Ein Foul, aus dem ein direkter Freistoß wird, gehört mit dem Schuss
        // in dieselbe Szene - sonst würde der Freistoß erst in den Strafraum
        // geflankt und der Ball danach für den Schuss zurückgeholt.
        const unterbricht = (ev) => ["goal", "save", "shot_miss"].includes(ev.type)
            || (ev.type === "foul" && ev.outcome !== "penalty" && !ev.direkterFreistoss);
        let schonUnterbrochen = false;

        // Eine Szene ist eine Passage, keine Minute.
        //
        // Gebündelt wurde bisher nur, was in derselben Spielminute stand. Bei
        // rund hundertfünfzig Ereignissen auf neunzig Minuten liegt aber in den
        // meisten Minuten genau eines, also bündelte sich so gut wie nie etwas:
        // Jedes Ereignis bekam seinen eigenen Anlauf, und gemessen gingen ein
        // Drittel der Übertragung dafür drauf. Zwischen zwei Szenen blieb Platz
        // für ein einziges freies Zuspiel - deshalb sah man keine Passstaffetten.
        //
        // Jetzt zieht eine Szene alles heran, was innerhalb des Fensters folgt,
        // auch wenn die Uhr noch nicht dort ist. Genau so überträgt das
        // Fernsehen auch: Der Angriff läuft durch, vom Aufbau bis zum Abschluss,
        // und danach wird geschnitten.
        const fenster = LiveMatchDirector.SZENEN_FENSTER;
        const eigeneMannschaft = this.attackingTeamOf(match.timeline[match.timelineIndex]);

        while (match.timelineIndex < match.timeline.length && guard++ < 8) {
            const ev = match.timeline[match.timelineIndex];

            if (events.length === 0) {
                // Das erste Ereignis muss fällig sein - vorgezogen wird nichts
                if (this.eventTime(ev) > this.clock) break;
            } else {
                // Die Passage endet, wenn zu viel Zeit vergeht ...
                if (this.eventTime(ev) - this.eventTime(events[0]) > fenster) break;
                // ... wenn die andere Mannschaft übernimmt ...
                const team = this.attackingTeamOf(ev);
                if (team && eigeneMannschaft && team !== eigeneMannschaft) break;
                // ... und an jeder Zäsur, die keine Fortsetzung kennt
                if (SZENEN_ENDE.includes(ev.type)) break;
                if (SZENEN_ENDE.includes(events[events.length - 1].type)) break;
            }

            if (schonUnterbrochen && unterbricht(ev)) break;

            if (unterbricht(ev)) schonUnterbrochen = true;
            events.push(ev);
            match.timelineIndex++;
            if (events.length >= 5) break;
        }

        if (events.length === 0) return;

        this.clock = Math.max(this.clock, this.eventTime(events[0]));
        this.syncMinute();

        const attackingTeam = this.attackingTeamOf(events[0]);
        if (attackingTeam) {
            this.possessionTeam = attackingTeam;
            this.possessionChain = 0;
        }

        // Ein Foul passiert dort, wo der Ball ist - nicht dort, wo die
        // Zeitleiste zufaellig einen Punkt notiert hat.
        this.verankereAmBall(events);

        // Und innerhalb einer Passage beginnt jede Aktion da, wo die vorige
        // aufgehoert hat.
        this.verketteSzene(events);

        this.mode = "highlight";
        this.carryTarget = null;
        this._annahmeTimer = 0;
        this.scene = { events, index: 0, phase: null };
        this.beginEventPhase("approach");
    }

    /**
     * Ereignisse ohne Ballfuehrung finden dort statt, wo der Ball liegt.
     *
     * Ein Foul, eine Karte, eine Verletzung: Fuer solche Ereignisse notiert
     * die Zeitleiste einen Ort, der mit dem laufenden Spiel nichts zu tun hat.
     * Die Regie holte den Ball bisher dorthin - gemessen war das der haeufigste
     * Grund fuer einen Balltransport quer ueber das Feld: In vierhundert-
     * sechsundvierzig von siebenhundertsechsundfuenfzig Faellen war das
     * naechste Ereignis eines ohne Ballfuehrung.
     *
     * Umgekehrt ist es richtig: Gefoult wird da, wo gespielt wird. Also wandert
     * das Ereignis zum Ball, nicht der Ball zum Ereignis.
     */
    verankereAmBall(events) {
        const ball = this.match.ball;
        // eventPoint spiegelt in Halbzeit zwei - hier also rueckwaerts rechnen
        const roh = this.isSecondHalf
            ? { x: 100 - ball.x, y: 100 - ball.y }
            : { x: ball.x, y: ball.y };

        events.forEach(ev => {
            if (!OHNE_BALLFUEHRUNG.includes(ev.type)) return;
            // Wechsel und Halbzeitpfiff haben ohnehin keinen Ort
            if (["substitution", "halftime", "fulltime"].includes(ev.type)) return;
            // Ein direkter Freistoß braucht seine Schussposition
            if (ev.direkterFreistoss) return;
            ev.start = { x: roh.x, y: roh.y };
            ev.end = { x: roh.x, y: roh.y };
        });

        this.verankereBeimSpieler(events[0]);
    }

    /**
     * Wo die Geometrie es zulaesst, kommt das Ereignis zum Spieler.
     *
     * Der Protagonist stand im Median zwanzig Meter von dem Punkt entfernt, den
     * die Zeitleiste fuer sein Ereignis notiert hat - und musste dorthin
     * laufen, bevor die Szene beginnen konnte. Gemessen ging dafuer knapp die
     * Haelfte der Uebertragung drauf.
     *
     * Fuer einen Schuss ist dieser Punkt wichtig: Er muss aus einer Lage
     * kommen, aus der man schiesst. Ein Steilpass, ein Dribbling oder ein
     * Zweikampf hat dagegen keinen vorgeschriebenen Ort - so etwas passiert da,
     * wo der Spieler gerade ist. Also wandert das Ereignis zu ihm, statt ihn zu
     * sich zu rufen, und die Richtung der Aktion bleibt erhalten.
     */
    verankereBeimSpieler(ev) {
        if (!ev || !ORTSFREI.includes(ev.type)) return;
        const held = this.getPlayer2D(this.protagonistId(ev));
        if (!held || !ev.start) return;

        // Bildschirm- zurueck in Zeitleisten-Koordinaten
        const rohX = this.isSecondHalf ? 100 - held.x : held.x;
        const rohY = this.isSecondHalf ? 100 - held.y : held.y;

        const dx = rohX - ev.start.x;
        const dy = rohY - ev.start.y;
        if (Math.hypot(dx, dy) < 6) return;

        ev.start = { x: rohX, y: rohY };
        if (ev.end && typeof ev.end.x === "number") {
            ev.end = {
                x: Math.max(3, Math.min(97, ev.end.x + dx)),
                y: Math.max(5, Math.min(95, ev.end.y + dy))
            };
        }
    }

    /**
     * Innerhalb einer Passage beginnt jede Aktion dort, wo die vorige endete.
     *
     * Die Zeitleiste notiert für jedes Ereignis eigene Koordinaten, die nichts
     * voneinander wissen: Ein Steilpass endet auf dem rechten Flügel, und die
     * Flanke danach beginnt laut Zeitleiste im linken Halbfeld. Die Regie holte
     * den Ball dann quer über das Feld - mitten in einem laufenden Angriff.
     *
     * Gemessen bekam deshalb jedes Ereignis seinen eigenen Anlauf, im Mittel
     * über achtundzwanzig Einheiten lang. Ein Angriff bestand aus drei
     * Balltransporten statt aus drei Zuspielen.
     *
     * Der Ball ist aber nach dem Steilpass genau dort, wo der Steilpass endete.
     * Also fängt die Flanke dort an. Nur das erste Ereignis einer Szene behält
     * seinen Ort - dorthin wird noch gespielt.
     */
    verketteSzene(events) {
        for (let i = 1; i < events.length; i++) {
            const vorher = events[i - 1];
            const jetzt = events[i];

            // Ein Ereignis ohne Ballführung wurde schon an den Ball geheftet
            if (OHNE_BALLFUEHRUNG.includes(jetzt.type)) continue;
            // Ein ruhender Ball hat seinen festen Platz: Eine Ecke wird von der
            // Fahne getreten, ein Elfmeter vom Punkt. Die dürfen nicht dorthin
            // wandern, wo die vorige Aktion endete.
            if (RUHENDER_BALL.includes(jetzt.type)) continue;
            if (jetzt.isFreekick) continue;
            if (!vorher.end || typeof vorher.end.x !== "number") continue;

            const richtung = { x: jetzt.end?.x, y: jetzt.end?.y };
            jetzt.start = { x: vorher.end.x, y: vorher.end.y };

            // Der Zielpunkt bleibt, wo er war - ein Schuss geht weiter aufs
            // Tor, eine Flanke weiter in den Strafraum. Nur wenn Start und
            // Ziel dadurch zusammenfallen, bekommt die Aktion wieder Länge.
            if (typeof richtung.x === "number"
                && Math.hypot(richtung.x - jetzt.start.x, richtung.y - jetzt.start.y) < 4) {
                jetzt.end = {
                    x: Math.max(3, Math.min(97, jetzt.start.x + this.attackDirRaw(jetzt.team) * 12)),
                    y: Math.max(5, Math.min(95, jetzt.start.y + (Math.random() - 0.5) * 18))
                };
            }
        }
    }

    /**
     * Die Angriffsrichtung einer Mannschaft in Zeitleisten-Koordinaten.
     *
     * attackDir() rechnet in Bildschirmkoordinaten und dreht in Halbzeit zwei
     * mit. Hier werden Ereignisorte umgeschrieben, und die stehen ungespiegelt
     * in der Zeitleiste.
     */
    attackDirRaw(team) {
        return team === "home" ? 1 : -1;
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

    /**
     * Ereignisort auf das Spielfeld übersetzen.
     *
     * Die Timeline beschreibt jedes Spiel im Bild der ersten Halbzeit: Die
     * Heimmannschaft greift immer nach rechts an. Nach dem Seitenwechsel ist
     * das gespiegelt - ohne diese Übersetzung flog in Halbzeit zwei jeder
     * Schuss ins eigene Tor, und damit die Hälfte aller Schüsse einer Partie.
     * Die Timeline selbst bleibt unangetastet, sonst würden Spielbericht und
     * Sofortsimulation auseinanderlaufen.
     */
    eventPoint(point) {
        if (!point) return null;
        if (!this.isSecondHalf) return { x: point.x, y: point.y };
        return { x: 100 - point.x, y: 100 - point.y };
    }

    /**
     * Wer führt das Ereignis aus? Genau der Spieler, den der Ticker nennt.
     * Bei einer Parade ist das der Schütze - der Torwart ist die Antwort
     * darauf, nicht der Auslöser.
     */
    protagonistId(ev) {
        if (!ev) return null;
        if (OHNE_BALLFUEHRUNG.includes(ev.type)) return null;
        if (ev.type === "save") return ev.shooterId ?? null;
        return ev.fromPlayerId ?? ev.playerId ?? ev.shooterId ?? null;
    }

    /**
     * Ist der Anlauf abgeschlossen? Der genannte Spieler muss mit dem Ball
     * am Ereignisort stehen - vorher wurde der Ball einfach an die Koordinate
     * geschoben, während die genannten Spieler noch unterwegs waren.
     */
    approachReady() {
        const ev = this.currentEvent();
        if (!ev) return true;

        const start = this.eventPoint(ev.start);
        if (!start) return true;
        if (this.match.ball.inFlight) return false;

        const ball = this.match.ball;

        // Ein Foul braucht einen Foulenden: Gepfiffen wird erst, wenn er am
        // Ballfuehrenden ist. Vorher kam der Pfiff, sobald der Ball am Tatort
        // lag - oft mit dem naechsten Gegner zwanzig Meter weit weg.
        if (FOUL_ARTEN.includes(ev.type)) {
            const taeter = this.getPlayer2D(ev.playerId);
            if (taeter && Math.hypot(taeter.x - ball.x, taeter.y - ball.y) > 2.6) return false;
        }

        const held = this.getPlayer2D(this.sceneProtagonist);
        if (!held) return Math.hypot(ball.x - start.x, ball.y - start.y) < 4;

        // Spieler am Ort - und der Ball bei ihm
        return Math.hypot(held.x - start.x, held.y - start.y) < 4
            && Math.hypot(ball.x - held.x, ball.y - held.y) < 4;
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
            // Ein Foul passiert beim Gefoulten, und der Foulende geht dort
            // in den Zweikampf
            const foulOpfer = FOUL_ARTEN.includes(ev.type) && !ev.direkterFreistoss
                ? this.foulOpfer(ev) : null;
            if (foulOpfer) this.verankereFoul(ev, foulOpfer);

            const start = this.eventPoint(ev.start) || { x: ball.x, y: ball.y };

            // Eine Ecke wird als ruhender Ball aufgebaut: Schütze an die
            // Fahne, der Strafraum füllt sich, dann erst kommt die Flanke.
            if (ev.type === "corner") {
                const ecke = { kind: "corner", team: ev.team, x: start.x, y: start.y };
                // Liegt der Ball noch im Feld, wird die Ecke erst eingeleitet:
                // Ruhend ist er, sobald er an der Fahne liegt - vorher ist er
                // noch im Spiel.
                if (Math.hypot(start.x - ball.x, start.y - ball.y) > 6) {
                    this._eckeNachRoute = ecke;
                } else {
                    this.deadBall = ecke;
                    this.match.setPiece = { ...ecke };
                    this._eckeSchnitt = true;
                }
                this.cueSound("whistle");
            }

            // Elfmeter: Zwischen Pfiff und Ausführung liegen in der Timeline
            // fünfzehn Sekunden - die Regie ist dazwischen längst wieder im
            // Aufbauspiel und spielt den Schuss als eigene Szene. Deshalb
            // merkt sie sich den Elfmeterpfiff, statt in der Szene zu suchen.
            // Dann räumt sich der Strafraum, der Torwart geht auf die Linie
            // und der Schütze legt sich den Ball zurecht.
            const elfmeter = this.pendingPenalty
                && this.clock - this.pendingPenalty.clock < 90
                && ["goal", "save", "shot_miss"].includes(ev.type);

            if (elfmeter) {
                const schuetzenTeam = ev.type === "save" ? (ev.team === "home" ? "away" : "home") : ev.team;
                this.deadBall = { kind: "penalty", team: schuetzenTeam, x: start.x, y: start.y };
                this.match.setPiece = { kind: "penalty", team: schuetzenTeam, x: start.x, y: start.y };
                this.pendingPenalty = null;
            }

            // Direkter Freistoß: Die Mauer stellt sich, der Schütze legt sich
            // den Ball zurecht - dann geht er aufs Tor.
            const freistoss = !elfmeter && !!ev.isFreekick && ["goal", "save", "shot_miss"].includes(ev.type);
            if (freistoss) {
                const schuetzenTeam = ev.type === "save" ? (ev.team === "home" ? "away" : "home") : ev.team;
                this.deadBall = { kind: "freekick", team: schuetzenTeam, x: start.x, y: start.y, direkt: true };
                this.match.setPiece = { kind: "freekick", team: schuetzenTeam, x: start.x, y: start.y };
                this.setPieceWall = this.buildWall(schuetzenTeam, start.x, start.y);
                this.cueSound("whistle");
            }

            // Wer die Ecke tritt, steht nicht immer in der Timeline - dann
            // übernimmt der beste Standardschütze der Mannschaft.
            let held = this.getPlayer2D(this.protagonistId(ev));
            if (!held && ev.type === "corner") {
                held = this.pickSetPieceTaker("corner", ev.team, start.x, start.y);
            }
            if (!held && foulOpfer) held = foulOpfer;
            this.sceneProtagonist = held ? held.id : null;
            if (this._eckeSchnitt) {
                this._eckeSchnitt = false;
                if (held) { this.carrierId = held.id; }
                this.schnittZurEcke();
            }

            if (ev.type === "corner" || elfmeter || freistoss) {
                // Der ruhende Ball wird hingelegt, der Schütze kommt dazu -
                // niemand dribbelt den Ball zum Elfmeterpunkt.
                //
                // Und niemand schießt ihn dorthin: Vorher flog der Ball als
                // "Pass" quer über das Feld an die Eckfahne, bis zu achtund-
                // neunzig Meter weit. Eine Ecke ist aber eine Unterbrechung -
                // der Ball wird geholt und hingelegt. Also liegt er einfach
                // dort, und der Anlauf zeigt, wie sich der Strafraum füllt.
                // Schnell hingelegt, aber nicht gesprungen: Ein Sprung waere
                // dasselbe Zucken, das den Ball vorher "durch die Gegend"
                // fliegen liess - nur haerter.
                const zurFahne = Math.hypot(start.x - ball.x, start.y - ball.y);
                if (ev.type === "corner" && zurFahne > 6) {
                    this.eckeEinleiten(start, ev.team, scale);
                } else {
                    this.setBallTravel(start.x, start.y, Math.max(0.32, zurFahne / 240), "dead");
                }
                if (held) {
                    this.carrierId = held.id;
                    this.possessionTeam = held.team;
                    this.match.activePlayerId = held.id;
                }
                this.match.ball.holderId = null;
            } else if (held) {
                // Der Ball geht zu dem Spieler, den der Ticker nennt - über
                // seine Mitspieler, wenn er weit weg ist, und läuft dann mit
                // ihm, bis er am Ereignisort ist.
                //
                this.possessionTeam = held.team;

                // Hat er den Ball schon, gibt es nichts zu transportieren.
                //
                // Das ist der Normalfall, seit das Aufbauspiel den kommenden
                // Protagonisten sucht: Der Ball ist ueber gewoehnliche Zuspiele
                // bei ihm angekommen, und die Szene beginnt dort, wo gespielt
                // wird. Er nimmt den Ball dann mit zum Ereignisort - der Anlauf
                // ist ein Lauf mit dem Ball statt eines Balltransports.
                const hatBall = this.carrierId === held.id
                    && Math.hypot(held.x - ball.x, held.y - ball.y) < 6;

                if (hatBall) {
                    this.ballRoute = [];
                    this._routeHolder = held.id;
                    this._routeDauer = 0;
                } else {
                    // Sonst wie bisher: Der Ball kommt ihm entgegen, waehrend
                    // er laeuft. Auf seine alte Position gezielt kaeme er an,
                    // wenn der Spieler schon weg ist; auf den Ereignisort
                    // gezielt laege er lange vor ihm da.
                    const zielX = held.x + (start.x - held.x) * 0.5;
                    const zielY = held.y + (start.y - held.y) * 0.5;
                    this.routeBallTo(zielX, zielY, held.team, "pass", scale, held.id);
                }
            } else {
                // Vor einem direkten Freistoß trägt die gefoulte Mannschaft den
                // Ball zum Tatort, nicht der Foulende
                const traeger = ev.direkterFreistoss ? this.attackingTeamOf(ev) : (ev.team || this.possessionTeam);
                this.routeBallTo(start.x, start.y, traeger, "pass", scale, null);
            }

            this.assignSceneRoles(ev, "approach");

            // Höchstdauer nach Laufweg: Wer von der eigenen Hälfte an die
            // Eckfahne muss, braucht länger als jemand, der schon dort steht.
            // Beendet wird der Anlauf ohnehin, sobald alle da sind.
            // Beim Foul zaehlt der Weg des Foulenden zum Ball
            const taeter = FOUL_ARTEN.includes(ev.type) ? this.getPlayer2D(ev.playerId) : null;
            const laufweg = taeter
                ? Math.max(Math.hypot(taeter.x - start.x, taeter.y - start.y), Math.hypot(ball.x - start.x, ball.y - start.y))
                : held
                    ? Math.hypot(held.x - start.x, held.y - start.y)
                    : Math.hypot(ball.x - start.x, ball.y - start.y);
            // Der Anlauf bekommt die Zeit, die der Weg braucht - nicht
            // umgekehrt.
            //
            // Vorher wurde die Hoechstdauer mit der Zeitraffung multipliziert:
            // Bei Tempo 2 blieben rund sieben Zehntelsekunden, um zwanzig Meter
            // zu ueberbruecken. Der Spieler musste dafuer mit dreissig Metern
            // je Sekunde laufen - und genau das sah man, ein Zucken statt eines
            // Laufs. Gemessen erreichte das obere Ende dreiundvierzig Meter je
            // Sekunde.
            //
            // Ein Laufweg ist aber kein Teil der Spieluhr: Er braucht
            // Bildschirmzeit, egal wie schnell die Minuten vergehen. Also wird
            // hier mit dem Tempo gerechnet, das ein Spieler wirklich hat.
            //
            // Die Obergrenze ist die Notbremse, nicht das Budget: Der Anlauf
            // endet ohnehin in dem Moment, in dem der genannte Spieler mit dem
            // Ball am Ereignisort ist. Sie war mit 3.2 Sekunden aber so knapp,
            // dass sie genau die langen Wege abschnitt - wer dreissig Meter zu
            // laufen hatte, kam nur einundzwanzig weit, und die Szene begann
            // ohne ihn. Gemessen stand nur bei 63 Prozent der Ereignisse der
            // genannte Spieler auch dort, wo das Ereignis stattfand.
            //
            // Gerechnet wird mit dem *langsamsten* Laeufer, nicht mit dem
            // schnellsten: Ein Innenverteidiger am Ende einer Partie kommt auf
            // rund zwei Drittel des Tempos, mit dem hier vorher kalkuliert
            // wurde - und genau er stand dann nicht am Ereignisort.
            const laufTempo = LINE_BASE_SPEED.def * ANLAUF_URGENZ * 0.7 * this.getMotionTempo();
            const obergrenze = this.bildschirmZeit(ev.type === "corner" ? 12 : 10);
            this.phaseTimer = Math.min(obergrenze, this.bildschirmZeit(0.35) + laufweg / laufTempo)
                + this.bildschirmZeit(0.25);
            // Der Anlauf endet nie, bevor der Ball seinen Weg hinter sich hat -
            // und danach braucht der Spieler noch einen Augenblick, um ihn
            // anzunehmen. Mit dem langsameren, glaubwuerdigen Ball reichte der
            // alte Zuschlag von einer Viertelsekunde nicht mehr: Der Anlauf
            // lief aus, waehrend der Ball noch unterwegs war, und der im Ticker
            // genannte Spieler stand ohne ihn da.
            this.phaseTimer = Math.max(this.phaseTimer, (this._routeDauer || 0) + this.bildschirmZeit(0.7));

            // Ein ruhender Ball braucht seine Zeit: Ecke und Elfmeter werden
            // zurechtgelegt, auch wenn der Schütze schon dasteht.
            this.phaseMinRest = (ev.type === "corner" || elfmeter || freistoss)
                ? 1.7 * scale + this.bildschirmZeit(0.35)
                : 0;
            return;
        }

        if (phase === "action") {
            // War der Anlauf schneller vorbei als die Ballroute, liegt der Ball
            // noch zwischen zwei Stationen. Dann zählt die Regel vor der
            // Optik: Wer im Ticker genannt wird, hat den Ball auch wirklich.
            this.finishBallRoute();

            const end = this.eventPoint(ev.end) || this.eventPoint(ev.start) || { x: ball.x, y: ball.y };
            const actionType = this.getActionType(ev);
            let duration = this.getActionDuration(ev, actionType) * scale;
            // Flankenart: flach und scharf oder hoch und weich
            if (actionType === "cross" && ev.team) {
                const art = this.taktik(ev.team).w.flankenart;
                this._flankenBogen = art === "flach" ? 0.35 : (art === "hoch" ? 1.35 : 1);
                duration *= art === "flach" ? 0.8 : (art === "hoch" ? 1.12 : 1);
            }

            // Der ruhende Ball des Anlaufs ist mit dem Abspiel vorbei
            this.deadBall = null;
            this.match.setPiece = null;
            this._eckeNachRoute = null;

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
        if (this.phaseMinRest > 0) this.phaseMinRest = Math.max(0, this.phaseMinRest - dt);

        const phase = this.scene?.phase;

        // Die eingeleitete Ecke: Liegt der Ball an der Fahne, ist er ruhend
        if (this._eckeNachRoute && !this.match.ball.inFlight && !(this.ballRoute && this.ballRoute.length)) {
            this.deadBall = this._eckeNachRoute;
            this.match.setPiece = { ...this._eckeNachRoute };
            this._eckeNachRoute = null;
            this.schnittZurEcke();
        }

        // Der Anlauf endet, sobald der genannte Spieler mit dem Ball am
        // Ereignisort ist - der Timer ist nur die Notbremse. Ein ruhender
        // Ball wartet zusätzlich seine Mindestzeit ab.
        if (phase === "approach" && this.phaseTimer > 0
            && (this.phaseMinRest > 0 || !this.approachReady())) return;
        if (phase !== "approach" && this.phaseTimer > 0) return;
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
        const events = this.scene?.events || [];
        const lastEvent = events[events.length - 1] || null;

        // Ein Foul im Ticker muss auch einen Freistoß zur Folge haben - vorher
        // wurde nur kurz unterbrochen und dann irgendwo weitergespielt.
        // Enthaelt eine Szene ein Foul UND einen Abschluss, zaehlt das spaetere
        // Ereignis fuer die Spielfortsetzung. Vorher gewann immer das Foul, und
        // der Abstoss nach dem Schuss neben das Tor fiel aus.
        const foulIdx = events.map(e => e.type === "foul" && e.outcome !== "penalty")
            .lastIndexOf(true);
        const abschlussIdx = events.map(e => ["goal", "save", "shot_miss"].includes(e.type))
            .lastIndexOf(true);
        const foul = (foulIdx >= 0 && foulIdx > abschlussIdx) ? events[foulIdx] : null;

        this.scene = null;
        this.sceneProtagonist = null;
        this.deadBall = null;
        this.match.setPiece = null;
        this.mode = "ambient";

        if (foul) {
            const tatort = this.eventPoint(foul.start) || { x: 50, y: 50 };
            // Den Ball bekommt die gefoulte Mannschaft
            const team = foul.team === "home" ? "away" : "home";
            this.startAmbient(team);
            this.startDeadBall("freekick", team,
                Math.max(6, Math.min(94, tatort.x)),
                Math.max(6, Math.min(94, tatort.y)));
            this.match.checkForFinish();
            return;
        }

        // Eine Szene bündelt mehrere Ereignisse. Für die Spielfortsetzung zählt
        // das letzte, das den Ball aus dem Spiel bringt - nicht das letzte
        // überhaupt. Stand nach dem Schuss neben das Tor noch eine Karte oder
        // ein Zweikampf in derselben Szene, fiel der Abstoß sonst aus: Von
        // zweiundzwanzig Fehlschüssen wurden nur achtzehn fortgesetzt.
        const abschluss = abschlussIdx >= 0 ? events[abschlussIdx] : lastEvent;

        if (this.resumeAfterShot(abschluss)) {
            this.match.checkForFinish();
            return;
        }

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

    /**
     * Wie geht es nach einem Schuss weiter?
     *
     * Bisher sprang der Ball nach jeder Parade und jedem Fehlschuss zu einem
     * beliebigen Spieler irgendwo auf dem Feld. Ein Schuss neben das Tor ist
     * aber ein Abstoß, und eine Parade endet damit, dass der Torwart den Ball
     * hat oder ihn abklatschen lässt.
     *
     * Gibt true zurück, wenn die Fortsetzung übernommen wurde.
     */
    resumeAfterShot(ev) {
        if (!ev || (ev.type !== "save" && ev.type !== "shot_miss")) return false;

        // Bei einer Parade steht in der Timeline die verteidigende Mannschaft
        const schiessendes = ev.type === "save"
            ? (ev.team === "home" ? "away" : "home")
            : ev.team;
        const verteidigt = schiessendes === "home" ? "away" : "home";
        const ziel = this.eventPoint(ev.end) || { x: 50, y: 50 };

        if (ev.type === "shot_miss" && ev.outcome !== "woodwork") {
            // Der Ball ist hinter der Grundlinie: Abstoß
            this.startAmbient(verteidigt, { pickCarrier: false });
            const torX = this.ownGoalX(verteidigt);
            this.startDeadBall("goalkick", verteidigt, torX + this.attackDir(verteidigt) * 4, 50);
            return true;
        }

        if (ev.type === "shot_miss") {
            // Aluminium: der Ball springt zurück ins Feld
            this.startAmbient(verteidigt, { pickCarrier: false });
            const prall = {
                x: ziel.x + this.attackDir(verteidigt) * _dirRandom.float(6, 14),
                y: Math.max(6, Math.min(94, ziel.y + _dirRandom.float(-10, 10)))
            };
            this.setBallTravel(prall.x, prall.y, 0.4 * this.getSpeedScale() + this.bildschirmZeit(0.12), "pass");
            this.claimLooseBall(prall);
            return true;
        }

        const keeper = this.getPlayer2D(ev.gkId)
            || this.teamPlayers(verteidigt).find(p => p.pos === "TW");

        if (keeper && _dirRandom.chance(0.62)) {
            // Festgehalten: Der Torwart hat den Ball und eröffnet neu
            this.startAmbient(verteidigt, { pickCarrier: false });
            this.possessionTeam = verteidigt;
            this.setCarrier(keeper);
            this.setBallTravel(keeper.x, keeper.y, 0.3 * this.getSpeedScale() + this.bildschirmZeit(0.1), "pass");
            this.match.lastCommentary =
                `${this.match.minute}' - ${keeper.name || "Der Torwart"} hat den Ball sicher und eröffnet neu.`;
            return true;
        }

        // Abgeklatscht: Abpraller im Strafraum
        this.startAmbient(verteidigt, { pickCarrier: false });
        const prall = {
            x: ziel.x + this.attackDir(verteidigt) * _dirRandom.float(4, 11),
            y: Math.max(6, Math.min(94, ziel.y + _dirRandom.float(-9, 9)))
        };
        this.setBallTravel(prall.x, prall.y, 0.35 * this.getSpeedScale() + this.bildschirmZeit(0.12), "pass");
        this.claimLooseBall(prall);
        this.match.lastCommentary =
            `${this.match.minute}' - Abgeklatscht! Der Ball bleibt im Strafraum.`;
        return true;
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
            this.startKickoff(kickoffTeam, "goal");
            return;
        }

        this.scene.index++;
        if (this.scene.index >= this.scene.events.length) {
            this.scene = null;
            this.mode = "ambient";
            this.startKickoff(kickoffTeam, "goal");
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

    /**
     * Ereignisse einer abgebrochenen Szene nachtragen.
     *
     * Gezählt wird still: Die Inszenierung ist vorbei, aber Tore, Schüsse und
     * Karten gehören in die Statistik. Ohne das fehlte der Live-Anzeige jedes
     * Ereignis, das der Halbzeitpfiff unterbrochen hat.
     */
    flushScene() {
        if (!this.scene) return;
        const events = this.scene.events || [];
        for (let i = this.scene.index; i < events.length; i++) {
            const ev = events[i];
            if (!ev || ev._resolved) continue;
            ev._resolved = true;
            this.match.processEvent(ev);
        }
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

        const tatort = this.eventPoint(ev.start) || this.eventPoint(ev.end) || null;

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
        } else if (ev.type === "foul" && ev.direkterFreistoss) {
            const gefoult = ev.team === "home"
                ? (this.match.awayClub?.name || "Gast")
                : (this.match.homeClub?.name || "Heim");
            this.showBanner("🎯 FREISTOSS", `in Schussweite · ${gefoult}`, "rgba(30, 64, 175, 0.94)");
        } else if (ev.type === "foul" && (ev.outcome === "penalty" || ev.isPenalty)) {
            // Der Schuss vom Punkt kommt als eigenes Ereignis - hier wird
            // vorgemerkt, dass er als Elfmeter zu inszenieren ist.
            this.pendingPenalty = { clock: this.clock, team: ev.team === "home" ? "away" : "home" };
            this.showBanner("🛑 ELFMETER!", club, "rgba(30, 64, 175, 0.94)");
            this.startDrama("penalty", { duration: 2.4, refereeTarget: this.eventPoint(ev.end) || tatort });
        }
    }

    applyEventBallState(ev, hard) {
        if (!hard || !ev?.end) return;
        const ziel = this.eventPoint(ev.end);
        const ball = this.match.ball;
        ball.x = ziel.x;
        ball.y = ziel.y;
        ball.targetX = ziel.x;
        ball.targetY = ziel.y;
        ball.originX = ziel.x;
        ball.originY = ziel.y;
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

        const start = this.eventPoint(ev.start) || match.ball;
        const end = this.eventPoint(ev.end) || start;

        // Der Ausführende der Szene hat Vorrang: Bei einer Ecke etwa nennt die
        // Timeline keinen Schützen, der Regisseur hat aber einen bestimmt.
        const passer = this.getPlayer2D(this.sceneProtagonist) || this.getPlayer2D(passerId);
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
            // Im Anlauf wird gesprintet - der Ausfuehrende soll rechtzeitig da
            // sein. Seit das Grundtempo halbiert ist, muss dieser Zuschlag
            // groesser ausfallen: Mit dem alten Wert stand der im Ticker
            // genannte Spieler nur noch bei 76 statt bei 99 Prozent der
            // Ereignisse am Ort - er kam schlicht nicht mehr an.
            //
            // Das ist auch richtig so: Wer zur Szene muss, sprintet. Das
            // ruhige Trabtempo gilt fuer die zweiundzwanzig anderen.
            setRole(passer, start.x, start.y, phase === "approach" ? ANLAUF_URGENZ : 1.9);
        }
        if (receiver && receiver !== passer) {
            const tx = phase === "approach" ? (start.x + end.x) / 2 : Math.max(4, Math.min(96, end.x - this.attackDir(receiver.team) * 5));
            const ty = phase === "approach" ? (start.y + end.y) / 2 : end.y;
            setRole(receiver, tx, ty, phase === "approach" ? ANLAUF_URGENZ * 0.8 : 1.8);
        }
        if (keeper) {
            if (ev.type === "save" && phase === "action") {
                // Der Torwart geht in die Ecke, in die geschossen wird -
                // vorher stellte er sich in die Mitte und der Ball flog
                // irgendwo daneben ins Tor.
                const torX = this.ownGoalX(keeper.team);
                const dir = this.attackDir(keeper.team);
                setRole(keeper, torX + dir * 2.5, Math.max(38, Math.min(62, end.y)), 2.4);

                keeper.diving = 0.85;
                keeper.diveAngle = Math.atan2(end.y - keeper.y, (torX + dir * 2.5) - keeper.x);
            } else {
                setRole(keeper, this.ownGoalX(keeper.team) + this.attackDir(keeper.team) * 3, 50 + (end.y - 50) * 0.5, 1.7);
            }
        }

        match.activePlayerId = (phase === "action" && receiver) ? receiver.id : (passer?.id ?? receiver?.id ?? match.activePlayerId);
    }

    // ---------------------------------------------------- Ambient-Spielfluss

    startAmbient(team, options = {}) {
        this.mode = "ambient";
        // Ab jetzt kann der Gegner den Ball im Spiel erobern
        this._freiesSpielSeitReal = this.elapsedReal || 0;
        this.possessionTeam = team === "away" ? "away" : "home";
        this.match.sceneRoles = null;
        this.ambientTimer = 0;
        this.ambientInterval = 0.35;
        // Nach einer Parade oder einem Standard steht schon fest, wer den Ball
        // hat - dann darf ihn niemand neu zugelost bekommen.
        if (options.pickCarrier !== false) this.pickAmbientCarrier();
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

        // Ein Lauf mit dem Ball endet, sobald ihn jemand anders hat
        if (this.carryTarget && this.carryTarget.id !== player.id) this.carryTarget = null;

        if (player.team === this.possessionTeam) {
            this.possessionChain = (this.possessionChain || 0) + 1;
        } else {
            this.possessionChain = 0;
            this.possessionTeam = player.team;
        }
        this.carrierId = player.id;
        this.match.ball.holderId = player.id;
        this.match.activePlayerId = player.id;

        const phase = this.flow ? this.flow.derivePhase(player, player.team) : null;
        this.match.flowPhase = phase;

        // Für die Anzeige: Wer ist am Ball, in welcher Phase, seit wie vielen
        // Stationen? Daraus wird auf dem Feld ein erkennbarer Angriff statt
        // eines Balls, der irgendwo herumliegt.
        this.match.attack = {
            team: player.team,
            phase,
            chain: this.possessionChain || 0
        };
    }

    /**
     * Der Spieler, auf den das Aufbauspiel gerade zuspielt.
     *
     * Das ist der Protagonist des naechsten Ereignisses - aber nur, wenn es
     * bald ansteht, wenn er mitspielt und wenn seine Mannschaft am Ball ist.
     * Sonst gibt es kein Ziel und das Aufbauspiel laeuft frei.
     */
    anlaufZiel() {
        const ev = this.match.timeline[this.match.timelineIndex];
        if (!ev) return null;

        const vorlauf = this.eventTime(ev) - this.clock;
        if (vorlauf > LiveMatchDirector.ANLAUF_VORLAUF) return null;

        // Vor einer Ecke treibt die Mannschaft den Ball auf dieser Seite nach
        // vorn - die Ecke entsteht aus dem Angriff
        if (ev.type === "corner") return this.eckenZiel(ev);

        // Vor einem Foul spielt die gefoulte Mannschaft dorthin, wo der
        // Foulende steht - gefoult wird, wer ihm in die Arme laeuft
        if (FOUL_ARTEN.includes(ev.type) && !ev.direkterFreistoss) {
            const opfer = this.foulOpfer(ev, true);
            return opfer && opfer.pos !== "TW" ? opfer : null;
        }
        if (OHNE_BALLFUEHRUNG.includes(ev.type)) return null;

        const held = this.getPlayer2D(this.protagonistId(ev));
        if (!held || held.pos === "TW") return null;

        // Nur die Mannschaft, der das Ereignis gehoert, spielt darauf zu
        const team = this.attackingTeamOf(ev);
        if (team && held.team !== team) return null;

        return held;
    }

    updateAmbient(dt) {
        if (this.kickoff) {
            this.updateKickoff(dt);
            return;
        }

        if (this.deadBallTimer > 0) {
            this.deadBallTimer -= dt;
            if (this.deadBallTimer <= 0) this.resumeFromDeadBall();
            return;
        }

        // Der Wartetakt laeuft, waehrend der Ball unterwegs ist.
        //
        // Vorher begann er erst, wenn der Ball angekommen und angenommen war -
        // Flugzeit, Annahme und Takt addierten sich also. Solange der Ball mit
        // vierzig Metern je Sekunde durch die Gegend schoss, fiel das nicht
        // auf. Mit glaubwuerdigem Balltempo dagegen brach das Aufbauspiel
        // zusammen: gemessen von sechsundvierzig auf sechzehn Aktionen je
        // Partie, weil der Ball zwei Drittel der Zeit unterwegs war und in
        // dieser Zeit nichts gezaehlt wurde.
        //
        // Ein Spieler entscheidet aber, waehrend der Ball zu ihm unterwegs
        // ist, nicht erst danach. Also laeuft die Uhr mit, und gespielt wird,
        // sobald der Ball liegt.
        this.ambientTimer += dt;

        // Ein Ball, der noch unterwegs ist, wird nicht weitergespielt - und wer
        // ihn gerade bekommen hat, nimmt ihn erst an.
        if (this.match.ball.inFlight) return;
        if (this._annahmeTimer > 0) {
            this._annahmeTimer -= dt;
            return;
        }

        // Der Ball ist über die Linie gerollt - jetzt wird er geholt und für
        // die Spielfortsetzung hingelegt.
        if (this._offenerStandard) {
            if (this.match.ball.inFlight) return;
            this.fuehreOffenenStandardAus();
            return;
        }

        // Die Taktung des Ballbesitzspiels folgt der Spielzeit, nicht der
        // Bildschirmzeit. Vorher zählte hier die echte Sekunde: Wer schneller
        // zusah, bekam weniger Aktionen zu sehen - bei gleicher Spieldauer von
        // neunzig Minuten. Ein Spiel hat aber gleich viele Zuspiele, egal in
        // welchem Tempo man es verfolgt.
        // Und sie ist dichter als vorher: Ein echtes Spiel hat achthundert bis
        // tausend Zuspiele. Weil der Anlauf einer Szene jetzt abwartet, bis
        // der Ball seinen Weg über die Mitspieler hinter sich hat, bleibt für
        // das laufende Spiel weniger Zeit - die muss dafür mehr zeigen.
        if (this.ambientTimer < this.ambientInterval * this.getSpeedScale() * this.AMBIENT_TAKT) return;
        this.ambientTimer = 0;

        // Ein Lauf mit dem Ball wird zu Ende gelaufen, bevor der naechste
        // Ballkontakt kommt - sonst waere er nach einem Wimpernschlag vorbei.
        if (this.carryTarget) {
            const laeufer = this.getPlayer2D(this.carryTarget.id);
            const fertig = !laeufer
                || (this.carryTarget.rest -= dt) <= 0
                || Math.hypot(laeufer.x - this.carryTarget.x, laeufer.y - this.carryTarget.y) < 1.8;
            if (!fertig) return;
            this.carryTarget = null;
        }

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

        const ziel = this.anlaufZiel();
        let action = this.flow.decide(carrier, {
            chainLength: this.possessionChain || 0,
            zielSpieler: (ziel && ziel.team === carrier.team && ziel.id !== carrier.id) ? ziel : null
        });
        if (!action) {
            this.ambientInterval = 0.8;
            return;
        }

        // Die naechste Szene gehoert dem Gegner: Er erobert den Ball jetzt,
        // sichtbar mit abgefangenem Pass oder gewonnenem Zweikampf. Der
        // Torwart verliert ihn nicht - sein Abspiel landet beim Mitspieler,
        // und der verliert ihn dann.
        if (carrier.pos !== "TW"
            && (action.outcome === "complete" || action.outcome === "beaten")
            && this.kommenderBesitzwechsel(carrier.team)
            && typeof this.flow.alsBallverlust === "function") {
            const verlust = this.flow.alsBallverlust(carrier, action);
            if (verlust) {
                action = verlust;
                this.flowStats.ballgewinneVorSzene = (this.flowStats.ballgewinneVorSzene || 0) + 1;
            }
        }

        this.applyFlowAction(action);

        // Die Pause zwischen zwei Ballkontakten steckt jetzt in der echten
        // Flugzeit des Balls und in der Ballannahme. Der Wartetakt obendrauf
        // war die alte, einzige Taktung - beide zusammen zaehlen dieselbe
        // Pause doppelt.
        // Nur noch ein kurzer Rest, damit nicht alles im Gleichtakt laeuft.
        this.ambientInterval = this.flow.getActionInterval(carrier.team, action.type) * 0.18;
    }

    applyFlowAction(action) {
        const from = action.from;
        const to = action.to;
        const dist = Math.hypot((to.x ?? from.x) - from.x, (to.y ?? from.y) - from.y);

        const actionType = action.type === "longball" ? "cross" : "pass";
        // Die geplante Dauer ist im Grundtempo gemessen. Vorher stand hier eine
        // Mischung aus fester und gerasterter Sekunde (0.55 + scale * 0.6): Auf
        // der schnellsten Stufe bekam ein kurzes Zuspiel dadurch rund viermal so
        // viel Spielzeit wie auf der langsamsten - derselbe Pass, ein anderes
        // Spiel.
        const duration = this.bildschirmZeit(
            Math.max(0.2, Math.min(0.95, dist / (action.type === "longball" ? 62 : 78))));

        // Ein Ball, der ins Aus geht, geht erst einmal ins Aus.
        //
        // Vorher sprang er von der Stelle des Passgebers sofort an den
        // Einwurfpunkt - gemessen im Schnitt sechsundvierzig Meter weit, im
        // Extremfall sechsundsechzig. Genau das sah aus wie ein Ball, der von
        // Einwurf zu Eckball zu Abstoß springt. Jetzt sind es zwei sichtbare
        // Vorgänge: Der Ball rollt über die Linie, und erst dort wird er für
        // die Spielfortsetzung geholt und hingelegt.
        if (this.planeStandard(action, to)) {
            if (action.outcome === "out") this.flowStats.turnovers++;
            this.setBallTravel(to.x, to.y, duration, actionType);
            return;
        }

        this.flowStats.actions++;

        if (action.type === "dribble") {
            this.handleDribbleAction(action, duration);
            return;
        }

        if (action.outcome === "complete") {
            if (this.istAbseits(from, to)) {
                this.flagOffside(from, to);
                return;
            }
            this.flowStats.passesCompleted++;
            if (action.inDenLauf) {
                // In den Lauf: Der Ball geht in den Raum vor den Mitspieler,
                // und der startet hinein
                const dir = this.attackDir(to.team);
                const ziel = {
                    x: Math.max(6, Math.min(94, to.x + dir * 4.5)),
                    y: Math.max(4, Math.min(96, to.y))
                };
                this.setBallTravel(ziel.x, ziel.y, duration * 1.1, actionType);
                this.setCarrier(to);
                this.carryTarget = { id: to.id, x: ziel.x, y: ziel.y, rest: duration * 1.4 };
                this.flowStats.inDenLauf = (this.flowStats.inDenLauf || 0) + 1;
                this.setzeAnnahme();
                this.narrateFlow(action);
                return;
            }
            this.setBallTravel(to.x, to.y, duration, actionType);
            this.setCarrier(to);
            this.setzeAnnahme();
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

    // ------------------------------------------------------------- Abseits

    /**
     * Steht der Passempfänger im Abseits?
     *
     * Maßgeblich ist der vorletzte Gegenspieler - der Torwart zählt mit. Es
     * gilt nur in der gegnerischen Hälfte und nur für Bälle nach vorne. Der
     * Schiedsrichterassistent sieht nicht jede Situation, deshalb wird nicht
     * jede knappe Stellung gepfiffen.
     *
     * Abseits entsteht ausschließlich im Aufbauspiel. Ereignisse aus der
     * Timeline laufen immer durch, sonst würden Live-Anzeige und Spielbericht
     * auseinanderlaufen.
     */
    istAbseits(passer, receiver) {
        if (!passer || !receiver || receiver.pos === "TW") return false;
        if (this.abseitsSperre > 0) return false;

        const dir = this.attackDir(passer.team);
        const inGegnerhaelfte = dir > 0 ? receiver.x > 50 : receiver.x < 50;
        if (!inGegnerhaelfte) return false;

        // Nur ein Ball nach vorne kann abseits sein
        if ((receiver.x - passer.x) * dir <= 1) return false;

        const gegner = this.teamPlayers(passer.team === "home" ? "away" : "home");
        if (gegner.length < 2) return false;

        const nachTiefe = gegner.slice().sort((a, b) => (b.x - a.x) * dir);
        const linie = nachTiefe[1].x;

        if ((receiver.x - linie) * dir < 1.5) return false;

        return _dirRandom.chance(0.7);
    }

    /** Die Fahne geht hoch: Freistoß für die verteidigende Mannschaft */
    flagOffside(passer, receiver) {
        const team = passer.team === "home" ? "away" : "home";

        this.flowStats.turnovers++;
        this.abseitsSperre = 12;
        this.cueSound("whistle");
        this.showBanner("🚩 ABSEITS", receiver.name || "", "rgba(180, 83, 9, 0.94)");

        this.startAmbient(team, { pickCarrier: false });
        this.startDeadBall("freekick", team,
            Math.max(6, Math.min(94, receiver.x)),
            Math.max(6, Math.min(94, receiver.y)));

        // Nach dem Standard, damit der Abseitspfiff im Ticker stehen bleibt
        this.match.lastCommentary =
            `${this.match.minute}' - Die Fahne geht hoch, ${receiver.name || "der Angreifer"} stand im Abseits.`;
    }

    /**
     * Ein gewonnenes Dribbling ist ein Lauf mit dem Ball - kein Zuspiel an
     * sich selbst.
     *
     * Vorher wurde auch das gewonnene Dribbling als `setBallTravel` gespielt:
     * Der Ball flog voraus, der Spieler kam hinterher. Auf dem Feld sah man
     * davon nur einen weiteren Ball, der wegsprang; Laeufe mit dem Ball gab es
     * gar nicht. Jetzt bekommt der Spieler ein Laufziel, der Ball bleibt an
     * seinem Fuss, und beide bewegen sich zusammen.
     */
    handleDribbleAction(action, duration) {
        const carrier = action.from;
        if (action.outcome === "beaten") {
            const strecke = Math.hypot(action.to.x - carrier.x, action.to.y - carrier.y);
            this.carryTarget = {
                id: carrier.id,
                x: action.to.x,
                y: action.to.y,
                // Notbremse, falls der Laeufer haengen bleibt
                rest: this.bildschirmZeit(Math.max(0.5, strecke / 13) + 0.5)
            };
            this.setCarrier(carrier);
            this.narrateFlow(action);
            return;
        }

        const defender = action.defender;
        this.flowStats.turnovers++;
        this.carryTarget = null;
        if (defender) {
            this.possessionTeam = defender.team;
            this.setBallTravel(defender.x, defender.y, duration * 0.7, "pass");
            this.setCarrier(defender);
        }
        this.narrateFlow(action);
    }

    /** Die Pause, in der ein Spieler den Ball annimmt und sich umschaut */
    setzeAnnahme() {
        const [min, max] = LiveMatchDirector.ANNAHME;
        // Die Pause ist Bildschirmzeit und gehoert deshalb durch die
        // Abspielgeschwindigkeit geteilt - im Vorlauf nimmt man schneller an.
        this._annahmeTimer = (min + Math.random() * (max - min)) / this.getAbspielTempo()
            * this.zeitspielFaktor(this.possessionTeam);
    }

    /**
     * Zeitspiel: Wer in der zweiten Halbzeit fuehrt und auf Zeit spielt,
     * behaelt den Ball laenger am Fuss. Wer nie auf Zeit spielt, bleibt auch
     * bei Fuehrung zuegig.
     */
    zeitspielFaktor(team) {
        if (!team) return 1;
        const zeitspiel = this.taktik(team).w.zeitspiel || 0;
        if (!zeitspiel) return 1;
        const m = this.match;
        const fuehrung = team === "home" ? m.homeScore - m.awayScore : m.awayScore - m.homeScore;
        if (fuehrung <= 0 || (m.minute || 0) < 60) return 1;
        return zeitspiel > 0 ? 1.45 : 0.9;
    }

    claimLooseBall(point) {
        let winner = null;
        let bestScore = Infinity;

        (this.match.players2D || []).forEach(p => {
            if (p.pos === "TW") {
                // Der Torwart greift nur zu, wenn der Ball in seinen
                // Strafraum trudelt - und dann ganz selbstverständlich.
                const goalX = this.ownGoalX(p.team);
                if (Math.abs(point.x - goalX) > 15 || Math.abs(point.y - 50) > 23) return;
            }

            // Wer den Ball verloren hat, ist einen Schritt zu spät
            const score = Math.hypot(p.x - point.x, p.y - point.y)
                * (p.team === this.possessionTeam ? 1.08 : 1.0);

            if (score < bestScore) {
                bestScore = score;
                winner = p;
            }
        });

        if (!winner) return;
        this.possessionTeam = winner.team;
        this.setCarrier(winner);
    }

    // --------------------------------------------------- Standardsituationen

    /**
     * Verlässt der Ball hier das Feld? Dann wird die Spielfortsetzung
     * vorgemerkt - ausgeführt wird sie erst, wenn der Ball wirklich über der
     * Linie liegt.
     */
    planeStandard(action, to) {
        const x = to.x ?? 0;
        const y = to.y ?? 0;
        const team = action.from?.team || this.possessionTeam;

        if (y < 1.5 || y > 98.5) {
            const spotY = y < 1.5 ? 1.5 : 98.5;
            const spotX = Math.max(4, Math.min(96, x));
            this._offenerStandard = {
                kind: "throwin", team: team === "home" ? "away" : "home", x: spotX, y: spotY
            };
            return true;
        }

        // Die Torlinien liegen bei 4 und 96, nicht am Rand des Modells -
        // vorher zaehlte ein Ball erst eineinhalb Einheiten vor dem Rand als
        // im Aus, also gut zwei Meter hinter der Torlinie.
        if (x < 3.2 || x > 96.8) {
            // Welche Mannschaft verteidigt diese Linie? In Halbzeit zwei ist
            // das die jeweils andere - vorher bekam nach dem Seitenwechsel
            // stets der falsche Verein den Abstoß.
            const linie = x < 50 ? 0 : 100;
            const defendingTeam = Math.abs(this.ownGoalX("home") - linie) < 50 ? "home" : "away";
            const goalX = x < 50 ? 9 : 91;
            this._offenerStandard = { kind: "goalkick", team: defendingTeam, x: goalX, y: 50 };
            return true;
        }

        return false;
    }

    /**
     * Rückwärtskompatibler Name - führt die Fortsetzung sofort aus.
     */
    handleOutOfPlay(action, to) {
        if (!this.planeStandard(action, to)) return false;
        this.fuehreOffenenStandardAus(false);
        return true;
    }

    /**
     * Die vorgemerkte Spielfortsetzung ausführen, sobald der Ball liegt.
     *
     * Vorgemerkt wird sie aus dem *Ziel* des Zuspiels - da weiss noch niemand,
     * wo der Ball tatsaechlich liegen bleibt. Wurde er unterwegs abgefangen
     * oder abgefaelscht, lag er am Ende weit von dem Punkt entfernt, an dem
     * eingeworfen werden sollte: gemessen bis zu einundsechzig Meter. Der
     * Einwurf holte ihn dann von dort heran.
     *
     * Ein Einwurf gehoert aber dorthin, wo der Ball die Linie ueberquert hat.
     * Liegt er woanders, wird der Punkt aus seiner wirklichen Lage neu
     * bestimmt - und liegt er gar nicht im Aus, entfaellt die Fortsetzung.
     */
    fuehreOffenenStandardAus(pruefeBall = true) {
        const s = this._offenerStandard;
        if (!s) return false;
        this._offenerStandard = null;

        const ball = this.match.ball;
        const abstand = Math.hypot(s.x - ball.x, s.y - ball.y);

        // Geprueft wird nur, wenn der Ball schon liegt. Beim direkten Aufruf
        // nennt der Rufende den Austrittspunkt selbst, und der Ball ist noch
        // gar nicht dort - da gibt es nichts nachzumessen.
        if (pruefeBall && abstand > 12) {
            const wirklichDraussen = ball.y < 1.5 || ball.y > 98.5 || ball.x < 1.5 || ball.x > 98.5;
            if (!wirklichDraussen) {
                // Der Ball ist im Feld liegen geblieben - es gibt nichts
                // fortzusetzen, das Spiel laeuft weiter.
                return false;
            }
            if (ball.y < 1.5 || ball.y > 98.5) {
                s.kind = "throwin";
                s.x = Math.max(4, Math.min(96, ball.x));
                s.y = ball.y < 1.5 ? 1.5 : 98.5;
            } else {
                const linie = ball.x < 1.5 ? 0 : 100;
                s.kind = "goalkick";
                s.team = Math.abs(this.ownGoalX("home") - linie) < 50 ? "home" : "away";
                s.x = ball.x < 1.5 ? 8 : 92;
                s.y = 50;
            }
        }

        this.startDeadBall(s.kind, s.team, s.x, s.y);
        return true;
    }

    // ------------------------------------------------------------- Anstoß

    /**
     * Anstoß mit Zeremonie: Erst stellen sich beide Mannschaften in ihrer
     * eigenen Hälfte auf, der Mittelkreis bleibt der anstoßenden Mannschaft
     * vorbehalten. Der Schiedsrichter geht zum Anstoßpunkt, pfeift an - und
     * erst dann rollt der Ball. Vorher sprang das Spiel nach einem Tor oder
     * zur zweiten Halbzeit einfach weiter, egal wo die zweiundzwanzig
     * Spieler gerade standen.
     */
    startKickoff(team, reason = "goal") {
        const scale = this.getSpeedScale();

        // Eine laufende Szene wird vom Anstoß abgeräumt - etwa wenn die
        // Halbzeit mitten in einer Angriffsfolge fällt. Ihre restlichen
        // Ereignisse müssen trotzdem in die Statistik, sonst zeigte die
        // Live-Anzeige am Ende einen Schuss weniger als der Spielbericht.
        this.flushScene();

        this.mode = "ambient";
        this.scene = null;
        this.match.sceneRoles = null;
        this.deadBall = { kind: "kickoff", team, x: 50, y: 50 };
        this.match.setPiece = { kind: "kickoff", team, x: 50, y: 50 };
        this.possessionTeam = team;
        this.possessionChain = 0;
        this.deadBallTimer = 0;
        this.flowStats.setPieces++;

        // Der Ball wird auf den Anstoßpunkt gelegt
        const ball = this.match.ball;
        const dist = Math.hypot(50 - ball.x, 50 - ball.y);
        this.setBallTravel(50, 50,
            Math.max(0.3, Math.min(1.1, dist / 90)) * scale + this.bildschirmZeit(0.2), "dead");
        const legeDauer = this.match.ball.travelDuration || 0;

        // Vor dem Pfiff liegt der Ball auf dem Punkt - niemand traegt ihn.
        //
        // Der Anstossschuetze war schon waehrend der Aufstellung Ballfuehrender,
        // und die Ballbindung zog den Ball mit ihm mit. Solange er in einem
        // Wimpernschlag auf seiner Position stand, fiel das nicht auf; seit er
        // dorthin trabt, wanderte der Ball drei Meter neben den Anstosspunkt -
        // und der Schiedsrichter pfiff das an.
        const { taker, partner } = this.pickKickoffTakers(team);
        this.kickoffTakerId = taker ? taker.id : null;
        this.carrierId = null;
        this.kickoffPartnerId = partner ? partner.id : null;
        this.match.ball.holderId = null;
        this.match.activePlayerId = taker ? taker.id : this.match.activePlayerId;

        // Höchstdauer der Aufstellung: Wer nach einem Tor von der Eckfahne
        // zurücktrabt, braucht am längsten.
        // Die Aufstellung endet nie, bevor der Ball auf dem Punkt liegt.
        // Seit der Ball glaubwuerdig langsam rollt, lief die Hoechstdauer sonst
        // ab, waehrend er noch unterwegs war - der Schiedsrichter pfiff einen
        // Anstoss an, bei dem der Ball zwei Meter neben dem Punkt lag.
        const maxLineup = Math.max(
            (reason === "goal" ? 9 : reason === "halftime" ? 7 : 5) * scale + this.bildschirmZeit(2.2),
            legeDauer + this.bildschirmZeit(0.6));

        this.kickoff = { team, reason, phase: "lineup", timer: maxLineup };
        this.match.kickoff = { team, phase: "lineup", reason };

        // Nach einem Tor und zur Halbzeit schneidet die Uebertragung: Die
        // Spieler stehen schon beinahe auf ihren Plaetzen. Vorher trabten
        // sie von der Eckfahne zurueck, die Aufstellung lief ab, und der
        // Schiedsrichter pfiff an, waehrend noch halbe Mannschaften in der
        // gegnerischen Haelfte standen.
        if (reason === "goal" || reason === "halftime") this.stelleZumAnstossAuf();
    }

    /** Setzt alle nahe an ihren Anstossplatz - der Schnitt der Uebertragung */
    stelleZumAnstossAuf() {
        (this.match.players2D || []).forEach(p => {
            const ziel = this.computeSetPieceTarget(p, this.deadBall);
            if (!ziel) return;
            // Ein paar Schritte fehlen noch - die laufen sie sichtbar
            const rest = 0.18;
            p.x = ziel.x + (p.x - ziel.x) * rest;
            p.y = ziel.y + (p.y - ziel.y) * rest;
            // Aus der Rueckhand sicher in der eigenen Haelfte bleiben
            const eigenDir = this.attackDir(p.team);
            if (eigenDir > 0 && p.x > 49) p.x = Math.min(p.x, 49);
            if (eigenDir < 0 && p.x < 51) p.x = Math.max(p.x, 51);
            if (typeof p.vx === "number") { p.vx = 0; p.vy = 0; }
        });
    }

    /** Anstoßschütze und sein Partner: zwei zentrale Spieler am Mittelkreis */
    pickKickoffTakers(team) {
        const outfield = this.teamPlayers(team).filter(p => p.pos !== "TW");
        if (outfield.length === 0) return { taker: null, partner: null };

        const zentral = outfield.slice().sort((a, b) => {
            const rank = (p) => (p.group === "att" ? 0 : p.group === "mid" ? 1 : 2) * 40
                + Math.abs(p.baseY - 50);
            return rank(a) - rank(b);
        });

        return { taker: zentral[0] || null, partner: zentral[1] || null };
    }

    /** Stehen alle auf ihren Anstoßpositionen? */
    kickoffReady() {
        const players = this.match.players2D || [];
        if (players.length === 0) return true;

        return players.every(p => {
            const target = this.computeSetPieceTarget(p, this.deadBall);
            if (!target) return true;
            return Math.hypot(p.x - target.x, p.y - target.y) < 4.5;
        });
    }

    /**
     * Ablauf der Zeremonie: aufstellen -> Pfiff -> Anspiel
     */
    updateKickoff(dt) {
        const k = this.kickoff;
        k.timer -= dt;

        if (k.phase === "lineup") {
            // Der Ball muss liegen und alle müssen stehen - der Schuetze am
            // Ball. Laeuft die Aufstellung ab, wartet der Pfiff noch kurz auf
            // ihn, aber nicht ewig.
            const ballLiegt = !this.match.ball.inFlight;
            const schuetze = this.getPlayer2D(this.kickoffTakerId);
            const schuetzeDa = !schuetze || Math.hypot(schuetze.x - 50, schuetze.y - 50) < 2.6;
            if ((ballLiegt && schuetzeDa && this.kickoffReady())
                || (k.timer <= 0 && schuetzeDa)
                || k.timer <= -this.bildschirmZeit(4)) {
                k.phase = "whistle";
                // Jetzt erst nimmt sich der Schuetze den Ball
                this.carrierId = this.kickoffTakerId || this.carrierId;
                k.timer = this.bildschirmZeit(1.0);
                this.match.kickoff = { team: k.team, phase: "whistle", reason: k.reason };
                this.cueSound("whistle");

                // Der Banner gehoert an den Pfiff. Vorher hing er am
                // Minutenzaehler und erschien erst, wenn die erste Spielminute
                // voll war - da lief das Spiel laengst, und die Einblendung kam
                // sichtbar zu spaet.
                if (k.reason === "matchstart") {
                    this.showBanner("ANPFIFF",
                        `${this.match.homeClub?.name || "Heim"} - ${this.match.awayClub?.name || "Gast"}`);
                } else if (k.reason === "halftime") {
                    this.showBanner("ZWEITE HALBZEIT",
                        `${this.match.homeScore} : ${this.match.awayScore}`);
                }

                const club = k.team === "home"
                    ? (this.match.homeClub?.name || "Heim")
                    : (this.match.awayClub?.name || "Gast");
                this.match.lastCommentary = k.reason === "halftime"
                    ? `${this.match.minute}' - Der Schiedsrichter pfeift die zweite Halbzeit an, ${club} stößt an.`
                    : `${this.match.minute}' - Anstoß für ${club}, der Schiedsrichter gibt das Spiel frei.`;
            }
            return;
        }

        if (k.timer > 0) return;

        this.kickoff = null;
        this.match.kickoff = null;
        this.resumeFromDeadBall();
    }

    startDeadBall(kind, team, x, y) {
        this.carryTarget = null;
        this._offenerStandard = null;
        this._annahmeTimer = 0;
        if (kind === "kickoff") {
            this.startKickoff(team, "goal");
            return;
        }

        const speedScale = this.getSpeedScale();
        this.deadBall = { kind, team, x, y };
        this.possessionTeam = team;
        this.flowStats.setPieces++;

        // Der Ball wird zum Einwurf-, Eck- oder Abstoßpunkt gebracht, nicht
        // dorthin geschossen. Deshalb läuft er mit dem Tempo eines ruhenden
        // Balls - vorher ging er als "pass" auf die Reise und legte den Weg
        // von der Strafraumgrenze zur Eckfahne in einem Wimpernschlag zurück.
        const dist = Math.hypot(x - this.match.ball.x, y - this.match.ball.y);
        this.setBallTravel(x, y,
            Math.max(0.35, Math.min(1.1, dist / 70)) * speedScale + this.bildschirmZeit(0.2), "dead");

        const executor = this.pickSetPieceTaker(kind, team, x, y);
        if (executor) {
            this.carrierId = executor.id;
            this.match.ball.holderId = executor.id;
            this.match.activePlayerId = executor.id;
        }

        // Bei einem Freistoß in Schussweite stellt sich eine Mauer - drei
        // Verteidiger neun Meter vor dem Ball auf der Linie zum eigenen Tor.
        this.setPieceWall = kind === "freekick" ? this.buildWall(team, x, y) : [];

        // Der ruhende Ball wartet, bis der Schuetze bei ihm ist.
        //
        // Auch hier wurde die Wartezeit mit der Zeitraffung multipliziert: Bei
        // Tempo 2 blieben einem Eckenschuetzen rund eine halbe Bildsekunde, um
        // an die Fahne zu kommen. Gemessen lag der Ball dadurch in siebenund-
        // dreissig Prozent der Ruhendball-Zeit allein da - und ein Ball, neben
        // dem niemand steht, sieht nach Standbild aus, nicht nach Fussball.
        const grund = (kind === "goalkick" ? 1.2 : kind === "corner" ? 1.5
            : kind === "freekick" ? (this.setPieceWall.length > 0 ? 2.0 : 1.1) : 0.85) * speedScale
            + this.bildschirmZeit(0.3);

        const wegZumBall = executor
            ? Math.hypot(executor.x - x, executor.y - y)
            : 0;
        const laufTempo = LINE_BASE_SPEED.mid * ANLAUF_URGENZ * this.getMotionTempo();
        this.deadBallTimer = Math.max(grund, Math.min(
            this.bildschirmZeit(3.2),
            wegZumBall / laufTempo + this.bildschirmZeit(0.35)
        ));
        if (kind !== "throwin") this.cueSound("whistle");
        this.match.setPiece = { kind, team, x, y };

        // Ein Freistoß an der Mittellinie ist nicht "aussichtsreich" - dafür
        // gibt es einen eigenen Satzvorrat, sobald eine Mauer steht.
        const textSchluessel = (kind === "freekick" && this.setPieceWall.length > 0)
            ? "freekick_gefaehrlich"
            : kind;

        const pool = FLOW_COMMENTARY[textSchluessel];
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
     * Position der Mauer: neun Meter vor dem Ball auf der Verbindungslinie
     * zum eigenen Tor. Auf dem 105x68-Feld sind das rund 8,7 Einheiten.
     */
    wallSpot(team, x, y) {
        const torX = this.ownGoalX(team === "home" ? "away" : "home");
        const dx = torX - x;
        const dy = 50 - y;
        const len = Math.hypot(dx, dy) || 1;
        return {
            x: x + (dx / len) * 8.7,
            y: y + (dy / len) * 8.7,
            nx: -dy / len,
            ny: dx / len,
            entfernung: Math.hypot(dx, dy)
        };
    }

    /** Wer stellt sich in die Mauer? Nur bei Freistößen in Schussweite. */
    buildWall(team, x, y) {
        const spot = this.wallSpot(team, x, y);
        if (spot.entfernung > 34) return [];

        return this.teamPlayers(team === "home" ? "away" : "home")
            .filter(p => p.pos !== "TW")
            .sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y))
            .slice(0, 3)
            .map(p => p.id);
    }

    pickSetPieceTaker(kind, team, x, y) {
        const squad = this.teamPlayers(team);
        if (squad.length === 0) return null;

        if (kind === "goalkick") {
            return squad.find(p => p.pos === "TW") || squad[0];
        }

        const outfield = squad.filter(p => p.pos !== "TW");
        const pool = outfield.length > 0 ? outfield : squad;

        // Von der Seitenlinie vorgegeben: Er tritt die Ecken und die
        // Freistöße in Schussweite, egal wo er gerade steht.
        const vorgabe = this.match.standards?.[team] || {};
        const vorgabeId = kind === "corner" ? vorgabe.ecken
            : (kind === "freekick" && this.wallSpot(team, x, y).entfernung < 34 ? vorgabe.freistoss : null);
        if (vorgabeId !== null && vorgabeId !== undefined) {
            const schuetze = pool.find(p => p.id === vorgabeId);
            if (schuetze) return schuetze;
        }

        if (kind === "corner") {
            // Wer die Ecke tritt, wurde allein nach Technik bestimmt - auch
            // wenn der Beste gerade am anderen Ende des Feldes stand. Dann lag
            // der Ball an der Fahne, während er quer über den Platz trabte.
            // Eine Mannschaft hat zwar ihren Schützen, aber nicht jeder Weg
            // lohnt sich: Zwanzig Einheiten Anmarsch wiegen hier zwölf Punkte
            // Technik auf.
            return pool.slice().sort((a, b) =>
                (this.setPieceSkill(b) - Math.hypot(b.x - x, b.y - y) * 0.6)
                - (this.setPieceSkill(a) - Math.hypot(a.x - x, a.y - y) * 0.6)
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

        // Anstoß: kurzer Anspielpass zum Partner am Mittelkreis
        if (info.kind === "kickoff") {
            const mates = this.teamPlayers(info.team).filter(p => p.pos !== "TW" && p.id !== this.carrierId);
            const partner = mates.find(p => p.id === this.kickoffPartnerId);
            const receiver = partner || mates.sort((a, b) =>
                Math.hypot(a.x - info.x, a.y - info.y) - Math.hypot(b.x - info.x, b.y - info.y)
            )[0];
            this.kickoffPartnerId = null;

            if (receiver) {
                const dist = Math.hypot(receiver.x - info.x, receiver.y - info.y);
                this.setBallTravel(receiver.x, receiver.y,
                    Math.max(0.3, Math.min(0.8, dist / 70)) * this.getSpeedScale() + this.bildschirmZeit(0.15),
                    "pass");
                this.setCarrier(receiver);
            } else {
                this.ambientTimer = this.ambientInterval;
            }
            return;
        }

        if (info.kind === "corner") {
            // Die Flanke geht vor das Tor - gerechnet von der Torlinie aus.
            // Vorher von der Fahne aus und mit falschem Vorzeichen: Der Ball
            // flog hinter die Torlinie statt in den Strafraum.
            const dir = this.attackDir(info.team);
            const torX = this.ownGoalX(info.team === "home" ? "away" : "home");
            const target = { x: torX - dir * _dirRandom.float(4.5, 10.5), y: 50 + _dirRandom.float(-8, 8) };
            this.setBallTravel(target.x, target.y, 0.75 * this.getSpeedScale() + this.bildschirmZeit(0.2), "cross");
            this.claimLooseBall(target);
            return;
        }

        if (info.kind === "freekick") {
            const dir = this.attackDir(info.team);
            const spot = this.wallSpot(info.team, info.x, info.y);
            const torX = this.ownGoalX(info.team === "home" ? "away" : "home");

            if (spot.entfernung < 34) {
                // In Schussweite wird der Ball in den Strafraum gebracht. Ein
                // Torschuss käme hier nicht infrage: Alle zählbaren Ereignisse
                // stammen aus der Timeline, sonst liefen Anzeige und Bericht
                // auseinander.
                const ziel = {
                    x: torX - dir * (6 + _dirRandom.float(0, 5)),
                    y: 50 + _dirRandom.float(-13, 13)
                };
                this.setBallTravel(ziel.x, ziel.y, 0.75 * this.getSpeedScale() + this.bildschirmZeit(0.2), "cross");
                this.claimLooseBall(ziel);
                this.match.lastCommentary =
                    `${this.match.minute}' - Der Freistoß wird in den Strafraum geschlagen.`;
                return;
            }

            const mates = this.teamPlayers(info.team)
                .filter(p => p.pos !== "TW" && p.id !== this.carrierId)
                .sort((a, b) => (b.x - a.x) * dir);
            const receiver = mates.find(p => Math.hypot(p.x - info.x, p.y - info.y) < 34) || mates[0];

            if (receiver) {
                const dist = Math.hypot(receiver.x - info.x, receiver.y - info.y);
                this.setBallTravel(receiver.x, receiver.y,
                    Math.max(0.3, Math.min(0.9, dist / 75)) * this.getSpeedScale() + this.bildschirmZeit(0.15), "pass");
                this.setCarrier(receiver);
            }
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
                    Math.max(0.3, Math.min(1.0, dist / 70)) * this.getSpeedScale() + this.bildschirmZeit(0.15),
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

        const pool = action.frei ? FLOW_COMMENTARY.andribbeln : pools[action.outcome];
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

    /**
     * Bringt den Ball an einen Ort - über die Mitspieler, nicht im hohen Bogen.
     *
     * Beim Anlauf zu einer Szene wurde der Ball bisher in einem einzigen
     * Schlag an den Ereignisort geworfen: 84 solcher Bälle je Partie, dreißig
     * davon über sechsunddreißig Meter, der längste über das gesamte Feld. Das
     * war der Grund, warum der Ball "durch die Gegend flog" - es war gar kein
     * Zuspiel, sondern ein Szenenwechsel, den man dem Ball ansah.
     *
     * Im Football Manager gibt es diesen Sprung nicht: Der Ball wandert immer
     * von Spieler zu Spieler. Genau das passiert hier jetzt auch - eine weite
     * Strecke wird in Etappen über die Mitspieler zurückgelegt, die ohnehin
     * auf dem Weg stehen.
     */
    MAX_ETAPPE = 30;

    /** Dichte des Ballbesitzspiels zwischen den Hoehepunkten (kleiner = mehr Zuspiele) */
    AMBIENT_TAKT = 0.34;

    routeBallTo(targetX, targetY, team, actionType, scale, finalHolderId = null) {
        const ball = this.match.ball;
        const gesamt = Math.hypot(targetX - ball.x, targetY - ball.y);
        this.ballRoute = [];
        this._routeScale = scale;

        if (gesamt <= this.MAX_ETAPPE) {
            this._routeHolder = finalHolderId;
            const geplant = Math.max(0.16, Math.min(0.55, gesamt / 88)) * scale + this.bildschirmZeit(0.08);
            this._routeDauer = Math.max(geplant, gesamt / this.ballTempo(actionType));
            this.setBallTravel(targetX, targetY, this._routeDauer, actionType);
            return;
        }

        // Höchstens drei Stationen, auch über das ganze Feld.
        //
        // Sechs Etappen mit je einer Annahme dazwischen dauerten gemessen über
        // fünf Bildschirmsekunden - bei einem Höhepunkt alle drei bis vier
        // Sekunden. Der Anlauf fraß damit ein Drittel der gesamten Übertragung,
        // und zwischen zwei Szenen blieb Zeit für genau ein freies Zuspiel.
        // Genau deshalb sah man keine Passstaffetten: Es gab keine.
        //
        // Mit drei Stationen sind die einzelnen Zuspiele länger - aber sie sind
        // immer noch Zuspiele mit glaubwürdiger Flugzeit, kein Sprung. Die
        // gewonnene Zeit geht ans freie Spiel: gemessen 51 statt 58 Prozent
        // Szenenanteil und ein Viertel mehr Aktionen im Aufbauspiel.
        const etappen = Math.min(3, Math.ceil(gesamt / this.MAX_ETAPPE));
        const mates = (this.match.players2D || [])
            .filter(p => p.team === team && p.id !== finalHolderId && p.pos !== "TW");

        // Der Weg wird zuerst gleichmäßig aufgeteilt und erst danach auf
        // Mitspieler eingerastet, die ohnehin dort stehen. Andersherum - erst
        // den passendsten Mitspieler suchen - konnte eine Station weit neben
        // der Linie liegen, und die Schlussetappe zum Ziel wurde wieder zum
        // Schlag über das halbe Feld.
        const SNAP = 9;
        const route = [];

        for (let i = 1; i < etappen; i++) {
            const idealX = ball.x + (targetX - ball.x) * (i / etappen);
            const idealY = ball.y + (targetY - ball.y) * (i / etappen);
            let bester = null;
            let besteD = SNAP;
            mates.forEach(p => {
                if (route.some(r => r.holderId === p.id)) return;
                const d = Math.hypot(p.x - idealX, p.y - idealY);
                if (d < besteD) { besteD = d; bester = p; }
            });
            route.push({
                x: bester ? bester.x : idealX,
                y: bester ? bester.y : idealY,
                holderId: bester ? bester.id : null,
                type: "pass"
            });
        }

        route.push({ x: targetX, y: targetY, holderId: finalHolderId, type: actionType });

        // Wie lange die Kombination insgesamt braucht. Der Anlauf einer Szene
        // richtet sich danach - sonst beginnt die Aktion, bevor der Ball beim
        // genannten Spieler angekommen ist.
        let vx = ball.x, vy = ball.y, dauer = 0;
        route.forEach((r, i) => {
            const d = Math.hypot(r.x - vx, r.y - vy);
            dauer += this.etappenDauer(d, scale);
            if (i < route.length - 1) dauer += LiveMatchDirector.ETAPPEN_ANNAHME[1] * scale;
            vx = r.x; vy = r.y;
        });
        this._routeDauer = dauer;

        this.ballRoute = route;
        this.startNextRouteLeg();
    }

    /**
     * Bricht eine laufende Ballroute ab und setzt den Ball ans Ziel.
     *
     * Die Etappen sind Optik; dass der im Ticker genannte Spieler den Ball hat,
     * ist dagegen eine Zusage an den Zuschauer. Endet der Anlauf, bevor die
     * letzte Etappe angekommen ist, gewinnt die Zusage.
     */
    finishBallRoute() {
        if (!this.ballRoute || this.ballRoute.length === 0) {
            if (this._routeHolder) {
                this.match.ball.holderId = this._routeHolder;
                this.carrierId = this._routeHolder;
                this._routeHolder = null;
            }
            return;
        }

        const letzte = this.ballRoute[this.ballRoute.length - 1];
        const halter = letzte.holderId || this._routeHolder;
        this.ballRoute = [];
        this._routeDwell = 0;
        this._routeHolder = null;

        // Der Ball wird hier bewusst nicht versetzt - die anschliessende
        // Szene setzt ihre eigene Ballbewegung von der aktuellen Stelle aus
        // an. Ein Sprung ans Etappenziel waere sichtbares Zucken.
        if (halter) {
            this.match.ball.holderId = halter;
            this.carrierId = halter;
            this.match.activePlayerId = halter;
        }
    }

    /**
     * Wie lange eine Etappe wirklich dauert.
     *
     * Dieselbe Rechnung, mit der `routeBallTo` den Anlauf plant - sonst endet
     * der Anlauf, bevor der Ball beim genannten Spieler ist.
     */
    etappenDauer(distanz, scale) {
        const geplant = Math.max(0.14, Math.min(0.45, distanz / 95)) * scale + this.bildschirmZeit(0.06);
        return Math.max(geplant, distanz / this.ballTempo("pass"));
    }

    /** Startet die nächste Etappe einer Ballroute */
    startNextRouteLeg() {
        if (!this.ballRoute || this.ballRoute.length === 0) return false;
        const etappe = this.ballRoute.shift();
        const ball = this.match.ball;
        const d = Math.hypot(etappe.x - ball.x, etappe.y - ball.y);
        const scale = this._routeScale || 1;

        this._routeHolder = etappe.holderId;
        ball.holderId = null;
        this._routeLegRunning = true;
        this.setBallTravel(etappe.x, etappe.y, this.etappenDauer(d, scale), etappe.type || "pass");
        this._routeLegRunning = false;
        return true;
    }

    setBallTravel(targetX, targetY, durationSeconds, actionType = "pass") {
        // Ein Zuspiel, das nicht zur laufenden Route gehört, hebt sie auf -
        // sonst würde der Ball nach einem Schuss oder Zweikampf noch die alten
        // Etappen abarbeiten.
        if (!this._routeLegRunning && this.ballRoute && this.ballRoute.length > 0) {
            this.ballRoute = [];
            this._routeHolder = null;
        }

        const ball = this.match.ball;
        ball.originX = ball.x;
        ball.originY = ball.y;
        ball.targetX = Math.max(1, Math.min(99, targetX));
        ball.targetY = Math.max(1, Math.min(99, targetY));
        ball.distance = Math.hypot(ball.targetX - ball.originX, ball.targetY - ball.originY);

        const minDuration = ball.distance / this.ballTempo(actionType);

        ball.travelDuration = Math.max(0.01, durationSeconds, minDuration);
        ball.travelElapsed = 0;
        ball.actionType = actionType;
        ball.bogen = actionType === "cross" ? (this._flankenBogen || 1) : 1;
        this._flankenBogen = null;

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

    /**
     * Der Ball wird in kleinen Schritten bewegt, nie in einem Satz.
     *
     * Ein Bild kann viel Spielzeit umfassen - bei hohem Tempo, nach einem
     * Tabwechsel oder auf einem langsamen Geraet. Wurde die ganze Zeitspanne
     * in einem Rutsch verrechnet, sprang der Ball ueber mehrere Meter: gemessen
     * bis zu neun Meter in einem einzigen Bild. Sichtbar ist das ein Ball, der
     * teleportiert. Mit Teilschritten bleibt die Bewegung eine Bewegung,
     * unabhaengig davon, wie gross der Zeitschritt ist.
     */
    updateBall(dt) {
        const MAX_SCHRITT = 0.034;
        if (dt > MAX_SCHRITT) {
            const schritte = Math.min(12, Math.ceil(dt / MAX_SCHRITT));
            const teil = dt / schritte;
            for (let i = 0; i < schritte; i++) this.updateBallSchritt(teil);
            return;
        }
        this.updateBallSchritt(dt);
    }

    updateBallSchritt(dt) {
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

        const arc = (ball.actionType === "cross" ? 1.0 : (ball.actionType === "shot" ? 0.45 : 0.2))
            * (ball.actionType === "cross" ? (ball.bogen || 1) : 1);
        const weite = Math.min(1, (ball.distance || 0) / 35);

        // Flugkurve: Ein hoher Ball beschreibt eine Parabel und setzt danach
        // zweimal auf, ein flacher Pass bleibt am Boden. Vorher schwebte jeder
        // Ball in derselben Sinuskurve und landete weich wie eine Feder.
        ball.height = (ball.actionType === "cross" && weite > 0.3)
            ? this.bounceHeight(t) * arc * weite
            : Math.sin(Math.PI * t) * arc * weite;
        ball.inFlight = t < 1;

        // Ist eine Etappe angekommen, übernimmt die nächste Station. So legt
        // der Ball auch weite Wege als Kombination zurück statt als Schlag.
        //
        // Dazwischen liegt eine Ballannahme. Ohne sie hingen die Etappen
        // übergangslos aneinander, und der Ball war nur noch in der Hälfte der
        // Zeit bei einem Spieler statt wie vorher in neun von zehn Momenten -
        // also genau das Flattern, das abgestellt werden sollte. Im Fußball
        // ist der Ball die meiste Zeit an einem Fuß und nur kurz unterwegs.
        if (!ball.inFlight) {
            if (this._routeHolder) {
                this.carrierId = this._routeHolder;
                this.match.activePlayerId = this._routeHolder;
                ball.holderId = this._routeHolder;
                this._routeHolder = null;
                const [dMin, dMax] = LiveMatchDirector.ETAPPEN_ANNAHME;
                this._routeDwell = (dMin + Math.random() * (dMax - dMin)) * (this._routeScale || 1);
            }
            if (this.ballRoute && this.ballRoute.length > 0) {
                this._routeDwell = Math.max(0, (this._routeDwell || 0) - dt);
                if (this._routeDwell <= 0) this.startNextRouteLeg();
            }
        }

        // Der Ball klebt am Ballführenden - auch im Anlauf einer Szene, damit
        // der genannte Spieler ihn wirklich an den Ereignisort mitnimmt.
        // Ein ruhender Ball bleibt liegen: Der Schuetze kommt zum Ball, nicht
        // der Ball zum Schuetzen. Vorher zog der Schuetze ihn auf dem Weg zur
        // Fahne mit - die Ecke wurde dann dort getreten, wo er gerade war.
        const amFuss = !this.deadBall && !this._eckeNachRoute && (this.mode === "ambient"
            || (this.mode === "highlight" && this.scene?.phase === "approach"));

        if (!ball.inFlight && amFuss) {
            const carrier = this.getPlayer2D(this.carrierId);
            if (carrier) {
                const dir = this.attackDir(carrier.team);
                const anchorX = carrier.x + dir * 1.6;
                const anchorY = carrier.y;

                // Im Anlauf einer Szene nimmt der Spieler den Ball auch über
                // eine größere Strecke mit - er dribbelt ihn zum Ereignisort.
                // Im Anlauf einer Szene holt sich der Spieler den Ball auch
                // ueber eine groessere Strecke - gemessen war "Ball liegt,
                // Spieler weg" mit Abstand der haeufigste Grund dafuer, dass
                // der im Ticker genannte Spieler bei Szenenbeginn ohne Ball
                // dastand: zweiundzwanzig von vierundzwanzig Faellen.
                const reichweite = this.mode === "highlight" ? 999 : 8;

                const weg = Math.hypot(anchorX - ball.x, anchorY - ball.y);
                if (weg < reichweite) {
                    // Auch beim Aufnehmen rollt der Ball, er springt nicht.
                    // Ohne diese Grenze riss ein Spieler, der weit weg stand,
                    // den Ball in einem einzigen Bild zu sich heran.
                    const anteil = Math.min(1, dt * 9);
                    const grenze = LiveMatchDirector.AUFNAHME_TEMPO * dt;
                    const faktor = weg * anteil > grenze ? grenze / weg : anteil;
                    ball.x += (anchorX - ball.x) * faktor;
                    ball.y += (anchorY - ball.y) * faktor;
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

    /**
     * Höhe eines hohen Balls über seine Flugzeit: ein großer Bogen, dann zwei
     * kleiner werdende Aufsetzer - so wie ein Ball auf Rasen springt.
     */
    bounceHeight(t) {
        if (t <= 0.7) return Math.sin(Math.PI * (t / 0.7));
        if (t <= 0.88) return 0.32 * Math.sin(Math.PI * ((t - 0.7) / 0.18));
        return 0.11 * Math.sin(Math.PI * ((t - 0.88) / 0.12));
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

        // Der Hechtsprung des Torwarts klingt ab
        players.forEach(p => {
            if (p.diving > 0) p.diving = Math.max(0, p.diving - dt);
        });

        // Das Lauftempo folgt der eingestellten Stufe, nicht der echten
        // Sekunde - sonst läuft die Uhr den Spielern davon. Gerechnet wird
        // deshalb in Laufzeit: Eine hoehere Stufe ist derselbe Lauf im Vorlauf.
        const tempo = this.getMotionTempo();
        const lauf = dt * tempo;
        this._laufUhr = (this._laufUhr || 0) + lauf;

        // Ballverlust: Ab jetzt schaltet die Mannschaft um
        if (this._letzterBesitz !== this.possessionTeam) {
            if (this._letzterBesitz) this._wechselUhr = this._laufUhr;
            this._letzterBesitz = this.possessionTeam;
        }
        this._abseitsLinie = { home: this.abseitsLinie("home"), away: this.abseitsLinie("away") };
        this.fuehreSchwerpunktNach(lauf);

        players.forEach(p => {
            // Ein Sprung auf dem Feld (Seitenwechsel, Einwechslung) nimmt den
            // Schwung mit - wer versetzt wurde, laeuft nicht weiter.
            if (typeof p._lx === "number" && Math.hypot(p.x - p._lx, p.y - p._ly) > 3) {
                p.lvx = 0; p.lvy = 0;
                if (p.sicht) { p.sicht.x = ball.x; p.sicht.y = ball.y; }
            }

            this.nimmBallWahr(p, ball, lauf);

            // Beim Seitenwechsel ohne Anstoß-Zeremonie traben alle stur auf
            // ihre neue Grundposition; läuft die Zeremonie, gibt sie die
            // Aufstellung vor.
            const target = (this.sideSwapTimer > 0 && !this.kickoff)
                ? { x: p.baseX, y: p.baseY, urgency: 1.25 }
                : this.computeTarget(p, ball, pressers);

            const x0 = p.x, y0 = p.y;
            this.laufeZu(p, target, lauf);

            p.vx = (p.x - x0) / dt;
            p.vy = (p.y - y0) / dt;
            p.targetX = target.x;
            p.targetY = target.y;

            const speed = Math.hypot(p.vx, p.vy);
            // Wer laeuft, schaut in Laufrichtung. Wer steht oder trabt, dreht
            // sich zum Ball - im Fussball schaut niemand ins Leere.
            let blick = null;
            let drehen = 9;
            if (speed > 0.9 * tempo) {
                blick = Math.atan2(p.vy, p.vx);
            } else if (Math.hypot(ball.x - p.x, ball.y - p.y) > 1) {
                blick = Math.atan2(ball.y - p.y, ball.x - p.x);
                drehen = 4;
            }
            if (blick !== null) {
                let diff = blick - p.facing;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                p.facing += diff * Math.min(1, dt * drehen);
            }
            p.speed = speed;

            p.x = Math.max(2, Math.min(98, p.x));
            p.y = Math.max(3, Math.min(97, p.y));
        });

        this.separatePlayers(players, dt);
        players.forEach(p => { p._lx = p.x; p._ly = p.y; });

        if (match.goalFlash > 0) {
            match.goalFlash = Math.max(0, match.goalFlash - rawDt * 1.4);
        }
    }

    /**
     * Der Spielschwerpunkt, nach dem eine Mannschaft ihre Hoehe richtet - als
     * Anteil der Feldlaenge vom eigenen Tor aus.
     *
     * Die Elf folgte dem Ball in jedem Bild. Weil sie jetzt als Ganzes
     * aufrueckt, musste sie dafuer rennen: Gemessen sprintete fast ein Drittel
     * der Feldspieler, sobald der Ball nach vorn lief. Eine Mannschaft rueckt
     * aber geordnet nach und faellt nur schnell zurueck, wenn es gefaehrlich
     * wird - nach vorn folgt der Schwerpunkt deshalb gemaechlich, nach hinten
     * zuegig.
     */
    fuehreSchwerpunktNach(lauf) {
        const ball = this.match.ball;
        if (!this._schwerpunkt) this._schwerpunkt = {};
        ["home", "away"].forEach(team => {
            const b = (ball.x - this.ownGoalX(team)) * this.attackDir(team) / 92;
            const alt = this._schwerpunkt[team];
            if (typeof alt !== "number") { this._schwerpunkt[team] = b; return; }
            if (!(lauf > 0)) return;
            const traeg = b < alt ? 0.6 : 1.6;
            this._schwerpunkt[team] = alt + (b - alt) * (1 - Math.exp(-lauf / traeg));
        });
    }

    /**
     * Die Abseitslinie, auf die eine Mannschaft zulaeuft: der vorletzte
     * Gegenspieler, der Torwart zaehlt mit.
     */
    abseitsLinie(team) {
        const dir = this.attackDir(team);
        const gegner = this.teamPlayers(team === "home" ? "away" : "home");
        if (gegner.length < 2) return null;
        const tiefe = gegner.map(g => g.x).sort((a, b) => (b - a) * dir);
        return tiefe[1];
    }

    /**
     * Der Platz, den ein Spieler im Verbund gerade haelt.
     *
     * Bisher folgte jeder Spieler seinem Platz im Block stufenlos - wanderte
     * der Ball, wanderten alle zweiundzwanzig im selben Moment mit. Gemessen
     * liefen im laufenden Ballbesitz vier von fuenf Spielern einer Elf in
     * dieselbe Richtung, und praktisch niemand stand je still.
     *
     * Im Fussball rueckt ein Spieler nach, wenn sein Platz spuerbar gewandert
     * ist, und steht sonst. Wer nah am Ball ist, folgt jeder Bewegung; wer auf
     * der anderen Seite steht, rueckt in groesseren Schueben nach. Die
     * Abwehrkette verschiebt eng, damit die Linie eine Linie bleibt.
     */
    haltePlatz(p, x, y, ball) {
        const uhr = this._laufUhr || 0;
        const nah = Math.hypot(p.x - ball.x, p.y - ball.y);
        const schwelle = p.group === "def"
            ? 1.8
            : Math.max(1.4, Math.min(6.5, 1.4 + (nah - 10) * 0.14));

        let a = p.platz;
        if (!a || uhr >= a.bis || Math.hypot(x - a.x, y - a.y) > schwelle) {
            a = { x, y, bis: uhr + 1.2 + Math.random() * 1.8 };
            p.platz = a;
        }
        return a;
    }

    /**
     * Der Laufweg, den sich ein Spieler in seinem Raum sucht - als Versatz zu
     * seinem Platz im Verbund.
     *
     * Einmal gewaehlt, bleibt er ein paar Sekunden dabei: So entsteht ein Lauf
     * statt eines Zappelns. Neu entschieden wird, wenn die Zeit um ist oder der
     * Ball weit gewandert ist. Wechselt der Ballbesitz, laeuft er erst noch
     * seine Reaktionszeit lang weiter wie bisher - wer das Spiel liest,
     * schaltet schneller um.
     */
    laufwegFuer(p, anker, attacking, dir, ball) {
        if (p.pos === "TW") return { ox: 0, oy: 0, urgency: 0 };
        const uhr = this._laufUhr || 0;
        let weg = p.lauf;
        let neu = !weg || uhr >= weg.bis
            || Math.hypot(ball.x - weg.bx, ball.y - weg.by) > 24;
        if (weg && !neu && weg.team !== this.possessionTeam) {
            if (weg.wechselAb === undefined) weg.wechselAb = uhr + (p.reaktion ?? 0.3);
            if (uhr >= weg.wechselAb) neu = true;
        }
        if (neu) {
            weg = attacking
                ? this.waehleFreilaufen(p, anker, dir, ball)
                : this.waehleZustellen(p, anker, dir, ball);
            const [von, bis] = attacking ? LAUFWEG_DAUER.angriff : LAUFWEG_DAUER.abwehr;
            // Nah am Ball aendert sich die Lage schneller
            const nah = Math.hypot(p.x - ball.x, p.y - ball.y) < 20 ? 0.65 : 1;
            weg.bis = uhr + (von + Math.random() * (bis - von)) * nah;
            weg.team = this.possessionTeam;
            weg.bx = ball.x;
            weg.by = ball.y;
            p.lauf = weg;
        }

        // Nicht ins Abseits laufen, solange der Ball noch hinter der Linie ist
        let ox = weg.ox;
        if (attacking && p.group !== "def") {
            const linie = this._abseitsLinie?.[p.team];
            if (typeof linie === "number" && (linie - ball.x) * dir > 0) {
                const ueber = (anker.x + ox - (linie - dir)) * dir;
                if (ueber > 0) ox -= dir * Math.min(ueber, Math.max(0, ox * dir));
            }
        }
        // Wer noch den Laufweg der anderen Phase laeuft, laeuft ihn ruhig aus
        const passt = weg.team === this.possessionTeam;
        return { ox, oy: weg.oy, urgency: passt ? (weg.urgency || 0) : 0, sprint: passt && !!weg.sprint };
    }

    /** Freilaufen: der Punkt im eigenen Raum, an dem man anspielbar ist */
    waehleFreilaufen(p, anker, dir, ball) {
        // Wer die Linie haelt, variiert entlang der Linie, nicht nach innen
        const bahn = this.spielMitBall(p, null, ball).bahn;
        // Kreative Freiheit weitet den Raum, in dem er sich seinen Weg sucht;
        // die freie Rolle hat den groessten
        const frei = (this.taktik(p.team).w.freiheit || 1) * (p.rolleMit?.frei ? 1.5 : 1);
        const grund = POSITIONS_RADIUS[p.rolle] || { x: 7, y: 7 };
        const raum = { x: grund.x * frei, y: grund.y * frei };
        const r = bahn === "linie" ? { x: raum.x, y: 2.5 } : raum;
        const gegner = this.teamPlayers(p.team === "home" ? "away" : "home").filter(o => o.pos !== "TW");
        const mitspieler = this.teamPlayers(p.team).filter(o => o.id !== p.id && o.pos !== "TW");
        const vorne = dir > 0 ? ball.x / 100 : 1 - ball.x / 100;
        const zumBall = Math.sign(ball.y - anker.y) || 1;

        // Die Taktik bestimmt die Laufwege mit: Wer direkt spielen soll, geht
        // in die Tiefe, statt sich kurz anzubieten; wer kurz spielen soll,
        // kommt dem Ball entgegen. Die Mentalitaet entscheidet, wie viele
        // absichern und wie viele nach vorn gehen.
        const taktik = (p.team === "home" ? this.match.homeClub?.tactics : this.match.awayClub?.tactics) || {};
        const kurz = taktik.passing === "short";
        const direkt = taktik.passing === "direct";
        const mutig = taktik.mentality === "offensive" || taktik.mentality === "very_offensive";
        const vorsichtig = taktik.mentality === "defensive" || taktik.mentality === "very_defensive";

        // Stehenbleiben ist eine Wahl fuer den, der weit weg vom Ball ist. Wer
        // im Spiel ist, bewegt sich.
        const imSpiel = Math.hypot(p.x - ball.x, p.y - ball.y) < 32;
        const kandidaten = imSpiel ? [] : [{ ox: 0, oy: 0, art: "halten", urgency: 0 }];
        const alt = p.lauf;
        if (alt && alt.team === this.possessionTeam) {
            kandidaten.push({ ox: alt.ox, oy: alt.oy, art: alt.art, urgency: alt.urgency, sprint: alt.sprint, bleibt: true });
        }
        for (let i = 0; i < 6; i++) {
            const w = Math.random() * Math.PI * 2;
            const s = 0.35 + Math.random() * 0.65;
            kandidaten.push({ ox: Math.cos(w) * r.x * s, oy: Math.sin(w) * r.y * s, art: "freilaufen", urgency: s > 0.7 ? 1.12 : 0 });
        }
        if (p.group === "att") {
            kandidaten.push({ ox: dir * r.x, oy: (Math.random() - 0.5) * r.y, art: "tiefe",
                urgency: 1.45, sprint: true,
                bonus: (vorne > (direkt ? 0.3 : 0.45) ? 2.2 : -1) + (direkt ? 1.5 : kurz ? -0.8 : 0) + (mutig ? 0.8 : 0) });
            kandidaten.push({ ox: -dir * r.x * 0.9, oy: zumBall * r.y * 0.4, art: "entgegen",
                urgency: 1.2, bonus: (vorne < 0.55 ? 1.6 : 0) + (kurz ? 1.0 : direkt ? -0.8 : 0) });
        }
        if (p.group === "att" && vorne > 0.68) {
            // Liegt der Ball im letzten Drittel, gehen die Spitzen in den
            // Strafraum - an den ersten oder an den zweiten Pfosten
            const torX = this.ownGoalX(p.team === "home" ? "away" : "home");
            const zx = torX - dir * (7 + Math.random() * 7);
            const zy = 50 + (Math.random() - 0.5) * 20;
            kandidaten.push({ ox: zx - anker.x, oy: zy - anker.y, art: "strafraum",
                urgency: 1.3, sprint: true, bonus: 2.5, frei: true });
        }
        // Die Bahn aus dem Positionsspiel: Wer die Linie haelt, zieht auch
        // einmal nach innen; wer im Halbraum steht, geht auch einmal nach
        // aussen, wenn dort Platz ist.
        const aussen = anker.y < 50 ? -1 : 1;
        if (bahn === "linie") {
            kandidaten.push({ ox: dir * r.x * 0.4, oy: 0, art: "breite", urgency: 1.1, bonus: 1.4 });
            if (p.group !== "def") {
                kandidaten.push({ ox: dir * r.x * 0.3, oy: -aussen * raum.y * 1.4, art: "einruecken",
                    urgency: 1.15, bonus: vorne > 0.6 ? 1.2 : -0.5, frei: true });
            }
        } else if (bahn === "halbraum" && BREITE_ROLLEN.includes(p.rolle)) {
            kandidaten.push({ ox: dir * r.x * 0.3, oy: aussen * r.y, art: "breite", urgency: 1.1, bonus: 0.4 });
        }

        // Ist vor einem Verteidiger frei, rueckt er ins Mittelfeld auf - aber
        // nie beide zugleich, einer sichert immer ab
        if (p.group === "def" && bahn === "kette" && vorne > 0.3) {
            const vorX = anker.x + dir * 12;
            let platzVorn = 99;
            gegner.forEach(o => { const d = Math.hypot(o.x - vorX, o.y - anker.y); if (d < platzVorn) platzVorn = d; });
            const schonVorn = mitspieler.some(m => m.group === "def" && m.lauf?.art === "aufruecken"
                && m.lauf.team === this.possessionTeam);
            kandidaten.push({ ox: dir * 11, oy: 0, art: "aufruecken", urgency: 1.1, frei: true,
                bonus: platzVorn > 13 && !schonVorn ? 2.2 : -3 });
        }
        if (p.group === "mid") {
            const d = Math.hypot(ball.x - anker.x, ball.y - anker.y) || 1;
            const k = Math.min(1, 7 / d);
            kandidaten.push({ ox: (ball.x - anker.x) * k * 0.9, oy: (ball.y - anker.y) * k, art: "anbieten",
                urgency: 1.2, bonus: (d > 10 && d < 32 ? 1.8 : 0) + (kurz ? 1.2 : direkt ? -1.0 : 0) });
        }
        if (p.group === "def" || p.rolle === "DM") {
            kandidaten.push({ ox: -dir * r.x * 0.5, oy: 0, art: "absichern", urgency: 0,
                bonus: 0.8 + (vorsichtig ? 1.2 : mutig ? -0.6 : 0) });
        }

        const linie = this._abseitsLinie?.[p.team];
        const ballHinterLinie = typeof linie === "number" && (linie - ball.x) * dir > 0;

        let beste = kandidaten[0], besterWert = -Infinity;
        kandidaten.forEach(k => {
            if (!k.frei) LiveMatchDirector.inEllipse(k, r);
            let qx = Math.max(4, Math.min(96, anker.x + k.ox));
            const qy = Math.max(5, Math.min(95, anker.y + k.oy));
            if (ballHinterLinie && p.group !== "def") {
                const grenze = linie - dir;
                if ((qx - grenze) * dir > 0) {
                    // Steht sein Platz selbst schon jenseits der Linie, geht
                    // es wenigstens nicht noch weiter nach vorn
                    const platzDrueber = (anker.x - grenze) * dir > 0;
                    qx = !platzDrueber ? grenze : (dir > 0 ? Math.min(qx, anker.x) : Math.max(qx, anker.x));
                }
                k.ox = qx - anker.x;
            }

            let frei = 12;
            gegner.forEach(o => { const d = Math.hypot(o.x - qx, o.y - qy); if (d < frei) frei = d; });
            let passweg = 8;
            const zumPunkt = Math.hypot(qx - ball.x, qy - ball.y);
            if (zumPunkt > 5) {
                gegner.forEach(o => {
                    const d = LiveMatchDirector.abstandZurStrecke(o.x, o.y, ball.x, ball.y, qx, qy);
                    if (d < passweg) passweg = d;
                });
            }
            let enge = 0;
            mitspieler.forEach(m => {
                const mx = typeof m.targetX === "number" ? m.targetX : m.x;
                const my = typeof m.targetY === "number" ? m.targetY : m.y;
                const d = Math.hypot(mx - qx, my - qy);
                if (d < 8) enge += (8 - d) * 0.9;
            });
            const weit = Math.hypot(k.ox / r.x, k.oy / r.y) * 0.7;
            const zuNah = zumPunkt < 6 ? (6 - zumPunkt) * 0.8 : 0;

            const wert = frei * 0.55 + passweg * 0.5 - enge - weit - zuNah
                + (k.bonus || 0) + (k.bleibt ? 1.8 : 0) + Math.random() * 3;
            if (wert > besterWert) { besterWert = wert; beste = k; }
        });
        return { ox: beste.ox, oy: beste.oy, art: beste.art, urgency: beste.urgency || 0, sprint: !!beste.sprint };
    }

    /** Ohne Ball: im eigenen Raum die Passwege zum naechsten Gegner zustellen */
    waehleZustellen(p, anker, dir, ball) {
        const basis = POSITIONS_RADIUS[p.rolle] || { x: 7, y: 7 };
        // Die Kette haelt ihre Linie, das Mittelfeld hat mehr Spielraum
        const r = { x: p.group === "def" ? 1.5 : basis.x * 0.6, y: basis.y * 0.7 };
        const gegner = this.teamPlayers(p.team === "home" ? "away" : "home")
            .filter(o => o.pos !== "TW" && o.id !== this.carrierId)
            .map(o => ({ o, d: Math.hypot(o.x - anker.x, o.y - anker.y) }))
            .filter(e => e.d < 26)
            .sort((a, b) => a.d - b.d);
        const mitspieler = this.teamPlayers(p.team).filter(o => o.id !== p.id && o.pos !== "TW");

        const imSpiel = Math.hypot(p.x - ball.x, p.y - ball.y) < 32;
        const kandidaten = imSpiel ? [] : [{ ox: 0, oy: 0, art: "halten", urgency: 0 }];
        const alt = p.lauf;
        if (alt && alt.team === this.possessionTeam) {
            kandidaten.push({ ox: alt.ox, oy: alt.oy, art: alt.art, urgency: alt.urgency, bleibt: true });
        }
        for (let i = 0; i < 4; i++) {
            const w = Math.random() * Math.PI * 2;
            const s = Math.random();
            kandidaten.push({ ox: Math.cos(w) * r.x * s, oy: Math.sin(w) * r.y * s, art: "verschieben", urgency: 0 });
        }
        const zumBall = Math.sign(ball.y - anker.y) || 1;
        kandidaten.push({ ox: -dir * r.x * 0.5, oy: zumBall * r.y * 0.8, art: "ballseite", urgency: 1.05 });
        gegner.slice(0, 2).forEach(e => {
            // Auf der Linie zwischen Ball und Gegenspieler, naeher am Gegner
            const zx = ball.x + (e.o.x - ball.x) * 0.62;
            const zy = ball.y + (e.o.y - ball.y) * 0.62;
            kandidaten.push({ ox: zx - anker.x, oy: zy - anker.y, art: "zustellen", urgency: 1.1 });
        });

        let beste = kandidaten[0], besterWert = -Infinity;
        kandidaten.forEach(k => {
            LiveMatchDirector.inEllipse(k, r);
            const qx = anker.x + k.ox;
            const qy = anker.y + k.oy;
            let deckung = 0;
            gegner.forEach(e => {
                const d = LiveMatchDirector.abstandZurStrecke(qx, qy, ball.x, ball.y, e.o.x, e.o.y);
                if (d < 6) deckung += (6 - d) * 0.6;
            });
            let enge = 0;
            mitspieler.forEach(m => {
                const mx = typeof m.targetX === "number" ? m.targetX : m.x;
                const my = typeof m.targetY === "number" ? m.targetY : m.y;
                const d = Math.hypot(mx - qx, my - qy);
                if (d < 7) enge += (7 - d) * 0.9;
            });
            const weit = Math.hypot(k.ox / (r.x || 1), k.oy / (r.y || 1)) * 1.0;
            const wert = deckung - enge - weit + (k.bleibt ? 1.5 : 0) + Math.random() * 1.5;
            if (wert > besterWert) { besterWert = wert; beste = k; }
        });
        return { ox: beste.ox, oy: beste.oy, art: beste.art, urgency: beste.urgency || 0, sprint: false };
    }

    /** Stutzt einen Versatz auf die Ellipse des Positionsraums */
    static inEllipse(k, r) {
        const rx = r.x || 0.01, ry = r.y || 0.01;
        const n = Math.hypot(k.ox / rx, k.oy / ry);
        if (n > 1) { k.ox /= n; k.oy /= n; }
        return k;
    }

    /** Abstand eines Punkts zur Strecke a-b */
    static abstandZurStrecke(px, py, ax, ay, bx, by) {
        const vx = bx - ax, vy = by - ay;
        const l2 = vx * vx + vy * vy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2)) : 0;
        return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
    }

    /**
     * Wo ein Spieler den Ball sieht.
     *
     * Die Mannschaft verschob bisher in einem einzigen Bild gemeinsam mit dem
     * Ball - wie an Faeden gezogen. Im Fussball reagiert jeder einen
     * Wimpernschlag spaeter als der Ball: der Nachbar sofort, wer weit weg
     * steht und das Spiel schlechter liest, eine halbe Sekunde danach.
     */
    nimmBallWahr(p, ball, lauf) {
        if (!p.sicht) p.sicht = { x: ball.x, y: ball.y };
        if (lauf <= 0) return;
        const d = Math.hypot(p.x - ball.x, p.y - ball.y);
        const traeg = (p.traegheit || 0.4) * (0.6 + Math.min(1, d / 45) * 0.9);
        const a = 1 - Math.exp(-lauf / traeg);
        p.sicht.x += (ball.x - p.sicht.x) * a;
        p.sicht.y += (ball.y - p.sicht.y) * a;
    }

    /**
     * Ein Spieler laeuft zu seinem Ziel: Er tritt an, erreicht sein Tempo und
     * bremst rechtzeitig ab, statt auf dem Punkt zu kleben.
     *
     * Gerechnet wird in kleinen Teilschritten, damit auch der Vorlauf auf der
     * schnellsten Stufe dieselben Boegen laeuft wie das Grundtempo.
     */
    laufeZu(p, target, lauf) {
        if (!(lauf > 0)) return;
        if (typeof p.lvx !== "number") { p.lvx = 0; p.lvy = 0; }

        const u = target.urgency || 1;
        const vmax = Math.min(p.baseSpeed * u * (0.62 + (p.freshness ?? 1) * 0.38), SPRINT_DECKE);
        // Wer es eilig hat, tritt auch haerter an
        const antritt = ANTRITT * Math.max(0.8, Math.min(2.4, u));
        const bremsen = BREMSKRAFT * Math.max(1, Math.min(2.2, u));
        const nachziehen = 3.2 * Math.max(1, u);

        const schritte = Math.max(1, Math.ceil(lauf * 45));
        const h = lauf / schritte;
        for (let i = 0; i < schritte; i++) {
            const dx = target.x - p.x;
            const dy = target.y - p.y;
            const dist = Math.hypot(dx, dy);

            // Die Wunschgeschwindigkeit: volles Tempo, aber so, dass er am
            // Ziel auch zum Stehen kommt
            let wx = 0, wy = 0;
            if (dist > 0.2) {
                const v = Math.min(vmax, nachziehen * dist, Math.sqrt(2 * bremsen * (dist - 0.2)));
                wx = dx / dist * v;
                wy = dy / dist * v;
            }

            let sx = wx - p.lvx;
            let sy = wy - p.lvy;
            const tempo2 = p.lvx * p.lvx + p.lvy * p.lvy;
            // Abbremsen und Wenden geht schneller als Antreten
            const bremst = (wx * p.lvx + wy * p.lvy) < tempo2 - 1e-6;
            const grenze = (bremst ? bremsen : antritt) * h;
            const aenderung = Math.hypot(sx, sy);
            if (aenderung > grenze) {
                sx *= grenze / aenderung;
                sy *= grenze / aenderung;
            }
            p.lvx += sx;
            p.lvy += sy;
            p.x += p.lvx * h;
            p.y += p.lvy * h;
        }
    }

    selectPressingPlayers() {
        const match = this.match;
        const ball = match.ball;
        const defendingTeam = this.possessionTeam === "home" ? "away" : "home";
        const w = this.taktik(defendingTeam).w;

        const abstand = p => Math.hypot(p.x - ball.x, p.y - ball.y);
        // Wer abschirmt oder als Konterspieler vorn bleibt, jagt nicht den Ball
        const kandidaten = this.teamPlayers(defendingTeam)
            .filter(p => p.pos !== "TW" && !(p.rolleGegen?.nieHeraus) && !(p.rolleGegen?.konter));
        const sorted = (kandidaten.length ? kandidaten : this.teamPlayers(defendingTeam).filter(p => p.pos !== "TW"))
            .sort((a, b) => abstand(a) - abstand(b));

        // Wer schon presst, bleibt dran, bis ein anderer deutlich naeher ist.
        // Vorher wechselte die Rolle fast mit jedem Bild zwischen zwei
        // gleich weit entfernten Spielern - beide rannten abwechselnd los und
        // zurueck.
        const zugriff = this.presstImRaum(defendingTeam, ball);
        // Nach dem Ballverlust geht beim Gegenpressing einer mehr drauf
        const seitWechsel = (this._laufUhr || 0) - (this._wechselUhr ?? -99);
        const anzahl = zugriff ? Math.min(4, (w.presser || 2) + (seitWechsel < (w.gegenpressing || 0) && w.gegenpressing > 3 ? 1 : 0)) : 1;
        const bisher = (this._presser && this._presser.team === defendingTeam) ? this._presser.ids : [];
        const gewaehlt = sorted.slice(0, Math.max(4, anzahl + 1))
            .map(p => ({ id: p.id, wert: abstand(p) - (bisher.includes(p.id) ? 4 : 0) }))
            .sort((a, b) => a.wert - b.wert)
            .slice(0, Math.max(2, anzahl))
            .map(e => e.id);
        this._presser = { team: defendingTeam, ids: gewaehlt, zugriff };

        const modus = new Map();
        if (zugriff) {
            gewaehlt.slice(0, anzahl).forEach(id => modus.set(id, "press"));
        } else {
            // Ausserhalb der Pressingzone geht nur einer heraus - und der stellt
            // zu, statt den Ball zu jagen. Ein pressender Spieler (Rolle)
            // greift trotzdem an, wenn der Ball in seine Naehe kommt.
            if (gewaehlt[0] !== undefined) modus.set(gewaehlt[0], "screen");
            this.teamPlayers(defendingTeam).forEach(p => {
                if (p.rolleGegen?.heraus && p.pos !== "TW" && abstand(p) < 13) modus.set(p.id, "press");
            });
        }
        return modus;
    }

    /**
     * Greift die verteidigende Mannschaft den Ballfuehrenden hier an?
     *
     * Vorher sprinteten immer die zwei Naechsten auf den Ball, egal wo er
     * lag. Ein Innenverteidiger im eigenen Drittel hatte damit gemessen im
     * Mittel knapp vier Meter Platz - er konnte nie andribbeln, und die
     * Aufbauspieler standen staendig unter Druck. Im Fussball presst eine
     * Mannschaft erst ab ihrer Pressinglinie (der Anlaufhoehe der Taktik):
     * Ein Mittelfeldpressing laesst die Innenverteidiger den Ball haben und
     * greift ab dem ersten Drittel an, ein hohes Pressing ueberall, ein
     * tiefer Block erst an der Mittellinie. Die Pressingintensitaet schiebt
     * die Linie. Nach einem Ballverlust wird - je nach Anweisung - ueberall
     * gegengepresst.
     */
    presstImRaum(team, ball) {
        if (this.mode !== "ambient") return true;
        const w = this.taktik(team).w;
        const angreifer = team === "home" ? "away" : "home";
        const fortschritt = (ball.x - this.ownGoalX(angreifer)) * this.attackDir(angreifer) / 92;
        const linie = typeof w.pressingLinie === "number" ? w.pressingLinie : 0.33;
        const seitWechsel = (this._laufUhr || 0) - (this._wechselUhr ?? -99);
        const gegenpressing = seitWechsel < (w.gegenpressing ?? 2.2);
        // Kurzen Abstoss verhindern: Der Torwart am Ball wird angelaufen
        const torwartAmBall = w.abstossStoeren && this.getPlayer2D(this.carrierId)?.pos === "TW";
        return gegenpressing || torwartAmBall || fortschritt > linie;
    }

    /**
     * Worauf sich die Mannschaft ausrichtet: nicht auf den Ball dort, wo er
     * gerade ist, sondern dort, wo er ankommt.
     *
     * Die Elf schob sich bisher nach der aktuellen Ballposition. Waehrend eines
     * Zuspiels lief der Ball damit allen davon: Gemessen war er in siebzehn
     * Prozent der Uebertragung weiter als acht Meter von jedem Spieler entfernt
     * - er lag sichtbar allein auf dem Rasen. Den Ball zu bremsen half nicht
     * (achtzehn Prozent), weil das Problem nicht sein Tempo ist, sondern dass
     * niemand vorauslaeuft.
     *
     * Im Fussball setzt sich die ganze Mannschaft in Bewegung, sobald der Ball
     * abgespielt ist - keiner wartet ab, wo er niedergeht.
     */
    ballBezug() {
        const ball = this.match.ball;
        if (!ball.inFlight || typeof ball.targetX !== "number") {
            return { x: ball.x, y: ball.y };
        }
        const W = 0.85;
        return {
            x: ball.x + (ball.targetX - ball.x) * W,
            y: ball.y + (ball.targetY - ball.y) * W
        };
    }

    /**
     * Wer dem fliegenden Ball entgegengeht: der Angespielte und der naechste
     * Gegenspieler. Alle anderen behalten ihre Form.
     */
    laeuftDemBallEntgegen(p) {
        if (p.pos === "TW") return false;
        if (p.id === this.carrierId) return true;

        const ball = this.match.ball;
        const ziel = { x: ball.targetX, y: ball.targetY };
        const gegner = (this.match.players2D || [])
            .filter(q => q.team !== this.possessionTeam && q.pos !== "TW");
        if (!gegner.length) return false;

        let naechster = gegner[0], best = Infinity;
        gegner.forEach(q => {
            const d = Math.hypot(q.x - ziel.x, q.y - ziel.y);
            if (d < best) { best = d; naechster = q; }
        });
        return naechster.id === p.id;
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

        // Wer mit dem Ball laeuft, laeuft dorthin, wohin er ihn mitnimmt
        if (this.carryTarget && p.id === this.carryTarget.id) {
            return { x: this.carryTarget.x, y: this.carryTarget.y, urgency: 1.45, sprint: true };
        }

        // Wer dem Ball am naechsten ist, laeuft dorthin, wo er ankommt.
        //
        // Die Mannschaftsform bleibt am echten Ball - sie an den Landepunkt zu
        // haengen machte offensive und defensive Mentalitaet ununterscheidbar
        // (siebenundvierzig gegen siebenundvierzig Prozent Vorwaertsspiel).
        // Antizipiert wird dort, wo es im Fussball auch passiert: beim
        // Angespielten und bei dem, der ihn attackieren will.
        if (ball.inFlight && typeof ball.targetX === "number" && this.laeuftDemBallEntgegen(p)) {
            return { x: ball.targetX, y: ball.targetY, urgency: p.id === this.carrierId ? 1.9 : 1.55, sprint: true };
        }

        if (p.pos === "TW") {
            // Bei Ecke, Elfmeter und Freistoss gehoert der Torwart auf die Linie
            const standard = this.deadBall && p.id !== this.carrierId
                ? this.torwartBeimStandard(p, this.deadBall) : null;
            return standard || this.computeKeeperTarget(p, ball);
        }

        const attacking = p.team === this.possessionTeam;
        const dir = this.attackDir(p.team);

        if (this.deadBall) {
            const setPieceTarget = this.computeSetPieceTarget(p, this.deadBall);
            if (setPieceTarget) return setPieceTarget;
        }

        // Den Block richtet jeder danach aus, wo er den Ball sieht - nicht nach
        // dem Ball selbst. Zweikampf, Pressing und Ballnaehe bleiben am echten
        // Ball.
        const gesehen = p.sicht || ball;
        const ballProgress = dir > 0 ? gesehen.x / 100 : 1 - gesehen.x / 100;

        // Die Elf steht als Block: mit Ball breit, ohne Ball eng (siehe
        // formMitBall und formOhneBall). Zwischen beiden Formen liegt das
        // Umschalten. Bisher sprang die Elf mit jedem Ballwechsel von der einen
        // in die andere - fuer die Spitzen gut dreissig Einheiten, bei einem
        // Ballwechsel alle paar Sekunden. Die ganze Mannschaft rannte dadurch
        // staendig geschlossen hin und her.
        const form = this.umschaltgrad(p);
        const mitBall = this.formMitBall(p, gesehen, ball, dir, ballProgress);
        const ohneBall = this.formOhneBall(p, gesehen, dir);
        let tx = ohneBall.x + (mitBall.x - ohneBall.x) * form;
        let ty = ohneBall.y + (mitBall.y - ohneBall.y) * form;

        // Die Position im Verbund, bevor Zweikampf und Pressing sie ueberschreiben
        const blockTx = tx;
        const blockTy = ty;

        let urgency = 1;
        let sprinting = false;
        if (attacking && form > 0.5 && mitBall.urgency) {
            urgency = mitBall.urgency;
            sprinting = true;
        }

        // Der Platz im Verbund wird nicht stufenlos nachgefuehrt: Wer weit
        // vom Ball steht, rueckt in Schueben nach und steht dazwischen.
        if (!pressers.has(p.id) && p.id !== this.carrierId) {
            const platz = this.haltePlatz(p, tx, ty, ball);
            tx = platz.x;
            ty = platz.y;
        }

        // Der eigene Laufweg im Raum der Position: freilaufen, entgegenkommen,
        // in die Tiefe gehen - oder ohne Ball einen Passweg zustellen.
        if (!pressers.has(p.id) && p.id !== this.carrierId) {
            const weg = this.laufwegFuer(p, { x: tx, y: ty }, attacking, dir, ball);
            tx += weg.ox;
            ty += weg.oy;
            if (weg.urgency > urgency) urgency = weg.urgency;
            if (weg.sprint) sprinting = true;
        }

        const modus = pressers.get ? pressers.get(p.id) : (pressers.has(p.id) ? "press" : null);
        const wT = this.taktik(p.team).w;
        const rG = p.rolleGegen || {};
        if (modus === "screen") {
            // Anlaufen ohne Zugriff: Er stellt sich in den Passweg zur Mitte
            // und laesst den Ball dem Gegner, bis der in die Zone kommt.
            tx = ball.x - dir * 12;
            ty = ball.y + (50 - ball.y) * 0.35;
            urgency = 1.25;
        } else if (modus === "press") {
            const back = dir * -2.5;
            tx = ball.x + back;
            // Pressingfalle: Wer nach aussen lenkt, laeuft von innen an und
            // laesst dem Gegner nur den Weg zur Seitenlinie - und umgekehrt.
            const innen = Math.sign(50 - ball.y) || 1;
            let seitlich = (p.seed % 1) * 3 - 1.5;
            if (wT.falle === "aussen") seitlich = innen * 2.8;
            else if (wT.falle === "innen") seitlich = -innen * 2.8;
            ty = ball.y + seitlich;
            urgency = wT.pressTempo || 1.85;
            sprinting = true;
        } else if (!attacking && !rG.konter && this.deckt(p, wT, rG)) {
            const ziel = this.deckungsZiel(p, tx, ty, dir, wT, rG, ball);
            if (ziel) {
                tx = ziel.x;
                ty = ziel.y;
                if (ziel.urgency > urgency) urgency = ziel.urgency;
            }
        } else if (!rG.konter || attacking) {
            // Die Anziehung des Balls darf den Block nicht auseinanderziehen -
            // ohne Ball zieht es die Kette sonst aus der Ordnung.
            const dist = Math.hypot(p.x - ball.x, p.y - ball.y);
            if (dist < 26) {
                const pull = (attacking ? 0.26 : 0.2) * (1 - dist / 26);
                // Die Kette schiebt zur Ballseite, aber sie tritt nicht aus
                // der Linie heraus - das tut nur, wer presst
                if (attacking) tx += (ball.x - tx) * pull;
                ty += (ball.y - ty) * pull;
                urgency = 1.25;
            }
        }

        // Eine Zone hat eine Grenze. Wer verteidigt, darf herausruecken - aber
        // nicht beliebig weit: Sonst folgt am Ende doch wieder jeder seinem
        // Gegenspieler ueber das Feld, und der Block loest sich auf. Nur wer
        // aktiv presst - oder in Manndeckung seinen Mann hat -, verlaesst
        // seine Zone ganz. Mannorientiert ist die Zone groesser, eine
        // pressende oder verfolgende Rolle geht weiter heraus, eine
        // abschirmende weniger.
        if (!attacking && modus !== "press" && !rG.konter && wT.deckung !== "mann") {
            const zone = (p.group === "def" ? 7 : 10) * (wT.zoneFaktor || 1) * (rG.zone || 1) * (rG.verfolgt ? 1.5 : 1);
            tx = Math.max(blockTx - zone, Math.min(blockTx + zone, tx));
            ty = Math.max(blockTy - zone, Math.min(blockTy + zone, ty));
        }

        if (this.mode === "ambient" && p.id === this.carrierId) {
            tx = ball.x + dir * 1.2;
            ty = ball.y;
            urgency = 1.4;
            sprinting = true;
        }

        // Umschalten: Nach einem Ballverlust sprintet zurueck, wer vor dem
        // Ball steht; nach einem Ballgewinn gehen die Angreifer sofort in die
        // Tiefe. Vorher trabte die ganze Elf in beiden Faellen gleich weiter.
        // Wie umgeschaltet wird, sagt die Taktik: Beim Zurueckziehen rennt die
        // ganze Elf hinter den Ball, beim Kontern gehen auch die Laeufer aus
        // dem Mittelfeld mit, beim Ballsichern kommt niemand in die Tiefe.
        const seitWechsel = (this._laufUhr || 0) - (this._wechselUhr ?? -99);
        if (this.mode === "ambient") {
            const zurueck = wT.gegenpressing === 0;
            const rueckDauer = zurueck ? UMSCHALT_DAUER * 1.5 : UMSCHALT_DAUER;
            const konterDauer = wT.konter > 0 ? UMSCHALT_DAUER * 1.6 : UMSCHALT_DAUER;
            const eile = wT.rueckzugEile || 1.6;
            if (!attacking && seitWechsel < rueckDauer && !rG.konter && (zurueck || p.group !== "att")
                && (p.x - ball.x) * dir > 4 && (p.x - tx) * dir > 6 && urgency < eile) {
                urgency = eile;
                sprinting = true;
            } else if (attacking && seitWechsel < konterDauer && wT.konter >= 0 && urgency < 1.4
                && (p.group === "att" || (wT.konter > 0 && (p.rolleMit?.laeuft || BREITE_ROLLEN.includes(p.rolle) && p.group === "mid")))) {
                urgency = wT.konter > 0 ? 1.55 : 1.4;
                sprinting = true;
            }
        }

        // Gangart: Wer weit weg vom Ball steht und seinen Platz fast erreicht
        // hat, geht. Wer weit hinter seinem Platz ist, zieht das Tempo an.
        // Vorher trabte jeder immer im selben Tempo.
        if (this.mode === "ambient") {
            const zumBall = Math.hypot(p.x - ball.x, p.y - ball.y);
            const zumZiel = Math.hypot(tx - p.x, ty - p.y);
            if (urgency <= 1 && !sprinting && zumBall > 28 && zumZiel < 7) {
                urgency = 0.6;
            } else if (zumZiel > 14) {
                urgency = Math.max(urgency, Math.min(1.7, 1 + (zumZiel - 14) / 20));
                if (urgency >= 1.3) sprinting = true;
            }
        }

        const goalX = this.ownGoalX(p.team);
        const minGap = p.group === "def" ? 3 : (p.group === "mid" ? 11 : 21);
        const maxGap = 92;

        if (dir > 0) tx = Math.max(goalX + minGap, Math.min(goalX + maxGap, tx));
        else tx = Math.max(goalX - maxGap, Math.min(goalX - minGap, tx));

        p.sprinting = sprinting;

        return { x: Math.max(2, Math.min(98, tx)), y: Math.max(4, Math.min(96, ty)), urgency };
    }

    /**
     * Wie weit ein Spieler von der Abwehr- in die Angriffsform umgeschaltet
     * hat: null ohne Ball, eins mit Ball.
     *
     * Umgeschaltet wird erst nach der eigenen Reaktionszeit und dann zuegig,
     * aber nicht in einem Bild. Ein Ball, der nach einer Sekunde zurueckerobert
     * ist, schickt deshalb nicht mehr die ganze Mannschaft auf die Reise.
     */
    umschaltgrad(p) {
        const ziel = p.team === this.possessionTeam ? 1 : 0;
        const uhr = this._laufUhr || 0;
        if (typeof p.form !== "number") p.form = ziel;
        const vergangen = Math.max(0, uhr - (p._formUhr ?? uhr));
        p._formUhr = uhr;
        if (uhr - (this._wechselUhr ?? -99) < (p.reaktion ?? 0.3)) return p.form;
        // Wer kontert, ist schneller in der Form mit Ball; wer den Ball
        // sichert, laesst sich Zeit
        const konter = ziel === 1 ? (this.taktik(p.team).w.konter || 0) : 0;
        const schritt = vergangen / (konter > 0 ? 1.1 : (konter < 0 ? 2.0 : 1.6));
        p.form += Math.max(-schritt, Math.min(schritt, ziel - p.form));
        return p.form;
    }

    /**
     * Die Form mit Ball: Positionsspiel statt verschobener Formation.
     *
     * Mit Ball bleibt im Fussball kaum jemand auf seinem Platz. Auf jeder
     * Seite haelt genau ein Spieler die Linie, die anderen besetzen die
     * Halbraeume und das Zentrum; im letzten Drittel sind alle fuenf Bahnen
     * besetzt. So spielen Guardiolas City (3-2-5), Napoli oder Juventus, und
     * so baut der FM26 aus der Formation ohne Ball eine eigene mit Ball.
     * Wer welche Rolle bekommt, legt spielMitBall fest.
     */
    formMitBall(p, gesehen, ball, dir, ballProgress) {
        const plan = this.spielMitBall(p, gesehen, ball);
        let y = plan.y;

        // Die ganze Elf greift an, nicht nur die Spitzen: Sie rueckt als
        // Einheit mit dem Ball auf (siehe hoeheImVerbund).
        let x = this.hoeheImVerbund(p, ballProgress, true, plan.tiefe);

        // Der Angriffsfokus verschiebt die Mitte der Mannschaft auf eine Seite
        // - so wird aus einer Zeile im Taktikbogen ein sichtbares Übergewicht
        // auf dem Flügel. "Links" meint die linke Seite aus Sicht der
        // Angriffsrichtung. Wer die Linie hält, bleibt an der Linie.
        const tactics = (p.team === "home" ? this.match.homeClub?.tactics : this.match.awayClub?.tactics) || {};
        const fokus = tactics.focus || tactics.attackFocus;
        if ((fokus === "left" || fokus === "right") && plan.bahn !== "linie") {
            y += (fokus === "left" ? 1 : -1) * this.linksVorzeichen(p.team) * 5.5;
        }

        // Wer vorn steht, wartet auf der Abseitslinie, solange der Ball noch
        // dahinter ist - den Lauf in die Tiefe startet er von dort
        if (p.group !== "def" || plan.bahn === "linie") {
            const abseits = this._abseitsLinie?.[p.team];
            if (typeof abseits === "number" && (abseits - ball.x) * dir > 0) {
                const grenze = abseits + dir * 1.0;
                if ((x - grenze) * dir > 0) x = grenze;
            }
        }

        // Breite geben ist nach dem Ballgewinn das Erste: Wer die Linie halten
        // soll und noch innen steht, sprintet hinaus. Ohne das kam er nie an -
        // bis dahin war der Ball oft schon wieder weg.
        let urgency = plan.hinterlaeuft ? 1.35 : 0;
        if (plan.bahn === "linie" && Math.abs(p.y - y) > 8) urgency = Math.max(urgency, 1.4);

        return { x, y: Math.max(4, Math.min(96, y)), urgency };
    }

    /**
     * Die Rolle eines Spielers im Positionsspiel seiner Mannschaft: welche
     * Bahn er besetzt (Linie, Halbraum, Zentrum) und wie weit vorn er steht.
     *
     * Die Regeln gelten fuer jede Formation, weil sie an den Rollen haengen,
     * nicht an einem festen Bild:
     *  - Je Fluegel haelt genau einer die Linie. Stehen dort zwei (Aussen-
     *    verteidiger und Fluegelspieler), hinterlaeuft auf der Ballseite der
     *    Aussenverteidiger, und der Fluegelspieler zieht in den Halbraum.
     *    Auf der ballfernen Seite haelt der Fluegelspieler die Breite fuer die
     *    Verlagerung, der Aussenverteidiger rueckt ein und bildet mit den
     *    Innenverteidigern die Dreierkette - die Absicherung, falls der Ball
     *    verloren geht.
     *  - Im Aufbau spreizen die Innenverteidiger, die Aussenverteidiger stehen
     *    breit auf halber Hoehe, die Fluegelspieler halten die Gegner hinten.
     *  - Der Sechser bleibt zentral vor der Kette, die Achter besetzen die
     *    Halbraeume, die Spitzen das Zentrum.
     *  - Die Mitte lehnt sich zur Ballseite, die Linie bleibt, wo sie ist.
     */
    spielMitBall(p, gesehen, ball) {
        const plan = this.planMitBall(p.team, ball);
        const eintrag = plan.get(p.id);
        if (eintrag) return eintrag;
        return { y: p.baseY, tiefe: this.formationsTiefe(p), bahn: "zentrum" };
    }

    planMitBall(team, ball) {
        const uhr = this._laufUhr || 0;
        if (!this._planMitBall) this._planMitBall = {};
        const vorhanden = this._planMitBall[team];
        if (vorhanden && vorhanden.uhr === uhr) return vorhanden.rollen;

        const rollen = new Map();
        const feld = this.teamPlayers(team).filter(q => q.pos !== "TW");
        const schwerpunkt = this._schwerpunkt?.[team];
        const b = typeof schwerpunkt === "number" ? schwerpunkt : 0.5;
        const tk = this.taktik(team);
        const w = tk.w;

        // Aufbau und Ballseite wechseln nicht bei jedem Zuspiel: Sonst
        // tauschten Aussenverteidiger und Fluegelspieler ihre Rollen jedes Mal,
        // wenn der Ball die Mitte kreuzt, und rannten nur noch quer uebers
        // Feld, ohne je anzukommen.
        if (!this._lageMitBall) this._lageMitBall = {};
        const lage = this._lageMitBall[team] || { aufbau: b < 0.38, seite: ball.y < 50 ? -1 : 1 };
        if (b < 0.33) lage.aufbau = true;
        else if (b > 0.42) lage.aufbau = false;
        if (ball.y < 36) lage.seite = -1;
        else if (ball.y > 64) lage.seite = 1;
        this._lageMitBall[team] = lage;
        const aufbau = lage.aufbau;
        const ballSeite = lage.seite;
        const lehnen = (ball.y - 50) * 0.2;
        const tiefe = q => this.formationsTiefe(q);

        // Die Bahnen: Breite im Angriff schiebt die Linie hinaus oder herein.
        // Eng spielt niemand an der Seitenlinie.
        const LINIE = 44 + Math.max(-8, Math.min(2, w.breite || 0));
        const HALBRAUM = 21 + Math.min(0, (w.breite || 0) * 0.4);
        const bahnVon = (y, q, t) => {
            const a = Math.abs(y - 50);
            if (a > 36) return "linie";
            if (a > 14) return "halbraum";
            return (q.group === "def" && t < 0.15) ? "kette" : "zentrum";
        };

        // --- Feste Form mit Ball (3-2-5, 2-3-5, 4-2-4 ... oder Grundformation)
        if (tk.formMitBall !== "auto") {
            feld.forEach(q => {
                let y, t;
                if (q.formMit) {
                    y = this.querAusForm(q.formMit.x, team);
                    t = q.formMit.tiefe;
                } else {
                    // Grundformation: die eigene Form, auseinandergezogen
                    const breit = BREITE_ROLLEN.includes(q.rolle) ? 1.0 : 0.8;
                    y = 50 + (q.baseY - 50) * breit;
                    t = tiefe(q);
                }
                const bahn = bahnVon(y, q, t);
                if (bahn === "linie") y = 50 + Math.sign(y - 50) * LINIE;
                else y += lehnen * (bahn === "zentrum" ? 0.6 : 0.4);
                rollen.set(q.id, { y, tiefe: t, bahn });
            });
            this._planMitBall[team] = { uhr, rollen };
            return rollen;
        }

        // --- Aus den Rollen: Positionsspiel
        const rolle = q => q.rolleMit || {};
        const hoeheAus = (q, standard) => {
            const r = rolle(q);
            if (aufbau && typeof r.aufbauHoehe === "number") return r.aufbauHoehe;
            if (typeof r.hoehe === "number") return r.hoehe;
            return standard;
        };
        const FLUEGEL = ["LV", "RV", "LM", "RM", "LA", "RA"];
        const kipptEin = feld.some(q => rolle(q).kippt) && aufbau;

        [-1, 1].forEach(seite => {
            const linie = 50 + seite * LINIE;
            const halbraum = 50 + seite * HALBRAUM;
            const dreierkette = 50 + seite * 27;
            // Links oder rechts aus Sicht der Mannschaft - fuer Hinterlaufen
            const anweisung = seite === this.linksVorzeichen(team) ? w.aussen?.links : w.aussen?.rechts;
            const aussen = feld
                .filter(q => (FLUEGEL.includes(q.rolle) || Math.abs(q.baseY - 50) > 32)
                    && Math.sign(q.baseY - 50) === seite && q.group !== "gk")
                .sort((a, c) => tiefe(a) - tiefe(c));
            if (aussen.length === 0) return;

            // Wer hier die Linie will: die Rolle entscheidet. Ein einrueckender
            // Aussenverteidiger oder ein inverser Fluegel geben sie ab.
            const will = aussen.filter(q => rolle(q).bahn === "linie" || rolle(q).dynamisch || !q.rolleMit);
            aussen.filter(q => !will.includes(q)).forEach(q => {
                const r = rolle(q);
                const t = hoeheAus(q, tiefe(q));
                const breite = typeof r.breite === "number" ? r.breite : (r.bahn === "kette" ? 27 : HALBRAUM);
                const y = 50 + seite * breite + (r.bahn === "kette" ? 0 : lehnen * 0.5);
                rollen.set(q.id, { y, tiefe: t, bahn: r.bahn || bahnVon(y, q, t) });
            });
            if (will.length === 0) return;

            if (will.length === 1) {
                // Allein auf seiner Seite (Raute, Dreierkette mit Schienen,
                // oder der Partner ist eingerueckt): er ist die Breite
                const q = will[0];
                const r = rolle(q);
                let hoch;
                if (typeof r.hoehe === "number") hoch = hoeheAus(q, r.hoehe);
                else hoch = q.group === "def" ? (aufbau ? 0.35 : 0.78) : Math.max(tiefe(q), aufbau ? tiefe(q) : 0.85);
                rollen.set(q.id, { y: linie, tiefe: hoch, bahn: "linie", hinterlaeuft: q.group === "def" && !aufbau && seite === ballSeite });
                return;
            }

            const hinten = will[0];
            const vorn = will[will.length - 1];
            will.slice(1, -1).forEach(q => rollen.set(q.id, { y: 50 + seite * 33 + lehnen, tiefe: tiefe(q), bahn: "halbraum" }));
            const vornHoch = Math.max(tiefe(vorn), hoeheAus(vorn, 0.85));
            // Ein Schienenspieler hinter einem Fluegelspieler nimmt die Linie
            // selbst, sobald der Aufbau vorbei ist - der Fluegel geht nach innen
            const hintenSchiene = rolle(hinten).bahn === "linie" && typeof rolle(hinten).hoehe === "number";
            const ueberlappen = anweisung === "hinterlaufen" ? 0.45 : 0.6;

            if (aufbau) {
                rollen.set(hinten.id, { y: 50 + seite * (LINIE - 4), tiefe: hintenSchiene ? hoeheAus(hinten, 0.3) : 0.3, bahn: "breit" });
                rollen.set(vorn.id, { y: linie, tiefe: Math.max(tiefe(vorn), 0.8), bahn: "linie" });
            } else if (anweisung === "unterlaufen" && seite === ballSeite && b > 0.45) {
                // Unterlaufen: Der Aussenverteidiger laeuft innen durch den
                // Halbraum, der Fluegelspieler haelt die Linie
                rollen.set(hinten.id, { y: halbraum + lehnen * 0.5, tiefe: 0.82, bahn: "halbraum", hinterlaeuft: true });
                rollen.set(vorn.id, { y: linie, tiefe: vornHoch, bahn: "linie" });
            } else if (hintenSchiene || (seite === ballSeite && b > ueberlappen)) {
                // Im letzten Drittel auf der Ballseite hinterlaeuft der
                // Aussenverteidiger, der Fluegelspieler zieht nach innen
                rollen.set(hinten.id, { y: linie, tiefe: hintenSchiene ? hoeheAus(hinten, 0.85) : 0.85, bahn: "linie", hinterlaeuft: true });
                rollen.set(vorn.id, { y: halbraum + lehnen * 0.5, tiefe: Math.max(vornHoch, 0.92), bahn: "halbraum" });
            } else if (seite === ballSeite) {
                rollen.set(hinten.id, { y: 50 + seite * 33, tiefe: 0.5, bahn: "halbraum" });
                rollen.set(vorn.id, { y: linie, tiefe: vornHoch, bahn: "linie" });
            } else {
                rollen.set(hinten.id, { y: dreierkette, tiefe: 0.04, bahn: "kette" });
                rollen.set(vorn.id, { y: linie, tiefe: vornHoch, bahn: "linie" });
            }
        });

        // Die Mitte: Kette spreizt, Sechser zentral, Achter in die Halbraeume.
        // Jede Rolle kann Hoehe, Breite und Bahn selbst bestimmen.
        feld.forEach(q => {
            if (rollen.has(q.id)) return;
            const r = rolle(q);
            const abstand = q.baseY - 50;
            const seite = Math.sign(abstand) || (q.seed % 2 < 1 ? -1 : 1);
            let y, t = tiefe(q), bahn = "zentrum";
            if (q.group === "def") {
                // Kippt der Sechser ab, gehen die Innenverteidiger weit auseinander
                y = 50 + abstand * (kipptEin ? 2.4 : (aufbau ? 1.8 : 1.35));
                y = Math.max(kipptEin ? 14 : 18, Math.min(kipptEin ? 86 : 82, y));
                bahn = "kette";
            } else if (q.rolle === "DM") {
                y = 50 + abstand * 0.8 + lehnen * 0.5;
            } else if (q.group === "mid") {
                const breite = Math.abs(abstand) < 3 ? 0 : Math.sign(abstand) * Math.max(14, Math.abs(abstand) * 1.15);
                y = 50 + breite + lehnen;
                if (!aufbau) t = Math.min(1, t + 0.05);
                bahn = breite ? "halbraum" : "zentrum";
            } else {
                y = 50 + abstand * 0.9 + lehnen * 0.6;
            }

            // Die Rolle hat das letzte Wort
            if (r.kippt && aufbau) {
                y = 50; t = -0.02; bahn = "kette";
            } else if (!(r.nurDreier && q.group !== "def")) {
                if (typeof r.breite === "number") {
                    y = 50 + seite * r.breite + (r.bahn === "kette" ? 0 : lehnen * 0.5);
                    if (r.bahn === "kette" && aufbau) y = 50 + seite * (r.breite + 2);
                }
                if (typeof r.hoehe === "number" || typeof r.aufbauHoehe === "number") t = hoeheAus(q, t);
                if (r.bahn) bahn = r.bahn;
                // Der Ueberlappende geht nur im letzten Drittel mit - auf seiner Seite
                if (r.id === "iv_ueberlappend" && (aufbau || seite !== ballSeite || b < 0.55)) {
                    t = 0.03; bahn = "kette"; y = 50 + seite * 26;
                }
                // Die freie Rolle sucht den Ball
                if (r.frei) { y = 50 + (ball.y - 50) * 0.55 + abstand * 0.3; t = aufbau ? 0.6 : 0.82; }
            }
            rollen.set(q.id, { y, tiefe: t, bahn });
        });

        // Die Kette hat Abstaende: Stehen Aussen- und Innenverteidiger auf
        // demselben Fleck (etwa ein zurueckhaltender Schienenspieler neben
        // einer Dreierkette), verteilt sie sich gleichmaessig ueber die Breite
        const kette = feld.map(q => rollen.get(q.id)).filter(e => e && e.bahn === "kette").sort((a, c) => a.y - c.y);
        if (kette.length > 1 && kette.some((e, i) => i > 0 && e.y - kette[i - 1].y < 10)) {
            const spanne = Math.min(84, Math.max(kette[kette.length - 1].y - kette[0].y, (kette.length - 1) * 13));
            const mitte = (kette[0].y + kette[kette.length - 1].y) / 2;
            const start = Math.max(8, Math.min(92 - spanne, mitte - spanne / 2));
            kette.forEach((e, i) => { e.y = start + i * spanne / (kette.length - 1); });
        }

        // Bahnregel: Wer denselben Raum will, staffelt sich dahinter - statt
        // dass drei Spieler auf einem Fleck stehen
        const T = _dirTaktik();
        if (T) {
            const eintraege = feld.map(q => rollen.get(q.id)).filter(Boolean);
            const punkte = eintraege.map(e => ({ q: e.y, t: e.tiefe, fest: e.bahn === "kette" }));
            T.entzerre(punkte, 8, 0.14);
            eintraege.forEach((e, i) => { e.tiefe = punkte[i].t; });
        }

        this._planMitBall[team] = { uhr, rollen };
        return rollen;
    }

    /**
     * Die Form ohne Ball: eng, zur Ballseite verschoben, die Kette auf einer
     * Linie.
     *
     * Gemessen stand die Elf einmal einundsiebzig Einheiten breit, mit wie ohne
     * Ball gleich - wie ein Seestern. Ohne Ball schiebt sie als kompakter Block
     * zur Ballseite; wer weit weg ist, rückt stärker ein.
     */
    formOhneBall(p, gesehen, dir) {
        const w = this.taktik(p.team).w;
        const r = p.rolleGegen || {};
        // Die Form gegen den Ball: eigene Formation oder die gewaehlte
        // (4-4-2, 4-1-4-1, 5-4-1 ...), in die jeder Spieler zurueckfaellt
        const basisY = p.formGegen ? this.querAusForm(p.formGegen.x, p.team) : p.baseY;
        const breitRolle = p.formGegen
            ? BREITE_ROLLEN.includes(this.normRolle(p.formGegen.pos))
            : BREITE_ROLLEN.includes(p.rolle);
        const ballAbstand = Math.min(1, Math.abs(gesehen.y - basisY) / 45);
        // Die Aussenspieler bleiben auch im Block etwas breiter: Nach dem
        // Ballgewinn ist ihr Weg an die Linie sonst zu weit
        let kompakt = (breitRolle ? 0.55 : 0.42) - ballAbstand * 0.05 + (w.kompakt || 0);
        // Pressingfalle: Wer nach aussen lenkt, macht das Zentrum zu und
        // schiebt mit der ganzen Elf auf die Seite; wer nach innen lenkt,
        // steht eng und wartet in der Mitte.
        let schieben = 0.5;
        if (w.falle === "aussen") { schieben = 0.62; kompakt -= 0.03; }
        else if (w.falle === "innen") { schieben = 0.4; kompakt -= 0.07; }
        if (r.schmal) kompakt -= r.schmal / 45;
        // Flanken zulassen: Die Aussenverteidiger ruecken ein, der Strafraum ist dicht
        if ((w.flankenVerhindern || 0) < 0 && p.group === "def" && breitRolle) kompakt -= 0.1;
        if ((w.flankenVerhindern || 0) > 0 && p.group === "def" && breitRolle) kompakt += 0.06;
        const blockY = 50 + (gesehen.y - 50) * schieben;
        let y = blockY + (basisY - 50) * kompakt;
        // Der seitlich absichernde Sechser doppelt auf der Ballseite
        if (r.seitlich) y += (gesehen.y - y) * 0.45;

        const ballProgress = dir > 0 ? (gesehen.x - this.ownGoalX(p.team)) / 92 : (this.ownGoalX(p.team) - gesehen.x) / 92;
        const formTiefe = p.formGegen ? p.formGegen.tiefe : null;
        let x = this.hoeheImVerbund(p, ballProgress, false, formTiefe);
        if (r.tiefer) x -= dir * r.tiefer;
        if (r.hoeher) x += dir * r.hoeher;

        // Der Konterspieler bleibt vorn: die Anspielstation fuer den Ballgewinn
        if (r.konter) {
            const vorn = Math.min(0.68, 0.57 + Math.max(0, ballProgress - 0.45) * 0.35);
            x = this.ownGoalX(p.team) + dir * 92 * vorn;
            const seite = Math.sign(basisY - 50) || -Math.sign(gesehen.y - 50) || 1;
            if (r.konter === "aussen") y = 50 + seite * 30;
            else if (r.konter === "halbraum") y = 50 + seite * 18;
            else y = 50 + (gesehen.y - 50) * 0.25;
            return { x, y };
        }

        // Der abkippende Sechser laesst sich im tiefen Block in die Kette fallen
        if (r.kippt && ballProgress < 0.36) {
            x = this.hoeheImVerbund(p, ballProgress, false, 0);
            y = 50 + (gesehen.y - 50) * 0.3;
            return { x, y };
        }

        // Die Form zieht sich zum Ball zusammen, statt als Ganzes parallel zu
        // verschieben: Wer nah am Ball steht, rueckt heran, wer weit weg ist,
        // bleibt. So bewegt sich jeder anders, wenn der Ball wandert.
        const zumBallX = gesehen.x - x;
        const zumBallY = gesehen.y - y;
        const zug = 0.32 * Math.exp(-Math.hypot(zumBallX, zumBallY) / 20);
        x += zumBallX * zug * 0.6;
        y += zumBallY * zug;

        // Die Kette bleibt eine Linie: Der Zug zum Ball verschiebt sie nur
        // seitlich, nicht aus der Reihe
        if (p.group === "def" && !(p.formGegen && p.formGegen.tiefe > 0.2)) {
            x = this.hoeheImVerbund(p, ballProgress, false, formTiefe) - (r.tiefer ? dir * r.tiefer : 0);
        }
        return { x, y };
    }

    /**
     * Wo ein Spieler in der Laenge steht - als Teil einer Mannschaft, die als
     * Einheit mit dem Ball wandert.
     *
     * Bisher rueckte jeder Mannschaftsteil fuer sich auf: die Spitzen weit,
     * die Kette kaum. Gemessen stand die Abwehr der angreifenden Elf bei Ball
     * an der Mittellinie noch bei achtzehn Prozent der Feldlaenge, das
     * Mittelfeld bei siebenunddreissig - zwoelf Prozent hinter dem Ball. Im
     * letzten Drittel war die Elf ueber vierzig Prozent des Feldes gestreckt.
     * Das sah aus wie ein Angriff mit zwei Stuermern, waehrend der Rest
     * zuschaut.
     *
     * Im Fussball verschiebt die ganze Mannschaft: Liegt der Ball im letzten
     * Drittel, steht die Kette an der Mittellinie und das Mittelfeld direkt
     * hinter dem Ball. Jede Mannschaft hat dazu ein Fenster - von der Kette
     * bis zur Spitze -, das mit dem Ball wandert; jeder Spieler steht darin
     * so tief, wie ihn seine Formation vorsieht. Ohne Ball ist das Fenster
     * kuerzer und tiefer. Abwehrhoehe und Mentalitaet verschieben es.
     *
     * Rueckgabe: x auf dem Feld.
     */
    hoeheImVerbund(p, ballProgress, mitBall, tiefeVorgabe = null) {
        const dir = this.attackDir(p.team);
        const torX = this.ownGoalX(p.team);
        const schwerpunkt = this._schwerpunkt?.[p.team];
        const b = Math.max(0, Math.min(1, typeof schwerpunkt === "number" ? schwerpunkt : ballProgress));
        const taktik = (p.team === "home" ? this.match.homeClub?.tactics : this.match.awayClub?.tactics) || {};

        const linie = taktik.defensiveLine === "high" ? 1 : (taktik.defensiveLine === "deep" ? -1 : 0);
        const mentalitaet = { very_offensive: 0.04, offensive: 0.02, defensive: -0.03, very_defensive: -0.06 }[taktik.mentality] || 0;

        let hinten, laenge;
        if (mitBall) {
            // Je laenger die Mannschaft den Ball hat, desto mutiger rueckt sie nach
            const kette = Math.min(1, (this.possessionChain || 0) / 6) * 0.03;
            hinten = 0.10 + 0.55 * b + linie * 0.05 + mentalitaet + kette;
            hinten = Math.max(0.12, Math.min(0.62, hinten));
            // Im Aufbau zieht die Elf das Feld lang, im letzten Drittel steht sie eng
            laenge = 0.47 - 0.14 * b;
        } else {
            const wk = this.taktik(p.team).w;
            const falle = wk.abseitsfalle ? 0.025 : 0;
            // Verhalten der Abwehrlinie: Herausruecken schiebt die Kette nach,
            // sobald der Ball weiter weg ist; Fallenlassen gibt dem Gegner
            // Raum vor der Kette, aber keinen dahinter.
            const verhalten = wk.linienVerhalten || 0;
            hinten = 0.04 + 0.42 * b + linie * 0.07 + mentalitaet * 0.5 + falle
                + verhalten * (b > 0.45 ? 0.03 : 0.015);
            // Die Kette steht hinter dem Ball, nicht auf seiner Hoehe
            hinten = Math.min(hinten, b - (verhalten < 0 ? 0.1 : 0.06));
            hinten = Math.max(0.07, Math.min(0.5, hinten));
            laenge = 0.30;
        }
        const vorne = Math.min(0.9, hinten + laenge);

        // Mit Ball bestimmt das Positionsspiel, wie weit vorn einer steht
        const tiefe = typeof tiefeVorgabe === "number" ? tiefeVorgabe : this.formationsTiefe(p);

        return torX + dir * 92 * (hinten + tiefe * (vorne - hinten));
    }

    /**
     * Wie weit vorn ein Spieler in seiner Formation steht: null fuer die
     * hinterste Kette, eins fuer die vorderste Spitze.
     */
    formationsTiefe(p) {
        if (!this._tiefenRahmen) this._tiefenRahmen = {};
        const prog = q => (q.baseX - this.ownGoalX(q.team)) * this.attackDir(q.team);
        let rahmen = this._tiefenRahmen[p.team];
        if (!rahmen) {
            const werte = this.teamPlayers(p.team).filter(q => q.pos !== "TW").map(prog);
            rahmen = werte.length
                ? { min: Math.min(...werte), max: Math.max(...werte) }
                : { min: 0, max: 1 };
            this._tiefenRahmen[p.team] = rahmen;
        }
        const spanne = rahmen.max - rahmen.min;
        if (spanne < 1) return 0.5;
        return Math.max(0, Math.min(1, (prog(p) - rahmen.min) / spanne));
    }

    /**
     * Deckt dieser Spieler einen Gegner? In der Raumdeckung tun das Mittelfeld
     * und Angriff in ihrer Zone, die Kette haelt die Linie. Mannorientiert
     * nimmt auch die Kette den Gegner auf, der in ihre Zone kommt, in
     * Manndeckung hat jeder seinen Mann.
     */
    deckt(p, w, r) {
        if (w.deckung === "mann") return true;
        if (p.group !== "def") return true;
        return w.deckung === "mannorientiert" || !!r.verfolgt || !!r.heraus;
    }

    /** Wohin einer geht, der deckt - je nach Art der Deckung */
    deckungsZiel(p, tx, ty, dir, w, r, ball) {
        if (w.deckung === "mann" && !this.deadBall) {
            // Manndeckung: Er klebt torseitig an seinem Gegenspieler, wohin der
            // auch laeuft. Nur die Kette bleibt hinter dem Ball.
            const zielId = this.mannZuordnung(p.team).get(p.id);
            const mann = zielId !== undefined ? this.getPlayer2D(zielId) : null;
            if (mann) {
                let x = mann.x - dir * 2.2;
                const y = mann.y + (50 - mann.y) * 0.06;
                if (p.group === "def" && (x - ball.x) * dir > -1) x = ball.x - dir * 1;
                return { x, y, urgency: 1.3 };
            }
        }
        const mark = this.findMarkingTarget(p);
        if (!mark) return null;
        // Raumdeckung: Zugriff nur, wenn der Gegner in die Zone kommt.
        // Mannorientiert und bei verfolgenden oder pressenden Rollen reicht
        // die Zone weiter, bei abschirmenden weniger.
        const mannorientiert = w.deckung === "mannorientiert";
        const reichweite = 20 * (mannorientiert ? 1.7 : 1) * (r.zone || 1) * (r.verfolgt ? 1.5 : 1);
        const ausDerZone = Math.hypot(mark.x - tx, mark.y - ty);
        // Mannorientiert laesst er ihn in seiner Zone nicht mehr los: voller
        // Zugriff, bis der Gegner weit aus der Zone heraus ist
        const zugriff = mannorientiert
            ? Math.max(0, Math.min(1, 1.4 - ausDerZone / reichweite))
            : Math.max(0, 1 - ausDerZone / reichweite);
        // Mannorientiert steht er enger an seinem Gegenspieler
        const eng = mannorientiert ? 1.8 : (p.group === "def" ? 2.5 : 3.5);
        return {
            x: tx + (mark.x - dir * eng - tx) * zugriff,
            y: ty + (mark.y + (p.seed % 1) * 2 - 1 - ty) * zugriff,
            urgency: zugriff > 0.45 ? (r.verfolgt ? 1.35 : 1.2) : 0
        };
    }

    findMarkingTarget(player) {
        // Wer vorn verteidigt, laeuft an, was vor ihm ist - er faellt nicht
        // zurueck, um einen Mittelfeldspieler hinter sich zu decken. Wer
        // zurueckarbeitet, verfolgt die Laeufer auf dem Weg zum eigenen Tor.
        const dir = this.attackDir(player.team);
        const vorn = player.formGegen ? player.formGegen.tiefe >= 0.8 : player.group === "att";
        const verfolgt = !!player.rolleGegen?.verfolgt;
        const opponents = this.teamPlayers(player.team === "home" ? "away" : "home")
            .filter(o => o.pos !== "TW" && o.id !== this.carrierId)
            .filter(o => {
                const vor = (o.x - player.x) * dir;
                if (verfolgt) return vor <= 4;
                if (vorn) return vor >= -4;
                return true;
            });

        // Den Gegenspieler, den er schon aufgenommen hat, gibt er nur ab, wenn
        // ein anderer deutlich naeher kommt - sonst pendelt er zwischen zwei
        // Gegnern hin und her.
        let best = null;
        let bestWert = 26;
        opponents.forEach(o => {
            const d = Math.hypot(o.x - player.x, o.y - player.y);
            if (d >= 26) return;
            const wert = d - (o.id === player.markiertId ? 5 : 0);
            if (wert < bestWert) { bestWert = wert; best = o; }
        });
        player.markiertId = best ? best.id : null;
        return best;
    }

    computeSetPieceTarget(p, info) {
        const dir = this.attackDir(info.team);
        // Beim Anstoss ist vor dem Pfiff niemand Ballfuehrender - der Schuetze
        // steht trotzdem fest. Vorher blieb er deshalb auf seiner Position
        // stehen, fuenfzehn Meter vom Ball, und das Spiel wurde ohne ihn
        // angepfiffen.
        const isTaker = p.id === this.carrierId
            || (info.kind === "kickoff" && p.id === this.kickoffTakerId);

        // Anstoß: Beide Mannschaften stehen in der eigenen Hälfte, und der
        // Mittelkreis gehört allein der anstoßenden Mannschaft.
        if (info.kind === "kickoff") {
            const pDir = this.attackDir(p.team);

            if (isTaker) {
                return { x: 50 - pDir * 1.4, y: 50, urgency: 1.7 };
            }
            if (p.id === this.kickoffPartnerId) {
                return { x: 50 - pDir * 4.5, y: 53.5, urgency: 1.6 };
            }
            if (p.pos === "TW") {
                const goalX = this.ownGoalX(p.team);
                return { x: goalX + pDir * 3, y: 50, urgency: 1.1 };
            }

            // Strikt in der eigenen Hälfte
            let x = pDir > 0 ? Math.min(p.baseX, 46) : Math.max(p.baseX, 54);
            const y = p.baseY;

            // Der Mittelkreis misst 9,15 m: auf dem 105x68-Feld sind das rund
            // 8,7 Einheiten in der Länge und 13,5 in der Breite. Wer nicht
            // anstößt, muss draußen bleiben.
            if (p.team !== info.team) {
                const rx = (x - 50) / 8.7;
                const ry = (y - 50) / 13.5;
                const r = Math.hypot(rx, ry);
                if (r < 1) {
                    // Nach hinten aus dem Kreis heraus, nicht zur Seite
                    x = 50 - pDir * (8.7 * Math.sqrt(Math.max(0, 1 - ry * ry)) + 1.5);
                }
            }

            return { x, y, urgency: 1.3 };
        }

        if (isTaker) {
            // Wer den Ball holt, geht nicht spazieren. Solange er weit weg
            // ist, läuft er - sonst liegt der Ball allein da und das Spiel
            // wartet auf ihn.
            const weg = Math.hypot(p.x - info.x, p.y - info.y);
            return { x: info.x - dir * 1.5, y: info.y, urgency: weg > 6 ? 2.8 : 1.7 };
        }

        if (p.pos === "TW") return this.torwartBeimStandard(p, info) || this.computeKeeperTarget(p, this.match.ball);

        const attacking = p.team === info.team;

        if (info.kind === "corner") {
            return this.eckenPlatz(p, info);
        }

        if (info.kind === "goalkick") {
            if (attacking) {
                return { x: p.baseX + dir * 4, y: p.baseY + (p.baseY < 50 ? -5 : 5), urgency: 1.1 };
            }
            return { x: p.baseX - dir * 6, y: p.baseY, urgency: 1.1 };
        }

        if (info.kind === "freekick") {
            const platz = (this.setPieceWall || []).indexOf(p.id);
            if (platz >= 0) {
                const spot = this.wallSpot(info.team, info.x, info.y);
                return {
                    x: spot.x + spot.nx * (platz - 1) * 2.3,
                    y: spot.y + spot.ny * (platz - 1) * 2.3,
                    urgency: 1.6
                };
            }

            const spot = this.wallSpot(info.team, info.x, info.y);
            if (spot.entfernung < 34) {
                // Beide Mannschaften drängen in den Strafraum
                const torX = this.ownGoalX(info.team === "home" ? "away" : "home");
                const boxX = torX - dir * (attacking ? 10 : 6);
                return {
                    x: boxX + ((p.seed % 3) - 1) * 3,
                    y: 40 + (p.seed % 5) * 5,
                    urgency: 1.35
                };
            }

            // Weiter Freistoß: die Angreifer schieben auf, die Abwehr hält die Linie
            return {
                x: attacking ? p.baseX + dir * 8 : p.baseX - dir * 3,
                y: p.baseY + (info.y - 50) * 0.25,
                urgency: 1.15
            };
        }

        if (info.kind === "penalty") {
            // Alle außer Schütze und Torwart müssen aus dem Strafraum
            const torX = this.ownGoalX(info.team === "home" ? "away" : "home");
            const grenze = torX - dir * (19 + (p.seed % 3) * 2.5);
            return {
                x: grenze,
                y: 50 + (((p.seed * 7) % 9) - 4) * 6,
                urgency: 1.25
            };
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

    /**
     * Der Torwart bei einem ruhenden Ball.
     *
     * Vorher galt fuer ihn dieselbe Regel wie im laufenden Spiel: Er rueckte
     * mit der Gefahr heraus - und stand bei einer Ecke irgendwo im Strafraum.
     * Bei Ecke, Elfmeter und Freistoss in Schussweite gehoert er aber auf die
     * Linie, bei der Ecke leicht zum kurzen Pfosten. Bei eigener Ecke bleibt
     * er vor dem eigenen Strafraum.
     */
    torwartBeimStandard(p, info) {
        const torX = this.ownGoalX(p.team);
        const eigenDir = this.attackDir(p.team);
        const verteidigt = p.team !== info.team;

        if (info.kind === "corner") {
            if (!verteidigt) return { x: torX + eigenDir * 17, y: 50, urgency: 1.1 };
            const nah = info.y < 50 ? -1 : 1;
            return { x: torX + eigenDir * 0.9, y: 50 + nah * 2.2, urgency: 1.6 };
        }
        if (info.kind === "penalty") {
            if (!verteidigt) return { x: torX + eigenDir * 12, y: 50, urgency: 1.1 };
            return { x: torX + eigenDir * 0.5, y: 50, urgency: 1.6 };
        }
        if (info.kind === "freekick" && verteidigt) {
            const spot = this.wallSpot(info.team, info.x, info.y);
            if (spot.entfernung < 34) {
                // Auf der Linie, einen Schritt zur Seite, die die Mauer nicht deckt
                return { x: torX + eigenDir * 1.5, y: 50 - (info.y - 50) * 0.08, urgency: 1.5 };
            }
        }
        return null;
    }

    /**
     * Die Aufstellung bei einer Ecke.
     *
     * Vorher rechnete die Regie die Plaetze von der Eckfahne aus - mit dem
     * falschen Vorzeichen: Alle Spieler wollten hinter die Torlinie und
     * standen am Rand geklemmt irgendwo. Jetzt wird vom Tor aus gerechnet,
     * wie ein Trainer eine Ecke einstudiert:
     *
     * - Angreifer an den kurzen und langen Pfosten, in den Fuenfer, auf Hoehe
     *   des Elfmeterpunkts und in den Rueckraum; eine kurze Anspielstation.
     *   Die Aussenverteidiger und ein Sechser sichern gegen den Konter ab.
     * - Verteidiger: einer am kurzen Pfosten, drei in Raumdeckung auf der
     *   Linie des Fuenfers, der Rest in Manndeckung torseitig am Gegenspieler,
     *   einer am Strafraumrand. Der Stuermer bleibt vorn fuer den Konter.
     *
     * Die Masse sind Einheiten des Modells: Laengs misst eine Einheit rund
     * 1,14 m, quer 0,68 m. Der Fuenfer ist 4,8 Einheiten tief, der
     * Elfmeterpunkt liegt bei 9,6, der Strafraumrand bei 14,5.
     */
    eckenPlatz(p, info) {
        const plan = this.eckenPlan(info);
        const platz = plan.get(p.id);
        if (platz) return { x: platz.x, y: platz.y, urgency: 1.4 };
        return { x: p.baseX, y: p.baseY, urgency: 1.1 };
    }

    eckenPlan(info) {
        if (this._eckenPlan && this._eckenPlan.info === info) return this._eckenPlan.plan;

        const dir = this.attackDir(info.team);
        const gegner = info.team === "home" ? "away" : "home";
        const torX = this.ownGoalX(gegner);
        const nah = info.y < 50 ? -1 : 1;
        const punkt = (tiefe, quer) => ({
            x: torX - dir * tiefe,
            y: Math.max(3, Math.min(97, 50 + quer))
        });
        const plan = new Map();

        // --- Angreifer
        const angreifer = this.teamPlayers(info.team)
            .filter(q => q.pos !== "TW" && q.id !== this.carrierId);
        const istAussenVert = (q) => q.fam === "AV" || q.fam === "SCH"
            || (!q.fam && ["LV", "RV"].includes(this.normRolle(q.pos)));
        const absicherung = [];
        angreifer.filter(istAussenVert).slice(0, 2).forEach(q => absicherung.push(q));
        if (absicherung.length < 2) {
            const sechser = angreifer
                .filter(q => !absicherung.includes(q) && q.group === "mid")
                .sort((a, b) => (a.attack || 0) - (b.attack || 0))[0];
            if (sechser) absicherung.push(sechser);
        }
        const restPlaetze = [punkt(47, -15), punkt(47, 15), punkt(40, 0)];
        absicherung.forEach((q, i) => plan.set(q.id, restPlaetze[i]));

        // Kopfballstarke zuerst in die Mitte: Stuermer und Innenverteidiger
        const rang = (q) => (q.group === "att" ? 0 : (q.group === "def" ? 1 : 2));
        const boxSpieler = angreifer
            .filter(q => !absicherung.includes(q))
            .sort((a, b) => rang(a) - rang(b) || (a.seed || 0) - (b.seed || 0));
        const angriffsPlaetze = [
            punkt(5.0, nah * 0.5),    // Fuenfer, Mitte
            punkt(9.6, nah * 3),      // Elfmeterpunkt
            punkt(3.6, nah * 6.5),    // kurzer Pfosten
            punkt(5.6, -nah * 8.5),   // langer Pfosten
            punkt(10.8, -nah * 7),    // Elfmeterpunkt, lang
            punkt(15.5, nah * 3),     // Rueckraum
            punkt(4.5, nah * 38),     // kurze Anspielstation
            punkt(14.5, -nah * 16)    // Strafraumrand, lang
        ];
        const imStrafraum = [];
        boxSpieler.forEach((q, i) => {
            const pl = angriffsPlaetze[i] || punkt(18, ((i % 3) - 1) * 12);
            plan.set(q.id, pl);
            if (i < 6) imStrafraum.push(pl);
        });

        // --- Verteidiger
        const verteidiger = this.teamPlayers(gegner).filter(q => q.pos !== "TW");
        const vorn = verteidiger
            .filter(q => q.group === "att")
            .sort((a, b) => (b.attack || 0) - (a.attack || 0))[0];
        const hinten = verteidiger.filter(q => q !== vorn)
            .sort((a, b) => rang(b) - rang(a) || (a.seed || 0) - (b.seed || 0));
        if (vorn) plan.set(vorn.id, punkt(42, -nah * 6));
        const raum = [
            punkt(1.3, nah * 4.4),    // kurzer Pfosten
            punkt(4.8, nah * 3.5),    // Fuenferlinie kurz
            punkt(4.8, -nah * 1),     // Fuenferlinie Mitte
            punkt(4.8, -nah * 5.5)    // Fuenferlinie lang
        ];
        // Manndecker stehen torseitig und einen Schritt zur Mitte hin
        const mann = imStrafraum.map(pl => ({
            x: pl.x + dir * 1.1,
            y: pl.y + (pl.y < 50 ? 1.2 : -1.2)
        }));
        const verteidigerPlaetze = [...raum, ...mann, punkt(15, 0), punkt(12, -nah * 14)];
        hinten.forEach((q, i) => plan.set(q.id, verteidigerPlaetze[i] || punkt(16, ((i % 3) - 1) * 10)));

        this._eckenPlan = { info, plan };
        return plan;
    }

    computeKeeperTarget(p, ball) {
        const goalX = this.ownGoalX(p.team);
        const dir = this.attackDir(p.team);

        // Hat der Torwart selbst den Ball, schiebt er ein Stück heraus und
        // sucht die Anspielstation, statt auf der Linie zu kleben.
        if (this.carrierId === p.id && this.mode === "ambient") {
            return {
                x: goalX + dir * 8,
                y: Math.max(32, Math.min(68, ball.y)),
                urgency: 1.15
            };
        }

        const distToGoal = Math.abs(ball.x - goalX);
        const threat = Math.max(0, 1 - distToGoal / 45);
        let vor = 2.5 + threat * 6;

        // Die Rolle des Torwarts: Der mitspielende rueckt im eigenen Aufbau
        // heraus, der Libero steht hinter einer hohen Kette weit vor dem Tor,
        // der Linientorwart bleibt auf der Linie.
        const eigenerBall = p.team === this.possessionTeam;
        const mitR = p.rolleMit || {}, gegenR = p.rolleGegen || {};
        if (eigenerBall && mitR.aufbauVor) {
            const aufbau = Math.max(0, 1 - distToGoal / 42);
            vor += mitR.aufbauVor * (mitR.aufbauVor > 0 ? aufbau : 1);
        } else if (!eigenerBall && gegenR.vor) {
            const weit = Math.max(0, Math.min(1, (distToGoal - 25) / 40));
            vor += gegenR.vor * (gegenR.vor > 0 ? weit : 1);
        }

        return {
            x: goalX + dir * Math.max(1, vor),
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