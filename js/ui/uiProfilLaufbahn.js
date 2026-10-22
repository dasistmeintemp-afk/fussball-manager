/**
 * Spielerprofil: der Reiter Laufbahn als Kacheln, wie im Vorbild.
 *
 * Teil des UIManager: Die Methoden hängen sich an UIManager.prototype und
 * verhalten sich genau so, als stünden sie in der Klasse.
 *
 *   oben  - Biografie, Karrierestatistik Saison für Saison mit Wappen, das
 *           Bild in den Medien
 *   unten - Bezugspersonen (Mentor, Schützlinge, Landsleute im Kader,
 *           frühere Mitspieler), Vereine, die ihm etwas bedeuten,
 *           Nationalität mit Ausbildung, Pass, Arbeitserlaubnis und
 *           Sprachen, Meilensteine mit Auszeichnungen, Titeln, Wechseln und
 *           Länderspielen
 *
 * Erfunden wird nichts: Jede Zeile kommt aus dem Spielstand. Was das Spiel
 * erst seit dem Start kennt (Laufbahn, Länderspiele), steht ab dann da.
 */
"use strict";

Object.assign(((typeof window !== "undefined" && window.UIManager)
    || require("./uiManager.js").UIManager).prototype, {

    /** Muttersprache nach Nationalität */
    PROFIL_SPRACHE: {
        Deutschland: "Deutsch", "Österreich": "Deutsch", Schweiz: "Deutsch", England: "Englisch", Schottland: "Englisch",
        Wales: "Englisch", Nordirland: "Englisch", Irland: "Englisch", USA: "Englisch", Kanada: "Englisch", Australien: "Englisch",
        Ghana: "Englisch", Nigeria: "Englisch", Gambia: "Englisch", Frankreich: "Französisch", Senegal: "Französisch",
        "Elfenbeinküste": "Französisch", Mali: "Französisch", Kamerun: "Französisch", "DR Kongo": "Französisch", Guinea: "Französisch",
        "Burkina Faso": "Französisch", Benin: "Französisch", Spanien: "Spanisch", Argentinien: "Spanisch", Uruguay: "Spanisch",
        Kolumbien: "Spanisch", Chile: "Spanisch", Paraguay: "Spanisch", Mexiko: "Spanisch", Peru: "Spanisch", Venezuela: "Spanisch",
        Ecuador: "Spanisch", Brasilien: "Portugiesisch", Portugal: "Portugiesisch", Angola: "Portugiesisch", "Kap Verde": "Portugiesisch",
        Italien: "Italienisch", Niederlande: "Niederländisch", Belgien: "Niederländisch", "Curaçao": "Niederländisch", Suriname: "Niederländisch",
        "Türkei": "Türkisch", Marokko: "Arabisch", Algerien: "Arabisch", Tunesien: "Arabisch", "Ägypten": "Arabisch", Libyen: "Arabisch",
        Kroatien: "Kroatisch", "Dänemark": "Dänisch", Polen: "Polnisch", Norwegen: "Norwegisch", Serbien: "Serbisch",
        "Bosnien-Herzegowina": "Bosnisch", Bosnien: "Bosnisch", Japan: "Japanisch", Albanien: "Albanisch", Kosovo: "Albanisch",
        Schweden: "Schwedisch", Ungarn: "Ungarisch", Slowenien: "Slowenisch", Tschechien: "Tschechisch", Slowakei: "Slowakisch",
        "Südkorea": "Koreanisch", Finnland: "Finnisch", Griechenland: "Griechisch", Armenien: "Armenisch", Ukraine: "Ukrainisch"
    },

    /** Landessprache des Vereinslandes */
    PROFIL_LANDESSPRACHE: { de: "Deutsch", en: "Englisch", es: "Spanisch", it: "Italienisch", fr: "Französisch", nl: "Niederländisch",
        pt: "Portugiesisch", tr: "Türkisch", at: "Deutsch", ch: "Deutsch", be: "Niederländisch", sc: "Englisch", dk: "Dänisch" },

    /** Wer im Satz "aus ..." einen Artikel braucht */
    PROFIL_LAND_ARTIKEL: { "Türkei": "der Türkei", Schweiz: "der Schweiz", Niederlande: "den Niederlanden", USA: "den USA",
        "Elfenbeinküste": "der Elfenbeinküste", "DR Kongo": "der DR Kongo", Slowakei: "der Slowakei", Ukraine: "der Ukraine" },

    /** Die Position als Person, für die Biografie */
    PROFIL_ROLLE: { TW: "Torhüter", IV: "Innenverteidiger", LV: "Linksverteidiger", RV: "Rechtsverteidiger",
        DM: "defensiver Mittelfeldspieler", ZM: "zentraler Mittelfeldspieler", LM: "linker Mittelfeldspieler",
        RM: "rechter Mittelfeldspieler", OM: "offensiver Mittelfeldspieler", LA: "Linksaußen", RA: "Rechtsaußen", ST: "Stürmer" },

    _pfK(titel, icon, inhalt, klasse = "") {
        return `
            <div class="dash-card pf-kachel ${klasse}">
                <h4 class="gs-titel"><svg class="ico h-ico" aria-hidden="true"><use href="#${icon}"/></svg>${this.escapeHtml(titel)}</h4>
                ${inhalt}
            </div>`;
    },

    _pfFlagge(nationality) {
        const nation = typeof PlayerGenerator !== "undefined" && typeof PlayerGenerator.landZuNation === "function"
            ? PlayerGenerator.landZuNation(nationality) : null;
        return nation && typeof this.flaggeVon === "function" ? this.flaggeVon(nation) : "";
    },

    _pfVerein(state, id) {
        return (state.clubs || []).find(c => c.id === id) || null;
    },

    /** Saison als Jahreszahl: "25/26" - Saison 1 beginnt im Jahr des Kalenderstarts */
    profilSaisonText(saison) {
        const start = Number(String(this.app.state.calendar?.[0]?.date || "").slice(-4));
        if (!start) return `Saison ${saison}`;
        const j = start + (saison - 1);
        return `${String(j).slice(-2)}/${String(j + 1).slice(-2)}`;
    },

    /**
     * Bezugspersonen aus dem Spielstand: Mentor und Schützlinge, Landsleute
     * im Kader und frühere Mitspieler (dieselbe Saison beim selben Verein,
     * heute anderswo).
     */
    profilBezugspersonen(state, player) {
        const alle = state.players || [];
        const mentor = player.mentorId != null ? alle.find(p => String(p.id) === String(player.mentorId)) || null : null;
        const schuetzlinge = alle.filter(p => p.mentorId != null && String(p.mentorId) === String(player.id));
        const landsleute = player.clubId ? alle.filter(p => p.clubId === player.clubId && p.id !== player.id
            && p.nationality === player.nationality && !p.reserve) : [];
        // Frühere Mitspieler: aus den archivierten Laufbahnzeilen
        const stationen = new Set((Array.isArray(player.laufbahn) ? player.laufbahn : [])
            .concat(player.laufbahnTeile || []).filter(z => z[1] !== player.clubId).map(z => `${z[0]}|${z[1]}`));
        const ehemalige = stationen.size ? alle.filter(p => p.id !== player.id && p.clubId !== player.clubId
            && (Array.isArray(p.laufbahn) ? p.laufbahn : []).concat(p.laufbahnTeile || []).some(z => stationen.has(`${z[0]}|${z[1]}`))) : [];
        return { mentor, schuetzlinge, landsleute, ehemalige };
    },

    /** Die drei besten Werte mit Namen - nur, was man über ihn weiß */
    profilStaerken(player, n = 3) {
        const gen = typeof PlayerGenerator !== "undefined" ? PlayerGenerator : null;
        const name = (k) => ({ passing: "Passspiel", dribbling: "Dribbling", technique: "Technik", vision: "Übersicht", positioning: "Stellungsspiel",
            pace: "Schnelligkeit", stamina: "Ausdauer", reflexes: "Reflexe", handling: "Fangsicherheit", oneOnOne: "Eins gegen eins", kicking: "Abschlag" })[k]
            || gen?.DETAILWERTE?.[k]?.name || gen?.KOPF_NAMEN?.[k] || null;
        const wert = (k) => typeof player[k] === "number" ? player[k] : (gen?.DETAILWERTE?.[k] && typeof gen.detailWert === "function" ? gen.detailWert(player, k) : null);
        const keys = player.pos === "TW"
            ? ["reflexes", "handling", "oneOnOne", "positioning", "kicking", "aerialReach", "commandOfArea", "rushingOut"]
            : ["passing", "dribbling", "technique", "vision", "positioning", "pace", "stamina", ...(gen?.KOPFWERTE || []),
                ...(gen && typeof gen.detailSchluessel === "function" ? ["technik", "kopf", "koerper"].flatMap(g => gen.detailSchluessel(player, g)) : [])];
        return [...new Set(keys)].map(k => ({ k, name: name(k), w: wert(k) })).filter(e => e.name && typeof e.w === "number")
            .sort((a, b) => b.w - a.w).slice(0, n).map(e => e.name);
    },

    /** Die Biografie: ein paar Sätze aus dem, was der Spielstand weiß */
    profilBiografie(state, player, ctx = {}) {
        const { isUserClub, confidence = 100 } = ctx;
        const club = this._pfVerein(state, player.clubId);
        const liga = club ? (state.leagues || []).find(l => l.id === club.leagueId) : null;
        const rolle = this.PROFIL_ROLLE[player.pos] || "Spieler";
        const land = player.nationality ? (this.PROFIL_LAND_ARTIKEL[player.nationality] || player.nationality) : null;
        const saetze = [];
        saetze.push(`${player.name} ist ein ${player.age}-jähriger ${rolle}${land ? ` aus ${land}` : ""}.`);
        if (club) {
            const ende = typeof this.vertragsEnde === "function" ? this.vertragsEnde(player) : null;
            const seit = typeof player.vereinSeit === "number" ? ` seit der Saison ${this.profilSaisonText(Math.floor(player.vereinSeit / 1000))}` : "";
            saetze.push(`Er spielt${seit} für ${club.name}${liga ? ` (${liga.shortName || liga.name})` : ""}${ende ? `, sein Vertrag läuft bis zum ${ende}` : ""}.`);
            const kader = (state.players || []).filter(p => p.clubId === club.id && !p.reserve);
            const rang = kader.filter(p => (p.overall || 0) > (player.overall || 0)).length;
            const stellung = isUserClub && player.squadRole ? player.squadRole
                : (rang < 3 ? "einer der Leistungsträger" : (rang < 11 ? "Stammspieler" : (rang < 18 ? "Ergänzungsspieler" : "Perspektivspieler")));
            if (!isUserClub || player.squadRole) saetze.push(`Im Kader gilt er als ${stellung}.`);
        } else {
            saetze.push("Zurzeit ist er ohne Verein und kann ablösefrei verpflichtet werden.");
        }
        if (isUserClub || confidence >= 55) {
            const staerken = this.profilStaerken(player);
            if (staerken.length) saetze.push(`Seine Stärken: ${staerken.slice(0, -1).join(", ")}${staerken.length > 1 ? " und " : ""}${staerken[staerken.length - 1]}.`);
        } else {
            saetze.push("Was er genau kann, weiß nur, wer ihn beobachten lässt.");
        }
        const lb = typeof LaufbahnEngine !== "undefined" ? LaufbahnEngine.tabelle(state, player) : null;
        if (lb && lb.summe.spiele > 0) {
            const vereine = new Set(lb.zeilen.map(z => z.clubId)).size;
            saetze.push(`Seit dem Spielstart bestritt er ${lb.summe.spiele} Pflichtspiele mit ${lb.summe.tore} ${lb.summe.tore === 1 ? "Tor" : "Toren"} und ${lb.summe.vorlagen} ${lb.summe.vorlagen === 1 ? "Vorlage" : "Vorlagen"}${vereine > 1 ? ` für ${vereine} Vereine` : ""}.`);
        }
        if (player.laenderspiele > 0) {
            saetze.push(`Für ${player.nationality} lief er ${player.laenderspiele}-mal auf und traf ${player.laenderspielTore || 0}-mal.`);
        }
        const preise = typeof AuszeichnungEngine !== "undefined" && typeof AuszeichnungEngine.preiseVon === "function" ? AuszeichnungEngine.preiseVon(player) : [];
        if (preise.length) {
            const namen = [...new Set(preise.map(p => p.name))];
            saetze.push(`Ausgezeichnet wurde er als ${namen.slice(0, 3).join(", ")}${namen.length > 3 ? " und mehr" : ""}.`);
        }
        return saetze;
    },

    /** Das Bild in den Medien: Bekanntheit, Form und Gerüchte */
    profilMedienbild(state, player) {
        const daten = typeof this.profilFormDaten === "function" ? this.profilFormDaten(player, 6) : [];
        const schnitt = daten.length ? daten.reduce((s, d) => s + d.note, 0) / daten.length : null;
        const bekannt = typeof this.bekanntheitWort === "function" ? this.bekanntheitWort(player) : "";
        let urteil = "Kaum ein Thema";
        if (player.wechselwunsch) urteil = "Wechselgerüchte";
        else if (schnitt !== null && schnitt >= 7.3) urteil = "In aller Munde";
        else if (schnitt !== null && schnitt >= 6.9) urteil = "Lob der Presse";
        else if (schnitt !== null && schnitt <= 6.2) urteil = "In der Kritik";
        else if (player.injuredWeeks > 4) urteil = "Lange verletzt";
        else if (/Weltweit|International/.test(bekannt)) urteil = "Viel beachtet";
        return { urteil, bekannt, schnitt };
    },

    /** Meilensteine: Auszeichnungen, Titel mit seinem Verein, Wechsel, Länderspiele, runde Zahlen */
    profilMeilensteine(state, player) {
        const preise = typeof AuszeichnungEngine !== "undefined" && typeof AuszeichnungEngine.preiseVon === "function" ? AuszeichnungEngine.preiseVon(player) : [];
        const lb = typeof LaufbahnEngine !== "undefined" ? LaufbahnEngine.tabelle(state, player) : { zeilen: [], summe: { spiele: 0, tore: 0 } };
        // Titel: was ein Verein in einer Saison gewann, in der er dort spielte
        const stationen = new Set(lb.zeilen.map(z => `${z.saison}|${z.clubId}`));
        const titel = [];
        Object.entries(state.chronik || {}).forEach(([clubId, c]) => (c?.titel || []).forEach(t => {
            if (stationen.has(`${t.saison}|${clubId}`)) titel.push({ name: t.wettbewerb, saison: t.saison, verein: this._pfVerein(state, clubId)?.name || "" });
        }));
        const wechsel = Math.max(0, new Set(lb.zeilen.map(z => z.clubId)).size - 1);
        const runde = [];
        [100, 200, 300, 400, 500].forEach(n => { if (lb.summe.spiele >= n) runde.push(`${n} Pflichtspiele`); });
        [50, 100, 150, 200].forEach(n => { if (lb.summe.tore >= n) runde.push(`${n} Tore`); });
        return { preise, titel, wechsel, runde, laenderspiele: player.laenderspiele || 0 };
    },

    // ------------------------------------------------------------ Kacheln

    /** Bezugspersonen, Vereine, Nationalität und Medien: je eine Kachel */
    profilPersoenlichKacheln(player, ctx) {
        const state = this.app.state;
        const { isUserClub, confidence = 100 } = ctx;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const zeile = (l, w) => `<div class="pf-zeile"><span>${esc(l)}</span><strong>${w}</strong></div>`;
        const club = this._pfVerein(state, player.clubId);
        const kacheln = {};

        // Bezugspersonen
        const b = this.profilBezugspersonen(state, player);
        const namen = (liste, max = 4) => liste.slice(0, max).map(p => `<button type="button" class="pf-name" data-pf-spieler="${esc(p.id)}">${esc(p.name)}</button>`).join(", ")
            + (liste.length > max ? ` <span class="text-muted">+${liste.length - max}</span>` : "");
        const gruppen = [
            ["Mentor", b.mentor ? [b.mentor] : []], ["Schützlinge", b.schuetzlinge],
            ["Landsleute im Kader", b.landsleute], ["Frühere Mitspieler", b.ehemalige]
        ];
        const zahl = (b.mentor ? 1 : 0) + b.schuetzlinge.length + b.landsleute.length + b.ehemalige.length;
        kacheln.personen = (this._pfK("Bezugspersonen", "i-users", `
            <div class="pf-gross">${zahl} ${zahl === 1 ? "Person" : "Personen"}</div>
            ${gruppen.map(([l, liste]) => `<div class="pf-zeile pf-zeile-lang"><span>${esc(l)}</span><strong>${liste.length}</strong>${liste.length ? `<div class="pf-namen">${namen(liste)}</div>` : ""}</div>`).join("")}`));

        // Vereine, die ihm etwas bedeuten
        const lb = typeof LaufbahnEngine !== "undefined" ? LaufbahnEngine.tabelle(state, player) : { zeilen: [] };
        const jeVerein = new Map();
        lb.zeilen.forEach(z => jeVerein.set(z.clubId, (jeVerein.get(z.clubId) || 0) + z.spiele));
        const meiste = [...jeVerein].sort((x, y) => y[1] - x[1])[0];
        const ausbildung = player.ausgebildetVon ? this._pfVerein(state, player.ausgebildetVon) : null;
        const jugend = player.eigengewaechsVon ? this._pfVerein(state, player.eigengewaechsVon) : null;
        const vereinZeile = (l, c, extra = "") => c ? `<div class="pf-verein-zeile"><span class="pf-verein-art">${esc(l)}</span>${this.wappenHtml ? this.wappenHtml(c, "pf-wappen") : ""}<button type="button" class="pf-name" data-pf-verein="${esc(c.id)}">${esc(c.name)}</button>${extra}</div>` : "";
        const vereine = [
            jugend ? vereinZeile("Aus der Jugend von", jugend) : "",
            ausbildung && ausbildung !== jugend ? vereinZeile("Ausgebildet bei", ausbildung) : "",
            meiste && meiste[1] > 0 ? vereinZeile("Die meisten Spiele für", this._pfVerein(state, meiste[0]), ` <small>${meiste[1]}</small>`) : "",
            club ? vereinZeile("Heute bei", club) : ""
        ].filter(Boolean);
        kacheln.vereine = (this._pfK("Vereine", "i-shield", vereine.length ? vereine.join("") : `<p class="pf-klein">Vereinslos.</p>`));

        // Nationalität: Pass, Ausbildung, Arbeitserlaubnis, Sprachen
        const kr = typeof KaderregelEngine !== "undefined" ? KaderregelEngine : null;
        const punkte = [];
        if (club && kr) {
            const a = kr.ausbildung(state, player, club);
            if (a === "verein") punkte.push(`Im Verein ausgebildet (${club.name})`);
            else if (a === "land") punkte.push("Im Land seines Vereins ausgebildet");
        }
        if (kr && Array.isArray(kr.EU)) punkte.push(kr.EU.includes(player.nationality) ? "EU-Bürger" : "Kein EU-Pass");
        const userClub = this._pfVerein(state, state.userClubId);
        const ae = typeof ArbeitserlaubnisEngine !== "undefined" && userClub && ArbeitserlaubnisEngine.gilt(userClub) && !isUserClub
            ? ArbeitserlaubnisEngine.pruefe(state, player, userClub) : null;
        if (ae && ae.noetig) punkte.push(ae.erteilt ? "Arbeitserlaubnis für England: ja" : "Arbeitserlaubnis für England: nein");
        const sprachen = [this.PROFIL_SPRACHE[player.nationality]];
        const landesSprache = club ? this.PROFIL_LANDESSPRACHE[club.countryId] : null;
        const lange = typeof player.vereinSeit !== "number" || ((state.seasonYear || 1) - Math.floor(player.vereinSeit / 1000)) >= 2;
        if (landesSprache && lange) sprachen.push(landesSprache);
        const sprachText = [...new Set(sprachen.filter(Boolean))].join(", ");
        kacheln.nation = (this._pfK("Nationalität", "i-flag", `
            <div class="pf-gross">${this._pfFlagge(player.nationality)} ${esc(player.nationality || "unbekannt")}</div>
            <ul class="pf-punkte">${punkte.map(t => `<li>${esc(t)}</li>`).join("")}${player.laenderspiele ? `<li>${player.laenderspiele} Länderspiele, ${player.laenderspielTore || 0} Tore</li>` : ""}</ul>
            ${sprachText ? `<p class="pf-klein pf-fuss">Sprachen: ${esc(sprachText)}</p>` : ""}`));

        // Medien
        const m = this.profilMedienbild(state, player);
        kacheln.medien = (this._pfK("Medien", "i-mic", `
            <div class="pf-gross">${esc(m.urteil)}</div>
            ${zeile("Bekanntheit", esc(m.bekannt))}
            ${m.schnitt !== null ? zeile("Note zuletzt", m.schnitt.toFixed(2).replace(".", ",")) : ""}
            ${zeile("Persönlichkeit", esc(this.persoenlichkeitWort ? this.persoenlichkeitWort(player, isUserClub ? 100 : confidence) : ""))}`));

        return kacheln;
    },

    // ------------------------------------------------------------ Laufbahn

    profilLaufbahnKachelnHtml(player, ctx) {
        const state = this.app.state;
        const { isUserClub } = ctx;
        const esc = (t) => this.escapeHtml(String(t ?? ""));
        const note = (n) => n ? n.toFixed(2).replace(".", ",") : "–";

        // Biografie: links der Name groß, rechts der Text
        const bio = this.profilBiografie(state, player, ctx);
        const nachname = String(player.name || "").split(" ").slice(-1)[0];
        const biografie = this._pfK("Biografie", "i-doc", `
            <div class="pf-bio">
                <div class="pf-bio-bild" aria-hidden="true"><span>${esc(nachname.toUpperCase())}</span><i>${esc(player.pos)}</i></div>
                <div class="pf-bio-text"><p class="pf-bio-lead">${esc(bio[0])}</p>${bio.slice(1).map(s => `<p>${esc(s)}</p>`).join("")}</div>
            </div>`, "pf-biografie");

        // Karrierestatistik: Saison für Saison mit Wappen
        const lb = typeof LaufbahnEngine !== "undefined" ? LaufbahnEngine.tabelle(state, player) : { zeilen: [], summe: { spiele: 0, tore: 0, vorlagen: 0, note: null } };
        const zeilen = lb.zeilen.length ? lb.zeilen : (player.clubId ? [{ saison: state.seasonYear || 1, clubId: player.clubId, verein: this._pfVerein(state, player.clubId)?.name || "", spiele: 0, tore: 0, vorlagen: 0, note: null, laufend: true }] : []);
        const vereine = new Set(zeilen.map(z => z.clubId)).size;
        const karriere = this._pfK("Karrierestatistik", "i-table", `
            <div class="pf-zahlen">
                <div><strong>${vereine}</strong><span>${vereine === 1 ? "Verein" : "Vereine"}</span></div>
                <div><strong>${lb.summe.spiele}</strong><span>Spiele</span></div>
                <div><strong>${lb.summe.tore}</strong><span>Tore</span></div>
                <div><strong>${lb.summe.vorlagen}</strong><span>Vorlagen</span></div>
            </div>
            <div class="table-container"><table class="compact-table pf-tabelle pf-karriere">
                <thead><tr><th>Saison</th><th class="pf-links-text">Verein</th><th>Sp</th><th>T</th><th>V</th><th>Note</th></tr></thead>
                <tbody>${zeilen.map(z => {
                    const c = this._pfVerein(state, z.clubId);
                    return `<tr class="${z.laufend ? "lb-laufend" : ""}${z.clubId === state.userClubId ? " lb-eigen" : ""}"><td>${esc(this.profilSaisonText(z.saison))}${z.laufend ? "*" : ""}</td><td class="pf-links-text"><span class="pf-verein-zelle">${c && this.wappenHtml ? this.wappenHtml(c, "pf-wappen") : ""}${esc(z.verein)}</span></td><td>${z.spiele}</td><td>${z.tore}</td><td>${z.vorlagen}</td><td>${note(z.note)}</td></tr>`;
                }).join("")}</tbody>
            </table></div>
            <p class="pf-klein">* laufende Saison. Gezählt wird seit dem Spielstart.</p>`, "pf-karriere-kachel");

        // Meilensteine
        const ms = this.profilMeilensteine(state, player);
        const gruppiert = new Map();
        ms.preise.forEach(p => gruppiert.set(p.name, (gruppiert.get(p.name) || 0) + 1));
        const liste = [
            ...[...gruppiert].map(([name, n]) => ({ icon: "i-star", text: name, n })),
            ...ms.titel.map(t => ({ icon: "i-trophy", text: `${t.name} mit ${t.verein}`, n: 1, saison: t.saison })),
            ...ms.runde.map(t => ({ icon: "i-flag", text: t, n: 1 })),
            ...(isUserClub && typeof this.vereinsbilanzHtml === "function" && typeof ChronikEngine !== "undefined" && ChronikEngine.istLegende
                && ChronikEngine.istLegende(ChronikEngine.bilanz(state, player), (state.chronik?.[state.userClubId]?.titel || []).length)
                ? [{ icon: "i-star", text: "Vereinslegende", n: 1 }] : [])
        ];
        const meilensteine = this._pfK("Meilensteine", "i-trophy", `
            <div class="pf-meilensteine">
                <div class="pf-ms-liste">${liste.length ? liste.slice(0, 8).map(e => `<div class="pf-ms"><svg class="ico" aria-hidden="true"><use href="#${e.icon}"/></svg><span>${esc(e.text)}${e.saison ? ` <small>${esc(this.profilSaisonText(e.saison))}</small>` : ""}</span>${e.n > 1 ? `<b class="pf-ms-zahl">×${e.n}</b>` : ""}</div>`).join("")
                    : '<p class="pf-klein">Noch keine Meilensteine seit dem Spielstart.</p>'}</div>
                <div class="pf-ms-summen">
                    ${[["Auszeichnungen", ms.preise.length, "i-star"], ["Titel", ms.titel.length, "i-trophy"], ["Wechsel", ms.wechsel, "i-transfer"], ["Länderspiele", ms.laenderspiele, "i-flag"]]
                        .map(([l, n, ico]) => `<div class="pf-zeile"><span><svg class="ico" aria-hidden="true"><use href="#${ico}"/></svg>${esc(l)}</span><strong>${n}</strong></div>`).join("")}
                </div>
            </div>`, "pf-meilensteine-kachel");

        // Wie im Vorbild: oben Biografie, Karriere und Medien, darunter
        // Bezugspersonen, Vereine, Nationalität und Meilensteine
        const k = this.profilPersoenlichKacheln(player, ctx);
        return `<div class="pf-laufbahn-raster">${biografie}${karriere}${k.medien}${k.personen}${k.vereine}${k.nation}${meilensteine}</div>
            ${isUserClub && typeof this.vereinsbilanzHtml === "function" ? this.vereinsbilanzHtml(player, true) : ""}`;
    },

    /** Namen und Vereine in den Kacheln führen zu Profil und Vereinsseite */
    bindeProfilVerweise(body) {
        body.querySelectorAll("[data-pf-spieler]").forEach(b => { b.onclick = () => this.showPlayerDetailsModal(b.dataset.pfSpieler); });
        body.querySelectorAll("[data-pf-verein]").forEach(b => { b.onclick = () => this.showClubDetailsModal(b.dataset.pfVerein); });
    }
});
