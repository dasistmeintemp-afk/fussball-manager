/**
 * Vor dem Spiel festlegen: Wechselplan und die Schützen im Elfmeterschießen.
 *
 * Beides steht bei Aufstellung & Taktik im Bereich Standards. Der Wechselplan
 * (club.wechselplan, MatchEngine.wechselplanVon) läuft in jedem Spiel zur
 * angegebenen Minute, ob live oder sofort berechnet. Die Reihenfolge im
 * Elfmeterschießen (club.roles.elfmeterschiessen) nutzt CupEngine.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    WECHSELPLAN_MINUTEN: [46, 55, 60, 65, 70, 75, 80, 85],

    _planClub() {
        const state = this.app?.state;
        return (state?.clubs || []).find(c => c.id === state.userClubId) || null;
    },

    _planSpieler(ids) {
        const state = this.app?.state;
        return (ids || []).map(id => (state?.players || []).find(p => String(p.id) === String(id))).filter(Boolean);
    },

    _planMax() {
        const M = typeof MatchEngine !== "undefined" ? MatchEngine : (typeof window !== "undefined" ? window.MatchEngine : null);
        return M?.WECHSELPLAN_MAX || 5;
    },

    _planSpeichern() {
        const state = this.app?.state;
        if (state && typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
    },

    /** Der Wechselplan, wie er im Spielstand steht (ohne Lücken) */
    wechselplan() {
        const club = this._planClub();
        if (!club) return [];
        if (!Array.isArray(club.wechselplan)) club.wechselplan = [];
        return club.wechselplan;
    },

    /** Einen Wechsel anlegen: der erste Feldspieler der Elf, der noch nicht verplant ist, in der 60. Minute */
    wechselplanNeu(outId = null, minute = 60) {
        const club = this._planClub();
        const plan = this.wechselplan();
        if (!club || plan.length >= this._planMax()) return null;
        const verplant = new Set(plan.map(w => String(w.outId)));
        const elf = this._planSpieler(club.lineup);
        const raus = outId !== null && elf.some(p => String(p.id) === String(outId)) && !verplant.has(String(outId))
            ? elf.find(p => String(p.id) === String(outId))
            : elf.slice().reverse().find(p => p.pos !== "TW" && !verplant.has(String(p.id)));
        if (!raus) return null;
        const eintrag = { minute, outId: raus.id, inId: null };
        plan.push(eintrag);
        plan.sort((a, b) => a.minute - b.minute);
        this._planSpeichern();
        return eintrag;
    },

    /** Minute, Auswechselspieler oder Ersatz eines geplanten Wechsels ändern */
    wechselplanSetze(index, feld, wert) {
        const plan = this.wechselplan();
        const w = plan[index];
        if (!w) return false;
        if (feld === "minute") {
            const m = Math.round(Number(wert));
            if (!(m >= 1 && m <= 89)) return false;
            w.minute = m;
        } else if (feld === "outId") {
            if (plan.some((x, i) => i !== index && String(x.outId) === String(wert))) return false;
            const p = this._planSpieler([wert])[0];
            if (!p) return false;
            w.outId = p.id;
        } else if (feld === "inId") {
            const p = wert === "" || wert === null ? null : this._planSpieler([wert])[0];
            w.inId = p ? p.id : null;
        } else return false;
        plan.sort((a, b) => a.minute - b.minute);
        this._planSpeichern();
        return true;
    },

    wechselplanEntferne(index) {
        const plan = this.wechselplan();
        if (!plan[index]) return false;
        plan.splice(index, 1);
        this._planSpeichern();
        return true;
    },

    /** Die Karte Wechselplan bei den Standards */
    renderWechselplan() {
        const box = typeof document !== "undefined" ? document.getElementById("wechselplanKarte") : null;
        const club = this._planClub();
        if (!box || !club) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const plan = this.wechselplan();
        const elf = this._planSpieler(club.lineup);
        const bank = this._planSpieler(club.bench);
        const name = (p) => `${esc(p.name)} (${esc(p.pos)})`;
        const zeilen = plan.map((w, i) => {
            const raus = elf.find(p => String(p.id) === String(w.outId));
            const rein = w.inId === null ? null : bank.find(p => String(p.id) === String(w.inId));
            const minuten = this.WECHSELPLAN_MINUTEN.includes(w.minute) ? this.WECHSELPLAN_MINUTEN : this.WECHSELPLAN_MINUTEN.concat([w.minute]).sort((a, b) => a - b);
            const hinweis = !raus ? "Steht nicht in der Startelf, dieser Wechsel entfällt."
                : (w.inId !== null && !rein ? "Der Ersatz sitzt nicht auf der Bank, es kommt der Passendste." : "");
            return `<div class="wp-zeile${hinweis ? " wp-warn" : ""}">
                <select class="styled-select" data-wp="minute" data-wp-i="${i}" aria-label="Minute">${minuten.map(m => `<option value="${m}" ${m === w.minute ? "selected" : ""}>${m}.</option>`).join("")}</select>
                <label><span>Raus</span><select class="styled-select" data-wp="outId" data-wp-i="${i}">
                    ${raus ? "" : `<option value="" selected>nicht in der Elf</option>`}
                    ${elf.filter(p => String(p.id) === String(w.outId) || !plan.some(x => String(x.outId) === String(p.id))).map(p => `<option value="${esc(p.id)}" ${String(p.id) === String(w.outId) ? "selected" : ""}>${name(p)}</option>`).join("")}
                </select></label>
                <label><span>Rein</span><select class="styled-select" data-wp="inId" data-wp-i="${i}">
                    <option value="" ${rein ? "" : "selected"}>Passendster von der Bank</option>
                    ${bank.map(p => `<option value="${esc(p.id)}" ${rein && String(p.id) === String(rein.id) ? "selected" : ""}>${name(p)}</option>`).join("")}
                </select></label>
                <button class="btn btn-sm btn-secondary wp-weg" data-wp-weg="${i}" aria-label="Wechsel streichen" title="Wechsel streichen">✕</button>
                ${hinweis ? `<small class="wp-hinweis">${esc(hinweis)}</small>` : ""}
            </div>`;
        }).join("");
        const voll = plan.length >= this._planMax();
        box.innerHTML = `
            <h3>Wechselplan</h3>
            <p class="taktik-hilfe">Geplante Wechsel laufen in jedem Spiel zur angegebenen Minute, live wie in der Sofortberechnung. So begrenzen Sie auch die Einsatzzeit eines Rückkehrers. Solange noch ein geplanter Wechsel aussteht, wechselt der Co-Trainer nicht von sich aus.</p>
            ${zeilen || `<p class="text-muted wp-leer">Kein Wechsel geplant.</p>`}
            <button class="btn btn-sm btn-secondary" id="btnWechselplanNeu" ${voll ? "disabled" : ""}>+ Wechsel planen</button>`;
        box.querySelectorAll("[data-wp]").forEach(el => el.addEventListener("change", () => {
            if (!this.wechselplanSetze(Number(el.dataset.wpI), el.dataset.wp, el.value)) this.showToast?.("Das geht nicht.", "error");
            this.renderWechselplan();
        }));
        box.querySelectorAll("[data-wp-weg]").forEach(el => el.addEventListener("click", () => { this.wechselplanEntferne(Number(el.dataset.wpWeg)); this.renderWechselplan(); }));
        box.querySelector("#btnWechselplanNeu")?.addEventListener("click", () => {
            if (!this.wechselplanNeu()) this.showToast?.("Es ist niemand mehr in der Elf, den Sie einplanen könnten.", "info");
            this.renderWechselplan();
        });
    },

    /** Die Reihenfolge im Elfmeterschießen, wie sie im Spielstand steht: fünf Plätze, null heißt automatisch */
    elfmeterReihe() {
        const club = this._planClub();
        if (!club) return [];
        club.roles = club.roles || {};
        const r = Array.isArray(club.roles.elfmeterschiessen) ? club.roles.elfmeterschiessen.slice(0, 5) : [];
        while (r.length < 5) r.push(null);
        return r;
    },

    /** Einen Platz der Reihenfolge besetzen ("" oder null: automatisch); niemand schießt zweimal */
    elfmeterSetze(platz, wert) {
        const club = this._planClub();
        if (!club || !(platz >= 0 && platz < 5)) return false;
        const r = this.elfmeterReihe();
        const p = wert === "" || wert === null ? null : this._planSpieler([wert])[0];
        if (p) r.forEach((id, i) => { if (i !== platz && String(id) === String(p.id)) r[i] = null; });
        r[platz] = p ? p.id : null;
        club.roles.elfmeterschiessen = r;
        this._planSpeichern();
        return true;
    },

    renderElfmeterReihe() {
        const box = typeof document !== "undefined" ? document.getElementById("elfmeterReihe") : null;
        const club = this._planClub();
        if (!box || !club) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const C = typeof CupEngine !== "undefined" ? CupEngine : (typeof window !== "undefined" ? window.CupEngine : null);
        const kader = this._planSpieler([...(club.lineup || []), ...(club.bench || [])]);
        const reihe = this.elfmeterReihe();
        // Wer automatisch an der Reihe wäre - als Vorschlag im leeren Feld
        const auto = C && typeof C.elfmeterSchuetzen === "function" ? C.elfmeterSchuetzen(this.app.state, club) : [];
        box.innerHTML = `
            <label>Elfmeterschießen (Reihenfolge):</label>
            <div class="elfm-reihe">${reihe.map((id, i) => `
                <div class="elfm-platz"><span>${i + 1}.</span>
                    <select class="styled-select" data-elf-platz="${i}" aria-label="Schütze ${i + 1}">
                        <option value="" ${id === null ? "selected" : ""}>Automatisch${id === null && auto[i] ? ` (${esc(auto[i].name)})` : ""}</option>
                        ${kader.map(p => `<option value="${esc(p.id)}" ${String(p.id) === String(id) ? "selected" : ""}>${esc(p.name)} (${esc(p.pos)})</option>`).join("")}
                    </select>
                </div>`).join("")}
            </div>
            <small class="text-muted">Gilt im Pokal und in Entscheidungsspielen. Nach den fünf schießen die übrigen, der Torwart zuletzt.</small>`;
        box.querySelectorAll("[data-elf-platz]").forEach(el => el.addEventListener("change", () => {
            this.elfmeterSetze(Number(el.dataset.elfPlatz), el.value);
            this.renderElfmeterReihe();
        }));
    }
});
