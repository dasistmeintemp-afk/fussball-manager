/**
 * JobmarktEngine - Der Trainer auf dem Markt
 *
 * Bisher kamen Angebote nur nach einer Entlassung. Wer Erfolg hatte, blieb
 * für immer beim ersten Verein. Jetzt bewegt sich der Markt:
 *
 *   Anfragen  - Trennt sich ein größerer Verein von seinem Trainer und passt
 *               der eigene Ruf, fragt er mit einer gewissen Chance an. Das
 *               Angebot gilt fünf Tage.
 *   Stellen   - Wer in den letzten zwei Wochen seinen Trainer gewechselt hat,
 *               nimmt noch Bewerbungen an. Nach drei Tagen kommt die Antwort -
 *               je näher der Ruf am Verein, desto eher ein Angebot.
 *   Rücktritt - Man kann gehen. Der Ruf leidet nicht, aber die Station endet,
 *               und es melden sich die Vereine, die einen nehmen würden.
 *
 * Wechseln lässt sich nur in Ligen mit gleich vielen Spieltagen (wie nach
 * einer Entlassung) - sonst passte der laufende Kalender nicht. Und nur mit
 * der Lizenz, die die Liga verlangt.
 */

const _jmResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const JobmarktEngine = {
    /** So lange gilt ein Angebot, so lange dauert eine Antwort, so lange ist eine Stelle offen (Tage) */
    FRIST: 5,
    ANTWORT: 3,
    STELLE_OFFEN: 14,
    /** Erst nach so vielen Pflichtspielen im Amt fragt jemand an */
    MIN_SPIELE: 10,
    /** Grundchance einer Anfrage, wenn ein passender Verein seinen Trainer wechselt */
    ANFRAGE_CHANCE: 0.45,
    /** Tage je Saison für den fortlaufenden Tageszähler */
    TAGE_JE_SAISON: 400,

    _jetzt(state) { return (state?.seasonYear || 1) * this.TAGE_JE_SAISON + (state?.currentDayIndex || 0); },
    _career() { return _jmResolve("CareerEngine", "./careerEngine.js"); },
    _eigener(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },
    _markt(state) {
        if (!state.jobmarkt) state.jobmarkt = { angebote: [], bewerbungen: [], abgelehnt: [] };
        return state.jobmarkt;
    },

    /** Darf und würde der Verein den Trainer nehmen? Liefert null oder den Grund dagegen */
    hindernis(state, club) {
        if (!club || club.id === state.userClubId) return "Das ist der eigene Verein.";
        if (state.careerOver) return "Die Laufbahn ist beendet.";
        const career = this._career();
        const ruf = career ? career.ruf(state) : 50;
        const profil = _jmResolve("TrainerProfilEngine", "./trainerProfilEngine.js");
        if (profil && typeof profil.darfTrainieren === "function" && !profil.darfTrainieren(profil.profil(state), club.level || 1)) {
            return "Für diese Liga fehlt die Lizenz.";
        }
        const spieltage = (state.schedule || []).length;
        if (career && !career.passendeLigen(state, spieltage).includes(club.leagueId)) {
            return "Die Liga spielt mit anderem Kalender - ein Wechsel geht erst zur neuen Saison.";
        }
        if ((club.reputation || 50) > ruf + 6) return "Für diesen Verein reicht der Ruf noch nicht.";
        return null;
    },

    /** Wie gut Ruf und Verein zusammenpassen: 1 ganz, 0 gar nicht */
    _naehe(state, club) {
        const career = this._career();
        const ruf = career ? career.ruf(state) : 50;
        const abstand = Math.abs((club.reputation || 50) - ruf);
        return Math.max(0, 1 - abstand / 30);
    },

    /** Spiele seit Amtsantritt - wer gerade erst kam, wird nicht abgeworben */
    _imAmt(state) {
        const career = this._career();
        const station = career ? career.aktuelleStation(state) : null;
        const laufend = career ? career.bilanz(state).spiele : 0;
        if (!station) return laufend;
        return (station.spiele || 0) + (station.vonSaison === (state.seasonYear || 1) ? Math.max(0, laufend - ((station.vonSpieltag || 1) - 1)) : laufend);
    },

    /**
     * Ein KI-Verein hat seinen Trainer gewechselt (TrainerwechselEngine).
     * Ist er größer als der eigene und passt der Ruf, fragt er vielleicht an.
     */
    nachTrainerwechsel(state, club, zufall = Math.random) {
        if (!state || !club || state.arbeitslos || state.careerOver) return null;
        const eigen = this._eigener(state);
        if (!eigen || (club.reputation || 50) <= (eigen.reputation || 50) + 3) return null;
        if (this.hindernis(state, club) || this._imAmt(state) < this.MIN_SPIELE) return null;
        const markt = this._markt(state);
        if (markt.angebote.some(a => a.clubId === club.id)) return null;
        if (zufall() >= this.ANFRAGE_CHANCE * this._naehe(state, club)) return null;
        return this._angebot(state, club, "anfrage");
    },

    _angebot(state, club, art) {
        const markt = this._markt(state);
        const career = this._career();
        const a = {
            clubId: club.id, clubName: club.name, leagueId: club.leagueId,
            leagueName: career ? career.ligaName(state, club.leagueId) : club.leagueId,
            reputation: club.reputation || 50, budget: club.transferBudget || 0,
            erwartung: club.boardExpectation || "midfield", art,
            bis: this._jetzt(state) + this.FRIST
        };
        markt.angebote = markt.angebote.filter(x => x.clubId !== club.id).concat([a]);
        this._post(state, `Vorstand ${club.name}`, art === "anfrage" ? `📞 ${club.name} fragt an` : `✅ ${club.name} will Sie`,
            (art === "anfrage"
                ? `${club.name} hat sich von seinem Trainer getrennt und möchte Sie als Nachfolger. `
                : `Ihre Bewerbung hat überzeugt: ${club.name} bietet Ihnen den Posten an. `)
            + `Das Angebot gilt fünf Tage - annehmen oder ablehnen im Reiter Verein unter "Jobmarkt".`);
        return a;
    },

    /** Offene Stellen: Vereine, die in den letzten zwei Wochen gewechselt haben */
    stellen(state) {
        const jetzt = this._jetzt(state);
        const markt = this._markt(state);
        const gesehen = new Set();
        return (state.trainerwechsel || []).slice().reverse()
            .filter(w => w.grund !== "abgang" && jetzt - ((w.saison || 1) * this.TAGE_JE_SAISON + (w.tag || 0)) <= this.STELLE_OFFEN)
            .filter(w => { if (gesehen.has(w.clubId)) return false; gesehen.add(w.clubId); return true; })
            .map(w => {
                const club = (state.clubs || []).find(c => c.id === w.clubId);
                if (!club || club.id === state.userClubId) return null;
                return {
                    clubId: club.id, clubName: club.name, leagueName: this._career()?.ligaName(state, club.leagueId) || club.leagueId,
                    reputation: club.reputation || 50, hindernis: this.hindernis(state, club),
                    beworben: markt.bewerbungen.some(b => b.clubId === club.id),
                    abgelehnt: markt.abgelehnt.includes(club.id),
                    angebot: markt.angebote.some(a => a.clubId === club.id)
                };
            }).filter(Boolean);
    },

    bewerben(state, clubId) {
        const stelle = this.stellen(state).find(s => s.clubId === clubId);
        if (!stelle) return { success: false, error: "Diese Stelle ist nicht (mehr) offen." };
        if (stelle.hindernis) return { success: false, error: stelle.hindernis };
        if (stelle.beworben || stelle.angebot) return { success: false, error: "Die Bewerbung liegt schon vor." };
        if (stelle.abgelehnt) return { success: false, error: "Der Verein hat schon abgesagt." };
        this._markt(state).bewerbungen.push({ clubId, antwort: this._jetzt(state) + this.ANTWORT });
        return { success: true };
    },

    /** Jeden Tag: Antworten auf Bewerbungen, abgelaufene Angebote */
    tag(state, zufall = Math.random) {
        if (!state || !state.jobmarkt || state.careerOver) return null;
        const markt = state.jobmarkt;
        const jetzt = this._jetzt(state);
        const meldungen = [];
        const offen = [];
        markt.bewerbungen.forEach(b => {
            if (b.antwort > jetzt) { offen.push(b); return; }
            const club = (state.clubs || []).find(c => c.id === b.clubId);
            if (!club) return;
            const ja = !this.hindernis(state, club) && zufall() < 0.15 + 0.7 * this._naehe(state, club);
            if (ja) { this._angebot(state, club, "bewerbung"); meldungen.push(`📨 ${club.name} bietet Ihnen den Trainerposten an.`); }
            else {
                markt.abgelehnt.push(club.id);
                this._post(state, `Vorstand ${club.name}`, `Absage von ${club.name}`, `Danke für Ihr Interesse. Wir haben uns für einen anderen Weg entschieden.`);
            }
        });
        markt.bewerbungen = offen;
        const vorher = markt.angebote.length;
        markt.angebote = markt.angebote.filter(a => a.bis >= jetzt);
        if (markt.angebote.length < vorher) meldungen.push("Ein Trainerangebot ist verfallen.");
        // Absagen gelten nur für diese Stelle - alte Einträge brauchen wir nicht
        if (markt.abgelehnt.length > 30) markt.abgelehnt = markt.abgelehnt.slice(-30);
        return meldungen.length ? meldungen.join(" ") : null;
    },

    angebote(state) { return state?.jobmarkt?.angebote || []; },

    /** Ein Angebot annehmen: die Station endet, beim alten Verein übernimmt ein KI-Trainer */
    annehmen(state, clubId) {
        const angebot = this.angebote(state).find(a => a.clubId === clubId);
        if (!angebot) return { erfolg: false, grund: "Das Angebot liegt nicht (mehr) vor." };
        const club = (state.clubs || []).find(c => c.id === clubId);
        const grund = this.hindernis(state, club);
        if (grund) return { erfolg: false, grund };
        const career = this._career();
        if (!career) return { erfolg: false, grund: "Karriere nicht verfügbar." };
        const alt = this._eigener(state);
        career.schliesseStation(state, "gewechselt");
        const res = career.uebernimm(state, clubId);
        if (!res.erfolg) return res;
        // Der alte Verein braucht einen Trainer
        const karussell = _jmResolve("TrainerwechselEngine", "./trainerwechselEngine.js");
        if (alt && karussell && typeof karussell.wechsle === "function") {
            delete alt.trainer;
            karussell.wechsle(state, alt, { grund: "abgang", platz: null });
        }
        state.jobmarkt = { angebote: [], bewerbungen: [], abgelehnt: [] };
        return res;
    },

    /** Ablehnen: Der eigene Vorstand hört davon und weiß es zu schätzen */
    ablehnen(state, clubId) {
        const markt = this._markt(state);
        const vorher = markt.angebote.length;
        markt.angebote = markt.angebote.filter(a => a.clubId !== clubId);
        if (markt.angebote.length === vorher) return { success: false };
        state.boardConfidence = Math.min(100, (state.boardConfidence ?? 60) + 2);
        return { success: true };
    },

    /** Zurücktreten: wie eine Entlassung, aber ohne Rufschaden */
    ruecktritt(state) {
        const eigen = this._eigener(state);
        if (!eigen || state.arbeitslos || state.careerOver) return { success: false, error: "Sie sind gerade bei keinem Verein." };
        const platz = (state.standings || []).findIndex(s => s.clubId === eigen.id) + 1;
        state.managerDismissed = { matchday: state.currentMatchday || 1, rank: platz || null, seasonYear: state.seasonYear, clubName: eigen.name, grund: "ruecktritt" };
        state.jobmarkt = { angebote: [], bewerbungen: [], abgelehnt: [] };
        return { success: true };
    },

    _post(state, sender, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`, sender, subject: betreff, body: text, read: false, type: "career" });
    }
};

if (typeof window !== "undefined") {
    window.JobmarktEngine = JobmarktEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { JobmarktEngine };
}
