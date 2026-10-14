/**
 * Wettbewerbe: Tabellen, Spielplan, Pokal, Relegation und Europapokal.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse (auch im strikten
 * Modus, wie jeder Klassenkörper). Ausgelagert aus uiManager.js.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {
    /**
     * Spielplan & Tabelle rendern
     */
    /**
     * Welche Tabellenplätze wohin führen - genau nach den Regeln, die die
     * CompetitionEngine am Saisonende anwendet: Europapokalplätze der
     * Topligen, Aufstiegsplätze laut Ligadefinition und so viele Absteiger,
     * wie aus den Ligen darunter aufsteigen.
     */
    tabellenZonen(state, ligaId, anzahl) {
        const zonen = new Map();
        const ligen = state.leagues || [];
        const liga = ligen.find(l => l.id === ligaId);
        if (!liga || !anzahl) return zonen;

        const eu = liga.europeanSpots;
        if (eu && (liga.level || 1) === 1) {
            (eu.championsLeague || []).forEach(p => zonen.set(p, "ucl"));
            (eu.europaLeague || []).forEach(p => zonen.set(p, "uel"));
            (eu.conferenceLeague || []).forEach(p => zonen.set(p, "uecl"));
        }
        if (ligen.length > 1) {
            const po = typeof PlayoffEngine !== "undefined" ? PlayoffEngine : null;
            const direkt = l => po ? po.direktePlaetze(l) : ((l.promotionSpots && l.promotionSpots.length) ? l.promotionSpots : [1]);
            if (liga.promotionTo) {
                direkt(liga).forEach(p => zonen.set(p, "auf"));
                // Relegation oder Aufstiegs-Playoffs
                const f = po?.FORMATE?.[liga.id];
                if (f) (f.art === "relegation" ? [f.unten] : (f.plaetze || [])).forEach(p => zonen.set(p, "po"));
            }
            const kinder = ligen.filter(l => l.promotionTo === liga.id);
            // Aus Playoffs steigt sicher einer auf - aus der Relegation nur vielleicht
            const aufsteiger = kinder.reduce((summe, l) => summe + direkt(l).length + (po && po.sichererAufsteiger(l.id) ? 1 : 0), 0);
            const absteiger = Math.min(aufsteiger, anzahl - 1);
            for (let p = anzahl - absteiger + 1; p <= anzahl; p++) zonen.set(p, "ab");
            kinder.forEach(l => {
                const f = po?.FORMATE?.[l.id];
                if (f && f.oben && f.oben.liga === liga.id) zonen.set(f.oben.platz, "rel");
            });
        }
        return zonen;
    },

    renderFixturesAndStandings() {
        const state = this.app.state;
        const userClub = state.clubs.find(c => c.id === state.userClubId);
        const userLeagueId = this.getUserLeagueId(state);
        const activeComp = this.activeCompetitionId || state.activeCompetitionId || userLeagueId;

        this.populateCompetitionSelect(state, activeComp);

        // Der gewählte Wettbewerb färbt den ganzen Reiter
        this.setzeThema(document.getElementById("pane-fixtures"),
            this.wettbewerbsThema(activeComp));

        const tbody = document.getElementById("fullStandingsBody");
        const fixturesList = document.getElementById("fixturesList");
        const tabelle = document.getElementById("fullStandingsTable");
        const legende = document.getElementById("standingsLegend");
        if (legende) legende.innerHTML = "";

        // Pokal- und Endrunden haben keine Tabellenspalten; der Kopf "Platz,
        // Spiele, Punkte" stand dort über Paarungen und Ergebnissen.
        const cupIds = Object.keys(state.cups || {});
        const europa = ["ucl", "uel", "uecl"].includes(activeComp);
        const endrunde = europa && (state.europeanCompetitions?.[activeComp]?.endrunde || []).length > 0;
        if (tabelle) tabelle.classList.toggle("tabelle-runden", cupIds.includes(activeComp) || endrunde);

        if (cupIds.includes(activeComp)) {
            this.renderPokalTableau(state, state.cups[activeComp], tbody, fixturesList, userClub);
            return;
        }
        if (activeComp === "playoffs") {
            if (tabelle) tabelle.classList.add("tabelle-runden");
            this.renderPlayoffs(state, state.playoffs || state.playoffsVorjahr, tbody, fixturesList, userClub);
            return;
        }

        if (europa) {
            this.renderEuropapokal(state, state.europeanCompetitions?.[activeComp], tbody, fixturesList, userClub);
            return;
        }

        // 1. Standard-Liga Tabelle rendern - auch für fremde Ligen der Welt
        const isOwnLeague = activeComp === userLeagueId;
        const table = isOwnLeague
            ? state.standings
            : ((state.standingsByLeague && state.standingsByLeague[activeComp]) || []);

        if (!table.length) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-muted" style="text-align:center; padding:20px;">Für diesen Wettbewerb liegt noch keine Tabelle vor.</td></tr>`;
            if (fixturesList) fixturesList.innerHTML = "";
            return;
        }

        const zonen = this.tabellenZonen(state, activeComp, table.length);
        tbody.innerHTML = table.map((s, idx) => {
            const isUser = s.clubId === userClub.id;
            const zone = zonen.get(idx + 1);
            const club = state.clubs.find(c => c.id === s.clubId);
            const naechsteZone = zonen.get(idx + 2);
            const grenze = zone !== naechsteZone && idx < table.length - 1 ? " zonen-grenze" : "";
            return `
                <tr class="${isUser ? 'row-user-club' : ''}${grenze}" data-club-id="${this.escapeHtml(s.clubId)}">
                    <td class="tb-platz"><span class="rang${zone ? ` rang-${zone}` : ""}" title="${zone ? this.constructor.ZONEN[zone] : ""}">${idx + 1}</span></td>
                    <td class="tb-verein"><span class="tb-verein-inhalt"><span class="mini-wappen" data-club="${this.escapeHtml(s.clubId)}"></span><strong>${this.escapeHtml(s.clubName || club?.name || "")}</strong></span></td>
                    <td class="tb-sp">${s.played}</td>
                    <td class="tb-s">${s.won}</td>
                    <td class="tb-u">${s.drawn}</td>
                    <td class="tb-n">${s.lost}</td>
                    <td class="tb-tore nowrap">${s.goalsFor}:${s.goalsAgainst}</td>
                    <td class="tb-diff">${this.vorzeichen(s.goalDiff)}</td>
                    <td class="tb-pkt"><strong>${s.points}</strong>${s.abzug ? `<sup class="tb-abzug" title="${s.abzug} Punkte Abzug">*</sup>` : ""}</td>
                    <td class="tb-form">
                        <div class="form-indicators">
                            ${(s.form || []).map(f => this.formPunkt(f)).join("")}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
        tbody.querySelectorAll(".mini-wappen").forEach(el => {
            const club = state.clubs.find(c => String(c.id) === el.dataset.club);
            if (club) {
                this.setzeWappen(el, club);
                el.textContent = this.vereinsKuerzel(club.name).slice(0, 1);
            }
        });
        // Ein Klick auf einen Verein öffnet seine Details
        this.bindVereinsZeilen(tbody);
        if (legende) {
            const genutzt = [...new Set(zonen.values())];
            legende.innerHTML = genutzt.map(z =>
                `<span class="legende-eintrag"><span class="rang rang-${z}"></span>${this.constructor.ZONEN[z]}</span>`
            ).join("");
        }

        // 2. Spielplan rendern
        const schedule = this.getScheduleForLeague(state, activeComp);
        const totalRounds = schedule.length || state.totalMatchdays;
        const matchday = Math.min(Math.max(1, this.currentFixtureMatchday), Math.max(1, totalRounds));

        document.getElementById("fixtureMatchdayTitle").textContent = `Spieltag ${matchday} von ${totalRounds}`;
        const round = schedule.find(r => r.matchday === matchday);

        if (round) {
            fixturesList.innerHTML = round.matches.map(m => {
                const home = state.clubs.find(c => c.id === m.homeClubId);
                const away = state.clubs.find(c => c.id === m.awayClubId);
                const isUserMatch = home?.id === userClub.id || away?.id === userClub.id;
                const scoreText = m.played ? `${m.homeGoals} : ${m.awayGoals}` : "vs";

                // Ein Derby steht im Spielplan, nicht im Kleingedruckten
                const derby = m.isDerby
                    ? `<div class="fixture-derby">🔥 ${this.escapeHtml(m.derbyTitle || "Derby")}</div>`
                    : "";
                const zuschauer = m.played && m.attendance
                    ? `<div class="fixture-crowd">${m.attendance.toLocaleString("de-DE")} Zuschauer${m.soldOut ? " · ausverkauft" : ""}</div>`
                    : "";

                return `
                    <div class="fixture-card ${isUserMatch ? 'user-match' : ''} ${m.isDerby ? 'derby-match' : ''}">
                        ${derby}
                        <div class="fixture-team home${home ? " vd-link" : ""}" ${home ? `data-club-link="${this.escapeHtml(home.id)}"` : ""}>${this.escapeHtml(home?.name || "Heim")}</div>
                        <div class="fixture-score-badge">${scoreText}</div>
                        <div class="fixture-team away${away ? " vd-link" : ""}" ${away ? `data-club-link="${this.escapeHtml(away.id)}"` : ""}>${this.escapeHtml(away?.name || "Auswärts")}</div>
                        ${zuschauer}
                    </div>
                `;
            }).join("");
            // Auch im Spielplan führt ein Vereinsname zu den Details
            fixturesList.querySelectorAll("[data-club-link]").forEach(el => {
                el.onclick = () => this.showClubDetailsModal(el.dataset.clubLink);
            });
        } else {
            fixturesList.innerHTML = `<div class="text-muted text-center" style="padding:20px;">Für diesen Spieltag liegen keine Partien vor.</div>`;
        }
    },

    /**
     * Das Pokal-Tableau: alle gespielten Runden, die aktuelle oben.
     *
     * Vorher stand hier eine einzige, nie ausgetragene erste Runde - der
     * Wettbewerb bestand aus 32 Paarungen, die nie ein Ergebnis bekamen.
     */
    /**
     * Relegation und Aufstiegs-Playoffs: alle Länder, Runde für Runde, mit
     * Hin- und Rückspiel, Verlängerung und Elfmeterschießen. Der Wettbewerb
     * des eigenen Landes steht oben.
     */
    renderPlayoffs(state, po, tbody, fixturesList, userClub) {
        const titel = document.getElementById("fixtureMatchdayTitle");
        const esc = t => this.escapeHtml(t == null ? "" : String(t));
        const name = id => state.clubs.find(c => c.id === id)?.name || "?";
        if (!po || !Array.isArray(po.wettbewerbe) || !po.wettbewerbe.length) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-muted" style="text-align:center;padding:20px;">In dieser Saison gibt es keine Relegation.</td></tr>`;
            if (fixturesList) fixturesList.innerHTML = "";
            return;
        }
        const land = state.clubs.find(c => c.id === state.userClubId)?.countryId;
        const reihe = [...po.wettbewerbe].sort((a, b) =>
            ((a.ligaId || "").startsWith(land + "_") ? 0 : 1) - ((b.ligaId || "").startsWith(land + "_") ? 0 : 1));
        if (titel) titel.textContent = po.saison === state.seasonYear ? "Relegation und Aufstiegsspiele" : "Relegation und Aufstiegsspiele der Vorsaison";

        const stand = w => {
            const e = w.ergebnis;
            if (!w.fertig || !e) return "läuft";
            if (w.direkt) return `${name(e.aufsteiger)} steigt direkt auf`;
            if (e.absteiger) return `${name(e.aufsteiger)} steigt auf, ${name(e.absteiger)} ab`;
            if (e.gehalten) return `${name(e.gehalten)} bleibt drin`;
            return `${name(e.aufsteiger)} steigt auf`;
        };
        const ergebnis = m => {
            if (!m.played) return "offen";
            let t = `${m.homeGoals} : ${m.awayGoals}`;
            if (Array.isArray(m.verlaengerung)) t += ` <small>(n. V. ${m.homeGoals + m.verlaengerung[0]}:${m.awayGoals + m.verlaengerung[1]})</small>`;
            if (m.penaltyScore) t += ` <small>(${m.penaltyScore[0]}:${m.penaltyScore[1]} i. E.)</small>`;
            return t;
        };
        tbody.innerHTML = reihe.map(w => {
            const kopf = `<tr style="background: rgba(245, 158, 11, 0.15);"><td colspan="10" style="font-weight:700; color:#f59e0b;">⚔️ ${esc(w.name)} · ${esc(stand(w))}</td></tr>`;
            const runden = (w.runden || []).map(r => {
                const zeilen = r.paarungen.map(p => p.spiele.map((m, i) => {
                    const isUser = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                    const weiter = i === p.spiele.length - 1 && p.sieger ? name(p.sieger) : "";
                    return `<tr class="${isUser ? "row-user-club" : ""}">
                        <td colspan="5">${esc(name(m.homeClubId))} – ${esc(name(m.awayClubId))}${p.spiele.length > 1 ? ` <small class="text-muted">${i === 0 ? "Hinspiel" : "Rückspiel"}</small>` : ""}</td>
                        <td colspan="3"><span class="badge ${m.played ? "badge-status-fit" : ""}">${ergebnis(m)}</span></td>
                        <td colspan="2">${esc(weiter)}</td>
                    </tr>`;
                }).join("")).join("");
                return `<tr><td colspan="10" class="text-muted" style="font-size:12px;">${esc(r.name)}</td></tr>${zeilen}`;
            }).join("");
            return kopf + runden;
        }).join("");

        // Spielplan: die eigenen Partien, sonst die des eigenen Landes
        if (fixturesList) {
            const eigene = reihe.filter(w => (w.teilnehmer || []).some(t => t.clubId === userClub?.id));
            const quelle = eigene.length ? eigene : reihe.slice(0, 1);
            const karten = quelle.flatMap(w => (w.runden[w.rundeIndex]?.paarungen || []).flatMap(p => p.spiele)).map(m => {
                const isUserMatch = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                return `<div class="fixture-card ${isUserMatch ? "user-match" : ""}">
                    <div class="fixture-team home">${esc(name(m.homeClubId))}</div>
                    <div class="fixture-score-badge">${m.played ? ergebnis(m) : "vs"}</div>
                    <div class="fixture-team away">${esc(name(m.awayClubId))}</div>
                </div>`;
            });
            fixturesList.innerHTML = karten.join("");
        }
    },

    renderPokalTableau(state, cup, tbody, fixturesList, userClub) {
        const titel = document.getElementById("fixtureMatchdayTitle");
        if (!cup || !Array.isArray(cup.runden)) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-muted" style="text-align:center;padding:20px;">Für diesen Pokal liegt noch kein Tableau vor.</td></tr>`;
            if (fixturesList) fixturesList.innerHTML = "";
            return;
        }

        const aktuelle = cup.runden[cup.rundenIndex] || cup.runden[cup.runden.length - 1];
        const sieger = cup.winnerId ? state.clubs.find(c => c.id === cup.winnerId) : null;

        if (titel) {
            titel.textContent = sieger
                ? `${cup.name}: Sieger ${sieger.name}`
                : `${cup.name}: ${aktuelle?.roundName || "Auslosung"}`;
        }

        // Tabelle: der Weg durch das Turnier, Runde für Runde
        tbody.innerHTML = [...cup.runden].reverse().map(runde => {
            const kopf = `
                <tr style="background: rgba(245, 158, 11, 0.15);">
                    <td colspan="10" style="font-weight:700; color:#f59e0b;">
                        🏆 ${this.escapeHtml(runde.roundName)}
                        ${runde.completed ? "" : " · läuft"}
                    </td>
                </tr>`;

            const zeilen = runde.matches.map(m => {
                const home = state.clubs.find(c => c.id === m.homeClubId);
                const away = state.clubs.find(c => c.id === m.awayClubId);
                const isUser = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                const elfer = m.penaltyScore ? ` <small>(${m.penaltyScore[0]}:${m.penaltyScore[1]} i. E.)</small>` : "";
                const score = m.played ? `${m.homeGoals} : ${m.awayGoals}${elfer}` : "offen";
                const weiter = m.played ? this.siegerName(state, m) : "";
                return `
                    <tr class="${isUser ? 'row-user-club' : ''}">
                        <td colspan="5">${this.escapeHtml(home?.name || "Heim")} – ${this.escapeHtml(away?.name || "Auswärts")}</td>
                        <td colspan="3"><span class="badge ${m.played ? 'badge-status-fit' : ''}">${score}</span></td>
                        <td colspan="2">${this.escapeHtml(weiter)}</td>
                    </tr>`;
            }).join("");

            // Wer ein Freilos hatte, steigt erst in der nächsten Runde ein
            const freilose = (runde.freilose || []).map(id => state.clubs.find(c => c.id === id)?.name).filter(Boolean);
            const freilosZeile = freilose.length ? `
                <tr class="${(runde.freilose || []).includes(userClub?.id) ? 'row-user-club' : ''}">
                    <td colspan="10" class="text-muted">Freilos: ${this.escapeHtml(freilose.join(", "))}</td>
                </tr>` : "";

            return kopf + zeilen + freilosZeile;
        }).join("");

        // Spielplan: die aktuelle Runde als Karten
        if (fixturesList && aktuelle) {
            fixturesList.innerHTML = aktuelle.matches.map(m => {
                const home = state.clubs.find(c => c.id === m.homeClubId);
                const away = state.clubs.find(c => c.id === m.awayClubId);
                const isUserMatch = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                const elfer = m.penaltyScore ? ` (${m.penaltyScore[0]}:${m.penaltyScore[1]} i. E.)` : "";
                const scoreText = m.played ? `${m.homeGoals} : ${m.awayGoals}${elfer}` : "vs";
                return `
                    <div class="fixture-card ${isUserMatch ? 'user-match' : ''}">
                        <div class="fixture-team home">${this.escapeHtml(home?.name || "Heim")}</div>
                        <div class="fixture-score-badge">${scoreText}</div>
                        <div class="fixture-team away">${this.escapeHtml(away?.name || "Auswärts")}</div>
                    </div>`;
            }).join("");
        }
    },

    siegerName(state, match) {
        const cup = this.getCupEngine();
        if (!cup || typeof cup.siegerVon !== "function") return "";
        const club = state.clubs.find(c => c.id === cup.siegerVon(match));
        return club ? `${club.name} weiter` : "";
    },

    /**
     * Europapokal: Gruppentabellen in der Gruppenphase, Tableau in der
     * Endrunde.
     */
    renderEuropapokal(state, comp, tbody, fixturesList, userClub) {
        const titel = document.getElementById("fixtureMatchdayTitle");
        if (!comp) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-muted" style="text-align:center;padding:20px;">Dieser Wettbewerb läuft gerade nicht.</td></tr>`;
            if (fixturesList) fixturesList.innerHTML = "";
            return;
        }

        const inEndrunde = (comp.endrunde || []).length > 0;

        if (inEndrunde) {
            const sieger = comp.winnerId ? state.clubs.find(c => c.id === comp.winnerId) : null;
            if (titel) {
                titel.textContent = sieger
                    ? `${comp.name}: Sieger ${sieger.name}`
                    : `${comp.name} - Endrunde`;
            }
            tbody.innerHTML = [...comp.endrunde].reverse().map(runde => {
                const kopf = `
                    <tr style="background: rgba(56, 189, 248, 0.15);">
                        <td colspan="10" style="font-weight:700; color:#38bdf8;">⭐ ${this.escapeHtml(runde.roundName)}</td>
                    </tr>`;
                const zeilen = runde.matches.map(m => {
                    const home = state.clubs.find(c => c.id === m.homeClubId);
                    const away = state.clubs.find(c => c.id === m.awayClubId);
                    const isUser = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                    const elfer = m.penaltyScore ? ` <small>(${m.penaltyScore[0]}:${m.penaltyScore[1]} i. E.)</small>` : "";
                    return `
                        <tr class="${isUser ? 'row-user-club' : ''}">
                            <td colspan="6">${this.escapeHtml(home?.name || "Heim")} – ${this.escapeHtml(away?.name || "Auswärts")}</td>
                            <td colspan="4"><span class="badge ${m.played ? 'badge-status-fit' : ''}">${m.played ? `${m.homeGoals} : ${m.awayGoals}${elfer}` : "offen"}</span></td>
                        </tr>`;
                }).join("");
                return kopf + zeilen;
            }).join("");

            if (fixturesList) {
                const aktuelle = comp.endrunde[comp.endrundeIndex] || comp.endrunde[comp.endrunde.length - 1];
                fixturesList.innerHTML = (aktuelle?.matches || []).map(m => {
                    const home = state.clubs.find(c => c.id === m.homeClubId);
                    const away = state.clubs.find(c => c.id === m.awayClubId);
                    const isUserMatch = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                    return `
                        <div class="fixture-card ${isUserMatch ? 'user-match' : ''}">
                            <div class="fixture-team home">${this.escapeHtml(home?.name || "Heim")}</div>
                            <div class="fixture-score-badge">${m.played ? `${m.homeGoals} : ${m.awayGoals}` : "vs"}</div>
                            <div class="fixture-team away">${this.escapeHtml(away?.name || "Auswärts")}</div>
                        </div>`;
                }).join("");
            }
            return;
        }

        // Gruppenphase
        tbody.innerHTML = (comp.groups || []).map(g => {
            const kopf = `
                <tr style="background: rgba(56, 189, 248, 0.15);">
                    <td colspan="10" style="font-weight:700; color:#38bdf8;">${this.escapeHtml(comp.name)} - ${this.escapeHtml(g.groupName)}</td>
                </tr>`;
            const zeilen = (g.standings || []).map((s, idx) => {
                const club = state.clubs.find(c => c.id === s.clubId);
                const isUser = s.clubId === userClub?.id;
                return `
                    <tr class="${isUser ? 'row-user-club' : ''}${idx === 1 ? ' zonen-grenze' : ''}">
                        <td class="tb-platz"><span class="rang${idx < 2 ? ' rang-ucl' : ''}">${idx + 1}</span></td>
                        <td class="tb-verein"><strong>${this.escapeHtml(club?.name || s.clubId)}</strong></td>
                        <td class="tb-sp">${s.played}</td>
                        <td class="tb-s">${s.won}</td>
                        <td class="tb-u">${s.drawn}</td>
                        <td class="tb-n">${s.lost}</td>
                        <td class="tb-tore nowrap">${s.goalsFor}:${s.goalsAgainst}</td>
                        <td class="tb-diff">${this.vorzeichen(s.goalsFor - s.goalsAgainst)}</td>
                        <td class="tb-pkt"><strong>${s.points}</strong></td>
                        <td class="tb-form"><span class="badge ${idx < 2 ? 'badge-status-fit' : ''}">${idx < 2 ? 'Weiter' : 'Gruppe'}</span></td>
                    </tr>`;
            }).join("");
            return kopf + zeilen;
        }).join("");

        const spieltag = (comp.spieltage || [])[comp.spieltagIndex || 0]
            || (comp.spieltage || []).find(t => !t.completed)
            || (comp.spieltage || [])[(comp.spieltage || []).length - 1];

        if (titel) titel.textContent = `${comp.name} - ${spieltag?.roundName || "Gruppenphase"}`;

        if (fixturesList) {
            fixturesList.innerHTML = (spieltag?.matches || []).map(m => {
                const home = state.clubs.find(c => c.id === m.homeClubId);
                const away = state.clubs.find(c => c.id === m.awayClubId);
                const isUserMatch = m.homeClubId === userClub?.id || m.awayClubId === userClub?.id;
                return `
                    <div class="fixture-card ${isUserMatch ? 'user-match' : ''}">
                        <div class="fixture-team home">${this.escapeHtml(home?.name || "Heim")}</div>
                        <div class="fixture-score-badge">${m.played ? `${m.homeGoals} : ${m.awayGoals}` : "vs"}</div>
                        <div class="fixture-team away">${this.escapeHtml(away?.name || "Auswärts")}</div>
                    </div>`;
            }).join("")
                || `<div class="text-muted text-center" style="padding:20px;">Für diesen Spieltag liegen keine Partien vor.</div>`;
        }
    },

    /** Liga des Nutzervereins */
    getUserLeagueId(state) {
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        return club?.leagueId || state.userLeagueId || "de_liga_1";
    },

    /** Spielplan einer beliebigen Liga */
    getScheduleForLeague(state, leagueId) {
        if (!leagueId || leagueId === this.getUserLeagueId(state)) return state.schedule || [];
        return (state.otherSchedules && state.otherSchedules[leagueId]) || [];
    },

    /**
     * Baut die Wettbewerbsauswahl aus der tatsächlichen Spielwelt: alle zwölf
     * Ligen, der nationale Pokal und die drei europäischen Wettbewerbe.
     */
    populateCompetitionSelect(state, activeComp) {
        const select = document.getElementById("selectCompetitionView");
        if (!select) return;

        const FLAGS = { de: "🇩🇪", en: "🏴", es: "🇪🇸", it: "🇮🇹", fr: "🇫🇷" };
        const leagues = [...(state.leagues || [])].sort((a, b) =>
            (a.countryId || "").localeCompare(b.countryId || "") || (a.level || 1) - (b.level || 1));

        const options = leagues.map(l =>
            `<option value="${this.escapeHtml(l.id)}">${FLAGS[l.countryId] || "🏆"} ${this.escapeHtml(l.shortName || l.name)}</option>`);

        Object.keys(state.cups || {}).forEach(cupId => {
            const comp = (state.competitions || []).find(c => c.id === cupId);
            const name = state.cups[cupId]?.name || comp?.name || cupId;
            options.push(`<option value="${this.escapeHtml(cupId)}">🏆 ${this.escapeHtml(name)}</option>`);
        });

        [["ucl", "⭐ Champions League"], ["uel", "🌍 Europa League"], ["uecl", "🏆 Conference League"]].forEach(([id, label]) => {
            if (state.europeanCompetitions?.[id]) {
                options.push(`<option value="${id}">${label}</option>`);
            }
        });
        if (state.playoffs || state.playoffsVorjahr) {
            options.push(`<option value="playoffs">⚔️ Relegation & Playoffs${state.playoffs ? "" : " (Vorjahr)"}</option>`);
        }

        const signature = options.length + "|" + (state.seasonYear || 1);
        if (select._competitionSignature !== signature) {
            select.innerHTML = options.join("");
            select._competitionSignature = signature;
        }
        select.value = activeComp;
    },
});
