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
        const anzeige = Object.assign({ rollen: true, sterne: true, namen: true, verbindungen: true, eignung: true }, this.taktikAnzeige || {});
        this.taktikAnzeige = anzeige;
        const pitchEl = document.getElementById("tacticsPitch");
        if (pitchEl) {
            pitchEl.classList.toggle("ansicht-mit", ansicht === "mit" || ansicht === "beide");
            pitchEl.classList.toggle("ansicht-gegen", ansicht === "gegen");
            pitchEl.classList.toggle("ohne-rollen", !anzeige.rollen || !T);
            pitchEl.classList.toggle("ohne-sterne", !anzeige.sterne);
            pitchEl.classList.toggle("ohne-namen", !anzeige.namen);
            pitchEl.classList.toggle("ohne-eignung", !anzeige.eignung);
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
            node.className = `pitch-node ${this.selectedPitchSlot === index ? "selected" : ""}`;
            const ort = orte[index];
            node.style.left = `${ort.x}%`;
            node.style.top = `${ort.y}%`;
            node.dataset.slotIndex = index;
            // Die Rolle als Kuerzel wie im Vorbild - kombiniert beide Rollen
            let rolleHtml = "";
            if (rollenElf[index] && T) {
                const rm = T.rolleMitBall(rollenElf[index].familie, rollenElf[index].mit);
                const rg = T.rolleGegenBall(rollenElf[index].familie, rollenElf[index].gegen);
                const km = T.kuerzel(rm, "mit"), kg = T.kuerzel(rg, "gegen");
                const badge = (k, r, gegen) => `<span class="rolle-badge kat-${k.kategorie}${gegen ? " gegen" : ""}" title="${this.escapeHtml((gegen ? "Gegen den Ball: " : "Mit Ball: ") + r.name)}">${this.escapeHtml(k.text)}</span>`;
                // In "Kombiniert" nur dann zwei Marken, wenn die Rollen sich
                // unterscheiden - "MS MS" war doppelt und füllte die Tafel
                const teile = ansicht === "mit" ? [badge(km, rm, false)]
                    : ansicht === "gegen" ? [badge(kg, rg, true)]
                        : (km.text === kg.text ? [badge(km, rm, false)] : [badge(km, rm, false), badge(kg, rg, true)]);
                rolleHtml = `<div class="rolle-badges">${teile.join("")}</div>`;
            }

            const isSelected = this.selectedPitchSlot === index;

            // Eignung des Spielers auf genau dieser Position
            let fit = null;
            if (player && posEngine) {
                fit = posEngine.getSuitability(player, slot.pos);
                if (fit.familiarity < 0.7) {
                    misfits.push({ player, slot, fit });
                }
            }

            // Auf dem Trikot stehen Sterne, keine Zahl: Sie sagen sofort, ob
            // der Spieler für diese Position im eigenen Kader gut genug ist.
            const wirkStaerke = player ? (fit ? fit.effectiveOverall : player.overall) : null;
            const shirtValue = player
                ? this.starsFor(wirkStaerke, { title: `${player.name} auf ${slot.pos}`, color: "inherit" })
                : "–";
            const fitClass = fit ? `fit-${fit.level}` : "";
            const selectedStyle = isSelected ? "border-color:#f59e0b; box-shadow:0 0 12px #f59e0b;" : "";

            node.innerHTML = `
                <div class="pitch-node-shirt ${fitClass}" style="background: ${userClub.primaryColor}; color: ${userClub.secondaryColor}; ${selectedStyle}">
                    <span class="shirt-wert">${shirtValue}</span>
                    <span class="pitch-node-pos">${slot.pos}</span>
                </div>
                ${rolleHtml}
                <div class="pitch-node-name">
                    <span class="spielername">${player ? this.escapeHtml(player.name.split(" ").pop()) : "Leer"}</span>
                    ${fit && !fit.isNatural ? `<span class="pitch-node-fit" style="color:${fit.color};">${fit.shortLabel}${fit.penalty > 0 ? ` −${fit.penalty}` : ""}</span>` : ""}
                </div>
            `;

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

        // Ersatzbank rendern
        const benchContainer = document.getElementById("benchSlots");
        benchContainer.innerHTML = "";

        const squadPlayers = state.players.filter(p => userClub.playerIds.includes(p.id));
        const benchPlayers = userClub.bench.map(id => squadPlayers.find(p => p.id === id)).filter(Boolean);
        const reservePlayers = squadPlayers.filter(p => !userClub.lineup.includes(p.id) && !userClub.bench.includes(p.id));

        // Ist ein Slot gewählt, zeigt die Bank die Eignung für genau diese Position
        const targetSlot = (this.selectedPitchSlot !== null) ? slots[this.selectedPitchSlot] : null;

        [...benchPlayers, ...reservePlayers].forEach(p => {
            const isBench = userClub.bench.includes(p.id);
            const isInj = p.injuredWeeks > 0;
            const isSusp = p.suspendedMatches > 0;

            const benchEl = document.createElement("div");
            benchEl.className = "bench-node";

            let fitHtml = "";
            if (targetSlot && posEngine) {
                const fit = posEngine.getSuitability(p, targetSlot.pos);
                fitHtml = `<span class="bench-fit" style="color:${fit.color};" title="${fit.label} auf ${targetSlot.pos}">
                    ${targetSlot.pos}: ${this.starsFor(fit.effectiveOverall, { color: fit.color })}
                </span>`;
            }

            benchEl.innerHTML = `
                <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span>
                <strong>${this.escapeHtml(p.name)}</strong> ${this.starsFor(p.overall, { title: `Stärke im Vergleich zum eigenen Kader` })}
                ${fitHtml}
                ${isInj ? "🚑" : isSusp ? "🟥" : isBench ? '<span style="color:#34d399">Bank</span>' : '<span style="color:#94a3b8">Res</span>'}
            `;

            benchEl.addEventListener("click", () => {
                this.handleBenchPlayerClick(p.id);
            });

            benchContainer.appendChild(benchEl);
        });

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
            <p class="taktik-hilfe">Die Linien verbinden, wer zusammenspielt. Wie gut die Rollen passen, wie lange die beiden schon im Verein sind und wie oft sie zusammen gespielt haben, gibt der Elf bis zu zwei Prozent Stärke mehr oder weniger - und verbundene Spieler suchen sich im Spiel häufiger. Einen Spieler antippen zeigt seine Verbindungen.</p>`;

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

    handlePitchSlotClick(slotIndex) {
        if (this.selectedPitchSlot === slotIndex) {
            this.selectedPitchSlot = null;
        } else if (this.selectedPitchSlot !== null) {
            // Tausche zwei Startelf-Spieler
            const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
            const temp = userClub.lineup[this.selectedPitchSlot];
            userClub.lineup[this.selectedPitchSlot] = userClub.lineup[slotIndex];
            userClub.lineup[slotIndex] = temp;
            this.selectedPitchSlot = null;
            this.playSound("click");
        } else {
            this.selectedPitchSlot = slotIndex;
            this.playSound("click");
        }
        this.renderTactics();
    },

    handleBenchPlayerClick(playerId) {
        const userClub = this.app.state.clubs.find(c => c.id === this.app.state.userClubId);
        if (this.selectedPitchSlot !== null) {
            // Tausche ausgewählten Startelf-Slot mit diesem Bankspieler
            const oldPlayerId = userClub.lineup[this.selectedPitchSlot];
            userClub.lineup[this.selectedPitchSlot] = playerId;

            // Aus Bank/Reserve entfernen und alten Spieler dort einfügen
            userClub.bench = userClub.bench.filter(id => id !== playerId);
            if (oldPlayerId && !userClub.bench.includes(oldPlayerId) && userClub.bench.length < 7) {
                userClub.bench.push(oldPlayerId);
            }

            this.selectedPitchSlot = null;
            this.playSound("click");
            this.renderTactics();
        }
    },
});
