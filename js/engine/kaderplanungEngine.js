/**
 * KaderplanungEngine - Der Kader über drei Spielzeiten
 *
 * Die Kadertabelle zeigt, wer heute da ist. Wer plant, will wissen, wer
 * nächstes und übernächstes Jahr noch da ist: Verträge laufen aus, Leihspieler
 * kehren zurück, Vorverträge bringen Zugänge, Ältere hören auf. Die Planung
 * stellt das je Mannschaftsteil nebeneinander - gemessen an dem, was der
 * Verein auf jeder Position braucht (der Kaderplan seiner Liga):
 *
 *   Lücke  - weniger Spieler, als die Position braucht
 *   dünn   - genug Spieler, aber zu wenige auf Stammspieler-Niveau
 *            (drei Sterne nach dem eingestellten Maßstab)
 *   gut    - beides passt
 *
 * Der Sportdirektor nennt die dringendsten Baustellen; jede lässt sich
 * direkt als Scouting-Auftrag losschicken.
 */

const _kpResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const KaderplanungEngine = {
    SAISONS: 3,
    /** Ab diesem Alter (in der jeweiligen Saison) ist ein Karriereende wahrscheinlich */
    ENDE_ALTER: 35,
    /** Ab diesem Alter steht ein Hinweis dran */
    SPAET_ALTER: 33,

    /** Die Mannschaftsteile der Planung - mit den Positionen des Kaderplans */
    TEILE: [
        { key: "tw", titel: "Torwart", ort: "im Tor", positionen: ["TW"], suche: "TW", stamm: 1 },
        { key: "iv", titel: "Innenverteidigung", ort: "in der Innenverteidigung", positionen: ["IV"], suche: "IV", stamm: 2 },
        { key: "av", titel: "Außenverteidigung", ort: "in der Außenverteidigung", positionen: ["LV", "RV"], suche: "LV", stamm: 2 },
        { key: "zm", titel: "Zentrales Mittelfeld", ort: "im zentralen Mittelfeld", positionen: ["DM", "ZM"], suche: "ZM", stamm: 2 },
        { key: "om", titel: "Offensive und Flügel", ort: "in Offensive und auf den Flügeln", positionen: ["OM", "LM", "RM", "LA", "RA"], suche: "OM", stamm: 3 },
        { key: "st", titel: "Sturm", ort: "im Sturm", positionen: ["ST"], suche: "ST", stamm: 1 }
    ],

    _eigener(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },
    _teil(pos) { return this.TEILE.find(t => t.positionen.includes(pos)) || this.TEILE[3]; },

    /** Was der Verein je Mannschaftsteil braucht - aus dem Kaderplan seiner Liga */
    bedarf(club) {
        const gen = _kpResolve("PlayerGenerator", "./playerGenerator.js");
        const welt = _kpResolve("WorldGenerator", "./worldGenerator.js");
        const soll = welt?.SQUAD_SIZES?.[club?.level || 1] || 22;
        const plan = gen && typeof gen.buildSquadPlan === "function" ? gen.buildSquadPlan(soll) : [];
        const bedarf = {};
        this.TEILE.forEach(t => { bedarf[t.key] = 0; });
        plan.forEach(pos => { bedarf[this._teil(pos).key]++; });
        return bedarf;
    },

    /** Ab welcher Stärke einer Stammspieler-Niveau hat (drei Sterne) */
    _stammStaerke(state) {
        const rating = _kpResolve("PlayerRatingEngine", "./playerRatingEngine.js");
        if (!rating) return 65;
        const bezug = typeof rating.sternBezug === "function" ? rating.sternBezug(state) : 140;
        return rating.overallForStars(3, { squadAverageAbility: bezug });
    },

    /**
     * Die Planung: je Mannschaftsteil und Saison, wer da ist und wie es
     * aussieht. k = 0 ist die laufende Saison.
     */
    plan(state) {
        const club = this._eigener(state);
        if (!club) return null;
        const saison = state.seasonYear || 1;
        const bedarf = this.bedarf(club);
        const stamm = this._stammStaerke(state);
        const eigene = (state.players || []).filter(p => p.clubId === club.id || (p.leihe && p.leihe.stammvereinId === club.id));
        const kommen = (state.players || []).filter(p => p.vorvertrag && p.vorvertrag.clubId === club.id && p.clubId !== club.id);

        const spalten = [];
        for (let k = 0; k < this.SAISONS; k++) {
            const da = [];
            eigene.forEach(p => {
                const verliehen = p.leihe && p.leihe.stammvereinId === club.id && p.clubId !== club.id;
                const geliehen = p.leihe && p.leihe.leihvereinId === club.id && p.leihe.stammvereinId !== club.id;
                if (k === 0 && verliehen) return;           // ist gerade weg
                if (k > 0 && geliehen) return;              // geht zurück zu seinem Verein
                if (k > 0 && p.vorvertrag && p.vorvertrag.clubId !== club.id) return; // hat woanders unterschrieben
                const laufzeit = p.contractYears ?? p.contract?.years ?? 2;
                if (k > 0 && laufzeit <= k) return;         // Vertrag ist dann ausgelaufen
                const alter = (p.age || 25) + k;
                if (k > 0 && alter >= this.ENDE_ALTER) return; // hört wahrscheinlich auf
                const marken = [];
                if (laufzeit <= k + 1) marken.push("vertrag");
                if (alter >= this.SPAET_ALTER) marken.push("alter");
                if (k > 0 && verliehen) marken.push("rueckkehr");
                if (geliehen) marken.push("leihe");
                da.push({ id: p.id, name: p.name, pos: p.pos, alter, staerke: p.overall || 0, stamm: (p.overall || 0) >= stamm, marken });
            });
            if (k > 0) kommen.forEach(p => da.push({ id: p.id, name: p.name, pos: p.pos, alter: (p.age || 25) + k, staerke: p.overall || 0, stamm: (p.overall || 0) >= stamm, marken: ["zugang"] }));

            const teile = this.TEILE.map(t => {
                const spieler = da.filter(s => this._teil(s.pos).key === t.key).sort((a, b) => b.staerke - a.staerke);
                const stammspieler = spieler.filter(s => s.stamm).length;
                const status = spieler.length < bedarf[t.key] ? "luecke" : (stammspieler < t.stamm ? "duenn" : "gut");
                return { key: t.key, titel: t.titel, bedarf: bedarf[t.key], anzahl: spieler.length, stammspieler, stammBedarf: t.stamm, status, spieler };
            });
            spalten.push({ saison: saison + k, teile });
        }
        return { saison, stammStaerke: stamm, spalten };
    },

    /** Die dringendsten Baustellen - die früheste Saison zuerst, Lücken vor dünnen Stellen */
    hinweise(state, anzahl = 3) {
        const p = this.plan(state);
        if (!p) return [];
        const liste = [];
        p.spalten.forEach((s, k) => s.teile.forEach(t => {
            if (t.status === "gut") return;
            if (liste.some(h => h.key === t.key)) return;
            const teil = this.TEILE.find(x => x.key === t.key);
            const gehen = k > 0 ? (p.spalten[k - 1].teile.find(x => x.key === t.key)?.spieler || [])
                .filter(a => !t.spieler.some(b => b.id === a.id)).map(a => a.name) : [];
            const wann = k === 0 ? "Schon jetzt" : (k === 1 ? "Nächste Saison" : `In Saison ${s.saison}`);
            const text = t.status === "luecke"
                ? `${wann} fehlen Spieler ${teil.ort}: ${t.anzahl} von ${t.bedarf}${gehen.length ? ` - ${gehen.slice(0, 2).join(" und ")} ${gehen.length === 1 ? "geht" : "gehen"}` : ""}.`
                : `${wann} fehlt Qualität ${teil.ort}: ${t.stammspieler} von ${t.stammBedarf} auf Stammspieler-Niveau.`;
            liste.push({ key: t.key, saison: s.saison, k, status: t.status, text, suche: teil.suche, gewicht: k * 2 + (t.status === "luecke" ? 0 : 1) });
        }));
        return liste.sort((a, b) => a.gewicht - b.gewicht).slice(0, anzahl);
    },

    /** Eine Baustelle als Scouting-Auftrag: Position, Stammspieler-Niveau, nicht zu alt */
    suchauftrag(state, key) {
        const teil = this.TEILE.find(t => t.key === key);
        const scouting = _kpResolve("ScoutingEngine", "./scoutingEngine.js");
        if (!teil || !scouting || typeof scouting.startAssignment !== "function") return { success: false, error: "Scouting ist nicht verfügbar." };
        return scouting.startAssignment(state, { position: teil.suche, maxAge: 27, minOverall: this._stammStaerke(state) });
    }
};

if (typeof window !== "undefined") {
    window.KaderplanungEngine = KaderplanungEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { KaderplanungEngine };
}
