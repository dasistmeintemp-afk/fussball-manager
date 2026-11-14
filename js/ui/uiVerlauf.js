/**
 * Die Entwicklungskurve in der Akte: Stärke und Marktwert über die Monate
 * (VerlaufEngine), als zwei kleine Linien nebeneinander.
 *
 * Zwei Maße, zwei Diagramme - eine gemeinsame Achse gäbe es für Stärke und
 * Euro nicht. Jeder Punkt trägt Datum und Wert als Tooltip, darunter steht
 * die Veränderung seit dem ersten Punkt in Worten.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    _verlaufEngine() {
        if (typeof VerlaufEngine !== "undefined" && VerlaufEngine) return VerlaufEngine;
        return (typeof window !== "undefined" && window.VerlaufEngine) || null;
    },

    /** Eine Linie mit Punkten; wert(p) liefert die Zahl, text(p) den Tooltip */
    verlaufLinieHtml(punkte, wert, text, name) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const B = 300, H = 90, rand = 9;
        const werte = punkte.map(wert);
        let lo = Math.min(...werte), hi = Math.max(...werte);
        if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
        const x = (i) => punkte.length === 1 ? B / 2 : rand + i * (B - 2 * rand) / (punkte.length - 1);
        const y = (v) => rand + (hi - v) / (hi - lo) * (H - 2 * rand);
        const linie = punkte.map((p, i) => `${x(i).toFixed(1)},${y(wert(p)).toFixed(1)}`).join(" ");
        return `<div class="fin-verlauf-box vl-box">
            <svg class="fin-verlauf" viewBox="0 0 ${B} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(name)} über ${punkte.length} Stände">
                ${punkte.length > 1 ? `<polyline class="fin-linie" points="${linie}"/>` : ""}
            </svg>
            <div class="fin-verlauf-punkte">${punkte.map((p, i) => `<span class="fin-punkt${p.heute ? " heute" : ""}" style="left:${(x(i) / B * 100).toFixed(2)}%;top:${(y(wert(p)) / H * 100).toFixed(2)}%" title="${esc(p.heute ? `Heute (${p.datum})` : p.datum)}: ${esc(text(p))}"></span>`).join("")}</div>
        </div>`;
    },

    /** Die Karte "Entwicklung über die Zeit" für einen eigenen Spieler */
    entwicklungsKurveHtml(player) {
        const V = this._verlaufEngine();
        const state = this.app?.state;
        if (!V || !state || !player) return "";
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const punkte = V.verlauf(state, player);
        const geld = (b) => (typeof this.geldKurz === "function" ? this.geldKurz(b) : `${b} €`);
        const b = V.bilanz(state, player);
        const vz = (n, einheit = "") => `${n > 0 ? "+" : (n < 0 ? "−" : "±")}${Math.abs(n)}${einheit}`;
        const ton = (n) => (n > 0 ? "pf-ton-gut" : (n < 0 ? "pf-ton-schlecht" : ""));
        const kopf = (titel, jetzt, delta) => `<div class="vl-kopf"><span>${titel}</span><strong>${jetzt}</strong>${delta}</div>`;
        const letzter = punkte[punkte.length - 1];
        const hinweis = punkte.length < 3
            ? `<p class="muted-note">Die Kurve entsteht mit der Zeit: Am Ersten jedes Monats kommt ein Punkt dazu.</p>`
            : `<p class="muted-note">Ein Punkt je Monatserstem seit ${esc(b.seit)}, dazu der Stand von heute.</p>`;
        return `<div class="dash-card mb-3 vl-karte" id="pdVerlauf">
            <h4 class="gs-titel"><svg class="ico" aria-hidden="true"><use href="#i-chart"/></svg> Entwicklung über die Zeit</h4>
            <div class="vl-raster">
                <div>
                    ${kopf("Stärke", esc(letzter.staerke), b ? ` <em class="${ton(b.staerke)}">${vz(b.staerke)}</em>` : "")}
                    ${this.verlaufLinieHtml(punkte, p => p.staerke, p => `Stärke ${p.staerke}`, "Stärke")}
                </div>
                <div>
                    ${kopf("Marktwert", esc(geld(letzter.wert)), b ? ` <em class="${ton(b.wert)}">${b.wert === 0 ? "±0" : (b.wert > 0 ? "+" : "−") + esc(geld(Math.abs(b.wert)))}</em>` : "")}
                    ${this.verlaufLinieHtml(punkte, p => p.wert, p => `Marktwert ${geld(p.wert)}`, "Marktwert")}
                </div>
            </div>
            ${hinweis}
        </div>`;
    }
});
