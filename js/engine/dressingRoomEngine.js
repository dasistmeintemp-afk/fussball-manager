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

        const kader = state.players.filter(p => club.playerIds.includes(p.id));
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
    }
}

if (typeof window !== "undefined") {
    window.DressingRoomEngine = DressingRoomEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { DressingRoomEngine };
}
