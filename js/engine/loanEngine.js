/**
 * LoanEngine - Leihgeschäfte
 *
 * Ein Talent, das nicht spielt, entwickelt sich langsamer (Spielpraxis im
 * Entwicklungsplan). Bisher blieb nur, es auf der Tribüne zu lassen oder zu
 * verkaufen. Jetzt kann man es verleihen: an einen Verein, bei dem es spielt,
 * bis zum Saisonende - der Leihverein übernimmt einen Teil des Gehalts.
 *
 * Umgekehrt geben große Vereine ihre jungen Spieler und ihre Reservisten
 * ab: Im Leihmarkt findet man Verstärkungen, die man sich als Transfer nie
 * leisten könnte. Dafür erwartet der Stammverein Einsätze.
 *
 * Ein verliehener Spieler gehört für die Dauer der Leihe zum Kader des
 * Leihvereins (clubId), spielt dort, sammelt dort Spielpraxis und kehrt zum
 * Saisonende zurück - oder schon zur Winterpause, wenn es so vereinbart
 * ist. Das Gehalt teilen sich beide Vereine nach dem Anteil.
 *
 * Wie im Vorbild ist keine Leihe ein Knopfdruck: Wer einen eigenen Spieler
 * verleihen will, setzt ihn mit Bedingungen auf die Leihliste, die Vereine
 * melden sich in den Tagen danach mit Angeboten, und der Spieler muss
 * zustimmen. Zurückholen geht nur mit vereinbartem Rückholrecht.
 */

class LoanEngine {
    /** Höchstens so viele eigene Spieler gleichzeitig verliehen */
    static MAX_VERLIEHEN = 6;
    /** Höchstens so viele Leihspieler im eigenen Kader */
    static MAX_GELIEHEN = 4;
    /** So lange gilt ein Leihangebot für einen eigenen Spieler */
    static ANGEBOTS_FRIST = 3;
    /** Höchstens so viele offene Angebote je Spieler auf der Leihliste */
    static MAX_ANGEBOTE = 3;
    /** Wie lange eine Leihe läuft */
    static DAUER = { saison: "bis zum Saisonende", winter: "bis zur Winterpause" };
    /** Einsatzzeit von wenig nach viel - "Talent": keine Zusage */
    static ROLLEN = ["Talent", "Rotation", "Stammspieler"];

    static _resolve(name, pfad) {
        if (typeof globalThis !== "undefined" && globalThis[name]) return globalThis[name];
        if (typeof window !== "undefined" && window[name]) return window[name];
        if (typeof require !== "undefined") {
            try { return require(pfad)[name]; } catch (e) { return null; }
        }
        return null;
    }

    static _stempel(state) {
        return (state?.seasonYear || state?.season || 1) * 1000 + (state?.currentDayIndex || 0);
    }

    static _geld(betrag) {
        const gs = this._resolve("GameState", "./gameState.js");
        if (gs && typeof gs.formatMoney === "function") return gs.formatMoney(betrag);
        return `${Math.round(betrag).toLocaleString("de-DE")} €`;
    }

    static _club(state, id) {
        return (state?.clubs || []).find(c => c.id === id) || null;
    }

    static _player(state, id) {
        return this._index(state).get(String(id)) || null;
    }

    /** Spieler nach ID - einmal je Spielerliste gebaut, solange sie gleich lang ist */
    static _index(state) {
        const liste = state?.players || [];
        if (!this._cache || this._cache.liste !== liste || this._cache.laenge !== liste.length) {
            this._cache = { liste, laenge: liste.length, map: new Map(liste.map(p => [String(p.id), p])) };
        }
        return this._cache.map;
    }

    /** Durchschnitt der besten vierzehn - das Niveau, um das es um Einsätze geht */
    static niveau(state, club) {
        const werte = (club?.playerIds || [])
            .map(id => this._player(state, id))
            .filter(Boolean)
            .map(p => p.overall || 50)
            .sort((a, b) => b - a)
            .slice(0, 14);
        if (!werte.length) return 50;
        return werte.reduce((a, b) => a + b, 0) / werte.length;
    }

    static istVerliehen(player) {
        return !!player?.leihe;
    }

    /** Die eigenen Spieler, die gerade woanders spielen */
    static verlieheneVon(state, clubId) {
        return (state?.players || []).filter(p => p.leihe && p.leihe.stammvereinId === clubId);
    }

    /** Die geliehenen Spieler im Kader eines Vereins */
    static geliehenVon(state, clubId) {
        return (state?.players || []).filter(p => p.leihe && p.leihe.leihvereinId === clubId);
    }

    /**
     * Welche Rolle ein Spieler bei einem Verein bekäme. Zu stark für den
     * Verein ist niemand - zu schwach schon.
     */
    static rolleBei(state, player, club) {
        const diff = (player.overall || 50) - this.niveau(state, club);
        if (diff >= 1) return "Stammspieler";
        if (diff >= -3) return "Rotation";
        return null;
    }

    /** Was der Spieler pro Woche kostet - nach Leihanteil auf beide Vereine verteilt */
    static lohnAnteilFuer(player, clubId) {
        const lohn = player?.wage || 0;
        const l = player?.leihe;
        if (!l) return player?.clubId === clubId ? lohn : 0;
        if (l.leihvereinId === clubId) return Math.round(lohn * l.lohnAnteil);
        if (l.stammvereinId === clubId) return Math.round(lohn * (1 - l.lohnAnteil));
        return 0;
    }

    // ------------------------------------------------------------ Verleihen

    /** Warum ein eigener Spieler nicht verliehen werden kann - oder null */
    /** Leihen gehen nur im Transferfenster */
    static _fenster(state) {
        const te = this._resolve("TransferEngine", "./transferEngine.js");
        return te && typeof te.fensterHindernis === "function" ? te.fensterHindernis(state) : null;
    }

    /** Die Arbeitserlaubnis für einen Leihverein in England - oder null */
    static _erlaubnis(state, player, club) {
        const engine = this._resolve("ArbeitserlaubnisEngine", "./arbeitserlaubnisEngine.js");
        return engine && player && club ? engine.pruefe(state, player, club) : null;
    }

    /** Einen Ausnahmeplatz belegen, wenn die Leihe nur so geht */
    static _belegeAusnahme(state, pruefung, club) {
        if (!pruefung || pruefung.weg !== "ausnahme") return;
        const engine = this._resolve("ArbeitserlaubnisEngine", "./arbeitserlaubnisEngine.js");
        if (engine) engine.verbrauche(state, club);
    }

    static verleihHindernis(state, player) {
        if (!player || player.clubId !== state.userClubId) return "Nur Spieler des eigenen Vereins.";
        const fenster = this._fenster(state);
        if (fenster) return fenster;
        if (player.leihe) return "Er ist bereits verliehen.";
        if ((player.injuredWeeks || 0) > 0) return "Er ist verletzt.";
        if ((player.contractYears ?? 1) < 1) return "Sein Vertrag läuft aus.";
        if (player.vorvertrag) return `Er hat bei ${player.vorvertrag.clubName} unterschrieben.`;
        if (this.verlieheneVon(state, state.userClubId).length >= this.MAX_VERLIEHEN) {
            return `Sie haben schon ${this.MAX_VERLIEHEN} Spieler verliehen.`;
        }
        const club = this._club(state, state.userClubId);
        if ((club?.playerIds || []).length <= 18) return "Der Kader ist zu klein, um Spieler abzugeben.";
        return null;
    }

    /**
     * Wer den Spieler ausleihen würde: Vereine bis zwei Ligen tiefer, bei
     * denen er spielen würde. Die besten Angebote zuerst - Stammplatz vor
     * Rotation, mehr übernommenes Gehalt vor weniger.
     */
    static interessenten(state, playerId, anzahl = 4) {
        const player = this._player(state, playerId);
        if (this.verleihHindernis(state, player)) return [];
        const eigener = this._club(state, state.userClubId);
        const eigeneStufe = eigener?.level || 1;
        const angebote = [];
        (state.clubs || []).forEach(c => {
            if (c.id === eigener.id) return;
            const stufe = c.level || 1;
            if (stufe < eigeneStufe || stufe > eigeneStufe + 2) return;
            const erlaubnis = this._erlaubnis(state, player, c);
            if (erlaubnis && !erlaubnis.erteilt) return;
            const rolle = this.rolleBei(state, player, c);
            if (!rolle) return;
            // Wer stärker ist als der Verein, ist ihm mehr wert
            const diff = (player.overall || 50) - this.niveau(state, c);
            const ruf = (c.reputation || 50) / 100;
            const lohnAnteil = Math.max(0.3, Math.min(1, 0.45 + diff * 0.05 + ruf * 0.3 - (stufe - eigeneStufe) * 0.1));
            angebote.push({
                clubId: c.id,
                clubName: c.name,
                stufe,
                rolle,
                lohnAnteil: Math.round(lohnAnteil * 20) / 20,
                wert: (rolle === "Stammspieler" ? 2 : 1) + lohnAnteil + Math.random() * 0.4
            });
        });
        return angebote.sort((a, b) => b.wert - a.wert).slice(0, anzahl);
    }

    /**
     * Den Wechsel vollziehen. bedingungen kommen aus einem angenommenen
     * Leihangebot (Gehaltsanteil, Einsatz, Gebühr, Kaufoption, Dauer,
     * Rückholrecht); ohne sie gilt, was der Verein von sich aus bietet.
     */
    static verleihen(state, playerId, clubId, bedingungen = null) {
        const player = this._player(state, playerId);
        const hindernis = this.verleihHindernis(state, player);
        if (hindernis) return { success: false, error: hindernis };
        // Alle Interessenten, nicht nur die ersten 50: Mit den zweiten und
        // dritten Ligen in fünf Ländern sind es oft über 200, und die
        // Reihenfolge hat einen Zufallsanteil - das gewählte Angebot fiel
        // sonst manchmal heraus
        const angebot = bedingungen
            ? Object.assign({ clubId, clubName: this._club(state, clubId)?.name || "" }, bedingungen)
            : this.interessenten(state, playerId, Infinity).find(a => a.clubId === clubId);
        if (!angebot) return { success: false, error: "Dieser Verein will ihn nicht ausleihen." };
        const leihverein = this._club(state, clubId);
        if (!leihverein) return { success: false, error: "Verein nicht gefunden." };
        const pruefung = this._erlaubnis(state, player, leihverein);
        if (pruefung && !pruefung.erteilt) return { success: false, error: pruefung.text };
        this._belegeAusnahme(state, pruefung, leihverein);
        const eigener = this._club(state, state.userClubId);
        // Die Leihgebühr zahlt der Leihverein
        const gebuehr = Math.max(0, Math.round(angebot.gebuehr || 0));
        if (gebuehr > 0) {
            leihverein.balance = (leihverein.balance || 0) - gebuehr;
            eigener.balance = (eigener.balance || 0) + gebuehr;
            const finanzen = this._resolve("FinanceEngine", "./financeEngine.js");
            if (finanzen && typeof finanzen.recordTransaction === "function") {
                finanzen.recordTransaction(state, eigener.id, "transfer_in", gebuehr, `Leihgebühr für ${player.name}`);
                finanzen.recordTransaction(state, leihverein.id, "transfer_out", -gebuehr, `Leihgebühr für ${player.name}`);
            }
        }
        this._wechsle(state, player, eigener, leihverein);
        player.reserve = undefined;
        player.leihListe = undefined;
        const winter = angebot.dauer === "winter";
        player.leihe = {
            stammvereinId: state.userClubId,
            leihvereinId: clubId,
            bisSaison: state.seasonYear || 1,
            bisWinter: winter || undefined,
            lohnAnteil: angebot.lohnAnteil,
            rolle: angebot.rolle,
            gebuehr: gebuehr || undefined,
            kaufoption: angebot.kaufoption || null,
            // Ohne Absprache (alte Wege, Partnerverein) bleibt das Zurückholen wie bisher möglich
            rueckholrecht: bedingungen ? !!angebot.rueckholrecht : undefined,
            seit: this._stempel(state),
            startSpiele: player.stats?.matches || 0,
            startTore: player.stats?.goals || 0,
            startNoten: player.stats?.ratingSum || 0
        };
        // Wer gehen darf, um zu spielen, freut sich
        player.morale = Math.min(99, (player.morale ?? 75) + 6);
        player.versprechen = undefined;
        player.mentorId = undefined;
        this._post(state, "Transferabteilung", `${player.name} verliehen`,
            `${player.name} spielt ${this.DAUER[winter ? "winter" : "saison"]} bei ${angebot.clubName} (${angebot.rolle}). `
            + `${angebot.clubName} übernimmt ${Math.round(angebot.lohnAnteil * 100)} % seines Gehalts`
            + (gebuehr ? ` und zahlt ${this._geld(gebuehr)} Leihgebühr` : "") + "."
            + (angebot.kaufoption ? ` ${angebot.clubName} kann ihn bis zum Saisonende für ${this._geld(angebot.kaufoption)} fest verpflichten.` : "")
            + (player.leihe.rueckholrecht ? " Wir können ihn im Winterfenster zurückholen." : (bedingungen ? " Ein Rückholrecht haben wir nicht." : "")));
        return { success: true, angebot };
    }

    /**
     * Einen verliehenen Spieler vorzeitig zurückholen - nur mit
     * vereinbartem Rückholrecht und im Fenster. Leihen von früher (ohne
     * Angabe) gelten wie bisher als zurückholbar.
     */
    static zurueckholen(state, playerId) {
        const player = this._player(state, playerId);
        if (!player?.leihe || player.leihe.stammvereinId !== state.userClubId) {
            return { success: false, error: "Er ist nicht von Ihnen verliehen." };
        }
        if (player.leihe.rueckholrecht === false) {
            return { success: false, error: "Ein Rückholrecht wurde nicht vereinbart - er bleibt bis zum Ende der Leihe." };
        }
        const fenster = this._fenster(state);
        if (fenster) return { success: false, error: `Zurückholen geht nur im Transferfenster. ${fenster}` };
        const leihverein = this._club(state, player.leihe.leihvereinId);
        this._beende(state, player);
        this._post(state, "Transferabteilung", `${player.name} zurückgeholt`,
            `${player.name} kehrt vorzeitig von ${leihverein?.name || "seinem Leihverein"} zurück.`);
        return { success: true };
    }

    // ------------------------------------------------------------ Leihliste

    /** Fester Wert zwischen 0 und 1 je Text - die Entscheidungen der Leihe verbrauchen keinen Zufall */
    static _hash(text) {
        const gen = this._resolve("PlayerGenerator", "./playerGenerator.js");
        const z = gen && typeof gen._hashZahl === "function" ? gen._hashZahl(text) : 0;
        return (z + 1) / 2;
    }

    static _angebote(state) {
        if (!Array.isArray(state.leihAngebote)) state.leihAngebote = [];
        return state.leihAngebote;
    }

    static _te() {
        return this._resolve("TransferEngine", "./transferEngine.js");
    }

    static _istDeadlineDay(state) {
        const te = this._te();
        return !!(te && typeof te.istDeadlineDay === "function" && te.istDeadlineDay(state));
    }

    /**
     * Einen eigenen Spieler zur Leihe anbieten - wie im Vorbild mit
     * Bedingungen: welchen Gehaltsanteil der Leihverein mindestens übernimmt,
     * wie viel er dort spielen soll ("Talent": egal), wie lange (bis zur
     * Winterpause geht nur im Sommer) und ob wir ihn im Winter zurückholen
     * dürfen. Die Angebote kommen in den Tagen danach (tag), am Deadline Day
     * sofort.
     */
    static zurLeiheAnbieten(state, playerId, bedingungen = {}) {
        const player = this._player(state, playerId);
        const hindernis = this.verleihHindernis(state, player);
        if (hindernis) return { success: false, error: hindernis };
        const te = this._te();
        const fenster = te && typeof te.fensterInfo === "function" ? te.fensterInfo(state) : null;
        player.leihListe = {
            minAnteil: Math.max(0, Math.min(1, Math.round((Number(bedingungen.minAnteil) || 0) * 20) / 20)),
            einsatz: this.ROLLEN.includes(bedingungen.einsatz) ? bedingungen.einsatz : "Rotation",
            dauer: bedingungen.dauer === "winter" && fenster?.art === "sommer" ? "winter" : "saison",
            rueckholrecht: !!bedingungen.rueckholrecht,
            seit: this._stempel(state),
            saison: state.seasonYear || 1,
            abgelehnt: []
        };
        const neu = this._istDeadlineDay(state) ? this.sammleAngebote(state, player, 2) : [];
        return { success: true, player, neu };
    }

    /** Von der Leihliste nehmen - offene Angebote für ihn sind damit erledigt */
    static vonLeihlisteNehmen(state, playerId) {
        const player = this._player(state, playerId);
        if (!player?.leihListe) return { success: false, error: "Er steht nicht auf der Leihliste." };
        player.leihListe = undefined;
        this._angebote(state).filter(a => String(a.playerId) === String(player.id) && a.status === "offen").forEach(a => { a.status = "zurueckgezogen"; });
        return { success: true };
    }

    /** Offene Leihangebote für eigene Spieler, dringendste zuerst */
    static offeneLeihangebote(state, playerId = null) {
        return (state?.leihAngebote || [])
            .filter(a => (a.status === "offen" || a.status === "zugesagt") && (playerId === null || String(a.playerId) === String(playerId)))
            .sort((a, b) => a.frist - b.frist);
    }

    /**
     * Was ein Verein für einen Spieler auf der Leihliste bietet - oder null,
     * wenn er ihn nicht so einsetzen will wie verlangt oder ihm der
     * Mindestanteil zu teuer ist. maxAnteil ist seine Grenze beim Nachfordern.
     */
    static _angebotVon(state, player, interessent) {
        const l = player.leihListe;
        if (this.ROLLEN.indexOf(interessent.rolle) < this.ROLLEN.indexOf(l.einsatz)) return null;
        // Ein Rückholrecht ist dem Leihverein etwas weniger wert
        const eigenes = Math.max(0.3, interessent.lohnAnteil - (l.rueckholrecht ? 0.05 : 0));
        const grenze = Math.min(1, eigenes + 0.1);
        if (grenze + 1e-9 < l.minAnteil) return null;
        const anteil = Math.round(Math.max(eigenes, l.minAnteil) * 20) / 20;
        const club = this._club(state, interessent.clubId);
        const diff = (player.overall || 50) - this.niveau(state, club);
        // Für einen, der sofort spielt, zahlt ein Verein eine Gebühr - für eine halbe Saison die Hälfte
        const gebuehr = interessent.rolle === "Stammspieler" && diff >= 3
            ? Math.round((player.value || 0) * (l.dauer === "winter" ? 0.015 : 0.03) / 10000) * 10000 : 0;
        // Etwa jeder dritte will sich den Kauf offenhalten
        const kaufoption = (player.age || 30) <= 27 && this._hash(`${player.id}|${interessent.clubId}|option`) < 0.33
            ? Math.max(50000, Math.round((player.value || 0) * 1.25 / 50000) * 50000) : null;
        return { lohnAnteil: anteil, maxAnteil: Math.max(anteil, Math.round(grenze * 20) / 20), gebuehr, kaufoption };
    }

    /**
     * Neue Angebote für einen Spieler auf der Leihliste - von Vereinen, bei
     * denen er spielen würde und die nicht schon geboten oder eine Absage
     * bekommen haben. Gibt die neuen zurück.
     */
    static sammleAngebote(state, player, anzahl = 1) {
        const l = player?.leihListe;
        if (!l) return [];
        const liste = this._angebote(state);
        const saison = state.seasonYear || 1;
        const seine = liste.filter(a => String(a.playerId) === String(player.id));
        const offen = seine.filter(a => a.status === "offen" || a.status === "zugesagt");
        if (offen.some(a => a.status === "zugesagt")) return [];
        const schonDa = new Set(seine.filter(a => a.saison === saison).map(a => a.clubId));
        const heute = state.currentDayIndex || 0;
        const neu = [];
        for (const i of this.interessenten(state, player.id, 12)) {
            if (neu.length >= anzahl || offen.length + neu.length >= this.MAX_ANGEBOTE) break;
            if (schonDa.has(i.clubId) || (l.abgelehnt || []).includes(i.clubId)) continue;
            const b = this._angebotVon(state, player, i);
            if (!b) continue;
            const a = Object.assign({
                id: `leih_${saison}_${heute}_${player.id}_${i.clubId}`,
                playerId: player.id, playerName: player.name, playerPos: player.pos,
                clubId: i.clubId, clubName: i.clubName, stufe: i.stufe, rolle: i.rolle,
                dauer: l.dauer, rueckholrecht: l.rueckholrecht,
                eingang: heute, frist: heute + this.ANGEBOTS_FRIST, saison, status: "offen"
            }, b);
            liste.unshift(a);
            neu.push(a);
            this._post(state, i.clubName, `📨 Leihangebot für ${player.name}`,
                `${i.clubName} (Liga ${i.stufe}) möchte ${player.name} ${this.DAUER[l.dauer]} ausleihen - als ${i.rolle}, mit ${Math.round(a.lohnAnteil * 100)} % des Gehalts`
                + (a.gebuehr ? ` und ${this._geld(a.gebuehr)} Leihgebühr` : "")
                + (a.kaufoption ? `, dazu eine Kaufoption für ${this._geld(a.kaufoption)}` : "")
                + `. Das Angebot gilt ${this.ANGEBOTS_FRIST} Tage - annehmen, mehr fordern oder ablehnen im Transfermarkt unter Leihen.`);
        }
        return neu;
    }

    /**
     * Ein Leihangebot annehmen. Dann entscheidet der Spieler - über Nacht,
     * am Deadline Day sofort. Die anderen Vereine warten so lange.
     */
    static leihangebotAnnehmen(state, angebotId) {
        const a = this._angebote(state).find(x => String(x.id) === String(angebotId));
        if (!a || a.status !== "offen") return { success: false, error: "Das Angebot liegt nicht mehr vor." };
        const fenster = this._fenster(state);
        if (fenster) return { success: false, error: fenster };
        const player = this._player(state, a.playerId);
        if (!player || player.clubId !== state.userClubId || player.leihe) return { success: false, error: "Er steht nicht mehr zur Verfügung." };
        if (this.offeneLeihangebote(state, a.playerId).some(x => x.status === "zugesagt")) return { success: false, error: "Er denkt schon über ein anderes Angebot nach." };
        a.status = "zugesagt";
        a.entscheidung = state.currentDayIndex || 0;
        if (this._istDeadlineDay(state)) return this._spielerEntscheidet(state, a);
        return { success: true, angebot: a, wartet: true };
    }

    /**
     * Will er dorthin? Als Stammspieler fast immer - nur einem sehr
     * Ehrgeizigen sind zwei Ligen tiefer zu wenig. Als Ergänzungsspieler
     * sagt der Ehrgeizige eher ab, und je tiefer die Liga, desto eher.
     */
    static spielerWillLeihe(state, player, a) {
        const eigener = this._club(state, state.userClubId);
        const tiefer = Math.max(0, (a.stufe || 1) - (eigener?.level || 1));
        const ehrgeiz = player?.hiddenAttributes?.ambition ?? 12;
        const wurf = this._hash(`${player.id}|${a.clubId}|${a.saison}|ja`);
        if (a.rolle === "Stammspieler") {
            if (tiefer >= 2 && ehrgeiz >= 16 && wurf < 0.5) return { ok: false, grund: `${player.name} will nicht zwei Ligen tiefer spielen - er traut sich mehr zu.` };
            return { ok: true };
        }
        const chance = 0.85 - Math.max(0, ehrgeiz - 12) * 0.08 - tiefer * 0.1;
        if (wurf < chance) return { ok: true };
        return { ok: false, grund: `${player.name} will nicht als Ergänzungsspieler zu ${a.clubName} - er will spielen.` };
    }

    static _spielerEntscheidet(state, a) {
        const player = this._player(state, a.playerId);
        const will = player ? this.spielerWillLeihe(state, player, a) : { ok: false, grund: "Er steht nicht mehr zur Verfügung." };
        if (!will.ok) {
            a.status = "spielerNein";
            if (player?.leihListe) player.leihListe.abgelehnt = [...(player.leihListe.abgelehnt || []), a.clubId];
            this._post(state, "Transferabteilung", `${a.playerName} sagt ${a.clubName} ab`, `${will.grund} Er bleibt auf der Leihliste, die anderen Angebote gelten weiter.`);
            return { success: true, angebot: a, spielerNein: true, grund: will.grund };
        }
        const res = this.verleihen(state, player.id, a.clubId, {
            lohnAnteil: a.lohnAnteil, rolle: a.rolle, gebuehr: a.gebuehr, kaufoption: a.kaufoption, dauer: a.dauer, rueckholrecht: a.rueckholrecht
        });
        if (!res.success) {
            a.status = "geplatzt";
            this._post(state, "Transferabteilung", `Leihe von ${a.playerName} geplatzt`, res.error);
            return { success: false, error: res.error, angebot: a };
        }
        a.status = "perfekt";
        this._angebote(state).filter(x => x !== a && String(x.playerId) === String(a.playerId) && x.status === "offen").forEach(x => { x.status = "erledigt"; });
        return { success: true, angebot: a, perfekt: true };
    }

    /** Ein Leihangebot ablehnen - dieser Verein bietet für ihn nicht noch einmal */
    static leihangebotAblehnen(state, angebotId) {
        const a = this._angebote(state).find(x => String(x.id) === String(angebotId));
        if (!a || a.status !== "offen") return { success: false, error: "Das Angebot liegt nicht mehr vor." };
        a.status = "abgelehnt";
        const player = this._player(state, a.playerId);
        if (player?.leihListe) player.leihListe.abgelehnt = [...(player.leihListe.abgelehnt || []), a.clubId];
        return { success: true, angebot: a };
    }

    /**
     * Mehr Gehalt fordern. Der Verein hat eine Grenze, die er nicht verrät:
     * Darunter geht er mit, knapp darüber bessert er bis zur Grenze nach, weit
     * darüber zieht er zurück. Nachgebessert wird einmal.
     */
    static leihangebotMehrFordern(state, angebotId, anteil) {
        const a = this._angebote(state).find(x => String(x.id) === String(angebotId));
        if (!a || a.status !== "offen") return { status: "fehler", text: "Das Angebot liegt nicht mehr vor." };
        const neu = Math.max(0, Math.min(1, Math.round((Number(anteil) || 0) * 20) / 20));
        if (neu <= a.lohnAnteil + 1e-9) return { status: "fehler", text: "Die Forderung muss über dem Angebot liegen." };
        if (a.nachgebessert) return { status: "fehler", text: `${a.clubName} hat bereits nachgebessert und geht nicht weiter.` };
        a.nachgebessert = true;
        const pct = (x) => `${Math.round(x * 100)} %`;
        if (neu <= a.maxAnteil + 1e-9) {
            a.lohnAnteil = neu;
            return { status: "angenommen", angebot: a, text: `${a.clubName} übernimmt ${pct(neu)} des Gehalts.` };
        }
        if (neu > a.maxAnteil + 0.15 + 1e-9) {
            a.status = "zurueckgezogen";
            return { status: "zurueckgezogen", angebot: a, text: `${a.clubName} zieht das Angebot zurück - so viel Gehalt zahlen sie nicht.` };
        }
        a.lohnAnteil = a.maxAnteil;
        return { status: "nachgebessert", angebot: a, text: `${a.clubName} bessert auf ${pct(a.maxAnteil)} nach - mehr ist nicht drin.` };
    }

    /**
     * Jeden Tag: Für Spieler auf der Leihliste melden sich Vereine (etwa
     * jeden dritten Tag einer), Angebote verfallen nach drei Tagen, wer
     * zugesagt hat, entscheidet sich über Nacht. Schließt das Fenster, ist
     * die Leihliste leer. Zur Winterpause enden Halbjahresleihen, und ein
     * Stammverein mit Rückholrecht holt seinen Spieler, wenn er nicht spielt.
     * Gibt Zeilen für den Tagesbericht zurück.
     */
    static tag(state) {
        const meldungen = [];
        if (!state?.userClubId) return meldungen;
        const heute = state.currentDayIndex || 0;
        const saison = state.seasonYear || 1;
        const fensterZu = !!this._fenster(state);
        const liste = this._angebote(state);
        liste.forEach(a => {
            if ((a.status === "offen" || a.status === "zugesagt") && (fensterZu || a.saison !== saison)) a.status = "verfallen";
        });
        if (fensterZu) {
            const gelistet = (state.players || []).filter(p => p.leihListe);
            gelistet.forEach(p => { p.leihListe = undefined; });
            if (gelistet.some(p => p.clubId === state.userClubId)) meldungen.push("📋 Das Fenster ist zu: Die Leihliste ist leer.");
        } else {
            liste.filter(a => a.status === "zugesagt" && heute >= (a.entscheidung ?? heute)).forEach(a => {
                const r = this._spielerEntscheidet(state, a);
                if (r.perfekt) meldungen.push(`🤝 ${a.playerName} ist an ${a.clubName} verliehen.`);
                else if (r.spielerNein) meldungen.push(`🙅 ${a.playerName} sagt ${a.clubName} ab.`);
            });
            liste.filter(a => a.status === "offen" && heute > a.frist).forEach(a => {
                a.status = "verfallen";
                this._post(state, a.clubName, `Leihangebot für ${a.playerName} verfallen`, `Sie haben auf unser Leihangebot für ${a.playerName} nicht reagiert. Wir sehen uns anderweitig um.`);
            });
            (state.players || []).filter(p => p.leihListe && p.clubId === state.userClubId && !p.leihe).forEach(p => {
                if (this._hash(`${p.id}|${saison}|${heute}|tag`) < 0.35) {
                    this.sammleAngebote(state, p, 1).forEach(a => meldungen.push(`📨 Leihangebot für ${p.name} von ${a.clubName}.`));
                }
            });
        }
        this._winterpause(state, meldungen);
        // Erledigtes nicht ewig mitschleppen
        if (liste.length > 40) {
            state.leihAngebote = liste.filter((a, i) => a.status === "offen" || a.status === "zugesagt" || i < 20);
        }
        return meldungen;
    }

    /** Einmal zum Winterfenster: Halbjahresleihen enden, Rückholrechte greifen */
    static _winterpause(state, meldungen) {
        const te = this._te();
        const info = te && typeof te.fensterInfo === "function" ? te.fensterInfo(state) : null;
        const saison = state.seasonYear || 1;
        if (!info || !info.offen || info.art !== "winter" || state.leihWinter === saison) return;
        state.leihWinter = saison;
        (state.players || []).filter(p => p.leihe && p.leihe.bisWinter && (p.leihe.bisSaison || 0) <= saison).forEach(p => {
            const l = p.leihe;
            const eigen = l.stammvereinId === state.userClubId || l.leihvereinId === state.userClubId;
            const andere = this._club(state, l.stammvereinId === state.userClubId ? l.leihvereinId : l.stammvereinId);
            this._beende(state, p);
            if (eigen) {
                this._post(state, "Leihabteilung", `Halbjahresleihe beendet: ${p.name}`,
                    l.stammvereinId === state.userClubId
                        ? `${p.name} kehrt zur Winterpause von ${andere?.name || "seinem Leihverein"} zurück.`
                        : `${p.name} kehrt zur Winterpause zu ${andere?.name || "seinem Verein"} zurück.`);
                meldungen.push(`↩️ ${p.name}: Halbjahresleihe beendet.`);
            }
        });
        // Wer als Stammspieler zugesagt war und kaum spielt, holt sein Verein zurück
        this.geliehenVon(state, state.userClubId)
            .filter(p => p.leihe.rueckholrecht && p.leihe.rolle === "Stammspieler" && (p.spielpraxis ?? 0.5) < 0.35)
            .forEach(p => {
                const stamm = this._club(state, p.leihe.stammvereinId);
                this._beende(state, p);
                this._post(state, stamm?.name || "Stammverein", `${p.name} wird zurückgeholt`,
                    `Wir haben ${p.name} als Stammspieler verliehen, bei Ihnen spielt er kaum. Wir machen von unserem Rückholrecht Gebrauch.`);
                meldungen.push(`↩️ ${stamm?.name || "Sein Verein"} holt ${p.name} zurück.`);
            });
    }

    // ------------------------------------------------------------ Ausleihen

    /**
     * Der Leihmarkt: Spieler anderer Vereine, die ihr Verein abgibt - junge
     * Spieler ohne Stammplatz und Reservisten. Angeboten wird nur, was den
     * eigenen Kader verstärkt (oder ein Talent ist) - so, wie der eigene
     * Verein die Spieler sieht: Wen er nicht kennt, steht nicht da, und
     * ob einer verstärkt, entscheidet die Einschätzung, nicht die wahre
     * Stärke. Sonst verriet schon die Liste, wer wirklich gut ist.
     */
    static leihmarkt(state, anzahl = 30) {
        const eigener = this._club(state, state.userClubId);
        if (!eigener) return [];
        const eigenesNiveau = this.niveau(state, eigener);
        const eigeneStufe = eigener.level || 1;
        const se = this._resolve("ScoutingEngine", "./scoutingEngine.js");
        const sicht = se && typeof se.sichtbarkeit === "function" ? se.sichtbarkeit(state) : null;
        const re = this._resolve("PlayerRatingEngine", "./playerRatingEngine.js");
        const kontext = { userClubId: state.userClubId, leagueDataCoverage: 85, state };
        const geschaetzt = (p) => re && typeof re.geschaetzteStaerke === "function" ? re.geschaetzteStaerke(p, kontext) : (p.overall || 0);
        const liste = [];
        (state.clubs || []).forEach(c => {
            if (c.id === eigener.id) return;
            const stufe = c.level || 1;
            // Abgegeben wird nach unten und zur Seite: kein Zweitligist leiht
            // seinen besten Mann an den Bundesligisten aus
            if (stufe > eigeneStufe + 1 || stufe < eigeneStufe - 2) return;
            const kader = (c.playerIds || []).map(id => this._player(state, id)).filter(Boolean)
                .sort((a, b) => (b.overall || 0) - (a.overall || 0));
            kader.slice(14).forEach(p => {
                if (p.leihe || p.vorvertrag || (p.injuredWeeks || 0) > 0 || (p.contractYears ?? 1) < 1) return;
                if (sicht && !sicht.istSichtbar(p)) return;
                const talent = (p.age || 30) <= 21 && (p.pot || 0) >= eigenesNiveau + 4;
                const staerke = geschaetzt(p);
                if (staerke < eigenesNiveau - 2 && !talent) return;
                liste.push(Object.assign(this._leihKonditionen(state, p, c, eigenesNiveau), { geschaetzt: staerke }));
            });
        });
        return liste.sort((a, b) => b.geschaetzt - a.geschaetzt).slice(0, anzahl);
    }

    static _leihKonditionen(state, p, stammverein, eigenesNiveau) {
        // Ein Verein, der einen guten Spieler abgibt, will Einsätze sehen und
        // den Großteil des Gehalts loswerden
        const staerke = (p.overall || 50) - eigenesNiveau;
        const lohnAnteil = Math.max(0.5, Math.min(1, 0.7 + staerke * 0.04));
        const gebuehr = staerke > 2 ? Math.round((p.value || 0) * 0.08 / 10000) * 10000 : 0;
        // Kaufoption: Der Stammverein nennt einen festen Preis über dem
        // Marktwert und verlangt für das Recht einen Aufschlag auf die Gebühr
        const kaufoption = Math.max(50000, Math.round((p.value || 0) * 1.15 / 50000) * 50000);
        const optionsAufschlag = Math.max(10000, Math.round((p.value || 0) * 0.05 / 10000) * 10000);
        return {
            kaufoption,
            optionsAufschlag,
            playerId: p.id,
            name: p.name,
            pos: p.pos,
            age: p.age,
            overall: p.overall,
            pot: p.pot,
            clubId: stammverein.id,
            clubName: stammverein.name,
            wage: p.wage || 0,
            lohnAnteil: Math.round(lohnAnteil * 20) / 20,
            gebuehr,
            // Ein Talent, das (noch) schwächer ist als der Kader, soll lernen -
            // Einsätze verlangt sein Verein dann nicht
            rolle: staerke >= 1 ? "Stammspieler" : (staerke >= -3 ? "Rotation" : "Talent")
        };
    }

    static leihHindernis(state, player) {
        if (!player) return "Unbekannter Spieler.";
        const fenster = this._fenster(state);
        if (fenster) return fenster;
        if (player.clubId === state.userClubId) return "Er spielt schon für Sie.";
        if (player.leihe) return "Er ist bereits verliehen.";
        if (this.geliehenVon(state, state.userClubId).length >= this.MAX_GELIEHEN) {
            return `Sie haben schon ${this.MAX_GELIEHEN} Leihspieler im Kader.`;
        }
        const erlaubnis = this._erlaubnis(state, player, this._club(state, state.userClubId));
        if (erlaubnis && !erlaubnis.erteilt) return erlaubnis.text;
        return null;
    }

    /**
     * Einen Spieler ausleihen. angebotenerAnteil: welchen Teil des Gehalts
     * man übernimmt - unter der Forderung des Stammvereins lehnt er ab.
     * Aus der Verhandlung (NegotiationEngine.startLeihVerhandlung) kommen
     * die ausgehandelten Bedingungen in optionen.vereinbart: Gebühr,
     * Einsatzzusage, Kaufoption. Der Spieler muss dann nicht mehr im
     * Leihmarkt stehen - sein Verein hat schon zugesagt.
     */
    static ausleihen(state, playerId, angebotenerAnteil = null, optionen = {}) {
        const player = this._player(state, playerId);
        const hindernis = this.leihHindernis(state, player);
        if (hindernis) return { success: false, error: hindernis };
        const v = optionen.vereinbart || null;
        const eintrag = v
            ? { clubId: v.stammvereinId, clubName: this._club(state, v.stammvereinId)?.name || "", lohnAnteil: angebotenerAnteil ?? 1, gebuehr: v.gebuehr || 0,
                rolle: v.rolle || "Rotation", kaufoption: v.kaufoption || null, optionsAufschlag: v.optionsAufschlag || 0, name: player.name }
            : this.leihmarkt(state, Infinity).find(e => String(e.playerId) === String(playerId));
        if (!eintrag) return { success: false, error: "Sein Verein gibt ihn nicht ab." };
        if (v && player.clubId !== v.stammvereinId) return { success: false, error: "Er spielt nicht mehr für den Verein, mit dem verhandelt wurde." };
        const anteil = angebotenerAnteil === null ? eintrag.lohnAnteil : Math.max(0, Math.min(1, angebotenerAnteil));
        if (anteil + 1e-9 < eintrag.lohnAnteil) {
            return { success: false, error: `${eintrag.clubName} will, dass Sie mindestens ${Math.round(eintrag.lohnAnteil * 100)} % des Gehalts übernehmen.` };
        }
        const eigener = this._club(state, state.userClubId);
        const mitOption = !!optionen.kaufoption && !!eintrag.kaufoption;
        const gebuehr = eintrag.gebuehr + (mitOption ? eintrag.optionsAufschlag : 0);
        if ((eigener.balance || 0) < gebuehr) return { success: false, error: "Für die Leihgebühr reicht das Geld nicht." };
        const stammverein = this._club(state, eintrag.clubId);
        this._belegeAusnahme(state, this._erlaubnis(state, player, eigener), eigener);
        if (gebuehr > 0) {
            eigener.balance -= gebuehr;
            stammverein.balance = (stammverein.balance || 0) + gebuehr;
            const finanzen = this._resolve("FinanceEngine", "./financeEngine.js");
            if (finanzen && typeof finanzen.recordTransaction === "function") {
                const text = `Leihgebühr${mitOption ? " mit Kaufoption" : ""} für ${player.name}`;
                finanzen.recordTransaction(state, eigener.id, "transfer_out", -gebuehr, text);
                finanzen.recordTransaction(state, stammverein.id, "transfer_in", gebuehr, text);
            }
        }
        this._wechsle(state, player, stammverein, eigener);
        player.reserve = undefined;
        player.leihe = {
            stammvereinId: stammverein.id,
            leihvereinId: eigener.id,
            bisSaison: state.seasonYear || 1,
            bisWinter: v && v.dauer === "winter" ? true : undefined,
            // Mit Rückholrecht holt ihn sein Verein im Winter zurück, wenn er nicht spielt
            rueckholrecht: v ? !!v.rueckholrecht : undefined,
            lohnAnteil: anteil,
            rolle: eintrag.rolle,
            seit: this._stempel(state),
            gebuehr,
            kaufoption: mitOption ? eintrag.kaufoption : null,
            startSpiele: player.stats?.matches || 0,
            startTore: player.stats?.goals || 0,
            startNoten: player.stats?.ratingSum || 0
        };
        player.morale = Math.min(99, (player.morale ?? 75) + 5);
        this._post(state, "Transferabteilung", `${player.name} ausgeliehen`,
            `${player.name} spielt ${this.DAUER[player.leihe.bisWinter ? "winter" : "saison"]} für Sie. Sie übernehmen ${Math.round(anteil * 100)} % seines Gehalts`
            + (gebuehr ? `, die Leihgebühr beträgt ${this._geld(gebuehr)}` : "")
            + `. ${stammverein.name} erwartet, dass er als ${eintrag.rolle} spielt.`
            + (mitOption ? ` Sie können ihn bis zum Saisonende für ${this._geld(eintrag.kaufoption)} fest verpflichten.` : ""));
        return { success: true, eintrag, gebuehr };
    }

    /**
     * Die Kaufoption ziehen: Der Leihspieler wird zum vereinbarten Preis
     * fest verpflichtet. Der Stammverein kann nicht ablehnen.
     */
    static zieheKaufoption(state, playerId, kaeuferId = null) {
        const player = this._player(state, playerId);
        if (!player || !player.leihe) return { success: false, error: "Er ist nicht ausgeliehen." };
        const l = player.leihe;
        const kaeufer = this._club(state, kaeuferId || l.leihvereinId);
        if (!l.kaufoption || !kaeufer || kaeufer.id !== l.leihvereinId) return { success: false, error: "Es gibt keine Kaufoption." };
        if (kaeufer.id === state.userClubId) {
            const fenster = this._fenster(state);
            if (fenster) return { success: false, error: fenster };
        }
        if ((kaeufer.balance || 0) < l.kaufoption) return { success: false, error: `Die Option kostet ${this._geld(l.kaufoption)} - so viel Geld ist nicht da.` };
        const transfer = this._resolve("TransferEngine", "./transferEngine.js");
        if (!transfer || typeof transfer.executeTransfer !== "function") return { success: false, error: "Transfer nicht möglich." };
        const preis = l.kaufoption;
        // Zurück zum Stammverein, dann regulär verkaufen
        this._beende(state, player);
        // Die Arbeitserlaubnis hat er seit der Leihe
        const ok = transfer.executeTransfer(state, player.id, kaeufer.id, preis, player.wage || 0, 3, { erlaubnis: true });
        if (!ok) return { success: false, error: "Der Wechsel ist gescheitert." };
        if (kaeufer.id === state.userClubId) {
            this._post(state, "Transferabteilung", `Kaufoption gezogen: ${player.name}`,
                `${player.name} gehört jetzt fest zum Kader. Ablöse: ${this._geld(preis)}, Vertrag über drei Jahre zu den bisherigen Bezügen.`);
        }
        return { success: true, preis };
    }

    // ------------------------------------------------------- KI-Vereine

    /**
     * Die KI verleiht ebenfalls: Ein junger Spieler ohne Einsätze geht für
     * eine Saison zu einem Verein derselben Liga oder bis zwei Ligen tiefer,
     * bei dem er spielen würde. Ohne das stagnierten die Talente der
     * KI-Vereine, seit Spielpraxis für die Entwicklung zählt.
     * Gibt die Zahl der neuen Leihen zurück.
     */
    static kiLeihen(state, anzahl = 25, zufall = Math.random) {
        const idx = this._index(state);
        const vereine = (state.clubs || []).filter(c => c.id !== state.userClubId);
        if (!vereine.length) return 0;
        const niveauCache = new Map();
        const niveau = (c) => {
            if (!niveauCache.has(c.id)) niveauCache.set(c.id, this.niveau(state, c));
            return niveauCache.get(c.id);
        };
        const nachStufe = new Map();
        vereine.forEach(c => {
            const k = c.level || 1;
            if (!nachStufe.has(k)) nachStufe.set(k, []);
            nachStufe.get(k).push(c);
        });
        const weg = new Map(), da = new Map();
        (state.players || []).forEach(p => {
            if (!p.leihe) return;
            weg.set(p.leihe.stammvereinId, (weg.get(p.leihe.stammvereinId) || 0) + 1);
            da.set(p.leihe.leihvereinId, (da.get(p.leihe.leihvereinId) || 0) + 1);
        });

        let erledigt = 0;
        for (let i = 0; i < anzahl * 4 && erledigt < anzahl; i++) {
            const stamm = vereine[Math.floor(zufall() * vereine.length)];
            if ((weg.get(stamm.id) || 0) >= 3) continue;
            const kader = (stamm.playerIds || []).map(id => idx.get(String(id))).filter(Boolean)
                .sort((a, b) => (b.overall || 0) - (a.overall || 0));
            if (kader.length <= 19) continue;
            // Verliehen wird nur, wer überzählig ist (KaderplanungEngine.
            // bedarfsAnalyse). Vorher ging jeder junge Ersatzmann ab Platz 14:
            // Weil die Kader genau auf ihrem Plan stehen, riss gemessen fast
            // jede KI-Leihe (98 %) eine Lücke in ihrem Mannschaftsteil, die der
            // Transfermarkt danach wieder füllen musste.
            const planung = this._resolve("KaderplanungEngine", "./kaderplanungEngine.js");
            const frei = planung ? new Set(planung.bedarfsAnalyse(state, stamm, kader).loanCandidates.map(x => x.id)) : null;
            const kandidaten = kader.slice(13).filter(p => (!frei || frei.has(p.id)) && (p.age || 30) <= 22 && !p.leihe && !p.vorvertrag
                && (p.injuredWeeks || 0) === 0 && (p.contractYears ?? 1) >= 1
                && (typeof p.spielpraxis !== "number" || p.spielpraxis < 0.4));
            if (!kandidaten.length) continue;
            const p = kandidaten[Math.floor(zufall() * kandidaten.length)];
            const stufe = stamm.level || 1;
            const ziele = [stufe, stufe + 1, stufe + 2]
                .flatMap(k => nachStufe.get(k) || [])
                .filter(c => c.id !== stamm.id && (da.get(c.id) || 0) < 2
                    && (c.playerIds || []).length < 28
                    && (p.overall || 0) - niveau(c) >= -3);
            if (!ziele.length) continue;
            const ziel = ziele[Math.floor(zufall() * ziele.length)];
            // Nach England nur mit Arbeitserlaubnis
            const erlaubnis = this._erlaubnis(state, p, ziel);
            if (erlaubnis && !erlaubnis.erteilt) continue;
            this._belegeAusnahme(state, erlaubnis, ziel);
            const diff = (p.overall || 0) - niveau(ziel);
            this._wechsle(state, p, stamm, ziel);
            p.reserve = undefined;
            p.leihe = {
                stammvereinId: stamm.id,
                leihvereinId: ziel.id,
                bisSaison: state.seasonYear || 1,
                lohnAnteil: Math.round(Math.max(0.3, Math.min(1, 0.55 + diff * 0.05)) * 20) / 20,
                rolle: diff >= 1 ? "Stammspieler" : "Rotation",
                // Jede dritte KI-Leihe kommt mit Kaufoption
                kaufoption: zufall() < 0.33 ? Math.max(50000, Math.round((p.value || 0) * 1.15 / 50000) * 50000) : null,
                seit: this._stempel(state),
                startSpiele: p.stats?.matches || 0,
                startTore: p.stats?.goals || 0,
                startNoten: p.stats?.ratingSum || 0
            };
            weg.set(stamm.id, (weg.get(stamm.id) || 0) + 1);
            da.set(ziel.id, (da.get(ziel.id) || 0) + 1);
            erledigt++;
        }
        return erledigt;
    }

    // ---------------------------------------------------- Laufender Betrieb

    /**
     * Einmal im Monat: ein Leihbericht über die eigenen verliehenen Spieler,
     * und der Stammverein eines Leihspielers meldet sich, wenn er nicht spielt.
     */
    static monatlich(state) {
        const meldungen = [];
        const verliehen = this.verlieheneVon(state, state.userClubId);
        if (verliehen.length) {
            const zeilen = verliehen.map(p => {
                const l = p.leihe;
                const spiele = (p.stats?.matches || 0) - (l.startSpiele || 0);
                const noten = (p.stats?.ratingSum || 0) - (l.startNoten || 0);
                const tore = (p.stats?.goals || 0) - (l.startTore || 0);
                const verein = this._club(state, l.leihvereinId);
                return `• ${p.name} (${verein?.name || "?"}): ${spiele} Spiele, ${tore} Tore`
                    + (spiele ? `, Note ${(noten / spiele).toFixed(2).replace(".", ",")}` : "")
                    + `, Spielpraxis ${Math.round((p.spielpraxis ?? 0.5) * 100)} %`;
            });
            this._post(state, "Leihabteilung", "Leihbericht", `So läuft es bei unseren verliehenen Spielern:\n${zeilen.join("\n")}`);
            meldungen.push(`📋 Leihbericht über ${verliehen.length} verliehene Spieler im Postfach.`);
        }
        this.geliehenVon(state, state.userClubId).forEach(p => {
            if ((p.spielpraxis ?? 0.5) < 0.3 && p.leihe.rolle === "Stammspieler") {
                const stammverein = this._club(state, p.leihe.stammvereinId);
                this._post(state, stammverein?.name || "Stammverein", `Einsätze für ${p.name}`,
                    `Wir haben ${p.name} nicht verliehen, damit er auf der Bank sitzt. Wir erwarten, dass er spielt.`);
                p.morale = Math.max(25, (p.morale ?? 75) - 4);
                meldungen.push(`📞 ${stammverein?.name || "Ein Stammverein"} beschwert sich: ${p.name} spielt zu wenig.`);
            }
        });
        return meldungen;
    }

    /** Zum Saisonende kehren alle Leihspieler zurück */
    static saisonende(state) {
        const zurueck = [];
        // Erst entscheiden die KI-Leihvereine über ihre Kaufoptionen: Wer
        // regelmäßig gespielt hat und den Kader verstärkt, wird gekauft
        (state?.players || []).filter(p => p.leihe && p.leihe.kaufoption && p.leihe.leihvereinId !== state.userClubId).forEach(p => {
            const leihverein = this._club(state, p.leihe.leihvereinId);
            if (!leihverein) return;
            const spielte = typeof p.spielpraxis === "number" && p.spielpraxis >= 0.5;
            const passt = (p.overall || 0) >= this.niveau(state, leihverein) - 1;
            if (spielte && passt && (leihverein.balance || 0) > p.leihe.kaufoption * 1.5) {
                this.zieheKaufoption(state, p.id, leihverein.id);
            }
        });
        (state?.players || []).forEach(p => {
            if (!p.leihe) return;
            if ((p.leihe.bisSaison || 0) > (state.seasonYear || 1)) return;
            const l = p.leihe;
            const spiele = (p.stats?.matches || 0) - (l.startSpiele || 0);
            this._beende(state, p);
            zurueck.push({ player: p, spiele, stammvereinId: l.stammvereinId });
        });
        const eigene = zurueck.filter(z => z.stammvereinId === state.userClubId);
        if (eigene.length) {
            this._post(state, "Leihabteilung", "Leihspieler zurück",
                `Diese Spieler kehren von ihren Leihen zurück:\n${eigene.map(z => `• ${z.player.name}: ${z.spiele} Spiele`).join("\n")}`);
        }
        return zurueck;
    }

    // ---------------------------------------------------------------- Intern

    static _beende(state, player) {
        const l = player.leihe;
        const leihverein = this._club(state, l.leihvereinId);
        const stammverein = this._club(state, l.stammvereinId);
        player.leihe = undefined;
        if (stammverein) this._wechsle(state, player, leihverein, stammverein);
    }

    /** Den Spieler von einem Kader in den anderen schieben, Aufstellung reparieren */
    static _wechsle(state, player, von, zu) {
        const gs = this._resolve("GameState", "./gameState.js");
        if (von) {
            von.playerIds = (von.playerIds || []).filter(id => id !== player.id);
            von.bench = (von.bench || []).filter(id => id !== player.id);
            if ((von.lineup || []).includes(player.id)) {
                von.lineup = von.lineup.filter(id => id !== player.id);
                if (gs && typeof gs.repairLineup === "function") gs.repairLineup(von, state.players);
            }
        }
        if (zu) {
            if (!(zu.playerIds || []).includes(player.id)) zu.playerIds = [...(zu.playerIds || []), player.id];
            if (!Array.isArray(zu.bench)) zu.bench = [];
            if (zu.bench.length < 7 && !zu.bench.includes(player.id) && !(zu.lineup || []).includes(player.id)) zu.bench.push(player.id);
            // Die Spiele bis hierher gehören dem bisherigen Verein (LaufbahnEngine)
            const laufbahn = this._resolve("LaufbahnEngine", "./laufbahnEngine.js");
            if (laufbahn && player.clubId && player.clubId !== zu.id) laufbahn.wechsel(state, player, player.clubId);
            player.clubId = zu.id;
        }
        player.transferListed = false;
    }

    static _post(state, absender, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: state.currentDate || `Spieltag ${state.currentMatchday || 1}`,
            sender: absender,
            subject: betreff,
            body: text,
            read: false,
            type: "transfer"
        });
    }
}

if (typeof window !== "undefined") {
    window.LoanEngine = LoanEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { LoanEngine };
}
