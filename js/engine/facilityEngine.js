/**
 * FacilityEngine - Anlagen altern, werden saniert und ausgebaut
 *
 * Bisher war eine Anlage eine Zahl von eins bis fünf. Man drückte einen Knopf,
 * das Geld war weg, die Zahl war eine höher - im selben Augenblick. Ein Verein
 * mit Geld hatte nach drei Saisons überall die Fünf und danach nichts mehr zu
 * entscheiden.
 *
 * So ist es nirgends. Das Camp Nou fasst hunderttausend Zuschauer und war
 * trotzdem so alt, dass es von Grund auf saniert werden musste - und während
 * der Bauarbeiten spielte Barcelona im Olympiastadion, vor der Hälfte der
 * Zuschauer. La Masia ist kein "Level 5", sondern eine Schule mit einer
 * bestimmten Handschrift: Sie bringt Techniker hervor, keine Athleten.
 *
 * Deshalb hat hier jede Anlage drei Dinge statt einer Zahl:
 *
 *   Stufe     - was sie leisten könnte, wenn sie in Schuss ist
 *   Zustand   - wie gut sie in Schuss ist (0 bis 100)
 *   Baujahr   - wann zuletzt gebaut oder saniert wurde
 *
 * Der Zustand verfällt jede Saison, und zwar schneller, je größer die Anlage
 * ist: Ein Stadion für achtzigtausend kostet mehr Unterhalt als eines für
 * achttausend. Was am Ende zählt, ist die *wirksame* Stufe - eine verfallene
 * Fünf leistet weniger als eine gepflegte Drei.
 *
 * Und es gibt zwei Arten von Arbeit, nicht nur eine:
 *
 *   Ausbau    - hebt die Stufe. Teuer, dauert lange.
 *   Sanierung - stellt den Zustand wieder her. Günstiger, dauert kürzer.
 *
 * Beides braucht Zeit, und während gebaut wird, leidet der Betrieb: Am Stadion
 * fehlen Plätze, auf dem Trainingsgelände fehlen Plätze zum Trainieren. Das
 * ist die eigentliche Entscheidung - nicht ob man baut, sondern wann man sich
 * die Baustelle leisten kann.
 */

function _facResolve(name, pfad) {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

const FacilityEngine = {
    FACILITY_NAMES: {
        trainingGround: "Trainingsgelände",
        youthCenter: "Jugendakademie",
        medicalCenter: "Medizinisches Zentrum",
        stadium: "Stadion"
    },

    /** Reihenfolge für die Anzeige */
    ANLAGEN: ["stadium", "trainingGround", "youthCenter", "medicalCenter"],

    /** Preise für einen Erstligisten - kleinere Ligen zahlen den BAU_FAKTOR davon */
    FACILITY_COSTS: {
        trainingGround: [1500000, 3000000, 6000000, 12000000],
        youthCenter: [2000000, 4000000, 8000000, 16000000],
        medicalCenter: [1200000, 2500000, 5000000, 10000000],
        stadium: [3000000, 7000000, 15000000, 30000000]
    },

    /**
     * Was Bauen in welcher Liga kostet, gemessen an der Bundesliga.
     *
     * Vorher kostete alles überall dasselbe: Der FC Hanau 93 (Landesliga,
     * gut 70.000 € Einnahmen je Spieltag, 50.000 € in der Kasse) sollte für
     * ein zweites Trainingsfeld 1,5 Millionen zahlen und für eine Tribüne
     * drei - das Dreifache einer ganzen Saison. Gebaut wurde nie.
     *
     * Ein Landesligist baut keine Arena, sondern einen Kunstrasenplatz,
     * ein Vereinsheim, eine überdachte Stehtribüne. Das kostet einen
     * Bruchteil, fällt aber nicht so steil wie die Einnahmen - Beton und
     * Handwerker kosten in der siebten Liga nicht ein Fünfzigstel. So kostet
     * ein Ausbau in jeder Liga ungefähr einen ähnlichen Anteil der Saison-
     * einnahmen: der erste Schritt etwa ein Zehntel bis ein Drittel.
     */
    BAU_FAKTOR: { 1: 1.0, 2: 0.55, 3: 0.28, 4: 0.14, 5: 0.08, 6: 0.055, 7: 0.04 },

    /**
     * Sportstättenförderung: Bei Amateurvereinen trägt die öffentliche Hand
     * einen Teil der Baukosten (Stadt, Kreis, Landessportbund). Profivereine
     * bauen auf eigene Rechnung.
     */
    FOERDER_QUOTE: { 4: 0.15, 5: 0.25, 6: 0.30, 7: 0.35 },

    /**
     * Baufinanzierung über die Hausbank: ein Viertel sofort, der Rest in
     * gleichen Wochenraten mit Zinsen, mindestens über ein halbes Jahr - auch
     * über das Bauende hinaus. Die Bank macht nur mit, wenn die Rate höchstens
     * ein Viertel der Einnahmen je Spieltag frisst.
     */
    FINANZIERUNG: { anzahlung: 0.25, zins: 0.06, maxRatenAnteil: 0.25, minWochen: 26 },

    /**
     * Wie lange gebaut wird - in Kalendertagen, für einen Erstligisten.
     *
     * Ein Stadionausbau ist keine Sache von Tagen, er begleitet fast eine
     * Saison. Vorher zählte die Bauzeit in Spieltagen: In der Sommer- und
     * der Winterpause stand jede Baustelle still - gerade dann, wenn in
     * Wirklichkeit gebaut wird, weil kein Spiel stört. Und ein Landesligist
     * brauchte für einen Kunstrasenplatz so lange wie ein Bundesligist für
     * ein neues Trainingszentrum.
     */
    BAUZEIT: {
        stadium:        { ausbau: 300, sanierung: 120 },
        trainingGround: { ausbau: 150, sanierung: 60 },
        youthCenter:    { ausbau: 180, sanierung: 75 },
        medicalCenter:  { ausbau: 90, sanierung: 40 }
    },

    /**
     * Kleinere Vereine bauen Kleineres: eine überdachte Stehtribüne statt
     * eines neuen Oberrangs, einen Kunstrasenplatz statt eines
     * Leistungszentrums. Die siebte Liga baut ihr Stadion in vier Monaten aus,
     * das Trainingsgelände in zwei.
     */
    BAUZEIT_STUFE: { 1: 1.0, 2: 0.85, 3: 0.7, 4: 0.6, 5: 0.5, 6: 0.45, 7: 0.4 },

    /** Schichtbetrieb: schneller fertig, dafür teurer */
    SCHICHTBETRIEB: { zeit: 0.7, kosten: 1.35 },

    /**
     * Wie stark der Betrieb während der Bauarbeiten leidet (0 bis 1).
     *
     * Am Stadion ist es am schmerzhaftesten: Barcelona verlor während des
     * Umbaus rund die Hälfte seiner Zuschauer.
     */
    BEEINTRAECHTIGUNG: {
        stadium:        { ausbau: 0.45, sanierung: 0.30 },
        trainingGround: { ausbau: 0.30, sanierung: 0.15 },
        youthCenter:    { ausbau: 0.25, sanierung: 0.12 },
        medicalCenter:  { ausbau: 0.20, sanierung: 0.10 }
    },

    /**
     * Wie schnell der Zustand je Saison verfällt, je Stufe.
     *
     * Gebäude altern in Jahrzehnten, nicht in Spielzeiten. Das Camp Nou wurde
     * 1957 gebaut und 2023 saniert - dazwischen liegen mehr als sechzig Jahre.
     * Mit einem zweistelligen Verfall je Saison stand nach vier Spielzeiten
     * jede Anlage der Welt auf "marode", die wirksamen Stufen waren von fünf
     * auf zwei gefallen und mit ihnen Training, Nachwuchs und Medizin - das
     * war kein Altern mehr, sondern Zerfall.
     *
     * Mit diesen Werten braucht eine gepflegte Anlage rund zehn Spielzeiten,
     * bis sie sanierungsbedürftig wird. Lange genug, dass man es aufschieben
     * kann; kurz genug, dass es einen irgendwann einholt.
     */
    VERFALL_JE_SAISON: { 1: 1.4, 2: 1.9, 3: 2.6, 4: 3.4, 5: 4.5 },

    /**
     * Die Handschrift einer Jugendakademie.
     *
     * Eine Akademie ist keine Fabrik, die Spieler nach Stufe ausspuckt. La
     * Masia bringt Techniker hervor, die Ajax-Schule Spielintelligenz, eine
     * englische Akademie eher Athleten. Das Profil verschiebt die Werte der
     * Talente - es macht sie nicht besser, sondern anders.
     */
    AKADEMIE_PROFILE: {
        technik:   { name: "Technikschule", staerken: ["technique", "passing", "dribbling"], schwaechen: ["physical"] },
        athletik:  { name: "Athletikschule", staerken: ["pace", "physical", "stamina"], schwaechen: ["technique"] },
        spielwitz: { name: "Spielintelligenz", staerken: ["vision", "positioning", "passing"], schwaechen: ["pace"] },
        kampf:     { name: "Zweikampfschule", staerken: ["defense", "physical", "positioning"], schwaechen: ["dribbling"] },
        ausgewogen:{ name: "Ausgewogene Ausbildung", staerken: [], schwaechen: [] }
    },

    // ----------------------------------------------------------- Grundlagen

    /**
     * Holt die Anlagendaten eines Vereins und legt sie an, falls sie fehlen.
     *
     * Alte Spielstände kennen nur die Stufe. Die wird übernommen; Zustand und
     * Baujahr werden dann so gesetzt, dass eine große alte Anlage auch alt
     * aussieht.
     */
    hole(club, saison = 1) {
        if (!club) return null;
        if (!club.facilities) {
            club.facilities = { trainingGround: 2, youthCenter: 1, medicalCenter: 1, stadium: 2 };
        }
        if (!club.anlagen) club.anlagen = {};

        // Alles Folgende legt Anlagen an. Steht schon alles da, ist hier
        // Schluss - sonst würde jeder Aufruf den Bestand neu auswürfeln, und
        // weil hole() bei jeder Abfrage der wirksamen Stufe läuft, könnte eine
        // Anlage nie verfallen: Sie wurde im selben Augenblick wieder
        // aufgepäppelt, in dem sie unter die Schwelle rutschte.
        if (this.ANLAGEN.every(k => club.anlagen[k])) return club.anlagen;

        // Jeder Verein hat einen Schwerpunkt und eine Baustelle.
        //
        // In den Ausgangsdaten steht für jeden Verein dieselbe Zahl bei allen
        // vier Anlagen - ein Verein auf Stufe vier hätte ein Trainingsgelände,
        // eine Akademie und eine medizinische Abteilung auf exakt demselben
        // Stand. So ist kein Verein gebaut. Ajax hat eine Weltakademie und ein
        // gewöhnliches Stadion, andere andersherum. Also bekommt jeder Verein
        // eine Anlage, in die er investiert hat, und eine, die er hat schleifen
        // lassen. Das Stadion bleibt außen vor - seine Stufe hängt an der
        // Zuschauerkapazität und darf nicht davon abweichen.
        const beweglich = this.ANLAGEN.filter(k => k !== "stadium");
        const stark = beweglich[Math.floor(Math.random() * beweglich.length)];
        const rest = beweglich.filter(k => k !== stark);
        const schwach = rest[Math.floor(Math.random() * rest.length)];

        this.ANLAGEN.forEach(key => {
            if (club.anlagen[key]) return;
            let stufe = club.facilities[key] || 1;
            if (key === stark) stufe = Math.min(5, stufe + 1);
            else if (key === schwach) stufe = Math.max(1, stufe - 1);

            // Zuerst das Alter, dann der Zustand - nicht umgekehrt.
            //
            // Eine Anlage ist nicht zufällig in schlechtem Zustand, sondern
            // weil seit dem letzten Bau Jahre vergangen sind. Wer erst vor
            // zwei Jahren saniert hat, steht gut da; wer seit achtzehn Jahren
            // nichts gemacht hat, hat ein Camp Nou. Aus demselben Verfall, mit
            // dem die Anlage im Spiel weiter altert, ergibt sich so von selbst
            // eine glaubwürdige Streuung: manche Vereine mit frischer Akademie,
            // andere mit einer, an der seit Jahrzehnten nichts geschah.
            // Die Wurzel im Zufall zieht das Alter nach unten: Die meisten
            // Anlagen sind in den letzten Jahren angefasst worden, einige
            // wenige seit zwei Jahrzehnten nicht mehr. Das sind die
            // interessanten - die Camp Nous der Liga.
            const alter = Math.floor(Math.pow(Math.random(), 1.4) * (stufe * 3.5 + 3));
            const verfall = this.VERFALL_JE_SAISON[stufe] || 2.5;
            const boden = 18 + Math.random() * 12;

            club.anlagen[key] = {
                stufe,
                zustand: Math.round(Math.max(boden, Math.min(97, 97 - alter * verfall - Math.random() * 6))),
                baujahr: saison - alter,
                projekt: null
            };
            club.facilities[key] = stufe;
        });

        // Höchstens eine Dauerbaustelle je Verein.
        //
        // Jede Anlage würfelt ihr Alter für sich, und bei vier Würfen erwischte
        // es manchen Verein dreimal: Stadion, Akademie und Medizin gleichzeitig
        // marode, die wirksamen Stufen bei zweieinhalb statt fünf. Ein Verein,
        // bei dem alles gleichzeitig zerfällt, existiert nicht - er hätte längst
        // keine Lizenz mehr. Einer, der ein altes Stadion mit sich herumträgt und
        // sonst ordentlich dasteht, ist der Normalfall. Also darf eine Anlage
        // heruntergekommen sein; die übrigen werden verjüngt.
        const heruntergekommen = this.ANLAGEN
            .filter(k => club.anlagen[k].zustand < 45)
            .sort((a, b) => club.anlagen[a].zustand - club.anlagen[b].zustand);

        heruntergekommen.slice(1).forEach(key => {
            const a = club.anlagen[key];
            const verfall = this.VERFALL_JE_SAISON[a.stufe] || 2.5;
            a.zustand = Math.round(52 + Math.random() * 38);
            a.baujahr = saison - Math.max(0, Math.round((97 - a.zustand) / verfall));
        });

        if (!club.akademieProfil) {
            club.akademieProfil = this.waehleProfil(club);
        }

        return club.anlagen;
    },

    /** Ein Profil, das zum Verein passt */
    waehleProfil(club) {
        const land = club?.countryId || "de";
        const nachLand = {
            es: ["technik", "technik", "spielwitz", "ausgewogen"],
            it: ["kampf", "spielwitz", "ausgewogen", "kampf"],
            en: ["athletik", "athletik", "kampf", "ausgewogen"],
            de: ["ausgewogen", "athletik", "spielwitz", "technik"],
            fr: ["athletik", "technik", "ausgewogen", "athletik"]
        };
        const pool = nachLand[land] || nachLand.de;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    /**
     * Was die Anlage wirklich leistet.
     *
     * Das ist die Zahl, mit der alle anderen Engines rechnen sollen - nicht
     * die nackte Stufe. Eine verfallene Fünf ist schlechter als eine gepflegte
     * Drei, und während der Bauarbeiten ist sie noch einmal schlechter.
     */
    wirksameStufe(club, key, saison = 1) {
        const anlagen = this.hole(club, saison);
        const a = anlagen?.[key];
        if (!a) return club?.facilities?.[key] || 1;

        // Verfall trifft große Anlagen härter, und er beschleunigt sich.
        //
        // Eine kleine Anlage, die gepflegt wird, funktioniert. Ein Stadion für
        // achtzigtausend, um das sich zwanzig Jahre niemand gekümmert hat, ist
        // eine Ruine mit gesperrten Blöcken - es leistet weniger als ein
        // kleineres, das in Schuss ist. Deshalb ist der Abzug nicht linear:
        // Die ersten Prozentpunkte kosten fast nichts, die letzten sehr viel.
        const verfall = Math.max(0, Math.min(100, 100 - a.zustand)) / 100;
        const gewicht = 0.6 + a.stufe * 0.55;
        let wirksam = a.stufe - gewicht * Math.pow(verfall, 1.6);

        if (a.projekt) {
            wirksam -= a.projekt.beeintraechtigung * 1.6;
        }

        return Math.max(0.5, Math.min(5, Math.round(wirksam * 10) / 10));
    },

    /** Für Engines, die eine ganze Zahl brauchen */
    stufeGerundet(club, key, saison = 1) {
        return Math.max(1, Math.round(this.wirksameStufe(club, key, saison)));
    },

    /** Wie viele Plätze das Stadion gerade wirklich hat */
    verfuegbareKapazitaet(club, saison = 1) {
        const voll = club?.stadiumCapacity || club?.capacity || 20000;
        const anlagen = this.hole(club, saison);
        const bau = anlagen?.stadium?.projekt;
        if (!bau) return voll;
        // Während des Umbaus fehlt ein Teil der Ränge
        return Math.max(1500, Math.round(voll * (1 - bau.beeintraechtigung)));
    },

    /** Klartext zum Zustand */
    zustandsText(zustand) {
        if (zustand >= 88) return "neuwertig";
        if (zustand >= 72) return "gut in Schuss";
        if (zustand >= 55) return "in die Jahre gekommen";
        if (zustand >= 38) return "sanierungsbedürftig";
        return "marode";
    },

    // -------------------------------------------------------------- Bauen

    /** Was ein Ausbau oder eine Sanierung den Verein kostet - nach Fördermitteln */
    kosten(club, key, art, saison = 1) {
        return this.kostenDetail(club, key, art, saison).netto;
    },

    /** Baupreis, Fördermittel und Eigenanteil */
    kostenDetail(club, key, art, saison = 1) {
        const anlagen = this.hole(club, saison);
        const a = anlagen[key];
        if (!a) return { brutto: 0, foerderung: 0, netto: 0, quote: 0 };
        const stufe = club?.level || 1;
        const faktor = this.BAU_FAKTOR[stufe] ?? 0.04;

        let preis;
        if (art === "ausbau") {
            const liste = this.FACILITY_COSTS[key] || [2000000, 4000000, 8000000, 15000000];
            preis = liste[a.stufe - 1] || a.stufe * 2500000;
        } else {
            // Eine Sanierung kostet nach Größe und danach, wie viel aufzuholen ist
            const luecke = Math.max(0, 100 - a.zustand) / 100;
            const grundpreis = (this.FACILITY_COSTS[key] || [2000000])[0] || 2000000;
            preis = grundpreis * (0.25 + a.stufe * 0.16) * (0.35 + luecke);
        }
        // Auf glatte Beträge: 1.000 € in kleinen Ligen, 10.000 € darüber
        const runde = (b) => { const s = b < 1000000 ? 1000 : 10000; return Math.round(b / s) * s; };
        const brutto = runde(preis * faktor);
        const quote = this.FOERDER_QUOTE[stufe] || 0;
        const foerderung = runde(brutto * quote);
        return { brutto, foerderung, netto: brutto - foerderung, quote };
    },

    /**
     * Ob und wie sich ein Vorhaben über die Hausbank finanzieren lässt.
     *
     * Liefert Anzahlung, Rate je Spieltag, Zinsen und ob die Bank mitmacht.
     */
    finanzierung(state, club, key, art = "ausbau", schnell = false) {
        const saison = state?.seasonYear || 1;
        const preis = Math.round(this.kosten(club, key, art, saison) * (schnell ? this.SCHICHTBETRIEB.kosten : 1));
        const f = this.FINANZIERUNG;
        const tage = this.dauer(key, art, club, schnell);
        const wochen = Math.max(f.minWochen, Math.ceil(tage / 7));
        const anzahlung = Math.round(preis * f.anzahlung / 100) * 100;
        const kredit = preis - anzahlung;
        const zinsen = Math.round(kredit * f.zins / 100) * 100;
        const rate = Math.ceil((kredit + zinsen) / wochen / 100) * 100;

        const finance = _facResolve("FinanceEngine", "./financeEngine.js");
        const einnahmen = finance && typeof finance.einnahmenSchaetzung === "function"
            ? finance.einnahmenSchaetzung(club, state) : 0;
        const kasse = club?.balance || 0;
        let grund = null;
        if (kasse < anzahlung) {
            grund = `Für die Anzahlung von ${this.geld(anzahlung)} reicht die Kasse nicht.`;
        } else if (einnahmen > 0 && rate > einnahmen * f.maxRatenAnteil) {
            grund = `Die Bank winkt ab: Eine Rate von ${this.geld(rate)} je Woche wäre mehr als ein Viertel der Einnahmen.`;
        }
        return {
            preis, anzahlung, kredit, zinsen, rate, tage, wochen,
            gesamt: anzahlung + kredit + zinsen,
            moeglich: !grund, grund
        };
    },

    /** Wie viele Tage die Arbeit dauert - nach Anlage, Ligastufe und Tempo */
    dauer(key, art, club = null, schnell = false) {
        const basis = (this.BAUZEIT[key] || { ausbau: 120, sanierung: 60 })[art] || 70;
        const stufe = this.BAUZEIT_STUFE[club?.level || 1] ?? 0.4;
        return Math.max(14, Math.round(basis * stufe * (schnell ? this.SCHICHTBETRIEB.zeit : 1)));
    },

    /** Ältere Spielstände zählten in Spieltagen - ein Spieltag ist eine Woche */
    migriereProjekt(p) {
        if (!p || typeof p.restTage === "number") return p;
        p.restTage = Math.max(1, Math.round((p.restSpieltage || 1) * 7));
        p.tage = Math.max(p.restTage, Math.round((p.spieltage || p.restSpieltage || 1) * 7));
        p.tagZurRate = 7;
        delete p.restSpieltage;
        delete p.spieltage;
        return p;
    },

    /** Fertige Anlagen, die noch abbezahlt werden: jede Woche eine Rate */
    bedieneBaukredite(state, club) {
        const finance = _facResolve("FinanceEngine", "./financeEngine.js");
        club.baukredite.forEach(k => {
            k.tagZurRate = (k.tagZurRate || 7) - 1;
            if (k.tagZurRate > 0 || !(k.offen > 0)) return;
            k.tagZurRate = 7;
            const zahlung = Math.min(k.rate, k.offen);
            club.balance = (club.balance || 0) - zahlung;
            k.offen -= zahlung;
            if (finance && typeof finance.recordTransaction === "function") {
                finance.recordTransaction(state, club.id, "facility_cost", -zahlung, `Baukredit: ${k.name}`);
            }
        });
        club.baukredite = club.baukredite.filter(k => k.offen > 0);
    },

    /** Was der Verein der Bank für Bauten noch schuldet */
    offeneBaukredite(state, club) {
        const laufend = this.ANLAGEN.reduce((s, k) => s + (club?.anlagen?.[k]?.projekt?.raten?.offen || 0), 0);
        return laufend + (club?.baukredite || []).reduce((s, k) => s + (k.offen || 0), 0);
    },

    /** "4 Monate" / "9 Wochen" / "20 Tage" */
    dauerText(tage) {
        if (tage >= 75) return `rund ${Math.round(tage / 30)} Monate`;
        if (tage >= 14) return `${Math.round(tage / 7)} Wochen`;
        return `${tage} Tage`;
    },

    /** "noch 9 Wochen" / "noch 5 Tage" */
    restText(p) {
        const t = Math.max(0, p?.restTage || 0);
        if (t < 14) return `noch ${t} ${t === 1 ? "Tag" : "Tage"}`;
        return `noch ${Math.round(t / 7)} Wochen`;
    },

    /** Das Datum, an dem es voraussichtlich fertig ist (aus dem Kalender), oder null */
    fertigAm(state, p) {
        const kal = state?.calendar;
        if (!Array.isArray(kal) || !p) return null;
        const tag = kal[(state.currentDayIndex || 0) + Math.max(0, p.restTage || 0)];
        return tag && tag.date ? String(tag.date).replace(/\.\d{4}$/, "") : null;
    },

    /**
     * Ein Bauvorhaben starten.
     *
     * Es beginnt sofort, kostet sofort - und wirkt erst, wenn es fertig ist.
     */
    starteProjekt(state, clubId, key, art = "ausbau", optionen = {}) {
        if (!state) return { erfolg: false, grund: "Kein Spielstand." };
        const club = (state.clubs || []).find(c => c.id === clubId);
        if (!club) return { erfolg: false, grund: "Verein nicht gefunden." };
        if (!this.FACILITY_NAMES[key]) return { erfolg: false, grund: "Unbekannte Anlage." };
        if (art !== "ausbau" && art !== "sanierung") return { erfolg: false, grund: "Unbekannte Arbeit." };

        const saison = state.seasonYear || 1;
        const anlagen = this.hole(club, saison);
        const a = anlagen[key];
        const name = this.FACILITY_NAMES[key];

        if (a.projekt) {
            return { erfolg: false, grund: `Am ${name} wird bereits gebaut - ${this.restText(this.migriereProjekt(a.projekt))}.` };
        }
        if (art === "ausbau" && a.stufe >= 5) {
            return { erfolg: false, grund: `${name}: Stufe 5 ist die höchste. Halten lässt sie sich nur durch Sanierung.` };
        }
        // Eine Sanierung an einer Anlage in gutem Zustand ist hinausgeworfenes
        // Geld: Sie kostet Millionen, sperrt die Anlage für Wochen und bringt
        // ein paar Prozentpunkte. Deshalb wird sie erst ab "in die Jahre
        // gekommen" freigegeben.
        if (art === "sanierung" && a.zustand >= 85) {
            return {
                erfolg: false,
                grund: `${name} ist ${this.zustandsText(a.zustand)} (${Math.round(a.zustand)} %) - `
                    + `eine Sanierung wäre hinausgeworfenes Geld. Lohnend wird sie, wenn der Zustand unter 85 % fällt.`
            };
        }

        const schnell = !!optionen.schnell;
        const detail = this.kostenDetail(club, key, art, saison);
        // Schichtbetrieb: Der Aufpreis trägt der Verein, nicht die Förderung
        const preis = Math.round(detail.netto + (schnell ? detail.brutto * (this.SCHICHTBETRIEB.kosten - 1) : 0));
        // Ein vom Vorstand bewilligter Zuschuss fließt mit dem Baubeginn
        // (nur in der Saison, in der er bewilligt wurde)
        const zuschuss = art === "ausbau" && club.bauzuschuss && club.bauzuschuss.key === key
            && club.bauzuschuss.saison === (state.seasonYear || 1)
            ? Math.min(preis, club.bauzuschuss.betrag || 0) : 0;
        const raten = optionen.finanzierung === "raten" ? this.finanzierung(state, club, key, art, schnell) : null;
        if (raten && !raten.moeglich) return { erfolg: false, grund: raten.grund };
        if (!raten && (club.balance || 0) + zuschuss < preis) {
            const fehlt = preis - (club.balance || 0);
            const bank = this.finanzierung(state, club, key, art, schnell);
            return {
                erfolg: false,
                grund: `Nicht genug Geld: ${name} ${art === "ausbau" ? "ausbauen" : "sanieren"} kostet `
                    + `${this.geld(preis)}, es fehlen ${this.geld(fehlt)}.`
                    + (bank.moeglich ? ` Die Hausbank würde es in Raten finanzieren.` : ""),
                ratenMoeglich: bank.moeglich
            };
        }

        const tage = this.dauer(key, art, club, schnell);
        const sofort = raten ? raten.anzahlung : preis;
        club.balance -= sofort;

        a.projekt = {
            art,
            kosten: raten ? raten.gesamt : preis,
            tage,
            restTage: tage,
            tagZurRate: 7,
            schnell,
            beeintraechtigung: (this.BEEINTRAECHTIGUNG[key] || {})[art] || 0.2,
            begonnen: state.currentMatchday || 1,
            saison
        };
        if (raten) {
            a.projekt.raten = { rate: raten.rate, offen: raten.kredit + raten.zinsen, zinsen: raten.zinsen };
        }

        const finance = _facResolve("FinanceEngine", "./financeEngine.js");
        if (finance && typeof finance.recordTransaction === "function") {
            finance.recordTransaction(state, club.id, "facility_cost", -sofort,
                `${art === "ausbau" ? "Ausbau" : "Sanierung"}: ${name}${raten ? " (Anzahlung)" : ""}`);
        }
        if (zuschuss > 0) {
            club.balance += zuschuss;
            delete club.bauzuschuss;
            if (finance && typeof finance.recordTransaction === "function") {
                finance.recordTransaction(state, club.id, "other", zuschuss, `Zuschuss des Vorstands: ${name}`);
            }
        }

        if (club.id === state.userClubId) {
            const zahlung = raten
                ? `Anzahlung ${this.geld(raten.anzahlung)}, danach ${this.geld(raten.rate)} je Woche `
                  + `(${this.geld(raten.zinsen)} Zinsen, zusammen ${this.geld(raten.gesamt)})`
                : this.geld(preis);
            this.postfach(state, `Baubeginn: ${name}`,
                `Die Arbeiten am ${name} haben begonnen.\n\n`
                + `${art === "ausbau" ? `Ausbau auf Stufe ${a.stufe + 1}` : "Sanierung"} · `
                + `${zahlung} · ${this.dauerText(tage)}${schnell ? " im Schichtbetrieb" : ""}`
                + (this.fertigAm(state, a.projekt) ? `, fertig um den ${this.fertigAm(state, a.projekt)}.` : ".")
                + (detail.foerderung > 0 ? `\nDie Sportstättenförderung trägt ${this.geld(detail.foerderung)} der Baukosten.` : "")
                + `\n\n`
                + (key === "stadium"
                    ? `Während der Bauzeit stehen rund ${Math.round(a.projekt.beeintraechtigung * 100)} % `
                      + `der Plätze nicht zur Verfügung. Die Zuschauereinnahmen gehen entsprechend zurück.`
                    : `Der Betrieb läuft eingeschränkt weiter, bis die Arbeiten abgeschlossen sind.`));
        }

        return {
            erfolg: true, projekt: a.projekt, name, kosten: a.projekt.kosten, tage,
            sofort, rate: raten ? raten.rate : 0, foerderung: detail.foerderung
        };
    },

    /**
     * Ein Tag vergeht - Bauvorhaben kommen voran, auch in der Sommer- und
     * der Winterpause (CalendarEngine.advanceOneDay).
     *
     * Wird für alle Vereine gerufen, damit auch die Konkurrenz baut.
     */
    tagesTick(state) {
        if (!state || !Array.isArray(state.clubs)) return [];
        const saison = state.seasonYear || 1;
        const fertig = [];

        state.clubs.forEach(club => {
            if (Array.isArray(club.baukredite) && club.baukredite.length) this.bedieneBaukredite(state, club);
            // Nur wer baut: Vereine ohne Anlagen oder ohne Baustelle kosten nichts
            if (!club.anlagen || !this.ANLAGEN.some(k => club.anlagen[k]?.projekt)) return;
            const anlagen = this.hole(club, saison);
            this.ANLAGEN.forEach(key => {
                const a = anlagen[key];
                if (!a || !a.projekt) return;
                this.migriereProjekt(a.projekt);
                a.projekt.restTage--;

                // Finanzierte Vorhaben zahlen jede Woche eine Rate an die Bank,
                // am letzten Tag den Rest
                const raten = a.projekt.raten;
                a.projekt.tagZurRate = (a.projekt.tagZurRate || 7) - 1;
                if (raten && raten.offen > 0 && a.projekt.tagZurRate <= 0) {
                    a.projekt.tagZurRate = 7;
                    const zahlung = Math.min(raten.rate, raten.offen);
                    club.balance = (club.balance || 0) - zahlung;
                    raten.offen -= zahlung;
                    const finance = _facResolve("FinanceEngine", "./financeEngine.js");
                    if (finance && typeof finance.recordTransaction === "function") {
                        finance.recordTransaction(state, club.id, "facility_cost", -zahlung,
                            `Baurate: ${this.FACILITY_NAMES[key]}`);
                    }
                }

                if (a.projekt.restTage > 0) return;

                const art = a.projekt.art;
                // Was der Bank noch zusteht, läuft als Baukredit weiter
                if (raten && raten.offen > 0) {
                    if (!Array.isArray(club.baukredite)) club.baukredite = [];
                    club.baukredite.push({ name: this.FACILITY_NAMES[key], rate: raten.rate, offen: raten.offen, tagZurRate: a.projekt.tagZurRate || 7 });
                }
                a.projekt = null;

                if (art === "ausbau") {
                    a.stufe = Math.min(5, a.stufe + 1);
                    club.facilities[key] = a.stufe;
                    // Neu gebaut ist auch gut in Schuss
                    a.zustand = Math.max(a.zustand, 92);
                    a.baujahr = saison;
                    this.wirkeAusbau(state, club, key, a);
                } else {
                    a.zustand = Math.min(100, a.zustand + 45 + Math.round(Math.random() * 15));
                    a.baujahr = saison;
                }

                fertig.push({ clubId: club.id, key, art, stufe: a.stufe, zustand: a.zustand });

                if (club.id === state.userClubId) {
                    const name = this.FACILITY_NAMES[key];
                    this.postfach(state, `Fertig: ${name}`,
                        art === "ausbau"
                            ? `Der Ausbau ist abgeschlossen. ${name} steht jetzt auf Stufe ${a.stufe}.`
                              + (key === "stadium"
                                  ? `\n\nDas Stadion fasst nun ${(club.stadiumCapacity || 0).toLocaleString("de-DE")} Zuschauer.`
                                  : "")
                            : `Die Sanierung ist abgeschlossen. ${name} ist wieder ${this.zustandsText(a.zustand)}.`);
                }
            });
        });

        return fertig;
    },

    /** Was ein abgeschlossener Ausbau bewirkt */
    wirkeAusbau(state, club, key, anlage) {
        if (key === "stadium") {
            const alt = club.stadiumCapacity || club.capacity || 20000;
            const neu = Math.round(alt * 1.16);
            club.stadiumCapacity = neu;
            club.capacity = neu;
            return;
        }
        if (key === "youthCenter") {
            if (club.youthAcademy) club.youthAcademy.level = anlage.stufe;
            if (club.id === state.userClubId && state.youthAcademy) {
                state.youthAcademy.level = anlage.stufe;
            }
        }
    },

    /**
     * Eine Saison vergeht - alles wird ein Jahr älter.
     *
     * Der Verfall ist der Grund, warum eine Anlage nie "fertig" ist: Wer
     * einmal gebaut und nie wieder hingesehen hat, steht nach fünf Jahren mit
     * einer großen, maroden Anlage da.
     */
    saisonwechsel(state) {
        if (!state || !Array.isArray(state.clubs)) return;
        const saison = state.seasonYear || 1;

        state.clubs.forEach(club => {
            const anlagen = this.hole(club, saison);
            this.ANLAGEN.forEach(key => {
                const a = anlagen[key];
                if (!a || a.projekt) return;   // An der Baustelle verfällt nichts
                const verfall = this.VERFALL_JE_SAISON[a.stufe] || 2.5;
                a.zustand = Math.round(Math.max(5, a.zustand - verfall - Math.random() * 1.2));
            });
        });

        this.kiBaut(state);

        // Der Vorstand meldet sich, wenn etwas dringend wird
        const eigener = state.clubs.find(c => c.id === state.userClubId);
        if (!eigener) return;
        const marode = this.ANLAGEN
            .filter(k => (eigener.anlagen?.[k]?.zustand ?? 100) < 45)
            .map(k => `${this.FACILITY_NAMES[k]} (${this.zustandsText(eigener.anlagen[k].zustand)})`);

        if (marode.length) {
            this.postfach(state, "Der Bauausschuss bittet um ein Gespräch",
                `Unsere Anlagen kommen in die Jahre. Besonders dringend:\n\n`
                + marode.map(m => `• ${m}`).join("\n")
                + `\n\nEine Sanierung ist deutlich günstiger als ein Neubau - `
                + `und sie kostet uns weniger Betrieb, wenn wir sie nicht bis zum Äußersten aufschieben.`);
        }
    },

    /**
     * Die Konkurrenz baut auch.
     *
     * Ohne das hier wäre die Sache in fünf Jahren entschieden: Der Manager
     * saniert und baut aus, während die Anlagen aller anderen Vereine nur
     * verfallen. Nach zehn Saisons hätte der eigene Verein die einzige intakte
     * Akademie der Liga - nicht weil er gut gewirtschaftet hat, sondern weil
     * sonst niemand hingesehen hat.
     *
     * Ein Verein pro Saison ein Vorhaben: Was marode ist, wird zuerst saniert;
     * wer Geld übrig hat und alles in Schuss, baut aus. Wer knapp bei Kasse
     * ist, lässt es - genau wie ein echter Verein.
     */
    kiBaut(state) {
        const saison = state.seasonYear || 1;

        state.clubs.forEach(club => {
            if (club.id === state.userClubId) return;

            const anlagen = club.anlagen;
            if (!anlagen) return;
            // Wer schon baut, fängt nichts Zweites an
            if (this.ANLAGEN.some(k => anlagen[k]?.projekt)) return;

            // Eine Rücklage bleibt immer stehen - kein Verein baut sich pleite.
            // Die feste Untergrenze wächst mit der Liga: Zwei Millionen hätten
            // jedem Amateurverein das Bauen für immer verboten.
            const faktor = this.BAU_FAKTOR[club.level || 1] ?? 0.04;
            const ruecklage = Math.max(2000000 * faktor, (club.balance || 0) * 0.35);
            const frei = (club.balance || 0) - ruecklage;
            if (frei <= 0) return;

            // Zuerst das, was am ehesten auseinanderfällt
            const marode = this.ANLAGEN
                .filter(k => anlagen[k] && anlagen[k].zustand < 55)
                .sort((a, b) => anlagen[a].zustand - anlagen[b].zustand)[0];

            if (marode && this.kosten(club, marode, "sanierung", saison) <= frei) {
                this.starteProjekt(state, club.id, marode, "sanierung");
                return;
            }

            // Sonst ausbauen, wenn es Geld und eine kleine Anlage gibt
            const klein = this.ANLAGEN
                .filter(k => anlagen[k] && anlagen[k].stufe < 5)
                .sort((a, b) => anlagen[a].stufe - anlagen[b].stufe)[0];

            if (klein && this.kosten(club, klein, "ausbau", saison) <= frei * 0.7) {
                this.starteProjekt(state, club.id, klein, "ausbau");
            }
        });
    },

    /** Der jährliche Unterhalt - je größer die Anlage, desto teurer */
    unterhaltJeSpieltag(club, saison = 1) {
        const anlagen = this.hole(club, saison);
        let summe = 0;
        this.ANLAGEN.forEach(key => {
            const a = anlagen[key];
            if (!a) return;
            summe += a.stufe * a.stufe * 1800;
        });
        return Math.round(summe);
    },

    /**
     * Alles, was die Oberfläche über eine Anlage wissen muss.
     */
    uebersicht(state, clubId) {
        const club = (state.clubs || []).find(c => c.id === clubId);
        if (!club) return [];
        const saison = state.seasonYear || 1;
        const anlagen = this.hole(club, saison);

        return this.ANLAGEN.map(key => {
            const a = anlagen[key];
            const wirksam = this.wirksameStufe(club, key, saison);
            const ausbau = a.stufe < 5 ? this.kostenDetail(club, key, "ausbau", saison) : null;
            return {
                foerderQuote: this.FOERDER_QUOTE[club.level || 1] || 0,
                foerderungAusbau: ausbau ? ausbau.foerderung : 0,
                finanzierungAusbau: a.stufe < 5 && !a.projekt ? this.finanzierung(state, club, key, "ausbau") : null,
                key,
                name: this.FACILITY_NAMES[key],
                stufe: a.stufe,
                wirksameStufe: wirksam,
                zustand: Math.round(a.zustand),
                zustandsText: this.zustandsText(a.zustand),
                alter: Math.max(0, saison - a.baujahr),
                projekt: a.projekt ? { ...this.migriereProjekt(a.projekt), restText: this.restText(a.projekt), fertigAm: this.fertigAm(state, a.projekt) } : null,
                kostenAusbau: a.stufe < 5 ? this.kosten(club, key, "ausbau", saison) : null,
                kostenSanierung: this.kosten(club, key, "sanierung", saison),
                dauerAusbau: this.dauer(key, "ausbau", club),
                dauerSanierung: this.dauer(key, "sanierung", club),
                dauerAusbauSchnell: this.dauer(key, "ausbau", club, true),
                dauerSanierungSchnell: this.dauer(key, "sanierung", club, true),
                kapazitaet: key === "stadium" ? this.verfuegbareKapazitaet(club, saison) : null,
                vollKapazitaet: key === "stadium" ? (club.stadiumCapacity || club.capacity) : null,
                profil: key === "youthCenter"
                    ? (this.AKADEMIE_PROFILE[club.akademieProfil] || this.AKADEMIE_PROFILE.ausgewogen)
                    : null
            };
        });
    },

    geld(betrag) {
        const gs = _facResolve("GameState", "./gameState.js");
        if (gs && typeof gs.formatMoney === "function") return gs.formatMoney(betrag);
        if (betrag >= 1000000) return `${(betrag / 1000000).toFixed(1)} Mio. €`;
        return `${Math.round(betrag / 1000)} Tsd. €`;
    },

    postfach(state, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday || 1,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: "Bauabteilung",
            subject: betreff,
            title: betreff,
            body: text,
            text,
            read: false,
            type: "facility"
        });
    },

    /**
     * Der alte Aufruf aus früheren Fassungen: sofort ausbauen.
     *
     * Er startet jetzt ein Bauvorhaben, statt die Stufe augenblicklich zu
     * erhöhen - der Rückgabewert bleibt gleich, damit alte Aufrufer nicht
     * brechen.
     */
    upgrade(state, clubId, facilityKey) {
        const res = this.starteProjekt(state, clubId, facilityKey, "ausbau");
        if (!res.erfolg) return { success: false, error: res.grund };
        return {
            success: true,
            message: `${res.name}: Ausbau begonnen - ${this.dauerText(res.tage)}, ${this.geld(res.kosten)}.`
        };
    }
};

if (typeof window !== "undefined") {
    window.FacilityEngine = FacilityEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { FacilityEngine };
}
