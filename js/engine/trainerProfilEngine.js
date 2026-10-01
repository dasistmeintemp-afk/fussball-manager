/**
 * TrainerProfilEngine - Der Trainer selbst: Werte, Lizenz, Ruf
 *
 * Bisher war der Trainer ein Name. Jetzt hat er ein Profil:
 *  - Fünf Werte von 1 bis 20: Taktik, Motivation, Menschenführung,
 *    Jugendarbeit und Spielerbewertung. Sie wirken - auf die Vertrautheit
 *    mit der Taktik, auf Ansprachen und Pressekonferenzen, auf Gespräche
 *    unter vier Augen, auf die Entwicklung der Talente und auf die
 *    Genauigkeit der Scoutberichte.
 *  - Eine Lizenz: B, A oder Pro. Ab der Regionalliga verlangt der Verband
 *    die A-Lizenz, in den beiden Bundesligen die Pro-Lizenz. Wer sie nicht
 *    hat, bekommt dort keine Angebote. Ein Lehrgang kostet Geld und Zeit
 *    und bringt dazu Taktik und Spielerbewertung voran.
 *  - Der Ruf (aus der Karriereakte) entscheidet über Angebote, und Berater
 *    sind bei einem bekannten Trainer geduldiger.
 *
 * Am Saisonende wächst, was gefordert war: Wer Talente einbaut, wird besser
 * in der Jugendarbeit, wer Titel holt, in der Motivation.
 */

function _tpResolve(name, pfad) {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { return null; }
    }
    return null;
}

const TrainerProfilEngine = {
    WERTE: {
        taktik: { name: "Taktik", text: "Neue Formationen und Anweisungen sitzen schneller." },
        motivation: { name: "Motivation", text: "Ansprachen und Pressekonferenzen wirken stärker." },
        menschenfuehrung: { name: "Menschenführung", text: "Gespräche unter vier Augen gelingen öfter." },
        jugend: { name: "Jugendarbeit", text: "Spieler bis 21 entwickeln sich schneller." },
        bewertung: { name: "Spielerbewertung", text: "Scoutberichte und eigene Einschätzungen sind genauer." }
    },

    TYPEN: {
        allrounder: { name: "Allrounder", werte: { taktik: 12, motivation: 12, menschenfuehrung: 12, jugend: 12, bewertung: 12 } },
        taktiker: { name: "Taktiker", werte: { taktik: 16, motivation: 10, menschenfuehrung: 10, jugend: 11, bewertung: 13 } },
        motivator: { name: "Motivator", werte: { taktik: 10, motivation: 16, menschenfuehrung: 14, jugend: 10, bewertung: 10 } },
        ausbilder: { name: "Ausbilder", werte: { taktik: 11, motivation: 11, menschenfuehrung: 12, jugend: 16, bewertung: 10 } },
        sportdirektor: { name: "Kaderplaner", werte: { taktik: 11, motivation: 10, menschenfuehrung: 11, jugend: 11, bewertung: 17 } }
    },

    LIZENZEN: {
        b: { name: "B-Lizenz", rang: 1 },
        a: { name: "A-Lizenz", rang: 2 },
        pro: { name: "Pro-Lizenz", rang: 3 }
    },

    /** Lehrgänge: Kosten, Dauer in Tagen, Wertezuwachs */
    KURSE: {
        a: { von: "b", kosten: 12000, tage: 60, plus: { taktik: 1, bewertung: 1 } },
        pro: { von: "a", kosten: 40000, tage: 90, plus: { taktik: 1, bewertung: 1, menschenfuehrung: 1 } }
    },

    /** Welche Lizenz eine Ligastufe verlangt */
    pflichtLizenz(level) {
        if ((level || 1) <= 2) return "pro";
        if ((level || 1) <= 4) return "a";
        return "b";
    },

    darfTrainieren(profil, level) {
        const noetig = this.LIZENZEN[this.pflichtLizenz(level)].rang;
        return (this.LIZENZEN[profil?.lizenz]?.rang || 1) >= noetig;
    },

    /** Das Profil des Trainers - beim ersten Zugriff aus Typ und Startverein */
    profil(state, typ = null) {
        if (!state) return null;
        if (state.trainerProfil) return state.trainerProfil;
        const t = this.TYPEN[typ || state.trainerTyp] || this.TYPEN.allrounder;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        // Wer bei einem Bundesligisten anfängt, hat die Lizenz dafür
        const lizenz = this.pflichtLizenz(club?.level || 1);
        state.trainerProfil = {
            typ: typ || state.trainerTyp || "allrounder",
            werte: { ...t.werte },
            lizenz,
            kurs: null,
            saisons: 0
        };
        return state.trainerProfil;
    },

    wert(state, key) {
        const p = this.profil(state);
        return Math.max(1, Math.min(20, p?.werte?.[key] ?? 12));
    },

    /** Faktor um 1: Wert 12 ist neutral, 20 bringt +range, 1 kostet etwa range */
    faktor(state, key, range = 0.2) {
        if (!state || !state.userClubId) return 1;
        return 1 + (this.wert(state, key) - 12) / 8 * range;
    },

    ruf(state) {
        const career = _tpResolve("CareerEngine", "./careerEngine.js");
        return career && typeof career.ruf === "function" ? career.ruf(state) : 50;
    },

    // ------------------------------------------------------------ Lehrgang

    kursStarten(state) {
        const p = this.profil(state);
        const ziel = p.lizenz === "b" ? "a" : (p.lizenz === "a" ? "pro" : null);
        if (!ziel) return { success: false, error: "Sie haben die höchste Lizenz." };
        if (p.kurs) return { success: false, error: "Der Lehrgang läuft bereits." };
        const kurs = this.KURSE[ziel];
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club || (club.balance || 0) < kurs.kosten) return { success: false, error: "Für die Lehrgangsgebühr reicht das Geld nicht." };
        club.balance -= kurs.kosten;
        const finanzen = _tpResolve("FinanceEngine", "./financeEngine.js");
        if (finanzen && typeof finanzen.recordTransaction === "function") {
            finanzen.recordTransaction(state, club.id, "staff_wages", -kurs.kosten, `Lehrgang ${this.LIZENZEN[ziel].name}`);
        }
        p.kurs = { ziel, tageOffen: kurs.tage };
        return { success: true, ziel, tage: kurs.tage, kosten: kurs.kosten };
    },

    /** Ein Kalendertag: Der Lehrgang rückt vor */
    tag(state) {
        const p = state?.trainerProfil;
        if (!p || !p.kurs) return null;
        p.kurs.tageOffen = Math.max(0, (p.kurs.tageOffen || 0) - 1);
        if (p.kurs.tageOffen > 0) return null;
        const ziel = p.kurs.ziel;
        p.lizenz = ziel;
        p.kurs = null;
        Object.entries(this.KURSE[ziel].plus).forEach(([k, v]) => { p.werte[k] = Math.min(20, (p.werte[k] || 12) + v); });
        this._post(state, "Trainerakademie", `${this.LIZENZEN[ziel].name} bestanden`,
            `Glückwunsch! Sie haben den Lehrgang abgeschlossen und besitzen jetzt die ${this.LIZENZEN[ziel].name}. `
            + `Damit dürfen Sie ${ziel === "pro" ? "auch in den beiden Bundesligen" : "bis zur Regionalliga"} arbeiten. Taktik und Spielerbewertung sind gewachsen.`);
        return { bestanden: ziel };
    },

    // ------------------------------------------------------------ Saisonende

    /**
     * Am Saisonende wächst, was gefordert war. Höchstens zwei Punkte je
     * Saison, und über 18 wird es zäh.
     */
    saisonende(state, info = {}) {
        const p = this.profil(state);
        p.saisons = (p.saisons || 0) + 1;
        const kandidaten = [];
        if ((info.titel || 0) > 0) kandidaten.push("motivation");
        if ((info.talente || 0) >= 2) kandidaten.push("jugend");
        if ((info.vertrautheit || 0) >= 0.8) kandidaten.push("taktik");
        if ((info.transfers || 0) >= 3) kandidaten.push("bewertung");
        if ((info.gespraeche || 0) >= 4) kandidaten.push("menschenfuehrung");
        const gewachsen = [];
        kandidaten.slice(0, 2).forEach(k => {
            const jetzt = p.werte[k] || 12;
            if (jetzt >= 20 || (jetzt >= 18 && (p.saisons % 2) === 1)) return;
            p.werte[k] = jetzt + 1;
            gewachsen.push(this.WERTE[k].name);
        });
        if (gewachsen.length) {
            this._post(state, "Trainerakademie", "Ihre Entwicklung in dieser Saison",
                `Was Sie in dieser Saison getan haben, hat Sie weitergebracht: ${gewachsen.join(" und ")} +1.`);
        }
        return gewachsen;
    },

    /** Für die Oberfläche */
    uebersicht(state) {
        const p = this.profil(state);
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        const naechste = p.lizenz === "b" ? "a" : (p.lizenz === "a" ? "pro" : null);
        return {
            typ: this.TYPEN[p.typ]?.name || "Allrounder",
            werte: Object.entries(this.WERTE).map(([key, w]) => ({ key, name: w.name, text: w.text, wert: this.wert(state, key) })),
            lizenz: this.LIZENZEN[p.lizenz].name,
            pflicht: this.LIZENZEN[this.pflichtLizenz(club?.level || 1)].name,
            erfuellt: this.darfTrainieren(p, club?.level || 1),
            kurs: p.kurs ? { ziel: this.LIZENZEN[p.kurs.ziel].name, tageOffen: p.kurs.tageOffen } : null,
            naechsterKurs: naechste ? { name: this.LIZENZEN[naechste].name, ...this.KURSE[naechste] } : null,
            ruf: this.ruf(state)
        };
    },

    _post(state, absender, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: absender, subject: betreff, body: text, read: false, type: "info"
        });
    }
};

if (typeof window !== "undefined") {
    window.TrainerProfilEngine = TrainerProfilEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { TrainerProfilEngine };
}
