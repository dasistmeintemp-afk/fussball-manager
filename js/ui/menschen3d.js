/**
 * Menschen3D - echte Menschen als Spieler in der 3D-Ansicht
 *
 * Die Körper kommen aus assets/3d/menschen.bin (gebaut von
 * tools/menschen-bauen.js aus dem MakeHuman-Menschen, CC0): ein sportlicher
 * Mann mit Hautbild, Augen, Brauen, Wimpern und Frisuren, darüber die
 * Spielkleidung als eigene Stoffschicht. Formziele geben jedem Spieler
 * seinen Körperbau und sein Gesicht.
 *
 * Bewegt wird er von denselben elf Gelenken wie die gezeichnete Figur
 * (Becken, Rumpf, Kopf, Schultern, Ellbogen, Hüften, Knie): Jedes Bild
 * überträgt treibe() deren Drehungen auf die 52 Knochen des Menschen -
 * der Rumpf verteilt sich auf drei Wirbel, der Kopf auf Hals und Kopf, die
 * Schulter nimmt etwas vom Arm mit. Die Füße bleiben flach auf dem Rasen,
 * rollen beim Abdruck ab und strecken sich beim Schuss.
 *
 * Trikotfarben, Rückennummer und Name rechnet der Shader aus der
 * Ruhelage der Stoffpunkte - dafür braucht es kein Bild je Verein.
 *
 * Gehen, Traben, Laufen, Stehen, Schuss, Pass und der Sprung zum Kopfball
 * sind aufgenommene Bewegungen echter Menschen (assets/3d/bewegungen.json,
 * gebaut von tools/bewegungen-bauen.js aus der CMU-Datenbank). Die
 * Fortbewegung blendet nach Tempo zwischen den Läufen über, alle im selben
 * Schritttakt; Schuss, Pass und Sprung laufen so, dass der Fuß oder Kopf
 * den Ball genau im Moment des Kontakts trifft - für Linksfüße gespiegelt.
 * Was es nicht als Aufnahme gibt (Grätsche, Parade, Jubel, Annahme, die
 * Bereitschaft des Torwarts), kommt weiter aus den elf Gelenken.
 */
class Menschen3D {
    static DATEI = "assets/3d/menschen.bin";
    static VORRAT_ID = "vorrat-menschen";
    static BEWEGUNGEN = "assets/3d/bewegungen.json";
    static BEWEGUNGEN_ID = "vorrat-bewegungen";

    /** Die Datei einmal laden - liefert ein Promise auf Menschen3D oder null */
    static laden() {
        if (Menschen3D._laden) return Menschen3D._laden;
        Menschen3D._laden = (async () => {
            try {
                let bytes;
                const vorrat = typeof document !== "undefined" && document.getElementById(Menschen3D.VORRAT_ID);
                if (vorrat) {
                    const roh = atob(vorrat.textContent.trim());
                    bytes = new Uint8Array(roh.length);
                    for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
                } else {
                    const antwort = await fetch(Menschen3D.DATEI);
                    if (!antwort.ok) throw new Error("HTTP " + antwort.status);
                    bytes = new Uint8Array(await antwort.arrayBuffer());
                }
                return new Menschen3D(bytes, await Menschen3D._ladeBewegungen());
            } catch (e) {
                console.warn("3D-Menschen nicht geladen, es bleiben die gezeichneten Figuren:", e);
                return null;
            }
        })();
        return Menschen3D._laden;
    }

    /** Die aufgenommenen Bewegungen - ohne sie bewegen die elf Gelenke allein */
    static async _ladeBewegungen() {
        try {
            const vorrat = typeof document !== "undefined" && document.getElementById(Menschen3D.BEWEGUNGEN_ID);
            if (vorrat) return JSON.parse(vorrat.textContent);
            const antwort = await fetch(Menschen3D.BEWEGUNGEN);
            if (!antwort.ok) throw new Error("HTTP " + antwort.status);
            return await antwort.json();
        } catch (e) {
            console.warn("3D-Bewegungen nicht geladen, die Spieler bewegen sich berechnet:", e);
            return null;
        }
    }

    constructor(bytes, bewegungen = null) {
        if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "MNS1") throw new Error("Keine Menschen-Datei");
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const laenge = dv.getUint32(4, true);
        // Die Blöcke müssen auf vier Bytes ausgerichtet liegen
        if (bytes.byteOffset % 4) bytes = bytes.slice();
        this.bytes = bytes;
        this.d = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + laenge)));
        this.start = bytes.byteOffset + 8 + laenge;
        this._geo = new Map();
        this._mat = new Map();
        this._bilder = new Map();
        this._ruhe();
        this._bewegungenLesen(bewegungen);
    }

    /** Die Stücke als Felder: Drehungen je Bild und Knochen, Becken als Versatz */
    _bewegungenLesen(b) {
        this.bw = null;
        if (!b || b.format !== "bewegungen") return;
        const feld16 = (text) => {
            const roh = typeof atob === "function" ? atob(text) : Buffer.from(text, "base64").toString("binary");
            const bytes = new Uint8Array(roh.length);
            for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
            return new Int16Array(bytes.buffer);
        };
        const knochen = b.knochen.map(n => this.knochenNr(n));
        if (knochen.some(i => i < 0)) return;
        const clips = {};
        Object.entries(b.clips).forEach(([name, c]) => {
            clips[name] = Object.assign({}, c, {
                q: Float32Array.from(feld16(c.q), x => x / 32767),
                h: Float32Array.from(feld16(c.h), x => x / 10000)
            });
        });
        // Für Linksfüße: jeder Knochen nimmt die Bewegung seines Gegenstücks
        const spiegel = b.knochen.map(n => {
            const g = n.startsWith("Left") ? "Right" + n.slice(4) : n.startsWith("Right") ? "Left" + n.slice(5) : n;
            return b.knochen.indexOf(g);
        });
        const s = clips.sprung;
        if (s) { let h = 0; for (let i = 1; i < s.h.length; i += 3) h = Math.max(h, s.h[i]); s.scheitel = h; }
        this.bw = { fps: b.fps, knochen, spiegel, clips, nb: knochen.length, huefte: knochen.indexOf(this._huefte) };
    }

    /** Ein Block der Datei als passendes Feld */
    feld(ref) {
        const T = { u16: Uint16Array, u16n: Uint16Array, i8n: Int8Array, u8: Uint8Array, u8n: Uint8Array, i16: Int16Array, u32: Uint32Array, webp: Uint8Array }[ref.typ];
        return new T(this.bytes.buffer, this.start + ref.off, ref.n);
    }

    // ------------------------------------------------------------ Geometrie

    _geometrie(schluessel, netz, indexRef) {
        if (this._geo.has(schluessel)) return this._geo.get(schluessel);
        const g = new THREE.BufferGeometry();
        // Für Haut mit zwei Schnitten (Feldspieler, Torwart) teilen sich die Felder
        const geteilt = this._geo.get(netz);
        if (geteilt) {
            Object.entries(geteilt.attributes).forEach(([k, a]) => g.setAttribute(k, a));
            g.morphAttributes.position = geteilt.morphAttributes.position;
        } else {
            const q = this.feld(netz.lage), pos = new Float32Array(q.length);
            const { min, max } = netz.lage;
            for (let i = 0; i < q.length; i++) { const k = i % 3; pos[i] = min[k] + q[i] / 65535 * (max[k] - min[k]); }
            g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
            g.setAttribute("normal", new THREE.BufferAttribute(this.feld(netz.normale), 3, true));
            if (netz.uv) g.setAttribute("uv", new THREE.BufferAttribute(this.feld(netz.uv), 2, true));
            g.setAttribute("skinIndex", new THREE.BufferAttribute(this.feld(netz.gelenk), 4));
            g.setAttribute("skinWeight", new THREE.BufferAttribute(this.feld(netz.gewicht), 4, true));
            if (netz.teil) g.setAttribute("teil", new THREE.BufferAttribute(this.feld(netz.teil), 1));
            if (netz.saum) g.setAttribute("saum", new THREE.BufferAttribute(this.feld(netz.saum), 1, true));
            g.morphAttributes.position = netz.formen.map(f => {
                const d = new Float32Array(pos.length), idx = this.feld(f.idx), w = this.feld(f.d);
                for (let j = 0; j < idx.length; j++) {
                    const o = idx[j] * 3;
                    d[o] = w[j * 3] * f.skala; d[o + 1] = w[j * 3 + 1] * f.skala; d[o + 2] = w[j * 3 + 2] * f.skala;
                }
                return new THREE.BufferAttribute(d, 3);
            });
            this._geo.set(netz, g);
        }
        g.morphTargetsRelative = true;
        g.setIndex(new THREE.BufferAttribute(this.feld(indexRef || netz.index), 1));
        g.computeBoundingSphere();
        this._geo.set(schluessel, g);
        return g;
    }

    // ------------------------------------------------------------ Bilder und Stoffe

    _bild(ref, farbraum = true) {
        if (this._bilder.has(ref)) return this._bilder.get(ref);
        let t = null;
        if (typeof document !== "undefined" && typeof document.createElementNS === "function" && typeof Blob !== "undefined" && typeof URL !== "undefined" && URL.createObjectURL) {
            const url = URL.createObjectURL(new Blob([this.feld(ref)], { type: "image/webp" }));
            t = new THREE.TextureLoader().load(url, () => URL.revokeObjectURL(url));
            t.flipY = false;
            if (farbraum) t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 4;
        }
        this._bilder.set(ref, t);
        return t;
    }

    _stoff(schluessel, bau) {
        if (!this._mat.has(schluessel)) this._mat.set(schluessel, bau());
        return this._mat.get(schluessel);
    }

    /**
     * Der Stoff der Kleidung: Farbe je Stück (Trikot, Hose, Stutzen, Schuh,
     * Handschuh), Bündchen an Kragen und Ärmeln, die Rückennummer mit Namen
     * und eine kleine Nummer vorn. Alles aus der Ruhelage der Stoffpunkte.
     */
    static trikotStoff(farben, saumFarben, nummerBild, nummerFarbe) {
        const m = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 });
        const u = {
            uFarbe: { value: farben.map(f => new THREE.Color(f)) },
            uSaumFarbe: { value: saumFarben.map(f => new THREE.Color(f)) },
            uNummer: { value: nummerBild },
            uMitNummer: { value: nummerBild ? 1 : 0 },
            uNummerFarbe: { value: new THREE.Color(nummerFarbe || "#ffffff") }
        };
        m.userData.u = u;
        m.onBeforeCompile = (sh) => {
            Object.assign(sh.uniforms, u);
            sh.vertexShader = sh.vertexShader
                .replace("#include <common>", "#include <common>\nattribute float teil;\nattribute float saum;\nvarying float vTeil;\nvarying float vSaum;\nvarying vec3 vRuhe;\nvarying vec3 vRuheN;")
                .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTeil = teil; vSaum = saum; vRuhe = position; vRuheN = normal;");
            sh.fragmentShader = sh.fragmentShader
                .replace("#include <common>", `#include <common>
uniform vec3 uFarbe[5];
uniform vec3 uSaumFarbe[5];
uniform sampler2D uNummer;
uniform float uMitNummer;
uniform vec3 uNummerFarbe;
varying float vTeil;
varying float vSaum;
varying vec3 vRuhe;
varying vec3 vRuheN;`)
                .replace("#include <color_fragment>", `#include <color_fragment>
int teilNr = int(vTeil + 0.5);
vec3 stoff = uFarbe[0];
vec3 saumF = uSaumFarbe[0];
if (teilNr == 1) { stoff = uFarbe[1]; saumF = uSaumFarbe[1]; }
else if (teilNr == 2) { stoff = uFarbe[2]; saumF = uSaumFarbe[2]; }
else if (teilNr == 3) { stoff = uFarbe[3]; saumF = uSaumFarbe[3]; }
else if (teilNr == 4) { stoff = uFarbe[4]; saumF = uSaumFarbe[4]; }
// Bündchen: vSaum ist der Abstand zur Kante (1 = 6 cm)
float bandBreite = teilNr == 0 ? 0.22 : teilNr == 1 ? 0.12 : teilNr == 2 ? 0.37 : 0.0;
stoff = mix(stoff, saumF, 1.0 - smoothstep(bandBreite - 0.02, bandBreite + 0.02, vSaum));
if (teilNr == 3) {
    // Sohle und Stollen dunkel
    stoff = mix(stoff, vec3(0.05), smoothstep(0.022, 0.012, vRuhe.y));
}
if (uMitNummer > 0.5 && teilNr == 0) {
    if (vRuheN.x < -0.2) {
        vec2 nuv = vec2((vRuhe.z + 0.14) / 0.28, (vRuhe.y - 1.10) / 0.36);
        if (nuv.x > 0.0 && nuv.x < 1.0 && nuv.y > 0.0 && nuv.y < 1.0) stoff = mix(stoff, uNummerFarbe, texture2D(uNummer, nuv).a);
    } else if (vRuheN.x > 0.3) {
        vec2 nuv = vec2((0.06 - vRuhe.z) / 0.12, (vRuhe.y - 1.22) / 0.12 * 0.8);
        if (nuv.x > 0.0 && nuv.x < 1.0 && nuv.y > 0.0 && nuv.y < 0.8) stoff = mix(stoff, uNummerFarbe, texture2D(uNummer, nuv).a);
    }
}
diffuseColor.rgb *= stoff;`)
                .replace("#include <roughnessmap_fragment>", "float roughnessFactor = teilNr == 3 ? 0.4 : 0.84;");
        };
        m.customProgramCacheKey = () => "menschen-trikot";
        return m;
    }

    /** Rückennummer mit Namen darüber - oben der Name, darunter die Zahl */
    static nummerBild(nummer, name) {
        if (typeof document === "undefined" || typeof document.createElement !== "function" || !nummer) return null;
        const c = document.createElement("canvas");
        if (!c || typeof c.getContext !== "function") return null;
        c.width = 256; c.height = 330;
        const g = c.getContext("2d");
        if (!g) return null;
        g.fillStyle = "#fff";
        g.textAlign = "center";
        g.textBaseline = "middle";
        const n = String(name || "").toUpperCase().slice(0, 14);
        if (n) {
            let px = 44;
            g.font = `700 ${px}px Inter, system-ui, sans-serif`;
            while (px > 18 && g.measureText(n).width > 240) { px -= 2; g.font = `700 ${px}px Inter, system-ui, sans-serif`; }
            g.fillText(n, 128, 30);
        }
        g.font = "800 230px Inter, system-ui, sans-serif";
        const z = String(nummer);
        const breite = g.measureText(z).width;
        g.save();
        if (breite > 236) { g.translate(128, 0); g.scale(236 / breite, 1); g.translate(-128, 0); }
        g.fillText(z, 128, 205);
        g.restore();
        const t = new THREE.CanvasTexture(c);
        t.anisotropy = 4;
        return t;
    }

    // ------------------------------------------------------------ Bewegung

    /**
     * Für jeden Knochen die Ruhehaltung der Ansicht (aufrecht, Arme hängen)
     * und welches der elf Gelenke ihn dreht. Die Drehung eines Gelenks ist
     * in Weltachsen der Ruhehaltung gemeint; für den Knochen wird daraus
     * lokal = Ruhe(Eltern)⁻¹ · Drehung · Ruhe(Knochen).
     */
    _ruhe() {
        const kn = this.d.knochen;
        const name = kn.map(k => k.name);
        this.knochenNr = (n) => name.indexOf(n);
        const Q = (a) => new THREE.Quaternion().fromArray(a);
        this._links = kn.map(k => k.eltern < 0 ? new THREE.Quaternion() : Q(kn[k.eltern].ruhe).invert());
        this._rechts = kn.map(k => Q(k.ruhe));
        this._fest = kn.map((k, i) => this._links[i].clone().multiply(this._rechts[i]));
        const Z = [
            ["Spine", "rumpf", 0.34], ["Spine1", "rumpf", 0.33], ["Spine2", "rumpf", 0.33],
            ["Neck", "kopf", 0.4], ["Head", "kopf", 0.6],
            ["LeftShoulder", "arm0", 0.12], ["LeftArm", "arm0", 0.88], ["LeftForeArm", "ell0", 1],
            ["RightShoulder", "arm1", 0.12], ["RightArm", "arm1", 0.88], ["RightForeArm", "ell1", 1],
            ["LeftUpLeg", "bein0", 1], ["LeftLeg", "knie0", 1], ["LeftFoot", "fuss0", 1],
            ["RightUpLeg", "bein1", 1], ["RightLeg", "knie1", 1], ["RightFoot", "fuss1", 1]
        ];
        this._zuordnung = Z.map(([n, quelle, anteil]) => ({ i: this.knochenNr(n), quelle, anteil })).filter(z => z.i >= 0);
        this._huefte = this.knochenNr("Hips");
        // Locker gekrümmte Finger, der Daumen weniger
        this._finger = [];
        kn.forEach((k, i) => {
            const m = /^(Left|Right)Hand(Index|Middle|Ring|Pinky|Thumb)(\d)$/.exec(k.name);
            if (!m) return;
            const seite = m[1] === "Left" ? -1 : 1;
            const winkel = m[2] === "Thumb" ? 0.1 : [0.2, 0.3, 0.2][Number(m[3]) - 1];
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), seite * winkel);
            this._finger.push({ i, q });
        });
    }

    /**
     * Ein Spieler: Haut, Kleidung, Augen, Brauen, Wimpern, Haare - alle
     * über demselben Skelett. Aussehen und Körperbau aus einem festen
     * Zufall je Spieler.
     */
    erzeuge({ zufall, torwart, farben, saumFarben, nummer, name, nummerFarbe, schatten = true, glaetten = true }) {
        const d = this.d;
        const gruppe = new THREE.Group();
        const knochen = d.knochen.map(k => {
            const b = new THREE.Bone();
            b.name = k.name;
            b.position.fromArray(k.pos);
            b.quaternion.fromArray(k.quat);
            return b;
        });
        d.knochen.forEach((k, i) => { if (k.eltern >= 0) knochen[k.eltern].add(knochen[i]); });

        // Aussehen: Haut, Gesicht, Haare
        const hautNr = Math.floor(zufall() * d.haut.length);
        const haut = d.haut[hautNr];
        const dunkel = haut.herkunft !== "";
        const haarFarben = dunkel ? ["#120d0a", "#1b1410", "#0b0b0b", "#2a1d14"] : ["#1c140f", "#3b2a1f", "#5a3d26", "#0b0b0b", "#8a6236", "#c9a061", "#2b2b2b"];
        const haarFarbe = haarFarben[Math.floor(zufall() * haarFarben.length)];
        let frisur = Math.floor(zufall() * d.haare.length);
        if (haut.herkunft === "afrikanisch" && zufall() < 0.45) frisur = d.haare.findIndex(h => h.id === "afro01");
        if (haut.herkunft !== "afrikanisch" && d.haare[frisur]?.id === "afro01") frisur = 0;
        const ohneHaar = zufall() < 0.06;
        const augen = dunkel ? Math.floor(zufall() * 2) : Math.floor(zufall() * d.augenbilder.length);
        const braue = Math.floor(zufall() * d.brauen.length);
        const formen = d.formen.map(f => {
            if (f === "afrikanisch") return haut.herkunft === "afrikanisch" ? 0.75 : 0;
            if (f === "asiatisch") return haut.herkunft === "asiatisch" ? 0.75 : 0;
            if (f === "reif") return haut.id.startsWith("middleage") ? 0.6 : zufall() * 0.3;
            if (f === "kraeftig" || f === "schmal") return 0;
            return Math.max(0, zufall() * 1.3 - 0.35);
        });
        const bau = zufall();
        formen[d.formen.indexOf("kraeftig")] = Math.max(0, bau - 0.55) * 2;
        formen[d.formen.indexOf("schmal")] = Math.max(0, 0.4 - bau) * 2;

        const netze = [];
        const netz = (geo, mat, schatten) => {
            const m = new THREE.SkinnedMesh(geo, mat);
            m.frustumCulled = false;
            m.castShadow = schatten;
            m.morphTargetInfluences = formen.slice();
            netze.push(m);
            gruppe.add(m);
            return m;
        };
        const koerper = netz(this._geometrie(torwart ? "haut-tw" : "haut-feld", d.koerper, torwart ? d.koerper.index.torwart : d.koerper.index.feld),
            this._stoff("haut" + hautNr, () => new THREE.MeshStandardMaterial({ map: this._bild(haut.bild), roughness: 0.6, metalness: 0 })), schatten);
        const kleid = torwart ? d.kleidung.torwart : d.kleidung.feld;
        const stoff = Menschen3D.trikotStoff(farben, saumFarben, Menschen3D.nummerBild(nummer, name), nummerFarbe);
        const kleidung = netz(this._geometrie(torwart ? "kleid-tw" : "kleid-feld", kleid), stoff, schatten);
        const augenBild = d.augenbilder[augen];
        netz(this._geometrie("augen", d.augen), this._stoff("augen" + augen,
            () => new THREE.MeshStandardMaterial({ map: this._bild(augenBild.bild), roughness: 0.2, metalness: 0 })), false);
        const durchsichtig = (bild, farbe) => new THREE.MeshStandardMaterial({
            map: this._bild(bild), color: farbe, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.8, metalness: 0
        });
        const br = d.brauen[braue];
        netz(this._geometrie("braue" + braue, br.netz), this._stoff("braue" + braue + haarFarbe, () => durchsichtig(br.bild, haarFarbe)), false).renderOrder = 2;
        netz(this._geometrie("wimpern", d.wimpern), this._stoff("wimpern", () => durchsichtig(d.wimpernbild, "#1a1410")), false).renderOrder = 2;
        let haar = null;
        if (!ohneHaar && frisur >= 0) {
            const h = d.haare[frisur];
            haar = netz(this._geometrie("haar" + frisur, h.netz), this._stoff("haar" + frisur + haarFarbe, () => new THREE.MeshStandardMaterial({
                map: this._bild(h.bild), color: haarFarbe, alphaTest: 0.5, alphaToCoverage: glaetten, side: THREE.DoubleSide, roughness: 0.62, metalness: 0
            })), schatten);
        }

        koerper.add(knochen[0]);
        gruppe.updateMatrixWorld(true);
        const skelett = new THREE.Skeleton(knochen);
        netze.forEach(m => m.bind(skelett, koerper.bindMatrix));
        // In die Ruhehaltung der Ansicht
        knochen.forEach((b, i) => b.quaternion.copy(this._fest[i]));
        this._finger.forEach(({ i, q }) => b4(knochen[i], this._links[i], q, this._rechts[i]));

        const huefteRuhe = new THREE.Vector3().fromArray(d.knochen[this._huefte].pos);
        const kopf = knochen[this.knochenNr("Head")];
        return {
            gruppe, koerper, kleidung, haar, knochen, skelett, kopf, netze, stoff,
            aussehen: { haut: haut.id, frisur: ohneHaar ? null : d.haare[frisur]?.id, formen },
            treibe: (f, dt) => this._treibe(f, dt || 0, knochen, huefteRuhe),
            fussAmBall: (art, linksfuss) => this.fussAmBall(art, linksfuss)
        };
    }

    // ------------------------------------------------------------ Haltungen

    _haltung() {
        const nb = this.bw ? this.bw.nb : 0;
        return { q: new Float32Array(nb * 4), h: new Float32Array(3) };
    }

    /** Ein Stück an einer Stelle (in Bildern, auch zwischen zwei Bildern) - gespiegelt für Linksfüße */
    _probe(c, bild, spiegeln, ziel) {
        const n = c.bilder, nb = this.bw.nb;
        let f;
        if (c.schleife) f = ((bild % n) + n) % n;
        else if (c.pendel) { const l = 2 * (n - 1), p = ((bild % l) + l) % l; f = p > n - 1 ? l - p : p; }
        else f = Math.max(0, Math.min(n - 1, bild));
        const a = Math.floor(f), b = c.schleife ? (a + 1) % n : Math.min(n - 1, a + 1), u = f - a;
        for (let j = 0; j < nb; j++) {
            const k = spiegeln ? this.bw.spiegel[j] : j;
            const oa = (a * nb + k) * 4, ob = (b * nb + k) * 4;
            const vz = c.q[oa] * c.q[ob] + c.q[oa + 1] * c.q[ob + 1] + c.q[oa + 2] * c.q[ob + 2] + c.q[oa + 3] * c.q[ob + 3] < 0 ? -1 : 1;
            let x = c.q[oa] + (vz * c.q[ob] - c.q[oa]) * u, y = c.q[oa + 1] + (vz * c.q[ob + 1] - c.q[oa + 1]) * u;
            const z = c.q[oa + 2] + (vz * c.q[ob + 2] - c.q[oa + 2]) * u, w = c.q[oa + 3] + (vz * c.q[ob + 3] - c.q[oa + 3]) * u;
            if (spiegeln) { x = -x; y = -y; }
            const l = Math.hypot(x, y, z, w) || 1;
            ziel.q[j * 4] = x / l; ziel.q[j * 4 + 1] = y / l; ziel.q[j * 4 + 2] = z / l; ziel.q[j * 4 + 3] = w / l;
        }
        for (let k = 0; k < 3; k++) ziel.h[k] = c.h[a * 3 + k] + (c.h[b * 3 + k] - c.h[a * 3 + k]) * u;
        if (spiegeln) ziel.h[2] = -ziel.h[2];
        return ziel;
    }

    /** a := a + (b - a) · t, je Knochen auf dem kürzesten Weg */
    static _mische(a, b, t) {
        if (t <= 0) return a;
        const q = a.q, r = b.q;
        for (let o = 0; o < q.length; o += 4) {
            const vz = q[o] * r[o] + q[o + 1] * r[o + 1] + q[o + 2] * r[o + 2] + q[o + 3] * r[o + 3] < 0 ? -1 : 1;
            let x = q[o] + (vz * r[o] - q[o]) * t, y = q[o + 1] + (vz * r[o + 1] - q[o + 1]) * t;
            let z = q[o + 2] + (vz * r[o + 2] - q[o + 2]) * t, w = q[o + 3] + (vz * r[o + 3] - q[o + 3]) * t;
            const l = Math.hypot(x, y, z, w) || 1;
            q[o] = x / l; q[o + 1] = y / l; q[o + 2] = z / l; q[o + 3] = w / l;
        }
        for (let k = 0; k < 3; k++) a.h[k] += (b.h[k] - a.h[k]) * t;
        return a;
    }

    /**
     * Fortbewegung nach Tempo: Stehen, Gehen, Traben, Laufen - je zwei
     * Nachbarn übergeblendet, alle im selben Schritttakt (Takt 0 = linker
     * Fuß setzt auf). Schneller als die Laufaufnahme wird der Takt höher.
     */
    _fortbewegung(f, dt, ziel) {
        const c = this.bw.clips, z = f.zug;
        const skala = f.figur.scale.x || 1;
        const v = (z.tempo || 0) / skala;
        const stufen = [c.gehen, c.traben, c.laufen];
        let a, b, t, takt;
        if (v <= stufen[0].tempo) { a = null; b = stufen[0]; t = v / stufen[0].tempo; takt = Math.max(0.55, t) / b.dauer; }
        else if (v >= stufen[2].tempo) { a = stufen[2]; b = null; t = 0; takt = Math.pow(v / a.tempo, 0.6) / a.dauer; }
        else {
            const i = v < stufen[1].tempo ? 0 : 1;
            a = stufen[i]; b = stufen[i + 1];
            t = (v - a.tempo) / (b.tempo - a.tempo);
            takt = (1 - t) / a.dauer + t / b.dauer;
        }
        z.takt = (z.takt + dt * takt) % 1;
        z.stehen += dt;
        const zyk = (clip, out) => this._probe(clip, (((z.takt - (clip.versatz || 0)) % 1) + 1) % 1 * clip.bilder, false, out);
        if (a === null) {
            this._probe(c.stand, z.stehen * this.bw.fps, false, ziel);
            if (t > 0.02) Menschen3D._mische(ziel, zyk(b, z.tmp), Math.min(1, t * 1.4));
        } else {
            zyk(a, ziel);
            if (b) Menschen3D._mische(ziel, zyk(b, z.tmp), t);
        }
        return ziel;
    }

    /** Die elf Gelenke (berechnete Bewegungen) als Haltung des Menschen */
    _ausGelenken(f, huefteRuhe, ziel) {
        const q = Menschen3D._tmp, bw = this.bw;
        ziel.q.fill(0);
        for (let j = 0; j < bw.nb; j++) ziel.q[j * 4 + 3] = 1;
        const quelle = this._quellen(f);
        this._zuordnung.forEach(({ i, quelle: k, anteil }) => {
            const j = bw.knochen.indexOf(i);
            if (j < 0) return;
            const r = anteil === 1 ? quelle[k] : q.a.slerpQuaternions(q.e.identity(), quelle[k], anteil);
            ziel.q[j * 4] = r.x; ziel.q[j * 4 + 1] = r.y; ziel.q[j * 4 + 2] = r.z; ziel.q[j * 4 + 3] = r.w;
        });
        const k = f.koerper.quaternion, h = bw.huefte * 4;
        ziel.q[h] = k.x; ziel.q[h + 1] = k.y; ziel.q[h + 2] = k.z; ziel.q[h + 3] = k.w;
        q.v.copy(huefteRuhe).applyQuaternion(k).add(f.koerper.position).sub(huefteRuhe);
        ziel.h[0] = q.v.x; ziel.h[1] = q.v.y; ziel.h[2] = q.v.z;
        return ziel;
    }

    _quellen(f) {
        const q = Menschen3D._tmp;
        const fuss = Menschen3D.fuesse(f);
        this._fuss = this._fuss || [new THREE.Quaternion(), new THREE.Quaternion()];
        this._fuss[0].setFromAxisAngle(q.z, fuss[0]);
        this._fuss[1].setFromAxisAngle(q.z, fuss[1]);
        return {
            rumpf: f.rumpf.quaternion, kopf: f.kopf.quaternion,
            arm0: f.arme[0].quaternion, arm1: f.arme[1].quaternion, ell0: f.ellbogen[0].quaternion, ell1: f.ellbogen[1].quaternion,
            bein0: f.beine[0].quaternion, bein1: f.beine[1].quaternion, knie0: f.knie[0].quaternion, knie1: f.knie[1].quaternion,
            fuss0: this._fuss[0], fuss1: this._fuss[1]
        };
    }

    /**
     * Jedes Bild: die Haltung bestimmen und auf das Skelett legen. Mit
     * Aufnahmen ist die Fortbewegung die Grundlage; Schuss, Pass, Flanke und
     * Kopfball blenden ihre Aufnahme darüber, die übrigen Abläufe (und die
     * Bereitschaft des Torwarts) die berechneten Gelenke.
     */
    _treibe(f, dt, knochen, huefteRuhe) {
        const q = Menschen3D._tmp || (Menschen3D._tmp = { a: new THREE.Quaternion(), e: new THREE.Quaternion(), r: new THREE.Quaternion(), z: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3() });
        // Ohne Aufnahmen: wie die gezeichnete Figur, nur auf 52 Knochen
        if (!this.bw) return this._treibeGelenke(f, knochen, huefteRuhe);
        const bw = this.bw;
        const z = f.zug || (f.zug = { takt: Math.random(), stehen: Math.random() * 4, tempo: 0, tmp: this._haltung(), aktion: this._haltung(), haltung: this._haltung(), alt: null });
        // Tempo aus der Bewegung der Figur, geglättet
        const p = f.figur.position;
        if (z.alt && dt > 0) {
            const v = Math.min(12, Math.hypot(p.x - z.alt.x, p.z - z.alt.z) / dt);
            z.tempo += (v - z.tempo) * Math.min(1, dt * 5);
        }
        z.alt = { x: p.x, z: p.z };
        const haltung = this._fortbewegung(f, dt, z.haltung);

        const a = f.anim;
        let kopfNicken = 0;
        if (a && a.t >= 0) {
            const ein = Spielfeld3D.glatt(a.t / 0.12) * Spielfeld3D.glatt((a.dauer - a.t) / 0.22);
            const clip = { schuss: "schuss", flanke: "schuss", pass: "pass", kopfball: "sprung" }[a.art];
            if (clip && bw.clips[clip]) {
                const c = bw.clips[clip];
                const spiegeln = a.art !== "kopfball" && (c.bein === "rechts" ? f.schussBein === 0 : f.schussBein === 1);
                this._probe(c, c.kontakt + (a.t - a.kontakt) * bw.fps, spiegeln, z.aktion);
                if (a.art === "kopfball") {
                    // Der Kopf erreicht den Ball im höchsten Punkt: Sprunghöhe wie berechnet
                    const hoch = Spielfeld3D.spur(Spielfeld3D.POSEN.kopfball, 0)[0];
                    if (c.scheitel > 0) z.aktion.h[1] *= hoch / c.scheitel;
                    f.figur.position.y = 0;
                    kopfNicken = Spielfeld3D.spur(Spielfeld3D.POSEN.kopfball, a.t - a.kontakt)[6] * ein;
                }
                Menschen3D._mische(haltung, z.aktion, ein);
            } else {
                Menschen3D._mische(haltung, this._ausGelenken(f, huefteRuhe, z.aktion), ein);
            }
        } else if (f.bereit > 0) {
            Menschen3D._mische(haltung, this._ausGelenken(f, huefteRuhe, z.aktion), f.bereit);
        }

        this._anlegen(knochen, haltung, huefteRuhe, kopfNicken);
    }

    /** Eine Haltung aufs Skelett: lokal = Ruhe(Eltern)⁻¹ · Drehung · Ruhe(Knochen) */
    _anlegen(knochen, haltung, huefteRuhe, kopfNicken = 0) {
        const q = Menschen3D._tmp, bw = this.bw;
        for (let j = 0; j < bw.nb; j++) {
            const i = bw.knochen[j];
            q.r.set(haltung.q[j * 4], haltung.q[j * 4 + 1], haltung.q[j * 4 + 2], haltung.q[j * 4 + 3]);
            if (kopfNicken && knochen[i].name === "Head") q.r.multiply(q.a.setFromAxisAngle(q.z, kopfNicken));
            b4(knochen[i], this._links[i], q.r, this._rechts[i]);
        }
        knochen[this._huefte].position.copy(huefteRuhe).add(q.v.set(haltung.h[0], haltung.h[1], haltung.h[2]));
    }

    /**
     * Wo die Zehe des Schussbeins im Moment des Kontakts steht - vom
     * Mittelpunkt der Figur aus, im eigenen Maß, Blick nach +x. Die Ansicht
     * stellt den Spieler so, dass genau dieser Fuß den Ball trifft.
     */
    fussAmBall(art, linksfuss) {
        const name = { schuss: "schuss", flanke: "schuss", pass: "pass" }[art];
        const c = this.bw && this.bw.clips[name];
        if (!c) return null;
        const schluessel = name + (linksfuss ? "L" : "R");
        this._amBall = this._amBall || {};
        if (this._amBall[schluessel]) return this._amBall[schluessel];
        Menschen3D._tmp = Menschen3D._tmp || { a: new THREE.Quaternion(), e: new THREE.Quaternion(), r: new THREE.Quaternion(), z: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3() };
        const d = this.d;
        const knochen = d.knochen.map(k => { const b = new THREE.Bone(); b.name = k.name; b.position.fromArray(k.pos); b.quaternion.fromArray(k.quat); return b; });
        d.knochen.forEach((k, i) => { if (k.eltern >= 0) knochen[k.eltern].add(knochen[i]); });
        const wurzel = new THREE.Group();
        wurzel.add(knochen[0]);
        knochen.forEach((b, i) => b.quaternion.copy(this._fest[i]));
        const spiegeln = c.bein === "rechts" ? linksfuss : !linksfuss;
        const huefteRuhe = new THREE.Vector3().fromArray(d.knochen[this._huefte].pos);
        this._anlegen(knochen, this._probe(c, c.kontakt, spiegeln, this._haltung()), huefteRuhe);
        wurzel.updateMatrixWorld(true);
        const zeh = knochen[this.knochenNr(linksfuss ? "LeftToeBase" : "RightToeBase")].getWorldPosition(new THREE.Vector3());
        return (this._amBall[schluessel] = { x: zeh.x, z: zeh.z });
    }

    /** Ohne Aufnahmen: die elf Gelenke direkt auf das Skelett übertragen */
    _treibeGelenke(f, knochen, huefteRuhe) {
        const q = Menschen3D._tmp;
        const quelle = this._quellen(f);
        this._zuordnung.forEach(({ i, quelle: k, anteil }) => {
            const r = quelle[k];
            if (anteil === 1) b4(knochen[i], this._links[i], r, this._rechts[i]);
            else b4(knochen[i], this._links[i], q.a.slerpQuaternions(q.e.identity(), r, anteil), this._rechts[i]);
        });
        // Das Becken trägt alles: Drehung um den Boden zwischen den Füßen, dazu der Versatz
        const h = knochen[this._huefte];
        h.quaternion.copy(f.koerper.quaternion).multiply(this._rechts[this._huefte]);
        h.position.copy(huefteRuhe).applyQuaternion(f.koerper.quaternion).add(f.koerper.position);
    }

    /**
     * Wie der Fuß zum Unterschenkel steht (Drehung um die Querachse, positiv
     * hebt die Zehen). Im Stand und beim Aufsetzen flach auf dem Boden,
     * beim Abdruck über die Zehen abgerollt, in der Schwungphase locker.
     * Beim Schuss ist der Spann gestreckt.
     */
    static fuesse(f) {
        const out = [0, 0];
        const lauf = f.lauf || 0;
        for (let i = 0; i < 2; i++) {
            const schien = f.koerper.rotation.z + f.beine[i].rotation.z + f.knie[i].rotation.z;
            const ph = (f.phase || 0) + i * Math.PI;
            const stand = Spielfeld3D.glatt((-Math.cos(ph) + 0.2) / 0.4);
            const abdruck = -0.5 * Spielfeld3D.glatt((-Math.sin(ph) - 0.3) / 0.7) * lauf;
            const schwung = schien * 0.5 - 0.25 * lauf;
            let welt = schwung + (abdruck - schwung) * stand;
            const a = f.anim;
            if (a && a.t >= 0) {
                const tau = a.t - a.kontakt;
                if ((a.art === "pass" || a.art === "schuss" || a.art === "flanke") && i === f.schussBein) {
                    welt = schien - 0.65 * Spielfeld3D.glatt(1 - Math.abs(tau + 0.02) / 0.22);
                } else if (f.figur && f.figur.position.y > 0.08) {
                    welt = schien - 0.35;
                } else {
                    welt = 0;
                }
            }
            out[i] = Math.max(-0.95, Math.min(0.75, welt - schien));
        }
        return out;
    }
}

/** knochen.quaternion = links · dreh · rechts */
function b4(knochen, links, dreh, rechts) {
    knochen.quaternion.copy(links).multiply(dreh).multiply(rechts);
}

if (typeof module !== "undefined") module.exports = Menschen3D;
