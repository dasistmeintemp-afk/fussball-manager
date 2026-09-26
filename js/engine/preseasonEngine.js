/**
 * PreseasonEngine - Die Wochen vor dem ersten Spieltag
 *
 * Bisher begann eine Karriere mit einem Klick und der erste Spieltag stand
 * sofort an. Es gab nichts zu entscheiden, bevor es zählte: kein Trainerstab,
 * den man sich zusammenstellt, keine Sponsorenverhandlung, keine Testspiele,
 * in denen man sieht, ob die Mannschaft trägt.
 *
 * Genau das ist im Fußball aber die Zeit, in der ein Manager arbeitet. Diese
 * Engine füllt sie mit drei Entscheidungen, die alle Folgen haben:
 *
 *  - Der Trainerstab: Fünf Fachbereiche, für jeden gibt es Bewerber mit
 *    unterschiedlicher Güte und unterschiedlichem Gehalt. Wer gut einkauft,
 *    entwickelt seine Spieler schneller und hält sie länger fit.
 *  - Die Sponsoren: Mehrere Angebote, die sich in Höhe, Laufzeit und
 *    Erwartung unterscheiden. Ein hohes Angebot mit harter Zielvorgabe kann
 *    sich rächen.
 *  - Das Spielprogramm: Vier Termine stehen im Kalender, und was an ihnen
 *    gespielt wird, entscheidet der Manager selbst. Er kann Turniere annehmen
 *    oder ablehnen und er kann sich seine Testspiele einzeln zusammensuchen,
 *    indem er Vereine anfragt - die dürfen auch absagen.
 *
 * Ein Turnier belegt zwei Termine (Halbfinale und Endspiel bzw. Spiel um
 * Platz drei), ein vereinbartes Testspiel belegt einen. Wer einen Termin nicht
 * verplant, bekommt vom Sportdirektor einen Gegner gestellt - passiv sein darf
 * man, nur bringt es nichts ein.
 */

const _preRandom = (typeof Random !== "undefined" && Random)
    ? Random
    : ((typeof require !== "undefined") ? require("../core/random.js").Random : {
        float: (min, max) => Math.random() * (max - min) + min,
        int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        choice: arr => arr[Math.floor(Math.random() * arr.length)],
        chance: prob => Math.random() < prob
    });

function _preResolve(globalName, pfad) {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(pfad)[globalName]; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

class PreseasonEngine {
    /** Die fünf Fachbereiche eines Trainerstabs */
    static BEREICHE = [
        { key: "cotrainer", titel: "Co-Trainer", wirkung: "Hinweise, Gegneranalyse und delegierte Entscheidungen im Livespiel" },
        { key: "fitness", titel: "Athletiktrainer", wirkung: "Kondition und Belastungssteuerung" },
        { key: "analyse", titel: "Spielanalyst", wirkung: "Gegneranalyse und Taktikarbeit" },
        { key: "medizin", titel: "Mannschaftsarzt", wirkung: "Verletzungen und Genesungszeiten" },
        { key: "nachwuchs", titel: "Nachwuchsleiter", wirkung: "Entwicklung junger Spieler und Qualität der Jahrgänge" },
        { key: "scout", titel: "Chefscout", wirkung: "Scoutingberichte: Genauigkeit, Tiefe und Einschätzung" }
    ];

    /**
     * Posten, ohne die kein Verein in die Saison gehen sollte. Ohne Arzt
     * dauern Verletzungen länger, ohne Athletiktrainer leidet die Kondition,
     * ohne Co-Trainer steht der Manager an der Seitenlinie allein.
     */
    static PFLICHT = ["medizin", "fitness", "cotrainer"];

    /** Anteil des Gehaltsetats, den der Stab höchstens kosten darf */
    static STAB_ANTEIL = 0.25;

    /** Wie lange die Vorbereitung dauert */
    static DAUER_TAGE = 24;

    // ------------------------------------------------------------ Trainerstab

    static namePool(state) {
        const pools = _preResolve("NAME_POOLS", "../data/namePools.js");
        if (pools && Array.isArray(pools.firstNames) && pools.firstNames.length) return pools;
        return { firstNames: ["Michael", "Thomas", "Andreas"], lastNames: ["Berger", "Frank", "Wolter"] };
    }

    static erzeugeName(state) {
        const pool = this.namePool(state);
        const v = _preRandom.choice(pool.firstNames);
        const n = _preRandom.choice(pool.lastNames);
        return `${v} ${n}`;
    }

    /**
     * Bewerber für einen Fachbereich.
     *
     * Die Güte richtet sich nach dem, was der Verein zu bieten hat: Ein
     * Spitzenklub bekommt bessere Bewerbungen als ein Abstiegskandidat. Teuer
     * ist nicht automatisch gut - es gibt Schnäppchen und Blender.
     */
    static erzeugeBewerber(club, bereich, anzahl = 3) {
        const staffEngine = _preResolve("CoachingStaffEngine", "./coachingStaffEngine.js");
        const basis = staffEngine ? (staffEngine.staffQuality(club)?.overall ?? 55) : 55;

        const bewerber = [];
        for (let i = 0; i < anzahl; i++) {
            // Um das Vereinsniveau herum, mit echten Ausreißern nach oben und unten
            const guete = Math.max(20, Math.min(97, Math.round(
                basis + _preRandom.float(-14, 16)
            )));
            // Das Gehalt folgt der Güte, aber nicht exakt - so entstehen
            // Schnäppchen und überbezahlte Namen.
            const marktwert = Math.round(Math.pow(1.085, guete - 30) * 900);
            const gehalt = Math.max(600, Math.round(marktwert * _preRandom.float(0.72, 1.35) / 50) * 50);

            bewerber.push({
                id: `staff_${bereich.key}_${i}_${Math.random().toString(36).slice(2, 7)}`,
                name: this.erzeugeName(),
                bereich: bereich.key,
                titel: bereich.titel,
                guete,
                gehalt,
                // Was er mindestens nehmen würde - das erfährt man nur am Tisch
                mindestGehalt: Math.max(500, Math.round(gehalt * _preRandom.float(0.8, 0.95) / 50) * 50),
                alter: _preRandom.int(34, 62),
                ruf: this.rufText(guete)
            });
        }
        return bewerber.sort((a, b) => b.guete - a.guete);
    }

    static rufText(guete) {
        if (guete >= 88) return "Weltklasse";
        if (guete >= 78) return "Hervorragend";
        if (guete >= 68) return "Stark";
        if (guete >= 58) return "Solide";
        if (guete >= 46) return "Durchwachsen";
        return "Schwach";
    }

    // -------------------------------------------------------------- Sponsoren

    static SPONSOR_NAMEN = [
        "Nordlicht Energie", "Kraftwerk Mobil", "Auerbach Versicherung", "Vitalis Getränke",
        "Steinmann Logistik", "Hanseatic Bank", "Rheinstrom", "Weber Bau", "Panorama Reisen",
        "Silberberg Technik", "Feldmann Supermärkte", "Orbit Telekom"
    ];

    /**
     * Sponsorenangebote.
     *
     * Die Angebote unterscheiden sich bewusst in ihrer Art: Ein vorsichtiger
     * Partner zahlt wenig, erwartet aber nichts. Ein ehrgeiziger zahlt
     * deutlich mehr und knüpft eine Prämie an ein Saisonziel - wird es
     * verfehlt, bleibt die Prämie aus.
     */
    static erzeugeSponsorenAngebote(state, club) {
        const finance = _preResolve("FinanceEngine", "./financeEngine.js");
        const basis = finance && typeof finance.sponsorPerMatchday === "function"
            ? finance.sponsorPerMatchday(club)
            : 500000;

        const namen = [...this.SPONSOR_NAMEN].sort(() => Math.random() - 0.5);

        const machen = (schluessel, faktor, jahre, ziel, praemieFaktor, beschreibung) => ({
            id: `sponsor_${schluessel}_${Math.random().toString(36).slice(2, 7)}`,
            art: schluessel,
            name: namen.pop() || "Regionalpartner",
            amountPerMatchday: Math.max(20000, Math.round(basis * faktor / 1000) * 1000),
            yearsRemaining: jahre,
            zielPlatz: ziel,
            praemie: ziel ? Math.max(0, Math.round(basis * praemieFaktor / 10000) * 10000) : 0,
            beschreibung
        });

        return [
            machen("sicher", 0.82, 3, null, 0,
                "Zahlt verlässlich, erwartet nichts. Drei Jahre Ruhe."),
            machen("standard", 1.0, 2, null, 0,
                "Marktüblich, zwei Jahre Laufzeit, keine Bedingungen."),
            machen("ehrgeizig", 1.34, 1,
                this.zielPlatzFuer(club), 8,
                "Zahlt deutlich mehr - knüpft aber eine Prämie an das Saisonziel.")
        ];
    }

    static zielPlatzFuer(club) {
        const erwartung = club?.boardExpectation;
        if (erwartung === "championship") return 1;
        if (erwartung === "top3") return 4;
        if (erwartung === "midfield") return 10;
        return 15;
    }

    // ------------------------------------------------------------ Testspiele

    /**
     * Sucht Gegner für die Testspiele.
     *
     * Ein Testspiel gegen einen klar stärkeren Gegner bringt mehr Erkenntnis
     * und mehr Einspielzeit, kostet aber Substanz; gegen einen schwächeren
     * lässt sich in Ruhe rotieren. Die Auswahl mischt deshalb bewusst.
     */
    static findeTestspielGegner(state, club, anzahl = 4) {
        const alle = (state.clubs || []).filter(c => c.id !== club.id);
        if (alle.length === 0) return [];

        const eigenerRuf = club.reputation || 60;
        const nachAbstand = (ziel) => alle
            .map(c => ({ c, d: Math.abs((c.reputation || 60) - ziel) }))
            .sort((a, b) => a.d - b.d);

        const gewaehlt = [];
        const nehmen = (ziel) => {
            const kandidaten = nachAbstand(ziel).filter(e => !gewaehlt.some(g => g.id === e.c.id));
            const treffer = kandidaten[_preRandom.int(0, Math.min(4, kandidaten.length - 1))];
            if (treffer) gewaehlt.push(treffer.c);
        };

        // Aufbau wie in der Wirklichkeit: Die Vorbereitung beginnt gegen
        // regionale Gegner und steigert sich bis zu einem Gradmesser auf
        // Augenhoehe. Vorher lagen die Stufen so hoch, dass selbst der stärkste
        // Kader drei von vier Testspielen verlor - das ist kein Aufbau, das ist
        // eine Strafrunde.
        const stufen = [eigenerRuf - 26, eigenerRuf - 16, eigenerRuf - 7, eigenerRuf + 3];
        for (let i = 0; i < anzahl; i++) nehmen(stufen[i % stufen.length]);

        return gewaehlt.map((gegner, idx) => ({
            id: `test_${idx}`,
            gegnerId: gegner.id,
            gegnerName: gegner.name,
            gegnerRuf: gegner.reputation || 60,
            heim: idx % 2 === 0,
            gespielt: false,
            ergebnis: null
        }));
    }

    // -------------------------------------------------------- Terminplanung
    //
    // Der Kalender stellt vier Termine bereit. Frueher wurden sie stumm mit
    // vier Gegnern gefuellt - der Manager hatte nichts zu entscheiden. Jetzt
    // sind es Plaetze, die er selbst belegt: mit einem Turnier (zwei Termine)
    // oder mit einem Testspiel, das er sich bei einem Verein erfragt.

    /** So viele Termine hat die Vorbereitung */
    static SLOTS = 4;

    static leerePlanung() {
        return Array.from({ length: this.SLOTS }, () => null);
    }

    /**
     * Aeltere Spielstaende kennen nur die fertige Testspielliste. Damit sie
     * weiterlaufen, wird daraus eine Planung gebaut, statt sie zu verwerfen.
     */
    /**
     * Bewerber für Fachbereiche, die es beim Start der Vorbereitung noch
     * nicht gab - ein Spielstand aus der Zeit vor dem Co-Trainer hätte sonst
     * einen offenen Posten ohne eine einzige Bewerbung.
     */
    static sichereBewerber(pre, club) {
        if (!pre || !club) return pre;
        if (!pre.bewerber || typeof pre.bewerber !== "object") pre.bewerber = {};
        this.BEREICHE.forEach(b => {
            // Auch wer alle Bewerber vergrault hat, bekommt für einen offenen
            // Posten neue Bewerbungen - nur eben weniger
            const liste = pre.bewerber[b.key];
            if (!club.staff?.[b.key] && (!Array.isArray(liste) || liste.length === 0)) {
                pre.bewerber[b.key] = this.erzeugeBewerber(club, b, Array.isArray(liste) ? 2 : 3);
            }
        });
        return pre;
    }

    static sichereStruktur(pre) {
        if (!pre) return pre;
        if (!Array.isArray(pre.turniere)) pre.turniere = [];
        if (!Array.isArray(pre.kontakte)) pre.kontakte = [];
        if (!Array.isArray(pre.testspiele)) pre.testspiele = [];
        if (!Array.isArray(pre.berichte)) pre.berichte = [];
        if (!Array.isArray(pre.plan)) {
            pre.plan = this.leerePlanung();
            pre.testspiele.forEach((t, i) => {
                if (i < pre.plan.length) {
                    t.slot = i;
                    pre.plan[i] = { art: "test", testId: t.id };
                }
            });
        }
        return pre;
    }

    /** Freie Termine, in zeitlicher Reihenfolge */
    static freieSlots(pre) {
        if (!pre) return [];
        this.sichereStruktur(pre);
        const frei = [];
        pre.plan.forEach((e, i) => { if (!e) frei.push(i); });
        return frei;
    }

    // ----------------------------------------------------------- Turniere

    static TURNIER_ORTE = [
        "Kitzbuehel", "Zell am See", "Bad Ragaz", "Innsbruck", "Marbella",
        "Girona", "Faro", "Rotterdam", "Salzburg", "Lissabon", "Bozen", "Graz"
    ];

    /**
     * Die drei Kaliber, in denen Einladungen hereinkommen.
     *
     * Die Gegnerstaerke ist bewusst relativ zum eigenen Ruf gedacht: Ein
     * Zweitligist bekommt keine Einladung zu einem Turnier mit drei
     * Champions-League-Teilnehmern, ein Spitzenklub faehrt nicht zum
     * Kreispokal. Was sich unterscheidet, ist der Abstand - und damit, wie
     * hart das Programm wird und was es einbringt.
     */
    static TURNIER_STUFEN = [
        {
            key: "regional",
            name: "Regionalcup",
            versatz: -20,
            geld: 0.5,
            hinweis: "Drei Gegner aus der Umgebung. Wenig Widerstand, aber sicheres Antrittsgeld."
        },
        {
            key: "einladung",
            name: "Einladungsturnier",
            versatz: -6,
            geld: 1.0,
            hinweis: "Gegner auf Augenhoehe. Ein ehrlicher Gradmesser vor dem ersten Spieltag."
        },
        {
            key: "masters",
            name: "Masters",
            versatz: 10,
            geld: 2.1,
            hinweis: "Namhafte Gegner und hohe Prämien - dafür ein hartes Programm."
        }
    ];

    static waehleNah(alle, ziel, ausgeschlossen) {
        const kandidaten = alle
            .filter(c => !ausgeschlossen.has(c.id))
            .map(c => ({ c, d: Math.abs((c.reputation || 60) - ziel) }))
            .sort((a, b) => a.d - b.d);
        if (!kandidaten.length) return null;
        const treffer = kandidaten[_preRandom.int(0, Math.min(3, kandidaten.length - 1))];
        return treffer ? treffer.c : null;
    }

    static turnierGeldBasis(club) {
        const finance = _preResolve("FinanceEngine", "./financeEngine.js");
        return finance && typeof finance.sponsorPerMatchday === "function"
            ? Math.max(50000, finance.sponsorPerMatchday(club))
            : 400000;
    }

    /** Einladungen, die vor der Vorbereitung auf dem Tisch liegen */
    static erzeugeTurniere(state, club) {
        const alle = (state.clubs || []).filter(c => c.id !== club.id);
        if (alle.length < 3) return [];

        const eigenerRuf = club.reputation || 60;
        const basis = this.turnierGeldBasis(club);
        const orte = [...this.TURNIER_ORTE].sort(() => Math.random() - 0.5);
        const vergeben = new Set();

        return this.TURNIER_STUFEN.map((stufe, idx) => {
            // Drei Gegner um das Kaliber der Einladung herum - einer etwas
            // staerker, einer auf Hoehe, einer etwas schwaecher.
            const teilnehmer = [];
            [6, 0, -6].forEach(abstand => {
                const gegner = this.waehleNah(alle, eigenerRuf + stufe.versatz + abstand, vergeben);
                if (gegner) {
                    vergeben.add(gegner.id);
                    teilnehmer.push({
                        id: gegner.id,
                        name: gegner.name,
                        ruf: gegner.reputation || 60
                    });
                }
            });
            if (teilnehmer.length < 3) return null;

            const geld = (faktor) => Math.round(basis * stufe.geld * faktor / 10000) * 10000;

            return {
                id: `turnier_${stufe.key}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
                stufe: stufe.key,
                name: `${stufe.name} ${orte.pop() || "Winterthur"}`,
                hinweis: stufe.hinweis,
                teilnehmer,
                antrittsgeld: geld(0.5),
                praemien: { 1: geld(2.0), 2: geld(1.2), 3: geld(0.7), 4: geld(0.4) },
                status: "offen",
                slots: [],
                halbfinale: null,
                anderesHalbfinale: null,
                endspiel: null,
                platz: null
            };
        }).filter(Boolean);
    }

    /** Ein Turnier annehmen - es belegt die naechsten zwei freien Termine */
    static nimmTurnierAn(state, turnierId) {
        const pre = this.sichereStruktur(state?.preseason);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return { ok: false, grund: "Keine Vorbereitung aktiv" };

        const turnier = pre.turniere.find(t => t.id === turnierId);
        if (!turnier) return { ok: false, grund: "Turnier nicht gefunden" };
        if (turnier.status === "angenommen") return { ok: false, grund: "Bereits zugesagt" };

        const frei = this.freieSlots(pre);
        if (frei.length < 2) {
            return {
                ok: false,
                grund: "Ein Turnier braucht zwei freie Termine - der Spielplan ist zu voll."
            };
        }

        const [halb, final] = frei;
        pre.plan[halb] = { art: "turnier", turnierId, runde: "halbfinale" };
        pre.plan[final] = { art: "turnier", turnierId, runde: "endspiel" };
        turnier.slots = [halb, final];
        turnier.status = "angenommen";

        // Das Antrittsgeld gibt es fuers Kommen, nicht fuers Gewinnen
        this.zahleAus(state, club, turnier.antrittsgeld, `Antrittsgeld ${turnier.name}`);

        return { ok: true, turnier };
    }

    /** Eine Einladung ausschlagen */
    static sageTurnierAb(state, turnierId) {
        const pre = this.sichereStruktur(state?.preseason);
        if (!pre) return { ok: false, grund: "Keine Vorbereitung aktiv" };
        const turnier = pre.turniere.find(t => t.id === turnierId);
        if (!turnier) return { ok: false, grund: "Turnier nicht gefunden" };
        if (turnier.status === "angenommen") return { ok: false, grund: "Bereits zugesagt" };
        turnier.status = "abgelehnt";
        return { ok: true, turnier };
    }

    /**
     * Eine Zusage zurueckziehen, solange noch nicht gespielt wurde. Das
     * Antrittsgeld geht zurueck an den Veranstalter.
     */
    static storniereTurnier(state, turnierId) {
        const pre = this.sichereStruktur(state?.preseason);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return { ok: false, grund: "Keine Vorbereitung aktiv" };

        const turnier = pre.turniere.find(t => t.id === turnierId);
        if (!turnier || turnier.status !== "angenommen") {
            return { ok: false, grund: "Dieses Turnier ist nicht zugesagt" };
        }
        if (turnier.halbfinale) {
            return { ok: false, grund: "Das Turnier läuft bereits - jetzt geht es nicht mehr zurück." };
        }

        (turnier.slots || []).forEach(i => { pre.plan[i] = null; });
        turnier.slots = [];
        turnier.status = "offen";
        this.zahleAus(state, club, -turnier.antrittsgeld, `Antrittsgeld zurück: ${turnier.name}`);
        return { ok: true, turnier };
    }

    // ------------------------------------------------- Testspiele vereinbaren

    /**
     * Die Vereine, die der Sportdirektor auf dem Zettel hat.
     *
     * Bewusst quer durch das Feld: ein paar klar schwaechere, die fast immer
     * zusagen, ein paar auf Augenhoehe und zwei, bei denen eine Zusage ein
     * kleiner Coup waere.
     */
    static erzeugeKontaktliste(state, club, anzahl = 10, belegt = null) {
        const alle = (state.clubs || []).filter(c => c.id !== club.id);
        if (!alle.length) return [];

        const eigenerRuf = club.reputation || 60;
        const ziele = [-30, -23, -17, -11, -6, -2, 2, 7, 13, 20];
        // Wer schon in einem Turnier auf dem Zettel steht, taucht nicht auch
        // noch als Testspielgegner auf - sonst spielt man ihn womoeglich zweimal.
        const vergeben = new Set(belegt || []);
        const liste = [];

        for (let i = 0; i < Math.min(anzahl, ziele.length); i++) {
            const gegner = this.waehleNah(alle, eigenerRuf + ziele[i], vergeben);
            if (!gegner) continue;
            vergeben.add(gegner.id);
            liste.push({
                clubId: gegner.id,
                name: gegner.name,
                ruf: gegner.reputation || 60,
                liga: gegner.level || 1,
                status: "offen",
                grund: null
            });
        }
        return liste.sort((a, b) => b.ruf - a.ruf);
    }

    /**
     * Wie wahrscheinlich eine Zusage ist.
     *
     * Ein deutlich staerkerer Verein hat seine Vorbereitung laengst geplant und
     * sucht sich Gegner, die ihm etwas bringen. Nach unten hin sagt fast jeder
     * zu - ein Heimspiel gegen einen groesseren Namen fuellt die Kasse.
     */
    static bereitschaft(club, gegnerRuf) {
        const diff = (gegnerRuf || 60) - (club.reputation || 60);
        const p = 0.92 - Math.max(0, diff) * 0.030 - Math.max(0, -diff) * 0.002;
        return Math.max(0.06, Math.min(0.95, p));
    }

    static bereitschaftText(p) {
        if (p >= 0.8) return "sagt fast sicher zu";
        if (p >= 0.6) return "dürfte zusagen";
        if (p >= 0.4) return "offener Ausgang";
        if (p >= 0.2) return "schwierig";
        return "kaum Chance";
    }

    static ABSAGEN = [
        "hat bereits ein Trainingslager im Ausland gebucht",
        "spielt an diesem Termin gegen einen anderen Gegner",
        "will in der Vorbereitung nur gegen internationale Gegner spielen",
        "kann den Termin wegen einer Stadionsanierung nicht anbieten",
        "sagt ab: Der Trainer will die Belastung anders steuern"
    ];

    /**
     * Einen Verein anfragen. Er kann zusagen - oder eben nicht.
     */
    static frageTestspielAn(state, clubId) {
        const pre = this.sichereStruktur(state?.preseason);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return { ok: false, grund: "Keine Vorbereitung aktiv" };

        const kontakt = pre.kontakte.find(k => String(k.clubId) === String(clubId));
        if (!kontakt) return { ok: false, grund: "Verein steht nicht auf der Liste" };
        if (kontakt.status !== "offen") {
            return { ok: false, grund: "Dieser Verein wurde bereits angefragt" };
        }

        const frei = this.freieSlots(pre);
        if (!frei.length) {
            return { ok: false, grund: "Es ist kein Termin mehr frei." };
        }

        const gegner = (state.clubs || []).find(c => c.id === kontakt.clubId);
        if (!gegner) return { ok: false, grund: "Verein nicht gefunden" };

        const p = this.bereitschaft(club, kontakt.ruf);
        if (!_preRandom.chance(p)) {
            kontakt.status = "abgesagt";
            kontakt.grund = _preRandom.choice(this.ABSAGEN);
            return { ok: true, zugesagt: false, kontakt };
        }

        // Der groessere Name faehrt zum kleineren - dort fuellt er das Stadion
        const heim = (kontakt.ruf || 60) >= (club.reputation || 60);
        const slot = frei[0];
        const test = {
            id: `test_${slot}_${Math.random().toString(36).slice(2, 7)}`,
            gegnerId: gegner.id,
            gegnerName: gegner.name,
            gegnerRuf: kontakt.ruf,
            heim,
            slot,
            selbstVereinbart: true,
            gespielt: false,
            ergebnis: null
        };
        pre.testspiele.push(test);
        pre.plan[slot] = { art: "test", testId: test.id };
        kontakt.status = "zugesagt";
        kontakt.grund = null;

        return { ok: true, zugesagt: true, kontakt, test };
    }

    /** Ein vereinbartes Testspiel wieder absetzen, solange es nicht gespielt ist */
    static sageTestspielAb(state, testId) {
        const pre = this.sichereStruktur(state?.preseason);
        if (!pre) return { ok: false, grund: "Keine Vorbereitung aktiv" };
        const test = pre.testspiele.find(t => t.id === testId);
        if (!test || test.gespielt) return { ok: false, grund: "Das Spiel laesst sich nicht mehr absetzen" };

        if (typeof test.slot === "number") pre.plan[test.slot] = null;
        pre.testspiele = pre.testspiele.filter(t => t.id !== testId);
        const kontakt = pre.kontakte.find(k => String(k.clubId) === String(test.gegnerId));
        if (kontakt) { kontakt.status = "offen"; kontakt.grund = null; }
        return { ok: true };
    }

    // ----------------------------------------------------------- Aufsetzen

    /**
     * Legt die Vorbereitung für eine Saison an. Wird bei jedem Saisonstart
     * aufgerufen - auch beim Karrierestart.
     */
    static start(state) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return null;

        const bewerber = {};
        this.BEREICHE.forEach(b => { bewerber[b.key] = this.erzeugeBewerber(club, b); });

        const turniere = this.erzeugeTurniere(state, club);
        const imTurnier = new Set();
        turniere.forEach(t => t.teilnehmer.forEach(g => imTurnier.add(g.id)));

        // Ein bestehender Stab bleibt über die Saisons hinweg bestehen
        if (!club.staff) club.staff = {};

        state.preseason = {
            aktiv: true,
            tagIndex: 0,
            dauer: this.DAUER_TAGE,
            bewerber,
            sponsorAngebote: this.erzeugeSponsorenAngebote(state, club),
            sponsorGewaehlt: false,
            // Vier Termine, die der Manager selbst belegt
            plan: this.leerePlanung(),
            testspiele: [],
            turniere,
            kontakte: this.erzeugeKontaktliste(state, club, 10, imTurnier),
            berichte: []
        };

        if (Array.isArray(state.inbox)) {
            const einladungen = state.preseason.turniere
                .map(t => `• ${t.name} - Antrittsgeld ${Math.round(t.antrittsgeld / 1000)} Tsd., Siegprämie ${Math.round(t.praemien[1] / 1000)} Tsd.`)
                .join("\n");
            state.inbox.unshift({
                id: Date.now() + 41,
                matchday: 0,
                date: `Vorbereitung Saison ${state.seasonYear || 1}`,
                sender: "Sportdirektor",
                subject: "☀️ Die Vorbereitung beginnt",
                body: `Vier Wochen bis zum ersten Spieltag.\n\nZu erledigen:\n• Trainerstab zusammenstellen - für jeden Fachbereich liegen Bewerbungen vor\n• Sponsorenangebot auswählen\n• ${this.SLOTS} Spieltermine verplanen\n\nEs liegen ${state.preseason.turniere.length} Turniereinladungen vor:\n${einladungen}\n\nEin Turnier belegt zwei Termine. Wenn Sie lieber selbst planen, kann ich bei einzelnen Vereinen wegen eines Testspiels anfragen - zusagen müssen die allerdings selbst.\n\nWas nicht verplant ist, besetze ich kurzfristig. Erwarten Sie dann aber keinen Gegner, der Sie weiterbringt.`,
                read: false,
                type: "preseason"
            });
        }

        return state.preseason;
    }

    // --------------------------------------------------------- Entscheidungen

    /**
     * Einen Bewerber verpflichten - zu seiner Forderung oder zu dem Gehalt,
     * auf das man sich geeinigt hat (opts.gehalt, opts.jahre).
     */
    static verpflichte(state, bereichKey, bewerberId, opts = {}) {
        const pre = state.preseason;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return { ok: false, grund: "Keine Vorbereitung aktiv" };

        const liste = pre.bewerber?.[bereichKey] || [];
        const kandidat = liste.find(b => b.id === bewerberId);
        if (!kandidat) return { ok: false, grund: "Bewerber nicht gefunden" };

        const gehalt = Math.round(opts.gehalt || kandidat.gehalt);
        const rahmen = this.stabRahmen(club);
        const stabKosten = this.stabKosten(club) - (club.staff?.[bereichKey]?.gehalt || 0);
        if (stabKosten + gehalt > rahmen) {
            return {
                ok: false,
                grund: `Der Gehaltsetat gibt das nicht her: Der Stab darf höchstens ${this.geldText(rahmen)} je Woche kosten, `
                    + `mit ${kandidat.name} wären es ${this.geldText(stabKosten + gehalt)}.`
            };
        }

        const bereich = this.BEREICHE.find(b => b.key === bereichKey);
        const vorgaenger = club.staff?.[bereichKey] || null;
        if (!club.staff) club.staff = {};
        club.staff[bereichKey] = {
            id: kandidat.id,
            name: kandidat.name,
            guete: kandidat.guete,
            gehalt,
            jahre: opts.jahre || 2,
            titel: kandidat.titel
        };

        pre.bewerber[bereichKey] = liste.filter(b => b.id !== bewerberId);

        // Der Sportdirektor meldet die Verpflichtung - mit dem, was sie für den
        // Etat bedeutet und was noch fehlt
        const kostenJetzt = this.stabKosten(club);
        const offen = this.BEREICHE.filter(b => !club.staff?.[b.key]).map(b => b.titel);
        const sterne = this.sterneText(kandidat.guete);
        const meldung = {
            titel: `${kandidat.name} ist neuer ${bereich?.titel || kandidat.titel}`,
            text: `${kandidat.name} (${kandidat.alter}) unterschreibt als ${bereich?.titel || kandidat.titel} `
                + `für ${opts.jahre || 2} Jahr(e). Qualität ${sterne} (${kandidat.guete}), Gehalt ${this.geldText(gehalt)} je Woche.`
                + (vorgaenger ? ` ${vorgaenger.name} verlässt den Verein.` : "")
                + `\n\nDer Stab kostet jetzt ${this.geldText(kostenJetzt)} von höchstens ${this.geldText(rahmen)} je Woche `
                + `(${Math.round(kostenJetzt / Math.max(1, rahmen) * 100)} %).`
                + (offen.length ? `\nNoch offen: ${offen.join(", ")}.` : "\nDer Trainerstab ist komplett.")
        };
        if (Array.isArray(state.inbox)) {
            state.inbox.unshift({
                id: Date.now() + Math.floor(Math.random() * 1000),
                matchday: 0,
                date: state.currentDate || `Vorbereitung Saison ${state.seasonYear || 1}`,
                sender: "Sportdirektor",
                subject: `✍️ ${meldung.titel}`,
                body: meldung.text,
                read: false,
                type: "preseason"
            });
        }

        return { ok: true, staff: club.staff[bereichKey], meldung, kosten: kostenJetzt, rahmen, offen };
    }

    /** Wie viel der Stab je Woche höchstens kosten darf */
    static stabRahmen(club) {
        return Math.round((club?.wageBudget || 0) * this.STAB_ANTEIL);
    }

    /** Güte eines Stabsmitglieds in Sternen (0,5 bis 5) */
    static sterne(guete) {
        const staffEngine = _preResolve("CoachingStaffEngine", "./coachingStaffEngine.js");
        if (staffEngine && typeof staffEngine.sterne === "function") return staffEngine.sterne(guete);
        return Math.max(0.5, Math.min(5, Math.round((1 + (guete - 25) / 18) * 2) / 2));
    }

    static sterneText(guete) {
        const s = this.sterne(guete);
        return "★".repeat(Math.floor(s)) + (s % 1 ? "½" : "") + ` (${String(s).replace(".", ",")} Sterne)`;
    }

    /**
     * Gehaltsverhandlung mit einem Bewerber.
     *
     * Jeder Bewerber hat eine Forderung und ein Minimum, das man nicht sieht.
     * Eine längere Laufzeit ist ihm etwas wert: Für drei Jahre Sicherheit geht
     * er etwas herunter, für ein Jahr will er mehr. Unter seinem Minimum macht
     * er ein Gegenangebot, das sich ihm Runde für Runde nähert - wer ihn zu
     * tief ansetzt oder zu lange feilscht, verliert ihn.
     *
     * Rückgabe: { status: "einig" | "gegenangebot" | "abgebrochen" | "fehler", ... }
     */
    static verhandleStab(state, bereichKey, bewerberId, angebot, jahre = 2) {
        const pre = state.preseason;
        const liste = pre?.bewerber?.[bereichKey] || [];
        const kandidat = liste.find(b => b.id === bewerberId);
        if (!kandidat) return { status: "fehler", text: "Bewerber nicht gefunden." };

        if (!kandidat.mindestGehalt) {
            kandidat.mindestGehalt = Math.max(500, Math.round(kandidat.gehalt * 0.88 / 50) * 50);
        }
        const laufzeit = Math.max(1, Math.min(3, Math.round(jahre) || 2));
        const faktor = { 1: 1.06, 2: 1, 3: 0.95 }[laufzeit];
        const minimum = Math.round(kandidat.mindestGehalt * faktor / 50) * 50;
        const betrag = Math.round(Number(angebot) || 0);

        if (betrag >= minimum) {
            const r = this.verpflichte(state, bereichKey, bewerberId, { gehalt: betrag, jahre: laufzeit });
            if (!r.ok) return { status: "fehler", text: r.grund };
            return {
                status: "einig", staff: r.staff, meldung: r.meldung,
                text: `${kandidat.name} ist einverstanden: ${this.geldText(betrag)} je Woche für ${laufzeit} Jahr(e).`
            };
        }

        kandidat.runden = (kandidat.runden || 0) + 1;
        // Ein Angebot weit unter Wert empfindet er als Affront - und nach der
        // dritten Runde hat er genug
        if (betrag < minimum * 0.7 || kandidat.runden >= 3) {
            pre.bewerber[bereichKey] = liste.filter(b => b.id !== bewerberId);
            return {
                status: "abgebrochen",
                text: betrag < minimum * 0.7
                    ? `${kandidat.name} bricht die Gespräche ab - das Angebot empfindet er als respektlos.`
                    : `${kandidat.name} hat genug verhandelt und sagt ab.`
            };
        }

        const vorher = kandidat.letzteForderung || Math.round(kandidat.gehalt * faktor / 50) * 50;
        const gegen = Math.max(minimum, Math.round((vorher + minimum) / 2 / 50) * 50);
        kandidat.letzteForderung = gegen;
        return {
            status: "gegenangebot",
            gegenangebot: gegen,
            runde: kandidat.runden,
            text: `${kandidat.name} lehnt ab und verlangt ${this.geldText(gegen)} je Woche`
                + ` bei ${laufzeit} Jahr(en) Laufzeit.${kandidat.runden === 2 ? " Viel Geduld hat er nicht mehr." : ""}`
        };
    }

    /** Die Pflichtposten, die noch unbesetzt sind */
    static pflichtLuecken(state) {
        const club = (state?.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return [];
        return this.PFLICHT
            .filter(key => !club.staff?.[key])
            .map(key => this.BEREICHE.find(b => b.key === key))
            .filter(Boolean);
    }

    /**
     * Der Sportdirektor besetzt einen Posten kurzfristig: den besten
     * Bewerber, den der Etat noch hergibt - zu seiner Forderung.
     */
    static besetzeKurzfristig(state, bereichKey) {
        const pre = state.preseason;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return { ok: false, grund: "Keine Vorbereitung aktiv" };
        this.sichereBewerber(pre, club);
        const rahmen = this.stabRahmen(club);
        const kosten = this.stabKosten(club) - (club.staff?.[bereichKey]?.gehalt || 0);
        const bezahlbar = (pre.bewerber?.[bereichKey] || [])
            .filter(k => kosten + k.gehalt <= rahmen)
            .sort((a, b) => b.guete - a.guete);
        if (!bezahlbar.length) {
            return { ok: false, grund: "Kein Bewerber passt noch in den Etat des Stabs." };
        }
        return this.verpflichte(state, bereichKey, bezahlbar[0].id, { jahre: 1 });
    }

    /**
     * Erinnerung des Sportdirektors, wenn der Saisonstart naht und noch
     * Pflichtposten offen sind - eine Woche, drei Tage und einen Tag vorher.
     */
    static erinnere(state) {
        const pre = state?.preseason;
        if (!pre || !pre.aktiv) return null;
        const rest = (pre.dauer || 0) - (pre.tagIndex || 0);
        if (![7, 3, 1].includes(rest)) return null;
        if (!Array.isArray(pre.erinnert)) pre.erinnert = [];
        if (pre.erinnert.includes(rest)) return null;
        const luecken = this.pflichtLuecken(state);
        if (!luecken.length) return null;
        pre.erinnert.push(rest);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        const frei = Math.max(0, this.stabRahmen(club) - this.stabKosten(club));
        const text = `Noch ${rest} Tag${rest === 1 ? "" : "e"} bis zum ersten Spieltag - und wir haben keinen `
            + `${luecken.map(b => b.titel).join(", keinen ")}.\n\n`
            + `Ohne Arzt dauern Verletzungen länger, ohne Athletiktrainer leidet die Kondition, ohne Co-Trainer `
            + `stehen Sie an der Seitenlinie allein.\n\nIm Etat für den Stab sind noch ${this.geldText(frei)} je Woche frei.`;
        if (Array.isArray(state.inbox)) {
            state.inbox.unshift({
                id: Date.now() + 43 + rest,
                matchday: 0,
                date: state.currentDate || `Vorbereitung Saison ${state.seasonYear || 1}`,
                sender: "Sportdirektor",
                subject: `⚠️ ${luecken.map(b => b.titel).join(", ")} fehlt noch`,
                body: text,
                read: false,
                type: "preseason"
            });
        }
        return { rest, luecken, text };
    }

    /** Wochengehalt des gesamten Stabs */
    static stabKosten(club) {
        if (!club?.staff) return 0;
        return Object.values(club.staff).reduce((s, m) => s + (m?.gehalt || 0), 0);
    }

    /** Ein Sponsorenangebot annehmen */
    static waehleSponsor(state, angebotId) {
        const pre = state.preseason;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return { ok: false, grund: "Keine Vorbereitung aktiv" };

        const angebot = (pre.sponsorAngebote || []).find(a => a.id === angebotId);
        if (!angebot) return { ok: false, grund: "Angebot nicht gefunden" };

        club.sponsor = {
            name: angebot.name,
            amountPerMatchday: angebot.amountPerMatchday,
            yearsRemaining: angebot.yearsRemaining,
            zielPlatz: angebot.zielPlatz,
            praemie: angebot.praemie,
            // Markiert den Vertrag als selbst ausgehandelt - nur dann zaehlt
            // sein Betrag, nicht das Ligamodell der Finanz-Engine.
            ausgehandelt: true
        };
        pre.sponsorGewaehlt = true;
        return { ok: true, sponsor: club.sponsor };
    }

    // ------------------------------------------------------------ Testspiele

    /**
     * Traegt eine Begegnung aus. Sie zählt für keine Tabelle, wirkt aber auf
     * Fitness, Spielschärfe und das Einspielen der Mannschaft.
     *
     * Das ist der gemeinsame Unterbau von Testspiel und Turnierpartie - beide
     * sind Freundschaftsspiele, sie unterscheiden sich nur in dem, was sie
     * bedeuten.
     */
    static austragen(state, club, gegner, heim, kennung, neutral = false, gespielt = null) {
        const matchEngine = _preResolve("MatchEngine", "./matchEngine.js");
        if (!gegner || !matchEngine) return null;

        // Hat der Manager die Partie live verfolgt, ist sie schon gespielt -
        // dann zaehlt genau dieses Ergebnis.
        const partieId = `friendly_${state.seasonYear || 1}_${kennung}`;
        const livePartie = gespielt && gespielt.played && gespielt.id === partieId ? gespielt : null;
        const partie = livePartie || this.neuePartie(state, club, gegner, heim, kennung, neutral);

        if (!livePartie) {
            matchEngine.simulateFullMatch(partie, heim ? club : gegner, heim ? gegner : club, state.players);
        }

        const eigene = heim ? partie.homeGoals : partie.awayGoals;
        const fremde = heim ? partie.awayGoals : partie.homeGoals;

        // Spielpraxis: Wer gespielt hat, gewinnt Spielschärfe. Gegen einen
        // starken Gegner lernt die Mannschaft mehr.
        const anspruch = Math.max(0.6, Math.min(1.5, (gegner.reputation || 60) / (club.reputation || 60)));
        (partie.playerRatings || []).forEach(r => {
            const p = state.players.find(x => String(x.id) === String(r.playerId));
            if (!p || !club.playerIds.includes(p.id)) return;
            const anteil = Math.min(1, (r.minutes || 0) / 90);
            p.matchSharpness = Math.min(100, (p.matchSharpness ?? 60) + anteil * 14 * anspruch);
        });

        // Die Mannschaft spielt sich ein
        if (club.chemistry) {
            club.chemistry.tacticalFamiliarity = Math.min(100,
                (club.chemistry.tacticalFamiliarity ?? 70) + 2.5 * anspruch);
        }

        // Das Freundschaftsspiel darf keine Tabelle und keine Statistik anfassen
        if (typeof matchEngine.compactPlayedMatch === "function") {
            matchEngine.compactPlayedMatch(partie, true);
        }

        return { eigene, fremde, partie, anspruch };
    }

    /** Die Begegnung eines Termins - noch ungespielt */
    static neuePartie(state, club, gegner, heim, kennung, neutral = false, roundName = "Testspiel") {
        return {
            id: `friendly_${state.seasonYear || 1}_${kennung}`,
            played: false,
            freundschaftsspiel: true,
            competitionId: "friendly",
            roundName,
            // Ein Turnier wird nicht im eigenen Stadion gespielt
            neutralerPlatz: neutral,
            homeClubId: heim ? club.id : gegner.id,
            awayClubId: heim ? gegner.id : club.id
        };
    }

    /**
     * Was heute gespielt wird - angesagt wie ein Spieltag.
     *
     * Die Testspiele liefen bisher ungesehen durch: Der Kalender spielte sie
     * beim Weiterklicken aus, und der Manager erfuhr das Ergebnis aus einer
     * Einblendung. Jetzt kann die Oberflaeche den Termin vorher ansagen und
     * ihn live zeigen. Liefert die ungespielte Partie mit Gegner und Titel.
     */
    static partieFuerSlot(state, slotIndex) {
        const pre = this.sichereStruktur(state?.preseason);
        const club = (state?.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return null;

        const index = Math.max(0, Math.min(this.SLOTS - 1, slotIndex || 0));
        let eintrag = pre.plan[index];
        if (!eintrag) {
            if (!this.notfallTestspiel(state, club, index)) return null;
            eintrag = pre.plan[index];
        }
        const finde = (id) => (state.clubs || []).find(c => c.id === id);

        if (eintrag.art === "turnier") {
            const turnier = pre.turniere.find(t => t.id === eintrag.turnierId);
            if (!turnier) return null;
            if (eintrag.runde === "halbfinale") {
                if (turnier.halbfinale) return null;
                const g = turnier.teilnehmer[0];
                const gegner = finde(g?.id);
                if (!gegner) return null;
                return {
                    art: "turnier", gegner, heim: true,
                    titel: `${turnier.name} · Halbfinale`,
                    partie: this.neuePartie(state, club, gegner, true, `${turnier.id}_hf`, true, `${turnier.name} · Halbfinale`)
                };
            }
            if (!turnier.halbfinale || turnier.endspiel) return null;
            const andere = turnier.anderesHalbfinale;
            const gesuchteId = turnier.halbfinale.gewonnen ? andere?.siegerId : andere?.verliererId;
            const g = turnier.teilnehmer.find(t => t.id === gesuchteId) || turnier.teilnehmer[1];
            const gegner = finde(g?.id);
            if (!gegner) return null;
            const runde = turnier.halbfinale.gewonnen ? "Endspiel" : "Spiel um Platz drei";
            return {
                art: "turnier", gegner, heim: true,
                titel: `${turnier.name} · ${runde}`,
                partie: this.neuePartie(state, club, gegner, true, `${turnier.id}_f`, true, `${turnier.name} · ${runde}`)
            };
        }

        const test = pre.testspiele.find(t => t.id === eintrag.testId);
        if (!test || test.gespielt) return null;
        const gegner = finde(test.gegnerId);
        if (!gegner) return null;
        return {
            art: "test", gegner, heim: test.heim,
            titel: `Testspiel ${test.heim ? "gegen" : "bei"} ${test.gegnerName}`,
            partie: this.neuePartie(state, club, gegner, test.heim, test.id)
        };
    }

    /** Spielt ein vereinbartes Testspiel aus */
    static spieleTestspiel(state, testId, gespielt = null) {
        const pre = this.sichereStruktur(state?.preseason);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return null;

        const test = pre.testspiele.find(t => t.id === testId);
        if (!test || test.gespielt) return null;

        const gegner = (state.clubs || []).find(c => c.id === test.gegnerId);
        const ergebnis = this.austragen(state, club, gegner, test.heim, testId, false, gespielt);
        if (!ergebnis) return null;

        test.gespielt = true;
        test.ergebnis = `${ergebnis.eigene}:${ergebnis.fremde}`;

        pre.berichte.unshift({
            titel: `Testspiel ${test.heim ? "gegen" : "bei"} ${test.gegnerName}`,
            text: `${test.ergebnis} - ${this.testspielFazit(ergebnis.eigene, ergebnis.fremde, ergebnis.anspruch)}`
        });

        return { test, partie: ergebnis.partie };
    }

    // --------------------------------------------------------- Termin spielen

    /**
     * Der Kalender ruft hier an: An diesem Termin wird gespielt - was, steht
     * in der Planung.
     *
     * Ein unverplanter Termin ist kein Grund, nicht zu spielen. Der
     * Sportdirektor besetzt ihn kurzfristig. Er findet aber nur das, was
     * kurzfristig zu haben ist: einen deutlich schwaecheren Gegner.
     */
    static spieleSlot(state, slotIndex, gespielt = null) {
        const pre = this.sichereStruktur(state?.preseason);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return null;

        const index = Math.max(0, Math.min(this.SLOTS - 1, slotIndex || 0));
        let eintrag = pre.plan[index];

        if (!eintrag) {
            if (!this.notfallTestspiel(state, club, index)) return null;
            eintrag = pre.plan[index];
        }

        if (eintrag.art === "turnier") {
            return this.spieleTurnierRunde(state, eintrag.turnierId, eintrag.runde, gespielt);
        }
        const ergebnis = this.spieleTestspiel(state, eintrag.testId, gespielt);
        return ergebnis ? { art: "test", ...ergebnis } : null;
    }

    /** Der Gegner, den der Sportdirektor kurzfristig auftreibt */
    static notfallTestspiel(state, club, slotIndex) {
        const gefunden = this.findeTestspielGegner(state, club, 1);
        const gegner = gefunden[0];
        if (!gegner) return null;

        const test = {
            id: `test_auto_${slotIndex}_${Math.random().toString(36).slice(2, 7)}`,
            gegnerId: gegner.gegnerId,
            gegnerName: gegner.gegnerName,
            gegnerRuf: gegner.gegnerRuf,
            heim: true,
            slot: slotIndex,
            selbstVereinbart: false,
            gespielt: false,
            ergebnis: null
        };
        state.preseason.testspiele.push(test);
        state.preseason.plan[slotIndex] = { art: "test", testId: test.id };
        return test;
    }

    // ------------------------------------------------------ Turnier austragen

    /**
     * Entscheidet eine Partie zwischen zwei Vereinen, an denen der Spieler
     * nicht beteiligt ist.
     *
     * Bewusst ohne volle Simulation: Das zweite Halbfinale interessiert nur als
     * Ergebnis, und eine echte Simulation wuerde Fitness und Form zweier
     * fremder Kader anfassen, die damit nichts zu tun haben.
     */
    static entscheideFremdpartie(a, b) {
        const chanceA = 1 / (1 + Math.pow(10, ((b.ruf || 60) - (a.ruf || 60)) / 22));
        const siegerIstA = _preRandom.chance(chanceA);
        const sieger = siegerIstA ? a : b;
        const verlierer = siegerIstA ? b : a;
        const tore = _preRandom.int(1, 3);
        const gegentore = _preRandom.int(0, Math.max(0, tore - 1));
        return {
            siegerId: sieger.id,
            verliererId: verlierer.id,
            text: `${sieger.name} ${tore}:${gegentore} ${verlierer.name}`
        };
    }

    static spieleTurnierRunde(state, turnierId, runde, gespielt = null) {
        const pre = this.sichereStruktur(state?.preseason);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return null;

        const turnier = pre.turniere.find(t => t.id === turnierId);
        if (!turnier) return null;

        return runde === "halbfinale"
            ? this.spieleTurnierHalbfinale(state, club, turnier, gespielt)
            : this.spieleTurnierEndspiel(state, club, turnier, gespielt);
    }

    static spieleTurnierHalbfinale(state, club, turnier, gespielt = null) {
        if (turnier.halbfinale) return null;

        const gegnerEintrag = turnier.teilnehmer[0];
        const gegner = (state.clubs || []).find(c => c.id === gegnerEintrag.id);
        const ergebnis = this.austragen(state, club, gegner, true, `${turnier.id}_hf`, true, gespielt);
        if (!ergebnis) return null;

        // Im Turnier gibt es kein Unentschieden - bei Gleichstand entscheidet
        // das Elfmeterschiessen.
        let weiter = ergebnis.eigene > ergebnis.fremde;
        let zusatz = "";
        if (ergebnis.eigene === ergebnis.fremde) {
            weiter = _preRandom.chance(0.5);
            zusatz = weiter ? " (n. E. gewonnen)" : " (n. E. verloren)";
        }

        turnier.halbfinale = {
            gegnerName: gegnerEintrag.name,
            ergebnis: `${ergebnis.eigene}:${ergebnis.fremde}${zusatz}`,
            gewonnen: weiter
        };
        turnier.anderesHalbfinale = this.entscheideFremdpartie(turnier.teilnehmer[1], turnier.teilnehmer[2]);

        state.preseason.berichte.unshift({
            titel: `${turnier.name} - Halbfinale gegen ${gegnerEintrag.name}`,
            text: `${turnier.halbfinale.ergebnis} - ${weiter ? "Endspiel erreicht." : "Es geht ins Spiel um Platz drei."} Zweites Halbfinale: ${turnier.anderesHalbfinale.text}.`
        });

        return { art: "turnier", runde: "halbfinale", turnier, partie: ergebnis.partie };
    }

    static spieleTurnierEndspiel(state, club, turnier, gespielt = null) {
        if (!turnier.halbfinale || turnier.endspiel) return null;

        const andere = turnier.anderesHalbfinale;
        const gesuchteId = turnier.halbfinale.gewonnen ? andere?.siegerId : andere?.verliererId;
        const gegnerEintrag = turnier.teilnehmer.find(t => t.id === gesuchteId) || turnier.teilnehmer[1];
        const gegner = (state.clubs || []).find(c => c.id === gegnerEintrag.id);
        const ergebnis = this.austragen(state, club, gegner, true, `${turnier.id}_f`, true, gespielt);
        if (!ergebnis) return null;

        let gewonnen = ergebnis.eigene > ergebnis.fremde;
        let zusatz = "";
        if (ergebnis.eigene === ergebnis.fremde) {
            gewonnen = _preRandom.chance(0.5);
            zusatz = gewonnen ? " (n. E. gewonnen)" : " (n. E. verloren)";
        }

        const platz = turnier.halbfinale.gewonnen ? (gewonnen ? 1 : 2) : (gewonnen ? 3 : 4);
        const praemie = turnier.praemien?.[platz] || 0;

        turnier.endspiel = {
            gegnerName: gegnerEintrag.name,
            ergebnis: `${ergebnis.eigene}:${ergebnis.fremde}${zusatz}`,
            gewonnen,
            umPlatzDrei: !turnier.halbfinale.gewonnen
        };
        turnier.platz = platz;
        turnier.status = "gespielt";

        this.zahleAus(state, club, praemie, `Prämie ${turnier.name} (Platz ${platz})`);

        state.preseason.berichte.unshift({
            titel: `${turnier.name} - ${turnier.endspiel.umPlatzDrei ? "Spiel um Platz drei" : "Endspiel"} gegen ${gegnerEintrag.name}`,
            text: `${turnier.endspiel.ergebnis} - Platz ${platz}. Prämie: ${this.geldText(praemie)}.`
        });

        if (Array.isArray(state.inbox)) {
            state.inbox.unshift({
                id: Date.now() + 43,
                matchday: 0,
                date: `Vorbereitung Saison ${state.seasonYear || 1}`,
                sender: "Sportdirektor",
                subject: `🏆 ${turnier.name}: Platz ${platz}`,
                body: `Halbfinale gegen ${turnier.halbfinale.gegnerName}: ${turnier.halbfinale.ergebnis}\n${turnier.endspiel.umPlatzDrei ? "Spiel um Platz drei" : "Endspiel"} gegen ${gegnerEintrag.name}: ${turnier.endspiel.ergebnis}\n\nEndplatzierung: ${platz}\nPrämie: ${this.geldText(praemie)}`,
                read: false,
                type: "preseason"
            });
        }

        return { art: "turnier", runde: "endspiel", turnier, partie: ergebnis.partie };
    }

    // ----------------------------------------------------------------- Geld

    static geldText(betrag) {
        const gs = _preResolve("GameState", "./gameState.js");
        if (gs && typeof gs.formatMoney === "function") return gs.formatMoney(betrag);
        return `${Math.round(betrag / 1000)} Tsd. €`;
    }

    /** Bucht einen Betrag auf das Vereinskonto und schreibt ihn ins Journal */
    static zahleAus(state, club, betrag, zweck) {
        if (!club || !betrag) return;
        club.balance = (club.balance || 0) + betrag;
        const finance = _preResolve("FinanceEngine", "./financeEngine.js");
        if (finance && typeof finance.recordTransaction === "function") {
            finance.recordTransaction(state, club.id, "bonus", betrag, zweck);
        }
    }

    static testspielFazit(eigene, fremde, anspruch) {
        const stark = anspruch > 1.05;
        if (eigene > fremde) return stark ? "Ein starkes Zeichen gegen einen guten Gegner." : "Pflichtaufgabe erledigt.";
        if (eigene === fremde) return stark ? "Ordentlich gehalten." : "Da war mehr drin.";
        return stark ? "Gegen diesen Gegner war das zu erwarten." : "Das war zu wenig.";
    }

    // ------------------------------------------------------------ Abschluss

    /** Ist die Vorbereitung abgeschlossen? */
    static fertig(state) {
        const pre = state.preseason;
        if (!pre || !pre.aktiv) return true;
        return pre.tagIndex >= pre.dauer;
    }

    /** Was noch offen ist - für die Anzeige */
    static offenePunkte(state) {
        const pre = state.preseason;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return [];

        this.sichereStruktur(pre);
        this.sichereBewerber(pre, club);
        const offen = [];
        this.BEREICHE.forEach(b => {
            if (!club.staff?.[b.key]) offen.push(`${b.titel} nicht besetzt`);
        });
        if (!pre.sponsorGewaehlt) offen.push("Kein Sponsorenangebot angenommen");

        // Ein Termin, der noch nicht verplant ist, ist die eigentliche Arbeit:
        // Danach besetzt ihn der Sportdirektor - und zwar schlecht.
        const unverplant = this.freieSlots(pre).filter(i => !this.terminGespielt(pre, i)).length;
        if (unverplant > 0) {
            offen.push(`${unverplant} Spieltermin${unverplant === 1 ? "" : "e"} nicht verplant`);
        }
        // Eine unbeantwortete Einladung ist nur dann noch eine Aufgabe, wenn
        // sie ueberhaupt noch angenommen werden koennte - ein Turnier braucht
        // zwei Termine.
        const offeneEinladungen = unverplant >= 2
            ? pre.turniere.filter(t => t.status === "offen").length
            : 0;
        if (offeneEinladungen > 0) {
            offen.push(`${offeneEinladungen} Turniereinladung${offeneEinladungen === 1 ? "" : "en"} unbeantwortet`);
        }
        return offen;
    }

    /**
     * Was an einem Vorbereitungstermin gespielt wird - für den Kalender.
     */
    static terminBeschreibung(state, index) {
        const pre = this.sichereStruktur(state?.preseason);
        if (!pre) return null;
        const eintrag = pre.plan[index];
        if (!eintrag) return null;

        if (eintrag.art === "turnier") {
            const turnier = pre.turniere.find(t => t.id === eintrag.turnierId);
            if (!turnier) return null;
            const runde = eintrag.runde === "halbfinale"
                ? "Halbfinale"
                : (turnier.halbfinale && !turnier.halbfinale.gewonnen ? "Spiel um Platz drei" : "Endspiel");
            return `${turnier.name} · ${runde}`;
        }

        const test = pre.testspiele.find(t => t.id === eintrag.testId);
        if (!test) return null;
        return `Testspiel ${test.heim ? "gegen" : "bei"} ${test.gegnerName} (Ruf ${test.gegnerRuf})`;
    }

    /** Liegt dieser Termin schon hinter uns? */
    static terminGespielt(pre, index) {
        const bisher = Math.floor(((pre.tagIndex || 0)) / 5);
        return index < bisher;
    }

    /** Was das Vorbereitungsprogramm gebracht hat - in zwei Zeilen */
    static programmBilanz(pre) {
        this.sichereStruktur(pre);
        const zeilen = [];
        pre.turniere.filter(t => t.platz).forEach(t => {
            zeilen.push(`• ${t.name}: Platz ${t.platz}`);
        });
        const gespielt = pre.testspiele.filter(t => t.gespielt);
        if (gespielt.length) {
            const bilanz = gespielt.reduce((b, t) => {
                const [e, f] = String(t.ergebnis || "0:0").split(":").map(Number);
                if (e > f) b.s++; else if (e === f) b.u++; else b.n++;
                return b;
            }, { s: 0, u: 0, n: 0 });
            zeilen.push(`• Testspiele: ${bilanz.s} Siege, ${bilanz.u} Unentschieden, ${bilanz.n} Niederlagen`);
        }
        return zeilen.length ? `Vorbereitungsprogramm:\n${zeilen.join("\n")}` : "";
    }

    /** Beendet die Vorbereitung und übergibt an die Punkterunde */
    static beende(state) {
        const pre = state.preseason;
        if (!pre) return;
        pre.aktiv = false;

        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (club && Array.isArray(state.inbox)) {
            const stab = this.BEREICHE
                .filter(b => club.staff?.[b.key])
                .map(b => `• ${b.titel}: ${club.staff[b.key].name} (${club.staff[b.key].guete})`);
            state.inbox.unshift({
                id: Date.now() + 42,
                matchday: 1,
                date: `Saisonstart ${state.seasonYear || 1}`,
                sender: "Sportdirektor",
                subject: "⚽ Die Vorbereitung ist abgeschlossen",
                body: `Die Punkterunde beginnt.\n\nTrainerstab:\n${stab.length ? stab.join("\n") : "• Kein Stab verpflichtet - der Verein arbeitet mit Bordmitteln."}\n\nSponsor: ${club.sponsor?.name || "keiner"}\n\n${this.programmBilanz(pre)}\n\nViel Erfolg!`,
                read: false,
                type: "preseason"
            });
        }
    }
}

if (typeof window !== "undefined") {
    window.PreseasonEngine = PreseasonEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PreseasonEngine };
}
