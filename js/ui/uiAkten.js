/**
 * Akten: Spielerakte und Vereinsakte mit Gesprächen, Entwicklungsplan, Leihe und Vertrag.
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
     * Zeigt an, wie belastbar die Werte eines Spielers sind (Scoutwissen)
     */
    /** Wann sich ein umworbener Spieler entscheidet: "in 4 Tagen", "morgen" */
    bedenkzeitText(anfrage) {
        const rest = Math.max(0, (anfrage?.entscheidetTag ?? 0) - (this.app.state.currentDayIndex || 0));
        return this.wannText(rest);
    },

    buildScoutConfidenceHtml(confidence, confInfo, isUserPlayer) {
        const pct = Math.max(0, Math.min(100, Math.round(confidence)));
        const note = isUserPlayer
            ? "Eigene Spieler sind vollständig bekannt."
            : (confInfo?.hint || "");

        return `
            <div class="scout-confidence-bar">
                <span style="font-weight:700; color:${confInfo?.color || '#94a3b8'};">🔍 ${confInfo?.label || 'Unbekannt'}</span>
                <div class="scout-confidence-track">
                    <div class="scout-confidence-fill" style="width:${pct}%; background:${confInfo?.color || '#94a3b8'};"></div>
                </div>
                <span style="font-weight:700;">${pct}%</span>
                <span style="color:var(--text-muted); flex-basis:100%;">${note}</span>
            </div>
        `;
    },

    /**
     * Positionsprofil eines Spielers: Auf welchen Positionen ist er wie stark?
     */
    buildPositionMapHtml(player, confidence = 100) {
        const posEngine = this.getPositionEngine();
        if (!posEngine || !player) return "";

        // Bei geringem Scoutwissen darf das Profil nicht die wahre Stärke
        // verraten - gerechnet wird deshalb mit der geschätzten Stärke.
        const ratingEngine = (typeof PlayerRatingEngine !== "undefined" && PlayerRatingEngine)
            ? PlayerRatingEngine
            : ((typeof window !== "undefined" && window.PlayerRatingEngine) ? window.PlayerRatingEngine : null);

        let basePlayer = player;
        let isEstimate = false;

        if (ratingEngine && confidence < 85) {
            const card = ratingEngine.calculateVisiblePlayerCard(player, Object.assign({ userClubId: null, leagueDataCoverage: 100 }, this.starContext()));
            const estOverall = ratingEngine.abilityToOverall(Math.round((card.estimatedCa.min + card.estimatedCa.max) / 2));
            basePlayer = { ...player, overall: estOverall };
            isEstimate = true;
        }

        const ranking = posEngine.getPositionRanking(basePlayer);
        const usable = ranking.filter(r => r.familiarity >= 0.55);
        const shown = usable.length > 0 ? usable.slice(0, 8) : ranking.slice(0, 4);

        const stamm = player.pos;
        const neben = (Array.isArray(player.positions) ? player.positions : []).filter(p => p !== stamm);
        const erfahrung = player.positionExperience || {};

        const rows = shown.map(r => {
            const istStamm = r.position === stamm;
            const istNeben = neben.includes(r.position);
            const lernt = !istStamm && !istNeben && (erfahrung[r.position] || 0) > 0;
            const titel = lernt
                ? `${r.label} · wird gerade eingelernt (${Math.round(erfahrung[r.position] * 100)} % Routine)`
                : `${r.label} (${r.familiarityPercent} % Vertrautheit)`;

            return `
            <div class="position-map-item${lernt ? " pos-learned" : ""}" title="${titel}">
                <span class="position-map-code" style="border-color:${r.color};${lernt ? "border-style:dashed;" : ""}">${r.position}</span>
                <span class="position-map-value" style="color:${r.color};">${this.starsFor(r.effectiveOverall, { color: r.color })}</span>
                <span class="position-map-label">${istStamm ? "Stammposition" : (istNeben ? "Nebenposition" : r.shortLabel)}</span>
            </div>
        `;
        }).join("");

        const nebenText = neben.length > 0
            ? `Nebenpositionen: <strong>${neben.map(p => this.escapeHtml(p)).join(", ")}</strong>.`
            : "Der Spieler ist auf keiner weiteren Position eingespielt.";

        return `
            <div class="dash-card mb-3" style="padding:14px;">
                <h4 style="font-size:13px; margin-bottom:4px; color:var(--text-muted);"><svg class="ico h-ico" aria-hidden="true"><use href="#i-pin"/></svg>Positionsprofil</h4>
                <p style="font-size:11px; color:var(--text-muted); margin:0 0 10px 0;">
                    Effektive Stärke je Einsatzposition – abseits der Stammposition verliert der Spieler an Wirkung.
                    ${nebenText} Wer regelmäßig woanders aufläuft, wächst mit der Zeit in die Position hinein.
                    ${isEstimate ? '<em>Die Werte beruhen auf einer Schätzung; mehr Scoutwissen macht sie genauer.</em>' : ''}
                </p>
                <div class="position-map${isEstimate ? ' estimated-value' : ''}">${rows}</div>
            </div>
        `;
    },

    /**
     * Modal: Spieler Details & Vertragsverlängerung
     */
    /**
     * Einen Spieler vom Scout beobachten lassen. Der Bericht kommt nach
     * einigen Tagen ins Postfach - nicht mehr sofort auf Knopfdruck.
     */
    beobachte(playerId, source, danach = null) {
        const state = this.app?.state;
        const engine = (typeof ScoutingEngine !== "undefined" && ScoutingEngine) ? ScoutingEngine : window.ScoutingEngine;
        if (!state || !engine || typeof engine.beobachteSpieler !== "function") return;
        const res = engine.beobachteSpieler(state, playerId, { source });
        if (!res.success) {
            this.showToast(res.error || "Der Scout kann gerade nicht los.", "warning", 5000);
            return;
        }
        this.playSound("whistle");
        this.showToast(`🔭 ${res.scout.name} beobachtet ${res.player.name} - Bericht in etwa ${res.tage} Tagen im Postfach.`, "success", 5000);
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        if (typeof danach === "function") danach();
    },

    /** Knopfbeschriftung: läuft schon eine Beobachtung? */
    beobachtungsText(playerId) {
        const engine = (typeof ScoutingEngine !== "undefined" && ScoutingEngine) ? ScoutingEngine : window.ScoutingEngine;
        const b = engine && typeof engine.beobachtungVon === "function" ? engine.beobachtungVon(this.app?.state, playerId) : null;
        return b ? `noch ${b.tageRest} T.` : null;
    },

    /**
     * Vereinsdetails für jeden Verein der Welt - aus der Tabelle, dem
     * Dashboard und dem Spielplan. Wie im FM: Kopf mit Kennzahlen, Form und
     * Spiele, Spielweise, Anlagen und der Kader, gesehen durch die Augen des
     * eigenen Scoutings (unbekannte Spieler bleiben geschätzt).
     */
    showClubDetailsModal(clubId) {
        const state = this.app?.state;
        const club = state?.clubs?.find(c => String(c.id) === String(clubId));
        if (!club) return;
        if (club.id === state.userClubId) {
            this.switchTab("club");
            return;
        }
        const modal = document.getElementById("modalVereinsDetails");
        const body = document.getElementById("vereinsDetailsInhalt");
        if (!modal || !body) return;
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const liga = (state.leagues || []).find(l => l.id === club.leagueId);
        const eigeneLiga = club.leagueId === this.getUserLeagueId(state);
        const tabelle = eigeneLiga ? (state.standings || []) : (state.standingsByLeague?.[club.leagueId] || []);
        const platz = tabelle.findIndex(s => s.clubId === club.id);
        const zeile = platz >= 0 ? tabelle[platz] : null;
        DOM.setText("vdTitel", club.name);

        // Kopf: Wappen, Liga, Ort und die Kennzahlen
        const kader = (club.playerIds || []).map(id => state.players.find(p => p.id === id)).filter(Boolean);
        const alter = kader.length ? kader.reduce((s, p) => s + (p.age || 0), 0) / kader.length : 0;
        const ruf = Math.round(club.reputation || 50);
        const plaetze = club.stadiumCapacity || club.capacity || 0;
        const balken = (wert) => `<span class="vk-balken"><i style="width:${Math.max(3, Math.min(100, wert))}%"></i></span>`;
        const kacheln = [
            ["Tabellenplatz", zeile ? `${platz + 1}.` : "—", `<small>${zeile ? `${zeile.points} Punkte · ${zeile.goalsFor}:${zeile.goalsAgainst}` : ""}</small>`],
            ["Mannschaft", "", `<div class="vd-sterne">${this.teamStarsFor(club, { compact: true }) || "—"}</div><small>gemessen an Ihrem Kader</small>`],
            ["Ruf", `${ruf}`, balken(ruf)],
            ["Fans", (club.fanBase || 0).toLocaleString("de-DE"), `<small>${plaetze.toLocaleString("de-DE")} Plätze</small>`],
            ["Kader", `${kader.length}`, `<small>Ø ${alter.toFixed(1).replace(".", ",")} Jahre</small>`],
            ["Stimmung", `${Math.round(club.fanMood || 70)} %`, balken(club.fanMood || 70)]
        ];

        // Derby gegen den eigenen Verein?
        const rivalen = (typeof RivalryEngine !== "undefined" && RivalryEngine && typeof RivalryEngine.findRivalry === "function" && userClub)
            ? RivalryEngine.findRivalry(club, userClub) : null;

        // Form und Spiele: die letzten fünf und die nächsten drei
        const plan = this.getScheduleForLeague(state, club.leagueId) || [];
        const spiele = [];
        plan.forEach(runde => (runde.matches || []).forEach(m => {
            if (m.homeClubId === club.id || m.awayClubId === club.id) spiele.push({ ...m, matchday: runde.matchday });
        }));
        const name = (id) => esc(state.clubs.find(c => c.id === id)?.name || "?");
        const gespielt = spiele.filter(m => m.played).slice(-5).reverse();
        const kommend = spiele.filter(m => !m.played).slice(0, 3);
        const ergebnisZeile = (m) => {
            const heim = m.homeClubId === club.id;
            const eigene = heim ? m.homeGoals : m.awayGoals;
            const fremde = heim ? m.awayGoals : m.homeGoals;
            const f = eigene > fremde ? "W" : eigene < fremde ? "L" : "D";
            return `<li>${this.formPunkt(f)}<span class="vd-gegner">${heim ? "" : "@ "}${name(heim ? m.awayClubId : m.homeClubId)}</span><strong>${eigene}:${fremde}</strong></li>`;
        };
        const naechstesZeile = (m) => {
            const heim = m.homeClubId === club.id;
            const gegenUns = (heim ? m.awayClubId : m.homeClubId) === state.userClubId;
            return `<li class="${gegenUns ? "vd-gegen-uns" : ""}"><span class="vd-st">${m.matchday}.</span><span class="vd-gegner">${heim ? "" : "@ "}${name(heim ? m.awayClubId : m.homeClubId)}</span><small>${heim ? "Heim" : "Auswärts"}</small></li>`;
        };

        // Spielweise: Formation und Grundhaltung
        const t = club.tactics || {};
        const W = {
            mentality: { defensive: "defensiv", balanced: "ausgewogen", attacking: "offensiv", "very-defensive": "sehr defensiv", "very-attacking": "sehr offensiv" },
            pressing: { low: "tief", medium: "mittel", high: "hoch" },
            tempo: { slow: "langsam", normal: "normal", fast: "schnell", high: "hoch" },
            passStyle: { short: "kurz", mixed: "gemischt", long: "lang", direct: "direkt" },
            defensiveLine: { deep: "tief", normal: "normal", high: "hoch" }
        };
        const wort = (k) => W[k]?.[t[k]] || (t[k] ? String(t[k]) : "—");
        const torjaeger = [...kader].sort((a, b) => (b.seasonStats?.goals || 0) - (a.seasonStats?.goals || 0))[0];

        // Anlagen: Stufe und Zustand
        const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
        const anlagen = fac ? fac.uebersicht(state, club.id) : [];
        const anlagenHtml = anlagen.map(a => `
            <div><span>${esc(a.name)}</span><strong>Stufe ${a.stufe}${a.projekt ? " · im Umbau" : ""}</strong></div>`).join("");

        // Kader nach Mannschaftsteilen, jeweils die Stärksten oben
        const ratingEngine = this.getRatingEngine();
        const gruppen = [["tw", "Tor"], ["def", "Abwehr"], ["mid", "Mittelfeld"], ["att", "Angriff"]];
        const kaderHtml = gruppen.map(([g, titel]) => {
            const leute = kader.filter(p => this.getPosGroup(p.pos) === g).sort((a, b) => (b.overall || 0) - (a.overall || 0));
            if (!leute.length) return "";
            return `<tr class="vd-gruppe"><td colspan="5">${titel}</td></tr>` + leute.map(p => {
                const card = ratingEngine ? ratingEngine.calculateVisiblePlayerCard(p,
                    Object.assign({ userClubId: state.userClubId, leagueDataCoverage: 85 }, this.starContext())) : null;
                return `<tr class="row-clickable" data-player-id="${esc(p.id)}">
                    <td><span class="pos-tag pos-${g}">${esc(p.pos)}</span></td>
                    <td><strong>${esc(p.name)}</strong>${this.signaturMarke(p)}<span class="tm-sub">${esc(p.nationality || "")}</span></td>
                    <td>${p.age}</td>
                    <td class="nowrap">${card ? card.abilityStarsHtml : this.abilityStarsFor(p, { compact: true })}</td>
                    <td class="nowrap vd-wert">${card ? card.visibleValueText : this.geldKurz(p.value)}</td>
                </tr>`;
            }).join("");
        }).join("");

        body.innerHTML = `
            <div class="vereins-kopf vd-kopf" style="--vk-farbe:${this.wappenFarben(club).farbe}40;">
                <div class="vk-wappen" id="vdWappen"></div>
                <div class="vk-titel">
                    <span class="vk-liga">${esc(liga?.shortName || liga?.name || "")}</span>
                    <h2>${esc(club.name)}</h2>
                    <span class="vk-ort">${esc([club.city, club.stadium].filter(Boolean).join(" · "))}</span>
                </div>
                <div class="vk-kacheln">${kacheln.map(([titel, wert, extra]) =>
                    `<div class="vk-kachel"><span>${esc(titel)}</span>${wert ? `<strong>${esc(wert)}</strong>` : ""}${extra || ""}</div>`).join("")}</div>
            </div>
            ${rivalen ? `<div class="hint-box vd-derby">🔥 <strong>${esc(rivalen.titel)}</strong> - gegen diesen Verein ist es mehr als ein Spiel.</div>` : ""}
            <div class="vd-raster">
                <div class="dash-card vd-karte">
                    <h4>Form</h4>
                    ${gespielt.length ? `<ul class="vd-spiele">${gespielt.map(ergebnisZeile).join("")}</ul>` : `<p class="muted-note">Noch keine Pflichtspiele.</p>`}
                    <h4>Nächste Spiele</h4>
                    ${kommend.length ? `<ul class="vd-spiele">${kommend.map(naechstesZeile).join("")}</ul>` : `<p class="muted-note">Keine Spiele mehr in dieser Saison.</p>`}
                </div>
                <div class="dash-card vd-karte">
                    <h4>Spielweise</h4>
                    <div class="kv-liste">
                        <div><span>Formation</span><strong>${esc(club.formation || t.formation || "—")}</strong></div>
                        <div><span>Grundhaltung</span><strong>${esc(wort("mentality"))}</strong></div>
                        <div><span>Pressing</span><strong>${esc(wort("pressing"))}</strong></div>
                        <div><span>Passspiel</span><strong>${esc(wort("passStyle"))}</strong></div>
                        <div><span>Abwehrlinie</span><strong>${esc(wort("defensiveLine"))}</strong></div>
                        ${torjaeger && (torjaeger.seasonStats?.goals || 0) > 0
                            ? `<div><span>Torjäger</span><strong>${esc(torjaeger.name)} (${torjaeger.seasonStats.goals})</strong></div>` : ""}
                    </div>
                    <h4>Anlagen</h4>
                    <div class="kv-liste">${anlagenHtml || `<div><span>—</span></div>`}</div>
                </div>
            </div>
            <div class="dash-card vd-karte">
                <h4>Kader <small class="muted-note">Sterne und Werte so, wie Ihre Scouts sie kennen - ein Klick öffnet die Akte</small></h4>
                <div class="table-container">
                    <table class="compact-table vd-kader">
                        <thead><tr><th>Pos</th><th>Name</th><th>Alter</th><th>Stärke</th><th>Wert</th></tr></thead>
                        <tbody>${kaderHtml || `<tr><td colspan="5" class="text-muted">Kein Kader bekannt.</td></tr>`}</tbody>
                    </table>
                </div>
            </div>`;

        const wappen = document.getElementById("vdWappen");
        if (wappen) {
            this.setzeWappen(wappen, club);
        }
        body.querySelectorAll("tr.row-clickable").forEach(row => {
            row.addEventListener("click", () => {
                const pId = this.resolvePlayerId(row.dataset.playerId);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            });
        });
        const x = document.getElementById("btnCloseVereinsDetails");
        if (x) x.onclick = () => { modal.style.display = "none"; };
        modal.style.display = "flex";
        body.scrollTop = 0;
    },

    /** Macht Tabellenzeilen mit data-club-id anklickbar: öffnet die Vereinsdetails */
    bindVereinsZeilen(host) {
        if (!host) return;
        host.querySelectorAll("tr[data-club-id]").forEach(row => {
            row.classList.add("row-clickable");
            row.title = "Vereinsdetails anzeigen";
            row.onclick = (e) => {
                if (e.target.closest("button, a, select, input")) return;
                this.showClubDetailsModal(row.dataset.clubId);
            };
        });
    },

    getPlayerTalkEngine() {
        if (typeof PlayerTalkEngine !== "undefined" && PlayerTalkEngine) return PlayerTalkEngine;
        if (typeof window !== "undefined" && window.PlayerTalkEngine) return window.PlayerTalkEngine;
        return null;
    },

    /**
     * Gespräch unter vier Augen: Was gerade ansteht (Wunsch, Versprechen,
     * Wechselwunsch), die möglichen Gespräche und die letzte Antwort.
     */
    gespraechHtml(player) {
        const engine = this.getPlayerTalkEngine();
        if (!engine) return "";
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const optionen = engine.optionen(state, player);
        const lage = [];
        if (player.wechselwunsch) {
            lage.push(player.wechselwunsch.akzeptiert
                ? `<div class="gs-lage gs-warn">📢 Er will wechseln - Sie haben zugestimmt, er steht auf der Transferliste.</div>`
                : `<div class="gs-lage gs-bad">📢 Er will den Verein verlassen: „${esc(player.wechselwunsch.grund)}“</div>`);
        }
        if (player.gespraechswunsch) {
            lage.push(`<div class="gs-lage gs-warn">💬 Er hat um ein Gespräch gebeten - es geht um ${player.gespraechswunsch.grund === "spielzeit" ? "seine Spielzeit" : "seine Situation"}.</div>`);
        }
        if (player.versprechen) {
            const v = player.versprechen;
            lage.push(`<div class="gs-lage gs-info">🤝 Versprochen: ${v.einsaetze} von ${v.noetig} Einsätzen ab 60 Minuten · noch ${v.frist - v.spiele} Ligaspiele</div>`);
        }
        const form = engine.formLage(player);
        const formText = { stark: "in starker Form", normal: "in ordentlicher Form", schwach: "außer Form" }[form];
        const antwort = this._letzteAntwort && String(this._letzteAntwort.playerId) === String(player.id) ? this._letzteAntwort : null;
        if (antwort) this._letzteAntwort = null;
        return `
            <div class="dash-card mb-3 gs-karte">
                <h4 class="gs-titel"><svg class="ico" aria-hidden="true"><use href="#i-chat"/></svg> Gespräch unter vier Augen</h4>
                <div class="gs-sub">Er ist ${formText} (Form ${(player.form ?? 7).toFixed(1).replace(".", ",")}) · Moral ${Math.round(player.morale ?? 75)} %${typeof player.vertrauen === "number" ? ` · Vertrauen ${Math.round(player.vertrauen)} %` : ""}</div>
                ${lage.join("")}
                ${antwort ? `<div class="gs-antwort gs-${antwort.stimmung}">„${esc(antwort.antwort)}“ <span>Moral ${antwort.moralVorher} → ${antwort.moralNachher} %</span></div>` : ""}
                <div class="gs-optionen">
                    ${optionen.map(o => `
                        <button class="btn btn-secondary gs-option" data-gespraech="${esc(o.key)}" ${o.verfuegbar ? "" : "disabled"} title="${esc(o.verfuegbar ? o.text : o.grund)}">
                            <strong>${esc(o.label)}</strong>
                            <span>${esc(o.verfuegbar ? o.text : o.grund)}</span>
                        </button>`).join("")}
                </div>
            </div>`;
    },

    getDevelopmentPlanEngine() {
        if (typeof DevelopmentPlanEngine !== "undefined" && DevelopmentPlanEngine) return DevelopmentPlanEngine;
        if (typeof window !== "undefined" && window.DevelopmentPlanEngine) return window.DevelopmentPlanEngine;
        return null;
    },

    /**
     * Der Entwicklungsplan in der Akte: Spielpraxis, eigener
     * Trainingsschwerpunkt, Umschulung und Mentor (oder die Schützlinge).
     */
    entwicklungsplanHtml(player) {
        const engine = this.getDevelopmentPlanEngine();
        if (!engine) return "";
        const state = this.app.state;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const praxis = Math.round((typeof player.spielpraxis === "number" ? player.spielpraxis : 0.5) * 100);
        const faktor = engine.praxisFaktor(player);
        const praxisText = (player.age || 25) <= 28
            ? `Entwicklungstempo durch Einsätze: ${faktor >= 1 ? "+" : "−"}${Math.abs(Math.round((faktor - 1) * 100))} %`
            : "In seinem Alter zählt die Spielpraxis für die Entwicklung kaum noch.";
        const fokusOptionen = engine.schwerpunkteFuer(player)
            .map(sp => `<option value="${esc(sp.key)}" ${(player.trainingsfokus || "keiner") === sp.key ? "selected" : ""}>${esc(sp.label)}</option>`).join("");
        const ziele = engine.umschulungsZiele(player);
        const stand = engine.umschulungsStand(player);
        const umschulung = player.pos === "TW" ? "" : `
            <label class="ep-feld">
                <span>Umschulung auf eine neue Position</span>
                <select id="pdPlanUmschulung" class="styled-select">
                    <option value="">Keine Umschulung</option>
                    ${ziele.map(pos => `<option value="${esc(pos)}" ${player.umschulung?.pos === pos ? "selected" : ""}>${esc(pos)}</option>`).join("")}
                </select>
                ${player.umschulung ? `<div class="ep-balken"><span style="width:${stand}%"></span></div><small>${stand} % - jede Trainingseinheit bringt ihn weiter.</small>` : ""}
            </label>`;
        let mentorHtml = "";
        if ((player.age || 30) <= engine.MENTEE_HOECHSTALTER) {
            const kandidaten = engine.moeglicheMentoren(state, player);
            const sterne = (w) => "★".repeat(Math.max(1, Math.round(w * 5)));
            mentorHtml = `
                <label class="ep-feld">
                    <span>Mentor</span>
                    <select id="pdPlanMentor" class="styled-select">
                        <option value="">Kein Mentor</option>
                        ${kandidaten.map(k => `<option value="${esc(k.player.id)}" ${String(player.mentorId) === String(k.player.id) ? "selected" : ""}>${esc(k.player.name)} (${k.player.age}) ${sterne(k.wert)}</option>`).join("")}
                    </select>
                    <small>Ein erfahrener Profi färbt auf ihn ab: Einstellung, Ehrgeiz, Nerven - mit etwas Glück auch eine seiner Eigenheiten.</small>
                </label>`;
        } else if ((player.age || 0) >= engine.MENTOR_MINDESTALTER) {
            const schuetzlinge = engine.menteesVon(state, player.id);
            mentorHtml = `
                <div class="ep-feld">
                    <span>Als Mentor (${"★".repeat(Math.max(1, Math.round(engine.mentorWert(player) * 5)))})</span>
                    <small>${schuetzlinge.length
                        ? `Er betreut ${schuetzlinge.map(m => esc(m.name)).join(", ")}.`
                        : "Er betreut noch keinen jungen Spieler. Einen Mentor wählen Sie in der Akte des Talents."}</small>
                </div>`;
        }
        return `
            <div class="dash-card mb-3 ep-karte">
                <h4 class="gs-titel"><svg class="ico" aria-hidden="true"><use href="#i-up"/></svg> Entwicklungsplan</h4>
                <div class="ep-feld">
                    <span>Spielpraxis ${praxis} %</span>
                    <div class="ep-balken"><span style="width:${praxis}%"></span></div>
                    <small>${esc(praxisText)}</small>
                </div>
                <label class="ep-feld">
                    <span>Eigener Trainingsschwerpunkt</span>
                    <select id="pdPlanFokus" class="styled-select">${fokusOptionen}</select>
                    <small>Wächst er, wachsen diese Werte mit. Die Zusatzschichten kosten etwas Kraft.</small>
                </label>
                ${umschulung}
                ${mentorHtml}
            </div>`;
    },

    /**
     * Die Spielerakte. Mit { abschnitt: "vertrag" } springt sie gleich zur
     * Vertragsverhandlung - so führt ein auslaufender Vertrag im Schreibtisch
     * oder im Postfach direkt dorthin, wo man verlängert.
     */
    showPlayerDetailsModal(playerId, optionen = {}) {
        const state = this.app.state;
        const treffer = this.findAnyPlayer(playerId);
        if (!treffer) return;

        const player = treffer.player;
        const isProspect = treffer.isProspect;
        const club = state.clubs.find(c => c.id === player.clubId);

        const modal = document.getElementById("modalPlayerDetails");
        const body = document.getElementById("playerDetailsContent");
        document.getElementById("pdPlayerName").textContent = isProspect
            ? `${player.name} (${player.pos}) · Nachwuchs`
            : `${player.name} (${player.pos})`;

        const happy = player.happiness || { overall: 75, playingTime: 75, contract: 75, teamPerformance: 75, reason: "Zufrieden mit der Rolle im Team." };
        // Talente der eigenen Akademie gehören zum Verein, auch ohne Profivertrag
        const isUserClub = isProspect || player.clubId === state.userClubId;
        // Leihe: eigener verliehener Spieler, Leihspieler im eigenen Kader,
        // eigener Spieler (verleihbar) oder fremder (vielleicht ausleihbar)
        const leiheModus = player.leihe
            ? (player.leihe.stammvereinId === state.userClubId ? "verliehen"
                : (player.leihe.leihvereinId === state.userClubId ? "geliehen" : null))
            : (isProspect ? null : (isUserClub ? "eigener" : "markt"));
        const eigenerVerliehen = leiheModus === "verliehen";
        const klausel = isProspect ? null : TransferEngine.ausstiegsklausel(state, player);
        const demand = (typeof ContractEngine !== 'undefined' && isUserClub && !isProspect) ? ContractEngine.getExtensionDemand(player, club, state) : { demandWage: Math.round((player.wage || 20000) * 1.15) };

        const ratingEngine = this.getRatingEngine();
        // Das eigene Talent wird täglich im Training gesehen - für die Karte
        // zählt es deshalb wie ein Spieler des eigenen Vereins.
        const karteSpieler = isProspect || eigenerVerliehen ? Object.assign({}, player, { clubId: state.userClubId }) : player;
        const card = ratingEngine
            ? ratingEngine.calculateVisiblePlayerCard(karteSpieler,
                Object.assign({ userClubId: state.userClubId, leagueDataCoverage: 85 }, this.starContext()))
            : null;

        // Eigenheiten: was diesem Spieler auf dem Platz eigen ist
        let eigenheitenHtml = "";
        const signatur = this.signaturVon(player);
        const eigenheiten = Array.isArray(player.traits) ? player.traits : [];
        if (eigenheiten.length > 0 || signatur) {
            eigenheitenHtml = `
                <div class="dash-card mb-3" style="padding:14px; background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2);">
                    <h4 style="font-size:13px; margin-bottom:8px; color:#f59e0b;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-ball"/></svg>Auf dem Platz</h4>
                    ${signatur ? `
                        <div class="signatur-karte">
                            <span class="signatur-icon">${signatur.icon}</span>
                            <div>
                                <div class="signatur-name">${this.escapeHtml(signatur.name)} <span class="signatur-marke">Signatur</span></div>
                                <div class="signatur-text">${this.escapeHtml(signatur.text)}</div>
                            </div>
                        </div>` : ""}
                    ${eigenheiten.length ? `
                    <ul style="margin:0; padding-left:18px; font-size:12px; color:#e2e8f0; line-height:1.6;">
                        ${eigenheiten.map(t => `<li>${this.escapeHtml(t.text)}</li>`).join("")}
                    </ul>` : ""}
                    <div style="font-size:11px; color:var(--text-muted, #94a3b8); margin-top:8px;">Im Livespiel entscheiden diese Eigenschaften mit: wie er spielt und wie gut es gelingt.</div>
                </div>
            `;
        }

        // Woher er kommt: die Handschrift der Schule, die ihn ausgebildet hat
        let schuleHtml = "";
        const schulKey = player.schule;
        if (schulKey) {
            const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
            const profil = fac?.AKADEMIE_PROFILE?.[schulKey];
            if (profil) {
                const heimat = player.eigengewaechsVon
                    ? state.clubs.find(c => c.id === player.eigengewaechsVon)
                    : state.clubs.find(c => c.id === player.clubId);
                const praegung = (profil.staerken || []).length
                    ? `Dort werden vor allem ${this.profilWorte(profil.staerken)} ausgebildet`
                    : "Eine Schule ohne besondere Handschrift";
                schuleHtml = `
                    <div class="dash-card mb-3" style="padding:14px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2);">
                        <h4 style="font-size:13px; margin-bottom:8px; color:#10b981;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-user"/></svg>Aus der eigenen Jugend</h4>
                        <div style="font-size:12px; color:#e2e8f0; line-height:1.6;">
                            <strong>${this.escapeHtml(profil.name)}</strong>${heimat ? ` &middot; ${this.escapeHtml(heimat.name)}` : ""}<br>
                            ${this.escapeHtml(praegung)}${(profil.schwaechen || []).length
                                ? ` &ndash; auf Kosten von ${this.escapeHtml(this.profilWorte(profil.schwaechen))}` : ""}.
                        </div>
                    </div>
                `;
            }
        }

        let traitsHtml = "";
        if (card && card.hiddenTraits && card.hiddenTraits.length > 0) {
            traitsHtml = `
                <div class="dash-card mb-3" style="padding:14px; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2);">
                    <h4 style="font-size:13px; margin-bottom:8px; color:#38bdf8;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-spark"/></svg>Persönlichkeit & Beobachtungen</h4>
                    <ul style="margin:0; padding-left:18px; font-size:12px; color:#e2e8f0; line-height:1.5;">
                        ${card.hiddenTraits.map(t => `<li>${t}</li>`).join("")}
                    </ul>
                </div>
            `;
        }

        let contractSectionHtml = "";
        if (isProspect) {
            // Ein Talent hat noch keinen Profivertrag zu verlängern - hier geht
            // es darum, ob er überhaupt einen bekommt.
            const engine = this.getNegotiationEngine();
            const laufend = engine
                ? engine.getOpenNegotiations(state).find(n => n.type === "youth_promotion" && String(n.prospectId) === String(player.id))
                : null;

            contractSectionHtml = `
                <div class="dash-card mt-3" id="pdVertrag" style="padding:14px; background: var(--surface-2); border:1px solid var(--line);">
                    <h4 style="font-size:14px; margin-bottom:8px; color:#38bdf8;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-user"/></svg>Aus der Jugendakademie</h4>
                    <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">
                        ${player.name} spielt in der eigenen Nachwuchsabteilung und hat noch keinen Profivertrag.
                        Entwicklungstempo: <strong>${((player.developmentRate || 1) * 100).toFixed(0)} %</strong>.
                    </p>
                    ${laufend
                        ? `<div class="hint-box" style="margin:0;">Berater <strong>${this.escapeHtml(laufend.agentName)}</strong> verhandelt bereits: ${this.escapeHtml(engine.describe(laufend))}</div>
                           <button class="btn btn-secondary" id="btnPdZurVerhandlung" data-neg-id="${this.escapeHtml(laufend.id)}" style="width:100%; margin-top:10px;">Zur Verhandlung</button>`
                        : `<button class="btn btn-primary" id="btnPdPromoteProspect" style="width:100%;">Vertragsgespräche aufnehmen</button>`}
                </div>
            `;
        } else if (isUserClub && player.vorvertrag) {
            contractSectionHtml = `
                <div class="dash-card mt-3" id="pdVertrag" style="padding:14px; background: var(--surface-2); border:1px solid var(--line);">
                    <h4 style="font-size:14px; margin-bottom:8px; color:#f87171;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-briefcase"/></svg>Vertrag läuft aus</h4>
                    <p style="font-size:12px; color:var(--text-muted); margin:0;">${this.escapeHtml(player.name)} hat bei <strong>${this.escapeHtml(player.vorvertrag.clubName)}</strong> unterschrieben und geht zum Saisonwechsel ablösefrei.</p>
                </div>
            `;
        } else if (isUserClub && leiheModus !== "geliehen" && ContractEngine.verlaengerungsHindernis(player)) {
            // Wer weg will oder tief unzufrieden ist, spricht gar nicht erst
            contractSectionHtml = `
                <div class="dash-card mt-3" id="pdVertrag" style="padding:14px; background: var(--surface-2); border:1px solid var(--line);">
                    <h4 style="font-size:14px; margin-bottom:8px; color:#f87171;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-briefcase"/></svg>Keine Vertragsgespräche</h4>
                    <p style="font-size:12px; color:var(--text-muted); margin:0;">${this.escapeHtml(ContractEngine.verlaengerungsHindernis(player))}</p>
                </div>
            `;
        } else if (isUserClub && leiheModus !== "geliehen") {
            const rollen = [
                ["Schlüsselspieler", "Höchste Wichtigkeit"], ["Stammspieler", "Regelmäßige Startelf"],
                ["Rotationsspieler", "Teilzeit-Einsätze"], ["Ergänzungsspieler", "Backup"], ["Zukunftstalent", "Entwicklung"]
            ];
            contractSectionHtml = `
                <div class="dash-card mt-3" id="pdVertrag" style="padding:14px; background: var(--surface-2); border:1px solid var(--line);">
                    <h4 style="font-size:14px; margin-bottom:8px; color:#38bdf8;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-briefcase"/></svg>Vertragsverlängerung verhandeln</h4>
                    <p style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">Forderung des Spielers: ca. <strong id="extForderung">${GameState.formatMoney(demand.demandWage)} / Woche</strong></p>
                    <p class="ext-rolle" id="extRolleHinweis">Er sieht sich als <strong>${this.escapeHtml(demand.preferredRole)}</strong>.${demand.treu ? " Er ist gern hier und kommt beim Gehalt entgegen." : ""}</p>
                    ${(player.contractYears || 0) <= 0 ? `<p class="vertrag-endet">Sein Vertrag endet zum Saisonwechsel${this.sommerpauseText()}. Andere Vereine werben schon.</p>` : ""}
                    ${player.vorvertragInteresse ? `<p class="vertrag-endet">✍️ ${this.escapeHtml(player.vorvertragInteresse.clubName)} bietet ihm einen Vorvertrag an. Er entscheidet sich ${this.bedenkzeitText(player.vorvertragInteresse)} - verlängern wir vorher, bleibt er.</p>` : ""}
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:12px;">
                        <div>
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Neues Gehalt (€ / Wo.):</label>
                            <input type="number" id="extWageInput" class="styled-input" style="width:100%;" value="${demand.demandWage}" step="${ContractEngine.eingabeSchritt(demand.demandWage)}" min="0">
                        </div>
                        <div>
                            <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Laufzeit:</label>
                            <select id="extYearsSelect" class="styled-select" style="width:100%;">
                                <option value="1">1 Jahr</option>
                                <option value="2">2 Jahre</option>
                                <option value="3" selected>3 Jahre</option>
                                <option value="4">4 Jahre</option>
                                <option value="5">5 Jahre</option>
                            </select>
                        </div>
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Zugesagte Kaderrolle:</label>
                        <select id="extRoleSelect" class="styled-select" style="width:100%;">
                            ${rollen.map(([rolle, text]) => `<option value="${rolle}" ${rolle === demand.preferredRole ? "selected" : ""}>${rolle} (${text})</option>`).join("")}
                        </select>
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:4px;">Ausstiegsklausel (senkt die Gehaltsforderung):</label>
                        <select id="extKlauselSelect" class="styled-select" style="width:100%;">
                            <option value="0">Keine Ausstiegsklausel</option>
                            ${[4, 2.5, 1.5].map(f => {
                                const betrag = Math.max(100000, Math.round((player.value || 0) * f / 100000) * 100000);
                                const rabatt = Math.round((1 - ContractEngine.klauselRabatt(player, betrag)) * 100);
                                return `<option value="${betrag}">${this.geldKurz(betrag)} (${String(f).replace(".", ",")}-facher Marktwert, ${rabatt} % weniger Gehalt)</option>`;
                            }).join("")}
                        </select>
                        <small style="font-size:11px; color:var(--text-muted);">Wer die Klausel zahlt, holt ihn - Sie können dann nicht ablehnen.</small>
                    </div>

                    <div id="extFeedback" style="font-size:13px; margin-bottom:10px;"></div>
                    <button class="btn btn-primary" id="btnSubmitExtension" style="width:100%;">Neuen Vertrag anbieten</button>
                </div>
            `;
        }

        let scoutExternalHtml = "";
        if (!isUserClub && !eigenerVerliehen) {
            // Vorvertrag: ablösefrei zum Saisonwechsel, ab Januar
            const negEngine = this.getNegotiationEngine();
            const vvGrund = negEngine && typeof negEngine.vorvertragHindernis === "function" && player.clubId
                ? negEngine.vorvertragHindernis(state, player) : "-";
            const vvLaufend = negEngine ? negEngine.getOpenNegotiations(state)
                .find(n => n.vorvertrag && String(n.playerId) === String(player.id)) : null;
            const seasonEng = typeof SeasonEngine !== "undefined" ? SeasonEngine : null;
            const endetBald = player.clubId && !player.leihe && seasonEng && seasonEng.vertragEndetZumWechsel(state, player);
            let vorvertragHtml = "";
            if (player.vorvertrag && player.vorvertrag.clubId === state.userClubId) {
                vorvertragHtml = `<div class="hint-box vv-hinweis">✍️ <strong>Vorvertrag unterschrieben</strong> - er kommt zum Saisonwechsel ablösefrei zu uns (${this.geldKurz(player.vorvertrag.wage || 0)} / Woche, ${player.vorvertrag.years} Jahre).</div>`;
            } else if (player.vorvertrag) {
                vorvertragHtml = `<div class="hint-box vv-hinweis">✍️ Er hat bei <strong>${this.escapeHtml(player.vorvertrag.clubName)}</strong> unterschrieben und wechselt zum Saisonwechsel.</div>`;
            } else if (vvLaufend) {
                vorvertragHtml = `<button class="btn btn-secondary" id="btnPdZurVerhandlung" data-neg-id="${this.escapeHtml(vvLaufend.id)}" style="width:100%; margin-top:10px;">Zur Verhandlung über den Vorvertrag</button>`;
            } else if (vvGrund === null) {
                vorvertragHtml = `<button class="btn btn-secondary" id="btnPdVorvertrag" style="width:100%; margin-top:10px;" title="Kein Geld an seinen Verein - er kommt zum Saisonwechsel"><svg class="ico" aria-hidden="true"><use href="#i-edit"/></svg> Vorvertrag anbieten (ablösefrei)</button>`;
            } else if (endetBald) {
                vorvertragHtml = `<div class="vv-zeile">Sein Vertrag läuft zum Saisonende aus. ${this.escapeHtml(vvGrund)}</div>`;
            }
            scoutExternalHtml = `
                <div style="display:flex; gap:10px; margin-top:14px;">
                    ${this.beobachtungsText(player.id)
                        ? `<button class="btn btn-secondary" id="btnPdScoutPlayer" style="flex:1;" disabled><svg class="ico" aria-hidden="true"><use href="#i-eye"/></svg> In Beobachtung · Bericht ${this.beobachtungsText(player.id)}</button>`
                        : `<button class="btn btn-secondary" id="btnPdScoutPlayer" style="flex:1;" title="Der Bericht kommt nach einigen Tagen ins Postfach"><svg class="ico" aria-hidden="true"><use href="#i-search"/></svg> Scout entsenden</button>`}
                    <button class="btn btn-primary" id="btnPdBidPlayer" style="flex:1;"><svg class="ico" aria-hidden="true"><use href="#i-briefcase"/></svg> Transfer verhandeln</button>
                </div>
                ${klausel ? `<button class="btn btn-secondary" id="btnPdKlausel" style="width:100%; margin-top:10px;" title="Sein Verein kann nicht ablehnen"><svg class="ico" aria-hidden="true"><use href="#i-bolt"/></svg> Ausstiegsklausel ziehen (${this.geldKurz(klausel)})</button>` : ""}
                ${vorvertragHtml}
            `;
        }

        // Genauigkeit der angezeigten Werte hängt am Scoutwissen
        const confidence = card ? card.confidence : (player.scoutingKnowledge?.knowledgeLevel || 25);

        // Positionsprofil: Wo kann dieser Spieler wirklich spielen?
        const positionMapHtml = this.buildPositionMapHtml(player, isUserClub ? 100 : confidence);
        const confInfo = card?.confidenceInfo
            || (ratingEngine ? ratingEngine.getConfidenceDescriptor(confidence) : { label: "Unbekannt", color: "#94a3b8", hint: "" });
        const confidenceBarHtml = this.buildScoutConfidenceHtml(confidence, confInfo, isUserClub);

        // Attributzeile: exakter Wert bei gutem Wissen, sonst eine Spanne
        const attrLine = (label, attrName) => {
            if (!ratingEngine) {
                return `<div class="club-stat-line"><span>${label}:</span><strong>${player[attrName] ?? "?"}</strong></div>`;
            }
            const vis = ratingEngine.getVisibleAttribute(player, attrName, confidence);
            const cls = vis.known ? "" : "estimated-value";
            const title = vis.known ? "Gesicherter Wert" : `Geschätzt (${confInfo.label})`;
            return `<div class="club-stat-line"><span>${label}:</span><strong class="${cls}" title="${title}">${vis.text}</strong></div>`;
        };

        // Torhüter und Feldspieler haben unterschiedliche Attributprofile.
        // Feldspielern fehlen die Torwartwerte (sie stehen pauschal auf 30),
        // sie wurden bisher trotzdem als "Stellungsspiel" ausgewiesen.
        const isKeeper = player.pos === "TW";
        const attributeBlocks = isKeeper
            ? `
                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:13px; margin-bottom:8px; color:var(--text-muted);">Torwartspiel</h4>
                    ${attrLine("Reflexe", "reflexes")}
                    ${attrLine("Fangsicherheit", "handling")}
                    ${attrLine("Eins gegen eins", "oneOnOne")}
                    ${attrLine("Stellungsspiel", "positioning")}
                    ${attrLine("Abschlag", "kicking")}
                </div>

                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:13px; margin-bottom:8px; color:var(--text-muted);">Spielaufbau & Physis</h4>
                    ${attrLine("Passen", "passing")}
                    ${attrLine("Übersicht", "vision")}
                    ${attrLine("Physis", "physical")}
                    ${attrLine("Ausdauer", "stamina")}
                    ${attrLine("Technik", "technique")}
                </div>
            `
            : `
                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:13px; margin-bottom:8px; color:var(--text-muted);">Offensive & Technik</h4>
                    ${attrLine("Tempo", "pace")}
                    ${attrLine("Schuss", "shooting")}
                    ${attrLine("Passen", "passing")}
                    ${attrLine("Dribbling", "dribbling")}
                    ${attrLine("Technik", "technique")}
                </div>

                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:13px; margin-bottom:8px; color:var(--text-muted);">Defensive & Physis</h4>
                    ${attrLine("Defensive", "defense")}
                    ${attrLine("Physis", "physical")}
                    ${attrLine("Ausdauer", "stamina")}
                    ${attrLine("Übersicht", "vision")}
                </div>
            `;

        const abilityStars = card ? card.abilityStarsHtml : "";
        const abilityStarsText = card ? card.abilityStarsText : "";
        const abilityLabel = card ? card.abilityLabel : "Ligaspieler";
        const potentialLabel = card ? card.potentialLabel : "Entwicklungspotenzial";
        // Auch die Rollenbewertung ist bei wenig Scoutwissen nur eine Spanne
        const roleStarsHtml = (roleEntry) => {
            if (!roleEntry) return null;
            if (!ratingEngine) return roleEntry.starsHtml;
            if (card?.isPrecise) return ratingEngine.renderStarRange(roleEntry.stars, roleEntry.stars);
            const delta = ((100 - confidence) / 100) * 1.5;
            return ratingEngine.renderStarRange(
                Math.max(0.5, roleEntry.stars - delta),
                Math.min(5, roleEntry.stars + delta)
            );
        };

        const bestRoleName = card?.bestRole?.role || "Allrounder";
        const bestRoleStars = roleStarsHtml(card?.bestRole) || "★★★☆☆";
        const altRoleName = card?.alternativeRole?.role || null;
        const altRoleStars = roleStarsHtml(card?.alternativeRole);

        body.innerHTML = `
            <div class="player-detail-top">
                <div class="player-detail-meta">
                    <span class="pos-tag pos-${this.getPosGroup(player.pos)}" style="font-size:13px;">${player.pos}</span>
                    <span style="font-size:14px; margin-left:8px; color:var(--text-muted);">${club ? club.name : ''} • Alter: ${player.age}${player.foot ? ` • ${this.escapeHtml(player.foot === "beidfüßig" ? "beidfüßig" : player.foot + "er Fuß")}` : ''}${typeof MatchEngine !== "undefined" && MatchEngine.koerpergroesse ? ` • ${(MatchEngine.koerpergroesse(player) / 100).toFixed(2).replace(".", ",")} m` : ''}</span>
                    ${this.nationalHtml(player)}
                </div>
                <div class="player-detail-rating">
                    <div class="player-detail-stars team-strength-stars">${abilityStars}</div>
                    <div class="player-detail-label">${abilityLabel}</div>
                    ${card?.potentialKlasse ? `<div class="player-detail-ziel">${this.escapeHtml(card.potentialKlasse)}</div>` : ""}
                </div>
            </div>

            <!-- Stärke, Potenzial und Rolle auf einen Blick -->
            <div class="player-role-summary-card">
                <div class="player-role-box">
                    <span class="role-box-label">Stärke &amp; Potenzial</span>
                    <div class="role-box-main">
                        <span class="role-stars">${abilityStars}</span>
                    </div>
                    <div class="role-box-sub">${this.escapeHtml(abilityStarsText)}</div>
                    <div class="star-legend">
                        <span><i class="star-solid"></i> heute</span>
                        ${card && !card.isPrecise ? '<span><i class="star-maybe"></i> geschätzt</span>' : ''}
                        <span><i class="star-growth"></i> Potenzial</span>
                    </div>
                </div>

                <div class="player-role-box">
                    <span class="role-box-label">Hauptrolle</span>
                    <div class="role-box-main">
                        <span class="role-name">${bestRoleName}</span>
                        <span class="role-stars">${bestRoleStars}</span>
                    </div>
                    ${altRoleName ? `<div class="role-box-sub">Alt: ${altRoleName} <span>${altRoleStars}</span></div>` : ''}
                    <div class="role-box-sub">${potentialLabel}</div>
                </div>
            </div>

            ${confidenceBarHtml}

            <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap:14px; margin-bottom:16px;">
                ${attributeBlocks}
            </div>

            ${isProspect ? "" : `
            <!-- Zufriedenheit & Rolle -->
            <div class="dash-card mb-3" style="padding:14px;">
                <h4 style="font-size:13px; margin-bottom:8px; color:var(--text-muted);"><svg class="ico h-ico" aria-hidden="true"><use href="#i-user"/></svg>Spielerzufriedenheit & Status</h4>
                <div class="club-stat-line"><span>Kaderrolle:</span><strong>${player.squadRole || 'Kader'}</strong></div>
                <div class="club-stat-line"><span>Gesamtzufriedenheit:</span><strong>${happy.overall}%</strong></div>
                <div class="club-stat-line"><span>Spielzeit / Vertrag:</span><span>${happy.playingTime}% / ${happy.contract}%</span></div>
                <div style="font-size:12px; color:var(--text-muted); margin-top:4px; font-style:italic;">"${happy.reason || 'Zufrieden mit der Situation.'}"</div>
            </div>`}

            ${isUserClub && !isProspect ? this.gespraechHtml(player) : ""}

            ${isUserClub && !isProspect ? this.entwicklungsplanHtml(player) : ""}

            ${leiheModus === "eigener" ? this.reserveHtml(player) : ""}

            ${leiheModus ? this.leiheHtml(player, leiheModus) : ""}

            ${positionMapHtml}

            ${eigenheitenHtml}

            ${schuleHtml}

            ${traitsHtml}

            ${isProspect ? `
            <div class="finance-stat-row">
                <span>Jahrgang:</span>
                <strong>${player.age} Jahre – noch ${Math.max(0, 21 - (player.age || 17))} Jahre Nachwuchsalter</strong>
            </div>
            <div class="finance-stat-row">
                <span>Kondition / Moral:</span>
                <strong>${player.fitness ?? 95} % / ${player.morale ?? 85} %</strong>
            </div>
            ` : `
            <div class="finance-stat-row">
                <span>Saison-Statistiken:</span>
                <strong>${player.stats.matches} Spiele | ${player.stats.goals} Tore | ${player.stats.assists} Assists | Notenschnitt: ${(player.stats.matches > 0 ? (player.stats.ratingSum / player.stats.matches).toFixed(2) : '-')}</strong>
            </div>
            <div class="finance-stat-row">
                <span>Marktwert:</span>
                <strong>${card ? card.visibleValueText : this.formatMoneySafe(player.value)}</strong>
            </div>
            <div class="finance-stat-row">
                <span>Gehalt:</span>
                <strong>${this.formatMoneySafe(player.wage)} / Woche</strong>
            </div>
            <div class="finance-stat-row">
                <span>Vertragslaufzeit:</span>
                <strong>${player.contractYears} Jahr(e)</strong>
            </div>
            ${player.praemien && player.clubId === state.userClubId ? `
            <div class="finance-stat-row">
                <span>Prämien:</span>
                <strong>${this.formatMoneySafe(player.praemien.einsatz || 0)} je Einsatz, ${this.formatMoneySafe(player.praemien.tor || 0)} je Tor</strong>
            </div>` : ""}
            ${klausel ? `
            <div class="finance-stat-row">
                <span>Ausstiegsklausel:</span>
                <strong>${this.formatMoneySafe(klausel)}</strong>
            </div>` : ""}
            ${player.weiterverkauf && player.weiterverkauf.clubId === state.userClubId ? `
            <div class="finance-stat-row">
                <span>Weiterverkaufsbeteiligung:</span>
                <strong>${player.weiterverkauf.prozent} % für Ihren Verein</strong>
            </div>` : ""}`}

            ${scoutExternalHtml}
            ${contractSectionHtml}
        `;

        modal.style.display = "flex";
        this.playSound("click");

        // Direkt zur Vertragsverhandlung, wenn der Weg von dort kam
        const vertragsTeil = optionen.abschnitt === "vertrag" ? document.getElementById("pdVertrag") : null;
        if (vertragsTeil) {
            this.hebeHervor(vertragsTeil);
            document.getElementById("extWageInput")?.focus({ preventScroll: true });
        }

        // External buttons binden
        if (!isUserClub) {
            document.getElementById("btnPdScoutPlayer")?.addEventListener("click", () => {
                const scoutingEngine = (typeof ScoutingEngine !== 'undefined' && ScoutingEngine)
                    ? ScoutingEngine
                    : ((typeof window !== 'undefined' && window.ScoutingEngine) ? window.ScoutingEngine : null);
                if (scoutingEngine) this.beobachte(player.id, "player_profile", () => {
                    if (this.activeTab === "transfers") this.renderTransfers();
                    this.showPlayerDetailsModal(player.id);
                });
            });

            document.getElementById("btnPdBidPlayer")?.addEventListener("click", () => {
                modal.style.display = "none";
                this.showTransferOfferModal(player.id);
            });

            document.getElementById("btnPdVorvertrag")?.addEventListener("click", () => {
                const engine = this.getNegotiationEngine();
                const res = engine ? engine.startTransferNegotiation(state, player.id, state.userClubId, null, { vorvertrag: true }) : null;
                if (!res || !res.success) { this.showToast(res?.error || "Verhandlungen sind derzeit nicht verfügbar.", "error"); return; }
                this.playSound("click");
                this.showToast(`Berater ${res.negotiation.agentName} spricht über einen Vorvertrag. Forderung: ${this.formatMoneySafe(res.negotiation.demand.wage)} pro Woche.`, "success", 6000);
                modal.style.display = "none";
                this.zeigeVerhandlung(res.negotiation.id);
            });

            document.getElementById("btnPdKlausel")?.addEventListener("click", () => {
                const res = TransferEngine.zieheAusstiegsklausel(state, player.id);
                if (!res.success) { this.showToast(res.error, "error"); return; }
                this.playSound("goal");
                this.showToast(`⚡ Klausel gezogen: ${player.name} kommt für ${this.geldKurz(res.klausel)} (${this.geldKurz(res.lohn)} / Woche, ${res.laufzeit} Jahre).`, "success", 6000);
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderHeader();
                this.renderCurrentTab();
                this.showPlayerDetailsModal(player.id);
            });
        }

        document.getElementById("btnClosePlayerDetails").onclick = () => {
            modal.style.display = "none";
        };

        // Leihe: anfragen, verleihen, zurückholen, ausleihen
        const leihEngine = this.getLoanEngine();
        const nachLeihe = (res, text) => {
            if (!res.success) { this.showToast(res.error || "Das ging nicht.", "error"); return; }
            this.showToast(text, "success", 5000);
            this.playSound("click");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.showPlayerDetailsModal(player.id);
            if (this.activeTab === "squad") this.renderSquad?.();
            if (this.activeTab === "transfers") this.renderLeihen?.();
        };
        document.getElementById("btnPdLeiheZurueck")?.addEventListener("click", () =>
            nachLeihe(leihEngine.zurueckholen(state, player.id), `${player.name} kehrt zurück.`));
        document.getElementById("btnPdAusleihen")?.addEventListener("click", () =>
            nachLeihe(leihEngine.ausleihen(state, player.id), `${player.name} spielt bis zum Saisonende für Sie.`));
        document.getElementById("btnPdKaufoption")?.addEventListener("click", () => {
            const res = leihEngine.zieheKaufoption(state, player.id);
            nachLeihe(res, res.success ? `${player.name} ist fest verpflichtet (${this.geldKurz(res.preis)}).` : "");
        });
        // Zweite Mannschaft
        const reserveEngine = typeof ReserveEngine !== "undefined" ? ReserveEngine : null;
        document.getElementById("btnPdReserve")?.addEventListener("click", () => {
            if (!reserveEngine) return;
            const hinunter = !player.reserve;
            const res = hinunter ? reserveEngine.hinunter(state, player.id) : reserveEngine.hinauf(state, player.id);
            nachLeihe(res, hinunter
                ? `${player.name} spielt jetzt in der U23${res.ausElf ? " - die Aufstellung ist nachgerückt" : ""}.`
                : `${player.name} gehört wieder zum Profikader.`);
            if (res.success && this.activeTab === "tactics") this.renderCurrentTab();
        });
        document.getElementById("btnPdLeiheAnfragen")?.addEventListener("click", () => {
            const ziel = document.getElementById("pdLeiheAngebote");
            const angebote = leihEngine.interessenten(state, player.id);
            if (!ziel) return;
            const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
            ziel.innerHTML = angebote.length ? angebote.map(a => `
                <div class="leih-zeile">
                    <div><strong>${esc(a.clubName)}</strong> <span class="text-muted">Liga ${a.stufe}</span></div>
                    <div class="leih-text">${esc(a.rolle)} · übernimmt ${Math.round(a.lohnAnteil * 100)} % des Gehalts</div>
                    <button class="btn btn-sm btn-primary" data-verleihen-an="${esc(a.clubId)}">Verleihen</button>
                </div>`).join("")
                : `<div class="gs-lage">Kein Verein, bei dem er spielen würde, will ihn gerade ausleihen.</div>`;
            ziel.querySelectorAll("[data-verleihen-an]").forEach(btn => btn.addEventListener("click", () =>
                nachLeihe(leihEngine.verleihen(state, player.id, btn.dataset.verleihenAn), `${player.name} ist bis zum Saisonende verliehen.`)));
        });

        // Entwicklungsplan: Schwerpunkt, Umschulung, Mentor
        const planEngine = this.getDevelopmentPlanEngine();
        const planAendern = (res) => {
            if (!res.success) { this.showToast(res.error || "Das ging nicht.", "error"); return; }
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.showPlayerDetailsModal(player.id);
            if (this.activeTab === "training") this.renderTraining?.();
        };
        document.getElementById("pdPlanFokus")?.addEventListener("change", (e) => planAendern(planEngine.setzeSchwerpunkt(state, player.id, e.target.value)));
        document.getElementById("pdPlanUmschulung")?.addEventListener("change", (e) => planAendern(planEngine.setzeUmschulung(state, player.id, e.target.value || null)));
        document.getElementById("pdPlanMentor")?.addEventListener("change", (e) => planAendern(planEngine.setzeMentor(state, player.id, e.target.value || null)));

        // Gespräch unter vier Augen
        body.querySelectorAll("[data-gespraech]").forEach(btn => btn.addEventListener("click", () => {
            const engine = this.getPlayerTalkEngine();
            if (!engine) return;
            const res = engine.fuehren(state, player.id, btn.dataset.gespraech);
            if (!res.success) {
                this.showToast(res.error || "Das Gespräch kam nicht zustande.", "error");
                return;
            }
            this._letzteAntwort = { playerId: player.id, ...res };
            this.playSound("click");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.showPlayerDetailsModal(player.id);
            if (this.activeTab === "dashboard") this.renderDashboard?.();
            if (this.activeTab === "squad") this.renderSquad?.();
        }));

        // Aus der Akte heraus die Vertragsgespräche mit dem Talent eröffnen
        document.getElementById("btnPdPromoteProspect")?.addEventListener("click", () => {
            const engine = this.getNegotiationEngine();
            if (!engine) {
                this.showToast("Verhandlungen sind derzeit nicht verfügbar.", "error");
                return;
            }
            const res = engine.startYouthPromotion(state, state.userClubId, player.id);
            if (res.success) {
                this.playSound("click");
                this.showToast(
                    `Berater ${res.negotiation.agentName} verhandelt über den Erstvertrag. Erste Forderung: ${this.formatMoneySafe(res.negotiation.demand.wage)} pro Woche.`,
                    "success", 6000);
                modal.style.display = "none";
                // Gleich zur Verhandlung: Der Berater wartet auf unser Angebot
                this.zeigeVerhandlung(res.negotiation.id);
            } else {
                this.showToast(res.error || "Gespräche konnten nicht aufgenommen werden.", "error");
            }
        });
        document.getElementById("btnPdZurVerhandlung")?.addEventListener("click", (e) => {
            modal.style.display = "none";
            this.zeigeVerhandlung(e.currentTarget.dataset.negId);
        });

        // Event-Binding für Vertragsverlängerung
        const submitExtBtn = document.getElementById("btnSubmitExtension");
        // Rolle und Klausel ändern die Forderung - gleich sichtbar machen
        const forderungNeu = () => {
            const rolle = document.getElementById("extRoleSelect")?.value;
            const klauselWert = parseInt(document.getElementById("extKlauselSelect")?.value || "0", 10);
            const d = ContractEngine.getExtensionDemand(player, club, state, rolle);
            const betrag = ContractEngine.rundeBetrag(d.demandWage * ContractEngine.klauselRabatt(player, klauselWert));
            const text = document.getElementById("extForderung");
            if (text) text.textContent = `${GameState.formatMoney(betrag)} / Woche`;
            const eingabe = document.getElementById("extWageInput");
            if (eingabe) eingabe.value = betrag;
            const hinweis = document.getElementById("extRolleHinweis");
            if (hinweis) {
                const zusatz = d.rollenAbstand >= 2 ? ` Als ${rolle} unterschreibt er nicht.`
                    : d.rollenAbstand === 1 ? " Für weniger Spielzeit will er mehr Geld."
                        : d.rollenAbstand < 0 ? " Die größere Rolle gefällt ihm." : "";
                hinweis.innerHTML = `Er sieht sich als <strong>${this.escapeHtml(d.preferredRole)}</strong>.${d.treu ? " Er ist gern hier und kommt beim Gehalt entgegen." : ""}${zusatz}`;
                hinweis.classList.toggle("warnung", d.rollenAbstand >= 1);
            }
        };
        document.getElementById("extRoleSelect")?.addEventListener("change", forderungNeu);
        document.getElementById("extKlauselSelect")?.addEventListener("change", forderungNeu);
        if (submitExtBtn && isUserClub && !isProspect) {
            submitExtBtn.onclick = () => {
                const offWage = parseInt(document.getElementById("extWageInput").value, 10);
                const offYears = parseInt(document.getElementById("extYearsSelect").value, 10);
                const offRole = document.getElementById("extRoleSelect").value;
                const offKlausel = parseInt(document.getElementById("extKlauselSelect")?.value || "0", 10);
                const feedback = document.getElementById("extFeedback");

                const res = ContractEngine.negotiateExtension(player, club, offWage, offYears, offRole, offKlausel, state);
                if (res.success) {
                    feedback.style.color = "#34d399";
                    feedback.textContent = `✅ ${res.reason}`;
                    this.playSound("goal");
                    this.showToast(`Vertrag mit ${player.name} erfolgreich verlängert!`, "success");
                    this.app.state.saveToLocalStorage();
                    setTimeout(() => {
                        this.showPlayerDetailsModal(player.id);
                        this.renderSquad();
                        this.renderHeader();
                    }, 1200);
                } else {
                    feedback.style.color = "#ef4444";
                    feedback.textContent = `❌ ${res.reason}`;
                    this.showToast(res.reason, "error");
                }
            };
        }
    }
});
