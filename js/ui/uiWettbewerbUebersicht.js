/**
 * Wettbewerbe im Überblick, wie im Vorbild: eine Spalte je Wettbewerb, in
 * dem der eigene Verein spielt - die Liga, der Landespokal, der
 * Europapokal.
 *
 * Jede Spalte trägt oben die Farbe ihres Wettbewerbs, Land, Ziel und Stand.
 * Darunter die Liga als Tabelle mit Trend und Form, der Pokal mit den
 * Paarungen der laufenden Runde, der Europapokal mit der eigenen Gruppe
 * oder der Endrunde. Unten die besten Spieler des Wettbewerbs: Notenschnitt,
 * Tore, Vorlagen. Ein Tipp auf den Kopf öffnet den Wettbewerb.
 *
 * Steht in der Auswahl des Reiters Spielplan & Tabelle an erster Stelle.
 * Teil des UIManager (wie uiPortal.js).
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    WB_UEBERSICHT: "uebersicht",
    /** So viele Paarungen zeigt eine Pokalspalte - wie im Vorbild der Rest im Wettbewerb */
    WBU_PAARUNGEN: 12,

    /** Die Wettbewerbe, in denen der eigene Verein spielt (oder in dieser Saison spielte) */
    eigeneWettbewerbe(state) {
        const u = state.userClubId;
        const club = (state.clubs || []).find(c => c.id === u);
        const liste = [];
        const liga = this.getUserLeagueId(state);
        if (liga) liste.push({ id: liga, art: "liga" });
        const enthaelt = (feld) => (feld || []).some(x => x === u || x?.id === u || x?.clubId === u);
        Object.entries(state.cups || {}).forEach(([id, cup]) => {
            const dabei = enthaelt(cup.teilnehmer)
                || (cup.runden || []).some(r => (r.matches || []).some(m => m.homeClubId === u || m.awayClubId === u) || enthaelt(r.freilose));
            if (dabei || (!cup.teilnehmer && club && (cup.land || id.split("_")[0]) === club.countryId)) liste.push({ id, art: "pokal" });
        });
        ["ucl", "uel", "uecl"].forEach(id => {
            const comp = state.europeanCompetitions?.[id];
            if (!comp) return;
            const dabei = enthaelt(comp.participants)
                || (comp.groups || []).some(g => (g.standings || []).some(s => s.clubId === u))
                || (comp.endrunde || []).some(r => (r.matches || []).some(m => m.homeClubId === u || m.awayClubId === u));
            if (dabei) liste.push({ id, art: "europa" });
        });
        return liste;
    },

    renderWettbewerbeUebersicht(state) {
        const host = document.getElementById("wbSeite");
        if (!host) return;
        const spalten = this.eigeneWettbewerbe(state).map(w => this.wbuSpalte(state, w)).filter(Boolean);
        host.innerHTML = `<div class="wbu-raster wbu-n${Math.max(1, Math.min(4, spalten.length))}">${spalten.join("")}</div>`;
        host.querySelectorAll("[data-wbu-wettbewerb]").forEach(el => {
            el.onclick = () => {
                this.activeCompetitionId = el.dataset.wbuWettbewerb;
                this.renderFixturesAndStandings();
            };
        });
        host.querySelectorAll("[data-player]").forEach(el => {
            el.onclick = () => this.showPlayerDetailsModal(el.dataset.player);
        });
        if (typeof this.bindeWbVerweise === "function") this.bindeWbVerweise(host);
    },

    /** Eine Spalte: Kopf in der Farbe des Wettbewerbs, Inhalt, beste Spieler */
    wbuSpalte(state, w) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const thema = this.wettbewerbsThema(w.id);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        let land = "", inhalt = "", fuss = "", stand = null, ziel = null, kategorie = w.art === "liga" ? "liga" : w.art;
        if (w.art === "liga") {
            const d = this.wbDaten(state, w.id);
            if (!d.liga) return null;
            land = d.liga.countryId;
            const zeilen = d.tabelle.length ? d.tabelle : this.wbTabelleAusSpielen(state, d.liga, d.plan);
            const platz = zeilen.findIndex(z => z.clubId === state.userClubId) + 1;
            ziel = typeof BoardEngine !== "undefined" && typeof BoardEngine.zielText === "function" && club ? BoardEngine.zielText(state, club) : null;
            stand = platz ? { gut: true, text: `${platz}. Platz nach ${zeilen[platz - 1].played || 0} Spielen` } : null;
            inhalt = `<div class="wb-tab-rahmen wbu-tabelle"><table class="wb-tab portal-tab">
                <thead><tr><th>Pl.</th><th></th><th>Verein</th><th>Sp</th><th class="pt-suN">S</th><th class="pt-suN">U</th><th class="pt-suN">N</th><th class="pt-diff">Diff</th><th>Pkt</th><th class="pt-form">Form</th></tr></thead>
                <tbody>${this.portalTabellenZeilen(state, d, zeilen)}</tbody></table></div>
                <footer class="wb-legende">${this.wbLegende(state, d, zeilen.length)}</footer>`;
            fuss = this.wbuBeste(this.wbStatistik(state, d, 1).spieler.filter(s => s.titel !== "Meiste Spiele zu null"), state);
        } else if (w.art === "pokal") {
            const cup = state.cups[w.id];
            land = cup.land || w.id.split("_")[0];
            const r = this.wbuPokalStand(state, cup);
            stand = r.stand;
            inhalt = r.inhalt;
            fuss = this.wbuBeste(this.wbuBesteSpieler(state, this.wbuTeilnehmer(cup), "pokal"), state);
        } else {
            const comp = state.europeanCompetitions[w.id];
            land = null;
            const r = this.wbuEuropaStand(state, comp);
            stand = r.stand;
            inhalt = r.inhalt;
            fuss = this.wbuBeste(this.wbuBesteSpieler(state, this.wbuTeilnehmer(comp), "europa"), state);
        }
        const laenderName = land ? this.wbuLandName(land) : "Europa";
        return `<section class="dash-card wbu-spalte wbu-${kategorie}" style="--comp-accent:${thema.accent};--comp-accent-2:${thema.accent2};--comp-flaeche:${thema.flaeche};">
            <button type="button" class="wbu-kopf" data-wbu-wettbewerb="${esc(w.id)}" title="${esc(thema.name)} öffnen">
                <span class="wbu-emblem" aria-hidden="true">${land ? this.flaggeVon(land) : esc(thema.icon || "")}</span>
                <span class="wbu-name"><strong>${esc(thema.name)}</strong><small>${land ? `${this.flaggeVon(land)} ` : ""}${esc(laenderName)}</small></span>
            </button>
            <div class="wbu-lage">
                ${ziel ? `<div><span>Ziel</span><strong>${esc(ziel)}</strong></div>` : ""}
                ${stand ? `<div><span>Status</span><strong class="${stand.gut ? "wbu-gut" : "wbu-raus"}"><svg class="ico" aria-hidden="true"><use href="#i-${stand.gut ? "check" : "close"}"/></svg>${esc(stand.text)}</strong></div>` : ""}
            </div>
            <div class="wbu-inhalt">${inhalt}</div>
            <footer class="wbu-fuss">
                <h4>Beste Akteure</h4>
                ${fuss || '<p class="pp-leer">Noch keine Spiele.</p>'}
                <button type="button" class="btn btn-secondary btn-sm wbu-oeffnen" data-wbu-wettbewerb="${esc(w.id)}">Zum Wettbewerb</button>
            </footer>
        </section>`;
    },

    wbuLandName(land) {
        const laender = typeof COUNTRIES_DATA !== "undefined" && Array.isArray(COUNTRIES_DATA) ? COUNTRIES_DATA : [];
        return laender.find(l => l.id === land)?.name
            || (typeof KoeffizientEngine !== "undefined" && KoeffizientEngine.NAMEN?.[land]) || String(land || "").toUpperCase();
    },

    /** Wer im Wettbewerb spielt: Teilnehmerliste oder alle Vereine der Partien */
    wbuTeilnehmer(comp) {
        const ids = new Set();
        (comp?.teilnehmer || comp?.participants || []).forEach(x => ids.add(x?.id || x?.clubId || x));
        [...(comp?.runden || []), ...(comp?.spieltage || []), ...(comp?.endrunde || [])].forEach(r => (r.matches || []).forEach(m => { ids.add(m.homeClubId); ids.add(m.awayClubId); }));
        (comp?.groups || []).forEach(g => (g.standings || []).forEach(s => ids.add(s.clubId)));
        return ids;
    },

    /** Die Besten eines Pokals oder des Europapokals aus der Statistik je Wettbewerb */
    wbuBesteSpieler(state, ids, art) {
        const stat = typeof StatistikEngine !== "undefined" ? StatistikEngine : null;
        if (!stat || !ids.size) return [];
        const spieler = (state.players || []).filter(p => ids.has(p.clubId)).map(p => ({ p, s: stat.von(p, art) })).filter(e => (e.s.matches || 0) > 0);
        if (!spieler.length) return [];
        const komma = (v) => v.toFixed(2).replace(".", ",");
        const top = (liste, wert) => liste.slice().sort((a, b) => wert(b) - wert(a))[0];
        const note = (e) => (e.s.ratingSum || 0) / (e.s.matches || 1);
        const mitNote = spieler.filter(e => (e.s.matches || 0) >= 2);
        const zeile = (titel, e, wert) => e && wert ? { titel, liste: [{ id: e.p.id, name: e.p.name, clubId: e.p.clubId, wert }] } : null;
        const n = top(mitNote.length ? mitNote : spieler, note), t = top(spieler, e => e.s.goals || 0), v = top(spieler, e => e.s.assists || 0);
        return [
            zeile("Bester Notenschnitt", n, n && note(n) > 0 ? komma(note(n)) : null),
            zeile("Meiste Tore", t, t && t.s.goals ? t.s.goals : null),
            zeile("Meiste Vorlagen", v, v && v.s.assists ? v.s.assists : null)
        ].filter(Boolean);
    },

    wbuBeste(stat, state) {
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        return (stat || []).filter(s => s.liste.length).map(s => {
            const e = s.liste[0];
            const club = (state.clubs || []).find(c => c.id === e.clubId);
            return `<button type="button" class="pst-zeile" data-player="${esc(e.id)}">
                <span class="pst-titel">${esc(s.titel)}</span>
                <span class="pst-name">${club ? this.wappenHtml(club, "crest-sm pst-wappen") : ""}${esc(e.name)}</span>
                <b class="pst-wert${s.titel.includes("Note") ? " pst-note" : ""}">${esc(e.wert)}</b>
            </button>`;
        }).join("");
    },

    /** Pokal: Stand des eigenen Vereins und die Paarungen der laufenden Runde */
    wbuPokalStand(state, cup) {
        const u = state.userClubId;
        const runden = (cup.runden || []).filter(r => !r.uebersprungen);
        const aktuelle = cup.runden?.[cup.rundenIndex] || runden[runden.length - 1];
        const name = (id) => (state.clubs || []).find(c => c.id === id)?.name || "";
        let stand;
        if (cup.winnerId === u) stand = { gut: true, text: "Pokalsieger" };
        else {
            const eigene = runden.map(r => ({ r, m: (r.matches || []).find(m => m.homeClubId === u || m.awayClubId === u) })).filter(x => x.m);
            const letzte = eigene[eigene.length - 1];
            const sieger = letzte && letzte.m.played && typeof this.getCupEngine === "function" && this.getCupEngine()?.siegerVon ? this.getCupEngine().siegerVon(letzte.m) : null;
            if (letzte && letzte.m.played && sieger && sieger !== u) {
                stand = { gut: false, text: `Ausgeschieden in der ${letzte.r.roundName} gegen ${name(letzte.m.homeClubId === u ? letzte.m.awayClubId : letzte.m.homeClubId)}` };
            } else if (cup.completed && cup.winnerId) {
                stand = { gut: false, text: `Sieger: ${name(cup.winnerId)}` };
            } else {
                stand = { gut: true, text: aktuelle ? `Im Wettbewerb · ${aktuelle.roundName}` : "Wettbewerb läuft" };
            }
        }
        const spiele = (aktuelle?.matches || []);
        const eigeneZuerst = spiele.slice().sort((a, b) => ((b.homeClubId === u || b.awayClubId === u) ? 1 : 0) - ((a.homeClubId === u || a.awayClubId === u) ? 1 : 0));
        const gezeigt = eigeneZuerst.slice(0, this.WBU_PAARUNGEN);
        const inhalt = spiele.length
            ? `<div class="wb-spiele wbu-paarungen">${gezeigt.map(m => this.wbSpielZeile(state, m)).join("")}</div>
               <p class="wbu-hinweis">${this.escapeHtml(aktuelle.roundName)}, zeigt ${gezeigt.length} von ${spiele.length} Begegnungen</p>`
            : '<p class="pp-leer">Noch nicht ausgelost.</p>';
        return { stand, inhalt };
    },

    /** Europapokal: die eigene Gruppe oder die laufende Runde der Endrunde */
    wbuEuropaStand(state, comp) {
        const u = state.userClubId;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const name = (id) => (state.clubs || []).find(c => c.id === id)?.name || "";
        if ((comp.endrunde || []).length) {
            const aktuelle = comp.endrunde[comp.endrundeIndex] || comp.endrunde[comp.endrunde.length - 1];
            const eigene = comp.endrunde.map(r => ({ r, m: (r.matches || []).find(m => m.homeClubId === u || m.awayClubId === u) })).filter(x => x.m);
            const letzte = eigene[eigene.length - 1];
            const sieger = letzte && letzte.m.played && typeof this.getCupEngine === "function" && this.getCupEngine()?.siegerVon ? this.getCupEngine().siegerVon(letzte.m) : null;
            const stand = comp.winnerId === u ? { gut: true, text: "Sieger" }
                : !letzte ? { gut: false, text: "Nicht mehr dabei" }
                    : (letzte.m.played && sieger && sieger !== u) ? { gut: false, text: `Ausgeschieden im ${letzte.r.roundName} gegen ${name(letzte.m.homeClubId === u ? letzte.m.awayClubId : letzte.m.homeClubId)}` }
                        : { gut: true, text: `Im Wettbewerb · ${aktuelle?.roundName || "Endrunde"}` };
            const spiele = aktuelle?.matches || [];
            return { stand, inhalt: spiele.length ? `<div class="wb-spiele wbu-paarungen">${spiele.slice(0, this.WBU_PAARUNGEN).map(m => this.wbSpielZeile(state, m)).join("")}</div>` : "" };
        }
        const gruppe = (comp.groups || []).find(g => (g.standings || []).some(s => s.clubId === u));
        if (!gruppe) return { stand: { gut: false, text: "Nicht mehr dabei" }, inhalt: "" };
        const platz = gruppe.standings.findIndex(s => s.clubId === u) + 1;
        const stand = { gut: platz <= 2, text: `${gruppe.groupName}: ${platz}. Platz` };
        const vereinNach = new Map((state.clubs || []).map(c => [c.id, c]));
        const inhalt = `<div class="wb-tab-rahmen"><table class="wb-tab portal-tab">
            <thead><tr><th>Pl.</th><th>Verein</th><th>Sp</th><th class="pt-diff">Diff</th><th>Pkt</th></tr></thead>
            <tbody>${gruppe.standings.map((s, i) => `<tr class="${s.clubId === u ? "row-user-club" : ""}">
                <td class="wb-pos"><span class="wb-zone${i < 2 ? " zone-ucl" : ""}"></span>${i + 1}</td>
                <td class="wb-team">${this.wbVerein(vereinNach.get(s.clubId), { kurz: true })}</td>
                <td>${s.played || 0}</td><td class="pt-diff">${this.vorzeichen((s.goalsFor || 0) - (s.goalsAgainst || 0))}</td>
                <td class="wb-pkt"><strong>${s.points || 0}</strong></td></tr>`).join("")}</tbody></table></div>
            <p class="wbu-hinweis">${esc(gruppe.groupName)} · die ersten zwei kommen weiter</p>`;
        return { stand, inhalt };
    }
});
