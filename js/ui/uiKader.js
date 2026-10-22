/**
 * Kader: Kennzahlen, Kabine, Kaderplanung, Meldeliste und Kaderliste.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Kader rendern mit Filter
     */
    /**
     * Eine Leiste mit Kennzahlen-Kacheln - wie der Kopf der Vereinsseite.
     * kacheln: [{ titel, wert, extra (HTML), klasse }], hinweis: eine Zeile darunter (HTML)
     */
    renderKennzahlen(elId, kacheln, hinweis = "") {
        const el = document.getElementById(elId);
        if (!el) return;
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        el.innerHTML = kacheln.map(k =>
            `<div class="vk-kachel${k.klasse ? " " + k.klasse : ""}" title="${esc(k.titel)}: ${esc(k.wert)}"><span>${esc(k.titel)}</span><strong>${esc(k.wert)}</strong>${k.extra || ""}</div>`).join("")
            + (hinweis ? `<p class="kz-hinweis">${hinweis}</p>` : "");
    },

    /**
     * Die Kabine: Kapitän, Führungsspieler, Grüppchen mit Wortführer und
     * Stimmung, dazu wer keinen Anschluss findet.
     */
    /** Die Mannschaftsbesprechung in der Kabinen-Karte: vier Ansprachen, Sperre, letzte Antwort */
    besprechungHtml(state) {
        const talk = this.getPlayerTalkEngine();
        if (!talk || typeof talk.mannschaftsbesprechung !== "function") return "";
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const gesperrt = talk.besprechungGesperrt(state);
        const club = state.clubs.find(c => c.id === state.userClubId);
        const zuletzt = club?.besprechung?.thema;
        const r = this._letzteBesprechung;
        const antwort = r ? `<div class="kb-antwort kba-${r.stimmung}">
                ${r.kapitaen ? `<strong>${esc(r.kapitaen)}:</strong> ` : ""}„${esc(r.antwort)}“
                <span class="text-muted">Moral im Schnitt ${r.schnitt > 0 ? "+" : ""}${String(r.schnitt).replace(".", ",")}${r.abgenutzt ? " - dieselbe Ansprache wie zuletzt, sie nutzt sich ab" : ""}.</span>
            </div>` : "";
        return `
            <div class="kb-besprechung">
                <span class="kb-label">Mannschaftsbesprechung</span>
                <div class="kb-besprechung-knoepfe">
                    ${Object.entries(talk.BESPRECHUNG_THEMEN).map(([key, t]) => `
                        <button class="btn btn-sm btn-secondary" data-besprechung="${key}" title="${esc(t.text)}" ${gesperrt ? "disabled" : ""}>
                            ${esc(t.label)}${key === zuletzt ? " (zuletzt)" : ""}
                        </button>`).join("")}
                </div>
                <p class="text-muted kb-hinweis">${gesperrt
                    ? `Die nächste Besprechung ist in ${gesperrt} Tag${gesperrt === 1 ? "" : "en"} möglich.`
                    : "Alle zwei Wochen. Was ankommt, hängt an Ergebnissen, Stimmung und Tabelle - und am Charakter der Spieler."}</p>
                ${antwort}
            </div>`;
    },

    /** Wer noch nicht angekommen ist - mit Prozent, die schwächsten zuerst */
    eingewoehnungHtml(state, h, link) {
        const T = typeof this.getTacticsEngine === "function" ? this.getTacticsEngine() : null;
        if (!T || typeof T.eingewoehnung !== "function") return "";
        T.stelleUhr(state);
        const liste = h.spieler.map(e => ({ p: e.player, w: T.eingewoehnung(e.player) }))
            .filter(x => x.w < 0.85).sort((a, b) => a.w - b.w);
        if (!liste.length) return "";
        return `<div><span class="kb-label">Eingewöhnung</span>${liste.map(x => `${link(x.p)} <span class="text-muted">${Math.round(x.w * 100)} %</span>`).join(", ")}</div>`;
    },

    renderKabine() {
        const box = document.getElementById("squadKabine");
        const engine = typeof DressingRoomEngine !== "undefined" ? DressingRoomEngine : null;
        if (!box || !engine || typeof engine.hierarchie !== "function") return;
        const state = this.app.state;
        const h = engine.hierarchie(state);
        if (!h.spieler.length) { box.innerHTML = ""; return; }
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const link = (p) => `<a href="#" data-kabine-spieler="${esc(p.id)}">${esc(p.name)}</a>`;
        const balken = (wert) => {
            const w = Math.max(0, Math.min(100, Math.round(wert)));
            const klasse = w >= 72 ? "gut" : (w >= 55 ? "mittel" : "schlecht");
            return `<span class="kb-balken"><i class="kb-${klasse}" style="width:${w}%"></i></span><span class="kb-wert">${w}</span>`;
        };
        const fuehrung = h.spieler.filter(e => e.stufe === "Führungsspieler");
        const neu = h.spieler.filter(e => e.stufe === "Neuzugang");
        const allein = h.spieler.filter(e => e.allein && e.sprache !== "deutsch");
        const optionen = h.spieler.slice().sort((a, b) => b.einfluss - a.einfluss)
            .map(e => `<option value="${esc(e.player.id)}"${e.player === h.kapitaen ? " selected" : ""}>${esc(e.player.name)} · Einfluss ${e.einfluss}</option>`).join("");
        box.innerHTML = `
            <div class="kb-kopf">
                <h3><svg class="ico" aria-hidden="true"><use href="#i-users"/></svg>Kabine</h3>
                <label class="kb-kapitaen">Kapitän
                    <select id="kabineKapitaen">${optionen}</select>
                </label>
            </div>
            ${this.besprechungHtml(state)}
            <div class="kb-stufen">
                <div><span class="kb-label">Führungsspieler</span>${fuehrung.length ? fuehrung.map(e => link(e.player)).join(", ") : "<span class=\"text-muted\">niemand</span>"}</div>
                <div><span class="kb-label">Neu in der Kabine</span>${neu.length ? neu.map(e => link(e.player)).join(", ") : "<span class=\"text-muted\">niemand</span>"}</div>
                ${this.eingewoehnungHtml(state, h, link)}
            </div>
            <div class="kb-gruppen">
                ${h.gruppen.map(g => `
                    <div class="kb-gruppe">
                        <div class="kb-gruppe-kopf"><strong>${esc(g.name)}</strong><span class="text-muted">${g.mitglieder.length} Spieler</span></div>
                        <div class="kb-zeile"><span class="kb-label">Stimmung</span>${balken(g.stimmung)}</div>
                        <div class="kb-zeile"><span class="kb-label">Wortführer</span>${link(g.wortfuehrer)}</div>
                    </div>`).join("")}
            </div>
            ${allein.length ? `<div class="hint-box mt-2">Ohne Landsleute im Kader: ${allein.map(e => link(e.player)).join(", ")}. Wer sich schwer anpasst, verliert dadurch Moral.</div>` : ""}
            <p class="text-muted kb-hinweis">Ist ein Wortführer unzufrieden, färbt das auf seine Gruppe ab, beim Kapitän auf alle. Wer einen Führungsspieler verkauft, hat ein paar Tage Unruhe. Neuzugänge gewöhnen sich mit Zeit und Einsätzen ein, ein Trainingslager (Training) beschleunigt es.</p>`;
        box.querySelectorAll("[data-kabine-spieler]").forEach(a => a.addEventListener("click", (e) => {
            e.preventDefault();
            const ziel = state.players.find(p => String(p.id) === a.dataset.kabineSpieler);
            if (ziel) this.showPlayerDetailsModal(ziel.id);
        }));
        box.querySelectorAll("[data-besprechung]").forEach(btn => btn.addEventListener("click", () => {
            const talk = this.getPlayerTalkEngine();
            const res = talk ? talk.mannschaftsbesprechung(state, btn.dataset.besprechung) : null;
            if (!res || !res.success) { this.showToast(res?.error || "Die Besprechung kam nicht zustande.", "error"); return; }
            this._letzteBesprechung = res;
            this.playSound("click");
            this.showToast(`Mannschaftsbesprechung: ${res.stimmung === "gut" ? "kam an" : res.stimmung === "schlecht" ? "ging daneben" : "gemischtes Echo"}.`,
                res.stimmung === "gut" ? "success" : (res.stimmung === "schlecht" ? "error" : "info"));
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderSquad?.();
        }));
        const wahl = document.getElementById("kabineKapitaen");
        if (wahl) wahl.addEventListener("change", () => {
            const res = engine.setzeKapitaen(state, wahl.value);
            if (!res.success) { this.showToast(res.error, "error"); return; }
            this.showToast(res.vorher && res.vorher !== res.kapitaen
                ? `${res.kapitaen.name} ist neuer Kapitän. ${res.vorher.name} muss das erst verdauen.`
                : `${res.kapitaen.name} ist Kapitän.`, "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderKabine();
        });
    },

    /**
     * Die Kaderplanung über drei Spielzeiten: je Mannschaftsteil, wer dann
     * noch da ist, und was fehlt. Aufgeklappt bleibt sie aufgeklappt.
     */
    renderKaderplanung(state) {
        const box = document.getElementById("squadPlanung");
        const engine = typeof KaderplanungEngine !== "undefined" ? KaderplanungEngine : null;
        if (!box || !engine) return;
        const p = engine.plan(state);
        if (!p) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const MARKE = { vertrag: "⏳", alter: "👴", rueckkehr: "↩", leihe: "🔁", zugang: "✍" };
        const STATUS = { luecke: "Lücke", duenn: "dünn", gut: "gut" };
        const hinweise = engine.hinweise(state);
        const offen = box.open;
        box.innerHTML = `
            <summary><h3><svg class="ico h-ico" aria-hidden="true"><use href="#i-folder"/></svg>Kaderplanung</h3><span class="header-tag">${hinweise.length ? `${hinweise.length} Baustelle${hinweise.length === 1 ? "" : "n"}` : "alles besetzt"}</span></summary>
            ${hinweise.length ? `<div class="kp-hinweise">${hinweise.map(h => `
                <div class="partner-zeile"><span>${esc(h.text)}</span>
                <button class="btn btn-sm btn-secondary" data-kp-suche="${h.key}">Suchauftrag</button></div>`).join("")}</div>` : ""}
            <p class="muted-note">Stammspieler-Niveau ab Stärke ${p.stammStaerke} (drei Sterne). ⏳ Vertrag endet · 👴 33 oder älter · ↩ kehrt von Leihe zurück · 🔁 nur geliehen · ✍ Vorvertrag</p>
            <div class="kp-raster">
                <div class="kp-kopf"></div>${p.spalten.map(s => `<div class="kp-kopf">Saison ${s.saison}</div>`).join("")}
                ${engine.TEILE.map((t, i) => `
                    <div class="kp-teil">${esc(t.titel)}</div>
                    ${p.spalten.map(s => { const z = s.teile[i]; return `
                        <div class="kp-zelle kp-${z.status}">
                            <div class="kp-zahl">${z.anzahl}/${z.bedarf} <small>${STATUS[z.status]}</small></div>
                            ${z.spieler.slice(0, 6).map(sp => `<div class="kp-spieler${sp.stamm ? " stamm" : ""}">${esc(sp.name.split(" ").slice(-1)[0])} <small>${sp.alter}</small>${sp.marken.map(m => MARKE[m] || "").join("")}</div>`).join("")}
                        </div>`; }).join("")}`).join("")}
            </div>`;
        box.open = offen;
        box.querySelectorAll("[data-kp-suche]").forEach(b => b.addEventListener("click", (e) => {
            e.preventDefault();
            const r = engine.suchauftrag(state, b.dataset.kpSuche);
            if (!r.success) { this.showToast(r.error, "error"); return; }
            this.showToast("Suchauftrag läuft - die Berichte kommen in den Transfermarkt.", "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        }));
    },

    /**
     * Die Meldelisten (KaderregelEngine): Europapokal mit Liste A und B,
     * Premier League mit der Grenze für nicht im Land ausgebildete Spieler.
     * Angekreuzt wird hier, gespeichert erst mit "Melden".
     */
    renderMeldeliste(state) {
        const box = document.getElementById("squadMeldeliste");
        const engine = typeof KaderregelEngine !== "undefined" ? KaderregelEngine : null;
        if (!box || !engine) return;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const arten = club ? engine.arten(state, club) : [];
        if (!arten.length) { box.hidden = true; box.innerHTML = ""; return; }
        box.hidden = false;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const saison = state.seasonYear || 1;
        if (!this._meldeEntwurf || this._meldeEntwurf.saison !== saison) this._meldeEntwurf = { saison };
        const kader = engine._kader(state, club).slice().sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const reihenfolge = ["TW", "IV", "LV", "RV", "DM", "ZM", "LM", "RM", "OM", "LA", "RA", "ST"];
        kader.sort((a, b) => reihenfolge.indexOf(a.pos) - reihenfolge.indexOf(b.pos) || (b.overall || 0) - (a.overall || 0));
        const offen = box.open;
        const kopf = [];
        const teile = arten.map(art => {
            const regel = engine.regel(club, art);
            const gespeichert = engine.liste(state, art, club);
            const e = this._meldeEntwurf[art] || (this._meldeEntwurf[art] = { a: new Set(gespeichert.a), b: new Set(gespeichert.b || []) });
            const pruef = engine.pruefe(state, club, art, { a: [...e.a], b: [...e.b] });
            const z = pruef.zahlen;
            const darf = engine.offen(state, art);
            const schluss = state.calendar?.[engine.meldeschluss(state, art)]?.date;
            const geaendert = JSON.stringify([...e.a].sort()) !== JSON.stringify([...gespeichert.a].sort())
                || JSON.stringify([...e.b].sort()) !== JSON.stringify([...(gespeichert.b || [])].sort());
            const nichtEU = art === "liga" && regel.maxNichtEU != null;
            kopf.push(art === "europa" ? `${regel.name} ${z.a}/${z.platz}`
                : nichtEU ? `${regel.name} ${z.nichtEU}/${z.maxNichtEU} ohne EU-Pass` : `${regel.name} ${z.fremd}/${z.maxFremd} fremd`);
            const zahlText = art === "europa"
                ? `Liste A: ${z.a} von ${z.platz} Plätzen · lokal ausgebildet ${z.anrechenbar} von ${z.minLokal} (im Verein ${z.verein}, nur im Land ${z.land}, davon zählen höchstens ${z.maxVerband}) · Liste B: ${z.b}`
                : nichtEU
                    ? `Über ${engine.U21}: ${z.zaehlt} von ${z.max} · ohne EU-Pass ${z.nichtEU} von ${z.maxNichtEU} · U21 frei`
                    : `Über ${engine.U21}: ${z.zaehlt} von ${z.max} · nicht im Land ausgebildet ${z.fremd} von ${z.maxFremd} · U21 frei`;
            const status = gespeichert.vorschlag ? "noch nicht gemeldet - es gilt der Vorschlag" : "gemeldet";
            return `
                <section class="ml-teil" data-ml-art="${art}">
                    <h4>${esc(regel.name)} <small>${esc(status)}${schluss ? ` · Meldeschluss ${esc(schluss)}` : ""}${darf ? "" : " · gesperrt bis zum Winterfenster"}</small></h4>
                    <p class="ml-zahlen${pruef.ok ? "" : " ml-fehler"}">${esc(zahlText)}</p>
                    ${pruef.fehler.map(f => `<p class="ml-fehler">⚠️ ${esc(f)}</p>`).join("")}
                    <ul class="ml-liste">${kader.map(p => {
                        const lokal = engine.lokal(p, club);
                        const imVerein = art === "europa" && typeof engine.imVerein === "function" && engine.imVerein(state, p, club);
                        const b = art === "europa" && engine.fuerListeB(state, p, club);
                        const jung = art === "liga" && (p.age || 99) <= engine.U21;
                        const ohnePass = nichtEU && !engine.eu(state, p, club);
                        return `<li>
                            <label class="ml-wahl"><input type="checkbox" data-ml-a="${esc(p.id)}"${e.a.has(p.id) ? " checked" : ""}${darf ? "" : " disabled"}> <span class="ml-pos">${esc(p.pos)}</span> ${esc(p.name)} <small>${p.age} J. · ${p.overall}</small></label>
                            <span class="ml-marken">${imVerein ? `<span class="ml-marke" title="im Verein ausgebildet">🎓</span>` : lokal ? `<span class="ml-marke" title="im Land ausgebildet">🏠</span>` : ""}${jung ? `<span class="ml-marke">U21 frei</span>` : ""}${ohnePass ? `<span class="ml-marke" title="ohne EU-Pass">Nicht-EU</span>` : ""}${b ? `<label class="ml-b"><input type="checkbox" data-ml-b="${esc(p.id)}"${e.b.has(p.id) ? " checked" : ""}${darf ? "" : " disabled"}> B</label>` : ""}</span>
                        </li>`;
                    }).join("")}</ul>
                    ${darf ? `<div class="ml-knoepfe">
                        <button class="btn btn-sm btn-secondary" data-ml-vorschlag="${art}">Vorschlag übernehmen</button>
                        <button class="btn btn-sm btn-primary" data-ml-melden="${art}"${pruef.ok && geaendert ? "" : " disabled"}>Melden</button>
                    </div>` : ""}
                </section>`;
        });
        box.innerHTML = `
            <summary><h3><svg class="ico h-ico" aria-hidden="true"><use href="#i-clipboard"/></svg>Meldeliste</h3><span class="header-tag">${esc(kopf.join(" · "))}</span></summary>
            <p class="muted-note">Nur wer gemeldet ist, darf im Wettbewerb spielen. 🎓 = im Verein ausgebildet (drei Saisons zwischen 15 und 21 oder aus der eigenen Jugend), 🏠 = im Land ausgebildet (Nationalität des Landes). Im Europapokal sind acht Plätze für beide reserviert, höchstens vier davon für 🏠. Liste B: bis 21 und seit zwei Saisons im Verein oder aus der eigenen Jugend.${arten.includes("liga") && engine.regel(club, "liga")?.maxNichtEU != null ? " Nicht-EU: ohne Pass eines EU-Landes. Spieler aus den AKP-Staaten zählen wie EU-Bürger, Südamerikaner nach zwei Saisons im Verein auch." : ""}</p>
            ${teile.join("")}`;
        box.open = offen;
        const neu = () => this.renderMeldeliste(state);
        box.querySelectorAll("[data-ml-a]").forEach(cb => cb.addEventListener("change", () => {
            const art = cb.closest("[data-ml-art]").dataset.mlArt;
            const id = this.resolvePlayerId ? this.resolvePlayerId(cb.dataset.mlA) : cb.dataset.mlA;
            const e = this._meldeEntwurf[art];
            if (cb.checked) { e.a.add(id); e.b.delete(id); } else e.a.delete(id);
            neu();
        }));
        box.querySelectorAll("[data-ml-b]").forEach(cb => cb.addEventListener("change", () => {
            const id = this.resolvePlayerId ? this.resolvePlayerId(cb.dataset.mlB) : cb.dataset.mlB;
            const e = this._meldeEntwurf.europa;
            if (cb.checked) { e.b.add(id); e.a.delete(id); } else e.b.delete(id);
            neu();
        }));
        box.querySelectorAll("[data-ml-vorschlag]").forEach(b => b.addEventListener("click", (ev) => {
            ev.preventDefault();
            const art = b.dataset.mlVorschlag;
            const v = engine.vorschlag(state, club, art);
            this._meldeEntwurf[art] = { a: new Set(v.a), b: new Set(v.b || []) };
            neu();
        }));
        box.querySelectorAll("[data-ml-melden]").forEach(b => b.addEventListener("click", (ev) => {
            ev.preventDefault();
            const art = b.dataset.mlMelden;
            const e = this._meldeEntwurf[art];
            const r = engine.festlegen(state, art, { a: [...e.a], b: [...e.b] });
            if (!r.ok) { this.showToast(r.fehler.join(" "), "error"); return; }
            this.showToast(`Meldeliste ${engine.regel(club, art)?.name} abgegeben.`, "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            neu();
        }));
    },

    renderSquad(posFilter) {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;
        // Rückennummern: vor dem Namen, ein Tipp ändert sie
        if (typeof GameState !== "undefined" && typeof GameState.rueckennummern === "function") GameState.rueckennummern(state, userClub);

        // Wer gerade verliehen ist, steht nicht im Kader - aber hier darunter
        const verliehenBox = document.getElementById("squadLoanedOut");
        const leihEngine = this.getLoanEngine();
        if (verliehenBox && leihEngine) {
            const weg = leihEngine.verlieheneVon(state, userClub.id);
            verliehenBox.style.display = weg.length ? "" : "none";
            verliehenBox.innerHTML = weg.length
                ? `<strong>Verliehen:</strong> ${weg.map(p => `<a href="#" data-verliehen="${this.escapeHtml(String(p.id))}">${this.escapeHtml(p.name)}</a> (${this.escapeHtml(state.clubs.find(c => c.id === p.leihe.leihvereinId)?.name || "?")})`).join(", ")}`
                : "";
            verliehenBox.querySelectorAll("[data-verliehen]").forEach(a => a.addEventListener("click", (e) => {
                e.preventDefault();
                const ziel = state.players.find(p => String(p.id) === a.dataset.verliehen);
                if (ziel) this.showPlayerDetailsModal(ziel.id);
            }));
        }

        this.renderKabine();
        this.renderReserve();
        this.renderKaderplanung(state);
        this.renderMeldeliste(state);

        // Kennzahlen des ganzen Kaders - unabhaengig vom Filter
        const kader = state.players.filter(p => userClub.playerIds.includes(p.id));
        if (kader.length) {
            const alter = kader.reduce((s, p) => s + (p.age || 0), 0) / kader.length;
            const wert = kader.reduce((s, p) => s + (p.value || 0), 0);
            const gehalt = kader.reduce((s, p) => s + (p.wage || 0), 0);
            const ausfall = kader.filter(p => (p.injuredWeeks || 0) > 0 || (p.suspendedMatches || 0) > 0).length;
            const fit = Math.round(kader.reduce((s, p) => s + (p.fitness ?? 100), 0) / kader.length);
            const auslaufend = kader.filter(p => (p.contractYears ?? p.contract?.years ?? 2) <= 1).length;
            this.renderKennzahlen("squadKennzahlen", [
                { titel: "Spieler", wert: String(kader.length), extra: `<small>Ø ${alter.toFixed(1).replace(".", ",")} Jahre</small>` },
                { titel: "Marktwert", wert: this.geldKurz(wert), extra: `<small>gesamt</small>` },
                { titel: "Gehälter", wert: this.geldKurz(gehalt), extra: `<small>pro Woche</small>` },
                { titel: "Fitness", wert: `${fit} %`, extra: `<span class="vk-balken"><i style="width:${fit}%"></i></span>`, klasse: fit < 80 ? "warnung" : "" },
                { titel: "Ausfälle", wert: String(ausfall), extra: `<small>verletzt oder gesperrt</small>`, klasse: ausfall >= 3 ? "gefahr" : "" },
                { titel: "Verträge", wert: String(auslaufend), extra: `<small>laufen bald aus</small>`, klasse: auslaufend >= 4 ? "warnung" : "" }
            // Der Sternemaßstab ist keine Kennzahl des Kaders: eine Zeile statt einer siebten Kachel
            ], `<span class="kz-hinweis-sterne">★★★</span> heißt ${this.escapeHtml(this.constructor.STERN_MASSSTAEBE[this.sternMassstab()].kurz)} · Maßstab in den Einstellungen`);
        }

        this.zeichneKaderliste(state, userClub, posFilter);
    },

    // ------------------------------------------------------------ Kaderliste

    /**
     * Die Kaderliste wie im Vorbild: Ansichten mit eigenen Spalten
     * (Übersicht, Vertrag, Leistung, Fitness), Sortieren nach allem, was
     * praktisch ist - auch am Handy, wo es keine Spaltenköpfe gibt -, und
     * Schnellfilter. Die Wahl bleibt, auch nach dem Neuladen.
     */
    KADER_SPEICHER: "viererkette-kaderliste",
    KADER_POSITIONEN: ["TW", "IV", "LV", "RV", "DM", "ZM", "LM", "RM", "OM", "LA", "RA", "ST"],

    /** Sortierschlüssel: Name, ob zuerst absteigend, und der Wert je Spieler (z = vorbereitete Zahlen) */
    KADER_SORTEN: {
        pos: { name: "Position", ab: false, wert: (p, z) => z.posIndex * 1000 - z.staerke },
        staerke: { name: "Stärke", ab: true, wert: (p, z) => z.staerke },
        potenzial: { name: "Potenzial", ab: true, wert: (p, z) => z.potenzial },
        alter: { name: "Alter", ab: false, wert: (p) => p.age || 0 },
        vertrag: { name: "Vertragsende", ab: false, wert: (p) => (p.contractYears ?? 0) * 1e9 - (p.wage || 0) },
        gehalt: { name: "Gehalt", ab: true, wert: (p) => p.wage || 0 },
        wert: { name: "Marktwert", ab: true, wert: (p) => p.value || 0 },
        form: { name: "Form", ab: true, wert: (p) => Number(p.form) || 0 },
        fitness: { name: "Kondition", ab: true, wert: (p) => p.fitness ?? 100 },
        praxis: { name: "Spielpraxis", ab: true, wert: (p, z) => z.praxis },
        moral: { name: "Zufriedenheit", ab: true, wert: (p) => p.happiness?.overall ?? 75 },
        spiele: { name: "Einsätze", ab: true, wert: (p, z) => z.saison.matches || 0 },
        minuten: { name: "Minuten", ab: true, wert: (p, z) => z.saison.minutes || 0 },
        tore: { name: "Tore", ab: true, wert: (p, z) => z.saison.goals || 0 },
        vorlagen: { name: "Vorlagen", ab: true, wert: (p, z) => z.saison.assists || 0 },
        note: { name: "Note", ab: true, wert: (p, z) => z.saison.matches ? z.saison.ratingSum / z.saison.matches : -1 },
        nummer: { name: "Rückennummer", ab: false, wert: (p) => Number.isInteger(p.trikot) ? p.trikot : 999 },
        name: { name: "Name", ab: false, text: true, wert: (p) => p.name || "" }
    },

    /** Die Ansichten und ihre Spalten (zwischen Pos und dem Knopf am Ende) */
    KADER_ANSICHTEN: {
        uebersicht: { name: "Übersicht", spalten: ["staerke", "rolle", "fitness", "moral", "form", "wert", "gehalt", "vertrag"] },
        vertrag: { name: "Vertrag", spalten: ["kaderrolle", "vertragBis", "gehalt", "wert", "vertragZufrieden", "hinweis"] },
        leistung: { name: "Leistung", spalten: ["spiele", "minuten", "tore", "vorlagen", "note", "form", "karten"] },
        fitness: { name: "Fitness", spalten: ["fitness", "praxis", "ausfall", "belastung", "moral"] }
    },

    /** Schnellfilter */
    KADER_FILTER: {
        alle: { name: "Alle", passt: () => true },
        auslaufend: { name: "Vertrag läuft aus", passt: (p, state) => typeof SeasonEngine !== "undefined" && SeasonEngine.vertragEndetZumWechsel ? SeasonEngine.vertragEndetZumWechsel(state, p) : (p.contractYears ?? 2) <= 1 },
        ausfall: { name: "Ausfälle", passt: (p) => (p.injuredWeeks || 0) > 0 || (p.suspendedMatches || 0) > 0 },
        jung: { name: "U21", passt: (p) => (p.age || 30) <= 21 },
        markt: { name: "Auf dem Markt", passt: (p) => !!(p.transferListed || p.leihListe || p.vorvertrag) }
    },

    /** Die gemerkte Wahl: Ansicht, Sortierung, Richtung, Schnellfilter, Position */
    kaderWahl() {
        if (!this._kaderWahl) {
            let gemerkt = {};
            try { gemerkt = JSON.parse(localStorage.getItem(this.KADER_SPEICHER) || "{}") || {}; } catch (e) { gemerkt = {}; }
            this._kaderWahl = {
                ansicht: this.KADER_ANSICHTEN[gemerkt.ansicht] ? gemerkt.ansicht : "uebersicht",
                sorte: this.KADER_SORTEN[gemerkt.sorte] ? gemerkt.sorte : "pos",
                ab: typeof gemerkt.ab === "boolean" ? gemerkt.ab : null,
                filter: this.KADER_FILTER[gemerkt.filter] ? gemerkt.filter : "alle",
                pos: ["all", "TW", "DEF", "MID", "ATT"].includes(gemerkt.pos) ? gemerkt.pos : "all"
            };
        }
        return this._kaderWahl;
    },

    setzeKaderWahl(teil) {
        Object.assign(this.kaderWahl(), teil);
        try { localStorage.setItem(this.KADER_SPEICHER, JSON.stringify(this._kaderWahl)); } catch (e) { /* ohne Speicher geht es auch */ }
        this.renderSquad();
    },

    /** Die Spieler der Liste: Position und Schnellfilter, sortiert - mit den vorbereiteten Zahlen */
    kaderZeilen(state, userClub, posFilter) {
        const wahl = this.kaderWahl();
        const gruppen = { TW: ["TW"], DEF: ["IV", "LV", "RV"], MID: ["DM", "ZM", "OM", "LM", "RM"], ATT: ["ST", "LA", "RA"] };
        const ratingEngine = this.getRatingEngine?.();
        const filter = this.KADER_FILTER[wahl.filter] || this.KADER_FILTER.alle;
        const zeilen = state.players
            .filter(p => userClub.playerIds.includes(p.id))
            .filter(p => posFilter === "all" || (gruppen[posFilter] || []).includes(p.pos))
            .filter(p => filter.passt(p, state))
            .map(p => {
                const card = ratingEngine ? ratingEngine.calculateVisiblePlayerCard(p, Object.assign({ userClubId: userClub.id, leagueDataCoverage: 95 }, this.starContext())) : null;
                const saison = typeof StatistikEngine !== "undefined" ? StatistikEngine.von(p, "alle") : (p.stats || {});
                return {
                    p, card, saison: { ...saison, yellowCards: p.stats?.yellowCards || 0, redCards: p.stats?.redCards || 0 },
                    staerke: card ? (Number(card.starsCaMin) + Number(card.starsCaMax)) / 2 : (p.overall || 0) / 20,
                    potenzial: card ? Number(card.starsPaMax) || 0 : (p.pot || 0) / 20,
                    posIndex: Math.max(0, this.KADER_POSITIONEN.indexOf(p.pos)),
                    praxis: typeof p.spielpraxis === "number" ? Math.round(p.spielpraxis * 100) : (p.matchSharpness ?? 60)
                };
            });
        const sorte = this.KADER_SORTEN[wahl.sorte] || this.KADER_SORTEN.pos;
        const ab = wahl.ab === null ? sorte.ab : wahl.ab;
        zeilen.sort((a, b) => {
            const va = sorte.wert(a.p, a), vb = sorte.wert(b.p, b);
            const v = sorte.text ? String(va).localeCompare(String(vb), "de") : va - vb;
            return (ab ? -v : v) || (b.staerke - a.staerke);
        });
        return zeilen;
    },

    /** Eine Zelle je Spalte: Kopf, Sortierschlüssel und Inhalt */
    kaderSpalte(key) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const geld = (x) => this.geldKurz(x || 0);
        const komma = (x, n = 1) => Number(x).toFixed(n).replace(".", ",");
        const state = this.app.state;
        const spalten = {
            staerke: { titel: "Stärke & Potenzial", sorte: "staerke", klasse: "sq-staerke nowrap", zelle: (z) => `${z.card ? z.card.abilityStarsHtml : ""}<div class="squad-ability-hint">${esc(z.card?.abilityLabel || "")}</div>` },
            rolle: { titel: "Beste Rolle", sorte: null, klasse: "sq-rolle", zelle: (z) => { const r = z.card?.bestRole?.role || z.p.squadRole || "Kader"; return `<span class="role-chip" title="${esc(r)}">${esc(r)}</span>`; } },
            fitness: { titel: "Kondition", sorte: "fitness", klasse: "sq-fit nowrap", zelle: (z) => { const f = Math.round(z.p.fitness ?? 100); return `<span class="mini-bar"><span class="mini-bar-fill" style="width:${f}%;background:${this.fitnessFarbe(f)}"></span></span>${f}%`; } },
            moral: { titel: "Zufriedenheit", sorte: "moral", klasse: "sq-moral nowrap", zelle: (z) => { const h = Math.round(z.p.happiness?.overall ?? 75); return `${h >= 80 ? "😊" : h >= 60 ? "😐" : "😞"} ${h}%`; } },
            form: { titel: "Form", sorte: "form", klasse: "sq-form", zelle: (z) => komma(Number(z.p.form) || 0) },
            wert: { titel: "Marktwert", sorte: "wert", klasse: "sq-wert nowrap", zelle: (z) => geld(z.p.value) },
            gehalt: { titel: "Gehalt/Wo.", sorte: "gehalt", klasse: "sq-gehalt nowrap", zelle: (z) => geld(z.p.wage) },
            vertrag: { titel: "Vertrag", sorte: "vertrag", klasse: "sq-vertrag nowrap", zelle: (z) => `${z.p.vorvertrag ? `<span title="Geht zum Saisonwechsel zu ${esc(z.p.vorvertrag.clubName)}">✍️</span> ` : ""}<span class="${this.kaderVertragTon(z.p)}">${z.p.contractYears} J.</span>` },
            alter: { titel: "Alter", sorte: "alter", klasse: "sq-alter-spalte", zelle: (z) => String(z.p.age) },
            kaderrolle: { titel: "Kaderrolle", sorte: null, klasse: "sq-kaderrolle", zelle: (z) => esc(z.p.squadRole || "Kader") + (z.p.jugendvertrag ? ` <small class="text-muted">Jugendvertrag</small>` : "") },
            vertragBis: { titel: "Vertrag bis", sorte: "vertrag", klasse: "sq-vertrag nowrap", zelle: (z) => `<span class="${this.kaderVertragTon(z.p)}">${esc(this.vertragsEnde ? (this.vertragsEnde(z.p) || "–") : `${z.p.contractYears} J.`)}</span>` },
            vertragZufrieden: { titel: "Zufrieden", sorte: null, klasse: "sq-zufrieden nowrap", zelle: (z) => `<span title="Zufriedenheit mit dem Vertrag">${Math.round(z.p.happiness?.contract ?? 75)} %</span>` },
            // Was um den Vertrag gerade läuft - oder eine Ausstiegsklausel
            hinweis: { titel: "Hinweis", sorte: null, klasse: "sq-hinweis", zelle: (z) => {
                const lage = this.kaderLage(z.p);
                const k = typeof TransferEngine !== "undefined" && TransferEngine.ausstiegsklausel ? TransferEngine.ausstiegsklausel(state, z.p) : null;
                return [lage ? esc(lage) : "", k ? `Klausel ${geld(k)}` : ""].filter(Boolean).join(" · ") || "–";
            } },
            spiele: { titel: "Sp", sorte: "spiele", klasse: "sq-zahl", zelle: (z) => String(z.saison.matches || 0) },
            minuten: { titel: "Min", sorte: "minuten", klasse: "sq-zahl", zelle: (z) => String(z.saison.minutes || 0) },
            tore: { titel: "Tore", sorte: "tore", klasse: "sq-zahl", zelle: (z) => String(z.saison.goals || 0) },
            vorlagen: { titel: "Vorl.", sorte: "vorlagen", klasse: "sq-zahl", zelle: (z) => String(z.saison.assists || 0) },
            note: { titel: "Note", sorte: "note", klasse: "sq-zahl", zelle: (z) => z.saison.matches ? komma(z.saison.ratingSum / z.saison.matches, 2) : "–" },
            karten: { titel: "Karten", sorte: null, klasse: "sq-karten nowrap", zelle: (z) => `<span class="sq-gelb${z.saison.yellowCards ? "" : " sq-null"}">${z.saison.yellowCards}</span> <span class="sq-rot${z.saison.redCards ? "" : " sq-null"}">${z.saison.redCards}</span>` },
            praxis: { titel: "Spielpraxis", sorte: "praxis", klasse: "sq-praxis nowrap", zelle: (z) => `<span class="mini-bar"><span class="mini-bar-fill" style="width:${z.praxis}%;background:${this.fitnessFarbe(z.praxis)}"></span></span>${z.praxis}%` },
            ausfall: { titel: "Ausfall", sorte: null, klasse: "sq-ausfall", zelle: (z) => z.p.injuredWeeks > 0 ? `<span class="pf-ton-schlecht">${esc(z.p.injuryName || "Verletzt")} · ${z.p.injuredWeeks} Wo.</span>` : (z.p.suspendedMatches > 0 ? `<span class="pf-ton-schlecht">Gesperrt · ${z.p.suspendedMatches} Sp.</span>` : "–") },
            belastung: { titel: "Belastung", sorte: null, klasse: "sq-belastung", zelle: (z) => { const l = z.p.trainingLog?.load; return l === undefined || l === null ? "–" : (l >= 7 ? `<span class="pf-ton-schlecht">hoch</span>` : (l >= 4 ? "normal" : "gering")); } }
        };
        return spalten[key];
    },

    /** Ein auslaufender Vertrag fällt auf */
    kaderVertragTon(p) {
        const endet = typeof SeasonEngine !== "undefined" && SeasonEngine.vertragEndetZumWechsel ? SeasonEngine.vertragEndetZumWechsel(this.app.state, p) : (p.contractYears ?? 2) <= 1;
        return endet && !p.vorvertrag ? "pf-ton-schlecht" : ((p.contractYears ?? 2) <= 2 ? "pf-ton-mittel" : "");
    },

    /** Was um seinen Vertrag gerade läuft */
    kaderLage(p) {
        if (p.vorvertrag) return `geht zu ${p.vorvertrag.clubName}`;
        if (p.vorvertragInteresse) return `${p.vorvertragInteresse.clubName} wirbt`;
        if (p.wechselwunsch && !p.wechselwunsch.akzeptiert) return "will weg";
        if (p.transferListed) return "Transferliste";
        if (p.leihListe) return "Leihliste";
        if (p.leihe) return "Leihspieler";
        return "";
    },

    /** Die Zeile darunter am Handy: das Wichtigste der Ansicht */
    kaderMeta(z, ansicht) {
        const p = z.p;
        const geld = (x) => this.geldKurz(x || 0);
        const form = (Number(p.form) || 0).toFixed(1).replace(".", ",");
        if (ansicht === "vertrag") return `Vertrag bis ${this.vertragsEnde ? this.vertragsEnde(p) || "–" : p.contractYears + " J."} · ${geld(p.wage)}/Wo · ${geld(p.value)}${this.kaderLage(p) ? " · " + this.kaderLage(p) : ""}`;
        if (ansicht === "leistung") return `${z.saison.matches || 0} Sp · ${z.saison.goals || 0} T · ${z.saison.assists || 0} V · Note ${z.saison.matches ? (z.saison.ratingSum / z.saison.matches).toFixed(2).replace(".", ",") : "–"} · Form ${form}`;
        if (ansicht === "fitness") return `Spielpraxis ${z.praxis} %${p.injuredWeeks > 0 ? ` · verletzt ${p.injuredWeeks} Wo.` : ""}${p.suspendedMatches > 0 ? ` · gesperrt ${p.suspendedMatches} Sp.` : ""} · Moral ${Math.round(p.happiness?.overall ?? 75)} %`;
        return `Form ${form} · ${geld(p.value)} · ${geld(p.wage)}/Wo · ${p.vorvertrag ? `geht zu ${p.vorvertrag.clubName}` : `${p.contractYears} J. Vertrag`}`;
    },

    /** Leiste über der Liste: Ansicht, Sortieren mit Richtung, Schnellfilter */
    kaderWerkzeugeHtml(anzahl) {
        const wahl = this.kaderWahl();
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const sorte = this.KADER_SORTEN[wahl.sorte];
        const ab = wahl.ab === null ? sorte.ab : wahl.ab;
        return `
            <div class="kw-gruppe kw-ansichten" role="tablist" aria-label="Ansicht">
                ${Object.entries(this.KADER_ANSICHTEN).map(([k, a]) => `<button type="button" role="tab" class="filter-chip${k === wahl.ansicht ? " active" : ""}" data-kw-ansicht="${k}" aria-selected="${k === wahl.ansicht}">${esc(a.name)}</button>`).join("")}
            </div>
            <div class="kw-gruppe kw-sortieren">
                <label for="kwSorte">Sortieren</label>
                <select id="kwSorte" class="styled-select">
                    ${Object.entries(this.KADER_SORTEN).map(([k, x]) => `<option value="${k}"${k === wahl.sorte ? " selected" : ""}>${esc(x.name)}</option>`).join("")}
                </select>
                <button type="button" class="btn btn-sm btn-secondary kw-richtung" id="kwRichtung" title="${ab ? "absteigend - umkehren" : "aufsteigend - umkehren"}" aria-label="Richtung umkehren">${ab ? "↓" : "↑"}</button>
            </div>
            <div class="kw-gruppe kw-filter">
                ${Object.entries(this.KADER_FILTER).map(([k, f]) => `<button type="button" class="filter-chip${k === wahl.filter ? " active" : ""}" data-kw-filter="${k}">${esc(f.name)}</button>`).join("")}
                <span class="kw-anzahl">${anzahl} ${anzahl === 1 ? "Spieler" : "Spieler"}</span>
            </div>`;
    },

    zeichneKaderliste(state, userClub, posFilter) {
        const wahl = this.kaderWahl();
        // Die Positionsknöpfe merken sich ihre Wahl - vorher fiel die Liste
        // beim Neuzeichnen auf "Alle" zurück, der Knopf blieb aber markiert
        if (posFilter !== undefined) { wahl.pos = posFilter; try { localStorage.setItem(this.KADER_SPEICHER, JSON.stringify(wahl)); } catch (e) { /* egal */ } }
        const pos = wahl.pos;
        document.querySelectorAll("[data-filter-pos]").forEach(b => b.classList.toggle("active", b.dataset.filterPos === pos));
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const zeilen = this.kaderZeilen(state, userClub, pos);
        const ansicht = this.KADER_ANSICHTEN[wahl.ansicht] || this.KADER_ANSICHTEN.uebersicht;
        const spalten = ansicht.spalten.map(k => ({ key: k, ...this.kaderSpalte(k) })).filter(s => s.zelle);
        const sorte = this.KADER_SORTEN[wahl.sorte];
        const ab = wahl.ab === null ? sorte.ab : wahl.ab;

        const werkzeuge = document.getElementById("squadWerkzeuge");
        if (werkzeuge) werkzeuge.innerHTML = this.kaderWerkzeugeHtml(zeilen.length);

        // Kopf: Status, Name, Pos, die Spalten der Ansicht - ein Tipp sortiert
        const kopf = document.getElementById("squadTableHead");
        const th = (titel, klasse, key) => {
            const an = key && key === wahl.sorte;
            return `<th class="${klasse.split(" ")[0]}${an ? ` sortiert${ab ? " sortiert-ab" : ""}` : ""}"${key ? ` data-kader-sort="${key}" aria-sort="${an ? (ab ? "descending" : "ascending") : "none"}"` : ""}>${titel}</th>`;
        };
        if (kopf) {
            kopf.innerHTML = `<tr>${th("Status", "sq-status", null)}${th("Name", "sq-name", "name")}${th("Pos", "sq-pos", "pos")}${spalten.map(s => th(esc(s.titel), s.klasse, s.sorte)).join("")}<th class="sq-meta"></th><th class="sq-aktion"></th></tr>`;
            const tabelle = document.getElementById("squadTable");
            if (tabelle) tabelle.dataset.ansicht = wahl.ansicht;
        }

        const tbody = document.getElementById("squadTableBody");
        if (!tbody) return;
        tbody.innerHTML = zeilen.length ? zeilen.map(z => {
            const p = z.p;
            const isLineup = userClub.lineup.includes(p.id);
            const isBench = userClub.bench.includes(p.id);
            let statusBadge = `<span class="badge-status-fit">Fit</span>`;
            if (p.injuredWeeks > 0) statusBadge = `<span class="badge-status-inj">🚑 ${p.injuredWeeks} Wo.</span>`;
            else if (p.suspendedMatches > 0) statusBadge = `<span class="badge-status-susp">🟥 ${p.suspendedMatches} Sp.</span>`;
            else if (isLineup) statusBadge = `<span class="badge-status-lineup">Startelf</span>`;
            else if (isBench) statusBadge = `<span class="badge-status-bench">Bank</span>`;
            const neben = (Array.isArray(p.positions) ? p.positions : []).filter(x => x && x !== p.pos).slice(0, 2)
                .map(x => `<span class="pos-tag pos-secondary" title="Nebenposition">${x}</span>`).join("");
            const hinweis = p.reserve ? (p.reserve === "u19" ? "U19" : "U23")
                : (p.nominiertAus ? `aus der ${p.nominiertAus === "u19" ? "U19" : "U23"} · nur Spieltag` : (p.leihe ? "Leihspieler" : esc((p.squadRole || "Kader") + (p.jugendvertrag ? " · Jugendvertrag" : ""))));
            return `
                <tr class="row-clickable" data-player-id="${p.id}" title="Details zu ${esc(p.name)} öffnen">
                    <td class="sq-status">${statusBadge}</td>
                    <td class="sq-name"><button class="sq-nr" type="button" data-nr-id="${esc(String(p.id))}" title="Rückennummer ändern">${Number.isInteger(p.trikot) ? p.trikot : "–"}</button><strong>${esc(p.name)}</strong>${this.signaturMarke(p)}<span class="squad-role-hint">${hinweis} · ${p.age} J.</span></td>
                    <td class="sq-pos nowrap"><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span>${neben}</td>
                    ${spalten.map(s => `<td class="${s.klasse}">${s.zelle(z)}</td>`).join("")}
                    <td class="sq-meta">${esc(this.kaderMeta(z, wahl.ansicht))}</td>
                    <td class="sq-aktion"><button class="btn btn-sm btn-secondary btn-player-details" data-player-id="${p.id}" aria-label="Details zu ${esc(p.name)}">›</button></td>
                </tr>`;
        }).join("") : `<tr><td colspan="${spalten.length + 5}" class="kw-leer">Kein Spieler passt zu dieser Auswahl.</td></tr>`;

        // Bedienung: Ansicht, Sortierung, Richtung, Schnellfilter, Spaltenköpfe
        werkzeuge?.querySelectorAll("[data-kw-ansicht]").forEach(b => b.addEventListener("click", () => this.setzeKaderWahl({ ansicht: b.dataset.kwAnsicht })));
        werkzeuge?.querySelector("#kwSorte")?.addEventListener("change", (e) => this.setzeKaderWahl({ sorte: e.target.value, ab: null }));
        werkzeuge?.querySelector("#kwRichtung")?.addEventListener("click", () => this.setzeKaderWahl({ ab: !ab }));
        werkzeuge?.querySelectorAll("[data-kw-filter]").forEach(b => b.addEventListener("click", () => this.setzeKaderWahl({ filter: b.dataset.kwFilter })));
        kopf?.querySelectorAll("[data-kader-sort]").forEach(h => h.addEventListener("click", () => {
            const key = h.dataset.kaderSort;
            this.setzeKaderWahl(key === wahl.sorte ? { ab: !ab } : { sorte: key, ab: null });
        }));
        tbody.querySelectorAll(".sq-nr").forEach(btn => {
            btn.addEventListener("click", () => this.zeigeNummernWahl(this.resolvePlayerId(btn.dataset.nrId), () => this.renderSquad()));
        });
        // Ein Klick irgendwo in der Zeile öffnet die Spielerdetails
        tbody.querySelectorAll("tr.row-clickable").forEach(row => {
            row.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                const pId = this.resolvePlayerId(row.dataset.playerId);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            });
        });
        tbody.querySelectorAll(".btn-player-details").forEach(btn => {
            btn.addEventListener("click", () => {
                const pId = this.resolvePlayerId(btn.dataset.playerId);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            });
        });
    }
});
