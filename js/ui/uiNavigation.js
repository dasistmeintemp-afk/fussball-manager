/**
 * Bedienung wie im Vorbild.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 *   Unterreiter    - lange Reiter (Verein, Kader, Training, Jugend, Finanzen,
 *                    Statistik, Vorbereitung) zeigen ihre Karten in Unterreitern
 *                    statt untereinander. Welche Karte wohin gehört, steht im
 *                    HTML (data-ur), die Leiste baut sich daraus.
 *   Suche          - Spieler, Vereine und Bereiche, aus der Kopfleiste oder mit
 *                    "/" bzw. Strg+K.
 *   Verlauf        - Zurück-Knopf in der Kopfleiste, Alt+←, Maus- und
 *                    Systemtaste: der Browserverlauf trägt Reiter und Unterreiter.
 *   Tasten         - Leertaste spielt weiter.
 *   Kontextmenü    - Rechtsklick auf einen Spieler: Akte, Beobachtungsliste,
 *                    Scouten, Verhandeln, Vergleichen.
 *   Sortieren      - Tabellen mit class="sortierbar" sortieren per Spaltenkopf
 *                    und behalten die Sortierung beim Neuzeichnen.
 *   Beobachtungsliste - Ansicht im Transfermarkt (ScoutingEngine.beobachtungsliste).
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /** Einmal beim Start der Oberfläche */
    initNavigation() {
        if (typeof document === "undefined" || typeof document.addEventListener !== "function"
            || typeof document.querySelectorAll !== "function" || typeof document.createElement !== "function") return;
        this.initUnterreiter();
        this.initSuche();
        this.initVerlauf();
        this.initTasten();
        this.initKontextmenue();
        this.initSortierung();
    },

    /** Ist gerade ein Fenster (Modal, Suche, Menü) offen? */
    einFensterOffen() {
        const modal = [...document.querySelectorAll(".modal-overlay")]
            .some(m => m.style.display && m.style.display !== "none");
        return modal || !!document.querySelector(".suche-overlay:not([hidden]), .kontextmenue");
    },

    /**
     * Das oberste Fenster schließen - für den Zurück-Knopf am Handy. Laufendes
     * Spiel, Karriere-Assistent und Saisonabschluss bleiben offen (wie beim
     * Klick daneben). Liefert "zu" (geschlossen), "geschuetzt" oder null.
     */
    schliesseOberstesFenster() {
        if (this.schliesseKontextmenue()) return "zu";
        const suche = document.querySelector(".suche-overlay:not([hidden])");
        if (suche) { this.schliesseSuche(); return "zu"; }
        const offen = [...document.querySelectorAll(".modal-overlay")]
            .filter(m => m.style.display && m.style.display !== "none");
        if (!offen.length) return null;
        const oben = offen[offen.length - 1];
        if (["modalLiveMatch", "modalNewGame", "modalSeasonEnd"].includes(oben.id)) return "geschuetzt";
        oben.style.display = "none";
        return "zu";
    },

    // ------------------------------------------------------------ Unterreiter

    UNTERREITER_SPEICHER: "viererkette-unterreiter",

    initUnterreiter() {
        let gemerkt = {};
        try { gemerkt = JSON.parse(localStorage.getItem(this.UNTERREITER_SPEICHER) || "{}") || {}; } catch (e) { gemerkt = {}; }
        this._urWahl = gemerkt;
        document.querySelectorAll(".tab-pane").forEach(pane => {
            const teile = [...pane.querySelectorAll("[data-ur]")];
            if (!teile.length || pane.querySelector(":scope > .unterreiter")) return;
            const reihe = (pane.dataset.urReihe || "").split("|").filter(Boolean);
            const namen = [...new Set(reihe.concat(teile.map(e => e.dataset.ur)))].filter(n => teile.some(e => e.dataset.ur === n));
            const leiste = document.createElement("nav");
            leiste.className = "unterreiter";
            leiste.setAttribute("role", "tablist");
            leiste.innerHTML = namen.map(n =>
                `<button type="button" role="tab" class="ur-knopf" data-ur-ziel="${this.escapeHtml(n)}">${this.escapeHtml(n)}</button>`).join("");
            const kopf = pane.querySelector(":scope > .pane-header, :scope > .pane-title");
            if (kopf) kopf.after(leiste); else pane.prepend(leiste);
            leiste.addEventListener("click", (e) => {
                const k = e.target.closest(".ur-knopf");
                if (!k) return;
                this.zeigeUnterreiter(pane.id, k.dataset.urZiel, { nachOben: true });
                if (typeof this.playSound === "function") this.playSound("click");
            });
            this.zeigeUnterreiter(pane.id, namen.includes(gemerkt[pane.id]) ? gemerkt[pane.id] : namen[0], { still: true });
        });
    },

    /** Einen Unterreiter zeigen: nur seine Karten sind sichtbar */
    zeigeUnterreiter(paneId, name, optionen = {}) {
        const pane = typeof document !== "undefined" && document.getElementById ? document.getElementById(paneId) : null;
        if (!pane || typeof pane.querySelectorAll !== "function") return false;
        const knoepfe = [...pane.querySelectorAll(":scope > .unterreiter .ur-knopf")];
        if (!knoepfe.some(k => k.dataset.urZiel === name)) return false;
        const vorher = pane.dataset.urAktiv;
        pane.dataset.urAktiv = name;
        pane.querySelectorAll("[data-ur]").forEach(e => {
            const an = e.dataset.ur === name;
            e.classList.toggle("ur-aus", !an);
            // Aufklappkarten (Kaderplanung, Meldeliste) stehen im eigenen Unterreiter offen
            if (an && e.tagName === "DETAILS") e.open = true;
        });
        knoepfe.forEach(k => {
            const an = k.dataset.urZiel === name;
            k.classList.toggle("aktiv", an);
            k.setAttribute("aria-selected", an ? "true" : "false");
        });
        this._urWahl = Object.assign(this._urWahl || {}, { [paneId]: name });
        try { localStorage.setItem(this.UNTERREITER_SPEICHER, JSON.stringify(this._urWahl)); } catch (e) { /* ohne Speicher geht es auch */ }
        if (optionen.nachOben) {
            const leiste = pane.querySelector(":scope > .unterreiter");
            if (leiste && leiste.getBoundingClientRect().top < 0) leiste.scrollIntoView({ block: "start" });
        }
        if (!optionen.still && vorher !== name) this.merkeVerlauf();
        return true;
    },

    /** Steht ein Element in einem verdeckten Unterreiter, diesen zuerst zeigen */
    zeigeUnterreiterFuer(el) {
        const teil = el && typeof el.closest === "function" ? el.closest("[data-ur]") : null;
        const pane = teil ? teil.closest(".tab-pane") : null;
        if (teil && pane && teil.classList.contains("ur-aus")) this.zeigeUnterreiter(pane.id, teil.dataset.ur);
    },

    /**
     * Unterreiter, deren Karten alle leer oder versteckt sind, blenden aus
     * (etwa Auszeichnungen vor dem ersten Saisonende). Steht man gerade
     * darauf, geht es zum ersten mit Inhalt.
     */
    pruefeUnterreiter(paneId) {
        const pane = typeof document !== "undefined" && document.getElementById ? document.getElementById(paneId) : null;
        if (!pane || typeof pane.querySelector !== "function" || !pane.querySelector(":scope > .unterreiter")) return;
        const knoepfe = [...pane.querySelectorAll(":scope > .unterreiter .ur-knopf")];
        const teile = [...pane.querySelectorAll("[data-ur]")];
        const leer = (e) => e.hidden || e.style.display === "none" || (!e.children.length && !e.textContent.trim());
        let aktivWeg = false;
        knoepfe.forEach(k => {
            const ohne = teile.filter(e => e.dataset.ur === k.dataset.urZiel).every(leer);
            k.hidden = ohne;
            if (ohne && k.classList.contains("aktiv")) aktivWeg = true;
        });
        if (aktivWeg) {
            const erster = knoepfe.find(k => !k.hidden);
            if (erster) this.zeigeUnterreiter(paneId, erster.dataset.urZiel, { still: true });
        }
    },

    // ------------------------------------------------------------ Suche

    initSuche() {
        document.getElementById("btnKopfSuche")?.addEventListener("click", () => this.oeffneSuche());
    },

    oeffneSuche() {
        if (!this.app?.state) return;
        let overlay = document.getElementById("sucheOverlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "sucheOverlay";
            overlay.className = "suche-overlay";
            overlay.innerHTML = `
                <div class="suche-box" role="dialog" aria-label="Suchen">
                    <div class="suche-feld">
                        <svg class="ico" aria-hidden="true"><use href="#i-search"/></svg>
                        <input id="sucheEingabe" type="search" placeholder="Spieler, Verein oder Bereich" autocomplete="off" spellcheck="false" aria-controls="sucheErgebnisse">
                        <button type="button" class="suche-zu" aria-label="Schließen"><kbd>Esc</kbd></button>
                    </div>
                    <div class="suche-ergebnisse" id="sucheErgebnisse" role="listbox"></div>
                </div>`;
            document.body.appendChild(overlay);
            const eingabe = overlay.querySelector("#sucheEingabe");
            eingabe.addEventListener("input", () => this.zeigeSuchergebnisse(eingabe.value));
            eingabe.addEventListener("keydown", (e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    this.waehleSuchtreffer((this._sucheAuswahl || 0) + (e.key === "ArrowDown" ? 1 : -1));
                } else if (e.key === "Enter") {
                    e.preventDefault();
                    this.fuehreSuchtrefferAus(this._sucheAuswahl || 0);
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    this.schliesseSuche();
                }
            });
            overlay.addEventListener("click", (e) => {
                if (e.target === overlay || e.target.closest(".suche-zu")) return this.schliesseSuche();
                const treffer = e.target.closest("[data-treffer]");
                if (treffer) this.fuehreSuchtrefferAus(Number(treffer.dataset.treffer));
            });
        }
        overlay.hidden = false;
        this._sucheSicht = null;
        const eingabe = overlay.querySelector("#sucheEingabe");
        eingabe.value = "";
        this.zeigeSuchergebnisse("");
        setTimeout(() => eingabe.focus(), 0);
    },

    schliesseSuche() {
        const overlay = document.getElementById("sucheOverlay");
        if (overlay) overlay.hidden = true;
        this._sucheTreffer = [];
    },

    /** Für Suche und Vergleich: Kleinbuchstaben, ohne Akzente, ß wie ss */
    _suchform(text) {
        return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
    },

    /** Bereiche zum Springen: Reiter, Unterreiter und die Ansichten im Transfermarkt */
    suchBereiche() {
        const bereiche = [];
        document.querySelectorAll(".sidebar .nav-item[data-tab]").forEach(n => {
            const titel = (n.querySelector(".nav-text")?.textContent || n.textContent || "").trim();
            const tab = n.dataset.tab;
            if (!titel) return;
            bereiche.push({ titel, aktion: () => this.switchTab(tab) });
            const pane = document.getElementById(`pane-${tab}`);
            pane?.querySelectorAll(":scope > .unterreiter .ur-knopf").forEach(k => {
                if (k.hidden) return;
                bereiche.push({ titel: `${titel} › ${k.dataset.urZiel}`, aktion: () => { this.switchTab(tab); this.zeigeUnterreiter(pane.id, k.dataset.urZiel); } });
            });
            pane?.querySelectorAll(".view-switch-buttons button").forEach(b => {
                const name = b.textContent.trim();
                if (name && name !== titel) bereiche.push({ titel: `${titel} › ${name}`, aktion: () => { this.switchTab(tab); b.click(); } });
            });
        });
        return bereiche;
    },

    /** Treffer für einen Suchtext: { bereiche, vereine, spieler } */
    sucheNach(text) {
        const state = this.app?.state;
        const leer = { bereiche: [], vereine: [], spieler: [] };
        if (!state) return leer;
        const q = this._suchform(text).trim();
        if (q.length < 2) return leer;
        const woerter = q.split(/\s+/);
        const passt = (name) => { const n = this._suchform(name); return woerter.every(w => n.includes(w)); };
        const vorn = (name) => this._suchform(name).split(/[\s-]+/).some(w => w.startsWith(woerter[0])) ? 0 : 1;

        const bereiche = this.suchBereiche().filter(b => passt(b.titel)).slice(0, 4);
        const eigeneLiga = state.clubs.find(c => c.id === state.userClubId)?.leagueId;
        const vereine = (state.clubs || []).filter(c => passt(c.name) || passt(c.city))
            .sort((a, b) => vorn(a.name) - vorn(b.name) || (a.leagueId === eigeneLiga ? 0 : 1) - (b.leagueId === eigeneLiga ? 0 : 1)
                || (b.reputation || 0) - (a.reputation || 0))
            .slice(0, 5);

        // Spieler: nur, wen das eigene Scouting kennt - die Suche verrät nichts
        if (this._sucheSicht === null || this._sucheSicht === undefined) {
            const se = this.getScoutingEngine ? this.getScoutingEngine() : null;
            this._sucheSicht = se && typeof se.sichtbarkeit === "function" ? se.sichtbarkeit(state) : false;
        }
        const sicht = this._sucheSicht;
        const gefunden = [];
        for (const p of state.players || []) {
            if (!p || !p.name || !passt(p.name)) continue;
            if (sicht && p.clubId !== state.userClubId && !sicht.istSichtbar(p)) continue;
            gefunden.push(p);
            if (gefunden.length >= 300) break;
        }
        const spieler = gefunden.sort((a, b) => (a.clubId === state.userClubId ? 0 : 1) - (b.clubId === state.userClubId ? 0 : 1)
            || vorn(a.name) - vorn(b.name) || (b.overall || 0) - (a.overall || 0)).slice(0, 8);
        return { bereiche, vereine, spieler };
    },

    zeigeSuchergebnisse(text) {
        const box = document.getElementById("sucheErgebnisse");
        if (!box) return;
        const state = this.app?.state;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const { bereiche, vereine, spieler } = this.sucheNach(text);
        const treffer = [];
        const zeile = (inhalt, aktion) => { treffer.push(aktion); return `<button type="button" class="suche-treffer" role="option" data-treffer="${treffer.length - 1}">${inhalt}</button>`; };
        const vereinVon = new Map((state?.clubs || []).map(c => [c.id, c]));
        const ligaName = (c) => (state?.leagues || []).find(l => l.id === c.leagueId)?.name || "";
        let html = "";
        if (spieler.length) {
            html += `<div class="suche-gruppe">Spieler</div>` + spieler.map(p => {
                const v = vereinVon.get(p.clubId);
                const eigen = p.clubId === state.userClubId;
                return zeile(`<span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span>
                    <span class="suche-name">${esc(p.name)}${this.gemerktMarke(p.id)}</span>
                    <span class="suche-sub">${esc(v ? v.name : "vereinslos")} · ${esc(p.age)} J.${eigen ? " · eigener Spieler" : ""}</span>`,
                () => this.showPlayerDetailsModal(p.id));
            }).join("");
        }
        if (vereine.length) {
            html += `<div class="suche-gruppe">Vereine</div>` + vereine.map(c => zeile(
                `${typeof this.wappenHtml === "function" ? this.wappenHtml(c, "crest-sm") : ""}
                <span class="suche-name">${esc(c.name)}</span><span class="suche-sub">${esc(ligaName(c))}</span>`,
                () => this.showClubDetailsModal(c.id))).join("");
        }
        if (bereiche.length) {
            html += `<div class="suche-gruppe">Bereiche</div>` + bereiche.map(b => zeile(
                `<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg><span class="suche-name">${esc(b.titel)}</span>`, b.aktion)).join("");
        }
        if (!html) {
            html = String(text || "").trim().length < 2
                ? `<div class="suche-leer">Mindestens zwei Buchstaben, etwa einen Nachnamen, einen Verein oder „Finanzen“.<br><span>Pfeiltasten wählen, Enter öffnet.</span></div>`
                : `<div class="suche-leer">Nichts gefunden. Spieler, die Ihr Scouting noch nicht kennt, findet die Suche nicht.</div>`;
        }
        box.innerHTML = html;
        this._sucheTreffer = treffer;
        this.waehleSuchtreffer(0);
    },

    waehleSuchtreffer(i) {
        const liste = [...document.querySelectorAll("#sucheErgebnisse .suche-treffer")];
        if (!liste.length) { this._sucheAuswahl = 0; return; }
        const n = ((i % liste.length) + liste.length) % liste.length;
        this._sucheAuswahl = n;
        liste.forEach((el, k) => {
            el.classList.toggle("aktiv", k === n);
            el.setAttribute("aria-selected", k === n ? "true" : "false");
        });
        liste[n].scrollIntoView({ block: "nearest" });
    },

    fuehreSuchtrefferAus(i) {
        const aktion = (this._sucheTreffer || [])[i];
        if (typeof aktion !== "function") return;
        this.schliesseSuche();
        aktion();
    },

    // ------------------------------------------------------------ Verlauf

    initVerlauf() {
        document.getElementById("btnKopfZurueck")?.addEventListener("click", () => this.geheZurueck());
        if (typeof window === "undefined" || typeof history === "undefined" || typeof history.pushState !== "function") return;
        this._verlaufTiefe = 0;
        try { history.replaceState({ vkTab: this.activeTab || "dashboard" }, ""); } catch (e) { return; }
        window.addEventListener("popstate", (e) => {
            const ziel = e.state;
            if (!ziel || !ziel.vkTab || !this.app?.state) return;
            // Ein offenes Fenster schließt zuerst - am Handy mit der Zurück-Taste.
            // Der Eintrag kommt wieder dazu, damit der nächste Druck den Reiter wechselt.
            const fenster = this.schliesseOberstesFenster();
            if (fenster) {
                try { history.pushState(this._verlaufStand(), ""); } catch (er) { /* egal */ }
                return;
            }
            this._verlaufTiefe = Math.max(0, (this._verlaufTiefe || 0) - 1);
            this._ausVerlauf = true;
            try {
                if (ziel.vkTab !== this.activeTab) this.switchTab(ziel.vkTab);
                if (ziel.vkUr) this.zeigeUnterreiter(`pane-${ziel.vkTab}`, ziel.vkUr, { still: true });
                // Die Spielerseite: zurück zum vorigen Profil oder zum Reiter darunter
                if (ziel.vkAkte !== undefined && ziel.vkAkte !== null && this.findAnyPlayer?.(ziel.vkAkte)) this.showPlayerDetailsModal(ziel.vkAkte);
                else this.schliesseAkte?.();
            } finally {
                this._ausVerlauf = false;
            }
            this.aktualisiereZurueck();
        });
    },

    _verlaufStand() {
        const pane = typeof document !== "undefined" && document.getElementById ? document.getElementById(`pane-${this.activeTab}`) : null;
        const stand = { vkTab: this.activeTab, vkUr: (pane && pane.dataset && pane.dataset.urAktiv) || null };
        if (typeof this.akteOffen === "function" && this.akteOffen() && this._akteSeiteId !== undefined && this._akteSeiteId !== null) stand.vkAkte = this._akteSeiteId;
        return stand;
    },

    /** Nach jedem Wechsel von Reiter oder Unterreiter: ein Eintrag im Verlauf */
    merkeVerlauf() {
        if (this._ausVerlauf || !this.app?.state || typeof history === "undefined" || typeof history.pushState !== "function") return;
        const stand = this._verlaufStand();
        const jetzt = history.state || {};
        if (jetzt.vkTab === stand.vkTab && (jetzt.vkUr || null) === stand.vkUr && (jetzt.vkAkte ?? null) === (stand.vkAkte ?? null)) return;
        try {
            if (!jetzt.vkTab) history.replaceState(stand, "");
            else { history.pushState(stand, ""); this._verlaufTiefe = (this._verlaufTiefe || 0) + 1; }
        } catch (e) { /* ohne Verlauf geht es auch */ }
        this.aktualisiereZurueck();
    },

    geheZurueck() {
        if ((this._verlaufTiefe || 0) > 0 && typeof history !== "undefined") history.back();
    },

    aktualisiereZurueck() {
        const k = typeof document !== "undefined" && document.getElementById ? document.getElementById("btnKopfZurueck") : null;
        if (k) k.disabled = !((this._verlaufTiefe || 0) > 0);
    },

    // ------------------------------------------------------------ Tasten

    initTasten() {
        document.addEventListener("keydown", (e) => {
            if (e.defaultPrevented || !this.app?.state) return;
            const ziel = e.target;
            const tippt = !!ziel && (ziel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName || ""));
            if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.oeffneSuche();
                return;
            }
            if (tippt || e.ctrlKey || e.metaKey) return;
            if (e.key === "/" && !this.einFensterOffen()) {
                e.preventDefault();
                this.oeffneSuche();
                return;
            }
            if (e.altKey && e.key === "ArrowLeft") {
                e.preventDefault();
                this.geheZurueck();
                return;
            }
            // Escape verlässt die Spielerseite - wenn kein Fenster darüber liegt
            if (e.key === "Escape" && typeof this.akteOffen === "function" && this.akteOffen() && !this.einFensterOffen()) {
                e.preventDefault();
                this.akteZurueck();
                return;
            }
            if (e.altKey || e.shiftKey) return;
            // Leertaste spielt weiter - wie im Vorbild. Nicht, wenn ein Knopf
            // den Fokus hat (dort drückt die Leertaste ihn) oder ein Fenster offen ist.
            if (e.key === " " || e.code === "Space") {
                if (this.einFensterOffen() || (ziel && /^(BUTTON|A|SUMMARY|LABEL)$/.test(ziel.tagName || ""))) return;
                const knopf = document.getElementById("btnHeaderAdvance");
                if (!knopf || knopf.disabled || knopf.offsetParent === null) return;
                const start = document.getElementById("startScreenOverlay");
                if (start && start.style.display && start.style.display !== "none") return;
                e.preventDefault();
                this.handleWeiter();
            }
        });
    },

    // ------------------------------------------------------------ Kontextmenü

    initKontextmenue() {
        document.addEventListener("contextmenu", (e) => {
            if (!this.app?.state || !e.target || typeof e.target.closest !== "function") return;
            if (e.target.closest("#modalLiveMatch, input, textarea, select")) return;
            const el = e.target.closest("[data-player-id], [data-player]");
            if (!el) return;
            const roh = el.dataset.playerId ?? el.dataset.player;
            const id = typeof this.resolvePlayerId === "function" ? this.resolvePlayerId(roh) : roh;
            const p = (this.app.state.players || []).find(x => String(x.id) === String(id));
            if (!p) return;
            e.preventDefault();
            this.zeigeKontextmenue(p, e.clientX, e.clientY);
        });
        // Klick daneben, Scrollen oder Escape schließt
        document.addEventListener("pointerdown", (e) => {
            if (!e.target.closest || !e.target.closest(".kontextmenue")) this.schliesseKontextmenue();
        }, true);
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") this.schliesseKontextmenue(); });
        window.addEventListener("resize", () => this.schliesseKontextmenue());
        document.addEventListener("scroll", () => this.schliesseKontextmenue(), true);
    },

    schliesseKontextmenue() {
        const m = typeof document !== "undefined" && document.querySelector ? document.querySelector(".kontextmenue") : null;
        if (!m) return false;
        m.remove();
        return true;
    },

    /** Was das Menü für einen Spieler anbietet */
    kontextEintraege(p) {
        const state = this.app.state;
        const eigen = p.clubId === state.userClubId;
        const se = this.getScoutingEngine ? this.getScoutingEngine() : null;
        const laeuft = typeof this.beobachtungsText === "function" ? this.beobachtungsText(p.id) : null;
        const gemerkt = se && typeof se.istGemerkt === "function" && se.istGemerkt(state, p.id);
        return [
            { art: "akte", text: "Akte öffnen", icon: "i-doc" },
            !eigen && se && typeof se.merke === "function"
                ? { art: "liste", text: gemerkt ? "Von der Beobachtungsliste nehmen" : "Auf die Beobachtungsliste", icon: "i-star" } : null,
            !eigen && se && typeof se.beobachteSpieler === "function"
                ? { art: "scout", text: laeuft ? `Scout ist dran (${laeuft})` : "Scouten", icon: laeuft ? "i-eye" : "i-search", aus: !!laeuft } : null,
            !eigen && p.clubId ? { art: "angebot", text: "Verhandeln", icon: "i-briefcase" } : null,
            typeof this.zeigeVergleich === "function" ? { art: "vergleich", text: "Vergleichen", icon: "i-chart" } : null
        ].filter(Boolean);
    },

    zeigeKontextmenue(p, x, y) {
        this.schliesseKontextmenue();
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const verein = (state.clubs || []).find(c => c.id === p.clubId);
        const menue = document.createElement("div");
        menue.className = "kontextmenue";
        menue.setAttribute("role", "menu");
        menue.innerHTML = `<div class="km-kopf"><strong>${esc(p.name)}</strong><span>${esc(p.pos)} · ${esc(p.age)} J. · ${esc(verein ? verein.name : "vereinslos")}</span></div>`
            + this.kontextEintraege(p).map(e => `<button type="button" role="menuitem" class="km-eintrag" data-km="${e.art}"${e.aus ? " disabled" : ""}><svg class="ico" aria-hidden="true"><use href="#${e.icon}"/></svg>${esc(e.text)}</button>`).join("");
        document.body.appendChild(menue);
        const r = menue.getBoundingClientRect();
        const b = window.innerWidth, h = window.innerHeight;
        menue.style.left = `${Math.max(8, Math.min(x, b - r.width - 8))}px`;
        menue.style.top = `${Math.max(8, Math.min(y, h - r.height - 8))}px`;
        menue.addEventListener("click", (e) => {
            const k = e.target.closest("[data-km]");
            if (!k || k.disabled) return;
            this.schliesseKontextmenue();
            this.kontextAktion(k.dataset.km, p);
        });
        menue.querySelector("[data-km]")?.focus({ preventScroll: true });
    },

    kontextAktion(art, p) {
        if (art === "akte") this.showPlayerDetailsModal(p.id);
        else if (art === "liste") this.schalteBeobachtungsliste(p.id);
        else if (art === "scout") this.beobachte(p.id, "kontextmenue", () => this.renderCurrentTab());
        else if (art === "angebot") this.showTransferOfferModal(p.id);
        else if (art === "vergleich") this.zeigeVergleich(p.id);
    },

    // ------------------------------------------------------------ Beobachtungsliste

    /** Auf die Liste oder herunter; liefert true, wenn es geklappt hat */
    schalteBeobachtungsliste(playerId) {
        const state = this.app?.state;
        const se = this.getScoutingEngine ? this.getScoutingEngine() : null;
        if (!state || !se || typeof se.merke !== "function") return false;
        const res = se.merke(state, playerId);
        if (!res.success) {
            this.showToast(res.error || "Das geht nicht.", "warning");
            return false;
        }
        this.showToast(res.gemerkt
            ? `${res.player.name} steht auf der Beobachtungsliste.`
            : `${res.player.name} ist von der Beobachtungsliste genommen.`, "success");
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        if (["transfers", "squad"].includes(this.activeTab)) this.renderCurrentTab();
        return true;
    },

    /** Ein kleiner Stern hinter dem Namen, wenn der Spieler auf der Liste steht */
    gemerktMarke(playerId) {
        const se = this.getScoutingEngine ? this.getScoutingEngine() : null;
        return se && typeof se.istGemerkt === "function" && se.istGemerkt(this.app?.state, playerId)
            ? `<span class="gemerkt-marke" title="Auf der Beobachtungsliste" aria-label="Auf der Beobachtungsliste">★</span>` : "";
    },

    /** Knopf für die Akte: auf die Liste oder herunter */
    gemerktKnopfHtml(playerId, id) {
        const se = this.getScoutingEngine ? this.getScoutingEngine() : null;
        if (!se || typeof se.istGemerkt !== "function") return "";
        const drauf = se.istGemerkt(this.app?.state, playerId);
        return `<button class="btn btn-secondary btn-merken${drauf ? " aktiv" : ""}" id="${id}" type="button" style="width:100%; margin-top:10px;">
            <svg class="ico" aria-hidden="true"><use href="#i-star"/></svg> ${drauf ? "Auf der Beobachtungsliste · herunternehmen" : "Auf die Beobachtungsliste"}</button>`;
    },

    renderBeobachtungsliste() {
        const box = document.getElementById("beobachtungInhalt");
        const meta = document.getElementById("beobachtungMeta");
        const state = this.app?.state;
        const se = this.getScoutingEngine ? this.getScoutingEngine() : null;
        if (!box || !state || !se || typeof se.beobachtungsliste !== "function") return;
        const liste = se.beobachtungsliste(state);
        if (meta) meta.textContent = `${liste.length} / ${se.LISTE_MAX}`;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        if (!liste.length) {
            box.innerHTML = `<div class="empty-state-sm">Noch niemand auf der Liste. In der Akte eines fremden Spielers setzt ihn <em>Auf die Beobachtungsliste</em> darauf, ebenso ein Rechtsklick auf seinen Namen.</div>`;
            return;
        }
        const rating = this.getRatingEngine ? this.getRatingEngine() : null;
        box.innerHTML = `<table class="compact-table sortierbar bl-tabelle" id="beobachtungTabelle">
            <thead><tr>
                <th data-sort="text">Spieler</th><th data-sort="text">Verein</th><th data-sort="auf">Pos</th><th data-sort="auf">Alter</th>
                <th data-sort="zahl">Stärke</th><th data-sort="zahl">Marktwert</th><th data-sort="zahl">Vertrag</th><th data-sort="text">Stand</th><th></th>
            </tr></thead>
            <tbody>${liste.map(e => {
                const p = e.player;
                const card = rating ? rating.calculateVisiblePlayerCard(p, Object.assign({ userClubId: state.userClubId, leagueDataCoverage: 85 }, this.starContext())) : null;
                const stand = e.beobachtung ? `<span class="badge badge-info">Scout unterwegs · ${esc(e.beobachtung.tageRest)} T.</span>`
                    : (e.bericht ? `<span class="badge badge-success">Bericht liegt vor</span>` : `<span class="badge">ungescoutet</span>`);
                const hinweise = e.hinweise.map(h => `<span class="bl-hinweis ${h.art}">${esc(h.text)}</span>`).join("");
                return `<tr class="row-clickable" data-player-id="${esc(p.id)}">
                    <td data-wert="${esc(p.name)}"><strong>${esc(p.name)}</strong><span class="tm-sub">${esc(p.nationality || "")}</span>${hinweise ? `<div class="bl-hinweise">${hinweise}</div>` : ""}</td>
                    <td data-wert="${esc(e.verein ? e.verein.name : "")}">${esc(e.verein ? e.verein.name : "vereinslos")}</td>
                    <td data-wert="${["TW", "IV", "LV", "RV", "DM", "ZM", "LM", "RM", "OM", "LA", "RA", "ST"].indexOf(p.pos)}"><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span></td>
                    <td>${esc(p.age)}</td>
                    <td class="nowrap" data-wert="${card ? ((Number(card.starsCaMin) + Number(card.starsCaMax)) / 2 + (Number(card.starsPaMax) || 0) / 100).toFixed(3) : 0}">${card ? card.abilityStarsHtml : ""}</td>
                    <td class="nowrap">${esc(card ? card.visibleValueText : this.geldKurz(p.value))}</td>
                    <td class="nowrap" data-wert="${p.clubId ? (e.vertrag ?? 0) : 0}">${p.clubId ? `${esc(e.vertrag ?? "–")} J.` : "–"}</td>
                    <td>${stand}</td>
                    <td class="bl-aktion nowrap">
                        ${!e.beobachtung && !e.bericht ? `<button class="btn btn-sm btn-secondary" data-bl-scout="${esc(p.id)}" title="Scout zur Beobachtung schicken"><svg class="ico" aria-hidden="true"><use href="#i-search"/></svg></button>` : ""}
                        ${p.clubId ? `<button class="btn btn-sm btn-primary" data-bl-angebot="${esc(p.id)}">Verhandeln</button>` : ""}
                        <button class="btn btn-sm btn-secondary" data-bl-weg="${esc(p.id)}" title="Von der Liste nehmen" aria-label="Von der Liste nehmen"><svg class="ico" aria-hidden="true"><use href="#i-close"/></svg></button>
                    </td>
                </tr>`;
            }).join("")}</tbody></table>`;
        const pid = (roh) => this.resolvePlayerId(roh);
        box.querySelectorAll("tr.row-clickable").forEach(tr => tr.addEventListener("click", (ev) => {
            if (ev.target.closest("button")) return;
            this.showPlayerDetailsModal(pid(tr.dataset.playerId));
        }));
        box.querySelectorAll("[data-bl-scout]").forEach(b => b.addEventListener("click", () =>
            this.beobachte(pid(b.dataset.blScout), "beobachtungsliste", () => this.renderBeobachtungsliste())));
        box.querySelectorAll("[data-bl-angebot]").forEach(b => b.addEventListener("click", () => this.showTransferOfferModal(pid(b.dataset.blAngebot))));
        box.querySelectorAll("[data-bl-weg]").forEach(b => b.addEventListener("click", () => {
            if (this.schalteBeobachtungsliste(pid(b.dataset.blWeg))) this.renderBeobachtungsliste();
        }));
        // Die Tabelle ist neu: auch sie sortiert per Spaltenkopf
        const tabelle = document.getElementById("beobachtungTabelle");
        if (tabelle) { this.beobachteSortierung(tabelle); this.sortiereTabelle(tabelle); }
    },

    // ------------------------------------------------------------ Sortieren

    initSortierung() {
        this._sortierung = this._sortierung || {};
        document.addEventListener("click", (e) => {
            const th = e.target && typeof e.target.closest === "function" ? e.target.closest("table.sortierbar th[data-sort]") : null;
            if (!th) return;
            const tabelle = th.closest("table");
            const spalte = [...th.parentElement.children].indexOf(th);
            const alt = this._sortierung[tabelle.id] || {};
            // Zahlen zuerst absteigend, Texte und "auf" (Alter, Position) aufsteigend
            const ab = alt.spalte === spalte ? !alt.ab : th.dataset.sort === "zahl";
            this._sortierung[tabelle.id] = { spalte, ab, art: th.dataset.sort === "text" ? "text" : "zahl" };
            this.sortiereTabelle(tabelle);
        });
        document.querySelectorAll("table.sortierbar").forEach(t => this.beobachteSortierung(t));
    },

    /** Zeichnet der Code die Tabelle neu, sortiert sie wieder wie gewählt */
    beobachteSortierung(tabelle) {
        if (typeof MutationObserver !== "function" || !tabelle || !tabelle.tBodies || !tabelle.tBodies[0]) return;
        if (!this._sortBeobachter) {
            this._sortBeobachter = new MutationObserver((liste) => {
                const tabellen = new Set(liste.map(m => m.target.closest && m.target.closest("table.sortierbar")).filter(Boolean));
                tabellen.forEach(t => this.sortiereTabelle(t));
            });
        }
        this._sortBeobachter.observe(tabelle.tBodies[0], { childList: true });
    },

    /** "1,07 Mrd. €" -> 1070000000, "35,6–70,3 Mio. €" -> Mitte, "85%" -> 85 */
    zahlAus(text) {
        const t = String(text || "").replace(/\s+/g, " ").trim();
        const zahlen = [...t.matchAll(/[-+]?\d+(?:\.\d{3})*(?:,\d+)?/g)].map(m => parseFloat(m[0].replace(/\./g, "").replace(",", ".")));
        if (!zahlen.length) return NaN;
        let z = /\d\s*[–-]\s*\d/.test(t) && zahlen.length >= 2 ? (zahlen[0] + Math.abs(zahlen[1])) / 2 : zahlen[0];
        if (/Mrd/.test(t)) z *= 1e9;
        else if (/Mio/.test(t)) z *= 1e6;
        else if (/Tsd/.test(t)) z *= 1e3;
        return z;
    },

    sortiereTabelle(tabelle) {
        if (!tabelle || !tabelle.id) return;
        const s = (this._sortierung || {})[tabelle.id];
        const koepfe = [...tabelle.querySelectorAll("thead th")];
        koepfe.forEach((th, i) => {
            const an = !!s && i === s.spalte;
            th.classList.toggle("sortiert", an);
            th.classList.toggle("sortiert-ab", an && s.ab);
            if (th.dataset.sort) th.setAttribute("aria-sort", an ? (s.ab ? "descending" : "ascending") : "none");
        });
        if (!s) return;
        const tbody = tabelle.tBodies[0];
        if (!tbody) return;
        const alle = [...tbody.rows];
        // Zeilen über die ganze Breite (Hinweis, "Weitere 30") bleiben unten
        const zeilen = alle.filter(r => r.cells.length > s.spalte && !r.cells[0].hasAttribute("colspan"));
        const rest = alle.filter(r => !zeilen.includes(r));
        if (zeilen.length < 2) return;
        const wert = (r) => {
            const c = r.cells[s.spalte];
            const roh = c.dataset.wert !== undefined ? c.dataset.wert : c.textContent;
            return s.art === "text" ? String(roh).trim() : (c.dataset.wert !== undefined ? parseFloat(roh) : this.zahlAus(roh));
        };
        const faktor = s.ab ? -1 : 1;
        const sortiert = zeilen.map((r, i) => ({ r, w: wert(r), i })).sort((a, b) => {
            const aLeer = a.w === "" || (typeof a.w === "number" && Number.isNaN(a.w));
            const bLeer = b.w === "" || (typeof b.w === "number" && Number.isNaN(b.w));
            if (aLeer || bLeer) return aLeer === bLeer ? a.i - b.i : (aLeer ? 1 : -1);
            const v = s.art === "text" ? String(a.w).localeCompare(String(b.w), "de") : a.w - b.w;
            return v * faktor || a.i - b.i;
        });
        const reihenfolge = sortiert.map(x => x.r).concat(rest);
        if (reihenfolge.every((r, i) => r === alle[i])) return;
        reihenfolge.forEach(r => tbody.appendChild(r));
        // Die eigenen Umstellungen nicht noch einmal als Neuzeichnen werten
        if (this._sortBeobachter) this._sortBeobachter.takeRecords();
    }
});
