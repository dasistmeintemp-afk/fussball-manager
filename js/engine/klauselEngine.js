/**
 * KlauselEngine - Was außer Gehalt und Laufzeit im Vertrag steht
 *
 * Bisher gab es Ausstiegsklausel, Weiterverkaufsbeteiligung und Prämien.
 * Dazu kommen jetzt die Klauseln, mit denen Verträge im echten Fußball
 * ausgehandelt werden:
 *
 *   Gehaltssteigerung    - 5 oder 10 % mehr in jeder weiteren Saison.
 *                          Der Spieler nimmt dafür ein niedrigeres Startgehalt.
 *   Abstieg              - Gehalt minus 30 % (er will dafür etwas mehr) oder
 *                          ablösefreier Ausstieg (gefällt ihm).
 *   Aufstieg             - 10 oder 25 % mehr nach einem Aufstieg; zählt für
 *                          ihn so viel, wie ein Aufstieg wahrscheinlich ist.
 *   Mindestablöse        - Ein höherklassiger Verein darf ihn für diesen
 *                          Betrag holen. Der Spieler mag die Tür nach oben.
 *   Vereinsoption        - Der Verein darf um ein Jahr verlängern, wenn der
 *                          Vertrag ausläuft. Das mag er nicht.
 *
 * Wie viel ihm die Klauseln wert sind, rechnet er in das Gehalt ein (faktor).
 */

const _klResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));
    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const KlauselEngine = {
    STEIGERUNG: [0, 5, 10],
    AUFSTIEG: [0, 10, 25],
    /** Bei Abstieg: Gehaltskürzung um 30 % */
    ABSTIEG_KUERZUNG: 0.3,
    /** Wie wahrscheinlich ein Spieler einen Aufstieg einschätzt (ab der zweiten Liga) */
    AUFSTIEG_CHANCE: 0.25,
    /** Wert der Klauseln für den Spieler, als Faktor auf das gebotene Gehalt */
    WERT: { kuerzung: 0.96, ausstieg: 1.02, mindestAbloese: 1.04, option: 0.95 },
    /** Mit dieser Chance je Fenstertag greift ein höherklassiger Verein bei der Mindestablöse zu */
    ZUGRIFF_CHANCE: 0.03,

    /** Nur gültige Werte - und nur das, was vom Standard abweicht */
    normalisiere(klauseln = {}, club = null) {
        const k = {};
        const steig = Number(klauseln.steigerung) || 0;
        if (this.STEIGERUNG.includes(steig) && steig > 0) k.steigerung = steig;
        if (klauseln.abstieg === "kuerzung" || klauseln.abstieg === "ausstieg") k.abstieg = klauseln.abstieg;
        const auf = Number(klauseln.aufstieg) || 0;
        if (this.AUFSTIEG.includes(auf) && auf > 0 && (club?.level || 1) > 1) k.aufstieg = auf;
        const mindest = Math.round(Number(klauseln.mindestAbloese) || 0);
        if (mindest > 0 && (club?.level || 1) > 1) k.mindestAbloese = mindest;
        if (klauseln.option === true || klauseln.option === "true" || klauseln.option === "on") k.option = true;
        return k;
    },

    /**
     * Was die Klauseln dem Spieler wert sind - als Faktor auf das gebotene
     * Gehalt (über 1: er nimmt weniger Grundgehalt, unter 1: er will mehr).
     */
    faktor(klauseln = {}, jahre = 3, club = null) {
        const k = this.normalisiere(klauseln, club);
        let f = 1;
        if (k.steigerung) f *= Math.pow(1 + k.steigerung / 100, Math.max(0, (jahre || 1) - 1) / 2);
        if (k.abstieg) f *= this.WERT[k.abstieg];
        if (k.aufstieg) f *= 1 + k.aufstieg / 100 * this.AUFSTIEG_CHANCE;
        if (k.mindestAbloese) f *= this.WERT.mindestAbloese;
        if (k.option) f *= this.WERT.option;
        return Math.round(f * 1000) / 1000;
    },

    /** Für Akte und Verhandlung: die Klauseln in Worten */
    texte(klauseln = {}) {
        const k = klauseln || {};
        const gs = _klResolve("GameState", "./gameState.js");
        const geld = (b) => gs && typeof gs.formatMoney === "function" ? gs.formatMoney(b) : `${b} €`;
        const t = [];
        if (k.steigerung) t.push(`+${k.steigerung} % Gehalt je Saison`);
        if (k.abstieg === "kuerzung") t.push("−30 % Gehalt bei Abstieg");
        if (k.abstieg === "ausstieg") t.push("ablösefrei bei Abstieg");
        if (k.aufstieg) t.push(`+${k.aufstieg} % Gehalt bei Aufstieg`);
        if (k.mindestAbloese) t.push(`Mindestablöse ${geld(k.mindestAbloese)} für höherklassige Vereine`);
        if (k.option) t.push("Vereinsoption auf ein weiteres Jahr");
        return t;
    },

    /** Den Vertrag mit den Klauseln versehen (ersetzt die alten) */
    setze(player, klauseln, club) {
        if (!player) return;
        const k = this.normalisiere(klauseln, club);
        if (Object.keys(k).length) player.klauseln = k; else delete player.klauseln;
    },

    _post(state, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || `Saison ${state.seasonYear || 1}`, sender: "Sportdirektor", subject: betreff, body: text, read: false, type: "contract" });
    },

    /**
     * Zum Saisonwechsel (nach Auf- und Abstieg): Steigerungen, Auf- und
     * Abstiegsklauseln. movements kommt aus CompetitionEngine.
     */
    saisonwechsel(state, movements = {}) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        if (!club) return [];
        const auf = (movements.promoted || []).some(m => m.clubId === club.id);
        const ab = (movements.relegated || []).some(m => m.clubId === club.id);
        const zeilen = [];
        (state.players || []).filter(p => p.clubId === club.id && p.klauseln && (p.contractYears ?? 1) > 0).forEach(p => {
            const k = p.klauseln;
            if (ab && k.abstieg === "ausstieg") {
                club.playerIds = (club.playerIds || []).filter(id => id !== p.id);
                club.lineup = (club.lineup || []).filter(id => id !== p.id);
                club.bench = (club.bench || []).filter(id => id !== p.id);
                p.clubId = null; p.contractYears = 0; delete p.klauseln;
                zeilen.push(`${p.name} nutzt die Abstiegsklausel und geht ablösefrei.`);
                return;
            }
            let faktor = 1;
            if (k.steigerung) faktor *= 1 + k.steigerung / 100;
            if (ab && k.abstieg === "kuerzung") faktor *= 1 - this.ABSTIEG_KUERZUNG;
            if (auf && k.aufstieg) faktor *= 1 + k.aufstieg / 100;
            if (faktor !== 1) {
                const vorher = p.wage || 0;
                p.wage = Math.max(100, Math.round(vorher * faktor / 10) * 10);
                if (auf && k.aufstieg) zeilen.push(`${p.name}: Aufstiegsklausel, Gehalt +${k.aufstieg} %.`);
                if (ab && k.abstieg === "kuerzung") zeilen.push(`${p.name}: Abstiegsklausel, Gehalt −30 %.`);
            }
        });
        if (zeilen.length) this._post(state, "Vertragsklauseln zum Saisonwechsel", zeilen.join("\n"));
        return zeilen;
    },

    /** Die Vereinsoption ziehen: ein Jahr länger zu den alten Bedingungen */
    zieheOption(state, playerId) {
        const p = (state?.players || []).find(x => String(x.id) === String(playerId));
        if (!p || p.clubId !== state.userClubId) return { success: false, error: "Dieser Spieler steht nicht bei uns unter Vertrag." };
        if (!p.klauseln?.option) return { success: false, error: "Der Vertrag hat keine Vereinsoption." };
        if ((p.contractYears ?? 0) > 1) return { success: false, error: "Die Option lässt sich erst im letzten Vertragsjahr ziehen." };
        if (p.vorvertrag && p.vorvertrag.clubId !== p.clubId) return { success: false, error: `${p.name} hat schon bei ${p.vorvertrag.clubName || "einem anderen Verein"} unterschrieben.` };
        p.contractYears = (p.contractYears || 0) + 1;
        delete p.vorvertragInteresse;
        delete p.klauseln.option;
        if (!Object.keys(p.klauseln).length) delete p.klauseln;
        p.morale = Math.max(0, (p.morale ?? 70) - 5);
        if (typeof state.seasonYear === "number") p.verlaengertSaison = state.seasonYear;
        return { success: true, jahre: p.contractYears };
    },

    /**
     * Im offenen Fenster: Ein höherklassiger Verein mit Budget greift bei
     * der Mindestablöse zu. Gibt die Wechsel zurück.
     */
    mindestAbloeseTag(state, zufall = Math.random) {
        const te = _klResolve("TransferEngine", "./transferEngine.js");
        if (!te || typeof te.istTransferfenster !== "function" || !te.istTransferfenster(state)) return [];
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return [];
        const wechsel = [];
        (state.players || []).filter(p => p.clubId === club.id && p.klauseln?.mindestAbloese && !p.leihe && !p.vorvertrag).forEach(p => {
            const preis = p.klauseln.mindestAbloese;
            // Nur wenn sich der Preis lohnt - und nur mit dieser Chance je Tag
            if (preis > (p.value || 0) * 1.1 || zufall() >= this.ZUGRIFF_CHANCE) return;
            // Höherklassig im eigenen Land, mit Geld - und der Spieler muss ihn verstärken
            // (zuerst die nächsthöhere Liga, dort die größten Namen)
            const kaeufer = (state.clubs || []).filter(c => (c.level || 1) < (club.level || 1) && c.countryId === club.countryId && c.id !== club.id && (c.transferBudget || 0) >= preis)
                .sort((a, b) => (b.level || 1) - (a.level || 1) || (b.reputation || 0) - (a.reputation || 0)).slice(0, 12)
                .find(c => typeof te.kaderNiveau !== "function" || (p.overall || 0) >= te.kaderNiveau(state, c));
            if (!kaeufer) return;
            const lohn = Math.round((p.wage || 1000) * 1.3);
            if (te.executeTransfer(state, p.id, kaeufer.id, preis, lohn, 3)) {
                delete p.klauseln;
                wechsel.push({ spieler: p.name, verein: kaeufer.name, preis });
                this._post(state, `${p.name} wechselt per Mindestablöse`,
                    `${kaeufer.name} hat die Mindestablöse gezogen: ${p.name} wechselt für ${te.formatMoney ? te.formatMoney(preis) : preis}. Gegen eine solche Klausel kann der Verein nichts tun.`);
            }
        });
        return wechsel;
    }
};

if (typeof window !== "undefined") {
    window.KlauselEngine = KlauselEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { KlauselEngine };
}
