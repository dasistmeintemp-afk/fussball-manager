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
 * Saisonende zurück. Das Gehalt teilen sich beide Vereine nach dem Anteil.
 */

class LoanEngine {
    /** Höchstens so viele eigene Spieler gleichzeitig verliehen */
    static MAX_VERLIEHEN = 6;
    /** Höchstens so viele Leihspieler im eigenen Kader */
    static MAX_GELIEHEN = 4;

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

    static verleihHindernis(state, player) {
        if (!player || player.clubId !== state.userClubId) return "Nur Spieler des eigenen Vereins.";
        const fenster = this._fenster(state);
        if (fenster) return fenster;
        if (player.leihe) return "Er ist bereits verliehen.";
        if ((player.injuredWeeks || 0) > 0) return "Er ist verletzt.";
        if ((player.contractYears ?? 1) < 1) return "Sein Vertrag läuft aus.";
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

    static verleihen(state, playerId, clubId) {
        const player = this._player(state, playerId);
        const hindernis = this.verleihHindernis(state, player);
        if (hindernis) return { success: false, error: hindernis };
        const angebot = this.interessenten(state, playerId, 50).find(a => a.clubId === clubId);
        if (!angebot) return { success: false, error: "Dieser Verein will ihn nicht ausleihen." };
        this._wechsle(state, player, this._club(state, state.userClubId), this._club(state, clubId));
        delete player.reserve;
        player.leihe = {
            stammvereinId: state.userClubId,
            leihvereinId: clubId,
            bisSaison: state.seasonYear || 1,
            lohnAnteil: angebot.lohnAnteil,
            rolle: angebot.rolle,
            seit: this._stempel(state),
            startSpiele: player.stats?.matches || 0,
            startTore: player.stats?.goals || 0,
            startNoten: player.stats?.ratingSum || 0
        };
        // Wer gehen darf, um zu spielen, freut sich
        player.morale = Math.min(99, (player.morale ?? 75) + 6);
        delete player.versprechen;
        delete player.mentorId;
        this._post(state, "Transferabteilung", `${player.name} verliehen`,
            `${player.name} spielt bis zum Saisonende bei ${angebot.clubName} (${angebot.rolle}). `
            + `${angebot.clubName} übernimmt ${Math.round(angebot.lohnAnteil * 100)} % seines Gehalts.`);
        return { success: true, angebot };
    }

    /** Einen verliehenen Spieler vorzeitig zurückholen */
    static zurueckholen(state, playerId) {
        const player = this._player(state, playerId);
        if (!player?.leihe || player.leihe.stammvereinId !== state.userClubId) {
            return { success: false, error: "Er ist nicht von Ihnen verliehen." };
        }
        const fenster = this._fenster(state);
        if (fenster) return { success: false, error: `Zurückholen geht nur im Transferfenster. ${fenster}` };
        const leihverein = this._club(state, player.leihe.leihvereinId);
        this._beende(state, player);
        this._post(state, "Transferabteilung", `${player.name} zurückgeholt`,
            `${player.name} kehrt vorzeitig von ${leihverein?.name || "seinem Leihverein"} zurück.`);
        return { success: true };
    }

    // ------------------------------------------------------------ Ausleihen

    /**
     * Der Leihmarkt: Spieler anderer Vereine, die ihr Verein abgibt - junge
     * Spieler ohne Stammplatz und Reservisten. Angeboten wird nur, was den
     * eigenen Kader verstärkt (oder ein Talent ist).
     */
    static leihmarkt(state, anzahl = 30) {
        const eigener = this._club(state, state.userClubId);
        if (!eigener) return [];
        const eigenesNiveau = this.niveau(state, eigener);
        const eigeneStufe = eigener.level || 1;
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
                if (p.leihe || (p.injuredWeeks || 0) > 0 || (p.contractYears ?? 1) < 1) return;
                const talent = (p.age || 30) <= 21 && (p.pot || 0) >= eigenesNiveau + 4;
                if ((p.overall || 0) < eigenesNiveau - 2 && !talent) return;
                liste.push(this._leihKonditionen(state, p, c, eigenesNiveau));
            });
        });
        return liste.sort((a, b) => b.overall - a.overall).slice(0, anzahl);
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
        return null;
    }

    /**
     * Einen Spieler ausleihen. angebotenerAnteil: welchen Teil des Gehalts
     * man übernimmt - unter der Forderung des Stammvereins lehnt er ab.
     */
    static ausleihen(state, playerId, angebotenerAnteil = null, optionen = {}) {
        const player = this._player(state, playerId);
        const hindernis = this.leihHindernis(state, player);
        if (hindernis) return { success: false, error: hindernis };
        const eintrag = this.leihmarkt(state, 500).find(e => String(e.playerId) === String(playerId));
        if (!eintrag) return { success: false, error: "Sein Verein gibt ihn nicht ab." };
        const anteil = angebotenerAnteil === null ? eintrag.lohnAnteil : Math.max(0, Math.min(1, angebotenerAnteil));
        if (anteil + 1e-9 < eintrag.lohnAnteil) {
            return { success: false, error: `${eintrag.clubName} will, dass Sie mindestens ${Math.round(eintrag.lohnAnteil * 100)} % des Gehalts übernehmen.` };
        }
        const eigener = this._club(state, state.userClubId);
        const mitOption = !!optionen.kaufoption;
        const gebuehr = eintrag.gebuehr + (mitOption ? eintrag.optionsAufschlag : 0);
        if ((eigener.balance || 0) < gebuehr) return { success: false, error: "Für die Leihgebühr reicht das Geld nicht." };
        const stammverein = this._club(state, eintrag.clubId);
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
        delete player.reserve;
        player.leihe = {
            stammvereinId: stammverein.id,
            leihvereinId: eigener.id,
            bisSaison: state.seasonYear || 1,
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
            `${player.name} spielt bis zum Saisonende für Sie. Sie übernehmen ${Math.round(anteil * 100)} % seines Gehalts`
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
        const ok = transfer.executeTransfer(state, player.id, kaeufer.id, preis, player.wage || 0, 3);
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
            const kandidaten = kader.slice(13).filter(p => (p.age || 30) <= 22 && !p.leihe
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
            const diff = (p.overall || 0) - niveau(ziel);
            this._wechsle(state, p, stamm, ziel);
            delete p.reserve;
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
        delete player.leihe;
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
            player.clubId = zu.id;
        }
        player.transferListed = false;
    }

    static _post(state, absender, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: `Spieltag ${state.currentMatchday || 1}`,
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
