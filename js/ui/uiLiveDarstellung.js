/**
 * Darstellung des Livespiels (Stufe 4 der 2D-Simulation): Torwiederholung im
 * 2D-Bild, einblendbare Laufwege und Passwege.
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
                if (this._wdh && this._wdh.aktiv) this._wdh = null;
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
        }
        if (jetzt - w.start > w.dauer) {
            this._wdh = null;
            return false;
        }
        return true;
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
    }
});
