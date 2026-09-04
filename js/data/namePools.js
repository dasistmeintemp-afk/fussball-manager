/**
 * Namenspools für Jugendspieler, Neugenerierungen und Scouts
 */

const NAME_POOLS = {
    firstNames: [
        "Lukas", "Leon", "Finn", "Elias", "Jonas", "Felix", "Maximilian", "Noah", "Paul", "Julian",
        "Moritz", "Niklas", "David", "Tim", "Jan", "Tobias", "Alexander", "Simon", "Florian", "Fabian",
        "Marco", "Kevin", "Sebastian", "Marvin", "Nico", "Daniel", "Christian", "Marcel", "Dennis", "Robin",
        "Matteo", "Luca", "Jakob", "Emil", "Anton", "Liam", "Ben", "Theo", "Sam", "Milo",
        "Leo", "Henry", "Mats", "Hannes", "Erik", "Tom", "Oskar", "Mika", "Lennox", "Rafael"
    ],
    lastNames: [
        "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
        "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann",
        "Braun", "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Schmitz", "Krause", "Meier",
        "Lehmann", "Schmid", "Herrmann", "König", "Walter", "Mayer", "Huber", "Kaiser", "Fuchs", "Peters",
        "Lang", "Scholz", "Möller", "Weiß", "Jung", "Hahn", "Vogel", "Friedrich", "Günther", "Keller"
    ],
    nationalities: [
        "Deutschland", "Deutschland", "Deutschland", "Deutschland", "Deutschland", // Gewichtung
        "Österreich", "Schweiz", "Frankreich", "Niederlande", "Spanien", "Italien", "Brasilien", "Argentinien", "Kroatien", "Polen", "Dänemark", "Schweden"
    ]
};

if (typeof window !== "undefined") {
    window.NAME_POOLS = NAME_POOLS;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NAME_POOLS };
}
