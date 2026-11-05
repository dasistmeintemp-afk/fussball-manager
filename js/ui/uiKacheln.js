/**
 * Kacheln wie im Vorbild.
 *
 * Jede Übersicht (Kader, Spieltag, Rekrutierung, Verein, Finanzen) baut ihre
 * Kacheln aus demselben Baustein: oben Symbol, Titel und ein Knopf zum
 * Vergrößern, darunter der Inhalt. Ein Klick auf die Kachel - nicht auf
 * einen Knopf oder Spieler darin - holt sie groß nach vorn. Groß zeigt sie,
 * was klein keinen Platz hatte (.uk-mehr), und führt mit "Seite öffnen" in
 * den zuständigen Bereich. Escape, das Kreuz oder ein Klick daneben legen
 * sie zurück an ihren Platz.
 *
 * Die Kachel wird dabei verschoben, nicht kopiert: Was in ihr verdrahtet
 * ist (Spieler, Knöpfe, Aufklapper), funktioniert groß genauso.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /**
     * Eine Kachel als HTML.
     *   titel, icon ("i-users"), inhalt, fuss
     *   ziel       wohin "Seite öffnen" führt (an die Funktion aus ukVerdrahte)
     *   zielText   Beschriftung dieses Knopfs, sonst "Seite öffnen"
     *   klasse     weitere Klassen (Breite: uk-breit, uk-hoch, uk-voll)
     *   mehr       Inhalt nur für die große Ansicht
     */
    ukKachel({ titel, icon = "i-grid", inhalt = "", fuss = "", ziel = "", zielText = "", klasse = "", mehr = "", unter = "" } = {}) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        return `
            <section class="dash-card uk ${klasse}"${ziel ? ` data-uk-ziel="${esc(ziel)}"` : ""} data-uk-titel="${esc(titel)}">
                <header class="uk-kopf">
                    <span class="uk-symbol"><svg class="ico" aria-hidden="true"><use href="#${esc(icon)}"/></svg></span>
                    <h4 class="uk-titel">${esc(titel)}${unter ? `<small class="uk-untertitel">${esc(unter)}</small>` : ""}</h4>
                    ${ziel ? `<button type="button" class="btn btn-sm uk-oeffnen uk-nur-gross" data-uk-oeffnen>${esc(zielText || "Seite öffnen")}<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></button>` : ""}
                    <button type="button" class="uk-knopf uk-auf" data-uk-auf aria-label="${esc(titel)} groß anzeigen" title="Groß anzeigen"><svg class="ico" aria-hidden="true"><use href="#i-gross"/></svg></button>
                    <button type="button" class="uk-knopf uk-zu uk-nur-gross" data-uk-zu aria-label="Schließen" title="Schließen (Esc)"><svg class="ico" aria-hidden="true"><use href="#i-close"/></svg></button>
                </header>
                <div class="uk-inhalt">${inhalt}${mehr ? `<div class="uk-mehr">${mehr}</div>` : ""}</div>
                ${fuss ? `<footer class="uk-fuss">${fuss}</footer>` : ""}
            </section>`;
    },

    /**
     * Ein Raster von Kacheln anklickbar machen. gehe(ziel) führt in den
     * Bereich, den "Seite öffnen" nennt. Der Klick hängt am Raster - ein
     * neues innerHTML braucht kein neues Verdrahten.
     */
    ukVerdrahte(raster, gehe) {
        if (!raster || typeof raster.addEventListener !== "function") return;
        raster._ukGehe = gehe;
        if (raster._ukGebunden) return;
        raster._ukGebunden = true;
        raster.addEventListener("click", (e) => {
            const kachel = e.target && e.target.closest ? e.target.closest(".uk") : null;
            if (!kachel || !raster.contains(kachel)) return;
            if (e.target.closest("[data-uk-auf]")) { e.preventDefault(); this.kachelGross(kachel, raster._ukGehe); return; }
            // Knöpfe, Verweise, Spieler und Felder in der Kachel tun, was sie tun
            if (e.target.closest("button, a, input, select, textarea, label, summary, details, [role='button'], [data-rk-spieler], [data-player], [data-club-id], [data-msg-id], .uk-kein-zoom")) return;
            this.kachelGross(kachel, raster._ukGehe);
        });
        raster.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const kachel = e.target && e.target.classList && e.target.classList.contains("uk") ? e.target : null;
            if (!kachel) return;
            e.preventDefault();
            this.kachelGross(kachel, raster._ukGehe);
        });
        // Mit der Tastatur erreichbar: die Kachel selbst ist ein Ziel
        raster.querySelectorAll?.(".uk").forEach(k => { if (!k.hasAttribute("tabindex")) k.tabIndex = 0; });
    },

    /** Nach einem neuen innerHTML: die Kacheln wieder mit Tab erreichbar machen */
    ukTabulator(raster) {
        raster?.querySelectorAll?.(".uk").forEach(k => { if (!k.hasAttribute("tabindex")) k.tabIndex = 0; });
    },

    /** Ist gerade eine Kachel groß? */
    kachelOffen() {
        return !!this._ukOffen;
    },

    /** Die Kachel groß nach vorn holen - sie wächst von ihrem Platz aus */
    kachelGross(el, gehe = null) {
        if (!el || typeof document === "undefined" || el.classList.contains("gross")) return;
        this.kachelKlein(true);
        const vorher = el.getBoundingClientRect();
        const stil = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
        // Ein Platzhalter hält die Lücke im Raster, damit nichts nachrutscht
        const platz = document.createElement("div");
        platz.className = "uk-platz";
        if (stil) {
            platz.style.gridColumn = stil.gridColumn;
            platz.style.gridRow = stil.gridRow;
        }
        platz.style.height = `${Math.round(vorher.height)}px`;
        el.parentNode.insertBefore(platz, el);

        const buehne = document.createElement("div");
        buehne.className = "uk-buehne";
        buehne.innerHTML = `<div class="uk-schleier" data-uk-zu></div><div class="uk-rahmen" role="dialog" aria-modal="true"></div>`;
        buehne.querySelector(".uk-rahmen").setAttribute("aria-label", el.dataset.ukTitel || "Kachel");
        document.body.appendChild(buehne);
        buehne.querySelector(".uk-rahmen").appendChild(el);
        el.classList.add("gross");
        document.body.classList.add("uk-gross-offen");
        const zurueck = document.activeElement;
        this._ukOffen = { el, platz, buehne, gehe, zurueck };

        buehne.addEventListener("click", (e) => {
            if (e.target.closest("[data-uk-zu]")) { e.preventDefault(); this.kachelKlein(); return; }
            const oeffnen = e.target.closest("[data-uk-oeffnen]");
            if (oeffnen) {
                e.preventDefault();
                const ziel = el.dataset.ukZiel;
                this.kachelKlein(true);
                if (ziel && typeof gehe === "function") gehe(ziel);
            }
        });
        if (!this._ukTaste) {
            this._ukTaste = (e) => { if (e.key === "Escape" && this._ukOffen) { e.stopPropagation(); this.kachelKlein(); } };
            document.addEventListener("keydown", this._ukTaste, true);
        }

        // Wachsen: vom alten Platz auf die große Fläche (FLIP)
        const ruhig = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!ruhig && typeof el.animate === "function" && vorher.width > 0) {
            const nachher = el.getBoundingClientRect();
            const sx = vorher.width / Math.max(1, nachher.width), sy = vorher.height / Math.max(1, nachher.height);
            el.animate([
                { transformOrigin: "0 0", transform: `translate(${vorher.left - nachher.left}px, ${vorher.top - nachher.top}px) scale(${sx}, ${sy})`, opacity: 0.6 },
                { transformOrigin: "0 0", transform: "none", opacity: 1 }
            ], { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
            buehne.querySelector(".uk-schleier").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
        }
        (el.querySelector(".uk-zu") || el).focus?.({ preventScroll: true });
    },

    /** Die große Kachel zurück an ihren Platz legen */
    kachelKlein(sofort = false) {
        const o = this._ukOffen;
        if (!o) return;
        this._ukOffen = null;
        let erledigt = false;
        const fertig = () => {
            // Nur einmal: Das Abbrechen der Animation unten meldet sich sonst noch einmal
            if (erledigt) return;
            erledigt = true;
            o.el.classList.remove("gross");
            o.el.getAnimations?.().forEach(a => a.cancel());
            if (o.platz.isConnected) o.platz.replaceWith(o.el);
            else o.el.remove();
            o.buehne.remove();
            if (!this._ukOffen) document.body.classList.remove("uk-gross-offen");
            if (!sofort && o.zurueck && o.zurueck.isConnected && typeof o.zurueck.focus === "function") o.zurueck.focus({ preventScroll: true });
        };
        const ruhig = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (sofort || ruhig || typeof o.el.animate !== "function" || !o.platz.isConnected) return fertig();
        const ziel = o.platz.getBoundingClientRect();
        const jetzt = o.el.getBoundingClientRect();
        if (!ziel.width || !jetzt.width) return fertig();
        const anim = o.el.animate([
            { transformOrigin: "0 0", transform: "none", opacity: 1 },
            { transformOrigin: "0 0", transform: `translate(${ziel.left - jetzt.left}px, ${ziel.top - jetzt.top}px) scale(${ziel.width / jetzt.width}, ${ziel.height / jetzt.height})`, opacity: 0.7 }
        ], { duration: 200, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" });
        o.buehne.querySelector(".uk-schleier")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
        anim.onfinish = fertig;
        anim.oncancel = fertig;
    }
});
