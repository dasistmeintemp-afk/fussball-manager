/**
 * Spielstände: Speicherplätze, Sicherungen, Laden, Löschen und Import.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper).
 *
 * Bis zu fünf Karrieren liegen nebeneinander. Der Startbildschirm zeigt die
 * zuletzt gespielte groß und die übrigen darunter; in den Einstellungen
 * lassen sich Plätze laden, löschen und mit einer Kopie belegen, und die
 * Sicherungen der laufenden Karriere zurückholen.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    _speicherIco(name) {
        return `<svg class="ico" aria-hidden="true"><use href="#${name}"/></svg>`;
    },

    _speicherDatum(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "unbekannt";
        return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    },

    /** "Saison 2, Spieltag 14" - die Kurzform eines Stands */
    _speicherStand(z) {
        return `Saison ${z.seasonYear}, Spieltag ${z.currentMatchday}`;
    },

    /**
     * Rendert die Spielstände auf dem Startbildschirm: die zuletzt gespielte
     * Karriere groß, die übrigen darunter
     */
    renderStartScreenSaveInfo() {
        const detailsContainer = document.getElementById("startSaveDetailsContent");
        const continueBtn = document.getElementById("btnStartContinueGame");
        const continueSubText = document.getElementById("startContinueSubText");
        const ico = (name) => this._speicherIco(name);

        // Die Welt in Zahlen - aus den Ligadaten, nicht aus einem Werbetext
        const fakten = document.getElementById("startWorldFacts");
        const ligen = (typeof LEAGUES_DATA !== "undefined" && Array.isArray(LEAGUES_DATA)) ? LEAGUES_DATA : [];
        if (fakten && ligen.length) {
            const vereine = ligen.reduce((summe, l) => summe + (l.teamCount || 0), 0);
            const laender = new Set(ligen.map(l => l.countryId)).size;
            fakten.textContent = `Übernimm einen von ${vereine} Vereinen aus ${ligen.length} Ligen in ${laender} Ländern – von der Champions League bis zur Landesliga. Kader, Taktik, Transfers und jedes Spiel live in 2D.`;
        }
        if (!detailsContainer || !continueBtn) return;

        const juengster = GameState.juengsterPlatz();
        const summary = juengster ? GameState.getSaveSummary(juengster) : null;

        if (summary) {
            continueBtn.disabled = false;
            if (continueSubText) continueSubText.textContent = `${summary.clubName} · ${this._speicherStand(summary)}`;

            const diffName = summary.difficulty === "easy" ? "Leicht" : summary.difficulty === "hard" ? "Schwer" : "Normal";
            const fortschritt = Math.max(0, Math.min(100, Math.round(((summary.currentMatchday - 1) / Math.max(1, summary.totalMatchdays)) * 100)));
            const club = { name: summary.clubName, primaryColor: summary.primaryColor, secondaryColor: summary.secondaryColor };
            const weitere = GameState.speicherplaetze().filter(p => p.zusammenfassung && p.schluessel !== juengster);

            detailsContainer.innerHTML = `
                <div class="save-card-summary">
                    <div class="save-card-kicker">Letzter Spielstand · Speicherplatz ${GameState.platzNummer(juengster)}</div>
                    <div class="save-club-badge">
                        ${this.wappenHtml(club, "crest-lg")}
                        <div class="save-club-text">
                            <div class="save-club-name">${this.escapeHtml(summary.clubName)}</div>
                            <div class="save-club-sub">${this.escapeHtml(summary.leagueName)} · ${this.escapeHtml(summary.managerName)}</div>
                        </div>
                    </div>

                    <div class="save-meta-grid">
                        <div class="save-meta-item">
                            <span class="save-meta-label">Platz</span>
                            <span class="save-meta-val">${summary.userRank}.</span>
                        </div>
                        <div class="save-meta-item">
                            <span class="save-meta-label">Saison</span>
                            <span class="save-meta-val">${summary.seasonYear}</span>
                        </div>
                        <div class="save-meta-item">
                            <span class="save-meta-label">Spieltag</span>
                            <span class="save-meta-val">${summary.currentMatchday}<small>/${summary.totalMatchdays}</small></span>
                        </div>
                        <div class="save-meta-item">
                            <span class="save-meta-label">Stufe</span>
                            <span class="save-meta-val save-meta-text">${diffName}</span>
                        </div>
                    </div>

                    <div class="save-progress" title="Saisonfortschritt">
                        <span style="width:${fortschritt}%"></span>
                    </div>

                    <div class="save-timestamp">Gespeichert am ${this._speicherDatum(summary.lastSaved)}</div>

                    <div class="save-actions">
                        <button class="btn btn-primary" id="btnQuickLoadGame" type="button">${ico("i-play")}<span>Fortsetzen</span></button>
                        <button class="btn btn-secondary btn-icon-only" id="btnDeleteLocalSave" type="button" title="Spielstand löschen" aria-label="Spielstand löschen">${ico("i-trash")}</button>
                    </div>

                    ${weitere.length ? `
                    <div class="save-weitere">
                        <div class="save-card-kicker">Weitere Karrieren</div>
                        ${weitere.map(p => this._platzZeileHtml(p, "start")).join("")}
                    </div>` : ""}
                </div>
            `;

            document.getElementById("btnQuickLoadGame")?.addEventListener("click", () => this.ladeSpielstand(juengster));
            document.getElementById("btnDeleteLocalSave")?.addEventListener("click", () => {
                if (this.loescheSpielstand(juengster)) this.renderStartScreenSaveInfo();
            });
            this._verdrahtePlatzZeilen(detailsContainer, () => this.renderStartScreenSaveInfo());
        } else {
            continueBtn.disabled = true;
            if (continueSubText) continueSubText.textContent = "Kein lokaler Spielstand gefunden";
            detailsContainer.innerHTML = `
                <div class="no-save-placeholder">
                    <span class="placeholder-icon">${ico("i-trophy")}</span>
                    <p>Noch kein Spielstand auf diesem Gerät.</p>
                    <span class="placeholder-hint">Starte eine neue Karriere – gespeichert wird automatisch im Browser, bis zu ${GameState.PLATZ_ANZAHL} Karrieren nebeneinander.</span>
                </div>
            `;
        }
    },

    /**
     * Eine Zeile je Platz. `ort` "start": nur belegte Plätze mit Fortsetzen
     * und Löschen; "einstellungen": alle Plätze, freie mit "Kopie hier".
     */
    _platzZeileHtml(p, ort) {
        const z = p.zusammenfassung;
        const ico = (name) => this._speicherIco(name);
        if (!z) {
            return `
                <div class="platz-zeile platz-frei">
                    <span class="platz-nr">${p.nr}</span>
                    <div class="platz-text"><strong>Frei</strong><span>Speicherplatz ${p.nr}</span></div>
                    <div class="platz-knoepfe">
                        <button class="btn btn-secondary btn-sm" type="button" data-platz-kopie="${p.schluessel}" title="Den laufenden Stand zusätzlich hier ablegen">${ico("i-save")}<span>Kopie hier</span></button>
                    </div>
                </div>`;
        }
        const club = { name: z.clubName, primaryColor: z.primaryColor, secondaryColor: z.secondaryColor };
        const knoepfe = p.aktiv && ort === "einstellungen"
            ? `<span class="platz-aktiv">Läuft gerade</span>`
            : `<button class="btn btn-secondary btn-sm" type="button" data-platz-laden="${p.schluessel}">${ico("i-play")}<span>${ort === "start" ? "Fortsetzen" : "Laden"}</span></button>
               <button class="btn btn-secondary btn-sm btn-icon-only" type="button" data-platz-loeschen="${p.schluessel}" title="Spielstand löschen" aria-label="Spielstand auf Speicherplatz ${p.nr} löschen">${ico("i-trash")}</button>`;
        return `
            <div class="platz-zeile${p.aktiv && ort === "einstellungen" ? " platz-laeuft" : ""}">
                ${this.wappenHtml(club, "crest-sm")}
                <div class="platz-text">
                    <strong>${this.escapeHtml(z.clubName)}</strong>
                    <span>${ort === "einstellungen" ? `Speicherplatz ${p.nr} · ` : ""}${this._speicherStand(z)} · ${this._speicherDatum(z.lastSaved)}</span>
                </div>
                <div class="platz-knoepfe">${knoepfe}</div>
            </div>`;
    },

    _verdrahtePlatzZeilen(wurzel, nachher) {
        wurzel.querySelectorAll("[data-platz-laden]").forEach(b => b.addEventListener("click", () => this.ladeSpielstand(b.dataset.platzLaden)));
        wurzel.querySelectorAll("[data-platz-loeschen]").forEach(b => b.addEventListener("click", () => {
            if (this.loescheSpielstand(b.dataset.platzLoeschen)) nachher();
        }));
        wurzel.querySelectorAll("[data-platz-kopie]").forEach(b => b.addEventListener("click", () => this.legeKopieAn(b.dataset.platzKopie)));
    },

    /** Einen Platz laden und dort weiterspielen */
    ladeSpielstand(platz) {
        const alt = this.app.state;
        if (alt && typeof alt.flushSave === "function") alt.flushSave();
        return GameState.ladePlatz(platz).then(state => {
            if (!state) {
                this.showToast("Dieser Spielstand ließ sich nicht laden.", "error");
                return false;
            }
            this.app.state = state;
            this.hideStartScreen();
            this.switchTab("dashboard");
            this.renderCurrentTab();
            const club = state.clubs.find(c => c.id === state.userClubId)?.name || "";
            this.showToast(`Spielstand geladen: ${state.managerName} bei ${club}`, "success");
            return true;
        });
    },

    /** Mit Rückfrage löschen. Gibt zurück, ob gelöscht wurde. */
    loescheSpielstand(platz) {
        const z = GameState.getSaveSummary(platz);
        const was = z ? `${z.clubName} (${this._speicherStand(z)})` : `Speicherplatz ${GameState.platzNummer(platz)}`;
        if (!confirm(`Spielstand ${was} mit allen Sicherungen unwiderruflich löschen?`)) return false;
        // Das laufende Spiel dieses Platzes darf ihn nicht beim Verlassen der Seite wieder anlegen
        if (platz === GameState.aktiverPlatz() && this.app.state) {
            if (typeof this.app.state.verwirfAusstehendes === "function") this.app.state.verwirfAusstehendes();
            this.app.state = null;
        }
        GameState.deleteSavegame(platz);
        this.showToast("Spielstand wurde gelöscht.", "info");
        return true;
    },

    /**
     * Wohin kommt eine neue oder importierte Karriere? Auf den ersten freien
     * Platz - sind alle belegt, nach Rückfrage auf den am längsten nicht
     * gespielten. null heißt: abgebrochen.
     */
    waehleZielPlatz(was) {
        const frei = GameState.freierPlatz();
        if (frei) return frei;
        const alt = GameState.aeltesterPlatz();
        const z = GameState.getSaveSummary(alt);
        const text = `Alle ${GameState.PLATZ_ANZAHL} Speicherplätze sind belegt. ${was} ersetzt den am längsten nicht gespielten Spielstand auf Speicherplatz ${GameState.platzNummer(alt)}`
            + (z ? `: ${z.clubName}, ${this._speicherStand(z)}.` : ".")
            + "\n\nFortfahren?";
        return (typeof confirm !== "function" || confirm(text)) ? alt : null;
    },

    /** Vor dem Start einer Karriere: das laufende Spiel sichern, dann den Platz wechseln */
    beziehePlatz(platz) {
        const alt = this.app.state;
        if (alt && typeof alt.flushSave === "function") alt.flushSave();
        GameState.setzeAktivenPlatz(platz);
    },

    /** Eine Spielstand-Datei einlesen und auf einen Platz legen */
    importiereSpielstand(text) {
        const res = GameState.importFromJson(text);
        if (!res.success || !res.state) {
            this.showToast(res.error || "Ungültige Spielstand-Datei!", "error");
            return false;
        }
        // Dieselbe Karriere liegt schon hier? Dann ersetzt die Datei sie.
        const gleich = GameState.speicherplaetze().find(p => p.zusammenfassung && res.state.saveId && p.zusammenfassung.saveId === res.state.saveId);
        let ziel;
        if (gleich) {
            if (!confirm(`Diese Karriere liegt schon auf Speicherplatz ${gleich.nr} (${this._speicherStand(gleich.zusammenfassung)}). Mit dem Stand aus der Datei ersetzen?`)) return false;
            ziel = gleich.schluessel;
        } else {
            ziel = this.waehleZielPlatz("Der importierte Spielstand");
            if (!ziel) return false;
        }
        this.beziehePlatz(ziel);
        this.app.state = res.state;
        this.app.state.saveToLocalStorage(null, true);
        this.hideStartScreen();
        this.switchTab("dashboard");
        this.renderCurrentTab();
        this.showToast(`Spielstand importiert (Speicherplatz ${GameState.platzNummer(ziel)}).`, "success");
        return true;
    },

    /** Den laufenden Stand zusätzlich auf einem freien Platz ablegen */
    legeKopieAn(platz) {
        const st = this.app.state;
        if (!st || typeof st.sichereKopie !== "function") return;
        st.sichereKopie(platz).then(ok => {
            if (ok) {
                this.showToast(`Kopie auf Speicherplatz ${GameState.platzNummer(platz)} abgelegt. Weitergespielt wird auf Speicherplatz ${GameState.platzNummer(GameState.aktiverPlatz())}.`, "success");
            } else {
                this.showToast(st._saveFehler || "Die Kopie ließ sich nicht anlegen.", "error");
            }
            this.renderSpeicherplaetze();
        });
    },

    /** Einstellungen: alle Plätze und die Sicherungen der laufenden Karriere */
    renderSpeicherplaetze() {
        const plaetzeEl = document.getElementById("settingsSpeicherplaetze");
        const sicherungenEl = document.getElementById("settingsSicherungen");
        if (!plaetzeEl || typeof GameState === "undefined" || typeof GameState.speicherplaetze !== "function") return;
        plaetzeEl.innerHTML = GameState.speicherplaetze().map(p => this._platzZeileHtml(p, "einstellungen")).join("");
        this._verdrahtePlatzZeilen(plaetzeEl, () => this.renderSpeicherplaetze());

        if (!sicherungenEl) return;
        if (!GameState.sicherungenMoeglich()) {
            sicherungenEl.innerHTML = `<p class="speicher-hinweis">Sicherungen brauchen die Browser-Datenbank (IndexedDB), die hier nicht zur Verfügung steht. Exportieren Sie den Spielstand ab und zu als Datei.</p>`;
            return;
        }
        const liste = GameState.sicherungen();
        const ico = (name) => this._speicherIco(name);
        sicherungenEl.innerHTML = `
            ${liste.length ? liste.map(s => `
                <div class="platz-zeile">
                    <span class="platz-nr">${ico("i-clock")}</span>
                    <div class="platz-text">
                        <strong>${s.currentDate ? `${this.escapeHtml(s.currentDate)} · ` : ""}${this._speicherStand(s)}</strong>
                        <span>gesichert am ${this._speicherDatum(s.lastSaved)}</span>
                    </div>
                    <div class="platz-knoepfe">
                        <button class="btn btn-secondary btn-sm" type="button" data-sicherung="${this.escapeHtml(s.schluessel)}">${ico("i-back")}<span>Zurückholen</span></button>
                    </div>
                </div>`).join("") : `<p class="speicher-hinweis">Noch keine Sicherung - die erste entsteht beim nächsten Speichern.</p>`}
            <button class="btn btn-secondary btn-sm" type="button" id="btnSicherungAnlegen">${ico("i-save")}<span>Sicherung jetzt anlegen</span></button>
        `;
        sicherungenEl.querySelectorAll("[data-sicherung]").forEach(b => b.addEventListener("click", () => this.holeSicherungZurueck(b.dataset.sicherung)));
        document.getElementById("btnSicherungAnlegen")?.addEventListener("click", () => {
            const st = this.app.state;
            if (!st || typeof st.legeSicherungAn !== "function") return;
            st.legeSicherungAn().then(ok => {
                this.showToast(ok ? "Sicherung angelegt." : (st._saveFehler || "Die Sicherung ließ sich nicht anlegen."), ok ? "success" : "error");
                this.renderSpeicherplaetze();
            });
        });
    },

    /**
     * Zu einer Sicherung zurückkehren. Der jetzige Stand wird vorher selbst
     * als Sicherung abgelegt - so lässt sich auch das Zurückholen umkehren.
     */
    holeSicherungZurueck(schluessel) {
        const st = this.app.state;
        const s = GameState.sicherungen().find(x => x.schluessel === schluessel);
        if (!st || !s) return;
        const wann = s.currentDate ? `vom ${s.currentDate} ` : "";
        if (!confirm(`Zurück zum Stand ${wann}(${this._speicherStand(s)})?\n\nDer jetzige Stand wird vorher als Sicherung abgelegt.`)) return;
        GameState.ladeSicherung(schluessel).then(zurueck => {
            if (!zurueck) {
                this.showToast("Diese Sicherung ließ sich nicht lesen.", "error");
                return null;
            }
            return st.legeSicherungAn().then(() => {
                this.app.state = zurueck;
                return zurueck.sichereJetzt();
            }).then(ok => {
                this.hideStartScreen();
                this.switchTab("dashboard");
                this.renderCurrentTab();
                this.showToast(ok ? `Zurückgeholt: ${this._speicherStand(s)}.` : (zurueck._saveFehler || "Zurückgeholt, aber nicht gespeichert."), ok ? "success" : "warning");
            });
        });
    },

    /** Wo der Spielstand liegt und wie viel Platz er belegt */
    renderSpeicherInfo() {
        const el = document.getElementById("settingsSpeicherInfo");
        if (!el || typeof GameState === "undefined") return;
        const idb = typeof GameState.speicherort === "function" && GameState.speicherort() === "indexedDB";
        const text = GameState._spiegel?.[GameState.aktiverPlatz()];
        const mb = (bytes) => (bytes / 1048576).toLocaleString("de-DE", { maximumFractionDigits: 1 });
        const groesse = text ? ` · Spielstand ${mb(text.length)} MB` : "";
        el.textContent = idb
            ? `Gespeichert in der Browser-Datenbank (IndexedDB)${groesse}.`
            : `Gespeichert im LocalStorage des Browsers (meist 5 MB Grenze)${groesse}.`;
        const db = typeof SpeicherDB !== "undefined" ? SpeicherDB : null;
        if (idb && db && typeof db.platz === "function") {
            db.platz().then(p => {
                if (!p || !p.frei) return;
                el.textContent = `Gespeichert in der Browser-Datenbank (IndexedDB)${groesse} · frei für diese Seite: ${mb(Math.max(0, p.frei - p.belegt))} MB.`;
            });
        }
        this.renderSpeicherplaetze();
    }
});
