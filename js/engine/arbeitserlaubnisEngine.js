/**
 * ArbeitserlaubnisEngine - Die Arbeitserlaubnis für englische Vereine
 *
 * Bisher konnte jeder englische Verein jeden Spieler der Welt holen. Seit
 * dem Austritt aus der EU braucht dort aber jeder Spieler ohne britischen
 * oder irischen Pass eine Arbeitserlaubnis - auch Spieler aus der EU. Sie
 * wird nach Punkten vergeben:
 *
 *   Nationalmannschaft - wer zur Elf oder zum Kader seines Landes gehört,
 *                        gewichtet nach der Stärke des Landes (höchstens 12)
 *   Einsatzzeit        - Anteil an den Ligaminuten des Vereins, gewichtet
 *                        nach der Stärke der Liga (höchstens 12)
 *   Europapokal        - Stammspieler eines Vereins im Europapokal (bis 4)
 *
 * Ab 15 Punkten gibt es die Erlaubnis. Mit 12 bis 14 Punkten, oder mit 10
 * und einem Stammplatz, gibt sie ein Ausnahmegremium. Dazu hat jeder Verein
 * je Saison einige Ausnahmeplätze für Spieler, die die Punkte nicht
 * erreichen - in der ersten Liga vier, in der zweiten zwei, in der dritten
 * einen. Spieler unter 18 dürfen nicht aus dem Ausland nach England
 * wechseln.
 *
 * Wer schon bei einem englischen Verein spielt, hat seine Erlaubnis und
 * wechselt innerhalb des Landes ohne neue Prüfung. Die Regel gilt für den
 * eigenen Verein wie für die KI.
 */

const _aeResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const ArbeitserlaubnisEngine = {
    /** Länder, in denen die Punkteregel gilt */
    LAENDER: ["en"],
    /** Wer keine Erlaubnis braucht: britische und irische Pässe */
    FREI: ["England", "Wales", "Schottland", "Nordirland", "Irland"],
    SCHWELLE: 15,
    GREMIUM: 12,
    GREMIUM_STAMM: 10,
    MINDESTALTER: 18,
    /** Ausnahmeplätze je Saison nach Ligastufe des Käufers */
    AUSNAHMEPLAETZE: { 1: 4, 2: 2, 3: 1 },

    /**
     * Stärke der Ligen in Bändern (1 = stärkste), je Land und Ligastufe.
     * Länder, die das Spiel (noch) nicht kennt, stehen im untersten Band.
     */
    BAND: {
        en: [1, 2, 4], de: [1, 4, 5, 6, 6, 6, 6], es: [1, 4, 5], it: [1, 4, 5], fr: [1, 4, 5],
        pt: [1, 5], nl: [2, 5], be: [2, 5], br: [2, 5], ar: [2, 5],
        tr: [3, 5], at: [3, 6], ch: [3, 6], sc: [3, 6]
    },
    /** Punkte für die Einsatzzeit je Band: ab 70 %, ab 40 %, ab 10 %, darunter */
    EINSATZ: { 1: [12, 10, 6, 2], 2: [10, 8, 4, 1], 3: [8, 6, 2, 0], 4: [6, 4, 1, 0], 5: [2, 1, 0, 0], 6: [0, 0, 0, 0] },
    /** Punkte für die Nationalmannschaft nach Rang des Landes: [bis Rang, Elf, Kader] */
    NATIONAL: [[10, 12, 10], [20, 10, 8], [30, 8, 6], [50, 6, 4], [Infinity, 3, 1]],
    EUROPA: { ucl: 4, uel: 3, uecl: 2 },
    /** Anteil der Minuten, solange ein Verein noch kaum gespielt hat */
    ROLLE: { "Schlüsselspieler": 0.85, "Stammspieler": 0.7, "Rotationsspieler": 0.35, "Rotation": 0.35 },

    _cache: (typeof WeakMap !== "undefined") ? new WeakMap() : null,

    /** Vereine nach Kennung - die KI fragt für jeden Kandidaten */
    _club(state, id) {
        if (!id) return null;
        const clubs = state?.clubs || [];
        let v = this._vereine ? this._vereine.get(state) : null;
        if (!v || v.ref !== clubs || v.n !== clubs.length) {
            v = { ref: clubs, n: clubs.length, map: new Map(clubs.map(c => [c.id, c])) };
            if (this._vereine && state && typeof state === "object") this._vereine.set(state, v);
        }
        return v.map.get(id) || null;
    },
    _vereine: (typeof WeakMap !== "undefined") ? new WeakMap() : null,

    /** Gilt die Regel für diesen Käufer? */
    gilt(club) {
        return !!club && this.LAENDER.includes(club.countryId);
    },

    /**
     * Rang der Nationen und wer zu Elf oder Kader gehört - einmal je vier
     * Wochen gerechnet, sonst liefe für jeden Kandidaten der KI die ganze
     * Weltrangliste.
     */
    _nationen(state) {
        const key = `${state?.seasonYear || 1}:${Math.floor((state?.currentDayIndex || 0) / 28)}`;
        const gemerkt = this._cache ? this._cache.get(state) : null;
        if (gemerkt && gemerkt.key === key) return gemerkt;
        const rang = new Map();
        const rolle = new Map();
        const nt = _aeResolve("NationalTeamEngine", "./nationalTeamEngine.js");
        if (nt && typeof nt.nationen === "function") {
            nt.nationen(state)
                .map(n => {
                    const kader = nt.nominiere(n);
                    const { elf, staerke } = nt.elf(kader);
                    return { name: n.name, kader, elf, staerke };
                })
                .sort((a, b) => b.staerke - a.staerke)
                .forEach((n, i) => {
                    rang.set(n.name, i + 1);
                    n.kader.forEach(p => rolle.set(p.id, "kader"));
                    n.elf.forEach(p => rolle.set(p.id, "elf"));
                });
        }
        const neu = { key, rang, rolle };
        if (this._cache && state && typeof state === "object") this._cache.set(state, neu);
        return neu;
    },

    band(club) {
        if (!club) return 6;
        const liste = this.BAND[club.countryId];
        if (!liste) return 6;
        return liste[Math.max(0, (club.level || 1) - 1)] || 6;
    },

    /** Der Verein, für den der Spieler zuletzt gespielt hat - bei Vereinslosen aus der Laufbahn */
    _letzterVerein(state, p) {
        const jetzt = this._club(state, p?.clubId);
        if (jetzt) return jetzt;
        const zeilen = Array.isArray(p?.laufbahn) ? p.laufbahn : [];
        const letzte = zeilen[zeilen.length - 1];
        return letzte ? this._club(state, letzte[1]) : null;
    },

    /** Anteil an den Ligaminuten seines Vereins (0 bis 1) */
    einsatzAnteil(state, p, club) {
        if (!p) return 0;
        if (club && p.clubId === club.id) {
            const tabelle = (state?.standingsByLeague || {})[club.leagueId] || [];
            const zeile = Array.isArray(tabelle) ? tabelle.find(z => z.clubId === club.id) : null;
            const spiele = zeile ? (zeile.played || 0) : 0;
            if (spiele >= 6) return Math.max(0, Math.min(1, (p.stats?.minutes || 0) / (spiele * 90)));
        }
        // Früh in der Saison oder vereinslos: die Einsätze der Vorsaison
        const saison = state?.seasonYear || 1;
        const vorjahr = (Array.isArray(p.laufbahn) ? p.laufbahn : [])
            .filter(z => z[0] === saison - 1).reduce((s, z) => s + (z[2] || 0), 0);
        if (vorjahr > 0) return Math.min(1, vorjahr / 34);
        if (!p.clubId) return 0;
        return this.ROLLE[p.squadRole] ?? 0.15;
    },

    _stufe(anteil) {
        return anteil >= 0.7 ? 0 : anteil >= 0.4 ? 1 : anteil >= 0.1 ? 2 : 3;
    },

    /** Die Punkte eines Spielers: { gesamt, anteil, teile: [{ text, punkte }] } */
    punkte(state, p) {
        const teile = [];
        const n = this._nationen(state);
        const rangLand = n.rang.get(p?.nationality);
        const rolle = n.rolle.get(p?.id);
        const zeile = this.NATIONAL.find(z => (rangLand || 999) <= z[0]) || this.NATIONAL[this.NATIONAL.length - 1];
        let national = 0;
        if (rolle === "elf") {
            national = zeile[1];
            teile.push({ text: `Stammspieler der Nationalmannschaft (${p.nationality}, Rang ${rangLand})`, punkte: national });
        } else if (rolle === "kader") {
            national = zeile[2];
            teile.push({ text: `Im Kader der Nationalmannschaft (${p.nationality}, Rang ${rangLand})`, punkte: national });
        } else if ((p?.laenderspiele || 0) >= 5) {
            national = Math.max(0, zeile[2] - 2);
            if (national > 0) teile.push({ text: `${p.laenderspiele} Länderspiele für ${p.nationality}`, punkte: national });
        }

        const club = this._letzterVerein(state, p);
        const anteil = this.einsatzAnteil(state, p, club);
        const band = this.band(club);
        const einsatz = (this.EINSATZ[band] || this.EINSATZ[6])[this._stufe(anteil)];
        if (club) {
            teile.push({ text: `${Math.round(anteil * 100)} % der Ligaminuten bei ${club.name} (Ligaband ${band})`, punkte: einsatz });
        } else {
            teile.push({ text: "Ohne Verein und ohne Einsätze", punkte: 0 });
        }

        let europa = 0;
        if (club && anteil >= 0.4) {
            const ec = state?.europeanCompetitions || {};
            const id = ["ucl", "uel", "uecl"].find(k => (ec[k]?.participants || []).includes(club.id));
            if (id) {
                europa = this.EUROPA[id];
                teile.push({ text: "Stammspieler im Europapokal", punkte: europa });
            }
        }
        return { gesamt: national + einsatz + europa, anteil, teile };
    },

    _speicher(state) {
        const saison = state?.seasonYear || 1;
        if (!state.arbeitserlaubnis || state.arbeitserlaubnis.saison !== saison) {
            state.arbeitserlaubnis = { saison, genutzt: {} };
        }
        return state.arbeitserlaubnis;
    },

    /** Freie Ausnahmeplätze eines Vereins in dieser Saison */
    plaetzeFrei(state, club) {
        const max = this.AUSNAHMEPLAETZE[club?.level || 1] || 0;
        const genutzt = state?.arbeitserlaubnis?.saison === (state?.seasonYear || 1)
            ? (state.arbeitserlaubnis.genutzt[club.id] || 0) : 0;
        return { frei: Math.max(0, max - genutzt), max };
    },

    /**
     * Braucht der Spieler für diesen Käufer eine Erlaubnis, und bekommt er
     * sie? { noetig, erteilt, weg, punkte, teile, frei, max, text }
     * weg: "frei" | "punkte" | "gremium" | "ausnahme" | "abgelehnt" | "zu_jung"
     */
    pruefe(state, p, kaeufer) {
        if (!p || !this.gilt(kaeufer) || this.FREI.includes(p.nationality)) {
            return { noetig: false, erteilt: true, weg: "frei", punkte: null, teile: [], text: "" };
        }
        const verkaeufer = this._club(state, p.clubId);
        // Wer schon im Land spielt, hat seine Erlaubnis. Ein Leihspieler
        // gehört seinem Stammverein - dessen Land zählt.
        const stammId = p.leihe?.stammvereinId || null;
        const stamm = stammId ? this._club(state, stammId) : verkaeufer;
        if (stamm && stamm.countryId === kaeufer.countryId) {
            return { noetig: false, erteilt: true, weg: "frei", punkte: null, teile: [], text: "" };
        }
        if ((p.age || 25) < this.MINDESTALTER) {
            return { noetig: true, erteilt: false, weg: "zu_jung", punkte: null, teile: [],
                text: `Unter ${this.MINDESTALTER} darf er nicht aus dem Ausland nach England wechseln.` };
        }
        const { gesamt, anteil, teile } = this.punkte(state, p);
        const { frei, max } = this.plaetzeFrei(state, kaeufer);
        const basis = { noetig: true, punkte: gesamt, teile, frei, max };
        if (gesamt >= this.SCHWELLE) {
            return Object.assign(basis, { erteilt: true, weg: "punkte", text: `Arbeitserlaubnis: ${gesamt} Punkte, ab ${this.SCHWELLE} gibt es sie.` });
        }
        if (gesamt >= this.GREMIUM || (gesamt >= this.GREMIUM_STAMM && anteil >= 0.4)) {
            return Object.assign(basis, { erteilt: true, weg: "gremium",
                text: `${gesamt} Punkte - das Ausnahmegremium erteilt die Erlaubnis.` });
        }
        if (frei > 0) {
            return Object.assign(basis, { erteilt: true, weg: "ausnahme",
                text: `Nur ${gesamt} Punkte - geht über einen Ausnahmeplatz (noch ${frei} von ${max} frei in dieser Saison).` });
        }
        return Object.assign(basis, { erteilt: false, weg: "abgelehnt",
            text: max > 0
                ? `Keine Arbeitserlaubnis: ${gesamt} von ${this.SCHWELLE} Punkten, und alle ${max} Ausnahmeplätze dieser Saison sind vergeben.`
                : `Keine Arbeitserlaubnis: ${gesamt} von ${this.SCHWELLE} Punkten.` });
    },

    /** Darf der Wechsel stattfinden? Kurzform für die KI */
    erlaubt(state, p, kaeufer) {
        return this.pruefe(state, p, kaeufer).erteilt;
    },

    /** Einen Ausnahmeplatz belegen */
    verbrauche(state, club) {
        if (!state || !club) return;
        const s = this._speicher(state);
        s.genutzt[club.id] = (s.genutzt[club.id] || 0) + 1;
    },

    /** Für Anzeigen: eine Zeile mit Symbol, oder null, wenn keine Erlaubnis nötig ist */
    kurztext(ergebnis) {
        if (!ergebnis || !ergebnis.noetig) return null;
        const zeichen = { punkte: "✅", gremium: "⚖️", ausnahme: "🎫", abgelehnt: "⛔", zu_jung: "⛔" }[ergebnis.weg] || "";
        return `${zeichen} ${ergebnis.text}`;
    }
};

if (typeof window !== "undefined") {
    window.ArbeitserlaubnisEngine = ArbeitserlaubnisEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { ArbeitserlaubnisEngine };
}
