/**
 * Nationalteam: freie Posten, Bewerbung, Kader und Ergebnisse.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper).
 *
 * Ohne Posten zeigt der Reiter, welche Nationen in dieser Saison einen
 * Trainer suchen und welchen Ruf sie verlangen. Als Nationaltrainer beruft
 * man hier den Kader für die nächste Länderspielpause, wählt die Ausrichtung
 * und sieht, wie der Verband die Ergebnisse bewertet. Die Logik steht in der
 * NationalTeamEngine.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    getNationalEngine() {
        return (typeof NationalTeamEngine !== "undefined" && NationalTeamEngine)
            || (typeof window !== "undefined" && window.NationalTeamEngine)
            || (typeof require !== "undefined" ? (() => { try { return require("../engine/nationalTeamEngine.js").NationalTeamEngine; } catch (e) { return null; } })() : null);
    },

    _nationalSpeichern() {
        const state = this.app?.state;
        if (state && typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
    },

    /** Die nächste Länderspielpause im Kalender, falls noch eine kommt */
    naechstePause() {
        const state = this.app?.state;
        const tage = state?.calendar || [];
        const ab = state?.currentDayIndex || 0;
        return tage.find(t => (t.dayIndex ?? 0) >= ab && t.laenderspiel === "abreise") || null;
    },

    renderNational() {
        const box = document.getElementById("nationalInhalt");
        const state = this.app?.state;
        const engine = this.getNationalEngine();
        if (!box || !state || !engine) return;
        box.innerHTML = state.nationaltrainer ? this._nationalTrainerHtml(state, engine) : this._nationalPostenHtml(state, engine);
        this._bindNational(box, state, engine);
    },

    _nationalPostenHtml(state, engine) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const posten = engine.posten(state);
        const ruf = engine._ruf(state);
        const angebot = state.nationalAngebot && state.nationalAngebot.saison === (state.seasonYear || 1) ? state.nationalAngebot : null;
        const frei = posten.filter(p => p.frei);
        const akte = (state.nationaltrainerAkte || []).slice(-3).reverse();
        return `
            ${angebot ? `
            <div class="dash-card nat-angebot">
                <h3>Angebot: Nationaltrainer von ${esc(angebot.nation)}</h3>
                <p>Der Verband (Weltrang ${angebot.rang}) möchte dich – neben deinem Verein. Vor jeder Länderspielpause berufst du den Kader; gemessen wirst du an den Ergebnissen.</p>
                <div class="nat-knoepfe">
                    <button type="button" class="btn btn-primary" data-nat="annehmen">Annehmen</button>
                    <button type="button" class="btn btn-secondary" data-nat="ablehnen">Ablehnen</button>
                </div>
            </div>` : ""}
            <div class="dash-card">
                <div class="nat-kopf">
                    <div>
                        <h3>Freie Posten in dieser Saison</h3>
                        <p class="nat-unter">Neben dem Verein eine Nation trainieren. Der Verband verlangt einen Ruf, der zu seinem Weltrang passt; für deine Heimat (${esc(state.managerNationality || "–")}) genügt etwas weniger.</p>
                    </div>
                    <div class="nat-ruf"><span>Dein Ruf</span><strong>${ruf}</strong></div>
                </div>
                ${frei.length ? `
                <div class="nat-scroll"><table class="data-table nat-tabelle">
                    <thead><tr><th>Rang</th><th>Nation</th><th class="num">Stärke</th><th class="num">Verlangter Ruf</th><th></th></tr></thead>
                    <tbody>${frei.map(p => `
                        <tr>
                            <td>${p.rang}</td>
                            <td><strong>${esc(p.name)}</strong>${p.name === state.managerNationality ? ` <span class="badge badge-info">Heimat</span>` : ""}</td>
                            <td class="num">${p.staerke.toFixed(1)}</td>
                            <td class="num">${p.anforderung}</td>
                            <td class="nat-aktion">${p.reicht
                                ? `<button type="button" class="btn btn-primary btn-sm" data-bewerben="${esc(p.name)}">Bewerben</button>`
                                : `<span class="nat-fehlt">Ruf fehlt: ${p.anforderung - ruf}</span>`}</td>
                        </tr>`).join("")}
                    </tbody>
                </table></div>` : `<div class="empty-state-sm">In dieser Saison sucht keine Nation einen Trainer.</div>`}
                <p class="nat-hinweis">Der Ruf wächst mit Titeln und Punkten über dem Schnitt und sinkt mit Entlassungen. Zum Saisonstart melden sich Verbände auch von selbst.</p>
            </div>
            ${akte.length ? `<div class="dash-card"><h3>Bisherige Stationen</h3>${akte.map(a => `
                <div class="nat-station">${esc(a.nation)} · Saison ${a.vonSaison}–${a.bisSaison} · ${a.siege} S, ${a.remis} U, ${a.niederlagen} N · ${esc(a.ende)}</div>`).join("")}</div>` : ""}`;
    },

    _nationalTrainerHtml(state, engine) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const nt = state.nationaltrainer;
        const rang = engine.rangliste(state).findIndex(r => r.name === nt.nation) + 1;
        const b = engine.bilanz(nt);
        const pause = this.naechstePause();
        const laeuft = !!(state.laenderspielPause && (state.players || []).some(p => p.abgestellt === nt.nation));
        const kandidaten = engine.kandidaten(state, nt.nation);
        const vorschlag = engine.nutzerKader(state, nt.nation).kader;
        const gewaehlt = new Set((nt.auswahl && nt.auswahl.length ? nt.auswahl : vorschlag.map(p => p.id)).map(String));
        const kontext = this._nationalSternKontext(kandidaten.slice(0, 23));
        const gruppenName = { TW: "Tor", def: "Abwehr", mid: "Mittelfeld", att: "Angriff" };
        const vereinName = (id) => (state.clubs || []).find(c => c.id === id)?.name || "";
        const zeilen = kandidaten.slice(0, 60);
        const vertrauen = nt.vertrauen ?? 60;
        const letzte = nt.spiele.slice(-8).reverse();

        return `
            <div class="dash-card nat-trainer">
                <div class="nat-kopf">
                    <div>
                        <h3>${esc(nt.nation)}</h3>
                        <p class="nat-unter">Weltrang ${rang || "–"} · seit Saison ${nt.seitSaison} · ${b.spiele} Spiele: ${b.siege} S, ${b.remis} U, ${b.niederlagen} N (${b.tore}:${b.gegentore})</p>
                    </div>
                    <button type="button" class="btn btn-link btn-sm" data-nat="ruecktritt">Zurücktreten</button>
                </div>
                <div class="nat-vertrauen">
                    <span>Vertrauen des Verbands</span>
                    <div class="progress-bar-lg"><div class="progress-fill${vertrauen < 35 ? " nat-knapp" : ""}" style="width:${vertrauen}%"></div></div>
                    <strong>${vertrauen} %</strong>
                </div>
                <p class="nat-hinweis">Jedes Spiel wird an der Stärke beider Mannschaften gemessen: Ein Sieg gegen einen Stärkeren zählt viel, eine Niederlage gegen einen Schwächeren kostet. Unter ${engine.ENTLASSUNG_UNTER} % ist der Posten zum Saisonende weg.</p>
                <label class="nat-ausrichtung">Ausrichtung
                    <select class="styled-select" id="natAusrichtung">
                        ${Object.entries(engine.AUSRICHTUNG).map(([k, a]) => `<option value="${k}" ${nt.ausrichtung === k ? "selected" : ""}>${a.text}</option>`).join("")}
                    </select>
                    <span class="nat-unter">Offensiv: mehr Tore auf beiden Seiten, defensiv: weniger.</span>
                </label>
            </div>

            <div class="dash-card">
                <div class="nat-kopf">
                    <div>
                        <h3>Kader ${laeuft ? "· gerade unterwegs" : "für die nächste Pause"}</h3>
                        <p class="nat-unter">${laeuft ? "Die Spieler sind bei der Mannschaft. Änderungen gelten ab der nächsten Pause."
                            : pause ? `Abreise am ${esc(pause.date)}. ${nt.auswahl ? "Deine Auswahl reist; wer bis dahin ausfällt, wird ersetzt." : "Ohne eigene Auswahl beruft der Verband die 23 Besten."}`
                                : "In dieser Saison steht keine Pause mehr an."}</p>
                    </div>
                    <div class="nat-zaehler" id="natZaehler"></div>
                </div>
                <div class="nat-scroll"><table class="data-table nat-tabelle nat-kader">
                    <thead><tr><th></th><th>Spieler</th><th>Pos.</th><th>Verein</th><th class="num">Alter</th><th>Stärke</th><th>Zustand</th></tr></thead>
                    <tbody>${zeilen.map(p => {
                        const fit = !((p.injuredWeeks || 0) > 0 || p.injured);
                        return `<tr class="${gewaehlt.has(String(p.id)) ? "nat-gewaehlt" : ""}">
                            <td><input type="checkbox" data-nat-spieler="${esc(p.id)}" data-gruppe="${engine.gruppe(p.pos)}" ${gewaehlt.has(String(p.id)) ? "checked" : ""} aria-label="${esc(p.name)} berufen"></td>
                            <td><strong>${esc(p.name)}</strong></td>
                            <td><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span></td>
                            <td class="nat-verein">${esc(vereinName(p.clubId))}</td>
                            <td class="num">${p.age}</td>
                            <td>${this._nationalSterne(p, kontext)}</td>
                            <td>${fit ? `<span class="nat-fit">fit</span>` : `<span class="nat-verletzt">verletzt (${p.injuredWeeks || "?"} Wo.)</span>`}</td>
                        </tr>`;
                    }).join("")}</tbody>
                </table></div>
                <div class="nat-knoepfe">
                    <button type="button" class="btn btn-primary" data-nat="speichern">Auswahl übernehmen</button>
                    <button type="button" class="btn btn-secondary" data-nat="beste">Die Besten berufen</button>
                    <button type="button" class="btn btn-link" data-nat="verband">Dem Verband überlassen</button>
                </div>
                <p class="nat-hinweis">Je Mannschaftsteil: ${Object.entries(engine.KADER).map(([g, n]) => `${gruppenName[g]} ${n}`).join(" · ")} – zusammen 23.</p>
            </div>

            <div class="dash-card">
                <h3>Länderspiele</h3>
                ${letzte.length ? `<div class="nat-spiele">${letzte.map(s => {
                    const erg = s.tore[0] > s.tore[1] ? "sieg" : s.tore[0] === s.tore[1] ? "remis" : "niederlage";
                    return `<div class="nat-spiel nat-${erg}">
                        <span class="nat-ergebnis">${s.tore[0]}:${s.tore[1]}</span>
                        <span>${s.heim ? "gegen" : "bei"} <strong>${esc(s.gegner)}</strong></span>
                        <span class="nat-unter">Saison ${s.saison} · erwartet ${String(s.erwartet).replace(".", ",")} Punkte · ${esc(engine.AUSRICHTUNG[s.ausrichtung]?.text || "")}</span>
                    </div>`;
                }).join("")}</div>` : `<div class="empty-state-sm">Noch kein Länderspiel unter dir.</div>`}
            </div>`;
    },

    /** Sterne gemessen an der Nationalmannschaft selbst: drei Sterne = typischer Nationalspieler */
    _nationalSternKontext(beste) {
        const rating = this.getRatingEngine && this.getRatingEngine();
        if (!rating || !beste.length) return null;
        const schnitt = rating.squadAverageAbility(beste);
        return { rating, kontext: { squadAverageAbility: schnitt, userSquadAvgAbility: schnitt } };
    },

    _nationalSterne(p, k) {
        if (!k) return String(p.overall);
        const ca = k.rating.starsForOverall(p.overall ?? 50, k.kontext);
        const pa = Math.max(ca, k.rating.starsForOverall(p.pot ?? p.overall ?? 50, k.kontext));
        return k.rating.renderAbilityStars({ caMin: ca, caMax: ca, paMax: pa }, { compact: true });
    },

    _bindNational(box, state, engine) {
        const neu = () => { this._nationalSpeichern(); this.renderNational(); this.renderHeader(); };
        box.querySelectorAll("[data-bewerben]").forEach(btn => btn.addEventListener("click", () => {
            const r = engine.bewerben(state, btn.dataset.bewerben);
            this.showToast(r.ok ? `Du bist Nationaltrainer von ${r.nation}!` : r.grund, r.ok ? "success" : "warning", 6000);
            if (r.ok) neu();
        }));
        const aktion = (name, fn) => box.querySelector(`[data-nat="${name}"]`)?.addEventListener("click", fn);
        aktion("annehmen", () => {
            const r = engine.nimmAngebotAn(state);
            this.showToast(r.ok ? `Du bist Nationaltrainer von ${r.nation}!` : r.grund, r.ok ? "success" : "warning");
            neu();
        });
        aktion("ablehnen", () => { engine.lehneAngebotAb(state); neu(); });
        aktion("ruecktritt", () => {
            this.zeigeEntscheidung({
                titel: "Als Nationaltrainer zurücktreten?",
                html: `<p>Du gibst den Posten bei ${this.escapeHtml(state.nationaltrainer.nation)} ab. Dein Verein bleibt davon unberührt.</p>`,
                knoepfe: [
                    { text: "Zurücktreten", klasse: "btn-danger", aktion: () => { engine.ruecktritt(state); neu(); } },
                    { text: "Abbrechen", klasse: "btn-secondary" }
                ]
            });
        });

        const ausrichtung = box.querySelector("#natAusrichtung");
        if (ausrichtung) ausrichtung.addEventListener("change", () => { engine.setzeAusrichtung(state, ausrichtung.value); this._nationalSpeichern(); });

        // Der Zähler je Mannschaftsteil
        const boxen = [...box.querySelectorAll("[data-nat-spieler]")];
        const zaehler = box.querySelector("#natZaehler");
        const zaehle = () => {
            const z = { TW: 0, def: 0, mid: 0, att: 0 };
            boxen.filter(b => b.checked).forEach(b => { z[b.dataset.gruppe]++; });
            const n = Object.values(z).reduce((a, x) => a + x, 0);
            const namen = { TW: "TW", def: "ABW", mid: "MF", att: "ANG" };
            if (zaehler) zaehler.innerHTML = `<strong class="${n > 23 ? "nat-zuviel" : ""}">${n}/23</strong> `
                + Object.entries(engine.KADER).map(([g, soll]) => `<span class="${z[g] < soll ? "nat-zuwenig" : ""}">${namen[g]} ${z[g]}/${soll}</span>`).join(" ");
            return { z, n };
        };
        boxen.forEach(b => b.addEventListener("change", () => {
            b.closest("tr")?.classList.toggle("nat-gewaehlt", b.checked);
            zaehle();
        }));
        zaehle();

        aktion("speichern", () => {
            const { n } = zaehle();
            if (n > 23) { this.showToast("Höchstens 23 Spieler.", "warning"); return; }
            if (n < 18) { this.showToast("Mindestens 18 Spieler - den Rest füllt sonst der Verband auf.", "warning"); return; }
            engine.setzeAuswahl(state, boxen.filter(b => b.checked).map(b => b.dataset.natSpieler));
            this.showToast(`${n} Spieler berufen.${n < 23 ? " Bis 23 füllt der Verband mit den Besten auf." : ""}`, "success");
            neu();
        });
        aktion("beste", () => {
            const beste = new Set(engine.nominiere({ spieler: engine.kandidaten(state, state.nationaltrainer.nation) }).map(p => String(p.id)));
            boxen.forEach(b => { b.checked = beste.has(String(b.dataset.natSpieler)); b.closest("tr")?.classList.toggle("nat-gewaehlt", b.checked); });
            zaehle();
        });
        aktion("verband", () => { engine.setzeAuswahl(state, null); neu(); });
    }
});
