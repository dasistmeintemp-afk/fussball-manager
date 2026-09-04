/**
 * PlayerRatingEngine - FM-ähnliches Spielerbewertungs- und Einschätzungssystem
 * Trennt echte interne Fähigkeiten (CA 1-200, PA 1-200, Hidden Attributes) von
 * sichtbaren Schätzungen (Spannen, Sterne relativ zum Verein, Labels, Confidence)
 */

class PlayerRatingEngine {
    /**
     * Rechnet OVR (1-99) in interne Current/Potential Ability (1-200) um
     */
    static overallToAbility(overall) {
        if (!overall || isNaN(overall)) return 100;
        // Mapping: 50 -> 100, 70 -> 140, 80 -> 160, 90 -> 180, 99 -> 198
        const ca = Math.round(overall * 2);
        return Math.max(1, Math.min(200, ca));
    }

    /**
     * Rechnet Ability (1-200) zurück in OVR (1-99)
     */
    static abilityToOverall(ability) {
        if (!ability || isNaN(ability)) return 50;
        return Math.max(1, Math.min(99, Math.round(ability / 2)));
    }

    /**
     * Erzeugt Hidden Attributes für Persönlichkeit und Verhalten (1-20 Skala)
     */
    static generateHiddenAttributes(player = {}) {
        return {
            professionalism: player.hiddenAttributes?.professionalism || Math.floor(Math.random() * 11) + 8, // 8-18
            ambition: player.hiddenAttributes?.ambition || Math.floor(Math.random() * 12) + 7, // 7-18
            consistency: player.hiddenAttributes?.consistency || Math.floor(Math.random() * 11) + 8, // 8-18
            importantMatches: player.hiddenAttributes?.importantMatches || Math.floor(Math.random() * 11) + 8, // 8-18
            injuryProneness: player.hiddenAttributes?.injuryProneness || Math.floor(Math.random() * 12) + 4, // 4-15
            adaptability: player.hiddenAttributes?.adaptability || Math.floor(Math.random() * 10) + 9, // 9-18
            loyalty: player.hiddenAttributes?.loyalty || Math.floor(Math.random() * 11) + 8, // 8-18
            temperament: player.hiddenAttributes?.temperament || Math.floor(Math.random() * 12) + 7 // 7-18
        };
    }

    /**
     * Berechnet die relative Sternebewertung (0.5 bis 5.0) basierend auf der Stärke des Vergleichsvereins
     */
    static calculateStarRating(ability, referenceContext = {}) {
        const refAvgAbility = referenceContext.squadAverageAbility || referenceContext.clubAverageAbility || 140; // Default ~70 OVR
        
        // Differenz zur durchschnittlichen Teamfähigkeit
        const diff = ability - refAvgAbility;
        
        // Basis: 3.0 Sterne entspricht dem Vereinsschnitt
        let rawStars = 3.0 + (diff / 20.0); // +20 CA (~10 OVR) -> +1 Stern (4.0)
        
        // Clamp zwischen 0.5 und 5.0 in 0.5er Schritten
        rawStars = Math.max(0.5, Math.min(5.0, rawStars));
        return Math.round(rawStars * 2) / 2;
    }

    /**
     * Berechnet eine positionsgewichtete Wertung anhand der spielerspezifischen Attribute
     */
    static calculatePositionWeightedRating(player = {}, position = null) {
        const pos = position || player.pos || "ZM";
        const att = player.attributes || {};
        const pace = att.pace || player.pace || player.overall || 70;
        const shooting = att.shooting || player.shooting || (pos === "ST" ? player.overall : 60);
        const passing = att.passing || player.passing || 70;
        const dribbling = att.dribbling || player.dribbling || 70;
        const defense = att.defense || player.defense || (pos === "IV" ? player.overall : 60);
        const physical = att.physical || player.physical || player.stamina || 70;
        const reflexes = att.reflexes || player.reflexes || player.overall || 70;
        const handling = att.handling || player.handling || player.overall || 70;

        if (pos === "TW") {
            return Math.round(reflexes * 0.4 + handling * 0.35 + passing * 0.15 + physical * 0.1);
        }
        if (pos === "IV") {
            return Math.round(defense * 0.4 + physical * 0.25 + passing * 0.15 + pace * 0.2);
        }
        if (pos === "LV" || pos === "RV") {
            return Math.round(pace * 0.3 + defense * 0.25 + physical * 0.2 + passing * 0.15 + dribbling * 0.1);
        }
        if (pos === "DM") {
            return Math.round(defense * 0.35 + physical * 0.25 + passing * 0.25 + dribbling * 0.15);
        }
        if (pos === "ZM") {
            return Math.round(passing * 0.35 + dribbling * 0.25 + physical * 0.2 + defense * 0.1 + shooting * 0.1);
        }
        if (pos === "OM") {
            return Math.round(passing * 0.3 + dribbling * 0.3 + shooting * 0.25 + pace * 0.15);
        }
        if (pos === "LM" || pos === "RM" || pos === "LA" || pos === "RA") {
            return Math.round(pace * 0.35 + dribbling * 0.3 + passing * 0.2 + shooting * 0.15);
        }
        if (pos === "ST") {
            return Math.round(shooting * 0.4 + pace * 0.25 + physical * 0.2 + dribbling * 0.15);
        }

        return player.overall || 70;
    }

    /**
     * Berechnet die Eignung und Sternebewertung für eine spezifische taktische Rolle
     */
    static calculateRoleRating(player = {}, role = "", referenceContext = {}) {
        const att = player.attributes || {};
        const pace = att.pace || player.pace || player.overall || 70;
        const shooting = att.shooting || player.shooting || 65;
        const passing = att.passing || player.passing || 70;
        const dribbling = att.dribbling || player.dribbling || 70;
        const defense = att.defense || player.defense || 65;
        const physical = att.physical || player.physical || player.stamina || 70;
        const reflexes = att.reflexes || player.reflexes || 70;
        const handling = att.handling || player.handling || 70;

        let score = 70;

        switch (role) {
            case "Torwart":
                score = reflexes * 0.45 + handling * 0.4 + passing * 0.15;
                break;
            case "Innenverteidiger":
                score = defense * 0.45 + physical * 0.35 + pace * 0.2;
                break;
            case "Ballspielender Verteidiger":
                score = defense * 0.35 + passing * 0.35 + physical * 0.15 + pace * 0.15;
                break;
            case "Außenverteidiger defensiv":
                score = defense * 0.4 + pace * 0.3 + physical * 0.2 + passing * 0.1;
                break;
            case "Außenverteidiger offensiv":
                score = pace * 0.35 + passing * 0.25 + dribbling * 0.2 + defense * 0.2;
                break;
            case "Sechser":
                score = defense * 0.4 + passing * 0.3 + physical * 0.2 + dribbling * 0.1;
                break;
            case "Ballgewinner":
                score = defense * 0.5 + physical * 0.35 + pace * 0.15;
                break;
            case "Spielmacher":
                score = passing * 0.45 + dribbling * 0.3 + physical * 0.15 + shooting * 0.1;
                break;
            case "Box-to-Box":
                score = physical * 0.3 + passing * 0.25 + defense * 0.25 + shooting * 0.2;
                break;
            case "Flügelspieler":
                score = pace * 0.4 + dribbling * 0.3 + passing * 0.2 + shooting * 0.1;
                break;
            case "Inverser Flügel":
                score = dribbling * 0.35 + shooting * 0.3 + pace * 0.25 + passing * 0.1;
                break;
            case "Zehner":
                score = passing * 0.35 + dribbling * 0.35 + shooting * 0.2 + pace * 0.1;
                break;
            case "Stoßstürmer":
                score = shooting * 0.5 + physical * 0.3 + pace * 0.2;
                break;
            case "Pressingstürmer":
                score = physical * 0.35 + pace * 0.3 + shooting * 0.25 + defense * 0.1;
                break;
            case "Kompletter Stürmer":
                score = shooting * 0.35 + pace * 0.25 + dribbling * 0.2 + physical * 0.2;
                break;
            default:
                score = PlayerRatingEngine.calculatePositionWeightedRating(player, player.pos);
        }

        const ability = PlayerRatingEngine.overallToAbility(Math.round(score));
        const stars = PlayerRatingEngine.calculateStarRating(ability, referenceContext);

        return {
            role,
            score: Math.round(score),
            ability,
            stars,
            starsHtml: "★".repeat(Math.floor(stars)) + (stars % 1 !== 0 ? "½" : "") + "☆".repeat(5 - Math.ceil(stars))
        };
    }

    /**
     * Ermittelt die am besten geeigneten Rollen für einen Spieler
     */
    static getBestRolesForPlayer(player = {}, referenceContext = {}) {
        const pos = player.pos || "ZM";
        let candidateRoles = [];

        if (pos === "TW") {
            candidateRoles = ["Torwart"];
        } else if (pos === "IV") {
            candidateRoles = ["Innenverteidiger", "Ballspielender Verteidiger", "Ballgewinner"];
        } else if (pos === "LV" || pos === "RV") {
            candidateRoles = ["Außenverteidiger defensiv", "Außenverteidiger offensiv", "Flügelspieler"];
        } else if (pos === "DM") {
            candidateRoles = ["Sechser", "Ballgewinner", "Box-to-Box", "Spielmacher"];
        } else if (pos === "ZM") {
            candidateRoles = ["Spielmacher", "Box-to-Box", "Zehner", "Sechser"];
        } else if (pos === "OM") {
            candidateRoles = ["Zehner", "Spielmacher", "Inverser Flügel"];
        } else if (pos === "LM" || pos === "RM" || pos === "LA" || pos === "RA") {
            candidateRoles = ["Flügelspieler", "Inverser Flügel", "Außenverteidiger offensiv"];
        } else if (pos === "ST") {
            candidateRoles = ["Stoßstürmer", "Pressingstürmer", "Kompletter Stürmer"];
        } else {
            candidateRoles = ["Spielmacher", "Box-to-Box", "Flügelspieler"];
        }

        const evaluated = candidateRoles.map(role => PlayerRatingEngine.calculateRoleRating(player, role, referenceContext));
        evaluated.sort((a, b) => b.score - a.score);

        return {
            best: evaluated[0] || { role: "Allrounder", stars: 3.0, starsHtml: "★★★☆☆" },
            alternative: evaluated[1] || null,
            all: evaluated
        };
    }

    /**
     * Deterministische Pseudo-Zufallszahl aus Spieler-ID und Merkmalsname.
     * Dadurch bleibt eine Schätzung über alle Neuzeichnungen hinweg gleich -
     * die Werte flackern nicht bei jedem Rendern.
     */
    static seededOffset(playerId, key) {
        const text = `${playerId}|${key}`;
        let hash = 2166136261;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        // Ergebnis im Bereich -1 .. +1
        return (((hash >>> 0) % 2001) - 1000) / 1000;
    }

    /**
     * Rendert eine Sternebewertung als HTML.
     * Bei unsicherer Einschätzung wird eine Spanne dargestellt: sichere Sterne
     * voll, mögliche Sterne blass - je besser gescoutet, desto schmaler.
     */
    static renderStarRange(minStars, maxStars, options = {}) {
        const min = Math.max(0, Math.min(5, minStars || 0));
        const max = Math.max(min, Math.min(5, maxStars ?? min));
        const color = options.color || "#f59e0b";

        const solid = Math.floor(min);
        const hasHalf = (min - solid) >= 0.5;
        const upper = Math.ceil(max);

        let html = `<span class="star-rating" style="color:${color};">`;
        html += "★".repeat(solid);
        if (hasHalf) html += "½";

        // Mögliche, aber noch nicht bestätigte Sterne
        const uncertain = Math.max(0, upper - solid - (hasHalf ? 1 : 0));
        if (uncertain > 0) {
            html += `<span class="star-uncertain">${"★".repeat(uncertain)}</span>`;
        }

        const empty = 5 - solid - (hasHalf ? 1 : 0) - uncertain;
        if (empty > 0) html += `<span class="star-empty">${"☆".repeat(empty)}</span>`;

        html += "</span>";
        return html;
    }

    /**
     * Macht einen Attributwert entsprechend dem Scoutwissen unscharf.
     * Bei voller Kenntnis wird der exakte Wert geliefert, sonst eine Spanne,
     * deren Breite mit sinkendem Wissen zunimmt.
     */
    static getVisibleAttribute(player, attrName, confidence) {
        const raw = (typeof player?.[attrName] === "number") ? player[attrName] : null;
        if (raw === null) {
            return { known: false, exact: null, min: null, max: null, text: "?", spread: 0 };
        }

        const conf = Math.max(0, Math.min(100, confidence ?? 25));
        if (conf >= 88) {
            return { known: true, exact: raw, min: raw, max: raw, text: String(raw), spread: 0 };
        }

        // Spanne: bei 25 % Wissen rund +/- 8 Punkte, bei 80 % nur noch +/- 2
        const spread = Math.max(1, Math.round((100 - conf) * 0.11));
        const bias = Math.round(PlayerRatingEngine.seededOffset(player.id, attrName) * spread * 0.5);

        const min = Math.max(1, Math.min(99, raw - spread + bias));
        const max = Math.max(min + 1, Math.min(99, raw + spread + bias));

        return { known: false, exact: null, min, max, text: `${min}–${max}`, spread };
    }

    /**
     * Liefert alle sichtbaren Attribute eines Spielers samt Genauigkeitsstufe
     */
    static getVisibleAttributes(player, confidence, attrNames = []) {
        const result = {};
        attrNames.forEach(name => {
            result[name] = PlayerRatingEngine.getVisibleAttribute(player, name, confidence);
        });
        return result;
    }

    /**
     * Beschreibt, wie belastbar die angezeigten Werte sind
     */
    static getConfidenceDescriptor(confidence) {
        const conf = Math.max(0, Math.min(100, confidence ?? 25));
        if (conf >= 88) return { key: "exact", label: "Vollständig bekannt", color: "#22c55e", hint: "Alle Werte sind gesichert." };
        if (conf >= 70) return { key: "good", label: "Gut gescoutet", color: "#4ade80", hint: "Die Werte sind weitgehend belastbar." };
        if (conf >= 50) return { key: "partial", label: "Teilweise gescoutet", color: "#facc15", hint: "Grobe Einschätzung – weitere Berichte schärfen das Bild." };
        if (conf >= 30) return { key: "vague", label: "Grobe Einschätzung", color: "#fb923c", hint: "Nur Beobachtungen aus der Ferne. Bitte scouten." };
        return { key: "unknown", label: "Kaum bekannt", color: "#ef4444", hint: "Über diesen Spieler ist fast nichts bekannt. Scout entsenden!" };
    }

    /**
     * Erzeugt verbale Qualitätslabels für die aktuelle Stärke
     */
    static getAbilityLabel(ability, leagueContext = {}) {
        const ca = ability || 100;
        if (ca >= 180) return "Weltklasse";
        if (ca >= 165) return "Internationaler Topspieler";
        if (ca >= 150) return "Starker Erstligaspieler";
        if (ca >= 135) return "Guter Erstligaspieler";
        if (ca >= 120) return "Solider Zweitligaspieler";
        if (ca >= 100) return "Drittliga-Niveau";
        if (ca >= 80) return "Regionalligaspieler";
        return "Amateur- / Jugendspieler";
    }

    /**
     * Erzeugt Potenzial-Labels
     */
    static getPotentialLabel(player = {}) {
        const ca = player.trueCurrentAbility || PlayerRatingEngine.overallToAbility(player.overall || 65);
        const pa = player.truePotentialAbility || PlayerRatingEngine.overallToAbility(player.pot || 75);
        const age = player.age || 24;
        const diff = pa - ca;

        if (pa >= 180 && diff >= 25 && age <= 21) return "Generationales Top-Talent";
        if (pa >= 165 && diff >= 20 && age <= 23) return "Top-Talent";
        if (diff >= 20 && age <= 24) return "Großes Entwicklungspotenzial";
        if (diff >= 10 && age <= 26) return "Kann guter Profi werden";
        if (diff >= 5) return "Solides Entwicklungspotenzial";
        return "Am Leistungslimit / Begrenztes Potenzial";
    }

    /**
     * Liefert textuelle Beschreibungen von Hidden Traits abhängig vom Scouting-Wissen
     */
    static getHiddenTraitDescriptions(player = {}, scoutingKnowledge = {}) {
        const confidence = scoutingKnowledge.knowledgeLevel || 25;
        const h = player.hiddenAttributes || PlayerRatingEngine.generateHiddenAttributes(player);
        const traits = [];

        if (confidence >= 35) {
            if (h.professionalism >= 16) traits.push("Gilt als Vorzeigeprofi mit herausragender Arbeitsmoral.");
            else if (h.professionalism <= 8) traits.push("Lässt gelegentlich die nötige Trainingsdisziplin vermissen.");

            if (h.ambition >= 16) traits.push("Sehr ehrgeizig und hungrig nach Titeln und Weiterentwicklung.");
            else if (h.ambition <= 8) traits.push("Wirkt bisweilen zufrieden mit dem Status quo.");
        }

        if (confidence >= 55) {
            if (h.importantMatches >= 16) traits.push("Zeigt in entscheidenden Spitzenspielen absolute Nervenstärke.");
            else if (h.importantMatches <= 8) traits.push("Wirkt in hitzigen Topspielen bisweilen nervös.");

            if (h.injuryProneness >= 14) traits.push("Gilt im Umfeld als überdurchschnittlich verletzungsanfällig.");
            else if (h.injuryProneness <= 6) traits.push("Verfügt über eine robuste Physis und ist selten verletzt.");
        }

        if (confidence >= 75) {
            if (h.loyalty >= 16) traits.push("Besonders vereinsloyal und heimatverbunden.");
            else if (h.loyalty <= 8) traits.push("Ist wechselwillig bei lukrativen Angeboten höherklassiger Clubs.");

            if (h.consistency >= 16) traits.push("Liefert Woche für Woche verlässlich konstante Leistungen ab.");
            else if (h.consistency <= 8) traits.push("Unterliegt spürbaren Formschwankungen im Saisonverlauf.");
        }

        return traits;
    }

    /**
     * Ermittelt die Genauigkeit und Schätzspannen für sichtbare Werte abhängig von Scouting und Club-Zugehörigkeit
     */
    static calculateVisiblePlayerCard(player, context = {}) {
        const isUserPlayer = player.clubId && context.userClubId && player.clubId === context.userClubId;
        const scoutingKnowledge = player.scoutingKnowledge || {
            known: isUserPlayer,
            knowledgeLevel: isUserPlayer ? 90 : 25,
            accuracy: isUserPlayer ? 90 : 25
        };

        const trueCa = player.trueCurrentAbility || PlayerRatingEngine.overallToAbility(player.overall || 65);
        const truePa = player.truePotentialAbility || PlayerRatingEngine.overallToAbility(player.pot || 75);
        const trueVal = player.trueMarketValue || player.value || 1000000;

        let confidence = isUserPlayer ? Math.max(85, scoutingKnowledge.knowledgeLevel || 85) : (scoutingKnowledge.knowledgeLevel || 25);
        // Liga Data-Coverage berücksichtigen
        const leagueCoverage = context.leagueDataCoverage || 85;
        if (!isUserPlayer) {
            confidence = Math.round(confidence * (leagueCoverage / 100));
        }
        confidence = Math.max(10, Math.min(100, confidence));

        // Ab dieser Schwelle gilt ein Spieler als vollständig durchleuchtet:
        // dann werden überall exakte Werte statt Spannen gezeigt.
        const PRECISE_THRESHOLD = 85;
        const isPrecise = isUserPlayer || confidence >= PRECISE_THRESHOLD;

        // Spannen-Größe abhängig von Konfidenz (Confidence 100% -> Spanne 0; Confidence 20% -> Spanne ~30 CA)
        const caSpread = isPrecise ? 0 : Math.round((100 - confidence) * 0.35);
        const paSpread = isPrecise ? 0 : Math.round((100 - confidence) * 0.45);

        // Deterministische Verschiebung der Schätzung: Bei wenig Scoutwissen
        // liegt nicht nur die Spanne weit auseinander, auch ihre Mitte kann
        // daneben liegen. Genau das macht Scouten überhaupt lohnend.
        // Die Verschiebung bleibt kleiner als die Spanne, der wahre Wert liegt
        // also immer noch innerhalb der angezeigten Grenzen.
        const caBias = Math.round(PlayerRatingEngine.seededOffset(player.id, "ca") * caSpread * 0.45);
        const paBias = Math.round(PlayerRatingEngine.seededOffset(player.id, "pa") * paSpread * 0.45);

        const estCaMin = Math.max(20, Math.round(trueCa - caSpread + caBias));
        const estCaMax = Math.min(200, Math.max(estCaMin, Math.round(trueCa + caSpread + caBias)));

        const estPaMin = Math.max(estCaMin, Math.round(truePa - paSpread + paBias));
        const estPaMax = Math.min(200, Math.max(estPaMin, Math.round(truePa + paSpread + paBias)));

        // OVR Spannen zur Darstellung
        const ovrMin = PlayerRatingEngine.abilityToOverall(estCaMin);
        const ovrMax = PlayerRatingEngine.abilityToOverall(estCaMax);
        const potMin = PlayerRatingEngine.abilityToOverall(estPaMin);
        const potMax = PlayerRatingEngine.abilityToOverall(estPaMax);

        // Marktwert-Spanne
        const valFactor = (100 - confidence) / 100 * 0.4;
        const valMin = Math.round(trueVal * (1 - valFactor));
        const valMax = Math.round(trueVal * (1 + valFactor));

        // Relative Sternebewertung (zum User-Kader).
        // Wichtig: Die Sterne folgen der GESCHÄTZTEN Stärke, nicht der wahren.
        // Sonst würde ein völlig unbekannter Spieler seine echte Qualität
        // verraten, obwohl daneben "21 % Scout-Wissen" steht.
        const refContext = {
            squadAverageAbility: context.userSquadAvgAbility || 140
        };

        const starsCaMin = PlayerRatingEngine.calculateStarRating(estCaMin, refContext);
        const starsCaMax = PlayerRatingEngine.calculateStarRating(estCaMax, refContext);
        const starsPaMin = PlayerRatingEngine.calculateStarRating(estPaMin, refContext);
        const starsPaMax = PlayerRatingEngine.calculateStarRating(estPaMax, refContext);

        // Für Sortierungen und Vergleiche wird die Mitte der Spanne verwendet
        const starsCa = Math.round(((starsCaMin + starsCaMax) / 2) * 2) / 2;
        const starsPa = Math.round(((starsPaMin + starsPaMax) / 2) * 2) / 2;

        // Rollenanalyse: Die Rollenbezeichnung ergibt sich aus der öffentlich
        // sichtbaren Position, die Bewertung darin bleibt eine Schätzung.
        const roleData = PlayerRatingEngine.getBestRolesForPlayer(player, refContext);

        // Label aus der geschätzten Mitte, bei Unsicherheit als Näherung markiert
        const estCaMid = Math.round((estCaMin + estCaMax) / 2);
        const rawAbilityLabel = PlayerRatingEngine.getAbilityLabel(estCaMid, context);
        const abilityLabel = isPrecise || confidence >= 70 ? rawAbilityLabel : `ca. ${rawAbilityLabel}`;
        const potentialLabel = PlayerRatingEngine.getPotentialLabel(player);
        const confidenceInfo = PlayerRatingEngine.getConfidenceDescriptor(confidence);

        // Hidden attributes Text-Highlights
        const hiddenTraits = PlayerRatingEngine.getHiddenTraitDescriptions(player, { knowledgeLevel: confidence });

        return {
            isFullyKnown: isUserPlayer || confidence >= 90,
            confidence,
            estimatedCa: { min: estCaMin, max: estCaMax },
            estimatedPa: { min: estPaMin, max: estPaMax },
            isPrecise,
            visibleOvr: isPrecise ? player.overall : `${ovrMin} - ${ovrMax}`,
            visiblePot: (isPrecise && player.age >= 26) ? player.pot : `${potMin} - ${potMax}`,
            visibleValueText: isPrecise
                ? (typeof Formatters !== 'undefined' ? Formatters.formatMoney(trueVal) : `${(trueVal / 1e6).toFixed(1)} Mio. €`)
                : `${(valMin / 1e6).toFixed(1)} - ${(valMax / 1e6).toFixed(1)} Mio. €`,
            starsCa,
            starsPa,
            starsCaMin,
            starsCaMax,
            starsPaMin,
            starsPaMax,
            starsCaHtml: PlayerRatingEngine.renderStarRange(starsCaMin, starsCaMax, { color: "#f59e0b" }),
            starsPaHtml: PlayerRatingEngine.renderStarRange(starsPaMin, starsPaMax, { color: "#38bdf8" }),
            confidenceInfo,
            bestRole: roleData.best,
            alternativeRole: roleData.alternative,
            allRoles: roleData.all,
            abilityLabel,
            potentialLabel,
            hiddenTraits
        };
    }
}

// Browser & Node Export
if (typeof window !== "undefined") {
    window.PlayerRatingEngine = PlayerRatingEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { PlayerRatingEngine };
}
