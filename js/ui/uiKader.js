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
     * kacheln: [{ titel, wert, extra (HTML), klasse }]
     */
    renderKennzahlen(elId, kacheln) {
        const el = document.getElementById(elId);
        if (!el) return;
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        el.innerHTML = kacheln.map(k =>
            `<div class="vk-kachel${k.klasse ? " " + k.klasse : ""}"><span>${esc(k.titel)}</span><strong>${esc(k.wert)}</strong>${k.extra || ""}</div>`).join("");
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
            <p class="text-muted kb-hinweis">Ist ein Wortführer unzufrieden, färbt das auf seine Gruppe ab, beim Kapitän auf alle. Wer einen Führungsspieler verkauft, hat ein paar Tage Unruhe.</p>`;
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
            <summary><h3>🗂️ Kaderplanung</h3><span class="header-tag">${hinweise.length ? `${hinweise.length} Baustelle${hinweise.length === 1 ? "" : "n"}` : "alles besetzt"}</span></summary>
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
                ? `Liste A: ${z.a} von ${z.platz} Plätzen · im Land ausgebildet ${z.lokal} (mindestens ${z.minLokal}) · Liste B: ${z.b}`
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
                        const b = art === "europa" && engine.fuerListeB(state, p, club);
                        const jung = art === "liga" && (p.age || 99) <= engine.U21;
                        const ohnePass = nichtEU && !engine.eu(state, p, club);
                        return `<li>
                            <label class="ml-wahl"><input type="checkbox" data-ml-a="${esc(p.id)}"${e.a.has(p.id) ? " checked" : ""}${darf ? "" : " disabled"}> <span class="ml-pos">${esc(p.pos)}</span> ${esc(p.name)} <small>${p.age} J. · ${p.overall}</small></label>
                            <span class="ml-marken">${lokal ? `<span class="ml-marke" title="im Land ausgebildet">🏠</span>` : ""}${jung ? `<span class="ml-marke">U21 frei</span>` : ""}${ohnePass ? `<span class="ml-marke" title="ohne EU-Pass">Nicht-EU</span>` : ""}${b ? `<label class="ml-b"><input type="checkbox" data-ml-b="${esc(p.id)}"${e.b.has(p.id) ? " checked" : ""}${darf ? "" : " disabled"}> B</label>` : ""}</span>
                        </li>`;
                    }).join("")}</ul>
                    ${darf ? `<div class="ml-knoepfe">
                        <button class="btn btn-sm btn-secondary" data-ml-vorschlag="${art}">Vorschlag übernehmen</button>
                        <button class="btn btn-sm btn-primary" data-ml-melden="${art}"${pruef.ok && geaendert ? "" : " disabled"}>Melden</button>
                    </div>` : ""}
                </section>`;
        });
        box.innerHTML = `
            <summary><h3>📋 Meldeliste</h3><span class="header-tag">${esc(kopf.join(" · "))}</span></summary>
            <p class="muted-note">Nur wer gemeldet ist, darf im Wettbewerb spielen. 🏠 = im Land ausgebildet (eigene Jugend oder Nationalität des Landes). Liste B: bis 21 und seit zwei Saisons im Verein oder aus der eigenen Jugend.${arten.includes("liga") && engine.regel(club, "liga")?.maxNichtEU != null ? " Nicht-EU: ohne Pass eines EU-Landes. Spieler aus den AKP-Staaten zählen wie EU-Bürger, Südamerikaner nach zwei Saisons im Verein auch." : ""}</p>
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

    renderSquad(posFilter = "all") {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;

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
                { titel: "Verträge", wert: String(auslaufend), extra: `<small>laufen bald aus</small>`, klasse: auslaufend >= 4 ? "warnung" : "" },
                { titel: "★★★ heißt", wert: this.constructor.STERN_MASSSTAEBE[this.sternMassstab()].kurz, extra: `<small>Maßstab in den Einstellungen</small>` }
            ]);
        }

        let players = state.players.filter(p => userClub.playerIds.includes(p.id));

        if (posFilter === "TW") players = players.filter(p => p.pos === "TW");
        else if (posFilter === "DEF") players = players.filter(p => ["IV", "LV", "RV"].includes(p.pos));
        else if (posFilter === "MID") players = players.filter(p => ["DM", "ZM", "OM", "LM", "RM"].includes(p.pos));
        else if (posFilter === "ATT") players = players.filter(p => ["ST", "LA", "RA"].includes(p.pos));

        // Nach Position und Stärke sortieren
        players.sort((a, b) => (b.trueCurrentAbility || b.overall * 2) - (a.trueCurrentAbility || a.overall * 2));

        const ratingEngine = (typeof PlayerRatingEngine !== 'undefined' && PlayerRatingEngine) 
            ? PlayerRatingEngine 
            : ((typeof window !== 'undefined' && window.PlayerRatingEngine) ? window.PlayerRatingEngine : null);

        const tbody = document.getElementById("squadTableBody");
        tbody.innerHTML = players.map(p => {
            const isLineup = userClub.lineup.includes(p.id);
            const isBench = userClub.bench.includes(p.id);
            let statusBadge = `<span class="badge-status-fit">Fit</span>`;
            if (p.injuredWeeks > 0) statusBadge = `<span class="badge-status-inj">🚑 ${p.injuredWeeks} Wo.</span>`;
            else if (p.suspendedMatches > 0) statusBadge = `<span class="badge-status-susp">🟥 ${p.suspendedMatches} Sp.</span>`;
            else if (isLineup) statusBadge = `<span class="badge-status-lineup">Startelf</span>`;
            else if (isBench) statusBadge = `<span class="badge-status-bench">Bank</span>`;

            const happyOverall = p.happiness?.overall || 75;
            const happyIcon = happyOverall >= 80 ? "😊" : happyOverall >= 60 ? "😐" : "😞";

            const card = ratingEngine ? ratingEngine.calculateVisiblePlayerCard(p, Object.assign({ userClubId: userClub.id, leagueDataCoverage: 95 }, this.starContext())) : null;
            // Eine Reihe für beides: gefüllt ist die heutige Stärke,
            // schraffiert das, was noch aus ihm werden kann
            const sterne = card ? card.abilityStarsHtml : "";
            const roleName = card?.bestRole?.role || p.squadRole || "Stammspieler";
            const abilityText = card?.abilityLabel || "Guter Spieler";
            // Den eigenen Spieler kennt man genau - also die kurze, exakte Zahl
            const valText = this.geldKurz(p.value);
            const fitness = Math.round(p.fitness ?? 100);

            // Nebenpositionen sichtbar machen: nicht jeder kann überall spielen
            const secondary = (Array.isArray(p.positions) ? p.positions : [])
                .filter(pos => pos && pos !== p.pos)
                .slice(0, 2);
            const secondaryHtml = secondary.length
                ? secondary.map(pos => `<span class="pos-tag pos-secondary" title="Nebenposition">${pos}</span>`).join("")
                : "";

            const form = (Number(p.form) || 0).toFixed(1).replace(".", ",");
            return `
                <tr class="row-clickable" data-player-id="${p.id}" title="Details zu ${this.escapeHtml(p.name)} öffnen">
                    <td class="sq-status">${statusBadge}</td>
                    <td class="sq-name"><strong>${this.escapeHtml(p.name)}</strong>${this.signaturMarke(p)}<span class="squad-role-hint">${p.reserve ? "U23" : (p.leihe ? "Leihspieler" : this.escapeHtml(p.squadRole || "Kader"))} · ${p.age} J.</span></td>
                    <td class="sq-pos nowrap">
                        <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span>${secondaryHtml}
                    </td>
                    <td class="sq-alter">${p.age}</td>
                    <td class="sq-staerke nowrap">
                        ${sterne}
                        <div class="squad-ability-hint">${abilityText}</div>
                    </td>
                    <td class="sq-rolle"><span class="role-chip" title="${roleName}">${roleName}</span></td>
                    <td class="sq-fit nowrap">
                        <span class="mini-bar"><span class="mini-bar-fill" style="width:${fitness}%;background:${this.fitnessFarbe(fitness)}"></span></span>${fitness}%
                    </td>
                    <td class="sq-moral nowrap" title="Moral">${happyIcon} ${happyOverall}%</td>
                    <td class="sq-form">${form}</td>
                    <td class="sq-wert nowrap">${valText}</td>
                    <td class="sq-gehalt nowrap">${this.geldKurz(p.wage)}</td>
                    <td class="sq-vertrag nowrap">${p.vorvertrag ? `<span title="Geht zum Saisonwechsel zu ${this.escapeHtml(p.vorvertrag.clubName)}">✍️</span> ` : ""}${p.contractYears} J.</td>
                    <td class="sq-meta">Form ${form} · ${valText} · ${this.geldKurz(p.wage)}/Wo · ${p.vorvertrag ? `geht zu ${this.escapeHtml(p.vorvertrag.clubName)}` : `${p.contractYears} J. Vertrag`}</td>
                    <td class="sq-aktion">
                        <button class="btn btn-sm btn-secondary btn-player-details" data-player-id="${p.id}" aria-label="Details zu ${this.escapeHtml(p.name)}">›</button>
                    </td>
                </tr>
            `;
        }).join("");

        // Ein Klick irgendwo in der Zeile öffnet die Spielerdetails
        tbody.querySelectorAll("tr.row-clickable").forEach(row => {
            row.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                const pId = this.resolvePlayerId(row.dataset.playerId);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            });
        });

        document.querySelectorAll(".btn-player-details").forEach(btn => {
            btn.addEventListener("click", () => {
                const pId = this.resolvePlayerId(btn.dataset.playerId);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            });
        });
    },
});
