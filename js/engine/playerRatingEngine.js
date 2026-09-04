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

        // Spannen-Größe abhängig von Konfidenz (Confidence 100% -> Spanne 0; Confidence 20% -> Spanne ~30 CA)
        const caSpread = Math.round((100 - confidence) * 0.35);
        const paSpread = Math.round((100 - confidence) * 0.45);

        // Pseudozufällige Verschiebung anhand von Player-ID (deterministisch)
        const hash = String(player.id || "0").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const bias = ((hash % 7) - 3) * ((100 - confidence) / 100);

        const estCaMin = Math.max(20, Math.round(trueCa - caSpread + bias));
        const estCaMax = Math.min(200, Math.max(estCaMin + 2, Math.round(trueCa + caSpread + bias)));

        const estPaMin = Math.max(estCaMin, Math.round(truePa - paSpread + bias));
        const estPaMax = Math.min(200, Math.max(estPaMin + 2, Math.round(truePa + paSpread + bias)));

        // OVR Spannen zur Darstellung
        const ovrMin = PlayerRatingEngine.abilityToOverall(estCaMin);
        const ovrMax = PlayerRatingEngine.abilityToOverall(estCaMax);
        const potMin = PlayerRatingEngine.abilityToOverall(estPaMin);
        const potMax = PlayerRatingEngine.abilityToOverall(estPaMax);

        // Marktwert-Spanne
        const valFactor = (100 - confidence) / 100 * 0.4;
        const valMin = Math.round(trueVal * (1 - valFactor));
        const valMax = Math.round(trueVal * (1 + valFactor));

        // Relative Sternebewertung (zum User-Kader)
        const refContext = {
            squadAverageAbility: context.userSquadAvgAbility || 140
        };
        const starsCa = PlayerRatingEngine.calculateStarRating(trueCa, refContext);
        const starsPa = PlayerRatingEngine.calculateStarRating(truePa, refContext);

        // Label
        const abilityLabel = PlayerRatingEngine.getAbilityLabel(trueCa, context);
        const potentialLabel = PlayerRatingEngine.getPotentialLabel(player);

        // Hidden attributes Text-Highlights
        const hiddenTraits = [];
        const h = player.hiddenAttributes || PlayerRatingEngine.generateHiddenAttributes(player);
        if (confidence >= 50) {
            if (h.professionalism >= 16) hiddenTraits.push("Gilt als Vorzeigeprofi mit herausragender Arbeitsmoral.");
            if (h.importantMatches >= 16) hiddenTraits.push("Zeigt in entscheidenden Spitzenspielen absolute Nervenstärke.");
            if (h.injuryProneness >= 14) hiddenTraits.push("Gilt im Umfeld als überdurchschnittlich verletzungsanfällig.");
            if (h.ambition >= 16) hiddenTraits.push("Sehr ehrgeizig und hungrig nach sportlichem Erfolg.");
            if (h.loyalty >= 16) hiddenTraits.push("Besonders vereinsloyal und heimatverbunden.");
        }

        return {
            isFullyKnown: isUserPlayer || confidence >= 90,
            confidence,
            estimatedCa: { min: estCaMin, max: estCaMax },
            estimatedPa: { min: estPaMin, max: estPaMax },
            visibleOvr: (isUserPlayer || confidence >= 85) ? player.overall : `${ovrMin} - ${ovrMax}`,
            visiblePot: (isUserPlayer && player.age >= 26) ? player.pot : `${potMin} - ${potMax}`,
            visibleValueText: (isUserPlayer || confidence >= 80)
                ? (typeof Formatters !== 'undefined' ? Formatters.formatMoney(trueVal) : `${(trueVal / 1e6).toFixed(1)} Mio. €`)
                : `${(valMin / 1e6).toFixed(1)} - ${(valMax / 1e6).toFixed(1)} Mio. €`,
            starsCa,
            starsPa,
            starsCaHtml: "★".repeat(Math.floor(starsCa)) + (starsCa % 1 !== 0 ? "½" : "") + "☆".repeat(5 - Math.ceil(starsCa)),
            starsPaHtml: "★".repeat(Math.floor(starsPa)) + (starsPa % 1 !== 0 ? "½" : "") + "☆".repeat(5 - Math.ceil(starsPa)),
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
