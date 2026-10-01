/**
 * PlayerTalkEngine - Einzelgespräche mit Spielern
 *
 * Bisher gab es mit einem Spieler genau ein Gespräch: das über den Vertrag.
 * Wer unzufrieden war, "bat um ein Gespräch" - und die Zufriedenheit stieg
 * von selbst um vier Punkte, ohne dass der Manager etwas sagen konnte.
 *
 * Jetzt führt der Manager die Gespräche selbst: loben, kritisieren, um
 * Geduld bitten oder Spielzeit versprechen. Wie ein Spieler reagiert, hängt
 * an seiner Form und an seiner Persönlichkeit - der Profi nimmt Kritik als
 * Ansporn, der Hitzkopf ist beleidigt, und Lob für ein schwaches Spiel
 * durchschaut der Ehrgeizige. Ein Versprechen wird über die nächsten Spiele
 * abgerechnet; wer es bricht, riskiert einen Wechselwunsch.
 */

class PlayerTalkEngine {
    /** Tage zwischen zwei Gesprächen mit demselben Spieler */
    static ABKUEHLUNG = 6;
    /** Wie viele Spielzeit-Versprechen gleichzeitig offen sein dürfen */
    static MAX_VERSPRECHEN = 4;
    /** Ein Spielzeit-Versprechen: so viele Ligaspiele, so viele Einsätze ab 60 Minuten */
    static VERSPRECHEN_SPIELE = 5;
    static VERSPRECHEN_EINSAETZE = 3;
    /** Ein unbeantworteter Gesprächswunsch verfällt nach so vielen Tagen */
    static WUNSCH_FRIST = 7;
    /** So viele Tage tiefe Unzufriedenheit, bis ein Spieler weg will */
    static FRUST_TAGE = 21;

    /** Fortlaufender Tag über die Saisons hinweg */
    static stempel(state) {
        return (state?.seasonYear || state?.season || 1) * 1000 + (state?.currentDayIndex || 0);
    }

    static persoenlichkeit(p) {
        const h = p?.hiddenAttributes || {};
        return {
            profi: h.professionalism ?? 12,
            ehrgeiz: h.ambition ?? 12,
            temperament: h.temperament ?? 12,
            loyal: h.loyalty ?? 12
        };
    }

    /** Wie er gerade spielt - aus der laufenden Form (gleitender Notenschnitt) */
    static formLage(p) {
        const f = p?.form ?? 7;
        if (f >= 7.2) return "stark";
        if (f <= 6.45) return "schwach";
        return "normal";
    }

    static begrenze(wert, min, max) {
        return Math.max(min, Math.min(max, wert));
    }

    static aendereMoral(p, delta) {
        p.morale = this.begrenze((p.morale ?? 75) + delta, 25, 99);
    }

    static aendereZufriedenheit(p, feld, delta) {
        if (!p.happiness) p.happiness = { overall: 75, playingTime: 75, contract: 75, teamPerformance: 75 };
        p.happiness[feld] = this.begrenze((p.happiness[feld] ?? 75) + delta, 5, 100);
        p.happiness.overall = Math.round(
            (p.happiness.teamPerformance ?? 75) * 0.35
            + (p.happiness.playingTime ?? 75) * 0.35
            + (p.happiness.contract ?? 75) * 0.3);
    }

    static eigenerSpieler(state, playerId) {
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!club) return null;
        const p = (state.players || []).find(q => String(q.id) === String(playerId));
        if (!p || !club.playerIds.some(id => String(id) === String(p.id))) return null;
        return p;
    }

    static offeneVersprechen(state) {
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!club) return [];
        const ids = new Set(club.playerIds.map(String));
        return (state.players || []).filter(p => ids.has(String(p.id)) && p.versprechen);
    }

    /**
     * Was der Manager mit diesem Spieler besprechen kann. Jede Option sagt,
     * ob sie gerade möglich ist - und wenn nicht, warum.
     */
    static optionen(state, player) {
        if (!player || !this.eigenerSpieler(state, player.id)) return [];
        const heute = this.stempel(state);
        const letztes = player.gespraech?.letztes;
        const wartenNoch = typeof letztes === "number" ? this.ABKUEHLUNG - (heute - letztes) : 0;
        const gesperrt = wartenNoch > 0 ? `Sie haben gerade erst mit ihm gesprochen (wieder in ${wartenNoch} Tag${wartenNoch === 1 ? "" : "en"}).` : null;
        const form = this.formLage(player);
        const spielzeit = player.happiness?.playingTime ?? 75;
        const optionen = [];
        const neu = (key, label, text, grund = null) => optionen.push({ key, label, text, verfuegbar: !grund && !gesperrt, grund: grund || gesperrt });

        if (player.wechselwunsch && !player.wechselwunsch.akzeptiert) {
            neu("wechsel_annehmen", "Wechselwunsch akzeptieren",
                "Er kommt auf die Transferliste. Das beruhigt ihn - Angebote gehen dann direkt an Sie.");
            neu("wechsel_umstimmen", "Ihn umstimmen",
                "Sie erklären, dass Sie mit ihm planen. Ein treuer Spieler lässt sich eher überzeugen.");
        }
        neu("loben", "Leistungen loben",
            form === "stark" ? "Er spielt stark - Lob kommt jetzt gut an."
                : form === "schwach" ? "Er spielt schwach - ein ehrgeiziger Spieler durchschaut das." : "Er spielt ordentlich.");
        neu("kritisieren", "Leistungen kritisieren",
            form === "schwach" ? "Er spielt schwach. Ein Profi nimmt das als Ansporn, ein Hitzkopf ist beleidigt."
                : "Er spielt gut - Kritik wäre jetzt unfair.");
        const offen = this.offeneVersprechen(state).length;
        neu("spielzeit", "Mehr Spielzeit versprechen",
            `Er bekommt in den nächsten ${this.VERSPRECHEN_SPIELE} Ligaspielen mindestens ${this.VERSPRECHEN_EINSAETZE} Einsätze ab 60 Minuten. Halten Sie Wort, wächst sein Vertrauen - sonst will er weg.`,
            player.versprechen ? "Er hat Ihr Versprechen schon."
                : offen >= this.MAX_VERSPRECHEN ? `Sie haben schon ${offen} Spielern Spielzeit versprochen.`
                    : spielzeit >= 80 ? "Er ist mit seiner Spielzeit zufrieden." : null);
        neu("geduld", "Um Geduld bitten",
            "Seine Chance kommt. Ein loyaler, professioneller Spieler wartet - ein ehrgeiziger nicht lange.",
            spielzeit >= 80 ? "Er ist mit seiner Spielzeit zufrieden." : null);
        return optionen;
    }

    /**
     * Ein Gespräch führen. Gibt die Antwort des Spielers zurück und was sie
     * bewirkt hat; zufall ist für Tests austauschbar.
     */
    static fuehren(state, playerId, key, zufall = Math.random) {
        const player = this.eigenerSpieler(state, playerId);
        if (!player) return { success: false, error: "Nur mit Spielern des eigenen Vereins." };
        const option = this.optionen(state, player).find(o => o.key === key);
        if (!option) return { success: false, error: "Dieses Gespräch gibt es nicht." };
        if (!option.verfuegbar) return { success: false, error: option.grund };

        const p = this.persoenlichkeit(player);
        const form = this.formLage(player);
        const moralVorher = player.morale ?? 75;
        const heute = this.stempel(state);
        let antwort;
        let stimmung = "neutral";

        switch (key) {
        case "loben": {
            if (form === "stark") {
                this.aendereMoral(player, 6 + p.profi * 0.15);
                antwort = "Danke, Trainer. Genau so will ich weitermachen.";
                stimmung = "gut";
            } else if (form === "normal") {
                this.aendereMoral(player, 3);
                antwort = "Das tut gut zu hören.";
                stimmung = "gut";
            } else if (p.ehrgeiz + p.profi >= 28) {
                this.aendereMoral(player, -2);
                antwort = "Ich weiß selbst, dass ich gerade nicht gut spiele. Das brauchen Sie mir nicht schönzureden.";
                stimmung = "schlecht";
            } else {
                this.aendereMoral(player, 3);
                antwort = "Danke für das Vertrauen, ich zahle es zurück.";
                stimmung = "gut";
            }
            break;
        }
        case "kritisieren": {
            if (form === "schwach") {
                // Ob Kritik anspornt oder kränkt, entscheidet der Charakter
                const ansporn = p.profi * 0.5 + p.ehrgeiz * 0.3 - p.temperament * 0.35 + (zufall() - 0.5) * 4;
                if (ansporn >= 6.5) {
                    this.aendereMoral(player, -2);
                    player.ansporn = { bis: heute + 14 };
                    player.form = Math.min(10, (player.form ?? 6.4) + 0.2);
                    antwort = "Sie haben recht. Ich hänge mich rein - Sie werden es im Training sehen.";
                    stimmung = "gut";
                } else {
                    this.aendereMoral(player, -10);
                    this.aendereZufriedenheit(player, "teamPerformance", -6);
                    antwort = "Ich finde, Sie machen es sich zu einfach. Die ganze Mannschaft spielt schlecht.";
                    stimmung = "schlecht";
                }
            } else {
                this.aendereMoral(player, form === "stark" ? -12 : -6);
                this.aendereZufriedenheit(player, "teamPerformance", form === "stark" ? -8 : -4);
                antwort = form === "stark"
                    ? "Das ist unfair. Ich gehöre zu den Besten in der Mannschaft."
                    : "Ich verstehe die Kritik nicht.";
                stimmung = "schlecht";
            }
            break;
        }
        case "spielzeit": {
            this.aendereMoral(player, 8);
            this.aendereZufriedenheit(player, "playingTime", 12);
            player.versprechen = {
                art: "spielzeit",
                seit: heute,
                spiele: 0,
                einsaetze: 0,
                frist: this.VERSPRECHEN_SPIELE,
                noetig: this.VERSPRECHEN_EINSAETZE
            };
            antwort = "Ich nehme Sie beim Wort, Trainer.";
            stimmung = "gut";
            break;
        }
        case "geduld": {
            const wartet = p.loyal * 0.45 + p.profi * 0.35 - p.ehrgeiz * 0.3 + (zufall() - 0.5) * 3;
            if (wartet >= 5.5) {
                this.aendereMoral(player, 3);
                this.aendereZufriedenheit(player, "playingTime", 6);
                antwort = "Gut, ich gebe Ihnen Zeit. Aber ich will spielen.";
                stimmung = "gut";
            } else {
                this.aendereMoral(player, -3);
                this.aendereZufriedenheit(player, "playingTime", -4);
                antwort = "Geduld? Ich warte schon lange genug.";
                stimmung = "schlecht";
            }
            break;
        }
        case "wechsel_annehmen": {
            player.wechselwunsch.akzeptiert = true;
            player.transferListed = true;
            this.aendereMoral(player, 10);
            antwort = "Danke, dass Sie mir keine Steine in den Weg legen. Bis dahin gebe ich alles.";
            stimmung = "gut";
            break;
        }
        case "wechsel_umstimmen": {
            const chance = this.begrenze(0.15 + p.loyal * 0.025 + (player.vertrauen ?? 50) / 400 - p.ehrgeiz * 0.01, 0.05, 0.75);
            if (zufall() < chance) {
                delete player.wechselwunsch;
                player.unmutTage = 0;
                this.aendereMoral(player, 6);
                this.aendereZufriedenheit(player, "playingTime", 10);
                antwort = "Na gut. Wenn Sie wirklich mit mir planen, bleibe ich.";
                stimmung = "gut";
            } else {
                this.aendereMoral(player, -8);
                antwort = "Mein Entschluss steht. Ich will den Verein verlassen.";
                stimmung = "schlecht";
            }
            break;
        }
        default:
            return { success: false, error: "Unbekanntes Gespräch." };
        }

        // Wer um ein Gespräch gebeten hat, ist damit bedient
        if (player.gespraechswunsch) delete player.gespraechswunsch;
        player.gespraech = { letztes: heute, thema: key, stimmung };

        return {
            success: true,
            antwort,
            stimmung,
            moralVorher: Math.round(moralVorher),
            moralNachher: Math.round(player.morale),
            player
        };
    }

    /**
     * Nach jedem eigenen Ligaspiel: Versprechen abrechnen. Ein Einsatz zählt
     * ab 60 Minuten.
     */
    static nachSpiel(state, match) {
        if (!state || !match || !match.played) return [];
        const minuten = new Map((match.playerRatings || []).map(r => [String(r.playerId), r.minutes || 0]));
        const ergebnisse = [];
        this.offeneVersprechen(state).forEach(p => {
            const v = p.versprechen;
            v.spiele++;
            if ((minuten.get(String(p.id)) || 0) >= 60) v.einsaetze++;
            if (v.einsaetze >= v.noetig) {
                delete p.versprechen;
                p.vertrauen = this.begrenze((p.vertrauen ?? 50) + 20, 0, 100);
                this.aendereMoral(p, 6);
                this.aendereZufriedenheit(p, "playingTime", 8);
                ergebnisse.push({ player: p, gehalten: true });
                this.post(state, p, `${p.name}: Versprechen gehalten`,
                    `${p.name} hat die versprochenen Einsätze bekommen. Er vertraut Ihnen - das merkt man im Training.`);
            } else if (v.spiele >= v.frist) {
                delete p.versprechen;
                p.vertrauen = this.begrenze((p.vertrauen ?? 50) - 30, 0, 100);
                this.aendereMoral(p, -15);
                this.aendereZufriedenheit(p, "playingTime", -20);
                ergebnisse.push({ player: p, gehalten: false });
                this.post(state, p, `${p.name}: Versprechen gebrochen`,
                    `${p.name} hat in ${v.frist} Spielen nur ${v.einsaetze} Mal länger gespielt. Er fühlt sich belogen.`);
                // Ein gebrochenes Wort ist der schnellste Weg zum Wechselwunsch
                if (!p.wechselwunsch && (p.vertrauen ?? 50) < 35) this.wechselwunschAeussern(state, p, "Sie haben Ihr Wort gebrochen.");
            }
        });
        return ergebnisse;
    }

    /** Täglich: Gesprächswünsche, ihre Frist und anhaltender Frust */
    static taeglich(state, zufall = Math.random) {
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!club) return [];
        const heute = this.stempel(state);
        const ids = new Set(club.playerIds.map(String));
        const kader = (state.players || []).filter(p => ids.has(String(p.id)));
        const meldungen = [];

        kader.forEach(p => {
            const zufrieden = p.happiness?.overall ?? 75;

            // Ein Gesprächswunsch, auf den niemand eingeht, kränkt
            if (p.gespraechswunsch && heute - p.gespraechswunsch.seit > this.WUNSCH_FRIST) {
                delete p.gespraechswunsch;
                this.aendereMoral(p, -5);
                this.aendereZufriedenheit(p, "playingTime", -4);
                meldungen.push(`😤 ${p.name} fühlt sich übergangen - um sein Gespräch hat sich niemand gekümmert.`);
            }

            // Anhaltender tiefer Frust wird zum Wechselwunsch
            p.unmutTage = zufrieden < 45 ? (p.unmutTage || 0) + 1 : Math.max(0, (p.unmutTage || 0) - 2);
            if (!p.wechselwunsch && p.unmutTage >= this.FRUST_TAGE && (p.injuredWeeks || 0) === 0) {
                this.wechselwunschAeussern(state, p, "Ich bin hier nicht mehr glücklich.");
                meldungen.push(`📢 ${p.name} will den Verein verlassen.`);
            }
        });

        // Höchstens ein neuer Gesprächswunsch am Tag - von dem, den es am
        // meisten drückt
        const kandidaten = kader.filter(p => !p.gespraechswunsch && !p.wechselwunsch
            && (p.happiness?.overall ?? 75) < 58 && (p.injuredWeeks || 0) <= 0
            && !(typeof p.gespraech?.letztes === "number" && heute - p.gespraech.letztes < 10));
        if (kandidaten.length && zufall() < 0.16) {
            const p = kandidaten.sort((a, b) => (a.happiness?.overall ?? 75) - (b.happiness?.overall ?? 75))[0];
            p.gespraechswunsch = { seit: heute, grund: (p.happiness?.playingTime ?? 75) < 60 ? "spielzeit" : "stimmung" };
            meldungen.push(`💬 ${p.name} hat um ein Gespräch gebeten - er ist mit seiner ${p.gespraechswunsch.grund === "spielzeit" ? "Spielzeit" : "Situation"} unzufrieden.`);
        }
        return meldungen;
    }

    static wechselwunschAeussern(state, p, grund) {
        p.wechselwunsch = { seit: this.stempel(state), grund };
        this.post(state, p, `${p.name} möchte wechseln`,
            `${p.name} hat seinen Berater gebeten, sich nach einem neuen Verein umzusehen. „${grund}“ `
            + "Sie können den Wunsch akzeptieren oder versuchen, ihn umzustimmen.");
    }

    static post(state, p, betreff, text) {
        if (!Array.isArray(state.inbox)) state.inbox = [];
        state.inbox.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            matchday: state.currentMatchday,
            date: `Spieltag ${state.currentMatchday || 1}`,
            sender: p.name,
            subject: betreff,
            body: text,
            read: false,
            type: "player_talk"
        });
    }

    /** Für den Schreibtisch: Wer wartet auf ein Gespräch, wer will weg? */
    static schreibtisch(state) {
        const club = state?.clubs?.find(c => c.id === state.userClubId);
        if (!club) return [];
        const ids = new Set(club.playerIds.map(String));
        const heute = this.stempel(state);
        const items = [];
        (state.players || []).filter(p => ids.has(String(p.id))).forEach(p => {
            if (p.wechselwunsch && !p.wechselwunsch.akzeptiert) {
                items.push({ priority: 1, icon: "📢", playerId: p.id, tab: "squad",
                    title: `${p.name} will wechseln`, detail: "Akzeptieren oder umstimmen - im Gespräch in der Spielerakte." });
            } else if (p.gespraechswunsch) {
                const rest = Math.max(0, this.WUNSCH_FRIST - (heute - p.gespraechswunsch.seit));
                items.push({ priority: 2, icon: "💬", playerId: p.id, tab: "squad",
                    title: `${p.name} möchte Sie sprechen`,
                    detail: `${p.gespraechswunsch.grund === "spielzeit" ? "Es geht um seine Spielzeit" : "Er ist unzufrieden"} · noch ${rest} Tag${rest === 1 ? "" : "e"}` });
            } else if (p.versprechen) {
                const v = p.versprechen;
                items.push({ priority: 6, icon: "🤝", playerId: p.id, tab: "tactics",
                    title: `Versprechen an ${p.name}`,
                    detail: `${v.einsaetze} von ${v.noetig} Einsätzen · noch ${v.frist - v.spiele} Spiele` });
            }
        });
        return items;
    }
}

if (typeof window !== "undefined") {
    window.PlayerTalkEngine = PlayerTalkEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PlayerTalkEngine };
}
