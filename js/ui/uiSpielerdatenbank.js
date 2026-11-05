/**
 * Der Transfermarkt als Spielerdatenbank, wie im Vorbild.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 * Die Tabelle zeigt je Spieler, was der Verein über ihn weiß:
 *
 *   Status      - Beobachtungsliste, Scout unterwegs, Bericht, Verhandlung,
 *                 Transferliste, Vertrag läuft aus, vereinslos, verletzt,
 *                 ausgeliehen, woanders unterschrieben
 *   Nation, Verein, Position mit Rolle, Alter
 *   Stärke und Potenzial in getrennten Spalten
 *   Ablöse und Gehalt als Spanne, so genau, wie man sie kennt
 *   Empfehlung  - die Note des Scouts (ScoutingEngine.empfehlung)
 *   Interesse   - ob er zu uns will (TransferEngine.interesse)
 *   Wissen      - wie gut der Verein den Spieler kennt
 *
 * Die Kacheln dazu stehen in der Übersicht der Rekrutierung (uiRekrutierung.js).
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /**
     * Länder ohne eigene Liga im Spielstand haben keine Flagge in den
     * Länderdaten. Hier stehen ihre Kürzel, daraus wird die Flagge. Ein
     * Kürzel aus drei Buchstaben hat keine eigene Flagge und steht als Text
     * da: Nordirland hieß vorher "NOR" wie Norwegen.
     */
    NATION_KUERZEL: {
        "Albanien": "AL", "Algerien": "DZ", "Angola": "AO", "Argentinien": "AR", "Armenien": "AM", "Australien": "AU",
        "Benin": "BJ", "Bosnien": "BA", "Bosnien-Herzegowina": "BA", "Bulgarien": "BG", "Burkina Faso": "BF", "Chile": "CL",
        "Costa Rica": "CR", "Curaçao": "CW", "DR Kongo": "CD", "Dänemark": "DK", "Ecuador": "EC", "Elfenbeinküste": "CI",
        "Finnland": "FI", "Gambia": "GM", "Georgien": "GE", "Ghana": "GH", "Griechenland": "GR", "Guinea": "GN",
        "Irland": "IE", "Island": "IS", "Israel": "IL", "Jamaika": "JM", "Japan": "JP", "Kamerun": "CM", "Kanada": "CA",
        "Kap Verde": "CV", "Kolumbien": "CO", "Kosovo": "XK", "Kroatien": "HR", "Libyen": "LY", "Mali": "ML",
        "Marokko": "MA", "Mexiko": "MX", "Montenegro": "ME", "Nordirland": "NIR", "Nigeria": "NG", "Nordmazedonien": "MK", "Norwegen": "NO",
        "Paraguay": "PY", "Peru": "PE", "Polen": "PL", "Rumänien": "RO", "Russland": "RU", "Schweden": "SE",
        "Senegal": "SN", "Serbien": "RS", "Slowakei": "SK", "Slowenien": "SI", "Südafrika": "ZA", "Südkorea": "KR",
        "Suriname": "SR", "Tschechien": "CZ", "Tunesien": "TN", "Ukraine": "UA", "Ungarn": "HU", "Uruguay": "UY",
        "USA": "US", "Venezuela": "VE", "Ägypten": "EG"
    },

    /** Die Flagge zu einer Nationalität in Worten - sonst ihr Kürzel */
    nationFlagge(nationalitaet) {
        const pg = typeof PlayerGenerator !== "undefined" ? PlayerGenerator : (typeof window !== "undefined" ? window.PlayerGenerator : null);
        const land = pg && typeof pg.landZuNation === "function" ? pg.landZuNation(nationalitaet) : null;
        if (land) return this.flaggeVon(land);
        // Wales und Schottland haben eigene Flaggen außerhalb der Kürzel
        if (nationalitaet === "Wales") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";
        if (nationalitaet === "Schottland") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
        const kuerzel = this.NATION_KUERZEL[nationalitaet];
        if (kuerzel && kuerzel.length === 2) return String.fromCodePoint(...[...kuerzel].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
        return `<span class="tm-nation-kuerzel">${this.escapeHtml(kuerzel || String(nationalitaet || "?").slice(0, 3).toUpperCase())}</span>`;
    },

    /** Eine Spanne in Euro: "58–92 Mio. €", "8,5–12 Mio. €", "146–211 Tsd. €", gleich: eine Zahl */
    spanneText(min, max) {
        const a = Math.max(0, Math.round(min || 0));
        const b = Math.max(a, Math.round(max || 0));
        const [teiler, einheit, stellen] = b >= 1e6 ? [1e6, "Mio. €", b >= 1e7 ? 0 : 1] : (b >= 1e3 ? [1e3, "Tsd. €", 0] : [1, "€", 0]);
        const zahl = (x) => (x / teiler).toLocaleString("de-DE", { maximumFractionDigits: stellen });
        return zahl(a) === zahl(b) ? `${zahl(b)} ${einheit}` : `${zahl(a)}–${zahl(b)} ${einheit}`;
    },

    /** Note als Marke: A+ bis E, ein erster Eindruck blass und gestrichelt */
    noteHtml(e) {
        if (!e) return "";
        const stufe = e.note.charAt(0).toLowerCase();
        const titel = `${e.sicher ? "Empfehlung des Scouts" : "Erster Eindruck - erst ein Bericht macht die Note belastbar"}: ${e.gruende.join(", ")}`;
        return `<span class="tm-note note-${stufe}${e.sicher ? "" : " unsicher"}" title="${this.escapeHtml(titel)}">${e.note}</span>`;
    },

    /**
     * Wechselinteresse als Marke (TransferEngine.interesse): grün
     * interessiert, hell würde wechseln, gelb zögert, orange kein Interesse,
     * rot kommt nicht in Frage. Die Gründe stehen im Tooltip.
     */
    interesseHtml(i, kurz = false) {
        if (!i) return "";
        return `<span class="tm-interesse-marke int-${i.stufe}" title="${this.escapeHtml(`${i.titel}: ${i.text}`)}"><i aria-hidden="true"></i>${kurz ? "" : `<span>${this.escapeHtml(i.titel)}</span>`}</span>`;
    },

    /**
     * Die Statussymbole eines Spielers. kontext.verhandelt: IDs mit
     * laufender Verhandlung.
     */
    tmStatusHtml(p, state, kontext = {}) {
        const se = this.getScoutingEngine();
        const zeichen = [];
        const plus = (icon, art, text) => zeichen.push(`<span class="tm-st st-${art}" title="${this.escapeHtml(text)}" aria-label="${this.escapeHtml(text)}"><svg class="ico" aria-hidden="true"><use href="#i-${icon}"/></svg></span>`);
        if (se?.istGemerkt?.(state, p.id)) plus("star", "merk", "Auf der Beobachtungsliste");
        const beob = se?.beobachtungVon?.(state, p.id);
        if (beob) plus("eye", "scout", `Scout unterwegs - Bericht in ${beob.tageRest} Tag(en)`);
        else if ((p.scoutingKnowledge?.reportsCount || 0) > 0) plus("doc", "bericht", "Scoutbericht liegt vor");
        if (kontext.verhandelt?.has(String(p.id))) plus("chat", "verh", "Verhandlung läuft");
        if (p.vorvertrag && p.vorvertrag.clubId !== state.userClubId) plus("close", "vergeben", `Hat bei ${p.vorvertrag.clubName || "einem anderen Verein"} unterschrieben`);
        if (!p.clubId) plus("check", "frei", "Vereinslos - ablösefrei");
        else if (p.transferListed) plus("wallet", "verkauf", "Steht zum Verkauf");
        else if ((p.contractYears ?? 2) <= 1) plus("clock", "vertrag", "Vertrag läuft aus");
        if (p.leihe) plus("transfer", "leihe", "Ausgeliehen");
        if (p.injured || (p.injuredWeeks || 0) > 0) plus("medical", "verletzt", `Verletzt${p.injuredWeeks ? ` (${p.injuredWeeks} Wo.)` : ""}`);
        return zeichen.join("");
    },

    /**
     * Eine Zeile der Spielerdatenbank. kontext: schaetzKontext für die
     * Spielerkarte, sichtwerte(p), note(p), verhandelt, vereinVon.
     */
    tmZeileHtml(p, state, kontext = {}) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const re = this.getRatingEngine();
        const club = kontext.vereinVon ? kontext.vereinVon.get(p.clubId) : state.clubs.find(c => c.id === p.clubId);
        const card = re ? re.calculateVisiblePlayerCard(p, kontext.schaetzKontext || {}) : null;
        const wert = kontext.sichtwerte ? kontext.sichtwerte(p) : { wertMin: p.value || 0, wertMax: p.value || 0 };
        const e = kontext.note ? kontext.note(p) : null;
        const te = (typeof TransferEngine !== "undefined" && TransferEngine) ? TransferEngine : (typeof window !== "undefined" ? window.TransferEngine : null);
        const gehalt = te && typeof te.gehaltsSpanne === "function" ? te.gehaltsSpanne(p) : { min: p.wage || 0, max: p.wage || 0 };
        const flagge = this.nationFlagge(p.nationality);
        const rolle = card?.bestRole?.role || "";
        const wissen = card ? card.confidence : (p.scoutingKnowledge?.knowledgeLevel || 25);
        const wissenStufe = wissen >= 70 ? "hoch" : wissen >= 40 ? "mittel" : "gering";
        const sterne = (min, max) => re ? re.renderStarRange(min, max) : "";
        const ablose = club ? this.spanneText(wert.wertMin, wert.wertMax) : "ablösefrei";
        const vereinsName = club ? esc(club.name) : "Vereinslos";
        const laeuft = typeof this.beobachtungsText === "function" ? this.beobachtungsText(p.id) : null;
        const status = this.tmStatusHtml(p, state, kontext);
        const interesse = kontext.interesse ? kontext.interesse(p)
            : (te && typeof te.interesse === "function" ? te.interesse(state, p) : null);
        return `
            <tr class="row-clickable" data-player-id="${esc(p.id)}" title="Profil von ${esc(p.name)}">
                <td class="tm-status">${status}</td>
                <td class="tm-name" data-wert="${esc(p.name)}">
                    <strong>${esc(p.name)}</strong>${this.signaturMarke(p)}${status ? `<span class="tm-status-inline tm-nur-schmal">${status}</span>` : ""}
                    <span class="tm-sub tm-nur-schmal">${esc(p.nationality || "")} · ${esc(p.age)} J.</span>
                </td>
                <td class="tm-nation" data-wert="${esc(p.nationality || "")}" title="${esc(p.nationality || "")}"><span class="tm-flagge">${flagge}</span><span class="tm-nation-name">${esc(p.nationality || "")}</span></td>
                <td class="tm-verein" data-wert="${club ? vereinsName : ""}">${club ? `${this.wappenHtml(club, "crest-sm")}<span>${vereinsName}</span>` : `<span class="badge badge-success" title="${esc(this.vereinslosFrist(p))}">Vereinslos</span>`}</td>
                <td class="tm-pos" data-wert="${["TW", "IV", "LV", "RV", "DM", "ZM", "LM", "RM", "OM", "LA", "RA", "ST"].indexOf(p.pos)}"><span class="pos-tag pos-${this.getPosGroup(p.pos)}">${esc(p.pos)}</span>${rolle ? `<span class="tm-sub tm-rolle-name">${esc(rolle)}</span>` : ""}</td>
                <td class="tm-alter" data-wert="${p.age || 0}">${esc(p.age)}</td>
                <td class="tm-staerke nowrap" data-wert="${card ? ((Number(card.starsCaMin) + Number(card.starsCaMax)) / 2).toFixed(2) : 0}" title="${esc(card?.abilityLabel || "")}">
                    <span class="tm-nur-breit">${card ? sterne(card.starsCaMin, card.starsCaMax) : ""}</span>
                    <span class="tm-nur-schmal">${card ? card.abilityStarsHtml : ""}</span>
                </td>
                <td class="tm-pot nowrap" data-wert="${card ? ((Number(card.starsPaMin) + Number(card.starsPaMax)) / 2).toFixed(2) : 0}" title="${esc(card?.potentialKlasse || card?.potentialLabel || "")}">${card ? sterne(card.starsPaMin, card.starsPaMax) : ""}</td>
                <td class="tm-wert nowrap" data-wert="${club ? wert.wertMin : 0}"><span class="${card && !card.isPrecise ? "estimated-value" : ""}">${ablose}</span></td>
                <td class="tm-gehalt nowrap" data-wert="${gehalt.min}" title="${gehalt.bekannt ? "Forderung seines Beraters je Woche" : "Geschätzte Forderung je Woche - genau weiß man sie erst in der Verhandlung"}">${this.spanneText(gehalt.min, gehalt.max)}</td>
                <td class="tm-note-zelle" data-wert="${e ? e.punkte : -9}">${this.noteHtml(e)}</td>
                <td class="tm-interesse" data-wert="${interesse ? interesse.punkte : -99}">${this.interesseHtml(interesse)}</td>
                <td class="tm-wissen" data-wert="${wissen}"><span class="tm-wissen-balken ${wissenStufe}" title="${esc(card?.confidenceInfo?.label || "")}"><i style="width:${wissen}%"></i></span><span class="tm-wissen-zahl">${wissen} %</span></td>
                <td class="tm-meta">${vereinsName} · ${ablose} · Wissen ${wissen} %</td>
                <td class="tm-aktion">
                    <div class="tm-knoepfe">
                        ${laeuft
                            ? `<button class="btn btn-sm btn-secondary btn-scout-direct" data-player-id="${esc(p.id)}" disabled title="Der Scout beobachtet ihn - Bericht ${esc(laeuft)}"><svg class="ico" aria-hidden="true"><use href="#i-eye"/></svg><span class="tm-knopf-text"> ${esc(laeuft)}</span></button>`
                            : `<button class="btn btn-sm btn-secondary btn-scout-direct" data-player-id="${esc(p.id)}" title="Scout zur Beobachtung schicken - der Bericht kommt nach einigen Tagen"><svg class="ico" aria-hidden="true"><use href="#i-search"/></svg><span class="tm-knopf-text"> Scouten</span></button>`}
                        <button class="btn btn-sm btn-primary btn-bid-player" data-player-id="${esc(p.id)}" title="Verhandeln" aria-label="Verhandeln"><svg class="ico" aria-hidden="true"><use href="#i-transfer"/></svg><span class="tm-knopf-text"> Verhandeln</span></button>
                    </div>
                </td>
            </tr>`;
    },
});
