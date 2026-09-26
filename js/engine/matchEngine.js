/**
 * MatchEngine - Realistisches FM-Simulationsmodell & synchrone 2D-Timeline-Match-Engine
 */

const _Random = (typeof Random !== 'undefined' && Random)
    ? Random
    : ((typeof require !== 'undefined') ? require('../core/random.js').Random : {
        int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        float: (min, max) => Math.random() * (max - min) + min,
        choice: arr => (Array.isArray(arr) && arr.length > 0) ? arr[Math.floor(Math.random() * arr.length)] : null,
        chance: prob => Math.random() < (prob > 1 ? prob / 100 : prob),
        clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
        gaussian: (mean = 0, stdev = 1) => {
            const u1 = 1 - Math.random();
            const u2 = 1 - Math.random();
            return mean + stdev * (Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2));
        }
    });

const _LiveMatchDirector = (typeof LiveMatchDirector !== 'undefined' && LiveMatchDirector)
    ? LiveMatchDirector
    : ((typeof window !== 'undefined' && window.LiveMatchDirector)
        ? window.LiveMatchDirector
        : ((typeof require !== 'undefined') ? require('./liveMatchDirector.js').LiveMatchDirector : null));

const _PositionEngine = (typeof PositionEngine !== 'undefined' && PositionEngine)
    ? PositionEngine
    : ((typeof window !== 'undefined' && window.PositionEngine)
        ? window.PositionEngine
        : ((typeof require !== 'undefined') ? require('./positionEngine.js').PositionEngine : null));

// Rollen, Formen und Anweisungen der Taktik (nach FM26). Erst bei Bedarf
// aufgeloest - im Browser laden die Skripte in beliebiger Reihenfolge.
const _mTaktik = () => (typeof TacticsEngine !== 'undefined' && TacticsEngine)
    ? TacticsEngine
    : ((typeof window !== 'undefined' && window.TacticsEngine)
        ? window.TacticsEngine
        : ((typeof require !== 'undefined')
            ? (() => { try { return require('./tacticsEngine.js').TacticsEngine; } catch (e) { return null; } })()
            : null));

/**
 * Welche Rollen eine Elf mit Ball spielt - gezaehlt, damit die Simulation
 * weiss, ob vorn ein Zielspieler steht oder eine falsche Neun.
 */
const _rollenZaehlung = (club) => {
    const T = _mTaktik();
    const cfgs = (typeof FORMATION_CONFIGS !== 'undefined' && FORMATION_CONFIGS)
        ? FORMATION_CONFIGS
        : ((typeof window !== 'undefined' && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS
            : (typeof require !== 'undefined' ? (() => { try { return require('./gameState.js').FORMATION_CONFIGS; } catch (e) { return {}; } })() : {}));
    const zaehlung = {};
    if (!T || !club) return zaehlung;
    const positions = (cfgs[club.formation] || cfgs["4-4-2"] || {}).positions || [];
    if (!positions.length) return zaehlung;
    T.rollenDerElf(club, positions).forEach(r => { zaehlung[r.mit] = (zaehlung[r.mit] || 0) + 1; });
    return zaehlung;
};

// Der Trainerstab entscheidet, wie gut der Co-Trainer ist. Aufgeloest wird
// erst bei Bedarf - die Skripte laden im Browser in beliebiger Reihenfolge.
const _stabEngine = () => (typeof CoachingStaffEngine !== 'undefined' && CoachingStaffEngine)
    ? CoachingStaffEngine
    : ((typeof window !== 'undefined' && window.CoachingStaffEngine)
        ? window.CoachingStaffEngine
        : ((typeof require !== 'undefined')
            ? (() => { try { return require('./coachingStaffEngine.js').CoachingStaffEngine; } catch (e) { return null; } })()
            : null));

// Zentrale Kalibrierungs- und Tuning-Parameter
const MATCH_TUNING = {
    baseGoalChance: {
        // Kalibriert auf rund 3.0 Tore pro Spiel - der Schnitt der letzten
        // Bundesligajahre - mit den Spielstilen der KI-Vereine: Pressing,
        // hohe Linie und schnelles Umschalten oeffnen die Spiele. Bei 2.7
        // Toren endeten zu viele Partien unentschieden: Der Meister kam auf
        // achtzehn Siege und neun Remis, während es in
        // Wirklichkeit zweiundzwanzig Siege und sechs Remis sind. Wer die
        // besseren Chancen hat, muss sie auch zu Punkten machen können.
        through_ball: 0.143,
        cross: 0.097,
        dribble: 0.085,
        corner: 0.067,
        penalty: 0.77,
        // Direkter Freistoß: selten ein Tor, und wenn, dann vom Spezialisten
        freekick: 0.055
    },
    skillInfluence: 340,
    cornerShotChance: 0.28,
    minGoalChance: 0.03,
    maxGoalChance: 0.40,

    // Wie stark der Kaderunterschied darüber entscheidet, wer eine Szene hat.
    //
    // Vorher stand hier ein Verhältnis zweier fast gleich großer Zahlen:
    // Mittelfeld geteilt durch die Summe beider Mittelfelder. Zwischen dem
    // besten und dem schwächsten Bundesligakader liegen rund sieben Punkte -
    // daraus wurden 52 Prozent der Szenen. Ein Spitzenteam kam also kaum
    // häufiger vor das Tor als ein Abstiegskandidat, und die Tabelle war am
    // Saisonende auf zehn Punkte zusammengeschnurrt.
    //
    // Jetzt zählt der Abstand selbst, gemessen am Niveau der Liga. Der
    // Heimvorteil steckt bewusst in einer eigenen Zahl: Er ist überall
    // gleich groß und darf nicht mitwachsen, wenn eine Mannschaft besser wird.
    sceneShare: 1.15,
    homeSceneEdge: 0.034,

    // Raten für Nebenereignisse
    foulRate: 0.28,
    yellowCardRate: 0.36,       // Anteil Fouls, die Gelb geben (~3.5-4.5 Gelbe pro Spiel)
    redCardRate: 0.009,         // Direkte Rote Karte (~0.05 pro Spiel)
    penaltyRate: 0.032,         // Elfmeterquote pro Foul-Szene (~0.25 pro Spiel)
    // Verletzungen je Team und Spiel. Vorher 0.06 - das sind zwei Verletzungen
    // pro Verein und Saison, praktisch alles andere kam aus dem Training. In
    // Wirklichkeit passiert der groessere Teil im Spiel: im Zweikampf, im
    // Sprint, bei der Landung. 0.30 ergibt rund zehn Spielverletzungen je
    // Verein und Saison und damit etwa ein Drittel aller Ausfaelle.
    injuryRatePerTeam: 0.30,

    // Wer einen Mann weniger hat, kommt seltener vor das Tor. Vorher war ein
    // Platzverweis nur eine Zeile im Ticker: Der Spieler tauchte in keiner
    // Szene mehr auf, die Verteilung der Szenen blieb aber dieselbe - zehn
    // spielten so stark wie elf. Sieben Prozentpunkte je fehlendem Spieler
    // entsprechen grob dem, was Unterzahl im echten Fussball kostet.
    unterzahlSzenen: 0.07,

    // Wie oft aus einem Foul in Schussweite ein direkter Freistoß wird. Vorher
    // wurde jeder Freistoß in den Strafraum geflankt - einen Schützen, der
    // den Ball über die Mauer zirkelt, gab es nicht.
    direkterFreistoss: 0.3,

    // Zurufe von der Seitenlinie wirken zehn Minuten lang
    zurufDauer: 10,
    // ... danach braucht die Mannschaft fünf Minuten, bevor der nächste greift
    zurufPause: 5
};

/**
 * Was ein Zuruf von der Seitenlinie bewirkt.
 *
 * - szenen: Verschiebung des Szenenanteils zugunsten der rufenden Mannschaft
 * - angriff / gegnerAngriff: Stärke der eigenen Abschlüsse und der des Gegners
 * - gelb: Faktor auf die Kartenquote bei eigenen Fouls
 * - ruhe: Anteil der Szenen, die ausfallen, weil das Spiel verschleppt wird
 * - extraSzenen: zusätzliche Szenen im Fenster, weil die Mannschaft Tempo macht
 */
const ZURUFE = {
    druck: { titel: "Mehr Druck!", kurz: "Druck!", icon: "🔥", szenen: 0.1, angriff: 3, gegnerAngriff: 4, gelb: 1.15, ruhe: 0, extraSzenen: 0.3,
        text: "Die Mannschaft schiebt nach vorne - mehr Chancen, aber hinten wird es offener." },
    ruhe: { titel: "Ruhe bewahren", kurz: "Ruhe", icon: "🧊", szenen: 0, angriff: -1, gegnerAngriff: -4, gelb: 0.5, ruhe: 0, extraSzenen: 0,
        text: "Weniger Hektik: seltener Karten, der Gegner findet schwerer Lücken." },
    zeit: { titel: "Zeit schinden", kurz: "Zeit", icon: "⏳", szenen: -0.03, angriff: -1, gegnerAngriff: 0, gelb: 1.5, ruhe: 0.35, extraSzenen: 0,
        text: "Das Spiel wird verschleppt - weniger passiert, aber der Schiedsrichter sieht genau hin." }
};

const INJURY_CATALOG = [
    { name: "Muskelverhärtung", weeks: 1, severity: "leicht" },
    { name: "Knöchelstauchung", weeks: 2, severity: "leicht" },
    { name: "Muskelfaserriss", weeks: 3, severity: "mittel" },
    { name: "Bänderdehnung", weeks: 4, severity: "mittel" },
    { name: "Meniskusschaden", weeks: 6, severity: "schwer" },
    { name: "Kreuzbandanriss", weeks: 10, severity: "schwer" }
];

const MATCH_COMMENTARY = {
    through_ball: [
        "{minute}' - 🎯 Genialer Steilpass von {passer} in die Schnittstelle auf {shooter}!",
        "{minute}' - ⚡ {passer} hebelt mit einem feinen Steilpass die Abwehr aus, {shooter} läuft frei aufs Tor zu!",
        "{minute}' - 🎯 Traumpass durchs Zentrum von {passer}! {shooter} nimmt den Ball direkt mit Tempo mit.",
        "{minute}' - 🚀 Schnelles Umschalten über {passer}, der {shooter} perfekt in Szene setzt!"
    ],
    cross: [
        "{minute}' - 🌪️ Maßflanke von der Außenbahn durch {winger} in den Strafraum auf {shooter}!",
        "{minute}' - 📐 {winger} tankt sich auf dem Flügel durch und flankt scharf an den Fünfmeterraum auf {shooter}!",
        "{minute}' - 🚀 Schöne Hereingabe von {winger}, {shooter} steigt am höchsten zum Kopfball hoch!",
        "{minute}' - 🌪️ Hohe Flanke von {winger} – {shooter} lauert am zweiten Pfosten!"
    ],
    dribble: [
        "{minute}' - 🪄 Starkes Dribbling von {shooter}! Lässt zwei Abwehrspieler stehen und zieht ab!",
        "{minute}' - 🔥 {shooter} zieht mit einer feinen Körpertäuschung nach innen und sucht den Abschluss!",
        "{minute}' - ⚡ {shooter} bricht mit Dynamik durch die Abwehrreihe und kommt zum Schuss!",
        "{minute}' - 🪄 Klasse Einzelaktion von {shooter}, der sich im Sechzehner Platz für den Torschuss verschafft!"
    ],
    corner: [
        "{minute}' - 🚩 Eckball für {club}! {passer} schlägt die Kugel mit Zug vor das gegnerische Tor.",
        "{minute}' - 🚩 Gefährliche Ecke von {passer}! Der Ball segelt gefährlich ins Zentrum.",
        "{minute}' - 🚩 Standard für {club}: {passer} bringt die Ecke scharf an den kurzen Pfosten.",
        "{minute}' - 🚩 Eckstoß für {club}, getreten von {passer} – Kopfballduell im Strafraum!"
    ],
    goal: [
        "{minute}' - ⚽ TOOOOOOR für {club}! {shooter} schließt eiskalt ab!",
        "{minute}' - ⚽ TOOOOOOR für {club}! Traumhafter Treffer von {shooter} unhaltbar ins Netz!",
        "{minute}' - ⚽ TOOOOOOR! {shooter} vollendet souverän zur Freude der {club}-Fans!",
        "{minute}' - ⚽ TOOOOOOR für {club}! {shooter} lässt dem Keeper absolut keine Abwehrchance!"
    ],
    save: [
        "{minute}' - 🧤 Glanztat! {gk} taucht blitzschnell ab und pariert den Schuss von {shooter}!",
        "{minute}' - 🧤 Was für eine Parade! {gk} lenkt den Ball von {shooter} mit den Fingerspitzen um den Pfosten!",
        "{minute}' - 🧤 Starke Reaktion von {gk}, der den Abschluss von {shooter} sicher entschärft!",
        "{minute}' - 🧤 {gk} bleibt im 1-gegen-1 gegen {shooter} Sieger und klärt überragend!"
    ],
    woodwork: [
        "{minute}' - 💥 ALUTREFFER! {shooter} trifft nur den Pfosten/die Latte!",
        "{minute}' - 💥 PECH! Der stramme Schuss von {shooter} klatscht lautstark ans Torgebälk!",
        "{minute}' - 💥 Aluminium! {shooter} hämmert den Ball an die Latte – großes Glück für {defClub}!",
        "{minute}' - 💥 Pfosten! {shooter} verpasst die Führung um wenige Millimeter!"
    ],
    missed: [
        "{minute}' - 💨 Knapp vorbei! Der Versuch von {shooter} verzieht um Haaresbreite.",
        "{minute}' - 💨 Verzogen! {shooter} zielt über das Gehäuse.",
        "{minute}' - 💨 Chance vertan: {shooter} trifft den Ball nicht voll, Abstoß.",
        "{minute}' - 💨 Schuss von {shooter} geht deutlich am langen Eck vorbei ins Toraus."
    ],
    foul: [
        "{minute}' - 🛑 Pfiff des Schiedsrichters: Foulspiel von {defender} ({defClub}).",
        "{minute}' - 🛑 Taktisches Zupfen von {defender} ({defClub}), Freistoß.",
        "{minute}' - 🛑 {defender} kommt einen Schritt zu spät und stoppt den Angriff per Foul.",
        "{minute}' - 🛑 Unsportlicher Einsatz von {defender} – Freistoß für {attClub}."
    ],
    yellow_card: [
        "{minute}' - 🟨 Gelbe Karte für {defender} ({defClub}) nach wiederholtem Foulspiel.",
        "{minute}' - 🟨 Taktisches Foul von {defender} ({defClub}) – klare Gelbe Karte!",
        "{minute}' - 🟨 Schiedsrichter zückt Gelb für {defender} nach einem rüden Einsteigen.",
        "{minute}' - 🟨 Verwarnung für {defender} ({defClub}) wegen Reklamierens/Foulspiels."
    ],
    second_yellow_card: [
        "{minute}' - 🟨🟥 GELB-ROT! {defender} ({defClub}) muss nach dem zweiten Foul vorzeitig vom Platz!",
        "{minute}' - 🟨🟥 Platzverweis! {defender} sieht die Ampelkarte und schwächt sein Team!",
        "{minute}' - 🟨🟥 Zweite Gelbe Karte für {defender} – Gelb-Rot! {defClub} spielt in Unterzahl!"
    ],
    red_card: [
        "{minute}' - 🟥 GLATT ROT! Brutales Foul von {defender} ({defClub}) – sofortiger Platzverweis!",
        "{minute}' - 🟥 ROTE KARTE! {defender} begeht eine Notbremse und muss sofort runter!",
        "{minute}' - 🟥 Schiedsrichter zeigt {defender} ({defClub}) nach einer Tätlichkeit direkt Rot!"
    ],
    penalty: [
        "{minute}' - 🛑 PFIFF! Foul im Strafraum! Schiedsrichter zeigt auf den Punkt: ELFMETER für {attClub}!",
        "{minute}' - 🛑 ELFMETER für {attClub}! {defender} bringt den Angreifer im Sechzehner zu Fall!",
        "{minute}' - 🛑 Strafstoßpfiff! Handspiel/Foul im Strafraum – Riesenchance für {attClub}!"
    ],
    tackle: [
        "{minute}' - 🛡️ Perfektes Tackling: {defender} klärt die Situation mit einer sauberen Grätsche.",
        "{minute}' - 🛡️ Starke Abwehraktion von {defender}, der den Ball souverän abläuft.",
        "{minute}' - 🛡️ {defender} antizipiert den Pass glänzend und gewinnt den Zweikampf.",
        "{minute}' - 🛡️ Wichtige Rettungstat von {defender} am eigenen Sechzehner!"
    ],
    injury: [
        "{minute}' - 🚑 Verletzung bei {club}! {player} greift sich ans Bein und muss behandelt werden ({injury}).",
        "{minute}' - 🚑 Bittere Szene: {player} ({club}) verletzt sich im Zweikampf ({injury}) und kann wohl nicht weiterspielen.",
        "{minute}' - 🚑 {player} bleibt nach einem Sprint mit Schmerzen am Boden liegen ({injury})."
    ],
    substitution: [
        "{minute}' - 🔄 Auswechslung {club}: {playerIn} kommt für {playerOut} ins Spiel.",
        "{minute}' - 🔄 Frische Kräfte bei {club}: {playerIn} ersetzt {playerOut}.",
        "{minute}' - 🔄 Taktischer Wechsel bei {club}: {playerOut} geht vom Platz, neu dabei ist {playerIn}."
    ],
    tactics: [
        "{minute}' - 📋 Traineranweisung bei {club}: Taktik angepasst auf Mentalität \"{mentality}\".",
        "{minute}' - 📋 {club} reagiert von der Seitenlinie: Neue Ausrichtung mit \"{mentality}\".",
        "{minute}' - 📋 Taktische Umstellung bei {club}: Spielstil neu justiert."
    ],
    halftime: [
        "{minute}' - ⏸️ Halbzeitpfiff! Die Teams gehen beim Stand von {score} in die Kabinen.",
        "{minute}' - ⏸️ Pause! Der Unparteiische pfeift zur Halbzeit ({score}).",
        "{minute}' - ⏸️ Nach intensiven ersten 45 Minuten steht es zur Pause {score}."
    ],
    fulltime: [
        "{minute}' - 🏁 Schlusspfiff! Das Spiel endet mit dem Endstand von {score}.",
        "{minute}' - 🏁 Abpfiff! Der Schiedsrichter beendet die Partie beim Stand von {score}.",
        "{minute}' - 🏁 Ende der Begegnung! Endergebnis: {score}."
    ]
};

function formatCommentary(type, data = {}) {
    const list = MATCH_COMMENTARY[type] || MATCH_COMMENTARY.goal;
    let text = _Random.choice(list) || "";
    for (const key in data) {
        text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), data[key] ?? "");
    }
    return text;
}

class MatchEngine {
    /**
     * Säubert die Aufstellung eines Vereins (A3):
     * Verletzte (injuredWeeks > 0) und Gesperrte (suspendedMatches > 0) fliegen aus der Elf,
     * fitte Ersatzspieler rücken von der Bank bzw. dem Kader nach.
     */
    /**
     * Nachschlagetabelle Spieler-ID -> Spieler.
     *
     * Mit über 4000 Spielern in der Welt kostet ein lineares find() je
     * Aufstellung spürbar Zeit: pro Spieltag laufen rund 190 Hintergrundspiele,
     * jedes mit 25 Nachschlägen für beide Mannschaften. Der Index wird an das
     * Spieler-Array gehängt und neu gebaut, sobald sich dessen Länge ändert.
     */
    static getPlayerIndex(allPlayers) {
        if (!Array.isArray(allPlayers)) return new Map();

        if (!MatchEngine._playerIndexCache) MatchEngine._playerIndexCache = new WeakMap();
        const cached = MatchEngine._playerIndexCache.get(allPlayers);
        if (cached && cached.size === allPlayers.length) return cached.map;

        const map = new Map();
        allPlayers.forEach(p => { if (p) map.set(p.id, p); });
        MatchEngine._playerIndexCache.set(allPlayers, { size: allPlayers.length, map });
        return map;
    }

    static findPlayer(allPlayers, id) {
        const found = this.getPlayerIndex(allPlayers).get(id);
        if (found) return found;
        return Array.isArray(allPlayers) ? allPlayers.find(p => p && p.id === id) : undefined;
    }

    static getCleanLineup(club, allPlayers) {
        const lineupIds = [...(club.lineup || [])];
        const benchIds = [...(club.bench || [])];
        const clean = [];
        const seenIds = new Set();

        const isPlayerFitAndEligible = p => p && (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0;

        // Fitte Spieler aus der Bank bereitstellen
        const availableBench = benchIds
            .map(id => MatchEngine.findPlayer(allPlayers, id))
            .filter(isPlayerFitAndEligible);

        // 1. Stammelf prüfen
        lineupIds.forEach(id => {
            const p = MatchEngine.findPlayer(allPlayers, id);
            if (isPlayerFitAndEligible(p) && !seenIds.has(p.id)) {
                clean.push(p);
                seenIds.add(p.id);
            } else {
                // Ersatz von der Bank
                const replacement = availableBench.find(bp => !seenIds.has(bp.id));
                if (replacement) {
                    clean.push(replacement);
                    seenIds.add(replacement.id);
                }
            }
        });

        // 2. Falls noch < 11, aus Restkader auffüllen
        if (clean.length < 11) {
            const squadIds = new Set(club.playerIds || []);
            const squadPlayers = allPlayers.filter(p =>
                squadIds.has(p.id) &&
                !seenIds.has(p.id) &&
                isPlayerFitAndEligible(p)
            );
            while (clean.length < 11 && squadPlayers.length > 0) {
                const addP = squadPlayers.shift();
                clean.push(addP);
                seenIds.add(addP.id);
            }
        }

        // Falls Notstand (z.B. < 11 fitte Spieler), ungefiltert auffüllen
        if (clean.length === 0 && lineupIds.length > 0) {
            return lineupIds.map(id => MatchEngine.findPlayer(allPlayers, id)).filter(Boolean);
        }

        return clean;
    }

    /**
     * Liefert die Positionscodes der Formation eines Vereins (Slot-Reihenfolge)
     */
    static getFormationSlots(club) {
        const formConfigs = (typeof FORMATION_CONFIGS !== 'undefined' && FORMATION_CONFIGS)
            ? FORMATION_CONFIGS
            : ((typeof window !== 'undefined' && window.FORMATION_CONFIGS)
                ? window.FORMATION_CONFIGS
                : (typeof require !== 'undefined' ? require('./gameState.js').FORMATION_CONFIGS : {}));

        const key = club?.formation || "4-4-2";
        const config = (formConfigs && formConfigs[key]) || (formConfigs && formConfigs["4-4-2"]) || null;
        return (config && Array.isArray(config.positions)) ? config.positions : [];
    }

    /**
     * Ordnet jedem Spieler der Startelf die Position zu, auf der er tatsächlich aufgestellt ist.
     * Der Index in der Aufstellung entspricht dem Formations-Slot.
     */
    static getDeployedPositionMap(club, lineupPlayers) {
        const slots = this.getFormationSlots(club);
        const map = new Map();
        (lineupPlayers || []).forEach((p, idx) => {
            if (!p) return;
            const slotPos = slots[idx]?.pos || p.pos;
            map.set(p.id, slotPos);
        });
        return map;
    }

    /**
     * Familiaritätsfaktor eines Spielers auf seiner Einsatzposition (1.0 = Stammposition)
     */
    static getPositionModifier(player, deployedPos) {
        if (!player || !deployedPos || !_PositionEngine) return 1.0;
        if (player.pos === deployedPos) return 1.0;
        return _PositionEngine.getRatingModifier(_PositionEngine.getFamiliarity(player, deployedPos));
    }

    /**
     * Berechnet die effektive Spielerstärke aus positionsrelevanten Attributen (A1)
     * Gewichtung: ~60 % Attribute / 40 % overall (Fallback auf overall pro fehlendem Attribut)
     * Wird eine abweichende Einsatzposition übergeben, sinkt die Stärke entsprechend
     * der Positionseignung des Spielers.
     */
    static calculateEffectivePlayerSkill(player, deployedPos = null) {
        if (!player) return 65;
        const ovr = player.overall || 68;

        const getAttr = (attrName) => {
            return (typeof player[attrName] === 'number') ? player[attrName] : ovr;
        };

        let attrs = [];
        // Die Attributgewichtung richtet sich nach der Position, auf der gespielt wird
        const pos = deployedPos || player.pos || "ZM";

        if (pos === "TW") {
            attrs = [getAttr("reflexes"), getAttr("handling"), getAttr("oneOnOne"), getAttr("positioning")];
        } else if (["IV", "LV", "RV"].includes(pos)) {
            attrs = [getAttr("defense"), getAttr("physical"), getAttr("positioning"), getAttr("pace")];
        } else if (["DM", "ZM", "OM", "LM", "RM"].includes(pos)) {
            attrs = [getAttr("passing"), getAttr("vision"), getAttr("technique"), getAttr("stamina")];
        } else { // ST, LA, RA
            attrs = [getAttr("shooting"), getAttr("pace"), getAttr("dribbling"), getAttr("technique")];
        }

        const attrAvg = attrs.reduce((sum, val) => sum + val, 0) / attrs.length;
        const baseSkill = (attrAvg * 0.6) + (ovr * 0.4);

        // Kondition, Stimmung und Form färben die Leistung ein - sie ersetzen
        // sie aber nicht. Vorher verschob allein die Moral die Spielstärke um
        // dreizehn Prozent, während zwischen dem besten und dem schwächsten
        // Bundesligakader nur sieben Prozent liegen: Eine Formkrise machte aus
        // dem Meister rechnerisch einen Abstiegskandidaten, und weil schlechte
        // Ergebnisse die Moral weiter drückten, kam kein Verein aus dieser
        // Spirale wieder heraus.
        const fitnessFactor = 0.72 + ((player.fitness || 100) / 100) * 0.28;
        const moraleFactor = 0.94 + ((player.morale || 75) / 100) * 0.08;
        const formFactor = 0.92 + ((player.form || 7.0) / 10) * 0.11;
        const positionFactor = this.getPositionModifier(player, deployedPos);

        return baseSkill * fitnessFactor * moraleFactor * formFactor * positionFactor;
    }

    /**
     * Berechnet die effektive Teamstärke unter Berücksichtigung aller 7 Taktikregler (A1 & A2)
     */
    static calculateTeamPower(club, allPlayers, isHome = false, customLineup = null) {
        const lineupPlayers = customLineup || this.getCleanLineup(club, allPlayers);

        if (lineupPlayers.length === 0) {
            return { attack: 50, midfield: 50, defense: 50, goalkeeper: 50, total: 50 };
        }

        let attackSum = 0, attackCount = 0;
        let midSum = 0, midCount = 0;
        let defSum = 0, defCount = 0;
        let gkPower = 70;

        // Einsatzpositionen aus der Formation ableiten: ein Spieler wird dort bewertet,
        // wo er aufgestellt ist - nicht dort, wo er eigentlich zuhause ist.
        const deployedMap = this.getDeployedPositionMap(club, lineupPlayers);

        lineupPlayers.forEach(p => {
            const deployedPos = deployedMap.get(p.id) || p.pos;
            const effectiveSkill = this.calculateEffectivePlayerSkill(p, deployedPos);

            if (deployedPos === "TW") {
                gkPower = effectiveSkill * 1.05;
            } else if (["IV", "LV", "RV"].includes(deployedPos)) {
                defSum += effectiveSkill;
                defCount++;
            } else if (["DM", "ZM", "LM", "RM", "OM"].includes(deployedPos)) {
                midSum += effectiveSkill;
                midCount++;
            } else { // ST, LA, RA
                attackSum += effectiveSkill;
                attackCount++;
            }
        });

        let attack = attackCount > 0 ? attackSum / attackCount : 65;
        let midfield = midCount > 0 ? midSum / midCount : 65;
        let defense = defCount > 0 ? defSum / defCount : 65;

        // Taktische Modifikatoren für alle 7 Taktikregler (A2)
        const tactics = club.tactics || {};

        // 1. Mentality
        switch (tactics.mentality) {
            case "very_offensive": attack *= 1.20; defense *= 0.84; break;
            case "offensive": attack *= 1.10; defense *= 0.93; break;
            case "defensive": attack *= 0.91; defense *= 1.10; break;
            case "very_defensive": attack *= 0.80; defense *= 1.20; break;
        }

        // 2. Pressing
        if (tactics.pressing === "high") {
            midfield *= 1.06;
            defense *= 1.03;
        } else if (tactics.pressing === "low") {
            defense *= 1.04;
            midfield *= 0.95;
        }

        // 3. Tempo
        if (tactics.tempo === "fast") {
            attack *= 1.05;
            defense *= 0.96;
        } else if (tactics.tempo === "slow") {
            defense *= 1.03;
            attack *= 0.97;
        }

        // 4. Defensive Line
        if (tactics.defensiveLine === "high") {
            midfield *= 1.04;
            defense *= 0.95;
        } else if (tactics.defensiveLine === "deep") {
            defense *= 1.06;
            attack *= 0.95;
        }

        // 5. Passing
        if (tactics.passing === "direct") {
            attack *= 1.04;
            midfield *= 0.97;
        } else if (tactics.passing === "short") {
            midfield *= 1.05;
            attack *= 0.97;
        }

        // 6. Anweisungen gegen den Ball und im Umschalten (nach FM26). Jede
        // hat ihren Preis: Wer oefter presst und gegenpresst, gewinnt das
        // Mittelfeld, laesst aber hinten Raum; wer sich zurueckzieht und eng
        // steht, verteidigt besser und kommt weniger nach vorn.
        const w = _mTaktik()?.wirkung(tactics);
        if (w) {
            if (w.presser === 3) { midfield *= 1.02; defense *= 0.99; }
            else if (w.presser === 1) { midfield *= 0.99; defense *= 1.01; }
            if (w.gegenpressing > 3) { midfield *= 1.02; defense *= 0.99; }
            else if (w.gegenpressing === 0) { defense *= 1.02; attack *= 0.99; }
            if (w.konter > 0) { attack *= 1.015; midfield *= 0.995; }
            else if (w.konter < 0) { midfield *= 1.015; attack *= 0.99; }
            if (w.kompakt < 0) { defense *= 1.015; midfield *= 0.99; }
            else if (w.kompakt > 0) { defense *= 0.99; midfield *= 1.01; }
            if (w.zweikampf > 0) defense *= 1.012;
            else if (w.zweikampf < 0) defense *= 0.99;
            if (w.abseitsfalle) defense *= 1.01;
            if (w.freiheit > 1) { attack *= 1.01; defense *= 0.995; }
            else if (w.freiheit < 1) { defense *= 1.005; attack *= 0.995; }
        }

        // E2: Teamchemie aktivieren (Multiplikator)
        if (club.chemistry) {
            const chemAvg = ((club.chemistry.overall || 75) + (club.chemistry.tacticalFamiliarity || 70) + (club.chemistry.dressingRoom || 75)) / 3;
            const chemFactor = 0.90 + (chemAvg / 100) * 0.13; // 0.90 bis 1.03
            attack *= chemFactor;
            midfield *= chemFactor;
            defense *= chemFactor;
            gkPower *= chemFactor;
        }

        // Heimvorteil (beeinflusst durch Stadion-Infrastruktur C2 & Atmosphäre)
        if (isHome) {
            const stadiumLvl = club.facilities?.stadium || 2;
            const homeAtmosphere = 1.03 + (stadiumLvl * 0.008);
            attack *= homeAtmosphere;
            midfield *= homeAtmosphere;
            defense *= homeAtmosphere;
        }

        const total = (attack * 0.35 + midfield * 0.35 + defense * 0.2 + gkPower * 0.1);

        return { attack, midfield, defense, goalkeeper: gkPower, total };
    }

    /**
     * Schussmodell mit echten Attributen (A4)
     */
    /**
     * Wie gut jemand einen Standard ausführt: Elfmeter und Freistoß leben vom
     * Schuss, eine Ecke von Technik und Passspiel.
     */
    static standardWert(art, p) {
        const v = (k) => (p && typeof p[k] === "number") ? p[k] : (p?.overall || 60);
        if (art === "elfmeter") return v("shooting") * 0.7 + v("technique") * 0.3;
        if (art === "freistoss") return v("shooting") * 0.5 + v("technique") * 0.5;
        return v("technique") * 0.5 + v("passing") * 0.5;
    }

    /**
     * Die im Taktik-Reiter festgelegten Schützen eines Vereins. Vorher
     * wurden sie gespeichert, aber von keiner Simulation gelesen.
     */
    static standardsAusRollen(club) {
        const r = (club && club.roles) || {};
        const id = v => (v === undefined || v === "" || (typeof v === "number" && isNaN(v))) ? null : v;
        return { elfmeter: id(r.penaltyTaker), freistoss: id(r.freeKickTaker), ecken: id(r.cornerTaker) };
    }

    /**
     * Wer tritt an? Der vorgegebene Schütze, solange er auf dem Platz steht -
     * sonst der Beste unter den Feldspielern.
     */
    static standardSchuetze(art, spieler, vorgabeId = null, posVon = null) {
        const feld = (spieler || []).filter(p => p && p.pos !== "TW" && (!posVon || posVon(p) !== "TW"));
        if (vorgabeId !== null && vorgabeId !== undefined) {
            const vorgabe = feld.find(p => p.id === vorgabeId);
            if (vorgabe) return vorgabe;
        }
        return feld.slice().sort((a, b) => this.standardWert(art, b) - this.standardWert(art, a))[0] || null;
    }

    /**
     * Die Note eines Spielers aus seinen Aktionen. Spielbericht und Live-Note
     * rechnen damit gleich - vorher gab es nur die Note nach dem Abpfiff, und
     * sie kannte fast nur Tore, Vorlagen und Karten: Ein Mittelfeldspieler,
     * der fünf Chancen vorbereitet hatte, stand bei 6,3 wie jeder andere.
     *
     * @param {Object} st  goals, assists, saves, tackles, chancen, aufsTor,
     *                     fouls, yellowCards, redCards, hasSecondYellow, penaltySaved
     * @param {Object} ctx pos, minutes, teamGoals, oppGoals, jitter
     */
    static noteBerechnen(st, ctx = {}) {
        const minutes = ctx.minutes || 0;
        const oppGoals = ctx.oppGoals || 0;
        const teamGoals = ctx.teamGoals || 0;
        let rating = 6.3;
        rating += (st.goals || 0) * 1.0;
        rating += (st.assists || 0) * 0.6;

        const isTW = ctx.pos === "TW";
        const isDef = ["IV", "LV", "RV", "DM"].includes(ctx.pos);
        if (isTW) {
            rating += (st.saves || 0) * 0.25;
            if (st.penaltySaved) rating += 0.8;
        }
        if (isTW || isDef) {
            if (minutes >= 60 && oppGoals === 0) rating += 0.4;
            rating -= oppGoals * 0.15;
        }

        rating += (st.tackles || 0) * 0.1;
        // Beteiligung: vorbereitete Chancen, Schüsse aufs Tor, eigene Fouls
        rating += (st.chancen || 0) * 0.12;
        rating += (st.aufsTor || 0) * 0.08;
        rating -= (st.fouls || 0) * 0.08;
        rating -= (st.yellowCards || 0) * 0.3;
        if ((st.redCards || 0) > 0 || st.hasSecondYellow) rating -= 1.5;

        if (teamGoals > oppGoals) rating += 0.2;
        else if (teamGoals < oppGoals) rating -= 0.2;

        rating += ctx.jitter || 0;

        // Nach Einsatzminuten dämpfen
        const weight = Math.min(1.0, minutes / 60);
        rating = 6.0 + (rating - 6.0) * weight;
        return parseFloat(_Random.clamp(rating, 3.0, 10.0).toFixed(1));
    }

    static resolveShotAttempt(shotType, shooter, gk, attPower, defPower, tactics = {}) {
        const getVal = (pl, attr) => (pl && typeof pl[attr] === 'number') ? pl[attr] : (pl?.overall || 68);

        let shooterSkill = getVal(shooter, "overall");
        let gkSkill = getVal(gk, "overall");

        if (shotType === "through_ball") {
            shooterSkill = getVal(shooter, "shooting") * 0.5 + getVal(shooter, "technique") * 0.3 + getVal(shooter, "pace") * 0.2;
            gkSkill = getVal(gk, "oneOnOne") * 0.55 + getVal(gk, "reflexes") * 0.45;
        } else if (shotType === "cross") {
            shooterSkill = getVal(shooter, "physical") * 0.45 + getVal(shooter, "shooting") * 0.35 + getVal(shooter, "pace") * 0.2;
            gkSkill = getVal(gk, "positioning") * 0.5 + getVal(gk, "handling") * 0.5;
        } else if (shotType === "dribble") {
            shooterSkill = getVal(shooter, "dribbling") * 0.5 + getVal(shooter, "technique") * 0.3 + getVal(shooter, "shooting") * 0.2;
            gkSkill = getVal(gk, "oneOnOne") * 0.5 + getVal(gk, "reflexes") * 0.5;
        } else if (shotType === "corner") {
            shooterSkill = getVal(shooter, "physical") * 0.5 + getVal(shooter, "shooting") * 0.3 + getVal(shooter, "technique") * 0.2;
            gkSkill = getVal(gk, "positioning") * 0.55 + getVal(gk, "handling") * 0.45;
        } else if (shotType === "penalty") {
            shooterSkill = getVal(shooter, "shooting") * 0.7 + getVal(shooter, "technique") * 0.3;
            gkSkill = getVal(gk, "reflexes") * 0.6 + getVal(gk, "oneOnOne") * 0.4;
        } else if (shotType === "freekick") {
            shooterSkill = getVal(shooter, "shooting") * 0.5 + getVal(shooter, "technique") * 0.5;
            gkSkill = getVal(gk, "positioning") * 0.5 + getVal(gk, "reflexes") * 0.5;
        }

        const skillEdge = (shooterSkill - gkSkill) * 0.6 +
            ((attPower?.attack || 65) - (defPower?.defense || 65)) * 0.35;

        let base = MATCH_TUNING.baseGoalChance[shotType] ?? 0.10;

        // Taktischer Regler: risk
        const risk = tactics.risk || "normal";
        if (risk === "risky") {
            base *= 1.15;
        } else if (risk === "safe") {
            base *= 0.88;
        }

        let pGoal = base + skillEdge / MATCH_TUNING.skillInfluence;
        pGoal = _Random.clamp(pGoal, MATCH_TUNING.minGoalChance, MATCH_TUNING.maxGoalChance);

        let pSave = 0.42 - skillEdge / 500;
        pSave = _Random.clamp(pSave, 0.22, 0.62);

        const pWoodwork = 0.05;

        const xG = parseFloat(_Random.clamp(base + skillEdge / 300, 0.03, 0.76).toFixed(2));

        const roll = Math.random();
        if (roll < pGoal) return { outcome: "goal", xG };
        if (roll < pGoal + pSave) return { outcome: "saved", xG };
        if (roll < pGoal + pSave + pWoodwork) return { outcome: "woodwork", xG };
        return { outcome: "missed", xG };
    }

    /**
     * Generiert eine vollständige, deterministische Timeline von Spielszenen.
     * Unterstützt flexible Parameter und Resimulation für LiveMatch.
     */
    static generateTimeline(arg1, arg2, arg3, arg4, arg5) {
        let match = null;
        let homeClub, awayClub, allPlayers, options;

        if (Array.isArray(arg4)) {
            match = arg1;
            homeClub = arg2;
            awayClub = arg3;
            allPlayers = arg4;
            options = arg5 || {};
        } else if (Array.isArray(arg3)) {
            homeClub = arg1;
            awayClub = arg2;
            allPlayers = arg3;
            options = arg4 || {};
            match = arg5 || null;
        } else {
            homeClub = arg1;
            awayClub = arg2;
            allPlayers = arg3 || [];
            options = arg4 || {};
        }

        const startMinute = options.startMinute || 1;
        let currentHomeScore = options.currentHomeScore || 0;
        let currentAwayScore = options.currentAwayScore || 0;

        // Startaufstellungen säubern (A3)
        const homeLineup = options.homeLineup || this.getCleanLineup(homeClub, allPlayers);
        const awayLineup = options.awayLineup || this.getCleanLineup(awayClub, allPlayers);

        if (match && !match.lineups) {
            match.lineups = {
                home: homeLineup.map(p => p.id),
                away: awayLineup.map(p => p.id)
            };
        }

        // Aktive Feldspieler während des Spielverlaufs
        let activeHomePlayers = [...homeLineup];
        let activeAwayPlayers = [...awayLineup];

        let homeSubsUsed = options.usedSubsHome || 0;
        let awaySubsUsed = options.usedSubsAway || 0;
        const maxSubs = 5;

        // Wer auf der Bank sitzt. Im Livespiel fuehrt LiveMatch die Bank selbst:
        // Ein ausgewechselter Spieler darf nicht zurueck, und wer schon drin
        // ist, sitzt nicht mehr draussen. Ohne diese Angabe gilt die Bank des
        // Vereins.
        // Wer ausgewechselt ist, kommt nicht zurück. Die Bank ist eine feste
        // Liste - ohne diese Buchführung wurde ein verletzt Ausgewechselter
        // drei Minuten später wieder eingewechselt.
        const ausgewechselt = new Set();
        const bankVon = (isHomeTeam) => ((isHomeTeam
            ? (options.homeBench || homeClub.bench)
            : (options.awayBench || awayClub.bench)) || []).filter(id => !ausgewechselt.has(id));

        // Wechselt die Simulation fuer diese Mannschaft selbst? Fuer die
        // Mannschaft des Spielers nur, wenn er die Wechsel dem Co-Trainer
        // ueberlassen hat - sonst entscheidet er.
        const autoWechsel = {
            home: options.autoWechselHome !== false,
            away: options.autoWechselAway !== false
        };

        // Fuenf Wechsel in hoechstens drei Unterbrechungen. Wechsel in derselben
        // Minute zaehlen als eine Unterbrechung.
        const wechselFenster = {
            home: { genutzt: options.wechselFensterHome || 0, minute: null },
            away: { genutzt: options.wechselFensterAway || 0, minute: null }
        };
        const fensterFrei = (side, min) => {
            const f = wechselFenster[side];
            return f.minute === min || f.genutzt < 3;
        };
        const fensterBelegen = (side, min) => {
            const f = wechselFenster[side];
            if (f.minute !== min) f.genutzt++;
            f.minute = min;
        };

        // Turnierspiele in der Vorbereitung finden auf neutralem Platz statt -
        // dort hat keiner der beiden ein Publikum im Rücken.
        const neutralerPlatz = !!(match && match.neutralerPlatz) || options.neutralerPlatz === true;

        // Dieselbe Heimelf ohne Heimbonus. Für die Verteilung der Szenen zählt
        // allein, wie gut die beiden Kader sind - sonst steckte der Heimvorteil
        // zweimal im Spiel und wüchse obendrein mit der Stärke der Mannschaft.
        const homePowerNeutral = this.calculateTeamPower(homeClub, allPlayers, false, activeHomePlayers);

        // Teamstärken
        const homePower = neutralerPlatz
            ? homePowerNeutral
            : this.calculateTeamPower(homeClub, allPlayers, true, activeHomePlayers);
        const awayPower = this.calculateTeamPower(awayClub, allPlayers, false, activeAwayPlayers);

        // Ballbesitz & Passquote (B11)
        const homeTactics = homeClub.tactics || {};
        const awayTactics = awayClub.tactics || {};

        let posModifier = 0;
        if (homeTactics.tempo === "slow") posModifier += 2;
        if (homeTactics.tempo === "fast") posModifier -= 2;
        if (homeTactics.passing === "short") posModifier += 3;
        if (homeTactics.passing === "direct") posModifier -= 3;
        if (homeTactics.pressing === "high") posModifier += 2;
        if (homeTactics.pressing === "low") posModifier -= 2;

        if (awayTactics.tempo === "slow") posModifier -= 2;
        if (awayTactics.tempo === "fast") posModifier += 2;
        if (awayTactics.passing === "short") posModifier -= 3;
        if (awayTactics.passing === "direct") posModifier += 3;

        const baseMidRatio = homePower.midfield / (homePower.midfield + awayPower.midfield);
        let calculatedHomePossession = Math.round(baseMidRatio * 100 + posModifier + 2);
        calculatedHomePossession = _Random.clamp(calculatedHomePossession, 28, 72);
        const calculatedAwayPossession = 100 - calculatedHomePossession;

        // Nachspielzeit (A5)
        const extraTime1 = _Random.int(1, 3);
        // Zeitspiel laesst der Schiedsrichter nachspielen
        const zeitspielt = [homeTactics, awayTactics].some(t => (_mTaktik()?.wirkung(t).zeitspiel || 0) > 0);
        const extraTime2 = Math.min(7, _Random.int(1, 5) + (zeitspielt ? 1 : 0));

        const timeline = [];

        // Szenenanzahl basierend auf Tempo
        let totalScenesBase = 32;
        // Jede Mannschaft bringt ihr eigenes Tempo ein. Vorher reichte eine
        // schnelle Elf fuer vier Szenen mehr - seit die KI-Vereine eigene
        // Spielstile haben, war das in fast zwei von drei Partien der Fall.
        [homeTactics, awayTactics].forEach(t => {
            if (t.tempo === "fast") totalScenesBase += 2;
            else if (t.tempo === "slow") totalScenesBase -= 2;
        });

        // Ein überlegenes Team drückt die andere Mannschaft in die eigene
        // Hälfte: Es entstehen nicht nur anteilig mehr Szenen, sondern
        // insgesamt mehr.
        const powerDiff = homePower.total - awayPower.total;
        const totalScenes = Math.max(20, Math.round(totalScenesBase + (powerDiff / 6) + _Random.float(-3, 3)));

        // Kaderunterschied für die Szenenverteilung: Das Mittelfeld erobert den
        // Ball, die beiden anderen Mannschaftsteile entscheiden, wer ihn behält.
        //
        // Angriff und Abwehr zählen bewusst gemeinsam. Die Taktikregler
        // verschieben Stärke zwischen beiden - eine offensive Ausrichtung macht
        // den Angriff stark und die Abwehr schwach. Zählte hier nur der Angriff,
        // bekäme eine offensive Mannschaft dafür auch noch mehr Szenen, und der
        // Nachteil ihrer offenen Abwehr fiele nicht mehr auf. Die Summe hebt die
        // Verschiebung auf: Die Taktik wirkt dort, wo sie hingehört - beim
        // Abschluss und in der Verteidigung -, während hier nur zählt, wie gut
        // die beiden Kader wirklich sind.
        //
        // Gemessen wird am Niveau der Begegnung, damit dieselben Zahlen in der
        // Kreisliga und in der Bundesliga dasselbe bedeuten.
        const szenenAbstand = (homePowerNeutral.midfield - awayPower.midfield) * 0.65
            + ((homePowerNeutral.attack + homePowerNeutral.defense)
                - (awayPower.attack + awayPower.defense)) * 0.175;
        const szenenBezug = Math.max(40,
            (homePowerNeutral.midfield + awayPower.midfield
                + homePowerNeutral.attack + awayPower.attack
                + homePowerNeutral.defense + awayPower.defense) / 6);

        // Generiere chronologische Minuten über das Spiel
        const sceneMinutes = [];
        for (let i = 0; i < totalScenes; i++) {
            const rawMin = Math.round(((i + 0.5) / totalScenes) * 90 + _Random.float(-1.5, 1.5));
            const min = _Random.clamp(rawMin, 1, 90);
            if (min >= startMinute) {
                sceneMinutes.push(min);
            }
        }
        // Wer auf Druck macht, bekommt im Zeitfenster zusätzliche Szenen -
        // das Spiel wird schneller, nach vorne wie nach hinten.
        (Array.isArray(options.zurufe) ? options.zurufe : []).forEach(z => {
            const def = z && ZURUFE[z.art];
            if (!def || !(def.extraSzenen > 0)) return;
            const imFenster = sceneMinutes.filter(m => m >= z.von && m <= z.bis).length;
            const roh = imFenster * def.extraSzenen;
            const zusatz = Math.floor(roh) + (_Random.chance(roh - Math.floor(roh)) ? 1 : 0);
            for (let i = 0; i < zusatz; i++) {
                const m = _Random.int(Math.max(z.von, startMinute), Math.min(90, z.bis));
                if (m >= startMinute) sceneMinutes.push(m);
            }
        });
        sceneMinutes.sort((a, b) => a - b);

        // Tracking von Verwarnungen / Platzverweisen pro Spieler im Spiel (A8)
        //
        // Beim Neuberechnen des Restspiels kommt mit, was schon passiert ist.
        // Vorher begann jede Neuberechnung mit einem leeren Buch: Ein
        // Verwarnter bekam nach einer Taktikaenderung eine "erste" Gelbe, und
        // ein Platzverwiesener stand wieder in den Szenen.
        const playerYellows = new Map((options.gelbIds || []).map(id => [id, 1]));
        const sentOffPlayerIds = new Set(options.sentOffIds || []);

        // Einsatzpositionen aus den Formationen ableiten: Wer auf der Sechs spielt,
        // taucht auch im Spielbericht als Sechser auf - nicht als Stürmer.
        const homeSlots = this.getFormationSlots(homeClub);
        const awaySlots = this.getFormationSlots(awayClub);

        const deployedPosOf = (player, isHomeTeam) => {
            if (!player) return "ZM";
            const arr = isHomeTeam ? activeHomePlayers : activeAwayPlayers;
            const slots = isHomeTeam ? homeSlots : awaySlots;
            const idx = arr.indexOf(player);
            return (idx >= 0 && slots[idx]?.pos) || player.pos || "ZM";
        };

        // Wer kommt fuer ihn? Der Bankspieler, der auf der frei werdenden
        // Position am besten aufgehoben ist - nicht einfach der erste auf der
        // Liste. Vorher kam "benchAvailable[0]", und das war nicht selten der
        // Ersatztorwart, der dann fuer einen Stuermer auflief. Ein Torwart
        // kommt nur fuer einen Torwart, ein Feldspieler nur fuer einen
        // Feldspieler.
        const ersatzFuer = (outPlayer, isHomeTeam, benchAvailable) => {
            const slotPos = deployedPosOf(outPlayer, isHomeTeam);
            const istTorwart = slotPos === "TW";
            const passend = benchAvailable.filter(p => (p.pos === "TW") === istTorwart);
            if (passend.length === 0) return null;
            // Ein schwacher Co-Trainer greift auch mal daneben
            const guete = wechselGuete(isHomeTeam);
            if (guete !== null && _Random.chance((100 - guete) / 200)) return _Random.choice(passend);
            const wert = p => (_PositionEngine && typeof _PositionEngine.scorePlayerForSlot === "function")
                ? _PositionEngine.scorePlayerForSlot(p, slotPos)
                : (p.overall || 60);
            return passend.slice().sort((a, b) => wert(b) - wert(a))[0];
        };

        // Wer entscheidet ueber die Wechsel? Fuer die Mannschaft des Spielers
        // der Co-Trainer - je besser er ist, desto treffender die Wahl.
        // Ohne Angabe (KI-Vereine) wird wie bisher der Passendste genommen.
        function wechselGuete(isHomeTeam) {
            const g = options[isHomeTeam ? "wechselGueteHome" : "wechselGueteAway"];
            return typeof g === "number" ? Math.max(0, Math.min(100, g)) : null;
        }

        // Wie frisch ein Spieler gerade ist. Im Livespiel kommt das aus der
        // Simulation - ausgewechselt wurde bisher nach der Fitness vor dem
        // Anpfiff, also oft der Falsche.
        const frischeVon = (p) => {
            const f = options.frische instanceof Map ? options.frische.get(p.id) : undefined;
            return typeof f === "number" ? f * 100 : (p.fitness || 100);
        };

        // Zurufe von der Seitenlinie: [{ side, art, von, bis }]
        const zurufe = Array.isArray(options.zurufe) ? options.zurufe : [];
        const zurufVon = (side, min) => {
            const z = zurufe.find(x => x && x.side === side && min >= x.von && min <= x.bis);
            return z ? (ZURUFE[z.art] || null) : null;
        };

        // Standardschützen: vorgegeben, sonst der Beste auf dem Platz
        const standards = {
            home: options.standardsHome || this.standardsAusRollen(homeClub),
            away: options.standardsAway || this.standardsAusRollen(awayClub)
        };
        const schuetze = (art, isHomeTeam) => MatchEngine.standardSchuetze(art,
            (isHomeTeam ? activeHomePlayers : activeAwayPlayers).filter(p => !sentOffPlayerIds.has(p.id)),
            standards[isHomeTeam ? "home" : "away"][art],
            p => deployedPosOf(p, isHomeTeam));

        // Direkter Freistoß aus Schussweite. "rechts": Die gefoulte Mannschaft
        // greift in der Zeitleiste nach rechts an - das ist die Heimmannschaft.
        const imSchussbereich = (spot, rechts) => spot
            && (rechts ? spot.x >= 68 : spot.x <= 32) && Math.abs(spot.y - 50) <= 28;
        const direkterFreistoss = (min, rechts, spot, sekunde) => {
            const isHomeTeam = rechts;
            const attClub = isHomeTeam ? homeClub : awayClub;
            const defClub = isHomeTeam ? awayClub : homeClub;
            const taker = schuetze("freistoss", isHomeTeam);
            const defPlayers = (isHomeTeam ? activeAwayPlayers : activeHomePlayers).filter(p => !sentOffPlayerIds.has(p.id));
            const gk = defPlayers.find(p => deployedPosOf(p, !isHomeTeam) === "TW") || defPlayers.find(p => p.pos === "TW") || defPlayers[0];
            if (!taker || !gk) return false;

            const { outcome, xG } = MatchEngine.resolveShotAttempt("freekick", taker, gk,
                isHomeTeam ? homePower : awayPower, isHomeTeam ? awayPower : homePower,
                isHomeTeam ? homeTactics : awayTactics);
            const seite = isHomeTeam ? "home" : "away";
            const basis = {
                minute: min,
                second: Math.min(58, sekunde),
                start: { x: spot.x, y: spot.y },
                end: { x: rechts ? 96 : 4, y: _Random.float(45, 55) },
                xG,
                isFreekick: true
            };
            if (outcome === "goal") {
                if (isHomeTeam) currentHomeScore++; else currentAwayScore++;
                timeline.push({ ...basis, type: "goal", team: seite, clubId: attClub.id, clubName: attClub.name,
                    playerId: taker.id, playerName: taker.name, outcome: "goal",
                    text: `${min}' - ⚽ TOOOR! ${taker.name} zirkelt den Freistoß über die Mauer ins Netz!` });
            } else if (outcome === "saved") {
                timeline.push({ ...basis, type: "save", team: isHomeTeam ? "away" : "home", clubId: defClub.id, clubName: defClub.name,
                    shooterId: taker.id, shooterName: taker.name, gkId: gk.id, gkName: gk.name, outcome: "saved",
                    text: `${min}' - 🧤 ${gk.name} fischt den Freistoß von ${taker.name} aus dem Winkel!` });
            } else {
                const pfosten = outcome === "woodwork";
                timeline.push({ ...basis, type: "shot_miss", team: seite, clubId: attClub.id, clubName: attClub.name,
                    playerId: taker.id, playerName: taker.name, outcome: pfosten ? "woodwork" : "missed",
                    text: pfosten
                        ? `${min}' - 💥 Der Freistoß von ${taker.name} klatscht an den Pfosten!`
                        : `${min}' - Der Freistoß von ${taker.name} ${_Random.chance(0.5) ? "bleibt in der Mauer hängen" : "streicht knapp über die Latte"}.` });
            }
            return true;
        };

        // Hilfsfunktion: Schuss/Angriff erzeugen (E20)
        const buildAttackScene = (min, isHomeAttacking, attackType) => {
            const attClub = isHomeAttacking ? homeClub : awayClub;
            const defClub = isHomeAttacking ? awayClub : homeClub;
            const attPlayers = (isHomeAttacking ? activeHomePlayers : activeAwayPlayers).filter(p => !sentOffPlayerIds.has(p.id));
            const defPlayers = (isHomeAttacking ? activeAwayPlayers : activeHomePlayers).filter(p => !sentOffPlayerIds.has(p.id));

            if (attPlayers.length === 0 || defPlayers.length === 0) return;

            const attPowerLocal = isHomeAttacking ? homePower : awayPower;
            const defPowerLocal = isHomeAttacking ? awayPower : homePower;
            const attTactics = isHomeAttacking ? homeTactics : awayTactics;

            const attPos = p => deployedPosOf(p, isHomeAttacking);
            const defPos = p => deployedPosOf(p, !isHomeAttacking);

            const attackers = attPlayers.filter(p => ["ST", "LA", "RA", "OM"].includes(attPos(p)));
            const midfielders = attPlayers.filter(p => ["ZM", "DM", "LM", "RM"].includes(attPos(p)));
            const wingers = attPlayers.filter(p => ["LA", "RA", "LM", "RM"].includes(attPos(p)));
            const defenders = defPlayers.filter(p => ["IV", "LV", "RV", "DM"].includes(defPos(p)));
            const gk = defPlayers.find(p => defPos(p) === "TW") || defPlayers.find(p => p.pos === "TW") || defPlayers[0];

            const shooter = attackers.length > 0 ? _Random.choice(attackers) : (midfielders[0] || attPlayers[0]);
            // Die Ecke tritt der Standardschütze, nicht ein zufälliger Mittelfeldspieler
            const passer = (attackType === "corner" ? schuetze("ecken", isHomeAttacking) : null)
                || (midfielders.length > 0 ? _Random.choice(midfielders) : (attPlayers[1] || attPlayers[0]));
            const winger = wingers.length > 0 ? _Random.choice(wingers) : passer;
            const defender = defenders.length > 0 ? _Random.choice(defenders) : defPlayers[0];

            // Koordinaten für das 2D-Feld.
            //
            // Jede Angriffsart hat ihre eigene Geometrie, damit das Bild zum
            // Text passt: Eine Ecke beginnt an der Eckfahne, eine Flanke am
            // Flügel, ein Steilpass in der Zentrale, ein Dribbling im
            // Halbfeld. Vorher zogen alle vier dieselben Zufallszahlen aus
            // der Mitte - die Ecke wurde also mitten auf dem Platz getreten.
            //
            // Gerechnet wird im Bild "Heim greift nach rechts an"; für die
            // Auswärtsmannschaft wird gespiegelt.
            const spiegel = (v) => isHomeAttacking ? v : 100 - v;
            // Die Angriffsseite aus dem Taktikbogen: "Links" meint die linke
            // Seite in Angriffsrichtung - wer nach rechts angreift, hat sie
            // oben. Vorher las die Simulation ein Feld, das die Taktik gar
            // nicht setzt, und die Einstellung blieb ohne Wirkung.
            const fokus = attTactics.focus || attTactics.attackFocus;
            const fokusFlanke = fokus === "left" ? (isHomeAttacking ? "oben" : "unten")
                : (fokus === "right" ? (isHomeAttacking ? "unten" : "oben") : null);
            const flanke = fokusFlanke
                ? (_Random.chance(0.75) ? fokusFlanke : (fokusFlanke === "oben" ? "unten" : "oben"))
                : (_Random.chance(0.5) ? "oben" : "unten");
            const flankenY = (nah, fern) => flanke === "oben"
                ? _Random.float(nah, fern)
                : 100 - _Random.float(nah, fern);

            let startX, startY, midX, midY;

            if (attackType === "corner") {
                // Der Eckstoss liegt im Viertelkreis an der Fahne: Die
                // Torlinie verlaeuft bei 96, die Seitenlinien bei 0 und 100
                startX = spiegel(95.6);
                startY = flanke === "oben" ? 1.2 : 98.8;
                midX = spiegel(_Random.float(84, 91));
                midY = _Random.float(40, 60);
            } else if (attackType === "cross") {
                startX = spiegel(_Random.float(70, 88));
                startY = flankenY(6, 20);
                midX = spiegel(_Random.float(82, 90));
                midY = _Random.float(38, 62);
            } else if (attackType === "through_ball") {
                startX = spiegel(_Random.float(42, 60));
                startY = _Random.float(28, 72);
                midX = spiegel(_Random.float(74, 87));
                midY = _Random.float(30, 70);
            } else {
                // Dribbling: der Schütze zieht selbst aus dem Halbfeld nach innen
                startX = spiegel(_Random.float(56, 72));
                startY = flankenY(18, 40);
                midX = spiegel(_Random.float(76, 88));
                midY = _Random.float(34, 66);
            }

            const goalX = spiegel(96);
            const goalY = _Random.float(46, 54);

            let eventType = attackType;
            let prepText = "";

            if (attackType === "through_ball") {
                prepText = formatCommentary("through_ball", { minute: min, passer: passer?.name, shooter: shooter?.name });
            } else if (attackType === "cross") {
                prepText = formatCommentary("cross", { minute: min, winger: winger?.name, shooter: shooter?.name });
            } else if (attackType === "dribble") {
                prepText = formatCommentary("dribble", { minute: min, shooter: shooter?.name });
            } else if (attackType === "corner") {
                prepText = formatCommentary("corner", { minute: min, passer: passer?.name, club: attClub.name });
            }

            // Vorbereitende Pass-/Flankenaktion
            timeline.push({
                minute: min,
                second: 12,
                type: eventType,
                team: isHomeAttacking ? "home" : "away",
                clubId: attClub.id,
                clubName: attClub.name,
                fromPlayerId: attackType === "cross" ? winger?.id : passer?.id,
                fromPlayerName: attackType === "cross" ? winger?.name : passer?.name,
                toPlayerId: shooter?.id,
                toPlayerName: shooter?.name,
                start: { x: startX, y: startY },
                end: { x: midX, y: midY },
                success: true,
                text: prepText
            });

            // Momentum & Stamina-Einfluss (A5)
            // Ab Minute 65 wirkt Stamina/Fitness auf die Torwahrscheinlichkeit
            let staminaBonus = 0;
            if (min >= 65) {
                const attAvgStamina = attPlayers.reduce((s, p) => s + (p.stamina || 70), 0) / (attPlayers.length || 1);
                const defAvgStamina = defPlayers.reduce((s, p) => s + (p.stamina || 70), 0) / (defPlayers.length || 1);
                staminaBonus = (attAvgStamina - defAvgStamina) * 0.15;
            }

            // Rückstand erhöht Offensive / Chancenqualität (Momentum)
            const scoreDiff = isHomeAttacking ? (currentAwayScore - currentHomeScore) : (currentHomeScore - currentAwayScore);
            const momentumBonus = scoreDiff > 0 ? 4 : (scoreDiff < 0 ? -2 : 0);

            // Zurufe von der Seitenlinie: eigener Druck macht die Abschlüsse
            // gefährlicher, der des Gegners öffnet Räume für den Konter.
            const eigenZuruf = zurufVon(isHomeAttacking ? "home" : "away", min);
            const gegnerZuruf = zurufVon(isHomeAttacking ? "away" : "home", min);
            const zurufBonus = (eigenZuruf ? eigenZuruf.angriff : 0) + (gegnerZuruf ? gegnerZuruf.gegnerAngriff : 0);
            // Eine gute Hereingabe macht den Kopfball nach der Ecke gefährlicher
            const eckenBonus = attackType === "corner" && passer
                ? (MatchEngine.standardWert("ecken", passer) - 70) * 0.12 : 0;

            const modifiedAttPower = { ...attPowerLocal, attack: attPowerLocal.attack + staminaBonus + momentumBonus + zurufBonus + eckenBonus };
            const { outcome, xG } = MatchEngine.resolveShotAttempt(attackType, shooter, gk, modifiedAttPower, defPowerLocal, attTactics);

            if (outcome === "goal") {
                if (isHomeAttacking) currentHomeScore++; else currentAwayScore++;
                timeline.push({
                    minute: min,
                    second: 24,
                    type: "goal",
                    team: isHomeAttacking ? "home" : "away",
                    clubId: attClub.id,
                    clubName: attClub.name,
                    playerId: shooter?.id,
                    playerName: shooter?.name,
                    assistId: attackType === "cross" ? winger?.id : (attackType === "through_ball" ? passer?.id : null),
                    assistName: attackType === "cross" ? winger?.name : (attackType === "through_ball" ? passer?.name : null),
                    start: { x: midX, y: midY },
                    end: { x: goalX, y: goalY },
                    xG,
                    outcome: "goal",
                    text: formatCommentary("goal", { minute: min, club: attClub.name, shooter: shooter?.name })
                });
            } else if (outcome === "saved") {
                timeline.push({
                    minute: min,
                    second: 24,
                    type: "save",
                    team: isHomeAttacking ? "away" : "home",
                    clubId: defClub.id,
                    clubName: defClub.name,
                    shooterId: shooter?.id,
                    shooterName: shooter?.name,
                    gkId: gk?.id,
                    gkName: gk?.name,
                    start: { x: midX, y: midY },
                    end: { x: goalX, y: goalY },
                    xG,
                    outcome: "saved",
                    text: formatCommentary("save", { minute: min, gk: gk?.name, shooter: shooter?.name })
                });
                // 25% Chance auf eine anschließende Ecke nach Parade
                if (_Random.chance(0.25)) {
                    timeline.push({
                        minute: min,
                        second: 40,
                        type: "corner",
                        team: isHomeAttacking ? "home" : "away",
                        clubId: attClub.id,
                        clubName: attClub.name,
                        start: { x: isHomeAttacking ? 95.6 : 4.4, y: _Random.choice([1.2, 98.8]) },
                        end: { x: isHomeAttacking ? 88 : 12, y: 50 },
                        text: `${min}' - 🚩 Ecke für ${attClub.name} nach der Parade!`
                    });
                }
            } else if (outcome === "woodwork") {
                timeline.push({
                    minute: min,
                    second: 24,
                    type: "shot_miss",
                    team: isHomeAttacking ? "home" : "away",
                    clubId: attClub.id,
                    clubName: attClub.name,
                    playerId: shooter?.id,
                    playerName: shooter?.name,
                    start: { x: midX, y: midY },
                    end: { x: goalX, y: goalY + (_Random.chance(0.5) ? 3 : -3) },
                    xG,
                    outcome: "woodwork",
                    text: formatCommentary("woodwork", { minute: min, shooter: shooter?.name, defClub: defClub.name })
                });
            } else {
                timeline.push({
                    minute: min,
                    second: 24,
                    type: "shot_miss",
                    team: isHomeAttacking ? "home" : "away",
                    clubId: attClub.id,
                    clubName: attClub.name,
                    playerId: shooter?.id,
                    playerName: shooter?.name,
                    start: { x: midX, y: midY },
                    end: { x: goalX + (isHomeAttacking ? 4 : -4), y: goalY + _Random.float(-10, 10) },
                    xG,
                    outcome: "missed",
                    text: formatCommentary("missed", { minute: min, shooter: shooter?.name })
                });
            }
        };

        // Kleine Fouls über das ganze Spiel verteilt.
        //
        // Die Szenen oben erzeugen nur die Fouls, aus denen Karten, Elfmeter
        // oder Konter entstehen - rund drei pro Spiel. Ein echtes Spiel hat
        // gut zwanzig Unterbrechungen, und jede davon ist ein Freistoß, den
        // man auf dem Feld auch sieht. Diese Fouls kosten keine Torchance:
        // Sie treten neben die Angriffsszenen, nicht an ihre Stelle.
        //
        // Sie laufen mit der Uhr: Vorher entstanden sie erst nach der ganzen
        // Partie und griffen auf die Schlussaufstellung zurück. Ein in der 70.
        // Minute Eingewechselter foulte dann schon in der 5., und wer in der
        // 76. Rot sah, fehlte beim Freistoß in der 5. Minute als Schütze.
        const kleineFouls = _Random.int(7, 13);
        const foulMinuten = [];
        for (let i = 0; i < kleineFouls; i++) foulMinuten.push(_Random.int(Math.max(2, startMinute), 89));
        foulMinuten.sort((x, y) => x - y);
        const kleinesFoul = (min) => {
            const heimFoult = _Random.chance(0.5);
            const foulClub = heimFoult ? homeClub : awayClub;
            const kandidaten = (heimFoult ? activeHomePlayers : activeAwayPlayers)
                .filter(p => !sentOffPlayerIds.has(p.id) && p.pos !== "TW");
            const suender = _Random.choice(kandidaten);
            if (!suender) return;

            // Gefoult wird der Gegner: Foult die Heimmannschaft, tritt der
            // Gast den Freistoß Richtung x=4, der Tatort liegt also in der
            // Heimhälfte oder im Mittelfeld - und umgekehrt.
            const gefoulteGreiftRechtsAn = !heimFoult;
            const x = gefoulteGreiftRechtsAn
                ? 100 - _Random.float(20, 62)
                : _Random.float(20, 62);

            const sekunde = _Random.int(5, 50);
            const tatort = { x, y: _Random.float(10, 90) };
            const foulEreignis = {
                minute: min,
                second: sekunde,
                type: "foul",
                team: heimFoult ? "home" : "away",
                clubId: foulClub.id,
                clubName: foulClub.name,
                playerId: suender.id,
                playerName: suender.name,
                start: tatort,
                end: { x: tatort.x, y: tatort.y },
                outcome: "freekick",
                text: `${min}' - 🛑 Freistoß: ${suender.name} stoppt den Gegenspieler unfair.`
            };
            timeline.push(foulEreignis);
            if (imSchussbereich(tatort, gefoulteGreiftRechtsAn) && _Random.chance(MATCH_TUNING.direkterFreistoss)
                && direkterFreistoss(min, gefoulteGreiftRechtsAn, tatort, sekunde + 8)) {
                foulEreignis.direkterFreistoss = true;
            }
        };

        // Simuliere jede Szene chronologisch
        sceneMinutes.forEach(min => {
            // Kleine Fouls, die vor dieser Szene liegen, zuerst
            while (foulMinuten.length > 0 && foulMinuten[0] < min) kleinesFoul(foulMinuten.shift());

            // KI-Wechsel ab Minute 60 (C17)
            if (min >= 60 && min <= 82) {
                ['home', 'away'].forEach(teamSide => {
                    const isHomeTeam = teamSide === 'home';
                    const subsUsed = isHomeTeam ? homeSubsUsed : awaySubsUsed;
                    const club = isHomeTeam ? homeClub : awayClub;
                    const activePlayers = isHomeTeam ? activeHomePlayers : activeAwayPlayers;

                    if (autoWechsel[teamSide] && subsUsed < maxSubs && fensterFrei(teamSide, min) && _Random.chance(0.20)) {
                        const benchAvailable = bankVon(isHomeTeam)
                            .map(id => MatchEngine.findPlayer(allPlayers, id))
                            .filter(p => p && (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0 && !activePlayers.some(ap => ap.id === p.id));

                        if (benchAvailable.length > 0) {
                            // Erschöpften oder schwachen Spieler auswechseln -
                            // aber keinen, der schon vom Platz gestellt ist.
                            const kandidaten = [...activePlayers]
                                .filter(p => p.pos !== "TW" && !sentOffPlayerIds.has(p.id))
                                .sort((a, b) => frischeVon(a) - frischeVon(b));
                            const guete = wechselGuete(isHomeTeam);
                            const candidateOut = (guete !== null && _Random.chance((100 - guete) / 160))
                                ? _Random.choice(kandidaten.slice(0, 4))
                                : kandidaten[0];

                            const subIn = candidateOut ? ersatzFuer(candidateOut, isHomeTeam, benchAvailable) : null;
                            if (candidateOut && subIn) {
                                const outIdx = activePlayers.findIndex(p => p.id === candidateOut.id);
                                if (outIdx !== -1) {
                                    activePlayers[outIdx] = subIn;
                                    ausgewechselt.add(candidateOut.id);
                                    if (isHomeTeam) homeSubsUsed++; else awaySubsUsed++;
                                    fensterBelegen(teamSide, min);

                                    timeline.push({
                                        minute: min,
                                        second: 5,
                                        type: "substitution",
                                        team: teamSide,
                                        clubId: club.id,
                                        clubName: club.name,
                                        playerOutId: candidateOut.id,
                                        playerOutName: candidateOut.name,
                                        playerInId: subIn.id,
                                        playerInName: subIn.name,
                                        text: formatCommentary("substitution", { minute: min, club: club.name, playerIn: subIn.name, playerOut: candidateOut.name })
                                    });
                                }
                            }
                        }
                    }
                });
            }

            // Verletzungswahrscheinlichkeit im Spiel (A7)
            ['home', 'away'].forEach(teamSide => {
                const isHomeTeam = teamSide === 'home';
                const club = isHomeTeam ? homeClub : awayClub;
                const activePlayers = isHomeTeam ? activeHomePlayers : activeAwayPlayers;
                const tactics = isHomeTeam ? homeTactics : awayTactics;

                const pressingMod = tactics.pressing === "high" ? 1.3 : (tactics.pressing === "low" ? 0.8 : 1.0);
                const injuryRoll = MATCH_TUNING.injuryRatePerTeam * (1 / (totalScenes || 30)) * pressingMod;

                if (_Random.chance(injuryRoll)) {
                    const victim = _Random.choice(activePlayers.filter(p => !sentOffPlayerIds.has(p.id)));
                    if (victim) {
                        const inj = _Random.choice(INJURY_CATALOG);
                        timeline.push({
                            minute: min,
                            second: 8,
                            type: "injury",
                            team: teamSide,
                            clubId: club.id,
                            clubName: club.name,
                            playerId: victim.id,
                            playerName: victim.name,
                            injuryName: inj.name,
                            injuredWeeks: inj.weeks,
                            text: formatCommentary("injury", { minute: min, club: club.name, player: victim.name, injury: inj.name })
                        });

                        // Auswechslung des Verletzten versuchen. Bei der
                        // Mannschaft des Spielers nur, wenn er die Wechsel dem
                        // Co-Trainer ueberlassen hat - sonst fragt das Spiel
                        // ihn, und bis dahin spielt der Verletzte angeschlagen.
                        const benchAvailable = bankVon(isHomeTeam)
                            .map(id => MatchEngine.findPlayer(allPlayers, id))
                            .filter(p => p && (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0 && !activePlayers.some(ap => ap.id === p.id));

                        const subIn = benchAvailable.length > 0 ? ersatzFuer(victim, isHomeTeam, benchAvailable) : null;
                        if (autoWechsel[teamSide] && subIn && fensterFrei(teamSide, min)
                            && (isHomeTeam ? homeSubsUsed : awaySubsUsed) < maxSubs) {
                            const outIdx = activePlayers.findIndex(p => p.id === victim.id);
                            if (outIdx !== -1) {
                                activePlayers[outIdx] = subIn;
                                ausgewechselt.add(victim.id);
                                if (isHomeTeam) homeSubsUsed++; else awaySubsUsed++;
                                fensterBelegen(teamSide, min);

                                timeline.push({
                                    minute: min,
                                    second: 15,
                                    type: "substitution",
                                    team: teamSide,
                                    clubId: club.id,
                                    clubName: club.name,
                                    playerOutId: victim.id,
                                    playerOutName: victim.name,
                                    playerInId: subIn.id,
                                    playerInName: subIn.name,
                                    text: formatCommentary("substitution", { minute: min, club: club.name, playerIn: subIn.name, playerOut: victim.name })
                                });
                            }
                        }
                    }
                }
            });

            // Zeit schinden: Ein Teil der Szenen findet schlicht nicht statt
            const verschleppt = Math.max(zurufVon("home", min)?.ruhe || 0, zurufVon("away", min)?.ruhe || 0);
            if (verschleppt > 0 && _Random.chance(verschleppt)) return;

            // Ermittle angreifendes Team: Wer die besseren Spieler hat, kommt
            // öfter vor das Tor - im Mittelfeld entsteht die Szene, vorne wird
            // sie zu einer echten Gelegenheit.
            let homeProb = 0.5 + (neutralerPlatz ? 0 : MATCH_TUNING.homeSceneEdge)
                + (szenenAbstand / szenenBezug) * MATCH_TUNING.sceneShare;
            // Momentum: Zurückliegendes Team drückt mehr
            if (currentHomeScore < currentAwayScore) homeProb += 0.08;
            else if (currentAwayScore < currentHomeScore) homeProb -= 0.08;

            // Unterzahl kostet Szenen
            const heimFehlt = activeHomePlayers.filter(p => sentOffPlayerIds.has(p.id)).length;
            const gastFehlt = activeAwayPlayers.filter(p => sentOffPlayerIds.has(p.id)).length;
            homeProb += (gastFehlt - heimFehlt) * MATCH_TUNING.unterzahlSzenen;

            // Zurufe verschieben die Szenen
            homeProb += (zurufVon("home", min)?.szenen || 0) - (zurufVon("away", min)?.szenen || 0);

            // Auch der klar schwächere Gegner kommt noch vor das Tor
            homeProb = _Random.clamp(homeProb, 0.18, 0.82);

            const isHomeAttacking = _Random.chance(homeProb);
            const attClub = isHomeAttacking ? homeClub : awayClub;
            const defClub = isHomeAttacking ? awayClub : homeClub;
            const attTactics = isHomeAttacking ? homeTactics : awayTactics;
            const defTactics = isHomeAttacking ? awayTactics : homeTactics;

            const attPlayers = isHomeAttacking ? activeHomePlayers : activeAwayPlayers;
            const defPlayers = isHomeAttacking ? activeAwayPlayers : activeHomePlayers;

            const sceneTypeRoll = Math.random();

            // Wer hart einsteigt, foult oefter; wer auf den Fuessen bleibt, seltener
            const haerte = _mTaktik()?.wirkung(defTactics).zweikampf || 0;
            if (sceneTypeRoll < MATCH_TUNING.foulRate + haerte * 0.03) {
                // 1. ZWEIKÄMPFE, FOULS, KARTEN & ELFMETER (A6, A8)
                const foulDefPos = p => deployedPosOf(p, !isHomeAttacking);
                const foulAttPos = p => deployedPosOf(p, isHomeAttacking);

                // Der Torwart begeht keine Feldzweikämpfe im Mittelfeld
                const foulEligible = defPlayers.filter(p => !sentOffPlayerIds.has(p.id) && foulDefPos(p) !== "TW" && p.pos !== "TW");
                const defender = _Random.choice(foulEligible) || defPlayers.find(p => p.pos !== "TW") || defPlayers[0];
                const shooter = _Random.choice(attPlayers.filter(p => ["ST", "LA", "RA", "OM"].includes(foulAttPos(p)))) || attPlayers[0];
                const gk = defPlayers.find(p => foulDefPos(p) === "TW") || defPlayers.find(p => p.pos === "TW") || defPlayers[0];
                // Gefoult wird dort, wo die angreifende Mannschaft gerade
                // hinwill: im Mittelfeld und im letzten Drittel. Vorher lag
                // der Tatort zufällig irgendwo zwischen beiden Strafräumen,
                // sodass die Hälfte der Fouls in der eigenen Hälfte der
                // angreifenden Mannschaft passierte.
                const fPos = {
                    x: isHomeAttacking ? _Random.float(38, 84) : 100 - _Random.float(38, 84),
                    y: _Random.float(16, 84)
                };

                const isPenalty = _Random.chance(MATCH_TUNING.penaltyRate);
                const isRed = !isPenalty && _Random.chance(0.003);
                // "Ruhe bewahren" halbiert die Karten, "Zeit schinden" provoziert welche
                // Wer auf Zeit spielt, sieht in der Schlussphase eher Gelb
                const zeitspielGelb = (min >= 70 && (_mTaktik()?.wirkung(defTactics).zeitspiel || 0) > 0) ? 1.12 : 1;
                const kartenFaktor = (zurufVon(isHomeAttacking ? "away" : "home", min)?.gelb || 1) * zeitspielGelb;
                const isYellow = !isPenalty && !isRed && _Random.chance(Math.min(0.9, MATCH_TUNING.yellowCardRate * kartenFaktor));

                if (isPenalty) {
                    // Elf Meter vor der Torlinie (96): 9,6 Einheiten
                    const penSpot = { x: isHomeAttacking ? 86.4 : 13.6, y: 50 };
                    const goalX = isHomeAttacking ? 96 : 4;
                    const goalY = 50;

                    timeline.push({
                        minute: min,
                        second: 20,
                        type: "foul",
                        team: isHomeAttacking ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        playerId: defender?.id,
                        playerName: defender?.name,
                        start: penSpot,
                        end: penSpot,
                        outcome: "penalty",
                        text: formatCommentary("penalty", { minute: min, attClub: attClub.name, defender: defender?.name })
                    });

                    // Den Elfmeter schießt der Elfmeterschütze - nicht der
                    // Stürmer, der zufällig gefoult wurde.
                    const elferSchuetze = schuetze("elfmeter", isHomeAttacking) || shooter;
                    const { outcome, xG } = MatchEngine.resolveShotAttempt("penalty", elferSchuetze, gk, isHomeAttacking ? homePower : awayPower, isHomeAttacking ? awayPower : homePower, attTactics);

                    if (outcome === "goal") {
                        if (isHomeAttacking) currentHomeScore++; else currentAwayScore++;
                        timeline.push({
                            minute: min,
                            second: 35,
                            type: "goal",
                            team: isHomeAttacking ? "home" : "away",
                            clubId: attClub.id,
                            clubName: attClub.name,
                            playerId: elferSchuetze?.id,
                            playerName: elferSchuetze?.name,
                            start: penSpot,
                            end: { x: goalX, y: goalY + (_Random.chance(0.5) ? 4 : -4) },
                            xG: 0.77,
                            outcome: "goal",
                            isPenalty: true,
                            text: `${min}' - ⚽ TOOOOR durch Elfmeter! ${elferSchuetze?.name || "Schütze"} verwandelt eiskalt!`
                        });
                    } else {
                        timeline.push({
                            minute: min,
                            second: 35,
                            type: "save",
                            team: isHomeAttacking ? "away" : "home",
                            clubId: defClub.id,
                            clubName: defClub.name,
                            shooterId: elferSchuetze?.id,
                            shooterName: elferSchuetze?.name,
                            gkId: gk?.id,
                            gkName: gk?.name,
                            start: penSpot,
                            end: { x: goalX, y: goalY },
                            xG: 0.77,
                            outcome: "penalty_saved",
                            isPenalty: true,
                            text: `${min}' - 🧤 GEHALTEN! ${gk?.name || "Torwart"} pariert den Elfmeter von ${elferSchuetze?.name || "Schütze"}!`
                        });
                    }
                } else if (isRed) {
                    sentOffPlayerIds.add(defender?.id);
                    timeline.push({
                        minute: min,
                        second: 25,
                        type: "red_card",
                        team: isHomeAttacking ? "away" : "home",
                        clubId: defClub.id,
                        clubName: defClub.name,
                        playerId: defender?.id,
                        playerName: defender?.name,
                        start: fPos,
                        end: fPos,
                        outcome: "red_card",
                        text: formatCommentary("red_card", { minute: min, defender: defender?.name, defClub: defClub.name })
                    });
                } else if (isYellow) {
                    let cardTarget = defender;
                    const prevYellows = playerYellows.get(cardTarget?.id) || 0;
                    if (prevYellows >= 1 && !_Random.chance(0.08)) {
                        const cleanPlayers = foulEligible.filter(p => !playerYellows.has(p.id));
                        if (cleanPlayers.length > 0) {
                            cardTarget = _Random.choice(cleanPlayers);
                        }
                    }

                    const targetYellows = playerYellows.get(cardTarget?.id) || 0;
                    // Steht ohnehin schon jeder Verbliebene im Buch, lässt der
                    // Schiedsrichter meistens laufen. Ohne diese Bremse fielen
                    // in ausgedünnten Mannschaften drei und vier Platzverweise
                    // in einer einzigen Partie.
                    const zweiteGelbe = targetYellows >= 1 && _Random.chance(0.4);
                    if (targetYellows >= 1 && !zweiteGelbe) {
                        // Ermahnung statt Karte - gepfiffen wird trotzdem
                        timeline.push({
                            minute: min,
                            second: 25,
                            type: "foul",
                            team: isHomeAttacking ? "away" : "home",
                            clubId: defClub.id,
                            clubName: defClub.name,
                            playerId: cardTarget?.id,
                            playerName: cardTarget?.name,
                            start: fPos,
                            end: fPos,
                            outcome: "foul",
                            text: formatCommentary("foul", { minute: min, defender: cardTarget?.name, defClub: defClub.name, attClub: attClub.name })
                        });
                    } else if (zweiteGelbe) {
                        // Gelb-Rot!
                        sentOffPlayerIds.add(cardTarget?.id);
                        timeline.push({
                            minute: min,
                            second: 25,
                            type: "yellow_card",
                            isSecondYellow: true,
                            team: isHomeAttacking ? "away" : "home",
                            clubId: defClub.id,
                            clubName: defClub.name,
                            playerId: cardTarget?.id,
                            playerName: cardTarget?.name,
                            start: fPos,
                            end: fPos,
                            outcome: "second_yellow_card",
                            text: formatCommentary("second_yellow_card", { minute: min, defender: cardTarget?.name, defClub: defClub.name })
                        });
                    } else {
                        playerYellows.set(cardTarget?.id, 1);
                        timeline.push({
                            minute: min,
                            second: 25,
                            type: "yellow_card",
                            team: isHomeAttacking ? "away" : "home",
                            clubId: defClub.id,
                            clubName: defClub.name,
                            playerId: cardTarget?.id,
                            playerName: cardTarget?.name,
                            start: fPos,
                            end: fPos,
                            outcome: "yellow_card",
                            text: formatCommentary("yellow_card", { minute: min, defender: cardTarget?.name, defClub: defClub.name })
                        });
                    }
                } else {
                    // Normales Tackling / Freistoß
                    if (_Random.chance(0.55)) {
                        timeline.push({
                            minute: min,
                            second: 25,
                            type: "tackle",
                            team: isHomeAttacking ? "away" : "home",
                            clubId: defClub.id,
                            clubName: defClub.name,
                            playerId: defender?.id,
                            playerName: defender?.name,
                            start: fPos,
                            end: fPos,
                            outcome: "tackle",
                            text: formatCommentary("tackle", { minute: min, defender: defender?.name })
                        });
                    } else {
                        const direkt = imSchussbereich(fPos, isHomeAttacking) && _Random.chance(MATCH_TUNING.direkterFreistoss);
                        const foulEreignis = {
                            minute: min,
                            second: 25,
                            type: "foul",
                            team: isHomeAttacking ? "away" : "home",
                            clubId: defClub.id,
                            clubName: defClub.name,
                            playerId: defender?.id,
                            playerName: defender?.name,
                            start: fPos,
                            end: fPos,
                            outcome: "foul",
                            text: formatCommentary("foul", { minute: min, defender: defender?.name, defClub: defClub.name, attClub: attClub.name })
                        };
                        timeline.push(foulEreignis);
                        if (direkt && direkterFreistoss(min, isHomeAttacking, fPos, 38)) foulEreignis.direkterFreistoss = true;
                    }
                }
            } else {
                // 2. TORSZENEN & ANGRIFFE (A2, A4, E20)
                // Wähle Angriffsmuster anhand von passing & focus
                let throughWeight = 0.35;
                let crossWeight = 0.30;
                let dribbleWeight = 0.20;
                let cornerWeight = 0.15;

                if (attTactics.passing === "direct") {
                    throughWeight += 0.15;
                    crossWeight += 0.05;
                } else if (attTactics.passing === "short") {
                    dribbleWeight += 0.10;
                    throughWeight += 0.05;
                }

                const angriffsFokus = attTactics.focus || attTactics.attackFocus;
                if (angriffsFokus === "left" || angriffsFokus === "right") {
                    crossWeight += 0.15;
                    throughWeight -= 0.10;
                } else if (angriffsFokus === "center") {
                    throughWeight += 0.10;
                    dribbleWeight += 0.10;
                    crossWeight -= 0.15;
                }

                if (defTactics.defensiveLine === "high") {
                    throughWeight += 0.10;
                } else if (defTactics.defensiveLine === "deep") {
                    crossWeight += 0.10;
                    cornerWeight += 0.05;
                }

                // Anweisungen und Rollen formen die Angriffe: Breite und
                // fruehe Flanken bringen Flanken, ein enger Angriff und eine
                // falsche Neun Steilpaesse, inverse Fluegel Dribblings, ein
                // Zielspieler Kopfbaelle. Gegen den Ball wirkt, was die
                // andere Seite erlaubt: Eine Abseitsfalle lockt Steilpaesse,
                // wer Flanken zulaesst, bekommt Flanken.
                const wAtt = _mTaktik()?.wirkung(attTactics);
                const wDef = _mTaktik()?.wirkung(defTactics);
                if (wAtt) {
                    if (wAtt.breite > 0) crossWeight += 0.08;
                    else if (wAtt.breite < 0) { crossWeight -= 0.1; throughWeight += 0.05; dribbleWeight += 0.05; }
                    if (wAtt.flanken === "frueh") crossWeight += 0.08;
                    else if (wAtt.flanken === "wenig") crossWeight -= 0.12;
                    else if (wAtt.flanken === "grundlinie") { crossWeight += 0.04; dribbleWeight += 0.04; }
                    dribbleWeight += (wAtt.dribbling || 0) * 0.22;
                    if (wAtt.standards) cornerWeight += 0.05;
                    if (wAtt.abschluss === "herausspielen") { throughWeight += 0.04; dribbleWeight += 0.03; }
                    const rollen = _rollenZaehlung(attClub);
                    crossWeight += Math.min(0.08, (rollen.st_ziel || 0) * 0.05 + ((rollen.av_schiene || 0) + (rollen.sch || 0) + (rollen.fl || 0) + (rollen.fl_stuermer || 0)) * 0.015);
                    throughWeight += Math.min(0.08, (rollen.st_neun || 0) * 0.05 + ((rollen.st_kanal || 0) + (rollen.zm_halbraum || 0) + (rollen.om_haengend || 0)) * 0.02);
                    dribbleWeight += Math.min(0.08, ((rollen.fl_invers || 0) + (rollen.om_freirolle || 0)) * 0.03);
                    // In den Lauf gespielt gibt es mehr Steilpaesse, in den Fuss
                    // mehr Kombinationen - umverteilt, nicht dazugegeben
                    if (wAtt.ballannahme > 0) { throughWeight += 0.03; dribbleWeight -= 0.03; }
                    else if (wAtt.ballannahme < 0) { throughWeight -= 0.03; dribbleWeight += 0.03; }
                }
                if (wDef) {
                    // Eine herausrueckende Kette laesst Raum hinter sich, eine
                    // fallengelassene laedt zum Flanken ein - umverteilt
                    if (wDef.linienVerhalten > 0) { throughWeight += 0.03; crossWeight -= 0.03; }
                    else if (wDef.linienVerhalten < 0) { throughWeight -= 0.03; crossWeight += 0.03; }
                    if (wDef.abseitsfalle) throughWeight += 0.06;
                    if (wDef.flankenVerhindern > 0) crossWeight -= 0.06;
                    else if (wDef.flankenVerhindern < 0) crossWeight += 0.06;
                    if (wDef.deckung === "mann") dribbleWeight += 0.05;
                    if (wDef.kompakt < 0) { crossWeight += 0.05; throughWeight -= 0.05; }
                    else if (wDef.kompakt > 0) throughWeight += 0.05;
                }
                throughWeight = Math.max(0.05, throughWeight);
                crossWeight = Math.max(0.05, crossWeight);
                dribbleWeight = Math.max(0.05, dribbleWeight);

                const totalW = throughWeight + crossWeight + dribbleWeight + cornerWeight;
                const rollType = Math.random() * totalW;

                if (rollType < throughWeight) {
                    buildAttackScene(min, isHomeAttacking, "through_ball");
                } else if (rollType < throughWeight + crossWeight) {
                    buildAttackScene(min, isHomeAttacking, "cross");
                } else if (rollType < throughWeight + crossWeight + dribbleWeight) {
                    buildAttackScene(min, isHomeAttacking, "dribble");
                } else {
                    buildAttackScene(min, isHomeAttacking, "corner");
                }
            }
        });

        // Die restlichen kleinen Fouls nach der letzten Szene
        while (foulMinuten.length > 0) kleinesFoul(foulMinuten.shift());

        // Spielphasen & Nachspielzeit Events einfügen (A5, C15)
        const halfTimeMinute = 45 + extraTime1;
        const fullTimeMinute = 90 + extraTime2;

        // Der Pausenstand, nicht der Endstand: Das Ereignis entsteht erst
        // nach der ganzen Partie und trug vorher das Schlussergebnis.
        const toreBisPause = seite => timeline.filter(e => e.type === "goal" && e.team === seite && e.minute <= halfTimeMinute).length;
        const pauseHeim = (options.currentHomeScore || 0) + toreBisPause("home");
        const pauseGast = (options.currentAwayScore || 0) + toreBisPause("away");
        timeline.push({
            minute: halfTimeMinute,
            second: 59,
            type: "halftime",
            text: formatCommentary("halftime", { minute: halfTimeMinute, score: `${pauseHeim}:${pauseGast}` }),
            score: [pauseHeim, pauseGast]
        });

        timeline.push({
            minute: fullTimeMinute,
            second: 59,
            type: "fulltime",
            text: formatCommentary("fulltime", { minute: fullTimeMinute, score: `${currentHomeScore}:${currentAwayScore}` }),
            score: [currentHomeScore, currentAwayScore]
        });

        timeline.sort((a, b) => {
            if (a.minute !== b.minute) return a.minute - b.minute;
            return (a.second || 0) - (b.second || 0);
        });

        // Ein direkter Freistoss folgt unmittelbar auf sein Foul. Er liegt in
        // derselben Minute ein paar Sekunden spaeter - fiel ein anderes
        // Ereignis dieser Minute dazwischen, wurde zwischen Pfiff und
        // Freistoss noch ein Steilpass gespielt, und danach lag der Ball
        // wieder am Tatort.
        for (let i = 0; i < timeline.length; i++) {
            const foul = timeline[i];
            if (!foul.direkterFreistoss) continue;
            const j = timeline.findIndex((ev, k) => k > i && ev.isFreekick && ev.minute === foul.minute);
            if (j <= i + 1) continue;
            const [freistoss] = timeline.splice(j, 1);
            const naechster = timeline[i + 1];
            freistoss.second = Math.max(foul.second || 0,
                Math.min(freistoss.second || 0, (naechster?.minute === foul.minute ? (naechster.second || 0) : 60) - 0.5));
            timeline.splice(i + 1, 0, freistoss);
        }

        // Metadaten für Ballbesitz & Nachspielzeit an der Timeline hinterlegen
        timeline.possession = [calculatedHomePossession, calculatedAwayPossession];
        timeline.extraTime = { firstHalf: extraTime1, secondHalf: extraTime2 };

        return timeline;
    }

    /**
     * Wendet eine Timeline deterministisch auf das Match-Objekt an (B9 - B13)
     */
    static applyTimelineToMatch(match, timeline, homeClub, awayClub, allPlayers) {
        // Idempotenzprüfung (B13)
        if (match.played) {
            return match;
        }

        let homeGoals = 0;
        let awayGoals = 0;
        let homeShots = 0;
        let awayShots = 0;
        let homeShotsOnTarget = 0;
        let awayShotsOnTarget = 0;
        let homeCorners = 0;
        let awayCorners = 0;
        let homeFouls = 0;
        let awayFouls = 0;
        let homeYellowCards = 0;
        let awayYellowCards = 0;
        let homeRedCards = 0;
        let awayRedCards = 0;
        let homeTackles = 0;
        let awayTackles = 0;
        let homeSaves = 0;
        let awaySaves = 0;
        let homeXg = 0.0;
        let awayXg = 0.0;

        const events = [];
        const matchInjuries = [];
        const matchSuspensions = [];

        // Tracking pro Spieler für Noten & Stats
        const playerMatchStats = new Map();
        const getOrCreateStats = (playerId) => {
            if (!playerMatchStats.has(playerId)) {
                playerMatchStats.set(playerId, {
                    goals: 0,
                    assists: 0,
                    saves: 0,
                    tackles: 0,
                    yellowCards: 0,
                    redCards: 0,
                    hasSecondYellow: false,
                    penaltySaved: false,
                    subInMinute: null,
                    subOutMinute: null,
                    sentOffMinute: null,
                    chancen: 0,
                    aufsTor: 0,
                    fouls: 0
                });
            }
            return playerMatchStats.get(playerId);
        };

        timeline.forEach(event => {
            if (event.type === "goal") {
                if (event.team === "home") {
                    homeGoals++;
                    homeShotsOnTarget++;
                    homeShots++;
                    homeXg += (event.xG || 0.35);
                } else {
                    awayGoals++;
                    awayShotsOnTarget++;
                    awayShots++;
                    awayXg += (event.xG || 0.35);
                }

                if (event.playerId) {
                    const st = getOrCreateStats(event.playerId);
                    st.goals++;
                }
                if (event.assistId) {
                    const st = getOrCreateStats(event.assistId);
                    st.assists++;
                }

                events.push({
                    minute: event.minute,
                    type: "goal",
                    clubId: event.clubId,
                    text: event.text,
                    playerId: event.playerId,
                    playerName: event.playerName,
                    assistId: event.assistId,
                    assistName: event.assistName
                });
            } else if (event.type === "save") {
                if (event.team === "away") {
                    homeShotsOnTarget++;
                    homeShots++;
                    homeXg += (event.xG || 0.15);
                    awaySaves++;
                } else {
                    awayShotsOnTarget++;
                    awayShots++;
                    awayXg += (event.xG || 0.15);
                    homeSaves++;
                }

                if (event.gkId) {
                    const st = getOrCreateStats(event.gkId);
                    st.saves++;
                    if (event.outcome === "penalty_saved") st.penaltySaved = true;
                }
                if (event.shooterId) getOrCreateStats(event.shooterId).aufsTor++;

                events.push({
                    minute: event.minute,
                    type: "save",
                    clubId: event.clubId,
                    text: event.text
                });
            } else if (event.type === "shot_miss") {
                if (event.team === "home") {
                    homeShots++;
                    homeXg += (event.xG || 0.1);
                } else {
                    awayShots++;
                    awayXg += (event.xG || 0.1);
                }
            } else if (event.type === "corner") {
                if (event.team === "home") homeCorners++; else awayCorners++;
                if (event.fromPlayerId) getOrCreateStats(event.fromPlayerId).chancen++;
            } else if (event.type === "cross" || event.type === "through_ball") {
                if (event.fromPlayerId) getOrCreateStats(event.fromPlayerId).chancen++;
            } else if (event.type === "dribble") {
                if (event.toPlayerId) getOrCreateStats(event.toPlayerId).chancen++;
            } else if (event.type === "foul") {
                if (event.team === "home") homeFouls++; else awayFouls++;
                if (event.playerId) getOrCreateStats(event.playerId).fouls++;
            } else if (event.type === "tackle") {
                if (event.team === "home") homeTackles++; else awayTackles++;
                if (event.playerId) {
                    const st = getOrCreateStats(event.playerId);
                    st.tackles++;
                }
            } else if (event.type === "yellow_card") {
                if (event.isSecondYellow) {
                    if (event.team === "home") { homeFouls++; homeYellowCards++; homeRedCards++; }
                    else { awayFouls++; awayYellowCards++; awayRedCards++; }

                    if (event.playerId) {
                        const st = getOrCreateStats(event.playerId);
                        st.yellowCards++;
                        st.redCards++;
                        st.hasSecondYellow = true;
                        st.sentOffMinute = event.minute;
                    }
                } else {
                    if (event.team === "home") { homeFouls++; homeYellowCards++; }
                    else { awayFouls++; awayYellowCards++; }

                    if (event.playerId) {
                        const st = getOrCreateStats(event.playerId);
                        st.yellowCards++;
                    }
                }

                events.push({
                    minute: event.minute,
                    type: "yellow_card",
                    clubId: event.clubId,
                    text: event.text,
                    playerId: event.playerId,
                    playerName: event.playerName
                });
            } else if (event.type === "red_card") {
                if (event.team === "home") { homeFouls++; homeRedCards++; }
                else { awayFouls++; awayRedCards++; }

                if (event.playerId) {
                    const st = getOrCreateStats(event.playerId);
                    st.redCards++;
                    st.sentOffMinute = event.minute;
                }

                events.push({
                    minute: event.minute,
                    type: "red_card",
                    clubId: event.clubId,
                    text: event.text,
                    playerId: event.playerId,
                    playerName: event.playerName
                });
            } else if (event.type === "injury") {
                if (event.playerId) {
                    const player = MatchEngine.findPlayer(allPlayers, event.playerId);
                    if (player) {
                        matchInjuries.push({
                            playerId: player.id,
                            playerName: player.name,
                            clubId: event.clubId,
                            injuryName: event.injuryName || "Muskelverletzung",
                            weeks: event.injuredWeeks || 2
                        });
                    }
                }
                events.push({
                    minute: event.minute,
                    type: "injury",
                    clubId: event.clubId,
                    text: event.text,
                    playerId: event.playerId,
                    playerName: event.playerName
                });
            } else if (event.type === "substitution") {
                if (event.playerOutId) {
                    const stOut = getOrCreateStats(event.playerOutId);
                    if (stOut.subOutMinute === null) stOut.subOutMinute = event.minute;
                }
                if (event.playerInId) {
                    const stIn = getOrCreateStats(event.playerInId);
                    if (stIn.subInMinute === null) stIn.subInMinute = event.minute;
                }
                events.push({
                    minute: event.minute,
                    type: "substitution",
                    clubId: event.clubId,
                    text: event.text,
                    playerOutId: event.playerOutId,
                    playerOutName: event.playerOutName,
                    playerInId: event.playerInId,
                    playerInName: event.playerInName
                });
            }
        });

        // Startaufstellungen ermitteln (B12)
        const initialHomeLineupIds = match.lineups?.home || clubLineup(homeClub);
        const initialAwayLineupIds = match.lineups?.away || clubLineup(awayClub);

        function clubLineup(c) {
            return (c.lineup || []).slice(0, 11);
        }

        const homeStartingPlayers = initialHomeLineupIds.map(id => MatchEngine.findPlayer(allPlayers, id)).filter(Boolean);
        const awayStartingPlayers = initialAwayLineupIds.map(id => MatchEngine.findPlayer(allPlayers, id)).filter(Boolean);

        // Alle Spieler erfassen, die zum Einsatz kamen
        const allPlayedPlayerIds = new Set([...initialHomeLineupIds, ...initialAwayLineupIds]);
        timeline.forEach(ev => {
            if (ev.type === "substitution" && ev.playerInId) {
                allPlayedPlayerIds.add(ev.playerInId);
            }
        });

        const playerRatings = [];

        // Noten- und Einsatzminutenberechnung (B9, B12)
        allPlayedPlayerIds.forEach(playerId => {
            const player = MatchEngine.findPlayer(allPlayers, playerId);
            if (!player) return;

            const isHome = initialHomeLineupIds.includes(playerId) || (homeClub.playerIds || []).includes(playerId);
            const teamClub = isHome ? homeClub : awayClub;
            const teamGoals = isHome ? homeGoals : awayGoals;
            const oppGoals = isHome ? awayGoals : homeGoals;

            const st = getOrCreateStats(playerId);
            const isStarter = initialHomeLineupIds.includes(playerId) || initialAwayLineupIds.includes(playerId);

            // Einsatzminuten ermitteln
            let startMin = isStarter ? 0 : (st.subInMinute !== null ? st.subInMinute : 0);
            let endMin = 90;
            if (st.subOutMinute !== null) endMin = st.subOutMinute;
            if (st.sentOffMinute !== null) endMin = Math.min(endMin, st.sentOffMinute);

            let minutes = Math.max(0, endMin - startMin);
            if (!isStarter && st.subInMinute === null) minutes = 0;

            if (minutes <= 0) return;

            // FM-Noten-Berechnung (B9) - dieselbe Rechnung wie die Live-Note
            const isTW = player.pos === "TW";
            const rating = MatchEngine.noteBerechnen(st, {
                pos: player.pos, minutes, teamGoals, oppGoals, jitter: _Random.float(-0.15, 0.15)
            });

            // Spielerstatistiken einmalig aktualisieren (Invariante)
            player.stats.matches = (player.stats.matches || 0) + 1;
            player.stats.minutes = (player.stats.minutes || 0) + minutes;
            player.stats.goals = (player.stats.goals || 0) + st.goals;
            player.stats.assists = (player.stats.assists || 0) + st.assists;
            player.stats.ratingSum = (player.stats.ratingSum || 0) + rating;
            player.form = parseFloat((((player.form || 7.0) * 0.7) + (rating * 0.3)).toFixed(1));

            if (oppGoals === 0 && isTW && minutes >= 60) {
                player.stats.cleanSheets = (player.stats.cleanSheets || 0) + 1;
            }

            // Fitness-Verlust dynamisch (B12)
            let pressingFactor = teamClub.tactics?.pressing === "high" ? 1.25 : (teamClub.tactics?.pressing === "low" ? 0.85 : 1.0);
            // Pressingintensitaet und Gegenpressing kosten zusaetzlich Kraft
            const wFit = _mTaktik()?.wirkung(teamClub.tactics || {});
            if (wFit) {
                if (wFit.presser === 3) pressingFactor *= 1.08;
                else if (wFit.presser === 1) pressingFactor *= 0.95;
                if (wFit.gegenpressing > 3) pressingFactor *= 1.06;
                if (wFit.deckung === "mann") pressingFactor *= 1.05;
            }
            const staminaVal = player.stamina || 70;
            const ageMod = (player.age || 25) >= 31 ? 1.15 : 1.0;
            const fitLoss = Math.round(13 * (minutes / 90) * (1.3 - staminaVal / 250) * ageMod * pressingFactor);
            player.fitness = Math.max(35, (player.fitness || 100) - fitLoss);

            // Gelbe Karten & Sperren (A8)
            if (st.yellowCards > 0) {
                player.stats.yellowCards = (player.stats.yellowCards || 0) + st.yellowCards;
                player.yellowCardsTotal = (player.yellowCardsTotal || 0) + st.yellowCards;

                if (player.yellowCardsTotal % 5 === 0) {
                    player.suspendedMatches = Math.max(player.suspendedMatches || 0, 1);
                    matchSuspensions.push({
                        playerId: player.id,
                        playerName: player.name,
                        clubId: teamClub.id,
                        reason: "5. Gelbe Karte",
                        matches: 1
                    });
                }
            }

            if (st.hasSecondYellow) {
                player.stats.redCards = (player.stats.redCards || 0) + 1;
                player.suspendedMatches = Math.max(player.suspendedMatches || 0, 1);
                matchSuspensions.push({
                    playerId: player.id,
                    playerName: player.name,
                    clubId: teamClub.id,
                    reason: "Gelb-Rote Karte",
                    matches: 1
                });
            } else if (st.redCards > 0) {
                player.stats.redCards = (player.stats.redCards || 0) + 1;
                player.suspendedMatches = Math.max(player.suspendedMatches || 0, 2);
                matchSuspensions.push({
                    playerId: player.id,
                    playerName: player.name,
                    clubId: teamClub.id,
                    reason: "Rote Karte",
                    matches: 2
                });
            }

            playerRatings.push({
                playerId: player.id,
                name: player.name,
                clubId: teamClub.id,
                clubName: teamClub.name,
                pos: player.pos,
                rating,
                minutes,
                goals: st.goals,
                assists: st.assists,
                saves: st.saves,
                cards: st.redCards > 0 ? "🟥" : (st.yellowCards > 0 ? "🟨" : "")
            });
        });

        // Verletzungen auf Spielerobjekte anwenden (A7)
        matchInjuries.forEach(inj => {
            const p = MatchEngine.findPlayer(allPlayers, inj.playerId);
            if (p) {
                p.injuredWeeks = inj.weeks;
                p.injuryName = inj.injuryName;
                p.fitness = Math.max(30, (p.fitness || 100) - 20);
            }
        });

        // Formkurven der Vereine
        if (Array.isArray(homeClub.form)) {
            homeClub.form.shift();
            homeClub.form.push(homeGoals > awayGoals ? "W" : homeGoals === awayGoals ? "D" : "L");
        }
        if (Array.isArray(awayClub.form)) {
            awayClub.form.shift();
            awayClub.form.push(awayGoals > homeGoals ? "W" : homeGoals === awayGoals ? "D" : "L");
        }

        // MOTM aus der Spielleistung (B10)
        const eligibleMotm = playerRatings.filter(p => p.minutes >= 45);
        const motmPool = eligibleMotm.length > 0 ? eligibleMotm : playerRatings;
        motmPool.sort((a, b) => b.rating - a.rating);
        const topRated = motmPool[0];

        const motm = topRated ? {
            id: topRated.playerId,
            name: topRated.name,
            clubId: topRated.clubId,
            clubName: topRated.clubName,
            rating: topRated.rating
        } : null;

        // Ballbesitz, Passquote, Zweikämpfe (B11)
        const pos = timeline.possession || [50, 50];
        const homePossession = pos[0];
        const awayPossession = pos[1];

        const homePassAcc = _Random.clamp(Math.round(80 + (homeClub.tactics?.passing === "short" ? 5 : (homeClub.tactics?.passing === "direct" ? -5 : 0)) + _Random.int(-3, 3)), 70, 92);
        const awayPassAcc = _Random.clamp(Math.round(80 + (awayClub.tactics?.passing === "short" ? 5 : (awayClub.tactics?.passing === "direct" ? -5 : 0)) + _Random.int(-3, 3)), 70, 92);

        const homeTacklesWon = _Random.clamp(Math.round(55 + (homeClub.tactics?.pressing === "high" ? 6 : -4) + _Random.int(-4, 4)), 45, 75);
        const awayTacklesWon = _Random.clamp(Math.round(55 + (awayClub.tactics?.pressing === "high" ? 6 : -4) + _Random.int(-4, 4)), 45, 75);

        // Aussagekräftige Zusammenfassung (D19)
        let summaryText = "";
        const xgDiff = homeXg - awayXg;
        const motmText = motm ? ` Spieler des Spiels: ${motm.name} (${motm.rating}).` : "";

        if (homeGoals > awayGoals) {
            if (awayXg > homeXg + 0.5) {
                summaryText = `Eiskalte Effizienz: ${homeClub.name} bezwingt ${awayClub.name} mit ${homeGoals}:${awayGoals}, obwohl die Gäste mit ${awayXg.toFixed(2)} xG die besseren Chancen verbuchten.${motmText}`;
            } else if (homePossession >= 58) {
                summaryText = `Dominanter Auftritt: ${homeClub.name} kontrollierte mit ${homePossession}% Ballbesitz das Geschehen und siegte hochverdient ${homeGoals}:${awayGoals} gegen ${awayClub.name}.${motmText}`;
            } else {
                summaryText = `${homeClub.name} setzt sich in einer intensiven Partie mit ${homeGoals}:${awayGoals} gegen ${awayClub.name} durch (${homeXg.toFixed(2)} : ${awayXg.toFixed(2)} xG).${motmText}`;
            }
        } else if (awayGoals > homeGoals) {
            if (homeXg > awayXg + 0.5) {
                summaryText = `Chancenwucher bestraft: Trotz ${homeXg.toFixed(2)} xG unterliegt ${homeClub.name} den eiskalten Gästen von ${awayClub.name} mit ${homeGoals}:${awayGoals}.${motmText}`;
            } else if (awayPossession >= 58) {
                summaryText = `Reife Leistung: ${awayClub.name} bestimmte auswärts das Tempo (${awayPossession}% Ballbesitz) und entführt verdient mit ${awayGoals}:${homeGoals} alle drei Punkte.${motmText}`;
            } else {
                summaryText = `${awayClub.name} feiert einen hart erkämpften ${awayGoals}:${homeGoals}-Auswärtssieg bei ${homeClub.name} (${awayXg.toFixed(2)} xG).${motmText}`;
            }
        } else {
            if (homeSaves >= 4 || awaySaves >= 4) {
                summaryText = `Torwart-Glanzleistung: Dank starker Paraden trennen sich ${homeClub.name} und ${awayClub.name} ${homeGoals}:${awayGoals} unentschieden (${homeXg.toFixed(2)} : ${awayXg.toFixed(2)} xG).${motmText}`;
            } else {
                summaryText = `Gerechte Punkteteilung: In einem ausgeglichenen Duell endete die Begegnung zwischen ${homeClub.name} und ${awayClub.name} ${homeGoals}:${awayGoals}.${motmText}`;
            }
        }

        match.played = true;
        match.homeGoals = homeGoals;
        match.awayGoals = awayGoals;
        match.events = events;
        match.summaryText = summaryText;
        match.playerRatings = playerRatings;
        match.manOfTheMatch = motm;
        match.injuries = matchInjuries;
        match.suspensions = matchSuspensions;

        match.stats = {
            possession: [homePossession, awayPossession],
            shots: [Math.max(homeGoals, homeShots), Math.max(awayGoals, awayShots)],
            shotsOnTarget: [Math.max(homeGoals, homeShotsOnTarget), Math.max(awayGoals, awayShotsOnTarget)],
            corners: [homeCorners, awayCorners],
            fouls: [homeFouls, awayFouls],
            yellowCards: [homeYellowCards, awayYellowCards],
            redCards: [homeRedCards, awayRedCards],
            passAccuracy: [homePassAcc, awayPassAcc],
            tacklesWon: [homeTacklesWon, awayTacklesWon],
            saves: [homeSaves, awaySaves],
            motm: motm ? motm.name : "Ausgeglichen",
            xG: [parseFloat(homeXg.toFixed(2)), parseFloat(awayXg.toFixed(2))]
        };

        // Die Timeline hat ihren Zweck erfüllt: alle Zähler stecken jetzt in
        // stats, events und playerRatings. Behalten würde sie rund 22 KB je
        // Partie im Spielstand belegen - bei über 3000 Saisonspielen das
        // Vielfache dessen, was der LocalStorage fasst.
        delete match.timeline;
        delete match.timelineIndex;

        return match;
    }

    /**
     * Verkleinert eine gespielte Partie auf das, was später noch angezeigt wird.
     *
     * Fremde Ligen brauchen nur das Ergebnis. Nur Spiele des eigenen Vereins
     * behalten Einzelkritiken, Ereignisse und Aufstellungen.
     */
    static compactPlayedMatch(match, keepDetail = false) {
        if (!match || !match.played) return match;

        delete match.timeline;
        delete match.timelineIndex;
        if (keepDetail) return match;

        delete match.playerRatings;
        delete match.lineups;
        delete match.injuries;
        delete match.suspensions;
        delete match.manOfTheMatch;
        delete match.stats;
        delete match.summaryText;
        match.events = [];

        return match;
    }

    /**
     * Schnelle Hintergrund-Simulation für Matches (nutzt dieselbe Timeline)
     */
    static simulateFullMatch(match, homeClub, awayClub, allPlayers, options = {}) {
        const timeline = match.timeline && match.timeline.length > 0
            ? match.timeline
            : this.generateTimeline(match, homeClub, awayClub, allPlayers, options);

        return this.applyTimelineToMatch(match, timeline, homeClub, awayClub, allPlayers);
    }

    /**
     * Erstellt eine interaktive LiveMatch-Instanz für die 2D-Live-Simulation
     */
    static createLiveMatch(match, homeClub, awayClub, allPlayers, options = {}) {
        return new LiveMatch(match, homeClub, awayClub, allPlayers, options);
    }
}

// ------------------------------------------------------------ Trikotfarben

const _hexZuRgb = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Wahrgenommener Farbabstand ("redmean"-Näherung) - 0 gleich, rund 765 maximal */
const _farbAbstand = (a, b) => {
    const r = (a[0] + b[0]) / 2;
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
};

const _helligkeit = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

/**
 * Welche Farben beide Mannschaften auf dem Feld tragen.
 *
 * Das 2D-Bild las bisher "club.color" - ein Feld, das kein Verein hat. Jede
 * Partie lief deshalb Blau gegen Rot, der FC Bayern daheim in Blau. Jetzt
 * tragen beide ihre Vereinsfarben. Wo sie sich zu ähnlich sind (Bayern gegen
 * Leverkusen, beide rot) oder ein Trikot auf dem Rasen verschwindet (grün auf
 * grün), weicht der Gast auf sein Zweittrikot aus, notfalls auf Weiß oder
 * Schwarz. Die Torhüter bekommen eine Farbe, die sich von beiden abhebt.
 */
function ermittleTrikots(homeClub, awayClub) {
    const RASEN = [34, 120, 60];
    const GRENZE = 170;
    const kandidaten = (club, reserve) => [club?.primaryColor || club?.color, club?.secondaryColor, ...reserve]
        .map(hex => ({ hex, rgb: _hexZuRgb(hex) }))
        .filter(k => k.rgb);
    const lesbar = (k) => _farbAbstand(k.rgb, RASEN) >= GRENZE;

    const heimListe = kandidaten(homeClub, ["#1d4ed8", "#ffffff", "#111827"]);
    const heim = heimListe.find(lesbar) || heimListe[0];
    const gastListe = kandidaten(awayClub, ["#ffffff", "#111827", "#f97316", "#7c3aed"]);
    const gast = gastListe.find(k => lesbar(k) && _farbAbstand(k.rgb, heim.rgb) >= GRENZE) || gastListe[0];

    const schrift = (k) => _helligkeit(k.rgb) > 0.6 ? "#0f172a" : "#ffffff";
    const torwartPalette = ["#facc15", "#22d3ee", "#f472b6", "#a3e635", "#fb923c", "#e5e7eb", "#111827"]
        .map(hex => ({ hex, rgb: _hexZuRgb(hex) }));
    const torwartFuer = (eigene, andere, vergeben) => torwartPalette.find(k =>
        _farbAbstand(k.rgb, eigene.rgb) >= GRENZE
        && _farbAbstand(k.rgb, andere.rgb) >= GRENZE
        && _farbAbstand(k.rgb, RASEN) >= 150
        && (!vergeben || _farbAbstand(k.rgb, vergeben.rgb) >= 150)) || torwartPalette[0];
    const twHeim = torwartFuer(heim, gast, null);
    const twGast = torwartFuer(gast, heim, twHeim);

    // Akzentfarbe für Anzeigetafel, Balken und Ticker auf dunklem Grund:
    // Schwarze oder dunkelblaue Trikots wären dort unsichtbar, dann nimmt
    // die Tafel die hellere Vereinsfarbe. Sind sich beide Akzente zu nah,
    // weicht der Gast aus - die Balken müssen auseinanderzuhalten sein.
    const HINTERGRUND = [15, 23, 42];
    const hellGenug = (k) => k && _farbAbstand(k.rgb, HINTERGRUND) >= 190 && _helligkeit(k.rgb) >= 0.3;
    const akzentFuer = (trikot, liste) => hellGenug(trikot) ? trikot
        : (liste.slice(0, 2).find(hellGenug) || { hex: "#cbd5e1", rgb: _hexZuRgb("#cbd5e1") });
    const akzentHeim = akzentFuer(heim, heimListe);
    let akzentGast = akzentFuer(gast, gastListe);
    if (_farbAbstand(akzentGast.rgb, akzentHeim.rgb) < 150) {
        akzentGast = [gastListe[1], ...["#f59e0b", "#e5e7eb", "#38bdf8"].map(hex => ({ hex, rgb: _hexZuRgb(hex) }))]
            .find(k => hellGenug(k) && _farbAbstand(k.rgb, akzentHeim.rgb) >= 150) || akzentGast;
    }
    // Die zweite Vereinsfarbe als Streifen im Farbchip - sofern sie sich abhebt
    const zweitFarbe = (trikot, liste) => (liste.slice(0, 2).find(k => k !== trikot && _farbAbstand(k.rgb, trikot.rgb) >= 120) || { hex: schrift(trikot) }).hex;

    return {
        home: { farbe: heim.hex, text: schrift(heim), tw: twHeim.hex, twText: schrift(twHeim), ausweich: heim !== heimListe[0],
            akzent: akzentHeim.hex, zweit: zweitFarbe(heim, heimListe) },
        away: { farbe: gast.hex, text: schrift(gast), tw: twGast.hex, twText: schrift(twGast), ausweich: gast !== gastListe[0],
            akzent: akzentGast.hex, zweit: zweitFarbe(gast, gastListe) }
    };
}

/**
 * Klasse zur Durchführung der Live 2D Match Simulation (spielt Timeline synchron ab)
 */
class LiveMatch {
    /**
     * @param {Object} [options]
     * @param {"home"|"away"} [options.userSide] Die Mannschaft des Spielers. Alle
     *        Eingriffe von der Seitenlinie gelten ihr - vorher waren sie fest auf
     *        "home" verdrahtet, und wer auswaerts spielte, wechselte beim Gegner.
     * @param {{wechsel?: boolean, taktik?: boolean}} [options.delegation] Was der
     *        Co-Trainer uebernimmt. Ohne Angabe entscheidet der Spieler selbst.
     */
    constructor(match, homeClub, awayClub, allPlayers, options = {}) {
        this.match = match;
        this.homeClub = homeClub;
        this.awayClub = awayClub;
        this.allPlayers = allPlayers;

        this.userSide = (options.userSide === "home" || options.userSide === "away") ? options.userSide : null;
        const del = options.delegation || {};
        this.delegation = {
            wechsel: this.userSide ? !!del.wechsel : true,
            taktik: this.userSide ? !!del.taktik : false
        };

        // Was der Verein vor dem Anpfiff eingestellt hatte. Umstellungen an der
        // Seitenlinie gelten fuer dieses Spiel - wer in der 80. Minute auf
        // "sehr offensiv" stellt, will das nicht fuer den naechsten Spieltag.
        this._vorSpiel = {
            home: { tactics: { ...(homeClub.tactics || {}) }, formation: homeClub.formation },
            away: { tactics: { ...(awayClub.tactics || {}) }, formation: awayClub.formation }
        };

        this.homeLineup = MatchEngine.getCleanLineup(homeClub, allPlayers);
        this.awayLineup = MatchEngine.getCleanLineup(awayClub, allPlayers);
        // Wer von Anfang an spielt - für die Einsatzminuten der Live-Noten
        this._startelf = {
            home: new Set(this.homeLineup.map(p => p.id)),
            away: new Set(this.awayLineup.map(p => p.id))
        };

        if (!match.lineups) {
            match.lineups = {
                home: this.homeLineup.map(p => p.id),
                away: this.awayLineup.map(p => p.id)
            };
        }

        this.minute = 0;
        this.seconds = 0;
        this.extraTime = 0;
        this.homeScore = 0;
        this.awayScore = 0;
        this.isFinished = false;
        this.isPaused = false;
        this.speed = 1;

        // Der Stand an der Seitenlinie. LiveMatch fuehrt ihn selbst, statt die
        // Kaderlisten des Vereins umzuschreiben: Vorher landete ein
        // ausgewechselter Spieler wieder auf der Bank des Vereins - und konnte
        // zurueckgewechselt werden -, und die Einwechslung stand nach dem Spiel
        // dauerhaft in der Stammelf.
        const bankAus = (club, lineup) => (club.bench || [])
            .filter(id => !lineup.some(p => p.id === id))
            .map(id => MatchEngine.findPlayer(allPlayers, id))
            .filter(p => p && (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0)
            .map(p => p.id);
        this.bank = { home: bankAus(homeClub, this.homeLineup), away: bankAus(awayClub, this.awayLineup) };
        this.ausgewechselt = { home: [], away: [] };
        this.platzverweise = { home: [], away: [] };
        this.verwarnt = { home: [], away: [] };
        this.angeschlagen = { home: [], away: [] };
        this.substitutionsUsed = { home: 0, away: 0 };
        this.maxSubstitutions = 5;
        // Fuenf Wechsel in hoechstens drei Unterbrechungen; die Halbzeitpause
        // zaehlt nicht mit.
        this.wechselFenster = { home: 0, away: 0 };
        this.maxWechselFenster = 3;
        this._fensterMinute = { home: null, away: null };
        // Angemeldete Wechsel warten auf die naechste Unterbrechung
        this.angemeldeteWechsel = [];
        // Was die Oberflaeche dem Spieler vorlegen soll (Verletzung, Platzverweis)
        this.offeneEntscheidungen = [];
        // Wer an der Seitenlinie assistiert - und wie gut. Ein Weltklasse-
        // Assistent sieht mehr, reagiert frueher und greift seltener daneben.
        this.coTrainer = { home: this._ermittleCoTrainer(homeClub), away: this._ermittleCoTrainer(awayClub) };
        // Wann der Co-Trainer die Lage prueft, wenn er die Taktik anpassen darf
        const eigenerCo = this.userSide ? this.coTrainer[this.userSide].guete : 60;
        this._coTrainerPunkte = eigenerCo >= 75 ? [50, 55, 60, 66, 72, 78, 84]
            : (eigenerCo >= 50 ? [55, 65, 75, 83] : [62, 78]);
        // Zurufe von der Seitenlinie: [{ side, art, von, bis }]
        this.zurufe = [];
        // Vorgegebene Standardschützen - null heißt: der Beste auf dem Platz
        this.standards = {
            home: { elfmeter: null, ecken: null, freistoss: null, ...MatchEngine.standardsAusRollen(homeClub) },
            away: { elfmeter: null, ecken: null, freistoss: null, ...MatchEngine.standardsAusRollen(awayClub) }
        };

        // Timeline generieren falls noch nicht vorhanden. Eine vorab erzeugte
        // Timeline, in der die Simulation fuer den Spieler wechselt, obwohl er
        // selbst entscheiden will, wird neu gewuerfelt - gespielt ist noch nichts.
        const selbstEntscheiden = this.userSide && !this.delegation.wechsel;
        const fremdeWechsel = selbstEntscheiden && Array.isArray(match.timeline)
            && match.timeline.some(ev => ev.type === "substitution" && ev.team === this.userSide);
        if (!match.timeline || match.timeline.length === 0 || fremdeWechsel) {
            match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, allPlayers,
                this._timelineOptionen(1));
        }
        this.timeline = match.timeline;
        this.timelineIndex = 0;

        const targetPos = this.timeline.possession || [50, 50];

        // Live Stats
        this.stats = {
            possession: [targetPos[0], targetPos[1]],
            possessionTicks: [0, 0],
            shots: [0, 0],
            shotsOnTarget: [0, 0],
            corners: [0, 0],
            fouls: [0, 0],
            yellowCards: [0, 0],
            redCards: [0, 0],
            passAccuracy: [82, 80],
            tacklesWon: [55, 55],
            saves: [0, 0],
            xG: [0.0, 0.0]
        };

        this.events = [];
        // Alles, was abgepfiffen ist, in Spielreihenfolge - der Ticker behält
        // nur die letzten fünfzig Zeilen, Zeitleiste und Druckphasen brauchen
        // die ganze Partie.
        this.verlauf = [];
        this._imVerlauf = new WeakSet();

        // 2D Match Visualizer Zustand
        this.ball = {
            x: 50, y: 50,
            targetX: 50, targetY: 50,
            originX: 50, originY: 50,
            travelDuration: 0.01, travelElapsed: 1,
            distance: 0, height: 0, inFlight: false,
            actionType: "pass",
            holderId: null
        };
        this.ballTrail = [];
        this.activePlayerId = null;
        this.goalFlash = 0;
        this.celebratingTeam = null;
        this.sceneRoles = null;
        this.kits = ermittleTrikots(homeClub, awayClub);
        this.players2D = this.initialize2DPositions();
        // Wer das Feld verlaesst (Platzverweis, Auswechslung), geht noch sichtbar
        // zur Seitenlinie - nur fuer das Bild, in der Simulation ist er weg.
        this.abgaenge = [];
        this.currentPhase = "kickoff";
        this.lastCommentary = "Das Spiel wird angepfiffen!";

        // Regie der 2D-Simulation (Highlights, Ballzirkulation, Laufwege)
        this.director = _LiveMatchDirector ? new _LiveMatchDirector(this) : null;
    }

    /**
     * Aktualisiert die Spielphase anhand der aktuellen Minute (C15)
     */
    updatePhaseLabel() {
        const minute = this.minute;
        if (minute <= 0) {
            this.currentPhase = "kickoff";
        } else if (minute <= 45) {
            this.currentPhase = "first_half";
        } else if (minute <= 47 && this.currentPhase === "first_half") {
            this.currentPhase = "half_time";
        } else if (minute > 45) {
            this.currentPhase = this.isFinished ? "full_time" : "second_half";
        }
    }

    /**
     * Beendet das Spiel, sobald die reguläre Zeit abgelaufen und die Timeline
     * vollständig abgespielt ist.
     */
    checkForFinish() {
        if (this.isFinished) return false;
        if (this.minute >= 90 && this.timelineIndex >= this.timeline.length) {
            // Der Zähler timelineIndex steht auf den Ereignissen, die die Regie
            // in ihre Szene geholt hat - abgespielt sind sie damit noch nicht.
            // Was beim Abpfiff offen ist, wird nachgetragen, sonst zeigte die
            // Live-Statistik am Ende weniger als der Spielbericht.
            if (this.director && typeof this.director.flushScene === "function") {
                this.director.flushScene();
            }
            this.finishMatch();
            return true;
        }
        return false;
    }

    /**
     * Echtzeit-Taktung der 2D-Simulation (wird pro Frame vom UI aufgerufen).
     * Die Spieluhr läuft dabei kontinuierlich weiter und verlangsamt sich
     * während einer Highlight-Szene, damit Minute, Kommentar und Bild
     * zusammenpassen.
     */
    advanceRealTime(realDeltaMs) {
        if (!this.director) {
            // Fallback ohne Regie: klassischer Minutentakt
            this._fallbackAccumulator = (this._fallbackAccumulator || 0) + (realDeltaMs || 0);
            if (this._fallbackAccumulator >= this.getTickIntervalMs()) {
                this._fallbackAccumulator = 0;
                this.tick();
            }
            return;
        }
        if (this.isFinished || this.isPaused) return;
        this.director.advanceRealTime(realDeltaMs);
        this.bewegeAbgaenge(Math.min(0.25, (Number(realDeltaMs) || 0) / 1000));
        this.seitenlinie();
    }

    /**
     * Aktueller Spielstand der Uhr als "45:12"
     */
    getClockText() {
        const mm = String(Math.max(0, this.minute)).padStart(2, "0");
        const ss = String(Math.max(0, Math.floor(this.seconds || 0))).padStart(2, "0");
        return `${mm}:${ss}`;
    }

    getTickIntervalMs() {
        const speeds = (typeof LIVE_MATCH_SPEEDS !== 'undefined' && LIVE_MATCH_SPEEDS)
            ? LIVE_MATCH_SPEEDS
            : ((typeof window !== 'undefined' && window.LIVE_MATCH_SPEEDS) ? window.LIVE_MATCH_SPEEDS : {
                1: { tickIntervalMs: 2200, minuteStep: 1 },
                2: { tickIntervalMs: 1200, minuteStep: 1 },
                4: { tickIntervalMs: 500, minuteStep: 2 },
                slow: { tickIntervalMs: 2200, minuteStep: 1 },
                normal: { tickIntervalMs: 1200, minuteStep: 1 },
                fast: { tickIntervalMs: 500, minuteStep: 2 }
            });

        const cfg = speeds[this.speed] || speeds[1] || { tickIntervalMs: 2200, minuteStep: 1 };
        return cfg.tickIntervalMs || 2200;
    }

    getMinuteStep() {
        const speeds = (typeof LIVE_MATCH_SPEEDS !== 'undefined' && LIVE_MATCH_SPEEDS)
            ? LIVE_MATCH_SPEEDS
            : ((typeof window !== 'undefined' && window.LIVE_MATCH_SPEEDS) ? window.LIVE_MATCH_SPEEDS : null);
        const cfg = (speeds && speeds[this.speed]) ? speeds[this.speed] : { minuteStep: 1 };
        return cfg.minuteStep || 1;
    }

    initialize2DPositions() {
        const formConfigs = (typeof FORMATION_CONFIGS !== 'undefined' && FORMATION_CONFIGS)
            ? FORMATION_CONFIGS
            : ((typeof window !== 'undefined' && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS : (typeof require !== 'undefined' ? require('./gameState.js').FORMATION_CONFIGS : {}));
        const homePositions = (formConfigs && formConfigs[this.homeClub.formation]) ? formConfigs[this.homeClub.formation].positions : (formConfigs && formConfigs["4-4-2"] ? formConfigs["4-4-2"].positions : []);
        const awayPositions = (formConfigs && formConfigs[this.awayClub.formation]) ? formConfigs[this.awayClub.formation].positions : (formConfigs && formConfigs["4-4-2"] ? formConfigs["4-4-2"].positions : []);

        const players = [];

        this.homeLineup.forEach((p, idx) => {
            const slot = homePositions[idx] || { x: 50, y: 90, pos: p.pos };
            const fieldX = Math.max(3, Math.min(48, ((100 - slot.y) / 100) * 44 + 4));
            const fieldY = slot.x;
            players.push({
                id: p.id,
                name: p.name,
                number: idx + 1,
                // Der Platz in der Formation: an ihm haengen die Rollen
                slot: idx,
                // Im 2D-Feld zählt die Position, auf der gespielt wird
                pos: slot.pos || p.pos,
                naturalPos: p.pos,
                team: "home",
                baseX: fieldX,
                baseY: fieldY,
                x: fieldX,
                y: fieldY,
                targetX: fieldX,
                targetY: fieldY,
                pace: p.pace || p.overall || 70,
                stamina: p.stamina || 75,
                // Spielverstaendnis: wie frueh er Ballverlust und Verlagerung liest
                vision: p.vision || p.overall || 65,
                freshness: 1,
                color: this.kits.home.farbe,
                textColor: this.kits.home.text
            });
        });

        this.awayLineup.forEach((p, idx) => {
            const slot = awayPositions[idx] || { x: 50, y: 90, pos: p.pos };
            const fieldX = Math.max(52, Math.min(97, 96 - ((100 - slot.y) / 100) * 44));
            // Die Gaeste spielen nach links: Ihr Linksverteidiger steht auf
            // ihrer linken Seite, also bei hohen y-Werten. Vorher stand er
            // gespiegelt auf der rechten, und "Fokus links" wirkte rechts.
            const fieldY = 100 - slot.x;
            players.push({
                id: p.id,
                name: p.name,
                number: idx + 1,
                slot: idx,
                pos: slot.pos || p.pos,
                naturalPos: p.pos,
                team: "away",
                baseX: fieldX,
                baseY: fieldY,
                x: fieldX,
                y: fieldY,
                targetX: fieldX,
                targetY: fieldY,
                pace: p.pace || p.overall || 70,
                stamina: p.stamina || 75,
                // Spielverstaendnis: wie frueh er Ballverlust und Verlagerung liest
                vision: p.vision || p.overall || 65,
                freshness: 1,
                color: this.kits.away.farbe,
                textColor: this.kits.away.text
            });
        });

        return players;
    }

    /**
     * Resimuliert den verbleibenden Spielverlauf ab der aktuellen Minute (C14)
     */
    resimulateRemainder() {
        const playedEvents = this.timeline.slice(0, this.timelineIndex);
        const startMin = Math.max(1, this.minute + 1);

        // Signatur ist (match, homeClub, awayClub, allPlayers, options) - ohne
        // das Match als erstes Argument lief die Resimulation ins Leere.
        const newRemainder = MatchEngine.generateTimeline(this.match, this.homeClub, this.awayClub, this.allPlayers,
            this._timelineOptionen(startMin));

        this.timeline = [...playedEvents, ...newRemainder];
        this.match.timeline = this.timeline;
    }

    /**
     * Alles, was die Simulation ueber den bisherigen Verlauf wissen muss.
     *
     * Vorher kannte eine Neuberechnung nur die Aufstellung und die Zahl der
     * eigenen Wechsel des Spielers: Die Wechsel der KI zaehlten nicht mit
     * (danach durfte sie noch einmal fuenf), Platzverweisene standen wieder in
     * den Szenen, und Verwarnte bekamen eine zweite "erste" Gelbe.
     */
    _timelineOptionen(startMinute) {
        return {
            startMinute,
            currentHomeScore: this.homeScore || 0,
            currentAwayScore: this.awayScore || 0,
            homeLineup: this.homeLineup,
            awayLineup: this.awayLineup,
            homeBench: this.bank.home.slice(),
            awayBench: this.bank.away.slice(),
            usedSubsHome: this.substitutionsUsed.home,
            usedSubsAway: this.substitutionsUsed.away,
            wechselFensterHome: this.wechselFenster.home,
            wechselFensterAway: this.wechselFenster.away,
            autoWechselHome: this.userSide !== "home" || this.delegation.wechsel,
            autoWechselAway: this.userSide !== "away" || this.delegation.wechsel,
            sentOffIds: [...this.platzverweise.home, ...this.platzverweise.away],
            gelbIds: [...this.verwarnt.home, ...this.verwarnt.away],
            zurufe: (this.zurufe || []).slice(),
            standardsHome: { ...(this.standards?.home || {}) },
            standardsAway: { ...(this.standards?.away || {}) },
            // Ausgewechselt wird, wer muede ist - nach der Simulation, nicht
            // nach der Fitness vor dem Anpfiff
            frische: new Map((this.players2D || []).map(p => [p.id, p.freshness ?? 1])),
            // Wechselt der Co-Trainer fuer den Spieler, zaehlt seine Guete
            wechselGueteHome: this.userSide === "home" && this.delegation?.wechsel ? this.coTrainer?.home?.guete : undefined,
            wechselGueteAway: this.userSide === "away" && this.delegation?.wechsel ? this.coTrainer?.away?.guete : undefined
        };
    }

    // ------------------------------------------------------------ Co-Trainer

    /** Name und Güte des Co-Trainers aus dem Trainerstab des Vereins */
    _ermittleCoTrainer(club) {
        const engine = _stabEngine();
        const stab = engine && typeof engine.staffQuality === "function" ? engine.staffQuality(club) : null;
        const eigen = club?.staff?.cotrainer || null;
        const guete = Math.max(10, Math.min(97, Math.round(stab?.coTrainer ?? stab?.analyse ?? 55)));
        return { name: eigen?.name || null, guete, eigen: !!eigen };
    }

    // ------------------------------------------------------------ Live-Noten

    /**
     * Noten aller Spieler, die bisher auf dem Platz standen - mit derselben
     * Rechnung wie der Spielbericht, nur ohne den Zufall am Ende.
     * @returns {Map<id, {note:number, minuten:number, side:string}>}
     */
    liveNoten() {
        const stats = new Map();
        const leer = () => ({ goals: 0, assists: 0, saves: 0, tackles: 0, chancen: 0, aufsTor: 0, fouls: 0,
            yellowCards: 0, redCards: 0, hasSecondYellow: false, penaltySaved: false,
            rein: null, raus: null, runter: null });
        const von = (id) => {
            if (id === null || id === undefined) return null;
            if (!stats.has(id)) stats.set(id, leer());
            return stats.get(id);
        };
        (this.verlauf || []).forEach(e => {
            switch (e.type) {
                case "goal":
                    if (von(e.playerId)) von(e.playerId).goals++;
                    if (von(e.assistId)) von(e.assistId).assists++;
                    break;
                case "save":
                    if (von(e.gkId)) {
                        von(e.gkId).saves++;
                        if (e.ausgang === "penalty_saved") von(e.gkId).penaltySaved = true;
                    }
                    if (von(e.schuetzeId)) von(e.schuetzeId).aufsTor++;
                    break;
                case "corner": case "cross": case "through_ball":
                    if (von(e.vonId)) von(e.vonId).chancen++;
                    break;
                case "dribble":
                    if (von(e.zuId)) von(e.zuId).chancen++;
                    break;
                case "tackle":
                    if (von(e.playerId)) von(e.playerId).tackles++;
                    break;
                case "foul":
                    if (von(e.playerId)) von(e.playerId).fouls++;
                    break;
                case "yellow_card":
                    if (von(e.playerId)) {
                        von(e.playerId).yellowCards++;
                        if (e.zweiteGelbe) { von(e.playerId).redCards++; von(e.playerId).hasSecondYellow = true; von(e.playerId).runter = e.minute; }
                    }
                    break;
                case "red_card":
                    if (von(e.playerId)) { von(e.playerId).redCards++; von(e.playerId).runter = e.minute; }
                    break;
                case "substitution":
                    if (von(e.playerId)) von(e.playerId).rein = e.minute;
                    if (von(e.outId)) von(e.outId).raus = e.minute;
                    break;
                default:
            }
        });

        const jetzt = Math.max(0, this.minute || 0);
        const noten = new Map();
        ["home", "away"].forEach(side => {
            const eigene = side === "home" ? this.homeScore : this.awayScore;
            const fremde = side === "home" ? this.awayScore : this.homeScore;
            const ids = new Set([...this.lineupVon(side).filter(Boolean).map(p => p.id), ...this.ausgewechselt[side]]);
            ids.forEach(id => {
                const p = MatchEngine.findPlayer(this.allPlayers, id);
                if (!p) return;
                const st = stats.get(id) || leer();
                const anfang = this._startelf?.[side]?.has(id) ? 0 : (st.rein ?? null);
                if (anfang === null) return;
                const ende = Math.min(jetzt, st.raus ?? jetzt, st.runter ?? jetzt);
                const minuten = Math.max(0, ende - anfang);
                noten.set(id, {
                    note: MatchEngine.noteBerechnen(st, { pos: p.pos, minutes: minuten, teamGoals: eigene, oppGoals: fremde }),
                    minuten,
                    side
                });
            });
        });
        return noten;
    }

    // --------------------------------------------------------- Gegneranalyse

    /**
     * Wie der Gegner spielt: über welche Seite er kommt, womit und wer bei
     * ihm gefährlich ist. "Links" ist seine linke Seite in Angriffsrichtung -
     * bei uns ist das rechts.
     */
    gegnerAnalyse(teamType) {
        const side = this.seiteVon(teamType);
        const gegner = side === "home" ? "away" : "home";
        // In der Zeitleiste greift die Heimmannschaft nach rechts an; ihre
        // linke Seite liegt dort oben (kleines y).
        const heimRichtung = gegner === "home";
        const seiteAus = (y) => {
            if (typeof y !== "number") return null;
            if (y < 36) return heimRichtung ? "links" : "rechts";
            if (y > 64) return heimRichtung ? "rechts" : "links";
            return "mitte";
        };
        const seiten = { links: 0, mitte: 0, rechts: 0 };
        const arten = { through_ball: 0, cross: 0, dribble: 0, corner: 0, freistoss: 0 };
        const spieler = new Map();
        const eintrag = (id, name) => {
            if (id === null || id === undefined) return null;
            if (!spieler.has(id)) spieler.set(id, { id, name: name || MatchEngine.findPlayer(this.allPlayers, id)?.name || "?", schuesse: 0, tore: 0, chancen: 0 });
            return spieler.get(id);
        };
        let angriffe = 0;
        let schuesse = 0;

        (this.verlauf || []).forEach(e => {
            if (["through_ball", "cross", "dribble"].includes(e.type) && e.team === gegner) {
                angriffe++;
                arten[e.type]++;
                const s = seiteAus(e.y);
                if (s) seiten[s]++;
                const vorbereiter = e.type === "dribble" ? e.zuId : e.vonId;
                if (eintrag(vorbereiter)) eintrag(vorbereiter).chancen++;
            } else if (e.type === "corner" && e.team === gegner) {
                arten.corner++;
            } else if ((e.type === "goal" || e.type === "shot_miss") && e.team === gegner) {
                schuesse++;
                if (e.freistoss) arten.freistoss++;
                const p = eintrag(e.playerId, e.name);
                if (p) { p.schuesse++; if (e.type === "goal") p.tore++; }
            } else if (e.type === "save" && e.team === side) {
                schuesse++;
                if (e.freistoss) arten.freistoss++;
                const p = eintrag(e.schuetzeId, e.schuetzeName);
                if (p) p.schuesse++;
            }
        });

        const flanke = seiten.links + seiten.rechts + seiten.mitte;
        const anteil = (n) => flanke > 0 ? Math.round(n / flanke * 100) : 0;
        const rangfolge = Object.entries(seiten).sort((a, b) => b[1] - a[1]);
        const hauptSeite = flanke >= 4 && rangfolge[0][1] / flanke >= 0.42 ? rangfolge[0][0] : null;
        const titel = { through_ball: "Steilpässe", cross: "Flanken", dribble: "Dribblings", corner: "Ecken", freistoss: "Freistöße" };
        const artenListe = Object.entries(arten)
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([art, anzahl]) => ({ art, anzahl, titel: titel[art] }));
        const gefaehrlich = [...spieler.values()]
            .map(p => ({ ...p, gefahr: p.tore * 3 + p.schuesse + p.chancen * 0.7 }))
            .filter(p => p.gefahr > 0)
            .sort((a, b) => b.gefahr - a.gefahr)
            .slice(0, 3);

        const unsereSeite = { links: "rechts", rechts: "links", mitte: "in der Mitte" };
        const empfehlungen = [];
        if (hauptSeite && hauptSeite !== "mitte") {
            const seine = hauptSeite === "links" ? "linke" : "rechte";
            empfehlungen.push(`Er kommt vor allem über seine ${seine} Seite (${anteil(seiten[hauptSeite])} %) - bei uns ${unsereSeite[hauptSeite]}. Dort doppeln oder den Außenverteidiger defensiver stellen.`);
        } else if (hauptSeite === "mitte") {
            empfehlungen.push(`Er sucht den Weg durch die Mitte (${anteil(seiten.mitte)} %) - die Zentrale dicht machen, ein zusätzlicher Sechser hilft.`);
        }
        const erste = artenListe.find(a => a.art !== "corner" && a.art !== "freistoss");
        if (erste && erste.anzahl >= 3) {
            if (erste.art === "cross") empfehlungen.push("Viele Flanken: tiefer verteidigen und die Kopfballduelle annehmen.");
            else if (erste.art === "through_ball") empfehlungen.push("Viele Steilpässe in die Spitze: die Abwehrkette nicht zu hoch stehen lassen.");
            else if (erste.art === "dribble") empfehlungen.push("Er sucht das Eins-gegen-eins: früh stören, höheres Pressing.");
        }
        if (gefaehrlich[0] && gefaehrlich[0].gefahr >= 3) {
            empfehlungen.push(`${gefaehrlich[0].name} ist sein gefährlichster Mann - enger decken.`);
        }

        return {
            angriffe,
            schuesse,
            seiten,
            anteile: { links: anteil(seiten.links), mitte: anteil(seiten.mitte), rechts: anteil(seiten.rechts) },
            hauptSeite,
            arten: artenListe,
            gefaehrlich,
            empfehlungen,
            genugGesehen: angriffe >= 3 || angriffe + schuesse >= 5
        };
    }

    // ---------------------------------------------------------------- Zurufe

    /** Was ein Zuruf gerade bewirkt und wann der nächste möglich ist */
    zurufStand(teamType) {
        const side = this.seiteVon(teamType);
        const eigene = (this.zurufe || []).filter(z => z.side === side);
        const letzter = eigene[eigene.length - 1] || null;
        const aktiv = letzter && this.minute <= letzter.bis ? letzter : null;
        const wiederAb = letzter ? letzter.bis + MATCH_TUNING.zurufPause : 0;
        return {
            aktiv,
            art: aktiv ? aktiv.art : null,
            restMinuten: aktiv ? Math.max(0, letzter.bis - this.minute) : 0,
            wiederAb,
            bereit: !aktiv && this.minute >= wiederAb && !this.isFinished
        };
    }

    /**
     * Ein Zuruf von der Seitenlinie - ohne Pause, mit Wirkung für zehn
     * Minuten. Danach braucht die Mannschaft eine Weile, bevor der nächste
     * ankommt: Wer ununterbrochen brüllt, wird nicht mehr gehört.
     */
    zuruf(teamType, art) {
        const side = this.seiteVon(teamType);
        const def = ZURUFE[art];
        if (!def) return { success: false, message: "Unbekannter Zuruf." };
        if (this.isFinished) return { success: false, message: "Das Spiel ist vorbei." };
        const stand = this.zurufStand(side);
        if (stand.aktiv) return { success: false, message: `"${ZURUFE[stand.art].titel}" wirkt noch ${stand.restMinuten} Minuten.` };
        if (!stand.bereit) return { success: false, message: `Die Mannschaft hört erst ab der ${stand.wiederAb}. Minute wieder hin.` };

        const von = Math.max(1, this.minute + 1);
        this.zurufe.push({ side, art, von, bis: Math.min(95, von + MATCH_TUNING.zurufDauer - 1) });
        const club = this.clubVon(side);
        const text = `${this.minute}' - 📣 ${club.name}: "${def.titel}" von der Seitenlinie.`;
        this.addEvent("zuruf", club.id, text);
        this.lastCommentary = text;
        this.resimulateRemainder();
        return { success: true, message: def.text, art };
    }

    // -------------------------------------------------------- Standardschützen

    /** Wer gerade einen Standard treten würde - vorgegeben oder der Beste */
    standardSchuetzen(teamType) {
        const side = this.seiteVon(teamType);
        const imSpiel = this.aufDemPlatz(side);
        const vorgabe = this.standards?.[side] || {};
        const ergebnis = {};
        ["elfmeter", "freistoss", "ecken"].forEach(art => {
            const p = MatchEngine.standardSchuetze(art, imSpiel, vorgabe[art]);
            ergebnis[art] = p ? {
                id: p.id, name: p.name, wert: Math.round(MatchEngine.standardWert(art, p)),
                vorgegeben: vorgabe[art] !== null && vorgabe[art] !== undefined && p.id === vorgabe[art]
            } : null;
        });
        return ergebnis;
    }

    setzeStandards(teamType, neu = {}, opts = {}) {
        const side = this.seiteVon(teamType);
        const alt = this.standards[side];
        let geaendert = false;
        ["elfmeter", "freistoss", "ecken"].forEach(art => {
            if (!(art in neu)) return;
            const wert = neu[art] === undefined ? null : neu[art];
            if (wert !== null && !this.aufDemPlatz(side).some(p => p.id === wert)) return;
            if (alt[art] !== wert) { alt[art] = wert; geaendert = true; }
        });
        if (geaendert && !opts.ohneNeuberechnung) this.resimulateRemainder();
        return geaendert;
    }

    // ----------------------------------------------------------- Positionen

    /**
     * Zwei Spieler tauschen ihre Positionen - der Flügelspieler rückt ins
     * Zentrum, ohne dass die ganze Formation umgestellt werden muss.
     */
    tauschePositionen(teamType, idA, idB, opts = {}) {
        const side = this.seiteVon(teamType);
        const lineup = this.lineupVon(side);
        const iA = lineup.findIndex(p => p && p.id === idA);
        const iB = lineup.findIndex(p => p && p.id === idB);
        if (iA < 0 || iB < 0 || iA === iB) return { success: false, message: "Beide Spieler müssen auf dem Platz stehen." };
        const raus = new Set(this.platzverweise[side]);
        if (raus.has(idA) || raus.has(idB)) return { success: false, message: "Ein vom Platz gestellter Spieler hat keine Position mehr." };
        const pa = this.players2D.find(p => p.id === idA);
        const pb = this.players2D.find(p => p.id === idB);
        const posA = pa?.pos || lineup[iA].pos;
        const posB = pb?.pos || lineup[iB].pos;
        if ((posA === "TW") !== (posB === "TW")) return { success: false, message: "Der Torwart bleibt im Tor." };

        const a = lineup[iA];
        const b = lineup[iB];
        lineup[iA] = b;
        lineup[iB] = a;
        if (pa && pb) {
            [pa.baseX, pb.baseX] = [pb.baseX, pa.baseX];
            [pa.baseY, pb.baseY] = [pb.baseY, pa.baseY];
            [pa.pos, pb.pos] = [pb.pos, pa.pos];
            [pa.slot, pb.slot] = [pb.slot, pa.slot];
        }
        if (this.director) this.director.initPlayers();

        const club = this.clubVon(side);
        const text = `${this.minute}' - 🔀 ${club.name}: ${a.name} (jetzt ${posB}) und ${b.name} (jetzt ${posA}) tauschen die Positionen.`;
        this.addEvent("tactics", club.id, text);
        this.lastCommentary = text;
        if (!opts.ohneNeuberechnung) this.resimulateRemainder();
        return { success: true, message: text };
    }

    // ---------------------------------------------------------- Seitenlinie

    seiteVon(team) {
        return team === "away" ? "away" : "home";
    }

    clubVon(side) {
        return side === "away" ? this.awayClub : this.homeClub;
    }

    lineupVon(side) {
        return side === "away" ? this.awayLineup : this.homeLineup;
    }

    /** Wer von dieser Seite gerade auf dem Platz steht (ohne Platzverweise) */
    aufDemPlatz(side) {
        const raus = new Set(this.platzverweise[side]);
        return this.lineupVon(side).filter(p => p && !raus.has(p.id));
    }

    /** Wer von der Bank noch kommen darf */
    bankSpieler(side) {
        return this.bank[side]
            .map(id => MatchEngine.findPlayer(this.allPlayers, id))
            .filter(Boolean);
    }

    /**
     * Ist gerade Halbzeitpause? Wechsel dort kosten keine Unterbrechung.
     *
     * Mit Regie zaehlt allein die Aufstellung zum Wiederanpfiff: Die Phase
     * "half_time" setzt das Halbzeit-Ereignis, und im Echtzeitbetrieb setzt
     * sie niemand zurueck - daran gemessen waere die ganze zweite Halbzeit
     * eine Pause gewesen, und keine Unterbrechung haette mehr gezaehlt.
     */
    istHalbzeitpause() {
        if (this.director) return this.director.kickoff?.reason === "halftime";
        return this.currentPhase === "half_time";
    }

    /** Wie viele Wechsel und Unterbrechungen einer Seite noch bleiben */
    wechselStand(side) {
        const angemeldet = this.angemeldeteWechsel.filter(w => w.side === side).length;
        return {
            genutzt: this.substitutionsUsed[side],
            angemeldet,
            frei: Math.max(0, this.maxSubstitutions - this.substitutionsUsed[side] - angemeldet),
            fensterGenutzt: this.wechselFenster[side],
            fensterFrei: Math.max(0, this.maxWechselFenster - this.wechselFenster[side])
        };
    }

    /**
     * Klassischer Minutentakt (Sofortmodus, Tests und Fallback ohne Regie).
     * Springt um einen kompletten Minutenschritt nach vorne und löst alle
     * fälligen Timeline-Ereignisse unmittelbar auf.
     */
    tick() {
        if (this.isFinished || this.isPaused) return;

        const minuteStep = this.getMinuteStep();

        if (this.director) {
            this.director.advanceMatchSeconds(minuteStep * 60);
            this.seitenlinie();
            return;
        }

        this.minute += minuteStep;
        this.updatePhaseLabel();

        let processedEventsCount = 0;
        const maxEventsPerTick = 3;

        while (this.timelineIndex < this.timeline.length && processedEventsCount < maxEventsPerTick) {
            const ev = this.timeline[this.timelineIndex];
            if (ev.minute > this.minute) break;

            this.processEvent(ev);
            this.timelineIndex++;
            processedEventsCount++;
        }

        this.checkForFinish();
    }

    processEvent(ev) {
        this._protokolliere(ev);
        if (ev.type === "goal") {
            if (ev.team === "home") {
                this.homeScore++;
                this.stats.shotsOnTarget[0]++;
                this.stats.shots[0]++;
                this.stats.xG[0] = parseFloat((this.stats.xG[0] + (ev.xG || 0.3)).toFixed(2));
                this.celebratingTeam = "home";
            } else {
                this.awayScore++;
                this.stats.shotsOnTarget[1]++;
                this.stats.shots[1]++;
                this.stats.xG[1] = parseFloat((this.stats.xG[1] + (ev.xG || 0.3)).toFixed(2));
                this.celebratingTeam = "away";
            }
            this.goalFlash = 1.0;
            this.lastScorerName = ev.playerName || null;
            this.lastAssistName = ev.assistName || null;
            this.addEvent("goal", ev.clubId, ev.text);
        } else if (ev.type === "save") {
            if (ev.team === "away") {
                this.stats.shotsOnTarget[0]++;
                this.stats.shots[0]++;
                this.stats.xG[0] = parseFloat((this.stats.xG[0] + (ev.xG || 0.15)).toFixed(2));
                this.stats.saves[1]++;
            } else {
                this.stats.shotsOnTarget[1]++;
                this.stats.shots[1]++;
                this.stats.xG[1] = parseFloat((this.stats.xG[1] + (ev.xG || 0.15)).toFixed(2));
                this.stats.saves[0]++;
            }
            this.addEvent("save", ev.clubId, ev.text);
        } else if (ev.type === "shot_miss") {
            if (ev.team === "home") {
                this.stats.shots[0]++;
                this.stats.xG[0] = parseFloat((this.stats.xG[0] + (ev.xG || 0.1)).toFixed(2));
            } else {
                this.stats.shots[1]++;
                this.stats.xG[1] = parseFloat((this.stats.xG[1] + (ev.xG || 0.1)).toFixed(2));
            }
            this.addEvent("shot_miss", ev.clubId, ev.text);
        } else if (ev.type === "corner") {
            if (ev.team === "home") this.stats.corners[0]++; else this.stats.corners[1]++;
            this.addEvent("corner", ev.clubId, ev.text);
        } else if (ev.type === "foul") {
            if (ev.team === "home") this.stats.fouls[0]++; else this.stats.fouls[1]++;
            this.addEvent("foul", ev.clubId, ev.text);
        } else if (ev.type === "yellow_card") {
            // Gelb-Rot ist auch ein Platzverweis. Der Spielbericht zählt ihn
            // seit jeher mit, die Live-Anzeige nicht - dadurch stand am Ende
            // eines Spiels mit Ampelkarte "Rote Karten 0" auf der Tafel und
            // "1" im Bericht.
            const seite = ev.team === "home" ? 0 : 1;
            this.stats.fouls[seite]++;
            this.stats.yellowCards[seite]++;
            if (ev.isSecondYellow) this.stats.redCards[seite]++;
            this.addEvent("yellow_card", ev.clubId, ev.text);

            // Verwarnung merken - beim Neuberechnen und fuer den Co-Trainer.
            // Gelb-Rot schickt den Spieler vom Platz, auch auf dem Bild.
            const kartenSeite = this.seiteVon(ev.team);
            if (ev.isSecondYellow) {
                this._platzverweis(kartenSeite, ev.playerId, ev.playerName);
            } else if (ev.playerId && !this.verwarnt[kartenSeite].includes(ev.playerId)) {
                this.verwarnt[kartenSeite].push(ev.playerId);
            }
        } else if (ev.type === "red_card") {
            if (ev.team === "home") { this.stats.fouls[0]++; this.stats.redCards[0]++; }
            else { this.stats.fouls[1]++; this.stats.redCards[1]++; }
            this.addEvent("red_card", ev.clubId, ev.text);
            // Vorher lief der Platzverwiesene auf dem Bild weiter - es blieb
            // bis zum Abpfiff elf gegen elf.
            this._platzverweis(this.seiteVon(ev.team), ev.playerId, ev.playerName);
        } else if (ev.type === "injury") {
            this.addEvent("injury", ev.clubId, ev.text);
            this._verletzung(ev);
        } else if (ev.type === "substitution") {
            // Vorher gab es nur die Einblendung - auf dem Platz lief der
            // Ausgewechselte weiter, und die Bank kannte den Wechsel nicht.
            // Ein Wechsel, der nicht mehr geht (der Spieler sah inzwischen
            // Rot), erscheint weder im Ticker noch auf der Zeitleiste.
            if (!this._timelineWechsel(ev)) return;
            this._protokolliere(ev, true);
            this.addEvent("sub", ev.clubId, ev.text);
        } else if (ev.type === "halftime") {
            this.currentPhase = "half_time";
        } else if (ev.type === "fulltime") {
            this.currentPhase = "full_time";
        }

        // Die Ballführung übernimmt der LiveMatchDirector; ohne Regie wird
        // der Ball direkt auf den Zielpunkt gesetzt.
        if (!this.director && ev.start && ev.end) {
            this.ball.targetX = ev.end.x;
            this.ball.targetY = ev.end.y;
            this.ball.originX = ev.end.x;
            this.ball.originY = ev.end.y;
            this.ball.x = ev.end.x;
            this.ball.y = ev.end.y;
            this.ball.actionType = (ev.type === "goal" || ev.type === "save" || ev.type === "shot_miss") ? "shot" : "pass";
        }

        if (ev.fromPlayerId) this.activePlayerId = ev.fromPlayerId;
        else if (ev.playerId) this.activePlayerId = ev.playerId;

        if (ev.text) {
            this.lastCommentary = ev.text;
        }
    }

    /**
     * Haelt ein abgespieltes Ereignis im Verlauf fest - einmal pro Ereignis,
     * auch wenn es auf zwei Wegen (Szene, Sofortmodus) ankommt.
     */
    _protokolliere(ev, wechselAusgefuehrt = false) {
        if (!ev || !ev.type || ev.type === "halftime" || ev.type === "fulltime") return;
        if (ev.type === "substitution" && !wechselAusgefuehrt) return;
        if (this._imVerlauf.has(ev)) return;
        this._imVerlauf.add(ev);
        const team = (ev.team === "home" || ev.team === "away") ? ev.team
            : (ev.clubId != null && ev.clubId === this.homeClub?.id ? "home"
                : (ev.clubId != null && ev.clubId === this.awayClub?.id ? "away" : null));
        this.verlauf.push({
            minute: Math.max(0, Number.isFinite(ev.minute) ? ev.minute : (this.minute || 0)),
            type: ev.type,
            team,
            playerId: ev.playerId ?? ev.playerInId ?? null,
            name: ev.playerName || ev.playerInName || null,
            outId: ev.playerOutId ?? null,
            outName: ev.playerOutName || null,
            zweiteGelbe: !!ev.isSecondYellow,
            elfmeter: ev.type === "goal" && !!ev.isPenalty,
            // Für Live-Noten und Gegneranalyse
            assistId: ev.assistId ?? null,
            gkId: ev.gkId ?? null,
            vonId: ev.fromPlayerId ?? null,
            zuId: ev.toPlayerId ?? null,
            schuetzeId: ev.shooterId ?? null,
            schuetzeName: ev.shooterName || null,
            ausgang: ev.outcome || null,
            freistoss: !!ev.isFreekick,
            x: typeof ev.start?.x === "number" ? ev.start.x : null,
            y: typeof ev.start?.y === "number" ? ev.start.y : null
        });
    }

    addEvent(type, clubId, text) {
        // Fortlaufende Nummer, damit die Oberfläche neue Einträge auch dann
        // erkennt, wenn die Liste bereits ihre Maximallänge erreicht hat.
        this.eventSeq = (this.eventSeq || 0) + 1;

        this.events.unshift({
            seq: this.eventSeq,
            minute: this.minute,
            type,
            clubId,
            text
        });
        if (this.events.length > 50) this.events.pop();
    }

    /**
     * Bewegt Ball und Spieler weich weiter (wird pro Frame aufgerufen).
     * Ohne Delta-Zeit wird ein Standardschritt von 100 ms angenommen,
     * damit Sofortsimulation und Tests weiterhin funktionieren.
     */
    updateBallAndPlayers(deltaMs) {
        if (this.director) {
            this.director.updateMotion(deltaMs);
            return;
        }

        // Fallback ohne Regie: einfache Interpolation
        const dt = (typeof deltaMs === "number" && deltaMs > 0) ? Math.min(0.1, deltaMs / 1000) : 0.1;

        this.ball.x += (this.ball.targetX - this.ball.x) * Math.min(1, dt * 8);
        this.ball.y += (this.ball.targetY - this.ball.y) * Math.min(1, dt * 8);

        const ballShiftX = (this.ball.x - 50) * 0.85;
        const ballShiftY = (this.ball.y - 50) * 0.35;

        this.players2D.forEach(p => {
            if (p.pos === "TW") {
                p.targetX = p.baseX + ballShiftX * 0.15;
                p.targetY = p.baseY + ballShiftY * 0.4;
            } else {
                p.targetX = Math.max(2, Math.min(98, p.baseX + ballShiftX));
                p.targetY = Math.max(2, Math.min(98, p.baseY + ballShiftY));
            }
            const lerp = Math.min(1, dt * 7);
            p.x += (p.targetX - p.x) * lerp;
            p.y += (p.targetY - p.y) * lerp;
        });

        if (this.goalFlash > 0) this.goalFlash = Math.max(0, this.goalFlash - dt * 1.4);
    }

    /**
     * Prueft einen Wechsel gegen die Regeln, ohne ihn auszufuehren.
     * @returns {{ok: boolean, grund?: string, playerOut?: Object, playerIn?: Object}}
     */
    pruefeWechsel(teamType, playerOutId, playerInId, { fensterNoetig = true, mitAngemeldeten = false } = {}) {
        const side = this.seiteVon(teamType);
        const angemeldet = mitAngemeldeten ? this.angemeldeteWechsel.filter(w => w.side === side).length : 0;
        if (this.substitutionsUsed[side] + angemeldet >= this.maxSubstitutions) {
            return { ok: false, grund: `Alle ${this.maxSubstitutions} Wechsel sind aufgebraucht.` };
        }
        if (fensterNoetig && !this.istHalbzeitpause()
            && this.wechselFenster[side] >= this.maxWechselFenster
            && this._fensterMinute[side] !== this.minute) {
            return { ok: false, grund: "Alle drei Unterbrechungen für Wechsel sind genutzt." };
        }
        if (this.platzverweise[side].includes(playerOutId)) {
            return { ok: false, grund: "Ein vom Platz gestellter Spieler kann nicht ausgewechselt werden." };
        }
        const playerOut = this.lineupVon(side).find(p => p && p.id === playerOutId);
        if (!playerOut) {
            return { ok: false, grund: "Dieser Spieler steht nicht auf dem Platz." };
        }
        if (this.ausgewechselt[side].includes(playerInId)) {
            return { ok: false, grund: "Ein ausgewechselter Spieler darf nicht zurück." };
        }
        if (!this.bank[side].includes(playerInId)) {
            return { ok: false, grund: "Dieser Spieler sitzt nicht auf der Bank." };
        }
        const playerIn = MatchEngine.findPlayer(this.allPlayers, playerInId);
        if (!playerIn) return { ok: false, grund: "Einzuwechselnder Spieler nicht gefunden." };
        if (mitAngemeldeten && this.angemeldeteWechsel.some(w => w.side === side && (w.outId === playerOutId || w.inId === playerInId))) {
            return { ok: false, grund: "Für diesen Spieler ist schon ein Wechsel angemeldet." };
        }
        return { ok: true, playerOut, playerIn };
    }

    /**
     * Wechsel sofort ausfuehren. Die Oberflaeche meldet Wechsel an
     * (wechselAnmelden) - sie laufen dann bei der naechsten Unterbrechung.
     */
    substitute(teamType, playerOutId, playerInId, opts = {}) {
        const side = this.seiteVon(teamType);
        const pruefung = this.pruefeWechsel(side, playerOutId, playerInId, { fensterNoetig: !opts.imFenster });
        if (!pruefung.ok) return { success: false, message: pruefung.grund };
        const { playerOut, playerIn } = pruefung;
        const club = this.clubVon(side);

        this._wechsleEin(side, playerOut, playerIn);
        if (!opts.imFenster) this._belegeFenster(side);

        const eventText = formatCommentary("substitution", {
            minute: this.minute,
            club: club.name,
            playerIn: playerIn.name,
            playerOut: playerOut?.name || "Spieler"
        });

        // Der Wechsel gehoert in die Timeline. Vorher stand er nur im Ticker:
        // Im Spielbericht hatte der Eingewechselte null Minuten und keine
        // Note, der Ausgewechselte neunzig.
        const ev = {
            minute: this.minute,
            second: Math.floor(this.seconds || 0),
            type: "substitution",
            team: side,
            clubId: club.id,
            clubName: club.name,
            playerOutId: playerOut.id,
            playerOutName: playerOut.name,
            playerInId: playerIn.id,
            playerInName: playerIn.name,
            text: eventText,
            vonDerSeitenlinie: true,
            _angewendet: true,
            _resolved: true
        };
        this.timeline.splice(this.timelineIndex, 0, ev);
        this.timelineIndex++;
        // Am Ereignisweg vorbei - also selbst in den Verlauf schreiben
        this._protokolliere(ev, true);

        this.addEvent("sub", club.id, eventText);
        this.lastCommentary = eventText;
        if (this.director && typeof this.director.bannerForEvent === "function") {
            this.director.bannerForEvent(ev);
        }

        // Re-simuliere den verbleibenden Spielverlauf mit der neuen Elf (C14)
        if (!opts.ohneNeuberechnung) this.resimulateRemainder();

        return { success: true, message: `Auswechslung: ${playerIn.name} für ${playerOut?.name}` };
    }

    /**
     * Einen Wechsel anmelden. Er wird bei der naechsten Unterbrechung
     * ausgefuehrt - wie im echten Spiel, wo der vierte Offizielle die Tafel
     * erst hebt, wenn der Ball ruht. So platzt er auch nicht in eine laufende
     * Szene, deren Ereignisse den ausgewechselten Spieler noch brauchen.
     */
    wechselAnmelden(teamType, playerOutId, playerInId) {
        const side = this.seiteVon(teamType);
        const pruefung = this.pruefeWechsel(side, playerOutId, playerInId, { mitAngemeldeten: true });
        if (!pruefung.ok) return { success: false, message: pruefung.grund };
        this.angemeldeteWechsel.push({
            side, outId: playerOutId, inId: playerInId,
            seitUhr: this.director ? this.director.clock : this.minute * 60
        });
        return { success: true, message: `Wechsel angemeldet: ${pruefung.playerIn.name} für ${pruefung.playerOut.name}` };
    }

    wechselAbmelden(teamType, playerOutId) {
        const side = this.seiteVon(teamType);
        const vorher = this.angemeldeteWechsel.length;
        this.angemeldeteWechsel = this.angemeldeteWechsel.filter(w => !(w.side === side && w.outId === playerOutId));
        return this.angemeldeteWechsel.length < vorher;
    }

    /**
     * Ist jetzt Gelegenheit fuer angemeldete Wechsel? Der Ball muss ruhen, und
     * es darf keine Szene laufen. Wartet ein Wechsel laenger als eine halbe
     * Spielminute, reicht eine Phase ohne Szene - sonst stuende der Spieler
     * bei einem langen Ballbesitz minutenlang an der Linie.
     */
    wechselGelegenheit() {
        if (this.angemeldeteWechsel.length === 0) return false;
        const d = this.director;
        if (!d) return true;
        if (d.scene || d.mode === "highlight" || d.mode === "celebration") return false;
        if (d.kickoff || d.deadBall) return true;
        const aelteste = Math.min(...this.angemeldeteWechsel.map(w => w.seitUhr));
        return (d.clock - aelteste) >= 30;
    }

    /** Fuehrt alle angemeldeten Wechsel aus - je Seite in einer Unterbrechung */
    fuehreAngemeldeteWechselAus() {
        if (this.angemeldeteWechsel.length === 0) return [];
        const offen = this.angemeldeteWechsel;
        this.angemeldeteWechsel = [];
        const ergebnisse = [];
        const seiten = new Set();
        offen.forEach(w => {
            const r = this.substitute(w.side, w.outId, w.inId, { imFenster: true, ohneNeuberechnung: true });
            ergebnisse.push({ ...w, ...r });
            if (r.success) seiten.add(w.side);
        });
        seiten.forEach(side => this._belegeFenster(side));
        if (seiten.size > 0) this.resimulateRemainder();
        return ergebnisse;
    }

    _belegeFenster(side) {
        if (this.istHalbzeitpause()) return;
        if (this._fensterMinute[side] !== this.minute) this.wechselFenster[side]++;
        this._fensterMinute[side] = this.minute;
    }

    /** Tauscht einen Spieler in Aufstellung, Bank und auf dem Feld */
    _wechsleEin(side, playerOut, playerIn) {
        const lineup = this.lineupVon(side);
        const idx = lineup.findIndex(p => p && p.id === playerOut.id);
        if (idx === -1) return false;
        lineup[idx] = playerIn;
        this.bank[side] = this.bank[side].filter(id => id !== playerIn.id);
        if (!this.ausgewechselt[side].includes(playerOut.id)) this.ausgewechselt[side].push(playerOut.id);
        this.angeschlagen[side] = this.angeschlagen[side].filter(id => id !== playerOut.id);
        this.verwarnt[side] = this.verwarnt[side].filter(id => id !== playerOut.id);
        this.substitutionsUsed[side]++;
        this.offeneEntscheidungen = this.offeneEntscheidungen.filter(e => e.spielerId !== playerOut.id);

        const p2d = this.players2D.find(p => p.id === playerOut.id);
        if (p2d) {
            // Der Ausgewechselte verlaesst das Feld an der naechsten Linie,
            // der Neue kommt an der Mittellinie herein.
            this._abgang(p2d);
            p2d.id = playerIn.id;
            p2d.name = playerIn.name;
            // Der Slot auf dem Feld bleibt bestehen, nur der Spieler wechselt
            p2d.naturalPos = playerIn.pos;
            p2d.pace = playerIn.pace || playerIn.overall || 70;
            p2d.stamina = playerIn.stamina || 75;
            p2d.vision = playerIn.vision || playerIn.overall || 65;
            // Ein eingewechselter Spieler kommt frisch aufs Feld
            p2d.freshness = 1;
            p2d.verletzt = false;
            // An der Mittellinie, auf der Seitenlinie - genau dort, wo die
            // Regie Spieler im Feld haelt (3..97). Weiter draussen haette sie
            // ihn im naechsten Bild hereingeschoben: ein Sprung.
            p2d.x = 50;
            p2d.y = p2d.y < 50 ? 3 : 97;
            if (this.director) this.director.initPlayers();
        }
        return true;
    }

    _abgang(p2d) {
        if (!p2d) return;
        this.abgaenge.push({
            name: p2d.name, number: p2d.number, team: p2d.team, pos: p2d.pos,
            color: p2d.color, textColor: p2d.textColor,
            x: p2d.x, y: p2d.y,
            zielX: p2d.x, zielY: p2d.y < 50 ? -3 : 103,
            rest: 8
        });
    }

    /** Die Abgaenge laufen zur Linie und verschwinden dort */
    bewegeAbgaenge(dt) {
        if (!this.abgaenge || this.abgaenge.length === 0) return;
        const schritt = 3.2 * (this.director ? this.director.getMotionTempo() : 1) * dt;
        this.abgaenge.forEach(a => {
            const dx = a.zielX - a.x, dy = a.zielY - a.y;
            const weg = Math.hypot(dx, dy);
            if (weg > 0.01) {
                const k = Math.min(1, schritt / weg);
                a.x += dx * k;
                a.y += dy * k;
            }
            a.rest -= dt;
        });
        this.abgaenge = this.abgaenge.filter(a => a.rest > 0 && Math.hypot(a.zielX - a.x, a.zielY - a.y) > 0.3);
    }

    /** Ein Spieler muss vom Platz - er verschwindet aus der Simulation */
    _platzverweis(side, playerId, name) {
        if (!playerId || this.platzverweise[side].includes(playerId)) return;
        this.platzverweise[side].push(playerId);
        this.angeschlagen[side] = this.angeschlagen[side].filter(id => id !== playerId);
        this.angemeldeteWechsel = this.angemeldeteWechsel.filter(w => !(w.side === side && w.outId === playerId));

        const idx = this.players2D.findIndex(p => p.id === playerId);
        if (idx >= 0) {
            this._abgang(this.players2D[idx]);
            this.players2D.splice(idx, 1);
            if (this.director && typeof this.director.spielerEntfernt === "function") {
                this.director.spielerEntfernt(playerId);
            }
        }

        if (side === this.userSide) {
            this.offeneEntscheidungen.push({
                art: "platzverweis", side, spielerId: playerId,
                text: `${name || "Ein Spieler"} muss vom Platz - wir spielen in Unterzahl.`
            });
        }
    }

    _verletzung(ev) {
        const side = this.seiteVon(ev.team);
        if (!ev.playerId) return;
        const stehtNoch = this.lineupVon(side).some(p => p && p.id === ev.playerId)
            && !this.platzverweise[side].includes(ev.playerId);
        if (!stehtNoch) return;
        if (!this.angeschlagen[side].includes(ev.playerId)) this.angeschlagen[side].push(ev.playerId);
        const p2d = this.players2D.find(p => p.id === ev.playerId);
        if (p2d) p2d.verletzt = true;

        // Entscheidet der Spieler selbst, muss er gefragt werden - sonst spielt
        // der Verletzte einfach weiter.
        if (side === this.userSide && !this.delegation.wechsel) {
            this.offeneEntscheidungen.push({
                art: "verletzung", side, spielerId: ev.playerId,
                text: `${ev.playerName || "Ein Spieler"} ist verletzt (${ev.injuryName || "Verletzung"}). Wer kommt für ihn?`
            });
        }
    }

    /** Ein Wechsel aus der Timeline (Co-Trainer oder Gegner) */
    /** @returns {boolean} ob der Wechsel jetzt stattgefunden hat */
    _timelineWechsel(ev) {
        if (ev._angewendet) return false;
        ev._angewendet = true;
        const side = this.seiteVon(ev.team);
        const playerOut = this.lineupVon(side).find(p => p && p.id === ev.playerOutId);
        const playerIn = MatchEngine.findPlayer(this.allPlayers, ev.playerInId);
        if (!playerOut || !playerIn || !this.bank[side].includes(playerIn.id)) return false;
        if (this.platzverweise[side].includes(playerOut.id)) return false;
        this._wechsleEin(side, playerOut, playerIn);
        this._belegeFenster(side);
        return true;
    }

    /**
     * Die Formation umstellen. Die Spieler auf dem Platz werden neu auf die
     * Positionen verteilt - der Innenverteidiger wandert nicht in den Sturm,
     * nur weil er in der Liste an der Stelle stand.
     */
    stelleFormationUm(teamType, formationKey, opts = {}) {
        const side = this.seiteVon(teamType);
        const configs = (typeof FORMATION_CONFIGS !== 'undefined' && FORMATION_CONFIGS)
            ? FORMATION_CONFIGS
            : ((typeof window !== 'undefined' && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS
                : (typeof require !== 'undefined' ? require('./gameState.js').FORMATION_CONFIGS : {}));
        const cfg = configs && configs[formationKey];
        if (!cfg || !Array.isArray(cfg.positions) || cfg.positions.length < 11) {
            return { success: false, message: "Unbekannte Formation." };
        }
        const club = this.clubVon(side);
        if (club.formation === formationKey) return { success: true, message: "Formation unverändert." };
        club.formation = formationKey;

        const lineup = this.lineupVon(side);
        const raus = new Set(this.platzverweise[side]);
        const imSpiel = lineup.filter(p => p && !raus.has(p.id));
        const verteilt = _PositionEngine && typeof _PositionEngine.assignBestLineup === "function"
            ? _PositionEngine.assignBestLineup(imSpiel, cfg.positions)
            : imSpiel.slice();
        // Platzverweisene fuellen die Luecken, damit die Liste elf Eintraege
        // behaelt - in den Szenen kommen sie ohnehin nicht mehr vor.
        const rest = lineup.filter(p => p && raus.has(p.id));
        const neu = verteilt.map(p => p || rest.shift()).filter(Boolean);
        lineup.splice(0, lineup.length, ...neu);

        const spiegeln = !!this.director?.isSecondHalf;
        lineup.forEach((p, idx) => {
            const p2d = this.players2D.find(q => q.id === p.id);
            const slot = cfg.positions[idx];
            if (!p2d || !slot) return;
            let fieldX = side === "home"
                ? Math.max(3, Math.min(48, ((100 - slot.y) / 100) * 44 + 4))
                : Math.max(52, Math.min(97, 96 - ((100 - slot.y) / 100) * 44));
            let fieldY = side === "home" ? slot.x : 100 - slot.x;
            if (spiegeln) { fieldX = 100 - fieldX; fieldY = 100 - fieldY; }
            p2d.baseX = fieldX;
            p2d.baseY = fieldY;
            p2d.pos = slot.pos || p.pos;
            p2d.slot = idx;
        });
        if (this.director) this.director.initPlayers();

        const text = `${this.minute}' - ${club.name} stellt um: ${cfg.name || formationKey}.`;
        this.addEvent("tactics", club.id, text);
        this.lastCommentary = text;
        if (!opts.ohneNeuberechnung) this.resimulateRemainder();
        return { success: true, message: text };
    }

    updateTactics(teamType, newTactics, opts = {}) {
        const side = this.seiteVon(teamType);
        const club = this.clubVon(side);
        club.tactics = Object.assign(club.tactics || {}, newTactics);
        const mentality = club.tactics.mentality || "balanced";
        const eventText = opts.text || formatCommentary("tactics", {
            minute: this.minute,
            club: club.name,
            mentality: mentality
        });
        this.addEvent("tactics", club.id, eventText);
        this.lastCommentary = eventText;

        // Rollen und Formen gelten sofort auf dem Feld
        if (this.director) this.director.taktikAnwenden();

        // Re-simuliere den verbleibenden Spielverlauf mit der neuen Taktik (C14)
        if (!opts.ohneNeuberechnung) this.resimulateRemainder();
    }

    /**
     * Was der Co-Trainer uebernimmt. Aendert sich die Zustaendigkeit fuer
     * Wechsel, wird das Restspiel neu berechnet - sonst wechselte die
     * Simulation weiter (oder nicht mehr), als waere nichts gewesen.
     */
    setzeDelegation(teamType, neu = {}, opts = {}) {
        const side = this.seiteVon(teamType);
        if (side !== this.userSide) return false;
        const vorher = { ...this.delegation };
        if (typeof neu.wechsel === "boolean") this.delegation.wechsel = neu.wechsel;
        if (typeof neu.taktik === "boolean") this.delegation.taktik = neu.taktik;
        const wechselGeaendert = vorher.wechsel !== this.delegation.wechsel;
        if (wechselGeaendert && !this.isFinished && !opts.ohneNeuberechnung) this.resimulateRemainder();
        return wechselGeaendert;
    }

    /**
     * Die Einschaetzung des Co-Trainers - aus dem, was auf dem Platz passiert,
     * nicht aus Floskeln. Jede Zeile nennt den Grund.
     */
    coTrainerHinweise(teamType) {
        const side = this.seiteVon(teamType || this.userSide || "home");
        const gegner = side === "home" ? "away" : "home";
        const idx = side === "home" ? 0 : 1;
        const gIdx = 1 - idx;
        const hinweise = [];
        const namen = id => (MatchEngine.findPlayer(this.allPlayers, id)?.name || "Ein Spieler");
        // Ein guter Co-Trainer sieht Müdigkeit früher und liest das Spiel des
        // Gegners, ein schwacher meldet erst, wenn es offensichtlich ist.
        const guete = this.coTrainer?.[side]?.guete ?? 60;
        const muedeAb = guete >= 75 ? 0.76 : (guete >= 50 ? 0.74 : 0.70);

        // Kondition aus der Simulation
        const platt = (this.players2D || [])
            .filter(p => p.team === side && p.pos !== "TW" && typeof p.freshness === "number" && p.freshness < muedeAb)
            .sort((a, b) => a.freshness - b.freshness)
            .slice(0, guete >= 50 ? 3 : 2);
        platt.forEach(p => hinweise.push({
            art: "kondition", spielerId: p.id, gewicht: 2,
            text: `${p.name} geht die Luft aus (Kondition ${Math.round(p.freshness * 100)} %).`
        }));

        this.angeschlagen[side].forEach(id => hinweise.push({
            art: "verletzung", spielerId: id, gewicht: 3,
            text: `${namen(id)} spielt angeschlagen weiter - er ist langsamer und das Risiko steigt.`
        }));

        this.verwarnt[side].forEach(id => {
            const p = this.lineupVon(side).find(x => x && x.id === id);
            if (!p) return;
            const defensiv = ["IV", "LV", "RV", "DM"].includes(p.pos);
            hinweise.push({
                art: "gelb", spielerId: id, gewicht: defensiv ? 2 : 1,
                text: `${p.name} ist verwarnt${defensiv ? " - in seinen Zweikaempfen droht Gelb-Rot" : ""}.`
            });
        });

        if (this.platzverweise[side].length > this.platzverweise[gegner].length) {
            hinweise.push({ art: "unterzahl", gewicht: 3,
                text: "Wir sind in Unterzahl. Kompakter stehen oder eine Offensivkraft für einen Verteidiger bringen." });
        } else if (this.platzverweise[gegner].length > this.platzverweise[side].length) {
            hinweise.push({ art: "ueberzahl", gewicht: 2,
                text: "Der Gegner ist in Unterzahl - jetzt lohnt es sich, das Spiel zu machen." });
        }

        const eigene = side === "home" ? this.homeScore : this.awayScore;
        const fremde = side === "home" ? this.awayScore : this.homeScore;
        const schuesse = this.stats?.shots || [0, 0];
        if (this.minute >= 55 && eigene < fremde) {
            hinweise.push({ art: "rueckstand", gewicht: 2,
                text: `Wir liegen ${eigene}:${fremde} zurück und haben noch ${Math.max(0, 90 - this.minute)} Minuten - mehr Risiko?` });
        } else if (this.minute >= 70 && eigene > fremde) {
            hinweise.push({ art: "fuehrung", gewicht: 1,
                text: `Wir führen ${eigene}:${fremde}. Tempo rausnehmen und sicher stehen bringt es nach Hause.` });
        }
        if (guete >= 40 && this.minute >= 20 && schuesse[gIdx] >= schuesse[idx] + 5) {
            hinweise.push({ art: "druck", gewicht: 2,
                text: `Der Gegner kommt zu deutlich mehr Abschlüssen (${schuesse[gIdx]}:${schuesse[idx]}) - tiefer verteidigen oder früher stören.` });
        }
        const ballbesitz = this.stats?.possession?.[idx];
        if (guete >= 40 && this.minute >= 25 && typeof ballbesitz === "number" && ballbesitz <= 38) {
            hinweise.push({ art: "zugriff", gewicht: 1,
                text: `Nur ${ballbesitz} % Ballbesitz - kürzere Passwege könnten helfen.` });
        }

        // Wer einen schwachen Tag hat - erst ab einem ordentlichen Co-Trainer
        if (guete >= 55 && this.minute >= 30) {
            const noten = this.liveNoten();
            this.aufDemPlatz(side)
                .map(p => ({ p, n: noten.get(p.id) }))
                .filter(x => x.n && x.n.minuten >= 25 && x.n.note <= 5.7)
                .sort((a, b) => a.n.note - b.n.note)
                .slice(0, 2)
                .forEach(({ p, n }) => hinweise.push({
                    art: "note", spielerId: p.id, gewicht: n.note <= 5.3 ? 2 : 1,
                    text: `${p.name} erwischt einen schwachen Tag (Note ${n.note.toFixed(1).replace(".", ",")}).`
                }));
        }

        // Wie der Gegner angreift - nur wer das Spiel lesen kann, sieht es
        if (guete >= 60 && this.minute >= 20) {
            const analyse = this.gegnerAnalyse(side);
            if (analyse.genugGesehen && analyse.empfehlungen.length > 0) {
                hinweise.push({ art: "gegner", gewicht: 1, text: `Gegner: ${analyse.empfehlungen[0]}` });
            }
        }

        const wechsel = this.wechselStand(side);
        if (wechsel.frei > 0 && wechsel.fensterFrei === 0 && !this.istHalbzeitpause()) {
            const zweiteHaelfte = this.director ? !!this.director.isSecondHalf : this.minute > 45;
            hinweise.push({ art: "regel", gewicht: 1,
                text: zweiteHaelfte
                    ? "Alle drei Unterbrechungen für Wechsel sind genutzt - es geht kein Wechsel mehr."
                    : "Alle drei Unterbrechungen für Wechsel sind genutzt - weitere Wechsel nur noch in der Halbzeitpause." });
        }

        return hinweise.sort((a, b) => b.gewicht - a.gewicht);
    }

    /**
     * Der Co-Trainer passt die Taktik an den Spielstand an, wenn er darf.
     * Er prueft zu festen Zeitpunkten und aendert nur, was der Spielstand
     * verlangt - er dreht nicht wild an allen Reglern.
     */
    coTrainerTakt() {
        if (!this.userSide || !this.delegation.taktik || this.isFinished) return null;
        const punkt = this._coTrainerPunkte.find(m => this.minute >= m);
        if (punkt === undefined) return null;
        this._coTrainerPunkte = this._coTrainerPunkte.filter(m => m > this.minute);

        const side = this.userSide;
        const club = this.clubVon(side);
        const t = club.tactics || {};
        const eigene = side === "home" ? this.homeScore : this.awayScore;
        const fremde = side === "home" ? this.awayScore : this.homeScore;
        const stufen = ["very_defensive", "defensive", "balanced", "offensive", "very_offensive"];
        const jetzt = Math.max(0, stufen.indexOf(t.mentality || "balanced"));
        const aenderung = {};
        let grund = "";

        if (eigene < fremde) {
            // Bei zwei Toren Rückstand geht es auch vor der Schlussphase
            // aufs Ganze - sonst stünde ein früh reagierender Co-Trainer beim
            // zweiten Gegentor schon am Anschlag und täte nichts mehr.
            const grenze = (this.minute >= 75 || fremde - eigene >= 2) ? 4 : 3;
            const ziel = Math.min(grenze, jetzt + 1);
            if (ziel > jetzt) aenderung.mentality = stufen[ziel];
            if (this.minute >= 70 && t.pressing !== "high") aenderung.pressing = "high";
            grund = "Wir brauchen ein Tor";
        } else if (eigene > fremde && this.minute >= 75) {
            if (jetzt > 1) aenderung.mentality = stufen[Math.max(1, jetzt - 1)];
            if (t.tempo !== "slow") aenderung.tempo = "slow";
            grund = "Das Ergebnis halten";
        } else if (eigene === fremde && this.minute >= 83 && jetzt < 3) {
            aenderung.mentality = "offensive";
            grund = "Noch einmal auf Sieg spielen";
        }

        if (Object.keys(aenderung).length === 0) return null;
        const namen = { very_defensive: "sehr defensiv", defensive: "defensiv", balanced: "ausgeglichen", offensive: "offensiv", very_offensive: "sehr offensiv" };
        const teile = [];
        if (aenderung.mentality) teile.push(namen[aenderung.mentality]);
        if (aenderung.pressing) teile.push("hohes Pressing");
        if (aenderung.tempo) teile.push("Tempo raus");
        const text = `${this.minute}' - 📋 Der Co-Trainer stellt um (${grund}): ${teile.join(", ")}.`;
        this.updateTactics(side, aenderung, { text });
        return { aenderung, text };
    }

    /**
     * Was zwischen zwei Bildern an der Seitenlinie zu tun ist: angemeldete
     * Wechsel bei Gelegenheit ausfuehren, Co-Trainer pruefen lassen.
     */
    seitenlinie() {
        if (this.isFinished) return;
        if (this.wechselGelegenheit()) this.fuehreAngemeldeteWechselAus();
        this.coTrainerTakt();
    }

    /**
     * Der Co-Trainer uebernimmt den Rest der Partie: Wechsel und Umstellungen.
     *
     * Wer die Wechsel selbst macht, hat eine Simulation ohne eigene Wechsel -
     * die setzt er ja an der Seitenlinie. Beim Sofort-Ergebnis steht aber
     * niemand mehr dort, und das Restspiel lief ohne einen einzigen Wechsel
     * durch. Jetzt wird es mit dem Co-Trainer an der Linie neu berechnet.
     * Liefert true, wenn er etwas uebernommen hat.
     */
    coTrainerUebernimmt() {
        if (!this.userSide || this.isFinished) return false;
        const vorher = { ...this.delegation };
        this.delegation.taktik = true;
        if (!vorher.wechsel) {
            this.delegation.wechsel = true;
            // Was der Spieler noch haette entscheiden sollen (Verletzung,
            // Platzverweis), regelt jetzt der Co-Trainer
            this.offeneEntscheidungen = [];
            this.resimulateRemainder();
        }
        if (vorher.wechsel && vorher.taktik) return false;

        const co = this.coTrainer?.[this.userSide];
        const club = this.clubVon(this.userSide);
        const text = `${this.minute}' - 📋 ${co?.name ? `Co-Trainer ${co.name}` : "Der Co-Trainer"} übernimmt für den Rest der Partie: Wechsel und Umstellungen.`;
        this.addEvent("tactics", club?.id, text);
        this.lastCommentary = text;
        return true;
    }

    skipToEnd() {
        // Was angemeldet war, wird noch ausgefuehrt - sonst ginge der Wechsel
        // beim Sofort-Ergebnis stillschweigend verloren.
        if (this.angemeldeteWechsel.length > 0) this.fuehreAngemeldeteWechselAus();
        // Den Rest verwaltet der Co-Trainer
        this.coTrainerUebernimmt();
        while (this.timelineIndex < this.timeline.length) {
            const ev = this.timeline[this.timelineIndex];
            this.minute = Math.max(this.minute, ev.minute);
            this.processEvent(ev);
            this.timelineIndex++;
            // Zu seinen Zeitpunkten prueft er Spielstand und Taktik - wie im
            // Livespiel, nur ohne Bild
            if (this.delegation.taktik) this.coTrainerTakt();
        }
        this.minute = 90;
        this.finishMatch();

        // Was die Regie gerade inszenierte, ist mit dem Sofort-Ergebnis
        // vorbei. Vorher standen bis zum Spielbericht "TOOOOR!" und "Zweite
        // Halbzeit" gleichzeitig im Bild.
        this.banner = null;
        this.goalFlash = 0;
        this.celebratingTeam = null;
        this.celebrationInfo = null;
        this.slowMotion = 0;
        this.setPiece = null;
        if (this.director) {
            this.director.scene = null;
            this.director.deadBall = null;
            this.director.kickoff = null;
            this.director.mode = "ambient";
        }
    }

    finishMatch() {
        this.isFinished = true;
        this.currentPhase = "full_time";
        MatchEngine.applyTimelineToMatch(this.match, this.timeline, this.homeClub, this.awayClub, this.allPlayers);
        this.homeScore = this.match.homeGoals;
        this.awayScore = this.match.awayGoals;
        this.lastCommentary = `Abpfiff! Das Spiel endet ${this.homeScore}:${this.awayScore}.`;
        this.angemeldeteWechsel = [];
        this.offeneEntscheidungen = [];

        // Umstellungen an der Seitenlinie galten fuer dieses Spiel
        ["home", "away"].forEach(side => {
            const club = this.clubVon(side);
            const vorher = this._vorSpiel?.[side];
            if (!club || !vorher) return;
            club.tactics = { ...vorher.tactics };
            if (vorher.formation) club.formation = vorher.formation;
        });
    }
}

if (typeof window !== "undefined") {
    window.MATCH_TUNING = MATCH_TUNING;
    window.MatchEngine = MatchEngine;
    window.LiveMatch = LiveMatch;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MATCH_TUNING, MatchEngine, LiveMatch, ermittleTrikots };
}
