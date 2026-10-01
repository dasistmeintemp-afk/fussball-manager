/**
 * DressingRoomEngine - Was ein Ergebnis mit einer Mannschaft macht
 *
 * Bisher ließ ein 5:0 die Kabine exakt so zurück wie ein 0:4. Die Moral
 * bewegte sich nur im Training um ein Pünktchen auf und ab, und der Balken in
 * der Spielerakte stand das ganze Jahr bei 75 Prozent.
 *
 * Fußball funktioniert anders. Ein Sieg trägt eine Mannschaft durch die Woche,
 * eine Klatsche drückt auf alle. Wer spielt, ist zufriedener als wer zuschaut.
 * Wer eine gute Note bekommt, geht mit breiter Brust ins nächste Spiel. Und
 * eine Serie - in die eine oder andere Richtung - verstärkt alles.
 *
 * Man muss dafür nichts einstellen und nichts verstehen: Man sieht es an den
 * Gesichtern im Kader und liest es im Tagesbericht.
 */

class DressingRoomEngine {
    /** Moral bleibt zwischen diesen Grenzen - niemand ist völlig euphorisch oder tot */
    // Auch in einer verkorksten Saison bleibt Berufsstolz übrig - ohne
    // Untergrenze zöge eine Abstiegssaison die Mannschaft in ein Loch, aus
    // dem sie sich nicht mehr herausspielen könnte.
    static MIN_MORAL = 28;
    static MAX_MORAL = 99;

    /**
     * Verarbeitet ein Spiel des eigenen Vereins in der Kabine.
     * Gibt die Stimmungslage zurück, damit der Tagesbericht sie erzählen kann.
     */
    static processMatch(state, match) {
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!club || !match || !match.played) return null;

        const istHeim = match.homeClubId === club.id;
        const eigene = istHeim ? match.homeGoals : match.awayGoals;
        const fremde = istHeim ? match.awayGoals : match.homeGoals;
        const differenz = eigene - fremde;

        const gegnerId = istHeim ? match.awayClubId : match.homeClubId;
        const gegner = state.clubs.find(c => c.id === gegnerId);

        // Ein Sieg beim Favoriten wiegt schwerer als einer gegen den Letzten
        const eigenerRuf = club.reputation || 50;
        const gegnerRuf = gegner?.reputation || 50;
        const aussenseiter = (gegnerRuf - eigenerRuf) / 40; // -1 .. +1

        // Die Ausschläge bleiben bewusst maßvoll: Moral wirkt direkt auf die
        // Spielstärke, ein zu harter Absturz wäre eine Abwärtsspirale, aus der
        // niemand mehr herauskommt.
        let grundstimmung;
        if (differenz > 0) grundstimmung = 4 + Math.min(4, differenz * 1.1) + Math.max(0, aussenseiter) * 3.5;
        else if (differenz === 0) grundstimmung = 0.5 + aussenseiter * 2;
        else grundstimmung = -3.5 + Math.max(-4.5, differenz * 1.1) - Math.max(0, -aussenseiter) * 2.5;

        // Ein Derby zieht in beide Richtungen stärker
        if (match.isDerby) grundstimmung *= 1.5;

        const noten = new Map();
        (match.playerRatings || []).forEach(r => noten.set(String(r.playerId), r));

        const kaderIds = new Set(club.playerIds);
        const kader = state.players.filter(p => kaderIds.has(p.id));
        const gestiegen = [];
        const gefallen = [];

        kader.forEach(player => {
            const eintrag = noten.get(String(player.id));
            const minuten = eintrag?.minutes || 0;
            const note = eintrag?.rating ?? null;

            let delta = grundstimmung;

            if (minuten >= 60) {
                // Wer durchgespielt hat, nimmt das Ergebnis voll mit
                if (note !== null) delta += (note - 6.6) * 3.2;
            } else if (minuten > 0) {
                delta *= 0.75;
                if (note !== null) delta += (note - 6.6) * 1.6;
            } else {
                // Wer zuschauen musste, freut sich weniger und ärgert sich mehr
                delta = delta > 0 ? delta * 0.45 : delta * 0.7;
                delta -= this.bankFrust(player, club);
            }

            const vorher = player.morale ?? 75;
            player.morale = Math.max(this.MIN_MORAL, Math.min(this.MAX_MORAL, vorher + delta));

            // Die Zufriedenheit folgt der Moral, aber träger
            if (!player.happiness) player.happiness = { overall: 75, playingTime: 75, contract: 75, teamPerformance: 75 };
            player.happiness.teamPerformance = Math.max(10, Math.min(100,
                (player.happiness.teamPerformance ?? 75) + grundstimmung * 0.6));
            player.happiness.playingTime = Math.max(10, Math.min(100,
                (player.happiness.playingTime ?? 75) + (minuten >= 45 ? 2.5 : -2.2)));
            player.happiness.overall = Math.round(
                (player.happiness.teamPerformance * 0.35)
                + (player.happiness.playingTime * 0.35)
                + ((player.happiness.contract ?? 75) * 0.3));
            player.happiness.reason = this.stimmungsSatz(player, minuten);

            const veraenderung = player.morale - vorher;
            if (veraenderung >= 6) gestiegen.push(player.name);
            else if (veraenderung <= -6) gefallen.push(player.name);

            // Auch die Form zieht mit: eine gute Note wirkt nach
            if (note !== null) {
                player.form = Math.max(4, Math.min(10,
                    (player.form ?? 7) * 0.72 + note * 0.28));
            }
        });

        // Die Serie verstärkt: drei Siege am Stück heben die ganze Kabine
        const serie = this.serienEffekt(club);
        if (serie !== 0) {
            kader.forEach(p => {
                p.morale = Math.max(this.MIN_MORAL, Math.min(this.MAX_MORAL, (p.morale ?? 75) + serie));
            });
        }

        const schnitt = kader.length
            ? kader.reduce((s, p) => s + (p.morale ?? 75), 0) / kader.length
            : 75;

        return {
            ergebnis: differenz > 0 ? "sieg" : differenz === 0 ? "remis" : "niederlage",
            grundstimmung: Math.round(grundstimmung * 10) / 10,
            serie,
            moralSchnitt: Math.round(schnitt),
            stimmung: this.kabinenLage(schnitt),
            gestiegen: gestiegen.slice(0, 3),
            gefallen: gefallen.slice(0, 3)
        };
    }

    /**
     * Wie sehr nagt es an einem Spieler, wieder nicht gespielt zu haben?
     * Ein Schlüsselspieler auf der Bank ist ein Problem, ein Ergänzungsspieler
     * hat damit gerechnet.
     */
    static bankFrust(player, club) {
        const rolle = player.squadRole || "Kader";
        const ERWARTUNG = {
            "Schlüsselspieler": 3.2,
            "Stammspieler": 2.0,
            "Rotationsspieler": 0.8,
            "Ergänzungsspieler": 0.3,
            "Zukunftstalent": 0.2
        };
        let frust = ERWARTUNG[rolle] ?? 0.6;

        // Wer nicht einmal im Kader steht, ärgert sich zusätzlich
        const imKader = (club.lineup || []).includes(player.id) || (club.bench || []).includes(player.id);
        if (!imKader) frust += 1.2;

        return frust;
    }

    /**
     * Eine Serie trägt oder drückt zusätzlich. Gewertet werden die letzten
     * fünf Spiele, die im Vereinsformverlauf stehen.
     */
    static serienEffekt(club) {
        const form = (club.form || []).filter(r => r && r !== "-");
        if (form.length < 3) return 0;

        const letzte = form.slice(-3);
        if (letzte.every(r => r === "W")) return 4;
        if (letzte.every(r => r === "L")) return -4;

        const letzteFuenf = form.slice(-5);
        if (letzteFuenf.length >= 5 && letzteFuenf.filter(r => r === "W").length >= 4) return 3;
        if (letzteFuenf.length >= 5 && letzteFuenf.filter(r => r === "L").length >= 4) return -3;

        return 0;
    }

    /** Ein Satz, der die Lage eines Spielers beschreibt */
    static stimmungsSatz(player, minuten) {
        const moral = player.morale ?? 75;
        const spielzeit = player.happiness?.playingTime ?? 75;

        if (moral >= 88) return "Bestens gelaunt und voller Selbstvertrauen.";
        if (moral >= 74) return minuten > 0 ? "Zufrieden mit sich und der Mannschaft." : "Zufrieden, würde aber gern mehr spielen.";
        if (moral >= 58) return spielzeit < 55 ? "Unzufrieden mit seiner Spielzeit." : "Durchwachsene Stimmung.";
        if (moral >= 40) return spielzeit < 50
            ? "Frustriert - er sitzt zu oft draußen."
            : "Angeschlagen von den letzten Ergebnissen.";
        return "Tief unzufrieden. Ein Gespräch ist überfällig.";
    }

    /** Die Gesamtlage der Kabine in einem Wort */
    static kabinenLage(schnitt) {
        if (schnitt >= 85) return "ausgelassen";
        if (schnitt >= 72) return "gut";
        if (schnitt >= 58) return "durchwachsen";
        if (schnitt >= 45) return "gedrückt";
        return "am Boden";
    }

    /**
     * Auch die anderen Mannschaften haben eine Kabine.
     *
     * Sonst entsteht ein eingebauter Nachteil, den niemand sehen kann: Die
     * Moral des Nutzervereins schwankt mit den Ergebnissen, die der Gegner
     * steht das ganze Jahr auf dem Wert, mit dem sie erzeugt wurde. Da die
     * Moral direkt in die Spielstärke geht, tritt der Nutzer dauerhaft gegen
     * bestens gelaunte Gegner an.
     *
     * Für die KI reicht eine schlanke Rechnung: Die Form der letzten Spiele
     * bestimmt, wohin sich die Stimmung bewegt.
     */
    static settleAiClubs(state) {
        if (!Array.isArray(state.clubs)) return;

        const spielerNachVerein = new Map();
        state.players.forEach(p => {
            if (!p.clubId || p.clubId === state.userClubId) return;
            if (!spielerNachVerein.has(p.clubId)) spielerNachVerein.set(p.clubId, []);
            spielerNachVerein.get(p.clubId).push(p);
        });

        state.clubs.forEach(club => {
            if (club.id === state.userClubId) return;
            const kader = spielerNachVerein.get(club.id);
            if (!kader || kader.length === 0) return;

            const form = (club.form || []).filter(r => r && r !== "-").slice(-5);
            let ziel = 72;
            if (form.length > 0) {
                const punkte = form.reduce((s, r) => s + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
                const quote = punkte / (form.length * 3);
                ziel = 48 + quote * 44;
            }

            kader.forEach(p => {
                const jetzt = p.morale ?? 75;
                p.morale = Math.max(this.MIN_MORAL, Math.min(this.MAX_MORAL, jetzt + (ziel - jetzt) * 0.3));
            });
        });
    }

    /**
     * Zwischen den Spieltagen pendelt sich alles langsam wieder ein - sonst
     * bliebe eine Mannschaft nach einer Klatsche für immer am Boden.
     */
    static settleDaily(state) {
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!club) return;

        state.players.forEach(player => {
            if (!club.playerIds.includes(player.id)) return;
            const moral = player.morale ?? 75;
            // Zwei Drittel Prozentpunkt Richtung Normalzustand pro Tag
            // Zwischen zwei Spieltagen liegen rund fünf Tage - in denen
            // fängt sich eine Mannschaft spürbar wieder
            // Ganz unten ziehen Stab, Routiniers und Berufsstolz am stärksten
            const richtung = moral < 45 ? 2.4 : moral < 70 ? 1.6 : moral > 84 ? -0.5 : 0;
            if (richtung !== 0) {
                player.morale = Math.max(this.MIN_MORAL, Math.min(this.MAX_MORAL, moral + richtung));
            }
        });

        // Danach wirkt die Kabine: Wortführer ziehen ihre Gruppe mit
        this.kabinenTag(state, club);
    }

    // ------------------------------------------------------------ Hierarchie
    //
    // Eine Kabine ist kein Durchschnitt. Es gibt einen Kapitän, zwei, drei
    // Führungsspieler, die Etablierten, die Neuen - und Grüppchen, meist nach
    // Sprache. Wer oben steht, färbt ab: Ist der Wortführer einer Gruppe
    // unzufrieden, ist es bald die ganze Gruppe. Wird ein Führungsspieler
    // verkauft, murrt die Kabine. Und wer als Einziger seine Sprache spricht,
    // tut sich schwer, wenn er sich nicht leicht anpasst.

    static SPRACHEN = {
        deutsch: { name: "Die Deutschsprachigen", laender: ["Deutschland", "Österreich", "Schweiz"] },
        franzoesisch: { name: "Die Frankophonen", laender: ["Frankreich", "Belgien", "Senegal", "Mali", "Elfenbeinküste", "Kamerun", "Algerien", "Marokko", "Tunesien", "Guinea", "Benin", "DR Kongo", "Burkina Faso"] },
        spanisch: { name: "Die Spanischsprachigen", laender: ["Spanien", "Argentinien", "Uruguay", "Kolumbien", "Chile", "Mexiko", "Paraguay", "Ecuador"] },
        portugiesisch: { name: "Die Portugiesischsprachigen", laender: ["Portugal", "Brasilien"] },
        englisch: { name: "Die Englischsprachigen", laender: ["England", "Schottland", "Wales", "Irland", "USA", "Kanada", "Nigeria", "Ghana", "Gambia"] },
        italienisch: { name: "Die Italiener", laender: ["Italien"] },
        niederlaendisch: { name: "Die Niederländer", laender: ["Niederlande"] },
        balkan: { name: "Die Balkan-Fraktion", laender: ["Kroatien", "Serbien", "Bosnien", "Albanien", "Kosovo", "Slowenien"] },
        skandinavisch: { name: "Die Skandinavier", laender: ["Dänemark", "Norwegen", "Schweden", "Finnland"] },
        osteuropa: { name: "Die Osteuropäer", laender: ["Polen", "Tschechien", "Slowakei", "Ungarn", "Ukraine"] },
        tuerkisch: { name: "Die Türkischsprachigen", laender: ["Türkei"] },
        asiatisch: { name: "Die Asiaten", laender: ["Japan", "Südkorea"] }
    };

    static STUFEN = ["Kapitän", "Führungsspieler", "Etabliert", "Mitläufer", "Neuzugang"];

    static sprache(nationalitaet) {
        const eintrag = Object.entries(this.SPRACHEN).find(([, s]) => s.laender.includes(nationalitaet));
        return eintrag ? eintrag[0] : "international";
    }

    static _stempel(state) {
        return (state?.seasonYear || state?.season || 1) * 1000 + (state?.currentDayIndex || 0);
    }

    /** Wie lange ist ein Spieler schon da? In Saisons; die Startkader gelten als eingesessen */
    static vereinsjahre(state, player) {
        if (typeof player.vereinSeit !== "number") return 2;
        const jetzt = this._stempel(state);
        const saisons = Math.floor(jetzt / 1000) - Math.floor(player.vereinSeit / 1000);
        const tage = (jetzt % 1000) - (player.vereinSeit % 1000);
        return Math.max(0, saisons + tage / 250);
    }

    /** Einfluss in der Kabine (0 bis etwa 100) */
    static einfluss(state, player, kaderRang = 20) {
        const alter = Math.max(0, Math.min(1, ((player.age || 25) - 19) / 13)) * 30;
        const rang = kaderRang < 11 ? 18 : (kaderRang < 16 ? 8 : 0);
        const caps = Math.min(12, (player.laenderspiele || 0) / 4);
        const ha = player.hiddenAttributes || {};
        const charakter = ((ha.professionalism ?? 12) + (ha.importantMatches ?? 12)) * 0.6
            - Math.max(0, 9 - (ha.temperament ?? 12)) * 0.8;
        const jahre = this.vereinsjahre(state, player);
        const dauer = jahre < 0.3 ? -12 : Math.min(12, jahre * 4);
        return Math.round(alter + rang + caps + charakter + dauer);
    }

    /**
     * Die Hierarchie eines Kaders: Stufe, Einfluss und Gruppe je Spieler,
     * dazu die Grüppchen mit Wortführer und Stimmung.
     */
    static hierarchie(state, club = null) {
        club = club || (state?.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return { spieler: [], gruppen: [], kapitaen: null };
        const ids = new Set((club.playerIds || []).map(String));
        const kader = (state.players || []).filter(p => ids.has(String(p.id)));
        const nachStaerke = kader.slice().sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const rang = new Map(nachStaerke.map((p, i) => [p.id, i]));

        const eintraege = kader.map(p => ({
            player: p,
            einfluss: this.einfluss(state, p, rang.get(p.id)),
            jahre: this.vereinsjahre(state, p),
            sprache: this.sprache(p.nationality)
        })).sort((a, b) => b.einfluss - a.einfluss);

        // Kapitän: vom Trainer bestimmt, sonst der Einflussreichste
        const gewaehlt = eintraege.find(e => String(e.player.id) === String(club.kapitaenId));
        const kapitaen = gewaehlt || eintraege.find(e => e.jahre >= 0.3) || eintraege[0] || null;
        let fuehrung = 0;
        eintraege.forEach(e => {
            if (e === kapitaen) e.stufe = "Kapitän";
            else if (e.jahre < 0.3) e.stufe = "Neuzugang";
            else if (fuehrung < 3 && e.einfluss >= 55) { e.stufe = "Führungsspieler"; fuehrung++; }
            else if (e.einfluss >= 40 || e.jahre >= 1.5) e.stufe = "Etabliert";
            else e.stufe = "Mitläufer";
        });

        // Grüppchen nach Sprache - eine Gruppe braucht drei Leute
        const nachSprache = new Map();
        eintraege.forEach(e => {
            if (!nachSprache.has(e.sprache)) nachSprache.set(e.sprache, []);
            nachSprache.get(e.sprache).push(e);
        });
        const gruppen = [];
        nachSprache.forEach((mitglieder, key) => {
            if (mitglieder.length < 3 || key === "international") {
                mitglieder.forEach(e => { e.gruppe = null; e.allein = mitglieder.length === 1; });
                return;
            }
            const wortfuehrer = mitglieder[0];
            const stimmung = mitglieder.reduce((a, e) => a + (e.player.morale ?? 75), 0) / mitglieder.length;
            gruppen.push({
                key,
                name: this.SPRACHEN[key]?.name || "Die Internationalen",
                mitglieder: mitglieder.map(e => e.player),
                wortfuehrer: wortfuehrer.player,
                stimmung: Math.round(stimmung)
            });
            mitglieder.forEach(e => { e.gruppe = key; e.allein = false; });
        });
        gruppen.sort((a, b) => b.mitglieder.length - a.mitglieder.length);

        return { spieler: eintraege, gruppen, kapitaen: kapitaen ? kapitaen.player : null };
    }

    /** Den Kapitän bestimmen - der alte Kapitän nimmt es nicht immer gelassen */
    static setzeKapitaen(state, playerId) {
        const club = (state?.clubs || []).find(c => c.id === state.userClubId);
        if (!club || !(club.playerIds || []).some(id => String(id) === String(playerId))) {
            return { success: false, error: "Der Spieler steht nicht im Kader." };
        }
        const vorher = this.hierarchie(state, club).kapitaen;
        club.kapitaenId = playerId;
        const neu = state.players.find(p => String(p.id) === String(playerId));
        if (neu) neu.morale = Math.min(this.MAX_MORAL, (neu.morale ?? 75) + 5);
        if (vorher && String(vorher.id) !== String(playerId)) {
            const ha = vorher.hiddenAttributes || {};
            // Ein Profi trägt es mit Fassung, ein Hitzkopf nicht
            const kraenkung = 3 + Math.max(0, 14 - (ha.professionalism ?? 12)) * 0.6 + Math.max(0, 10 - (ha.temperament ?? 12)) * 0.6;
            vorher.morale = Math.max(this.MIN_MORAL, (vorher.morale ?? 75) - kraenkung);
        }
        return { success: true, kapitaen: neu, vorher };
    }

    /**
     * Ein Tag in der Kabine: Wortführer färben auf ihre Gruppe ab, der
     * Kapitän auf alle, und wer allein ist, tut sich schwer.
     */
    static kabinenTag(state, club) {
        const h = this.hierarchie(state, club);
        if (!h.spieler.length) return h;
        const grenze = (v) => Math.max(this.MIN_MORAL, Math.min(this.MAX_MORAL, v));
        h.gruppen.forEach(g => {
            const wf = g.wortfuehrer.morale ?? 75;
            const zug = Math.max(-0.6, Math.min(0.4, (wf - 68) * 0.025));
            if (Math.abs(zug) < 0.05) return;
            g.mitglieder.forEach(p => { if (p !== g.wortfuehrer) p.morale = grenze((p.morale ?? 75) + zug); });
        });
        if (h.kapitaen) {
            const k = h.kapitaen.morale ?? 75;
            const zug = k < 50 ? -0.3 : (k >= 82 ? 0.15 : 0);
            if (zug) h.spieler.forEach(e => { if (e.player !== h.kapitaen) e.player.morale = grenze((e.player.morale ?? 75) + zug); });
        }
        h.spieler.forEach(e => {
            if (!e.allein || e.sprache === "deutsch" || e.jahre >= 1) return;
            const anpassung = e.player.hiddenAttributes?.adaptability ?? 12;
            if (anpassung < 12) e.player.morale = grenze((e.player.morale ?? 75) - (12 - anpassung) * 0.06);
        });
        return h;
    }

    /** Ein Spieler verlässt den Verein: Geht ein Führungsspieler, murrt seine Gruppe */
    static spielerGeht(state, player) {
        const club = (state?.clubs || []).find(c => c.id === state.userClubId);
        if (!club || !player) return null;
        const h = this.hierarchie(state, club);
        const eintrag = h.spieler.find(e => e.player === player);
        if (!eintrag || !["Kapitän", "Führungsspieler"].includes(eintrag.stufe)) return null;
        const gruppe = eintrag.gruppe ? h.gruppen.find(g => g.key === eintrag.gruppe) : null;
        const betroffen = gruppe ? gruppe.mitglieder : h.spieler.map(e => e.player);
        const verlust = eintrag.stufe === "Kapitän" ? 5 : 3.5;
        betroffen.forEach(p => {
            if (p !== player) p.morale = Math.max(this.MIN_MORAL, (p.morale ?? 75) - verlust);
        });
        if (String(club.kapitaenId) === String(player.id)) delete club.kapitaenId;
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: "Mannschaftsrat",
            subject: `Unruhe nach dem Abgang von ${player.name}`,
            body: `${player.name} war ${eintrag.stufe === "Kapitän" ? "unser Kapitän" : "einer der Wortführer in der Kabine"}. `
                + `${gruppe ? `${gruppe.name} trifft das besonders` : "Die Mannschaft trifft das"} - die Stimmung leidet für ein paar Tage.`,
            read: false,
            type: "board_message"
        });
        return { stufe: eintrag.stufe, betroffen: betroffen.length - 1 };
    }

    /** Für den Schreibtisch: Was in der Kabine Aufmerksamkeit braucht */
    static schreibtisch(state) {
        const h = this.hierarchie(state);
        const items = [];
        if (h.kapitaen && (h.kapitaen.morale ?? 75) < 50) {
            items.push({ priority: 2, icon: "👥", playerId: h.kapitaen.id, tab: "squad",
                title: `Kapitän ${h.kapitaen.name} ist unzufrieden`, detail: "Das spürt die ganze Kabine - ein Gespräch hilft." });
        }
        h.gruppen.forEach(g => {
            if (g.wortfuehrer !== h.kapitaen && (g.wortfuehrer.morale ?? 75) < 50) {
                items.push({ priority: 3, icon: "👥", playerId: g.wortfuehrer.id, tab: "squad",
                    title: `${g.wortfuehrer.name} zieht seine Gruppe runter`, detail: `Er ist Wortführer bei ${g.name.replace(/^Die /, "den ")}.` });
            }
        });
        h.spieler.filter(e => e.allein && e.sprache !== "deutsch" && e.jahre < 1 && (e.player.hiddenAttributes?.adaptability ?? 12) < 10)
            .slice(0, 1).forEach(e => items.push({ priority: 5, icon: "👥", playerId: e.player.id, tab: "squad",
                title: `${e.player.name} findet keinen Anschluss`, detail: "Niemand im Kader spricht seine Sprache." }));
        return items;
    }
}

if (typeof window !== "undefined") {
    window.DressingRoomEngine = DressingRoomEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { DressingRoomEngine };
}
