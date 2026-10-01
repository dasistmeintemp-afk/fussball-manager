/**
 * Spielfeld und Übertragung: Leinwand, Rasen, Stadionklang, Radar und Einblendungen des 2D-Spiels.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert, damit uiManager.js nicht
 * über zwölftausend Zeilen lang ist.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Passt die Canvas-Auflösung an Containergröße und Pixeldichte an.
     * Ohne diese Skalierung wird das Spielfeld auf HiDPI-Displays unscharf
     * gestreckt und wirkt beim Scrollen ruckelig.
     */
    resizeLiveCanvas() {
        const canvas = document.getElementById("livePitchCanvas");
        const wrapper = canvas?.parentElement;
        if (!canvas || !wrapper) return false;

        // Seit es eine Kameraführung gibt, muss der Canvas nicht mehr das
        // Seitenverhältnis des Spielfelds haben: Er füllt die verfügbare
        // Fläche, die Kamera entscheidet über den sichtbaren Ausschnitt.
        // Das vermeidet die breiten leeren Ränder von vorher.
        const available = wrapper.clientWidth - 8;
        if (available <= 0) return false;

        const cssWidth = Math.min(available, 1400);
        // Unter dem Feld stehen Zurufleiste und Kommentarzeile - ihre Höhe
        // wird abgezogen, statt pauschal siebzig Pixel zu schätzen.
        let darunter = 0;
        [...wrapper.children].forEach(el => {
            if (el === canvas || el.offsetParent === null || el.id === "livePitch3D") return;
            const cs = getComputedStyle(el);
            // Einblendungen über dem Feld nehmen keinen Platz weg
            if (cs.position === "absolute" || cs.position === "fixed") return;
            darunter += el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
        });
        const wcs = getComputedStyle(wrapper);
        const polster = (parseFloat(wcs.paddingTop) || 0) + (parseFloat(wcs.paddingBottom) || 0);
        const cssHeight = Math.max(200, wrapper.clientHeight - polster - (darunter || 55) - 6);

        const dpr = Math.min(2.5, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
        const pixelWidth = Math.round(cssWidth * dpr);
        const pixelHeight = Math.round(cssHeight * dpr);

        const changed = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
        if (changed) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
            this.pitchBackdrop = null; // Rasen muss neu gezeichnet werden
        }

        canvas.style.width = `${Math.round(cssWidth)}px`;
        canvas.style.height = `${Math.round(cssHeight)}px`;

        return changed;
    },

    /**
     * Zeichnet Rasen, Linien und Tore einmalig in ein Offscreen-Canvas.
     * Pro Frame wird nur noch dieses Bild kopiert - das spart bei 60 fps
     * hunderte Zeichenbefehle und beseitigt das Ruckeln.
     */
    buildPitchBackdrop(width, height) {
        const canvas = (typeof document !== "undefined") ? document.createElement("canvas") : null;
        if (!canvas) return null;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // Das Spielfeld behält sein echtes Seitenverhältnis (105 x 68 m) und
        // wird mittig in den Rasen gelegt; ringsum bleibt etwas Umfeld sichtbar.
        const PITCH_RATIO = 105 / 68;
        const margin = Math.round(Math.min(width, height) * 0.05);

        let pitchW = width - margin * 2;
        let pitchH = pitchW / PITCH_RATIO;
        if (pitchH > height - margin * 2) {
            pitchH = height - margin * 2;
            pitchW = pitchH * PITCH_RATIO;
        }

        const pitchX = Math.round((width - pitchW) / 2);
        const pitchY = Math.round((height - pitchH) / 2);
        const midX = pitchX + pitchW / 2;
        const midY = pitchY + pitchH / 2;
        const unit = pitchW / 105; // ein Meter in Pixeln

        // Rasen mit Mähstreifen
        ctx.fillStyle = "#0b4227";
        ctx.fillRect(0, 0, width, height);

        const stripes = 14;
        const stripeW = pitchW / stripes;
        for (let i = 0; i < stripes; i++) {
            ctx.fillStyle = (i % 2 === 0) ? "#15803d" : "#137236";
            ctx.fillRect(pitchX + i * stripeW, pitchY, stripeW + 1, pitchH);
        }

        // Flutlicht-Stimmung
        const glow = ctx.createRadialGradient(midX, midY, pitchH * 0.1, midX, midY, pitchW * 0.7);
        glow.addColorStop(0, "rgba(255, 255, 255, 0.07)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0.28)");
        ctx.fillStyle = glow;
        ctx.fillRect(pitchX, pitchY, pitchW, pitchH);

        // Linien
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = Math.max(1.5, unit * 0.14);

        ctx.strokeRect(pitchX, pitchY, pitchW, pitchH);
        ctx.beginPath();
        ctx.moveTo(midX, pitchY);
        ctx.lineTo(midX, pitchY + pitchH);
        ctx.stroke();

        const centreRadius = unit * 9.15;
        ctx.beginPath();
        ctx.arc(midX, midY, centreRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(midX, midY, Math.max(2, unit * 0.3), 0, Math.PI * 2);
        ctx.fill();

        // Strafraum (16,5 m x 40,3 m) und Torraum (5,5 m x 18,3 m)
        const penW = unit * 16.5;
        const penH = (pitchH / 68) * 40.3;
        const goalAreaW = unit * 5.5;
        const goalAreaH = (pitchH / 68) * 18.3;
        const penSpot = unit * 11;

        [0, 1].forEach(side => {
            const isLeft = side === 0;
            const boxX = isLeft ? pitchX : pitchX + pitchW - penW;
            ctx.strokeRect(boxX, midY - penH / 2, penW, penH);

            const gaX = isLeft ? pitchX : pitchX + pitchW - goalAreaW;
            ctx.strokeRect(gaX, midY - goalAreaH / 2, goalAreaW, goalAreaH);

            const spotX = isLeft ? pitchX + penSpot : pitchX + pitchW - penSpot;
            ctx.beginPath();
            ctx.arc(spotX, midY, Math.max(1.8, unit * 0.28), 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            if (isLeft) ctx.arc(spotX, midY, centreRadius, -0.93, 0.93);
            else ctx.arc(spotX, midY, centreRadius, Math.PI - 0.93, Math.PI + 0.93);
            ctx.stroke();
        });

        // Eckviertelkreise
        const cornerR = unit * 1;
        ctx.beginPath(); ctx.arc(pitchX, pitchY, cornerR, 0, Math.PI / 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(pitchX, pitchY + pitchH, cornerR, -Math.PI / 2, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(pitchX + pitchW, pitchY, cornerR, Math.PI / 2, Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(pitchX + pitchW, pitchY + pitchH, cornerR, Math.PI, Math.PI * 1.5); ctx.stroke();

        // Tore inklusive angedeutetem Netz
        const goalH = (pitchH / 68) * 7.32;
        const goalDepth = unit * 2;
        ctx.lineWidth = Math.max(2, unit * 0.2);
        [0, 1].forEach(side => {
            const gx = side === 0 ? pitchX - goalDepth : pitchX + pitchW;
            ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
            ctx.fillRect(gx, midY - goalH / 2, goalDepth, goalH);
            ctx.strokeStyle = "#ffffff";
            ctx.strokeRect(gx, midY - goalH / 2, goalDepth, goalH);

            ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
            ctx.lineWidth = 1;
            for (let n = 1; n < 4; n++) {
                const ny = midY - goalH / 2 + (goalH / 4) * n;
                ctx.beginPath();
                ctx.moveTo(gx, ny);
                ctx.lineTo(gx + goalDepth, ny);
                ctx.stroke();
            }
            ctx.lineWidth = Math.max(2, unit * 0.2);
        });

        return { canvas, pitchX, pitchY, pitchW, pitchH, midX, midY, unit };
    },

    /**
     * Stadionatmosphäre: ein durchgehendes Rauschen als Publikum, dessen
     * Lautstärke sich nach der Spielsituation richtet. Ohne Ton wirkt selbst
     * eine gute Simulation leblos.
     */
    startCrowdAmbience() {
        if (!this.soundEnabled) return;
        try {
            if (!this.audioCtx && typeof window !== "undefined") {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (typeof AudioContextClass === "function") this.audioCtx = new AudioContextClass();
            }
            const ctx = this.audioCtx;
            if (!ctx || this.crowd) return;
            if (ctx.state === "suspended") ctx.resume();

            // Rosa-artiges Rauschen als Grundlage für den Zuschauerteppich
            const seconds = 3;
            const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            let b0 = 0, b1 = 0, b2 = 0;
            for (let i = 0; i < data.length; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99765 * b0 + white * 0.0990460;
                b1 = 0.96300 * b1 + white * 0.2965164;
                b2 = 0.57000 * b2 + white * 1.0526913;
                data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;

            // Bandpass macht aus dem Rauschen ein Stimmengewirr
            const filter = ctx.createBiquadFilter();
            filter.type = "bandpass";
            filter.frequency.value = 620;
            filter.Q.value = 0.7;

            const gain = ctx.createGain();
            gain.gain.value = 0.0;

            source.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            source.start();

            this.crowd = { source, gain, filter, level: 0 };
        } catch (e) {
            console.warn("Stadionatmosphäre nicht verfügbar:", e);
        }
    },

    /**
     * Passt die Lautstärke des Publikums an die Spielsituation an
     */
    updateCrowdAmbience(liveMatch, dt) {
        const crowd = this.crowd;
        if (!crowd || !this.audioCtx) return;

        const dir = liveMatch.director;
        const mode = dir?.mode || "ambient";

        // Grundpegel steigt, je näher der Ball an einem Tor ist
        const ballThreat = Math.max(0, 1 - Math.min(
            Math.abs(liveMatch.ball.x - 4),
            Math.abs(liveMatch.ball.x - 96)
        ) / 45);

        let target = 0.05 + ballThreat * 0.09;
        if (mode === "highlight") target += 0.06;
        if (dir?.deadBall) target += 0.02;
        if (liveMatch.goalFlash > 0) target = 0.34;
        if (mode === "celebration") target = 0.3;

        crowd.level += (target - crowd.level) * Math.min(1, dt * 2.2);
        try {
            crowd.gain.gain.setTargetAtTime(crowd.level, this.audioCtx.currentTime, 0.12);
        } catch (e) { /* Browser ohne setTargetAtTime */ }
    },

    /** Beendet die Stadionatmosphäre */
    stopCrowdAmbience() {
        if (!this.crowd) return;
        try {
            this.crowd.gain.gain.value = 0;
            this.crowd.source.stop();
        } catch (e) { /* bereits gestoppt */ }
        this.crowd = null;
    },

    /**
     * Kleines Übersichtsfeld oben rechts, solange die Kamera herangezoomt ist.
     * Ohne diese Hilfe verliert man beim Zoomen die Ordnung der Mannschaften.
     */
    drawRadar(ctx, canvas, liveMatch, camX, camY, halfW, halfH) {
        const w = Math.min(190, canvas.width * 0.19);
        const h = w * 0.62;
        const x = canvas.width - w - 16;
        const y = 16;

        ctx.save();
        ctx.globalAlpha = 0.92;

        // Hintergrund
        ctx.fillStyle = "rgba(6, 40, 25, 0.88)";
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 6);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        }

        // Mittellinie, Mittelkreis und Strafräume als Orientierung
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w / 2, y + h);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, h * 0.14, 0, Math.PI * 2);
        ctx.stroke();

        const boxW = w * 0.16;
        const boxH = h * 0.42;
        ctx.strokeRect(x, y + (h - boxH) / 2, boxW, boxH);
        ctx.strokeRect(x + w - boxW, y + (h - boxH) / 2, boxW, boxH);

        const rx = px => x + ((px - TORLINIE_LINKS) / FELD_LAENGE) * w;
        const ry = py => y + (py / 100) * h;

        // Aktueller Kameraausschnitt
        ctx.strokeStyle = "rgba(250, 204, 21, 0.75)";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(rx(camX - halfW), ry(camY - halfH), (halfW * 2 / FELD_LAENGE) * w, (halfH * 2 / 100) * h);

        // Spieler als Punkte
        (liveMatch.players2D || []).forEach(p => {
            ctx.beginPath();
            ctx.arc(rx(p.x), ry(p.y), 2.2, 0, Math.PI * 2);
            ctx.fillStyle = p.pos === "TW"
                ? (liveMatch.kits?.[p.team]?.tw || (p.team === "home" ? "#facc15" : "#22d3ee"))
                : (p.color || "#3b82f6");
            ctx.fill();
        });

        // Ball
        ctx.beginPath();
        ctx.arc(rx(liveMatch.ball.x), ry(liveMatch.ball.y), 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        ctx.restore();
    },

    /**
     * Einblendungen wie im Fernsehen: Spielphasen, Standardsituationen,
     * Torsequenz, Karten und Auswechslungen.
     */
    drawBroadcastOverlays(ctx, canvas, liveMatch, bg) {
        const { pitchH } = bg;
        const midX = canvas.width / 2;
        const midY = canvas.height / 2;

        // Zeitlupe: dunkler Rahmen und Hinweis, solange der Treffer nachwirkt
        if (liveMatch.slowMotion > 0) {
            ctx.save();
            const vignette = ctx.createRadialGradient(
                midX, midY, Math.min(canvas.width, canvas.height) * 0.25,
                midX, midY, Math.max(canvas.width, canvas.height) * 0.72
            );
            vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
            vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.font = `700 ${Math.round(pitchH * 0.032)}px 'Inter', system-ui, sans-serif`;
            ctx.fillStyle = "rgba(248, 250, 252, 0.85)";
            ctx.fillText("▶▶ ZEITLUPE", 24, canvas.height - 26);
            ctx.restore();
        }

        // Torjubel
        if (liveMatch.goalFlash > 0) {
            const alpha = Math.min(1, liveMatch.goalFlash);
            ctx.save();
            ctx.fillStyle = `rgba(250, 204, 21, ${alpha * 0.16})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Fankurve: Lichtermeer am oberen und unteren Spielfeldrand
            const flicker = liveMatch.celebratingTeam ? alpha : 0;
            if (flicker > 0) {
                for (let i = 0; i < 46; i++) {
                    const fx = (i / 45) * canvas.width;
                    const jitter = Math.abs(Math.sin(Date.now() * 0.006 + i * 1.7));
                    const r = 2 + jitter * 3.2;
                    ctx.fillStyle = `rgba(255, 255, 255, ${flicker * (0.25 + jitter * 0.55)})`;
                    ctx.beginPath();
                    ctx.arc(fx, 10 + jitter * 6, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(fx, canvas.height - 10 - jitter * 6, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
            ctx.shadowBlur = 16;

            ctx.font = `800 ${Math.round(pitchH * 0.13)}px 'Inter', system-ui, sans-serif`;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillText("TOOOOR!", midX, midY - pitchH * 0.05);

            if (liveMatch.lastScorerName) {
                ctx.font = `700 ${Math.round(pitchH * 0.055)}px 'Inter', system-ui, sans-serif`;
                ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
                ctx.fillText(liveMatch.lastScorerName, midX, midY + pitchH * 0.055);
            }
            if (liveMatch.lastAssistName) {
                ctx.font = `600 ${Math.round(pitchH * 0.034)}px 'Inter', system-ui, sans-serif`;
                ctx.fillStyle = `rgba(226, 232, 240, ${alpha * 0.9})`;
                ctx.fillText(`Vorlage: ${liveMatch.lastAssistName}`, midX, midY + pitchH * 0.11);
            }
            ctx.restore();
        }

        // Banner für Spielphasen und Ereignisse
        const banner = liveMatch.banner;
        if (banner && banner.timer > 0) {
            const fade = Math.min(1, banner.timer * 1.6);
            const boxH = Math.round(pitchH * 0.115);
            const boxY = Math.round(canvas.height * 0.13);

            ctx.save();
            ctx.globalAlpha = fade;
            ctx.fillStyle = banner.color || "rgba(12, 16, 22, 0.92)";
            ctx.fillRect(0, boxY, canvas.width, boxH);

            ctx.fillStyle = "#f8fafc";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `800 ${Math.round(boxH * 0.42)}px 'Inter', system-ui, sans-serif`;
            ctx.fillText(banner.title, canvas.width / 2, boxY + boxH * 0.36);

            if (banner.subtitle) {
                ctx.font = `600 ${Math.round(boxH * 0.26)}px 'Inter', system-ui, sans-serif`;
                ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
                ctx.fillText(banner.subtitle, canvas.width / 2, boxY + boxH * 0.74);
            }
            ctx.restore();
        }

        // Hinweis auf die ruhende Spielsituation
        const setPiece = liveMatch.setPiece;
        if (setPiece) {
            const labels = {
                throwin: "Einwurf",
                goalkick: "Abstoß",
                corner: "Eckball",
                freekick: "Freistoß",
                kickoff: "Anstoß",
                penalty: "Elfmeter"
            };
            const club = setPiece.team === "home" ? liveMatch.homeClub?.name : liveMatch.awayClub?.name;
            const kickoff = liveMatch.kickoff;
            const zusatz = setPiece.kind === "kickoff" && kickoff
                ? (kickoff.phase === "whistle" ? " · Anpfiff" : " · Mannschaften stellen sich auf")
                : "";
            const text = `${labels[setPiece.kind] || "Standard"} · ${club || ""}${zusatz}`;

            ctx.save();
            ctx.font = `700 ${Math.round(pitchH * 0.036)}px 'Inter', system-ui, sans-serif`;
            const tw = ctx.measureText(text).width;
            const padX = pitchH * 0.022;
            const boxH = pitchH * 0.062;
            const bx = 16;
            const by = canvas.height - boxH - 16;

            ctx.fillStyle = "rgba(12, 16, 22, 0.86)";
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(bx, by, tw + padX * 2, boxH, boxH / 2);
                ctx.fill();
            } else {
                ctx.fillRect(bx, by, tw + padX * 2, boxH);
            }

            ctx.fillStyle = "#fbbf24";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(text, bx + padX, by + boxH / 2);
            ctx.restore();
        }

        // Angriffsphase: zeigt, was die Mannschaft am Ball gerade vorhat
        const attack = liveMatch.attack;
        if (attack && !setPiece && !liveMatch.celebratingTeam) {
            const phasen = {
                buildup: "Spielaufbau",
                progression: "Angriff",
                final_third: "Im letzten Drittel"
            };
            const club = attack.team === "home" ? liveMatch.homeClub?.name : liveMatch.awayClub?.name;
            const label = phasen[attack.phase] || "Ballbesitz";
            const kette = attack.chain >= 3 ? ` · ${attack.chain} Stationen` : "";
            const text = `${label} · ${club || ""}${kette}`;

            ctx.save();
            ctx.font = `700 ${Math.round(pitchH * 0.034)}px 'Inter', system-ui, sans-serif`;
            const tw = ctx.measureText(text).width;
            const padX = pitchH * 0.022;
            const boxH = pitchH * 0.058;
            const bx = canvas.width - tw - padX * 2 - 16;
            const by = canvas.height - boxH - 16;

            ctx.fillStyle = "rgba(12, 16, 22, 0.78)";
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(bx, by, tw + padX * 2, boxH, boxH / 2);
                ctx.fill();
            } else {
                ctx.fillRect(bx, by, tw + padX * 2, boxH);
            }

            ctx.fillStyle = attack.phase === "final_third" ? "#fca5a5"
                : (attack.phase === "progression" ? "#bae6fd" : "#cbd5e1");
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(text, bx + padX, by + boxH / 2);
            ctx.restore();
        }
    },

    /**
     * Textbreiten werden gecacht - measureText pro Spieler und Frame
     * ist einer der teuersten Aufrufe im Canvas-Rendering.
     */
    measureCached(ctx, text, font) {
        const key = `${font}|${text}`;
        let width = this.textWidthCache.get(key);
        if (width === undefined) {
            ctx.font = font;
            width = ctx.measureText(text).width;
            this.textWidthCache.set(key, width);
            if (this.textWidthCache.size > 400) this.textWidthCache.clear();
        }
        return width;
    }
});
