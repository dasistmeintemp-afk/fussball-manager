/**
 * Einstieg: ein geführter Start für neue Karrieren.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper).
 *
 * Das Spiel hat ein Dutzend Bereiche, und wer zum ersten Mal einen Verein
 * übernimmt, weiß nicht, wo er anfangen soll. Drei Hilfen, alle abschaltbar:
 *  - Erste Schritte: eine Karte auf der Übersicht führt durch die wichtigsten
 *    Bereiche bis zum ersten Pflichtspiel. Ein Schritt ist erledigt, wenn man
 *    ihn getan hat - nicht, wenn man ihn abhakt.
 *  - Erklärungen: Beim ersten Besuch eines Bereichs erklärt ein Kasten oben,
 *    was man dort tun kann. "Verstanden" blendet ihn für diese Karriere aus.
 *  - Kurzanleitung und Begriffe: was Sterne, Moral, Spielschärfe und
 *    Vertrautheit bedeuten - vom Startbildschirm, aus jedem Kasten und aus
 *    den Einstellungen erreichbar.
 *
 * Der Stand liegt im Spielstand (state.einstieg) und reist mit der Karriere.
 */
"use strict";

const EINSTIEG_SCHRITTE = [
    {
        id: "kader", tab: "squad", titel: "Den Kader kennenlernen",
        text: "Wer trägt die Mannschaft, wer ist verletzt, wessen Vertrag läuft aus? Ein Klick auf einen Spieler öffnet seine Akte."
    },
    {
        id: "taktik", tab: "tactics", titel: "Taktik und Startelf prüfen",
        text: "Formation, Rollen und Anweisungen bestimmen, wie gespielt wird. „Beste 11“ stellt die stärkste Elf auf."
    },
    {
        id: "vorbereitung", tab: "preseason", titel: "Die Vorbereitung planen",
        text: "Vor dem ersten Spieltag: Trainerstab besetzen, Testspiele vereinbaren, den Etat verteilen.",
        nurWenn: (state) => !!(state.preseason && state.preseason.aktiv)
    },
    {
        id: "training", tab: "training", titel: "Ins Training schauen",
        text: "Der Trainerstab plant die Woche. Du setzt Schwerpunkte, legst ein Veto ein und siehst, wer zu viel Last trägt."
    },
    {
        id: "transfers", tab: "transfers", titel: "Den Transfermarkt ansehen",
        text: "Erst scouten, dann bieten: Je mehr dein Scout über einen Spieler weiß, desto genauer sind seine Werte."
    },
    {
        id: "tag", titel: "Den ersten Tag spielen",
        text: "„Weiter“ spielt einen Tag, „Bis zum Spieltag“ springt zum nächsten Spiel. Was passiert ist, steht im Tagesbericht.",
        erledigt: (state, e) => (state.currentDayIndex || 0) > (e.startTag || 0)
    },
    {
        id: "spiel", titel: "Das erste Pflichtspiel bestreiten",
        text: "Live in 2D oder 3D mit Wechseln und Zurufen von der Seitenlinie – oder als Sofort-Ergebnis.",
        erledigt: (state) => (state.schedule || []).some(r => (r.matches || []).some(m => m.played
            && (m.homeClubId === state.userClubId || m.awayClubId === state.userClubId)))
    }
];

/** Was jeder Bereich kann - ein Satz zum Zweck, dann das Wichtigste */
const EINSTIEG_ERKLAERUNGEN = {
    dashboard: {
        titel: "Die Übersicht",
        punkte: [
            "Oben steht, was als Nächstes kommt, darunter, was heute eine Entscheidung braucht – ein Klick springt in den zuständigen Bereich.",
            "„Weiter“ spielt einen Tag. An Spieltagen geht es von hier ins Spiel.",
            "Vorstand, Fans und Presse: Die Balken zeigen, wie sicher dein Stuhl ist."
        ]
    },
    club: {
        titel: "Der Verein",
        punkte: [
            "Stadion, Trainingsgelände, Akademie und Medizin lassen sich ausbauen – das kostet Geld und Zeit, wirkt aber über Jahre.",
            "Der Trainerstab entscheidet mit: Ein guter Co-Trainer gibt bessere Hinweise, ein guter Chefscout genauere Berichte.",
            "In der Jugendakademie wachsen eigene Talente heran."
        ]
    },
    squad: {
        titel: "Der Kader",
        punkte: [
            "Die Sterne zeigen Stärke (gefüllt) und Potenzial (hell) – gemessen an deiner Liga.",
            "Ein Klick öffnet die Akte: Werte, Vertrag, Entwicklung, Gespräche, Leihe oder Verkauf.",
            "Achte auf Moral und Kondition: Unzufriedene und Müde spielen schlechter."
        ]
    },
    tactics: {
        titel: "Taktik",
        punkte: [
            "Die Formation stellt die Elf auf, Rollen sagen jedem Spieler, was er tun soll, Anweisungen gelten für die ganze Mannschaft.",
            "Neue Systeme brauchen Zeit: Die Vertrautheit wächst mit Training und Spielen.",
            "„Beste 11“ wählt die stärkste Aufstellung für die gewählte Formation."
        ]
    },
    fixtures: {
        titel: "Wettbewerbe und Spielplan",
        punkte: [
            "Tabellen und Spielpläne aller Ligen der Welt, dazu Pokal und Europapokal.",
            "Ein Klick auf einen Verein zeigt seinen Kader und seine Stärke."
        ]
    },
    calendar: {
        titel: "Der Kalender",
        punkte: [
            "Jeder Tag hat seinen Inhalt: Training, Spiel, Länderspielpause, Transferfenster.",
            "Termine wie Testspiele oder Bauabschlüsse stehen hier, bevor sie kommen."
        ]
    },
    transfers: {
        titel: "Transfers",
        punkte: [
            "Gesucht wird nach Position, Stärke und Preis; Spieler, die zu teuer oder zu gut für deine Liga sind, wollen oft nicht kommen.",
            "Scouten kostet Tage, macht die Werte aber genau. Ohne Bericht sind es Schätzungen.",
            "Ablösefreie Spieler kosten keine Ablöse – findet einer eine Saison lang keinen Verein, hört er auf."
        ]
    },
    preseason: {
        titel: "Die Vorbereitung",
        punkte: [
            "Besetze die offenen Posten im Trainerstab, sonst arbeiten Aushilfen.",
            "Testspiele bringen Spielpraxis und Vertrautheit, Turniere etwas Geld.",
            "Der Etat für Gehälter und Transfers wird hier verteilt."
        ]
    },
    training: {
        titel: "Training",
        punkte: [
            "Der Trainerstab plant die Woche; du kannst Schwerpunkte setzen und Einheiten ablehnen.",
            "Hohe Last bringt mehr Fortschritt, aber auch mehr Verletzungen.",
            "Entwicklungspläne fördern einzelne Spieler gezielt – auch auf einer neuen Position."
        ]
    },
    finances: {
        titel: "Finanzen",
        punkte: [
            "Einnahmen aus Zuschauern, Sponsoren und Prämien, Ausgaben für Gehälter, Stab und Unterhalt.",
            "Rutscht der Kontostand unter die Schuldengrenze, wird der Vorstand ungemütlich."
        ]
    },
    stats: {
        titel: "Statistiken",
        punkte: [
            "Torschützen, Noten und Bilanzen – für deine Mannschaft und die Liga.",
            "Die Spielanalyse zu jedem eigenen Spiel liegt im Spielbericht."
        ]
    },
    inbox: {
        titel: "Das Postfach",
        punkte: [
            "Vorstand, Spieler, Berater und Presse schreiben hierher.",
            "Manche Nachrichten verlangen eine Antwort – sie stehen auch auf der Übersicht."
        ]
    }
};

/** Die Begriffe, die das Spiel überall verwendet */
const EINSTIEG_BEGRIFFE = [
    ["Sterne", "Stärke (gefüllt) und Potenzial (hell) eines Spielers, gemessen an deiner Liga. Fünf Sterne heißt: einer der Besten auf dieser Ebene."],
    ["Potenzial", "Wie gut ein Spieler werden kann. Junge Spieler wachsen schnell, ab Mitte zwanzig kaum noch, ab dreißig geht es abwärts."],
    ["Moral", "Wie zufrieden ein Spieler ist. Siege, Einsatzzeit und Gespräche heben sie, Bankplätze und gebrochene Versprechen senken sie."],
    ["Form", "Die Noten der letzten Spiele. Wer gut gespielt hat, spielt meist wieder gut."],
    ["Kondition", "Wie frisch ein Spieler ist. Spiele und hartes Training kosten Kraft, Pausen geben sie zurück."],
    ["Spielschärfe", "Rhythmus aus echten Spielen. Wer lange nicht gespielt hat oder verletzt war, braucht ein paar Einsätze."],
    ["Vertrautheit", "Wie gut die Mannschaft eine Formation und Spielweise beherrscht. Sie wächst mit Training und Spielen."],
    ["Rolle", "Was ein Spieler auf seiner Position tut, mit und gegen den Ball – etwa Spielmacher, Zielspieler oder Ballverteiler."],
    ["Scoutwissen", "Wie genau du einen Spieler kennst. Unter hundert Prozent sind Werte und Marktwert Schätzungen."],
    ["Vorstandsvertrauen", "Wie zufrieden der Vorstand mit dir ist. Sinkt es zu weit, folgen Warnung, Ultimatum und Entlassung."],
    ["Ruf", "Wie bekannt ein Verein oder Trainer ist. Ein großer Ruf lockt bessere Spieler und bessere Angebote."],
    ["xG", "Erwartete Tore: wie viele Tore die Chancen eines Spiels im Schnitt bringen. Mehr xG als Tore heißt: Pech oder schwache Abschlüsse."]
];

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /** Der Einstiegsstand der laufenden Karriere (oder null) */
    einstieg() {
        const state = this.app?.state;
        return state && state.einstieg && typeof state.einstieg === "object" ? state.einstieg : null;
    },

    /** Die Schritte, die in dieser Karriere gelten, mit erledigt-Kennzeichen */
    einstiegSchritte(state = this.app?.state) {
        const e = state?.einstieg;
        if (!e) return [];
        return EINSTIEG_SCHRITTE
            .filter(s => !s.nurWenn || s.nurWenn(state) || e.schritte?.[s.id])
            .map(s => ({
                id: s.id, tab: s.tab || null, titel: s.titel, text: s.text,
                erledigt: !!(e.schritte?.[s.id] || (s.erledigt && s.erledigt(state, e)))
            }));
    },

    /** Ein Bereich wurde besucht: zugehöriger Schritt erledigt */
    einstiegMerkeTab(tabId) {
        const e = this.einstieg();
        if (!e) return;
        const schritt = EINSTIEG_SCHRITTE.find(s => s.tab === tabId);
        if (!schritt || e.schritte?.[schritt.id]) return;
        e.schritte = e.schritte || {};
        e.schritte[schritt.id] = true;
        this._einstiegSpeichern();
    },

    _einstiegSpeichern() {
        const state = this.app?.state;
        if (state && typeof state.saveToLocalStorage === "function") state.saveToLocalStorage();
    },

    /** Die Karte "Erste Schritte" auf der Übersicht */
    renderEinstiegKarte() {
        const box = document.getElementById("dashEinstieg");
        if (!box) return;
        const e = this.einstieg();
        const schritte = this.einstiegSchritte();
        if (!e || e.karteAus || schritte.length === 0) {
            box.innerHTML = "";
            box.style.display = "none";
            return;
        }
        const esc = (t) => this.escapeHtml(t);
        const fertig = schritte.filter(s => s.erledigt).length;
        const alle = fertig === schritte.length;
        const naechster = schritte.find(s => !s.erledigt);
        box.style.display = "";
        box.innerHTML = `
            <div class="dash-card einstieg-karte">
                <div class="einstieg-kopf">
                    <div>
                        <h3>${alle ? "Geschafft – du kennst dich aus" : "Erste Schritte"}</h3>
                        <p class="einstieg-unter">${alle
                            ? "Alle Bereiche gesehen, das erste Spiel bestritten. Die Erklärungen lassen sich in den Einstellungen abschalten."
                            : `${fertig} von ${schritte.length} erledigt · ein Schritt ist erledigt, sobald du ihn getan hast`}</p>
                    </div>
                    <button type="button" class="btn btn-link btn-sm" id="btnEinstiegAus">${alle ? "Schließen" : "Ausblenden"}</button>
                </div>
                <div class="einstieg-balken" role="progressbar" aria-valuemin="0" aria-valuemax="${schritte.length}" aria-valuenow="${fertig}"><i style="width:${Math.round(fertig / schritte.length * 100)}%"></i></div>
                ${alle ? "" : `<ol class="einstieg-liste">
                    ${schritte.map(s => `
                        <li class="einstieg-schritt${s.erledigt ? " erledigt" : ""}${s === naechster ? " naechster" : ""}" data-schritt="${esc(s.id)}">
                            <span class="einstieg-haken" aria-hidden="true">${s.erledigt ? `<svg class="ico"><use href="#i-check"/></svg>` : ""}</span>
                            <span class="einstieg-text"><strong>${esc(s.titel)}</strong><span>${esc(s.text)}</span></span>
                            ${s.tab && !s.erledigt ? `<button type="button" class="btn btn-secondary btn-sm" data-einstieg-tab="${esc(s.tab)}">Öffnen</button>` : ""}
                        </li>`).join("")}
                </ol>`}
            </div>`;
        box.querySelector("#btnEinstiegAus")?.addEventListener("click", () => {
            e.karteAus = true;
            this._einstiegSpeichern();
            this.renderEinstiegKarte();
            if (!alle) this.showToast("Die ersten Schritte lassen sich in den Einstellungen wieder einblenden.", "info");
        });
        box.querySelectorAll("[data-einstieg-tab]").forEach(btn => {
            btn.addEventListener("click", () => this.switchTab(btn.dataset.einstiegTab));
        });
    },

    /**
     * Der Erklärkasten oben in einem Bereich - beim ersten Besuch, bis man
     * ihn mit "Verstanden" wegklickt.
     */
    zeigeEinstiegErklaerung(tabId) {
        if (typeof document === "undefined") return;
        const pane = document.getElementById(`pane-${tabId}`);
        if (!pane) return;
        pane.querySelectorAll(":scope > .einstieg-erklaerung").forEach(el => el.remove());
        const e = this.einstieg();
        const inhalt = EINSTIEG_ERKLAERUNGEN[tabId];
        if (!e || e.aus || !inhalt || e.gesehen?.[tabId]) return;

        const esc = (t) => this.escapeHtml(t);
        const kasten = document.createElement("aside");
        kasten.className = "einstieg-erklaerung";
        kasten.setAttribute("role", "note");
        kasten.innerHTML = `
            <div class="einstieg-erklaerung-text">
                <strong>${esc(inhalt.titel)}</strong>
                <ul>${inhalt.punkte.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
            </div>
            <div class="einstieg-erklaerung-knoepfe">
                <button type="button" class="btn btn-primary btn-sm" data-einstieg-ok>Verstanden</button>
                <button type="button" class="btn btn-link btn-sm" data-einstieg-begriffe>Begriffe</button>
            </div>`;
        const kopf = pane.querySelector(":scope > .pane-header");
        if (kopf) kopf.after(kasten);
        else pane.prepend(kasten);
        kasten.querySelector("[data-einstieg-ok]").addEventListener("click", () => {
            e.gesehen = e.gesehen || {};
            e.gesehen[tabId] = true;
            kasten.remove();
            this._einstiegSpeichern();
        });
        kasten.querySelector("[data-einstieg-begriffe]").addEventListener("click", () => this.zeigeKurzanleitung("begriffe"));
    },

    /** Kurzanleitung und Begriffe - im Fenster "Über das Spiel" */
    zeigeKurzanleitung(abschnitt = null) {
        const modal = document.getElementById("modalAboutGame");
        const body = document.getElementById("aboutBody");
        if (!modal || !body) return;
        const esc = (t) => this.escapeHtml(t);
        body.innerHTML = `
            <section class="anleitung-abschnitt">
                <h3>Worum es geht</h3>
                <p>Du übernimmst einen Verein – vom Spitzenklub bis zum Landesligisten – und führst ihn Saison für Saison: Kader, Taktik, Training, Transfers, Finanzen. Gespielt wird Tag für Tag; jedes Spiel lässt sich live verfolgen und von der Seitenlinie lenken. Der Vorstand misst dich an seinem Saisonziel.</p>
            </section>
            <section class="anleitung-abschnitt">
                <h3>Ein Tag im Spiel</h3>
                <ol class="anleitung-liste">
                    <li>Auf der Übersicht steht, was heute ansteht und was eine Entscheidung braucht.</li>
                    <li>Kümmere dich darum – oder überlass es dem Stab: Training und vieles andere läuft auch ohne dich.</li>
                    <li>„Weiter“ spielt den Tag. An Spieltagen bereitest du das Spiel vor, hältst eine Ansprache und spielst live oder sofort.</li>
                </ol>
            </section>
            <section class="anleitung-abschnitt" id="anleitungBegriffe">
                <h3>Begriffe</h3>
                <dl class="anleitung-begriffe">
                    ${EINSTIEG_BEGRIFFE.map(([wort, erklaerung]) => `<dt>${esc(wort)}</dt><dd>${esc(erklaerung)}</dd>`).join("")}
                </dl>
            </section>`;
        modal.style.display = "flex";
        if (abschnitt === "begriffe") {
            const ziel = document.getElementById("anleitungBegriffe");
            if (ziel && typeof ziel.scrollIntoView === "function") ziel.scrollIntoView({ block: "start" });
        }
    },

    /** Einstellungen: Erklärungen ein und aus, alles erneut zeigen */
    renderEinstiegEinstellungen() {
        const box = document.getElementById("settingsEinstieg");
        if (!box || !this.app?.state) return;
        const state = this.app.state;
        const e = this.einstieg();
        const an = !!(e && !e.aus);
        box.innerHTML = `
            <label class="coach-switch einstellung-schalter">
                <input type="checkbox" id="einstiegAn" ${an ? "checked" : ""}>
                <span class="coach-switch-text"><strong>Bereiche erklären sich</strong><br><span class="coach-muted">Beim ersten Besuch steht oben ein Kasten mit dem Wichtigsten.</span></span>
            </label>
            <div class="btn-group-column">
                <button type="button" class="btn btn-secondary" id="btnEinstiegNeu">Alle Erklärungen erneut zeigen</button>
                <button type="button" class="btn btn-secondary" id="btnEinstiegKarte">„Erste Schritte“ auf der Übersicht zeigen</button>
                <button type="button" class="btn btn-secondary" id="btnEinstiegBegriffe">Kurzanleitung und Begriffe</button>
            </div>`;
        const sorge = () => {
            if (!state.einstieg) state.einstieg = GameState.neuerEinstieg(state);
            return state.einstieg;
        };
        box.querySelector("#einstiegAn").addEventListener("change", (ev) => {
            sorge().aus = !ev.target.checked;
            this._einstiegSpeichern();
            this.zeigeEinstiegErklaerung("settings");
        });
        box.querySelector("#btnEinstiegNeu").addEventListener("click", () => {
            const x = sorge();
            x.gesehen = {};
            x.aus = false;
            this._einstiegSpeichern();
            this.renderEinstiegEinstellungen();
            this.showToast("Jeder Bereich erklärt sich beim nächsten Besuch wieder.", "success");
        });
        box.querySelector("#btnEinstiegKarte").addEventListener("click", () => {
            sorge().karteAus = false;
            this._einstiegSpeichern();
            this.switchTab("dashboard");
        });
        box.querySelector("#btnEinstiegBegriffe").addEventListener("click", () => this.zeigeKurzanleitung());
    }
});

if (typeof module !== "undefined" && module.exports) {
    module.exports = { EINSTIEG_SCHRITTE, EINSTIEG_ERKLAERUNGEN, EINSTIEG_BEGRIFFE };
}
