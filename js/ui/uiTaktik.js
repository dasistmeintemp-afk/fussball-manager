/**
 * Taktik: Formation, Rollen, Taktiktafel und Aufstellung.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    getPosGroup(pos) {
        if (pos === "TW") return "tw";
        if (["IV", "LV", "RV"].includes(pos)) return "def";
        if (["DM", "ZM", "OM", "LM", "RM"].includes(pos)) return "mid";
        return "att";
    },

    /**
     * Auflösung der PositionEngine (Browser & Node)
     */
    getPositionEngine() {
        if (typeof PositionEngine !== "undefined" && PositionEngine) return PositionEngine;
        if (typeof window !== "undefined" && window.PositionEngine) return window.PositionEngine;
        return null;
    },

    /**
     * Alle verfügbaren Formationen (Standard + eigene) als Liste
     */
    getFormationOptions() {
        const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS)
            ? FORMATION_CONFIGS
            : ((typeof window !== "undefined" && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS : {});

        return Object.entries(configs).map(([key, cfg]) => ({
            key,
            name: cfg.name || key,
            custom: !!cfg.custom
        }));
    },

    /**
     * Positionen der aktuell angezeigten Formation.
     * Im Bearbeitungsmodus wird der Entwurf verwendet, sonst die gespeicherte Formation.
     */
    getActiveFormationPositions(userClub) {
        if (this.formationEditMode && Array.isArray(this.formationDraft)) {
            return this.formationDraft;
        }
        const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS)
            ? FORMATION_CONFIGS
            : ((typeof window !== "undefined" && window.FORMATION_CONFIGS) ? window.FORMATION_CONFIGS : {});
        const cfg = configs[userClub.formation] || configs["4-4-2"] || { positions: [] };
        return cfg.positions || [];
    },

    /**
     * Über der Aufstellung, nur bei Personalnot oder einem Engpass in einem
     * Mannschaftsteil: die Kandidaten aus U23 und U19 mit dem Knopf
     * "Spieltag" (ReserveEngine.nominieren, YouthEngine.hochziehen) - dort,
     * wo die Lücke auffällt, statt erst im Kader-Reiter.
     */
    renderTaktikUnterbau(club) {
        const box = document.getElementById("taktikUnterbau");
        if (!box) return;
        const state = this.app.state;
        const mgr = typeof ManagerEngine !== "undefined" ? ManagerEngine : null;
        const squad = (state.players || []).filter(p => (club.playerIds || []).includes(p.id));
        const punkte = mgr && typeof mgr.unterbauPunkte === "function"
            ? mgr.unterbauPunkte(state, club, squad).filter(i => i.personalnot) : [];
        if (!punkte.length) { box.hidden = true; box.innerHTML = ""; return; }
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const zahl = (x) => String(x.toFixed(1)).replace(".", ",");
        const knopf = (s) => s.talent
            ? `<button class="btn btn-sm btn-primary btn-hochziehen-spieltag" data-talent-id="${esc(s.id)}" title="Mit Jugendvertrag für den nächsten Ligaspieltag - danach spielt er in der U19">Spieltag</button>`
            : `<button class="btn btn-sm btn-primary btn-nominieren" data-id="${esc(s.id)}" title="Nach dem nächsten Ligaspiel geht er zurück in die ${esc(s.team)}">Spieltag</button>`;
        box.hidden = false;
        box.innerHTML = punkte.map(i => `
            <div class="tu-punkt">
                <div class="tu-titel">${esc(i.icon)} ${esc(i.title)}</div>
                ${i.spieler.length ? `<div class="tu-liste">${i.spieler.map(s => `
                    <span class="tu-spieler"><button type="button" class="btn-link tu-name" data-id="${esc(s.id)}">${esc(s.name)}</button>
                        <span class="text-muted">${esc(s.pos)} · ${esc(s.team)}${s.form ? ` · Form ${zahl(s.form)}` : ""}</span>${knopf(s)}</span>`).join("")}</div>`
                    : `<div class="text-muted">${esc(i.detail)}</div>`}
            </div>`).join("")
            + `<small class="text-muted">Spieltag holt nur für das nächste Ligaspiel hoch. Danach gehen sie von selbst zurück.</small>`;
        box.querySelectorAll(".tu-name").forEach(b => b.addEventListener("click", () => this.showPlayerDetailsModal(b.dataset.id, { abschnitt: "unterbau" })));
        if (typeof this.bindeUnterbauKnoepfe === "function") this.bindeUnterbauKnoepfe(box);
    },

    /**
     * Aufstellung & Taktik rendern
     */
    renderTactics() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;
        // Bevor etwas umgestellt wird: Was jetzt eingestellt ist, sitzt
        const taktikModul = this.getTacticsEngine();
        if (taktikModul && typeof taktikModul.vertrautheitStarten === "function") taktikModul.vertrautheitStarten(userClub);

        const posEngine = this.getPositionEngine();

        // Formations-Dropdown mit Standard- und eigenen Formationen befüllen
        const selectFormation = document.getElementById("selectFormation");
        if (selectFormation) {
            const options = this.getFormationOptions();
            const builtins = options.filter(o => !o.custom);
            const customs = options.filter(o => o.custom);

            const optionHtml = (o) => `<option value="${o.key}">${o.name}</option>`;
            let html = builtins.map(optionHtml).join("");
            if (customs.length > 0) {
                html += `<optgroup label="Eigene Formationen">${customs.map(optionHtml).join("")}</optgroup>`;
            }
            selectFormation.innerHTML = html;
            selectFormation.value = userClub.formation || "4-4-2";
            if (!selectFormation.value) {
                userClub.formation = "4-4-2";
                selectFormation.value = "4-4-2";
            }
        }

        const slots = this.getActiveFormationPositions(userClub);
        this.renderTaktikUnterbau(userClub);

        // Taktik nach Phasen: Spielstil, Formen mit und gegen den Ball,
        // Rollen, Anweisungen, Check
        const T = this.getTacticsEngine();
        if (T) T.normalisiere(userClub.tactics || (userClub.tactics = {}));
        this.renderTaktikPanels(userClub, slots);

        // Die Ansicht ueber dem Feld: Aufstellung, mit oder gegen den Ball
        const ansicht = (!this.formationEditMode && T) ? (this.taktikAnsicht || "grund") : "grund";
        document.querySelectorAll("#tacAnsicht [data-ansicht]").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.ansicht === ansicht);
            btn.disabled = !!this.formationEditMode;
            btn.onclick = () => { this.taktikAnsicht = btn.dataset.ansicht; this.renderTactics(); };
        });
        // Am Handy ein Bereich auf einmal (die Reiter sind am großen Bildschirm aus)
        const pane = document.getElementById("pane-tactics");
        if (pane) {
            if (!this.taktikBereich) this.taktikBereich = "aufstellung";
            pane.dataset.bereich = this.taktikBereich;
            document.querySelectorAll("#tacBereiche [data-bereich]").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.bereich === this.taktikBereich);
                btn.setAttribute("aria-selected", btn.dataset.bereich === this.taktikBereich ? "true" : "false");
                btn.onclick = () => {
                    this.taktikBereich = btn.dataset.bereich;
                    pane.dataset.bereich = this.taktikBereich;
                    document.querySelectorAll("#tacBereiche [data-bereich]").forEach(b => {
                        b.classList.toggle("active", b === btn);
                        b.setAttribute("aria-selected", b === btn ? "true" : "false");
                    });
                };
            });
        }
        const configs = (typeof FORMATION_CONFIGS !== "undefined") ? FORMATION_CONFIGS : {};
        // "Beide": die Spieler stehen in der Form mit Ball, ihr Platz gegen
        // den Ball ist als Schatten daneben - mit dem Weg dazwischen
        const formAnsicht = ansicht === "beide" ? "mit" : ansicht;
        const vorschau = (T && formAnsicht !== "grund") ? T.vorschau(userClub, slots, formAnsicht, configs) : null;
        const schatten = (T && ansicht === "beide") ? T.vorschau(userClub, slots, "gegen", configs) : null;
        const rollenElf = T ? T.rollenDerElf(userClub, slots) : [];
        const anzeige = Object.assign({ rollen: true, sterne: true, namen: true, verbindungen: true, eignung: true, zustand: true }, this.taktikAnzeige || {});
        // Rückennummern für den eigenen Kader (fest, bis einer den Verein wechselt)
        if (typeof GameState !== "undefined" && typeof GameState.rueckennummern === "function") GameState.rueckennummern(state, userClub);
        this.taktikAnzeige = anzeige;
        const pitchEl = document.getElementById("tacticsPitch");
        if (pitchEl) {
            pitchEl.classList.toggle("ansicht-mit", ansicht === "mit" || ansicht === "beide");
            pitchEl.classList.toggle("ansicht-gegen", ansicht === "gegen");
            pitchEl.classList.toggle("ohne-rollen", !anzeige.rollen || !T);
            pitchEl.classList.toggle("ohne-sterne", !anzeige.sterne);
            pitchEl.classList.toggle("ohne-namen", !anzeige.namen);
            pitchEl.classList.toggle("ohne-eignung", !anzeige.eignung);
            pitchEl.classList.toggle("ohne-zustand", !anzeige.zustand);
        }
        document.querySelectorAll("#tacAuge [data-anzeige]").forEach(cb => {
            cb.checked = !!anzeige[cb.dataset.anzeige];
            cb.onchange = () => { anzeige[cb.dataset.anzeige] = cb.checked; this.renderTactics(); };
        });
        // Wo ein Knoten auf dem Feld steht (die Vorschau leicht gestaucht,
        // damit die Namensschilder nicht am Feldrand abgeschnitten werden)
        const anzeigeOrt = (liste, i) => liste ? { x: 50 + (liste[i].x - 50) * 0.84, y: liste[i].y } : { x: slots[i].x, y: slots[i].y };
        let orte = slots.map((_, i) => anzeigeOrt(vorschau, i));

        // 2D Pitch Slots rendern
        const pitchLayer = document.getElementById("pitchPlayersLayer");
        pitchLayer.innerHTML = "";

        const misfits = [];

        slots.forEach((slot, index) => {
            const playerId = userClub.lineup[index];
            const player = state.players.find(p => p.id === playerId);

            const node = document.createElement("div");
            node.className = `pitch-node spk-knoten ${this.selectedPitchSlot === index ? "selected" : ""}`;
            const ort = orte[index];
            node.style.left = `${ort.x}%`;
            node.style.top = `${ort.y}%`;
            node.dataset.slotIndex = index;

            // Eignung des Spielers auf genau dieser Position
            let fit = null;
            if (player && posEngine) {
                fit = posEngine.getSuitability(player, slot.pos);
                if (fit.familiarity < 0.7) {
                    misfits.push({ player, slot, fit });
                }
            }
            node.innerHTML = this.spielerKarteHtml(userClub, slot, player, fit, rollenElf[index], ansicht);

            if (this.formationEditMode) {
                node.addEventListener("pointerdown", (e) => this.startSlotDrag(e, index));
            } else {
                node.addEventListener("click", () => this.handlePitchSlotClick(index));
            }

            pitchLayer.appendChild(node);
        });

        // Liegen Knoten übereinander - in der Vorschau mit und gegen den
        // Ball rücken die Spieler eng zusammen -, werden sie auseinander-
        // geschoben. Nur fürs Auge: Die Formation selbst bleibt, wie sie ist.
        // Im Editor nicht, dort muss der Knoten genau unter dem Finger stehen.
        if (!this.formationEditMode && pitchEl) orte = this.entzerreKnoten(pitchEl, pitchLayer, orte);

        // Die Linien: wer zusammenspielt, wie gut die Rollen passen - oder in
        // "Beide" der Weg jedes Spielers zwischen den Formen
        const linksSvg = document.getElementById("tacLinks");
        if (linksSvg) {
            let svg = "";
            if (T && ansicht === "beide" && schatten) {
                slots.forEach((_, i) => {
                    const a = anzeigeOrt(schatten, i), b = orte[i];
                    svg += `<line class="weg" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
                    svg += `<ellipse class="geist" cx="${a.x}" cy="${a.y}" rx="2.1" ry="1.4"/>`;
                });
            } else if (T && anzeige.verbindungen && !this.formationEditMode) {
                // Farbe: wie gut die Rollen passen; Dicke: wie eingespielt die
                // beiden sind. Ist ein Spieler gewählt, treten seine hervor.
                const phase = ansicht === "gegen" ? "gegen" : "mit";
                const gewaehlt = this.selectedPitchSlot;
                this.zusammenspielDerElf(userClub, slots).verbindungen.filter(v => v.phase === phase).forEach(v => {
                    const a = orte[v.a], b = orte[v.b];
                    const aus = gewaehlt !== null && gewaehlt !== undefined && v.a !== gewaehlt && v.b !== gewaehlt;
                    const breite = (1.4 + 3.2 * v.eingespielt).toFixed(1);
                    svg += `<line class="link-${v.guete}${aus ? " gedimmt" : ""}" style="stroke-width:${breite}px" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"><title>${this.escapeHtml(v.text)}</title></line>`;
                });
            }
            linksSvg.innerHTML = svg;
        }

        document.getElementById("tacticsPitch")?.classList.toggle("editing", this.formationEditMode);
        this.renderFormationEditorBar(userClub, slots);
        this.renderZusammenspiel(userClub, slots);

        // Ersatzbank und übriger Kader
        this.renderBank(userClub, slots, posEngine);

        this.renderLineupWarnings(misfits);

        // Rollen Dropdowns befüllen
        const lineupPlayers = userClub.lineup.map(id => state.players.find(p => p.id === id)).filter(Boolean);
        // "Automatisch" heißt: der Beste auf dem Platz. Vorher stand hier
        // immer der erste Spieler der Liste, auch wenn niemand bestimmt war.
        const populateRoleSelect = (elId, currentId, autoText = "Automatisch (der Beste auf dem Platz)") => {
            const el = document.getElementById(elId);
            const bestimmt = lineupPlayers.some(p => String(p.id) === String(currentId));
            el.innerHTML = `<option value="" ${bestimmt ? "" : "selected"}>${autoText}</option>` +
                lineupPlayers.map(p => `
                <option value="${this.escapeHtml(String(p.id))}" ${String(p.id) === String(currentId) ? "selected" : ""}>${this.escapeHtml(p.name)} (${p.pos}, ${this.starValueFor(p.overall).toFixed(1).replace(".", ",")} Sterne)</option>
            `).join("");
        };

        populateRoleSelect("roleCaptain", userClub.roles.captain, "Nicht bestimmt");
        populateRoleSelect("rolePenalty", userClub.roles.penaltyTaker);
        populateRoleSelect("roleFreeKick", userClub.roles.freeKickTaker);
        populateRoleSelect("roleCorner", userClub.roles.cornerTaker);
    },

    getTacticsEngine() {
        if (typeof TacticsEngine !== "undefined" && TacticsEngine) return TacticsEngine;
        if (typeof window !== "undefined" && window.TacticsEngine) return window.TacticsEngine;
        return null;
    },

    /** Taktik geaendert: speichern und neu zeichnen */
    taktikGeaendert(userClub, opts = {}) {
        if (opts.angepasst !== false && userClub.tactics) userClub.tactics.vorlageAngepasst = true;
        if (typeof this.app.state.saveToLocalStorage === "function") this.app.state.saveToLocalStorage();
        this.renderTactics();
    },

    /**
     * Die Taktik-Karten: Spielstil, Formen, Rollen, Anweisungen, Check.
     * Alles wird aus dem Taktikmodul gezeichnet - kommt dort eine Anweisung
     * oder Rolle dazu, erscheint sie hier von selbst.
     */
    renderTaktikPanels(userClub, slots) {
        const T = this.getTacticsEngine();
        if (!T) return;
        const t = userClub.tactics;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const configs = (typeof FORMATION_CONFIGS !== "undefined") ? FORMATION_CONFIGS : {};

        // Spielstil
        const vorlageSel = document.getElementById("tacVorlage");
        if (vorlageSel) {
            const aktuell = t.vorlage && T.VORLAGEN[t.vorlage] ? t.vorlage : "";
            vorlageSel.innerHTML = `<option value="">Eigene Taktik</option>` + Object.entries(T.VORLAGEN)
                .map(([k, v]) => `<option value="${esc(k)}" ${k === aktuell && !t.vorlageAngepasst ? "selected" : ""}>${esc(v.name)}${k === aktuell && t.vorlageAngepasst ? " (angepasst)" : ""}</option>`).join("");
            if (aktuell && t.vorlageAngepasst) vorlageSel.value = "";
            vorlageSel.onchange = (e) => {
                if (!e.target.value) return;
                T.wendeVorlageAn(t, e.target.value);
                t.vorlageAngepasst = false;
                this.taktikGeaendert(userClub, { angepasst: false });
                this.showToast(`Spielstil „${T.VORLAGEN[e.target.value].name}“ übernommen.`, "success");
            };
            const text = document.getElementById("tacVorlageText");
            if (text) text.textContent = aktuell ? T.VORLAGEN[aktuell].beschreibung : "Alle Einstellungen von Hand.";
        }

        // Formen mit und gegen den Ball
        const mitSel = document.getElementById("tacFormMit");
        if (mitSel) {
            const liste = T.formenMitBall(configs);
            const eigen = liste.filter(f => f.key === "auto" || f.key === "grund");
            const nurMit = liste.filter(f => f.nurMitBall);
            const rest = liste.filter(f => !f.nurMitBall && f.key !== "auto" && f.key !== "grund");
            const opt = f => `<option value="${esc(f.key)}" ${f.key === t.formMitBall ? "selected" : ""}>${esc(f.name)}</option>`;
            mitSel.innerHTML = eigen.map(opt).join("")
                + `<optgroup label="Formen mit Ball">${nurMit.map(opt).join("")}</optgroup>`
                + `<optgroup label="Formationen">${rest.map(opt).join("")}</optgroup>`;
            mitSel.onchange = (e) => { t.formMitBall = e.target.value; this.taktikAnsicht = "mit"; this.taktikGeaendert(userClub); };
        }
        const gegenSel = document.getElementById("tacFormGegen");
        if (gegenSel) {
            gegenSel.innerHTML = T.formenGegenBall(configs)
                .map(f => `<option value="${esc(f.key)}" ${f.key === t.formGegenBall ? "selected" : ""}>${esc(f.name)}</option>`).join("");
            gegenSel.onchange = (e) => { t.formGegenBall = e.target.value; this.taktikAnsicht = "gegen"; this.taktikGeaendert(userClub); };
        }

        // Aufstellung wie im Vorbild: eine Zeile je Spieler, die Rolle der
        // gewaehlten Phase mit Kuerzel, dazu Staerke und Kondition
        const rollenEl = document.getElementById("tacRollen");
        if (rollenEl) {
            const state = this.app.state;
            const rollen = T.rollenDerElf(userClub, slots);
            if (this.rollenPhase !== "gegen") this.rollenPhase = "mit";
            // Die Tafel und die Tabelle zeigen dieselbe Phase
            if (this.taktikAnsicht === "gegen") this.rollenPhase = "gegen";
            else if (this.taktikAnsicht === "mit") this.rollenPhase = "mit";
            const phase = this.rollenPhase;
            document.querySelectorAll("#tacRollenPhase [data-phase]").forEach(b => {
                b.classList.toggle("active", b.dataset.phase === phase);
                b.onclick = () => {
                    this.rollenPhase = b.dataset.phase;
                    if (this.taktikAnsicht === "mit" || this.taktikAnsicht === "gegen") this.taktikAnsicht = b.dataset.phase;
                    this.renderTactics();
                };
            });
            const ratingEngine = this.getRatingEngine ? this.getRatingEngine() : null;
            const ivAnzahl = slots.filter(q => this.getPositionEngine()?.normalizePosition(q.pos) === "IV").length;
            rollenEl.innerHTML = `
                <div class="aufst-kopfzeile" aria-hidden="true">
                    <span>Pos.</span><span>Spieler</span><span>Rolle ${phase === "gegen" ? "gegen den Ball" : "mit Ball"}</span><span>Kond.</span>
                </div>` + slots.map((slot, i) => {
                const r = rollen[i];
                const spieler = state.players.find(p => p.id === userClub.lineup[i]);
                const liste = phase === "gegen"
                    ? T.rollenGegenBall(r.familie)
                    : T.rollenMitBall(r.familie).filter(x => !x.nurDreier || ivAnzahl >= 3);
                const aktuelleId = phase === "gegen" ? r.gegen : r.mit;
                const rolle = phase === "gegen" ? T.rolleGegenBall(r.familie, r.gegen) : T.rolleMitBall(r.familie, r.mit);
                const kz = T.kuerzel(rolle, phase);
                const aktiv = this.selectedPitchSlot === i;
                const card = spieler && ratingEngine ? ratingEngine.calculateVisiblePlayerCard(spieler, Object.assign({ userClubId: userClub.id, leagueDataCoverage: 95 }, this.starContext())) : null;
                const fit = Math.round(spieler?.fitness ?? 100);
                const fitKlasse = fit >= 85 ? "gut" : (fit >= 70 ? "mittel" : "schwach");
                const nachname = spieler ? spieler.name.split(" ").slice(-1)[0] : "Leer";
                const vorname = spieler ? spieler.name.split(" ").slice(0, -1).join(" ") : "";
                return `
                    <div class="rollen-zeile ${aktiv ? "aktiv" : ""}" data-rollen-slot="${i}">
                        <span class="pos-tag pos-${this.getPosGroup(slot.pos)}">${esc(slot.pos)}</span>
                        <span class="aufst-spieler">
                            <span class="aufst-name">${vorname ? `<small>${esc(vorname.charAt(0))}.</small> ` : ""}${esc(nachname)}</span>
                            <span class="aufst-sterne">${card ? card.abilityStarsHtml : ""}</span>
                        </span>
                        <span class="aufst-rolle">
                            <span class="rolle-badge kat-${esc(kz.kategorie)}${phase === "gegen" ? " gegen" : ""}">${esc(kz.text)}</span>
                            <select class="styled-select" data-rolle-${phase}="${i}" aria-label="Rolle von ${esc(nachname)}" title="${esc(rolle.beschreibung)}">
                                ${liste.map(x => `<option value="${esc(x.id)}" ${x.id === aktuelleId ? "selected" : ""}>${esc(x.name)}</option>`).join("")}
                            </select>
                        </span>
                        <span class="aufst-kond ${fitKlasse}" title="Kondition ${fit} %"><i style="width:${Math.max(4, Math.min(100, fit))}%"></i><b>${fit}</b></span>
                        ${aktiv ? `<div class="rollen-text"><strong>${esc(rolle.name)}:</strong> ${esc(rolle.beschreibung)}</div>` : ""}
                    </div>`;
            }).join("");
            const setze = (i, feld, wert) => {
                const aktuell = T.rollenDerElf(userClub, slots)[i];
                t.rollen[i] = { mit: aktuell.mit, gegen: aktuell.gegen, [feld]: wert };
                this.selectedPitchSlot = i;
                this.taktikGeaendert(userClub);
            };
            rollenEl.querySelectorAll("[data-rolle-mit]").forEach(sel => {
                sel.onchange = (e) => setze(Number(sel.dataset.rolleMit), "mit", e.target.value);
                sel.onclick = (e) => e.stopPropagation();
            });
            rollenEl.querySelectorAll("[data-rolle-gegen]").forEach(sel => {
                sel.onchange = (e) => setze(Number(sel.dataset.rolleGegen), "gegen", e.target.value);
                sel.onclick = (e) => e.stopPropagation();
            });
            // Eigene Rollen verwerfen: Ohne eigene Wahl gilt der abgestimmte Standard
            const abstimmen = document.getElementById("btnRollenAbstimmen");
            if (abstimmen) {
                abstimmen.disabled = !Object.keys(t.rollen || {}).length;
                abstimmen.onclick = () => {
                    t.rollen = {};
                    this.taktikGeaendert(userClub);
                    this.showToast("Der Co-Trainer hat die Rollen aufeinander abgestimmt.", "success");
                };
            }
            rollenEl.querySelectorAll("[data-rollen-slot]").forEach(z => {
                z.onclick = () => {
                    const i = Number(z.dataset.rollenSlot);
                    this.selectedPitchSlot = this.selectedPitchSlot === i ? null : i;
                    this.renderTactics();
                };
            });
        }

        // Wie eingespielt die Mannschaft auf diese Taktik ist
        const vertrautEl = document.getElementById("tacVertrautheit");
        if (vertrautEl && T && typeof T.vertrautheitDetails === "function") {
            const d = T.vertrautheitDetails(userClub);
            const prozent = Math.round(d.gesamt * 100);
            const farbe = prozent >= 85 ? "#4ade80" : (prozent >= 65 ? "#facc15" : "#f87171");
            const kosten = Math.round((1 - T.vertrautheitsFaktor(userClub)) * 1000) / 10;
            vertrautEl.innerHTML = `
                <div class="vertrautheit-kopf">
                    <span>Taktische Vertrautheit</span>
                    <strong style="color:${farbe};">${prozent} %</strong>
                </div>
                <div class="vertrautheit-balken"><span style="width:${prozent}%; background:${farbe};"></span></div>
                <div class="vertrautheit-text">
                    ${d.formation < 0.85 ? `Die Formation <strong>${esc(userClub.formation || "")}</strong> ist noch neu (${Math.round(d.formation * 100)} %). ` : ""}
                    ${d.neu.length ? `Noch nicht eingespielt: ${d.neu.map(n => `${esc(n.label)} „${esc(n.wert)}“ (${Math.round(n.vertraut * 100)} %)`).join(", ")}. ` : ""}
                    ${kosten > 0.2 ? `Das kostet im Spiel etwa ${String(kosten).replace(".", ",")} % Stärke - Spiele und Taktiktraining schleifen es ein.` : "Die Mannschaft kennt ihre Abläufe."}
                </div>`;
        }

        // Mannschaftsanweisungen als Kacheln, getrennt nach Mit Ball und
        // Gegen den Ball - wie im Vorbild
        const anwEl = document.getElementById("tacAnweisungen");
        if (anwEl) {
            if (this.anwPhase !== "gegenBall") this.anwPhase = "mitBall";
            document.querySelectorAll("#tacAnwPhase [data-phase]").forEach(b => {
                b.classList.toggle("active", b.dataset.phase === this.anwPhase);
                b.setAttribute("aria-selected", b.dataset.phase === this.anwPhase ? "true" : "false");
                b.onclick = () => { this.anwPhase = b.dataset.phase; this.renderTactics(); };
            });
            const liste = T.ANWEISUNGEN.filter(a => a.phase === this.anwPhase);
            anwEl.innerHTML = liste.map(a => {
                const wert = T.wert(t, a.key);
                const index = Math.max(0, a.optionen.findIndex(o => o.value === wert));
                const option = a.optionen[index];
                const geaendert = wert !== a.standard;
                // Die Skala zeigt, wo der Wert zwischen den Optionen liegt
                const skala = a.optionen.length <= 5
                    ? `<span class="anw-skala" aria-hidden="true">${a.optionen.map((o, i) => `<i class="${i === index ? "an" : ""}"></i>`).join("")}</span>`
                    : "";
                return `
                    <label class="anw-kachel${geaendert ? " geaendert" : ""}" ${a.hilfe ? `title="${esc(a.hilfe)}"` : ""}>
                        <span class="anw-kopf">
                            <svg class="ico" aria-hidden="true"><use href="#${esc(a.icon || "i-sliders")}"/></svg>
                            <span class="anw-titel">${esc(a.label)}</span>
                        </span>
                        <span class="anw-wert">${esc(option ? option.label : wert)}</span>
                        ${skala}
                        <select data-anweisung="${a.key}" aria-label="${esc(a.label)}">
                            ${a.optionen.map(o => `<option value="${esc(o.value)}" ${o.value === wert ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
                        </select>
                    </label>`;
            }).join("");
            anwEl.querySelectorAll("[data-anweisung]").forEach(sel => {
                sel.onchange = (e) => {
                    t[sel.dataset.anweisung] = e.target.value;
                    if (sel.dataset.anweisung === "focus") t.attackFocus = e.target.value;
                    this.taktikGeaendert(userClub);
                };
            });
        }

        // Verbindungen mit Erklaerung - auf dem Handy gibt es kein Hovern
        const verbEl = document.getElementById("tacVerbindungen");
        if (verbEl) {
            const phase = this.taktikAnsicht === "gegen" ? "gegen" : "mit";
            const state = this.app.state;
            const nameVon = i => {
                const sp = state.players.find(p => p.id === userClub.lineup[i]);
                return sp ? sp.name.split(" ").pop() : slots[i].pos;
            };
            // Was hakt, zuerst: schwache Rollen, dann wenig Eingespielte
            const liste = this.zusammenspielDerElf(userClub, slots).verbindungen.filter(v => v.phase === phase).sort((a, b) => a.wert - b.wert);
            verbEl.innerHTML = `<li class="gut"><strong>${phase === "gegen" ? "Gegen den Ball" : "Mit Ball"}</strong></li>` + liste
                .map(v => `<li class="${v.guete}"><strong>${esc(nameVon(v.a))} – ${esc(nameVon(v.b))}:</strong> ${esc(v.text)}${v.eingespielt < 0.85 ? ` <span class="zs-eingespielt">Eingespielt erst ${Math.round(v.eingespielt * 100)} %.</span>` : ""}</li>`).join("");
        }

        // Taktik-Check
        const checkEl = document.getElementById("tacCheck");
        if (checkEl) {
            checkEl.innerHTML = T.pruefe(userClub, slots)
                .map(h => `<li class="${h.art === "warn" ? "warn" : ""}">${esc(h.text)}</li>`).join("");
        }
    },

    escapeHtml(text) {
        return String(text ?? "").replace(/[&<>"']/g, ch => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        }[ch]));
    },

    /** Die Signatur-Eigenschaft eines Topspielers (Name, Symbol, Text) oder null */
    signaturVon(player) {
        const eig = (typeof EigenschaftenEngine !== "undefined") ? EigenschaftenEngine
            : (typeof window !== "undefined" ? window.EigenschaftenEngine : null);
        return eig && player ? eig.signaturVon(player) : null;
    },

    /** Kleines Symbol hinter dem Namen in Listen - mit Namen als Tooltip */
    signaturMarke(player) {
        const s = this.signaturVon(player);
        return s ? ` <span class="signatur-mini" title="${this.escapeHtml(s.name + ": " + s.text)}">${s.icon}</span>` : "";
    },

    /**
     * Hinweisbox mit Spielern, die deutlich außerhalb ihrer Position spielen
     */
    renderLineupWarnings(misfits) {
        const benchSection = document.querySelector(".bench-section");
        if (!benchSection) return;

        let box = document.getElementById("lineupWarnings");
        if (!box) {
            box = document.createElement("div");
            box.id = "lineupWarnings";
            box.className = "lineup-warning";
            benchSection.parentElement.appendChild(box);
        }

        if (!misfits || misfits.length === 0) {
            box.style.display = "none";
            return;
        }

        const items = misfits
            .sort((a, b) => a.fit.familiarity - b.fit.familiarity)
            .slice(0, 5)
            .map(m => `<li><strong>${this.escapeHtml(m.player.name)}</strong> (${m.player.pos}) auf ${m.slot.pos}: ${m.fit.label} · ${m.player.overall} → <strong>${m.fit.effectiveOverall}</strong></li>`)
            .join("");

        box.style.display = "block";
        box.innerHTML = `
            <strong>⚠️ Spieler außerhalb ihrer Position</strong>
            <ul style="margin:6px 0 0 16px; padding:0;">${items}</ul>
        `;
    },

    // ------------------------------------------------------- Formations-Editor

    /**
     * Zustand der Editorleiste aktualisieren
     */
    /** Das Zusammenspiel der aufgestellten Elf (TacticsEngine.zusammenspiel) */
    zusammenspielDerElf(userClub, slots) {
        const T = this.getTacticsEngine();
        const state = this.app.state;
        if (!T || typeof T.zusammenspiel !== "function" || !userClub) return { verbindungen: [], schnitt: 0 };
        T.stelleUhr(state);
        const spieler = slots.map((_, i) => {
            const id = (userClub.lineup || [])[i];
            return id === undefined ? null : (typeof GameState !== "undefined" && GameState.spielerMitId
                ? GameState.spielerMitId(state.players, id) : state.players.find(p => p.id === id));
        });
        const z = T.zusammenspiel(userClub, slots, spieler);
        z.spieler = spieler;
        z.faktor = T.zusammenspielFaktor(userClub, slots, spieler);
        return z;
    },

    /**
     * Schiebt Knoten auseinander, deren Trikot, Rollen oder Namen sich
     * überdecken. Gemessen wird, was wirklich gezeichnet ist (mit allen
     * Schildern); verschoben wird entlang der Achse, auf der die
     * Überdeckung kleiner ist, beide je zur Hälfte, bis nichts mehr
     * überlappt oder vierzig Runden vorbei sind. Rückgabe: die neuen Orte
     * in Prozent, damit die Linien zu den Knoten passen.
     */
    entzerreKnoten(pitchEl, layer, orte) {
        const breite = pitchEl.clientWidth, hoehe = pitchEl.clientHeight;
        const knoten = [...layer.querySelectorAll(".pitch-node")];
        if (!breite || !hoehe || knoten.length !== orte.length) return orte;
        // Ausdehnung je Knoten um seinen Mittelpunkt, in Pixeln
        const boxen = knoten.map((n, i) => {
            const mx = orte[i].x / 100 * breite, my = orte[i].y / 100 * hoehe;
            const basis = pitchEl.getBoundingClientRect();
            let l = Infinity, r = -Infinity, o = Infinity, u = -Infinity;
            [n, ...n.querySelectorAll("*")].forEach(el => {
                const b = el.getBoundingClientRect();
                if (!b.width || !b.height) return;
                l = Math.min(l, b.left - basis.left); r = Math.max(r, b.right - basis.left);
                o = Math.min(o, b.top - basis.top); u = Math.max(u, b.bottom - basis.top);
            });
            if (!isFinite(l)) return null;
            return { x: mx, y: my, l: l - mx, r: r - mx, o: o - my, u: u - my };
        });
        if (boxen.some(b => !b)) return orte;
        const abstand = 2;
        for (let runde = 0; runde < 40; runde++) {
            let bewegt = false;
            for (let i = 0; i < boxen.length; i++) {
                for (let j = i + 1; j < boxen.length; j++) {
                    const a = boxen[i], b = boxen[j];
                    const px = Math.min(a.x + a.r, b.x + b.r) - Math.max(a.x + a.l, b.x + b.l) + abstand;
                    const py = Math.min(a.y + a.u, b.y + b.u) - Math.max(a.y + a.o, b.y + b.o) + abstand;
                    if (px <= 0 || py <= 0) continue;
                    bewegt = true;
                    if (px < py) {
                        const s = (a.x < b.x || (a.x === b.x && i < j)) ? -1 : 1;
                        a.x += s * px / 2; b.x -= s * px / 2;
                    } else {
                        const s = (a.y < b.y || (a.y === b.y && i < j)) ? -1 : 1;
                        a.y += s * py / 2; b.y -= s * py / 2;
                    }
                }
            }
            // Auf dem Feld bleiben
            boxen.forEach(b => {
                b.x = Math.max(-b.l, Math.min(breite - b.r, b.x));
                b.y = Math.max(-b.o, Math.min(hoehe - b.u, b.y));
            });
            if (!bewegt) break;
        }
        return boxen.map((b, i) => {
            const ort = { x: Math.round(b.x / breite * 1000) / 10, y: Math.round(b.y / hoehe * 1000) / 10 };
            knoten[i].style.left = `${ort.x}%`;
            knoten[i].style.top = `${ort.y}%`;
            return ort;
        });
    },

    /** Wie lange zwei Spieler schon zusammen sind - in Worten */
    gemeinsamSeit(a, b) {
        const T = this.getTacticsEngine();
        if (!T || !a || !b) return "";
        const tage = Math.min(T.tageImVerein(a), T.tageImVerein(b));
        const spiele = typeof T.gemeinsameSpiele === "function" ? T.gemeinsameSpiele(a, b) : null;
        const sp = spiele === null ? "" : (spiele === 0 ? ", noch kein Spiel zusammen" : `, ${spiele} ${spiele === 1 ? "Spiel" : "Spiele"} zusammen`);
        if (tage >= 2 * T.ZUSAMMENSPIEL.tageJeSaison) return spiele !== null && spiele < 10 ? `lange im Verein${sp}` : "lange zusammen";
        if (tage < 14) return `erst seit Tagen zusammen${sp}`;
        const monate = Math.round(tage / 30);
        return (monate < 12 ? `seit ${monate} ${monate === 1 ? "Monat" : "Monaten"} zusammen` : "seit über einem Jahr zusammen") + sp;
    },

    /**
     * Unter der Tafel: was die Linien bedeuten, wie gut die Elf zusammenspielt
     * und - ist ein Spieler angetippt - seine Verbindungen und Rollen.
     */
    renderZusammenspiel(userClub, slots) {
        const el = document.getElementById("tacZusammenspiel");
        const T = this.getTacticsEngine();
        if (!el) return;
        if (!T || typeof T.zusammenspiel !== "function" || this.formationEditMode) { el.innerHTML = ""; return; }
        const esc = (x) => this.escapeHtml(String(x ?? ""));
        const z = this.zusammenspielDerElf(userClub, slots);
        const punkte = (wert) => Math.round((wert + 1) * 50);
        const wert = punkte(z.schnitt), schnitt = punkte(T.ZUSAMMENSPIEL.mittel);
        const wirkung = Math.round((z.faktor - 1) * 1000) / 10;
        const farbe = wert >= schnitt + 5 ? "#4ade80" : (wert >= schnitt - 5 ? "#facc15" : "#f87171");
        const wirkText = Math.abs(wirkung) < 0.1 ? "neutral" : `${wirkung > 0 ? "+" : "−"}${String(Math.abs(wirkung)).replace(".", ",")} % Stärke`;
        let html = `
            <div class="zs-kopf">
                <span>Zusammenspiel der Elf</span>
                <strong style="color:${farbe};">${wert}</strong>
                <span class="zs-schnitt">Schnitt ${schnitt} · ${wirkText}</span>
            </div>
            <div class="link-legende zs-legende">
                <span><i class="link-muster stark"></i>Rollen ergänzen sich</span>
                <span><i class="link-muster gut"></i>passt</span>
                <span><i class="link-muster schwach"></i>Rollen beißen sich</span>
                <span><i class="link-muster dick"></i>dick: eingespielt · dünn: noch fremd</span>
            </div>
            <p class="taktik-hilfe">Die Linien verbinden, wer zusammenspielt. Wie gut die Rollen passen, wie lange die beiden schon im Verein sind und wie oft sie zusammen gespielt haben, gibt der Elf bis zu zwei Prozent Stärke mehr oder weniger - und verbundene Spieler suchen sich im Spiel häufiger. Einen Spieler antippen und <em>Verbindungen</em> wählen zeigt seine.</p>`;

        // Der angetippte Spieler: Rollen und Verbindungen
        const i = this.selectedPitchSlot;
        if (i !== null && i !== undefined && slots[i]) {
            const spieler = z.spieler[i];
            const rollen = T.rollenDerElf(userClub, slots)[i];
            const name = (sp, k) => sp ? sp.name.split(" ").pop() : slots[k].pos;
            const auswahl = (phase) => {
                const liste = phase === "mit" ? T.rollenMitBall(rollen.familie) : T.rollenGegenBall(rollen.familie);
                const dreier = slots.filter(sl => (typeof T._norm === "function" ? T._norm(sl.pos) : sl.pos) === "IV").length >= 3;
                return liste.filter(r => !r.nurDreier || dreier)
                    .map(r => `<option value="${esc(r.id)}" ${r.id === rollen[phase] ? "selected" : ""}>${esc(r.name)}</option>`).join("");
            };
            const meine = z.verbindungen.filter(v => v.a === i || v.b === i)
                .sort((x, y) => (x.phase === y.phase ? 0 : (x.phase === "mit" ? -1 : 1)) || x.wert - y.wert);
            html += `
            <div class="zs-spieler">
                <div class="zs-spieler-kopf">
                    <strong>${esc(spieler ? spieler.name : "Leer")}</strong>
                    <span class="pos-tag">${esc(slots[i].pos)}</span>
                    <button class="btn btn-sm btn-secondary zs-schliessen" data-zs-schliessen aria-label="Auswahl aufheben">✕</button>
                </div>
                <div class="zs-rollen">
                    <label>Mit Ball <select class="styled-select" data-zs-rolle="mit">${auswahl("mit")}</select></label>
                    <label>Gegen den Ball <select class="styled-select" data-zs-rolle="gegen">${auswahl("gegen")}</select></label>
                </div>
                <ul class="taktik-check zs-liste">
                    ${meine.length ? meine.map(v => {
                        const k = v.a === i ? v.b : v.a;
                        return `<li class="${v.guete}"><strong>${v.phase === "gegen" ? "Gegen den Ball" : "Mit Ball"} mit ${esc(name(z.spieler[k], k))}:</strong> ${esc(v.text)} <span class="zs-eingespielt">Eingespielt ${Math.round(v.eingespielt * 100)} % - ${esc(this.gemeinsamSeit(spieler, z.spieler[k]))}.</span></li>`;
                    }).join("") : `<li>Keine Verbindung - dieser Platz steht für sich.</li>`}
                </ul>
                <p class="taktik-hilfe">Einen zweiten Spieler antippen tauscht die beiden.</p>
            </div>`;
        }
        el.innerHTML = html;
        el.querySelector("[data-zs-schliessen]")?.addEventListener("click", () => { this.selectedPitchSlot = null; this.renderTactics(); });
        el.querySelectorAll("[data-zs-rolle]").forEach(sel => {
            sel.onchange = (e) => {
                const t = T.normalisiere(userClub.tactics || (userClub.tactics = {}));
                userClub.tactics = t;
                const aktuell = T.rollenDerElf(userClub, slots)[i];
                t.rollen[i] = { mit: aktuell.mit, gegen: aktuell.gegen, [sel.dataset.zsRolle]: e.target.value };
                this.taktikGeaendert(userClub);
            };
        });
    },

    renderFormationEditorBar(userClub, slots) {
        const bar = document.getElementById("formationEditorBar");
        const btnEdit = document.getElementById("btnFormationEdit");
        if (!bar || !btnEdit) return;

        bar.style.display = this.formationEditMode ? "flex" : "none";
        btnEdit.innerHTML = this.formationEditMode
            ? '<svg class="ico" aria-hidden="true"><use href="#i-check"/></svg><span>Bearbeitung beenden</span>'
            : '<svg class="ico" aria-hidden="true"><use href="#i-edit"/></svg><span>Formation bearbeiten</span>';
        btnEdit.classList.toggle("btn-primary", this.formationEditMode);

        if (!this.formationEditMode) return;

        const posEngine = this.getPositionEngine();
        const badge = document.getElementById("formationShapeBadge");
        if (badge && posEngine) {
            badge.textContent = posEngine.detectFormationShape(slots);
        }

        // Positionsauswahl für den markierten Slot
        const select = document.getElementById("selectSlotPosition");
        if (select && posEngine) {
            const slot = (this.selectedPitchSlot !== null) ? slots[this.selectedPitchSlot] : null;
            if (!slot) {
                select.innerHTML = `<option value="">– Spieler auswählen –</option>`;
                select.disabled = true;
            } else {
                select.disabled = false;
                select.innerHTML = posEngine.ALL_POSITIONS.map(p =>
                    `<option value="${p}" ${p === slot.pos ? "selected" : ""}>${p} – ${posEngine.POSITION_META[p].name}</option>`
                ).join("");
            }
        }

        const hint = document.getElementById("formationEditorHint");
        if (hint) {
            hint.textContent = this.formationDirty
                ? "Geändert – als eigene Formation speichern, um die Aufstellung zu behalten."
                : "Spieler mit der Maus (oder dem Finger) auf dem Raster verschieben.";
        }

        const nameInput = document.getElementById("inputFormationName");
        if (nameInput && !nameInput.dataset.touched) {
            const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS) ? FORMATION_CONFIGS : (window.FORMATION_CONFIGS || {});
            const current = configs[userClub.formation];
            nameInput.value = (current && current.custom) ? current.name : "";
            nameInput.placeholder = `z. B. ${posEngine ? posEngine.detectFormationShape(slots) : "4-4-2"} Gegenpressing`;
        }

        const btnDelete = document.getElementById("btnFormationDelete");
        if (btnDelete) {
            const isCustom = GameState.isCustomFormation(userClub.formation);
            btnDelete.style.display = isCustom ? "inline-flex" : "none";
        }
    },

    /**
     * Bearbeitungsmodus umschalten
     */
    toggleFormationEditMode() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        this.formationEditMode = !this.formationEditMode;

        if (this.formationEditMode) {
            // Arbeitskopie der aktuellen Formation anlegen
            const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS) ? FORMATION_CONFIGS : (window.FORMATION_CONFIGS || {});
            const cfg = configs[userClub.formation] || configs["4-4-2"];
            this.formationDraft = (cfg?.positions || []).map(s => ({ ...s }));
            this.formationDirty = false;
            const nameInput = document.getElementById("inputFormationName");
            if (nameInput) delete nameInput.dataset.touched;
        } else {
            if (this.formationDirty) {
                this.showToast("Änderungen verworfen – nicht gespeicherte Formation.", "info");
            }
            this.formationDraft = null;
            this.formationDirty = false;
            this.selectedPitchSlot = null;
        }

        this.playSound("click");
        this.renderTactics();
    },

    /**
     * Zieht einen Spieler frei über das Raster
     */
    startSlotDrag(event, slotIndex) {
        if (!this.formationEditMode || !Array.isArray(this.formationDraft)) return;

        const pitch = document.getElementById("tacticsPitch");
        const node = event.currentTarget;
        if (!pitch || !node) return;

        event.preventDefault();
        this.selectedPitchSlot = slotIndex;
        node.classList.add("dragging");
        node.setPointerCapture?.(event.pointerId);

        const snapEnabled = () => document.getElementById("chkFormationSnap")?.checked !== false;
        const posEngine = this.getPositionEngine();

        const moveTo = (clientX, clientY) => {
            const rect = pitch.getBoundingClientRect();
            let x = ((clientX - rect.left) / rect.width) * 100;
            let y = ((clientY - rect.top) / rect.height) * 100;

            x = Math.max(4, Math.min(96, x));
            y = Math.max(4, Math.min(96, y));

            if (snapEnabled()) {
                // 20 Spalten x 12 Reihen wie im Raster-Overlay
                x = Math.round(x / 5) * 5;
                y = Math.round(y / (100 / 12)) * (100 / 12);
                x = Math.max(4, Math.min(96, x));
                y = Math.max(4, Math.min(96, y));
            }

            const slot = this.formationDraft[slotIndex];
            slot.x = Math.round(x * 10) / 10;
            slot.y = Math.round(y * 10) / 10;

            // Position folgt automatisch der Zone, solange sie nicht manuell gesetzt wurde
            this._slotPositionNachOrt(slot);

            node.style.left = `${slot.x}%`;
            node.style.top = `${slot.y}%`;
            const posBadge = node.querySelector(".pitch-node-pos");
            if (posBadge) posBadge.textContent = slot.pos;

            this.formationDirty = true;
        };

        const onMove = (e) => moveTo(e.clientX, e.clientY);

        const onUp = () => {
            node.classList.remove("dragging");
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
            this.renderTactics();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
    },

    /** Die Position eines Slots folgt seinem Ort, solange sie nicht von Hand gesetzt ist */
    _slotPositionNachOrt(slot) {
        const posEngine = this.getPositionEngine();
        if (!posEngine || slot.manualPos) return;
        const erkannt = posEngine.detectPositionFromCoords(slot.x, slot.y);
        slot.pos = erkannt;
        slot.role = posEngine.POSITION_META[erkannt]?.name || erkannt;
    },

    /** Den gewählten Spieler um einen Rasterschritt verschieben */
    schiebeSlot(richtung) {
        if (!this.formationEditMode || !Array.isArray(this.formationDraft)) return;
        const slot = this.formationDraft[this.selectedPitchSlot];
        if (!slot) { this.showToast("Erst einen Spieler auf dem Feld antippen.", "info"); return; }
        const dx = { links: -5, rechts: 5 }[richtung] || 0;
        const dy = { vor: -100 / 12, zurueck: 100 / 12 }[richtung] || 0;
        slot.x = Math.round(Math.max(4, Math.min(96, slot.x + dx)) * 10) / 10;
        slot.y = Math.round(Math.max(4, Math.min(96, slot.y + dy)) * 10) / 10;
        this._slotPositionNachOrt(slot);
        this.formationDirty = true;
        this.renderTactics();
    },

    /** Links und rechts tauschen - eine asymmetrische Formation für die andere Seite */
    spiegleFormation() {
        if (!this.formationEditMode || !Array.isArray(this.formationDraft)) return;
        const seite = { LV: "RV", RV: "LV", LM: "RM", RM: "LM", LA: "RA", RA: "LA" };
        this.formationDraft.forEach(slot => {
            slot.x = Math.round((100 - slot.x) * 10) / 10;
            if (slot.manualPos) { if (seite[slot.pos]) slot.pos = seite[slot.pos]; }
            else this._slotPositionNachOrt(slot);
        });
        this.formationDirty = true;
        this.playSound("click");
        this.renderTactics();
    },

    /**
     * Eigene Formation speichern
     */
    saveCustomFormation() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub || !Array.isArray(this.formationDraft)) return;

        const nameInput = document.getElementById("inputFormationName");
        const posEngine = this.getPositionEngine();
        const shape = posEngine ? posEngine.detectFormationShape(this.formationDraft) : "Eigene";
        const name = (nameInput?.value || "").trim() || `${shape} (eigene)`;

        const existingKey = GameState.isCustomFormation(userClub.formation) ? userClub.formation : null;
        const result = GameState.saveCustomFormation(state, name, this.formationDraft, existingKey);

        if (!result.success) {
            this.showToast(result.error, "error");
            return;
        }

        // Die Slots werden beim Speichern von hinten nach vorne sortiert -
        // die Aufstellung wird identisch umsortiert, damit jeder Spieler
        // auf genau der Position stehen bleibt, auf die er gezogen wurde.
        if (Array.isArray(result.order) && Array.isArray(userClub.lineup)) {
            userClub.lineup = result.order.map(sourceIndex => userClub.lineup[sourceIndex]).filter(id => id !== undefined);
        }

        userClub.formation = result.key;
        this.formationDraft = (FORMATION_CONFIGS[result.key].positions || []).map(s => ({ ...s }));
        this.formationDirty = false;
        this.selectedPitchSlot = null;

        if (nameInput) delete nameInput.dataset.touched;

        this.playSound("click");
        this.showToast(`Formation "${result.name}" (${result.shape}) gespeichert.`, "success");
        this.renderTactics();
    },

    /**
     * Entwurf auf die gespeicherte Formation zurücksetzen
     */
    resetFormationDraft() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        const configs = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS) ? FORMATION_CONFIGS : (window.FORMATION_CONFIGS || {});
        const cfg = configs[userClub.formation] || configs["4-4-2"];
        this.formationDraft = (cfg?.positions || []).map(s => ({ ...s }));
        this.formationDirty = false;
        this.selectedPitchSlot = null;
        this.renderTactics();
    },

    /**
     * Eigene Formation löschen
     */
    deleteCustomFormation() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub || !GameState.isCustomFormation(userClub.formation)) return;

        const key = userClub.formation;
        const result = GameState.deleteCustomFormation(state, key);
        if (!result.success) {
            this.showToast(result.error, "error");
            return;
        }

        this.formationEditMode = false;
        this.formationDraft = null;
        this.formationDirty = false;
        this.selectedPitchSlot = null;
        GameState.autoSetLineupForClub(userClub, state.players);

        this.showToast("Eigene Formation gelöscht – zurück auf 4-4-2.", "info");
        this.renderTactics();
    },

    // ------------------------------------------------- Spielerkarten auf dem Feld

    /** Trikotfarben wie im Spiel: lesbar auf dem Rasen, der Torwart abgesetzt */
    vereinsTrikot(club) {
        const kits = (typeof ermittleTrikots === "function") ? ermittleTrikots(club, null) : null;
        if (kits && kits.home) return kits.home;
        return { farbe: club?.primaryColor || "#1d4ed8", text: club?.secondaryColor || "#ffffff", tw: "#facc15", twText: "#0f172a" };
    },

    /** Ein Trikot mit Rückennummer */
    trikotSvg(farbe, schrift, nummer) {
        return `<svg class="spk-trikot" viewBox="0 0 40 38" aria-hidden="true">`
            + `<path d="M14 2 L7 4.5 L1 11 L5.5 16.5 L9.5 13.5 L9.5 36 L30.5 36 L30.5 13.5 L34.5 16.5 L39 11 L33 4.5 L26 2 C24.5 5.5 15.5 5.5 14 2 Z" fill="${farbe}" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" stroke-linejoin="round"/>`
            + `<text x="20" y="27.5" text-anchor="middle" fill="${schrift}">${this.escapeHtml(String(nummer))}</text></svg>`;
    },

    /** Fünf Sterne, halbe genau: die volle Reihe liegt über der leeren */
    sternReihe(sterne, titel = "") {
        const anteil = Math.max(0, Math.min(5, Math.round((Number(sterne) || 0) * 2) / 2)) / 5 * 100;
        return `<span class="spk-sterne"${titel ? ` title="${this.escapeHtml(titel)}"` : ""}><span class="spk-sterne-leer">★★★★★</span><span class="spk-sterne-voll" style="width:${anteil}%">★★★★★</span></span>`;
    },

    /** Die Rollen als Band unter dem Trikot - beide nur, wenn sie sich unterscheiden */
    rollenBandHtml(rollen, ansicht) {
        const T = this.getTacticsEngine();
        if (!rollen || !T) return "";
        const rm = T.rolleMitBall(rollen.familie, rollen.mit);
        const rg = T.rolleGegenBall(rollen.familie, rollen.gegen);
        const km = T.kuerzel(rm, "mit"), kg = T.kuerzel(rg, "gegen");
        const badge = (k, r, gegen) => `<span class="rolle-badge kat-${k.kategorie}${gegen ? " gegen" : ""}" title="${this.escapeHtml((gegen ? "Gegen den Ball: " : "Mit Ball: ") + r.name)}">${this.escapeHtml(k.text)}</span>`;
        const teile = ansicht === "mit" ? [badge(km, rm, false)]
            : ansicht === "gegen" ? [badge(kg, rg, true)]
                : (km.text === kg.text ? [badge(km, rm, false)] : [badge(km, rm, false), badge(kg, rg, true)]);
        return `<div class="rolle-badges">${teile.join("")}</div>`;
    },

    /** Wie es dem Spieler geht: Farbe für Kondition und Spielpraxis */
    zustandsFarbe(prozent) {
        return prozent >= 85 ? "#4ade80" : (prozent >= 70 ? "#facc15" : "#f87171");
    },

    /**
     * Ein Spieler auf dem Feld als Karte wie im Vorbild: Trikot mit
     * Rückennummer, Rolle, Sterne auf genau diesem Platz, Name, Kondition,
     * dazu Kapitän, Verletzung, Sperre und Signatur. Die Sterne gelten für
     * den Platz, nicht für seine Stammposition - wer fremd spielt, verliert.
     */
    spielerKarteHtml(club, slot, player, fit, rollen, ansicht) {
        const esc = (x) => this.escapeHtml(String(x ?? ""));
        const kit = this.vereinsTrikot(club);
        const tw = slot.pos === "TW";
        const band = this.rollenBandHtml(rollen, ansicht);
        if (!player) {
            return `<div class="spk spk-leer" title="${esc(slot.pos)}: niemand aufgestellt">
                <div class="spk-kopf">${this.trikotSvg("rgba(15,23,42,0.6)", "#cbd5e1", "+")}<span class="pitch-node-pos">${esc(slot.pos)}</span></div>
                ${band}
                <div class="pitch-node-name"><span class="spielername">Leer</span></div>
            </div>`;
        }
        const wirk = fit ? fit.effectiveOverall : player.overall;
        const sterne = this.starValueFor(wirk);
        const kondition = Math.max(0, Math.min(100, Math.round(player.fitness ?? 100)));
        const nummer = Number.isInteger(player.trikot) && player.trikot > 0 ? player.trikot : "";
        const rollenV = club.roles || {};
        const marken = [];
        if (String(rollenV.captain) === String(player.id)) marken.push(`<span class="spk-marke spk-kapitaen" title="Kapitän">C</span>`);
        if (player.injuredWeeks > 0) marken.push(`<span class="spk-marke spk-verletzt" title="Verletzt, noch ${player.injuredWeeks} ${player.injuredWeeks === 1 ? "Woche" : "Wochen"}">✚</span>`);
        else if (player.suspendedMatches > 0) marken.push(`<span class="spk-marke spk-gesperrt" title="Gesperrt für ${player.suspendedMatches} ${player.suspendedMatches === 1 ? "Spiel" : "Spiele"}"></span>`);
        const sig = this.signaturVon(player);
        const titel = [
            `${player.name} (${player.pos}) auf ${slot.pos}`,
            `${this.starValueFor(wirk).toFixed(1).replace(".", ",")} Sterne hier`,
            fit && !fit.isNatural ? `${fit.label}${fit.penalty > 0 ? `, −${fit.penalty} Stärke` : ""}` : null,
            `Kondition ${kondition} %`,
            sig ? `${sig.name}` : null
        ].filter(Boolean).join(" · ");
        return `<div class="spk ${fit ? `fit-${fit.level}` : ""}${player.injuredWeeks > 0 || player.suspendedMatches > 0 ? " spk-fehlt" : ""}" title="${esc(titel)}">
            <div class="spk-kopf">
                ${this.trikotSvg(tw ? kit.tw : kit.farbe, tw ? kit.twText : kit.text, nummer)}
                <span class="pitch-node-pos">${esc(slot.pos)}</span>
                ${marken.length ? `<span class="spk-marken">${marken.join("")}</span>` : ""}
                ${sig ? `<span class="spk-signatur" aria-hidden="true">${sig.icon}</span>` : ""}
            </div>
            ${band}
            <div class="spk-schild">
                ${this.sternReihe(sterne)}
                <span class="spielername">${esc(player.name.split(" ").pop())}</span>
                <span class="spk-zustand"><i style="width:${kondition}%;background:${this.zustandsFarbe(kondition)}"></i></span>
            </div>
            ${fit && !fit.isNatural ? `<span class="pitch-node-fit" style="color:${fit.color};">${esc(fit.shortLabel)}${fit.penalty > 0 ? ` −${fit.penalty}` : ""}</span>` : ""}
        </div>`;
    },

    // --------------------------------------------- Menü beim Antippen eines Spielers

    /** Das Menü öffnen (oder neu füllen, wenn es schon offen ist) */
    oeffneSpielerMenue(titel, html, binden) {
        const modal = document.getElementById("modalSpielerMenue");
        const inhalt = document.getElementById("spkMenueInhalt");
        if (!modal || !inhalt) return;
        document.getElementById("spkMenueTitel").innerHTML = titel;
        inhalt.innerHTML = html;
        const zu = document.getElementById("btnCloseSpielerMenue");
        if (zu) zu.onclick = () => this.schliesseSpielerMenue();
        modal.style.display = "flex";
        if (typeof binden === "function") binden(inhalt);
    },

    schliesseSpielerMenue() {
        const modal = document.getElementById("modalSpielerMenue");
        if (modal) modal.style.display = "none";
        this.spielerMenue = null;
    },

    /** Kondition, Form, Moral und Spielpraxis mit Balken */
    menueWerteHtml(player) {
        const kondition = Math.round(player.fitness ?? 100);
        const praxis = Math.round((typeof player.spielpraxis === "number" ? player.spielpraxis : 0.5) * 100);
        const moral = Math.round(player.morale ?? 75);
        const form = Number(player.form ?? 7);
        // Grün, gelb, rot - je Wert mit eigenen Schwellen (Spielpraxis 50 % ist normal)
        const farbe = (wert, gut, mittel) => wert >= gut ? "#4ade80" : (wert >= mittel ? "#facc15" : "#f87171");
        const zeile = (name, text, prozent, f) => `<div class="spm-wert"><span>${name}</span><strong>${text}</strong><span class="spm-balken"><i style="width:${Math.max(0, Math.min(100, prozent))}%;background:${f}"></i></span></div>`;
        return `<div class="spm-werte">
            ${zeile("Kondition", `${kondition} %`, kondition, farbe(kondition, 85, 70))}
            ${zeile("Form", form.toFixed(1).replace(".", ","), form * 10, farbe(form, 6.5, 5))}
            ${zeile("Moral", `${moral} %`, moral, farbe(moral, 70, 45))}
            ${zeile("Spielpraxis", `${praxis} %`, praxis, farbe(praxis, 45, 25))}
        </div>`;
    },

    /** Kopfzeile des Menüs: Nummer, Name, Alter, Land, Stammposition */
    menueKopfHtml(player, unterzeile = "") {
        const esc = (x) => this.escapeHtml(String(x ?? ""));
        const land = (typeof PlayerGenerator !== "undefined" && typeof PlayerGenerator.landZuNation === "function")
            ? PlayerGenerator.landZuNation(player.nationality) : null;
        const fehlt = player.injuredWeeks > 0 ? `<span class="spm-status schlecht">Verletzt, noch ${player.injuredWeeks} ${player.injuredWeeks === 1 ? "Woche" : "Wochen"}</span>`
            : (player.suspendedMatches > 0 ? `<span class="spm-status schlecht">Gesperrt für ${player.suspendedMatches} ${player.suspendedMatches === 1 ? "Spiel" : "Spiele"}</span>` : "");
        const sig = this.signaturVon(player);
        return `<div class="spm-kopf">
            <div class="spm-sub">${land ? this.flaggeVon(land) + " " : ""}${esc(player.nationality || "")} · ${player.age} Jahre · Stammposition <strong>${esc(player.pos)}</strong>${player.leihe ? " · Leihspieler" : ""}</div>
            ${unterzeile ? `<div class="spm-sub">${unterzeile}</div>` : ""}
            ${fehlt}
            ${sig ? `<div class="spm-sub">${sig.icon} <strong>${esc(sig.name)}</strong>: ${esc(sig.text)}</div>` : ""}
        </div>`;
    },

    /** Setzt einen Spieler aus Bank oder Kader auf einen Platz der Elf */
    setzeEin(slotIndex, playerId) {
        const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
        if (!userClub) return;
        const alt = userClub.lineup[slotIndex];
        const warPlatz = userClub.lineup.findIndex(id => id === playerId);
        if (warPlatz >= 0) {
            // Schon in der Elf: die beiden tauschen die Plätze
            userClub.lineup[warPlatz] = alt;
            userClub.lineup[slotIndex] = playerId;
        } else {
            userClub.lineup[slotIndex] = playerId;
            // Aus Bank/Reserve entfernen und alten Spieler dort einfügen
            userClub.bench = userClub.bench.filter(id => id !== playerId);
            if (alt && !userClub.bench.includes(alt) && userClub.bench.length < 7) userClub.bench.push(alt);
        }
        this.selectedPitchSlot = null;
        this.playSound("click");
        if (typeof this.app.state.saveToLocalStorage === "function") this.app.state.saveToLocalStorage();
        this.renderTactics();
    },

    /** Kapitän und Standards: noch einmal tippen nimmt die Aufgabe wieder weg */
    schalteAufgabe(playerId, aufgabe) {
        const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
        if (!userClub) return;
        userClub.roles = userClub.roles || {};
        userClub.roles[aufgabe] = String(userClub.roles[aufgabe]) === String(playerId) ? null : playerId;
        if (typeof this.app.state.saveToLocalStorage === "function") this.app.state.saveToLocalStorage();
        this.renderTactics();
    },

    /**
     * Antippen eines Spielers in der Elf: was er kann, wie es ihm geht und
     * was man mit ihm machen will - auswechseln, Platz tauschen, Rolle,
     * Kapitän und Standards, die Akte.
     */
    zeigeSpielerMenue(slotIndex, optionen = {}) {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;
        const slots = this.getActiveFormationPositions(userClub);
        const slot = slots[slotIndex];
        if (!slot) return;
        const esc = (x) => this.escapeHtml(String(x ?? ""));
        const posEngine = this.getPositionEngine();
        const T = this.getTacticsEngine();
        const player = state.players.find(p => p.id === userClub.lineup[slotIndex]) || null;
        this.spielerMenue = { art: "platz", slotIndex };

        // Wer für diesen Platz in Frage kommt: Bank zuerst, dann der Kader,
        // jeweils nach der Stärke genau auf diesem Platz
        const kader = state.players.filter(p => userClub.playerIds.includes(p.id) && !userClub.lineup.includes(p.id));
        const kandidaten = kader.map(p => {
            const fit = posEngine ? posEngine.getSuitability(p, slot.pos) : null;
            return { p, fit, wirk: fit ? fit.effectiveOverall : p.overall, bank: userClub.bench.includes(p.id), fehlt: p.injuredWeeks > 0 || p.suspendedMatches > 0 };
        }).sort((a, b) => (a.fehlt - b.fehlt) || (b.bank - a.bank) || (b.wirk - a.wirk));
        const kandidatHtml = (k) => `<button class="spm-kandidat${k.fehlt ? " fehlt" : ""}" data-spm-einsetzen="${esc(k.p.id)}"${k.fehlt ? " disabled" : ""}>
                <span class="pos-tag pos-${this.getPosGroup(k.p.pos)}">${esc(k.p.pos)}</span>
                <span class="spm-kandidat-name">${esc(k.p.name)}</span>
                ${this.starsFor(k.wirk, { color: k.fit ? k.fit.color : undefined, title: k.fit ? `${k.fit.label} auf ${slot.pos}` : "" })}
                <span class="spm-kandidat-info">${k.fehlt ? (k.p.injuredWeeks > 0 ? "verletzt" : "gesperrt") : `${k.bank ? "Bank" : "Kader"} · ${Math.round(k.p.fitness ?? 100)} %`}</span>
            </button>`;
        const zeigeAlle = !!optionen.alle;
        const liste = zeigeAlle ? kandidaten : kandidaten.slice(0, 6);
        const wechselHtml = `<div class="spm-abschnitt" id="spmWechsel">
                <h4>${player ? "Auswechseln" : "Besetzen"}: wer auf ${esc(slot.pos)} spielen kann</h4>
                <div class="spm-kandidaten">${liste.map(kandidatHtml).join("") || `<p class="text-muted">Niemand mehr frei.</p>`}</div>
                ${!zeigeAlle && kandidaten.length > liste.length ? `<button class="btn btn-sm btn-secondary" data-spm-alle>Alle ${kandidaten.length} zeigen</button>` : ""}
            </div>`;

        if (!player) {
            this.oeffneSpielerMenue(`<span class="spm-titel-pos">${esc(slot.pos)}</span> Platz frei`, wechselHtml, (el) => this.bindeSpielerMenue(el, slotIndex, null));
            return;
        }

        const fit = posEngine ? posEngine.getSuitability(player, slot.pos) : null;
        const wirk = fit ? fit.effectiveOverall : player.overall;
        const fitText = fit ? (fit.isNatural ? "Stammposition" : `${fit.label}${fit.penalty > 0 ? `, −${fit.penalty} Stärke` : ""}`) : "";
        const unterzeile = `Auf ${esc(slot.pos)}: ${this.sternReihe(this.starValueFor(wirk))} <span style="color:${fit ? fit.color : "inherit"}">${esc(fitText)}</span>`;

        // Rollen mit und gegen den Ball
        let rollenHtml = "";
        if (T) {
            const rollen = T.rollenDerElf(userClub, slots)[slotIndex];
            const dreier = slots.filter(sl => (typeof T._norm === "function" ? T._norm(sl.pos) : sl.pos) === "IV").length >= 3;
            const auswahl = (phase) => (phase === "mit" ? T.rollenMitBall(rollen.familie) : T.rollenGegenBall(rollen.familie))
                .filter(r => !r.nurDreier || dreier)
                .map(r => `<option value="${esc(r.id)}" ${r.id === rollen[phase] ? "selected" : ""}>${esc(r.name)}</option>`).join("");
            rollenHtml = `<div class="spm-abschnitt"><h4>Rolle</h4><div class="zs-rollen">
                <label>Mit Ball <select class="styled-select" data-spm-rolle="mit">${auswahl("mit")}</select></label>
                <label>Gegen den Ball <select class="styled-select" data-spm-rolle="gegen">${auswahl("gegen")}</select></label>
            </div></div>`;
        }
        const r = userClub.roles || {};
        const aufgabe = (key, text) => `<button class="spm-aufgabe${String(r[key]) === String(player.id) ? " aktiv" : ""}" data-spm-aufgabe="${key}" aria-pressed="${String(r[key]) === String(player.id)}">${text}</button>`;
        const html = `
            ${this.menueKopfHtml(player, unterzeile)}
            ${this.menueWerteHtml(player)}
            <div class="spm-aktionen">
                <button class="btn btn-primary" data-spm-akte>Akte öffnen</button>
                <button class="btn btn-secondary" data-spm-zu-wechsel>Auswechseln</button>
                <button class="btn btn-secondary" data-spm-tauschen title="Danach einen zweiten Spieler auf dem Feld oder auf der Bank antippen">Platz tauschen</button>
                ${T ? `<button class="btn btn-secondary" data-spm-verbindungen title="Seine Linien auf der Tafel hervorheben">Verbindungen</button>` : ""}
            </div>
            ${rollenHtml}
            <div class="spm-abschnitt"><h4>Aufgaben</h4><div class="spm-aufgaben">
                ${aufgabe("captain", "Kapitän")}${aufgabe("penaltyTaker", "Elfmeter")}${aufgabe("freeKickTaker", "Freistöße")}${aufgabe("cornerTaker", "Ecken")}
            </div></div>
            ${wechselHtml}`;
        const nummer = Number.isInteger(player.trikot) ? `<span class="spm-titel-nr">${player.trikot}</span>` : "";
        this.oeffneSpielerMenue(`${nummer}${esc(player.name)}`, html, (el) => {
            this.bindeSpielerMenue(el, slotIndex, player);
            if (optionen.wechsel) el.querySelector("#spmWechsel")?.scrollIntoView({ block: "nearest" });
        });
    },

    bindeSpielerMenue(el, slotIndex, player) {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        el.querySelectorAll("[data-spm-einsetzen]").forEach(btn => {
            btn.onclick = () => {
                const ziel = state.players.find(p => String(p.id) === btn.dataset.spmEinsetzen);
                if (!ziel) return;
                this.schliesseSpielerMenue();
                this.setzeEin(slotIndex, ziel.id);
                this.showToast(player ? `${ziel.name} für ${player.name}.` : `${ziel.name} spielt jetzt.`, "info");
            };
        });
        el.querySelector("[data-spm-alle]")?.addEventListener("click", () => this.zeigeSpielerMenue(slotIndex, { alle: true, wechsel: true }));
        if (!player) return;
        el.querySelector("[data-spm-akte]")?.addEventListener("click", () => { this.schliesseSpielerMenue(); this.showPlayerDetailsModal(player.id); });
        el.querySelector("[data-spm-zu-wechsel]")?.addEventListener("click", () => el.querySelector("#spmWechsel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
        el.querySelector("[data-spm-tauschen]")?.addEventListener("click", () => {
            this.schliesseSpielerMenue();
            this.selectedPitchSlot = slotIndex;
            this.playSound("click");
            this.renderTactics();
            this.showToast(`Jetzt den Spieler antippen, mit dem ${player.name.split(" ").pop()} tauschen soll.`, "info");
        });
        el.querySelector("[data-spm-verbindungen]")?.addEventListener("click", () => {
            this.schliesseSpielerMenue();
            this.selectedPitchSlot = slotIndex;
            this.renderTactics();
            document.getElementById("tacZusammenspiel")?.querySelector(".zs-spieler")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
        el.querySelectorAll("[data-spm-aufgabe]").forEach(btn => {
            btn.onclick = () => { this.schalteAufgabe(player.id, btn.dataset.spmAufgabe); this.zeigeSpielerMenue(slotIndex); };
        });
        const T = this.getTacticsEngine();
        el.querySelectorAll("[data-spm-rolle]").forEach(sel => {
            sel.onchange = (e) => {
                const slots = this.getActiveFormationPositions(userClub);
                const t = T.normalisiere(userClub.tactics || (userClub.tactics = {}));
                userClub.tactics = t;
                const aktuell = T.rollenDerElf(userClub, slots)[slotIndex];
                t.rollen[slotIndex] = { mit: aktuell.mit, gegen: aktuell.gegen, [sel.dataset.spmRolle]: e.target.value };
                this.taktikGeaendert(userClub);
            };
        });
    },

    /**
     * Antippen eines Spielers auf der Bank oder im Kader: seine Werte, die
     * Akte und für welchen Platz der Elf er in Frage kommt.
     */
    zeigeBankMenue(playerId) {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const player = state.players.find(p => p.id === playerId);
        if (!userClub || !player) return;
        const esc = (x) => this.escapeHtml(String(x ?? ""));
        const posEngine = this.getPositionEngine();
        const slots = this.getActiveFormationPositions(userClub);
        this.spielerMenue = { art: "bank", playerId };
        const aufBank = userClub.bench.includes(player.id);
        const fehlt = player.injuredWeeks > 0 || player.suspendedMatches > 0;
        // Für wen er kommen könnte: die Plätze, die er spielen kann, mit
        // seiner Stärke dort - ein Torwart taugt nicht als Verteidiger
        const alle = slots.map((slot, i) => {
            const fit = posEngine ? posEngine.getSuitability(player, slot.pos) : null;
            const jetzt = state.players.find(p => p.id === userClub.lineup[i]);
            return { i, slot, fit, wirk: fit ? fit.effectiveOverall : player.overall, jetzt };
        }).sort((a, b) => b.wirk - a.wirk);
        const passend = alle.filter(pl => !pl.fit || pl.fit.familiarity >= 0.45);
        const plaetze = (passend.length ? passend : alle.slice(0, 1)).slice(0, 5);
        const html = `
            ${this.menueKopfHtml(player, `${aufBank ? "Auf der Bank" : "Im Kader, nicht auf der Bank"} · ${this.sternReihe(this.starValueFor(player.overall))}`)}
            ${this.menueWerteHtml(player)}
            <div class="spm-aktionen">
                <button class="btn btn-primary" data-spm-akte>Akte öffnen</button>
                ${aufBank ? `<button class="btn btn-secondary" data-spm-bank="raus">Von der Bank nehmen</button>`
                    : (userClub.bench.length < 7 && !fehlt ? `<button class="btn btn-secondary" data-spm-bank="rein">Auf die Bank</button>` : "")}
            </div>
            ${fehlt ? "" : `<div class="spm-abschnitt"><h4>Einwechseln für</h4><div class="spm-kandidaten">
                ${plaetze.map(pl => `<button class="spm-kandidat" data-spm-platz="${pl.i}">
                    <span class="pos-tag pos-${this.getPosGroup(pl.slot.pos)}">${esc(pl.slot.pos)}</span>
                    <span class="spm-kandidat-name">${pl.jetzt ? `für ${esc(pl.jetzt.name)}` : "freier Platz"}</span>
                    ${this.starsFor(pl.wirk, { color: pl.fit ? pl.fit.color : undefined, title: pl.fit ? `${player.name}: ${pl.fit.label} auf ${pl.slot.pos}` : "" })}
                    <span class="spm-kandidat-info">${pl.jetzt ? `${esc(pl.jetzt.name.split(" ").pop())} dort: ${this.starValueFor(posEngine ? posEngine.getSuitability(pl.jetzt, pl.slot.pos).effectiveOverall : pl.jetzt.overall).toFixed(1).replace(".", ",")} Sterne` : ""}${pl.fit && !pl.fit.isNatural ? ` · ${esc(pl.fit.label)}` : ""}</span>
                </button>`).join("")}
            </div></div>`}`;
        const nummer = Number.isInteger(player.trikot) ? `<span class="spm-titel-nr">${player.trikot}</span>` : "";
        this.oeffneSpielerMenue(`${nummer}${esc(player.name)}`, html, (el) => {
            el.querySelector("[data-spm-akte]")?.addEventListener("click", () => { this.schliesseSpielerMenue(); this.showPlayerDetailsModal(player.id); });
            el.querySelector("[data-spm-bank]")?.addEventListener("click", (e) => {
                if (e.currentTarget.dataset.spmBank === "raus") userClub.bench = userClub.bench.filter(id => id !== player.id);
                else if (!userClub.bench.includes(player.id) && userClub.bench.length < 7) userClub.bench.push(player.id);
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderTactics();
                this.zeigeBankMenue(player.id);
            });
            el.querySelectorAll("[data-spm-platz]").forEach(btn => {
                btn.onclick = () => {
                    const i = Number(btn.dataset.spmPlatz);
                    const raus = state.players.find(p => p.id === userClub.lineup[i]);
                    this.schliesseSpielerMenue();
                    this.setzeEin(i, player.id);
                    this.showToast(raus ? `${player.name} für ${raus.name}.` : `${player.name} spielt jetzt.`, "info");
                };
            });
        });
    },

    // ------------------------------------------------ Ersatzbank und Kader

    /** Plätze auf der Bank */
    BANK_PLAETZE: 7,

    /**
     * Die Bank als Karten, darunter der übrige Kader nach Mannschaftsteil.
     * Vorher stand dort eine Reihe gleich aussehender Kästchen mit Name und
     * Sternzahl, Bank und Reserve nur am Wort "Bank" oder "Res" zu unterscheiden.
     * Ist ein Platz der Elf gewählt, zeigt beides die Stärke genau dort.
     */
    renderBank(userClub, slots, posEngine) {
        const state = this.app.state;
        const esc = (x) => this.escapeHtml(String(x ?? ""));
        const benchEl = document.getElementById("benchSlots");
        const reserveEl = document.getElementById("reserveSlots");
        if (!benchEl) return;
        const kader = state.players.filter(p => userClub.playerIds.includes(p.id));
        const bank = userClub.bench.map(id => kader.find(p => p.id === id)).filter(Boolean);
        const rest = kader.filter(p => !userClub.lineup.includes(p.id) && !userClub.bench.includes(p.id));
        const ziel = (this.selectedPitchSlot !== null && this.selectedPitchSlot !== undefined) ? slots[this.selectedPitchSlot] : null;
        const kit = this.vereinsTrikot(userClub);
        const nr = (p) => Number.isInteger(p.trikot) ? p.trikot : "";
        const wert = (p) => {
            const fit = ziel && posEngine ? posEngine.getSuitability(p, ziel.pos) : null;
            return { fit, sterne: this.starValueFor(fit ? fit.effectiveOverall : p.overall) };
        };
        const status = (p) => p.injuredWeeks > 0 ? `<span class="bk-status schlecht" title="Verletzt">✚ ${p.injuredWeeks} Wo.</span>`
            : (p.suspendedMatches > 0 ? `<span class="bk-status schlecht" title="Gesperrt">Sperre ${p.suspendedMatches}</span>` : "");
        const balken = (k) => `<span class="bk-kond" title="Kondition ${k} %"><i style="width:${k}%;background:${this.zustandsFarbe(k)}"></i></span>`;

        // Kopfzeilen: wie voll die Bank ist, was ein Tipp tut
        const zahl = document.getElementById("benchZahl");
        if (zahl) zahl.textContent = `${bank.length} / ${this.BANK_PLAETZE}`;
        const hilfe = document.getElementById("benchHilfe");
        if (hilfe) hilfe.textContent = ziel ? `Antippen wechselt auf ${ziel.pos} ein` : "Antippen: Werte, Akte, Einwechseln";

        // Die Bank: Karten mit Trikot
        let html = bank.map(p => {
            const w = wert(p);
            const k = Math.round(p.fitness ?? 100);
            const tw = p.pos === "TW";
            return `<button class="bank-karte${p.injuredWeeks > 0 || p.suspendedMatches > 0 ? " fehlt" : ""}${w.fit ? ` fit-${w.fit.level}` : ""}" data-bank-id="${esc(p.id)}" title="${esc(p.name)} (${esc(p.pos)}, ${p.age} J.) · Kondition ${k} %">
                <span class="bk-trikot">${this.trikotSvg(tw ? kit.tw : kit.farbe, tw ? kit.twText : kit.text, nr(p))}</span>
                <span class="bk-info">
                    <span class="bk-name"><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span><strong>${esc(p.name.split(" ").pop())}</strong></span>
                    <span class="bk-zeile">${this.sternReihe(w.sterne)}${w.fit && !w.fit.isNatural ? `<small style="color:${w.fit.color}">${esc(w.fit.shortLabel)}</small>` : ""}${status(p)}</span>
                    <span class="bk-zeile">${balken(k)}<small>${k} % · ${p.age} J.</small></span>
                </span>
            </button>`;
        }).join("");
        for (let i = bank.length; i < this.BANK_PLAETZE; i++) {
            html += `<button class="bank-karte frei" data-bank-frei="1" title="Einen Spieler aus dem Kader auf die Bank setzen">
                <span class="bk-trikot">${this.trikotSvg("rgba(148,163,184,0.18)", "#94a3b8", "+")}</span>
                <span class="bk-info"><span class="bk-name"><strong>Freier Platz</strong></span><small>Antippen und Spieler wählen</small></span>
            </button>`;
        }
        benchEl.innerHTML = html;
        benchEl.querySelectorAll("[data-bank-id]").forEach(b => {
            b.onclick = () => this.handleBenchPlayerClick(kader.find(p => String(p.id) === b.dataset.bankId)?.id);
        });
        benchEl.querySelectorAll("[data-bank-frei]").forEach(b => { b.onclick = () => this.zeigeBankAuswahl(); });

        // Der übrige Kader nach Mannschaftsteil
        if (!reserveEl) return;
        const anzahl = document.getElementById("reserveZahl");
        if (anzahl) anzahl.textContent = String(rest.length);
        const teile = [["tw", "Tor"], ["def", "Abwehr"], ["mid", "Mittelfeld"], ["att", "Angriff"]];
        reserveEl.innerHTML = rest.length ? teile.map(([g, titel]) => {
            const liste = rest.filter(p => this.getPosGroup(p.pos) === g)
                .map(p => ({ p, w: wert(p) }))
                .sort((x, y) => (x.p.injuredWeeks > 0 || x.p.suspendedMatches > 0) - (y.p.injuredWeeks > 0 || y.p.suspendedMatches > 0) || y.w.sterne - x.w.sterne);
            if (!liste.length) return "";
            return `<div class="kader-gruppe"><div class="kader-gruppe-titel">${titel}</div>${liste.map(({ p, w }) => {
                const k = Math.round(p.fitness ?? 100);
                const herkunft = p.reserve ? (p.reserve === "u19" ? "U19" : "U23") : (p.leihe && p.leihe.leihvereinId === state.userClubId ? "Leihe" : "");
                return `<button class="kader-zeile${p.injuredWeeks > 0 || p.suspendedMatches > 0 ? " fehlt" : ""}" data-kader-id="${esc(p.id)}">
                    <span class="kz-nr">${nr(p)}</span>
                    <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span>
                    <span class="kz-name"><strong>${esc(p.name)}</strong>${herkunft ? ` <small>${herkunft}</small>` : ""}</span>
                    <span class="kz-sterne">${this.sternReihe(w.sterne)}${w.fit && !w.fit.isNatural ? `<small style="color:${w.fit.color}">${esc(w.fit.shortLabel)}</small>` : ""}</span>
                    <span class="kz-kond">${status(p) || `${balken(k)}<small>${k} %</small>`}</span>
                </button>`;
            }).join("")}</div>`;
        }).join("") : `<p class="text-muted">Alle Spieler stehen in der Elf oder auf der Bank.</p>`;
        reserveEl.querySelectorAll("[data-kader-id]").forEach(b => {
            b.onclick = () => this.handleBenchPlayerClick(kader.find(p => String(p.id) === b.dataset.kaderId)?.id);
        });
    },

    /** Freier Bankplatz: wer aus dem Kader soll drauf? Die Stärksten zuerst, je Mannschaftsteil */
    zeigeBankAuswahl() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;
        const esc = (x) => this.escapeHtml(String(x ?? ""));
        const frei = state.players.filter(p => userClub.playerIds.includes(p.id) && !userClub.lineup.includes(p.id)
            && !userClub.bench.includes(p.id) && !(p.injuredWeeks > 0) && !(p.suspendedMatches > 0))
            .sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const html = frei.length ? `<div class="spm-kandidaten">${frei.map(p => `<button class="spm-kandidat" data-auf-bank="${esc(p.id)}">
                <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span>
                <span class="spm-kandidat-name">${esc(p.name)}</span>
                ${this.starsFor(p.overall)}
                <span class="spm-kandidat-info">${Math.round(p.fitness ?? 100)} % Kondition · ${p.age} J.</span>
            </button>`).join("")}</div>` : `<p class="text-muted">Niemand frei: Verletzte und Gesperrte dürfen nicht auf die Bank.</p>`;
        this.oeffneSpielerMenue("Auf die Bank", html, (el) => {
            el.querySelectorAll("[data-auf-bank]").forEach(b => {
                b.onclick = () => {
                    const p = frei.find(x => String(x.id) === b.dataset.aufBank);
                    if (p && userClub.bench.length < this.BANK_PLAETZE && !userClub.bench.includes(p.id)) userClub.bench.push(p.id);
                    this.schliesseSpielerMenue();
                    if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                    this.playSound("click");
                    this.renderTactics();
                };
            });
        });
    },

    handlePitchSlotClick(slotIndex) {
        if (this.selectedPitchSlot === slotIndex) {
            this.selectedPitchSlot = null;
        } else if (this.selectedPitchSlot !== null && this.selectedPitchSlot !== undefined) {
            // Tausche zwei Startelf-Spieler
            const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
            const temp = userClub.lineup[this.selectedPitchSlot];
            userClub.lineup[this.selectedPitchSlot] = userClub.lineup[slotIndex];
            userClub.lineup[slotIndex] = temp;
            this.selectedPitchSlot = null;
            this.playSound("click");
        } else {
            // Ohne Auswahl öffnet ein Tipp das Menü des Spielers
            this.playSound("click");
            this.zeigeSpielerMenue(slotIndex);
            return;
        }
        this.renderTactics();
    },

    handleBenchPlayerClick(playerId) {
        if (this.selectedPitchSlot !== null && this.selectedPitchSlot !== undefined) {
            // Tausche ausgewählten Startelf-Slot mit diesem Bankspieler
            this.setzeEin(this.selectedPitchSlot, playerId);
        } else {
            this.playSound("click");
            this.zeigeBankMenue(playerId);
        }
    },
});
