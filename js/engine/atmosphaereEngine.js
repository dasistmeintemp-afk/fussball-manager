/**
 * AtmosphaereEngine - Choreos, Gesänge und Pfiffe im Stadion
 *
 * Das Publikum war bisher ein Rauschteppich, der lauter wurde, je näher der
 * Ball dem Tor kam - im Derby genauso wie im Testspiel. Was die Kurve singt,
 * ob sie pfeift oder feiert, kam im Spiel nicht vor.
 *
 * Jetzt hat jedes Spiel eine Stimmung: Derbys, Europapokalnächte, Finals
 * und Spiele um Titel oder Klassenerhalt sind lauter, die Fanstimmung und
 * die Auslastung tragen dazu bei. Zu besonderen Spielen zeigt die Kurve
 * eine Choreo. Während des Spiels reagiert das Publikum auf die Lage:
 * Gesänge nach Toren, "Olé" bei klarer Führung, Aufmunterung nach einem
 * Rückstand, Pfiffe, wenn die Heimmannschaft deutlich zurückliegt, und
 * zum Abpfiff Applaus oder ein Pfeifkonzert.
 */

const AtmosphaereEngine = {
    /** Mindestabstand zwischen zwei Stimmungsmeldungen im Ticker (Spielminuten) */
    ABSTAND: 9,

    _zufall() { return Math.random(); },
    _wahl(liste) { return liste[Math.floor(this._zufall() * liste.length) % liste.length]; },

    /**
     * Die Stimmung vor dem Anpfiff.
     * ctx: { match, heim (Verein), gast (Verein), userSide, wettbewerb: "liga"|"pokal"|"euro"|"test",
     *        finale, fanMood, tabelle: { heimPlatz, gastPlatz, teams, spieltag, spieltage } }
     */
    vorDemSpiel(ctx = {}) {
        const m = ctx.match || {};
        const derby = !!m.derbyTitle;
        const wettbewerb = ctx.wettbewerb || "liga";
        const t = ctx.tabelle || {};
        const spaet = t.spieltage ? (t.spieltag || 0) / t.spieltage >= 0.75 : false;
        const spitze = t.heimPlatz && t.gastPlatz && t.heimPlatz <= 3 && t.gastPlatz <= 3;
        const abstieg = t.teams && t.heimPlatz && t.gastPlatz && t.heimPlatz > t.teams - 4 && t.gastPlatz > t.teams - 4;
        let intensitaet = 0.45;
        if (wettbewerb === "test") intensitaet = 0.2;
        if (wettbewerb === "euro") intensitaet += 0.2;
        if (wettbewerb === "pokal") intensitaet += 0.1;
        if (ctx.finale) intensitaet += 0.25;
        if (derby) intensitaet += 0.1 * (m.derbyIntensity || 2);
        if (spitze) intensitaet += spaet ? 0.2 : 0.1;
        if (abstieg && spaet) intensitaet += 0.15;
        intensitaet += ((ctx.fanMood ?? 70) - 70) / 200;
        intensitaet = Math.max(0.1, Math.min(1, intensitaet));

        let anlass = null;
        if (ctx.finale) anlass = "finale";
        else if (derby) anlass = "derby";
        else if (wettbewerb === "euro" && (ctx.ko || intensitaet >= 0.7)) anlass = "euro";
        else if (spitze && spaet) anlass = "spitze";
        else if (abstieg && spaet) anlass = "abstieg";
        return { intensitaet, anlass, choreo: anlass ? this.choreo(anlass, ctx) : null };
    },

    /** Was die Heimkurve zum Einlaufen zeigt */
    choreo(anlass, ctx = {}) {
        const heim = ctx.heim || {};
        const stadt = heim.city || "unsere Stadt";
        const texte = {
            derby: [`„${stadt} gehört uns!“ – Blockfahne über die ganze Kurve`, `Fahnenmeer in den Vereinsfarben: „Seit jeher. Für immer.“`, `„Derbysieger wird nur einer“ – Spruchband über drei Blöcke`],
            euro: [`„Europas Bühne – unser Zuhause“ – Choreo über das ganze Rund`, `Tausende Pappen in den Vereinsfarben, darüber: „Diese Nacht gehört uns“`],
            finale: [`„Holt den Pott!“ – Riesenfahne über die ganze Kurve`, `Fahnenmeer und Konfetti: „Für diesen Moment haben wir gelebt“`],
            spitze: [`„Wir wollen ganz nach oben!“ – Spruchband in der Kurve`, `Doppelhalter überall: „Jetzt oder nie“`],
            abstieg: [`„Gemeinsam bleiben wir oben!“ – Spruchband über zwei Blöcke`, `„Kämpfen bis zum Schluss“ – die Kurve steht wie eine Wand`]
        };
        return {
            text: this._wahl(texte[anlass] || texte.spitze),
            farben: [heim.primaryColor || "#dc2626", heim.secondaryColor || "#ffffff"]
        };
    },

    /**
     * Was das Publikum gerade tut - höchstens alle ABSTAND Minuten eine
     * Meldung, Tore sofort. lage: { minute, heimTore, gastTore, userSide,
     * letztesTor: "heim"|"gast"|null (seit der letzten Abfrage), fertig,
     * intensitaet, erwartung (+1 Heim klarer Favorit ... -1) }
     * Liefert { text, art: "gesang"|"pfiffe"|"applaus"|"stille", klang } oder null.
     */
    reaktion(lage, gemerkt = {}) {
        const min = lage.minute || 0;
        const diff = (lage.heimTore || 0) - (lage.gastTore || 0);
        const darf = (gemerkt.letzte ?? -99) + this.ABSTAND <= min;
        const ich = (art, text, klang = null) => { gemerkt.letzte = min; return { art, text, klang }; };
        const w = (liste) => this._wahl(liste);

        if (lage.fertig) {
            if (gemerkt.ende) return null;
            gemerkt.ende = true;
            const erwartet = lage.erwartung ?? 0;
            if (diff > 0) return ich("applaus", w(["Die Kurve feiert die Mannschaft - Ehrenrunde vor dem Heimblock.", "Stehende Ovationen. Die Spieler lassen sich feiern."]), "gesang");
            if (diff === 0) return erwartet > 0.4
                ? ich("pfiffe", "Pfiffe zum Abpfiff - die Heimfans hatten mehr erwartet.", "pfiffe")
                : ich("applaus", "Höflicher Applaus. Mit dem Punkt können die Ränge leben.");
            if (diff <= -2 || erwartet > 0.3) return ich("pfiffe", w(["Pfeifkonzert zum Abpfiff. Die Kurve wendet sich ab.", "Gellende Pfiffe - die Mannschaft schleicht vom Platz."]), "pfiffe");
            return ich("applaus", "Aufmunternder Applaus trotz der Niederlage. Die Kurve steht zur Mannschaft.");
        }
        if (lage.letztesTor === "heim") {
            gemerkt.letzte = min;
            return { art: "gesang", klang: "gesang", text: diff >= 3 ? w(["„Oh, wie ist das schön!“ - das ganze Stadion singt.", "Die Ränge beben. Jetzt ist hier Party."])
                : w(["Die Kurve explodiert! Ein Gesang hallt durchs ganze Rund.", "Torjubel, Schals in der Luft - die Heimkurve singt sich warm."]) };
        }
        if (lage.letztesTor === "gast") {
            gemerkt.letzte = min;
            return diff < 0 ? { art: "stille", text: w(["Stille auf den Rängen. Nur der Gästeblock jubelt.", "Für einen Moment ist es ganz ruhig - dann kommt der erste Anfeuerungsruf."]) }
                : { art: "gesang", klang: "gesang", text: "Der Ausgleich lässt den Gästeblock jubeln - die Heimkurve antwortet lauter." };
        }
        if (!darf) return null;
        if (diff <= -2 && min >= 55 && this._zufall() < 0.8) return ich("pfiffe", w(["Pfiffe von den Rängen. Die Geduld der Heimfans ist am Ende.", "Erste Pfiffe bei jedem Rückpass."]), "pfiffe");
        if (diff >= 2 && min >= 60 && this._zufall() < 0.7) return ich("gesang", "„Olé!“ bei jedem Pass - die Kurve genießt den Abend.", "gesang");
        if (diff === -1 && min >= 70 && this._zufall() < 0.7) return ich("gesang", "„Steht auf, wenn ihr …“ - das Stadion peitscht die Mannschaft nach vorn.", "gesang");
        if (diff === 0 && min >= 80 && this._zufall() < 0.6) return ich("gesang", "Die Schlussphase - das ganze Stadion steht und fordert den Siegtreffer.", "gesang");
        const intensitaet = lage.intensitaet ?? 0.5;
        if (this._zufall() < 0.18 + intensitaet * 0.3) return ich("gesang", w(["Wechselgesang zwischen Nord- und Südkurve.", "Die Kurve singt ihre Hymne, Schals in der Luft.", "Trommeln geben den Takt vor, die Kurve singt ohne Pause.", "Der Gästeblock hält dagegen - ein Duell auf den Rängen."]), intensitaet >= 0.6 ? "gesang" : null);
        return null;
    }
};

if (typeof window !== "undefined") {
    window.AtmosphaereEngine = AtmosphaereEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { AtmosphaereEngine };
}
