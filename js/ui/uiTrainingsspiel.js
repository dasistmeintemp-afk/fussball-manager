/**
 * Länderspielpause im Verein: Trainingsgäste aus dem Nachwuchs und das
 * Trainingsspiel (TrainingsspielEngine).
 *
 * Die Karte im Reiter Training zeigt, wer abgestellt ist und welche Talente
 * dafür bei den Profis mittrainieren, und setzt einmal je Pause ein
 * Trainingsspiel an: Erste gegen U23, Erste gegen U19 oder U23 gegen U19.
 * Danach öffnet sich der Spielbogen mit einer Note für jeden.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    _tsEngine() {
        if (typeof TrainingsspielEngine !== "undefined" && TrainingsspielEngine) return TrainingsspielEngine;
        return (typeof window !== "undefined" && window.TrainingsspielEngine) || null;
    },

    /** Wann die nächste Länderspielpause beginnt (Datum als Text) */
    _tsNaechstePause(state) {
        const ab = state.currentDayIndex || 0;
        const tag = (state.calendar || []).find((d, i) => i > ab && d.laenderspiel === "abreise");
        return tag ? tag.date : null;
    },

    _tsErgebnis(spiel) {
        const [a, b] = spiel.teams;
        return `${a.name} ${a.tore}:${b.tore} ${b.name}`;
    },

    /** Die Karte im Reiter Training */
    renderTrainingsspielKarte() {
        const box = typeof document !== "undefined" ? document.getElementById("trainingsspielKarte") : null;
        const T = this._tsEngine();
        const state = this.app?.state;
        if (!box || !T || !state) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const inPause = T.inPause(state) && !!T.pause(state);
        const gespielt = T.gespielt(state);
        const letztes = gespielt || (state.trainingsspiele || [])[0] || null;
        const optionen = T.optionen(state);

        let lage;
        if (inPause) {
            const fehlen = T.abgestellte(state).length;
            const gaeste = T.gaeste(state);
            lage = `<div class="ts-lage">
                <div><span>Bei den Nationalmannschaften</span><strong>${fehlen} ${fehlen === 1 ? "Profi" : "Profis"}</strong></div>
                <div><span>Talente im Training der Profis</span><strong>${gaeste.length
                    ? gaeste.map(g => `${esc(g.name)} <small>(${esc(T.NAMEN[T.herkunft(state, g)])}, ${esc(g.age)})</small>`).join(", ")
                    : "keine"}</strong></div>
            </div>`;
        } else {
            const naechste = this._tsNaechstePause(state);
            lage = `<p class="text-muted">Trainingsspiele gibt es in der Länderspielpause.${naechste ? ` Die nächste beginnt am ${esc(naechste)}.` : " In dieser Saison kommt keine mehr."}</p>`;
        }

        const wahl = optionen.map(o => `
            <div class="lager-option">
                <div><strong>${esc(o.titel)}</strong><br><span class="text-muted">${o.id === "u23_u19"
                    ? "Der Nachwuchs unter sich: wer ist reif für die U23?"
                    : "Zweimal 45 Minuten, zur Pause wird durchgewechselt. Für fehlende Profis spielen Talente."}</span></div>
                <button class="btn btn-sm btn-primary" data-trainingsspiel="${o.id}" ${o.ok ? "" : `disabled title="${esc(o.grund)}"`}>Ansetzen</button>
            </div>`).join("");

        const ergebnis = letztes ? `
            <div class="ts-ergebnis">
                <div><span>${gespielt ? "In dieser Pause gespielt" : "Letztes Trainingsspiel"}</span><strong>${esc(this._tsErgebnis(letztes))}</strong></div>
                <button class="btn btn-sm btn-secondary" data-trainingsspiel-zeigen="0">Noten ansehen</button>
            </div>` : "";

        box.innerHTML = `
            <div class="card-header">
                <h3><svg class="ico h-ico" aria-hidden="true"><use href="#i-globe"/></svg>Länderspielpause</h3>
                <span class="header-tag">${inPause ? "Pause läuft" : "Liga läuft"}</span>
            </div>
            <p class="taktik-hilfe">Reisen Profis zu ihren Nationalmannschaften, rücken die interessantesten Talente aus U23 und U19 ins Training der Ersten nach. Einmal je Pause können Sie ein Trainingsspiel ansetzen und bekommen für jeden Spieler eine Note. Es bringt Spielschärfe und kostet etwas Kondition.</p>
            ${lage}
            ${ergebnis}
            ${inPause && !gespielt ? `<div class="lager-optionen">${wahl}</div>` : ""}`;
        box.querySelectorAll("[data-trainingsspiel]").forEach(btn => btn.addEventListener("click", () => this.trainingsspielAnsetzen(btn.dataset.trainingsspiel)));
        box.querySelectorAll("[data-trainingsspiel-zeigen]").forEach(btn => btn.addEventListener("click", () => this.zeigeTrainingsspiel(letztes)));
    },

    /** Ein Trainingsspiel ansetzen, spielen, speichern und den Spielbogen zeigen */
    trainingsspielAnsetzen(id) {
        const T = this._tsEngine();
        const state = this.app?.state;
        if (!T || !state) return null;
        const res = T.spiele(state, id);
        if (!res.ok) { this.showToast(res.grund || "Das geht nicht.", "error", 6000); return res; }
        this.playSound?.("click");
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderHeader?.();
        this.renderCurrentTab?.();
        this.zeigeTrainingsspiel(res.spiel);
        return res;
    },

    _tsNoteKlasse(note) {
        return note >= 7.5 ? "pf-ton-gut" : (note < 5.7 ? "pf-ton-schlecht" : "");
    },

    /** Der Spielbogen: Tore, wer sich aufgedrängt hat, und beide Mannschaften mit Noten */
    trainingsspielHtml(spiel) {
        const T = this._tsEngine();
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const tore = spiel.tore.length
            ? spiel.tore.map(t => `<li><strong>${t.minute}.</strong> ${esc(t.name)} <span class="muted-note">${esc(T.NAMEN[t.team])}${t.vorlage ? ` · Vorlage ${esc(t.vorlage)}` : ""}</span></li>`).join("")
            : `<li class="muted-note">Keine Tore.</li>`;
        const zahl = (z) => (z.tore ? `⚽${z.tore > 1 ? `×${z.tore}` : ""} ` : "") + (z.vorlagen ? `🅰${z.vorlagen > 1 ? `×${z.vorlagen}` : ""}` : "");
        const tabelle = (t) => `
            <div class="ts-team">
                <h4>${esc(t.name)} <span class="muted-note">Stärke ${esc(t.staerke)}</span></h4>
                <table class="ts-tabelle">
                    <thead><tr><th>Pos.</th><th>Spieler</th><th title="Minuten">Min.</th><th></th><th>Note</th></tr></thead>
                    <tbody>${t.spieler.map(z => `<tr${z.start ? "" : ' class="ts-bank"'}>
                        <td>${esc(z.pos)}</td>
                        <td>${esc(z.name)} <span class="muted-note">${esc(z.alter)}${z.gast ? ` · ${esc(T.NAMEN[z.gast])}` : ""}</span></td>
                        <td>${z.minuten}</td>
                        <td>${zahl(z)}</td>
                        <td class="${this._tsNoteKlasse(z.note)}"><strong>${z.note.toFixed(1)}</strong></td>
                    </tr>`).join("")}</tbody>
                </table>
            </div>`;
        const auf = spiel.auffaellig.length
            ? `<p class="ts-auf"><strong>Aufgedrängt:</strong> ${spiel.auffaellig.map(z => `${esc(z.name)} (${esc(z.alter)}, ${esc(T.NAMEN[z.herkunft])}) ${z.note.toFixed(1)}`).join(" · ")}</p>` : "";
        const ent = spiel.enttaeuscht.length
            ? `<p class="ts-auf"><strong>Unter ihren Möglichkeiten:</strong> ${spiel.enttaeuscht.map(z => `${esc(z.name)} ${z.note.toFixed(1)}`).join(" · ")}</p>` : "";
        return `
            <div class="ts-kopf"><strong>${esc(spiel.teams[0].name)}</strong><span class="ts-stand">${spiel.teams[0].tore}:${spiel.teams[1].tore}</span><strong>${esc(spiel.teams[1].name)}</strong></div>
            <ul class="ts-tore">${tore}</ul>
            ${auf}${ent}
            <div class="ts-teams">${spiel.teams.map(tabelle).join("")}</div>
            <p class="muted-note">Grau: zur Pause eingewechselt. Das Spiel ist gerechnet, nicht live gespielt.</p>`;
    },

    zeigeTrainingsspiel(spiel) {
        if (!spiel || typeof this.zeigeEntscheidung !== "function") return;
        this.zeigeEntscheidung({
            titel: `Trainingsspiel${spiel.datum ? ` · ${spiel.datum}` : ""}`,
            html: this.trainingsspielHtml(spiel),
            knoepfe: [{ text: "Schließen", klasse: "btn-primary" }]
        });
    }
});
