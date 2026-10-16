/**
 * JugendligaEngine - Die U19-Liga mit Tabelle und Ergebnissen
 *
 * Die Talente der Akademie standen bisher nur in einer Liste: Stärke,
 * Potenzial, ein Knopf zum Befördern. Ob einer trifft, ob der Jahrgang
 * etwas taugt, sah man nirgends.
 *
 * Jetzt spielt die U19 eine eigene Liga: zwölf Nachwuchsteams aus dem Land
 * des Vereins, Hin- und Rückrunde über die Saison verteilt, parallel zu
 * den Spieltagen der Profis. Die eigene U19 besteht aus den Talenten der
 * Akademie und den Spielern bis 19 aus dem Profikader, die dort nicht in
 * der Elf stehen; fehlen Spieler, füllt die Akademie mit Jugendspielern
 * nach ihrer Stufe auf. Die anderen Teams sind so stark wie die Akademie
 * ihres Vereins. Tore schießen die eigenen Talente namentlich - wer in der
 * U19 trifft, steht in der Torjägerliste. Am Ende gibt es einen Meister,
 * und die U19-Meisterschaft kommt in den Trophäenschrank.
 */

const _jlResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const JugendligaEngine = {
    TEAMS: 12,
    NAME: "U19-Liga",
    TITEL: "U19-Meisterschaft",

    _zufall() { return Math.random(); },

    _poisson(lambda) {
        const L = Math.exp(-lambda);
        let k = 0, p = 1;
        do { k++; p *= this._zufall(); } while (p > L && k < 12);
        return k - 1;
    },

    /** Wie stark die U19 eines Vereins im Mittel ist - nach Ligastufe und Akademie */
    basis(club) {
        const gen = _jlResolve("PlayerGenerator", "./playerGenerator.js");
        const bereich = gen && typeof gen.getAbilityRangeForLevel === "function" ? gen.getAbilityRangeForLevel(club?.level || 1) : { minCA: 128 };
        const akademie = Math.max(1, Math.min(5, (club?.facilities && club.facilities.youthCenter) || (club?.youthAcademy && club.youthAcademy.level) || 1));
        // Wie YouthEngine.talentWerte, ein Jahr älter: das Mittel eines Jahrgangs plus etwas Reife
        const ca = bereich.minCA * 0.72 + akademie * 3 + 10;
        return gen && typeof gen.toOverall === "function" ? gen.toOverall(ca) : Math.round(ca / 2);
    },

    /** Die eigene U19: Talente der Akademie und Profis bis 19 ohne Stammplatz */
    eigeneSpieler(state) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return [];
        const youth = _jlResolve("YouthEngine", "./youthEngine.js");
        const talente = (youth && typeof youth.eigeneTalente === "function" ? youth.eigeneTalente(state) : (state.youthAcademy?.prospects || []))
            .filter(t => t && !t.promoted);
        const elf = new Set((club.lineup || []).map(String));
        const junge = (state.players || []).filter(p => p.clubId === club.id && (p.age || 30) <= 19 && !elf.has(String(p.id))
            && (p.injuredWeeks || 0) <= 0 && !p.reserve);
        return talente.concat(junge);
    },

    eigeneStaerke(state) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        const spieler = this.eigeneSpieler(state).map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 11);
        const auffuellen = this.basis(club) - 4;
        while (spieler.length < 11) spieler.push(auffuellen);
        return spieler.reduce((s, x) => s + x, 0) / 11;
    },

    /** Zur neuen Saison: Teams, Spielplan und leere Tabelle */
    starte(state) {
        const saison = state.seasonYear || 1;
        if (state.jugendliga && state.jugendliga.saison === saison) return state.jugendliga;
        const eigen = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!eigen) return null;
        const land = eigen.countryId || "de";
        const andere = (state.clubs || []).filter(c => c.id !== eigen.id && (c.countryId || "de") === land)
            .sort((a, b) => (Math.abs((a.level || 1) - (eigen.level || 1)) - Math.abs((b.level || 1) - (eigen.level || 1)))
                || ((b.facilities?.youthCenter || 1) - (a.facilities?.youthCenter || 1)) || ((b.reputation || 0) - (a.reputation || 0)))
            .slice(0, this.TEAMS - 1);
        const teams = [{ clubId: eigen.id, name: `${eigen.name} U19`, staerke: null }]
            .concat(andere.map(c => ({ clubId: c.id, name: `${c.name} U19`, staerke: Math.round((this.basis(c) + (this._zufall() - 0.5) * 4) * 10) / 10 })));
        // Doppelrunde nach dem Kreisverfahren
        const n = teams.length - (teams.length % 2);
        const idx = teams.slice(0, n).map((_, i) => i);
        const hin = [];
        for (let r = 0; r < n - 1; r++) {
            const runde = [];
            for (let i = 0; i < n / 2; i++) {
                const a = idx[i], b = idx[n - 1 - i];
                runde.push(r % 2 === 0 ? [a, b] : [b, a]);
            }
            hin.push(runde);
            idx.splice(1, 0, idx.pop());
        }
        const runden = hin.concat(hin.map(r => r.map(([a, b]) => [b, a])));
        state.jugendliga = {
            saison, name: this.NAME, teams, runden, runde: 0,
            tabelle: teams.map(() => [0, 0, 0, 0, 0, 0]),      // s, u, n, tore, gegentore, punkte
            letzte: [], eigene: [], torschuetzen: {}, meister: null
        };
        return state.jugendliga;
    },

    /** Eine Runde spielen */
    spieltag(state) {
        const j = this.starte(state);
        if (!j || j.runde >= j.runden.length) return null;
        const eigenStaerke = this.eigeneStaerke(state);
        const staerke = (i) => (i === 0 ? eigenStaerke : j.teams[i].staerke);
        const ergebnisse = [];
        j.runden[j.runde].forEach(([h, a]) => {
            const diff = staerke(h) - staerke(a);
            const th = this._poisson(Math.max(0.3, 1.55 * Math.exp((diff + 1.5) / 14)));
            const ta = this._poisson(Math.max(0.3, 1.35 * Math.exp(-(diff + 1.5) / 14)));
            const buche = (i, t, g) => {
                const z = j.tabelle[i];
                z[3] += t; z[4] += g;
                if (t > g) { z[0]++; z[5] += 3; } else if (t === g) { z[1]++; z[5]++; } else z[2]++;
            };
            buche(h, th, ta); buche(a, ta, th);
            ergebnisse.push([h, a, th, ta]);
            if (h === 0 || a === 0) {
                const heim = h === 0;
                const tore = heim ? th : ta, gegentore = heim ? ta : th;
                const schuetzen = this._torschuetzen(state, tore);
                j.eigene.push({ runde: j.runde + 1, gegner: j.teams[heim ? a : h].name, heim, tore, gegentore, schuetzen: schuetzen.map(s => s.name) });
                schuetzen.forEach(s => {
                    const e = j.torschuetzen[String(s.id)] || (j.torschuetzen[String(s.id)] = { name: s.name, tore: 0 });
                    e.tore++;
                });
            }
        });
        j.letzte = ergebnisse;
        this._zaehleEinsaetze(state, j.saison);
        j.runde++;
        if (j.runde >= j.runden.length) this._saisonende(state);
        return ergebnisse;
    },

    /**
     * Wer in der Elf der U19 steht, sammelt Einsätze - das zählt für seine
     * Entwicklung (YouthEngine.wachstumsChance). Gezählt wird nur bei den
     * Talenten der Akademie; die Profis tragen dafür kein eigenes Feld.
     */
    _zaehleEinsaetze(state, saison) {
        const youth = _jlResolve("YouthEngine", "./youthEngine.js");
        if (!youth || typeof youth.eigeneTalente !== "function") return;
        const talente = new Set(youth.eigeneTalente(state).filter(t => t && !t.promoted));
        this.eigeneSpieler(state).slice().sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 11).forEach(p => {
            if (!talente.has(p)) return;
            if (p.u19Saison !== saison) { p.u19Saison = saison; p.u19Spiele = 0; }
            p.u19Spiele++;
        });
    },

    _torschuetzen(state, anzahl) {
        const spieler = this.eigeneSpieler(state);
        if (!spieler.length || !anzahl) return [];
        const vorne = { ST: 5, LA: 3, RA: 3, OM: 3, LM: 2, RM: 2, ZM: 1.5, DM: 0.7, LV: 0.5, RV: 0.5, IV: 0.5, TW: 0 };
        const gewicht = spieler.map(p => (vorne[p.pos] ?? 1) * Math.max(1, (p.overall || 40) - 35));
        const summe = gewicht.reduce((s, x) => s + x, 0);
        const wer = [];
        for (let i = 0; i < anzahl; i++) {
            if (summe <= 0) break;
            let r = this._zufall() * summe;
            let k = 0;
            while (k < spieler.length - 1 && r > gewicht[k]) { r -= gewicht[k]; k++; }
            wer.push({ id: spieler[k].id, name: spieler[k].name });
        }
        return wer;
    },

    /** Nach jedem Spieltag der Profis: die U19 holt auf, bis sie im Verhältnis gleich weit ist */
    nachSpieltag(state) {
        const j = this.starte(state);
        if (!j) return [];
        const gesamt = Math.max(1, state.totalMatchdays || (state.schedule ? state.schedule.length : 34));
        const soll = Math.min(j.runden.length, Math.floor((state.currentMatchday || 0) * j.runden.length / gesamt));
        const gespielt = [];
        while (j.runde < soll) gespielt.push(this.spieltag(state));
        return gespielt;
    },

    /** Die Tabelle, sortiert: [{ rang, name, eigen, spiele, s, u, n, tore, gegentore, punkte }] */
    tabelle(state) {
        const j = state && state.jugendliga;
        if (!j) return [];
        return j.teams.map((t, i) => {
            const z = j.tabelle[i];
            return { name: t.name, clubId: t.clubId, eigen: i === 0, spiele: z[0] + z[1] + z[2], s: z[0], u: z[1], n: z[2], tore: z[3], gegentore: z[4], punkte: z[5] };
        }).sort((a, b) => (b.punkte - a.punkte) || ((b.tore - b.gegentore) - (a.tore - a.gegentore)) || (b.tore - a.tore) || a.name.localeCompare(b.name))
            .map((z, i) => Object.assign(z, { rang: i + 1 }));
    },

    _saisonende(state) {
        const j = state.jugendliga;
        const tab = this.tabelle(state);
        const meister = tab[0];
        j.meister = meister ? meister.name : null;
        const eigen = tab.find(z => z.eigen);
        const besterTorschuetze = Object.values(j.torschuetzen).sort((a, b) => b.tore - a.tore)[0];
        if (meister && meister.eigen) {
            const chronik = _jlResolve("ChronikEngine", "./chronikEngine.js");
            if (chronik && typeof chronik.titel === "function") chronik.titel(state, this.TITEL, j.saison);
        }
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(this._zufall() * 1000), matchday: state.currentMatchday || 1, date: state.currentDate || "",
            sender: "Nachwuchsleiter",
            subject: meister && meister.eigen ? `🏅 Unsere U19 ist Meister!` : `U19-Liga: ${eigen ? `Platz ${eigen.rang}` : "Saison beendet"}`,
            body: (meister && meister.eigen
                ? `Die U19 holt die Meisterschaft der ${this.NAME} - ${meister.punkte} Punkte aus ${meister.spiele} Spielen.`
                : `Die ${this.NAME} ist gespielt. Meister: ${meister ? meister.name : "-"}. Unsere U19 wird ${eigen ? `${eigen.rang}.` : "-"} mit ${eigen ? eigen.punkte : 0} Punkten.`)
                + (besterTorschuetze ? `\n\nBester Torschütze unserer U19: ${besterTorschuetze.name} mit ${besterTorschuetze.tore} Toren.` : ""),
            read: false, type: "youth"
        });
    }
};

if (typeof window !== "undefined") {
    window.JugendligaEngine = JugendligaEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { JugendligaEngine };
}
