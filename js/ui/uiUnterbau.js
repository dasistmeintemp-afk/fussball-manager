/**
 * U23 und U19 wie die erste Mannschaft: Aufstellung auf dem Feld mit
 * Formation, Mentalität und festen Plätzen (ReserveEngine.aufstellung).
 *
 * Bisher sah man vom Unterbau nur Tabellen: wer dazugehört, wer zuletzt
 * gespielt hat. Wer auf welchem Platz steht, entschied allein der
 * Einsatzplan. Jetzt steht die Elf auf dem Feld, ein Tipp auf einen Platz
 * setzt einen Spieler fest, und die Formation zählt im Spiel.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /** Wo die Aufstellung einer Mannschaft im Reiter Jugend steht */
    UNTERBAU_KARTEN: { u23: "u23Aufstellung", u19: "u19Aufstellung" },

    _unterbauEngine() {
        return typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
    },

    /** Eignung als Ton: grün auf der eigenen Position, gelb verwandt, rot fremd */
    unterbauEignungsTon(e) {
        return e >= 0.95 ? "gut" : (e >= 0.75 ? "mittel" : "schlecht");
    },

    /** Kurzer Name auf der Karte: der Nachname */
    unterbauKurzname(name) {
        const teile = String(name || "").trim().split(/\s+/);
        return teile.length > 1 ? teile.slice(1).join(" ") : teile[0];
    },

    renderUnterbauAufstellung(state, team) {
        const R = this._unterbauEngine();
        const el = document.getElementById(this.UNTERBAU_KARTEN[team]);
        if (!el || !R || typeof R.aufstellung !== "function") return;
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!club) { el.hidden = true; return; }
        el.hidden = false;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const komma = (x) => Number(x).toFixed(1).replace(".", ",");
        const plan = R.teamPlan(state, team);
        const aufstellung = R.aufstellung(state, team);
        const name = R.MANNSCHAFTEN[team];
        const kader = R.teamKader(state, team);
        const inElf = new Set(aufstellung.filter(pl => pl.spieler).map(pl => pl.spieler));
        const leer = aufstellung.filter(pl => !pl.spieler).length;
        const jl = typeof JugendligaEngine !== "undefined" ? JugendligaEngine : null;
        const staerke = team === "u23" ? R.u23Staerke(state, club).staerke : (jl ? jl.eigeneStaerke(state) : 0);

        const knoten = aufstellung.map(pl => {
            const p = pl.spieler;
            if (!p) {
                return `<button type="button" class="ub-knoten leer" data-slot="${pl.slot}" style="left:${this._ubX(plan, pl.slot)}%;top:${this._ubY(plan, pl.slot)}%" title="Leer - hier hilft ein Amateur aus. Tippen zum Besetzen.">
                    <span class="ub-pos">${esc(pl.pos)}</span><span class="ub-name">Amateur</span></button>`;
            }
            const eignung = R.platzEignung(p, pl.pos);
            return `<button type="button" class="ub-knoten eignung-${this.unterbauEignungsTon(eignung)}${pl.fest ? " fest" : ""}" data-slot="${pl.slot}" style="left:${this._ubX(plan, pl.slot)}%;top:${this._ubY(plan, pl.slot)}%"
                    title="${esc(p.name)} (${esc(p.pos)}) auf ${esc(pl.pos)} - Eignung ${Math.round(eignung * 100)} %${pl.fest ? ", festgelegt" : ", vom Einsatzplan"}">
                <span class="ub-pos">${esc(pl.pos)}${pl.fest ? '<i class="ub-fest" aria-label="festgelegt"></i>' : ""}</span>
                <span class="ub-name">${esc(this.unterbauKurzname(p.name))}</span>
                <span class="ub-info">${komma(this.starValueFor(p.overall))}★ · ${Math.round(p.fitness ?? 100)} %</span>
            </button>`;
        }).join("");

        // Wer nicht spielt - und warum
        const grund = (p) => {
            if ((p.injuredWeeks || 0) > 0) return `verletzt (${p.injuredWeeks} Wo.)`;
            if ((p.suspendedMatches || 0) > 0) return "gesperrt";
            if (p.abgestellt) return "bei der Nationalmannschaft";
            const rolle = R.einsatzVon(p).rolle;
            if (rolle === "schonen") return "geschont";
            if (rolle === "bedarf") return "nur bei Bedarf";
            if (rolle === "rotation") return "Rotation - diesmal draußen";
            return "Bank";
        };
        const draussen = kader.filter(p => !inElf.has(p)).sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const startelf = aufstellung.filter(pl => pl.spieler);

        el.innerHTML = `
            <div class="card-header"><h3><svg class="ico h-ico" aria-hidden="true"><use href="#i-tactics"/></svg>Aufstellung der ${esc(name)}</h3>
                <span class="header-tag">Stärke ${komma(staerke)}${leer ? ` · ${leer} ${leer === 1 ? "Platz" : "Plätze"} Amateure` : ""}</span></div>
            <div class="ub-steuer">
                <label>Formation <select class="styled-select ub-formation" aria-label="Formation der ${esc(name)}">
                    ${R.formationen().map(f => `<option value="${esc(f.key)}"${f.key === plan.formation ? " selected" : ""}>${esc(f.name)}</option>`).join("")}
                </select></label>
                <label>Mentalität <select class="styled-select ub-mentalitaet" aria-label="Mentalität der ${esc(name)}" title="${esc(R.MENTALITAETEN[plan.mentalitaet].text)}">
                    ${Object.entries(R.MENTALITAETEN).map(([k, m]) => `<option value="${k}"${k === plan.mentalitaet ? " selected" : ""}>${esc(m.label)}</option>`).join("")}
                </select></label>
                <button type="button" class="btn btn-sm btn-secondary ub-auto"${plan.lineup.some(id => id != null) ? "" : " disabled"} title="Alle festgelegten Plätze lösen - der Einsatzplan stellt auf">Automatisch aufstellen</button>
            </div>
            <div class="ub-raster">
                <div class="ub-feld" role="group" aria-label="Aufstellung der ${esc(name)}">
                    <div class="ub-linien" aria-hidden="true"><i class="ub-mitte"></i><i class="ub-kreis"></i><i class="ub-strafraum oben"></i><i class="ub-strafraum unten"></i></div>
                    ${knoten}
                </div>
                <div class="ub-listen">
                    <h4>Startelf</h4>
                    <ul class="ub-liste">${startelf.map(pl => {
                        const p = pl.spieler, e = R.platzEignung(p, pl.pos);
                        return `<li><button type="button" class="ub-zeile" data-slot="${pl.slot}"><span class="pos-tag pos-${this.getPosGroup(pl.pos)}">${esc(pl.pos)}</span>
                            <span class="ub-zeile-name">${esc(p.name)}${pl.fest ? ' <i class="ub-fest" aria-label="festgelegt"></i>' : ""}</span>
                            <span class="ub-eignung ub-ton-${this.unterbauEignungsTon(e)}">${Math.round(e * 100)} %</span></button></li>`;
                    }).join("") || `<li class="text-muted">Noch niemand - die Elf stellen Amateure.</li>`}</ul>
                    <h4>Nicht in der Elf</h4>
                    ${draussen.length ? `<ul class="ub-liste ub-draussen">${draussen.map(p => `<li><button type="button" class="ub-zeile" data-akte="${esc(p.id)}">
                        <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span><span class="ub-zeile-name">${esc(p.name)}</span><span class="text-muted ub-grund">${esc(grund(p))}</span></button></li>`).join("")}</ul>`
                        : `<p class="text-muted">Alle spielen.</p>`}
                </div>
            </div>
            <p class="text-muted jl-hinweis">Tippe einen Platz an, um ihn zu besetzen. Festgelegte Plätze (<i class="ub-fest" aria-hidden="true"></i>) bleiben, solange der Spieler fit ist - die übrigen füllt der Einsatzplan, jeden auf seiner besten Position. Auf einer fremden Position bringt einer weniger, lernt sie aber mit jedem Spiel.</p>`;

        el.querySelector(".ub-formation")?.addEventListener("change", (e) => this.unterbauGeaendert(R.setzeFormation(state, team, e.target.value)));
        el.querySelector(".ub-mentalitaet")?.addEventListener("change", (e) => this.unterbauGeaendert(R.setzeMentalitaet(state, team, e.target.value)));
        el.querySelector(".ub-auto")?.addEventListener("click", () => this.unterbauGeaendert(R.automatischAufstellen(state, team)));
        el.querySelectorAll("[data-slot]").forEach(b => b.addEventListener("click", () => this.zeigeUnterbauPlatzWahl(team, Number(b.dataset.slot))));
        el.querySelectorAll("[data-akte]").forEach(b => b.addEventListener("click", () => this.showPlayerDetailsModal(this.resolvePlayerId(b.dataset.akte), { abschnitt: "unterbau" })));
    },

    /** Lage eines Platzes auf dem Feld: etwas eingerückt, damit Karten am Rand ganz zu sehen sind */
    _ubX(plan, i) {
        const s = this._unterbauEngine()._formationVon(plan.formation).positions[i];
        return s ? Math.round((50 + (s.x - 50) * 0.86) * 10) / 10 : 50;
    },
    _ubY(plan, i) {
        const s = this._unterbauEngine()._formationVon(plan.formation).positions[i];
        return s ? Math.round((8 + s.y * 0.86) * 10) / 10 : 50;
    },

    /** Wer auf einen Platz soll: alle der Mannschaft, die Passendsten zuerst */
    zeigeUnterbauPlatzWahl(team, slotIndex) {
        const R = this._unterbauEngine();
        const state = this.app.state;
        if (!R) return;
        const aufstellung = R.aufstellung(state, team);
        const pl = aufstellung[slotIndex];
        if (!pl) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const platzVon = new Map(aufstellung.filter(x => x.spieler).map(x => [x.spieler, x]));
        const kandidaten = R.teamKader(state, team)
            .map(p => ({ p, bereit: R._einsatzbereit(p), eignung: R.platzEignung(p, pl.pos), wert: R.staerkeAuf(p, pl.pos) }))
            .sort((a, b) => (b.bereit - a.bereit) || (b.wert - a.wert));
        const zeile = (k) => {
            const auf = platzVon.get(k.p);
            const hier = auf && auf.slot === slotIndex;
            const info = !k.bereit ? ((k.p.injuredWeeks || 0) > 0 ? `verletzt (${k.p.injuredWeeks} Wo.)` : "nicht einsatzbereit")
                : `Eignung ${Math.round(k.eignung * 100)} % · ${Math.round(k.p.fitness ?? 100)} % Kondition · ${k.p.age} J.${auf && !hier ? ` · steht auf ${auf.pos}` : ""}`;
            return `<button class="spm-kandidat${hier ? " aktiv" : ""}" data-ub-wahl="${esc(k.p.id)}"${k.bereit && !hier ? "" : " disabled"}>
                <span class="pos-tag pos-${this.getPosGroup(k.p.pos)}">${esc(k.p.pos)}</span>
                <span class="spm-kandidat-name">${esc(k.p.name)}</span>
                ${this.starsFor(k.p.overall)}
                <span class="spm-kandidat-info"><span class="ub-ton-${this.unterbauEignungsTon(k.eignung)}">●</span> ${esc(info)}</span>
            </button>`;
        };
        const html = `<p class="text-muted ub-wahl-hinweis">Platz <strong>${esc(pl.pos)}</strong> in der ${esc(R.MANNSCHAFTEN[team])}. Steht der Gewählte schon woanders, tauschen beide.</p>
            ${pl.fest ? `<button class="btn btn-sm btn-secondary ub-freigeben">Platz dem Einsatzplan überlassen</button>` : ""}
            <div class="spm-kandidaten">${kandidaten.map(zeile).join("") || `<p class="text-muted">Niemand in der Mannschaft.</p>`}</div>`;
        this.oeffneSpielerMenue(`${esc(R.MANNSCHAFTEN[team])} · ${esc(pl.pos)} besetzen`, html, (box) => {
            box.querySelector(".ub-freigeben")?.addEventListener("click", () => {
                this.schliesseSpielerMenue();
                this.unterbauGeaendert(R.setzeAufPlatz(state, team, slotIndex, null));
            });
            box.querySelectorAll("[data-ub-wahl]").forEach(b => b.addEventListener("click", () => {
                this.schliesseSpielerMenue();
                this.unterbauGeaendert(R.setzeAufPlatz(state, team, slotIndex, b.dataset.ubWahl));
            }));
        });
    },

    /** Nach einer Änderung: speichern und alles vom Unterbau neu zeichnen */
    unterbauGeaendert(res) {
        if (res && res.success === false) { this.showToast(res.error || "Das geht nicht.", "error"); return; }
        const state = this.app.state;
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        if (typeof this.playSound === "function") this.playSound("click");
        this.renderUnterbauAufstellung(state, "u23");
        this.renderUnterbauAufstellung(state, "u19");
        if (typeof this.renderU23 === "function") this.renderU23(state);
        if (typeof this.renderJugendliga === "function") this.renderJugendliga(state);
        if (typeof this.renderNachwuchsUebersicht === "function") this.renderNachwuchsUebersicht(state);
        if (this.activeTab === "squad" && typeof this.renderSquad === "function") this.renderSquad();
    }
});
