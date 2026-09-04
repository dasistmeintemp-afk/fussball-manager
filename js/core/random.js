/**
 * Zufallsgeneratoren und mathematische Hilfsfunktionen
 */

const Random = {
    /**
     * Zufällige Ganzzahl zwischen min und max (inklusive)
     */
    int(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * Zufällige Fließkommazahl zwischen min und max
     */
    float(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * Zufälliges Element aus einem Array
     */
    choice(array) {
        if (!Array.isArray(array) || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    },

    /**
     * Wahrscheinlichkeitstest (0 bis 1 oder 0 bis 100)
     */
    chance(probability) {
        const threshold = probability > 1 ? probability / 100 : probability;
        return Math.random() < threshold;
    },

    /**
     * Begrenzung eines Werts auf [min, max]
     */
    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    },

    /**
     * Normalverteilter Zufallswert (Box-Muller-Transformation)
     */
    gaussian(mean = 0, stdev = 1) {
        const u1 = 1 - Math.random();
        const u2 = 1 - Math.random();
        const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
        return mean + stdev * randStdNormal;
    }
};

if (typeof window !== "undefined") {
    window.Random = Random;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Random };
}
