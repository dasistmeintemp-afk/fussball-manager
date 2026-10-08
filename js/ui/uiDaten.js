/**
 * Datenzentrale und Spielervergleich.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 *   Datenzentrale (Reiter Statistik) - Liga nach xG und xPunkten, Form der
 *   eigenen Mannschaft als xG je Spiel, Spielerwerte je 90 Minuten.
 *   Spielervergleich (aus der Akte) - zwei Spieler nebeneinander.
 *
 * Farben der Datenreihen (geprüft auf der dunklen Fläche): Blau für die
 * eigene Seite bzw. Spieler A, Orange für den Gegner bzw. Spieler B.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    getDatenzentrale() {
        return (typeof DatenzentraleEngine !== "undefined" && DatenzentraleEngine) ? DatenzentraleEngine
            : ((typeof window !== "undefined" && window.DatenzentraleEngine) ? window.DatenzentraleEngine : null);
    },

    _zahl(x, stellen = 1) {
        if (x === null || x === undefined || Number.isNaN(x)) return "–";
        return Number(x).toFixed(stellen).replace(".", ",");
    },

    /** Die Datenzentrale im Reiter Statistik: Liga, Form, Spieler */
    renderDatenzentrale(state, ligaId) {
        const box = document.getElementById("statsDatenzentrale");
        const dz = this.getDatenzentrale();
        if (!box || !dz) return;
        const eigeneLiga = this.getUserLeagueId(state);
        const ansicht = this.dzAnsicht || "liga";
        const kopf = `
            <div class="dz-kopf">
                <h3>📊 Datenzentrale</h3>
                <div class="dz-wahl" role="tablist">
                    ${[["liga", "Liga"], ["form", "Form"], ["spieler", "Spieler"]].map(([k, t]) =>
                        `<button type="button" class="sp-chip${ansicht === k ? " aktiv" : ""}" data-dz="${k}" role="tab" aria-selected="${ansicht === k}">${t}</button>`).join("")}
                </div>
            </div>`;
        if (ligaId !== eigeneLiga) {
            box.innerHTML = `${kopf}<p class="dz-leer">Detaildaten wie xG und Ballbesitz gibt es nur für die eigene Liga.</p>`;
        } else if (!dz.partien(state).length) {
            box.innerHTML = `${kopf}<p class="dz-leer">Noch kein Spiel gespielt - die Daten kommen mit dem ersten Spieltag.</p>`;
        } else {
            const inhalt = ansicht === "form" ? this._dzForm(state, dz)
                : ansicht === "spieler" ? this._dzSpieler(state, dz)
                    : this._dzLiga(state, dz);
            box.innerHTML = kopf + inhalt;
        }
        box.querySelectorAll("[data-dz]").forEach(b => b.addEventListener("click", () => {
            this.dzAnsicht = b.dataset.dz;
            this.renderDatenzentrale(state, ligaId);
        }));
        box.querySelectorAll("[data-dz-sort]").forEach(th => th.addEventListener("click", () => {
            const k = th.dataset.dzSort;
            this.dzSort = { ...(this.dzSort || {}), [ansicht]: { key: k, ab: this.dzSort?.[ansicht]?.key === k ? !this.dzSort[ansicht].ab : true } };
            this.renderDatenzentrale(state, ligaId);
        }));
        box.querySelectorAll("[data-dz-spieler]").forEach(el => el.addEventListener("click", () => {
            const id = el.dataset.dzSpieler;
            const p = state.players.find(x => String(x.id) === id);
            if (p) this.showPlayerDetailsModal(p.id);
        }));
    },

    /** Sortierbare Tabelle: spalten [key, Titel, Format, Tooltip] */
    _dzTabelle(zeilen, spalten, ansicht, standard, zeileHtml) {
        const sort = this.dzSort?.[ansicht] || standard;
        const sortiert = [...zeilen].sort((a, b) => {
            const x = a[sort.key], y = b[sort.key];
            if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y)) * (sort.ab ? 1 : -1);
            return ((y ?? -Infinity) - (x ?? -Infinity)) * (sort.ab ? 1 : -1);
        });
        return `
            <div class="table-container dz-tabelle">
                <table class="compact-table">
                    <thead><tr>${spalten.map(([k, t, , tip]) => `<th data-dz-sort="${k}"${tip ? ` title="${this.escapeHtml(tip)}"` : ""} class="${sort.key === k ? "dz-sortiert" : ""}">${t}${sort.key === k ? (sort.ab ? " ▾" : " ▴") : ""}</th>`).join("")}</tr></thead>
                    <tbody>${sortiert.map(zeileHtml).join("")}</tbody>
                </table>
            </div>`;
    },

    _dzLiga(state, dz) {
        const zeilen = dz.liga(state);
        const spalten = [
            ["name", "Verein"], ["spiele", "Sp"], ["tore", "Tore"], ["gegentore", "Ggt"], ["xg", "xG", null, "Erwartete Tore aus den Chancen"],
            ["xga", "xGA", null, "Erwartete Gegentore"], ["xgDiff", "xG±"], ["punkte", "Pkt"],
            ["xPunkte", "xPkt", null, "Punkte, die die Chancen im Schnitt eingebracht hätten"],
            ["glueck", "Pkt−xPkt", null, "Über null: mehr Punkte, als die Chancen hergaben"],
            ["schuesseJeSpiel", "Sch/Sp"], ["ballbesitz", "Ball %"], ["passquote", "Pass %"]
        ];
        const eigen = zeilen.find(z => z.clubId === state.userClubId);
        const rang = eigen ? zeilen.indexOf(eigen) + 1 : null;
        const fazit = eigen ? `<p class="dz-fazit">Nach den Chancen stünde ${this.escapeHtml(eigen.name)} auf Platz <strong>${rang}</strong> (${this._zahl(eigen.xPunkte)} xPunkte, tatsächlich ${eigen.punkte}). `
            + (eigen.glueck >= 3 ? "Die Ergebnisse sind besser als das Spiel - das muss nicht so bleiben."
                : eigen.glueck <= -3 ? "Die Mannschaft spielt besser, als die Tabelle sagt." : "Tabelle und Chancen passen zusammen.") + `</p>` : "";
        return fazit + this._dzTabelle(zeilen, spalten, "liga", { key: "xPunkte", ab: true }, z => `
            <tr class="${z.clubId === state.userClubId ? "dz-eigen" : ""}">
                <td class="dz-name">${this.escapeHtml(z.name)}</td><td>${z.spiele}</td><td>${z.tore}</td><td>${z.gegentore}</td>
                <td>${this._zahl(z.xg)}</td><td>${this._zahl(z.xga)}</td><td>${z.xgDiff > 0 ? "+" : ""}${this._zahl(z.xgDiff)}</td>
                <td><strong>${z.punkte}</strong></td><td>${this._zahl(z.xPunkte)}</td><td>${z.glueck > 0 ? "+" : ""}${this._zahl(z.glueck)}</td>
                <td>${this._zahl(z.schuesseJeSpiel)}</td><td>${z.ballbesitz}</td><td>${z.passquote}</td>
            </tr>`);
    },

    /** Form: xG für und gegen je Spiel als gepaarte Balken, das Ergebnis darüber */
    _dzForm(state, dz) {
        const spiele = dz.form(state, state.userClubId, 10);
        if (!spiele.length) return `<p class="dz-leer">Noch kein eigenes Spiel.</p>`;
        const hoechst = Math.max(1.5, ...spiele.flatMap(s => s.xg));
        const B = 300, H = 140, unten = 112, oben = 22, breite = B / spiele.length;
        const balken = (wert, x, w, klasse, text) => {
            const h = Math.max(1, (wert / hoechst) * (unten - oben));
            return `<rect class="${klasse}" x="${x.toFixed(1)}" y="${(unten - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${this.escapeHtml(text)}</title></rect>`;
        };
        const marken = spiele.map((s, i) => {
            const x0 = i * breite + breite * 0.14, w = breite * 0.34;
            const tip = `${s.spieltag}. Spieltag ${s.heim ? "gegen" : "bei"} ${s.gegner}: ${s.tore[0]}:${s.tore[1]}, xG ${this._zahl(s.xg[0], 2)} : ${this._zahl(s.xg[1], 2)}`;
            return balken(s.xg[0], x0, w, "dz-fuer", tip) + balken(s.xg[1], x0 + w + 2, w, "dz-gegen", tip)
                + `<text class="dz-erg dz-erg-${s.ergebnis}" x="${(i * breite + breite / 2).toFixed(1)}" y="14" text-anchor="middle">${s.tore[0]}:${s.tore[1]}</text>`
                + `<text class="dz-achse" x="${(i * breite + breite / 2).toFixed(1)}" y="${H - 14}" text-anchor="middle">${s.spieltag}.</text>`;
        }).join("");
        const summe = (i, k) => spiele.reduce((a, s) => a + (s[k][i] || 0), 0);
        return `
            <div class="dz-legende"><span><i class="dz-punkt dz-fuer"></i> xG für uns</span><span><i class="dz-punkt dz-gegen"></i> xG gegen uns</span></div>
            <svg class="dz-form" viewBox="0 0 ${B} ${H}" role="img" aria-label="xG der letzten ${spiele.length} Spiele">
                <line class="dz-grundlinie" x1="0" x2="${B}" y1="${unten}" y2="${unten}"/>
                ${marken}
                <text class="dz-achse" x="0" y="${H - 2}">Spieltag</text>
            </svg>
            <p class="dz-fazit">Letzte ${spiele.length} Spiele: Tore ${summe(0, "tore")}:${summe(1, "tore")}, xG ${this._zahl(summe(0, "xg"))} : ${this._zahl(summe(1, "xg"))}.
                ${summe(0, "tore") - summe(0, "xg") >= 3 ? "Vorn trifft die Mannschaft mehr, als die Chancen hergeben." : summe(0, "xg") - summe(0, "tore") >= 3 ? "Vorn bleibt mehr liegen, als die Chancen hergeben." : ""}</p>
            <div class="table-container dz-tabelle"><table class="compact-table"><thead><tr><th>Sp.</th><th>Gegner</th><th>Erg.</th><th>xG</th></tr></thead><tbody>
                ${spiele.slice().reverse().map(s => `<tr><td>${s.spieltag}.</td><td class="dz-name">${s.heim ? "" : "@ "}${this.escapeHtml(s.gegner)}</td><td>${s.tore[0]}:${s.tore[1]} (${s.ergebnis})</td><td>${this._zahl(s.xg[0], 2)} : ${this._zahl(s.xg[1], 2)}</td></tr>`).join("")}
            </tbody></table></div>`;
    },

    _dzSpieler(state, dz) {
        const zeilen = dz.spieler(state, state.userClubId).map(z => ({ ...z, toreMinusXg: Math.round((z.tore - z.xg) * 100) / 100 }));
        const spalten = [
            ["name", "Spieler"], ["pos", "Pos"], ["spiele", "Sp"], ["minuten", "Min"], ["tore", "T"], ["vorlagen", "V"],
            ["xg", "xG", null, "Erwartete Tore aus seinen Schüssen"], ["toreMinusXg", "T−xG", null, "Über null: trifft mehr, als die Chancen hergeben"],
            ["schuesse", "Sch"], ["note", "Note"], ["toreJe90", "T/90"], ["vorlagenJe90", "V/90"], ["xgJe90", "xG/90"]
        ];
        return `<p class="dz-fazit">Werte je 90 Minuten ab ${dz.MIN_MINUTEN_JE90} Minuten Einsatzzeit. Ein Tipp auf den Namen öffnet die Akte.</p>`
            + this._dzTabelle(zeilen, spalten, "spieler", { key: "minuten", ab: true }, z => `
            <tr>
                <td class="dz-name"><button type="button" class="dz-link" data-dz-spieler="${this.escapeHtml(String(z.id))}">${this.escapeHtml(z.name)}</button></td>
                <td><span class="pos-tag pos-${this.getPosGroup(z.pos)}">${this.escapeHtml(z.pos || "")}</span></td>
                <td>${z.spiele}</td><td>${z.minuten}</td><td>${z.tore}</td><td>${z.vorlagen}</td>
                <td>${this._zahl(z.xg)}</td><td>${z.toreMinusXg > 0 ? "+" : ""}${this._zahl(z.toreMinusXg)}</td><td>${z.schuesse}</td>
                <td>${z.note ? this._zahl(z.note, 2) : "–"}</td><td>${this._zahl(z.toreJe90, 2)}</td><td>${this._zahl(z.vorlagenJe90, 2)}</td><td>${this._zahl(z.xgJe90, 2)}</td>
            </tr>`);
    },

    /** Spielervergleich: Auswahl des zweiten Spielers, dann nebeneinander */
    zeigeVergleich(idA, idB = null) {
        const state = this.app.state;
        const dz = this.getDatenzentrale();
        const modal = document.getElementById("modalVergleich");
        const body = document.getElementById("vergleichContent");
        if (!dz || !modal || !body) return;
        const kandidaten = dz.vergleichsKandidaten(state, idA);
        const b = idB ?? kandidaten[0]?.id ?? null;
        const v = b !== null ? dz.vergleich(state, idA, b) : null;
        const esc = (t) => this.escapeHtml(String(t ?? ""));

        const auswahl = `
            <div class="vg-auswahl">
                <label for="vgWahl">Vergleichen mit</label>
                <select id="vgWahl" class="styled-select">
                    ${kandidaten.map(k => `<option value="${esc(k.id)}" ${String(k.id) === String(b) ? "selected" : ""}>${esc(k.name)} (${esc(k.pos)}, ${esc(k.verein)})${k.eigen ? " · eigener" : ""}</option>`).join("")}
                </select>
                <input type="search" id="vgSuche" class="styled-input" placeholder="Oder Namen suchen …" autocomplete="off">
                <div class="vg-treffer" id="vgTreffer"></div>
            </div>`;
        if (!v) {
            body.innerHTML = auswahl + `<p class="dz-leer">Kein Spieler zum Vergleich - eigene Spieler derselben Position oder gut gescoutete erscheinen hier.</p>`;
        } else {
            const mitte = (w) => w.exact ?? ((w.min ?? 0) + (w.max ?? 0)) / 2;
            const besser = (x, y) => (x ?? -Infinity) > (y ?? -Infinity);
            const kopf = (s, klasse) => `
                <div class="vg-person ${klasse}">
                    <i class="dz-punkt ${klasse === "vg-a" ? "dz-fuer" : "dz-gegen"}"></i>
                    <strong>${esc(s.name)}</strong>
                    <span>${esc(s.pos)} · ${esc(s.alter)} Jahre · ${esc(s.verein)}</span>
                    <span>${s.klasse ? esc(s.klasse) : (s.genau ? "" : `Werte geschätzt (Scoutwissen ${Math.round(s.wissen)} %)`)}</span>
                </div>`;
            const werte = v.werte.map(({ key, label }) => {
                const a = v.a.werte[key], bb = v.b.werte[key];
                const ma = mitte(a), mb = mitte(bb);
                const balken = (w, seite) => {
                    const breite = Math.max(2, Math.min(100, mitte(w)));
                    const spanne = w.exact === null && w.min !== null ? `<span class="vg-spanne" style="${seite}:${w.min}%; width:${Math.max(1, w.max - w.min)}%"></span>` : "";
                    return `<span class="vg-balken ${seite === "right" ? "dz-fuer" : "dz-gegen"}" style="width:${breite}%"></span>${spanne}`;
                };
                return `
                    <div class="vg-zeile">
                        <span class="vg-wert vg-wa${besser(ma, mb) ? " vg-besser" : ""}">${esc(a.text)}</span>
                        <span class="vg-spur vg-links">${balken(a, "right")}</span>
                        <span class="vg-label">${esc(label)}</span>
                        <span class="vg-spur vg-rechts">${balken(bb, "left")}</span>
                        <span class="vg-wert vg-wb${besser(mb, ma) ? " vg-besser" : ""}">${esc(bb.text)}</span>
                    </div>`;
            }).join("");
            const zeile = (label, xa, xb, fmt = (x) => x, hoeherBesser = true) => `
                <div class="vg-zeile vg-zahlen">
                    <span class="vg-wert vg-wa${(hoeherBesser ? besser(xa, xb) : besser(xb, xa)) ? " vg-besser" : ""}">${fmt(xa)}</span>
                    <span class="vg-label">${esc(label)}</span>
                    <span class="vg-wert vg-wb${(hoeherBesser ? besser(xb, xa) : besser(xa, xb)) ? " vg-besser" : ""}">${fmt(xb)}</span>
                </div>`;
            const n2 = (x) => this._zahl(x, 2), geld = (x) => this.geldKurz(x || 0);
            body.innerHTML = auswahl + `
                <div class="vg-koepfe">${kopf(v.a, "vg-a")}${kopf(v.b, "vg-b")}</div>
                <h4 class="vg-titel">${v.torhueter ? "Torwartwerte" : "Werte"}</h4>
                <div class="vg-werte">${werte}</div>
                <h4 class="vg-titel">Saison</h4>
                <div class="vg-werte">
                    ${zeile("Spiele", v.a.saison.spiele, v.b.saison.spiele)}
                    ${zeile("Tore", v.a.saison.tore, v.b.saison.tore)}
                    ${zeile("Vorlagen", v.a.saison.vorlagen, v.b.saison.vorlagen)}
                    ${zeile("Note", v.a.saison.note, v.b.saison.note, n2)}
                    ${zeile("Tore je 90", v.a.saison.toreJe90, v.b.saison.toreJe90, n2)}
                    ${zeile("Vorlagen je 90", v.a.saison.vorlagenJe90, v.b.saison.vorlagenJe90, n2)}
                </div>
                <h4 class="vg-titel">Vertrag</h4>
                <div class="vg-werte">
                    ${zeile("Marktwert", v.a.marktwert, v.b.marktwert, geld)}
                    ${zeile("Gehalt / Woche", v.a.gehalt, v.b.gehalt, geld, false)}
                    ${zeile("Vertrag (Jahre)", v.a.vertrag, v.b.vertrag, (x) => x ?? "–")}
                </div>
                <p class="dz-fazit">Fett ist der bessere Wert. Bei fremden Spielern zeigt die Spanne, wie genau der Scout ihn kennt.</p>`;
        }

        document.getElementById("vgWahl")?.addEventListener("change", (e) => this.zeigeVergleich(idA, e.target.value));
        const suche = document.getElementById("vgSuche");
        suche?.addEventListener("input", () => {
            const q = suche.value.trim().toLowerCase();
            const treffer = document.getElementById("vgTreffer");
            if (!treffer) return;
            if (q.length < 3) { treffer.innerHTML = ""; return; }
            const liste = state.players.filter(p => p.clubId && String(p.id) !== String(idA) && p.name.toLowerCase().includes(q)).slice(0, 8);
            treffer.innerHTML = liste.map(p => `<button type="button" class="dz-link" data-vg="${esc(p.id)}">${esc(p.name)} <span class="text-muted">(${esc(p.pos)}, ${esc(state.clubs.find(c => c.id === p.clubId)?.name || "")})</span></button>`).join("")
                || `<span class="text-muted">Kein Treffer</span>`;
            treffer.querySelectorAll("[data-vg]").forEach(t => t.addEventListener("click", () => this.zeigeVergleich(idA, t.dataset.vg)));
        });
        document.getElementById("btnCloseVergleich")?.addEventListener("click", () => { modal.style.display = "none"; });
        modal.style.display = "flex";
    }
});
