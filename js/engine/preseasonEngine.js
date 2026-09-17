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
 *  - Der Trainerstab: Vier Fachbereiche, für jeden gibt es Bewerber mit
 *    unterschiedlicher Güte und unterschiedlichem Gehalt. Wer gut einkauft,
 *    entwickelt seine Spieler schneller und hält sie länger fit.
 *  - Die Sponsoren: Mehrere Angebote, die sich in Höhe, Laufzeit und
 *    Erwartung unterscheiden. Ein hohes Angebot mit harter Zielvorgabe kann
 *    sich rächen.
 *  - Die Testspiele: Gegner unterschiedlicher Stärke. Sie zählen für keine
 *    Tabelle, bringen aber Spielpraxis, Fitness und Einspielzeit - und gegen
 *    einen starken Gegner lernt man mehr als gegen einen Kreisligisten.
 *
 * Am Ende steht ein kleines Vorbereitungsturnier, danach beginnt die Saison.
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
    /** Die vier Fachbereiche eines Trainerstabs */
    static BEREICHE = [
        { key: "fitness", titel: "Athletiktrainer", wirkung: "Kondition und Belastungssteuerung" },
        { key: "analyse", titel: "Spielanalyst", wirkung: "Gegneranalyse und Taktikarbeit" },
        { key: "medizin", titel: "Mannschaftsarzt", wirkung: "Verletzungen und Genesungszeiten" },
        { key: "nachwuchs", titel: "Nachwuchsleiter", wirkung: "Entwicklung junger Spieler" }
    ];

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

        // Ein bestehender Stab bleibt über die Saisons hinweg bestehen
        if (!club.staff) club.staff = {};

        state.preseason = {
            aktiv: true,
            tagIndex: 0,
            dauer: this.DAUER_TAGE,
            bewerber,
            sponsorAngebote: this.erzeugeSponsorenAngebote(state, club),
            sponsorGewaehlt: false,
            testspiele: this.findeTestspielGegner(state, club),
            turnier: null,
            berichte: []
        };

        if (Array.isArray(state.inbox)) {
            state.inbox.unshift({
                id: Date.now() + 41,
                matchday: 0,
                date: `Vorbereitung Saison ${state.seasonYear || 1}`,
                sender: "Sportdirektor",
                subject: "☀️ Die Vorbereitung beginnt",
                body: `Vier Wochen bis zum ersten Spieltag.\n\nZu erledigen:\n• Trainerstab zusammenstellen - für jeden Fachbereich liegen Bewerbungen vor\n• Sponsorenangebot auswählen\n• ${state.preseason.testspiele.length} Testspiele stehen an\n\nDanach beginnt die Punkterunde.`,
                read: false,
                type: "preseason"
            });
        }

        return state.preseason;
    }

    // --------------------------------------------------------- Entscheidungen

    /** Einen Bewerber verpflichten */
    static verpflichte(state, bereichKey, bewerberId) {
        const pre = state.preseason;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return { ok: false, grund: "Keine Vorbereitung aktiv" };

        const liste = pre.bewerber?.[bereichKey] || [];
        const kandidat = liste.find(b => b.id === bewerberId);
        if (!kandidat) return { ok: false, grund: "Bewerber nicht gefunden" };

        const wochenbudget = club.wageBudget || 0;
        const stabKosten = this.stabKosten(club) - (club.staff?.[bereichKey]?.gehalt || 0);
        if (stabKosten + kandidat.gehalt > wochenbudget * 0.25) {
            return { ok: false, grund: "Der Gehaltsetat gibt das nicht her - der Stab darf höchstens ein Viertel davon kosten." };
        }

        if (!club.staff) club.staff = {};
        club.staff[bereichKey] = {
            id: kandidat.id,
            name: kandidat.name,
            guete: kandidat.guete,
            gehalt: kandidat.gehalt,
            titel: kandidat.titel
        };

        pre.bewerber[bereichKey] = liste.filter(b => b.id !== bewerberId);
        return { ok: true, staff: club.staff[bereichKey] };
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
     * Spielt ein Testspiel aus. Es zählt für keine Tabelle, wirkt aber auf
     * Fitness, Spielschärfe und das Einspielen der Mannschaft.
     */
    static spieleTestspiel(state, testId) {
        const pre = state.preseason;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!pre || !club) return null;

        const test = (pre.testspiele || []).find(t => t.id === testId);
        if (!test || test.gespielt) return null;

        const gegner = (state.clubs || []).find(c => c.id === test.gegnerId);
        const matchEngine = _preResolve("MatchEngine", "./matchEngine.js");
        if (!gegner || !matchEngine) return null;

        const partie = {
            id: `friendly_${state.seasonYear || 1}_${testId}`,
            played: false,
            freundschaftsspiel: true,
            homeClubId: test.heim ? club.id : gegner.id,
            awayClubId: test.heim ? gegner.id : club.id
        };

        const heim = test.heim ? club : gegner;
        const gast = test.heim ? gegner : club;
        matchEngine.simulateFullMatch(partie, heim, gast, state.players);

        const eigene = test.heim ? partie.homeGoals : partie.awayGoals;
        const fremde = test.heim ? partie.awayGoals : partie.homeGoals;

        test.gespielt = true;
        test.ergebnis = `${eigene}:${fremde}`;

        // Spielpraxis: Wer gespielt hat, gewinnt Spielschärfe. Gegen einen
        // starken Gegner lernt die Mannschaft mehr.
        const anspruch = Math.max(0.6, Math.min(1.5, (test.gegnerRuf || 60) / (club.reputation || 60)));
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

        pre.berichte.unshift({
            titel: `Testspiel ${test.heim ? "gegen" : "bei"} ${test.gegnerName}`,
            text: `${eigene}:${fremde} - ${this.testspielFazit(eigene, fremde, anspruch)}`
        });

        // Das Freundschaftsspiel darf keine Tabelle und keine Statistik anfassen
        if (typeof matchEngine.compactPlayedMatch === "function") {
            matchEngine.compactPlayedMatch(partie, true);
        }

        return { test, partie };
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

        const offen = [];
        this.BEREICHE.forEach(b => {
            if (!club.staff?.[b.key]) offen.push(`${b.titel} nicht besetzt`);
        });
        if (!pre.sponsorGewaehlt) offen.push("Kein Sponsorenangebot angenommen");
        const ungespielt = (pre.testspiele || []).filter(t => !t.gespielt).length;
        if (ungespielt > 0) offen.push(`${ungespielt} Testspiel${ungespielt === 1 ? "" : "e"} offen`);
        return offen;
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
                body: `Die Punkterunde beginnt.\n\nTrainerstab:\n${stab.length ? stab.join("\n") : "• Kein Stab verpflichtet - der Verein arbeitet mit Bordmitteln."}\n\nSponsor: ${club.sponsor?.name || "keiner"}\n\nViel Erfolg!`,
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
