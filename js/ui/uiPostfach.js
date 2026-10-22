/**
 * Postfach: Liste und Nachricht.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 *
 * Wie im Vorbild lebt die Post: Jede Abteilung hat ihr Zeichen, ein Verein
 * schreibt mit seinem Wappen, Anfragen tragen ihre Frist (dringend, wenn es
 * eng wird), Berichte hängen als Anhang an, und wer im Text vorkommt -
 * eigene Spieler, Spieler und Vereine der eigenen Liga -, lässt sich
 * anklicken. Unter jeder Nachricht stehen die Knöpfe, die zu ihr passen.
 * Was eine Nachricht ist, weiß die NewsEngine (kategorie, dringlichkeit,
 * anhaenge, verweisNamen); hier wird gezeichnet.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    _newsEngine() {
        if (typeof NewsEngine !== "undefined" && NewsEngine) return NewsEngine;
        if (typeof window !== "undefined" && window.NewsEngine) return window.NewsEngine;
        return typeof require !== "undefined" ? require("../engine/newsEngine.js").NewsEngine : null;
    },

    /**
     * Postfach rendern
     */
    renderInbox() {
        const state = this.app.state;
        const listContainer = document.getElementById("inboxList");
        const newsEngine = this._newsEngine();

        if (newsEngine && typeof newsEngine.normalizeAllMessages === 'function') {
            newsEngine.normalizeAllMessages(state);
        }

        const filtered = newsEngine && typeof newsEngine.getFilteredMessages === 'function'
            ? newsEngine.getFilteredMessages(state, this.inboxFilter, this.inboxSearch)
            : state.inbox;

        // Die Detailansicht steht am Handy mitten in der Liste - vor dem
        // Neuzeichnen zurück an ihren Platz, sonst ginge sie mit verloren
        const detail = document.getElementById("inboxDetail");
        if (detail && detail.parentElement === listContainer) listContainer.parentElement.appendChild(detail);

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="empty-state-sm" style="padding:24px; text-align:center;">Keine passenden Nachrichten im Postfach gefunden.</div>`;
            if (detail) {
                detail.classList.remove("inbox-detail-inline");
                detail.classList.toggle("inbox-detail-zu", this.postfachSchmal());
            }
            return;
        }

        // Falls noch keine Nachricht selektiert ist, erste sichtbare Nachricht wählen
        if (!this.selectedInboxMessageId || !state.inbox.some(m => String(m.id) === String(this.selectedInboxMessageId))) {
            this.selectedInboxMessageId = String(filtered[0].id);
        }

        const esc = (t) => this.escapeHtml(String(t ?? ""));
        listContainer.innerHTML = filtered.map(msg => {
            const isSelected = String(msg.id) === String(this.selectedInboxMessageId);
            const isUnread = !msg.read;
            const kat = newsEngine ? newsEngine.kategorie(msg) : { key: "verein", name: "Info", symbol: "i-mail" };
            const dringend = newsEngine ? newsEngine.dringlichkeit(state, msg) : null;
            const anhaenge = newsEngine ? newsEngine.anhaenge(state, msg) : [];
            const vorschau = newsEngine ? newsEngine.vorschau(msg) : "";
            const displayDate = msg.date || "Saisonstart";

            return `
                <div class="inbox-item post-kat-${kat.key}${isUnread ? ' unread' : ''}${isSelected ? ' selected' : ''}${dringend?.stufe === "dringend" ? " post-dringend" : ""}" data-msg-id="${msg.id}">
                    <div class="inbox-item-topline">
                        <div class="inbox-sender-wrap">
                            ${this.postAvatarHtml(msg, kat)}
                            <span class="inbox-sender">${esc(msg.sender || 'System')}</span>
                        </div>
                        <span class="inbox-date">${esc(displayDate)}</span>
                    </div>
                    <div class="inbox-item-title">${esc(msg.subject || msg.title || 'Nachricht')}</div>
                    ${vorschau ? `<div class="post-vorschau">${esc(vorschau)}</div>` : ""}
                    <div class="inbox-item-meta">
                        <span class="inbox-type">${esc(kat.name)}</span>
                        ${dringend ? this.postFlagHtml(dringend) : ""}
                        ${anhaenge.length ? `<span class="post-anhang-zahl" title="${anhaenge.length} ${anhaenge.length === 1 ? "Anhang" : "Anhänge"}"><svg class="ico" aria-hidden="true"><use href="#i-clipboard"/></svg>${anhaenge.length}</span>` : ""}
                    </div>
                </div>
            `;
        }).join("");

        // Klick-Events auf Nachrichtenliste
        listContainer.querySelectorAll(".inbox-item").forEach(item => {
            item.addEventListener("click", () => {
                const msgId = String(item.dataset.msgId);
                const message = state.inbox.find(m => String(m.id) === msgId);
                if (message) {
                    message.read = true;
                    // Am Handy klappt ein zweiter Tipp die Nachricht wieder zu
                    const zuklappen = this.postfachSchmal() && this.inboxOffen === msgId;
                    this.inboxOffen = zuklappen ? null : msgId;
                    this.selectedInboxMessageId = msgId;
                    this.renderInbox();
                    this.renderHeader();
                    if (typeof this.app.state.saveToLocalStorage === "function") {
                        this.app.state.saveToLocalStorage();
                    }
                    // Die geöffnete Nachricht samt Eintrag in den Blick holen -
                    // eine darüber zugeklappte hat ihn womöglich nach oben gezogen
                    const offen = !zuklappen && this.postfachSchmal()
                        ? [...listContainer.querySelectorAll(".inbox-item")].find(el => el.dataset.msgId === msgId) : null;
                    if (offen && typeof offen.scrollIntoView === "function") offen.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });

        // Detailansicht für die ausgewählte Nachricht rendern
        const currentMsg = state.inbox.find(m => String(m.id) === String(this.selectedInboxMessageId)) || filtered[0];
        if (currentMsg) {
            this.renderInboxDetail(currentMsg);
        }
        this.platziereInboxDetail(listContainer, detail);
    },

    /** Einspaltiges Postfach (Handy, Tablet): dieselbe Grenze wie im Stylesheet */
    postfachSchmal() {
        return typeof window !== "undefined" && typeof window.matchMedia === "function"
            && window.matchMedia("(max-width: 1200px)").matches;
    },

    /**
     * Wo die Nachricht steht. Breit: rechts neben der Liste. Schmal stand sie
     * unter der ganzen Liste - wer eine Nachricht antippte, musste erst ans
     * Ende scrollen. Jetzt klappt sie direkt unter ihrem Eintrag auf, und
     * ohne Antippen bleibt sie zu.
     */
    platziereInboxDetail(listContainer, detail) {
        if (!detail || !listContainer) return;
        const layout = listContainer.parentElement;
        const schmal = this.postfachSchmal();
        const eintrag = schmal && this.inboxOffen
            ? [...listContainer.querySelectorAll(".inbox-item")].find(el => el.dataset.msgId === String(this.inboxOffen)) : null;
        listContainer.querySelectorAll(".inbox-item.offen").forEach(el => el.classList.remove("offen"));
        if (eintrag) {
            eintrag.classList.add("offen");
            eintrag.after(detail);
        } else if (detail.parentElement !== layout) {
            layout.appendChild(detail);
        }
        detail.classList.toggle("inbox-detail-inline", !!eintrag);
        detail.classList.toggle("inbox-detail-zu", schmal && !eintrag);

        // Dreht jemand das Handy oder zieht das Fenster breiter, wechselt die Ansicht mit
        if (!this._postfachBreite && typeof window !== "undefined" && typeof window.matchMedia === "function") {
            this._postfachBreite = window.matchMedia("(max-width: 1200px)");
            const neu = () => { if (this.activeTab === "inbox") this.renderInbox(); };
            if (typeof this._postfachBreite.addEventListener === "function") this._postfachBreite.addEventListener("change", neu);
            else if (typeof this._postfachBreite.addListener === "function") this._postfachBreite.addListener(neu);
        }
    },

    /**
     * Wer schreibt: ein Verein mit seinem Wappen, sonst die Abteilung mit
     * ihrem Zeichen und den Anfangsbuchstaben des Absenders
     */
    postAvatarHtml(msg, kat, gross = false) {
        const state = this.app?.state;
        const verein = state ? (state.clubs || []).find(c => c.name === msg.sender) : null;
        if (verein && typeof this.wappenHtml === "function") return this.wappenHtml(verein, `post-avatar post-wappen${gross ? " gross" : ""}`);
        const name = String(msg.sender || "System").replace(/\(.*?\)/g, "").trim();
        const teile = name.split(/\s+/).filter(Boolean);
        const kuerzel = teile.length >= 2 ? teile[0][0] + teile[teile.length - 1][0] : name.slice(0, 2);
        return `<span class="post-avatar post-kat-${kat.key}${gross ? " gross" : ""}" aria-hidden="true">
            <span class="post-avatar-kuerzel">${this.escapeHtml(kuerzel.toUpperCase())}</span>
            <svg class="ico post-avatar-zeichen"><use href="#${kat.symbol}"/></svg>
        </span>`;
    },

    /** Die Marke für Frist und Stand: dringend, Antwort erwartet, wichtig, erledigt */
    postFlagHtml(d) {
        const zeichen = { dringend: "i-alert", antwort: "i-clock", wichtig: "i-info", erledigt: "i-check" }[d.stufe] || "i-info";
        const name = { dringend: "Dringend", antwort: "Antwort erwartet", wichtig: "", erledigt: "" }[d.stufe] || "";
        return `<span class="post-flag post-flag-${d.stufe}"><svg class="ico" aria-hidden="true"><use href="#${zeichen}"/></svg>${name ? `<strong>${name}</strong> · ` : ""}${this.escapeHtml(d.text)}</span>`;
    },

    /**
     * Text mit Verweisen: Wer im Text vorkommt und bekannt ist (eigene
     * Spieler zuerst, dann Spieler und Vereine der eigenen Liga), wird
     * anklickbar. Der Text wird dabei sicher maskiert.
     */
    verlinkePost(text, verweise) {
        let html = this.escapeHtml(String(text || ""));
        if (!verweise) return html.replace(/\n/g, "<br>");
        const ziel = new Map();
        verweise.spieler.forEach((id, name) => ziel.set(this.escapeHtml(name), { art: "spieler", id }));
        verweise.vereine.forEach((id, name) => { const k = this.escapeHtml(name); if (!ziel.has(k)) ziel.set(k, { art: "verein", id }); });
        const namen = [...ziel.keys()].filter(n => n.length >= 4 && html.includes(n)).sort((a, b) => b.length - a.length);
        if (namen.length) {
            const muster = new RegExp(`(^|[^\\p{L}\\p{N}])(${namen.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}])`, "gu");
            html = html.replace(muster, (_, vor, name) => {
                const z = ziel.get(name);
                const attr = z.art === "spieler" ? `data-spieler-link="${this.escapeHtml(String(z.id))}"` : `data-verein-link="${this.escapeHtml(String(z.id))}"`;
                return `${vor}<a href="#" class="post-link post-link-${z.art}" ${attr}>${name}</a>`;
            });
        }
        return html.replace(/\n/g, "<br>");
    },

    /** Der Spieler, um den es geht, als kleine Karte - ein Tipp öffnet sein Profil */
    postSpielerKarteHtml(p, state) {
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const club = (state.clubs || []).find(c => c.id === p.clubId);
        const eigen = p.clubId === state.userClubId;
        const zeile = [p.age ? `${p.age} J.` : "", p.nationality || "", club ? club.name : (p.clubId ? "" : "vereinslos")].filter(Boolean).join(" · ");
        const vertrag = typeof p.contractYears === "number" && p.clubId ? `${p.contractYears} J. Vertrag` : "";
        const verletzt = (p.injuredWeeks || 0) > 0 ? `<span class="post-sk-verletzt"><svg class="ico" aria-hidden="true"><use href="#i-medical"/></svg>${p.injuredWeeks} Wo.</span>` : "";
        return `
            <div class="post-spielerkarte${eigen ? " eigen" : ""}" data-spieler-link="${esc(p.id)}" role="button" tabindex="0" title="Profil von ${esc(p.name)} öffnen">
                <span class="pos-tag pos-${this.getPosGroup ? this.getPosGroup(p.pos) : ""}">${esc(p.pos || "")}</span>
                <div class="post-sk-name"><strong>${esc(p.name)}</strong><small>${esc(zeile)}</small></div>
                <div class="post-sk-werte">
                    ${typeof this.abilityStarsFor === "function" ? this.abilityStarsFor(p, { compact: true }) : ""}
                    <small>${p.value ? esc(this.geldKurz(p.value)) : ""}${vertrag && eigen ? ` · ${esc(vertrag)}` : ""}</small>
                </div>
                ${verletzt}
                <svg class="ico post-sk-pfeil" aria-hidden="true"><use href="#i-arrow"/></svg>
            </div>`;
    },

    /** Der Inhalt eines Anhangs - aus dem Spielstand von heute */
    postAnhangHtml(a, msg, state) {
        const news = this._newsEngine();
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const p = news ? news.spielerZu(state, msg) : null;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        const tabelle = (zeilen) => `<div class="post-tabelle">${zeilen.map(([l, w]) => `<div><span>${esc(l)}</span><strong>${w}</strong></div>`).join("")}</div>`;
        switch (a.art) {
            case "angebot": {
                const o = news.angebotZu(state, msg);
                if (!o) return "";
                if (o.status === "pending" && typeof this.angebotKarteHtml === "function") {
                    return this.angebotKarteHtml(o, state, club).replace(/<div class="ak-knoepfe">[\s\S]*?<\/div>/, "");
                }
                return tabelle([["Verein", esc(o.fromClubName || o.buyerClubName || "-")], ["Spieler", esc(o.playerName)],
                    ["Ablöse", esc(this.geldKurz(o.fee))], ["Stand", esc(news.ERLEDIGT[o.status] || "Erledigt")]]);
            }
            case "befund": {
                if (!p) return "";
                const heute = state.currentDayIndex || 0;
                const zurueck = (p.injuredWeeks || 0) > 0 ? (state.calendar || [])[heute + p.injuredWeeks * 7]?.date : null;
                const anfaellig = p.hiddenAttributes?.injuryProneness ?? 8;
                return (p.injuredWeeks || 0) > 0
                    ? tabelle([["Diagnose", esc(p.injuryName || "Verletzung")], ["Ausfall", `${p.injuredWeeks} Woche${p.injuredWeeks === 1 ? "" : "n"}`],
                        ["Zurück voraussichtlich", esc(zurueck || "nach der Saison")], ["Fitness", `${Math.round(p.fitness ?? 0)} %`],
                        ["Anfälligkeit", anfaellig >= 14 ? "hoch" : anfaellig >= 9 ? "mittel" : "gering"]])
                    : `<p class="text-muted">${esc(p.name)} ist wieder gesund (Fitness ${Math.round(p.fitness ?? 100)} %).</p>`;
            }
            case "scoutbericht": {
                const bericht = (state.scouting?.reports || []).find(r => String(r.playerId) === String(p?.id));
                return bericht && typeof this.scoutBerichtHtml === "function" ? `<div class="scout-berichte">${this.scoutBerichtHtml(bericht, state)}</div>` : "";
            }
            case "entwicklung":
                return typeof this.entwicklungsBerichtHtml === "function" ? this.entwicklungsBerichtHtml(msg.entwicklung) : "";
            case "kandidaten":
                return typeof this.sdVorschlagHtml === "function" ? `<div class="sd-liste">${msg.vorschlaege.map(v => this.sdVorschlagHtml(v)).join("")}</div>
                    <p class="text-muted" style="font-size:12px;">Wonach er sucht, können Sie ihm im Transfermarkt unter Sportdirektor sagen.</p>` : "";
            case "gegner": {
                const g = news.vereinZu(state, msg);
                if (!g) return "";
                const st = (state.standings || []);
                const i = st.findIndex(s => s.clubId === g.id), wir = st.findIndex(s => s.clubId === state.userClubId);
                const z = i >= 0 ? st[i] : null;
                const elf = (cid) => { const k = (state.players || []).filter(x => x.clubId === cid).map(x => x.overall || 0).sort((a, b) => b - a).slice(0, 11); return k.length ? k.reduce((s, x) => s + x, 0) / k.length : 0; };
                const torjaeger = (state.players || []).filter(x => x.clubId === g.id).sort((a, b) => (b.stats?.goals || 0) - (a.stats?.goals || 0))[0];
                const form = z && Array.isArray(z.form) ? z.form.filter(f => f && f !== "-").map(f => `<span class="post-form post-form-${esc(f)}">${({ W: "S", D: "U", L: "N" })[f] || esc(f)}</span>`).join("") : "";
                return tabelle([["Tabellenplatz", z ? `${i + 1}. (wir: ${wir + 1}.)` : "-"], ["Punkte", z ? `${z.points} aus ${z.played} Spielen` : "-"],
                    ["Tore", z ? `${z.goalsFor}:${z.goalsAgainst}` : "-"], ["Form", form || "-"],
                    ["Stärke der Elf", `${elf(g.id).toFixed(1)} (wir: ${elf(state.userClubId).toFixed(1)})`],
                    ["Torjäger", torjaeger && (torjaeger.stats?.goals || 0) > 0 ? `${esc(torjaeger.name)} (${torjaeger.stats.goals})` : "-"]])
                    + `<button class="btn btn-sm btn-secondary" data-verein-link="${esc(g.id)}" style="margin-top:8px;">Vereinsseite</button>`;
            }
            case "tabelle": {
                const st = state.standings || [];
                const wir = st.findIndex(s => s.clubId === state.userClubId);
                const zeigen = st.map((s, i) => ({ s, i })).filter(({ i }) => i < 6 || Math.abs(i - wir) <= 1 || i >= st.length - 2);
                let vorher = -1;
                return `<table class="compact-table post-tabelle-liga"><thead><tr><th>#</th><th>Verein</th><th>Sp.</th><th>Tore</th><th>Pkt.</th></tr></thead><tbody>${zeigen.map(({ s, i }) => {
                    const luecke = vorher >= 0 && i > vorher + 1 ? `<tr class="post-tabelle-luecke"><td colspan="5">…</td></tr>` : "";
                    vorher = i;
                    return `${luecke}<tr class="${s.clubId === state.userClubId ? "eigen" : ""}"><td>${i + 1}</td><td><a href="#" class="post-link" data-verein-link="${esc(s.clubId)}">${esc(s.clubName)}</a></td><td>${s.played}</td><td>${s.goalsFor}:${s.goalsAgainst}</td><td><strong>${s.points}</strong></td></tr>`;
                }).join("")}</tbody></table>`;
            }
            case "vertrag": {
                if (!p) return "";
                const ce = typeof ContractEngine !== "undefined" ? ContractEngine : null;
                const forderung = ce && club && typeof ce.getExtensionDemand === "function" ? ce.getExtensionDemand(p, club, state) : null;
                return tabelle([["Gehalt heute", `${esc(this.geldKurz(p.wage || 0))} / Woche`], ["Restlaufzeit", `${p.contractYears || 0} Jahr${p.contractYears === 1 ? "" : "e"}`],
                    ["Forderung", forderung?.demandWage ? `${esc(this.geldKurz(forderung.demandWage))} / Woche` : "-"],
                    ["Rolle", esc(p.squadRole || "-")], ["Marktwert", esc(this.geldKurz(p.value || 0))]]);
            }
            case "jahrgang": {
                const ye = typeof YouthEngine !== "undefined" ? YouthEngine : null;
                const saison = state.seasonYear || 1;
                const neu = ye ? ye.eigeneTalente(state).filter(t => t && !t.promoted && t.seit === saison && (t.quelle || "jugendtag") === "jugendtag") : [];
                return neu.length ? `<div class="post-jahrgang">${neu.map(t => `<div><span class="pos-tag pos-${this.getPosGroup(t.pos)}">${esc(t.pos)}</span><strong>${esc(t.name)}</strong><small>${t.age} J.</small>${typeof this.abilityStarsFor === "function" ? this.abilityStarsFor(t, { compact: true }) : ""}</div>`).join("")}</div>`
                    : `<p class="text-muted">Der Jahrgang ist inzwischen befördert, freigegeben oder gewechselt.</p>`;
            }
            case "konto": {
                const buchungen = (state.finances?.transactions || []).slice(0, 5);
                return tabelle([["Kontostand", esc(this.geldKurz(club?.balance || 0))], ["Transferbudget", esc(this.geldKurz(club?.transferBudget || 0))],
                    ["Gehaltsrahmen", `${esc(this.geldKurz(club?.wageBudget || 0))} / Woche`]])
                    + (buchungen.length ? `<div class="post-buchungen">${buchungen.map(b => `<div><span>${esc(b.description || b.type)}</span><strong class="${b.amount < 0 ? "minus" : "plus"}">${esc(this.geldKurz(b.amount))}</strong></div>`).join("")}</div>` : "");
            }
            default:
                return "";
        }
    },

    /** Die Knöpfe unter einer Nachricht: was man mit ihr tun kann */
    postAktionen(msg, state) {
        const news = this._newsEngine();
        const knoepfe = [];
        const k = (text, akt, primaer = false, symbol = null) => knoepfe.push({ text, akt, primaer, symbol });
        const kat = news ? news.kategorie(msg) : { key: "verein" };
        const p = news ? news.spielerZu(state, msg) : null;
        const o = news ? news.angebotZu(state, msg) : null;
        if (o && o.status === "pending") {
            k("Zum Angebot", `angebot:${o.id}`, true, "i-transfer");
            k(`Annehmen (${this.geldKurz(o.fee)})`, `annehmen:${o.id}`);
            k("Ablehnen", `ablehnen:${o.id}`);
        }
        if (p) {
            const eigen = p.clubId === state.userClubId;
            k("Profil", `profil:${p.id}`, false, "i-user");
            if (!eigen && msg.type !== "transfer_offer") k("Verhandeln", `verhandeln:${p.id}`, true);
            if (eigen && /^contract/.test(msg.type || "")) k("Vertrag verlängern", `vertrag:${p.id}`, true, "i-doc");
            if (eigen && msg.type === "player_talk") k("Gespräch führen", `gespraech:${p.id}`, true, "i-chat");
        }
        const g = (msg.type === "preview" || msg.type === "transfer_offer") && news ? news.vereinZu(state, msg) : null;
        if (g) k(g.name, `verein:${g.id}`, false, "i-shield");
        const tab = { spiel: ["Zur Aufstellung", "tactics"], presse: ["Zur Tabelle", "fixtures"], vorstand: ["Zum Verein", "club"],
            finanzen: ["Zu den Finanzen", "finances"], training: ["Zum Training", "training"] }[kat.key];
        if (tab) k(tab[0], `tab:${tab[1]}`);
        return knoepfe;
    },

    renderInboxDetail(msg) {
        const detailContainer = document.getElementById("inboxDetail");
        if (!detailContainer) return;
        const state = this.app?.state;
        const news = this._newsEngine();
        const esc = (t) => this.escapeHtml(String(t ?? ""));

        const kat = news ? news.kategorie(msg) : { key: "verein", name: "Info", symbol: "i-mail" };
        const dringend = news && state ? news.dringlichkeit(state, msg) : null;
        const anhaenge = news && state ? news.anhaenge(state, msg) : [];
        const verweise = news && state ? news.verweisNamen(state) : null;
        const spieler = news && state ? news.spielerZu(state, msg) : null;
        const displayDate = msg.date || "Saisonstart";

        // Der Text: Wer vorkommt, ist anklickbar
        const text = msg.type === "sportdirektor" && Array.isArray(msg.vorschlaege)
            ? String(msg.body || "").split("\n\n")[0] : (msg.body || msg.text || "");
        const koerper = this.verlinkePost(text, verweise);

        // Die Anhänge als Leiste; ein Tipp klappt den Inhalt auf
        const anhangLeiste = anhaenge.length ? `
            <div class="post-anhaenge">
                <div class="post-anhaenge-kopf"><svg class="ico" aria-hidden="true"><use href="#i-clipboard"/></svg>${anhaenge.length} ${anhaenge.length === 1 ? "Anhang" : "Anhänge"}</div>
                <div class="post-anhang-leiste">${anhaenge.map((a, i) => `
                    <button class="post-anhang${a.offen ? " offen" : ""}" data-post-anhang="${i}" aria-expanded="${a.offen ? "true" : "false"}">
                        <svg class="ico" aria-hidden="true"><use href="#i-doc"/></svg><span>${esc(a.titel)}</span>
                    </button>`).join("")}</div>
                ${anhaenge.map((a, i) => `<div class="post-anhang-inhalt" data-post-anhang-inhalt="${i}"${a.offen ? "" : " hidden"}>${state ? this.postAnhangHtml(a, msg, state) : ""}</div>`).join("")}
            </div>` : "";

        // Die Knöpfe; die Post der Nachwuchsabteilung führt in den Reiter Jugend
        const knoepfe = state ? this.postAktionen(msg, state) : [];
        const aktionen = (knoepfe.length || msg.type === "youth") ? `
            <div class="inbox-detail-aktionen">
                ${msg.type === "youth" ? `<button class="btn btn-secondary btn-sm" data-inbox-jugend="1"><svg class="ico" aria-hidden="true"><use href="#i-leaf"/></svg><span>Zur Jugend</span></button>` : ""}
                ${knoepfe.map(b => `<button class="btn ${b.primaer ? "btn-primary" : "btn-secondary"} btn-sm" data-post-akt="${esc(b.akt)}">${b.symbol ? `<svg class="ico" aria-hidden="true"><use href="#${b.symbol}"/></svg>` : ""}<span>${esc(b.text)}</span></button>`).join("")}
            </div>` : "";

        detailContainer.innerHTML = `
            <div class="inbox-detail-header post-kat-${kat.key}">
                <div class="inbox-detail-title-row">
                    <h2><span class="inbox-detail-icon"><svg class="ico" aria-hidden="true"><use href="#${kat.symbol}"/></svg></span>${esc(msg.subject || msg.title || 'Nachricht')}</h2>
                    <span class="inbox-detail-date">${esc(displayDate)}</span>
                </div>
                <div class="inbox-detail-meta-grid">
                    <div class="post-absender">
                        ${this.postAvatarHtml(msg, kat, true)}
                        <div>
                            <span class="meta-label">Absender</span>
                            <strong style="color:var(--text-main); font-size:13px;">${esc(msg.sender || 'System')}</strong>
                        </div>
                    </div>
                    <div>
                        <span class="meta-label">Kategorie</span>
                        <strong style="color:var(--text-main); font-size:13px;">${esc(kat.name)}</strong>
                    </div>
                </div>
                ${dringend ? `<div class="post-status post-status-${dringend.stufe}">${this.postFlagHtml(dringend)}</div>` : ""}
            </div>
            <div class="inbox-detail-body">
                ${koerper}
            </div>
            ${spieler ? this.postSpielerKarteHtml(spieler, state) : ""}
            ${anhangLeiste}
            ${aktionen}
        `;
        this.bindePost(detailContainer, msg);
    },

    /** Klicks in der Nachricht: Verweise, Anhänge, Knöpfe */
    bindePost(detailContainer, msg) {
        const state = this.app?.state;
        const alle = (sel) => detailContainer.querySelectorAll ? [...detailContainer.querySelectorAll(sel)] : [];
        const profil = (raw) => { const pId = this.resolvePlayerId(raw); if (pId !== null) this.showPlayerDetailsModal(pId); };
        if (msg.type === "sportdirektor" && typeof this.bindeSdKarten === "function") this.bindeSdKarten(detailContainer);
        alle("[data-entwicklung-akte]").forEach(el => el.addEventListener("click", () => profil(el.dataset.entwicklungAkte)));
        detailContainer.querySelector("[data-inbox-jugend]")?.addEventListener("click", () => this.switchTab("youth"));
        alle("[data-spieler-link]").forEach(el => {
            const los = (e) => { e.preventDefault?.(); profil(el.dataset.spielerLink); };
            el.addEventListener("click", los);
            el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") los(e); });
        });
        alle("[data-verein-link]").forEach(el => el.addEventListener("click", (e) => {
            e.preventDefault?.();
            if (typeof this.showClubDetailsModal === "function") this.showClubDetailsModal(el.dataset.vereinLink);
        }));
        // Anhänge auf- und zuklappen
        alle("[data-post-anhang]").forEach(el => el.addEventListener("click", () => {
            const inhalt = detailContainer.querySelector(`[data-post-anhang-inhalt="${el.dataset.postAnhang}"]`);
            if (!inhalt) return;
            const auf = inhalt.hidden;
            inhalt.hidden = !auf;
            el.classList.toggle("offen", auf);
            el.setAttribute("aria-expanded", auf ? "true" : "false");
        }));
        // Ein Spieler in einer Angebotskarte führt ebenfalls ins Profil
        alle(".angebot-karte [data-player-id]").forEach(el => el.addEventListener("click", () => profil(el.dataset.playerId)));
        alle("[data-post-akt]").forEach(el => el.addEventListener("click", () => {
            const [art, ...rest] = String(el.dataset.postAkt).split(":");
            const wert = rest.join(":");
            if (art === "profil") profil(wert);
            else if (art === "verhandeln") { const pId = this.resolvePlayerId(wert); if (pId !== null) this.showTransferOfferModal(pId); }
            else if (art === "vertrag") { const pId = this.resolvePlayerId(wert); if (pId !== null) this.showPlayerDetailsModal(pId, { abschnitt: "vertrag" }); }
            else if (art === "gespraech") { const pId = this.resolvePlayerId(wert); if (pId !== null) this.showPlayerDetailsModal(pId, { reiter: "vertrag" }); }
            else if (art === "angebot") this.zeigeAngebotSeite(wert);
            else if (art === "ablehnen") { if (this.lehneAngebotAb(wert) && this.activeTab === "inbox") this.renderInbox(); }
            else if (art === "annehmen") this.bestaetigeAngebotAusPost(wert);
            else if (art === "verein") { if (typeof this.showClubDetailsModal === "function") this.showClubDetailsModal(wert); }
            else if (art === "tab") this.switchTab(wert);
            if (state && typeof state.saveToLocalStorage === "function" && (art === "ablehnen")) state.saveToLocalStorage();
        }));
    },

    /** Annehmen aus der Post - eine Sache, die man nicht zurücknimmt, braucht eine Bestätigung */
    bestaetigeAngebotAusPost(offerId) {
        const state = this.app.state;
        const o = (state.transferMarket?.offers || []).find(x => String(x.id) === String(offerId));
        if (!o || o.status !== "pending") return;
        this.zeigeEntscheidung({
            titel: `${o.playerName} verkaufen?`,
            html: `<p>${this.escapeHtml(o.fromClubName || "Der Verein")} zahlt ${this.escapeHtml(this.geldKurz(o.fee))}. Der Wechsel ist sofort fest.</p>`,
            knoepfe: [
                { text: "Abbrechen", klasse: "btn-secondary" },
                { text: "Annehmen", klasse: "btn-primary", aktion: () => { if (this.nimmAngebotAn(o.id) && this.activeTab === "inbox") this.renderInbox(); } }
            ]
        });
    },
});
