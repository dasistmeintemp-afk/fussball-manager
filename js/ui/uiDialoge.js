/**
 * Dialoge vor dem Spiel und beim Transfer: Gegneranalyse, Angebot, Matchplan und Ansprache.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Mannschaftsvergleich in Sternen.
     *
     * Zahlen wie "Angriff 81" sagen einem Manager wenig, solange er nicht
     * weiß, was seine eigene Mannschaft dort stehen hat. Nebeneinander in
     * derselben Sternesprache sieht man sofort, wo man überlegen ist und wo
     * es eng wird.
     */
    buildTeamComparisonHtml(eigenerClub, gegnerClub) {
        const engine = this.getRatingEngine();
        const state = this.app?.state;
        if (!engine || !state || !eigenerClub || !gegnerClub) return "";

        const kaderVon = (club) => (club.playerIds || [])
            .map(id => state.players.find(p => p.id === id))
            .filter(Boolean);

        const TEILE = [
            { name: "Tor", positionen: ["TW"] },
            { name: "Abwehr", positionen: ["IV", "LV", "RV"] },
            { name: "Mittelfeld", positionen: ["ZM", "DM", "OM", "LM", "RM"] },
            { name: "Angriff", positionen: ["ST", "LA", "RA"] }
        ];

        const kontext = this.starContext();
        const eigen = kaderVon(eigenerClub);
        const gegner = kaderVon(gegnerClub);

        // Ein Mannschaftsteil zählt nur mit seinen Besten - die Ersatzbank
        // steht am Spieltag nicht auf dem Platz.
        const teilSterne = (kader, positionen, anzahl) => {
            const passend = kader
                .filter(p => positionen.includes(p.pos) && (p.injuredWeeks || 0) <= 0)
                .sort((a, b) => (b.overall || 0) - (a.overall || 0))
                .slice(0, anzahl);
            if (passend.length === 0) return null;
            return engine.renderTeamStars(passend, kontext, { compact: true });
        };

        const zeilen = TEILE.map(teil => {
            const anzahl = teil.name === "Tor" ? 1 : teil.name === "Angriff" ? 3 : 4;
            const meins = teilSterne(eigen, teil.positionen, anzahl);
            const seins = teilSterne(gegner, teil.positionen, anzahl);
            if (!meins || !seins) return "";
            return `
                <div class="team-compare-row">
                    <div class="team-compare-side">${meins}</div>
                    <div class="team-compare-label">${teil.name}</div>
                    <div class="team-compare-side">${seins}</div>
                </div>`;
        }).join("");

        return `
            <div class="dash-card mb-3">
                <div class="team-compare-head">
                    <span>${this.escapeHtml(eigenerClub.name)}</span>
                    <span class="text-muted">Mannschaftsvergleich</span>
                    <span>${this.escapeHtml(gegnerClub.name)}</span>
                </div>
                <div class="team-compare-row team-compare-total">
                    <div class="team-compare-side">${engine.renderTeamStars(eigen, kontext)}</div>
                    <div class="team-compare-label">Gesamt</div>
                    <div class="team-compare-side">${engine.renderTeamStars(gegner, kontext)}</div>
                </div>
                ${zeilen}
                <div class="star-legend" style="justify-content:center;">
                    <span><i class="star-solid"></i> heutige Stärke</span>
                    <span><i class="star-growth"></i> Potenzial der Mannschaft</span>
                </div>
            </div>`;
    },

    /**
     * Modal: Gegneranalyse vor Spielbeginn anzeigen
     */
    showOpponentAnalysisModal() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const round = state.schedule.find(r => r.matchday === state.currentMatchday);
        const userMatch = round?.matches.find(m => m.homeClubId === userClub.id || m.awayClubId === userClub.id);

        if (!userMatch) {
            this.showToast("Kein anstehendes Spiel für die Gegneranalyse gefunden.", "warning");
            return;
        }

        const opponentId = userMatch.homeClubId === userClub.id ? userMatch.awayClubId : userMatch.homeClubId;
        const opponentEngine = (typeof OpponentAnalysisEngine !== 'undefined' && OpponentAnalysisEngine) 
            ? OpponentAnalysisEngine 
            : ((typeof window !== 'undefined' && window.OpponentAnalysisEngine) ? window.OpponentAnalysisEngine : null);

        if (!opponentEngine) return;

        const report = opponentEngine.generateReport(state, opponentId, userClub.id);
        if (!report) return;

        const modal = document.getElementById("modalOpponentAnalysis");
        const content = document.getElementById("opponentAnalysisContent");

        // Mannschaftsvergleich in Sternen: Wo sind wir besser, wo schlechter?
        const gegnerClub = state.clubs.find(c => c.id === opponentId);
        const vergleichHtml = this.buildTeamComparisonHtml(userClub, gegnerClub);

        content.innerHTML = `
            <div class="scout-report-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                <div>
                    <h3 style="font-size:22px; color:#f8fafc; margin-bottom:4px;">${report.opponentName}</h3>
                    <p class="text-muted" style="margin:0;">🏟️ ${report.stadium} • Tabellenplatz: <strong>#${report.rank}</strong> • Voraussichtlich: <strong>${report.likelyFormation}</strong></p>
                </div>
                <div style="text-align:right;">
                    <span class="badge ${report.dangerClass}" style="font-size:13px; padding:6px 12px;">Einstufung: ${report.dangerLevel}</span>
                </div>
            </div>

            ${report.analyst ? `<div class="stab-info mb-3">
                <div class="stab-info-kopf">
                    <span class="stab-info-titel">📋 Analyse</span>
                    <strong>${this.escapeHtml(report.analyst.name)}</strong>
                    ${this.stabSterneHtml(report.analyst.guete)}
                    <span class="sb-zuv" style="--zuv:${report.analyst.sterne >= 3 ? "#4ade80" : (report.analyst.sterne >= 2 ? "#facc15" : "#ef4444")};">${report.genauigkeit}</span>
                </div>
                ${report.analyst.sterne < 3 ? `<div class="stab-info-text">Ein besserer Spielanalyst läse die Mannschaftsteile genauer, stellt mehr Schlüsselspieler vor und findet die Schwachstelle in ihrer Elf.</div>` : ""}
            </div>` : ""}

            ${vergleichHtml}

            ${report.schwachstelle ? `<div class="dash-card mb-3" style="border-left:3px solid var(--accent-gold);">
                <h4 style="color:var(--accent-gold); margin-bottom:6px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-target"/></svg>Schwachstelle in ihrer Elf</h4>
                <p style="font-size:13px; margin:0;">${this.escapeHtml(report.schwachstelle.text)}</p>
            </div>` : ""}

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
                <div class="dash-card" style="border-left:3px solid #22c55e;">
                    <h4 style="color:#22c55e; margin-bottom:10px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-up"/></svg>Stärken des Gegners</h4>
                    <ul style="padding-left:18px; margin:0; font-size:13px;">
                        ${report.strengths.map(s => `<li>${s}</li>`).join("")}
                    </ul>
                </div>
                <div class="dash-card" style="border-left:3px solid #ef4444;">
                    <h4 style="color:#ef4444; margin-bottom:10px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-alert"/></svg>Schwachstellen</h4>
                    <ul style="padding-left:18px; margin:0; font-size:13px;">
                        ${report.weaknesses.map(w => `<li>${w}</li>`).join("")}
                    </ul>
                </div>
            </div>

            <div class="dash-card" style="margin-bottom:20px; background:rgba(56, 189, 248, 0.05); border:1px solid rgba(56, 189, 248, 0.25);">
                <h4 style="color:#38bdf8; margin-bottom:6px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-clipboard"/></svg>Taktische Tendenz & Cheftrainer-Empfehlung</h4>
                <p style="font-size:13px; margin-bottom:8px;"><strong>Taktik des Gegners:</strong> ${report.tacticalTrend}</p>
                <p style="font-size:13px; color:#f8fafc; margin:0;"><strong>💡 Trainer-Rat:</strong> ${report.recommendation}</p>
            </div>

            <div class="dash-card">
                <h4 style="margin-bottom:12px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-star"/></svg>Schlüsselspieler im Fokus & Scouting</h4>
                <div style="display:flex; gap:14px; flex-wrap:wrap;">
                    ${report.keyPlayers.map(p => `
                        <div style="background:rgba(255,255,255,0.04); padding:10px 14px; border-radius:8px; border:1px solid var(--border-color); flex:1; min-width:180px; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <strong>${p.name}</strong>
                                    <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span>
                                </div>
                                <div style="margin-top:6px; font-size:13px; color:#f59e0b;">
                                    ${p.abilityStarsHtml || p.starsCaHtml} <span style="font-size:11px; color:var(--text-muted);">(${p.abilityLabel})</span>
                                </div>
                                <div style="font-size:11px; color:var(--accent-primary); margin-top:2px;">
                                    Rolle: <strong>${p.bestRole?.role || 'Stammspieler'}</strong>
                                </div>
                                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                                    Gefahr: <span class="badge ${p.dangerBadgeClass}" style="font-size:10px; padding:2px 6px;">${p.danger}</span> • Scouthinweis: <strong>${p.confidence}%</strong>
                                </div>
                            </div>
                            <button class="btn btn-sm btn-secondary btn-scout-opponent-player mt-2" data-player-id="${p.id}" style="width:100%;" ${this.beobachtungsText(p.id) ? "disabled" : ""}>
                                ${this.beobachtungsText(p.id) ? `👁 In Beobachtung (${this.beobachtungsText(p.id)})` : "🔍 Spieler beobachten"}
                            </button>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;

        modal.style.display = "flex";
        this.playSound("click");

        content.querySelectorAll(".btn-scout-opponent-player").forEach(btn => {
            btn.addEventListener("click", () => {
                const pId = this.resolvePlayerId(btn.dataset.playerId);
                const scoutingEngine = (typeof ScoutingEngine !== 'undefined' && ScoutingEngine) 
                    ? ScoutingEngine 
                    : ((typeof window !== 'undefined' && window.ScoutingEngine) ? window.ScoutingEngine : null);

                if (scoutingEngine) this.beobachte(pId, "opponent_analysis", () => this.showOpponentAnalysisModal());
            });
        });
    },

    /**
     * Modal: Transferangebot Verhandlungsdialog
     */
    showTransferOfferModal(playerId) {
        const state = this.app.state;
        const player = state.players.find(p => p.id === playerId);
        const sellerClub = state.clubs.find(c => c.id === player.clubId);
        const userClub = state.clubs.find(c => c.id === state.userClubId);

        if (!player || !sellerClub || !userClub) return;

        const modal = document.getElementById("modalTransferOffer");
        const body = document.getElementById("transferOfferContent");
        document.getElementById("toModalTitle").textContent = `Verhandlung: ${player.name}`;

        const askingPriceEst = TransferEngine.calculateAskingPrice(player, sellerClub);

        // La Liga: höchstens drei Spieler ohne EU-Pass auf der Meldeliste
        const regeln = typeof KaderregelEngine !== "undefined" ? KaderregelEngine : null;
        const ligaRegel = regeln ? regeln.regel(userClub, "liga") : null;
        let passHinweis = "";
        if (ligaRegel && ligaRegel.maxNichtEU != null) {
            // Als Neuzugang wäre er frisch im Verein
            const neu = Object.assign({}, player, { vereinSeit: (state.seasonYear || 1) * 1000 });
            if (!regeln.eu(state, neu, userClub)) {
                const schon = regeln._kader(state, userClub).filter(p => !regeln.eu(state, p, userClub)).length;
                passHinweis = `<div class="hint-box" style="margin-top:8px; border-color:#f59e0b;">
                    Ohne EU-Pass: ${this.escapeHtml(ligaRegel.name)} erlaubt ${ligaRegel.maxNichtEU} Nicht-EU-Spieler auf der Meldeliste, im Kader stehen schon ${schon}.
                    ${schon >= ligaRegel.maxNichtEU ? "Er dürfte nur spielen, wenn ein anderer dafür von der Liste geht." : ""}
                </div>`;
            }
        }

        body.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
                <div>
                    <h4>${player.name} (${player.pos})</h4>
                    <p class="text-muted">Aktueller Verein: ${sellerClub.name}</p>
                </div>
                <div style="text-align:right;">
                    <div>${this.starsFor(player.overall, { title: "Stärke im Vergleich zum eigenen Kader" })}</div>
                    <p class="text-muted">Potenzial: ${this.starsFor(player.pot, { color: "#38bdf8", title: "Mögliche Entwicklung" })}</p>
                </div>
            </div>

            <div class="finance-stat-row">
                <span>Marktwert:</span>
                <strong>${GameState.formatMoney(player.value)}</strong>
            </div>
            <div class="finance-stat-row">
                <span>Geschätzte Mindestforderung:</span>
                <strong style="color:#f59e0b;">ca. ${GameState.formatMoney(askingPriceEst)}</strong>
            </div>
            <div class="finance-stat-row">
                <span>Ihr Transferbudget:</span>
                <strong style="color:#34d399;">${GameState.formatMoney(userClub.transferBudget)}</strong>
            </div>

            <div class="tactic-field" style="margin-top:16px;">
                <label>Eröffnungsangebot Ablöse (€):</label>
                <input type="number" id="offerFeeInput" class="styled-input" value="${askingPriceEst}" step="100000" min="0">
            </div>

            <div class="hint-box" style="margin-top:12px;">
                So läuft es ab: Zuerst einigen wir uns mit ${this.escapeHtml(sellerClub.name)} auf die Ablöse,
                danach verhandelt der Berater über Gehalt, Laufzeit und Handgeld, zum Schluss folgt der Medizincheck.
                ${this.getNegotiationEngine()?.istDeadlineDay?.(state)
                    ? "<strong>Heute ist Deadline Day:</strong> Alle antworten sofort, der Medizincheck geht noch heute, und am Abend schließt das Fenster"
                    : "Jede Antwort dauert ein bis drei Tage"} – den Stand sehen Sie im Reiter <strong>Transfers</strong>.
            </div>
            ${passHinweis}
            ${typeof this.erlaubnisHinweis === "function" ? this.erlaubnisHinweis(player) : ""}

            <div id="transferFeedback" style="margin-top:14px; font-size:13px; font-weight:600;"></div>

            <div class="modal-footer" style="padding:16px 0 0 0;">
                <button class="btn btn-secondary" id="btnCancelBid">Abbrechen</button>
                <button class="btn btn-primary" id="btnSubmitBid">Verhandlung eröffnen</button>
            </div>
        `;

        modal.style.display = "flex";

        document.getElementById("btnCancelBid").onclick = () => {
            modal.style.display = "none";
        };
        document.getElementById("btnCloseTransferOffer").onclick = () => {
            modal.style.display = "none";
        };

        // Der Transfer ist kein Knopfdruck mehr: Hier wird nur die
        // Verhandlung eröffnet, der Rest läuft über die nächsten Tage.
        document.getElementById("btnSubmitBid").onclick = () => {
            const fee = Number(document.getElementById("offerFeeInput").value) || 0;
            const feedback = document.getElementById("transferFeedback");
            const engine = this.getNegotiationEngine();

            if (!engine) {
                feedback.style.color = "#ef4444";
                feedback.textContent = "❌ Verhandlungen sind derzeit nicht verfügbar.";
                return;
            }

            const res = engine.startTransferNegotiation(state, player.id, userClub.id, fee);
            if (!res.success) {
                feedback.style.color = "#ef4444";
                feedback.textContent = `❌ ${res.error}`;
                return;
            }

            feedback.style.color = "#34d399";
            feedback.textContent = res.sofort
                ? res.message
                : `✅ Angebot über ${this.formatMoneySafe(fee)} liegt ${sellerClub.name} vor. Berater ${res.negotiation.agentName} begleitet die Gespräche.`;
            this.playSound("click");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();

            setTimeout(() => {
                modal.style.display = "none";
                this.zeigeVerhandlung(res.negotiation.id) || this.switchTab("transfers");
                this.renderHeader();
            }, res.sofort ? 2600 : 1400);
        };
    },

    /**
     * Startet die 2D Live Match Simulation im Vollbild-Modal
     */
    /** Auflösung der ManagerEngine (Browser & Node) */
    getManagerEngine() {
        if (typeof ManagerEngine !== "undefined" && ManagerEngine) return ManagerEngine;
        if (typeof window !== "undefined" && window.ManagerEngine) return window.ManagerEngine;
        return null;
    },

    getMatchplanEngine() {
        if (typeof MatchplanEngine !== "undefined" && MatchplanEngine) return MatchplanEngine;
        if (typeof window !== "undefined" && window.MatchplanEngine) return window.MatchplanEngine;
        return null;
    },

    /**
     * Taktikbesprechung vor dem Anpfiff: Die Analyse des Gegners auf einen
     * Blick und bis zu zwei Punkte für genau dieses Spiel. Der Analyst sagt
     * dazu, was er von jedem Punkt hält - so gut, wie er hinschaut.
     *
     * onDone läuft nach "Festlegen" wie nach "Ohne Plan"; ohne onDone (Aufruf
     * vom Dashboard) wird der Plan nur gespeichert.
     */
    showMatchplanModal(match, onDone = null) {
        const state = this.app.state;
        const engine = this.getMatchplanEngine();
        const modal = document.getElementById("modalMatchplan");
        const body = document.getElementById("matchplanContent");
        const v = engine && match ? engine.vorschlag(state, match) : null;
        if (!engine || !modal || !body || !v) {
            if (onDone) onDone();
            return;
        }

        const r = v.report || {};
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const auswahl = new Set(v.gespeichert ? v.gespeichert.punkte : []);
        // Anweisungen für einzelne Gegenspieler (GegneranweisungEngine)
        const ga = typeof GegneranweisungEngine !== "undefined" ? GegneranweisungEngine : null;
        const tafel = ga ? ga.tafel(state, match) : [];
        let zielId = v.gespeichert?.zielId ?? (v.ziele[0]?.id ?? null);
        const sieht = (r.analyst?.sterne || 0) >= 2.5;
        const gegensatz = { fluegel: "zentrum", zentrum: "fluegel", fruehStoeren: "tiefStehen", tiefStehen: "fruehStoeren" };
        const heim = match.homeClubId === state.userClubId;
        // Der Schiedsrichter steht mit der Ansetzung fest - ein strenger
        // bestraft harte Zweikämpfe, ein großzügiger lässt laufen
        const schiri = typeof MatchEngine !== "undefined" && MatchEngine.schiedsrichterFuer
            ? MatchEngine.schiedsrichterFuer(match) : null;

        document.getElementById("mpModalTitle").textContent = `Taktikbesprechung: ${v.gegnerName}`;

        const analyseHtml = `
            <div class="mp-analyse">
                <div class="mp-lage">
                    <span>${heim ? "Heimspiel" : "Auswärtsspiel"} gegen <strong>${esc(v.gegnerName)}</strong></span>
                    ${r.likelyFormation ? `<span class="mp-chip">Voraussichtlich ${esc(r.likelyFormation)}</span>` : ""}
                    ${r.dangerLevel ? `<span class="badge ${esc(r.dangerClass)}">${esc(r.dangerLevel)}</span>` : ""}
                </div>
                ${schiri ? `<div class="mp-analyst">🟨 Schiedsrichter <strong>${esc(schiri.name)}</strong> <span class="text-muted">${esc(schiri.art)} - ${esc(schiri.text)}</span></div>` : ""}
                ${this.wetterHtml(match, "mp-analyst")}
                ${r.analyst ? `<div class="mp-analyst">
                    📋 <strong>${esc(r.analyst.name)}</strong> ${this.stabSterneHtml(r.analyst.guete)}
                    <span class="text-muted">${esc(r.genauigkeit || "")}${sieht ? "" : " - zu ungenau für klare Empfehlungen"}</span>
                </div>` : ""}
                ${r.tacticalTrend ? `<p class="mp-trend">${esc(r.tacticalTrend)}</p>` : ""}
                <div class="mp-spalten">
                    <div><h5 class="mp-plus">Stärken</h5><ul>${(r.strengths || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>
                    <div><h5 class="mp-minus">Schwächen</h5><ul>${(r.weaknesses || []).map(s => `<li>${esc(s)}</li>`).join("")}</ul></div>
                </div>
                ${r.schwachstelle ? `<div class="mp-schwach">🔎 ${esc(r.schwachstelle.text)}</div>` : ""}
                ${(r.keyPlayers || []).length ? `<div class="mp-schluessel">
                    <span class="text-muted">Schlüsselspieler:</span>
                    ${r.keyPlayers.map(k => `<span class="mp-chip"><span class="pos-tag pos-${this.getPosGroup(k.pos)}">${esc(k.pos)}</span> ${esc(k.name)}${k.danger === "Hoch" ? " ⚠️" : ""}</span>`).join("")}
                </div>` : ""}
            </div>`;

        const karten = v.plaene.map(p => `
            <button class="mp-karte" data-key="${p.key}" ${p.verfuegbar ? "" : "disabled"}>
                <span class="mp-icon">${p.icon}</span>
                <span class="mp-text">
                    <strong>${esc(p.name)}</strong>
                    <span class="mp-beschreibung">${esc(p.text)}</span>
                    ${!p.verfuegbar ? `<span class="mp-grund">${p.braucht === "schwachstelle" ? "Der Analyst hat keine Schwachstelle gefunden." : "Kein Schlüsselspieler bekannt."}</span>`
                        : p.empfohlen ? `<span class="mp-empfehlung">📋 ${esc(p.grund)}</span>`
                        : (sieht && p.grund ? `<span class="mp-grund">${esc(p.grund)}</span>` : "")}
                </span>
            </button>`).join("");

        body.innerHTML = `
            ${analyseHtml}
            <div class="mp-kopfzeile">
                <h4>Ihr Plan für dieses Spiel</h4>
                <span class="mp-zaehler" id="mpZaehler"></span>
            </div>
            <p class="mp-hinweis">Bis zu zwei Punkte. Sie gelten nur für diese Partie - danach steht wieder Ihre gewohnte Taktik.
                Trifft ein Punkt eine echte Schwäche des Gegners, ist die Mannschaft spürbar besser eingestellt.</p>
            <div class="mp-karten">${karten}</div>
            <div class="mp-ziel" id="mpZiel" style="display:none;">
                <label for="mpZielWahl">Eng decken:</label>
                <select id="mpZielWahl" class="styled-input">
                    ${v.ziele.map(z => `<option value="${esc(z.id)}" ${String(z.id) === String(zielId) ? "selected" : ""}>${esc(z.name)} (${esc(z.pos)})${z.danger === "Hoch" ? " - gefährlich" : ""}</option>`).join("")}
                </select>
            </div>
            ${tafel.length ? `
            <details class="mp-anweisungen" id="mpAnweisungen" ${tafel.some(t => Object.keys(t.gesetzt).length) ? "open" : ""}>
                <summary>Gegneranweisungen <span class="mp-zaehler" id="mpAnwZaehler"></span></summary>
                <p class="mp-hinweis">Für einzelne Gegenspieler, zusätzlich zum Plan. Was zu wem passt, hängt an seinen Stärken - ${sieht ? "der Analyst hat seine Vorschläge markiert." : "für Vorschläge ist der Analyst zu ungenau."}</p>
                ${tafel.some(t => t.empfehlung) ? `<button class="btn btn-sm btn-secondary" id="btnAnwEmpfehlung" type="button">📋 Vorschläge des Analysten übernehmen</button>` : ""}
                <div class="ga-liste">
                    ${tafel.map(t => `
                    <div class="ga-zeile" data-ga-id="${esc(t.id)}">
                        <div class="ga-kopf">
                            <span class="pos-tag pos-${this.getPosGroup(t.pos)}">${esc(t.pos)}</span>
                            <strong>${esc(t.name)}</strong>
                            ${t.foot ? `<span class="text-muted">${esc(t.foot === "beidfüßig" ? "beidfüßig" : t.foot === "links" ? "Linksfuß" : "Rechtsfuß")}</span>` : ""}
                        </div>
                        ${t.empfehlung ? `<div class="ga-empfehlung" data-ga-empf='${esc(JSON.stringify(t.empfehlung.anweisung))}'>📋 ${esc(t.empfehlung.grund)}</div>` : ""}
                        <div class="ga-wahl">
                            <label class="ga-feld"><span>${esc(ga.ARTEN.anlaufen.label)}</span>
                                <select class="styled-select ga-anlaufen">
                                    <option value="">Normal</option>
                                    ${t.moeglich.anlaufen.map(w => `<option value="${w}" ${t.gesetzt.anlaufen === w ? "selected" : ""}>${esc(ga.ARTEN.anlaufen.werte[w])}</option>`).join("")}
                                </select>
                            </label>
                            <label class="ga-feld"><span>${esc(ga.ARTEN.zweikampf.label)}</span>
                                <select class="styled-select ga-zweikampf">
                                    <option value="">Normal</option>
                                    ${t.moeglich.zweikampf.map(w => `<option value="${w}" ${t.gesetzt.zweikampf === w ? "selected" : ""}>${esc(ga.ARTEN.zweikampf.werte[w])}</option>`).join("")}
                                </select>
                            </label>
                            ${t.moeglich.fuss.length ? `<label class="ga-fuss"><input type="checkbox" class="ga-fuss-feld" ${t.gesetzt.fuss === "schwach" ? "checked" : ""}> Auf den schwachen Fuß</label>` : ""}
                        </div>
                    </div>`).join("")}
                </div>
            </details>` : ""}
            <div class="mp-aktionen">
                <button class="btn btn-secondary" id="btnMatchplanOhne">${onDone ? "Ohne Besprechung" : "Plan verwerfen"}</button>
                <button class="btn btn-primary" id="btnMatchplanFest">${onDone ? "Weiter zur Ansprache ▶" : "Plan festlegen"}</button>
            </div>
        `;

        // Die Anweisungen aus der Liste lesen: { id: { anlaufen, zweikampf, fuss } }
        const leseAnweisungen = () => {
            const je = {};
            body.querySelectorAll(".ga-zeile").forEach(z => {
                const a = {};
                const anl = z.querySelector(".ga-anlaufen")?.value;
                const zwk = z.querySelector(".ga-zweikampf")?.value;
                if (anl) a.anlaufen = anl;
                if (zwk) a.zweikampf = zwk;
                if (z.querySelector(".ga-fuss-feld")?.checked) a.fuss = "schwach";
                if (Object.keys(a).length) je[z.dataset.gaId] = a;
            });
            return je;
        };

        const zeichne = () => {
            body.querySelectorAll(".mp-karte").forEach(btn => btn.classList.toggle("aktiv", auswahl.has(btn.dataset.key)));
            const zaehler = document.getElementById("mpZaehler");
            if (zaehler) zaehler.textContent = `${auswahl.size} / ${engine.MAX_PUNKTE}`;
            const anwZahl = Object.keys(leseAnweisungen()).length;
            const anwZaehler = document.getElementById("mpAnwZaehler");
            if (anwZaehler) anwZaehler.textContent = anwZahl ? `${anwZahl} Spieler` : "";
            body.querySelectorAll(".ga-zeile").forEach(z => z.classList.toggle("aktiv", !!leseAnweisungen()[z.dataset.gaId]));
            const ziel = document.getElementById("mpZiel");
            if (ziel) ziel.style.display = auswahl.has("engDecken") && v.ziele.length ? "" : "none";
            const fest = document.getElementById("btnMatchplanFest");
            if (fest && !onDone) fest.disabled = auswahl.size === 0 && anwZahl === 0;
        };
        body.querySelectorAll(".ga-zeile select, .ga-zeile input").forEach(el => el.addEventListener("change", zeichne));
        document.getElementById("btnAnwEmpfehlung")?.addEventListener("click", () => {
            body.querySelectorAll(".ga-zeile").forEach(z => {
                const e = z.querySelector(".ga-empfehlung");
                if (!e) return;
                const a = JSON.parse(e.dataset.gaEmpf || "{}");
                if (a.anlaufen) z.querySelector(".ga-anlaufen").value = a.anlaufen;
                if (a.zweikampf) z.querySelector(".ga-zweikampf").value = a.zweikampf;
                const fuss = z.querySelector(".ga-fuss-feld");
                if (fuss && a.fuss) fuss.checked = true;
            });
            this.playSound("click");
            zeichne();
        });

        body.querySelectorAll(".mp-karte").forEach(btn => {
            btn.addEventListener("click", () => {
                const key = btn.dataset.key;
                if (auswahl.has(key)) {
                    auswahl.delete(key);
                } else {
                    // Was sich widerspricht, fliegt raus - früh stören und tief
                    // stehen gleichzeitig kann keine Mannschaft
                    if (gegensatz[key]) auswahl.delete(gegensatz[key]);
                    if (auswahl.size >= engine.MAX_PUNKTE) {
                        this.showToast(`Höchstens ${engine.MAX_PUNKTE} Punkte - mehr behält keine Mannschaft im Kopf.`, "warning");
                        return;
                    }
                    auswahl.add(key);
                }
                this.playSound("click");
                zeichne();
            });
        });
        const zielWahl = document.getElementById("mpZielWahl");
        if (zielWahl) zielWahl.onchange = () => { zielId = zielWahl.value; };

        const schliessen = () => {
            modal.style.display = "none";
            if (onDone) onDone();
        };
        document.getElementById("btnMatchplanOhne").onclick = () => {
            engine.abschliessen(state, match);
            if (!onDone) this.showToast("Kein Matchplan - es gilt die gewohnte Taktik.", "info");
            schliessen();
            if (!onDone) this.renderDashboard();
        };
        document.getElementById("btnMatchplanFest").onclick = () => {
            const anw = ga ? (ga.festlegen(state, match, leseAnweisungen()) || {}) : {};
            const anwZahl = Object.keys(anw).length;
            const anwText = anwZahl ? ` Dazu Anweisungen für ${anwZahl} Gegenspieler.` : "";
            if (auswahl.size === 0) {
                if (engine.fuerSpiel(state, match)) delete state.matchplan;
                if (anwZahl) this.showToast(`Gegneranweisungen für ${anwZahl} Spieler stehen - ohne weiteren Plan.`, "success");
                schliessen();
                if (!onDone && anwZahl) this.renderDashboard();
                return;
            }
            const plan = engine.festlegen(state, match, [...auswahl], zielId);
            const namen = plan.punkte.map(k => k === "engDecken" && plan.zielName
                ? `${plan.zielName} eng decken` : engine.PLAENE[k].name);
            const urteil = sieht && plan.treffer >= plan.punkte.length ? " Der Analyst ist überzeugt."
                : sieht && plan.treffer === 0 ? " Der Analyst hat Zweifel." : "";
            this.showToast(`Matchplan steht: ${namen.join(", ")}.${urteil}${anwText}`, "success");
            schliessen();
            if (!onDone) this.renderDashboard();
        };
        const x = document.getElementById("btnCloseMatchplan");
        if (x) x.onclick = () => { modal.style.display = "none"; };

        zeichne();
        modal.style.display = "flex";
    },

    /**
     * Kabinenansprache vor dem Anpfiff oder in der Halbzeit.
     *
     * Der Ton wird nicht bewertet, sondern wirkt: Wer eine 2:0 führende
     * Mannschaft anbrüllt, nimmt ihr die Lockerheit. Die Wirkung landet in
     * Moral und Form und damit direkt in der Spielstärke.
     */
    showTeamTalkModal(options = {}, onDone = null) {
        const state = this.app.state;
        const engine = this.getManagerEngine();
        const modal = document.getElementById("modalTeamTalk");
        const body = document.getElementById("teamTalkContent");

        if (!engine || !modal || !body) {
            if (onDone) onDone(null);
            return;
        }

        const ctx = engine.buildTalkContext(state, options);
        const istHalbzeit = ctx.phase === "halftime";

        const lage = istHalbzeit
            ? (ctx.scoreDiff > 0 ? `Sie führen mit ${ctx.scoreDiff} Tor${ctx.scoreDiff === 1 ? "" : "en"}.`
                : ctx.scoreDiff < 0 ? `Sie liegen mit ${Math.abs(ctx.scoreDiff)} Tor${ctx.scoreDiff === -1 ? "" : "en"} zurück.`
                : "Es steht unentschieden.")
            : (ctx.isFavourite ? `Ihre Mannschaft geht als Favorit in das Spiel gegen ${this.escapeHtml(ctx.opponentName)}.`
                : ctx.isUnderdog ? `Gegen ${this.escapeHtml(ctx.opponentName)} sind Sie Außenseiter.`
                : `Ein Spiel auf Augenhöhe gegen ${this.escapeHtml(ctx.opponentName)}.`);

        const stimmung = ctx.avgMorale >= 82 ? "Die Mannschaft strotzt vor Selbstvertrauen."
            : ctx.avgMorale >= 62 ? "Die Stimmung in der Kabine ist gelöst."
            : "Die Mannschaft wirkt verunsichert.";

        document.getElementById("ttModalTitle").textContent = istHalbzeit
            ? "Halbzeitansprache"
            : "Ansprache vor dem Anpfiff";

        // Vor dem Anpfiff steht der Matchplan noch einmal auf der Tafel
        const planEngine = this.getMatchplanEngine();
        const plan = !istHalbzeit && planEngine && state.matchplan && state.matchplan.clubId === state.userClubId ? state.matchplan : null;
        const planZeile = plan && plan.punkte.length
            ? `<p class="tt-plan">📋 Matchplan: ${plan.punkte.map(k => this.escapeHtml(k === "engDecken" && plan.zielName
                ? `${plan.zielName} eng decken` : (planEngine.PLAENE[k]?.name || k))).join(" · ")}</p>`
            : "";
        const anwZeilen = !istHalbzeit && options.match && typeof GegneranweisungEngine !== "undefined"
            ? GegneranweisungEngine.kurz(state, options.match) : [];
        const anwZeile = anwZeilen.length ? `<p class="tt-plan">🎯 ${anwZeilen.map(z => this.escapeHtml(z)).join(" · ")}</p>` : "";

        body.innerHTML = `
            <p class="team-talk-situation">${lage} ${stimmung}</p>
            ${planZeile}
            ${anwZeile}
            <div class="team-talk-options">
                ${engine.TEAM_TALK_TONES.map(t => `
                    <button class="team-talk-option" data-tone="${t.key}">
                        <span class="tt-icon">${t.icon}</span>
                        <span class="tt-body">
                            <strong>${this.escapeHtml(t.label)}</strong>
                            <span class="tt-line">„${this.escapeHtml(t.line)}"</span>
                            <span class="tt-hint">${this.escapeHtml(t.hint)}</span>
                        </span>
                    </button>
                `).join("")}
            </div>
            <button class="btn btn-ghost btn-sm tt-ohne" id="btnTeamTalkOhne">Ohne Ansprache ${istHalbzeit ? "weiterspielen" : "auf den Platz"} ▶</button>
            <div id="teamTalkResult"></div>
        `;

        modal.style.display = "flex";

        // Schließen heißt: ohne (weitere) Ansprache weiter. Vorher hatte das
        // Kreuz keine Wirkung - wer keine Ansprache halten wollte, saß fest,
        // in der Halbzeit sogar mitten im angehaltenen Spiel.
        let ergebnis = null, fertig = false;
        const weiter = () => {
            if (fertig) return;
            fertig = true;
            modal.style.display = "none";
            if (onDone) onDone(ergebnis);
        };
        const kreuz = document.getElementById("btnCloseTeamTalk");
        if (kreuz) kreuz.onclick = weiter;
        document.getElementById("btnTeamTalkOhne").onclick = weiter;

        body.querySelectorAll(".team-talk-option").forEach(btn => {
            btn.addEventListener("click", () => {
                const res = engine.applyTeamTalk(state, btn.dataset.tone, options);
                if (!res.success) return;
                ergebnis = res;
                document.getElementById("btnTeamTalkOhne").style.display = "none";

                const farbe = res.moraleDelta >= 1.5 ? "#34d399" : res.moraleDelta <= -1.5 ? "#f87171" : "#94a3b8";
                document.getElementById("teamTalkResult").innerHTML = `
                    <div class="team-talk-result">
                        <strong style="color:${farbe};">${this.escapeHtml(res.summary)}</strong>
                        <div class="tt-delta">Moral im Schnitt ${res.moraleDelta > 0 ? "+" : ""}${res.moraleDelta}</div>
                        ${res.reactions.map(r => `<div class="tt-reaction ${r.positive ? "positive" : "negative"}">${this.escapeHtml(r.text)}</div>`).join("")}
                        <button class="btn btn-primary mt-2" id="btnTeamTalkContinue">
                            ${istHalbzeit ? "Zweite Halbzeit ▶" : "Auf den Platz ▶"}
                        </button>
                    </div>
                `;
                body.querySelectorAll(".team-talk-option").forEach(b => { b.disabled = true; });
                this.playSound("click");

                document.getElementById("btnTeamTalkContinue").onclick = weiter;
            });
        });
    },
});
