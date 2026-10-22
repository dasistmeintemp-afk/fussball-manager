/**
 * BallPhysik - der Ball als Körper (Stufe 1 der 2D-Simulation)
 *
 * Bisher stand der Ausgang eines Zuspiels fest, bevor der Ball rollte: Die
 * MatchFlowEngine würfelte eine Trefferquote, danach schob die Regie den Ball
 * in fester Zeit zum vorher bestimmten Ziel. Wer abfing, stand schon fest.
 *
 * Jetzt wird der Ball gespielt: mit Richtung, Tempo und Höhe und mit einer
 * Streuung aus den Werten des Passgebers und dem Druck auf ihn. Ein flacher
 * Ball rollt mit Reibung aus, ein hoher fliegt im Bogen, setzt auf und rollt
 * weiter. Wer zuerst an ihm ist, bekommt ihn: aus Reaktionszeit, Tempo und
 * Antritt, beim hohen Ball aus der Reichweite in der Luft. Was keiner
 * erreicht, geht ins Aus oder bleibt liegen.
 *
 * Einheiten: Feldeinheiten (gut ein Meter) und Laufzeit-Sekunden - dieselbe
 * Zeit, in der LiveMatchDirector.laufeZu die Spieler laufen lässt. Höhen in
 * Metern; die Darstellung zeigt ball.height = Meter / 6.
 *
 * Reine Rechnung ohne Zufall - die Streuung bringt der Aufrufer mit.
 */
class BallPhysik {
    /** Rollender Ball: Das Tempo fällt je Sekunde auf e^-0,9, also auf gut 40 % */
    static REIBUNG = 0.9;
    /** Nach dem Aufsetzen bremst der Rasen stärker */
    static REIBUNG_NACH_AUFSETZEN = 1.2;
    /** So schnell kommt ein gut dosierter flacher Pass beim Mitspieler an */
    static ANKUNFT = 11;
    /** Härter spielt niemand einen flachen Pass */
    static FLACH_MAX = 42;
    /** Darunter liegt der Ball */
    static RUHE = 0.8;
    /** Anteil des Tempos, mit dem ein hoher Ball nach dem Aufsetzen weiterspringt */
    static AUFPRALL = 0.45;
    /** Zeitraster der Abfangrechnung */
    static TAKT = 0.04;
    /** Die Linien des Modells: Torlinien bei 3,2 und 96,8, Seitenlinien bei 1,5 und 98,5 */
    static LINIEN = { x0: 3.2, x1: 96.8, y0: 1.5, y1: 98.5 };
    /** Bis zu dieser Höhe nimmt man den Ball mit Fuß, Oberschenkel oder Brust an */
    static ANNAHME_HOEHE = 1.5;
    /** Ohne Sprung mit dem Kopf erreichbar; die Sprungkraft legt bis zu 0,6 m drauf */
    static KOPF_HOEHE = 2.2;
    /** Der Torwart mit den Händen */
    static TW_HOEHE = 2.7;
    /**
     * Wer dem Ball hinterherläuft, läuft wie im Regiewerk mit Dringlichkeit
     * 1,9 (computeTarget beim Ballführenden) - mit dem Antritt und der
     * Tempodecke von laufeZu. Sonst stimmte die Rechnung nicht mit dem, was
     * man sieht.
     */
    static DRINGLICHKEIT = 1.9;
    static SPRINT_DECKE = 6.5;
    static ANTRITT = 6.5 * 1.9;
    /** So weit reicht ein Bein, ein Torwart wirft sich weiter */
    static RADIUS = 1.0;
    static RADIUS_TW = 1.6;

    // ------------------------------------------------------------ Flugbahnen

    /**
     * Ein flacher Ball von start in Richtung winkel mit Anfangstempo v0.
     * Weg bei Reibung k: s(t) = v0/k · (1 - e^-kt), Tempo v(t) = v0 · e^-kt.
     */
    static flach(start, winkel, v0, k = BallPhysik.REIBUNG) {
        const v = Math.max(0, v0);
        const ruhe = v > BallPhysik.RUHE ? Math.log(v / BallPhysik.RUHE) / k : 0;
        return {
            art: "flach",
            x: start.x, y: start.y,
            ux: Math.cos(winkel), uy: Math.sin(winkel),
            v0: v, k,
            ruhe,
            weite: (v - Math.min(v, BallPhysik.RUHE)) / k
        };
    }

    /**
     * Ein hoher Ball über die Weite: horizontal gleichmäßig, in der Höhe eine
     * Parabel mit dem Scheitel hoehe (Meter). Nach dem Aufsetzen springt er
     * flach weiter und rollt aus.
     */
    static hoch(start, winkel, weite, opts = {}) {
        const w = Math.max(1, weite);
        const vh = opts.tempo || Math.max(15, Math.min(24, 16 + w * 0.1));
        const flug = w / vh;
        const hoehe = opts.hoehe || Math.max(2.2, Math.min(14, 2 + w * 0.13));
        const ux = Math.cos(winkel), uy = Math.sin(winkel);
        const landung = { x: start.x + ux * w, y: start.y + uy * w };
        const nach = BallPhysik.flach(landung, winkel, vh * (opts.aufprall ?? BallPhysik.AUFPRALL), BallPhysik.REIBUNG_NACH_AUFSETZEN);
        return {
            art: "hoch",
            x: start.x, y: start.y, ux, uy,
            vh, flug, hoehe, weite: w, landung, nach,
            ruhe: flug + nach.ruhe
        };
    }

    /** Wo der Ball nach t Sekunden ist: x, y und Höhe in Metern */
    static punkt(bahn, t) {
        if (!bahn) return null;
        const tt = Math.max(0, t);
        if (bahn.art === "hoch") {
            if (tt <= bahn.flug) {
                const s = bahn.vh * tt;
                return {
                    x: bahn.x + bahn.ux * s,
                    y: bahn.y + bahn.uy * s,
                    h: 4 * bahn.hoehe * tt * (bahn.flug - tt) / (bahn.flug * bahn.flug)
                };
            }
            // Ein kleiner Aufsetzer, dann rollt er
            const r = tt - bahn.flug;
            const p = BallPhysik.punkt(bahn.nach, r);
            const sprung = bahn.flug * 0.3;
            p.h = r < sprung ? 4 * bahn.hoehe * 0.12 * r * (sprung - r) / (sprung * sprung) : 0;
            return p;
        }
        const tr = Math.min(tt, bahn.ruhe);
        const s = bahn.v0 / bahn.k * (1 - Math.exp(-bahn.k * tr));
        return { x: bahn.x + bahn.ux * s, y: bahn.y + bahn.uy * s, h: 0 };
    }

    /** Das Tempo des Balls nach t Sekunden (horizontal) */
    static tempo(bahn, t) {
        if (!bahn) return 0;
        if (bahn.art === "hoch") return t <= bahn.flug ? bahn.vh : BallPhysik.tempo(bahn.nach, t - bahn.flug);
        return t >= bahn.ruhe ? 0 : bahn.v0 * Math.exp(-bahn.k * t);
    }

    /** Liegt ein Punkt im Feld? */
    static imFeld(p) {
        const l = BallPhysik.LINIEN;
        return p.x >= l.x0 && p.x <= l.x1 && p.y >= l.y0 && p.y <= l.y1;
    }

    /**
     * Wann und wo der Ball das Feld verlässt - null, wenn er vorher liegt.
     * Der Punkt liegt knapp hinter der Linie, damit die Regie (planeStandard)
     * die richtige Fortsetzung erkennt.
     */
    static ausBei(bahn) {
        const takt = BallPhysik.TAKT;
        for (let t = takt; t <= bahn.ruhe + takt; t += takt) {
            const p = BallPhysik.punkt(bahn, Math.min(t, bahn.ruhe));
            if (!BallPhysik.imFeld(p)) {
                const l = BallPhysik.LINIEN;
                return {
                    t,
                    punkt: {
                        x: p.x < l.x0 ? Math.min(p.x, l.x0 - 0.5) : (p.x > l.x1 ? Math.max(p.x, l.x1 + 0.5) : p.x),
                        y: p.y < l.y0 ? Math.min(p.y, l.y0 - 0.5) : (p.y > l.y1 ? Math.max(p.y, l.y1 + 0.5) : p.y)
                    }
                };
            }
            if (t >= bahn.ruhe) break;
        }
        return null;
    }

    /**
     * Ein Zuspiel planen: Welches Anfangstempo bringt einen flachen Ball
     * über die Strecke weite so, dass er mit ANKUNFT beim Mitspieler ist?
     * Aus v(T) = v0 - k·s(T) folgt v0 = ANKUNFT + k·weite.
     */
    static passTempo(weite) {
        return Math.min(BallPhysik.FLACH_MAX, BallPhysik.ANKUNFT + BallPhysik.REIBUNG * Math.max(0, weite));
    }

    /** Wann ein Ball eine Strecke zurückgelegt hat - Infinity, wenn er vorher liegt */
    static zeitBis(bahn, strecke) {
        if (bahn.art === "hoch") {
            if (strecke <= bahn.weite) return strecke / bahn.vh;
            return bahn.flug + BallPhysik.zeitBis(bahn.nach, strecke - bahn.weite);
        }
        const q = 1 - strecke * bahn.k / Math.max(1e-6, bahn.v0);
        if (q <= 0) return Infinity;
        const t = -Math.log(q) / bahn.k;
        return t > bahn.ruhe ? Infinity : t;
    }

    // ------------------------------------------------------------ Spieler

    /** Höchsttempo beim Hinterherlaufen - wie laufeZu mit Dringlichkeit 1,9 */
    static hoechstTempo(p) {
        const basis = typeof p.baseSpeed === "number" ? p.baseSpeed : 2.8;
        const frisch = typeof p.freshness === "number" ? p.freshness : 1;
        return Math.min(basis * BallPhysik.DRINGLICHKEIT * (0.62 + frisch * 0.38), BallPhysik.SPRINT_DECKE);
    }

    /**
     * Bis zu welcher Höhe (Meter) ein Spieler an den Ball kommt: Körpergröße
     * (Zentimeter, um 182 üblich) und Sprungkraft, der Torwart mit den Händen.
     */
    static reichweite(p, mitHaenden = false) {
        const groesse = typeof p.groesse === "number" ? Math.max(-0.2, Math.min(0.2, (p.groesse - 182) / 100)) : 0;
        if (mitHaenden) return BallPhysik.TW_HOEHE + groesse + Math.max(-0.2, Math.min(0.4, (p.fein?.aerialReach || 0) * 0.04));
        const sprung = typeof p.fein?.jumpingReach === "number" ? p.fein.jumpingReach : 0;
        return BallPhysik.KOPF_HOEHE + groesse + Math.max(0, Math.min(0.6, 0.3 + sprung * 0.04));
    }

    /**
     * Wie lange ein Spieler bis zu einem Punkt braucht: erst die Reaktion,
     * in der er weiterläuft wie bisher, dann Antritt bis zur Tempodecke.
     * Ein Lauf in die richtige Richtung zählt als Anfangstempo.
     */
    static laufzeit(p, punkt, reaktion = 0, radius = BallPhysik.RADIUS) {
        const vx = p.lvx || 0, vy = p.lvy || 0;
        const ax = p.x + vx * reaktion, ay = p.y + vy * reaktion;
        const dx = punkt.x - ax, dy = punkt.y - ay;
        const voll = Math.hypot(dx, dy);
        const d = Math.max(0, voll - radius);
        if (d <= 0) return reaktion;
        const vmax = BallPhysik.hoechstTempo(p);
        const a = BallPhysik.ANTRITT;
        const v0 = Math.max(0, Math.min(vmax, (vx * dx + vy * dy) / voll));
        const tA = (vmax - v0) / a;
        const dA = (v0 + vmax) / 2 * tA;
        const lauf = d <= dA ? (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a : tA + (d - dA) / vmax;
        return reaktion + lauf;
    }

    /**
     * Der Wettlauf zum Ball: Wann ist jeder Spieler frühestens am Ball?
     *
     * Für jeden Zeitpunkt der Flugbahn wird geprüft, ob er den Ballpunkt bis
     * dahin erreicht - und ob der Ball dort niedrig genug ist. Liegt der Ball
     * schon, zählt der Weg zum liegenden Ball. Liefert die Spieler mit ihrer
     * Zeit, dem Punkt und der Höhe, der Schnellste zuerst; wer nicht an den
     * Ball kommt, bevor er das Feld verlässt, fehlt.
     *
     * opts.reaktion(p): Reaktionszeit, opts.reichweite(p): erreichbare Höhe,
     * opts.radius(p): Reichweite des Beins, opts.darf(p, punkt): ob er dort
     * hin darf (der Torwart nur im eigenen Strafraum).
     */
    static wettlauf(bahn, spieler, opts = {}) {
        const takt = BallPhysik.TAKT;
        const aus = BallPhysik.ausBei(bahn);
        const ende = aus ? aus.t : bahn.ruhe;
        const reaktion = opts.reaktion || (() => 0.3);
        const reichweite = opts.reichweite || (p => BallPhysik.reichweite(p));
        const radius = opts.radius || (() => BallPhysik.RADIUS);
        const darf = opts.darf || (() => true);
        // Die Bahn einmal abtasten, nicht für jeden Spieler neu
        const punkte = [];
        for (let t = takt; t < ende; t += takt) punkte.push({ t, ...BallPhysik.punkt(bahn, t) });
        const liegt = aus ? null : { t: bahn.ruhe, ...BallPhysik.punkt(bahn, bahn.ruhe) };

        const ergebnis = [];
        spieler.forEach(p => {
            const r = reaktion(p);
            if (!(r < Infinity)) return;
            const hoch = reichweite(p);
            const rad = radius(p);
            let treffer = null;
            for (let i = 0; i < punkte.length; i++) {
                const q = punkte[i];
                if (q.t < r || q.h > hoch || !darf(p, q)) continue;
                if (BallPhysik.laufzeit(p, q, r, rad) <= q.t) { treffer = q; break; }
            }
            if (!treffer && liegt && darf(p, liegt)) {
                const t = Math.max(liegt.t, BallPhysik.laufzeit(p, liegt, r, rad));
                treffer = { ...liegt, t, liegend: true };
            }
            if (treffer) ergebnis.push({ p, t: treffer.t, punkt: { x: treffer.x, y: treffer.y }, h: treffer.h, liegend: !!treffer.liegend });
        });
        ergebnis.sort((a, b) => a.t - b.t);
        return { reihenfolge: ergebnis, aus, ende };
    }

    /**
     * Die Bahn für die Darstellung bis zum Zeitpunkt t: Wo der Ball ist und
     * wie hoch (ball.height = Meter / 6).
     */
    static darstellung(bahn, t) {
        const p = BallPhysik.punkt(bahn, t);
        return { x: p.x, y: p.y, height: Math.max(0, p.h) / 6 };
    }
}

if (typeof window !== "undefined") {
    window.BallPhysik = BallPhysik;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { BallPhysik };
}
