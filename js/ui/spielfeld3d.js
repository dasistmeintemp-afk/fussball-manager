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
 * Die Spieler sind Figuren in den Trikotfarben des Spiels: Rumpf mit
 * Rückennummer, Kopf mit Haaren, Arme, Beine mit Stutzen und Schuhen. Jedes
 * Glied ist ein einziges Netz mit Farben je Ecke - so kostet eine Figur sechs
 * statt zwanzig Zeichenaufrufe. Sie laufen mit, pendeln die Beine im Takt
 * ihrer Geschwindigkeit und schauen dorthin, wohin sie laufen - oder zum Ball.
 * Was sie tun, meldet die Regie (LiveMatchDirector.meldeAktion): Pass,
 * Schuss, Flanke, Kopfball, Zweikampf, Parade, Tor. Dazu gibt es je einen
 * Bewegungsablauf, aus Gelenkwinkeln gerechnet statt aus fertigen Modellen.
 *
 * Das Stadion richtet sich nach dem Heimverein: Ein kleiner Platz hat eine
 * niedrige Tribüne mit Lücken im Publikum, eine große Arena zwei Ränge unter
 * dem Dach. Himmel, Licht und Niederschlag kommen aus dem Wetter der Partie;
 * die Sonne wirft echte Schatten.
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
     * Bildschirm hat, ohne Kantenglättung und ohne Schatten - für schwache
     * Telefone. "schatten" ist die Kantenlänge der Schattenkarte, "glanz"
     * ein leichter Lichtschein um helle Flächen, "ao" die Verdunkelung
     * in Ecken und unter den Füßen (Umgebungsverdeckung).
     */
    static QUALITAET = {
        niedrig: { pixelRatio: 0.8, antialias: false, rasenPx: 1024, gras: 2500, teile: 0.6, namen: 12, schatten: 0, niederschlag: 600, glanz: false, ao: false },
        mittel: { pixelRatio: 1.25, antialias: true, rasenPx: 2048, gras: 9000, teile: 1, namen: 22, schatten: 2048, niederschlag: 1600, glanz: true, ao: false },
        hoch: { pixelRatio: 2, antialias: true, rasenPx: 4096, gras: 30000, teile: 1.4, namen: 22, schatten: 4096, niederschlag: 3200, glanz: true, ao: true }
    };

    /**
     * Himmel und Licht je Wetter: Farbe oben und am Horizont, Stärke von
     * Sonne und Himmelslicht, Sichtweite, wie hell das Flutlicht leuchtet
     * und wie viele Wolken ziehen.
     */
    static STIMMUNG = {
        sonnig: { oben: "#2c6bb8", horizont: "#bfd8ee", sonne: 2.2, himmel: 0.95, licht: "#fff1d9", nebel: [190, 520], flutlicht: 0.12, wolken: 0.2 },
        hitze: { oben: "#3b78be", horizont: "#eadfc6", sonne: 2.5, himmel: 0.9, licht: "#ffe7c2", nebel: [170, 480], flutlicht: 0.08, wolken: 0.05 },
        bewoelkt: { oben: "#5b6a7d", horizont: "#c5cdd6", sonne: 1.15, himmel: 1.55, licht: "#eef2f7", nebel: [160, 460], flutlicht: 0.45, wolken: 0.9 },
        wind: { oben: "#4f6b8a", horizont: "#c8d5e2", sonne: 1.9, himmel: 1.25, licht: "#f6f8fb", nebel: [170, 480], flutlicht: 0.3, wolken: 0.65 },
        regen: { oben: "#242c38", horizont: "#5a6370", sonne: 0.95, himmel: 1.2, licht: "#dfe6ee", nebel: [120, 360], flutlicht: 1, wolken: 1, niederschlag: "regen", dichte: 1, nass: true },
        starkregen: { oben: "#181e27", horizont: "#434b57", sonne: 0.85, himmel: 1.1, licht: "#dfe6ee", nebel: [85, 280], flutlicht: 1, wolken: 1, niederschlag: "regen", dichte: 2, nass: true },
        schnee: { oben: "#6c7888", horizont: "#d6dde5", sonne: 1.0, himmel: 1.5, licht: "#eef2f7", nebel: [95, 320], flutlicht: 0.85, wolken: 1, niederschlag: "schnee", dichte: 1 }
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

    /** Ein fester Zufall aus einem Startwert - dieselbe Kulisse bei jedem Aufbau */
    static zufall(saat) {
        let s = saat >>> 0;
        return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    }

    constructor(canvas, optionen = {}) {
        this.canvas = canvas;
        this.qualitaet = Spielfeld3D.QUALITAET[optionen.qualitaet] ? optionen.qualitaet : "mittel";
        this.q = Spielfeld3D.QUALITAET[this.qualitaet];
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q.antialias, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, this.q.pixelRatio));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Filmische Tonwerte: helle Trikots in der Sonne brennen nicht aus
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        if (this.q.schatten) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog("#bfd8ee", 190, 520);

        // Namensschilder liegen obenauf, nach der Nachbearbeitung gezeichnet
        this.overlay = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 1200);
        this.kamera = "tv";
        this._ziel = new THREE.Vector3(0, 0, 0);
        this._kamPos = new THREE.Vector3(0, 19, S3D_BREITE / 2 + 28);

        this._baueLicht();
        this._baueHimmel();
        this._baueRasen();
        this._baueTore();
        this._baueBall();
        this._baueMarkierung();
        this._stimmung("sonnig");
        this._baueStadion({});
        this._baueNachbearbeitung();

        this.figuren = new Map();     // Spieler-ID -> Figur
        this.spielKey = null;
        this.zeit = 0;

        this._letzteAktion = 0;       // zuletzt gesehene Meldung der Regie
        this._aufnahme = [];          // die letzten Sekunden, für die Wiederholung
        this._wiederholung = null;
        this._bildzeiten = [];        // für die automatische Qualität
    }

    // ---------------------------------------------------------------- Aufbau

    /**
     * Nachbearbeitung, wo die Qualität es hergibt: Das Bild entsteht in
     * einem Zwischenspeicher mit vierfacher Kantenglättung, darauf die
     * Umgebungsverdeckung (dunkle Kontaktzonen unter den Füßen, zwischen
     * den Körpern, an Toren und Tribünen) und ein leichter Lichtschein um
     * Flutlicht und Banden. Zuletzt Tonwerte und Farbraum.
     */
    _baueNachbearbeitung() {
        const N = THREE.Nachbearbeitung;
        if (!N || !(this.q.ao || this.q.glanz)) return;
        try {
            const ziel = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.q.antialias ? 4 : 0 });
            const c = new N.EffectComposer(this.renderer, ziel);
            c.addPass(new N.RenderPass(this.scene, this.camera));
            if (this.q.ao) {
                this.aoPass = new N.HBAOPass(this.scene, this.camera, 1, 1);
                this.aoPass.updateHbaoMaterial({ radius: 0.8, distanceExponent: 1.6, bias: 0.02, samples: 16 });
                // Lichthöfe sind flache Bilder, keine Körper: Sie werfen keine Verdeckung
                const verbergen = this.aoPass.overrideVisibility.bind(this.aoPass);
                this.aoPass.overrideVisibility = () => {
                    verbergen();
                    this.scene.traverse(o => { if (o.isSprite) o.visible = false; });
                };
                c.addPass(this.aoPass);
            }
            if (this.q.glanz) c.addPass(new N.UnrealBloomPass(new THREE.Vector2(256, 256), 0.18, 0.4, 0.94));
            c.addPass(new N.OutputPass());
            this.composer = c;
        } catch (e) {
            console.warn("3D-Nachbearbeitung nicht möglich:", e);
            this.composer = null;
        }
    }

    _baueLicht() {
        this.himmelLicht = new THREE.HemisphereLight("#dbe8ff", "#2b4a26", 0.95);
        this.scene.add(this.himmelLicht);
        // Die Sonne steht hinter der Kamera, etwas links: Die Schatten fallen
        // vom Betrachter weg und bleiben neben den Figuren zu sehen
        this.sonne = new THREE.DirectionalLight("#fff1d9", 2.7);
        this.sonne.position.set(-38, 80, 52);
        if (this.q.schatten) {
            this.sonne.castShadow = true;
            const s = this.sonne.shadow;
            s.mapSize.set(this.q.schatten, this.q.schatten);
            Object.assign(s.camera, { left: -72, right: 72, top: 56, bottom: -56, near: 20, far: 220 });
            s.camera.updateProjectionMatrix();
            s.bias = -0.0004;
            s.normalBias = 0.025;
        }
        this.scene.add(this.sonne);
        this.scene.add(this.sonne.target);
        const gegenlicht = new THREE.DirectionalLight("#c7d2fe", 0.45);
        gegenlicht.position.set(40, 50, -50);
        this.scene.add(gegenlicht);
    }

    /** Eine Kuppel mit Farbverlauf und Wolken - nur Hintergrund, ohne Nebel */
    _baueHimmel() {
        this.himmel = new THREE.Mesh(
            new THREE.SphereGeometry(900, 32, 16),
            new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false })
        );
        this.himmel.renderOrder = -1;
        this.scene.add(this.himmel);
    }

    _himmelTextur(s) {
        const c = document.createElement("canvas");
        c.width = 1024; c.height = 512;
        const g = c.getContext("2d");
        const verlauf = g.createLinearGradient(0, 0, 0, c.height);
        verlauf.addColorStop(0, s.oben);
        verlauf.addColorStop(0.47, s.horizont);
        verlauf.addColorStop(0.5, s.horizont);
        verlauf.addColorStop(1, "#1b2430");
        g.fillStyle = verlauf;
        g.fillRect(0, 0, c.width, c.height);
        // Wolken knapp über dem Horizont, flach gedrückt
        const zufall = Spielfeld3D.zufall(77);
        const anzahl = Math.round(60 * s.wolken);
        for (let i = 0; i < anzahl; i++) {
            const x = zufall() * c.width, y = c.height * (0.22 + zufall() * 0.24), r = 30 + zufall() * 90;
            const w = g.createRadialGradient(x, y, 0, x, y, r);
            const hell = s.wolken > 0.8 ? "200,206,214" : "255,255,255";
            w.addColorStop(0, `rgba(${hell},${0.22 + zufall() * 0.2})`);
            w.addColorStop(1, `rgba(${hell},0)`);
            g.fillStyle = w;
            g.save(); g.translate(x, y); g.scale(1, 0.32); g.translate(-x, -y);
            g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
            g.restore();
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.set(2, 1);
        return t;
    }

    /**
     * Das Wetter der Partie: Himmel, Sonne, Sichtweite, nasser Rasen und
     * Niederschlag. Ohne Wetter scheint die Sonne.
     */
    _stimmung(art) {
        const s = Spielfeld3D.STIMMUNG[art] || Spielfeld3D.STIMMUNG.sonnig;
        this.stimmung = s;
        if (this.himmel) {
            if (this.himmel.material.map) this.himmel.material.map.dispose();
            this.himmel.material.map = this._himmelTextur(s);
            this.himmel.material.needsUpdate = true;
        }
        this.scene.background = new THREE.Color(s.horizont);
        this.scene.fog.color.set(s.horizont);
        [this.scene.fog.near, this.scene.fog.far] = s.nebel;
        this.sonne.intensity = s.sonne;
        this.sonne.color.set(s.licht);
        this.himmelLicht.intensity = s.himmel;
        // Nass glänzt der Rasen
        if (this.rasenMat) this.rasenMat.roughness = s.nass ? 0.6 : 0.93;
        this._baueNiederschlag(s);
    }

    _baueNiederschlag(s) {
        if (this.niederschlag) {
            this.scene.remove(this.niederschlag.mesh);
            this.niederschlag.mesh.geometry.dispose();
            this.niederschlag.mesh.material.dispose();
            this.niederschlag = null;
        }
        if (!s.niederschlag) return;
        const regen = s.niederschlag === "regen";
        const anzahl = Math.round(this.q.niederschlag * (s.dichte || 1));
        const zufall = Spielfeld3D.zufall(11);
        const je = regen ? 6 : 3;
        const pos = new Float32Array(anzahl * je);
        for (let i = 0; i < anzahl; i++) {
            const x = (zufall() - 0.5) * 140, y = zufall() * 40, z = (zufall() - 0.5) * 90;
            pos.set(regen ? [x, y, z, x + 0.12, y + 0.9, z + 0.05] : [x, y, z], i * je);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        let mesh;
        if (regen) {
            mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: "#c9d4e2", transparent: true, opacity: 0.32, depthWrite: false }));
        } else {
            mesh = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#ffffff", size: 0.24, transparent: true, opacity: 0.9, depthWrite: false, map: this._punktTextur() }));
        }
        mesh.frustumCulled = false;
        this.scene.add(mesh);
        this.niederschlag = { mesh, regen, anzahl, je };
    }

    /** Niederschlag fällt um die Stelle, auf die die Kamera schaut */
    _bewegeNiederschlag(dt) {
        const n = this.niederschlag;
        if (!n) return;
        const a = n.mesh.geometry.attributes.position.array;
        const fall = n.regen ? 24 : 1.6;
        const wind = n.regen ? 2.4 : Math.sin(this.zeit * 0.6) * 0.8;
        const mx = this._ziel.x, mz = this._ziel.z;
        for (let i = 0; i < n.anzahl; i++) {
            const j = i * n.je;
            let x = a[j] + wind * dt, y = a[j + 1] - fall * dt, z = a[j + 2];
            if (!n.regen) x += Math.sin(this.zeit * 1.3 + i) * 0.25 * dt;
            // Fällt er unten heraus oder zu weit weg, setzt er oben neu ein
            if (y < 0) y += 40;
            if (x < mx - 70) x += 140; else if (x > mx + 70) x -= 140;
            if (z < mz - 45) z += 90; else if (z > mz + 45) z -= 90;
            a[j] = x; a[j + 1] = y; a[j + 2] = z;
            if (n.regen) { a[j + 3] = x + 0.12; a[j + 4] = y + 0.9; a[j + 5] = z + 0.05; }
        }
        n.mesh.geometry.attributes.position.needsUpdate = true;
    }

    _punktTextur() {
        const c = document.createElement("canvas");
        c.width = c.height = 32;
        const g = c.getContext("2d");
        const v = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        v.addColorStop(0, "rgba(255,255,255,1)");
        v.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = v;
        g.fillRect(0, 0, 32, 32);
        return new THREE.CanvasTexture(c);
    }

    /**
     * Der Rasen als gezeichnete Textur: Mähstreifen, feines Korn, abgespielte
     * Stellen vor den Toren und am Anstoßpunkt, alle Linien in echten Maßen.
     */
    _baueRasen() {
        const rand = 7;
        const breitePx = this.q.rasenPx;
        const meterPx = breitePx / (S3D_LAENGE + 2 * rand);
        const hoehePx = Math.round((S3D_BREITE + 2 * rand) * meterPx);
        const c = document.createElement("canvas");
        c.width = breitePx;
        c.height = hoehePx;
        const g = c.getContext("2d");
        const mx = (m) => (m + S3D_LAENGE / 2 + rand) * meterPx;
        const mz = (m) => (m + S3D_BREITE / 2 + rand) * meterPx;
        const L = S3D_LAENGE / 2, B = S3D_BREITE / 2;

        // Mähstreifen quer zum Feld, an den Kanten weich
        g.fillStyle = "#43703a";
        g.fillRect(0, 0, breitePx, hoehePx);
        const streifen = 18, sb = S3D_LAENGE / streifen * meterPx;
        for (let i = -1; i < streifen + 1; i++) {
            if (i % 2) continue;
            const x0 = mx(-L + i * S3D_LAENGE / streifen);
            const v = g.createLinearGradient(x0, 0, x0 + sb, 0);
            v.addColorStop(0, "rgba(28,58,22,0)");
            v.addColorStop(0.08, "rgba(24,48,20,0.17)");
            v.addColorStop(0.92, "rgba(24,48,20,0.17)");
            v.addColorStop(1, "rgba(28,58,22,0)");
            g.fillStyle = v;
            g.fillRect(x0, 0, sb, hoehePx);
        }
        // Abgespielt: vor den Toren, im Fünfer, am Anstoßpunkt
        const fleck = (x, z, r, farbe) => {
            const v = g.createRadialGradient(mx(x), mz(z), 0, mx(x), mz(z), r * meterPx);
            v.addColorStop(0, farbe);
            v.addColorStop(1, "rgba(0,0,0,0)");
            g.fillStyle = v;
            g.fillRect(mx(x) - r * meterPx, mz(z) - r * meterPx, 2 * r * meterPx, 2 * r * meterPx);
        };
        [-1, 1].forEach(seite => {
            fleck(seite * (L - 3), 0, 6, "rgba(150,138,88,0.2)");
            fleck(seite * (L - 11), 0, 4, "rgba(150,138,88,0.12)");
            fleck(seite * (L - 0.6), 0, 3, "rgba(140,124,80,0.24)");
        });
        fleck(0, 0, 5, "rgba(150,138,88,0.1)");
        // Feines Korn: jeder Bildpunkt etwas heller oder dunkler
        const zufall = Spielfeld3D.zufall(4242);
        const bild = g.getImageData(0, 0, breitePx, hoehePx);
        const d = bild.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (zufall() - 0.5) * 22;
            d[i] += n * 0.8; d[i + 1] += n; d[i + 2] += n * 0.55;
        }
        g.putImageData(bild, 0, 0);
        // Einzelne helle und dunkle Halme
        for (let i = 0; i < this.q.gras; i++) {
            g.fillStyle = zufall() < 0.5 ? `rgba(12,30,10,${zufall() * 0.18})` : `rgba(190,220,150,${zufall() * 0.1})`;
            g.fillRect(zufall() * breitePx, zufall() * hoehePx, 1.5, 3);
        }

        g.strokeStyle = "rgba(244,247,250,0.9)";
        g.lineWidth = Math.max(2, 0.12 * meterPx);
        const rechteck = (x0, z0, x1, z1) => g.strokeRect(mx(x0), mz(z0), mx(x1) - mx(x0), mz(z1) - mz(z0));
        rechteck(-L, -B, L, B);
        g.beginPath(); g.moveTo(mx(0), mz(-B)); g.lineTo(mx(0), mz(B)); g.stroke();
        g.beginPath(); g.arc(mx(0), mz(0), 9.15 * meterPx, 0, Math.PI * 2); g.stroke();
        const punkt = (x, z, r = 0.22) => { g.beginPath(); g.arc(mx(x), mz(z), r * meterPx, 0, Math.PI * 2); g.fillStyle = "rgba(244,247,250,0.92)"; g.fill(); };
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
        textur.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
        this.rasenMat = new THREE.MeshStandardMaterial({ map: textur, roughness: 0.93, metalness: 0 });
        const rasen = new THREE.Mesh(new THREE.PlaneGeometry(S3D_LAENGE + 2 * rand, S3D_BREITE + 2 * rand), this.rasenMat);
        rasen.rotation.x = -Math.PI / 2;
        rasen.receiveShadow = !!this.q.schatten;
        this.scene.add(rasen);

        // Der Boden bis unter die Tribünen
        const umrandung = new THREE.Mesh(
            new THREE.PlaneGeometry(S3D_LAENGE + 160, S3D_BREITE + 160),
            new THREE.MeshLambertMaterial({ color: "#2c5126" })
        );
        umrandung.rotation.x = -Math.PI / 2;
        umrandung.position.y = -0.03;
        this.scene.add(umrandung);
    }

    _baueTore() {
        const weiss = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.35 });
        const netz = new THREE.LineBasicMaterial({ color: "#f1f5f9", transparent: true, opacity: 0.5 });
        const tiefe = 2.0, breite = 7.32, hoehe = 2.44, r = 0.06;
        [-1, 1].forEach(seite => {
            const tor = new THREE.Group();
            const pfosten = new THREE.CylinderGeometry(r, r, hoehe, 12);
            [-breite / 2, breite / 2].forEach(z => {
                const p = new THREE.Mesh(pfosten, weiss);
                p.position.set(0, hoehe / 2, z);
                p.castShadow = !!this.q.schatten;
                tor.add(p);
            });
            const latte = new THREE.Mesh(new THREE.CylinderGeometry(r, r, breite + 2 * r, 12), weiss);
            latte.rotation.x = Math.PI / 2;
            latte.position.set(0, hoehe, 0);
            latte.castShadow = !!this.q.schatten;
            tor.add(latte);
            // Netzbügel hinten
            const buegel = new THREE.MeshStandardMaterial({ color: "#cbd5e1", roughness: 0.5 });
            [-breite / 2, breite / 2].forEach(z => {
                const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, hoehe * 0.85, 6), buegel);
                b.position.set(seite * tiefe, hoehe * 0.425, z);
                tor.add(b);
            });
            // Netz als Gitter: Rückwand, Dach, Seiten
            const punkte = [];
            const schritt = 0.25;
            for (let z = -breite / 2; z <= breite / 2 + 0.01; z += schritt) {
                punkte.push(seite * tiefe, 0, z, seite * tiefe, hoehe * 0.85, z);
                punkte.push(0, hoehe, z, seite * tiefe, hoehe * 0.85, z);
            }
            for (let y = 0; y <= hoehe * 0.85 + 0.01; y += schritt) {
                punkte.push(seite * tiefe, y, -breite / 2, seite * tiefe, y, breite / 2);
                [-breite / 2, breite / 2].forEach(z => punkte.push(0, Math.min(hoehe, y / 0.85), z, seite * tiefe, y, z));
            }
            for (let x = 0; x <= tiefe + 0.01; x += schritt) {
                const yo = hoehe - (hoehe * 0.15) * (x / tiefe);
                punkte.push(seite * x, yo, -breite / 2, seite * x, yo, breite / 2);
                [-breite / 2, breite / 2].forEach(z => punkte.push(seite * x, 0, z, seite * x, yo, z));
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.Float32BufferAttribute(punkte, 3));
            tor.add(new THREE.LineSegments(geo, netz));
            tor.position.x = seite * S3D_LAENGE / 2;
            this.scene.add(tor);
        });
        // Eckfahnen
        const stange = new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.5 });
        const fahne = new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.8, side: THREE.DoubleSide });
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
            const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), stange);
            s.position.set(sx * S3D_LAENGE / 2, 0.75, sz * S3D_BREITE / 2);
            this.scene.add(s);
            const f = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), fahne);
            f.position.set(sx * S3D_LAENGE / 2 - sx * 0.21, 1.33, sz * S3D_BREITE / 2);
            this.scene.add(f);
        });
    }

    /**
     * Das Stadion zum Heimverein. Bis 12.000 Plätze eine niedrige Tribüne
     * mit Dach nur über der Haupttribüne und offenen Ecken, bis 40.000 ein
     * hoher Rang ringsum, darüber zwei Ränge unter dem Dach. Die Seite der
     * Kamera bleibt niedrig und ohne Dach, sonst verdeckt sie das Feld.
     */
    _baueStadion({ kapazitaet = 30000, heim = {}, gast = {}, heimName = "Heim", gastName = "Gast", stadion = "" } = {}) {
        if (this.stadion) {
            this.scene.remove(this.stadion);
            this.stadion.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
                mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
            });
        }
        const gruppe = new THREE.Group();
        this.stadion = gruppe;
        this.publikumTexturen = [];
        const groesse = kapazitaet < 12000 ? "klein" : kapazitaet < 40000 ? "mittel" : "gross";
        const belegt = { klein: 0.62, mittel: 0.82, gross: 0.94 }[groesse];
        const heimFarbe = heim.farbe || "#2563eb", gastFarbe = gast.farbe || "#dc2626";
        const sitz = this._dunkler(heimFarbe, 0.45);
        const farben = [heimFarbe, heimFarbe, heimFarbe, heim.zweit || "#cbd5e1", "#1f2937", "#334155", "#64748b", "#475569", "#3f3f46"];
        const L = S3D_LAENGE / 2, B = S3D_BREITE / 2;
        const vorSeite = 7.5, vorTor = 9;
        const beton = new THREE.MeshLambertMaterial({ color: "#3b4250" });
        const betonHell = new THREE.MeshLambertMaterial({ color: "#6b7280" });
        const dachMat = new THREE.MeshLambertMaterial({ color: "#1e2633", side: THREE.DoubleSide });

        // Ränge je Größe: [Höhe, Tiefe] unten, dazu der obere Rang
        const unten = { klein: [5, 9], mittel: [12, 20], gross: [10, 16] }[groesse];
        const oben = groesse === "gross" ? { y0: 14, z0: -11, hoehe: 15, tiefe: 21 } : null;
        const tiefeGesamt = oben ? -oben.z0 + oben.tiefe : unten[1];
        const hoeheGesamt = oben ? oben.y0 + oben.hoehe : unten[0] + 1.4;

        const tribuene = (laenge, { kamera = false, dach = true, kurve = false } = {}) => {
            const t = new THREE.Group();
            const raenge = [{ y0: 1.4, z0: -0.4, hoehe: unten[0], tiefe: unten[1] }];
            if (oben && !kamera) raenge.push(oben);
            const topY = kamera ? unten[0] + 1.4 : hoeheGesamt;
            const hinten = kamera ? -(unten[1] + 0.4) : -(tiefeGesamt + 0.4);
            raenge.forEach((r, i) => {
                const schraeg = Math.hypot(r.hoehe, r.tiefe);
                const tex = this._publikumTextur(kurve && i === 0 ? [heimFarbe, heimFarbe, heim.zweit || "#f8fafc"] : farben,
                    kurve ? Math.min(1, belegt + 0.06) : belegt, sitz, i * 7 + laenge);
                tex.repeat.set(laenge / 24, schraeg / 12.8);
                this.publikumTexturen.push(tex);
                const rang = new THREE.Mesh(new THREE.PlaneGeometry(laenge, schraeg), new THREE.MeshLambertMaterial({ map: tex }));
                rang.rotation.x = -(Math.PI / 2 - Math.atan2(r.hoehe, r.tiefe));
                rang.position.set(0, r.y0 + r.hoehe / 2, r.z0 - r.tiefe / 2);
                t.add(rang);
                // Brüstung vor dem Rang
                const bruestung = new THREE.Mesh(new THREE.BoxGeometry(laenge, i === 0 ? 1.4 : 1.8, 0.4), i === 0 ? beton : this._bandMaterial(heimFarbe, heimName));
                bruestung.position.set(0, i === 0 ? 0.7 : r.y0 - 0.9, r.z0 + 0.2);
                t.add(bruestung);
            });
            // Rückwand und Seitenwände
            const rueck = new THREE.Mesh(new THREE.BoxGeometry(laenge, topY + 2, 0.6), beton);
            rueck.position.set(0, (topY + 2) / 2, hinten - 0.3);
            t.add(rueck);
            const profil = new THREE.Shape();
            profil.moveTo(0.4, 0);
            profil.lineTo(0.4, 1.4);
            raenge.forEach(r => { profil.lineTo(-r.z0, r.y0); profil.lineTo(-(r.z0 - r.tiefe), r.y0 + r.hoehe); });
            profil.lineTo(-hinten, topY + 2);
            profil.lineTo(-hinten, 0);
            profil.lineTo(0.4, 0);
            const seite = new THREE.ShapeGeometry(profil);
            [-1, 1].forEach(s => {
                const w = new THREE.Mesh(seite, betonHell);
                w.material = new THREE.MeshLambertMaterial({ color: "#59606b", side: THREE.DoubleSide });
                w.rotation.y = Math.PI / 2;
                w.position.x = s * laenge / 2;
                t.add(w);
            });
            if (dach && !kamera) {
                const dachY = topY + 3.5, tiefeDach = -hinten + 2;
                const platte = new THREE.Mesh(new THREE.BoxGeometry(laenge + 1, 0.5, tiefeDach), dachMat);
                platte.position.set(0, dachY, hinten + tiefeDach / 2);
                platte.rotation.x = 0.05;
                t.add(platte);
                const blende = new THREE.Mesh(new THREE.BoxGeometry(laenge + 1, 1.6, 0.4), new THREE.MeshLambertMaterial({ color: "#d9dee5" }));
                blende.position.set(0, dachY - 0.2 + Math.sin(0.05) * tiefeDach / 2, 2);
                t.add(blende);
                if (groesse === "gross") {
                    // Flutlicht unter dem Dachrand
                    const leiste = new THREE.Mesh(new THREE.BoxGeometry(laenge * 0.9, 0.3, 0.3),
                        new THREE.MeshBasicMaterial({ color: "#fffbeb", toneMapped: false }));
                    leiste.position.set(0, dachY - 1.2, 1.6);
                    t.add(leiste);
                    for (let x = -laenge * 0.42; x <= laenge * 0.42; x += 16) this._glanz(t, x, dachY - 1.2, 1.9, 9);
                }
                // Stützen
                for (let x = -laenge / 2 + 12; x < laenge / 2 - 6; x += 24) {
                    const stuetze = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, dachY - topY, 6), beton);
                    stuetze.position.set(x, topY + (dachY - topY) / 2, hinten + 1.5);
                    t.add(stuetze);
                }
            }
            return t;
        };

        const lang = S3D_LAENGE + 2 * vorTor + (groesse === "klein" ? 0 : 2 * tiefeGesamt * 0.9);
        const quer = S3D_BREITE + 2 * vorSeite;
        const teile = [
            // Haupttribüne gegenüber der Kamera
            { t: tribuene(lang, { dach: true }), pos: [0, 0, -(B + vorSeite)], dreh: 0 },
            { t: tribuene(lang, { kamera: true }), pos: [0, 0, B + vorSeite], dreh: Math.PI },
            // Hinter den Toren: links die Heimkurve
            { t: tribuene(quer, { dach: groesse !== "klein", kurve: true }), pos: [-(L + vorTor), 0, 0], dreh: Math.PI / 2 },
            { t: tribuene(quer, { dach: groesse !== "klein" }), pos: [L + vorTor, 0, 0], dreh: -Math.PI / 2 }
        ];
        teile.forEach(({ t, pos, dreh }) => {
            t.position.set(...pos);
            t.rotation.y = dreh;
            gruppe.add(t);
        });

        // Werbebanden: leuchtende Laufschrift mit den Vereinen und dem Stadion
        const banden = this._bandenMaterial([
            [heimName, heimFarbe, heim.text || "#ffffff"], [stadion || "Fair Play", "#0f172a", "#e2e8f0"],
            [gastName, gastFarbe, gast.text || "#ffffff"], ["Fair Play", "#14532d", "#f0fdf4"]
        ]);
        const bande = (laenge, x, z, dreh) => {
            const tex = banden.map.clone();
            tex.needsUpdate = true;
            tex.repeat.set(laenge / 40, 1);
            const m = new THREE.Mesh(new THREE.BoxGeometry(laenge, 0.9, 0.12), [beton, beton, beton, beton, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), beton]);
            m.position.set(x, 0.45, z);
            m.rotation.y = dreh;
            gruppe.add(m);
        };
        bande(S3D_LAENGE + 6, 0, -(B + 4), 0);
        bande(S3D_LAENGE + 6, 0, B + 4, Math.PI);
        bande(S3D_BREITE + 8, -(L + 5), 0, Math.PI / 2);
        bande(S3D_BREITE + 8, L + 5, 0, -Math.PI / 2);
        banden.map.dispose();

        // Flutlichtmasten in den Ecken - die große Arena hat sie im Dach
        if (groesse !== "gross") {
            const mast = new THREE.MeshLambertMaterial({ color: "#64748b" });
            const lampe = new THREE.MeshBasicMaterial({ color: "#fffbeb", toneMapped: false });
            const hoch = groesse === "klein" ? 26 : 42;
            [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
                const x = sx * (L + vorTor + tiefeGesamt * 0.5 + 4), z = sz * (B + vorSeite + tiefeGesamt * 0.5 + 4);
                const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, hoch, 8), mast);
                m.position.set(x, hoch / 2, z);
                gruppe.add(m);
                const l = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.6), lampe);
                l.position.set(x * 0.98, hoch, z * 0.98);
                l.lookAt(0, 0, 0);
                gruppe.add(l);
                this._glanz(gruppe, x * 0.97, hoch, z * 0.97, 18);
            });
        }
        this.scene.add(gruppe);
    }

    /** Ein Lichthof um eine Lampe - je dunkler das Wetter, desto heller */
    _glanz(gruppe, x, y, z, groesse) {
        if (typeof document === "undefined") return;
        if (!this._glanzTextur) {
            const c = document.createElement("canvas");
            c.width = c.height = 128;
            const g = c.getContext("2d");
            const v = g.createRadialGradient(64, 64, 0, 64, 64, 64);
            v.addColorStop(0, "rgba(255,250,232,1)");
            v.addColorStop(0.25, "rgba(255,246,214,0.45)");
            v.addColorStop(1, "rgba(255,246,214,0)");
            g.fillStyle = v;
            g.fillRect(0, 0, 128, 128);
            this._glanzTextur = new THREE.CanvasTexture(c);
        }
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this._glanzTextur, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
            opacity: Math.max(0.15, (this.stimmung?.flutlicht ?? 0.3)), toneMapped: false, fog: false
        }));
        s.position.set(x, y, z);
        s.scale.set(groesse, groesse, 1);
        gruppe.add(s);
    }

    _dunkler(hex, faktor) {
        const c = new THREE.Color(hex);
        c.multiplyScalar(faktor);
        return "#" + c.getHexString();
    }

    /** Das Band vor dem Oberrang: Vereinsfarbe mit dem Namen */
    _bandMaterial(farbe, name) {
        if (typeof document === "undefined") return new THREE.MeshLambertMaterial({ color: farbe });
        const c = document.createElement("canvas");
        c.width = 1024; c.height = 64;
        const g = c.getContext("2d");
        g.fillStyle = farbe;
        g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = "rgba(255,255,255,0.9)";
        g.font = "700 38px Inter, system-ui, sans-serif";
        g.textBaseline = "middle";
        for (let x = 20; x < c.width; x += 512) g.fillText(String(name).toUpperCase(), x, 34);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.repeat.set(6, 1);
        return new THREE.MeshLambertMaterial({ map: t });
    }

    /** Laufschrift der Werbebanden: Felder mit Text, nebeneinander */
    _bandenMaterial(felder) {
        const c = document.createElement("canvas");
        c.width = 2048; c.height = 64;
        const g = c.getContext("2d");
        const breite = c.width / felder.length;
        felder.forEach(([text, grund, schrift], i) => {
            g.fillStyle = grund;
            g.fillRect(i * breite, 0, breite, c.height);
            g.fillStyle = schrift;
            g.font = "800 34px Inter, system-ui, sans-serif";
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText(String(text).toUpperCase().slice(0, 26), i * breite + breite / 2, 34, breite - 30);
        });
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.anisotropy = 4;
        return { map: t };
    }

    /**
     * Publikum Reihe um Reihe: Kopf und Oberkörper, meist in den Farben des
     * Heimvereins, mal ein erhobener Schal. Freie Plätze zeigen den Sitz.
     */
    _publikumTextur(farben, belegt, sitz, saat = 1) {
        const c = document.createElement("canvas");
        c.width = 1024; c.height = 512;
        const g = c.getContext("2d");
        const reihen = 16, plaetze = 48, rh = c.height / reihen, pw = c.width / plaetze;
        const zufall = Spielfeld3D.zufall(9001 + Math.round(saat * 13));
        const haut = ["#f1c7a3", "#e0b48c", "#c68e63", "#8d5a3b", "#5e3b28"];
        for (let r = 0; r < reihen; r++) {
            const y0 = r * rh;
            g.fillStyle = "#1f2530";
            g.fillRect(0, y0, c.width, rh);
            g.fillStyle = "rgba(0,0,0,0.4)";
            g.fillRect(0, y0 + rh - 4, c.width, 4);
            for (let p = -1; p < plaetze; p++) {
                const x0 = p * pw + (r % 2) * pw * 0.5;
                if (zufall() > belegt) {
                    g.fillStyle = sitz;
                    g.fillRect(x0 + 3, y0 + rh * 0.42, pw - 6, rh * 0.46);
                    continue;
                }
                // Unter dem Dach und auf Abstand wirkt jede Farbe gedämpft
                const f = this._dunkler(farben[Math.floor(zufall() * farben.length)], 0.62 + zufall() * 0.25);
                const dx = (zufall() - 0.5) * 5, dy = (zufall() - 0.5) * 4;
                g.fillStyle = f;
                g.fillRect(x0 + 4 + dx, y0 + rh * 0.45 + dy, pw - 8, rh * 0.55);
                g.fillStyle = haut[Math.floor(zufall() * haut.length)];
                g.beginPath();
                g.arc(x0 + pw / 2 + dx, y0 + rh * 0.32 + dy, pw * 0.17, 0, Math.PI * 2);
                g.fill();
                if (zufall() < 0.07) {
                    g.fillStyle = f;
                    g.fillRect(x0 + pw / 2 - 3 + dx, y0 + 1 + dy, 6, rh * 0.32);
                }
            }
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 4;
        return t;
    }

    _baueBall() {
        const c = document.createElement("canvas");
        c.width = 256; c.height = 128;
        const g = c.getContext("2d");
        g.fillStyle = "#f8fafc"; g.fillRect(0, 0, 256, 128);
        g.fillStyle = "#111827";
        const fuenfeck = (x, y, r) => {
            g.beginPath();
            for (let i = 0; i < 5; i++) {
                const w = -Math.PI / 2 + i * Math.PI * 2 / 5;
                g[i ? "lineTo" : "moveTo"](x + Math.cos(w) * r, y + Math.sin(w) * r);
            }
            g.closePath(); g.fill();
        };
        [[32, 30], [96, 22], [160, 30], [224, 22], [64, 84], [128, 92], [192, 84], [0, 84], [256, 84]].forEach(([x, y]) => fuenfeck(x, y, 15));
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        // In echter Größe (0,11 m) - in der Totalen wächst er mit, sonst verschwindet er
        this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshStandardMaterial({ map: t, roughness: 0.45 }));
        this.ball.castShadow = !!this.q.schatten;
        this.scene.add(this.ball);
        this.ballSchatten = this._schatten(0.15);
        this.scene.add(this.ballSchatten);
    }

    /** Ein Ring unter dem Spieler am Ball */
    _baueMarkierung() {
        this.markierung = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.78, 32),
            new THREE.MeshBasicMaterial({ color: "#fde047", transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
        this.markierung.rotation.x = -Math.PI / 2;
        this.markierung.position.y = 0.03;
        this.markierung.visible = false;
        this.scene.add(this.markierung);
    }

    _schatten(radius) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 16),
            new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: this.q.schatten ? 0.22 : 0.35, depthWrite: false }));
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

    /**
     * Mehrere Grundkörper zu einem Netz mit Farben je Ecke verschmelzen.
     * teile: [{ geo, farbe, pos, dreh, skal }]
     */
    static verschmelze(teile) {
        const pos = [], nor = [], col = [];
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        const v = new THREE.Vector3(), s = new THREE.Vector3();
        teile.forEach(t => {
            const g = t.geo.index ? t.geo.toNonIndexed() : t.geo.clone();
            e.set(...(t.dreh || [0, 0, 0]));
            q.setFromEuler(e);
            m.compose(v.set(...(t.pos || [0, 0, 0])), q, s.set(...(t.skal || [1, 1, 1])));
            g.applyMatrix4(m);
            const p = g.attributes.position.array, n = g.attributes.normal.array;
            const f = new THREE.Color(t.farbe);
            for (let i = 0; i < p.length; i += 3) {
                pos.push(p[i], p[i + 1], p[i + 2]);
                nor.push(n[i], n[i + 1], n[i + 2]);
                col.push(f.r, f.g, f.b);
            }
            g.dispose();
            t.geo.dispose();
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
        geo.computeBoundingSphere();
        return geo;
    }

    /**
     * Eine Figur mit Skelett: vorn ist +x, die Schultern liegen quer (z).
     * Das Becken (koerper) trägt alles; darauf sitzt der Rumpf mit Kopf und
     * Armen, darunter hängen die Beine. Jedes Glied ist ein Netz, jedes
     * Gelenk eine Gruppe: Hüfte und Knie, Schulter und Ellbogen, Rumpf und
     * Nacken. Ein positiver Winkel um z schwingt ein Glied nach vorn.
     */
    _figur(p, kit, istTorwart) {
        if (!this._koerperMat) this._koerperMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0 });
        const h = (s) => this._hash(String(p.id) + s);
        const hemd = istTorwart ? (kit?.tw || "#facc15") : (p.color || kit?.farbe || "#3b82f6");
        const hose = istTorwart ? "#111827" : (kit?.zweit || "#f8fafc");
        const stutzen = istTorwart ? "#111827" : hemd;
        const haut = ["#f1c7a3", "#e3b28a", "#c68e63", "#8d5a3b", "#5e3b28"][Math.floor(h("haut") * 5)];
        const haar = ["#1c140f", "#3b2a1f", "#5a3d26", "#0b0b0b", "#a57a4a", "#d6b16b", "#2b2b2b"][Math.floor(h("haar") * 7)];
        const schuh = ["#0f172a", "#0f172a", "#f8fafc", "#ef4444", "#22c55e", "#f59e0b", "#0f172a"][Math.floor(h("schuh") * 7)];
        const handschuh = "#d9f99d";
        const t = this.q.teile;
        const n = (zahl) => Math.max(5, Math.round(zahl * t));
        const schatten = !!this.q.schatten;
        const netz = (teile) => {
            const m = new THREE.Mesh(Spielfeld3D.verschmelze(teile), this._koerperMat);
            m.castShadow = schatten;
            return m;
        };
        const gelenk = (eltern, x, y, z) => {
            const g = new THREE.Group();
            g.position.set(x, y, z);
            eltern.add(g);
            return g;
        };

        const figur = new THREE.Group();
        const koerper = new THREE.Group();
        figur.add(koerper);
        // Becken mit Hose
        koerper.add(netz([
            { geo: new THREE.CylinderGeometry(0.17, 0.185, 0.24, n(12)), farbe: hose, pos: [0, 0.92, 0], skal: [0.7, 1, 1] }
        ]));
        // Rumpf: dreht sich über dem Becken, neigt sich vor und zurück
        const rumpf = gelenk(koerper, 0, 1.0, 0);
        rumpf.add(netz([
            { geo: new THREE.CylinderGeometry(0.205, 0.165, 0.5, n(12)), farbe: hemd, pos: [0, 0.22, 0], skal: [0.62, 1, 1] },
            { geo: new THREE.CapsuleGeometry(0.085, 0.34, 2, n(8)), farbe: hemd, pos: [0, 0.45, 0], dreh: [Math.PI / 2, 0, 0], skal: [0.85, 1, 1] },
            { geo: new THREE.CylinderGeometry(0.052, 0.058, 0.1, n(8)), farbe: haut, pos: [0, 0.56, 0] }
        ]));
        const kopf = gelenk(rumpf, 0, 0.6, 0);
        kopf.add(netz([
            { geo: new THREE.SphereGeometry(0.112, n(14), n(10)), farbe: haut, pos: [0.005, 0.08, 0], skal: [1.04, 1.12, 0.94] },
            { geo: new THREE.SphereGeometry(0.119, n(14), n(6), 0, Math.PI * 2, 0, Math.PI * 0.52), farbe: haar, pos: [-0.008, 0.1, 0], skal: [1.06, 1.12, 0.98] }
        ]));
        // Rückennummer
        if (typeof document !== "undefined" && p.nummer) {
            const nummer = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), this._nummerMaterial(p.nummer, istTorwart ? (kit?.twText || "#111827") : (kit?.text || "#ffffff")));
            nummer.position.set(-0.122, 0.25, 0);
            nummer.rotation.y = -Math.PI / 2;
            rumpf.add(nummer);
        }

        const arme = [], ellbogen = [], beine = [], knie = [];
        [-1, 1].forEach(seite => {
            const schulter = gelenk(rumpf, 0, 0.44, seite * 0.25);
            schulter.add(netz([{ geo: new THREE.CylinderGeometry(0.058, 0.05, 0.3, n(8)), farbe: hemd, pos: [0, -0.15, 0] }]));
            const ell = gelenk(schulter, 0, -0.29, 0);
            ell.add(netz([
                { geo: new THREE.CylinderGeometry(0.047, 0.04, 0.26, n(8)), farbe: istTorwart ? hemd : haut, pos: [0, -0.13, 0] },
                { geo: new THREE.SphereGeometry(istTorwart ? 0.065 : 0.045, n(8), n(6)), farbe: istTorwart ? handschuh : haut, pos: [0, -0.3, 0] }
            ]));
            arme.push(schulter);
            ellbogen.push(ell);

            const huefte = gelenk(koerper, 0, 0.86, seite * 0.1);
            huefte.add(netz([
                { geo: new THREE.CylinderGeometry(0.09, 0.072, 0.42, n(8)), farbe: haut, pos: [0, -0.21, 0] },
                { geo: new THREE.CylinderGeometry(0.104, 0.098, 0.17, n(8)), farbe: hose, pos: [0, -0.07, 0] }
            ]));
            const kn = gelenk(huefte, 0, -0.42, 0);
            kn.add(netz([
                { geo: new THREE.CylinderGeometry(0.068, 0.05, 0.4, n(8)), farbe: stutzen, pos: [0, -0.2, 0] },
                { geo: new THREE.BoxGeometry(0.25, 0.075, 0.1), farbe: schuh, pos: [0.05, -0.4, 0] }
            ]));
            beine.push(huefte);
            knie.push(kn);
        });
        const blob = this._schatten(0.42);
        this.scene.add(blob);

        // Größe aus dem Spieler: 1,81 Meter ist der Durchschnitt
        const groesse = typeof p.groesse === "number" ? p.groesse / 181 : 1;
        figur.scale.setScalar(Math.max(0.9, Math.min(1.12, groesse)));

        this.scene.add(figur);
        return {
            figur, koerper, rumpf, kopf, schatten: blob,
            beine, knie, arme, ellbogen,
            phase: this._hash(String(p.id) + "p") * Math.PI * 2,
            richtung: p.team === "home" ? 0 : Math.PI,
            name: p.name || "", label: null, gesehen: 0,
            // Der starke Fuß schießt: rechts ist das Bein auf der +z-Seite
            schussBein: p.foot === "links" ? 0 : 1,
            anim: null
        };
    }

    _nummerMaterial(nummer, farbe) {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const g = c.getContext("2d");
        g.font = "800 46px Inter, system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = farbe;
        g.fillText(String(nummer), 32, 35);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
    }

    /** Namensschild: Nummer im Vereinsfeld, dahinter der Name */
    _label(text, nummer, kit, istTorwart) {
        const c = document.createElement("canvas");
        c.width = 320; c.height = 72;
        const g = c.getContext("2d");
        g.font = "600 30px Inter, system-ui, sans-serif";
        const breite = Math.min(c.width, (nummer ? 70 : 24) + g.measureText(text).width + 20);
        const x0 = (c.width - breite) / 2;
        g.fillStyle = "rgba(8,12,18,0.74)";
        g.beginPath();
        if (g.roundRect) g.roundRect(x0, 8, breite, 56, 16); else g.rect(x0, 8, breite, 56);
        g.fill();
        let x = x0 + 14;
        if (nummer) {
            g.fillStyle = istTorwart ? (kit?.tw || "#facc15") : (kit?.farbe || "#2563eb");
            g.beginPath();
            if (g.roundRect) g.roundRect(x0 + 6, 14, 52, 44, 11); else g.rect(x0 + 6, 14, 52, 44);
            g.fill();
            g.fillStyle = istTorwart ? (kit?.twText || "#111827") : (kit?.text || "#ffffff");
            g.font = "800 28px Inter, system-ui, sans-serif";
            g.textAlign = "center";
            g.textBaseline = "middle";
            g.fillText(String(nummer), x0 + 32, 37);
            x = x0 + 68;
        }
        g.font = "600 30px Inter, system-ui, sans-serif";
        g.textAlign = "left";
        g.textBaseline = "middle";
        g.fillStyle = "#f8fafc";
        g.fillText(text, x, 37);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false, fog: false }));
        sprite.scale.set(3.6, 0.81, 1);
        sprite.renderOrder = 10;
        // Welcher Teil des Bildes das Schild ist - für den Platz auf dem Schirm
        sprite.userData.breite = breite / c.width;
        (this.overlay || this.scene).add(sprite);
        return sprite;
    }

    /** Ein neues Spiel: Figuren, Stadion und Wetter neu aufbauen */
    _neuesSpiel(liveMatch) {
        this.figuren.forEach(f => {
            this.scene.remove(f.figur);
            this.scene.remove(f.schatten);
            if (f.label) f.label.removeFromParent();
        });
        this.figuren.clear();
        const k = liveMatch.kits || {};
        this._stimmung(liveMatch.wetter?.art);
        const heim = liveMatch.homeClub || {}, gast = liveMatch.awayClub || {};
        this._baueStadion({
            kapazitaet: heim.stadiumCapacity || heim.capacity || 30000,
            heim: k.home || {}, gast: k.away || {},
            heimName: heim.name || "Heim", gastName: gast.name || "Gast", stadion: heim.stadium || ""
        });
        this.spielKey = liveMatch;
        // Jedes Spiel zählt seine Meldungen von vorn
        this._letzteAktion = 0;
        this._aufnahme = [];
        this._wiederholung = null;
        this._torGeplant = null;
        this._jubelBis = 0;
        this._puffer = [];
        this._geplant = [];
        this._kopfballe = [];
        this._zuletztAmBall = null;
        this._ballZuvor = null;
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
        if (this.composer) {
            this.composer.setPixelRatio(this.renderer.getPixelRatio());
            this.composer.setSize(w, h);
        }
        this.camera.aspect = w / Math.max(1, h);
        this.camera.updateProjectionMatrix();
    }

    /** Was die Simulation gerade zeigt - als einfache Daten, damit es sich aufnehmen lässt */
    _zustand(liveMatch) {
        const ball = liveMatch.ball || { x: 50, y: 50 };
        const spieler = (p, key) => ({
            key, id: p.id, team: p.team, pos: p.pos, name: p.name, x: p.x, y: p.y,
            vx: p.vx || 0, vy: p.vy || 0, speed: p.speed, verletzt: !!p.verletzt,
            color: p.color, groesse: p.groesse, foot: p.foot, nummer: p.number
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

    /**
     * So weit läuft das Bild hinter der Simulation her (Sekunden). In dieser
     * Zeit weiß die Ansicht schon, wann der Ball abgeht: Der Spieler holt
     * vorher aus, und der Fuß trifft den Ball genau im Moment des Abspiels.
     * Beim Kopfball springt er so ab, dass der Kopf den Ball erreicht.
     */
    static VERZOEGERUNG = 0.4;

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
        const zustand = this._verzoegert(this._zustand(liveMatch));
        this._nimmAuf(zustand, dt);
        this._zeichneZustand(zustand, dt, optionen);

        // Nach dem Tor: erst jubeln, dann die Wiederholung
        if (this._torGeplant && this.zeit >= this._torGeplant.start) {
            const geplant = this._torGeplant;
            this._torGeplant = null;
            if (optionen.wiederholung !== false) this._starteWiederholung(geplant);
        }
    }

    /** Weicher Übergang 0..1 */
    static glatt(x) {
        return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
    }

    /**
     * Den Zustand der Simulation puffern und den von vor VERZOEGERUNG
     * Sekunden liefern - zwischen zwei Bildern gemittelt. Meldungen der
     * Regie bekommen ihren Zeitpunkt; ihr Bewegungsablauf beginnt so viel
     * früher, wie er bis zum Ballkontakt braucht.
     */
    _verzoegert(roh) {
        const puffer = this._puffer || (this._puffer = []);
        const geplant = this._geplant || (this._geplant = []);
        const jetzt = this.zeit;
        roh.aktionen.forEach(a => {
            geplant.push(Object.assign({}, a, { _t: jetzt }));
            if (a.art === "kopfball") (this._kopfballe || (this._kopfballe = [])).push({ t: jetzt, h: roh.ball.h * 6 });
        });
        puffer.push({ t: jetzt, z: roh });
        const td = jetzt - Spielfeld3D.VERZOEGERUNG;
        while (puffer.length > 2 && puffer[1].t <= td - 0.5) puffer.shift();

        let i = 0;
        while (i < puffer.length - 1 && puffer[i + 1].t <= td) i++;
        const a = puffer[i], b = puffer[Math.min(puffer.length - 1, i + 1)];
        const u = b.t > a.t ? Math.max(0, Math.min(1, (td - a.t) / (b.t - a.t))) : 0;
        const mix = (x, y) => x + (y - x) * u;
        const nachB = new Map(b.z.spieler.map(s => [s.key, s]));
        const spieler = a.z.spieler.map(s => {
            const s2 = nachB.get(s.key);
            // Ein Schnitt (Ecke, Anstoß) wird nicht übergeblendet
            if (!s2 || Math.abs(s2.x - s.x) + Math.abs(s2.y - s.y) > 6) return s;
            return Object.assign({}, s, { x: mix(s.x, s2.x), y: mix(s.y, s2.y), vx: mix(s.vx, s2.vx), vy: mix(s.vy, s2.vy) });
        });
        const ba = a.z.ball, bb = b.z.ball;
        const ball = Math.abs(bb.x - ba.x) + Math.abs(bb.y - ba.y) > 8 ? Object.assign({}, ba)
            : { x: mix(ba.x, bb.x), y: mix(ba.y, bb.y), h: mix(ba.h, bb.h), flug: ba.flug };
        ball.extra = this._kopfHoehe(td);

        const start = [];
        for (let k = 0; k < geplant.length;) {
            const akt = geplant[k];
            const ab = this._beginn(akt);
            if (td < ab) { k++; continue; }
            geplant.splice(k, 1);
            start.push(this._mitKontakt(akt, td - ab));
        }
        return { ball, spieler, aktionen: start, aktiv: a.z.aktiv, kits: a.z.kits };
    }

    /** Ab wann (Anzeigezeit) ein Bewegungsablauf läuft */
    _beginn(akt) {
        const d = Spielfeld3D.ABLAUF[akt.art];
        if (akt.art === "tor" || !d) return akt._t;
        // Der Torwart fliegt so ab, dass er den Ball erreicht, wenn er ankommt
        if (akt.art === "parade") return akt._t + (akt.verzoegerung || 0) + 0.3 - d.kontakt;
        return akt._t - d.kontakt;
    }

    /** Wo der Ball beim Kontakt liegt und wohin er geht - aus dem Puffer */
    _mitKontakt(akt, t0) {
        const a = Object.assign({}, akt, { t0 });
        if (!["pass", "schuss", "flanke", "kopfball"].includes(akt.art)) return a;
        const r = (this._puffer || []).find(x => x.t >= akt._t - 1e-6);
        if (!r) return a;
        const b = Spielfeld3D.welt(r.z.ball.x, r.z.ball.y);
        a.kontakt = { x: b.x, z: b.z };
        if (typeof akt.x === "number" && typeof akt.y === "number") {
            const ziel = Spielfeld3D.welt(akt.x, akt.y);
            if (Math.hypot(ziel.x - b.x, ziel.z - b.z) > 0.5) a.blick = Math.atan2(-(ziel.z - b.z), ziel.x - b.x);
        }
        return a;
    }

    /**
     * Vor einem Kopfball steigt der Ball auf Kopfhöhe - die Simulation
     * rechnet die Flanke bis zum Boden. Danach sinkt der Zuschlag wieder.
     */
    _kopfHoehe(td) {
        const KOPF = 2.1;
        let extra = 0;
        this._kopfballe = (this._kopfballe || []).filter(k => k.t - td > -1);
        this._kopfballe.forEach(k => {
            const vor = k.t - td;
            if (vor >= 0 && vor < 0.7) extra = Math.max(extra, (KOPF - k.h) * Spielfeld3D.glatt(1 - vor / 0.7));
            else if (vor < 0 && vor > -0.45) extra = Math.max(extra, KOPF * (1 - Spielfeld3D.glatt(-vor / 0.45)));
        });
        return extra;
    }

    _zeichneZustand(z, dt, optionen = {}) {
        const bw = Spielfeld3D.welt(z.ball.x, z.ball.y);
        const hoehe = z.ball.h * 6 + (z.ball.extra || 0);
        // Nah in echter Größe, aus der Ferne bis gut doppelt so groß
        const gross = Math.max(1, Math.min(2.2, this.camera.position.distanceTo(this.ball.position) / 20));
        this.ball.scale.setScalar(gross);
        this.ballSchatten.scale.setScalar(gross);
        this.ball.position.set(bw.x, 0.11 * gross + hoehe, bw.z);
        // Der Ball dreht sich mit seinem Tempo
        const alt = this._ballZuvor;
        this._ballZuvor = { x: bw.x, z: bw.z };
        const weg = alt ? Math.min(3, Math.hypot(bw.x - alt.x, bw.z - alt.z)) : 0;
        this.ball.rotation.z -= weg / 0.11;
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
        // Wer den Ball neu bekommt, nimmt ihn an
        if (z.aktiv !== this._zuletztAmBall) {
            this._zuletztAmBall = z.aktiv;
            const neu = this._figurVon(z, z.aktiv);
            if (neu && neu.f && !neu.f.anim && neu.p.pos !== "TW" && !z.ball.flug && hoehe < 0.4) {
                const d = Spielfeld3D.ABLAUF.annahme;
                neu.f.anim = { art: "annahme", t: 0, kontakt: d.kontakt, dauer: d.dauer };
            }
        }

        z.spieler.forEach(p => {
            const f = this.figuren.get(p.key);
            const w = Spielfeld3D.welt(p.x, p.y);
            let px = w.x, pz = w.z;

            // Laufrichtung - im Stand schaut er zum Ball
            const tempo = Math.hypot(p.vx, p.vy);
            let ziel;
            if (tempo > 0.4) ziel = Math.atan2(-p.vy * (S3D_BREITE / 100), p.vx * (S3D_LAENGE / 92));
            else ziel = Math.atan2(-(bw.z - w.z), bw.x - w.x);

            // Beim Schuss, Pass oder Kopfball steht er am Ball und schaut
            // dorthin, wohin der Ball geht
            const a = f.anim;
            if (a && a.ball) {
                const tau = a.t - a.kontakt;
                const gewicht = tau < 0 ? Spielfeld3D.glatt(a.t / Math.max(0.01, a.kontakt)) : 1 - Spielfeld3D.glatt(tau / 0.35);
                const blick = a.blick ?? f.richtung;
                const vx = Math.cos(blick), vz = -Math.sin(blick);
                let zx, zz;
                if (a.art === "kopfball") {
                    zx = a.ball.x - vx * 0.06; zz = a.ball.z - vz * 0.06;
                } else {
                    // Der Schussfuß neben den Ball, der Körper dahinter
                    const seite = f.schussBein ? 1 : -1;
                    zx = a.ball.x - vx * 0.5 - Math.sin(blick) * seite * 0.12;
                    zz = a.ball.z - vz * 0.5 - Math.cos(blick) * seite * 0.12;
                }
                let dx = zx - w.x, dz = zz - w.z;
                const l = Math.hypot(dx, dz);
                if (l > 2.5) { dx *= 2.5 / l; dz *= 2.5 / l; }
                px += dx * gewicht; pz += dz * gewicht;
                if (a.blick !== undefined && gewicht > 0.15) ziel = a.blick;
            }
            f.figur.position.set(px, 0, pz);
            f.schatten.position.set(px + 0.15, 0.02, pz + 0.1);

            let diff = ziel - f.richtung;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            f.richtung += diff * Math.min(1, dt * (a && a.ball ? 14 : 8));
            f.figur.rotation.y = f.richtung;

            const lauf = Math.min(1, (p.speed ?? tempo) / 6);
            this._laufe(f, p, lauf, dt, Math.hypot(bw.x - w.x, bw.z - w.z));
            // Ein Bewegungsablauf überlagert das Laufen
            if (f.anim) this._pose(f, dt);

            // Namen: alle, oder nur wer am Ball ist
            const zeigeName = namenAlle || p.id === z.aktiv;
            if (zeigeName) {
                if (!f.label) f.label = this._label((p.name || "").split(" ").pop(), p.nummer, z.kits[p.team], p.pos === "TW");
                const abstand = this.camera.position.distanceTo(f.figur.position);
                // Auf niedriger Stufe nur nahe Namen - jeder kostet ein Bild
                f.label.visible = p.id === z.aktiv || abstand < this.q.namen * 4;
                f.label.position.set(px, 2.5 + f.figur.position.y, pz);
                f.label.material.opacity = p.id === z.aktiv ? 1 : 0.85;
                f.label.userData.vorrang = p.id === z.aktiv ? -1 : Math.hypot(w.x - bw.x, w.z - bw.z);
            } else if (f.label) {
                f.label.visible = false;
            }
        });
        // Wer nicht mehr auf dem Platz ist, verschwindet
        this.figuren.forEach((f, k) => {
            if (f.gesehen === gesehen) return;
            this.scene.remove(f.figur);
            this.scene.remove(f.schatten);
            if (f.label) f.label.removeFromParent();
            this.figuren.delete(k);
        });

        // Der Ring unter dem Spieler am Ball
        if (this.markierung) {
            const amBall = z.spieler.find(s => s.id === z.aktiv);
            const fa = amBall && this.figuren.get(amBall.key);
            this.markierung.visible = !!fa && !z.ball.flug && !this._wiederholung;
            if (fa) {
                this.markierung.position.set(fa.figur.position.x, 0.03, fa.figur.position.z);
                const farbe = amBall.team === "home" ? z.kits.home?.akzent : z.kits.away?.akzent;
                if (farbe && this._ringFarbe !== farbe) { this._ringFarbe = farbe; this.markierung.material.color.set(farbe); }
            }
        }
        // Nach einem Tor springt das Publikum
        if (this.publikumTexturen && this._jubelBis) {
            const an = this.zeit < this._jubelBis;
            this.publikumTexturen.forEach((t, i) => { t.offset.y = an ? Math.abs(Math.sin(this.zeit * 11 + i)) * 0.012 : 0; });
            if (!an) this._jubelBis = 0;
        }

        this._fuehreKamera(bw, hoehe, dt, z);
        this._ordneNamen();
        this._bewegeNiederschlag(dt);
        this._zeichneBild();
    }

    /** Ins Bild: mit Nachbearbeitung, wenn es sie gibt */
    _zeichneBild() {
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
        if (this.overlay && this.overlay.children.length) {
            const vorher = this.renderer.autoClear;
            this.renderer.autoClear = false;
            this.renderer.clearDepth();
            this.renderer.render(this.overlay, this.camera);
            this.renderer.autoClear = vorher;
        }
    }

    /**
     * Laufen und Stehen: Die Beine schwingen aus der Hüfte, das Knie beugt
     * sich, wenn das Bein nach vorn kommt, die Arme gehen angewinkelt
     * gegen die Beine. Je schneller, desto weiter die Schritte und desto
     * mehr Vorlage. Der Torwart geht in die Hocke, wenn der Ball nah ist.
     */
    _laufe(f, p, lauf, dt, ballAbstand) {
        f.phase += dt * (4.5 + lauf * 8.5);
        const weite = 0.1 + 0.55 * lauf;
        const bereit = p.pos === "TW" && lauf < 0.3 && ballAbstand < 26 ? 1 - lauf / 0.3 : 0;
        for (let i = 0; i < 2; i++) {
            const ph = f.phase + i * Math.PI;
            f.beine[i].rotation.set(0, 0, weite * Math.sin(ph) + 0.25 * bereit);
            f.knie[i].rotation.set(0, 0, -(0.06 + lauf * (0.15 + 1.15 * Math.max(0, Math.cos(ph))) + 0.55 * bereit));
            // Arm 0 hebt sich mit positivem, Arm 1 mit negativem Winkel zur Seite
            f.arme[i].rotation.set((i === 0 ? 1 : -1) * (0.1 + 0.35 * bereit), 0, -weite * 0.9 * Math.sin(ph) + 0.5 * bereit);
            f.ellbogen[i].rotation.set(0, 0, 0.2 + lauf * 1.1 + 0.6 * bereit);
        }
        const atmen = Math.sin(this.zeit * 2 + f.phase) * 0.015 * (1 - lauf);
        f.koerper.position.set(0, Math.abs(Math.sin(f.phase)) * 0.05 * lauf - 0.03 * lauf - 0.12 * bereit, 0);
        f.koerper.rotation.set(0, 0, 0);
        f.rumpf.rotation.set(0, Math.sin(f.phase) * 0.14 * lauf, -0.17 * lauf - 0.25 * bereit + atmen);
        f.kopf.rotation.set(0, 0, 0.12 * lauf + 0.15 * bereit);
        f.figur.position.y = 0;
        // Angeschlagene humpeln sichtbar
        if (p.verletzt) f.koerper.rotation.x = Math.sin(this.zeit * 6) * 0.08;
    }

    /** Schilder: so hoch auf dem Schirm, in Bildpunkten - im kleinen Bild kleiner */
    static NAMEN_PX = 23;

    _namenPx() {
        return Math.max(12, Math.min(Spielfeld3D.NAMEN_PX, (this._h || 480) * 0.045));
    }

    /**
     * Namensschilder gleich groß, egal wie weit weg, und ohne Überlagerung:
     * zuerst der Spieler am Ball, dann nach Nähe zum Ball. Wer keinen
     * freien Platz findet, bleibt ohne Schild. Wer im letzten Bild ein
     * Schild hatte, behält es eher - sonst flackert es im Gedränge.
     */
    _ordneNamen() {
        const hoehePx = this._h || 480, breitePx = this._w || 800;
        const tan = Math.tan(this.camera.fov * Math.PI / 360);
        const px = this._namenPx();
        const schilder = [];
        this.figuren.forEach(f => { if (f.label && f.label.visible) schilder.push(f.label); });
        schilder.sort((a, b) => (a.userData.vorrang - (a.userData.zuvor ? 6 : 0)) - (b.userData.vorrang - (b.userData.zuvor ? 6 : 0)));
        const belegt = [];
        const v = new THREE.Vector3();
        schilder.forEach(s => {
            const abstand = this.camera.position.distanceTo(s.position);
            // So groß, dass das Schild NAMEN_PX Bildpunkte hoch ist
            const k = px * 2 * abstand * tan / (0.81 * hoehePx);
            s.scale.set(3.6 * k, 0.81 * k, 1);
            v.copy(s.position).project(this.camera);
            const h = px * 0.78, w = px * (320 / 72) * (s.userData.breite || 0.6);
            const x = (v.x + 1) / 2 * breitePx, y = (1 - v.y) / 2 * hoehePx;
            const frei = v.z < 1 && !belegt.some(r => Math.abs(r.x - x) < (r.w + w) / 2 + 2 && Math.abs(r.y - y) < (r.h + h) / 2 + 1);
            s.visible = frei || s.userData.vorrang < 0;
            s.userData.zuvor = s.visible;
            if (s.visible) belegt.push({ x, y, w, h });
        });
    }

    // ----------------------------------------------------------- Bewegungen

    /** Bewegungsabläufe: Sekunden vom Beginn bis zum Ballkontakt, Gesamtdauer */
    static ABLAUF = {
        pass: { kontakt: 0.24, dauer: 0.62 },
        schuss: { kontakt: 0.32, dauer: 0.95 },
        flanke: { kontakt: 0.32, dauer: 0.9 },
        kopfball: { kontakt: 0.38, dauer: 0.95 },
        zweikampf: { kontakt: 0.2, dauer: 0.85 },
        parade: { kontakt: 0.22, dauer: 1.2 },
        annahme: { kontakt: 0.1, dauer: 0.38 },
        jubel: { kontakt: 0, dauer: 3.2 }
    };

    /**
     * Schlüsselstellungen je Ablauf, die Zeit relativ zum Ballkontakt.
     * Schuss, Pass, Flanke: [Zeit, Hüfte Schussbein, Knie Schussbein,
     * Hüfte Standbein, Knie Standbein, Rumpf (+ zurück), Gegenarm zur Seite,
     * Arm am Schussbein, Hüpfer, Drehung des Rumpfs].
     */
    static POSEN = {
        pass: [
            [-0.24, 0, -0.1, 0, -0.1, 0, 0.15, 0.1, 0, 0],
            [-0.09, -0.6, -1.05, 0.08, -0.28, -0.12, 0.6, 0.25, 0, 0.1],
            [0, 0.22, -0.32, 0.06, -0.3, -0.14, 0.7, 0.3, 0, 0],
            [0.13, 0.62, -0.2, 0, -0.2, -0.08, 0.6, 0.25, 0, -0.05],
            [0.38, 0, -0.1, 0, -0.1, 0, 0.15, 0.1, 0, 0]
        ],
        schuss: [
            [-0.32, 0, -0.1, 0, -0.1, 0, 0.15, 0.1, 0, 0],
            [-0.12, -0.95, -1.75, 0.12, -0.38, 0.06, 0.95, 0.4, 0, 0.18],
            [0, 0.38, -0.55, 0.1, -0.36, -0.18, 1.05, 0.5, 0, 0],
            [0.15, 1.5, -0.12, 0, -0.15, 0.16, 1.0, 0.5, 0.12, -0.15],
            [0.36, 0.85, -0.55, 0, -0.12, 0.1, 0.6, 0.3, 0, -0.05],
            [0.63, 0, -0.1, 0, -0.1, 0, 0.15, 0.1, 0, 0]
        ],
        flanke: [
            [-0.32, 0, -0.1, 0, -0.1, 0, 0.15, 0.1, 0, 0],
            [-0.12, -0.85, -1.6, 0.1, -0.36, 0.1, 1.0, 0.45, 0, 0.35],
            [0, 0.32, -0.5, 0.08, -0.34, 0.12, 1.1, 0.5, 0, -0.1],
            [0.16, 1.2, -0.25, 0, -0.18, 0.22, 1.0, 0.5, 0.06, -0.4],
            [0.58, 0, -0.1, 0, -0.1, 0, 0.15, 0.1, 0, 0]
        ],
        // [Zeit, Höhe, Knie, Hüfte, Arme zur Seite, Arme nach vorn, Rumpf, Nicken]
        kopfball: [
            [-0.38, 0, -0.1, 0.05, 0.1, 0, 0, 0],
            [-0.27, 0, -1.0, 0.45, 0.25, -0.4, -0.22, 0],
            [-0.17, 0.2, -0.15, 0.1, 1.0, 0.6, -0.05, 0],
            [0, 0.46, -0.75, 0.35, 1.2, 0.45, 0.35, 0.12],
            [0.07, 0.45, -0.6, 0.3, 1.0, 0.3, -0.35, -0.5],
            [0.3, 0.12, -0.3, 0.1, 0.5, 0.2, -0.1, -0.1],
            [0.42, 0, -0.65, 0.3, 0.3, 0.1, -0.12, 0],
            [0.57, 0, -0.1, 0.05, 0.1, 0, 0, 0]
        ],
        // [Zeit, Hüfte, Knie, Rumpf]
        annahme: [
            [-0.1, 0, -0.1, 0],
            [0, 0.42, -0.75, -0.1],
            [0.12, 0.2, -0.45, -0.06],
            [0.28, 0, -0.1, 0]
        ]
    };

    /** Werte zwischen zwei Schlüsselstellungen, weich übergeblendet */
    static spur(tasten, tau) {
        if (tau <= tasten[0][0]) return tasten[0].slice(1);
        for (let i = 1; i < tasten.length; i++) {
            const b = tasten[i];
            if (tau <= b[0]) {
                const a = tasten[i - 1];
                const u = Spielfeld3D.glatt((tau - a[0]) / (b[0] - a[0]));
                return a.slice(1).map((v, k) => v + (b[k + 1] - v) * u);
            }
        }
        return tasten[tasten.length - 1].slice(1);
    }

    _figurVon(z, id) {
        const p = z.spieler.find(s => s.id === id);
        return p ? { p, f: this.figuren.get(p.key) } : null;
    }

    _starteAktion(a, z) {
        const ziel = this._figurVon(z, a.id);
        if (!ziel || !ziel.f) return;
        const { p, f } = ziel;
        const ablauf = Spielfeld3D.ABLAUF;
        if (a.art === "tor") {
            // Der Schütze jubelt, die Mitspieler in der Nähe mit
            f.anim = { art: "jubel", t: a.t0 || 0, kontakt: 0, dauer: ablauf.jubel.dauer, knie: this._hash(String(a.id) + a.nr) < 0.35 };
            z.spieler.forEach(m => {
                if (m.team !== p.team || m.id === p.id || m.pos === "TW") return;
                if (Math.hypot(m.x - p.x, m.y - p.y) > 22) return;
                const fm = this.figuren.get(m.key);
                if (fm) fm.anim = { art: "jubel", t: -this._hash(String(m.id) + a.nr) * 0.6, kontakt: 0, dauer: ablauf.jubel.dauer - 0.6 };
            });
            // Die Wiederholung beginnt, wenn der erste Jubel durch ist;
            // aufgenommen wird noch, bis der Ball im Netz liegt
            if (!this._wiederholung) {
                this._torGeplant = { start: this.zeit + 2.4, team: p.team, schuetze: p.id };
                this._jubelBis = this.zeit + 4;
            }
            return;
        }
        const d = ablauf[a.art] || { kontakt: 0, dauer: 0.5 };
        const anim = { art: a.art, t: a.t0 || 0, kontakt: d.kontakt, dauer: d.dauer, ball: a.kontakt || null, blick: a.blick };
        if (a.art === "parade") {
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
        if (a.t >= a.dauer) { f.anim = null; return; }
        const t = Math.min(1, a.t / a.dauer);
        const tau = a.t - a.kontakt;
        const bogen = Math.sin(Math.PI * t);
        const k = f.koerper;
        const kb = f.schussBein, sb = 1 - kb;
        // Arm 0 hebt sich mit positivem, Arm 1 mit negativem Winkel zur Seite
        const seitlich = (i, w) => { f.arme[i].rotation.x = (i === 0 ? 1 : -1) * w; };

        if (a.art === "pass" || a.art === "schuss" || a.art === "flanke") {
            const [hK, kK, hS, kS, rumpf, armG, armK, hopp, dreh] = Spielfeld3D.spur(Spielfeld3D.POSEN[a.art], tau);
            f.beine[kb].rotation.z = hK; f.knie[kb].rotation.z = kK;
            f.beine[sb].rotation.z = hS; f.knie[sb].rotation.z = kS;
            f.rumpf.rotation.z = rumpf;
            f.rumpf.rotation.y = dreh * (kb ? 1 : -1);
            seitlich(sb, armG); seitlich(kb, armK);
            f.arme[0].rotation.z = f.arme[1].rotation.z = 0.15;
            f.ellbogen[0].rotation.z = f.ellbogen[1].rotation.z = 0.45;
            k.position.y = -0.07 * Math.min(1, -kS / 0.4);
            f.figur.position.y = hopp;
        } else if (a.art === "kopfball") {
            const [hoch, knie, huefte, armSeite, armVor, rumpf, nicken] = Spielfeld3D.spur(Spielfeld3D.POSEN.kopfball, tau);
            f.figur.position.y = hoch;
            for (let i = 0; i < 2; i++) {
                f.beine[i].rotation.z = huefte * (i === kb ? 1 : 0.7);
                f.knie[i].rotation.z = knie;
                seitlich(i, armSeite);
                f.arme[i].rotation.z = armVor;
                f.ellbogen[i].rotation.z = 0.5;
            }
            k.position.y = knie < -0.6 && hoch < 0.05 ? -0.15 : 0;
            f.rumpf.rotation.z = rumpf;
            f.kopf.rotation.z = nicken;
        } else if (a.art === "annahme") {
            const [huefte, knie, rumpf] = Spielfeld3D.spur(Spielfeld3D.POSEN.annahme, tau);
            f.beine[kb].rotation.z = huefte;
            f.knie[kb].rotation.z = knie;
            f.rumpf.rotation.z = rumpf - 0.05;
            seitlich(sb, 0.35 * bogen);
        } else if (a.art === "zweikampf") {
            const an = Spielfeld3D.glatt(Math.min(a.t / a.kontakt, (a.dauer - a.t) / 0.3));
            if (a.grätsche) {
                // Grätsche: nach hinten kippen, das vordere Bein flach über
                // den Rasen voraus, das hintere eingeklappt, rutschen
                k.rotation.z = 0.9 * an;
                k.position.y = -0.52 * an;
                k.position.x = 1.2 * Math.min(1, Math.max(0, tau + a.kontakt) / 0.5);
                f.beine[kb].rotation.z = 0.68 * an; f.knie[kb].rotation.z = -0.05;
                f.beine[sb].rotation.z = 0.1 * an; f.knie[sb].rotation.z = -1.45 * an;
                f.rumpf.rotation.z = -0.35 * an;
                seitlich(0, 0.7 * an); seitlich(1, 0.7 * an);
                f.ellbogen[0].rotation.z = f.ellbogen[1].rotation.z = 0.3;
            } else {
                // Im Stehen: Ausfallschritt mit dem Fuß zum Ball
                f.beine[kb].rotation.z = 1.0 * an; f.knie[kb].rotation.z = -0.3 * an;
                f.beine[sb].rotation.z = -0.4 * an; f.knie[sb].rotation.z = -0.55 * an;
                k.position.y = -0.12 * an;
                f.rumpf.rotation.z = -0.3 * an;
                seitlich(sb, 0.5 * an);
            }
        } else if (a.art === "parade") {
            // Abheben, zur Seite fliegen, landen und kurz liegen bleiben
            const flug = Math.min(1, t * 2.4);
            k.rotation.x = a.seite * 1.3 * flug;
            k.position.z = a.seite * 1.6 * Math.min(1, t * 1.7);
            k.position.y = -0.2 * flug;
            f.figur.position.y = 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.5));
            // Die Arme gestreckt über den Kopf - mit dem gekippten Körper zeigen sie zur Flugseite
            seitlich(0, 2.9 * flug); seitlich(1, 2.9 * flug);
            f.arme[0].rotation.z = f.arme[1].rotation.z = 0;
            f.ellbogen[0].rotation.z = f.ellbogen[1].rotation.z = 0.1;
            f.beine[0].rotation.z = 0.2 * flug;
            f.beine[1].rotation.z = -0.2 * flug;
            f.knie[0].rotation.z = f.knie[1].rotation.z = -0.35 * flug;
            f.rumpf.rotation.z = 0;
        } else if (a.art === "jubel") {
            const an = Math.min(1, t * 6) * Math.min(1, (1 - t) * 6);
            seitlich(0, 2.6 * an); seitlich(1, 2.6 * an);
            f.ellbogen[0].rotation.z = f.ellbogen[1].rotation.z = 0.3 * an;
            if (a.knie) {
                // Auf den Knien über den Rasen, der Oberkörper zurück
                k.position.y = -0.42 * an;
                f.beine[0].rotation.z = f.beine[1].rotation.z = 0;
                f.knie[0].rotation.z = f.knie[1].rotation.z = -1.55 * an;
                f.rumpf.rotation.z = 0.35 * an;
                f.kopf.rotation.z = 0.25 * an;
            } else {
                f.figur.position.y = Math.abs(Math.sin(a.t * 7)) * 0.28 * an;
                f.knie[0].rotation.z = f.knie[1].rotation.z = -0.4 * an * Math.abs(Math.cos(a.t * 7));
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

    /**
     * Die Kameras: Höhe, Abstand zur Seitenlinie und wie viel Grad sie in
     * der Breite zeigen. Aus der Breite wird der Bildwinkel nach oben
     * gerechnet - ein schmales Bild zeigt so nicht weniger vom Spiel,
     * sondern nur weniger Himmel und Tribüne.
     */
    static KAMERA = {
        tv: { hoehe: 17, abstand: 30, breite: 40, min: 15, max: 32 },
        taktik: { hoehe: 72, abstand: 14, breite: 84, min: 30, max: 60 },
        nah: { hoehe: 4.2, abstand: 10, breite: 44, min: 20, max: 40 },
        wiederholung: { breite: 62, min: 30, max: 52 }
    };

    /** Bildwinkel nach oben für eine Kamera, aus ihrer Breite und dem Seitenverhältnis */
    _kameraFov(art) {
        const k = Spielfeld3D.KAMERA[art] || Spielfeld3D.KAMERA.tv;
        const seiten = this.camera.aspect || 16 / 9;
        const fov = 2 * Math.atan(Math.tan(k.breite * Math.PI / 360) / seiten) * 180 / Math.PI;
        return Math.max(k.min, Math.min(k.max, fov));
    }

    /** Die Kamera folgt dem Ball - weich, nie ruckartig, mit etwas Vorlauf in Spielrichtung */
    _fuehreKamera(bw, hoehe, dt, z) {
        const k = Math.min(1, dt * 2.2);
        // Wohin der Ball läuft: geglättet, ohne Sprünge bei einem Schnitt
        const alt = this._ballAlt;
        this._ballAlt = { x: bw.x, z: bw.z };
        if (alt && dt > 0 && Math.abs(bw.x - alt.x) < 6) {
            const v = (bw.x - alt.x) / dt;
            this._vorlauf = (this._vorlauf || 0) + (Math.max(-9, Math.min(9, v * 0.9)) - (this._vorlauf || 0)) * Math.min(1, dt * 0.8);
        }
        const vorlauf = this._vorlauf || 0;
        const zielX = Math.max(-40, Math.min(40, bw.x + vorlauf));
        let pos, blick, art;
        if (this._wiederholung) {
            // Hinter dem Tor, auf das der Schütze spielte, leicht erhöht
            const seite = this._wiederholung.seite;
            pos = new THREE.Vector3(seite * (S3D_LAENGE / 2 + 13), 7.5, bw.z * 0.4);
            blick = new THREE.Vector3(bw.x - seite * 4, 1 + hoehe * 0.3, bw.z);
            art = "wiederholung";
        } else if (this.kamera === "taktik") {
            const c = Spielfeld3D.KAMERA.taktik;
            pos = new THREE.Vector3(zielX * 0.35, c.hoehe, S3D_BREITE / 2 + c.abstand);
            blick = new THREE.Vector3(zielX * 0.35, 0, 1);
            art = "taktik";
        } else if (this.kamera === "nah") {
            const c = Spielfeld3D.KAMERA.nah;
            pos = new THREE.Vector3(bw.x - vorlauf * 0.3, c.hoehe, bw.z + c.abstand);
            blick = new THREE.Vector3(bw.x + vorlauf * 0.4, 1 + hoehe * 0.3, bw.z);
            art = "nah";
        } else {
            // Übertragung: oben auf der Haupttribüne, schwenkt mit dem Ball
            const c = Spielfeld3D.KAMERA.tv;
            pos = new THREE.Vector3(zielX * 0.7, c.hoehe, S3D_BREITE / 2 + c.abstand);
            blick = new THREE.Vector3(zielX, 0, bw.z * 0.55 - 1.5);
            art = "tv";
        }
        const fov = this._kameraFov(art);
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
        if (this.composer && typeof this.composer.dispose === "function") this.composer.dispose();
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
