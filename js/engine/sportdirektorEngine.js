/**
 * SportdirektorEngine - Der Sportdirektor schlägt Spieler vor
 *
 * Bisher musste der Manager den Transfermarkt selbst durchkämmen: viertausend
 * Spieler, sortiert nach Stärke, ohne Blick darauf, was dem eigenen Kader
 * fehlt. Jetzt hat der Verein einen Sportdirektor.
 *
 * - Er kennt den Kader: Wo ist der Beste eines Mannschaftsteils schwächer als
 *   das Niveau der Mannschaft, wo fehlt Breite, wo wird der Stammspieler alt?
 * - Alle zwei Wochen schickt er drei Vorschläge ins Postfach - Spieler, die
 *   der Verein erreichen und bezahlen kann, mit einer Begründung.
 * - Man kann sich mit ihm beraten: Position, Rolle, Höchstalter und
 *   Ablöserahmen vorgeben, und er sucht danach - auf Wunsch auch künftig in
 *   seinen regelmäßigen Vorschlägen.
 *
 * Seine Einschätzung ist so gut wie das Scoutnetz des Vereins: Mit einem
 * schwachen Chefscout liegt er bei der Stärke eines Spielers schon mal ein
 * paar Punkte daneben.
 */

const _sdResolve = (name, pfad) => {
    if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
    if (typeof window !== "undefined" && window[name]) return window[name];
    if (typeof require !== "undefined") {
        try { return require(pfad)[name]; } catch (e) { return null; }
    }
    return null;
};

class SportdirektorEngine {
    /** Tage zwischen zwei Vorschlagsrunden */
    static ABSTAND = 14;
    /** Vorschläge je Runde */
    static ANZAHL = 3;
    /** So lange wird derselbe Spieler nicht wieder vorgeschlagen */
    static SPERRE = 56;

    /** Mannschaftsteile, in denen er denkt, und wie viele Spieler jeder braucht */
    static GRUPPEN = {
        TW: { name: "Tor", im: "im Tor", fuer: "für das Tor", positionen: ["TW"], mindest: 2 },
        IV: { name: "Innenverteidigung", im: "in der Innenverteidigung", fuer: "für die Innenverteidigung", positionen: ["IV"], mindest: 4 },
        AV: { name: "Außenverteidigung", im: "in der Außenverteidigung", fuer: "für die Außenverteidigung", positionen: ["LV", "RV"], mindest: 3 },
        DM: { name: "Defensives Mittelfeld", im: "im defensiven Mittelfeld", fuer: "für das defensive Mittelfeld", positionen: ["DM"], mindest: 2 },
        ZM: { name: "Zentrales Mittelfeld", im: "im zentralen Mittelfeld", fuer: "für das zentrale Mittelfeld", positionen: ["ZM", "OM"], mindest: 3 },
        FL: { name: "Flügel", im: "auf den Flügeln", fuer: "für die Flügel", positionen: ["LM", "RM", "LA", "RA"], mindest: 3 },
        ST: { name: "Sturm", im: "im Sturm", fuer: "für den Sturm", positionen: ["ST"], mindest: 2 }
    };

    static ROLLEN = {
        stamm: { label: "Sofort Stammspieler", text: "jemand, der sofort spielt" },
        breite: { label: "Kaderbreite", text: "jemand für die Breite" },
        talent: { label: "Talent mit Zukunft", text: "ein Talent mit Zukunft" }
    };

    static _club(state) {
        return (state?.clubs || []).find(c => c.id === state?.userClubId) || null;
    }

    /** Der Sportdirektor des Vereins - ein fester Name, der bleibt */
    static person(state) {
        if (!state) return null;
        if (!state.sportdirektor) state.sportdirektor = { genannt: {}, letzteRunde: null, auftrag: null };
        const sd = state.sportdirektor;
        const club = this._club(state);
        if (!sd.name || sd.clubId !== club?.id) {
            const pools = _sdResolve("NAME_POOLS", "../data/namePools.js") || {};
            const vor = pools.firstNames || ["Thomas", "Michael", "Stefan", "Jörg", "Markus"];
            const nach = pools.lastNames || ["Becker", "Wagner", "Hoffmann", "Schulz", "Koch"];
            const h = this._hash(String(club?.id || "sd"));
            sd.name = `${vor[h % vor.length]} ${nach[Math.floor(h / 7) % nach.length]}`;
            sd.clubId = club?.id || null;
        }
        return sd;
    }

    /** Wie weit seine Einschätzung danebenliegen kann (Punkte Stärke) */
    static ungenauigkeit(state) {
        const stab = _sdResolve("CoachingStaffEngine", "./coachingStaffEngine.js");
        const club = this._club(state);
        const scout = stab && club && typeof stab.staffQuality === "function" ? stab.staffQuality(club).scout : 60;
        return Math.max(0, Math.min(4, (78 - scout) / 7));
    }

    static _hash(text) {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return Math.abs(h);
    }

    /** Seine Schätzung der Stärke - für denselben Spieler immer dieselbe */
    static schaetzung(state, player) {
        const u = this.ungenauigkeit(state);
        const anteil = (this._hash(`${player.id}|${state.userClubId}`) % 1000) / 999;
        return Math.round((player.overall || 0) + (anteil * 2 - 1) * u);
    }

    static gruppeVon(pos) {
        return Object.keys(this.GRUPPEN).find(k => this.GRUPPEN[k].positionen.includes(pos)) || null;
    }

    /**
     * Wie es um den Kader steht: je Mannschaftsteil der Beste, die Zahl der
     * Spieler und ein Bedarf. Am größten ist er, wo der Beste unter dem
     * Niveau liegt, wo Spieler fehlen und wo der Stammspieler alt wird.
     */
    static lage(state) {
        const club = this._club(state);
        if (!club) return { niveau: 0, gruppen: [] };
        const ce = _sdResolve("ContractEngine", "./contractEngine.js");
        const nach = new Map((state.players || []).map(p => [p.id, p]));
        const niveau = (ce && typeof ce.vereinsNiveau === "function" ? ce.vereinsNiveau(club, nach) : null) ?? 50;
        const kader = (club.playerIds || []).map(id => nach.get(id)).filter(p => p && !(p.leihe && p.leihe.stammvereinId === club.id));

        const gruppen = Object.keys(this.GRUPPEN).map(key => {
            const g = this.GRUPPEN[key];
            const dabei = kader.filter(p => g.positionen.includes(p.pos)).sort((a, b) => (b.overall || 0) - (a.overall || 0));
            const bester = dabei[0] || null;
            const fehlend = Math.max(0, g.mindest - dabei.length);
            const bedarf = (bester ? Math.max(0, niveau - bester.overall) : 12)
                + fehlend * 4
                + (bester && (bester.age || 25) >= 32 ? 2 : 0);
            return { key, name: g.name, bester, anzahl: dabei.length, fehlend, bedarf };
        }).sort((a, b) => b.bedarf - a.bedarf);

        return { niveau, gruppen };
    }

    /** Der Rahmen für die Ablöse: was der Etat hergibt, wenn nichts anderes gesagt ist */
    static abloeseRahmen(state, kriterien = {}) {
        const club = this._club(state);
        const budget = Math.max(0, club?.transferBudget || 0);
        if (kriterien.nurAblosefrei) return 0;
        if (typeof kriterien.maxAbloese === "number") return kriterien.maxAbloese;
        return budget;
    }

    /**
     * Die Suche. kriterien: gruppe ("auto" oder ein Schlüssel aus GRUPPEN),
     * rolle (stamm, breite, talent), maxAlter, maxAbloese, nurAblosefrei,
     * ohne (Spieler-IDs, die nicht in Frage kommen).
     */
    static suche(state, kriterien = {}) {
        const club = this._club(state);
        if (!club) return [];
        const te = _sdResolve("TransferEngine", "./transferEngine.js");
        const gen = _sdResolve("PlayerGenerator", "./playerGenerator.js");
        const { niveau, gruppen } = this.lage(state);
        const rolle = this.ROLLEN[kriterien.rolle] ? kriterien.rolle : "stamm";
        const ziele = kriterien.gruppe && kriterien.gruppe !== "auto" && this.GRUPPEN[kriterien.gruppe]
            ? gruppen.filter(g => g.key === kriterien.gruppe)
            : gruppen.slice(0, 3);
        const maxAlter = kriterien.maxAlter || (rolle === "talent" ? 21 : 32);
        // Für die Breite gibt man nicht den ganzen Etat aus
        const rahmen = rolle === "breite" && typeof kriterien.maxAbloese !== "number"
            ? this.abloeseRahmen(state, kriterien) * 0.4
            : this.abloeseRahmen(state, kriterien);
        const proGruppe = ziele.length > 1 ? 2 : Infinity;
        const ohne = new Set((kriterien.ohne || []).map(String));
        const vereinVon = new Map((state.clubs || []).map(c => [c.id, c]));

        const treffer = [];
        (state.players || []).forEach(p => {
            if (p.clubId === club.id || p.leihe || ohne.has(String(p.id))) return;
            if ((p.age || 25) > maxAlter) return;
            const gruppe = ziele.find(g => this.GRUPPEN[g.key].positionen.includes(p.pos));
            if (!gruppe) return;
            if (te && typeof te.isWithinReach === "function" && !te.isWithinReach(p, club, state.clubs)) return;
            const verkaeufer = p.clubId ? vereinVon.get(p.clubId) : null;
            if (kriterien.nurAblosefrei && p.clubId) return;
            const preis = te && typeof te.calculateAskingPrice === "function" ? te.calculateAskingPrice(p, verkaeufer) : (p.value || 0);
            if (preis > rahmen) return;

            const staerke = this.schaetzung(state, p);
            const bester = gruppe.bester ? gruppe.bester.overall : niveau - 12;
            let wert;
            if (rolle === "stamm") {
                if (staerke < bester + 2 || staerke < niveau - 3) return;
                wert = (staerke - bester) * 3 + Math.min(4, staerke - niveau);
            } else if (rolle === "breite") {
                if (staerke < niveau - 7 || staerke > bester + 6) return;
                wert = (staerke - (niveau - 7)) + gruppe.fehlend * 3;
            } else {
                if ((p.age || 25) > 21 || (p.pot || 0) < niveau + 2 || staerke < niveau - 18) return;
                wert = ((p.pot || 0) - niveau) * 2 + (21 - (p.age || 21)) * 2;
            }
            // Was es kostet, zählt mit: wer günstiger ist, rückt nach vorn
            const anteil = rahmen > 0 ? preis / rahmen : 0;
            wert += gruppe.bedarf * 0.5 - anteil * 4;
            if (!p.clubId) wert += 1.5;

            const lohn = gen && typeof gen.getValueAndWage === "function"
                ? gen.getValueAndWage(p.overall || 50, club.level || 1, p.age || 25).wage
                : (p.wage || 0);
            treffer.push({ player: p, gruppe, staerke, bester, preis, lohn, wert, verein: verkaeufer });
        });

        // Höchstens einer je Verein - sonst stünde dreimal derselbe Kader da
        treffer.sort((a, b) => b.wert - a.wert);
        const vereine = new Set();
        const jeGruppe = {};
        const auswahl = [];
        for (const t of treffer) {
            const v = t.player.clubId || "frei";
            if (v !== "frei" && vereine.has(v)) continue;
            // Bei der Suche nach Bedarf nicht nur eine Baustelle
            if ((jeGruppe[t.gruppe.key] || 0) >= proGruppe) continue;
            vereine.add(v);
            jeGruppe[t.gruppe.key] = (jeGruppe[t.gruppe.key] || 0) + 1;
            auswahl.push(t);
            if (auswahl.length >= (kriterien.anzahl || 5)) break;
        }
        return auswahl.map(t => ({
            id: t.player.id,
            name: t.player.name,
            pos: t.player.pos,
            age: t.player.age,
            vereinName: t.verein ? t.verein.name : "vereinslos",
            preis: t.preis,
            lohn: t.lohn,
            gruppe: t.gruppe.key,
            grund: this.grund(rolle, t, niveau)
        }));
    }

    /** Warum er ihn vorschlägt - in einem Satz */
    static grund(rolle, t, niveau) {
        const geld = this._geld;
        const g = this.GRUPPEN[t.gruppe.key];
        const kosten = t.player.clubId ? `Ablöse um ${geld(t.preis)}` : "ablösefrei";
        if (rolle === "talent") {
            return `Ein Talent ${g.fuer}: ${t.player.age} Jahre, kann einer der Besten bei uns werden. ${kosten}, Gehalt um ${geld(t.lohn)} pro Woche.`;
        }
        if (rolle === "breite") {
            return `Mehr Breite ${g.im}${t.gruppe.fehlend > 0 ? " - dort fehlen uns Spieler" : ", falls der Stammspieler ausfällt"}. ${kosten}, Gehalt um ${geld(t.lohn)} pro Woche.`;
        }
        const vorsprung = t.staerke - t.bester;
        return `Würde ${g.im} sofort spielen${t.gruppe.bester ? ` - nach meiner Einschätzung ${vorsprung >= 6 ? "deutlich " : ""}stärker als ${t.gruppe.bester.name}` : ""}. ${kosten}, Gehalt um ${geld(t.lohn)} pro Woche.`;
    }

    static _geld(betrag) {
        const gs = _sdResolve("GameState", "./gameState.js");
        if (gs && typeof gs.formatMoney === "function") return gs.formatMoney(betrag);
        return `${Math.round(betrag)} €`;
    }

    /** Beratung: was er auf eine Anfrage antwortet */
    static berate(state, kriterien = {}) {
        const sd = this.person(state);
        const vorschlaege = this.suche(state, Object.assign({ anzahl: 5 }, kriterien));
        const rolle = this.ROLLEN[kriterien.rolle] ? kriterien.rolle : "stamm";
        const g = kriterien.gruppe && this.GRUPPEN[kriterien.gruppe] ? this.GRUPPEN[kriterien.gruppe] : null;
        const kopf = vorschlaege.length
            ? `${sd.name}: "${g ? g.fuer.charAt(0).toUpperCase() + g.fuer.slice(1) : "Für unsere größten Baustellen"} - ${this.ROLLEN[rolle].text} - habe ich ${vorschlaege.length === 1 ? "einen Namen" : `${vorschlaege.length} Namen`}."`
            : `${sd.name}: "Dazu finde ich niemanden, den wir uns leisten können und der zu uns käme. Vielleicht den Rahmen etwas weiter fassen?"`;
        return { vorschlaege, kopf, sportdirektor: sd.name };
    }

    /** Was er künftig in seinen regelmäßigen Vorschlägen sucht - null: nach Bedarf */
    static setzeAuftrag(state, kriterien) {
        const sd = this.person(state);
        sd.auftrag = kriterien ? Object.assign({}, kriterien, { ohne: undefined, anzahl: undefined }) : null;
        return sd.auftrag;
    }

    /**
     * Ein Tag: Alle zwei Wochen schickt er seine Vorschläge. Wer in den
     * letzten acht Wochen schon dabei war, kommt nicht gleich wieder.
     * Gibt die Zeile für den Tagesbericht zurück, oder null.
     */
    static pruefeTag(state) {
        const club = this._club(state);
        if (!club) return null;
        const sd = this.person(state);
        const heute = (state.seasonYear || 1) * 1000 + (state.currentDayIndex || 0);
        if (typeof sd.letzteRunde !== "number") { sd.letzteRunde = heute; return null; }
        if (heute - sd.letzteRunde < this.ABSTAND && heute > sd.letzteRunde) return null;
        sd.letzteRunde = heute;

        sd.genannt = sd.genannt || {};
        Object.keys(sd.genannt).forEach(id => { if (heute - sd.genannt[id] > this.SPERRE || heute < sd.genannt[id]) delete sd.genannt[id]; });
        const auftrag = sd.auftrag || { gruppe: "auto", rolle: "stamm" };
        const ohne = Object.keys(sd.genannt);
        let vorschlaege = this.suche(state, Object.assign({}, auftrag, { anzahl: this.ANZAHL, ohne }));
        // Gibt der Suchauftrag gerade nichts her, sagt er das - und schlägt
        // vor, was dem Kader fehlt. Findet er für Stammplätze niemanden,
        // schaut er nach Breite und Talenten.
        const ersatz = !vorschlaege.length && !!sd.auftrag;
        if (ersatz) vorschlaege = this.suche(state, { gruppe: "auto", rolle: "stamm", anzahl: this.ANZAHL, ohne });
        if (!vorschlaege.length) {
            vorschlaege = this.suche(state, { gruppe: "auto", rolle: "breite", anzahl: 2, ohne })
                .concat(this.suche(state, { gruppe: "auto", rolle: "talent", anzahl: 1, ohne }));
        }
        if (!vorschlaege.length) return null;
        vorschlaege.forEach(v => { sd.genannt[v.id] = heute; });

        const { gruppen } = this.lage(state);
        const baustelle = gruppen[0];
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: `${sd.name} (Sportdirektor)`,
            subject: `Spielervorschläge: ${vorschlaege.map(v => v.name).join(", ")}`,
            body: (ersatz
                    ? "Zu Ihrem Suchauftrag habe ich gerade niemanden gefunden. Diese Spieler würde ich mir trotzdem ansehen:"
                    : sd.auftrag
                    ? "Wie besprochen habe ich mich umgesehen:"
                    : `Unsere größte Baustelle sehe ich ${baustelle ? this.GRUPPEN[baustelle.key].im : "in der Breite"}. Diese Spieler würde ich mir ansehen:`)
                + "\n\n" + vorschlaege.map(v => `• ${v.name} (${v.pos}, ${v.age}, ${v.vereinName}): ${v.grund}`).join("\n")
                + "\n\nWonach ich suchen soll, können Sie mir im Transfermarkt unter Sportdirektor sagen.",
            read: false,
            type: "sportdirektor",
            vorschlaege
        });
        return `🧭 ${sd.name} schlägt ${vorschlaege.length} Spieler vor (Postfach).`;
    }
}

if (typeof window !== "undefined") {
    window.SportdirektorEngine = SportdirektorEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { SportdirektorEngine };
}
