/**
 * Momentum wie im Vorbild: wer gerade drückt, Minute für Minute.
 *
 * Aus dem Spielverlauf wird je Minute gezählt, was nach vorn geht - Tore,
 * Schüsse, Paraden des Gegners, Ecken, Flanken, Steilpässe, Dribblings,
 * Fouls, die der Gegner ziehen muss. Heim zählt nach oben, Gast nach unten.
 * Geglättet über ein paar Minuten wird daraus eine Kurve: Liegt die Fläche
 * oben in den Farben der Heimmannschaft, drückt sie gerade; unten der Gast.
 *
 * Gezeigt wird sie dreimal:
 *   - klein in der Zeitleiste über dem Spiel (die Marken für Tore, Karten
 *     und Wechsel liegen darüber),
 *   - groß im Reiter Statistik des Livespiels,
 *   - im Spielbericht unter "Spielverlauf".
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /**
     * Gewicht je Ereignis und für wen es zählt: true = für den Gegner der
     * Mannschaft im Ereignis (die Parade hält der Torwart, gedrückt hat der
     * Gegner; das Foul begeht der Verteidiger).
     */
    MOMENTUM_GEWICHT: {
        goal: [5, false], shot: [2, false], shot_miss: [2, false], save: [2.5, true],
        corner: [1.2, false], cross: [1, false], through_ball: [1, false], dribble: [0.8, false],
        foul: [0.5, true], tackle: [0.3, true], clearance: [0.4, true]
    },
    /** Glättung über die Minuten (Gauß, Sigma in Minuten) und die kleinste Skala */
    MOMENTUM_SIGMA: 2.2,
    MOMENTUM_SKALA_MIN: 1.6,

    /**
     * Die Kurve: je Minute von 0 bis "bis" ein Wert zwischen -1 (Gast drückt)
     * und +1 (Heim drückt). Geglättet wird nur über gespielte Minuten, damit
     * die Kurve am rechten Rand nicht künstlich abfällt.
     */
    momentumReihe(verlauf, bis = 90) {
        const ende = Math.max(0, Math.floor(Number(bis) || 0));
        const roh = new Array(ende + 1).fill(0);
        (verlauf || []).forEach(e => {
            const g = this.MOMENTUM_GEWICHT[e && e.type];
            if (!g || (e.team !== "home" && e.team !== "away")) return;
            const m = Math.min(ende, Math.max(0, Math.floor(Number(e.minute) || 0)));
            const seite = g[1] ? (e.team === "home" ? "away" : "home") : e.team;
            roh[m] += seite === "home" ? g[0] : -g[0];
        });
        const sigma = this.MOMENTUM_SIGMA, fenster = Math.ceil(sigma * 3);
        const kern = [];
        for (let d = -fenster; d <= fenster; d++) kern.push(Math.exp(-(d * d) / (2 * sigma * sigma)));
        const glatt = roh.map((_, m) => {
            let summe = 0, gewicht = 0;
            for (let d = -fenster; d <= fenster; d++) {
                const i = m + d;
                if (i < 0 || i > ende) continue;
                const k = kern[d + fenster];
                summe += roh[i] * k;
                gewicht += k;
            }
            // Mal 2,5: ein Schuss allein soll sichtbar sein, ohne den Rand zu sprengen
            return gewicht ? summe / gewicht * 2.5 : 0;
        });
        const skala = Math.max(this.MOMENTUM_SKALA_MIN, ...glatt.map(Math.abs));
        return glatt.map(v => Math.max(-1, Math.min(1, v / skala)));
    },

    /** Wer in einem Abschnitt vorn war: "home", "away" oder null (ausgeglichen) */
    momentumPhase(reihe, von, bis) {
        const teil = reihe.slice(Math.max(0, von), Math.max(0, bis) + 1);
        if (!teil.length) return null;
        const schnitt = teil.reduce((s, v) => s + v, 0) / teil.length;
        return schnitt > 0.12 ? "home" : schnitt < -0.12 ? "away" : null;
    },

    /**
     * Die Kurve als SVG. optionen:
     *   ende      Länge der Achse in Minuten (90, bei Nachspielzeit mehr)
     *   live      läuft das Spiel noch? Dann steht eine Linie bei "jetzt"
     *   farben    { home, away } - CSS-Farben oder var(--…)
     *   namen     { home, away } für die Hinweise beim Zeigen
     *   marken    [{ minute, team, art: "tor" | "rot", titel }]
     *   kompakt   für die Zeitleiste: ohne Marken und Hinweise, gestreckt
     *   id        eindeutiger Name für Verläufe und Masken
     */
    momentumSvg(reihe, { ende = 90, live = false, farben = {}, namen = {}, marken = [], kompakt = false, id = "mom" } = {}) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const L = Math.max(90, Math.ceil(ende));
        const B = L * 10, H = kompakt ? 100 : 160, mitte = H / 2, amp = mitte - (kompakt ? 4 : 22);
        const bis = Math.max(0, (reihe || []).length - 1);
        const fH = farben.home || "var(--lm-home, #38bdf8)", fA = farben.away || "var(--lm-away, #f59e0b)";
        const punkte = (reihe || []).map((v, m) => `${m * 10},${(mitte - v * amp).toFixed(1)}`);
        const flaeche = punkte.length > 1 ? `M0,${mitte} L${punkte.join(" L")} L${bis * 10},${mitte} Z` : "";
        const hz = 450;
        // Hilfslinien je Viertelstunde, die Halbzeit kräftiger
        const raster = kompakt ? "" : [15, 30, 60, 75].filter(m => m < L).map(m => `<line class="mom-raster" x1="${m * 10}" x2="${m * 10}" y1="0" y2="${H}"/>`).join("");
        const markenSvg = kompakt ? "" : marken.filter(mk => mk.team === "home" || mk.team === "away").map(mk => {
            const x = Math.min(B, Math.max(0, (Number(mk.minute) || 0) * 10));
            const y = mk.team === "home" ? 11 : H - 11;
            const farbe = mk.team === "home" ? fH : fA;
            return mk.art === "rot"
                ? `<rect class="mom-rot" x="${x - 5}" y="${y - 8}" width="10" height="16" rx="2"><title>${esc(mk.titel)}</title></rect>`
                : `<g class="mom-tor"><circle cx="${x}" cy="${y}" r="10" style="fill:${farbe}"/><circle cx="${x}" cy="${y}" r="3.6" class="mom-tor-ball"/><title>${esc(mk.titel)}</title></g>`;
        }).join("");
        // Hinweise beim Zeigen: je fünf Minuten, wer vorn war
        const hinweise = kompakt ? "" : Array.from({ length: Math.ceil(Math.min(bis, L) / 5) }, (_, i) => {
            const wer = this.momentumPhase(reihe, i * 5, i * 5 + 4);
            const text = `${i * 5 + 1}.–${Math.min(L, i * 5 + 5)}. Minute: ${wer ? `${namen[wer] || (wer === "home" ? "Heim" : "Gast")} drückt` : "ausgeglichen"}`;
            return `<rect class="mom-zeig" x="${i * 50}" y="0" width="50" height="${H}"><title>${esc(text)}</title></rect>`;
        }).join("");
        return `<svg class="mom-svg${kompakt ? " kompakt" : ""}" viewBox="0 0 ${B} ${H}" preserveAspectRatio="${kompakt ? "none" : "xMidYMid meet"}" role="img"
                aria-label="Momentum: ${esc(namen.home || "Heim")} oben, ${esc(namen.away || "Gast")} unten">
            <defs>
                <clipPath id="${id}-o"><rect x="0" y="0" width="${B}" height="${mitte}"/></clipPath>
                <clipPath id="${id}-u"><rect x="0" y="${mitte}" width="${B}" height="${mitte}"/></clipPath>
                <linearGradient id="${id}-gh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${fH};stop-opacity:0.95"/><stop offset="1" style="stop-color:${fH};stop-opacity:0.45"/></linearGradient>
                <linearGradient id="${id}-ga" x1="0" y1="1" x2="0" y2="0"><stop offset="0" style="stop-color:${fA};stop-opacity:0.95"/><stop offset="1" style="stop-color:${fA};stop-opacity:0.45"/></linearGradient>
            </defs>
            ${raster}
            <line class="mom-hz" x1="${hz}" x2="${hz}" y1="0" y2="${H}"/>
            ${flaeche ? `<path d="${flaeche}" fill="url(#${id}-gh)" clip-path="url(#${id}-o)"/><path d="${flaeche}" fill="url(#${id}-ga)" clip-path="url(#${id}-u)"/>` : ""}
            <line class="mom-mitte" x1="0" x2="${B}" y1="${mitte}" y2="${mitte}"/>
            ${live && bis < L ? `<line class="mom-jetzt" x1="${bis * 10}" x2="${bis * 10}" y1="0" y2="${H}"/>` : ""}
            ${markenSvg}
            ${hinweise}
        </svg>`;
    },

    /** Die Legende: welche Farbe wer ist */
    momentumLegende(namen = {}, farben = {}) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const punkt = (f) => `<i style="background:${esc(f)}"></i>`;
        return `<div class="mom-legende">
            <span>${punkt(farben.home || "var(--lm-home)")}${esc(namen.home || "Heim")}<small>oben</small></span>
            <span>${punkt(farben.away || "var(--lm-away)")}${esc(namen.away || "Gast")}<small>unten</small></span>
        </div>`;
    },

    /** Tore und Platzverweise aus dem Verlauf als Marken für den großen Graphen */
    momentumMarken(verlauf) {
        const nachname = (n) => String(n || "?").trim().split(/\s+/).slice(-1)[0];
        return (verlauf || []).filter(e => e && (e.type === "goal" || e.type === "red_card" || (e.type === "yellow_card" && e.zweiteGelbe)))
            .map(e => ({
                minute: e.minute, team: e.team, art: e.type === "goal" ? "tor" : "rot",
                titel: `${Math.max(1, Math.round(e.minute || 0))}' ${e.type === "goal" ? `Tor ${nachname(e.name)}${e.elfmeter ? " (Elfmeter)" : ""}` : `Platzverweis ${nachname(e.name)}`}`
            }));
    }
});
