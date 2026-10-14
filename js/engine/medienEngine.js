/**
 * MedienEngine - Die Spieler reden mit der Presse
 *
 * In den Medien kam bisher nur der Trainer vor: auf der Pressekonferenz.
 * Die Spieler blieben stumm, ganz gleich, ob einer seit Wochen auf der Bank
 * saß, im Derby zweimal traf oder sein Vertrag auslief.
 *
 * Jetzt gibt nach einem Ligaspiel ab und zu einer ein Interview, je nach
 * Lage: der Frustrierte, der zu selten spielt; der Matchwinner; das
 * Talent nach einem starken Auftritt; der Kapitän nach einer Pleitenserie;
 * der Spieler, um den es Wechselgerüchte gibt; der Leistungsträger mit
 * auslaufendem Vertrag. Was er sagt, hängt an seiner Stimmung - und wirkt:
 * Öffentliche Kritik erhöht den Mediendruck und drückt die Kabine, ein
 * Bekenntnis zum Verein hebt die Fanstimmung. Wer auspackt, sagt es nicht
 * zweimal im Monat.
 */

const MedienEngine = {
    /** Wie oft nach einem Ligaspiel ein Spieler spricht */
    CHANCE: 0.4,
    /** So viele Tage hält ein Spieler danach still */
    PAUSE_TAGE: 28,
    MEDIEN: [
        { name: "Sportblitz", icon: "📰" },
        { name: "Taktikblatt", icon: "📊" },
        { name: "Lokalanzeiger", icon: "🏘️" },
        { name: "Kurvenfunk", icon: "📻" }
    ],

    _zufall() { return Math.random(); },
    _wahl(liste) { return liste[Math.floor(this._zufall() * liste.length) % liste.length]; },

    _darf(state, p) {
        const heute = state.currentDayIndex || 0;
        const m = p.medien;
        return !m || m.saison !== (state.seasonYear || 1) || heute - (m.tag || 0) >= this.PAUSE_TAGE;
    },

    _merke(state, p) {
        p.medien = { saison: state.seasonYear || 1, tag: state.currentDayIndex || 0 };
    },

    _klemme(wert, min, max) { return Math.max(min, Math.min(max, wert)); },

    /** Die Lage nach dem Spiel: wer hat einen Grund zu reden? Liefert Kandidaten nach Dringlichkeit */
    kandidaten(state, match) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return [];
        const heim = match.homeClubId === club.id;
        const tore = heim ? match.homeGoals : match.awayGoals;
        const gegentore = heim ? match.awayGoals : match.homeGoals;
        const diff = tore - gegentore;
        const kader = (state.players || []).filter(p => p.clubId === club.id && this._darf(state, p));
        const nachId = new Map(kader.map(p => [String(p.id), p]));
        const ereignisse = Array.isArray(match.events) ? match.events : [];
        const toreVon = new Map();
        ereignisse.filter(e => e && e.type === "goal" && e.clubId === club.id && e.playerId !== undefined)
            .forEach(e => toreVon.set(String(e.playerId), (toreVon.get(String(e.playerId)) || 0) + 1));
        // Noten: als Liste [{ playerId, rating }] oder als Objekt nach Kennung
        const noten = new Map();
        const pr = match.playerRatings;
        if (Array.isArray(pr)) pr.forEach(r => { if (r && typeof r.rating === "number") noten.set(String(r.playerId), r.rating); });
        else if (pr && typeof pr === "object") Object.entries(pr).forEach(([id, r]) => noten.set(String(id), typeof r === "number" ? r : (r && r.rating)));
        const note = (p) => { const r = noten.get(String(p.id)); return typeof r === "number" ? r : null; };
        const spitze = kader.map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 6);
        const leistungstraeger = spitze.length ? spitze[spitze.length - 1] : 99;
        const heute = state.currentDayIndex || 0;
        const aktivesGeruecht = (p) => (state.clubs || []).find(c => c.geruecht && String(c.geruecht.playerId) === String(p.id) && c.geruecht.bis >= heute)
            || null;
        const serie = state.fanSerie || {};
        const kapitaen = club.roles && club.roles.captain !== null && club.roles.captain !== undefined ? nachId.get(String(club.roles.captain)) : null;

        const liste = [];
        kader.forEach(p => {
            const moral = p.morale ?? 75;
            const spielzeit = (p.happiness && p.happiness.playingTime) ?? 75;
            const t = toreVon.get(String(p.id)) || 0;
            const n = note(p);
            const g = aktivesGeruecht(p);
            if (moral < 55 && spielzeit < 50 && (p.overall || 0) >= leistungstraeger - 6) liste.push({ art: "frust", p, gewicht: 6 + (55 - moral) / 5 });
            if (g) liste.push({ art: "geruecht", p, verein: g, gewicht: 5 });
            if (diff > 0 && t >= 2) liste.push({ art: "held", p, tore: t, gewicht: 5 + t });
            if ((p.contractYears ?? 2) <= 1 && (p.overall || 0) >= leistungstraeger && !p.vorvertrag) liste.push({ art: "vertrag", p, gewicht: 3 });
            if ((p.age || 30) <= 21 && n !== null && n >= 7.5) liste.push({ art: "talent", p, gewicht: 4 });
            if (diff > 0 && t === 1 && n !== null && n >= 7.5) liste.push({ art: "held", p, tore: t, gewicht: 3 });
        });
        if (kapitaen && (serie.niederlagen || 0) >= 3) liste.push({ art: "kapitaen", p: kapitaen, gewicht: 7 });
        // Sonst spricht der Beste des Abends - wenn er gut war
        const bester = kader.map(p => ({ p, n: note(p) })).filter(x => x.n !== null && x.n >= 7).sort((a, b) => b.n - a.n)[0];
        if (bester) liste.push({ art: "stimme", p: bester.p, diff, gewicht: 1 });
        return liste.sort((a, b) => b.gewicht - a.gewicht);
    },

    /** Nach einem Ligaspiel des eigenen Vereins - gibt das Interview zurück oder null */
    nachSpiel(state, match, zufall = null) {
        if (!state || !match || !match.played) return null;
        if (match.homeClubId !== state.userClubId && match.awayClubId !== state.userClubId) return null;
        const wurf = typeof zufall === "number" ? zufall : this._zufall();
        if (wurf >= this.CHANCE) return null;
        const k = this.kandidaten(state, match)[0];
        if (!k) return null;
        return this.interview(state, k);
    },

    /** Ein Interview führen: Text, Wirkung, Nachricht */
    interview(state, k) {
        const p = k.p;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        const verein = club ? club.name : "der Verein";
        const trainer = state.managerName || "der Trainer";
        const medium = this._wahl(this.MEDIEN);
        const zufrieden = ((p.happiness && p.happiness.overall) ?? 70) >= 65;
        let titel, zitat, wirkung = {}, hinweis = "";
        const w = (liste) => this._wahl(liste);

        if (k.art === "frust") {
            titel = `${p.name} packt aus`;
            zitat = w([`Ich bin nicht hierhergekommen, um zuzuschauen. Ich will spielen - jede Woche.`,
                `Ich trainiere gut, das sieht jeder. Warum ich draußen sitze, weiß ich nicht.`,
                `Wenn sich nichts ändert, muss ich über meine Zukunft nachdenken.`]);
            wirkung = { mediaPressure: 4, kabine: -1 };
            hinweis = `Ein Gespräch unter vier Augen kann die Lage beruhigen - oder mehr Einsatzzeit.`;
        } else if (k.art === "geruecht") {
            const ziel = k.verein ? k.verein.name : "einem anderen Verein";
            if (zufrieden) {
                titel = `${p.name}: "Ich fühle mich wohl bei ${verein}"`;
                zitat = w([`Gerüchte gibt es immer. Ich habe hier noch viel vor.`, `Über ${ziel} lese ich in der Zeitung. Ich konzentriere mich auf ${verein}.`]);
                wirkung = { fanMood: 2 };
            } else {
                titel = `${p.name} flirtet mit ${ziel}`;
                zitat = w([`${ziel} ist ein großer Verein. Natürlich hört man da hin.`, `Man muss sehen, was im Sommer passiert. Ich schließe nichts aus.`]);
                wirkung = { mediaPressure: 3, fanMood: -2 };
                hinweis = `Ein Gespräch oder ein neuer Vertrag kann ihn halten.`;
            }
        } else if (k.art === "held") {
            titel = k.tore >= 2 ? `${p.name}: "Solche Abende vergisst man nicht"` : `${p.name} nach dem Sieg`;
            zitat = w([`Der Trainer hat uns perfekt eingestellt. Die Tore gehören der ganzen Mannschaft.`,
                `Die Fans haben uns getragen. Für solche Spiele spielt man Fußball.`,
                `Wir haben genau das umgesetzt, was wir uns vorgenommen hatten.`]);
            wirkung = { fanMood: 1, moral: 3 };
        } else if (k.art === "talent") {
            titel = `Talent ${p.name}: "Ich will mich hier durchsetzen"`;
            zitat = w([`${trainer} gibt mir das Vertrauen. Das will ich zurückzahlen.`, `Von den Erfahrenen lerne ich jeden Tag. Das ist erst der Anfang.`]);
            wirkung = { fanMood: 1, moral: 2, board: 1 };
        } else if (k.art === "kapitaen") {
            titel = `Kapitän ${p.name} fordert eine Reaktion`;
            zitat = w([`Wir müssen uns alle an die eigene Nase fassen. So kann es nicht weitergehen.`,
                `Jeder in der Kabine weiß, dass das zu wenig ist. Wir stehen zusammen und drehen das.`]);
            wirkung = { mediaPressure: 2, kabine: 1 };
        } else if (k.art === "vertrag") {
            titel = zufrieden ? `${p.name} will verlängern` : `${p.name} lässt seine Zukunft offen`;
            zitat = zufrieden
                ? w([`Ich würde gern bleiben. Jetzt liegt es am Verein.`, `${verein} ist mein Verein. Die Gespräche laufen hoffentlich bald.`])
                : w([`Es gab noch keine Gespräche. Ich höre mir alles an.`, `Mein Berater kümmert sich darum. Ich spiele einfach Fußball.`]);
            wirkung = zufrieden ? { fanMood: 1 } : { mediaPressure: 2, fanMood: -1 };
            hinweis = `Sein Vertrag läuft aus - verlängern lässt er sich in seiner Akte.`;
        } else if (k.art === "stimme") {
            titel = `${p.name} nach dem ${k.diff > 0 ? "Sieg" : (k.diff === 0 ? "Remis" : "Spiel")}`;
            zitat = k.diff > 0 ? w([`Ein wichtiger Sieg. Jetzt nicht nachlassen.`, `Das war harte Arbeit. Umso schöner sind die drei Punkte.`])
                : k.diff === 0 ? w([`Mit dem Punkt können wir leben. Mehr wäre drin gewesen.`, `Unentschieden fühlt sich heute an wie verloren.`])
                    : w([`Abhaken, analysieren, weitermachen. Mehr bleibt nicht.`, `Ich habe heute alles gegeben. Am Ende hat es nicht gereicht.`]);
            wirkung = {};
        } else {
            return null;
        }

        // Wirkung
        if (wirkung.mediaPressure) state.mediaPressure = this._klemme((state.mediaPressure ?? 45) + wirkung.mediaPressure, 0, 100);
        if (wirkung.fanMood) state.fanMood = this._klemme((state.fanMood ?? 70) + wirkung.fanMood, 10, 100);
        if (wirkung.board) state.boardConfidence = this._klemme((state.boardConfidence ?? 70) + wirkung.board, 0, 100);
        if (wirkung.moral) p.morale = this._klemme((p.morale ?? 75) + wirkung.moral, 0, 100);
        if (wirkung.kabine) (state.players || []).filter(x => x.clubId === state.userClubId && x !== p)
            .forEach(x => { x.morale = this._klemme((x.morale ?? 75) + wirkung.kabine, 0, 100); });
        this._merke(state, p);

        const interview = { art: k.art, playerId: p.id, spieler: p.name, medium: medium.name, titel, zitat, wirkung, saison: state.seasonYear || 1, datum: state.currentDate || "" };
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(this._zufall() * 1000), matchday: state.currentMatchday || 1, date: state.currentDate || "",
            sender: medium.name, subject: `${medium.icon} ${titel}`,
            body: `${p.name} im Gespräch mit dem ${medium.name}:\n\n„${zitat}“${hinweis ? `\n\n${hinweis}` : ""}`,
            read: false, type: "news", playerId: p.id
        });
        return interview;
    }
};

if (typeof window !== "undefined") {
    window.MedienEngine = MedienEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { MedienEngine };
}
