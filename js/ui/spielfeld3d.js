/**
 * Spielfeld3D - Das Livespiel in 3D
 *
 * Die Simulation bleibt dieselbe: Laufwege, Ballflug und Entscheidungen kommen
 * aus LiveMatch und LiveMatchDirector. Dieses Modul liest nur und zeichnet -
 * genau wie die 2D-Ansicht, nur mit Three.js in einem Stadion statt von oben.
 * So arbeiten auch die großen Managerspiele: eine eigene Simulation, darüber
 * eine Darstellung.
 *
 * Maße wie in echt: 105 mal 68 Meter, Strafraum 16,5 Meter, Tor 7,32 mal
 * 2,44 Meter. In der Simulation liegen die Torlinien bei x = 4 und x = 96,
 * die Breite geht von y = 0 bis 100.
 *
 * Die Spieler sind stilisierte Figuren in den Trikotfarben des Spiels: Rumpf,
 * Kopf, Arme, Beine. Sie laufen mit, pendeln die Beine im Takt ihrer
 * Geschwindigkeit und schauen dorthin, wohin sie laufen - oder zum Ball.
 * Was sie tun, meldet die Regie (LiveMatchDirector.meldeAktion): Pass,
 * Schuss, Flanke, Kopfball, Zweikampf, Parade, Tor. Dazu gibt es je einen
 * Bewegungsablauf, aus Gelenkwinkeln gerechnet statt aus fertigen Modellen.
 *
 * Nach einem Tor zeigt die Ansicht die letzten Sekunden noch einmal in
 * Zeitlupe, aus einem zweiten Blickwinkel hinter dem Tor. Dafür nimmt sie
 * laufend auf, was sie zeichnet; die Simulation steht derweil still.
 *
 * Die Bibliothek (668 KB) lädt erst, wenn jemand die 3D-Ansicht einschaltet
 * (ladeBibliothek) - in der Einzeldatei liegt sie als Vorrat bereit.
 */

const S3D_LAENGE = 105;
const S3D_BREITE = 68;
const S3D_TOR_LINKS = 4;
const S3D_TOR_RECHTS = 96;

class Spielfeld3D {
    /**
     * Qualitätsstufen. Niedrig zeichnet mit weniger Bildpunkten als der
     * Bildschirm hat und ohne Kantenglättung - für schwache Telefone.
     */
    static QUALITAET = {
        niedrig: { pixelRatio: 0.8, antialias: false, rasenPx: 1024, gras: 2500, teile: 0.6, namen: 12 },
        mittel: { pixelRatio: 1.25, antialias: true, rasenPx: 2048, gras: 9000, teile: 1, namen: 22 },
        hoch: { pixelRatio: 2, antialias: true, rasenPx: 4096, gras: 30000, teile: 1.4, namen: 22 }
    };

    /** Wo die Bibliothek liegt - als Datei und als Vorrat in der Einzeldatei */
    static BIBLIOTHEK = "js/vendor/three.min.js";
    static VORRAT_ID = "vorrat-three";

    /** Kann der Browser WebGL? Ohne zuerst die Bibliothek zu laden. */
    static webglMoeglich() {
        if (typeof document === "undefined") return false;
        try {
            const c = document.createElement("canvas");
            return !!(c.getContext("webgl2") || c.getContext("webgl"));
        } catch (e) {
            return false;
        }
    }

    /** Gibt es WebGL und die Bibliothek? */
    static verfuegbar() {
        if (typeof THREE === "undefined") return false;
        return Spielfeld3D.webglMoeglich();
    }

    /**
     * Die Bibliothek bei Bedarf laden. Liefert ein Promise auf true, sobald
     * THREE da ist. In der Einzeldatei liegt sie als nicht ausgeführter
     * Vorrat im Dokument, sonst kommt sie als Datei (offline aus dem
     * Service Worker).
     */
    static ladeBibliothek() {
        if (typeof THREE !== "undefined") return Promise.resolve(true);
        if (Spielfeld3D._laden) return Spielfeld3D._laden;
        Spielfeld3D._laden = new Promise(resolve => {
            try {
                const vorrat = document.getElementById(Spielfeld3D.VORRAT_ID);
                const skript = document.createElement("script");
                if (vorrat) {
                    skript.textContent = vorrat.textContent;
                    document.head.appendChild(skript);
                    resolve(typeof THREE !== "undefined");
                    return;
                }
                skript.src = Spielfeld3D.BIBLIOTHEK;
                skript.onload = () => resolve(typeof THREE !== "undefined");
                skript.onerror = () => { Spielfeld3D._laden = null; resolve(false); };
                document.head.appendChild(skript);
            } catch (e) {
                Spielfeld3D._laden = null;
                resolve(false);
            }
        });
        return Spielfeld3D._laden;
    }

    /** Simulationskoordinaten in Meter: X entlang des Feldes, Z quer, Y nach oben */
    static welt(x, y) {
        return {
            x: (x - (S3D_TOR_LINKS + S3D_TOR_RECHTS) / 2) * (S3D_LAENGE / (S3D_TOR_RECHTS - S3D_TOR_LINKS)),
            z: (y - 50) * (S3D_BREITE / 100)
        };
    }

    constructor(canvas, optionen = {}) {
        this.canvas = canvas;
        this.qualitaet = Spielfeld3D.QUALITAET[optionen.qualitaet] ? optionen.qualitaet : "mittel";
        this.q = Spielfeld3D.QUALITAET[this.qualitaet];
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q.antialias, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, this.q.pixelRatio));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#0a1018");
        this.scene.fog = new THREE.Fog("#0a1018", 140, 260);

        this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 400);
        this.kamera = "tv";
        this._ziel = new THREE.Vector3(0, 0, 0);
        this._kamPos = new THREE.Vector3(0, 25, S3D_BREITE / 2 + 31);

        this._baueLicht();
        this._baueRasen();
        this._baueTore();
        this._baueStadion();
        this._baueBall();

        this.figuren = new Map();     // Spieler-ID -> Figur
        this.spielKey = null;
        this.zeit = 0;

        this._letzteAktion = 0;       // zuletzt gesehene Meldung der Regie
        this._aufnahme = [];          // die letzten Sekunden, für die Wiederholung
        this._wiederholung = null;
        this._bildzeiten = [];        // für die automatische Qualität
    }

    // ---------------------------------------------------------------- Aufbau

    _baueLicht() {
        this.scene.add(new THREE.HemisphereLight("#dbeafe", "#1f3b24", 1.15));
        const flutlicht = new THREE.DirectionalLight("#fff7e6", 1.6);
        flutlicht.position.set(-30, 70, 40);
        this.scene.add(flutlicht);
        const gegenlicht = new THREE.DirectionalLight("#c7d2fe", 0.55);
        gegenlicht.position.set(40, 50, -50);
        this.scene.add(gegenlicht);
    }

    /** Der Rasen als gezeichnete Textur: Mähstreifen und alle Linien in echten Maßen */
    _baueRasen() {
        const rand = 6;
        const breitePx = this.q.rasenPx;
        const meterPx = breitePx / (S3D_LAENGE + 2 * rand);
        const hoehePx = Math.round((S3D_BREITE + 2 * rand) * meterPx);
        const c = document.createElement("canvas");
        c.width = breitePx;
        c.height = hoehePx;
        const g = c.getContext("2d");
        const mx = (m) => (m + S3D_LAENGE / 2 + rand) * meterPx;
        const mz = (m) => (m + S3D_BREITE / 2 + rand) * meterPx;

        // Mähstreifen quer zum Feld
        const streifen = 14;
        for (let i = 0; i < streifen + 2; i++) {
            g.fillStyle = i % 2 ? "#2f7d3a" : "#2a7134";
            const x0 = mx(-S3D_LAENGE / 2 + (i - 1) * S3D_LAENGE / streifen);
            g.fillRect(x0, 0, S3D_LAENGE / streifen * meterPx + 1, hoehePx);
        }
        // Leichte Unruhe im Gras
        for (let i = 0; i < this.q.gras; i++) {
            g.fillStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${Math.random() * 0.035})`;
            g.fillRect(Math.random() * breitePx, Math.random() * hoehePx, 2, 2);
        }

        g.strokeStyle = "rgba(255,255,255,0.92)";
        g.lineWidth = Math.max(2, 0.12 * meterPx);
        const rechteck = (x0, z0, x1, z1) => g.strokeRect(mx(x0), mz(z0), mx(x1) - mx(x0), mz(z1) - mz(z0));
        const L = S3D_LAENGE / 2, B = S3D_BREITE / 2;
        rechteck(-L, -B, L, B);
        g.beginPath(); g.moveTo(mx(0), mz(-B)); g.lineTo(mx(0), mz(B)); g.stroke();
        g.beginPath(); g.arc(mx(0), mz(0), 9.15 * meterPx, 0, Math.PI * 2); g.stroke();
        const punkt = (x, z, r = 0.22) => { g.beginPath(); g.arc(mx(x), mz(z), r * meterPx, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,0.95)"; g.fill(); };
        punkt(0, 0);
        [-1, 1].forEach(seite => {
            const linie = seite * L;
            rechteck(Math.min(linie, linie - seite * 16.5), -20.16, Math.max(linie, linie - seite * 16.5), 20.16);
            rechteck(Math.min(linie, linie - seite * 5.5), -9.16, Math.max(linie, linie - seite * 5.5), 9.16);
            punkt(linie - seite * 11, 0);
            // Teilkreis am Strafraum
            const winkel = Math.acos(5.5 / 9.15);
            g.beginPath();
            if (seite < 0) g.arc(mx(linie + 11), mz(0), 9.15 * meterPx, -winkel, winkel);
            else g.arc(mx(linie - 11), mz(0), 9.15 * meterPx, Math.PI - winkel, Math.PI + winkel);
            g.stroke();
            // Eckbögen
            [-1, 1].forEach(oben => {
                g.beginPath();
                const start = seite < 0 ? (oben < 0 ? 0 : -Math.PI / 2) : (oben < 0 ? Math.PI / 2 : Math.PI);
                g.arc(mx(linie), mz(oben * B), 1 * meterPx, start, start + Math.PI / 2);
                g.stroke();
            });
        });

        const textur = new THREE.CanvasTexture(c);
        textur.colorSpace = THREE.SRGBColorSpace;
        textur.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        const rasen = new THREE.Mesh(
            new THREE.PlaneGeometry(S3D_LAENGE + 2 * rand, S3D_BREITE + 2 * rand),
            new THREE.MeshLambertMaterial({ map: textur })
        );
        rasen.rotation.x = -Math.PI / 2;
        this.scene.add(rasen);

        // Umrandung bis zu den Tribünen
        const umrandung = new THREE.Mesh(
            new THREE.PlaneGeometry(S3D_LAENGE + 40, S3D_BREITE + 40),
            new THREE.MeshLambertMaterial({ color: "#1d4d27" })
        );
        umrandung.rotation.x = -Math.PI / 2;
        umrandung.position.y = -0.02;
        this.scene.add(umrandung);
    }

    _baueTore() {
        const weiss = new THREE.MeshLambertMaterial({ color: "#f8fafc" });
        const netz = new THREE.LineBasicMaterial({ color: "#e2e8f0", transparent: true, opacity: 0.35 });
        const tiefe = 2.0, breite = 7.32, hoehe = 2.44, r = 0.06;
        [-1, 1].forEach(seite => {
            const tor = new THREE.Group();
            const pfosten = new THREE.CylinderGeometry(r, r, hoehe, 10);
            [-breite / 2, breite / 2].forEach(z => {
                const p = new THREE.Mesh(pfosten, weiss);
                p.position.set(0, hoehe / 2, z);
                tor.add(p);
            });
            const latte = new THREE.Mesh(new THREE.CylinderGeometry(r, r, breite, 10), weiss);
            latte.rotation.x = Math.PI / 2;
            latte.position.set(0, hoehe, 0);
            tor.add(latte);
            // Netz als Gitter: Rückwand, Dach, Seiten
            const punkte = [];
            const schritt = 0.35;
            for (let z = -breite / 2; z <= breite / 2 + 0.01; z += schritt) {
                punkte.push(seite * tiefe, 0, z, seite * tiefe, hoehe * 0.85, z);
                punkte.push(0, hoehe, z, seite * tiefe, hoehe * 0.85, z);
            }
            for (let y = 0; y <= hoehe * 0.85 + 0.01; y += schritt) {
                punkte.push(seite * tiefe, y, -breite / 2, seite * tiefe, y, breite / 2);
                [-breite / 2, breite / 2].forEach(z => punkte.push(0, Math.min(hoehe, y / 0.85), z, seite * tiefe, y, z));
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.Float32BufferAttribute(punkte, 3));
            tor.add(new THREE.LineSegments(geo, netz));
            tor.position.x = seite * S3D_LAENGE / 2;
            this.scene.add(tor);
        });
    }

    /** Tribünen mit Publikum, Dach und Flutlichtmasten */
    _baueStadion() {
        this.publikumTextur = this._publikumTextur(["#334155", "#64748b", "#94a3b8"]);
        this.publikum = new THREE.MeshLambertMaterial({ map: this.publikumTextur });
        const beton = new THREE.MeshLambertMaterial({ color: "#1e293b" });
        const dach = new THREE.MeshLambertMaterial({ color: "#0f172a" });
        const abstand = 6;
        const seiten = [
            { laenge: S3D_LAENGE + 24, pos: [0, 0, -(S3D_BREITE / 2 + abstand)], dreh: 0 },
            // Auf dieser Seite steht die Kamera - ohne Dach, sonst verdeckt es das Feld
            { laenge: S3D_LAENGE + 24, pos: [0, 0, S3D_BREITE / 2 + abstand], dreh: Math.PI, ohneDach: true },
            { laenge: S3D_BREITE + 10, pos: [-(S3D_LAENGE / 2 + abstand), 0, 0], dreh: Math.PI / 2 },
            { laenge: S3D_BREITE + 10, pos: [S3D_LAENGE / 2 + abstand, 0, 0], dreh: -Math.PI / 2 }
        ];
        seiten.forEach(s => {
            const tribuene = new THREE.Group();
            // Ränge als schräge Fläche
            const rang = new THREE.Mesh(new THREE.PlaneGeometry(s.laenge, 30, 1, 1), this.publikum);
            rang.rotation.x = -Math.PI / 2 + 0.62;
            rang.position.set(0, 9.5, -12.5);
            tribuene.add(rang);
            // Werbebande
            const bande = new THREE.Mesh(new THREE.BoxGeometry(s.laenge, 1.0, 0.3),
                new THREE.MeshLambertMaterial({ color: "#0b1220", emissive: "#14532d", emissiveIntensity: 0.35 }));
            bande.position.set(0, 0.5, 1.5);
            tribuene.add(bande);
            const sockel = new THREE.Mesh(new THREE.BoxGeometry(s.laenge, 2.2, 1.2), beton);
            sockel.position.set(0, 1.1, 0);
            tribuene.add(sockel);
            if (!s.ohneDach) {
                const dachPlatte = new THREE.Mesh(new THREE.BoxGeometry(s.laenge + 2, 0.6, 16), dach);
                dachPlatte.position.set(0, 23, -14);
                tribuene.add(dachPlatte);
            }
            tribuene.position.set(...s.pos);
            tribuene.rotation.y = s.dreh;
            this.scene.add(tribuene);
        });
        // Flutlichtmasten in den Ecken
        const mast = new THREE.MeshLambertMaterial({ color: "#475569" });
        const lampe = new THREE.MeshBasicMaterial({ color: "#fffbeb" });
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 42, 8), mast);
            m.position.set(sx * (S3D_LAENGE / 2 + 16), 21, sz * (S3D_BREITE / 2 + 16));
            this.scene.add(m);
            const l = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.6), lampe);
            l.position.set(sx * (S3D_LAENGE / 2 + 15), 42, sz * (S3D_BREITE / 2 + 15));
            l.lookAt(0, 0, 0);
            this.scene.add(l);
        });
    }

    /** Publikum als Punktgewimmel - in den Farben der beiden Vereine */
    _publikumTextur(farben) {
        const c = document.createElement("canvas");
        c.width = 1024;
        c.height = 256;
        const g = c.getContext("2d");
        g.fillStyle = "#111827";
        g.fillRect(0, 0, c.width, c.height);
        for (let reihe = 0; reihe < 32; reihe++) {
            for (let platz = 0; platz < 170; platz++) {
                const f = farben[Math.floor(Math.random() * farben.length)];
                g.fillStyle = Math.random() < 0.12 ? "#1f2937" : f;
                const x = platz * 6 + (reihe % 2) * 3 + Math.random() * 1.5;
                g.fillRect(x, reihe * 8 + 1, 4, 5);
            }
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.set(3, 1);
        return t;
    }

    _baueBall() {
        const c = document.createElement("canvas");
        c.width = 128; c.height = 64;
        const g = c.getContext("2d");
        g.fillStyle = "#f8fafc"; g.fillRect(0, 0, 128, 64);
        g.fillStyle = "#111827";
        [[16, 16], [56, 12], [96, 18], [32, 44], [76, 46], [116, 42]].forEach(([x, y]) => {
            g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
        });
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        // Etwas größer als in echt (0,11 m), sonst verschwindet er in der Totalen
        this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 12), new THREE.MeshLambertMaterial({ map: t }));
        this.scene.add(this.ball);
        this.ballSchatten = this._schatten(0.32);
        this.scene.add(this.ballSchatten);
    }

    _schatten(radius) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 16),
            new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.35, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.02;
        return m;
    }

    // ---------------------------------------------------------------- Figuren

    _hash(text) {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0) / 4294967296;
    }

    _figur(p, kit, istTorwart) {
        const hemd = new THREE.MeshLambertMaterial({ color: istTorwart ? (kit?.tw || "#facc15") : (p.color || kit?.farbe || "#3b82f6") });
        const hose = new THREE.MeshLambertMaterial({ color: istTorwart ? "#111827" : (kit?.zweit || "#f8fafc") });
        const haut = new THREE.MeshLambertMaterial({ color: ["#f1c7a3", "#d9a77c", "#a26b47", "#6b4430"][Math.floor(this._hash(String(p.id)) * 4)] });
        const schuh = new THREE.MeshLambertMaterial({ color: "#0f172a" });

        const figur = new THREE.Group();
        const koerper = new THREE.Group();
        figur.add(koerper);

        const t = this.q.teile;
        const n = (zahl) => Math.max(4, Math.round(zahl * t));
        const rumpf = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, Math.max(2, Math.round(4 * t)), n(10)), hemd);
        rumpf.position.y = 1.22;
        koerper.add(rumpf);
        const kopf = new THREE.Mesh(new THREE.SphereGeometry(0.15, n(12), n(10)), haut);
        kopf.position.y = 1.73;
        koerper.add(kopf);
        const huefte = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.21, 0.24, n(10)), hose);
        huefte.position.y = 0.88;
        koerper.add(huefte);

        const bein = (seite) => {
            const gelenk = new THREE.Group();
            gelenk.position.set(0, 0.84, seite * 0.11);
            const oberschenkel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.42, n(8)), hose);
            oberschenkel.position.y = -0.2;
            gelenk.add(oberschenkel);
            const unterschenkel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.42, n(8)), hemd);
            unterschenkel.position.y = -0.6;
            gelenk.add(unterschenkel);
            const fuss = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.1), schuh);
            fuss.position.set(0.05, -0.82, 0);
            gelenk.add(fuss);
            koerper.add(gelenk);
            return gelenk;
        };
        const arm = (seite) => {
            const gelenk = new THREE.Group();
            gelenk.position.set(0, 1.45, seite * 0.3);
            const a = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.55, n(8)), istTorwart ? hemd : haut);
            a.position.y = -0.27;
            gelenk.add(a);
            koerper.add(gelenk);
            return gelenk;
        };
        const schatten = this._schatten(0.42);
        this.scene.add(schatten);

        // Größe aus dem Spieler: 1,81 Meter ist der Durchschnitt
        const groesse = typeof p.groesse === "number" ? p.groesse / 181 : 1;
        figur.scale.setScalar(Math.max(0.9, Math.min(1.12, groesse)));

        this.scene.add(figur);
        return {
            figur, koerper, schatten,
            beine: [bein(-1), bein(1)], arme: [arm(-1), arm(1)],
            phase: this._hash(String(p.id) + "p") * Math.PI * 2,
            richtung: p.team === "home" ? 0 : Math.PI,
            name: p.name || "", label: null, gesehen: 0,
            // Der starke Fuß schießt: rechts ist das Bein auf der +z-Seite
            schussBein: p.foot === "links" ? 0 : 1,
            anim: null
        };
    }

    _label(text) {
        const c = document.createElement("canvas");
        c.width = 256; c.height = 64;
        const g = c.getContext("2d");
        g.font = "600 30px Inter, system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.lineWidth = 6;
        g.strokeStyle = "rgba(2,6,12,0.85)";
        g.strokeText(text, 128, 34);
        g.fillStyle = "#f8fafc";
        g.fillText(text, 128, 34);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
        sprite.scale.set(3.6, 0.9, 1);
        sprite.renderOrder = 10;
        this.scene.add(sprite);
        return sprite;
    }

    /** Ein neues Spiel: Figuren und Publikumsfarben neu aufbauen */
    _neuesSpiel(liveMatch) {
        this.figuren.forEach(f => {
            this.scene.remove(f.figur);
            this.scene.remove(f.schatten);
            if (f.label) this.scene.remove(f.label);
        });
        this.figuren.clear();
        const k = liveMatch.kits || {};
        const heim = k.home?.farbe || "#2563eb", gast = k.away?.farbe || "#dc2626";
        // Die Heimkurve ist voller - zwei Drittel tragen Heimfarben
        this.publikumTextur.dispose();
        this.publikumTextur = this._publikumTextur([heim, heim, heim, k.home?.zweit || "#f8fafc", gast, "#475569"]);
        this.publikum.map = this.publikumTextur;
        this.publikum.needsUpdate = true;
        this.spielKey = liveMatch;
        // Jedes Spiel zählt seine Meldungen von vorn
        this._letzteAktion = 0;
        this._aufnahme = [];
        this._wiederholung = null;
        this._torGeplant = null;
    }

    // ---------------------------------------------------------------- Zeichnen

    setzeKamera(art) {
        this.kamera = ["tv", "taktik", "nah"].includes(art) ? art : "tv";
    }

    groesse() {
        const w = this.canvas.clientWidth || this.canvas.parentElement?.clientWidth || 800;
        const h = this.canvas.clientHeight || Math.round(w * 0.6);
        if (this._w === w && this._h === h) return;
        this._w = w; this._h = h;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / Math.max(1, h);
        this.camera.updateProjectionMatrix();
    }

    /** Was die Simulation gerade zeigt - als einfache Daten, damit es sich aufnehmen lässt */
    _zustand(liveMatch) {
        const ball = liveMatch.ball || { x: 50, y: 50 };
        const spieler = (p, key) => ({
            key, id: p.id, team: p.team, pos: p.pos, name: p.name, x: p.x, y: p.y,
            vx: p.vx || 0, vy: p.vy || 0, speed: p.speed, verletzt: !!p.verletzt,
            color: p.color, groesse: p.groesse, foot: p.foot
        });
        const neu = (liveMatch.aktionen || []).filter(a => a.nr > this._letzteAktion);
        if (neu.length) this._letzteAktion = neu[neu.length - 1].nr;
        return {
            ball: { x: ball.x, y: ball.y, h: Math.max(0, ball.height || 0), flug: !!ball.inFlight },
            spieler: (liveMatch.players2D || []).map(p => spieler(p, p.id))
                .concat((liveMatch.abgaenge || []).map(a => spieler(a, "ab_" + a.team + "_" + a.number + "_" + a.name))),
            aktionen: neu,
            aktiv: liveMatch.activePlayerId,
            kits: liveMatch.kits || {}
        };
    }

    zeichne(liveMatch, dt = 0.016, optionen = {}) {
        if (!liveMatch) return;
        if (this.spielKey !== liveMatch) this._neuesSpiel(liveMatch);
        this.groesse();
        this._misst();

        // Während der Wiederholung steht die Simulation - gezeichnet wird die Aufnahme
        if (this._wiederholung) {
            this._spieleWiederholung(dt, optionen);
            return;
        }

        this.zeit += dt;
        const zustand = this._zustand(liveMatch);
        this._nimmAuf(zustand, dt);
        this._zeichneZustand(zustand, dt, optionen);

        // Nach dem Tor: erst jubeln, dann die Wiederholung
        if (this._torGeplant && this.zeit >= this._torGeplant.start) {
            const geplant = this._torGeplant;
            this._torGeplant = null;
            if (optionen.wiederholung !== false) this._starteWiederholung(geplant);
        }
    }

    _zeichneZustand(z, dt, optionen = {}) {
        const bw = Spielfeld3D.welt(z.ball.x, z.ball.y);
        const hoehe = z.ball.h * 6;
        this.ball.position.set(bw.x, 0.24 + hoehe, bw.z);
        this.ball.rotation.z -= (z.ball.flug ? 0.25 : 0.08);
        this.ballSchatten.position.set(bw.x + hoehe * 0.15, 0.02, bw.z + hoehe * 0.1);
        this.ballSchatten.material.opacity = Math.max(0.12, 0.38 - hoehe * 0.04);

        const namenAlle = optionen.namen !== false;
        const gesehen = ++this._takt || (this._takt = 1);

        z.spieler.forEach(p => {
            let f = this.figuren.get(p.key);
            if (!f) {
                f = this._figur(p, z.kits[p.team], p.pos === "TW");
                this.figuren.set(p.key, f);
            }
            f.gesehen = gesehen;
        });
        // Neue Meldungen der Regie werden zu Bewegungen
        z.aktionen.forEach(a => this._starteAktion(a, z));

        z.spieler.forEach(p => {
            const f = this.figuren.get(p.key);
            const w = Spielfeld3D.welt(p.x, p.y);
            f.figur.position.set(w.x, 0, w.z);
            f.schatten.position.set(w.x + 0.15, 0.02, w.z + 0.1);

            // Laufrichtung - im Stand schaut er zum Ball
            const tempo = Math.hypot(p.vx, p.vy);
            let ziel;
            if (tempo > 0.4) ziel = Math.atan2(-p.vy * (S3D_BREITE / 100), p.vx * (S3D_LAENGE / 92));
            else ziel = Math.atan2(-(bw.z - w.z), bw.x - w.x);
            let diff = ziel - f.richtung;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            f.richtung += diff * Math.min(1, dt * 8);
            f.figur.rotation.y = f.richtung;

            // Laufbewegung: Beine und Arme pendeln im Takt der Geschwindigkeit
            const lauf = Math.min(1, (p.speed ?? tempo) / 6);
            f.phase += dt * (5 + lauf * 9);
            const schwung = Math.sin(f.phase) * 0.75 * lauf;
            f.beine[0].rotation.z = schwung;
            f.beine[1].rotation.z = -schwung;
            f.arme[0].rotation.z = -schwung * 0.8;
            f.arme[1].rotation.z = schwung * 0.8;
            f.arme[0].rotation.x = 0;
            f.arme[1].rotation.x = 0;
            f.koerper.position.set(0, Math.abs(Math.sin(f.phase)) * 0.06 * lauf, 0);
            f.koerper.rotation.set(0, 0, -0.12 * lauf);
            f.figur.position.y = 0;
            // Angeschlagene humpeln sichtbar
            if (p.verletzt) f.koerper.rotation.x = Math.sin(this.zeit * 6) * 0.08;
            // Ein Bewegungsablauf überlagert das Laufen
            if (f.anim) this._pose(f, dt);

            // Namen: alle, oder nur wer am Ball ist
            const zeigeName = namenAlle || p.id === z.aktiv;
            if (zeigeName) {
                if (!f.label) f.label = this._label((p.name || "").split(" ").pop());
                const abstand = this.camera.position.distanceTo(f.figur.position);
                // Auf niedriger Stufe nur nahe Namen - jeder kostet ein Bild
                f.label.visible = p.id === z.aktiv || abstand < this.q.namen * 4;
                f.label.position.set(w.x, 2.45 + f.figur.position.y, w.z);
                const k = Math.max(0.8, Math.min(2.2, abstand / 30));
                f.label.scale.set(3.6 * k, 0.9 * k, 1);
                f.label.material.opacity = p.id === z.aktiv ? 1 : 0.8;
            } else if (f.label) {
                f.label.visible = false;
            }
        });
        // Wer nicht mehr auf dem Platz ist, verschwindet
        this.figuren.forEach((f, k) => {
            if (f.gesehen === gesehen) return;
            this.scene.remove(f.figur);
            this.scene.remove(f.schatten);
            if (f.label) this.scene.remove(f.label);
            this.figuren.delete(k);
        });

        this._fuehreKamera(bw, hoehe, dt, z);
        this.renderer.render(this.scene, this.camera);
    }

    // ----------------------------------------------------------- Bewegungen

    /** Dauer der Bewegungsabläufe in Sekunden */
    static DAUER = { pass: 0.45, schuss: 0.6, flanke: 0.6, kopfball: 0.7, zweikampf: 0.85, parade: 1.1, jubel: 3.2 };

    _figurVon(z, id) {
        const p = z.spieler.find(s => s.id === id);
        return p ? { p, f: this.figuren.get(p.key) } : null;
    }

    _starteAktion(a, z) {
        const ziel = this._figurVon(z, a.id);
        if (!ziel || !ziel.f) return;
        const { p, f } = ziel;
        if (a.art === "tor") {
            // Der Schütze jubelt, die Mitspieler in der Nähe mit
            f.anim = { art: "jubel", t: 0, dauer: Spielfeld3D.DAUER.jubel, knie: this._hash(String(a.id) + a.nr) < 0.35 };
            z.spieler.forEach(m => {
                if (m.team !== p.team || m.id === p.id || m.pos === "TW") return;
                if (Math.hypot(m.x - p.x, m.y - p.y) > 22) return;
                const fm = this.figuren.get(m.key);
                if (fm) fm.anim = { art: "jubel", t: -this._hash(String(m.id) + a.nr) * 0.6, dauer: Spielfeld3D.DAUER.jubel - 0.6 };
            });
            // Die Wiederholung beginnt, wenn der erste Jubel durch ist;
            // aufgenommen wird noch, bis der Ball im Netz liegt
            if (!this._wiederholung) this._torGeplant = { start: this.zeit + 2.4, team: p.team, schuetze: p.id };
            return;
        }
        const anim = { art: a.art, t: 0, dauer: Spielfeld3D.DAUER[a.art] || 0.5 };
        if (a.art === "parade") {
            anim.t = -(a.verzoegerung || 0);
            // Zu welcher Seite er fliegt - in seinem eigenen Blickfeld
            const w = Spielfeld3D.welt(p.x, p.y);
            const b = Spielfeld3D.welt(a.x ?? z.ball.x, a.y ?? z.ball.y);
            const seitlich = (b.x - w.x) * Math.sin(f.richtung) + (b.z - w.z) * Math.cos(f.richtung);
            anim.seite = seitlich >= 0 ? 1 : -1;
        }
        if (a.art === "zweikampf") anim.grätsche = this._hash(String(a.id) + a.nr) < 0.55;
        f.anim = anim;
    }

    /** Ein Bewegungsablauf als Gelenkwinkel über der Zeit */
    _pose(f, dt) {
        const a = f.anim;
        a.t += dt;
        if (a.t < 0) return;
        const t = Math.min(1, a.t / a.dauer);
        if (a.t >= a.dauer) { f.anim = null; return; }
        const bogen = Math.sin(Math.PI * t);
        const k = f.koerper;
        const bein = f.beine[f.schussBein], standbein = f.beine[1 - f.schussBein];

        if (a.art === "pass" || a.art === "schuss" || a.art === "flanke") {
            const kraft = a.art === "pass" ? 0.6 : 1;
            // Ausholen, durchschwingen, zurück
            // (Eine positive Drehung schwingt das Bein nach vorn)
            let w;
            if (t < 0.35) w = -0.8 * kraft * (t / 0.35);
            else if (t < 0.6) w = -0.8 * kraft + (0.8 + 1.4) * kraft * ((t - 0.35) / 0.25);
            else w = 1.4 * kraft * (1 - (t - 0.6) / 0.4);
            bein.rotation.z = w;
            standbein.rotation.z = -0.12 * bogen;
            k.rotation.z = 0.14 * kraft * bogen;
            // Der Gegenarm geht zur Seite - Arm 0 hebt sich mit positivem, Arm 1 mit negativem Winkel
            const gegenarm = 1 - f.schussBein;
            f.arme[gegenarm].rotation.x = (gegenarm === 0 ? 1 : -1) * 0.7 * bogen;
        } else if (a.art === "kopfball") {
            f.figur.position.y = 0.55 * bogen;
            k.rotation.z = -0.4 * Math.sin(Math.PI * Math.min(1, t * 1.3));
            f.beine[0].rotation.z = -0.35 * bogen;
            f.beine[1].rotation.z = -0.15 * bogen;
            f.arme[0].rotation.x = 0.9 * bogen;
            f.arme[1].rotation.x = -0.9 * bogen;
        } else if (a.art === "zweikampf") {
            if (a.grätsche) {
                // Grätsche: nach hinten kippen, das vordere Bein voraus, rutschen
                k.rotation.z = 1.15 * bogen;
                k.position.y = -0.55 * bogen;
                k.position.x = 1.1 * t;
                bein.rotation.z = 1.45 * bogen;
                standbein.rotation.z = 0.5 * bogen;
                f.arme[0].rotation.x = 0.6 * bogen;
                f.arme[1].rotation.x = -0.6 * bogen;
            } else {
                // Im Stehen: Ausfallschritt mit dem Fuß zum Ball
                bein.rotation.z = 1.0 * bogen;
                standbein.rotation.z = -0.35 * bogen;
                k.rotation.z = -0.25 * bogen;
            }
        } else if (a.art === "parade") {
            // Abheben, zur Seite fliegen, landen und kurz liegen bleiben
            const flug = Math.min(1, t * 2.4);
            k.rotation.x = a.seite * 1.3 * flug;
            k.position.z = a.seite * 1.6 * Math.min(1, t * 1.7);
            k.position.y = -0.2 * flug;
            f.figur.position.y = 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.5));
            // Die Arme über den Kopf - mit dem gekippten Körper zeigen sie zur Flugseite
            f.arme[0].rotation.x = 2.9 * flug;
            f.arme[1].rotation.x = -2.9 * flug;
            f.beine[0].rotation.z = 0.2 * flug;
            f.beine[1].rotation.z = -0.2 * flug;
        } else if (a.art === "jubel") {
            const an = Math.min(1, t * 6) * Math.min(1, (1 - t) * 6);
            f.arme[0].rotation.x = 2.6 * an;
            f.arme[1].rotation.x = -2.6 * an;
            if (a.knie) {
                // Auf den Knien über den Rasen
                k.position.y = -0.45 * an;
                k.rotation.z = 0.35 * an;
                f.beine[0].rotation.z = f.beine[1].rotation.z = -1.2 * an;
            } else {
                f.figur.position.y = Math.abs(Math.sin(a.t * 7)) * 0.28 * an;
            }
        }
    }

    // --------------------------------------------------------- Wiederholung

    /** Die letzten Sekunden mitschreiben - mehr braucht die Wiederholung nicht */
    _nimmAuf(zustand, dt) {
        this._aufnahme.push({ dt, z: zustand });
        let summe = 0;
        for (let i = this._aufnahme.length - 1; i >= 0; i--) {
            summe += this._aufnahme[i].dt;
            if (summe > Spielfeld3D.AUFNAHME_SEKUNDEN) { this._aufnahme.splice(0, i); break; }
        }
    }

    static AUFNAHME_SEKUNDEN = 10;
    static WIEDERHOLUNG = { vorTor: 5.5, nachTor: 0.9, tempo: 0.6 };

    _starteWiederholung(geplant) {
        // Ab einigen Sekunden vor dem Tor bis kurz danach
        const bis = this._aufnahme.length;
        let summe = 0, von = bis;
        const ende = this.zeit - (2.4 - Spielfeld3D.WIEDERHOLUNG.nachTor);
        let zeitpunkt = this.zeit;
        const bilder = [];
        for (let i = bis - 1; i >= 0; i--) {
            zeitpunkt -= this._aufnahme[i].dt;
            if (zeitpunkt > ende) continue;
            summe += this._aufnahme[i].dt;
            bilder.unshift(this._aufnahme[i]);
            von = i;
            if (summe > Spielfeld3D.WIEDERHOLUNG.vorTor + Spielfeld3D.WIEDERHOLUNG.nachTor) break;
        }
        if (bilder.length < 10) return;
        // Wer jetzt jubelt, steht in der Wiederholung wieder mittendrin
        this.figuren.forEach(f => { f.anim = null; });
        // Die Kamera steht hinter dem Tor, in dem der Ball am Ende liegt -
        // fest für die ganze Wiederholung, auch wenn der Angriff in der
        // anderen Hälfte beginnt
        const imNetz = bilder[bilder.length - 1].z.ball;
        const seite = Spielfeld3D.welt(imNetz.x, imNetz.y).x >= 0 ? 1 : -1;
        this._wiederholung = { bilder, i: 0, rest: 0, team: geplant.team, start: von, seite };
    }

    wiederholungLaeuft() {
        return !!this._wiederholung;
    }

    beendeWiederholung() {
        this._wiederholung = null;
        this.figuren.forEach(f => { f.anim = null; });
    }

    _spieleWiederholung(dt, optionen) {
        const w = this._wiederholung;
        w.rest += dt * Spielfeld3D.WIEDERHOLUNG.tempo;
        let bild = w.bilder[w.i];
        let schritte = 0;
        while (bild && w.rest >= bild.dt) {
            w.rest -= bild.dt;
            w.i++;
            schritte++;
            const naechstes = w.bilder[w.i];
            // Auch die Bewegungen der übersprungenen Bilder abspielen
            if (naechstes && schritte > 1) naechstes.z = Object.assign({}, naechstes.z, { aktionen: bild.z.aktionen.concat(naechstes.z.aktionen) });
            bild = naechstes;
        }
        if (!bild) { this.beendeWiederholung(); return; }
        // Jedes Bild nur einmal: Bewegungen nicht doppelt auslösen
        const z = schritte ? bild.z : Object.assign({}, bild.z, { aktionen: [] });
        this.zeit += dt * Spielfeld3D.WIEDERHOLUNG.tempo;
        this._zeichneZustand(z, dt * Spielfeld3D.WIEDERHOLUNG.tempo, Object.assign({}, optionen, { namen: false }));
    }

    // ------------------------------------------------------------- Kamera

    /** Die Kamera folgt dem Ball - weich, nie ruckartig */
    _fuehreKamera(bw, hoehe, dt, z) {
        const k = Math.min(1, dt * 2.2);
        const zielX = Math.max(-40, Math.min(40, bw.x));
        let pos, blick, fov;
        if (this._wiederholung) {
            // Hinter dem Tor, auf das der Schütze spielte, leicht erhöht
            const seite = this._wiederholung.seite;
            pos = new THREE.Vector3(seite * (S3D_LAENGE / 2 + 13), 7.5, bw.z * 0.4);
            blick = new THREE.Vector3(bw.x - seite * 4, 1 + hoehe * 0.3, bw.z);
            fov = 40;
        } else if (this.kamera === "taktik") {
            pos = new THREE.Vector3(zielX * 0.35, 78, 52);
            blick = new THREE.Vector3(zielX * 0.35, 0, 2);
            fov = 34;
        } else if (this.kamera === "nah") {
            pos = new THREE.Vector3(bw.x - 2, 9, bw.z + 22);
            blick = new THREE.Vector3(bw.x, 1 + hoehe * 0.3, bw.z);
            fov = 34;
        } else {
            // Übertragung: oben auf der Haupttribüne, schwenkt mit dem Ball
            pos = new THREE.Vector3(zielX * 0.62, 25, S3D_BREITE / 2 + 31);
            blick = new THREE.Vector3(zielX, 0, bw.z * 0.45);
            fov = 27;
        }
        // Zur Wiederholung springt die Kamera, statt quer durchs Stadion zu fliegen
        const sprung = !!this._wiederholung !== !!this._warWiederholung;
        this._warWiederholung = !!this._wiederholung;
        if (sprung) { this._kamPos.copy(pos); this._ziel.copy(blick); }
        this._kamPos.lerp(pos, k);
        this._ziel.lerp(blick, Math.min(1, dt * 3));
        if (sprung) this.camera.fov = fov;
        if (Math.abs(this.camera.fov - fov) > 0.05) {
            this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
        }
        this.camera.updateProjectionMatrix();
        this.camera.position.copy(this._kamPos);
        this.camera.lookAt(this._ziel);
    }

    // -------------------------------------------------- Automatische Qualität

    /** Sekunden: Anlauf ohne Messung, Messfenster; Grenze = Bildzeit im Median */
    static MESSUNG = { anlauf: 1, fenster: 3, grenze: 0.05 };

    /** Sekunden seit Seitenstart (in Tests ersetzbar) */
    static uhr() {
        return (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    }

    /**
     * Die Zeit zwischen zwei Bildern mitschreiben. Läuft die Ansicht über
     * drei Sekunden mit weniger als zwanzig Bildern je Sekunde, meldet
     * zuLangsam() das - die Oberfläche schaltet dann eine Stufe herunter.
     * Gemessen wird nach Zeit, nicht nach Bildern: Bei fünf Bildern je
     * Sekunde stünde das Urteil sonst erst nach einer halben Minute fest.
     * Die erste Sekunde zählt nicht (Shader übersetzen, Texturen laden).
     * Die Zeit kommt von der eigenen Uhr: Die Bildzeit, die das Livespiel
     * übergibt, ist gekappt und liefe bei Ruckeln zu langsam.
     */
    _misst() {
        const jetzt = Spielfeld3D.uhr();
        const vorher = this._letztesBild;
        this._letztesBild = jetzt;
        if (vorher === undefined) return;
        const dt = Math.max(0, Math.min(1, jetzt - vorher));
        this._anlauf = (this._anlauf || 0) + dt;
        if (this._anlauf < Spielfeld3D.MESSUNG.anlauf) return;
        this._bildzeiten.push(dt);
        this._messSumme = (this._messSumme || 0) + dt;
        while (this._bildzeiten.length > 10 && this._messSumme - this._bildzeiten[0] >= Spielfeld3D.MESSUNG.fenster) {
            this._messSumme -= this._bildzeiten.shift();
        }
    }

    zuLangsam() {
        if ((this._messSumme || 0) < Spielfeld3D.MESSUNG.fenster || this._bildzeiten.length < 10) return false;
        const sortiert = this._bildzeiten.slice().sort((a, b) => a - b);
        return sortiert[Math.floor(sortiert.length / 2)] > Spielfeld3D.MESSUNG.grenze;
    }

    entsorgen() {
        this.renderer.dispose();
        // Den Grafikspeicher sofort freigeben, nicht erst beim Aufräumen des Browsers
        if (typeof this.renderer.forceContextLoss === "function") this.renderer.forceContextLoss();
    }
}

if (typeof window !== "undefined") {
    window.Spielfeld3D = Spielfeld3D;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { Spielfeld3D };
}
