/**
 * TrainingEngine - Wöchentliches Training, Fitness-Regeneration, Spielerentwicklung & Verletzungen
 */

class TrainingEngine {
    /**
     * Führt das wöchentliche Training für alle Vereine durch
     */
    static processWeeklyTraining(state) {
        state.clubs.forEach(club => {
            const clubPlayers = state.players.filter(p => club.playerIds.includes(p.id));
            const focus = club.id === state.userClubId ? (state.trainingSettings.focus || "allround") : "allround";
            const intensity = club.id === state.userClubId ? (state.trainingSettings.intensity || "normal") : "normal";

            clubPlayers.forEach(player => {
                // 1. Fitness-Regeneration
                let fitnessGain = 8;
                if (focus === "regeneration") fitnessGain = 16;
                if (intensity === "low") fitnessGain += 4;
                if (intensity === "high") fitnessGain -= 3;

                player.fitness = Math.min(100, player.fitness + fitnessGain);

                // 2. Moral-Entwicklung
                if (player.stats.matches > 0 && player.form >= 7.0) {
                    player.morale = Math.min(100, player.morale + 1);
                } else if (player.form <= 5.5) {
                    player.morale = Math.max(40, player.morale - 1);
                }

                // 3. Attributs- und Stärkeentwicklung (Potential vs. Age)
                TrainingEngine.developPlayer(player, focus, intensity);

                // 4. Verletzungsrisiko beim Training (sehr gering)
                if (player.injuredWeeks === 0 && Math.random() < (intensity === "high" ? 0.015 : 0.005)) {
                    TrainingEngine.inflictInjury(state, player, club);
                }
            });
        });
    }

    /**
     * Entwickelt einen Spieler basierend auf Fokus, Alter und Potenzial
     */
    static developPlayer(player, focus, intensity) {
        const potentialRoom = player.pot - player.overall;
        let growthChance = 0.05;

        // Junge Spieler (unter 23) entwickeln sich schneller
        if (player.age <= 21) growthChance = 0.15;
        else if (player.age <= 24) growthChance = 0.10;
        else if (player.age >= 32) growthChance = -0.08; // Ältere Spieler bauen allmählich ab
        else if (player.age >= 30) growthChance = 0.01;

        if (focus === "youth" && player.age <= 22) growthChance += 0.08;
        if (intensity === "high") growthChance += 0.03;

        // Positives Wachstum
        if (potentialRoom > 0 && Math.random() < growthChance) {
            player.overall = Math.min(player.pot, player.overall + 1);
            player.value = Math.round(player.value * 1.08); // Marktwert steigt

            // Spezifische Attribute je nach Trainingsfokus steigern
            if (focus === "attack") {
                player.shooting = Math.min(99, player.shooting + 1);
                player.dribbling = Math.min(99, player.dribbling + 1);
            } else if (focus === "defense") {
                player.defense = Math.min(99, player.defense + 1);
                player.physical = Math.min(99, player.physical + 1);
            } else if (focus === "technique") {
                player.technique = Math.min(99, player.technique + 1);
                player.passing = Math.min(99, player.passing + 1);
            } else if (focus === "tactics") {
                player.vision = Math.min(99, player.vision + 1);
                player.positioning = Math.min(99, player.positioning + 1);
            } else if (focus === "fitness") {
                player.stamina = Math.min(99, player.stamina + 1);
                player.pace = Math.min(99, player.pace + 1);
            }
        } 
        // Altersbedingter Abbau
        else if (growthChance < 0 && Math.random() < Math.abs(growthChance)) {
            if (player.overall > 60) {
                player.overall -= 1;
                player.pace = Math.max(40, player.pace - 1);
                player.stamina = Math.max(45, player.stamina - 1);
                player.value = Math.max(500000, Math.round(player.value * 0.9));
            }
        }
    }

    /**
     * Erzeugt eine Verletzung für einen Spieler
     */
    static inflictInjury(state, player, club) {
        const injuryTypes = [
            { name: "Muskelverhärtung", weeks: 1, severity: "leicht" },
            { name: "Knöchelstauchung", weeks: 2, severity: "leicht" },
            { name: "Muskelfaserriss", weeks: 3, severity: "mittel" },
            { name: "Bänderdehnung", weeks: 4, severity: "mittel" },
            { name: "Meniskusschaden", weeks: 6, severity: "schwer" },
            { name: "Kreuzbandanriss", weeks: 10, severity: "schwer" }
        ];

        const roll = Math.random();
        let selectedInjury;
        if (roll < 0.6) selectedInjury = injuryTypes[Math.floor(Math.random() * 2)];
        else if (roll < 0.9) selectedInjury = injuryTypes[2 + Math.floor(Math.random() * 2)];
        else selectedInjury = injuryTypes[4 + Math.floor(Math.random() * 2)];

        player.injuredWeeks = selectedInjury.weeks;
        player.injuryName = selectedInjury.name;
        player.fitness = Math.max(40, player.fitness - 20);

        // Aus Startelf / Bank nehmen wenn verletzt
        club.lineup = club.lineup.filter(id => id !== player.id);
        club.bench = club.bench.filter(id => id !== player.id);

        if (club.id === state.userClubId) {
            state.inbox.unshift({
                id: Date.now(),
                matchday: state.currentMatchday,
                date: `Spieltag ${state.currentMatchday}`,
                sender: "Medizinische Abteilung",
                subject: `Verletzung: ${player.name}`,
                body: `Schlechte Nachrichten: Unser Spieler ${player.name} hat sich im Training eine Verletzung zugezogen (${selectedInjury.name}). Die voraussichtliche Ausfallzeit beträgt ${selectedInjury.weeks} Woche(n). Bitte passen Sie Ihre Aufstellung an!`,
                read: false,
                type: "injury"
            });
        }
    }
}

if (typeof window !== "undefined") {
    window.TrainingEngine = TrainingEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TrainingEngine };
}
