/**
 * Behandlung Verletzter: fitspritzen, früher zurückholen, intensive Reha
 * (MedizinEngine).
 *
 * Ein Dialog mit dem Rat des Mannschaftsarztes: was geht, was es kostet,
 * wie riskant es ist. Er öffnet sich aus der Akte (Aktionen und Kachel
 * Fitness), aus dem Kontextmenü der Kaderliste und aus dem ärztlichen
 * Befund im Postfach. Wer fitgespritzt spielt, trägt in den Listen ein 💉.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    _medizinEngine() {
        if (typeof MedizinEngine !== "undefined" && MedizinEngine) return MedizinEngine;
        return (typeof window !== "undefined" && window.MedizinEngine) || null;
    },

    /** Steht für diesen Spieler eine Behandlung zur Wahl? */
    medizinBehandelbar(p) {
        const M = this._medizinEngine();
        return !!(M && p && this.app?.state && M.behandelbar(this.app.state, p));
    },

    /** Das 💉 hinter dem Namen eines Fitgespritzten */
    medizinMarke(p) {
        const a = p?.angeschlagen;
        if (!a) return "";
        const titel = `${this._medizinArt(a)} (${a.name}), noch ${a.wochen} ${a.wochen === 1 ? "Woche" : "Wochen"} angeschlagen`;
        return `<span class="med-marke" title="${this.escapeHtml(titel)}" aria-label="${this.escapeHtml(titel)}">💉</span>`;
    },

    /** Kurztext für Listen: "Fitgespritzt · noch 1 Wo." */
    medizinStatus(p) {
        const a = p?.angeschlagen;
        if (!a) return "";
        return `${this._medizinArt(a)} · noch ${a.wochen} Wo.`;
    },

    _medizinArt(a) {
        return a.art === "frueh" ? "Früher zurück" : (a.art === "konservativ" ? "Im Aufbau" : "Fitgespritzt");
    },

    _medizinProzent(r) {
        return `${Math.round((r || 0) * 100)} %`;
    },

    _medizinWochen(w) {
        return `${w} ${w === 1 ? "Woche" : "Wochen"}`;
    },

    /** Der Inhalt des Dialogs: Befund, Arzt und die Wege zur Wahl */
    behandlungHtml(p, o) {
        const state = this.app.state;
        const M = this._medizinEngine();
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const club = (state.clubs || []).find(c => c.id === p.clubId);
        const arzt = M.arzt(club);
        const sterne = typeof this.stabSterneHtml === "function" ? this.stabSterneHtml(arzt.guete) : "";
        const geld = (b) => (typeof this.geldKurz === "function" ? this.geldKurz(b) : `${b} €`);

        const befund = o.absetzen
            ? `<div><span>Zustand</span><strong>${esc(this.medizinStatus(p))}</strong></div>
               <div><span>Verletzung</span><strong>${esc(o.absetzen.name)}</strong></div>
               <div><span>Risiko je Einsatz</span><strong class="pf-ton-${o.absetzen.rat.stufe}">${this._medizinProzent(o.absetzen.risiko)} · ${esc(o.absetzen.rat.text)}</strong></div>`
            : `<div><span>Diagnose</span><strong>${esc(p.injuryName || "Verletzung")}</strong></div>
               <div><span>Ausfall</span><strong>noch ${esc(this._medizinWochen(p.injuredWeeks || 0))}</strong></div>
               <div><span>Kondition</span><strong>${Math.round(p.fitness ?? 0)} %</strong></div>`;

        const wege = [];
        if (o.absetzen) {
            wege.push(`<div class="med-weg">
                <h4>Spritzen absetzen</h4>
                <p>${esc(p.name)} wird geschont und fällt wieder ${esc(this._medizinWochen(o.absetzen.wochen))} aus. Dafür kann nichts mehr aufbrechen.</p>
            </div>`);
        }
        if (o.spritze) {
            const s = o.spritze;
            wege.push(`<div class="med-weg${s.ok ? "" : " med-weg-aus"}">
                <h4>${esc(s.titel)}</h4>
                ${s.ok ? `<p>Sofort einsatzbereit. Bis die Verletzung ausgeheilt wäre (${esc(this._medizinWochen(s.wochen))}), spielt er angeschlagen:
                    kein Mannschaftstraining, höchstens ${M.KONDITION_ANGESCHLAGEN} % Kondition.</p>
                    <div class="med-zeilen">
                        <div><span>Risiko je Einsatz</span><strong class="pf-ton-${s.rat.stufe}">${this._medizinProzent(s.risiko)} · ${esc(s.rat.text)}</strong></div>
                        <div><span>Bricht es auf</span><strong>${esc(s.folge.name)}, rund ${esc(this._medizinWochen(Math.max(s.folge.weeks, s.wochen + 1)))}</strong></div>
                    </div>`
                    : `<p class="text-muted">${esc(s.grund)}</p>`}
            </div>`);
        }
        if (o.reha) {
            const r = o.reha;
            wege.push(`<div class="med-weg${r.ok ? "" : " med-weg-aus"}">
                <h4>Intensive Reha</h4>
                ${r.ok ? `<p>Spezialisten und Einzeltraining im medizinischen Zentrum (Stufe ${esc(r.zentrum)}). Ohne Risiko, aber nicht umsonst.</p>
                    <div class="med-zeilen">
                        <div><span>Ausfall</span><strong>noch ${esc(this._medizinWochen(r.wochen - r.ersparnis))} statt ${esc(this._medizinWochen(r.wochen))}</strong></div>
                        <div><span>Kosten</span><strong>${esc(geld(r.kosten))}</strong></div>
                    </div>`
                    : `<p class="text-muted">${esc(r.grund)}</p>`}
            </div>`);
        }

        if (o.eingriff) {
            const e = o.eingriff;
            wege.push(`<div class="med-weg">
                <h4>Operation oder konservativ</h4>
                <p>Bei dieser Verletzung gibt es zwei Wege neben der normalen Behandlung. Die Wahl gilt einmal.</p>
                <div class="med-zeilen">
                    <div><span>Operation</span><strong>${esc(this._medizinWochen(e.op.wochen))} Ausfall · ${esc(geld(e.op.kosten))}</strong><small>Länger raus, danach weniger verletzungsanfällig.${e.op.ok ? "" : ` ${esc(e.op.grund)}`}</small></div>
                    <div><span>Konservativ</span><strong>${esc(this._medizinWochen(e.konservativ.wochen))} Ausfall</strong><small>Schneller zurück, dann ${esc(this._medizinWochen(e.konservativ.aufbau))} im Aufbau: rund ${this._medizinProzent(e.konservativ.risiko)} Rückfallrisiko je Einsatz (${esc(e.konservativ.folge.name)}).</small></div>
                </div>
            </div>`);
        }

        return `
            <div class="verh-kopf">
                <div><strong>${esc(p.name)}</strong> <span class="muted-note">(${esc(p.age)}) · ${esc(p.pos)}</span></div>
            </div>
            <div class="verh-zahlen">${befund}</div>
            <p class="med-arzt"><svg class="ico" aria-hidden="true"><use href="#i-medical"/></svg>
                ${arzt.name ? `Mannschaftsarzt ${esc(arzt.name)}` : "Medizinische Abteilung"} ${sterne}
                <span class="muted-note">Je besser der Arzt, desto kleiner das Risiko und desto mehr bringt die Reha.</span></p>
            <div class="med-wege">${wege.join("")}</div>`;
    },

    /** Der Behandlungsdialog für einen eigenen verletzten oder fitgespritzten Spieler */
    zeigeBehandlung(playerId) {
        const state = this.app?.state;
        const M = this._medizinEngine();
        const p = (state?.players || []).find(x => String(x.id) === String(playerId));
        if (!M || !p || typeof this.zeigeEntscheidung !== "function") return;
        const o = M.optionen(state, p);
        if (!o.spritze && !o.reha && !o.absetzen) {
            this.showToast(`${p.name} braucht keine Behandlung.`, "info");
            return;
        }
        const knoepfe = [];
        if (o.absetzen) knoepfe.push({ text: p.angeschlagen?.art === "konservativ" ? "Schonen" : "Spritzen absetzen", klasse: "btn-primary", aktion: () => this.medizinAusfuehren("absetzen", p.id) });
        if (o.reha?.ok) knoepfe.push({ text: `Intensive Reha (${this.geldKurz ? this.geldKurz(o.reha.kosten) : o.reha.kosten})`, klasse: "btn-primary", aktion: () => this.medizinAusfuehren("reha", p.id) });
        if (o.eingriff?.op.ok) knoepfe.push({ text: "Operation", klasse: "btn-primary", aktion: () => this.medizinAusfuehren("op", p.id) });
        if (o.eingriff) knoepfe.push({ text: "Konservativ", klasse: "btn-primary", aktion: () => this.medizinAusfuehren("konservativ", p.id) });
        if (o.spritze?.ok) knoepfe.push({ text: o.spritze.titel, klasse: o.spritze.rat.stufe === "schlecht" ? "btn-danger" : "btn-primary", aktion: () => this.medizinAusfuehren("spritze", p.id) });
        const aufbau = p.angeschlagen?.art === "konservativ";
        knoepfe.push({ text: o.absetzen ? (aufbau ? "Weiter aufbauen" : "Weiter spritzen") : "Abwarten", klasse: "btn-secondary" });
        this.zeigeEntscheidung({ titel: o.absetzen ? (aufbau ? "Im Aufbau" : "Fitgespritzt") : "Behandlung", html: this.behandlungHtml(p, o), knoepfe });
    },

    /** Freie Tage stehen zur Wahl (müde, gesund, noch nicht frei) */
    medizinFreiMoeglich(p) {
        const M = this._medizinEngine();
        return !!(M && p && this.app?.state && M.optionen(this.app.state, p).frei?.ok);
    },

    /** Eine Behandlung ausführen, melden, speichern und neu zeichnen */
    medizinAusfuehren(art, playerId) {
        const state = this.app.state;
        const M = this._medizinEngine();
        if (!M) return null;
        const res = art === "spritze" ? M.fitspritzen(state, playerId)
            : art === "reha" ? M.intensiveReha(state, playerId)
                : art === "op" || art === "konservativ" ? M.waehleEingriff(state, playerId, art)
                    : art === "frei" ? M.gibFrei(state, playerId)
                        : M.absetzen(state, playerId);
        if (!res || !res.ok) { this.showToast(res?.grund || "Das geht nicht.", "error", 6000); return res; }
        this.playSound?.("click");
        this.showToast(art === "spritze" ? `💉 ${res.text}` : res.text, art === "spritze" && res.risiko >= M.RAT.abraten ? "warning" : "success", 6000);
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderHeader?.();
        this.renderCurrentTab?.();
        const akte = typeof document !== "undefined" ? document.getElementById("modalPlayerDetails") : null;
        if (akte && akte.style.display !== "none" && typeof this.showPlayerDetailsModal === "function") this.showPlayerDetailsModal(playerId);
        return res;
    }
});
