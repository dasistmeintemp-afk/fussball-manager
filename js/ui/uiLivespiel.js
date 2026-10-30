/**
 * Livespiel: Match-Center, Zurufe, Seitenlinie, Wechsel, Taktik und Gegneranalyse während der Partie.
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
     * Was das 2D-Feld zeigt - pro Geraet gemerkt. Namen sind wie im Vorbild
     * voreingestellt, die Formationslinien schaltet man bei Bedarf dazu. Der
     * Rasen ist im alten Stil olivbraun, auf Wunsch modern grün.
     */
    anzeige2D() {
        if (this._anzeige2D) return this._anzeige2D;
        let gespeichert = null;
        try { gespeichert = JSON.parse(localStorage.getItem("fm_anzeige2d") || "null"); } catch (e) { gespeichert = null; }
        this._anzeige2D = {
            namen: true, formEigene: false, formGegner: false, feldGross: false,
            dreiD: false, kamera3D: "tv", qualitaet3D: "auto", wiederholung3D: true,
            wiederholung2D: true, passwege: false, laufwege: false, steilpaesse: true, rasen: "klassisch",
            ...(gespeichert || {})
        };
        return this._anzeige2D;
    },

    /**
     * Am Handy hochkant gehören Seitenlinie und Sofort-Ergebnis unten in
     * Daumenreichweite, mit Beschriftung. Oben in der Steuerzeile waren sie
     * nur Symbole - und eine Meldung unter der Kopfleiste lag genau darüber,
     * Sofort-Ergebnis war erst quer zu erreichen. Breiter wandern beide
     * zurück an ihren Platz in der Steuerzeile.
     */
    ordneLivesteuerung() {
        if (typeof document === "undefined" || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const fuss = document.getElementById("lmFussleiste");
        const leiste = document.querySelector("#modalLiveMatch .live-controls-bar");
        const seitenlinie = document.getElementById("btnLmCoaching");
        const sofort = document.getElementById("btnLmSkip");
        if (!fuss || !leiste || !seitenlinie || !sofort) return;
        const handy = window.matchMedia("(max-width: 640px)");
        const ordne = () => {
            if (handy.matches) {
                fuss.append(seitenlinie, sofort);
            } else if (seitenlinie.parentElement === fuss) {
                // Seitenlinie hinter die Ansicht, Sofort-Ergebnis ans Ende
                document.getElementById("btnLmAnsicht")?.after(seitenlinie);
                leiste.append(sofort);
            }
        };
        ordne();
        // Die Zurufe sind am Handy eine wischbare Zeile - mit weichem Rand, wo es weitergeht
        if (typeof this.wischHinweis === "function") this.wischHinweis(document.getElementById("lmZurufe"));
        if (!this._livesteuerungGebunden) {
            this._livesteuerungGebunden = true;
            if (typeof handy.addEventListener === "function") handy.addEventListener("change", ordne);
            else if (typeof handy.addListener === "function") handy.addListener(ordne);
        }
    },

    verdrahteAnzeige2D() {
        const anzeige = this.anzeige2D();
        document.querySelectorAll("#lmAnsicht [data-anzeige2d]").forEach(box => {
            box.checked = !!anzeige[box.dataset.anzeige2d];
            box.onchange = () => {
                anzeige[box.dataset.anzeige2d] = box.checked;
                try { localStorage.setItem("fm_anzeige2d", JSON.stringify(anzeige)); } catch (e) { /* ohne Speicher */ }
            };
        });
        // Auswahlfelder (3D-Qualität)
        document.querySelectorAll("#lmAnsicht [data-anzeige-wahl]").forEach(sel => {
            const schluessel = sel.dataset.anzeigeWahl;
            if (anzeige[schluessel]) sel.value = anzeige[schluessel];
            sel.onchange = () => {
                anzeige[schluessel] = sel.value;
                try { localStorage.setItem("fm_anzeige2d", JSON.stringify(anzeige)); } catch (e) { /* ohne Speicher */ }
                if (schluessel === "qualitaet3D") {
                    this._auto3D = null;
                    this._baue3DNeu();
                }
            };
        });
        // Großes Feld: nur das Spiel, die Kacheln treten zurück - auch mit G
        const gross = document.getElementById("btnLmFeldGross");
        if (gross) {
            const setze = (an) => {
                anzeige.feldGross = an;
                document.getElementById("modalLiveMatch")?.classList.toggle("feld-gross", an);
                gross.setAttribute("aria-pressed", String(an));
                gross.title = an ? "Kacheln wieder zeigen (G)" : "Großes Feld: nur das Spiel (G)";
                const zeichen = gross.querySelector("use");
                if (zeichen) zeichen.setAttribute("href", an ? "#i-klein" : "#i-gross");
                try { localStorage.setItem("fm_anzeige2d", JSON.stringify(anzeige)); } catch (e) { /* ohne Speicher */ }
                // Das Feld bekommt eine neue Fläche
                if (this.liveResizeHandler) this.liveResizeHandler();
            };
            gross.onclick = () => setze(!anzeige.feldGross);
            setze(!!anzeige.feldGross);
            if (!this._feldGrossTaste) {
                this._feldGrossTaste = true;
                document.addEventListener("keydown", (e) => {
                    const modal = document.getElementById("modalLiveMatch");
                    if (e.key !== "g" && e.key !== "G") return;
                    if (!modal || modal.style.display === "none" || e.ctrlKey || e.metaKey || e.altKey) return;
                    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
                    if (document.getElementById("modalCoaching")?.style.display === "flex") return;
                    document.getElementById("btnLmFeldGross")?.click();
                });
            }
        }
        document.querySelectorAll("#lm3dKamera [data-kamera3d]").forEach(btn => {
            btn.classList.toggle("aktiv", btn.dataset.kamera3d === anzeige.kamera3D);
            btn.onclick = () => {
                anzeige.kamera3D = btn.dataset.kamera3d;
                if (this.spielfeld3d) this.spielfeld3d.setzeKamera(anzeige.kamera3D);
                document.querySelectorAll("#lm3dKamera [data-kamera3d]").forEach(b => b.classList.toggle("aktiv", b === btn));
                try { localStorage.setItem("fm_anzeige2d", JSON.stringify(anzeige)); } catch (e) { /* ohne Speicher */ }
            };
        });
    },

    /**
     * Eine kritisch gedämpfte Feder für die Kamera: Sie läuft auf das Ziel zu,
     * ohne zu überschwingen, und ihr Tempo ändert sich stetig - auch wenn das
     * Ziel springt. zeit ist die Glättung in Sekunden. Liefert [wert, tempo].
     */
    kameraFeder(wert, tempo, ziel, zeit, dt) {
        if (!(dt > 0)) return [wert, tempo || 0];
        const omega = 2 / Math.max(0.01, zeit);
        const x = omega * dt;
        const abkling = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        const abstand = wert - ziel;
        const zwischen = ((tempo || 0) + omega * abstand) * dt;
        return [ziel + (abstand + zwischen) * abkling, ((tempo || 0) - omega * zwischen) * abkling];
    },

    /**
     * Gezeichnet wird eine geglättete Lage: Jede Figur und der Ball folgen
     * ihrer Lage in der Simulation mit einer kurzen Verzögerung (Zeitkonstante
     * LAGE_GLAETTUNG). Ändert sich ein Tempo in der Simulation schlagartig -
     * zwei Spieler laufen in den Mindestabstand und werden getrennt, ein Ball
     * wird gespielt -, verteilt sich das im Bild über ein paar Bilder statt
     * eines. Die Simulation selbst bleibt unberührt. Nach einem Schnitt oder
     * einem Sprung über sechs Einheiten steht die Figur sofort am neuen Ort.
     */
    LAGE_GLAETTUNG: 0.07,
    /** Der Ball bekommt eine kürzere Glättung: Er soll nicht sichtbar hinterherhängen */
    BALL_GLAETTUNG: 0.035,
    glaetteLage(speicher, id, x, y, dt, neu = false, zeit = this.LAGE_GLAETTUNG) {
        let g = speicher.get(id);
        if (!g || neu || Math.hypot(x - g.x, y - g.y) > 6) {
            g = { x, y };
            speicher.set(id, g);
            return g;
        }
        const k = 1 - Math.exp(-Math.max(0, dt) / zeit);
        g.x += (x - g.x) * k;
        g.y += (y - g.y) * k;
        return g;
    },

    /**
     * Wer den Ball hat, zeigt das Bild erst, wenn der Ball bei ihm ist.
     *
     * Die Regie nennt den Angespielten schon beim Abspiel (setCarrier). Ring
     * und Namensschild sprangen deshalb mit jedem Pass zum Empfänger, während
     * der Ball noch unterwegs war - im Bild sah das aus, als springe der Ball
     * von Spieler zu Spieler, auf Normal rund fünfzigmal je Minute. Jetzt
     * blendet die Markierung aus, solange der Ball fliegt oder noch nicht am
     * Fuß ist, und beim neuen Ballführenden wieder ein.
     */
    AM_BALL_ABSTAND: 3.5,
    AM_BALL_BLENDE: 0.12,
    spielerAmBall(liveMatch, players, ball, dt, neu = false) {
        const p = players.find(q => q.id === liveMatch.activePlayerId);
        const amFuss = !!p && !liveMatch.ball?.inFlight && Math.hypot(p.x - ball.x, p.y - ball.y) < this.AM_BALL_ABSTAND;
        let z = this._amBall;
        if (!z || neu) z = this._amBall = { id: amFuss ? p.id : null, alpha: amFuss ? 1 : 0 };
        const schritt = Math.min(1, Math.max(0, dt) / this.AM_BALL_BLENDE);
        // Erst blendet der alte Ballführende aus, dann der neue ein
        if (amFuss && (z.id === p.id || z.alpha <= 0)) {
            z.id = p.id;
            z.alpha = Math.min(1, z.alpha + schritt);
        } else {
            z.alpha = Math.max(0, z.alpha - schritt);
        }
        const spieler = z.alpha > 0 ? players.find(q => q.id === z.id) : null;
        return spieler ? { spieler, alpha: z.alpha } : null;
    },

    /**
     * Die 3D-Ansicht zeichnen, wenn sie gewählt ist. Liefert false, wenn
     * stattdessen das 2D-Feld zeichnen soll: solange die Bibliothek noch
     * lädt, und wenn der Browser kein WebGL kann - dann schaltet sie sich
     * mit einem Hinweis ab.
     */
    zeichne3D(liveMatch, dt = 0.016) {
        const anzeige = this.anzeige2D();
        const c3 = document.getElementById("livePitch3D");
        const c2 = document.getElementById("livePitchCanvas");
        if (!c3 || !c2) return false;
        if (!anzeige.dreiD) {
            if (this.spielfeld3d) this.spielfeld3d.beendeWiederholung();
            if (c3.style.display !== "none") this._zeige3D(false);
            return false;
        }
        if (!this.spielfeld3d) {
            const Klasse = typeof Spielfeld3D !== "undefined" ? Spielfeld3D : null;
            const aus = (text) => {
                anzeige.dreiD = false;
                const box = document.querySelector('#lmAnsicht [data-anzeige2d="dreiD"]');
                if (box) box.checked = false;
                this.showToast(text, "warning");
            };
            if (!Klasse || !Klasse.webglMoeglich()) {
                aus("Die 3D-Ansicht braucht WebGL - es geht in 2D weiter.");
                return false;
            }
            // Die Bibliothek lädt erst jetzt - bis dahin zeichnet das 2D-Feld
            if (typeof THREE === "undefined") {
                if (!this._3dLaedt) {
                    this._3dLaedt = true;
                    this.showToast("Die 3D-Ansicht wird geladen …", "info", 1600);
                    Klasse.ladeBibliothek().then(ok => {
                        this._3dLaedt = false;
                        if (!ok) aus("Die 3D-Bibliothek ließ sich nicht laden - es geht in 2D weiter.");
                    });
                }
                return false;
            }
            try {
                this.spielfeld3d = new Klasse(c3, { qualitaet: this._qualitaet3D() });
                this.spielfeld3d.setzeKamera(anzeige.kamera3D);
            } catch (e) {
                console.warn("3D-Ansicht nicht möglich:", e);
                aus("Die 3D-Ansicht braucht WebGL - es geht in 2D weiter.");
                return false;
            }
            // Ein Tipp aufs Feld überspringt die Wiederholung
            if (!this._3dTipp && c3.parentElement) {
                this._3dTipp = true;
                c3.parentElement.addEventListener("click", (ev) => {
                    if (ev.target && ev.target.id === "livePitch3D" && this.spielfeld3d && this.spielfeld3d.wiederholungLaeuft()) {
                        this.spielfeld3d.beendeWiederholung();
                    }
                });
            }
        }
        const feld = this.spielfeld3d.canvas;
        if (feld.style.display === "none") this._zeige3D(true);
        // Dieselbe Fläche wie das 2D-Feld
        if (feld.style.width !== c2.style.width) feld.style.width = c2.style.width;
        if (feld.style.height !== c2.style.height) feld.style.height = c2.style.height;
        this.spielfeld3d.zeichne(liveMatch, dt, { namen: anzeige.namen, wiederholung: anzeige.wiederholung3D !== false });

        // Automatisch: Ruckelt es, geht es eine Stufe herunter
        if (anzeige.qualitaet3D === "auto" && this.spielfeld3d.qualitaet !== "niedrig" && this.spielfeld3d.zuLangsam()) {
            this._auto3D = "niedrig";
            this._baue3DNeu();
            this.showToast("Die 3D-Ansicht läuft jetzt in niedriger Qualität, damit sie flüssig bleibt.", "info");
            return true;
        }

        // Einblendungen (Anstoß, Tor, Halbzeit), die sonst das 2D-Feld zeichnet
        const banner = document.getElementById("lm3dBanner");
        const b = liveMatch.banner;
        const text = this.spielfeld3d.wiederholungLaeuft()
            ? "Wiederholung · Tippen zum Überspringen"
            : (b && b.title ? `${b.title}${b.subtitle ? " · " + b.subtitle : ""}` : "");
        if (banner && banner.dataset.text !== text) {
            banner.dataset.text = text;
            banner.textContent = text;
            banner.style.display = text ? "" : "none";
        }
        return true;
    },

    /** Die gewählte Qualität - bei "Automatisch" mittel, bis es ruckelt */
    _qualitaet3D() {
        const wahl = this.anzeige2D().qualitaet3D;
        if (["niedrig", "mittel", "hoch"].includes(wahl)) return wahl;
        return this._auto3D || "mittel";
    },

    /**
     * Die 3D-Ansicht mit neuer Qualität aufbauen. Kantenglättung lässt sich
     * nur beim Anlegen festlegen - deshalb ein frisches Canvas.
     */
    _baue3DNeu() {
        if (!this.spielfeld3d) return;
        const alt = this.spielfeld3d.canvas;
        this.spielfeld3d.entsorgen();
        this.spielfeld3d = null;
        if (alt && alt.parentElement) {
            const neu = alt.cloneNode(false);
            alt.replaceWith(neu);
        }
    },

    _zeige3D(an) {
        const c3 = document.getElementById("livePitch3D");
        const c2 = document.getElementById("livePitchCanvas");
        if (c3) c3.style.display = an ? "block" : "none";
        if (c2) c2.style.display = an ? "none" : "";
        const kamera = document.getElementById("lm3dKamera");
        if (kamera) kamera.style.display = an ? "" : "none";
        const banner = document.getElementById("lm3dBanner");
        if (banner && !an) { banner.style.display = "none"; banner.dataset.text = ""; }
    },

    /**
     * Ein Spiel starten. Mit { ohneBild: true } ist es das Sofort-Ergebnis:
     * dieselbe Simulation, nur ohne Besprechung, Ansprache und Bild - der
     * Co-Trainer coacht, und nach zwei, drei Sekunden steht der Spielbericht.
     */
    startLiveMatchSimulation(match, optionen = {}) {
        const state = this.app.state;
        const homeClub = state.clubs.find(c => c.id === match.homeClubId);
        const awayClub = state.clubs.find(c => c.id === match.awayClubId);
        const ohneBild = !!optionen.ohneBild;
        if (ohneBild) { this._matchplanDone = true; this._teamTalkDone = true; }

        // Vor dem Anpfiff: erst die Taktikbesprechung (wenn nicht schon vom
        // Dashboard aus festgelegt), dann die Ansprache - erst danach rollt
        // der Ball
        const planEngine = this.getMatchplanEngine();
        if (!this._matchplanDone && !this._teamTalkDone) {
            this._matchplanDone = true;
            const anweisungen = typeof GegneranweisungEngine !== "undefined" ? Object.keys(GegneranweisungEngine.fuerSpiel(state, match)).length : 0;
            if (planEngine && !planEngine.fuerSpiel(state, match) && !anweisungen) {
                this.showMatchplanModal(match, () => this.startLiveMatchSimulation(match));
                return;
            }
        }
        if (!this._teamTalkDone) {
            const gegnerId = match.homeClubId === state.userClubId ? match.awayClubId : match.homeClubId;
            this._teamTalkDone = true;
            this.showTeamTalkModal(
                { phase: "prematch", clubId: state.userClubId, opponentClubId: gegnerId, match },
                () => this.startLiveMatchSimulation(match)
            );
            return;
        }
        this._teamTalkDone = false;
        this._matchplanDone = false;

        // Die eigene Seite - alle Eingriffe von der Seitenlinie gelten ihr.
        // Vorher waren Wechsel und Taktik fest auf "home" verdrahtet: Wer
        // auswaerts spielte, wechselte beim Gegner.
        const userSide = match.homeClubId === state.userClubId ? "home"
            : (match.awayClubId === state.userClubId ? "away" : null);
        const einstellungen = this.liveEinstellungen();
        const liveMatch = MatchEngine.createLiveMatch(match, homeClub, awayClub, state.players, {
            userSide,
            delegation: { ...einstellungen.delegation },
            // Wie im Vorbild: Das Spiel entsteht auf dem Platz aus den
            // Entscheidungen der Spieler - nach ihren Werten und Eigenschaften
            modus: "fm",
            // Der Matchplan aus der Taktikbesprechung
            matchplan: planEngine ? planEngine.spielOptionen(state, match) : null
        });
        // Der Plan gilt für genau dieses Spiel - der Livespiel-Motor hat ihn
        if (planEngine) planEngine.abschliessen(state, match);
        this.app.currentLiveMatch = liveMatch;
        // Die anderen Plätze des Spieltags (nur im Ligaspiel)
        this.bereiteKonferenzVor(state, match);
        // Die Stimmung im Stadion: Choreo, Gesänge, Pfiffe
        this.bereiteAtmosphaereVor(state, match, liveMatch, ohneBild);
        this.coach = null;

        const modal = document.getElementById("modalLiveMatch");
        modal.style.display = "flex";
        this.ordneLivesteuerung();
        // Was vor dem Anpfiff gemeldet wurde, steht in der Zentrale - nicht über der Anzeigetafel
        if (typeof this.leereMeldungsZeile === "function") this.leereMeldungsZeile();

        // Der Wettbewerb färbt den Abend: Pokalnächte sehen anders aus als
        // der 14. Spieltag.
        this.setzeLiveThema(match);
        this.verdrahteAnzeige2D();

        document.getElementById("lmHomeName").textContent = homeClub.name;
        document.getElementById("lmAwayName").textContent = awayClub.name;
        document.getElementById("lmHomeScore").textContent = "0";
        document.getElementById("lmAwayScore").textContent = "0";
        document.getElementById("lmMinute").textContent = "0";
        document.getElementById("lmEventFeed").innerHTML = "";
        const wetterBox = document.getElementById("lmWetter");
        if (wetterBox) {
            const w = liveMatch.wetter;
            wetterBox.innerHTML = w ? `${w.icon} ${this.escapeHtml(w.name)}, ${w.temp} °C · ${this.escapeHtml(w.platzName)}` : "";
            wetterBox.style.display = w ? "" : "none";
        }
        this.bereiteMatchCenterVor(liveMatch);
        if (typeof this.bereiteKachelnVor === "function") this.bereiteKachelnVor(liveMatch);
        if (typeof this.bereiteDarstellungVor === "function") this.bereiteDarstellungVor(liveMatch);

        const canvas = document.getElementById("livePitchCanvas");
        const ctx = canvas.getContext("2d");

        // Statistikfelder nur bei Änderung anfassen (weniger Layout-Arbeit)
        const setText = (id, value) => {
            if (this.liveStatCache[id] === value) return;
            this.liveStatCache[id] = value;
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        const setWidth = (id, value) => {
            const key = `w_${id}`;
            if (this.liveStatCache[key] === value) return;
            this.liveStatCache[key] = value;
            const el = document.getElementById(id);
            if (el) el.style.width = value;
        };

        this.liveStatCache = {};
        this.renderedEventCount = 0;
        this._halftimeTalkShown = false;
        this._halbzeitPfiff = false;

        const updateLiveUI = () => {
            // Halbzeitansprache: einmal, sobald die Pause erreicht ist - also
            // nach dem Halbzeitpfiff, wenn beide Mannschaften zum Wiederanpfiff
            // bereitstehen. Vorher hing sie an Minute 45: Die Nachspielzeit lief
            // noch, und ein "Halbzeitwechsel" kostete eine der drei Unterbrechungen.
            const halbzeitErreicht = typeof liveMatch.istHalbzeitpause === "function"
                ? liveMatch.istHalbzeitpause()
                : (liveMatch.minute >= 45 && liveMatch.minute < 47);
            // Zur Pause zwei Pfiffe, der zweite lang
            if (halbzeitErreicht && !this._halbzeitPfiff && !liveMatch.isFinished) {
                this._halbzeitPfiff = true;
                if (!liveMatch.ohneBild) this.playSound("halbzeit");
            }
            if (!this._halftimeTalkShown && halbzeitErreicht && !liveMatch.isFinished) {
                this._halftimeTalkShown = true;
                const warPausiert = liveMatch.isPaused;
                liveMatch.isPaused = true;

                const istHeim = liveMatch.homeClub.id === state.userClubId;
                const stand = istHeim
                    ? liveMatch.homeScore - liveMatch.awayScore
                    : liveMatch.awayScore - liveMatch.homeScore;
                const gegnerId = istHeim ? liveMatch.awayClub.id : liveMatch.homeClub.id;

                this.showTeamTalkModal(
                    { phase: "halftime", clubId: state.userClubId, opponentClubId: gegnerId, scoreDiff: stand },
                    (res) => {
                        // Eine wirksame Ansprache verändert den weiteren Verlauf
                        if (res && Math.abs(res.moraleDelta) >= 1.5 && typeof liveMatch.resimulateRemainder === "function") {
                            liveMatch.resimulateRemainder();
                        }
                        // Nach der Ansprache kommt die Kabinenbesprechung: Die
                        // Halbzeit ist der Moment für Wechsel, und sie kosten
                        // dort keine der drei Unterbrechungen.
                        if (liveMatch.userSide && this.liveEinstellungen().autoOeffnen.halbzeit) {
                            this.openCoachingWindow({
                                art: "halbzeit",
                                text: "Halbzeit - Wechsel in der Pause kosten keine der drei Unterbrechungen."
                            }, warPausiert);
                        } else {
                            liveMatch.isPaused = warPausiert;
                        }
                    }
                );
            }

            // Was der Trainer entscheiden muss, stoppt das Spiel: ein verletzter
            // eigener Spieler, ein Platzverweis. Ohne Nachfrage spielte der
            // Verletzte einfach weiter, bis man es im Ticker bemerkte.
            if (liveMatch.offeneEntscheidungen && liveMatch.offeneEntscheidungen.length > 0 && !this.coach) {
                const anlass = liveMatch.offeneEntscheidungen.shift();
                const auto = this.liveEinstellungen().autoOeffnen;
                if ((anlass.art === "verletzung" && auto.verletzung) || (anlass.art === "platzverweis" && auto.platzverweis)) {
                    this.openCoachingWindow(anlass);
                } else {
                    this.showToast(anlass.text, "warning");
                }
            }

            this.updateLiveSidelineHints(liveMatch);

            setText("lmHomeScore", String(liveMatch.homeScore));
            setText("lmAwayScore", String(liveMatch.awayScore));
            setText("lmMinute", String(liveMatch.minute));
            setText("lmClock", liveMatch.getClockText ? liveMatch.getClockText() : `${liveMatch.minute}:00`);

            // Was die Uhr gerade bedeutet: läuft, steht in der Pause, ist aus
            const phase = liveMatch.isFinished ? "abpfiff"
                : (halbzeitErreicht ? "halbzeit" : (liveMatch.isPaused ? "pause" : "live"));
            if (this.liveStatCache.phase !== phase) {
                this.liveStatCache.phase = phase;
                const badge = document.getElementById("lmTimeBadge");
                if (badge) badge.dataset.phase = phase;
                setText("lmPhaseLabel", { abpfiff: "Abpfiff", halbzeit: "Halbzeit", pause: "Pause", live: "Live" }[phase]);
            }

            // Kommentar mit Minute als Plakette statt "62' - " im Fließtext
            if (this.liveStatCache.kommentar !== liveMatch.lastCommentary) {
                this.liveStatCache.kommentar = liveMatch.lastCommentary;
                const bar = document.getElementById("lmCommentary");
                if (bar) bar.innerHTML = this.liveZeileHtml(liveMatch.lastCommentary);
            }

            this.renderLiveStats(liveMatch);
            this.renderLiveVerlauf(liveMatch);
            if (typeof this.renderLiveKacheln === "function") this.renderLiveKacheln(liveMatch);
            this.updateLiveZurufe(liveMatch);
            this.updateKonferenz(liveMatch);
            this.updateAtmosphaere(liveMatch);
            setWidth("lmTlFill", `${Math.min(100, Math.max(0, liveMatch.minute / 90 * 100)).toFixed(1)}%`);
            if (document.getElementById("lmSubtab-lineups")?.classList.contains("active")) {
                this.renderLiveLineups(liveMatch);
            }

            // Ticker: nur neue Ereignisse einfügen statt die Liste neu aufzubauen.
            // Die laufende Nummer funktioniert auch, wenn die Ereignisliste
            // bereits ihre Maximallänge erreicht hat.
            const feed = document.getElementById("lmEventFeed");
            const newestSeq = liveMatch.events[0]?.seq || 0;
            if (feed && newestSeq > this.renderedEventCount) {
                const fresh = liveMatch.events.filter(e => (e.seq || 0) > this.renderedEventCount);
                for (let i = fresh.length - 1; i >= 0; i--) {
                    const ev = fresh[i];
                    const node = document.createElement("div");
                    const seite = ev.clubId === liveMatch.homeClub.id ? "home"
                        : (ev.clubId === liveMatch.awayClub.id ? "away" : "");
                    node.className = `ticker-event ticker-${ev.type || "info"}${seite ? ` ticker-${seite}` : ""}`;
                    node.innerHTML = this.liveZeileHtml(ev.text, ev.minute);
                    feed.insertBefore(node, feed.firstChild);
                }
                this.renderedEventCount = newestSeq;
                while (feed.childElementCount > 60) feed.removeChild(feed.lastChild);
            }
        };

        // Kamera: folgt dem Ball und zoomt je nach Spielsituation
        this.camera = { x: 50, y: 50, zoom: 1.25, targetZoom: 1.25, vx: 0, vy: 0, vz: 0 };
        this._bildTakt = null;
        // Namensschilder und geglättete Lagen der letzten Partie vergessen
        this._glatteLagen = new Map();
        this._namenPlatz = new Map();
        this._namenDeckung = new Map();
        this._kameraSchnitte = liveMatch.schnitte || 0;
        this._kameraSprung = false;

        const updateCamera = (dt) => {
            const cam = this.camera;
            const dir = liveMatch.director;
            const mode = dir?.mode || "ambient";
            const phase = dir?.scene?.phase;

            // Zoomstufe nach Situation. Im Spielaufbau bleibt die Totale, damit
            // man die Ordnung beider Mannschaften liest; erst zur Aktion wird
            // herangefahren - wie in einer Fernsehübertragung.
            let zoom = 1.06;
            if (dir?.deadBall) {
                zoom = dir.deadBall.kind === "corner" ? 1.85 : 1.55;
            } else if (mode === "celebration") {
                zoom = 1.45;
            } else if (mode === "highlight") {
                zoom = (phase === "action" || phase === "resolve") ? 1.85 : 1.45;
            } else if (mode === "ambient" && dir && typeof dir.torGefahr === "function") {
                // Stufe 4: Wird es gefährlich, fährt die Kamera in den Strafraum
                const gefahr = dir.torGefahr();
                if (gefahr > 0.3) zoom = 1.06 + Math.min(1, (gefahr - 0.3) / 0.5) * 0.55;
            }
            cam.targetZoom = zoom;

            // Blickpunkt: Ball, leicht in Spielrichtung vorgehalten
            const ball = liveMatch.ball;
            const lead = (ball.targetX - ball.x) * 0.25;
            const focusX = ball.x + lead;
            const focusY = ball.y + (ball.targetY - ball.y) * 0.2;

            // Ein Schnitt (Spulen, Anstoß, Wiederholung): Die Kamera springt
            // mit, wie bei einer Übertragung - sonst führe sie hinter der
            // Blende quer über den Platz
            if ((liveMatch.schnitte || 0) !== this._kameraSchnitte || this._kameraSprung) {
                this._kameraSchnitte = liveMatch.schnitte || 0;
                this._kameraSprung = false;
                cam.x = focusX;
                cam.y = focusY;
                cam.zoom = cam.targetZoom;
                cam.vx = 0; cam.vy = 0; cam.vz = 0;
                return;
            }

            // Wie eine geführte Kamera: gedämpft, ihr Tempo ändert sich stetig.
            // Vorher folgte sie dem Blickpunkt direkt - sprang der (ein Pass,
            // der Vorhalt aufs Ziel, eine neue Zoomstufe), änderte sich ihr
            // Tempo im selben Bild, und das ganze Feld ruckte.
            const glatt = mode === "highlight" ? 0.26 : 0.42;
            [cam.x, cam.vx] = this.kameraFeder(cam.x, cam.vx, focusX, glatt, dt);
            [cam.y, cam.vy] = this.kameraFeder(cam.y, cam.vy, focusY, glatt, dt);
            [cam.zoom, cam.vz] = this.kameraFeder(cam.zoom, cam.vz, cam.targetZoom, 0.55, dt);
        };

        const render2DCanvas = (dt = 0.016) => {
            const rasen = this.anzeige2D().rasen === "modern" ? "modern" : "klassisch";
            if (!this.pitchBackdrop || this.pitchBackdrop.canvas.width !== canvas.width || this.pitchBackdrop.canvas.height !== canvas.height
                || this.pitchBackdrop.stil !== rasen) {
                this.pitchBackdrop = this.buildPitchBackdrop(canvas.width, canvas.height, rasen);
            }
            const bg = this.pitchBackdrop;
            if (!bg) return;

            updateCamera(dt);

            const { pitchX, pitchY, pitchW, pitchH } = bg;
            const cam = this.camera;

            // In der Laenge liegen die Torlinien bei x = 4 und x = 96 - so
            // rechnet die ganze Simulation. Gezeichnet waren sie bei 0 und
            // 100: Der Torwart stand dadurch vier Meter vor seinem Tor, und
            // jede Ecke, jeder Schuss lag um dieses Stueck daneben.
            const scaleX = (pitchW / FELD_LAENGE) * cam.zoom;
            const scaleY = (pitchH / 100) * cam.zoom;

            // Sichtbarer Ausschnitt in Feldkoordinaten. Weil das Bild breiter
            // als hoch ist, unterscheiden sich die Halbachsen - ohne diese
            // Rechnung schob sich der Rasen aus dem Bild.
            const halfW = (canvas.width / scaleX) / 2;
            const halfH = (canvas.height / scaleY) / 2;

            // Etwas Rand um das Spielfeld darf sichtbar bleiben
            const marginX = (pitchX / pitchW) * FELD_LAENGE;
            const marginY = (pitchY / pitchH) * 100;

            const clampAxis = (value, half, margin, lo = 0, hi = 100) => {
                const min = lo + half - margin;
                const max = hi + margin - half;
                if (min > max) return (lo + hi) / 2;
                return Math.max(min, Math.min(max, value));
            };

            const camX = clampAxis(cam.x, halfW, marginX, TORLINIE_LINKS, TORLINIE_RECHTS);
            const camY = clampAxis(cam.y, halfH, marginY);
            const originX = canvas.width / 2 - (camX - TORLINIE_LINKS) * scaleX;
            const originY = canvas.height / 2 - camY * scaleY;

            const toX = px => originX + (px - TORLINIE_LINKS) * scaleX;
            const toY = py => originY + py * scaleY;
            const unit = pitchW / 105 * cam.zoom; // ein Meter in Bildpunkten

            // 1. Rasen im Kameraausschnitt.
            //    Ein Punkt (bx) des vorgerenderten Rasens liegt auf dem Bildschirm
            //    bei originX + (bx - pitchX) * zoom - also eine reine Verschiebung
            //    plus Skalierung.
            ctx.fillStyle = bg.umfeld || "#08301d";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.setTransform(cam.zoom, 0, 0, cam.zoom,
                originX - pitchX * cam.zoom, originY - pitchY * cam.zoom);
            ctx.drawImage(bg.canvas, 0, 0);
            ctx.restore();

            // Die geglättete Lage von Spielern und Ball (glaetteLage). Der Rest
            // der Figur - Name, Nummer, Tempo, Blickrichtung - bleibt, wie er ist.
            const wdhJetzt = !!(this._wdh && this._wdh.aktiv);
            const neueSzene = (liveMatch.schnitte || 0) !== this._glattSchnitte || wdhJetzt !== this._glattWdh;
            this._glattSchnitte = liveMatch.schnitte || 0;
            this._glattWdh = wdhJetzt;
            const lagen = this._glatteLagen || (this._glatteLagen = new Map());
            const players = (liveMatch.players2D || []).map(p => {
                const g = this.glaetteLage(lagen, p.id, p.x, p.y, dt, neueSzene);
                return Object.assign(Object.create(p), { x: g.x, y: g.y });
            });
            const ballLage = this.glaetteLage(lagen, "ball", liveMatch.ball.x, liveMatch.ball.y, dt, neueSzene, this.BALL_GLAETTUNG);
            const ball = Object.assign(Object.create(liveMatch.ball), { x: ballLage.x, y: ballLage.y });
            // Ring und Schild des Ballführenden erst, wenn der Ball bei ihm ist
            const amBall = this.spielerAmBall(liveMatch, players, ball, dt, neueSzene);

            // 2. Ballspur aus dem gezeichneten Ball - am Boden unter den
            //    Spielern, das Stück in der Luft kommt mit dem Ball (6.)
            const ballGrund = Math.max(3, (pitchW / 105) * 0.62 * cam.zoom);
            const dir = liveMatch.director;
            const wdhSkala = (typeof dir?.getAbspielTempo === "function" ? dir.getAbspielTempo() : 1) * this.WIEDERHOLUNG_2D.tempo;
            this.merkeBallspur(ball, neueSzene, wdhSkala, wdhJetzt);
            this.zeichneBallspur(ctx, ball, toX, toY, unit, ballGrund, false);

            // Spielergröße wächst mit dem Zoom, aber gedämpft
            // Gut ein Siebtel größer als vorher: Die Rückennummern waren in der
            // Totale kaum zu lesen, auf dem Handy gar nicht.
            const radius = Math.max(7, (pitchW / 105) * 1.5 * (0.5 * cam.zoom + 0.5));
            const torwartFarbe = team => liveMatch.kits?.[team]?.tw || (team === "home" ? "#facc15" : "#22d3ee");

            const numberFont = `bold ${Math.round(radius * 0.92)}px 'Inter', system-ui, sans-serif`;
            const nameFont = `600 ${Math.round(radius * 0.78)}px 'Inter', system-ui, sans-serif`;

            const anzeige = this.anzeige2D();

            // Formationslinien: Jede Mannschaftsreihe als Linie, dazu die
            // Verbindung zur Reihe dahinter - so sieht man auf einen Blick,
            // ob die Kette steht, wie kompakt der Block ist und wer seine
            // Position verlassen hat.
            const eigeneSeite = liveMatch.userSide || "home";
            [["home", eigeneSeite === "home" ? anzeige.formEigene : anzeige.formGegner],
                ["away", eigeneSeite === "away" ? anzeige.formEigene : anzeige.formGegner]].forEach(([team, an]) => {
                if (!an) return;
                const elf = players.filter(p => p.team === team && p.pos !== "TW");
                const farbe = elf[0]?.color || (team === "home" ? "#3b82f6" : "#ef4444");
                const reihen = ["def", "mid", "att"].map(g => elf.filter(p => p.group === g).sort((a, b) => a.y - b.y));
                ctx.save();
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                // Verbindungen zwischen den Reihen: zum naechsten Mitspieler dahinter
                ctx.strokeStyle = farbe;
                ctx.globalAlpha = 0.32;
                ctx.lineWidth = Math.max(1, radius * 0.16);
                ctx.setLineDash([radius * 0.5, radius * 0.45]);
                for (let r = 1; r < reihen.length; r++) {
                    const hinten = reihen[r - 1].length ? reihen[r - 1] : (reihen[r - 2] || []);
                    reihen[r].forEach(p => {
                        let best = null, bestD = Infinity;
                        hinten.forEach(q => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bestD) { bestD = d; best = q; } });
                        if (!best) return;
                        ctx.beginPath();
                        ctx.moveTo(toX(p.x), toY(p.y));
                        ctx.lineTo(toX(best.x), toY(best.y));
                        ctx.stroke();
                    });
                }
                ctx.setLineDash([]);
                // Die Reihen selbst
                ctx.globalAlpha = 0.75;
                ctx.lineWidth = Math.max(1.5, radius * 0.26);
                reihen.forEach(reihe => {
                    if (reihe.length < 2) return;
                    ctx.beginPath();
                    reihe.forEach((p, i) => i ? ctx.lineTo(toX(p.x), toY(p.y)) : ctx.moveTo(toX(p.x), toY(p.y)));
                    ctx.stroke();
                });
                ctx.restore();
            });

            // Stufe 4: Laufwege und Passwege, im Augen-Menü einblendbar - nicht
            // in der Wiederholung, sie gehören zum laufenden Spiel
            const inWiederholung = !!(this._wdh && this._wdh.aktiv);
            if (anzeige.laufwege && !inWiederholung) this.zeichneLaufwege(ctx, players, toX, toY, radius);
            if (anzeige.passwege && !inWiederholung) this.zeichnePasswege(ctx, liveMatch, toX, toY, radius);
            // Steilpass und langer Ball: Weg, Zielpunkt, Laufweg des Empfängers
            if (anzeige.steilpaesse !== false && !inWiederholung) this.zeichneSteilpass(ctx, liveMatch, players, ball, toX, toY, radius);

            // Jubel am Boden: Netz, Ringe, der Torschütze
            const torlinien = [TORLINIE_LINKS, TORLINIE_RECHTS];
            this.zeichneTorjubel(ctx, liveMatch, players, ball, toX, toY, unit, radius, torlinien, inWiederholung, "boden", dt);

            // 3. Schatten
            this.zeichneSchatten(ctx, players, toX, toY, radius);

            // 4. Spieler
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.12;

            players.forEach(p => {
                const px = toX(p.x);
                const py = toY(p.y);
                if (px < -60 || px > canvas.width + 60 || py < -60 || py > canvas.height + 60) return;

                const isActive = !!amBall && amBall.spieler.id === p.id;
                const isKeeper = p.pos === "TW";

                if (isActive) {
                    ctx.globalAlpha = amBall.alpha;
                    ctx.beginPath();
                    ctx.arc(px, py, radius * 1.55 * pulse, 0, Math.PI * 2);
                    ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
                    ctx.lineWidth = Math.max(1.5, radius * 0.16);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }

                // Körper - der Torwart streckt sich beim Hechtsprung
                const hechtet = p.diving > 0 && ctx.ellipse;
                const koerper = () => {
                    ctx.beginPath();
                    if (hechtet) {
                        const streckung = 1 + Math.min(1, p.diving / 0.85) * 0.95;
                        ctx.ellipse(px, py, radius * streckung, radius * 0.78,
                            p.diveAngle || 0, 0, Math.PI * 2);
                    } else {
                        ctx.arc(px, py, radius, 0, Math.PI * 2);
                    }
                };

                // Die Figur als klassisches Spielersymbol: Punkt in der
                // Vereinsfarbe, dünner weißer Ring, die Nummer darauf und
                // außen am Rand ein weißer Pfeil in Blickrichtung. Vorher lag
                // ein halbdurchsichtiger Keil über der Nummer und verdeckte sie.
                // Der Pfeil kommt zuerst, der Punkt deckt seinen Fuß ab.
                if (typeof p.facing === "number" && !hechtet) {
                    const w = p.facing, spitze = radius * 1.72, fuss = radius * 0.8;
                    ctx.beginPath();
                    ctx.moveTo(px + Math.cos(w) * spitze, py + Math.sin(w) * spitze);
                    ctx.lineTo(px + Math.cos(w + 0.62) * fuss, py + Math.sin(w + 0.62) * fuss);
                    ctx.lineTo(px + Math.cos(w - 0.62) * fuss, py + Math.sin(w - 0.62) * fuss);
                    ctx.closePath();
                    ctx.fillStyle = "#f8fafc";
                    ctx.fill();
                    ctx.strokeStyle = "rgba(6, 10, 14, 0.35)";
                    ctx.lineWidth = Math.max(0.8, radius * 0.07);
                    ctx.stroke();
                }

                koerper();
                ctx.fillStyle = isKeeper ? torwartFarbe(p.team) : (p.color || "#3b82f6");
                ctx.fill();
                ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
                ctx.lineWidth = Math.max(1.2, radius * 0.14);
                ctx.stroke();

                ctx.fillStyle = isKeeper ? (liveMatch.kits?.[p.team]?.twText || "#0f172a") : (p.textColor || "#ffffff");
                ctx.font = numberFont;
                ctx.fillText(p.number, px, py + radius * 0.05);

                // Erschöpfung: roter Ring, wenn die Kondition deutlich nachlässt
                if (p.freshness < 0.78) {
                    ctx.beginPath();
                    ctx.arc(px, py, radius * 1.24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - (p.freshness - 0.6) / 0.4));
                    ctx.strokeStyle = "rgba(248, 113, 113, 0.75)";
                    ctx.lineWidth = Math.max(1, radius * 0.14);
                    ctx.stroke();
                }

                // Angeschlagen: kleines Sanitätskreuz über dem Spieler
                if (p.verletzt) {
                    const kx = px + radius * 0.95;
                    const ky = py - radius * 1.25;
                    const k = radius * 0.5;
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(kx - k, ky - k, k * 2, k * 2);
                    ctx.fillStyle = "#dc2626";
                    ctx.fillRect(kx - k * 0.22, ky - k * 0.75, k * 0.44, k * 1.5);
                    ctx.fillRect(kx - k * 0.75, ky - k * 0.22, k * 1.5, k * 0.44);
                }
            });

            // Wer das Feld verlässt - ausgewechselt oder vom Platz gestellt -
            // geht blass zur Linie. In der Simulation spielt er nicht mehr mit.
            (liveMatch.abgaenge || []).forEach(a => {
                const ax = toX(a.x);
                const ay = toY(a.y);
                if (ax < -60 || ax > canvas.width + 60 || ay < -60 || ay > canvas.height + 60) return;
                ctx.save();
                ctx.globalAlpha = 0.45;
                ctx.beginPath();
                ctx.arc(ax, ay, radius, 0, Math.PI * 2);
                ctx.fillStyle = a.pos === "TW" ? torwartFarbe(a.team) : (a.color || "#64748b");
                ctx.fill();
                ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
                ctx.lineWidth = Math.max(1, radius * 0.13);
                ctx.stroke();
                ctx.fillStyle = a.pos === "TW" ? (liveMatch.kits?.[a.team]?.twText || "#0f172a") : (a.textColor || "#ffffff");
                ctx.font = numberFont;
                ctx.fillText(a.number, ax, ay + radius * 0.05);
                ctx.restore();
            });

            // 5. Namen unter den Punkten - wie im Vorbild. Im Getümmel lagen sie
            //    übereinander und waren nicht zu lesen. Jetzt bekommt jeder
            //    Name einen freien Platz: zuerst das Schild des Ballführenden,
            //    dann nach Nähe zum Ball, unter dem Punkt oder darüber. Findet
            //    ein Name keinen Platz, bleibt er weg. Der Platz vom letzten
            //    Bild wird bevorzugt, damit nichts hin und her springt.
            const belegt = [];
            const frei = (k) => k.x1 > -60 && k.x2 < canvas.width + 60 && k.y1 > -60 && k.y2 < canvas.height + 60
                && !belegt.some(b => k.x1 < b.x2 && k.x2 > b.x1 && k.y1 < b.y2 && k.y2 > b.y1);
            const kasten = (px, mitteY, breite, hoehe) => ({ x1: px - breite / 2, x2: px + breite / 2, y1: mitteY - hoehe / 2, y2: mitteY + hoehe / 2, y: mitteY });
            const plaetze = this._namenPlatz || (this._namenPlatz = new Map());
            const nachBall = (a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y);
            const padX = radius * 0.42;
            const pillH = radius * 1.06;
            const schild = (p, k) => {
                const lastName = p.name ? p.name.split(" ").pop() : "";
                ctx.fillStyle = "rgba(12, 16, 22, 0.82)";
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(k.x1, k.y1, k.x2 - k.x1, pillH, pillH / 2);
                else ctx.rect(k.x1, k.y1, k.x2 - k.x1, pillH);
                ctx.fill();
                ctx.fillStyle = "#f1f5f9";
                ctx.font = nameFont;
                ctx.fillText(lastName, (k.x1 + k.x2) / 2, k.y);
            };
            const schildKasten = (p, oben = false) => {
                const lastName = p.name ? p.name.split(" ").pop() : "";
                if (!lastName) return null;
                const breite = this.measureCached(ctx, lastName, nameFont) + padX * 2;
                const py = toY(p.y);
                return kasten(toX(p.x), oben ? py - radius * 1.15 - pillH / 2 : py + radius * 1.15 + pillH / 2, breite, pillH);
            };
            const aktiver = amBall ? amBall.spieler : null;
            const aktivKasten = aktiver ? schildKasten(aktiver) : null;
            if (aktivKasten) belegt.push(aktivKasten);

            if (anzeige.namen) {
                const kleinFont = `600 ${Math.round(radius * 0.7)}px 'Inter', system-ui, sans-serif`;
                const hoehe = radius * 0.95;
                ctx.font = kleinFont;
                ctx.lineJoin = "round";
                // Schilder blenden weich ein und aus, auch beim Wechsel unter den
                // Punkt oder darüber. Vorher sprangen sie: Gemessen tauchte im
                // Gedränge achtmal je Sekunde irgendwo ein Name auf, verschwand
                // oder wechselte die Seite - das Bild flackerte.
                const deckung = this._namenDeckung || (this._namenDeckung = new Map());
                const blende = Math.min(1, Math.max(0, dt) / 0.18);
                const gesetzt = new Set();
                const zeichneName = (name, px, y, alpha) => {
                    ctx.globalAlpha = alpha;
                    ctx.strokeStyle = "rgba(6, 10, 14, 0.85)";
                    ctx.lineWidth = Math.max(2, radius * 0.32);
                    ctx.strokeText(name, px, y);
                    ctx.fillStyle = "rgba(241, 245, 249, 0.92)";
                    ctx.fillText(name, px, y);
                    ctx.globalAlpha = 1;
                };
                players.filter(p => p !== aktiver).sort(nachBall).forEach(p => {
                    const lastName = p.name ? p.name.split(" ").pop() : "";
                    if (!lastName) return;
                    const px = toX(p.x), py = toY(p.y);
                    const breite = this.measureCached(ctx, lastName, kleinFont) + 4;
                    const unten = kasten(px, py + radius * 1.72, breite, hoehe);
                    const oben = kasten(px, py - radius * 1.72, breite, hoehe);
                    const k = (plaetze.get(p.id) === "oben" ? [oben, unten] : [unten, oben]).find(frei);
                    if (!k) { plaetze.delete(p.id); return; }
                    const seite = k === oben ? "oben" : "unten";
                    plaetze.set(p.id, seite);
                    belegt.push(k);
                    gesetzt.add(`${p.id}|${seite}`);
                });
                // Jedes Schild auf seinem Weg zu sichtbar oder unsichtbar zeichnen
                ctx.font = kleinFont;
                players.forEach(p => {
                    if (p === aktiver) return;
                    const lastName = p.name ? p.name.split(" ").pop() : "";
                    if (!lastName) return;
                    ["unten", "oben"].forEach(seite => {
                        const schluessel = `${p.id}|${seite}`;
                        const an = gesetzt.has(schluessel);
                        const alt = deckung.get(schluessel) || 0;
                        const alpha = an ? Math.min(1, alt + blende) : Math.max(0, alt - blende);
                        if (alpha <= 0) { deckung.delete(schluessel); return; }
                        deckung.set(schluessel, alpha);
                        const px = toX(p.x), py = toY(p.y);
                        zeichneName(lastName, px, seite === "oben" ? py - radius * 1.72 : py + radius * 1.72, alpha);
                    });
                });
            } else {
                // Ohne Namen: Schilder für die Spieler am Ball, höchstens vier,
                // und nur, wo sie sich nicht überdecken
                players.filter(p => p !== aktiver && Math.hypot(p.x - ball.x, p.y - ball.y) < 20).sort(nachBall).slice(0, 4).forEach(p => {
                    const k = [schildKasten(p), schildKasten(p, true)].find(x => x && frei(x));
                    if (!k) return;
                    belegt.push(k);
                    schild(p, k);
                });
            }
            if (aktivKasten) {
                ctx.globalAlpha = amBall.alpha;
                schild(aktiver, aktivKasten);
                ctx.globalAlpha = 1;
            }

            // 6. Ball mit Flughöhe
            const bx = toX(ball.x);
            const by = toY(ball.y);
            const height = ball.height || 0;
            const ballR = ballGrund * (1 + height * 0.45);

            this.zeichneBallschatten(ctx, bx, by, ballR, height, unit);
            this.zeichneBallspur(ctx, ball, toX, toY, unit, ballGrund, true);

            ctx.beginPath();
            ctx.arc(bx, by - height * unit * 1.4, ballR, 0, Math.PI * 2);
            ctx.fillStyle = "#f8fafc";
            ctx.fill();
            ctx.strokeStyle = "rgba(12, 16, 22, 0.75)";
            ctx.lineWidth = Math.max(1, ballR * 0.22);
            ctx.stroke();

            // 6b. Karten: Der Schiedsrichter selbst wird nicht gezeichnet - sein
            //    Punkt lenkte nur ab. Eine Karte erscheint neben dem verwarnten
            //    Spieler, sonst am Tatort - über allen Punkten.
            const card = liveMatch.refereeCard;
            if (card) {
                const verwarnt = liveMatch.kartenSpieler
                    ? (liveMatch.players2D || []).find(p => p.id === liveMatch.kartenSpieler)
                    : null;
                const ort = verwarnt || liveMatch.referee;
                if (ort) {
                    const cw = radius * 0.78;
                    const ch = radius * 1.1;
                    const cx = toX(ort.x) + radius * 1.05;
                    const cy = toY(ort.y) - radius * 2.1;
                    ctx.fillStyle = card === "yellow" ? "#facc15" : "#dc2626";
                    ctx.fillRect(cx, cy, cw, ch);
                    ctx.strokeStyle = "rgba(0,0,0,0.65)";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(cx, cy, cw, ch);

                    // Gelb-Rot: beide Karten nebeneinander
                    if (card === "second_yellow") {
                        ctx.fillStyle = "#facc15";
                        ctx.fillRect(cx - cw * 1.25, cy, cw, ch);
                        ctx.strokeRect(cx - cw * 1.25, cy, cw, ch);
                    }
                }
            }

            // 6c. Konfetti nach einem Tor, über allem auf dem Rasen
            this.zeichneTorjubel(ctx, liveMatch, players, ball, toX, toY, unit, radius, torlinien, inWiederholung, "oben", dt);

            // 7. Übersichtsradar, sobald herangezoomt wird
            if (cam.zoom > 1.3) {
                this.drawRadar(ctx, canvas, liveMatch, camX, camY, halfW, halfH);
            }

            // 8. Einblendungen der Regie
            this.drawBroadcastOverlays(ctx, canvas, liveMatch, bg);

            // 9. Blende bei einem Schnitt der Uebertragung (Ecke, Anstoss
            //    nach einem Tor): kurz dunkel, dann das neue Bild
            if (liveMatch.blende > 0) {
                ctx.fillStyle = `rgba(4, 7, 10, ${Math.min(0.9, liveMatch.blende / 0.45 * 0.9)})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                liveMatch.blende = Math.max(0, liveMatch.blende - dt);
            }
        };


        // Zurufe von der Seitenlinie - ohne Pause, nur für die eigene Mannschaft
        const zurufLeiste = document.getElementById("lmZurufe");
        if (zurufLeiste) {
            zurufLeiste.style.display = liveMatch.userSide ? "" : "none";
            zurufLeiste.querySelectorAll("[data-zuruf]").forEach(btn => {
                btn.onclick = () => {
                    const r = liveMatch.zuruf(liveMatch.userSide, btn.dataset.zuruf);
                    this.showToast(r.message, r.success ? "success" : "error");
                    this._lmZurufKey = null;
                    this.updateLiveZurufe(liveMatch);
                };
            });
        }
        this._lmZurufKey = null;

        this.resizeLiveCanvas();
        const ohneBildBox = document.getElementById("lmOhneBild");
        if (ohneBildBox) ohneBildBox.style.display = "none";
        if (ohneBild) this.schalteOhneBild(liveMatch);
        else this.startCrowdAmbience();
        let lastFrameTime = performance.now();

        const tickLoop = (now) => {
            // Sofort-Ergebnis: Je Bild ein Häppchen Simulation, gezeichnet
            // wird nur der Stand - so bleibt die Seite bedienbar
            if (liveMatch.ohneBild && !liveMatch.isFinished) {
                liveMatch.rechneOhneBild(18);
                this.zeigeOhneBildStand(liveMatch);
                setText("lmHomeScore", String(liveMatch.homeScore));
                setText("lmAwayScore", String(liveMatch.awayScore));
                setText("lmMinute", String(liveMatch.minute));
                setText("lmClock", liveMatch.getClockText ? liveMatch.getClockText() : `${liveMatch.minute}:00`);
                if (!liveMatch.isFinished) {
                    this.liveMatchAnimFrame = requestAnimationFrame(tickLoop);
                    return;
                }
            }
            if (liveMatch.isFinished) {
                cancelAnimationFrame(this.liveMatchAnimFrame);
                this.liveMatchAnimFrame = null;
                if (this.coach) {
                    this.coach = null;
                    const coachModal = document.getElementById("modalCoaching");
                    if (coachModal) coachModal.style.display = "none";
                }
                const strip = document.getElementById("lmPendingStrip");
                if (strip) strip.style.display = "none";
                this._lmPendingKey = null;
                if (this.liveResizeHandler) {
                    window.removeEventListener("resize", this.liveResizeHandler);
                    this.liveResizeHandler = null;
                }
                // Abpfiff: drei Pfiffe, der letzte lang - die Kulisse klingt aus,
                // die Menümusik kommt erst mit dem Spielbericht zurück
                if (!liveMatch.ohneBild) this.playSound("abpfiff");
                this.stopCrowdAmbience({ ohneMusik: true, ausblenden: 3 });
                updateLiveUI();
                if (!this.zeichne3D(liveMatch)) render2DCanvas();
                // Die übrigen Partien laufen parallel - beim Abpfiff steht
                // auch die Tabelle beziehungsweise das Tableau der Runde
                if (this._laufenderPokaltermin) {
                    this.finishCupTieAroundUser();
                } else if (this._laufendesTestspiel) {
                    this.schliesseTestspielAb(match);
                } else {
                    this.finishMatchdayAroundUser();
                }
                const ohneBildEnde = !!liveMatch.ohneBild;
                if (ohneBildEnde) this.zeigeOhneBildStand(liveMatch);
                setTimeout(() => {
                    modal.style.display = "none";
                    const box = document.getElementById("lmOhneBild");
                    if (box) box.style.display = "none";
                    this.showMatchReportModal(match);
                }, ohneBildEnde ? 450 : 1500);
                return;
            }

            // Delta-Zeit begrenzen, damit ein Tabwechsel keinen Sprung verursacht
            const deltaMs = Math.min(120, now - lastFrameTime);
            if (!liveMatch.isPaused) this.pruefeBildrate(now - lastFrameTime);
            lastFrameTime = now;

            // Während der Torwiederholung (3D oder 2D) steht die Simulation still
            const wiederholung2D = this.wiederholung2DLaeuft(liveMatch, now);
            const wiederholung = wiederholung2D || (this.spielfeld3d && this.spielfeld3d.wiederholungLaeuft() && this.anzeige2D().dreiD);
            // Höhepunkte: Ruhige Phasen laufen ohne Bild durch, bis die nächste Szene beginnt
            const ansicht = this.liveEinstellungen().ansicht;
            // Steht eine Torwiederholung aus, wird bis dahin nicht gespult - sonst
            // ginge der Anstoß im Zeitraffer weg, und mit ihm der Puffer
            const spult = !wiederholung && !this._wdh && ansicht !== "ganz"
                && typeof liveMatch.spuleRuhigePhase === "function" && liveMatch.spuleRuhigePhase(14, ansicht);
            this.zeigeSpulen(liveMatch, spult);
            if (!wiederholung && !spult) {
                liveMatch.advanceRealTime(deltaMs);
                liveMatch.updateBallAndPlayers(deltaMs);
            }

            // Klanghinweise der Regie abarbeiten (Pfiff, Jubel, Raunen)
            if (Array.isArray(liveMatch.soundCues) && liveMatch.soundCues.length > 0) {
                liveMatch.soundCues.forEach(cue => this.playSound(cue));
                liveMatch.soundCues.length = 0;
            }

            this.updateCrowdAmbience(liveMatch, deltaMs / 1000);

            updateLiveUI();
            if (wiederholung2D) {
                // Die Wiederholung: die gespeicherten Positionen zeichnen, danach
                // wieder die echten - das Spiel steht so lange
                this.zeigeWiederholungsBild(liveMatch, now, () => render2DCanvas(deltaMs / 1000));
            } else {
                if (!wiederholung && !spult) this.nimmBildAuf(liveMatch, deltaMs);
                if (!this.zeichne3D(liveMatch, deltaMs / 1000)) render2DCanvas(deltaMs / 1000);
            }

            this.liveMatchAnimFrame = requestAnimationFrame(tickLoop);
        };

        // Canvas an Fenstergröße anpassen, solange das Modal offen ist
        this.liveResizeHandler = () => {
            this._kachelSicht = null;
            if (this.resizeLiveCanvas()) render2DCanvas();
        };
        window.addEventListener("resize", this.liveResizeHandler);

        this.liveMatchAnimFrame = requestAnimationFrame(tickLoop);

        // Nach einer Pause darf das erste Bild nicht die ganze Pausenzeit
        // nachholen - das Seitenlinienfenster setzt die Uhr hierüber zurück.
        this._liveFrameReset = () => { lastFrameTime = performance.now(); };

        // Controls Binden
        document.getElementById("btnLmPause").onclick = () => {
            liveMatch.isPaused = !liveMatch.isPaused;
            this.updateLivePauseButton(liveMatch);
            lastFrameTime = performance.now();
        };
        this.updateLivePauseButton(liveMatch);

        const coachBtn = document.getElementById("btnLmCoaching");
        if (coachBtn) {
            // Nur wer eine eigene Mannschaft auf dem Platz hat, steht an der Linie
            coachBtn.style.display = liveMatch.userSide ? "" : "none";
            coachBtn.onclick = () => this.openCoachingWindow(null);
        }

        // Tempo: zum Anpfiff das zuletzt gewählte, jede Wahl wird gemerkt
        const liveWahl = this.liveEinstellungen();
        liveMatch.speed = liveWahl.tempo;
        document.querySelectorAll(".speed-btn").forEach(btn => {
            btn.classList.toggle("active", Number(btn.dataset.speed) === liveMatch.speed);
            btn.onclick = () => {
                document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const speedVal = btn.dataset.speed;
                liveMatch.speed = isNaN(speedVal) ? speedVal : parseInt(speedVal, 10);
                if ([1, 2, 4].includes(liveMatch.speed)) liveWahl.tempo = liveMatch.speed;
                lastFrameTime = performance.now();
            };
        });
        // Höhepunkte oder das ganze Spiel - umschaltbar mitten in der Partie
        const ansichtKnopf = document.getElementById("btnLmAnsicht");
        // Drei Stufen wie im Vorbild: Schlüsselszenen (nur Torgefahr),
        // Höhepunkte (jeder Angriff), ganzes Spiel
        const ANSICHTEN = {
            schluessel: { lang: "Schlüsselszenen", kurz: "Schlüssel", titel: "Nur Szenen mit Torgefahr. Tippen: alle Höhepunkte", weiter: "hoehepunkte" },
            hoehepunkte: { lang: "Höhepunkte", kurz: "Szenen", titel: "Jeder Angriff, ruhige Phasen laufen ohne Bild durch. Tippen: ganzes Spiel", weiter: "ganz" },
            ganz: { lang: "Ganzes Spiel", kurz: "Alles", titel: "Alle 90 Minuten. Tippen: nur Schlüsselszenen", weiter: "schluessel" }
        };
        const zeigeAnsicht = () => {
            if (!ansichtKnopf) return;
            const a = ANSICHTEN[liveWahl.ansicht] || ANSICHTEN.hoehepunkte;
            const gekuerzt = liveWahl.ansicht !== "ganz";
            ansichtKnopf.classList.toggle("active", gekuerzt);
            ansichtKnopf.setAttribute("aria-pressed", String(gekuerzt));
            ansichtKnopf.innerHTML = `<span class="lm-speed-lang">${a.lang}</span><span class="lm-speed-kurz">${a.kurz}</span>`;
            ansichtKnopf.title = a.titel;
        };
        if (ansichtKnopf) {
            ansichtKnopf.style.display = liveMatch.modus === "fm" ? "" : "none";
            ansichtKnopf.onclick = () => {
                liveWahl.ansicht = (ANSICHTEN[liveWahl.ansicht] || ANSICHTEN.hoehepunkte).weiter;
                zeigeAnsicht();
                lastFrameTime = performance.now();
            };
            zeigeAnsicht();
        }

        document.getElementById("btnLmSkip").onclick = () => {
            if (liveMatch.isFinished || liveMatch.ohneBild) return;
            // Dieselbe Simulation läuft ohne Bild weiter - nur wo es keine
            // Laufwege gibt, bleibt es beim Sprung ans Ende
            if (liveMatch.modus === "fm" && liveMatch.director && typeof liveMatch.rechneOhneBild === "function") {
                this.schalteOhneBild(liveMatch);
                lastFrameTime = performance.now();
                return;
            }
            this.stopCrowdAmbience();
            liveMatch.skipToEnd();
            updateLiveUI();
            render2DCanvas();
        };

        // Subtabs
        document.querySelectorAll(".live-subtab").forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll(".live-subtab").forEach(t => t.classList.remove("active"));
                document.querySelectorAll(".live-subtab-pane").forEach(p => p.classList.remove("active"));
                tab.classList.add("active");
                tab.classList.remove("lm-konf-neu");
                document.getElementById(`lmSubtab-${tab.dataset.subtab}`).classList.add("active");
                if (tab.dataset.subtab === "lineups") {
                    this._lmLineupKey = null;
                    this.renderLiveLineups(liveMatch);
                }
            };
        });
    },

    // ------------------------------------------------------------ Konferenz

    getKonferenzEngine() {
        return (typeof KonferenzEngine !== "undefined" && KonferenzEngine)
            || (typeof window !== "undefined" && window.KonferenzEngine) || null;
    },

    /** Beim Anpfiff: die übrigen Partien des Spieltags rechnen, Reiter zeigen */
    bereiteKonferenzVor(state, match) {
        const engine = this.getKonferenzEngine();
        let konf = null;
        try { konf = engine ? engine.bereite(state, match) : null; } catch (e) { console.warn("Konferenz nicht verfügbar:", e); }
        this._konferenz = konf && konf.partien.length ? konf : null;
        this._konfMinute = 0;
        this._konfKey = null;
        this._konfFrisch = new Map();
        const tab = document.getElementById("lmKonfTab");
        if (tab) {
            tab.hidden = !this._konferenz;
            tab.classList.remove("lm-konf-neu");
            if (tab.parentElement) tab.parentElement.classList.toggle("mit-konferenz", !!this._konferenz);
            // Ohne Konferenz darf ihr Reiter nicht offen bleiben
            if (!this._konferenz && tab.classList.contains("active")) document.querySelector('.live-subtab[data-subtab="stats"]')?.click();
        }
        const blitz = document.getElementById("lmKonfBlitz");
        if (blitz) blitz.hidden = true;
        // Rivalen: wer vor dem Spieltag bis zu drei Plätze vom eigenen Verein entfernt stand
        this._konfRivalen = new Set();
        if (this._konferenz) {
            const eigen = this._konferenz.basis.find(r => r.clubId === state.userClubId);
            if (eigen) this._konferenz.basis.forEach(r => { if (r.clubId !== state.userClubId && Math.abs(r.rang - eigen.rang) <= 3) this._konfRivalen.add(r.clubId); });
        }
        const el = document.getElementById("lmKonferenz");
        if (el) el.innerHTML = "";
    },

    /** Je Spielminute: neue Tore melden, Ergebnisse und Tabelle auffrischen */
    updateKonferenz(liveMatch) {
        const konf = this._konferenz;
        const engine = this.getKonferenzEngine();
        if (!konf || !engine) return;
        const fertig = !!liveMatch.isFinished;
        const minute = liveMatch.minute || 0;
        const key = `${fertig ? "ende" : minute}|${liveMatch.homeScore}:${liveMatch.awayScore}`;
        if (this._konfKey === key) return;
        this._konfKey = key;

        const bis = fertig ? 999 : minute;
        engine.neueTore(konf, this._konfMinute, bis).forEach(t => this.meldeKonferenzTor(t));
        this._konfMinute = Math.max(this._konfMinute, bis);
        this.renderKonferenz(liveMatch, fertig);
    },

    meldeKonferenzTor(t) {
        const p = t.partie;
        const verein = t.clubId === p.homeClubId ? p.heim : p.gast;
        const text = `📻 Tor für ${verein}: ${p.heim} ${t.heim}:${t.gast} ${p.gast}${t.spieler ? ` – ${t.spieler}` : ""}`;
        this._konfFrisch.set(p, this._konfMinute);
        const feed = document.getElementById("lmEventFeed");
        if (feed) {
            const node = document.createElement("div");
            node.className = "ticker-event ticker-konferenz";
            node.innerHTML = this.liveZeileHtml(text, t.minute);
            feed.insertBefore(node, feed.firstChild);
            while (feed.childElementCount > 60) feed.removeChild(feed.lastChild);
        }
        const tab = document.getElementById("lmKonfTab");
        if (tab && !tab.classList.contains("active")) tab.classList.add("lm-konf-neu");
        // Trifft ein Tabellennachbar oder fällt gegen ihn ein Tor, meldet sich die Konferenz auf dem Feld
        if (this._konfRivalen && (this._konfRivalen.has(p.homeClubId) || this._konfRivalen.has(p.awayClubId))) {
            const blitz = document.getElementById("lmKonfBlitz");
            if (blitz) {
                blitz.innerHTML = `<span class="lm-konf-blitz-kopf">Konferenz · ${t.minute}'</span>`
                    + `<span class="lm-konf-blitz-text">${this.escapeHtml(p.heim)} <strong>${t.heim}:${t.gast}</strong> ${this.escapeHtml(p.gast)}</span>`;
                blitz.hidden = false;
                // Der Gong vor der Durchsage - nur bei den Tabellennachbarn, sonst gongte es ständig
                this.playSound("konferenz");
                clearTimeout(this._konfBlitzTimer);
                this._konfBlitzTimer = setTimeout(() => { blitz.hidden = true; }, 4500);
            }
        }
    },

    renderKonferenz(liveMatch, fertig) {
        const el = document.getElementById("lmKonferenz");
        const konf = this._konferenz;
        const engine = this.getKonferenzEngine();
        if (!el || !konf || !engine) return;
        const esc = t => this.escapeHtml(String(t ?? ""));
        const userId = this.app.state && this.app.state.userClubId;
        const minute = fertig ? 999 : (liveMatch.minute || 0);
        const spiele = engine.stand(konf, minute, fertig).map(s => {
            const frisch = !fertig && this._konfFrisch.has(s.partie) && this._konfMinute - this._konfFrisch.get(s.partie) <= 3;
            return `<div class="lm-konf-spiel${frisch ? " frisch" : ""}">
                <span class="lm-konf-heim">${esc(s.partie.heim)}</span>
                <span class="lm-konf-erg">${s.heim}:${s.gast}</span>
                <span class="lm-konf-gast">${esc(s.partie.gast)}</span>
            </div>`;
        }).join("");
        const tabelle = engine.liveTabelle(konf, minute, [liveMatch.homeScore || 0, liveMatch.awayScore || 0], fertig);
        const mitTrend = konf.spieltag > 1;
        const zeilen = tabelle.map(r => {
            const trend = !mitTrend ? `<span class="lm-konf-trend"></span>` : r.rang < r.vorher ? `<span class="lm-konf-trend auf" title="vorher ${r.vorher}.">▲</span>`
                : (r.rang > r.vorher ? `<span class="lm-konf-trend ab" title="vorher ${r.vorher}.">▼</span>` : `<span class="lm-konf-trend"></span>`);
            const diff = r.goalsFor - r.goalsAgainst;
            return `<tr class="${r.clubId === userId ? "eigen" : ""}${this._konfRivalen && this._konfRivalen.has(r.clubId) ? " rivale" : ""}">
                <td class="lm-konf-rang">${r.rang}.</td><td>${trend}</td>
                <td class="lm-konf-name">${esc(r.clubName)}</td>
                <td>${r.played}</td><td>${diff > 0 ? "+" : ""}${diff}</td><td class="lm-konf-pkt">${r.points}</td>
            </tr>`;
        }).join("");
        el.innerHTML = `
            <div class="lm-block-title">Die anderen Plätze <span class="lm-block-sub">${konf.spieltag}. Spieltag${fertig ? " · Endstände" : ""}</span></div>
            <div class="lm-konf-spiele">${spiele}</div>
            <div class="lm-block-title">Tabelle ${fertig ? "nach dem Spieltag" : "im Moment"}</div>
            <table class="lm-konf-tabelle">
                <thead><tr><th>Pl.</th><th></th><th>Verein</th><th>Sp</th><th>Diff</th><th>Pkt</th></tr></thead>
                <tbody>${zeilen}</tbody>
            </table>`;
    },

    // ------------------------------------------------------------ Atmosphäre

    getAtmosphaereEngine() {
        return (typeof AtmosphaereEngine !== "undefined" && AtmosphaereEngine)
            || (typeof window !== "undefined" && window.AtmosphaereEngine) || null;
    },

    /** Vor dem Anpfiff: Stimmung bestimmen, Choreo zeigen */
    bereiteAtmosphaereVor(state, match, liveMatch, ohneBild = false) {
        const engine = this.getAtmosphaereEngine();
        this._atmo = null;
        this._atmoMerk = {};
        this._atmoStand = { heim: 0, gast: 0 };
        if (!engine) return;
        const heim = (state.clubs || []).find(c => c.id === match.homeClubId) || {};
        const gast = (state.clubs || []).find(c => c.id === match.awayClubId) || {};
        const termin = this._laufenderPokaltermin;
        const inLiga = (state.schedule || []).some(r => r.matchday === state.currentMatchday && (r.matches || []).includes(match));
        const wettbewerb = termin ? (/euro/.test(termin.art) ? "euro" : "pokal") : (inLiga ? "liga" : "test");
        const runde = String(match.roundName || termin?.partie?.roundName || "");
        const tabelle = state.standings || [];
        const platz = id => tabelle.findIndex(r => r.clubId === id) + 1 || null;
        const fans = typeof FanEngine !== "undefined" ? FanEngine : null;
        const userHeim = match.homeClubId === state.userClubId;
        const e = fans ? fans.erwartung(userHeim ? heim : gast, userHeim ? gast : heim, userHeim) : 0;
        try {
            this._atmo = engine.vorDemSpiel({
                match, heim, gast, wettbewerb, finale: /^finale$/i.test(runde.trim()) || runde === "Finale", ko: !!termin?.ko,
                fanMood: state.fanMood,
                tabelle: inLiga ? { heimPlatz: platz(heim.id), gastPlatz: platz(gast.id), teams: tabelle.length, spieltag: state.currentMatchday, spieltage: state.totalMatchdays || 34 } : {}
            });
        } catch (err) { console.warn("Stimmung nicht verfügbar:", err); }
        if (!this._atmo) return;
        // Erwartung aus Sicht der Heimmannschaft - für den Schlusspfiff
        this._atmo.erwartungHeim = userHeim ? e : -e;
        const ch = this._atmo.choreo;
        const el = document.getElementById("lmChoreo");
        if (ch && el && !ohneBild) {
            el.style.setProperty("--choreo-a", ch.farben[0]);
            el.style.setProperty("--choreo-b", ch.farben[1]);
            el.innerHTML = `<span class="lm-choreo-kopf">Choreo · ${this.escapeHtml(heim.name || "")}</span><span class="lm-choreo-text">${this.escapeHtml(ch.text)}</span>`;
            el.hidden = false;
            clearTimeout(this._choreoTimer);
            this._choreoTimer = setTimeout(() => { el.hidden = true; }, 6500);
            this.playSound("gesang");
        } else if (el) {
            el.hidden = true;
        }
        if (ch) this.atmoTicker(`🎆 ${ch.text}`, 0);
    },

    atmoTicker(text, minute) {
        const feed = document.getElementById("lmEventFeed");
        if (!feed) return;
        const node = document.createElement("div");
        node.className = "ticker-event ticker-stimmung";
        node.innerHTML = this.liveZeileHtml(text, minute);
        feed.insertBefore(node, feed.firstChild);
        while (feed.childElementCount > 60) feed.removeChild(feed.lastChild);
    },

    /** Je Spielminute: Reaktion der Ränge */
    updateAtmosphaere(liveMatch) {
        const engine = this.getAtmosphaereEngine();
        if (!engine || !this._atmo) return;
        const minute = liveMatch.minute || 0;
        const fertig = !!liveMatch.isFinished;
        const heimTore = liveMatch.homeScore || 0, gastTore = liveMatch.awayScore || 0;
        const key = `${fertig ? "ende" : minute}|${heimTore}:${gastTore}`;
        if (this._atmoKey === key) return;
        this._atmoKey = key;
        const s = this._atmoStand;
        const letztesTor = heimTore > s.heim ? "heim" : (gastTore > s.gast ? "gast" : null);
        s.heim = heimTore; s.gast = gastTore;
        const r = engine.reaktion({ minute, heimTore, gastTore, letztesTor, fertig, intensitaet: this._atmo.intensitaet, erwartung: this._atmo.erwartungHeim }, this._atmoMerk);
        if (!r) return;
        // Tore haben ihren eigenen Ticker-Eintrag - die Ränge kommen eine Zeile später
        this.atmoTicker(`${r.art === "pfiffe" ? "📣" : r.art === "stille" ? "🤫" : r.art === "applaus" ? "👏" : "🎶"} ${r.text}`, minute);
        // Applaus hat in der Stimmung keinen eigenen Klang - jetzt schon
        const klang = r.klang || (r.art === "applaus" ? "applaus" : null);
        if (klang && !liveMatch.ohneBild) this.playSound(klang);
    },

    // ------------------------------------------------------------ Seitenlinie

    /** Ab jetzt ohne Bild: Co-Trainer übernimmt, die Einblendung zeigt den Stand */
    schalteOhneBild(liveMatch) {
        if (!liveMatch || liveMatch.isFinished) return;
        if (this.spielfeld3d) this.spielfeld3d.beendeWiederholung();
        this.stopCrowdAmbience({ ohneMusik: true });
        if (this.coach) {
            this.coach = null;
            const coachModal = document.getElementById("modalCoaching");
            if (coachModal) coachModal.style.display = "none";
        }
        // Schaltet um und rechnet ein erstes, winziges Häppchen
        liveMatch.rechneOhneBild(0);
        const box = document.getElementById("lmOhneBild");
        if (box) box.style.display = "flex";
        this.zeigeOhneBildStand(liveMatch);
    },

    zeigeOhneBildStand(liveMatch) {
        const stand = document.getElementById("lmOhneBildStand");
        if (stand) stand.textContent = `${liveMatch.homeScore}:${liveMatch.awayScore}`;
        const balken = document.getElementById("lmOhneBildBalken");
        if (balken) balken.style.width = `${liveMatch.isFinished ? 100 : Math.min(99, Math.round((liveMatch.minute || 0) / 90 * 100))}%`;
        const text = document.getElementById("lmOhneBildText");
        if (text) {
            text.textContent = liveMatch.isFinished
                ? "Abpfiff - der Spielbericht kommt."
                : `${liveMatch.minute}. Minute · Der Co-Trainer coacht, das Spiel läuft ohne Bild weiter.`;
        }
    },

    /** Einstellungen fuer das Livespiel - sie gelten fuer jede Partie */
    liveEinstellungen() {
        const state = this.app.state;
        if (!state.liveEinstellungen || typeof state.liveEinstellungen !== "object") state.liveEinstellungen = {};
        const e = state.liveEinstellungen;
        e.delegation = { wechsel: false, taktik: false, ...(e.delegation || {}) };
        e.autoOeffnen = { halbzeit: true, verletzung: true, platzverweis: true, ...(e.autoOeffnen || {}) };
        // Wie das Spiel gezeigt wird: nur die Szenen (ruhige Phasen laufen
        // ohne Bild durch) oder alle 90 Minuten - und in welchem Tempo
        if (!["schluessel", "hoehepunkte", "ganz"].includes(e.ansicht)) e.ansicht = "hoehepunkte";
        if (![1, 2, 4].includes(e.tempo)) e.tempo = 2;
        return e;
    },

    /** Der Hinweis über dem Feld, solange eine ruhige Phase durchläuft */
    zeigeSpulen(liveMatch, an) {
        const el = document.getElementById("lmSpulen");
        if (!el) return;
        // Ein Sprung ist oft in einem Bild vorbei - er bleibt kurz stehen,
        // damit man sieht, dass und wie weit gespult wurde
        const s = liveMatch.sprung;
        const jetzt = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        const frisch = !!s && jetzt - s.um < 900;
        if (!an && !frisch) { if (!el.hidden) el.hidden = true; return; }
        el.hidden = false;
        const text = !an && s && s.bis > s.von
            ? `Zeitraffer · ${s.von}' bis ${s.bis}'`
            : `Zeitraffer bis zur nächsten Szene · ${liveMatch.minute}'`;
        if (el.dataset.text !== text) {
            el.dataset.text = text;
            el.innerHTML = `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3.2v9.6l6.3-4.8zM8.2 3.2v9.6l6.3-4.8z" fill="currentColor"/></svg><span>${text}</span>`;
        }
    },

    updateLivePauseButton(liveMatch) {
        const btn = document.getElementById("btnLmPause");
        if (!btn) return;
        // Zeichen als SVG: Das Emoji ⏸ erschien auf manchen Geräten als
        // schmaler Strich, auf anderen als buntes Bildchen.
        btn.innerHTML = liveMatch.isPaused
            ? '<svg class="lm-ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.2v11.6a.8.8 0 0 0 1.2.7l9.4-5.8a.8.8 0 0 0 0-1.4L5.2 1.5A.8.8 0 0 0 4 2.2z"/></svg><span class="lm-btn-text"> Weiter</span>'
            : '<svg class="lm-ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="3.6" height="12" rx="1"/><rect x="9.4" y="2" width="3.6" height="12" rx="1"/></svg><span class="lm-btn-text"> Pause</span>';
        btn.setAttribute("aria-label", liveMatch.isPaused ? "Weiter" : "Pause");
        btn.classList.toggle("is-paused", !!liveMatch.isPaused);
    },

    /** Zurufleiste: welcher Zuruf wirkt, wann der nächste möglich ist */
    updateLiveZurufe(liveMatch) {
        const leiste = document.getElementById("lmZurufe");
        if (!leiste || !liveMatch || !liveMatch.userSide || typeof liveMatch.zurufStand !== "function") return;
        const stand = liveMatch.zurufStand(liveMatch.userSide);
        const key = `${liveMatch.minute}|${stand.art}|${stand.bereit}|${liveMatch.isFinished}`;
        if (this._lmZurufKey === key) return;
        this._lmZurufKey = key;
        leiste.querySelectorAll("[data-zuruf]").forEach(btn => {
            const aktiv = stand.art === btn.dataset.zuruf;
            btn.classList.toggle("aktiv", aktiv);
            btn.disabled = !stand.bereit && !aktiv;
            btn.setAttribute("aria-pressed", aktiv ? "true" : "false");
        });
        const status = document.getElementById("lmZurufStatus");
        if (status) {
            status.textContent = liveMatch.isFinished ? ""
                : (stand.aktiv ? `wirkt noch ${stand.restMinuten}'`
                    : (stand.bereit ? "" : `wieder ab ${stand.wiederAb}'`));
        }
    },

    // ---------------------------------------------------------- Match-Center

    /**
     * Setzt die Anzeigetafel für eine neue Partie auf: Vereinsfarben als
     * Farbchip und Akzent, leere Zeitleiste, leere Listen. Die Tafel war
     * vorher einfarbig blau gegen grün, egal wer spielte.
     */
    bereiteMatchCenterVor(liveMatch) {
        const kits = liveMatch.kits || {};
        const modal = document.getElementById("modalLiveMatch");
        if (modal) {
            modal.style.setProperty("--lm-home", kits.home?.akzent || "#38bdf8");
            modal.style.setProperty("--lm-away", kits.away?.akzent || "#f59e0b");
        }
        [["lmHomeKit", kits.home], ["lmAwayKit", kits.away]].forEach(([id, kit]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.setProperty("--kit", kit?.farbe || "#64748b");
            el.style.setProperty("--kit-2", kit?.zweit || "#ffffff");
        });
        const leeren = (id, html = "") => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
        ["lmHomeScorers", "lmAwayScorers", "lmTlMarks", "lmMomentum", "lmLineups", "lmStatsList"].forEach(id => leeren(id));
        const fill = document.getElementById("lmTlFill");
        if (fill) fill.style.width = "0%";
        const setzeName = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        setzeName("lmStatsHome", liveMatch.homeClub?.name || "Heim");
        setzeName("lmStatsAway", liveMatch.awayClub?.name || "Gast");
        this._lmStatsKey = null;
        this._lmVerlaufKey = null;
        this._lmLineupKey = null;
    },

    /** Ticker- oder Kommentarzeile: Minute als Plakette, Rest als Text */
    liveZeileHtml(text, minute) {
        const roh = String(text ?? "");
        const m = /^\s*(\d{1,3}(?:\+\d{1,2})?)'\s*[-–]\s*/.exec(roh);
        const min = m ? m[1] : (Number.isFinite(minute) ? String(minute) : "");
        const rest = m ? roh.slice(m[0].length) : roh;
        return (min ? `<span class="lm-min">${this.escapeHtml(min)}'</span>` : "")
            + `<span class="lm-zeile">${this.escapeHtml(rest)}</span>`;
    },

    /**
     * Statistik als Duell-Balken: jede Zeile wächst aus der Mitte zur
     * Mannschaft, die mehr davon hat - in deren Farbe.
     */
    renderLiveStats(liveMatch) {
        const st = liveMatch.stats;
        const liste = document.getElementById("lmStatsList");
        if (!liste || !st) return;
        const zeilen = [
            ["Ballbesitz", st.possession[0], st.possession[1], v => `${v}%`],
            ["Torschüsse", st.shots[0], st.shots[1]],
            ["Aufs Tor", st.shotsOnTarget[0], st.shotsOnTarget[1]],
            ["Expected Goals", st.xG[0], st.xG[1], v => Number(v).toFixed(2).replace(".", ",")],
            ["Ecken", st.corners[0], st.corners[1]],
            ["Paraden", st.saves[0], st.saves[1]],
            ["Fouls", st.fouls[0], st.fouls[1]],
            ["Gelbe Karten", st.yellowCards[0], st.yellowCards[1]]
        ];
        if (st.redCards[0] + st.redCards[1] > 0) zeilen.push(["Rote Karten", st.redCards[0], st.redCards[1]]);

        const key = zeilen.map(z => `${z[1]}:${z[2]}`).join("|");
        if (this._lmStatsKey === key) return;
        this._lmStatsKey = key;

        liste.innerHTML = zeilen.map(([label, h, a, fmt]) => {
            const heim = Number(h) || 0, gast = Number(a) || 0;
            const summe = heim + gast;
            const anteilH = summe > 0 ? heim / summe * 100 : 0;
            const anteilA = summe > 0 ? gast / summe * 100 : 0;
            const f = fmt || (v => String(v));
            return `<div class="lm-stat">
                    <div class="lm-stat-top">
                        <span class="lm-stat-val home ${heim > gast ? "lead" : ""}">${this.escapeHtml(f(h))}</span>
                        <span class="lm-stat-label">${label}</span>
                        <span class="lm-stat-val away ${gast > heim ? "lead" : ""}">${this.escapeHtml(f(a))}</span>
                    </div>
                    <div class="lm-stat-bars">
                        <span class="lm-stat-half home"><i style="width:${anteilH.toFixed(1)}%"></i></span>
                        <span class="lm-stat-half away"><i style="width:${anteilA.toFixed(1)}%"></i></span>
                    </div>
                </div>`;
        }).join("");
    },

    /**
     * Alles, was sich aus dem Spielverlauf ergibt: Torschützen unter den
     * Vereinsnamen, Marken auf der Zeitleiste, Druckphasen. Neu gezeichnet
     * wird nur, wenn ein Ereignis dazukommt oder eine Minute vergeht.
     */
    renderLiveVerlauf(liveMatch) {
        const verlauf = liveMatch.verlauf || [];
        const key = `${verlauf.length}|${liveMatch.minute}`;
        if (this._lmVerlaufKey === key) return;
        const neueEreignisse = !this._lmVerlaufKey || this._lmVerlaufKey.split("|")[0] !== String(verlauf.length);
        this._lmVerlaufKey = key;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const nachname = n => String(n || "?").trim().split(/\s+/).slice(-1)[0];
        const minText = m => `${Math.max(1, Math.round(m))}'`;
        const links = m => Math.min(100, Math.max(0, m / 90 * 100)).toFixed(2);

        if (neueEreignisse) {
            // Torschützen: "Müller 12', 67' · Kane 80' (E)"
            ["home", "away"].forEach(seite => {
                const el = document.getElementById(seite === "home" ? "lmHomeScorers" : "lmAwayScorers");
                if (!el) return;
                const schuetzen = new Map();
                verlauf.forEach(e => {
                    if (e.type === "goal" && e.team === seite) {
                        const n = nachname(e.name);
                        if (!schuetzen.has(n)) schuetzen.set(n, []);
                        schuetzen.get(n).push(minText(e.minute) + (e.elfmeter ? " (E)" : ""));
                    }
                });
                const platzverweise = verlauf.filter(e => e.team === seite
                    && (e.type === "red_card" || (e.type === "yellow_card" && e.zweiteGelbe)));
                const teile = [...schuetzen].map(([n, mins]) => `<span class="lm-scorer">⚽ ${esc(n)} ${esc(mins.join(", "))}</span>`);
                platzverweise.forEach(e => teile.push(`<span class="lm-scorer rot"><i class="lm-card ${e.zweiteGelbe ? "gelbrot" : "rot"}"></i>${esc(nachname(e.name))} ${esc(minText(e.minute))}</span>`));
                el.innerHTML = teile.join("");
                el.title = el.textContent;
            });

            // Marken auf der Zeitleiste - Heim oberhalb, Gast unterhalb
            const marks = document.getElementById("lmTlMarks");
            if (marks) {
                const art = {
                    goal: e => ({ cls: "tor", inhalt: "", titel: `Tor ${nachname(e.name)}` }),
                    red_card: e => ({ cls: "karte rot", inhalt: "", titel: `Rot ${nachname(e.name)}` }),
                    yellow_card: e => ({ cls: `karte ${e.zweiteGelbe ? "gelbrot" : "gelb"}`, inhalt: "", titel: `${e.zweiteGelbe ? "Gelb-Rot" : "Gelb"} ${nachname(e.name)}` }),
                    substitution: e => ({ cls: "wechsel", inhalt: "", titel: `Wechsel: ${nachname(e.name)} für ${nachname(e.outName)}` }),
                    injury: e => ({ cls: "verletzt", inhalt: "", titel: `Verletzt: ${nachname(e.name)}` })
                };
                marks.innerHTML = verlauf.filter(e => art[e.type] && e.team).map(e => {
                    const a = art[e.type](e);
                    return `<span class="lm-tl-m ${a.cls} ${e.team}" style="left:${links(e.minute)}%" title="${esc(minText(e.minute) + " " + a.titel)}">${a.inhalt}</span>`;
                }).join("");
            }
        }

        // Druckphasen in Fünf-Minuten-Abschnitten: Heim nach oben, Gast nach
        // unten. Gewichtet nach Gefahr - ein Tor zählt mehr als eine Flanke.
        const mom = document.getElementById("lmMomentum");
        if (mom) {
            const ABSCHNITTE = 18;
            const druck = Array.from({ length: ABSCHNITTE }, () => [0, 0]);
            const gegner = s => s === "home" ? "away" : "home";
            const gewicht = {
                goal: [4, false], shot_miss: [1.5, false], corner: [1, false], cross: [1, false],
                through_ball: [1, false], dribble: [0.8, false],
                save: [2.5, true], foul: [0.5, true], tackle: [0.3, true]
            };
            verlauf.forEach(e => {
                const g = gewicht[e.type];
                if (!g || !e.team) return;
                const seite = g[1] ? gegner(e.team) : e.team;
                const i = Math.min(ABSCHNITTE - 1, Math.max(0, Math.floor(e.minute / 5)));
                druck[i][seite === "home" ? 0 : 1] += g[0];
            });
            const hoechster = Math.max(4, ...druck.map(d => Math.max(d[0], d[1])));
            const jetzt = Math.floor(Math.min(89.9, liveMatch.minute) / 5);
            mom.innerHTML = druck.map((d, i) => {
                const zukunft = i > jetzt && !liveMatch.isFinished;
                const h = (d[0] / hoechster * 100).toFixed(0), a = (d[1] / hoechster * 100).toFixed(0);
                return `<span class="lm-mom-col${zukunft ? " offen" : ""}${i === jetzt && !liveMatch.isFinished ? " jetzt" : ""}" title="${i * 5}.–${i * 5 + 5}. Minute">
                        <span class="lm-mom-up"><i style="height:${h}%"></i></span>
                        <span class="lm-mom-down"><i style="height:${a}%"></i></span>
                    </span>`;
            }).join("");
        }
    },

    /**
     * Beide Aufstellungen, wie sie gerade auf dem Platz stehen: Tore, Karten,
     * Wechsel und Kondition, darunter Ausgewechselte und Bank.
     */
    renderLiveLineups(liveMatch) {
        const el = document.getElementById("lmLineups");
        if (!el) return;
        const verlauf = liveMatch.verlauf || [];
        const key = [verlauf.length, Math.floor(liveMatch.minute / 3),
            liveMatch.ausgewechselt.home.length, liveMatch.ausgewechselt.away.length,
            liveMatch.bank.home.length, liveMatch.bank.away.length].join("|");
        if (this._lmLineupKey === key) return;
        this._lmLineupKey = key;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const finde = id => MatchEngine.findPlayer(liveMatch.allPlayers, id);
        const noten = typeof liveMatch.liveNoten === "function" ? liveMatch.liveNoten() : new Map();

        const spalte = (seite) => {
            const club = liveMatch.clubVon(seite);
            const tore = new Map(), rein = new Map(), raus = new Map();
            verlauf.forEach(e => {
                if (e.team !== seite) return;
                if (e.type === "goal" && e.playerId != null) tore.set(e.playerId, (tore.get(e.playerId) || 0) + 1);
                if (e.type === "substitution") {
                    if (e.playerId != null) rein.set(e.playerId, e.minute);
                    if (e.outId != null) raus.set(e.outId, e.minute);
                }
            });
            const platzverweise = new Set(liveMatch.platzverweise[seite]);
            const zeile = (p, extra = "") => {
                const p2d = liveMatch.players2D.find(x => x.id === p.id);
                const nr = p2d?.number ?? p.number ?? "";
                const pos = p2d?.pos || p.pos || "";
                const icons = [];
                const t = tore.get(p.id) || 0;
                if (t > 0) icons.push(`<span class="lm-lu-ico" title="${t} Tor${t > 1 ? "e" : ""}">⚽${t > 1 ? `<sub>${t}</sub>` : ""}</span>`);
                if (liveMatch.verwarnt[seite].includes(p.id)) icons.push('<i class="lm-card gelb" title="Gelbe Karte"></i>');
                if (platzverweise.has(p.id)) icons.push('<i class="lm-card rot" title="Platzverweis"></i>');
                if (liveMatch.angeschlagen[seite].includes(p.id)) icons.push('<span class="lm-lu-ico" title="angeschlagen">🚑</span>');
                if (rein.has(p.id)) icons.push(`<span class="lm-lu-sub rein" title="eingewechselt">▲ ${Math.max(1, Math.round(rein.get(p.id)))}'</span>`);
                const fit = p2d && !platzverweise.has(p.id) ? Math.round((p2d.freshness ?? 1) * 100) : null;
                const fitFarbe = fit === null ? "" : (fit >= 86 ? "#22c55e" : fit >= 74 ? "#f59e0b" : "#ef4444");
                return `<div class="lm-lu-row${platzverweise.has(p.id) ? " off" : ""}">
                        <span class="lm-lu-nr">${esc(nr)}</span>
                        <span class="lm-lu-pos">${esc(pos)}</span>
                        <span class="lm-lu-name">${esc(p.name)}</span>
                        <span class="lm-lu-icons">${icons.join("")}${extra}</span>
                        ${this.liveNoteHtml(noten.get(p.id))}
                        ${fit !== null ? `<span class="lm-lu-fit" title="Kondition ${fit} %"><i style="width:${Math.max(4, Math.min(100, (fit - 50) * 2))}%;background:${fitFarbe}"></i></span>` : '<span class="lm-lu-fit leer"></span>'}
                    </div>`;
            };
            const feld = liveMatch.lineupVon(seite).filter(Boolean).map(p => zeile(p)).join("");
            const ausgewechselt = liveMatch.ausgewechselt[seite].map(finde).filter(Boolean).map(p =>
                `<div class="lm-lu-row klein"><span class="lm-lu-sub raus">▼ ${raus.has(p.id) ? `${Math.max(1, Math.round(raus.get(p.id)))}'` : ""}</span><span class="lm-lu-name">${esc(p.name)}</span><span class="lm-lu-pos">${esc(p.pos || "")}</span></div>`).join("");
            const bank = liveMatch.bankSpieler(seite).map(p =>
                `<div class="lm-lu-row klein"><span class="lm-lu-pos">${esc(p.pos || "")}</span><span class="lm-lu-name">${esc(p.name)}</span></div>`).join("");
            const eigene = liveMatch.userSide === seite;
            return `<div class="lm-lu-team ${seite}">
                    <div class="lm-lu-head">
                        <span class="lm-kit klein" style="--kit:${esc(liveMatch.kits?.[seite]?.farbe || "#64748b")};--kit-2:${esc(liveMatch.kits?.[seite]?.zweit || "#fff")}"></span>
                        <span class="lm-lu-club">${esc(club?.name || "")}</span>
                        <span class="lm-lu-form">${esc(club?.formation || "")}${eigene ? " · Du" : ""}</span>
                    </div>
                    <div class="lm-lu-list">${feld}</div>
                    ${ausgewechselt ? `<div class="lm-lu-h">Ausgewechselt</div><div class="lm-lu-list">${ausgewechselt}</div>` : ""}
                    <div class="lm-lu-h">Bank</div>
                    <div class="lm-lu-list">${bank || '<div class="lm-lu-leer">Niemand mehr auf der Bank</div>'}</div>
                </div>`;
        };
        el.innerHTML = spalte("home") + spalte("away");
    },

    /**
     * Unter der Steuerung: welche Wechsel angemeldet sind, und am Knopf der
     * Seitenlinie, wie viele wichtige Hinweise der Co-Trainer hat.
     */
    updateLiveSidelineHints(liveMatch) {
        if (!liveMatch || !liveMatch.userSide) return;
        const side = liveMatch.userSide;
        const strip = document.getElementById("lmPendingStrip");
        const offen = (liveMatch.angemeldeteWechsel || []).filter(w => w.side === side);
        const key = offen.map(w => `${w.outId}>${w.inId}`).join(",");
        if (strip && this._lmPendingKey !== key) {
            this._lmPendingKey = key;
            if (offen.length > 0) {
                const name = id => this.escapeHtml(MatchEngine.findPlayer(liveMatch.allPlayers, id)?.name || "?");
                strip.innerHTML = `🔄 ${offen.map(w => `${name(w.inId)} für ${name(w.outId)}`).join(" · ")}
                    <span class="lm-pending-note">- bei der nächsten Unterbrechung</span>`;
                strip.style.display = "";
            } else {
                strip.style.display = "none";
            }
        }

        const jetzt = (typeof performance !== "undefined") ? performance.now() : Date.now();
        if (!this._lmHintTime || jetzt - this._lmHintTime > 1000) {
            this._lmHintTime = jetzt;
            const wichtig = liveMatch.coTrainerHinweise(side).filter(h => h.gewicht >= 2).length;
            const badge = document.getElementById("lmCoachBadge");
            if (badge) {
                badge.textContent = wichtig;
                badge.style.display = wichtig > 0 ? "" : "none";
            }
        }
    },

    /**
     * Das Seitenlinienfenster: Das Spiel steht, solange es offen ist. Alles,
     * was man hier einstellt, wird erst mit "Übernehmen" wirksam - Wechsel
     * laufen dann bei der nächsten Unterbrechung, Taktik und Formation sofort.
     *
     * @param {Object|null} anlass  Warum das Fenster aufgeht (Halbzeit, Verletzung, Platzverweis)
     * @param {boolean} [warPausiert] Pausenzustand vor dem Öffnen, falls schon angehalten wurde
     */
    openCoachingWindow(anlass = null, warPausiert) {
        const liveMatch = this.app.currentLiveMatch;
        if (!liveMatch || !liveMatch.userSide || liveMatch.isFinished) return;
        if (this.coach) {
            if (anlass) {
                this.coach.anlass = anlass;
                if (anlass.art === "verletzung") {
                    this.coach.tab = "wechsel";
                    this.coach.auswahlRaus = anlass.spielerId;
                }
                this.renderCoaching();
            }
            return;
        }

        const side = liveMatch.userSide;
        const club = liveMatch.clubVon(side);
        const t = club.tactics || {};
        const einst = this.liveEinstellungen();

        this.coach = {
            liveMatch,
            side,
            warPausiert: warPausiert !== undefined ? warPausiert : liveMatch.isPaused,
            anlass,
            tab: anlass && anlass.art === "platzverweis" ? "taktik" : "wechsel",
            wechsel: [],
            auswahlRaus: anlass && anlass.art === "verletzung" ? anlass.spielerId : null,
            taktik: this.coachTaktikStart(t),
            formation: club.formation,
            delegation: { ...liveMatch.delegation },
            autoOeffnen: { ...einst.autoOeffnen },
            // Positionstausch: vorgemerkte Paare und der gerade angetippte Spieler
            tausch: [],
            tauschAuswahl: null,
            standards: { ...(liveMatch.standards?.[side] || {}) }
        };

        liveMatch.isPaused = true;
        this.updateLivePauseButton(liveMatch);

        const modal = document.getElementById("modalCoaching");
        if (!modal) return;
        modal.style.display = "flex";
        modal.querySelectorAll(".coaching-tab").forEach(tab => {
            tab.onclick = () => {
                this.coach.tab = tab.dataset.coachtab;
                this.renderCoaching();
            };
        });
        document.getElementById("btnCoachApply").onclick = () => this.closeCoachingWindow(true);
        document.getElementById("btnCoachDiscard").onclick = () => this.closeCoachingWindow(false);
        this.renderCoaching();
    },

    /** Fenster schließen - mit oder ohne die vorgenommenen Änderungen */
    closeCoachingWindow(uebernehmen) {
        const c = this.coach;
        if (!c) return;
        const lm = c.liveMatch;
        const state = this.app.state;

        if (uebernehmen && !lm.isFinished) {
            const einst = this.liveEinstellungen();
            einst.autoOeffnen = { ...c.autoOeffnen };
            einst.delegation = { ...c.delegation };

            const club = lm.clubVon(c.side);
            let neuRechnen = lm.setzeDelegation(c.side, c.delegation, { ohneNeuberechnung: true });

            if (c.formation && c.formation !== club.formation) {
                const r = lm.stelleFormationUm(c.side, c.formation, { ohneNeuberechnung: true });
                if (r.success) neuRechnen = true;
                else this.showToast(r.message, "error");
            }

            (c.tausch || []).forEach(([a, b]) => {
                const r = lm.tauschePositionen(c.side, a, b, { ohneNeuberechnung: true });
                if (r.success) neuRechnen = true;
                else this.showToast(r.message, "error");
            });
            if (c.standards && typeof lm.setzeStandards === "function"
                && lm.setzeStandards(c.side, c.standards, { ohneNeuberechnung: true })) {
                neuRechnen = true;
            }

            const alt = club.tactics || {};
            const T = this.getTacticsEngine();
            const vorgabe = Object.assign(
                { mentality: "balanced", pressing: "medium", tempo: "normal", passing: "mixed", focus: "balanced" },
                T ? T.standardAnweisungen() : {},
                { formMitBall: "auto", formGegenBall: "grund" });
            const diff = {};
            Object.keys(c.taktik).forEach(k => {
                if (c.taktik[k] !== (alt[k] ?? vorgabe[k])) diff[k] = c.taktik[k];
            });
            if (Object.keys(diff).length > 0) {
                lm.updateTactics(c.side, diff, { ohneNeuberechnung: true });
                neuRechnen = true;
            }
            if (neuRechnen) lm.resimulateRemainder();

            let angemeldet = 0;
            c.wechsel.forEach(w => {
                const r = lm.wechselAnmelden(c.side, w.outId, w.inId);
                if (r.success) angemeldet++;
                else this.showToast(r.message, "error");
            });
            if (angemeldet > 0) {
                this.showToast(lm.istHalbzeitpause()
                    ? `${angemeldet} Wechsel - sie kommen zum Wiederanpfiff.`
                    : `${angemeldet} Wechsel angemeldet - bei der nächsten Unterbrechung.`, "success");
            }
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        }

        this.coach = null;
        const modal = document.getElementById("modalCoaching");
        if (modal) modal.style.display = "none";
        // "Übernehmen & weiter" - das Spiel läuft wieder an
        lm.isPaused = false;
        if (typeof this._liveFrameReset === "function") this._liveFrameReset();
        this.updateLivePauseButton(lm);
        this._lmPendingKey = null;
        this._lmHintTime = 0;
    },

    /** Zu einer Kennung aus einem data-Attribut die echte Spielerkennung finden */
    coachIdVon(wert) {
        const c = this.coach;
        if (!c) return wert;
        const lm = c.liveMatch;
        const alle = [...lm.lineupVon(c.side), ...lm.bankSpieler(c.side)];
        const treffer = alle.find(p => p && String(p.id) === String(wert));
        return treffer ? treffer.id : wert;
    },

    renderCoaching() {
        const c = this.coach;
        if (!c) return;
        const lm = c.liveMatch;
        const club = lm.clubVon(c.side);
        const gegner = lm.clubVon(c.side === "home" ? "away" : "home");
        const eigene = c.side === "home" ? lm.homeScore : lm.awayScore;
        const fremde = c.side === "home" ? lm.awayScore : lm.homeScore;

        DOM.setText("coachSub", `${lm.minute}' · ${club.name} ${eigene}:${fremde} ${gegner.name}`);

        const alert = document.getElementById("coachAlert");
        if (alert) {
            if (c.anlass) {
                const icon = { verletzung: "🚑", platzverweis: "🟥", halbzeit: "⏱️" }[c.anlass.art] || "ℹ️";
                alert.textContent = `${icon} ${c.anlass.text}`;
                alert.className = `coaching-alert coaching-alert-${c.anlass.art}`;
                alert.style.display = "";
            } else {
                alert.style.display = "none";
            }
        }

        document.querySelectorAll("#modalCoaching .coaching-tab").forEach(tab => {
            tab.classList.toggle("active", tab.dataset.coachtab === c.tab);
        });
        document.querySelectorAll("#modalCoaching .coaching-pane").forEach(pane => {
            pane.classList.toggle("active", pane.id === `coachPane-${c.tab}`);
        });

        const hinweise = lm.coTrainerHinweise(c.side);
        const wichtig = hinweise.filter(h => h.gewicht >= 2).length;
        const tipCount = document.getElementById("coachTipCount");
        if (tipCount) {
            tipCount.textContent = wichtig > 0 ? wichtig : "";
            tipCount.style.display = wichtig > 0 ? "" : "none";
        }

        if (c.tab === "wechsel") this.renderCoachWechsel();
        else if (c.tab === "taktik") this.renderCoachTaktik();
        else if (c.tab === "gegner") this.renderCoachGegner();
        else this.renderCoachCoTrainer(hinweise);

        // Fußzeile: was mit "Übernehmen" passiert
        const teile = [];
        if (c.wechsel.length) teile.push(`${c.wechsel.length} Wechsel`);
        if (c.formation !== club.formation) teile.push("Formation");
        const t = club.tactics || {};
        const TE = this.getTacticsEngine();
        const vorgabe = Object.assign(
            { mentality: "balanced", pressing: "medium", tempo: "normal", passing: "mixed", focus: "balanced" },
            TE ? TE.standardAnweisungen() : {},
            { formMitBall: "auto", formGegenBall: "grund" });
        if (Object.keys(c.taktik).some(k => c.taktik[k] !== (t[k] ?? vorgabe[k]))) teile.push("Taktik");
        if (c.delegation.wechsel !== lm.delegation.wechsel || c.delegation.taktik !== lm.delegation.taktik) teile.push("Co-Trainer");
        if ((c.tausch || []).length) teile.push("Positionen");
        const stdAlt = lm.standards?.[c.side] || {};
        if (["elfmeter", "freistoss", "ecken"].some(k => (c.standards?.[k] ?? null) !== (stdAlt[k] ?? null))) teile.push("Standards");
        DOM.setText("coachFootInfo", teile.length ? `Geändert: ${teile.join(", ")}` : "Keine Änderungen");
    },

    renderCoachWechsel() {
        const c = this.coach;
        const lm = c.liveMatch;
        const side = c.side;
        const el = document.getElementById("coachPane-wechsel");
        if (!el) return;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const posEngine = (typeof PositionEngine !== "undefined") ? PositionEngine : null;

        const stand = lm.wechselStand(side);
        const halbzeit = lm.istHalbzeitpause();
        const frei = Math.max(0, stand.frei - c.wechsel.length);
        const fensterZu = !halbzeit && stand.fensterFrei <= 0 && lm._fensterMinute[side] !== lm.minute;
        const gesperrt = frei <= 0 || fensterZu;

        const angemeldetRaus = new Map(lm.angemeldeteWechsel.filter(w => w.side === side).map(w => [w.outId, w.inId]));
        const angemeldetRein = new Set(lm.angemeldeteWechsel.filter(w => w.side === side).map(w => w.inId));
        const gestagedRaus = new Map(c.wechsel.map(w => [w.outId, w.inId]));
        const gestagedRein = new Set(c.wechsel.map(w => w.inId));
        const name = id => esc(MatchEngine.findPlayer(lm.allPlayers, id)?.name || "?");

        const platzverweise = new Set(lm.platzverweise[side]);
        const noten = typeof lm.liveNoten === "function" ? lm.liveNoten() : new Map();
        const gewaehlt = c.auswahlRaus;
        const gewaehltP2d = gewaehlt != null ? lm.players2D.find(p => p.id === gewaehlt) : null;
        const zielPos = gewaehltP2d?.pos || lm.lineupVon(side).find(p => p && p.id === gewaehlt)?.pos || null;

        const kopf = `<div class="coach-info">
                <span><strong>${stand.genutzt + stand.angemeldet + c.wechsel.length}</strong> von ${lm.maxSubstitutions} Wechseln</span>
                <span>${halbzeit ? "Halbzeit - zählt nicht als Unterbrechung" : `${stand.fensterFrei} von ${lm.maxWechselFenster} Unterbrechungen frei`}</span>
            </div>
            <div class="coach-hint">${gesperrt
                ? (frei <= 0 ? "Alle Wechsel sind vergeben." : "Alle drei Unterbrechungen sind genutzt.")
                : (gewaehlt != null ? "Jetzt auf der Bank antippen, wer reinkommt." : "Tippe auf den Spieler, der raus soll.")}</div>`;

        const zeilenFeld = lm.lineupVon(side).map((p, idx) => {
            if (!p) return "";
            const p2d = lm.players2D.find(x => x.id === p.id);
            const vomPlatz = platzverweise.has(p.id);
            const slotPos = p2d?.pos || p.pos;
            const fit = p2d ? Math.round((p2d.freshness ?? 1) * 100) : null;
            const fitFarbe = fit === null ? "#64748b" : (fit >= 86 ? "#22c55e" : fit >= 74 ? "#f59e0b" : "#ef4444");
            const gelb = lm.verwarnt[side].includes(p.id);
            const verletzt = lm.angeschlagen[side].includes(p.id);
            let rechts = "";
            if (vomPlatz) rechts = '<span class="coach-tag coach-tag-rot">🟥 vom Platz</span>';
            else if (gestagedRaus.has(p.id)) rechts = `<span class="coach-tag">↔ ${name(gestagedRaus.get(p.id))}</span>
                    <button class="coach-x" data-unstage="${esc(p.id)}" aria-label="Wechsel zurücknehmen">✕</button>`;
            else if (angemeldetRaus.has(p.id)) rechts = `<span class="coach-tag">⏳ ${name(angemeldetRaus.get(p.id))}</span>
                    <button class="coach-x" data-abmelden="${esc(p.id)}" aria-label="Anmeldung zurückziehen">✕</button>`;
            const waehlbar = !vomPlatz && !gestagedRaus.has(p.id) && !angemeldetRaus.has(p.id) && !gesperrt;
            return `<div class="coach-row ${gewaehlt === p.id ? "selected" : ""} ${vomPlatz ? "off" : ""} ${waehlbar ? "tappable" : ""}"
                        ${waehlbar ? `data-raus="${esc(p.id)}" role="button" tabindex="0"` : ""}>
                    <span class="coach-pos">${esc(slotPos)}</span>
                    <span class="coach-name">${esc(p.name)}${gelb ? ' <span title="verwarnt">🟨</span>' : ""}${verletzt ? ' <span title="angeschlagen">🚑</span>' : ""}</span>
                    ${this.liveNoteHtml(noten.get(p.id))}
                    ${fit !== null && !vomPlatz ? `<span class="coach-fit" title="Kondition ${fit} %"><span class="coach-fit-bar" style="width:${Math.max(0, Math.min(100, (fit - 55) / 45 * 100))}%; background:${fitFarbe};"></span></span>
                        <span class="coach-fit-num">${fit}%</span>` : ""}
                    ${rechts}
                </div>`;
        }).join("");

        const bank = lm.bankSpieler(side).filter(p => !angemeldetRein.has(p.id) && !gestagedRein.has(p.id));
        const zeilenBank = bank.map(p => {
            const sterne = this.starValueFor(p.overall || 60).toFixed(1).replace(".", ",");
            let eignung = "";
            if (zielPos && posEngine) {
                const s = posEngine.getSuitability(p, zielPos);
                eignung = `<span class="coach-eignung" style="color:${s.color};">${esc(s.shortLabel || s.label)} als ${esc(zielPos)}</span>`;
            }
            const waehlbar = gewaehlt != null && !gesperrt;
            return `<div class="coach-row bank ${waehlbar ? "tappable" : "dim"}" ${waehlbar ? `data-rein="${esc(p.id)}" role="button" tabindex="0"` : ""}>
                    <span class="coach-pos">${esc(p.pos)}</span>
                    <span class="coach-name">${esc(p.name)} <span class="coach-stars">★ ${sterne}</span></span>
                    ${eignung}
                </div>`;
        }).join("");

        const raus = lm.ausgewechselt[side];
        el.innerHTML = kopf
            + `<h4 class="coach-h">Auf dem Platz</h4><div class="coach-list">${zeilenFeld}</div>`
            + `<h4 class="coach-h">Bank</h4><div class="coach-list">${zeilenBank || '<div class="coach-empty">Niemand mehr auf der Bank.</div>'}</div>`
            + (raus.length ? `<div class="coach-muted">Ausgewechselt: ${raus.map(name).join(", ")}</div>` : "");

        const aktiv = (node, fn) => {
            node.onclick = fn;
            node.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
        };
        el.querySelectorAll("[data-raus]").forEach(n => aktiv(n, () => {
            const id = this.coachIdVon(n.dataset.raus);
            c.auswahlRaus = c.auswahlRaus === id ? null : id;
            this.renderCoaching();
        }));
        el.querySelectorAll("[data-rein]").forEach(n => aktiv(n, () => {
            if (c.auswahlRaus == null) return;
            const inId = this.coachIdVon(n.dataset.rein);
            const test = lm.pruefeWechsel(side, c.auswahlRaus, inId, { mitAngemeldeten: true });
            const zuViele = stand.genutzt + stand.angemeldet + c.wechsel.length >= lm.maxSubstitutions;
            if (!test.ok || zuViele) {
                this.showToast(test.ok ? `Alle ${lm.maxSubstitutions} Wechsel sind vergeben.` : test.grund, "error");
                return;
            }
            c.wechsel.push({ outId: c.auswahlRaus, inId });
            c.auswahlRaus = null;
            this.renderCoaching();
        }));
        el.querySelectorAll("[data-unstage]").forEach(n => n.onclick = (e) => {
            e.stopPropagation();
            const id = this.coachIdVon(n.dataset.unstage);
            c.wechsel = c.wechsel.filter(w => w.outId !== id);
            this.renderCoaching();
        });
        el.querySelectorAll("[data-abmelden]").forEach(n => n.onclick = (e) => {
            e.stopPropagation();
            lm.wechselAbmelden(side, this.coachIdVon(n.dataset.abmelden));
            this.renderCoaching();
        });
    },

    /** Die Taktik fuer das Coaching-Fenster: alle Anweisungen und beide Formen */
    coachTaktikStart(t = {}) {
        const T = this.getTacticsEngine();
        const basis = {
            mentality: t.mentality || "balanced",
            pressing: t.pressing || "medium",
            tempo: t.tempo || "normal",
            passing: t.passing || "mixed",
            focus: t.focus || t.attackFocus || "balanced"
        };
        if (!T) return basis;
        const taktik = {};
        T.ANWEISUNGEN.forEach(a => { taktik[a.key] = T.wert(t, a.key); });
        taktik.formMitBall = t.formMitBall || "auto";
        taktik.formGegenBall = t.formGegenBall || "grund";
        return Object.assign(taktik, basis);
    },

    renderCoachTaktik() {
        const c = this.coach;
        const lm = c.liveMatch;
        const el = document.getElementById("coachPane-taktik");
        if (!el) return;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const configs = (typeof FORMATION_CONFIGS !== "undefined") ? FORMATION_CONFIGS : {};
        const T = this.getTacticsEngine();

        // Im Spiel die Regler, die sofort sichtbar wirken - nach Phasen
        const LIVE_KEYS = ["mentality", "pressing", "anlaufen", "defensiveLine", "linienVerhalten", "deckung", "nachBallverlust",
            "nachBallgewinn", "tempo", "passing", "breite", "focus", "zweikampf", "zeitspiel"];
        const gruppen = T
            ? LIVE_KEYS.map(k => T.ANWEISUNGEN.find(a => a.key === k)).filter(Boolean)
                .map(a => [a.key, a.label, a.optionen.map(o => [o.value, o.label])])
            : [
                ["mentality", "Mentalität", [["very_defensive", "Sehr defensiv"], ["defensive", "Defensiv"], ["balanced", "Ausgeglichen"], ["offensive", "Offensiv"], ["very_offensive", "Sehr offensiv"]]],
                ["pressing", "Pressing", [["low", "Niedrig"], ["medium", "Mittel"], ["high", "Hoch"]]],
                ["tempo", "Tempo", [["slow", "Geduldig"], ["normal", "Normal"], ["fast", "Schnell"]]],
                ["passing", "Passspiel", [["short", "Kurz"], ["mixed", "Gemischt"], ["direct", "Direkt"]]],
                ["focus", "Angriffsseite", [["left", "Links"], ["center", "Zentrum"], ["right", "Rechts"], ["balanced", "Überall"]]]
            ];

        const schnell = [
            ["alles", "⚡ Alles nach vorn", { mentality: "very_offensive", pressing: "high", tempo: "fast", passing: "direct", anlaufen: "oefter", nachBallverlust: "gegenpressing" }],
            ["pressen", "🔥 Gegenpressing", { pressing: "high", anlaufen: "oefter", nachBallverlust: "gegenpressing", defensiveLine: "high" }],
            ["halten", "🔒 Ergebnis halten", { mentality: "defensive", pressing: "low", tempo: "slow", passing: "short", nachBallverlust: "zurueckziehen", nachBallgewinn: "ballsichern" }],
            ["mauern", "🧱 Mauern (5-4-1)", { mentality: "very_defensive", pressing: "low", defensiveLine: "deep", kompaktheit: "eng", nachBallverlust: "zurueckziehen", formGegenBall: configs["5-4-1"] ? "5-4-1" : "grund" }],
            ["normal", "⚖️ Ausgewogen", { mentality: "balanced", pressing: "medium", tempo: "normal", passing: "mixed", anlaufen: "normal", nachBallverlust: "normal", nachBallgewinn: "normal", deckung: "raum" }]
        ];

        const optionen = Object.keys(configs).map(k =>
            `<option value="${esc(k)}" ${k === c.formation ? "selected" : ""}>${esc(configs[k].name || k)}</option>`).join("");
        const formMit = T ? T.formenMitBall(configs).map(f =>
            `<option value="${esc(f.key)}" ${f.key === c.taktik.formMitBall ? "selected" : ""}>${esc(f.name)}</option>`).join("") : "";
        const formGegen = T ? T.formenGegenBall(configs).map(f =>
            `<option value="${esc(f.key)}" ${f.key === c.taktik.formGegenBall ? "selected" : ""}>${esc(f.name)}</option>`).join("") : "";

        el.innerHTML = `
            <div class="coach-hint">Gilt nur für dieses Spiel - deine gespeicherte Taktik bleibt unverändert.${c.delegation.taktik ? " Der Co-Trainer darf zusätzlich nachsteuern." : ""}</div>
            <div class="coach-quick">${schnell.map(([k, t]) => `<button class="coach-chip coach-quick-btn" data-schnell="${k}">${t}</button>`).join("")}</div>
            <label class="coach-label" for="coachFormation">Formation</label>
            <select id="coachFormation" class="styled-select">${optionen}</select>
            ${lm.platzverweise[c.side].length ? '<div class="coach-muted">In Unterzahl: Die Formation verteilt die verbliebenen Spieler neu.</div>' : ""}
            ${T ? `
            <label class="coach-label" for="coachFormMit">Mit Ball</label>
            <select id="coachFormMit" class="styled-select">${formMit}</select>
            <label class="coach-label" for="coachFormGegen">Gegen den Ball</label>
            <select id="coachFormGegen" class="styled-select">${formGegen}</select>` : ""}
            ${gruppen.map(([feld, titel, werte]) => `
                <div class="coach-label">${esc(titel)}</div>
                <div class="coach-chips">${werte.map(([w, t]) =>
                    `<button class="coach-chip ${c.taktik[feld] === w ? "active" : ""}" data-feld="${feld}" data-wert="${w}">${esc(t)}</button>`).join("")}</div>`).join("")}
        `;

        el.insertAdjacentHTML("beforeend", this.coachPositionenHtml() + this.coachStandardsHtml());
        this.bindeCoachPositionen(el);

        el.querySelector("#coachFormation").onchange = (e) => {
            c.formation = e.target.value;
            this.renderCoaching();
        };
        const mitSel = el.querySelector("#coachFormMit");
        if (mitSel) mitSel.onchange = (e) => { c.taktik.formMitBall = e.target.value; this.renderCoaching(); };
        const gegenSel = el.querySelector("#coachFormGegen");
        if (gegenSel) gegenSel.onchange = (e) => { c.taktik.formGegenBall = e.target.value; this.renderCoaching(); };
        el.querySelectorAll("[data-feld]").forEach(b => b.onclick = () => {
            c.taktik[b.dataset.feld] = b.dataset.wert;
            this.renderCoaching();
        });
        el.querySelectorAll("[data-schnell]").forEach(b => b.onclick = () => {
            const eintrag = schnell.find(x => x[0] === b.dataset.schnell);
            if (eintrag) Object.assign(c.taktik, eintrag[2]);
            this.renderCoaching();
        });
    },

    renderCoachCoTrainer(hinweise) {
        const c = this.coach;
        const el = document.getElementById("coachPane-cotrainer");
        if (!el) return;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const icons = { kondition: "🔋", verletzung: "🚑", gelb: "🟨", unterzahl: "🟥", ueberzahl: "➕", rueckstand: "⏱️", fuehrung: "🔒", druck: "🧱", zugriff: "🎯", regel: "📋", note: "📉", gegner: "🔍" };

        const liste = hinweise.length
            ? hinweise.map(h => `<div class="coach-tip ${h.gewicht >= 2 ? "wichtig" : ""}">
                    <span class="coach-tip-icon">${icons[h.art] || "💬"}</span>
                    <span class="coach-tip-text">${esc(h.text)}</span>
                    ${h.spielerId != null && ["kondition", "verletzung", "gelb", "note"].includes(h.art)
                        ? `<button class="btn btn-sm btn-secondary" data-tip-raus="${esc(h.spielerId)}">Auswechseln</button>` : ""}
                </div>`).join("")
            : '<div class="coach-empty">Keine Auffälligkeiten - die Mannschaft liegt im Plan.</div>';

        const schalter = (key, titel, text, gruppe) => {
            const an = gruppe === "delegation" ? c.delegation[key] : c.autoOeffnen[key];
            return `<label class="coach-switch">
                    <input type="checkbox" data-gruppe="${gruppe}" data-key="${key}" ${an ? "checked" : ""}>
                    <span class="coach-switch-text"><strong>${titel}</strong><br><span class="coach-muted">${text}</span></span>
                </label>`;
        };

        el.innerHTML = `
            ${this.coachCoTrainerKarte()}
            <h4 class="coach-h">Einschätzung</h4>
            <div class="coach-tips">${liste}</div>
            <h4 class="coach-h">Dem Co-Trainer überlassen</h4>
            ${schalter("wechsel", "Wechsel", "Er wechselt Müde und Verletzte positionsgerecht aus - du wirst nicht mehr gefragt.", "delegation")}
            ${schalter("taktik", "Taktik anpassen", "Bei Rückstand stellt er offensiver, bei später Führung sicherer.", "delegation")}
            <h4 class="coach-h">Seitenlinie automatisch öffnen</h4>
            ${schalter("halbzeit", "Zur Halbzeit", "Nach der Kabinenansprache.", "auto")}
            ${schalter("verletzung", "Bei einer Verletzung", "Wenn einer deiner Spieler nicht weiterkann.", "auto")}
            ${schalter("platzverweis", "Bei einem Platzverweis", "Um die Mannschaft neu zu ordnen.", "auto")}
        `;

        el.querySelectorAll("input[data-gruppe]").forEach(inp => inp.onchange = () => {
            const ziel = inp.dataset.gruppe === "delegation" ? c.delegation : c.autoOeffnen;
            ziel[inp.dataset.key] = inp.checked;
            this.renderCoaching();
        });
        el.querySelectorAll("[data-tip-raus]").forEach(b => b.onclick = () => {
            c.auswahlRaus = this.coachIdVon(b.dataset.tipRaus);
            c.tab = "wechsel";
            this.renderCoaching();
        });
    },

    /** Live-Note als kleine Plakette - vor zehn Minuten Einsatz noch ohne Aussage */
    liveNoteHtml(n) {
        if (!n || n.minuten < 10) return '<span class="coach-note leer" title="Noch zu wenig gespielt">–</span>';
        // 6,3 ist ein gewöhnliches Spiel - erst darunter wird es gelb
        const farbe = n.note >= 7.3 ? "gut" : (n.note >= 6.2 ? "ok" : (n.note >= 5.6 ? "mau" : "schwach"));
        return `<span class="coach-note ${farbe}" title="Live-Note nach ${n.minuten} Minuten">${n.note.toFixed(1).replace(".", ",")}</span>`;
    },

    /**
     * Positionstausch: zwei Spieler antippen, sie tauschen die Plätze. Die
     * Farbe zeigt, wie gut jemand auf die neue Position passt.
     */
    coachPositionenHtml() {
        const c = this.coach;
        const lm = c.liveMatch;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const posEngine = (typeof PositionEngine !== "undefined") ? PositionEngine : null;
        const raus = new Set(lm.platzverweise[c.side]);
        const plaetze = lm.lineupVon(c.side).filter(p => p && !raus.has(p.id)).map(p => ({
            p, pos: lm.players2D.find(x => x.id === p.id)?.pos || p.pos, getauscht: false
        }));
        (c.tausch || []).forEach(([a, b]) => {
            const ia = plaetze.findIndex(x => x.p.id === a);
            const ib = plaetze.findIndex(x => x.p.id === b);
            if (ia < 0 || ib < 0) return;
            [plaetze[ia].pos, plaetze[ib].pos] = [plaetze[ib].pos, plaetze[ia].pos];
            plaetze[ia].getauscht = plaetze[ib].getauscht = true;
        });
        const zeilen = plaetze.map(({ p, pos, getauscht }) => {
            const eignung = posEngine ? posEngine.getSuitability(p, pos) : null;
            const gewaehlt = c.tauschAuswahl !== null && c.tauschAuswahl !== undefined && c.tauschAuswahl === p.id;
            return `<div class="coach-row tappable ${gewaehlt ? "selected" : ""}" data-tausch="${esc(p.id)}" role="button" tabindex="0">
                    <span class="coach-pos">${esc(pos)}</span>
                    <span class="coach-name">${esc(p.name)}${getauscht ? ' <span class="coach-tag">↔ neu</span>' : ""}</span>
                    ${eignung ? `<span class="coach-eignung" style="color:${eignung.color};">${esc(eignung.shortLabel || eignung.label)}</span>` : ""}
                </div>`;
        }).join("");
        return `<h4 class="coach-h">Positionen tauschen</h4>
            <div class="coach-hint">${c.tauschAuswahl !== null && c.tauschAuswahl !== undefined
                ? "Jetzt den Spieler antippen, mit dem er tauschen soll."
                : "Zwei Spieler antippen - sie tauschen die Positionen, ohne dass die Formation wechselt."}</div>
            <div class="coach-list">${zeilen}</div>
            ${(c.tausch || []).length ? '<button class="btn btn-sm btn-secondary coach-reset" data-tausch-reset>Tausch zurücknehmen</button>' : ""}`;
    },

    /** Standardschützen: vorgeben oder dem Besten überlassen */
    coachStandardsHtml() {
        const c = this.coach;
        const lm = c.liveMatch;
        if (typeof lm.standardSchuetzen !== "function") return "";
        const esc = v => this.escapeHtml(String(v ?? ""));
        const imSpiel = lm.aufDemPlatz(c.side).filter(p => p.pos !== "TW");
        const arten = [["elfmeter", "🎯 Elfmeter"], ["freistoss", "🧱 Freistöße"], ["ecken", "🚩 Ecken"]];
        const zeilen = arten.map(([art, titel]) => {
            const bester = MatchEngine.standardSchuetze(art, imSpiel, null);
            const liste = imSpiel.slice().sort((a, b) => MatchEngine.standardWert(art, b) - MatchEngine.standardWert(art, a));
            const wahl = c.standards?.[art] ?? null;
            const optionen = [`<option value="">Automatisch${bester ? ` (${esc(bester.name)})` : ""}</option>`]
                .concat(liste.map(p => `<option value="${esc(p.id)}" ${wahl !== null && p.id === wahl ? "selected" : ""}>${esc(p.name)} · ${Math.round(MatchEngine.standardWert(art, p))}</option>`))
                .join("");
            return `<label class="coach-std-row"><span class="coach-std-titel">${titel}</span>
                    <select class="styled-select" data-standard="${art}">${optionen}</select></label>`;
        }).join("");
        return `<h4 class="coach-h">Standardschützen</h4>
            <div class="coach-hint">Die Zahl ist die Schussqualität für diesen Standard. Direkte Freistöße gibt es aus Schussweite.</div>
            <div class="coach-std">${zeilen}</div>`;
    },

    bindeCoachPositionen(el) {
        const c = this.coach;
        const lm = c.liveMatch;
        const aktiv = (node, fn) => {
            node.onclick = fn;
            node.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
        };
        el.querySelectorAll("[data-tausch]").forEach(n => aktiv(n, () => {
            const id = this.coachIdVon(n.dataset.tausch);
            if (c.tauschAuswahl === null || c.tauschAuswahl === undefined) {
                c.tauschAuswahl = id;
            } else if (c.tauschAuswahl === id) {
                c.tauschAuswahl = null;
            } else {
                const posVon = (pid) => {
                    let pos = lm.players2D.find(x => x.id === pid)?.pos;
                    (c.tausch || []).forEach(([a, b]) => {
                        if (pid === a) pos = lm.players2D.find(x => x.id === b)?.pos;
                        else if (pid === b) pos = lm.players2D.find(x => x.id === a)?.pos;
                    });
                    return pos;
                };
                if ((posVon(c.tauschAuswahl) === "TW") !== (posVon(id) === "TW")) {
                    this.showToast("Der Torwart bleibt im Tor.", "error");
                } else {
                    c.tausch.push([c.tauschAuswahl, id]);
                }
                c.tauschAuswahl = null;
            }
            this.renderCoaching();
        }));
        const reset = el.querySelector("[data-tausch-reset]");
        if (reset) reset.onclick = () => { c.tausch = []; c.tauschAuswahl = null; this.renderCoaching(); };
        el.querySelectorAll("[data-standard]").forEach(sel => sel.onchange = () => {
            if (!c.standards) c.standards = {};
            c.standards[sel.dataset.standard] = sel.value === "" ? null : this.coachIdVon(sel.value);
            this.renderCoaching();
        });
    },

    /** Wer an der Seitenlinie steht und was er kann */
    coachCoTrainerKarte() {
        const c = this.coach;
        const co = c.liveMatch.coTrainer?.[c.side];
        if (!co) return "";
        const esc = v => this.escapeHtml(String(v ?? ""));
        const g = co.guete;
        const ruf = g >= 88 ? "Weltklasse" : g >= 78 ? "Hervorragend" : g >= 68 ? "Stark" : g >= 58 ? "Solide" : g >= 46 ? "Durchwachsen" : "Schwach";
        const kann = g >= 75
            ? "Sieht Müdigkeit früh, liest den Gegner genau und greift bei Wechseln kaum daneben."
            : (g >= 50 ? "Meldet Müdigkeit und schwache Leistungen, liest den Gegner in groben Zügen."
                : "Meldet nur das Offensichtliche und greift bei delegierten Wechseln auch mal daneben.");
        return `<div class="coach-co-card">
                <div class="coach-co-kopf"><strong>${co.name ? esc(co.name) : "Assistent aus dem Trainerstab"}</strong>
                    <span class="coach-co-ruf">${ruf} · ${g}</span></div>
                <span class="coach-co-bar"><i style="width:${Math.max(4, Math.min(100, g))}%"></i></span>
                <div class="coach-muted">${kann}${co.eigen ? "" : " Einen eigenen Co-Trainer verpflichtest du in der Vorbereitung."}</div>
            </div>`;
    },

    /**
     * Gegneranalyse live: über welche Seite er kommt, womit, und wer bei ihm
     * gefährlich ist. Wie viel davon zu sehen ist, hängt am Co-Trainer.
     */
    renderCoachGegner() {
        const c = this.coach;
        const lm = c.liveMatch;
        const el = document.getElementById("coachPane-gegner");
        if (!el || typeof lm.gegnerAnalyse !== "function") return;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const a = lm.gegnerAnalyse(c.side);
        const g = lm.coTrainer?.[c.side]?.guete ?? 60;
        const gegner = lm.clubVon(c.side === "home" ? "away" : "home");

        if (!a.genugGesehen) {
            el.innerHTML = `<div class="coach-empty">Noch zu wenig gesehen - nach ein paar Angriffen von ${esc(gegner.name)} gibt es hier eine Einschätzung.</div>`;
            return;
        }

        const bei = { links: "bei uns rechts", mitte: "Zentrum", rechts: "bei uns links" };
        const seineSeite = { links: "seine linke", rechts: "seine rechte", mitte: "Mitte" };
        const seiten = g >= 45
            ? `<div class="coach-seiten">${["links", "mitte", "rechts"].map(k => `
                    <div class="coach-seite ${a.hauptSeite === k ? "haupt" : ""}">
                        <span class="coach-seite-wert">${a.anteile[k]} %</span>
                        <span class="coach-seite-bar"><i style="height:${Math.max(4, a.anteile[k])}%"></i></span>
                        <span class="coach-seite-name">${seineSeite[k]}</span>
                        <span class="coach-muted">${bei[k]}</span>
                    </div>`).join("")}</div>`
            : `<div class="coach-hint">${a.hauptSeite
                ? `Dein Co-Trainer hat den Eindruck, ${esc(gegner.name)} komme eher über ${a.hauptSeite === "mitte" ? "die Mitte" : `${seineSeite[a.hauptSeite]} Seite`}.`
                : "Dein Co-Trainer kann kein Muster erkennen."} Genauer liest das Spiel nur ein besserer Co-Trainer.</div>`;

        const arten = g >= 50 && a.arten.length
            ? `<h4 class="coach-h">Womit er angreift</h4><div class="coach-chips">${a.arten.map(x =>
                `<span class="coach-chip statisch">${esc(x.titel)} <strong>${x.anzahl}</strong></span>`).join("")}</div>`
            : "";
        const gefahr = g >= 65 && a.gefaehrlich.length
            ? `<h4 class="coach-h">Gefährlichste Spieler</h4><div class="coach-list">${a.gefaehrlich.map(p => `
                    <div class="coach-row">
                        <span class="coach-name">${esc(p.name)}</span>
                        <span class="coach-muted">${p.tore ? `${p.tore} Tor${p.tore > 1 ? "e" : ""} · ` : ""}${p.schuesse} ${p.schuesse === 1 ? "Schuss" : "Schüsse"} · ${p.chancen} vorbereitet</span>
                    </div>`).join("")}</div>`
            : "";
        const rat = g >= 55 && a.empfehlungen.length
            ? `<h4 class="coach-h">Empfehlung</h4><div class="coach-tips">${a.empfehlungen.map(t =>
                `<div class="coach-tip"><span class="coach-tip-icon">💡</span><span class="coach-tip-text">${esc(t)}</span></div>`).join("")}</div>
                <button class="btn btn-sm btn-secondary" data-zur-taktik><svg class="ico" aria-hidden="true"><use href="#i-tactics"/></svg> Zur Taktik</button>`
            : "";
        const fehlt = g < 65 ? '<div class="coach-muted" style="margin-top:10px;">Ein besserer Co-Trainer erkennt hier mehr - etwa die gefährlichsten Spieler.</div>' : "";

        el.innerHTML = `
            <h4 class="coach-h">Über welche Seite ${esc(gegner.name)} kommt</h4>
            ${seiten}
            ${arten}
            ${gefahr}
            ${rat}
            ${fehlt}
            <div class="coach-muted" style="margin-top:10px;">Grundlage: ${a.angriffe} Angriffe und ${a.schuesse} Abschlüsse des Gegners.</div>`;
        const zurTaktik = el.querySelector("[data-zur-taktik]");
        if (zurTaktik) zurTaktik.onclick = () => { c.tab = "taktik"; this.renderCoaching(); };
    }
});
