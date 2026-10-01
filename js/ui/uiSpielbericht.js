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
     * Modal: Spielbericht nach Abpfiff
     */
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
                <h4 style="font-size:14px; margin-bottom:8px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-target"/></svg>Spielanalyse</h4>
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
            // Beim Sofort-Ergebnis rechnet das Spiel ohne Laufwege - dann
            // lieber sagen, warum die Karte fehlt, als eine zu erfinden
            const eigenes = state && (match?.homeClubId === state.userClubId || match?.awayClubId === state.userClubId);
            return eigenes ? `
            <div class="dash-card sa-karte" style="padding:14px; margin-bottom:16px;">
                <h4 style="font-size:14px; margin-bottom:6px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-pass"/></svg>Positionen und Passwege</h4>
                <p class="text-muted" style="margin:0; font-size:13px;">Heatmap und Passnetz entstehen aus den Laufwegen im Livespiel. Beim Sofort-Ergebnis gibt es sie nicht.</p>
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
                <h4 style="font-size:14px; margin-bottom:8px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-pass"/></svg>Positionen und Passwege</h4>
                <div class="sa-raster pa-raster">${team("home", home)}${team("away", away)}</div>
                <div class="sa-legende"><span>Fläche = wo die Mannschaft sich aufhielt</span><span>Punkte = Durchschnittsposition</span><span>Linien = häufigste Passwege</span><span>Angriff nach rechts</span></div>
            </div>`;
    },

    showMatchReportModal(match) {
        const state = this.app.state;
        const home = state.clubs.find(c => c.id === match.homeClubId);
        const away = state.clubs.find(c => c.id === match.awayClubId);

        const modal = document.getElementById("modalMatchReport");
        const body = document.getElementById("matchReportContent");

        const goals = match.events.filter(e => e.type === "goal");
        const cards = match.events.filter(e => e.type === "yellow_card" || e.type === "red_card");
        const injuries = match.injuries || [];
        const suspensions = match.suspensions || [];

        const homeRatings = (match.playerRatings || []).filter(r => r.clubId === home.id);
        const awayRatings = (match.playerRatings || []).filter(r => r.clubId === away.id);
        const schiri = typeof MatchEngine !== "undefined" && MatchEngine.schiedsrichterFuer
            ? MatchEngine.schiedsrichterFuer(match) : null;

        const renderRatingsTable = (ratings, teamName) => {
            if (!ratings || ratings.length === 0) return '<div class="text-muted" style="font-size:12px;">Keine Noten verfügbar</div>';
            return `
                <div style="margin-bottom:12px;">
                    <h5 style="font-size:13px; font-weight:700; margin-bottom:6px; color:var(--text-primary);">${teamName}</h5>
                    <table style="width:100%; font-size:12px; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted); text-align:left;">
                                <th style="padding:4px 2px;">Spieler</th>
                                <th style="padding:4px 2px; text-align:center;">Pos</th>
                                <th style="padding:4px 2px; text-align:center;">Min</th>
                                <th style="padding:4px 2px; text-align:center;">T/A/P</th>
                                <th style="padding:4px 2px; text-align:center;">Note</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ratings.map(r => {
                                const tap = `${r.goals || 0}/${r.assists || 0}/${r.saves || 0}`;
                                const noteColor = r.rating >= 7.5 ? "#10b981" : (r.rating <= 5.8 ? "#ef4444" : "var(--accent-gold)");
                                return `
                                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                                        <td style="padding:4px 2px;">${r.name} ${r.cards || ''}</td>
                                        <td style="padding:4px 2px; text-align:center; color:var(--text-muted);">${r.pos}</td>
                                        <td style="padding:4px 2px; text-align:center;">${r.minutes}'</td>
                                        <td style="padding:4px 2px; text-align:center; font-size:11px; color:var(--text-muted);">${tap}</td>
                                        <td style="padding:4px 2px; text-align:center; font-weight:700; color:${noteColor};">${r.rating.toFixed(1)}</td>
                                    </tr>
                                `;
                            }).join("")}
                        </tbody>
                    </table>
                </div>
            `;
        };

        body.innerHTML = `
            <div style="text-align:center; padding:16px 0; border-bottom:1px solid var(--border-color); margin-bottom:16px;">
                <h1 style="font-size:36px; font-weight:800; color:var(--accent-gold);">${match.homeGoals} : ${match.awayGoals}</h1>
                <h3 style="margin-top:4px;">${home.name} vs ${away.name}</h3>
                <p class="text-muted" style="font-size:13px;">${home.stadium}${schiri ? ` · Schiedsrichter: ${this.escapeHtml(schiri.name)} (${this.escapeHtml(schiri.art)})` : ""}${match.wetter && typeof WetterEngine !== "undefined" ? ` · ${this.escapeHtml(WetterEngine.text(match, home))}` : ""}</p>
            </div>

            ${match.summaryText ? `
                <div style="font-size:13px; line-height:1.4; padding:10px 14px; background:rgba(255,255,255,0.03); border-radius:6px; margin-bottom:16px; border-left:3px solid var(--accent-gold);">
                    ${match.summaryText}
                </div>
            ` : ''}

            ${match.manOfTheMatch ? `
                <div class="dash-card" style="padding:12px; text-align:center; background:rgba(245, 158, 11, 0.1); border-color:#f59e0b; margin-bottom:16px;">
                    ⭐ <strong>Man of the Match:</strong> ${match.manOfTheMatch.name} (${match.manOfTheMatch.clubName}) — Note <strong>${match.manOfTheMatch.rating}</strong>
                </div>
            ` : ''}

            <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:14px; margin-bottom:10px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-ball"/></svg>Torschützen</h4>
                    ${goals.length > 0 ? goals.map(g => `<div>${g.text}</div>`).join("") : '<div class="text-muted">Keine Tore</div>'}
                </div>
                <div class="dash-card" style="padding:14px;">
                    <h4 style="font-size:14px; margin-bottom:10px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-flag"/></svg>Karten & Disziplin</h4>
                    ${cards.length > 0 ? cards.map(c => `<div>${c.text}</div>`).join("") : '<div class="text-muted">Faires Spiel ohne Platzverweise</div>'}
                </div>
            </div>

            ${(injuries.length > 0 || suspensions.length > 0) ? `
                <div class="dash-card" style="padding:14px; margin-bottom:16px; background:rgba(239, 68, 68, 0.05); border-color:rgba(239, 68, 68, 0.3);">
                    <h4 style="font-size:14px; margin-bottom:10px; color:#ef4444;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-medical"/></svg>Verletzungen & Sperren</h4>
                    ${injuries.map(inj => `<div style="font-size:13px;">🩹 <strong>${inj.playerName}</strong>: ${inj.injuryName} (${inj.weeks} Wochen Ausfall)</div>`).join("")}
                    ${suspensions.map(s => `<div style="font-size:13px;">🚫 <strong>${s.playerName}</strong>: ${s.reason} (${s.matches} Spiel(e) gesperrt)</div>`).join("")}
                </div>
            ` : ''}

            <div class="dash-card" style="padding:14px; margin-bottom:16px;">
                <h4 style="font-size:14px; margin-bottom:12px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-star"/></svg>Spielernoten & Leistungsdaten</h4>
                <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap:16px;">
                    <div>${renderRatingsTable(homeRatings, home.name)}</div>
                    <div>${renderRatingsTable(awayRatings, away.name)}</div>
                </div>
            </div>

            ${this.spielanalyseHtml(match, home, away)}
            ${this.positionsanalyseHtml(match, home, away)}

            <div class="dash-card" style="padding:14px;">
                <h4 style="font-size:14px; margin-bottom:12px;"><svg class="ico h-ico" aria-hidden="true"><use href="#i-chart"/></svg>Spielstatistik</h4>
                <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap:12px;">
                    <div class="club-stat-line"><span>Ballbesitz:</span><strong>${match.stats.possession[0]}% - ${match.stats.possession[1]}%</strong></div>
                    <div class="club-stat-line"><span>Passquote:</span><strong>${match.stats.passAccuracy ? `${match.stats.passAccuracy[0]}% - ${match.stats.passAccuracy[1]}%` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Zweikämpfe gewonnen:</span><strong>${match.stats.tacklesWon ? `${match.stats.tacklesWon[0]}% - ${match.stats.tacklesWon[1]}%` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Schüsse gesamt:</span><strong>${match.stats.shots[0]} - ${match.stats.shots[1]}</strong></div>
                    <div class="club-stat-line"><span>Schüsse aufs Tor:</span><strong>${match.stats.shotsOnTarget[0]} - ${match.stats.shotsOnTarget[1]}</strong></div>
                    <div class="club-stat-line"><span>Expected Goals (xG):</span><strong>${match.stats.xG[0]} - ${match.stats.xG[1]}</strong></div>
                    <div class="club-stat-line"><span>Eckbälle:</span><strong>${match.stats.corners ? `${match.stats.corners[0]} - ${match.stats.corners[1]}` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Fouls:</span><strong>${match.stats.fouls ? `${match.stats.fouls[0]} - ${match.stats.fouls[1]}` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Gelbe Karten:</span><strong>${match.stats.yellowCards ? `${match.stats.yellowCards[0]} - ${match.stats.yellowCards[1]}` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Rote Karten:</span><strong>${match.stats.redCards ? `${match.stats.redCards[0]} - ${match.stats.redCards[1]}` : '-'}</strong></div>
                    <div class="club-stat-line"><span>Torwartparaden:</span><strong>${match.stats.saves ? `${match.stats.saves[0]} - ${match.stats.saves[1]}` : '-'}</strong></div>
                </div>
            </div>
        `;

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
