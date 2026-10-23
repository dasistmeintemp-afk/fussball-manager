/**
 * Spielbericht: Schusskarte, xG-Verlauf, Heatmaps, Passnetze und der Bericht nach dem Abpfiff.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert, damit uiManager.js nicht
 * über zwölftausend Zeilen lang ist.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Spielanalyse im Bericht: Schusskarte (wo, wie gut, mit welchem Ausgang)
     * und der Verlauf der erspielten Chancenqualität über neunzig Minuten.
     * Heim greift nach rechts an, Gast nach links.
     */
    spielanalyseHtml(match, home, away) {
        const schuesse = Array.isArray(match?.schuesse) ? match.schuesse : [];
        if (!schuesse.length) return "";
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const trikots = typeof ermittleTrikots === "function" ? ermittleTrikots(home, away) : null;
        const farbe = [trikots?.home?.akzent || "#bef264", trikots?.away?.akzent || "#38bdf8"];
        const ausgangText = ["vorbei", "gehalten", "Tor", "geblockt"];
        const komma = (v) => String(v).replace(".", ",");

        // Spielfeld 105 x 68 Meter
        const linie = `stroke="rgba(255,255,255,0.28)" stroke-width="0.35" fill="none"`;
        const feld = `
            <rect x="0" y="0" width="105" height="68" fill="#123524" rx="1"/>
            <rect x="0.5" y="0.5" width="104" height="67" ${linie}/>
            <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" ${linie}/>
            <circle cx="52.5" cy="34" r="9.15" ${linie}/>
            <rect x="0.5" y="13.85" width="16.5" height="40.3" ${linie}/>
            <rect x="88" y="13.85" width="16.5" height="40.3" ${linie}/>
            <rect x="0.5" y="24.84" width="5.5" height="18.32" ${linie}/>
            <rect x="99" y="24.84" width="5.5" height="18.32" ${linie}/>
            <rect x="-1" y="30.34" width="1.5" height="7.32" fill="rgba(255,255,255,0.5)"/>
            <rect x="104.5" y="30.34" width="1.5" height="7.32" fill="rgba(255,255,255,0.5)"/>`;
        const punkte = schuesse.map(([min, team, x, y, xg, ausgang, elfmeter, name]) => {
            const px = team === 0 ? x * 1.05 : (100 - x) * 1.05;
            const py = team === 0 ? y * 0.68 : (100 - y) * 0.68;
            const r = (0.9 + Math.sqrt(Math.max(1, xg) / 100) * 3.2).toFixed(2);
            const f = farbe[team];
            const stil = ausgang === 2 ? `fill="${f}" stroke="#ffffff" stroke-width="0.5"`
                : ausgang === 1 ? `fill="${f}" fill-opacity="0.5" stroke="${f}" stroke-width="0.35"`
                    : ausgang === 3 ? `fill="none" stroke="${f}" stroke-width="0.4" stroke-dasharray="0.8 0.6"`
                        : `fill="none" stroke="${f}" stroke-width="0.4" stroke-opacity="0.8"`;
            return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" ${stil}><title>${min}' ${esc(name)} · xG ${komma((xg / 100).toFixed(2))} · ${ausgangText[ausgang]}${elfmeter ? " (Elfmeter)" : ""}</title></circle>`;
        }).join("");

        // xG-Verlauf: Treppenlinien je Mannschaft, Tore als Punkte
        const summe = [0, 0];
        const verlauf = [[[0, 0]], [[0, 0]]];
        const tore = [[], []];
        [...schuesse].sort((a, b) => a[0] - b[0]).forEach(([min, team, , , xg, ausgang]) => {
            verlauf[team].push([min, summe[team]]);
            summe[team] += xg / 100;
            verlauf[team].push([min, summe[team]]);
            if (ausgang === 2) tore[team].push([min, summe[team]]);
        });
        const ende = Math.max(90, ...schuesse.map(z => z[0]));
        const hoch = Math.max(1, summe[0], summe[1]) * 1.1;
        const X = (m) => (8 + (m / ende) * 186).toFixed(1);
        const Y = (v) => (62 - (v / hoch) * 56).toFixed(1);
        verlauf.forEach((v, t) => v.push([ende, summe[t]]));
        const pfad = (v) => v.map(([m, w], i) => `${i ? "L" : "M"}${X(m)},${Y(w)}`).join(" ");
        const kurve = `
            <line x1="8" y1="62" x2="194" y2="62" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
            <line x1="${X(45)}" y1="6" x2="${X(45)}" y2="62" stroke="rgba(255,255,255,0.12)" stroke-width="0.5" stroke-dasharray="2 2"/>
            <text x="8" y="70" class="sa-achse">0'</text><text x="${X(45)}" y="70" class="sa-achse" text-anchor="middle">45'</text><text x="194" y="70" class="sa-achse" text-anchor="end">${ende}'</text>
            ${[0, 1].map(t => `
                <path d="${pfad(verlauf[t])}" fill="none" stroke="${farbe[t]}" stroke-width="1.4" stroke-linejoin="round"/>
                ${tore[t].map(([m, w]) => `<circle cx="${X(m)}" cy="${Y(w)}" r="2.2" fill="${farbe[t]}" stroke="#0b1220" stroke-width="0.6"><title>Tor ${m}'</title></circle>`).join("")}
            `).join("")}`;

        const kopfzeile = (t, club) => {
            const eigene = schuesse.filter(z => z[1] === t);
            return `<span class="sa-team"><i style="background:${farbe[t]}"></i>${esc(club.name)}: ${eigene.length} Schüsse · ${komma(summe[t].toFixed(2))} xG</span>`;
        };
        return `
            <div class="dash-card sa-karte" style="padding:14px; margin-bottom:16px;">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-target"/></svg>Spielanalyse</h4>
                <div class="sa-kopf">${kopfzeile(0, home)}${kopfzeile(1, away)}</div>
                <div class="sa-raster">
                    <div>
                        <svg class="sa-feld" viewBox="-1.5 -1 108 70" role="img" aria-label="Schusskarte">${feld}${punkte}</svg>
                        <div class="sa-legende">
                            <span><i class="sa-l sa-tor"></i>Tor</span><span><i class="sa-l sa-gehalten"></i>gehalten</span>
                            <span><i class="sa-l sa-vorbei"></i>vorbei</span><span><i class="sa-l sa-geblockt"></i>geblockt</span>
                            <span>Größe = Chancenqualität (xG)</span>
                        </div>
                    </div>
                    <div>
                        <div class="sa-untertitel">Chancenqualität im Spielverlauf</div>
                        <svg class="sa-verlauf" viewBox="0 0 200 74" role="img" aria-label="xG-Verlauf">${kurve}</svg>
                    </div>
                </div>
            </div>`;
    },

    /**
     * Heatmap und Passnetz je Mannschaft aus dem Livespiel: Wo stand die
     * Elf, wer hat mit wem gespielt. Beide Mannschaften greifen hier von
     * links nach rechts an.
     */
    positionsanalyseHtml(match, home, away) {
        const a = match?.analyse;
        const state = this.app.state;
        if (!a || !a.heat || !a.netz) {
            // Ohne Laufwege (ältere Spielstände, Spiele aus dem statistischen
            // Modell) lieber sagen, warum die Karte fehlt, als eine zu erfinden
            const eigenes = state && (match?.homeClubId === state.userClubId || match?.awayClubId === state.userClubId);
            return eigenes ? `
            <div class="dash-card sa-karte" style="padding:14px; margin-bottom:16px;">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-pass"/></svg>Positionen und Passwege</h4>
                <p class="text-muted" style="margin:0; font-size:13px;">Heatmap und Passnetz entstehen aus den Laufwegen der Simulation. Für dieses Spiel liegen keine vor.</p>
            </div>` : "";
        }
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const trikots = typeof ermittleTrikots === "function" ? ermittleTrikots(home, away) : null;
        const farbe = { home: trikots?.home?.akzent || "#bef264", away: trikots?.away?.akzent || "#38bdf8" };
        const linie = `stroke="rgba(255,255,255,0.28)" stroke-width="0.35" fill="none"`;
        const feld = `
            <rect x="0" y="0" width="105" height="68" fill="#123524" rx="1"/>
            <rect x="0.5" y="0.5" width="104" height="67" ${linie}/>
            <line x1="52.5" y1="0.5" x2="52.5" y2="67.5" ${linie}/>
            <circle cx="52.5" cy="34" r="9.15" ${linie}/>
            <rect x="0.5" y="13.85" width="16.5" height="40.3" ${linie}/>
            <rect x="88" y="13.85" width="16.5" height="40.3" ${linie}/>`;
        const kurzname = (name) => {
            const teile = String(name || "").trim().split(/\s+/);
            return (teile[teile.length - 1] || "").slice(0, 9);
        };
        const team = (seite, club) => {
            const f = farbe[seite];
            const heat = String(a.heat[seite] || "");
            const zellen = heat.split("").map((v, i) => {
                const w = Number(v);
                if (!w) return "";
                const x = (i % 12) * 8.75, y = Math.floor(i / 12) * 8.5;
                return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="8.75" height="8.5" fill="${f}" fill-opacity="${(w / 9 * 0.55).toFixed(2)}"/>`;
            }).join("");
            const netz = a.netz[seite] || { spieler: [], kanten: [] };
            const pos = netz.spieler.map(([, x, y]) => [x * 1.05, y * 0.68]);
            const maxKante = Math.max(1, ...netz.kanten.map(k => k[2]));
            const kanten = netz.kanten.map(([v, z, n]) => {
                if (!pos[v] || !pos[z]) return "";
                return `<line x1="${pos[v][0].toFixed(1)}" y1="${pos[v][1].toFixed(1)}" x2="${pos[z][0].toFixed(1)}" y2="${pos[z][1].toFixed(1)}" stroke="#ffffff" stroke-opacity="${(0.25 + n / maxKante * 0.5).toFixed(2)}" stroke-width="${(0.3 + n / maxKante * 1.3).toFixed(2)}" stroke-linecap="round"/>`;
            }).join("");
            const knoten = netz.spieler.map(([id, x, y], i) => {
                const p = state.players.find(q => String(q.id) === String(id));
                const name = p ? p.name : "";
                return `<g><circle cx="${pos[i][0].toFixed(1)}" cy="${pos[i][1].toFixed(1)}" r="2.3" fill="${f}" stroke="#0b1220" stroke-width="0.5"><title>${esc(name)}</title></circle>
                    <text x="${pos[i][0].toFixed(1)}" y="${(pos[i][1] - 3).toFixed(1)}" class="pa-name" text-anchor="middle">${esc(kurzname(name))}</text></g>`;
            }).join("");
            return `
                <div>
                    <div class="sa-untertitel"><i class="pa-punkt" style="background:${f}"></i>${esc(club.name)}</div>
                    <svg class="sa-feld" viewBox="-1.5 -1 108 70" role="img" aria-label="Heatmap und Passnetz ${esc(club.name)}">${feld}${zellen}${kanten}${knoten}</svg>
                </div>`;
        };
        return `
            <div class="dash-card sa-karte" style="padding:14px; margin-bottom:16px;">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-pass"/></svg>Positionen und Passwege</h4>
                <div class="sa-raster pa-raster">${team("home", home)}${team("away", away)}</div>
                <div class="sa-legende"><span>Fläche = wo die Mannschaft sich aufhielt</span><span>Punkte = Durchschnittsposition</span><span>Linien = häufigste Passwege</span><span>Angriff nach rechts</span></div>
            </div>`;
    },

    /**
     * Alles, was der Bericht über eine Partie wissen muss, an einer Stelle:
     * Vereine, Farben, Ereignisse in zeitlicher Folge, Noten je Seite.
     */
    spielberichtDaten(match, home, away) {
        const state = this.app.state;
        const trikots = typeof ermittleTrikots === "function" ? ermittleTrikots(home, away) : null;
        const farbe = { home: trikots?.home?.akzent || "#bef264", away: trikots?.away?.akzent || "#38bdf8" };
        const seiteVon = (clubId) => (clubId === home.id ? "home" : "away");
        const ereignisse = (match.events || [])
            .filter(e => ["goal", "yellow_card", "red_card", "substitution", "injury"].includes(e.type))
            .map((e, i) => ({ ...e, seite: seiteVon(e.clubId), i }))
            .sort((a, b) => (a.minute || 0) - (b.minute || 0) || a.i - b.i);
        // Laufender Spielstand nach jedem Tor
        const stand = { home: 0, away: 0 };
        ereignisse.forEach(e => {
            if (e.type !== "goal") return;
            stand[e.seite]++;
            e.stand = `${stand.home}:${stand.away}`;
        });
        const tore = ereignisse.filter(e => e.type === "goal");
        const halbzeit = {
            home: tore.filter(e => e.seite === "home" && (e.minute || 0) <= 45).length,
            away: tore.filter(e => e.seite === "away" && (e.minute || 0) <= 45).length
        };
        const ende = Math.max(90, ...ereignisse.map(e => e.minute || 0));

        // Ein- und Auswechslungen je Spieler für die Notenliste
        const rein = new Map(), raus = new Map();
        ereignisse.filter(e => e.type === "substitution").forEach(e => {
            if (e.playerInId != null) rein.set(String(e.playerInId), e.minute);
            if (e.playerOutId != null) raus.set(String(e.playerOutId), e.minute);
        });
        const noten = (match.playerRatings || []).map(r => ({
            ...r,
            seite: seiteVon(r.clubId),
            rein: rein.get(String(r.playerId)),
            raus: raus.get(String(r.playerId))
        }));
        const motm = match.manOfTheMatch || null;
        const motmNote = motm ? noten.find(r => String(r.playerId) === String(motm.id)) : null;

        // Wettbewerb und Runde wie über dem Livespiel
        const compId = match.freundschaftsspiel ? "friendly"
            : (match.competitionId || match.leagueId || state.userLeagueId);
        const thema = typeof this.wettbewerbsThema === "function" ? { ...this.wettbewerbsThema(compId) } : { name: "Liga" };
        if (match.wettbewerbName) thema.name = match.wettbewerbName;
        let spieltag = match.matchday;
        if (!spieltag && Array.isArray(state.schedule)) {
            const runde = state.schedule.find(md => (md.matches || []).includes(match));
            if (runde) spieltag = runde.matchday;
        }
        let runde = match.roundName || (spieltag ? `${spieltag}. Spieltag` : "");
        if (runde === thema.name) runde = "";

        return { match, home, away, farbe, ereignisse, tore, halbzeit, ende, noten, motm, motmNote, thema, runde };
    },

    /** Note mit Komma und Farbe - dieselben Stufen wie im Livespiel */
    spielberichtNoteHtml(note, klasse = "") {
        if (typeof note !== "number") return `<span class="coach-note leer ${klasse}">–</span>`;
        const stufe = note >= 7.3 ? "gut" : (note >= 6.2 ? "ok" : (note >= 5.6 ? "mau" : "schwach"));
        return `<span class="coach-note ${stufe} ${klasse}">${note.toFixed(1).replace(".", ",")}</span>`;
    },

    /** Kopf: Wettbewerb, Wappen, Ergebnis, Torschützen je Seite, dann Ort und Umstände */
    spielberichtKopfHtml(d) {
        const { match, home, away, farbe, tore, halbzeit, thema, runde } = d;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const rgba = (hex, a) => {
            const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
            if (!m) return `rgba(255, 255, 255, ${a})`;
            const n = parseInt(m[1], 16);
            return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
        };
        const schuetzen = (seite) => {
            const liste = new Map();
            tore.filter(e => e.seite === seite).forEach(e => {
                const key = String(e.playerId ?? e.playerName ?? e.text);
                if (!liste.has(key)) liste.set(key, { name: e.playerName || "Tor", minuten: [] });
                liste.get(key).minuten.push(`${Math.max(1, Math.round(e.minute || 0))}'${e.elfmeter ? " (E)" : ""}`);
            });
            return [...liste.values()].map(s => `<li><span class="spb-ball" aria-hidden="true"></span>${esc(s.name)} <span>${s.minuten.join(", ")}</span></li>`).join("");
        };
        const team = (club, seite, klasse) => `
            <div class="spb-team spb-${klasse}">
                ${this.wappenHtml(club, "crest-lg spb-wappen")}
                <div class="spb-team-text">
                    <strong>${esc(club.name)}</strong>
                    <ul class="spb-schuetzen">${schuetzen(seite)}</ul>
                </div>
            </div>`;
        const schiri = typeof MatchEngine !== "undefined" && MatchEngine.schiedsrichterFuer
            ? MatchEngine.schiedsrichterFuer(match) : null;
        const zuschauer = Number(match.attendance) > 0
            ? `${Number(match.attendance).toLocaleString("de-DE")} Zuschauer${match.soldOut ? " (ausverkauft)" : ""}` : "";
        const ort = match.neutralerPlatz ? (match.stadion || "Neutraler Platz") : home.stadium;
        const wetter = match.wetter && typeof WetterEngine !== "undefined" ? WetterEngine.text(match, home) : "";
        const umstaende = [ort, zuschauer, schiri && schiri.name ? `Schiedsrichter ${schiri.name}${schiri.art ? ` (${schiri.art})` : ""}` : "", wetter]
            .filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("");
        const elfmeter = match.penaltyWinner && Array.isArray(match.penaltyScore)
            ? `<span class="spb-zusatz">i. E. ${match.penaltyScore[0]}:${match.penaltyScore[1]}</span>` : "";
        return `
            <header class="spb-kopf" style="background:linear-gradient(90deg, ${rgba(farbe.home, 0.16)}, transparent 38%, transparent 62%, ${rgba(farbe.away, 0.16)}), var(--surface-2);">
                <div class="spb-wettbewerb" style="--spb-comp:${esc(thema.accent || "var(--accent)")}">${esc(thema.name || "")}${runde ? ` · ${esc(runde)}` : ""}</div>
                <div class="spb-paarung">
                    ${team(home, "home", "heim")}
                    <div class="spb-ergebnis">
                        <h2 class="spb-tore" aria-label="Endstand ${match.homeGoals} zu ${match.awayGoals}">${match.homeGoals}<span>:</span>${match.awayGoals}</h2>
                        <span class="spb-zusatz">Halbzeit ${halbzeit.home}:${halbzeit.away}</span>
                        ${elfmeter}
                    </div>
                    ${team(away, "away", "gast")}
                </div>
                <div class="spb-umstaende">${umstaende}</div>
            </header>`;
    },

    /** Statistik als gespiegelte Balken: links Heim, rechts Gast */
    spielberichtStatistikHtml(d) {
        const st = d.match.stats || {};
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const komma = (v) => Number(v).toFixed(2).replace(".", ",");
        const prozent = (v) => `${v} %`;
        const zeilen = [
            ["Ballbesitz", st.possession, prozent],
            ["Schüsse", st.shots],
            ["Aufs Tor", st.shotsOnTarget],
            ["Erwartete Tore (xG)", st.xG, komma],
            ["Ecken", st.corners],
            ["Passquote", st.passAccuracy, prozent],
            ["Zweikämpfe gewonnen", st.tacklesWon, prozent],
            ["Fouls", st.fouls],
            ["Gelbe Karten", st.yellowCards],
            ["Rote Karten", st.redCards],
            ["Paraden", st.saves]
        ].filter(([, werte]) => Array.isArray(werte) && werte.length === 2);
        return zeilen.map(([label, [h, a], fmt]) => {
            const heim = Number(h) || 0, gast = Number(a) || 0, summe = heim + gast;
            const f = fmt || (v => String(v));
            const anteil = summe > 0 ? heim / summe * 100 : 50;
            return `<div class="spb-stat${summe === 0 ? " leer" : ""}">
                <span class="spb-stat-wert${heim > gast ? " vorn" : ""}">${esc(f(h))}</span>
                <span class="spb-stat-label">${label}</span>
                <span class="spb-stat-wert${gast > heim ? " vorn" : ""}">${esc(f(a))}</span>
                <span class="spb-stat-balken" style="--anteil:${anteil.toFixed(1)}%"><i></i><i></i></span>
            </div>`;
        }).join("");
    },

    /** Zeichen eines Ereignisses: Ball, Karte, Wechsel, Verletzung */
    spielberichtZeichen(e) {
        if (e.type === "goal") return '<span class="spb-ball" aria-hidden="true"></span>';
        if (e.type === "yellow_card") return `<i class="lm-card ${e.zweiteGelbe ? "gelbrot" : "gelb"}" aria-hidden="true"></i>`;
        if (e.type === "red_card") return '<i class="lm-card rot" aria-hidden="true"></i>';
        if (e.type === "substitution") return '<span class="spb-wechsel" aria-hidden="true">⇄</span>';
        return '<span class="spb-verletzt" aria-hidden="true">+</span>';
    },

    /** Kurzer Text eines Ereignisses für Liste und Zeitleiste */
    spielberichtEreignisText(e, esc) {
        if (e.type === "goal") {
            return `<b>${esc(e.playerName || "Tor")}</b>${e.elfmeter ? " (Elfmeter)" : ""}`
                + `${e.assistName ? ` <small>Vorlage ${esc(e.assistName)}</small>` : ""}`;
        }
        if (e.type === "substitution") {
            return `<b>${esc(e.playerInName || "")}</b> <small>für ${esc(e.playerOutName || "")}</small>`;
        }
        if (e.type === "injury") return `<b>${esc(e.playerName || "")}</b> <small>verletzt</small>`;
        const art = e.type === "red_card" ? "Rote Karte" : (e.zweiteGelbe ? "Gelb-Rot" : "Gelbe Karte");
        return `<b>${esc(e.playerName || "")}</b> <small>${art}</small>`;
    },

    /**
     * Spielverlauf: oben eine Zeitleiste über die ganze Partie (Heim über,
     * Gast unter der Linie), darunter jedes Ereignis mit Minute - Heim
     * links, Gast rechts, Tore mit dem Spielstand danach.
     */
    spielberichtVerlaufHtml(d) {
        const { ereignisse, ende, halbzeit, match } = d;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const min = (e) => `${Math.max(1, Math.round(e.minute || 0))}'`;
        // Zeichen, die sich auf der Leiste berühren würden, rücken eine Reihe weiter
        const reihen = { home: [], away: [] };
        const marken = ereignisse.map(e => {
            const x = Math.min(100, Math.max(0, (e.minute || 0) / ende * 100));
            const belegt = reihen[e.seite];
            let reihe = 0;
            while (belegt.some(([bx, br]) => br === reihe && Math.abs(bx - x) < 3.2)) reihe++;
            belegt.push([x, reihe]);
            const titel = `${min(e)} ${String(this.spielberichtEreignisText(e, esc)).replace(/<[^>]+>/g, "")}`;
            return `<span class="spb-marke spb-${e.seite === "home" ? "oben" : "unten"}${e.type === "goal" ? " tor" : ""}" style="left:${x.toFixed(2)}%;--reihe:${Math.min(reihe, 2)}" title="${esc(titel)}">${this.spielberichtZeichen(e)}</span>`;
        }).join("");
        const leiste = `
            <div class="spb-leiste" role="img" aria-label="Zeitleiste der Partie">
                <span class="spb-leiste-linie"></span>
                <span class="spb-leiste-hz" style="left:${(45 / ende * 100).toFixed(2)}%"></span>
                ${marken}
            </div>
            <div class="spb-leiste-achse"><span>0'</span><span style="left:${(45 / ende * 100).toFixed(2)}%">45'</span><span>${ende}'</span></div>`;

        const zeile = (e) => {
            const inhalt = `${this.spielberichtZeichen(e)}<span class="spb-ev-text">${this.spielberichtEreignisText(e, esc)}</span>${e.stand ? `<span class="spb-ev-stand">${e.stand}</span>` : ""}`;
            return `<div class="spb-ev${e.type === "goal" ? " tor" : ""}">
                <div class="spb-ev-heim">${e.seite === "home" ? inhalt : ""}</div>
                <span class="spb-ev-min">${min(e)}</span>
                <div class="spb-ev-gast">${e.seite === "away" ? inhalt : ""}</div>
            </div>`;
        };
        const trenner = (text) => `<div class="spb-ev-trenner"><span>${text}</span></div>`;
        const erste = ereignisse.filter(e => (e.minute || 0) <= 45);
        const zweite = ereignisse.filter(e => (e.minute || 0) > 45);
        const liste = ereignisse.length ? [
            trenner("Anpfiff"),
            ...erste.map(zeile),
            trenner(`Halbzeit · ${halbzeit.home}:${halbzeit.away}`),
            ...zweite.map(zeile),
            trenner(`Abpfiff · ${match.homeGoals}:${match.awayGoals}`)
        ].join("") : '<p class="text-muted spb-leer">Keine Tore, Karten oder Wechsel.</p>';
        return `${leiste}<div class="spb-ev-liste">${liste}</div>`;
    },

    /** Spieler des Spiels als eigene Karte: wer, für wen, mit welcher Note und welchen Zahlen */
    spielberichtMotmHtml(d) {
        const { motm, motmNote, home, away } = d;
        if (!motm) return "";
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const club = motm.clubId === away.id ? away : home;
        const r = motmNote || {};
        const zahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
        const zahlen = [
            r.goals ? zahl(r.goals, "Tor", "Tore") : "",
            r.assists ? zahl(r.assists, "Vorlage", "Vorlagen") : "",
            r.saves ? zahl(r.saves, "Parade", "Paraden") : "",
            typeof r.minutes === "number" ? `${r.minutes} Minuten` : ""
        ].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("");
        const note = typeof r.rating === "number" ? r.rating : Number(motm.rating);
        return `
            <section class="dash-card spb-karte spb-motm">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-star"/></svg>Spieler des Spiels</h4>
                <div class="spb-motm-person">
                    ${this.wappenHtml(club, "crest-md")}
                    <div class="spb-motm-name">
                        <strong>${esc(motm.name)}</strong>
                        <small>${esc([r.pos, club.name].filter(Boolean).join(" · "))}</small>
                    </div>
                    ${this.spielberichtNoteHtml(Number.isFinite(note) ? note : null, "spb-note-gross")}
                </div>
                ${zahlen ? `<div class="spb-motm-zahlen">${zahlen}</div>` : ""}
            </section>`;
    },

    /** Übersicht: links der Spielverlauf und der Bericht, rechts Spieler des Spiels, Statistik, Ausfälle */
    spielberichtUebersichtHtml(d) {
        const { match, home, away } = d;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        // Der Spieler des Spiels hat seine eigene Karte - im Text stünde er doppelt
        const bericht = String(match.summaryText || "").replace(/\s*Spieler des Spiels:.*$/, "").trim()
            .replace(/(\d)\.(\d)/g, "$1,$2");
        const ausfaelle = [
            ...(match.injuries || []).map(i => `<div class="spb-ausfall"><span class="spb-verletzt" aria-hidden="true">+</span><span><b>${esc(i.playerName)}</b> ${esc(i.injuryName || "verletzt")}</span><small>${i.weeks} ${i.weeks === 1 ? "Woche" : "Wochen"}</small></div>`),
            ...(match.suspensions || []).map(s => `<div class="spb-ausfall"><i class="lm-card rot" aria-hidden="true"></i><span><b>${esc(s.playerName)}</b> ${esc(s.reason || "gesperrt")}</span><small>${s.matches} ${s.matches === 1 ? "Spiel" : "Spiele"} Sperre</small></div>`)
        ].join("");
        const teamZeile = `<div class="spb-stat-teams"><span>${this.wappenHtml(home, "crest-sm")}${esc(this.kurzName(home.name))}</span><span>${esc(this.kurzName(away.name))}${this.wappenHtml(away, "crest-sm")}</span></div>`;
        return `
            <div class="spb-raster">
                <div class="spb-spalte">
                    <section class="dash-card spb-karte">
                        <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-clock"/></svg>Spielverlauf</h4>
                        ${this.spielberichtVerlaufHtml(d)}
                    </section>
                    ${bericht ? `
                    <section class="dash-card spb-karte">
                        <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-doc"/></svg>Bericht</h4>
                        <p class="spb-bericht">${esc(bericht)}</p>
                    </section>` : ""}
                </div>
                <div class="spb-spalte">
                    ${this.spielberichtMotmHtml(d)}
                    <section class="dash-card spb-karte">
                        <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-chart"/></svg>Statistik</h4>
                        ${teamZeile}
                        ${this.spielberichtStatistikHtml(d)}
                    </section>
                    ${ausfaelle ? `
                    <section class="dash-card spb-karte spb-ausfaelle">
                        <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#i-medical"/></svg>Ausfälle</h4>
                        ${ausfaelle}
                    </section>` : ""}
                </div>
            </div>`;
    },

    /** Spieler: Noten je Mannschaft, Startelf nach Position, dann die Eingewechselten */
    spielberichtSpielerHtml(d) {
        const { noten, home, away, motm } = d;
        const esc = (t) => this.escapeHtml(t == null ? "" : String(t));
        const reihe = this.KADER_POSITIONEN || ["TW", "IV", "LV", "RV", "DM", "ZM", "LM", "RM", "OM", "LA", "RA", "ST"];
        const rang = (p) => { const i = reihe.indexOf(p); return i < 0 ? reihe.length : i; };
        const gruppe = (p) => (typeof this.getPosGroup === "function" ? this.getPosGroup(p) : "mid");
        const zeile = (r) => {
            const zeichen = [];
            for (let i = 0; i < (r.goals || 0); i++) zeichen.push('<span class="spb-ball" title="Tor"></span>');
            for (let i = 0; i < (r.assists || 0); i++) zeichen.push('<span class="spb-vorlage" title="Vorlage"></span>');
            if (r.cards === "🟥") zeichen.push('<i class="lm-card rot" title="Rote Karte"></i>');
            else if (r.cards === "🟨") zeichen.push('<i class="lm-card gelb" title="Gelbe Karte"></i>');
            if (r.rein != null) zeichen.push(`<span class="spb-rein" title="eingewechselt">▲ ${Math.round(r.rein)}'</span>`);
            if (r.raus != null) zeichen.push(`<span class="spb-raus" title="ausgewechselt">▼ ${Math.round(r.raus)}'</span>`);
            const bester = motm && String(motm.id) === String(r.playerId);
            return `<div class="spb-spieler${bester ? " bester" : ""}">
                <span class="pos-tag pos-${gruppe(r.pos)}">${esc(r.pos)}</span>
                <span class="spb-spieler-name"><span>${esc(r.name)}</span>${bester ? '<svg class="ico spb-stern" aria-label="Spieler des Spiels"><use href="#i-star"/></svg>' : ""}${zeichen.join("")}</span>
                <span class="spb-spieler-min">${r.minutes}'</span>
                ${this.spielberichtNoteHtml(r.rating)}
            </div>`;
        };
        const team = (club, seite) => {
            const eigene = noten.filter(r => r.seite === seite);
            if (!eigene.length) return `<section class="dash-card spb-karte"><h4 class="gs-titel">${esc(club.name)}</h4><p class="text-muted spb-leer">Keine Noten verfügbar.</p></section>`;
            const start = eigene.filter(r => r.rein == null).sort((a, b) => rang(a.pos) - rang(b.pos));
            const bank = eigene.filter(r => r.rein != null).sort((a, b) => a.rein - b.rein);
            const schnitt = start.length ? start.reduce((s, r) => s + (r.rating || 0), 0) / start.length : null;
            return `
                <section class="dash-card spb-karte">
                    <header class="spb-team-kopf">
                        ${this.wappenHtml(club, "crest-sm")}
                        <strong>${esc(club.name)}</strong>
                        <span class="spb-schnitt">Ø Startelf ${this.spielberichtNoteHtml(schnitt)}</span>
                    </header>
                    <div class="spb-unter">Startelf</div>
                    ${start.map(zeile).join("")}
                    ${bank.length ? `<div class="spb-unter">Eingewechselt</div>${bank.map(zeile).join("")}` : ""}
                </section>`;
        };
        return `<div class="spb-teams">${team(home, "home")}${team(away, "away")}</div>`;
    },

    /** Analyse: Schusskarte und xG-Verlauf, dann Heatmaps und Passnetze */
    spielberichtAnalyseHtml(d) {
        const inhalt = this.spielanalyseHtml(d.match, d.home, d.away) + this.positionsanalyseHtml(d.match, d.home, d.away);
        return inhalt.trim() || '<p class="text-muted spb-leer">Für dieses Spiel liegt keine Analyse vor.</p>';
    },

    /**
     * Spielbericht nach dem Abpfiff wie im Vorbild: oben die Paarung mit
     * Wappen, Ergebnis und Torschützen, darunter drei Reiter - Übersicht
     * (Spielverlauf, Spieler des Spiels, Statistik), Spieler (Noten je
     * Mannschaft) und Analyse (Schusskarte, Heatmaps, Passnetze).
     */
    showMatchReportModal(match) {
        // Nach dem Spiel darf die Menümusik wieder
        if (typeof this.setzeLivespielTon === "function") this.setzeLivespielTon(false);
        const state = this.app.state;
        const home = state.clubs.find(c => c.id === match.homeClubId);
        const away = state.clubs.find(c => c.id === match.awayClubId);

        const modal = document.getElementById("modalMatchReport");
        const body = document.getElementById("matchReportContent");
        const d = this.spielberichtDaten(match, home, away);
        const reiter = [
            ["uebersicht", "Übersicht", () => this.spielberichtUebersichtHtml(d)],
            ["spieler", "Spieler", () => this.spielberichtSpielerHtml(d)],
            ["analyse", "Analyse", () => this.spielberichtAnalyseHtml(d)]
        ];
        // Die Vereinsfarben gelten für Kopf, Zeitleiste und Balken gleichermaßen
        body.style.setProperty("--spb-heim", d.farbe.home);
        body.style.setProperty("--spb-gast", d.farbe.away);
        body.innerHTML = `
            ${this.spielberichtKopfHtml(d)}
            <nav class="pd-tabs spb-tabs" role="tablist">${reiter.map(([k, l], i) => `<button type="button" role="tab" class="pd-tab-knopf${i === 0 ? " aktiv" : ""}" data-spb-reiter="${k}" aria-selected="${i === 0}">${l}</button>`).join("")}</nav>
            ${reiter.map(([k, , html], i) => `<div class="spb-inhalt" data-spb-seite="${k}"${i === 0 ? "" : " hidden"}>${html()}</div>`).join("")}`;
        body.scrollTop = 0;
        body.querySelectorAll("[data-spb-reiter]").forEach(knopf => knopf.addEventListener("click", () => {
            const ziel = knopf.dataset.spbReiter;
            body.querySelectorAll("[data-spb-reiter]").forEach(k => {
                k.classList.toggle("aktiv", k === knopf);
                k.setAttribute("aria-selected", k === knopf ? "true" : "false");
            });
            body.querySelectorAll("[data-spb-seite]").forEach(s => { s.hidden = s.dataset.spbSeite !== ziel; });
            // Wer weiter unten umschaltet, landet oben am neuen Reiter
            const tabs = body.querySelector(".spb-tabs");
            const kopfHoehe = body.querySelector(".spb-kopf")?.offsetHeight || 0;
            if (tabs && body.scrollTop > kopfHoehe) body.scrollTop = kopfHoehe;
        }));

        modal.style.display = "flex";
        document.getElementById("btnCloseReport").onclick = () => {
            modal.style.display = "none";
            this.renderCurrentTab();
            this.renderHeader();
        };

        // Die Pressekonferenz nach dem Abpfiff - freiwillig, einmal je Spiel
        const presseKnopf = document.getElementById("btnReportPress");
        const manager = this.getManagerEngine();
        const nachSpiel = manager && typeof manager.buildNachSpielPresse === "function"
            ? manager.buildNachSpielPresse(state, match) : null;
        if (presseKnopf) {
            presseKnopf.style.display = nachSpiel ? "" : "none";
            presseKnopf.disabled = false;
            // Nach der letzten Pressekonferenz stand hier noch "beendet"
            presseKnopf.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-mic"/></svg><span>Pressekonferenz</span>';
            presseKnopf.onclick = () => {
                if (!nachSpiel) return;
                this.showPressConferenceModal(nachSpiel, () => {
                    presseKnopf.disabled = true;
                    presseKnopf.textContent = "Pressekonferenz beendet";
                    this.renderHeader();
                });
            };
        }
    }

});
