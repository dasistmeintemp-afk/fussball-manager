/**
 * Menü oben wie im Vorbild.
 *
 * Am breiten Bildschirm stehen die Bereiche in der Kopfleiste: Start, Kader,
 * Spieltag, Transfers, Verein. Jeder Bereich klappt beim Zeigen (oder über
 * den kleinen Pfeil) ein Menü mit seinen Seiten und deren Unterreitern auf.
 * Darunter zeigt eine zweite Zeile die Seiten des gewählten Bereichs, rechts
 * daneben Tabellenplatz, Form, Spieltag, Kontostand und Vorstand. Die
 * Seitenleiste fällt weg, der Inhalt bekommt die volle Breite.
 *
 * Wer die Seitenleiste lieber behält, stellt sie unter "Spielstand &
 * Optionen" zurück, auch schmal mit nur den Symbolen. Die Wahl gilt für
 * dieses Gerät (wie der Sterne-Maßstab), nicht für den Spielstand. Am Handy
 * bleibt die Leiste unten, wie sie ist.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype
 * (wie uiMeldungen.js).
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Bereiche und ihre Seiten. "knopf" ist eine Ansicht im Reiter (die
     * Unterreiter des Transfermarkts), "zahl" das Abzeichen der Seitenleiste,
     * dessen Zahl das Menü übernimmt, "nurWenn" ein Reiter, der nur zeitweise
     * da ist. Der letzte Bereich hat keinen Platz in der Zeile: Die Optionen
     * öffnet das Zahnrad.
     */
    KOPFMENUE: [
        { id: "start", titel: "Start", seiten: [
            { tab: "dashboard", titel: "Übersicht", icon: "i-grid" },
            { tab: "inbox", titel: "Postfach", icon: "i-mail", zahl: "navInboxBadge" },
            { tab: "calendar", titel: "Kalender", icon: "i-calendar" }
        ] },
        { id: "kader", titel: "Kader", seiten: [
            { tab: "squad", titel: "Kader", icon: "i-users" },
            { tab: "training", titel: "Training", icon: "i-dumbbell" },
            { tab: "youth", titel: "Jugend", icon: "i-leaf", zahl: "navYouthBadge" },
            { tab: "national", titel: "Nationalteam", icon: "i-globe", zahl: "navNationalBadge" }
        ] },
        { id: "spieltag", titel: "Spieltag", seiten: [
            { tab: "tactics", titel: "Aufstellung & Taktik", icon: "i-tactics" },
            { tab: "fixtures", titel: "Spielplan & Tabelle", icon: "i-table" },
            { tab: "stats", titel: "Statistiken", icon: "i-chart" },
            { tab: "preseason", titel: "Vorbereitung", icon: "i-sun", zahl: "navPreseasonBadge", nurWenn: "navPreseason" }
        ] },
        { id: "transfers", titel: "Transfers", seiten: [
            { tab: "transfers", knopf: "btnSubTransfersMarket", titel: "Transfermarkt", icon: "i-transfer", zahl: "navOffersBadge" },
            { tab: "transfers", knopf: "btnSubTransfersScouting", titel: "Scouting", icon: "i-search" },
            { tab: "transfers", knopf: "btnSubTransfersLoans", titel: "Leihen", icon: "i-transfer" },
            { tab: "transfers", knopf: "btnSubTransfersSD", titel: "Sportdirektor", icon: "i-target" },
            { tab: "transfers", knopf: "btnSubTransfersListe", titel: "Beobachtungsliste", icon: "i-star" }
        ] },
        { id: "verein", titel: "Verein", seiten: [
            { tab: "club", titel: "Verein", icon: "i-shield" },
            { tab: "finances", titel: "Finanzen", icon: "i-wallet" }
        ] },
        { id: "optionen", titel: "Optionen", zahnrad: true, seiten: [
            { tab: "settings", titel: "Spielstand & Optionen", icon: "i-sliders" }
        ] }
    ],

    MENUE_SPEICHER: "viererkette-menue",

    MENUE_ARTEN: {
        oben: { titel: "Oben", text: "Wie im Vorbild: die Bereiche in der Kopfleiste mit Aufklappmenü, darunter die Seiten des Bereichs. Der Inhalt bekommt die volle Breite." },
        leiste: { titel: "Seitenleiste", text: "Alle Bereiche links untereinander." },
        schmal: { titel: "Seitenleiste schmal", text: "Nur die Symbole. Den Namen zeigt der Zeiger." }
    },

    menueArt() {
        try {
            const wert = localStorage.getItem(this.MENUE_SPEICHER);
            if (this.MENUE_ARTEN[wert]) return wert;
        } catch (e) { /* ohne Speicher gilt, was in dieser Sitzung gewählt wurde */ }
        return this._menueArt || "oben";
    },

    setzeMenueArt(art) {
        if (!this.MENUE_ARTEN[art]) return;
        try { localStorage.setItem(this.MENUE_SPEICHER, art); } catch (e) { /* gilt dann nur bis zum Neuladen */ }
        this._menueArt = art;
        this.wendeMenueArtAn();
    },

    wendeMenueArtAn() {
        const body = typeof document !== "undefined" ? document.body : null;
        if (!body || !body.classList) return;
        const art = this.menueArt();
        body.classList.toggle("menue-oben", art === "oben");
        body.classList.toggle("menue-schmal", art === "schmal");
        const knopf = document.getElementById("btnLeisteEinklappen");
        if (knopf) {
            const titel = art === "schmal" ? "Seitenleiste ausklappen" : "Seitenleiste einklappen";
            knopf.title = titel;
            knopf.setAttribute("aria-label", titel);
        }
        this.schliesseKopfAufklapp();
        this.aktualisiereKopfmenue();
        this.messeKopf();
    },

    /** Ist eine Seite gerade da? Die Vorbereitung gibt es nur im Sommer. */
    kopfSeiteDa(seite) {
        if (!seite.nurWenn || typeof document === "undefined") return true;
        const el = document.getElementById(seite.nurWenn);
        return !!el && !(el.style && el.style.display === "none");
    },

    /** Die Zahl am Abzeichen der Seitenleiste, 0 wenn es verborgen ist */
    kopfZahl(seite) {
        if (!seite.zahl || typeof document === "undefined") return 0;
        const el = document.getElementById(seite.zahl);
        if (!el || (el.style && el.style.display === "none")) return 0;
        return parseInt(el.textContent, 10) || 1;
    },

    /** Bereich und Seite, auf denen man gerade steht */
    kopfAktiveSeite(tab = this.activeTab || "dashboard") {
        const aktiv = (id) => {
            const el = typeof document !== "undefined" && document.getElementById ? document.getElementById(id) : null;
            return !!(el && el.classList && el.classList.contains("active"));
        };
        let ersatz = null;
        for (const gruppe of this.KOPFMENUE) {
            for (let i = 0; i < gruppe.seiten.length; i++) {
                const seite = gruppe.seiten[i];
                if (seite.tab !== tab) continue;
                if (!seite.knopf || aktiv(seite.knopf)) return { gruppe, index: i };
                if (!ersatz) ersatz = { gruppe, index: i };
            }
        }
        return ersatz;
    },

    /** Zur Seite eines Bereichs gehen, auf Wunsch gleich in einen Unterreiter */
    kopfGehe(gruppeId, index = 0, unterreiter = null) {
        const gruppe = this.KOPFMENUE.find(g => g.id === gruppeId);
        const seite = gruppe && (gruppe.seiten[index] && this.kopfSeiteDa(gruppe.seiten[index]) ? gruppe.seiten[index] : gruppe.seiten[0]);
        if (!seite) return;
        clearTimeout(this._kopfAufTimer);
        this.schliesseKopfAufklapp();
        this.switchTab(seite.tab);
        if (seite.knopf) document.getElementById(seite.knopf)?.click();
        if (unterreiter && typeof this.zeigeUnterreiter === "function") this.zeigeUnterreiter(`pane-${seite.tab}`, unterreiter, { nachOben: true });
        if (typeof this.playSound === "function") this.playSound("click");
        this.aktualisiereKopfmenue();
    },

    richteKopfmenueEin() {
        if (typeof document === "undefined" || typeof document.createElement !== "function"
            || typeof document.querySelector !== "function" || typeof document.addEventListener !== "function") return;
        const menue = document.getElementById("kopfMenue");
        if (!menue || !menue.dataset || menue.dataset.bereit || typeof menue.querySelectorAll !== "function") return;
        menue.dataset.bereit = "1";
        const pfeil = `<svg class="ico" aria-hidden="true"><use href="#i-chevron-down"/></svg>`;
        menue.innerHTML = this.KOPFMENUE.filter(g => !g.zahnrad).map(g => `
            <div class="kopf-gruppe" data-gruppe="${g.id}">
                <button type="button" class="kopf-gruppe-knopf" data-gruppe-ziel="${g.id}">${this.escapeHtml(g.titel)}<span class="kopf-zahl-klein" hidden></span></button>
                <button type="button" class="kopf-gruppe-pfeil" data-gruppe-auf="${g.id}" aria-haspopup="true" aria-expanded="false" aria-label="${this.escapeHtml(g.titel)}: alle Seiten">${pfeil}</button>
                <div class="kopf-aufklapp" role="menu" hidden></div>
            </div>`).join("");

        const zeigen = typeof window !== "undefined" && typeof window.matchMedia === "function"
            && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        menue.querySelectorAll(".kopf-gruppe").forEach(el => {
            if (zeigen) {
                el.addEventListener("mouseenter", () => {
                    clearTimeout(this._kopfZuTimer);
                    clearTimeout(this._kopfAufTimer);
                    if (el.classList.contains("gesperrt")) return;
                    // Schon eines offen: gleich wechseln, sonst kurz warten - wer nur
                    // über die Zeile fährt, soll keine Menüs aufreißen
                    const offen = !!menue.querySelector(".kopf-gruppe.offen");
                    this._kopfAufTimer = setTimeout(() => this.oeffneKopfAufklapp(el.dataset.gruppe), offen ? 0 : 160);
                });
                el.addEventListener("mouseleave", () => {
                    clearTimeout(this._kopfAufTimer);
                    el.classList.remove("gesperrt");
                    this._kopfZuTimer = setTimeout(() => this.schliesseKopfAufklapp(), 220);
                });
            }
        });
        menue.addEventListener("click", (e) => {
            const auf = e.target.closest("[data-gruppe-auf]");
            if (auf) {
                const offen = auf.closest(".kopf-gruppe").classList.contains("offen");
                if (offen) this.schliesseKopfAufklapp(); else this.oeffneKopfAufklapp(auf.dataset.gruppeAuf);
                return;
            }
            const ziel = e.target.closest("[data-gruppe-ziel]");
            if (ziel) {
                // Nach dem Klick bleibt das Menü zu, bis der Zeiger die Gruppe verlässt
                ziel.closest(".kopf-gruppe").classList.add("gesperrt");
                return this.kopfGehe(ziel.dataset.gruppeZiel, 0);
            }
            const eintrag = e.target.closest("[data-ka-seite]");
            if (eintrag) {
                eintrag.closest(".kopf-gruppe")?.classList.add("gesperrt");
                const [g, i] = eintrag.dataset.kaSeite.split(":");
                this.kopfGehe(g, Number(i), eintrag.dataset.kaUr || null);
            }
        });

        document.getElementById("kopfUnter")?.addEventListener("click", (e) => {
            const k = e.target.closest("[data-ku-seite]");
            if (!k) return;
            const [g, i] = k.dataset.kuSeite.split(":");
            this.kopfGehe(g, Number(i));
        });
        document.getElementById("btnKopfOptionen")?.addEventListener("click", () => this.kopfGehe("optionen", 0));
        document.getElementById("btnLeisteEinklappen")?.addEventListener("click", () => {
            this.setzeMenueArt(this.menueArt() === "schmal" ? "leiste" : "schmal");
            if (typeof this.playSound === "function") this.playSound("click");
        });
        // Die Ansichten im Transfermarkt wechseln ohne neuen Reiter
        document.querySelector("#pane-transfers .view-switch-buttons")?.addEventListener("click", () => this.aktualisiereKopfmenue());

        document.addEventListener("click", (e) => {
            if (!e.target.closest || !e.target.closest(".kopf-gruppe")) this.schliesseKopfAufklapp();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key !== "Escape") return;
            const offen = document.querySelector(".kopf-gruppe.offen");
            if (!offen) return;
            this.schliesseKopfAufklapp();
            offen.querySelector(".kopf-gruppe-pfeil")?.focus();
            e.stopPropagation();
        }, true);

        // Schmale Leiste: der Name erscheint beim Zeigen
        document.querySelectorAll(".sidebar .nav-item[data-tab]").forEach(n => {
            const text = (n.querySelector(".nav-text")?.textContent || "").trim();
            if (text && !n.title) n.title = text;
        });

        // Der Inhalt rollt unter der Kopfleiste - ihre Höhe hängt am Menü
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("resize", () => this.messeKopf());
        }
        const kopf = document.querySelector(".app-header");
        if (kopf && typeof ResizeObserver === "function") new ResizeObserver(() => this.messeKopf()).observe(kopf);
        this.wendeMenueArtAn();
    },

    messeKopf() {
        if (typeof document === "undefined" || !document.documentElement || !document.documentElement.style) return;
        const kopf = document.querySelector(".app-header");
        if (!kopf || typeof kopf.getBoundingClientRect !== "function") return;
        const hoehe = Math.round(kopf.getBoundingClientRect().height);
        if (hoehe > 0) document.documentElement.style.setProperty("--kopf-hoehe", `${hoehe}px`);
    },

    /** Aufklappmenü eines Bereichs: Seiten ohne Unterreiter in einer Spalte, die übrigen mit ihren Unterreitern daneben */
    oeffneKopfAufklapp(gruppeId) {
        const el = document.querySelector(`.kopf-gruppe[data-gruppe="${gruppeId}"]`);
        const gruppe = this.KOPFMENUE.find(g => g.id === gruppeId);
        if (!el || !gruppe) return;
        this.schliesseKopfAufklapp(el);
        const box = el.querySelector(".kopf-aufklapp");
        const hier = this.kopfAktiveSeite();
        const zahl = (n) => n > 0 ? `<span class="kopf-zahl-klein">${n}</span>` : "";
        const eintrag = (seite, i) => {
            const an = hier && hier.gruppe.id === gruppe.id && hier.index === i;
            return `<button type="button" role="menuitem" class="ka-seite${an ? " aktiv" : ""}" data-ka-seite="${gruppe.id}:${i}">
                <svg class="ico" aria-hidden="true"><use href="#${seite.icon}"/></svg><span>${this.escapeHtml(seite.titel)}</span>${zahl(this.kopfZahl(seite))}</button>`;
        };
        // Die Spalte der Seiten ohne Unterreiter steht dort, wo die erste von ihnen
        // in der Reihe kommt: bei Spieltag vorn, bei Kader (Nationalteam) hinten
        const lose = [];
        const spalten = [];
        let loseAn = -1;
        gruppe.seiten.forEach((seite, i) => {
            if (!this.kopfSeiteDa(seite)) return;
            const pane = seite.knopf ? null : document.getElementById(`pane-${seite.tab}`);
            const unter = pane ? [...pane.querySelectorAll(":scope > .unterreiter .ur-knopf")].filter(k => !k.hidden) : [];
            if (!unter.length) {
                if (loseAn < 0) loseAn = spalten.length;
                return lose.push(eintrag(seite, i));
            }
            const aktivUr = pane.dataset.urAktiv;
            spalten.push(`<div class="ka-spalte">${eintrag(seite, i)}${unter.map(k => {
                const name = k.dataset.urZiel;
                const an = hier && hier.gruppe.id === gruppe.id && hier.index === i && name === aktivUr;
                return `<button type="button" role="menuitem" class="ka-unter${an ? " aktiv" : ""}" data-ka-seite="${gruppe.id}:${i}" data-ka-ur="${this.escapeHtml(name)}">${this.escapeHtml(name)}</button>`;
            }).join("")}</div>`);
        });
        if (lose.length) spalten.splice(loseAn, 0, `<div class="ka-spalte">${lose.join("")}</div>`);
        box.innerHTML = spalten.join("");
        box.hidden = false;
        el.classList.add("offen");
        el.querySelector(".kopf-gruppe-pfeil")?.setAttribute("aria-expanded", "true");
        // Ragt das Menü hinaus, rückt es zurück ins Fenster
        box.style.left = "0px";
        const r = box.getBoundingClientRect();
        const breite = window.innerWidth || document.documentElement.clientWidth || 0;
        let schieben = Math.min(0, breite - 8 - r.right);
        if (r.left + schieben < 8) schieben = 8 - r.left;
        box.style.left = `${Math.round(schieben)}px`;
    },

    schliesseKopfAufklapp(ausser = null) {
        if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") return;
        document.querySelectorAll(".kopf-gruppe.offen").forEach(el => {
            if (el === ausser) return;
            el.classList.remove("offen");
            const box = el.querySelector(".kopf-aufklapp");
            if (box) box.hidden = true;
            el.querySelector(".kopf-gruppe-pfeil")?.setAttribute("aria-expanded", "false");
        });
    },

    /** Aktiven Bereich, Zahlen, die Seitenzeile und den Stand nachziehen */
    aktualisiereKopfmenue() {
        if (typeof document === "undefined" || typeof document.getElementById !== "function") return;
        const menue = document.getElementById("kopfMenue");
        if (!menue || !menue.dataset || !menue.dataset.bereit) return;
        const hier = this.kopfAktiveSeite();
        const zahlen = (gruppe) => gruppe.seiten.filter(s => this.kopfSeiteDa(s)).reduce((n, s) => n + this.kopfZahl(s), 0);
        this.KOPFMENUE.forEach(gruppe => {
            const el = menue.querySelector(`.kopf-gruppe[data-gruppe="${gruppe.id}"]`);
            if (!el) return;
            el.classList.toggle("aktiv", !!hier && hier.gruppe.id === gruppe.id);
            const z = el.querySelector(".kopf-gruppe-knopf .kopf-zahl-klein");
            const n = zahlen(gruppe);
            if (z) { z.textContent = n; z.hidden = n === 0; }
        });
        document.getElementById("btnKopfOptionen")?.classList.toggle("aktiv", !!hier && hier.gruppe.id === "optionen");

        const unter = document.getElementById("kopfUnter");
        if (unter) {
            unter.innerHTML = hier ? hier.gruppe.seiten.map((seite, i) => {
                if (!this.kopfSeiteDa(seite)) return "";
                const n = this.kopfZahl(seite);
                const an = i === hier.index;
                return `<button type="button" class="ku-knopf${an ? " aktiv" : ""}" data-ku-seite="${hier.gruppe.id}:${i}"${an ? ` aria-current="page"` : ""}>${this.escapeHtml(seite.titel)}${n > 0 ? `<span class="kopf-zahl-klein">${n}</span>` : ""}</button>`;
            }).join("") : "";
            // Rollt die Zeile (schmales Fenster), steht die aktive Seite im Blick
            const an = unter.querySelector(".ku-knopf.aktiv");
            if (an && unter.scrollWidth > unter.clientWidth) unter.scrollLeft = Math.max(0, an.offsetLeft - unter.offsetLeft - 24);
        }

        // Ist der Vereinsname weggefallen (schmale Fenster), nennt ihn der Zeiger
        const verein = document.getElementById("headerClubInfo");
        if (verein) verein.title = (document.getElementById("headerClubName")?.textContent || "").trim();

        const stand = document.getElementById("kopfStand");
        if (stand) {
            const platz = (document.getElementById("sbRank")?.textContent || "-").trim();
            const form = document.getElementById("sbForm")?.innerHTML || "";
            // Vor dem ersten Spiel stünden dort nur leere Kreise
            const gespielt = /form-dot (w|d|l)\b/.test(form);
            stand.innerHTML = `<span class="ks-platz" title="Tabellenplatz"><small>Platz</small><b>${this.escapeHtml(platz)}</b></span>${gespielt ? `<span class="ks-form form-indicators" title="Form">${form}</span>` : ""}`;
        }
    },

    /** Einstellung unter "Spielstand & Optionen" */
    renderMenueEinstellung() {
        const el = typeof document !== "undefined" && document.getElementById ? document.getElementById("settingsMenue") : null;
        if (!el) return;
        const aktuell = this.menueArt();
        el.innerHTML = Object.entries(this.MENUE_ARTEN).map(([key, m]) => `
            <label class="coach-switch einstellung-schalter">
                <input type="radio" name="menueArt" value="${key}" ${key === aktuell ? "checked" : ""}>
                <span class="coach-switch-text"><strong>${m.titel}</strong><br><span class="coach-muted">${m.text}</span></span>
            </label>`).join("");
        el.querySelectorAll("input[name=menueArt]").forEach(inp => inp.onchange = () => {
            this.setzeMenueArt(inp.value);
            this.showToast(`Menü: ${this.MENUE_ARTEN[inp.value].titel}`, "success");
        });
    }
});
