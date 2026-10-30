/**
 * Das Livespiel als Kachelansicht wie im Vorbild (Stufe 4 der 2D-Simulation).
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 * Auf breiten Bildschirmen liegt das Spielfeld in der Mitte, ringsum Kacheln:
 * links die eigene Aufstellung als Feld mit Trikot, Note, Position und Name,
 * darunter die Bank mit dem Wechselvorschlag des Co-Trainers; oben die
 * Statistik und die Ereignisse; rechts der Gegner und die anderen Plätze.
 * Unten die Leiste mit Kondition und Note jeder Position. Schmalere
 * Bildschirme behalten Feld und Seitenleiste mit Reitern - dieselben Daten,
 * nur gestapelt.
 *
 * Gezeichnet wird nur, was sich geändert hat (je Kachel ein Schlüssel).
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /** Die Mentalität in der Kopfleiste - wie in der Taktik */
    LIVE_MENTALITAETEN: [
        ["very_defensive", "Sehr defensiv"], ["defensive", "Defensiv"], ["balanced", "Ausgewogen"],
        ["offensive", "Offensiv"], ["very_offensive", "Sehr offensiv"]
    ],

    /** Zu Spielbeginn: Zwischenstände vergessen, die Mentalität der eigenen Elf zeigen */
    bereiteKachelnVor(liveMatch) {
        this._lmKachelKeys = {};
        this._kachelSicht = null;
        this._lmVerworfen = new Set();
        const wahl = document.getElementById("lmMentalitaet");
        if (wahl) {
            const seite = liveMatch.userSide;
            wahl.closest(".lm-mentalitaet").hidden = !seite;
            if (seite) wahl.value = liveMatch.clubVon(seite)?.tactics?.mentality || "balanced";
            if (!wahl.dataset.gebunden) {
                wahl.dataset.gebunden = "1";
                wahl.addEventListener("change", () => this.setzeLiveMentalitaet(wahl.value));
            }
        }
        this.bereiteSchnellVor(liveMatch);
        const bank = document.getElementById("lmKBank");
        if (bank && !bank.dataset.gebunden) {
            bank.dataset.gebunden = "1";
            bank.addEventListener("click", (e) => this.kachelBankKlick(e));
        }
        ["lmKElfHome", "lmKElfAway", "lmKStat", "lmKEreignisse", "lmKBank", "lmKErgebnisse", "lmLeiste"]
            .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ""; });
    },

    /** Die Mentalität ändern, ohne das Spiel anzuhalten */
    setzeLiveMentalitaet(wert) {
        const lm = this.app.currentLiveMatch;
        if (!lm || !lm.userSide || lm.isFinished) return;
        lm.updateTactics(lm.userSide, { mentality: wert }, { ohneNeuberechnung: true });
        if (typeof lm.resimulateRemainder === "function") lm.resimulateRemainder();
        const name = (this.LIVE_MENTALITAETEN.find(m => m[0] === wert) || [])[1] || wert;
        this.showToast(`Mentalität: ${name}`, "success");
    },

    /** Schnellanweisungen: nur für die eigene Elf, das Menü einmal gebunden */
    bereiteSchnellVor(liveMatch) {
        const box = document.getElementById("lmSchnell");
        const menu = document.getElementById("lmSchnellMenu");
        if (!box || !menu) return;
        box.hidden = !liveMatch.userSide || typeof liveMatch.schnellAnweisung !== "function";
        box.open = false;
        if (!menu.dataset.gebunden) {
            menu.dataset.gebunden = "1";
            menu.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-schnell]");
                if (!btn) return;
                const [gruppe, option] = btn.dataset.schnell.split(":");
                this.setzeSchnellAnweisung(gruppe, option);
            });
            // Ein Tipp neben das Menü schließt es. Der Pfad statt contains():
            // Der angetippte Knopf ist nach dem Neuzeichnen schon ausgehängt.
            if (typeof document.addEventListener === "function") {
                document.addEventListener("click", (e) => { if (box.open && !e.composedPath().includes(box)) box.open = false; });
            }
        }
        this.renderSchnell(liveMatch);
    },

    /** Die Gruppen mit je zwei Knöpfen; der aktive leuchtet */
    renderSchnell(liveMatch) {
        const menu = document.getElementById("lmSchnellMenu");
        const T = typeof TacticsEngine !== "undefined" ? TacticsEngine : null;
        if (!menu || !T || !liveMatch || !liveMatch.userSide) return;
        const stand = liveMatch.schnellStand(liveMatch.userSide);
        menu.innerHTML = (T.SCHNELL_ANWEISUNGEN || []).map(g => `<div class="lm-schnell-gruppe">
                <div class="lm-schnell-titel">${this.escapeHtml(g.titel)}</div>
                <div class="lm-schnell-wahl">${g.optionen.map(o => {
                    const an = stand[g.key] === o.key;
                    return `<button type="button" class="lm-schnell-btn${an ? " aktiv" : ""}" data-schnell="${g.key}:${o.key}" aria-pressed="${an}" title="${this.escapeHtml(o.hilfe)}"><svg class="ico" aria-hidden="true"><use href="#${o.icon}"/></svg><span>${this.escapeHtml(o.titel)}</span></button>`;
                }).join("")}</div>
            </div>`).join("")
            + `<p class="lm-schnell-hinweis">Wirkt sofort und bis zum Abpfiff. Noch einmal tippen nimmt sie zurück.</p>`;
        const zahl = document.getElementById("lmSchnellZahl");
        if (zahl) {
            const n = Object.keys(stand).length;
            zahl.hidden = n === 0;
            zahl.textContent = String(n);
        }
    },

    /** Eine Schnellanweisung an- oder abschalten, ohne das Spiel anzuhalten */
    setzeSchnellAnweisung(gruppe, option) {
        const lm = this.app.currentLiveMatch;
        if (!lm || !lm.userSide) return;
        const r = lm.schnellAnweisung(lm.userSide, gruppe, option);
        this.showToast(r.message, r.success ? "success" : "error");
        this.renderSchnell(lm);
        // Die Mentalität in der Kopfleiste zeigt, was jetzt gilt
        const wahl = document.getElementById("lmMentalitaet");
        if (wahl) wahl.value = lm.clubVon(lm.userSide)?.tactics?.mentality || "balanced";
    },

    /**
     * Sind die Kacheln zu sehen? Nur dann lohnt das Zeichnen. Die Frage
     * erzwang in jedem Bild eine Layout-Berechnung - auf einem schwachen
     * Handy ein Zwölftel der Rechenzeit. Die Antwort ändert sich nur mit
     * der Fenstergröße, sie gilt deshalb eine halbe Sekunde.
     */
    kachelnSichtbar() {
        const jetzt = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (this._kachelSicht && jetzt - this._kachelSicht.um < 500) return this._kachelSicht.wert;
        const el = document.getElementById("lmKStat");
        const wert = !!el && el.offsetParent !== null;
        this._kachelSicht = { um: jetzt, wert };
        return wert;
    },

    /** Bei jedem Anzeigetakt: jede Kachel, deren Inhalt sich geändert hat */
    renderLiveKacheln(liveMatch) {
        if (!liveMatch || !this.kachelnSichtbar()) return;
        this._lmKachelKeys = this._lmKachelKeys || {};
        this.kachelElf(liveMatch, "home");
        this.kachelElf(liveMatch, "away");
        this.kachelStatistik(liveMatch);
        this.kachelEreignisse(liveMatch);
        this.kachelBank(liveMatch);
        this.kachelErgebnisse(liveMatch);
        this.kachelLeiste(liveMatch);
    },

    /** Neu zeichnen nur, wenn sich der Schlüssel geändert hat */
    _kachelNeu(id, key) {
        if (this._lmKachelKeys[id] === key) return false;
        this._lmKachelKeys[id] = key;
        return true;
    },

    _lmKit(liveMatch, seite) {
        const k = liveMatch.kits?.[seite] || {};
        return { farbe: k.farbe || (seite === "home" ? "#2563eb" : "#e5e7eb"), text: k.text || "#fff", zweit: k.zweit || "#fff" };
    },

    _lmKurz(club) {
        const name = String(club?.name || "");
        return club?.kurz || club?.shortName || name.replace(/^(1\.|FC|SC|SV|VfB|VfL|TSV|SSV|DJK|Rot-Weiß|Borussia)\s+/i, "").slice(0, 12);
    },

    /** Tore, Karten und Wechsel je Spieler aus dem Verlauf */
    _lmMarken(liveMatch, seite) {
        const tore = new Map(), vorlagen = new Map(), rein = new Set();
        (liveMatch.verlauf || []).forEach(e => {
            if (e.team !== seite) return;
            if (e.type === "goal" && e.playerId != null) tore.set(e.playerId, (tore.get(e.playerId) || 0) + 1);
            if (e.type === "goal" && e.assistId != null) vorlagen.set(e.assistId, (vorlagen.get(e.assistId) || 0) + 1);
            if (e.type === "substitution" && e.playerId != null) rein.add(e.playerId);
        });
        return { tore, vorlagen, rein, gelb: new Set(liveMatch.verwarnt?.[seite] || []), rot: new Set(liveMatch.platzverweise?.[seite] || []) };
    },

    /**
     * Die Aufstellung als kleines Feld: das eigene Tor unten, die Spitzen
     * oben, jeder Spieler an seinem Platz in der Formation.
     */
    kachelElf(liveMatch, seite) {
        const el = document.getElementById(seite === "home" ? "lmKElfHome" : "lmKElfAway");
        if (!el) return;
        const spieler = liveMatch.aufDemPlatz(seite) || [];
        const noten = typeof liveMatch.liveNoten === "function" ? liveMatch.liveNoten() : new Map();
        const club = liveMatch.clubVon(seite);
        const key = [spieler.map(p => p.id).join(","), Math.floor((liveMatch.minute || 0) / 2), (liveMatch.verlauf || []).length,
            club?.formation, liveMatch.director?.isSecondHalf].join("|");
        if (!this._kachelNeu(el.id, key)) return;

        const esc = v => this.escapeHtml(String(v ?? ""));
        const kit = this._lmKit(liveMatch, seite);
        const marken = this._lmMarken(liveMatch, seite);
        const dir = liveMatch.director && typeof liveMatch.director.attackDir === "function"
            ? liveMatch.director.attackDir(seite) : (seite === "home" ? 1 : -1);
        const zwischen = (v, a, b) => Math.max(a, Math.min(b, v));
        // Die Grundordnung steht in der eigenen Hälfte (Anstoß) - gezeigt wird
        // sie über das ganze Feld: der Torwart unten, die Spitzen oben
        const lage = spieler.map(p => {
            const p2d = (liveMatch.players2D || []).find(x => x.id === p.id) || {};
            const bx = typeof p2d.baseX === "number" ? p2d.baseX : (p2d.x ?? 50);
            const by = typeof p2d.baseY === "number" ? p2d.baseY : (p2d.y ?? 50);
            // Tiefe vom eigenen Tor aus, quer aus Sicht der Laufrichtung
            return { p, p2d, tiefe: dir > 0 ? bx : 100 - bx, quer: dir > 0 ? by : 100 - by };
        });
        const tiefen = lage.map(l => l.tiefe);
        const tMin = Math.min(...tiefen), tMax = Math.max(...tiefen);
        const punkte = lage.map(({ p, p2d, tiefe, quer }) => {
            const top = tMax - tMin > 1 ? 88 - (tiefe - tMin) / (tMax - tMin) * 76 : 50;
            const left = zwischen(quer, 10, 90);
            const n = noten.get(p.id);
            const icons = [];
            const t = marken.tore.get(p.id) || 0;
            if (t) icons.push(`<i class="lm-ke-ico tor" title="${t} Tor${t > 1 ? "e" : ""}">${t > 1 ? t : ""}</i>`);
            if (marken.vorlagen.get(p.id)) icons.push('<i class="lm-ke-ico vorlage" title="Vorlage"></i>');
            if (marken.rot.has(p.id)) icons.push('<i class="lm-card rot" title="Platzverweis"></i>');
            else if (marken.gelb.has(p.id)) icons.push('<i class="lm-card gelb" title="Gelbe Karte"></i>');
            if (marken.rein.has(p.id)) icons.push('<i class="lm-ke-ico rein" title="eingewechselt">⇄</i>');
            const nachname = String(p.name || "").split(" ").slice(-1)[0];
            return `<div class="lm-ke-sp${marken.rot.has(p.id) ? " off" : ""}" style="left:${left.toFixed(1)}%;top:${top.toFixed(1)}%">
                    <span class="lm-ke-icons">${icons.join("")}</span>
                    <span class="lm-ke-trikot" style="--kit:${esc(kit.farbe)};--kit-text:${esc(kit.text)}">${esc(p2d.number ?? p.number ?? "")}</span>
                    <span class="lm-ke-zeile">${this.liveNoteHtml(n)}<span class="lm-ke-pos">${esc(p2d.pos || p.pos || "")}</span></span>
                    <span class="lm-ke-name" title="${esc(p.name)}">${esc(nachname)}</span>
                </div>`;
        }).join("");
        const eigene = liveMatch.userSide === seite;
        el.innerHTML = `
            <header class="lm-k-kopf">
                <span class="lm-k-titel">Aufstellung</span>
                <span class="lm-k-sub"><span class="lm-kit klein" style="--kit:${esc(kit.farbe)};--kit-2:${esc(kit.zweit)}"></span>${esc(this._lmKurz(club))} · ${esc(club?.formation || "")}${eigene ? " · Du" : ""}</span>
            </header>
            <div class="lm-ke-feld" role="img" aria-label="Aufstellung ${esc(club?.name || "")}">
                <i class="lm-ke-linie mitte"></i><i class="lm-ke-kreis"></i><i class="lm-ke-strafraum unten"></i><i class="lm-ke-strafraum oben"></i>
                ${punkte}
            </div>`;
    },

    /** Statistik wie im Vorbild: die fünf Zahlen, die ein Spiel erzählen */
    kachelStatistik(liveMatch) {
        const el = document.getElementById("lmKStat");
        const st = liveMatch.stats;
        if (!el || !st) return;
        const zeilen = [
            ["Schüsse", st.shots[0], st.shots[1]],
            ["Aufs Tor", st.shotsOnTarget[0], st.shotsOnTarget[1]],
            ["xG", st.xG[0], st.xG[1], v => Number(v).toFixed(2).replace(".", ",")],
            ["Ecken", st.corners[0], st.corners[1]],
            ["Ballbesitz", st.possession[0], st.possession[1], v => `${v} %`]
        ];
        const key = zeilen.map(z => `${z[1]}:${z[2]}`).join("|");
        if (!this._kachelNeu(el.id, key)) return;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const kitH = this._lmKit(liveMatch, "home"), kitA = this._lmKit(liveMatch, "away");
        el.innerHTML = `
            <header class="lm-k-kopf"><span class="lm-k-titel">Statistik</span></header>
            <div class="lm-ks-teams">
                <span><span class="lm-kit klein" style="--kit:${esc(kitH.farbe)};--kit-2:${esc(kitH.zweit)}"></span>${esc(this._lmKurz(liveMatch.homeClub))}</span>
                <span>${esc(this._lmKurz(liveMatch.awayClub))}<span class="lm-kit klein" style="--kit:${esc(kitA.farbe)};--kit-2:${esc(kitA.zweit)}"></span></span>
            </div>
            ${zeilen.map(([label, h, a, fmt]) => {
                const heim = Number(h) || 0, gast = Number(a) || 0, summe = heim + gast;
                const f = fmt || (v => String(v));
                const anteil = summe > 0 ? heim / summe * 100 : 50;
                return `<div class="lm-ks-zeile">
                    <span class="lm-ks-label">${label}</span>
                    <span class="lm-ks-wert">${esc(f(h))}</span>
                    <span class="lm-ks-balken" style="--anteil:${anteil.toFixed(1)}%;--heim:${esc(kitH.farbe)};--gast:${esc(kitA.farbe)}"><i></i><i></i></span>
                    <span class="lm-ks-wert">${esc(f(a))}</span>
                </div>`;
            }).join("")}`;
    },

    /** Tore, Karten und Wechsel - Heim links, Gast rechts, das Neueste oben */
    kachelEreignisse(liveMatch) {
        const el = document.getElementById("lmKEreignisse");
        if (!el) return;
        const verlauf = liveMatch.verlauf || [];
        const key = `${verlauf.length}|${liveMatch.homeScore}:${liveMatch.awayScore}`;
        if (!this._kachelNeu(el.id, key)) return;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const name = id => {
            const p = id != null ? MatchEngine.findPlayer(liveMatch.allPlayers, id) : null;
            return p ? String(p.name).split(" ").slice(-1)[0] : "";
        };
        const kurz = n => String(n || "").split(" ").slice(-1)[0];
        const eintraege = verlauf
            .filter(e => ["goal", "red_card", "yellow_card", "substitution"].includes(e.type))
            .slice().reverse().slice(0, 14)
            .map(e => {
                const min = `${Math.max(1, Math.round(e.minute))}'`;
                let ico = "", text = "";
                if (e.type === "goal") {
                    ico = '<i class="lm-ke-ico tor"></i>';
                    const v = name(e.assistId);
                    text = `<b>${esc(kurz(e.name))}</b>${e.elfmeter ? " (Elfmeter)" : ""}${v ? ` <span class="lm-ke-vorlage">${esc(v)}</span>` : ""}`;
                } else if (e.type === "red_card") {
                    ico = '<i class="lm-card rot"></i>'; text = esc(kurz(e.name));
                } else if (e.type === "yellow_card") {
                    ico = `<i class="lm-card ${e.zweiteGelbe ? "gelbrot" : "gelb"}"></i>`; text = esc(kurz(e.name));
                } else {
                    ico = '<i class="lm-ke-ico rein">⇄</i>';
                    text = `${esc(kurz(e.name))} <span class="lm-ke-vorlage">für ${esc(kurz(e.outName))}</span>`;
                }
                return `<div class="lm-kv ${e.team === "away" ? "away" : "home"}${e.type === "goal" ? " tor" : ""}">${ico}<span class="lm-kv-min">${min}</span><span class="lm-kv-text">${text}</span></div>`;
            }).join("");
        el.innerHTML = `
            <header class="lm-k-kopf"><span class="lm-k-titel">Ereignisse</span></header>
            <div class="lm-kv-stand">
                <span>${esc(this._lmKurz(liveMatch.homeClub))}</span>
                <b>${liveMatch.homeScore} : ${liveMatch.awayScore}</b>
                <span>${esc(this._lmKurz(liveMatch.awayClub))}</span>
            </div>
            <div class="lm-kv-liste">${eintraege || '<div class="lm-k-leer">Noch nichts passiert</div>'}</div>`;
    },

    /** Positionsgruppe für den passenden Ersatz */
    _lmGruppe(pos) {
        const p = String(pos || "").toUpperCase();
        if (p === "TW" || p === "GK") return "tw";
        if (/^(IV|LV|RV|LIV|RIV|LAV|RAV|AV|V)/.test(p)) return "abwehr";
        if (/^(ST|MS|LA|RA|LF|RF|HS|LS|RS)/.test(p)) return "angriff";
        return "mitte";
    },

    /**
     * Die Bank: Wechsel übrig, angemeldete Wechsel und der Vorschlag des
     * Co-Trainers - mit einem Tipp ausgeführt, wie im Vorbild.
     */
    kachelBank(liveMatch) {
        const el = document.getElementById("lmKBank");
        if (!el) return;
        const seite = liveMatch.userSide || "home";
        const stand = typeof liveMatch.wechselStand === "function" ? liveMatch.wechselStand(seite) : null;
        const hinweise = typeof liveMatch.coTrainerHinweise === "function" && liveMatch.userSide
            ? liveMatch.coTrainerHinweise(seite) : [];
        const offen = (liveMatch.angemeldeteWechsel || []).filter(w => w.side === seite);
        const bank = liveMatch.bankSpieler(seite) || [];
        const aufPlatz = liveMatch.aufDemPlatz(seite) || [];
        // Ein Vorschlag: der erste wichtige Hinweis zu einem Spieler, dazu der beste freie Ersatz für seinen Platz
        let vorschlag = null;
        if (stand && stand.frei > 0 && !liveMatch.isFinished) {
            const belegt = new Set(offen.map(w => w.inId));
            const raus = new Set(offen.map(w => w.outId));
            hinweise.filter(h => h.gewicht >= 2 && h.spielerId != null && ["kondition", "verletzung", "note", "gelb"].includes(h.art))
                .some(h => {
                    const schluessel = `${h.art}:${h.spielerId}`;
                    if (this._lmVerworfen.has(schluessel) || raus.has(h.spielerId)) return false;
                    const alt = aufPlatz.find(p => p.id === h.spielerId);
                    if (!alt) return false;
                    const p2d = (liveMatch.players2D || []).find(x => x.id === alt.id);
                    const gruppe = this._lmGruppe(p2d?.pos || alt.pos);
                    const ersatz = bank.filter(b => !belegt.has(b.id) && this._lmGruppe(b.pos) === gruppe)
                        .sort((a, b) => (b.overall || 0) - (a.overall || 0))[0];
                    if (!ersatz) return false;
                    vorschlag = { schluessel, raus: alt, rein: ersatz, text: h.text };
                    return true;
                });
        }
        const key = [stand && `${stand.genutzt}/${stand.angemeldet}/${stand.frei}`, offen.map(w => `${w.outId}>${w.inId}`).join(","),
            vorschlag ? `${vorschlag.schluessel}>${vorschlag.rein.id}` : "", hinweise.filter(h => h.gewicht >= 2).map(h => h.text).join("|"),
            liveMatch.isFinished].join("#");
        if (!this._kachelNeu(el.id, key)) return;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const name = id => esc(MatchEngine.findPlayer(liveMatch.allPlayers, id)?.name || "?");
        const max = liveMatch.maxSubstitutions || 5;
        const genutzt = stand ? stand.genutzt + stand.angemeldet : 0;
        const striche = Array.from({ length: max }, (_, i) => `<i class="${i < genutzt ? "voll" : ""}"></i>`).join("");
        let inhalt;
        if (!liveMatch.userSide) {
            inhalt = `<div class="lm-k-leer">${bank.length} Spieler auf der Bank</div>`;
        } else if (vorschlag) {
            inhalt = `<div class="lm-kb-vorschlag">
                    <div class="lm-kb-art"><i class="lm-ke-ico rein">⇄</i> Wechselvorschlag</div>
                    <div class="lm-kb-text"><b>${esc(vorschlag.rein.name)}</b> für <b>${esc(vorschlag.raus.name)}</b></div>
                    <div class="lm-kb-grund">${esc(vorschlag.text)}</div>
                    <div class="lm-kb-knoepfe">
                        <button type="button" class="btn btn-sm btn-primary" data-lm-wechsel="${esc(vorschlag.raus.id)}|${esc(vorschlag.rein.id)}"><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg> Ausführen</button>
                        <button type="button" class="btn btn-sm btn-secondary" data-lm-verwerfen="${esc(vorschlag.schluessel)}" aria-label="Vorschlag verwerfen">✕</button>
                    </div>
                </div>`;
        } else {
            const wichtig = hinweise.filter(h => h.gewicht >= 2)[0];
            inhalt = wichtig ? `<div class="lm-kb-grund">${esc(wichtig.text)}</div>` : '<div class="lm-k-leer">Der Co-Trainer hat nichts anzumerken.</div>';
        }
        el.innerHTML = `
            <header class="lm-k-kopf">
                <span class="lm-k-titel">Bank</span>
                <span class="lm-k-sub">Wechsel ${genutzt}/${max} <span class="lm-kb-striche">${striche}</span></span>
            </header>
            ${offen.length ? `<div class="lm-kb-offen">${offen.map(w => `⇄ ${name(w.inId)} für ${name(w.outId)}`).join("<br>")}<span>bei der nächsten Unterbrechung</span></div>` : ""}
            ${inhalt}
            ${liveMatch.userSide ? '<button type="button" class="btn btn-sm lm-kb-seitenlinie" data-lm-seitenlinie="1"><svg class="ico" aria-hidden="true"><use href="#i-clipboard"/></svg> Seitenlinie</button>' : ""}`;
    },

    kachelBankKlick(e) {
        const lm = this.app.currentLiveMatch;
        if (!lm) return;
        const wechsel = e.target.closest("[data-lm-wechsel]");
        if (wechsel) {
            const [raus, rein] = wechsel.dataset.lmWechsel.split("|");
            const id = (v) => {
                const p = MatchEngine.findPlayer(lm.allPlayers, v) || MatchEngine.findPlayer(lm.allPlayers, Number(v));
                return p ? p.id : v;
            };
            const r = lm.wechselAnmelden(lm.userSide, id(raus), id(rein));
            this.showToast(r.success ? (lm.istHalbzeitpause() ? "Der Wechsel kommt zum Wiederanpfiff." : "Wechsel angemeldet - bei der nächsten Unterbrechung.") : r.message,
                r.success ? "success" : "error");
            this._lmKachelKeys.lmKBank = null;
            return;
        }
        const weg = e.target.closest("[data-lm-verwerfen]");
        if (weg) {
            this._lmVerworfen.add(weg.dataset.lmVerwerfen);
            this._lmKachelKeys.lmKBank = null;
            return;
        }
        if (e.target.closest("[data-lm-seitenlinie]")) document.getElementById("btnLmCoaching")?.click();
    },

    /** Die anderen Plätze des Spieltags (Konferenz) */
    kachelErgebnisse(liveMatch) {
        const el = document.getElementById("lmKErgebnisse");
        if (!el) return;
        const konf = this._konferenz;
        const engine = typeof this.getKonferenzEngine === "function" ? this.getKonferenzEngine() : null;
        const minute = liveMatch.isFinished ? 999 : (liveMatch.minute || 0);
        const spiele = konf && engine ? engine.stand(konf, minute, liveMatch.isFinished) : [];
        const key = spiele.map(s => `${s.heim}:${s.gast}`).join("|") + `#${spiele.length}`;
        if (!this._kachelNeu(el.id, key)) return;
        const esc = v => this.escapeHtml(String(v ?? ""));
        el.innerHTML = `
            <header class="lm-k-kopf"><span class="lm-k-titel">Andere Plätze</span>${konf ? `<span class="lm-k-sub">${konf.spieltag}. Spieltag</span>` : ""}</header>
            <div class="lm-kr-liste">${spiele.length ? spiele.map(s => `<div class="lm-kr-spiel">
                    <span class="lm-kr-heim">${esc(s.partie.heim)}</span>
                    <span class="lm-kr-erg">${s.heim} - ${s.gast}</span>
                    <span class="lm-kr-gast">${esc(s.partie.gast)}</span>
                </div>`).join("") : '<div class="lm-k-leer">Heute keine Parallelspiele</div>'}</div>`;
    },

    /** Unten: jede Position der eigenen Elf mit Kondition und Note */
    kachelLeiste(liveMatch) {
        const el = document.getElementById("lmLeiste");
        if (!el) return;
        const seite = liveMatch.userSide || "home";
        const spieler = liveMatch.aufDemPlatz(seite) || [];
        const noten = typeof liveMatch.liveNoten === "function" ? liveMatch.liveNoten() : new Map();
        const p2d = id => (liveMatch.players2D || []).find(x => x.id === id) || {};
        // Nach einem Zuruf: wer zulegt, wer genervt ist (LiveMatchDirector.zurufAnSpieler)
        const zuruf = s => s.zuruf ? (s.zuruf.r >= 0.75 ? "zu" : (s.zuruf.r <= -0.1 ? "genervt" : null)) : null;
        const key = spieler.map(p => `${p.id}:${Math.round((p2d(p.id).freshness ?? 1) * 20)}:${noten.get(p.id)?.note?.toFixed(1)}:${zuruf(p2d(p.id))}`).join("|");
        if (!this._kachelNeu(el.id, key)) return;
        const esc = v => this.escapeHtml(String(v ?? ""));
        const stand = typeof liveMatch.wechselStand === "function" ? liveMatch.wechselStand(seite) : null;
        const max = liveMatch.maxSubstitutions || 5;
        el.innerHTML = `
            <span class="lm-ll-wechsel" title="Wechsel">${stand ? `${stand.frei}/${max} Wechsel` : ""}</span>
            ${spieler.map(p => {
                const s = p2d(p.id);
                const fit = Math.round((s.freshness ?? 1) * 100);
                const farbe = fit >= 86 ? "gut" : fit >= 74 ? "mittel" : "schlecht";
                const z = zuruf(s);
                const zText = z === "zu" ? " · legt nach dem Zuruf zu" : (z === "genervt" ? " · vom Zuruf genervt" : "");
                return `<span class="lm-ll-pos" title="${esc(p.name)} · Kondition ${fit} %${zText}">
                    <span class="lm-ll-kurz">${esc(s.pos || p.pos || "")}</span>
                    ${z ? `<span class="lm-ll-zuruf ${z}" aria-label="${z === "zu" ? "legt zu" : "genervt"}">${z === "zu" ? "▲" : "▼"}</span>` : ""}
                    <svg class="lm-ll-herz ${farbe}" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14.2 2.3 8.6A3.4 3.4 0 0 1 7.1 3.8L8 4.7l.9-.9a3.4 3.4 0 0 1 4.8 4.8z"/></svg>
                    ${this.liveNoteHtml(noten.get(p.id))}
                </span>`;
            }).join("")}`;
    }
});
