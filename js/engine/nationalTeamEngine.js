/**
 * NationalTeamEngine - Nationalmannschaften und Länderspielpausen
 *
 * Viermal in der Saison ruht der Ligabetrieb: im September, Oktober,
 * November und März. Die Nationen berufen ihre besten Spieler - aus allen
 * Vereinen der Welt, also auch aus dem eigenen Kader. Wer abgestellt ist,
 * trainiert nicht mit, bestreitet zwei Länderspiele und kommt müde zurück,
 * manchmal verletzt, meistens mit Stolz. Länderspiele und Tore stehen in
 * der Spielerakte.
 *
 * Die Partien werden schlank gerechnet (Stärke der besten Elf, Heimvorteil,
 * Poisson-Tore). Sie tauchen in keiner Vereinsstatistik auf - Sperren,
 * Spielpraxis und Saisontore bleiben unberührt.
 */

const NationalTeamEngine = {
    /** Wann in der Saison eine Pause liegt (Anteil der Spieltage) */
    PAUSEN: [0.1, 0.22, 0.34, 0.74],
    /** Eine Nation braucht so viele Spieler in der Welt, um anzutreten */
    MIN_SPIELER: 26,
    KADER: { TW: 3, def: 8, mid: 7, att: 5 },
    ELF: { TW: 1, def: 4, mid: 4, att: 2 },
    MUEDIGKEIT: 12,
    VERLETZUNG: 0.025,

    gruppe(pos) {
        if (pos === "TW") return "TW";
        if (["IV", "LV", "RV", "LIB"].includes(pos)) return "def";
        if (["LA", "RA", "ST", "MS", "HS"].includes(pos)) return "att";
        return "mid";
    },

    /** Nach welchen Spieltagen pausiert die Liga? */
    pausenNachSpieltag(gesamt) {
        const n = Math.max(1, gesamt || 34);
        const tage = this.PAUSEN.map(f => Math.max(1, Math.min(n - 1, Math.round(n * f))));
        return [...new Set(tage)];
    },

    /** Alle Nationen mit genügend Spielern, die Spieler nach Stärke sortiert */
    nationen(state) {
        const je = new Map();
        (state?.players || []).forEach(p => {
            if (!p || !p.nationality || !p.clubId || (p.age || 0) < 17) return;
            if (!je.has(p.nationality)) je.set(p.nationality, []);
            je.get(p.nationality).push(p);
        });
        const liste = [];
        je.forEach((spieler, name) => {
            if (spieler.length < this.MIN_SPIELER) return;
            spieler.sort((a, b) => (b.overall || 0) - (a.overall || 0));
            liste.push({ name, spieler });
        });
        return liste;
    },

    /** Die 23 Besten nach Mannschaftsteilen - verletzte bleiben zu Hause */
    nominiere(nation) {
        const kader = [];
        const zaehler = { TW: 0, def: 0, mid: 0, att: 0 };
        nation.spieler.forEach(p => {
            if ((p.injuredWeeks || 0) > 0 || p.injured) return;
            const g = this.gruppe(p.pos);
            if (zaehler[g] >= this.KADER[g]) return;
            zaehler[g]++;
            kader.push(p);
        });
        return kader;
    },

    /** Die beste Elf aus dem Kader und ihre Stärke */
    elf(kader) {
        const zaehler = { TW: 0, def: 0, mid: 0, att: 0 };
        const elf = [];
        kader.forEach(p => {
            const g = this.gruppe(p.pos);
            if (zaehler[g] >= this.ELF[g]) return;
            zaehler[g]++;
            elf.push(p);
        });
        const staerke = elf.reduce((a, p) => a + (p.overall || 0), 0) / Math.max(1, elf.length);
        return { elf, staerke };
    },

    /** Weltrangliste nach Stärke der besten Elf */
    rangliste(state) {
        return this.nationen(state)
            .map(n => ({ name: n.name, staerke: this.elf(this.nominiere(n)).staerke }))
            .sort((a, b) => b.staerke - a.staerke);
    },

    // ------------------------------------------------------------ Ablauf

    /**
     * Ein Tag der Länderspielpause. schritt: "abreise", "spiel" oder
     * "rueckkehr" (das zweite Spiel und die Heimreise am selben Tag).
     */
    tag(state, schritt, zufall = Math.random) {
        if (!state) return null;
        if (schritt === "abreise") return this.abreise(state);
        if (schritt === "spiel") return this.spieltag(state, zufall);
        if (schritt === "rueckkehr") {
            const spiel = this.spieltag(state, zufall);
            const zurueck = this.rueckkehr(state);
            return { spiel, zurueck };
        }
        return null;
    },

    abreise(state) {
        this.raeumeAuf(state);
        const pause = {
            saison: state.seasonYear || 1,
            nr: ((state.laenderspielPause?.saison === (state.seasonYear || 1)) ? (state.laenderspielPause.nr || 0) : 0) + 1,
            kader: {},
            spiele: [],
            runde: 0
        };
        this.nationen(state).forEach(n => {
            const kader = this.nominiere(n);
            pause.kader[n.name] = kader.map(p => p.id);
            kader.forEach(p => {
                p.abgestellt = n.name;
                // Die Berufung macht stolz
                p.morale = Math.min(100, (p.morale ?? 70) + 2);
            });
        });
        state.laenderspielPause = pause;

        const eigene = this.eigeneAbgestellte(state);
        if (eigene.length) {
            this._post(state, "Länderspielpause", `${eigene.length} Spieler abgestellt`,
                `Diese Spieler reisen zu ihren Nationalmannschaften und fehlen im Training:\n`
                + eigene.map(p => `• ${p.name} (${p.abgestellt})`).join("\n")
                + `\n\nNach zwei Länderspielen kommen sie zurück - müde, und mit etwas Pech verletzt.`);
        }
        return { nationen: Object.keys(pause.kader).length, eigene: eigene.map(p => p.id) };
    },

    /** Paarungen nach Weltrangliste: Nachbarn spielen gegeneinander, jede Runde versetzt */
    paarungen(namen, runde) {
        const liste = namen.slice();
        const paare = [];
        const start = runde % 2;
        for (let i = start; i + 1 < liste.length; i += 2) paare.push([liste[i], liste[i + 1]]);
        if (start === 1 && liste.length > 2) paare.push([liste[liste.length - 1], liste[0]]);
        return paare.map((p, i) => (i + runde) % 2 ? [p[1], p[0]] : p);
    },

    spieltag(state, zufall = Math.random) {
        const pause = state.laenderspielPause;
        if (!pause || !pause.kader) return [];
        const index = new Map((state.players || []).map(p => [String(p.id), p]));
        const teams = Object.entries(pause.kader).map(([name, ids]) => {
            const kader = ids.map(id => index.get(String(id))).filter(p => p && p.abgestellt === name && !(p.injuredWeeks > 0));
            return { name, kader, ...this.elf(kader) };
        }).filter(t => t.elf.length >= 11).sort((a, b) => b.staerke - a.staerke);

        const nachName = new Map(teams.map(t => [t.name, t]));
        const ergebnisse = this.paarungen(teams.map(t => t.name), pause.runde || 0).map(([h, a]) => {
            const heim = nachName.get(h), gast = nachName.get(a);
            return this.spiele(state, heim, gast, zufall);
        });
        pause.runde = (pause.runde || 0) + 1;
        pause.spiele.push(...ergebnisse.map(e => ({ h: e.heim, a: e.gast, t: e.tore, s: e.torschuetzen.map(t => t.id) })));
        return ergebnisse;
    },

    poisson(lambda, zufall) {
        const l = Math.exp(-lambda);
        let k = 0, p = 1;
        do { k++; p *= zufall(); } while (p > l && k < 12);
        return k - 1;
    },

    spiele(state, heim, gast, zufall = Math.random) {
        const diff = heim.staerke - gast.staerke;
        const tore = [
            this.poisson(1.3 * Math.exp(diff / 9) * 1.12, zufall),
            this.poisson(1.3 * Math.exp(-diff / 9) / 1.12, zufall)
        ];
        const torschuetzen = [];
        [heim, gast].forEach((team, s) => {
            // Wer spielt: die Elf und drei Einwechselspieler
            const bank = team.kader.filter(p => !team.elf.includes(p)).slice(0, 3);
            const eingesetzt = team.elf.concat(bank);
            eingesetzt.forEach(p => {
                p.laenderspiele = (p.laenderspiele || 0) + 1;
                p.fitness = Math.max(40, (p.fitness ?? 90) - this.MUEDIGKEIT * (team.elf.includes(p) ? 1 : 0.4));
                if (zufall() < this.VERLETZUNG * (team.elf.includes(p) ? 1 : 0.4)) {
                    p.injuredWeeks = 1 + Math.floor(zufall() * 3);
                    p.injured = true;
                    p.injuryName = "Verletzung aus dem Länderspiel";
                    p.daysSinceInjury = 0;
                    p.verletztVomLaenderspiel = true;
                }
            });
            const gewicht = p => ({ att: 5, mid: 2, def: 0.6, TW: 0 })[this.gruppe(p.pos)] * Math.max(0.3, (p.shooting || 50) / 70);
            for (let t = 0; t < tore[s]; t++) {
                const summe = eingesetzt.reduce((a, p) => a + gewicht(p), 0);
                let r = zufall() * summe;
                const schuetze = eingesetzt.find(p => (r -= gewicht(p)) <= 0) || eingesetzt[0];
                schuetze.laenderspielTore = (schuetze.laenderspielTore || 0) + 1;
                torschuetzen.push({ id: schuetze.id, name: schuetze.name, team: s });
            }
        });
        return { heim: heim.name, gast: gast.name, tore, torschuetzen };
    },

    rueckkehr(state) {
        const eigene = this.eigeneAbgestellte(state).map(p => ({ p, nation: p.abgestellt }));
        const pause = state.laenderspielPause;
        const verletzt = eigene.filter(e => e.p.verletztVomLaenderspiel).map(e => e.p);
        (state.players || []).forEach(p => {
            if (!p.abgestellt) return;
            delete p.abgestellt;
            delete p.verletztVomLaenderspiel;
        });
        if (eigene.length && pause) {
            const ids = new Set(eigene.map(e => String(e.p.id)));
            const nationen = new Set(eigene.map(e => e.nation));
            const zeilen = (pause.spiele || []).filter(s => nationen.has(s.h) || nationen.has(s.a)).map(s => {
                const tore = (s.s || []).filter(id => ids.has(String(id)))
                    .map(id => eigene.find(e => String(e.p.id) === String(id))?.p.name).filter(Boolean);
                return `• ${s.h} ${s.t[0]}:${s.t[1]} ${s.a}${tore.length ? ` - Tore: ${tore.join(", ")}` : ""}`;
            });
            this._post(state, "Länderspielpause", "Zurück von den Nationalmannschaften",
                `Die Abgestellten sind zurück.\n\n${zeilen.join("\n")}`
                + (verletzt.length ? `\n\nVerletzt zurück: ${verletzt.map(p => `${p.name} (${p.injuredWeeks} Wochen)`).join(", ")}` : "\n\nAlle kommen gesund zurück.")
                + `\n\nWer gespielt hat, braucht ein paar Tage, bis er wieder frisch ist.`);
        }
        return { eigene: eigene.map(e => e.p.id), verletzt: verletzt.map(p => p.id) };
    },

    /** Falls ein Spielstand mitten in einer Pause gespeichert wurde: Altlasten beenden */
    raeumeAuf(state) {
        (state.players || []).forEach(p => { if (p.abgestellt) delete p.abgestellt; });
    },

    eigeneAbgestellte(state) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return [];
        const ids = new Set((club.playerIds || []).map(String));
        return (state.players || []).filter(p => p.abgestellt && ids.has(String(p.id)));
    },

    /** Kurzer Text für die Spielerakte */
    akte(player) {
        if (!player || !(player.laenderspiele > 0) && !player.abgestellt) return null;
        const teile = [];
        if (player.laenderspiele > 0) teile.push(`${player.laenderspiele} Länderspiel${player.laenderspiele === 1 ? "" : "e"}`);
        if (player.laenderspielTore > 0) teile.push(`${player.laenderspielTore} Tor${player.laenderspielTore === 1 ? "" : "e"}`);
        return {
            nation: player.nationality,
            text: teile.join(", "),
            abgestellt: !!player.abgestellt
        };
    },

    _post(state, absender, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: absender,
            subject: betreff,
            body: text,
            read: false,
            type: "info"
        });
    }
};

if (typeof window !== "undefined") {
    window.NationalTeamEngine = NationalTeamEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { NationalTeamEngine };
}
