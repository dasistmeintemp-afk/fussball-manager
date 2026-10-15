/**
 * FinanzregelEngine - Die Kaderkostenquote nach dem Vorbild der UEFA
 *
 * Bisher konnte der eigene Verein beliebig über seine Verhältnisse zahlen:
 * Wer Schulden machte, bekam irgendwann eine Kapitalspritze, sonst nichts.
 * Jetzt gilt eine Grenze für die Kaderkosten:
 *
 *   Kaderkostenquote = (Spielergehälter + Trainerstab + ein Drittel der
 *                       Ablösen der Saison) / Umsatz (Sponsor, Eintritt,
 *                       Prämien, Transfererlöse)
 *
 *   bis 70 %    - in Ordnung
 *   über 70 %   - erst eine Verwarnung; in der zweiten Saison in Folge eine
 *                 Geldstrafe (2 % des Umsatzes) und ein halbes Transferbudget
 *   über 80 %   - Geldstrafe (5 % des Umsatzes), halbes Transferbudget und
 *                 3 Punkte Abzug in der nächsten Saison, im Wiederholungsfall 6
 *
 * Gezählt wird über die Buchungen des eigenen Vereins (FinanceEngine), die
 * Bilanz zieht der Verband am Saisonende. Zur Saisonhälfte warnt die
 * Finanzabteilung, wenn die Quote über der Grenze liegt.
 */

const FinanzregelEngine = {
    GRENZE: 0.7,
    STRAFGRENZE: 0.8,
    STRAFE: { leicht: 0.02, schwer: 0.05 },
    ABZUG: { erst: 3, wieder: 6 },
    UMSATZ: ["sponsor_income", "merch_income", "ticket_income", "prize", "prize_money", "sponsor_event", "transfer_in"],
    KADER: ["wages", "staff_wages", "bonus"],
    ABLOESE_JAHRE: 3,
    GEMERKT: 5,

    _speicher(state) {
        const saison = state.seasonYear || 1;
        if (!state.finanzregel) state.finanzregel = { verlauf: [] };
        const f = state.finanzregel;
        if (!f.laufend || f.laufend.saison !== saison) f.laufend = { saison, umsatz: 0, kader: 0, abloesen: 0, gewarnt: false };
        if (!Array.isArray(f.verlauf)) f.verlauf = [];
        return f;
    },

    /** Aus FinanceEngine.recordTransaction - nur Buchungen des eigenen Vereins */
    buche(state, type, amount) {
        if (!state || typeof amount !== "number") return;
        const l = this._speicher(state).laufend;
        if (this.UMSATZ.includes(type) && amount > 0) l.umsatz += amount;
        else if (this.KADER.includes(type)) l.kader += Math.abs(amount);
        else if (type === "transfer_out") l.abloesen += Math.abs(amount);
    },

    /** Der Stand der laufenden Saison */
    stand(state) {
        const l = this._speicher(state).laufend;
        const kosten = l.kader + l.abloesen / this.ABLOESE_JAHRE;
        const quote = l.umsatz > 0 ? kosten / l.umsatz : (kosten > 0 ? 9.99 : 0);
        const status = quote <= this.GRENZE ? "gruen" : (quote <= this.STRAFGRENZE ? "gelb" : "rot");
        return { quote, kosten, umsatz: l.umsatz, kader: l.kader, abloesen: l.abloesen, status };
    },

    _club(state) { return (state?.clubs || []).find(c => c.id === state?.userClubId) || null; },

    _post(state, betreff, text) {
        if (!Array.isArray(state.inbox)) return;
        state.inbox.unshift({ id: Date.now() + Math.floor(Math.random() * 1000), matchday: state.currentMatchday, date: state.currentDate || "",
            sender: "Verband", subject: betreff, body: text, read: false, type: "board_message" });
    },

    _prozent(q) { return `${Math.round(q * 100)} %`; },

    /** Zur Saisonhälfte: eine Warnung, wenn die Quote über der Grenze liegt */
    tag(state) {
        const f = this._speicher(state);
        const gesamt = state.totalMatchdays || 34;
        if (f.laufend.gewarnt || (state.currentMatchday || 0) < Math.ceil(gesamt / 2)) return null;
        const s = this.stand(state);
        if (s.status === "gruen" || s.umsatz <= 0) return null;
        f.laufend.gewarnt = true;
        this._post(state, `⚖️ Kaderkosten bei ${this._prozent(s.quote)}`,
            `Zur Saisonhälfte liegen unsere Kaderkosten bei ${this._prozent(s.quote)} des Umsatzes. Erlaubt sind ${this._prozent(this.GRENZE)}; über ${this._prozent(this.STRAFGRENZE)} drohen Geldstrafe und Punktabzug. Gehälter senken oder Spieler verkaufen hilft.`);
        return `⚖️ Kaderkosten bei ${this._prozent(s.quote)} - Grenze ${this._prozent(this.GRENZE)}`;
    },

    /**
     * Zum Saisonende: Der Verband zieht Bilanz. Gibt die Folge zurück:
     * { quote, folge: "ok" | "verwarnung" | "strafe" | "abzug", strafe, abzug }
     */
    saisonAbschluss(state) {
        const club = this._club(state);
        if (!club) return null;
        const f = this._speicher(state);
        const s = this.stand(state);
        const saison = state.seasonYear || 1;
        if (f.verlauf.some(v => v.saison === saison)) return f.verlauf.find(v => v.saison === saison);
        const vorher = f.verlauf[f.verlauf.length - 1];
        const wiederholt = !!(vorher && vorher.saison === saison - 1 && vorher.quote > this.GRENZE);
        const ergebnis = { saison, quote: Math.round(s.quote * 1000) / 1000, folge: "ok", strafe: 0, abzug: 0 };
        if (s.quote > this.STRAFGRENZE) {
            ergebnis.folge = "abzug";
            ergebnis.strafe = Math.round(s.umsatz * this.STRAFE.schwer);
            const frueherAbzug = f.verlauf.some(v => v.folge === "abzug" && v.saison >= saison - 2);
            ergebnis.abzug = frueherAbzug ? this.ABZUG.wieder : this.ABZUG.erst;
        } else if (s.quote > this.GRENZE) {
            ergebnis.folge = wiederholt ? "strafe" : "verwarnung";
            if (wiederholt) ergebnis.strafe = Math.round(s.umsatz * this.STRAFE.leicht);
        }
        if (ergebnis.strafe > 0) club.balance = (club.balance || 0) - ergebnis.strafe;
        // Budget und Punkte treffen erst die nächste Saison - der Abzug wird
        // zum Saisonstart gesetzt, damit die abgeschlossene Tabelle bleibt
        if (ergebnis.folge === "strafe" || ergebnis.folge === "abzug") f.auflage = { saison: saison + 1, budgetFaktor: 0.5, abzug: ergebnis.abzug };
        f.verlauf.push(ergebnis);
        if (f.verlauf.length > this.GEMERKT) f.verlauf.splice(0, f.verlauf.length - this.GEMERKT);
        const geld = (x) => `${(x / 1e6).toFixed(1).replace(".", ",")} Mio. €`;
        const text = {
            ok: null,
            verwarnung: `Unsere Kaderkosten lagen bei ${this._prozent(s.quote)} des Umsatzes, erlaubt sind ${this._prozent(this.GRENZE)}. Der Verband belässt es bei einer Verwarnung. Liegen wir in der nächsten Saison wieder darüber, folgen Geldstrafe und ein halbes Transferbudget.`,
            strafe: `Zum zweiten Mal in Folge über der Grenze: ${this._prozent(s.quote)} statt höchstens ${this._prozent(this.GRENZE)}. Der Verband verhängt ${geld(ergebnis.strafe)} Geldstrafe, und das Transferbudget der nächsten Saison wird halbiert.`,
            abzug: `Unsere Kaderkosten lagen bei ${this._prozent(s.quote)} des Umsatzes - weit über der Grenze von ${this._prozent(this.GRENZE)}. Der Verband verhängt ${geld(ergebnis.strafe)} Geldstrafe, halbiert das Transferbudget und zieht uns in der nächsten Saison ${ergebnis.abzug} Punkte ab.`
        }[ergebnis.folge];
        if (text) this._post(state, `⚖️ Kaderkosten: ${ergebnis.folge === "verwarnung" ? "Verwarnung" : (ergebnis.folge === "strafe" ? "Geldstrafe" : `${ergebnis.abzug} Punkte Abzug`)}`, text);
        return ergebnis;
    },

    /** Zum Saisonstart, nach der Etatplanung: halbes Transferbudget und der Punktabzug */
    saisonstart(state) {
        const club = this._club(state);
        const f = state?.finanzregel;
        if (!club || !f || !f.auflage || f.auflage.saison !== (state.seasonYear || 1)) return false;
        if (f.auflage.angewandt) return false;
        club.transferBudget = Math.round((club.transferBudget || 0) * f.auflage.budgetFaktor);
        if (f.auflage.abzug > 0) {
            const saison = state.seasonYear || 1;
            const schon = club.punktabzug && club.punktabzug.saison === saison ? club.punktabzug.punkte : 0;
            club.punktabzug = { punkte: schon + f.auflage.abzug, saison, grund: "Kaderkostenquote überschritten" };
        }
        f.auflage.angewandt = true;
        return true;
    }
};

if (typeof window !== "undefined") {
    window.FinanzregelEngine = FinanzregelEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { FinanzregelEngine };
}
