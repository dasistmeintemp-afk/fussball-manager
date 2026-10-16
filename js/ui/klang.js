/**
 * Klang - Pfiffe, Stadionkulisse, Menütöne und Menümusik (Web Audio)
 *
 * Bisher war jeder Ton ein einzelner Sinus: Der Pfiff ein gleitender
 * Piepton, das Tor eine kleine Spielhallen-Fanfare, die auch beim
 * unterschriebenen Vertrag erklang, und die Kulisse ein einziges
 * gefiltertes Rauschen. Jetzt:
 *
 *  - Der Pfiff klingt wie eine Kugelpfeife: zwei eng beieinander liegende
 *    Töne um 3 kHz, die Kugel lässt sie flattern, dazu etwas Atem. Kurz
 *    beim Abseits, kräftig beim Foul, lang beim Anpfiff, zweimal zur
 *    Halbzeit und dreimal zum Abpfiff, der letzte lang.
 *  - Die Kulisse ist Rauschen in drei Stimmlagen und einem tiefen Grollen,
 *    das in jeder Lage für sich an- und abschwillt - viele Stimmen statt
 *    eines Brummens. Wird es spannend, klingt sie heller und lauter.
 *  - Ein Heimtor lässt das Stadion aufschreien, beim Gegentor jubelt nur
 *    der ferne Gästeblock. Dazu Raunen, Pfeifkonzert, Applaus, ein
 *    Rhythmus der Kurve, der dumpfe Schuss und der Klang des Pfostens.
 *  - Im Menü leise Töne statt Pfiff und Torfanfare.
 *  - Menümusik: ein ruhiges, selbst komponiertes Stück im Stil von Lo-fi -
 *    weiches E-Piano, Bass, Besen, ab und zu eine Melodie. Es wird beim
 *    Spielen zusammengesetzt und klingt deshalb nie ganz gleich. Im
 *    Livespiel blendet es aus, dort spielt die Kulisse.
 *
 * Alles wird im Browser erzeugt - keine Aufnahmen, keine Rechte Dritter.
 * Jeder Klang nimmt einen Startzeitpunkt und lässt sich so auch in einen
 * OfflineAudioContext rendern (Hörproben, Tests). Gewürfelt wird mit einem
 * eigenen Zufallsgenerator; Math.random bleibt unberührt.
 */
class Klang {
    constructor(ctx, optionen = {}) {
        this.ctx = ctx;
        this._zufall = Klang.zufallsgenerator(optionen.seed ?? 20251016);

        // Ausgang mit Kompressor: Nichts übersteuert, auch wenn Jubel,
        // Pfiff und Kulisse zusammenkommen
        this.kompressor = ctx.createDynamicsCompressor();
        this.kompressor.threshold.value = -12;
        this.kompressor.knee.value = 10;
        this.kompressor.ratio.value = 4;
        this.kompressor.attack.value = 0.005;
        this.kompressor.release.value = 0.25;
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.kompressor.connect(this.master);
        this.master.connect(ctx.destination);

        this.effekte = this._bus(1);
        this.kulisseBus = this._bus(1);
        this.musikBus = this._bus(0);
        this.musikLautstaerke = optionen.musikLautstaerke ?? 0.6;

        this._puffer = {};
        this._kulisse = null;
        this._musik = null;
    }

    // ------------------------------------------------------------ Grundlagen

    /** Kleiner, schneller Zufallsgenerator (mulberry32) - fest je Startwert */
    static zufallsgenerator(seed) {
        let a = seed >>> 0;
        return () => {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            let t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    static midiZuHz(n) {
        return 440 * Math.pow(2, (n - 69) / 12);
    }

    _bus(wert) {
        const g = this.ctx.createGain();
        g.gain.value = wert;
        g.connect(this.kompressor);
        return g;
    }

    _jetzt(t) {
        return typeof t === "number" ? t : this.ctx.currentTime + 0.02;
    }

    /** Rauschen als Puffer: weiß, rosa oder braun, auf Wunsch in Stereo */
    _rauschen(art = "weiss", sekunden = 3, kanaele = 1) {
        const key = `${art}|${sekunden}|${kanaele}`;
        if (this._puffer[key]) return this._puffer[key];
        const rate = this.ctx.sampleRate;
        const puffer = this.ctx.createBuffer(kanaele, Math.floor(rate * sekunden), rate);
        for (let k = 0; k < kanaele; k++) {
            const d = puffer.getChannelData(k);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, letzt = 0;
            for (let i = 0; i < d.length; i++) {
                const w = this._zufall() * 2 - 1;
                if (art === "rosa") {
                    // Rosa Rauschen nach Paul Kellet
                    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
                    b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
                    b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
                    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
                    b6 = w * 0.115926;
                } else if (art === "braun") {
                    letzt = (letzt + 0.02 * w) / 1.02;
                    d[i] = letzt * 3.5;
                } else {
                    d[i] = w;
                }
            }
        }
        this._puffer[key] = puffer;
        return puffer;
    }

    /** Eine Rauschquelle, die bei t startet (versetzt im Puffer, damit sich nichts wiederholt) */
    _rauschQuelle(art, t, dauer = null, kanaele = 1, schleife = false) {
        const q = this.ctx.createBufferSource();
        q.buffer = this._rauschen(art, schleife ? 6 : 3, kanaele);
        q.loop = schleife || (dauer !== null && dauer > q.buffer.duration - 0.1);
        const versatz = this._zufall() * Math.max(0, q.buffer.duration - (dauer || 0) - 0.05);
        q.start(t, q.loop ? 0 : versatz);
        if (dauer !== null) q.stop(t + dauer + 0.05);
        return q;
    }

    _filter(typ, frequenz, q = 1) {
        const f = this.ctx.createBiquadFilter();
        f.type = typ;
        f.frequency.value = frequenz;
        f.Q.value = q;
        return f;
    }

    _gain(wert = 0) {
        const g = this.ctx.createGain();
        g.gain.value = wert;
        return g;
    }

    /** Hüllkurve: anschwellen, halten, ausklingen */
    _huelle(param, t, { anstieg = 0.01, halten = 0, abklingen = 0.2, spitze = 1 } = {}) {
        param.setValueAtTime(0.0001, t);
        param.linearRampToValueAtTime(spitze, t + anstieg);
        if (halten > 0) param.setValueAtTime(spitze, t + anstieg + halten);
        param.exponentialRampToValueAtTime(0.0001, t + anstieg + halten + abklingen);
        return t + anstieg + halten + abklingen;
    }

    /** Ein künstlicher Hall: abklingendes Rauschen als Impulsantwort */
    _hall(sekunden = 2.2) {
        const key = `hall|${sekunden}`;
        if (this._puffer[key]) return this._puffer[key];
        const rate = this.ctx.sampleRate;
        const n = Math.floor(rate * sekunden);
        const puffer = this.ctx.createBuffer(2, n, rate);
        for (let k = 0; k < 2; k++) {
            const d = puffer.getChannelData(k);
            for (let i = 0; i < n; i++) d[i] = (this._zufall() * 2 - 1) * Math.pow(1 - i / n, 3.2);
        }
        this._puffer[key] = puffer;
        return puffer;
    }

    // ------------------------------------------------------------- Pfiffe

    /**
     * Ein Pfiff der Kugelpfeife: zwei Töne im Abstand von gut 4 %, die Kugel
     * moduliert Höhe und Lautstärke mit 25-35 Hz, dazu Atemrauschen.
     */
    pfeife(t, dauer = 0.3, staerke = 1) {
        const c = this.ctx;
        t = this._jetzt(t);
        const f0 = 2900 + this._zufall() * 200;
        const aus = this._gain(0);
        aus.connect(this.effekte);
        const pegel = 0.16 * staerke;
        aus.gain.setValueAtTime(0.0001, t);
        aus.gain.linearRampToValueAtTime(pegel, t + 0.018);
        aus.gain.setValueAtTime(pegel, t + Math.max(0.02, dauer - 0.06));
        aus.gain.linearRampToValueAtTime(0.0001, t + dauer);

        // Die Kugel: schnelles Flattern
        const lfo = c.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 25 + this._zufall() * 10;
        const fm = this._gain(90 + this._zufall() * 50);
        lfo.connect(fm);
        const am = this._gain(0.75);
        const amTiefe = this._gain(0.25);
        lfo.connect(amTiefe);
        amTiefe.connect(am.gain);
        am.connect(aus);

        [[f0, 0.6], [f0 * 1.042, 0.45], [f0 * 2.01, 0.06]].forEach(([f, l]) => {
            const o = c.createOscillator();
            o.type = "sine";
            // Der Druck baut sich auf: die ersten Millisekunden etwas tiefer
            o.frequency.setValueAtTime(f * 0.96, t);
            o.frequency.linearRampToValueAtTime(f, t + 0.04);
            fm.connect(o.frequency);
            const g = this._gain(l);
            o.connect(g);
            g.connect(am);
            o.start(t);
            o.stop(t + dauer + 0.05);
        });
        lfo.start(t);
        lfo.stop(t + dauer + 0.05);

        // Atem: Rauschen um die Tonhöhe, beim Ansatz etwas mehr
        const atem = this._rauschQuelle("weiss", t, dauer);
        const bp = this._filter("bandpass", f0, 5);
        const ag = this._gain(0);
        ag.gain.setValueAtTime(0.0001, t);
        ag.gain.linearRampToValueAtTime(0.5, t + 0.012);
        ag.gain.linearRampToValueAtTime(0.18, t + 0.06);
        ag.gain.setValueAtTime(0.18, t + Math.max(0.07, dauer - 0.05));
        ag.gain.linearRampToValueAtTime(0.0001, t + dauer);
        atem.connect(bp); bp.connect(ag); ag.connect(aus);
        return t + dauer;
    }

    /** Pfiffmuster: Längen der einzelnen Pfiffe und Pausen dazwischen (Sekunden) */
    static PFIFFE = {
        kurz: { teile: [0.2], staerke: 0.8 },
        foul: { teile: [0.32], staerke: 1 },
        karte: { teile: [0.5], staerke: 1.05 },
        anpfiff: { teile: [0.75], staerke: 0.95 },
        halbzeit: { teile: [0.4, 0.95], pause: 0.18, staerke: 1 },
        abpfiff: { teile: [0.35, 0.35, 1.25], pause: 0.17, staerke: 1.05 },
        menue: { teile: [0.28], staerke: 0.45 }
    };

    pfiff(art = "kurz", t) {
        const m = Klang.PFIFFE[art] || Klang.PFIFFE.kurz;
        let zeit = this._jetzt(t);
        m.teile.forEach(d => { zeit = this.pfeife(zeit, d, m.staerke) + (m.pause || 0.15); });
        return zeit;
    }

    // ------------------------------------------------------------ Kulisse

    /**
     * Die Stadionkulisse: Rauschen in drei Stimmlagen (Vokal-Formanten) und
     * ein tiefes Grollen, jede Lage schwillt für sich an und ab. staerke
     * 0..1 ist die Größe der Kulisse (Auslastung, Bedeutung des Spiels).
     */
    starteKulisse(staerke = 0.5, t) {
        if (this._kulisse) return this._kulisse;
        t = this._jetzt(t);
        const aus = this._gain(0);
        aus.connect(this.kulisseBus);
        const lagen = [
            { f: 380, q: 1.1, pegel: 1.0 },
            { f: 950, q: 1.4, pegel: 0.55 },
            { f: 2300, q: 2.0, pegel: 0.18 }
        ].map(l => {
            const q = this._rauschQuelle("rosa", t, null, 2, true);
            const bp = this._filter("bandpass", l.f, l.q);
            const g = this._gain(l.pegel);
            q.connect(bp); bp.connect(g); g.connect(aus);
            return { ...l, quelle: q, filter: bp, gain: g };
        });
        const grollen = this._rauschQuelle("braun", t, null, 2, true);
        const tp = this._filter("lowpass", 220, 0.7);
        const gg = this._gain(0.55);
        grollen.connect(tp); tp.connect(gg); gg.connect(aus);
        this._kulisse = { aus, lagen, grollen, staerke, pegel: 0, erregung: 0, geplantBis: t, quellen: [...lagen.map(l => l.quelle), grollen] };
        this._planeSchwankungen(t + 3);
        return this._kulisse;
    }

    /** Das An- und Abschwellen der Stimmen, im Voraus geplant */
    _planeSchwankungen(bis) {
        const k = this._kulisse;
        if (!k) return;
        while (k.geplantBis < bis) {
            const t = k.geplantBis;
            k.lagen.forEach(l => {
                const ziel = l.pegel * (0.7 + this._zufall() * 0.6);
                l.gain.gain.setTargetAtTime(ziel, t, 0.35 + this._zufall() * 0.5);
            });
            k.geplantBis += 0.45 + this._zufall() * 0.5;
        }
    }

    /**
     * Pegel (0..1) und Erregung (0..1) der Kulisse. Erregung macht die
     * Stimmen heller - gerufen wird höher als gemurmelt.
     */
    setzeKulisse(pegel, erregung = 0, t) {
        const k = this._kulisse;
        if (!k) return;
        t = this._jetzt(t);
        k.pegel = pegel;
        k.erregung = erregung;
        const groesse = 0.55 + 0.45 * k.staerke;
        k.aus.gain.setTargetAtTime(Math.max(0.0001, pegel * groesse * 0.9), t, 0.15);
        k.lagen.forEach(l => l.filter.frequency.setTargetAtTime(l.f * (1 + 0.35 * erregung), t, 0.25));
        this._planeSchwankungen(t + 3);
    }

    stoppeKulisse(ausblenden = 1.2, t) {
        const k = this._kulisse;
        if (!k) return;
        t = this._jetzt(t);
        k.aus.gain.cancelScheduledValues(t);
        k.aus.gain.setTargetAtTime(0.0001, t, ausblenden / 4);
        k.quellen.forEach(q => { try { q.stop(t + ausblenden + 0.2); } catch (e) { /* schon gestoppt */ } });
        this._kulisse = null;
    }

    // -------------------------------------------------------- Stadionklänge

    /** Ein Ruf vieler Stimmen: Rauschen durch Formanten, mit Hüllkurve */
    _stimmen(t, { formanten, dauer, anstieg, spitze, abklingen, gleiten = 1, pan = 0, fern = false, ziel = this.effekte }) {
        const aus = this._gain(0);
        let kette = aus;
        if (pan && this.ctx.createStereoPanner) {
            const p = this.ctx.createStereoPanner();
            p.pan.value = pan;
            aus.connect(p);
            kette = p;
        }
        if (fern) {
            const tp = this._filter("lowpass", 1400, 0.7);
            kette.connect(tp);
            kette = tp;
        }
        kette.connect(ziel);
        const q = this._rauschQuelle("rosa", t, dauer + abklingen, 2);
        formanten.forEach(([f, qf, pegel]) => {
            const bp = this._filter("bandpass", f, qf);
            bp.frequency.setValueAtTime(f, t);
            bp.frequency.linearRampToValueAtTime(f * gleiten, t + anstieg + dauer);
            const g = this._gain(pegel);
            q.connect(bp); bp.connect(g); g.connect(aus);
        });
        this._huelle(aus.gain, t, { anstieg, halten: dauer, abklingen, spitze });
        return t + anstieg + dauer + abklingen;
    }

    /** Torjubel: das ganze Stadion beim Heimtor, nur der ferne Gästeblock beim Tor der Gäste */
    jubel(heim = true, t) {
        t = this._jetzt(t);
        const ende = heim
            ? this._stimmen(t, { formanten: [[650, 0.9, 1], [1300, 1.2, 0.7], [2600, 1.8, 0.3]], dauer: 1.6, anstieg: 0.22, spitze: 0.75, abklingen: 4.5, gleiten: 1.12 })
            : this._stimmen(t, { formanten: [[600, 1, 1], [1200, 1.3, 0.6]], dauer: 1.0, anstieg: 0.25, spitze: 0.22, abklingen: 2.2, gleiten: 1.08, pan: -0.55, fern: true });
        this.applaus(t + (heim ? 1.4 : 1.0), heim ? 3.5 : 2, heim ? 0.55 : 0.12, heim ? 0 : -0.55);
        // Die Kulisse geht beim Heimtor mit, beim Gegentor fällt sie zusammen
        if (this._kulisse) {
            const k = this._kulisse;
            k.aus.gain.setTargetAtTime(heim ? 0.6 : 0.05, t, heim ? 0.2 : 0.4);
            k.aus.gain.setTargetAtTime(Math.max(0.0001, k.pegel * (0.55 + 0.45 * k.staerke) * 0.9), t + (heim ? 5 : 6), 1.2);
        }
        return ende;
    }

    /** Raunen bei einer vergebenen Chance - ein langes, sinkendes "Ohh" */
    raunen(t, staerke = 1) {
        t = this._jetzt(t);
        return this._stimmen(t, { formanten: [[400, 4, 1], [780, 3, 0.7], [2400, 4, 0.1]], dauer: 0.25, anstieg: 0.3, spitze: 0.5 * staerke, abklingen: 1.3, gleiten: 0.85 });
    }

    /** Applaus: viele einzelne Klatscher, zum Ende dünner */
    applaus(t, dauer = 3, staerke = 0.5, pan = 0) {
        t = this._jetzt(t);
        const rate = this.ctx.sampleRate;
        const n = Math.floor(rate * dauer);
        const puffer = this.ctx.createBuffer(1, n, rate);
        const d = puffer.getChannelData(0);
        const anzahl = Math.floor(dauer * 140 * staerke + 40);
        for (let i = 0; i < anzahl; i++) {
            // Dichter am Anfang, dünner zum Schluss
            const pos = Math.floor(Math.pow(this._zufall(), 1.6) * (n - rate * 0.02));
            const laenge = Math.floor(rate * (0.004 + this._zufall() * 0.008));
            const pegel = 0.3 + this._zufall() * 0.7;
            for (let j = 0; j < laenge; j++) d[pos + j] += (this._zufall() * 2 - 1) * pegel * Math.exp(-j / (laenge * 0.3));
        }
        const q = this.ctx.createBufferSource();
        q.buffer = puffer;
        const bp = this._filter("bandpass", 1600, 0.8);
        const g = this._gain(0.22 * Math.min(1, staerke + 0.2));
        q.connect(bp); bp.connect(g);
        if (pan && this.ctx.createStereoPanner) {
            const p = this.ctx.createStereoPanner();
            p.pan.value = pan;
            g.connect(p); p.connect(this.effekte);
        } else {
            g.connect(this.effekte);
        }
        q.start(t);
        return t + dauer;
    }

    /** Pfeifkonzert: viele Pfiffe mit dem Mund, darunter Buhrufe */
    pfeifkonzert(t, dauer = 3) {
        t = this._jetzt(t);
        const c = this.ctx;
        for (let i = 0; i < 16; i++) {
            const s = t + this._zufall() * dauer * 0.7;
            const d = 0.4 + this._zufall() * 1.1;
            const f = 2100 + this._zufall() * 1500;
            const o = c.createOscillator();
            o.type = "sine";
            o.frequency.setValueAtTime(f, s);
            o.frequency.linearRampToValueAtTime(f * (0.92 + this._zufall() * 0.12), s + d);
            const vib = c.createOscillator();
            vib.frequency.value = 5 + this._zufall() * 3;
            const vt = this._gain(f * 0.012);
            vib.connect(vt); vt.connect(o.frequency);
            const g = this._gain(0);
            this._huelle(g.gain, s, { anstieg: 0.06, halten: d * 0.6, abklingen: d * 0.4, spitze: 0.018 + this._zufall() * 0.014 });
            o.connect(g); g.connect(this.effekte);
            o.start(s); vib.start(s);
            o.stop(s + d + 0.1); vib.stop(s + d + 0.1);
        }
        this._stimmen(t + 0.2, { formanten: [[320, 4, 1], [650, 3, 0.5]], dauer: dauer * 0.6, anstieg: 0.5, spitze: 0.22, abklingen: 1.2, gleiten: 0.95 });
        return t + dauer;
    }

    /**
     * Die Kurve gibt den Takt vor: drei Trommelschläge, dann klatscht das
     * Stadion zweimal, auf dem letzten Schlag ein Ruf - ein Rhythmus ohne
     * Melodie, wie ihn jede Kurve kennt.
     */
    gesang(t, takte = 4) {
        t = this._jetzt(t);
        const schlag = 0.5;
        for (let takt = 0; takt < takte; takt++) {
            const tt = t + takt * schlag * 4;
            [0, 1, 2].forEach(i => this._trommel(tt + i * schlag, 0.26));
            [2.5, 3].forEach(i => this.applaus(tt + i * schlag, 0.12, 2.6));
            this._stimmen(tt + 3 * schlag, { formanten: [[520, 2.5, 1], [1800, 3, 0.6]], dauer: 0.08, anstieg: 0.05, spitze: 0.3, abklingen: 0.25, gleiten: 0.95 });
        }
        return t + takte * schlag * 4;
    }

    _trommel(t, pegel = 0.25, ziel = this.effekte) {
        const o = this.ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(115, t);
        o.frequency.exponentialRampToValueAtTime(52, t + 0.16);
        const g = this._gain(0);
        this._huelle(g.gain, t, { anstieg: 0.004, abklingen: 0.28, spitze: pegel });
        o.connect(g); g.connect(ziel);
        o.start(t); o.stop(t + 0.35);
        const fell = this._rauschQuelle("weiss", t, 0.06);
        const tp = this._filter("lowpass", 900, 0.7);
        const fg = this._gain(0);
        this._huelle(fg.gain, t, { anstieg: 0.002, abklingen: 0.05, spitze: pegel * 0.25 });
        fell.connect(tp); tp.connect(fg); fg.connect(ziel);
    }

    /** Der Schuss: ein dumpfer Schlag gegen den Ball */
    schuss(t, staerke = 1) {
        t = this._jetzt(t);
        const o = this.ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
        const g = this._gain(0);
        this._huelle(g.gain, t, { anstieg: 0.002, abklingen: 0.12, spitze: 0.3 * staerke });
        o.connect(g); g.connect(this.effekte);
        o.start(t); o.stop(t + 0.16);
        const r = this._rauschQuelle("weiss", t, 0.05);
        const bp = this._filter("bandpass", 1100, 1);
        const rg = this._gain(0);
        this._huelle(rg.gain, t, { anstieg: 0.001, abklingen: 0.035, spitze: 0.18 * staerke });
        r.connect(bp); bp.connect(rg); rg.connect(this.effekte);
        return t + 0.16;
    }

    /** Der Pfosten: ein metallischer Klang mit unharmonischen Teiltönen */
    pfosten(t) {
        t = this._jetzt(t);
        [[520, 1, 0.9], [1340, 0.55, 0.6], [2280, 0.32, 0.45], [3410, 0.18, 0.3]].forEach(([f, l, d]) => {
            const o = this.ctx.createOscillator();
            o.type = "sine";
            o.frequency.value = f;
            const g = this._gain(0);
            this._huelle(g.gain, t, { anstieg: 0.002, abklingen: d, spitze: 0.09 * l });
            o.connect(g); g.connect(this.effekte);
            o.start(t); o.stop(t + d + 0.05);
        });
        this.schuss(t, 0.6);
        return t + 0.9;
    }

    // ------------------------------------------------------------ Menütöne

    /** Ein weicher, glockiger Ton (Marimba/Vibrafon) */
    _glocke(t, frequenz, { pegel = 0.08, dauer = 0.6, ziel = this.effekte, teilton = 4, teiltonPegel = 0.12 } = {}) {
        const g = this._gain(0);
        this._huelle(g.gain, t, { anstieg: 0.006, abklingen: dauer, spitze: pegel });
        g.connect(ziel);
        const o = this.ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = frequenz;
        o.connect(g);
        o.start(t); o.stop(t + dauer + 0.05);
        // Ein heller Anschlag, der schnell verklingt
        const o2 = this.ctx.createOscillator();
        o2.type = "sine";
        o2.frequency.value = frequenz * teilton;
        const g2 = this._gain(0);
        this._huelle(g2.gain, t, { anstieg: 0.003, abklingen: dauer * 0.25, spitze: pegel * teiltonPegel });
        o2.connect(g2); g2.connect(ziel);
        o2.start(t); o2.stop(t + dauer * 0.3 + 0.05);
    }

    klick(t) {
        t = this._jetzt(t);
        this._glocke(t, 1568, { pegel: 0.025, dauer: 0.05, teiltonPegel: 0.05 });
        return t + 0.06;
    }

    /** Erledigt: zwei aufsteigende Töne (Vertrag, Transfer, Bau) */
    erfolg(t) {
        t = this._jetzt(t);
        this._glocke(t, 784, { pegel: 0.07, dauer: 0.45 });
        this._glocke(t + 0.09, 1175, { pegel: 0.065, dauer: 0.7 });
        return t + 0.8;
    }

    nachricht(t) {
        t = this._jetzt(t);
        this._glocke(t, 1047, { pegel: 0.05, dauer: 0.5, teilton: 2.76, teiltonPegel: 0.2 });
        return t + 0.5;
    }

    /** Konferenz: der Gong vor der Durchsage "Tor in ..." */
    konferenz(t) {
        t = this._jetzt(t);
        this._glocke(t, 659, { pegel: 0.08, dauer: 0.9, teilton: 2.76, teiltonPegel: 0.25 });
        this._glocke(t + 0.38, 523, { pegel: 0.08, dauer: 1.2, teilton: 2.76, teiltonPegel: 0.25 });
        return t + 1.6;
    }

    /**
     * Spielt einen Klang nach Namen. Die alten Namen aus dem Spiel
     * (whistle, goal, gasp, pfiffe ...) zeigen auf die neuen Klänge.
     */
    spiele(name, t) {
        switch (name) {
            case "whistle": case "pfiff_menue": return this.pfiff("menue", t);
            case "pfiff_kurz": return this.pfiff("kurz", t);
            case "pfiff_foul": return this.pfiff("foul", t);
            case "pfiff_karte": return this.pfiff("karte", t);
            case "anpfiff": return this.pfiff("anpfiff", t);
            case "halbzeit": return this.pfiff("halbzeit", t);
            case "abpfiff": return this.pfiff("abpfiff", t);
            case "tor_heim": return this.jubel(true, t);
            case "tor_gast": return this.jubel(false, t);
            case "gasp": case "raunen": return this.raunen(t);
            case "raunen_gast": return this.raunen(t, 0.45);
            case "pfiffe": return this.pfeifkonzert(t);
            case "gesang": return this.gesang(t);
            case "applaus": return this.applaus(t, 3, 0.5);
            case "schuss": return this.schuss(t);
            case "pfosten": return this.pfosten(t);
            case "goal": case "erfolg": return this.erfolg(t);
            case "nachricht": return this.nachricht(t);
            case "konferenz": return this.konferenz(t);
            case "click": case "klick": return this.klick(t);
            case "crowd": return this._jetzt(t);
            default: return this._jetzt(t);
        }
    }

    // --------------------------------------------------------------- Musik

    /**
     * Die Menümusik: 74 Schläge je Minute, leicht geswingt, zwei Teile zu
     * acht Takten mit jazzigen Akkorden (Septimen und Nonen, eng gelegt).
     * Je Takt wählt das Stück ein Begleitmuster des E-Pianos, der Bass
     * spielt Grundton und Quinte, die Besen kommen nach vier Takten dazu,
     * und ab und zu spielt eine Glocke ein paar Töne aus dem Akkord.
     */
    static MUSIK = {
        tempo: 74,
        swing: 0.58,
        // [Bass, Akkordtöne] als MIDI-Noten
        teilA: [
            [38, [53, 57, 60, 64]],   // Dm9
            [43, [53, 57, 59, 64]],   // G13
            [36, [52, 55, 59, 62]],   // Cmaj9
            [33, [55, 59, 60, 64]],   // Am9
            [38, [53, 57, 60, 64]],   // Dm9
            [43, [53, 57, 59, 64]],   // G13
            [40, [55, 59, 62, 66]],   // Em9
            [33, [55, 59, 61, 65]]    // A7(b13)
        ],
        teilB: [
            [41, [57, 60, 64, 67]],   // Fmaj9
            [40, [55, 59, 62, 66]],   // Em9
            [38, [53, 57, 60, 64]],   // Dm9
            [36, [52, 55, 59, 62]],   // Cmaj9
            [34, [57, 60, 62, 65]],   // Bbmaj9
            [33, [55, 59, 60, 64]],   // Am9
            [38, [53, 57, 60, 64]],   // Dm9
            [43, [53, 57, 60, 62]]    // G9sus4
        ],
        // Töne der Tonleiter (C-Dur), aus denen die Melodie wählt
        leiter: [62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79]
    };

    /** Die Akkordfolge: A, A, B, A - und wieder von vorn */
    static musikTakt(index) {
        const M = Klang.MUSIK;
        const teil = Math.floor(index / 8) % 4;
        const quelle = teil === 2 ? M.teilB : M.teilA;
        return { teil: teil === 2 ? "B" : "A", akkord: quelle[index % 8], index };
    }

    /** Ein E-Piano-Ton: Grundton und Oktave, weicher Anschlag, leises Tremolo */
    _epiano(t, note, dauer, pegel, ziel) {
        const c = this.ctx;
        const f = Klang.midiZuHz(note);
        const g = this._gain(0);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(pegel, t + 0.008);
        g.gain.setTargetAtTime(pegel * 0.45, t + 0.01, 0.35);
        g.gain.setTargetAtTime(0.0001, t + dauer, 0.18);
        g.connect(ziel);
        [[1, 1, 0], [2, 0.18, 0.4], [3, 0.05, 0.25]].forEach(([mult, l, kurz]) => {
            const o = c.createOscillator();
            o.type = "sine";
            o.frequency.value = f * mult;
            o.detune.value = (this._zufall() - 0.5) * 6;
            let ziel2 = g;
            if (kurz) {
                // Obertöne klingen schneller ab - so klingt es nach Anschlag
                const og = this._gain(0);
                og.gain.setValueAtTime(l, t);
                og.gain.setTargetAtTime(0.0001, t + 0.01, kurz);
                og.connect(g);
                ziel2 = og;
                o.connect(ziel2);
            } else {
                const og = this._gain(l);
                o.connect(og); og.connect(g);
            }
            o.start(t);
            o.stop(t + dauer + 1);
        });
    }

    _bass(t, note, dauer, pegel, ziel) {
        const c = this.ctx;
        const f = Klang.midiZuHz(note);
        const g = this._gain(0);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(pegel, t + 0.02);
        g.gain.setTargetAtTime(pegel * 0.6, t + 0.03, 0.4);
        g.gain.setTargetAtTime(0.0001, t + dauer, 0.08);
        const tp = this._filter("lowpass", 420, 0.6);
        tp.connect(g); g.connect(ziel);
        // Der zweite Teilton macht den Bass auch auf kleinen Lautsprechern hörbar
        [[1, 1], [2, 0.35]].forEach(([m, l]) => {
            const o = c.createOscillator();
            o.type = "triangle";
            o.frequency.value = f * m;
            const og = this._gain(l);
            o.connect(og); og.connect(tp);
            o.start(t); o.stop(t + dauer + 0.6);
        });
    }

    _besen(t, pegel, ziel, lang = false) {
        const q = this._rauschQuelle("weiss", t, lang ? 0.35 : 0.08);
        const hp = this._filter(lang ? "bandpass" : "highpass", lang ? 2600 : 6500, lang ? 0.8 : 0.7);
        const g = this._gain(0);
        this._huelle(g.gain, t, { anstieg: lang ? 0.02 : 0.002, abklingen: lang ? 0.3 : 0.06, spitze: pegel });
        q.connect(hp); hp.connect(g); g.connect(ziel);
    }

    /**
     * Was in einem Takt gespielt wird - als Noten, ohne Klang. Positionen in
     * Schlägen (0 bis 4), Noten als MIDI. z ist der Zufall des Stücks.
     */
    static taktPlan(index, z, letzteNote = null) {
        const M = Klang.MUSIK;
        const { teil, akkord: [bass, toene] } = Klang.musikTakt(index);
        const plan = { teil, index, piano: [], bass: [], besen: index >= 4, trommel: [], melodie: [], letzteNote };

        // E-Piano: ein Begleitmuster je Takt
        const muster = [
            [[0, 1.5], [1.5, 1.2]],
            [[0, 3.6]],
            [[0, 1.4], [2, 1.6]],
            [[0, 0.9], [1.5, 0.9], [2.5, 1.4]]
        ];
        const wahl = teil === "B" && z() < 0.5 ? muster[1] : muster[Math.floor(z() * muster.length)];
        wahl.forEach(([pos, dauer]) => plan.piano.push({ pos, dauer, noten: toene.slice(), staerke: 0.85 + z() * 0.3 }));

        // Bass: Grundton auf eins, Quinte oder Grundton auf drei
        plan.bass.push({ pos: 0, dauer: 1.6, note: bass, pegel: 0.16 });
        plan.bass.push({ pos: 2, dauer: 1.3, note: z() < 0.6 ? bass + 7 : bass, pegel: 0.13 });

        // Trommel leise auf eins, manchmal auf drei-und
        if (plan.besen) {
            plan.trommel.push({ pos: 0, pegel: 0.07 });
            if (z() < 0.6) plan.trommel.push({ pos: 2.5, pegel: 0.05 });
        }

        // Melodie: nicht in jedem Takt - die Pausen machen sie ruhig
        if (index >= 2 && z() < (teil === "B" ? 0.7 : 0.45)) {
            const akkordKlassen = new Set(toene.map(n => n % 12));
            // Durchgangstöne nur, wo sie nicht reiben: kein Halbton neben einem Akkordton
            const reibt = (n) => toene.some(a => [1, 11].includes(((n - a) % 12 + 12) % 12));
            const akkordToene = M.leiter.filter(n => akkordKlassen.has(n % 12));
            const kandidaten = M.leiter.filter(n => akkordKlassen.has(n % 12) || !reibt(n));
            let note = letzteNote ?? akkordToene[Math.floor(akkordToene.length / 2)];
            const anzahl = 2 + Math.floor(z() * 3);
            let pos = [0, 0.5, 1, 1.5][Math.floor(z() * 4)];
            for (let i = 0; i < anzahl && pos < 3.5; i++) {
                const letzter = i === anzahl - 1 || pos >= 3;
                // Schrittweise: der nächste Ton liegt nah am letzten; der letzte
                // Ton einer Phrase ist immer ein Akkordton
                const topf = letzter ? akkordToene : kandidaten;
                const nah = topf.filter(n => Math.abs(n - note) <= 4 && n !== note);
                note = nah.length ? nah[Math.floor(z() * nah.length)] : topf[Math.floor(z() * topf.length)];
                plan.melodie.push({ pos, note, dauer: letzter ? 1.6 : 0.9, akkordton: akkordKlassen.has(note % 12), letzter, pegel: 0.85 + z() * 0.3 });
                pos += letzter ? 2 : [0.5, 1, 1][Math.floor(z() * 3)];
            }
            plan.letzteNote = note;
        }
        return plan;
    }

    /** Plant einen Takt der Musik ab Zeitpunkt t */
    _planeTakt(t, index, z) {
        const M = Klang.MUSIK;
        const m = this._musik;
        const schlag = 60 / M.tempo;
        const achtel = (n) => Math.floor(n) * schlag + (n % 1 ? schlag * M.swing : 0);
        const menschlich = () => (z() - 0.5) * 0.02;
        const plan = Klang.taktPlan(index, z, m.letzteNote);
        m.letzteNote = plan.letzteNote;

        // E-Piano: die Töne leicht nacheinander angeschlagen
        plan.piano.forEach(({ pos, dauer, noten, staerke }) => {
            const start = t + achtel(pos) + menschlich();
            noten.forEach((n, i) => this._epiano(start + i * (0.012 + z() * 0.012), n, dauer * schlag, 0.05 * staerke, m.piano));
        });
        plan.bass.forEach(({ pos, dauer, note, pegel }) => this._bass(t + pos * schlag + menschlich(), note, schlag * dauer, pegel, m.trocken));

        // Besen: ab dem fünften Takt, im B-Teil etwas zurückhaltender
        if (plan.besen) {
            for (let n = 0; n < 8; n++) {
                this._besen(t + achtel(n / 2) + menschlich(), (n % 2 ? 0.011 : 0.016) * (plan.teil === "B" ? 0.7 : 1), m.trocken);
            }
            [1, 3].forEach(pos => this._besen(t + pos * schlag + menschlich(), 0.035, m.trocken, true));
        }
        plan.trommel.forEach(({ pos, pegel }) => this._trommel(t + achtel(pos) + menschlich(), pegel, m.trocken));

        plan.melodie.forEach(({ pos, note, dauer, pegel }) => {
            this._glocke(t + achtel(pos) + menschlich(), Klang.midiZuHz(note), {
                pegel: 0.032 * pegel, dauer, ziel: m.melodie, teilton: 4, teiltonPegel: 0.06
            });
        });
    }

    /** Plant die Musik bis zum Zeitpunkt bis (für Live und Hörprobe) */
    _planeMusik(bis) {
        const m = this._musik;
        if (!m) return;
        const takt = 4 * 60 / Klang.MUSIK.tempo;
        while (m.naechsterTakt < bis) {
            this._planeTakt(m.naechsterTakt, m.takt, m.zufall);
            m.takt++;
            m.naechsterTakt += takt;
        }
    }

    /**
     * Startet die Menümusik. Ohne Zeitgeber (offline) plant sie bis
     * planeBis; im Browser plant ein Zeitgeber immer zwei Sekunden voraus.
     */
    starteMusik(t, { planeBis = null, seed = null } = {}) {
        if (this._musik) return;
        t = this._jetzt(t);
        const c = this.ctx;
        // Kette: E-Piano warm gefiltert, alles mit etwas Hall
        const summe = this._gain(1);
        const hall = c.createConvolver();
        hall.buffer = this._hall(2.4);
        const hallPegel = this._gain(0.28);
        summe.connect(this.musikBus);
        summe.connect(hall); hall.connect(hallPegel); hallPegel.connect(this.musikBus);
        const piano = this._filter("lowpass", 2600, 0.5);
        const tremolo = this._gain(0.9);
        const lfo = c.createOscillator();
        lfo.frequency.value = 4.5;
        const lfoTiefe = this._gain(0.1);
        lfo.connect(lfoTiefe); lfoTiefe.connect(tremolo.gain);
        lfo.start(t);
        piano.connect(tremolo); tremolo.connect(summe);
        const melodie = this._gain(1);
        melodie.connect(summe);
        melodie.connect(hall);
        const trocken = this._gain(1);
        trocken.connect(this.musikBus);
        const z = Klang.zufallsgenerator(seed ?? Math.floor(this._zufall() * 1e9));
        this._musik = { piano, melodie, trocken, summe, hall, lfo, takt: 0, naechsterTakt: t + 0.1, zufall: z, letzteNote: null, zeitgeber: null };
        this.musikBus.gain.cancelScheduledValues(t);
        this.musikBus.gain.setValueAtTime(0.0001, t);
        this.musikBus.gain.linearRampToValueAtTime(this.musikLautstaerke, t + 3);
        if (planeBis !== null) {
            this._planeMusik(planeBis);
        } else if (typeof setInterval === "function") {
            this._planeMusik(this.ctx.currentTime + 2);
            this._musik.zeitgeber = setInterval(() => this._planeMusik(this.ctx.currentTime + 2), 400);
        }
    }

    stoppeMusik(ausblenden = 1.5, t) {
        const m = this._musik;
        if (!m) return;
        t = this._jetzt(t);
        if (m.zeitgeber) clearInterval(m.zeitgeber);
        this.musikBus.gain.cancelScheduledValues(t);
        this.musikBus.gain.setTargetAtTime(0.0001, t, ausblenden / 4);
        try { m.lfo.stop(t + ausblenden + 0.5); } catch (e) { /* schon gestoppt */ }
        // Die Kette löst sich, wenn alles verklungen ist
        setTimeout(() => { try { m.summe.disconnect(); m.trocken.disconnect(); } catch (e) { /* schon gelöst */ } }, (ausblenden + 3) * 1000);
        this._musik = null;
    }

    setzeMusikLautstaerke(wert) {
        this.musikLautstaerke = Math.max(0, Math.min(1, wert));
        if (this._musik) this.musikBus.gain.setTargetAtTime(Math.max(0.0001, this.musikLautstaerke), this.ctx.currentTime, 0.2);
    }

    get musikLaeuft() {
        return !!this._musik;
    }
}

if (typeof window !== "undefined") {
    window.Klang = Klang;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { Klang };
}
