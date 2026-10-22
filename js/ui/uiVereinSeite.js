/**
 * Das Vereinsprofil als eigene Seite, wie im Vorbild.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 * Bisher waren die Vereinsdetails ein Fenster über dem Reiter. Jetzt sind
 * sie eine Seite im Inhaltsbereich wie Spielerprofil und Transferangebot
 * (uiSeiten.js): Zurück führt dorthin, wo man herkam, von einem Spieler
 * zu seinem Verein und wieder zurück.
 *
 *   Kopf       - Wappen, Name, Liga und Land, Stadt und Stadion, das Menü
 *                Aktionen, Kennzahlen und die Sterne der Mannschaft
 *   Übersicht  - Form und nächste Spiele, Tabelle um den Verein herum,
 *                Spielweise, Schlüsselspieler, Verein (Finanzlage, Stadion,
 *                Rivalität) und Anlagen
 *   Kader      - alle Spieler nach Mannschaftsteilen, so wie das eigene
 *                Scouting sie kennt
 *   Spiele     - der ganze Spielplan der Saison mit Ergebnissen
 *   Geschichte - Platzierungen seit dem Spielstart
 *
 * Der eigene Verein hat seinen Reiter; ein Klick auf ihn führt dorthin.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /** Finanzlage in Worten - für fremde Vereine kennt man keine Zahlen */
    vereinFinanzWort(club) {
        const lohn = Math.max(1, (club.wageBudget || 0) * 52);
        const verhaeltnis = (club.balance || 0) / lohn;
        if (verhaeltnis >= 1.5) return "Reich";
        if (verhaeltnis >= 0.6) return "Gesund";
        if (verhaeltnis >= 0.15) return "Solide";
        if (verhaeltnis >= 0) return "Knapp";
        return "Verschuldet";
    },

    /** Tabelle der Liga des Vereins - die eigene oder die einer anderen Liga */
    vereinTabelle(state, club) {
        const eigeneLiga = club.leagueId === this.getUserLeagueId(state);
        return eigeneLiga ? (state.standings || []) : (state.standingsByLeague?.[club.leagueId] || []);
    },

    /** Der Ausschnitt der Tabelle um den Verein: zwei darüber, zwei darunter */
    vereinTabellenAusschnitt(state, club, rand = 2) {
        const tabelle = this.vereinTabelle(state, club);
        const i = tabelle.findIndex(s => s.clubId === club.id);
        if (i < 0) return [];
        const von = Math.max(0, Math.min(i - rand, tabelle.length - (rand * 2 + 1)));
        return tabelle.slice(von, von + rand * 2 + 1).map((s, k) => ({ ...s, platz: von + k + 1 }));
    },

    /** Alle Ligaspiele des Vereins in dieser Saison */
    vereinSpiele(state, club) {
        const spiele = [];
        (this.getScheduleForLeague(state, club.leagueId) || []).forEach(runde => (runde.matches || []).forEach(m => {
            if (m.homeClubId === club.id || m.awayClubId === club.id) spiele.push({ ...m, matchday: runde.matchday });
        }));
        return spiele;
    },

    /** Platzierungen seit dem Start - aus den archivierten Saisons der eigenen Liga */
    vereinGeschichte(state, club) {
        return (state.history?.pastSeasons || []).map(s => {
            const i = (s.standings || []).findIndex(z => z.clubId === club.id);
            if (i < 0) return null;
            const z = s.standings[i];
            return { saison: s.season, platz: i + 1, punkte: z.points, tore: `${z.goalsFor}:${z.goalsAgainst}`, meister: s.championId === club.id };
        }).filter(Boolean);
    },

    /** Das Menü Aktionen der Vereinsseite: nach Themen wie im Spielerprofil */
    vereinAktionen(state, club, ctx) {
        const { naechsterGegner, bester, torjaeger } = ctx;
        const gruppen = [
            { titel: "Ansehen", eintraege: [
                { text: "Kader", icon: "i-users", reiter: "kader" },
                { text: "Spiele", icon: "i-calendar", reiter: "spiele" },
                { text: "Geschichte", icon: "i-trophy", reiter: "geschichte" }
            ] },
            { titel: "Spiel", eintraege: [
                naechsterGegner ? { text: "Gegneranalyse vor dem Spiel", icon: "i-target", aktion: () => this.showOpponentAnalysisModal() } : null
            ] },
            { titel: "Spieler", eintraege: [
                bester ? { text: `Bester Spieler: ${bester.name}`, icon: "i-star", aktion: () => this.showPlayerDetailsModal(bester.id) } : null,
                torjaeger && torjaeger !== bester ? { text: `Torjäger: ${torjaeger.name}`, icon: "i-ball", aktion: () => this.showPlayerDetailsModal(torjaeger.id) } : null
            ] }
        ];
        return gruppen.map(g => ({ titel: g.titel, eintraege: g.eintraege.filter(Boolean) })).filter(g => g.eintraege.length);
    },

    showClubDetailsModal(clubId, optionen = {}) {
        const state = this.app?.state;
        const club = state?.clubs?.find(c => String(c.id) === String(clubId));
        if (!club) return;
        if (club.id === state.userClubId) {
            this.switchTab("club");
            return;
        }
        const inhalt = document.getElementById("vereinsSeiteInhalt");
        if (!inhalt) return;
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const liga = (state.leagues || []).find(l => l.id === club.leagueId);
        const tabelle = this.vereinTabelle(state, club);
        const platz = tabelle.findIndex(s => s.clubId === club.id);
        const zeile = platz >= 0 ? tabelle[platz] : null;
        const gemerkt = this._vereinsReiter && String(this._vereinsReiter.id) === String(club.id) ? this._vereinsReiter.reiter : null;
        const reiter = optionen.reiter || gemerkt || "uebersicht";
        this._vereinsReiter = { id: club.id, reiter };

        // Kennzahlen
        const kader = (club.playerIds || []).map(id => state.players.find(p => p.id === id)).filter(Boolean);
        const alter = kader.length ? kader.reduce((s, p) => s + (p.age || 0), 0) / kader.length : 0;
        const ruf = Math.round(club.reputation || 50);
        const plaetze = club.stadiumCapacity || club.capacity || 0;
        const rivalen = (typeof RivalryEngine !== "undefined" && RivalryEngine && typeof RivalryEngine.findRivalry === "function" && userClub)
            ? RivalryEngine.findRivalry(club, userClub) : null;

        // Spieler, so wie das eigene Scouting sie sieht
        const ratingEngine = this.getRatingEngine();
        const sichtKontext = Object.assign({ userClubId: state.userClubId, leagueDataCoverage: 85 }, this.starContext());
        const karten = new Map(kader.map(p => [p.id, ratingEngine ? ratingEngine.calculateVisiblePlayerCard(p, sichtKontext) : null]));
        const sicht = (p) => karten.get(p.id)?.starsCa ?? (p.overall || 0) / 20;
        const nachSicht = [...kader].sort((a, b) => sicht(b) - sicht(a));
        const torjaeger = [...kader].sort((a, b) => (b.stats?.goals || 0) - (a.stats?.goals || 0)).find(p => (p.stats?.goals || 0) > 0) || null;

        // Spiele
        const spiele = this.vereinSpiele(state, club);
        const name = (id) => esc(state.clubs.find(c => c.id === id)?.name || "?");
        const runde = (state.schedule || []).find(r => r.matchday === state.currentMatchday);
        const eigenesSpiel = runde?.matches?.find(m => m.homeClubId === state.userClubId || m.awayClubId === state.userClubId);
        const naechsterGegner = eigenesSpiel && !eigenesSpiel.played && (eigenesSpiel.homeClubId === club.id || eigenesSpiel.awayClubId === club.id);
        const ergebnis = (m) => {
            const heim = m.homeClubId === club.id;
            const e = heim ? m.homeGoals : m.awayGoals, f = heim ? m.awayGoals : m.homeGoals;
            return { f: e > f ? "W" : (e < f ? "L" : "D"), text: `${e}:${f}`, heim, gegner: heim ? m.awayClubId : m.homeClubId };
        };
        const gespielt = spiele.filter(m => m.played).slice(-5).reverse();
        const kommend = spiele.filter(m => !m.played).slice(0, 3);
        const spielZeile = (m) => {
            const heim = m.homeClubId === club.id;
            const gegner = heim ? m.awayClubId : m.homeClubId;
            if (!m.played) return `<li class="${gegner === state.userClubId ? "vd-gegen-uns" : ""}"><span class="vd-st">${m.matchday}.</span><button type="button" class="pf-name vd-gegner" data-vs-verein="${esc(gegner)}">${heim ? "" : "@ "}${name(gegner)}</button><small>${heim ? "Heim" : "Auswärts"}</small></li>`;
            const r = ergebnis(m);
            return `<li>${this.formPunkt(r.f)}<button type="button" class="pf-name vd-gegner" data-vs-verein="${esc(gegner)}">${heim ? "" : "@ "}${name(gegner)}</button><strong>${r.text}</strong></li>`;
        };

        // Spielweise
        const t = club.tactics || {};
        const karussell = typeof TrainerwechselEngine !== "undefined" ? TrainerwechselEngine : null;
        const trainer = karussell ? karussell.trainer(state, club) : null;
        const W = {
            mentality: { defensive: "defensiv", balanced: "ausgewogen", attacking: "offensiv", "very-defensive": "sehr defensiv", "very-attacking": "sehr offensiv",
                very_defensive: "sehr defensiv", offensive: "offensiv", very_offensive: "sehr offensiv" },
            pressing: { low: "tief", medium: "mittel", high: "hoch" },
            passStyle: { short: "kurz", mixed: "gemischt", long: "lang", direct: "direkt" },
            defensiveLine: { deep: "tief", normal: "normal", high: "hoch" }
        };
        const wort = (k) => W[k]?.[t[k]] || (t[k] ? String(t[k]) : "—");
        const fac = typeof FacilityEngine !== "undefined" ? FacilityEngine : null;
        const anlagen = fac ? fac.uebersicht(state, club.id) : [];

        const kv = (l, w) => `<div><span>${esc(l)}</span><strong>${w}</strong></div>`;
        const kachel = (titel, icon, inhaltHtml, klasse = "") => `
            <div class="dash-card pf-kachel ${klasse}">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#${icon}"/></svg>${esc(titel)}</h4>
                ${inhaltHtml}
            </div>`;
        const spielerZeile = (p) => {
            const card = karten.get(p.id);
            return `<button type="button" class="vs-spieler" data-vs-spieler="${esc(p.id)}">
                <span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span>
                <span class="vs-spieler-name">${esc(p.name)}<small>${esc(p.nationality || "")} · ${p.age} J.</small></span>
                <span class="nowrap">${card ? card.abilityStarsHtml : this.abilityStarsFor(p, { compact: true })}</span>
            </button>`;
        };
        const ausschnitt = this.vereinTabellenAusschnitt(state, club);

        const uebersicht = `
            <div class="vs-raster">
                ${kachel("Form und Spiele", "i-calendar", `
                    ${gespielt.length ? `<ul class="vd-spiele">${gespielt.map(spielZeile).join("")}</ul>` : `<p class="pf-klein">Noch keine Pflichtspiele.</p>`}
                    <h5 class="vs-unter">Nächste Spiele</h5>
                    ${kommend.length ? `<ul class="vd-spiele">${kommend.map(spielZeile).join("")}</ul>` : `<p class="pf-klein">Keine Spiele mehr in dieser Saison.</p>`}`)}
                ${kachel("Tabelle", "i-table", ausschnitt.length ? `
                    <table class="compact-table pf-tabelle vs-tabelle">
                        <thead><tr><th>#</th><th class="pf-links-text">Verein</th><th>Sp</th><th>Tore</th><th>Pkt</th></tr></thead>
                        <tbody>${ausschnitt.map(s => `<tr class="${s.clubId === club.id ? "vs-dieser" : ""}${s.clubId === state.userClubId ? " lb-eigen" : ""}"><td>${s.platz}</td><td class="pf-links-text"><button type="button" class="pf-name" data-vs-verein="${esc(s.clubId)}">${name(s.clubId)}</button></td><td>${s.played ?? ((s.won || 0) + (s.drawn || 0) + (s.lost || 0))}</td><td>${s.goalsFor}:${s.goalsAgainst}</td><td><strong>${s.points}</strong></td></tr>`).join("")}</tbody>
                    </table>` : `<p class="pf-klein">Keine Tabelle für diese Liga.</p>`)}
                ${kachel("Spielweise", "i-tactics", `
                    <div class="kv-liste">
                        ${trainer ? kv("Trainer", `${esc(trainer.name)} <small class="text-muted">seit Saison ${trainer.seit} · ${esc(karussell.stilName(trainer.stil))}</small>`) : ""}
                        ${kv("Formation", esc(club.formation || t.formation || "—"))}
                        ${kv("Grundhaltung", esc(wort("mentality")))}
                        ${kv("Pressing", esc(wort("pressing")))}
                        ${kv("Passspiel", esc(wort("passStyle")))}
                        ${kv("Abwehrlinie", esc(wort("defensiveLine")))}
                    </div>`)}
                ${kachel("Schlüsselspieler", "i-star", `
                    <div class="vs-spielerliste">${nachSicht.slice(0, 5).map(spielerZeile).join("") || '<p class="pf-klein">Kein Kader bekannt.</p>'}</div>
                    ${torjaeger ? `<p class="pf-klein">Torjäger: <button type="button" class="pf-name" data-vs-spieler="${esc(torjaeger.id)}">${esc(torjaeger.name)}</button> (${torjaeger.stats.goals})</p>` : ""}
                    <p class="pf-klein">Sterne so, wie Ihre Scouts sie kennen.</p>`, "vs-breit")}
                ${kachel("Verein", "i-shield", `
                    <div class="kv-liste">
                        ${kv("Finanzlage", esc(this.vereinFinanzWort(club)))}
                        ${kv("Stadion", `${esc(club.stadium || "—")}${plaetze ? ` <small class="text-muted">${plaetze.toLocaleString("de-DE")} Plätze</small>` : ""}`)}
                        ${kv("Fans", (club.fanBase || 0).toLocaleString("de-DE"))}
                        ${kv("Ruf", `${ruf}`)}
                        ${rivalen ? kv("Rivalität", `${esc(rivalen.titel)}`) : ""}
                    </div>`)}
                ${kachel("Anlagen", "i-build", `<div class="kv-liste">${anlagen.map(a => kv(a.name, `Stufe ${a.stufe}${a.projekt ? " · im Umbau" : ""}`)).join("") || "<div><span>—</span></div>"}</div>`)}
            </div>`;

        // Kader: alle Spieler nach Mannschaftsteilen
        const gruppen = [["tw", "Tor"], ["def", "Abwehr"], ["mid", "Mittelfeld"], ["att", "Angriff"]];
        const kaderHtml = gruppen.map(([g, titel]) => {
            const leute = kader.filter(p => this.getPosGroup(p.pos) === g).sort((a, b) => sicht(b) - sicht(a));
            if (!leute.length) return "";
            return `<tr class="vd-gruppe"><td colspan="7">${titel}</td></tr>` + leute.map(p => {
                const card = karten.get(p.id);
                return `<tr class="row-clickable" data-vs-spieler="${esc(p.id)}">
                    <td><span class="pos-tag pos-${g}">${esc(p.pos)}</span></td>
                    <td><strong>${esc(p.name)}</strong>${this.signaturMarke(p)}${p.transferListed ? ' <span class="pf-marke pf-warn">Transferliste</span>' : ""}<span class="tm-sub">${esc(p.nationality || "")}</span></td>
                    <td>${p.age}</td>
                    <td class="nowrap">${card ? card.abilityStarsHtml : this.abilityStarsFor(p, { compact: true })}</td>
                    <td class="nowrap vd-wert">${card ? card.visibleValueText : this.geldKurz(p.value)}</td>
                    <td>${p.contractYears ?? "–"} J.</td>
                    <td>${p.stats?.matches || 0} / ${p.stats?.goals || 0}</td>
                </tr>`;
            }).join("");
        }).join("");

        // Spiele: der ganze Spielplan
        const spieleHtml = spiele.length ? `
            <table class="compact-table pf-tabelle vs-spielplan">
                <thead><tr><th>ST</th><th class="pf-links-text">Gegner</th><th></th><th>Erg.</th></tr></thead>
                <tbody>${spiele.map(m => {
                    const heim = m.homeClubId === club.id;
                    const gegner = heim ? m.awayClubId : m.homeClubId;
                    const r = m.played ? ergebnis(m) : null;
                    return `<tr class="${gegner === state.userClubId ? "lb-eigen" : ""}"><td>${m.matchday}</td><td class="pf-links-text"><button type="button" class="pf-name" data-vs-verein="${esc(gegner)}">${heim ? "" : "@ "}${name(gegner)}</button></td><td>${r ? this.formPunkt(r.f) : ""}</td><td>${r ? `<strong>${r.text}</strong>` : "–"}</td></tr>`;
                }).join("")}</tbody>
            </table>` : `<p class="pf-klein">Kein Spielplan für diese Liga.</p>`;

        // Geschichte
        const geschichte = this.vereinGeschichte(state, club);
        const saisonText = typeof this.profilSaisonText === "function" ? (s) => this.profilSaisonText(s) : (s) => `Saison ${s}`;
        const geschichteHtml = geschichte.length ? `
            <div class="pf-zahlen vs-zahlen">
                <div><strong>${geschichte.length}</strong><span>Saisons</span></div>
                <div><strong>${geschichte.filter(g => g.meister).length}</strong><span>Meistertitel</span></div>
                <div><strong>${Math.min(...geschichte.map(g => g.platz))}.</strong><span>bester Platz</span></div>
            </div>
            <table class="compact-table pf-tabelle">
                <thead><tr><th>Saison</th><th>Platz</th><th>Tore</th><th>Pkt</th></tr></thead>
                <tbody>${geschichte.slice().reverse().map(g => `<tr><td>${esc(saisonText(g.saison))}</td><td>${g.platz}.${g.meister ? ' <svg class="ico vs-pokal" aria-label="Meister"><use href="#i-trophy"/></svg>' : ""}</td><td>${g.tore}</td><td>${g.punkte}</td></tr>`).join("")}</tbody>
            </table>` : `<p class="pf-klein">Die Chronik beginnt mit dem Spielstart. Nach jeder Saison steht hier, wo der Verein gelandet ist${club.leagueId === this.getUserLeagueId(state) ? "" : ", für Vereine aus der eigenen Liga"}.</p>`;

        const reiterListe = [["uebersicht", "Übersicht"], ["kader", "Kader"], ["spiele", "Spiele"], ["geschichte", "Geschichte"]];
        const f = this.wappenFarben(club);
        inhalt.innerHTML = `
            <header class="pf-kopf vs-kopf" style="--vk-farbe:${f.farbe}40;">
                <div class="pf-kopf-person">
                    <div class="vs-wappen" id="vsWappen"></div>
                    <div class="pf-kopf-text">
                        <h2 id="vsName">${esc(club.name)}</h2>
                        <div class="pf-position">${esc(liga?.shortName || liga?.name || "")}${liga?.countryId ? ` <span class="pf-codes">${esc(liga.name && liga.shortName ? liga.name.replace(/ Liga \d+$/, "") : "")}</span>` : ""}</div>
                        <div class="pf-person"><span>${esc(club.city || "")}</span><span>${esc(club.stadium || "")}</span></div>
                        ${rivalen ? `<div class="pf-marken"><span class="pf-marke pf-schlecht">${esc(rivalen.titel)}</span></div>` : ""}
                        <div class="pf-kopf-aktionen" id="vsAktionen"></div>
                    </div>
                </div>
                <div class="pf-kopf-daten">
                    <div class="pf-datum"><span>Tabellenplatz</span><strong>${zeile ? `${platz + 1}. · ${zeile.points} Pkt.` : "—"}</strong></div>
                    <div class="pf-datum"><span>Kader</span><strong>${kader.length} · Ø ${alter.toFixed(1).replace(".", ",")} J.</strong></div>
                    <div class="pf-datum"><span>Fans</span><strong>${(club.fanBase || 0).toLocaleString("de-DE")}</strong></div>
                    <div class="pf-datum"><span>Stimmung</span><strong>${Math.round(club.fanMood || 70)} %</strong></div>
                    <div class="pf-datum"><span>Ruf</span><strong>${ruf}</strong></div>
                    <div class="pf-datum"><span>Finanzlage</span><strong>${esc(this.vereinFinanzWort(club))}</strong></div>
                </div>
                <div class="pf-kopf-sterne">
                    <div class="pf-sterne"><span>Mannschaft</span><div class="pf-sternreihe">${this.teamStarsFor(club, { compact: true }) || "—"}</div><small>gemessen an Ihrem Kader</small></div>
                </div>
            </header>
            <nav class="pd-tabs" role="tablist">${reiterListe.map(([k, l]) => `<button type="button" role="tab" class="pd-tab-knopf${k === reiter ? " aktiv" : ""}" data-vs-reiter="${k}" aria-selected="${k === reiter}">${l}</button>`).join("")}</nav>
            <section class="pd-tab" data-vs-tab="uebersicht"${reiter === "uebersicht" ? "" : " hidden"}>${uebersicht}</section>
            <section class="pd-tab" data-vs-tab="kader"${reiter === "kader" ? "" : " hidden"}>
                <div class="dash-card pf-karte">
                    <div class="table-container"><table class="compact-table vd-kader">
                        <thead><tr><th>Pos</th><th>Name</th><th>Alter</th><th>Stärke</th><th>Wert</th><th>Vertrag</th><th>Sp / T</th></tr></thead>
                        <tbody>${kaderHtml || `<tr><td colspan="7" class="text-muted">Kein Kader bekannt.</td></tr>`}</tbody>
                    </table></div>
                    <p class="pf-klein">Sterne und Werte so, wie Ihre Scouts sie kennen. Ein Klick öffnet das Spielerprofil.</p>
                </div>
            </section>
            <section class="pd-tab" data-vs-tab="spiele"${reiter === "spiele" ? "" : " hidden"}><div class="dash-card pf-karte vs-schmal">${spieleHtml}</div></section>
            <section class="pd-tab" data-vs-tab="geschichte"${reiter === "geschichte" ? "" : " hidden"}><div class="dash-card pf-karte vs-schmal">${geschichteHtml}</div></section>`;

        const wappen = document.getElementById("vsWappen");
        if (wappen) this.setzeWappen(wappen, club);
        this.bindeVereinsSeite(inhalt, club, { naechsterGegner, bester: nachSicht[0] || null, torjaeger });
        this.zeigeSeite("verein", club.id);
    },

    bindeVereinsSeite(inhalt, club, ctx) {
        const state = this.app.state;
        const zurueck = document.getElementById("btnVereinsSeiteZurueck");
        if (zurueck) zurueck.onclick = () => this.seiteZurueck();
        const zeigeReiter = (k) => {
            this._vereinsReiter = { id: club.id, reiter: k };
            inhalt.querySelectorAll("[data-vs-reiter]").forEach(b => { const an = b.dataset.vsReiter === k; b.classList.toggle("aktiv", an); b.setAttribute("aria-selected", String(an)); });
            inhalt.querySelectorAll("[data-vs-tab]").forEach(s => { s.hidden = s.dataset.vsTab !== k; });
        };
        inhalt.querySelectorAll("[data-vs-reiter]").forEach(b => { b.onclick = () => zeigeReiter(b.dataset.vsReiter); });
        inhalt.querySelectorAll("[data-vs-spieler]").forEach(el => el.addEventListener("click", () => {
            const id = this.resolvePlayerId ? this.resolvePlayerId(el.dataset.vsSpieler) : el.dataset.vsSpieler;
            if (id !== null && id !== undefined) this.showPlayerDetailsModal(id);
        }));
        inhalt.querySelectorAll("[data-vs-verein]").forEach(el => el.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showClubDetailsModal(el.dataset.vsVerein);
        }));

        // Aktionen: dasselbe Menü wie im Spielerprofil
        const ort = document.getElementById("vsAktionen");
        if (!ort) return;
        const gruppen = this.vereinAktionen(state, club, ctx);
        const liste = gruppen.flatMap(g => g.eintraege);
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        ort.innerHTML = `<button type="button" class="btn btn-primary btn-sm pf-aktionen-knopf" aria-haspopup="menu" aria-expanded="false"><svg class="ico" aria-hidden="true"><use href="#i-shield"/></svg>Aktionen <svg class="ico pf-pfeil" aria-hidden="true"><use href="#i-chevron-down"/></svg></button>`;
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
                ${g.eintraege.map(a => `<button type="button" role="menuitem" class="km-eintrag" data-vs-akt="${i++}"><svg class="ico" aria-hidden="true"><use href="#${a.icon}"/></svg>${esc(a.text)}</button>`).join("")}`).join("");
            document.body.appendChild(menue);
            const r = knopf.getBoundingClientRect(), m = menue.getBoundingClientRect();
            menue.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - m.width - 8))}px`;
            menue.style.top = `${Math.max(8, Math.min(r.bottom + 6, window.innerHeight - m.height - 8))}px`;
            knopf.setAttribute("aria-expanded", "true");
            menue.addEventListener("click", (ev) => {
                const k = ev.target.closest("[data-vs-akt]");
                if (!k) return;
                this.schliesseKontextmenue();
                knopf.setAttribute("aria-expanded", "false");
                const a = liste[Number(k.dataset.vsAkt)];
                if (a?.reiter) zeigeReiter(a.reiter);
                else if (typeof a?.aktion === "function") a.aktion();
            });
            menue.querySelector("[data-vs-akt]")?.focus({ preventScroll: true });
        };
    }
});
