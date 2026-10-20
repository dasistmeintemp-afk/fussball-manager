/**
 * Verein: Vereinskopf, Jobmarkt, Vision, Investor, Partner, Chronik, Anlagen, Preise und Gerüchte.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Vereins-Tab rendern (D3 & C6)
     */
    /**
     * Der Kopf der Vereinsseite: Wappen, Liga und die Kennzahlen als Kacheln -
     * so beginnt im Vorbild die Vereinsseite.
     */
    renderVereinsKopf(state, club, plaetze) {
        const esc = (v) => this.escapeHtml(String(v ?? ""));
        const crest = document.getElementById("clubHeroCrest");
        if (crest) this.setzeWappen(crest, club);
        const hero = document.getElementById("clubHero");
        if (hero) hero.style.setProperty("--vk-farbe", this.wappenFarben(club).farbe + "40");
        const liga = (state.leagues || []).find(l => l.id === club.leagueId);
        DOM.setText("clubHeroLiga", liga?.shortName || liga?.name || state.leagueName || "Liga");
        DOM.setText("clubHeroName", club.name);
        DOM.setText("clubHeroOrt", [club.city, club.stadium].filter(Boolean).join(" · "));

        const tabelle = (state.standings || []);
        const platzIndex = tabelle.findIndex(s => s.clubId === club.id);
        const ruf = Math.round(club.reputation || 60);
        const stimmung = Math.round(state.fanMood || 75);
        const chemie = Math.round(club.chemistry?.overall || 75);
        const balken = (wert) => `<span class="vk-balken"><i style="width:${Math.max(3, Math.min(100, wert))}%"></i></span>`;
        const kacheln = [
            ["Tabellenplatz", platzIndex >= 0 ? `${platzIndex + 1}.` : "—", `<small>${tabelle.length ? `von ${tabelle.length}` : ""}</small>`],
            ["Ruf", `${ruf}`, balken(ruf)],
            ["Fans", (club.fanBase || 25000).toLocaleString("de-DE"), `<small>${(plaetze || club.capacity || 0).toLocaleString("de-DE")} Plätze</small>`],
            ["Stimmung", `${stimmung} %`, balken(stimmung)],
            ["Teamchemie", `${chemie} %`, balken(chemie)],
            ["Kontostand", this.geldKurz ? this.geldKurz(club.balance || 0) : GameState.formatMoney(club.balance || 0), `<small>${esc(club.sponsor?.name || "")}</small>`]
        ];
        const el = document.getElementById("clubHeroKacheln");
        if (el) {
            el.innerHTML = kacheln.map(([titel, wert, extra]) =>
                `<div class="vk-kachel"><span>${esc(titel)}</span><strong>${esc(wert)}</strong>${extra || ""}</div>`).join("");
        }
    },

    /**
     * Der Jobmarkt: Angebote anderer Vereine, offene Stellen mit Bewerbung
     * und der Rücktritt (JobmarktEngine).
     */
    renderJobmarkt(state) {
        const box = document.getElementById("clubJobmarkt");
        const markt = typeof JobmarktEngine !== "undefined" ? JobmarktEngine : null;
        if (!box || !markt) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const angebote = markt.angebote(state);
        const stellen = markt.stellen(state);
        const jetzt = markt._jetzt(state);
        box.innerHTML = `
            <div class="card-header"><h3>Jobmarkt</h3><span class="header-tag">${angebote.length ? `${angebote.length} Angebot${angebote.length > 1 ? "e" : ""}` : "ruhig"}</span></div>
            ${angebote.length ? `<div class="jm-liste">${angebote.map(a => `
                <div class="jm-angebot">
                    <div><strong>${esc(a.clubName)}</strong> <span class="text-muted">${esc(a.leagueName)} · Ruf ${a.reputation}</span>
                        <div class="text-muted jm-klein">${a.art === "anfrage" ? "Fragt an" : "Antwort auf Ihre Bewerbung"} · Etat ${this.geldKurz(a.budget)} · Ziel: ${esc(this.erwartungText(a.erwartung))} · noch ${Math.max(0, a.bis - jetzt)} Tage</div></div>
                    <div class="jm-knoepfe">
                        <button class="btn btn-sm btn-primary" data-jm-an="${esc(a.clubId)}">Annehmen</button>
                        <button class="btn btn-sm btn-secondary" data-jm-ab="${esc(a.clubId)}">Ablehnen</button>
                    </div>
                </div>`).join("")}</div>` : ""}
            <h4 class="jm-titel">Offene Stellen</h4>
            ${stellen.length ? `<div class="jm-liste">${stellen.map(s => `
                <div class="jm-stelle">
                    <div><strong>${esc(s.clubName)}</strong> <span class="text-muted">${esc(s.leagueName)} · Ruf ${s.reputation}</span>
                        ${s.hindernis ? `<div class="text-muted jm-klein">${esc(s.hindernis)}</div>` : ""}</div>
                    ${s.angebot ? `<span class="badge badge-success">Angebot liegt vor</span>`
                        : s.beworben ? `<span class="badge badge-info">Beworben</span>`
                        : s.abgelehnt ? `<span class="badge badge-warning">Absage</span>`
                        : s.hindernis ? "" : `<button class="btn btn-sm btn-secondary" data-jm-bewerben="${esc(s.clubId)}">Bewerben</button>`}
                </div>`).join("")}</div>`
                : `<p class="text-muted jm-klein">Gerade sucht kein Verein Ihrer Ligen einen Trainer. Wechselt einer, steht die Stelle zwei Wochen hier.</p>`}
            <div class="jm-fuss">
                <button class="btn btn-ghost btn-sm" id="btnRuecktritt">Zurücktreten</button>
                <span class="text-muted jm-klein">Ein Rücktritt kostet keinen Ruf - aber die Station endet, und es zählt, wer Sie dann nimmt.</span>
            </div>`;
        const neu = () => { if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage(); this.renderJobmarkt(state); };
        box.querySelectorAll("[data-jm-bewerben]").forEach(b => b.addEventListener("click", () => {
            const res = markt.bewerben(state, b.dataset.jmBewerben);
            this.showToast(res.success ? "Bewerbung abgeschickt - die Antwort kommt in drei Tagen." : res.error, res.success ? "success" : "warning");
            neu();
        }));
        box.querySelectorAll("[data-jm-ab]").forEach(b => b.addEventListener("click", () => {
            markt.ablehnen(state, b.dataset.jmAb);
            this.showToast("Abgelehnt. Der Vorstand hat davon gehört und weiß es zu schätzen.", "info");
            neu();
        }));
        box.querySelectorAll("[data-jm-an]").forEach(b => b.addEventListener("click", () => {
            const a = angebote.find(x => String(x.clubId) === b.dataset.jmAn);
            if (!a || !confirm(`${a.clubName} übernehmen? Die Station bei Ihrem jetzigen Verein endet.`)) return;
            const res = markt.annehmen(state, a.clubId);
            if (!res.erfolg) { this.showToast(res.grund || "Der Wechsel hat nicht geklappt.", "error"); return; }
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage(null, true);
            this.showToast(`🤝 Sie übernehmen ${res.club.name}.`, "success");
            this.renderHeader();
            this.switchTab("dashboard");
        }));
        document.getElementById("btnRuecktritt")?.addEventListener("click", () => {
            if (!confirm("Wirklich zurücktreten? Sie verlassen den Verein sofort.")) return;
            const res = markt.ruecktritt(state);
            if (!res.success) { this.showToast(res.error, "error"); return; }
            this.pruefeEntlassung();
        });
    },

    /** Das Trainerprofil: fünf Werte, Lizenz mit Lehrgang, Ruf */
    renderTrainerProfil() {
        const box = document.getElementById("clubTrainerProfil");
        const engine = typeof TrainerProfilEngine !== "undefined" ? TrainerProfilEngine : null;
        if (!box || !engine) return;
        const state = this.app.state;
        const u = engine.uebersicht(state);
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const balken = (w) => `<span class="tp-balken"><i style="width:${Math.round(w / 20 * 100)}%"></i></span><b>${w}</b>`;
        const kurs = u.kurs
            ? `<div class="hint-box">Lehrgang zur ${esc(u.kurs.ziel)} läuft - noch ${u.kurs.tageOffen} Tage.</div>`
            : (u.naechsterKurs
                ? `<button class="btn btn-secondary" id="btnTrainerKurs">Lehrgang ${esc(u.naechsterKurs.name)} belegen (${this.geldKurz(u.naechsterKurs.kosten)}, ${u.naechsterKurs.tage} Tage)</button>`
                : `<div class="text-muted" style="font-size:13px;">Höchste Lizenz erreicht.</div>`);
        box.innerHTML = `
            <div class="card-header"><h3>Trainerprofil: ${esc(state.managerName || "Trainer")}</h3><span class="header-tag">${esc(u.typ)}</span></div>
            <div class="tp-raster">
                <div class="tp-werte">
                    ${u.werte.map(w => `<div class="tp-zeile" title="${esc(w.text)}"><span class="tp-name">${esc(w.name)}</span>${balken(w.wert)}</div>`).join("")}
                </div>
                <div class="tp-seite">
                    <div class="tp-kennzahl"><span>Lizenz</span><strong>${esc(u.lizenz)}</strong></div>
                    <div class="tp-kennzahl"><span>Hier verlangt</span><strong class="${u.erfuellt ? "" : "text-danger"}">${esc(u.pflicht)}</strong></div>
                    <div class="tp-kennzahl"><span>Ruf</span><strong>${u.ruf} / 100</strong></div>
                    ${kurs}
                </div>
            </div>
            <p class="text-muted tp-hinweis">Am Saisonende wächst, was gefordert war: Titel stärken die Motivation, eingebaute Talente die Jugendarbeit, Transfers die Spielerbewertung. Die Lizenz entscheidet, welche Vereine Ihnen ein Angebot machen dürfen.</p>`;
        document.getElementById("btnTrainerKurs")?.addEventListener("click", () => {
            const res = engine.kursStarten(state);
            this.showToast(res.success ? `Lehrgang gebucht: ${res.tage} Tage.` : res.error, res.success ? "success" : "error");
            if (res.success) {
                if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
                this.renderTrainerProfil();
                this.renderHeader?.();
            }
        });
    },

    /**
     * Die Vision des Vorstands: Fernziel mit Frist und die Jahresziele mit
     * dem Stand der laufenden Saison.
     */
    renderVision(state, club) {
        const el = document.getElementById("clubVision");
        const engine = typeof VisionEngine !== "undefined" ? VisionEngine : null;
        if (!el || !engine) return;
        const u = engine.uebersicht(state);
        if (!u) { el.innerHTML = ""; return; }
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const zahl = (z, wert) => wert === null || wert === undefined ? "–" : (z.geld ? this.geldKurz(wert) : String(wert).replace(".", ","));
        const marke = (steht) => steht === null ? `<span class="vis-marke offen">noch offen</span>`
            : (steht ? `<span class="vis-marke gut">auf Kurs</span>` : `<span class="vis-marke schlecht">hinter dem Ziel</span>`);
        const f = u.fern;
        const fernMarke = f.status === "erfuellt" ? `<span class="vis-marke gut">erreicht</span>`
            : (f.status === "verfehlt" ? `<span class="vis-marke schlecht">verfehlt</span>` : `<span class="vis-marke offen">Frist Saison ${f.bisSaison}</span>`);
        el.innerHTML = `
            <div class="card-header"><h3>🧭 Vereinsvision</h3><span class="header-tag">Saison ${u.seit}–${u.bisSaison}</span></div>
            <div class="vis-zeile vis-fern"><span><small>Fernziel</small><strong>${esc(f.text)}</strong></span>${fernMarke}</div>
            ${u.jahresziele.map(z => `
                <div class="vis-zeile"><span><small>${esc(z.bereich)} · jede Saison</small><strong>${esc(z.text)}</strong>
                    <em>${zahl(z, z.ist)} ${z.geld ? "" : esc(z.einheit)} · Ziel ${z.richtung > 0 ? "mindestens" : "höchstens"} ${zahl(z, z.soll)}${z.geld ? "" : ""}</em></span>${marke(z.steht)}</div>`).join("")}
            ${u.bilanz.length ? `<h4>Bilanz</h4><ul class="inv-historie">${u.bilanz.map(b => `<li>Saison ${b.saison}: ${b.ergebnisse.filter(e => e.status === "erfuellt").length} von ${b.ergebnisse.length} Jahreszielen erfüllt${b.fern === "erfuellt" ? " · Fernziel erreicht" : (b.fern === "verfehlt" ? " · Fernziel verfehlt" : "")}</li>`).join("")}</ul>`
                : `<p class="muted-note">Am Saisonende zieht der Vorstand Bilanz. Erfüllte Ziele stärken sein Vertrauen, verfehlte kosten es.</p>`}`;
    },

    /**
     * Eigentümer und Investor: ein Angebot zum Zu- oder Abraten, der
     * Investor mit Geld und Ansprüchen, Auflagen nach einer Rettung.
     */
    renderInvestor(state, club) {
        const el = document.getElementById("clubInvestor");
        const engine = typeof InvestorEngine !== "undefined" ? InvestorEngine : null;
        if (!el || !engine) return;
        const u = engine.uebersicht(state);
        if (!u) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const plaetze = (n) => n === 1 ? "einen Platz" : `${n} Plätze`;
        const bedingungen = (x) => `
            <div class="inv-werte">
                <div><span>Einstieg</span><strong>${this.geldKurz(x.einstieg ?? x.gezahlt ?? 0)}</strong></div>
                <div><span>Je Saison</span><strong>${this.geldKurz(x.jaehrlich || 0)}</strong></div>
                <div><span>Gehaltsetat</span><strong>+${this.geldKurz(x.gehaltPlus || 0)}/W.</strong></div>
                <div><span>Anspruch</span><strong>${x.anspruch ? `Ziel ${plaetze(x.anspruch)} höher` : "keiner"}</strong></div>
            </div>`;

        let haupt;
        if (u.angebot) {
            const a = u.angebot;
            haupt = `
                <div class="inv-angebot">
                    <div class="partner-kopf"><strong>${esc(a.name)}</strong> <small>${esc(a.artName)} · ${a.anteil} % der Anteile</small></div>
                    ${bedingungen(a)}
                    <p class="muted-note">${a.anspruch ? "Der Vorstand verlöre schneller die Geduld. " : ""}Der Vorstand entscheidet in ${a.tage} ${a.tage === 1 ? "Tag" : "Tagen"} - meist so, wie Sie raten, wenn er Ihnen vertraut.</p>
                    <div class="inv-knoepfe">
                        <button class="btn btn-sm ${a.empfehlung === "dafuer" ? "btn-primary" : "btn-secondary"}" data-inv-rat="dafuer">👍 Zuraten</button>
                        <button class="btn btn-sm ${a.empfehlung === "dagegen" ? "btn-primary" : "btn-secondary"}" data-inv-rat="dagegen">👎 Abraten</button>
                    </div>
                </div>`;
        } else if (u.investor) {
            const i = u.investor;
            haupt = `
                <div class="partner-kopf"><strong>${esc(i.name)}</strong> <small>${esc(i.artName)} · ${i.anteil} % seit Saison ${i.seit}</small></div>
                <div class="inv-werte">
                    <div><span>Bisher gezahlt</span><strong>${this.geldKurz(i.gezahlt || 0)}</strong></div>
                    <div><span>Je Saison</span><strong>${this.geldKurz(i.jaehrlich || 0)}</strong></div>
                    <div><span>Gehaltsetat</span><strong>+${this.geldKurz(i.gehaltPlus || 0)}/W.</strong></div>
                    <div><span>Anspruch</span><strong>${i.anspruch ? `Ziel ${plaetze(i.anspruch)} höher` : "keiner"}</strong></div>
                </div>
                <p class="muted-note">${i.geduld <= 1 ? "Verfehlt der Verein das nächste Saisonziel, zieht sich der Investor zurück." : `Der Investor hält noch ${i.geduld} verfehlte Saisonziele aus.`}${i.faktor > 1 ? " Der Vorstand misst Sie strenger." : ""}</p>`;
        } else {
            haupt = `
                <p class="muted-note">Der Verein gehört sich selbst.${u.fuenfzigPlusEins ? " Wegen der 50+1-Regel kann ein Investor höchstens 49 % übernehmen - er bringt weniger Geld und hat weniger Einfluss." : ""}</p>
                ${u.suche ? `<p class="muted-note">Der Vorstand hört sich nach einem Geldgeber um.</p>`
                    : `<div class="partner-zeile"><span>Den Vorstand bitten, einen Geldgeber zu suchen <small>${u.sucheHindernis ? esc(u.sucheHindernis) : `Zustimmung etwa ${Math.round(u.sucheChance * 100)} %`}</small></span>
                        <button class="btn btn-sm btn-secondary" id="btnInvestorSuche"${u.sucheHindernis ? " disabled" : ""}>Bitten</button></div>`}`;
        }

        const auf = u.auflagen;
        const auflagen = auf ? `
            <h4>Auflagen von ${esc(auf.geber)}</h4>
            <ul class="inv-auflagen">
                ${auf.sperre ? `<li>🚫 Keine Ablösen bis Saisonende - Verkaufserlöse tilgen Schulden.</li>` : ""}
                ${auf.deckel ? `<li>📉 Gehaltsdeckel bis Ende Saison ${auf.deckelBisSaison}: höchstens ${this.geldKurz(auf.deckel)} pro Woche.</li>` : ""}
                ${auf.verkauf ? `<li>💶 Verkäufe bis Ende des ${auf.verkauf.fenster === "winter" ? "Winter" : "Sommer"}fensters: ${this.geldKurz(auf.verkauf.erloes)} von ${this.geldKurz(auf.verkauf.ziel)}
                    <div class="inv-balken"><span style="width:${Math.min(100, Math.round(auf.verkauf.erloes / Math.max(1, auf.verkauf.ziel) * 100))}%"></span></div>
                    <small>Sonst ${engine.AUFLAGE.abzug} Punkte Abzug.</small></li>` : ""}
            </ul>` : "";
        const abzug = u.punktabzug ? `<p class="inv-abzug">⚖️ ${u.punktabzug.punkte} Punkte Abzug in dieser Saison (${esc(u.punktabzug.grund)}).</p>` : "";
        const historie = u.historie.length ? `<h4>Verlauf</h4><ul class="inv-historie">${u.historie.map(h => `<li>Saison ${h.saison}: ${esc(h.name)} ${esc(h.ergebnis)}</li>`).join("")}</ul>` : "";

        el.innerHTML = `
            <div class="card-header"><h3>💼 Eigentümer & Investor</h3>${u.fuenfzigPlusEins ? `<span class="header-tag">50+1</span>` : ""}</div>
            ${haupt}${auflagen}${abzug}${historie}`;
        const nachher = (res, ok) => {
            if (!res.success) { this.showToast(res.error || "Das ging nicht.", "error"); return; }
            if (ok) this.showToast(ok, "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderClub();
        };
        el.querySelectorAll("[data-inv-rat]").forEach(b => b.addEventListener("click", () =>
            nachher(engine.empfehle(state, b.dataset.invRat === "dafuer"), b.dataset.invRat === "dafuer" ? "Sie raten zu." : "Sie raten ab.")));
        document.getElementById("btnInvestorSuche")?.addEventListener("click", () => {
            const res = engine.suche(state);
            nachher(res, res.text);
        });
    },

    /**
     * Partnervereine: der Ausbildungspartner (Leihen mit Einsatzgarantie,
     * Vorkaufsrecht) und der große Partner (Leihangebote).
     */
    renderPartner(state, club) {
        const el = document.getElementById("clubPartner");
        const engine = typeof PartnerEngine !== "undefined" ? PartnerEngine : null;
        if (!el || !engine) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const p = engine.partner(state);
        const angebote = club.partnerAngebote || {};
        const spieler = (id) => state.players.find(x => String(x.id) === String(id));
        const liga = (c) => (state.leagues || []).find(l => l.id === c?.leagueId)?.shortName || "";
        const vorschlaege = (art) => engine.vorschlaege(state, art).map(c => `
            <li><span><strong>${esc(c.name)}</strong> <small>${esc(liga(c))} · Ansehen ${c.reputation || 50}</small></span>
            <button class="btn btn-sm btn-secondary" data-partner-anbieten="${art}" data-club="${esc(c.id)}">Kooperation anbieten</button></li>`).join("");
        const kopf = (e, titel) => `<div class="partner-kopf"><strong>${esc(e.club?.name || "")}</strong> <small>${esc(liga(e.club))} · bis Saison ${e.bisSaison}</small>
            <button class="btn btn-sm btn-secondary" data-partner-kuendigen="${titel}">Kündigen</button></div>`;

        let klein;
        if (p.klein) {
            const t = angebote.klein && angebote.klein.saison === (state.seasonYear || 1) ? spieler(angebote.klein.playerId) : null;
            const verleihbar = state.players.filter(x => x.clubId === club.id && !x.leihe && (x.age || 30) <= 23)
                .sort((a, b) => (a.age || 0) - (b.age || 0));
            klein = `${kopf(p.klein, "klein")}
                <p class="muted-note">Leihen dorthin mit Einsatzgarantie. Das beste Talent des Partners bekommen wir zuerst angeboten.</p>
                ${t ? `<div class="partner-zeile"><span>Vorkaufsrecht: <strong>${esc(t.name)}</strong> <small>${esc(t.pos)}, ${t.age} J.</small></span>
                    <button class="btn btn-sm btn-primary" id="btnPartnerVorkauf">Für ${this.geldKurz(angebote.klein.preis)} verpflichten</button></div>` : ""}
                ${verleihbar.length ? `<div class="partner-zeile"><select class="styled-select" id="partnerVerleihWahl">${verleihbar.map(x => `<option value="${esc(x.id)}">${esc(x.name)} (${esc(x.pos)}, ${x.age})</option>`).join("")}</select>
                    <button class="btn btn-sm btn-secondary" id="btnPartnerVerleihen">Zum Partner verleihen</button></div>` : ""}`;
        } else {
            klein = `<p class="muted-note">Ein kleinerer Verein, bei dem verliehene Spieler sicher spielen. Kostet einen Jahresbeitrag.</p><ul class="partner-liste">${vorschlaege("klein") || "<li>Kein passender Verein.</li>"}</ul>`;
        }

        let gross;
        if (p.gross) {
            const ids = angebote.gross && angebote.gross.saison === (state.seasonYear || 1) ? angebote.gross.playerIds || [] : [];
            gross = `${kopf(p.gross, "gross")}
                <p class="muted-note">Zum Saisonstart bietet der Partner junge Spieler zur Leihe an - ohne Gebühr, mit halbem Gehalt.</p>
                ${ids.map(spieler).filter(Boolean).map(x => `<div class="partner-zeile"><span><strong>${esc(x.name)}</strong> <small>${esc(x.pos)}, ${x.age} J. · ${this.abilityStarsFor ? this.abilityStarsFor(x, { compact: true }) : ""}</small></span>
                    <button class="btn btn-sm btn-secondary" data-partner-leihe="${esc(x.id)}">Ausleihen</button></div>`).join("") || `<p class="muted-note">In dieser Saison liegen keine Leihangebote vor.</p>`}`;
        } else {
            gross = `<p class="muted-note">Ein deutlich größerer Verein, der junge Spieler zur Leihe anbietet. Er sagt nur zu, wenn Verein und Trainer etwas gelten.</p><ul class="partner-liste">${vorschlaege("gross") || "<li>Kein größerer Verein in Reichweite.</li>"}</ul>`;
        }

        el.innerHTML = `
            <div class="card-header"><h3>🤝 Partnervereine</h3></div>
            <div class="partner-raster">
                <div><h4>Ausbildungspartner</h4>${klein}</div>
                <div><h4>Großer Partner</h4>${gross}</div>
            </div>`;
        const nachher = (res, ok) => {
            if (!res.success) { this.showToast(res.error || "Das ging nicht.", "error"); return; }
            if (ok) this.showToast(ok, "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderClub();
            this.renderHeader?.();
        };
        el.querySelectorAll("[data-partner-anbieten]").forEach(b => b.addEventListener("click", () =>
            nachher(engine.anbieten(state, b.dataset.partnerAnbieten, b.dataset.club), "Die Kooperation steht.")));
        el.querySelectorAll("[data-partner-kuendigen]").forEach(b => b.addEventListener("click", () =>
            nachher(engine.kuendigen(state, b.dataset.partnerKuendigen), "Kooperation beendet.")));
        document.getElementById("btnPartnerVorkauf")?.addEventListener("click", () =>
            nachher(engine.vorkaufsrecht(state), "Das Talent ist verpflichtet."));
        document.getElementById("btnPartnerVerleihen")?.addEventListener("click", () =>
            nachher(engine.verleihen(state, document.getElementById("partnerVerleihWahl")?.value), "Verliehen - mit Einsatzgarantie."));
        el.querySelectorAll("[data-partner-leihe]").forEach(b => b.addEventListener("click", () =>
            nachher(engine.ausleihen(state, b.dataset.partnerLeihe), "Ausgeliehen.")));
    },

    /**
     * Die Vereinschronik: Rekorde, Titel, Saisonbilanzen, Rekordspieler und
     * Legenden - geführt ab der Übernahme.
     */
    renderChronik(state, club) {
        const el = document.getElementById("clubChronik");
        const engine = typeof ChronikEngine !== "undefined" ? ChronikEngine : null;
        if (!el || !engine) return;
        const u = engine.uebersicht(state, club.id) || { seit: state.seasonYear || 1, rekorde: {}, saisons: [], titel: [], meisteSpiele: [], meisteTore: [], legenden: [] };
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const r = u.rekorde || {};
        const spiel = (e) => e ? `${esc(e.ergebnis)} ${e.heim ? "gegen" : "bei"} ${esc(e.gegner)} <small>${esc(e.wettbewerb)}, ${esc(e.datum)}</small>` : "–";
        const rekorde = [
            ["Höchster Sieg", spiel(r.hoechsterSieg)],
            ["Höchste Niederlage", spiel(r.hoechsteNiederlage)],
            ["Torreichstes Spiel", r.torreichstes ? `${spiel(r.torreichstes)}` : "–"],
            ["Zuschauerrekord", r.zuschauer ? `${r.zuschauer.wert.toLocaleString("de-DE")} <small>gegen ${esc(r.zuschauer.gegner)}, ${esc(r.zuschauer.datum)}</small>` : "–"],
            ["Längste Siegesserie", r.siegserie ? `${r.siegserie.wert} Spiele <small>bis ${esc(r.siegserie.bis)}</small>` : "–"],
            ["Längste Serie ohne Niederlage", r.ungeschlagen ? `${r.ungeschlagen.wert} Spiele <small>bis ${esc(r.ungeschlagen.bis)}</small>` : "–"],
            ["Teuerster Kauf", r.kauf ? `${esc(r.kauf.name)} <small>${this.geldKurz(r.kauf.wert)} von ${esc(r.kauf.verein)}, Saison ${r.kauf.saison}</small>` : "–"],
            ["Teuerster Verkauf", r.verkauf ? `${esc(r.verkauf.name)} <small>${this.geldKurz(r.verkauf.wert)} an ${esc(r.verkauf.verein)}, Saison ${r.verkauf.saison}</small>` : "–"]
        ].map(([titel, wert]) => `<div class="chronik-zeile"><span>${titel}</span><strong>${wert}</strong></div>`).join("");
        const liste = (eintraege, wert) => eintraege.length
            ? `<ol class="chronik-liste">${eintraege.map(s => `<li><button type="button" class="preis-name" data-player-id="${esc(s.id)}"${s.aktiv ? "" : " disabled"}>${esc(s.name)}</button> <small>${esc(s.pos || "")} · ${s.von === s.bis ? `Saison ${s.von}` : `${s.von}–${s.bis}`}</small><b>${wert(s)}</b></li>`).join("")}</ol>`
            : `<p class="text-muted chronik-leer">Noch keine Einträge.</p>`;
        // Trophäenschrank: je Wettbewerb ein Pokal mit Anzahl und Saisons
        const ms = typeof MeilensteinEngine !== "undefined" ? MeilensteinEngine : null;
        const ICON = { meister: "🏆", europa: "⭐", pokal: "🥇", supercup: "🛡️", sonst: "🏅" };
        const schrank = ms ? ms.trophaeen(state, club.id) : [];
        const schrankHtml = schrank.length
            ? `<div class="trophaeen-schrank">${schrank.map(t => `
                <div class="trophaee trophaee-${t.art}">
                    <span class="trophaee-icon" aria-hidden="true">${ICON[t.art] || "🏆"}</span>
                    ${t.anzahl > 1 ? `<span class="trophaee-anzahl">${t.anzahl}×</span>` : ""}
                    <strong>${esc(t.wettbewerb)}</strong>
                    <small>Saison ${t.saisons.join(", ")}</small>
                </div>`).join("")}</div>`
            : `<div class="trophaeen-leer"><span aria-hidden="true">🏆</span> Der Trophäenschrank wartet noch auf den ersten Titel.</div>`;
        const meilensteine = (state.meilensteine || []).slice(0, 8);
        const meilensteinHtml = meilensteine.length ? `
            <h4>Meilensteine</h4>
            <ul class="meilenstein-liste">${meilensteine.map(m => `<li><span aria-hidden="true">${esc(m.icon)}</span><span>${esc(m.text)}</span><small>Saison ${m.saison}${m.datum ? ` · ${esc(m.datum)}` : ""}</small></li>`).join("")}</ul>` : "";
        el.innerHTML = `
            <div class="card-header"><h3>📜 Chronik & Rekorde</h3><span class="header-tag">seit Saison ${u.seit}</span></div>
            <h4>Trophäenschrank</h4>
            ${schrankHtml}
            ${meilensteinHtml}
            <div class="chronik-raster">
                <div>
                    <h4>Rekorde</h4>
                    ${rekorde}
                </div>
                <div>
                    <h4>Rekordspieler</h4>
                    ${liste(u.meisteSpiele, s => `${s.spiele} Spiele`)}
                    <h4>Rekordtorschützen</h4>
                    ${liste(u.meisteTore, s => `${s.tore} Tore`)}
                    ${u.legenden.length ? `<h4>Vereinslegenden</h4>${liste(u.legenden, s => `${s.spiele} Sp. · ${s.tore} T.`)}` : ""}
                </div>
            </div>
            ${u.saisons.length ? `
            <h4>Saisonbilanzen</h4>
            <div class="table-container"><table class="compact-table chronik-saisons">
                <thead><tr><th>Saison</th><th>Liga</th><th>Platz</th><th>Punkte</th><th>Tore</th></tr></thead>
                <tbody>${u.saisons.map(z => `<tr><td>${z.saison}</td><td>${esc(z.liga || "")}</td><td>${z.platz ?? "–"}</td><td>${z.punkte ?? "–"}</td><td>${z.tore ?? "–"}:${z.gegentore ?? "–"}</td></tr>`).join("")}</tbody>
            </table></div>` : `<p class="text-muted chronik-leer">Die erste Saisonbilanz steht hier nach dem letzten Spieltag.</p>`}`;
        el.querySelectorAll("[data-player-id]:not([disabled])").forEach(b => b.addEventListener("click", () => {
            const id = this.resolvePlayerId ? this.resolvePlayerId(b.dataset.playerId) : b.dataset.playerId;
            if (id !== null && id !== undefined) this.showPlayerDetailsModal(id);
        }));
    },

    /**
     * Ehemalige Spieler: wer sich für den Stab bewerben kann, wer schon
     * zurück ist - und das Abschiedsspiel für eine Legende.
     */
    renderEhemalige(state, club) {
        const el = document.getElementById("clubEhemalige");
        const engine = typeof EhemaligeEngine !== "undefined" ? EhemaligeEngine : null;
        if (!el || !engine) return;
        const u = engine.uebersicht(state);
        if (!u) return;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const titel = { cotrainer: "Co-Trainer", fitness: "Athletiktrainer", analyse: "Spielanalyst", nachwuchs: "Nachwuchsleiter", scout: "Chefscout", medizin: "Mannschaftsarzt" };
        const abschiede = u.abschiede.map(a => `
            <div class="partner-zeile ehem-abschied"><span>🏟️ <strong>${esc(a.name)}</strong> <small>${a.spiele} Spiele, ${a.tore} Tore · Abschiedsspiel in dieser Saison möglich</small></span>
            <button class="btn btn-sm btn-primary" data-abschied="${esc(a.id)}">Abschiedsspiel ansetzen</button></div>`).join("");
        const gespielt = u.gespielt.length ? `<h4>Abschiedsspiele</h4><ul class="inv-historie">${u.gespielt.map(g => `<li>Saison ${g.saison}: ${esc(g.name)} - ${g.ergebnis} vor ${g.zuschauer.toLocaleString("de-DE")} Zuschauern, ${g.toreLegende} ${g.toreLegende === 1 ? "Tor" : "Tore"}</li>`).join("")}</ul>` : "";
        const liste = u.ehemalige.length
            ? `<ul class="partner-liste">${u.ehemalige.map(e => `<li><span><strong>${esc(e.name)}</strong>${e.legende ? " ⭐" : ""} <small>${esc(e.pos)} · ${e.spiele} Spiele, ${e.tore} Tore · Karriereende Saison ${e.saison}</small></span>
                <small>${e.status === "kann sich bewerben" ? `bewirbt sich vielleicht als ${titel[e.bereich] || e.bereich}` : esc(e.status)}</small></li>`).join("")}</ul>`
            : `<p class="muted-note">Wer ${engine.MIN_SPIELE} Spiele für den Verein gemacht hat und die Karriere beendet, steht hier. In der Vorbereitung bewirbt er sich vielleicht für den Trainerstab - für weniger Geld als ein Fremder. Legenden bekommen ein Abschiedsspiel.</p>`;
        const stab = u.imStab.length ? `<p class="muted-note">Im Stab: ${u.imStab.map(s => `${esc(s.name)} (${esc(s.titel)})`).join(", ")}.</p>` : "";
        el.innerHTML = `
            <div class="card-header"><h3>👋 Ehemalige</h3></div>
            ${abschiede}${stab}${liste}${gespielt}`;
        el.querySelectorAll("[data-abschied]").forEach(b => b.addEventListener("click", () => {
            const r = engine.abschiedsspiel(state, b.dataset.abschied);
            if (!r.success) { this.showToast(r.error, "error"); return; }
            this.showToast(`Abschiedsspiel ${r.ergebnis} vor ${r.zuschauer.toLocaleString("de-DE")} Zuschauern.`, "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderClub();
            this.renderHeader?.();
        }));
    },

    renderClub() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        if (!userClub) return;
        this.renderTrainerProfil();
        this.renderJobmarkt(state);
        this.renderVision(state, userClub);
        this.renderInvestor(state, userClub);
        this.renderPartner(state, userClub);
        this.renderChronik(state, userClub);
        this.renderEhemalige(state, userClub);

        DOM.setText("clubTabName", userClub.name);
        DOM.setText("clubTabCity", userClub.city || "Deutschland");
        DOM.setText("clubTabReputation", userClub.reputation || 70);
        DOM.setText("clubTabFanbase", (userClub.fanBase || 25000).toLocaleString("de-DE"));
        DOM.setText("clubTabFanMood", state.fanMood || 75);
        DOM.setText("clubTabChemistry", userClub.chemistry?.overall || 75);

        const facEngine = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
        const nutzbar = facEngine
            ? facEngine.verfuegbareKapazitaet(userClub, state.seasonYear || 1)
            : (userClub.capacity || 30000);
        const vollePlaetze = userClub.stadiumCapacity || userClub.capacity || 30000;

        DOM.setText("clubTabStadium", userClub.stadium || "Stadion");
        DOM.setText("clubTabCapacity", nutzbar < vollePlaetze
            ? `${nutzbar.toLocaleString("de-DE")} (Umbau, sonst ${vollePlaetze.toLocaleString("de-DE")})`
            : vollePlaetze.toLocaleString("de-DE"));
        DOM.setText("clubTabStadiumLvl", facEngine
            ? `Stufe ${userClub.anlagen?.stadium?.stufe ?? userClub.facilities?.stadium ?? 2}`
              + ` (${facEngine.zustandsText(userClub.anlagen?.stadium?.zustand ?? 100)})`
            : `Stufe ${userClub.facilities?.stadium || 2}`);

        this.renderVereinsKopf(state, userClub, nutzbar);

        // Sponsor
        DOM.setText("clubTabSponsorName", userClub.sponsor?.name || "Global Tech");
        DOM.setText("clubTabSponsorAmount", `${GameState.formatMoney(this.sponsorProSpieltag(userClub))} / Spieltag`);
        DOM.setText("clubTabSponsorYears", userClub.sponsor?.yearsRemaining || 2);

        // Anlagen: Stufe, Zustand, Baustellen
        this.renderFacilities(userClub);

        // Ticketpreis Slider
        const slider = document.getElementById("inputTicketPrice");
        const valText = document.getElementById("valTicketPrice");
        const forecastText = document.getElementById("txtTicketForecast");

        if (slider) {
            slider.value = userClub.ticketPrice || 35;
            if (valText) valText.textContent = `${slider.value} €`;
            
            const updateForecast = (price) => {
                const rep = userClub.reputation || 70;
                const priceFactor = 1.0 - ((price - 35) / 100) * 0.6;
                const estPct = Math.round(Math.min(100, Math.max(35, (0.68 + (rep / 200) * 0.22) * priceFactor * 100)));
                if (forecastText) forecastText.textContent = `Prognostizierte Auslastung: ~${estPct}% (Kapazität: ${userClub.capacity.toLocaleString('de-DE')})`;
            };
            updateForecast(slider.value);

            slider.oninput = (e) => {
                const p = parseInt(e.target.value, 10);
                userClub.ticketPrice = p;
                if (valText) valText.textContent = `${p} €`;
                updateForecast(p);
            };
        }

    },

    /**
     * Was jede Anlage je Spieltag kostet.
     *
     * Vorher standen hier vier Stufenzahlen, die schon im Verein-Reiter
     * stehen. Interessant ist an dieser Stelle etwas anderes: dass eine
     * verfallene Anlage teurer im Unterhalt ist als eine gepflegte. Das ist
     * der Grund, eine Sanierung nicht ewig aufzuschieben - und man sieht ihn
     * nur, wenn die Rechnung aufgeschlüsselt dasteht.
     */
    renderFacilityCosts(userClub) {
        const host = document.getElementById("finFacilityRows");
        if (!host) return;

        const state = this.app.state;
        const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
        const finance = (typeof FinanceEngine !== "undefined") ? FinanceEngine : null;
        if (!fac || !finance) { host.innerHTML = ""; return; }

        const saison = state.seasonYear || 1;
        const anlagen = fac.hole(userClub, saison);
        const ligaFaktor = finance.LEVEL_ECONOMY?.[userClub.level || 1] ?? 0.05;

        const ICONS = {
            stadium: '<svg class="ico" aria-hidden="true"><use href="#i-stadium"/></svg>',
            trainingGround: '<svg class="ico" aria-hidden="true"><use href="#i-dumbbell"/></svg>',
            youthCenter: '<svg class="ico" aria-hidden="true"><use href="#i-leaf"/></svg>',
            medicalCenter: '<svg class="ico" aria-hidden="true"><use href="#i-medical"/></svg>'
        };

        let summe = 0;
        host.innerHTML = fac.ANLAGEN.map(key => {
            const a = anlagen?.[key];
            if (!a) return "";

            // Dieselbe Rechnung wie in maintenancePerMatchday
            const flickwerk = 1 + (100 - Math.max(0, Math.min(100, a.zustand))) / 100 * 0.55;
            const kosten = Math.round(a.stufe * a.stufe * 1500 * flickwerk * ligaFaktor);
            const gepflegt = Math.round(a.stufe * a.stufe * 1500 * ligaFaktor);
            const aufschlag = kosten - gepflegt;
            summe += kosten;

            const hinweis = aufschlag > 0
                ? `<span class="unterhalt-aufschlag">+${GameState.formatMoney(aufschlag)} durch Zustand</span>`
                : "";

            return `
                <div class="finance-stat-row unterhalt-zeile">
                    <span class="unterhalt-name">
                        <span class="unterhalt-titel">${ICONS[key] || ""} ${fac.FACILITY_NAMES[key]}</span>
                        <span class="unterhalt-sub">Stufe ${a.stufe} &middot; ${fac.zustandsText(a.zustand)}</span>
                    </span>
                    <span class="unterhalt-betrag">
                        <strong>${GameState.formatMoney(kosten)}</strong>
                        ${hinweis}
                    </span>
                </div>`;
        }).join("");

        DOM.setText("finFacilityTotal", `${GameState.formatMoney(summe)} / Spieltag`);
    },

    /**
     * Die Anlagen des Vereins.
     *
     * Eine Anlage ist keine Zahl von eins bis fünf, die man einmal hochkauft.
     * Sie hat eine Stufe - was sie könnte - und einen Zustand - was sie davon
     * noch leistet. Das Camp Nou war Stufe fünf und trotzdem eine Baustelle.
     * Deshalb zeigt jede Karte beides und bietet zwei verschiedene Arbeiten an:
     * Ausbauen hebt die Stufe, Sanieren holt den Zustand zurück.
     */
    renderFacilities(userClub) {
        const host = document.getElementById("facilityGrid");
        if (!host) return;

        const state = this.app.state;
        const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : null;
        if (!fac || typeof fac.uebersicht !== "function") {
            host.innerHTML = `<p class="text-muted">Anlagendaten nicht verfügbar.</p>`;
            return;
        }

        const ICONS = {
            stadium: '<svg class="ico" aria-hidden="true"><use href="#i-stadium"/></svg>',
            trainingGround: '<svg class="ico" aria-hidden="true"><use href="#i-dumbbell"/></svg>',
            youthCenter: '<svg class="ico" aria-hidden="true"><use href="#i-leaf"/></svg>',
            medicalCenter: '<svg class="ico" aria-hidden="true"><use href="#i-medical"/></svg>'
        };
        const NUTZEN = {
            stadium: "Mehr Plätze, mehr Zuschauereinnahmen, lauterer Heimvorteil.",
            trainingGround: "Schnellere Entwicklung und bessere Erholung zwischen den Spielen.",
            youthCenter: "Mehr und bessere Talente aus dem eigenen Nachwuchs.",
            medicalCenter: "Weniger Verletzungen, kürzere Ausfallzeiten."
        };

        const geld = (b) => (typeof GameState !== "undefined" && GameState.formatMoney)
            ? GameState.formatMoney(b) : `${Math.round(b / 1000)} Tsd. €`;
        // Bauzeit auf dem Knopf: "4 Mon." oder "9 Wo."
        const dauerKurz = (t) => t >= 75 ? `${Math.round(t / 30)} Mon.` : `${Math.round(t / 7)} Wo.`;

        const zustandsFarbe = (z) => z >= 80 ? "#10b981" : z >= 60 ? "#84cc16"
            : z >= 42 ? "#f59e0b" : "#ef4444";

        const kasse = userClub.balance || 0;
        const liste = fac.uebersicht(state, userClub.id);

        host.innerHTML = liste.map(a => {
            // Stufenbalken: die volle Stufe hell, der Verfall als halber Balken
            const pips = [1, 2, 3, 4, 5].map(i => {
                if (i <= Math.floor(a.wirksameStufe)) return `<div class="fac-pip on"></div>`;
                if (i <= a.stufe) return `<div class="fac-pip part"></div>`;
                return `<div class="fac-pip"></div>`;
            }).join("");

            const verlust = a.stufe - a.wirksameStufe;
            const stufenText = verlust >= 0.15
                ? `Stufe ${a.stufe} &middot; wirksam <strong>${a.wirksameStufe.toFixed(1)}</strong>`
                : `Stufe <strong>${a.stufe}</strong> / 5`;

            let extra = "";
            if (a.key === "stadium" && a.vollKapazitaet) {
                extra = a.kapazitaet < a.vollKapazitaet
                    ? `<p class="fac-note">Zurzeit nutzbar: <strong>${a.kapazitaet.toLocaleString("de-DE")}</strong>
                       von ${a.vollKapazitaet.toLocaleString("de-DE")} Plätzen.</p>`
                    : `<p class="fac-note">Kapazität: <strong>${a.vollKapazitaet.toLocaleString("de-DE")}</strong> Plätze.</p>`;
            }
            if (a.key === "youthCenter" && a.profil) {
                const st = (a.profil.staerken || []).length
                    ? `Die Schule bringt vor allem ${this.profilWorte(a.profil.staerken)} hervor.`
                    : `Die Schule bildet breit aus, ohne besondere Handschrift.`;
                extra += `<div class="fac-profil"><strong>${a.profil.name}</strong><br>${st}</div>`;
            }

            // Fertig gebaut, aber noch nicht abbezahlt
            const kredit = (userClub.baukredite || []).find(k => k.name === a.name && k.offen > 0);
            if (kredit) extra += `<p class="fac-note">Baukredit: noch ${geld(kredit.offen)} offen, ${geld(kredit.rate)} je Woche.</p>`;

            let bau = "";
            if (a.projekt) {
                const anteil = Math.round((1 - a.projekt.restTage / Math.max(1, a.projekt.tage)) * 100);
                bau = `
                    <div class="fac-bau">
                        🏗️ <strong>${a.projekt.art === "ausbau" ? `Ausbau auf Stufe ${a.stufe + 1}` : "Sanierung"}</strong>
                        läuft${a.projekt.schnell ? " im Schichtbetrieb" : ""} &middot; ${a.projekt.restText}${a.projekt.fertigAm ? `, fertig um den ${a.projekt.fertigAm}` : ""}.<br>
                        Betrieb eingeschränkt um ${Math.round(a.projekt.beeintraechtigung * 100)} %.
                        <div class="fac-bau-fortschritt"><span style="width:${anteil}%"></span></div>
                    </div>`;
            }

            const sperre = !!a.projekt;
            const maxStufe = a.stufe >= 5;
            const neuwertig = a.zustand >= 85;

            const ausbauBtn = `
                <button class="btn btn-sm btn-primary btn-fac" data-facility="${a.key}" data-art="ausbau"
                        ${sperre || maxStufe ? "disabled" : ""}
                        title="${maxStufe ? "Stufe 5 ist die höchste" : `${fac.dauerText(a.dauerAusbau)} Bauzeit`}">
                    Ausbauen
                    <small>${maxStufe ? "Stufe 5 erreicht" : `${geld(a.kostenAusbau)} &middot; ${dauerKurz(a.dauerAusbau)}`}</small>
                </button>`;

            const sanierBtn = `
                <button class="btn btn-sm btn-secondary btn-fac" data-facility="${a.key}" data-art="sanierung"
                        ${sperre || neuwertig ? "disabled" : ""}
                        title="${neuwertig ? "Noch in gutem Zustand" : `${fac.dauerText(a.dauerSanierung)} Bauzeit`}">
                    Sanieren
                    <small>${neuwertig ? "nicht nötig" : `${geld(a.kostenSanierung)} &middot; ${dauerKurz(a.dauerSanierung)}`}</small>
                </button>`;

            const teuer = !sperre && !maxStufe && a.kostenAusbau > kasse;
            const bank = a.finanzierungAusbau;
            const hinweisGeld = teuer
                ? `<p class="fac-note" style="color:#f59e0b;">Für den Ausbau fehlen ${geld(a.kostenAusbau - kasse)}.`
                  + (bank?.moeglich ? ` Die Hausbank finanziert: ${geld(bank.anzahlung)} Anzahlung, dann ${geld(bank.rate)} je Woche.` : "")
                  + `</p>`
                : "";
            const hinweisFoerderung = !sperre && !maxStufe && a.foerderungAusbau > 0
                ? `<p class="fac-note">Sportstättenförderung: Die Stadt trägt ${Math.round(a.foerderQuote * 100)} % (${geld(a.foerderungAusbau)}).</p>`
                : "";

            return `
                <div class="fac-card ${a.projekt ? "is-building" : ""}">
                    <div class="fac-head">
                        <h4 class="fac-titel">${ICONS[a.key] || ""} ${a.name}</h4>
                        <span class="fac-stufe">${stufenText}</span>
                    </div>
                    <div class="fac-pips">${pips}</div>
                    <div class="fac-zustand">
                        <span>Zustand: <strong style="color:${zustandsFarbe(a.zustand)};">${a.zustandsText}</strong></span>
                        <span>${a.zustand} %${a.alter > 0 ? ` &middot; ${a.alter} J. alt` : " &middot; neu"}</span>
                    </div>
                    <div class="fac-bar"><span style="width:${a.zustand}%; background:${zustandsFarbe(a.zustand)};"></span></div>
                    <p class="fac-note">${NUTZEN[a.key] || ""}</p>
                    ${extra}
                    ${bau}
                    <div class="fac-actions">${ausbauBtn}${sanierBtn}</div>
                    ${hinweisFoerderung}
                    ${hinweisGeld}
                </div>`;
        }).join("");

        host.querySelectorAll(".btn-fac").forEach(btn => {
            btn.onclick = () => this.starteBau(btn.dataset.facility, btn.dataset.art);
        });
    },

    /**
     * Ein Bauvorhaben mit Blick auf die Rechnung starten: Baukosten,
     * Fördermittel, Eigenanteil - und, wenn die Kasse nicht reicht, die
     * Finanzierung über die Hausbank.
     */
    starteBau(key, art) {
        const state = this.app.state;
        const fac = (typeof FacilityEngine !== "undefined") ? FacilityEngine : window.FacilityEngine;
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!fac || !club) return;
        const saison = state.seasonYear || 1;
        const anlage = fac.hole(club, saison)?.[key];
        if (!anlage) return;
        const name = fac.FACILITY_NAMES[key];
        const geld = (b) => GameState.formatMoney(b);
        const detail = fac.kostenDetail(club, key, art, saison);
        const bank = fac.finanzierung(state, club, key, art);
        const kasse = club.balance || 0;
        const barGeht = kasse >= detail.netto;
        const dauer = fac.dauer(key, art, club);
        const S = fac.SCHICHTBETRIEB;
        const dauerSchnell = fac.dauer(key, art, club, true);
        const aufpreis = Math.round(detail.brutto * (S.kosten - 1));
        const stoerung = Math.round(((fac.BEEINTRAECHTIGUNG[key] || {})[art] || 0.2) * 100);

        const starte = (finanzierung) => {
            const schnell = !!document.getElementById("bauSchnell")?.checked;
            const res = fac.starteProjekt(state, club.id, key, art, Object.assign(finanzierung ? { finanzierung } : {}, { schnell }));
            if (!res.erfolg) {
                this.showToast(res.grund, "error", 6000);
                return false;
            }
            this.playSound("erfolg");
            this.showToast(`${res.name}: ${art === "ausbau" ? "Ausbau" : "Sanierung"} begonnen — ${fac.dauerText(res.tage)}`
                + (res.rate ? `, ${geld(res.rate)} je Woche an die Bank.` : `, ${geld(res.kosten)}.`), "success");
            if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
            this.renderClub();
            this.renderTraining();
            this.renderJugend();
            this.renderHeader();
            return true;
        };

        const zeile = (t, w, stark = false) => `<div${stark ? ` class="bau-eigen"` : ""}><span>${t}</span><strong>${w}</strong></div>`;
        const html = `
            <p><strong>${name}</strong>: ${art === "ausbau" ? `Ausbau von Stufe ${anlage.stufe} auf ${anlage.stufe + 1}` : `Sanierung (Zustand ${Math.round(anlage.zustand)} %)`}.
               Bauzeit ${fac.dauerText(dauer)}${fac.fertigAm(state, { restTage: dauer }) ? ` (fertig um den ${fac.fertigAm(state, { restTage: dauer })})` : ""}, der Betrieb läuft so lange um ${stoerung} % eingeschränkt.
               Gebaut wird auch in der Sommer- und Winterpause.</p>
            <div class="verh-zahlen bau-rechnung">
                ${zeile("Baukosten", geld(detail.brutto))}
                ${detail.foerderung > 0 ? zeile(`Sportstättenförderung (${Math.round(detail.quote * 100)} %)`, `− ${geld(detail.foerderung)}`) : ""}
                ${zeile("Eigenanteil", geld(detail.netto), true)}
                ${zeile("In der Kasse", geld(kasse))}
            </div>
            <label class="bau-schnell"><input type="checkbox" id="bauSchnell">
                <span><strong>Im Schichtbetrieb bauen:</strong> ${fac.dauerText(dauerSchnell)} statt ${fac.dauerText(dauer)}, ${geld(aufpreis)} Aufpreis (+${Math.round((S.kosten - 1) * 100)} % der Baukosten, ohne Förderung).</span></label>
            ${bank.moeglich
                ? `<p class="muted-note">Hausbank: ${geld(bank.anzahlung)} Anzahlung, danach ${geld(bank.rate)} je Woche über ${bank.wochen} Wochen, auch über das Bauende hinaus.
                   Zinsen ${geld(bank.zinsen)}, zusammen ${geld(bank.gesamt)}.</p>`
                : `<p class="muted-note">Hausbank: ${this.escapeHtml(bank.grund || "keine Finanzierung möglich")}</p>`}
            ${!barGeht && !bank.moeglich ? `<p style="color:var(--accent-danger);">Es fehlen ${geld(detail.netto - kasse)} - so lässt sich nicht bauen.</p>` : ""}`;

        const knoepfe = [{ text: "Abbrechen", klasse: "btn-secondary" }];
        if (bank.moeglich) knoepfe.push({ text: "In Raten finanzieren", klasse: barGeht ? "btn-secondary" : "btn-primary", aktion: () => starte("raten") });
        if (barGeht) knoepfe.push({ text: `Sofort bezahlen (${this.geldKurz(detail.netto)})`, klasse: "btn-primary", aktion: () => starte(null) });
        this.zeigeEntscheidung({ titel: art === "ausbau" ? "Ausbau planen" : "Sanierung planen", html, knoepfe });
    },

    /** "Techniker, Passgeber und Dribbler" statt "technique, passing, dribbling" */
    profilWorte(schluessel) {
        const W = {
            technique: "Techniker", passing: "Passgeber", dribbling: "Dribbler",
            pace: "Sprinter", physical: "Athleten", stamina: "Dauerläufer",
            vision: "Spielmacher", positioning: "Raumdeuter", defense: "Zweikämpfer"
        };
        const worte = schluessel.map(k => W[k] || k);
        if (worte.length <= 1) return worte[0] || "";
        return `${worte.slice(0, -1).join(", ")} und ${worte[worte.length - 1]}`;
    },

    /**
     * Statistiken & Saisonhistorie rendern
     */
    /**
     * Die Auszeichnungen der gewählten Liga: Monatspreise dieser Saison und
     * die Preise der letzten Saison mit der Elf der Saison.
     */
    renderPreise(state, ligaId, vereine) {
        const el = document.getElementById("statsPreise");
        const engine = typeof AuszeichnungEngine !== "undefined" ? AuszeichnungEngine : null;
        if (!el || !engine) return;
        const u = engine.uebersicht(state, ligaId);
        if (!u.monate.length && !u.letzteSaison) { el.hidden = true; el.innerHTML = ""; return; }
        el.hidden = false;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const verein = (id) => vereine.get(id)?.name || "";
        const person = (e, extra = "") => e
            ? `<button type="button" class="preis-name${e.clubId === state.userClubId ? " eigen" : ""}" data-player-id="${esc(e.id)}">${esc(e.name)}</button> <small>${esc(verein(e.clubId))}${extra}</small>`
            : "–";
        const trainer = (t, extra = "") => t ? `<span class="preis-name${t.istNutzer ? " eigen" : ""}">${t.istNutzer ? "Sie" : esc(t.verein)}</span>${extra}` : "–";
        const monate = u.monate.slice().reverse().map(m => `
            <li>
                <span class="preis-monat">${esc(engine.monatsName(m.monat))}</span>
                <span>🏅 ${person(m.spieler)}</span>
                ${m.talent ? `<span>🌱 ${person(m.talent)}</span>` : ""}
                ${m.trainer ? `<span>🎖️ ${trainer(m.trainer, ` <small>${m.trainer.punkte} Pkt. aus ${m.trainer.spiele}</small>`)}</span>` : ""}
            </li>`).join("");
        const s = u.letzteSaison;
        // Von links nach rechts, wie auf dem Platz
        const reihe = (plaetze) => (s?.elf || []).filter(e => plaetze.includes(e.platz))
            .sort((a, b) => plaetze.indexOf(a.platz) - plaetze.indexOf(b.platz))
            .map(e => `<span class="elf-spieler">${person(e)}</span>`).join("");
        const saison = s ? `
            <h4>Saison ${s.saison}</h4>
            <ul class="preis-liste">
                <li><span class="preis-monat">Spieler</span><span>${person(s.spieler, s.spieler ? `, Note ${String(s.spieler.note).replace(".", ",")}` : "")}</span></li>
                <li><span class="preis-monat">Talent</span><span>${person(s.talent)}</span></li>
                <li><span class="preis-monat">Torjäger</span><span>${person(s.torjaeger, s.torjaeger ? `, ${s.torjaeger.tore} Tore` : "")}</span></li>
                <li><span class="preis-monat">Trainer</span><span>${trainer(s.trainer, s.trainer ? ` <small>Platz ${s.trainer.platz}, erwartet ${s.trainer.erwartet}</small>` : "")}</span></li>
            </ul>
            ${(s.elf || []).length ? `
            <div class="elf-saison" aria-label="Elf der Saison">
                <div class="elf-reihe">${reihe(["LA", "ST", "RA"])}</div>
                <div class="elf-reihe">${reihe(["ZM"])}</div>
                <div class="elf-reihe">${reihe(["LV", "IV", "RV"])}</div>
                <div class="elf-reihe">${reihe(["TW"])}</div>
            </div>` : ""}` : "";
        el.innerHTML = `
            <div class="card-header"><h3>🏆 Auszeichnungen</h3></div>
            ${monate ? `<h4>Monatspreise ${state.seasonYear ? `Saison ${state.seasonYear}` : ""}</h4><ul class="preis-liste">${monate}</ul>` : ""}
            ${saison}`;
        el.querySelectorAll("[data-player-id]").forEach(b => b.addEventListener("click", () => {
            const id = this.resolvePlayerId ? this.resolvePlayerId(b.dataset.playerId) : b.dataset.playerId;
            if (id !== null && id !== undefined) this.showPlayerDetailsModal(id);
        }));
    },

    /**
     * Die Gala des letzten Jahres: Weltfußballer mit Podest, Talent, Torjäger
     * Europas, Trainer und Elf des Jahres - über alle Ligen.
     */
    renderJahrespreise(state, vereine) {
        const el = document.getElementById("statsJahrespreise");
        const engine = typeof JahrespreisEngine !== "undefined" ? JahrespreisEngine : null;
        if (!el || !engine) return;
        const j = engine.letzte(state);
        if (!j) { el.hidden = true; el.innerHTML = ""; return; }
        el.hidden = false;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const verein = (id) => vereine.get(id)?.name || (state.clubs || []).find(c => c.id === id)?.name || "";
        const person = (e, extra = "") => e
            ? `<button type="button" class="preis-name${e.clubId === state.userClubId ? " eigen" : ""}" data-player-id="${esc(e.id)}">${esc(e.name)}</button> <small>${esc(verein(e.clubId))}${extra}</small>`
            : "–";
        const note = (e) => e && e.note !== undefined ? `, Note ${String(e.note).replace(".", ",")}` : "";
        const medaille = ["🥇", "🥈", "🥉"];
        const podest = (j.weltfussballer || []).map((e, i) => `
            <li><span class="preis-monat">${medaille[i] || `${e.platz}.`} Platz ${e.platz}</span>
                <span>${person(e, `${note(e)}, ${e.tore} Tore`)}${(e.titel || []).length ? `<small class="jp-titel">${esc(e.titel.join(" · "))}</small>` : ""}</span></li>`).join("");
        const t = j.trainer;
        const reihe = (plaetze) => (j.elf || []).filter(e => plaetze.includes(e.platz))
            .sort((a, b) => plaetze.indexOf(a.platz) - plaetze.indexOf(b.platz))
            .map(e => `<span class="elf-spieler">${person(e)}</span>`).join("");
        el.innerHTML = `
            <div class="card-header"><h3>🌍 Gala des Jahres</h3><span class="header-tag">Saison ${esc(j.saison)}</span></div>
            <h4>Weltfußballer</h4>
            <ul class="preis-liste">${podest}</ul>
            <ul class="preis-liste">
                <li><span class="preis-monat">Talent</span><span>${person(j.talent, j.talent ? `, ${esc(j.talent.alter)} Jahre` : "")}</span></li>
                <li><span class="preis-monat">Torjäger Europas</span><span>${person(j.torjaeger, j.torjaeger ? `, ${j.torjaeger.tore} Ligatore` : "")}</span></li>
                <li><span class="preis-monat">Trainer</span><span>${t ? `<span class="preis-name${t.istNutzer ? " eigen" : ""}">${t.istNutzer ? "Sie" : esc(t.name || t.verein)}</span> <small>${t.istNutzer || !t.name ? "" : `${esc(t.verein)}, `}${esc(t.grund)}</small>` : "–"}</span></li>
            </ul>
            ${(j.elf || []).length ? `
            <h4>Elf des Jahres</h4>
            <div class="elf-saison" aria-label="Elf des Jahres">
                <div class="elf-reihe">${reihe(["LA", "ST", "RA"])}</div>
                <div class="elf-reihe">${reihe(["ZM"])}</div>
                <div class="elf-reihe">${reihe(["LV", "IV", "RV"])}</div>
                <div class="elf-reihe">${reihe(["TW"])}</div>
            </div>` : ""}`;
        el.querySelectorAll("[data-player-id]").forEach(b => b.addEventListener("click", () => {
            const id = this.resolvePlayerId ? this.resolvePlayerId(b.dataset.playerId) : b.dataset.playerId;
            if (id !== null && id !== undefined) this.showPlayerDetailsModal(id);
        }));
    },

    /** EM oder WM: Gruppen, K.-o.-Runden, Sieger und Torschützenkönig des letzten Turniers */
    renderTurnier(state) {
        const el = document.getElementById("statsTurnier");
        const engine = typeof TurnierEngine !== "undefined" ? TurnierEngine : null;
        const t = state.turnier;
        if (!el || !engine || !t) { if (el) { el.hidden = true; el.innerHTML = ""; } return; }
        el.hidden = false;
        const esc = (x) => this.escapeHtml(String(x ?? ""));
        const nation = state.nationaltrainer?.nation;
        const ergebnis = (sp) => `${sp.t[0]}:${sp.t[1]}${sp.elfmeter ? " i. E." : ""}`;
        const eigen = (n) => n === nation ? " eigen" : "";
        const gruppen = t.gruppen.map(g => {
            const tab = engine.tabelle(g);
            return `<div class="tu-gruppe"><h5>${esc(g.name)}</h5>${tab.map((z, i) => `
                <div class="tu-zeile${i < 2 && g.spiele.length >= 6 ? " weiter" : ""}${eigen(z.name)}"><span>${esc(z.name)}</span><span>${z.punkte} Pkt. <small>${z.tore}:${z.gegen}</small></span></div>`).join("")}</div>`;
        }).join("");
        const ko = t.ko.map(r => `<div class="tu-runde"><h5>${esc(r.name)}</h5>${(r.fertig ? r.spiele : r.paare.map(([h, a]) => ({ h, a })))
            .map(sp => {
                // Wer weiterkommt, steht fett - auch nach dem Elfmeterschießen
                const w = sp.t ? engine.sieger(sp) : null;
                const team = (n) => n === w ? `<strong>${esc(n)}</strong>` : esc(n);
                return `<div class="tu-zeile${eigen(sp.h) || eigen(sp.a)}"><span>${team(sp.h)} - ${team(sp.a)}</span><span>${sp.t ? ergebnis(sp) : "offen"}</span></div>`;
            }).join("")}</div>`).join("");
        el.innerHTML = `
            <div class="card-header"><h3>🏆 ${esc(t.name)}</h3><span class="header-tag">${t.siegerName ? `Sieger: ${esc(t.siegerName)}` : "läuft"}</span></div>
            ${t.torjaeger ? `<p class="muted-note">Torschützenkönig: <strong>${esc(t.torjaeger.name)}</strong> (${esc(t.torjaeger.nation)}), ${t.torjaeger.tore} Tore</p>` : ""}
            ${ko ? `<div class="tu-ko">${ko}</div>` : ""}
            <details class="tu-gruppen"${t.ko.length ? "" : " open"}><summary>Gruppenphase</summary><div class="tu-raster">${gruppen}</div></details>`;
    },

    /**
     * Die Fünfjahreswertung: Punkte der Länder aus dem Europapokal, die
     * laufende Saison zuletzt, und wie viele Plätze in der Königsklasse das
     * bringt, wenn die Saison jetzt endete.
     */
    renderKoeffizient(state) {
        const el = document.getElementById("statsKoeffizient");
        const engine = typeof KoeffizientEngine !== "undefined" ? KoeffizientEngine : null;
        if (!el || !engine) return;
        const liste = engine.rangliste(state);
        const plaetze = engine.vorschau(state);
        const eigenesLand = state.clubs.find(c => c.id === state.userClubId)?.countryId;
        const saison = state.seasonYear || 1;
        const zahl = (x) => x.toFixed(1).replace(".", ",");
        el.hidden = false;
        // Am Handy passen fünf Saisonspalten nicht: die vier vergangenen
        // stehen klein unter dem Land, daneben die laufende und die Summe
        el.innerHTML = `
            <div class="card-header"><h3>🇪🇺 Fünfjahreswertung</h3><span class="header-tag">5 Saisons</span></div>
            <table class="data-table kf-tabelle">
                <thead><tr><th>#</th><th>Land <small>(vier Saisons davor)</small></th><th>Saison ${saison}</th><th>Summe</th><th title="Plätze in der Königsklasse, wenn die Saison jetzt endete">CL</th></tr></thead>
                <tbody>${liste.map(z => `<tr class="${z.land === eigenesLand ? "eigene-zeile" : ""}">
                    <td>${z.rang}</td>
                    <td>${this.flaggeVon(z.land)} ${this.escapeHtml(z.name)}<small class="kf-reihe">${z.werte.slice(0, -1).map(zahl).join(" · ")}</small></td>
                    <td>${zahl(z.werte[z.werte.length - 1])}</td>
                    <td><strong>${zahl(z.summe)}</strong></td>
                    <td>${plaetze[z.land]?.championsLeague.length || "-"}${plaetze[z.land]?.leistungsplatz ? "*" : ""}</td>
                </tr>`).join("")}</tbody>
            </table>
            <p class="muted-note">Je Saison: Punkte der Vereine eines Landes im Europapokal (Sieg 2, Remis 1, je Endrundenrunde 1, Königsklasse 2) geteilt durch ihre Zahl. Rang 1 bis 4 stellt vier Vereine in der Königsklasse, Rang 5 drei, die Ränge 6 und 7 je zwei, alle dahinter ihren Meister. * Leistungsplatz für das Land mit dem besten Wert der Saison.</p>`;
    },

    /** Die Gerüchteküche der eigenen Liga - mit Haken, wenn es stimmte */
    renderGeruechte(state, eigeneLiga) {
        const el = document.getElementById("statsGeruechte");
        const engine = typeof LigaNachrichtenEngine !== "undefined" ? LigaNachrichtenEngine : null;
        if (!el || !engine) return;
        const liste = eigeneLiga ? engine.geruechteDieseSaison(state).slice().reverse() : [];
        if (!liste.length) { el.hidden = true; el.innerHTML = ""; return; }
        el.hidden = false;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const wahr = liste.filter(g => g.wahr).length;
        el.innerHTML = `
            <div class="card-header"><h3>🗞️ Gerüchteküche</h3><span class="header-tag">${wahr} von ${liste.length} bestätigt</span></div>
            <ul class="preis-liste">${liste.map(g => `
                <li>
                    <span class="preis-monat">${esc(g.datum || "")}</span>
                    <span>${g.wahr ? "✅" : "❔"} <strong>${esc(g.spieler)}</strong> <small>${esc(g.pos)}, ${esc(g.von)}</small></span>
                    <span>→ ${esc(g.verein)} ${g.wahr ? "<small>Wechsel perfekt</small>" : ""}</span>
                </li>`).join("")}</ul>`;
    },

    /** Das Trainerkarussell der gewählten Liga in dieser Saison */
    renderKarussell(state, ligaId) {
        const el = document.getElementById("statsKarussell");
        const engine = typeof TrainerwechselEngine !== "undefined" ? TrainerwechselEngine : null;
        if (!el || !engine) return;
        const liste = engine.dieseSaison(state, ligaId).slice().reverse();
        if (!liste.length) { el.hidden = true; el.innerHTML = ""; return; }
        el.hidden = false;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        el.innerHTML = `
            <div class="card-header"><h3>🔄 Trainerkarussell</h3><span class="header-tag">${liste.length} Wechsel</span></div>
            <ul class="preis-liste">${liste.map(w => `
                <li>
                    <span class="preis-monat">${esc(w.datum || `Saison ${w.saison}`)}</span>
                    <span><strong>${esc(w.verein)}</strong> <small>${w.grund === "saisonende" ? "Trennung zum Saisonende" : `Entlassung${w.platz ? `, Platz ${w.platz}` : ""}`}</small></span>
                    <span>${esc(w.alt)} → <strong>${esc(w.neu)}</strong> <small>${esc(engine.stilName(w.stil))}</small></span>
                </li>`).join("")}</ul>`;
    },
});
