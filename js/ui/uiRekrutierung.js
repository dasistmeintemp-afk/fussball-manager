/**
 * Die Rekrutierung wie im Vorbild: eine Übersicht aus Kacheln und die
 * Ansichten Empfehlungen, Transferaktivität, Verträge und Transferbörse.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 * Die Kacheln der Übersicht, jede ein Sprung in ihre Ansicht:
 *   Spielerdatenbank   Reichweite, gescoutete Spieler, die besten Noten, Aufträge
 *   Transferaktivität  Fenster, Zugänge, Vorschläge des Sportdirektors, Abgänge,
 *                      Ausgaben und Einnahmen der Saison
 *   Budgets            Transfer, Gehalt, Scouting
 *   Verträge           Laufzeiten in vier Stufen, wer in zwölf Monaten geht
 *   Kaderplaner        Baustellen je Mannschaftsteil, die Elf mit Nummern
 *   Personal           der Stab: besetzt, offen
 *   Vorgaben           was Vorstand und Fans auf dem Transfermarkt erwarten
 *   Klauseln           Ausstiegsklauseln bei uns und solche, die wir ziehen könnten
 *   Beobachtungsliste  wer drauf steht
 *   Transferbörse      Abgabe: Gesuche anderer Vereine, zu denen wir einen
 *                      Spieler hätten; Suche: unsere Gesuche und die Antworten
 *
 * Gerechnet wird in der RekrutierungEngine, das Wechselinteresse in der
 * TransferEngine.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    getRekrutierungEngine() {
        if (typeof RekrutierungEngine !== "undefined" && RekrutierungEngine) return RekrutierungEngine;
        if (typeof window !== "undefined" && window.RekrutierungEngine) return window.RekrutierungEngine;
        if (typeof require !== "undefined") {
            try { return require("../engine/rekrutierungEngine.js").RekrutierungEngine; } catch (e) { return null; }
        }
        return null;
    },

    _rkTe() {
        return (typeof TransferEngine !== "undefined" && TransferEngine) ? TransferEngine : (typeof window !== "undefined" ? window.TransferEngine : null);
    },

    /** Kachel-Bausteine wie in der Spielerdatenbank und den Finanzen */
    _rkBausteine() {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        return {
            esc,
            geld: (b) => this.geldKurz(b || 0),
            kachel: (titel, icon, ziel, inhalt, fuss = "", klasse = "") => `
                <div class="dash-card tm-kachel rk-kachel ${klasse}">
                    <h4 class="gs-titel"><button type="button" class="rk-titel" data-rk-ziel="${ziel}"><svg class="ico h-ico" aria-hidden="true"><use href="#i-${icon}"/></svg>${esc(titel)}</button></h4>
                    ${inhalt}
                    ${fuss ? `<div class="tm-kachel-fuss">${fuss}</div>` : ""}
                </div>`,
            knopf: (ziel, text) => `<button type="button" class="btn btn-sm btn-secondary" data-rk-ziel="${ziel}">${esc(text)}</button>`,
            zeile: (links, rechts, klasse = "") => `<div class="pf-zeile ${klasse}"><span>${links}</span><strong>${rechts}</strong></div>`,
            leer: (text) => `<p class="tm-leer">${esc(text)}</p>`,
            spieler: (p, unten, rechts = "") => `
                <button type="button" class="tm-eintrag" data-rk-spieler="${esc(p.id)}">
                    <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span>
                    <span class="tm-eintrag-name"><strong>${esc(p.name)}</strong><span class="tm-sub">${unten}</span></span>
                    ${rechts ? `<span class="tm-eintrag-wert">${rechts}</span>` : ""}
                </button>`
        };
    },

    /** Klicks in einer Ansicht: Spieler öffnen die Akte, Ziele die Ansicht */
    _rkVerdrahte(box) {
        if (!box) return;
        box.querySelectorAll("[data-rk-spieler]").forEach(el => el.addEventListener("click", (e) => {
            e.stopPropagation();
            const pId = this.resolvePlayerId(el.dataset.rkSpieler);
            if (pId !== null) this.showPlayerDetailsModal(pId);
        }));
        box.querySelectorAll("[data-rk-ziel]").forEach(el => el.addEventListener("click", () => this.rkGehe(el.dataset.rkZiel)));
    },

    /** Zu einer Ansicht der Rekrutierung - oder zu Kader, Finanzen, Verein */
    rkGehe(ziel) {
        const knopf = {
            datenbank: "btnSubTransfersMarket", empfehlungen: "btnSubTransfersEmpfehlungen", scouting: "btnSubTransfersScouting",
            liste: "btnSubTransfersListe", aktivitaet: "btnSubTransfersAktivitaet", vertraege: "btnSubTransfersVertraege",
            boerse: "btnSubTransfersBoerse", sd: "btnSubTransfersSD", leihen: "btnSubTransfersLoans"
        }[ziel];
        if (knopf) {
            this.switchTab("transfers");
            document.getElementById(knopf)?.click();
            document.getElementById("pane-transfers")?.scrollIntoView?.({ block: "start" });
            this.aktualisiereKopfmenue?.();
            return;
        }
        if (ziel === "planer") return this.zeigeKaderplaner();
        if (ziel === "finanzen") return this.switchTab("finances");
        if (ziel === "personal") {
            const vorbereitung = document.querySelector('.nav-item[data-tab="preseason"]');
            if (vorbereitung && vorbereitung.style.display !== "none") return this.switchTab("preseason");
            return this.switchTab("club");
        }
        if (ziel === "vorstand") return this.switchTab("club");
    },

    /** Der Kaderplaner liegt im Kader unter "Planung" */
    zeigeKaderplaner() {
        this.switchTab("squad");
        if (typeof this.zeigeUnterreiter === "function") this.zeigeUnterreiter("pane-squad", "Planung", { nachOben: true });
        const el = document.getElementById("squadPlanung");
        if (el && "open" in el) el.open = true;
    },

    /** Wie viele Tage das Fenster noch offen ist - oder null */
    _rkFensterTage(te, state, f) {
        const h = typeof te.heute === "function" ? te.heute(state) : null;
        if (!f.offen || !f.bis || !h) return null;
        const jetzt = new Date(h.jahr, h.monat - 1, h.tag);
        let ende = new Date(h.jahr, f.bis[0] - 1, f.bis[1]);
        if (ende < jetzt) ende = new Date(h.jahr + 1, f.bis[0] - 1, f.bis[1]);
        return Math.round((ende - jetzt) / 86400000);
    },

    // ------------------------------------------------------------ Übersicht

    /**
     * Die Übersicht. k: aus renderTransfers - empfehlungen ([{p, e, wert}]),
     * gescoutet, sichtbarerMarkt, verhandelt, vereinVon, angebote,
     * ausserReichweite, unbekannt.
     */
    renderRekrutierungUebersicht(state, club, k = {}) {
        const box = document.getElementById("rkUebersicht");
        if (!box || !state || !club) return;
        const B = this._rkBausteine();
        const { esc, geld, kachel, knopf, zeile, leer } = B;
        const te = this._rkTe();
        const rk = this.getRekrutierungEngine();
        const se = this.getScoutingEngine();
        const kacheln = [];

        // 1. Spielerdatenbank
        const reich = te && typeof te.describeReach === "function" ? te.describeReach(club, state.leagues || []) : { level: 1 };
        const empf = (k.empfehlungen || []).filter(x => x.e && x.e.sicher).slice(0, 2);
        const auftraege = (state.scouting?.assignments || []).filter(a => a.status === "active");
        const alleEmpf = (k.gescoutet || []).length;
        kacheln.push(kachel("Spielerdatenbank", "users", "datenbank", `
            <div class="rk-zwei">
                <div><div class="tm-gross">${reich.level <= 1 ? "Weltweit" : `Ab Stufe ${reich.level}`}</div><p class="tm-text">Scouting-Reichweite</p></div>
                <div><div class="tm-gross">${(k.gescoutet || []).length.toLocaleString("de-DE")}</div><p class="tm-text">gescoutete Spieler</p></div>
            </div>
            <button type="button" class="rk-unterkopf" data-rk-ziel="empfehlungen"><svg class="ico" aria-hidden="true"><use href="#i-star"/></svg>Empfehlungen (${alleEmpf})</button>
            ${empf.length ? `<div class="tm-liste">${empf.map(({ p, e }) => B.spieler(p, esc(k.vereinVon?.get(p.clubId)?.name || "vereinslos"), this.noteHtml(e))).join("")}</div>`
                : leer("Noch keine belastbare Note. Schicken Sie Scouts los.")}
            <button type="button" class="rk-unterkopf" data-rk-ziel="scouting"><svg class="ico" aria-hidden="true"><use href="#i-search"/></svg>Scouting-Aufträge (${auftraege.length})</button>
            <p class="tm-hinweis">${(state.scouting?.reports || []).length.toLocaleString("de-DE")} Berichte liegen vor${k.unbekannt ? ` · ${k.unbekannt.toLocaleString("de-DE")} Spieler im Ausland noch unbekannt` : ""}</p>`));

        // 2. Transferaktivität
        if (te && typeof te.fensterInfo === "function") {
            const f = te.fensterInfo(state);
            const tage = this._rkFensterTage(te, state, f);
            const w = rk ? rk.wechsel(state) : { zu: [], ab: [], ausgaben: 0, einnahmen: 0 };
            const sdE = typeof this.getSportdirektorEngine === "function" ? this.getSportdirektorEngine() : null;
            const vorschlaege = sdE && state.sportdirektor?.genannt ? Object.keys(state.sportdirektor.genannt).length : 0;
            kacheln.push(kachel("Transferaktivität", "transfer", "aktivitaet", `
                <div class="rk-fenster ${f.offen ? "offen" : "zu"}"><svg class="ico" aria-hidden="true"><use href="#i-${f.offen ? "check" : "close"}"/></svg><span>${f.offen ? "Offen" : "Geschlossen"}</span></div>
                <p class="tm-text">${f.offen ? (tage === 0 ? "Deadline Day - heute schließt das Fenster" : tage !== null ? `noch ${tage} Tag${tage === 1 ? "" : "e"}` : "") : `Es öffnet ${esc(f.oeffnet || "")}`}</p>
                <div class="rk-tabelle-kopf"><span>Aktivität</span><span>Spieler</span></div>
                ${zeile(`<span class="rk-pfeil rein"></span>Zugänge`, w.zu.length)}
                ${zeile(`<span class="rk-pfeil sd"></span>Vorschläge des Sportdirektors`, vorschlaege)}
                ${zeile(`<span class="rk-pfeil raus"></span>Abgänge`, w.ab.length)}
                ${zeile("Angebote für unsere Spieler", (k.angebote || 0).toLocaleString("de-DE"))}
                ${zeile("Laufende Verhandlungen", (k.verhandelt?.size || 0).toLocaleString("de-DE"))}
                <div class="rk-bilanz"><span><strong>${geld(w.ausgaben)}</strong> ausgegeben</span><span><strong>${geld(w.einnahmen)}</strong> eingenommen</span></div>`));
        }

        // 3. Budgets
        const fe = (typeof FinanceEngine !== "undefined" && FinanceEngine) ? FinanceEngine : (typeof window !== "undefined" ? window.FinanceEngine : null);
        const gehalt = fe && typeof fe.gehaltNachRolle === "function" ? fe.gehaltNachRolle(state, club) : { summe: 0, budget: club.wageBudget || 0 };
        const w = rk ? rk.wechsel(state) : { ausgaben: 0 };
        const saison = state.seasonYear || 1;
        const scoutAusgaben = (state.finances?.transactions || []).filter(t => t.season === saison && t.type === "scouting").reduce((s, t) => s - (t.amount || 0), 0);
        const regional = se && typeof se.regionKosten === "function" ? se.regionKosten(state) : 0;
        kacheln.push(kachel("Budgets", "wallet", "finanzen", `
            <div class="rk-budget"><span class="rk-budget-kopf"><svg class="ico" aria-hidden="true"><use href="#i-transfer"/></svg>Transfer</span><strong>${geld(Math.max(0, club.transferBudget || 0))}</strong><span class="tm-sub">verfügbar · ${geld(w.ausgaben)} ausgegeben</span></div>
            <div class="rk-budget"><span class="rk-budget-kopf"><svg class="ico" aria-hidden="true"><use href="#i-users"/></svg>Gehalt</span><strong class="${gehalt.budget >= gehalt.summe ? "" : "pf-ton-schlecht"}">${geld(Math.max(0, gehalt.budget - gehalt.summe))} / Wo.</strong><span class="tm-sub">${gehalt.budget >= gehalt.summe ? "frei" : "über dem Budget"} · ${geld(gehalt.summe)} je Woche</span></div>
            <div class="rk-budget"><span class="rk-budget-kopf"><svg class="ico" aria-hidden="true"><use href="#i-search"/></svg>Scouting</span><strong>${geld(scoutAusgaben)}</strong><span class="tm-sub">diese Saison${regional ? ` · Regionalscouts ${geld(regional)} im Monat` : ""}</span></div>`));

        // 4. Verträge
        const v = rk ? rk.vertraege(state) : null;
        if (v) {
            const ring = (zahl, text, ton) => `<span class="rk-ring ${ton}"><b>${zahl}</b><small>${text}</small></span>`;
            kacheln.push(kachel("Verträge", "doc", "vertraege", `
                <div class="tm-gross">${v.anzahl} <small>Spieler unter Vertrag</small></div>
                <p class="tm-text">Restlaufzeit</p>
                <div class="rk-ringe">${ring(v.stufen.m6, "0–6 M", "schlecht")}${ring(v.stufen.m12, "6–12 M", "warn")}${ring(v.stufen.j2, "1–2 J", "mittel")}${ring(v.stufen.mehr, "2+ J", "gut")}</div>
                <p class="rk-unterkopf-text"><svg class="ico" aria-hidden="true"><use href="#i-clock"/></svg>Vertrag endet in 12 Monaten (${v.auslaufend.length})</p>
                ${v.auslaufend.length ? `<div class="rk-vertragsraster">${v.auslaufend.slice(0, 9).map(z => `
                    <button type="button" class="rk-vertrag" data-rk-spieler="${esc(z.p.id)}"><strong>${esc(z.p.name)}</strong><span>bis ${esc(this.vertragsEnde ? (this.vertragsEnde(z.p) || "") : "")}</span></button>`).join("")}</div>`
                    : leer("Kein Vertrag läuft in den nächsten zwölf Monaten aus.")}`, "", "rk-breit"));
        }

        // 5. Kaderplaner: Baustellen und die Elf mit Nummern
        const kp = (typeof KaderplanungEngine !== "undefined" && KaderplanungEngine) ? KaderplanungEngine : (typeof window !== "undefined" ? window.KaderplanungEngine : null);
        const hinweise = kp && typeof kp.hinweise === "function" ? kp.hinweise(state, 3) : [];
        kacheln.push(kachel("Kaderplaner", "tactics", "planer", `
            <div class="rk-planer">
                ${this._rkMiniFeld(state, club)}
                <div class="rk-planer-text">
                    <strong>${hinweise.length ? `${hinweise.length} Baustelle${hinweise.length === 1 ? "" : "n"}` : "Keine Probleme auf den Positionen"}</strong>
                    ${hinweise.length ? hinweise.map(h => `<p class="tm-text">${esc(h.text)}</p>`).join("") : `<p class="tm-text">Jeder Mannschaftsteil ist nach dem Kaderplan Ihrer Liga besetzt, auch nächste Saison.</p>`}
                </div>
            </div>`, "", "rk-breit"));

        // 6. Personal
        const pe = (typeof PreseasonEngine !== "undefined" && PreseasonEngine) ? PreseasonEngine : (typeof window !== "undefined" ? window.PreseasonEngine : null);
        const bereiche = pe?.BEREICHE || [];
        const besetzt = bereiche.filter(b => club.staff?.[b.key]);
        const offen = bereiche.filter(b => !club.staff?.[b.key]);
        kacheln.push(kachel("Personal", "briefcase", "personal", `
            <div class="tm-gross">${besetzt.length} <small>von ${bereiche.length} Posten besetzt</small></div>
            ${offen.length ? `<p class="tm-text">Offen: ${esc(offen.map(b => b.titel).join(", "))}</p>` : `<p class="tm-text">Der Stab ist komplett.</p>`}
            ${besetzt.slice(0, 4).map(b => zeile(esc(b.titel), esc(club.staff[b.key]?.name || "besetzt"))).join("")}`));

        // 7. Vorgaben: Vorstand (Vision), Finanzregeln, Fans
        const ve = (typeof VisionEngine !== "undefined" && VisionEngine) ? VisionEngine : (typeof window !== "undefined" ? window.VisionEngine : null);
        const vision = ve && typeof ve.uebersicht === "function" ? ve.uebersicht(state) : null;
        const ziele = (vision?.jahresziele || []).filter(z => z.bereich === "Kader" || z.bereich === "Finanzen");
        const ist = (z) => z.geld ? geld(z.ist) : `${Math.round(z.ist ?? 0)}${z.einheit.startsWith("%") ? " %" : ""}`;
        kacheln.push(kachel("Vorgaben", "flag", "vorstand", `
            <p class="rk-unterkopf-text"><svg class="ico" aria-hidden="true"><use href="#i-briefcase"/></svg>Vorstand (${ziele.length})</p>
            ${ziele.length ? ziele.map(z => `<div class="rk-vorgabe ${z.steht ? "gut" : "offen"}"><span>${esc(z.text)}</span><strong>${ist(z)}</strong></div>`).join("")
                : leer("Der Vorstand macht für den Transfermarkt keine Vorgaben.")}
            <p class="tm-hinweis">Junge Zugänge, Gehaltsrahmen und Schulden misst der Vorstand am Saisonende.</p>`));

        // 8. Klauseln
        const kl = rk ? rk.klauseln(state, k.sichtbarerMarkt || null) : null;
        if (kl) {
            kacheln.push(kachel("Klauseln", "doc", "datenbank", `
                <div class="rk-chips"><span>Alle (${kl.alle})</span><span>Bei uns (${kl.bei})</span><span>Bei anderen (${kl.fremd})</span></div>
                ${zeile(`Ausstiegsklauseln bei uns`, `${kl.unsere.length} · ${geld(kl.unsereSumme)}`)}
                ${zeile(`Weitere Vertragsklauseln bei uns`, kl.vertragsklauseln)}
                ${zeile(`Mit dem Budget zu ziehen`, `${kl.ziehbar.length} · ${geld(kl.ziehbarSumme)}`)}
                ${kl.ziehbar.length ? `<div class="tm-liste">${kl.ziehbar.slice(0, 2).map(x => B.spieler(x.p, esc(k.vereinVon?.get(x.p.clubId)?.name || ""), geld(x.betrag))).join("")}</div>` : ""}`));
        }

        // 9. Beobachtungsliste
        const liste = se && typeof se.beobachtungsliste === "function" ? se.beobachtungsliste(state) : [];
        kacheln.push(kachel("Beobachtungsliste", "star", "liste", `
            <div class="tm-gross">${liste.length} <small>/ ${se?.LISTE_MAX || 60}</small></div>
            ${liste.length ? `<div class="tm-liste">${liste.slice(0, 3).map(x => B.spieler(x.player, esc(x.hinweise[0]?.text || (x.verein ? x.verein.name : "vereinslos")))).join("")}</div>`
                : leer("Noch niemand auf der Liste. Ein Rechtsklick auf einen Namen setzt ihn darauf.")}`));

        // 10./11. Transferbörse: Abgabe und Suche
        if (rk) {
            const gel = rk.gelegenheiten(state);
            const angeboten = rk.angeboten(state);
            kacheln.push(kachel("Transferbörse · Abgabe", "transfer", "boerse", `
                <div class="tm-gross">${gel.length} <small>Gelegenheiten</small></div>
                <p class="tm-text">Vereine, die genau so einen Spieler suchen, wie wir ihn abgeben könnten.</p>
                ${zeile("Spieler angeboten", angeboten.length)}
                ${zeile("Daraus Angebote", angeboten.filter(a => a.ergebnis === "angebot").length)}`));
            const gesuche = rk.gesuche(state).filter(g => !rk._abgelaufen(state, g));
            const antworten = gesuche.reduce((s, g) => s + rk.antworten(state, g).antworten.length, 0);
            kacheln.push(kachel("Transferbörse · Suche", "search", "boerse", `
                <div class="tm-gross">${gesuche.length} <small>Gesuche</small></div>
                <p class="tm-text">${gesuche.length ? gesuche.map(g => esc(rk.gesuchText(g))).slice(0, 2).join("<br>") : "Schreiben Sie aus, wen Sie suchen - die Vereine melden sich."}</p>
                ${zeile("Antworten", antworten)}`));
        }

        box.innerHTML = kacheln.join("");
        this._rkVerdrahte(box);
    },

    /** Die Elf als kleines Feld mit Rückennummern, aufgestellt nach der Formation */
    _rkMiniFeld(state, club) {
        const F = (typeof FORMATION_CONFIGS !== "undefined" && FORMATION_CONFIGS) || (typeof window !== "undefined" ? window.FORMATION_CONFIGS : null);
        const conf = F && F[club.formation];
        const idx = new Map((state.players || []).map(p => [p.id, p]));
        const elf = (club.lineup || []).map(id => idx.get(id)).filter(Boolean);
        if (!conf || !elf.length) return `<div class="rk-feld leer"></div>`;
        const punkte = conf.positions.slice(0, 11).map((pos, i) => {
            const p = elf[i];
            if (!p) return "";
            return `<span class="rk-feld-nr" style="left:${pos.x}%;top:${pos.y}%" title="${this.escapeHtml(p.name)}">${p.trikot || i + 1}</span>`;
        }).join("");
        return `<div class="rk-feld" aria-hidden="true"><i class="rk-feld-mitte"></i><i class="rk-feld-strafraum"></i>${punkte}</div>`;
    },

    // ------------------------------------------------------------ Empfehlungen

    /** Alle gescouteten Spieler nach der Note, mit Interesse */
    renderEmpfehlungen(state, club, k = {}) {
        const tbody = document.getElementById("empfTableBody");
        if (!tbody || !k.note) return;
        const wert = (id) => document.getElementById(id)?.value || "";
        const noteMin = wert("empfNoteFilter"), teil = wert("empfPosFilter"), int = wert("empfInteresseFilter");
        const rang = { A: 3, B: 2, C: 1 };
        let liste = (k.gescoutet || []).map(p => ({ p, e: k.note(p), i: k.interesse ? k.interesse(p) : null })).filter(x => x.e);
        if (noteMin) liste = liste.filter(x => (rang[x.e.note.charAt(0)] || 0) >= rang[noteMin]);
        if (teil) liste = liste.filter(x => this.positionsGruppe(x.p.pos) === teil);
        if (int === "moeglich") liste = liste.filter(x => !x.i || x.i.stufe !== "ausgeschlossen");
        if (int === "offen") liste = liste.filter(x => !x.i || x.i.stufe === "offen" || x.i.stufe === "interessiert");
        liste.sort((a, b) => b.e.punkte - a.e.punkte || (k.staerke ? k.staerke(b.p) - k.staerke(a.p) : 0));
        const meta = document.getElementById("empfMeta");
        if (meta) meta.textContent = `${liste.length} Spieler`;
        tbody.innerHTML = liste.length
            ? liste.slice(0, 60).map(x => this.tmZeileHtml(x.p, state, k)).join("")
            : `<tr><td colspan="15" class="text-center text-muted" style="padding:22px;">Noch keine Empfehlung zu diesen Filtern. Ihr Scout empfiehlt Spieler, sobald er sie beobachtet hat - schicken Sie ihn unter Scouting los.</td></tr>`;
        tbody.querySelectorAll("tr.row-clickable").forEach(row => row.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            const pId = this.resolvePlayerId(row.dataset.playerId);
            if (pId !== null) this.showPlayerDetailsModal(pId);
        }));
        tbody.querySelectorAll(".btn-bid-player").forEach(btn => btn.addEventListener("click", () => this.showTransferOfferModal(this.resolvePlayerId(btn.dataset.playerId))));
        tbody.querySelectorAll(".btn-scout-direct").forEach(btn => btn.addEventListener("click", () => this.beobachte(this.resolvePlayerId(btn.dataset.playerId), "empfehlungen", () => this.renderTransfers())));
        if (!this._empfVerdrahtet) {
            this._empfVerdrahtet = true;
            ["empfNoteFilter", "empfPosFilter", "empfInteresseFilter"].forEach(id => document.getElementById(id)?.addEventListener("change", () => this.renderTransfers()));
        }
    },

    // ------------------------------------------------------------ Transferaktivität

    renderAktivitaet(state, club, k = {}) {
        const kopf = document.getElementById("akKopf");
        const box = document.getElementById("akWechsel");
        const rk = this.getRekrutierungEngine();
        const te = this._rkTe();
        if (!kopf || !box || !rk) return;
        const { esc, geld } = this._rkBausteine();
        const w = rk.wechsel(state);
        if (te && typeof te.fensterInfo === "function") {
            const f = te.fensterInfo(state);
            const tage = this._rkFensterTage(te, state, f);
            kopf.innerHTML = `
                <div class="rk-kopf-feld"><span>Transferfenster</span><strong class="${f.offen ? "pf-ton-gut" : ""}">${f.offen ? "Offen" : "Geschlossen"}</strong><small>${f.offen ? (tage !== null ? `noch ${tage} Tag${tage === 1 ? "" : "e"}` : "") : esc(f.oeffnet ? `öffnet ${f.oeffnet}` : "")}</small></div>
                <div class="rk-kopf-feld"><span>Zugänge</span><strong>${w.zu.length}</strong><small>${geld(w.ausgaben)} ausgegeben</small></div>
                <div class="rk-kopf-feld"><span>Abgänge</span><strong>${w.ab.length}</strong><small>${geld(w.einnahmen)} eingenommen</small></div>
                <div class="rk-kopf-feld"><span>Bilanz</span><strong class="${w.einnahmen - w.ausgaben >= 0 ? "pf-ton-gut" : "pf-ton-schlecht"}">${w.einnahmen - w.ausgaben >= 0 ? "+" : "−"}${geld(Math.abs(w.einnahmen - w.ausgaben))}</strong><small>Saison ${esc(w.saison)}</small></div>`;
        }
        const meta = document.getElementById("akMeta");
        if (meta) meta.textContent = `${w.zu.length} Zugänge · ${w.ab.length} Abgänge`;
        const reihe = (x) => `
            <tr class="row-clickable" data-rk-spieler="${esc(x.pId)}">
                <td><span class="rk-pfeil ${x.art === "zu" ? "rein" : "raus"}"></span>${esc(x.name)}</td>
                <td><span class="pos-tag pos-${this.getPosGroup(x.pos)}">${esc(x.pos)}</span></td>
                <td>${esc(x.alter)}</td>
                <td>${x.art === "zu" ? "von" : "zu"} ${esc(x.verein)}</td>
                <td class="nowrap">${x.leihe ? "Leihe" : (x.fee ? geld(x.fee) : "ablösefrei")}</td>
                <td class="text-muted nowrap">${esc(x.datum)}</td>
            </tr>`;
        const liste = w.zu.concat(w.ab).sort((a, b) => b.tag - a.tag);
        box.innerHTML = liste.length
            ? `<div class="table-container"><table class="data-table compact-table"><thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Verein</th><th>Ablöse</th><th>Datum</th></tr></thead><tbody>${liste.map(reihe).join("")}</tbody></table></div>`
            : `<p class="empty-state-sm">In dieser Saison hat der Verein noch niemanden geholt oder abgegeben.</p>`;
        this._rkVerdrahte(box);
    },

    // ------------------------------------------------------------ Verträge

    RAT_TEXT: { anbieten: "Vertrag anbieten", vertagen: "Entscheidung vertagen", nicht: "Nicht verlängern" },

    renderVertraege() {
        const state = this.app.state;
        const rk = this.getRekrutierungEngine();
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        const kopf = document.getElementById("vtKopf");
        const box = document.getElementById("vtTabelle");
        if (!rk || !club || !kopf || !box) return;
        const { esc, geld } = this._rkBausteine();
        const v = rk.vertraege(state);
        const kl = rk.klauseln(state, []);
        const fe = (typeof FinanceEngine !== "undefined" && FinanceEngine) ? FinanceEngine : (typeof window !== "undefined" ? window.FinanceEngine : null);
        const gehalt = fe && typeof fe.gehaltNachRolle === "function" ? fe.gehaltNachRolle(state, club) : { summe: 0, budget: club.wageBudget || 0 };
        const ring = (zahl, text, ton) => `<span class="rk-ring ${ton}"><b>${zahl}</b><small>${text}</small></span>`;
        kopf.innerHTML = `
            <div class="dash-card rk-kopf-karte"><h4 class="gs-titel">Verträge</h4><div class="tm-gross">${v.anzahl} <small>Spieler</small></div>
                <div class="rk-ringe">${ring(v.stufen.m6, "0–6 M", "schlecht")}${ring(v.stufen.m12, "6–12 M", "warn")}${ring(v.stufen.j2, "1–2 J", "mittel")}${ring(v.stufen.mehr, "2+ J", "gut")}</div></div>
            <div class="dash-card rk-kopf-karte"><h4 class="gs-titel">Budgets</h4>
                <div class="pf-zeile"><span>Transfer verfügbar</span><strong>${geld(Math.max(0, club.transferBudget || 0))}</strong></div>
                <div class="pf-zeile"><span>Gehalt frei je Woche</span><strong>${geld(Math.max(0, gehalt.budget - gehalt.summe))}</strong></div>
                <div class="pf-zeile"><span>Gehälter je Woche</span><strong>${geld(gehalt.summe)}</strong></div></div>
            <div class="dash-card rk-kopf-karte"><h4 class="gs-titel">Rat</h4>
                <div class="pf-zeile"><span>Vertrag anbieten</span><strong class="pf-ton-gut">${v.rat.anbieten}</strong></div>
                <div class="pf-zeile"><span>Entscheidung vertagen</span><strong>${v.rat.vertagen}</strong></div>
                <div class="pf-zeile"><span>Nicht verlängern</span><strong class="pf-ton-schlecht">${v.rat.nicht}</strong></div>
                ${kl ? `<div class="pf-zeile"><span>Ausstiegsklauseln bei uns</span><strong>${kl.unsere.length}</strong></div>` : ""}</div>`;
        const filter = document.getElementById("vtFilter")?.value || "";
        let liste = v.liste;
        if (filter === "12") liste = liste.filter(z => z.monate <= 12);
        else if (filter) liste = liste.filter(z => z.rat === filter);
        const meta = document.getElementById("vtMeta");
        if (meta) meta.textContent = `${liste.length} von ${v.anzahl}`;
        const ton = { anbieten: "pf-ton-gut", vertagen: "", nicht: "pf-ton-schlecht" };
        box.innerHTML = `<table class="data-table compact-table vt-tabelle">
            <thead><tr><th>Spieler</th><th>Gehalt</th><th title="Anteil am Gehaltsbudget">% Budget</th><th>Marktwert</th><th>Rolle</th><th>Vertrag bis</th><th>Rat</th><th>Grund</th></tr></thead>
            <tbody>${liste.map(z => `
                <tr class="row-clickable" data-rk-spieler="${esc(z.p.id)}">
                    <td><strong>${esc(z.p.name)}</strong><span class="tm-sub">${esc(z.p.age)} J. · ${esc(z.p.pos)}</span></td>
                    <td class="nowrap">${geld(z.p.wage || 0)}/Wo.</td>
                    <td>${(z.anteil * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %</td>
                    <td class="nowrap">${geld(z.p.value || 0)}</td>
                    <td>${esc(z.p.squadRole || "")}</td>
                    <td class="nowrap ${z.monate <= 6 ? "pf-ton-schlecht" : z.monate <= 12 ? "rk-warn" : ""}">${esc(this.vertragsEnde ? (this.vertragsEnde(z.p) || "–") : "")}</td>
                    <td class="nowrap ${ton[z.rat]}">${this.RAT_TEXT[z.rat]}</td>
                    <td class="text-muted">${esc(z.grund)}</td>
                </tr>`).join("")}</tbody></table>`;
        box.querySelectorAll("tr[data-rk-spieler]").forEach(tr => tr.addEventListener("click", () => {
            const pId = this.resolvePlayerId(tr.dataset.rkSpieler);
            if (pId !== null) this.showPlayerDetailsModal(pId, { abschnitt: "vertrag" });
        }));
        const wahl = document.getElementById("vtFilter");
        if (wahl && !wahl.dataset.verdrahtet) { wahl.dataset.verdrahtet = "1"; wahl.addEventListener("change", () => this.renderVertraege()); }
    },

    // ------------------------------------------------------------ Transferbörse

    renderTransferboerse() {
        const state = this.app.state;
        const rk = this.getRekrutierungEngine();
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!rk || !club) return;
        const { esc, geld } = this._rkBausteine();
        const te = this._rkTe();

        // Das Formular: Positionen als Feld, Spielzeit, Art, Alter
        const form = document.getElementById("tbForm");
        if (form && !form.dataset.bereit) {
            form.dataset.bereit = "1";
            const reihen = [["ST"], ["LA", "OM", "RA"], ["LM", "ZM", "RM"], ["DM"], ["LV", "IV", "RV"], ["TW"]];
            const alter = (id, wert) => `<select id="${id}" class="styled-select">${Array.from({ length: 24 }, (_, i) => 16 + i).map(a => `<option value="${a}"${a === wert ? " selected" : ""}>${a}</option>`).join("")}</select>`;
            form.innerHTML = `
                <div class="tb-feld" role="group" aria-label="Positionen">${reihen.map(r => `<div class="tb-feld-reihe">${r.map(p => `<button type="button" class="tb-pos" data-tb-pos="${p}" aria-pressed="false">${p}</button>`).join("")}</div>`).join("")}</div>
                <div class="tb-angaben">
                    <label>Spielzeit<select id="tbSpielzeit" class="styled-select">${Object.entries(rk.SPIELZEIT).map(([k, s]) => `<option value="${k}"${k === "stamm" ? " selected" : ""}>${esc(s.titel)}</option>`).join("")}</select></label>
                    <label>Art<select id="tbArt" class="styled-select">${Object.entries(rk.ART).map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select></label>
                    <label>Alter<span class="tb-alter">${alter("tbAlterVon", 18)}<span>bis</span>${alter("tbAlterBis", 29)}</span></label>
                    <button type="button" class="btn btn-primary" id="btnTbAusschreiben">Gesuch ausschreiben</button>
                </div>`;
            form.querySelectorAll("[data-tb-pos]").forEach(b => b.addEventListener("click", () => {
                const an = b.getAttribute("aria-pressed") !== "true";
                b.setAttribute("aria-pressed", an ? "true" : "false");
                b.classList.toggle("aktiv", an);
            }));
            document.getElementById("btnTbAusschreiben")?.addEventListener("click", () => {
                const positionen = [...form.querySelectorAll('[data-tb-pos][aria-pressed="true"]')].map(b => b.dataset.tbPos);
                const res = rk.gesuchAnlegen(this.app.state, {
                    positionen,
                    spielzeit: document.getElementById("tbSpielzeit")?.value,
                    art: document.getElementById("tbArt")?.value,
                    alterVon: document.getElementById("tbAlterVon")?.value,
                    alterBis: document.getElementById("tbAlterBis")?.value
                });
                if (!res.success) { this.showToast(res.error, "warning"); return; }
                form.querySelectorAll("[data-tb-pos]").forEach(b => { b.setAttribute("aria-pressed", "false"); b.classList.remove("aktiv"); });
                this.showToast("Das Gesuch ist raus. Die ersten Vereine melden sich morgen.", "success");
                this.renderTransferboerse();
            });
            ["tbFremdeArt", "tbNurPassend"].forEach(id => document.getElementById(id)?.addEventListener("change", () => this.renderTransferboerse()));
        }

        // Unsere Gesuche und die Antworten
        const gesuche = rk.gesuche(state).filter(g => !rk._abgelaufen(state, g));
        const meta = document.getElementById("tbGesucheMeta");
        if (meta) meta.textContent = `${gesuche.length} / ${rk.GESUCHE_MAX}`;
        const k = te && typeof te.interesseKontext === "function" ? te.interesseKontext(state) : null;
        const box = document.getElementById("tbGesuche");
        if (box) {
            box.innerHTML = gesuche.length ? gesuche.map(g => {
                const a = rk.antworten(state, g);
                const rest = g.bisTag - (state.currentDayIndex || 0);
                return `<div class="tb-gesuch">
                    <div class="tb-gesuch-kopf"><strong>${esc(rk.gesuchText(g))}</strong><span class="tm-sub">noch ${rest} Tag${rest === 1 ? "" : "e"} · ${a.antworten.length} Antwort${a.antworten.length === 1 ? "" : "en"}${a.ausstehend ? ` · ${a.ausstehend} Vereine prüfen noch` : ""}</span>
                        <button type="button" class="btn btn-sm btn-secondary" data-tb-weg="${esc(g.id)}">Beenden</button></div>
                    ${a.antworten.length ? `<div class="tm-liste">${a.antworten.map(x => `
                        <div class="tb-antwort${x.empfohlen ? " empfohlen" : ""}">
                            <button type="button" class="tm-eintrag" data-rk-spieler="${esc(x.p.id)}">
                                <span class="pos-tag pos-${this.getPosGroup(x.p.pos)}">${esc(x.p.pos)}</span>
                                <span class="tm-eintrag-name"><strong>${esc(x.p.name)}${x.empfohlen ? ` <span class="tb-sd" title="Empfehlung des Sportdirektors">★ Sportdirektor</span>` : ""}</strong><span class="tm-sub">${esc(x.p.age)} J. · ${esc(x.verein?.name || "")} · ${x.art === "leihe" ? "zur Leihe" : "zum Verkauf"}</span></span>
                                <span class="tm-eintrag-wert">${this.interesseHtml(x.interesse, true)}</span>
                            </button>
                            <button type="button" class="btn btn-sm btn-primary" data-tb-bieten="${esc(x.p.id)}" data-tb-art="${x.art}">${x.art === "leihe" ? "Leihen" : "Verhandeln"}</button>
                        </div>`).join("")}</div>` : `<p class="tm-leer">${a.ausstehend ? "Die ersten Vereine prüfen ihre Kader noch." : "Kein Verein hat einen passenden Spieler gemeldet. Weiter fassen hilft: mehr Positionen, ein größeres Alter, Kauf oder Leihe."}</p>`}
                </div>`;
            }).join("") : `<p class="tm-leer">Noch kein Gesuch. Wählen Sie oben Positionen und schreiben Sie aus.</p>`;
            box.querySelectorAll("[data-tb-weg]").forEach(b => b.addEventListener("click", () => { rk.gesuchLoeschen(this.app.state, b.dataset.tbWeg); this.renderTransferboerse(); }));
            box.querySelectorAll("[data-tb-bieten]").forEach(b => b.addEventListener("click", () => {
                const pId = this.resolvePlayerId(b.dataset.tbBieten);
                if (b.dataset.tbArt === "leihe" && typeof this.leiheAnfragen === "function") this.leiheAnfragen(pId);
                else this.showTransferOfferModal(pId);
            }));
            this._rkVerdrahte(box);
        }

        // Gesuche anderer Vereine
        const art = document.getElementById("tbFremdeArt")?.value || "";
        const nurPassend = !!document.getElementById("tbNurPassend")?.checked;
        let fremde = rk.fremdeGesuche(state).map(g => ({ g, passend: rk.passendeEigene(state, g) }));
        if (art) fremde = fremde.filter(x => x.g.art === art || x.g.art === "beides");
        if (nurPassend) fremde = fremde.filter(x => x.passend.length);
        const fMeta = document.getElementById("tbFremdeMeta");
        if (fMeta) fMeta.textContent = `${fremde.length} Gesuche`;
        const fBox = document.getElementById("tbFremde");
        const schon = new Set(rk.angeboten(state).map(a => `${a.pId}|${a.clubId}`));
        if (fBox) {
            fBox.innerHTML = fremde.length ? fremde.slice(0, 40).map(({ g, passend }) => `
                <div class="tb-fremd">
                    <div class="tb-gesuch-kopf">${this.wappenHtml((state.clubs || []).find(c => c.id === g.clubId), "crest-sm")}<strong>${esc(g.verein)}</strong>
                        <span class="tm-sub">Liga ${g.stufe} · ${esc(g.titel)} · ${esc(rk.SPIELZEIT[g.spielzeit].titel)} · ${esc(rk.ART[g.art])} · ${g.alterVon}–${g.alterBis} J.${g.art !== "leihe" ? ` · Budget ${geld(g.budget)}` : ""}</span></div>
                    ${passend.length ? `<div class="tb-passend">${passend.slice(0, 4).map(p => {
                        const angeboten = schon.has(`${p.id}|${g.clubId}`);
                        return `<span class="tb-eigener"><button type="button" class="tb-name" data-rk-spieler="${esc(p.id)}">${esc(p.name)} <small>${esc(p.pos)}, ${esc(p.age)}</small></button>
                            <button type="button" class="btn btn-sm ${angeboten ? "btn-secondary" : "btn-primary"}" data-tb-anbieten="${esc(p.id)}" data-tb-gesuch="${esc(g.id)}"${angeboten ? " disabled" : ""}>${angeboten ? "Angeboten" : "Anbieten"}</button></span>`;
                    }).join("")}</div>` : `<p class="tm-leer">Kein passender Spieler im Kader.</p>`}
                </div>`).join("")
                : `<p class="tm-leer">${nurPassend ? "Kein Gesuch passt gerade zu Ihrem Kader. Ohne den Schalter sehen Sie alle." : "Gerade sucht kein Verein in Ihrer Reichweite."}</p>`;
            fBox.querySelectorAll("[data-tb-anbieten]").forEach(b => b.addEventListener("click", () => {
                const res = rk.anbieten(this.app.state, b.dataset.tbAnbieten, b.dataset.tbGesuch);
                if (!res.success) { this.showToast(res.error, "warning"); return; }
                this.showToast(res.text, res.angebot ? "success" : "info", 6000);
                this.renderHeader?.();
                this.renderTransfers();
                this.renderTransferboerse();
            }));
            this._rkVerdrahte(fBox);
        }

        // Angebotene Spieler
        const angeboten = rk.angeboten(state);
        const aMeta = document.getElementById("tbAngebotenMeta");
        if (aMeta) aMeta.textContent = `${angeboten.length} diese Saison`;
        const aBox = document.getElementById("tbAngeboten");
        if (aBox) {
            aBox.innerHTML = angeboten.length ? `<div class="table-container"><table class="data-table compact-table"><thead><tr><th>Spieler</th><th>Verein</th><th>Art</th><th>Antwort</th></tr></thead><tbody>${angeboten.map(a => `
                <tr class="row-clickable" data-rk-spieler="${esc(a.pId)}"><td>${esc(a.name)} <small class="text-muted">${esc(a.pos)}</small></td><td>${esc(a.verein)}</td><td>${a.art === "leihe" ? "Leihe" : "Kauf"}</td>
                    <td class="${a.ergebnis === "angebot" ? "pf-ton-gut" : "text-muted"}">${a.ergebnis === "angebot" ? esc(a.text) + (a.fee ? ` · ${geld(a.fee)}` : "") : `Abgesagt: ${esc(a.text)}`}</td></tr>`).join("")}</tbody></table></div>`
                : `<p class="tm-leer">Noch niemanden angeboten.</p>`;
            this._rkVerdrahte(aBox);
        }
    }
});
