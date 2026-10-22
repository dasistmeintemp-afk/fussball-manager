/**
 * NewsEngine - Zentrales Nachrichtensystem und Postfachverwaltung
 */

const NewsEngine = {
    /**
     * Normalisiert eine Nachricht, um Abwärtskompatibilität und saubere Felder zu garantieren
     */
    normalizeMessage(message) {
        if (!message || typeof message !== "object") return null;

        if (!message.id) {
            message.id = "msg_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
        } else {
            message.id = String(message.id);
        }

        if (!message.subject) {
            message.subject = message.title || "Mitteilung";
        }
        if (!message.title) {
            message.title = message.subject;
        }

        if (!message.body) {
            message.body = message.text || "";
        }
        if (!message.text) {
            message.text = message.body;
        }

        if (typeof message.read !== "boolean") {
            message.read = false;
        }

        if (!message.sender) message.sender = "Geschäftsstelle";
        if (!message.type) message.type = "general";
        if (!message.priority) message.priority = "normal";
        if (!message.date) message.date = "Aktuell";

        if (typeof message.archived !== "boolean") message.archived = false;
        if (typeof message.pinned !== "boolean") message.pinned = false;

        return message;
    },

    /**
     * Normalisiert alle Nachrichten im Postfach
     */
    normalizeAllMessages(state) {
        if (!state || !Array.isArray(state.inbox)) return;
        state.inbox = state.inbox.map(m => this.normalizeMessage(m)).filter(Boolean);
    },

    /**
     * Erstellt eine neue Nachricht und fügt sie dem Postfach hinzu
     */
    addMessage(state, type, payload = {}) {
        if (!state) return null;
        if (!Array.isArray(state.inbox)) state.inbox = [];

        const msgId = "msg_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
        const matchday = state.currentMatchday || 1;
        const season = state.seasonYear || 1;
        const dateStr = state.currentDate 
            ? `${state.currentDate} (S${season} ST${matchday})` 
            : (payload.date || `Saison ${season}, Spieltag ${matchday}`);

        const subject = payload.subject || payload.title || "Mitteilung";
        const body = payload.body || payload.text || "";

        const message = {
            id: String(msgId),
            type: type || "general",
            subject: subject,
            title: subject,
            body: body,
            text: body,
            sender: payload.sender || "Geschäftsstelle",
            date: dateStr,
            matchday: matchday,
            season: season,
            read: false,
            priority: payload.priority || "normal", // low, normal, high
            archived: false,
            pinned: Boolean(payload.pinned),
            relatedEntity: payload.relatedEntity || null
        };

        // Nachricht oben anfügen (neueste zuerst)
        state.inbox.unshift(message);

        // Maximale Postfachgröße beschränken
        if (state.inbox.length > 150) {
            state.inbox = state.inbox.slice(0, 150);
        }

        return message;
    },

    /**
     * Gefilterte und durchsuchte Nachrichten abrufen
     */
    getFilteredMessages(state, filter = "all", search = "") {
        if (!state || !Array.isArray(state.inbox)) return [];
        this.normalizeAllMessages(state);

        let list = [...state.inbox];

        // 1. Filter anwenden - nach Abteilung (kategorie), damit jede Art
        // irgendwo auftaucht. Vorher fehlten etwa Vorberichte unter "Spiel"
        // und Verletzungen unter "Training".
        const nach = (...keys) => list.filter(m => keys.includes(this.kategorie(m).key));
        if (filter === "unread") {
            list = list.filter(m => !m.read);
        } else if (filter === "antwort") {
            // Was auf eine Antwort wartet
            list = list.filter(m => ["dringend", "antwort"].includes(this.dringlichkeit(state, m)?.stufe));
        } else if (filter === "board") {
            list = nach("vorstand");
        } else if (filter === "match") {
            list = nach("spiel", "presse");
        } else if (filter === "transfer") {
            list = nach("transfer", "sportdirektor", "vertrag", "spieler");
        } else if (filter === "training") {
            list = nach("training", "medizin");
        } else if (filter === "youth") {
            list = nach("jugend");
        } else if (filter === "scouting") {
            list = nach("scouting", "sportdirektor");
        } else if (filter === "finance") {
            list = nach("finanzen");
        }

        // 2. Suche anwenden
        if (search && search.trim()) {
            const q = search.toLowerCase().trim();
            list = list.filter(m => 
                (m.subject && m.subject.toLowerCase().includes(q)) ||
                (m.body && m.body.toLowerCase().includes(q)) ||
                (m.sender && m.sender.toLowerCase().includes(q))
            );
        }

        // Pinned messages nach ganz oben
        list.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return 0;
        });

        return list;
    },

    /**
     * Spieltagsvorschau erstellen
     */
    createMatchPreview(state, match) {
        const homeClub = state.clubs.find(c => c.id === match.homeClubId);
        const awayClub = state.clubs.find(c => c.id === match.awayClubId);
        const isHome = match.homeClubId === state.userClubId;
        const opponent = isHome ? awayClub : homeClub;

        return this.addMessage(state, "match_preview", {
            subject: `Spieltagsvorschau: Gegen ${opponent ? opponent.name : "Gegner"}`,
            sender: "Chefanalyst",
            body: `Am ${state.currentMatchday}. Spieltag treffen wir ${isHome ? 'zu Hause in der ' + homeClub?.stadium : 'auswärts'} auf ${opponent?.name}. Wir sollten unsere Taktik entsprechend ausrichten.`,
            priority: "normal"
        });
    },

    /**
     * Spielbericht nach dem Spiel
     */
    createMatchReport(state, match) {
        const homeClub = state.clubs.find(c => c.id === match.homeClubId);
        const awayClub = state.clubs.find(c => c.id === match.awayClubId);
        const isUserHome = match.homeClubId === state.userClubId;
        const myGoals = isUserHome ? match.homeGoals : match.awayGoals;
        const oppGoals = isUserHome ? match.awayGoals : match.homeGoals;
        const opponent = isUserHome ? awayClub : homeClub;

        let verdict = "Unentschieden";
        if (myGoals > oppGoals) verdict = "Sieg";
        if (myGoals < oppGoals) verdict = "Niederlage";

        const textSummary = match.summaryText || `Endstand im Duell mit ${opponent ? opponent.name : 'Gegner'}: ${match.homeGoals}:${match.awayGoals}.`;

        return this.addMessage(state, "match_report", {
            subject: `Spielbericht: ${myGoals}:${oppGoals} (${verdict}) gegen ${opponent ? opponent.name : "Gegner"}`,
            sender: "Co-Trainer",
            body: `${textSummary}\n\nStatistiken:\n• Ballbesitz: ${match.stats?.possession ? match.stats.possession[0] + '% zu ' + match.stats.possession[1] + '%' : '-'}\n• Schüsse: ${match.stats?.shots ? match.stats.shots[0] + ' : ' + match.stats.shots[1] : '-'}\n• Expected Goals (xG): ${match.stats?.xG ? match.stats.xG[0] + ' zu ' + match.stats.xG[1] : '-'}\n• Mann des Spiels: ${match.stats?.motm || 'Keine Angabe'}`,
            priority: verdict === "Sieg" ? "normal" : "high"
        });
    },

    /**
     * Transfermeldung erstellen
     */
    createTransferNews(state, transfer) {
        return this.addMessage(state, "transfer_done", {
            subject: `Transfer abgeschlossen: ${transfer.playerName}`,
            sender: "Sportdirektor",
            body: `${transfer.playerName} wechselt von ${transfer.fromClubName} zu ${transfer.toClubName} für eine Ablösesumme von ${transfer.feeFormatted || transfer.fee + ' €'}.`,
            priority: "high"
        });
    },

    /**
     * Verletzungsmeldung
     */
    createInjuryNews(state, player, weeks, typeName = "Verletzung") {
        return this.addMessage(state, "injury", {
            subject: `Verletzung: ${player.name} fällt aus`,
            sender: "Mannschaftsarzt",
            body: `Schlechte Nachrichten: ${player.name} hat sich eine ${typeName} zugezogen und wird für voraussichtlich ${weeks} Wochen ausfallen.`,
            priority: "high",
            relatedEntity: { playerId: player.id }
        });
    },

    /**
     * Vorstandsmeldung
     */
    createBoardMessage(state, payload) {
        return this.addMessage(state, "board_message", {
            subject: payload.subject || payload.title || "Vorstandsbewertung",
            sender: payload.sender || "Vorstandsvorsitzender",
            body: payload.body || payload.text || "Der Vorstand hat Ihre aktuellen Leistungen bewertet.",
            priority: payload.priority || "normal"
        });
    },

    /**
     * Trainingsbericht
     */
    createTrainingReport(state, payload) {
        return this.addMessage(state, "training_report", {
            subject: payload.subject || payload.title || "Wöchentlicher Trainingsbericht",
            sender: payload.sender || "Fitnesstrainer",
            body: payload.body || payload.text || "Die Mannschaft hat die Trainingseinheiten der Woche absolviert.",
            priority: "low"
        });
    },

    /**
     * Markiert eine Nachricht als gelesen
     */
    markAsRead(state, messageId) {
        if (!state || !Array.isArray(state.inbox)) return;
        const strId = String(messageId);
        const msg = state.inbox.find(m => String(m.id) === strId);
        if (msg) {
            msg.read = true;
            return msg;
        }
        return null;
    },

    /**
     * Markiert alle Nachrichten als gelesen
     */
    markAllAsRead(state) {
        if (!state || !Array.isArray(state.inbox)) return;
        state.inbox.forEach(m => m.read = true);
    },

    /**
     * Gibt die Anzahl ungelesener Nachrichten zurück
     */
    getUnreadCount(state) {
        if (!state || !Array.isArray(state.inbox)) return 0;
        return state.inbox.filter(m => !m.read).length;
    },

    // --------------------------------------------------- Die Post lebt

    /**
     * Wie im Vorbild ist die Post mehr als Text: Jede Nachricht gehört zu
     * einer Abteilung mit eigenem Zeichen, eine Anfrage, auf die man
     * antworten muss, trägt ihre Frist, Berichte hängen als Anhang an, und
     * wer erwähnt wird, lässt sich anklicken. Bisher erkannte das Postfach
     * nur gut die Hälfte der Nachrichtenarten - Vorbericht, Presse,
     * Genesung, Wettbewerb oder Chronik standen alle als "Info" mit
     * demselben Briefsymbol da.
     *
     * Die Funktionen hier lesen nur den Spielstand. Was sie finden, zeichnet
     * das Postfach (uiPostfach.js).
     */
    KATEGORIEN: {
        transfer: { name: "Transfer", symbol: "i-transfer", typen: ["transfer_offer", "transfer_done", "transfer_window", "transfer", "leihe", "contract_news"] },
        sportdirektor: { name: "Sportdirektor", symbol: "i-target", typen: ["sportdirektor"] },
        vertrag: { name: "Verträge", symbol: "i-doc", typen: ["contract", "contract_expiring"] },
        spieler: { name: "Spieler", symbol: "i-chat", typen: ["player_talk"] },
        medizin: { name: "Medizin", symbol: "i-medical", typen: ["injury", "injury_healed"] },
        spiel: { name: "Spiel", symbol: "i-ball", typen: ["preview", "match_preview", "match_report", "opponent_analysis", "competition", "cup", "continental", "friendly", "matchday"] },
        presse: { name: "Presse", symbol: "i-mic", typen: ["news"] },
        vorstand: { name: "Vorstand", symbol: "i-briefcase", typen: ["board", "board_message", "welcome", "season_end", "season_change", "career"] },
        jugend: { name: "Nachwuchs", symbol: "i-leaf", typen: ["youth", "youth_prospect", "youth_promotion", "fremdtalent"] },
        training: { name: "Training", symbol: "i-dumbbell", typen: ["training_report", "development"] },
        scouting: { name: "Scouting", symbol: "i-search", typen: ["scouting", "scout_report"] },
        finanzen: { name: "Finanzen", symbol: "i-wallet", typen: ["finance", "finance_warning", "sponsor", "sponsor_event"] },
        verein: { name: "Verein", symbol: "i-shield", typen: ["club", "facility", "chronik", "preseason", "info", "retirement", "suspension_cleared", "general"] }
    },

    /** Die Abteilung einer Nachricht: { key, name, symbol } */
    kategorie(msg) {
        if (!this._typKategorie) {
            this._typKategorie = new Map();
            Object.entries(this.KATEGORIEN).forEach(([key, k]) => k.typen.forEach(t => this._typKategorie.set(t, key)));
        }
        const key = this._typKategorie.get(msg?.type) || "verein";
        return { key, name: this.KATEGORIEN[key].name, symbol: this.KATEGORIEN[key].symbol };
    },

    /** Die Vorschauzeile in der Liste: der Anfang des Textes, ohne Zeichen und Umbrüche */
    vorschau(msg, laenge = 90) {
        const text = String(msg?.body || msg?.text || "")
            .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
            .replace(/\s+/g, " ").trim();
        return text.length > laenge ? text.slice(0, laenge - 1).replace(/\s+\S*$/, "") + " …" : text;
    },

    /** Alle Namen, die ein Text verlinken darf: eigene Spieler zuerst, dann die der eigenen Liga, dazu die Vereine */
    verweisNamen(state) {
        const spieler = new Map(), vereine = new Map();
        if (!state) return { spieler, vereine };
        const eigen = state.userClubId;
        const club = (state.clubs || []).find(c => c.id === eigen);
        const liga = new Set((state.clubs || []).filter(c => club && c.leagueId === club.leagueId).map(c => c.id));
        const nimm = (p) => { if (p && p.name && !spieler.has(p.name)) spieler.set(p.name, p.id); };
        (state.players || []).filter(p => p.clubId === eigen || p.leihe?.stammvereinId === eigen).forEach(nimm);
        (state.players || []).filter(p => liga.has(p.clubId)).forEach(nimm);
        (state.clubs || []).filter(c => liga.has(c.id)).forEach(c => { if (c.name) vereine.set(c.name, c.id); });
        return { spieler, vereine };
    },

    /** Der Spieler, um den es geht: aus dem Bezug, sonst der erste eigene im Betreff */
    spielerZu(state, msg) {
        if (!state || !msg) return null;
        const id = msg.relatedEntity?.type === "player" ? msg.relatedEntity.id : msg.relatedEntity?.playerId;
        if (id !== undefined && id !== null) {
            const p = (state.players || []).find(x => String(x.id) === String(id));
            if (p) return p;
        }
        const betreff = `${msg.subject || msg.title || ""} ${msg.sender || ""}`;
        const eigene = (state.players || []).filter(p => p.clubId === state.userClubId && p.name && betreff.includes(p.name));
        // Der längste Name gewinnt: "Leon Müller" vor "Leon Müll"
        return eigene.sort((a, b) => b.name.length - a.name.length)[0] || null;
    },

    /** Der Verein, um den es geht: der Absender oder einer im Betreff */
    vereinZu(state, msg) {
        if (!state || !msg) return null;
        const clubs = state.clubs || [];
        const absender = clubs.find(c => c.name === msg.sender);
        if (absender) return absender;
        const betreff = String(msg.subject || msg.title || "");
        return clubs.filter(c => c.id !== state.userClubId && c.name && betreff.includes(c.name))
            .sort((a, b) => b.name.length - a.name.length)[0] || null;
    },

    /** Das Transferangebot zu einer Nachricht - auch bei Nachrichten aus älteren Spielständen ohne Kennung */
    angebotZu(state, msg) {
        if (!state || !msg || msg.type !== "transfer_offer") return null;
        const offers = state.transferMarket?.offers || [];
        if (msg.offerId !== undefined) return offers.find(o => String(o.id) === String(msg.offerId)) || null;
        const betreff = String(msg.subject || "");
        return offers.filter(o => o.playerName && betreff.includes(o.playerName) && (o.fromClubName || o.buyerClubName) === msg.sender)
            .sort((a, b) => (b.eingang || 0) - (a.eingang || 0))[0] || null;
    },

    /** Die Werbung eines Vereins um ein Talent der Akademie */
    anfrageZu(state, msg) {
        if (!state || !msg || msg.type !== "youth") return null;
        const anfragen = state.youthAcademy?.anfragen || [];
        if (msg.anfrageId) return anfragen.find(a => a.id === msg.anfrageId) || null;
        const betreff = String(msg.subject || "");
        return anfragen.find(a => a.talentName && a.clubName && betreff.includes(a.talentName) && betreff.includes(a.clubName)) || null;
    },

    /**
     * Muss man antworten - und bis wann? { stufe, text, rest } oder null.
     * stufe: "dringend" (Frist in höchstens zwei Tagen), "antwort" (es wird
     * eine Antwort erwartet), "wichtig" oder "erledigt" (die Sache ist
     * entschieden - auch das steht an der Nachricht).
     */
    ERLEDIGT: { accepted: "Angenommen", rejected: "Abgelehnt", expired: "Verfallen", withdrawn: "Zurückgezogen" },
    dringlichkeit(state, msg) {
        if (!state || !msg) return null;
        const heute = state.currentDayIndex || 0;
        // "bis 25.08. · noch 4 Tage" - das Datum aus dem Kalender
        const frist = (bisTag) => {
            const rest = Math.max(0, bisTag - heute);
            const datum = (state.calendar || [])[bisTag]?.date;
            return {
                stufe: rest <= 2 ? "dringend" : "antwort",
                text: (datum ? `bis ${String(datum).slice(0, 6)} · ` : "") + (rest <= 0 ? "läuft heute ab" : `noch ${rest} Tag${rest === 1 ? "" : "e"}`),
                rest
            };
        };
        const angebot = this.angebotZu(state, msg);
        if (angebot) {
            if (angebot.status === "pending" && typeof angebot.frist === "number") return frist(angebot.frist);
            if (angebot.status !== "pending") return { stufe: "erledigt", text: this.ERLEDIGT[angebot.status] || "Erledigt" };
        }
        const anfrage = this.anfrageZu(state, msg);
        if (anfrage) {
            if (anfrage.status === "offen") return frist((anfrage.bis || 0) - (state.seasonYear || 1) * 1000);
            return { stufe: "erledigt", text: anfrage.status === "gewechselt" ? "Gewechselt" : "Geblieben" };
        }
        const p = this.spielerZu(state, msg);
        if (msg.type === "player_talk" && p && p.clubId === state.userClubId) {
            if (p.wechselwunsch && !p.wechselwunsch.akzeptiert) return { stufe: "antwort", text: "Wartet auf Antwort" };
            if (p.gespraechswunsch) return { stufe: "antwort", text: "Will ein Gespräch" };
        }
        if (msg.type === "contract_expiring" && p && p.clubId === state.userClubId && (p.contractYears || 0) <= 1 && !p.vorvertrag) {
            return { stufe: "antwort", text: "Entscheidung offen" };
        }
        if (msg.type === "injury" && p && (p.injuredWeeks || 0) > 0) return { stufe: "wichtig", text: `Fällt aus · ${p.injuredWeeks} Wo.` };
        if (msg.priority === "high") return { stufe: "wichtig", text: "Wichtig" };
        return null;
    },

    /**
     * Was an einer Nachricht hängt: [{ art, titel, offen }]. Den Inhalt
     * zeichnet das Postfach nach der Art - aus dem Spielstand von heute.
     * offen: gleich aufgeklappt (der Bericht ist die Nachricht).
     */
    anhaenge(state, msg) {
        if (!state || !msg) return [];
        const liste = [];
        const p = this.spielerZu(state, msg);
        const angebot = this.angebotZu(state, msg);
        if (angebot) liste.push({ art: "angebot", titel: "Angebot", offen: angebot.status === "pending" });
        if (msg.type === "injury" && p) liste.push({ art: "befund", titel: "Ärztlicher Befund", offen: false });
        if ((msg.type === "scouting" || msg.type === "scout_report") && p
            && (state.scouting?.reports || []).some(r => String(r.playerId) === String(p.id))) liste.push({ art: "scoutbericht", titel: "Scoutbericht", offen: true });
        if (msg.type === "development" && msg.entwicklung) liste.push({ art: "entwicklung", titel: "Entwicklungsbericht", offen: true });
        if (msg.type === "sportdirektor" && Array.isArray(msg.vorschlaege) && msg.vorschlaege.length) liste.push({ art: "kandidaten", titel: "Kandidatenliste", offen: true });
        if (msg.type === "preview" && this.vereinZu(state, msg)) liste.push({ art: "gegner", titel: "Gegneranalyse", offen: false });
        if (msg.type === "news" && /Rundschau/.test(msg.subject || "") && Array.isArray(state.standings) && state.standings.length) liste.push({ art: "tabelle", titel: "Tabelle", offen: false });
        if (msg.type === "contract_expiring" && p && p.clubId === state.userClubId) liste.push({ art: "vertrag", titel: "Vertragsdaten", offen: false });
        if (msg.type === "youth" && /Jugendtag:/.test(msg.subject || "")) liste.push({ art: "jahrgang", titel: "Der Jahrgang", offen: false });
        if (this.kategorie(msg).key === "finanzen") liste.push({ art: "konto", titel: "Kontoauszug", offen: false });
        return liste;
    }
};

if (typeof window !== "undefined") {
    window.NewsEngine = NewsEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NewsEngine };
}
