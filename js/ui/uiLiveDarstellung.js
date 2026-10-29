/**
 * Darstellung des Livespiels (Stufe 4 der 2D-Simulation): Torwiederholung im
 * 2D-Bild, einblendbare Laufwege und Passwege, dazu die Optik des Bilds:
 * weiche Schatten, Ballspur, Steilpass-Linie und Torjubel.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 * Die Wiederholung kommt aus einem Puffer: Die gezeigten Bilder legen die
 * Positionen von Ball und Spielern ab, gezählt in Spielzeit (Laufzeit der
 * Spieler) - zwölfeinhalb Bilder je Sekunde, die letzten zwölf Sekunden. So
 * fasst der Puffer gleich viel Spiel, ob auf Langsam oder Schnell, und er
 * schreibt auch mit, was der Zeitraffer ohne Bild durchrechnet: Die
 * Wiederholung zeigt den ganzen Angriff, auch wenn nur sein Ende zu sehen
 * war. Fällt ein
 * Tor, laufen nach dem ersten Jubel die gut fünf Sekunden davor noch einmal
 * ab, in Zeitlupe - die Simulation steht so lange still, wie bei der
 * Wiederholung in 3D, und bis dahin wird nicht gespult. Ein Tipp aufs Feld
 * überspringt sie.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /**
     * Puffer und Wiederholung: Abstand der Bilder in Spielsekunden, Länge des
     * Puffers und der Wiederholung (Bilder vor und nach dem Tor), Zeitlupe,
     * Verzug bis zum Start (ms Bildschirmzeit)
     */
    WIEDERHOLUNG_2D: { takt: 0.08, puffer: 150, vorher: 62, nachher: 12, tempo: 0.75, verzug: 1300 },

    /** Zu Spielbeginn: Puffer leeren, Tippen zum Überspringen verdrahten */
    bereiteDarstellungVor(liveMatch) {
        this._wdhPuffer = [];
        this._wdhUhr = 0;
        this._wdh = null;
        liveMatch.beimSpulen = (ms) => this.nimmBildAuf(liveMatch, ms);
        this._wdhTore = (liveMatch.homeScore || 0) + (liveMatch.awayScore || 0);
        this._passwege = [];
        this._pwFlug = null;
        const canvas = document.getElementById("livePitchCanvas");
        if (canvas && !canvas.dataset.wdhGebunden) {
            canvas.dataset.wdhGebunden = "1";
            canvas.addEventListener("click", () => {
                if (this._wdh && this._wdh.aktiv) {
                    this._wdh = null;
                    // Der Klick gilt dem Spiel, das gerade läuft - gebunden wird nur einmal
                    if (this.app?.currentLiveMatch) this.blendeSchnitt(this.app.currentLiveMatch);
                }
            });
        }
    },

    /** Ein gezeigtes Bild in den Puffer legen - und merken, wenn ein Tor fiel */
    nimmBildAuf(liveMatch, deltaMs) {
        if (!this._wdhPuffer || liveMatch.ohneBild) return;
        const cfg = this.WIEDERHOLUNG_2D;
        // Spielzeit wie in der Regie: Bildschirmzeit mal Tempo der Bewegung
        const skala = typeof liveMatch.director?.getMotionScale === "function" ? liveMatch.director.getMotionScale() : 1;
        this._wdhUhr += Math.min(0.1, Math.max(0, deltaMs) / 1000) * skala;
        if (this._wdhUhr >= cfg.takt) {
            this._wdhUhr = Math.min(cfg.takt, this._wdhUhr - cfg.takt);
            const b = liveMatch.ball || {};
            this._wdhPuffer.push({
                ball: [b.x, b.y, b.height || 0],
                sp: (liveMatch.players2D || []).map(p => [p.id, p.x, p.y, p.facing || 0])
            });
            if (this._wdhPuffer.length > cfg.puffer) {
                this._wdhPuffer.shift();
                // Das Torbild rückt mit nach vorn
                if (this._wdh && !this._wdh.aktiv) this._wdh.torIndex--;
            }
        }
        const tore = (liveMatch.homeScore || 0) + (liveMatch.awayScore || 0);
        if (tore > this._wdhTore) {
            const anzeige = this.anzeige2D();
            if (anzeige.wiederholung2D !== false && !anzeige.dreiD) {
                const jetzt = (typeof performance !== "undefined") ? performance.now() : Date.now();
                this._wdh = { aktiv: false, ab: jetzt + cfg.verzug, torIndex: this._wdhPuffer.length - 1 };
            }
        }
        this._wdhTore = tore;
    },

    /** Läuft gerade eine Wiederholung im 2D-Bild? Startet sie, wenn es Zeit ist. */
    wiederholung2DLaeuft(liveMatch, jetzt) {
        const w = this._wdh;
        if (!w) return false;
        const cfg = this.WIEDERHOLUNG_2D;
        if (!w.aktiv) {
            if (jetzt < w.ab || liveMatch.isPaused) return false;
            const ende = Math.min(this._wdhPuffer.length, w.torIndex + 1 + cfg.nachher);
            const anfang = Math.max(0, w.torIndex - cfg.vorher);
            w.bilder = this._wdhPuffer.slice(anfang, ende);
            if (w.bilder.length < 10) { this._wdh = null; return false; }
            w.aktiv = true;
            w.start = jetzt;
            w.dauer = w.bilder.length * cfg.takt * 1000 / cfg.tempo;
            this.blendeSchnitt(liveMatch);
        }
        if (jetzt - w.start > w.dauer) {
            this._wdh = null;
            this.blendeSchnitt(liveMatch);
            return false;
        }
        return true;
    },

    /**
     * Anfang und Ende der Wiederholung sind Schnitte: kurz abblenden, und
     * die Kamera springt mit (updateCamera in uiLivespiel.js)
     */
    blendeSchnitt(liveMatch) {
        liveMatch.blende = Math.max(liveMatch.blende || 0, 0.45);
        this._kameraSprung = true;
    },

    /** Ein Bild der Wiederholung: Positionen setzen, zeichnen, zurücksetzen */
    zeigeWiederholungsBild(liveMatch, jetzt, zeichnen) {
        const w = this._wdh;
        if (!w || !w.aktiv) { zeichnen(); return; }
        const cfg = this.WIEDERHOLUNG_2D;
        const pos = (jetzt - w.start) * cfg.tempo / (cfg.takt * 1000);
        const i = Math.max(0, Math.min(w.bilder.length - 1, Math.floor(pos)));
        const j = Math.min(w.bilder.length - 1, i + 1);
        const t = Math.max(0, Math.min(1, pos - i));
        const a = w.bilder[i], b = w.bilder[j];
        const ball = liveMatch.ball;
        const spieler = liveMatch.players2D || [];
        const sicherung = {
            ball: [ball.x, ball.y, ball.height],
            sp: spieler.map(p => [p.x, p.y, p.facing]),
            schweif: liveMatch.ballTrail
        };
        const zwischen = (u, v) => u + (v - u) * t;
        ball.x = zwischen(a.ball[0], b.ball[0]);
        ball.y = zwischen(a.ball[1], b.ball[1]);
        ball.height = zwischen(a.ball[2], b.ball[2]);
        const nachId = new Map(b.sp.map(e => [e[0], e]));
        const vonId = new Map(a.sp.map(e => [e[0], e]));
        spieler.forEach(p => {
            const von = vonId.get(p.id), nach = nachId.get(p.id) || von;
            if (!von) return;
            p.x = zwischen(von[1], nach[1]);
            p.y = zwischen(von[2], nach[2]);
            p.facing = von[3];
        });
        liveMatch.ballTrail = [];
        try {
            zeichnen();
            this.zeichneWiederholungsHinweis();
        } finally {
            ball.x = sicherung.ball[0]; ball.y = sicherung.ball[1]; ball.height = sicherung.ball[2];
            spieler.forEach((p, k) => { p.x = sicherung.sp[k][0]; p.y = sicherung.sp[k][1]; p.facing = sicherung.sp[k][2]; });
            liveMatch.ballTrail = sicherung.schweif;
        }
    },

    zeichneWiederholungsHinweis() {
        const canvas = document.getElementById("livePitchCanvas");
        const ctx = canvas && canvas.getContext("2d");
        if (!ctx) return;
        const text = "WIEDERHOLUNG · Tippen zum Überspringen";
        ctx.save();
        ctx.font = `700 ${Math.max(11, Math.round(canvas.height * 0.034))}px 'Inter', system-ui, sans-serif`;
        const breite = ctx.measureText(text).width + 28;
        const hoehe = Math.max(24, canvas.height * 0.07);
        const x = (canvas.width - breite) / 2, y = canvas.height * 0.06;
        ctx.fillStyle = "rgba(9, 12, 17, 0.82)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, breite, hoehe, hoehe / 2); else ctx.rect(x, y, breite, hoehe);
        ctx.fill();
        ctx.fillStyle = "#f8fafc";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, canvas.width / 2, y + hoehe / 2 + 1);
        ctx.restore();
    },

    /** Laufwege: wohin jeder Spieler gerade will, als gestrichelter Pfeil */
    zeichneLaufwege(ctx, spieler, toX, toY, radius) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(1, radius * 0.16);
        spieler.forEach(p => {
            if (p.pos === "TW" || typeof p.targetX !== "number") return;
            const d = Math.hypot(p.targetX - p.x, p.targetY - p.y);
            if (d < 3) return;
            const x1 = toX(p.x), y1 = toY(p.y), x2 = toX(p.targetX), y2 = toY(p.targetY);
            ctx.strokeStyle = p.color || "#ffffff";
            ctx.globalAlpha = Math.min(0.8, 0.3 + d / 30);
            ctx.setLineDash([radius * 0.45, radius * 0.4]);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            const w = Math.atan2(y2 - y1, x2 - x1), k = radius * 0.65;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(x2 - k * Math.cos(w - 0.45), y2 - k * Math.sin(w - 0.45));
            ctx.lineTo(x2, y2);
            ctx.lineTo(x2 - k * Math.cos(w + 0.45), y2 - k * Math.sin(w + 0.45));
            ctx.stroke();
        });
        ctx.restore();
    },

    /** Passwege: die letzten Zuspiele als Linien, die nach drei Sekunden verblassen */
    zeichnePasswege(ctx, liveMatch, toX, toY, radius) {
        const liste = this._passwege || (this._passwege = []);
        const jetzt = (typeof performance !== "undefined") ? performance.now() : Date.now();
        const b = liveMatch.ball || {};
        const flug = b.inFlight ? `${b.originX}|${b.originY}|${b.targetX}|${b.targetY}` : null;
        if (flug && flug !== this._pwFlug && (b.distance || 0) > 4) {
            const team = liveMatch.director?.possessionTeam;
            liste.push({ x1: b.originX, y1: b.originY, x2: b.targetX, y2: b.targetY, t: jetzt, farbe: liveMatch.kits?.[team]?.farbe || "#ffffff" });
            if (liste.length > 8) liste.shift();
        }
        this._pwFlug = flug;
        ctx.save();
        ctx.lineCap = "round";
        for (let i = liste.length - 1; i >= 0; i--) {
            const pw = liste[i];
            const alter = (jetzt - pw.t) / 3000;
            if (alter >= 1) { liste.splice(i, 1); continue; }
            ctx.globalAlpha = 0.85 * (1 - alter);
            ctx.strokeStyle = pw.farbe;
            ctx.lineWidth = Math.max(1.2, radius * 0.22);
            ctx.beginPath();
            ctx.moveTo(toX(pw.x1), toY(pw.y1));
            ctx.lineTo(toX(pw.x2), toY(pw.y2));
            ctx.stroke();
            ctx.fillStyle = pw.farbe;
            ctx.beginPath();
            ctx.arc(toX(pw.x2), toY(pw.y2), Math.max(2, radius * 0.28), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    /**
     * Optik des 2D-Bilds. Schatten: Versatz und Größe in Spielerradien, alle
     * vom selben Flutlicht geworfen. Ballspur: Sekunden Bildschirmzeit, die
     * ein Stück sichtbar bleibt, ab welchem Tempo (m/s im Spiel) die
     * Wiederholung eine Spur zieht, und welcher Satz zwischen zwei Bildern
     * kein Flug ist (Meter). Steilpass: ab welcher Länge (Feldeinheiten) und
     * wie lange er nachklingt. Jubel: Konfetti aus der Heimkurve und dem
     * Gästeblock, Lebensdauer, Ausschlag des Netzes in Metern.
     */
    OPTIK_2D: {
        schatten: { dx: 0.26, dy: 0.42, breit: 1.32, hoch: 0.74, deckung: 0.5 },
        spur: { dauer: 0.24, dauerSchuss: 0.4, ab: 11, sprung: 12 },
        steilpass: { ab: 15, nachlauf: 0.7 },
        jubel: { heim: 110, gast: 50, leben: [2.2, 3.4], netz: 1.5, netzDauer: 1.4, ring: 0.9 }
    },

    /** Die Uhr der Optik: Sekunden Bildschirmzeit */
    optikUhr() {
        return ((typeof performance !== "undefined") ? performance.now() : Date.now()) / 1000;
    },

    /** Ein weicher Schatten als fertiges Bild - je Größe einmal gezeichnet */
    schattenBild(r) {
        const groesse = Math.max(4, Math.round(r));
        const bilder = this._schattenBilder || (this._schattenBilder = new Map());
        if (bilder.has(groesse)) return bilder.get(groesse);
        if (typeof document === "undefined") return null;
        const bild = document.createElement("canvas");
        bild.width = bild.height = groesse * 2;
        const c = bild.getContext("2d");
        if (!c) return null;
        const verlauf = c.createRadialGradient(groesse, groesse, 0, groesse, groesse, groesse);
        verlauf.addColorStop(0, "rgba(0, 0, 0, 1)");
        verlauf.addColorStop(0.5, "rgba(0, 0, 0, 0.72)");
        verlauf.addColorStop(1, "rgba(0, 0, 0, 0)");
        c.fillStyle = verlauf;
        c.fillRect(0, 0, groesse * 2, groesse * 2);
        // Der Zoom ändert die Größe stetig - nicht jede Stufe aufheben
        if (bilder.size > 32) bilder.clear();
        bilder.set(groesse, bild);
        return bild;
    },

    /**
     * Schatten der Spieler: weich statt hart umrandet, alle in dieselbe
     * Richtung. Der Torwart im Hechtsprung wirft einen langen Schatten.
     */
    zeichneSchatten(ctx, spieler, toX, toY, radius) {
        const s = this.OPTIK_2D.schatten;
        const bild = this.schattenBild(radius);
        const w = radius * 2 * s.breit, h = radius * 2 * s.hoch;
        const cw = ctx.canvas.width, ch = ctx.canvas.height;
        ctx.save();
        ctx.globalAlpha = s.deckung;
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        spieler.forEach(p => {
            const x = toX(p.x) + radius * s.dx, y = toY(p.y) + radius * s.dy;
            if (x < -w || x > cw + w || y < -h || y > ch + h) return;
            const streckung = p.diving > 0 ? 1 + Math.min(1, p.diving / 0.85) * 0.95 : 1;
            if (!bild) {
                ctx.beginPath();
                ctx.ellipse(x, y, w / 2 * streckung, h / 2, streckung > 1 ? (p.diveAngle || 0) : 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (streckung > 1) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(p.diveAngle || 0);
                ctx.drawImage(bild, -w * streckung / 2, -h / 2, w * streckung, h);
                ctx.restore();
            } else {
                ctx.drawImage(bild, x - w / 2, y - h / 2, w, h);
            }
        });
        ctx.restore();
    },

    /** Der Schatten des Balls: je höher der Ball, desto weiter weg, größer und blasser */
    zeichneBallschatten(ctx, bx, by, ballR, hoehe, unit) {
        const bild = this.schattenBild(ballR * 1.2);
        const w = ballR * 2.3 * (1 + hoehe * 0.6), h = w * 0.5;
        const x = bx + ballR * 0.4 + hoehe * unit * 1.2, y = by + ballR * 0.8 + hoehe * unit * 1.6;
        ctx.save();
        ctx.globalAlpha = Math.max(0.12, 0.6 - hoehe * 0.22);
        if (bild) ctx.drawImage(bild, x - w / 2, y - h / 2, w, h);
        else {
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
            ctx.beginPath();
            ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    /**
     * Die Ballspur hängt am gezeichneten Ball, auch in der Luft. Vorher kam
     * sie aus der Rechnung und lag auf dem Rasen, während der Ball über die
     * Köpfe flog. Je Bild ein Punkt, solange der Ball fliegt; ein Schuss
     * zieht eine längere, wärmere Spur. In der Wiederholung entsteht sie aus
     * dem Tempo im Bild.
     */
    merkeBallspur(ball, neueSzene, skala, inWdh) {
        const cfg = this.OPTIK_2D.spur;
        const jetzt = this.optikUhr();
        if (!this._ballSpur || neueSzene) { this._ballSpur = []; this._ballZuletzt = null; }
        const spur = this._ballSpur;
        const vorher = this._ballZuletzt;
        this._ballZuletzt = { x: ball.x, y: ball.y, t: jetzt };
        while (spur.length && jetzt - spur[0].t > cfg.dauerSchuss) spur.shift();
        if (!vorher) return;
        const meter = Math.hypot((ball.x - vorher.x) * 1.14, (ball.y - vorher.y) * 0.68);
        // Ein Satz ist kein Flug: Der Ball wurde hingelegt
        if (meter > cfg.sprung) { spur.length = 0; return; }
        const fliegt = inWdh
            ? meter / Math.max(1e-3, jetzt - vorher.t) / Math.max(0.05, skala) > cfg.ab
            : !!ball.inFlight && (ball.distance || 0) > 6 && ball.actionType !== "dead";
        if (fliegt) spur.push({ x: ball.x, y: ball.y, h: ball.height || 0, t: jetzt, schuss: !inWdh && ball.actionType === "shot" });
        if (spur.length > 40) spur.shift();
    },

    /**
     * Zeichnet die Ballspur: am Boden unter den Spielern, in der Luft über
     * ihnen - wie der Ball selbst. Sie wird zum Ball hin breiter und heller.
     */
    zeichneBallspur(ctx, ball, toX, toY, unit, ballR, luft) {
        const spur = this._ballSpur;
        if (!spur || spur.length === 0) return;
        const cfg = this.OPTIK_2D.spur;
        const jetzt = this.optikUhr();
        const letzter = spur[spur.length - 1];
        const punkte = jetzt - letzter.t < 0.08
            ? spur.concat([{ x: ball.x, y: ball.y, h: ball.height || 0, t: jetzt, schuss: letzter.schuss }])
            : spur;
        const lage = (e) => [toX(e.x), toY(e.y) - e.h * unit * 1.4];
        ctx.save();
        ctx.lineCap = "round";
        for (let i = 1; i < punkte.length; i++) {
            const a = punkte[i - 1], b = punkte[i];
            if (((a.h + b.h) / 2 > 0.2) !== luft) continue;
            const f = 1 - (jetzt - a.t) / (b.schuss ? cfg.dauerSchuss : cfg.dauer);
            if (f <= 0.03) continue;
            const [x1, y1] = lage(a), [x2, y2] = lage(b);
            ctx.strokeStyle = b.schuss ? `rgba(255, 238, 205, ${0.78 * f})` : `rgba(255, 255, 255, ${0.5 * f})`;
            ctx.lineWidth = Math.max(1, ballR * (b.schuss ? 1.5 : 1.1) * (0.3 + 0.7 * f));
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.restore();
    },

    /**
     * Steilpass und langer Ball: Eine Linie zeigt, wohin der Ball geht, ein
     * Ring den Zielpunkt, und wer hineinstartet, seinen Laufweg dorthin. Das
     * Stück, das der Ball schon hinter sich hat, ist durchgezogen. Nach der
     * Ankunft klingt das Bild kurz nach. Im Augen-Menü abschaltbar.
     */
    zeichneSteilpass(ctx, liveMatch, spieler, ball, toX, toY, radius) {
        const cfg = this.OPTIK_2D.steilpass;
        const jetzt = this.optikUhr();
        const b = liveMatch.ball || {};
        const liste = liveMatch.aktionen || [];
        const letzte = liste.length ? liste[liste.length - 1].nr : 0;
        // Beim ersten Blick (oder nach neuem Spiel) zählt nichts von vorher
        if (this._steilNr === undefined || letzte < this._steilNr) this._steilNr = letzte;
        for (let i = liste.length - 1; i >= 0 && liste[i].nr > this._steilNr; i--) {
            const a = liste[i];
            if (!((a.art === "pass" && a.tief) || a.art === "flanke")) continue;
            const x1 = typeof b.originX === "number" ? b.originX : ball.x;
            const y1 = typeof b.originY === "number" ? b.originY : ball.y;
            if (Math.hypot(a.x - x1, a.y - y1) < cfg.ab) continue;
            const von = spieler.find(p => p.id === a.id);
            this._steilpass = { x1, y1, x2: a.x, y2: a.y, empf: a.empf ?? null, team: von ? von.team : null, start: jetzt, ende: null };
            break;
        }
        this._steilNr = letzte;

        const sp = this._steilpass;
        if (!sp) return;
        const unterwegs = jetzt - sp.start < 0.15
            || (b.inFlight && Math.abs((b.targetX ?? -99) - sp.x2) < 0.5 && Math.abs((b.targetY ?? -99) - sp.y2) < 0.5);
        if (!unterwegs && sp.ende === null) sp.ende = jetzt;
        const deckung = sp.ende === null ? 1 : 1 - (jetzt - sp.ende) / cfg.nachlauf;
        if (deckung <= 0) { this._steilpass = null; return; }

        const farbe = liveMatch.kits?.[sp.team]?.farbe || "#ffffff";
        const x1 = toX(sp.x1), y1 = toY(sp.y1), x2 = toX(sp.x2), y2 = toY(sp.y2);
        ctx.save();
        ctx.lineCap = "round";
        // Der ganze Weg, hell gestrichelt
        ctx.globalAlpha = 0.55 * deckung;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, radius * 0.14);
        ctx.setLineDash([radius * 0.5, radius * 0.42]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // Der Laufweg dessen, der hineinstartet
        const empf = sp.ende === null && sp.empf !== null ? spieler.find(p => p.id === sp.empf) : null;
        if (empf && Math.hypot(empf.x - sp.x2, empf.y - sp.y2) > 2.5) {
            ctx.globalAlpha = 0.8 * deckung;
            ctx.strokeStyle = farbe;
            ctx.lineWidth = Math.max(1, radius * 0.2);
            ctx.setLineDash([radius * 0.22, radius * 0.36]);
            ctx.beginPath();
            ctx.moveTo(toX(empf.x), toY(empf.y));
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        // Was der Ball schon zurückgelegt hat
        if (sp.ende === null) {
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = farbe;
            ctx.lineWidth = Math.max(1.2, radius * 0.22);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(toX(ball.x), toY(ball.y));
            ctx.stroke();
        }
        // Der Zielpunkt - größer als ein Spieler, damit der Empfänger ihn nicht verdeckt
        const puls = 1 + Math.sin(jetzt * 9) * 0.12;
        ctx.globalAlpha = 0.9 * deckung;
        ctx.strokeStyle = farbe;
        ctx.lineWidth = Math.max(1.2, radius * 0.2);
        ctx.beginPath();
        ctx.arc(x2, y2, radius * 1.6 * puls, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x2, y2, Math.max(1.5, radius * 0.22), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    },

    /**
     * Der Jubel auf dem Rasen. Am Boden (unter den Spielern): Das Netz beult
     * sich, wo der Ball einschlägt, zwei Ringe laufen vom Ball weg, und der
     * Torschütze leuchtet, solange gejubelt wird. Oben (über allem): Aus der
     * Kurve hinter dem Tor regnet Konfetti in den Vereinsfarben, bei einem Tor
     * der Gäste nur aus ihrem Block. Das Netz bewegt sich auch in der
     * Wiederholung, das Konfetti fällt nur einmal.
     */
    zeichneTorjubel(ctx, liveMatch, spieler, ball, toX, toY, unit, radius, linien, inWdh, ebene, dt) {
        const cfg = this.OPTIK_2D.jubel;
        const jetzt = this.optikUhr();
        if (ebene === "boden") {
            // Der Ball schlägt ein: Er erreicht die Linie zwischen den Pfosten.
            // Ein Torschuss endet in der Simulation genau auf der Linie, nicht
            // dahinter - also zählt schon die Linie.
            const jubel = (liveMatch.goalFlash || 0) > 0 || !!liveMatch.celebratingTeam || inWdh;
            const imTor = jubel && Math.abs(ball.y - 50) < 5.6 && (ball.x <= linien[0] + 0.4 || ball.x >= linien[1] - 0.4);
            if (imTor && !this._ballImTor) this._netz = { links: ball.x < 50, y: ball.y, start: jetzt };
            this._ballImTor = imTor;

            // Konfetti beim ersten Bild des Tors
            const blitz = liveMatch.goalFlash || 0;
            if (!inWdh && blitz > (this._jubelBlitz || 0) + 0.2 && liveMatch.celebratingTeam) {
                // Die Seite nach dem Ziel des Schusses - der Ball fliegt in dem Moment noch
                const zielX = typeof liveMatch.ball?.targetX === "number" ? liveMatch.ball.targetX : ball.x;
                this.starteKonfetti(liveMatch, liveMatch.celebratingTeam, zielX < 50, linien);
            }
            this._jubelBlitz = blitz;
            if (inWdh) this._konfetti = null;

            const n = this._netz;
            if (n) {
                const t = jetzt - n.start;
                if (t > cfg.netzDauer) this._netz = null;
                else {
                    const nach = 1 - t / cfg.netzDauer;
                    const aus = Math.max(-0.35, Math.exp(-t * 2.6) * Math.cos(t * 8)) * cfg.netz * unit;
                    const dir = n.links ? -1 : 1;
                    const xb = toX(n.links ? linien[0] : linien[1]) + dir * 2 * unit;
                    const yo = toY(50 - 5.38), yu = toY(50 + 5.38), yb = toY(Math.max(46, Math.min(54, n.y)));
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(xb, yo);
                    ctx.bezierCurveTo(xb + dir * aus * 1.35, yb - (yb - yo) * 0.3, xb + dir * aus * 1.35, yb + (yu - yb) * 0.3, xb, yu);
                    ctx.closePath();
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.24 * nach})`;
                    ctx.fill();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * nach})`;
                    ctx.lineWidth = Math.max(1.5, unit * 0.18);
                    ctx.stroke();
                    // Zwei Ringe laufen vom Einschlag weg
                    [0, 0.18].forEach(verzug => {
                        const tr = t - verzug;
                        if (tr <= 0 || tr > cfg.ring) return;
                        ctx.globalAlpha = 0.75 * (1 - tr / cfg.ring);
                        ctx.lineWidth = Math.max(1.2, unit * 0.22);
                        ctx.beginPath();
                        ctx.arc(toX(n.links ? linien[0] - 0.8 : linien[1] + 0.8), yb, unit * (1 + tr * 10), 0, Math.PI * 2);
                        ctx.stroke();
                    });
                    ctx.restore();
                }
            }

            // Der Torschütze leuchtet
            if (liveMatch.celebratingTeam && !inWdh) {
                const id = liveMatch.jubelSchuetze;
                const schuetze = id !== null && id !== undefined ? spieler.find(p => p.id === id) : null;
                if (schuetze) {
                    const x = toX(schuetze.x), y = toY(schuetze.y);
                    const farbe = liveMatch.kits?.[schuetze.team]?.akzent || "#facc15";
                    const puls = 1 + Math.sin(jetzt * 7) * 0.1;
                    ctx.save();
                    ctx.globalAlpha = 0.3;
                    ctx.fillStyle = farbe;
                    ctx.beginPath();
                    ctx.arc(x, y, radius * 2.1 * puls, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.globalAlpha = 0.8;
                    ctx.strokeStyle = farbe;
                    ctx.lineWidth = Math.max(1.5, radius * 0.18);
                    ctx.beginPath();
                    ctx.arc(x, y, radius * 1.7 * puls, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            return;
        }

        // Oben: das Konfetti
        const teile = this._konfetti;
        if (!teile || teile.length === 0) return;
        const schritt = Math.max(0, Math.min(0.05, dt || 0));
        const groesse = Math.max(2, radius * 0.34);
        ctx.save();
        for (let i = teile.length - 1; i >= 0; i--) {
            const k = teile[i];
            k.alter += schritt;
            if (k.alter >= k.leben) { teile.splice(i, 1); continue; }
            if (k.alter < 0) continue;
            const bremse = Math.exp(-1.7 * schritt);
            k.vx *= bremse;
            k.vy = k.vy * bremse + Math.sin(k.alter * 3 + k.flatter) * schritt * 3;
            k.x += k.vx * schritt;
            k.y += k.vy * schritt;
            k.dreh += k.drehV * schritt;
            const px = toX(k.x), py = toY(k.y);
            if (px < -20 || px > ctx.canvas.width + 20 || py < -20 || py > ctx.canvas.height + 20) continue;
            const rest = (k.leben - k.alter) / k.leben;
            ctx.globalAlpha = Math.min(1, rest / 0.3);
            ctx.fillStyle = k.farbe;
            const g = groesse * k.groesse * (0.75 + 0.25 * rest);
            const breite = g * 1.6 * Math.abs(Math.cos(k.flatter + k.alter * 7));
            const c = Math.cos(k.dreh), s = Math.sin(k.dreh);
            ctx.setTransform(c, s, -s, c, px, py);
            ctx.fillRect(-breite / 2, -g / 2, Math.max(0.6, breite), g);
        }
        ctx.restore();
    },

    /** Konfetti aus der Kurve hinter dem Tor, in den Farben dessen, der getroffen hat */
    starteKonfetti(liveMatch, team, links, linien) {
        const cfg = this.OPTIK_2D.jubel;
        const kit = liveMatch.kits?.[team] || {};
        const farben = [kit.farbe || "#facc15", kit.zweit || "#ffffff", "#ffffff"];
        const anzahl = team === "home" ? cfg.heim : cfg.gast;
        // Der Gästeblock liegt in einer Ecke der Kurve
        const yVon = team === "home" ? 16 : 62, yBis = team === "home" ? 84 : 86;
        const teile = this._konfetti || (this._konfetti = []);
        for (let i = 0; i < anzahl; i++) {
            teile.push({
                x: links ? linien[0] - 1.5 - Math.random() * 3 : linien[1] + 1.5 + Math.random() * 3,
                y: yVon + Math.random() * (yBis - yVon),
                vx: (links ? 1 : -1) * (5 + Math.random() * 13),
                vy: (Math.random() - 0.5) * 14,
                alter: -Math.random() * 0.6,
                leben: cfg.leben[0] + Math.random() * (cfg.leben[1] - cfg.leben[0]),
                farbe: farben[i % farben.length],
                dreh: Math.random() * Math.PI * 2,
                drehV: (Math.random() - 0.5) * 14,
                flatter: Math.random() * Math.PI * 2,
                groesse: 0.6 + Math.random() * 0.6
            });
        }
        if (teile.length > 260) teile.splice(0, teile.length - 260);
    }
});
