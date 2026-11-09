/**
 * Jeder Bereich beginnt mit einer Übersicht - wie im Vorbild.
 *
 * Ein Klick oben auf Kader, Spieltag oder Verein führt zuerst auf eine Seite
 * aus Kacheln; die Unterreiter darunter führen in die Themen. Jede Kachel
 * kommt per Klick groß nach vorn (uiKacheln.js) und führt von dort mit
 * "Seite öffnen" in ihren Bereich.
 *
 *   Kader     Kader, Verfügbarkeit, Stimmung, Mannschaftsteile, Training,
 *             Jugend, Verträge, Kaderplanung
 *   Spieltag  nächstes Spiel, Aufstellung, Taktik, Tabelle, Form, Spielplan,
 *             eigene Bestwerte, Vorbereitung (im Sommer)
 *   Verein    Verein, Vorstand, Finanzen (mit Sponsoren), Fans, Anlagen,
 *             Personal, Chronik
 *
 * Jede Kachel rechnet für sich: Fehlt einer Kachel etwas, bleibt sie leer,
 * die anderen stehen trotzdem.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /** Die Übersichtsseiten: Reiter, Raster und was sie zeichnet */
    BEREICH_UEBERSICHTEN: {
        kaderhub: { raster: "bhKader", zeichne: "renderKaderUebersicht" },
        spieltaghub: { raster: "bhSpieltag", zeichne: "renderSpieltagUebersicht" },
        vereinhub: { raster: "bhVerein", zeichne: "renderVereinUebersicht" }
    },

    /** Engines: im Browser global, unter Node per require */
    _bhEngine(name, datei) {
        if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
        if (typeof window !== "undefined" && window[name]) return window[name];
        if (typeof require !== "undefined") {
            try { return require(`../engine/${datei}`)[name] || null; } catch (e) { return null; }
        }
        return null;
    },

    /**
     * Wohin eine Kachel führt: "squad", "squad:Planung" (Reiter und
     * Unterreiter) oder "rk:vertraege" (eine Seite der Rekrutierung).
     */
    bereichGehe(ziel) {
        const [tab, unter] = String(ziel || "").split(":");
        if (!tab) return;
        if (tab === "rk") { this.rkGehe?.(unter); return; }
        this.switchTab(tab);
        if (unter && typeof this.zeigeUnterreiter === "function") this.zeigeUnterreiter(`pane-${tab}`, unter, { nachOben: true });
        this.aktualisiereKopfmenue?.();
    },

    /** Bausteine der Kacheln - dieselben wie in der Rekrutierung */
    _bhBausteine() {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const zahl = (n) => Number(n || 0).toLocaleString("de-DE");
        return {
            esc, zahl,
            geld: (b) => this.geldKurz(b || 0),
            zeile: (links, rechts, klasse = "") => `<div class="pf-zeile ${klasse}"><span>${links}</span><strong>${rechts}</strong></div>`,
            leer: (text) => `<p class="tm-leer">${esc(text)}</p>`,
            gross: (wert, unter = "") => `<div class="tm-gross">${wert}${unter ? ` <small>${unter}</small>` : ""}</div>`,
            balken: (anteil, ton = "") => `<span class="bh-balken ${ton}"><i style="width:${Math.max(2, Math.min(100, Math.round(anteil)))}%"></i></span>`,
            spieler: (p, unten, rechts = "") => `
                <button type="button" class="tm-eintrag" data-bh-spieler="${esc(p.id)}">
                    <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span>
                    <span class="tm-eintrag-name"><strong>${esc(p.name)}</strong><span class="tm-sub">${unten}</span></span>
                    ${rechts ? `<span class="tm-eintrag-wert">${rechts}</span>` : ""}
                </button>`
        };
    },

    /** Eine Kachel rechnen - geht dabei etwas schief, fehlt nur diese */
    _bhSicher(fn) {
        try { return fn() || ""; } catch (e) {
            if (typeof console !== "undefined") console.warn("Kachel ausgelassen:", e && e.message);
            return "";
        }
    },

    /** Raster füllen und verdrahten: Spieler öffnen die Akte, Kacheln kommen groß nach vorn */
    _bhFuelle(id, kacheln) {
        const box = typeof document !== "undefined" ? document.getElementById(id) : null;
        if (!box) return null;
        box.innerHTML = kacheln.filter(Boolean).join("");
        if (typeof box.querySelectorAll === "function") {
            box.querySelectorAll("[data-bh-spieler]").forEach(el => el.addEventListener("click", (e) => {
                e.stopPropagation();
                const pId = this.resolvePlayerId(el.dataset.bhSpieler);
                if (pId !== null) this.showPlayerDetailsModal(pId);
            }));
            box.querySelectorAll("[data-bh-ziel]").forEach(el => el.addEventListener("click", (e) => {
                e.stopPropagation();
                this.kachelKlein?.(true);
                this.bereichGehe(el.dataset.bhZiel);
            }));
            box.querySelectorAll("[data-bh-aktion='gegner']").forEach(el => el.addEventListener("click", (e) => {
                e.stopPropagation();
                this.kachelKlein?.(true);
                this.showOpponentAnalysisModal?.();
            }));
        }
        this.ukVerdrahte(box, (ziel) => this.bereichGehe(ziel));
        this.ukTabulator(box);
        return box;
    },

    /** Der eigene Kader (ohne U23/U19) */
    _bhKader(state, club) {
        if (typeof this.kaderQuelle === "function") return this.kaderQuelle(state, club, "profis");
        const ids = new Set(club.playerIds || []);
        return (state.players || []).filter(p => ids.has(p.id) && !p.reserve);
    },

    // ------------------------------------------------------------ Kader

    renderKaderUebersicht() {
        const state = this.app?.state;
        const club = state && (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return;
        const B = this._bhBausteine();
        const { esc, zahl, geld, zeile, leer, gross, balken } = B;
        const kader = this._bhKader(state, club);
        const nachStaerke = kader.slice().sort((a, b) => (b.overall || 0) - (a.overall || 0));
        const sterne = (p) => this.abilityStarsFor ? this.abilityStarsFor(p, { compact: true }) : "";
        const kacheln = [];

        // Kader: Kennzahlen und die Stützen
        kacheln.push(this._bhSicher(() => {
            const alter = kader.length ? kader.reduce((s, p) => s + (p.age || 0), 0) / kader.length : 0;
            const wert = kader.reduce((s, p) => s + (p.value || 0), 0);
            const gehalt = kader.reduce((s, p) => s + (p.wage || 0), 0);
            return this.ukKachel({
                titel: "Kader", icon: "i-users", ziel: "squad:Spieler", zielText: "Zum Kader", klasse: "bh-breit",
                inhalt: `
                    <div class="bh-zahlen">
                        <div><span>Spieler</span><strong>${kader.length}</strong><small>Ø ${alter.toFixed(1).replace(".", ",")} Jahre</small></div>
                        <div><span>Stärke</span><strong class="bh-sterne">${this.teamStarsFor ? this.teamStarsFor(club) : ""}</strong><small>gegen die Liga</small></div>
                        <div><span>Marktwert</span><strong>${geld(wert)}</strong><small>gesamt</small></div>
                        <div><span>Gehälter</span><strong>${geld(gehalt)}</strong><small>je Woche</small></div>
                    </div>
                    <p class="rk-unterkopf-text"><svg class="ico" aria-hidden="true"><use href="#i-star"/></svg>Die Stützen</p>
                    <div class="tm-liste uk-spalten">${nachStaerke.slice(0, 4).map(p => B.spieler(p, `${esc(p.age)} J. · ${esc(p.squadRole || "Kader")}`, sterne(p))).join("")}</div>`,
                mehr: `<p class="rk-unterkopf-text">Der ganze Kader nach Stärke</p>
                    <div class="tm-liste uk-spalten">${nachStaerke.slice(4).map(p => B.spieler(p, `${esc(p.age)} J.`, sterne(p))).join("")}</div>`
            });
        }));

        // Verfügbarkeit: Verletzte, Gesperrte, Angeschlagene
        kacheln.push(this._bhSicher(() => {
            const verletzt = kader.filter(p => (p.injuredWeeks || 0) > 0);
            const gesperrt = kader.filter(p => (p.suspendedMatches || 0) > 0);
            const muede = kader.filter(p => !(p.injuredWeeks > 0) && !p.angeschlagen && (p.fitness ?? 100) < 75).sort((a, b) => (a.fitness ?? 100) - (b.fitness ?? 100));
            const gespritzt = kader.filter(p => p.angeschlagen);
            const bereit = kader.length - new Set([...verletzt, ...gesperrt].map(p => p.id)).size;
            const liste = [
                ...verletzt.map(p => B.spieler(p, `<span class="pf-ton-schlecht">${esc(p.injuryName || "Verletzt")}</span>`, `${p.injuredWeeks} Wo.`)),
                ...gesperrt.map(p => B.spieler(p, `<span class="pf-ton-schlecht">Gesperrt</span>`, `${p.suspendedMatches} Sp.`)),
                ...gespritzt.map(p => B.spieler(p, `<span class="pf-ton-mittel">💉 Fitgespritzt</span>`, `${p.angeschlagen.wochen} Wo.`))
            ];
            return this.ukKachel({
                titel: "Verfügbarkeit", icon: "i-medical", ziel: "squad:Spieler", zielText: "Zum Kader",
                inhalt: `${gross(bereit, `von ${kader.length} einsatzbereit`)}
                    ${balken(kader.length ? bereit / kader.length * 100 : 0, bereit < kader.length - 2 ? "warn" : "gut")}
                    ${liste.length ? `<div class="tm-liste">${liste.slice(0, 3).join("")}</div>` : `<p class="tm-text">Niemand fällt aus.</p>`}
                    ${muede.length ? `<p class="tm-hinweis">${muede.length} angeschlagen (Kondition unter 75 %)</p>` : ""}`,
                mehr: `${liste.length > 3 ? `<div class="tm-liste uk-spalten">${liste.slice(3).join("")}</div>` : ""}
                    ${muede.length ? `<p class="rk-unterkopf-text">Angeschlagen</p><div class="tm-liste uk-spalten">${muede.slice(0, 10).map(p => B.spieler(p, "Kondition", `${Math.round(p.fitness ?? 100)} %`)).join("")}</div>` : ""}`
            });
        }));

        // Stimmung: Teamchemie und wer unzufrieden ist
        kacheln.push(this._bhSicher(() => {
            const chemie = Math.round(club.chemistry?.overall || 75);
            const zufrieden = kader.length ? Math.round(kader.reduce((s, p) => s + (p.happiness?.overall ?? 75), 0) / kader.length) : 75;
            const unzufrieden = kader.filter(p => (p.happiness?.overall ?? 75) < 50).sort((a, b) => (a.happiness?.overall ?? 75) - (b.happiness?.overall ?? 75));
            const ton = (w) => w >= 70 ? "gut" : w >= 50 ? "" : "schlecht";
            return this.ukKachel({
                titel: "Stimmung", icon: "i-chat", ziel: "squad:Kabine", zielText: "Zur Kabine",
                inhalt: `${zeile("Teamchemie", `<span class="pf-ton-${ton(chemie)}">${chemie} %</span>`)}${balken(chemie, ton(chemie))}
                    ${zeile("Zufriedenheit im Schnitt", `<span class="pf-ton-${ton(zufrieden)}">${zufrieden} %</span>`)}${balken(zufrieden, ton(zufrieden))}
                    ${unzufrieden.length ? `<p class="rk-unterkopf-text"><svg class="ico" aria-hidden="true"><use href="#i-frown"/></svg>Unzufrieden (${unzufrieden.length})</p>
                        <div class="tm-liste">${unzufrieden.slice(0, 2).map(p => B.spieler(p, "Zufriedenheit", `${Math.round(p.happiness?.overall ?? 0)} %`)).join("")}</div>`
                        : `<p class="tm-text">Niemand ist unzufrieden.</p>`}`,
                mehr: unzufrieden.length > 2 ? `<div class="tm-liste uk-spalten">${unzufrieden.slice(2).map(p => B.spieler(p, "Zufriedenheit", `${Math.round(p.happiness?.overall ?? 0)} %`)).join("")}</div>` : ""
            });
        }));

        // Mannschaftsteile: Tiefe je Teil
        kacheln.push(this._bhSicher(() => {
            const TEILE = [["Tor", ["TW"]], ["Abwehr", ["IV", "LV", "RV"]], ["Mittelfeld", ["DM", "ZM", "OM", "LM", "RM"]], ["Angriff", ["ST", "LA", "RA"]]];
            const zeilen = TEILE.map(([titel, pos]) => {
                const da = nachStaerke.filter(p => pos.includes(p.pos));
                const beste = da[0];
                return `<div class="bh-teil"><span><strong>${esc(titel)}</strong><small>${da.length} Spieler${beste ? ` · ${esc(beste.name)}` : ""}</small></span>${beste ? `<span class="bh-sterne">${sterne(beste)}</span>` : '<span class="pf-ton-schlecht">fehlt</span>'}</div>`;
            }).join("");
            return this.ukKachel({
                titel: "Mannschaftsteile", icon: "i-tactics", ziel: "squad:Planung", zielText: "Zur Kaderplanung",
                inhalt: zeilen,
                mehr: TEILE.map(([titel, pos]) => {
                    const da = nachStaerke.filter(p => pos.includes(p.pos));
                    return da.length ? `<p class="rk-unterkopf-text">${esc(titel)}</p><div class="tm-liste uk-spalten">${da.map(p => B.spieler(p, `${esc(p.age)} J.`, sterne(p))).join("")}</div>` : "";
                }).join("")
            });
        }));

        // Training: Vorgabe und Lage
        kacheln.push(this._bhSicher(() => {
            const T = this._bhEngine("TrainingEngine", "trainingEngine.js");
            const w = T && typeof T.wirkungDerVorgabe === "function" ? T.wirkungDerVorgabe(state) : null;
            const intensitaet = { low: "Niedrig", leicht: "Niedrig", normal: "Normal", high: "Hoch", hoch: "Hoch" }[state.trainingSettings?.intensity || "normal"] || "Normal";
            if (!w) return this.ukKachel({ titel: "Training", icon: "i-dumbbell", ziel: "training", zielText: "Zum Training", inhalt: leer("Kein Trainingsplan.") });
            return this.ukKachel({
                titel: "Training", icon: "i-dumbbell", ziel: "training:Training", zielText: "Zum Training",
                inhalt: `<p class="bh-label">Schwerpunkt</p><p class="bh-satz">${esc(w.fokusText || "Allround")}</p>
                    ${zeile("Intensität", esc(intensitaet))}
                    ${zeile("Müde (Kondition ≤ 72 %)", `<span class="${w.muede ? "pf-ton-schlecht" : ""}">${w.muede}</span>`)}
                    ${zeile("Erhöhtes Verletzungsrisiko", `<span class="${w.gefaehrdet ? "pf-ton-schlecht" : ""}">${w.gefaehrdet}</span>`)}`,
                mehr: `${zeile("Entwicklung gegenüber Standard", `${Math.round((w.entwicklung - 1) * 100)} %`)}
                    ${zeile("Belastung je Einheit", `${Math.round((w.belastung - 1) * 100)} %`)}
                    ${zeile("Erholung", `${Math.round((w.erholung - 1) * 100)} %`)}
                    ${w.rat ? `<p class="tm-text">${esc(w.rat)}</p>` : ""}`
            });
        }));

        // Jugend: U23, U19 und die besten Talente
        kacheln.push(this._bhSicher(() => {
            const R = this._bhEngine("ReserveEngine", "reserveEngine.js");
            const u23 = R && typeof R.teamKader === "function" ? R.teamKader(state, "u23") : [];
            const u19 = R && typeof R.teamKader === "function" ? R.teamKader(state, "u19") : [];
            const talente = [...u19, ...u23, ...kader.filter(p => (p.age || 30) <= 21)]
                .filter((p, i, a) => a.findIndex(x => x.id === p.id) === i)
                .sort((a, b) => (b.pot || 0) - (a.pot || 0));
            return this.ukKachel({
                titel: "Jugend", icon: "i-leaf", ziel: "youth:Akademie", zielText: "Zur Jugend",
                inhalt: `<div class="rk-zwei"><div>${gross(u23.length)}<p class="tm-text">in der U23</p></div><div>${gross(u19.length)}<p class="tm-text">in der U19</p></div></div>
                    ${talente.length ? `<p class="rk-unterkopf-text"><svg class="ico" aria-hidden="true"><use href="#i-spark"/></svg>Größte Talente</p>
                        <div class="tm-liste">${talente.slice(0, 2).map(p => B.spieler(p, `${esc(p.age)} J.`, sterne(p))).join("")}</div>` : leer("Noch keine Talente im Verein.")}`,
                mehr: talente.length > 2 ? `<div class="tm-liste uk-spalten">${talente.slice(2, 14).map(p => B.spieler(p, `${esc(p.age)} J.`, sterne(p))).join("")}</div>` : ""
            });
        }));

        // Verträge: wer bald geht
        kacheln.push(this._bhSicher(() => {
            const rk = this.getRekrutierungEngine?.();
            const v = rk ? rk.vertraege(state) : null;
            if (!v) return "";
            const ring = (z, text, ton) => `<span class="rk-ring ${ton}"><b>${z}</b><small>${text}</small></span>`;
            return this.ukKachel({
                titel: "Verträge", icon: "i-doc", ziel: "rk:vertraege", zielText: "Zu den Verträgen",
                inhalt: `<div class="rk-ringe">${ring(v.stufen.m6, "0–6 M", "schlecht")}${ring(v.stufen.m12, "6–12 M", "warn")}${ring(v.stufen.j2, "1–2 J", "mittel")}${ring(v.stufen.mehr, "2+ J", "gut")}</div>
                    ${v.auslaufend.length ? `<div class="tm-liste">${v.auslaufend.slice(0, 2).map(z => B.spieler(z.p, `noch ${z.monate} Monate`, `<span class="${{ anbieten: "pf-ton-gut", nicht: "pf-ton-schlecht" }[z.rat] || ""}">${esc(this.RAT_TEXT?.[z.rat] || "")}</span>`)).join("")}</div>`
                        : `<p class="tm-text">Kein Vertrag läuft in den nächsten zwölf Monaten aus.</p>`}`,
                mehr: v.auslaufend.length > 2 ? `<div class="tm-liste uk-spalten">${v.auslaufend.slice(2).map(z => B.spieler(z.p, `noch ${z.monate} Monate`, `<span class="${{ anbieten: "pf-ton-gut", nicht: "pf-ton-schlecht" }[z.rat] || ""}">${esc(this.RAT_TEXT?.[z.rat] || "")}</span>`)).join("")}</div>` : ""
            });
        }));

        // Kaderplanung: Baustellen und die Elf
        kacheln.push(this._bhSicher(() => {
            const kp = this._bhEngine("KaderplanungEngine", "kaderplanungEngine.js");
            const hinweise = kp && typeof kp.hinweise === "function" ? kp.hinweise(state, 10) : [];
            return this.ukKachel({
                titel: "Kaderplanung", icon: "i-target", ziel: "squad:Planung", zielText: "Zur Kaderplanung", klasse: "bh-voll",
                inhalt: `<div class="rk-planer">${this._rkMiniFeld ? this._rkMiniFeld(state, club) : ""}
                    <div class="rk-planer-text"><strong>${hinweise.length ? `${hinweise.length} Baustelle${hinweise.length === 1 ? "" : "n"}` : "Keine Probleme auf den Positionen"}</strong>
                    ${hinweise.length ? hinweise.slice(0, 3).map(h => `<p class="tm-text">${esc(h.text)}</p>`).join("") : `<p class="tm-text">Jeder Mannschaftsteil ist nach dem Kaderplan Ihrer Liga besetzt, auch nächste Saison.</p>`}</div></div>`,
                mehr: hinweise.length > 3 ? hinweise.slice(3).map(h => `<p class="tm-text">${esc(h.text)}</p>`).join("") : ""
            });
        }));

        this._bhFuelle("bhKader", kacheln);
    },

    // ------------------------------------------------------------ Spieltag

    renderSpieltagUebersicht() {
        const state = this.app?.state;
        const club = state && (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return;
        const B = this._bhBausteine();
        const { esc, zeile, leer, gross } = B;
        const kacheln = [];
        const spiele = typeof this.portalSpiele === "function" ? this._bhSicher(() => this.portalSpiele(state)) || [] : [];
        const heute = state.currentDayIndex || 0;
        const formZeichen = (t) => !t ? null : (t[0] > t[1] ? "s" : t[0] === t[1] ? "u" : "n");
        const ergebnisText = { s: "Sieg", u: "Unentschieden", n: "Niederlage" };
        const datum = (s) => typeof this.portalTagText === "function" ? this.portalTagText(s.tag?.date) : (s.tag?.date || "");

        // Nächstes Spiel
        kacheln.push(this._bhSicher(() => {
            // Aus dem eigenen Spielplan: Liga, Pokal, Europapokal und Testspiele
            const n = spiele.find(s => !s.gespielt && s.i >= heute);
            if (!n) {
                return this.ukKachel({ titel: "Nächstes Spiel", icon: "i-ball", ziel: "fixtures", zielText: "Zum Spielplan", klasse: "bh-breit", inhalt: leer("Kein Spiel angesetzt.") });
            }
            const g = n.gegner || { name: n.gegnerName || "Gegner", form: [] };
            const heim = n.heim ? club : g, gast = n.heim ? g : club;
            const form = (v) => (v.form || []).filter(f => f && f !== "-").slice(-5).map(f => `<i class="pt-f pt-f-${{ W: "s", D: "u", L: "n" }[f] || "u"}"></i>`).join("") || '<span class="text-muted">–</span>';
            const tage = n.i - heute;
            const wann = tage === 0 ? "heute" : tage === 1 ? "morgen" : `in ${tage} Tagen`;
            const seite = (v) => `<div class="bh-team">${v.id && this.wappenHtml ? this.wappenHtml(v, "bh-wappen") : `<span class="bh-wappen bh-wappen-leer"></span>`}<strong>${esc(v.name)}</strong>
                <span class="bh-team-form">${form(v)}</span>${v.id ? `<span class="bh-sterne">${this.teamStarsFor ? this.teamStarsFor(v) : ""}</span>` : ""}</div>`;
            let runde = n.kurz === "Liga" && n.tag?.matchday ? `${n.tag.matchday}. Spieltag` : (n.tag?.title && n.kurz !== "Test" ? String(this.ohneSymbol?.(n.tag.title) || n.tag.title).trim() : "");
            // Ein Endspiel ohne Runden (Supercup) heißt nur einmal so
            if (runde && (n.lang || n.kurz) && runde.includes(n.lang || n.kurz)) runde = "";
            return this.ukKachel({
                titel: "Nächstes Spiel", icon: "i-ball", ziel: "tactics", zielText: "Zur Aufstellung", klasse: "bh-breit",
                unter: `${n.kurz === "Test" ? "Testspiel" : (n.lang || n.kurz || "")}${runde ? ` · ${runde}` : ""}`,
                inhalt: `<div class="bh-spiel">${seite(heim)}<div class="bh-mitte"><span class="bh-wann">${esc(wann)}</span><strong>${esc(datum(n))}</strong><span class="bh-vs">${n.heim ? "Heimspiel" : "Auswärts"}</span></div>${seite(gast)}</div>`,
                fuss: `<button type="button" class="btn btn-sm btn-secondary" data-bh-aktion="gegner">Gegner analysieren</button><button type="button" class="btn btn-sm btn-secondary" data-bh-ziel="tactics">Aufstellung</button>`,
                mehr: (() => {
                    const liga = (state.leagues || []).find(l => l.id === g.leagueId);
                    const tab = g.leagueId === this.getUserLeagueId?.(state) ? (state.standings || []) : ((state.standingsByLeague || {})[g.leagueId] || []);
                    const platz = tab.findIndex(s => s.clubId === g.id) + 1;
                    const bisher = spiele.filter(s => s.gegner && s.gegner.id === g.id && s.gespielt);
                    return `${zeile("Gegner", `${platz ? `${platz}. der ${esc(liga?.shortName || liga?.name || "Liga")}` : esc(liga?.name || "")}`)}
                        ${zeile("Formation des Gegners", esc(g.formation || "–"))}
                        ${bisher.length ? zeile("Diese Saison", bisher.map(s => `${s.tore[0]}:${s.tore[1]}`).join(", ")) : ""}`;
                })()
            });
        }));

        // Aufstellung: die Elf auf dem Feld
        kacheln.push(this._bhSicher(() => this.ukKachel({
            titel: "Aufstellung", icon: "i-tactics", ziel: "tactics", zielText: "Zur Aufstellung",
            inhalt: `<div class="bh-feld">${this._rkMiniFeld ? this._rkMiniFeld(state, club) : ""}</div><p class="tm-text bh-mitte-text">${esc(club.formation || "")}</p>`
        })));

        // Taktik: Spielstil und wie gut sie sitzt
        kacheln.push(this._bhSicher(() => {
            const T = this.getTacticsEngine?.() || this._bhEngine("TacticsEngine", "tacticsEngine.js");
            const t = club.tactics || {};
            const stil = T && t.vorlage && T.VORLAGEN?.[t.vorlage] ? `${T.VORLAGEN[t.vorlage].name}${t.vorlageAngepasst ? " (angepasst)" : ""}` : "Eigene Taktik";
            const slots = typeof MatchEngine !== "undefined" && typeof MatchEngine.getFormationSlots === "function" ? MatchEngine.getFormationSlots(club) : null;
            const w = T && typeof T.wirksamkeit === "function" ? T.wirksamkeit(state, club, { positions: slots }) : null;
            const pct = (x) => `${Math.round((x || 0) * 100)} %`;
            return this.ukKachel({
                titel: "Taktik", icon: "i-sliders", ziel: "tactics", zielText: "Zur Taktik",
                inhalt: `${gross(esc(stil))}<p class="tm-text">Spielstil · ${esc(club.formation || "")}</p>
                    ${w ? `${zeile("Wirksamkeit", pct(w.gesamt))}${B.balken(w.gesamt * 100, w.gesamt >= 0.85 ? "gut" : w.gesamt >= 0.7 ? "" : "warn")}
                        ${zeile("Verständnis", `<span class="${w.verstaendnis < 0.85 ? "pf-ton-schlecht" : ""}">${pct(w.verstaendnis)}</span>`)}` : ""}`,
                mehr: w ? `${zeile("Komplexität", esc(w.komplexitaet?.stufe || "–"))}
                    ${zeile("Lerntempo je Einheit", `×${(w.lernFaktor || 1).toFixed(2).replace(".", ",")}`)}
                    ${w.gegnerInfo?.gegnerName ? zeile(`${esc(w.gegnerInfo.gegnerName)} studiert`, w.gegnerInfo.studiert ? "ja" : "noch nicht") : ""}` : ""
            });
        }));

        // Tabelle: der Ausschnitt um den eigenen Platz
        kacheln.push(this._bhSicher(() => {
            if (typeof this.wbDaten !== "function") return "";
            const d = this.wbDaten(state, this.getUserLeagueId(state));
            if (!d.liga) return "";
            const zeilen = d.tabelle.length ? d.tabelle : this.wbTabelleAusSpielen(state, d.liga, d.plan);
            const i = Math.max(0, zeilen.findIndex(z => z.clubId === state.userClubId));
            const von = Math.max(0, Math.min(i - 2, zeilen.length - 5));
            const zone = typeof this.tabellenZonen === "function" ? this.tabellenZonen(state, d.ligaId, zeilen.length) : new Map();
            const reihe = (z, k) => `<tr class="${z.clubId === state.userClubId ? "row-user-club" : ""}"><td class="wb-pos"><span class="wb-zone${zone.get(k + 1) ? ` zone-${zone.get(k + 1)}` : ""}"></span>${k + 1}</td>
                <td class="wb-team">${this.wbVerein(d.vereinNach.get(z.clubId), { kurz: true })}</td><td>${z.played || 0}</td><td class="pt-diff">${this.vorzeichen ? this.vorzeichen(z.goalDiff || 0) : (z.goalDiff || 0)}</td><td class="wb-pkt"><strong>${z.points || 0}</strong></td></tr>`;
            const kopf = `<thead><tr><th>Pl.</th><th>Verein</th><th>Sp</th><th class="pt-diff">Diff</th><th>Pkt</th></tr></thead>`;
            return this.ukKachel({
                titel: "Tabelle", icon: "i-table", ziel: "fixtures", zielText: "Zur Tabelle", unter: d.liga.shortName || d.liga.name,
                inhalt: `<table class="wb-tab portal-tab bh-tabelle">${kopf}<tbody>${zeilen.slice(von, von + 5).map((z, k) => reihe(z, von + k)).join("")}</tbody></table>`,
                mehr: `<table class="wb-tab portal-tab bh-tabelle">${kopf}<tbody>${zeilen.map((z, k) => reihe(z, k)).join("")}</tbody></table>`
            });
        }));

        // Form: die letzten Ergebnisse
        kacheln.push(this._bhSicher(() => {
            const vorbei = spiele.filter(s => s.gespielt && s.tore);
            const zeileSpiel = (s) => {
                const e = formZeichen(s.tore);
                return `<div class="bh-ergebnis"><i class="ps-punkt ps-${e}" aria-label="${ergebnisText[e]}"></i><span>${esc(s.gegner?.name || s.gegnerName || "Gegner")} <small>${s.heim ? "H" : "A"} · ${esc(s.kurz)}</small></span><strong>${s.tore[0]}:${s.tore[1]}</strong></div>`;
            };
            const letzte = vorbei.slice(-5);
            const punkte = letzte.reduce((n, s) => n + ({ s: 3, u: 1, n: 0 }[formZeichen(s.tore)]), 0);
            return this.ukKachel({
                titel: "Form", icon: "i-chart", ziel: "fixtures", zielText: "Zum Spielplan",
                inhalt: letzte.length ? `<div class="bh-form">${letzte.map(s => `<i class="pt-f pt-f-${formZeichen(s.tore)}" title="${esc(`${s.tore[0]}:${s.tore[1]} ${s.gegner?.name || ""}`)}"></i>`).join("")}<span>${punkte} von ${letzte.length * 3} Punkten</span></div>
                    ${letzte.slice().reverse().slice(0, 3).map(zeileSpiel).join("")}` : leer("Noch kein Pflichtspiel gespielt."),
                mehr: vorbei.length > 3 ? vorbei.slice().reverse().slice(3, 15).map(zeileSpiel).join("") : ""
            });
        }));

        // Spielplan: die nächsten Spiele
        kacheln.push(this._bhSicher(() => {
            const kommt = spiele.filter(s => !s.gespielt && s.i >= heute);
            const zeileSpiel = (s) => `<div class="bh-ergebnis"><span class="bh-datum">${esc(datum(s))}</span><span>${esc(s.gegner?.name || s.gegnerName || "Gegner")} <small>${s.heim ? "H" : "A"} · ${esc(s.kurz)}</small></span></div>`;
            return this.ukKachel({
                titel: "Spielplan", icon: "i-calendar", ziel: "fixtures", zielText: "Zum Spielplan",
                inhalt: kommt.length ? kommt.slice(0, 4).map(zeileSpiel).join("") : leer("Keine Spiele mehr angesetzt."),
                mehr: kommt.length > 4 ? kommt.slice(4, 16).map(zeileSpiel).join("") : ""
            });
        }));

        // Eigene Bestwerte der Saison
        kacheln.push(this._bhSicher(() => {
            const S = this._bhEngine("StatistikEngine", "statistikEngine.js");
            const kader = this._bhKader(state, club);
            const werte = kader.map(p => ({ p, s: S && typeof S.von === "function" ? S.von(p, "alle") : (p.stats || {}) }));
            const bester = (f, min = 1) => werte.filter(x => f(x.s) >= min).sort((a, b) => f(b.s) - f(a.s))[0];
            const tore = bester(s => s.goals || 0), vorlagen = bester(s => s.assists || 0);
            const note = werte.filter(x => (x.s.matches || 0) >= 3).sort((a, b) => b.s.ratingSum / b.s.matches - a.s.ratingSum / a.s.matches)[0];
            const liste = [
                tore ? B.spieler(tore.p, "Meiste Tore", `${tore.s.goals}`) : "",
                vorlagen ? B.spieler(vorlagen.p, "Meiste Vorlagen", `${vorlagen.s.assists}`) : "",
                note ? B.spieler(note.p, "Beste Note", (note.s.ratingSum / note.s.matches).toFixed(2).replace(".", ",")) : ""
            ].filter(Boolean);
            const torjaeger = werte.filter(x => (x.s.goals || 0) > 0).sort((a, b) => b.s.goals - a.s.goals);
            return this.ukKachel({
                titel: "Bestwerte", icon: "i-trophy", ziel: "stats", zielText: "Zu den Statistiken",
                inhalt: liste.length ? `<div class="tm-liste">${liste.join("")}</div>` : leer("Nach dem ersten Pflichtspiel stehen hier die Besten der Mannschaft."),
                mehr: torjaeger.length ? `<p class="rk-unterkopf-text">Torschützen</p><div class="tm-liste uk-spalten">${torjaeger.slice(0, 12).map(x => B.spieler(x.p, `${x.s.matches || 0} Spiele`, `${x.s.goals} Tore`)).join("")}</div>` : ""
            });
        }));

        // Vorbereitung - nur im Sommer
        const vorbereitung = typeof document !== "undefined" ? document.getElementById("navPreseason") : null;
        if (vorbereitung && vorbereitung.style.display !== "none") {
            kacheln.push(this._bhSicher(() => {
                const pre = state.preseason || {};
                const tests = (pre.testspiele || []);
                return this.ukKachel({
                    titel: "Vorbereitung", icon: "i-sun", ziel: "preseason", zielText: "Zur Vorbereitung", klasse: "bh-voll",
                    inhalt: `${gross(tests.length, `Testspiel${tests.length === 1 ? "" : "e"} vereinbart`)}
                        ${tests.length ? `<div class="uk-spalten">${tests.map(t => zeile(esc(t.gegnerName || "Gegner"), t.gespielt ? esc(t.ergebnis || "") : "offen")).join("")}</div>`
                            : `<p class="tm-text">Vor dem ersten Spieltag: Testspiele vereinbaren, Trainingslager buchen, den Stab besetzen.</p>`}`
                });
            }));
        }

        this._bhFuelle("bhSpieltag", kacheln);
    },

    // ------------------------------------------------------------ Verein

    renderVereinUebersicht() {
        const state = this.app?.state;
        const club = state && (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return;
        const B = this._bhBausteine();
        const { esc, zahl, geld, zeile, leer, gross, balken } = B;
        const kacheln = [];
        const ton = (w) => w >= 70 ? "gut" : w >= 45 ? "" : "schlecht";

        // Verein: Kopf mit Wappen und Kennzahlen
        kacheln.push(this._bhSicher(() => {
            const liga = (state.leagues || []).find(l => l.id === club.leagueId);
            const tab = state.standings || [];
            const platz = tab.findIndex(s => s.clubId === club.id) + 1;
            const ruf = Math.round(club.reputation || 60);
            return this.ukKachel({
                titel: "Verein", icon: "i-shield", ziel: "club:Übersicht", zielText: "Zum Verein", klasse: "bh-breit",
                inhalt: `<div class="bh-verein">${this.wappenHtml ? this.wappenHtml(club, "bh-wappen-gross") : ""}
                        <div><strong>${esc(club.name)}</strong><small>${esc([liga?.shortName || liga?.name, club.city, club.stadium].filter(Boolean).join(" · "))}</small></div></div>
                    <div class="bh-zahlen">
                        <div><span>Platz</span><strong>${platz ? `${platz}.` : "–"}</strong><small>${tab.length ? `von ${tab.length}` : ""}</small></div>
                        <div><span>Ruf</span><strong>${ruf}</strong>${balken(ruf)}</div>
                        <div><span>Fans</span><strong>${zahl(club.fanBase || 25000)}</strong><small>${zahl(club.capacity || 0)} Plätze</small></div>
                        <div><span>Kontostand</span><strong class="${(club.balance || 0) < 0 ? "pf-ton-schlecht" : ""}">${geld(club.balance)}</strong><small>${esc(club.sponsor?.name || "")}</small></div>
                    </div>`
            });
        }));

        // Vorstand: Vertrauen, Saisonziel, Vision
        kacheln.push(this._bhSicher(() => {
            const BE = this._bhEngine("BoardEngine", "boardEngine.js");
            const ziel = BE && typeof BE.zielText === "function" ? BE.zielText(state, club) : null;
            const vertrauen = Math.round(state.boardConfidence ?? 75);
            const V = this._bhEngine("VisionEngine", "visionEngine.js");
            const u = V && typeof V.uebersicht === "function" ? V.uebersicht(state) : null;
            const auf = u ? u.jahresziele.filter(z => z.steht === true).length : 0;
            return this.ukKachel({
                titel: "Vorstand", icon: "i-briefcase", ziel: "club:Vision & Partner", zielText: "Zur Vision",
                inhalt: `${gross(`${vertrauen} %`, "Vertrauen")}${balken(vertrauen, ton(vertrauen))}
                    ${ziel ? zeile("Saisonziel", esc(ziel)) : ""}
                    ${u ? zeile("Jahresziele auf Kurs", `${auf} von ${u.jahresziele.length}`) : ""}`,
                mehr: u ? `<p class="rk-unterkopf-text">Fernziel bis Saison ${esc(u.fern?.bisSaison ?? u.bisSaison)}</p><p class="tm-text">${esc(u.fern?.text || "")}</p>
                    ${u.jahresziele.map(z => `<div class="rk-vorgabe ${z.steht ? "gut" : "offen"}"><span>${esc(z.text)}</span><strong>${z.steht === null ? "offen" : z.steht ? "auf Kurs" : "dahinter"}</strong></div>`).join("")}` : ""
            });
        }));

        // Finanzen: Konto, Budgets, Prognose
        kacheln.push(this._bhSicher(() => {
            const F = this._bhEngine("FinanceEngine", "financeEngine.js");
            const pr = F && typeof F.prognose === "function" ? F.prognose(state, club) : null;
            const sp = F && typeof F.sponsoring === "function" ? F.sponsoring(state, club) : null;
            const kader = this._bhKader(state, club);
            const gehalt = kader.reduce((s, p) => s + (p.wage || 0), 0);
            return this.ukKachel({
                titel: "Finanzen", icon: "i-wallet", ziel: "finances", zielText: "Zu den Finanzen",
                inhalt: `${gross(`<span class="${(club.balance || 0) < 0 ? "pf-ton-schlecht" : ""}">${geld(club.balance)}</span>`, "Kontostand")}
                    ${zeile("Transferbudget", geld(Math.max(0, club.transferBudget || 0)))}
                    ${zeile("Gehaltsbudget frei", `<span class="${(club.wageBudget || 0) - gehalt < 0 ? "pf-ton-schlecht" : ""}">${geld((club.wageBudget || 0) - gehalt)} / Wo.</span>`)}
                    ${pr ? zeile("Prognose Saisonende", `<span class="${pr.diese.saldo < 0 ? "pf-ton-schlecht" : "pf-ton-gut"}">${geld(pr.diese.saldo)}</span>`) : ""}
                    ${sp ? zeile("Sponsoring der Saison", geld(sp.summe)) : ""}`,
                mehr: `${pr ? `${zeile("Umsatz der Saison (Prognose)", geld(pr.diese.umsatz))}${zeile("Kontostand ein Jahr später", geld(pr.naechste.saldo))}` : ""}
                    ${sp ? `<p class="rk-unterkopf-text">Sponsoring der Saison · ${geld(sp.summe)}</p>${sp.posten.map(p => zeile(esc(p.name), geld(p.betrag))).join("")}` : ""}`
            });
        }));

        // Fans und Stimmung
        kacheln.push(this._bhSicher(() => {
            const stimmung = Math.round(state.fanMood || 75);
            const chemie = Math.round(club.chemistry?.overall || 75);
            return this.ukKachel({
                titel: "Fans & Stimmung", icon: "i-flag", ziel: "club:Übersicht", zielText: "Zum Verein",
                inhalt: `${zeile("Stimmung der Fans", `<span class="pf-ton-${ton(stimmung)}">${stimmung} %</span>`)}${balken(stimmung, ton(stimmung))}
                    ${zeile("Teamchemie", `<span class="pf-ton-${ton(chemie)}">${chemie} %</span>`)}${balken(chemie, ton(chemie))}
                    ${zeile("Fanbasis", zahl(club.fanBase || 25000))}`
            });
        }));

        // Anlagen: Stufen und Zustand
        kacheln.push(this._bhSicher(() => {
            const FA = this._bhEngine("FacilityEngine", "facilityEngine.js");
            const liste = FA && typeof FA.uebersicht === "function" ? FA.uebersicht(state, club.id) : [];
            if (!liste.length) return "";
            const pips = (a) => `<span class="bh-pips">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= Math.floor(a.wirksameStufe ?? a.stufe) ? "an" : i <= a.stufe ? "halb" : ""}"></i>`).join("")}</span>`;
            const bau = liste.filter(a => a.projekt);
            return this.ukKachel({
                titel: "Anlagen", icon: "i-build", ziel: "club:Anlagen", zielText: "Zu den Anlagen",
                inhalt: liste.map(a => `<div class="bh-anlage"><span>${esc(a.name)}</span>${pips(a)}<small class="${a.zustand < 45 ? "pf-ton-schlecht" : ""}">${a.zustand} %</small></div>`).join("")
                    + (bau.length ? `<p class="tm-hinweis">Im Bau: ${esc(bau.map(a => a.name).join(", "))}</p>` : ""),
                mehr: liste.map(a => zeile(`${esc(a.name)} · Stufe ${a.stufe}`, esc(a.zustandsText || ""))).join("")
            });
        }));

        // Personal: der Stab
        kacheln.push(this._bhSicher(() => {
            const pe = this._bhEngine("PreseasonEngine", "preseasonEngine.js");
            const bereiche = pe?.BEREICHE || [];
            const besetzt = bereiche.filter(b => club.staff?.[b.key]);
            const offen = bereiche.filter(b => !club.staff?.[b.key]);
            return this.ukKachel({
                titel: "Personal", icon: "i-user", ziel: "club:Trainer", zielText: "Zum Trainerstab",
                inhalt: `${gross(besetzt.length, `von ${bereiche.length} Posten besetzt`)}
                    ${offen.length ? `<p class="tm-text pf-ton-schlecht">Offen: ${esc(offen.map(b => b.titel).join(", "))}</p>` : `<p class="tm-text">Der Stab ist komplett.</p>`}
                    ${besetzt.slice(0, 3).map(b => zeile(esc(b.titel), esc(club.staff[b.key]?.name || "besetzt"))).join("")}`,
                mehr: besetzt.slice(3).map(b => zeile(esc(b.titel), esc(club.staff[b.key]?.name || "besetzt"))).join("")
            });
        }));

        // Chronik: Titel und Rekorde
        kacheln.push(this._bhSicher(() => {
            const MS = this._bhEngine("MeilensteinEngine", "meilensteinEngine.js");
            const CH = this._bhEngine("ChronikEngine", "chronikEngine.js");
            const titel = MS && typeof MS.trophaeen === "function" ? MS.trophaeen(state, club.id) : [];
            const u = CH && typeof CH.uebersicht === "function" ? CH.uebersicht(state, club.id) : null;
            const anzahl = titel.reduce((n, t) => n + (t.anzahl || 0), 0);
            const r = u?.rekorde || {};
            const spiel = (e) => e ? `${esc(e.ergebnis)} ${e.heim ? "gegen" : "bei"} ${esc(e.gegner)}` : "–";
            return this.ukKachel({
                titel: "Chronik", icon: "i-trophy", ziel: "club:Chronik", zielText: "Zur Chronik",
                inhalt: `${gross(anzahl, anzahl === 1 ? "Titel" : "Titel")}
                    ${titel.length ? titel.slice(0, 3).map(t => zeile(esc(t.wettbewerb), `${t.anzahl}×`)).join("") : `<p class="tm-text">Der Trophäenschrank wartet noch auf den ersten Titel.</p>`}`,
                mehr: `${zeile("Höchster Sieg", spiel(r.hoechsterSieg))}${zeile("Höchste Niederlage", spiel(r.hoechsteNiederlage))}
                    ${r.kauf ? zeile("Teuerster Kauf", `${esc(r.kauf.name)} · ${geld(r.kauf.wert)}`) : ""}
                    ${r.verkauf ? zeile("Teuerster Verkauf", `${esc(r.verkauf.name)} · ${geld(r.verkauf.wert)}`) : ""}`
            });
        }));

        this._bhFuelle("bhVerein", kacheln);
    }
});
