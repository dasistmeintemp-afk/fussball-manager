/**
 * Karriere: Entlassung, Angebote an den Trainer, Laufbahnende und Zeugnis.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    getCareerEngine() {
        if (typeof CareerEngine !== "undefined" && CareerEngine) return CareerEngine;
        if (typeof window !== "undefined" && window.CareerEngine) return window.CareerEngine;
        return null;
    },

    /**
     * Prüft nach jedem Zeitschritt, ob der Vorstand die Zusammenarbeit beendet
     * hat - und hält dann alles an.
     *
     * Vorher wurde `state.managerDismissed` gesetzt und von niemandem gelesen:
     * Man wurde entlassen und managte am nächsten Spieltag weiter denselben
     * Verein.
     *
     * Gibt true zurück, wenn die Entlassung den Ablauf unterbrochen hat.
     */
    pruefeEntlassung() {
        const state = this.app?.state;
        const career = this.getCareerEngine();
        if (!state || !career) return false;
        if (!state.managerDismissed || state.careerOver) return false;
        if (this._entlassungOffen) return true;

        const daten = career.verarbeiteEntlassung(state);
        if (!daten) return false;

        this._entlassungOffen = true;
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
        this.zeigeEntlassung(daten);
        return true;
    },

    /**
     * Das Ende einer Station: was war, und was jetzt möglich ist.
     */
    zeigeEntlassung(daten) {
        const state = this.app.state;
        const modal = document.getElementById("modalDismissal");
        if (!modal) return;

        const b = daten.bilanz || { spiele: 0, siege: 0, unentschieden: 0, niederlagen: 0, punkteSchnitt: 0 };

        const ruecktritt = daten.grund === "ruecktritt";
        DOM.setText("dismissTitle", ruecktritt ? "Sie treten zurück" : "Der Vorstand beendet die Zusammenarbeit");
        DOM.setText("dismissSubtitle", ruecktritt
            ? `Sie verlassen ${daten.clubName} zum ${daten.matchday}. Spieltag.`
            : `${daten.clubName} trennt sich zum ${daten.matchday}. Spieltag von Ihnen.`);

        const body = document.getElementById("dismissBody");
        if (body) {
            body.innerHTML = `
                <div class="dash-card">
                    <h4>Ihre Bilanz bei ${this.escapeHtml(daten.clubName)}</h4>
                    <div class="dismiss-stats">
                        <div><span>${b.spiele}</span><small>Spiele</small></div>
                        <div><span>${b.siege}</span><small>Siege</small></div>
                        <div><span>${b.unentschieden}</span><small>Remis</small></div>
                        <div><span>${b.niederlagen}</span><small>Pleiten</small></div>
                        <div><span>${b.punkteSchnitt}</span><small>Punkte/Spiel</small></div>
                    </div>
                    <p class="text-muted" style="margin-top:10px;">
                        Tabellenplatz zum Zeitpunkt der Trennung: <strong>${daten.rank}.</strong> ·
                        Ihr Ruf in der Branche: <strong>${daten.ruf}</strong> von 100
                    </p>
                </div>
            `;
        }

        const offers = document.getElementById("dismissOffers");
        const angebote = daten.angebote || [];
        if (offers) {
            offers.innerHTML = angebote.length
                ? `<h4 class="dismiss-offers-title">Diese Vereine würden Sie nehmen</h4>`
                    + angebote.map((a, i) => `
                        <button class="dismiss-offer" data-offer="${i}">
                            <div class="dismiss-offer-main">
                                <strong>${this.escapeHtml(a.clubName)}</strong>
                                <span class="dismiss-offer-league">${this.escapeHtml(a.leagueName)}</span>
                            </div>
                            <div class="dismiss-offer-meta">
                                Platz ${a.platz} von ${a.vonWievielen} ·
                                Etat ${this.formatMoneySafe(a.budget)} ·
                                Ziel: ${this.erwartungText(a.erwartung)}
                            </div>
                        </button>
                    `).join("")
                : `<p class="text-muted" style="text-align:center; padding:12px;">
                       Im Moment sucht kein Verein einen Trainer mit Ihrem Werdegang.
                       Es bleibt nur, die Laufbahn zu beenden.
                   </p>`;

            offers.querySelectorAll("[data-offer]").forEach(btn => {
                btn.onclick = () => {
                    const angebot = angebote[parseInt(btn.dataset.offer, 10)];
                    if (!angebot) return;
                    this.nimmTrainerAngebotAn(angebot);
                };
            });
        }

        const btnEnde = document.getElementById("btnEndCareer");
        if (btnEnde) btnEnde.onclick = () => this.beendeLaufbahn();

        modal.style.display = "flex";
        this.playSound("click");
    },

    erwartungText(key) {
        return ({
            championship: "Meisterschaft", top3: "unter die ersten Drei",
            midfield: "gesichertes Mittelfeld", avoid_relegation: "Klassenerhalt"
        })[key] || "Mittelfeld";
    },

    /**
     * Ein Trainerangebot annehmen und bei einem neuen Verein anfangen.
     * Hieß früher wie das Annehmen eines Transferangebots - und überschrieb
     * es: Ein Angebot für einen eigenen Spieler ließ sich nicht annehmen.
     */
    nimmTrainerAngebotAn(angebot) {
        const state = this.app.state;
        const career = this.getCareerEngine();
        if (!career) return;

        const res = career.uebernimm(state, angebot.clubId);
        if (!res.erfolg) {
            this.showToast(res.grund || "Der Wechsel hat nicht geklappt.", "error");
            return;
        }

        this._entlassungOffen = false;
        const modal = document.getElementById("modalDismissal");
        if (modal) modal.style.display = "none";

        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage(null, true);
        this.showToast(`🤝 Sie übernehmen ${res.club.name}.`, "success");
        this.renderHeader();
        this.switchTab("dashboard");
    },

    /** Die Laufbahn beenden - und das Zeugnis zeigen */
    beendeLaufbahn() {
        const state = this.app.state;
        const career = this.getCareerEngine();
        if (!career) return;

        const zeugnis = career.beendeKarriere(state);
        this._entlassungOffen = false;

        const modal = document.getElementById("modalDismissal");
        if (modal) modal.style.display = "none";
        if (typeof state.saveToLocalStorage === "function") state.saveToLocalStorage(null, true);

        this.zeigeZeugnis(zeugnis);
    },

    zeigeZeugnis(zeugnis) {
        const modal = document.getElementById("modalCareerEnd");
        if (!modal) return;

        DOM.setText("careerEndSubtitle",
            `${zeugnis.name} · ${zeugnis.stationen.length} Station${zeugnis.stationen.length === 1 ? "" : "en"} · `
            + `${zeugnis.titel.length} Titel · ${zeugnis.siegquote} % Siege`);

        const details = document.getElementById("careerEndDetails");
        if (details) {
            const stationen = zeugnis.stationen.map(s => `
                <div class="career-station">
                    <div class="career-station-club">${this.escapeHtml(s.clubName)}</div>
                    <div class="career-station-time">
                        Saison ${s.vonSaison}${s.bisSaison && s.bisSaison !== s.vonSaison ? `–${s.bisSaison}` : ""}
                        · ${s.spiele} Spiele, ${s.siege} S / ${s.unentschieden} U / ${s.niederlagen} N
                        ${s.ende === "entlassen" ? " · entlassen" : ""}
                    </div>
                </div>
            `).join("");

            const titel = zeugnis.titel.length
                ? `<h4 style="margin-top:14px;">Titel</h4>`
                    + zeugnis.titel.map(t =>
                        `<div class="career-title-row">🏆 ${this.escapeHtml(t.wettbewerb)} · Saison ${t.saison} · ${this.escapeHtml(t.clubName)}</div>`).join("")
                : `<p class="text-muted" style="margin-top:14px;">Ohne Titel - aber nicht ohne Geschichten.</p>`;

            details.innerHTML = `
                <div class="dash-card" style="text-align:left;">
                    <h4>Stationen</h4>
                    ${stationen || '<p class="text-muted">Keine Stationen verzeichnet.</p>'}
                    ${titel}
                    <p class="text-muted" style="margin-top:14px;">
                        Gesamt: ${zeugnis.gesamt.spiele} Spiele ·
                        ${zeugnis.gesamt.siege} Siege ·
                        ${zeugnis.entlassungen} Entlassung${zeugnis.entlassungen === 1 ? "" : "en"}
                    </p>
                </div>
            `;
        }

        const btn = document.getElementById("btnCareerEndNewGame");
        if (btn) {
            btn.onclick = () => {
                modal.style.display = "none";
                this.showStartScreen();
            };
        }

        modal.style.display = "flex";
    },
});
