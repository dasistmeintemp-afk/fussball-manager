/**
 * Kompressor - Spielstände klein genug für den LocalStorage
 *
 * Gespeichert wird in IndexedDB. Der LocalStorage ist der Notfallweg, wenn
 * es IndexedDB nicht gibt oder ein Schreibvorgang dort scheitert - und er
 * fasst in den gängigen Browsern rund fünf Millionen Zeichen. Seit die Welt
 * über fünfhundert Vereine kennt, ist ein kodierter Spielstand größer.
 *
 * Für den LocalStorage wird der Text deshalb mit LZW verdichtet: Jedes
 * Zeichen des Ergebnisses trägt 15 Bit (UTF-16, um 32 verschoben, damit
 * keine Steuerzeichen entstehen). Ein kodierter Spielstand schrumpft so auf
 * ein Fünftel bis ein Sechstel. Ein Präfix markiert verdichtete Texte;
 * alles andere wird unverändert gelesen.
 */

const Kompressor = {
    PRAEFIX: "\u0001lzw1:",

    istGepackt(text) {
        return typeof text === "string" && text.startsWith(this.PRAEFIX);
    },

    packe(text) {
        if (typeof text !== "string" || this.istGepackt(text)) return text;
        return this.PRAEFIX + this._verdichte(text);
    },

    /** Entpackt einen verdichteten Text; alles andere kommt unverändert zurück */
    entpacke(text) {
        if (!this.istGepackt(text)) return text;
        const roh = this._entdichte(text.slice(this.PRAEFIX.length));
        if (roh === null) throw new Error("Verdichteter Spielstand ist beschädigt.");
        return roh;
    },

    /**
     * LZW mit einem Baum statt eines Wörterbuchs aus Zeichenketten: Jeder
     * Knoten ist ein bekanntes Wort, seine Kinder die Wörter, die ein Zeichen
     * länger sind. So entsteht beim Verdichten keine einzige neue
     * Zeichenkette - bei fünf Millionen Zeichen der Unterschied zwischen
     * einer halben und mehreren Sekunden.
     */
    _verdichte(eingabe) {
        const BITS = 15;
        const daten = [];
        let wert = 0, position = 0;
        let erweitern = 2, groesse = 3, bits = 2;
        const wurzel = new Map();
        const neueZeichen = new Set();

        const schreibe = (v, anzahl) => {
            for (let i = 0; i < anzahl; i++) {
                wert = (wert << 1) | (v & 1);
                if (position === BITS - 1) {
                    position = 0;
                    daten.push(String.fromCharCode(wert + 32));
                    wert = 0;
                } else {
                    position++;
                }
                v >>= 1;
            }
        };
        const zaehle = () => {
            erweitern--;
            if (erweitern === 0) {
                erweitern = Math.pow(2, bits);
                bits++;
            }
        };
        const gib = (knoten) => {
            if (neueZeichen.has(knoten)) {
                if (knoten.zeichen < 256) {
                    schreibe(0, bits);
                    schreibe(knoten.zeichen, 8);
                } else {
                    schreibe(1, bits);
                    schreibe(knoten.zeichen, 16);
                }
                zaehle();
                neueZeichen.delete(knoten);
            } else {
                schreibe(knoten.code, bits);
            }
            zaehle();
        };

        let knoten = null;
        for (let i = 0; i < eingabe.length; i++) {
            const cc = eingabe.charCodeAt(i);
            let einzel = wurzel.get(cc);
            if (!einzel) {
                einzel = { code: groesse++, zeichen: cc, kinder: new Map() };
                wurzel.set(cc, einzel);
                neueZeichen.add(einzel);
            }
            if (knoten === null) {
                knoten = einzel;
                continue;
            }
            const weiter = knoten.kinder.get(cc);
            if (weiter) {
                knoten = weiter;
            } else {
                gib(knoten);
                knoten.kinder.set(cc, { code: groesse++, kinder: new Map() });
                knoten = einzel;
            }
        }
        if (knoten !== null) gib(knoten);

        // Ende des Datenstroms
        schreibe(2, bits);
        // Den Rest des letzten Zeichens auffüllen
        for (;;) {
            wert <<= 1;
            if (position === BITS - 1) {
                daten.push(String.fromCharCode(wert + 32));
                break;
            }
            position++;
        }
        return daten.join("");
    },

    _entdichte(text) {
        if (!text) return "";
        const START = 16384;
        const naechster = (i) => text.charCodeAt(i) - 32;
        const woerterbuch = [0, 1, 2];
        const ergebnis = [];
        let erweitern = 4, groesse = 4, bits = 3;
        let wert = naechster(0), position = START, index = 1;

        const lies = (anzahl) => {
            let ausgabe = 0;
            const grenze = Math.pow(2, anzahl);
            let stelle = 1;
            while (stelle !== grenze) {
                const bit = wert & position;
                position >>= 1;
                if (position === 0) {
                    position = START;
                    wert = naechster(index++);
                }
                ausgabe |= (bit > 0 ? 1 : 0) * stelle;
                stelle <<= 1;
            }
            return ausgabe;
        };

        let c;
        switch (lies(2)) {
            case 0: c = String.fromCharCode(lies(8)); break;
            case 1: c = String.fromCharCode(lies(16)); break;
            default: return "";
        }
        woerterbuch[3] = c;
        let w = c;
        ergebnis.push(c);

        for (;;) {
            if (index > text.length) return "";
            let code = lies(bits);
            if (code === 0 || code === 1) {
                woerterbuch[groesse++] = String.fromCharCode(lies(code === 0 ? 8 : 16));
                code = groesse - 1;
                erweitern--;
            } else if (code === 2) {
                return ergebnis.join("");
            }
            if (erweitern === 0) {
                erweitern = Math.pow(2, bits);
                bits++;
            }
            let eintrag;
            if (woerterbuch[code] !== undefined) eintrag = woerterbuch[code];
            else if (code === groesse) eintrag = w + w.charAt(0);
            else return null;
            ergebnis.push(eintrag);
            woerterbuch[groesse++] = w + eintrag.charAt(0);
            erweitern--;
            w = eintrag;
            if (erweitern === 0) {
                erweitern = Math.pow(2, bits);
                bits++;
            }
        }
    }
};

if (typeof window !== "undefined") {
    window.Kompressor = Kompressor;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { Kompressor };
}
