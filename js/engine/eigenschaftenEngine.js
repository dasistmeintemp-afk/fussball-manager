/**
 * EigenschaftenEngine - Was einen Spieler auf dem Platz ausmacht
 *
 * Bisher waren Eigenheiten ein Satz in der Spielerakte ("Sucht den Abschluss
 * aus der Distanz"). Auf dem Platz änderten sie nichts. Im Football Manager
 * sind es Verhaltensweisen: Wer gern aus der Distanz schießt, tut es auch, und
 * wer in jeden Zweikampf geht, gewinnt mehr davon - und foult öfter.
 *
 * Diese Engine übersetzt beides in Zahlen, mit denen das Livespiel rechnet:
 *
 *   Eigenheiten    - zwei, drei Verhaltensweisen, die viele Spieler haben.
 *                    Sie verschieben Entscheidungen und Ausführung leicht.
 *   Signaturen     - eine einzigartige Eigenschaft für die Besten einer Liga.
 *                    "Eiskalter Vollstrecker", "Spielgestalter", "Katze im
 *                    Tor": Sie wirken deutlich und sind der Grund, warum ein
 *                    Topspieler ein Spiel allein entscheiden kann.
 *
 * Die Wirkungen sind Zuschläge auf Wahrscheinlichkeiten (0.05 = fünf Punkte)
 * oder auf Werte (luft: Punkte im Kopfballduell). Was nicht gesetzt ist,
 * zählt null.
 */

const EigenschaftenEngine = {
    /**
     * Wirkung der Eigenheiten. Die Schlüssel stammen aus
     * PlayerGenerator.EIGENHEITEN - dort steht der Satz für die Akte.
     */
    EIGENHEITEN: {
        distanzschuss: { distanz: 1, abschlussDistanz: 0.05 },
        dribbler:      { dribbelWille: 0.35, dribbelKoennen: 0.05, ziehtFouls: 0.03 },
        flanken:       { flankeWille: 0.45, flankeKoennen: 0.06 },
        tiefenpass:    { tiefenpass: 0.4, passKoennen: 0.02 },
        zweikampf:     { zweikampf: 0.06, haerte: 0.4 },
        kopfball:      { luft: 8 },
        antritt:       { antritt: 0.08 },
        ausdauer:      { ausdauer: 0.4 },
        ruhe:          { abschluss: 0.04, ruhe: 0.5 },
        aufbau:        { passKoennen: 0.03, druckfest: 0.4 },
        strafraum:     { strafraum: 0.6, abschluss: 0.02 },
        mitspielen:    { twMitspielen: 1 },
        reaktion:      { twReflex: 0.05 },
        nachinnen:     { nachInnen: 1, abschlussDistanz: 0.02 },
        freistoss:     { freistoss: 0.05 },
        elfmeter:      { elfmeter: 0.08 },
        elfmeterkiller:{ twElfmeter: 0.12 },
        knipser:       { abschluss: 0.06 },
        verlagerung:   { verlagerung: 0.45, passKoennen: 0.01 }
    },

    /**
     * Signaturen - je Liga nur die Besten tragen eine.
     *
     * passt(p) misst, wie sehr die Eigenschaft zum Spieler passt: um wie viel
     * die entscheidenden Werte über seiner Gesamtstärke liegen. -Infinity
     * heißt: kommt für ihn nicht infrage (ein Torwart ist kein Dribbelkünstler).
     */
    SIGNATUREN: {
        eiskalt: {
            name: "Eiskalter Vollstrecker", icon: "🎯",
            text: "Vor dem Tor ohne Nerven: verwandelt deutlich mehr Chancen als andere, auch unter Druck.",
            wirkung: { abschluss: 0.12, ruhe: 1, strafraum: 0.4 },
            passt: (p, v) => ["ST", "LA", "RA", "OM"].includes(p.pos) ? v("shooting") - v("overall") + (p.pos === "ST" ? 5 : 3) : -Infinity
        },
        zauberfuss: {
            name: "Standardkünstler", icon: "🪄",
            text: "Freistöße, Ecken, Elfmeter: Ruhende Bälle werden bei ihm zur Torchance.",
            wirkung: { freistoss: 0.12, elfmeter: 0.1, flankeKoennen: 0.08, eckenQualitaet: 1 },
            passt: (p, v) => p.pos !== "TW" ? v("technique") * 0.5 + v("shooting") * 0.3 + v("passing") * 0.2 - v("overall") + 5 : -Infinity
        },
        maestro: {
            name: "Spielgestalter", icon: "🎼",
            text: "Sieht jeden Laufweg und spielt den tödlichen Pass. Seine Zuspiele kommen an.",
            wirkung: { passKoennen: 0.07, tiefenpass: 0.6, druckfest: 1, verlagerung: 0.3 },
            passt: (p, v) => ["ZM", "OM", "DM", "LM", "RM"].includes(p.pos) ? (v("vision") + v("passing")) / 2 - v("overall") + 3 : -Infinity
        },
        dribbelkuenstler: {
            name: "Dribbelkünstler", icon: "🌀",
            text: "Lässt Gegenspieler reihenweise stehen und holt dabei Fouls heraus.",
            wirkung: { dribbelWille: 0.6, dribbelKoennen: 0.13, ziehtFouls: 0.07, nachInnen: 1 },
            passt: (p, v) => p.pos !== "TW" && p.pos !== "IV" ? v("dribbling") - v("overall") + 1 : -Infinity
        },
        luftherrscher: {
            name: "Kopfballungeheuer", icon: "🦅",
            text: "Gewinnt fast jedes Kopfballduell - bei Flanken und Ecken vorn wie hinten.",
            wirkung: { luft: 16, strafraum: 0.3 },
            passt: (p, v) => ["IV", "ST"].includes(p.pos) ? v("physical") - v("overall") + 3 : -Infinity
        },
        abwehrchef: {
            name: "Abwehrchef", icon: "🛡️",
            text: "Liest das Spiel, gewinnt Zweikämpfe sauber und fängt Pässe ab.",
            wirkung: { zweikampf: 0.12, abfangen: 0.35, haerte: -0.3 },
            passt: (p, v) => ["IV", "DM", "LV", "RV"].includes(p.pos) ? (v("defense") + v("positioning")) / 2 - v("overall") + 3 : -Infinity
        },
        katze: {
            name: "Katze im Tor", icon: "🐈",
            text: "Reflexe aus einer anderen Welt: hält Bälle, die eigentlich drin sind.",
            wirkung: { twReflex: 0.1, twStrafraum: 0.3 },
            passt: (p, v) => p.pos === "TW" ? v("reflexes") - v("overall") + 2 : -Infinity
        },
        elfmetertoeter: {
            name: "Elfmeterkiller", icon: "🧱",
            text: "Liest den Schützen: pariert Elfmeter und gewinnt fast jedes Eins-gegen-eins.",
            wirkung: { twElfmeter: 0.25, twReflex: 0.04 },
            passt: (p, v) => p.pos === "TW" ? v("oneOnOne") - v("overall") + 2 : -Infinity
        },
        pfeilschnell: {
            name: "Pfeilschnell", icon: "⚡",
            text: "Enteilt jeder Abwehr: Pässe in die Tiefe auf ihn sind kaum zu verteidigen.",
            wirkung: { antritt: 0.18, tiefenlaeufer: 0.5, dribbelKoennen: 0.04 },
            passt: (p, v) => ["ST", "LA", "RA", "LM", "RM", "LV", "RV"].includes(p.pos) ? v("pace") - v("overall") + 1 : -Infinity
        },
        motor: {
            name: "Unermüdlicher Motor", icon: "🔋",
            text: "Läuft neunzig Minuten Box-to-Box und presst noch in der Nachspielzeit.",
            wirkung: { ausdauer: 0.8, zweikampf: 0.04, pressing: 0.3 },
            passt: (p, v) => ["ZM", "DM", "LM", "RM", "OM"].includes(p.pos) ? v("stamina") - v("overall") + 1 : -Infinity
        },
        mentalitaet: {
            name: "Mentalitätsmonster", icon: "🔥",
            text: "Wächst in großen Momenten über sich hinaus - im Derby, bei Rückstand, in der Schlussphase.",
            wirkung: { grossesSpiel: 7 },
            passt: (p) => {
                const h = p.hiddenAttributes || {};
                return p.pos !== "TW" && (h.importantMatches || 0) >= 15 ? ((h.importantMatches || 0) - 13) * 1.5 : -Infinity;
            }
        }
    },

    /** Anteil der Spieler einer Liga, die eine Signatur tragen */
    SIGNATUR_ANTEIL: 0.04,

    /** Höchstens so viele Signaturen in einem Verein - ein Star ist eine Ausnahme */
    SIGNATUR_JE_VEREIN: 5,

    /** Die Signatur eines Spielers mit Name und Text - oder null */
    signaturVon(player) {
        const key = player && player.signatur;
        if (!key) return null;
        const s = this.SIGNATUREN[key];
        return s ? { key, name: s.name, icon: s.icon, text: s.text } : null;
    },

    /**
     * Alle Wirkungen eines Spielers zusammengerechnet: Eigenheiten und
     * Signatur. Das Livespiel legt das Ergebnis an den Spieler auf dem Feld.
     */
    wirkung(player) {
        const summe = {};
        const addiere = (w) => {
            if (!w) return;
            Object.keys(w).forEach(k => { summe[k] = (summe[k] || 0) + w[k]; });
        };
        (Array.isArray(player?.traits) ? player.traits : []).forEach(t => addiere(this.EIGENHEITEN[t?.key]));
        const sig = player?.signatur ? this.SIGNATUREN[player.signatur] : null;
        if (sig) addiere(sig.wirkung);
        return summe;
    },

    /** Hat der Spieler diese Eigenheit? */
    hatEigenheit(player, key) {
        return Array.isArray(player?.traits) && player.traits.some(t => t && t.key === key);
    },

    /**
     * Welche Signatur zu einem Spieler passt - die mit dem höchsten Wert.
     */
    passendeSignatur(player) {
        const v = (k) => (typeof player?.[k] === "number" ? player[k] : (player?.overall || 60));
        let beste = null;
        let besterWert = -Infinity;
        Object.keys(this.SIGNATUREN).forEach(key => {
            let wert;
            try { wert = this.SIGNATUREN[key].passt(player, v); } catch (e) { wert = -Infinity; }
            // Ein wenig Streuung: Bei zwei gleich passenden Profilen soll
            // nicht immer dieselbe Eigenschaft gewinnen
            if (wert > -Infinity) wert += Math.random() * 2;
            if (wert > besterWert) { besterWert = wert; beste = key; }
        });
        return besterWert > -Infinity ? beste : null;
    },

    /**
     * Signaturen verteilen: In jeder Liga bekommen die stärksten Spieler
     * (rund vier Prozent) eine, die zu ihrem Profil passt. Wer schon eine hat,
     * behält sie. Liefert die Zahl der neu vergebenen.
     *
     * Gemessen wird innerhalb der Liga: Auch die Landesliga hat ihre Stars,
     * und ein Spieler, der dort alles überragt, soll das auf dem Platz zeigen.
     */
    vergebeSignaturen(state) {
        if (!state || !Array.isArray(state.players) || !Array.isArray(state.clubs)) return 0;
        const ligaVon = new Map(state.clubs.map(c => [c.id, c.leagueId || "?"]));
        const nachLiga = new Map();
        state.players.forEach(p => {
            if (!p || !p.clubId || !ligaVon.has(p.clubId)) return;
            const liga = ligaVon.get(p.clubId);
            if (!nachLiga.has(liga)) nachLiga.set(liga, []);
            nachLiga.get(liga).push(p);
        });

        const staerke = (p) => typeof p.trueCurrentAbility === "number" ? p.trueCurrentAbility : (p.overall || 50) * 2;
        const jeVerein = new Map();
        state.players.forEach(p => { if (p && p.signatur && p.clubId) jeVerein.set(p.clubId, (jeVerein.get(p.clubId) || 0) + 1); });
        let neu = 0;
        nachLiga.forEach(spieler => {
            const anzahl = Math.max(1, Math.round(spieler.length * this.SIGNATUR_ANTEIL));
            let offen = anzahl - spieler.filter(p => p.signatur).length;
            if (offen <= 0) return;
            const kandidaten = spieler.filter(p => !p.signatur).sort((a, b) => staerke(b) - staerke(a));
            for (const p of kandidaten) {
                if (offen <= 0) break;
                if ((jeVerein.get(p.clubId) || 0) >= this.SIGNATUR_JE_VEREIN) continue;
                const key = this.passendeSignatur(p);
                if (!key) continue;
                p.signatur = key;
                jeVerein.set(p.clubId, (jeVerein.get(p.clubId) || 0) + 1);
                neu++;
                offen--;
            }
        });
        state.signaturenVersion = 1;
        return neu;
    },

    /** Einmal je Spielstand: ältere Stände bekommen ihre Signaturen nachgereicht */
    sicherstellen(state) {
        if (!state || state.signaturenVersion >= 1) return 0;
        return this.vergebeSignaturen(state);
    }
};

if (typeof window !== "undefined") {
    window.EigenschaftenEngine = EigenschaftenEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { EigenschaftenEngine };
}
