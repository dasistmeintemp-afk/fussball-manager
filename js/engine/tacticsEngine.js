/**
 * TacticsEngine - Taktik nach dem Vorbild des FM26: eine Formation mit Ball,
 * eine gegen den Ball, fuer jeden Spieler eine Rolle je Phase und
 * Mannschaftsanweisungen, geordnet nach Spielphasen.
 *
 * Bisher bestand eine Taktik aus fuenf Reglern (Mentalitaet, Pressing,
 * Tempo, Passspiel, Angriffsfokus). Die Mannschaft stand mit und ohne Ball in
 * derselben Formation, jeder Spieler spielte seine Position gleich, und
 * verteidigt wurde immer im Raum. Im FM26 wie im echten Fussball ist das
 * getrennt:
 *
 *  - Mit Ball baut die Elf eine eigene Form (3-2-5, 2-3-5, 4-2-4 ...), die
 *    aus den Rollen entsteht oder fest vorgegeben ist - das Positionsspiel.
 *  - Gegen den Ball verteidigt sie in einer anderen (4-4-2, 4-1-4-1, 5-4-1),
 *    im Raum, mannorientiert oder in Manndeckung.
 *  - Jeder Spieler hat eine Rolle mit Ball (einrueckender Aussenverteidiger,
 *    falsche Neun ...) und eine gegen den Ball (pressend, zurueckarbeitend,
 *    Konterspieler ...).
 *  - Die Anweisungen gelten je Phase: Aufbau, Vorwaertsspiel, letztes
 *    Drittel, Umschalten, Pressing und Block.
 *
 * Das Modul haelt nur Daten und reine Rechnungen. Wie sich das auf dem Platz
 * zeigt, entscheiden LiveMatchDirector (2D), MatchFlowEngine (Ballbesitz)
 * und MatchEngine (Ergebnis) - sie fragen hier nach.
 */

/**
 * Alle Mannschaftsanweisungen, nach Phasen geordnet. Die ersten Schluessel
 * (mentality, pressing, tempo, passing, focus, defensiveLine) gab es schon;
 * sie behalten ihre Werte, damit alte Spielstaende weiterlaufen.
 */
const TAKTIK_ANWEISUNGEN = [
    // ---------------------------------------------------------------- Mit Ball
    {
        key: "mentality", phase: "mitBall", gruppe: "Grundausrichtung", label: "Mentalität", standard: "balanced",
        optionen: [
            { value: "very_defensive", label: "Sehr defensiv" },
            { value: "defensive", label: "Defensiv" },
            { value: "balanced", label: "Ausgeglichen" },
            { value: "offensive", label: "Offensiv" },
            { value: "very_offensive", label: "Sehr offensiv" }
        ],
        hilfe: "Wie viel Risiko die Elf insgesamt eingeht - wie weit sie aufrückt und wie viele Spieler den Angriff tragen."
    },
    {
        key: "torwartAbspiel", phase: "mitBall", gruppe: "Aufbau", label: "Abspiel des Torwarts", standard: "gemischt",
        optionen: [
            { value: "kurz", label: "Kurz auf die Innenverteidiger" },
            { value: "gemischt", label: "Gemischt" },
            { value: "lang", label: "Lang auf die Spitze" }
        ],
        hilfe: "Kurz baut flach von hinten auf, lang überspringt das gegnerische Pressing."
    },
    {
        key: "aufbauUeber", phase: "mitBall", gruppe: "Aufbau", label: "Aufbau über", standard: "gemischt",
        optionen: [
            { value: "innen", label: "Innenverteidiger und Sechser" },
            { value: "gemischt", label: "Gemischt" },
            { value: "aussen", label: "Außenverteidiger" }
        ],
        hilfe: "Über welche Spieler der Ball aus der eigenen Hälfte kommt."
    },
    {
        key: "durchsPressing", phase: "mitBall", gruppe: "Aufbau", label: "Gegen Pressing", standard: "gemischt",
        optionen: [
            { value: "spielen", label: "Durchspielen" },
            { value: "gemischt", label: "Gemischt" },
            { value: "lang", label: "Überspielen (lang)" }
        ],
        hilfe: "Ob die Elf sich unter Druck flach befreit oder den langen Ball schlägt."
    },
    {
        key: "passing", phase: "mitBall", gruppe: "Vorwärtsspiel", label: "Passspiel", standard: "mixed",
        optionen: [
            { value: "short", label: "Kurz (Ballbesitz)" },
            { value: "mixed", label: "Gemischt" },
            { value: "direct", label: "Direkt, vertikal" }
        ]
    },
    {
        key: "tempo", phase: "mitBall", gruppe: "Vorwärtsspiel", label: "Tempo", standard: "normal",
        optionen: [
            { value: "slow", label: "Geduldig" },
            { value: "normal", label: "Normal" },
            { value: "fast", label: "Hoch" }
        ]
    },
    {
        key: "breite", phase: "mitBall", gruppe: "Vorwärtsspiel", label: "Breite im Angriff", standard: "normal",
        optionen: [
            { value: "eng", label: "Eng (durchs Zentrum)" },
            { value: "normal", label: "Normal" },
            { value: "breit", label: "Breit (Seitenlinien besetzt)" }
        ],
        hilfe: "Wie weit die Außen an die Linie gehen. Breit zieht die gegnerische Kette auseinander, eng überlädt das Zentrum."
    },
    {
        key: "freiheit", phase: "mitBall", gruppe: "Vorwärtsspiel", label: "Kreative Freiheit", standard: "normal",
        optionen: [
            { value: "diszipliniert", label: "Diszipliniert (Positionen halten)" },
            { value: "normal", label: "Normal" },
            { value: "frei", label: "Frei (Positionen tauschen)" }
        ],
        hilfe: "Diszipliniert hält jeder seine Zone, frei suchen sich die Spieler ihre Räume selbst."
    },
    {
        key: "focus", phase: "mitBall", gruppe: "Vorwärtsspiel", label: "Angriffsfokus", standard: "balanced",
        optionen: [
            { value: "left", label: "Linke Seite" },
            { value: "center", label: "Zentrum" },
            { value: "right", label: "Rechte Seite" },
            { value: "balanced", label: "Ausgewogen" }
        ]
    },
    {
        key: "aussenLinks", phase: "mitBall", gruppe: "Vorwärtsspiel", label: "Linke Seite", standard: "normal",
        optionen: [
            { value: "normal", label: "Nach Rolle" },
            { value: "hinterlaufen", label: "Hinterlaufen" },
            { value: "unterlaufen", label: "Unterlaufen (innen)" }
        ],
        hilfe: "Ob der Außenverteidiger links außen um den Flügelspieler herum läuft oder innen durch den Halbraum."
    },
    {
        key: "aussenRechts", phase: "mitBall", gruppe: "Vorwärtsspiel", label: "Rechte Seite", standard: "normal",
        optionen: [
            { value: "normal", label: "Nach Rolle" },
            { value: "hinterlaufen", label: "Hinterlaufen" },
            { value: "unterlaufen", label: "Unterlaufen (innen)" }
        ]
    },
    {
        key: "flanken", phase: "mitBall", gruppe: "Letztes Drittel", label: "Flanken", standard: "normal",
        optionen: [
            { value: "wenig", label: "Kaum flanken" },
            { value: "normal", label: "Normal" },
            { value: "frueh", label: "Früh flanken" },
            { value: "grundlinie", label: "Bis zur Grundlinie" }
        ]
    },
    {
        key: "abschluss", phase: "mitBall", gruppe: "Letztes Drittel", label: "Abschluss", standard: "normal",
        optionen: [
            { value: "herausspielen", label: "Herausspielen (in den Strafraum)" },
            { value: "normal", label: "Normal" },
            { value: "weitschuss", label: "Auch aus der Distanz" }
        ]
    },
    {
        key: "dribbling", phase: "mitBall", gruppe: "Letztes Drittel", label: "Dribblings", standard: "normal",
        optionen: [
            { value: "weniger", label: "Weniger" },
            { value: "normal", label: "Normal" },
            { value: "mehr", label: "Mehr" }
        ]
    },
    {
        key: "standards", phase: "mitBall", gruppe: "Letztes Drittel", label: "Standards", standard: "normal",
        optionen: [
            { value: "normal", label: "Normal" },
            { value: "herausholen", label: "Auf Standards spielen" }
        ]
    },
    // --------------------------------------------------------------- Umschalten
    {
        key: "nachBallverlust", phase: "umschalten", gruppe: "Umschalten", label: "Nach Ballverlust", standard: "normal",
        optionen: [
            { value: "gegenpressing", label: "Gegenpressing" },
            { value: "normal", label: "Normal" },
            { value: "zurueckziehen", label: "Sofort zurückziehen" }
        ],
        hilfe: "Gegenpressing jagt den Ball sofort zurück, zurückziehen stellt erst die Form her."
    },
    {
        key: "nachBallgewinn", phase: "umschalten", gruppe: "Umschalten", label: "Nach Ballgewinn", standard: "normal",
        optionen: [
            { value: "kontern", label: "Kontern" },
            { value: "normal", label: "Normal" },
            { value: "ballsichern", label: "Ball sichern, Form einnehmen" }
        ]
    },
    {
        key: "torwartVerteilung", phase: "umschalten", gruppe: "Umschalten", label: "Torwart nach Ballgewinn", standard: "normal",
        optionen: [
            { value: "schnell", label: "Schnell abwerfen" },
            { value: "normal", label: "Normal" },
            { value: "ruhig", label: "Tempo rausnehmen" }
        ]
    },
    // ---------------------------------------------------------- Gegen den Ball
    {
        key: "pressing", phase: "gegenBall", gruppe: "Pressing", label: "Anlaufhöhe", standard: "medium",
        optionen: [
            { value: "low", label: "Tief (ab der Mittellinie)" },
            { value: "medium", label: "Mittel (ab dem ersten Drittel)" },
            { value: "high", label: "Hoch (bis in den Strafraum)" }
        ],
        hilfe: "Ab wo die Elf den ballführenden Gegner angreift - davor stellt sie nur die Passwege zu."
    },
    {
        key: "anlaufen", phase: "gegenBall", gruppe: "Pressing", label: "Pressingintensität", standard: "normal",
        optionen: [
            { value: "seltener", label: "Seltener" },
            { value: "normal", label: "Normal" },
            { value: "oefter", label: "Öfter" }
        ],
        hilfe: "Wie viele Spieler und wie früh sie in den Zweikampf gehen."
    },
    {
        key: "pressingfalle", phase: "gegenBall", gruppe: "Pressing", label: "Pressingfalle", standard: "keine",
        optionen: [
            { value: "keine", label: "Keine" },
            { value: "aussen", label: "Nach außen lenken" },
            { value: "innen", label: "Nach innen lenken" }
        ],
        hilfe: "Der erste Presser läuft so an, dass der Gegner auf die Seite oder in die Mitte muss - dort wartet die Überzahl."
    },
    {
        key: "abstossStoeren", phase: "gegenBall", gruppe: "Pressing", label: "Kurzen Abstoß", standard: "zulassen",
        optionen: [
            { value: "zulassen", label: "Zulassen" },
            { value: "verhindern", label: "Verhindern" }
        ]
    },
    {
        key: "defensiveLine", phase: "gegenBall", gruppe: "Block", label: "Abwehrlinie", standard: "medium",
        optionen: [
            { value: "deep", label: "Tief" },
            { value: "medium", label: "Normal" },
            { value: "high", label: "Hoch" }
        ]
    },
    {
        key: "kompaktheit", phase: "gegenBall", gruppe: "Block", label: "Breite des Blocks", standard: "normal",
        optionen: [
            { value: "eng", label: "Eng (Zentrum schließen)" },
            { value: "normal", label: "Normal" },
            { value: "breit", label: "Breit (Flügel decken)" }
        ]
    },
    {
        key: "abseitsfalle", phase: "gegenBall", gruppe: "Block", label: "Abseitsfalle", standard: "nein",
        optionen: [
            { value: "nein", label: "Nein" },
            { value: "ja", label: "Ja (Linie schiebt heraus)" }
        ]
    },
    {
        key: "flankenVerhindern", phase: "gegenBall", gruppe: "Block", label: "Gegnerische Flanken", standard: "normal",
        optionen: [
            { value: "zulassen", label: "Zulassen (Strafraum dicht)" },
            { value: "normal", label: "Normal" },
            { value: "verhindern", label: "Verhindern (Außen attackieren)" }
        ]
    },
    {
        key: "deckung", phase: "gegenBall", gruppe: "Zweikampf & Deckung", label: "Deckung", standard: "raum",
        optionen: [
            { value: "raum", label: "Raumdeckung" },
            { value: "mannorientiert", label: "Mannorientiert in der Zone" },
            { value: "mann", label: "Manndeckung" }
        ],
        hilfe: "Im Raum verteidigt jeder seine Zone. Mannorientiert übernimmt jeder den Gegner, der in seine Zone kommt. In Manndeckung folgt jeder seinem Gegenspieler über das ganze Feld."
    },
    {
        key: "zweikampf", phase: "gegenBall", gruppe: "Zweikampf & Deckung", label: "Zweikampfverhalten", standard: "normal",
        optionen: [
            { value: "zurueckhaltend", label: "Auf den Füßen bleiben" },
            { value: "normal", label: "Normal" },
            { value: "hart", label: "Hart einsteigen" }
        ]
    }
];

/**
 * Positionsfamilien: Welche Rollen eine Position spielen kann. Ein
 * Aussenverteidiger in der Viererkette ist etwas anderes als ein
 * Schienenspieler vor einer Dreierkette - deshalb entscheidet die Formation
 * mit.
 */
const TAKTIK_FAMILIEN = {
    TW: "Torwart", IV: "Innenverteidiger", AV: "Außenverteidiger", SCH: "Schienenspieler",
    DM: "Defensives Mittelfeld", ZM: "Zentrales Mittelfeld", OM: "Offensives Mittelfeld",
    FL: "Flügel", ST: "Sturm"
};

/**
 * Rollen mit Ball. Die Zahlen beschreiben, wo sich der Spieler im
 * Positionsspiel hinstellt:
 *  - bahn: "linie", "halbraum", "zentrum", "kette" (Abwehrreihe)
 *  - hoehe: Tiefe im Mannschaftsverbund, 0 = Kette, 1 = vorderste Linie
 *    (null = Formation)
 *  - aufbauHoehe: Hoehe im eigenen Aufbau (null = wie hoehe)
 *  - breite: Abstand zur Mitte in Feldeinheiten (null = aus der Bahn)
 *  - weitere Merkmale fuer Ballbesitz (passZiel, dribbeln, weit, flanken)
 */
const ROLLEN_MIT_BALL = {
    TW: [
        { id: "tw", name: "Torwart", beschreibung: "Hält sich im Aufbau zurück und spielt den sicheren Pass." },
        { id: "tw_mitspielend", name: "Mitspielender Torwart", beschreibung: "Rückt im Aufbau aus dem Tor heraus und ist die zusätzliche Anspielstation zwischen den Innenverteidigern.", aufbauVor: 7, kurz: 0.3 },
        { id: "tw_linie", name: "Linientorwart", beschreibung: "Bleibt auf der Linie, spielt den Ball lieber weit nach vorn.", aufbauVor: -1, kurz: -0.4 }
    ],
    IV: [
        { id: "iv", name: "Innenverteidiger", beschreibung: "Spreizt im Aufbau, spielt sicher und hält die Kette.", bahn: "kette" },
        { id: "iv_spielmacher", name: "Spielmachender Innenverteidiger", beschreibung: "Spielt Pässe durch die Linien und dribbelt an, wenn vor ihm Platz ist.", bahn: "kette", passWeit: 0.25, dribbeln: 0.35 },
        { id: "iv_kompromisslos", name: "Kompromissloser Verteidiger", beschreibung: "Kein Risiko: Unter Druck geht der Ball weit weg.", bahn: "kette", passWeit: -0.2, dribbeln: -0.5, sicher: 0.3 },
        { id: "iv_breit", name: "Breiter Innenverteidiger", beschreibung: "Außen in der Dreierkette: geht im Aufbau bis an den Strafraumrand hinaus und unterläuft den Schienenspieler.", bahn: "kette", breite: 26, nurDreier: true, dribbeln: 0.2 },
        { id: "iv_ueberlappend", name: "Überlappender Innenverteidiger", beschreibung: "Außen in der Dreierkette: schiebt im letzten Drittel mit nach vorn und hinterläuft auf seiner Seite.", bahn: "halbraum", hoehe: 0.5, aufbauHoehe: 0.05, breite: 24, nurDreier: true },
        { id: "iv_aufrueckend", name: "Aufrückender Innenverteidiger", beschreibung: "Schiebt mit Ball ins Mittelfeld und bildet mit dem Sechser eine Doppelsechs.", bahn: "zentrum", hoehe: 0.3, aufbauHoehe: 0.12, breite: 8 }
    ],
    AV: [
        { id: "av", name: "Außenverteidiger", beschreibung: "Gibt im Aufbau Breite und hinterläuft auf der Ballseite im letzten Drittel.", dynamisch: true },
        { id: "av_schiene", name: "Schienenspieler", beschreibung: "Hält die ganze Seitenlinie allein und geht hoch mit nach vorn.", bahn: "linie", hoehe: 0.8, aufbauHoehe: 0.45, flanken: 0.3 },
        { id: "av_invers", name: "Einrückender Außenverteidiger", beschreibung: "Rückt mit Ball neben die Innenverteidiger ein - aus der Viererkette wird eine Dreierkette.", bahn: "kette", hoehe: 0.02, aufbauHoehe: 0.0, breite: 24 },
        { id: "av_invers_schiene", name: "Invertierter Außenverteidiger", beschreibung: "Geht mit Ball in den Halbraum neben den Sechser - der Zweite der Doppelsechs im 3-2-5.", bahn: "halbraum", hoehe: 0.35, aufbauHoehe: 0.3, breite: 15 },
        { id: "av_spielmacher", name: "Spielmachender Schienenspieler", beschreibung: "Breit und etwas tiefer, verteilt die Bälle von der Seite.", bahn: "linie", hoehe: 0.55, aufbauHoehe: 0.35, passZiel: 0.25 },
        { id: "av_defensiv", name: "Zurückhaltender Außenverteidiger", beschreibung: "Bleibt mit Ball in der Kette, sichert hinten ab.", bahn: "kette", hoehe: 0.08, aufbauHoehe: 0.05, breite: 32 }
    ],
    SCH: [
        { id: "sch", name: "Schienenspieler", beschreibung: "Hält die Seitenlinie allein und stößt bis in die letzte Linie vor.", bahn: "linie", hoehe: 0.85, aufbauHoehe: 0.45, flanken: 0.3 },
        { id: "sch_offensiv", name: "Offensiver Schienenspieler", beschreibung: "Steht mit Ball wie ein Flügelstürmer ganz vorn an der Linie.", bahn: "linie", hoehe: 0.97, aufbauHoehe: 0.7, dribbeln: 0.25 },
        { id: "av_invers_schiene", name: "Invertierter Schienenspieler", beschreibung: "Zieht mit Ball in den Halbraum ins Mittelfeld.", bahn: "halbraum", hoehe: 0.45, aufbauHoehe: 0.35, breite: 16 },
        { id: "av_spielmacher", name: "Spielmachender Schienenspieler", beschreibung: "Breit und etwas tiefer, verteilt die Bälle von der Seite.", bahn: "linie", hoehe: 0.6, aufbauHoehe: 0.35, passZiel: 0.25 },
        { id: "av_defensiv", name: "Zurückhaltender Schienenspieler", beschreibung: "Bleibt als Außen der Fünferkette hinten.", bahn: "kette", hoehe: 0.12, aufbauHoehe: 0.08, breite: 33 }
    ],
    DM: [
        { id: "dm", name: "Sechser", beschreibung: "Steht zentral vor der Kette, verbindet Abwehr und Angriff mit einfachen Pässen.", bahn: "zentrum" },
        { id: "dm_abkippend", name: "Abkippender Sechser", beschreibung: "Lässt sich im Aufbau zwischen die Innenverteidiger fallen - die spreizen dafür weit.", bahn: "zentrum", aufbauHoehe: -0.02, hoehe: 0.3, kippt: true },
        { id: "dm_spielmacher", name: "Tiefer Spielmacher", beschreibung: "Die erste Anspielstation im Aufbau: holt sich den Ball und spielt ihn vertikal.", bahn: "zentrum", passZiel: 0.45, passWeit: 0.2 },
        { id: "dm_boxtobox", name: "Box-to-Box-Sechser", beschreibung: "Beginnt tief und schiebt im letzten Drittel bis an den Strafraum mit.", bahn: "halbraum", hoehe: 0.62, aufbauHoehe: 0.28 }
    ],
    ZM: [
        { id: "zm", name: "Achter", beschreibung: "Besetzt den Halbraum zwischen den Linien.", bahn: "halbraum" },
        { id: "zm_spielmacher", name: "Spielmacher", beschreibung: "Lässt sich fallen, holt den Ball und setzt die Angreifer ein.", bahn: "halbraum", hoehe: 0.45, passZiel: 0.4, passWeit: 0.25 },
        { id: "zm_halbraum", name: "Halbraumläufer", beschreibung: "Startet aus dem Mittelfeld in die Schnittstelle zwischen Innen- und Außenverteidiger.", bahn: "halbraum", hoehe: 0.9, aufbauHoehe: 0.55, breite: 20, laeuft: true },
        { id: "zm_boxtobox", name: "Box-to-Box", beschreibung: "Pendelt von Strafraum zu Strafraum und kommt spät in den Strafraum nach.", bahn: "halbraum", hoehe: 0.8, aufbauHoehe: 0.4, laeuft: true },
        { id: "zm_absichernd", name: "Absichernder Achter", beschreibung: "Bleibt neben dem Sechser und sichert gegen Konter ab.", bahn: "zentrum", hoehe: 0.3, aufbauHoehe: 0.3, breite: 10 }
    ],
    OM: [
        { id: "om", name: "Zehner", beschreibung: "Sucht die Lücken zwischen Mittelfeld und Abwehr des Gegners.", bahn: "zentrum" },
        { id: "om_spielmacher", name: "Offensiver Spielmacher", beschreibung: "Lässt sich fallen, verteilt die Bälle, sucht den tödlichen Pass.", bahn: "zentrum", hoehe: 0.7, passZiel: 0.45, passWeit: 0.2 },
        { id: "om_freirolle", name: "Freie Rolle", beschreibung: "Sucht sich den Raum selbst, auch auf den Flügeln.", bahn: "zentrum", frei: true, passZiel: 0.3, dribbeln: 0.3 },
        { id: "om_haengend", name: "Hängende Spitze", beschreibung: "Geht in die Tiefe und in den Strafraum, wie ein zweiter Stürmer.", bahn: "halbraum", hoehe: 0.97, breite: 10, laeuft: true }
    ],
    FL: [
        { id: "fl", name: "Flügelspieler", beschreibung: "Klebt an der Seitenlinie, geht ins Eins-gegen-eins und flankt.", bahn: "linie", flanken: 0.3, dribbeln: 0.2 },
        { id: "fl_invers", name: "Inverser Flügelstürmer", beschreibung: "Startet außen und zieht mit Ball nach innen zum Abschluss.", bahn: "halbraum", hoehe: 0.97, breite: 18, dribbeln: 0.3 },
        { id: "fl_innen", name: "Einrückender Flügelspieler", beschreibung: "Spielt im Halbraum zwischen den Linien - die Linie hält der Außenverteidiger.", bahn: "halbraum", hoehe: 0.8, breite: 20, passZiel: 0.2 },
        { id: "fl_spielmacher", name: "Spielmachender Flügelspieler", beschreibung: "Holt sich den Ball tiefer auf der Seite und spielt in den Lauf.", bahn: "halbraum", hoehe: 0.62, breite: 25, passZiel: 0.35 },
        { id: "fl_stuermer", name: "Breiter Stürmer", beschreibung: "Steht hoch an der Linie und attackiert den langen Pfosten.", bahn: "linie", hoehe: 1.0, aufbauHoehe: 0.9, laeuft: true }
    ],
    ST: [
        { id: "st", name: "Mittelstürmer", beschreibung: "Die Spitze: bindet die Innenverteidiger und schließt ab.", bahn: "zentrum" },
        { id: "st_ziel", name: "Zielspieler", beschreibung: "Macht die Bälle fest, gewinnt die Kopfbälle, legt ab.", bahn: "zentrum", passZiel: 0.3, lang: 0.35 },
        { id: "st_knipser", name: "Knipser", beschreibung: "Lauert auf der Abseitslinie, lebt im Strafraum.", bahn: "zentrum", hoehe: 1.05, laeuft: true },
        { id: "st_neun", name: "Falsche Neun", beschreibung: "Lässt sich ins Mittelfeld fallen und zieht einen Innenverteidiger mit - dahinter entsteht Raum für die Außen.", bahn: "zentrum", hoehe: 0.62, aufbauHoehe: 0.5, passZiel: 0.35 },
        { id: "st_kanal", name: "Kanalstürmer", beschreibung: "Weicht in die Schnittstellen zwischen Innen- und Außenverteidiger aus.", bahn: "halbraum", hoehe: 1.0, breite: 17, laeuft: true }
    ]
};

/**
 * Rollen gegen den Ball. Die fuenf Grundtypen des FM26: normal,
 * pressend (geht aus seiner Zone heraus), zurueckarbeitend (folgt seinem
 * Gegenspieler nach hinten), absichernd (bleibt hinter dem Ball) und
 * Konterspieler (bleibt vorn, als Anspielstation fuer den Ballgewinn).
 */
const ROLLEN_GEGEN_BALL = {
    TW: [
        { id: "tw", name: "Torwart", beschreibung: "Hält den Strafraum." },
        { id: "tw_libero", name: "Mitspielender Torwart (Libero)", beschreibung: "Steht hinter einer hohen Kette weit vor dem Tor und läuft Steilpässe ab.", vor: 9 },
        { id: "tw_linie", name: "Linientorwart", beschreibung: "Bleibt auf der Linie.", vor: -2 }
    ],
    IV: [
        { id: "iv", name: "Innenverteidiger", beschreibung: "Hält die Linie und verteidigt seine Zone." },
        { id: "iv_stopper", name: "Herausrückender Verteidiger", beschreibung: "Rückt heraus, sobald ein Gegner vor der Kette den Ball bekommt.", heraus: 1, zone: 1.6 },
        { id: "iv_absichernd", name: "Absichernder Verteidiger", beschreibung: "Steht etwas tiefer und sichert den Raum hinter der Kette.", tiefer: 3.5, zone: 0.8 }
    ],
    AV: [
        { id: "av", name: "Außenverteidiger", beschreibung: "Hält die Kette und deckt seine Seite." },
        { id: "av_pressend", name: "Pressender Außenverteidiger", beschreibung: "Attackiert den gegnerischen Flügelspieler schon beim Zuspiel.", heraus: 1, zone: 1.5 },
        { id: "av_absichernd", name: "Einrückender Außenverteidiger", beschreibung: "Rückt gegen den Ball ein und schließt das Zentrum.", schmal: 8 }
    ],
    SCH: [
        { id: "sch", name: "Schienenspieler", beschreibung: "Fällt in die Fünferkette zurück." },
        { id: "av_pressend", name: "Pressender Schienenspieler", beschreibung: "Bleibt hoch und läuft den Außenverteidiger an.", heraus: 1, zone: 1.5, hoeher: 8 },
        { id: "av_absichernd", name: "Absichernder Schienenspieler", beschreibung: "Bleibt tief in der Kette.", tiefer: 2 }
    ],
    DM: [
        { id: "dm", name: "Sechser", beschreibung: "Verteidigt vor der Kette, geht in die Zweikämpfe in seiner Zone." },
        { id: "dm_abschirmend", name: "Abschirmender Sechser", beschreibung: "Bleibt vor den Innenverteidigern und stellt die Passwege ins Zentrum zu, statt zu pressen.", zone: 0.6, nieHeraus: true },
        { id: "dm_abkippend", name: "Abkippender Sechser", beschreibung: "Lässt sich im tiefen Block in die Kette fallen - aus vier werden fünf.", kippt: true },
        { id: "dm_seitlich", name: "Seitlich absichernder Sechser", beschreibung: "Schiebt auf die Ballseite und doppelt den Flügel mit dem Außenverteidiger.", seitlich: true },
        { id: "dm_pressend", name: "Pressender Sechser", beschreibung: "Rückt heraus und attackiert den gegnerischen Zehner.", heraus: 1, zone: 1.5 }
    ],
    ZM: [
        { id: "zm", name: "Zentraler Mittelfeldspieler", beschreibung: "Hält seine Zone und läuft die Gegner darin an." },
        { id: "zm_pressend", name: "Pressender Achter", beschreibung: "Schiebt heraus und attackiert den gegnerischen Sechser.", heraus: 1, zone: 1.5 },
        { id: "zm_zurueck", name: "Zurückarbeitender Achter", beschreibung: "Folgt seinem Gegenspieler bis in den eigenen Strafraum.", verfolgt: true },
        { id: "zm_abschirmend", name: "Abschirmender Achter", beschreibung: "Bleibt vor der Kette und schließt das Zentrum.", zone: 0.7, tiefer: 3, nieHeraus: true }
    ],
    OM: [
        { id: "om", name: "Zehner", beschreibung: "Stellt den gegnerischen Sechser zu." },
        { id: "om_pressend", name: "Pressender Zehner", beschreibung: "Attackiert den Aufbau und den Sechser des Gegners.", heraus: 1, zone: 1.6 },
        { id: "om_zurueck", name: "Zurückarbeitender Zehner", beschreibung: "Arbeitet bis ins Mittelfeld zurück.", verfolgt: true, tiefer: 4 },
        { id: "om_konter", name: "Zentraler Konterspieler", beschreibung: "Bleibt vorn und wartet auf den Ballgewinn.", konter: "zentral" }
    ],
    FL: [
        { id: "fl", name: "Flügelspieler", beschreibung: "Fällt ins Mittelfeld zurück und deckt seine Seite." },
        { id: "fl_zurueck", name: "Zurückarbeitender Flügelspieler", beschreibung: "Verfolgt den gegnerischen Außenverteidiger bis in die eigene Hälfte und doppelt auf der Seite.", verfolgt: true, tiefer: 3 },
        { id: "fl_pressend", name: "Pressender Flügelspieler", beschreibung: "Läuft den gegnerischen Außenverteidiger schon im Aufbau an.", heraus: 1, zone: 1.5, hoeher: 5 },
        { id: "fl_konter", name: "Konterspieler außen", beschreibung: "Bleibt hoch und breit - die Anspielstation für den Konter.", konter: "aussen" }
    ],
    ST: [
        { id: "st", name: "Mittelstürmer", beschreibung: "Stellt den Passweg zum Sechser zu." },
        { id: "st_pressend", name: "Pressender Stürmer", beschreibung: "Läuft die Innenverteidiger und den Torwart an.", heraus: 1, zone: 1.8, presser: true },
        { id: "st_zurueck", name: "Zurückarbeitender Stürmer", beschreibung: "Fällt bis ins Mittelfeld zurück und verteidigt mit.", verfolgt: true, tiefer: 10 },
        { id: "st_konter", name: "Zentraler Konterspieler", beschreibung: "Bleibt auf Höhe der letzten Linie und wartet auf den langen Ball.", konter: "zentral" },
        { id: "st_ausweichend", name: "Ausweichender Konterspieler", beschreibung: "Bleibt vorn und weicht in den Raum zwischen Innen- und Außenverteidiger aus.", konter: "halbraum" }
    ]
};

/**
 * Kuerzel und Farbgruppe jeder Rolle - fuer die Taktiktafel. Wie im FM26
 * steht auf jeder Spielerkarte die Rolle als Kuerzel, eingefaerbt nach dem,
 * was sie tut.
 */
const ROLLEN_KUERZEL_MIT = {
    tw: ["TW", "tor"], tw_mitspielend: ["MTW", "tor"], tw_linie: ["LTW", "tor"],
    iv: ["IV", "abwehr"], iv_spielmacher: ["SIV", "aufbau"], iv_kompromisslos: ["KV", "abwehr"],
    iv_breit: ["BIV", "abwehr"], iv_ueberlappend: ["ÜIV", "aufbau"], iv_aufrueckend: ["AIV", "aufbau"],
    av: ["AV", "abwehr"], av_schiene: ["SCH", "angriff"], av_invers: ["EAV", "abwehr"],
    av_invers_schiene: ["IAV", "aufbau"], av_spielmacher: ["SSP", "kreativ"], av_defensiv: ["ZAV", "abwehr"],
    sch: ["SCH", "angriff"], sch_offensiv: ["OSCH", "angriff"],
    dm: ["DM", "aufbau"], dm_abkippend: ["AS", "aufbau"], dm_spielmacher: ["TSP", "kreativ"], dm_boxtobox: ["B2B", "aufbau"],
    zm: ["ZM", "aufbau"], zm_spielmacher: ["SP", "kreativ"], zm_halbraum: ["HRL", "angriff"],
    zm_boxtobox: ["B2B", "aufbau"], zm_absichernd: ["AZM", "abwehr"],
    om: ["OM", "kreativ"], om_spielmacher: ["OSP", "kreativ"], om_freirolle: ["FR", "kreativ"], om_haengend: ["HS", "angriff"],
    fl: ["FL", "angriff"], fl_invers: ["IFS", "angriff"], fl_innen: ["EFL", "kreativ"],
    fl_spielmacher: ["SFL", "kreativ"], fl_stuermer: ["BS", "angriff"],
    st: ["MS", "angriff"], st_ziel: ["ZS", "angriff"], st_knipser: ["KN", "angriff"], st_neun: ["F9", "kreativ"], st_kanal: ["KS", "angriff"]
};
const ROLLEN_KUERZEL_GEGEN = {
    tw: ["TW", "tor"], tw_libero: ["LIB", "tor"], tw_linie: ["LTW", "tor"],
    iv: ["IV", "standard"], iv_stopper: ["HV", "pressend"], iv_absichernd: ["ABV", "absichernd"],
    av: ["AV", "standard"], av_pressend: ["PAV", "pressend"], av_absichernd: ["EAV", "absichernd"],
    sch: ["SCH", "standard"],
    dm: ["DM", "standard"], dm_abschirmend: ["ABS", "absichernd"], dm_abkippend: ["AKS", "absichernd"],
    dm_seitlich: ["SAS", "absichernd"], dm_pressend: ["PDM", "pressend"],
    zm: ["ZM", "standard"], zm_pressend: ["PZM", "pressend"], zm_zurueck: ["ZAM", "zurueck"], zm_abschirmend: ["ABZ", "absichernd"],
    om: ["OM", "standard"], om_pressend: ["POM", "pressend"], om_zurueck: ["ZOM", "zurueck"], om_konter: ["KSZ", "konter"],
    fl: ["FL", "standard"], fl_zurueck: ["ZFL", "zurueck"], fl_pressend: ["PFL", "pressend"], fl_konter: ["KSA", "konter"],
    st: ["MS", "standard"], st_pressend: ["PST", "pressend"], st_zurueck: ["ZST", "zurueck"],
    st_konter: ["KSZ", "konter"], st_ausweichend: ["KSH", "konter"]
};

/**
 * Formationen, die es nur mit Ball gibt. Koordinaten wie in den
 * Formationen: x quer (0 = links), y laengs (92 = eigenes Tor).
 */
const FORMEN_MIT_BALL = {
    "3-2-5": {
        name: "3-2-5 (Positionsspiel)",
        positions: [
            { pos: "TW", x: 50, y: 92 },
            { pos: "IV", x: 74, y: 74 }, { pos: "IV", x: 50, y: 76 }, { pos: "IV", x: 26, y: 74 },
            { pos: "DM", x: 60, y: 56 }, { pos: "DM", x: 40, y: 56 },
            { pos: "RA", x: 93, y: 24 }, { pos: "OM", x: 70, y: 28 }, { pos: "ST", x: 50, y: 20 }, { pos: "OM", x: 30, y: 28 }, { pos: "LA", x: 7, y: 24 }
        ]
    },
    "2-3-5": {
        name: "2-3-5 (Pyramide)",
        positions: [
            { pos: "TW", x: 50, y: 92 },
            { pos: "IV", x: 64, y: 76 }, { pos: "IV", x: 36, y: 76 },
            { pos: "DM", x: 72, y: 56 }, { pos: "DM", x: 50, y: 58 }, { pos: "DM", x: 28, y: 56 },
            { pos: "RA", x: 93, y: 24 }, { pos: "OM", x: 70, y: 28 }, { pos: "ST", x: 50, y: 20 }, { pos: "OM", x: 30, y: 28 }, { pos: "LA", x: 7, y: 24 }
        ]
    },
    "3-2-2-3": {
        name: "3-2-2-3 (Box)",
        positions: [
            { pos: "TW", x: 50, y: 92 },
            { pos: "IV", x: 74, y: 74 }, { pos: "IV", x: 50, y: 76 }, { pos: "IV", x: 26, y: 74 },
            { pos: "DM", x: 60, y: 56 }, { pos: "DM", x: 40, y: 56 },
            { pos: "OM", x: 64, y: 36 }, { pos: "OM", x: 36, y: 36 },
            { pos: "RA", x: 92, y: 24 }, { pos: "ST", x: 50, y: 18 }, { pos: "LA", x: 8, y: 24 }
        ]
    },
    "3-1-6": {
        name: "3-1-6 (Belagerung)",
        positions: [
            { pos: "TW", x: 50, y: 92 },
            { pos: "IV", x: 72, y: 70 }, { pos: "IV", x: 50, y: 72 }, { pos: "IV", x: 28, y: 70 },
            { pos: "DM", x: 50, y: 52 },
            { pos: "RA", x: 93, y: 26 }, { pos: "OM", x: 72, y: 30 }, { pos: "ST", x: 58, y: 18 }, { pos: "ST", x: 42, y: 18 }, { pos: "OM", x: 28, y: 30 }, { pos: "LA", x: 7, y: 26 }
        ]
    },
    "4-2-4": {
        name: "4-2-4 (Doppelsturm)",
        positions: [
            { pos: "TW", x: 50, y: 92 },
            { pos: "RV", x: 86, y: 68 }, { pos: "IV", x: 62, y: 76 }, { pos: "IV", x: 38, y: 76 }, { pos: "LV", x: 14, y: 68 },
            { pos: "DM", x: 60, y: 54 }, { pos: "DM", x: 40, y: 54 },
            { pos: "RA", x: 90, y: 24 }, { pos: "ST", x: 60, y: 20 }, { pos: "ST", x: 40, y: 20 }, { pos: "LA", x: 10, y: 24 }
        ]
    },
    "2-3-2-3": {
        name: "2-3-2-3 (WM)",
        positions: [
            { pos: "TW", x: 50, y: 92 },
            { pos: "IV", x: 63, y: 76 }, { pos: "IV", x: 37, y: 76 },
            { pos: "RV", x: 88, y: 54 }, { pos: "DM", x: 50, y: 58 }, { pos: "LV", x: 12, y: 54 },
            { pos: "OM", x: 64, y: 38 }, { pos: "OM", x: 36, y: 38 },
            { pos: "RA", x: 88, y: 22 }, { pos: "ST", x: 50, y: 18 }, { pos: "LA", x: 12, y: 22 }
        ]
    }
};

/**
 * Taktikvorlagen - wie die Stile im FM: Sie setzen alle Anweisungen, die
 * Formen mit und gegen den Ball und bevorzugte Rollen auf einmal.
 */
const TAKTIK_VORLAGEN = {
    ausgewogen: {
        name: "Ausgewogen",
        beschreibung: "Die Grundeinstellung: kein Extrem, jede Rolle nach ihrer Position.",
        anweisungen: {},
        formMitBall: "auto", formGegenBall: "grund", rollenStil: "standard"
    },
    positionsspiel: {
        name: "Positionsspiel (Juego de Posición)",
        beschreibung: "Geduldiger Ballbesitz im 3-2-5: Aufbau durch die Mitte, alle fünf Bahnen besetzt, sofortiges Gegenpressing.",
        anweisungen: {
            passing: "short", tempo: "slow", breite: "breit", torwartAbspiel: "kurz", aufbauUeber: "innen",
            durchsPressing: "spielen", freiheit: "diszipliniert", nachBallverlust: "gegenpressing",
            nachBallgewinn: "ballsichern", pressing: "high", defensiveLine: "high", anlaufen: "oefter",
            abschluss: "herausspielen", flanken: "wenig", abseitsfalle: "ja"
        },
        formMitBall: "3-2-5", formGegenBall: "grund", rollenStil: "positionsspiel"
    },
    gegenpressing: {
        name: "Gegenpressing",
        beschreibung: "Hoch anlaufen, nach Ballverlust sofort nachsetzen, schnell und vertikal zum Tor.",
        anweisungen: {
            pressing: "high", anlaufen: "oefter", defensiveLine: "high", nachBallverlust: "gegenpressing",
            nachBallgewinn: "kontern", tempo: "fast", passing: "direct",
            abstossStoeren: "verhindern", pressingfalle: "aussen", deckung: "mannorientiert"
        },
        formMitBall: "auto", formGegenBall: "grund", rollenStil: "pressing"
    },
    konter: {
        name: "Konter",
        beschreibung: "Tief und kompakt stehen, den Ball erobern und mit wenigen Pässen in den freien Raum spielen.",
        anweisungen: {
            pressing: "low", anlaufen: "seltener", defensiveLine: "deep", nachBallverlust: "zurueckziehen",
            nachBallgewinn: "kontern", tempo: "fast", passing: "direct", mentality: "defensive",
            kompaktheit: "eng", torwartVerteilung: "schnell", torwartAbspiel: "lang"
        },
        formMitBall: "auto", formGegenBall: "grund", rollenStil: "konter"
    },
    tieferBlock: {
        name: "Tiefer Block",
        beschreibung: "Den Strafraum verteidigen: Fünferkette gegen den Ball, das Zentrum eng, lange Bälle nach vorn.",
        anweisungen: {
            pressing: "low", anlaufen: "seltener", defensiveLine: "deep", nachBallverlust: "zurueckziehen",
            mentality: "defensive", kompaktheit: "eng", flankenVerhindern: "zulassen", torwartAbspiel: "lang",
            durchsPressing: "lang", nachBallgewinn: "normal"
        },
        formMitBall: "grund", formGegenBall: "5-4-1", rollenStil: "defensiv"
    },
    fluegelspiel: {
        name: "Flügelspiel",
        beschreibung: "Breit angreifen, die Außenverteidiger hinterlaufen, früh in den Strafraum flanken.",
        anweisungen: {
            breite: "breit", flanken: "frueh", aussenLinks: "hinterlaufen", aussenRechts: "hinterlaufen",
            focus: "balanced", passing: "mixed", tempo: "normal", flankenVerhindern: "verhindern"
        },
        formMitBall: "auto", formGegenBall: "grund", rollenStil: "fluegel"
    },
    direkt: {
        name: "Direktes Spiel",
        beschreibung: "Schnell nach vorn, lange Bälle auf den Zielspieler, zweite Bälle erobern.",
        anweisungen: {
            passing: "direct", tempo: "fast", torwartAbspiel: "lang", durchsPressing: "lang",
            nachBallgewinn: "kontern", abschluss: "weitschuss", aufbauUeber: "aussen"
        },
        formMitBall: "grund", formGegenBall: "grund", rollenStil: "direkt"
    },
    manndeckung: {
        name: "Mann gegen Mann (Gasperini)",
        beschreibung: "Jeder übernimmt seinen Gegenspieler über das ganze Feld, hoch und aggressiv.",
        anweisungen: {
            deckung: "mann", pressing: "high", anlaufen: "oefter", zweikampf: "hart", defensiveLine: "high",
            nachBallverlust: "gegenpressing", nachBallgewinn: "kontern", tempo: "fast"
        },
        formMitBall: "auto", formGegenBall: "grund", rollenStil: "pressing"
    }
};

/**
 * Welche Rollen eine Vorlage bevorzugt, je Familie (die erste passende gilt).
 */
const ROLLEN_STILE = {
    standard: {},
    positionsspiel: {
        mit: { TW: "tw_mitspielend", IV: "iv_spielmacher", DM: "dm_spielmacher", ZM: "zm", OM: "om", FL: "fl", ST: "st" },
        mitSeite: { AV: ["av_invers", "av_invers_schiene"] }
    },
    pressing: {
        gegen: { ST: "st_pressend", OM: "om_pressend", ZM: "zm_pressend", FL: "fl_pressend", IV: "iv_stopper", AV: "av_pressend", TW: "tw_libero" },
        mit: { ZM: "zm_boxtobox", FL: "fl_invers" }
    },
    konter: {
        gegen: { ST: "st_konter", FL: "fl_zurueck", DM: "dm_abschirmend", IV: "iv_absichernd" },
        mit: { ST: "st_kanal", FL: "fl", ZM: "zm_boxtobox", AV: "av" }
    },
    defensiv: {
        gegen: { DM: "dm_abkippend", FL: "fl_zurueck", ZM: "zm_abschirmend", ST: "st_zurueck", IV: "iv_absichernd", TW: "tw_linie" },
        mit: { AV: "av_defensiv", SCH: "av_defensiv", ST: "st_ziel", TW: "tw_linie", IV: "iv_kompromisslos" }
    },
    fluegel: {
        mit: { FL: "fl", AV: "av_schiene", SCH: "sch", ST: "st_ziel" },
        gegen: { FL: "fl_zurueck" }
    },
    direkt: {
        mit: { ST: "st_ziel", FL: "fl_stuermer", TW: "tw_linie", IV: "iv_kompromisslos" }
    }
};

const TacticsEngine = {
    ANWEISUNGEN: TAKTIK_ANWEISUNGEN,
    FAMILIEN: TAKTIK_FAMILIEN,
    ROLLEN_MIT_BALL,
    ROLLEN_GEGEN_BALL,
    FORMEN_MIT_BALL,
    VORLAGEN: TAKTIK_VORLAGEN,

    /** Die Standardwerte aller Anweisungen */
    standardAnweisungen() {
        const t = {};
        TAKTIK_ANWEISUNGEN.forEach(a => { t[a.key] = a.standard; });
        t.risk = "normal";
        return t;
    },

    /**
     * Ergaenzt eine Taktik um alle fehlenden Werte. Alte Spielstaende und
     * generierte Vereine kennen nur die fuenf alten Regler - und manche
     * schrieben den Angriffsfokus als attackFocus, andere als focus.
     */
    normalisiere(tactics) {
        const t = tactics && typeof tactics === "object" ? tactics : {};
        if (!t.focus && t.attackFocus) t.focus = t.attackFocus;
        if (!t.passing && t.passStyle) t.passing = t.passStyle;
        TAKTIK_ANWEISUNGEN.forEach(a => {
            if (!a.optionen.some(o => o.value === t[a.key])) t[a.key] = a.standard;
        });
        if (!t.risk) t.risk = "normal";
        if (!t.formMitBall) t.formMitBall = "auto";
        if (!t.formGegenBall) t.formGegenBall = "grund";
        if (!t.rollen || typeof t.rollen !== "object") t.rollen = {};
        // Der Fokus lebt unter beiden Namen weiter, weil beide gelesen werden
        t.attackFocus = t.focus;
        return t;
    },

    /** Der Wert einer Anweisung, mit Standard */
    wert(tactics, key) {
        const def = TAKTIK_ANWEISUNGEN.find(a => a.key === key);
        const v = tactics ? tactics[key] : undefined;
        if (def && def.optionen.some(o => o.value === v)) return v;
        if (key === "focus" && tactics && tactics.attackFocus) return tactics.attackFocus;
        return def ? def.standard : v;
    },

    /**
     * Die Familie einer Position in ihrer Formation. Ein LV/RV vor einer
     * Dreierkette ist Schienenspieler, ein LM/RM/LA/RA Fluegelspieler.
     */
    familie(pos, positions = []) {
        const norm = this._norm(pos);
        if (norm === "TW") return "TW";
        if (norm === "IV") return "IV";
        if (norm === "LV" || norm === "RV") {
            const ivs = positions.filter(p => this._norm(p.pos) === "IV").length;
            const roh = String(pos || "").toUpperCase();
            return (ivs >= 3 || roh === "LAV" || roh === "RAV") ? "SCH" : "AV";
        }
        if (norm === "DM") return "DM";
        if (norm === "ZM") return "ZM";
        if (norm === "OM") return "OM";
        if (["LM", "RM", "LA", "RA"].includes(norm)) return "FL";
        if (String(pos || "").toUpperCase() === "HS") return "OM";
        return "ST";
    },

    _norm(pos) {
        const pe = (typeof PositionEngine !== "undefined" && PositionEngine)
            ? PositionEngine
            : ((typeof window !== "undefined" && window.PositionEngine) ? window.PositionEngine
                : (typeof require !== "undefined" ? require("./positionEngine.js").PositionEngine : null));
        return (pe && pe.normalizePosition(pos)) || String(pos || "").toUpperCase();
    },

    rollenMitBall(familie) { return ROLLEN_MIT_BALL[familie] || ROLLEN_MIT_BALL.ZM; },
    rollenGegenBall(familie) { return ROLLEN_GEGEN_BALL[familie] || ROLLEN_GEGEN_BALL.ZM; },

    rolleMitBall(familie, id) {
        const liste = this.rollenMitBall(familie);
        return liste.find(r => r.id === id) || liste[0];
    },
    rolleGegenBall(familie, id) {
        const liste = this.rollenGegenBall(familie);
        return liste.find(r => r.id === id) || liste[0];
    },

    /**
     * Die Standardrolle einer Position nach dem Stil der Vorlage.
     * mitSeite verteilt zwei Rollen auf die beiden Aussenverteidiger: Im
     * 3-2-5 rueckt einer in die Kette ein, der andere geht neben den Sechser.
     */
    standardRollen(familie, stil = "standard", seite = 0, formation = []) {
        const s = ROLLEN_STILE[stil] || {};
        let mit = s.mit?.[familie];
        if (s.mitSeite?.[familie]) mit = s.mitSeite[familie][seite > 0 ? 1 : 0];
        let gegen = s.gegen?.[familie];
        // Breite und ueberlappende Innenverteidiger gibt es nur in der Dreierkette
        const dreier = formation.filter(p => this._norm(p.pos) === "IV").length >= 3;
        const kandidat = this.rollenMitBall(familie).find(r => r.id === mit);
        if (!kandidat || (kandidat.nurDreier && !dreier)) mit = this.rollenMitBall(familie)[0].id;
        if (!this.rollenGegenBall(familie).some(r => r.id === gegen)) gegen = this.rollenGegenBall(familie)[0].id;
        return { mit, gegen };
    },

    /**
     * Die Rollen der ganzen Elf, Slot fuer Slot. Gespeicherte Rollen gelten,
     * solange sie zur Familie des Slots passen - nach einem Formationswechsel
     * faellt eine unpassende Rolle auf den Standard zurueck.
     */
    rollenDerElf(club, positions) {
        const t = this.normalisiere(club?.tactics);
        const stil = TAKTIK_VORLAGEN[t.vorlage]?.rollenStil || "standard";
        return positions.map((slot, i) => {
            const fam = this.familie(slot.pos, positions);
            const seite = Math.sign((slot.x ?? 50) - 50);
            const std = this.standardRollen(fam, stil, seite, positions);
            const gespeichert = t.rollen[i] || {};
            const mitOk = this.rollenMitBall(fam).find(r => r.id === gespeichert.mit);
            const dreier = positions.filter(p => this._norm(p.pos) === "IV").length >= 3;
            return {
                familie: fam,
                mit: (mitOk && !(mitOk.nurDreier && !dreier)) ? mitOk.id : std.mit,
                gegen: this.rollenGegenBall(fam).some(r => r.id === gespeichert.gegen) ? gespeichert.gegen : std.gegen
            };
        });
    },

    /** Alle waehlbaren Formen mit Ball (Schluessel -> Name) */
    formenMitBall(formationConfigs = {}) {
        const liste = [
            { key: "auto", name: "Aus den Rollen (Positionsspiel)" },
            { key: "grund", name: "Wie die Grundformation" }
        ];
        Object.entries(FORMEN_MIT_BALL).forEach(([k, f]) => liste.push({ key: k, name: f.name, nurMitBall: true }));
        Object.entries(formationConfigs).forEach(([k, f]) => liste.push({ key: k, name: f.name || k }));
        return liste;
    },

    /** Alle waehlbaren Formen gegen den Ball */
    formenGegenBall(formationConfigs = {}) {
        const liste = [{ key: "grund", name: "Wie die Grundformation" }];
        Object.entries(formationConfigs).forEach(([k, f]) => liste.push({ key: k, name: f.name || k }));
        return liste;
    },

    /** Die Positionen einer Form (Formation oder reine Ballbesitzform) */
    positionenDerForm(key, formationConfigs = {}) {
        if (FORMEN_MIT_BALL[key]) return FORMEN_MIT_BALL[key].positions;
        if (formationConfigs[key]) return formationConfigs[key].positions;
        return null;
    },

    /**
     * Ordnet die Spieler der Grundformation den Plaetzen einer anderen Form
     * zu - so, dass die Wege insgesamt am kuerzesten sind und niemand die
     * Seite wechselt. Das ist die Zuordnung, die der FM26 zwischen Formation
     * mit und gegen den Ball trifft.
     *
     * Rueckgabe: fuer jeden Slot der Grundformation der Index in der Zielform.
     */
    zuordnung(basis, ziel) {
        const n = basis.length;
        if (!Array.isArray(ziel) || ziel.length !== n) return basis.map((_, i) => i);
        const kosten = basis.map(a => ziel.map(b => {
            const aTw = this._norm(a.pos) === "TW", bTw = this._norm(b.pos) === "TW";
            if (aTw !== bTw) return 1e6;
            // Quer ist teurer als laengs: Ein Aussen bleibt aussen und
            // rueckt eher auf oder fallen zurueck, als in die Mitte zu ziehen.
            const dx = (a.x - b.x), dy = (a.y - b.y);
            let k = 2 * dx * dx + dy * dy;
            k += this._rollenWechsel(this.familie(a.pos, basis), this._zielGruppe(b.pos));
            // Niemand wechselt die Seite
            if (Math.abs(a.x - 50) > 12 && Math.abs(b.x - 50) > 12 && Math.sign(a.x - 50) !== Math.sign(b.x - 50)) k += 6000;
            return k;
        }));
        return this._ungarisch(kosten);
    },

    /** Mannschaftsteil eines Zielplatzes */
    _zielGruppe(pos) {
        const n = this._norm(pos);
        if (n === "LV" || n === "RV") return "AV";
        if (["LM", "RM", "LA", "RA"].includes(n)) return "FL";
        if (String(pos || "").toUpperCase() === "HS") return "OM";
        return n;
    },

    /**
     * Was es kostet, wenn ein Spieler in der anderen Form einen anderen Platz
     * einnimmt. Ein Aussenverteidiger, der einrueckt, oder ein Achter, der
     * neben die Spitze schiebt, ist Alltag; ein Innenverteidiger im Sturm nie.
     */
    _rollenWechsel(von, nach) {
        const T = {
            IV: { IV: 0, AV: 250, DM: 2000, ZM: 3000, OM: 5000, FL: 5000, ST: 6000 },
            AV: { AV: 0, IV: 150, FL: 150, DM: 250, ZM: 600, OM: 2500, ST: 4000 },
            SCH: { AV: 0, FL: 0, IV: 250, DM: 400, ZM: 700, OM: 2500, ST: 4000 },
            DM: { DM: 0, ZM: 150, IV: 350, OM: 500, AV: 1200, FL: 1500, ST: 2500 },
            ZM: { ZM: 0, DM: 100, OM: 100, ST: 600, FL: 700, AV: 1500, IV: 3000 },
            OM: { OM: 0, ZM: 100, ST: 250, FL: 450, DM: 450, AV: 3000, IV: 4000 },
            FL: { FL: 0, OM: 350, AV: 400, ST: 600, ZM: 700, DM: 1500, IV: 4000 },
            ST: { ST: 0, OM: 250, FL: 700, ZM: 900, DM: 2500, AV: 4000, IV: 5000 }
        };
        return T[von]?.[nach] ?? 1500;
    },

    /** Ungarische Methode: minimale Zuordnung einer quadratischen Kostenmatrix */
    _ungarisch(a) {
        const n = a.length;
        const INF = 1e18;
        const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
        const p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
        for (let i = 1; i <= n; i++) {
            p[0] = i;
            let j0 = 0;
            const minv = new Array(n + 1).fill(INF);
            const used = new Array(n + 1).fill(false);
            do {
                used[j0] = true;
                const i0 = p[j0];
                let delta = INF, j1 = 0;
                for (let j = 1; j <= n; j++) {
                    if (used[j]) continue;
                    const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
                    if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                    if (minv[j] < delta) { delta = minv[j]; j1 = j; }
                }
                for (let j = 0; j <= n; j++) {
                    if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
                    else minv[j] -= delta;
                }
                j0 = j1;
            } while (p[j0] !== 0);
            do {
                const j1 = way[j0];
                p[j0] = p[j1];
                j0 = j1;
            } while (j0);
        }
        const ergebnis = new Array(n).fill(0);
        for (let j = 1; j <= n; j++) if (p[j] > 0) ergebnis[p[j] - 1] = j - 1;
        return ergebnis;
    },

    /**
     * Wo jeder Spieler in einer Form steht: quer (x wie in der Formation)
     * und die Tiefe im Verbund (0 = hinterste Reihe, 1 = vorderste).
     * Rueckgabe je Slot der Grundformation, oder null, wenn die Form die
     * Grundformation ist.
     */
    plaetzeInForm(basis, formKey, formationConfigs = {}) {
        if (!formKey || formKey === "grund" || formKey === "auto") return null;
        const ziel = this.positionenDerForm(formKey, formationConfigs);
        if (!ziel || ziel.length !== basis.length) return null;
        const zuordnung = this.zuordnung(basis, ziel);
        const feld = ziel.filter(p => this._norm(p.pos) !== "TW");
        const yMin = Math.min(...feld.map(p => p.y)), yMax = Math.max(...feld.map(p => p.y));
        return basis.map((_, i) => {
            const z = ziel[zuordnung[i]];
            return {
                x: z.x,
                y: z.y,
                tiefe: yMax > yMin ? (yMax - z.y) / (yMax - yMin) : 0.5,
                pos: z.pos
            };
        });
    },

    /**
     * Wie sich die Anweisungen in Zahlen auswirken. Eine Stelle, an der
     * alle Engines nachschlagen - so meint "hohes Pressing" ueberall dasselbe.
     */
    wirkung(tactics) {
        const t = tactics || {};
        const w = k => this.wert(t, k);
        return {
            // Pressing: ab welcher Hoehe (Anteil des Feldes aus Sicht des Gegners)
            pressingLinie: { high: 0, medium: 0.33, low: 0.5 }[w("pressing")] + { oefter: -0.08, normal: 0, seltener: 0.08 }[w("anlaufen")],
            presser: { oefter: 3, normal: 2, seltener: 1 }[w("anlaufen")],
            pressTempo: { oefter: 1.95, normal: 1.85, seltener: 1.6 }[w("anlaufen")],
            gegenpressing: { gegenpressing: 4.2, normal: 2.2, zurueckziehen: 0 }[w("nachBallverlust")],
            rueckzugEile: w("nachBallverlust") === "zurueckziehen" ? 1.75 : 1.6,
            konter: { kontern: 1, normal: 0, ballsichern: -1 }[w("nachBallgewinn")],
            deckung: w("deckung"),
            zoneFaktor: { raum: 1, mannorientiert: 1.8, mann: 3 }[w("deckung")],
            falle: w("pressingfalle"),
            kompakt: { eng: -0.07, normal: 0, breit: 0.08 }[w("kompaktheit")],
            abseitsfalle: w("abseitsfalle") === "ja",
            breite: { eng: -6, normal: 0, breit: 3 }[w("breite")],
            freiheit: { diszipliniert: 0.6, normal: 1, frei: 1.5 }[w("freiheit")],
            aussen: { links: w("aussenLinks"), rechts: w("aussenRechts") },
            flanken: w("flanken"),
            abschluss: w("abschluss"),
            dribbling: { weniger: -0.35, normal: 0, mehr: 0.35 }[w("dribbling")],
            torwartKurz: { kurz: 0.5, gemischt: 0, lang: -0.6 }[w("torwartAbspiel")],
            aufbauUeber: w("aufbauUeber"),
            durchsPressing: { spielen: -0.25, gemischt: 0, lang: 0.35 }[w("durchsPressing")],
            zweikampf: { zurueckhaltend: -1, normal: 0, hart: 1 }[w("zweikampf")],
            flankenVerhindern: { zulassen: -1, normal: 0, verhindern: 1 }[w("flankenVerhindern")],
            abstossStoeren: w("abstossStoeren") === "verhindern",
            torwartSchnell: { schnell: 1, normal: 0, ruhig: -1 }[w("torwartVerteilung")],
            standards: w("standards") === "herausholen"
        };
    },

    /**
     * Wo die Spieler in einer Ansicht stehen - fuer die Vorschau im
     * Taktik-Reiter. "gegen": die Form gegen den Ball; "mit": die Form mit
     * Ball im Angriff (letztes Drittel). Koordinaten wie in den Formationen.
     */
    vorschau(club, positions, ansicht, formationConfigs = {}) {
        const t = this.normalisiere(club?.tactics);
        if (ansicht === "gegen") {
            const plaetze = this.plaetzeInForm(positions, t.formGegenBall, formationConfigs);
            // Gegen den Ball steht die Elf tiefer und enger als in der Aufstellung
            const quelle = plaetze || positions.map(p => ({ x: p.x, y: p.y }));
            const kompakt = { eng: 0.72, normal: 0.8, breit: 0.9 }[t.kompaktheit] || 0.8;
            const tiefer = { deep: 8, medium: 4, high: -2 }[t.defensiveLine] ?? 4;
            return quelle.map((p, i) => this._norm(positions[i].pos) === "TW"
                ? { x: 50, y: 92 }
                : { x: 50 + (p.x - 50) * kompakt, y: Math.min(86, p.y + tiefer) });
        }
        if (ansicht !== "mit") return positions.map(p => ({ x: p.x, y: p.y }));

        if (t.formMitBall !== "auto") {
            const plaetze = t.formMitBall === "grund" ? null : this.plaetzeInForm(positions, t.formMitBall, formationConfigs);
            return positions.map((p, i) => {
                if (this._norm(p.pos) === "TW") return { x: 50, y: 90 };
                const q = plaetze ? plaetze[i] : p;
                return { x: q.x, y: Math.max(12, q.y - 14) };
            });
        }

        // Aus den Rollen: das Positionsspiel im letzten Drittel
        const rollen = this.rollenDerElf(club, positions);
        const feld = positions.filter(p => this._norm(p.pos) !== "TW");
        const yMin = Math.min(...feld.map(p => p.y)), yMax = Math.max(...feld.map(p => p.y));
        const breite = { eng: -8, normal: 0, breit: 2 }[t.breite] || 0;
        const LINIE = 44 + breite;
        const HALB = 21;
        const hoeheZuY = h => 74 - h * 58;
        const plaetze = positions.map((p, i) => {
            const fam = rollen[i].familie;
            if (fam === "TW") {
                const r = this.rolleMitBall("TW", rollen[i].mit);
                return { x: 50, y: 90 - (r.aufbauVor || 0) * 0.6 };
            }
            const r = this.rolleMitBall(fam, rollen[i].mit);
            const tiefe = yMax > yMin ? (yMax - p.y) / (yMax - yMin) : 0.5;
            const seite = Math.sign(p.x - 50) || 1;
            let x = p.x, h = tiefe;
            if (typeof r.hoehe === "number") h = r.hoehe;
            if (r.bahn === "linie") x = 50 + seite * LINIE;
            else if (typeof r.breite === "number") x = 50 + seite * r.breite;
            else if (r.bahn === "halbraum") x = 50 + seite * Math.max(HALB, Math.abs(p.x - 50));
            else if (r.bahn === "kette") x = 50 + (p.x - 50) * 1.35;
            if (r.dynamisch) { x = 50 + seite * (LINIE - 4); h = 0.5; }
            if (fam === "FL" && r.bahn === "linie") h = Math.max(h, 0.85);
            if (fam === "ZM" && typeof r.hoehe !== "number") h = Math.min(1, h + 0.05);
            if (r.kippt) { x = 50; h = 0.05; }
            if (r.frei) h = 0.82;
            return { x, h };
        });
        // Wie auf dem Platz: Wer denselben Raum will, staffelt sich dahinter
        const punkte = plaetze.map((p, i) => rollen[i].familie === "TW" ? null : { q: p.x, t: p.h });
        this.entzerre(punkte, 12, 0.3);
        return plaetze.map((p, i) => (typeof p.h === "number")
            ? { x: p.x, y: hoeheZuY(punkte[i] ? punkte[i].t : p.h) }
            : p);
    },

    /**
     * Der Taktik-Check: Hinweise wie vom Co-Trainer - was an der Taktik
     * auffaellt, bevor der Anpfiff es zeigt.
     */
    pruefe(club, positions) {
        const t = this.normalisiere(club?.tactics);
        const w = this.wirkung(t);
        const hinweise = [];
        if (!Array.isArray(positions) || !positions.length) return hinweise;
        const rollen = this.rollenDerElf(club, positions);
        const mitRollen = rollen.map(r => this.rolleMitBall(r.familie, r.mit));
        const gegenRollen = rollen.map(r => this.rolleGegenBall(r.familie, r.gegen));

        // Wer haelt mit Ball die Seitenlinien?
        if (t.formMitBall === "auto") {
            [-1, 1].forEach(seite => {
                const halter = positions.filter((p, i) => Math.sign(p.x - 50) === seite && Math.abs(p.x - 50) > 12
                    && (mitRollen[i].bahn === "linie" || mitRollen[i].dynamisch));
                if (halter.length === 0) {
                    hinweise.push({ art: "warn", text: `Niemand hält mit Ball die ${seite < 0 ? "linke" : "rechte"} Seitenlinie - der Angriff wird dort eng.` });
                }
            });
        }
        // Absicherung mit Ball: Wie viele bleiben hinten?
        const hinten = positions.filter((p, i) => {
            const r = mitRollen[i];
            if (rollen[i].familie === "TW") return false;
            if (rollen[i].familie === "IV") return !(typeof r.hoehe === "number" && r.hoehe > 0.25);
            return typeof r.hoehe === "number" ? r.hoehe <= 0.35 : ["DM"].includes(rollen[i].familie) && !r.hoehe;
        }).length;
        if (hinten < 3) hinweise.push({ art: "warn", text: `Mit Ball sichern nur ${hinten} Spieler ab - ein Konter trifft auf eine offene Abwehr.` });
        else hinweise.push({ art: "ok", text: `Mit Ball sichern ${hinten} Spieler gegen Konter ab.` });

        // Bahnregel: mehr als zwei im selben Halbraum oder in der Mitte vorn
        if (t.formMitBall === "auto") {
            [-1, 1].forEach(seite => {
                const imHalbraum = positions.filter((p, i) => {
                    const r = mitRollen[i];
                    const quer = typeof r.breite === "number" ? r.breite : (r.bahn === "halbraum" ? 21 : null);
                    return quer !== null && quer > 12 && quer < 28 && Math.sign(p.x - 50) === seite
                        && typeof r.hoehe === "number" && r.hoehe >= 0.75;
                }).length;
                if (imHalbraum >= 3) hinweise.push({ art: "warn", text: `${imHalbraum} Spieler wollen vorn in den ${seite < 0 ? "linken" : "rechten"} Halbraum - sie stehen sich im Weg und staffeln sich dahinter.` });
            });
        }

        const konter = gegenRollen.filter(r => r.konter).length;
        if (konter >= 3) hinweise.push({ art: "warn", text: `${konter} Konterspieler bleiben vorn - gegen den Ball fehlen dann Leute im Block.` });
        else if (konter > 0) hinweise.push({ art: "ok", text: `${konter} Konterspieler ${konter === 1 ? "bleibt" : "bleiben"} vorn als Anspielstation nach dem Ballgewinn.` });

        if (t.deckung === "mann") hinweise.push({ art: "warn", text: "Manndeckung kostet viel Kraft und reißt Lücken, wenn ein Gegner seinen Mann schlägt." });
        if (t.pressing === "high" && t.defensiveLine === "deep") hinweise.push({ art: "warn", text: "Hohes Anlaufen mit tiefer Abwehrlinie: Zwischen Pressing und Kette entsteht ein großer Raum." });
        if (t.pressing === "low" && t.defensiveLine === "high") hinweise.push({ art: "warn", text: "Tiefes Anlaufen mit hoher Abwehrlinie: Der Gegner hat Zeit für den Ball hinter die Kette." });
        if (t.abseitsfalle === "ja" && t.defensiveLine === "deep") hinweise.push({ art: "warn", text: "Eine Abseitsfalle braucht eine hohe Linie - tief stehend verpufft sie." });
        if (t.nachBallverlust === "gegenpressing" && t.anlaufen === "seltener") hinweise.push({ art: "warn", text: "Gegenpressing und seltenes Anlaufen widersprechen sich." });
        if (w.presser === 3 && w.gegenpressing > 3) hinweise.push({ art: "ok", text: "Viel Pressing: Die Elf gewinnt den Ball hoch, ermüdet aber schneller." });
        if (t.breite === "eng" && (t.flanken === "frueh" || t.flanken === "grundlinie")) hinweise.push({ art: "warn", text: "Enger Angriff mit Flanken: Es steht kaum jemand außen, der flanken kann." });
        const ziel = mitRollen.some(r => r.id === "st_ziel");
        if (t.flanken === "frueh" && !ziel) hinweise.push({ art: "ok", text: "Frühe Flanken - ein Zielspieler im Sturm würde sie besser verwerten." });
        if (!hinweise.some(h => h.art === "warn")) hinweise.unshift({ art: "ok", text: "Die Taktik ist in sich stimmig." });
        return hinweise;
    },

    /**
     * Die Bahnregel des Positionsspiels: Nie stehen zwei auf demselben
     * Fleck. Wollen zwei Spieler (etwa inverser Fluegel und Halbraumlaeufer)
     * denselben Raum, rueckt der tiefere eine Staffel dahinter - so entsteht
     * die Staffelung, die man in Analysebildern sieht, statt eines Knotens.
     *
     * punkte: [{ q (quer), t (Tiefe 0..1) }], wird veraendert.
     * querAbstand: Mindestabstand quer, tiefenAbstand: in der Tiefe.
     */
    entzerre(punkte, querAbstand = 9, tiefenAbstand = 0.16) {
        for (let runde = 0; runde < 4; runde++) {
            let bewegt = false;
            for (let i = 0; i < punkte.length; i++) {
                for (let j = i + 1; j < punkte.length; j++) {
                    const a = punkte[i], b = punkte[j];
                    if (!a || !b || a.fest && b.fest) continue;
                    if (Math.abs(a.q - b.q) >= querAbstand || Math.abs(a.t - b.t) >= tiefenAbstand) continue;
                    // Der Tiefere (bei Gleichstand der Weiter-innen) weicht nach hinten aus
                    const tiefer = (a.fest || (!b.fest && b.t < a.t)) ? b : a;
                    const hoeher = tiefer === a ? b : a;
                    tiefer.t = hoeher.t - tiefenAbstand;
                    bewegt = true;
                }
            }
            if (!bewegt) break;
        }
        return punkte;
    },

    /** Kuerzel und Farbgruppe einer Rolle (phase: "mit" oder "gegen") */
    kuerzel(rolle, phase = "mit") {
        const tabelle = phase === "gegen" ? ROLLEN_KUERZEL_GEGEN : ROLLEN_KUERZEL_MIT;
        const e = tabelle[rolle?.id];
        return e ? { text: e[0], kategorie: e[1] } : { text: (rolle?.name || "?").slice(0, 3).toUpperCase(), kategorie: "standard" };
    },

    /**
     * Die Verbindungen der Taktiktafel: wer mit wem zusammenspielt und wie
     * gut die beiden Rollen zueinander passen. Wie die Linien im FM26 -
     * nur mit Erklaerung, warum eine Verbindung traegt oder hakt.
     *
     * Rueckgabe: [{ a, b, guete: "stark" | "gut" | "schwach", text }] mit
     * a und b als Slot-Index.
     */
    verbindungen(club, positions, phase = "mit") {
        if (!Array.isArray(positions) || positions.length < 2) return [];
        const rollen = this.rollenDerElf(club, positions);
        const r = i => phase === "gegen"
            ? this.rolleGegenBall(rollen[i].familie, rollen[i].gegen)
            : this.rolleMitBall(rollen[i].familie, rollen[i].mit);
        const fam = i => rollen[i].familie;
        const idx = positions.map((_, i) => i);
        const seite = i => Math.abs(positions[i].x - 50) < 12 ? 0 : Math.sign(positions[i].x - 50);
        const abstand = (i, j) => Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
        const naechster = (i, kandidaten) => kandidaten.filter(j => j !== i).sort((a, b) => abstand(i, a) - abstand(i, b))[0];
        const liste = [];
        const neu = (a, b, guete, text) => {
            if (a === undefined || b === undefined || a === b) return;
            if (liste.some(v => (v.a === a && v.b === b) || (v.a === b && v.b === a))) return;
            liste.push({ a, b, guete, text });
        };
        const hinten = idx.filter(i => ["AV", "SCH"].includes(fam(i)));
        const fluegel = idx.filter(i => fam(i) === "FL" || (fam(i) === "OM" && Math.abs(positions[i].x - 50) > 22));
        const ivs = idx.filter(i => fam(i) === "IV").sort((a, b) => positions[a].x - positions[b].x);
        const dms = idx.filter(i => fam(i) === "DM");
        const mitte = idx.filter(i => fam(i) === "ZM" || (fam(i) === "OM" && Math.abs(positions[i].x - 50) <= 22));
        const sturm = idx.filter(i => fam(i) === "ST");
        const name = (i) => r(i).name;

        // Die Seiten: Aussenverteidiger und Fluegel derselben Seite
        [-1, 1].forEach(s => {
            const a = hinten.filter(i => seite(i) === s)[0];
            const b = fluegel.filter(i => seite(i) === s).sort((x, y) => positions[x].y - positions[y].y)[0];
            if (a === undefined || b === undefined) return;
            const ra = r(a), rb = r(b);
            const seitenname = s < 0 ? "linke" : "rechte";
            if (phase === "gegen") {
                if (rb.verfolgt) neu(a, b, "stark", `${seitenname} Seite: ${name(b)} arbeitet zurück - die Seite wird gedoppelt.`);
                else if (rb.konter && ra.heraus) neu(a, b, "schwach", `${seitenname} Seite: Der Flügel bleibt vorn, der Außenverteidiger rückt heraus - dahinter ist die Seite offen.`);
                else if (rb.konter) neu(a, b, "gut", `${seitenname} Seite: Der Außenverteidiger verteidigt oft allein, dafür bleibt ein Konterspieler vorn.`);
                else neu(a, b, "gut", `${seitenname} Seite: Außenverteidiger und Flügel verteidigen die Seite zusammen.`);
                return;
            }
            const aBreit = ra.bahn === "linie" || ra.dynamisch;
            const bBreit = rb.bahn === "linie";
            if (aBreit && !bBreit) neu(a, b, "stark", `${seitenname} Seite: ${name(a)} gibt die Breite, ${name(b)} zieht nach innen.`);
            else if (!aBreit && bBreit) neu(a, b, "stark", `${seitenname} Seite: ${name(b)} hält die Linie, ${name(a)} rückt ein.`);
            else if (aBreit && bBreit && ra.dynamisch) neu(a, b, "gut", `${seitenname} Seite: klassisches Hinterlaufen - der Außenverteidiger geht im letzten Drittel mit.`);
            else if (aBreit && bBreit) neu(a, b, "schwach", `${seitenname} Seite: Beide wollen an die Seitenlinie - sie stehen sich im Weg.`);
            else neu(a, b, "schwach", `${seitenname} Seite: Beide ziehen nach innen - niemand hält die Seitenlinie.`);
        });

        // Die Innenverteidiger nebeneinander
        for (let k = 0; k + 1 < ivs.length; k++) {
            const a = ivs[k], b = ivs[k + 1];
            const ra = r(a), rb = r(b);
            if (phase === "gegen") {
                if ((ra.heraus && rb.tiefer) || (rb.heraus && ra.tiefer)) neu(a, b, "stark", "Innenverteidiger: Einer rückt heraus, der andere sichert ab.");
                else if (ra.heraus && rb.heraus) neu(a, b, "schwach", "Innenverteidiger: Beide rücken heraus - dahinter ist niemand.");
                else neu(a, b, "gut", "Innenverteidiger: Die Kette hält zusammen.");
            } else {
                const aufbauend = x => ["iv_spielmacher", "iv_aufrueckend", "iv_ueberlappend"].includes(x.id);
                if (aufbauend(ra) && aufbauend(rb) && ra.id === rb.id && ra.id !== "iv_spielmacher") neu(a, b, "schwach", `Innenverteidiger: Zwei ${ra.name} - hinten bleibt niemand.`);
                else if (aufbauend(ra) !== aufbauend(rb)) neu(a, b, "stark", "Innenverteidiger: Einer eröffnet das Spiel, der andere sichert.");
                else neu(a, b, "gut", "Innenverteidiger: gemeinsamer Aufbau aus der Kette.");
            }
        }

        // Sechser mit Achtern und Zehnern
        const ankerListe = dms.length ? dms : [];
        mitte.forEach(m => {
            const d = naechster(m, ankerListe.length ? ankerListe : mitte);
            if (d === undefined) return;
            const rm = r(m), rd = r(d);
            if (phase === "gegen") {
                if (rd.nieHeraus || rd.kippt || rm.nieHeraus) neu(d, m, "stark", `Zentrum: ${name(d)} sichert, ${name(m)} kann herausrücken.`);
                else if (rd.heraus && rm.heraus) neu(d, m, "schwach", "Zentrum: Beide pressen - vor der Kette wird es leer.");
                else neu(d, m, "gut", "Zentrum: Die Mitte verschiebt gemeinsam.");
                return;
            }
            const spielmacher = x => (x.passZiel || 0) >= 0.35;
            const laeufer = x => !!x.laeuft || (typeof x.hoehe === "number" && x.hoehe >= 0.6);
            if (spielmacher(rd) && spielmacher(rm)) neu(d, m, "schwach", `Zentrum: ${name(d)} und ${name(m)} wollen beide den Ball - sie laufen sich in die Quere.`);
            else if (laeufer(rd) && laeufer(rm)) neu(d, m, "schwach", "Zentrum: Beide schieben nach vorn - niemand bleibt vor der Abwehr.");
            else if ((spielmacher(rd) && laeufer(rm)) || (spielmacher(rm) && laeufer(rd)) || rd.kippt) neu(d, m, "stark", `Zentrum: ${name(spielmacher(rd) || rd.kippt ? d : m)} verteilt, ${name(spielmacher(rd) || rd.kippt ? m : d)} läuft in die Tiefe.`);
            else neu(d, m, "gut", "Zentrum: Sechser und Achter spielen sich den Ball zu.");
        });
        if (!ankerListe.length) {
            // Ohne Sechser: die Mittelfeldspieler untereinander
            for (let k = 0; k + 1 < mitte.length; k++) neu(mitte[k], mitte[k + 1], "gut", "Zentrum: Die Achter verbinden sich.");
        }

        // Der Sturm: mit dem naechsten Zulieferer und untereinander
        sturm.forEach(st => {
            const rs = r(st);
            const partner = naechster(st, [...mitte, ...fluegel, ...sturm]);
            if (partner === undefined) return;
            const rp = r(partner);
            if (phase === "gegen") {
                if (rs.heraus && rp.heraus) neu(st, partner, "stark", "Vorn: Zu zweit gegen den Aufbau des Gegners.");
                else if (rs.konter && rp.konter) neu(st, partner, "schwach", "Vorn: Beide bleiben stehen - der Aufbau des Gegners läuft ungestört.");
                else neu(st, partner, "gut", "Vorn: Einer läuft an, einer stellt zu.");
                return;
            }
            if (rs.id === "st_neun" && (rp.laeuft || rp.id === "fl_invers")) neu(st, partner, "stark", `Sturm: Die falsche Neun lässt sich fallen, ${name(partner)} läuft in den frei gewordenen Raum.`);
            else if (rs.id === "st_ziel" && (rp.flanken || rp.bahn === "linie")) neu(st, partner, "stark", "Sturm: Flanken von außen auf den Zielspieler.");
            else if ((rs.id === "st_knipser" || rs.laeuft) && (rp.passZiel || 0) >= 0.3) neu(st, partner, "stark", `Sturm: ${name(partner)} spielt den Pass, ${name(st)} läuft ein.`);
            else if (rs.id === "st_neun" && rp.id === "st_neun") neu(st, partner, "schwach", "Sturm: Zwei falsche Neunen - im Strafraum steht niemand.");
            else if (rs.id === "st_ziel" && rp.id === "st_knipser") neu(st, partner, "stark", "Sturm: Der Große legt ab, der Kleine schließt ab.");
            else neu(st, partner, "gut", "Sturm: Zusammenspiel vorn.");
        });

        return liste;
    },

    /** Setzt eine Vorlage: Anweisungen, Formen, Rollenstil */
    wendeVorlageAn(tactics, key) {
        const v = TAKTIK_VORLAGEN[key];
        const t = this.normalisiere(tactics);
        if (!v) return t;
        Object.assign(t, this.standardAnweisungen(), v.anweisungen);
        t.formMitBall = v.formMitBall;
        t.formGegenBall = v.formGegenBall;
        t.vorlage = key;
        // Die Rollen folgen dem Stil der Vorlage
        t.rollen = {};
        t.attackFocus = t.focus;
        return t;
    },

    /**
     * Die Vorlage, die zu einem Verein passt - fuer die KI-Vereine, damit
     * nicht alle gleich spielen. Starke Vereine spielen eher Ballbesitz und
     * Pressing, schwache stehen tiefer und kontern.
     */
    vorlageFuerVerein(club, zufall = Math.random) {
        const rep = club?.reputation || 60;
        const r = zufall();
        if (rep >= 82) return r < 0.45 ? "positionsspiel" : (r < 0.8 ? "gegenpressing" : "ausgewogen");
        if (rep >= 70) return r < 0.3 ? "gegenpressing" : (r < 0.55 ? "ausgewogen" : (r < 0.75 ? "fluegelspiel" : (r < 0.88 ? "manndeckung" : "positionsspiel")));
        if (rep >= 58) return r < 0.35 ? "ausgewogen" : (r < 0.6 ? "konter" : (r < 0.8 ? "fluegelspiel" : "direkt"));
        return r < 0.35 ? "konter" : (r < 0.6 ? "direkt" : (r < 0.8 ? "tieferBlock" : "ausgewogen"));
    }
};

if (typeof window !== "undefined") {
    window.TacticsEngine = TacticsEngine;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { TacticsEngine };
}
