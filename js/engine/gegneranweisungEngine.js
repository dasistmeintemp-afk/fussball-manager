/**
 * GegneranweisungEngine - Anweisungen für einzelne Gegenspieler
 *
 * Der Matchplan stellt die ganze Mannschaft auf einen Gegner ein. Davor
 * geht ein Trainer dessen Elf Mann für Mann durch:
 *
 *   Anlaufen    - "immer": sofort Druck, wenn er den Ball hat. Wer unsicher
 *                 am Ball ist, verliert ihn; einem Ballsicheren ist das
 *                 egal, und das ständige Anlaufen kostet Kraft.
 *                 "nie": ihn kommen lassen. Ein Dribbler läuft sich dann
 *                 fest - ein Passgeber hat alle Zeit der Welt.
 *   Zweikampf   - "hart": Wer körperlich nicht mithält, verliert die Lust.
 *                 Dafür gibt es mehr Fouls an ihm und mehr Karten.
 *                 "vorsichtig": nicht einsteigen. Weniger Fouls und Karten,
 *                 er hat aber etwas mehr Platz.
 *   Fuß         - auf den schwachen Fuß drängen (nur bei Spielern, die
 *                 einen haben): Er muss öfter mit dem schwächeren abschließen.
 *
 * Jede Anweisung wirkt als Faktor auf die Tagesform des Gegenspielers - wie
 * die enge Deckung des Matchplans - und, wo es passt, auf Fouls, Karten und
 * den schwachen Fuß. Der Spielanalyst empfiehlt, was zum Spieler passt;
 * unter zweieinhalb Sternen bleibt er still, und je schwächer er ist, desto
 * eher irrt er sich.
 */

const _gaResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const GegneranweisungEngine = {
    ARTEN: {
        anlaufen: { label: "Anlaufen", werte: { immer: "Immer", nie: "Kommen lassen" } },
        zweikampf: { label: "Zweikampf", werte: { hart: "Hart angehen", vorsichtig: "Nicht einsteigen" } },
        fuss: { label: "Fuß", werte: { schwach: "Auf den schwachen Fuß" } }
    },

    KURZ: { immer: "immer anlaufen", nie: "kommen lassen", hart: "hart angehen", vorsichtig: "nicht einsteigen", schwach: "auf den schwachen Fuß" },

    /** Um so viel weicht eine Stärke vom Gesamtwert ab, bis sie zählt */
    SCHWELLE: 3,
    /** So viele Gegenspieler schlägt der Analyst höchstens vor */
    MAX_EMPFEHLUNGEN: 4,
    /** Grenzen des Gesamtfaktors je Gegenspieler */
    MIN_FAKTOR: 0.88,
    MAX_FAKTOR: 1.03,
    /** So viel Kraft kostet jeder Spieler, der immer angelaufen wird */
    KRAFT_JE_ANLAUFEN: 0.003,
    /** Fouls und Karten bei hartem oder vorsichtigem Zweikampf */
    FOUL: { hart: 0.006, vorsichtig: -0.004 },
    KARTE: { hart: 1.3, vorsichtig: 0.75 },
    /** Zusätzliche Chance, mit dem schwachen Fuß abschließen zu müssen */
    SCHWACHER_FUSS: 0.15,

    _eigener(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },

    _gegner(state, match) {
        if (!state || !match) return null;
        const eigen = state.userClubId;
        const id = match.homeClubId === eigen ? match.awayClubId : match.homeClubId;
        return (state.clubs || []).find(c => c.id === id) || null;
    },

    /** Der Schlüssel, unter dem die Anweisungen an ihrem Spiel hängen (wie beim Matchplan) */
    _schluessel(state, match) {
        return `${state?.seasonYear || 1}|${match?.id || ""}|${match?.homeClubId}|${match?.awayClubId}`;
    },

    /** Die voraussichtliche Elf des Gegners ohne Torwart */
    elf(state, gegner) {
        if (!state || !gegner) return [];
        const index = new Map((state.players || []).map(p => [String(p.id), p]));
        const aufstellung = (gegner.lineup || []).map(id => index.get(String(id))).filter(Boolean);
        const basis = aufstellung.length >= 7 ? aufstellung
            : (gegner.playerIds || []).map(id => index.get(String(id))).filter(Boolean)
                .sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 11);
        return basis.filter(p => p.pos !== "TW" && !(p.injuredWeeks > 0));
    },

    /** Was ihn ausmacht - gemessen an seinem eigenen Gesamtwert */
    profil(p) {
        const o = p?.overall || 60;
        const w = (k) => (typeof p?.[k] === "number" ? p[k] : o);
        return {
            unsicher: (w("technique") + w("passing")) / 2 <= o - this.SCHWELLE,
            dribbler: w("dribbling") >= o + this.SCHWELLE,
            schwachKoerper: w("physical") <= o - this.SCHWELLE,
            einfuessig: !!p?.foot && p.foot !== "beidfüßig"
        };
    },

    /** Welche Werte für ihn überhaupt angeboten werden */
    moeglich(p) {
        return {
            anlaufen: ["immer", "nie"],
            zweikampf: ["hart", "vorsichtig"],
            fuss: this.profil(p).einfuessig ? ["schwach"] : []
        };
    },

    /** Nur gültige Anweisungen - und nur, was vom Normalen abweicht */
    normalisiere(p, anweisung = {}) {
        const m = this.moeglich(p);
        const a = {};
        Object.keys(this.ARTEN).forEach(art => {
            if (m[art].includes(anweisung?.[art])) a[art] = anweisung[art];
        });
        return a;
    },

    /**
     * Was die Anweisungen an diesem Spieler ändern: Faktor auf seine
     * Tagesform und ein Satz dazu, je Anweisung.
     */
    wirkung(p, anweisung = {}) {
        const pr = this.profil(p);
        const a = this.normalisiere(p, anweisung);
        let faktor = 1;
        const texte = [];
        if (a.anlaufen === "immer") {
            faktor *= pr.unsicher ? 0.95 : 0.99;
            texte.push(pr.unsicher ? "Unter Druck verliert er Bälle." : "Er ist ballsicher - der Druck bringt wenig und kostet Kraft.");
        } else if (a.anlaufen === "nie") {
            faktor *= pr.dribbler ? 0.97 : 1.02;
            texte.push(pr.dribbler ? "Ohne Gegner zum Ausspielen läuft er sich fest." : "Er hat Zeit für seine Pässe.");
        }
        if (a.zweikampf === "hart") {
            faktor *= pr.schwachKoerper ? 0.95 : 0.99;
            texte.push(pr.schwachKoerper ? "Körperlich hält er nicht dagegen." : "Er steckt es weg - es gibt nur mehr Fouls.");
        } else if (a.zweikampf === "vorsichtig") {
            faktor *= pr.dribbler ? 0.99 : 1.01;
            texte.push(pr.dribbler ? "Kein Foul, kein Freistoß, kein Elfmeter." : "Er bekommt mehr Platz.");
        }
        if (a.fuss === "schwach") {
            faktor *= 0.97;
            texte.push(`Er muss öfter mit dem ${p.foot === "links" ? "rechten" : "linken"} Fuß ran.`);
        }
        faktor = Math.max(this.MIN_FAKTOR, Math.min(this.MAX_FAKTOR, faktor));
        return { faktor: Math.round(faktor * 1000) / 1000, texte };
    },

    /** Kleine, feste Abweichung des Analysten - je schwächer, desto größer */
    _irrtum(analyst, p, teil) {
        const text = `${analyst?.name || ""}|${p.id}|${teil}`;
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
        const zahl = (((h >>> 0) % 2001) - 1000) / 1000;
        return zahl * Math.max(0, 100 - (analyst?.guete ?? 50)) * 0.08;
    },

    /**
     * Was der Analyst je Spieler empfiehlt. Unter zweieinhalb Sternen
     * nichts; sonst sieht er die Werte mit seinem Irrtum.
     */
    empfehlungen(state, match) {
        const gegner = this._gegner(state, match);
        const analyse = _gaResolve("OpponentAnalysisEngine", "./opponentAnalysisEngine.js");
        const analyst = analyse && typeof analyse.analyst === "function" ? analyse.analyst(state, this._eigener(state)) : null;
        if (!gegner || !analyst || (analyst.sterne || 0) < 2.5) return {};
        // Je Spieler, was am deutlichsten heraussticht - nur die klarsten
        // Fälle werden Vorschläge, damit die Elf nicht jeden anläuft
        const kandidaten = [];
        this.elf(state, gegner).forEach(p => {
            const o = p.overall || 60;
            const w = (k) => (typeof p[k] === "number" ? p[k] + this._irrtum(analyst, p, k) : o);
            const dribbel = w("dribbling") - (o + this.SCHWELLE);
            const unsicher = (o - this.SCHWELLE) - (w("technique") + w("passing")) / 2;
            const koerper = (o - this.SCHWELLE) - w("physical");
            const a = {};
            const gruende = [];
            let gewicht = 0;
            if (dribbel >= 0) { a.anlaufen = "nie"; a.zweikampf = "vorsichtig"; gruende.push("Dribbler - stehen bleiben, nicht einsteigen"); gewicht = Math.max(gewicht, dribbel + 1); }
            else if (unsicher >= 0) { a.anlaufen = "immer"; gruende.push("unsicher am Ball - sofort Druck"); gewicht = Math.max(gewicht, unsicher + 1); }
            if (!a.zweikampf && koerper >= 0) { a.zweikampf = "hart"; gruende.push("körperlich schwach - hart angehen"); gewicht = Math.max(gewicht, koerper + 1); }
            if (this.profil(p).einfuessig && ["ST", "LA", "RA", "OM", "LM", "RM"].includes(p.pos)) {
                a.fuss = "schwach"; gruende.push(`${p.foot === "links" ? "Linksfuß" : "Rechtsfuß"} - auf den anderen drängen`);
                gewicht += 1;
            }
            if (Object.keys(a).length) kandidaten.push({ id: String(p.id), gewicht, anweisung: a, grund: gruende.join("; ") });
        });
        const empf = {};
        kandidaten.sort((x, y) => y.gewicht - x.gewicht).slice(0, this.MAX_EMPFEHLUNGEN)
            .forEach(k => { empf[k.id] = { anweisung: k.anweisung, grund: k.grund }; });
        return empf;
    },

    /** Alles für die Taktikbesprechung: die Elf mit Möglichem, Gesetztem und Empfehlung */
    tafel(state, match) {
        const gegner = this._gegner(state, match);
        if (!gegner) return [];
        const gesetzt = this.fuerSpiel(state, match);
        const empf = this.empfehlungen(state, match);
        const reihe = ["LA", "ST", "RA", "OM", "LM", "ZM", "RM", "DM", "LV", "IV", "RV"];
        return this.elf(state, gegner)
            .sort((a, b) => (reihe.indexOf(a.pos) + 1 || 99) - (reihe.indexOf(b.pos) + 1 || 99))
            .map(p => ({
                id: p.id, name: p.name, pos: p.pos, foot: p.foot || null,
                moeglich: this.moeglich(p),
                gesetzt: gesetzt[String(p.id)] || {},
                empfehlung: empf[String(p.id)] || null
            }));
    },

    /** Die gespeicherten Anweisungen für dieses Spiel: { id: anweisung } */
    fuerSpiel(state, match) {
        const g = state?.gegneranweisungen;
        if (!g || !match || g.schluessel !== this._schluessel(state, match) || g.clubId !== state.userClubId) return {};
        return g.je || {};
    },

    /** Anweisungen für das Spiel festlegen (ersetzt die alten) */
    festlegen(state, match, je = {}) {
        const gegner = this._gegner(state, match);
        if (!gegner) return null;
        const index = new Map(this.elf(state, gegner).map(p => [String(p.id), p]));
        const sauber = {};
        Object.entries(je || {}).forEach(([id, a]) => {
            const p = index.get(String(id));
            if (!p) return;
            const n = this.normalisiere(p, a);
            if (Object.keys(n).length) sauber[String(id)] = n;
        });
        if (!Object.keys(sauber).length) { delete state.gegneranweisungen; return {}; }
        state.gegneranweisungen = { schluessel: this._schluessel(state, match), clubId: state.userClubId, je: sauber };
        return sauber;
    },

    /**
     * Was die Anweisungen an der Partie ändern - für MatchplanEngine:
     *   faktoren    - { id: Faktor } auf die Tagesform der Gegenspieler
     *   kraft       - Faktor auf die eigene Elf (Anlaufen kostet Kraft)
     *   anweisungen - { id: anweisung } für Fouls, Karten und den Fuß
     */
    spielOptionen(state, match) {
        const je = this.fuerSpiel(state, match);
        const ids = Object.keys(je);
        if (!ids.length) return null;
        const index = new Map((state.players || []).map(p => [String(p.id), p]));
        const faktoren = {};
        let anlaufen = 0;
        ids.forEach(id => {
            const p = index.get(id);
            if (!p) return;
            const w = this.wirkung(p, je[id]);
            if (w.faktor !== 1) faktoren[p.id] = w.faktor;
            if (je[id].anlaufen === "immer") anlaufen++;
        });
        return {
            clubId: state.gegneranweisungen.clubId,
            faktoren,
            kraft: Math.round((1 - anlaufen * this.KRAFT_JE_ANLAUFEN) * 10000) / 10000,
            anweisungen: Object.assign({}, je)
        };
    },

    /** Nach dem Spiel sind die Anweisungen erledigt */
    abschliessen(state, match) {
        if (state?.gegneranweisungen && (!match || state.gegneranweisungen.schluessel === this._schluessel(state, match))) delete state.gegneranweisungen;
    },

    /** Kurzfassung für Ansprache und Vorschau: "Musiala: immer anlaufen, hart angehen" */
    kurz(state, match) {
        const je = this.fuerSpiel(state, match);
        const index = new Map((state.players || []).map(p => [String(p.id), p]));
        return Object.entries(je).map(([id, a]) => {
            const p = index.get(id);
            const teile = Object.keys(a).map(art => this.KURZ[a[art]]).filter(Boolean);
            return p && teile.length ? `${p.name}: ${teile.join(", ")}` : null;
        }).filter(Boolean);
    }
};

if (typeof window !== "undefined") {
    window.GegneranweisungEngine = GegneranweisungEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { GegneranweisungEngine };
}
