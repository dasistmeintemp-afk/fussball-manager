/**
 * Persönliche Saisonziele: Der Trainer vereinbart mit einem Spieler ein Ziel
 * für die Saison - Tore, Vorlagen, Einsätze oder Spiele zu null.
 *
 * Drei Stufen: solide, ehrgeizig, sehr ehrgeizig. Je höher das Ziel, desto
 * größer die Prämie und der Schub, wenn es klappt, und desto tiefer der Fall,
 * wenn nicht. Wie ein Spieler das Ziel aufnimmt, hängt an seinem Ehrgeiz: Der
 * Ehrgeizige will die hohe Latte, den anderen drückt sie.
 *
 * Erreicht er das Ziel, wird die Prämie sofort gezahlt und die Moral steigt.
 * Ist die Saison vorbei und das Ziel verfehlt, sinkt sie. Vereinbart wird bis
 * Spieltag BIS_SPIELTAG, mit höchstens HOECHSTENS Spielern, ein Ziel je
 * Spieler und Saison. Gespeichert im Spielstand (state.saisonziele).
 */
"use strict";

function _szResolve(name, pfad) {
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { /* ohne Bundler */ }
    }
    return null;
}

const SaisonzielEngine = {
    BIS_SPIELTAG: 8,
    HOECHSTENS: 5,

    ARTEN: {
        tore: { label: "Tore", von: "Toren", stat: "goals", einheit: ["Tor", "Tore"] },
        vorlagen: { label: "Vorlagen", von: "Vorlagen", stat: "assists", einheit: ["Vorlage", "Vorlagen"] },
        einsaetze: { label: "Einsätze", von: "Einsätzen", stat: "matches", einheit: ["Einsatz", "Einsätze"] },
        zuNull: { label: "Spiele zu null", von: "Spielen zu null", stat: "cleanSheets", einheit: ["Spiel zu null", "Spiele zu null"] }
    },

    /** faktor: Anteil der erwarteten Saisonleistung; praemie: in Wochenlöhnen; Moral bei Erfolg und Misserfolg */
    STUFEN: {
        solide: { label: "Solide", faktor: 0.85, praemie: 2, erreicht: 5, verfehlt: -2 },
        ehrgeizig: { label: "Ehrgeizig", faktor: 1.15, praemie: 4, erreicht: 8, verfehlt: -4 },
        hoch: { label: "Sehr ehrgeizig", faktor: 1.45, praemie: 8, erreicht: 12, verfehlt: -6 }
    },

    /** Tore und Vorlagen je Einsatz nach Platz, bei durchschnittlichen Werten */
    QUOTE: {
        tore: { ST: 0.45, LA: 0.25, RA: 0.25, OM: 0.22, LM: 0.12, RM: 0.12, ZM: 0.09, DM: 0.04, IV: 0.04, LV: 0.03, RV: 0.03 },
        vorlagen: { ST: 0.15, LA: 0.25, RA: 0.25, OM: 0.28, LM: 0.2, RM: 0.2, ZM: 0.15, DM: 0.07, IV: 0.02, LV: 0.12, RV: 0.12 }
    },

    _club(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },
    _saison(state) { return state?.seasonYear || 1; },
    _spieltage(state) { return Array.isArray(state?.schedule) && state.schedule.length ? state.schedule.length : 34; },

    _ziele(state) {
        if (!state.saisonziele || typeof state.saisonziele !== "object") state.saisonziele = {};
        // Ziele einer früheren Saison sind erledigt
        Object.keys(state.saisonziele).forEach(id => { if (state.saisonziele[id].saison !== this._saison(state)) delete state.saisonziele[id]; });
        return state.saisonziele;
    },

    /** Welche Ziele zu einem Spieler passen */
    artenFuer(p) {
        if (!p) return [];
        if (p.pos === "TW") return ["zuNull", "einsaetze"];
        if (["IV", "DM"].includes(p.pos)) return ["einsaetze", "vorlagen"];
        if (["LV", "RV"].includes(p.pos)) return ["vorlagen", "einsaetze"];
        return ["tore", "vorlagen", "einsaetze"];
    },

    /** Was von ihm in einer ganzen Saison zu erwarten ist */
    erwartung(state, p, art) {
        const club = this._club(state);
        const n = this._spieltage(state);
        const stamm = (club?.lineup || []).some(id => String(id) === String(p.id));
        const bank = (club?.bench || []).some(id => String(id) === String(p.id));
        const einsaetze = n * (stamm ? 0.82 : (bank ? 0.5 : 0.3));
        if (art === "einsaetze") return einsaetze;
        if (art === "zuNull") return einsaetze * 0.3;
        const q = (this.QUOTE[art] || {})[p.pos] ?? 0.08;
        const wert = art === "tore" ? (p.shooting || p.overall || 60) : (p.passing || p.overall || 60);
        return einsaetze * q * Math.max(0.5, wert / 70);
    },

    wochenlohn(p) { return Math.round(p?.wage || 0); },

    /** Wie er eine Stufe aufnimmt: Moral sofort, nach seinem Ehrgeiz */
    reaktion(p, stufe) {
        const ehrgeiz = p?.hiddenAttributes?.ambition ?? 10;
        if (stufe === "solide") return ehrgeiz >= 15 ? { moral: -1, text: "Ihm ist das zu wenig" } : { moral: 1, text: "Damit kann er gut leben" };
        if (stufe === "ehrgeizig") return ehrgeiz >= 10 ? { moral: 3, text: "Das spornt ihn an" } : { moral: 0, text: "Er nimmt es hin" };
        return ehrgeiz >= 14 ? { moral: 4, text: "Genau sein Anspruch" } : (ehrgeiz <= 8 ? { moral: -3, text: "Die Latte drückt ihn" } : { moral: 1, text: "Er will es versuchen" });
    },

    /** Der Stand eines Spielers bei seiner Art von Ziel */
    stand(p, art) {
        const a = this.ARTEN[art];
        return a ? ((p?.stats || {})[a.stat] || 0) : 0;
    },

    /** Das laufende Ziel eines Spielers mit Stand, oder null */
    ziel(state, p) {
        if (!state || !p) return null;
        const z = this._ziele(state)[String(p.id)];
        if (!z) return null;
        const stand = this.stand(p, z.art);
        return { ...z, stand, offen: Math.max(0, z.ziel - stand), anteil: Math.min(1, stand / Math.max(1, z.ziel)) };
    },

    /** Alle laufenden Ziele mit Spieler */
    alle(state) {
        const z = this._ziele(state);
        return Object.keys(z).map(id => {
            const p = (state.players || []).find(x => String(x.id) === id);
            return p ? { spieler: p, ...this.ziel(state, p) } : null;
        }).filter(Boolean);
    },

    /** Kann mit ihm jetzt ein Ziel vereinbart werden? */
    pruefe(state, p) {
        const club = this._club(state);
        if (!p || !club || p.clubId !== club.id || !(club.playerIds || []).some(id => String(id) === String(p.id))) return { ok: false, grund: "Er gehört nicht zum Kader." };
        if (p.reserve) return { ok: false, grund: "Saisonziele gibt es für die Profis." };
        if (p.leihe) return { ok: false, grund: `${p.name} ist verliehen.` };
        const ziele = this._ziele(state);
        if (ziele[String(p.id)]) return { ok: false, grund: `Mit ${p.name} ist für diese Saison schon ein Ziel vereinbart.` };
        if ((state.currentMatchday || 1) > this.BIS_SPIELTAG) return { ok: false, grund: `Saisonziele werden bis zum ${this.BIS_SPIELTAG}. Spieltag vereinbart.` };
        if (Object.keys(ziele).length >= this.HOECHSTENS) return { ok: false, grund: `Mehr als ${this.HOECHSTENS} persönliche Ziele verlieren ihre Wirkung.` };
        return { ok: true };
    },

    /** Die Angebote für einen Spieler: je Art drei Stufen mit Ziel, Prämie und Reaktion */
    vorschlaege(state, p) {
        return this.artenFuer(p).map(art => {
            const e = this.erwartung(state, p, art);
            const grenze = art === "einsaetze" ? this._spieltage(state) : Infinity;
            let letzte = 0;
            const stufen = Object.keys(this.STUFEN).map(stufe => {
                const s = this.STUFEN[stufe];
                // Jede Stufe liegt mindestens eins über der vorigen
                const ziel = Math.min(grenze, Math.max(letzte + 1, Math.round(e * s.faktor)));
                letzte = ziel;
                return { stufe, label: s.label, ziel, praemie: Math.round(this.wochenlohn(p) * s.praemie), erreicht: s.erreicht, verfehlt: s.verfehlt, reaktion: this.reaktion(p, stufe) };
            });
            return { art, label: this.ARTEN[art].label, erwartung: Math.round(e * 10) / 10, stufen };
        });
    },

    vereinbare(state, playerId, art, stufe) {
        const p = (state?.players || []).find(x => String(x.id) === String(playerId));
        const check = this.pruefe(state, p);
        if (!check.ok) return { ok: false, grund: check.grund };
        const angebot = this.vorschlaege(state, p).find(v => v.art === art)?.stufen.find(s => s.stufe === stufe);
        if (!angebot) return { ok: false, grund: "Dieses Ziel passt nicht zu ihm." };
        this._ziele(state)[String(p.id)] = { saison: this._saison(state), art, stufe, ziel: angebot.ziel, praemie: angebot.praemie, erreicht: false };
        p.morale = Math.max(5, Math.min(100, (p.morale ?? 75) + angebot.reaktion.moral));
        const a = this.ARTEN[art];
        const text = `Vereinbart: ${angebot.ziel} ${a.einheit[angebot.ziel === 1 ? 0 : 1]} in dieser Saison. ${angebot.reaktion.text}.`;
        return { ok: true, ziel: this.ziel(state, p), reaktion: angebot.reaktion, text };
    },

    /** Nach dem Spieltag: Wer sein Ziel erreicht hat, bekommt die Prämie */
    nachSpieltag(state) {
        const club = this._club(state);
        const fertig = [];
        this.alle(state).forEach(z => {
            if (z.erreicht || z.stand < z.ziel) return;
            const p = z.spieler;
            const eintrag = state.saisonziele[String(p.id)];
            eintrag.erreicht = true;
            const s = this.STUFEN[z.stufe] || this.STUFEN.solide;
            p.morale = Math.max(5, Math.min(100, (p.morale ?? 75) + s.erreicht));
            if (club && z.praemie > 0) {
                club.balance = (club.balance || 0) - z.praemie;
                const fe = _szResolve("FinanceEngine", "./financeEngine.js");
                if (fe && typeof fe.recordTransaction === "function") fe.recordTransaction(state, club.id, "bonus", -z.praemie, `Saisonziel erreicht: ${p.name}`);
            }
            const a = this.ARTEN[z.art];
            this._post(state, `Saisonziel erreicht: ${p.name}`,
                `${p.name} hat sein Ziel erreicht: ${z.ziel} ${a.einheit[z.ziel === 1 ? 0 : 1]}. Die vereinbarte Prämie von ${z.praemie.toLocaleString("de-DE")} € ist gezahlt, er ist stolz und motiviert.`, p.id);
            fertig.push(p.id);
        });
        return fertig;
    },

    /** Saisonende: Verfehlte Ziele drücken die Moral, dann ist alles erledigt */
    saisonende(state) {
        const offen = this.alle(state);
        if (!offen.length) return { erreicht: 0, verfehlt: 0 };
        this.nachSpieltag(state);
        const zeilen = [];
        let erreicht = 0, verfehlt = 0;
        this.alle(state).forEach(z => {
            const p = z.spieler, a = this.ARTEN[z.art];
            if (z.erreicht) { erreicht++; zeilen.push(`• ${p.name}: ${z.stand} von ${z.ziel} ${a.von} - erreicht`); return; }
            verfehlt++;
            const s = this.STUFEN[z.stufe] || this.STUFEN.solide;
            p.morale = Math.max(5, Math.min(100, (p.morale ?? 75) + s.verfehlt));
            zeilen.push(`• ${p.name}: ${z.stand} von ${z.ziel} ${a.von} - verfehlt`);
        });
        this._post(state, "Saisonziele: die Abrechnung",
            `${zeilen.join("\n")}\n\n${verfehlt ? "Wer sein Ziel verfehlt hat, ist enttäuscht. " : ""}Zur neuen Saison können Sie neue Ziele vereinbaren.`);
        state.saisonziele = {};
        return { erreicht, verfehlt };
    },

    _post(state, betreff, text, playerId = null) {
        if (!Array.isArray(state.inbox)) return;
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday}`, sender: "Co-Trainer",
            subject: betreff, body: text, read: false, type: "board_message",
            ...(playerId !== null ? { relatedEntity: { type: "player", id: playerId } } : {})
        });
    }
};

if (typeof window !== "undefined") {
    window.SaisonzielEngine = SaisonzielEngine;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = { SaisonzielEngine };
}
