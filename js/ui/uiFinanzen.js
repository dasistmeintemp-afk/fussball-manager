/**
 * Finanzen: Budget umschichten, Raten, Finanzregeln, Vorstandsanfragen und Übersicht.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Finanzen & Buchungsjournal rendern
     */
    /**
     * Budgets umschichten: freier Gehaltsetat ins Transferbudget und zurück.
     * Der Kurs (Wochen bis zum Saisonwechsel) steht dabei, damit klar ist,
     * was ein Euro Wochengehalt wert ist.
     */
    renderUmschichten(state, club) {
        const el = document.getElementById("finUmschichten");
        const fin = typeof FinanceEngine !== "undefined" ? FinanceEngine : null;
        if (!el || !fin || typeof fin.umschichtSpielraum !== "function") return;
        const raum = fin.umschichtSpielraum(state, club);
        if (!raum) { el.innerHTML = ""; return; }
        const schritt = ContractEngine.eingabeSchritt(Math.max(raum.gehaltFrei, raum.transferMoeglich, 1000));
        const vorschlag = ContractEngine.rundeBetrag(Math.max(raum.gehaltFrei, raum.transferMoeglich) / 2) || 0;
        const stand = raum.umgeschichtet
            ? `<div class="muted-note">Diese Saison umgeschichtet: ${this.geldKurz(Math.abs(raum.umgeschichtet))} pro Woche ${raum.umgeschichtet > 0 ? "aus dem Gehaltsetat ins Transferbudget" : "aus dem Transferbudget in den Gehaltsetat"}. Zum Saisonwechsel gilt wieder der Etat des Vorstands.</div>` : "";
        el.innerHTML = `
            <h4>Budget umschichten</h4>
            <p class="muted-note">1 € pro Woche entspricht ${raum.wochen} € Transferbudget - so viele Wochen sind es noch bis zum Saisonwechsel.
                Frei im Gehaltsetat: <strong>${this.geldKurz(raum.gehaltFrei)}</strong> pro Woche.</p>
            <div class="umschichten-zeile">
                <label>Betrag je Woche (€)
                    <input type="number" id="umschichtBetrag" class="styled-input" min="0" step="${schritt}" value="${vorschlag}">
                </label>
                <span class="umschichten-vorschau" id="umschichtVorschau"></span>
            </div>
            <div class="umschichten-knoepfe">
                <button class="btn btn-sm btn-secondary" id="btnUmschichtTransfer" ${raum.gehaltFrei <= 0 ? "disabled" : ""}>Ins Transferbudget</button>
                <button class="btn btn-sm btn-secondary" id="btnUmschichtGehalt" ${raum.transferMoeglich <= 0 ? "disabled" : ""}>In den Gehaltsetat</button>
            </div>
            ${stand}`;
        const eingabe = document.getElementById("umschichtBetrag");
        const vorschau = () => {
            const b = Math.max(0, Number(eingabe.value) || 0);
            DOM.setText("umschichtVorschau", b ? `= ${this.geldKurz(b * raum.wochen)} Transferbudget` : "");
        };
        eingabe?.addEventListener("input", vorschau);
        vorschau();
        const ausfuehren = (richtung) => {
            const b = Math.max(0, Number(eingabe.value) || 0) * richtung;
            const r = fin.schichteUm(state, b);
            if (!r.ok) { this.showToast(r.grund, "error"); return; }
            this.showToast(richtung > 0
                ? `${this.geldKurz(r.jeWoche)} pro Woche ins Transferbudget: +${this.geldKurz(r.transfer)}.`
                : `${this.geldKurz(-r.jeWoche)} pro Woche mehr Gehaltsetat für ${this.geldKurz(-r.transfer)} Transferbudget.`, "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderFinances();
            this.renderHeader();
        };
        document.getElementById("btnUmschichtTransfer")?.addEventListener("click", () => ausfuehren(1));
        document.getElementById("btnUmschichtGehalt")?.addEventListener("click", () => ausfuehren(-1));
    },

    /**
     * Offene Ablöseraten: was der Verein noch zahlen muss und was ihm
     * zusteht, mit der Belastung im nächsten Monat.
     */
    renderRaten(state, club) {
        const el = document.getElementById("finRaten");
        const fin = typeof FinanceEngine !== "undefined" ? FinanceEngine : null;
        if (!el || !fin || typeof fin.ratenUebersicht !== "function") return;
        const u = fin.ratenUebersicht(state, club.id);
        if (!u.liste.length) { el.innerHTML = ""; return; }
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        el.innerHTML = `
            <h4>Ablöse in Raten</h4>
            <div class="finance-stat-row"><span>Wir schulden noch:</span><strong class="${u.schulden ? "text-danger" : ""}">${this.geldKurz(u.schulden)}</strong></div>
            <div class="finance-stat-row"><span>Uns stehen noch zu:</span><strong>${this.geldKurz(u.forderungen)}</strong></div>
            <p class="muted-note">Am nächsten Monatsersten: ${this.geldKurz(u.naechsterMonat.zahlen)} zahlen, ${this.geldKurz(u.naechsterMonat.erhalten)} erhalten. Gezahlte Raten gehen auch vom Transferbudget ab.</p>
            <ul class="raten-liste">
                ${u.liste.map(r => `<li class="raten-${r.richtung}">
                    <span>${esc(r.playerName)} <small>${r.richtung === "zahlen" ? "an" : "von"} ${esc(r.verein)}</small></span>
                    <span>${this.geldKurz(r.rate)} × ${r.restRaten} <small>offen ${this.geldKurz(r.offen)}</small></span>
                </li>`).join("")}
            </ul>`;
    },

    /**
     * Die Kaderkostenquote der laufenden Saison gegen die Grenze des
     * Verbands, dazu eine laufende Auflage und die letzten Saisons.
     */
    renderFinanzregeln(state, club) {
        const el = document.getElementById("finRegeln");
        const fr = typeof FinanzregelEngine !== "undefined" ? FinanzregelEngine : null;
        if (!el || !fr) return;
        const s = fr.stand(state);
        const pz = (q) => `${Math.round(q * 100)} %`;
        const status = {
            gruen: ["✅", "Im Rahmen"],
            gelb: ["⚠️", "Über der Grenze"],
            rot: ["⛔", "Punktabzug droht"]
        }[s.status];
        const breite = Math.min(100, Math.round(s.quote / 1.2 * 100));
        const f = state.finanzregel || {};
        const saison = state.seasonYear || 1;
        const auflage = f.auflage && f.auflage.saison === saison
            ? `<p class="fr-auflage">⚖️ Auflage des Verbands: Das Transferbudget dieser Saison ist halbiert${f.auflage.abzug ? `, dazu ${f.auflage.abzug} Punkte Abzug` : ""}.</p>` : "";
        const folgeText = { ok: "✓ im Rahmen", verwarnung: "Verwarnung", strafe: "Geldstrafe", abzug: "Punktabzug" };
        const verlauf = (f.verlauf || []).slice().reverse();
        el.innerHTML = `
            <h4>Kaderkosten nach Verbandsregel</h4>
            <div class="fr-kopf fr-${s.status}">
                <strong>${pz(s.quote)}</strong>
                <span>${status[0]} ${status[1]}</span>
            </div>
            <div class="fr-balken" role="img" aria-label="Kaderkostenquote ${pz(s.quote)}, Grenze ${pz(fr.GRENZE)}">
                <i class="fr-${s.status}" style="width:${breite}%"></i>
                <b style="left:${Math.round(fr.GRENZE / 1.2 * 100)}%" title="Grenze ${pz(fr.GRENZE)}"></b>
                <b class="fr-straf" style="left:${Math.round(fr.STRAFGRENZE / 1.2 * 100)}%" title="Strafgrenze ${pz(fr.STRAFGRENZE)}"></b>
            </div>
            <div class="finance-stat-row"><span>Umsatz der Saison:</span><strong>${this.geldKurz(s.umsatz)}</strong></div>
            <div class="finance-stat-row"><span>Gehälter und Trainerstab:</span><strong>${this.geldKurz(s.kader)}</strong></div>
            <div class="finance-stat-row"><span>Ablösen (ein Drittel zählt):</span><strong>${this.geldKurz(Math.round(s.abloesen / fr.ABLOESE_JAHRE))}</strong></div>
            ${auflage}
            <p class="muted-note">Erlaubt sind ${pz(fr.GRENZE)} des Umsatzes. Darüber gibt es erst eine Verwarnung, im Jahr darauf Geldstrafe und ein halbes Transferbudget. Über ${pz(fr.STRAFGRENZE)} kommen ${fr.ABZUG.erst} Punkte Abzug dazu. Abgerechnet wird am Saisonende.</p>
            ${verlauf.length ? `<ul class="raten-liste fr-verlauf">${verlauf.map(v => `<li class="fr-folge-${v.folge}">
                <span>Saison ${v.saison} <small>${pz(v.quote)}</small></span>
                <span>${folgeText[v.folge] || v.folge}${v.strafe ? ` <small>${this.geldKurz(v.strafe)}</small>` : ""}${v.abzug ? ` <small>−${v.abzug} Pkt.</small>` : ""}</span>
            </li>`).join("")}</ul>` : ""}`;
    },

    /**
     * Anfragen an den Vorstand auf der Vorstandskarte: was man erbitten
     * kann, wie die Aussichten stehen, und ob gerade beraten wird.
     */
    renderVorstandsAnfrage(state) {
        const el = document.getElementById("dashBoardAnfrage");
        const board = typeof BoardEngine !== "undefined" ? BoardEngine : null;
        if (!el || !board || !board.ANFRAGEN) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const offen = state.vorstandsAnfrage;
        if (offen) {
            const rest = Math.max(0, offen.entscheidetTag - board.stempel(state));
            el.innerHTML = `<div class="ba-kopf">Anfrage an den Vorstand</div>
                <div class="muted-note">„${esc(board.ANFRAGEN[offen.key]?.label)}“ liegt vor - Antwort ${this.wannText(rest)}.</div>`;
            return;
        }
        const aussicht = c => c >= 0.6 ? "gut" : (c >= 0.35 ? "offen" : "schlecht");
        const optionen = Object.entries(board.ANFRAGEN).map(([key, a]) => {
            const grund = board.anfrageHindernis(state, key);
            return `<option value="${key}" ${grund ? "disabled" : ""}>${esc(a.label)}${grund ? "" : ` · Aussichten ${aussicht(board.anfrageChance(state, key))}`}</option>`;
        }).join("");
        el.innerHTML = `<div class="ba-kopf">Anfrage an den Vorstand</div>
            <div class="ba-zeile">
                <select class="styled-select" id="vorstandsAnfrageWahl">${optionen}</select>
                <button class="btn btn-sm btn-secondary" id="btnVorstandsAnfrage">Anfragen</button>
            </div>
            <div class="muted-note">Der Vorstand berät ein paar Tage. Wer abblitzt und weiter drängt, verliert Vertrauen.</div>`;
        document.getElementById("btnVorstandsAnfrage")?.addEventListener("click", () => {
            const key = document.getElementById("vorstandsAnfrageWahl")?.value;
            const r = board.stelleAnfrage(state, key);
            if (!r.ok) { this.showToast(r.grund, "error"); return; }
            this.showToast(`Die Anfrage liegt dem Vorstand vor. Antwort in ${r.tage} Tagen.`, "info");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderVorstandsAnfrage(state);
        });
    },

    renderFinances() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

        const squad = state.players.filter(p => userClub.playerIds.includes(p.id));
        const weeklyWages = squad.reduce((sum, p) => sum + (p.wage || 0), 0);
        // Die Sponsorenzahlung kommt aus der Finanz-Engine, damit im Verein
        // dieselbe Zahl steht, die auch gebucht wird.
        const sponsorWeekly = this.sponsorProSpieltag(userClub);
        const matchIncomeEst = Math.round((userClub.capacity || 30000) * 0.85 * (userClub.ticketPrice || 35));

        const gehaltsQuote = userClub.wageBudget ? Math.round(weeklyWages / userClub.wageBudget * 100) : 0;
        this.renderKennzahlen("finKennzahlen", [
            { titel: "Kontostand", wert: this.geldKurz(userClub.balance || 0), klasse: (userClub.balance || 0) < 0 ? "gefahr" : "" },
            { titel: "Transferbudget", wert: this.geldKurz(userClub.transferBudget || 0) },
            { titel: "Gehälter / Woche", wert: this.geldKurz(weeklyWages),
                extra: `<span class="vk-balken"><i style="width:${Math.min(100, gehaltsQuote)}%"></i></span><small>${gehaltsQuote} % des Budgets</small>`,
                klasse: gehaltsQuote > 100 ? "gefahr" : (gehaltsQuote > 90 ? "warnung" : "") },
            { titel: "Sponsor / Spieltag", wert: this.geldKurz(sponsorWeekly) },
            { titel: "Heimspiel", wert: this.geldKurz(matchIncomeEst), extra: `<small>geschätzte Einnahmen</small>` }
        ]);

        DOM.setText("finBalance", GameState.formatMoney(userClub.balance));
        DOM.setText("finTransferBudget", GameState.formatMoney(userClub.transferBudget));
        DOM.setText("finWageBudget", GameState.formatMoney(userClub.wageBudget));
        DOM.setText("finWageCosts", GameState.formatMoney(weeklyWages));
        DOM.setText("finCapacity", `${(userClub.capacity || 0).toLocaleString("de-DE")} Plätze`);
        DOM.setText("finMatchdayIncome", `ca. ${GameState.formatMoney(matchIncomeEst)}`);
        DOM.setText("finSponsorWeekly", GameState.formatMoney(sponsorWeekly));
        DOM.setText("finFanbase", `${(userClub.fanBase || 0).toLocaleString("de-DE")} Fans`);

        this.renderFacilityCosts(userClub);
        this.renderUmschichten(state, userClub);
        this.renderRaten(state, userClub);
        this.renderFinanzregeln(state, userClub);

        // Transaktionshistorie (D5)
        const txnsBody = document.getElementById("finTransactionsBody");
        if (txnsBody) {
            const txns = (state.finances?.transactions || []).filter(t => t.clubId === userClub.id).slice(0, 30);
            if (txns.length === 0) {
                txnsBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Noch keine Buchungen erfasst.</td></tr>`;
            } else {
                txnsBody.innerHTML = txns.map(t => {
                    const isPositive = t.amount >= 0;
                    const amountFormatted = (isPositive ? "+" : "") + GameState.formatMoney(t.amount);
                    const color = isPositive ? "#34d399" : "#f87171";
                    return `
                        <tr>
                            <td><span style="font-size:12px; color:var(--text-muted);">${t.date}</span></td>
                            <td>${t.description}</td>
                            <td><strong style="color:${color};">${amountFormatted}</strong></td>
                        </tr>
                    `;
                }).join("");
            }
        }
    },
});
