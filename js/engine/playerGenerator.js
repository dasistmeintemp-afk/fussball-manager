/**
 * PlayerGenerator - Erzeugt realistische Spieler für Vereine aller Ligastufen
 */

class PlayerGenerator {
    static POSITIONS = ["TW", "IV", "LV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"];
    static SQUAD_DISTRIBUTION = [
        "TW", "TW", "TW",
        "IV", "IV", "IV", "IV",
        "LV", "LV", "RV", "RV",
        "DM", "DM", "ZM", "ZM", "ZM",
        "LM", "RM", "OM", "OM",
        "LA", "RA", "ST", "ST", "ST"
    ];

    /**
     * Auflösung der PlayerRatingEngine in Browser- und Node-Umgebung.
     *
     * Ohne diese Auflösung griff in Node eine Ersatzformel mit einer
     * Untergrenze von 30 Gesamtstärke - alle Amateurspieler kamen dadurch
     * exakt auf 30 heraus, unabhängig von der Ligastufe.
     */
    static getRatingEngine() {
        if (typeof PlayerRatingEngine !== "undefined" && PlayerRatingEngine) return PlayerRatingEngine;
        if (typeof window !== "undefined" && window.PlayerRatingEngine) return window.PlayerRatingEngine;
        if (typeof require !== "undefined") {
            try {
                return require("./playerRatingEngine.js").PlayerRatingEngine;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /** Rechnet interne Fähigkeit in Gesamtstärke um (mit sauberem Fallback) */
    static toOverall(ability) {
        const engine = this.getRatingEngine();
        if (engine) return engine.abilityToOverall(ability);
        return Math.max(1, Math.min(99, Math.round(ability / 2)));
    }

    /**
     * Auflösung der PositionEngine in Browser- und Node-Umgebung
     */
    static getPositionEngine() {
        if (typeof PositionEngine !== "undefined" && PositionEngine) return PositionEngine;
        if (typeof window !== "undefined" && window.PositionEngine) return window.PositionEngine;
        if (typeof require !== "undefined") {
            try {
                return require("./positionEngine.js").PositionEngine;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /**
     * Ermittelt CA & PA-Bandbreiten je nach Ligastufe.
     *
     * Die Stufen sind bewusst weit auseinander: Ein Landesligaspieler (Stufe 7)
     * liegt bei rund 12-30 Gesamtstärke, ein Bundesligaspieler (Stufe 1) bei
     * 65-92. Zwischen benachbarten Stufen bleibt jedoch eine Überschneidung,
     * damit ein Spitzenklub der 2. Liga stärker besetzt sein kann als ein
     * Abstiegskandidat der Bundesliga.
     */
    static getAbilityRangeForLevel(level = 1) {
        switch (level) {
            case 1: return { minCA: 128, maxCA: 176, minPA: 134, maxPA: 184 }; // Top-5 / Bundesliga
            case 2: return { minCA: 110, maxCA: 150, minPA: 115, maxPA: 165 }; // 2. Liga
            case 3: return { minCA: 95, maxCA: 135, minPA: 100, maxPA: 145 };  // 3. Liga
            case 4: return { minCA: 75, maxCA: 115, minPA: 80, maxPA: 130 };   // Regionalliga
            case 5: return { minCA: 55, maxCA: 95, minPA: 60, maxPA: 115 };    // Oberliga
            case 6: return { minCA: 40, maxCA: 75, minPA: 45, maxPA: 95 };     // Verbandsliga
            case 7: return { minCA: 25, maxCA: 60, minPA: 30, maxPA: 80 };     // Landesliga
            default: return { minCA: 50, maxCA: 90, minPA: 55, maxPA: 110 };
        }
    }

    /**
     * Verschiebt die Bandbreite einer Ligastufe nach dem Ruf des Vereins.
     *
     * clubStrength 0 = schwächster Klub der Liga, 1 = stärkster.
     * Dadurch bekommt der Meisterschaftsanwärter einer Liga spürbar bessere
     * Spieler als der Aufsteiger - und die Stufen überschneiden sich
     * realistisch an den Rändern.
     *
     * Der Faktor bestimmt, wie weit eine Liga auseinanderliegt. Er ist bewusst
     * auf die handgepflegten Bundesligakader abgestimmt: Ein aufgefüllter
     * Spieler beim Tabellenletzten darf nicht besser sein als dessen
     * Stammpersonal, sonst zieht die Ergänzung den Verein wieder auf
     * Ligadurchschnitt hoch und der Abstand in der Tabelle verschwindet.
     */
    static KADER_SPREIZUNG = 0.46;

    /**
     * Ganze Kader, die die Welt erzeugt, spreizen stärker: Die Untergrenze
     * wandert weiter als die Obergrenze, ein Spitzenklub hat also keine
     * schwachen Spieler im Kader, und oberhalb der Mitte steigt die Kurve
     * steiler. Mit der einfachen Spreizung lagen die ersten acht einer
     * erzeugten Liga innerhalb eines Punktes (Real Madrid schwächer als
     * Betis), und der Meister war Zufall.
     */
    static KADER_SPREIZUNG_UNTEN = 1.0;

    /**
     * Ligastärke je Land in der ersten Liga, als Verschiebung der Fähigkeit
     * (zwei Punkte entsprechen etwa einem Punkt Stärke). Die erzeugten
     * ersten Ligen waren alle gleich stark - die Ligue 1 so stark wie die
     * Premier League - und lagen rund zwei Punkte über der handgepflegten
     * Bundesliga. Deren Vereine verloren damit im Europapokal fast alles,
     * und Deutschland fiel in der Fünfjahreswertung dauerhaft auf den
     * letzten Platz. Jetzt gilt grob die echte Rangfolge: England vorn,
     * Spanien und Italien auf Augenhöhe mit der Bundesliga, Frankreich
     * dahinter. Mit -7 holte Frankreich im Europapokal im Langlauf so viel
     * wie Deutschland (je 7,8 Punkte je Saison); in Wirklichkeit liegt es
     * klar dahinter - jetzt -9.
     */
    static LAND_STAERKE = {
        en: -1, es: -4, it: -4, fr: -9,
        // Die Länder im Hintergrund: oben einige starke Vereine, in der
        // Breite deutlich unter den großen fünf
        nl: -16, pt: -15, br: -16, tr: -20, be: -21, at: -27, ch: -27, sc: -29
    };
    /**
     * Talentschmieden: Die Länder im Hintergrund sind in der Breite
     * schwächer als die großen fünf - ihre Jugend ist es nicht unbedingt.
     * Brasilien, die Niederlande, Portugal und Belgien bilden seit
     * Jahrzehnten Spieler für die großen Ligen aus. Bisher galt der
     * Abschlag des Landes auch für das Potenzial der Jungen; in den
     * Niederlanden gab es zum Start kein einziges Talent mit Potenzial ab
     * 88, in Belgien, Österreich, der Schweiz und Schottland keines ab 85.
     *
     * Jetzt wird bei Spielern bis 21 dieser Anteil des Abschlags beim
     * Potenzial zurückgenommen, in der ersten wie in der zweiten Liga: Sie
     * spielen heute auf dem Niveau ihrer Liga, können aber darüber
     * hinauswachsen. Die Schlüssel sind zugleich die Länder im Hintergrund.
     */
    static TALENTSCHMIEDE = { br: 1.0, nl: 0.9, pt: 0.9, be: 0.7, ch: 0.5, tr: 0.4, at: 0.4, sc: 0.2 };
    static KADER_KOPF = 0.35;

    /**
     * Eine Form für alle Spieler.
     *
     * Das Spiel wurde mit den Jahren langsamer, bei gleich vielen Spielern:
     * Dieselben 60 Tage dauerten in der sechsten Saison ein Fünftel länger
     * als in der ersten. Der Grund lag in den Spielerobjekten. Felder wie
     * „abgestellt“ (Länderspiel), „laufbahnTeile“, „leihe“ oder „reserve“
     * kamen unter dem Jahr dazu und wurden mit delete wieder entfernt -
     * jedes delete schaltet ein Objekt in den langsamen Wörterbuch-Modus,
     * nach zwei Saisons traf das 2.284 Spieler. Und weil jeder Spieler seine
     * Felder in anderer Reihenfolge bekam, gab es statt 6 schließlich 1.317
     * verschiedene Formen; jeder Zugriff auf p.id oder p.injuredWeeks wurde
     * zur Suche.
     *
     * Jetzt hat jeder Spieler von Anfang an alle Felder in derselben
     * Reihenfolge (fehlende als undefined - im Spielstand stehen sie nicht),
     * und Felder werden auf undefined gesetzt statt gelöscht.
     */
    static FORM_FELDER = ["id", "clubId", "name", "age", "nationality", "pos", "secondPos", "positions", "overall", "pot",
        "trueCurrentAbility", "truePotentialAbility", "trueMarketValue", "value", "wage", "contractYears", "fitness", "morale", "form",
        "injured", "injuredWeeks", "injuryWeeks", "injuryName", "suspended", "suspendedMatches", "yellowCards", "yellowCardsTotal",
        "squadRole", "happiness", "stats", "statsPokal", "statsEuropa", "hiddenAttributes", "scoutingKnowledge",
        "pace", "shooting", "passing", "dribbling", "defense", "physical", "stamina", "vision", "technique", "positioning",
        "reflexes", "handling", "oneOnOne", "kicking", "decisions", "anticipation", "composure", "concentration", "workRate",
        "teamwork", "leadership", "offTheBall", "kopfStand", "foot", "traits", "signatur",
        "spielpraxis", "matchSharpness", "daysSinceInjury", "laufbahn", "laufbahnTeile", "vereinSeit", "laenderspiele", "laenderspielTore",
        "abgestellt", "verletztVomLaenderspiel", "auszeichnungen", "transferListed", "vereinslosAb", "leihe", "reserve",
        "vorvertrag", "vorvertragInteresse", "klauseln", "praemien", "versprechen", "mentorId", "wechselwunsch", "gespraechswunsch",
        "unmutTage", "trainingsfokus", "umschulung", "eigenheitTraining", "weiterverkauf", "trainingLog", "medien", "eigengewaechsVon", "ausgebildetVon",
        "jugendvertrag", "u19", "u23", "nominiertAus", "leihListe"];

    /**
     * Ein Spieler in der gemeinsamen Form: alle Felder in fester Reihenfolge,
     * Unbekanntes hinten an. Als Objektliteral geschrieben, nicht in einer
     * Schleife - über berechnete Schlüssel angelegt landete jedes Objekt
     * sofort im Wörterbuch-Modus. Die Reihenfolge ist FORM_FELDER (ein Test
     * prüft, dass beide übereinstimmen).
     */
    static forme(p) {
        if (!p || typeof p !== "object") return p;
        const o = {
            id: p.id, clubId: p.clubId, name: p.name, age: p.age, nationality: p.nationality, pos: p.pos, secondPos: p.secondPos,
            positions: p.positions, overall: p.overall, pot: p.pot, trueCurrentAbility: p.trueCurrentAbility,
            truePotentialAbility: p.truePotentialAbility, trueMarketValue: p.trueMarketValue, value: p.value, wage: p.wage,
            contractYears: p.contractYears, fitness: p.fitness, morale: p.morale, form: p.form, injured: p.injured,
            injuredWeeks: p.injuredWeeks, injuryWeeks: p.injuryWeeks, injuryName: p.injuryName, suspended: p.suspended,
            suspendedMatches: p.suspendedMatches, yellowCards: p.yellowCards, yellowCardsTotal: p.yellowCardsTotal,
            squadRole: p.squadRole, happiness: p.happiness, stats: p.stats, statsPokal: p.statsPokal, statsEuropa: p.statsEuropa,
            hiddenAttributes: p.hiddenAttributes, scoutingKnowledge: p.scoutingKnowledge, pace: p.pace, shooting: p.shooting,
            passing: p.passing, dribbling: p.dribbling, defense: p.defense, physical: p.physical, stamina: p.stamina,
            vision: p.vision, technique: p.technique, positioning: p.positioning, reflexes: p.reflexes, handling: p.handling,
            oneOnOne: p.oneOnOne, kicking: p.kicking, decisions: p.decisions, anticipation: p.anticipation,
            composure: p.composure, concentration: p.concentration, workRate: p.workRate, teamwork: p.teamwork,
            leadership: p.leadership, offTheBall: p.offTheBall, kopfStand: p.kopfStand, foot: p.foot, traits: p.traits,
            signatur: p.signatur, spielpraxis: p.spielpraxis, matchSharpness: p.matchSharpness,
            daysSinceInjury: p.daysSinceInjury, laufbahn: p.laufbahn, laufbahnTeile: p.laufbahnTeile, vereinSeit: p.vereinSeit,
            laenderspiele: p.laenderspiele, laenderspielTore: p.laenderspielTore, abgestellt: p.abgestellt,
            verletztVomLaenderspiel: p.verletztVomLaenderspiel, auszeichnungen: p.auszeichnungen,
            transferListed: p.transferListed, vereinslosAb: p.vereinslosAb, leihe: p.leihe, reserve: p.reserve,
            vorvertrag: p.vorvertrag, vorvertragInteresse: p.vorvertragInteresse, klauseln: p.klauseln, praemien: p.praemien,
            versprechen: p.versprechen, mentorId: p.mentorId, wechselwunsch: p.wechselwunsch,
            gespraechswunsch: p.gespraechswunsch, unmutTage: p.unmutTage, trainingsfokus: p.trainingsfokus,
            umschulung: p.umschulung, eigenheitTraining: p.eigenheitTraining, weiterverkauf: p.weiterverkauf,
            trainingLog: p.trainingLog, medien: p.medien, eigengewaechsVon: p.eigengewaechsVon,
            ausgebildetVon: p.ausgebildetVon, jugendvertrag: p.jugendvertrag, u19: p.u19, u23: p.u23,
            nominiertAus: p.nominiertAus, leihListe: p.leihListe
        };
        for (const k in p) if (!(k in o)) o[k] = p[k];
        return o;
    }

    static getAbilityRangeForClub(level = 1, clubStrength = 0.5, options = {}) {
        const range = this.getAbilityRangeForLevel(level);
        const strength = Math.max(0, Math.min(1, clubStrength));

        const caSpan = range.maxCA - range.minCA;
        const paSpan = range.maxPA - range.minPA;
        const caShift = Math.round((strength - 0.5) * caSpan * this.KADER_SPREIZUNG);
        const paShift = Math.round((strength - 0.5) * paSpan * this.KADER_SPREIZUNG);

        // Obergrenze je Ligastufe: Auch der Spitzenklub der stärksten Liga
        // stellt keine Spieler jenseits der handgepflegten Bundesligastars.
        const caDeckel = Math.round(range.maxCA * 1.03);
        const paDeckel = Math.round(range.maxPA * 1.03);

        if (options.ganzerKader) {
            // Kopf: Oberhalb der Ligamitte steigt die Kurve zusätzlich
            const kopf = Math.max(0, strength - 0.6) / 0.4;
            // Unterhalb der Mitte bleibt es bei der gewohnten Spreizung - sonst
            // fällt das Tabellenende einer erzeugten Liga unter das der Bundesliga
            const faktorUnten = strength >= 0.5 ? this.KADER_SPREIZUNG_UNTEN : this.KADER_SPREIZUNG;
            const unten = Math.round((strength - 0.5) * caSpan * faktorUnten + kopf * kopf * caSpan * this.KADER_KOPF);
            const oben = caShift + Math.round(kopf * kopf * caSpan * this.KADER_KOPF * 0.5);
            const minCA = Math.max(15, range.minCA + unten);
            return {
                minCA,
                maxCA: Math.max(minCA + 8, Math.min(caDeckel, range.maxCA + oben)),
                minPA: Math.max(20, range.minPA + paShift),
                maxPA: Math.min(paDeckel, range.maxPA + paShift)
            };
        }

        return {
            minCA: Math.max(15, range.minCA + caShift),
            maxCA: Math.min(caDeckel, range.maxCA + caShift),
            minPA: Math.max(20, range.minPA + paShift),
            maxPA: Math.min(paDeckel, range.maxPA + paShift)
        };
    }

    /**
     * Das Potenzial eines Talents (bis 21), gemessen an der Stärke, die ein
     * gestandener Spieler dieses Vereins hätte (baseCA).
     *
     * Bisher hing es am jetzigen Können: 12 bis 48 Punkte darüber, im Mittel
     * 26. Weil ein Talent zuvor 0 bis 20 Punkte unter dem Vereinsniveau
     * begann, lag sein Potenzial im Mittel 17 Punkte (gut 8 Punkte
     * Gesamtstärke) über den gestandenen Spielern. Jede Generation wurde so
     * besser als die vorige: In vier Saisons stieg die Landesliga von 22,9
     * auf 27,4, und die Zahl der Spieler ab 90 verdreifachte sich von 51 auf
     * 150.
     *
     * Jetzt liegt das Potenzial um das Vereinsniveau: meist etwas darüber,
     * selten weit darüber - ein Ausnahmetalent bleibt eine Ausnahme. Etwas
     * Luft nach oben hat jeder.
     */
    static TALENT = { abstand: -8, spanne: 36, kurve: 2, mindestLuft: 6 };

    static talentPotenzial(baseCA, trueCA) {
        const t = this.TALENT;
        const pa = baseCA + t.abstand + Math.floor(Math.pow(Math.random(), t.kurve) * t.spanne);
        return Math.max(trueCA + t.mindestLuft, pa);
    }

    /**
     * Potenzial deckeln: nicht weit über die Spanne der Liga hinaus, und
     * oberhalb von 180 (Gesamtstärke 90) zählt jeder Punkt nur halb. Die
     * Weltspitze bleibt so dünn besetzt, statt Saison für Saison
     * aufzurücken.
     */
    static potenzialDeckel(pa, maxPA = 190) {
        let wert = Math.min(pa, maxPA + 6);
        if (wert > 180) wert = 180 + (wert - 180) * 0.5;
        return Math.min(194, Math.round(wert));
    }

    /**
     * Länderspezifische Namenspools. Ein spanischer Zweitligist soll keine
     * Mannschaft voller "Müller" stellen.
     */
    static resolveNamePool(countryId) {
        // In Node fehlte der Rückgriff auf die Datei: Jede Welt aus den Tests
        // und Messungen bestand aus sechs Nationen, England gab es nicht.
        const pools = (typeof COUNTRY_NAME_POOLS !== "undefined" && COUNTRY_NAME_POOLS)
            ? COUNTRY_NAME_POOLS
            : ((typeof window !== "undefined" && window.COUNTRY_NAME_POOLS) ? window.COUNTRY_NAME_POOLS
                : (typeof require !== "undefined" ? (() => { try { return require("../data/countryNamePools.js").COUNTRY_NAME_POOLS; } catch (e) { return null; } })() : null));

        if (pools && countryId && pools[countryId]) return pools[countryId];
        if (pools && pools.de) return pools.de;

        if (typeof NAME_POOLS !== "undefined" && NAME_POOLS) return NAME_POOLS;
        if (typeof window !== "undefined" && window.NAME_POOLS) return window.NAME_POOLS;
        return {
            firstNames: ["Lukas", "Leon", "Finn", "Maximilian", "Paul", "Julian", "David", "Tim", "Tobias", "Marco"],
            lastNames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz"],
            nationalities: ["Deutschland", "Deutschland", "Österreich", "Schweiz", "Frankreich", "Spanien", "Italien"]
        };
    }

    /**
     * Marktwert und Wochengehalt.
     *
     * Der Marktwert folgt einer Exponentialkurve über die Gesamtstärke - so
     * kostet ein 83er Stürmer rund 38 Mio., ein 46er Regionalligaspieler gut
     * 100.000 Euro. Der Ligafaktor bildet ab, dass dieselbe Stärke in einer
     * schwächeren Liga weniger Marktwert erzeugt.
     */
    static getValueAndWage(overall, level = 1, age = 25) {
        const LEVEL_VALUE_FACTOR = { 1: 1.0, 2: 0.7, 3: 0.5, 4: 0.35, 5: 0.25, 6: 0.18, 7: 0.12 };
        const LEVEL_BASE_WAGE = { 1: 8000, 2: 3000, 3: 1500, 4: 700, 5: 350, 6: 200, 7: 120 };

        const levelFactor = LEVEL_VALUE_FACTOR[level] ?? 0.2;
        const baseWage = LEVEL_BASE_WAGE[level] ?? 300;

        // Alterskurve: Höhepunkt des Marktwerts zwischen 23 und 28
        let ageFactor = 1.0;
        if (age <= 21) ageFactor = 1.12;
        else if (age <= 28) ageFactor = 1.0;
        else if (age <= 31) ageFactor = 0.72;
        else if (age <= 33) ageFactor = 0.48;
        else ageFactor = 0.3;

        const raw = 150000 * Math.pow(1.13, overall - 40) * levelFactor * ageFactor;
        const value = Math.max(1000, Math.round(raw / 1000) * 1000);
        const wage = Math.max(150, Math.round((value * 0.002 + baseWage) / 50) * 50);

        return { value, wage };
    }

    /**
     * Das Alter eines Spielers.
     *
     * Vorher wurde gleichverteilt zwischen 17 und 34 gewürfelt. Ein Kader sah
     * dadurch aus wie eine Stichprobe aus der Bevölkerung, nicht wie eine
     * Mannschaft: Gemessen waren 22 % höchstens zwanzig, 17 % zwischen 24 und
     * 26, und 11 % dreiunddreißig oder älter. In Wirklichkeit ballt sich ein
     * Kader in den besten Jahren - rund 8 % sind Jugendliche, gut ein Viertel
     * ist 24 bis 26, und nur jeder Zwanzigste ist über 32.
     *
     * Die Gewichte bilden diesen Bogen nach: Anstieg bis Mitte zwanzig,
     * langes Plateau, danach ein deutlicher Abfall. Ein von außen gesetzter
     * Altersbogen (etwa beim Nachziehen von Talenten) schneidet den Bogen
     * einfach zurecht.
     */
    static ALTERSGEWICHTE = {
        16: 0.2, 17: 0.6, 18: 1.2, 19: 2.0, 20: 3.2,
        21: 4.6, 22: 6.0, 23: 7.2, 24: 8.2, 25: 8.8,
        26: 8.8, 27: 8.4, 28: 7.8, 29: 7.0, 30: 6.0,
        31: 4.8, 32: 3.6, 33: 2.4, 34: 1.5, 35: 0.9,
        36: 0.5, 37: 0.3
    };

    static wuerfleAlter(minAlter, maxAlter) {
        const von = Math.min(minAlter, maxAlter);
        const bis = Math.max(minAlter, maxAlter);

        let summe = 0;
        const eintraege = [];
        for (let a = von; a <= bis; a++) {
            const g = this.ALTERSGEWICHTE[a] ?? 0.2;
            summe += g;
            eintraege.push([a, summe]);
        }
        if (summe <= 0) return von;

        const wurf = Math.random() * summe;
        for (const [alter, grenze] of eintraege) {
            if (wurf <= grenze) return alter;
        }
        return bis;
    }

    /**
     * Erzeugt einen einzelnen Spieler
     */
    static generatePlayer(clubId, level = 1, preferredPosition = null, customId = null, options = {}) {
        const pool = this.resolveNamePool(options.countryId);

        const firstName = pool.firstNames[Math.floor(Math.random() * pool.firstNames.length)];
        const lastName = pool.lastNames[Math.floor(Math.random() * pool.lastNames.length)];
        const nationality = pool.nationalities[Math.floor(Math.random() * pool.nationalities.length)];

        const pos = preferredPosition || this.POSITIONS[Math.floor(Math.random() * this.POSITIONS.length)];
        // Standard ist der volle Altersbogen eines Kaders. Beim Nachziehen von
        // Talenten wird der Bogen von außen enger gesetzt.
        const [minAlter, maxAlter] = Array.isArray(options.ageRange) && options.ageRange.length === 2
            ? options.ageRange
            : [17, 34];
        const age = this.wuerfleAlter(minAlter, maxAlter);

        // Nebenpositionen: nicht jeder Spieler kann überall spielen
        const positionEngine = this.getPositionEngine();
        const secondaryPositions = positionEngine ? positionEngine.generateSecondaryPositions(pos) : [];

        // Die Kaderstärke richtet sich nach Ligastufe UND Ruf des Vereins
        const abilityRange = this.getAbilityRangeForClub(level, options.clubStrength ?? 0.5, { ganzerKader: options.ganzerKader === true });
        // Dazu der Ausgleich je Liga (WorldGenerator.niveauAusgleich): Wer
        // beim Saisonwechsel nachgezogen wird, passt zur Liga, wie sie war
        // Die großen Länder unterscheiden sich nur in der ersten Liga; ihre
        // Unterhäuser sind gleich gebaut. Die Länder im Hintergrund haben
        // auch in der zweiten Liga ihren Abschlag - sonst spielte die zweite
        // niederländische Liga auf dem Niveau der zweiten Bundesliga.
        const imHintergrund = this.TALENTSCHMIEDE[options.countryId] !== undefined;
        const mitLandesabschlag = level === 1 || (level === 2 && imHintergrund);
        const landVerschiebung = (mitLandesabschlag ? (this.LAND_STAERKE[options.countryId] || 0) : 0) + (Number(options.staerkeVersatz) || 0);
        if (landVerschiebung) {
            abilityRange.minCA += landVerschiebung;
            abilityRange.maxCA += landVerschiebung;
            abilityRange.maxPA += landVerschiebung;
        }
        const caSpread = Math.max(1, abilityRange.maxCA - abilityRange.minCA);
        const baseCA = abilityRange.minCA + Math.floor(Math.random() * caSpread);

        // Alterseinfluss auf CA / PA
        let trueCA = baseCA;
        let truePA = Math.max(trueCA, trueCA + Math.floor(Math.random() * (abilityRange.maxPA - trueCA + 1)));

        // Talentschmiede: der zurückgenommene Teil des Landesabschlags (CA-Punkte)
        const schmiede = (age <= 21 && mitLandesabschlag && landVerschiebung < 0)
            ? Math.round(-(this.LAND_STAERKE[options.countryId] || 0) * (this.TALENTSCHMIEDE[options.countryId] || 0))
            : 0;
        if (age <= 21) {
            trueCA = Math.max(20, trueCA - Math.floor(Math.random() * 20));
            truePA = this.talentPotenzial(baseCA + schmiede, trueCA);
        } else if (age >= 31) {
            trueCA = Math.max(30, trueCA - (age - 30) * 3);
            truePA = trueCA;
        }
        truePA = Math.max(trueCA, this.potenzialDeckel(truePA, abilityRange.maxPA + schmiede));

        const overall = this.toOverall(trueCA);
        const pot = Math.max(overall, this.toOverall(truePA));

        const { value, wage } = this.getValueAndWage(overall, level, age);

        const id = customId || `p_${clubId}_${pos}_${Math.random().toString(36).substring(2, 8)}`;

        const ratingEngine = this.getRatingEngine();
        const hiddenAttributes = ratingEngine
            ? ratingEngine.generateHiddenAttributes({ age, overall })
            : { professionalism: 12, ambition: 12, consistency: 12, importantMatches: 12, injuryProneness: 8, adaptability: 12, loyalty: 14, temperament: 12 };

        const knownByUser = options.knownByUser === true;
        // Einmal würfeln, dann überall dieselben Werte verwenden
        const attribute = this.generateAttributes(pos, overall);

        const spieler = Object.assign({
            id: id,
            name: `${firstName} ${lastName}`,
            age: age,
            nationality: nationality,
            pos: pos,
            secondPos: secondaryPositions[0] || null,
            positions: secondaryPositions,
            clubId: clubId,
            overall: overall,
            pot: pot,
            trueCurrentAbility: trueCA,
            truePotentialAbility: truePA,
            trueMarketValue: value,
            value: value,
            wage: wage,
            contractYears: 1 + Math.floor(Math.random() * 4),
            fitness: 90 + Math.floor(Math.random() * 11),
            morale: 75 + Math.floor(Math.random() * 20),
            form: 6.5 + parseFloat((Math.random() * 1.5).toFixed(1)),
            // Feldnamen identisch zu den handgepflegten Vereinen aus initialData.js -
            // sonst greifen Aufstellungs- und Sperrprüfungen ins Leere.
            injured: false,
            injuredWeeks: 0,
            injuryWeeks: 0,
            injuryName: null,
            suspended: false,
            suspendedMatches: 0,
            yellowCards: 0,
            yellowCardsTotal: 0,
            stats: {
                matches: 0,
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
                minutes: 0,
                cleanSheets: 0,
                ratingSum: 0
            },
            hiddenAttributes: hiddenAttributes,
            scoutingKnowledge: {
                known: knownByUser,
                knowledgeLevel: knownByUser ? 90 : 25,
                lastScoutedDate: knownByUser ? "Saisonstart" : null,
                reportsCount: 0,
                accuracy: knownByUser ? 90 : 25
            },
            happiness: {
                overall: 75,
                playingTime: 75,
                contract: 75,
                teamPerformance: 75,
                training: 75,
                reason: "Zufrieden mit der aktuellen Situation."
            }
        }, attribute, this.buildCharacter(pos, attribute));
        // Die Kopfwerte folgen aus Kennung, Stärke, Alter und Persönlichkeit
        this.ergaenzeKopfwerte(spieler);
        return this.forme(spieler);
    }

    /**
     * Fuß und Eigenheiten.
     *
     * Die Eigenheiten müssen aus GENAU den Werten entstehen, die der Spieler
     * am Ende trägt - sonst steht bei einem Spieler mit Ausdauer 60 "Läuft
     * neunzig Minuten durch". Deshalb bekommt diese Funktion die fertigen
     * Attribute übergeben, statt neue zu würfeln.
     */
    static buildCharacter(pos, attribute) {
        return {
            foot: this.rollFoot(pos),
            traits: this.rollTraits(Object.assign({ pos }, attribute))
        };
    }

    /**
     * Starker Fuß.
     *
     * Rechtsfüßer sind die Mehrheit, auf der linken Außenbahn dreht sich das
     * Verhältnis, und ein paar wenige können beides. Das ist keine
     * Fachsimpelei: Jeder versteht sofort, warum ein Linksfuß auf links
     * anders wirkt als ein Rechtsfuß.
     */
    static rollFoot(pos) {
        const linksLastig = ["LV", "LM", "LA"].includes(pos);
        const wurf = Math.random();

        if (wurf < 0.06) return "beidfüßig";
        if (linksLastig) return wurf < 0.62 ? "links" : "rechts";
        if (["RV", "RM", "RA"].includes(pos)) return wurf < 0.88 ? "rechts" : "links";
        return wurf < 0.76 ? "rechts" : "links";
    }

    /**
     * Eigenheiten, die man einem Spieler ansieht.
     *
     * Ein Kader aus lauter Zahlenkolonnen fühlt sich austauschbar an. Zwei
     * Sätze pro Spieler - "sucht den Abschluss aus der Distanz", "geht in
     * jeden Zweikampf" - machen daraus Charaktere, ohne dass man dafür etwas
     * lernen oder einstellen müsste. Sie ergeben sich aus den Werten, die der
     * Spieler ohnehin hat, und stehen deshalb nie im Widerspruch dazu.
     */
    static EIGENHEITEN = [
        { key: "distanzschuss", text: "Sucht den Abschluss aus der Distanz.", passt: (p) => p.shooting >= 78 && p.technique >= 72 },
        { key: "dribbler", text: "Geht gern ins Eins-gegen-eins.", passt: (p) => p.dribbling >= 80 && p.pace >= 74 },
        { key: "flanken", text: "Bringt den Ball früh und scharf in den Strafraum.", passt: (p) => ["LV", "RV", "LM", "RM", "LA", "RA"].includes(p.pos) && p.passing >= 72 },
        { key: "tiefenpass", text: "Sieht den Pass in die Tiefe vor allen anderen.", passt: (p) => p.vision >= 80 && p.passing >= 78 },
        { key: "zweikampf", text: "Geht in jeden Zweikampf, koste es was es wolle.", passt: (p) => p.defense >= 76 && p.physical >= 74 },
        { key: "kopfball", text: "Bei Standards immer gefährlich in der Luft.", passt: (p) => p.physical >= 80 },
        { key: "antritt", text: "Über die ersten zehn Meter kaum einzuholen.", passt: (p) => p.pace >= 85 },
        { key: "ausdauer", text: "Läuft neunzig Minuten durch, ohne langsamer zu werden.", passt: (p) => p.stamina >= 85 },
        { key: "ruhe", text: "Behält vor dem Tor die Ruhe.", passt: (p) => p.shooting >= 75 && ["ST", "LA", "RA", "OM"].includes(p.pos) },
        { key: "aufbau", text: "Holt sich den Ball tief und macht das Spiel.", passt: (p) => ["ZM", "DM"].includes(p.pos) && p.passing >= 74 },
        { key: "strafraum", text: "Steht immer da, wo der Ball hinfällt.", passt: (p) => ["ST"].includes(p.pos) && p.positioning >= 74 },
        { key: "mitspielen", text: "Spielt mit dem Fuß wie ein Feldspieler.", passt: (p) => p.pos === "TW" && p.passing >= 62 },
        { key: "reaktion", text: "Reagiert auf der Linie außergewöhnlich schnell.", passt: (p) => p.pos === "TW" && p.reflexes >= 82 },
        { key: "nachinnen", text: "Zieht vom Flügel nach innen und sucht den Abschluss.", passt: (p) => ["LA", "RA", "LM", "RM"].includes(p.pos) && p.shooting >= 70 && p.dribbling >= 72 },
        { key: "freistoss", text: "Gefährlich bei direkten Freistößen.", passt: (p) => p.pos !== "TW" && p.technique >= 76 && p.shooting >= 72 },
        { key: "elfmeter", text: "Verwandelt Elfmeter sicher.", passt: (p) => p.pos !== "TW" && p.shooting >= 74 && p.technique >= 70 },
        { key: "elfmeterkiller", text: "Ahnt beim Elfmeter oft die richtige Ecke.", passt: (p) => p.pos === "TW" && p.oneOnOne >= 76 },
        { key: "knipser", text: "Braucht vor dem Tor nur eine Chance.", passt: (p) => ["ST", "LA", "RA"].includes(p.pos) && p.shooting >= 80 },
        { key: "verlagerung", text: "Verlagert das Spiel mit langen Diagonalbällen.", passt: (p) => ["IV", "DM", "ZM", "LV", "RV"].includes(p.pos) && p.passing >= 76 && p.vision >= 72 }
    ];

    /** Wählt bis zu zwei passende Eigenheiten aus */
    static rollTraits(player) {
        const passende = this.EIGENHEITEN.filter(e => {
            try { return e.passt(player); } catch (err) { return false; }
        });
        if (passende.length === 0) return [];

        // Nicht jeder hat eine Marke - das macht sie erst besonders
        const anzahl = Math.random() < 0.32 ? 0 : (Math.random() < 0.78 ? 1 : 2);
        if (anzahl === 0) return [];

        const gemischt = passende.slice().sort(() => Math.random() - 0.5);
        return gemischt.slice(0, anzahl).map(e => ({ key: e.key, text: e.text }));
    }

    /**
     * Erzeugt ein Attributprofil passend zu Position und Gesamtstärke.
     *
     * Ohne diese Werte fällt die Match-Engine für jedes Attribut auf die
     * Gesamtstärke zurück - alle erzeugten Spieler spielen dann auf jeder
     * Position gleich gut und Scout- sowie Detailansichten bleiben leer.
     */
    static generateAttributes(pos, overall) {
        const jitter = (base, spread = 6) => Math.max(1, Math.min(99, Math.round(base + (Math.random() * 2 - 1) * spread)));
        const o = overall;

        if (pos === "TW") {
            return {
                reflexes: jitter(o + 2, 4),
                handling: jitter(o, 4),
                oneOnOne: jitter(o, 5),
                positioning: jitter(o, 4),
                kicking: jitter(o - 4, 8),
                pace: jitter(Math.min(o, 55), 8),
                shooting: jitter(20, 6),
                passing: jitter(o - 12, 8),
                dribbling: jitter(35, 8),
                defense: jitter(25, 6),
                physical: jitter(o - 3, 6),
                stamina: jitter(o - 4, 6),
                vision: jitter(o - 8, 7),
                technique: jitter(o - 8, 7)
            };
        }

        const profile = this.PROFILE[pos] || this.PROFILE.ZM;
        const attrs = {};
        this.FELDWERTE.forEach(key => {
            attrs[key] = jitter(o + (profile[key] || 0), 5);
        });

        // Feldspieler brauchen die Torwartwerte nur als Notnagel
        attrs.reflexes = jitter(20, 6);
        attrs.handling = jitter(20, 6);
        attrs.oneOnOne = jitter(20, 6);
        attrs.kicking = jitter(o - 20, 8);

        return attrs;
    }

    static FELDWERTE = ["pace", "shooting", "passing", "dribbling", "defense", "physical", "stamina", "vision", "technique", "positioning"];
    static TORWARTWERTE = { reflexes: 2, handling: 0, oneOnOne: 0, positioning: 0 };

    /** Gewichtungen je Positionsgruppe: relativer Auf-/Abschlag zur Gesamtstärke */
    static PROFILE = {
            IV: { defense: 6, physical: 5, positioning: 4, pace: -4, passing: -3, dribbling: -8, shooting: -18, vision: -6, technique: -5, stamina: 2 },
            LV: { defense: 3, pace: 5, stamina: 6, physical: 0, positioning: 1, passing: 0, dribbling: 1, shooting: -12, vision: -3, technique: 0 },
            RV: { defense: 3, pace: 5, stamina: 6, physical: 0, positioning: 1, passing: 0, dribbling: 1, shooting: -12, vision: -3, technique: 0 },
            DM: { defense: 5, passing: 3, stamina: 5, physical: 3, positioning: 3, vision: 1, technique: 0, dribbling: -3, pace: -3, shooting: -8 },
            ZM: { passing: 5, vision: 5, stamina: 5, technique: 3, defense: -1, dribbling: 1, physical: -1, positioning: 0, pace: -2, shooting: -3 },
            LM: { passing: 3, stamina: 6, pace: 4, dribbling: 3, technique: 2, vision: 2, defense: -4, physical: -3, positioning: -2, shooting: -4 },
            RM: { passing: 3, stamina: 6, pace: 4, dribbling: 3, technique: 2, vision: 2, defense: -4, physical: -3, positioning: -2, shooting: -4 },
            OM: { vision: 6, technique: 6, passing: 5, dribbling: 5, shooting: 2, pace: 1, defense: -16, physical: -8, positioning: -6, stamina: -1 },
            LA: { pace: 8, dribbling: 7, technique: 5, shooting: 2, vision: 0, passing: -1, defense: -20, physical: -8, positioning: -8, stamina: 0 },
            RA: { pace: 8, dribbling: 7, technique: 5, shooting: 2, vision: 0, passing: -1, defense: -20, physical: -8, positioning: -8, stamina: 0 },
            ST: { shooting: 8, pace: 4, physical: 4, dribbling: 2, technique: 2, vision: -1, passing: -4, defense: -22, positioning: -4, stamina: -1 }
    };

    // ------------------------------------------------------------ Kopfwerte

    /**
     * Die Kopfwerte: was ein Spieler im Kopf mitbringt.
     *
     * Bisher stand in der Akte nur, was man sieht - Tempo, Schuss, Passen.
     * Was einen Spieler im Spiel ausmacht, lag versteckt in seiner
     * Persönlichkeit oder fehlte ganz: ob er die richtige Entscheidung
     * trifft, den Pass vorausahnt, vor dem Tor ruhig bleibt, neunzig Minuten
     * bei der Sache ist, nach hinten mitarbeitet, für die Mannschaft spielt,
     * vorangeht und sich ohne Ball anbietet.
     *
     * Jetzt sind das acht sichtbare Werte auf derselben Skala wie die
     * übrigen. Sie hängen an der Gesamtstärke, an der Position (ein
     * Innenverteidiger liest das Spiel, ein Stürmer läuft sich frei), am
     * Alter (Erfahrung macht ruhiger und klüger, Laufbereitschaft lässt
     * nach) und an der Persönlichkeit (wer in großen Spielen da ist, hat
     * Nerven). Der persönliche Anteil folgt fest aus der Kennung des
     * Spielers: Dieselbe Welt bekommt dieselben Werte, und für die Erzeugung
     * wird kein Zufall verbraucht - Welten und Messungen bleiben, wie sie
     * waren.
     */
    static KOPFWERTE = ["decisions", "anticipation", "composure", "concentration", "workRate", "teamwork", "leadership", "offTheBall"];

    static KOPF_NAMEN = {
        decisions: "Entscheidungen", anticipation: "Antizipation", composure: "Nervenstärke",
        concentration: "Konzentration", workRate: "Einsatz", teamwork: "Teamwork",
        leadership: "Führung", offTheBall: "Ohne Ball"
    };

    /** Auf- und Abschläge zur Gesamtstärke je Position */
    static KOPF_PROFILE = {
        TW: { decisions: 0, anticipation: 2, composure: 0, concentration: 4, workRate: -8, teamwork: 0, leadership: 0, offTheBall: -40 },
        IV: { decisions: 1, anticipation: 5, composure: 1, concentration: 4, workRate: 0, teamwork: 2, leadership: 2, offTheBall: -14 },
        LV: { decisions: -1, anticipation: 2, composure: -1, concentration: 1, workRate: 5, teamwork: 3, leadership: -2, offTheBall: -2 },
        RV: { decisions: -1, anticipation: 2, composure: -1, concentration: 1, workRate: 5, teamwork: 3, leadership: -2, offTheBall: -2 },
        DM: { decisions: 3, anticipation: 5, composure: 1, concentration: 3, workRate: 5, teamwork: 5, leadership: 1, offTheBall: -6 },
        ZM: { decisions: 4, anticipation: 2, composure: 2, concentration: 1, workRate: 4, teamwork: 4, leadership: 0, offTheBall: 1 },
        LM: { decisions: 0, anticipation: 0, composure: -1, concentration: -1, workRate: 6, teamwork: 3, leadership: -3, offTheBall: 4 },
        RM: { decisions: 0, anticipation: 0, composure: -1, concentration: -1, workRate: 6, teamwork: 3, leadership: -3, offTheBall: 4 },
        OM: { decisions: 4, anticipation: 2, composure: 4, concentration: -1, workRate: -2, teamwork: 1, leadership: -2, offTheBall: 5 },
        LA: { decisions: -1, anticipation: 0, composure: 1, concentration: -3, workRate: 1, teamwork: -1, leadership: -4, offTheBall: 7 },
        RA: { decisions: -1, anticipation: 0, composure: 1, concentration: -3, workRate: 1, teamwork: -1, leadership: -4, offTheBall: 7 },
        ST: { decisions: 0, anticipation: 4, composure: 5, concentration: -2, workRate: 0, teamwork: -1, leadership: -2, offTheBall: 8 }
    };

    /** Wie weit der persönliche Anteil streut (Punkte nach oben und unten) */
    static KOPF_STREUUNG = { leadership: 11, default: 7 };

    /** Was das Alter ausmacht: Erfahrung beruhigt und macht klüger, Laufbereitschaft lässt ab dreißig nach */
    static kopfAlter(key, age = 25) {
        const a = age || 25;
        const kappe = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
        switch (key) {
            case "decisions": return kappe((a - 25) * 0.9, -7, 5);
            case "anticipation": return kappe((a - 25) * 0.8, -6, 5);
            case "composure": return kappe((a - 25) * 0.8, -6, 5);
            case "concentration": return kappe((a - 25) * 0.6, -5, 4);
            case "workRate": return a < 30 ? 0 : -Math.min(8, (a - 29) * 1.2);
            case "teamwork": return kappe((a - 25) * 0.3, -2, 2);
            case "leadership": return kappe((a - 24) * 1.4, -9, 9);
            case "offTheBall": return kappe((a - 25) * 0.4, -3, 2);
            default: return 0;
        }
    }

    /** Was die Persönlichkeit (versteckte Werte, 1 bis 20) beisteuert */
    static kopfCharakter(key, h = {}) {
        const w = (k) => (typeof h[k] === "number" ? h[k] : 12) - 12;
        switch (key) {
            case "decisions": return w("consistency") * 0.3;
            case "composure": return w("importantMatches") * 0.8;
            case "concentration": return (w("professionalism") + w("consistency")) * 0.4;
            case "workRate": return w("professionalism") * 0.7 + w("ambition") * 0.3;
            case "teamwork": return w("loyalty") * 0.4 + w("temperament") * 0.3;
            case "leadership": return w("temperament") * 0.4 + w("importantMatches") * 0.4 + w("ambition") * 0.3;
            default: return 0;
        }
    }

    /** Feste Zahl zwischen -1 und +1 je Schlüssel (FNV-1a), ohne Zufall zu verbrauchen */
    static _hashZahl(text) {
        let h = 2166136261;
        const t = String(text);
        for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
        h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
        return ((h >>> 0) / 4294967295) * 2 - 1;
    }

    /** Der persönliche Anteil eines Kopfwerts: fest je Spieler, mittig gehäuft */
    static kopfPersoenlich(id, key) {
        const streuung = this.KOPF_STREUUNG[key] ?? this.KOPF_STREUUNG.default;
        return (this._hashZahl(`${id}|${key}|a`) + this._hashZahl(`${id}|${key}|b`)) / 2 * streuung;
    }

    /** Der Kopfwert, den ein Spieler nach Stärke, Position, Alter und Persönlichkeit hätte */
    static kopfSoll(player, key) {
        const profil = this.KOPF_PROFILE[player.pos] || this.KOPF_PROFILE.ZM;
        return (player.overall || 50) + (profil[key] || 0) + this.kopfAlter(key, player.age)
            + this.kopfCharakter(key, player.hiddenAttributes || {});
    }

    /**
     * Setzt die Kopfwerte eines Spielers, der noch keine hat (neu erzeugt,
     * handgepflegt oder aus einem älteren Spielstand). Gibt zurück, ob etwas
     * gesetzt wurde.
     */
    static ergaenzeKopfwerte(player) {
        if (!player || typeof player.decisions === "number") return false;
        const id = player.id ?? player.name ?? "";
        this.KOPFWERTE.forEach(key => {
            const wert = this.kopfSoll(player, key) + this.kopfPersoenlich(id, key);
            player[key] = Math.max(1, Math.min(99, Math.round(wert)));
        });
        player.kopfStand = player.overall || 50;
        return true;
    }

    /**
     * Ein Jahr älter: Die Kopfwerte folgen der Gesamtstärke seit dem letzten
     * Mal und dem Alter - was im Training dazukam und was ihn persönlich
     * ausmacht, bleibt. Aufgerundet wird nach einer festen Zahl je Spieler,
     * Saison und Wert, nicht nach dem Würfel. altVorher: das Alter vor dem
     * Geburtstag.
     */
    static kopfReife(player, altVorher, saison = 0) {
        if (!player) return;
        if (this.ergaenzeKopfwerte(player)) return;
        const alt = typeof altVorher === "number" ? altVorher : (player.age || 25) - 1;
        const stand = typeof player.kopfStand === "number" ? player.kopfStand : (player.overall || 50);
        const staerke = ((player.overall || 50) - stand) * 0.8;
        this.KOPFWERTE.forEach(key => {
            const schritt = staerke + this.kopfAlter(key, player.age) - this.kopfAlter(key, alt);
            const ganz = Math.floor(schritt);
            const rest = schritt - ganz;
            const auf = (this._hashZahl(`${player.id}|${key}|${saison}`) + 1) / 2 < rest ? 1 : 0;
            player[key] = Math.max(1, Math.min(99, Math.round((player[key] || 50) + ganz + auf)));
        });
        player.kopfStand = player.overall || 50;
    }

    /**
     * Handgepflegte Spieler auf das Niveau ihrer Gesamtstärke heben.
     *
     * Die Bundesliga steht mit echten Kadern in den Daten, alle anderen
     * Ligen erzeugt der Generator. Bei gleicher Gesamtstärke lagen die
     * Einzelwerte der handgepflegten Spieler aber im Schnitt gut vier Punkte
     * unter dem Profil ihrer Position - und die Spiel-Engine rechnet mit den
     * Einzelwerten. Deutsche Vereine spielten damit schwächer, als ihre
     * Stärke anzeigte, verloren im Europapokal und rutschten in der
     * Fünfjahreswertung ans Ende. Jetzt bekommt jeder Spieler so viel dazu,
     * wie ihm im Schnitt fehlt; seine Stärken und Schwächen bleiben.
     */
    static gleicheWerteAn(player) {
        if (!player || typeof player.overall !== "number") return 0;
        const o = player.overall;
        const tw = player.pos === "TW";
        const soll = tw ? this.TORWARTWERTE : (this.PROFILE[player.pos] || this.PROFILE.ZM);
        const schluessel = Object.keys(tw ? this.TORWARTWERTE : this.FELDWERTE.reduce((m, k) => (m[k] = 0, m), {}));
        const werte = schluessel.filter(k => typeof player[k] === "number");
        if (!werte.length) return 0;
        const fehlt = Math.round(werte.reduce((s, k) => s + (o + (soll[k] || 0)) - player[k], 0) / werte.length);
        if (fehlt <= 0) return 0;
        werte.forEach(k => { player[k] = Math.max(1, Math.min(99, player[k] + fehlt)); });
        return fehlt;
    }

    // ----------------------------------------------------------- Detailwerte

    /**
     * Die Detailwerte: was in den groben Werten steckt.
     *
     * "Schuss" stand für den Abschluss im Strafraum wie für den Freistoß aus
     * 25 Metern, "Physis" für Kopfball, Kraft und Sprungkraft, "Defensive"
     * für das Tackling wie für die Manndeckung. Das Vorbild führt dafür
     * jeweils eigene Werte, und erst damit unterscheidet sich der
     * Kopfballspezialist vom Freistoßschützen. Jetzt hat jeder Spieler sie:
     *
     * - Technik: Abschluss, Distanzschüsse, Kopfball, Flanken, Ballannahme,
     *   Tackling, Manndeckung, Freistöße, Elfmeter, Ecken
     * - Kopf: Aggressivität, Mut, Entschlossenheit, Kreativität
     * - Körper: Antritt, Beweglichkeit, Balance, Sprungkraft, Kraft,
     *   Grundfitness
     * - Torwart: Hohe Bälle, Strafraumbeherrschung, Herauslaufen,
     *   Kommunikation, Abwurf
     *
     * Jeder Detailwert folgt aus den groben Werten. Die bleiben die Grundlage
     * für Training, Entwicklung und Stärke: Wer im Training Schuss gewinnt,
     * schießt auch die Freistöße besser. Dazu kommen die Position (ein
     * Außenverteidiger flankt, ein Innenverteidiger köpft), bei Kopfball,
     * Kraft, Sprungkraft und Beweglichkeit die Körpergröße, bei Aggressivität,
     * Mut, Entschlossenheit und Grundfitness die Persönlichkeit, und ein
     * persönlicher Anteil, fest je Spieler. Eigenheiten passen dazu: Wer
     * "Gefährlich bei direkten Freistößen" ist, hat gute Freistöße.
     *
     * Gespeichert wird nichts. Der Spielstand wird nicht größer, alte
     * Spielstände haben die Werte sofort, und für die Erzeugung wird kein
     * Zufall verbraucht.
     *
     * basis: Anteile der groben Werte · pos: Auf- und Abschläge je Position ·
     * groesse: Punkte je Zentimeter über dem Üblichen der Position ·
     * charakter: was die Persönlichkeit (1 bis 20) beisteuert · tw: eigene
     * Anteile für Torhüter · nurTW / nurFeld: nur für Torhüter oder nur für
     * Feldspieler
     */
    static DETAILWERTE = {
        // Technik
        finishing: { nurFeld: true, name: "Abschluss", gruppe: "technik", basis: { shooting: 0.85, technique: 0.15 }, streuung: 8,
            pos: { ST: 3, LA: 1, RA: 1, IV: -4, DM: -2 } },
        longShots: { nurFeld: true, name: "Distanzschüsse", gruppe: "technik", basis: { shooting: 0.6, technique: 0.4 }, streuung: 11,
            pos: { OM: 4, ZM: 4, DM: 2, ST: -3, IV: -3 } },
        heading: { nurFeld: true, name: "Kopfball", gruppe: "technik", basis: { physical: 0.55, shooting: 0.2, positioning: 0.25 }, streuung: 10, groesse: 0.55,
            pos: { IV: 7, ST: 5, DM: 2, LM: -4, RM: -4, OM: -6, LA: -6, RA: -6 } },
        crossing: { nurFeld: true, name: "Flanken", gruppe: "technik", basis: { passing: 0.7, technique: 0.3 }, streuung: 10,
            pos: { LV: 6, RV: 6, LM: 6, RM: 6, LA: 4, RA: 4, ST: -6, DM: -4, IV: -10 } },
        firstTouch: { name: "Ballannahme", gruppe: "technik", basis: { technique: 0.7, dribbling: 0.3 }, streuung: 7,
            tw: { technique: 0.6, passing: 0.4 } },
        tackling: { nurFeld: true, name: "Tackling", gruppe: "technik", basis: { defense: 0.85, physical: 0.15 }, streuung: 8,
            pos: { DM: 3, IV: 2 } },
        marking: { nurFeld: true, name: "Manndeckung", gruppe: "technik", basis: { defense: 0.6, positioning: 0.4 }, streuung: 8,
            pos: { IV: 4, LV: 1, RV: 1, DM: 1 } },
        freeKicks: { nurFeld: true, name: "Freistöße", gruppe: "technik", basis: { shooting: 0.5, technique: 0.5 }, versatz: -5, streuung: 14 },
        penalties: { nurFeld: true, name: "Elfmeter", gruppe: "technik", basis: { shooting: 0.65, technique: 0.35 }, versatz: -1, streuung: 12 },
        corners: { nurFeld: true, name: "Ecken", gruppe: "technik", basis: { passing: 0.5, technique: 0.5 }, versatz: -4, streuung: 13,
            pos: { LM: 3, RM: 3, LA: 3, RA: 3, OM: 3, IV: -6 } },
        // Kopf
        aggression: { name: "Aggressivität", gruppe: "kopf", basis: { overall: 0.5 }, versatz: 30, streuung: 10,
            charakter: (h) => (h("temperament") - 12) * 2.2,
            pos: { IV: 6, DM: 6, ST: 2, LV: 2, RV: 2, LA: -3, RA: -3, OM: -6, TW: -10 } },
        bravery: { name: "Mut", gruppe: "kopf", basis: { overall: 0.5, physical: 0.2 }, versatz: 18, streuung: 9,
            charakter: (h) => (h("importantMatches") - 12) * 1.2,
            pos: { IV: 6, TW: 6, ST: 5, DM: 3, LA: -3, RA: -3, OM: -5 } },
        determination: { name: "Entschlossenheit", gruppe: "kopf", basis: { overall: 0.45 }, versatz: 33, streuung: 6,
            charakter: (h) => (h("ambition") - 12) * 1.6 + (h("professionalism") - 12) * 1.4 },
        flair: { nurFeld: true, name: "Kreativität", gruppe: "kopf", basis: { technique: 0.4, dribbling: 0.35, vision: 0.25 }, streuung: 12,
            pos: { OM: 6, LA: 5, RA: 5, ST: 2, LV: -3, RV: -3, DM: -6, IV: -10 } },
        // Körper
        acceleration: { name: "Antritt", gruppe: "koerper", basis: { pace: 1 }, streuung: 7, groesse: -0.25 },
        agility: { name: "Beweglichkeit", gruppe: "koerper", basis: { pace: 0.35, dribbling: 0.4, technique: 0.25 }, streuung: 8, groesse: -0.35,
            tw: { reflexes: 0.6, pace: 0.4 } },
        balance: { name: "Balance", gruppe: "koerper", basis: { physical: 0.5, dribbling: 0.3, technique: 0.2 }, streuung: 9, groesse: -0.15,
            tw: { physical: 0.6, reflexes: 0.4 } },
        jumpingReach: { name: "Sprungkraft", gruppe: "koerper", basis: { physical: 0.85, pace: 0.15 }, streuung: 9, groesse: 0.55,
            tw: { physical: 0.6, reflexes: 0.4 } },
        strength: { name: "Kraft", gruppe: "koerper", basis: { physical: 1 }, streuung: 8, groesse: 0.45 },
        naturalFitness: { name: "Grundfitness", gruppe: "koerper", basis: { stamina: 0.6, physical: 0.4 }, streuung: 8,
            charakter: (h) => (h("professionalism") - 12) * 1.0 - (h("injuryProneness", 8) - 8) * 1.2 },
        // Torwart
        aerialReach: { name: "Hohe Bälle", gruppe: "torwart", basis: { handling: 0.5, positioning: 0.3, physical: 0.2 }, streuung: 6, groesse: 0.5, nurTW: true },
        commandOfArea: { name: "Strafraumbeherrschung", gruppe: "torwart", basis: { positioning: 0.5, handling: 0.3, decisions: 0.2 }, streuung: 7, nurTW: true },
        rushingOut: { name: "Herauslaufen", gruppe: "torwart", basis: { oneOnOne: 0.65, pace: 0.2, anticipation: 0.15 }, streuung: 7, nurTW: true },
        communication: { name: "Kommunikation", gruppe: "torwart", basis: { leadership: 0.5, concentration: 0.3, positioning: 0.2 }, streuung: 7, nurTW: true },
        throwing: { name: "Abwurf", gruppe: "torwart", basis: { kicking: 0.4, passing: 0.4, physical: 0.2 }, streuung: 7, nurTW: true }
    };

    /** Die Eigenheiten verlangen einen passenden Detailwert (mindestens) */
    static DETAIL_EIGENHEITEN = {
        distanzschuss: { longShots: 76 }, flanken: { crossing: 74 }, zweikampf: { tackling: 76 }, kopfball: { heading: 78 },
        antritt: { acceleration: 85 }, ausdauer: { naturalFitness: 80 }, freistoss: { freeKicks: 76 }, elfmeter: { penalties: 76 },
        knipser: { finishing: 80 }, ruhe: { finishing: 75 }, mitspielen: { throwing: 64 }, dribbler: { agility: 76 }
    };

    /** Übliche Körpergröße je Position (wie MatchEngine.GROESSE_BASIS) */
    static GROESSE_UEBLICH = { TW: 190, IV: 188, ST: 184, DM: 182, ZM: 179, OM: 177, LV: 178, RV: 178, LM: 176, RM: 176, LA: 175, RA: 175 };

    /** Körpergröße wie in der Spiel-Engine: fest je Spieler */
    static groesseVon(player) {
        if (typeof player?.groesse === "number") return player.groesse;
        const basis = this.GROESSE_UEBLICH[player?.pos] || 180;
        const streuung = this._hashZahl(String(player?.id ?? player?.name ?? ""));
        const physis = typeof player?.physical === "number" ? (player.physical - 70) * 0.12 : 0;
        return Math.round(Math.max(163, Math.min(203, basis + streuung * 7 + physis)));
    }

    /** Der persönliche Anteil eines Detailwerts: fest je Spieler und Wert */
    static _detailPersoenlich = new Map();

    static detailPersoenlich(id, key, streuung) {
        const schluessel = `${id}|${key}`;
        let w = this._detailPersoenlich.get(schluessel);
        if (w === undefined) {
            w = (this._hashZahl(`${schluessel}|d1`) + this._hashZahl(`${schluessel}|d2`)) / 2;
            if (this._detailPersoenlich.size > 400000) this._detailPersoenlich.clear();
            this._detailPersoenlich.set(schluessel, w);
        }
        return w * streuung;
    }

    /** Ein Detailwert eines Spielers (1 bis 99) oder null, wenn es ihn nicht gibt */
    static detailWert(player, key) {
        const d = this.DETAILWERTE[key];
        if (!d || !player) return null;
        const tw = player.pos === "TW";
        if ((d.nurTW && !tw) || (d.nurFeld && tw)) return null;
        const ovr = typeof player.overall === "number" ? player.overall : 60;
        const v = (k) => (typeof player[k] === "number" ? player[k] : ovr);
        const anteile = (tw && d.tw) || d.basis;
        let wert = d.versatz || 0;
        for (const k in anteile) wert += v(k) * anteile[k];
        wert += (d.pos && d.pos[player.pos]) || 0;
        if (d.groesse) wert += (this.groesseVon(player) - (this.GROESSE_UEBLICH[player.pos] || 180)) * d.groesse;
        if (d.charakter) {
            const h = player.hiddenAttributes || {};
            wert += d.charakter((k, std = 12) => (typeof h[k] === "number" ? h[k] : std));
        }
        wert += this.detailPersoenlich(player.id ?? player.name ?? "", key, d.streuung || 6);
        // Eine Eigenheit steht nie im Widerspruch zum Wert
        (player.traits || []).forEach(t => {
            const boden = this.DETAIL_EIGENHEITEN[t && t.key]?.[key];
            if (boden) wert = Math.max(wert, boden);
        });
        return Math.max(1, Math.min(99, Math.round(wert)));
    }

    /**
     * Wie weit ein Detailwert über oder unter dem liegt, was die groben Werte
     * allein ergeben: Position, Größe, Persönlichkeit, persönlicher Anteil,
     * Eigenheit. Damit rechnen die Spiel-Engines - im Mittel bleibt alles, wie
     * es gemessen und eingestellt war, und der Spezialist sticht heraus.
     * ohneGroesse: wo die Engine die Körpergröße schon selbst rechnet.
     * ohnePosition: für die Engines - dort steckt die Position schon in den
     * groben Werten und in den Rollen. Mit dem Aufschlag schossen Stürmer
     * und Innenverteidiger gemessen 2 % mehr Tore als vorher.
     */
    static detailAbweichung(player, key, ohneGroesse = false, ohnePosition = false) {
        const wert = this.detailWert(player, key);
        if (wert === null) return 0;
        const d = this.DETAILWERTE[key];
        const ovr = typeof player.overall === "number" ? player.overall : 60;
        const anteile = (player.pos === "TW" && d.tw) || d.basis;
        let basis = d.versatz || 0;
        for (const k in anteile) basis += (typeof player[k] === "number" ? player[k] : ovr) * anteile[k];
        let ab = wert - basis;
        if (ohneGroesse && d.groesse) ab -= (this.groesseVon(player) - (this.GROESSE_UEBLICH[player.pos] || 180)) * d.groesse;
        if (ohnePosition && d.pos) ab -= d.pos[player.pos] || 0;
        return ab;
    }

    /** Die Abweichungen, mit denen das Livespiel rechnet (MatchEngine.werte2D) */
    static FEIN_2D = {
        feld: ["finishing", "longShots", "heading", "crossing", "tackling", "marking", "freeKicks", "penalties", "corners", "agility", "jumpingReach"],
        tw: ["aerialReach", "commandOfArea", "rushingOut"],
        ohneGroesse: ["heading", "jumpingReach"]
    };

    static feinwerte2D(player) {
        if (!player) return {};
        const liste = player.pos === "TW" ? this.FEIN_2D.tw : this.FEIN_2D.feld;
        const fein = {};
        liste.forEach(k => {
            const ab = this.detailAbweichung(player, k, this.FEIN_2D.ohneGroesse.includes(k), true);
            if (ab) fein[k] = Math.round(ab * 10) / 10;
        });
        return fein;
    }

    /** Die Detailwerte einer Gruppe, die zu diesem Spieler gehören */
    static detailSchluessel(player, gruppe = null) {
        const tw = player?.pos === "TW";
        return Object.keys(this.DETAILWERTE).filter(k => {
            const d = this.DETAILWERTE[k];
            return (!gruppe || d.gruppe === gruppe) && (!d.nurTW || tw) && (!d.nurFeld || !tw);
        });
    }

    /**
     * Erzeugt einen kompletten Kader für einen Verein
     */
    /**
     * Positionsplan für einen Kader beliebiger Größe.
     *
     * Vorher wurde die feste Liste SQUAD_DISTRIBUTION einfach abgeschnitten -
     * und da die Stürmer am Ende standen, hatte ab der 3. Liga abwärts kein
     * einziger Verein einen Angreifer im Kader, dafür überall drei Torhüter.
     * Jetzt richtet sich der Plan nach der Kadergröße: erst die Torhüter,
     * dann Abwehr, Mittelfeld und Angriff im üblichen Verhältnis.
     */
    static buildSquadPlan(squadSize = 22) {
        const groesse = Math.max(11, Math.round(squadSize));
        const plan = [];

        const torhueter = groesse >= 20 ? 3 : 2;
        for (let i = 0; i < torhueter; i++) plan.push("TW");

        const feldspieler = groesse - torhueter;
        const abwehr = Math.max(5, Math.round(feldspieler * 0.37));
        const angriff = Math.max(3, Math.round(feldspieler * 0.26));
        const mittelfeld = Math.max(4, feldspieler - abwehr - angriff);

        const reihum = (muster, anzahl) => {
            for (let i = 0; i < anzahl; i++) plan.push(muster[i % muster.length]);
        };

        reihum(["IV", "IV", "LV", "RV", "IV", "LV", "RV", "IV"], abwehr);
        reihum(["ZM", "DM", "ZM", "RM", "LM", "DM", "OM", "ZM"], mittelfeld);
        reihum(["ST", "LA", "RA", "ST", "ST", "LA", "RA"], angriff);

        return plan.slice(0, groesse);
    }

    static generateSquad(clubId, level = 1, squadSize = 22, options = {}) {
        const squad = [];
        const distribution = Array.isArray(options.positions) && options.positions.length > 0
            ? options.positions
            : this.buildSquadPlan(squadSize);

        // Beim Erstaufbau bekommen die Spieler durchnummerierte Kennungen.
        // Für spätere Nachverpflichtungen wäre das fatal: Die Nummern liefen
        // wieder von vorne los und ein Verein hätte zwei Spieler mit derselben
        // Kennung im Kader gehabt - der neue Stürmer wäre nie aufgetaucht.
        const durchnummeriert = typeof options.idOffset === "number";
        const nummernVersatz = options.idOffset || 0;
        distribution.forEach((pos, idx) => {
            const kennung = durchnummeriert ? `p_${clubId}_${nummernVersatz + idx + 1}` : null;
            const player = this.generatePlayer(clubId, level, pos, kennung, options);
            squad.push(player);
        });

        // Innerhalb des Kaders gibt es Stammspieler und Ergänzung: die
        // Startelf ist im Schnitt etwas stärker als die hinteren Plätze.
        squad.sort((a, b) => b.overall - a.overall);
        squad.forEach((p, idx) => {
            p.squadRole = idx < 4 ? "Schlüsselspieler"
                : idx < 11 ? "Stammspieler"
                : idx < 16 ? "Rotationsspieler"
                : (p.age <= 21 ? "Zukunftstalent" : "Ergänzungsspieler");
        });

        return squad;
    }

    /**
     * Generiert einen Jugendspieler
     */
    static generateYouthPlayer(clubId, academyLevel = 1, level = 1) {
        const pool = typeof NAME_POOLS !== "undefined" ? NAME_POOLS : {
            firstNames: ["Lukas", "Leon", "Finn", "Maximilian", "Noah"],
            lastNames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber"],
            nationalities: ["Deutschland"]
        };

        const firstName = pool.firstNames[Math.floor(Math.random() * pool.firstNames.length)];
        const lastName = pool.lastNames[Math.floor(Math.random() * pool.lastNames.length)];
        const pos = this.POSITIONS[Math.floor(Math.random() * this.POSITIONS.length)];
        const age = 15 + Math.floor(Math.random() * 3); // 15-17

        const abilityRange = this.getAbilityRangeForLevel(level);
        const baseCA = Math.max(25, abilityRange.minCA - 35 + (academyLevel * 5) + Math.floor(Math.random() * 20));
        const truePA = Math.min(200, baseCA + 30 + (academyLevel * 12) + Math.floor(Math.random() * 25));

        const overall = this.toOverall(baseCA);
        const pot = Math.max(overall, this.toOverall(truePA));
        const nebenpositionen = this.getPositionEngine()?.generateSecondaryPositions(pos) || [];

        const talent = Object.assign({
            id: `youth_${clubId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: `${firstName} ${lastName}`,
            age: age,
            nationality: "Deutschland",
            pos: pos,
            secondPos: nebenpositionen[0] || null,
            positions: nebenpositionen,
            overall: overall,
            pot: pot,
            trueCurrentAbility: baseCA,
            truePotentialAbility: truePA,
            developmentRate: 1.0 + (academyLevel * 0.1),
            promoted: false
        }, this.buildYouthProfile(pos, overall, age));
        this.ergaenzeKopfwerte(talent);
        return talent;
    }

    /**
     * Ergänzt einen Nachwuchsspieler um alles, was die Detailansicht braucht.
     *
     * Talente kamen bisher nur mit Gesamtstärke und Potenzial zur Welt. In der
     * Spielerakte stand deshalb überall die Gesamtstärke als Platzhalter - man
     * konnte nicht erkennen, ob der Junge schnell, technisch oder kopfballstark
     * ist, und damit auch nicht, ob er zur Mannschaft passt.
     */
    static buildYouthProfile(pos, overall, age) {
        const ratingEngine = this.getRatingEngine();
        const jugendAttribute = this.generateAttributes(pos, overall);
        return Object.assign({
            hiddenAttributes: ratingEngine
                ? ratingEngine.generateHiddenAttributes({ age, overall })
                : { professionalism: 12, ambition: 14, consistency: 10, importantMatches: 11, injuryProneness: 8, adaptability: 14, loyalty: 15, temperament: 11 },
            // Der eigene Nachwuchs wird täglich beobachtet - hier gibt es
            // nichts zu scouten, die Werte sind bekannt.
            scoutingKnowledge: {
                known: true,
                knowledgeLevel: 95,
                lastScoutedDate: "Eigene Akademie",
                reportsCount: 1,
                accuracy: 95
            },
            fitness: 92 + Math.floor(Math.random() * 8),
            morale: 80 + Math.floor(Math.random() * 15),
            form: 6.5 + parseFloat((Math.random() * 1.2).toFixed(1)),
            stats: { matches: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, minutes: 0, cleanSheets: 0, ratingSum: 0 }
        }, jugendAttribute, this.buildCharacter(pos, jugendAttribute));
    }

    /**
     * Rüstet einen Nachwuchsspieler aus einem älteren Spielstand nach.
     * Gibt zurück, ob etwas ergänzt wurde.
     */
    static completeYouthProspect(prospect) {
        if (!prospect) return false;
        if (typeof prospect.pace === "number") return this.ergaenzeKopfwerte(prospect);
        Object.assign(prospect, this.buildYouthProfile(prospect.pos || "ZM", prospect.overall || 45, prospect.age || 16));
        this.ergaenzeKopfwerte(prospect);
        return true;
    }
}

if (typeof window !== "undefined") {
    window.PlayerGenerator = PlayerGenerator;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PlayerGenerator };
}
