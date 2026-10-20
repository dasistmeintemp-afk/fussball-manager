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
    /**
     * Springt zu einer laufenden Verhandlung: Transfermarkt öffnen, die Karte
     * in die Mitte holen und kurz hervorheben. Sind wir am Zug, steht der
     * Cursor gleich im ersten Feld.
     *
     * Vorher führte jeder Weg dorthin nur in den Reiter - die Verhandlung
     * musste man unter Angeboten und Markt selbst suchen.
     */
    zeigeVerhandlung(negId) {
        this.switchTab("transfers");
        document.getElementById("btnSubTransfersMarket")?.click();
        const karte = Array.from(document.querySelectorAll("[data-neg-card]"))
            .find(el => el.dataset.negCard === String(negId));
        if (!karte) return false;
        this.hebeHervor(karte);
        karte.querySelector("input")?.focus({ preventScroll: true });
        return true;
    },

    /** Ein Element in den Blick holen und kurz aufleuchten lassen */
    hebeHervor(el) {
        if (!el) return;
        // Was höher ist als der halbe Bildschirm, beginnt oben - sonst läge
        // sein Kopf mit dem Namen außer Sicht
        const hoehe = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect().height : 0;
        const fenster = (typeof window !== "undefined" && window.innerHeight) || 800;
        if (typeof el.scrollIntoView === "function") {
            el.scrollIntoView({ behavior: "smooth", block: hoehe > fenster * 0.5 ? "start" : "center" });
        }
        el.classList.remove("sprung-ziel");
        void el.offsetWidth;
        el.classList.add("sprung-ziel");
        setTimeout(() => el.classList.remove("sprung-ziel"), 2400);
    },

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
        const deadline = typeof engine.istDeadlineDay === "function" && engine.istDeadlineDay(state);

        // Schrittweite der Eingaben passend zum Betrag: in der Landesliga
        // geht ein Gehalt in Zehnern, in der Bundesliga in Tausendern
        const schritt = betrag => (typeof ContractEngine !== "undefined")
            ? ContractEngine.eingabeSchritt(betrag) : 100;
        list.innerHTML = offen.map(n => {
            const amZug = n.status === engine.STATUS.AWAITING_US;
            const istAblöse = n.stage === engine.STAGES.FEE;
            const restTage = Math.max(0, n.deadlineDay - heute);
            const geduldFarbe = n.patience >= 60 ? "#34d399" : n.patience >= 30 ? "#f59e0b" : "#f87171";

            const istLeihe = n.type === "leihe";
            const istFremd = n.type === "fremdtalent";
            const verein = this.escapeHtml(n.sellerClubName || "dem Verein");
            const phaseText = n.type === "youth_promotion"
                ? "Erstvertrag mit dem Berater"
                : istLeihe ? `Leihe von ${verein} bis zum Saisonende`
                : istFremd ? (istAblöse ? `Ausbildungsentschädigung mit ${verein}` : "Jugendvertrag: Gespräch mit der Familie")
                : (n.vorvertrag ? `Vorvertrag - ablösefrei von ${this.escapeHtml(n.sellerClubName || "seinem Verein")} zum Saisonwechsel`
                    : (istAblöse ? `Ablöse mit ${verein}` : "Persönliche Konditionen"));
            const beteiligte = istFremd ? `${this.escapeHtml(n.agentName)}` : `Berater ${this.escapeHtml(n.agentName)} (${this.escapeHtml(n.agentLabel || "")})`;

            const d = n.demand || {};
            const forderung = istLeihe
                ? `Forderung: <strong>${Math.round((d.lohnAnteil || 0) * 100)} %</strong> des Gehalts (${this.formatMoneySafe(Math.round((d.wage || 0) * (d.lohnAnteil || 0)))} / Woche)${d.gebuehr ? `, Leihgebühr ${this.formatMoneySafe(d.gebuehr)} für die Saison` : ", keine Leihgebühr"}, Einsatz als ${this.escapeHtml(engine.rolleText ? engine.rolleText(d.rolle) : d.rolle)}${d.rueckholrecht ? ", Rückholrecht" : ""}`
                : istFremd
                    ? (istAblöse ? `Forderung: <strong>${this.formatMoneySafe(d.fee)}</strong> Entschädigung`
                        : (d.signingBonus ? `Die Familie wünscht ein Handgeld von <strong>${this.formatMoneySafe(d.signingBonus)}</strong>` : "Die Familie hat noch keinen Wunsch geäußert"))
                : istAblöse
                ? `Forderung: <strong>${this.formatMoneySafe(n.demand.fee)}</strong> Ablöse`
                : `Forderung: <strong>${this.formatMoneySafe(n.demand.wage)}</strong> / Woche, Handgeld ${this.formatMoneySafe(n.demand.signingBonus)}${n.demand.agentFee ? `, Berater ${this.formatMoneySafe(n.demand.agentFee)}` : ""}`;
            const eilig = deadline && typeof engine.brauchtFenster === "function" && engine.brauchtFenster(n);

            const letzterEintrag = (n.log || [])[n.log.length - 1];

            const fin = typeof FinanceEngine !== "undefined" && FinanceEngine.ZAHLWEISEN ? FinanceEngine : null;
            const letzteZahlweise = n.lastOffer?.zahlweise || "sofort";
            const zahlweise = fin ? `
                    <label>Zahlweise
                        <select class="styled-select neg-zahlweise" data-neg-id="${n.id}">
                            ${Object.entries(fin.ZAHLWEISEN).map(([key, z]) => `<option value="${key}" ${key === letzteZahlweise ? "selected" : ""}>${this.escapeHtml(z.label)}${z.monate ? ` (${Math.round(z.anzahlung * 100)} % sofort)` : ""}</option>`).join("")}
                        </select>
                    </label>
                    <p class="neg-hinweis neg-raten-info" data-neg-id="${n.id}"></p>` : "";
            const talent = istFremd && typeof YouthEngine !== "undefined" ? YouthEngine.fremdeTalente(state).find(t => String(t.id) === String(n.prospectId)) : null;
            const sommer = istLeihe && typeof TransferEngine !== "undefined" && TransferEngine.fensterInfo?.(state)?.art === "sommer";
            const eingabe = !amZug ? "" : istLeihe ? `
                <div class="negotiation-inputs">
                    <label>Gehaltsanteil (%)
                        <input type="number" class="styled-input neg-anteil" data-neg-id="${n.id}" value="${Math.round((d.lohnAnteil || 0) * 100)}" step="5" min="0" max="100">
                    </label>
                    <label>Leihgebühr (€)
                        <input type="number" class="styled-input neg-gebuehr" data-neg-id="${n.id}" value="${d.gebuehr || 0}" step="${schritt(d.gebuehr || 10000)}" min="0">
                    </label>
                    <label>Einsatzzusage
                        <select class="styled-select neg-rolle" data-neg-id="${n.id}">
                            ${["Stammspieler", "Rotation", "Talent"].map(r => `<option value="${r}" ${r === d.rolle ? "selected" : ""}>${r === "Talent" ? "Keine Zusage (zum Lernen)" : r}</option>`).join("")}
                        </select>
                    </label>
                    ${sommer ? `<label>Dauer
                        <select class="styled-select neg-dauer" data-neg-id="${n.id}">
                            <option value="saison">Bis zum Saisonende</option>
                            <option value="winter">Bis zur Winterpause (halbe Gebühr)</option>
                        </select>
                    </label>` : ""}
                    <label class="neg-check"><input type="checkbox" class="neg-rueckholrecht" data-neg-id="${n.id}" ${d.rueckholrecht ? "checked" : ""}> Rückholrecht für ${this.escapeHtml(n.sellerClubName || "den Stammverein")}: Spielt er nicht, holt er ihn im Winter zurück</label>
                    ${d.kaufoption ? `<label class="neg-check"><input type="checkbox" class="neg-kaufoption" data-neg-id="${n.id}"> Kaufoption für ${this.geldKurz(d.kaufoption)} (Aufschlag ${this.geldKurz(d.optionsAufschlag || 0)} auf die Gebühr)</label>` : ""}
                    <p class="neg-hinweis">Wer bei Ihnen Stammspieler wäre, will das zugesagt bekommen. Spielt er dann zu wenig, beschwert sich sein Verein. Ohne das verlangte Rückholrecht muss das Angebot höher sein.</p>
                </div>`
                : istFremd ? (istAblöse ? `
                <div class="negotiation-inputs">
                    <label>Entschädigung (€)
                        <input type="number" class="styled-input neg-fee" data-neg-id="${n.id}" value="${d.fee}" step="${schritt(d.fee)}" min="0">
                    </label>
                </div>` : `
                <div class="negotiation-inputs">
                    <label>Handgeld für die Familie (€)
                        <input type="number" class="styled-input neg-bonus" data-neg-id="${n.id}" value="${d.signingBonus || 0}" step="${schritt(d.signingBonus || 1000)}" min="0">
                    </label>
                    <label class="neg-check"><input type="checkbox" class="neg-perspektive" data-neg-id="${n.id}" ${talent && (talent.age || 0) < (YouthEngine.MIT_PROFIS?.abAlter || 16) ? "disabled" : ""}> Zusage: trainiert mit den Profis${talent && (talent.age || 0) < (YouthEngine.MIT_PROFIS?.abAlter || 16) ? ` (erst ab ${YouthEngine.MIT_PROFIS.abAlter})` : ""}</label>
                    <p class="neg-hinweis">Die Familie wägt unseren Ruf gegen den seines Vereins ab. Ein Handgeld oder eine Perspektive bei den Profis hilft.</p>
                </div>`)
                : (istAblöse ? `
                <div class="negotiation-inputs">
                    <label>Ablöse (€)
                        <input type="number" class="styled-input neg-fee" data-neg-id="${n.id}" value="${n.demand.fee}" step="${schritt(n.demand.fee)}" min="0">
                    </label>
                    ${n.vorvertrag ? "" : zahlweise}
                </div>
            ` : `
                <div class="negotiation-inputs">
                    <label>Gehalt (€ / Woche)
                        <input type="number" class="styled-input neg-wage" data-neg-id="${n.id}" value="${n.demand.wage}" step="${schritt(n.demand.wage)}" min="0">
                    </label>
                    <label>Laufzeit
                        <select class="styled-select neg-years" data-neg-id="${n.id}">
                            ${[1, 2, 3, 4, 5].filter(j => j <= (typeof engine.maxJahre === "function" ? engine.maxJahre(state, n) : 5)).map(j => `<option value="${j}" ${j === (n.demand.years || 3) ? "selected" : ""}>${j} Jahr${j > 1 ? "e" : ""}</option>`).join("")}
                        </select>
                    </label>
                    <label>Handgeld (€)
                        <input type="number" class="styled-input neg-bonus" data-neg-id="${n.id}" value="${n.demand.signingBonus}" step="${schritt(n.demand.signingBonus)}" min="0">
                    </label>
                    <label>Beraterhonorar (€)
                        <input type="number" class="styled-input neg-berater" data-neg-id="${n.id}" value="${n.demand.agentFee || 0}" step="${schritt(n.demand.agentFee)}" min="0">
                    </label>
                    <label>Einsatzprämie (€ / Spiel)
                        <input type="number" class="styled-input neg-einsatz" data-neg-id="${n.id}" value="0" step="${schritt(n.demand.wage)}" min="0">
                    </label>
                    <label>Torprämie (€ / Tor)
                        <input type="number" class="styled-input neg-tor" data-neg-id="${n.id}" value="0" step="${schritt(n.demand.wage)}" min="0">
                    </label>
                    <p class="neg-hinweis">Prämien ersetzen einen Teil des Grundgehalts. Der Spieler rechnet sie mit Abschlag ein und bekommt sie nur, wenn er spielt oder trifft.</p>
                    ${this.klauselFelder(state.clubs.find(c => c.id === n.clubId), state.players.find(p => String(p.id) === String(n.playerId)))}
                </div>
            `);

            return `
                <div class="negotiation-card ${amZug ? "our-turn" : ""}" data-neg-card="${this.escapeHtml(n.id)}">
                    <div class="negotiation-head">
                        <div>
                            <strong>${this.escapeHtml(n.playerName)}</strong>
                            <span class="text-muted" style="font-size:12px;">(${this.escapeHtml(n.playerPos || "")})</span>
                            <div style="font-size:12px; color:var(--text-muted);">
                                ${phaseText} · ${beteiligte}
                            </div>
                        </div>
                        <span class="badge ${amZug ? "badge-warning" : "badge-info"}">${this.escapeHtml(engine.describe(n))}</span>
                    </div>

                    <div class="negotiation-meta">
                        <span>${forderung}</span>
                        <span>Geduld: <strong style="color:${geduldFarbe};">${n.patience}%</strong></span>
                        <span>${eilig ? `<strong class="neg-deadline">⏰ Deadline Day: Antwort sofort, heute Abend ist Schluss</strong>` : `Frist: noch <strong>${restTage}</strong> Tage`}</span>
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

        // Raten: Anzahlung und Monatsrate gleich beim Tippen, dazu der Abschlag des Verkäufers
        const ratenVorschau = (id) => {
            const fin = typeof FinanceEngine !== "undefined" ? FinanceEngine : null;
            const info = list.querySelector(`.neg-raten-info[data-neg-id="${id}"]`);
            if (!fin || !info) return;
            const fee = Number(list.querySelector(`.neg-fee[data-neg-id="${id}"]`)?.value || 0);
            const zw = list.querySelector(`.neg-zahlweise[data-neg-id="${id}"]`)?.value || "sofort";
            const n = engine.findNegotiation(state, id);
            const verkaeufer = n ? state.clubs.find(c => c.id === n.sellerClubId) : null;
            if (zw === "sofort" || !fee) {
                info.textContent = "In Raten muss nur die Anzahlung ins Transferbudget passen. Der Verkäufer rechnet Raten mit Abschlag.";
                return;
            }
            const wert = fin.ratenWert(fee, zw, verkaeufer);
            info.textContent = `${fin.ratenText(fee, zw)}. Für ${n?.sellerClubName || "den Verkäufer"} ist das so viel wert wie ${this.formatMoneySafe(wert)} sofort`
                + (fin.istKnapp(verkaeufer, fee) ? " - er braucht das Geld dringend." : ".");
        };
        list.querySelectorAll(".neg-zahlweise, .neg-fee").forEach(el => {
            const id = el.dataset.negId;
            el.addEventListener("input", () => ratenVorschau(id));
            el.addEventListener("change", () => ratenVorschau(id));
            ratenVorschau(id);
        });

        // Was die Klauseln dem Spieler wert sind - beim Ändern gleich sichtbar
        list.querySelectorAll(".negotiation-card .klausel-felder").forEach(felder => {
            const karte = felder.closest(".negotiation-card");
            const n = engine.findNegotiation(state, karte?.dataset.negCard);
            if (!n || typeof KlauselEngine === "undefined") return;
            const club = state.clubs.find(c => c.id === n.clubId);
            const neu = () => this.klauselWertText(felder, KlauselEngine.faktor(this.leseKlauseln(felder),
                Number(karte.querySelector(".neg-years")?.value || 3), club));
            felder.querySelectorAll("select, input").forEach(el => el.addEventListener("change", neu));
            karte.querySelector(".neg-years")?.addEventListener("change", neu);
        });

        list.querySelectorAll(".btn-neg-submit").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.negId;
                const n = engine.findNegotiation(state, id);
                if (!n) return;

                const feld = (klasse) => list.querySelector(`.${klasse}[data-neg-id="${id}"]`);
                const angebot = n.type === "leihe" ? {
                        lohnAnteil: Number(feld("neg-anteil")?.value || 0) / 100,
                        gebuehr: Number(feld("neg-gebuehr")?.value || 0),
                        rolle: feld("neg-rolle")?.value,
                        kaufoption: !!feld("neg-kaufoption")?.checked,
                        dauer: feld("neg-dauer")?.value || "saison",
                        rueckholrecht: !!feld("neg-rueckholrecht")?.checked
                    }
                    : (n.type === "fremdtalent" && n.stage === engine.STAGES.TERMS) ? {
                        signingBonus: Number(feld("neg-bonus")?.value || 0),
                        perspektive: !!feld("neg-perspektive")?.checked
                    }
                    : n.stage === engine.STAGES.FEE
                    ? {
                        fee: Number(list.querySelector(`.neg-fee[data-neg-id="${id}"]`)?.value || 0),
                        zahlweise: list.querySelector(`.neg-zahlweise[data-neg-id="${id}"]`)?.value || "sofort"
                    }
                    : {
                        wage: Number(list.querySelector(`.neg-wage[data-neg-id="${id}"]`)?.value || 0),
                        years: Number(list.querySelector(`.neg-years[data-neg-id="${id}"]`)?.value || 3),
                        signingBonus: Number(list.querySelector(`.neg-bonus[data-neg-id="${id}"]`)?.value || 0),
                        agentFee: Number(list.querySelector(`.neg-berater[data-neg-id="${id}"]`)?.value || 0),
                        einsatzPraemie: Number(list.querySelector(`.neg-einsatz[data-neg-id="${id}"]`)?.value || 0),
                        torPraemie: Number(list.querySelector(`.neg-tor[data-neg-id="${id}"]`)?.value || 0),
                        klauseln: this.leseKlauseln(btn.closest(".negotiation-card")?.querySelector(".klausel-felder"))
                    };

                const res = engine.submitOffer(state, id, angebot);
                if (res.success) {
                    this.playSound(res.sofort && n.status === engine.STATUS.ACCEPTED ? "erfolg" : "click");
                    this.showToast(res.message || "Angebot abgegeben.", n.status === engine.STATUS.REJECTED ? "warning" : "success", res.sofort ? 7000 : 4000);
                    if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                    // Am Deadline Day kann der Wechsel schon durch sein: Kader, Geld und Leihen neu
                    if (res.sofort) { this.renderHeader?.(); this.renderTransfers(); } else this.renderNegotiations();
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
        // Leihangebote für eigene Spieler und wer auf der Leihliste steht
        const gelistet = state.players.filter(p => p.clubId === state.userClubId && p.leihListe);
        const angebote = typeof engine.offeneLeihangebote === "function" ? engine.offeneLeihangebote(state) : [];
        const angeboteKarte = document.getElementById("loansAngeboteKarte");
        const angeboteBox = document.getElementById("loansAngebote");
        if (angeboteKarte && angeboteBox) {
            angeboteKarte.hidden = !angebote.length && !gelistet.length;
            const ohne = gelistet.filter(p => !angebote.some(a => String(a.playerId) === String(p.id)));
            angeboteBox.innerHTML = angebote.map(a => this.leihangebotHtml(a, true)).join("")
                + (ohne.length ? `<div class="text-muted la-warten">Auf der Leihliste, noch ohne Angebot: ${ohne.map(p => esc(p.name)).join(", ")}</div>` : "");
            const angeboteMeta = document.getElementById("loansAngeboteMeta");
            if (angeboteMeta) angeboteMeta.textContent = `${angebote.length} Angebot${angebote.length === 1 ? "" : "e"} · ${gelistet.length} auf der Leihliste`;
            this.bindeLeihangebote(angeboteBox, () => { this.renderLeihen(); this.renderHeader?.(); });
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
                    `Verliehen an <strong>${esc(club(l.leihvereinId)?.name || "?")}</strong> (${esc(l.rolle)}) ${l.bisWinter ? "bis zur Winterpause" : "bis Saisonende"} · ${spiele} Spiele${spiele ? `, Note ${(noten / spiele).toFixed(2).replace(".", ",")}` : ""} · Spielpraxis ${Math.round((p.spielpraxis ?? 0.5) * 100)} %${l.rueckholrecht === false ? " · ohne Rückholrecht" : ""}`,
                    l.rueckholrecht === false ? "" : `<button class="btn btn-sm btn-secondary" data-leihe-zurueck="${esc(p.id)}">Zurückholen</button>`);
            }),
            ...geliehen.map(p => {
                const l = p.leihe;
                return zeile(p, `Geliehen von <strong>${esc(club(l.stammvereinId)?.name || "?")}</strong> ${l.bisWinter ? "bis zur Winterpause" : "bis Saisonende"} · Sie zahlen ${Math.round(l.lohnAnteil * 100)} % des Gehalts · erwartet: ${esc(l.rolle)}${l.rueckholrecht ? " · Rückholrecht des Stammvereins" : ""}${l.kaufoption ? ` · Kaufoption ${this.geldKurz(l.kaufoption)}` : ""}`,
                    l.kaufoption ? `<button class="btn btn-sm btn-primary" data-kaufoption-ziehen="${esc(p.id)}">Kaufoption ziehen</button>` : "");
            })
        ].join("") : `<div class="text-muted" style="font-size:13px;">Keine laufenden Leihen.</div>`;

        const ratingEngine = this.getRatingEngine();
        // Filter: Mannschaftsteil, Alter, Stärke nach Einschätzung, Rolle, Kosten
        const wert = (id) => document.getElementById(id)?.value || "";
        const lmPos = wert("lmPosFilter"), lmAlter = wert("lmAlterFilter"), lmRolle = wert("lmRolleFilter"), lmKosten = wert("lmKostenFilter");
        const lmSterne = parseFloat(wert("lmStaerkeFilter") || "0");
        const kaderLoehne = state.players.filter(p => p.clubId === state.userClubId).map(p => p.wage || 0);
        const lohnSchnitt = kaderLoehne.length ? kaderLoehne.reduce((a, b) => a + b, 0) / kaderLoehne.length : 0;
        const grenze = lmSterne > 0 && ratingEngine ? ratingEngine.overallForStars(lmSterne, this.starContext()) : 0;
        const [alterVon, alterBis] = lmAlter ? lmAlter.split("-").map(Number) : [0, 99];
        const alle = engine.leihmarkt(state, Infinity);
        const gefiltert = alle.filter(e => (!lmPos || this.positionsGruppe(e.pos) === lmPos)
            && (e.age || 0) >= alterVon && (e.age || 0) <= alterBis
            && (!lmRolle || e.rolle === lmRolle)
            && (lmKosten !== "ohne" || !e.gebuehr)
            && (lmKosten !== "schnitt" || e.wage * e.lohnAnteil <= lohnSchnitt)
            && (!grenze || (e.geschaetzt || 0) >= grenze));
        const lmKey = [lmPos, lmAlter, lmRolle, lmKosten, lmSterne].join("|");
        if (this._lmKey !== lmKey) { this._lmKey = lmKey; this._lmLimit = 30; }
        const liste = gefiltert.slice(0, this._lmLimit || 30);
        const lmMeta = document.getElementById("loanMarketMeta");
        if (lmMeta) lmMeta.textContent = gefiltert.length === alle.length ? `${alle.length} Spieler` : `${gefiltert.length} von ${alle.length} Spielern`;
        const ne = this.getNegotiationEngine();
        const offen = ne ? ne.getOpenNegotiations(state).filter(n => n.type === "leihe") : [];
        markt.innerHTML = liste.length ? liste.map(e => {
            const p = state.players.find(q => String(q.id) === String(e.playerId));
            const card = ratingEngine && p ? ratingEngine.calculateVisiblePlayerCard(p, Object.assign({ userClubId: state.userClubId, leagueDataCoverage: 85 }, this.starContext())) : null;
            const laeuft = offen.find(n => String(n.playerId) === String(e.playerId));
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
                    <td class="leih-option" title="Aufschlag ${esc(this.geldKurz(e.optionsAufschlag))} auf die Leihgebühr">${this.geldKurz(e.kaufoption)}</td>
                    <td>${laeuft
                        ? `<button class="btn btn-sm btn-secondary" data-leih-verhandlung="${esc(laeuft.id)}">Verhandlung</button>`
                        : `<button class="btn btn-sm btn-primary" data-ausleihen="${esc(e.playerId)}" ${fenster && !fenster.offen ? `disabled title="${esc(fenster.text)}"` : ""}>Anfragen</button>`}</td>
                </tr>`;
        }).join("") + (gefiltert.length > liste.length ? `<tr><td colspan="10" class="text-center"><button class="btn btn-sm btn-secondary" id="btnLmMehr">${Math.min(30, gefiltert.length - liste.length)} weitere anzeigen</button></td></tr>` : "")
            : `<tr><td colspan="10" class="text-center text-muted">${alle.length ? "Kein Leihspieler passt zu diesen Filtern." : "Gerade gibt kein Verein einen passenden Spieler ab."}</td></tr>`;
        markt.querySelector("#btnLmMehr")?.addEventListener("click", (ev) => { ev.stopPropagation(); this._lmLimit = (this._lmLimit || 30) + 30; this.renderLeihen(); });

        const neuZeichnen = () => {
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderLeihen();
            this.renderHeader?.();
        };
        eigene.querySelectorAll("[data-kaufoption-ziehen]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const res = engine.zieheKaufoption(state, btn.dataset.kaufoptionZiehen);
            this.showToast(res.success ? `Fest verpflichtet für ${this.geldKurz(res.preis)}.` : res.error, res.success ? "success" : "error", 5000);
            if (res.success) { this.playSound("erfolg"); neuZeichnen(); }
        }));
        eigene.querySelectorAll("[data-leihe-zurueck]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const res = engine.zurueckholen(state, btn.dataset.leiheZurueck);
            this.showToast(res.success ? "Er kehrt zurück." : res.error, res.success ? "success" : "error");
            if (res.success) neuZeichnen();
        }));
        // Leihen ist kein Knopfdruck: Die Anfrage eröffnet eine Verhandlung mit dem Stammverein
        markt.querySelectorAll("[data-ausleihen]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this.leiheAnfragen(btn.dataset.ausleihen);
        }));
        markt.querySelectorAll("[data-leih-verhandlung]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this.zeigeVerhandlung(btn.dataset.leihVerhandlung);
        }));
        [...eigene.querySelectorAll(".leih-zeile"), ...markt.querySelectorAll("tr[data-player-id]")].forEach(el => el.addEventListener("click", () => {
            const ziel = state.players.find(p => String(p.id) === el.dataset.playerId);
            if (ziel) this.showPlayerDetailsModal(ziel.id);
        }));
    },

    /** "mindestens 50 % des Gehalts, mindestens Rotation, bis zum Saisonende, mit Rückholrecht" */
    leihBedingungenText(l) {
        return [
            l.minAnteil > 0 ? `mindestens ${Math.round(l.minAnteil * 100)} % des Gehalts` : "Gehaltsanteil egal",
            l.einsatz === "Stammspieler" ? "als Stammspieler" : (l.einsatz === "Rotation" ? "mindestens Rotation" : "Einsatz egal"),
            l.dauer === "winter" ? "bis zur Winterpause" : "bis zum Saisonende",
            l.rueckholrecht ? "mit Rückholrecht" : "ohne Rückholrecht"
        ].join(", ");
    },

    /** Ein Leihangebot für einen eigenen Spieler - mit Annehmen, Mehr fordern, Ablehnen */
    leihangebotHtml(a, mitName = false) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const rest = Math.max(0, a.frist - (this.app.state.currentDayIndex || 0));
        const pct = Math.round(a.lohnAnteil * 100);
        const kopf = `${mitName ? `<button type="button" class="btn-link la-spieler" data-player-id="${esc(a.playerId)}">${esc(a.playerName)}</button> · ` : ""}<strong>${esc(a.clubName)}</strong> <span class="text-muted">Liga ${a.stufe}</span> <span class="badge badge-info">${esc(a.rolle)}</span>`;
        const text = `${pct} % des Gehalts${a.gebuehr ? ` · Leihgebühr ${this.geldKurz(a.gebuehr)}` : ""}${a.kaufoption ? ` · Kaufoption ${this.geldKurz(a.kaufoption)}` : ""} · ${a.dauer === "winter" ? "bis zur Winterpause" : "bis zum Saisonende"}${a.rueckholrecht ? " · mit Rückholrecht" : ""}`;
        if (a.status === "zugesagt") {
            return `<div class="leih-angebot" data-leih-angebot="${esc(a.id)}"><div class="la-kopf">${kopf}</div><div class="la-text">${text}</div>
                <div class="la-status">Angenommen - ${esc(a.playerName)} entscheidet sich bis morgen.</div></div>`;
        }
        return `<div class="leih-angebot" data-leih-angebot="${esc(a.id)}">
            <div class="la-kopf">${kopf}</div>
            <div class="la-text">${text} · <span class="text-muted">${rest === 0 ? "läuft heute ab" : `noch ${rest} Tag${rest === 1 ? "" : "e"}`}</span></div>
            <div class="la-knoepfe">
                <button class="btn btn-sm btn-primary" data-la-annehmen="${esc(a.id)}">Annehmen</button>
                ${a.nachgebessert || pct >= 100 ? "" : `<span class="la-mehr"><input type="number" class="styled-input la-anteil" data-la-id="${esc(a.id)}" value="${Math.min(100, pct + 10)}" min="${Math.min(100, pct + 5)}" max="100" step="5" aria-label="Geforderter Gehaltsanteil in Prozent"> %
                    <button class="btn btn-sm btn-secondary" data-la-mehr="${esc(a.id)}">Mehr fordern</button></span>`}
                <button class="btn btn-sm btn-secondary" data-la-ablehnen="${esc(a.id)}">Ablehnen</button>
            </div>
        </div>`;
    },

    /** Die Knöpfe der Leihangebote - in der Akte wie im Unterreiter Leihen */
    bindeLeihangebote(box, nachher) {
        const engine = this.getLoanEngine();
        const state = this.app.state;
        if (!box || !engine) return;
        const fertig = (text, art = "success") => {
            this.showToast(text, art, 6000);
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            if (typeof nachher === "function") nachher();
        };
        box.querySelectorAll("[data-la-annehmen]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const res = engine.leihangebotAnnehmen(state, btn.dataset.laAnnehmen);
            if (!res.success) return this.showToast(res.error, "error", 5000);
            if (res.perfekt) { this.playSound("erfolg"); return fertig(`${res.angebot.playerName} ist an ${res.angebot.clubName} verliehen.`); }
            if (res.spielerNein) return fertig(res.grund, "warning");
            this.playSound("click");
            fertig(`Angenommen. ${res.angebot.playerName} entscheidet sich bis morgen.`);
        }));
        box.querySelectorAll("[data-la-mehr]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const id = btn.dataset.laMehr;
            const feld = box.querySelector(`.la-anteil[data-la-id="${id}"]`);
            const res = engine.leihangebotMehrFordern(state, id, Number(feld?.value || 0) / 100);
            if (res.status === "fehler") return this.showToast(res.text, "error");
            fertig(res.text, res.status === "zurueckgezogen" ? "warning" : "success");
        }));
        box.querySelectorAll("[data-la-ablehnen]").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const res = engine.leihangebotAblehnen(state, btn.dataset.laAblehnen);
            if (!res.success) return this.showToast(res.error, "error");
            fertig(`Abgelehnt. ${res.angebot.clubName} bietet für ${res.angebot.playerName} nicht noch einmal.`, "warning");
        }));
        box.querySelectorAll(".la-spieler").forEach(btn => btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this.showPlayerDetailsModal(btn.dataset.playerId);
        }));
    },

    /** Eine Leihe anfragen: Verhandlung mit dem Stammverein eröffnen und dorthin springen */
    leiheAnfragen(playerId) {
        const state = this.app.state;
        const ne = this.getNegotiationEngine();
        const res = ne && typeof ne.startLeihVerhandlung === "function" ? ne.startLeihVerhandlung(state, playerId) : { success: false, error: "Leihen sind nicht verfügbar." };
        if (!res.success && !res.negotiation) { this.showToast(res.error, "error", 5000); return null; }
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        if (res.success) {
            this.playSound("click");
            this.showToast(`Anfrage an ${res.negotiation.sellerClubName}. Jetzt sind Sie mit Ihrem Leihangebot am Zug.`, "success", 5000);
        }
        const modal = document.getElementById("modalPlayerDetails");
        if (modal) modal.style.display = "none";
        this.zeigeVerhandlung(res.negotiation.id);
        return res.negotiation;
    },

    /** Mannschaftsteil einer Position - für die Filter */
    positionsGruppe(pos) {
        if (pos === "TW") return "tw";
        if (["IV", "LV", "RV"].includes(pos)) return "abw";
        if (["LA", "RA", "ST"].includes(pos)) return "st";
        return "mf";
    },

    /** U23 und U19 in der Spielerakte: hinunterschicken, zurückholen, die Bilanz unten */
    reserveHtml(player) {
        const engine = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        if (!engine) return "";
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const praxis = Math.round((player.spielpraxis ?? 0.5) * 100);
        const bilanz = this.unterbauBilanzText(player);
        const kopf = `<h4 class="gs-titel"><svg class="ico" aria-hidden="true"><use href="#i-users"/></svg> Unterbau: U23 und U19</h4>`;
        if (player.nominiertAus) {
            const team = player.nominiertAus === engine.U19 ? "U19" : "U23";
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">Für den nächsten Spieltag aus der ${team} hochgeholt - nach dem Ligaspiel geht er zurück.</div>
                    ${bilanz ? `<div class="gs-sub">${esc(bilanz)}</div>` : ""}
                    <div class="gs-knoepfe">
                        <button class="btn btn-secondary" id="btnPdReserve">Ganz bei den Profis behalten</button>
                        <button class="btn btn-secondary" id="btnPdNominiertZurueck">Sofort zurück in die ${team}</button>
                    </div>
                </div>`;
        }
        if (player.reserve) {
            const team = engine.inU19(player) ? "U19" : "U23";
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">Spielt in der ${team} und steht den Profis nicht zur Verfügung · Spielpraxis ${praxis} %</div>
                    ${bilanz ? `<div class="gs-sub">${esc(bilanz)}</div>` : ""}
                    <div class="gs-knoepfe">
                        <button class="btn btn-primary" id="btnPdNominieren" title="Danach geht er von selbst zurück in die ${team}">Für den nächsten Spieltag</button>
                        <button class="btn btn-secondary" id="btnPdReserve">Ganz zu den Profis</button>
                    </div>
                </div>`;
        }
        const check = engine.pruefe(state, player);
        const checkU19 = typeof engine.pruefeU19 === "function" ? engine.pruefeU19(state, player) : { ok: false };
        const u19Moeglich = (player.age || 30) <= (typeof YouthEngine !== "undefined" ? YouthEngine.AKADEMIE_HOECHSTALTER : 19);
        return `
            <div class="dash-card mb-3 gs-karte">${kopf}
                <div class="gs-sub">In der U23${u19Moeglich ? " oder U19" : ""} spielt er an jedem Spieltag und sammelt Spielpraxis (jetzt ${praxis} %). Für die Profis fehlt er, bis Sie ihn zurückholen.</div>
                ${bilanz ? `<div class="gs-sub">${esc(bilanz)}</div>` : ""}
                <div class="gs-knoepfe">
                    ${check.ok ? `<button class="btn btn-secondary" id="btnPdReserve">In die U23 schicken</button>` : `<div class="gs-lage">${esc(check.grund)}</div>`}
                    ${u19Moeglich ? (checkU19.ok ? `<button class="btn btn-secondary" id="btnPdU19">In die U19 schicken</button>` : `<div class="gs-lage">${esc(checkU19.grund || "")}</div>`) : ""}
                </div>
            </div>`;
    },

    /** "U23: 6 Spiele · 2 Tore · Ø 6,9 · Form 7,3" - für U23 und U19, was er diese Saison hat */
    unterbauBilanzText(p) {
        const engine = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        if (!engine || typeof engine.bilanz !== "function") return "";
        const saison = this.app.state.seasonYear || 1;
        const z = (x) => String(x.toFixed(1)).replace(".", ",");
        return [["u23", "U23"], ["u19", "U19"]].map(([feld, team]) => {
            const b = engine.bilanz(p, feld, saison);
            return b ? `${team}: ${b.spiele} ${b.spiele === 1 ? "Spiel" : "Spiele"} · ${b.tore} ${b.tore === 1 ? "Tor" : "Tore"} · Ø ${z(b.schnitt)} · Form ${z(b.form)}` : "";
        }).filter(Boolean).join(" | ");
    },

    /** Spiele, Tore, Schnitt und Form als Tabellenzellen */
    unterbauZellen(p, feld) {
        const engine = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        const b = engine && typeof engine.bilanz === "function" ? engine.bilanz(p, feld, this.app.state.seasonYear || 1) : null;
        const z = (x) => String(x.toFixed(1)).replace(".", ",");
        const inForm = b && b.spiele >= 3 && b.form >= (engine.IN_FORM || 7.2);
        return b
            ? `<td>${b.spiele}</td><td>${b.tore}</td><td>${z(b.schnitt)}</td><td class="${inForm ? "u-form-top" : ""}">${z(b.form)}${inForm ? " ⭐" : ""}</td>`
            : `<td>-</td><td>-</td><td>-</td><td>-</td>`;
    },

    /**
     * Der Unterbau im Kader-Reiter: die U23 mit ihrer Bilanz und die
     * Kandidaten aus der U19 - jeder mit dem Knopf zu den Profis.
     */
    renderReserve() {
        const box = document.getElementById("squadReserve");
        const engine = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        if (!box || !engine) return;
        const state = this.app.state;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const spieler = engine.spieler(state, club).sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const mgr = typeof ManagerEngine !== "undefined" ? ManagerEngine : null;
        const u19 = mgr && typeof mgr.unterbauKandidaten === "function"
            ? mgr.unterbauKandidaten(state, club).filter(k => k.team === "U19").slice(0, 6) : [];
        const b = club?.reserveBilanz;
        if (!spieler.length && !b && !u19.length && !state.players.some(p => p.clubId === club.id && p.nominiertAus)) { box.style.display = "none"; box.innerHTML = ""; return; }
        box.style.display = "";
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const letzte = (b?.letzte || []).map(e => {
            const klasse = e.tore > e.gegentore ? "s" : (e.tore === e.gegentore ? "u" : "n");
            return `<span class="u23-ergebnis u23-${klasse}" title="Spieltag ${e.matchday}${e.schuetzen.length ? " · Tore: " + esc(e.schuetzen.join(", ")) : ""}">${e.tore}:${e.gegentore}</span>`;
        }).join("");
        const verletzt = (p) => (p.injuredWeeks || 0) > 0 ? ' <span class="text-danger">verletzt</span>' : "";
        // Wer nur für den Spieltag oben ist
        const nominiert = state.players.filter(p => p.clubId === club.id && p.nominiertAus);
        const nominiertHtml = nominiert.length ? `
            <div class="unterbau-nominiert">
                <strong>Für den nächsten Spieltag oben:</strong>
                ${nominiert.map(p => `<div class="unterbau-nom"><span>${esc(p.name)} <span class="text-muted">aus der ${p.nominiertAus === engine.U19 ? "U19" : "U23"}</span></span>
                    <span class="unterbau-knoepfe"><button class="btn btn-sm btn-secondary btn-nominiert-zurueck" data-id="${esc(p.id)}">Zurück</button>
                    <button class="btn btn-sm btn-secondary btn-unterbau-hoch" data-id="${esc(p.id)}">Behalten</button></span></div>`).join("")}
                <small class="text-muted">Nach dem nächsten Ligaspiel gehen sie von selbst zurück.</small>
            </div>` : "";
        const knoepfe = (hoch, nom) => `<div class="unterbau-knoepfe">${nom}${hoch}</div>`;
        const kopfZeile = `<thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Sp</th><th>Tore</th><th>Ø</th><th>Form</th><th></th></tr></thead>`;
        box.innerHTML = `
            <div class="kb-kopf">
                <h3><svg class="ico" aria-hidden="true"><use href="#i-users"/></svg>Unterbau: U23 und U19</h3>
                ${b ? `<span class="text-muted">U23: ${b.s} S · ${b.u} U · ${b.n} N · ${b.tore}:${b.gegentore} Tore</span>` : ""}
            </div>
            ${nominiertHtml}
            <h4 class="unterbau-titel">Zweite Mannschaft (U23)</h4>
            ${letzte ? `<div class="u23-letzte"><span class="kb-label">Letzte Spiele</span>${letzte}</div>` : ""}
            ${spieler.length ? `<div class="table-container"><table class="compact-table u23-tabelle">${kopfZeile}<tbody>
                ${spieler.map(p => `<tr data-u23="${esc(p.id)}"><td>${esc(p.name)}${verletzt(p)}</td><td>${esc(p.pos)}</td><td>${p.age || "-"}</td><td>${p.overall || "-"}</td>${this.unterbauZellen(p, "u23")}
                    <td>${knoepfe(`<button class="btn btn-sm btn-secondary btn-unterbau-hoch" data-id="${esc(p.id)}" title="Für immer zu den Profis">Ganz hoch</button>`,
                        `<button class="btn btn-sm btn-primary btn-nominieren" data-id="${esc(p.id)}" title="Nach dem nächsten Ligaspiel geht er zurück">Spieltag</button>`)}</td></tr>`).join("")}
            </tbody></table></div>` : `<p class="text-muted">Niemand spielt gerade in der U23.</p>`}
            <h4 class="unterbau-titel">U19: bereit für die Profis</h4>
            ${u19.length ? `<div class="table-container"><table class="compact-table u23-tabelle">${kopfZeile}<tbody>
                ${u19.map(k => `<tr data-u23="${esc(k.p.id)}"><td>${esc(k.p.name)} <span class="text-muted">${k.talent ? "Akademie" : "Profi"}</span></td><td>${esc(k.p.pos)}</td><td>${k.p.age || "-"}</td><td>${k.p.overall || "-"}</td>${this.unterbauZellen(k.p, "u19")}
                    <td>${k.talent
                        ? knoepfe(`<button class="btn btn-sm btn-secondary btn-hochziehen" data-talent-id="${esc(k.p.id)}" title="Mit Jugendvertrag ganz zu den Profis - ohne Berater">Ganz hoch</button>`,
                            `<button class="btn btn-sm btn-primary btn-hochziehen-spieltag" data-talent-id="${esc(k.p.id)}" title="Mit Jugendvertrag für den nächsten Ligaspieltag - danach spielt er in der U19">Spieltag</button>`)
                        : knoepfe(`<button class="btn btn-sm btn-secondary btn-unterbau-hoch" data-id="${esc(k.p.id)}">Ganz hoch</button>`,
                            `<button class="btn btn-sm btn-primary btn-nominieren" data-id="${esc(k.p.id)}">Spieltag</button>`)}</td></tr>`).join("")}
            </tbody></table></div>` : `<p class="text-muted">In der U19 ist niemand alt genug für die Profis (ab ${typeof YouthEngine !== "undefined" ? YouthEngine.MIT_PROFIS.abAlter : 16}).</p>`}
            <p class="text-muted kb-hinweis">Hinunter schicken Sie Spieler über die Spielerakte. In der U23 höchstens ${engine.MAX_UEBERALTERT} Spieler über ${engine.ALTERSGRENZE}, im Profikader bleiben mindestens ${engine.MIN_PROFIKADER}. Hochgezogene Talente spielen mit ihrem Jugendvertrag. <em>Spieltag</em> holt nur für das nächste Ligaspiel hoch, <em>Ganz hoch</em> für immer.
                <button type="button" class="btn-link" id="btnUnterbauZurJugend">Ganze U19 im Reiter Jugend</button></p>`;
        box.querySelectorAll("[data-u23]").forEach(tr => tr.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            this.showPlayerDetailsModal(tr.dataset.u23, { abschnitt: "unterbau" });
        }));
        this.bindeUnterbauKnoepfe(box);
        box.querySelector("#btnUnterbauZurJugend")?.addEventListener("click", () => this.switchTab("youth"));
    },

    /** Die Knöpfe "Zu den Profis" und "Hochziehen" - im Kader wie in der Jugend */
    bindeUnterbauKnoepfe(box) {
        const state = this.app.state;
        const fertig = (text) => {
            this.showToast(text, "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderCurrentTab();
        };
        box.querySelectorAll(".btn-unterbau-hoch").forEach(btn => btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const res = ReserveEngine.hinauf(state, btn.dataset.id);
            if (!res.success) return this.showToast(res.error, "error");
            fertig(`${res.player.name} gehört wieder zum Profikader.`);
        }));
        box.querySelectorAll(".btn-nominieren").forEach(btn => btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const res = ReserveEngine.nominieren(state, btn.dataset.id);
            if (!res.success) return this.showToast(res.error, "error");
            fertig(`${res.player.name} ist für den nächsten Spieltag dabei und geht danach zurück in die ${res.von}.`);
        }));
        box.querySelectorAll(".btn-nominiert-zurueck").forEach(btn => btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const p = state.players.find(x => String(x.id) === btn.dataset.id);
            if (!p || !ReserveEngine.zurueckNachNominierung(state, p)) return this.showToast("Er kann nicht zurück.", "error");
            const club = state.clubs.find(c => c.id === state.userClubId);
            if (typeof GameState !== "undefined" && GameState.repairLineup) GameState.repairLineup(club, state.players);
            fertig(`${p.name} spielt wieder in der ${p.reserve === ReserveEngine.U19 ? "U19" : "U23"}.`);
        }));
        box.querySelectorAll(".btn-hochziehen-spieltag").forEach(btn => btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const res = typeof YouthEngine !== "undefined" ? YouthEngine.hochziehen(state, btn.dataset.talentId, { nurSpieltag: true }) : { success: false, error: "Nicht verfügbar." };
            if (!res.success) return this.showToast(res.error, "error", 6000);
            fertig(`🎓 ${res.player.name} ist für den nächsten Spieltag dabei - danach spielt er in der U19, mit seinem Jugendvertrag.`);
        }));
        box.querySelectorAll(".btn-hochziehen").forEach(btn => btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const res = typeof YouthEngine !== "undefined" ? YouthEngine.hochziehen(state, btn.dataset.talentId) : { success: false, error: "Nicht verfügbar." };
            if (!res.success) return this.showToast(res.error, "error", 6000);
            this.playSound("erfolg");
            fertig(`🎓 ${res.player.name} ist bei den Profis - mit seinem Jugendvertrag.`);
        }));
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
        const bis = (l) => l.bisWinter ? "bis zur Winterpause" : "bis zum Saisonende";
        if (modus === "verliehen") {
            const l = player.leihe;
            const spiele = (player.stats?.matches || 0) - (l.startSpiele || 0);
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">Verliehen an <strong>${esc(club(l.leihvereinId)?.name || "?")}</strong> ${bis(l)} (${esc(l.rolle)}, dort ${Math.round(l.lohnAnteil * 100)} % des Gehalts${l.kaufoption ? `, Kaufoption ${this.geldKurz(l.kaufoption)}` : ""}) · ${spiele} Spiele seit der Leihe · Spielpraxis ${Math.round((player.spielpraxis ?? 0.5) * 100)} %</div>
                    ${l.rueckholrecht === false
                        ? `<div class="gs-sub">Ohne Rückholrecht - er bleibt bis zum Ende der Leihe.</div>`
                        : `<button class="btn btn-secondary" id="btnPdLeiheZurueck">${l.rueckholrecht ? "Rückholrecht ziehen" : "Vorzeitig zurückholen"}</button>`}
                </div>`;
        }
        if (modus === "geliehen") {
            const l = player.leihe;
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">Leihspieler von <strong>${esc(club(l.stammvereinId)?.name || "?")}</strong> ${bis(l)}. Sie zahlen ${Math.round(l.lohnAnteil * 100)} % seines Gehalts; erwartet wird ein Einsatz als ${esc(l.rolle)}.${l.rueckholrecht ? " Spielt er nicht, holt ihn sein Verein im Winter zurück." : ""}${l.kaufoption ? ` Kaufoption: ${this.geldKurz(l.kaufoption)}.` : ""}</div>
                    ${l.kaufoption ? `<button class="btn btn-primary" id="btnPdKaufoption">Kaufoption ziehen (${this.geldKurz(l.kaufoption)})</button>` : ""}
                </div>`;
        }
        if (modus === "eigener") {
            const liste = player.leihListe;
            if (liste) {
                const angebote = engine.offeneLeihangebote(state, player.id);
                return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">Auf der Leihliste: ${esc(this.leihBedingungenText(liste))}. ${angebote.length ? `${angebote.length} Angebot${angebote.length === 1 ? "" : "e"}:` : "Noch kein Angebot - die Vereine melden sich in den nächsten Tagen."}</div>
                    <div id="pdLeihAngebote" class="leih-angebote">${angebote.map(a => this.leihangebotHtml(a)).join("")}</div>
                    <button class="btn btn-secondary" id="btnPdVonLeihliste">Von der Leihliste nehmen</button>
                </div>`;
            }
            const hindernis = engine.verleihHindernis(state, player);
            const sommer = typeof TransferEngine !== "undefined" && TransferEngine.fensterInfo?.(state)?.art === "sommer";
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-sub">Sie nennen die Bedingungen, die Vereine melden sich in den nächsten Tagen mit Angeboten, und er muss zustimmen. Der Leihverein übernimmt einen Teil des Gehalts.</div>
                    ${hindernis ? `<div class="gs-lage">${esc(hindernis)}</div>` : `
                    <div class="leih-bedingungen">
                        <label>Gehaltsanteil mindestens
                            <select class="styled-select" id="pdLeihAnteil">
                                <option value="0">Egal</option><option value="0.5" selected>50 %</option><option value="0.75">75 %</option><option value="1">100 %</option>
                            </select></label>
                        <label>Einsatz dort
                            <select class="styled-select" id="pdLeihEinsatz">
                                <option value="Stammspieler">Stammspieler</option><option value="Rotation" selected>Mindestens Rotation</option><option value="Talent">Egal</option>
                            </select></label>
                        ${sommer ? `<label>Dauer
                            <select class="styled-select" id="pdLeihDauer">
                                <option value="saison">Bis zum Saisonende</option><option value="winter">Bis zur Winterpause</option>
                            </select></label>` : ""}
                        <label class="neg-check"><input type="checkbox" id="pdLeihRueck"> Rückholrecht im Winter (dafür zahlen die Vereine etwas weniger)</label>
                    </div>
                    <button class="btn btn-primary" id="btnPdZurLeihe">Zur Leihe anbieten</button>`}
                </div>`;
        }
        if (modus === "markt") {
            const e = engine.leihmarkt(state, 500).find(x => String(x.playerId) === String(player.id));
            if (!e) return "";
            return `
                <div class="dash-card mb-3 gs-karte">${kopf}
                    <div class="gs-lage gs-info">${esc(e.clubName)} gibt ihn ab: bis zum Saisonende, gefordert sind ${Math.round(e.lohnAnteil * 100)} % des Gehalts${e.gebuehr ? `, Leihgebühr ${this.geldKurz(e.gebuehr)}` : ""} und ein Einsatz als ${esc(e.rolle)}.</div>
                    <button class="btn btn-primary" id="btnPdAusleihen">Leihe anfragen</button>
                </div>`;
        }
        return "";
    },

    /**
     * Wie lange ein Vereinsloser noch zu haben ist: Wer eine ganze Saison
     * keinen Verein findet, hört auf (SeasonEngine.processRetirements),
     * ein Talent bekommt eine Saison mehr.
     */
    vereinslosFrist(player) {
        const jahr = this.app.state?.seasonYear || 0;
        const seit = typeof player.vereinslosAb === "number" ? player.vereinslosAb : jahr;
        const se = (typeof SeasonEngine !== "undefined" && SeasonEngine) || (typeof window !== "undefined" && window.SeasonEngine) || null;
        const talentAlter = se?.VEREINSLOS_TALENT_ALTER ?? 21;
        const ende = seit + ((player.age || 25) <= talentAlter ? 2 : 1);
        return ende <= jahr + 1
            ? "Ohne Verein - findet er bis zum Saisonwechsel keinen, hört er auf."
            : "Ohne Verein - als Talent hat er noch bis zum übernächsten Saisonwechsel Zeit.";
    },

    getSportdirektorEngine() {
        return (typeof SportdirektorEngine !== "undefined" && SportdirektorEngine)
            ? SportdirektorEngine
            : ((typeof window !== "undefined" && window.SportdirektorEngine) ? window.SportdirektorEngine : null);
    },

    /**
     * Ein Vorschlag des Sportdirektors als Karte: wer, wo er spielt, die
     * Sterne aus Sicht des eigenen Wissens, warum - und die Wege zur Akte und
     * zum Angebot. Gleich im Transfermarkt und im Postfach.
     */
    sdVorschlagHtml(v) {
        const state = this.app.state;
        const esc = t => this.escapeHtml(String(t ?? ""));
        const spieler = state.players.find(p => String(p.id) === String(v.id));
        if (!spieler) return "";
        const vergeben = spieler.clubId === state.userClubId;
        return `
            <div class="sd-karte">
                <div class="sd-kopf">
                    <div>
                        <strong>${esc(spieler.name)}</strong>
                        <span class="pos-tag pos-${this.getPosGroup(spieler.pos)}">${esc(spieler.pos)}</span>
                        <div class="sd-meta">${esc(spieler.age)} Jahre · ${esc(v.vereinName)}</div>
                    </div>
                    <div class="sd-sterne">${this.abilityStarsFor(spieler)}</div>
                </div>
                <p class="sd-grund">${esc(v.grund)}</p>
                <div class="sd-aktionen">
                    <button class="btn btn-sm btn-secondary" data-sd-akte="${esc(spieler.id)}">Akte</button>
                    ${vergeben ? `<span class="text-muted">Schon bei uns</span>`
                        : `<button class="btn btn-sm btn-primary" data-sd-angebot="${esc(spieler.id)}">Verhandeln</button>`}
                </div>
            </div>`;
    },

    /** Akte und Angebot aus den Karten des Sportdirektors */
    bindeSdKarten(container) {
        container.querySelectorAll("[data-sd-akte]").forEach(btn => btn.addEventListener("click", () => {
            const pId = this.resolvePlayerId(btn.dataset.sdAkte);
            if (pId !== null) this.showPlayerDetailsModal(pId);
        }));
        container.querySelectorAll("[data-sd-angebot]").forEach(btn => btn.addEventListener("click", () => {
            const pId = this.resolvePlayerId(btn.dataset.sdAngebot);
            if (pId !== null) this.showTransferOfferModal(pId);
        }));
    },

    /**
     * Der Sportdirektor im Transfermarkt: wo er die Baustellen sieht, und
     * die Beratung - Position, Rolle, Alter und Ablöse vorgeben, er sucht.
     */
    renderSportdirektor() {
        const state = this.app.state;
        const sd = this.getSportdirektorEngine();
        if (!sd || !state) return;
        const esc = t => this.escapeHtml(String(t ?? ""));
        const person = sd.person(state);
        const club = state.clubs.find(c => c.id === state.userClubId);
        const titel = document.getElementById("sdTitel");
        if (titel) titel.textContent = `${person.name}, Sportdirektor`;
        const genau = document.getElementById("sdGenauigkeit");
        if (genau) {
            const u = sd.ungenauigkeit(state);
            genau.textContent = u <= 1 ? "Sehr genaue Einschätzungen" : u <= 2.5 ? "Ordentliche Einschätzungen" : "Grobe Einschätzungen";
            genau.title = "Hängt am Chefscout: Je besser er ist, desto genauer schätzt der Sportdirektor die Stärke fremder Spieler.";
        }

        // Die Baustellen: die drei Mannschaftsteile mit dem größten Bedarf
        const lage = sd.lage(state);
        const lageEl = document.getElementById("sdLage");
        if (lageEl) {
            const baustellen = lage.gruppen.filter(g => g.bedarf > 0.5).slice(0, 3);
            lageEl.innerHTML = baustellen.length
                ? `<p class="sd-text">"Am meisten Luft nach oben sehe ich hier:"</p><ul class="sd-baustellen">${baustellen.map(g => `<li><strong>${esc(sd.GRUPPEN[g.key].name)}</strong> - ${g.bester
                        ? `${g.fehlend > 0 ? `nur ${g.anzahl} Spieler, ` : ""}bester ist ${esc(g.bester.name)}${(g.bester.age || 0) >= 32 ? ` (${g.bester.age})` : ""}`
                        : "niemand für diese Position"}</li>`).join("")}</ul>`
                : `<p class="sd-text">"Der Kader ist rund. Wenn Sie etwas Bestimmtes suchen, sagen Sie es mir."</p>`;
        }

        // Das Formular - die Auswahl bleibt bei einem Neuzeichnen erhalten
        const gruppeSel = document.getElementById("sdGruppe");
        const rolleSel = document.getElementById("sdRolle");
        const alterSel = document.getElementById("sdAlter");
        const abloeseSel = document.getElementById("sdAbloese");
        if (!gruppeSel || !rolleSel || !abloeseSel) return;
        const auftrag = person.auftrag;
        const vorher = this._sdKriterien || auftrag || { gruppe: "auto", rolle: "stamm" };
        gruppeSel.innerHTML = `<option value="auto">Nach Bedarf</option>`
            + Object.keys(sd.GRUPPEN).map(k => `<option value="${k}">${esc(sd.GRUPPEN[k].name)}</option>`).join("");
        rolleSel.innerHTML = Object.keys(sd.ROLLEN).map(k => `<option value="${k}">${esc(sd.ROLLEN[k].label)}</option>`).join("");
        const budget = Math.max(0, club?.transferBudget || 0);
        abloeseSel.innerHTML = [
            ["voll", `Bis ${this.formatMoneySafe(budget)} (Budget)`],
            ["haelfte", `Bis ${this.formatMoneySafe(Math.round(budget / 2))}`],
            ["viertel", `Bis ${this.formatMoneySafe(Math.round(budget / 4))}`],
            ["frei", "Nur ablösefrei"]
        ].map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("");
        gruppeSel.value = vorher.gruppe || "auto";
        rolleSel.value = vorher.rolle || "stamm";
        if (alterSel) alterSel.value = vorher.maxAlter ? String(vorher.maxAlter) : "";
        abloeseSel.value = vorher.abloese || (vorher.nurAblosefrei ? "frei" : "voll");

        const kriterien = () => {
            const abloese = abloeseSel.value;
            const k = {
                gruppe: gruppeSel.value,
                rolle: rolleSel.value,
                abloese,
                nurAblosefrei: abloese === "frei"
            };
            if (alterSel && alterSel.value) k.maxAlter = Number(alterSel.value);
            if (abloese === "haelfte") k.maxAbloese = Math.round(budget / 2);
            if (abloese === "viertel") k.maxAbloese = Math.round(budget / 4);
            return k;
        };

        const auftragEl = document.getElementById("sdAuftrag");
        const beschreibe = k => [k.gruppe && sd.GRUPPEN[k.gruppe] ? sd.GRUPPEN[k.gruppe].name : "nach Bedarf",
            sd.ROLLEN[k.rolle]?.label, k.maxAlter ? `bis ${k.maxAlter} Jahre` : null,
            k.nurAblosefrei ? "ablösefrei" : (k.maxAbloese ? `bis ${this.formatMoneySafe(k.maxAbloese)}` : null)].filter(Boolean).join(", ");
        if (auftragEl) {
            auftragEl.innerHTML = auftrag
                ? `Suchauftrag: <strong>${esc(beschreibe(auftrag))}</strong> - danach richten sich seine Vorschläge alle zwei Wochen. <button class="btn btn-sm btn-secondary" id="btnSdAuftragWeg">Aufheben</button>`
                : `Ohne Suchauftrag schlägt er alle zwei Wochen vor, was dem Kader am meisten fehlt.`;
            document.getElementById("btnSdAuftragWeg")?.addEventListener("click", () => {
                sd.setzeAuftrag(state, null);
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderSportdirektor();
            });
        }

        const ergebnis = document.getElementById("sdErgebnis");
        const zeigeErgebnis = (antwort) => {
            if (!ergebnis) return;
            ergebnis.innerHTML = `
                <div class="dash-card">
                    <p class="sd-text">${esc(antwort.kopf)}</p>
                    <div class="sd-liste">${antwort.vorschlaege.map(v => this.sdVorschlagHtml(v)).join("")}</div>
                </div>`;
            this.bindeSdKarten(ergebnis);
        };
        if (this._sdAntwort) zeigeErgebnis(this._sdAntwort);
        else if (ergebnis) ergebnis.innerHTML = "";

        document.getElementById("btnSdBeraten").onclick = () => {
            this._sdKriterien = kriterien();
            this._sdAntwort = sd.berate(state, this._sdKriterien);
            this.playSound("click");
            zeigeErgebnis(this._sdAntwort);
            ergebnis?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        };
        document.getElementById("btnSdAuftrag").onclick = () => {
            this._sdKriterien = kriterien();
            sd.setzeAuftrag(state, this._sdKriterien);
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.showToast(`${person.name} sucht künftig: ${beschreibe(this._sdKriterien)}.`, "success");
            this.renderSportdirektor();
        };
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
        // mit der Stärke, die zu dieser Sternezahl gehört - nach dem
        // eingestellten Maßstab. Die Beschriftung nennt, was drei Sterne heißen.
        const filterWahl = document.getElementById("tfRatingFilter");
        const dreiSterne = filterWahl?.querySelector('option[value="3"]');
        const massstab = typeof this.sternMassstab === "function" ? this.constructor.STERN_MASSSTAEBE?.[this.sternMassstab()] : null;
        if (dreiSterne && massstab) dreiSterne.textContent = `Ab ★ 3,0 (${massstab.kurz})`;
        const minStars = parseFloat(filterWahl?.value || "0");

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

        // Länderwissen: Aus dem Ausland kennt der Verein nur einen Teil der
        // Spieler - die übrigen tauchen erst nach Scout-Aufträgen dort auf
        let unbekannt = 0;
        const scoutSicht = this.getScoutingEngine()?.sichtbarkeit?.(state);
        if (scoutSicht) {
            const vorher = marketPlayers.length;
            marketPlayers = marketPlayers.filter(scoutSicht.istSichtbar);
            unbekannt = vorher - marketPlayers.length;
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
                    : "")
                + (unbekannt > 0
                    ? `<div class="text-muted tf-landwissen">🔭 ${unbekannt.toLocaleString("de-DE")} Spieler im Ausland kennt Ihr Scout noch nicht. Ein Auftrag mit Länderfokus (Scouting) macht sie sichtbar.</div>`
                    : "");
        }

        if (searchVal) marketPlayers = marketPlayers.filter(p => p.name.toLowerCase().includes(searchVal));
        if (posVal.startsWith("grp:")) marketPlayers = marketPlayers.filter(p => this.positionsGruppe(p.pos) === posVal.slice(4));
        else if (posVal !== "all") marketPlayers = marketPlayers.filter(p => p.pos === posVal);

        // Mehr Filter: Alter, Vertrag, Land - dann Potenzial und Marktwert so, wie der Scout sie sieht
        const feldWert = (id) => document.getElementById(id)?.value || "";
        const alterVal = feldWert("tfAlterFilter"), vertragVal = feldWert("tfVertragFilter"), landVal = feldWert("tfLandFilter");
        const wertVal = feldWert("tfWertFilter"), sortVal = feldWert("tfSortierung") || "staerke";
        const potVal = parseFloat(feldWert("tfPotFilter") || "0");
        const landWahl = document.getElementById("tfLandFilter");
        const scouting = this.getScoutingEngine();
        if (landWahl && landWahl.options.length <= 1 && scouting && typeof scouting.laender === "function") {
            scouting.laender(state).forEach(l => landWahl.add(new Option(l.name, l.id)));
            landWahl.value = landVal;
        }
        const vereinVon = new Map(state.clubs.map(c => [c.id, c]));
        if (alterVal) {
            const [von, bis] = alterVal.split("-").map(Number);
            marketPlayers = marketPlayers.filter(p => (p.age || 0) >= von && (p.age || 0) <= bis);
        }
        if (vertragVal === "aus") marketPlayers = marketPlayers.filter(p => p.clubId && (p.contractYears ?? 1) <= 1);
        if (vertragVal === "liste") marketPlayers = marketPlayers.filter(p => p.transferListed);
        if (vertragVal === "frei") marketPlayers = marketPlayers.filter(p => !vereinVon.get(p.clubId));
        if (landVal) marketPlayers = marketPlayers.filter(p => vereinVon.get(p.clubId)?.countryId === landVal);
        const sichtKontext = Object.assign({ userClubId: state.userClubId, leagueDataCoverage: 85, state }, this.starContext());
        const sicht = new Map();
        const sichtwerte = (p) => {
            if (!sicht.has(p.id)) {
                const re = this.getRatingEngine();
                sicht.set(p.id, re && typeof re.sichtwerte === "function" ? re.sichtwerte(p, sichtKontext) : { wertMin: p.value || 0, wertMax: p.value || 0, potSterne: 0 });
            }
            return sicht.get(p.id);
        };
        if (potVal > 0) marketPlayers = marketPlayers.filter(p => sichtwerte(p).potSterne >= potVal);
        if (wertVal) {
            const grenzeWert = wertVal === "budget" ? Math.max(0, userClub.transferBudget || 0) : Number(wertVal);
            marketPlayers = marketPlayers.filter(p => sichtwerte(p).wertMin <= grenzeWert);
        }
        const mehrZahl = [alterVal, potVal > 0, wertVal, vertragVal, landVal, sortVal !== "staerke"].filter(Boolean).length;
        const mehrEl = document.getElementById("tfMehrZahl");
        if (mehrEl) mehrEl.textContent = mehrZahl ? `(${mehrZahl} aktiv)` : "";

        // Gefiltert und sortiert wird nach der Stärke, wie der Scout sie
        // sieht - nicht nach der wahren. Sonst verriet schon die Reihenfolge,
        // wer wirklich gut ist: Von den 30 besten Spielern standen nur neun
        // auch unter den 30 besten nach Einschätzung.
        const schaetzer = this.getRatingEngine();
        const schaetzKontext = Object.assign({ userClubId: state.userClubId, leagueDataCoverage: 85 }, this.starContext());
        const gesehen = new Map();
        const staerke = (p) => {
            let wert = gesehen.get(p.id);
            if (wert === undefined) {
                wert = schaetzer && typeof schaetzer.geschaetzteStaerke === "function" ? schaetzer.geschaetzteStaerke(p, schaetzKontext) : p.overall;
                gesehen.set(p.id, wert);
            }
            return wert;
        };
        if (minStars > 0) {
            const grenze = schaetzer ? schaetzer.overallForStars(minStars, this.starContext()) : 0;
            marketPlayers = marketPlayers.filter(p => staerke(p) >= grenze);
        }

        const sortierer = {
            staerke: (a, b) => staerke(b) - staerke(a) || (a.age || 0) - (b.age || 0),
            potenzial: (a, b) => sichtwerte(b).potSterne - sichtwerte(a).potSterne || staerke(b) - staerke(a),
            alter: (a, b) => (a.age || 0) - (b.age || 0) || staerke(b) - staerke(a),
            wert: (a, b) => sichtwerte(b).wertMin - sichtwerte(a).wertMin
        };
        marketPlayers.sort(sortierer[sortVal] || sortierer.staerke);

        // Niemand liest viertausend Zeilen. Der Markt zeigt die besten
        // Treffer seitenweise - erst 30, auf Wunsch mehr. Vorher standen
        // 120 Zeilen untereinander, über zehntausend Pixel Seite.
        const TREFFER_PRO_SEITE = 30;
        const filterKey = [searchVal, posVal, minStars, alterVal, potVal, wertVal, vertragVal, landVal, sortVal].join("|");
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
                        <td class="tm-verein">${club ? vereinsName : `<span class="badge badge-success" title="${this.escapeHtml(this.vereinslosFrist(p))}">Ablösefrei</span>`}</td>
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
                            🔭 <strong>Scout-Fokus:</strong> Position: ${a.position} | Alter bis: ${a.maxAge} | Mindestens ${this.starsFor(a.minOverall)}${a.land && this.getScoutingEngine() ? ` | ${this.flaggeVon(a.land)} ${this.escapeHtml(this.getScoutingEngine().landName(a.land))}` : ""}
                        </div>
                        <span class="header-tag" style="background:var(--accent-primary); color:#000;">⏳ Noch ${a.matchdaysRemaining} Spieltag(e)</span>
                    </div>
                `).join("");
            }
        }

        this.renderLaenderwissen(state);

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

    getScoutingEngine() {
        return (typeof ScoutingEngine !== "undefined" && ScoutingEngine)
            ? ScoutingEngine
            : ((typeof window !== "undefined" && window.ScoutingEngine) ? window.ScoutingEngine : null);
    },

    /**
     * Länderwissen: je Land ein Balken, wie viele Spieler dort bekannt sind,
     * und die Länderauswahl im Auftragsformular.
     */
    renderLaenderwissen(state) {
        const se = this.getScoutingEngine();
        const liste = document.getElementById("scoutLaenderList");
        const auswahl = document.getElementById("scoutLandSelect");
        if (!se || typeof se.laender !== "function" || !state) return;

        const sicht = se.sichtbarkeit(state);
        const bekannt = {}, gesamt = {};
        state.players.forEach(p => {
            if (!p.clubId || p.clubId === state.userClubId) return;
            const land = se.landVon(state, p, sicht.vereine);
            if (!land) return;
            gesamt[land] = (gesamt[land] || 0) + 1;
            if (sicht.istSichtbar(p)) bekannt[land] = (bekannt[land] || 0) + 1;
        });
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const heim = userClub?.countryId || "de";
        const laender = se.laender(state)
            .map(l => ({ ...l, wissen: sicht.wissenVon(l.id), zugewinn: Number(state.scouting?.laender?.[l.id]) || 0 }))
            .sort((a, b) => (b.id === heim) - (a.id === heim) || b.wissen - a.wissen || a.name.localeCompare(b.name));

        if (auswahl) {
            // Länder, deren Ligen alle über der eigenen Marktreichweite liegen,
            // lohnen keinen Auftrag - der Scout käme mit leeren Händen zurück
            const te = (typeof TransferEngine !== "undefined" && TransferEngine)
                ? TransferEngine : ((typeof window !== "undefined" && window.TransferEngine) ? window.TransferEngine : null);
            const reich = te && typeof te.marketReach === "function" && userClub ? te.marketReach(userClub) : 1;
            const erreichbar = new Set(state.clubs.filter(c => (c.level || 1) >= reich).map(c => c.countryId));
            const gewaehlt = auswahl.value || "ALL";
            auswahl.innerHTML = `<option value="ALL">Alle Länder</option>`
                + laender.map(l => {
                    const zu = !erreichbar.has(l.id);
                    return `<option value="${l.id}"${zu ? " disabled" : ""}>${l.flag || ""} ${this.escapeHtml(l.name)}${zu ? " (außer Reichweite)" : (l.id === heim ? "" : ` (${l.wissen} %)`)}</option>`;
                }).join("");
            auswahl.value = laender.some(l => l.id === gewaehlt && erreichbar.has(l.id)) ? gewaehlt : "ALL";
        }

        if (liste) {
            liste.innerHTML = `<div class="text-muted land-wissen-hinweis">Aus dem eigenen Land kennt Ihr Verein jeden Spieler, aus dem Ausland die Stars und einen Teil der übrigen. Ein Scout-Auftrag mit Länderfokus erweitert das Wissen, ebenso jedes Europapokalspiel gegen einen Verein aus dem Land; ohne Pflege verblasst es langsam.</div>`
                + `<div class="land-wissen-liste">` + laender.map(l => {
                    const farbe = l.wissen >= 70 ? "var(--accent-success, #22c55e)" : (l.wissen >= 40 ? "#f59e0b" : "#ef4444");
                    return `<div class="land-wissen-zeile">
                        <span class="land-wissen-name">${l.flag || ""} ${this.escapeHtml(l.name)}</span>
                        <span class="land-wissen-balken"><span style="width:${l.wissen}%; background:${farbe};"></span></span>
                        <span class="land-wissen-wert">${l.wissen} %</span>
                        <span class="land-wissen-zahl text-muted">${l.id === heim ? "Heimat · " : ""}${(bekannt[l.id] || 0).toLocaleString("de-DE")} von ${(gesamt[l.id] || 0).toLocaleString("de-DE")} Spielern bekannt${l.zugewinn >= 1 ? ` · +${Math.round(l.zugewinn)} durch Aufträge` : ""}</span>
                    </div>`;
                }).join("") + `</div>` + this.regionalScoutsHtml(state, se);
            liste.querySelectorAll("[data-region-ein]").forEach(btn => btn.addEventListener("click", () => {
                const res = se.stelleRegionalScoutEin(state, btn.dataset.regionEin);
                this.showToast(res.success ? "Der Regionalscout ist eingestellt." : res.error, res.success ? "success" : "error");
                if (res.success) { if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage(); this.renderLaenderwissen(state); }
            }));
            liste.querySelectorAll("[data-region-aus]").forEach(btn => btn.addEventListener("click", () => {
                const res = se.entlasseRegionalScout(state, btn.dataset.regionAus);
                this.showToast(res.success ? "Der Regionalscout ist entlassen." : res.error, res.success ? "info" : "error");
                if (res.success) { if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage(); this.renderLaenderwissen(state); }
            }));
        }
    },

    /** Regionalscouts: je Region einstellen oder entlassen, mit Kosten und Rahmen */
    regionalScoutsHtml(state, se) {
        if (typeof se.regionen !== "function") return "";
        const { max, kosten } = se.regionRahmen(state);
        const regionen = se.regionen(state);
        const aktiv = regionen.filter(r => r.aktiv).length;
        const flagge = (id) => se.laender(state).find(l => l.id === id)?.flag || "";
        const kopf = `<h4 class="region-kopf">Regionalscouts <span class="text-muted">${aktiv} von ${max}</span></h4>
            <div class="text-muted land-wissen-hinweis">Ein Regionalscout lebt in seiner Region: Der Verein kennt deren Länder deutlich besser, Aufträge mit Länderfokus dort bringen mehr, und er meldet von selbst junge Talente mit Bericht. ${max ? `Einer kostet ${this.geldKurz(kosten)} je Spieltag.` : "In dieser Liga hält sich kein Verein Regionalscouts."}</div>`;
        if (!max) return kopf;
        return kopf + `<div class="region-liste">` + regionen.map(r => `
            <div class="region-zeile${r.aktiv ? " aktiv" : ""}">
                <span class="region-name">${r.laender.map(flagge).join(" ")} ${this.escapeHtml(r.name)}</span>
                <span class="region-status text-muted">${r.aktiv ? `seit Saison ${r.seit}` : "frei"}</span>
                ${r.aktiv
                    ? `<button class="btn btn-sm btn-secondary" data-region-aus="${r.key}">Entlassen</button>`
                    : `<button class="btn btn-sm btn-primary" data-region-ein="${r.key}" ${aktiv >= max ? "disabled" : ""}>Einstellen</button>`}
            </div>`).join("") + `</div>`;
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
