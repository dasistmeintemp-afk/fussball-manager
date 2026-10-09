/**
 * LigaNachrichtenEngine - Was in der eigenen Liga los ist
 *
 * Bisher erfuhr der Trainer nur, was ihn selbst betraf. Was die Konkurrenz
 * trieb, wer wen gekauft hatte, wer seit Wochen nicht gewann - das stand
 * nirgends. Die Liga lief im Hintergrund wie eine Tabelle ohne Geschichten.
 *
 * Jetzt berichtet die Sportpresse:
 *   Saisonvorschau  - zum Saisonstart: Favoriten, Geheimtipp,
 *                     Abstiegskandidaten und wo sie den eigenen Verein sieht.
 *   Rundschau       - nach jedem Spieltag: Spitze und Abstand, das Ergebnis
 *                     des Spieltags, Serien, Torjäger, Transfers und
 *                     Trainerwechsel seit der letzten Ausgabe.
 *   Gerüchteküche   - im offenen Fenster: Ein Konkurrent soll an einem
 *                     Spieler interessiert sein. Das Gerücht ist nicht aus
 *                     der Luft gegriffen - der Verein sucht ihn wirklich und
 *                     greift eher zu, wenn es passt.
 */

const LigaNachrichtenEngine = {
    /** Chance je Tag im offenen Fenster auf ein neues Gerücht */
    GERUECHT_JE_TAG: 0.35,
    /** So lange hält ein Gerücht (Tage) */
    GERUECHT_DAUER: 21,
    /** Wie viel mehr Reiz ein Wunschspieler für den Verein hat (TransferEngine) */
    GERUECHT_REIZ: 15,
    MERKEN: 30,

    _speicher(state) {
        if (!state.ligaNachrichten || typeof state.ligaNachrichten !== "object") state.ligaNachrichten = {};
        const s = state.ligaNachrichten;
        if (!Array.isArray(s.transfers)) s.transfers = [];
        if (!Array.isArray(s.geruechte)) s.geruechte = [];
        return s;
    },

    _liga(state) {
        return (state?.clubs || []).find(c => c.id === state.userClubId)?.leagueId || null;
    },

    _vereine(state, ligaId = this._liga(state)) {
        return (state.clubs || []).filter(c => c.leagueId === ligaId);
    },

    _post(state, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: "Sportpresse",
            subject: betreff,
            body: text,
            read: false,
            type: "news"
        });
    },

    /** Kaderstärke: der Schnitt der vierzehn Besten */
    _staerke(state, club) {
        const werte = (state.players || []).filter(p => p.clubId === club.id).map(p => p.overall || 0).sort((a, b) => b - a).slice(0, 14);
        return werte.length ? werte.reduce((s, x) => s + x, 0) / werte.length : 0;
    },

    // ------------------------------------------------------------ Vorschau

    /**
     * Die Tabelle der Experten: Kaderstärke drei Viertel, Ansehen ein
     * Viertel - wie die Medienprognose des Vorstands.
     */
    expertenTabelle(state, ligaId = this._liga(state)) {
        const vereine = this._vereine(state, ligaId);
        const staerke = new Map(vereine.map(c => [c.id, this._staerke(state, c)]));
        const rang = (wert) => new Map(vereine.slice().sort((a, b) => wert(b) - wert(a)).map((c, i) => [c.id, i + 1]));
        const kader = rang(c => staerke.get(c.id));
        const ruf = rang(c => c.reputation || 0);
        return vereine
            .map(c => ({ club: c, kader: kader.get(c.id), ruf: ruf.get(c.id), w: kader.get(c.id) * 0.75 + ruf.get(c.id) * 0.25 + kader.get(c.id) / 1000 }))
            .sort((a, b) => a.w - b.w);
    },

    /** Zum Saisonstart einmal: wen die Experten vorn und hinten sehen */
    saisonvorschau(state) {
        const s = this._speicher(state);
        if (s.vorschau === (state.seasonYear || 1)) return null;
        const tabelle = this.expertenTabelle(state);
        if (tabelle.length < 4) return null;
        s.vorschau = state.seasonYear || 1;
        const name = (e) => e.club.id === state.userClubId ? `${e.club.name} (Sie)` : e.club.name;
        const favoriten = tabelle.slice(0, 3);
        const abstieg = tabelle.slice(-3);
        // Geheimtipp: der Kader, der am weitesten über seinem Ansehen steht
        const tipp = tabelle.slice(3, -3).sort((a, b) => (b.ruf - b.kader) - (a.ruf - a.kader))[0] || null;
        const eigener = tabelle.findIndex(e => e.club.id === state.userClubId) + 1;
        const text = [
            `Favoriten: ${favoriten.map(name).join(", ")}.`,
            tipp && tipp.ruf - tipp.kader >= 2 ? `Geheimtipp: ${name(tipp)} - der Kader ist besser als sein Ruf.` : null,
            `Abstiegskandidaten: ${abstieg.map(name).join(", ")}.`,
            eigener ? `\nUns sehen die Experten auf Platz ${eigener}.` : null
        ].filter(Boolean).join("\n");
        this._post(state, `📰 Saisonvorschau ${state.leagueName || ""}`.trim(), text);
        return text;
    },

    // ----------------------------------------------------------- Gerüchte

    /** Ein Konkurrent und ein Spieler, der ihm helfen würde und den er sich leisten kann */
    _geruechtFinden(state, zufall) {
        const te = (typeof TransferEngine !== "undefined" && TransferEngine) ? TransferEngine
            : (typeof require !== "undefined" ? (() => { try { return require("./transferEngine.js").TransferEngine; } catch (e) { return null; } })() : null);
        const vereine = this._vereine(state).filter(c => c.id !== state.userClubId && !c.geruecht);
        if (!vereine.length || !te) return null;
        const vereinNach = new Map((state.clubs || []).map(c => [c.id, c]));
        // Hat der ausgeloste Verein keinen passenden Kandidaten (zu wenig Geld),
        // ist der nächste dran - vorher fiel das Gerücht des Tages dann einfach aus
        const start = Math.floor(zufall() * vereine.length);
        for (let i = 0; i < vereine.length; i++) {
            const treffer = this._geruechtFuer(state, te, vereine[(start + i) % vereine.length], vereinNach, zufall);
            if (treffer) return treffer;
        }
        return null;
    },

    _geruechtFuer(state, te, club, vereinNach, zufall) {
        // Gesucht wird, wer über dem Schnitt des Kaders liegt - ein Stammspieler, kein Weltstar
        const niveau = typeof te.kaderNiveau === "function" ? te.kaderNiveau(state, club) : this._staerke(state, club) - 4;
        // Der Rahmen: was der Verein in diesem Fenster hätte ausgeben können -
        // wie das Saisonbudget aus dem Kontostand (SeasonEngine)
        const rahmen = Math.max((club.transferBudget || 0) * 1.3, Math.max(0, club.balance || 0) * 0.35);
        const kandidaten = (state.players || []).filter(p => {
            if (!p.clubId || p.clubId === club.id || p.clubId === state.userClubId || p.leihe || p.vorvertrag) return false;
            if ((p.overall || 0) < niveau + 3 || (p.age || 30) > 31) return false;
            const verkaeufer = vereinNach.get(p.clubId);
            if (verkaeufer && (verkaeufer.reputation || 60) > (club.reputation || 60) + 12) return false;
            // Gerüchte stimmen nicht immer - etwas über dem Budget darf es liegen
            return te.calculateAskingPrice(p, verkaeufer) <= rahmen;
        }).sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 10);
        if (!kandidaten.length) return null;
        const p = kandidaten[Math.floor(zufall() * kandidaten.length)];
        return { club, p, von: vereinNach.get(p.clubId) };
    },

    /** Im offenen Fenster: dann und wann ein neues Gerücht */
    geruechtTag(state, fensterOffen, zufall = Math.random) {
        const s = this._speicher(state);
        const heute = state.currentDayIndex || 0;
        // Abgelaufene Gerüchte verschwinden
        (state.clubs || []).forEach(c => { if (c.geruecht && (c.geruecht.bis < heute || c.geruecht.saison !== (state.seasonYear || 1))) delete c.geruecht; });
        if (!fensterOffen || zufall() >= this.GERUECHT_JE_TAG) return null;
        const g = this._geruechtFinden(state, zufall);
        if (!g) return null;
        g.club.geruecht = { playerId: g.p.id, bis: heute + this.GERUECHT_DAUER, saison: state.seasonYear || 1 };
        const eintrag = { saison: state.seasonYear || 1, datum: state.currentDate || "", clubId: g.club.id, verein: g.club.name,
            playerId: g.p.id, spieler: g.p.name, pos: g.p.pos, von: g.von ? g.von.name : "vereinslos", wahr: false };
        s.geruechte.push(eintrag);
        if (s.geruechte.length > this.MERKEN) s.geruechte.splice(0, s.geruechte.length - this.MERKEN);
        const text = `${g.club.name} soll an ${g.p.name} interessiert sein (${g.p.pos}, ${g.p.age} Jahre, ${eintrag.von}). Aus dem Umfeld heißt es, man suche auf dieser Position Verstärkung.`;
        this._post(state, `🗞️ Gerüchteküche: ${g.p.name} zu ${g.club.name}?`, text);
        return eintrag;
    },

    /** Für die Transferwahl der KI: Ein Wunschspieler reizt mehr */
    reiz(club, player) {
        return club?.geruecht && String(club.geruecht.playerId) === String(player?.id) ? this.GERUECHT_REIZ : 0;
    },

    /** Ein Wechsel in der eigenen Liga - für die Rundschau, und ob ein Gerücht stimmte */
    transfer(state, { player, vonId, zuId, fee }) {
        const liga = this._liga(state);
        const vereinNach = new Map((state.clubs || []).map(c => [c.id, c]));
        const von = vereinNach.get(vonId), zu = vereinNach.get(zuId);
        if (!liga || !((von && von.leagueId === liga) || (zu && zu.leagueId === liga))) return;
        if (vonId === state.userClubId || zuId === state.userClubId) return;
        const s = this._speicher(state);
        const geruecht = s.geruechte.find(g => !g.wahr && g.clubId === zuId && String(g.playerId) === String(player.id) && g.saison === (state.seasonYear || 1));
        if (geruecht) geruecht.wahr = true;
        if (zu && zu.geruecht && String(zu.geruecht.playerId) === String(player.id)) delete zu.geruecht;
        s.transfers.push({ saison: state.seasonYear || 1, tag: state.currentDayIndex || 0, spieler: player.name, pos: player.pos,
            von: von ? von.name : "vereinslos", zu: zu ? zu.name : "", fee: fee || 0, geruecht: !!geruecht });
        if (s.transfers.length > this.MERKEN) s.transfers.splice(0, s.transfers.length - this.MERKEN);
    },

    // ----------------------------------------------------------- Rundschau

    /** Nach jedem Spieltag der eigenen Liga: was los war */
    rundschau(state) {
        const s = this._speicher(state);
        const spieltag = state.currentMatchday || 0;
        const saison = state.seasonYear || 1;
        if (s.letzteRundschau && s.letzteRundschau.saison === saison && s.letzteRundschau.spieltag >= spieltag) return null;
        const runde = (state.schedule || []).find(r => r.matchday === spieltag);
        const spiele = (runde?.matches || []).filter(m => m.played);
        const tabelle = state.standings || [];
        if (!spiele.length || tabelle.length < 2) return null;
        const vereinNach = new Map((state.clubs || []).map(c => [c.id, c]));
        const name = (id) => id === state.userClubId ? `${vereinNach.get(id)?.name || ""} (Sie)` : (vereinNach.get(id)?.name || "");
        const zeilen = [];

        const [erster, zweiter] = tabelle;
        const abstand = (erster.points || 0) - (zweiter.points || 0);
        zeilen.push(abstand > 0
            ? `${name(erster.clubId)} führt mit ${abstand} Punkt${abstand === 1 ? "" : "en"} Vorsprung vor ${name(zweiter.clubId)}.`
            : `${name(erster.clubId)} und ${name(zweiter.clubId)} sind punktgleich an der Spitze.`);

        const hoch = spiele.slice().sort((a, b) => Math.abs(b.homeGoals - b.awayGoals) - Math.abs(a.homeGoals - a.awayGoals)
            || (b.homeGoals + b.awayGoals) - (a.homeGoals + a.awayGoals))[0];
        if (hoch && Math.abs(hoch.homeGoals - hoch.awayGoals) >= 3) {
            zeilen.push(`Ergebnis des Spieltags: ${name(hoch.homeClubId)} - ${name(hoch.awayClubId)} ${hoch.homeGoals}:${hoch.awayGoals}.`);
        }

        // Serien aus der Form der letzten fünf Spiele
        const serien = [];
        tabelle.forEach(r => {
            const club = vereinNach.get(r.clubId);
            const form = (Array.isArray(club?.form) ? club.form : []).slice(-5);
            if (form.length < 5 || form.includes("-")) return;
            if (form.every(g => g === "W" || g === "S")) serien.push(`${name(r.clubId)} hat die letzten fünf Spiele gewonnen`);
            else if (!form.some(g => g === "W" || g === "S")) serien.push(`${name(r.clubId)} wartet seit fünf Spielen auf einen Sieg`);
        });
        if (serien.length) zeilen.push(`Serien: ${serien.slice(0, 3).join("; ")}.`);

        const ligaIds = new Set(tabelle.map(r => r.clubId));
        const torjaeger = (state.players || []).filter(p => ligaIds.has(p.clubId) && (p.stats?.goals || 0) > 0)
            .sort((a, b) => (b.stats.goals || 0) - (a.stats.goals || 0)).slice(0, 3);
        if (torjaeger.length) zeilen.push(`Torjäger: ${torjaeger.map(p => `${p.name} (${vereinNach.get(p.clubId)?.name || ""}) ${p.stats.goals}`).join(", ")}.`);

        const seit = s.letzteRundschau && s.letzteRundschau.saison === saison ? s.letzteRundschau.tag : -1;
        const transfers = s.transfers.filter(t => t.saison === saison && t.tag > seit);
        if (transfers.length) {
            zeilen.push(`Transfers: ${transfers.slice(-4).map(t => `${t.spieler} von ${t.von} zu ${t.zu}${t.geruecht ? " (das Gerücht stimmte)" : ""}`).join("; ")}.`);
        }
        const karussell = (typeof TrainerwechselEngine !== "undefined" && TrainerwechselEngine) ? TrainerwechselEngine
            : (typeof require !== "undefined" ? (() => { try { return require("./trainerwechselEngine.js").TrainerwechselEngine; } catch (e) { return null; } })() : null);
        const wechsel = karussell ? karussell.dieseSaison(state, this._liga(state)).filter(w => (w.tag ?? Infinity) > seit && !(s.gemeldeteWechsel || []).includes(`${w.clubId}:${w.neu}`)) : [];
        if (wechsel.length) {
            zeilen.push(`Trainerwechsel: ${wechsel.map(w => `${w.verein} (${w.alt} → ${w.neu})`).join("; ")}.`);
            s.gemeldeteWechsel = [...(s.gemeldeteWechsel || []), ...wechsel.map(w => `${w.clubId}:${w.neu}`)].slice(-20);
        }

        s.letzteRundschau = { saison, spieltag, tag: state.currentDayIndex || 0 };
        this._post(state, `📰 Rundschau ${spieltag}. Spieltag: ${abstand > 0 ? `${vereinNach.get(erster.clubId)?.name || ""} vorn` : "Gleichstand oben"}`, zeilen.join("\n"));
        return zeilen;
    },

    /** Die Gerüchte dieser Saison - für die Ranglisten */
    geruechteDieseSaison(state) {
        return (state?.ligaNachrichten?.geruechte || []).filter(g => g.saison === (state.seasonYear || 1));
    }
};

if (typeof window !== "undefined") {
    window.LigaNachrichtenEngine = LigaNachrichtenEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { LigaNachrichtenEngine };
}
