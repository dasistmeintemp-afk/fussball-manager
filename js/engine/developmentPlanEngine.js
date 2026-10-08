/**
 * DevelopmentPlanEngine - Der Entwicklungsplan eines Spielers
 *
 * Bisher trainierte der ganze Kader denselben Schwerpunkt, und wie schnell
 * ein Talent besser wurde, hing nur an Alter, Potenzial und Trainingsplatz -
 * ob es jede Woche spielte oder nur auf der Tribüne saß, war egal.
 *
 * Jetzt hat jeder Spieler einen eigenen Plan:
 * - Ein individueller Trainingsschwerpunkt lenkt, welche Werte wachsen.
 * - Eine Umschulung bringt ihm im Training eine neue Position bei.
 * - Ein erfahrener Mentor färbt auf einen jungen Spieler ab: Einstellung,
 *   Ehrgeiz, Nerven - und mit etwas Glück eine seiner Eigenheiten.
 * - Eine Eigenheit lässt sich gezielt antrainieren oder ablegen. Wie lange
 *   das dauert, hängt an Alter, Einstellung und Trainerstab.
 * - Spielpraxis zählt: Wer jung ist und regelmäßig spielt, entwickelt sich
 *   schneller als einer, der nur trainiert. Genau dafür gibt es Leihen.
 */

class DevelopmentPlanEngine {
    static SCHWERPUNKTE = {
        keiner: { label: "Kein eigener Schwerpunkt", werte: [] },
        abschluss: { label: "Abschluss", werte: ["shooting", "technique"], feld: true },
        passspiel: { label: "Passspiel & Übersicht", werte: ["passing", "vision"] },
        zweikampf: { label: "Zweikampf", werte: ["defense", "physical"], feld: true },
        tempo: { label: "Schnelligkeit & Ausdauer", werte: ["pace", "stamina"] },
        dribbling: { label: "Dribbling & Technik", werte: ["dribbling", "technique"], feld: true },
        kopfball: { label: "Kopfball & Stellungsspiel", werte: ["physical", "positioning"], feld: true },
        reflexe: { label: "Reflexe & Fangsicherheit", werte: ["reflexes", "handling"], torwart: true },
        torwartspiel: { label: "Herauslaufen & Abschlag", werte: ["oneOnOne", "kicking"], torwart: true }
    };

    static UMSCHUL_POSITIONEN = ["IV", "LV", "RV", "DM", "ZM", "LM", "RM", "OM", "LA", "RA", "ST"];
    static MAX_MENTEES = 3;
    static MENTOR_MINDESTALTER = 25;
    static MENTEE_HOECHSTALTER = 23;
    /** Wie viel Persönlichkeit je Trainingseinheit vom Mentor abfärbt */
    static PRAEGUNG_JE_EINHEIT = 0.012;
    /** Chance je Einheit, eine Eigenheit des Mentors zu übernehmen */
    static EIGENHEIT_JE_EINHEIT = 0.006;
    static MENTOR_WERTE = ["professionalism", "ambition", "temperament", "importantMatches", "consistency"];
    /** Mehr Eigenheiten trägt keiner - sonst wären sie nichts Besonderes */
    static MAX_EIGENHEITEN = 3;
    /** Einheiten, die ein durchschnittlicher Spieler für eine Eigenheit braucht (rund drei Monate) */
    static EIGENHEIT_EINHEITEN = 26;
    /** Trainingseinheiten in einer Woche mit Spiel - für die Schätzung */
    static EINHEITEN_JE_WOCHE = 2;
    /** Was ein Torwart lernen kann - Feldspielermarotten bringt ihm keiner bei */
    static TORWART_EIGENHEITEN = ["mitspielen", "reaktion", "elfmeterkiller"];
    /** Um so viele Punkte darf er unter der Voraussetzung liegen - dann wird es mühsam */
    static EIGENHEIT_SPIELRAUM = 6;

    static _posEngine() {
        if (typeof PositionEngine !== "undefined" && PositionEngine) return PositionEngine;
        if (typeof window !== "undefined" && window.PositionEngine) return window.PositionEngine;
        if (typeof require !== "undefined") {
            try { return require("./positionEngine.js").PositionEngine; } catch (e) { return null; }
        }
        return null;
    }

    static _playerGenerator() {
        if (typeof PlayerGenerator !== "undefined" && PlayerGenerator) return PlayerGenerator;
        if (typeof window !== "undefined" && window.PlayerGenerator) return window.PlayerGenerator;
        if (typeof require !== "undefined") {
            try { return require("./playerGenerator.js").PlayerGenerator; } catch (e) { return null; }
        }
        return null;
    }

    static _stempel(state) {
        return (state?.seasonYear || state?.season || 1) * 1000 + (state?.currentDayIndex || 0);
    }

    static _eigenerKader(state) {
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!club) return [];
        const ids = new Set(club.playerIds.map(String));
        return (state.players || []).filter(p => ids.has(String(p.id)));
    }

    static _eigenerSpieler(state, playerId) {
        return this._eigenerKader(state).find(p => String(p.id) === String(playerId)) || null;
    }

    // ------------------------------------------------------------ Schwerpunkt

    /** Die Schwerpunkte, die zu diesem Spieler passen */
    static schwerpunkteFuer(player) {
        const tw = player?.pos === "TW";
        return Object.entries(this.SCHWERPUNKTE)
            .filter(([, s]) => !(s.feld && tw) && !(s.torwart && !tw))
            .map(([key, s]) => ({ key, label: s.label, werte: s.werte }));
    }

    static setzeSchwerpunkt(state, playerId, key) {
        const p = this._eigenerSpieler(state, playerId);
        if (!p) return { success: false, error: "Nur für Spieler des eigenen Vereins." };
        if (!this.schwerpunkteFuer(p).some(s => s.key === key)) return { success: false, error: "Dieser Schwerpunkt passt nicht zu ihm." };
        if (key === "keiner") delete p.trainingsfokus;
        else p.trainingsfokus = key;
        return { success: true };
    }

    // ------------------------------------------------------------- Umschulung

    static umschulungsZiele(player) {
        const pe = this._posEngine();
        const bekannt = pe && typeof pe.getKnownPositions === "function" ? pe.getKnownPositions(player) : [player.pos];
        if (player?.pos === "TW") return [];
        return this.UMSCHUL_POSITIONEN.filter(pos => !bekannt.includes(pos));
    }

    static setzeUmschulung(state, playerId, pos) {
        const p = this._eigenerSpieler(state, playerId);
        if (!p) return { success: false, error: "Nur für Spieler des eigenen Vereins." };
        if (!pos) { delete p.umschulung; return { success: true }; }
        if (!this.umschulungsZiele(p).includes(pos)) return { success: false, error: "Diese Position kann er schon - oder sie passt nicht." };
        p.umschulung = { pos, seit: this._stempel(state) };
        return { success: true };
    }

    static umschulungsStand(player) {
        if (!player?.umschulung) return null;
        return Math.round(Math.min(1, player.positionExperience?.[player.umschulung.pos] || 0) * 100);
    }

    // ---------------------------------------------------------------- Mentoren

    /** Wie gut einer als Mentor ist: Einstellung, Beständigkeit, Erfahrung */
    static mentorWert(p) {
        const h = p?.hiddenAttributes || {};
        const erfahrung = Math.min(1, Math.max(0, ((p?.age || 25) - 24) / 8));
        return Math.max(0, Math.min(1,
            ((h.professionalism ?? 12) / 20) * 0.45
            + ((h.consistency ?? 12) / 20) * 0.2
            + ((h.importantMatches ?? 12) / 20) * 0.15
            + erfahrung * 0.2));
    }

    static menteesVon(state, mentorId) {
        return this._eigenerKader(state).filter(p => String(p.mentorId) === String(mentorId));
    }

    /** Wer für diesen jungen Spieler als Mentor infrage kommt - der Beste zuerst */
    static moeglicheMentoren(state, mentee) {
        if (!mentee || (mentee.age || 30) > this.MENTEE_HOECHSTALTER) return [];
        return this._eigenerKader(state)
            .filter(m => m.id !== mentee.id && (m.age || 0) >= this.MENTOR_MINDESTALTER
                && (this.menteesVon(state, m.id).length < this.MAX_MENTEES || String(mentee.mentorId) === String(m.id)))
            .map(m => ({ player: m, wert: this.mentorWert(m) }))
            .sort((a, b) => b.wert - a.wert);
    }

    static setzeMentor(state, menteeId, mentorId) {
        const mentee = this._eigenerSpieler(state, menteeId);
        if (!mentee) return { success: false, error: "Nur für Spieler des eigenen Vereins." };
        if (!mentorId) { delete mentee.mentorId; return { success: true }; }
        if ((mentee.age || 30) > this.MENTEE_HOECHSTALTER) return { success: false, error: `Einen Mentor bekommen Spieler bis ${this.MENTEE_HOECHSTALTER}.` };
        const mentor = this._eigenerSpieler(state, mentorId);
        if (!mentor || mentor.id === mentee.id) return { success: false, error: "Der Mentor muss im eigenen Kader stehen." };
        if ((mentor.age || 0) < this.MENTOR_MINDESTALTER) return { success: false, error: `Mentor kann sein, wer mindestens ${this.MENTOR_MINDESTALTER} ist.` };
        if (this.menteesVon(state, mentor.id).filter(p => p.id !== mentee.id).length >= this.MAX_MENTEES) {
            return { success: false, error: `${mentor.name} betreut schon ${this.MAX_MENTEES} Spieler.` };
        }
        mentee.mentorId = mentor.id;
        return { success: true };
    }

    // ------------------------------------------- Eigenheit antrainieren

    static _katalog() {
        return this._playerGenerator()?.EIGENHEITEN || [];
    }

    static _staffEngine() {
        if (typeof CoachingStaffEngine !== "undefined" && CoachingStaffEngine) return CoachingStaffEngine;
        if (typeof window !== "undefined" && window.CoachingStaffEngine) return window.CoachingStaffEngine;
        if (typeof require !== "undefined") {
            try { return require("./coachingStaffEngine.js").CoachingStaffEngine; } catch (e) { return null; }
        }
        return null;
    }

    /** Wie viel der Trainerstab des eigenen Vereins aus einer Einheit holt */
    static _stabFaktor(state) {
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        const staff = this._staffEngine();
        const q = club && staff && typeof staff.staffQuality === "function" ? staff.staffQuality(club) : null;
        return q?.entwicklungsFaktor ?? 1;
    }

    /** Erfüllt er die Voraussetzung - notfalls mit etwas Spielraum bei den Werten? */
    static _erfuellt(eintrag, player, spielraum = 0) {
        const probe = Object.assign({}, player);
        if (spielraum) {
            Object.keys(this.BERICHT_WERTE).forEach(k => { if (typeof probe[k] === "number") probe[k] += spielraum; });
        }
        try { return !!eintrag.passt(probe); } catch (e) { return false; }
    }

    /**
     * Was er lernen könnte: Eigenheiten, die zu Position und Werten passen.
     * schwer: Er liegt knapp unter der Voraussetzung - es geht, dauert aber.
     */
    static lernbareEigenheiten(player) {
        const eigene = Array.isArray(player?.traits) ? player.traits : [];
        if (!player || eigene.length >= this.MAX_EIGENHEITEN) return [];
        const torwart = player.pos === "TW";
        return this._katalog()
            .filter(e => !eigene.some(t => t && t.key === e.key))
            .filter(e => torwart === this.TORWART_EIGENHEITEN.includes(e.key))
            .map(e => {
                if (this._erfuellt(e, player)) return { key: e.key, text: e.text, schwer: false };
                if (this._erfuellt(e, player, this.EIGENHEIT_SPIELRAUM)) return { key: e.key, text: e.text, schwer: true };
                return null;
            })
            .filter(Boolean);
    }

    /**
     * Wie schnell er eine Eigenheit annimmt oder ablegt. 1 heißt: rund
     * EIGENHEIT_EINHEITEN Einheiten. Junge, professionelle und anpassungs-
     * fähige Spieler lernen schneller, ein guter Trainerstab hilft, ein
     * Mentor, der es selbst kann, macht es vor.
     */
    static eigenheitTempo(state, player, training = player?.eigenheitTraining, stab = this._stabFaktor(state)) {
        if (!player || !training) return 0;
        const h = player.hiddenAttributes || {};
        const alter = player.age || 25;
        const alterFaktor = alter <= 20 ? 1.35 : alter <= 23 ? 1.15 : alter <= 27 ? 1 : alter <= 30 ? 0.8 : alter <= 33 ? 0.6 : 0.45;
        let tempo = alterFaktor
            * (0.7 + 0.6 * ((h.professionalism ?? 12) / 20))
            * (0.85 + 0.3 * ((h.adaptability ?? 12) / 20))
            * (0.6 + 0.4 * stab);
        if (training.schwer) tempo *= 0.7;
        if (training.art === "lernen" && this._mentorKann(state, player, training.key)) tempo *= 1.3;
        return tempo;
    }

    static _mentorKann(state, player, key) {
        if (!player?.mentorId) return false;
        const mentor = (state?.players || []).find(p => String(p.id) === String(player.mentorId));
        return !!(mentor && mentor.clubId === player.clubId && (mentor.traits || []).some(t => t && t.key === key));
    }

    /** Geschätzte Wochen bis zum Ziel (für die Auswahl und den Fortschritt) */
    static eigenheitWochen(state, player, training = player?.eigenheitTraining) {
        const tempo = this.eigenheitTempo(state, player, training);
        if (!tempo) return null;
        const offen = 1 - (training.fortschritt || 0);
        return Math.max(1, Math.round(offen * this.EIGENHEIT_EINHEITEN / tempo / this.EINHEITEN_JE_WOCHE));
    }

    /**
     * Eine Eigenheit antrainieren (art "lernen") oder ablegen ("ablegen").
     * Ohne key endet das Training; der Fortschritt verfällt.
     */
    static setzeEigenheitTraining(state, playerId, key, art = "lernen") {
        const p = this._eigenerSpieler(state, playerId);
        if (!p) return { success: false, error: "Nur für Spieler des eigenen Vereins." };
        if (!key) { delete p.eigenheitTraining; return { success: true }; }
        const eintrag = this._katalog().find(e => e.key === key);
        if (!eintrag) return { success: false, error: "Diese Eigenheit gibt es nicht." };
        if (p.eigenheitTraining && p.eigenheitTraining.key === key && p.eigenheitTraining.art === art) return { success: true };
        if (art === "ablegen") {
            if (!this._hat(p, key)) return { success: false, error: `${p.name} hat diese Eigenheit gar nicht.` };
            p.eigenheitTraining = { key, art, fortschritt: 0, seit: this._stempel(state) };
            return { success: true, wochen: this.eigenheitWochen(state, p) };
        }
        if (art !== "lernen") return { success: false, error: "Unbekannte Art." };
        if (this._hat(p, key)) return { success: false, error: `${p.name} hat diese Eigenheit schon.` };
        const lernbar = this.lernbareEigenheiten(p).find(e => e.key === key);
        if (!lernbar) {
            return { success: false, error: (p.traits || []).length >= this.MAX_EIGENHEITEN
                ? `Mehr als ${this.MAX_EIGENHEITEN} Eigenheiten nimmt keiner an - erst eine ablegen.`
                : "Dafür fehlen ihm die Voraussetzungen." };
        }
        p.eigenheitTraining = { key, art, fortschritt: 0, seit: this._stempel(state), ...(lernbar.schwer ? { schwer: true } : {}) };
        return { success: true, wochen: this.eigenheitWochen(state, p) };
    }

    static _hat(player, key) {
        return Array.isArray(player?.traits) && player.traits.some(t => t && t.key === key);
    }

    /** Stand in Prozent */
    static eigenheitStand(player) {
        const t = player?.eigenheitTraining;
        return t ? Math.round(Math.min(1, t.fortschritt || 0) * 100) : null;
    }

    /** Text der Eigenheit aus dem Katalog */
    static eigenheitText(key) {
        return this._katalog().find(e => e.key === key)?.text || key;
    }

    /** Eine Einheit am Ziel weiterarbeiten. Liefert die Meldung, wenn es geschafft ist. */
    static _eigenheitEinheit(state, player, stab, zufall) {
        const t = player.eigenheitTraining;
        const hat = this._hat(player, t.key);
        // Schon erledigt - etwa weil er es sich beim Mentor abgeschaut hat
        if ((t.art === "lernen" && hat) || (t.art === "ablegen" && !hat)) { delete player.eigenheitTraining; return null; }
        const schritt = this.eigenheitTempo(state, player, t, stab) * (0.75 + 0.5 * zufall()) / this.EIGENHEIT_EINHEITEN;
        t.fortschritt = Math.round(Math.min(1, (t.fortschritt || 0) + schritt) * 10000) / 10000;
        // Die Extraarbeit kostet etwas Kraft
        player.fitness = Math.max(20, (player.fitness ?? 100) - 0.2);
        if (t.fortschritt < 1) return null;

        const text = this.eigenheitText(t.key);
        delete player.eigenheitTraining;
        if (t.art === "lernen") {
            player.traits = [...(player.traits || []), { key: t.key, text }];
            this._post(state, player, `${player.name} hat eine neue Eigenheit`,
                `Die Extraschichten haben sich gelohnt. ${player.name} hat sich angewöhnt: ${text}`);
            return `💡 ${player.name} hat eine neue Eigenheit: ${text}`;
        }
        player.traits = (player.traits || []).filter(e => e && e.key !== t.key);
        this._post(state, player, `${player.name} hat eine Eigenheit abgelegt`,
            `Es hat gedauert, aber ${player.name} hat es sich abgewöhnt. Bisher hieß es: „${text}“ - das gilt nicht mehr.`);
        return `🧹 ${player.name} hat eine Eigenheit abgelegt: ${text}`;
    }

    // ---------------------------------------------------------- Spielpraxis

    /**
     * Wie sehr Einsätze die Entwicklung tragen. Ein Talent, das jede Woche
     * spielt, wächst um gut ein Viertel schneller als im Schnitt; eines, das
     * nur trainiert, langsamer. Ab Mitte zwanzig zählt es kaum noch.
     */
    static praxisFaktor(player) {
        const praxis = typeof player?.spielpraxis === "number" ? player.spielpraxis : 0.5;
        const alter = player?.age || 25;
        if (alter <= 23) return 0.8 + 0.5 * praxis;
        if (alter <= 28) return 0.92 + 0.16 * praxis;
        return 1;
    }

    /** Wachstumsfaktor für eine Trainingseinheit: Praxis, Ansporn, Mentor */
    static entwicklungsFaktor(state, player) {
        let faktor = this.praxisFaktor(player);
        if (player?.ansporn && this._stempel(state) <= player.ansporn.bis) faktor *= 1.2;
        if (player?.mentorId) {
            const mentor = (state?.players || []).find(p => String(p.id) === String(player.mentorId));
            if (mentor && mentor.clubId === player.clubId) faktor *= 1 + (this.mentorWert(mentor) - 0.5) * 0.2;
        }
        return faktor;
    }

    // --------------------------------------------------- Nach jeder Einheit

    /**
     * Was eine Trainingseinheit über das gemeinsame Training hinaus bringt.
     * gewachsen: ob der Spieler in dieser Einheit stärker geworden ist.
     */
    static nachEinheit(state, player, { gewachsen = false, stab = 1 } = {}, zufall = Math.random) {
        const meldungen = [];
        if (!player) return meldungen;

        // 1. Der eigene Schwerpunkt: Wächst er, wachsen diese Werte mit -
        // und manchmal geht es dort auch ohne Gesamtsprung ein Stück voran
        const fokus = player.trainingsfokus && this.SCHWERPUNKTE[player.trainingsfokus];
        if (fokus && fokus.werte.length) {
            const hoch = (attr) => { if (typeof player[attr] === "number") player[attr] = Math.min(99, player[attr] + 1); };
            if (gewachsen) fokus.werte.forEach(hoch);
            else if ((player.age || 25) <= 30 && zufall() < 0.025) hoch(fokus.werte[Math.floor(zufall() * fokus.werte.length)]);
            // Zusatzschichten kosten etwas Kraft
            player.fitness = Math.max(20, (player.fitness ?? 100) - 0.3);
        }

        // 2. Umschulung: jede Einheit ein Stück der neuen Position
        if (player.umschulung) {
            const pe = this._posEngine();
            if (pe && typeof pe.gainPositionExperience === "function") {
                const stand = pe.gainPositionExperience(player, player.umschulung.pos, 0.02);
                if (stand >= 1) {
                    meldungen.push(`🎓 ${player.name} ist auf ${player.umschulung.pos} umgeschult.`);
                    this._post(state, player, `${player.name} ist umgeschult`,
                        `Das Training hat sich gelohnt: ${player.name} kann jetzt auch ${player.umschulung.pos} spielen.`);
                    delete player.umschulung;
                }
            }
        }

        // 3. Mentor: Einstellung färbt ab, manchmal auch eine Eigenheit
        if (player.mentorId) {
            const mentor = (state?.players || []).find(p => String(p.id) === String(player.mentorId));
            if (!mentor || mentor.clubId !== player.clubId || (player.age || 30) > this.MENTEE_HOECHSTALTER + 1) {
                delete player.mentorId;
            } else {
                const h = player.hiddenAttributes || (player.hiddenAttributes = {});
                const mh = mentor.hiddenAttributes || {};
                this.MENTOR_WERTE.forEach(k => {
                    if (typeof mh[k] !== "number") return;
                    const eigen = typeof h[k] === "number" ? h[k] : 12;
                    h[k] = Math.round((eigen + (mh[k] - eigen) * this.PRAEGUNG_JE_EINHEIT) * 100) / 100;
                });
                const neu = this._eigenheitVomMentor(player, mentor, zufall);
                if (neu) {
                    meldungen.push(`🧑‍🏫 ${player.name} hat sich bei ${mentor.name} etwas abgeschaut: ${neu.text}`);
                    this._post(state, player, `${player.name} lernt von ${mentor.name}`,
                        `Die Arbeit mit seinem Mentor zahlt sich aus. Neue Eigenheit: ${neu.text}`);
                }
            }
        }

        // 4. Eine Eigenheit antrainieren oder ablegen
        if (player.eigenheitTraining) {
            const fertig = this._eigenheitEinheit(state, player, stab, zufall);
            if (fertig) meldungen.push(fertig);
        }
        return meldungen;
    }

    /** Eine Eigenheit des Mentors übernehmen - nur, wenn sie zu den Werten passt */
    static _eigenheitVomMentor(player, mentor, zufall) {
        const eigene = Array.isArray(player.traits) ? player.traits : [];
        if (eigene.length >= 2 || zufall() >= this.EIGENHEIT_JE_EINHEIT) return null;
        const gen = this._playerGenerator();
        const katalog = gen?.EIGENHEITEN || [];
        // Etwas Spielraum: Ein Mentor bringt einem bei, was er beinahe kann
        const naeher = Object.assign({}, player);
        ["pace", "shooting", "passing", "dribbling", "defense", "physical", "stamina", "vision",
            "technique", "positioning", "reflexes", "handling", "oneOnOne", "kicking"].forEach(k => {
            if (typeof naeher[k] === "number") naeher[k] += 4;
        });
        const kandidaten = (mentor.traits || []).filter(t => !eigene.some(e => e.key === t.key)
            && katalog.some(k => k.key === t.key && (() => { try { return k.passt(naeher); } catch (e) { return false; } })()));
        if (!kandidaten.length) return null;
        const t = kandidaten[Math.floor(zufall() * kandidaten.length)];
        player.traits = [...eigene, { key: t.key, text: t.text }];
        return t;
    }

    static _post(state, player, betreff, text) {
        if (!state || player.clubId !== state.userClubId) return;
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: "Trainerstab",
            subject: betreff,
            body: text,
            read: false,
            type: "training_report"
        });
    }

    // ------------------------------------------------------ Monatsbericht

    /** Die Werte, deren Veränderung der Bericht nennt */
    static BERICHT_WERTE = {
        pace: "Tempo", shooting: "Abschluss", passing: "Passspiel", dribbling: "Dribbling",
        defense: "Zweikampf", physical: "Physis", stamina: "Ausdauer", vision: "Übersicht",
        technique: "Technik", positioning: "Stellungsspiel", reflexes: "Reflexe",
        handling: "Fangsicherheit", oneOnOne: "Eins gegen eins", kicking: "Abschlag"
    };

    static MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
        "August", "September", "Oktober", "November", "Dezember"];

    /** "08.2026" aus "15.08.2026" */
    static _monat(datum) {
        const m = /^\d{1,2}\.(\d{1,2})\.(\d{4})$/.exec(String(datum || ""));
        return m ? `${m[1].padStart(2, "0")}.${m[2]}` : null;
    }

    static _monatsName(monat) {
        const [m, j] = String(monat || "").split(".");
        const name = this.MONATE[Number(m) - 1];
        return name ? `${name} ${j}` : "des letzten Monats";
    }

    /** Der Stand, an dem der nächste Bericht misst */
    static _stichtag(state, monat) {
        const werte = {};
        this._eigenerKader(state).forEach(p => {
            const attr = {};
            Object.keys(this.BERICHT_WERTE).forEach(k => { if (typeof p[k] === "number") attr[k] = p[k]; });
            werte[p.id] = { o: p.overall || 0, a: attr };
        });
        const jugend = {};
        const youth = this._youthEngine();
        (youth && typeof youth.eigeneTalente === "function" ? youth.eigeneTalente(state) : [])
            .filter(t => t && !t.promoted)
            .forEach(t => { jugend[t.id] = t.overall || 0; });
        return { monat, werte, jugend };
    }

    static _youthEngine() {
        if (typeof YouthEngine !== "undefined" && YouthEngine) return YouthEngine;
        if (typeof window !== "undefined" && window.YouthEngine) return window.YouthEngine;
        if (typeof require !== "undefined") {
            try { return require("./youthEngine.js").YouthEngine; } catch (e) { return null; }
        }
        return null;
    }

    /**
     * Der Entwicklungsbericht: einmal im Monat, wer besser geworden ist und
     * wer nachgelassen hat.
     *
     * Bisher sah man Fortschritte nur, wenn man jede Akte einzeln aufschlug -
     * oder gar nicht, weil der Wert eines Spielers über Wochen um einen Punkt
     * wandert. Jetzt hält der Co-Trainer am Monatsersten fest, was sich seit
     * dem letzten Mal getan hat: Stärke vorher und nachher, dazu die Werte,
     * die sich am meisten bewegt haben, und die Talente der Akademie.
     *
     * Wird an jedem Tag gerufen und meldet sich nur beim Monatswechsel. Gibt
     * die Zeile für den Tagesbericht zurück, oder null.
     */
    static pruefeMonatsbericht(state, datum = state?.currentDate) {
        const monat = this._monat(datum);
        if (!state || !monat) return null;
        const alt = state.entwicklungsStand;
        if (!alt || !alt.werte) {
            state.entwicklungsStand = this._stichtag(state, monat);
            return null;
        }
        if (alt.monat === monat) return null;

        const bericht = this.monatsbericht(state, alt);
        state.entwicklungsStand = this._stichtag(state, monat);

        const besser = bericht.besser.length, schlechter = bericht.schlechter.length;
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: datum,
            sender: "Co-Trainer",
            subject: `Entwicklungsbericht ${this._monatsName(alt.monat)}: ${besser} besser, ${schlechter} schlechter`,
            body: this.berichtText(bericht),
            read: false,
            type: "development",
            entwicklung: bericht
        });
        return `📈 Entwicklungsbericht ${this._monatsName(alt.monat)}: ${besser} besser, ${schlechter} schlechter (Postfach).`;
    }

    /** Vergleich zwischen einem Stichtag und heute */
    static monatsbericht(state, stand) {
        const besser = [], schlechter = [];
        let gleich = 0;
        this._eigenerKader(state).forEach(p => {
            const vorher = stand.werte[p.id];
            if (!vorher) return;
            const diff = (p.overall || 0) - vorher.o;
            const werte = Object.keys(vorher.a || {})
                .map(k => ({ key: k, label: this.BERICHT_WERTE[k], diff: Math.round((p[k] || 0) - vorher.a[k]) }))
                .filter(w => w.diff !== 0)
                .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || b.diff - a.diff)
                .slice(0, 3);
            if (diff === 0) { gleich++; return; }
            const eintrag = {
                id: p.id, name: p.name, pos: p.pos, age: p.age,
                von: vorher.o, nach: p.overall || 0, diff, werte,
                grund: diff < 0
                    ? ((p.injuredWeeks || 0) > 0 ? "verletzt" : ((p.age || 25) >= 30 ? "Alter" : null))
                    : ((p.age || 25) <= 21 ? "Talent" : null)
            };
            (diff > 0 ? besser : schlechter).push(eintrag);
        });
        besser.sort((a, b) => b.diff - a.diff || b.nach - a.nach);
        schlechter.sort((a, b) => a.diff - b.diff || b.nach - a.nach);

        const youth = this._youthEngine();
        const jugend = (youth && typeof youth.eigeneTalente === "function" ? youth.eigeneTalente(state) : [])
            .filter(t => t && !t.promoted && typeof (stand.jugend || {})[t.id] === "number")
            .map(t => ({ id: t.id, name: t.name, pos: t.pos, age: t.age, von: stand.jugend[t.id], nach: t.overall || 0, diff: (t.overall || 0) - stand.jugend[t.id] }))
            .filter(t => t.diff !== 0)
            .sort((a, b) => b.diff - a.diff);

        return { monat: stand.monat, besser, schlechter, gleich, jugend };
    }

    /** Der Bericht als Text - fürs Postfach und für alte Ansichten */
    static berichtText(b) {
        const zeile = e => `• ${e.name} (${e.pos}, ${e.age}): ${e.von} → ${e.nach} (${e.diff > 0 ? "+" : ""}${e.diff})`
            + (e.werte && e.werte.length ? ` - ${e.werte.map(w => `${w.label} ${w.diff > 0 ? "+" : ""}${w.diff}`).join(", ")}` : "")
            + (e.grund === "verletzt" ? " - verletzt" : e.grund === "Alter" ? " - altersbedingt" : "");
        const teile = [];
        teile.push(b.besser.length ? `Verbessert:\n${b.besser.map(zeile).join("\n")}` : "Verbessert hat sich diesen Monat niemand.");
        if (b.schlechter.length) teile.push(`Nachgelassen:\n${b.schlechter.map(zeile).join("\n")}`);
        if (b.gleich) teile.push(`${b.gleich} Spieler ${b.gleich === 1 ? "hält" : "halten"} ${b.gleich === 1 ? "sein" : "ihr"} Niveau.`);
        if (b.jugend && b.jugend.length) teile.push(`Aus der Akademie:\n${b.jugend.map(zeile).join("\n")}`);
        return teile.join("\n\n");
    }

    /** Überblick für den Trainings-Reiter: Wer hat welchen Plan? */
    static uebersicht(state) {
        return this._eigenerKader(state)
            .filter(p => p.trainingsfokus || p.umschulung || p.mentorId || p.eigenheitTraining)
            .map(p => {
                const mentor = p.mentorId ? (state.players || []).find(m => String(m.id) === String(p.mentorId)) : null;
                return {
                    player: p,
                    schwerpunkt: p.trainingsfokus ? this.SCHWERPUNKTE[p.trainingsfokus]?.label : null,
                    umschulung: p.umschulung ? { pos: p.umschulung.pos, stand: this.umschulungsStand(p) } : null,
                    mentor: mentor ? mentor.name : null,
                    eigenheit: p.eigenheitTraining
                        ? { art: p.eigenheitTraining.art, text: this.eigenheitText(p.eigenheitTraining.key), stand: this.eigenheitStand(p) }
                        : null
                };
            });
    }
}

if (typeof window !== "undefined") {
    window.DevelopmentPlanEngine = DevelopmentPlanEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { DevelopmentPlanEngine };
}
