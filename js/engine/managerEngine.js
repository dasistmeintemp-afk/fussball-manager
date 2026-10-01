/**
 * ManagerEngine - Die Arbeit am Menschen: Ansprachen, Pressekonferenzen
 * und die Frage, was heute eigentlich ansteht
 *
 * Ein Fußballmanager verwaltet keine Tabellen, er redet mit Leuten. Vor dem
 * Anpfiff und in der Halbzeit entscheidet der Ton der Ansprache mit, ob die
 * Mannschaft befreit aufspielt oder verkrampft. Auf der Pressekonferenz kann
 * man Druck vom Team nehmen - oder ihn erhöhen.
 */

const _mgrResolve = (() => {
    const factory = (typeof createResolver !== "undefined" && createResolver)
        ? createResolver
        : ((typeof window !== "undefined" && window.createResolver)
            ? window.createResolver
            : (typeof require !== "undefined" ? require("../core/moduleResolver.js").createResolver : null));

    if (factory) return factory(typeof require !== "undefined" ? require : null);
    return (name) => (typeof window !== "undefined" ? window[name] : null) || null;
})();

/** Geldbetrag kurz: "12,5 Mio. €" oder "850 Tsd. €" */
const _mgrGeld = (betrag) => {
    const b = Number(betrag) || 0;
    if (Math.abs(b) >= 1000000) return `${(b / 1000000).toFixed(1).replace(".", ",")} Mio. €`;
    return `${Math.round(b / 1000)} Tsd. €`;
};

class ManagerEngine {
    /**
     * Die fünf Tonlagen einer Ansprache.
     *
     * fit(kontext) liefert -1 bis +1: Wie gut passt dieser Ton zur Lage?
     * Wer ein 3:0 führendes Team anbrüllt, erreicht das Gegenteil.
     */
    static TEAM_TALK_TONES = [
        {
            key: "calm",
            icon: "🧊",
            label: "Ruhig bleiben",
            line: "Kein Grund zur Hektik. Wir spielen unser Spiel, so wie wir es trainiert haben.",
            hint: "Wirkt fast immer ein wenig, nie viel. Die sichere Bank."
        },
        {
            key: "motivate",
            icon: "🔥",
            label: "Anfeuern",
            line: "Das ist unser Spiel! Geht raus und holt euch, was euch gehört!",
            hint: "Stark, wenn die Mannschaft Rückenwind braucht - Favoriten überdreht es."
        },
        {
            key: "demand",
            icon: "📣",
            label: "Mehr fordern",
            line: "Das war zu wenig. Ich will Laufbereitschaft sehen, und zwar von jedem.",
            hint: "Erreicht Profis. Bei einer verunsicherten Mannschaft geht es nach hinten los."
        },
        {
            key: "trust",
            icon: "🤝",
            label: "Vertrauen aussprechen",
            line: "Ich glaube an diese Mannschaft. Ihr müsst nichts beweisen, spielt einfach.",
            hint: "Fängt Verunsicherte auf, verpufft bei einer selbstbewussten Truppe."
        },
        {
            key: "angry",
            icon: "💢",
            label: "Lautstark werden",
            line: "So nicht! Wenn sich das nicht ändert, sitzen hier gleich andere auf dem Platz.",
            hint: "Das ganz große Besteck. Wirkt bei klarem Rückstand - sonst zerlegt es die Kabine."
        }
    ];

    /**
     * Fragen der Journalisten. Jede Antwort verschiebt Stimmung und Druck.
     *
     * gewicht(ctx) sagt, wie dringend ein Thema heute ist (0: passt nicht).
     * Die Dauerbrenner (Form, Vorstand, Fans) füllen auf, wenn nichts
     * Besonderes ansteht - ein Derby, eine Serie oder ein Gerücht verdrängt
     * sie. Antworten können Folgen haben: Eine Kampfansage motiviert den
     * Gegner (gegnerMoral), ein Versprechen wird nach dem Spiel abgerechnet.
     */
    static PRESS_TOPICS = [
        {
            id: "form",
            gruppe: "form",
            gewicht: () => 1,
            question: (ctx) => ctx.formTrend >= 0
                ? `Ihre Mannschaft ist gut in Form. Reicht das für ${ctx.opponentName}?`
                : `Zuletzt lief es nicht. Was macht Ihnen Hoffnung gegen ${ctx.opponentName}?`,
            answers: [
                { key: "confident", label: "Wir gewinnen dieses Spiel.", fanMood: 4, mediaPressure: 6, morale: 3, board: 2,
                  versprechen: "sieg",
                  response: "Eine klare Ansage - die Fans feiern sie, die Journalisten notieren sie." },
                { key: "humble", label: "Wir nehmen jedes Spiel, wie es kommt.", fanMood: 0, mediaPressure: -4, morale: 1, board: 1,
                  response: "Sachlich und unaufgeregt. Der Druck bleibt handlich." },
                { key: "deflect", label: "Fragen Sie mich das nach dem Abpfiff.", fanMood: -3, mediaPressure: -6, morale: 0, board: -1,
                  response: "Kurz angebunden. Die Presse schreibt über etwas anderes." }
            ]
        },
        {
            id: "player",
            medium: "boulevard",
            ziel: "playerId",
            // Nur wer wirklich schwach spielt, steht in der Kritik
            gewicht: (ctx) => (ctx.playerId && ctx.kritikForm < 6.3 ? 2.5 : 0.4),
            question: (ctx) => `${ctx.playerName} steht in der Kritik. Halten Sie an ihm fest?`,
            answers: [
                { key: "defend", label: "Er hat mein volles Vertrauen.", fanMood: 1, mediaPressure: 2, morale: 5, board: 0,
                  response: "Die Rückendeckung kommt in der Kabine an.", targetMorale: 12 },
                { key: "neutral", label: "Er weiß, woran er arbeiten muss.", fanMood: 0, mediaPressure: 0, morale: 0, board: 1,
                  response: "Eine Antwort ohne Angriffsfläche." },
                { key: "criticise", label: "Diese Leistung war nicht akzeptabel.", fanMood: 3, mediaPressure: 4, morale: -4, board: 1,
                  response: "Klartext. Der Betroffene hat es im Radio gehört.", targetMorale: -15,
                  schlagzeile: (ctx) => `Trainer rechnet öffentlich mit ${ctx.playerName} ab` }
            ]
        },
        {
            id: "board",
            gruppe: "vorstand",
            medium: "fach",
            gewicht: () => 0.8,
            question: () => "Der Vorstand hat ein Saisonziel ausgegeben. Ist das realistisch?",
            answers: [
                { key: "ambitious", label: "Wir wollen mehr als das.", fanMood: 5, mediaPressure: 8, morale: 2, board: 4,
                  response: "Große Worte. Daran werden Sie gemessen." },
                { key: "loyal", label: "Das Ziel ist genau richtig gesetzt.", fanMood: 1, mediaPressure: 0, morale: 1, board: 3,
                  response: "Der Vorstand hört das gern." },
                { key: "honest", label: "Dafür brauchen wir noch Verstärkung.", fanMood: -2, mediaPressure: -3, morale: -1, board: -3,
                  response: "Ehrlich, aber der Vorstand fühlt sich vorgeführt." }
            ]
        },
        {
            id: "fans",
            medium: "lokal",
            gewicht: () => 0.9,
            question: (ctx) => `Die Anhänger von ${ctx.clubName} erwarten Ergebnisse. Spüren Sie das?`,
            answers: [
                { key: "embrace", label: "Diese Fans sind unser zwölfter Mann.", fanMood: 6, mediaPressure: 2, morale: 2, board: 1,
                  response: "Die Kurve nimmt das auf." },
                { key: "focus", label: "Wir konzentrieren uns auf den Platz.", fanMood: -1, mediaPressure: -2, morale: 1, board: 1,
                  response: "Nüchtern. Niemand regt sich auf." },
                { key: "shield", label: "Der Druck darf nicht auf die Spieler durchschlagen.", fanMood: -2, mediaPressure: -7, morale: 4, board: 0,
                  response: "Sie stellen sich vor die Mannschaft - die Spieler danken es Ihnen." }
            ]
        },
        {
            id: "derby",
            medium: "boulevard",
            gewicht: (ctx) => (ctx.derbyTitel ? 6 : 0),
            question: (ctx) => `${ctx.derbyTitel} gegen ${ctx.opponentName}. Was bedeutet Ihnen dieses Spiel?`,
            answers: [
                { key: "kampfansage", label: "Das ist unsere Stadt - am Spieltag zeigen wir es.", fanMood: 8, mediaPressure: 8, morale: 2, board: 0,
                  gegnerMoral: 6, versprechen: "sieg",
                  response: "Die Kurve tobt - und beim Gegner hängt Ihr Satz ab heute in der Kabine.",
                  schlagzeile: (ctx) => `Kampfansage vor dem ${ctx.derbyTitel}: „Das ist unsere Stadt!“` },
                { key: "respekt", label: (ctx) => `Wir haben großen Respekt vor ${ctx.opponentName}.`, fanMood: -2, mediaPressure: -4, morale: 0, board: 1,
                  response: "Diplomatisch. Den eigenen Fans ist das zu brav." },
                { key: "dreiPunkte", label: "Es gibt auch in diesem Spiel nur drei Punkte.", fanMood: -5, mediaPressure: -6, morale: 1, board: 0,
                  response: "Die Kurve hört das gar nicht gern - die Mannschaft spielt dafür befreiter." }
            ]
        },
        {
            id: "siegesserie",
            gruppe: "form",
            medium: "boulevard",
            gewicht: (ctx) => (ctx.siegSerie >= 3 ? 4 : 0),
            question: (ctx) => `${ctx.siegSerie} Siege in Folge. Ist Ihre Mannschaft überhaupt noch zu schlagen?`,
            answers: [
                { key: "weiter", label: "Wir sind noch lange nicht am Ende.", fanMood: 5, mediaPressure: 6, morale: 3, board: 1,
                  versprechen: "ungeschlagen",
                  response: "Selbstbewusst. Die nächste Niederlage wird man Ihnen vorhalten.",
                  schlagzeile: (ctx) => `${ctx.clubName} kündigt an: „Wir sind noch lange nicht am Ende“` },
                { key: "null", label: "Jedes Spiel fängt wieder bei null an.", fanMood: 1, mediaPressure: -3, morale: 1, board: 1,
                  response: "Die Phrase sitzt - niemand kann Ihnen etwas." },
                { key: "reisst", label: "Irgendwann reißt jede Serie.", fanMood: -3, mediaPressure: -6, morale: -2, board: 0,
                  response: "Ehrlich, aber in der Kabine kommt es als Misstrauen an." }
            ]
        },
        {
            id: "krise",
            gruppe: "form",
            medium: "boulevard",
            gewicht: (ctx) => (ctx.niederlagenSerie >= 3 ? 5 : 0),
            question: (ctx) => `${ctx.niederlagenSerie} Niederlagen in Folge. Fürchten Sie um Ihren Job?`,
            answers: [
                { key: "verantwortung", label: "Die Verantwortung liegt bei mir, nicht bei den Spielern.", fanMood: 2, mediaPressure: -5, morale: 5, board: -1,
                  response: "Sie stellen sich vor die Mannschaft - die Spieler rechnen es Ihnen an." },
                { key: "gemeinsam", label: "Wir kommen da gemeinsam wieder raus.", fanMood: 2, mediaPressure: -1, morale: 2, board: 1,
                  response: "Ein Satz für die Kabine und den Vorstand." },
                { key: "vorwurf", label: "Einige Spieler müssen sich fragen, ob sie alles geben.", fanMood: 1, mediaPressure: 3, morale: -5, board: 1,
                  response: "Die Kabine hört den Vorwurf - und schweigt.",
                  schlagzeile: () => "Trainer stellt die eigene Mannschaft an den Pranger" }
            ]
        },
        {
            id: "tabellenspitze",
            gruppe: "tabelle",
            medium: "fach",
            gewicht: (ctx) => (ctx.platz && ctx.platz <= 2 && ctx.gespielt >= 4 ? 3 : 0),
            question: (ctx) => ctx.platz === 1
                ? "Sie sind Tabellenführer. Reden Sie jetzt vom Titel?"
                : "Nur knapp hinter der Spitze. Greifen Sie nach dem Titel?",
            answers: [
                { key: "titel", label: "Ja - wir wollen den Titel.", fanMood: 6, mediaPressure: 9, morale: 2, board: 2,
                  response: "Das Wort ist raus. Ab jetzt wird jedes Unentschieden daran gemessen.",
                  schlagzeile: (ctx) => `${ctx.clubName} greift offen nach dem Titel` },
                { key: "abrechnung", label: "Abgerechnet wird am Ende.", fanMood: 0, mediaPressure: -3, morale: 1, board: 1,
                  response: "Der Klassiker. Niemand kann Ihnen einen Strick daraus drehen." },
                { key: "andere", label: "Die Favoriten sind andere.", fanMood: -2, mediaPressure: -6, morale: 0, board: 0,
                  response: "Tiefstapeln nimmt Druck - den Fans ist es zu wenig." }
            ]
        },
        {
            id: "abstiegskampf",
            gruppe: "tabelle",
            medium: "lokal",
            gewicht: (ctx) => (ctx.abstiegszone && ctx.gespielt >= 4 ? 4 : 0),
            question: () => "Sie stehen auf einem Abstiegsplatz. Glauben Sie noch an den Klassenerhalt?",
            answers: [
                { key: "hand", label: "Wir bleiben drin - dafür lege ich die Hand ins Feuer.", fanMood: 5, mediaPressure: 6, morale: 3, board: 1,
                  response: "Ein Versprechen, das die Stadt nicht vergessen wird." },
                { key: "weg", label: "Es wird ein harter Weg, aber wir sind bereit.", fanMood: 2, mediaPressure: 0, morale: 2, board: 1,
                  response: "Ehrlich und kämpferisch - das kommt an." },
                { key: "qualitaet", label: "Die Qualität im Kader reicht nicht.", fanMood: -4, mediaPressure: -3, morale: -5, board: -3,
                  response: "Die Spieler lesen es morgen in der Zeitung. Der Vorstand auch.",
                  schlagzeile: () => "Trainer: „Die Qualität im Kader reicht nicht“" }
            ]
        },
        {
            id: "ultimatum",
            gruppe: "vorstand",
            medium: "boulevard",
            gewicht: (ctx) => (ctx.vorstandKritisch ? 5 : 0),
            question: () => "Der Vorstand soll Ihnen ein Ultimatum gestellt haben. Wie lange sind Sie noch Trainer?",
            answers: [
                { key: "vertrauen", label: "Ich spüre das Vertrauen des Vorstands.", fanMood: 0, mediaPressure: 3, morale: 0, board: 2,
                  response: "Der Vorstand schweigt dazu - die Presse deutet das Schweigen." },
                { key: "ergebnisse", label: "Ich messe mich an Ergebnissen, nicht an Gerüchten.", fanMood: 1, mediaPressure: -4, morale: 1, board: 1,
                  response: "Gelassen. Das nimmt dem Thema die Luft." },
                { key: "haltung", label: "Wenn ich gehen muss, dann erhobenen Hauptes.", fanMood: 3, mediaPressure: -2, morale: 2, board: -2,
                  response: "Die Fans mögen das. Der Vorstand liest es als Abschiedsrede." }
            ]
        },
        {
            id: "ausfall",
            medium: "lokal",
            gewicht: (ctx) => (ctx.verletzterName ? 3.5 : 0),
            question: (ctx) => `${ctx.verletzterName} fällt verletzt aus. Wie wollen Sie das auffangen?`,
            answers: [
                { key: "breite", label: "Wir haben einen breiten Kader - jetzt schlägt die Stunde der anderen.", fanMood: 1, mediaPressure: 1, morale: 3, board: 1,
                  response: "Die Ersatzleute fühlen sich angesprochen." },
                { key: "unersetzlich", label: "Er ist nicht zu ersetzen.", fanMood: 0, mediaPressure: -3, morale: -3, board: 0,
                  response: "Ehrlich - aber die, die jetzt spielen sollen, haben es gehört." },
                { key: "ausreden", label: "Keine Ausreden. Wer spielt, liefert.", fanMood: 2, mediaPressure: 2, morale: 1, board: 2,
                  response: "Kein Jammern - das gefällt dem Vorstand." }
            ]
        },
        {
            id: "geruecht",
            medium: "boulevard",
            ziel: "geruechtId",
            gewicht: (ctx) => (ctx.geruechtName ? 4 : 0),
            question: (ctx) => ctx.geruechtVerein
                ? `${ctx.geruechtVerein} bietet für ${ctx.geruechtName}. Bleibt er?`
                : `${ctx.geruechtName} soll unzufrieden sein. Steht er vor dem Absprung?`,
            answers: [
                { key: "unverkaeuflich", label: "Er ist unverkäuflich.", fanMood: 4, mediaPressure: 2, morale: 1, board: -1, targetMorale: 8,
                  response: "Klare Kante - der Spieler freut sich, der Vorstand rechnet nach.",
                  schlagzeile: (ctx) => `„${ctx.geruechtName} ist unverkäuflich“` },
                { key: "preis", label: "Jeder hat seinen Preis.", fanMood: -5, mediaPressure: 3, morale: -1, board: 2, targetMorale: -8,
                  response: "Der Vorstand nickt, die Kurve pfeift - und der Spieler fühlt sich auf dem Markt.",
                  schlagzeile: (ctx) => `Trainer öffnet die Tür für ${ctx.geruechtName}` },
                { key: "kommentar", label: "Zu Gerüchten sage ich nichts.", fanMood: -1, mediaPressure: -2, morale: 0, board: 0,
                  response: "Das Gerücht lebt weiter - aber ohne Ihre Hilfe." }
            ]
        },
        {
            id: "gegnerstar",
            medium: "fach",
            gewicht: (ctx) => (ctx.gegnerStar ? 2.5 : 0),
            question: (ctx) => `${ctx.gegnerStar} ist der Mann bei ${ctx.opponentName}. Wie wollen Sie ihn stoppen?`,
            answers: [
                { key: "plan", label: "Wir haben einen Plan für ihn.", fanMood: 1, mediaPressure: 1, morale: 2, board: 1,
                  response: "Neugierig macht das alle - verraten haben Sie nichts." },
                { key: "wir", label: "Wir schauen nur auf uns.", fanMood: 0, mediaPressure: -3, morale: 1, board: 0,
                  response: "Unaufgeregt. Das Thema ist durch." },
                { key: "spott", label: "Er ist auch nur ein Mensch.", fanMood: 3, mediaPressure: 4, morale: 0, board: 0, gegnerMoral: 4,
                  response: "Ein Satz, den sich drüben jemand ausschneiden wird.",
                  schlagzeile: (ctx) => `„${ctx.gegnerStar} ist auch nur ein Mensch“` }
            ]
        },
        {
            id: "kantersieg",
            gruppe: "form",
            medium: "lokal",
            gewicht: (ctx) => (ctx.letzteDifferenz >= 3 ? 4.5 : 0),
            question: (ctx) => `Das ${ctx.letztesErgebnis} gegen ${ctx.letzterGegner} - wie hoch hängen Sie den Sieg?`,
            answers: [
                { key: "anfang", label: "Das war erst der Anfang.", fanMood: 5, mediaPressure: 5, morale: 2, board: 1,
                  response: "Die Stadt ist euphorisch - die Erwartungen auch." },
                { key: "abhaken", label: "Schön, aber abhaken - das nächste Spiel zählt.", fanMood: 1, mediaPressure: -3, morale: 1, board: 1,
                  response: "Professionell. Die Mannschaft bleibt am Boden." },
                { key: "leicht", label: "Der Gegner hat es uns leicht gemacht.", fanMood: -2, mediaPressure: -2, morale: -1, board: 0,
                  response: "Bescheiden - die Spieler hätten sich mehr Lob gewünscht." }
            ]
        },
        {
            id: "debakel",
            gruppe: "form",
            medium: "boulevard",
            gewicht: (ctx) => (ctx.letzteDifferenz <= -3 ? 5 : 0),
            question: (ctx) => `Das ${ctx.letztesErgebnis} gegen ${ctx.letzterGegner} - was ist da passiert?`,
            answers: [
                { key: "kappe", label: "Das geht auf meine Kappe.", fanMood: 2, mediaPressure: -4, morale: 4, board: -1,
                  response: "Sie nehmen die Schuld auf sich - die Kabine atmet auf." },
                { key: "konsequenzen", label: "So etwas darf nicht passieren - das hat Konsequenzen.", fanMood: 3, mediaPressure: 3, morale: -4, board: 2,
                  response: "Die Drohung kommt an. Ob sie hilft, zeigt das nächste Spiel.",
                  schlagzeile: () => "Nach dem Debakel: Trainer kündigt Konsequenzen an" },
                { key: "ausrutscher", label: "Ein Ausrutscher, mehr nicht.", fanMood: -3, mediaPressure: 1, morale: 1, board: -1,
                  response: "Die Fans sehen das anders." }
            ]
        }
    ];

    /**
     * Fragen nach dem Abpfiff - kürzer, und direkt am Ergebnis. Wer vorher
     * große Worte gemacht hat, wird jetzt daran erinnert.
     */
    static NACH_SPIEL_TOPICS = [
        {
            id: "nachSieg",
            gruppe: "ergebnis",
            medium: "lokal",
            gewicht: (ctx) => (ctx.differenz > 0 ? 3 : 0),
            question: (ctx) => `Das ${ctx.ergebnis} gegen ${ctx.opponentName} - ein verdienter Sieg?`,
            answers: [
                { key: "umgesetzt", label: "Die Mannschaft hat alles umgesetzt, was wir besprochen haben.", fanMood: 2, mediaPressure: 1, morale: 3, board: 1,
                  response: "Lob für alle - die Kabine feiert mit." },
                { key: "glueck", label: "Wir hatten heute auch das nötige Glück.", fanMood: 0, mediaPressure: -3, morale: 0, board: 0,
                  response: "Bescheiden. Der Druck sinkt." },
                { key: "mehr", label: "Drei Punkte, aber da geht noch deutlich mehr.", fanMood: 1, mediaPressure: 2, morale: -1, board: 2,
                  response: "Der Vorstand mag den Hunger - die Spieler hätten sich mehr Lob gewünscht." }
            ]
        },
        {
            id: "nachRemis",
            gruppe: "ergebnis",
            medium: "fach",
            gewicht: (ctx) => (ctx.differenz === 0 ? 3 : 0),
            question: (ctx) => `${ctx.ergebnis} gegen ${ctx.opponentName}. Ein gewonnener oder ein verlorener Punkt?`,
            answers: [
                { key: "gewonnen", label: "Ein gewonnener Punkt - damit können wir leben.", fanMood: -1, mediaPressure: -3, morale: 2, board: 0,
                  response: "Zufrieden mit wenig - nicht jeder Fan sieht das so." },
                { key: "verloren", label: "Zwei verlorene Punkte. Wir wollten gewinnen.", fanMood: 2, mediaPressure: 2, morale: -1, board: 1,
                  response: "Der Anspruch ist klar - die Mannschaft hört die Kritik mit." },
                { key: "leistung", label: "Mich interessiert die Leistung, und die war in Ordnung.", fanMood: 0, mediaPressure: -1, morale: 1, board: 1,
                  response: "Sachlich. Kein Stoff für Schlagzeilen." }
            ]
        },
        {
            id: "nachNiederlage",
            gruppe: "ergebnis",
            medium: "boulevard",
            gewicht: (ctx) => (ctx.differenz < 0 ? 3 + Math.min(2, -ctx.differenz - 1) : 0),
            question: (ctx) => `Das ${ctx.ergebnis} gegen ${ctx.opponentName}. Was hat heute gefehlt?`,
            answers: [
                { key: "verdient", label: "Wir haben verdient verloren. Punkt.", fanMood: 1, mediaPressure: -3, morale: -1, board: 1,
                  response: "Ehrlich - das nimmt der Presse den Wind aus den Segeln." },
                { key: "schiri", label: "Der Schiedsrichter hat dieses Spiel entschieden.", fanMood: 3, mediaPressure: 5, morale: 1, board: -2,
                  response: "Die Kurve ist bei Ihnen, der Vorstand nicht - und der Verband liest mit.",
                  schlagzeile: () => "Trainer wütet gegen den Schiedsrichter" },
                { key: "schutz", label: "Ich nehme meine Mannschaft ausdrücklich in Schutz.", fanMood: -1, mediaPressure: -2, morale: 4, board: 0,
                  response: "Die Spieler wissen, was sie an Ihnen haben." }
            ]
        },
        {
            id: "matchwinner",
            medium: "lokal",
            ziel: "besterId",
            gewicht: (ctx) => (ctx.besterNote >= 8 ? 2.5 : 0),
            question: (ctx) => `${ctx.besterName} war heute der beste Mann auf dem Platz. Was sagen Sie zu ihm?`,
            answers: [
                { key: "lob", label: "Ein überragendes Spiel - genau das kann er.", fanMood: 1, mediaPressure: 0, morale: 1, board: 0, targetMorale: 10,
                  response: "Er strahlt über das ganze Gesicht." },
                { key: "team", label: "Einzelne herauszuheben ist nicht meine Art.", fanMood: 0, mediaPressure: -1, morale: 2, board: 0,
                  response: "Die Mannschaft nimmt es als Kompliment an alle." },
                { key: "mehrDrin", label: "Gut, aber bei ihm ist noch mehr drin.", fanMood: 0, mediaPressure: 1, morale: 0, board: 1, targetMorale: -4,
                  response: "Ein Ansporn - oder ein Dämpfer, je nachdem, wen man fragt." }
            ]
        },
        {
            id: "platzverweis",
            medium: "boulevard",
            ziel: "rotId",
            gewicht: (ctx) => (ctx.rotName ? 3.5 : 0),
            question: (ctx) => `Die Rote Karte gegen ${ctx.rotName} - war das der Knackpunkt?`,
            answers: [
                { key: "dumm", label: "Das war unprofessionell und hat uns das Spiel gekostet.", fanMood: 1, mediaPressure: 3, morale: -1, board: 2, targetMorale: -10,
                  response: "Öffentliche Kritik - er wird es nicht vergessen.",
                  schlagzeile: (ctx) => `Trainer lässt ${ctx.rotName} nach Rot im Regen stehen` },
                { key: "intern", label: "Das klären wir intern.", fanMood: 0, mediaPressure: -3, morale: 0, board: 1,
                  response: "Kein Futter für die Presse." },
                { key: "hart", label: "Eine harte Entscheidung - so ist Fußball.", fanMood: 2, mediaPressure: 0, morale: 1, board: -1, targetMorale: 5,
                  response: "Sie stellen sich vor ihn - die Kabine registriert es." }
            ]
        },
        {
            id: "wortGehalten",
            medium: "boulevard",
            gewicht: (ctx) => (ctx.versprechen === "gehalten" ? 4 : ctx.versprechen === "gebrochen" ? 4.5 : 0),
            question: (ctx) => ctx.versprechen === "gehalten"
                ? "Sie hatten es angekündigt, und Sie haben geliefert. Genugtuung?"
                : "Große Worte vor dem Spiel, jetzt dieses Ergebnis. Bereuen Sie die Ansage?",
            answers: [
                { key: "stehen", label: "Ich stehe zu jedem Wort.", fanMood: 2, mediaPressure: 3, morale: 1, board: 0,
                  response: "Konsequent - ob man das mag oder nicht." },
                { key: "demut", label: "Das Ergebnis spricht für sich - mehr sage ich nicht.", fanMood: 0, mediaPressure: -3, morale: 0, board: 1,
                  response: "Zurückhaltung beruhigt die Lage." },
                { key: "fehler", label: "Vielleicht war die Ansage ein Fehler.", fanMood: -1, mediaPressure: -4, morale: 1, board: 0,
                  response: "Selbstkritisch - die Presse lässt das Thema fallen." }
            ]
        }
    ];

    /**
     * Wer fragt: Das Boulevardblatt macht aus jedem Satz eine Schlagzeile,
     * die Fachpresse liest der Vorstand, die Lokalzeitung die Kurve.
     */
    static PRESSE_MEDIEN = {
        boulevard: { name: "Sportblitz", icon: "📰", art: "Boulevard", faktor: { fanMood: 1.2, mediaPressure: 1.5, board: 0.8 } },
        fach: { name: "Taktikblatt", icon: "📊", art: "Fachpresse", faktor: { fanMood: 0.7, mediaPressure: 0.8, board: 1.4 } },
        lokal: { name: "Lokalanzeiger", icon: "🏘️", art: "Lokalzeitung", faktor: { fanMood: 1.5, mediaPressure: 0.9, board: 1 } }
    };

    static JOURNALISTEN = ["Sabine Kröger", "Tobias Wendt", "Mehmet Aydın", "Julia Brandauer",
        "Frank Oster", "Lena Marquardt", "Dirk Hanselmann", "Aylin Demir", "Paul Riedl", "Katrin Sommer"];

    static getGameState() {
        return _mgrResolve("GameState", "./gameState.js");
    }

    static getNewsEngine() {
        return _mgrResolve("NewsEngine", "./newsEngine.js");
    }

    static clubOf(state, clubId) {
        return (state.clubs || []).find(c => c.id === (clubId || state.userClubId)) || null;
    }

    static squadOf(state, club) {
        if (!club) return [];
        return (state.players || []).filter(p => club.playerIds.includes(p.id));
    }

    // ------------------------------------------------------------ Ansprache

    /**
     * Lage vor der Ansprache: Wer ist Favorit, wie steht es, wie ist die
     * Stimmung? Daraus ergibt sich, welcher Ton passt.
     */
    static buildTalkContext(state, options = {}) {
        const club = this.clubOf(state, options.clubId);
        const squad = this.squadOf(state, club).filter(p => (p.injuredWeeks || 0) === 0);

        const opponent = options.opponentClubId
            ? this.clubOf(state, options.opponentClubId)
            : null;

        const avgMorale = squad.length
            ? squad.reduce((s, p) => s + (p.morale || 70), 0) / squad.length
            : 70;

        const eigenerRuf = club?.reputation || 50;
        const gegnerRuf = opponent?.reputation || eigenerRuf;

        return {
            phase: options.phase === "halftime" ? "halftime" : "prematch",
            clubId: club?.id || null,
            clubName: club?.name || "Ihr Verein",
            opponentName: opponent?.name || "den Gegner",
            isFavourite: eigenerRuf >= gegnerRuf + 6,
            isUnderdog: eigenerRuf <= gegnerRuf - 6,
            scoreDiff: options.scoreDiff || 0,
            avgMorale: Math.round(avgMorale),
            squadSize: squad.length
        };
    }

    /**
     * Wie gut passt ein Ton zur Lage? -1 (kontraproduktiv) bis +1 (ideal).
     */
    static toneFit(toneKey, ctx) {
        const fuehrt = ctx.scoreDiff > 0;
        const zurueck = ctx.scoreDiff < 0;
        const klarZurueck = ctx.scoreDiff <= -2;
        const verunsichert = ctx.avgMorale < 62;
        const selbstbewusst = ctx.avgMorale > 82;

        switch (toneKey) {
            case "calm":
                // Immer solide, glänzt aber nie
                return fuehrt ? 0.55 : (klarZurueck ? 0.1 : 0.35);

            case "motivate":
                if (ctx.isUnderdog) return 0.8;
                if (zurueck) return 0.65;
                if (ctx.isFavourite && selbstbewusst) return -0.15; // überdreht
                return 0.4;

            case "demand":
                if (ctx.isFavourite && !fuehrt) return 0.75;
                if (verunsichert) return -0.5;
                if (fuehrt) return 0.2;
                return 0.3;

            case "trust":
                if (verunsichert) return 0.85;
                if (ctx.isUnderdog) return 0.55;
                if (selbstbewusst) return 0.05;
                return 0.35;

            case "angry":
                if (klarZurueck) return 0.6;
                if (zurueck && ctx.isFavourite) return 0.35;
                if (fuehrt) return -0.85;   // zerstört eine gute Stimmung
                return -0.4;

            default:
                return 0;
        }
    }

    /**
     * Führt die Ansprache aus.
     *
     * Jeder Spieler reagiert eigen: Ein Profi nimmt Kritik sachlich, ein
     * Temperamentbündel explodiert in beide Richtungen. Ergebnis sind
     * Moral- und Formänderungen sowie ein paar Reaktionen zum Nachlesen.
     */
    static applyTeamTalk(state, toneKey, options = {}) {
        const tone = this.TEAM_TALK_TONES.find(t => t.key === toneKey);
        if (!tone) return { success: false, error: "Unbekannte Ansprache." };

        const ctx = this.buildTalkContext(state, options);
        const club = this.clubOf(state, options.clubId);
        if (!club) return { success: false, error: "Verein nicht gefunden." };

        const squad = this.squadOf(state, club).filter(p => (p.injuredWeeks || 0) === 0);
        const fit = this.toneFit(toneKey, ctx);
        // Ein Motivator trifft den Ton besser: Gute Ansprachen wirken stärker,
        // schlechte schaden weniger
        const profil = _mgrResolve("TrainerProfilEngine", "./trainerProfilEngine.js");
        const motivation = club.id === state.userClubId && profil ? profil.faktor(state, "motivation", 0.25) : 1;

        const reaktionen = [];
        let moralSumme = 0;

        squad.forEach(player => {
            const hidden = player.hiddenAttributes || {};
            const temperament = hidden.temperament ?? 10;   // 1-20
            const professionalism = hidden.professionalism ?? 10;

            // Temperament verstärkt jede Ansprache, Professionalität dämpft sie
            const verstaerkung = 0.55 + (temperament / 20) * 0.9;
            const daempfung = toneKey === "angry" || toneKey === "demand"
                ? 1.25 - (professionalism / 20) * 0.5   // Profis stecken Kritik weg
                : 1.0;

            const wirkung = fit * verstaerkung * daempfung * (fit >= 0 ? motivation : 1 / motivation);
            const moralDelta = Math.round(wirkung * 9);
            const formDelta = Math.round(wirkung * 4) / 10;

            player.morale = Math.max(25, Math.min(100, (player.morale || 70) + moralDelta));
            player.form = Math.max(4, Math.min(10, (player.form || 7) + formDelta));

            moralSumme += moralDelta;

            if (Math.abs(moralDelta) >= 5 && reaktionen.length < 3) {
                reaktionen.push({
                    playerId: player.id,
                    name: player.name,
                    positive: moralDelta > 0,
                    text: moralDelta > 0
                        ? `${player.name} nickt und klatscht in die Hände.`
                        : `${player.name} schaut zu Boden und sagt nichts.`
                });
            }
        });

        const schnitt = squad.length ? moralSumme / squad.length : 0;
        let fazit;
        if (schnitt >= 4) fazit = "Die Mannschaft geht mit breiter Brust auf den Platz.";
        else if (schnitt >= 1.5) fazit = "Die Worte kommen an, die Körpersprache stimmt.";
        else if (schnitt > -1.5) fazit = "Die Ansprache verpufft weitgehend.";
        else if (schnitt > -4) fazit = "Ein paar Spieler wirken verunsichert.";
        else fazit = "Die Kabine ist still. Das war die falsche Ansprache.";

        // Der Vorstand bekommt mit, wie die Mannschaft eingestellt ist
        if (club.chemistry) {
            club.chemistry.dressingRoom = Math.max(30, Math.min(100,
                (club.chemistry.dressingRoom || 70) + Math.round(schnitt * 0.8)));
        }

        state.lastTeamTalk = {
            tone: toneKey,
            phase: ctx.phase,
            matchday: state.currentMatchday,
            moraleDelta: Math.round(schnitt * 10) / 10,
            summary: fazit
        };

        return {
            success: true,
            tone,
            line: tone.line,
            moraleDelta: Math.round(schnitt * 10) / 10,
            summary: fazit,
            reactions: reaktionen,
            fit: Math.round(fit * 100) / 100
        };
    }

    // ----------------------------------------------------- Pressekonferenz

    /**
     * Die Lage vor der Pressekonferenz: nächster Gegner, Derby, Serien,
     * Tabelle, Vorstand, Ausfälle, Gerüchte, das letzte Ergebnis. Daraus
     * suchen sich die Journalisten ihre Themen.
     */
    static pressKontext(state) {
        const club = this.clubOf(state);
        if (!club) return null;
        const squad = this.squadOf(state, club);
        const eigen = (m) => m.homeClubId === club.id || m.awayClubId === club.id;

        // Das nächste eigene Ligaspiel (ab dem laufenden Spieltag)
        const runden = (state.schedule || []).filter(r => r.matchday >= (state.currentMatchday || 1))
            .sort((a, b) => a.matchday - b.matchday);
        let match = null;
        for (const r of runden) {
            match = (r.matches || []).find(m => eigen(m) && !m.played) || null;
            if (match) break;
        }
        const opponentId = match ? (match.homeClubId === club.id ? match.awayClubId : match.homeClubId) : null;
        const opponent = opponentId ? this.clubOf(state, opponentId) : null;

        // Derby: aus dem Spielplan oder der Rivalität der Vereine
        const rivalry = _mgrResolve("RivalryEngine", "./rivalryEngine.js");
        const rivale = opponent && rivalry && typeof rivalry.findRivalry === "function" ? rivalry.findRivalry(club, opponent) : null;
        const derbyTitel = match?.isDerby ? (match.derbyTitle || rivale?.titel || "Derby")
            : (rivale && rivale.schaerfe >= 2 ? rivale.titel : null);

        // Spieler in der Kritik: schwächste Form unter denen, die spielen
        const stamm = squad.filter(p => (club.lineup || []).includes(p.id));
        const kritik = [...(stamm.length ? stamm : squad)].sort((a, b) => (a.form || 7) - (b.form || 7))[0];

        // Form und Serien - gespeichert wird W/D/L (ältere Stände S/U/N)
        const form = (club.form || []).filter(f => f && f !== "-");
        const sieg = (f) => f === "W" || f === "S";
        const niederlage = (f) => f === "L" || f === "N";
        const formTrend = form.filter(sieg).length - form.filter(niederlage).length;
        const serie = (test) => {
            let n = 0;
            for (let i = form.length - 1; i >= 0 && test(form[i]); i--) n++;
            return n;
        };

        // Tabelle
        const tabelle = state.standings || [];
        const platzIdx = tabelle.findIndex(t => t.clubId === club.id);
        const platz = platzIdx >= 0 ? platzIdx + 1 : null;
        const eintrag = platzIdx >= 0 ? tabelle[platzIdx] : null;
        const gespielt = eintrag ? (eintrag.played ?? ((eintrag.won || 0) + (eintrag.drawn || 0) + (eintrag.lost || 0))) : 0;

        // Ein Leistungsträger fällt aus
        const beste = [...squad].sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 3);
        const verletzt = beste.find(p => (p.injuredWeeks || 0) > 0);

        // Gerücht: ein Angebot für einen eigenen Spieler - oder ein
        // unzufriedener Leistungsträger
        const angebot = (state.transferMarket?.offers || []).find(o => o.toClubId === club.id && o.status === "pending");
        const unzufrieden = beste.find(p => (p.happiness?.overall ?? 70) < 45);
        const geruecht = angebot
            ? { id: angebot.playerId, name: angebot.playerName, verein: angebot.fromClubName }
            : (unzufrieden ? { id: unzufrieden.id, name: unzufrieden.name, verein: null } : null);

        // Der Star des Gegners: ragt aus seiner Mannschaft heraus
        let gegnerStar = null;
        if (opponent) {
            const gegnerKader = this.squadOf(state, opponent);
            const bester = [...gegnerKader].sort((a, b) => (b.overall || 0) - (a.overall || 0))[0];
            const schnitt = gegnerKader.length ? gegnerKader.reduce((s, p) => s + (p.overall || 0), 0) / gegnerKader.length : 0;
            if (bester && bester.overall >= schnitt + 8) gegnerStar = bester.name;
        }

        // Das letzte eigene Spiel
        let letztes = null;
        (state.schedule || []).forEach(r => (r.matches || []).forEach(m => {
            if (eigen(m) && m.played && (!letztes || r.matchday > letztes.spieltag)) letztes = { m, spieltag: r.matchday };
        }));
        let letzteDifferenz = 0, letztesErgebnis = "", letzterGegner = "";
        if (letztes) {
            const heim = letztes.m.homeClubId === club.id;
            const tore = heim ? letztes.m.homeGoals : letztes.m.awayGoals;
            const gegentore = heim ? letztes.m.awayGoals : letztes.m.homeGoals;
            letzteDifferenz = (tore || 0) - (gegentore || 0);
            letztesErgebnis = `${tore}:${gegentore}`;
            letzterGegner = this.clubOf(state, heim ? letztes.m.awayClubId : letztes.m.homeClubId)?.name || "den Gegner";
        }

        return {
            clubName: club.name,
            city: club.city || club.name,
            opponentId,
            opponentName: opponent ? opponent.name : "den nächsten Gegner",
            playerName: kritik ? kritik.name : "unser Kapitän",
            playerId: kritik ? kritik.id : null,
            kritikForm: kritik ? (kritik.form || 7) : 7,
            formTrend,
            siegSerie: serie(sieg),
            niederlagenSerie: serie(niederlage),
            derbyTitel,
            platz,
            gespielt,
            abstiegszone: !!platz && tabelle.length >= 10 && platz > tabelle.length - 3,
            vorstandKritisch: (state.boardConfidence ?? 75) < 40 || (club.confidence ?? 75) < 35,
            verletzterName: verletzt ? verletzt.name : null,
            geruechtId: geruecht ? geruecht.id : null,
            geruechtName: geruecht ? geruecht.name : null,
            geruechtVerein: geruecht ? geruecht.verein : null,
            gegnerStar,
            letzteDifferenz,
            letztesErgebnis,
            letzterGegner
        };
    }

    /** Ein fester Zufall je Tag: dieselbe Konferenz beim erneuten Öffnen */
    static _pressHash(text) {
        let h = 2166136261;
        for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
        // Nachmischen - sonst liegen "j0" und "j1" fast auf demselben Wert
        h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
        h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    }

    /**
     * Stellt die Pressekonferenz zusammen: zwei bis drei Fragen, die zur Lage
     * passen, jede von einem Journalisten eines bestimmten Blattes. Die erste
     * Frage steht zusätzlich oben (topicId/question/answers) - so wie früher,
     * als es nur eine gab.
     */
    static buildPressConference(state) {
        const ctx = this.pressKontext(state);
        if (!ctx) return null;
        const tag = `${state.seasonYear || 1}|${state.currentDayIndex || 0}`;
        // Steht etwas Besonderes an, fragen die Journalisten dreimal nach
        const fragen = this._stelleFragen(this.PRESS_TOPICS, ctx, tag, (dringend) => (dringend >= 3 ? 3 : 2));
        const erste = fragen[0];
        return {
            topicId: erste.topicId,
            question: erste.question,
            answers: erste.answers,
            context: ctx,
            fragen
        };
    }

    /**
     * Die Fragen einer Konferenz: nach Dringlichkeit, je Gruppe nur ein
     * Thema, jede Frage von einem anderen Journalisten.
     */
    static _stelleFragen(liste, ctx, tag, anzahlFuer) {
        const text = (wert) => (typeof wert === "function" ? wert(ctx) : wert);
        const themen = liste
            .map(t => ({ t, basis: t.gewicht ? t.gewicht(ctx) : 1 }))
            .filter(x => x.basis > 0)
            .map(x => ({ ...x, g: x.basis + this._pressHash(`${tag}|${x.t.id}`) * 0.6 }))
            .filter(x => x.g > 0.6)
            .sort((a, b) => b.g - a.g);
        const anzahl = themen.length ? anzahlFuer(themen[0].basis) : 0;
        // Aus jeder Gruppe nur ein Thema: Wer nach der Siegesserie fragt,
        // fragt nicht noch einmal nach der Form
        const gruppen = new Set();
        const gewaehlt = [];
        themen.forEach(x => {
            const g = x.t.gruppe || x.t.id;
            if (gewaehlt.length >= anzahl || gruppen.has(g)) return;
            gruppen.add(g);
            gewaehlt.push(x);
        });
        const medienReihe = ["lokal", "fach", "boulevard"];
        const start = Math.floor(this._pressHash(`${tag}|journalist`) * this.JOURNALISTEN.length);

        return gewaehlt.map((x, i) => {
            const t = x.t;
            const typ = t.medium || medienReihe[Math.floor(this._pressHash(`${tag}|medium${i}`) * 3)];
            const m = this.PRESSE_MEDIEN[typ];
            return {
                topicId: t.id,
                question: t.question(ctx),
                answers: t.answers.map(a => ({ key: a.key, label: text(a.label) })),
                medium: {
                    typ,
                    name: typ === "lokal" ? `${m.name} ${ctx.city}` : m.name,
                    icon: m.icon,
                    art: m.art
                },
                journalist: this.JOURNALISTEN[(start + i * 3) % this.JOURNALISTEN.length]
            };
        });
    }

    /**
     * Die Pressekonferenz nach dem Abpfiff: ein bis zwei Fragen zum Spiel -
     * zum Ergebnis, zum besten Mann, zu einer Roten Karte oder zu dem, was
     * vorher versprochen wurde. Gibt null zurück, wenn das Spiel nicht das
     * eigene ist oder die Konferenz schon stattgefunden hat.
     */
    static buildNachSpielPresse(state, match) {
        const club = this.clubOf(state);
        if (!club || !match || !match.played) return null;
        // Nach einem Testspiel interessiert sich keine Zeitung für Antworten
        if (match.freundschaftsspiel || match.competitionId === "friendly") return null;
        const heim = match.homeClubId === club.id;
        if (!heim && match.awayClubId !== club.id) return null;
        const schluessel = `${state.seasonYear || 1}|${match.id || ""}|${match.homeClubId}|${match.awayClubId}`;
        if (state.nachSpielPresse === schluessel) return null;

        const tore = heim ? match.homeGoals : match.awayGoals;
        const gegentore = heim ? match.awayGoals : match.homeGoals;
        const gegner = this.clubOf(state, heim ? match.awayClubId : match.homeClubId);
        const noten = (match.playerRatings || []).filter(r => r.clubId === club.id)
            .sort((a, b) => (b.rating || 0) - (a.rating || 0));
        const rot = (match.events || []).find(e => e.type === "red_card"
            && (e.clubId ? e.clubId === club.id : e.team === (heim ? "home" : "away")));
        const rotSpieler = rot ? (state.players || []).find(p => String(p.id) === String(rot.playerId)) : null;
        const v = state.lastVersprechen && state.lastVersprechen.spielSchluessel === schluessel ? state.lastVersprechen : null;

        const ctx = {
            clubName: club.name,
            city: club.city || club.name,
            opponentId: gegner?.id || null,
            opponentName: gegner?.name || "den Gegner",
            ergebnis: `${tore}:${gegentore}`,
            differenz: (tore || 0) - (gegentore || 0),
            besterId: noten[0]?.playerId ?? null,
            besterName: noten[0]?.name || null,
            besterNote: noten[0]?.rating || 0,
            rotId: rotSpieler ? rotSpieler.id : null,
            rotName: rotSpieler ? rotSpieler.name : null,
            versprechen: v ? (v.gehalten ? "gehalten" : "gebrochen") : null,
            nachSpiel: true,
            spielSchluessel: schluessel
        };
        const fragen = this._stelleFragen(this.NACH_SPIEL_TOPICS, ctx, `${schluessel}|nach`, () => 2);
        if (!fragen.length) return null;
        return {
            topicId: fragen[0].topicId,
            question: fragen[0].question,
            answers: fragen[0].answers,
            context: ctx,
            fragen,
            nachSpiel: true
        };
    }

    /**
     * Wertet die gegebene Antwort aus.
     *
     * optionen.frage (aus buildPressConference) nennt Blatt und Lage - ohne
     * sie wird die Konferenz neu zusammengestellt. Das Blatt verstärkt die
     * Wirkung: Der Boulevard macht Druck, die Lokalzeitung erreicht die Fans.
     */
    static answerPressConference(state, topicId, answerKey, optionen = {}) {
        const topic = [...this.PRESS_TOPICS, ...this.NACH_SPIEL_TOPICS].find(t => t.id === topicId);
        if (!topic) return { success: false, error: "Unbekanntes Thema." };

        const answer = topic.answers.find(a => a.key === answerKey);
        if (!answer) return { success: false, error: "Unbekannte Antwort." };

        const club = this.clubOf(state);
        const squad = this.squadOf(state, club);
        const pk = optionen.frage && optionen.kontext ? null : this.buildPressConference(state);
        // Nach dem Spiel ist die Konferenz mit der ersten Antwort vermerkt -
        // ein zweites Mal gibt es sie für diese Partie nicht
        if (optionen.kontext?.nachSpiel) state.nachSpielPresse = optionen.kontext.spielSchluessel;
        const ctx = optionen.kontext || pk?.context || {};
        const frage = optionen.frage || pk?.fragen?.find(f => f.topicId === topicId) || null;
        const faktor = this.PRESSE_MEDIEN[frage?.medium?.typ]?.faktor || { fanMood: 1, mediaPressure: 1, board: 1 };
        const text = (wert) => (typeof wert === "function" ? wert(ctx) : wert);

        const effekte = {
            fanMood: Math.round((answer.fanMood || 0) * faktor.fanMood),
            mediaPressure: Math.round((answer.mediaPressure || 0) * faktor.mediaPressure),
            boardConfidence: Math.round((answer.board || 0) * faktor.board),
            squadMorale: answer.morale || 0
        };

        state.fanMood = Math.max(10, Math.min(100, (state.fanMood ?? 70) + effekte.fanMood));
        state.mediaPressure = Math.max(0, Math.min(100, (state.mediaPressure ?? 45) + effekte.mediaPressure));
        state.boardConfidence = Math.max(0, Math.min(100, (state.boardConfidence ?? 75) + effekte.boardConfidence));

        squad.forEach(p => {
            p.morale = Math.max(25, Math.min(100, (p.morale || 70) + effekte.squadMorale));
        });

        // Wer namentlich genannt wurde, reagiert besonders
        const zielId = ctx[topic.ziel || "playerId"];
        let betroffen = null;
        if (answer.targetMorale && zielId !== null && zielId !== undefined) {
            betroffen = squad.find(p => String(p.id) === String(zielId));
            if (betroffen) {
                betroffen.morale = Math.max(20, Math.min(100, betroffen.morale + answer.targetMorale));
            }
        }

        // Eine Kampfansage liest man auch beim Gegner
        let gegnerMotiviert = null;
        if (answer.gegnerMoral && ctx.opponentId) {
            const gegner = this.clubOf(state, ctx.opponentId);
            this.squadOf(state, gegner).forEach(p => {
                p.morale = Math.max(25, Math.min(100, (p.morale || 70) + answer.gegnerMoral));
            });
            gegnerMotiviert = { name: gegner?.name || ctx.opponentName, delta: answer.gegnerMoral };
        }

        // Ein Versprechen wird nach dem nächsten Spiel abgerechnet
        let versprechen = null;
        if (answer.versprechen && ctx.opponentId) {
            versprechen = {
                art: answer.versprechen,
                gegnerId: ctx.opponentId,
                gegnerName: ctx.opponentName,
                seasonYear: state.seasonYear || 1,
                tag: state.currentDayIndex || 0
            };
            state.pressVersprechen = versprechen;
        }

        // Was morgen in der Zeitung steht
        let schlagzeile = null;
        if (answer.schlagzeile) {
            schlagzeile = text(answer.schlagzeile);
            const news = this.getNewsEngine();
            if (news && typeof news.addMessage === "function") {
                news.addMessage(state, "press", {
                    subject: `${frage?.medium?.icon || "📰"} ${schlagzeile}`,
                    body: `${frage?.medium?.name || "Die Presse"} nach der Pressekonferenz: ${text(answer.label)} ${answer.response}`,
                    sender: frage?.medium?.name || "Presse"
                });
            }
        }

        // Alle Antworten des Tages bleiben zusammen im Spielstand
        const tag = state.currentDayIndex || 0;
        const vorher = state.lastPressConference && state.lastPressConference.tag === tag
            ? (state.lastPressConference.antworten || []) : [];
        state.lastPressConference = {
            topicId,
            answerKey,
            matchday: state.currentMatchday,
            tag,
            response: answer.response,
            antworten: [...vorher.filter(a => a.topicId !== topicId), { topicId, answerKey }]
        };

        return {
            success: true,
            response: text(answer.response),
            effects: effekte,
            affectedPlayer: betroffen ? { id: betroffen.id, name: betroffen.name, delta: answer.targetMorale } : null,
            gegnerMotiviert,
            versprechen,
            schlagzeile
        };
    }

    /**
     * Nach dem Spiel: Wer ein Versprechen gegeben hat, wird daran gemessen.
     * Gehalten bringt Fans und Vorstand, gebrochen den Spott der Presse.
     */
    static versprechenPruefen(state, match) {
        const v = state?.pressVersprechen;
        if (!v || !match || !match.played) return null;
        if ((v.seasonYear || 1) !== (state.seasonYear || 1)) {
            delete state.pressVersprechen;
            return null;
        }
        const clubId = state.userClubId;
        const heim = match.homeClubId === clubId;
        if (!heim && match.awayClubId !== clubId) return null;
        const gegnerId = heim ? match.awayClubId : match.homeClubId;
        if (gegnerId !== v.gegnerId) return null;

        const tore = heim ? match.homeGoals : match.awayGoals;
        const gegentore = heim ? match.awayGoals : match.homeGoals;
        const gehalten = v.art === "sieg" ? tore > gegentore : tore >= gegentore;
        const e = gehalten
            ? { fanMood: 4, mediaPressure: -4, boardConfidence: 2 }
            : { fanMood: -6, mediaPressure: 8, boardConfidence: -3 };
        state.fanMood = Math.max(10, Math.min(100, (state.fanMood ?? 70) + e.fanMood));
        state.mediaPressure = Math.max(0, Math.min(100, (state.mediaPressure ?? 45) + e.mediaPressure));
        state.boardConfidence = Math.max(0, Math.min(100, (state.boardConfidence ?? 75) + e.boardConfidence));

        const was = v.art === "sieg" ? `einen Sieg gegen ${v.gegnerName}` : `keine Niederlage gegen ${v.gegnerName}`;
        const ergebnis = {
            gehalten,
            spielSchluessel: `${state.seasonYear || 1}|${match.id || ""}|${match.homeClubId}|${match.awayClubId}`,
            art: v.art,
            gegnerName: v.gegnerName,
            effects: e,
            text: gehalten
                ? `Wort gehalten: Sie hatten ${was} angekündigt - und geliefert.`
                : `Große Worte, nichts dahinter: Sie hatten ${was} angekündigt.`
        };
        const news = this.getNewsEngine();
        if (news && typeof news.addMessage === "function") {
            news.addMessage(state, "press", {
                subject: gehalten ? "📰 Der Trainer hält Wort" : "📰 Große Worte, nichts dahinter",
                body: ergebnis.text,
                sender: this.PRESSE_MEDIEN.boulevard.name
            });
        }
        delete state.pressVersprechen;
        state.lastVersprechen = ergebnis;
        return ergebnis;
    }

    // ------------------------------------------------ Was heute ansteht

    /**
     * Die Liste für den Schreibtisch: Was braucht heute eine Entscheidung?
     *
     * Sortiert nach Dringlichkeit, damit der erste Blick auf das Dashboard
     * genügt, um zu wissen, was zu tun ist.
     */
    static getAttentionItems(state) {
        const club = this.clubOf(state);
        if (!club) return [];

        const squad = this.squadOf(state, club);
        const items = [];

        // 1. Verhandlungen, bei denen wir am Zug sind
        const negotiation = _mgrResolve("NegotiationEngine", "./negotiationEngine.js");
        if (negotiation) {
            const amZug = negotiation.getOpenNegotiations(state)
                .filter(n => n.clubId === club.id && n.status === negotiation.STATUS.AWAITING_US);
            amZug.forEach(n => items.push({
                priority: 1,
                icon: "🤝",
                tab: "transfers",
                title: `${n.playerName}: Wir sind am Zug`,
                detail: `${negotiation.describe(n)} · noch ${Math.max(0, n.deadlineDay - (state.currentDayIndex || 0))} Tage Frist`
            }));
        }

        // 1b. Angebote anderer Vereine für eigene Spieler - mit Frist, also
        // ganz nach oben
        const offen = (state.transferMarket?.offers || []).filter(o => o.status === "pending");
        offen.forEach(o => {
            const rest = typeof o.frist === "number" ? Math.max(0, o.frist - (state.currentDayIndex || 0)) : null;
            items.push({
                priority: 0,
                icon: "💰",
                tab: "transfers",
                title: `Angebot für ${o.playerName}: ${o.fromClubName || "ein Verein"}`,
                detail: `${_mgrGeld(o.fee)} Ablöse`
                    + (o.playerValue ? ` · Marktwert ${_mgrGeld(o.playerValue)}` : "")
                    + (rest !== null ? ` · ${rest === 0 ? "läuft heute ab" : `noch ${rest} Tag${rest === 1 ? "" : "e"}`}` : "")
            });
        });

        // 1c. Pflichtposten im Stab vor dem Saisonstart
        const pre = _mgrResolve("PreseasonEngine", "./preseasonEngine.js");
        if (pre && state.preseason?.aktiv && typeof pre.pflichtLuecken === "function") {
            const luecken = pre.pflichtLuecken(state);
            if (luecken.length) {
                items.push({
                    priority: 0,
                    icon: "🩺",
                    tab: "preseason",
                    title: `Noch kein ${luecken.map(b => b.titel).join(", kein ")}`,
                    detail: "Ohne sie startet die Saison nur auf ausdrücklichen Wunsch."
                });
            }
        }

        // 2. Gesperrte und verletzte Stammspieler
        const ausfaelle = squad.filter(p => (p.injuredWeeks || 0) > 0 || (p.suspendedMatches || 0) > 0);
        if (ausfaelle.length > 0) {
            items.push({
                priority: 2,
                icon: "🚑",
                tab: "squad",
                title: `${ausfaelle.length} Spieler nicht einsatzbereit`,
                detail: ausfaelle.slice(0, 3).map(p => p.name).join(", ") + (ausfaelle.length > 3 ? " …" : "")
            });
        }

        // 3. Überlastete Spieler vor dem Spieltag
        const muede = squad.filter(p => (p.injuredWeeks || 0) === 0 && (p.fitness ?? 100) < 70);
        if (muede.length > 0) {
            items.push({
                priority: 3,
                icon: "🥵",
                tab: "training",
                title: `${muede.length} Spieler sind überlastet`,
                detail: "Trainingsintensität senken oder rotieren, sonst steigt das Verletzungsrisiko."
            });
        }

        // 4. Auslaufende Verträge
        const auslaufend = squad.filter(p => (p.contractYears ?? 3) <= 1);
        if (auslaufend.length > 0) {
            items.push({
                priority: 4,
                icon: "📄",
                tab: "squad",
                title: `${auslaufend.length} Verträge laufen aus`,
                detail: auslaufend.slice(0, 3).map(p => p.name).join(", ") + (auslaufend.length > 3 ? " …" : "")
            });
        }

        // 5. Unzufriedene Spieler
        const unzufrieden = squad.filter(p => (p.happiness?.overall ?? 75) < 50);
        if (unzufrieden.length > 0) {
            items.push({
                priority: 5,
                icon: "😞",
                tab: "squad",
                title: `${unzufrieden.length} Spieler sind unzufrieden`,
                detail: unzufrieden.slice(0, 3).map(p => p.name).join(", ") + (unzufrieden.length > 3 ? " …" : "")
            });
        }

        // 5b. Gespräche: Wer wartet auf eine Antwort, wer will weg, was ist
        // versprochen? Ein Klick öffnet die Spielerakte.
        const gespraeche = _mgrResolve("PlayerTalkEngine", "./playerTalkEngine.js");
        if (gespraeche && typeof gespraeche.schreibtisch === "function") {
            gespraeche.schreibtisch(state).forEach(item => items.push(item));
        }
        // 5c. Kabine: unzufriedener Kapitän, Wortführer, Spieler ohne Anschluss
        const kabine = _mgrResolve("DressingRoomEngine", "./dressingRoomEngine.js");
        if (kabine && typeof kabine.schreibtisch === "function") {
            kabine.schreibtisch(state).forEach(item => items.push(item));
        }

        // 6. Ungelesene Post
        const ungelesen = (state.inbox || []).filter(m => !m.read).length;
        if (ungelesen > 0) {
            items.push({
                priority: 6,
                icon: "📬",
                tab: "inbox",
                title: `${ungelesen} ungelesene Nachricht${ungelesen === 1 ? "" : "en"}`,
                detail: "Vorstand, Berater und Medizinabteilung melden sich."
            });
        }

        // 7. Laufende Bauvorhaben
        //
        // Ein Stadionumbau läuft dreißig Spieltage und drückt so lange die
        // Zuschauereinnahmen. Er stand bisher nur im Verein-Reiter - wer dort
        // nicht nachsah, wunderte sich über die Einnahmen und fand den Grund
        // nicht.
        const fac = _mgrResolve("FacilityEngine", "./facilityEngine.js");
        if (fac && club.anlagen) {
            const baustellen = (fac.ANLAGEN || [])
                .map(k => ({ key: k, anlage: club.anlagen[k] }))
                .filter(x => x.anlage?.projekt);

            baustellen.forEach(({ key, anlage }) => {
                const p = anlage.projekt;
                const einbusse = key === "stadium"
                    ? `${Math.round(p.beeintraechtigung * 100)} % der Plätze fehlen`
                    : `Betrieb um ${Math.round(p.beeintraechtigung * 100)} % eingeschränkt`;
                items.push({
                    priority: 7,
                    icon: "🏗️",
                    tab: "club",
                    title: `${fac.FACILITY_NAMES[key]}: ${p.art === "ausbau" ? "Ausbau" : "Sanierung"} läuft`,
                    detail: `Noch ${p.restSpieltage} von ${p.spieltage} Spieltagen · ${einbusse}.`
                });
            });
        }

        // 8. Aufstellung unvollständig
        if ((club.lineup || []).length < 11) {
            items.unshift({
                priority: 0,
                icon: "⚠️",
                tab: "tactics",
                title: "Die Startelf ist unvollständig",
                detail: `Nur ${(club.lineup || []).length} von 11 Plätzen besetzt.`
            });
        }

        return items.sort((a, b) => a.priority - b.priority).slice(0, 6);
    }
}

if (typeof window !== "undefined") {
    window.ManagerEngine = ManagerEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { ManagerEngine };
}
