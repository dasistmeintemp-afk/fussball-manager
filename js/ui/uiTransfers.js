/**
 * Transfers: Verhandlungen, Leihen, zweite Mannschaft, Transfermarkt und Scoutberichte.
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
     * Laufende Verhandlungen mit Vereinen und Beratern.
     *
     * Jede Verhandlung zeigt die aktuelle Phase, die Forderung der Gegenseite,
     * die verbleibende Geduld und die Frist. Sind wir am Zug, lässt sich hier
     * direkt nachbessern.
     */
    renderNegotiations() {
        const state = this.app.state;
        const engine = this.getNegotiationEngine();
        const container = document.getElementById("negotiationsContainer");
        const list = document.getElementById("negotiationsList");
        if (!container || !list) return;

        if (!engine) {
            container.style.display = "none";
            return;
        }

        const offen = engine.getOpenNegotiations(state).filter(n => n.clubId === state.userClubId);
        if (offen.length === 0) {
            container.style.display = "none";
            return;
        }

        container.style.display = "block";
        const heute = state.currentDayIndex || 0;

        list.innerHTML = offen.map(n => {
            const amZug = n.status === engine.STATUS.AWAITING_US;
            const istAblöse = n.stage === engine.STAGES.FEE;
            const restTage = Math.max(0, n.deadlineDay - heute);
            const geduldFarbe = n.patience >= 60 ? "#34d399" : n.patience >= 30 ? "#f59e0b" : "#f87171";

            const phaseText = n.type === "youth_promotion"
                ? "Erstvertrag mit dem Berater"
                : (istAblöse ? `Ablöse mit ${this.escapeHtml(n.sellerClubName || "dem Verein")}` : "Persönliche Konditionen");

            const forderung = istAblöse
                ? `Forderung: <strong>${this.formatMoneySafe(n.demand.fee)}</strong> Ablöse`
                : `Forderung: <strong>${this.formatMoneySafe(n.demand.wage)}</strong> / Woche, Handgeld ${this.formatMoneySafe(n.demand.signingBonus)}${n.demand.agentFee ? `, Berater ${this.formatMoneySafe(n.demand.agentFee)}` : ""}`;

            const letzterEintrag = (n.log || [])[n.log.length - 1];

            const eingabe = amZug ? (istAblöse ? `
                <div class="negotiation-inputs">
                    <label>Ablöse (€)
                        <input type="number" class="styled-input neg-fee" data-neg-id="${n.id}" value="${n.demand.fee}" step="100000" min="0">
                    </label>
                </div>
            ` : `
                <div class="negotiation-inputs">
                    <label>Gehalt (€ / Woche)
                        <input type="number" class="styled-input neg-wage" data-neg-id="${n.id}" value="${n.demand.wage}" step="500" min="0">
                    </label>
                    <label>Laufzeit
                        <select class="styled-select neg-years" data-neg-id="${n.id}">
                            ${[1, 2, 3, 4, 5].map(j => `<option value="${j}" ${j === (n.demand.years || 3) ? "selected" : ""}>${j} Jahr${j > 1 ? "e" : ""}</option>`).join("")}
                        </select>
                    </label>
                    <label>Handgeld (€)
                        <input type="number" class="styled-input neg-bonus" data-neg-id="${n.id}" value="${n.demand.signingBonus}" step="10000" min="0">
                    </label>
                    <label>Beraterhonorar (€)
                        <input type="number" class="styled-input neg-berater" data-neg-id="${n.id}" value="${n.demand.agentFee || 0}" step="10000" min="0">
                    </label>
                    <label>Einsatzprämie (€ / Spiel)
                        <input type="number" class="styled-input neg-einsatz" data-neg-id="${n.id}" value="0" step="1000" min="0">
                    </label>
                    <label>Torprämie (€ / Tor)
                        <input type="number" class="styled-input neg-tor" data-neg-id="${n.id}" value="0" step="1000" min="0">
                    </label>
                    <p class="neg-hinweis">Prämien ersetzen einen Teil des Grundgehalts. Der Spieler rechnet sie mit Abschlag ein und bekommt sie nur, wenn er spielt oder trifft.</p>
                </div>
            `) : "";

            return `
                <div class="negotiation-card ${amZug ? "our-turn" : ""}">
                    <div class="negotiation-head">
                        <div>
                            <strong>${this.escapeHtml(n.playerName)}</strong>
                            <span class="text-muted" style="font-size:12px;">(${this.escapeHtml(n.playerPos || "")})</span>
                            <div style="font-size:12px; color:var(--text-muted);">
                                ${phaseText} · Berater ${this.escapeHtml(n.agentName)} (${this.escapeHtml(n.agentLabel || "")})
                            </div>
                        </div>
                        <span class="badge ${amZug ? "badge-warning" : "badge-info"}">${this.escapeHtml(engine.describe(n))}</span>
                    </div>

                    <div class="negotiation-meta">
                        <span>${forderung}</span>
                        <span>Geduld: <strong style="color:${geduldFarbe};">${n.patience}%</strong></span>
                        <span>Frist: noch <strong>${restTage}</strong> Tage</span>
                    </div>

                    ${letzterEintrag ? `<div class="negotiation-log">„${this.escapeHtml(letzterEintrag.text)}"</div>` : ""}

                    ${eingabe}

                    <div class="negotiation-actions">
                        ${amZug ? `<button class="btn btn-sm btn-primary btn-neg-submit" data-neg-id="${n.id}">Angebot abgeben</button>` : ""}
                        <button class="btn btn-sm btn-secondary btn-neg-withdraw" data-neg-id="${n.id}">Abbrechen</button>
                    </div>
                </div>
            `;
        }).join("");

        list.querySelectorAll(".btn-neg-submit").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.negId;
                const n = engine.findNegotiation(state, id);
                if (!n) return;

                const angebot = n.stage === engine.STAGES.FEE
                    ? { fee: Number(list.querySelector(`.neg-fee[data-neg-id="${id}"]`)?.value || 0) }
                    : {
                        wage: Number(list.querySelector(`.neg-wage[data-neg-id="${id}"]`)?.value || 0),
                        years: Number(list.querySelector(`.neg-years[data-neg-id="${id}"]`)?.value || 3),
                        signingBonus: Number(list.querySelector(`.neg-bonus[data-neg-id="${id}"]`)?.value || 0),
                        agentFee: Number(list.querySelector(`.neg-berater[data-neg-id="${id}"]`)?.value || 0),
                        einsatzPraemie: Number(list.querySelector(`.neg-einsatz[data-neg-id="${id}"]`)?.value || 0),
                        torPraemie: Number(list.querySelector(`.neg-tor[data-neg-id="${id}"]`)?.value || 0)
                    };

                const res = engine.submitOffer(state, id, angebot);
                if (res.success) {
                    this.playSound("click");
                    this.showToast(res.message || "Angebot abgegeben.", "success");
                    this.renderNegotiations();
                } else {
                    this.showToast(res.error || "Angebot nicht möglich.", "error");
                }
            });
        });

        list.querySelectorAll(".btn-neg-withdraw").forEach(btn => {
            btn.addEventListener("click", () => {
                const res = engine.withdraw(state, btn.dataset.negId);
                if (res.success) {
                    this.showToast(`Verhandlung um ${res.negotiation.playerName} abgebrochen.`, "warning");
                    this.renderNegotiations();
                }
            });
        });
    },

    getLoanEngine() {
        if (typeof LoanEngine !== "undefined" && LoanEngine) return LoanEngine;
        if (typeof window !== "undefined" && window.LoanEngine) return window.LoanEngine;
        return null;
    },

    /** Unterreiter Leihen: eigene Leihen und der Leihmarkt */
    renderLeihen() {
        const engine = this.getLoanEngine();
        const state = this.app.state;
        const eigene = document.getElementById("loansOwnList");
        const markt = document.getElementById("loanMarketBody");
        if (!engine || !eigene || !markt) return;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const club = (id) => state.clubs.find(c => c.id === id);

        const verliehen = engine.verlieheneVon(state, state.userClubId);
        const geliehen = engine.geliehenVon(state, state.userClubId);
        const fenster = typeof TransferEngine !== "undefined" && TransferEngine.fensterInfo ? TransferEngine.fensterInfo(state) : null;
        const fensterEl = document.getElementById("loansFenster");
        if (fensterEl && fenster) {
            fensterEl.className = `tf-fenster ${fenster.offen ? "offen" : "zu"}`;
            fensterEl.textContent = `${fenster.offen ? "🟢" : "🔒"} ${fenster.text}`;
        }
        const meta = document.getElementById("loansMeta");
        if (meta) meta.textContent = `${verliehen.length} verliehen · ${geliehen.length} geliehen`;
        const zeile = (p, text, knopf = "") => `
            <div class="leih-zeile" data-player-id="${esc(p.id)}">
                <div><strong>${esc(p.name)}</strong> <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span> <span class="text-muted">${p.age} J.</span></div>
                <div class="leih-text">${text}</div>
                ${knopf}
            </div>`;
        eigene.innerHTML = (verliehen.length || geliehen.length) ? [
            ...verliehen.map(p => {
                const l = p.leihe;
                const spiele = (p.stats?.matches || 0) - (l.startSpiele || 0);
                const noten = (p.stats?.ratingSum || 0) - (l.startNoten || 0);
                return zeile(p,
                    `Verliehen an <strong>${esc(club(l.leihvereinId)?.name || "?")}</strong> (${esc(l.rolle)}) · ${spiele} Spiele${spiele ? `, Note ${(noten / spiele).toFixed(2).replace(".", ",")}` : ""} · Spielpraxis ${Math.round((p.spielpraxis ?? 0.5) * 100)} %`,
                    `<button class="btn btn-sm btn-secondary" data-leihe-zurueck="${esc(p.id)}">Zurückholen</button>`);
            }),
            ...geliehen.map(p => {
                const l = p.leihe;
                return zeile(p, `Geliehen von <strong>${esc(club(l.stammvereinId)?.name || "?")}</strong> · Sie zahlen ${Math.round(l.lohnAnteil * 100)} % des Gehalts · erwartet: ${esc(l.rolle)}${l.kaufoption ? ` · Kaufoption ${this.geldKurz(l.kaufoption)}` : ""}`,
                    l.kaufoption ? `<button class="btn btn-sm btn-primary" data-kaufoption-ziehen="${esc(p.id)}">Kaufoption ziehen</button>` : "");
            })
        ].join("") : `<div class="text-muted" style="font-size:13px;">Keine laufenden Leihen.</div>`;

        const ratingEngine = this.getRatingEngine();
        const liste = engine.leihmarkt(state, 30);
        markt.innerHTML = liste.length ? liste.map(e => {
            const p = state.players.find(q => String(q.id) === String(e.playerId));
            const card = ratingEngine && p ? ratingEngine.calculateVisiblePlayerCard(p, Object.assign({ userClubId: state.userClubId, leagueDataCoverage: 85 }, this.starContext())) : null;
            return `
                <tr class="clickable-row" data-player-id="${esc(e.playerId)}">
                    <td><strong>${esc(e.name)}</strong></td>
                    <td>${esc(e.clubName)}</td>
                    <td><span class="pos-tag pos-${this.getPosGroup(e.pos)}">${esc(e.pos)}</span></td>
                    <td>${e.age}</td>
                    <td class="nowrap">${card ? card.abilityStarsHtml : ""}</td>
                    <td><span class="badge badge-info">${esc(e.rolle)}</span></td>
                    <td>${Math.round(e.lohnAnteil * 100)} % von ${this.geldKurz(e.wage)}</td>
                    <td>${e.gebuehr ? this.geldKurz(e.gebuehr) : "-"}</td>
                    <td class="leih-option"><label title="Aufschlag ${esc(this.geldKurz(e.optionsAufschlag))} auf die Leihgebühr"><input type="checkbox" data-kaufoption="${esc(e.playerId)}"> ${this.geldKurz(e.kaufoption)}</label></td>
                    <td><button class="btn btn-sm btn-primary" data-ausleihen="${esc(e.playerId)}" ${fenster && !fenster.offen ? `disabled title="${esc(fenster.text)}"` : ""}>Ausleihen</button></td>
                </tr>`;
        }).join("") : `<tr><td colspan="10" class="text-center text-muted">Gerade gibt kein Verein einen passenden Spieler ab.</td></tr>`;

        const neuZeichnen = () => {
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderLeihen();
            this.renderHeader?.();
        };
        eigene.querySelectorAll("[data-kaufoption-ziehen]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const res = engine.zieheKaufoption(state, btn.dataset.kaufoptionZiehen);
            this.showToast(res.success ? `Fest verpflichtet für ${this.geldKurz(res.preis)}.` : res.error, res.success ? "success" : "error", 5000);
            if (res.success) { this.playSound("goal"); neuZeichnen(); }
        }));
        eigene.querySelectorAll("[data-leihe-zurueck]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const res = engine.zurueckholen(state, btn.dataset.leiheZurueck);
            this.showToast(res.success ? "Er kehrt zurück." : res.error, res.success ? "success" : "error");
            if (res.success) neuZeichnen();
        }));
        markt.querySelectorAll("[data-kaufoption]").forEach(box => box.addEventListener("click", (ev) => ev.stopPropagation()));
        markt.querySelectorAll("[data-ausleihen]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const option = markt.querySelector(`[data-kaufoption="${btn.dataset.ausleihen}"]`)?.checked;
            const res = engine.ausleihen(state, btn.dataset.ausleihen, null, { kaufoption: !!option });
            this.showToast(res.success ? `${res.eintrag.name} spielt bis zum Saisonende für Sie.` : res.error, res.success ? "success" : "error", 5000);
            if (res.success) { this.playSound("goal"); neuZeichnen(); }
        }));
        [...eigene.querySelectorAll(".leih-zeile"), ...markt.querySelectorAll("tr[data-player-id]")].forEach(el => el.addEventListener("click", () => {
            const ziel = state.players.find(p => String(p.id) === el.dataset.playerId);
            if (ziel) this.showPlayerDetailsModal(ziel.id);
        }));
    },

    /** Die zweite Mannschaft in der Spielerakte: hinunterschicken oder zurückholen */
    reserveHtml(player) {
        const engine = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        if (!engine) return "";
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const praxis = Math.round((player.spielpraxis ?? 0.5) * 100);
        const kopf = `<h4 class="gs-titel"><svg class="ico" aria-hidden="true"><use href="#i-users"/></svg> Zweite Mannschaft (U23)</h4>`;
        if (player.reserve) {
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">Spielt in der U23 und steht den Profis nicht zur Verfügung · Spielpraxis ${praxis} %</div>
                    <button class="btn btn-secondary" id="btnPdReserve">In den Profikader holen</button>
                </div>`;
        }
        const check = engine.pruefe(state, player);
        return `
            <div class="dash-card mb-3 gs-karte">${kopf}
                <div class="gs-sub">In der U23 spielt er an jedem Spieltag und sammelt Spielpraxis (Spielpraxis jetzt ${praxis} %). Für die Profis fehlt er, bis Sie ihn zurückholen.</div>
                ${check.ok
                    ? `<button class="btn btn-secondary" id="btnPdReserve">In die U23 schicken</button>`
                    : `<div class="gs-lage">${esc(check.grund)}</div>`}
            </div>`;
    },

    /** Der Block der zweiten Mannschaft im Kader-Reiter */
    renderReserve() {
        const box = document.getElementById("squadReserve");
        const engine = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        if (!box || !engine) return;
        const state = this.app.state;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const spieler = engine.spieler(state, club).sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const b = club?.reserveBilanz;
        if (!spieler.length && !b) { box.style.display = "none"; box.innerHTML = ""; return; }
        box.style.display = "";
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const letzte = (b?.letzte || []).map(e => {
            const klasse = e.tore > e.gegentore ? "s" : (e.tore === e.gegentore ? "u" : "n");
            return `<span class="u23-ergebnis u23-${klasse}" title="Spieltag ${e.matchday}${e.schuetzen.length ? " · Tore: " + esc(e.schuetzen.join(", ")) : ""}">${e.tore}:${e.gegentore}</span>`;
        }).join("");
        box.innerHTML = `
            <div class="kb-kopf">
                <h3><svg class="ico" aria-hidden="true"><use href="#i-users"/></svg>Zweite Mannschaft (U23)</h3>
                ${b ? `<span class="text-muted">${b.s} S · ${b.u} U · ${b.n} N · ${b.tore}:${b.gegentore} Tore</span>` : ""}
            </div>
            ${letzte ? `<div class="u23-letzte"><span class="kb-label">Letzte Spiele</span>${letzte}</div>` : ""}
            ${spieler.length ? `<table class="data-table u23-tabelle"><thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Spielpraxis</th></tr></thead><tbody>
                ${spieler.map(p => `<tr data-u23="${esc(p.id)}"><td>${esc(p.name)}${(p.injuredWeeks || 0) > 0 ? ' <span class="text-danger">verletzt</span>' : ""}</td><td>${esc(p.pos)}</td><td>${p.age || "-"}</td><td>${p.overall || "-"}</td><td>${Math.round((p.spielpraxis ?? 0.5) * 100)} %</td></tr>`).join("")}
            </tbody></table>` : `<p class="text-muted">Niemand spielt gerade in der U23.</p>`}
            <p class="text-muted kb-hinweis">Über die Spielerakte schicken Sie Spieler hinunter oder holen sie zurück. Höchstens ${engine.MAX_UEBERALTERT} Spieler über ${engine.ALTERSGRENZE}, im Profikader bleiben mindestens ${engine.MIN_PROFIKADER}.</p>`;
        box.querySelectorAll("[data-u23]").forEach(tr => tr.addEventListener("click", () => this.showPlayerDetailsModal(tr.dataset.u23)));
    },

    /**
     * Die Leihe in der Spielerakte: verleihen (eigener Spieler), Stand einer
     * laufenden Leihe mit Zurückholen, Hinweis bei einem Leihspieler, oder
     * Ausleihen, wenn sein Verein ihn abgibt.
     */
    leiheHtml(player, modus) {
        const engine = this.getLoanEngine();
        if (!engine) return "";
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const club = (id) => state.clubs.find(c => c.id === id);
        const kopf = `<h4 class="gs-titel"><svg class="ico" aria-hidden="true"><use href="#i-transfer"/></svg> Leihe</h4>`;
        if (modus === "verliehen") {
            const l = player.leihe;
            const spiele = (player.stats?.matches || 0) - (l.startSpiele || 0);
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">Verliehen an <strong>${esc(club(l.leihvereinId)?.name || "?")}</strong> bis zum Saisonende (${esc(l.rolle)}, dort ${Math.round(l.lohnAnteil * 100)} % des Gehalts) · ${spiele} Spiele seit der Leihe · Spielpraxis ${Math.round((player.spielpraxis ?? 0.5) * 100)} %</div>
                    <button class="btn btn-secondary" id="btnPdLeiheZurueck">Vorzeitig zurückholen</button>
                </div>`;
        }
        if (modus === "geliehen") {
            const l = player.leihe;
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">Leihspieler von <strong>${esc(club(l.stammvereinId)?.name || "?")}</strong> bis zum Saisonende. Sie zahlen ${Math.round(l.lohnAnteil * 100)} % seines Gehalts; erwartet wird ein Einsatz als ${esc(l.rolle)}.${l.kaufoption ? ` Kaufoption: ${this.geldKurz(l.kaufoption)}.` : ""}</div>
                    ${l.kaufoption ? `<button class="btn btn-primary" id="btnPdKaufoption">Kaufoption ziehen (${this.geldKurz(l.kaufoption)})</button>` : ""}
                </div>`;
        }
        if (modus === "eigener") {
            const hindernis = engine.verleihHindernis(state, player);
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-sub">Ein Verein, bei dem er spielt, leiht ihn bis zum Saisonende aus und übernimmt einen Teil des Gehalts.</div>
                    ${hindernis
                        ? `<div class="gs-lage">${esc(hindernis)}</div>`
                        : `<button class="btn btn-secondary" id="btnPdLeiheAnfragen">Interessenten anfragen</button><div id="pdLeiheAngebote" class="leih-angebote"></div>`}
                </div>`;
        }
        if (modus === "markt") {
            const e = engine.leihmarkt(state, 500).find(x => String(x.playerId) === String(player.id));
            if (!e) return "";
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">${esc(e.clubName)} gibt ihn ab: bis zum Saisonende, Sie übernehmen ${Math.round(e.lohnAnteil * 100)} % des Gehalts${e.gebuehr ? `, Leihgebühr ${this.geldKurz(e.gebuehr)}` : ""}. Erwartet wird ein Einsatz als ${esc(e.rolle)}.</div>
                    <button class="btn btn-primary" id="btnPdAusleihen">Ausleihen</button>
                </div>`;
        }
        return "";
    },

    renderTransfers() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        this.renderNegotiations();

        // 1. Eingehende Angebote für eigene Spieler - als Karten ganz oben,
        // mit Frist, Verhältnis zum Marktwert und allen drei Antworten
        const offersContainer = document.getElementById("aiOffersContainer");
        const offersList = document.getElementById("aiOffersList");
        const pendingOffers = TransferEngine.offeneAngebote
            ? TransferEngine.offeneAngebote(state)
            : (state.transferMarket?.offers || []).filter(o => o.status === "pending");

        if (offersContainer && offersList) {
            if (pendingOffers.length > 0) {
                offersContainer.style.display = "block";
                const titel = offersContainer.querySelector("h3");
                if (titel) titel.textContent = `💰 ${pendingOffers.length} Angebot${pendingOffers.length === 1 ? "" : "e"} für Ihre Spieler`;
                offersList.innerHTML = pendingOffers.map(o => this.angebotKarteHtml(o, state, userClub)).join("");

                offersList.querySelectorAll(".btn-accept-offer").forEach(b => {
                    b.addEventListener("click", () => this.nimmAngebotAn(b.dataset.offerId));
                });
                offersList.querySelectorAll(".btn-more-offer").forEach(b => {
                    b.addEventListener("click", () => this.zeigeAngebotDialog(b.dataset.offerId, true));
                });
                offersList.querySelectorAll(".btn-reject-offer").forEach(b => {
                    b.addEventListener("click", () => this.lehneAngebotAb(b.dataset.offerId));
                });
                offersList.querySelectorAll(".ak-spieler[data-player-id]").forEach(el => {
                    el.addEventListener("click", () => {
                        const pId = this.resolvePlayerId(el.dataset.playerId);
                        if (pId !== null) this.showPlayerDetailsModal(pId);
                    });
                });
            } else {
                offersContainer.style.display = "none";
            }
        }

        // 2. Transfermarkt Tabelle
        const searchVal = document.getElementById("tfSearch")?.value.toLowerCase() || "";
        const posVal = document.getElementById("tfPosFilter")?.value || "all";
        // Der Filter ist in Sternen formuliert; verglichen wird darunter weiter
        // mit der Stärke, die zu dieser Sternezahl im eigenen Kader gehört.
        const minStars = parseFloat(document.getElementById("tfRatingFilter")?.value || "0");

        let marketPlayers = state.players.filter(p => p.clubId !== userClub.id);

        // Marktreichweite: Ein Landesligist hatte bisher die komplette Serie A
        // im Angebot. Sichtbar ist jetzt, was zum Standing des Vereins passt.
        const transferEngine = (typeof TransferEngine !== "undefined" && TransferEngine)
            ? TransferEngine
            : ((typeof window !== "undefined" && window.TransferEngine) ? window.TransferEngine : null);

        let ausserReichweite = 0;
        if (transferEngine && typeof transferEngine.isWithinReach === "function") {
            const vorher = marketPlayers.length;
            marketPlayers = marketPlayers.filter(p => transferEngine.isWithinReach(p, userClub, state.clubs));
            ausserReichweite = vorher - marketPlayers.length;
        }

        const reichweiteEl = document.getElementById("transferReachHint");
        if (reichweiteEl && transferEngine && typeof transferEngine.describeReach === "function") {
            const reich = transferEngine.describeReach(userClub, state.leagues || []);
            const fenster = typeof transferEngine.fensterInfo === "function" ? transferEngine.fensterInfo(state) : null;
            reichweiteEl.innerHTML = (fenster
                    ? `<div class="tf-fenster ${fenster.offen ? "offen" : "zu"}">${fenster.offen ? "🟢" : "🔒"} ${this.escapeHtml(fenster.text)}</div>`
                    : "")
                + `🌍 <strong>Marktreichweite:</strong> ${this.escapeHtml(reich.text)}`
                + (ausserReichweite > 0
                    ? ` <span class="text-muted">(${ausserReichweite.toLocaleString("de-DE")} Spieler höherer Ligen sind für Sie außer Reichweite.)</span>`
                    : "");
        }

        if (searchVal) marketPlayers = marketPlayers.filter(p => p.name.toLowerCase().includes(searchVal));
        if (posVal !== "all") marketPlayers = marketPlayers.filter(p => p.pos === posVal);
        if (minStars > 0) {
            const engine = this.getRatingEngine();
            const grenze = engine ? engine.overallForStars(minStars, this.starContext()) : 0;
            marketPlayers = marketPlayers.filter(p => p.overall >= grenze);
        }

        marketPlayers.sort((a, b) => b.overall - a.overall);

        // Niemand liest viertausend Zeilen. Der Markt zeigt die besten
        // Treffer seitenweise - erst 30, auf Wunsch mehr. Vorher standen
        // 120 Zeilen untereinander, über zehntausend Pixel Seite.
        const TREFFER_PRO_SEITE = 30;
        const filterKey = `${searchVal}|${posVal}|${minStars}`;
        if (this._tfFilterKey !== filterKey) {
            this._tfFilterKey = filterKey;
            this._tfLimit = TREFFER_PRO_SEITE;
        }
        const limit = this._tfLimit || TREFFER_PRO_SEITE;
        const gesamtTreffer = marketPlayers.length;
        marketPlayers = marketPlayers.slice(0, limit);

        const ratingEngine = (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) ? PlayerRatingEngine : ((typeof window !== 'undefined' && window.PlayerRatingEngine) ? window.PlayerRatingEngine : null);

        const tbody = document.getElementById("transferTableBody");
        if (tbody && marketPlayers.length === 0) {
            // Sterne messen sich am eigenen Kader. Bei einem Spitzenverein
            // gibt es oberhalb von vier Sternen schlicht niemanden mehr -
            // das soll dastehen und nicht als leere Tabelle wirken.
            tbody.innerHTML = `<tr><td colspan="11" class="text-center text-muted" style="padding:22px;">
                Kein Spieler entspricht diesen Kriterien. Gemessen wird an Ihrem eigenen Kader –
                je stärker Ihre Mannschaft, desto seltener sind echte Verstärkungen.
            </td></tr>`;
        } else if (tbody) {
            tbody.innerHTML = marketPlayers.map(p => {
                const club = state.clubs.find(c => c.id === p.clubId);
                const card = ratingEngine ? ratingEngine.calculateVisiblePlayerCard(p, Object.assign({ userClubId: state.userClubId, leagueDataCoverage: 85 }, this.starContext())) : null;

                const sterne = card ? card.abilityStarsHtml : "";
                const roleDisplay = card?.bestRole?.role || "Allrounder";
                const abilityText = card ? card.abilityLabel : "Unbekannt";
                const valDisplay = card ? card.visibleValueText : this.formatMoneySafe(p.value);
                const confPercent = card ? card.confidence : (p.scoutingKnowledge?.knowledgeLevel || 30);
                const confBadgeClass = confPercent >= 70 ? "badge-success" : confPercent >= 40 ? "badge-warning" : "badge-danger";

                const confInfo = card?.confidenceInfo || { label: "Unbekannt", color: "#94a3b8", hint: "" };
                // Bei geringem Wissen ist auch die Marktwertschätzung nur eine Näherung
                const valueClass = card && !card.isPrecise ? "estimated-value" : "";

                const vereinsName = club ? this.escapeHtml(club.name) : "Ablösefrei";
                return `
                    <tr class="row-clickable" data-player-id="${p.id}" title="Details zu ${this.escapeHtml(p.name)} anzeigen">
                        <td class="tm-name">
                            <strong>${this.escapeHtml(p.name)}</strong>${this.signaturMarke(p)}
                            <span class="tm-sub">${this.escapeHtml(p.nationality || "Profi")} · ${p.age} J.</span>
                        </td>
                        <td class="tm-verein">${club ? vereinsName : '<span class="badge badge-success">Ablösefrei</span>'}</td>
                        <td class="tm-pos"><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span></td>
                        <td class="tm-alter">${p.age}</td>
                        <td class="tm-staerke nowrap">
                            ${sterne}
                            <div class="tm-sub">${abilityText}</div>
                        </td>
                        <td class="tm-rolle"><span class="badge badge-info">${roleDisplay}</span></td>
                        <td class="tm-wert nowrap"><strong class="${valueClass}">${valDisplay}</strong></td>
                        <td class="tm-wissen"><span class="badge ${confBadgeClass}" title="${confInfo.label}: ${confInfo.hint}">${confPercent}%</span></td>
                        <td class="tm-gehalt nowrap">${this.geldKurz(p.wage)}</td>
                        <td class="tm-vertrag nowrap">${p.clubId ? `${p.contractYears} J.` : "-"}</td>
                        <td class="tm-meta">${vereinsName} · ${valDisplay} · Scout ${confPercent} %</td>
                        <td class="tm-aktion">
                            <div class="tm-knoepfe">
                                ${(() => {
                                    const laeuft = this.beobachtungsText(p.id);
                                    return laeuft
                                        ? `<button class="btn btn-sm btn-secondary btn-scout-direct" data-player-id="${p.id}" disabled title="Der Scout beobachtet ihn - Bericht ${laeuft}"><svg class="ico" aria-hidden="true"><use href="#i-eye"/></svg><span class="tm-knopf-text"> ${laeuft}</span></button>`
                                        : `<button class="btn btn-sm btn-secondary btn-scout-direct" data-player-id="${p.id}" title="Scout zur Beobachtung schicken - der Bericht kommt nach einigen Tagen"><svg class="ico" aria-hidden="true"><use href="#i-search"/></svg><span class="tm-knopf-text"> Scouten</span></button>`;
                                })()}
                                <button class="btn btn-sm btn-primary btn-bid-player" data-player-id="${p.id}">Verhandeln</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");

            // Wie viele es wirklich gibt, gehört unter die Liste - und ein
            // Knopf, der die nächsten dreißig holt
            if (gesamtTreffer > marketPlayers.length) {
                tbody.innerHTML += `<tr class="tm-mehr-zeile"><td colspan="12" class="text-center text-muted" style="padding:14px;">
                    <div>Die ${marketPlayers.length} stärksten von ${gesamtTreffer.toLocaleString("de-DE")} passenden Spielern.</div>
                    <button class="btn btn-sm btn-secondary" id="btnTfMehr" style="margin-top:8px;">Weitere ${Math.min(TREFFER_PRO_SEITE, gesamtTreffer - marketPlayers.length)} anzeigen</button>
                </td></tr>`;
                const mehr = document.getElementById("btnTfMehr");
                if (mehr) mehr.onclick = () => {
                    this._tfLimit = (this._tfLimit || TREFFER_PRO_SEITE) + TREFFER_PRO_SEITE;
                    this.renderTransfers();
                };
            }

            // Klick auf die Zeile öffnet die Spielerdetails (Buttons ausgenommen)
            tbody.querySelectorAll("tr.row-clickable").forEach(row => {
                row.addEventListener("click", (e) => {
                    if (e.target.closest("button")) return;
                    const pId = this.resolvePlayerId(row.dataset.playerId);
                    if (pId !== null) this.showPlayerDetailsModal(pId);
                });
            });

            document.querySelectorAll(".btn-bid-player").forEach(btn => {
                btn.addEventListener("click", () => {
                    const pId = this.resolvePlayerId(btn.dataset.playerId);
                    this.showTransferOfferModal(pId);
                });
            });

            document.querySelectorAll(".btn-scout-direct").forEach(btn => {
                btn.addEventListener("click", () => {
                    const pId = this.resolvePlayerId(btn.dataset.playerId);
                    const scoutingEngine = (typeof ScoutingEngine !== 'undefined' && ScoutingEngine)
                        ? ScoutingEngine
                        : ((typeof window !== 'undefined' && window.ScoutingEngine) ? window.ScoutingEngine : null);

                    if (scoutingEngine) this.beobachte(pId, "transfer_market", () => this.renderTransfers());
                });
            });
        }

        // 3. Scouting Aufträge & Berichte
        const assignList = document.getElementById("scoutAssignmentsList");
        if (assignList) {
            const assignments = (state.scouting?.assignments || []).filter(a => a.status === "active");
            const beobachtungen = state.scouting?.beobachtungen || [];
            const beobachtungenHtml = beobachtungen.map(b => `
                    <div class="news-item-dash" style="justify-content: space-between;">
                        <div>👁 <strong>${this.escapeHtml(b.playerName)}</strong> <span class="scout-beobachtung">· ${this.escapeHtml(b.clubName)} · ${this.escapeHtml(b.scoutName)}</span></div>
                        <span class="header-tag" style="background:var(--accent-primary); color:#000;">⏳ Bericht in ${b.tageRest} Tag(en)</span>
                    </div>`).join("");
            if (assignments.length === 0 && beobachtungen.length === 0) {
                assignList.innerHTML = `<div class="empty-state-sm">Keine aktiven Scouting-Aufträge. Entsenden Sie oben einen Scout oder lassen Sie einen Spieler beobachten.</div>`;
            } else {
                assignList.innerHTML = beobachtungenHtml + assignments.map(a => `
                    <div class="news-item-dash" style="justify-content: space-between;">
                        <div>
                            🔭 <strong>Scout-Fokus:</strong> Position: ${a.position} | Alter bis: ${a.maxAge} | Mindestens ${this.starsFor(a.minOverall)}
                        </div>
                        <span class="header-tag" style="background:var(--accent-primary); color:#000;">⏳ Noch ${a.matchdaysRemaining} Spieltag(e)</span>
                    </div>
                `).join("");
            }
        }

        // Wer die Berichte schreibt - und wie viel man auf sie geben kann
        const stabInfo = document.getElementById("scoutStabInfo");
        const scoutingEng = (typeof ScoutingEngine !== 'undefined' && ScoutingEngine)
            ? ScoutingEngine
            : ((typeof window !== 'undefined' && window.ScoutingEngine) ? window.ScoutingEngine : null);
        if (stabInfo && scoutingEng && typeof scoutingEng.scoutInfo === "function") {
            const scout = scoutingEng.scoutInfo(state);
            const wirkung = scout.sterne >= 4 ? "Genaue Einschätzungen, ausführliche Berichte mit Charakter und Kadervergleich."
                : scout.sterne >= 3 ? "Verlässliche Berichte mit Kadervergleich, zum Charakter nur das Nötigste."
                : scout.sterne >= 2 ? "Brauchbare, aber knappe Berichte - die Sterne können eine Hälfte daneben liegen."
                : "Nur grobe Eindrücke. Ein eigener Chefscout würde viel mehr sehen.";
            stabInfo.innerHTML = `
                <div class="stab-info-kopf">
                    <span class="stab-info-titel">✍️ ${scout.eigen ? "Chefscout" : "Scouting ohne Chefscout"}</span>
                    <strong>${this.escapeHtml(scout.name)}</strong>
                    ${this.stabSterneHtml(scout.guete)}
                </div>
                <div class="stab-info-text">${wirkung}${scout.eigen ? "" : " Den Posten besetzen Sie in der Saisonvorbereitung."}</div>`;
        }

        const repList = document.getElementById("scoutReportsList");
        if (repList) {
            const reports = state.scouting?.reports || [];
            if (reports.length === 0) {
                repList.innerHTML = `<div class="empty-state-sm">Noch keine Scoutberichte eingetroffen.</div>`;
            } else {
                repList.innerHTML = reports.slice(0, 30).map(r => this.scoutBerichtHtml(r, state)).join("");

                repList.querySelectorAll(".btn-scout-bid").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const pId = this.resolvePlayerId(btn.dataset.playerId);
                        this.showTransferOfferModal(pId);
                    });
                });
                repList.querySelectorAll(".btn-scout-akte").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const pId = this.resolvePlayerId(btn.dataset.playerId);
                        if (pId !== null) this.showPlayerDetailsModal(pId);
                    });
                });
                repList.querySelectorAll(".btn-scout-weg").forEach(btn => {
                    btn.addEventListener("click", () => {
                        state.scouting.reports = (state.scouting.reports || []).filter(r => r.id !== btn.dataset.reportId);
                        this.renderTransfers();
                    });
                });
            }
        }
    },

    /** Güte eines Stabsmitglieds als Sternereihe, wie bei den Spielern */
    stabSterneHtml(guete) {
        const stab = (typeof CoachingStaffEngine !== 'undefined' && CoachingStaffEngine)
            ? CoachingStaffEngine
            : ((typeof window !== 'undefined' && window.CoachingStaffEngine) ? window.CoachingStaffEngine : null);
        const sterne = stab && typeof stab.sterne === "function"
            ? stab.sterne(guete)
            : Math.max(0.5, Math.min(5, Math.round((1 + ((Number(guete) || 50) - 25) / 18) * 2) / 2));
        const text = sterne.toFixed(1).replace(".", ",");
        const rating = (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine)
            ? PlayerRatingEngine
            : ((typeof window !== 'undefined' && window.PlayerRatingEngine) ? window.PlayerRatingEngine : null);
        const reihe = rating && typeof rating.renderAbilityStars === "function"
            ? rating.renderAbilityStars({ ca: sterne }, { compact: true, title: `${text} Sterne` })
            : `★ ${text}`;
        return `<span class="stab-sterne" title="${text} Sterne">${reihe}</span>`;
    },

    /**
     * Ein Scoutbericht als Karte: Sterne und Einordnung oben, Stärken und
     * Schwächen nebeneinander, darunter Charakter und wer ihn geschrieben hat.
     * Wie viel drinsteht, entscheidet die Engine nach den Sternen des Scouts.
     */
    scoutBerichtHtml(r, state) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const verein = (state.clubs || []).find(c => c.id === r.clubId);
        const zuv = r.zuverlaessigkeit || { label: "Unbekannt", farbe: "#94a3b8" };
        const empfKlasse = {
            "Top-Kaufempfehlung": "sb-empf-top",
            "Talent mit Perspektive": "sb-empf-talent",
            "Guter Transferkandidat": "sb-empf-gut",
            "Keine Verpflichtung empfohlen": "sb-empf-nein"
        }[r.recommendation] || "sb-empf-offen";
        const sterne = r.abilityStarsHtml || r.starsCaHtml || "";
        const scout = r.scout || { name: r.scoutName || "Scout", guete: null };
        const liste = (eintraege, klasse) => (eintraege || []).length
            ? `<ul class="${klasse}">${eintraege.map(e => `<li>${esc(e)}</li>`).join("")}</ul>`
            : "";
        return `
            <article class="scout-bericht">
                <header class="sb-kopf">
                    <div class="sb-name">
                        <strong>${esc(r.playerName)}</strong>
                        <span class="pos-tag pos-${this.getPosGroup(r.position)}">${esc(r.position)}</span>
                        <span class="sb-meta">${r.age} J. · ${verein ? esc(verein.name) : "vereinslos"}</span>
                    </div>
                    <span class="sb-zuv" style="--zuv:${zuv.farbe};" title="Wissensstand ${r.confidence} %">${esc(zuv.label)}</span>
                </header>
                <div class="sb-sterne">
                    ${sterne}
                    <span class="sb-label">${esc(String(r.abilityLabel || "").replace(/^ca\. /, ""))} · ${esc(r.potentialLabel || "")}</span>
                </div>
                <div class="sb-empf ${empfKlasse}">${esc(r.recommendation)}${r.kaderRolle ? ` <span class="sb-rolle">· ${esc(r.kaderRolle.text)}</span>` : ""}</div>
                <div class="sb-listen">
                    ${liste(r.strengths, "sb-plus")}
                    ${liste(r.weaknesses, "sb-minus")}
                </div>
                ${(r.hiddenTraits || []).length ? `<div class="sb-charakter">${r.hiddenTraits.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
                ${r.summary ? `<p class="sb-fazit">„${esc(r.summary)}“</p>` : ""}
                <footer class="sb-fuss">
                    <span class="sb-scout">✍️ ${esc(scout.name)} ${scout.guete != null ? this.stabSterneHtml(scout.guete) : ""}</span>
                    <span class="sb-wert">Marktwert ${esc(r.marketValueFormatted || "-")}</span>
                    <span class="sb-knoepfe">
                        <button class="btn btn-sm btn-secondary btn-scout-akte" data-player-id="${r.playerId}">Akte</button>
                        <button class="btn btn-sm btn-primary btn-scout-bid" data-player-id="${r.playerId}">Verhandeln</button>
                        <button class="btn btn-sm btn-secondary btn-scout-weg" data-report-id="${esc(r.id)}" title="Bericht ablegen">✕</button>
                    </span>
                </footer>
            </article>`;
    }
});
