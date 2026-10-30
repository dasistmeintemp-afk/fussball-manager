/**
 * Meldungen: eine Zeile unter der Kopfleiste und die Meldungszentrale.
 *
 * Vorher stapelten sich Kästen unten rechts, jeder mit eigenem Zeitgeber,
 * oft drei übereinander über dem Inhalt. Jetzt gibt es eine einzige Zeile,
 * mittig unter der Kopfleiste: Eine neue Meldung ersetzt die alte, ein
 * dünner Balken zeigt, wie lange sie noch steht. Was gerade nicht zu sehen
 * ist, hebt die Meldungszentrale hinter der Glocke auf - mit einer Zahl für
 * das, was wichtig war und noch niemand gesehen hat.
 *
 * Meldungen mit Knöpfen (etwa "Ansehen", wenn die Zeit angehalten hat)
 * bleiben stehen, bis man sie nutzt, schließt oder weiterspielt. Danach
 * gelten ihre Knöpfe nicht mehr, der Text bleibt in der Zentrale.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype
 * (wie uiSpielbericht.js).
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /** Zeichen, Name und Mindestdauer je Art - Fehler müssen sich lesen lassen */
    MELDUNG_ARTEN: {
        success: { zeichen: "i-check", name: "Erledigt", min: 2500 },
        info: { zeichen: "i-info", name: "Hinweis", min: 3000 },
        warning: { zeichen: "i-alert", name: "Achtung", min: 5000 },
        error: { zeichen: "i-alert", name: "Fehler", min: 5000 }
    },

    /** So viele Meldungen hebt die Zentrale auf */
    MELDUNGEN_MAX: 40,

    /** Zeile und Glocke vorbereiten (einmal beim Start) */
    richteMeldungenEin() {
        if (typeof document === "undefined" || typeof document.getElementById !== "function") return;
        const glocke = document.getElementById("btnMeldungen");
        if (glocke && glocke.dataset && typeof glocke.addEventListener === "function" && !glocke.dataset.gebunden) {
            glocke.dataset.gebunden = "1";
            glocke.addEventListener("click", (e) => {
                e.stopPropagation();
                this.schalteMeldungszentrale();
            });
            document.addEventListener("click", (e) => {
                const zentrale = document.getElementById("meldungZentrale");
                if (zentrale && !zentrale.hidden && !zentrale.contains(e.target)) this.schalteMeldungszentrale(false);
            });
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") this.schalteMeldungszentrale(false);
            });
        }
        this._meldungsZeile();
    },

    /** Der Platz für die eine Zeile - unter der Kopfleiste, über allen Fenstern */
    _meldungsZeile() {
        if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
        let zeile = document.getElementById("meldungZeile");
        if (!zeile && document.body) {
            zeile = document.createElement("div");
            zeile.id = "meldungZeile";
            zeile.className = "meldung-zeile";
            zeile.setAttribute("aria-live", "polite");
            document.body.appendChild(zeile);
        }
        return zeile;
    },

    /** Vorn stehende Zeichen weg - die Art hat jetzt ihr eigenes Symbol */
    meldungOhneZeichen(text) {
        return String(text ?? "").replace(/^(?:\s*[\p{Extended_Pictographic}\u{FE0F}\u{200D}])+\s*/u, "");
    },

    /**
     * Eine Meldung zeigen. Gleiche Schnittstelle wie bisher: Art ("success",
     * "info", "warning", "error"), Dauer und optionen.aktionen
     * ([{ text, haupt, aktion }]), optionen.beiKlick. Neu: optionen.titel
     * (kleine Zeile darüber) und optionen.bisWeiter (bleibt bis zum Weiterspielen).
     */
    showToast(message, type = "info", duration = 3500, optionen = {}) {
        const art = this.MELDUNG_ARTEN[type] ? type : "info";
        const aktionen = (Array.isArray(optionen.aktionen) ? optionen.aktionen : []).filter(a => a && typeof a.aktion === "function");
        const beiKlick = typeof optionen.beiKlick === "function" ? optionen.beiKlick : null;
        this._meldungNr = (this._meldungNr || 0) + 1;
        const meldung = {
            id: this._meldungNr,
            art,
            html: this.meldungOhneZeichen(message),
            titel: optionen.titel || "",
            datum: this.app?.state?.currentDate || "",
            schritt: this._weiterSchritt || 0,
            aktionen,
            beiKlick,
            bleibt: aktionen.length > 0 || !!optionen.bisWeiter,
            dauer: Math.max(this.MELDUNG_ARTEN[art].min, Number(duration) || 0),
            wichtig: art === "warning" || art === "error" || aktionen.length > 0,
            gesehen: false,
            erledigt: false
        };
        if (!Array.isArray(this._meldungen)) this._meldungen = [];
        this._meldungen.unshift(meldung);
        if (this._meldungen.length > this.MELDUNGEN_MAX) this._meldungen.length = this.MELDUNGEN_MAX;
        this.zeigeMeldungsZeile(meldung);
        this.aktualisiereMeldungsZahl();
        return meldung;
    },

    /** Gelten die Knöpfe einer Meldung noch? Nur bis zum nächsten Weiterspielen. */
    meldungAktiv(m) {
        return !!m && !m.erledigt && m.schritt === (this._weiterSchritt || 0);
    },

    /** Inhalt einer Meldung - in der Zeile mit Schließen und Restzeit */
    meldungHtml(m, inZeile) {
        const a = this.MELDUNG_ARTEN[m.art];
        const knoepfe = this.meldungAktiv(m) && m.aktionen.length
            ? `<span class="mz-aktionen">${m.aktionen.map((x, i) =>
                `<button type="button" class="btn btn-sm ${x.haupt ? "btn-primary" : "btn-secondary"}" data-meldung-aktion="${i}">${this.escapeHtml(x.text)}</button>`).join("")}</span>`
            : "";
        return `<span class="mz-zeichen" aria-hidden="true"><svg class="ico"><use href="#${a.zeichen}"/></svg></span>
            <span class="mz-text">${m.titel ? `<small>${this.escapeHtml(m.titel)}</small>` : ""}<span>${m.html}</span></span>
            ${knoepfe}
            ${inZeile ? `<button type="button" class="mz-zu" aria-label="Meldung schließen"><svg class="ico" aria-hidden="true"><use href="#i-close"/></svg></button>` : ""}
            ${inZeile && !m.bleibt ? `<i class="mz-rest" style="animation-duration:${m.dauer}ms"></i>` : ""}`;
    },

    /** Knöpfe und Klick einer Meldung - in der Zeile wie in der Zentrale */
    bindeMeldung(el, m, danach) {
        el.addEventListener("click", (e) => {
            const zu = e.target.closest ? e.target.closest(".mz-zu") : null;
            const knopf = e.target.closest ? e.target.closest("[data-meldung-aktion]") : null;
            if (zu) {
                m.gesehen = true;
                this.schliesseMeldungsZeile(m.id);
                this.aktualisiereMeldungsZahl();
                return;
            }
            const ziel = knopf ? m.aktionen[Number(knopf.dataset.meldungAktion)] : null;
            if (!ziel && !m.beiKlick) return;
            if (!this.meldungAktiv(m)) return;
            m.erledigt = true;
            m.gesehen = true;
            this.schliesseMeldungsZeile(m.id);
            if (typeof danach === "function") danach();
            this.aktualisiereMeldungsZahl();
            if (ziel) ziel.aktion();
            else m.beiKlick();
        });
    },

    /** Die Zeile zeigen: Eine neue Meldung ersetzt die alte */
    zeigeMeldungsZeile(m) {
        const zeile = this._meldungsZeile();
        // Nur im echten Browser - Attrappen in Tests kennen weder Stil noch Klassen
        if (!zeile || typeof zeile.style?.setProperty !== "function" || !zeile.classList) return;
        clearTimeout(this._meldungUhr);
        // Unter der Kopfleiste - am Handy ist sie zweizeilig und höher
        const kopf = document.querySelector ? document.querySelector(".app-header") : null;
        const unten = kopf && kopf.getBoundingClientRect ? kopf.getBoundingClientRect().bottom : 0;
        zeile.style.setProperty("--mz-oben", `${Math.max(8, Math.round(unten) + 8)}px`);
        // Im Livespiel stehen oben Spielstand und Uhr - dort erscheint die Zeile unten
        const live = document.getElementById("modalLiveMatch");
        const imLivespiel = !!(live && live.style && live.style.display && live.style.display !== "none");
        zeile.classList.toggle("unten", imLivespiel);

        [...zeile.children].forEach(alt => {
            alt.classList.remove("da");
            setTimeout(() => alt.remove(), 200);
        });
        const karte = document.createElement("div");
        karte.className = `mz-karte mz-${m.art}${m.aktionen.length || m.beiKlick ? " klickbar" : ""}`;
        karte.dataset.meldung = String(m.id);
        karte.setAttribute("role", m.art === "error" ? "alert" : "status");
        karte.innerHTML = this.meldungHtml(m, true);
        this.bindeMeldung(karte, m);
        // Wer mit der Maus darauf steht, liest noch - dann läuft die Zeit nicht ab
        karte.addEventListener("mouseenter", () => {
            clearTimeout(this._meldungUhr);
            karte.classList.add("halt");
        });
        karte.addEventListener("mouseleave", () => {
            karte.classList.remove("halt");
            if (!m.bleibt) this._meldungUhr = setTimeout(() => this.schliesseMeldungsZeile(m.id), 2000);
        });
        zeile.appendChild(karte);
        const zeigen = () => karte.classList.add("da");
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(zeigen); else zeigen();
        // Im Livespiel bleibt nichts stehen: Die Zeile läge sonst dauerhaft
        // über der Steuerung. Knöpfe gelten weiter - in der Zentrale.
        if (!m.bleibt || imLivespiel) {
            this._meldungUhr = setTimeout(() => {
                m.gesehen = m.gesehen || !m.wichtig;
                this.schliesseMeldungsZeile(m.id);
            }, m.bleibt ? Math.max(m.dauer, 6000) : m.dauer);
        }
    },

    /** Die Zeile leeren - die Meldungen bleiben in der Zentrale (etwa zum Anpfiff) */
    leereMeldungsZeile() {
        const zeile = typeof document !== "undefined" && document.getElementById ? document.getElementById("meldungZeile") : null;
        if (!zeile || !zeile.children) return;
        clearTimeout(this._meldungUhr);
        [...zeile.children].forEach(karte => this.schliesseMeldungsZeile(karte.dataset?.meldung));
    },

    /** Eine Meldung aus der Zeile nehmen (sie bleibt in der Zentrale) */
    schliesseMeldungsZeile(id) {
        const zeile = typeof document !== "undefined" && document.getElementById ? document.getElementById("meldungZeile") : null;
        const karte = zeile ? zeile.querySelector(`[data-meldung="${id}"]`) : null;
        if (!karte) return;
        karte.classList.remove("da");
        setTimeout(() => karte.remove(), 200);
    },

    /**
     * Weiterspielen: Was stehen bleiben sollte, gilt jetzt nicht mehr. Die
     * Knöpfe alter Meldungen verfallen, die Zahl an der Glocke beginnt neu.
     * Kurze Meldungen laufen von selbst aus.
     */
    raeumeMeldungenAuf() {
        this._weiterSchritt = (this._weiterSchritt || 0) + 1;
        (this._meldungen || []).forEach(m => {
            m.gesehen = true;
            if (m.bleibt) this.schliesseMeldungsZeile(m.id);
        });
        this.aktualisiereMeldungsZahl();
        this.schalteMeldungszentrale(false);
    },

    /** Die Zahl an der Glocke: Wichtiges, das noch niemand gesehen hat */
    aktualisiereMeldungsZahl() {
        if (typeof document === "undefined" || typeof document.getElementById !== "function") return;
        const zahl = document.getElementById("meldungenZahl");
        const glocke = document.getElementById("btnMeldungen");
        const offen = (this._meldungen || []).filter(m => m.wichtig && !m.gesehen).length;
        if (zahl) {
            zahl.textContent = offen > 9 ? "9+" : String(offen);
            zahl.hidden = offen === 0;
        }
        if (glocke && typeof glocke.setAttribute === "function") glocke.setAttribute("aria-label", offen ? `Meldungen, ${offen} neu` : "Meldungen");
    },

    /** Die Meldungszentrale auf- oder zuklappen */
    schalteMeldungszentrale(auf) {
        if (typeof document === "undefined" || typeof document.getElementById !== "function") return;
        let zentrale = document.getElementById("meldungZentrale");
        const offen = !!zentrale && !zentrale.hidden;
        const soll = typeof auf === "boolean" ? auf : !offen;
        const glocke = document.getElementById("btnMeldungen");
        if (!soll) {
            if (zentrale) zentrale.hidden = true;
            if (glocke && typeof glocke.setAttribute === "function") glocke.setAttribute("aria-expanded", "false");
            return;
        }
        if (!zentrale) {
            zentrale = document.createElement("div");
            zentrale.id = "meldungZentrale";
            zentrale.className = "meldung-zentrale";
            zentrale.setAttribute("role", "dialog");
            zentrale.setAttribute("aria-label", "Meldungen");
            document.body.appendChild(zentrale);
        }
        // Unter der Glocke ausrichten, am Handy über die ganze Breite
        if (glocke && glocke.getBoundingClientRect) {
            const r = glocke.getBoundingClientRect();
            zentrale.style.setProperty("--mzz-oben", `${Math.round(r.bottom + 8)}px`);
            zentrale.style.setProperty("--mzz-links", `${Math.max(8, Math.round(r.left - 12))}px`);
        }
        this.zeichneMeldungszentrale(zentrale);
        zentrale.hidden = false;
        // Was in der Zeile stand, steht jetzt oben in der Zentrale
        clearTimeout(this._meldungUhr);
        (this._meldungen || []).forEach(m => this.schliesseMeldungsZeile(m.id));
        if (glocke && typeof glocke.setAttribute === "function") glocke.setAttribute("aria-expanded", "true");
        (this._meldungen || []).forEach(m => { m.gesehen = true; });
        this.aktualisiereMeldungsZahl();
    },

    /** Alle Meldungen nach Tagen, die neueste oben; Knöpfe nur, solange sie gelten */
    zeichneMeldungszentrale(zentrale) {
        const liste = this._meldungen || [];
        const heute = this.app?.state?.currentDate || "";
        const tage = [];
        liste.forEach(m => {
            const letzter = tage[tage.length - 1];
            if (letzter && letzter.datum === m.datum) letzter.meldungen.push(m);
            else tage.push({ datum: m.datum, meldungen: [m] });
        });
        // Das Spieldatum steht schon als TT.MM.JJJJ im Spielstand
        const datumText = (d) => (!d ? "Vor dem Spielstart" : d === heute ? `Heute · ${d}` : d);
        zentrale.innerHTML = `
            <header class="mzz-kopf">
                <strong>Meldungen</strong>
                ${liste.length ? '<button type="button" class="btn btn-sm btn-secondary" data-mzz-leeren>Leeren</button>' : ""}
            </header>
            <div class="mzz-liste">
                ${tage.length ? tage.map(t => `
                    <div class="mzz-tag">${this.escapeHtml(datumText(t.datum))}</div>
                    ${t.meldungen.map(m => `<div class="mz-karte mz-${m.art} mzz-eintrag${this.meldungAktiv(m) && (m.aktionen.length || m.beiKlick) ? " klickbar" : ""}" data-mzz="${m.id}">${this.meldungHtml(m, false)}</div>`).join("")}
                `).join("") : '<p class="mzz-leer">Keine Meldungen. Was hier erscheint, bleibt bis zum Neuladen.</p>'}
            </div>`;
        zentrale.querySelector("[data-mzz-leeren]")?.addEventListener("click", (e) => {
            e.stopPropagation();
            this._meldungen = [];
            this.zeichneMeldungszentrale(zentrale);
            this.aktualisiereMeldungsZahl();
        });
        zentrale.querySelectorAll("[data-mzz]").forEach(el => {
            const m = liste.find(x => String(x.id) === el.dataset.mzz);
            if (m) this.bindeMeldung(el, m, () => this.schalteMeldungszentrale(false));
        });
    }
});
