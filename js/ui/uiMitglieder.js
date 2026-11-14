/**
 * Fanprotest und Mitgliederversammlung (MitgliederEngine): die beiden
 * Dialoge, in denen der Trainer nach außen Stellung nimmt.
 *
 * Beide öffnen sich aus der Post dazu (Knopf unter der Nachricht).
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    _mgEngine() {
        if (typeof MitgliederEngine !== "undefined" && MitgliederEngine) return MitgliederEngine;
        return (typeof window !== "undefined" && window.MitgliederEngine) || null;
    },

    _mgFertig(text, ton = "success") {
        const state = this.app.state;
        this.playSound?.("click");
        this.showToast(text, ton, 7000);
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderHeader?.();
        this.renderCurrentTab?.();
    },

    /** Steht eine Antwort auf einen Fanprotest aus? */
    fanprotestOffen() {
        const M = this._mgEngine();
        return !!(M && this.app?.state && M.protest(this.app.state));
    },

    /** Steht die Mitgliederversammlung an? */
    mitgliederOffen() {
        const M = this._mgEngine();
        return !!(M && this.app?.state && M.versammlung(this.app.state));
    },

    zeigeFanprotest() {
        const M = this._mgEngine();
        const state = this.app?.state;
        if (!M || !state || typeof this.zeigeEntscheidung !== "function") return;
        if (!M.protest(state)) { this.showToast("Der Protest ist vorbei.", "info"); return; }
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const A = M.PROTEST.antworten;
        const pct = (x) => `${Math.round(x * 100)} %`;
        const antworte = (art) => {
            const r = M.antworte(state, art);
            if (!r.ok) { this.showToast(r.grund, "error"); return false; }
            this._mgFertig(r.text, r.gekippt ? "error" : (art === "kurve" ? "success" : "warning"));
            return true;
        };
        const weg = (key) => {
            const a = A[key];
            const leer = a.boykott > 0 ? `${pct(a.boykott)} der Plätze bleiben beim nächsten Heimspiel leer` : "kein Boykott";
            const risiko = a.risiko ? ` · kippt in ${pct(a.risiko)} der Fälle` : "";
            return `<div class="med-weg"><h4>${esc(a.label)}</h4><p>${esc(a.text)}</p>
                <div class="med-zeilen"><div><span>Fanstimmung</span><strong>${a.stimmung > 0 ? "+" : "±"}${a.stimmung}</strong></div><div><span>Folge</span><strong>${esc(leer + risiko)}</strong></div></div></div>`;
        };
        this.zeigeEntscheidung({
            titel: "Fanprotest",
            html: `
                <div class="verh-zahlen">
                    <div><span>Fanstimmung</span><strong class="pf-ton-schlecht">${Math.round(state.fanMood ?? 70)}</strong></div>
                    <div><span>Angekündigt</span><strong>Stimmungsboykott</strong></div>
                </div>
                <p class="taktik-hilfe">Die Kurve schweigt, bis sie eine Antwort bekommt. Sie können einmal antworten.</p>
                <div class="med-wege">${Object.keys(A).map(weg).join("")}</div>`,
            knoepfe: [
                { text: A.aussitzen.label, klasse: "btn-secondary", aktion: () => antworte("aussitzen") },
                { text: A.geduld.label, klasse: "btn-secondary", aktion: () => antworte("geduld") },
                { text: A.kurve.label, klasse: "btn-primary", aktion: () => antworte("kurve") }
            ]
        });
    },

    zeigeMitgliederversammlung() {
        const M = this._mgEngine();
        const state = this.app?.state;
        if (!M || !state || typeof this.zeigeEntscheidung !== "function") return;
        if (!M.versammlung(state)) { this.showToast("Es steht keine Mitgliederversammlung an.", "info"); return; }
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const fragen = M.fragen(state);
        const wahl = {};
        const html = `
            <p class="taktik-hilfe">Drei Fragen, je eine Antwort. Was eine Antwort bewirkt, hängt an der Lage: Offenheit zahlt sich in der Krise aus, Schönreden rächt sich. Danach stimmen die Mitglieder über die Entlastung ab.</p>
            ${fragen.map(f => `
            <fieldset class="mg-frage" data-mg-thema="${esc(f.thema)}">
                <legend><span class="header-tag ${f.lage === "schlecht" ? "mg-schlecht" : ""}">${f.lage === "schlecht" ? "angespannt" : "entspannt"}</span> ${esc(f.frage)}</legend>
                ${f.antworten.map(a => `
                <label class="mg-antwort"><input type="radio" name="mg_${esc(f.thema)}" value="${esc(a.key)}">
                    <span><strong>${esc(a.label)}</strong><small>${esc(a.text)}</small></span></label>`).join("")}
            </fieldset>`).join("")}`;
        this.zeigeEntscheidung({
            titel: "Mitgliederversammlung",
            html,
            knoepfe: [
                { text: "Später", klasse: "btn-secondary" },
                { text: "Rede halten", klasse: "btn-primary", aktion: () => {
                    const r = M.halteRede(state, wahl);
                    if (!r.ok) { this.showToast(r.grund, "error"); return false; }
                    this._mgFertig(r.text, r.urteil === "klar" ? "success" : (r.urteil === "knapp" ? "warning" : "error"));
                    return true;
                } }
            ],
            nachOeffnen: (el) => el.querySelectorAll("input[type=radio]").forEach(inp => inp.addEventListener("change", () => {
                wahl[inp.name.replace(/^mg_/, "")] = inp.value;
            }))
        });
    }
});
