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
        const nt = state.nationaltrainer;
        let nutzer = null;
        this.nationen(state).forEach(n => {
            // Die eigene Nation reist mit dem Kader des Nutzers
            const eigene = nt && nt.nation === n.name ? this.nutzerKader(state, n.name) : null;
            if (eigene) nutzer = eigene;
            const kader = eigene ? eigene.kader : this.nominiere(n);
            pause.kader[n.name] = kader.map(p => p.id);
            kader.forEach(p => {
                p.abgestellt = n.name;
                // Die Berufung macht stolz
                p.morale = Math.min(100, (p.morale ?? 70) + 2);
            });
        });
        state.laenderspielPause = pause;
        if (nt && nutzer && nutzer.ersetzt.length) {
            const name = id => state.players.find(p => String(p.id) === String(id))?.name || "ein Spieler";
            const aus = nutzer.ersetzt.map(name), nach = nutzer.nachgerueckt.map(p => p.name);
            this._post(state, `Verband ${nt.nation}`, "Nachnominierung",
                `Aus deiner Auswahl ${aus.length === 1 ? "fällt" : "fallen"} ${aus.join(", ")} aus (verletzt oder nicht mehr verfügbar). `
                + (nach.length === 1 ? `Nachnominiert: ${nach[0]} - der Beste seines Mannschaftsteils, den du nicht gestrichen hattest.`
                    : nach.length ? `Nachnominiert: ${nach.join(", ")} - die Besten ihres Mannschaftsteils, die du nicht gestrichen hattest.` : ""));
        }

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
        // Bei gerader Zahl bleiben in der versetzten Runde der Erste und der
        // Letzte übrig und spielen gegeneinander. Bei ungerader Zahl hat der
        // Letzte schon gespielt - er bekam sonst ein zweites Spiel am selben
        // Tag; dann setzt eben der Erste aus.
        if (start === 1 && liste.length > 2 && liste.length % 2 === 0) paare.push([liste[liste.length - 1], liste[0]]);
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
        // Die Ausrichtung des Nutzers: mehr Tore auf beiden Seiten oder weniger
        const nt = state?.nationaltrainer;
        const a = nt ? this.AUSRICHTUNG[nt.ausrichtung] || this.AUSRICHTUNG.ausgewogen : null;
        const faktor = [1, 1];
        if (a && heim.name === nt.nation) { faktor[0] = a.eigen; faktor[1] = a.gegner; }
        if (a && gast.name === nt.nation) { faktor[1] = a.eigen; faktor[0] = a.gegner; }
        const tore = [
            this.poisson(1.3 * Math.exp(diff / 9) * 1.12 * faktor[0], zufall),
            this.poisson(1.3 * Math.exp(-diff / 9) / 1.12 * faktor[1], zufall)
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
        if (nt && (heim.name === nt.nation || gast.name === nt.nation)) this._verbucheNutzerSpiel(state, heim, gast, tore);
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

    // ------------------------------------------------- Der Nutzer als Nationaltrainer

    /**
     * Nebenbei eine Nationalmannschaft trainieren.
     *
     * Jede Saison sind einige Posten frei. Wer genug Ruf hat, bewirbt sich
     * (oder bekommt zum Saisonstart ein Angebot) und betreut die Auswahl neben
     * seinem Verein. Vor jeder Länderspielpause bestimmt er den Kader - sonst
     * stellt der Verband die 23 Besten - und die Ausrichtung. Der Verband
     * misst jedes Spiel an dem, was nach Stärke zu erwarten war; wer zu oft
     * enttäuscht, ist den Posten zum Saisonende los. Ein Erfolg hebt den Ruf
     * des Trainers.
     */

    /** Ruf, den ein Verband verlangt - nach Weltrang */
    ANFORDERUNG: [{ bisRang: 3, ruf: 82 }, { bisRang: 8, ruf: 72 }, { bisRang: 14, ruf: 62 }, { bisRang: 999, ruf: 52 }],
    /** Für die eigene Nationalität genügt etwas weniger */
    HEIMAT_BONUS: 6,
    /** Anteil der Posten, die je Saison frei werden (mindestens zwei) */
    FREI_ANTEIL: 0.25,
    AUSRICHTUNG: {
        defensiv: { eigen: 0.85, gegner: 0.82, text: "Defensiv" },
        ausgewogen: { eigen: 1, gegner: 1, text: "Ausgewogen" },
        offensiv: { eigen: 1.15, gegner: 1.12, text: "Offensiv" }
    },
    /** Unter diesem Vertrauen ist der Posten zum Saisonende weg */
    ENTLASSUNG_UNTER: 25,

    _ruf(state) {
        const career = (typeof CareerEngine !== "undefined" && CareerEngine)
            || (typeof window !== "undefined" && window.CareerEngine)
            || (typeof require !== "undefined" ? (() => { try { return require("./careerEngine.js").CareerEngine; } catch (e) { return null; } })() : null);
        return career && typeof career.ruf === "function" ? career.ruf(state) : 50;
    },

    anforderung(state, rang, nation) {
        const stufe = this.ANFORDERUNG.find(a => rang <= a.bisRang) || this.ANFORDERUNG[this.ANFORDERUNG.length - 1];
        return stufe.ruf - (nation && nation === state.managerNationality ? this.HEIMAT_BONUS : 0);
    },

    /** Welche Posten sind in dieser Saison frei? Einmal je Saison ausgewürfelt. */
    freiePosten(state, zufall = Math.random) {
        const saison = state.seasonYear || 1;
        if (!state.nationalPosten || state.nationalPosten.saison !== saison) {
            const namen = this.rangliste(state).map(r => r.name);
            const anzahl = Math.max(2, Math.round(namen.length * this.FREI_ANTEIL));
            const frei = namen.slice().sort(() => zufall() - 0.5).slice(0, anzahl);
            // Die eigene Nationalität ist oft dabei - sie hält Ausschau nach Landsleuten
            if (state.managerNationality && namen.includes(state.managerNationality)
                && !frei.includes(state.managerNationality) && zufall() < 0.5) frei.push(state.managerNationality);
            state.nationalPosten = { saison, frei };
        }
        const besetzt = state.nationaltrainer?.nation;
        return state.nationalPosten.frei.filter(n => n !== besetzt);
    },

    /** Alle Nationen mit Rang, Stärke, Anforderung und ob der Posten frei ist */
    posten(state) {
        const ruf = this._ruf(state);
        const frei = new Set(this.freiePosten(state));
        return this.rangliste(state).map((r, i) => {
            const anforderung = this.anforderung(state, i + 1, r.name);
            return { name: r.name, rang: i + 1, staerke: r.staerke, anforderung, frei: frei.has(r.name), reicht: ruf >= anforderung };
        });
    },

    bewerben(state, nation) {
        if (state.nationaltrainer) return { ok: false, grund: `Du trainierst schon ${state.nationaltrainer.nation}.` };
        const p = this.posten(state).find(x => x.name === nation);
        if (!p) return { ok: false, grund: "Diese Nation hat keine Mannschaft." };
        if (!p.frei) return { ok: false, grund: `${nation} hat einen Trainer.` };
        const ruf = this._ruf(state);
        if (ruf < p.anforderung) return { ok: false, grund: `Der Verband verlangt einen Ruf von ${p.anforderung}, deiner liegt bei ${ruf}.` };
        this._uebernimm(state, nation, p.rang);
        return { ok: true, nation };
    },

    _uebernimm(state, nation, rang) {
        state.nationaltrainer = {
            nation, rangBeiAntritt: rang, seitSaison: state.seasonYear || 1,
            vertrauen: 60, ausrichtung: "ausgewogen", auswahl: null, spiele: []
        };
        if (state.nationalAngebot) delete state.nationalAngebot;
        this._post(state, `Verband ${nation}`, `Neuer Nationaltrainer: ${state.managerName || "du"}`,
            `Willkommen als Nationaltrainer von ${nation}! Du betreust die Auswahl neben deinem Verein.\n\n`
            + `Vor jeder Länderspielpause bestimmst du im Reiter Nationalteam den Kader - sonst beruft der Verband die 23 Besten. `
            + `Wir messen dich an den Ergebnissen gegen gleich starke und stärkere Gegner.`);
    },

    /** Zum Saisonstart: Wer genug Ruf hat, bekommt vielleicht ein Angebot */
    pruefeAngebot(state, zufall = Math.random) {
        if (state.nationaltrainer || state.arbeitslos) return null;
        if (state.nationalAngebot && state.nationalAngebot.saison === (state.seasonYear || 1)) return state.nationalAngebot;
        const passend = this.posten(state).filter(p => p.frei && p.reicht);
        if (!passend.length || zufall() > 0.6) return null;
        // Die stärkste Nation, die passt - die eigene, wenn sie dabei ist
        const wahl = passend.find(p => p.name === state.managerNationality) || passend[0];
        state.nationalAngebot = { nation: wahl.name, rang: wahl.rang, saison: state.seasonYear || 1 };
        this._post(state, `Verband ${wahl.name}`, `Angebot: Nationaltrainer von ${wahl.name}`,
            `Der Verband von ${wahl.name} (Weltrang ${wahl.rang}) möchte dich als Nationaltrainer - neben deinem Verein. `
            + `Annehmen oder ablehnen im Reiter Nationalteam; das Angebot gilt bis zum Ende der Saison.`);
        return state.nationalAngebot;
    },

    nimmAngebotAn(state) {
        const a = state.nationalAngebot;
        if (!a || a.saison !== (state.seasonYear || 1)) return { ok: false, grund: "Kein Angebot." };
        if (state.nationaltrainer) return { ok: false, grund: "Du trainierst schon eine Nation." };
        this._uebernimm(state, a.nation, a.rang);
        return { ok: true, nation: a.nation };
    },

    lehneAngebotAb(state) {
        if (!state.nationalAngebot) return false;
        delete state.nationalAngebot;
        return true;
    },

    ruecktritt(state) {
        const nt = state.nationaltrainer;
        if (!nt) return false;
        this._beende(state, "Rücktritt");
        return true;
    },

    _beende(state, wie) {
        const nt = state.nationaltrainer;
        if (!nt) return;
        const b = this.bilanz(nt);
        state.nationaltrainerAkte = (state.nationaltrainerAkte || []).concat([{
            nation: nt.nation, vonSaison: nt.seitSaison, bisSaison: state.seasonYear || 1, ende: wie, ...b
        }]);
        // Der Posten ist frei - für einen anderen
        if (state.nationalPosten && !state.nationalPosten.frei.includes(nt.nation)) state.nationalPosten.frei.push(nt.nation);
        state.nationaltrainer = null;
    },

    bilanz(nt) {
        const s = (nt?.spiele || []);
        const b = { spiele: s.length, siege: 0, remis: 0, niederlagen: 0, tore: 0, gegentore: 0 };
        s.forEach(x => {
            b.tore += x.tore[0]; b.gegentore += x.tore[1];
            if (x.tore[0] > x.tore[1]) b.siege++; else if (x.tore[0] === x.tore[1]) b.remis++; else b.niederlagen++;
        });
        return b;
    },

    /** Spieler, die für die eigene Nation spielen können - die Besten zuerst */
    kandidaten(state, nation) {
        const n = this.nationen(state).find(x => x.name === nation);
        return n ? n.spieler : [];
    },

    /**
     * Der Kader des Nutzers für die nächste Pause: seine Auswahl, soweit die
     * Spieler fit sind und noch für die Nation spielen. Fehlt jemand, rückt
     * der Beste seines Mannschaftsteils nach - aber nicht, wen der Trainer
     * aus dem Vorschlag gestrichen hat, solange es einen anderen gibt. Vorher
     * holte die Nachnominierung genau den Star zurück, den er zu Hause lassen
     * wollte.
     */
    nutzerKader(state, nation) {
        const alle = this.kandidaten(state, nation);
        const wahl = state.nationaltrainer?.auswahl;
        if (!Array.isArray(wahl) || !wahl.length) return { kader: this.nominiere({ spieler: alle }), ersetzt: [], nachgerueckt: [] };
        const fit = p => !((p.injuredWeeks || 0) > 0 || p.injured);
        const index = new Map(alle.map(p => [String(p.id), p]));
        const gestrichen = new Set((state.nationaltrainer.gestrichen || []).map(String));
        const kader = [], ersetzt = [], nachgerueckt = [];
        const zaehler = { TW: 0, def: 0, mid: 0, att: 0 };
        wahl.forEach(id => {
            const p = index.get(String(id));
            if (!p || !fit(p)) { ersetzt.push(id); return; }
            kader.push(p);
            zaehler[this.gruppe(p.pos)]++;
        });
        // Lücken je Mannschaftsteil mit den Besten auffüllen: erst ohne die
        // Gestrichenen, dann notfalls auch mit ihnen
        const fuelle = (erlaubt) => alle.forEach(p => {
            if (kader.length >= 23 || kader.includes(p) || !fit(p) || !erlaubt(p)) return;
            const g = this.gruppe(p.pos);
            if (zaehler[g] >= this.KADER[g]) return;
            zaehler[g]++;
            kader.push(p);
            nachgerueckt.push(p);
        });
        fuelle(p => !gestrichen.has(String(p.id)));
        fuelle(() => true);
        return { kader, ersetzt, nachgerueckt };
    },

    setzeAuswahl(state, ids) {
        const nt = state.nationaltrainer;
        if (!nt) return false;
        nt.auswahl = Array.isArray(ids) && ids.length ? ids.slice(0, 23) : null;
        // Wen der Trainer aus dem Vorschlag des Verbands gestrichen hat
        const gewaehlt = new Set((nt.auswahl || []).map(String));
        nt.gestrichen = nt.auswahl
            ? this.nominiere({ spieler: this.kandidaten(state, nt.nation) }).map(p => p.id).filter(id => !gewaehlt.has(String(id)))
            : [];
        return true;
    },

    setzeAusrichtung(state, art) {
        if (!state.nationaltrainer || !this.AUSRICHTUNG[art]) return false;
        state.nationaltrainer.ausrichtung = art;
        return true;
    },

    /** Was ein Spiel nach Stärke an Punkten erwarten ließ */
    erwartetePunkte(diff) {
        return Math.max(0.2, Math.min(2.7, 1.35 + diff * 0.11));
    },

    _verbucheNutzerSpiel(state, heim, gast, tore) {
        const nt = state.nationaltrainer;
        if (!nt) return;
        const istHeim = heim.name === nt.nation;
        const eigen = istHeim ? heim : gast, gegner = istHeim ? gast : heim;
        const t = istHeim ? tore : [tore[1], tore[0]];
        const punkte = t[0] > t[1] ? 3 : t[0] === t[1] ? 1 : 0;
        const erwartet = this.erwartetePunkte(eigen.staerke - gegner.staerke);
        nt.vertrauen = Math.max(0, Math.min(100, Math.round((nt.vertrauen ?? 60) + (punkte - erwartet) * 5)));
        nt.spiele.push({
            saison: state.seasonYear || 1, gegner: gegner.name, heim: istHeim, tore: t,
            erwartet: Math.round(erwartet * 10) / 10, ausrichtung: nt.ausrichtung
        });
        if (nt.spiele.length > 40) nt.spiele.splice(0, nt.spiele.length - 40);
    },

    /** Zum Saisonende: Der Verband zieht Bilanz */
    saisonBilanz(state) {
        const nt = state.nationaltrainer;
        if (!nt) return null;
        const saison = state.seasonYear || 1;
        const b = this.bilanz({ spiele: nt.spiele.filter(s => s.saison === saison) });
        if ((nt.vertrauen ?? 60) < this.ENTLASSUNG_UNTER) {
            const nation = nt.nation;
            this._beende(state, "entlassen");
            this._post(state, `Verband ${nation}`, "Trennung als Nationaltrainer",
                `Der Verband von ${nation} trennt sich von dir. Bilanz dieser Saison: ${b.siege} Siege, ${b.remis} Remis, ${b.niederlagen} Niederlagen. Dein Verein bleibt davon unberührt.`);
            return { entlassen: true, ...b };
        }
        this._post(state, `Verband ${nt.nation}`, `Saisonbilanz der Nationalmannschaft`,
            `${b.spiele} Länderspiele: ${b.siege} Siege, ${b.remis} Remis, ${b.niederlagen} Niederlagen (${b.tore}:${b.gegentore}). `
            + `Das Vertrauen des Verbands liegt bei ${nt.vertrauen} %.`);
        return { entlassen: false, ...b };
    },

    /** Ruf: Ein Nationaltrainer mit Rückhalt ist gefragter */
    rufBonus(state) {
        const nt = state?.nationaltrainer;
        if (!nt || (nt.vertrauen ?? 60) < 50) return 0;
        return (nt.rangBeiAntritt || 99) <= 8 ? 4 : 2;
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
