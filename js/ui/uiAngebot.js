/**
 * Transferangebot als eigene Seite, wie im Vorbild.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 * Ein Angebot für einen eigenen Spieler kam bisher als kleines Fenster mit
 * der Karte aus dem Transfermarkt. Jetzt springt man auf seine Seite (beim
 * Eingang, aus dem Postfach, vom Dashboard, aus dem Transfermarkt) und sieht
 * dort alles, was man für die Entscheidung braucht:
 *
 *   Kopf        - Käufer mit Wappen, Spieler, Frist oder Ausgang
 *   Angebot     - Ablöse, Verhältnis zum Marktwert, Zahlweise, Gehalt beim
 *                 Käufer, Weiterverkaufsbeteiligung
 *   Spieler     - Rolle, Vertrag, Saison - und wer auf seiner Position bleibt
 *   Folgen      - Kasse, Transferbudget und Gehalt nach dem Verkauf
 *   Käufer      - Liga, Tabellenplatz, Ruf
 *   Entscheidung - Annehmen, Mehr fordern (einmal), Ablehnen, Später
 *
 * Die Seite bleibt nach der Entscheidung offen und zeigt den Ausgang.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    angebotVon(offerId) {
        return (this.app?.state?.transferMarket?.offers || []).find(o => String(o.id) === String(offerId)) || null;
    },

    /** Was der Verkauf heute bringt: sofort fällige Ablöse, Kasse und Transferbudget danach */
    angebotsFolgen(o, club, prozent = 0) {
        const fin = typeof FinanceEngine !== "undefined" ? FinanceEngine : null;
        const fee = Math.round((o.fee || 0) * (1 - prozent / 200));
        const plan = fin && typeof fin.ratenPlan === "function" ? fin.ratenPlan(fee, o.zahlweise) : { anzahlung: fee, monate: 0, rate: 0 };
        const sofort = plan.monate ? plan.anzahlung : fee;
        return {
            fee, sofort, plan,
            kasseVorher: club?.balance || 0, kasseNachher: (club?.balance || 0) + sofort,
            budgetVorher: club?.transferBudget || 0, budgetNachher: (club?.transferBudget || 0) + Math.round(sofort * 0.85)
        };
    },

    /** Wer auf seiner Position bleibt: die Besten des eigenen Kaders im selben Mannschaftsteil */
    angebotsErsatz(spieler) {
        const state = this.app.state;
        if (!spieler) return [];
        const gruppe = this.getPosGroup(spieler.pos);
        return state.players
            .filter(p => p.clubId === state.userClubId && p.id !== spieler.id && !p.leihe && this.getPosGroup(p.pos) === gruppe)
            .sort((a, b) => (b.pos === spieler.pos) - (a.pos === spieler.pos) || b.overall - a.overall)
            .slice(0, 3);
    },

    zeigeAngebotSeite(offerId, { fordern = false } = {}) {
        if (typeof document === "undefined" || !document.getElementById) return;
        const state = this.app.state;
        const o = this.angebotVon(offerId);
        const inhalt = document.getElementById("angebotSeiteInhalt");
        if (!o || !inhalt) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const geld = (x) => this.geldKurz(x || 0);
        const club = state.clubs.find(c => c.id === state.userClubId);
        const kaeufer = state.clubs.find(c => c.id === (o.fromClubId || o.buyerClubId)) || null;
        const spieler = state.players.find(p => String(p.id) === String(o.playerId)) || null;
        const offen = o.status === "pending";
        const wert = spieler?.value || o.playerValue || 0;
        const quote = wert > 0 && !(o.ablosefrei && !o.fee) ? Math.round(o.fee / wert * 100) : null;
        const news = typeof NewsEngine !== "undefined" ? NewsEngine : null;
        const lage = news ? news.dringlichkeit(state, { type: "transfer_offer", offerId: o.id }) : null;
        const fin = typeof FinanceEngine !== "undefined" ? FinanceEngine : null;
        const prozent = this._angebotWv && String(this._angebotWv.id) === String(o.id) ? this._angebotWv.prozent : 0;
        const folgen = this.angebotsFolgen(o, club, prozent);
        const lohn = o.wage || Math.round((spieler?.wage || 10000) * 1.2);
        const antwort = this._angebotAntwort && String(this._angebotAntwort.id) === String(o.id) ? this._angebotAntwort : null;

        // Der Käufer: Liga, Platz, Ruf
        const liga = kaeufer ? (state.leagues || []).find(l => l.id === kaeufer.leagueId) : null;
        const eigeneLiga = kaeufer && club && kaeufer.leagueId === club.leagueId;
        const tabelle = kaeufer ? (eigeneLiga ? (state.standings || []) : (state.standingsByLeague?.[kaeufer.leagueId] || [])) : [];
        const platz = kaeufer ? tabelle.findIndex(t => t.clubId === kaeufer.id) + 1 : 0;

        // Der Spieler: Saison, Rolle, wer bleibt
        const stamm = spieler && (club?.lineup || []).some(id => String(id) === String(spieler.id));
        const saison = spieler && typeof StatistikEngine !== "undefined" ? StatistikEngine.von(spieler, "alle") : spieler?.stats || {};
        const ersatz = this.angebotsErsatz(spieler);
        const ende = spieler && typeof this.vertragsEnde === "function" ? this.vertragsEnde(spieler) : null;

        const zeile = (l, w) => `<div class="pf-zeile"><span>${esc(l)}</span><strong>${w}</strong></div>`;
        const ausgang = { accepted: ["gut", "Angenommen", `${o.playerName} wechselt für ${geld(o.fee)} zu ${o.fromClubName}.`],
            rejected: ["neutral", "Abgelehnt", `${o.fromClubName} hat eine Absage bekommen. ${o.playerName} bleibt.`],
            expired: ["neutral", "Verfallen", `Die Frist ist abgelaufen, ohne dass wir geantwortet haben. ${o.playerName} bleibt.`],
            withdrawn: ["schlecht", "Zurückgezogen", `${o.fromClubName} hat das Angebot zurückgezogen. ${o.playerName} bleibt.`] }[o.status];
        // Ablösefrei angeboten: Gefordert wird etwas vom Marktwert, gerundet
        // nach der Größe des Betrags - auf 50.000 gerundet blieb im Unterhaus 0
        const basis = o.fee || Math.round(wert * 0.15);
        const runde = (b) => { const schritt = b >= 1e6 ? 50000 : (b >= 1e5 ? 5000 : 500); return Math.max(schritt, Math.round(b / schritt) * schritt); };
        const vorschlag = runde(basis * 1.2);
        this._angebotRunde = { id: o.id, basis, runde };
        const abl = (x) => (o.ablosefrei && !x) ? "ablösefrei" : geld(x);
        const andere = (state.transferMarket?.offers || []).filter(x => x.status === "pending" && String(x.id) !== String(o.id));

        inhalt.innerHTML = `
            <header class="pf-kopf ag-kopf">
                <div class="pf-kopf-person">
                    ${kaeufer ? this.wappenHtml(kaeufer, "ag-wappen") : ""}
                    <div class="pf-kopf-text">
                        <h2 id="agTitel">Angebot von ${esc(o.fromClubName || o.buyerClubName || "einem Verein")}</h2>
                        <div class="pf-position">für <button type="button" class="post-link" data-ag-spieler="${esc(o.playerId)}">${esc(o.playerName)}</button> <span class="pf-codes">${esc(o.playerPos || spieler?.pos || "")}</span></div>
                        <div class="pf-marken">${lage && typeof this.postFlagHtml === "function" ? this.postFlagHtml(lage) : ""}${o.nachgebessert ? `<span class="pf-marke pf-info">Nachgebessert</span>` : ""}</div>
                    </div>
                </div>
                <div class="ag-summe">
                    <span>Ablöse</span>
                    <strong>${abl(o.fee)}</strong>
                    ${quote !== null ? `<small class="ag-quote ${quote >= 115 ? "pf-ton-gut" : (quote < 95 ? "pf-ton-schlecht" : "")}">${quote} % des Marktwerts</small>` : ""}
                </div>
            </header>

            ${ausgang ? `<div class="ag-ausgang ag-${ausgang[0]}"><strong>${esc(ausgang[1])}</strong><span>${esc(ausgang[2])}</span></div>` : ""}
            ${antwort && offen ? `<div class="ag-ausgang ag-${antwort.status === "angenommen" ? "gut" : "neutral"}"><strong>${antwort.status === "angenommen" ? "Er geht mit" : "Nachgebessert"}</strong><span>${esc(antwort.text)}</span></div>` : ""}

            <div class="ag-raster">
                <div class="dash-card pf-karte ag-angebot">
                    <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-briefcase"/></svg>Das Angebot</h4>
                    ${zeile("Ablöse", abl(o.fee))}
                    ${zeile("Marktwert", wert ? geld(wert) : "–")}
                    ${quote !== null ? `<div class="ag-verhaeltnis" title="Ablöse im Verhältnis zum Marktwert"><i style="width:${Math.min(100, quote / 2)}%"></i><b style="left:50%"></b></div>` : ""}
                    ${zeile("Zahlweise", esc(o.zahlweise && fin?.ratenText ? fin.ratenText(o.fee, o.zahlweise) : "sofort fällig"))}
                    ${zeile("Gehalt beim Käufer", `${geld(lohn)} / Wo.${spieler?.wage ? ` <small>(bei uns ${geld(spieler.wage)})</small>` : ""}`)}
                    ${offen ? `<label class="ak-wv ag-wv">Weiterverkaufsbeteiligung
                        <select class="styled-select" id="agWeiterverkauf" data-wv-offer="${esc(o.id)}">
                            ${[[0, "keine"], [10, "10 % (Ablöse −5 %)"], [20, "20 % (Ablöse −10 %)"]].map(([w, t]) => `<option value="${w}"${w === prozent ? " selected" : ""}>${t}</option>`).join("")}
                        </select>
                    </label>
                    <p class="pf-klein">Wird er später weiterverkauft, bekommen wir diesen Anteil. Dafür zahlt der Käufer jetzt die Hälfte des Prozentsatzes weniger.</p>` : ""}
                </div>

                <div class="dash-card pf-karte ag-spieler">
                    <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-user"/></svg>Der Spieler</h4>
                    ${spieler ? `
                    <div class="ag-person">
                        <span class="pd-nr pd-nr-fremd">${Number.isInteger(spieler.trikot) ? spieler.trikot : esc(spieler.pos)}</span>
                        <div><strong>${esc(spieler.name)}</strong><span>${esc(spieler.pos)} · ${spieler.age} Jahre · ${this.abilityStarsFor(spieler, { compact: true })}</span></div>
                    </div>
                    ${zeile("Rolle", `${esc(spieler.squadRole || "Kader")}${stamm ? " · erste Elf" : ""}`)}
                    ${ende ? zeile("Vertrag bis", ende) : ""}
                    ${zeile("Saison", `${saison.matches || 0} Spiele · ${saison.goals || 0} Tore${saison.matches ? ` · Note ${(saison.ratingSum / saison.matches).toFixed(2).replace(".", ",")}` : ""}`)}
                    <h4 class="gs-titel pf-unter">Auf seiner Position bleiben</h4>
                    ${ersatz.length ? ersatz.map(p => `<div class="pf-pos-zeile"><span class="pf-pos-code" style="--pf-farbe:var(--line-strong)">${esc(p.pos)}</span><button type="button" class="post-link ag-ersatz" data-ag-spieler="${esc(p.id)}">${esc(p.name)}</button><span class="pf-pos-sterne">${this.abilityStarsFor(p, { compact: true })}</span></div>`).join("")
                        : `<p class="pf-klein pf-ton-schlecht">Niemand - der Mannschaftsteil wäre ohne ihn leer.</p>`}
                    <button type="button" class="btn btn-secondary btn-sm ag-profil" data-ag-spieler="${esc(spieler.id)}"><svg class="ico" aria-hidden="true"><use href="#i-user"/></svg> Profil öffnen</button>` : `<p class="pf-klein">Er steht nicht mehr in unserem Kader.</p>`}
                </div>

                ${offen ? `<div class="dash-card pf-karte ag-folgen" id="agFolgen">
                    ${this.angebotsFolgenHtml(o, club, spieler, folgen)}
                </div>` : ""}

                <div class="dash-card pf-karte ag-kaeufer">
                    <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-shield"/></svg>Der Käufer</h4>
                    ${kaeufer ? `
                    <div class="ag-person">${this.wappenHtml(kaeufer, "pf-wappen")}<div><strong>${esc(kaeufer.name)}</strong><span>${esc(liga?.name || "")}</span></div></div>
                    ${platz ? zeile("Tabellenplatz", `${platz}.`) : ""}
                    ${typeof kaeufer.reputation === "number" ? zeile("Ruf", `${Math.round(kaeufer.reputation)}${club && typeof club.reputation === "number" ? ` <small>(wir ${Math.round(club.reputation)})</small>` : ""}`) : ""}
                    <button type="button" class="btn btn-secondary btn-sm" data-ag-verein="${esc(kaeufer.id)}"><svg class="ico" aria-hidden="true"><use href="#i-shield"/></svg> Vereinsseite</button>` : `<p class="pf-klein">${esc(o.fromClubName || "")}</p>`}
                </div>
            </div>

            ${offen ? `
            <div class="dash-card pf-karte ag-entscheidung">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-check"/></svg>Ihre Entscheidung</h4>
                ${!o.nachgebessert ? `
                <div class="ag-forderung">
                    <label for="angebotForderung">Mehr fordern</label>
                    <div class="ag-forderung-zeile">
                        <input type="number" id="angebotForderung" class="styled-input" min="0" step="50000" value="${vorschlag}">
                        <strong class="ag-betrag" id="agForderungText">${geld(vorschlag)}</strong>
                        ${[10, 20, 30].map(p => `<button type="button" class="filter-chip" data-ag-plus="${p}">+${p} %</button>`).join("")}
                    </div>
                    <p class="pf-klein" id="angebotAntwort">Nachgebessert wird nur einmal. Wer zu viel verlangt, verliert das Angebot.</p>
                </div>` : `<p class="pf-klein">${esc(o.fromClubName)} hat bereits nachgebessert - jetzt heißt es annehmen oder ablehnen.</p>`}
                <div class="ag-knoepfe">
                    <button type="button" class="btn btn-primary" id="btnAgAnnehmen">Annehmen (${geld(folgen.fee)})</button>
                    ${!o.nachgebessert ? `<button type="button" class="btn btn-secondary" id="btnAgFordern">Mehr fordern</button>` : ""}
                    <button type="button" class="btn btn-secondary" id="btnAgAblehnen">Ablehnen</button>
                    <button type="button" class="btn btn-secondary" id="btnAgSpaeter">Später entscheiden</button>
                </div>
            </div>` : ""}

            ${andere.length ? `
            <div class="dash-card pf-karte ag-andere">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-transfer"/></svg>Weitere offene Angebote</h4>
                ${andere.map(x => `<button type="button" class="ag-anderes" data-ag-angebot="${esc(x.id)}"><strong>${esc(x.playerName)}</strong><span>${esc(x.fromClubName || "")}</span><b>${geld(x.fee)}</b></button>`).join("")}
            </div>` : ""}`;

        this._seiteZeichnet = true;
        try {
            this.zeigeSeite("angebot", o.id);
        } finally {
            this._seiteZeichnet = false;
        }
        this.bindeAngebotSeite(inhalt, o, club, spieler);
        if (fordern) inhalt.querySelector("#angebotForderung")?.focus({ preventScroll: false });
    },

    angebotsFolgenHtml(o, club, spieler, f) {
        const geld = (x) => this.geldKurz(x || 0);
        const zeile = (l, w) => `<div class="pf-zeile"><span>${this.escapeHtml(l)}</span><strong>${w}</strong></div>`;
        return `
            <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-wallet"/></svg>Was der Verkauf bringt</h4>
            ${zeile("Ablöse", geld(f.fee))}
            ${f.plan.monate ? zeile("Sofort", `${geld(f.sofort)} <small>(dann ${f.plan.monate} × ${geld(f.plan.rate)})</small>`) : ""}
            ${zeile("Kasse", `${geld(f.kasseVorher)} → <span class="pf-ton-gut">${geld(f.kasseNachher)}</span>`)}
            ${zeile("Transferbudget", `${geld(f.budgetVorher)} → <span class="pf-ton-gut">${geld(f.budgetNachher)}</span>`)}
            ${spieler?.wage ? zeile("Gehalt frei", `${geld(spieler.wage)} / Wo.`) : ""}
            <p class="pf-klein">85 % des sofort fälligen Erlöses gehen ins Transferbudget.${f.plan.monate ? " Die Raten kommen monatlich in die Kasse." : ""}</p>`;
    },

    bindeAngebotSeite(inhalt, o, club, spieler) {
        const state = this.app.state;
        const zurueck = document.getElementById("btnAngebotZurueck");
        if (zurueck) zurueck.onclick = () => this.seiteZurueck();
        inhalt.querySelectorAll("[data-ag-spieler]").forEach(el => el.addEventListener("click", () => this.showPlayerDetailsModal(this.resolvePlayerId ? this.resolvePlayerId(el.dataset.agSpieler) : el.dataset.agSpieler)));
        inhalt.querySelectorAll("[data-ag-verein]").forEach(el => el.addEventListener("click", () => this.showClubDetailsModal(el.dataset.agVerein)));
        inhalt.querySelectorAll("[data-ag-angebot]").forEach(el => el.addEventListener("click", () => this.zeigeAngebotSeite(el.dataset.agAngebot)));
        // Weiterverkauf: die Folgen rechnen gleich mit der kleineren Ablöse
        const wv = inhalt.querySelector("#agWeiterverkauf");
        wv?.addEventListener("change", () => {
            const prozent = parseInt(wv.value || "0", 10);
            this._angebotWv = { id: o.id, prozent };
            const f = this.angebotsFolgen(o, club, prozent);
            const ort = inhalt.querySelector("#agFolgen");
            if (ort) ort.innerHTML = this.angebotsFolgenHtml(o, club, spieler, f);
            const an = inhalt.querySelector("#btnAgAnnehmen");
            if (an) an.textContent = `Annehmen (${this.geldKurz(f.fee)})`;
        });
        const feld = inhalt.querySelector("#angebotForderung");
        const betragText = () => { const t = inhalt.querySelector("#agForderungText"); if (t && feld) t.textContent = this.geldKurz(Number(feld.value) || 0); };
        feld?.addEventListener("input", betragText);
        inhalt.querySelectorAll("[data-ag-plus]").forEach(el => el.addEventListener("click", () => {
            const r = this._angebotRunde && String(this._angebotRunde.id) === String(o.id) ? this._angebotRunde : null;
            if (feld) feld.value = String(r ? r.runde(r.basis * (1 + Number(el.dataset.agPlus) / 100)) : Math.round(o.fee * (1 + Number(el.dataset.agPlus) / 100) / 50000) * 50000);
            betragText();
        }));
        inhalt.querySelector("#btnAgAnnehmen")?.addEventListener("click", () => {
            this.nimmAngebotAn(o.id, parseInt(wv?.value || "0", 10));
        });
        inhalt.querySelector("#btnAgAblehnen")?.addEventListener("click", () => this.lehneAngebotAb(o.id));
        inhalt.querySelector("#btnAgSpaeter")?.addEventListener("click", () => this.seiteZurueck());
        inhalt.querySelector("#btnAgFordern")?.addEventListener("click", () => {
            const r = TransferEngine.fordereMehr(state, o.id, Number(feld?.value) || 0);
            if (r.status === "fehler") {
                const a = inhalt.querySelector("#angebotAntwort");
                if (a) { a.textContent = r.text; a.classList.add("pf-ton-schlecht"); }
                return;
            }
            this._angebotAntwort = { id: o.id, status: r.status, text: r.text };
            this.playSound(r.status === "zurueckgezogen" ? "click" : "erfolg");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderHeader();
            // Zeichnet den Reiter darunter und die Seite mit dem neuen Stand
            this.renderCurrentTab();
        });
    }
});
