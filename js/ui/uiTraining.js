/**
 * Training und Jugend: Pläne, Trainerstab und Trainingsbericht im Reiter
 * Training, Akademie, Talente und U19 im Reiter Jugend.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Die individuellen Pläne im Trainings-Reiter: alle mit Plan, dazu die
     * jungen Spieler mit ihrer Spielpraxis - wer nicht spielt, ist ein
     * Kandidat für eine Leihe.
     */
    renderTrainingsPlaene() {
        const body = document.getElementById("trainingPlaeneBody");
        const engine = this.getDevelopmentPlanEngine();
        if (!body || !engine) return;
        const state = this.app.state;
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!club) return;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const ids = new Set(club.playerIds.map(String));
        const kader = state.players.filter(p => ids.has(String(p.id)));
        const zeilen = kader
            .filter(p => p.trainingsfokus || p.umschulung || p.mentorId || p.eigenheitTraining || (p.age || 30) <= 23)
            .sort((a, b) => (a.age || 0) - (b.age || 0));
        const meta = document.getElementById("trainingPlaeneMeta");
        if (meta) meta.textContent = `${kader.filter(p => p.trainingsfokus || p.umschulung || p.mentorId || p.eigenheitTraining).length} mit Plan`;
        if (!zeilen.length) {
            body.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Noch keine individuellen Pläne.</td></tr>`;
            return;
        }
        body.innerHTML = zeilen.map(p => {
            const praxis = Math.round((typeof p.spielpraxis === "number" ? p.spielpraxis : 0.5) * 100);
            const mentor = p.mentorId ? state.players.find(m => String(m.id) === String(p.mentorId)) : null;
            return `
                <tr class="clickable-row" data-player-id="${esc(p.id)}">
                    <td><strong>${esc(p.name)}</strong> <span class="text-muted">${esc(p.pos)}</span></td>
                    <td>${p.age}</td>
                    <td><span class="${praxis < 30 && (p.age || 30) <= 23 ? "text-warning" : ""}">${praxis} %</span></td>
                    <td>${p.trainingsfokus ? esc(engine.SCHWERPUNKTE[p.trainingsfokus]?.label) : "-"}</td>
                    <td>${p.umschulung ? `${esc(p.umschulung.pos)} · ${engine.umschulungsStand(p)} %` : "-"}</td>
                    <td>${p.eigenheitTraining
                        ? `<span title="${esc(engine.eigenheitText(p.eigenheitTraining.key))}">${p.eigenheitTraining.art === "ablegen" ? "ablegen" : "lernen"} · ${engine.eigenheitStand(p)} %</span>`
                        : "-"}</td>
                    <td>${mentor ? esc(mentor.name) : "-"}</td>
                </tr>`;
        }).join("");
        body.querySelectorAll("tr[data-player-id]").forEach(tr => tr.addEventListener("click", () => {
            const ziel = state.players.find(p => String(p.id) === tr.dataset.playerId);
            if (ziel) this.showPlayerDetailsModal(ziel.id);
        }));
    },

    /** Trainingslager buchen - in der Vorbereitung und in der Winterpause */
    renderTrainingslager() {
        const box = document.getElementById("trainingslagerKarte");
        const P = (typeof PreseasonEngine !== "undefined" && PreseasonEngine) ? PreseasonEngine : null;
        const state = this.app.state;
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!box || !P || !club || typeof P.lagerFenster !== "function") return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const fenster = P.lagerFenster(state);
        const gebucht = fenster ? P.lagerGebucht(state, club, fenster) : null;
        const zeit = fenster === "sommer" ? "diesen Sommer" : "diesen Winter";
        const status = !fenster
            ? `<p class="text-muted">Buchbar in der Vorbereitung und in der Winterpause.</p>`
            : (gebucht ? `<p class="lager-gebucht">✅ Für ${zeit} gebucht: ${esc(P.TRAININGSLAGER[gebucht.art]?.name)}.</p>` : "");
        const optionen = Object.entries(P.TRAININGSLAGER).map(([art, l]) => `
            <div class="lager-option">
                <div><strong>${esc(l.name)}</strong><br><span class="text-muted">${l.tage} Tage gemeinsam, ${l.spiele} Testspiele · ${this.geldKurz(P.lagerKosten(club, art))}</span></div>
                <button class="btn btn-sm btn-primary" data-lager="${art}" ${!fenster || gebucht ? "disabled" : ""}>Buchen</button>
            </div>`).join("");
        box.innerHTML = `
            <div class="card-header"><h3>🏕️ Trainingslager</h3></div>
            <p class="taktik-hilfe">Zwei, drei Wochen, in denen die Mannschaft nichts anderes tut: Neuzugänge gewöhnen sich schneller ein (für die Eingespieltheit zählt das Lager wie zusätzliche Tage im Verein und gemeinsame Spiele), und die Taktik sitzt besser.</p>
            ${status}
            <div class="lager-optionen">${optionen}</div>`;
        box.querySelectorAll("[data-lager]").forEach(btn => btn.addEventListener("click", () => {
            const res = P.bucheTrainingslager(state, btn.dataset.lager);
            this.showToast(res.success ? `Gebucht - ${this.geldKurz(res.kosten)}.` : res.error, res.success ? "success" : "error");
            if (res.success) {
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderTrainingslager();
                this.renderHeader?.();
            }
        }));
    },

    renderTraining() {
        const state = this.app.state;
        const currentFocus = state.trainingSettings?.focus || "allround";
        const currentIntensity = state.trainingSettings?.intensity || "normal";

        const focusRadio = document.querySelector(`input[name="trainFocus"][value="${currentFocus}"]`);
        if (focusRadio) focusRadio.checked = true;

        const intensityRadio = document.querySelector(`input[name="trainIntensity"][value="${currentIntensity}"]`);
        if (intensityRadio) intensityRadio.checked = true;

        this.renderCoachingStaffCard();
        this.renderTrainingslager();
        this.renderTrainingsPlaene();
        this.renderTrainingReport();
    },

    /**
     * Der Reiter Jugend: Akademie, Talente, Talente anderer Akademien,
     * Schwerpunkte für den nächsten Jahrgang und die U19-Liga.
     *
     * Das alles stand bisher unten im Reiter Training - der wurde so lang,
     * dass man für die Akademie weit scrollen musste.
     */
    renderJugend() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const levelBadge = document.getElementById("youthAcademyLevelBadge");
        if (levelBadge && userClub) {
            const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
            const anlage = userClub.anlagen?.youthCenter;
            const level = anlage?.stufe ?? userClub.facilities?.youthCenter ?? state.youthAcademy?.level ?? 1;
            const schule = (typeof YouthEngine !== "undefined" && YouthEngine.schuleVon)
                ? YouthEngine.schuleVon(userClub) : null;

            let text = `Akademie: Stufe ${level}`;
            if (anlage && fac) text += ` · ${fac.zustandsText(anlage.zustand)}`;
            if (schule) text += ` · ${schule.name}`;
            if (anlage?.projekt) {
                text += ` · Umbau (${fac.restText(fac.migriereProjekt(anlage.projekt))})`;
            }
            levelBadge.textContent = text;
            levelBadge.title = anlage
                ? `Wirksame Stufe: ${fac ? fac.wirksameStufe(userClub, "youthCenter", state.seasonYear || 1) : level}`
                  + ` — Zustand ${Math.round(anlage.zustand)} %`
                : "";
            // Der Knopf zeigt den echten Preis statt fester 2,5 Millionen
            const knopf = document.getElementById("btnUpgradeYouthAcademy");
            if (knopf && fac) {
                const preis = level < 5 ? fac.kosten(userClub, "youthCenter", "ausbau", state.seasonYear || 1) : 0;
                knopf.textContent = level >= 5 ? "Akademie: höchste Stufe"
                    : anlage?.projekt ? "Akademie im Umbau"
                    : `Akademie ausbauen (${this.geldKurz(preis)})`;
                knopf.disabled = level >= 5 || !!anlage?.projekt;
            }
        }

        this.renderAkademieSchwerpunkte(state, userClub);
        this.renderAkademieZugang(state);
        this.renderFremdeTalente(state);
        this.renderJugendliga(state);
        this.renderU23(state);
        this.renderVerlieheneTalente(state);
        this.renderNachwuchsUebersicht(state);

        const engine = this.getNegotiationEngine();
        const prospectsBody = document.getElementById("youthProspectsBody");
        if (prospectsBody) {
            // Nach dem Laden standen die Talente in zwei getrennten Listen -
            // die Beförderung erschien dann hier nicht
            const youthListe = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : window.YouthEngine;
            const alleTalente = youthListe && typeof youthListe.eigeneTalente === "function"
                ? youthListe.eigeneTalente(state)
                : (state.youthAcademy?.prospects || []);
            const prospects = alleTalente.filter(p => !p.promoted);
            const meta = document.getElementById("youthTalenteMeta");
            if (meta) {
                const werben = this.offeneJugendAnfragen(state);
                meta.textContent = `${prospects.length} ${prospects.length === 1 ? "Talent" : "Talente"}`
                    + (werben > 0 ? ` · ${werben} ${werben === 1 ? "Verein wirbt" : "Vereine werben"}` : "");
                meta.classList.toggle("header-tag-warnung", werben > 0);
            }
            if (prospects.length === 0) {
                prospectsBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Aktuell keine unbeförderten Jugendspieler in der Akademie.</td></tr>`;
            } else {
                const laufende = engine
                    ? engine.getOpenNegotiations(state).filter(n => n.type === "youth_promotion")
                    : [];

                // Ältere Spielstände kennen noch keine Talentwerte - nachrüsten,
                // sonst bliebe die Spielerakte des Jungen leer
                const generator = this.getPlayerGenerator();
                if (generator && typeof generator.completeYouthProspect === "function") {
                    let ergaenzt = false;
                    prospects.forEach(p => { if (generator.completeYouthProspect(p)) ergaenzt = true; });
                    // Talente, die noch wie für einen Bundesligisten erzeugt
                    // wurden, bekommen ligagerechte Werte
                    const youth = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : window.YouthEngine;
                    if (youth && typeof youth.passeTalenteAnLigaAn === "function"
                        && youth.passeTalenteAnLigaAn(state, state.userClubId) > 0) ergaenzt = true;
                    if (ergaenzt && typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                }

                const youthV = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : window.YouthEngine;
                const heute = youthV && typeof youthV._heute === "function" ? youthV._heute(state) : 0;
                prospectsBody.innerHTML = prospects.map(p => {
                    const gespraech = laufende.find(n => String(n.prospectId) === String(p.id));
                    const vertrag = youthV && typeof youthV.vertragsLage === "function" ? youthV.vertragsLage(state, userClub, p) : null;
                    const anfrage = youthV && typeof youthV.offeneAnfrage === "function" ? youthV.offeneAnfrage(state, p.id) : null;

                    // Vertrag und Stand: der Jugendvertrag, laufende Gespräche, ein Werber
                    const standHtml = (gespraech
                        ? `<div style="font-size:12px;">
                               <strong>${this.escapeHtml(gespraech.agentName)}</strong>
                               <div class="text-muted">${this.escapeHtml(engine.describe(gespraech))}</div>
                           </div>`
                        : `<span class="text-muted talent-vertrag">${this.escapeHtml(vertrag ? vertrag.text : "Noch keine Gespräche")}</span>`)
                        + (anfrage ? `<div class="talent-anfrage">📨 ${this.escapeHtml(anfrage.clubName)} wirbt · noch ${Math.max(0, anfrage.bis - heute)} Tage · Entschädigung ${this.formatMoneySafe(anfrage.betrag)}</div>` : "");

                    const zuJung = youthV && typeof youthV.profiHindernis === "function" ? youthV.profiHindernis(userClub, p) : null;
                    const profiKnopf = zuJung
                        ? `<button class="btn btn-sm btn-secondary" disabled title="${this.escapeHtml(zuJung)}">Profi ab ${vertrag ? vertrag.profiAb : 16}</button>`
                        : `<button class="btn btn-sm btn-primary btn-promote-prospect" data-prospect-id="${p.id}">Profivertrag anbieten</button>`;
                    const profisKnopf = (p.age || 0) >= (youthV?.MIT_PROFIS?.abAlter ?? 16)
                        ? `<button class="btn btn-sm btn-secondary btn-mit-profis" data-prospect-id="${p.id}" data-an="${p.mitProfis ? "0" : "1"}">${p.mitProfis ? "Zurück in die U19" : "Mit den Profis trainieren"}</button>`
                        : "";
                    const anfrageKnoepfe = anfrage
                        ? (anfrage.gespraech ? "" : `<button class="btn btn-sm btn-primary btn-perspektive" data-anfrage-id="${this.escapeHtml(anfrage.id)}" title="Ein Gespräch über seinen Weg bei uns - einmal je Anfrage">Perspektive aufzeigen</button>`)
                            + `<button class="btn btn-sm btn-secondary btn-ziehen-lassen" data-anfrage-id="${this.escapeHtml(anfrage.id)}">Ziehen lassen</button>`
                        : "";
                    // Sofort zu den Profis, mit dem Jugendvertrag (YouthEngine.hochziehen)
                    const hochKnopf = !anfrage && (p.age || 0) >= (youthV?.MIT_PROFIS?.abAlter ?? 16)
                        ? `<button class="btn btn-sm btn-secondary btn-hochziehen" data-talent-id="${p.id}" title="Sofort zu den Profis - ohne Berater, mit seinem Jugendvertrag">Hochziehen</button>`
                        : "";
                    const aktion = gespraech
                        ? `<button class="btn btn-sm btn-secondary btn-goto-negotiation" data-neg-id="${this.escapeHtml(gespraech.id)}">Zur Verhandlung</button>${anfrageKnoepfe}`
                        : `${profiKnopf}${hochKnopf}${anfrageKnoepfe}${profisKnopf}
                           <button class="btn btn-sm btn-secondary btn-release-prospect" data-prospect-id="${p.id}" title="Platz in der Akademie freimachen">Freigeben</button>`;
                    const quelle = ({ probetraining: "Probetraining", sichtung: "Sichtungstag" })[p.quelle]
                        || (p.quelle === "fremd" && p.vonClubName ? `aus ${p.vonClubName}` : null);
                    // Aus der internationalen Sichtung: woher er kommt, und ob er ein Ausnahmetalent ist
                    const heimatName = typeof YouthEngine !== "undefined" && YouthEngine.heimatland ? YouthEngine.heimatland(state, userClub) : null;
                    const herkunft = p.nationality && heimatName && p.nationality !== heimatName ? ` <span class="text-muted">· ${this.escapeHtml(p.nationality)}</span>` : "";
                    const ausnahme = p.ausnahmetalent ? ` <span class="talent-quelle talent-ausnahme">⭐ Ausnahmetalent</span>` : "";
                    const profis = p.mitProfis ? ` <span class="talent-quelle talent-profis">🏋️ trainiert mit den Profis</span>` : "";

                    return `
                    <tr class="row-clickable" data-prospect-id="${p.id}" title="Spielerakte von ${this.escapeHtml(p.name)} öffnen">
                        <td><strong>${this.escapeHtml(p.name)}</strong>${herkunft}${quelle ? ` <span class="talent-quelle">${this.escapeHtml(quelle)}</span>` : ""}${ausnahme}${profis}</td>
                        <td><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${p.pos}</span></td>
                        <td>${p.age} Jahre</td>
                        <td colspan="2">${this.abilityStarsFor(p)}</td>
                        <td>${standHtml}</td>
                        <td><div class="talent-aktionen">${aktion}</div></td>
                    </tr>
                `;
                }).join("");

                // Ein Klick auf die Zeile öffnet die vollständige Spielerakte
                prospectsBody.querySelectorAll("tr.row-clickable").forEach(row => {
                    row.addEventListener("click", (e) => {
                        if (e.target.closest("button")) return;
                        this.showPlayerDetailsModal(row.dataset.prospectId);
                    });
                });

                const speichernUndNeu = () => {
                    if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                    this.renderHeader();
                    this.renderJugend();
                };

                // Der erste Profivertrag läuft über den Berater und dauert einige Tage
                document.querySelectorAll(".btn-promote-prospect").forEach(btn => {
                    btn.addEventListener("click", () => {
                        if (!engine) {
                            this.showToast("Verhandlungen sind derzeit nicht verfügbar.", "error");
                            return;
                        }
                        const res = engine.startYouthPromotion(state, userClub.id, btn.dataset.prospectId);
                        if (res.success) {
                            this.playSound("click");
                            this.showToast(
                                `Berater ${res.negotiation.agentName} verhandelt über den Erstvertrag. Erste Forderung: ${this.formatMoneySafe(res.negotiation.demand.wage)} pro Woche.`,
                                "success", 6000);
                            // Gleich zur Verhandlung: Der Berater wartet auf unser Angebot
                            this.zeigeVerhandlung(res.negotiation.id);
                        } else {
                            this.showToast(res.error || "Gespräche konnten nicht aufgenommen werden.", "error");
                        }
                    });
                });

                document.querySelectorAll(".btn-mit-profis").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const res = youthV.mitProfisTrainieren(state, btn.dataset.prospectId, btn.dataset.an === "1");
                        if (!res.success) return this.showToast(res.error, "error");
                        this.showToast(res.talent.mitProfis ? `🏋️ ${res.talent.name} trainiert ab jetzt mit den Profis.` : `${res.talent.name} trainiert wieder in der U19.`, "info");
                        speichernUndNeu();
                    });
                });

                document.querySelectorAll(".btn-perspektive").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const res = youthV.perspektiveAufzeigen(state, btn.dataset.anfrageId);
                        if (!res.success) return this.showToast(res.error, "error");
                        this.showToast(res.text, res.bleibt ? "success" : "warning", 6000);
                        speichernUndNeu();
                    });
                });

                document.querySelectorAll(".btn-ziehen-lassen").forEach(btn => {
                    btn.addEventListener("click", () => {
                        if (typeof confirm === "function" && !confirm("Das Talent gegen die Ausbildungsentschädigung ziehen lassen?")) return;
                        const res = youthV.talentZiehenLassen(state, btn.dataset.anfrageId);
                        if (!res.success) return this.showToast(res.error, "error");
                        this.showToast(`Er wechselt - als Ausbildungsentschädigung kommen ${this.formatMoneySafe(res.betrag)}.`, "info", 6000);
                        speichernUndNeu();
                    });
                });

                document.querySelectorAll(".btn-release-prospect").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const youth = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : window.YouthEngine;
                        const talent = prospects.find(t => String(t.id) === btn.dataset.prospectId);
                        if (!youth || !talent) return;
                        if (typeof confirm === "function" && !confirm(`${talent.name} aus der Akademie freigeben?`)) return;
                        const res = youth.talentFreigeben(state, talent.id);
                        if (!res.success) return this.showToast(res.error, "error");
                        this.showToast(`${talent.name} verlässt die Akademie.`, "info");
                        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                        this.renderJugend();
                    });
                });

                document.querySelectorAll(".btn-goto-negotiation").forEach(btn => {
                    btn.addEventListener("click", () => this.zeigeVerhandlung(btn.dataset.negId));
                });
                this.bindeUnterbauKnoepfe(prospectsBody);
            }
        }
    },

    /**
     * Schwerpunkte der Jugendakademie: Ausbildung, Positionen, Jahrgang und
     * Einzugsgebiet. Alles wirkt auf den nächsten Jahrgang; darunter steht,
     * was der Manager damit bekommt und was es kostet.
     */
    /**
     * Woher die Talente kommen: Jugendtag, Probetrainings unter dem Jahr und
     * der Sichtungstag, den der Manager selbst ansetzt.
     */
    /** Wie viele Vereine gerade um Talente der Akademie werben */
    offeneJugendAnfragen(state) {
        return (state?.youthAcademy?.anfragen || []).filter(a => a.status === "offen").length;
    },

    /** Die U19-Liga: Tabelle, eigene Ergebnisse, Torschützen */
    renderJugendliga(state) {
        const el = document.getElementById("jugendligaKarte");
        const engine = typeof JugendligaEngine !== "undefined" ? JugendligaEngine : null;
        if (!el || !engine) return;
        const j = engine.starte(state);
        if (!j) { el.hidden = true; return; }
        el.hidden = false;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const tabelle = engine.tabelle(state);
        const eigene = j.eigene.slice(-5).reverse();
        const schuetzen = Object.values(j.torschuetzen).sort((a, b) => b.tore - a.tore).slice(0, 5);
        const staerke = engine.eigeneStaerke(state);
        el.innerHTML = `
            <div class="card-header"><h3>🏅 ${esc(j.name)}</h3><span class="header-tag">${j.runde} / ${j.runden.length} Spieltage${j.meister ? ` · Meister: ${esc(j.meister)}` : ""}</span></div>
            <p class="text-muted jl-hinweis">Die U19 spielt mit den Talenten der Akademie und den Spielern bis 19 ohne Stammplatz bei den Profis - Stärke im Moment ${staerke.toFixed(1).replace(".", ",")}. Gespielt wird parallel zu den Spieltagen der Profis.</p>
            <div class="jl-raster">
                <div class="table-container">
                    <table class="compact-table jl-tabelle">
                        <thead><tr><th>Pl.</th><th>Team</th><th>Sp</th><th>Tore</th><th>Pkt</th></tr></thead>
                        <tbody>${tabelle.map(z => `<tr class="${z.eigen ? "jl-eigen" : ""}"><td>${z.rang}.</td><td>${esc(z.name)}</td><td>${z.spiele}</td><td>${z.tore}:${z.gegentore}</td><td><strong>${z.punkte}</strong></td></tr>`).join("")}</tbody>
                    </table>
                </div>
                <div>
                    <h4>Letzte Spiele</h4>
                    ${eigene.length ? `<ul class="jl-spiele">${eigene.map(e => {
                        const art = e.tore > e.gegentore ? "s" : (e.tore === e.gegentore ? "u" : "n");
                        return `<li><span class="jl-erg jl-${art}">${e.tore}:${e.gegentore}</span><span>${e.heim ? "gegen" : "bei"} ${esc(e.gegner)}<small>${e.schuetzen.length ? `Tore: ${esc(e.schuetzen.join(", "))}` : `${e.runde}. Spieltag`}</small></span></li>`;
                    }).join("")}</ul>` : `<p class="text-muted">Der erste Spieltag der U19 kommt mit dem zweiten der Profis.</p>`}
                    ${schuetzen.length ? `<h4>Torjäger der U19</h4><ol class="jl-schuetzen">${schuetzen.map(s => `<li>${esc(s.name)}<b>${s.tore}</b></li>`).join("")}</ol>` : ""}
                </div>
            </div>
            ${this.u19KaderHtml(state, engine)}`;
        el.querySelectorAll("[data-u19-akte]").forEach(tr => tr.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            this.showPlayerDetailsModal(tr.dataset.u19Akte, { abschnitt: "unterbau" });
        }));
        this.bindeUnterbauKnoepfe(el);
    },

    /**
     * Oben im Reiter: der ganze Nachwuchs auf einen Blick - zweite
     * Mannschaft, U19, Akademie und Verliehene. Ein Tipp springt hin.
     * Vorher stand die U23 nur im Kader-Reiter und hier gar nicht.
     */
    renderNachwuchsUebersicht(state) {
        const el = document.getElementById("nachwuchsKennzahlen");
        if (!el) return;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const reserve = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        const youth = typeof YouthEngine !== "undefined" ? YouthEngine : null;
        const jl = typeof JugendligaEngine !== "undefined" ? JugendligaEngine : null;
        const loan = this.getLoanEngine ? this.getLoanEngine() : null;
        const platz = (tab) => { const z = tab.find(t => t.eigen); return z && z.spiele ? `${z.rang}. von ${tab.length}` : `${tab.length} Teams`; };
        const u23 = reserve ? reserve.spieler(state, club) : [];
        const u19 = jl ? jl.eigeneSpieler(state) : [];
        const talente = youth ? youth.eigeneTalente(state).filter(t => t && !t.promoted) : [];
        const weg = loan ? loan.verlieheneVon(state, club.id).filter(p => (p.age || 30) <= reserve?.ALTERSGRENZE) : [];
        const kacheln = [
            { titel: "U23", wert: `${u23.length} Spieler`, ziel: "u23Karte", extra: reserve && state.u23liga ? `<small>${platz(reserve.ligaTabelle(state))}</small>` : "" },
            { titel: "U19", wert: `${u19.length} Spieler`, ziel: "jugendligaKarte", extra: jl && state.jugendliga ? `<small>${platz(jl.tabelle(state))}</small>` : "" },
            { titel: "Akademie", wert: `${talente.length} Talente`, ziel: "youthProspectsBody" },
            { titel: "Verliehen", wert: `${weg.length} bis ${reserve ? reserve.ALTERSGRENZE : 23}`, ziel: "verliehenKarte" }
        ];
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        el.innerHTML = kacheln.map(k => `<button type="button" class="vk-kachel nw-kachel" data-ziel="${k.ziel}"><span>${esc(k.titel)}</span><strong>${esc(k.wert)}</strong>${k.extra || ""}</button>`).join("");
        el.querySelectorAll("[data-ziel]").forEach(b => b.addEventListener("click", () => {
            document.getElementById(b.dataset.ziel)?.closest(".dash-card, #" + b.dataset.ziel)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }));
    },

    /**
     * Die zweite Mannschaft im Reiter Jugend: ihre Liga mit Tabelle,
     * letzten Spielen und Torjägern, der Kader mit Bilanz je Spieler und
     * junge Profis ohne Einsatz, die in der U23 spielen könnten.
     */
    renderU23(state) {
        const el = document.getElementById("u23Karte");
        const R = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        if (!el || !R) return;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const liga = R.ligaStarte(state);
        if (!club || !liga) { el.hidden = true; return; }
        el.hidden = false;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const saison = state.seasonYear || 1;
        const tabelle = R.ligaTabelle(state);
        // Lange Tabellen: die Spitze und das Umfeld der eigenen U23, der Rest auf Knopfdruck
        const eigenerRang = (tabelle.find(z => z.eigen) || { rang: 1 }).rang;
        const weit = (z) => tabelle.length > 10 && z.rang > 4 && Math.abs(z.rang - eigenerRang) > 2;
        const eigene = liga.eigene.slice(-5).reverse();
        const schuetzen = Object.values(liga.torschuetzen).sort((a, b) => b.tore - a.tore).slice(0, 5);
        const { staerke, auffuellen } = R.u23Staerke(state, club);
        const kader = R.spieler(state, club).map(p => ({ p, b: R.bilanz(p, "u23", saison) }))
            .sort((a, b) => ((b.b?.form ?? 0) - (a.b?.form ?? 0)) || ((b.p.overall || 0) - (a.p.overall || 0)));
        // Junge Profis ohne Stammplatz: Kandidaten für Spielpraxis in der U23
        const elf = new Set((club.lineup || []).map(String));
        const bank = new Set((club.bench || []).map(String));
        const kandidaten = R.profis(state, club).filter(p => (p.age || 30) <= R.ALTERSGRENZE && !elf.has(String(p.id)) && !p.nominiertAus && !p.leihe)
            .sort((a, b) => (bank.has(String(a.id)) - bank.has(String(b.id))) || ((a.spielpraxis ?? 0.5) - (b.spielpraxis ?? 0.5))).slice(0, 6);
        const zeileKader = ({ p, b }) => `<tr data-u23-akte="${esc(p.id)}"><td>${esc(p.name)}${(p.injuredWeeks || 0) > 0 ? ' <span class="text-danger">verletzt</span>' : ""}</td><td>${esc(p.pos)}</td><td>${p.age || "-"}</td>
            <td>${this.starsFor(p.overall)}</td>${this.unterbauZellen(p, "u23")}<td>${Math.round((p.spielpraxis ?? 0.5) * 100)} %</td>
            <td><div class="unterbau-knoepfe"><button class="btn btn-sm btn-primary btn-nominieren" data-id="${esc(p.id)}" title="Nach dem nächsten Ligaspiel geht er zurück">Spieltag</button><button class="btn btn-sm btn-secondary btn-unterbau-hoch" data-id="${esc(p.id)}" title="Für immer zu den Profis">Ganz hoch</button></div></td></tr>`;
        el.innerHTML = `
            <div class="card-header"><h3>🛡️ Zweite Mannschaft (U23)</h3><span class="header-tag">${esc(liga.name)} · ${liga.runde} / ${liga.runden.length} Spieltage${liga.meister ? ` · Meister: ${esc(liga.meister)}` : ""}</span></div>
            <p class="text-muted jl-hinweis">Die U23 spielt an jedem Spieltag der Profis gegen die zweite Mannschaft eines anderen Vereins aus dem Land. Wer dort spielt, sammelt Spielpraxis und steht den Profis nicht zur Verfügung. Höchstens ${R.MAX_UEBERALTERT} Spieler über ${R.ALTERSGRENZE}. Stärke im Moment ${staerke.toFixed(1).replace(".", ",")}${auffuellen ? `, ${auffuellen} ${auffuellen === 1 ? "Platz füllt" : "Plätze füllen"} Amateure auf` : ""}.</p>
            <div class="jl-raster">
                <div class="table-container">
                    <table class="compact-table jl-tabelle" id="u23Tabelle">
                        <thead><tr><th>Pl.</th><th>Team</th><th>Sp</th><th>Tore</th><th>Pkt</th></tr></thead>
                        <tbody>${tabelle.map(z => `<tr class="${z.eigen ? "jl-eigen" : ""}${weit(z) ? " jl-weit" : ""}"><td>${z.rang}.</td><td>${esc(z.name)}</td><td>${z.spiele}</td><td>${z.tore}:${z.gegentore}</td><td><strong>${z.punkte}</strong></td></tr>`).join("")}</tbody>
                    </table>
                    ${tabelle.some(weit) ? `<button type="button" class="btn-link jl-alle" data-tabelle="u23Tabelle">Ganze Tabelle (${tabelle.length} Teams)</button>` : ""}
                </div>
                <div>
                    <h4>Letzte Spiele</h4>
                    ${eigene.length ? `<ul class="jl-spiele">${eigene.map(e => {
                        const art = e.tore > e.gegentore ? "s" : (e.tore === e.gegentore ? "u" : "n");
                        return `<li><span class="jl-erg jl-${art}">${e.tore}:${e.gegentore}</span><span>${e.heim ? "gegen" : "bei"} ${esc(e.gegner)}<small>${e.schuetzen && e.schuetzen.length ? `Tore: ${esc(e.schuetzen.join(", "))}` : `${e.runde}. Spieltag`}</small></span></li>`;
                    }).join("")}</ul>` : `<p class="text-muted">Die U23 spielt zum ersten Mal mit dem ersten Spieltag der Profis.</p>`}
                    ${schuetzen.length ? `<h4>Torjäger der U23</h4><ol class="jl-schuetzen">${schuetzen.map(t => `<li>${esc(t.name)}<b>${t.tore}</b></li>`).join("")}</ol>` : ""}
                </div>
            </div>
            <h4 class="unterbau-titel">Kader der U23</h4>
            ${kader.length ? `<div class="table-container"><table class="compact-table u23-tabelle">
                <thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Sp</th><th>Tore</th><th>Ø</th><th>Form</th><th>Praxis</th><th></th></tr></thead>
                <tbody>${kader.map(zeileKader).join("")}</tbody></table></div>`
                : `<p class="text-muted">Niemand spielt gerade in der U23 - die Elf stellen Amateure.</p>`}
            ${kandidaten.length ? `<h4 class="unterbau-titel">Ohne Einsatz bei den Profis: Spielpraxis in der U23</h4>
                <div class="table-container"><table class="compact-table nw-tabelle">
                <thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Praxis</th><th></th></tr></thead>
                <tbody>${kandidaten.map(p => `<tr data-u23-akte="${esc(p.id)}"><td>${esc(p.name)}${bank.has(String(p.id)) ? ' <span class="text-muted">Bank</span>' : ""}</td><td>${esc(p.pos)}</td><td>${p.age || "-"}</td><td>${this.starsFor(p.overall)}</td><td>${Math.round((p.spielpraxis ?? 0.5) * 100)} %</td>
                    <td><button class="btn btn-sm btn-secondary btn-unterbau-runter" data-id="${esc(p.id)}" title="Spielt in der U23 und steht den Profis nicht zur Verfügung">In die U23</button></td></tr>`).join("")}</tbody></table></div>` : ""}`;
        el.querySelectorAll("[data-u23-akte]").forEach(tr => tr.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            this.showPlayerDetailsModal(tr.dataset.u23Akte, { abschnitt: "unterbau" });
        }));
        el.querySelector(".jl-alle")?.addEventListener("click", (e) => {
            const tab = document.getElementById(e.currentTarget.dataset.tabelle);
            const alle = tab?.classList.toggle("alle");
            e.currentTarget.textContent = alle ? "Weniger zeigen" : `Ganze Tabelle (${tabelle.length} Teams)`;
        });
        this.bindeUnterbauKnoepfe(el);
    },

    /** Junge Spieler, die gerade verliehen sind: wo, wie viel Praxis, bis wann */
    renderVerlieheneTalente(state) {
        const el = document.getElementById("verliehenKarte");
        const loan = this.getLoanEngine ? this.getLoanEngine() : null;
        if (!el || !loan) return;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const grenze = typeof ReserveEngine !== "undefined" ? ReserveEngine.ALTERSGRENZE : 23;
        const weg = loan.verlieheneVon(state, club.id).filter(p => (p.age || 30) <= grenze)
            .sort((a, b) => (a.age || 0) - (b.age || 0));
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const verein = (id) => state.clubs.find(c => c.id === id);
        const liga = (c) => (state.leagues || []).find(l => l.id === c?.leagueId);
        el.innerHTML = `
            <div class="card-header"><h3>✈️ Verliehene Talente</h3><span class="header-tag">bis ${grenze} Jahre</span></div>
            ${weg.length ? `<div class="table-container"><table class="compact-table nw-tabelle">
                <thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Bei</th><th>Praxis</th><th>Bis</th></tr></thead>
                <tbody>${weg.map(p => {
                    const v = verein(p.leihe.leihvereinId);
                    return `<tr data-leih-akte="${esc(p.id)}"><td>${esc(p.name)}</td><td>${esc(p.pos)}</td><td>${p.age || "-"}</td><td>${this.starsFor(p.overall)}</td>
                        <td>${esc(v ? v.name : "?")}<small class="text-muted"> ${esc(liga(v)?.shortName || liga(v)?.name || "")}</small></td>
                        <td>${Math.round((p.spielpraxis ?? 0.5) * 100)} %</td><td>${p.leihe.bisWinter ? "Winterpause" : "Saisonende"}${p.leihe.rueckholrecht ? " · Rückholrecht" : ""}</td></tr>`;
                }).join("")}</tbody></table></div>`
                : `<p class="text-muted">Kein junger Spieler ist gerade verliehen. Verleihen lässt sich über die Akte eines Spielers, unter <em>Entwicklung</em>.</p>`}`;
        el.querySelectorAll("[data-leih-akte]").forEach(tr => tr.addEventListener("click", () => this.showPlayerDetailsModal(tr.dataset.leihAkte)));
    },

    /**
     * Der Kader der U19: Talente der Akademie und junge Profis, mit ihrer
     * Bilanz - wer in Form ist, steht oben und lässt sich hochziehen.
     */
    u19KaderHtml(state, engine) {
        const reserve = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        const youth = typeof YouthEngine !== "undefined" ? YouthEngine : null;
        if (!reserve || !youth) return "";
        const saison = state.seasonYear || 1;
        const talente = new Set(youth.eigeneTalente(state).filter(t => t && !t.promoted));
        const kader = engine.eigeneSpieler(state).map(p => ({ p, b: reserve.bilanz(p, "u19", saison), talent: talente.has(p) }))
            .sort((a, b) => ((b.b?.form ?? 0) - (a.b?.form ?? 0)) || ((b.p.overall || 0) - (a.p.overall || 0)));
        if (!kader.length) return "";
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const ab = youth.MIT_PROFIS.abAlter;
        const aktion = (k) => {
            if (k.talent) {
                if ((k.p.age || 0) < ab) return `<span class="text-muted">ab ${ab}</span>`;
                if (youth.offeneAnfrage(state, k.p.id)) return `<span class="text-muted">Anfrage offen</span>`;
                return `<div class="unterbau-knoepfe"><button class="btn btn-sm btn-primary btn-hochziehen-spieltag" data-talent-id="${esc(k.p.id)}" title="Für den nächsten Ligaspieltag - danach spielt er in der U19">Spieltag</button>`
                    + `<button class="btn btn-sm btn-secondary btn-hochziehen" data-talent-id="${esc(k.p.id)}">Ganz hoch</button></div>`;
            }
            return reserve.inU19(k.p)
                ? `<div class="unterbau-knoepfe"><button class="btn btn-sm btn-primary btn-nominieren" data-id="${esc(k.p.id)}">Spieltag</button>`
                    + `<button class="btn btn-sm btn-secondary btn-unterbau-hoch" data-id="${esc(k.p.id)}">Ganz hoch</button></div>`
                : `<span class="text-muted" title="Profi ohne Stammplatz - spielt in der U19 mit">Profikader</span>`;
        };
        return `
            <h4 class="unterbau-titel">Kader der U19</h4>
            <div class="table-container">
                <table class="compact-table u19-kader">
                    <thead><tr><th>Spieler</th><th>Pos</th><th>Alter</th><th>Stärke</th><th>Sp</th><th>Tore</th><th>Ø</th><th>Form</th><th></th></tr></thead>
                    <tbody>${kader.map(k => `<tr class="row-clickable" data-u19-akte="${esc(k.p.id)}"><td><strong>${esc(k.p.name)}</strong> <span class="text-muted">${k.talent ? "Akademie" : (reserve.inU19(k.p) ? "Profi in der U19" : "Profi")}</span></td><td>${esc(k.p.pos)}</td><td>${k.p.age || "-"}</td><td>${k.p.overall || "-"}</td>${this.unterbauZellen(k.p, "u19")}<td>${aktion(k)}</td></tr>`).join("")}</tbody>
                </table>
            </div>
            <p class="text-muted jl-hinweis"><em>Spieltag</em> holt nur für das nächste Ligaspiel hoch, <em>Ganz hoch</em> für immer. Hochgezogene Talente spielen mit ihrem Jugendvertrag bei den Profis - ab ${ab}, ohne Berater. Den Profivertrag bieten Sie ihnen in der Akte an. Junge Profis bis ${youth.AKADEMIE_HOECHSTALTER} schicken Sie über die Akte in die U19.</p>`;
    },

    /**
     * Talente aus den Akademien kleinerer Vereine: Jugendliche ohne
     * Profivertrag, die man gegen die Ausbildungsentschädigung holen kann.
     */
    renderFremdeTalente(state) {
        const box = document.getElementById("youthFremde");
        const youth = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : (typeof window !== "undefined" ? window.YouthEngine : null);
        if (!box || !youth || typeof youth.fremdeTalente !== "function") return;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const liste = youth.fremdeTalente(state);
        const voll = youth.akademiePlaetze(state, club).frei <= 0;
        const esc = (x) => this.escapeHtml(String(x ?? ""));
        const ne = this.getNegotiationEngine();
        const offen = ne ? ne.getOpenNegotiations(state).filter(n => n.type === "fremdtalent") : [];
        const knopf = (t) => {
            const laeuft = offen.find(n => String(n.prospectId) === String(t.id));
            return laeuft
                ? `<button class="btn btn-sm btn-secondary btn-fremd-verhandlung" data-neg="${esc(laeuft.id)}">Verhandlung</button>`
                : `<button class="btn btn-sm btn-primary btn-fremd-holen" data-id="${esc(t.id)}" ${voll ? "disabled title=\"Die Akademie ist voll\"" : ""}>Anfragen</button>`;
        };
        box.innerHTML = `
            <div class="card-header"><h3>Talente anderer Akademien</h3><span class="header-tag">${liste.length} im Blick</span></div>
            <p class="text-muted fremde-hinweis">Jugendliche ohne Profivertrag, die unsere Nachwuchsabteilung im Blick hat. Erst einigen wir uns mit seinem Verein auf die Ausbildungsentschädigung, dann entscheidet die Familie.</p>
            <div>
                ${liste.length ? `<div class="fremde-liste">${liste.map(t => `
                    <div class="fremde-zeile">
                        <div class="fremde-name"><strong>${esc(t.name)}</strong> <span class="pos-tag pos-${this.getPosGroup(t.pos)}">${esc(t.pos)}</span>
                            <span class="text-muted">${t.age} Jahre · ${this.flaggeVon ? this.flaggeVon(state.clubs.find(c => c.id === t.vonClubId)?.countryId) : ""} ${esc(t.vonClubName)}</span></div>
                        <div class="fremde-urteil">Nachwuchsleiter: ${esc(youth.fremdEinschaetzung(state, t))}</div>
                        <div class="fremde-aktion"><span title="Forderung seines Vereins">${this.formatMoneySafe(t.betrag)}</span>
                            ${knopf(t)}</div>
                    </div>`).join("")}</div>`
                    : `<p class="text-muted fremde-leer">In dieser Saison hat die Nachwuchsabteilung niemanden mehr im Blick.</p>`}
            </div>`;
        // Kein Sofortkauf mehr: Die Anfrage eröffnet die Verhandlung (NegotiationEngine.startFremdtalent)
        box.querySelectorAll(".btn-fremd-holen").forEach(btn => {
            btn.addEventListener("click", () => {
                const res = ne ? ne.startFremdtalent(state, btn.dataset.id) : { success: false, error: "Nicht verfügbar." };
                if (!res.success && !res.negotiation) return this.showToast(res.error, "error");
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                if (res.success) this.showToast(`Anfrage an ${res.negotiation.sellerClubName}: Machen Sie Ihr Angebot zur Ausbildungsentschädigung.`, "success", 5000);
                this.zeigeVerhandlung(res.negotiation.id);
            });
        });
        box.querySelectorAll(".btn-fremd-verhandlung").forEach(btn => btn.addEventListener("click", () => this.zeigeVerhandlung(btn.dataset.neg)));
    },

    renderAkademieZugang(state) {
        const box = document.getElementById("youthZugang");
        const youth = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine : (typeof window !== "undefined" ? window.YouthEngine : null);
        if (!box || !youth || typeof youth.sichtungsLage !== "function") return;
        const club = state.clubs.find(c => c.id === state.userClubId);
        const lage = youth.sichtungsLage(state);
        const chance = youth.probetrainingChance(state, club);
        const wochen = Math.max(1, Math.round(1 / chance / 7));
        const jugendtag = youth.jugendtagSpieltag(state);
        const jugendtagText = (state.youthAcademy?.jugendtagSaison === state.seasonYear)
            ? "Der Jugendtag dieser Saison war schon"
            : `Jugendtag um den ${jugendtag}. Spieltag`;
        const knopf = lage.warten > 0
            ? `<button class="btn btn-sm btn-secondary" disabled>Nächster Sichtungstag in ${lage.warten} Tagen</button>`
            : lage.plaetze.frei <= 0
                ? `<button class="btn btn-sm btn-secondary" disabled>Akademie voll</button>`
                : `<button class="btn btn-sm btn-primary" id="btnSichtungstag">Sichtungstag ansetzen (${this.formatMoneySafe(lage.kosten)})</button>`;
        // Die Jugendvorschau: Der Jahrgang ist gesichtet, der Nachwuchsleiter beschreibt ihn
        const vs = typeof youth.vorschau === "function" ? youth.vorschau(state) : null;
        const bericht = vs ? youth.vorschauBericht(state, club, vs.talente) : null;
        const urteilIcon = { golden: "🌟", gut: "✨", ordentlich: "🎓", schwach: "🌧️" };
        const vorschauHtml = bericht ? `
            <div class="jugend-vorschau jv-${bericht.urteil}">
                <div class="jv-kopf">${urteilIcon[bericht.urteil] || "🎓"} <strong>Jugendvorschau</strong>
                    <span class="text-muted">Jahrgang um den ${vs.tag}. Spieltag · ${vs.talente.length} Talente</span></div>
                <p class="jv-text">${this.escapeHtml(bericht.text)}</p>
                <div class="jv-pos">${Object.entries(bericht.positionen).map(([w, n]) => `<span class="mp-chip">${n > 1 ? `${n}× ` : ""}${this.escapeHtml(w)}</span>`).join("")}</div>
                <p class="jv-hinweis">Andere Schwerpunkte (unten) lassen die Scouts bis zum Jugendtag neu sichten.</p>
            </div>` : "";
        box.innerHTML = `
            <div class="akademie-zugang">
                <div class="akademie-zugang-text">
                    <strong>${lage.plaetze.belegt} von ${lage.plaetze.plaetze} Plätzen belegt</strong>
                    <span>${this.escapeHtml(jugendtagText)} · Probetrainings etwa alle ${wochen} Wochen · Jugendverträge bis ${youth.AKADEMIE_HOECHSTALTER}, Profivertrag ab ${youth.profiAb(club)}</span>
                </div>
                ${knopf}
            </div>
            ${vorschauHtml}`;
        document.getElementById("btnSichtungstag")?.addEventListener("click", () => {
            const res = youth.sichtungstag(state);
            if (!res.success) return this.showToast(res.error, "error");
            this.playSound("click");
            this.showToast(`🎓 Sichtungstag: ${res.neu.map(t => t.name).join(", ")} ${res.neu.length === 1 ? "kommt" : "kommen"} in die Akademie.`, "success", 6000);
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderHeader();
            this.renderJugend();
        });
    },

    renderAkademieSchwerpunkte(state, club) {
        const box = document.getElementById("youthSchwerpunkte");
        const youth = (typeof YouthEngine !== "undefined" && YouthEngine) ? YouthEngine
            : ((typeof window !== "undefined" && window.YouthEngine) ? window.YouthEngine : null);
        if (!box || !club || !youth || typeof youth.schwerpunkteVon !== "function") return;

        const fac = (typeof FacilityEngine !== "undefined" && FacilityEngine) ? FacilityEngine
            : ((typeof window !== "undefined" && window.FacilityEngine) ? window.FacilityEngine : null);
        const profile = fac?.AKADEMIE_PROFILE || {};
        const sp = youth.schwerpunkteVon(club);
        const saison = state.seasonYear || 1;
        const profilGesperrt = sp.profilSaison === saison;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const ATTR = {
            technique: "Technik", passing: "Passspiel", dribbling: "Dribbling", physical: "Physis", pace: "Tempo",
            stamina: "Ausdauer", vision: "Übersicht", positioning: "Stellungsspiel", defense: "Zweikampf"
        };

        const chip = (gruppe, wert, text, aktiv, titel = "", gesperrt = false) =>
            `<button type="button" class="sp-chip${aktiv ? " aktiv" : ""}" data-sp="${gruppe}" data-wert="${esc(wert)}"`
            + `${titel ? ` title="${esc(titel)}"` : ""}${gesperrt && !aktiv ? " disabled" : ""}>${esc(text)}</button>`;

        const profilChips = Object.entries(profile).map(([key, p]) => {
            const titel = p.staerken?.length
                ? `Stärker: ${p.staerken.map(a => ATTR[a] || a).join(", ")}${p.schwaechen?.length ? ` · schwächer: ${p.schwaechen.map(a => ATTR[a] || a).join(", ")}` : ""}`
                : "Keine Handschrift - alle Fähigkeiten gleich gewichtet";
            return chip("profil", key, p.name, sp.profil === key, titel, profilGesperrt);
        }).join("");
        const posChips = Object.entries(youth.SCHWERPUNKT_POSITIONEN).map(([key, g]) =>
            chip("positionen", key, g.name, sp.positionen.includes(key), g.positionen.join(", "))).join("");
        const jahrgangChips = Object.entries(youth.JAHRGAENGE).map(([key, j]) =>
            chip("jahrgang", key, `${j.name} (${j.anzahl})`, sp.jahrgang === key, j.text)).join("");
        const einzugChips = Object.entries(youth.EINZUG).map(([key, e]) => {
            const kosten = youth.einzugKosten(club, key);
            return chip("einzug", key, `${e.name}${kosten > 0 ? ` · ${this.geldKurz(kosten)}` : ""}`, sp.einzug === key, e.text);
        }).join("");

        // Der Nachwuchsleiter entscheidet mit
        const stab = this.getCoachingStaffEngine();
        const leiterGuete = stab ? stab.staffQuality(club).nachwuchs : null;
        const leiter = club.staff?.nachwuchs;
        const leiterBonus = typeof youth.leiterBonus === "function" ? youth.leiterBonus(state, club) : 0;
        const leiterText = leiterGuete === null ? ""
            : leiterBonus > 0 ? `holt mehr aus jedem Jahrgang heraus (Potenzial +${leiterBonus})`
            : leiterBonus < 0 ? `kostet jeden Jahrgang Potenzial (${leiterBonus})${leiter ? "" : " - der Posten ist offen"}`
            : "arbeitet solide";

        const jahrgang = youth.JAHRGAENGE[sp.jahrgang];
        const einzug = youth.EINZUG[sp.einzug];
        const potSumme = jahrgang.pot + einzug.pot + leiterBonus;
        const kosten = youth.einzugKosten(club, sp.einzug);
        // Wann der nächste Jahrgang kommt: am Jugendtag im Frühjahr
        const tagJugend = typeof youth.jugendtagSpieltag === "function" ? youth.jugendtagSpieltag(state) : null;
        const schonGewesen = state.youthAcademy?.jugendtagSaison === (state.seasonYear || 1);
        const jugendtagText = tagJugend === null ? "zum Saisonstart"
            : schonGewesen ? `am Jugendtag der nächsten Saison (um den ${tagJugend}. Spieltag)`
            : (() => {
                const rest = tagJugend - (state.currentMatchday || 1);
                return `am Jugendtag um den ${tagJugend}. Spieltag`
                    + (rest > 1 ? ` (noch ${rest} Spieltage)` : rest === 1 ? " (nächster Spieltag)" : "");
            })();
        const posText = sp.positionen.length
            ? sp.positionen.map(k => youth.SCHWERPUNKT_POSITIONEN[k].name).join(" und ")
            : "alle Positionen";

        box.innerHTML = `
            ${leiterGuete !== null ? `<div class="akademie-leiter">🎓 <span class="stab-info-titel">Nachwuchsleiter</span>
                <strong>${esc(leiter?.name || "Posten offen · Aushilfe")}</strong> ${this.stabSterneHtml(leiterGuete)}
                <span class="text-muted">${esc(leiterText)}</span></div>` : ""}
            <div class="sp-gruppe">
                <div class="sp-titel">Ausbildung <span class="sp-hinweis">${profilGesperrt ? "in dieser Saison schon umgestellt" : "einmal je Saison änderbar"}</span></div>
                <div class="sp-reihe">${profilChips}</div>
            </div>
            <div class="sp-gruppe">
                <div class="sp-titel">Positionen <span class="sp-hinweis">bis zu zwei Schwerpunkte</span></div>
                <div class="sp-reihe">${posChips}</div>
            </div>
            <div class="sp-gruppe">
                <div class="sp-titel">Jahrgang</div>
                <div class="sp-reihe">${jahrgangChips}</div>
            </div>
            <div class="sp-gruppe">
                <div class="sp-titel">Einzugsgebiet <span class="sp-hinweis">Kosten je Jahrgang</span></div>
                <div class="sp-reihe">${einzugChips}</div>
            </div>
            ${sp.einzug === "international" && youth.INTERNATIONAL ? `<div class="sp-erklaerung">🌍 Rund ${Math.round((1 - einzug.heimat) * 100)} % der Talente kommen aus dem Ausland, aus ${youth.WELT_NATIONEN.length} Nationen. Sie bringen ${youth.INTERNATIONAL.auslandPot} Potenzial mehr mit als die aus dem Umland, und etwa eines von ${Math.round(1 / youth.INTERNATIONAL.ausnahmeChance)} ist ein Ausnahmetalent (+${youth.INTERNATIONAL.ausnahmePot}). Wo Sie einen Regionalscout haben (Scouting-Zentrale), sucht das Netz öfter, und dort ist schon eines von ${Math.round(1 / youth.INTERNATIONAL.ausnahmeChanceRegion)} ein Ausnahmetalent. Bedenken Sie: Wer nicht aus der EU kommt, belegt in Spanien einen Nicht-EU-Platz.</div>` : ""}
            <div class="sp-fazit">Nächster Jahrgang ${jugendtagText}: <strong>${jahrgang.anzahl} Talente</strong>, Schwerpunkt ${esc(posText)},
                Potenzial <strong>${potSumme >= 0 ? "+" : ""}${potSumme}</strong> gegenüber einem normalen Jahrgang${kosten > 0 ? `, Sichtung ${this.geldKurz(kosten)}` : ""}.</div>`;

        box.querySelectorAll(".sp-chip").forEach(btn => {
            btn.addEventListener("click", () => {
                const gruppe = btn.dataset.sp;
                const wert = btn.dataset.wert;
                let aenderung;
                if (gruppe === "positionen") {
                    const liste = sp.positionen.includes(wert)
                        ? sp.positionen.filter(k => k !== wert)
                        : [...sp.positionen, wert];
                    // Beim dritten Klick fällt der älteste Schwerpunkt heraus
                    aenderung = { positionen: liste.slice(-2) };
                } else {
                    aenderung = { [gruppe]: wert };
                }
                const res = youth.setzeSchwerpunkte(state, club.id, aenderung);
                if (!res.ok) {
                    this.showToast(res.meldung, "warning");
                    return;
                }
                if (gruppe === "profil") {
                    this.showToast(`Die Akademie bildet ab dem nächsten Jahrgang als ${profile[wert]?.name || wert} aus.`, "success");
                }
                if (res.vorschauNeu) {
                    const b = youth.vorschauBericht(state, club, youth.vorschau(state)?.talente || []);
                    this.showToast(`🎓 Neu gesichtet: ${b.text}`, "info", 7000);
                }
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderJugend();
            });
        });
    },

    /**
     * Der Trainerstab und sein aktueller Plan.
     *
     * Der Manager sieht, wer gerade entscheidet und warum. Ändert er einen
     * Schwerpunkt, wird daraus automatisch ein Veto - hier steht dann, wie
     * lange es noch gilt.
     */
    renderCoachingStaffCard() {
        const body = document.getElementById("staffPlanBody");
        const tag = document.getElementById("staffQualityTag");
        const btn = document.getElementById("btnStaffTakeOver");
        if (!body) return;

        const state = this.app.state;
        const staff = this.getCoachingStaffEngine();
        const club = state.clubs.find(c => c.id === state.userClubId);
        if (!staff || !club) return;

        const stab = staff.staffQuality(club);
        const veto = staff.activeVeto(state);
        const plan = state.trainingSettings?.lastPlan;

        if (tag) {
            tag.textContent = `${stab.titel} · ${stab.overall}`;
            tag.style.background = stab.overall >= 68 ? "rgba(34,197,94,0.18)"
                : stab.overall >= 48 ? "rgba(56,189,248,0.18)" : "rgba(148,163,184,0.18)";
        }

        const fach = (name, wert) => `
            <div class="stab-fach">
                <span class="stab-fach-name">${name}</span>
                <span class="mini-bar"><span class="mini-bar-fill" style="width:${wert}%"></span></span>
                <strong>${wert}</strong>
            </div>`;

        const planText = plan
            ? `<div class="hint-box" style="margin:10px 0 0;">
                   <strong>${plan.vomManager ? "Ihre Vorgabe" : "Plan des Stabs"}:</strong>
                   ${this.escapeHtml(staff.focusLabel(plan.focus))}, ${this.escapeHtml(staff.intensityLabel(plan.intensity))}<br>
                   <span class="text-muted">${this.escapeHtml(plan.grund || "")}</span>
               </div>`
            : `<div class="hint-box" style="margin:10px 0 0;">Der Stab plant die erste Einheit, sobald der nächste Tag beginnt.</div>`;

        body.innerHTML = `
            <p class="text-muted" style="margin:0 0 10px; font-size:12px;">
                Sie führen den Verein, nicht die Trainingsgruppe: Der Stab plant die Einheiten selbst.
                Ändern Sie Schwerpunkt oder Intensität, gilt Ihre Vorgabe für ${staff.VETO_DAUER_TAGE} Tage.
            </p>
            <div class="stab-faecher">
                ${fach("Co-Trainer (Livespiel)", stab.coTrainer ?? stab.analyse)}
                ${fach("Athletik & Fitness", stab.fitness)}
                ${fach("Spielanalyse", stab.analyse)}
                ${fach("Medizinische Abteilung", stab.medizin)}
                ${fach("Nachwuchsarbeit", stab.nachwuchs)}
            </div>
            ${planText}
            ${veto ? `<div style="margin-top:8px; color:#f59e0b; font-weight:600; font-size:12px;">
                ⏳ Ihr Veto gilt noch ${veto.daysRemaining} Tag(e).</div>` : ""}
        `;

        if (btn) btn.style.display = veto ? "inline-flex" : "none";
    },

    /**
     * Trainingsbericht zwischen den Spieltagen: Belastung, Ermüdung,
     * Spielschärfe, Verletzungsrisiko und Entwicklung je Spieler.
     */
    /**
     * Die Einschätzung des Stabs als kurzes Etikett, der ganze Satz im Tooltip.
     * Vorher stand "Deutlich überlastet - Pause dringend empfohlen" in jeder
     * zweiten Zeile und machte sie vier Zeilen hoch.
     */
    trainingsEinschaetzung(text) {
        const t = String(text || "");
        const [kurz, art] = /^Verletzt/.test(t) ? ["Verletzt", "rot"]
            : /überlastet/i.test(t) ? ["Pause nötig", "rot"]
            : /^Müde/.test(t) ? ["Schonen", "gelb"]
            : /Verletzungsrisiko/.test(t) ? ["Risiko", "gelb"]
            : /Spielpraxis/.test(t) ? ["Praxis fehlt", "blau"]
            : /^Belastbar/.test(t) ? ["Belastbar", "gruen"]
            : [t, ""];
        return `<span class="tr-etikett ${art}" title="${this.escapeHtml(t)}">${this.escapeHtml(kurz)}</span>`;
    },

    renderTrainingReport() {
        const state = this.app.state;
        const body = document.getElementById("trainingReportBody");
        const meta = document.getElementById("trainingReportMeta");
        if (!body) return;

        const trainingEngine = (typeof TrainingEngine !== "undefined" && TrainingEngine)
            ? TrainingEngine
            : ((typeof window !== "undefined" && window.TrainingEngine) ? window.TrainingEngine : null);

        const report = (trainingEngine && typeof trainingEngine.buildTrainingReport === "function")
            ? trainingEngine.buildTrainingReport(state, state.userClubId)
            : state.trainingReport;

        if (!report || !Array.isArray(report.entries) || report.entries.length === 0) {
            body.innerHTML = `<tr><td colspan="9" class="text-center text-muted">Noch kein Trainingstag absolviert.</td></tr>`;
            return;
        }

        const INTENSITAET = { low: "Locker", normal: "Normal", high: "Intensiv" };
        if (meta) {
            meta.textContent = `${report.date || "Aktuell"} · Intensität: ${INTENSITAET[report.intensity] || report.intensity}`;
        }

        body.innerHTML = report.entries.map(e => {
            const risikoFarbe = e.injuryRiskPercent >= 5 ? "#f87171" : e.injuryRiskPercent >= 2 ? "#f59e0b" : "#34d399";
            const ermuedungFarbe = e.fatigue >= 45 ? "#f87171" : e.fatigue >= 28 ? "#f59e0b" : "#34d399";
            const entwicklung = e.developmentWeek > 0
                ? `<span style="color:#34d399;">+${e.developmentWeek}</span>`
                : (e.developmentWeek < 0 ? `<span style="color:#f87171;">${e.developmentWeek}</span>` : `<span class="text-muted">–</span>`);

            return `
                <tr class="row-clickable" data-player-id="${e.playerId}" title="Details zu ${this.escapeHtml(e.name)} öffnen">
                    <td class="nowrap"><strong>${this.escapeHtml(e.name)}</strong> <span class="text-muted" style="font-size:11px;">${e.age} J.</span></td>
                    <td><span class="pos-tag pos-${this.getPosGroup(e.pos)}">${e.pos}</span></td>
                    <td class="nowrap">
                        <span class="mini-bar"><span class="mini-bar-fill" style="width:${Math.round(e.fitness)}%;background:${this.fitnessFarbe(e.fitness)}"></span></span>
                        ${Math.round(e.fitness)}%
                    </td>
                    <td><strong style="color:${ermuedungFarbe};">${Math.round(e.fatigue)}</strong></td>
                    <td>${String(e.load).replace(".", ",")}</td>
                    <td class="nowrap">
                        <span class="mini-bar"><span class="mini-bar-fill" style="width:${Math.round(e.sharpness)}%; background:#38bdf8;"></span></span>
                        ${Math.round(e.sharpness)}%
                    </td>
                    <td class="nowrap"><strong style="color:${risikoFarbe};">${e.injuryRiskPercent.toFixed(1).replace(".", ",")} %</strong></td>
                    <td>${entwicklung}</td>
                    <td>${this.trainingsEinschaetzung(e.note)}</td>
                </tr>
            `;
        }).join("");

        body.querySelectorAll("tr.row-clickable").forEach(row => {
            row.addEventListener("click", () => {
                const pId = this.resolvePlayerId(row.dataset.playerId);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            });
        });
    },
});
