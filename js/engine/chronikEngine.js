/**
 * ChronikEngine - Geschichte und Rekorde des eigenen Vereins
 *
 * Bisher vergaß der Verein alles, was nicht in der Tabelle stand: Wer die
 * meisten Spiele gemacht hatte, welcher Sieg der höchste war, welcher
 * Transfer der teuerste - nach dem Saisonwechsel war es weg. Jetzt führt
 * jeder Verein, den der Trainer übernimmt, eine Chronik:
 *
 *   Rekorde        - höchster Sieg, höchste Niederlage, torreichstes Spiel,
 *                    Zuschauerrekord, längste Sieges- und ungeschlagene Serie,
 *                    teuerster Kauf und Verkauf.
 *   Saisons        - Liga, Platz, Punkte und Tore jeder Saison.
 *   Spieler        - Spiele, Tore und Vorlagen jedes Spielers für den Verein;
 *                    daraus Rekordspieler, Rekordtorschütze und die Legenden.
 *   Titel          - Meisterschaft, Aufstieg, Pokal.
 *
 * Geführt wird ab Spielbeginn bzw. ab der Übernahme - was vorher war, kennt
 * das Spiel nicht.
 */

const ChronikEngine = {
    /** Ab hier wird ein Spieler zur Vereinslegende */
    LEGENDE: { spiele: 150, tore: 60, titel: 2, titelSpiele: 80 },

    _club(state, clubId) {
        return (state?.clubs || []).find(c => c.id === clubId) || null;
    },

    /** Die Chronik eines Vereins - angelegt, sobald der Trainer dort arbeitet */
    chronik(state, clubId = state?.userClubId) {
        if (!state || !clubId) return null;
        if (!state.chronik || typeof state.chronik !== "object") state.chronik = {};
        if (!state.chronik[clubId]) {
            state.chronik[clubId] = {
                seit: state.seasonYear || 1,
                rekorde: {},
                serie: { siege: 0, ungeschlagen: 0 },
                saisons: [],
                spieler: {},
                titel: []
            };
        }
        return state.chronik[clubId];
    },

    _datum(state) {
        return state.currentDate || `Saison ${state.seasonYear || 1}`;
    },

    /**
     * Nach jedem Pflichtspiel des eigenen Vereins: Rekorde und Serien.
     * wettbewerb: "Liga", "Pokal", "Champions League" ...
     */
    nachSpiel(state, match, wettbewerb = "Liga") {
        if (!state || !match || !match.played) return null;
        const heim = match.homeClubId === state.userClubId;
        if (!heim && match.awayClubId !== state.userClubId) return null;
        const c = this.chronik(state);
        if (!c) return null;
        // Dasselbe Spiel zählt nur einmal
        const schluessel = `${state.seasonYear || 1}:${match.id ?? `${match.homeClubId}-${match.awayClubId}-${match.matchday ?? ""}-${wettbewerb}`}`;
        if (c.letztesSpiel === schluessel) return null;
        c.letztesSpiel = schluessel;

        const tore = heim ? match.homeGoals : match.awayGoals;
        const gegentore = heim ? match.awayGoals : match.homeGoals;
        const gegner = this._club(state, heim ? match.awayClubId : match.homeClubId);
        const eintrag = {
            ergebnis: `${tore}:${gegentore}`, gegner: gegner ? gegner.name : "", heim,
            datum: this._datum(state), saison: state.seasonYear || 1, wettbewerb
        };
        const r = c.rekorde;
        const neu = [];
        const diff = tore - gegentore;
        const besser = (alt, wert, gleichstand) => !alt || wert > alt.wert || (wert === alt.wert && gleichstand);

        if (diff > 0 && besser(r.hoechsterSieg, diff, tore > (r.hoechsterSieg?.tore || 0))) {
            if (r.hoechsterSieg) neu.push(`höchster Sieg (${eintrag.ergebnis} gegen ${eintrag.gegner})`);
            r.hoechsterSieg = { ...eintrag, wert: diff, tore };
        }
        if (diff < 0 && besser(r.hoechsteNiederlage, -diff, gegentore > (r.hoechsteNiederlage?.tore || 0))) {
            r.hoechsteNiederlage = { ...eintrag, wert: -diff, tore: gegentore };
        }
        const summe = tore + gegentore;
        if (summe > 0 && besser(r.torreichstes, summe, false)) r.torreichstes = { ...eintrag, wert: summe };
        if (heim && (match.attendance || 0) > (r.zuschauer?.wert || 0)) {
            if (r.zuschauer) neu.push(`Zuschauerrekord (${match.attendance.toLocaleString("de-DE")})`);
            r.zuschauer = { ...eintrag, wert: match.attendance };
        }

        // Serien
        const s = c.serie;
        s.siege = diff > 0 ? s.siege + 1 : 0;
        s.ungeschlagen = diff >= 0 ? s.ungeschlagen + 1 : 0;
        if (s.siege > (r.siegserie?.wert || 0)) {
            if (r.siegserie && s.siege === r.siegserie.wert + 1) neu.push(`Vereinsrekord: ${s.siege} Siege in Folge`);
            r.siegserie = { wert: s.siege, bis: eintrag.datum, saison: eintrag.saison };
        }
        if (s.ungeschlagen > (r.ungeschlagen?.wert || 0)) {
            if (r.ungeschlagen && s.ungeschlagen === r.ungeschlagen.wert + 1 && s.ungeschlagen >= 10) neu.push(`Vereinsrekord: ${s.ungeschlagen} Spiele ungeschlagen`);
            r.ungeschlagen = { wert: s.ungeschlagen, bis: eintrag.datum, saison: eintrag.saison };
        }
        return neu.length ? `📜 ${neu.join(", ")}` : null;
    },

    /** Ein Wechsel mit dem eigenen Verein: teuerster Kauf und Verkauf */
    transfer(state, player, fee, kaeuferId, verkaeuferId) {
        if (!state || !player || !(fee > 0)) return;
        const eintrag = (andererId) => ({ name: player.name, wert: fee, verein: this._club(state, andererId)?.name || "", saison: state.seasonYear || 1, datum: this._datum(state) });
        if (kaeuferId === state.userClubId) {
            const c = this.chronik(state);
            if (fee > (c.rekorde.kauf?.wert || 0)) c.rekorde.kauf = eintrag(verkaeuferId);
        }
        if (verkaeuferId === state.userClubId) {
            const c = this.chronik(state);
            if (fee > (c.rekorde.verkauf?.wert || 0)) c.rekorde.verkauf = eintrag(kaeuferId);
        }
    },

    /** Ein gewonnener Titel */
    titel(state, wettbewerb, saison) {
        const c = this.chronik(state);
        if (c) c.titel.push({ wettbewerb, saison: saison || state.seasonYear || 1 });
    },

    /**
     * Zum Saisonende, vor dem Zurücksetzen der Statistik: die Saison in die
     * Chronik, die Spiele der Spieler auf ihr Vereinskonto.
     */
    saisonAbschluss(state, { platz = null, liga = null } = {}) {
        const club = this._club(state, state?.userClubId);
        if (!club) return;
        const c = this.chronik(state);
        const zeile = (state.standings || []).find(r => r.clubId === club.id) || {};
        c.saisons.push({
            saison: state.seasonYear || 1,
            liga: liga || state.leagueName || club.leagueId,
            platz,
            punkte: zeile.points ?? null,
            tore: zeile.goalsFor ?? null,
            gegentore: zeile.goalsAgainst ?? null
        });
        (state.players || []).filter(p => p.clubId === club.id).forEach(p => {
            const st = p.stats || {};
            if (!(st.matches > 0)) return;
            const alt = c.spieler[p.id] || [p.name, 0, 0, 0, state.seasonYear || 1, state.seasonYear || 1, p.pos];
            c.spieler[p.id] = [p.name, alt[1] + st.matches, alt[2] + (st.goals || 0), alt[3] + (st.assists || 0), alt[4], state.seasonYear || 1, p.pos];
        });
    },

    /** Spiele, Tore und Vorlagen eines Spielers für den Verein - mit der laufenden Saison */
    bilanz(state, player, clubId = state?.userClubId) {
        const c = state?.chronik?.[clubId];
        const alt = c?.spieler?.[player?.id] || null;
        const laufend = player && player.clubId === clubId ? (player.stats || {}) : {};
        return {
            spiele: (alt ? alt[1] : 0) + (laufend.matches || 0),
            tore: (alt ? alt[2] : 0) + (laufend.goals || 0),
            vorlagen: (alt ? alt[3] : 0) + (laufend.assists || 0),
            seit: alt ? alt[4] : (state?.seasonYear || 1)
        };
    },

    /** Alle Spieler mit Vereinsbilanz - Ehemalige und aktuelle */
    _alleSpieler(state, clubId) {
        const c = state?.chronik?.[clubId];
        const liste = new Map();
        Object.entries(c?.spieler || {}).forEach(([id, a]) => {
            liste.set(String(id), { id, name: a[0], spiele: a[1], tore: a[2], vorlagen: a[3], von: a[4], bis: a[5], pos: a[6], aktiv: false });
        });
        (state.players || []).filter(p => p.clubId === clubId).forEach(p => {
            const b = this.bilanz(state, p, clubId);
            liste.set(String(p.id), { id: p.id, name: p.name, spiele: b.spiele, tore: b.tore, vorlagen: b.vorlagen, von: b.seit, bis: state.seasonYear || 1, pos: p.pos, aktiv: true });
        });
        return [...liste.values()].filter(s => s.spiele > 0);
    },

    /** Ist er eine Vereinslegende? */
    istLegende(eintrag, titelZahl = 0) {
        const L = this.LEGENDE;
        return eintrag.spiele >= L.spiele || eintrag.tore >= L.tore || (titelZahl >= L.titel && eintrag.spiele >= L.titelSpiele);
    },

    /** Alles für die Vereinsseite */
    uebersicht(state, clubId = state?.userClubId) {
        const c = state?.chronik?.[clubId];
        if (!c) return null;
        const spieler = this._alleSpieler(state, clubId);
        const titel = (c.titel || []).length;
        return {
            seit: c.seit,
            rekorde: c.rekorde || {},
            saisons: (c.saisons || []).slice().reverse(),
            titel: (c.titel || []).slice().reverse(),
            meisteSpiele: spieler.slice().sort((a, b) => b.spiele - a.spiele).slice(0, 5),
            meisteTore: spieler.filter(s => s.tore > 0).sort((a, b) => b.tore - a.tore || a.spiele - b.spiele).slice(0, 5),
            legenden: spieler.filter(s => this.istLegende(s, titel)).sort((a, b) => b.spiele - a.spiele)
        };
    }
};

if (typeof window !== "undefined") {
    window.ChronikEngine = ChronikEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { ChronikEngine };
}
