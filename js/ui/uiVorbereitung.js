/**
 * Vorbereitung: Trainerstab, Sponsoren, Testspiele, Turniere und Berichte vor der Saison.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert, damit uiManager.js nicht
 * über zwölftausend Zeilen lang ist.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Der Vorbereitungsreiter. Er ist nur sichtbar, solange die Vorbereitung
     * laeuft - sobald der erste Spieltag ansteht, verschwindet er wieder.
     */
    renderPreseason() {
        const state = this.app.state;
        const engine = this.getPreseasonEngine();
        const pre = state?.preseason;
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!engine || !pre || !club) return;

        const verbleibend = Math.max(0, (pre.dauer || 0) - (pre.tagIndex || 0));
        DOM.setText("preCountdown", pre.aktiv ? `noch ${verbleibend} Tage` : "abgeschlossen");
        DOM.setText("preHeadTitle", pre.aktiv ? "☀️ Bis zum ersten Spieltag" : "☀️ Bilanz der Vorbereitung");

        const offen = engine.offenePunkte(state);
        const offenEl = document.getElementById("preOpenItems");
        if (offenEl && !pre.aktiv) {
            // Nach dem Saisonstart ist das keine Aufgabenliste mehr, sondern
            // eine Bilanz. Vorher stand hier "Noch zu erledigen" neben
            // "abgeschlossen".
            const besetzt = engine.BEREICHE.filter(b => club.staff?.[b.key]).length;
            const gespielt = (pre.testspiele || []).filter(t => t.gespielt);
            const bilanz = gespielt.reduce((b, t) => {
                const [e, f] = String(t.ergebnis || "0:0").split(":").map(Number);
                if (e > f) b.s++; else if (e === f) b.u++; else b.n++;
                return b;
            }, { s: 0, u: 0, n: 0 });
            const turniere = (pre.turniere || []).filter(t => t.platz);
            const kachel = (titel, wert, sub = "") => `
                <div class="pre-fazit-kachel">
                    <span class="pre-fazit-titel">${titel}</span>
                    <strong>${wert}</strong>
                    ${sub ? `<span class="muted-note">${sub}</span>` : ""}
                </div>`;
            offenEl.innerHTML = `
                <div class="pre-fazit-kopf">✅ Die Vorbereitung ist abgeschlossen - die Punkterunde läuft.</div>
                <div class="pre-fazit">
                    ${kachel("Trainerstab", `${besetzt} von ${engine.BEREICHE.length} besetzt`,
                        besetzt < engine.BEREICHE.length ? "Offene Stellen lassen sich unten weiter besetzen." : "Alle Fachbereiche besetzt.")}
                    ${kachel("Sponsor", this.escapeHtml(club.sponsor?.name || "keiner"),
                        club.sponsor ? `${this.geldKurz(club.sponsor.amountPerMatchday)} je Spieltag` : "")}
                    ${kachel("Testspiele", gespielt.length ? `${bilanz.s} S · ${bilanz.u} U · ${bilanz.n} N` : "keine",
                        gespielt.length ? `${gespielt.length} Partie${gespielt.length === 1 ? "" : "n"}` : "")}
                    ${kachel("Turniere", turniere.length ? turniere.map(t => `Platz ${t.platz}`).join(", ") : "keine",
                        turniere.map(t => this.escapeHtml(t.name)).join(", "))}
                </div>`;
        } else if (offenEl) {
            offenEl.innerHTML = offen.length
                ? `<strong>Noch zu erledigen:</strong><ul style="margin:6px 0 0 18px;">${offen.map(o => `<li>${o}</li>`).join("")}</ul>`
                : `<span style="color:var(--success, #22c55e);">Alles erledigt - die Mannschaft ist bereit für den ersten Spieltag.</span>`;
        }

        this.renderPreseasonStaff(state, engine, club, pre);
        this.renderPreseasonSponsors(state, engine, club, pre);
        this.renderPreseasonPlan(state, engine, pre);
        this.renderPreseasonTournaments(state, engine, pre);
        this.renderPreseasonContacts(state, engine, club, pre);
        this.renderPreseasonReports(pre);
    },

    renderPreseasonStaff(state, engine, club, pre) {
        const el = document.getElementById("preStaffList");
        if (!el) return;

        if (typeof engine.sichereBewerber === "function") engine.sichereBewerber(pre, club);
        // Spielstände mit den alten, viel zu hohen Stabsgehältern umrechnen
        if (typeof engine.rechneStabGehaelterUm === "function" && engine.rechneStabGehaelterUm(state)
            && typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        const kosten = engine.stabKosten(club);
        const rahmen = typeof engine.stabRahmen === "function" ? engine.stabRahmen(club) : Math.round((club.wageBudget || 0) * 0.25);
        const anteil = rahmen > 0 ? Math.round(kosten / rahmen * 100) : 0;
        const frei = Math.max(0, rahmen - kosten);
        const staffEngine = this.getCoachingStaffEngine();
        const aktuell = staffEngine ? staffEngine.staffQuality(club) : null;
        const pflicht = engine.PFLICHT || [];
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const balkenKlasse = anteil >= 95 ? "gefahr" : (anteil >= 80 ? "warnung" : "");

        // Oben der Etat: Was der Stab kostet, was noch frei ist
        // Was der Stab jede Woche wirklich kostet: die Verträge plus die
        // Aushilfen auf den offenen Posten. Der Balken zeigt nur die Verträge -
        // nur die zählen gegen den Etat.
        const offenePosten = engine.BEREICHE.filter(b => !club.staff?.[b.key]);
        const aushilfen = typeof engine.aushilfeKosten === "function"
            ? offenePosten.reduce((summe, b) => summe + engine.aushilfeKosten(club, b.key), 0)
            : 0;
        const kopf = `
            <div class="stab-etat ${balkenKlasse}">
                <div class="stab-etat-zeile">
                    <span>Stab-Etat</span>
                    <strong>${GameState.formatMoney(kosten)} von ${GameState.formatMoney(rahmen)} je Woche</strong>
                    <span class="muted-note">${anteil} % · frei ${GameState.formatMoney(frei)}</span>
                </div>
                <div class="stab-etat-balken"><i style="width:${Math.min(100, anteil)}%"></i></div>
                <div class="stab-etat-zeile stab-etat-kosten">
                    <span>Kostet derzeit</span>
                    <strong>${GameState.formatMoney(kosten + aushilfen)} je Woche</strong>
                    <span class="muted-note">${offenePosten.length
                        ? `davon ${GameState.formatMoney(aushilfen)} für Aushilfen auf ${offenePosten.length} offenen Posten`
                        : "alle Posten besetzt, keine Aushilfen"}</span>
                </div>
                <div class="muted-note">Der Etat reicht für einen guten Stab - für lauter Spitzenleute wird es meist eng. Die Gehälter gehen jede Woche von der Kasse ab. Pflicht für den Saisonstart: ${pflicht.map(k => engine.BEREICHE.find(b => b.key === k)?.titel).filter(Boolean).join(", ")}.</div>
            </div>`;

        el.innerHTML = kopf + engine.BEREICHE.map(b => {
            const besetzt = club.staff?.[b.key];
            const bewerber = pre.bewerber?.[b.key] || [];
            const istPflicht = pflicht.includes(b.key);
            // Ohne eigenen Mann arbeitet der Verein mit Bordmitteln - und
            // die sind bei einem Spitzenklub schon gut. Ohne diese Zahl
            // verpflichtet man ahnungslos jemanden, der schlechter ist als
            // das, was man ohnehin hat, und zahlt dafuer auch noch Gehalt.
            const jetzt = aktuell ? (b.key === "cotrainer" ? aktuell.coTrainer : aktuell[b.key]) : null;
            const stand = besetzt
                ? `<strong>${esc(besetzt.name)}</strong> ${this.stabSterneHtml(besetzt.guete)} <span class="muted-note">${GameState.formatMoney(besetzt.gehalt)}/Wo · ${besetzt.jahre || 2} J.</span>`
                : `<span class="muted-note">offen · Aushilfe ${jetzt !== null ? this.stabSterneHtml(jetzt) : ""}${typeof engine.aushilfeKosten === "function" ? ` · ${GameState.formatMoney(engine.aushilfeKosten(club, b.key))}/Wo` : ""}</span>`
                    + (istPflicht ? ` <span class="stab-pflicht">Pflicht</span>` : "");
            const ohneDiesen = kosten - (besetzt?.gehalt || 0);
            const liste = bewerber.map(k => {
                const passt = ohneDiesen + k.gehalt <= rahmen;
                const schlechter = jetzt !== null && k.guete < jetzt;
                return `
                <div class="pre-candidate${passt ? "" : " zu-teuer"}">
                    <div class="pre-cand-info">
                        <div><strong>${esc(k.name)}</strong> <span class="muted-note">(${k.alter})</span> ${this.stabSterneHtml(k.guete)}</div>
                        <span class="muted-note">${esc(k.ruf)} · fordert ${GameState.formatMoney(k.gehalt)}/Wo${k.letzteForderung ? ` · zuletzt ${GameState.formatMoney(k.letzteForderung)}` : ""}</span>
                        ${schlechter ? `<span class="pre-cand-warn">schwächer als die Aushilfe</span>` : ""}
                        ${passt ? "" : `<span class="pre-cand-warn">sprengt zur Forderung den Etat</span>`}
                    </div>
                    <div class="pre-cand-knoepfe">
                        <button class="btn btn-sm btn-secondary" data-talk-area="${b.key}" data-talk-id="${k.id}">Verhandeln</button>
                        <button class="btn btn-sm btn-primary" data-hire-area="${b.key}" data-hire-id="${k.id}"${passt ? "" : " disabled"}>Zur Forderung</button>
                    </div>
                </div>`;
            }).join("");
            return `<div class="pre-area${!besetzt && istPflicht ? " pflicht-offen" : ""}">
                    <div class="pre-area-head"><span>${b.titel}</span><span class="pre-area-stand">${stand}</span></div>
                    <div class="muted-note" style="margin-bottom:6px;">${b.wirkung}</div>
                    ${liste || '<div class="muted-note">Keine weiteren Bewerbungen.</div>'}
                </div>`;
        }).join("");

        el.querySelectorAll("[data-hire-id]").forEach(btn => {
            btn.onclick = () => {
                const r = engine.verpflichte(state, btn.dataset.hireArea, btn.dataset.hireId);
                if (!r.ok) { this.showToast(r.grund, "error"); return; }
                this.meldeStabVerpflichtung(r);
            };
        });
        el.querySelectorAll("[data-talk-id]").forEach(btn => {
            btn.onclick = () => this.zeigeStabVerhandlung(btn.dataset.talkArea, btn.dataset.talkId);
        });
    },

    /** Nach einer Verpflichtung: Hinweis mit Etat und offenen Posten */
    meldeStabVerpflichtung(r) {
        const state = this.app.state;
        const anteil = r.rahmen > 0 ? Math.round(r.kosten / r.rahmen * 100) : 0;
        const offen = (r.offen || []).length ? ` Noch offen: ${r.offen.join(", ")}.` : " Der Stab ist komplett.";
        this.playSound("click");
        this.showToast(`✍️ ${r.meldung?.titel || `${r.staff.name} verpflichtet`}. Stab-Etat zu ${anteil} % ausgeschöpft.${offen}`,
            anteil >= 95 ? "warning" : "success", 7000);
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.renderPreseason();
        this.renderHeader();
    },

    /**
     * Ein Entscheidungsdialog für alles, was eine Antwort braucht:
     * Gehaltsverhandlung, Saisonstart ohne Arzt, Angebote für eigene Spieler.
     * knoepfe: [{ text, klasse, aktion }] - gibt eine Aktion false zurück,
     * bleibt der Dialog offen.
     */
    zeigeEntscheidung({ titel, html, knoepfe = [], nachOeffnen = null }) {
        const modal = document.getElementById("modalEntscheidung");
        const inhalt = document.getElementById("entInhalt");
        const fuss = document.getElementById("entKnoepfe");
        if (!modal || !inhalt || !fuss) return;
        DOM.setText("entTitel", titel);
        inhalt.innerHTML = html;
        fuss.innerHTML = knoepfe.map((k, i) => `<button class="btn ${k.klasse || "btn-secondary"}" data-ent="${i}">${k.text}</button>`).join("");
        const schliessen = () => { modal.style.display = "none"; };
        fuss.querySelectorAll("[data-ent]").forEach(btn => {
            btn.onclick = () => {
                const k = knoepfe[Number(btn.dataset.ent)];
                const ergebnis = k && typeof k.aktion === "function" ? k.aktion() : undefined;
                if (ergebnis !== false) schliessen();
            };
        });
        const x = document.getElementById("btnCloseEntscheidung");
        if (x) x.onclick = schliessen;
        modal.style.display = "flex";
        if (typeof nachOeffnen === "function") nachOeffnen(inhalt);
    },

    /**
     * Gehaltsverhandlung mit einem Bewerber für den Stab. Man bietet Gehalt
     * und Laufzeit, er nimmt an oder macht ein Gegenangebot - bis zu drei
     * Runden, danach oder bei einem zu niedrigen Angebot ist er weg.
     */
    zeigeStabVerhandlung(bereichKey, bewerberId) {
        const state = this.app.state;
        const engine = this.getPreseasonEngine();
        const pre = state?.preseason;
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        const kandidat = pre?.bewerber?.[bereichKey]?.find(b => b.id === bewerberId);
        if (!engine || !kandidat || !club) return;

        const bereich = engine.BEREICHE.find(b => b.key === bereichKey);
        const rahmen = engine.stabRahmen(club);
        const frei = Math.max(0, rahmen - (engine.stabKosten(club) - (club.staff?.[bereichKey]?.gehalt || 0)));
        const vorschlag = Math.round((kandidat.letzteForderung || kandidat.gehalt) * 0.9 / 50) * 50;
        const esc = (t) => this.escapeHtml(String(t ?? ""));

        const html = `
            <div class="verh-kopf">
                <div><strong>${esc(kandidat.name)}</strong> <span class="muted-note">(${kandidat.alter}) · ${esc(bereich?.titel || kandidat.titel)}</span></div>
                ${this.stabSterneHtml(kandidat.guete)} <span class="muted-note">${esc(kandidat.ruf)}</span>
            </div>
            <div class="verh-zahlen">
                <div><span>Forderung</span><strong>${GameState.formatMoney(kandidat.letzteForderung || kandidat.gehalt)}/Wo</strong></div>
                <div><span>Frei im Stab-Etat</span><strong>${GameState.formatMoney(frei)}/Wo</strong></div>
            </div>
            <div class="verh-eingabe">
                <label>Ihr Angebot je Woche
                    <input type="number" id="verhGehalt" class="styled-input" min="0" step="50" value="${vorschlag}">
                </label>
                <label>Laufzeit
                    <select id="verhJahre" class="styled-select">
                        <option value="1">1 Jahr (er will etwas mehr)</option>
                        <option value="2" selected>2 Jahre</option>
                        <option value="3">3 Jahre (er geht etwas herunter)</option>
                    </select>
                </label>
            </div>
            <div class="verh-antwort" id="verhAntwort">${kandidat.runden ? `Runde ${kandidat.runden + 1} von 3.` : "Zu tief angesetzt, bricht er ab. Nach drei Runden ist Schluss."}</div>`;

        const bieten = () => {
            const gehalt = Number(document.getElementById("verhGehalt")?.value) || 0;
            const jahre = Number(document.getElementById("verhJahre")?.value) || 2;
            const r = engine.verhandleStab(state, bereichKey, bewerberId, gehalt, jahre);
            const antwort = document.getElementById("verhAntwort");
            if (r.status === "einig") {
                const kosten = engine.stabKosten(club);
                this.meldeStabVerpflichtung({
                    staff: r.staff, meldung: r.meldung, kosten, rahmen,
                    offen: engine.BEREICHE.filter(b => !club.staff?.[b.key]).map(b => b.titel)
                });
                return true;
            }
            if (r.status === "gegenangebot") {
                if (antwort) antwort.innerHTML = `<strong>${esc(r.text)}</strong>`;
                const feld = document.getElementById("verhGehalt");
                if (feld) feld.value = r.gegenangebot;
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderPreseason();
                return false;
            }
            if (r.status === "abgebrochen") {
                this.showToast(r.text, "warning", 6000);
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderPreseason();
                return true;
            }
            if (antwort) antwort.innerHTML = `<span style="color:var(--accent-danger);">${esc(r.text || "Das hat nicht geklappt.")}</span>`;
            return false;
        };

        this.zeigeEntscheidung({
            titel: "Gehaltsverhandlung",
            html,
            knoepfe: [
                { text: "Abbrechen", klasse: "btn-secondary" },
                { text: "Angebot machen", klasse: "btn-primary", aktion: bieten }
            ]
        });
    },

    /**
     * Vor dem ersten Spieltag: Sind Arzt, Athletiktrainer und Co-Trainer da?
     * Wenn nicht, fragt der Sportdirektor nach - einmal je Saison lässt sich
     * das bewusst übergehen. Gibt true zurück, wenn der Saisonstart wartet.
     */
    pruefePflichtpostenVorStart(weiter) {
        const state = this.app.state;
        const pre = state?.preseason;
        const engine = this.getPreseasonEngine();
        const cal = this.getCalendarEngine();
        if (!pre || !pre.aktiv || !engine || typeof engine.pflichtLuecken !== "function" || !cal) return false;
        const heute = cal.getCurrentDay(state);
        if (!heute || heute.type !== "matchday") return false;
        if (pre.pflichtUebergangen === (state.seasonYear || 1)) return false;
        const luecken = engine.pflichtLuecken(state);
        if (!luecken.length) return false;

        const club = state.clubs.find(c => c.id === state.userClubId);
        const frei = Math.max(0, engine.stabRahmen(club) - engine.stabKosten(club));
        const folgen = {
            medizin: "Verletzungen dauern länger, das Risiko steigt.",
            fitness: "Die Kondition leidet, die Belastung wird schlechter gesteuert.",
            cotrainer: "An der Seitenlinie gibt es keine Hinweise und keine Delegation."
        };
        const html = `
            <p>Der erste Spieltag steht an - und diese Posten sind noch offen:</p>
            <ul class="pflicht-liste">${luecken.map(b => `<li><strong>${b.titel}</strong> · ${folgen[b.key] || b.wirkung}</li>`).join("")}</ul>
            <p class="muted-note">Im Stab-Etat sind noch ${GameState.formatMoney(frei)} je Woche frei. Der Sportdirektor kann kurzfristig den besten bezahlbaren Bewerber holen - zu dessen Forderung, für ein Jahr.</p>`;

        this.zeigeEntscheidung({
            titel: "⚠️ Ohne Arzt in die Saison?",
            html,
            knoepfe: [
                { text: "Zur Vorbereitung", klasse: "btn-secondary", aktion: () => this.switchTab("preseason") },
                {
                    text: "Sportdirektor besetzt", klasse: "btn-primary", aktion: () => {
                        const ergebnisse = luecken.map(b => ({ b, r: engine.besetzeKurzfristig(state, b.key) }));
                        const ok = ergebnisse.filter(e => e.r.ok).map(e => `${e.b.titel}: ${e.r.staff.name}`);
                        const fehl = ergebnisse.filter(e => !e.r.ok).map(e => e.b.titel);
                        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                        this.showToast(
                            (ok.length ? `✍️ Verpflichtet - ${ok.join(", ")}.` : "")
                            + (fehl.length ? ` Nicht bezahlbar: ${fehl.join(", ")}.` : ""),
                            fehl.length ? "warning" : "success", 8000);
                        this.renderHeader();
                        this.renderCurrentTab();
                    }
                },
                {
                    text: "Trotzdem starten", klasse: "btn-danger", aktion: () => {
                        pre.pflichtUebergangen = state.seasonYear || 1;
                        if (typeof weiter === "function") setTimeout(weiter, 0);
                    }
                }
            ]
        });
        return true;
    },

    renderPreseasonSponsors(state, engine, club, pre) {
        const el = document.getElementById("preSponsorList");
        if (!el) return;

        if (pre.sponsorGewaehlt && club.sponsor) {
            el.innerHTML = `<div class="pre-area">
                    <div class="pre-area-head"><span>Vertrag steht</span><strong>${club.sponsor.name}</strong></div>
                    <div>${GameState.formatMoney(club.sponsor.amountPerMatchday)} je Spieltag
                        &middot; ${club.sponsor.yearsRemaining} Jahr(e)</div>
                    ${club.sponsor.zielPlatz ? `<div class="muted-note">Prämie ${GameState.formatMoney(club.sponsor.praemie)} bei Platz ${club.sponsor.zielPlatz} oder besser.</div>` : ""}
                </div>`;
            return;
        }

        el.innerHTML = (pre.sponsorAngebote || []).map(a => `
            <div class="pre-candidate">
                <div>
                    <strong>${a.name}</strong><br>
                    <span class="muted-note">${GameState.formatMoney(a.amountPerMatchday)} je Spieltag &middot; ${a.yearsRemaining} Jahr(e)</span><br>
                    <span class="muted-note">${a.beschreibung}</span>
                    ${a.zielPlatz ? `<br><span class="muted-note">Prämie ${GameState.formatMoney(a.praemie)} bei Platz ${a.zielPlatz} oder besser.</span>` : ""}
                </div>
                <button class="btn btn-sm btn-primary" data-sponsor-id="${a.id}">Annehmen</button>
            </div>`).join("");

        el.querySelectorAll("[data-sponsor-id]").forEach(btn => {
            btn.onclick = () => {
                const r = engine.waehleSponsor(state, btn.dataset.sponsorId);
                if (!r.ok) { this.showToast(r.grund, "error"); return; }
                this.showToast(`Vertrag mit ${r.sponsor.name} geschlossen.`, "success");
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderPreseason();
                this.renderHeader();
            };
        });
    },

    /**
     * Der Terminplan: vier Plaetze, und was an ihnen gespielt wird. Ein freier
     * Platz ist kein Fehler - er wird nur kurzfristig und schlecht besetzt.
     */
    renderPreseasonPlan(state, engine, pre) {
        const el = document.getElementById("prePlanList");
        if (!el) return;
        engine.sichereStruktur(pre);

        const zeilen = pre.plan.map((eintrag, i) => {
            const gespielt = engine.terminGespielt(pre, i);
            let titel = '<span class="muted-note">frei - der Sportdirektor besetzt ihn kurzfristig</span>';
            let rechts = gespielt ? "" : '<span class="muted-note">offen</span>';
            let aktion = "";

            if (eintrag && eintrag.art === "test") {
                const t = pre.testspiele.find(x => x.id === eintrag.testId);
                if (t) {
                    titel = `<strong>Testspiel</strong> ${t.heim ? "gegen" : "bei"} ${t.gegnerName}
                        <span class="muted-note">(Ruf ${t.gegnerRuf}${t.selbstVereinbart === false ? ", vom Verein gestellt" : ""})</span>`;
                    rechts = t.gespielt
                        ? `<strong>${t.ergebnis}</strong>`
                        : '<span class="muted-note">angesetzt</span>';
                    if (!t.gespielt && t.selbstVereinbart) {
                        aktion = `<button class="btn btn-sm btn-secondary" data-drop-test="${t.id}">Absetzen</button>`;
                    }
                }
            } else if (eintrag && eintrag.art === "turnier") {
                const turnier = pre.turniere.find(x => x.id === eintrag.turnierId);
                const runde = eintrag.runde === "halbfinale"
                    ? "Halbfinale"
                    : (turnier?.halbfinale && !turnier.halbfinale.gewonnen ? "Spiel um Platz drei" : "Endspiel");
                titel = `<strong>${turnier?.name || "Turnier"}</strong> &middot; ${runde}`;
                const partie = eintrag.runde === "halbfinale" ? turnier?.halbfinale : turnier?.endspiel;
                rechts = partie
                    ? `<strong>${partie.ergebnis}</strong>`
                    : '<span class="muted-note">angesetzt</span>';
            }

            return `<div class="pre-candidate">
                    <div><span class="muted-note">Termin ${i + 1}</span><br>${titel}</div>
                    <div style="text-align:right;">${rechts} ${aktion}</div>
                </div>`;
        }).join("");

        const frei = engine.freieSlots(pre).filter(i => !engine.terminGespielt(pre, i)).length;
        el.innerHTML = zeilen + (frei
            ? `<div class="muted-note" style="margin-top:8px;">Noch ${frei} Termin${frei === 1 ? "" : "e"} zu vergeben.</div>`
            : `<div class="muted-note" style="margin-top:8px;">Das Programm steht.</div>`);

        el.querySelectorAll("[data-drop-test]").forEach(btn => {
            btn.onclick = () => {
                const r = engine.sageTestspielAb(state, btn.dataset.dropTest);
                if (!r.ok) { this.showToast(r.grund, "error"); return; }
                this.showToast("Testspiel abgesetzt.", "info");
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderPreseason();
            };
        });
    },

    renderPreseasonTournaments(state, engine, pre) {
        const el = document.getElementById("preTournamentList");
        if (!el) return;
        engine.sichereStruktur(pre);

        if (!pre.turniere.length) {
            el.innerHTML = '<div class="muted-note">Keine Einladungen eingegangen.</div>';
            return;
        }

        el.innerHTML = pre.turniere.map(t => {
            const gegner = t.teilnehmer.map(g => `${g.name} (${g.ruf})`).join(", ");
            const geld = `Antrittsgeld ${GameState.formatMoney(t.antrittsgeld)} &middot; Sieg ${GameState.formatMoney(t.praemien[1])}`;

            let stand = "";
            if (t.halbfinale) {
                stand = `<div class="muted-note">Halbfinale ${t.halbfinale.ergebnis} &middot; ${t.halbfinale.gewonnen ? "Endspiel erreicht" : "Spiel um Platz drei"}</div>`;
            }
            if (t.endspiel) {
                stand += `<div class="muted-note">${t.endspiel.umPlatzDrei ? "Spiel um Platz drei" : "Endspiel"} ${t.endspiel.ergebnis} &middot; <strong>Platz ${t.platz}</strong></div>`;
            }

            let knoepfe = "";
            if (t.status === "offen") {
                knoepfe = `<button class="btn btn-sm btn-primary" data-join-cup="${t.id}">Zusagen</button>
                    <button class="btn btn-sm btn-secondary" data-skip-cup="${t.id}">Absagen</button>`;
            } else if (t.status === "angenommen" && !t.halbfinale) {
                knoepfe = `<span class="muted-note">zugesagt</span>
                    <button class="btn btn-sm btn-secondary" data-cancel-cup="${t.id}">Zurückziehen</button>`;
            } else if (t.status === "abgelehnt") {
                knoepfe = '<span class="muted-note">abgesagt</span>';
            } else {
                knoepfe = `<span class="muted-note">Platz ${t.platz ?? "-"}</span>`;
            }

            return `<div class="pre-area">
                    <div class="pre-area-head"><span>${t.name}</span><span class="muted-note">belegt 2 Termine</span></div>
                    <div class="muted-note" style="margin-bottom:4px;">${t.hinweis}</div>
                    <div class="muted-note">Teilnehmer: ${gegner}</div>
                    <div class="muted-note" style="margin-bottom:6px;">${geld}</div>
                    ${stand}
                    <div style="display:flex; gap:6px; margin-top:6px;">${knoepfe}</div>
                </div>`;
        }).join("");

        const handle = (attribut, methode, erfolg) => {
            el.querySelectorAll(`[${attribut}]`).forEach(btn => {
                btn.onclick = () => {
                    const r = engine[methode](state, btn.getAttribute(attribut));
                    if (!r.ok) { this.showToast(r.grund, "error"); return; }
                    this.showToast(erfolg(r), "success");
                    if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                    this.renderPreseason();
                    this.renderHeader();
                };
            });
        };
        handle("data-join-cup", "nimmTurnierAn", r => `Zusage für ${r.turnier.name}.`);
        handle("data-skip-cup", "sageTurnierAb", r => `${r.turnier.name} abgesagt.`);
        handle("data-cancel-cup", "storniereTurnier", r => `Zusage für ${r.turnier.name} zurückgezogen.`);
    },

    /**
     * Vereine anfragen. Eine Anfrage kostet nichts als den Termin - aber sie
     * kann scheitern, und dann ist dieser Verein für diese Vorbereitung weg.
     */
    renderPreseasonContacts(state, engine, club, pre) {
        const el = document.getElementById("preContactList");
        if (!el) return;
        engine.sichereStruktur(pre);

        const frei = engine.freieSlots(pre).length;
        el.innerHTML = `<div class="muted-note" style="margin-bottom:8px;">
                ${frei ? `${frei} freie${frei === 1 ? "r" : ""} Termin${frei === 1 ? "" : "e"}.` : "Kein Termin mehr frei."}
                Eine Absage gilt für diese Vorbereitung.
            </div>` +
            pre.kontakte.map(k => {
                const p = engine.bereitschaft(club, k.ruf);
                let rechts;
                if (k.status === "zugesagt") {
                    rechts = '<span class="muted-note">zugesagt</span>';
                } else if (k.status === "abgesagt") {
                    rechts = '<span class="muted-note">abgesagt</span>';
                } else if (!frei) {
                    rechts = '<span class="muted-note">kein Termin frei</span>';
                } else {
                    rechts = `<button class="btn btn-sm btn-primary" data-ask-club="${k.clubId}">Anfragen</button>`;
                }
                const hinweis = k.status === "abgesagt" && k.grund
                    ? `<br><span class="muted-note">${k.grund}</span>`
                    : `<br><span class="muted-note">${engine.bereitschaftText(p)}</span>`;
                return `<div class="pre-candidate">
                        <div>
                            <strong>${k.name}</strong>
                            <span class="muted-note">&middot; Ruf ${k.ruf} &middot; Liga ${k.liga}</span>
                            ${hinweis}
                        </div>
                        <div>${rechts}</div>
                    </div>`;
            }).join("");

        el.querySelectorAll("[data-ask-club]").forEach(btn => {
            btn.onclick = () => {
                const r = engine.frageTestspielAn(state, btn.dataset.askClub);
                if (!r.ok) { this.showToast(r.grund, "error"); return; }
                if (r.zugesagt) {
                    this.showToast(`${r.kontakt.name} sagt zu - Termin steht.`, "success");
                } else {
                    this.showToast(`${r.kontakt.name} ${r.kontakt.grund}.`, "warning");
                }
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderPreseason();
            };
        });
    },

    renderPreseasonReports(pre) {
        const el = document.getElementById("preReportList");
        if (!el) return;
        const berichte = pre.berichte || [];
        el.innerHTML = berichte.length
            ? berichte.slice(0, 8).map(b => `
                <div class="pre-candidate">
                    <div><strong>${b.titel}</strong><br><span class="muted-note">${b.text}</span></div>
                </div>`).join("")
            : '<div class="muted-note">Noch nichts gespielt.</div>';
    },

    sponsorProSpieltag(club) {
        const finance = (typeof FinanceEngine !== "undefined" && FinanceEngine)
            ? FinanceEngine
            : ((typeof window !== "undefined" && window.FinanceEngine) ? window.FinanceEngine : null);
        if (finance && typeof finance.sponsorPerMatchday === "function") {
            return finance.sponsorPerMatchday(club);
        }
        return club?.sponsor?.amountPerMatchday || 0;
    }
});
