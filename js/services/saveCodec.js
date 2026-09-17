/**
 * SaveCodec - Kompaktes Speicherformat für große Fußballwelten
 *
 * Ein Spielstand mit allen zwölf Ligen enthält über 4000 Spieler. Als
 * gewöhnliches JSON belegt jeder Spieler rund 1,2 KB - überwiegend
 * Schlüsselnamen, die sich viertausendfach wiederholen. Der LocalStorage
 * der Browser ist typischerweise auf 5 MB begrenzt.
 *
 * Der Codec wandelt Spieler und Spielplan-Partien deshalb in positionale
 * Arrays um und legt alle Zeichenketten in einer gemeinsamen Tabelle ab.
 * Namen, Nationalitäten und Positionen tauchen dadurch nur einmal auf.
 * Unbekannte Zusatzfelder wandern in ein Restobjekt und überleben die
 * Umwandlung unverändert.
 */

const SaveCodec = {
    FORMAT: "fmc1",

    /**
     * Feldschema der Spieler: [Pfad, Typ]
     * Typen: n = Zahl, s = Zeichenkette, b = Wahrheitswert,
     *        sa = Array aus Zeichenketten,
     *        sn = Zeichenkette oder Zahl (die handgepflegten Vereine nutzen
     *             fortlaufende Zahlen als Spieler-ID, erzeugte Spieler Text)
     */
    PLAYER_FIELDS: [
        ["id", "sn"], ["name", "s"], ["age", "n"], ["nationality", "s"],
        ["pos", "s"], ["secondPos", "s"], ["positions", "sa"], ["clubId", "s"],
        ["overall", "n"], ["pot", "n"],
        ["trueCurrentAbility", "n"], ["truePotentialAbility", "n"], ["trueMarketValue", "n"],
        ["value", "n"], ["wage", "n"], ["contractYears", "n"],
        ["fitness", "n"], ["morale", "n"], ["form", "n"],
        ["injured", "b"], ["injuredWeeks", "n"], ["injuryWeeks", "n"], ["injuryName", "s"],
        ["suspended", "b"], ["suspendedMatches", "n"], ["suspensionMatches", "n"],
        ["yellowCards", "n"], ["yellowCardsTotal", "n"], ["yellowCardsSeason", "n"],
        ["squadRole", "s"], ["transferListed", "b"], ["loanListed", "b"],
        ["pace", "n"], ["shooting", "n"], ["passing", "n"], ["dribbling", "n"],
        ["defense", "n"], ["physical", "n"], ["stamina", "n"], ["vision", "n"],
        ["technique", "n"], ["positioning", "n"],
        ["reflexes", "n"], ["handling", "n"], ["oneOnOne", "n"], ["kicking", "n"],
        ["stats.matches", "n"], ["stats.goals", "n"], ["stats.assists", "n"],
        ["stats.yellowCards", "n"], ["stats.redCards", "n"], ["stats.minutes", "n"],
        ["stats.cleanSheets", "n"], ["stats.ratingSum", "n"],
        ["hiddenAttributes.professionalism", "n"], ["hiddenAttributes.ambition", "n"],
        ["hiddenAttributes.consistency", "n"], ["hiddenAttributes.importantMatches", "n"],
        ["hiddenAttributes.injuryProneness", "n"], ["hiddenAttributes.adaptability", "n"],
        ["hiddenAttributes.loyalty", "n"], ["hiddenAttributes.temperament", "n"],
        ["scoutingKnowledge.known", "b"], ["scoutingKnowledge.knowledgeLevel", "n"],
        ["scoutingKnowledge.lastScoutedDate", "s"], ["scoutingKnowledge.reportsCount", "n"],
        ["scoutingKnowledge.accuracy", "n"],
        ["happiness.overall", "n"], ["happiness.playingTime", "n"], ["happiness.contract", "n"],
        ["happiness.teamPerformance", "n"], ["happiness.training", "n"], ["happiness.reason", "s"]
    ],

    /** Feldschema einer Spielplan-Partie */
    MATCH_FIELDS: [
        ["homeClubId", "s"], ["awayClubId", "s"], ["played", "b"],
        ["homeGoals", "n"], ["awayGoals", "n"], ["leagueId", "s"], ["summaryText", "s"]
    ],

    /** Erzeugt einen Zeichenketten-Sammler mit Rückwärtsindex */
    createDictionary() {
        const values = [];
        const index = new Map();
        return {
            values,
            put(str) {
                if (str === null || str === undefined) return -1;
                const key = String(str);
                if (index.has(key)) return index.get(key);
                const id = values.length;
                values.push(key);
                index.set(key, id);
                return id;
            }
        };
    },

    getPath(obj, path) {
        if (!path.includes(".")) return obj[path];
        const parts = path.split(".");
        let cur = obj;
        for (const part of parts) {
            if (cur === null || cur === undefined) return undefined;
            cur = cur[part];
        }
        return cur;
    },

    setPath(obj, path, value) {
        if (!path.includes(".")) {
            obj[path] = value;
            return;
        }
        const parts = path.split(".");
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    },

    /**
     * Das Schema einmal auflösen statt viertausendmal.
     *
     * `encodeRecord` zerlegte jeden der 72 Feldpfade für jeden einzelnen
     * Spieler neu in seine Bestandteile - und suchte für jedes Unterobjekt mit
     * einem vollständigen Durchlauf durch alle 72 Felder heraus, welche
     * Schlüssel das Schema kennt. Bei viertausendachthundert Spielern waren das
     * über eine Million Zeichenkettenoperationen je Speichervorgang: Das
     * Speichern dauerte 358 Millisekunden, und weil nach fast jeder Handlung
     * gespeichert wird, stand die Oberfläche dabei still.
     *
     * Die Auflösung hängt nur am Schema, nicht an den Daten - sie wird deshalb
     * einmal berechnet und am Schema-Array selbst gemerkt.
     */
    schemaOf(fields) {
        if (fields._schema) return fields._schema;

        const eintraege = fields.map(([path, type]) => {
            const parts = path.split(".");
            return { path, type, parts, wurzel: parts[0], tief: parts.length > 1 };
        });

        const bekannteWurzeln = new Set(eintraege.map(e => e.wurzel));
        // Je Wurzel: welche Unterschlüssel deckt das Schema ab?
        const abgedeckt = new Map();
        eintraege.forEach(e => {
            if (!e.tief) return;
            if (!abgedeckt.has(e.wurzel)) abgedeckt.set(e.wurzel, new Set());
            abgedeckt.get(e.wurzel).add(e.parts[1]);
        });

        const schema = { eintraege, bekannteWurzeln, abgedeckt };
        Object.defineProperty(fields, "_schema", { value: schema, enumerable: false });
        return schema;
    },

    /** Wert eines vorzerlegten Pfads lesen */
    readParts(obj, parts) {
        let cur = obj;
        for (let i = 0; i < parts.length; i++) {
            if (cur === null || cur === undefined) return undefined;
            cur = cur[parts[i]];
        }
        return cur;
    },

    /** Wandelt ein Objekt anhand eines Schemas in ein positionales Array */
    encodeRecord(obj, fields, dict) {
        const { eintraege, bekannteWurzeln, abgedeckt } = this.schemaOf(fields);
        const row = new Array(eintraege.length);

        for (let i = 0; i < eintraege.length; i++) {
            const e = eintraege[i];
            const raw = e.tief ? this.readParts(obj, e.parts) : obj[e.path];

            if (raw === undefined || raw === null) {
                row[i] = null;
            } else if (e.type === "s" || e.type === "sn") {
                row[i] = dict.put(raw);
            } else if (e.type === "sa") {
                row[i] = Array.isArray(raw) ? raw.map(v => dict.put(v)) : null;
            } else if (e.type === "b") {
                row[i] = raw ? 1 : 0;
            } else {
                row[i] = typeof raw === "number" ? raw : null;
            }
        }

        // Alles, was das Schema nicht kennt, bleibt als Restobjekt erhalten
        const rest = {};
        let hasRest = false;
        const schluessel = Object.keys(obj);
        for (let k = 0; k < schluessel.length; k++) {
            const key = schluessel[k];
            if (bekannteWurzeln.has(key)) {
                // Teilweise abgedeckte Unterobjekte auf unbekannte Schlüssel prüfen
                const covered = abgedeckt.get(key);
                const sub = obj[key];
                if (covered && sub && typeof sub === "object" && !Array.isArray(sub)) {
                    const subKeys = Object.keys(sub);
                    for (let s = 0; s < subKeys.length; s++) {
                        if (!covered.has(subKeys[s])) {
                            rest[key + "." + subKeys[s]] = sub[subKeys[s]];
                            hasRest = true;
                        }
                    }
                }
                continue;
            }
            rest[key] = obj[key];
            hasRest = true;
        }

        row.push(hasRest ? rest : null);

        // Nachlaufende Leerwerte abschneiden
        while (row.length > 0 && row[row.length - 1] === null) row.pop();
        return row;
    },

    decodeRecord(row, fields, dictValues) {
        const obj = {};
        const readString = (idx) => (typeof idx === "number" && idx >= 0 && idx < dictValues.length) ? dictValues[idx] : null;

        fields.forEach(([path, type], i) => {
            const raw = i < row.length ? row[i] : null;
            if (raw === null || raw === undefined) {
                // Fehlende Werte werden nicht gesetzt - Defaults der Engines greifen
                if (type === "sa") this.setPath(obj, path, []);
                else this.setPath(obj, path, type === "b" ? false : null);
                return;
            }
            if (type === "s") this.setPath(obj, path, readString(raw));
            else if (type === "sn") {
                const str = readString(raw);
                this.setPath(obj, path, /^-?\d+$/.test(str || "") ? Number(str) : str);
            }
            else if (type === "sa") this.setPath(obj, path, Array.isArray(raw) ? raw.map(readString).filter(v => v !== null) : []);
            else if (type === "b") this.setPath(obj, path, raw === 1 || raw === true);
            else this.setPath(obj, path, raw);
        });

        const rest = row.length > fields.length ? row[fields.length] : null;
        if (rest && typeof rest === "object") {
            Object.keys(rest).forEach(key => this.setPath(obj, key, rest[key]));
        }

        return obj;
    },

    /**
     * Kodiert einen kompletten Spielstand. Der Rest des States bleibt
     * unangetastet, nur Spieler und Spielpläne werden verdichtet.
     */
    encodeState(state) {
        if (!state || typeof state !== "object") return state;

        const dict = this.createDictionary();
        const encoded = {};

        Object.keys(state).forEach(key => {
            if (key === "players" || key === "schedule" || key === "otherSchedules") return;
            // Interne Felder des Speichervorgangs selbst gehören nicht in den
            // Spielstand - der Zeitgeber ist im Browser eine Zahl, in Node ein
            // Objekt mit Selbstbezug, an dem JSON.stringify scheitert.
            if (key.startsWith("_save")) return;
            encoded[key] = state[key];
        });

        encoded.__codec = this.FORMAT;

        if (Array.isArray(state.players)) {
            encoded.players = state.players.map(p => this.encodeRecord(p, this.PLAYER_FIELDS, dict));
        }
        if (Array.isArray(state.schedule)) {
            encoded.schedule = this.encodeSchedule(state.schedule, dict);
        }
        if (state.otherSchedules && typeof state.otherSchedules === "object") {
            const out = {};
            Object.keys(state.otherSchedules).forEach(leagueId => {
                out[leagueId] = this.encodeSchedule(state.otherSchedules[leagueId], dict);
            });
            encoded.otherSchedules = out;
        }

        encoded.__dict = dict.values;
        return encoded;
    },

    encodeSchedule(schedule, dict) {
        if (!Array.isArray(schedule)) return schedule;
        return schedule.map(round => [
            round.matchday,
            (round.matches || []).map(m => {
                // Ein leeres Ereignisfeld landet sonst in jedem der über 3000
                // Saisonspiele im Restobjekt - beim Auffalten wird es ohnehin
                // wieder angelegt.
                if (Array.isArray(m.events) && m.events.length === 0) {
                    const copy = Object.assign({}, m);
                    delete copy.events;
                    return this.encodeRecord(copy, this.MATCH_FIELDS, dict);
                }
                return this.encodeRecord(m, this.MATCH_FIELDS, dict);
            })
        ]);
    },

    decodeSchedule(rounds, dictValues) {
        if (!Array.isArray(rounds)) return rounds;
        return rounds.map(entry => ({
            matchday: entry[0],
            matches: (entry[1] || []).map(row => {
                const match = this.decodeRecord(row, this.MATCH_FIELDS, dictValues);
                if (!Array.isArray(match.events)) match.events = [];
                return match;
            })
        }));
    },

    /** Erkennt, ob ein State im kompakten Format vorliegt */
    isEncoded(state) {
        return !!(state && typeof state === "object" && state.__codec === this.FORMAT);
    },

    decodeState(state) {
        if (!this.isEncoded(state)) return state;

        const dictValues = Array.isArray(state.__dict) ? state.__dict : [];
        const decoded = {};

        Object.keys(state).forEach(key => {
            if (key === "players" || key === "schedule" || key === "otherSchedules" || key === "__dict" || key === "__codec") return;
            decoded[key] = state[key];
        });

        if (Array.isArray(state.players)) {
            decoded.players = state.players.map(row => this.decodeRecord(row, this.PLAYER_FIELDS, dictValues));
        }
        if (Array.isArray(state.schedule)) {
            decoded.schedule = this.decodeSchedule(state.schedule, dictValues);
        }
        if (state.otherSchedules && typeof state.otherSchedules === "object") {
            const out = {};
            Object.keys(state.otherSchedules).forEach(leagueId => {
                out[leagueId] = this.decodeSchedule(state.otherSchedules[leagueId], dictValues);
            });
            decoded.otherSchedules = out;
        }

        return decoded;
    }
};

if (typeof window !== "undefined") {
    window.SaveCodec = SaveCodec;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SaveCodec };
}
