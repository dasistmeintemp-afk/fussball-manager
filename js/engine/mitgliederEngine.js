/**
 * Druck von außen: der Fanprotest in der Krise und die jährliche
 * Mitgliederversammlung.
 *
 * Fanprotest: Fällt die Fanstimmung tief und bleibt die Mannschaft sieglos,
 * schweigt die Kurve. Der Trainer antwortet einmal: vor die Kurve treten
 * (wirkt am meisten, kann aber kippen), öffentlich um Geduld bitten oder
 * aussitzen. Je nach Antwort bleibt beim nächsten Heimspiel ein Teil der
 * Plätze leer (FinanceEngine.applyMatchdayIncome fragt boykott() ab).
 *
 * Mitgliederversammlung: einmal je Saison zur Halbzeit der Spielzeit. Drei
 * Fragen - zur sportlichen Lage, zu den Finanzen, zu den Eintrittspreisen -
 * mit je drei Antworten. Was eine Antwort bewirkt, hängt an der Lage: Wer in
 * der Krise schönredet, verliert die Mitglieder. Am Ende steht die
 * Abstimmung über die Entlastung.
 *
 * Beides steht im Spielstand (state.fanprotest, state.mitglieder) und kommt
 * als Post mit Knopf; wer nicht antwortet, für den entscheidet die Zeit.
 */
"use strict";

function _mgResolve(name, pfad) {
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

const MitgliederEngine = {
    PROTEST: {
        ab: 38,           // Fanstimmung, ab der protestiert wird
        ohneSieg: 3,      // so viele Ligaspiele ohne Sieg
        fruehestens: 6,   // nicht vor diesem Spieltag
        pause: 8,         // Spieltage bis zum nächsten Protest
        vorstand: -3,     // der Vorstand sieht es nicht gern
        antworten: {
            kurve: { label: "Vor die Kurve treten", text: "Sie stellen sich nach dem Training den Fans. Das wirkt am meisten, kann aber kippen.",
                stimmung: 9, moral: 1, boykott: 0, risiko: 0.25, kippt: { stimmung: -4, moral: -2, boykott: 0.2 } },
            geduld: { label: "Öffentlich um Geduld bitten", text: "Eine Erklärung über die Vereinsmedien. Ohne Risiko, aber auch ohne große Wirkung.",
                stimmung: 4, moral: 0, boykott: 0.1 },
            aussitzen: { label: "Aussitzen", text: "Kein Wort dazu, die Mannschaft soll in Ruhe arbeiten. Beim nächsten Heimspiel bleibt ein Teil der Kurve leer.",
                stimmung: 0, moral: 1, boykott: 0.2 }
        }
    },

    /**
     * Die Fragen der Versammlung. lage(state) sagt "gut" oder "schlecht";
     * jede Antwort wirkt je nach Lage auf Fanstimmung (f), Vorstand (v) und
     * Mannschaft (m) und zählt für die Abstimmung (s).
     */
    FRAGEN: {
        sport: {
            frage: { gut: "Die Hinrunde lief gut. Was sagen Sie den Mitgliedern?", schlecht: "Die Hinrunde war enttäuschend. Was sagen Sie den Mitgliedern?" },
            antworten: {
                selbstkritisch: { label: "Selbstkritisch", text: "Fehler benennen, auch eigene.",
                    gut: { f: 1, v: 0, m: -1, s: 2 }, schlecht: { f: 4, v: 1, m: -1, s: 8 } },
                kaempferisch: { label: "Kämpferisch", text: "Die Mannschaft stärken, Ziele bekräftigen.",
                    gut: { f: 3, v: 1, m: 2, s: 6 }, schlecht: { f: 1, v: 0, m: 2, s: 2 } },
                schoenreden: { label: "Schönreden", text: "Alles halb so wild, der Trend stimmt.",
                    gut: { f: 1, v: 1, m: 1, s: 3 }, schlecht: { f: -5, v: -2, m: 0, s: -10 } }
            }
        },
        finanzen: {
            frage: { gut: "Der Verein steht finanziell solide da. Wie geht es weiter?", schlecht: "Das Konto ist im Minus. Wie geht es weiter?" },
            antworten: {
                offen: { label: "Die Zahlen offen nennen", text: "Transparenz, auch wenn es wehtut.",
                    gut: { f: 2, v: 1, m: 0, s: 5 }, schlecht: { f: 2, v: 2, m: 0, s: 5 } },
                sparen: { label: "Einen Sparkurs ankündigen", text: "Solide wirtschaften geht vor.",
                    gut: { f: -2, v: 2, m: -1, s: -2 }, schlecht: { f: 1, v: 3, m: -1, s: 6 } },
                investieren: { label: "Investitionen versprechen", text: "Neue Spieler, bessere Anlagen.",
                    gut: { f: 4, v: -1, m: 1, s: 6 }, schlecht: { f: 2, v: -4, m: 1, s: -6 } }
            }
        },
        preise: {
            frage: { gut: "Ein Mitglied fragt nach den Eintrittspreisen. Sie sind moderat.", schlecht: "Ein Mitglied beklagt die hohen Eintrittspreise." },
            antworten: {
                einfrieren: { label: "Preise für diese Saison einfrieren", text: "Ein Versprechen: Bis zum Saisonende wird nicht erhöht.",
                    gut: { f: 3, v: -1, m: 0, s: 5 }, schlecht: { f: 6, v: -2, m: 0, s: 9 }, preisStopp: true },
                verteidigen: { label: "Die Preise verteidigen", text: "Qualität hat ihren Preis.",
                    gut: { f: 0, v: 1, m: 0, s: 0 }, schlecht: { f: -4, v: 2, m: 0, s: -7 } },
                ausweichen: { label: "Ausweichen", text: "Das prüft der Vorstand.",
                    gut: { f: -1, v: 0, m: 0, s: -2 }, schlecht: { f: -2, v: 0, m: 0, s: -4 } }
            }
        }
    },
    /** Ab dem Wievielfachen des üblichen Preises der Eintritt als hoch gilt */
    PREIS_HOCH: 1.25,
    /** Wer nach so vielen Spieltagen nicht geantwortet hat, für den läuft es ohne ihn */
    FRIST: 4,
    /** Wer trotz Versprechen die Preise erhöht, verliert so viel Fanstimmung */
    PREIS_BRUCH: -8,

    _club(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },
    _saison(state) { return state?.seasonYear || 1; },
    _spieltag(state) { return state?.currentMatchday || 1; },

    _stimmung(state, delta) {
        if (!delta) return;
        state.fanMood = Math.round(Math.max(10, Math.min(100, (state.fanMood ?? 70) + delta)));
    },
    _vorstand(state, delta) {
        if (!delta) return;
        const b = _mgResolve("BoardEngine", "./boardEngine.js");
        if (b && typeof b.stimmung === "function") b.stimmung(state, delta);
        else if (typeof state.boardConfidence === "number") state.boardConfidence = Math.max(10, Math.min(100, state.boardConfidence + delta));
    },
    _moral(state, delta) {
        if (!delta) return;
        const club = this._club(state);
        const ids = new Set((club?.playerIds || []).map(String));
        (state.players || []).forEach(p => { if (ids.has(String(p.id)) && !p.reserve) p.morale = Math.max(5, Math.min(100, (p.morale ?? 75) + delta)); });
    },
    _post(state, absender, betreff, text, aktion = null) {
        if (!Array.isArray(state.inbox)) return;
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday}`, sender: absender,
            subject: betreff, body: text, read: false, type: "board_message", ...(aktion ? { aktion } : {})
        });
    },

    // ------------------------------------------------------------ Fanprotest

    /** Der offene Protest dieser Saison, oder null */
    protest(state) {
        const p = state?.fanprotest;
        return p && p.saison === this._saison(state) && p.offen ? p : null;
    },

    /** Nach dem Spieltag: Kommt es zum Protest? */
    pruefeProtest(state) {
        const club = this._club(state);
        if (!club) return null;
        const P = this.PROTEST, tag = this._spieltag(state), saison = this._saison(state);
        const alt = state.fanprotest && state.fanprotest.saison === saison ? state.fanprotest : null;
        // Ein unbeantworteter Protest gilt nach der Frist als ausgesessen
        if (alt && alt.offen && tag - alt.spieltag >= this.FRIST) this.antworte(state, "aussitzen", Math.random, true);
        if (this.protest(state)) return null;
        if (tag < P.fruehestens || (alt && tag - alt.spieltag < P.pause)) return null;
        if ((state.fanMood ?? 70) > P.ab) return null;
        const form = (club.form || []).filter(r => r && r !== "-").slice(-P.ohneSieg);
        if (form.length < P.ohneSieg || form.includes("W")) return null;
        state.fanprotest = { saison, spieltag: tag, offen: true, boykott: P.antworten.aussitzen.boykott };
        this._vorstand(state, P.vorstand);
        this._post(state, "Fanbeauftragter", "Fanprotest: Die Kurve schweigt",
            `Nach ${P.ohneSieg} Spielen ohne Sieg haben die Fangruppen genug: Spruchbänder am Trainingsgelände, und für das nächste Heimspiel ist ein Stimmungsboykott angekündigt. `
            + "Der Vorstand ist beunruhigt.\n\nSie können einmal antworten: vor die Kurve treten, öffentlich um Geduld bitten oder die Sache aussitzen. "
            + `Ohne Antwort gilt der Protest nach ${this.FRIST} Spieltagen als ausgesessen.`, "fanprotest");
        return state.fanprotest;
    },

    /** Auf den Protest antworten: "kurve", "geduld" oder "aussitzen" */
    antworte(state, art, zufall = Math.random, still = false) {
        const p = this.protest(state);
        if (!p) return { ok: false, grund: "Es gibt gerade keinen Protest." };
        const a = this.PROTEST.antworten[art];
        if (!a) return { ok: false, grund: "Diese Antwort gibt es nicht." };
        const gekippt = !!a.risiko && zufall() < a.risiko;
        const w = gekippt ? a.kippt : a;
        this._stimmung(state, w.stimmung);
        this._moral(state, w.moral);
        p.offen = false;
        p.antwort = art;
        p.gekippt = gekippt;
        p.boykott = w.boykott;
        const text = art === "kurve"
            ? (gekippt ? "Das Gespräch an der Kurve läuft aus dem Ruder: Pfiffe, Sprechchöre gegen die Mannschaft. Der Boykott bleibt."
                : "Sie stellen sich den Fans, hören zu und erklären. Die Kurve sagt den Boykott ab.")
            : art === "geduld" ? "Ihre Erklärung kommt an, aber nicht bei allen: Ein Teil der Kurve bleibt beim nächsten Heimspiel weg."
                : "Sie äußern sich nicht. Die Mannschaft arbeitet in Ruhe, beim nächsten Heimspiel bleibt ein Teil der Kurve leer.";
        if (!still) this._post(state, "Fanbeauftragter", "Fanprotest: Ihre Antwort", text);
        return { ok: true, art, gekippt, boykott: p.boykott, text };
    },

    /**
     * Anteil der Plätze, die beim nächsten Heimspiel leer bleiben (0 bis 0,2).
     * verbrauche = true: Das Heimspiel findet statt, danach ist der Boykott vorbei.
     */
    boykott(state, verbrauche = false) {
        const p = state?.fanprotest;
        if (!p || p.saison !== this._saison(state) || !(p.boykott > 0)) return 0;
        const b = p.boykott;
        if (verbrauche) { p.boykott = 0; if (p.offen) { p.offen = false; p.antwort = "aussitzen"; } }
        return b;
    },

    // -------------------------------------------------- Mitgliederversammlung

    /** Wie die Lage bei einem Thema ist: "gut" oder "schlecht" */
    lage(state, thema) {
        const club = this._club(state);
        if (!club) return "gut";
        if (thema === "finanzen") return (club.balance || 0) < 0 ? "schlecht" : "gut";
        if (thema === "preise") {
            // Der übliche Preis eines Vereins seines Rufs (wie ClubGenerator ihn ansetzt)
            const ueblich = (club.reputation || 70) / 2.2 + 4;
            return (club.ticketPrice || 35) > ueblich * this.PREIS_HOCH ? "schlecht" : "gut";
        }
        const tabelle = state.standingsByLeague?.[club.leagueId] || state.standings || [];
        const platz = tabelle.findIndex(e => e.clubId === club.id) + 1;
        const b = _mgResolve("BoardEngine", "./boardEngine.js");
        const ziel = b && typeof b.zielPlatz === "function" ? b.zielPlatz(state, club) : Math.ceil(tabelle.length / 2);
        return platz > 0 && platz > ziel + 2 ? "schlecht" : "gut";
    },

    /** Die anstehende Versammlung dieser Saison, oder null */
    versammlung(state) {
        const m = state?.mitglieder;
        return m && m.saison === this._saison(state) && m.offen ? m : null;
    },

    /** Nach dem Spieltag: Zur Saisonhälfte lädt der Verein ein */
    pruefeVersammlung(state) {
        const club = this._club(state);
        if (!club) return null;
        const tag = this._spieltag(state), saison = this._saison(state);
        const m = state.mitglieder && state.mitglieder.saison === saison ? state.mitglieder : null;
        if (m && m.offen && tag - m.spieltag >= this.FRIST) { this.ohneTrainer(state); return null; }
        if (m) return null;
        const spieltage = Array.isArray(state.schedule) && state.schedule.length ? state.schedule.length : 34;
        if (tag < Math.floor(spieltage / 2) + 1) return null;
        state.mitglieder = { saison, spieltag: tag, offen: true, lage: { sport: this.lage(state, "sport"), finanzen: this.lage(state, "finanzen"), preise: this.lage(state, "preise") } };
        this._post(state, "Präsidium", "Einladung zur Mitgliederversammlung",
            "Die Mitglieder kommen zur Jahreshauptversammlung zusammen. Als Cheftrainer stehen Sie Rede und Antwort: zur sportlichen Lage, zu den Finanzen und zu den Eintrittspreisen. "
            + "Am Ende stimmen die Mitglieder über die Entlastung ab.\n\n"
            + `Was Ihre Antworten bewirken, hängt an der Lage. Erscheinen Sie nicht, findet die Versammlung nach ${this.FRIST} Spieltagen ohne Sie statt.`, "mitglieder");
        return state.mitglieder;
    },

    /** Die drei Fragen, wie sie heute gestellt werden */
    fragen(state) {
        const m = this.versammlung(state);
        if (!m) return [];
        return Object.keys(this.FRAGEN).map(thema => {
            const f = this.FRAGEN[thema], lage = m.lage[thema] || "gut";
            return { thema, lage, frage: f.frage[lage], antworten: Object.keys(f.antworten).map(key => ({ key, label: f.antworten[key].label, text: f.antworten[key].text })) };
        });
    },

    /**
     * Die Rede halten: antworten = { sport, finanzen, preise } mit je einem
     * Schlüssel. Rückgabe mit der Abstimmung über die Entlastung in Prozent.
     */
    halteRede(state, antworten) {
        const m = this.versammlung(state);
        if (!m) return { ok: false, grund: "Es steht keine Mitgliederversammlung an." };
        const themen = Object.keys(this.FRAGEN);
        if (themen.some(t => !this.FRAGEN[t].antworten[(antworten || {})[t]])) return { ok: false, grund: "Beantworten Sie alle drei Fragen." };
        let f = 0, v = 0, mo = 0, s = 0, preisStopp = false;
        themen.forEach(t => {
            const a = this.FRAGEN[t].antworten[antworten[t]];
            const w = a[m.lage[t] || "gut"];
            f += w.f; v += w.v; mo += w.m; s += w.s;
            if (a.preisStopp) preisStopp = true;
        });
        // Die Abstimmung: Grundstimmung der Fans plus das, was die Rede bewegt hat
        const entlastung = Math.round(Math.max(20, Math.min(98, 62 + ((state.fanMood ?? 70) - 70) * 0.4 + s)));
        const urteil = entlastung >= 80 ? "klar" : (entlastung >= 55 ? "knapp" : "verweigert");
        if (urteil === "klar") f += 2;
        if (urteil === "verweigert") { v -= 5; f -= 2; }
        this._stimmung(state, f);
        this._vorstand(state, v);
        this._moral(state, mo);
        const club = this._club(state);
        Object.assign(m, { offen: false, antworten: { ...antworten }, entlastung, urteil,
            preisStopp: preisStopp && club ? (club.ticketPrice || 35) : null });
        const text = urteil === "klar" ? `Die Mitglieder entlasten die Vereinsführung mit ${entlastung} %. Ein starker Rückhalt.`
            : urteil === "knapp" ? `Die Entlastung geht mit ${entlastung} % durch. Die Mitglieder bleiben wachsam.`
                : `Nur ${entlastung} % stimmen für die Entlastung: ein Denkzettel. Der Vorstand ist verärgert.`;
        this._post(state, "Präsidium", `Mitgliederversammlung: Entlastung mit ${entlastung} %`,
            text + (m.preisStopp ? ` Ihr Versprechen steht: Bis zum Saisonende bleibt der Eintrittspreis bei höchstens ${m.preisStopp} €.` : ""));
        return { ok: true, entlastung, urteil, wirkung: { fans: f, vorstand: v, moral: mo }, preisStopp: m.preisStopp, text };
    },

    /** Die Versammlung findet ohne den Trainer statt */
    ohneTrainer(state) {
        const m = this.versammlung(state);
        if (!m) return null;
        const entlastung = Math.round(Math.max(20, Math.min(90, 55 + ((state.fanMood ?? 70) - 70) * 0.4)));
        this._stimmung(state, -3);
        this._vorstand(state, -2);
        Object.assign(m, { offen: false, entlastung, urteil: entlastung >= 55 ? "knapp" : "verweigert", ohneTrainer: true, preisStopp: null });
        this._post(state, "Präsidium", "Mitgliederversammlung ohne den Trainer",
            `Sie sind der Versammlung ferngeblieben, das kam nicht gut an. Die Entlastung ging mit ${entlastung} % durch.`);
        return m;
    },

    /**
     * Wird der Eintrittspreis trotz Versprechen erhöht? Meldet den Bruch
     * einmal und kostet Fanstimmung.
     */
    pruefePreisversprechen(state) {
        const m = state?.mitglieder, club = this._club(state);
        if (!m || m.saison !== this._saison(state) || !m.preisStopp || !club) return false;
        if ((club.ticketPrice || 35) <= m.preisStopp) return false;
        m.preisStopp = null;
        this._stimmung(state, this.PREIS_BRUCH);
        this._post(state, "Fanbeauftragter", "Gebrochenes Versprechen",
            "Auf der Mitgliederversammlung haben Sie zugesagt, die Eintrittspreise in dieser Saison nicht zu erhöhen. Jetzt sind sie gestiegen. Die Fans sind wütend.");
        return true;
    },

    /** Alles, was nach einem Spieltag ansteht */
    nachSpieltag(state) {
        this.pruefePreisversprechen(state);
        return { protest: this.pruefeProtest(state), versammlung: this.pruefeVersammlung(state) };
    }
};

if (typeof window !== "undefined") {
    window.MitgliederEngine = MitgliederEngine;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { MitgliederEngine };
}
