/**
 * YouthEngine - Nachwuchsakademie, Jugendförderung und Talentbeförderung
 */

/** Auflösung der Module in Browser- und Node-Umgebung */
const _youthResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));

    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

const YouthEngine = {
    /**
     * Die Handschrift der Akademie - welche Positionen sie bevorzugt ausbildet.
     *
     * Eine Technikschule wie La Masia bringt Mittelfeldspieler und Flügel
     * hervor, eine Zweikampfschule Innenverteidiger und Sechser. Das ist keine
     * Frage der Qualität, sondern der Ausrichtung.
     */
    SCHUL_POSITIONEN: {
        technik:   ["ZM", "OM", "LM", "RM", "LA", "RA"],
        athletik:  ["ST", "LV", "RV", "LA", "RA", "IV"],
        spielwitz: ["ZM", "OM", "DM", "IV", "TW"],
        kampf:     ["IV", "DM", "LV", "RV", "ZM"],
        ausgewogen: []
    },

    /**
     * Schwerpunkte der Akademie, die der Manager selbst setzt.
     *
     * Die Ausbildung (Technik, Athletik ...) prägt, WIE die Talente spielen.
     * Die Positionen bestimmen, WAS nachkommt, der Jahrgang, ob viele oder
     * wenige, dafür bessere kommen, und das Einzugsgebiet, wie weit die
     * Sichter reisen - das kostet, bringt aber mehr Potenzial.
     */
    SCHWERPUNKT_POSITIONEN: {
        TW: { name: "Torhüter", positionen: ["TW"] },
        ABW: { name: "Abwehr", positionen: ["IV", "LV", "RV"] },
        MF: { name: "Mittelfeld", positionen: ["DM", "ZM", "OM", "LM", "RM"] },
        ST: { name: "Angriff", positionen: ["ST", "LA", "RA"] }
    },
    JAHRGAENGE: {
        breite: { name: "Breite", anzahl: 5, pot: -4, ovr: -1, text: "Fünf Talente, im Schnitt etwas weniger Potenzial" },
        normal: { name: "Ausgewogen", anzahl: 3, pot: 0, ovr: 0, text: "Drei Talente wie gewohnt" },
        spitze: { name: "Spitze", anzahl: 2, pot: 5, ovr: 1, text: "Nur zwei Talente, dafür mit deutlich mehr Potenzial" }
    },
    EINZUG: {
        region: { name: "Region", kosten: 0, pot: 0, heimat: 0.9, text: "Talente aus dem Umland - kostet nichts" },
        national: { name: "National", kosten: 300000, pot: 2, heimat: 0.75, text: "Sichter im ganzen Land - etwas mehr Potenzial" },
        international: { name: "International", kosten: 1000000, pot: 4, heimat: 0.4, text: "Weltweites Sichtungsnetz - das meiste Potenzial" }
    },
    /**
     * Die internationale Sichtung lohnt sich vor allem bei den Talenten aus
     * dem Ausland - deretwegen zahlt man sie. Bisher bekam jedes Talent des
     * Jahrgangs dieselben +4, gleich ob es aus dem Umland oder aus Brasilien
     * kam, und Ausnahmetalente gab es nicht.
     *
     * Jetzt: Talente aus dem Ausland +3 dazu. Eines von siebzehn ist ein
     * Ausnahmetalent (+12). Wo der Verein einen Regionalscout hat, sucht
     * das Netz dreimal so oft, und dort ist schon eines von zehn ein
     * Ausnahmetalent - der Scout kennt die Akademien.
     */
    INTERNATIONAL: { auslandPot: 3, ausnahmeChance: 0.06, ausnahmeChanceRegion: 0.1, ausnahmePot: 12, regionGewicht: 3 },
    NATION_REGION: {
        Brasilien: "suedamerika", Argentinien: "suedamerika", Kolumbien: "suedamerika", Uruguay: "suedamerika",
        Niederlande: "benelux", Belgien: "benelux", Spanien: "iberien", Portugal: "iberien",
        Frankreich: "frankreich", Italien: "italien", Österreich: "alpen", Schweiz: "alpen"
    },
    WELT_NATIONEN: ["Brasilien", "Argentinien", "Frankreich", "Niederlande", "Portugal", "Belgien", "Spanien", "Italien",
        "Kroatien", "Serbien", "Dänemark", "Schweden", "Nigeria", "Ghana", "Senegal", "Elfenbeinküste", "Japan",
        "Südkorea", "USA", "Kolumbien", "Uruguay", "Polen", "Österreich", "Schweiz"],

    /** Was die Sichtung je Jahrgang kostet - kleine Ligen zahlen weniger */
    einzugKosten(club, key) {
        const basis = (this.EINZUG[key] || this.EINZUG.region).kosten;
        const faktor = { 1: 1, 2: 0.6, 3: 0.35, 4: 0.2, 5: 0.12, 6: 0.08, 7: 0.05 }[club?.level || 1] ?? 0.1;
        return Math.round(basis * faktor / 1000) * 1000;
    },

    /** Die aktuellen Schwerpunkte - fehlen sie, gilt die bisherige Ausbildung */
    schwerpunkteVon(club) {
        const sp = club?.akademieSchwerpunkte || {};
        return {
            profil: club?.akademieProfil || sp.profil || "ausgewogen",
            positionen: Array.isArray(sp.positionen) ? sp.positionen.filter(k => this.SCHWERPUNKT_POSITIONEN[k]).slice(0, 2) : [],
            jahrgang: this.JAHRGAENGE[sp.jahrgang] ? sp.jahrgang : "normal",
            einzug: this.EINZUG[sp.einzug] ? sp.einzug : "region",
            profilSaison: sp.profilSaison ?? null
        };
    },

    /**
     * Setzt die Schwerpunkte der eigenen Akademie. Sie wirken auf den
     * nächsten Jahrgang - wer schon da ist, bleibt, wie er ausgebildet wurde.
     *
     * Die Ausbildungsphilosophie lässt sich nur einmal je Saison ändern:
     * Trainer, Übungen und Sichtung stellt man nicht jede Woche um.
     */
    setzeSchwerpunkte(state, clubId, aenderung = {}) {
        const club = (state?.clubs || []).find(c => c.id === clubId);
        if (!club) return { ok: false, meldung: "Verein nicht gefunden." };
        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        const profile = fac?.AKADEMIE_PROFILE || {};
        const jetzt = this.schwerpunkteVon(club);
        const saison = state.seasonYear || 1;
        const neu = { ...jetzt };

        if (aenderung.profil !== undefined && aenderung.profil !== jetzt.profil) {
            if (!profile[aenderung.profil]) return { ok: false, meldung: "Unbekannte Ausbildung." };
            if (jetzt.profilSaison === saison) {
                return { ok: false, meldung: "Die Ausbildung wurde in dieser Saison schon umgestellt." };
            }
            neu.profil = aenderung.profil;
            neu.profilSaison = saison;
            club.akademieProfil = aenderung.profil;
        }
        if (aenderung.positionen !== undefined) {
            const liste = [...new Set((aenderung.positionen || []).filter(k => this.SCHWERPUNKT_POSITIONEN[k]))];
            if (liste.length > 2) return { ok: false, meldung: "Höchstens zwei Positionsschwerpunkte." };
            neu.positionen = liste;
        }
        if (aenderung.jahrgang !== undefined) {
            if (!this.JAHRGAENGE[aenderung.jahrgang]) return { ok: false, meldung: "Unbekannte Jahrgangsgröße." };
            neu.jahrgang = aenderung.jahrgang;
        }
        if (aenderung.einzug !== undefined) {
            if (!this.EINZUG[aenderung.einzug]) return { ok: false, meldung: "Unbekanntes Einzugsgebiet." };
            neu.einzug = aenderung.einzug;
        }

        club.akademieSchwerpunkte = {
            profil: neu.profil,
            positionen: neu.positionen,
            jahrgang: neu.jahrgang,
            einzug: neu.einzug,
            profilSaison: neu.profilSaison
        };
        // Steht die Vorschau schon, sichten die Scouts mit den neuen
        // Schwerpunkten noch einmal - bis zum Jugendtag lässt sich nachsteuern
        let vorschauNeu = false;
        const vs = clubId === state.userClubId ? this.vorschau(state) : null;
        if (vs && vs.schluessel !== this._vorschauSchluessel(club)) {
            this._sichteVorschau(state, club, vs.tag);
            vorschauNeu = true;
        }
        return { ok: true, schwerpunkte: this.schwerpunkteVon(club), kosten: this.einzugKosten(club, neu.einzug), vorschauNeu };
    },

    /**
     * Güte des Nachwuchsleiters (nur beim eigenen Verein, der einen Stab
     * führt). Er entscheidet mit, wie gut ein Jahrgang wird und wie schnell
     * sich die Jungs entwickeln.
     */
    nachwuchsleiterGuete(state, club) {
        if (!club || !state || club.id !== state.userClubId) return null;
        const stab = _youthResolve("CoachingStaffEngine", "./coachingStaffEngine.js");
        return stab && typeof stab.staffQuality === "function" ? stab.staffQuality(club).nachwuchs : null;
    },

    /**
     * Stärke und Potenzial eines neuen Talents - passend zur Liga.
     *
     * Die Akademie erzeugte bisher für jeden Verein Talente wie für einen
     * Bundesligisten: Stärke um 55, Potenzial bis 95. In der Landesliga, wo
     * der beste Spieler bei 30 liegt, stand damit jeder Sechzehnjährige mit
     * fünf Sternen da. Jetzt richtet sich der Jahrgang nach der Ligastufe
     * des Vereins - wie bei den Spielern, die ein Verein ohnehin hat.
     *
     * zusatz.ovr / zusatz.pot verschieben in Gesamtstärke-Punkten
     * (Jahrgang, Einzugsgebiet, Nachwuchsleiter).
     */
    talentWerte(club, academyLevel, zusatz = {}) {
        const gen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
        const bereich = gen && typeof gen.getAbilityRangeForLevel === "function"
            ? gen.getAbilityRangeForLevel(club?.level || 1)
            : { minCA: 128, maxCA: 176, minPA: 134, maxPA: 184 };
        const zuStaerke = (ca) => gen && typeof gen.toOverall === "function"
            ? gen.toOverall(ca)
            : Math.max(1, Math.min(99, Math.round(ca / 2)));
        const stufe = Math.max(1, Math.min(5, academyLevel || 1));

        // Heute: deutlich unter dem Ligaschnitt - es sind Fünfzehnjährige
        const ca = Math.max(15, Math.round(bereich.minCA * 0.72 + stufe * 3
            + Math.floor(Math.random() * 16) + (zusatz.ovr || 0) * 2));
        // Potenzial: innerhalb der Spanne der Liga, eine gute Akademie holt
        // mehr heraus. Die Besten können über die Liga hinauswachsen.
        const spanne = Math.max(20, (bereich.maxPA || bereich.minPA + 50) - bereich.minPA);
        const pa = Math.min(190, Math.max(ca + 12, Math.round(bereich.minPA + spanne * (0.25 + stufe * 0.07)
            + Math.random() * spanne * 0.5 + (zusatz.pot || 0) * 2)));
        const overall = zuStaerke(ca);
        return {
            trueCurrentAbility: ca,
            truePotentialAbility: pa,
            overall,
            pot: Math.max(overall + 4, zuStaerke(pa))
        };
    },

    /**
     * Talente aus älteren Spielständen, die noch nach der alten Formel - wie
     * für einen Bundesligisten - erzeugt wurden, an die Liga anpassen.
     * Liefert die Zahl der angepassten Talente.
     */
    passeTalenteAnLigaAn(state, clubId) {
        const club = (state?.clubs || []).find(c => c.id === clubId);
        if (!club) return 0;
        const gen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
        if (!gen || typeof gen.getAbilityRangeForLevel !== "function") return 0;
        // In der ersten und zweiten Liga passten die alten Werte ungefähr
        if ((club.level || 1) <= 2) return 0;
        const bereich = gen.getAbilityRangeForLevel(club.level || 1);
        const grenze = gen.toOverall(bereich.minCA * 0.72 + 30) + 3;
        const stufe = this.akademieStufe(state, club);

        const listen = [club.youthAcademy?.prospects, clubId === state.userClubId ? state.youthAcademy?.prospects : null];
        const gesehen = new Set();
        let angepasst = 0;
        listen.forEach(liste => (liste || []).forEach(t => {
            if (!t || t.promoted || gesehen.has(t.id)) return;
            gesehen.add(t.id);
            if (typeof t.trueCurrentAbility === "number" || (t.overall || 0) <= grenze) return;
            Object.assign(t, this.talentWerte(club, stufe));
            // Die Fähigkeitswerte passen zur alten Stärke - neu auswürfeln
            if (typeof gen.generateAttributes === "function") {
                const attribute = gen.generateAttributes(t.pos || "ZM", t.overall);
                this.praegeSchule(attribute, t, club);
                Object.assign(t, attribute);
            }
            angepasst++;
        }));
        return angepasst;
    },

    /**
     * Was der Nachwuchsleiter einem Jahrgang an Potenzial bringt (in
     * Gesamtstärke-Punkten). Gemessen wird an dem, was für einen Verein
     * dieser Liga normal ist - nicht an einem festen Wert: Sonst verlor ein
     * Landesligist mit einem ordentlichen Mann trotzdem Potenzial, nur weil
     * die Güten dort insgesamt niedriger sind.
     */
    leiterBonus(state, club) {
        // Nur der eigene Verein führt einen Stab - die KI-Vereine ziehen
        // ihre Jahrgänge wie gewohnt nach
        if (!club || !state || club.id !== state.userClubId || !club.staff) return 0;
        const mitglied = club.staff.nachwuchs;
        // Ohne eigenen Nachwuchsleiter arbeitet eine Aushilfe - das kostet
        if (!mitglied || typeof mitglied.guete !== "number") return -2;
        // Gemessen am üblichen Niveau des Vereins, um das herum auch die
        // Bewerber liegen: Ein überdurchschnittlicher Mann bringt etwas, ein
        // schwacher kostet
        const stab = _youthResolve("CoachingStaffEngine", "./coachingStaffEngine.js");
        const normal = stab && typeof stab.staffQuality === "function"
            ? stab.staffQuality({ ...club, staff: undefined }).overall
            : 60;
        return Math.max(-4, Math.min(5, Math.round((mitglied.guete - normal) * 0.15)));
    },

    /**
     * Die eine Liste der eigenen Talente.
     *
     * Die Talente des eigenen Vereins standen an zwei Stellen: am Verein und
     * im Spielstand. Vor dem Speichern war es dieselbe Liste, nach dem Laden
     * zwei Kopien - und die Beförderung markierte nur die am Verein. Der
     * Reiter Jugend zeigt aber die andere: Der Beförderte stand weiter in
     * der Akademie und ließ sich ein zweites Mal befördern. Jetzt werden
     * beide wieder zu einer Liste zusammengeführt.
     */
    eigeneTalente(state) {
        if (!state) return [];
        if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) {
            if (!Array.isArray(state.youthAcademy.prospects)) state.youthAcademy.prospects = [];
            return state.youthAcademy.prospects;
        }
        if (!club.youthAcademy) club.youthAcademy = { prospects: [], level: club.facilities?.youthCenter || 1 };
        const amVerein = Array.isArray(club.youthAcademy.prospects) ? club.youthAcademy.prospects : [];
        const imSpielstand = Array.isArray(state.youthAcademy.prospects) ? state.youthAcademy.prospects : [];
        if (amVerein === imSpielstand) return amVerein;

        const nachId = new Map();
        [...amVerein, ...imSpielstand].forEach(t => {
            if (!t || t.id === undefined) return;
            const vorhanden = nachId.get(String(t.id));
            if (!vorhanden) { nachId.set(String(t.id), t); return; }
            // Wer in einer der beiden Listen befördert ist, ist befördert
            if (t.promoted) vorhanden.promoted = true;
        });
        const liste = [...nachId.values()];
        club.youthAcademy.prospects = liste;
        state.youthAcademy.prospects = liste;
        return liste;
    },

    /** Die Vorschau dieser Saison, solange der Jahrgang noch nicht da ist - sonst null */
    vorschau(state) {
        const vs = state?.youthAcademy?.vorschau;
        if (!vs || vs.saison !== (state.seasonYear || 1) || !Array.isArray(vs.talente)) return null;
        if (state.youthAcademy.jugendtagSaison === vs.saison) return null;
        return vs;
    },

    _vorschauSchluessel(club) {
        const sp = this.schwerpunkteVon(club);
        return [sp.profil, sp.positionen.join("+"), sp.jahrgang, sp.einzug].join("|");
    },

    /** Den Jahrgang sichten (ohne ihn aufzunehmen) und als Vorschau ablegen */
    _sichteVorschau(state, club, tag) {
        if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
        const talente = this.generateProspects(state, club.id, { vorschau: true });
        state.youthAcademy.vorschau = { saison: state.seasonYear || 1, tag, talente, schluessel: this._vorschauSchluessel(club) };
        return state.youthAcademy.vorschau;
    },

    /** Am Jugendtag: der gesichtete Jahrgang kommt in die Akademie, die Sichtung wird bezahlt */
    _nimmVorschauAuf(state, club, vs) {
        const sp = this.schwerpunkteVon(club);
        const kosten = this.einzugKosten(club, sp.einzug);
        if (kosten > 0) {
            club.balance = (club.balance || 0) - kosten;
            const fin = _youthResolve("FinanceEngine", "./financeEngine.js");
            if (fin && typeof fin.recordTransaction === "function") {
                fin.recordTransaction(state, club.id, "youth_scouting", -kosten, `Nachwuchssichtung (${this.EINZUG[sp.einzug].name})`);
            }
        }
        const liste = this.eigeneTalente(state);
        vs.talente.forEach(t => liste.push(t));
        return vs.talente;
    },

    /** Ab hier ist ein Talent für diese Akademie eine Ausnahme (Skala von _potSkala) */
    AUSNAHME: 0.75,

    POS_WORT: { TW: "Torhüter", IV: "Innenverteidiger", LV: "Außenverteidiger", RV: "Außenverteidiger", DM: "Sechser",
        ZM: "Mittelfeldspieler", OM: "Zehner", LM: "Flügelspieler", RM: "Flügelspieler", LA: "Flügelspieler", RA: "Flügelspieler", ST: "Stürmer" },

    /**
     * Wo ein Potenzial für diese Akademie liegt: 0 = das Übliche, 1 = das
     * Beste, was sie normalerweise hervorbringt (talentWerte ohne Zuschläge).
     */
    _potSkala(state, club) {
        const gen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
        const bereich = gen && typeof gen.getAbilityRangeForLevel === "function"
            ? gen.getAbilityRangeForLevel(club?.level || 1) : { minPA: 134, maxPA: 184 };
        const zuStaerke = (pa) => gen && typeof gen.toOverall === "function" ? gen.toOverall(pa) : Math.round(pa / 2);
        const stufe = Math.max(1, Math.min(5, this.akademieStufe(state, club)));
        const spanne = Math.max(20, (bereich.maxPA || bereich.minPA + 50) - bereich.minPA);
        const basis = bereich.minPA + spanne * (0.25 + stufe * 0.07);
        const norm = zuStaerke(basis + spanne * 0.25), top = zuStaerke(basis + spanne * 0.5);
        return (pot) => (pot - norm) / Math.max(1, top - norm);
    },

    /**
     * Was der Nachwuchsleiter über den gesichteten Jahrgang sagt. Er schätzt
     * das Potenzial - ein guter genau, ein schwacher (oder die Aushilfe ohne
     * Nachwuchsleiter) mit spürbarem Irrtum. Gemessen an dem, was diese
     * Akademie üblicherweise hervorbringt: Zwei Ausnahmetalente sind ein
     * goldener Jahrgang.
     */
    vorschauBericht(state, club, talente = []) {
        const guete = this.nachwuchsleiterGuete(state, club) ?? 50;
        const blick = club?.staff?.nachwuchs ? guete : Math.min(guete, 40);
        const irrtum = (t) => {
            const text = `${t.id}|${club?.staff?.nachwuchs?.name || "Aushilfe"}`;
            let h = 2166136261;
            for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
            return ((((h >>> 0) % 2001) - 1000) / 1000) * Math.max(0, 100 - blick) * 0.12;
        };
        const skala = this._potSkala(state, club);
        const geschaetzt = talente.map(t => ({ t, r: skala((t.pot || 0) + irrtum(t)) })).sort((a, b) => b.r - a.r);
        const ausnahmen = geschaetzt.filter(g => g.r >= this.AUSNAHME).length;
        const bester = geschaetzt[0] || null;
        const urteil = ausnahmen >= 2 ? "golden" : ausnahmen === 1 ? "gut" : (bester && bester.r >= 0 ? "ordentlich" : "schwach");
        const positionen = {};
        talente.forEach(t => { const w = this.POS_WORT[t.pos] || t.pos; positionen[w] = (positionen[w] || 0) + 1; });
        const posText = Object.entries(positionen).map(([w, n]) => n > 1 ? `${n} ${w}` : `ein ${w}`).join(", ");
        const kopf = { golden: "Das könnte ein goldener Jahrgang werden.", gut: "Ein guter Jahrgang - einer sticht heraus.",
            ordentlich: "Ein ordentlicher Jahrgang, ohne Ausreißer nach oben.", schwach: "Ein schwacher Jahrgang, ehrlich gesagt." }[urteil];
        const ueberBesten = !bester ? "" : bester.r >= this.AUSNAHME ? "ein echtes Ausnahmetalent"
            : bester.r >= 0 ? "einer für die erste Mannschaft, wenn er sich entwickelt" : "eher einer für die Breite";
        const unsicher = blick < 55;
        const text = `${unsicher ? "Ich kann den Jahrgang nur grob einschätzen. " : ""}${kopf} Dabei sind ${posText}.`
            + (bester ? ` Der Vielversprechendste ist ${bester.t.name} (${bester.t.pos}) - ${unsicher ? "vielleicht " : ""}${ueberBesten}.` : "");
        return { urteil, ausnahmen, unsicher, positionen, bester: bester ? { id: bester.t.id, name: bester.t.name, pos: bester.t.pos } : null, text };
    },

    /** Um welchen Spieltag der Jugendtag liegt - im Frühjahr, wie im Vorbild */
    jugendtagSpieltag(state) {
        const gesamt = state?.totalMatchdays || (Array.isArray(state?.schedule) ? state.schedule.length : 34) || 34;
        return Math.max(2, Math.round(gesamt * 0.7));
    },

    /**
     * Jugendtag: Einmal je Saison stellt sich der neue Jahrgang vor - im
     * Frühjahr, wie im Vorbild. Drei Spieltage vorher kündigt der
     * Nachwuchsleiter ihn an. Vorher kamen Talente nur zum Saisonstart, und
     * in der ersten Saison tat sich nach dem Anpfiff nichts mehr.
     * Liefert eine Meldung für den Tagesbericht oder null.
     */
    pruefeJugendtag(state) {
        if (!state || !state.userClubId) return null;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club) return null;
        const saison = state.seasonYear || 1;
        const tag = this.jugendtagSpieltag(state);
        const spieltag = state.currentMatchday || 1;
        if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
        const ya = state.youthAcademy;
        const postfach = (betreff, text) => {
            if (!Array.isArray(state.inbox)) return;
            state.inbox.unshift({
                id: Date.now() + Math.floor(Math.random() * 1000),
                matchday: spieltag,
                date: state.currentDate || `Spieltag ${spieltag}`,
                sender: club.staff?.nachwuchs ? `${club.staff.nachwuchs.name} (Nachwuchsleiter)` : "Nachwuchsabteilung",
                subject: betreff,
                body: text,
                read: false,
                type: "youth"
            });
        };

        // Die Vorschau: Der Jahrgang ist gesichtet, der Nachwuchsleiter
        // beschreibt ihn - so gut, wie er hinsieht
        if (spieltag >= tag - 3 && spieltag < tag && ya.vorschauSaison !== saison) {
            ya.vorschauSaison = saison;
            const vs = this._sichteVorschau(state, club, tag);
            const b = this.vorschauBericht(state, club, vs.talente);
            postfach("🎓 Jugendtag in drei Wochen",
                `Um den ${tag}. Spieltag stellt sich unser neuer Jahrgang vor: ${vs.talente.length} Talente.\n\n${b.text}\n\n`
                + "Ändern Sie die Schwerpunkte der Akademie (Reiter Jugend) bis dahin, sichten wir noch einmal neu.");
            return `🎓 Der Nachwuchsleiter kündigt den Jugendtag an (um den ${tag}. Spieltag).`;
        }

        // Der Jugendtag selbst: Es kommt der Jahrgang aus der Vorschau
        if (spieltag >= tag && ya.jugendtagSaison !== saison) {
            const vs = this.vorschau(state);
            ya.jugendtagSaison = saison;
            ya.vorschauSaison = saison;
            const neu = vs ? this._nimmVorschauAuf(state, club, vs) : this.generateProspects(state, club.id);
            delete ya.vorschau;
            const namen = neu.map(t => `• ${t.name} (${t.pos}, ${t.age} Jahre)`).join("\n");
            postfach(`🎓 Jugendtag: ${neu.length} neue Talente`,
                `Der neue Jahrgang ist da:\n${namen}\n\nSie stehen ab sofort in der Akademie (Reiter Jugend). `
                + "Wer einen Profivertrag bekommen soll, entscheiden Sie mit den Beratern.");
            return `🎓 Jugendtag: ${neu.length} neue Talente in der Akademie.`;
        }
        return null;
    },

    /**
     * Talente kommen nicht nur am Jugendtag.
     *
     * Vorher stellte sich genau einmal je Saison ein Jahrgang vor, sonst kam
     * niemand - zu selten, um eine Akademie wirklich zu führen. Jetzt meldet
     * der Nachwuchsleiter unter dem Jahr immer wieder ein einzelnes Talent,
     * das im Probetraining überzeugt hat: je besser Akademie, Nachwuchsleiter
     * und Sichtungsnetz, desto öfter (Chance je Tag, in der Grundausstattung
     * etwa dreimal je Saison, mit allem Drum und Dran rund neunmal). Und wer
     * gezielt suchen will, setzt selbst einen Sichtungstag an: ein bis zwei
     * Talente, gegen eine Gebühr nach Ligastufe, danach sechs Wochen Pause.
     * Die Akademie hat Platz für 8 Talente und 2 je Ausbaustufe - ist sie
     * voll, kommt niemand mehr dazu.
     */
    PROBETRAINING: { basis: 0.010, jeStufe: 0.002, jeLeiter: 0.0015, einzug: { region: 0, national: 0.004, international: 0.008 }, ovr: -1, pot: -1 },
    SICHTUNG: { abstand: 42, kosten: { 1: 50000, 2: 30000, 3: 15000, 4: 8000, 5: 4000, 6: 2500, 7: 1500 } },
    AKADEMIE_PLAETZE: { basis: 8, jeStufe: 2 },

    /** Wie viele Talente die eigene Akademie fasst - und wie viele da sind */
    akademiePlaetze(state, club = null) {
        const verein = club || (state?.clubs || []).find(c => c.id === state?.userClubId);
        const plaetze = this.AKADEMIE_PLAETZE.basis + this.AKADEMIE_PLAETZE.jeStufe * Math.round(this.akademieStufe(state, verein));
        const belegt = this.eigeneTalente(state).filter(t => t && !t.promoted).length;
        return { plaetze, belegt, frei: Math.max(0, plaetze - belegt) };
    },

    /** Chance je Tag, dass ein Talent im Probetraining überzeugt */
    probetrainingChance(state, club) {
        const P = this.PROBETRAINING;
        const sp = this.schwerpunkteVon(club);
        return Math.max(0.004, P.basis + P.jeStufe * this.akademieStufe(state, club)
            + P.jeLeiter * this.leiterBonus(state, club) + (P.einzug[sp.einzug] || 0));
    },

    /** Ein Tag: Überzeugt jemand im Probetraining? Meldung oder null */
    pruefeProbetraining(state, zufall = Math.random) {
        if (!state || !state.userClubId) return null;
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        if (!club || this.akademiePlaetze(state, club).frei <= 0) return null;
        if (zufall() >= this.probetrainingChance(state, club)) return null;

        const P = this.PROBETRAINING;
        const [talent] = this.generateProspects(state, club.id, { anzahl: 1, ovr: P.ovr, pot: P.pot, jahrgang: false, ohneKosten: true, quelle: "probetraining" });
        if (!talent) return null;
        this.nachwuchsPost(state, club, `🎓 Probetraining: ${talent.name} überzeugt`,
            `${talent.name} (${talent.pos}, ${talent.age} Jahre) war zum Probetraining bei uns und hat überzeugt. Er steht ab sofort in der Akademie (Reiter Jugend).`);
        return `🎓 ${talent.name} hat im Probetraining überzeugt und kommt in die Akademie.`;
    },

    /** Was ein Sichtungstag kostet und wann der nächste möglich ist */
    sichtungsLage(state) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const kosten = this.SICHTUNG.kosten[club?.level || 1] ?? 1500;
        const heute = (state?.seasonYear || 1) * 1000 + (state?.currentDayIndex || 0);
        const letzter = state?.youthAcademy?.sichtungTag;
        const warten = typeof letzter === "number" ? Math.max(0, letzter + this.SICHTUNG.abstand - heute) : 0;
        return { kosten, warten, plaetze: club ? this.akademiePlaetze(state, club) : { plaetze: 0, belegt: 0, frei: 0 } };
    },

    /** Ein selbst angesetzter Sichtungstag: ein bis zwei Talente gegen Gebühr */
    sichtungstag(state, zufall = Math.random) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        if (!club) return { success: false, error: "Kein Verein." };
        const lage = this.sichtungsLage(state);
        if (lage.warten > 0) return { success: false, error: `Der nächste Sichtungstag ist in ${lage.warten} Tagen möglich.` };
        if (lage.plaetze.frei <= 0) return { success: false, error: "Die Akademie ist voll - erst muss ein Talent gehen oder befördert werden." };
        if ((club.balance || 0) < lage.kosten) return { success: false, error: "Dafür reicht das Geld nicht." };

        club.balance -= lage.kosten;
        const fin = _youthResolve("FinanceEngine", "./financeEngine.js");
        if (fin && typeof fin.recordTransaction === "function") {
            fin.recordTransaction(state, club.id, "youth_scouting", -lage.kosten, "Sichtungstag der Akademie");
        }
        if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
        state.youthAcademy.sichtungTag = (state.seasonYear || 1) * 1000 + (state.currentDayIndex || 0);

        const anzahl = Math.min(lage.plaetze.frei, zufall() < 0.5 ? 2 : 1);
        const neu = this.generateProspects(state, club.id, { anzahl, jahrgang: false, ohneKosten: true, quelle: "sichtung" });
        this.nachwuchsPost(state, club, `🎓 Sichtungstag: ${neu.length} ${neu.length === 1 ? "Talent" : "Talente"} gefunden`,
            `Beim Sichtungstag sind uns aufgefallen:\n${neu.map(t => `• ${t.name} (${t.pos}, ${t.age} Jahre)`).join("\n")}\n\nSie stehen ab sofort in der Akademie.`);
        return { success: true, neu, kosten: lage.kosten };
    },

    /** Mit diesem Alter verlässt ein Talent ohne Profivertrag die Akademie */
    AKADEMIE_HOECHSTALTER: 19,

    /**
     * Verträge in der Akademie, wie im Vorbild.
     *
     * Bisher stand ein Talent ohne Vertrag in der Akademie, und einen
     * Profivertrag gab es in jedem Alter - auch für einen Fünfzehnjährigen.
     * Jetzt hat jedes Talent einen Jugendvertrag mit einer kleinen
     * Ausbildungsvergütung je Woche. Den ersten Profivertrag darf es erst ab
     * dem Mindestalter seines Landes unterschreiben - in England mit 17,
     * sonst mit 16 - und als Minderjähriger höchstens für drei Jahre
     * (ContractEngine.maxLaufzeit). Ohne Profivertrag ist mit 19 Schluss in
     * der Akademie, und bis dahin dürfen andere Vereine um das Talent werben.
     */
    PROFI_AB: { en: 17 },
    PROFI_AB_SONST: 16,
    VERGUETUNG: { 1: 600, 2: 350, 3: 180, 4: 90, 5: 50, 6: 30, 7: 20 },

    /** Ab welchem Alter ein Talent dieses Vereins Profi werden darf */
    profiAb(club) {
        return this.PROFI_AB[club?.countryId || "de"] ?? this.PROFI_AB_SONST;
    },

    /** Darf das Talent einen Profivertrag unterschreiben? null, wenn ja - sonst der Grund */
    profiHindernis(club, talent) {
        const ab = this.profiAb(club);
        if (!talent || (talent.age || 0) >= ab) return null;
        return `${talent.name} ist ${talent.age}. Einen Profivertrag darf er ${club?.countryId === "en" ? "in England " : ""}erst mit ${ab} unterschreiben - bis dahin läuft sein Jugendvertrag.`;
    },

    /** Was die Talente der eigenen Akademie je Woche an Ausbildungsvergütung bekommen */
    ausbildungsVerguetung(state) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        if (!club) return 0;
        const je = this.VERGUETUNG[club.level || 1] ?? 20;
        return je * this.eigeneTalente(state).filter(t => t && !t.promoted).length;
    },

    /** Der Vertrag eines Talents: Art, ab wann Profi, wie lange er noch läuft */
    vertragsLage(state, club, talent) {
        const ab = this.profiAb(club);
        const alter = talent?.age || 16;
        const saisons = Math.max(1, this.AKADEMIE_HOECHSTALTER - alter);
        const profi = alter >= ab;
        return {
            art: "Jugendvertrag",
            profiAb: ab,
            profiMoeglich: profi,
            saisons,
            verguetung: this.VERGUETUNG[club?.level || 1] ?? 20,
            text: `Jugendvertrag ${saisons === 1 ? "bis Saisonende" : `noch ${saisons} Saisons`} · ${profi ? "Profivertrag möglich" : `Profi ab ${ab}`}`
        };
    },

    /**
     * Ein Talent freigeben - Platz für neue. Läuft schon ein Gespräch über
     * seinen ersten Vertrag, geht das nicht.
     */
    talentFreigeben(state, prospectId) {
        const liste = this.eigeneTalente(state);
        const i = liste.findIndex(t => t && String(t.id) === String(prospectId) && !t.promoted);
        if (i < 0) return { success: false, error: "Talent nicht gefunden." };
        const neg = _youthResolve("NegotiationEngine", "./negotiationEngine.js");
        const laeuft = neg && typeof neg.getOpenNegotiations === "function"
            && neg.getOpenNegotiations(state).some(n => n.type === "youth_promotion" && String(n.prospectId) === String(prospectId));
        if (laeuft) return { success: false, error: "Mit ihm wird gerade über einen Vertrag verhandelt." };
        const [talent] = liste.splice(i, 1);
        return { success: true, talent };
    },

    /**
     * Zum Saisonwechsel werden die Talente ein Jahr älter. Wer dabei 19 wird
     * und noch keinen Profivertrag hat, verlässt die Akademie. Vorher blieben
     * Talente für immer 15 bis 17 und für immer in der Akademie.
     */
    alterTalente(state) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        if (!club) return [];
        const liste = this.eigeneTalente(state);
        const gehen = [];
        for (let i = liste.length - 1; i >= 0; i--) {
            const t = liste[i];
            if (!t || t.promoted) continue;
            t.age = (t.age || 16) + 1;
            if (t.age >= this.AKADEMIE_HOECHSTALTER) gehen.unshift(...liste.splice(i, 1));
        }
        // Wer geht, ist auch für Werber nicht mehr zu haben
        (state.youthAcademy?.anfragen || []).forEach(a => {
            if (a.status === "offen" && gehen.some(t => String(t.id) === String(a.talentId))) a.status = "erledigt";
        });
        // Erledigte Anfragen braucht niemand mehr
        if (Array.isArray(state.youthAcademy?.anfragen)) state.youthAcademy.anfragen = state.youthAcademy.anfragen.filter(a => a.status === "offen");
        if (gehen.length) {
            this.nachwuchsPost(state, club, `🎓 ${gehen.length} ${gehen.length === 1 ? "Talent verlässt" : "Talente verlassen"} die Akademie`,
                `Ohne Profivertrag ist mit ${this.AKADEMIE_HOECHSTALTER} Schluss in der Akademie:\n`
                + gehen.map(t => `• ${t.name} (${t.pos})`).join("\n"));
        }
        return gehen;
    },

    /**
     * Die Persönlichkeit eines Talents - fest aus seiner Kennung, ohne den
     * Zufall zu verbrauchen, auf derselben Skala wie bei den Profis (1-20).
     * Bisher hatten Talente keine, und wer befördert wurde, bekam überall
     * den Mittelwert. Wie im Vorbild prägt der Nachwuchsleiter mit: Ein
     * guter Mann zieht professionellere Jungs heran.
     */
    PERSOENLICHKEIT: {
        professionalism: [8, 18], ambition: [7, 18], consistency: [8, 18], importantMatches: [8, 18],
        injuryProneness: [4, 15], adaptability: [9, 18], loyalty: [8, 18], temperament: [7, 18]
    },
    ergaenzePersoenlichkeit(talent, leiterBonus = 0) {
        if (!talent || talent.hiddenAttributes) return false;
        const gen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
        const hash = gen && typeof gen._hashZahl === "function" ? (t) => gen._hashZahl(t) : () => 0;
        const werte = {};
        Object.entries(this.PERSOENLICHKEIT).forEach(([key, [lo, hi]]) => {
            const h = (hash(`${talent.id}|pers|${key}`) + 1) / 2;
            werte[key] = Math.min(hi, lo + Math.floor(h * (hi - lo + 1)));
        });
        werte.professionalism = Math.max(1, Math.min(20, werte.professionalism + Math.round(leiterBonus / 2)));
        talent.hiddenAttributes = werte;
        return true;
    },

    /** Heute als Zahl: Saison * 1000 + Kalendertag */
    _heute(state) {
        return (state?.seasonYear || 1) * 1000 + (state?.currentDayIndex || 0);
    },

    /**
     * Ausbildungsentschädigung, wie im Vorbild: Geht ein Talent ohne
     * Profivertrag zu einem anderen Verein, zahlt der dem Ausbilder eine
     * Entschädigung - je Ausbildungsjahr nach der Ligastufe des Ausbilders,
     * für ein großes Talent mehr. Wer über den Jugendtag kam, ist im Verein
     * groß geworden (ab 15); wer später dazukam, zählt ab seiner Ankunft.
     */
    ENTSCHAEDIGUNG: { 1: 150000, 2: 80000, 3: 40000, 4: 20000, 5: 10000, 6: 5000, 7: 2500 },
    ausbildungsJahre(state, talent) {
        const saison = state?.seasonYear || 1;
        const imVerein = saison - (talent?.seit ?? saison) + 1;
        const aufgewachsen = (talent?.quelle || "jugendtag") === "jugendtag" ? (talent?.age || 15) - 14 : 1;
        return Math.max(1, Math.min(5, Math.max(imVerein, aufgewachsen)));
    },
    /** massstab: der Verein, an dessen Akademie die Qualität des Talents gemessen wird (sonst der Ausbilder) */
    ausbildungsEntschaedigung(state, ausbilder, talent, jahre = null, massstab = null) {
        // Wie die Vereinskategorien des Weltverbands: Die Länder im
        // Hintergrund zählen eine Stufe tiefer als die großen fünf
        const hinten = (state?.leagues || []).some(l => l.id === ausbilder?.leagueId && l.hintergrund);
        const basis = this.ENTSCHAEDIGUNG[(ausbilder?.level || 1) + (hinten ? 1 : 0)] ?? 2500;
        const skala = (massstab || ausbilder) ? this._potSkala(state, massstab || ausbilder)(talent?.pot || 0) : 0;
        const faktor = 1 + Math.max(0, Math.min(1.5, skala)) * 1.5;
        const betrag = basis * (jahre ?? this.ausbildungsJahre(state, talent)) * faktor;
        const ce = _youthResolve("ContractEngine", "./contractEngine.js");
        return ce && typeof ce.rundeBetrag === "function" ? ce.rundeBetrag(betrag) : Math.round(betrag / 1000) * 1000;
    },

    /**
     * Minderjährige dürfen nach der Regel des Weltverbands nur im eigenen
     * Land wechseln - mit 16 und 17 auch innerhalb der EU. England,
     * Schottland, die Türkei und Brasilien gehören nicht dazu.
     */
    EU_LAENDER: ["de", "es", "it", "fr", "nl", "pt", "be", "at", "ch"],
    wechselErlaubt(vonLand, nachLand, alter) {
        if (vonLand === nachLand || (alter || 0) >= 18) return true;
        return (alter || 0) >= 16 && this.EU_LAENDER.includes(vonLand) && this.EU_LAENDER.includes(nachLand);
    },

    /**
     * Abwerben, wie im Vorbild: Ein Talent ohne Profivertrag dürfen andere
     * Vereine holen. Größere Vereine fragen nach den Besten der Akademie -
     * je besser das Talent für diese Akademie, desto öfter. Der Verein hat
     * sieben Tage: Ist das Talent alt genug, bindet ihn ein Profivertrag;
     * sonst kann ein Gespräch über seine Perspektive ihn halten. Geht er,
     * bekommt der Verein die Ausbildungsentschädigung.
     */
    ABWERBEN: { basis: 0.0015, abSkala: 0, frist: 7, rufVorsprung: 4 },

    anfragen(state) {
        if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
        if (!Array.isArray(state.youthAcademy.anfragen)) state.youthAcademy.anfragen = [];
        return state.youthAcademy.anfragen;
    },

    /** Die offene Anfrage für ein Talent oder null */
    offeneAnfrage(state, talentId) {
        return (state?.youthAcademy?.anfragen || []).find(a => a.status === "offen" && String(a.talentId) === String(talentId)) || null;
    },

    /** Welcher größere Verein wirbt um dieses Talent? null, wenn keiner passt */
    werberFuer(state, club, talent, zufall = Math.random) {
        const ruf = club.reputation || 50;
        // Aus dem Ausland werben nur Erstligisten
        const kandidaten = (state.clubs || []).filter(c => c.id !== club.id
            && (c.reputation || 0) >= ruf + this.ABWERBEN.rufVorsprung
            && (c.countryId === club.countryId || (c.level || 1) === 1)
            && this.wechselErlaubt(club.countryId || "de", c.countryId || "de", talent.age)
            && this._potSkala(state, c)(talent.pot || 0) >= 0);
        if (!kandidaten.length) return null;
        const gewicht = (c) => (c.countryId === club.countryId ? 3 : 1);
        let r = zufall() * kandidaten.reduce((s, c) => s + gewicht(c), 0);
        for (const c of kandidaten) { r -= gewicht(c); if (r < 0) return c; }
        return kandidaten[kandidaten.length - 1];
    },

    /** Wie wahrscheinlich geht das Talent, wenn er die Wahl hat */
    wechselChance(state, club, werber, talent) {
        const h = talent.hiddenAttributes || {};
        const abstand = (werber?.reputation || 0) - (club?.reputation || 0);
        let p = 0.55 + abstand * 0.02 + ((h.ambition ?? 12) - 12) * 0.03 - ((h.loyalty ?? 12) - 12) * 0.03;
        if (talent.mitProfis) p -= 0.15;
        return Math.max(0.2, Math.min(0.95, p));
    },

    /**
     * Ein Tag: Fristen auslaufender Anfragen und neue Anfragen. Gibt eine
     * Meldung für den Tagesbericht zurück oder null.
     */
    pruefeAbwerben(state, zufall = null) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        if (!club) return null;
        const heute = this._heute(state);
        // Ohne vorgegebenen Würfel ein fester Wurf je Talent und Tag: Der
        // Zufall des übrigen Spiels bleibt, wie er war
        const gen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
        const w = (schluessel) => zufall ? zufall()
            : (gen && typeof gen._hashZahl === "function" ? (gen._hashZahl(`${schluessel}|${heute}`) + 1) / 2 : Math.random());
        const talente = this.eigeneTalente(state).filter(t => t && !t.promoted);
        const meldungen = [];

        // Die Frist ist um
        this.anfragen(state).filter(a => a.status === "offen" && heute >= a.bis).forEach(a => {
            const talent = talente.find(t => String(t.id) === String(a.talentId));
            const werber = (state.clubs || []).find(c => c.id === a.clubId);
            if (!talent || !werber) { a.status = "erledigt"; return; }
            // Laufen die Gespräche über den Profivertrag noch, wartet der Werber
            const neg = _youthResolve("NegotiationEngine", "./negotiationEngine.js");
            const laeuft = neg && typeof neg.getOpenNegotiations === "function"
                && neg.getOpenNegotiations(state).some(n => n.type === "youth_promotion" && String(n.prospectId) === String(talent.id));
            if (laeuft) return;
            if (a.gespraech === "ja" || w(`geht|${a.id}`) >= this.wechselChance(state, club, werber, talent)) {
                a.status = "geblieben";
                this.nachwuchsPost(state, club, `🎓 ${talent.name} bleibt`, `${talent.name} hat das Angebot von ${werber.name} abgelehnt und bleibt in unserer Akademie.`);
                meldungen.push(`🎓 ${talent.name} bleibt - ${werber.name} geht leer aus.`);
            } else {
                this.wechsleTalent(state, talent, werber, a.betrag);
                a.status = "gewechselt";
                meldungen.push(`🎓 ${talent.name} wechselt zu ${werber.name}.`);
            }
        });

        // Neue Anfragen - für die Besten der Akademie
        const skala = this._potSkala(state, club);
        talente.forEach(t => {
            if (this.offeneAnfrage(state, t.id)) return;
            const s = skala(t.pot || 0);
            if (s < this.ABWERBEN.abSkala) return;
            if (w(`ab|${t.id}`) >= this.ABWERBEN.basis * (1 + 2 * Math.min(1.5, s))) return;
            const werber = this.werberFuer(state, club, t, () => w(`werber|${t.id}`));
            if (!werber) return;
            const betrag = this.ausbildungsEntschaedigung(state, club, t);
            const zuJung = this.profiHindernis(club, t);
            this.anfragen(state).push({
                id: `anfrage_${t.id}_${heute}`, talentId: t.id, talentName: t.name,
                clubId: werber.id, clubName: werber.name, betrag, seit: heute, bis: heute + this.ABWERBEN.frist,
                gespraech: null, status: "offen"
            });
            this.nachwuchsPost(state, club, `📨 ${werber.name} will ${t.name} holen`,
                `${werber.name} möchte ${t.name} (${t.pos}, ${t.age} Jahre) in seine Akademie holen. Er hat bei uns nur einen Jugendvertrag - `
                + `geht er, steht uns eine Ausbildungsentschädigung von ${this._geld(betrag)} zu.\n\n`
                + (zuJung
                    ? `Für einen Profivertrag ist er noch zu jung. Ein Gespräch über seine Perspektive bei uns kann ihn halten (Reiter Jugend).`
                    : `Halten können wir ihn mit einem Profivertrag - oder mit einem Gespräch über seine Perspektive (Reiter Jugend).`)
                + ` In sieben Tagen entscheidet er sich.`);
            meldungen.push(`📨 ${werber.name} wirbt um ${t.name}.`);
        });
        return meldungen.length ? meldungen.join(" ") : null;
    },

    /** Einmal je Anfrage: dem Talent seine Perspektive im Verein aufzeigen */
    perspektiveAufzeigen(state, anfrageId, zufall = Math.random) {
        const a = this.anfragen(state).find(x => x.id === anfrageId && x.status === "offen");
        if (!a) return { success: false, error: "Die Anfrage ist nicht mehr offen." };
        if (a.gespraech) return { success: false, error: "Das Gespräch hat schon stattgefunden." };
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        const werber = (state.clubs || []).find(c => c.id === a.clubId);
        const talent = this.eigeneTalente(state).find(t => String(t.id) === String(a.talentId));
        if (!club || !werber || !talent) return { success: false, error: "Talent oder Verein nicht gefunden." };
        const bleibt = zufall() < Math.min(0.9, 1 - this.wechselChance(state, club, werber, talent) + 0.25);
        a.gespraech = bleibt ? "ja" : "nein";
        if (bleibt) {
            a.status = "geblieben";
            return { success: true, bleibt: true, text: `${talent.name} glaubt an seinen Weg bei uns und sagt ${werber.name} ab.` };
        }
        return { success: true, bleibt: false, text: `${talent.name} hört sich das Angebot von ${werber.name} trotzdem an.` };
    },

    /** Das Talent sofort ziehen lassen - gegen die Ausbildungsentschädigung */
    talentZiehenLassen(state, anfrageId) {
        const a = this.anfragen(state).find(x => x.id === anfrageId && x.status === "offen");
        if (!a) return { success: false, error: "Die Anfrage ist nicht mehr offen." };
        const werber = (state.clubs || []).find(c => c.id === a.clubId);
        const talent = this.eigeneTalente(state).find(t => String(t.id) === String(a.talentId) && !t.promoted);
        if (!werber || !talent) return { success: false, error: "Talent oder Verein nicht gefunden." };
        this.wechsleTalent(state, talent, werber, a.betrag);
        a.status = "gewechselt";
        return { success: true, betrag: a.betrag };
    },

    /**
     * Das Talent wechselt zu einem anderen Verein: Er bekommt dort seinen
     * ersten Vertrag, der Ausbilder die Entschädigung.
     */
    wechsleTalent(state, talent, ziel, betrag) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        const liste = this.eigeneTalente(state);
        const i = liste.indexOf(talent);
        if (i >= 0) liste.splice(i, 1);
        const gen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
        const ce = _youthResolve("ContractEngine", "./contractEngine.js");
        const lohn = gen && typeof gen.getValueAndWage === "function" ? gen.getValueAndWage(talent.overall, ziel.level || 1, talent.age || 16).wage : 500;
        const spieler = this.spielerAusTalent(state, ziel, talent, {
            wage: lohn, contractYears: ce ? ce.maxLaufzeit(talent.age) : 3, eigengewaechs: false
        });
        spieler.happiness.reason = `Neu bei ${ziel.name}.`;
        state.players.push(spieler);
        if (Array.isArray(ziel.playerIds)) ziel.playerIds.push(spieler.id);
        const fin = _youthResolve("FinanceEngine", "./financeEngine.js");
        if (club && betrag > 0) {
            club.balance = (club.balance || 0) + betrag;
            ziel.balance = (ziel.balance || 0) - betrag;
            if (fin && typeof fin.recordTransaction === "function") {
                fin.recordTransaction(state, club.id, "youth_compensation", betrag, `Ausbildungsentschädigung für ${talent.name} (${ziel.name})`);
            }
        }
        if (club) {
            this.nachwuchsPost(state, club, `🎓 ${talent.name} wechselt zu ${ziel.name}`,
                `${talent.name} verlässt unsere Akademie und unterschreibt bei ${ziel.name}. Als Ausbildungsentschädigung bekommen wir ${this._geld(betrag)}.`);
        }
        return spieler;
    },

    _geld(betrag) {
        return (typeof Formatters !== "undefined" && Formatters.formatMoney) ? Formatters.formatMoney(betrag)
            : `${Math.round(betrag).toLocaleString("de-DE")} €`;
    },

    /**
     * Die Gegenrichtung: Talente aus den Akademien kleinerer Vereine, die
     * unsere Nachwuchsabteilung im Blick hat - vier je Saison, Jugendliche
     * ohne Profivertrag. Wer sie holt, zahlt dem Ausbilder die
     * Entschädigung, und das Talent muss wollen. Das Potenzial kennt man nur
     * aus der Einschätzung des Nachwuchsleiters.
     */
    FREMDE: { anzahl: 4, rufAbstand: 3, heimAnteil: 0.75 },

    fremdeTalente(state, zufall = Math.random) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        if (!club) return [];
        if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
        const saison = state.seasonYear || 1;
        const ya = state.youthAcademy;
        if (ya.fremde && ya.fremde.saison === saison) return ya.fremde.talente;

        const ruf = club.reputation || 50;
        const land = club.countryId || "de";
        const quellen = (state.clubs || []).filter(c => c.id !== club.id && (c.reputation || 0) <= ruf - this.FREMDE.rufAbstand
            && this.wechselErlaubt(c.countryId || "de", land, 16));
        const talente = [];
        const stufe = this.akademieStufe(state, club);
        const gen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
        const positionen = ["TW", "IV", "IV", "LV", "RV", "DM", "ZM", "ZM", "OM", "LA", "RA", "ST", "ST"];
        // Die Akademien im eigenen Land kennt die Nachwuchsabteilung besser:
        // drei von vier Talenten kommen von dort
        const heim = quellen.filter(c => c.countryId === land), ausland = quellen.filter(c => c.countryId !== land);
        const ziehe = () => {
            const topf = heim.length && (!ausland.length || zufall() < this.FREMDE.heimAnteil) ? heim : ausland;
            return topf[Math.floor(zufall() * topf.length)];
        };
        for (let i = 0; i < this.FREMDE.anzahl && quellen.length; i++) {
            const von = ziehe();
            // Namen aus dem Land seines Vereins
            const pool = gen && typeof gen.resolveNamePool === "function" ? gen.resolveNamePool(von.countryId || "de") : null;
            const vornamen = pool?.firstNames || ["Max"], nachnamen = pool?.lastNames || ["Müller"];
            // Im eigenen Land ab 15, aus dem EU-Ausland erst mit 16
            const alter = von.countryId === land ? 15 + Math.floor(zufall() * 2) : 16;
            const werte = this.talentWerte(club, stufe, { ovr: -1, pot: 2 + zufall() * 4 });
            const t = {
                id: `fremd_${saison}_${i}_${Math.floor(zufall() * 1e6)}`,
                clubId: club.id,
                name: `${vornamen[Math.floor(zufall() * vornamen.length)]} ${nachnamen[Math.floor(zufall() * nachnamen.length)]}`,
                age: alter,
                nationality: this.heimatland(state, von),
                pos: positionen[Math.floor(zufall() * positionen.length)],
                overall: werte.overall, pot: werte.pot,
                trueCurrentAbility: werte.trueCurrentAbility, truePotentialAbility: werte.truePotentialAbility,
                developmentRate: 1.0 + stufe * 0.1,
                schule: null, schulName: null,
                quelle: "fremd", vonClubId: von.id, vonClubName: von.name,
                promoted: false
            };
            this.ergaenzePersoenlichkeit(t);
            if (gen && typeof gen.ergaenzeKopfwerte === "function") gen.ergaenzeKopfwerte(t);
            // Grundbetrag nach dem Ausbilder, die Qualität gemessen an unserer Akademie - so,
            // wie unsere Sichter ihn sehen
            t.betrag = this.ausbildungsEntschaedigung(state, von, t, Math.max(1, alter - 14), club);
            talente.push(t);
        }
        ya.fremde = { saison, talente };
        return talente;
    },

    /** Was der Nachwuchsleiter über ein fremdes Talent sagt - so gut er hinsieht */
    fremdEinschaetzung(state, talent) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const b = this.vorschauBericht(state, club, [talent]);
        if (b.urteil === "gut" || b.urteil === "golden") return b.unsicher ? "vielleicht ein Ausnahmetalent" : "ein Ausnahmetalent";
        return b.urteil === "ordentlich" ? "einer für die erste Mannschaft, wenn er sich entwickelt" : "eher einer für die Breite";
    },

    /** Ein fremdes Talent holen: Platz, Geld und sein Ja vorausgesetzt */
    holeFremdesTalent(state, talentId, zufall = Math.random) {
        const club = (state?.clubs || []).find(c => c.id === state?.userClubId);
        const liste = this.fremdeTalente(state);
        const t = liste.find(x => String(x.id) === String(talentId));
        if (!club || !t) return { success: false, error: "Talent nicht gefunden." };
        if (this.akademiePlaetze(state, club).frei <= 0) return { success: false, error: "Die Akademie ist voll - erst muss ein Talent gehen oder befördert werden." };
        if ((club.balance || 0) < t.betrag) return { success: false, error: "Für die Ausbildungsentschädigung reicht das Geld nicht." };
        const von = (state.clubs || []).find(c => c.id === t.vonClubId);
        liste.splice(liste.indexOf(t), 1);
        const h = t.hiddenAttributes || {};
        const ja = 0.55 + ((club.reputation || 50) - (von?.reputation || 40)) * 0.02 + ((h.ambition ?? 12) - 12) * 0.03 - ((h.loyalty ?? 12) - 12) * 0.02;
        if (zufall() >= Math.max(0.3, Math.min(0.95, ja))) {
            return { success: true, kommt: false, text: `${t.name} will bei ${t.vonClubName} bleiben.` };
        }
        club.balance -= t.betrag;
        if (von) von.balance = (von.balance || 0) + t.betrag;
        const fin = _youthResolve("FinanceEngine", "./financeEngine.js");
        if (fin && typeof fin.recordTransaction === "function") {
            fin.recordTransaction(state, club.id, "youth_compensation", -t.betrag, `Ausbildungsentschädigung für ${t.name} (${t.vonClubName})`);
        }
        t.seit = state.seasonYear || 1;
        delete t.betrag;
        this.eigeneTalente(state).push(t);
        this.nachwuchsPost(state, club, `🎓 ${t.name} kommt in die Akademie`,
            `${t.name} (${t.pos}, ${t.age} Jahre) wechselt aus der Akademie von ${t.vonClubName} zu uns. Er bekommt einen Jugendvertrag.`);
        return { success: true, kommt: true, talent: t, text: `${t.name} kommt von ${t.vonClubName} in unsere Akademie.` };
    },

    /**
     * Mit den Profis trainieren, ohne befördert zu sein - wie im Vorbild.
     * Bessere Trainer, bessere Mitspieler: Das Talent entwickelt sich
     * schneller und fühlt sich gesehen. Höchstens drei, ab 16.
     */
    MIT_PROFIS: { max: 3, abAlter: 16, faktor: 1.2 },

    mitProfisTrainieren(state, talentId, an = true) {
        const talente = this.eigeneTalente(state).filter(t => t && !t.promoted);
        const t = talente.find(x => String(x.id) === String(talentId));
        if (!t) return { success: false, error: "Talent nicht gefunden." };
        if (an) {
            if ((t.age || 0) < this.MIT_PROFIS.abAlter) return { success: false, error: `Mit den Profis trainieren Talente erst ab ${this.MIT_PROFIS.abAlter}.` };
            if (!t.mitProfis && talente.filter(x => x.mitProfis).length >= this.MIT_PROFIS.max) {
                return { success: false, error: `Höchstens ${this.MIT_PROFIS.max} Talente trainieren mit den Profis.` };
            }
        }
        t.mitProfis = !!an;
        return { success: true, talent: t };
    },

    /**
     * Wie wahrscheinlich ein Talent an einem Spieltag einen Schritt macht.
     * Bisher hing das nur an Akademie und Nachwuchsleiter. Jetzt zählen wie
     * im Vorbild auch die Persönlichkeit (Professionalität, Ehrgeiz), die
     * Einsätze in der U19 und das Training mit den Profis.
     */
    wachstumsChance(state, club, t) {
        const basis = 0.20 + this.akademieStufe(state, club) * 0.05 + this.leiterBonus(state, club) * 0.01;
        const h = t.hiddenAttributes || {};
        const charakter = 0.75 + 0.5 * ((h.professionalism ?? 12) / 20) + 0.05 * (((h.ambition ?? 12) - 12) / 4);
        const j = state?.jugendliga;
        const runden = j && j.saison === (state.seasonYear || 1) ? j.runde : 0;
        const quote = runden > 0 ? Math.min(1, (t.u19Saison === j.saison ? (t.u19Spiele || 0) : 0) / runden) : 1;
        const spiel = 0.8 + 0.2 * quote;
        return basis * charakter * spiel * (t.mitProfis ? this.MIT_PROFIS.faktor : 1);
    },

    /** Post der Nachwuchsabteilung */
    nachwuchsPost(state, club, betreff, text) {
        if (!Array.isArray(state.inbox)) return;
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday || 1,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: club.staff?.nachwuchs ? `${club.staff.nachwuchs.name} (Nachwuchsleiter)` : "Nachwuchsabteilung",
            subject: betreff,
            body: text,
            read: false,
            type: "youth"
        });
    },

    /** Das Land des Vereins, in Worten wie bei den Nationalitäten */
    heimatland(state, club) {
        const daten = (typeof COUNTRIES_DATA !== "undefined" && COUNTRIES_DATA)
            ? COUNTRIES_DATA
            : ((typeof window !== "undefined" && window.COUNTRIES_DATA) ? window.COUNTRIES_DATA
                : (typeof require !== "undefined" ? (() => { try { return require("../data/leagueData.js").COUNTRIES_DATA; } catch (e) { return null; } })() : null));
        const land = (daten || []).find(c => c.id === (club?.countryId || "de"));
        return land ? land.name : "Deutschland";
    },

    /** Das Anlagenprofil der Jugendakademie eines Vereins */
    schuleVon(club) {
        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        if (!fac || !club) return null;
        const key = club.akademieProfil || (fac.waehleProfil ? fac.waehleProfil(club) : "ausgewogen");
        if (club && !club.akademieProfil) club.akademieProfil = key;
        const profil = (fac.AKADEMIE_PROFILE || {})[key];
        return profil ? { key, ...profil } : null;
    },

    /**
     * Wie gut die Akademie gerade arbeitet.
     *
     * Nicht die gebaute Stufe zählt, sondern die wirksame: Eine Akademie, die
     * seit acht Jahren niemand angefasst hat, bildet schlechter aus als eine
     * kleinere, die gepflegt wird.
     */
    akademieStufe(state, club) {
        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        if (fac && club && typeof fac.wirksameStufe === "function") {
            return fac.wirksameStufe(club, "youthCenter", state?.seasonYear || 1);
        }
        return club?.facilities?.youthCenter || club?.youthAcademy?.level || state?.youthAcademy?.level || 1;
    },

    /**
     * Erzeugt neue Jugendspieler für die Akademie eines Vereins (C7: auch KI-Vereine)
     */
    generateProspects(state, clubId, optionen = {}) {
        if (!state) return [];
        if (!state.youthAcademy) state.youthAcademy = { prospects: [], level: 1 };
        if (!Array.isArray(state.youthAcademy.prospects)) state.youthAcademy.prospects = [];

        const club = state.clubs.find(c => c.id === clubId);
        if (club && !club.youthAcademy) {
            club.youthAcademy = { prospects: [], level: club.facilities?.youthCenter || 1 };
        }
        const academyLevel = this.akademieStufe(state, club);
        const schule = this.schuleVon(club);

        // Die eigenen Schwerpunkte gelten nur für den Verein des Managers -
        // die KI-Vereine ziehen ihre Jahrgänge wie gewohnt nach
        const eigen = clubId === state.userClubId && !!club;
        const sp = eigen ? this.schwerpunkteVon(club) : null;
        const jahrgang = this.JAHRGAENGE[sp?.jahrgang || "normal"];
        const einzug = this.EINZUG[sp?.einzug || "region"];
        // Ein guter Nachwuchsleiter holt mehr heraus, ein schwacher weniger
        const leiterBonus = this.leiterBonus(state, club);

        // Die Sichtung kostet - abgebucht, wenn der Jahrgang kommt (nicht schon bei der Vorschau)
        if (eigen && einzug.kosten > 0 && !optionen.ohneKosten && !optionen.vorschau) {
            const kosten = this.einzugKosten(club, sp.einzug);
            if (kosten > 0) {
                club.balance = (club.balance || 0) - kosten;
                const fin = _youthResolve("FinanceEngine", "./financeEngine.js");
                if (fin && typeof fin.recordTransaction === "function") {
                    fin.recordTransaction(state, clubId, "youth_scouting", -kosten, `Nachwuchssichtung (${einzug.name})`);
                }
            }
        }

        // Die Schule zieht ihre Lieblingspositionen häufiger - aber nie allein.
        // Gesetzte Positionsschwerpunkte wiegen noch schwerer.
        const positions = ["TW", "IV", "LV", "RV", "DM", "ZM", "OM", "LM", "RM", "LA", "RA", "ST"];
        const bevorzugt = (schule && this.SCHUL_POSITIONEN[schule.key]) || [];
        let posTopf = positions.concat(bevorzugt, bevorzugt);
        (sp?.positionen || []).forEach(k => {
            const gruppe = this.SCHWERPUNKT_POSITIONEN[k].positionen;
            // Torhüter gibt es nur einen, darum stärker gewichtet
            const gewicht = k === "TW" ? 8 : 4;
            for (let i = 0; i < gewicht; i++) posTopf = posTopf.concat(gruppe);
        });
        const namePools = (typeof NAME_POOLS !== 'undefined') ? NAME_POOLS : (typeof window !== 'undefined' ? window.NAME_POOLS : (typeof require !== 'undefined' ? require('../data/namePools.js').NAME_POOLS : {}));
        const poolFirst = (namePools && namePools.firstNames) ? namePools.firstNames : ["Max", "Lukas", "Leon", "Finn", "Elias"];
        const poolLast = (namePools && namePools.lastNames) ? namePools.lastNames : ["Müller", "Schmidt", "Weber", "Bauer", "Fischer"];
        const poolNat = (namePools && namePools.nationalities) ? namePools.nationalities : ["Deutschland"];

        // Woher die Talente kommen, hängt am Einzugsgebiet
        const heimat = eigen ? this.heimatland(state, club) : null;
        const international = eigen && sp?.einzug === "international";
        const scouting = international ? _youthResolve("ScoutingEngine", "./scoutingEngine.js") : null;
        const regional = (nat) => {
            const region = this.NATION_REGION[nat];
            return !!(region && scouting && typeof scouting.regionalScouts === "function" && scouting.regionalScouts(state)[region]);
        };
        const waehleNation = () => {
            if (!eigen || !heimat) return poolNat[Math.floor(Math.random() * poolNat.length)];
            if (Math.random() < einzug.heimat) return heimat;
            if (!international) return poolNat[Math.floor(Math.random() * poolNat.length)];
            // Wo ein Regionalscout sitzt, sucht das Netz öfter
            const gewichte = this.WELT_NATIONEN.map(n => regional(n) ? this.INTERNATIONAL.regionGewicht : 1);
            let r = Math.random() * gewichte.reduce((a, b) => a + b, 0);
            for (let i = 0; i < this.WELT_NATIONEN.length; i++) { r -= gewichte[i]; if (r < 0) return this.WELT_NATIONEN[i]; }
            return this.WELT_NATIONEN[this.WELT_NATIONEN.length - 1];
        };

        const newProspects = [];
        const count = optionen.anzahl ?? (eigen ? jahrgang.anzahl : 3);
        // Probetraining und Sichtungstag folgen nicht dem Jahrgangsschwerpunkt
        const mitJahrgang = optionen.jahrgang !== false;

        for (let i = 0; i < count; i++) {
            const firstName = poolFirst[Math.floor(Math.random() * poolFirst.length)];
            const lastName = poolLast[Math.floor(Math.random() * poolLast.length)];
            const nat = waehleNation();
            const pos = posTopf[Math.floor(Math.random() * posTopf.length)];
            const age = 15 + Math.floor(Math.random() * 3); // 15, 16 oder 17

            // Stärke und Potenzial nach Ligastufe und Akademie-Level, beim
            // eigenen Verein dazu Jahrgang, Einzugsgebiet und Nachwuchsleiter
            let potPlus = eigen ? (mitJahrgang ? jahrgang.pot : 0) + einzug.pot + leiterBonus + (optionen.pot || 0) : 0;
            // Aus dem Ausland, über das internationale Netz: mehr, selten viel mehr
            let ausnahme = false;
            if (international && nat !== heimat) {
                const I = this.INTERNATIONAL;
                potPlus += I.auslandPot;
                if (Math.random() < (regional(nat) ? I.ausnahmeChanceRegion : I.ausnahmeChance)) { potPlus += I.ausnahmePot; ausnahme = true; }
            }
            const werte = this.talentWerte(club, academyLevel, { ovr: eigen ? (mitJahrgang ? jahrgang.ovr : 0) + (optionen.ovr || 0) : 0, pot: potPlus });

            const prospect = {
                id: "youth_" + Date.now() + "_" + i + "_" + Math.floor(Math.random() * 1000),
                clubId: clubId,
                name: `${firstName} ${lastName}`,
                age: age,
                nationality: nat,
                pos: pos,
                overall: werte.overall,
                pot: werte.pot,
                trueCurrentAbility: werte.trueCurrentAbility,
                truePotentialAbility: werte.truePotentialAbility,
                developmentRate: 1.0 + (academyLevel * 0.1),
                schule: schule ? schule.key : null,
                schulName: schule ? schule.name : null,
                // Wie er kam: Jugendtag, Probetraining oder Sichtungstag
                quelle: optionen.quelle || "jugendtag",
                // Seit wann er in der Akademie ist - für die Ausbildungsentschädigung
                seit: state.seasonYear || 1,
                promoted: false
            };
            if (ausnahme) prospect.ausnahmetalent = true;
            // Persönlichkeit und Kopfwerte folgen fest aus der Kennung (die
            // Kopfwerte zusätzlich aus Stärke, Alter und Persönlichkeit). Die
            // Talente der KI-Vereine bekommen sie erst mit dem Profivertrag -
            // sonst trüge jeder Spielstand Tausende Werte, die niemand sieht.
            const kopfGen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
            if (clubId === state.userClubId || optionen.vorschau) {
                this.ergaenzePersoenlichkeit(prospect, leiterBonus);
                if (kopfGen && typeof kopfGen.ergaenzeKopfwerte === "function") kopfGen.ergaenzeKopfwerte(prospect);
            }

            if (optionen.vorschau) {
                // Die Vorschau sieht den Jahrgang - aufgenommen wird er am Jugendtag
            } else if (clubId === state.userClubId) {
                // Beim eigenen Verein gibt es nur eine Liste
                this.eigeneTalente(state).push(prospect);
            } else if (club && club.youthAcademy) {
                club.youthAcademy.prospects.push(prospect);
            }
            newProspects.push(prospect);
        }

        return newProspects;
    },

    /**
     * Wöchentliches Jugendtraining zur Weiterentwicklung der Talente
     */
    trainProspects(state, clubId) {
        if (!state) return;
        const club = state.clubs?.find(c => c.id === clubId);
        const academyLvl = this.akademieStufe(state, club);
        const leiterBonus = this.leiterBonus(state, club);

        const prospects = (club?.youthAcademy?.prospects) || (clubId === state.userClubId ? state.youthAcademy?.prospects : []);
        if (!Array.isArray(prospects)) return;

        prospects.forEach(prospect => {
            if (prospect.promoted || prospect.clubId !== clubId) return;
            // Talente aus älteren Spielständen bekommen ihre Persönlichkeit nachgetragen
            if (clubId === state.userClubId) this.ergaenzePersoenlichkeit(prospect);

            // Akademie, Nachwuchsleiter, Persönlichkeit, U19-Einsätze und
            // Training mit den Profis (wachstumsChance)
            const growthChance = club ? this.wachstumsChance(state, club, prospect) : 0.20 + academyLvl * 0.05 + leiterBonus * 0.01;
            if (Math.random() < growthChance && prospect.overall < prospect.pot) {
                prospect.overall += 1;
                if (typeof prospect.trueCurrentAbility === "number") prospect.trueCurrentAbility += 2;
            }
        });
    },

    /**
     * Macht aus einem Talent einen Profi dieses Vereins - bei der
     * Beförderung und wenn ein anderer Verein ihn abwirbt.
     * terms: wage, contractYears, eigengewaechs (false, wenn er abgeworben wurde)
     */
    spielerAusTalent(state, club, prospect, terms = {}) {
        // Neuen vollwertigen Spieler in state.players erzeugen.
        // Die IDs der handgepflegten Vereine sind Zahlen, erzeugte Vereine
        // nutzen Text - deshalb wird hier eine eindeutige Text-ID gebildet.
        const newPlayerId = `youth_${club.id}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;

        const playerGen = _youthResolve("PlayerGenerator", "./playerGenerator.js");
        const level = club.level || 1;
        const werte = playerGen && typeof playerGen.getValueAndWage === "function"
            ? playerGen.getValueAndWage(prospect.overall, level, prospect.age || 18)
            : { value: Math.round(prospect.overall * prospect.overall * 1200), wage: 8000 };

        const initialWage = Math.max(120, Math.round(terms.wage ?? werte.wage));
        const initialValue = werte.value;
        const contractYears = Math.max(1, Math.min(5, Math.round(terms.contractYears ?? 3)));

        // Attributprofil passend zur Position statt fester Zufallswerte
        const attribute = (playerGen && typeof playerGen.generateAttributes === "function")
            ? playerGen.generateAttributes(prospect.pos, prospect.overall)
            : {};

        // Die Handschrift der Schule: Ein Talent aus einer Technikschule kommt
        // mit besserem Fuss und schwaecherem Koerper heraus als eines aus einer
        // Athletikschule - gleich stark, aber anders stark.
        this.praegeSchule(attribute, prospect, club);

        const posEngine = _youthResolve("PositionEngine", "./positionEngine.js");
        const nebenpositionen = Array.isArray(prospect.positions) && prospect.positions.length > 0
            ? prospect.positions
            : (posEngine ? posEngine.generateSecondaryPositions(prospect.pos) : []);

        const newPlayer = (playerGen && typeof playerGen.forme === "function" ? (x) => playerGen.forme(x) : (x) => x)(Object.assign({
            id: newPlayerId,
            name: prospect.name,
            age: prospect.age,
            nationality: prospect.nationality || "Deutschland",
            clubId: club.id,
            // Aus der eigenen Jugend: neu bei den Profis, aber kein Fremder
            vereinSeit: (state.seasonYear || state.season || 1) * 1000 + (state.currentDayIndex || 0) - 250,
            pos: prospect.pos,
            secondPos: nebenpositionen[0] || null,
            positions: nebenpositionen,
            overall: prospect.overall,
            pot: prospect.pot,
            trueCurrentAbility: prospect.trueCurrentAbility || prospect.overall * 2,
            truePotentialAbility: prospect.truePotentialAbility || prospect.pot * 2,
            trueMarketValue: initialValue,
            value: initialValue,
            wage: initialWage,
            contractYears: contractYears,
            fitness: 100,
            morale: 88,
            form: 7,
            injured: false,
            injuredWeeks: 0,
            injuryWeeks: 0,
            injuryName: null,
            suspended: false,
            suspendedMatches: 0,
            yellowCards: 0,
            yellowCardsTotal: 0,
            // Ein Ausnahmetalent für diese Akademie soll gelegentlich spielen
            squadRole: this._potSkala(state, club)(prospect.pot || 0) >= this.AUSNAHME ? "Toptalent" : "Zukunftstalent",
            // Seine Persönlichkeit nimmt er aus der Akademie mit
            hiddenAttributes: prospect.hiddenAttributes ? Object.assign({}, prospect.hiddenAttributes) : undefined,
            // Woher er kommt, bleibt an ihm haengen - ein Eigengewaechs aus
            // der Technikschule ist kein beliebiger Neuzugang.
            schule: prospect.schule || club.akademieProfil || null,
            schulName: prospect.schulName || null,
            eigengewaechsVon: terms.eigengewaechs === false ? null : club.id,
            // Wo er ausgebildet wurde - auch wenn er woanders Profi wird
            ausgebildetVon: prospect.vonClubId || prospect.clubId || club.id,
            agent: prospect.agent || null,
            happiness: {
                overall: 85,
                playingTime: 80,
                contract: 90,
                teamPerformance: 75,
                training: 85,
                reason: "Glücklich über die Beförderung in die 1. Mannschaft!"
            },
            scoutingKnowledge: {
                known: true,
                knowledgeLevel: 95,
                lastScoutedDate: "Eigene Akademie",
                reportsCount: 0,
                accuracy: 95
            },
            stats: {
                matches: 0, goals: 0, assists: 0, yellowCards: 0,
                redCards: 0, minutes: 0, cleanSheets: 0, ratingSum: 0
            }
        }, attribute));
        // Die Kopfwerte nimmt er aus der Akademie mit
        if (playerGen && Array.isArray(playerGen.KOPFWERTE)) {
            playerGen.KOPFWERTE.forEach(k => { if (typeof prospect[k] === "number") newPlayer[k] = prospect[k]; });
            if (typeof newPlayer.decisions === "number") newPlayer.kopfStand = newPlayer.overall;
            else playerGen.ergaenzeKopfwerte(newPlayer);
        }

        return newPlayer;
    },

    /**
     * Befördert ein Akademie-Talent in die 1. Mannschaft
     */
    promoteProspect(state, clubId, prospectId, terms = {}) {
        if (!state) return { success: false, error: "Kein State vorhanden." };
        const club = state.clubs.find(c => c.id === clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };
        if (clubId === state.userClubId) this.eigeneTalente(state);

        let prospect = club.youthAcademy?.prospects?.find(p => String(p.id) === String(prospectId));
        if (!prospect && state.youthAcademy?.prospects) {
            prospect = state.youthAcademy.prospects.find(p => String(p.id) === String(prospectId));
        }
        if (!prospect) return { success: false, error: "Jugendspieler nicht gefunden." };
        if (prospect.promoted) return { success: false, error: "Spieler wurde bereits befördert." };
        // Ein Talent aus einem älteren Spielstand kommt mit ligagerechten Werten
        this.passeTalenteAnLigaAn(state, clubId);

        const newPlayer = this.spielerAusTalent(state, club, prospect, terms);
        state.players.push(newPlayer);
        club.playerIds.push(newPlayer.id);
        prospect.promoted = true;
        // Wer einen Profivertrag hat, ist für Werber nicht mehr zu haben
        (state.youthAcademy?.anfragen || []).forEach(a => {
            if (a.status === "offen" && String(a.talentId) === String(prospect.id)) a.status = "geblieben";
        });

        if (!terms.skipNews && typeof NewsEngine !== 'undefined' && clubId === state.userClubId) {
            NewsEngine.addMessage(state, "youth", {
                title: `Nachwuchstalent befördert: ${newPlayer.name}`,
                sender: "Jugendakademie",
                text: `${newPlayer.name} (${newPlayer.pos}, ${newPlayer.age} Jahre, Stärke: ${newPlayer.overall}) hat seinen ersten Profivertrag unterschrieben und steht ab sofort im Kader!`,
                priority: "high",
                relatedEntity: { playerId: newPlayer.id }
            });
        }

        return { success: true, player: newPlayer };
    },

    /**
     * Drückt einem Talent die Handschrift seiner Schule auf.
     *
     * Die Stärken steigen, die Schwächen sinken - in Summe bleibt der Spieler
     * ungefähr gleich stark. Das ist der Unterschied zwischen einer besseren
     * und einer anderen Ausbildung.
     */
    praegeSchule(attribute, prospect, club) {
        if (!attribute) return attribute;

        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        const key = prospect?.schule || club?.akademieProfil;
        const profil = (fac?.AKADEMIE_PROFILE || {})[key];
        if (!profil || !profil.staerken?.length) return attribute;

        const setze = (feld, delta) => {
            if (typeof attribute[feld] !== "number") return;
            attribute[feld] = Math.max(20, Math.min(99, Math.round(attribute[feld] + delta)));
        };

        profil.staerken.forEach(f => setze(f, 5 + Math.floor(Math.random() * 4)));
        (profil.schwaechen || []).forEach(f => setze(f, -(4 + Math.floor(Math.random() * 4))));

        prospect.schulName = profil.name;
        return attribute;
    },

    /**
     * Baut die Jugendakademie aus
     */
    upgradeAcademy(state, clubId) {
        const fac = _youthResolve("FacilityEngine", "./facilityEngine.js");
        if (!fac) return { success: false, error: "Anlagenverwaltung nicht verfügbar." };
        return fac.upgrade(state, clubId, "youthCenter");
    }
};

if (typeof window !== "undefined") {
    window.YouthEngine = YouthEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YouthEngine };
}
