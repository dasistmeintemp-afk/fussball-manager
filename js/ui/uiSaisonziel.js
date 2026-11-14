/**
 * Persönliche Saisonziele vereinbaren und ansehen (SaisonzielEngine).
 *
 * Der Dialog öffnet sich aus der Akte (Aktionen, Kabine) und per Rechtsklick.
 * Ohne Ziel zeigt er je Art drei Stufen mit Ziel, Prämie und der Reaktion des
 * Spielers; mit Ziel den Stand.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    _szEngine() {
        if (typeof SaisonzielEngine !== "undefined" && SaisonzielEngine) return SaisonzielEngine;
        return (typeof window !== "undefined" && window.SaisonzielEngine) || null;
    },

    /** Gibt es für ihn etwas zu tun oder zu sehen: ein Ziel vereinbaren oder den Stand? */
    saisonzielMoeglich(p) {
        const Z = this._szEngine();
        const state = this.app?.state;
        if (!Z || !state || !p) return false;
        return !!Z.ziel(state, p) || Z.pruefe(state, p).ok;
    },

    /** Kurztext für Listen und die Akte: "Saisonziel: 7 von 10 Toren" */
    saisonzielText(p) {
        const Z = this._szEngine();
        const z = Z && this.app?.state ? Z.ziel(this.app.state, p) : null;
        if (!z) return "";
        return `Saisonziel: ${z.stand} von ${z.ziel} ${Z.ARTEN[z.art].von}${z.erreicht ? " (erreicht)" : ""}`;
    },

    _szVereinbare(playerId, art, stufe) {
        const Z = this._szEngine();
        const state = this.app?.state;
        const r = Z.vereinbare(state, playerId, art, stufe);
        if (!r.ok) { this.showToast(r.grund, "error", 6000); return r; }
        this.playSound?.("click");
        this.showToast(r.text, r.reaktion.moral < 0 ? "warning" : "success", 6000);
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderHeader?.();
        this.renderCurrentTab?.();
        const akte = typeof document !== "undefined" ? document.getElementById("modalPlayerDetails") : null;
        if (akte && akte.style.display !== "none" && typeof this.showPlayerDetailsModal === "function") this.showPlayerDetailsModal(playerId);
        return r;
    },

    saisonzielHtml(p) {
        const Z = this._szEngine();
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const geld = (b) => (typeof this.geldKurz === "function" ? this.geldKurz(b) : `${b} €`);
        const kopf = `<div class="verh-kopf"><div><strong>${esc(p.name)}</strong> <span class="muted-note">(${esc(p.age)}) · ${esc(p.pos)}</span></div></div>`;
        const z = Z.ziel(state, p);
        if (z) {
            const a = Z.ARTEN[z.art], s = Z.STUFEN[z.stufe];
            return `${kopf}
                <div class="verh-zahlen">
                    <div><span>Ziel (${esc(s.label)})</span><strong>${z.ziel} ${esc(a.label)}</strong></div>
                    <div><span>Stand</span><strong class="${z.erreicht ? "pf-ton-gut" : ""}">${z.stand}${z.erreicht ? " · erreicht" : ` · noch ${z.offen}`}</strong></div>
                    <div><span>Prämie</span><strong>${esc(geld(z.praemie))}${z.erreicht ? " · gezahlt" : ""}</strong></div>
                </div>
                <div class="ep-balken" aria-hidden="true"><span style="width:${Math.round(z.anteil * 100)}%"></span></div>
                <p class="taktik-hilfe">${z.erreicht ? "Das Ziel ist erreicht, die Prämie gezahlt." : "Erreicht er das Ziel, wird die Prämie sofort gezahlt und seine Moral steigt. Verfehlt er es bis zum Saisonende, ist er enttäuscht."}</p>`;
        }
        const check = Z.pruefe(state, p);
        if (!check.ok) return `${kopf}<p class="text-muted">${esc(check.grund)}</p>`;
        const vz = (n) => `${n > 0 ? "+" : (n < 0 ? "−" : "±")}${Math.abs(n)}`;
        const arten = Z.vorschlaege(state, p).map(v => `
            <div class="med-weg">
                <h4>${esc(v.label)} <span class="muted-note">zu erwarten: rund ${esc(String(v.erwartung).replace(".", ","))}</span></h4>
                <div class="sz-stufen">${v.stufen.map(s => `
                    <button class="sz-stufe" data-sz-art="${esc(v.art)}" data-sz-stufe="${esc(s.stufe)}">
                        <span class="sz-label">${esc(s.label)}</span>
                        <strong>${s.ziel}</strong>
                        <span>Prämie ${esc(geld(s.praemie))}</span>
                        <span class="${s.reaktion.moral > 0 ? "pf-ton-gut" : (s.reaktion.moral < 0 ? "pf-ton-schlecht" : "")}">${esc(s.reaktion.text)} (${vz(s.reaktion.moral)})</span>
                        <small>erreicht ${vz(s.erreicht)} · verfehlt ${vz(s.verfehlt)} Moral</small>
                    </button>`).join("")}
                </div>
            </div>`).join("");
        return `${kopf}
            <p class="taktik-hilfe">Ein Ziel je Spieler und Saison, mit höchstens ${Z.HOECHSTENS} Spielern, zu vereinbaren bis zum ${Z.BIS_SPIELTAG}. Spieltag. Wie er die Latte aufnimmt, hängt an seinem Ehrgeiz. Die Prämie zahlen Sie nur, wenn er das Ziel erreicht.</p>
            <div class="med-wege">${arten}</div>`;
    },

    zeigeSaisonziel(playerId) {
        const state = this.app?.state;
        const Z = this._szEngine();
        const p = (state?.players || []).find(x => String(x.id) === String(playerId));
        if (!Z || !p || typeof this.zeigeEntscheidung !== "function") return;
        const hat = !!Z.ziel(state, p);
        this.zeigeEntscheidung({
            titel: hat ? "Saisonziel" : "Saisonziel vereinbaren",
            html: this.saisonzielHtml(p),
            knoepfe: [{ text: hat ? "Schließen" : "Kein Ziel", klasse: "btn-secondary" }],
            nachOeffnen: (el) => el.querySelectorAll("[data-sz-art]").forEach(btn => btn.addEventListener("click", () => {
                const r = this._szVereinbare(p.id, btn.dataset.szArt, btn.dataset.szStufe);
                if (r.ok) { const modal = document.getElementById("modalEntscheidung"); if (modal) modal.style.display = "none"; }
            }))
        });
    }
});
