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

        // 1. Filter anwenden
        if (filter === "unread") {
            list = list.filter(m => !m.read);
        } else if (filter === "board") {
            list = list.filter(m => m.type === "board_message" || m.type === "welcome" || m.sender.toLowerCase().includes("vorstand"));
        } else if (filter === "match") {
            list = list.filter(m => m.type === "match_preview" || m.type === "match_report" || m.type === "opponent_analysis");
        } else if (filter === "transfer") {
            list = list.filter(m => m.type === "transfer_done" || m.type === "transfer_offer" || m.type === "contract_news");
        } else if (filter === "training") {
            list = list.filter(m => m.type === "training_report" || m.type === "injury");
        } else if (filter === "scouting") {
            list = list.filter(m => m.type === "scout_report" || m.type === "youth_prospect");
        } else if (filter === "finance") {
            list = list.filter(m => m.type === "finance" || m.type === "sponsor_event");
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
    }
};

if (typeof window !== "undefined") {
    window.NewsEngine = NewsEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NewsEngine };
}
