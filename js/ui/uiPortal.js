/**
 * Übersicht wie im Vorbild: vier Spalten statt einzelner Kacheln.
 *
 * Links die Post mit den Aufgaben vom Schreibtisch, daneben Nachrichten und
 * die eigenen Spiele, dann die Tabelle mit den besten Spielern der Liga und
 * rechts das nächste Spiel mit dem Bericht über den Gegner, das
 * Datencenter, beide Budgets, die Trainingswoche und der Vorstand.
 *
 * Wie viele Spalten es gibt, entscheidet der Platz des Bereichs (Container
 * Queries in css/design.css): vier, zwei oder eine. In einer Spalte steht
 * das nächste Spiel oben.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype
 * (wie uiFarben.js). renderDashboard ruft renderPortal auf.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    PORTAL_FILTER: { alle: "Alle", neu: "Neu", aufgaben: "Aufgaben", ungelesen: "Ungelesen" },
    /** So viele Nachrichten zeigt die Post höchstens - der Rest steht im Postfach */
    PORTAL_POST_MAX: 30,
    PORTAL_WOCHENTAGE: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    PORTAL_MONATE: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],

    renderPortal(state, userClub) {
        if (!state || !userClub || typeof document === "undefined" || !document.getElementById("dashPortal")) return;
        this.portalPost(state);
        this.portalNachrichten(state);
        this.portalSpielplan(state, userClub);
        this.portalTabelle(state);
        this.portalSpielerStat(state);
        this.portalGegner(state, userClub);
        this.portalDatencenter(state, userClub);
        this.portalBudgets(state, userClub);
        this.portalWoche(state);
        this.bindePortal();
    },

    /** Titel als Verweis: ein Tipp öffnet den Bereich */
    bindePortal() {
        document.querySelectorAll("#dashPortal [data-portal-ziel]").forEach(b => {
            b.onclick = () => this.switchTab(b.dataset.portalZiel);
        });
    },

    /** "01.08.2026" als Date - oder null */
    portalDatum(text) {
        const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(text || "").trim());
        return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
    },

    /** "Sa, 1. Aug" - wie die Tageszeile im Vorbild */
    portalTagText(text) {
        const d = this.portalDatum(text);
        return d ? `${this.PORTAL_WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${this.PORTAL_MONATE[d.getMonth()]}` : String(text || "");
    },

    /** Wie alt eine Nachricht ist: "heute", "gestern", "vor 3 Tagen" */
    portalAlter(state, text) {
        const heute = this.portalDatum(state.currentDate), d = this.portalDatum(text);
        if (!heute || !d) return String(text || "");
        const tage = Math.round((heute - d) / 86400000);
        return tage <= 0 ? "heute" : tage === 1 ? "gestern" : `vor ${tage} Tagen`;
    },

    // ------------------------------------------------------------ Posteingang

    /**
     * Die Post wie im Vorbild: Alle, Neu (heute eingegangen), Aufgaben (der
     * Schreibtisch), Ungelesen - nach Tagen gruppiert, je Nachricht Absender,
     * Betreff und das Etikett der Abteilung. In "Alle" stehen die Aufgaben
     * über der Post, damit nichts Dringendes untergeht.
     */
    portalPost(state) {
        const host = document.getElementById("dashPostListe");
        const leiste = document.getElementById("dashPostFilter");
        if (!host || !leiste) return;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const ne = this._newsEngine ? this._newsEngine() : null;
        const inbox = Array.isArray(state.inbox) ? state.inbox : [];
        const aufgaben = Number(document.getElementById("dashAttentionCount")?.textContent || 0);
        const ungelesen = inbox.filter(m => !m.read).length;
        const neu = inbox.filter(m => m.date && m.date === state.currentDate);
        const filter = this.PORTAL_FILTER[this._portalFilter] ? this._portalFilter : "alle";
        const zahl = { aufgaben, ungelesen };

        leiste.innerHTML = Object.entries(this.PORTAL_FILTER).map(([k, t]) => `<button type="button" class="pp-filter${k === filter ? " aktiv" : ""}" role="tab" aria-selected="${k === filter}" data-pp-filter="${k}">${t}${zahl[k] !== undefined ? ` (${zahl[k]})` : ""}</button>`).join("");
        leiste.querySelectorAll("[data-pp-filter]").forEach(b => {
            b.onclick = () => { this._portalFilter = b.dataset.ppFilter; this.portalPost(state); };
        });

        const wrap = document.getElementById("dashAttentionWrap");
        if (wrap) wrap.hidden = !(filter === "aufgaben" || (filter === "alle" && aufgaben > 0));
        if (filter === "aufgaben") {
            host.innerHTML = "";
            return;
        }

        const liste = (filter === "ungelesen" ? inbox.filter(m => !m.read) : filter === "neu" ? neu : inbox).slice(0, this.PORTAL_POST_MAX);
        if (!liste.length) {
            host.innerHTML = `<div class="pp-leer">${filter === "neu" ? "Heute ist noch keine Post gekommen." : filter === "ungelesen" ? "Alles gelesen." : "Noch keine Post."}</div>`;
            return;
        }
        const gruppen = [];
        liste.forEach(m => {
            const tag = m.date || "Saisonstart";
            const letzte = gruppen[gruppen.length - 1];
            if (letzte && letzte.tag === tag) letzte.post.push(m);
            else gruppen.push({ tag, post: [m] });
        });
        host.innerHTML = gruppen.map(g => `<div class="pp-tag">${esc(this.portalTagText(g.tag))}</div>${g.post.map(m => {
            const kat = ne ? ne.kategorie(m) : { key: "verein", name: "Verein" };
            const dringend = ne && typeof ne.dringlichkeit === "function" ? ne.dringlichkeit(state, m) : null;
            return `<button type="button" class="pp-eintrag post-kat-${esc(kat.key)}${m.read ? "" : " ungelesen"}" data-msg-id="${esc(m.id)}">
                <span class="pp-kopf">
                    <span class="pp-absender">${esc(m.sender || "Verein")}</span>
                    ${dringend && dringend.stufe === "dringend" ? '<b class="pp-wichtig" title="Dringend">!</b>' : ""}
                    <span class="pp-etikett">${esc(kat.name)}</span>
                </span>
                <span class="pp-betreff">${esc(this.ohneSymbol(m.subject || m.title || "Nachricht"))}</span>
            </button>`;
        }).join("")}`).join("");
        host.querySelectorAll(".pp-eintrag").forEach(el => {
            el.onclick = () => this.portalNachrichtOeffnen(state, el.dataset.msgId);
        });
    },

    portalNachrichtOeffnen(state, id) {
        const msg = (state.inbox || []).find(m => String(m.id) === String(id));
        if (msg) {
            msg.read = true;
            this.selectedInboxMessageId = String(msg.id);
            this.inboxOffen = String(msg.id);
        }
        this.switchTab("inbox");
        this.renderHeader();
    },

    // ------------------------------------------------------------ Nachrichten

    /**
     * Was die Presse schreibt: die neueste Meldung groß mit dem Wappen des
     * Vereins, um den es geht, darunter zwei weitere. Ohne Presse die
     * Schlagzeilen der Liga (Spitze, Serien, Ergebnisse).
     */
    portalNachrichten(state) {
        const host = document.getElementById("dashNachrichten");
        if (!host) return;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const ne = this._newsEngine ? this._newsEngine() : null;
        const presse = (state.inbox || []).filter(m => ne && ne.kategorie(m).key === "presse").slice(0, 3);
        const vereine = (state.clubs || []).filter(c => c.leagueId === this.getUserLeagueId(state));
        const vereinIn = (text) => vereine.slice().sort((a, b) => b.name.length - a.name.length).find(c => String(text || "").includes(c.name))
            || (state.clubs || []).find(c => c.id === state.userClubId);
        // Ohne Symbol vorn - wie im Vorbild steht nur die Schlagzeile da
        let eintraege = presse.map(m => ({ id: m.id, titel: this.ohneSymbol(m.subject || m.title || "Meldung"), text: ne?.vorschau ? ne.vorschau(m) : String(m.body || "").slice(0, 140),
            alter: this.portalAlter(state, m.date), quelle: m.sender || "Presse", verein: vereinIn(`${m.subject || ""} ${m.body || ""}`) }));
        if (!eintraege.length && typeof this.wbSchlagzeilen === "function") {
            const d = this.wbDaten(state, this.getUserLeagueId(state));
            eintraege = d.liga ? this.wbSchlagzeilen(state, d).slice(0, 3).map(z => ({ titel: z.titel, text: z.text, alter: "", quelle: "Liga", verein: vereinIn(z.titel) })) : [];
        }
        if (!eintraege.length) {
            host.innerHTML = '<p class="pp-leer">Noch keine Meldungen. Zum Saisonstart schreibt die Sportpresse ihre Vorschau.</p>';
            return;
        }
        const [aufmacher, ...rest] = eintraege;
        const farben = aufmacher.verein && typeof this.wappenFarben === "function" ? this.wappenFarben(aufmacher.verein) : null;
        const meta = (e) => `<span class="pn-meta">${e.alter ? `<span><svg class="ico" aria-hidden="true"><use href="#i-clock"/></svg>${esc(e.alter)}</span>` : ""}<span>${esc(e.quelle)}</span>${e.verein ? `<span>${esc(this.kurzName ? this.kurzName(e.verein.name) : e.verein.name)}</span>` : ""}</span>`;
        host.innerHTML = `
            <button type="button" class="pn-aufmacher"${aufmacher.id !== undefined ? ` data-msg-id="${esc(aufmacher.id)}"` : ""}>
                <span class="pn-bild" style="${farben ? `--pn-farbe:${farben.farbe};--pn-zweit:${farben.zweit};` : ""}">
                    ${aufmacher.verein ? this.wappenHtml(aufmacher.verein, "pn-wappen") : ""}
                </span>
                <span class="pn-text">
                    <strong>${esc(aufmacher.titel)}</strong>
                    <span class="pn-auszug">${esc(aufmacher.text)}</span>
                    ${meta(aufmacher)}
                </span>
            </button>
            ${rest.map(e => `<button type="button" class="pn-zeile"${e.id !== undefined ? ` data-msg-id="${esc(e.id)}"` : ""}>
                ${e.verein ? this.wappenHtml(e.verein, "pn-mini") : ""}
                <span class="pn-text"><strong>${esc(e.titel)}</strong>${meta(e)}</span>
            </button>`).join("")}`;
        host.querySelectorAll("[data-msg-id]").forEach(el => {
            el.onclick = () => this.portalNachrichtOeffnen(state, el.dataset.msgId);
        });
    },

    // ------------------------------------------------------------ Spielplan

    /**
     * Die eigenen Spiele aus dem Kalender: Liga, Pokal, Europapokal und
     * Testspiele, in der Reihenfolge der Termine.
     */
    portalSpiele(state) {
        const cal = this.getCalendarEngine();
        const cup = typeof CupEngine !== "undefined" ? CupEngine : null;
        const pre = state.preseason || null;
        const verein = (id) => (state.clubs || []).find(c => c.id === id) || null;
        const liste = [];
        (state.calendar || []).forEach((tag, i) => {
            if (tag.type === "matchday" && cal && typeof cal.naechstesSpiel === "function") {
                const s = cal.naechstesSpiel(state, tag.matchday || null);
                if (!s) return;
                const p = s.partie;
                liste.push({ i, tag, kurz: "Liga", heim: s.heim, gegner: s.gegner, gespielt: !!p.played,
                    tore: p.played ? (s.heim ? [p.homeGoals, p.awayGoals] : [p.awayGoals, p.homeGoals]) : null });
            } else if ((tag.type === "cup" || tag.type === "euro") && cup && typeof cup.eigenePartieAm === "function") {
                const e = cup.eigenePartieAm(state, tag.cupArt || (tag.type === "cup" ? "cup" : "euro"), tag.cupRunde || 0);
                if (!e) return;
                const p = e.partie, heim = p.homeClubId === state.userClubId;
                const name = e.wettbewerb?.name || (tag.type === "cup" ? "Pokal" : "Europapokal");
                // Der Landespokal heißt kurz Pokal, der Europapokal behält seinen Namen
                liste.push({ i, tag, kurz: tag.type === "cup" ? "Pokal" : (e.wettbewerb?.shortName || name), lang: name,
                    heim, gegner: verein(heim ? p.awayClubId : p.homeClubId), gespielt: !!p.played,
                    tore: p.played ? (heim ? [p.homeGoals, p.awayGoals] : [p.awayGoals, p.homeGoals]) : null });
            } else if (tag.type === "friendly" && pre && Array.isArray(pre.plan)) {
                const eintrag = pre.plan[tag.friendlyIndex ?? 0];
                const t = eintrag && eintrag.testId ? (pre.testspiele || []).find(x => x.id === eintrag.testId) : null;
                if (!t) return;
                const tore = t.gespielt && /^\d+:\d+/.test(t.ergebnis || "") ? t.ergebnis.split(":").map(x => parseInt(x, 10)) : null;
                liste.push({ i, tag, kurz: "Test", heim: t.heim, gegner: verein(t.gegnerId), gegnerName: t.gegnerName, gespielt: !!t.gespielt, tore });
            }
        });
        return liste;
    },

    /** Die letzten sechs Ergebnisse und die nächsten vier Spiele */
    portalSpielplan(state) {
        const host = document.getElementById("dashSpielplan");
        if (!host) return;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const alle = this.portalSpiele(state);
        const heute = state.currentDayIndex || 0;
        const vorbei = alle.filter(s => s.gespielt || s.i < heute).slice(-6);
        const kommt = alle.filter(s => !s.gespielt && s.i >= heute).slice(0, 4);
        const zeilen = [...vorbei, ...kommt];
        if (!zeilen.length) {
            host.innerHTML = '<p class="pp-leer">Noch keine Spiele angesetzt.</p>';
            return;
        }
        host.innerHTML = `<table class="ps-tab">
            <thead><tr><th>Datum</th><th>Gegner</th><th>Ort</th><th>Ergebnis</th><th>Wettbewerb</th></tr></thead>
            <tbody>${zeilen.map(s => {
                const erg = s.tore ? (s.tore[0] > s.tore[1] ? "s" : s.tore[0] === s.tore[1] ? "u" : "n") : null;
                const name = s.gegner ? s.gegner.name : (s.gegnerName || "Gegner");
                return `<tr class="${s.gespielt ? "" : "ps-offen"}${s.i === heute ? " ps-heute" : ""}">
                    <td class="ps-datum">${esc(String(s.tag.date || "").slice(0, 5))}</td>
                    <td class="ps-gegner">${s.gegner ? this.wbVerein(s.gegner, { kurz: true }) : esc(name)}</td>
                    <td class="ps-ort">${s.heim ? "H" : "A"}</td>
                    <td class="ps-erg">${erg ? `<i class="ps-punkt ps-${erg}" aria-label="${{ s: "Sieg", u: "Unentschieden", n: "Niederlage" }[erg]}"></i>${s.tore[0]} - ${s.tore[1]}` : '<span class="text-muted">–</span>'}</td>
                    <td class="ps-wb" title="${esc(s.lang || s.kurz)}">${esc(s.kurz)}</td>
                </tr>`;
            }).join("")}</tbody></table>`;
        if (typeof this.bindeWbVerweise === "function") this.bindeWbVerweise(host);
    },

    // ------------------------------------------------------------ Tabelle

    /** Die Tabelle der gewählten Liga mit Trend, Bilanz und Form - wie im Vorbild ganz */
    portalTabelle(state) {
        const body = document.getElementById("dashStandingsBody");
        const wahl = document.getElementById("dashTabelleWahl");
        if (!body || typeof this.wbDaten !== "function") return;
        const eigene = this.getUserLeagueId(state);
        const eigeneLiga = (state.leagues || []).find(l => l.id === eigene);
        // Zur Wahl: die Ligen des eigenen Landes, die eigene zuerst
        const ligen = (state.leagues || []).filter(l => eigeneLiga && l.countryId === eigeneLiga.countryId)
            .sort((a, b) => (a.id === eigene ? -1 : b.id === eigene ? 1 : (a.level || 1) - (b.level || 1)));
        const ligaId = ligen.some(l => l.id === this._portalLiga) ? this._portalLiga : eigene;
        if (wahl) {
            wahl.innerHTML = ligen.map(l => `<option value="${this.escapeHtml(l.id)}"${l.id === ligaId ? " selected" : ""}>${this.escapeHtml(l.shortName || l.name)}</option>`).join("");
            wahl.hidden = ligen.length < 2;
            wahl.onchange = () => { this._portalLiga = wahl.value; this.portalTabelle(state); this.portalSpielerStat(state); };
        }
        const d = this.wbDaten(state, ligaId);
        if (!d.liga) { body.innerHTML = ""; return; }
        const zeilen = d.tabelle.length ? d.tabelle : this.wbTabelleAusSpielen(state, d.liga, d.plan);
        body.innerHTML = this.portalTabellenZeilen(state, d, zeilen);
        const legende = document.getElementById("dashTabelleLegende");
        if (legende) legende.innerHTML = this.wbLegende(state, d, zeilen.length);
        if (typeof this.bindeWbVerweise === "function") this.bindeWbVerweise(body);
    },

    /** Zeilen einer Ligatabelle mit Trend, Bilanz und Form - auch für die Wettbewerbe-Übersicht */
    portalTabellenZeilen(state, d, zeilen) {
        const zonen = this.tabellenZonen(state, d.ligaId, zeilen.length);
        const formZeichen = { W: "s", D: "u", L: "n" };
        return zeilen.map((s, i) => {
            const platz = i + 1;
            const zone = zonen.get(platz);
            const vorher = d.vorher.get(s.clubId);
            const trend = !vorher || vorher === platz ? '<i class="wb-trend gleich" title="unverändert">–</i>'
                : vorher > platz ? `<i class="wb-trend hoch" title="von Platz ${vorher}">▲</i>` : `<i class="wb-trend runter" title="von Platz ${vorher}">▼</i>`;
            const form = (d.vereinNach.get(s.clubId)?.form || []).filter(f => f && f !== "-").slice(-5);
            return `<tr class="${s.clubId === state.userClubId ? "row-user-club" : ""}" data-club-id="${this.escapeHtml(s.clubId)}">
                <td class="wb-pos"><span class="wb-zone${zone ? ` zone-${zone}` : ""}"></span>${platz}</td>
                <td class="wb-tr">${trend}</td>
                <td class="wb-team">${this.wbVerein(d.vereinNach.get(s.clubId), { kurz: true })}</td>
                <td>${s.played || 0}</td>
                <td class="pt-suN">${s.won || 0}</td><td class="pt-suN">${s.drawn || 0}</td><td class="pt-suN">${s.lost || 0}</td>
                <td class="pt-diff">${this.vorzeichen ? this.vorzeichen(s.goalDiff || 0) : (s.goalDiff || 0)}</td>
                <td class="wb-pkt"><strong>${s.points || 0}</strong></td>
                <td class="pt-form">${form.map(f => `<i class="pt-f pt-f-${formZeichen[f] || "u"}"></i>`).join("")}</td>
            </tr>`;
        }).join("");
    },

    // ------------------------------------------------------------ Spielerstatistik

    /** Die Besten der Liga: Notenschnitt, Tore, Vorlagen, Spiele zu null */
    portalSpielerStat(state) {
        const host = document.getElementById("dashSpielerStat");
        if (!host || typeof this.wbStatistik !== "function") return;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const ligaId = (state.leagues || []).some(l => l.id === this._portalLiga) ? this._portalLiga : this.getUserLeagueId(state);
        const d = this.wbDaten(state, ligaId);
        if (!d.liga) { host.innerHTML = ""; return; }
        const stat = this.wbStatistik(state, d, 1).spieler.filter(s => s.liste.length);
        if (!stat.length) {
            host.innerHTML = '<p class="pp-leer">Nach dem ersten Spieltag stehen hier die Besten der Liga.</p>';
            return;
        }
        host.innerHTML = stat.map(s => {
            const e = s.liste[0];
            const club = (state.clubs || []).find(c => c.id === e.clubId);
            return `<button type="button" class="pst-zeile" data-player="${esc(e.id)}">
                <span class="pst-titel">${esc(s.titel)}</span>
                <span class="pst-name">${club ? this.wappenHtml(club, "crest-sm pst-wappen") : ""}${esc(e.name)}</span>
                <b class="pst-wert${s.titel.includes("Note") ? " pst-note" : ""}">${esc(e.wert)}</b>
            </button>`;
        }).join("");
        host.querySelectorAll("[data-player]").forEach(b => {
            b.onclick = () => this.showPlayerDetailsModal(b.dataset.player);
        });
    },

    // ------------------------------------------------------------ Gegner

    /** Bericht über den nächsten Gegner: Platz, Form, Formation */
    portalGegner(state) {
        const host = document.getElementById("dashGegnerBericht");
        if (!host) return;
        const cal = this.getCalendarEngine();
        const termin = cal && typeof cal.naechsterTermin === "function" ? cal.naechsterTermin(state) : null;
        const g = termin && termin.gegner;
        if (!g) { host.innerHTML = ""; return; }
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const form = (g.form || []).filter(f => f && f !== "-").slice(-5);
        const formZeichen = { W: "s", D: "u", L: "n" };
        const liga = (state.leagues || []).find(l => l.id === g.leagueId);
        const tab = g.leagueId === this.getUserLeagueId(state) ? (state.standings || []) : ((state.standingsByLeague || {})[g.leagueId] || []);
        const platz = tab.findIndex(s => s.clubId === g.id) + 1;
        host.innerHTML = `
            <div class="pg-kopf">${this.wappenHtml(g, "pg-wappen")}<span><strong>${esc(g.name)} (${termin.heim ? "H" : "A"})</strong><small>${platz ? `${platz}. in der ${esc(liga?.shortName || liga?.name || "Liga")}` : esc(termin.wettbewerb || "")}</small></span></div>
            <div class="pg-zeilen">
                <div><span>Form</span><span class="pg-form">${form.length ? form.map(f => `<i class="pt-f pt-f-${formZeichen[f] || "u"}"></i>`).join("") : '<span class="text-muted">–</span>'}</span></div>
                <div><span>Formation</span><strong>${esc(g.formation || "–")}</strong></div>
            </div>`;
    },

    // ------------------------------------------------------------ Datencenter

    /**
     * Wo die eigene Elf statistisch steht: sechs Kennzahlen gegen die Liga
     * (je Spiel), als Netz. Jede Achse ist der Rang in der Liga - außen der
     * Beste, innen der Schlechteste, der gestrichelte Ring der Schnitt.
     */
    portalDatencenter(state, userClub) {
        const host = document.getElementById("dashDatencenter");
        if (!host) return;
        const dz = typeof DatenzentraleEngine !== "undefined" ? DatenzentraleEngine : null;
        const zeilen = dz && typeof dz.liga === "function" ? dz.liga(state).filter(z => z.spiele > 0) : [];
        const eigen = zeilen.find(z => z.clubId === userClub.id);
        if (!eigen || zeilen.length < 3) {
            host.innerHTML = '<p class="pp-leer">Nach dem ersten Spieltag steht hier, wo die Mannschaft statistisch steht.</p>';
            return;
        }
        const je = (z, k) => z[k] / Math.max(1, z.spiele);
        const achsen = [
            ["Tore", z => je(z, "tore"), 1], ["xG", z => je(z, "xg"), 1], ["Schüsse", z => z.schuesseJeSpiel, 1],
            ["Ballbesitz", z => z.ballbesitz, 1], ["Gegentore", z => je(z, "gegentore"), -1], ["xG gegen", z => je(z, "xga"), -1]
        ];
        // Rang je Achse als Anteil: 1 = Bester der Liga, 0 = Schlechtester
        const werte = achsen.map(([, f, r]) => {
            const v = f(eigen);
            const besser = zeilen.filter(z => (f(z) - v) * r > 1e-9).length;
            return 1 - besser / (zeilen.length - 1);
        });
        const schnitt = werte.reduce((a, b) => a + b, 0) / werte.length;
        const urteil = schnitt >= 0.66 ? ["ok", "Überdurchschnittliche Leistung", "Statistisch gehören wir zu den Besten der Liga."]
            : schnitt <= 0.34 ? ["bad", "Unterdurchschnittliche Leistung", "Statistisch liegen wir unter dem Schnitt der Liga."]
                : ["mittel", "Durchschnittliche Leistung", "Statistisch zeigen wir durchschnittliche Leistungen."];
        const R = 46, mx = 60, my = 56;
        const punkt = (i, f) => {
            const w = -Math.PI / 2 + i * 2 * Math.PI / achsen.length;
            return [mx + Math.cos(w) * R * f, my + Math.sin(w) * R * f];
        };
        const ring = (f) => achsen.map((_, i) => punkt(i, f).map(x => x.toFixed(1)).join(",")).join(" ");
        const flaeche = werte.map((v, i) => punkt(i, 0.15 + v * 0.85).map(x => x.toFixed(1)).join(",")).join(" ");
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        host.innerHTML = `
            <div class="pd-reihe">
                <svg class="pd-netz" viewBox="0 0 120 112" role="img" aria-label="Kennzahlen gegen die Liga">
                    <polygon points="${ring(1)}" class="pd-ring"/>
                    <polygon points="${ring(0.575)}" class="pd-schnitt"/>
                    ${achsen.map((_, i) => { const [x, y] = punkt(i, 1); return `<line x1="${mx}" y1="${my}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="pd-achse"/>`; }).join("")}
                    <polygon points="${flaeche}" class="pd-wert"/>
                </svg>
                <div class="pd-text">
                    <span class="pd-urteil pd-${urteil[0]}">${esc(urteil[1])}</span>
                    <p>${esc(urteil[2])}</p>
                </div>
            </div>
            <div class="pd-achsen">${achsen.map(([t], i) => `<span title="${esc(t)}"><i style="width:${Math.round(werte[i] * 100)}%"></i>${esc(t)}</span>`).join("")}</div>`;
    },

    // ------------------------------------------------------------ Budgets

    /** Transferbudget mit dem, was diese Saison schon ausgegeben ist; Gehaltsbudget mit den Kosten */
    portalBudgets(state, userClub) {
        const geld = (v) => typeof this.geldKurz === "function" ? this.geldKurz(v) : GameState.formatMoney(v);
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const transfer = document.getElementById("dashTransferBudget");
        if (transfer) {
            const saison = state.seasonYear || 1;
            const ausgegeben = ((state.finances && state.finances.transactions) || [])
                .filter(t => t.clubId === userClub.id && t.type === "transfer_out" && (t.season || saison) === saison)
                .reduce((s, t) => s + Math.abs(t.amount || 0), 0);
            const frei = Math.max(0, userClub.transferBudget || 0);
            const anteil = frei + ausgegeben > 0 ? ausgegeben / (frei + ausgegeben) : 0;
            transfer.innerHTML = `
                <div class="pb-zeile"><span>Verfügbares Budget</span><strong class="pb-gross">${esc(geld(frei))}</strong></div>
                <div class="pb-zeile"><span>Diese Saison ausgegeben</span><strong>${esc(geld(ausgegeben))}</strong></div>
                <div class="pb-balken" title="${Math.round(anteil * 100)} % ausgegeben"><i style="width:${Math.round(anteil * 100)}%"></i></div>`;
        }
        const gehalt = document.getElementById("dashGehaltBudget");
        if (gehalt) {
            const kader = (state.players || []).filter(p => (userClub.playerIds || []).includes(p.id));
            const kosten = kader.reduce((s, p) => s + (p.wage || 0), 0);
            const budget = userClub.wageBudget || 0;
            const anteil = budget > 0 ? Math.min(1, kosten / budget) : 0;
            gehalt.innerHTML = `
                <div class="pb-zeile"><span>Verfügbares Budget</span><strong class="pb-gross${budget - kosten < 0 ? " pb-minus" : ""}">${esc(geld(budget - kosten))}/W.</strong></div>
                <div class="pb-zeile"><span>Gehaltskosten</span><strong>${esc(geld(kosten))}/W.</strong></div>
                <div class="pb-balken${anteil > 0.97 ? " voll" : ""}" title="${Math.round(anteil * 100)} % des Gehaltsbudgets"><i style="width:${Math.round(anteil * 100)}%"></i></div>`;
        }
    },

    // ------------------------------------------------------------ Trainingswoche

    /** Die laufende Woche von Montag bis Sonntag, heute hervorgehoben */
    portalWoche(state) {
        const host = document.getElementById("dashWoche");
        const cal = this.getCalendarEngine();
        if (!host || !Array.isArray(state.calendar)) return;
        const heute = state.currentDayIndex || 0;
        const tagHeute = state.calendar[heute];
        const datum = this.portalDatum(tagHeute?.date);
        const montag = heute - (datum ? (datum.getDay() + 6) % 7 : 0);
        const tage = [];
        for (let k = 0; k < 7; k++) {
            const tag = state.calendar[montag + k];
            const d = tag ? this.portalDatum(tag.date) : null;
            tage.push({ tag, k, kurz: d ? this.PORTAL_WOCHENTAGE[d.getDay()] : ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][k], heute: montag + k === heute, vorbei: montag + k < heute });
        }
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        host.innerHTML = `<div class="pw-woche">${tage.map(t => {
            const inhalt = t.tag && cal && typeof cal.tagesInhalt === "function" ? cal.tagesInhalt(state, t.tag) : null;
            const titel = t.tag ? `${t.tag.date} · ${inhalt?.titel || t.tag.title || ""}` : "";
            const spiel = t.tag && ["matchday", "cup", "euro", "friendly"].includes(t.tag.type);
            return `<div class="pw-tag${t.heute ? " heute" : ""}${t.vorbei ? " vorbei" : ""}${spiel ? " spiel" : ""}" title="${esc(this.ohneSymbol ? this.ohneSymbol(titel) : titel)}">
                <span class="pw-kurz">${esc(t.kurz)}</span>
                <span class="pw-symbol">${t.tag ? this.tagIcon(t.tag.type) : ""}</span>
            </div>`;
        }).join("")}</div>`;
    }
});
