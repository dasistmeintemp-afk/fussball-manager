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

// Zentrale Kalibrierungs- und Tuning-Parameter
const MATCH_TUNING = {
    baseGoalChance: {
        // Kalibriert auf ca. 2.6 - 2.8 Tore pro Spiel, nachdem die Positionseignung
        // die effektiven Teamstärken realistischer (und leicht niedriger) macht
        through_ball: 0.145,
        cross: 0.097,
        dribble: 0.085,
        corner: 0.066,
        penalty: 0.77
    },
    skillInfluence: 340,
    cornerShotChance: 0.28,
    minGoalChance: 0.03,
    maxGoalChance: 0.40,

    // Raten für Nebenereignisse
    foulRate: 0.28,
    yellowCardRate: 0.36,       // Anteil Fouls, die Gelb geben (~3.5-4.5 Gelbe pro Spiel)
    redCardRate: 0.009,         // Direkte Rote Karte (~0.05 pro Spiel)
    penaltyRate: 0.032,         // Elfmeterquote pro Foul-Szene (~0.25 pro Spiel)
    injuryRatePerTeam: 0.06     // Verletzungswahrscheinlichkeit pro Team & Spiel (~0.06-0.10)
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
    static getCleanLineup(club, allPlayers) {
        const lineupIds = [...(club.lineup || [])];
        const benchIds = [...(club.bench || [])];
        const clean = [];
        const seenIds = new Set();

        const isPlayerFitAndEligible = p => p && (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0;

        // Fitte Spieler aus der Bank bereitstellen
        const availableBench = benchIds
            .map(id => allPlayers.find(p => p.id === id))
            .filter(isPlayerFitAndEligible);

        // 1. Stammelf prüfen
        lineupIds.forEach(id => {
            const p = allPlayers.find(pl => pl.id === id);
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
            const squadPlayers = allPlayers.filter(p =>
                (club.playerIds || []).includes(p.id) &&
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
            return lineupIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
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

        const fitnessFactor = 0.6 + ((player.fitness || 100) / 100) * 0.4;
        const moraleFactor = 0.85 + ((player.morale || 75) / 100) * 0.2;
        const formFactor = 0.85 + ((player.form || 7.0) / 10) * 0.2;
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

        // Teamstärken
        const homePower = this.calculateTeamPower(homeClub, allPlayers, true, activeHomePlayers);
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
        const extraTime2 = _Random.int(1, 5);

        const timeline = [];

        // Szenenanzahl basierend auf Tempo
        let totalScenesBase = 32;
        if (homeTactics.tempo === "fast" || awayTactics.tempo === "fast") totalScenesBase += 4;
        if (homeTactics.tempo === "slow" || awayTactics.tempo === "slow") totalScenesBase -= 3;

        const powerDiff = homePower.total - awayPower.total;
        const totalScenes = Math.max(20, Math.round(totalScenesBase + (powerDiff / 8) + _Random.float(-3, 3)));

        // Generiere chronologische Minuten über das Spiel
        const sceneMinutes = [];
        for (let i = 0; i < totalScenes; i++) {
            const rawMin = Math.round(((i + 0.5) / totalScenes) * 90 + _Random.float(-1.5, 1.5));
            const min = _Random.clamp(rawMin, 1, 90);
            if (min >= startMinute) {
                sceneMinutes.push(min);
            }
        }
        sceneMinutes.sort((a, b) => a - b);

        // Tracking von Verwarnungen / Platzverweisen pro Spieler im Spiel (A8)
        const playerYellows = new Map();
        const sentOffPlayerIds = new Set();

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
            const passer = midfielders.length > 0 ? _Random.choice(midfielders) : (attPlayers[1] || attPlayers[0]);
            const winger = wingers.length > 0 ? _Random.choice(wingers) : passer;
            const defender = defenders.length > 0 ? _Random.choice(defenders) : defPlayers[0];

            // Koordinaten für das 2D-Feld
            const startX = isHomeAttacking ? _Random.float(32, 50) : _Random.float(50, 68);
            const startY = _Random.float(25, 75);
            const midX = isHomeAttacking ? _Random.float(65, 80) : _Random.float(20, 35);
            const midY = _Random.float(28, 72);
            const goalX = isHomeAttacking ? 96 : 4;
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

            const modifiedAttPower = { ...attPowerLocal, attack: attPowerLocal.attack + staminaBonus + momentumBonus };
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
                        start: { x: isHomeAttacking ? 98 : 2, y: _Random.choice([2, 98]) },
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

        // Simuliere jede Szene chronologisch
        sceneMinutes.forEach(min => {
            // KI-Wechsel ab Minute 60 (C17)
            if (min >= 60 && min <= 82) {
                ['home', 'away'].forEach(teamSide => {
                    const isHomeTeam = teamSide === 'home';
                    const subsUsed = isHomeTeam ? homeSubsUsed : awaySubsUsed;
                    const club = isHomeTeam ? homeClub : awayClub;
                    const activePlayers = isHomeTeam ? activeHomePlayers : activeAwayPlayers;

                    if (subsUsed < maxSubs && _Random.chance(0.20)) {
                        const benchAvailable = (club.bench || [])
                            .map(id => allPlayers.find(p => p.id === id))
                            .filter(p => p && (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0 && !activePlayers.some(ap => ap.id === p.id));

                        if (benchAvailable.length > 0) {
                            // Erschöpften oder schwachen Spieler auswechseln
                            const candidateOut = [...activePlayers]
                                .filter(p => p.pos !== "TW")
                                .sort((a, b) => (a.fitness || 100) - (b.fitness || 100))[0];

                            const subIn = benchAvailable[0];
                            if (candidateOut && subIn) {
                                const outIdx = activePlayers.findIndex(p => p.id === candidateOut.id);
                                if (outIdx !== -1) {
                                    activePlayers[outIdx] = subIn;
                                    if (isHomeTeam) homeSubsUsed++; else awaySubsUsed++;

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

                        // Auswechslung des Verletzten versuchen
                        const benchAvailable = (club.bench || [])
                            .map(id => allPlayers.find(p => p.id === id))
                            .filter(p => p && (p.injuredWeeks || 0) <= 0 && (p.suspendedMatches || 0) <= 0 && !activePlayers.some(ap => ap.id === p.id));

                        if (benchAvailable.length > 0 && (isHomeTeam ? homeSubsUsed : awaySubsUsed) < maxSubs) {
                            const subIn = benchAvailable[0];
                            const outIdx = activePlayers.findIndex(p => p.id === victim.id);
                            if (outIdx !== -1) {
                                activePlayers[outIdx] = subIn;
                                if (isHomeTeam) homeSubsUsed++; else awaySubsUsed++;

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

            // Ermittle angreifendes Team
            let homeProb = homePower.midfield / (homePower.midfield + awayPower.midfield);
            // Momentum: Zurückliegendes Team drückt mehr
            if (currentHomeScore < currentAwayScore) homeProb += 0.08;
            else if (currentAwayScore < currentHomeScore) homeProb -= 0.08;

            const isHomeAttacking = _Random.chance(homeProb);
            const attClub = isHomeAttacking ? homeClub : awayClub;
            const defClub = isHomeAttacking ? awayClub : homeClub;
            const attTactics = isHomeAttacking ? homeTactics : awayTactics;
            const defTactics = isHomeAttacking ? awayTactics : homeTactics;

            const attPlayers = isHomeAttacking ? activeHomePlayers : activeAwayPlayers;
            const defPlayers = isHomeAttacking ? activeAwayPlayers : activeHomePlayers;

            const sceneTypeRoll = Math.random();

            if (sceneTypeRoll < MATCH_TUNING.foulRate) {
                // 1. ZWEIKÄMPFE, FOULS, KARTEN & ELFMETER (A6, A8)
                const foulDefPos = p => deployedPosOf(p, !isHomeAttacking);
                const foulAttPos = p => deployedPosOf(p, isHomeAttacking);

                // Der Torwart begeht keine Feldzweikämpfe im Mittelfeld
                const foulEligible = defPlayers.filter(p => !sentOffPlayerIds.has(p.id) && foulDefPos(p) !== "TW" && p.pos !== "TW");
                const defender = _Random.choice(foulEligible) || defPlayers.find(p => p.pos !== "TW") || defPlayers[0];
                const shooter = _Random.choice(attPlayers.filter(p => ["ST", "LA", "RA", "OM"].includes(foulAttPos(p)))) || attPlayers[0];
                const gk = defPlayers.find(p => foulDefPos(p) === "TW") || defPlayers.find(p => p.pos === "TW") || defPlayers[0];
                const fPos = { x: _Random.float(25, 75), y: _Random.float(20, 80) };

                const isPenalty = _Random.chance(MATCH_TUNING.penaltyRate);
                const isRed = !isPenalty && _Random.chance(0.003);
                const isYellow = !isPenalty && !isRed && _Random.chance(MATCH_TUNING.yellowCardRate);

                if (isPenalty) {
                    const penSpot = { x: isHomeAttacking ? 88 : 12, y: 50 };
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

                    const { outcome, xG } = MatchEngine.resolveShotAttempt("penalty", shooter, gk, isHomeAttacking ? homePower : awayPower, isHomeAttacking ? awayPower : homePower, attTactics);

                    if (outcome === "goal") {
                        if (isHomeAttacking) currentHomeScore++; else currentAwayScore++;
                        timeline.push({
                            minute: min,
                            second: 35,
                            type: "goal",
                            team: isHomeAttacking ? "home" : "away",
                            clubId: attClub.id,
                            clubName: attClub.name,
                            playerId: shooter?.id,
                            playerName: shooter?.name,
                            start: penSpot,
                            end: { x: goalX, y: goalY + (_Random.chance(0.5) ? 4 : -4) },
                            xG: 0.77,
                            outcome: "goal",
                            text: `${min}' - ⚽ TOOOOR durch Elfmeter! ${shooter?.name || "Schütze"} verwandelt eiskalt!`
                        });
                    } else {
                        timeline.push({
                            minute: min,
                            second: 35,
                            type: "save",
                            team: isHomeAttacking ? "away" : "home",
                            clubId: defClub.id,
                            clubName: defClub.name,
                            shooterId: shooter?.id,
                            shooterName: shooter?.name,
                            gkId: gk?.id,
                            gkName: gk?.name,
                            start: penSpot,
                            end: { x: goalX, y: goalY },
                            xG: 0.77,
                            outcome: "saved",
                            text: `${min}' - 🧤 GEHALTEN! ${gk?.name || "Torwart"} pariert den Elfmeter von ${shooter?.name || "Schütze"}!`
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
                    if (targetYellows >= 1) {
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
                        timeline.push({
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
                        });
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

                if (attTactics.attackFocus === "left" || attTactics.attackFocus === "right") {
                    crossWeight += 0.15;
                    throughWeight -= 0.10;
                } else if (attTactics.attackFocus === "center") {
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

        // Spielphasen & Nachspielzeit Events einfügen (A5, C15)
        const halfTimeMinute = 45 + extraTime1;
        const fullTimeMinute = 90 + extraTime2;

        timeline.push({
            minute: halfTimeMinute,
            second: 59,
            type: "halftime",
            text: formatCommentary("halftime", { minute: halfTimeMinute, score: `${currentHomeScore}:${currentAwayScore}` }),
            score: [currentHomeScore, currentAwayScore]
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
                    sentOffMinute: null
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
            } else if (event.type === "foul") {
                if (event.team === "home") homeFouls++; else awayFouls++;
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
                    const player = allPlayers.find(p => p.id === event.playerId);
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

        const homeStartingPlayers = initialHomeLineupIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);
        const awayStartingPlayers = initialAwayLineupIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean);

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
            const player = allPlayers.find(p => p.id === playerId);
            if (!player) return;

            const isHome = initialHomeLineupIds.includes(playerId) || (homeClub.playerIds || []).includes(playerId);
            const teamClub = isHome ? homeClub : awayClub;
            const teamGoals = isHome ? homeGoals : awayGoals;
            const oppGoals = isHome ? awayGoals : homeGoals;
            const teamWon = teamGoals > oppGoals;
            const teamLost = teamGoals < oppGoals;

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

            // FM-Noten-Berechnung (B9)
            let rating = 6.3;
            rating += (st.goals * 1.0);
            rating += (st.assists * 0.6);

            const isTW = player.pos === "TW";
            const isDef = ["IV", "LV", "RV", "DM"].includes(player.pos);

            if (isTW) {
                rating += (st.saves * 0.25);
                if (st.penaltySaved) rating += 0.8;
            }

            if (isTW || isDef) {
                if (minutes >= 60 && oppGoals === 0) rating += 0.4;
                rating -= (oppGoals * 0.15);
            }

            rating += (st.tackles * 0.1);
            rating -= (st.yellowCards * 0.3);
            if (st.redCards > 0 || st.hasSecondYellow) rating -= 1.5;

            if (teamWon) rating += 0.2;
            else if (teamLost) rating -= 0.2;

            rating += _Random.float(-0.15, 0.15);

            // Nach Einsatzminuten dämpfen
            const weight = Math.min(1.0, minutes / 60);
            rating = 6.0 + (rating - 6.0) * weight;
            rating = parseFloat(_Random.clamp(rating, 3.0, 10.0).toFixed(1));

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
            const pressingFactor = teamClub.tactics?.pressing === "high" ? 1.25 : (teamClub.tactics?.pressing === "low" ? 0.85 : 1.0);
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
            const p = allPlayers.find(pl => pl.id === inj.playerId);
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
        match.timeline = timeline;
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

        return match;
    }

    /**
     * Schnelle Hintergrund-Simulation für Matches (nutzt dieselbe Timeline)
     */
    static simulateFullMatch(match, homeClub, awayClub, allPlayers) {
        const timeline = match.timeline && match.timeline.length > 0
            ? match.timeline
            : this.generateTimeline(match, homeClub, awayClub, allPlayers);

        return this.applyTimelineToMatch(match, timeline, homeClub, awayClub, allPlayers);
    }

    /**
     * Erstellt eine interaktive LiveMatch-Instanz für die 2D-Live-Simulation
     */
    static createLiveMatch(match, homeClub, awayClub, allPlayers) {
        return new LiveMatch(match, homeClub, awayClub, allPlayers);
    }
}

/**
 * Klasse zur Durchführung der Live 2D Match Simulation (spielt Timeline synchron ab)
 */
class LiveMatch {
    constructor(match, homeClub, awayClub, allPlayers) {
        this.match = match;
        this.homeClub = homeClub;
        this.awayClub = awayClub;
        this.allPlayers = allPlayers;

        this.homeLineup = MatchEngine.getCleanLineup(homeClub, allPlayers);
        this.awayLineup = MatchEngine.getCleanLineup(awayClub, allPlayers);

        if (!match.lineups) {
            match.lineups = {
                home: this.homeLineup.map(p => p.id),
                away: this.awayLineup.map(p => p.id)
            };
        }

        // Timeline generieren falls noch nicht vorhanden
        if (!match.timeline || match.timeline.length === 0) {
            match.timeline = MatchEngine.generateTimeline(match, homeClub, awayClub, allPlayers, {
                homeLineup: this.homeLineup,
                awayLineup: this.awayLineup
            });
        }
        this.timeline = match.timeline;
        this.timelineIndex = 0;

        this.minute = 0;
        this.seconds = 0;
        this.extraTime = 0;
        this.homeScore = 0;
        this.awayScore = 0;
        this.isFinished = false;
        this.isPaused = false;
        this.speed = 1;

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
        this.substitutionsUsed = { home: 0, away: 0 };
        this.maxSubstitutions = 5;

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
        this.players2D = this.initialize2DPositions();
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
        this.director.advanceRealTime(realDeltaMs);
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
                color: this.homeClub.color || "#1d4ed8",
                textColor: this.homeClub.textColor || "#ffffff"
            });
        });

        this.awayLineup.forEach((p, idx) => {
            const slot = awayPositions[idx] || { x: 50, y: 90, pos: p.pos };
            const fieldX = Math.max(52, Math.min(97, 96 - ((100 - slot.y) / 100) * 44));
            const fieldY = slot.x;
            players.push({
                id: p.id,
                name: p.name,
                number: idx + 1,
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
                color: this.awayClub.color || "#dc2626",
                textColor: this.awayClub.textColor || "#ffffff"
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

        const newRemainder = MatchEngine.generateTimeline(this.homeClub, this.awayClub, this.allPlayers, {
            startMinute: startMin,
            currentHomeScore: this.homeScore,
            currentAwayScore: this.awayScore,
            homeLineup: this.homeLineup,
            awayLineup: this.awayLineup,
            usedSubsHome: this.substitutionsUsed.home,
            usedSubsAway: this.substitutionsUsed.away
        });

        this.timeline = [...playedEvents, ...newRemainder];
        this.match.timeline = this.timeline;
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
            if (ev.team === "home") { this.stats.fouls[0]++; this.stats.yellowCards[0]++; }
            else { this.stats.fouls[1]++; this.stats.yellowCards[1]++; }
            this.addEvent("yellow_card", ev.clubId, ev.text);
        } else if (ev.type === "red_card") {
            if (ev.team === "home") { this.stats.fouls[0]++; this.stats.redCards[0]++; }
            else { this.stats.fouls[1]++; this.stats.redCards[1]++; }
            this.addEvent("red_card", ev.clubId, ev.text);
        } else if (ev.type === "injury") {
            this.addEvent("injury", ev.clubId, ev.text);
        } else if (ev.type === "substitution") {
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

    substitute(teamType, playerOutId, playerInId) {
        const club = teamType === "home" ? this.homeClub : this.awayClub;
        const lineup = teamType === "home" ? this.homeLineup : this.awayLineup;

        if (this.substitutionsUsed[teamType] >= this.maxSubstitutions) {
            return { success: false, message: "Maximales Auswechselkontingent (5) bereits erschöpft!" };
        }

        const outIndex = lineup.findIndex(p => p.id === playerOutId);
        const inBenchIndex = (club.bench || []).indexOf(playerInId);

        if (outIndex === -1 || inBenchIndex === -1) {
            return { success: false, message: "Spieler nicht in Startelf oder Bank gefunden." };
        }

        const playerOut = this.allPlayers.find(p => p.id === playerOutId);
        const playerIn = this.allPlayers.find(p => p.id === playerInId);

        if (!playerIn) {
            return { success: false, message: "Einzuwechselnder Spieler nicht gefunden." };
        }

        if (Array.isArray(club.lineup)) {
            const lineupIdx = club.lineup.indexOf(playerOutId);
            if (lineupIdx !== -1) club.lineup[lineupIdx] = playerInId;
        }
        club.bench.splice(inBenchIndex, 1);
        club.bench.push(playerOutId);

        lineup[outIndex] = playerIn;

        const p2d = this.players2D.find(p => p.id === playerOutId);
        if (p2d) {
            p2d.id = playerIn.id;
            p2d.name = playerIn.name;
            // Der Slot auf dem Feld bleibt bestehen, nur der Spieler wechselt
            p2d.naturalPos = playerIn.pos;
            p2d.pace = playerIn.pace || playerIn.overall || 70;
            if (this.director) this.director.initPlayers();
        }

        this.substitutionsUsed[teamType]++;
        const eventText = formatCommentary("substitution", {
            minute: this.minute,
            club: club.name,
            playerIn: playerIn.name,
            playerOut: playerOut?.name || "Spieler"
        });

        this.addEvent("sub", club.id, eventText);
        this.lastCommentary = eventText;

        // Re-simuliere den verbleibenden Spielverlauf mit der neuen Elf (C14)
        this.resimulateRemainder();

        return { success: true, message: `Auswechslung erfolgreich: ${playerIn.name} für ${playerOut?.name}` };
    }

    updateTactics(teamType, newTactics) {
        const club = teamType === "home" ? this.homeClub : this.awayClub;
        club.tactics = Object.assign(club.tactics || {}, newTactics);
        const mentality = club.tactics.mentality || "balanced";
        const eventText = formatCommentary("tactics", {
            minute: this.minute,
            club: club.name,
            mentality: mentality
        });
        this.addEvent("tactics", club.id, eventText);
        this.lastCommentary = eventText;

        // Re-simuliere den verbleibenden Spielverlauf mit der neuen Taktik (C14)
        this.resimulateRemainder();
    }

    skipToEnd() {
        while (this.timelineIndex < this.timeline.length) {
            const ev = this.timeline[this.timelineIndex];
            this.minute = Math.max(this.minute, ev.minute);
            this.processEvent(ev);
            this.timelineIndex++;
        }
        this.minute = 90;
        this.finishMatch();
    }

    finishMatch() {
        this.isFinished = true;
        this.currentPhase = "full_time";
        MatchEngine.applyTimelineToMatch(this.match, this.timeline, this.homeClub, this.awayClub, this.allPlayers);
        this.homeScore = this.match.homeGoals;
        this.awayScore = this.match.awayGoals;
        this.lastCommentary = `Abpfiff! Das Spiel endet ${this.homeScore}:${this.awayScore}.`;
    }
}

if (typeof window !== "undefined") {
    window.MATCH_TUNING = MATCH_TUNING;
    window.MatchEngine = MatchEngine;
    window.LiveMatch = LiveMatch;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MATCH_TUNING, MatchEngine, LiveMatch };
}
