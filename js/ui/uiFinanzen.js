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

    /** Wie die Arten der Buchungen auf der Finanzseite heißen */
    FINANZ_ARTEN: {
        ticket_income: "Zuschauer", sponsor_income: "Sponsor", merch_income: "Fanartikel", sponsor_event: "Sponsorenaktionen",
        prize_money: "Prämien und Fernsehgeld", prize: "Prämien", transfer_in: "Transfers", investor: "Investor", board_support: "Vorstand",
        other: "Sonstiges", wages: "Gehälter", staff_wages: "Trainerstab", facility_cost: "Anlagen", operating_cost: "Betrieb",
        bonus: "Prämien", transfer_out: "Transfers", scouting: "Scouting", youth_academy: "Jugend", youth_scouting: "Jugend",
        youth_compensation: "Ausbildungsentschädigung", trainingslager: "Trainingslager", abfindung: "Abfindungen"
    },

    /** Der Kontoverlauf als Linie: Monatsstände und heute, Werte als Tooltip */
    finanzVerlaufSvg(punkte) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        if (!punkte.length) return "";
        const B = 300, H = 90, rand = 8;
        const werte = punkte.map(p => p.saldo);
        let lo = Math.min(...werte), hi = Math.max(...werte);
        if (hi - lo < 1) { lo -= 1; hi += 1; }
        const x = (i) => punkte.length === 1 ? B / 2 : rand + i * (B - 2 * rand) / (punkte.length - 1);
        const y = (v) => rand + (hi - v) / (hi - lo) * (H - 2 * rand);
        const linie = punkte.map((p, i) => `${x(i).toFixed(1)},${y(p.saldo).toFixed(1)}`).join(" ");
        const null_ = lo < 0 && hi > 0 ? `<line class="fin-null" x1="0" x2="${B}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>` : "";
        return `
            <svg class="fin-verlauf" viewBox="0 0 ${B} ${H}" preserveAspectRatio="none" role="img" aria-label="Kontoverlauf über ${punkte.length} Stände">
                ${null_}
                ${punkte.length > 1 ? `<polyline class="fin-linie" points="${linie}"/>` : ""}
            </svg>
            <div class="fin-verlauf-punkte">${punkte.map((p, i) => `<span class="fin-punkt${p.heute ? " heute" : ""}${p.saldo < 0 ? " minus" : ""}" style="left:${(x(i) / B * 100).toFixed(2)}%;top:${(y(p.saldo) / H * 100).toFixed(2)}%" title="${esc(p.heute ? `Heute (${p.datum})` : p.datum)}: ${esc(this.geldKurz(p.saldo))}"></span>`).join("")}</div>`;
    },

    /**
     * Die Finanzen auf einen Blick, in Kacheln wie im Vorbild: Kontostand mit
     * Verlauf, Einnahmen und Ausgaben des Monats, Finanzregeln, Schulden,
     * Gehälter nach Kaderrolle, Sponsoren und die Prognose.
     */
    renderFinanzKacheln(state, club) {
        const el = document.getElementById("finKacheln");
        const fin = typeof FinanceEngine !== "undefined" ? FinanceEngine : null;
        if (!el || !fin || typeof fin.monatsBilanz !== "function") return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const geld = (b) => this.geldKurz(b || 0);
        const kachel = (titel, icon, inhalt, klasse = "") => `
            <div class="dash-card fin-kachel ${klasse}">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#${icon}"/></svg>${esc(titel)}</h4>
                ${inhalt}
            </div>`;
        const arten = (nachArt, vorzeichen) => Object.entries(nachArt)
            .filter(([, b]) => vorzeichen > 0 ? b > 0 : b < 0)
            .reduce((m, [art, b]) => { const n = this.FINANZ_ARTEN[art] || "Sonstiges"; m.set(n, (m.get(n) || 0) + Math.abs(b)); return m; }, new Map());
        const top = (map, n = 3) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n)
            .map(([name, b]) => `<div class="pf-zeile"><span>${esc(name)}</span><strong>${geld(b)}</strong></div>`).join("");
        const saison = (s) => typeof this.profilSaisonText === "function" ? this.profilSaisonText(s) : `Saison ${s}`;

        // Übersicht: Kontostand und Verlauf
        const verlauf = fin.kontoVerlauf(state);
        const stande = verlauf.filter(p => !p.heute).slice(-3).reverse();
        const uebersicht = kachel("Übersicht", "i-wallet", `
            <div class="fin-gross${(club.balance || 0) < 0 ? " pf-ton-schlecht" : ""}">${geld(club.balance)}</div>
            <div class="fin-unter">Kontostand</div>
            <div class="fin-verlauf-box">${this.finanzVerlaufSvg(verlauf)}</div>
            ${stande.length ? `<table class="compact-table pf-tabelle fin-tabelle"><thead><tr><th>Monat</th><th>Kontostand</th></tr></thead>
                <tbody>${stande.map(p => `<tr><td>${esc(p.datum)}</td><td class="${p.saldo < 0 ? "pf-ton-schlecht" : ""}">${geld(p.saldo)}</td></tr>`).join("")}</tbody></table>`
                : `<p class="pf-klein">Am Monatsersten kommt der erste Stand in den Verlauf.</p>`}`, "fin-uebersicht");

        // Einnahmen und Ausgaben des Monats
        const monat = fin.monatsBilanz(state);
        const fr = typeof FinanzregelEngine !== "undefined" ? FinanzregelEngine.stand(state) : null;
        const einnahmen = kachel("Einnahmen", "i-chart", `
            <div class="fin-gross pf-ton-gut">${geld(monat.einnahmen)}</div>
            <div class="fin-unter">diesen Monat</div>
            ${top(arten(monat.nachArt, 1))}
            ${fr ? `<p class="pf-klein fin-fuss">Umsatz der Saison: <strong>${geld(fr.umsatz)}</strong></p>` : ""}`);
        const ausgaben = kachel("Ausgaben", "i-wallet", `
            <div class="fin-gross pf-ton-schlecht">${geld(monat.ausgaben)}</div>
            <div class="fin-unter">diesen Monat</div>
            ${top(arten(monat.nachArt, -1))}`);

        // Finanzregeln
        const fre = typeof FinanzregelEngine !== "undefined" ? FinanzregelEngine : null;
        const regelText = { gruen: ["i-check", "Im Rahmen", "gut"], gelb: ["i-alert", "Über der Grenze", "mittel"], rot: ["i-alert", "Punktabzug droht", "schlecht"] };
        const regel = fr ? regelText[fr.status] : null;
        const regeln = kachel("Finanzregeln", "i-shield", fr ? `
            <div class="fin-regel pf-ton-${regel[2]}"><svg class="ico" aria-hidden="true"><use href="#${regel[0]}"/></svg>${esc(regel[1])}</div>
            <div class="pf-zeile"><span>Kaderkosten</span><strong>${Math.round(fr.quote * 100)} % des Umsatzes</strong></div>
            <div class="pf-zeile"><span>Grenze</span><strong>${Math.round(fre.GRENZE * 100)} %</strong></div>
            <p class="pf-klein">Abgerechnet wird am Saisonende. Mehr unter <em>Budgets</em>.</p>` : `<p class="pf-klein">Keine Regel in dieser Liga.</p>`);

        // Schulden und Raten
        const sch = fin.schulden(state, club);
        const schulden = kachel("Schulden und Raten", "i-doc", `
            <div class="fin-gross${sch.gesamt > 0 ? " pf-ton-schlecht" : ""}">${geld(sch.gesamt)}</div>
            <div class="fin-unter">offene Schulden</div>
            ${sch.raten ? `<div class="pf-zeile"><span>Ablöse in Raten</span><strong>${geld(sch.raten)}</strong></div>` : ""}
            ${sch.baukredite ? `<div class="pf-zeile"><span>Baukredite</span><strong>${geld(sch.baukredite)}</strong></div>` : ""}
            ${sch.forderungen ? `<div class="pf-zeile"><span>Uns stehen zu</span><strong class="pf-ton-gut">${geld(sch.forderungen)}</strong></div>` : ""}
            ${sch.naechsterMonat ? `<div class="pf-zeile"><span>Fällig im nächsten Monat</span><strong>${geld(sch.naechsterMonat)}</strong></div>` : ""}`);

        // Gehälter nach Kaderrolle gegen das Budget; aufgeklappte Gruppen bleiben offen
        const g = fin.gehaltNachRolle(state, club);
        const offen = this._finOffeneRollen || (this._finOffeneRollen = new Set());
        const quote = g.budget ? g.summe / g.budget : 0;
        const ton = quote > 1 ? "schlecht" : (quote > 0.9 ? "mittel" : "gut");
        const gehaelter = kachel("Gehälter", "i-users", `
            <div class="fin-gehalt"><span class="fin-gross pf-ton-${ton === "gut" ? "" : ton}">${geld(g.summe)}</span><span class="fin-budget">/ ${geld(g.budget)}</span><strong class="pf-ton-${ton}">${Math.round(quote * 100)} %</strong></div>
            <div class="fin-unter">Gehälter je Woche / Budget</div>
            <span class="fin-balken"><i class="fin-${ton}" style="width:${Math.min(100, Math.round(quote * 100))}%"></i></span>
            <div class="fin-rollen">${g.liste.map(e => {
                const zeile = `<span><b>${e.anzahl}</b> ${esc(e.rolle)}</span><strong>${geld(e.summe)}</strong>`;
                if (!e.anzahl) return `<div class="pf-zeile">${zeile}</div>`;
                // Ein Klick auf die Gruppe zeigt, wer dazugehört und was er verdient
                return `<details class="fin-rolle" data-fin-rolle="${esc(e.rolle)}"${offen.has(e.rolle) ? " open" : ""}>
                    <summary class="pf-zeile">${zeile}</summary>
                    <div class="fin-rolle-spieler">${e.spieler.map(p => `
                        <button type="button" class="fin-spieler" data-fin-spieler="${esc(p.id)}" title="Profil von ${esc(p.name)}">
                            <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span>
                            <span class="fin-spieler-name">${esc(p.name)}</span>
                            <small>${p.vertrag !== null ? `${esc(p.vertrag)} J.` : ""}</small>
                            <strong>${geld(p.wage)}</strong>
                        </button>`).join("")}</div>
                </details>`;
            }).join("")}</div>`, "fin-hoch");

        // Sponsoren
        const sp = fin.sponsoring(state, club);
        const farben = ["fin-s1", "fin-s2", "fin-s3", "fin-s4"];
        const sponsoren = kachel("Sponsoren", "i-briefcase", `
            <div class="fin-gross">${geld(sp.summe)}</div>
            <div class="fin-unter">Sponsoring der Saison</div>
            <div class="fin-segmente" role="img" aria-label="Anteile am Sponsoring">${sp.posten.map((p, i) => `<i class="${farben[i % farben.length]}" style="flex-grow:${Math.max(1, p.betrag)}" title="${esc(p.name)}: ${esc(geld(p.betrag))}"></i>`).join("")}</div>
            <div class="fin-posten">${sp.posten.map((p, i) => `<div class="pf-zeile"><span><i class="fin-punkt-farbe ${farben[i % farben.length]}"></i>${esc(p.name)}${p.hinweis ? ` <small>${esc(p.hinweis)}</small>` : ""}</span><strong>${geld(p.betrag)}</strong></div>`).join("")}</div>`, "fin-hoch");

        // Prognose
        const pr = fin.prognose(state, club);
        const s = state.seasonYear || 1;
        const block = (titel, w, mitBudget) => `
            <div class="fin-prognose">
                <h5>${esc(titel)}</h5>
                <div class="fin-prog-zahlen">
                    <div><span>Kontostand</span><strong class="${w.saldo < 0 ? "pf-ton-schlecht" : "pf-ton-gut"}">${geld(w.saldo)}</strong></div>
                    <div><span>Umsatz</span><strong>${geld(w.umsatz)}</strong></div>
                    ${mitBudget ? `<div><span>Transferbudget</span><strong>${geld(w.transferbudget)}</strong></div>` : ""}
                </div>
            </div>`;
        const prognose = kachel("Prognose", "i-target", `
            ${block(`Ende der Saison ${saison(s)}`, pr.diese, true)}
            ${block(`Ende der Saison ${saison(s + 1)}`, pr.naechste, false)}
            <p class="pf-klein">${pr.ausBuchungen ? "Aus den Buchungen je Spieltag" : "Aus den Schätzungen je Spieltag"} (${pr.nettoJeSpieltag >= 0 ? "+" : "−"}${geld(Math.abs(pr.nettoJeSpieltag))}), ohne Transfers, Prämien und Investor.</p>`, "fin-hoch");

        el.innerHTML = `
            ${uebersicht}
            <div class="fin-spalte">${einnahmen}${ausgaben}</div>
            <div class="fin-spalte">${regeln}${schulden}</div>
            ${gehaelter}${sponsoren}${prognose}`;
        if (typeof el.querySelectorAll !== "function") return;
        el.querySelectorAll("details[data-fin-rolle]").forEach(d => d.addEventListener("toggle", () => {
            if (d.open) offen.add(d.dataset.finRolle); else offen.delete(d.dataset.finRolle);
        }));
        el.querySelectorAll("[data-fin-spieler]").forEach(b => b.addEventListener("click", () => {
            const id = this.resolvePlayerId(b.dataset.finSpieler);
            if (id !== null) this.showPlayerDetailsModal(id);
        }));
    },

    renderFinances() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;
        this.renderFinanzKacheln(state, userClub);

        const squad = state.players.filter(p => userClub.playerIds.includes(p.id));
        const weeklyWages = squad.reduce((sum, p) => sum + (p.wage || 0), 0);
        // Die Sponsorenzahlung kommt aus der Finanz-Engine, damit im Verein
        // dieselbe Zahl steht, die auch gebucht wird.
        const sponsorWeekly = this.sponsorProSpieltag(userClub);
        // Fanartikel: was der Fanshop gerade je Spieltag bringt, und wessen Trikot am besten geht
        const finanzen = typeof FinanceEngine !== "undefined" ? FinanceEngine : null;
        const fanartikel = finanzen && typeof finanzen.fanartikelJeSpieltag === "function" ? finanzen.fanartikelJeSpieltag(state, userClub) : 0;
        const fanartikelFaktor = finanzen && typeof finanzen.fanartikelFaktor === "function" ? finanzen.fanartikelFaktor(state, userClub) : 1;
        const bestseller = finanzen && typeof finanzen.bestseller === "function" ? finanzen.bestseller(state, userClub) : null;
        const matchIncomeEst = Math.round((userClub.capacity || 30000) * 0.85 * (userClub.ticketPrice || 35));

        const gehaltsQuote = userClub.wageBudget ? Math.round(weeklyWages / userClub.wageBudget * 100) : 0;
        this.renderKennzahlen("finKennzahlen", [
            { titel: "Kontostand", wert: this.geldKurz(userClub.balance || 0), klasse: (userClub.balance || 0) < 0 ? "gefahr" : "" },
            { titel: "Transferbudget", wert: this.geldKurz(userClub.transferBudget || 0) },
            { titel: "Gehälter / Woche", wert: this.geldKurz(weeklyWages),
                extra: `<span class="vk-balken"><i style="width:${Math.min(100, gehaltsQuote)}%"></i></span><small>${gehaltsQuote} % des Budgets</small>`,
                klasse: gehaltsQuote > 100 ? "gefahr" : (gehaltsQuote > 90 ? "warnung" : "") },
            { titel: "Sponsor / Spieltag", wert: this.geldKurz(sponsorWeekly) },
            { titel: "Fanartikel / Spieltag", wert: this.geldKurz(fanartikel),
                extra: bestseller ? `<small>👕 ${this.escapeHtml(bestseller.name)}</small>` : "",
                klasse: fanartikelFaktor >= 1.25 ? "gut" : "" },
            { titel: "Heimspiel", wert: this.geldKurz(matchIncomeEst), extra: `<small>geschätzte Einnahmen</small>` }
        ]);

        DOM.setText("finBalance", GameState.formatMoney(userClub.balance));
        DOM.setText("finTransferBudget", GameState.formatMoney(userClub.transferBudget));
        DOM.setText("finWageBudget", GameState.formatMoney(userClub.wageBudget));
        DOM.setText("finWageCosts", GameState.formatMoney(weeklyWages));
        DOM.setText("finCapacity", `${(userClub.capacity || 0).toLocaleString("de-DE")} Plätze`);
        DOM.setText("finMatchdayIncome", `ca. ${GameState.formatMoney(matchIncomeEst)}`);
        DOM.setText("finSponsorWeekly", GameState.formatMoney(sponsorWeekly));
        DOM.setText("finMerchWeekly", `${GameState.formatMoney(fanartikel)} (${Math.round(fanartikelFaktor * 100)} % des Üblichen)`);
        DOM.setText("finMerchBestseller", bestseller ? bestseller.name : "-");
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
