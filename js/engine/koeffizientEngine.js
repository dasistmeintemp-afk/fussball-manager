/**
 * KoeffizientEngine - Die Fünfjahreswertung der Länder
 *
 * Die Startplätze im Europapokal standen fest in den Ligadaten: vier für
 * England, Spanien, Italien und Deutschland, drei für Frankreich - egal, wie
 * die Vereine eines Landes abschnitten. Über eine lange Karriere verschiebt
 * sich die Landkarte im Vorbild und in Wirklichkeit aber: Wer international
 * gewinnt, bekommt mehr Startplätze.
 *
 * Jetzt sammelt jedes Land Punkte mit seinen Vereinen:
 *   Sieg 2, Remis 1 (Gruppe und Endrunde), je erreichter Endrundenrunde 1,
 *   für die Teilnahme an der Königsklasse 2.
 * Der Wert einer Saison ist die Summe geteilt durch die Zahl der Vereine des
 * Landes im Europapokal, die Fünfjahreswertung die Summe der letzten fünf
 * Saisons. Die Länder auf Rang 1 bis 4 stellen vier Vereine in der
 * Königsklasse, Rang 5 drei, die Ränge 6 und 7 zwei, alle dahinter ihren
 * Meister. Das Land mit dem besten Wert der Vorsaison bekommt einen
 * weiteren Platz (Leistungsplatz).
 *
 * Die vier Saisons vor dem Karrierestart folgen der echten Rangfolge:
 * England vor Italien, Spanien, Deutschland und Frankreich, dahinter die
 * Niederlande, Portugal, Belgien, die Türkei, Österreich, die Schweiz und
 * Schottland. Die Werte stehen im Maßstab dieses Spiels - die großen
 * Länder holen hier je Verein und Saison rund 8 bis 11 Punkte, die kleinen
 * 3 bis 7 (gemessen über 16 Saisons mit ausgelosten Gruppen). Vorher waren
 * es die echten Werte (14,5 bis 21,5), gut das Doppelte: Die Wertung
 * bestand in den ersten Jahren fast nur aus der Vorgabe und sackte dann
 * Saison für Saison ab.
 */

const KoeffizientEngine = {
    LAENDER: ["en", "it", "es", "de", "fr", "nl", "pt", "be", "tr", "at", "ch", "sc"],
    NAMEN: {
        en: "England", it: "Italien", es: "Spanien", de: "Deutschland", fr: "Frankreich",
        nl: "Niederlande", pt: "Portugal", be: "Belgien", tr: "Türkei", at: "Österreich", ch: "Schweiz", sc: "Schottland"
    },
    /** Werte je Saison vor dem Karrierestart (vier Saisons) */
    START: { en: 11.4, it: 10.2, es: 9.8, de: 9.4, fr: 8.0, nl: 7.4, pt: 7.0, be: 6.0, tr: 5.8, at: 4.2, ch: 4.0, sc: 3.6 },
    /**
     * Startplätze in der Königsklasse nach Rang. Die großen Länder stellen
     * vier, die kleineren ihren Meister und manchmal den Zweiten. Dazu je
     * einen Platz im Kontinentalpokal und im Euro-Cup.
     */
    KOENIGSKLASSE_JE_RANG: [4, 4, 4, 4, 3, 2, 2, 1, 1, 1, 1, 1],
    PUNKTE: { sieg: 2, remis: 1, runde: 1, koenigsklasse: 2 },
    GEMERKT: 5,

    _speicher(state) {
        if (!state.koeffizient || !Array.isArray(state.koeffizient.saisons)) {
            const start = state.seasonYear || 1;
            state.koeffizient = {
                saisons: [1, 2, 3, 4].map(i => ({ saison: start - 5 + i, werte: Object.assign({}, this.START), vorgabe: true }))
            };
        }
        return state.koeffizient;
    },

    _landVon(state) {
        const m = new Map();
        (state.clubs || []).forEach(c => m.set(c.id, c.countryId));
        return m;
    },

    /** Punkte der laufenden (oder gerade beendeten) Saison je Verein und Land */
    saisonWerte(state) {
        const land = this._landVon(state);
        const vereinPunkte = new Map();
        const dazu = (id, p) => vereinPunkte.set(id, (vereinPunkte.get(id) || 0) + p);
        const teilnehmer = new Map();
        const ec = state.europeanCompetitions || {};
        Object.keys(ec).forEach(id => {
            const w = ec[id];
            if (!w) return;
            (w.groups || []).forEach(g => (g.standings || []).forEach(r => {
                teilnehmer.set(r.clubId, true);
                dazu(r.clubId, (r.won || 0) * this.PUNKTE.sieg + (r.drawn || 0) * this.PUNKTE.remis);
                if (id === "ucl") dazu(r.clubId, this.PUNKTE.koenigsklasse);
            }));
            (w.endrunde || []).forEach(runde => (runde.matches || []).forEach(m => {
                [m.homeClubId, m.awayClubId].forEach(cid => dazu(cid, this.PUNKTE.runde));
                if (!m.played) return;
                if (m.homeGoals > m.awayGoals) dazu(m.homeClubId, this.PUNKTE.sieg);
                else if (m.awayGoals > m.homeGoals) dazu(m.awayClubId, this.PUNKTE.sieg);
                else { dazu(m.homeClubId, this.PUNKTE.remis); dazu(m.awayClubId, this.PUNKTE.remis); }
            }));
        });
        const summe = {}, anzahl = {};
        teilnehmer.forEach((_, cid) => {
            const l = land.get(cid);
            if (!this.LAENDER.includes(l)) return;
            summe[l] = (summe[l] || 0) + (vereinPunkte.get(cid) || 0);
            anzahl[l] = (anzahl[l] || 0) + 1;
        });
        const werte = {};
        this.LAENDER.forEach(l => { werte[l] = anzahl[l] ? Math.round(summe[l] / anzahl[l] * 1000) / 1000 : 0; });
        return { werte, vereine: anzahl };
    },

    /**
     * Die Fünfjahreswertung: archivierte Saisons plus die laufende.
     * [{ land, name, werte: [..fünf..], summe, rang }]
     */
    /**
     * Der Wert eines Landes in einer archivierten Saison. Ein Land, das es
     * in der Welt damals noch nicht gab (älterer Spielstand), zählt mit
     * seiner Vorgabe.
     */
    _wert(saison, land) {
        const w = saison && saison.werte ? saison.werte[land] : undefined;
        return typeof w === "number" ? w : (this.START[land] || 0);
    },

    rangliste(state) {
        const s = this._speicher(state);
        const laufend = this.saisonWerte(state).werte;
        const saisons = s.saisons.slice(-(this.GEMERKT - 1));
        return this.LAENDER.map(l => {
            const werte = saisons.map(x => this._wert(x, l)).concat([laufend[l] || 0]);
            return { land: l, name: this.NAMEN[l], werte, summe: Math.round(werte.reduce((a, b) => a + b, 0) * 1000) / 1000 };
        }).sort((a, b) => b.summe - a.summe).map((z, i) => Object.assign(z, { rang: i + 1 }));
    },

    /**
     * Zum Saisonwechsel, bevor der Europapokal neu besetzt wird: Die Werte
     * der abgelaufenen Saison ins Archiv, Startplätze für die neue.
     */
    saisonAbschluss(state) {
        const s = this._speicher(state);
        const { werte } = this.saisonWerte(state);
        const saison = state.seasonYear || 1;
        if (!s.saisons.some(x => x.saison === saison)) s.saisons.push({ saison, werte });
        if (s.saisons.length > this.GEMERKT) s.saisons.splice(0, s.saisons.length - this.GEMERKT);
        s.plaetze = this._verteile(s);
        return s.plaetze;
    },

    _verteile(s) {
        const summe = (l) => s.saisons.reduce((a, x) => a + this._wert(x, l), 0);
        const rang = this.LAENDER.slice().sort((a, b) => summe(b) - summe(a));
        const letzte = s.saisons[s.saisons.length - 1];
        const leistung = letzte && !letzte.vorgabe
            ? this.LAENDER.slice().sort((a, b) => this._wert(letzte, b) - this._wert(letzte, a))[0] : null;
        const plaetze = {};
        rang.forEach((l, i) => {
            const ucl = (this.KOENIGSKLASSE_JE_RANG[i] ?? 1) + (l === leistung ? 1 : 0);
            plaetze[l] = {
                rang: i + 1, leistungsplatz: l === leistung,
                championsLeague: Array.from({ length: ucl }, (_, k) => k + 1),
                europaLeague: [ucl + 1],
                conferenceLeague: [ucl + 2]
            };
        });
        return plaetze;
    },

    /** Startplätze je Land für die nächste Besetzung - oder null (dann gelten die Ligadaten) */
    plaetze(state) {
        return state?.koeffizient?.plaetze || null;
    },

    /** Wie die Plätze verteilt würden, wenn die Saison jetzt endete */
    vorschau(state) {
        const s = this._speicher(state);
        const saisons = s.saisons.slice(-(this.GEMERKT - 1)).concat([{ saison: state.seasonYear || 1, werte: this.saisonWerte(state).werte }]);
        return this._verteile({ saisons });
    }
};

if (typeof window !== "undefined") {
    window.KoeffizientEngine = KoeffizientEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { KoeffizientEngine };
}
