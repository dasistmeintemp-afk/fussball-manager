/**
 * Wettbewerbsseite einer Liga wie im Vorbild: ein Kopf mit Land,
 * Titelverteidiger, Rang und Ansehen, darunter Kacheln - Tabelle, Spieltag,
 * Schlagzeilen, Rangliste der Länder, Statistik, Zu- und Abgänge, frühere
 * Sieger. Jede Kachel öffnet ihre ausführliche Ansicht.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype (wie
 * uiWettbewerbe.js, das Pokal, Europapokal und Relegation zeigt).
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /** Ansehen einer Liga aus dem Ruf des Landes, je tiefere Stufe weniger */
    ligaAnsehen(liga) {
        const ruf = (liga?.countryReputation || 50) - ((liga?.level || 1) - 1) * 14;
        return ruf >= 85 ? "Weltklasse" : ruf >= 75 ? "Hervorragend" : ruf >= 64 ? "Gut"
            : ruf >= 50 ? "Ordentlich" : ruf >= 36 ? "Regional" : "Örtlich";
    },

    /** "2026/27" für eine Saisonnummer - die erste Saison beginnt im Startjahr */
    saisonText(state, saison) {
        const [, monat, jahr] = String(state?.currentDate || "").split(".").map(Number);
        const beginnJetzt = jahr ? (monat >= 7 ? jahr : jahr - 1) : 2026;
        const start = beginnJetzt - ((state?.seasonYear || 1) - saison);
        return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
    },

    /**
     * Tabelle aus den Ergebnissen: alle Spiele, nur Heim- oder nur
     * Auswärtsspiele, bis zu einem Spieltag. Sortiert wie die echte Tabelle
     * (Punkte, Tordifferenz, Tore).
     */
    wbTabelleAusSpielen(state, liga, plan, { art = "gesamt", bis = Infinity } = {}) {
        const sieg = liga?.pointsPerWin ?? 3, remis = liga?.pointsPerDraw ?? 1;
        const zeilen = new Map();
        const zeile = (id) => {
            if (!zeilen.has(id)) zeilen.set(id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 });
            return zeilen.get(id);
        };
        (plan || []).forEach(runde => {
            if ((runde.matchday || 0) > bis) return;
            (runde.matches || []).forEach(m => {
                zeile(m.homeClubId); zeile(m.awayClubId);
                if (!m.played) return;
                [["home", m.homeClubId, m.homeGoals, m.awayGoals], ["away", m.awayClubId, m.awayGoals, m.homeGoals]].forEach(([seite, id, f, g]) => {
                    if (art !== "gesamt" && art !== seite) return;
                    const z = zeile(id);
                    z.played++; z.goalsFor += f; z.goalsAgainst += g;
                    if (f > g) { z.won++; z.points += sieg; } else if (f === g) { z.drawn++; z.points += remis; } else z.lost++;
                });
            });
        });
        return [...zeilen.values()].map(z => Object.assign(z, { goalDiff: z.goalsFor - z.goalsAgainst }))
            .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);
    },

    /** Der zuletzt gespielte Spieltag, sonst der erste */
    wbLetzterSpieltag(plan) {
        const gespielt = (plan || []).filter(r => (r.matches || []).some(m => m.played));
        return gespielt.length ? gespielt[gespielt.length - 1].matchday : ((plan || [])[0]?.matchday || 1);
    },

    /** Alles, was Kacheln und Ansichten über eine Liga brauchen */
    wbDaten(state, ligaId) {
        const liga = (state.leagues || []).find(l => l.id === ligaId);
        const tabelle = ligaId === this.getUserLeagueId(state) ? (state.standings || []) : ((state.standingsByLeague || {})[ligaId] || []);
        const plan = this.getScheduleForLeague(state, ligaId);
        const vereinNach = new Map((state.clubs || []).map(c => [c.id, c]));
        const letzter = this.wbLetzterSpieltag(plan);
        // Wer seit dem letzten Spieltag gestiegen oder gefallen ist
        const vorher = new Map(this.wbTabelleAusSpielen(state, liga, plan, { bis: letzter - 1 }).map((z, i) => [z.clubId, i + 1]));
        const meister = ((state.ligaMeister || {})[ligaId] || []).slice().reverse();
        return { liga, ligaId, tabelle, plan, vereinNach, letzter, vorher, meister };
    },

    /** Ein Verein in Kurzform: Wappen und Name, auf Wunsch anklickbar */
    wbVerein(club, { kurz = false, klasse = "" } = {}) {
        if (!club) return "";
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        return `<span class="wb-verein ${klasse}" data-wb-verein="${esc(club.id)}" title="${esc(club.name)}">${this.wappenHtml(club, "crest-sm wb-wappen")}<span>${esc(kurz ? this.kurzName(club.name) : club.name)}</span></span>`;
    },

    // ------------------------------------------------------------ Kacheln

    /** Die ganze Seite einer Liga: Kopf und acht Kacheln */
    renderWettbewerbSeite(state, ligaId) {
        const host = document.getElementById("wbSeite");
        if (!host) return;
        const d = this.wbDaten(state, ligaId);
        if (!d.liga) { host.innerHTML = ""; return; }
        // Die Spieltag-Kachel folgt dem zuletzt gespielten Spieltag - geblättert
        // wird nur, bis der nächste gespielt ist oder die Liga wechselt
        if (!this._wbSpieltag || this._wbSpieltagLiga !== ligaId || this._wbLetzter !== d.letzter) {
            this._wbSpieltag = d.letzter;
            this._wbSpieltagLiga = ligaId;
            this._wbLetzter = d.letzter;
        }
        host.innerHTML = `
            ${this.wbKopfHtml(state, d)}
            <div class="wb-raster">
                <section class="dash-card wb-kachel wb-k-tabelle">${this.wbKachelTabelle(state, d)}</section>
                <section class="dash-card wb-kachel wb-k-spieltag">${this.wbKachelSpieltag(state, d)}</section>
                <section class="dash-card wb-kachel wb-k-nachrichten">${this.wbKachelNachrichten(state, d)}</section>
                <section class="dash-card wb-kachel wb-k-rangliste">${this.wbKachelRangliste(state, d)}</section>
                <section class="dash-card wb-kachel wb-k-statistik">${this.wbKachelStatistik(state, d)}</section>
                <section class="dash-card wb-kachel wb-k-wechsel">${this.wbKachelWechsel(state, d)}</section>
                <section class="dash-card wb-kachel wb-k-sieger">${this.wbKachelSieger(state, d)}</section>
            </div>`;
        this.bindeWettbewerbSeite(host, state, d);
    },

    /** Kopf: Name, Vereine und Spieltage, dazu Land, Titelverteidiger, Rang, Ansehen */
    wbKopfHtml(state, d) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const { liga, meister, vereinNach } = d;
        // Der Name aus den Länderdaten - auch für die Länder im Hintergrund
        const laender = typeof COUNTRIES_DATA !== "undefined" && Array.isArray(COUNTRIES_DATA) ? COUNTRIES_DATA : [];
        const land = laender.find(l => l.id === liga.countryId)?.name
            || (typeof KoeffizientEngine !== "undefined" && KoeffizientEngine.NAMEN?.[liga.countryId]) || String(liga.countryId || "").toUpperCase();
        const halter = meister[0] ? vereinNach.get(meister[0].c) : null;
        let rang = `${liga.level || 1}. Stufe in ${land}`;
        if ((liga.level || 1) === 1 && typeof KoeffizientEngine !== "undefined" && typeof KoeffizientEngine.rangliste === "function") {
            const eintrag = KoeffizientEngine.rangliste(state).find(z => z.land === liga.countryId);
            if (eintrag) rang = `${eintrag.rang}. in Europa`;
        }
        const zelle = (titel, inhalt) => `<div class="wb-kopf-zelle"><span>${titel}</span><strong>${inhalt}</strong></div>`;
        return `
            <header class="dash-card wb-kopf">
                <div class="wb-kopf-name">
                    <span class="wb-emblem" aria-hidden="true">${this.flaggeVon(liga.countryId)}</span>
                    <div>
                        <h2>${esc(liga.shortName || liga.name)}</h2>
                        <small>${d.tabelle.length || liga.teamCount || 0} Vereine · ${d.plan.length || liga.matchdays || 0} Spieltage · Saison ${esc(this.saisonText(state, state.seasonYear || 1))}</small>
                    </div>
                </div>
                <div class="wb-kopf-daten">
                    ${zelle("Land", `${this.flaggeVon(liga.countryId)} ${esc(land)}`)}
                    ${zelle("Titelverteidiger", halter ? this.wbVerein(halter, { kurz: true }) : '<span class="text-muted">Erste Saison</span>')}
                    ${zelle("Rang", esc(rang))}
                    ${zelle("Ansehen", `<i class="wb-ruf" aria-hidden="true"></i>${esc(this.ligaAnsehen(liga))}`)}
                </div>
            </header>`;
    },

    /** Kachelkopf: Titel als Knopf zur ausführlichen Ansicht */
    wbKachelKopf(titel, ansicht, zusatz = "") {
        return `<header class="wb-k-kopf"><button type="button" class="wb-k-titel" data-wb-ansicht="${ansicht}">${titel}<svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></button>${zusatz}</header>`;
    },

    kachelTabelleZeilen(state, d, zeilen, { kurz = true } = {}) {
        const zonen = this.tabellenZonen(state, d.ligaId, zeilen.length);
        const nutzer = state.userClubId;
        return zeilen.map((s, i) => {
            const platz = i + 1;
            const zone = zonen.get(platz);
            const vorher = d.vorher.get(s.clubId);
            const trend = !vorher || vorher === platz ? '<i class="wb-trend gleich" title="unverändert">–</i>'
                : vorher > platz ? `<i class="wb-trend hoch" title="von Platz ${vorher}">▲</i>` : `<i class="wb-trend runter" title="von Platz ${vorher}">▼</i>`;
            return `<tr class="${s.clubId === nutzer ? "row-user-club" : ""}" data-club-id="${this.escapeHtml(s.clubId)}">
                <td class="wb-pos"><span class="wb-zone${zone ? ` zone-${zone}` : ""}"></span>${platz}</td>
                <td class="wb-tr">${trend}</td>
                <td class="wb-team">${this.wbVerein(d.vereinNach.get(s.clubId), { kurz })}</td>
                <td class="wb-zahl">${s.played}</td>
                <td class="wb-zahl wb-pkt">${s.points}</td>
            </tr>`;
        }).join("");
    },

    wbLegende(state, d, anzahl) {
        const genutzt = [...new Set(this.tabellenZonen(state, d.ligaId, anzahl).values())];
        return genutzt.map(z => `<span><i class="wb-zone zone-${z}"></i>${this.constructor.ZONEN[z]}</span>`).join("");
    },

    wbKachelTabelle(state, d) {
        const zeilen = d.tabelle.length ? d.tabelle : this.wbTabelleAusSpielen(state, d.liga, d.plan);
        return `${this.wbKachelKopf("Tabelle", "tabelle")}
            <div class="wb-k-inhalt wb-tab-rahmen">
                <table class="wb-tab"><thead><tr><th>Pl.</th><th></th><th>Verein</th><th>Sp</th><th>Pkt</th></tr></thead>
                <tbody>${this.kachelTabelleZeilen(state, d, zeilen)}</tbody></table>
            </div>
            <footer class="wb-legende">${this.wbLegende(state, d, zeilen.length)}</footer>`;
    },

    /** Ein Spiel als Zeile: Heim, Ergebnis, Gast */
    wbSpielZeile(state, m, { kurz = true } = {}) {
        const v = (id) => (state.clubs || []).find(c => c.id === id);
        const eigen = m.homeClubId === state.userClubId || m.awayClubId === state.userClubId;
        return `<div class="wb-spiel${eigen ? " eigen" : ""}">
            <span class="wb-heim">${this.wbVerein(v(m.homeClubId), { kurz })}</span>
            <b class="wb-erg${m.played ? "" : " offen"}">${m.played ? `${m.homeGoals}:${m.awayGoals}` : "–:–"}</b>
            <span class="wb-gast">${this.wbVerein(v(m.awayClubId), { kurz })}</span>
        </div>`;
    },

    wbKachelSpieltag(state, d) {
        const runde = d.plan.find(r => r.matchday === this._wbSpieltag) || d.plan[0];
        const gesamt = d.plan.length;
        const nr = runde?.matchday || 1;
        const blaettern = `<span class="wb-blaettern">
            <button type="button" class="kopf-icon" data-wb-spieltag="-1" aria-label="Voriger Spieltag"${nr <= 1 ? " disabled" : ""}><svg class="ico"><use href="#i-arrow-left"/></svg></button>
            <button type="button" class="kopf-icon" data-wb-spieltag="1" aria-label="Nächster Spieltag"${nr >= gesamt ? " disabled" : ""}><svg class="ico"><use href="#i-arrow"/></svg></button>
        </span>`;
        const spiele = (runde?.matches || []).map(m => this.wbSpielZeile(state, m)).join("");
        const status = !runde ? "" : runde.matches.every(m => m.played) ? "beendet" : runde.matches.some(m => m.played) ? "läuft" : "kommt noch";
        return `${this.wbKachelKopf("Spieltag", "spieltag", blaettern)}
            <div class="wb-k-unter">${nr}. Spieltag von ${gesamt}${status ? ` · ${status}` : ""}</div>
            <div class="wb-k-inhalt wb-spiele">${spiele || '<p class="text-muted">Keine Partien.</p>'}</div>`;
    },

    /**
     * Schlagzeilen aus Tabelle und Ergebnissen - für jede Liga. In der eigenen
     * Liga dazu die Gerüchte der Sportpresse.
     */
    wbSchlagzeilen(state, d) {
        const zeilen = [];
        const name = (id) => d.vereinNach.get(id)?.name || "";
        const t = d.tabelle;
        if (t.length > 1 && t[0].played) {
            const abstand = t[0].points - t[1].points;
            zeilen.push({ art: "spitze", titel: abstand > 0 ? `${name(t[0].clubId)} führt mit ${abstand} Punkt${abstand === 1 ? "" : "en"} Vorsprung` : `${name(t[0].clubId)} und ${name(t[1].clubId)} punktgleich oben`, text: `${t[0].points} Punkte nach ${t[0].played} Spielen` });
        }
        const runde = d.plan.find(r => r.matchday === d.letzter);
        const hoch = (runde?.matches || []).filter(m => m.played)
            .sort((a, b) => Math.abs(b.homeGoals - b.awayGoals) - Math.abs(a.homeGoals - a.awayGoals) || (b.homeGoals + b.awayGoals) - (a.homeGoals + a.awayGoals))[0];
        if (hoch && Math.abs(hoch.homeGoals - hoch.awayGoals) >= 3) {
            zeilen.push({ art: "ergebnis", titel: `${name(hoch.homeClubId)} ${hoch.homeGoals}:${hoch.awayGoals} ${name(hoch.awayClubId)}`, text: `Das Ergebnis des ${d.letzter}. Spieltags` });
        }
        t.forEach(r => {
            const form = (d.vereinNach.get(r.clubId)?.form || []).filter(f => f && f !== "-").slice(-5);
            if (form.length < 5) return;
            if (form.every(f => f === "W" || f === "S")) zeilen.push({ art: "serie", titel: `${name(r.clubId)} gewinnt fünfmal in Folge`, text: `Platz ${t.indexOf(r) + 1}` });
            else if (!form.some(f => f === "W" || f === "S")) zeilen.push({ art: "krise", titel: `${name(r.clubId)} seit fünf Spielen ohne Sieg`, text: `Platz ${t.indexOf(r) + 1}` });
        });
        if (d.ligaId === this.getUserLeagueId(state) && typeof LigaNachrichtenEngine !== "undefined" && typeof LigaNachrichtenEngine.geruechteDieseSaison === "function") {
            LigaNachrichtenEngine.geruechteDieseSaison(state).slice(-3).reverse().forEach(g => {
                zeilen.push({ art: "geruecht", titel: `${g.spieler} zu ${g.verein}?`, text: g.wahr ? "Das Gerücht stimmte" : `Gerücht vom ${g.datum || ""}` });
            });
        }
        return zeilen;
    },

    wbKachelNachrichten(state, d) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const zeilen = this.wbSchlagzeilen(state, d).slice(0, 4);
        return `${this.wbKachelKopf("Schlagzeilen", "nachrichten")}
            <div class="wb-k-inhalt wb-news">${zeilen.length ? zeilen.map(z => `<div class="wb-news-zeile wb-news-${z.art}"><strong>${esc(z.titel)}</strong><small>${esc(z.text)}</small></div>`).join("")
                : '<p class="text-muted">Noch ist nichts passiert. Nach dem ersten Spieltag stehen hier Spitze, Ergebnisse und Serien.</p>'}</div>`;
    },

    wbRangliste(state) {
        return typeof KoeffizientEngine !== "undefined" && typeof KoeffizientEngine.rangliste === "function" ? KoeffizientEngine.rangliste(state) : [];
    },

    wbKachelRangliste(state, d) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const liste = this.wbRangliste(state);
        const eigen = d.liga.countryId;
        const oben = liste.slice(0, 6);
        if (!oben.some(z => z.land === eigen)) { const z = liste.find(x => x.land === eigen); if (z) oben.push(z); }
        const ersteLiga = (land) => (state.leagues || []).find(l => l.countryId === land && (l.level || 1) === 1);
        return `${this.wbKachelKopf("Rangliste", "rangliste")}
            <div class="wb-k-inhalt wb-rang">${oben.map(z => `<div class="wb-rang-zeile${z.land === eigen ? " eigen" : ""}">
                <b>${z.rang}</b><span>${this.flaggeVon(z.land)} ${esc(ersteLiga(z.land)?.shortName || z.name)}</span><small>${esc(z.name)}</small><em>${z.summe.toFixed(1).replace(".", ",")}</em></div>`).join("")}</div>
            <footer class="wb-k-fuss">Fünfjahreswertung · ${liste.length} Länder</footer>`;
    },

    /** Statistik der Liga: Vereine aus den Ergebnissen, Spieler aus ihren Ligawerten */
    wbStatistik(state, d, anzahl = 1) {
        const vereine = d.tabelle.length ? d.tabelle : this.wbTabelleAusSpielen(state, d.liga, d.plan);
        const zuNull = new Map(), auswaerts = this.wbTabelleAusSpielen(state, d.liga, d.plan, { art: "away" });
        d.plan.forEach(r => (r.matches || []).forEach(m => {
            if (!m.played) return;
            if (m.awayGoals === 0) zuNull.set(m.homeClubId, (zuNull.get(m.homeClubId) || 0) + 1);
            if (m.homeGoals === 0) zuNull.set(m.awayClubId, (zuNull.get(m.awayClubId) || 0) + 1);
        }));
        const top = (liste, wert, aufsteigend = false) => liste.slice()
            .sort((a, b) => aufsteigend ? wert(a) - wert(b) : wert(b) - wert(a)).slice(0, anzahl);
        const teams = [
            { titel: "Meiste Tore", liste: top(vereine, r => r.goalsFor).map(r => ({ id: r.clubId, wert: r.goalsFor })) },
            { titel: "Wenigste Gegentore", liste: top(vereine.filter(r => r.played), r => r.goalsAgainst, true).map(r => ({ id: r.clubId, wert: r.goalsAgainst })) },
            { titel: "Meiste Spiele zu null", liste: top(vereine, r => zuNull.get(r.clubId) || 0).map(r => ({ id: r.clubId, wert: zuNull.get(r.clubId) || 0 })) },
            { titel: "Bestes Auswärtsteam", liste: top(auswaerts, r => r.points).map(r => ({ id: r.clubId, wert: `${r.points} Pkt` })) }
        ];
        const ids = new Set(vereine.map(r => r.clubId));
        const stat = typeof StatistikEngine !== "undefined" ? StatistikEngine : null;
        const spieler = (state.players || []).filter(p => ids.has(p.clubId))
            .map(p => ({ p, s: stat ? stat.von(p, "liga") : (p.stats || {}) }));
        const gespielt = Math.max(1, ...vereine.map(r => r.played || 0));
        const genugSpiele = Math.max(2, Math.round(gespielt * 0.4));
        const komma = (v) => v.toFixed(2).replace(".", ",");
        const spielerListe = (filter, wert, text) => top(spieler.filter(filter), wert).filter(e => wert(e) > 0)
            .map(e => ({ id: e.p.id, name: e.p.name, clubId: e.p.clubId, wert: text(e) }));
        const spielerStat = [
            { titel: "Bester Notenschnitt", liste: spielerListe(e => (e.s.matches || 0) >= genugSpiele, e => (e.s.ratingSum || 0) / (e.s.matches || 1), e => komma((e.s.ratingSum || 0) / (e.s.matches || 1))) },
            { titel: "Meiste Tore", liste: spielerListe(() => true, e => e.s.goals || 0, e => e.s.goals) },
            { titel: "Meiste Vorlagen", liste: spielerListe(() => true, e => e.s.assists || 0, e => e.s.assists) },
            { titel: "Meiste Spiele zu null", liste: spielerListe(e => e.p.pos === "TW", e => e.s.cleanSheets || 0, e => e.s.cleanSheets) }
        ];
        return { teams, spieler: spielerStat };
    },

    wbKachelStatistik(state, d) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const { teams, spieler } = this.wbStatistik(state, d, 1);
        const zeile = (k, inhalt) => `<div class="wb-stat-zeile"><span>${esc(k.titel)}</span>${inhalt}</div>`;
        const leer = '<em class="text-muted">–</em>';
        return `${this.wbKachelKopf("Statistik", "statistik")}
            <div class="wb-k-inhalt wb-stat">
                <div><h5>Vereine</h5>${teams.map(k => zeile(k, k.liste[0] ? `<b>${this.wbVerein(d.vereinNach.get(k.liste[0].id), { kurz: true })}<i>${esc(k.liste[0].wert)}</i></b>` : leer)).join("")}</div>
                <div><h5>Spieler</h5>${spieler.map(k => zeile(k, k.liste[0] ? `<b><span class="wb-spieler" data-wb-spieler="${esc(k.liste[0].id)}">${esc(k.liste[0].name)}</span><i>${esc(k.liste[0].wert)}</i></b>` : leer)).join("")}</div>
            </div>`;
    },

    wbWechsel(state, d) {
        const b = (state.ligaWechsel || {})[d.ligaId];
        const bilanz = b && b.saison === (state.seasonYear || 1) ? b : { zu: 0, ab: 0, ausland: 0, ausgaben: 0, einnahmen: 0, liste: [] };
        const trainer = typeof TrainerwechselEngine !== "undefined" && typeof TrainerwechselEngine.dieseSaison === "function"
            ? TrainerwechselEngine.dieseSaison(state, d.ligaId) : [];
        return { bilanz, trainer };
    },

    wbKachelWechsel(state, d) {
        const { bilanz, trainer } = this.wbWechsel(state, d);
        // Kurz, damit drei Werte nebeneinander passen: "272 Mio. €"
        const geld = (v) => v >= 1e6 ? `${Math.round(v / 1e6).toLocaleString("de-DE")} Mio. €` : v >= 1e3 ? `${Math.round(v / 1e3)} Tsd. €` : `${Math.round(v)} €`;
        const anteil = bilanz.zu ? Math.round(bilanz.ausland / bilanz.zu * 100) : 0;
        const wert = (zahl, text) => `<div class="wb-zahl-block"><strong>${zahl}</strong><small>${text}</small></div>`;
        // Oben drei Zahlen, darunter das Geld - drei Beträge passen nicht nebeneinander
        return `${this.wbKachelKopf("Zu- und Abgänge", "wechsel")}
            <div class="wb-k-inhalt">
                <div class="wb-zahlen">${wert(bilanz.zu, "Zugänge")}${wert(`${anteil} %`, "aus dem Ausland")}${wert(trainer.length, "Trainer&shy;wechsel")}</div>
                <div class="pf-zeile"><span>Ausgaben</span><strong>${geld(bilanz.ausgaben)}</strong></div>
                <div class="pf-zeile"><span>Einnahmen</span><strong>${geld(bilanz.einnahmen)}</strong></div>
                <div class="pf-zeile"><span>Abgänge</span><strong>${bilanz.ab}</strong></div>
            </div>
            <footer class="wb-k-fuss">Saison ${this.escapeHtml(this.saisonText(state, state.seasonYear || 1))}, seit Beginn der Karriere gezählt</footer>`;
    },

    wbKachelSieger(state, d) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const liste = d.meister.slice(0, 4);
        return `${this.wbKachelKopf("Frühere Sieger", "sieger")}
            <div class="wb-k-inhalt wb-sieger">${liste.length ? liste.map((e, i) => `<div class="wb-sieger-zeile${i === 0 ? " halter" : ""}">
                ${this.wbVerein(d.vereinNach.get(e.c) || { id: e.c, name: e.n }, { kurz: true })}<small>${esc(this.saisonText(state, e.s))}${i === 0 ? " · Titelverteidiger" : ""}</small></div>`).join("")
                : '<p class="text-muted">Die erste Saison im Spielstand. Hier stehen künftig die Meister jeder Saison.</p>'}</div>`;
    },

    // ------------------------------------------------------- Ansichten

    /** Klicks auf der Seite und in der Ansicht: Vereine, Spieler, Kacheln, Blättern */
    bindeWettbewerbSeite(host, state, d) {
        host.querySelectorAll("[data-wb-ansicht]").forEach(k => k.addEventListener("click", () => this.zeigeWettbewerbAnsicht(k.dataset.wbAnsicht, d.ligaId)));
        host.querySelectorAll("[data-wb-spieltag]").forEach(k => k.addEventListener("click", (e) => {
            e.stopPropagation();
            this._wbSpieltag = Math.min(Math.max(1, (this._wbSpieltag || 1) + Number(k.dataset.wbSpieltag)), d.plan.length || 1);
            const kachel = host.querySelector(".wb-k-spieltag");
            if (kachel) { kachel.innerHTML = this.wbKachelSpieltag(state, d); this.bindeWettbewerbSeite(kachel, state, d); }
        }));
        this.bindeWbVerweise(host);
    },

    /** Vereine und Spieler öffnen ihre Seiten - aus einer Ansicht heraus erst nach dem Schließen */
    bindeWbVerweise(host) {
        host.querySelectorAll("[data-wb-verein]").forEach(el => el.addEventListener("click", (e) => {
            e.stopPropagation();
            this.schliesseWettbewerbAnsicht();
            this.showClubDetailsModal(el.dataset.wbVerein);
        }));
        host.querySelectorAll("[data-wb-spieler]").forEach(el => el.addEventListener("click", (e) => {
            e.stopPropagation();
            this.schliesseWettbewerbAnsicht();
            const id = typeof this.resolvePlayerId === "function" ? this.resolvePlayerId(el.dataset.wbSpieler) : el.dataset.wbSpieler;
            if (id !== null && id !== undefined) this.showPlayerDetailsModal(id);
        }));
    },

    schliesseWettbewerbAnsicht() {
        const modal = typeof document !== "undefined" ? document.getElementById("modalWettbewerb") : null;
        if (modal) modal.style.display = "none";
    },

    /** Die ausführliche Ansicht einer Kachel im Fenster */
    zeigeWettbewerbAnsicht(ansicht, ligaId, optionen = {}) {
        const state = this.app.state;
        const modal = document.getElementById("modalWettbewerb");
        const inhalt = document.getElementById("wbAnsichtInhalt");
        const titel = document.getElementById("wbAnsichtTitel");
        if (!modal || !inhalt) return;
        const d = this.wbDaten(state, ligaId);
        const name = d.liga?.shortName || d.liga?.name || "";
        const ansichten = {
            tabelle: ["Tabelle", () => this.wbAnsichtTabelle(state, d, optionen.art || "gesamt")],
            spieltag: ["Spieltage", () => this.wbAnsichtSpieltag(state, d)],
            nachrichten: ["Schlagzeilen", () => this.wbAnsichtNachrichten(state, d)],
            rangliste: ["Fünfjahreswertung", () => this.wbAnsichtRangliste(state, d)],
            statistik: ["Statistik", () => this.wbAnsichtStatistik(state, d)],
            wechsel: ["Zu- und Abgänge", () => this.wbAnsichtWechsel(state, d)],
            sieger: ["Frühere Sieger", () => this.wbAnsichtSieger(state, d)]
        };
        const [t, html] = ansichten[ansicht] || ansichten.tabelle;
        if (titel) titel.innerHTML = `${this.flaggeVon(d.liga?.countryId)} ${this.escapeHtml(name)} <span>›</span> ${this.escapeHtml(t)}`;
        inhalt.innerHTML = html();
        inhalt.scrollTop = 0;
        modal.style.display = "flex";
        const zu = document.getElementById("btnWbAnsichtZu");
        if (zu) zu.onclick = () => this.schliesseWettbewerbAnsicht();
        inhalt.querySelectorAll("[data-wb-art]").forEach(k => k.addEventListener("click", () => this.zeigeWettbewerbAnsicht("tabelle", ligaId, { art: k.dataset.wbArt })));
        inhalt.querySelectorAll("[data-wb-runde]").forEach(k => k.addEventListener("click", () => {
            this._wbSpieltag = Number(k.dataset.wbRunde);
            this.zeigeWettbewerbAnsicht("spieltag", ligaId);
        }));
        this.bindeWbVerweise(inhalt);
    },

    wbAnsichtTabelle(state, d, art) {
        const zeilen = art === "gesamt" && d.tabelle.length ? d.tabelle : this.wbTabelleAusSpielen(state, d.liga, d.plan, { art });
        const zonen = this.tabellenZonen(state, d.ligaId, zeilen.length);
        const umschalter = [["gesamt", "Gesamt"], ["home", "Heim"], ["away", "Auswärts"]]
            .map(([k, l]) => `<button type="button" class="pd-tab-knopf${k === art ? " aktiv" : ""}" data-wb-art="${k}">${l}</button>`).join("");
        const kopf = `<tr><th>Pl.</th><th></th><th class="wb-links">Verein</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>Diff.</th><th>Pkt</th>${art === "gesamt" ? "<th>Form</th>" : ""}</tr>`;
        const zeilenHtml = zeilen.map((s, i) => {
            const platz = i + 1, zone = art === "gesamt" ? zonen.get(platz) : null;
            const vorher = art === "gesamt" ? d.vorher.get(s.clubId) : null;
            const trend = !vorher || vorher === platz ? '<i class="wb-trend gleich">–</i>' : vorher > platz ? '<i class="wb-trend hoch">▲</i>' : '<i class="wb-trend runter">▼</i>';
            const form = art === "gesamt" ? `<td class="wb-form">${((d.vereinNach.get(s.clubId)?.form) || s.form || []).slice(-5).map(f => this.formPunkt(f)).join("")}</td>` : "";
            return `<tr class="${s.clubId === state.userClubId ? "row-user-club" : ""}">
                <td class="wb-pos"><span class="wb-zone${zone ? ` zone-${zone}` : ""}"></span>${platz}</td><td class="wb-tr">${trend}</td>
                <td class="wb-team">${this.wbVerein(d.vereinNach.get(s.clubId))}</td>
                <td>${s.played}</td><td>${s.won}</td><td>${s.drawn}</td><td>${s.lost}</td><td class="nowrap">${s.goalsFor}:${s.goalsAgainst}</td>
                <td>${this.vorzeichen(s.goalsFor - s.goalsAgainst)}</td><td class="wb-pkt">${s.points}</td>${form}</tr>`;
        }).join("");
        return `<nav class="pd-tabs wb-umschalter">${umschalter}</nav>
            <div class="table-container"><table class="wb-tab wb-tab-voll"><thead>${kopf}</thead><tbody>${zeilenHtml}</tbody></table></div>
            ${art === "gesamt" ? `<div class="wb-legende">${this.wbLegende(state, d, zeilen.length)}</div>` : '<p class="pf-klein">Aus den Ergebnissen gerechnet, ohne Punktabzüge.</p>'}`;
    },

    wbAnsichtSpieltag(state, d) {
        const nr = Math.min(Math.max(1, this._wbSpieltag || d.letzter), d.plan.length || 1);
        const runde = d.plan.find(r => r.matchday === nr);
        const leiste = d.plan.map(r => {
            const fertig = r.matches.every(m => m.played);
            return `<button type="button" class="wb-runde${r.matchday === nr ? " aktiv" : ""}${fertig ? " fertig" : ""}" data-wb-runde="${r.matchday}">${r.matchday}</button>`;
        }).join("");
        const spiele = (runde?.matches || []).map(m => `${this.wbSpielZeile(state, m, { kurz: false })}${m.played && m.attendance ? `<small class="wb-zuschauer">${m.attendance.toLocaleString("de-DE")} Zuschauer${m.soldOut ? " · ausverkauft" : ""}</small>` : ""}`).join("");
        return `<div class="wb-runden" role="tablist" aria-label="Spieltage">${leiste}</div>
            <h4 class="gs-titel">${nr}. Spieltag</h4>
            <div class="wb-spiele wb-spiele-voll">${spiele || '<p class="text-muted">Keine Partien.</p>'}</div>`;
    },

    wbAnsichtNachrichten(state, d) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const zeilen = this.wbSchlagzeilen(state, d);
        const eigene = d.ligaId === this.getUserLeagueId(state)
            ? (state.inbox || []).filter(m => m.sender === "Sportpresse").slice(0, 8) : [];
        return `<div class="wb-news wb-news-voll">${zeilen.map(z => `<div class="wb-news-zeile wb-news-${z.art}"><strong>${esc(z.titel)}</strong><small>${esc(z.text)}</small></div>`).join("") || '<p class="text-muted">Noch keine Schlagzeilen.</p>'}</div>
            ${eigene.length ? `<h4 class="gs-titel pf-unter">Aus der Sportpresse</h4><div class="wb-news wb-news-voll">${eigene.map(m => `<div class="wb-news-zeile"><strong>${esc(this.meldungOhneZeichen ? this.meldungOhneZeichen(m.subject) : m.subject)}</strong><small>${esc(m.date || "")}</small></div>`).join("")}</div>` : ""}`;
    },

    wbAnsichtRangliste(state, d) {
        const liste = this.wbRangliste(state);
        const saisons = liste[0]?.werte?.length || 0;
        const komma = (v) => Number(v).toFixed(1).replace(".", ",");
        return `<div class="table-container"><table class="wb-tab wb-tab-voll">
            <thead><tr><th>Rang</th><th class="wb-links">Land</th>${Array.from({ length: saisons }, (_, i) => `<th>${i === saisons - 1 ? "Laufend" : this.saisonText(state, (state.seasonYear || 1) - (saisons - 1 - i))}</th>`).join("")}<th>Summe</th></tr></thead>
            <tbody>${liste.map(z => `<tr class="${z.land === d.liga.countryId ? "row-user-club" : ""}"><td>${z.rang}</td><td class="wb-links">${this.flaggeVon(z.land)} ${this.escapeHtml(z.name)}</td>${z.werte.map(w => `<td>${komma(w)}</td>`).join("")}<td class="wb-pkt">${komma(z.summe)}</td></tr>`).join("")}</tbody>
        </table></div>
        <p class="pf-klein">Die Punkte der Vereine eines Landes im Europapokal, je Saison durch die Zahl der Teilnehmer geteilt. Der Rang entscheidet über die Startplätze.</p>`;
    },

    wbAnsichtStatistik(state, d) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const { teams, spieler } = this.wbStatistik(state, d, 5);
        const block = (k, istSpieler) => `<div class="wb-stat-block"><h5>${esc(k.titel)}</h5>${k.liste.length ? k.liste.map((e, i) => `<div class="wb-stat-rang"><b>${i + 1}</b>${istSpieler
            ? `<span class="wb-stat-name"><span class="wb-spieler" data-wb-spieler="${esc(e.id)}">${esc(e.name)}</span><small>${esc(d.vereinNach.get(e.clubId)?.name || "")}</small></span>`
            : this.wbVerein(d.vereinNach.get(e.id))}<i>${esc(e.wert)}</i></div>`).join("") : '<p class="text-muted">Noch keine Werte.</p>'}</div>`;
        return `<div class="wb-stat-voll">
            <section><h4 class="gs-titel">Vereine</h4><div class="wb-stat-gitter">${teams.map(k => block(k, false)).join("")}</div></section>
            <section><h4 class="gs-titel">Spieler</h4><div class="wb-stat-gitter">${spieler.map(k => block(k, true)).join("")}</div></section>
        </div>`;
    },

    wbAnsichtWechsel(state, d) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const { bilanz, trainer } = this.wbWechsel(state, d);
        const geld = (v) => this.constructor.formatMoneySafe ? this.constructor.formatMoneySafe(v) : String(v);
        const wechsel = bilanz.liste.slice().reverse();
        return `<h4 class="gs-titel">Letzte Zugänge</h4>
            ${wechsel.length ? `<div class="table-container"><table class="wb-tab wb-tab-voll"><thead><tr><th class="wb-links">Spieler</th><th class="wb-links">von</th><th class="wb-links">zu</th><th>Ablöse</th><th>Datum</th></tr></thead>
            <tbody>${wechsel.map(w => `<tr><td class="wb-links"><span class="wb-spieler" data-wb-spieler="${esc(w.p)}">${esc(w.s)}</span></td><td class="wb-links">${esc(w.v)}</td><td class="wb-links">${this.wbVerein(d.vereinNach.get(w.z), { kurz: true })}</td><td>${w.f ? geld(w.f) : "ablösefrei"}</td><td>${esc(w.d)}</td></tr>`).join("")}</tbody></table></div>`
                : '<p class="text-muted">In dieser Saison noch keine Wechsel in die Liga.</p>'}
            <h4 class="gs-titel pf-unter">Trainerwechsel</h4>
            ${trainer.length ? trainer.map(w => `<div class="pf-zeile"><span>${esc(w.verein)}</span><strong>${esc(w.alt)} → ${esc(w.neu)}</strong></div>`).join("") : '<p class="text-muted">Bisher keine.</p>'}`;
    },

    wbAnsichtSieger(state, d) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const titel = new Map();
        d.meister.forEach(e => titel.set(e.c, (titel.get(e.c) || 0) + 1));
        const meiste = [...titel.entries()].sort((a, b) => b[1] - a[1])[0];
        return d.meister.length ? `
            ${meiste && meiste[1] > 1 ? `<p class="pf-text">Meiste Titel im Spielstand: <strong>${esc(d.vereinNach.get(meiste[0])?.name || "")}</strong> (${meiste[1]})</p>` : ""}
            <div class="table-container"><table class="wb-tab wb-tab-voll"><thead><tr><th>Saison</th><th class="wb-links">Meister</th><th>Punkte</th><th class="wb-links">Zweiter</th></tr></thead>
            <tbody>${d.meister.map(e => `<tr class="${e.c === state.userClubId ? "row-user-club" : ""}"><td>${esc(this.saisonText(state, e.s))}</td><td class="wb-links">${this.wbVerein(d.vereinNach.get(e.c) || { id: e.c, name: e.n })}</td><td>${e.p}</td><td class="wb-links">${e.z ? this.wbVerein(d.vereinNach.get(e.z) || { id: e.z, name: e.zn }, { kurz: true }) : ""}</td></tr>`).join("")}</tbody></table></div>`
            : '<p class="text-muted">Die erste Saison im Spielstand. Am Saisonende steht hier der erste Meister.</p>';
    }
});
