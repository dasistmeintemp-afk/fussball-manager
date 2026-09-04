/**
 * Formatierungs-Hilfsfunktionen für Zahlen, Währungen, Daten und Texte
 */

const Formatters = {
    /**
     * Formatiert Geldbeträge übersichtlich (z. B. 15.000.000 € oder 15,0 Mio. €)
     */
    formatMoney(amount, compact = false) {
        if (amount === null || amount === undefined || isNaN(amount)) return "0 €";
        const num = Math.round(amount);

        if (compact) {
            if (Math.abs(num) >= 1000000) {
                return (num / 1000000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + " Mio. €";
            }
            if (Math.abs(num) >= 1000) {
                return (num / 1000).toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " Tsd. €";
            }
        }

        return num.toLocaleString("de-DE") + " €";
    },

    /**
     * Formatiert ein Datum oder Datum-String
     */
    formatDate(dateInput) {
        if (!dateInput) return "-";
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        return date.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    },

    /**
     * Formatiert Prozentwerte
     */
    formatPercent(val) {
        if (val === null || val === undefined || isNaN(val)) return "0%";
        return `${Math.round(val)}%`;
    },

    /**
     * Deutsche Bezeichnung für Vorstandserwartungen
     */
    formatExpectation(expKey) {
        const map = {
            "championship": "Deutsche Meisterschaft",
            "top3": "Qualifikation Champions League (Top 3)",
            "top6": "Internationales Geschäft (Top 6)",
            "midfield": "Gesichertes Mittelfeld",
            "avoid_relegation": "Klassenerhalt sichern"
        };
        return map[expKey] || expKey || "Solide Saison";
    },

    /**
     * Deutsche Bezeichnung für Spielpositionen
     */
    formatPosition(pos) {
        const map = {
            "TW": "Torwart (TW)",
            "IV": "Innenverteidiger (IV)",
            "LV": "Linksverteidiger (LV)",
            "RV": "Rechtsverteidiger (RV)",
            "DM": "Defensives Mittelfeld (DM)",
            "ZM": "Zentrales Mittelfeld (ZM)",
            "OM": "Offensives Mittelfeld (OM)",
            "LM": "Linkes Mittelfeld (LM)",
            "RM": "Rechtes Mittelfeld (RM)",
            "LA": "Linksaußen (LA)",
            "RA": "Rechtsaußen (RA)",
            "ST": "Stürmer (ST)"
        };
        return map[pos] || pos;
    }
};

if (typeof window !== "undefined") {
    window.Formatters = Formatters;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Formatters };
}
