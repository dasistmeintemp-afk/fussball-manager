/**
 * Postfach: Liste und Nachricht.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Postfach rendern
     */
    renderInbox() {
        const state = this.app.state;
        const listContainer = document.getElementById("inboxList");
        const newsEngine = (typeof NewsEngine !== 'undefined' && NewsEngine) 
            ? NewsEngine 
            : ((typeof window !== 'undefined' && window.NewsEngine) ? window.NewsEngine : null);

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

        listContainer.innerHTML = filtered.map(msg => {
            const isSelected = String(msg.id) === String(this.selectedInboxMessageId);
            const isUnread = !msg.read;
            const priorityBadge = msg.priority === "high" ? '<span class="msg-priority-badge">Wichtig</span>' : '';

            let icon = "✉️";
            let typeLabel = "Info";
            if (msg.type === "board_message" || msg.type === "welcome") { icon = "👔"; typeLabel = "Vorstand"; }
            else if (msg.type === "match_report" || msg.type === "match_preview") { icon = "⚽"; typeLabel = "Spiel"; }
            else if (msg.type === "transfer_done" || msg.type === "transfer_offer" || msg.type === "transfer_window") { icon = "🔄"; typeLabel = "Transfer"; }
            else if (msg.type === "training_report" || msg.type === "injury") { icon = "🏥"; typeLabel = "Training / Lazarett"; }
            else if (msg.type === "scout_report" || msg.type === "scouting") { icon = "🔍"; typeLabel = "Scouting"; }
            else if (msg.type === "finance_warning" || msg.type === "sponsor") { icon = "💰"; typeLabel = "Finanzen"; }
            else if (msg.type === "contract" || msg.type === "contract_expiring") { icon = "📝"; typeLabel = "Verträge"; }
            else if (msg.type === "retirement") { icon = "🎖️"; typeLabel = "Karriereende"; }
            else if (msg.type === "development") { icon = "📈"; typeLabel = "Entwicklung"; }
            else if (msg.type === "sportdirektor") { icon = "🎯"; typeLabel = "Sportdirektor"; }

            const displayDate = msg.date || "Saisonstart";

            return `
                <div class="inbox-item ${isUnread ? 'unread' : ''} ${isSelected ? 'selected' : ''}" data-msg-id="${msg.id}">
                    <div class="inbox-item-topline">
                        <div class="inbox-sender-wrap">
                            <span class="inbox-icon">${this.postfachSymbol(icon)}</span>
                            <span class="inbox-sender">${msg.sender || 'System'}</span>
                        </div>
                        <span class="inbox-date">${displayDate}</span>
                    </div>
                    <div class="inbox-item-title">${msg.subject || msg.title || 'Nachricht'}</div>
                    <div class="inbox-item-meta">
                        <span class="inbox-type">${typeLabel}</span>
                        ${priorityBadge}
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

    renderInboxDetail(msg) {
        const detailContainer = document.getElementById("inboxDetail");
        if (!detailContainer) return;

        let icon = "✉️";
        let typeLabel = "Info";
        if (msg.type === "board_message" || msg.type === "welcome") { icon = "👔"; typeLabel = "Vorstand"; }
        else if (msg.type === "match_report" || msg.type === "match_preview") { icon = "⚽"; typeLabel = "Spiel"; }
        else if (msg.type === "transfer_done" || msg.type === "transfer_offer" || msg.type === "transfer_window") { icon = "🔄"; typeLabel = "Transfer"; }
        else if (msg.type === "training_report" || msg.type === "injury") { icon = "🏥"; typeLabel = "Training / Lazarett"; }
        else if (msg.type === "scout_report" || msg.type === "scouting") { icon = "🔍"; typeLabel = "Scouting"; }
        else if (msg.type === "finance_warning" || msg.type === "sponsor") { icon = "💰"; typeLabel = "Finanzen"; }
        else if (msg.type === "contract" || msg.type === "contract_expiring") { icon = "📝"; typeLabel = "Verträge"; }
        else if (msg.type === "retirement") { icon = "🎖️"; typeLabel = "Karriereende"; }
        else if (msg.type === "development") { icon = "📈"; typeLabel = "Entwicklung"; }
        else if (msg.type === "sportdirektor") { icon = "🎯"; typeLabel = "Sportdirektor"; }

        let formattedBody = (msg.body || msg.text || "").replace(/\n/g, "<br>");
        const displayDate = msg.date || "Saisonstart";

        // Ein Scoutbericht erscheint als Berichtskarte, mit dem Weg zur Akte
        // und zum Angebot
        const state = this.app?.state;
        const spielerId = msg.relatedEntity?.type === "player" ? msg.relatedEntity.id
            : (msg.relatedEntity?.playerId ?? null);
        const spieler = spielerId !== null && state ? state.players.find(p => String(p.id) === String(spielerId)) : null;
        let aktionen = "";
        if (spieler) {
            const bericht = (state.scouting?.reports || []).find(r => String(r.playerId) === String(spieler.id));
            if (bericht && (msg.type === "scouting" || msg.type === "scout_report")) {
                formattedBody = `<div class="scout-berichte">${this.scoutBerichtHtml(bericht, state)}</div>`;
            }
            const eigener = spieler.clubId === state.userClubId;
            aktionen = `
                <div class="inbox-detail-aktionen">
                    <button class="btn btn-secondary btn-sm" data-inbox-akte="${this.escapeHtml(spieler.id)}"><svg class="ico" aria-hidden="true"><use href="#i-clipboard"/></svg><span>Spielerakte</span></button>
                    ${eigener ? "" : `<button class="btn btn-primary btn-sm" data-inbox-angebot="${this.escapeHtml(spieler.id)}">Verhandeln</button>`}
                    ${eigener && /^contract/.test(msg.type || "") ? `<button class="btn btn-primary btn-sm" data-inbox-vertrag="${this.escapeHtml(spieler.id)}">Vertrag verlängern</button>` : ""}
                </div>`;
        }

        // Der Entwicklungsbericht als Tabelle, jeder Name führt in die Akte
        if (msg.type === "development" && msg.entwicklung) {
            formattedBody = this.entwicklungsBerichtHtml(msg.entwicklung);
        }
        // Die Vorschläge des Sportdirektors als Karten mit Akte und Angebot
        if (msg.type === "sportdirektor" && Array.isArray(msg.vorschlaege) && typeof this.sdVorschlagHtml === "function") {
            const einleitung = String(msg.body || "").split("\n\n")[0];
            formattedBody = `<p>${this.escapeHtml(einleitung)}</p><div class="sd-liste">${msg.vorschlaege.map(v => this.sdVorschlagHtml(v)).join("")}</div>`
                + `<p class="text-muted" style="font-size:12px;">Wonach er sucht, können Sie ihm im Transfermarkt unter Sportdirektor sagen.</p>`;
        }

        detailContainer.innerHTML = `
            <div class="inbox-detail-header">
                <div class="inbox-detail-title-row">
                    <h2><span class="inbox-detail-icon">${this.postfachSymbol(icon)}</span>${msg.subject || msg.title || 'Nachricht'}</h2>
                    <span class="inbox-detail-date">${displayDate}</span>
                </div>
                <div class="inbox-detail-meta-grid">
                    <div>
                        <span class="meta-label">Absender</span>
                        <strong style="color:var(--text-main); font-size:13px;">${msg.sender || 'System'}</strong>
                    </div>
                    <div>
                        <span class="meta-label">Kategorie</span>
                        <strong style="color:var(--text-main); font-size:13px;">${typeLabel}</strong>
                    </div>
                </div>
            </div>
            <div class="inbox-detail-body">
                ${formattedBody}
            </div>
            ${aktionen}
        `;
        if (msg.type === "sportdirektor" && typeof this.bindeSdKarten === "function") this.bindeSdKarten(detailContainer);
        detailContainer.querySelectorAll("[data-entwicklung-akte]").forEach(el => el.addEventListener("click", () => {
            const pId = this.resolvePlayerId(el.dataset.entwicklungAkte);
            if (pId !== null) this.showPlayerDetailsModal(pId);
        }));
        detailContainer.querySelector("[data-inbox-akte]")?.addEventListener("click", (e) => {
            const pId = this.resolvePlayerId(e.currentTarget.dataset.inboxAkte);
            if (pId !== null) this.showPlayerDetailsModal(pId);
        });
        detailContainer.querySelector("[data-inbox-vertrag]")?.addEventListener("click", (e) => {
            const pId = this.resolvePlayerId(e.currentTarget.dataset.inboxVertrag);
            if (pId !== null) this.showPlayerDetailsModal(pId, { abschnitt: "vertrag" });
        });
        detailContainer.querySelector("[data-inbox-angebot]")?.addEventListener("click", (e) => {
            const pId = this.resolvePlayerId(e.currentTarget.dataset.inboxAngebot);
            if (pId !== null) this.showTransferOfferModal(pId);
        });
    },
});
