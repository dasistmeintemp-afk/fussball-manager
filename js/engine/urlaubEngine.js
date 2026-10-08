/**
 * UrlaubEngine - Bis zu einem Datum durchspielen
 *
 * Der Weiter-Knopf hält vor jedem Termin, der den Manager braucht: vor
 * jedem Spiel, jeder Pressekonferenz, jedem Pokalabend. Wer eine Phase
 * überspringen will - die Vorbereitung, den Rest des Fensters, die letzten
 * Spieltage einer entschiedenen Saison -, nimmt Urlaub. Dann übernimmt der
 * Co-Trainer: Er stellt auf, die Spiele werden ohne Livespiel gerechnet,
 * die Presse spricht mit ihm. Angehalten wird am Ziel, bei der Entlassung,
 * zum Saisonende - und, wenn gewünscht, bei allem Wichtigen (ein Angebot
 * für einen Spieler, Bewegung in einer Verhandlung, eine Verletzung, ein
 * Jobangebot, wichtige Post).
 *
 * Hier stehen die Ziele und die Bilanz; den Lauf selbst macht die
 * Oberfläche über denselben Weg wie jeden anderen Tag (CalendarEngine).
 */

const _ulResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const UrlaubEngine = {
    _monat(tag) {
        const m = /^\d{1,2}\.(\d{1,2})\.(\d{4})$/.exec(String(tag?.date || ""));
        return m ? `${m[2]}-${m[1]}` : null;
    },

    /**
     * Die möglichen Ziele ab heute: { key, label, tage, datum }. Nur Ziele,
     * die in dieser Saison liegen und mindestens zwei Tage entfernt sind.
     */
    ziele(state) {
        const kal = Array.isArray(state?.calendar) ? state.calendar : [];
        const start = state?.currentDayIndex || 0;
        if (!kal.length || start >= kal.length - 1) return [];
        const ziele = [];
        const dazu = (key, label, idx) => {
            if (idx === null || idx === undefined || idx - start < 2 || idx >= kal.length) return;
            ziele.push({ key, label, tage: idx - start, datum: kal[idx].date });
        };
        dazu("woche", "Eine Woche", start + 7);
        dazu("zweiWochen", "Zwei Wochen", start + 14);

        // Monatsende: der erste Tag des nächsten Monats
        const monat = this._monat(kal[start]);
        const naechster = kal.findIndex((t, i) => i > start && this._monat(t) && this._monat(t) !== monat);
        if (naechster > 0) dazu("monat", "Bis Monatsende", naechster);

        // Transferfenster: bis es schließt - oder bis es öffnet
        const te = _ulResolve("TransferEngine", "./transferEngine.js");
        if (te && typeof te.istTransferfenster === "function") {
            const offen = te.istTransferfenster(state);
            for (let i = start + 1; i < kal.length; i++) {
                const probe = Object.assign({}, state, { currentDayIndex: i, preseason: i === start ? state.preseason : null });
                if (te.istTransferfenster(probe) !== offen) {
                    dazu("fenster", offen ? "Bis das Transferfenster schließt" : "Bis das Transferfenster öffnet", i);
                    break;
                }
            }
        }

        // Saisonende: der Tag der Saisonbilanz
        const ende = kal.findIndex((t, i) => i > start && t.type === "season_end");
        if (ende > 0) dazu("saison", "Bis zum Saisonende", ende);
        // Gleich weit: das genauere Ziel (Fenster vor Monatsende, beides vor "eine Woche")
        const fest = ["monat", "zweiWochen", "woche"];
        return ziele.filter(z => !fest.includes(z.key) || !ziele.some(y => y !== z && y.tage === z.tage && fest.indexOf(y.key) < fest.indexOf(z.key)))
            .sort((a, b) => a.tage - b.tage);
    },

    /** Stand vor dem Urlaub: Tabellenplatz, Punkte, Kasse */
    stand(state) {
        const tabelle = state?.standings || [];
        const i = tabelle.findIndex(z => z.clubId === state?.userClubId);
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const z = i >= 0 ? tabelle[i] : null;
        return { platz: i >= 0 ? i + 1 : null, punkte: z?.points || 0, spiele: z?.played || 0,
            siege: z?.won || 0, remis: z?.drawn || 0, niederlagen: z?.lost || 0, kasse: club?.balance || 0 };
    },

    /** Die Bilanz des Urlaubs aus zwei Ständen */
    bilanz(vorher, nachher, tage) {
        const spiele = nachher.spiele - vorher.spiele;
        const s = nachher.siege - vorher.siege, u = nachher.remis - vorher.remis, n = nachher.niederlagen - vorher.niederlagen;
        return {
            tage, spiele, siege: s, remis: u, niederlagen: n,
            punkte: nachher.punkte - vorher.punkte,
            platzVorher: vorher.platz, platzNachher: nachher.platz,
            kasse: nachher.kasse - vorher.kasse,
            text: `${tage} Tag${tage === 1 ? "" : "e"}`
                + (spiele > 0 ? `, ${spiele} Ligaspiel${spiele === 1 ? "" : "e"}: ${s} S, ${u} U, ${n} N` : "")
                + (vorher.platz && nachher.platz && spiele > 0 ? `, Platz ${vorher.platz} → ${nachher.platz}` : "")
        };
    }
};

if (typeof window !== "undefined") {
    window.UrlaubEngine = UrlaubEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { UrlaubEngine };
}
