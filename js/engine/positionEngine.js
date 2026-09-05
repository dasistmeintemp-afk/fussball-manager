/**
 * PositionEngine - Positionsprofile, Eignungs-/Familiaritätsmodell und Zonenlogik
 *
 * Kernidee (wie in FM): Ein Spieler hat eine Naturposition und beherrscht andere
 * Positionen unterschiedlich gut. Je weiter die Einsatzposition von seinem Profil
 * entfernt liegt, desto stärker sinkt seine effektive Leistung.
 *
 * Zusätzlich liefert die Engine die Zonenlogik für den freien Formations-Editor:
 * Aus beliebigen Rasterkoordinaten wird die passende Positionsbezeichnung und aus
 * einer kompletten Aufstellung der Formationsname (z. B. "4-2-3-1") abgeleitet.
 */

const PositionEngine = {

    /**
     * Alle spielbaren Positionen in der Reihenfolge von hinten nach vorne
     */
    ALL_POSITIONS: ["TW", "IV", "LV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"],

    /**
     * Positionsprofil:
     *  depth  = Mannschaftsteil-Tiefe (0 = Tor, 4 = Sturmspitze)
     *  flank  = -1 links, 0 zentral, +1 rechts
     *  x / y  = Standardkoordinate auf dem Taktikfeld (y = 100 ist das eigene Tor)
     */
    POSITION_META: {
        TW: { depth: 0.0, flank: 0, x: 50, y: 92, name: "Torwart", group: "gk" },
        IV: { depth: 1.0, flank: 0, x: 50, y: 76, name: "Innenverteidiger", group: "def" },
        LV: { depth: 1.1, flank: -1, x: 14, y: 72, name: "Linksverteidiger", group: "def" },
        RV: { depth: 1.1, flank: 1, x: 86, y: 72, name: "Rechtsverteidiger", group: "def" },
        DM: { depth: 1.8, flank: 0, x: 50, y: 57, name: "Defensives Mittelfeld", group: "mid" },
        ZM: { depth: 2.4, flank: 0, x: 50, y: 46, name: "Zentrales Mittelfeld", group: "mid" },
        LM: { depth: 2.4, flank: -1, x: 14, y: 45, name: "Linkes Mittelfeld", group: "mid" },
        RM: { depth: 2.4, flank: 1, x: 86, y: 45, name: "Rechtes Mittelfeld", group: "mid" },
        OM: { depth: 3.1, flank: 0, x: 50, y: 34, name: "Offensives Mittelfeld", group: "mid" },
        LA: { depth: 3.7, flank: -1, x: 16, y: 22, name: "Linksaußen", group: "att" },
        RA: { depth: 3.7, flank: 1, x: 84, y: 22, name: "Rechtsaußen", group: "att" },
        ST: { depth: 4.0, flank: 0, x: 50, y: 18, name: "Stürmer", group: "att" }
    },

    /**
     * Eignungsstufen von "Stammposition" bis "Fehlbesetzung"
     */
    SUITABILITY_LEVELS: [
        { min: 0.95, key: "natural", label: "Stammposition", short: "Natürlich", color: "#22c55e" },
        { min: 0.85, key: "accomplished", label: "Sehr gut geeignet", short: "Erfahren", color: "#4ade80" },
        { min: 0.70, key: "competent", label: "Geeignet", short: "Solide", color: "#a3e635" },
        { min: 0.55, key: "unconvincing", label: "Ungewohnt", short: "Ungewohnt", color: "#facc15" },
        { min: 0.35, key: "awkward", label: "Deplatziert", short: "Deplatziert", color: "#fb923c" },
        { min: 0.00, key: "makeshift", label: "Fehlbesetzung", short: "Notlösung", color: "#ef4444" }
    ],

    /**
     * Normalisiert eine Positionsangabe (akzeptiert auch englische Kürzel)
     */
    normalizePosition(pos) {
        if (!pos || typeof pos !== "string") return null;
        const clean = pos.trim().toUpperCase();
        if (this.POSITION_META[clean]) return clean;

        const aliases = {
            GK: "TW", TOR: "TW",
            CB: "IV", LCB: "IV", RCB: "IV",
            LB: "LV", RB: "RV", LWB: "LV", RWB: "RV",
            CDM: "DM", CM: "ZM", CAM: "OM",
            LW: "LA", RW: "RA", LF: "LA", RF: "RA",
            SS: "ST", CF: "ST", STL: "ST", STR: "ST"
        };
        return aliases[clean] || null;
    },

    /**
     * Liefert alle Positionen, die ein Spieler laut Profil beherrscht
     */
    getKnownPositions(player = {}) {
        const known = new Set();
        const main = this.normalizePosition(player.pos);
        if (main) known.add(main);

        const second = this.normalizePosition(player.secondPos);
        if (second) known.add(second);

        if (Array.isArray(player.positions)) {
            player.positions.forEach(p => {
                const norm = this.normalizePosition(p);
                if (norm) known.add(norm);
            });
        }

        return Array.from(known);
    },

    /**
     * Grundfamiliarität allein aus der Distanz zweier Positionsprofile.
     * Vertikale Distanz (Mannschaftsteil) wiegt schwerer als der Seitenwechsel.
     */
    getBaseFamiliarity(fromPos, toPos) {
        const a = this.POSITION_META[fromPos];
        const b = this.POSITION_META[toPos];
        if (!a || !b) return 0.4;
        if (fromPos === toPos) return 1.0;

        // Der Torwart ist ein Sonderfall: Ein Feldspieler im Tor (und umgekehrt)
        // ist die schlechteste aller Notlösungen - schlechter als jede
        // Fehlbesetzung im Feld.
        if (fromPos === "TW" || toPos === "TW") return 0.05;

        const depthDelta = Math.abs(a.depth - b.depth);
        let factor = 1 - Math.pow(depthDelta, 1.15) * 0.26;

        const flankDelta = Math.abs(a.flank - b.flank);
        if (flankDelta === 1) factor *= 0.86;      // Zentrum <-> Flügel
        else if (flankDelta === 2) factor *= 0.72; // Links <-> Rechts

        return Math.max(0.08, Math.min(1.0, factor));
    },

    /**
     * Familiarität eines konkreten Spielers auf einer Einsatzposition (0..1)
     */
    getFamiliarity(player = {}, targetPos = null) {
        const target = this.normalizePosition(targetPos);
        if (!target) return 1.0;

        const known = this.getKnownPositions(player);
        if (known.length === 0) return 0.7;

        if (known[0] === target) return 1.0;
        // Zweit- und Nebenpositionen gelten als eingespielt
        if (known.includes(target)) return 0.93;

        let best = 0;
        known.forEach((pos, idx) => {
            // Naturposition zählt voll, Nebenpositionen leicht abgeschwächt
            const weight = idx === 0 ? 1.0 : 0.95;
            best = Math.max(best, this.getBaseFamiliarity(pos, target) * weight);
        });

        // Anpassungsfähigkeit (Hidden Attribute 1-20) verschiebt das Ergebnis leicht
        const adaptability = player.hiddenAttributes?.adaptability;
        if (typeof adaptability === "number") {
            best += ((adaptability - 12) / 20) * 0.12 * (1 - best);
        }

        // Erlernte Routine: Wer eine Position regelmäßig spielt oder dort
        // trainiert, wächst dort hinein. Der Wert liegt zwischen 0 und 1 und
        // hebt die Vertrautheit auf bis zu 0,93 - eine echte Naturposition
        // bleibt der erlernten immer eine Nasenlänge voraus.
        const erfahrung = player.positionExperience?.[target];
        if (typeof erfahrung === "number" && erfahrung > 0) {
            const gelernt = 0.55 + 0.38 * Math.max(0, Math.min(1, erfahrung));
            best = Math.max(best, gelernt);
        }

        return Math.max(0.05, Math.min(1.0, best));
    },

    /**
     * Lässt einen Spieler auf einer Position dazulernen.
     *
     * Ein Einsatz über 90 Minuten bringt spürbar mehr als eine Trainingseinheit,
     * und wer sich leicht anpasst, lernt schneller. Sobald die Routine 1,0
     * erreicht, wird die Position dauerhaft als Nebenposition geführt.
     */
    gainPositionExperience(player, targetPos, amount = 0.02) {
        const target = this.normalizePosition(targetPos);
        if (!player || !target) return 0;

        const known = this.getKnownPositions(player);
        if (known.includes(target)) return 1;

        if (!player.positionExperience || typeof player.positionExperience !== "object") {
            player.positionExperience = {};
        }

        const adaptability = player.hiddenAttributes?.adaptability;
        const tempo = typeof adaptability === "number" ? 0.6 + (adaptability / 20) * 0.8 : 1.0;
        // Grundverwandte Positionen lernt man schneller als artfremde
        const verwandt = this.getBaseFamiliarity(known[0] || target, target);

        const bisher = player.positionExperience[target] || 0;
        const neu = Math.min(1, bisher + amount * tempo * (0.5 + verwandt));
        player.positionExperience[target] = Math.round(neu * 1000) / 1000;

        if (neu >= 1) {
            if (!Array.isArray(player.positions)) player.positions = [];
            if (!player.positions.includes(target)) player.positions.push(target);
            if (!player.secondPos) player.secondPos = target;
        }

        return player.positionExperience[target];
    },

    /**
     * Multiplikator auf die Spielstärke: 1.0 auf der Stammposition, bis ca. 0.60 als Notlösung
     */
    getRatingModifier(familiarity) {
        const fam = Math.max(0, Math.min(1, typeof familiarity === "number" ? familiarity : 1));
        return 0.55 + 0.45 * fam;
    },

    /**
     * Vollständige Eignungsanalyse eines Spielers für eine Einsatzposition
     */
    getSuitability(player = {}, targetPos = null) {
        const target = this.normalizePosition(targetPos) || this.normalizePosition(player.pos) || "ZM";
        const familiarity = this.getFamiliarity(player, target);
        const modifier = this.getRatingModifier(familiarity);
        const level = this.SUITABILITY_LEVELS.find(l => familiarity >= l.min) || this.SUITABILITY_LEVELS[this.SUITABILITY_LEVELS.length - 1];

        const baseOverall = player.overall || 65;
        const effectiveOverall = Math.max(1, Math.round(baseOverall * modifier));

        return {
            position: target,
            positionName: this.POSITION_META[target]?.name || target,
            familiarity: Math.round(familiarity * 100) / 100,
            familiarityPercent: Math.round(familiarity * 100),
            modifier: Math.round(modifier * 1000) / 1000,
            level: level.key,
            label: level.label,
            shortLabel: level.short,
            color: level.color,
            baseOverall,
            effectiveOverall,
            penalty: baseOverall - effectiveOverall,
            isNatural: familiarity >= 0.95
        };
    },

    /**
     * Effektive Bewertung (OVR) eines Spielers auf einer Einsatzposition
     */
    getEffectiveRating(player = {}, targetPos = null) {
        return this.getSuitability(player, targetPos).effectiveOverall;
    },

    /**
     * Ermittelt die besten Einsatzpositionen eines Spielers (absteigend nach Eignung)
     */
    getPositionRanking(player = {}) {
        return this.ALL_POSITIONS
            .map(pos => this.getSuitability(player, pos))
            .sort((a, b) => b.familiarity - a.familiarity || b.effectiveOverall - a.effectiveOverall);
    },

    /**
     * Leitet aus freien Rasterkoordinaten die passende Position ab.
     * x = Breite (0 links .. 100 rechts), y = Tiefe (0 gegnerisches Tor .. 100 eigenes Tor)
     */
    detectPositionFromCoords(x, y) {
        const px = Math.max(0, Math.min(100, Number(x)));
        const py = Math.max(0, Math.min(100, Number(y)));

        // Torwartzone
        if (py >= 86) return "TW";

        const isLeft = px < 30;
        const isRight = px > 70;
        const isWide = isLeft || isRight;

        if (py >= 65) {
            // Abwehrkette: hier ist der zentrale Korridor breiter, damit eine
            // Dreierkette nicht fälschlich zu Außenverteidigern wird
            if (px < 22) return "LV";
            if (px > 78) return "RV";
            return "IV";
        }
        if (py >= 51) {
            // Sechserraum
            if (isLeft) return "LV";
            if (isRight) return "RV";
            return "DM";
        }
        if (py >= 39) {
            // Zentrales Mittelfeld
            if (isLeft) return "LM";
            if (isRight) return "RM";
            return "ZM";
        }
        if (py >= 27) {
            // Offensives Mittelfeld
            if (isLeft) return "LM";
            if (isRight) return "RM";
            return "OM";
        }
        // Angriff
        if (isWide) return isLeft ? "LA" : "RA";
        return "ST";
    },

    /**
     * Ordnet eine Position einer Mannschaftsteil-Gruppe zu (gk/def/mid/att)
     */
    getPositionGroup(pos) {
        const norm = this.normalizePosition(pos);
        return this.POSITION_META[norm]?.group || "mid";
    },

    /**
     * Leitet aus den Slots einer Aufstellung den Formationsnamen ab, z. B. "4-2-3-1".
     * Die Feldspieler werden nach ihrer Tiefe zu Ketten gruppiert, danach werden eng
     * beieinander liegende Ketten verschmolzen. So erhalten auch frei gezeichnete
     * Formationen eine verständliche Bezeichnung.
     */
    detectFormationShape(positions = []) {
        const outfield = (positions || [])
            .filter(slot => slot && this.normalizePosition(slot.pos) !== "TW")
            .map(slot => (typeof slot.y === "number" ? slot.y : 50))
            .sort((a, b) => b - a); // von der eigenen Grundlinie nach vorne

        if (outfield.length === 0) return "0";

        // 1. Ketten bilden: benachbarte Spieler mit geringem Tiefenabstand
        const LINE_GAP = 10;
        const lines = [];
        outfield.forEach(y => {
            const current = lines[lines.length - 1];
            if (current && Math.abs(current.values[current.values.length - 1] - y) <= LINE_GAP) {
                current.values.push(y);
            } else {
                lines.push({ values: [y] });
            }
        });

        const centerOf = line => line.values.reduce((s, v) => s + v, 0) / line.values.length;
        const DEF_BOUNDARY = 62;   // Abwehrkette nie mit dem Mittelfeld verschmelzen
        const MERGE_DISTANCE = 14;
        const MAX_LINES = 4;

        // 2. Zu eng beieinander liegende Ketten zusammenfassen
        let guard = 0;
        while (lines.length > 1 && guard++ < 20) {
            const forceMerge = lines.length > MAX_LINES + 1;
            let bestIdx = -1;
            let bestDist = Infinity;

            for (let i = 0; i < lines.length - 1; i++) {
                const cA = centerOf(lines[i]);
                const cB = centerOf(lines[i + 1]);
                const sameBlock = (cA >= DEF_BOUNDARY) === (cB >= DEF_BOUNDARY);
                if (!sameBlock && !forceMerge) continue;

                const dist = Math.abs(cA - cB);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                }
            }

            const mustShrink = lines.length > MAX_LINES;
            if (bestIdx === -1 || (bestDist > MERGE_DISTANCE && !mustShrink)) break;

            lines[bestIdx].values = lines[bestIdx].values.concat(lines[bestIdx + 1].values);
            lines.splice(bestIdx + 1, 1);
        }

        return lines.map(l => l.values.length).join("-");
    },

    /**
     * Bewertet einen Spieler für einen konkreten Formations-Slot.
     * Fließen ein: effektive Bewertung auf der Position, Fitness und Form.
     */
    scorePlayerForSlot(player = {}, slotPos = null) {
        const suitability = this.getSuitability(player, slotPos);
        const fitnessFactor = 0.75 + ((player.fitness ?? 100) / 100) * 0.25;
        const formFactor = 0.92 + ((player.form ?? 7) / 10) * 0.08;
        return suitability.effectiveOverall * fitnessFactor * formFactor;
    },

    /**
     * Stellt die bestmögliche Elf für eine Formation zusammen.
     * Greedy-Zuordnung über alle Spieler/Slot-Kombinationen: die jeweils beste
     * verbleibende Paarung wird zuerst vergeben, damit Spezialisten ihre
     * Position bekommen und Notlösungen erst am Ende entstehen.
     *
     * @returns {Array} Spieler in Slot-Reihenfolge (kann Lücken mit null enthalten)
     */
    assignBestLineup(players = [], slots = []) {
        const available = (players || []).filter(Boolean);
        const slotList = (slots || []).map((s, idx) => ({ idx, pos: this.normalizePosition(s?.pos) || "ZM" }));
        const result = new Array(slotList.length).fill(null);

        if (available.length === 0 || slotList.length === 0) return result;

        // Alle Kombinationen bewerten
        const pairs = [];
        slotList.forEach(slot => {
            available.forEach(player => {
                pairs.push({
                    slotIdx: slot.idx,
                    player,
                    score: this.scorePlayerForSlot(player, slot.pos)
                });
            });
        });

        pairs.sort((a, b) => b.score - a.score);

        const takenSlots = new Set();
        const takenPlayers = new Set();

        pairs.forEach(pair => {
            if (takenSlots.has(pair.slotIdx) || takenPlayers.has(pair.player.id)) return;
            takenSlots.add(pair.slotIdx);
            takenPlayers.add(pair.player.id);
            result[pair.slotIdx] = pair.player;
        });

        // Restliche Slots notfalls mit übrigen Spielern auffüllen
        const leftovers = available.filter(p => !takenPlayers.has(p.id));
        for (let i = 0; i < result.length; i++) {
            if (!result[i] && leftovers.length > 0) {
                result[i] = leftovers.shift();
            }
        }

        return result;
    },

    /**
     * Erzeugt für einen Spieler ein realistisches Set an Nebenpositionen
     */
    generateSecondaryPositions(mainPos, rng = Math.random) {
        const main = this.normalizePosition(mainPos);
        if (!main) return [];
        if (main === "TW") return [];

        // Kandidaten sind Positionen mit brauchbarer Grundverwandtschaft
        const candidates = this.ALL_POSITIONS
            .filter(p => p !== main && p !== "TW")
            .map(p => ({ pos: p, fam: this.getBaseFamiliarity(main, p) }))
            .filter(c => c.fam >= 0.58)
            .sort((a, b) => b.fam - a.fam);

        if (candidates.length === 0) return [];

        // Rund drei von vier Feldspielern haben eine zweite Position, gut ein
        // Viertel sogar eine dritte. Die Auswahl bleibt nach Verwandtschaft
        // gewichtet: Ein Innenverteidiger wird eher Sechser als Flügelstürmer.
        const result = [];
        const roll = rng();
        if (roll >= 0.26) {
            result.push(candidates[0].pos);
            if (roll >= 0.72 && candidates[1]) result.push(candidates[1].pos);
            if (roll >= 0.93 && candidates[2]) result.push(candidates[2].pos);
        }
        return result;
    }
};

if (typeof window !== "undefined") {
    window.PositionEngine = PositionEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PositionEngine };
}
