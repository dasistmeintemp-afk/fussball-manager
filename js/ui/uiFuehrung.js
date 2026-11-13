/**
 * Entscheidungen in der Kabine (FuehrungEngine): Platzverweis ahnden und
 * Sonderprämie ausloben.
 *
 * Der Dialog zur Strafe öffnet sich aus der Akte (Aktionen, Gruppe Kabine)
 * und per Rechtsklick in der Kaderliste, solange der Spieler nach glatt Rot
 * gesperrt ist. Die Sonderprämie steht bei Aufstellung & Taktik neben
 * "Beste 11".
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    _fuehrungEngine() {
        if (typeof FuehrungEngine !== "undefined" && FuehrungEngine) return FuehrungEngine;
        return (typeof window !== "undefined" && window.FuehrungEngine) || null;
    },

    /** Steht bei diesem Spieler eine Strafe zur Entscheidung? */
    strafeMoeglich(p) {
        const F = this._fuehrungEngine();
        return !!(F && p && this.app?.state && F.strafeOffen(this.app.state, p));
    },

    /** Kann gegen die Sperre dieses Spielers noch Einspruch eingelegt werden? */
    einspruchMoeglich(p) {
        const F = this._fuehrungEngine();
        return !!(F && p && this.app?.state && typeof F.einspruch === "function" && F.einspruch(this.app.state, p)?.ok);
    },

    /** Einspruch gegen die Sperre: Chance, Risiko und Gebühr auf einen Blick */
    zeigeEinspruch(playerId) {
        const state = this.app?.state;
        const F = this._fuehrungEngine();
        const p = (state?.players || []).find(x => String(x.id) === String(playerId));
        const o = F && p ? F.einspruch(state, p) : null;
        if (!o || !o.ok || typeof this.zeigeEntscheidung !== "function") { if (o && !o.ok) this.showToast(o.grund, "info"); return; }
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const geld = (b) => (typeof this.geldKurz === "function" ? this.geldKurz(b) : `${b} €`);
        const pct = (x) => `${Math.round(x * 100)} %`;
        const spiele = (n) => `${n} ${n === 1 ? "Spiel" : "Spiele"}`;
        this.zeigeEntscheidung({
            titel: "Einspruch gegen die Sperre",
            html: `
                <div class="verh-kopf"><div><strong>${esc(p.name)}</strong> <span class="muted-note">(${esc(p.age)}) · ${esc(p.pos)} · gesperrt für ${esc(spiele(o.sperre))}</span></div></div>
                <div class="verh-zahlen">
                    <div><span>Ein Spiel weniger</span><strong class="pf-ton-gut">${pct(o.chance)}</strong></div>
                    <div><span>Es bleibt dabei</span><strong>${pct(Math.max(0, 1 - o.chance - o.risiko))}</strong></div>
                    <div><span>Ein Spiel mehr</span><strong class="pf-ton-schlecht">${pct(o.risiko)}</strong></div>
                    <div><span>Gebühr</span><strong>${esc(geld(o.kosten))}</strong></div>
                </div>
                <p class="taktik-hilfe">Das Sportgericht entscheidet sofort. Wer als besonnen gilt, hat bessere Aussichten. Einspruch gibt es nur einmal je Sperre, die Gebühr ist in jedem Fall weg.</p>`,
            knoepfe: [
                { text: "Sperre hinnehmen", klasse: "btn-secondary" },
                { text: "Einspruch einlegen", klasse: "btn-primary", aktion: () => {
                    const r = F.legeEinspruchEin(state, p.id);
                    if (!r.ok) { this.showToast(r.grund, "error"); return false; }
                    this._fuehrungFertig(r.text, r.ausgang === "erfolg" ? "success" : (r.ausgang === "haerter" ? "error" : "warning"));
                    const akte = typeof document !== "undefined" ? document.getElementById("modalPlayerDetails") : null;
                    if (akte && akte.style.display !== "none") this.showPlayerDetailsModal(p.id);
                    return true;
                } }
            ]
        });
    },

    _fuehrungFertig(text, ton = "success") {
        const state = this.app.state;
        this.playSound?.("click");
        this.showToast(text, ton, 6000);
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderHeader?.();
        this.renderCurrentTab?.();
    },

    /** Platzverweis ahnden: Geldstrafe, Abmahnung oder Nachsicht */
    zeigeStrafe(playerId) {
        const state = this.app?.state;
        const F = this._fuehrungEngine();
        const p = (state?.players || []).find(x => String(x.id) === String(playerId));
        if (!F || !this.strafeMoeglich(p) || typeof this.zeigeEntscheidung !== "function") return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const geld = (b) => (typeof this.geldKurz === "function" ? this.geldKurz(b) : `${b} €`);
        const ahnde = (art) => {
            const r = F.ahnde(state, p.id, art);
            if (!r.ok) { this.showToast(r.grund, "error"); return false; }
            this._fuehrungFertig(r.text, art !== "nachsicht" && !r.einsicht ? "warning" : "success");
            const akte = typeof document !== "undefined" ? document.getElementById("modalPlayerDetails") : null;
            if (akte && akte.style.display !== "none") this.showPlayerDetailsModal(p.id);
            return true;
        };
        this.zeigeEntscheidung({
            titel: "Platzverweis ahnden",
            html: `
                <div class="verh-kopf"><div><strong>${esc(p.name)}</strong> <span class="muted-note">(${esc(p.age)}) · ${esc(p.pos)} · gesperrt für ${esc(p.suspendedMatches || 1)} ${p.suspendedMatches === 1 ? "Spiel" : "Spiele"}</span></div></div>
                <div class="med-wege">
                    <div class="med-weg"><h4>Geldstrafe · ${esc(geld(F.wochenlohn(p)))}</h4><p>Ein Wochenlohn geht in die Vereinskasse, die Mannschaft sieht, dass durchgegriffen wird. Ein professioneller Spieler nimmt es an und hat sich künftig besser im Griff. Ein anderer ist gekränkt, seine Moral fällt deutlich.</p></div>
                    <div class="med-weg"><h4>Abmahnung</h4><p>Milder: wenig Ärger, wirkt aber nur bei sehr professionellen Spielern.</p></div>
                    <div class="med-weg"><h4>Nachsicht</h4><p>Ein Gespräch, keine Strafe. Er ist erleichtert, es ändert sich nichts.</p></div>
                </div>`,
            knoepfe: [
                { text: "Geldstrafe", klasse: "btn-primary", aktion: () => ahnde("geldstrafe") },
                { text: "Abmahnung", klasse: "btn-secondary", aktion: () => ahnde("abmahnung") },
                { text: "Nachsicht", klasse: "btn-secondary", aktion: () => ahnde("nachsicht") }
            ]
        });
    },

    /** Sonderprämie fürs nächste Ligaspiel ausloben */
    zeigeSonderpraemie() {
        const state = this.app?.state;
        const F = this._fuehrungEngine();
        const o = F && state ? F.praemie(state) : null;
        if (!o || typeof this.zeigeEntscheidung !== "function") return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const geld = (b) => (typeof this.geldKurz === "function" ? this.geldKurz(b) : `${b} €`);
        this.zeigeEntscheidung({
            titel: "Sonderprämie",
            html: `
                <div class="verh-zahlen">
                    <div><span>Prämie bei Sieg</span><strong>${esc(geld(o.betrag))}</strong></div>
                    <div><span>Moral sofort</span><strong class="pf-ton-gut">+${o.moral}</strong></div>
                    <div><span>Ohne Sieg</span><strong class="pf-ton-schlecht">Enttäuschung</strong></div>
                </div>
                <p class="text-muted">Gilt fürs nächste Ligaspiel. Gezahlt wird nur bei einem Sieg (ein halber Wochenlohn aller Profis, zählt zu den Kaderkosten). Gewinnt die Mannschaft nicht, fällt die Moral. Höchstens alle ${F.PRAEMIE.pause} Spieltage.</p>
                ${o.ok ? "" : `<p class="pf-ton-mittel">${esc(o.grund)}</p>`}`,
            knoepfe: [
                ...(o.ok ? [{ text: `Ausloben (${geld(o.betrag)})`, klasse: "btn-primary", aktion: () => {
                    const r = F.lobeAus(state);
                    if (!r.ok) { this.showToast(r.grund, "error"); return false; }
                    this._fuehrungFertig(`💰 ${r.text}`);
                    return true;
                } }] : []),
                { text: o.ok ? "Lieber nicht" : "Schließen", klasse: "btn-secondary" }
            ]
        });
    }
});
