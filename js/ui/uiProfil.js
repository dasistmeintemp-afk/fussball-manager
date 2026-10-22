/**
 * Spielerprofil als eigene Seite, wie im Vorbild.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 * Die Akte war ein Fenster über dem Reiter. Jetzt ist sie eine Seite im
 * Inhaltsbereich (uiSeiten.js): Kopfleiste, Navigation und Weiter bleiben,
 * Zurück führt dorthin, wo man herkam - von einem Profil zum nächsten auch
 * zum vorigen Profil.
 *
 *   Kopf      - Rückennummer, Name, Position, Nation, Alter, Verein, Status,
 *               Marktwert, Gehalt, Vertragsende, Sterne für Stärke und
 *               Potenzial, das Menü Aktionen
 *   Übersicht - Positionen auf dem Feld, Rollen mit Sternen, die Werte in drei
 *               Spalten, Info und Eigenheiten, darunter Kacheln: Zufriedenheit,
 *               Fitness, Form, Disziplin, Training, Saison, Laufbahn
 *   Leistung, Laufbahn, Vergleich - eigene Reiter
 *
 * Inhalte und Knöpfe der Reiter Entwicklung und Vertrag baut weiter
 * showPlayerDetailsModal (uiAkten.js); diese Datei liefert Seite, Kopf und
 * die neuen Teile.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    // ------------------------------------------------------------ Kopf

    /** Wann der Vertrag endet: "30.06.2028" - Saisonende plus die Restjahre */
    vertragsEnde(player) {
        const state = this.app.state;
        const start = Number(String(state.calendar?.[0]?.date || "").slice(-4));
        if (!start || player?.contractYears === undefined || player?.contractYears === null) return null;
        const tag = state.calendar?.[state.currentDayIndex || 0];
        // In der Sommerpause ist das laufende Jahr schon abgezogen
        const jahr = start + (tag?.sommerpause ? 1 : 0) + Math.max(0, player.contractYears);
        return `30.06.${jahr}`;
    },

    /** Was oben neben dem Namen steht: Kaderrolle, Verletzung, Sperre, Leihe, Transferliste */
    profilStatus(player, eigen) {
        const marken = [];
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        if (eigen && player.squadRole) marken.push(["neutral", player.squadRole]);
        if (player.injuredWeeks > 0) marken.push(["schlecht", `Verletzt · ${player.injuredWeeks} Wo.`]);
        if (player.suspendedMatches > 0) marken.push(["schlecht", `Gesperrt · ${player.suspendedMatches} ${player.suspendedMatches === 1 ? "Spiel" : "Spiele"}`]);
        if (player.leihe) marken.push(["info", player.leihe.stammvereinId === this.app.state.userClubId ? "Verliehen" : "Leihspieler"]);
        if (player.reserve) marken.push(["info", player.reserve === "u19" ? "U19" : "U23"]);
        if (player.transferListed) marken.push(["warn", "Transferliste"]);
        if (player.vorvertrag) marken.push(["warn", `Vorvertrag · ${player.vorvertrag.clubName || ""}`]);
        if (!eigen && this.getScoutingEngine?.()?.istGemerkt?.(this.app.state, player.id)) marken.push(["info", "Beobachtungsliste"]);
        return marken.map(([ton, text]) => `<span class="pf-marke pf-${ton}">${esc(text)}</span>`).join("");
    },

    /**
     * Der Kopf der Seite. ctx: { player, club, card, isUserClub, isProspect,
     * klausel } - was showPlayerDetailsModal ohnehin gerechnet hat.
     */
    zeichneProfilKopf(ctx) {
        const { player, club, card, isUserClub, isProspect, klausel } = ctx;
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const setze = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; return el; };
        const eigen = !isProspect && player.clubId === state.userClubId;

        // Rückennummer: beim eigenen Spieler ein Knopf, der sie ändert
        if (eigen && club && typeof GameState.rueckennummern === "function") GameState.rueckennummern(state, club);
        const nr = Number.isInteger(player.trikot) ? player.trikot : null;
        const trikot = setze("pdTrikot", eigen
            ? `<button class="pd-nr" type="button" title="Rückennummer ändern">${nr ?? "–"}</button>`
            : `<span class="pd-nr pd-nr-fremd">${nr ?? esc(player.pos)}</span>`);
        const nrKnopf = trikot?.querySelector?.("button.pd-nr");
        if (nrKnopf) nrKnopf.onclick = () => this.zeigeNummernWahl(player.id, () => this.showPlayerDetailsModal(player.id));

        const titel = document.getElementById("pdPlayerName");
        if (titel) titel.textContent = player.name;

        const meta = this.getPositionEngine?.()?.POSITION_META || {};
        const positionen = [player.pos, ...(Array.isArray(player.positions) ? player.positions : [])].filter((p, i, a) => p && a.indexOf(p) === i);
        const nation = typeof PlayerGenerator !== "undefined" && typeof PlayerGenerator.landZuNation === "function" ? PlayerGenerator.landZuNation(player.nationality) : null;
        const verein = club
            ? `<button type="button" class="pf-verein" data-pf-verein="${esc(club.id)}">${this.wappenHtml(club, "pf-wappen")}<span>${esc(club.name)}</span></button>`
            : `<span class="pf-verein">${isProspect ? "Nachwuchs" : "vereinslos"}</span>`;
        const groesse = typeof MatchEngine !== "undefined" && MatchEngine.koerpergroesse ? `${(MatchEngine.koerpergroesse(player) / 100).toFixed(2).replace(".", ",")} m` : "";
        setze("pdKopfZeile", `
            <div class="pf-position">${esc(meta[player.pos]?.name || player.pos)} <span class="pf-codes">${positionen.map(p => esc(p)).join(" · ")}</span></div>
            <div class="pf-person">
                <span>${nation ? this.flaggeVon(nation) + " " : ""}${esc(player.nationality || "")}</span>
                <span>${player.age} Jahre</span>
                ${groesse ? `<span>${groesse}</span>` : ""}
                ${verein}
            </div>
            <div class="pf-marken">${this.profilStatus(player, eigen || isProspect)}${isProspect ? `<span class="pf-marke pf-info">Akademie</span>` : ""}</div>`);
        const vereinsKnopf = document.querySelector("#pdKopfZeile [data-pf-verein]");
        if (vereinsKnopf) vereinsKnopf.onclick = () => this.showClubDetailsModal(vereinsKnopf.dataset.pfVerein);

        // Marktwert, Gehalt, Vertrag - beim Talent der Jugendvertrag
        const ende = this.vertragsEnde(player);
        const daten = isProspect
            ? [["Vertrag", "Jugendvertrag"], ["Entwicklung", `${Math.round((player.developmentRate || 1) * 100)} %`]]
            : [["Marktwert", card ? card.visibleValueText : this.geldKurz(player.value || 0)],
                ["Gehalt", `${this.geldKurz(player.wage || 0)} / Wo.`],
                ["Vertrag bis", player.clubId ? (ende || `${player.contractYears} J.`) : "–"],
                ...(klausel ? [["Ausstiegsklausel", this.geldKurz(klausel)]] : [])];
        // Wie im Vorbild: das Land mit Länderspielen und Toren
        const flagge = nation ? this.flaggeVon(nation) : "";
        const land = player.nationality
            ? `<div class="pf-datum pf-land"><span>${flagge} ${esc(player.nationality)}</span><strong>${player.laenderspiele ? `${player.laenderspiele} Spiele · ${player.laenderspielTore || 0} Tore` : "ohne Länderspiel"}</strong></div>` : "";
        setze("pdKopfDaten", daten.map(([l, w]) => `<div class="pf-datum"><span>${esc(l)}</span><strong>${esc(w)}</strong></div>`).join("") + land);

        // Sterne: Stärke heute und Potenzial, wie im Vorbild getrennt
        setze("pdKopfSterne", card ? `
            <div class="pf-sterne"><span>Stärke</span><div class="pf-sternreihe">${card.starsCaHtml}</div><small>${esc(card.abilityLabel || "")}</small></div>
            <div class="pf-sterne"><span>Potenzial</span><div class="pf-sternreihe">${card.starsPaHtml}</div><small>${esc(card.potentialKlasse || card.potentialLabel || "")}</small></div>` : "");
    },

    /**
     * Das Menü Aktionen, wie im Vorbild nach Themen gruppiert: was man mit
     * dem Spieler tun kann. Ein Eintrag führt zu einem Reiter, drückt einen
     * Knopf, den die Seite schon hat - so gibt es jede Handlung nur einmal -,
     * oder ruft eine eigene Aktion auf (Verfügbarkeit erfragen, ähnliche
     * Spieler suchen, Vereinsseite).
     */
    profilAktionen(ctx, body) {
        const { player, club, card, isUserClub, isProspect } = ctx;
        const eigen = isUserClub && !isProspect;
        const da = (sel) => !!body.querySelector(sel);
        const fremdImVerein = !isUserClub && !isProspect && !!player.clubId;
        const gruppen = [
            { titel: "Vertrag", eintraege: [
                eigen && da("#btnSubmitExtension") ? { text: "Vertrag verlängern", icon: "i-doc", reiter: "vertrag", ziel: "#pdVertrag" } : null,
                isProspect && da("#btnPdPromoteProspect") ? { text: "Profivertrag anbieten", icon: "i-doc", knopf: "#btnPdPromoteProspect" } : null,
                eigen && da("#btnPdZurLeihe") ? { text: "Verleihen", icon: "i-transfer", reiter: "entwicklung", ziel: "#btnPdZurLeihe" } : null
            ] },
            { titel: "Kabine", eintraege: [
                eigen && da("[data-gespraech]") ? { text: "Gespräch unter vier Augen", icon: "i-chat", reiter: "vertrag", ziel: "[data-gespraech]" } : null,
                eigen ? { text: "Rückennummer ändern", icon: "i-edit", knopf: "#pdTrikot button.pd-nr", ausserhalb: true } : null
            ] },
            { titel: "Training", eintraege: [
                eigen && da("[data-pd-reiter='entwicklung']") ? { text: "Entwicklung planen", icon: "i-dumbbell", reiter: "entwicklung" } : null
            ] },
            { titel: "Transfer", eintraege: [
                da("#btnPdBidPlayer") ? { text: player.clubId ? "Transfer verhandeln" : "Vertrag anbieten", icon: "i-briefcase", knopf: "#btnPdBidPlayer" } : null,
                da("#btnPdAusleihen") ? { text: "Ausleihen", icon: "i-transfer", knopf: "#btnPdAusleihen" } : null,
                da("#btnPdVorvertrag") ? { text: "Vorvertrag anbieten", icon: "i-edit", knopf: "#btnPdVorvertrag" } : null,
                da("#btnPdKlausel") ? { text: "Ausstiegsklausel ziehen", icon: "i-bolt", knopf: "#btnPdKlausel" } : null,
                fremdImVerein && typeof TransferEngine !== "undefined" && typeof TransferEngine.verfuegbarkeit === "function"
                    ? { text: "Verfügbarkeit erfragen", icon: "i-chat", aktion: () => this.zeigeVerfuegbarkeit(player, body) } : null
            ] },
            { titel: "Scouting", eintraege: [
                da("#btnPdScoutPlayer:not([disabled])") ? { text: "Scouten", icon: "i-search", knopf: "#btnPdScoutPlayer" } : null,
                da("#btnPdMerken") ? { text: body.querySelector("#btnPdMerken")?.textContent?.trim() || "Beobachtungsliste", icon: "i-star", knopf: "#btnPdMerken" } : null,
                isProspect ? null : { text: eigen ? "Ersatz suchen" : "Ähnliche Spieler suchen", icon: "i-search", aktion: () => this.sucheAehnlicheSpieler(player, card) }
            ] },
            { titel: "Mehr", eintraege: [
                da("[data-pd-reiter='vergleich']") ? { text: "Mit anderem vergleichen", icon: "i-chart", reiter: "vergleich" } : null,
                da("[data-pd-reiter='laufbahn']") ? { text: "Laufbahn ansehen", icon: "i-trophy", reiter: "laufbahn" } : null,
                club && !isUserClub ? { text: `Zum Verein: ${club.name}`, icon: "i-shield", aktion: () => this.showClubDetailsModal(club.id) } : null
            ] }
        ];
        return gruppen.map(g => ({ titel: g.titel, eintraege: g.eintraege.filter(Boolean) })).filter(g => g.eintraege.length);
    },

    zeichneProfilAktionen(ctx, body) {
        const ort = document.getElementById("pdAktionen");
        if (!ort) return;
        const gruppen = this.profilAktionen(ctx, body);
        if (!gruppen.length) { ort.innerHTML = ""; return; }
        const liste = gruppen.flatMap(g => g.eintraege);
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        ort.innerHTML = `<button type="button" class="btn btn-primary btn-sm pf-aktionen-knopf" aria-haspopup="menu" aria-expanded="false"><svg class="ico" aria-hidden="true"><use href="#i-user"/></svg>Aktionen <svg class="ico pf-pfeil" aria-hidden="true"><use href="#i-chevron-down"/></svg></button>`;
        const knopf = ort.querySelector("button");
        knopf.onclick = (e) => {
            e.stopPropagation();
            if (this.schliesseKontextmenue?.()) { knopf.setAttribute("aria-expanded", "false"); return; }
            const menue = document.createElement("div");
            menue.className = "kontextmenue pf-aktionen-menue";
            menue.setAttribute("role", "menu");
            let i = 0;
            menue.innerHTML = gruppen.map(g => `
                <div class="km-gruppe" role="presentation">${esc(g.titel)}</div>
                ${g.eintraege.map(a => `<button type="button" role="menuitem" class="km-eintrag" data-pf-akt="${i++}"><svg class="ico" aria-hidden="true"><use href="#${a.icon}"/></svg>${esc(a.text)}</button>`).join("")}`).join("");
            document.body.appendChild(menue);
            const r = knopf.getBoundingClientRect(), m = menue.getBoundingClientRect();
            menue.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - m.width - 8))}px`;
            menue.style.top = `${Math.max(8, Math.min(r.bottom + 6, window.innerHeight - m.height - 8))}px`;
            knopf.setAttribute("aria-expanded", "true");
            menue.addEventListener("click", (ev) => {
                const k = ev.target.closest("[data-pf-akt]");
                if (!k) return;
                this.schliesseKontextmenue();
                knopf.setAttribute("aria-expanded", "false");
                this.fuehreProfilAktionAus(liste[Number(k.dataset.pfAkt)], body);
            });
            menue.querySelector("[data-pf-akt]")?.focus({ preventScroll: true });
        };
    },

    fuehreProfilAktionAus(a, body) {
        if (!a) return;
        if (typeof a.aktion === "function") { a.aktion(); return; }
        if (a.reiter) body.querySelector(`[data-pd-reiter="${a.reiter}"]`)?.click();
        const ziel = a.ziel ? body.querySelector(a.ziel) : null;
        if (ziel) {
            ziel.scrollIntoView?.({ behavior: "smooth", block: "center" });
            if (typeof this.hebeHervor === "function") this.hebeHervor(ziel.closest(".dash-card") || ziel);
        }
        if (a.knopf) (a.ausserhalb ? document.querySelector(a.knopf) : body.querySelector(a.knopf))?.click();
    },

    /**
     * Verfügbarkeit erfragen: Die Antwort des Vereins steht oben im Reiter
     * Vertrag & Transfer, mit den Knöpfen für den nächsten Schritt. Sie gilt
     * für diese Sitzung - wer noch einmal fragt, bekommt dieselbe Antwort.
     */
    zeigeVerfuegbarkeit(player, body) {
        const v = TransferEngine.verfuegbarkeit(this.app.state, player);
        if (!v) return;
        this._verfuegbarkeit = this._verfuegbarkeit || {};
        this._verfuegbarkeit[player.id] = v;
        body.querySelector('[data-pd-reiter="vertrag"]')?.click();
        const reiter = body.querySelector('[data-pd-tab="vertrag"]');
        if (!reiter) return;
        reiter.querySelector(".pf-anfrage")?.remove();
        reiter.insertAdjacentHTML("afterbegin", this.verfuegbarkeitHtml(v));
        const karte = reiter.querySelector(".pf-anfrage");
        karte?.querySelectorAll("[data-pf-weiter]").forEach(b => {
            b.onclick = () => body.querySelector(b.dataset.pfWeiter)?.click();
        });
        karte?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        if (typeof this.hebeHervor === "function" && karte) this.hebeHervor(karte);
    },

    verfuegbarkeitHtml(v) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const ton = { frei: "gut", verkauf: "gut", gespraechsbereit: "gut", offen: "mittel", schluessel: "schlecht", vergeben: "schlecht" }[v.stufe] || "mittel";
        const weiter = [
            v.stufe !== "vergeben" ? ["#btnPdBidPlayer", v.stufe === "frei" ? "Vertrag anbieten" : "Transfer verhandeln"] : null,
            v.stufe !== "vergeben" && v.stufe !== "frei" ? ["#btnPdAusleihen", "Ausleihen"] : null
        ].filter(Boolean);
        return `
            <div class="dash-card pf-karte pf-anfrage pf-anfrage-${ton}">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-chat"/></svg>Anfrage beim Verein</h4>
                <div class="pf-gross pf-ton-${ton}">${esc(v.titel)}</div>
                <p>${esc(v.text)}</p>
                ${v.hinweise.length ? `<ul class="pf-hinweise">${v.hinweise.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
                ${weiter.length ? `<div class="pf-anfrage-knoepfe">${weiter.map(([sel, text]) => `<button type="button" class="btn btn-secondary btn-sm" data-pf-weiter="${esc(sel)}">${esc(text)}</button>`).join("")}</div>` : ""}
            </div>`;
    },

    /**
     * Ähnliche Spieler suchen: der Transfermarkt mit Position, Alter und
     * Stärke dieses Spielers als Filter - beim eigenen Spieler die Suche
     * nach einem Ersatz.
     */
    sucheAehnlicheSpieler(player, card) {
        this.switchTab("transfers");
        document.getElementById("btnSubTransfersMarket")?.click();
        const setze = (id, wert) => {
            const el = document.getElementById(id);
            if (el && [...(el.options || [])].some(o => o.value === wert)) el.value = wert;
        };
        const alter = player.age || 25;
        const band = alter <= 21 ? "0-21" : (alter <= 25 ? "0-25" : (alter <= 30 ? "26-30" : "31-99"));
        const sterne = Number(card?.starsCa) || 0;
        const stufe = [4.5, 4, 3.5, 3].find(s => s <= sterne - 0.5) || 0;
        const suche = document.getElementById("tfSearch");
        if (suche) suche.value = "";
        setze("tfPosFilter", player.pos);
        setze("tfAlterFilter", band);
        setze("tfRatingFilter", String(stufe));
        setze("tfSortierung", "staerke");
        if (typeof this.renderTransfers === "function") this.renderTransfers();
        this.showToast?.(`Ähnlich wie ${player.name}: ${player.pos}, ${band.replace("0-", "bis ").replace("31-99", "ab 31").replace("-", " bis ")} Jahre${stufe ? `, ab ★ ${String(stufe).replace(".", ",")}` : ""}`, "info");
    },

    // ------------------------------------------------------------ Übersicht

    /** Wo die Positionen auf dem Feld liegen (x, y in Prozent; oben greift man an) */
    PROFIL_FELD: {
        ST: [50, 11], LA: [17, 19], RA: [83, 19], OM: [50, 31], LM: [13, 45], ZM: [50, 47], RM: [87, 45],
        DM: [50, 62], LV: [13, 73], IV: [50, 77], RV: [87, 73], TW: [50, 92]
    },

    /** Die Positionen auf einem Feld, gefärbt nach Vertrautheit - dazu die Rollen mit Sternen */
    profilPositionenHtml(player, confidence, card, roleStarsHtml) {
        const posEngine = this.getPositionEngine?.();
        if (!posEngine) return "";
        // Bei wenig Scoutwissen mit der geschätzten Stärke - die echte bleibt verborgen
        let basis = player;
        if (confidence < 85 && card?.estimatedCa) {
            const r = this.getRatingEngine?.();
            if (r) basis = { ...player, overall: r.abilityToOverall(Math.round((card.estimatedCa.min + card.estimatedCa.max) / 2)) };
        }
        const ranking = posEngine.getPositionRanking(basis);
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const neben = new Set(Array.isArray(player.positions) ? player.positions : []);
        const punkte = ranking.map(r => {
            const ort = this.PROFIL_FELD[r.position];
            if (!ort) return "";
            const stamm = r.position === player.pos;
            const art = stamm ? "stamm" : (r.familiarity >= 0.55 ? "gut" : (r.familiarity >= 0.3 ? "geht" : "fremd"));
            const titel = `${r.positionName || r.position}: ${stamm ? "Stammposition" : (neben.has(r.position) ? "Nebenposition" : r.label)} · ${r.familiarityPercent} % Vertrautheit${art !== "fremd" ? ` · ${r.effectiveOverall}` : ""}`;
            // Beschriftet nur, wo er wirklich spielen kann - sonst ein Punkt in der Farbe der Eignung
            const schrift = art === "stamm" || art === "gut";
            return `<span class="pf-feld-punkt pf-${art}" style="left:${ort[0]}%;top:${ort[1]}%;${art !== "fremd" ? `--pf-farbe:${r.color};` : ""}" title="${esc(titel)}">${schrift ? esc(r.position) : ""}</span>`;
        }).join("");
        const nutzbar = ranking.filter(r => r.familiarity >= 0.55).slice(0, 4);
        const liste = nutzbar.map(r => `<div class="pf-pos-zeile"><span class="pf-pos-code" style="--pf-farbe:${r.color}">${esc(r.position)}</span><span>${esc(r.position === player.pos ? "Stammposition" : (neben.has(r.position) ? "Nebenposition" : r.label))}</span><span class="pf-pos-sterne">${this.starsFor(r.effectiveOverall, { color: r.color })}</span></div>`).join("");
        const rollen = (card?.allRoles || []).map(r => `<div class="pf-rolle"><span>${esc(r.role)}</span><span class="role-stars">${roleStarsHtml(r) || ""}</span></div>`).join("");
        return `
            <div class="dash-card pf-karte pf-positionen">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-pin"/></svg>Positionen</h4>
                <div class="pf-feld${confidence < 85 ? " estimated-value" : ""}" role="img" aria-label="Positionen auf dem Feld">
                    <svg class="pf-feld-linien" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
                        <rect x="1" y="1" width="66" height="103" rx="1"/><line x1="1" y1="52.5" x2="67" y2="52.5"/><circle cx="34" cy="52.5" r="9"/>
                        <rect x="14" y="1" width="40" height="16"/><rect x="14" y="88" width="40" height="16"/>
                    </svg>
                    ${punkte}
                </div>
                <div class="pf-pos-liste">${liste}</div>
                ${rollen ? `<h4 class="gs-titel pf-unter">Rollen</h4><div class="pf-rollen">${rollen}</div>` : ""}
            </div>`;
    },

    /** Persönlichkeit in einem Wort - erst, wenn der Scout ihn kennt (dieselben Schwellen wie die Beobachtungen) */
    persoenlichkeitWort(player, confidence) {
        if (confidence < 35) return "noch unbekannt";
        const h = player.hiddenAttributes || {};
        const v = (k) => h[k] ?? 12;
        if (v("professionalism") >= 16 && v("ambition") >= 16) return "Musterprofi";
        if (v("professionalism") >= 16) return "Vorzeigeprofi";
        if (v("ambition") >= 16) return "Ehrgeizig";
        if (confidence >= 75 && v("loyalty") >= 16) return "Vereinstreu";
        if (confidence >= 55 && v("importantMatches") >= 16) return "Nervenstark";
        if (v("professionalism") <= 8) return "Lässig";
        if (v("ambition") <= 8) return "Genügsam";
        if (confidence >= 75 && v("consistency") <= 8) return "Launisch";
        return "Ausgeglichen";
    },

    /** Wie bekannt er ist: nach seinem Marktwert unter allen Spielern der Welt */
    bekanntheitWort(player) {
        const state = this.app.state;
        const tag = `${state.seasonYear}|${state.currentDayIndex}|${(state.players || []).length}`;
        if (!this._wertSkala || this._wertSkala.tag !== tag) {
            const werte = (state.players || []).filter(p => p.clubId).map(p => p.value || 0).sort((a, b) => b - a);
            this._wertSkala = { tag, grenzen: [0.005, 0.03, 0.12, 0.35].map(q => werte[Math.floor(q * werte.length)] || 0) };
        }
        const w = player.value || 0;
        const [welt, inter, land, region] = this._wertSkala.grenzen;
        return w >= welt ? "Weltweit bekannt" : w >= inter ? "International bekannt" : w >= land ? "Landesweit bekannt" : w >= region ? "Regional bekannt" : "Kaum bekannt";
    },

    /** Info: Größe, Füße, Persönlichkeit, Bekanntheit, im Verein seit */
    profilInfoHtml(player, ctx) {
        const { confidence, isProspect } = ctx;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const fuss = player.foot === "beidfüßig" ? "Beidfüßig" : (player.foot ? `${player.foot[0].toUpperCase()}${player.foot.slice(1)}` : "–");
        const zeilen = [
            ["Größe", typeof MatchEngine !== "undefined" && MatchEngine.koerpergroesse ? `${(MatchEngine.koerpergroesse(player) / 100).toFixed(2).replace(".", ",")} m` : "–"],
            player.foot ? ["Starker Fuß", fuss] : null,
            ["Persönlichkeit", this.persoenlichkeitWort(player, confidence)],
            isProspect ? null : ["Bekanntheit", this.bekanntheitWort(player)],
            player.vereinSeit && player.clubId ? ["Im Verein seit", `Saison ${player.vereinSeit}`] : null,
            player.laenderspiele ? ["Länderspiele", `${player.laenderspiele} (${player.laenderspielTore || 0} Tore)`] : null
        ].filter(Boolean);
        return `
            <div class="dash-card pf-karte pf-info">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-info"/></svg>Info</h4>
                ${zeilen.map(([l, w]) => `<div class="pf-zeile"><span>${esc(l)}</span><strong>${esc(w)}</strong></div>`).join("")}
            </div>`;
    },

    // ------------------------------------------------------------ Form

    /** Die letzten Ligaspiele mit Note - aus den Partien der eigenen Liga (dort stehen die Noten) */
    profilFormDaten(player, max = 10) {
        const state = this.app.state;
        const id = String(player?.id);
        const liste = [];
        const name = (cid) => (state.clubs || []).find(c => c.id === cid)?.name || "";
        (state.schedule || []).forEach(t => (t.matches || []).forEach(m => {
            if (!m.played || !Array.isArray(m.playerRatings)) return;
            const r = m.playerRatings.find(x => String(x.playerId) === id);
            if (!r || !(r.minutes > 0) || !(r.rating > 0)) return;
            const heim = r.clubId === m.homeClubId;
            liste.push({
                spieltag: t.matchday, note: r.rating, tore: r.goals || 0, vorlagen: r.assists || 0, minuten: r.minutes,
                gegner: name(heim ? m.awayClubId : m.homeClubId), heim, ergebnis: `${m.homeGoals}:${m.awayGoals}`
            });
        }));
        return liste.slice(-max);
    },

    /**
     * Die Formkurve: Noten der letzten Spiele als Linie, die 7,0 als
     * gestrichelte Bezugslinie. Eine Reihe, eine Achse; die Punkte liegen als
     * HTML über der Linie, damit sie bei jeder Breite rund bleiben, und tragen
     * die Note jedes Spiels im Tooltip.
     */
    formKurveHtml(daten, { hoch = 90 } = {}) {
        if (!daten.length) return "";
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const komma = (z) => z.toFixed(1).replace(".", ",");
        const noten = daten.map(d => d.note);
        const unten = Math.min(6, Math.floor(Math.min(...noten) * 2) / 2 - 0.5);
        const oben = Math.max(8.5, Math.ceil(Math.max(...noten) * 2) / 2 + 0.5);
        const n = daten.length;
        const x = (i) => n === 1 ? 50 : 3 + i * 94 / (n - 1);
        const y = (note) => (oben - note) / (oben - unten) * 100;
        const bezug = y(7).toFixed(1);
        const ton = (note) => note >= 7.5 ? " pf-stark" : (note < 6.3 ? " pf-schwach" : "");
        return `
            <div class="pf-formkurve" style="height:${hoch}px" role="img" aria-label="Noten der letzten ${n} Spiele: ${esc(noten.map(komma).join(", "))}">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <line class="pf-bezug" x1="0" x2="100" y1="${bezug}" y2="${bezug}"/>
                    ${n > 1 ? `<polyline class="pf-linie" points="${daten.map((d, i) => `${x(i).toFixed(1)},${y(d.note).toFixed(1)}`).join(" ")}"/>` : ""}
                </svg>
                <span class="pf-bezug-text" style="top:${bezug}%">7,0</span>
                ${daten.map((d, i) => `<span class="pf-punkt${ton(d.note)}" style="left:${x(i).toFixed(1)}%;top:${y(d.note).toFixed(1)}%" title="${esc(`${d.spieltag}. Spieltag, ${d.heim ? "gegen" : "bei"} ${d.gegner} ${d.ergebnis}: Note ${komma(d.note)}${d.tore ? `, ${d.tore} Tor${d.tore > 1 ? "e" : ""}` : ""}${d.vorlagen ? `, ${d.vorlagen} Vorlage${d.vorlagen > 1 ? "n" : ""}` : ""}`)}"></span>`).join("")}
            </div>`;
    },

    // ------------------------------------------------------------ Kacheln

    /** Ein Balken für Prozentwerte in den Kacheln */
    _pfBalken(wert) {
        const w = Math.max(0, Math.min(100, Math.round(wert)));
        return `<span class="kb-balken pf-balken"><i class="kb-${w >= 70 ? "gut" : (w >= 45 ? "mittel" : "schlecht")}" style="width:${w}%"></i></span>`;
    },

    profilKachelnHtml(player, ctx) {
        const { isUserClub, isProspect, confidence, confInfo } = ctx;
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const komma = (z, s = 2) => Number(z).toFixed(s).replace(".", ",");
        const kachel = (titel, icon, inhalt, klasse = "") => `
            <div class="dash-card pf-kachel ${klasse}">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#${icon}"/></svg>${esc(titel)}</h4>
                ${inhalt}
            </div>`;
        const zeile = (l, w, extra = "") => `<div class="pf-zeile"><span>${esc(l)}</span><strong>${w}</strong></div>${extra}`;
        const kacheln = [];

        // Zufriedenheit - beim eigenen Spieler; beim fremden: was der Scout weiß
        if (isUserClub) {
            const happy = player.happiness || { overall: 75, playingTime: 75, contract: 75, teamPerformance: 75 };
            const g = Math.round(happy.overall ?? 75);
            const wort = g >= 85 ? "Sehr zufrieden" : g >= 70 ? "Zufrieden" : g >= 55 ? "Geht so" : g >= 40 ? "Unzufrieden" : "Sehr unzufrieden";
            kacheln.push(kachel("Zufriedenheit", "i-user", `
                <div class="pf-gross pf-ton-${g >= 70 ? "gut" : (g >= 55 ? "mittel" : "schlecht")}">${wort}</div>
                ${isProspect ? "" : zeile("Spielzeit", `${Math.round(happy.playingTime ?? 75)} %`, this._pfBalken(happy.playingTime ?? 75))}
                ${isProspect ? "" : zeile("Vertrag", `${Math.round(happy.contract ?? 75)} %`, this._pfBalken(happy.contract ?? 75))}
                ${zeile("Moral", `${Math.round(player.morale ?? 75)} %`, this._pfBalken(player.morale ?? 75))}
                ${happy.reason ? `<p class="pf-klein">„${esc(happy.reason)}“</p>` : ""}`));
        } else {
            const pct = Math.max(0, Math.min(100, Math.round(confidence)));
            kacheln.push(kachel("Scoutwissen", "i-search", `
                <div class="pf-gross" style="color:${confInfo?.color || "inherit"}">${esc(confInfo?.label || "Unbekannt")}</div>
                ${zeile("Kenntnis", `${pct} %`, this._pfBalken(pct))}
                <p class="pf-klein">${esc(confInfo?.hint || "")}${this.beobachtungsText?.(player.id) ? ` Bericht ${esc(this.beobachtungsText(player.id))}.` : ""}</p>`));
        }

        // Fitness: Kondition, Spielpraxis, Verletzung, Anfälligkeit
        const praxis = typeof player.spielpraxis === "number" ? Math.round(player.spielpraxis * 100) : (player.matchSharpness ?? null);
        const anf = player.hiddenAttributes?.injuryProneness;
        kacheln.push(kachel("Fitness", "i-medical", `
            <div class="pf-gross pf-ton-${player.injuredWeeks > 0 ? "schlecht" : ((player.fitness ?? 95) >= 75 ? "gut" : "mittel")}">${player.injuredWeeks > 0 ? `Verletzt · ${player.injuredWeeks} Wo.` : ((player.fitness ?? 95) >= 90 ? "Topfit" : ((player.fitness ?? 95) >= 75 ? "Einsatzbereit" : "Müde"))}</div>
            ${player.injuredWeeks > 0 && player.injuryName ? `<p class="pf-klein">${esc(player.injuryName)}</p>` : ""}
            ${zeile("Kondition", `${Math.round(player.fitness ?? 95)} %`, this._pfBalken(player.fitness ?? 95))}
            ${praxis !== null ? zeile("Spielpraxis", `${Math.round(praxis)} %`, this._pfBalken(praxis)) : ""}
            ${typeof anf === "number" && (isUserClub || confidence >= 55) ? zeile("Anfälligkeit", anf >= 14 ? "eher ja" : (anf <= 6 ? "kaum" : "normal")) : ""}`));

        // Form: die letzten Ligaspiele
        if (!isProspect) {
            const daten = this.profilFormDaten(player, 6);
            const schnitt = daten.length ? daten.reduce((s, d) => s + d.note, 0) / daten.length : null;
            kacheln.push(kachel("Form", "i-chart", daten.length ? `
                <div class="pf-gross">${komma(schnitt)} <small>Schnitt der letzten ${daten.length}</small></div>
                ${this.formKurveHtml(daten, { hoch: 70 })}
                <div class="pf-noten">${daten.map(d => `<span class="pf-note${d.note >= 7.5 ? " pf-stark" : (d.note < 6.3 ? " pf-schwach" : "")}" title="${esc(`${d.heim ? "gegen" : "bei"} ${d.gegner} ${d.ergebnis}`)}">${komma(d.note, 1)}</span>`).join("")}</div>`
                : `<div class="pf-gross">${komma(player.form ?? 7, 1)}</div><p class="pf-klein">Laufende Form. Die Noten der einzelnen Spiele stehen hier für Spieler der eigenen Liga, sobald sie gespielt haben.</p>`));
        }

        // Disziplin: Karten und Sperren
        if (!isProspect) {
            // Karten zählt nur die Gesamtstatistik (alle Pflichtspiele); jede fünfte Gelbe sperrt
            const s = player.stats || {};
            const gelb = s.yellowCards || 0, rot = s.redCards || 0;
            const bisSperre = 5 - ((player.yellowCardsTotal || 0) % 5);
            kacheln.push(kachel("Disziplin", "i-alert", `
                <div class="pf-gross pf-ton-${player.suspendedMatches > 0 ? "schlecht" : (rot || bisSperre === 1 ? "mittel" : "gut")}">${player.suspendedMatches > 0 ? `Gesperrt · ${player.suspendedMatches} ${player.suspendedMatches === 1 ? "Spiel" : "Spiele"}` : "Spielberechtigt"}</div>
                <div class="pf-karten"><span class="pf-karte-gelb" aria-hidden="true"></span><strong>${gelb}</strong><span>Gelb</span><span class="pf-karte-rot" aria-hidden="true"></span><strong>${rot}</strong><span>Rot</span></div>
                ${zeile("Bis zur Gelbsperre", `${bisSperre} ${bisSperre === 1 ? "Karte" : "Karten"}`)}`));
        }

        // Training - nur beim eigenen Spieler sichtbar
        if (isUserClub && !isProspect) {
            const plan = this.getDevelopmentPlanEngine?.();
            const gen = typeof PlayerGenerator !== "undefined" ? PlayerGenerator : null;
            const log = player.trainingLog || {};
            const last = log.load ?? null;
            const mentor = player.mentorId ? (state.players || []).find(p => String(p.id) === String(player.mentorId)) : null;
            kacheln.push(kachel("Training", "i-dumbbell", `
                ${zeile("Schwerpunkt", esc(plan?.SCHWERPUNKTE?.[player.trainingsfokus]?.label || "Mannschaft"))}
                ${player.feinschliff && gen?.DETAILWERTE?.[player.feinschliff] ? zeile("Feinschliff", esc(gen.DETAILWERTE[player.feinschliff].name)) : ""}
                ${player.umschulung ? zeile("Umschulung", `${esc(player.umschulung.pos)} · ${plan?.umschulungsStand?.(player) ?? 0} %`) : ""}
                ${player.eigenheitTraining?.key && plan?.eigenheitText ? zeile("Eigenheit", esc(plan.eigenheitText(player.eigenheitTraining.key))) : ""}
                ${mentor ? zeile("Mentor", esc(mentor.name)) : ""}
                ${last !== null ? zeile("Belastung", last >= 7 ? "hoch" : (last >= 4 ? "normal" : "gering")) : ""}
                ${log.sessions ? zeile("Einheiten", String(log.sessions)) : ""}
                ${log.sessions ? zeile("Fortschritt", `${log.gain >= 0 ? "+" : "−"}${komma(Math.abs(log.gain || 0), 1)} Stärke`) : ""}`));
        }

        // Saison nach Wettbewerb
        const statistik = typeof StatistikEngine !== "undefined" ? StatistikEngine : null;
        if (!isProspect && statistik) {
            const teile = [["liga", "Liga"], ["pokal", "Pokal"], ["europa", "Europa"]].map(([art, name]) => ({ name, s: statistik.von(player, art) }))
                .filter((t, i) => i === 0 || t.s.matches > 0);
            const note = (s) => s.matches > 0 && s.ratingSum ? komma(s.ratingSum / s.matches) : "–";
            kacheln.push(kachel("Saison", "i-table", `
                <table class="compact-table pf-tabelle">
                    <thead><tr><th></th><th>Sp</th><th>T</th><th>V</th><th>Note</th></tr></thead>
                    <tbody>${teile.map(t => `<tr><td>${t.name}</td><td>${t.s.matches}</td><td>${t.s.goals}</td><td>${t.s.assists}</td><td>${note(t.s)}</td></tr>`).join("")}</tbody>
                </table>`, "pf-breit"));
        }

        // Laufbahn in Summe
        const lb = typeof LaufbahnEngine !== "undefined" && !isProspect ? LaufbahnEngine.tabelle(state, player) : null;
        if (lb && lb.zeilen.length) {
            const vereine = new Set(lb.zeilen.map(z => z.verein)).size;
            kacheln.push(kachel("Laufbahn", "i-trophy", `
                <div class="pf-zahlen">
                    <div><strong>${lb.summe.spiele}</strong><span>Spiele</span></div>
                    <div><strong>${lb.summe.tore}</strong><span>Tore</span></div>
                    <div><strong>${lb.summe.vorlagen}</strong><span>Vorlagen</span></div>
                    <div><strong>${lb.summe.note ? komma(lb.summe.note) : "–"}</strong><span>Note</span></div>
                </div>
                <p class="pf-klein">${lb.zeilen.length} ${lb.zeilen.length === 1 ? "Saison" : "Saisons"} bei ${vereine} ${vereine === 1 ? "Verein" : "Vereinen"}${(player.auszeichnungen || []).length ? ` · ${player.auszeichnungen.length} Auszeichnung${player.auszeichnungen.length === 1 ? "" : "en"}` : ""}.</p>`));
        }
        return `<div class="pf-kacheln">${kacheln.join("")}</div>`;
    },

    // ------------------------------------------------------------ Leistung

    /** Der Reiter Leistung: Saison je Wettbewerb ausführlich, Formkurve, Daten je 90 Minuten */
    profilLeistungHtml(player) {
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const komma = (z, s = 2) => (z === null || z === undefined) ? "–" : Number(z).toFixed(s).replace(".", ",");
        const statistik = typeof StatistikEngine !== "undefined" ? StatistikEngine : null;
        const teile = statistik ? [["liga", "Liga"], ["pokal", "Pokal"], ["europa", "Europapokal"]].map(([art, name]) => ({ name, s: statistik.von(player, art) })) : [];
        // Karten gibt es nur in Summe über alle Pflichtspiele
        const gesamt = statistik ? { ...statistik.von(player, "alle"), yellowCards: player.stats?.yellowCards || 0, redCards: player.stats?.redCards || 0 } : {};
        const reihe = (name, s, klasse = "") => `<tr class="${klasse}"><td>${esc(name)}</td><td>${s.matches || 0}</td><td>${s.minutes || 0}</td><td>${s.goals || 0}</td><td>${s.assists || 0}</td>${player.pos === "TW" ? `<td>${s.cleanSheets || 0}</td>` : ""}<td>${s.yellowCards ?? "–"}</td><td>${s.redCards ?? "–"}</td><td>${s.matches && s.ratingSum ? komma(s.ratingSum / s.matches) : "–"}</td></tr>`;
        const daten = this.profilFormDaten(player, 10);

        // Je 90 Minuten - aus den Partien der eigenen Liga (Datenzentrale)
        const dz = typeof DatenzentraleEngine !== "undefined" ? DatenzentraleEngine : null;
        const werte = dz && player.clubId ? (dz.spieler(state, player.clubId) || []).find(e => String(e.id) === String(player.id)) : null;
        const je90 = werte ? [
            ["Minuten", werte.minuten], ["Schüsse", werte.schuesse], ["xG", komma(werte.xg)],
            ["Tore je 90", komma(werte.toreJe90)], ["Vorlagen je 90", komma(werte.vorlagenJe90)],
            ["Schüsse je 90", komma(werte.schuesseJe90)], ["xG je 90", komma(werte.xgJe90)]
        ].filter(([, w]) => w !== undefined) : [];
        return `
            <div class="pf-leistung">
                <div class="dash-card pf-karte">
                    <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-table"/></svg>Saison ${state.seasonYear || 1}</h4>
                    <div class="table-container"><table class="compact-table pf-tabelle">
                        <thead><tr><th>Wettbewerb</th><th>Sp</th><th>Min</th><th>T</th><th>V</th>${player.pos === "TW" ? "<th>Zu null</th>" : ""}<th>Gelb</th><th>Rot</th><th>Note</th></tr></thead>
                        <tbody>${teile.map(t => reihe(t.name, t.s)).join("")}${reihe("Gesamt", gesamt, "pf-summe")}</tbody>
                    </table></div>
                </div>
                <div class="dash-card pf-karte">
                    <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-chart"/></svg>Form der letzten ${daten.length || ""} Ligaspiele</h4>
                    ${daten.length ? `${this.formKurveHtml(daten, { hoch: 120 })}
                    <div class="table-container"><table class="compact-table pf-tabelle">
                        <thead><tr><th>ST</th><th class="pf-links-text">Gegner</th><th>Erg.</th><th>Min</th><th>T</th><th>V</th><th>Note</th></tr></thead>
                        <tbody>${daten.slice().reverse().map(d => `<tr><td>${d.spieltag}</td><td class="pf-links-text">${d.heim ? "" : "bei "}${esc(d.gegner)}</td><td>${esc(d.ergebnis)}</td><td>${d.minuten}</td><td>${d.tore || ""}</td><td>${d.vorlagen || ""}</td><td><span class="pf-note${d.note >= 7.5 ? " pf-stark" : (d.note < 6.3 ? " pf-schwach" : "")}">${komma(d.note, 1)}</span></td></tr>`).join("")}</tbody>
                    </table></div>` : `<p class="pf-klein">Noten einzelner Spiele gibt es für Spieler der eigenen Liga, sobald sie gespielt haben. Laufende Form: <strong>${komma(player.form ?? 7, 1)}</strong>.</p>`}
                </div>
                ${je90.length ? `
                <div class="dash-card pf-karte">
                    <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-target"/></svg>Je 90 Minuten (Liga)</h4>
                    <div class="pf-zahlen pf-zahlen-viele">${je90.map(([l, w]) => `<div><strong>${esc(w)}</strong><span>${esc(l)}</span></div>`).join("")}</div>
                </div>` : ""}
            </div>`;
    }
});
