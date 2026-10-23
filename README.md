# ⚽ Viererkette – Fußballmanager im Browser

Ein leichtgewichtiger, detailreicher und vollständig spielbarer **Fußballmanager im Browser**, der ohne Installation direkt gestartet, als PWA installiert oder als Paket (z. B. ZIP) an Freunde verschickt werden kann.

> **Namen:** Vereine, Stadien, Spieler und Wettbewerbe tragen erfundene Namen. Städte, Stadiongrößen, Kaderstärken und Ligaformate folgen der Saison 2024/25. Wer mit anderen Namen spielen möchte, lädt in den Einstellungen (oder auf dem Startbildschirm) eine **Namensdatei** – siehe [Namensdatei](#-namensdatei).

---

## 🚀 Spiel starten & Spielanleitung

> 📱 **Auf dem Handy spielen?** Siehe [Auf dem Smartphone spielen](#-auf-dem-smartphone-spielen) weiter unten – auf dem Telefon reicht ein Doppelklick auf `index.html` nicht, dafür lässt sich das Spiel dort als App installieren und läuft dann offline.

### 1. Spiel starten (Keine Installation nötig!)
* **Einfacher Doppelklick:** Öffne die Datei **`index.html`** in einem modernen Webbrowser: Safari ab 14.5 (auch iPhone und iPad), Firefox ab 78, Chrome und Edge ab 80. Ein älterer Browser zeigt einen Hinweis statt einer leeren Seite; `node pruefung.js` meldet Sprachmittel und CSS, die diese Browser nicht kennen.
* **Oder via lokalem Webserver:**
  ```bash
  python3 -m http.server 8000
  ```
  und rufe `http://localhost:8000` im Browser auf.
* **PWA-Unterstützung:** Kann direkt als Web-App auf dem Desktop oder Smartphone installiert und offline gespielt werden.
* **Hinweis zu Browser-Cache & Service Worker (Entwicklung/Updates):**
  Falls nach Code-Änderungen alte Dateien im Browser gecached sein sollten:
  1. Im Browser DevTools öffnen (`F12`).
  2. Tab **Application** (oder *Anwendung*) -> **Service Workers** -> **Unregister** klicken.
  3. Unter **Storage** (oder *Speicher*) -> **Clear site data** (oder *Websitedaten löschen*) klicken.
  4. Seite mit `Strg + F5` (bzw. `Cmd + Shift + R`) neu laden.

---

### 2. Neues Spiel erstellen & Verein auswählen
1. Klicke im Startbildschirm auf **"⭐ Neues Spiel starten"**.
2. **Schritt 1 (Managerprofil):** Gib deinen Namen ein, wähle Nationalität, Geburtsdatum und deinen gewünschten Schwierigkeitsgrad (*Leicht*, *Normal*, *Schwer*).
3. **Schritt 2 (Liga):** Wähle die Liga, in der deine Karriere beginnt – **alle zwanzig Ligen der Spielwelt** stehen zur Wahl, nach Ländern gruppiert: die komplette deutsche Pyramide von der 1. Liga bis zur Landesliga sowie je drei Ligen in England (Premier Division, First Division, Second Division), Spanien (Primera División, Segunda División, Tercera División), Italien (Prima Divisione, Seconda Divisione, Terza Divisione) und Frankreich (Première Division, Deuxième Division, National). Zu jeder Liga siehst du Vereinszahl, Spieltage, Wertung und Europapokalplätze.
4. **Schritt 3 (Vereinsauswahl & Kaderanalyse):**
   - Zur Auswahl stehen die Vereine **der in Schritt 2 gewählten Liga** – wer in der Landesliga anfangen will, bekommt hier auch nur Landesligisten angeboten. Die Liga lässt sich hier oben jederzeit wechseln.
   - Suche nach Name, Stadt oder Ligennamen und sortiere nach Kaderstärke oder Budget.
   - Wähle links einen Verein aus, um rechts sofort die detaillierte Analyse (Liga, Top-Spieler, Talente, Finanzen und Vorstandsziel) einzusehen.
   - Klicke auf **"✅ Diesen Verein übernehmen & Saison starten"**.
   - Startest du in der Landesliga, spielst du 30 Spieltage gegen 15 Amateurvereine – der Weg nach oben führt über den Aufstieg.
5. Du landest direkt in deinem Manager-Dashboard.

**Einstieg für neue Spieler** (`js/ui/uiEinstieg.js`): Im ersten Schritt des Assistenten steht **„Mit Erklärungen starten“** – angehakt, solange es noch keine andere Karriere gibt. Dann hilft das Spiel auf drei Wegen, alle in den Einstellungen abschaltbar:

- **Erste Schritte:** Eine Karte auf der Übersicht führt in sieben Schritten bis zum ersten Pflichtspiel: Kader, Taktik, Vorbereitung (solange sie läuft), Training, Transfermarkt, den ersten Tag spielen, das erste Pflichtspiel. Ein Schritt ist erledigt, sobald man ihn getan hat – abhaken gibt es nicht. **Öffnen** springt in den Bereich, der nächste offene Schritt ist hervorgehoben.
- **Erklärungen:** Beim ersten Besuch eines Bereichs steht oben ein Kasten mit dem Wichtigsten in zwei, drei Sätzen. **Verstanden** blendet ihn für diese Karriere aus; in den Einstellungen lassen sich alle wieder einblenden.
- **Kurzanleitung und Begriffe:** Worum es geht, wie ein Tag abläuft, und was Sterne, Potenzial, Moral, Form, Kondition, Spielschärfe, Vertrautheit, Rolle, Scoutwissen, Vorstandsvertrauen, Ruf und xG bedeuten. Erreichbar vom Startbildschirm, aus jedem Erklärkasten und aus den Einstellungen. Sie ersetzt die alte Spielbeschreibung, die noch von 18 Erstligavereinen und 7 Formationen sprach.

Der Stand liegt im Spielstand (`state.einstieg`) und reist mit der Karriere, auch beim Export. Ältere Spielstände bekommen nichts ungefragt; wer möchte, schaltet die Erklärungen in den Einstellungen ein.

---

### 3. Spielstand-Speicherung & Weitergabe an Freunde

Das Spiel besitzt ein vollständiges, robustes Speichersystem:

* **Automatisches Speichern in IndexedDB (`SpeicherDB`):**
  Jede Aktion (Spieltage, Transfers, Taktik, Training, Vertragsverlängerungen) wird automatisch im Browser gesichert – in der Browser-Datenbank IndexedDB statt im LocalStorage. Der LocalStorage fasst je nach Browser nur 5 bis 10 MB; IndexedDB bekommt einen Anteil am freien Plattenplatz, meist mehrere hundert Megabyte. Auch lange Karrieren mit vielen Saisons Geschichte passen hinein.
  * Ein alter Spielstand aus dem LocalStorage zieht beim ersten Start automatisch um; danach wird der LocalStorage freigegeben.
  * Gibt es kein IndexedDB (sehr alte Browser, manche private Fenster) oder scheitert ein Schreibvorgang, springt der LocalStorage ein. Liegen in beiden Speichern Stände, gilt beim nächsten Start der jüngere.
  * Gesammelt wird eine Sekunde lang, dann einmal geschrieben. Beim Schließen oder Wegwechseln der Seite geht ein offener Stand sofort an die Datenbank.
  * Unter **Spielstand & Einstellungen** steht, wo der Stand liegt, wie groß er ist und wie viel Platz der Browser noch frei hält.
* **Fünf Speicherplätze:**
  Bis zu fünf Karrieren liegen nebeneinander. Eine neue Karriere bekommt den ersten freien Platz und überschreibt keine laufende; sind alle belegt, fragt das Spiel, ob sie den am längsten nicht gespielten Stand ersetzen soll. Platz 1 behält den bisherigen Schlüssel – ein vorhandener Stand liegt nach dem Update ohne Umzug dort.
  * Ein kleines Verzeichnis kennt zu jedem Platz Verein, Saison, Spieltag und Speicherzeit. In IndexedDB wird es im selben Vorgang geschrieben wie der Stand selbst und kann deshalb nicht von ihm abweichen. Der Startbildschirm liest nur den zuletzt gespielten Stand ganz ein, die anderen erst, wenn man sie lädt.
  * Unter **Spielstand & Einstellungen → Spielstände** lassen sich Plätze laden und löschen, und der laufende Stand lässt sich als Kopie auf einen freien Platz legen – eine dauerhafte Momentaufnahme, die keine Sicherung verdrängt.
  * Wird eine Datei derselben Karriere importiert, ersetzt sie nach Rückfrage deren Platz; eine fremde Karriere kommt auf einen freien Platz.
* **Sicherungen (rollierend):**
  Je Karriere hält das Spiel die letzten drei Sicherungen, höchstens eine pro Spielwoche: Liegt die jüngste Sicherung sieben Kalendertage im Spiel zurück oder in einer früheren Saison, wird der Stand beim Speichern zusätzlich als Sicherung abgelegt, die älteste fällt heraus. So ist ein beschädigter oder versehentlich verdorbener Stand nicht mehr das Ende der Karriere.
  * **Zurückholen** fragt nach und legt den jetzigen Stand vorher selbst als Sicherung ab – auch das Zurückholen lässt sich also umkehren.
  * **Sicherung jetzt anlegen** sichert von Hand, etwa vor einer großen Transferentscheidung.
  * Eine neue Karriere auf einem belegten Platz nimmt die Sicherungen der alten nicht mit; verwaiste Sicherungen räumt der nächste Start auf.
  * Sicherungen gibt es nur mit IndexedDB – der LocalStorage fasst kaum einen einzigen Stand.
* **Spielstand fortsetzen:**
  Beim erneuten Öffnen zeigt der Startbildschirm die zuletzt gespielte Karriere groß mit Verein, Saison, Spieltag, Tabellenplatz und Speicherzeitpunkt, die übrigen darunter. **Weiterspielen** setzt die zuletzt gespielte fort.
* **Spielstand exportieren:**
  Klicke im Menü unter **"Spielstand & Optionen"** auf **"💾 Spielstand exportieren"**. Du erhältst eine `.json`-Datei mit einem sprechenden Dateinamen (z. B. `fm-save-fc-münchen-saison-1-spieltag-5.json`). Die Datei ist verdichtet wie der Browserspeicher (rund 2 MB statt über 10 MB) und wird als Blob heruntergeladen, damit auch große Stände nicht an der Längengrenze von `data:`-Adressen scheitern. Ältere, unverdichtete Exportdateien lassen sich weiter importieren.
* **Spielstand an Freunde verschicken / Importieren:**
  Verschicke deine `.json`-Datei an Freunde. Diese können im Startbildschirm auf **"📁 Spielstand importieren"** klicken und deinen Spielstand auf ihrem Gerät sofort weiterspielen.
* **Automatische Migration (`MigrationService`):**
  Ältere Spielstände werden beim Laden oder Importieren automatisch auf das aktuelle Schema migriert, ohne dass Fortschritt verloren geht.

---

## 🌟 Highlights & Spielfunktionen

### 🎙️ Rund um den Spieltag
- **Ausfall in der Startelf:** Steht ein Verletzter oder Gesperrter in der Elf, startet das Spiel nicht. Bisher brachte jeder Klick auf *Weiter* nur dieselbe kurze Meldung, und wer sie übersah, hing fest. Jetzt bietet die Meldung *Co-Trainer stellt um*: Er ersetzt nur die Ausfälle durch den besten verfügbaren Spieler für die Position, nennt die Wechsel und pfeift an. Der Stammspieler bekommt seinen Platz nach der Genesung zurück. Der Schreibtisch nennt einen Ausfall in der Startelf schon vorher ganz oben.
- **Konferenz (`KonferenzEngine`):** Im Ligaspiel zeigt der Reiter *Konferenz* die Zwischenstände der anderen Partien zur laufenden Minute und die Tabelle, wie sie gerade stünde. Tore auf anderen Plätzen stehen im Ticker; trifft ein Tabellennachbar, blendet sich die Konferenz kurz über dem Spielfeld ein.
- **Stadion-Atmosphäre (`AtmosphaereEngine`):** Derbys, Europapokalnächte, Finals und Spiele um Titel oder Klassenerhalt sind lauter und bekommen zum Anpfiff eine Choreo in den Vereinsfarben. Die Ränge reagieren auf die Lage: Gesang, Stille, „Olé“, Pfiffe, Applaus oder Pfeifkonzert zum Abpfiff.
- **Klang und Menümusik (`js/ui/klang.js`):** Alles entsteht im Browser - keine Aufnahmen, keine Rechte Dritter.
  - **Pfiffe wie mit einer Kugelpfeife:** zwei eng beieinanderliegende Töne um 3 kHz, das Flattern der Kugel, etwas Atem. Kurz beim Abseits und Freistoß, kräftig beim Foul, länger bei der Karte, lang zum Anstoß, zweimal zur Halbzeit, dreimal zum Abpfiff (der letzte lang). Zur Ecke, zum Einwurf und zum Abstoß wird nicht gepfiffen.
  - **Kulisse:** Rauschen in drei Stimmlagen und ein tiefes Grollen, jede Lage schwillt für sich an und ab. Sie wird lauter und heller, je näher der Ball am Tor ist, und ist in großen Spielen größer.
  - **Was man hört, sagt etwas:** Beim Heimtor schreit das Stadion auf, beim Gegentor jubelt nur der ferne Gästeblock, und die Kulisse fällt zusammen. Bei der eigenen Chance raunt es laut, bei der des Gegners leise. Dazu Schuss, Pfosten, Applaus, Pfeifkonzert und der Takt der Kurve (Trommeln, Klatschen, Rufe, ohne fremde Melodie). In der Konferenz kündigt ein Gong Tore der Tabellennachbarn an.
  - **Menü:** leise Glockentöne für Vertrag, Transfer und Bau statt Pfiff und Torfanfare; der echte Anpfiff zum Karrierestart und zur neuen Saison, der Abpfiff zum Saisonende.
  - **Menümusik:** ein ruhiges, selbst komponiertes Stück im Lo-fi-Stil: weiches E-Piano, Bass, Besen, ab und zu eine Glockenmelodie, 74 Schläge je Minute. Es wird beim Spielen aus jazzigen Akkorden (Form A-A-B-A, 32 Takte) zusammengesetzt und klingt deshalb nie ganz gleich; Durchgangstöne reiben nie am Akkord, jede Phrase endet auf einem Akkordton. Sie beginnt nach dem ersten Tippen, blendet im Livespiel aus (dort spielt die Kulisse) und kommt mit dem Spielbericht zurück. Ist die Seite verborgen, pausiert der Ton.
  - **Einstellungen:** Sound (Pfiffe, Kulisse, Menütöne) und Musik getrennt schaltbar, dazu ein Regler für die Lautstärke der Musik - gespeichert im Gerät.
- **Stimmen der Fans (`FanEngine`):** Die Fanstimmung folgt den Ergebnissen, gemessen an der Erwartung, im Derby stärker. Nach jedem Pflichtspiel und nach großen Transfers melden sich Fans mit kurzen Beiträgen; die Übersicht zeigt die jüngsten.
- **Spieler in den Medien (`MedienEngine`):** Nach Ligaspielen gibt ab und zu ein Spieler ein Interview: der Frustrierte auf der Bank, der Matchwinner, das Talent, der Kapitän nach einer Pleitenserie, der Umworbene, der Spieler mit auslaufendem Vertrag. Was er sagt, wirkt auf Mediendruck, Kabine und Fans.
- **Meilensteine, Trophäenschrank und Saisonrückblick (`MeilensteinEngine`):** Jubiläen von Trainer und Spielern (Spiele, Siege, Tore, Titel, Jahre im Verein) kommen als Nachricht und in die Chronik. Die Vereinsseite zeigt den Trophäenschrank, der Saisonabschluss die Saison in Zahlen.
- **U19-Liga (`JugendligaEngine`):** Die Talente der Akademie spielen in einer Liga mit zwölf Nachwuchsteams aus dem eigenen Land - mit Tabelle, Ergebnissen und Torjägern im Reiter Jugend. Die U19-Meisterschaft kommt in den Trophäenschrank.
- **U23-Liga (`ReserveEngine.ligaStarte`):** Die zweite Mannschaft spielt gegen die zweiten Mannschaften anderer Vereine aus dem eigenen Land, so viele, dass jeder Spieltag der Profis ein Spieltag der U23 ist (34 Spieltage: 18 Teams). Tabelle, Ergebnisse und Torjäger stehen im Reiter Jugend, die U23-Meisterschaft kommt in den Trophäenschrank. Steht niemand in der U23, spielt sie mit Amateuren. Ein Spielstand mitten in der Saison holt die gespielten Spieltage nach.

### 1. 🏆 Liga & Wettbewerb
- **18 Vereine der Liga 1**: Vollständige Kader, Budgets, Stadien, Fanbasen, Sponsoren und Vereinsinfrastruktur.
- **Vollständiger Spielplan**: 34 Spieltage (Hin- & Rückrunde) nach Round-Robin-Verfahren.
- **Vollwertige Simulation**: An jedem Spieltag spielen alle 18 Klubs zeitgleich gegeneinander.
- **Live-Tabelle & Historie**: Punkte (3/1/0-System), Tordifferenz, Tore, Gegentore, Formkurven sowie Archivierung vergangener Meisterschaften. Die Form zählt nur Ligaspiele: Testspiele der Vorbereitung und Pokalspiele stehen nicht darin.
- **Das Vereinsprofil als eigene Seite wie im Vorbild (`uiVereinSeite.js`):** Ein Klick auf einen Verein in der Tabelle, in der Dashboard-Tabelle, im Spielplan oder im Spielerprofil öffnet seine Seite. Sie löst den Reiter ab wie Spielerprofil und Transferangebot; vorher war sie ein Fenster darüber. Zurück führt dorthin, wo man herkam, vom Spieler zum Verein und weiter zurück. Der eigene Verein führt in den Reiter *Verein*.
  - **Kopf:** Wappen, Name, Liga und Land, Stadt und Stadion, eine Marke bei einem Derby gegen den eigenen Verein, das Menü **Aktionen**. Daneben Tabellenplatz, Kader mit Durchschnittsalter, Fans, Stimmung, Ruf, Finanzlage in Worten (*Reich*, *Gesund*, *Solide*, *Knapp*, *Verschuldet*; Zahlen kennt man von fremden Vereinen nicht) und die Mannschaftsstärke in Sternen.
  - **Aktionen** nach Themen wie im Spielerprofil: *Ansehen* (Kader, Spiele, Geschichte), *Spiel* (Gegneranalyse, wenn er der nächste Gegner ist), *Spieler* (bester Spieler, Torjäger).
  - **Übersicht** in Kacheln: Form und nächste Spiele, die Tabelle um den Verein herum, Spielweise mit Trainer, Schlüsselspieler, Verein (Finanzlage, Stadion, Fans, Ruf, Rivalität) und Anlagen. Jeder Verein und jeder Spieler darin ist ein Verweis.
  - **Kader** nach Mannschaftsteilen, mit Sternen und Werten so, wie das eigene Scouting sie kennt, dazu Vertragslaufzeit, Spiele und Tore und die Transferliste.
  - **Spiele:** der ganze Spielplan der Saison mit Ergebnissen.
  - **Geschichte:** die Platzierungen seit dem Spielstart mit Meistertiteln und bestem Platz (für Vereine der eigenen Liga).
- **Auszeichnungen (`AuszeichnungEngine`):**
  - **Monatspreise:** Am Monatsersten kürt die eigene Liga Spieler, Talent (bis 21) und Trainer des Monats.
    - Für den Spieler zählen Notenschnitt, Tore und Vorlagen im Monat, ab drei Spielen.
    - Für den Trainer zählen die Punkte je Spiel.
    - Ein Spieler räumt nicht beide Spielerpreise ab.
  - **Saisonpreise:** Zum Saisonende gibt es sie in der eigenen Liga und den fünf ersten Ligen.
    - Spieler und Talent der Saison, ab der Hälfte der Spiele.
    - Torjäger.
    - Trainer der Saison: wer am weitesten über dem Platz landet, den sein Kader erwarten ließ.
    - Die Elf der Saison im 4-3-3, je Platz der Beste, der dort zu Hause ist.
  - **Folgen:**
    - Preisträger sind etwas mehr wert und besser gelaunt.
    - Die Preise stehen in der Spielerakte („Spieler des Monats ×2 …“).
    - Ein Preis für den eigenen Trainer stärkt seinen Ruf und das Vertrauen des Vorstands.
  - **Anzeige:** Die Ranglisten zeigen die Monatspreise der Saison und die Preise der letzten Saison mit der Elf auf dem Platz. Ein Tipp auf einen Namen öffnet die Akte.
  - **Korrektur im Archiv:** Torschützenkönig und Spieler der Saison wurden vorher über alle 384 Vereine der Welt ermittelt. Jetzt zählt nur die eigene Liga.
- **Statistik je Wettbewerb (`StatistikEngine`):** Neben der Saisonbilanz aller Pflichtspiele führt jeder Spieler, was davon im Pokal (mit Supercup und Relegation) und im Europapokal geschah. Die Liga ist der Rest.
  - Vorher zählten Torjägerliste, Vorlagen, Notenliste, die Preise der Liga und der Torjäger Europas Pokal- und Europapokaltore mit. Ein Stürmer mit Meisterpokal stand allein dadurch vorn.
  - Jetzt zählen dort nur Ligaspiele. Die Akte zeigt unter der Saisonbilanz die Aufteilung (Liga, Pokal, Europapokal), sobald ein Spieler nicht nur in der Liga gespielt hat.
  - Gespeichert wird das als kurze Zahlenreihe und nur für Spieler mit Pokal- oder Europapokaleinsätzen.
- **Jahrespreise (`JahrespreisEngine`):** Nach den Saisonpreisen der Ligen folgt die Gala des Jahres über die fünf ersten Ligen und den Europapokal.
  - **Weltfußballer mit Podest:** Gewertet werden Noten, Tore und Vorlagen der Saison, die Stärke der Liga und die Titel (Meisterschaft, Pokal, Europapokal, auch das Finale der Königsklasse). Ein großer Name zieht ein paar Stimmen. Wählbar ist, wer mindestens 60 % der Ligaspiele bestritten hat.
  - **Talent des Jahres:** bis 21 Jahre, aus den ersten und zweiten Ligen.
  - **Torjäger Europas:** Ligatore mal Faktor - zwei in den ersten Ligen, anderthalb in den zweiten, sonst einer.
  - **Trainer des Jahres:** Titel zählen am meisten, dazu wie weit ein Verein über dem Platz landet, den sein Kader erwarten ließ.
  - **Elf des Jahres** im 4-3-3.
  - **Folgen:** Die Preise stehen in der Akte und steigern Marktwert und Laune. Gewinnt der eigene Trainer, stärkt das seinen Ruf und das Vertrauen des Vorstands. Die Ranglisten zeigen die letzte Gala, die Post fasst sie zusammen.
- **EM und WM (`TurnierEngine`):** Alle zwei Jahre ist der Sommer ein Turniersommer: EM 2028, WM 2030, EM 2032 und so weiter. Gespielt wird in den drei Wochen der Sommerpause.
  - **EM:** die 16 stärksten europäischen Nationen, vier Gruppen, dann Viertelfinale, Halbfinale, Finale. **WM:** die 32 stärksten Nationen, acht Gruppen, dann ab dem Achtelfinale.
  - Je Gruppe kommen zwei weiter. Endet ein K.-o.-Spiel unentschieden, entscheidet das Elfmeterschießen.
  - Die Spiele rechnet die Länderspiel-Engine: Tore, Müdigkeit, Verletzungen, Länderspiele in der Akte. Betreut der Manager eine Nation, zählen sie für seine Bilanz, und er hört nach jeder Runde, ob es weitergeht.
  - **Folgen:** Die Turnierspieler kommen müde in die Vorbereitung (15 Punkte Fitness weniger). Der Titel steht in der Akte („Weltmeister 2030“), steigert den Marktwert um ein Zehntel und hebt die Laune. Dazu ein Torschützenkönig des Turniers.
  - **Anzeige:** Die Ranglisten zeigen das letzte Turnier mit K.-o.-Runden und Gruppen, die Post den Start und das Finale.
- **Finanzregeln (`FinanzregelEngine`):** Bisher konnte der eigene Verein beliebig über seine Verhältnisse zahlen. Jetzt gilt nach dem Vorbild des europäischen Verbands eine Grenze für die Kaderkosten.
  - **Quote:** Spielergehälter, Trainerstab, Spielerprämien und ein Drittel der Ablösen der Saison, geteilt durch den Umsatz (Sponsor und Fernsehgeld, Eintritt, Preisgelder, Transfererlöse). Geld vom Investor oder vom Vorstand zählt nicht als Umsatz.
  - **Folgen:** Bis 70 % ist alles in Ordnung. Darüber gibt es erst eine Verwarnung, in der zweiten Saison in Folge eine Geldstrafe (2 % des Umsatzes) und ein halbes Transferbudget. Über 80 % kommen 5 % Geldstrafe und 3 Punkte Abzug in der nächsten Saison dazu, im Wiederholungsfall 6.
  - **Ablauf:** Gezählt wird über die Buchungen des eigenen Vereins, abgerechnet am Saisonende. Zur Saisonhälfte warnt die Finanzabteilung, wenn die Quote über der Grenze liegt.
  - **Eichung:** Ohne Eingriff liegen die Vereine bei 30 bis 55 % (gemessen über zwei Saisons mit acht Vereinen von der ersten bis zur dritten Liga in vier Ländern). Die Grenze trifft also nur, wer Gehälter und Ablösen über die Einnahmen treibt.
  - **Anzeige:** Die Finanzen zeigen die Quote der laufenden Saison mit Grenze und Strafgrenze, eine laufende Auflage und die letzten fünf Saisons.
- **Fünfjahreswertung (`KoeffizientEngine`):** Die Startplätze im Europapokal standen fest in den Ligadaten. Jetzt sammelt jedes Land Punkte mit seinen Vereinen.
  - **Punkte:** Sieg 2, Remis 1, je erreichter Endrundenrunde 1, Teilnahme an der Königsklasse 2. Der Wert einer Saison ist die Summe geteilt durch die Zahl der Vereine des Landes im Europapokal.
  - **Startplätze:** Rang 1 bis 4 der Fünfjahreswertung stellt vier Vereine in der Königsklasse, Rang 5 drei. Das Land mit dem besten Wert der Vorsaison bekommt einen fünften Platz (Leistungsplatz). Dahinter je ein Platz in Kontinentalpokal und Euro-Cup.
  - **Start:** Die vier Saisons vor der Karriere sind grob den echten Werten nachgebildet, England vor Italien, Spanien, Deutschland und Frankreich.
  - **Anzeige:** Die Ranglisten zeigen die Wertung mit der laufenden Saison und den Plätzen, die sie bringen würde.
- **Meldelisten (`KaderregelEngine`):** Im Europapokal, in der Premier Division und in Primera División spielt nur, wer gemeldet ist.
  - **Europapokal:** Liste A mit höchstens 25 Spielern, davon mindestens acht im Land ausgebildet. Fehlen welche, schrumpft die Liste um genau so viele Plätze. Liste B ohne Obergrenze für Spieler bis 21, die seit zwei Saisons im Verein sind oder aus der eigenen Jugend kommen.
  - **Premier Division:** höchstens 25 Spieler über 21, davon höchstens 17 nicht im Land ausgebildet. Wer 21 oder jünger ist, zählt nicht mit.
  - **Primera División:** höchstens 25 Spieler über 21 und höchstens drei ohne EU-Pass (EU, EWR und Schweiz). Spieler aus den AKP-Staaten zählen wie EU-Bürger. Südamerikaner bekommen nach zwei Saisons im Verein den spanischen Pass. Die erzeugten Kader halten die Grenze zum Start ein. KI-Vereine mit drei Spielern ohne EU-Pass kaufen keinen weiteren, und das Angebotsfenster warnt vor einem Kauf über die Grenze.
  - **Im Land ausgebildet** ist, wer aus der eigenen Jugend kommt oder die Nationalität des Landes hat (für England auch Wales). Die Jugendjahre der Spieler kennt das Spiel nicht, die Nationalität ist eine Annäherung.
  - **Fristen:** Gemeldet wird bis zum ersten Spiel des Wettbewerbs, nachgemeldet im Winterfenster. Ohne abgegebene Liste meldet der Co-Trainer zum Meldeschluss seinen Vorschlag und schreibt eine Nachricht.
  - **Folgen:** Mit einem nicht gemeldeten Spieler in der Startelf gibt es keinen Anpfiff, nicht Gemeldete verschwinden von der Bank. Spielt der Co-Trainer (Urlaub, Sofortergebnis ohne Livespiel), stellt er nur Gemeldete auf.
  - **Anzeige:** Die Karte „Meldeliste“ im Kader zeigt die Plätze, die Ausgebildeten und Liste B, mit Vorschlag und Melden.
  - Die Nicht-EU-Grenze in Spanien ist nicht umgesetzt: Ohne doppelte Staatsbürgerschaften in den Spielerdaten würde sie die spanischen Kader verzerren.
- **Vereinschronik (`ChronikEngine`):** Die Vereinsseite führt ab der Übernahme eine Chronik.
  - **Rekorde:** höchster Sieg, höchste Niederlage, torreichstes Spiel, Zuschauerrekord, längste Sieges- und ungeschlagene Serie, teuerster Kauf und Verkauf. Liga, Pokal und Europapokal zählen.
  - **Titel und Saisonbilanzen:** Titel sowie Liga, Platz, Punkte und Tore jeder Saison.
  - **Spieler:** Rekordspieler und Rekordtorschützen, mit den Spielen aller Saisons für den Verein.
  - **Vereinslegenden:** ab 150 Spielen, 60 Toren oder 80 Spielen mit zwei Titeln.
  - **Meldungen:** Ein neuer Rekord kommt als kurze Nachricht.
  - **Spielerakte:** Sie zeigt die Bilanz für den Verein („Für den Verein seit Saison 1: 164 Spiele …“) und markiert Legenden.
  - Vorher vergaß der Verein nach dem Saisonwechsel alles, was nicht in der Tabelle stand.
- **Vereinsvision (`VisionEngine`):** Bei Amtsantritt legt der Vorstand einen Plan über fünf Spielzeiten fest. Die Karte „Vereinsvision“ im Reiter Verein zeigt den Stand der laufenden Saison.
  - **Fernziel mit Frist:** Es richtet sich danach, wo der Kader steht. Spitzenklubs sollen die Meisterschaft in drei Spielzeiten holen, Kandidaten den Europapokal, das Mittelfeld die obere Hälfte. Unterklassige sollen in zwei oder vier Spielzeiten aufsteigen, Kellerkinder sich in der Liga etablieren.
  - **Drei Jahresziele:**
    - Spielweise: offensiv (Tore je Spiel), das Spiel bestimmen (Ballbesitz) oder kompakt (Gegentore)
    - Kader: Eigengewächse mit zehn Einsätzen, oder junge Zugänge bei schwacher Jugendabteilung
    - Finanzen: ohne Schulden oder im Gehaltsrahmen
  - **Bilanz am Saisonende:** Jedes erfüllte Jahresziel hebt das Vertrauen um 3, jedes verfehlte kostet 3. Das Fernziel zählt zur Frist mit ±8, ein Aufstieg zählt zum nächsten Saisonstart.
  - **Neue Vision:** Es gibt eine neue Vision nach fünf Spielzeiten und bei jedem Vereinswechsel. Die Wahl hängt fest am Verein und an der Saison, ohne Zufall.
- **Trainerkarussell (`TrainerwechselEngine`):** Jeder KI-Verein hat einen Trainer mit Namen, Ruf und Spielweise. Die Vereinsseite nennt ihn.
  - **Druck:** Er wächst mit den Plätzen hinter dem Kaderrang, den Niederlagen der letzten fünf Spiele und einem Platz im Keller oder auf einem Abstiegsrang. Ein großer Name hält etwas mehr aus.
  - **Entlassung:** Ab dem sechsten Spiel trennt sich ein Verein unter Druck mit wachsender Wahrscheinlichkeit, höchstens zweimal je Saison. Ein Neuer bekommt sechs Spiele Schonfrist.
  - **Nachfolger:** Er bringt eine andere Spielweise mit, und die Mannschaft zieht für ein paar Wochen mit (Trainereffekt: +6 Laune).
  - **Sommer:** Absteiger und weit hinter ihrem Anspruch gebliebene Vereine trennen sich oft, einige andere auch ohne Not.
  - **Geeicht über eine simulierte Saison:** 1. Liga 4 Wechsel in der Saison und 2 im Sommer, Premier Division 8+1, Primera División 5+4, Première Division und Prima Divisione 3–4.
  - **Anzeige:** Wechsel in der eigenen Liga kommen per Post. Die Ranglisten zeigen das Trainerkarussell jeder Liga.
  - Vorher hatte kein KI-Verein einen Trainer, und die Spielweise stand bei Spielbeginn für immer fest.
- **Partnervereine (`PartnerEngine`):** Im Reiter Verein lassen sich zwei Kooperationen schließen, je für drei Spielzeiten.
  - **Ausbildungspartner:** ein kleinerer Verein aus dem eigenen Land, tiefer in der Pyramide oder deutlich weniger angesehen. Er kostet im Jahr 0,4 % des Umsatzes.
    - Wer dorthin verliehen wird, spielt mit Einsatzgarantie jedes Spiel, wenn er fit ist. Der Partner trägt die Hälfte des Gehalts.
    - Zum Saisonstart bietet er sein bestes Talent bis 20 Jahre mit Vorkaufsrecht an, für 60 % des Marktwerts.
  - **Großer Partner:** ein deutlich angesehenerer Verein. Er bietet zum Saisonstart zwei junge Spieler bis 23 zur Leihe an, ohne Gebühr und mit halbem Gehalt. Er sagt nur zu, wenn Verein und Trainer etwas gelten.
  - Zweite Mannschaften kommen als Partner nicht infrage. Eine ausgelaufene Kooperation meldet sich per Post und lässt sich neu schließen.
- **Investoren und Übernahmen (`InvestorEngine`):** Ein Mäzen, ein Investmentfonds oder ein Konzern kann einsteigen. Die Karte „Eigentümer & Investor“ im Reiter Verein zeigt Angebot, Investor und Auflagen.
  - **Geld:** zum Einstieg 25 % (Mäzen), 50 % (Fonds) oder 100 % (Konzern) des Jahresumsatzes, danach jede Saison 8–30 %. Der Gehaltsetat steigt um 6–25 %.
  - **Ansprüche:** Ein Fonds will das Saisonziel einen Platz höher, ein Konzern zwei. Der Vorstand verliert schneller die Geduld: Plätze unter dem Ziel kosten mehr Vertrauen, Warnung und Ultimatum kommen früher. Nach zu vielen verfehlten Saisonzielen zieht sich der Investor zurück, und der Gehaltsaufschlag endet.
  - **50+1:** In Deutschland bleibt die Mehrheit beim Verein. Ein Investor übernimmt höchstens 49 % und bringt 40 % weniger Geld. Seine Ansprüche wiegen nur halb so schwer, und Konzerne steigen nicht ein.
  - **Der Trainer redet mit:** Ein Angebot liegt dem Vorstand drei Wochen vor. Der Trainer kann zu- oder abraten, und ein Vorstand, der ihm vertraut, folgt meist. Einmal je Saison kann er den Vorstand bitten, einen Geldgeber zu suchen.
  - **Finanznot:** Reißt der Verein die Schuldengrenze zum zweiten Mal in einer Saison, übernimmt ein Geldgeber die Schulden, aber mit Auflagen:
    - keine Ablösen bis Saisonende; Verkaufserlöse tilgen Schulden statt ins Transferbudget zu fließen
    - ein Gehaltsdeckel bis zum Ende der nächsten Saison, der neue Verträge darüber blockiert
    - ein Verkaufsziel bis zum Ende des nächsten Transferfensters; wird es verfehlt, zieht der Verband drei Punkte ab (in der Tabelle mit * markiert)
  - **Die Welt:** In den beiden obersten Ligen jedes Landes werden auch KI-Vereine übernommen, in England am häufigsten und in Deutschland am seltensten. Ihre Trainer stehen danach unter mehr Druck.
  - Vorher gehörte jeder Verein sich selbst, und an der Schuldengrenze schoss der Vorstand wortlos nach, so oft es nötig war.
- **Ehemalige und Abschiedsspiel (`EhemaligeEngine`):** Wer mindestens 40 Spiele für den eigenen Verein gemacht hat, steht nach dem Karriereende auf der Liste der Ehemaligen. Das gilt auch, wenn er zuletzt woanders spielte. Die Karte „Ehemalige“ im Reiter Verein zeigt sie.
  - **Rückkehr in den Stab:** Vier Jahre lang bewirbt sich ein Ehemaliger in der Vorbereitung mit etwas Glück für den Trainerstab, je nach Position als Co-Trainer, Analyst, Athletiktrainer, Chefscout oder Nachwuchsleiter. In der Bewerberliste ist er markiert.
    - Er verlangt 15 % weniger als der Markt (Herzensverein).
    - Eine Legende bringt etwas mehr Güte mit und hebt bei der Rückkehr die Stimmung in der Kabine.
  - **Abschiedsspiel:** Hört eine Vereinslegende auf, kann der Verein ihr in dieser Saison ein Abschiedsspiel ansetzen. „Legende & Freunde“ spielen vor fast vollem Haus. Die Legende trifft, die Hälfte der Einnahmen geht an den Verein und der Rest an einen guten Zweck. Ergebnis und Zuschauer stehen in der Chronik.
  - Vorher verschwand ein Spieler mit dem Karriereende spurlos, auch der Kapitän mit 300 Spielen.
- **Nachrichten aus der Liga (`LigaNachrichtenEngine`):** Die Sportpresse berichtet über die eigene Liga.
  - **Saisonvorschau:** Zum Saisonstart nennt sie Favoriten, Geheimtipp (der Kader ist besser als sein Ruf), Abstiegskandidaten und den Platz, auf dem sie den eigenen Verein sieht. Sie rechnet mit drei Vierteln Kaderstärke und einem Viertel Ansehen, wie die Medienprognose.
  - **Rundschau nach jedem Spieltag:** Sie bringt die Spitze und den Abstand, das Ergebnis des Spieltags und Serien (fünf Siege oder fünf Spiele ohne Sieg). Dazu kommen die Torjäger sowie Transfers und Trainerwechsel seit der letzten Ausgabe.
  - **Gerüchteküche:** Im offenen Fenster soll ein Konkurrent an einem Spieler interessiert sein, der seinen Kader verstärken würde.
    - Das Gerücht ist nicht erfunden: Der Verein greift bei diesem Spieler eher zu, wenn er auf der Position sucht und es sich leisten kann.
    - Kommt der Wechsel zustande, meldet die Rundschau „das Gerücht stimmte“.
    - Die Ranglisten zeigen die Gerüchte der Saison mit Haken für die bestätigten.
- **Datenzentrale (`DatenzentraleEngine`, Reiter Ranglisten):** Was die Spiele der eigenen Liga verraten, in drei Ansichten:
  - **Liga:** Jeder Verein mit Toren und xG (für und gegen), Punkten und xPunkten, Schüssen je Spiel, Ballbesitz und Passquote. xPunkte sind die Punkte, die die Chancen im Schnitt eingebracht hätten (Poisson über das xG beider Seiten). Darüber steht, auf welchem Platz der eigene Verein nach den Chancen stünde und ob die Tabelle schmeichelt. Jede Spalte lässt sich sortieren.
  - **Form:** Die letzten zehn eigenen Spiele als xG-Balken für und gegen, mit dem Ergebnis darüber und einer Tabelle darunter.
  - **Spieler:** Einsätze, Minuten, Tore, Vorlagen, xG, Tore minus xG, Schüsse, Note und die Werte je 90 Minuten (ab 270 Minuten). Ein Tipp auf den Namen öffnet die Akte.
  - Die übrigen Partien der eigenen Liga behalten dafür sieben Kennzahlen (xG, Schüsse, Ballbesitz, Passquote), etwa 9 KB je Saison. Andere Ligen speichern weiter nur Ergebnisse. Schüsse tragen jetzt die ID des Schützen; vorher gingen bei doppelten Nachnamen im Kader Schüsse verloren.
- **Spielervergleich:** In der Akte vergleicht *Mit anderem Spieler vergleichen* zwei Spieler nebeneinander: Werte als Balken, Saison, Werte je 90 Minuten, Marktwert, Gehalt und Vertrag. Der bessere Wert steht fett.
  - Angeboten werden eigene und gut gescoutete Spieler derselben Position, jeder andere lässt sich per Name suchen.
  - Fremde Spieler zeigen ihre Werte nur so genau, wie der Scout sie kennt: bei wenig Wissen als Spanne.
- **Spielplan mit wechselndem Heimrecht:** Heim- und Auswärtsspiele wechseln sich nach dem Berger-Verfahren ab, höchstens drei gleiche in Folge. Vorher hatte ein Verein bis zu 17 Heim- oder Auswärtsspiele am Stück.

### 2. 📋 Aufstellung, Taktik & Teamchemie
- **Aufstellungsprüfung (`StateValidator`):** Verhindert Spielstart bei ungültiger Startelf (genau 11 Spieler, genau 1 TW, keine verletzten oder gesperrten Spieler).
- **Formationen:** `4-4-2`, `4-3-3`, `4-2-3-1`, `3-5-2`, `5-3-2`, `4-1-4-1`, `4-3-1-2`.
- **Freier Formations-Editor mit Raster:** Rasterüberlagerung (20 × 12 Zellen) plus Zonenbänder für Angriff, Mittelfeld, Abwehr und Torraum. Positionen lassen sich per Maus oder Finger frei verschieben – wahlweise am Raster ausgerichtet oder stufenlos.
- **Automatische Positions- und Formationserkennung:** Die Positionsbezeichnung folgt der Zone (wer in den Sechserraum gezogen wird, ist ein DM) und lässt sich pro Slot manuell überschreiben. Der Formationsname (`4-2-3-1`, `3-5-2`, …) wird live aus der Staffelung abgeleitet.
- **Eigene Formationen:** Beliebig viele eigene Aufstellungen benennen, speichern, zurücksetzen und löschen. Sie erscheinen im Formations-Dropdown und stehen allen Systemen zur Verfügung – Sofortsimulation, 2D-Live-Spiel und KI-Aufstellung.
- **Taktik mit und gegen den Ball (`TacticsEngine`):** Eine Taktik hat eine Formation mit Ball und eine gegen den Ball, für jeden Spieler eine Rolle je Phase und Anweisungen nach Phasen.
  - *Formen:* Mit Ball entsteht die Form aus den Rollen (Positionsspiel) oder ist fest vorgegeben (3-2-5, 2-3-5, 3-2-2-3, 3-1-6, 4-2-4, 2-3-2-3 oder jede Formation). Gegen den Ball fällt die Elf in jede wählbare Formation (4-4-2, 4-1-4-1, 5-4-1 …). Wer wohin rückt, rechnet eine Zuordnung mit kürzesten Wegen aus, bei der niemand die Seite wechselt und Außen außen bleiben.
  - *Rollen mit Ball:* u. a. mitspielender Torwart, spielmachender, breiter, überlappender und aufrückender Innenverteidiger, Schienenspieler, einrückender und invertierter Außenverteidiger, abkippender Sechser, tiefer Spielmacher, Halbraumläufer, Box-to-Box, freie Rolle, hängende Spitze, inverser und einrückender Flügel, falsche Neun, Zielspieler, Knipser, Kanalstürmer.
  - *Rollen gegen den Ball:* pressend, zurückarbeitend, absichernd, abschirmend, abkippend, seitlich absichernd, Konterspieler (zentral, außen, ausweichend), herausrückender Verteidiger, Libero-Torwart.
  - *Mannschaftsanweisungen als Kacheln*, getrennt nach *Mit Ball* und *Gegen den Ball*. Mit Ball: Mentalität, Passspiel, Tempo, Zeitspiel, nach Ballgewinn (kontern / Ball sichern), Breite, auf Standards spielen, kreative Freiheit, Aufbaustrategie, Aufbau über, Abstöße, Torwart spielt auf (Innen-/Außenverteidiger, Sechser, Flügel, Sturmspitze), Abwurf-Tempo, Läufe links und rechts (hinter-/unterlaufen), Dribblings, Vorwärtsspiel über, Ballannahme (in den Fuß / in den Lauf), Geduld, Distanzschüsse, Flanken und Flankenart (flach / hoch). Gegen den Ball: Pressinglinie, Abwehrlinie, Pressing auslösen, nach Ballverlust (Gegenpressing / zurückziehen), Zweikampfverhalten, gegnerische Flanken, Pressingfalle, kurze Abstöße verhindern, Verhalten der Abwehrlinie (fallen lassen / herausrücken), Abseitsfalle, Raumdeckung / mannorientiert / Manndeckung, Breite des Blocks. Eine Kachel zeigt Wert und Skala; was von der Grundeinstellung abweicht, ist markiert.
  - *Vorlagen:* Ausgewogen, Positionsspiel, Gegenpressing, Konter, Tiefer Block, Flügelspiel, Direktes Spiel, Mann gegen Mann. Die KI-Vereine spielen je nach Stärke unterschiedliche Stile.
  - *Wirkung:* Alles wirkt in der 2D-Simulation (Positionen, Deckung, Pressing, Umschalten), im Ballbesitzspiel (Passwahl, Dribblings, Torwartabspiel) und – bewusst maßvoll – in der Ergebnissimulation (Stärke, Angriffsmuster, Fouls, Ermüdung).
- **Aufstellungstabelle:** Eine Tabelle mit Positions-Chip, Sternen, Rollenkürzel samt Rollenwahl und Kondition je Spieler – umschaltbar zwischen *Mit Ball* und *Gegen den Ball*, synchron zur Taktiktafel.
- **Taktiktafel:** Ansichten *Kombiniert*, *Mit Ball*, *Gegen den Ball* und *Beide* (beide Formen übereinander mit dem Weg jedes Spielers), Rollenkürzel auf jeder Karte, Verbindungslinien, die zeigen, wer zusammenspielt und ob die Rollen zueinander passen (stark / passt / hakt), dazu ein Taktik-Check mit Hinweisen. Im Live-Coaching lassen sich Anweisungen und beide Formen während des Spiels ändern.
- **Spielerkarten auf der Taktiktafel:** Jeder Spieler steht als Karte wie im Vorbild auf dem Feld. Vorher war es ein Kreis mit einer Sternzahl.
  - Die Karte zeigt das Trikot in den Vereinsfarben mit Rückennummer (der Torwart in seiner eigenen Farbe) und darunter die Rolle als farbiges Band.
  - Darunter folgen fünf Sterne für die Stärke auf genau diesem Platz, der Nachname und ein Balken für die Kondition (grün, gelb, rot).
  - Am Trikot stehen die Kapitänsbinde, ein rotes Kreuz bei Verletzung, eine rote Karte bei Sperre und das Symbol der Signatur-Eigenschaft.
  - Wer fremd spielt, hat einen gelben, orangen oder roten Rahmen und darunter die Eignung mit Abzug.
  - Das Augen-Menü blendet Rollen, Sterne, Namen, Verbindungen, Eignung und Kondition einzeln aus. Am großen Bildschirm sind die Karten größer.
- **Menü beim Antippen:** Ein Tipp auf einen Spieler der Elf öffnet sein Menü, am Handy als Blatt von unten. Vorher markierte ein Tipp den Spieler nur zum Tauschen.
  - Oben stehen Nummer, Name, Nationalität, Alter, Stammposition, die Sterne auf diesem Platz mit der Eignung, eine Verletzung oder Sperre und die Signatur.
  - Darunter folgen Kondition, Form, Moral und Spielpraxis mit Balken.
  - Die Knöpfe: *Akte öffnen*, *Auswechseln*, *Platz tauschen* (danach einen zweiten Spieler auf dem Feld oder der Bank antippen) und *Verbindungen* (seine Linien hervorgehoben, unter der Tafel erklärt).
  - Die Rolle mit und gegen den Ball lässt sich im Menü wählen.
  - Kapitän, Elfmeter, Freistöße und Ecken werden mit einem Tipp vergeben oder wieder abgegeben.
  - *Auswechseln* listet, wer auf diesem Platz spielen kann: zuerst die Bank, dann der Kader, jeweils nach der Stärke dort, mit Kondition. Verletzte und Gesperrte stehen ausgegraut am Ende.
  - Ein freier Platz zeigt dieselbe Liste zum Besetzen.
- **Ersatzbank und übriger Kader:** Unter dem Feld steht die Bank als Karten, darunter der übrige Kader nach Mannschaftsteil. Vorher war beides eine Reihe gleich aussehender Kästchen mit Name und Sternzahl, Bank und Reserve nur am Wort „Bank“ oder „Res“ zu unterscheiden.
  - Eine Bankkarte zeigt Trikot mit Nummer, Position, Nachname, Sterne, Kondition mit Balken, Alter und eine Verletzung oder Sperre.
  - Über der Bank steht, wie voll sie ist (etwa 5 / 7). Freie Plätze sind als eigene Karte zu sehen, ein Tipp darauf listet die Spieler aus dem Kader zum Draufsetzen.
  - Der übrige Kader steht in Tor, Abwehr, Mittelfeld und Angriff. Jede Zeile nennt Nummer, Position, Name (mit U23, U19 oder Leihe), Sterne und Kondition, Verletzte und Gesperrte stehen ausgegraut am Ende ihrer Gruppe.
  - Ist ein Platz der Elf gewählt, zeigen Bank und Kader die Sterne genau dort, mit der Eignung und einem farbigen Rahmen. Ein Tipp wechselt dann sofort ein.
- **Menü für Bank und Kader:** Ein Tipp auf einen Spieler unter *Ersatzbank* oder *Übriger Kader* zeigt seine Werte, *Akte öffnen*, *Auf die Bank* oder *Von der Bank nehmen* und *Einwechseln für*.
  - *Einwechseln für* nennt die Plätze der Elf, die er spielen kann, mit seinen Sternen dort und denen des Spielers, der jetzt dort steht.
  - Ein Torwart wird nicht als Verteidiger angeboten.
  - Ist vorher ein Platz gewählt, wechselt ein Tipp wie bisher sofort.
- **Rückennummern (`GameState.rueckennummern`):** Jeder Spieler hat eine feste Nummer, einmalig im Kader und klassisch nach Position. Die Besten wählen zuerst: der Torwart die 1, die Innenverteidiger 4 und 5, der offensive Mittelfeldspieler die 10, der Mittelstürmer die 9.
  - Die Nummer bleibt, bis er den Verein wechselt. Ein Neuzugang bekommt eine freie.
  - *Nummer selbst wählen:* im Kader über das Feld vor dem Namen, in der Akte über die Nummer im Titel oder im Spielermenü über *Rückennummer*. Die Wahl zeigt alle Nummern von 1 bis 99, die vergebenen mit dem Namen ihres Trägers. Wer eine vergebene wählt, tauscht mit ihm. Selbst gewählte Nummern bleiben.
  - Im Livespiel tragen beide Mannschaften diese Nummern, auch ein Eingewechselter seine eigene. Vorher spielte jede Elf mit 1 bis 11.
  - Die Bankleiste nennt die Nummer und, unter 90 %, die Kondition.
- **Spezialrollen:** Kapitän, Elfmeterschütze, Freistoßschütze, Eckenschütze.
- **Teamchemie & Spielerzufriedenheit:** Individuelle Zufriedenheit je Spieler (Spielzeit, Vertrag, Teamleistung) und Einfluss auf Spielgeschehen.

### 2b. 🧭 Positionseignung & Nebenpositionen (`PositionEngine`)
- **Familiaritätsmodell:** Jeder Spieler hat eine Naturposition und – je nach Profil – Nebenpositionen. Wie gut er eine andere Position ausfüllt, ergibt sich aus dem Abstand der Mannschaftsteile und dem Seitenwechsel, verfeinert durch das versteckte Attribut *Anpassungsfähigkeit*.
- **Rund drei von vier Feldspielern** haben eine zweite Position, gut ein Viertel sogar eine dritte – immer passend zur Stammposition. Torhüter bleiben im Tor. Im Kader stehen die Nebenpositionen als gestrichelte Marker direkt neben der Hauptposition.
- **Positionen lassen sich erlernen:** Wer regelmäßig woanders aufläuft oder dort trainiert, wächst in die Position hinein (`gainPositionExperience`). Ein Einsatz über 90 Minuten bringt deutlich mehr als eine Trainingseinheit, und anpassungsfähige Spieler lernen schneller. Ist die Routine voll, gilt die Position dauerhaft als Nebenposition – die echte Naturposition bleibt ihr aber immer eine Nasenlänge voraus.
- **Sechs Eignungsstufen:** Stammposition, Sehr gut geeignet, Geeignet, Ungewohnt, Deplatziert, Fehlbesetzung – mit Farbcode direkt am Spielerknoten.
- **Spürbare Auswirkung:** Die effektive Stärke sinkt auf bis zu 55 % der Grundstärke. Ein Stürmer als Innenverteidiger verliert rund ein Drittel seiner Wirkung, ein Feldspieler im Tor ist die schlechteste aller Notlösungen.
- **Überall wirksam:** `MatchEngine.calculateEffectivePlayerSkill` und `calculateTeamPower` bewerten Spieler auf der Position, auf der sie tatsächlich aufgestellt sind. Auch Torschützen und Zweikampfgegner im Spielbericht richten sich nach der Einsatzposition.
- **Sichtbar im UI:** Die Trikotzahl auf dem Taktikfeld zeigt die effektive Bewertung, die Ersatzbank den Wert für den ausgewählten Slot, eine Warnbox listet alle Spieler außerhalb ihrer Position. Die Spielerdetails enthalten ein vollständiges Positionsprofil.
- **Positionsbewusste Automatik:** „Beste 11 automatisch aufstellen“ und die KI-Manager verteilen die Spieler über eine Greedy-Zuordnung auf die Slots, auf denen ihre effektive Bewertung am höchsten ist.
- **Formation nach Kader:** „Beste 11 automatisch aufstellen“ wählt vorher die Formation, die am besten zu den einsatzfähigen Spielern passt – jede Formation (auch eigene) wird mit dem Kader besetzt und nach der Stärke der Elf auf ihren Positionen bewertet. Verletzte und Gesperrte zählen nicht. Die bisherige Formation bleibt, wenn keine andere spürbar besser ist, und ungewöhnliche Systeme müssen ihren Vorteil deutlicher zeigen als gebräuchliche.

### 3. 🎮 2D-Live-Match-Engine & Sofort-Simulation
- **Testspiele zählen nicht:** Tore, Einsätze, Noten und Karten aus Freundschaftsspielen laufen weder in die Saisonstatistik noch in die Kartensperren. Fitness, Form und Spielschärfe wirken weiter.
  - Vorher hatte der beste Torjäger der 1. Liga nach sieben Spieltagen 24 Tore, neun davon aus vier Testspielen.
  - Mit der fünften Gelben aus einem Testspiel war ein Spieler im nächsten Pflichtspiel gesperrt.
- **Spielkultur der Ligen (`MATCH_TUNING.torKultur`):** Jede Liga spielt so torreich wie ihr Vorbild. Ein Faktor je Land und Spielklasse wirkt auf die Torwahrscheinlichkeit aus dem Spiel heraus, Elfmeter sind überall gleich schwer. Pokalspiele zählen nach der Liga der Heimmannschaft, der Europapokal nach keiner.
  - Gemessen über drei simulierte Saisons, Tore je Spiel, in Klammern die echten Werte 2024/25: 1. Liga 3,2 (3,13), Premier Division 2,9 (2,93), Première Division 3,0 (2,98), Primera División 2,6–2,8 (2,62), Prima Divisione 2,5–2,7 (2,54).
  - Die zweiten Ligen liegen darunter, Segunda und First Division mit 2,3 am deutlichsten.
- **Wer die Tore schießt (`MatchEngine.SCHUETZEN_ROLLE`):** Zum Abschluss kommen kann jeder Feldspieler. Wie oft, entscheiden Position, Angriffsart und Abschlussstärke. Nach Ecken köpfen die Innenverteidiger; der eingeteilte Eckenschütze steht an der Fahne und ist nie selbst der Abnehmer.
  - Vorher schossen nur Stürmer, Außen und Zehner: 70 % aller Tore fielen durch Mittelstürmer, kein einziges durch einen Verteidiger, und die besten Torjäger kamen auf 55 bis 71 Tore in einer Saison.
  - Gemessen über eine Saison der fünf ersten und zwei zweiten Ligen: Sturm 51 %, Flügel und Zehner 21 %, Mittelfeld 17 %, Abwehr 11 %. Die Tore je Spiel bleiben, wo sie waren.
  - Die Vorlage gibt, wer den Ball spielt: bei Flanken der Flügelspieler oder Außenverteidiger, bei Steilpässen meist ein Mittelfeldspieler (nach Position, Passspiel und Übersicht), bei Ecken der Schütze. Nicht jedes Tor hat eine: nach Flanke und Steilpass 86 %, nach Ecken 60 %, nach einem Solo 30 % (`MATCH_TUNING.vorlagenAnteil`).
  - Vorher waren 84 % der Ligatore vorbereitet, und die besten Vorlagengeber kamen auf 18 bis 26 Vorlagen. Jetzt sind es rund 70 % wie in den großen Ligen, die besten kommen auf 11 bis 18.
  - Stürmer kommen etwas seltener zum Abschluss als zuvor.
  - **Wer heraussticht, wird enger gedeckt (`MatchEngine.DOMINANZ`):** Ein Mittelstürmer neben schwachen Flügeln bekam über die Hälfte der Abschlüsse seiner Mannschaft und kam auf bis zu 55 Ligatore. Mit voller Mannschaft bekommt der gefährlichste Spieler über einem Anteil von 30 % nur noch 40 % des Überschusses. Gemessen mit gleichen Welten (drei Seeds, fünf erste Ligen): der beste Torjäger im Schnitt 30,5 statt 34,5 Tore, höchstens 40 statt 47. In Wirklichkeit sind es meist 25 bis 36. Die Tore je Spiel bleiben fast gleich (2,96 statt 3,01).
  - Vorher fielen überall gleich viele Tore, auch in Primera División mit 3,3.
- **Remis in der Schlussphase:** Steht es ab der 75. Minute unentschieden, will nur noch eine klar stärkere Mannschaft den Sieg. Der Außenseiter sichert den Punkt, und bei zwei ähnlich starken geht keiner mehr ins Risiko.
  - Vorher stürmten ab der 83. Minute immer beide.
  - Unentschieden waren seltener als im echten Fußball: 20–24 % statt 25–30 %. Jetzt sind es 23–25 % in den ersten Ligen und 25–30 % darunter.
- **Echtzeit-Regie (`LiveMatchDirector`):** Die Spieluhr läuft kontinuierlich statt in Minutensprüngen. Während eines Highlights läuft sie langsam, dazwischen holt sie auf – so passen Minute, Kommentar und Bild jederzeit zusammen.
- **Feld und Spielbericht Hand in Hand:** Jede Szene wird inszeniert (Anlauf zum Ausgangspunkt, Aktion, Auflösung). Aufbau-Kommentare erscheinen, während der Ball läuft; Torschuss, Parade und Fehlschuss werden exakt beim Eintreffen des Balls gemeldet.
- **Echtes Ballbesitzspiel (`MatchFlowEngine`):** Zwischen den Highlights wird nicht zufällig gepasst, sondern gespielt. Die Engine bewertet den Druck auf den Ballführenden, projiziert Gegner auf die Passwege, misst den Freiraum der Anspielstationen und wählt daraus die Option: kurzer Pass, Verlagerung, langer Ball, Dribbling oder Befreiungsschlag. Der Ausgang folgt den Attributen – Passgenauigkeit aus Passen, Übersicht und Technik gegen Druck und zugestellte Wege; Dribblings aus Dribbling und Tempo gegen die Defensivwerte des Gegenspielers.
- **Der Ball als Körper (`BallPhysik`, Stufe 1 der 2D-Simulation):** Im Livespiel stand der Ausgang eines Zuspiels bisher fest, bevor der Ball rollte: Eine Trefferquote wurde gewürfelt, danach schob die Regie den Ball in fester Zeit zum vorher bestimmten Ziel. Jetzt wird gespielt, wie im Vorbild:
  - **Abspiel:** Richtung, Tempo und Höhe mit einer Streuung aus Passen, Übersicht, Technik, Druck und schwachem Fuß. Ein flacher Ball rollt mit Reibung aus und kommt beim gut dosierten Pass mit gleichem Tempo an, ein langer fliegt im Bogen, setzt auf und rollt weiter.
  - **Wer zuerst dran ist, bekommt ihn:** Für jeden Spieler wird gerechnet, wann er die Bahn erreicht – Reaktion (aus Antizipation und Übersicht), Antritt und Tempo wie beim Laufen auf dem Feld, beim hohen Ball die Reichweite aus Körpergröße und Sprungkraft, der Torwart im Strafraum mit den Händen. Der Angespielte kommt dem Ball entgegen, ein Gegner im Passweg geht dazwischen, über ihn hinweg fliegt nur der hohe Ball. Was keiner erreicht, geht ins Aus.
  - **Annahme:** Ein scharfer, hoher oder bedrängter Ball springt weg, je nach Technik und Ballannahme.
  - **Flanken und Ecken:** Die Hereingabe streut mit ihrer Qualität. Sind Angreifer und Verteidiger fast gleichzeitig unter dem Ball, entscheidet das Kopfballduell, mit einem Vorteil für den, der früher da ist. Zu weit vom Tor für einen Abschluss nimmt der Angreifer den Ball an.
  - **Zu sehen ist genau diese Bahn:** Der Ball rollt aus oder fliegt im Bogen, und wer ihn bekommt, läuft zu dem Punkt, an dem er ihn erreicht. Gemessen steht der neue Ballführende bei Ankunft im Median 0,7 Einheiten vom Ball, nur in 2 % der Fälle weiter als drei (vorher 6 %, im schlimmsten Fall 48).
  - **Gemessen über 30 Spiele**, in Klammern das alte Modell: Tore 3,3 (3,6), Schüsse 19 (22), xG 2,4 (2,7), Passquote 77 % (79 %), Flanken und Ecken zusammen 15 (17), Ecken 6,3 (8,6), Fouls 23 (23), Favoritensiege 20 von 27 (18). Ein Spiel ohne Bild braucht gleich lang. Die Feineichung in Zielkorridoren folgt in Stufe 5.
  - Ein Schalter (`LiveMatchDirector.BALL_PHYSIK`, je Spiel `ballPhysik`) führt zum alten Modell zurück. Ein Spiel ohne Bild rechnet mit derselben Physik.
- **Entscheiden im Takt (Stufe 2):** Der Ballführende entschied bisher erst, wenn seine Annahme vorbei war, und stand bis dahin mit dem Ball. Jetzt schaut er etwa alle Viertelsekunde, was geht (`MatchFlowEngine.lageAmBall`):
  - **Der richtige Moment:** Ist ein Mitspieler vorn in den freien Raum gestartet und der Passweg offen, kommt der Steilpass sofort, je länger er den Ball hat, desto eher. Eine Torchance nutzt er gleich, und unter starkem Druck spielt er den sicheren Ball direkt. Dann kann ihn auch keiner mehr umreißen.
  - **Mit dem Ball laufen:** Ist vor ihm frei, nimmt er den Ball mit, statt zu stehen.
  - **Läufe in die Tiefe:** Hat er den Kopf oben, starten die Angreifer vor dem Ball, wer sich ohne Ball gut bewegt, eher. Der Steilpass geht dorthin, wo der Läufer sein wird, wenn der Ball ankommt.
  - **Verteidiger ahnen den Pass:** Wer das Spiel liest (Antizipation, Übersicht), schiebt sich bis zur Hälfte des Wegs vor den Angespielten in den Passweg. Mit der Ballphysik fängt er dann wirklich öfter ab.
  - **Gemessen über 30 Spiele** (Stufe 1 in Klammern): Je Spiel gut 80-mal im Moment gespielt, davon 11 Steilpässe, 3 Abschlüsse und knapp 70 direkte Bälle unter Druck. Zuspiele 222 (185), Tore 2,8 (3,3), Schüsse 20 (19), xG 2,3 (2,4), Passquote 76 % (77 %), Fouls 24 (23), Favoritensiege 20 von 27 (20).
- **Eine Engine für das eigene Spiel (Stufe 3):** Das eigene Spiel lief nur im 2D-Modell, wenn man es anpfiff, live oder als Sofort-Ergebnis. Lief der Tag ohne Anpfiff weiter (im Urlaub, im Pokal, im Testspiel), rechnete die Zeitleiste – dasselbe Spiel lief also anders, je nachdem, ob man zuschaute. Jetzt rechnet jedes eigene Spiel das 2D-Modell, ohne Bild und mit dem Co-Trainer an der Seitenlinie (`MatchEngine.spieleAus`, Schalter `EIGENES_SPIEL_2D`). Die Zeitleiste bleibt für die übrigen Spiele der Welt.
  - **Gegeneinander geeicht:** Der Messlauf `node eichung.js` spielt dieselben Paarungen der ersten deutschen und englischen Liga in beiden Richtungen mit beiden Engines. Mit `--schreiben` passt er die Zeitleiste an das 2D-Modell an (`MATCH_TUNING.eichung2D`: Torchancen, Zahl der Szenen, Paraden, Ecken, kleine Fouls ohne Karte – die Karten bleiben, wie sie gegen die echten Ligen geeicht sind; wer hart einsteigt, foult auch im Kleinen öfter). Mit `--merke` und `--nimm` lässt sich die Zeitleiste mehrmals nacheichen, ohne das 2D-Modell neu zu rechnen.
  - **Ein Test schlägt an**, wenn beide auseinanderlaufen (Tore, Schüsse, aufs Tor, Ecken, Fouls, Heimsiege, Favoritensiege) oder eine den Zielkorridor verlässt.
  - In den Saison- und Karrieretests rechnet das eigene Spiel weiter die Zeitleiste – im 2D-Modell kostete das je Spiel ein, zwei Sekunden.
  - **Flanken von der richtigen Seite:** In der Zeitleiste wurde die Flankenseite unabhängig vom Flankengeber gewürfelt. Ein Rechtsaußen lief im Livespiel quer über den Platz an die linke Fahne und kam oft nicht rechtzeitig an. Jetzt flankt ein Spieler von der Seite, auf der er spielt. Der Flankengeber steht so bei 84 % der Flanken am Ausgangspunkt statt bei 52 bis 62 %.
- **Eichung in Zielkorridoren (Stufe 5):** Mit Ballphysik und Takt verschoben sich die Zahlen; die Eichung holt sie zurück (`MatchFlowEngine.EICHUNG`, `MatchEngine.FM_HEIM_ANTEIL`, `MatchEngine.FM_ABSTAND`):
  - **Annahme:** Ein Ball springt seltener weg – vorher verstolperten die Spieler 25 Bälle je Spiel, die Passquote lag bei 76 %.
  - **Mehr Abschlüsse und Flanken:** Schuss- und Flankenlust leicht höher; vorher kamen 20 statt 25 Schüsse.
  - **Standards:** Bei Ecke und Freistoßflanke ist der Strafraum voll, der Torwart kommt später heraus, und die einstudierte Variante gibt den Angreifern einen Vorteil im Kopfballduell. Vorher fing der Torwart fast jede dritte Ecke, und nur jede sechste brachte einen Kopfball; jetzt sind es gut zwei Kopfbälle je Spiel nach Ecken. Kopfbälle nach Ecken und Freistoßflanken zählen als Standardtore.
  - **Fouls und Elfmeter:** etwas seltener im Zweikampf, im eigenen Strafraum deutlich vorsichtiger – vorher gab es 0,85 Elfmeter je Spiel, echt sind es um 0,3.
  - **Heimvorteil:** Nur noch 15 % des Vereinsheimvorteils gehen auf die Werte der Heimspieler; mit der Hälfte gewann die Heimelf gut die Hälfte ihrer Spiele.
  - **Abstand der Elfen:** Im 2D-Modell wirkt jeder Wert in jedem Duell, ein Kaderabstand summiert sich dort mehr als in der Zeitleiste. Der Abstand beider Mannschaften wird deshalb auf 80 % gestaucht (die Unterschiede innerhalb einer Elf bleiben). Vorher gewann der Favorit 72 von hundert Spielen, und nur 18 endeten unentschieden.
  - **Die Zeitleiste** zeigte 14 Schüsse aufs Tor bei 26 Schüssen – über die Hälfte, echt ist es ein Drittel. Sie hält jetzt weniger Bälle für Paraden.
  - **Gemessen über 152 Spiele im 2D-Modell und 2000 in der Zeitleiste:** Tore 3,13 (3,13), Schüsse 25,2 (25,1), aufs Tor 8,6 (8,6), Ecken 8,9 (8,8), Fouls 23,4 (23,3), Heimsiege 43 % (46 %), Remis 21 % (23 %), Favoritensiege 66 % (62 %). xG je Schuss liegt bei 0,10, die Passquote bei gut 80 %.
- **Ballverluste haben Folgen:** Fehlpässe werden abgefangen, liegen frei oder gehen ins Aus. Über ein komplettes Spiel entstehen rund 200 Spielaktionen: etwa vier von fünf Pässen kommen an, der lange Ball bleibt mit rund 15 % der Aktionen die Ausnahme, und aus dem Rest werden gut zehn Einwürfe und Abstöße.
- **Szenen entstehen aus dem Spiel:** Gehört die nächste Szene der anderen Mannschaft, erobert sie den Ball vorher sichtbar – ein abgefangener Pass oder ein gewonnener Zweikampf – statt ihn geschenkt zu bekommen. Gefoult wird am Ball: Der Foulende geht beim Gegenspieler in den Zweikampf, der ihm am nächsten steht. Eine Ecke entsteht aus einer abgewehrten Hereingabe über die Torlinie; danach schneidet die Übertragung zur Eckfahne, wo der Schütze bereitsteht, und der Torwart steht auf der Linie. Der Anstoß wird erst angepfiffen, wenn der Schütze am Ball steht; nach einem Tor schneidet die Übertragung zur Aufstellung.
- **2D-Ansicht:** Flache Punkte mit Rückennummer, darunter die Namen aller Spieler. Über das Augen-Menü am Feld lassen sich die Formationslinien der eigenen Elf und des Gegners einblenden – jede Reihe als Linie, dazu die Verbindung zur Reihe dahinter. So sieht man, ob die Kette steht, wie kompakt der Block ist und wer seine Position verlässt.
- **Standardsituationen:** Seitenaus führt zum Einwurf, Toraus zum Abstoß – jeweils mit Ausführendem, Schiedsrichterpfiff, kurzer Ruhephase und passender Aufstellung beider Mannschaften. Der Abstoß wird kurz aufgebaut oder lang geschlagen, je nach eingestelltem Passspiel.
- **Jede Unterbrechung hat ihre Fortsetzung:** Ein Foul im Ticker wird zum Freistoß vom Tatort – in Schussweite stellt sich eine Mauer aus drei Verteidigern neun Meter vor dem Ball. Eine Ecke wird an der Eckfahne getreten, während sich der Strafraum füllt. Ein Elfmeter kommt vom Punkt: Der Strafraum räumt sich, der Torwart geht auf die Linie, der Schütze legt sich den Ball zurecht. Ein Schuss neben das Tor ist ein Abstoß, eine Parade endet damit, dass der Torwart den Ball festhält oder ihn abklatschen lässt.
- **Abseits:** Die Abwehr hält ihre Linie, und ein Steilpass hinter den vorletzten Gegenspieler wird abgepfiffen – rund vier Mal pro Spiel, mit Fahne, Einblendung und Freistoß. Abseits entsteht nur im Aufbauspiel; Ereignisse aus der Timeline laufen immer durch, damit Anzeige und Bericht deckungsgleich bleiben.
- **Der Torwart hechtet:** Bei einem Schuss geht er in die Ecke, in die geschossen wird, und streckt sich dabei sichtbar.
- **Anstoß mit Zeremonie:** Zum Spielbeginn, nach jedem Tor und zur zweiten Halbzeit stellen sich erst beide Mannschaften auf – jede in ihrer eigenen Hälfte, der Mittelkreis bleibt der anstoßenden Mannschaft vorbehalten. Der Schiedsrichter geht zum Anstoßpunkt und pfeift an, und erst dann rollt der Ball. Die Spieluhr kriecht währenddessen, damit die Zeremonie keine Spielminuten frisst.
- **Der Torwart steht, wo ein Torwart steht:** Kommt der Gegner, geht er auf die Linie zwischen Ball und Tormitte und bleibt zwischen den Pfosten. Liegt der Ball zentral vor dem Strafraum, macht er ein, zwei Schritte heraus. Ist das Spiel weit weg, rückt er an den Fünfer heraus, um Bälle hinter die Kette abzulaufen. Vorher war es umgekehrt: Je näher der Gegner kam, desto weiter verließ er die Linie (im Mittel gut fünf Einheiten), und seitlich lief er weit über den Pfosten hinaus.
- **Karten am Spieler:** Der Schiedsrichter wird nicht gezeichnet – sein Punkt lenkte nur ab. Gelbe und rote Karten erscheinen direkt neben dem verwarnten Spieler.
- **Absicht statt Zufall:** Der Ballbesitz hat eine Phase. Im eigenen Drittel wird gesichert zirkuliert – quer, zurück, notfalls über den Torwart –, im Mittelfeld gesucht, im letzten Drittel der Abschluss vorbereitet. Eine Anzeige am Spielfeldrand nennt Phase, Mannschaft und Zahl der Stationen, sodass ein Angriff als Angriff erkennbar ist.
- **Spieltempo:** Drei Stufen – das ganze Spiel dauert gut elf (Langsam), viereinhalb (Normal) oder zwei echte Minuten (Schnell). Höhepunkte, Standards und der Anstoß bremsen die Uhr ohnehin ab, die entscheidenden Szenen laufen also in Ruhe. Die gewählte Stufe bleibt fürs nächste Spiel gemerkt und lässt sich in den Einstellungen vorgeben.
- **Höhepunkte wie im Vorbild:** Standard ist die Ansicht *Höhepunkte*. Ruhige Phasen rechnet dieselbe Simulation ohne Bild durch, gezeigt werden die Szenen: ein Angriff tief in der gegnerischen Hälfte, Ecken, Elfmeter, Freistöße im letzten Drittel, Tore, Karten. Ruhig sind der Aufbau bis ein Stück über die Mittellinie, Anstoß, Einwurf, Abstoß und Freistöße weit vor dem Tor. Eine Szene läuft eine Sekunde nach, dann wird gespult. Oben am Feld steht dabei *Zeitraffer bis zur nächsten Szene*. Ist eine ruhige Phase in einem Bild durchgerechnet, zeigt die Einblendung knapp eine Sekunde lang den Sprung, etwa *Zeitraffer · 23' bis 25'*. Ticker, Statistik und Uhr laufen mit. Ein Knopf neben dem Tempo schaltet auf *Ganzes Spiel*.
  - **Ruhige Schnitte (`LiveMatch.spuleRuhigePhase`):** Gemessen sprang das Bild auf Normal alle anderthalb Sekunden, in den Schlüsselszenen fast jede Sekunde. Der Nachlauf zählte Sekunden der Spieluhr, die dreiundzwanzigmal so schnell läuft wie das Bild, jeder Ball knapp über die Mittellinie war eine Szene, und ein Fünftel der Schnitte sprang keine zehn Spielsekunden weit. Das sah aus wie Ruckeln.
  - Jetzt zählt die Bildschirmzeit: Eine Szene steht mindestens drei Sekunden (Schlüsselszenen zwei), dann eine Sekunde Nachlauf. Ein Schnitt überspringt mindestens 20 Spielsekunden, nie aber Torgefahr, Ecke oder Elfmeter.
  - Jeder Schnitt blendet kurz ab wie der zum Anstoß, auch Anfang und Ende der Torwiederholung, und die Kamera springt mit, statt quer über den Platz zu fahren.
- **Namen ohne Überlagerung:** Im Getümmel lagen die Namen übereinander und waren nicht zu lesen. Jetzt bekommt jeder einen freien Platz, zuerst das Schild des Ballführenden, dann nach Nähe zum Ball, unter dem Punkt oder darüber. Findet ein Name keinen Platz, bleibt er weg. Der Platz vom letzten Bild wird bevorzugt, damit nichts hin und her springt. Ohne Namen stehen höchstens vier Schilder am Ball, ebenso ohne Überlagerung.
  - Gemessen auf Normal über drei Partien: Höhepunkte mit 12 bis 14 Schnitten je Bildminute statt 26 bis 28, eine Szene steht im Mittel knapp vier Sekunden statt anderthalb, ein Spiel dauert rund 70 % des ganzen statt 65 %. Schlüsselszenen mit gut 20 Schnitten je Minute statt 42 bis 60. Im Browser springt in einer Minute Höhepunkte kein Spieler mehr ohne Blende, vorher 42-mal.
- **Darstellung (Stufe 4 der 2D-Simulation):**
  - **Drei Ansichten wie im Vorbild:** *Schlüsselszenen*, *Höhepunkte* und *Ganzes Spiel*, durchgeschaltet mit dem Knopf neben dem Tempo und vorzugeben in den Einstellungen. Die Schlüsselszenen zeigen nur, was nach Tor riecht: Der Regisseur schätzt die Torgefahr aus Abstand und Winkel zum Tor und aus den Verteidigern, die noch zwischen Ball und Tor stehen (`LiveMatchDirector.torGefahr`). Dazu kommen Ecken, Elfmeter, Freistöße bis gut 30 Meter vor dem Tor, Tore und Karten. Gemessen auf Normal dauert ein Spiel so gut eine Minute.
  - **Die Kamera geht mit der Gefahr:** Wird es gefährlich, fährt sie in den Strafraum, je größer die Gefahr, desto näher.
  - **Torwiederholung auch in 2D:** Ein Puffer hält die Positionen von Ball und Spielern der letzten zwölf Spielsekunden, gezählt in Spielzeit: So fasst er gleich viel Spiel, ob auf Langsam oder Schnell. Er schreibt auch mit, was der Zeitraffer ohne Bild durchrechnet, und zeigt so den ganzen Angriff, auch wenn nur sein Ende zu sehen war. Nach dem ersten Jubel laufen die gut fünf Sekunden vor dem Tor noch einmal in Zeitlupe ab. Die Simulation steht derweil, und bis dahin wird nicht gespult. Ein Tipp aufs Feld überspringt die Wiederholung, im Augen-Menü lässt sie sich abschalten.
  - **Passwege und Laufwege**, im Augen-Menü einblendbar: Die letzten Zuspiele stehen als Linien in der Farbe der Mannschaft und verblassen nach drei Sekunden. Gestrichelte Pfeile zeigen, wohin jeder Spieler gerade läuft.
- **Livespiel in Kacheln wie im Vorbild** (ab 1280 Pixeln Breite und 700 Höhe): Das Feld liegt in der Mitte, ringsum Kacheln (`js/ui/uiLiveKacheln.js`). Gezeichnet wird eine Kachel nur, wenn sich ihr Inhalt geändert hat; ist sie nicht zu sehen, gar nicht.
  - **Links und rechts:** die Aufstellung beider Mannschaften als kleines Feld, jeder Spieler mit Trikot, Note, Position und Name an seinem Platz in der Formation, dazu Tore, Vorlagen, Karten und Wechsel.
  - **Unter der eigenen Elf die Bank:** Wechsel übrig, angemeldete Wechsel und der Vorschlag des Co-Trainers bei Müdigkeit, Verletzung, schwacher Note oder Gelb-Gefahr, mit dem passenden Ersatz von der Bank. Ein Tipp meldet den Wechsel an, ein zweiter Knopf verwirft den Vorschlag.
  - **Oben:** Statistik (Schüsse, aufs Tor, xG, Ecken, Ballbesitz) und Ereignisse mit dem Neuesten oben.
  - **Rechts unten:** die anderen Plätze des Spieltags.
  - **Kopfleiste:** die Mentalität der eigenen Elf zum Umstellen, ohne das Spiel anzuhalten.
  - **Leiste unten:** jede Position der eigenen Elf mit Kondition als Herz und Note.
  - **Schmalere Bildschirme** behalten Feld und Seitenleiste mit Reitern.
- **Mannschaftsblöcke statt Punktehaufen:** Jede Mannschaft verschiebt als Einheit mit dem Ball – ein Fenster von der Kette bis zur Spitze, in dem jeder so tief steht, wie ihn seine Formation vorsieht. Greift eine Elf im letzten Drittel an, steht ihre Kette an der Mittellinie und das Mittelfeld direkt hinter dem Ball; ohne Ball steht sie kürzer und tiefer, die Kette immer hinter dem Ball. Abwehrhöhe und Mentalität verschieben das Fenster, nach vorn rückt die Elf geordnet nach, nach hinten fällt sie zügig zurück. Außenverteidiger hinterlaufen auf ihrer Seite, Stürmer lauern auf der Abseitslinie und starten in die Tiefe, Mittelfeld und Angriff stellen beim Verteidigen Gegenspieler zu.
- **Positionsspiel mit Ball:** Mit Ball baut jede Elf aus ihrer Formation eine eigene Form mit Ball, wie bei Guardiolas City (3-2-5), Napoli oder Juventus. Auf jeder Seite hält genau ein Spieler die Seitenlinie: im Aufbau der Flügelspieler, im letzten Drittel auf der Ballseite der hinterlaufende Außenverteidiger, während der Flügelspieler in den Halbraum einrückt. Achter und Zehner besetzen die Halbräume, die Innenverteidiger gehen im Aufbau weit auseinander, der ballferne Außenverteidiger bildet mit ihnen die Dreierkette. Wer mit Ball frei steht, trägt ihn in den Raum vor sich (Andribbeln) – auch ein Innenverteidiger, wenn kein Gegner in der Nähe ist. Ohne Gegner vor sich rückt ein Verteidiger auf und bietet sich an.
- **Pressing mit Linie:** Gepresst wird ab der Pressinglinie der eigenen Taktik: hohes Pressing überall, Mittelfeldpressing ab dem ersten Drittel des Gegners, tiefer Block ab der Mittellinie. Davor stellt der nächste Spieler nur den Passweg zur Mitte zu. Direkt nach einem Ballverlust wird überall gegengepresst.
- **Laufwege im Positionsraum statt Schablone:** Die Formation ist ein Rahmen, kein Gitter. Jede Position hat einen eigenen Raum (ein Innenverteidiger weicht kaum ab, ein Achter pendelt über die halbe Breite), in dem sich jeder Spieler selbst seinen Weg sucht – mit Ball freilaufen, entgegenkommen, in die Tiefe oder in den Strafraum gehen, die Breite halten; ohne Ball Passwege zustellen und zur Ballseite schieben. Bewertet werden freier Raum, offener Passweg, Abstand zu den Mitspielern und die Abseitslinie. Passspiel und Mentalität wirken mit: Direkt gespielt wird mehr in die Tiefe gelaufen, kurz gespielt mehr entgegengekommen.
- **Laufen wie Menschen:** Spieler treten an, erreichen ihr Tempo und bremsen vor dem Ziel ab, statt in einem Bild von null auf voll zu springen – dadurch laufen sie Bögen. Wer weit vom Ball weg ist, rückt in Schüben nach und geht; wer weit hinter seinem Platz ist, sprintet. Jeder nimmt den Ball mit eigener Verzögerung wahr (Übersicht verkürzt sie), und nach einem Ballverlust schaltet die Elf fließend um, statt in einem Bild die Form zu wechseln. Stehende Spieler drehen sich zum Ball.
- **Taktik ist sichtbar:** Direktes Passspiel erzeugt messbar längere Pässe als Kurzpassspiel, der Angriffsfokus verschiebt das Spiel auf die gewählte Seite, und eine sehr offensive Mannschaft spielt 80 % ihrer Pässe nach vorne (bei niedrigerer Erfolgsquote) gegenüber 40 % bei sehr defensiver Ausrichtung.
- **Kameraführung wie im Fernsehen:** Die Kamera folgt dem Ball mit Vorhalt und zoomt nach Situation – Totale im Spielaufbau, näher bei Highlights, eng bei Standardsituationen. Ein Übersichtsradar blendet sich ein, sobald herangezoomt wird.
- **Spieler mit Physis:** Blickrichtung, Sprintspur, abgesetzte Torwarttrikots und eine Kondition, die über die Spielminuten sinkt (unabhängig von der gewählten Abspielgeschwindigkeit) und das Tempo drückt. Eingewechselte Spieler kommen frisch aufs Feld.
- **Einblendungen:** Anpfiff, Halbzeit, Nachspielzeit, Abpfiff, Karten, Auswechslungen, Verletzungen sowie eine Torsequenz mit Schütze und Vorlagengeber.
- **Stadionatmosphäre:** Ein Publikumsteppich, dessen Pegel sich nach der Spielsituation richtet, Schiedsrichterpfiff bei Fouls und Standards, Raunen bei vergebenen Chancen.
- **Flüssige Darstellung mit 60 Bildern pro Sekunde:** Delta-Zeit-basierte Bewegung, Mindestflugzeit für den Ball (keine Sprünge), Ballflughöhe mit wanderndem Schatten und Bewegungsschweif.
- **Optimiertes Canvas-Rendering:** DPR-korrekte Auflösung, einmalig vorgerenderter Rasen, Spielfeldmaße in echten Metern, zwischengespeicherte Textbreiten und ein inkrementell aktualisierter Ticker.
- **Live-Ticker auf Deutsch:** Farbcodierter Spielbericht für Tore, Karten, Auswechslungen und Glanzparaden.
- **Spielbericht wie im Vorbild (`uiSpielbericht.js`):** Nach dem Abpfiff steht oben die Paarung mit beiden Wappen, dem Ergebnis und dem Halbzeitstand, unter jedem Verein seine Torschützen mit Minute (Elfmeter mit *E*). Darüber stehen Wettbewerb und Spieltag, darunter Stadion, Zuschauer, Schiedsrichter und Wetter. Nach einem Elfmeterschießen steht dessen Ergebnis unter dem Spielstand. Darunter drei Reiter:
  - *Übersicht*: der Spielverlauf als Zeitleiste über die ganze Partie (Heim über, Gast unter der Linie) und als Liste. In der Liste stehen Heim links, Gast rechts, die Minute in der Mitte, Tore mit dem Stand danach, Gelb-Rot mit eigenem Zeichen, Trenner für Anpfiff, Halbzeit und Abpfiff. Daneben der Spieler des Spiels als eigene Karte mit Note, Toren, Vorlagen und Minuten. Dazu kommt die Statistik als geteilte Balken in den Vereinsfarben und die Ausfälle. Der Spieler des Spiels steht nicht mehr zusätzlich im Text, die englische Überschrift ist weg.
  - *Spieler*: die Noten je Mannschaft, die Startelf nach Position und dann die Eingewechselten. Bei jedem Spieler stehen Tore, Vorlagen, Karten, Ein- und Auswechslung mit Minute und ein Stern für den Spieler des Spiels, oben der Schnitt der Startelf.
  - *Analyse*: Schusskarte, Chancenverlauf, Heatmaps und Passnetze wie bisher.
  - Am Handy steht der Spielverlauf einspaltig, mit einem Farbstrich für die Mannschaft. Der Knopf heißt dort nur *Weiter*.
  - Der Knopf *Pressekonferenz* hieß nach der ersten Pressekonferenz auch beim nächsten Spiel noch „Pressekonferenz beendet“, das ist behoben.
- **Spielanalyse im Spielbericht:** Eine Schusskarte zeigt jeden Abschluss beider Mannschaften auf dem Feld – die Größe nach Chancenqualität (xG), die Form nach dem Ausgang (Tor, gehalten, vorbei, geblockt), dazu Minute und Schütze. Daneben steht der Verlauf der Chancenqualität über neunzig Minuten mit den Toren. Gespeichert wird das nur für die eigenen Spiele.
- **Echtzeit-Statistiken:** Ballbesitz %, Schüsse, Schüsse aufs Tor, Fouls, Ecken und Expected Goals (xG).
- **In-Game Coaching:** Live-Taktikanpassungen und bis zu 5 Auswechslungen während des Spiels.

- **Bild und Ticker erzählen dasselbe:** Wer im Ticker genannt wird, hat auf dem Feld auch den Ball, und zwar an der Stelle, von der die Rede ist – die Szene beginnt erst, wenn er dort angekommen ist. Jede Angriffsart hat ihre eigene Geometrie: Die Flanke kommt vom Flügel, der Steilpass aus der Zentrale, die Ecke von der Fahne. Und seit dem Seitenwechsel fliegen die Schüsse auch nach der Pause aufs richtige Tor.

> **3D-Ansicht:** Im Livespiel lässt sich über das Auge oben rechts im Feld die **3D-Ansicht** einschalten. Sie zeichnet dieselbe Simulation – Laufwege, Ballflug mit Höhe, Wechsel – in einem Stadion: Rasen mit Mähstreifen und allen Linien in echten Maßen (105 × 68 m), Tore mit Netz, Tribünen mit Publikum in den Vereinsfarben, Flutlicht. Die Spieler sind stilisierte Figuren in ihren Trikotfarben, die im Takt ihrer Geschwindigkeit laufen und dorthin schauen, wohin sie laufen oder wo der Ball ist. Drei Kameras: **TV** (Haupttribüne, schwenkt mit dem Ball), **Taktik** (hoch über dem Feld) und **Nah** (dicht am Ball). Gezeichnet wird mit three.js (r159, MIT-Lizenz, in `js/vendor/`), offline und auch in der Einzeldatei. Ohne WebGL schaltet sich die Ansicht mit einem Hinweis ab, es geht in 2D weiter.
>
> - **Bewegungen:** Was ein Spieler gerade tut, meldet die Regie (`LiveMatchDirector.meldeAktion`): Pass, Schuss, Flanke, Kopfball, Zweikampf, Parade, Tor. Die Ansicht spielt dazu einen Bewegungsablauf aus Gelenkwinkeln: ausholen und durchschwingen mit dem starken Fuß, abspringen zum Kopfball, Grätsche oder Ausfallschritt, die Parade zur Seite des Balls kurz vor seiner Ankunft, Jubel des Schützen und der Mitspieler in der Nähe (manchmal auf den Knien). Die Meldungen sind reine Buchführung ohne Zufall – ein Spiel geht mit und ohne sie gleich aus, das prüft ein Test.
> - **Torwiederholung:** Nach dem ersten Jubel zeigt die Ansicht die letzten gut fünf Sekunden vor dem Tor noch einmal in Zeitlupe, aus einer Kamera hinter dem Tor. Die Simulation steht derweil, ein Tipp aufs Feld überspringt die Wiederholung; im Ansichtsmenü lässt sie sich abschalten.
> - **Qualität:** Niedrig, Mittel, Hoch oder **Automatisch** im Ansichtsmenü. Niedrig zeichnet mit weniger Bildpunkten, ohne Kantenglättung, mit weniger Grashalmen und gröberen Figuren. Automatisch beginnt mit Mittel und schaltet herunter, wenn die Ansicht nach einer Anlaufsekunde drei Sekunden lang im Mittel unter zwanzig Bildern je Sekunde bleibt (gemessen mit der eigenen Uhr, nicht mit der gekappten Bildzeit des Livespiels).
> - **Erst bei Bedarf:** three.js (rund 670 KB) lädt erst, wenn jemand die 3D-Ansicht einschaltet; bis dahin zeichnet das 2D-Feld. Der Service Worker hält die Datei trotzdem offline bereit, und in der Einzeldatei liegt sie als nicht ausgeführter Vorrat (`<script type="text/plain" id="vorrat-three">`), den das Modul beim Einschalten ausführt. Beim Start der App liest und übersetzt der Browser so rund 670 KB Skript weniger.
>
> Ehrlich gesagt: Echte, animierte Spielermodelle wie in großen Produktionen bräuchten fertige 3D-Modelle mit aufgezeichneten Bewegungen – die Figuren und ihre Abläufe hier sind bewusst schlicht.

> **Absicherung beim Dribbling:** Wer den ersten Verteidiger stehen lässt, läuft in einem kompakten Block gleich in den zweiten. Bisher zählte für ein Dribbling nur der nächste Gegner; jetzt senkt jeder weitere Verteidiger nahe am Zielpunkt die Erfolgschance (ein Helfer ist im Mittelfeld normal und zählt nicht). Gemessen (je 24 Spiele gegen einen hoch pressenden Favoriten): Die Chancen des Favoriten sinken gegen den tiefen Block von 2,27 auf 2,08 xG und gegen die Grundeinstellung von 1,71 auf 1,49 xG; im ausgeglichenen Duell ändern sich Schüsse und xG insgesamt nicht. Ein Versuch, den Block im Mittelfeld zügiger nach vorn spielen zu lassen, brachte messbar nichts und ist wieder draußen.

> **Geduld am Ball – Qualität zeigt sich im Ballbesitz:** Bisher spielten München und Augsburg denselben Fußball: gemessen rund 52 % Ballbesitz für München bei fast gleicher Passquote. Jetzt hat jeder Spieler eine *Ruhe am Ball* (Technik, Passspiel, Dribbling, Nerven), und der Vorsprung einer Elf darin bestimmt ihre *Geduld* (`MatchFlowEngine.geduld`, einmal je Spielminute gerechnet, Wechsel zählen mit). Die überlegene Mannschaft lässt den Ball im Aufbau und im Mittelfeld laufen – der sichere Ball quer oder zurück zählt mehr, mit jeder Station rückt sie langsamer auf –, die unterlegene sucht schneller den Weg nach vorn. Vor dem gegnerischen Tor gilt das nicht, dort zählt der Abschluss; gleich gute Mannschaften spielen wie bisher.
> Gemessen (je 20 Spiele, Grundeinstellung): München gegen Augsburg 61 % Ballbesitz statt 52 %, auswärts 59 % statt 54 %; Dortmund gegen Leverkusen weiter um 50 %. Der tiefe Block hält gegen Münchens Gegenpressing 46 % statt 53 % – besser, aber noch nicht die üblichen 30 bis 40 %; das bleibt offen.
> Und das eigene Spiel bleibt so stark wie die Spiele der anderen (240 gleiche Paarungen, mit beiden Änderungen unten): Die Tordifferenz des Favoriten liegt live bei +1,15, im statistischen Modell bei +0,96, er gewinnt 66 % gegen 61 %; bei mehr als fünf Punkten Stärkeunterschied hat er live 56,3 % Ballbesitz, statistisch 57,1 % (live vorher 52,6 %).

> **Mannschaftsstärke im statistischen Modell – zwei Fehler, die die Ligen zufällig machten:** Der Favorit wurde nur in 39 % der Ligen Meister, und nur 58 % der Meister kamen aus den drei stärksten Kadern. Zwei Ursachen:
> - *Formationsplätze im falschen Mannschaftsteil:* Die Formationen benennen Halbpositionen fein (ZDM, LZM, RZM, ZOM, RAV …). Die Stärkeberechnung kannte nur die Grundpositionen und zählte jeden anderen Platz zum Sturm. In einer 4-3-3 oder 4-2-3-1 hatte eine Mannschaft rechnerisch kein Mittelfeld (Ersatzwert 65), ihre Sechser stürmten. Der AC Mailand, dritter nach Kaderstärke, wurde so im Schnitt Siebter. Der Livespiel-Regisseur übersetzte die Plätze längst, die Stärkeberechnung jetzt auch (`MatchEngine.grundPosition`).
> - *Taktik schuf Stärke:* Jede Anweisung, die das Mittelfeld stärkte, war ein Gewinn – es zählt in der Gesamtstärke 35 %, die Abwehr, die den Preis zahlte, nur 20 %. Gegenpressing und Positionsspiel machten eine Mannschaft so um 5 bis 6 % stärker, fast halb so viel, wie zwischen dem besten und dem schwächsten Erstligakader liegt; Dortmund mit Gegenpressing war rechnerisch stärker als München. Jetzt verschiebt die Taktik Stärke zwischen Angriff, Mittelfeld und Abwehr, ohne die Gesamtstärke zu ändern.
> Weil die Kader ohne den Taktik-Bonus der Spitzenklubs rechnerisch enger beieinanderliegen, entscheidet der Kaderunterschied jetzt etwas stärker, wer eine Szene hat (`MATCH_TUNING.sceneShare` 1,35 statt 1,15) – das gibt dem Favoriten seine alte Tordifferenz je Spiel zurück (+0,96 statt +0,63).
> Gemessen über drei Saisons in allen zwölf Ligen: Der Favorit wird in 50 % statt 39 % der Ligen Meister, der Meister kommt in 75 % statt 58 % aus den drei stärksten Kadern, sein Startrang liegt im Schnitt bei 2,6 statt 3,7. In der Prima Divisione landen die fünf stärksten Kader im Schnitt auf den Plätzen 1,7 bis 4,7 statt 1,7 bis 8,3. Die Kalibrierung (500 Spiele: Tore, Schüsse, Karten, Elfmeter) bleibt grün.

> **Eine Simulation für das eigene Spiel:** Das Sofort-Ergebnis des eigenen Spiels – aus dem Kalender oder über den Knopf mitten im Livespiel – ist kein anderes Spiel mehr. Dieselbe Livespiel-Simulation läuft einfach ohne Bild weiter, in kleinen Häppchen je Bildschirmbild, auf der schnellsten Abspielstufe (die ein Vorlauf ist, kein anderes Spiel). Der Co-Trainer übernimmt Wechsel und Umstellungen, eine Einblendung zeigt Spielstand und Minute, nach zwei bis drei Sekunden steht der Spielbericht – mit Heatmap und Passnetz. Bisher wechselte das Sofort-Ergebnis ab dem Klick auf das statistische Modell. Die Spiele der übrigen Vereine rechnet weiter das statistische Modell, das auf die Livespiel-Simulation abgestimmt ist; für Hunderte Partien je Spieltag wäre die volle Simulation zu langsam.

> **Live und sofort berechnet:** Das statistische Modell erzeugt alle Ereignisse vorab als Timeline. Im Livespiel gibt sie seit dem Entscheidungsmodus nur noch den Rahmen vor (Wechsel, Verletzungen, Halbzeit, Abpfiff) – alles andere entsteht auf dem Feld (siehe unten). Jedes Ereignis wird dabei in dieselbe Timeline geschrieben, aus der auch der Spielbericht rechnet: Live-Anzeige und Bericht zeigen Feld für Feld dieselben Zahlen, ein Test prüft das.

### 3a. 🧠 Entscheidungsmodus: Jeder Spieler entscheidet nach seinen Werten
Im Livespiel wird nichts mehr vorab gewürfelt. Wie in den großen Managerspielen entscheidet der Ballführende in jeder Situation selbst – und seine Werte bestimmen, was er wählt und ob es gelingt.

- **Entscheiden:** Pass, Verlagerung, Steilpass, Dribbling, Flanke oder Abschluss werden gegeneinander abgewogen: Druck der Gegner, zugestellte Passwege, freie Mitspieler, Abstand und Winkel zum Tor. Ein Stürmer mit starkem Abschluss zieht aus 20 Metern ab, ein Techniker sucht lieber den Mitspieler.
- **Ausführen:** Ob der Pass ankommt, hängt an Passen, Übersicht und Technik gegen Druck; ob das Dribbling klappt, an Dribbling und Tempo gegen Zweikampf und Stellungsspiel. Jeder Abschluss bekommt eine Chancenqualität (xG) aus Entfernung, Winkel, Druck und Verteidigern im Schussweg. Verwandelt wird nach dem Duell Schütze gegen Torwart. Kopfbälle nach Flanken entscheiden Sprungkraft und Physis.
- **Alles entsteht aus dem Spiel:** Geblockte Schüsse und abgewehrte Flanken werden zur Ecke, Fouls im Zweikampf zum Freistoß (direkt aufs Tor oder als Flanke), Fouls im Strafraum zum Elfmeter. Karten folgen der Situation: Taktische Fouls beim Konter gibt es gelb, die Notbremse als letzter Mann rot.
- **Werte zählen wirklich:** Auf dem Feld wirken die Werte so, wie der Spieler gerade drauf ist – Fitness, Moral, Form und die Eignung für seine Position. Ein Innenverteidiger im Sturm ist ein schlechterer Stürmer. Ab der 60. Minute zieht die Müdigkeit die Werte nach unten.
- **Gleiche Bedingungen für alle Vereine:** Auf Autopilot landete der eigene Verein regelmäßig 7 bis 9 Plätze über seinem Kaderrang (Bochum mit dem 13.-stärksten Kader wurde Vierter). Gemessen vor dem Anpfiff hatte die eigene Elf Fitness 90 und Moral 90 bis 99, die KI-Elfen Fitness 64 und Moral um 68 – zusammen rund 10 % Spielstärke, mehr als der Abstand zwischen dem besten und dem schwächsten Erstligakader. Grund: Die KI bekam je Spieltag pauschal 7 bis 12 Fitnesspunkte zurück, ein Spiel kostet aber 13 bis 17. Und die eigene Moral stieg nach jedem Sieg um 4 bis 8 Punkte, sank aber über 84 nur um 0,5 am Tag. Jetzt erholen sich KI-Spieler wie die eigenen: Wer müder ist, holt mehr auf, und der Trainingsplatz gibt den Ausschlag. Die Moral pendelt sich bei allen Vereinen auf dasselbe Ziel aus der Form der letzten fünf Spiele ein. Siege, Noten, Bankfrust und Gespräche wirken weiter, aber als Ausschlag um dieses Ziel. Die Plätze folgen nun dem Kader – mit dem Zufall eines Fußballjahres.
- **Runde Beträge in Verhandlungen:** Forderungen, Gegenforderungen, Handgeld und Beraterhonorar werden auf ihre Größenordnung gerundet (95.000 € statt 94.702 €). Das Beraterhonorar beträgt nicht mehr pauschal mindestens 1.000 € – in der Landesliga war das ein Vielfaches dessen, was die Formel ergibt.
- **Gemessene Statistik:** Ballbesitz ist die Zeit am Ball, die Passquote zählt die Pässe, gewonnene Zweikämpfe und vorbereitete Chancen gehen in die Spielernoten ein.
- **Jede Abspielstufe ist dasselbe Spiel:** Laufwege, Deckung und Abstände rechnen in Spielzeit. Auf „Schnell“ läuft die Partie nur im Vorlauf, sie wird nicht enger oder foulreicher.
- **Werte relativ zum Niveau:** Die Werte einer Partie werden so skaliert, dass ihr Schnitt bei 70 liegt. Das Verhältnis zwischen den Spielern bleibt dabei erhalten: Ein Landesligist mit 26 gegen einen mit 19 ist genauso überlegen wie ein Erstligist mit 86 gegen einen mit 63.
- **Heimvorteil:** Die Heimelf spielt mit dem Publikum im Rücken etwas besser, je nach Stadion. Auf neutralem Platz (Turniere) entfällt er.
- **Ein voller Strafraum schützt:** Stehen mehr als vier Verteidiger im Strafraum, kommen Pässe hinein seltener an, Dribblings bleiben hängen, und Abschlüsse darin sind schwerer. Gegen einen tiefen Block wird öfter aus der Distanz geschossen.
- **Der Block greift am eigenen Strafraum zu:** „Seltener anlaufen“ gilt für die Höhe, nicht für das eigene Drittel. Dort gehen auch bei Konter und Tiefem Block zwei Spieler auf den Ball. Wer zwischen Ball und Tor steht, verstellt dem Schützen Winkel und Schussbahn. Eine defensive Mannschaft geht seltener ins riskante Dribbling, schnelles Tempo spielt vertikaler.

**Mentale Werte:** Die versteckten Persönlichkeitswerte wirken auf dem Platz.
- **Tagesform:** Unbeständige Spieler haben gute und schlechte Tage (bis ±10 %), ein beständiger Profi spielt fast immer gleich. Das gilt auch in der Sofort-Simulation.
- **Entscheidungen:** Wer das Spiel liest (Übersicht, Stellungsspiel, Erfahrung), wählt öfter die beste Option. Ein junger Spieler mit wenig Übersicht entscheidet sich öfter falsch.
- **Nervenstärke:** Große Spiele, Beständigkeit und Erfahrung entscheiden mit, ob ein Abschluss unter Druck oder ein Elfmeter sitzt.
- **Konzentration:** Ab der 75. Minute unterlaufen unprofessionellen, unbeständigen Spielern mehr Fehlpässe.
- **Große Spiele:** In Derbys und engen Schlussphasen wächst, wer dafür gemacht ist. Wer es nicht ist, verkrampft.

**Der Trainer des Gegners reagiert:** Liegt die KI zurück, stellt sie ab der 55. Minute offensiver um, bei zwei Toren Rückstand sofort, in der Schlussphase auf volles Risiko mit hohem Pressing. Eine späte Führung sichert sie ab und bringt sie knapp auch mit Zeitspiel über die Zeit. Jede Umstellung steht im Ticker, nach dem Abpfiff gilt wieder die eigene Taktik. Gewechselt wird nach Kondition: Wer zurückliegt, bringt früher frische Beine nach vorn, wer führt, frischt die Abwehr auf. Dieselbe Logik gilt in der Sofort-Simulation für alle Spiele der Liga.

**Verletzungen entstehen auf dem Platz:** Nichts wird mehr vorab über den Kader gewürfelt.
- **Kontakt:** Ein Foul kann den Gefoulten verletzen – je härter, desto eher (ein rotwürdiges Foul rund dreißigmal so oft wie ein normales). Prellung, Knöchelstauchung, Bänderdehnung, im Pech Meniskus oder Kreuzband.
- **Muskel:** Wer müde ist, zerrt sich. Das Risiko steigt mit der Erschöpfung, mit dem versteckten Wert Verletzungsanfälligkeit und ab 30 mit dem Alter.
- Im Livespiel bleibt der Spieler am Tatort liegen. Der Gegner und – bei abgegebenen Wechseln – der Co-Trainer bringen sofort den passendsten Ersatz, sonst wird gefragt. Im Schnitt gibt es knapp eine Verletzung in zwei Spielen, in beiden Engines gleich.

**Schiedsrichter und Vorteil:** Jede Partie hat ihren Schiedsrichter – mit Namen, fest mit der Ansetzung. Er steht in der Taktikbesprechung und im Spielbericht.
- *Streng:* pfeift kleinlicher und zeigt rund 30 % mehr Karten, gibt selten Vorteil.
- *Sachlich:* der Durchschnitt.
- *Großzügig:* lässt laufen, zeigt weniger Karten und gibt gern Vorteil.
- **Vorteil:** Wird vorn gefoult und der Angriff kann weiterlaufen, pfeift der Schiedsrichter nicht („▶️ Vorteil!“). Die Karte gibt es nachträglich. Die Notbremse bleibt Rot.

**Taktische Vertrautheit:** Eine neue Formation oder Spielweise sitzt nicht vom ersten Tag an.
- Je Formation und je Anweisung (Pressing, Tempo, Passspiel, Abwehrlinie …) merkt sich der Verein, wie eingespielt die Mannschaft ist.
- Spiele und Taktiktraining schleifen ein, was gespielt wird. Was lange ruht, verblasst langsam.
- Eine ganz fremde Taktik kostet bis zu acht Prozent Stärke, eine neue Formation allein gut zwei.
- Der Taktik-Reiter zeigt die Vertrautheit als Balken und nennt, was noch nicht sitzt.

**Schwacher Fuß und Körpergröße:**
- Gut jeder fünfte Abschluss aus dem Spiel kommt mit dem schwachen Fuß – öfter, wenn ein Spieler auf der Seite seines schwachen Fußes aus spitzem Winkel abschließt. Der Rechtsfuß links neben dem Tor muss dann links schießen.
- Mit dem schwachen Fuß sitzt der Ball spürbar seltener, mit dem starken etwas öfter. Beidfüßige haben keinen schwachen Fuß.
- Jeder Spieler hat eine feste Körpergröße (in der Spielerakte). Im Kopfballduell zählen zehn Zentimeter gut fünf Punkte, und bei Flanken und Ecken kommt der Große öfter zum Kopfball.

**Standardvarianten** (Taktik-Reiter, Gruppe „Standards“):
- **Ecken:** *Erster Pfosten* (scharf, der Torwart kommt schwer heran), *Zweiter Pfosten* (hoch für den Kopfballstärksten), *Kurz* (ausspielen und aus besserem Winkel flanken) oder *Gemischt*.
- **Standards verteidigen:** *Raumdeckung* (schützt den ersten Pfosten), *Manndeckung* (der beste Kopfballspieler gegen den gefährlichsten Gegner) oder *Gemischt*.
- An den zweiten Pfosten lohnt es sich mit Riesen, die kurze Ecke ohne.

**Eigenschaften und Signaturen (`EigenschaftenEngine`):**
- **Eigenheiten** wie „Zieht nach innen“, „Schießt aus der Distanz“, „Sucht den tiefen Pass“ oder „Freistoßspezialist“ verschieben, was ein Spieler tut, und ein wenig, wie gut es gelingt. Ein Zweikämpfer gewinnt mehr Duelle und foult öfter.
- **Signaturen** sind einzigartige Eigenschaften der Besten: Rund vier Prozent der Spieler jeder Liga – nach Stärke, höchstens fünf je Verein – bekommen eine, die zu ihrem Profil passt. Beispiele: 🎯 Eiskalter Vollstrecker, 🪄 Standardkünstler, 🎼 Spielgestalter, 🌀 Dribbelkünstler, 🦅 Kopfballungeheuer, 🛡️ Abwehrchef, 🐈 Katze im Tor, 🧱 Elfmeterkiller, ⚡ Pfeilschnell, 🔋 Unermüdlicher Motor und 🔥 Mentalitätsmonster (wächst in Derbys und in der Schlussphase).
- Sie wirken im Livespiel und in der Sofort-Simulation gleich: Der Eiskalte verwandelt rund 30 % mehr seiner Chancen, die Katze im Tor hält entsprechend mehr. Wer gut abschließt oder in der Luft stark ist, kommt öfter zum Abschluss.
- Zu sehen sind sie in der Spielerakte (Eigenheiten), als Symbol hinter dem Namen in Kader, Transfermarkt und Vereinsdetails und im Ticker („… 🎯 Eiskalter Vollstrecker!“). Jede Saison werden sie neu vergeben, ältere Spielstände bekommen sie beim Laden nachgereicht.

### 3b. 🗣️ Kabinenansprache & Pressekonferenz (`ManagerEngine`)
Ein Manager verwaltet keine Tabellen, er redet mit Leuten.

**Vor dem Anpfiff und in der Halbzeit** wählen Sie den Ton: *Ruhig bleiben*, *Anfeuern*, *Mehr fordern*, *Vertrauen aussprechen* oder *Lautstark werden*. Der Ton wird nicht bewertet, sondern wirkt – und zwar abhängig von der Lage:

| Situation | Anbrüllen | Mehr fordern | Vertrauen |
|---|---|---|---|
| 0:2 zurück, Favorit | **+6** Moral | **+7** Moral | ±0 |
| 2:0 vorn | **−8** Moral | +2 | ±0 |
| Verunsicherte Mannschaft | stark negativ | negativ | **+8** |

Jeder Spieler reagiert eigen: Temperament verstärkt jede Ansprache, Professionalität dämpft Kritik. Zwei, drei Spieler melden sich sichtbar zurück („nickt und klatscht in die Hände" / „schaut zu Boden und sagt nichts"). Die Wirkung landet in Moral und Form – und damit direkt in der Spielstärke. Eine wirksame **Halbzeitansprache** lässt den weiteren Spielverlauf neu berechnen.

**Am Medientag** stellen sich die Journalisten – zwei bis drei Fragen, und zwar zu dem, was gerade los ist: das Derby vor der Tür, eine Sieges- oder Niederlagenserie, Tabellenspitze oder Abstiegskampf, ein Ultimatum des Vorstands, der verletzte Leistungsträger, ein Angebot für einen eigenen Spieler, der Star des Gegners, ein Kantersieg oder ein Debakel. Ohne besonderen Anlass bleiben die Dauerbrenner (Form, Saisonziel, Fans, ein Spieler in der Kritik). Jede Frage stellt ein Journalist eines bestimmten Blattes, und das Blatt verstärkt die Wirkung: Die Frage zur Form richtet sich nach den letzten Spielen: vor dem ersten Spiel fragen sie nach dem Saisonauftakt, bei ausgeglichener Bilanz, ob die Mannschaft ihre Linie findet. Vorher hieß es auch vor dem ersten Spieltag „Ihre Mannschaft ist gut in Form“.

| Blatt | Wirkung |
|---|---|
| 📰 Boulevard (*Sportblitz*) | Macht aus jedem Satz Druck (Medienrummel ×1,5) |
| 📊 Fachpresse (*Taktikblatt*) | Liest der Vorstand (Vorstand ×1,4) |
| 🏘️ Lokalzeitung | Erreicht die Kurve (Fanstimmung ×1,5) |

Manche Antworten haben **Folgen**: Eine Kampfansage vor dem Derby liest auch der Gegner (seine Moral steigt). Wer einen Sieg ankündigt, hat ein **Versprechen** gegeben – nach dem Spiel wird abgerechnet: gehalten bringt Fans und Vorstand, gebrochen den Spott der Presse. Scharfe Sätze stehen am nächsten Tag als **Schlagzeile** im Postfach. Wer sich vor einen kritisierten Spieler stellt, gewinnt ihn zurück (+12 Moral); wer einen umworbenen Spieler für unverkäuflich erklärt, macht ihn glücklich und den Vorstand nachdenklich.

**Nach dem Abpfiff** bietet der Spielbericht eine kurze Pressekonferenz an: ein, zwei Fragen zum Ergebnis, zum besten Mann auf dem Platz, zu einer Roten Karte – oder zu dem, was vorher versprochen wurde.

### 3b-2. 📋 Taktikbesprechung vor dem Spiel (`MatchplanEngine`)
Die Taktik im Taktik-Reiter ist die Grundordnung. Vor dem Anpfiff stellt der Trainer seine Elf aber auf **diesen** Gegner ein: Vor jedem Livespiel (und über den Knopf **Taktikbesprechung** auf dem Dashboard auch fürs Sofort-Ergebnis) zeigt die Besprechung die Analyse auf einen Blick – voraussichtliche Formation, Stärken, Schwächen, Schwachstelle, Schlüsselspieler – und bietet sieben Punkte an, von denen **höchstens zwei** gelten:

*Schlüsselspieler eng decken* · *Früh stören* · *Tief stehen, schnell umschalten* · *Über die Flügel* · *Durch die Mitte* · *Ball laufen lassen* · *Die Schwachstelle anlaufen*

- Die Punkte setzen Anweisungen **nur für dieses Spiel** – danach gilt wieder die gewohnte Taktik (in Livespiel und Sofort-Simulation gleich).
- Der Spielanalyst sagt zu jedem Punkt, was er davon hält. Ab drei Sternen sieht er genau genug für Empfehlungen, darunter bleibt der Plan eine Vermutung.
- Trifft ein Punkt eine echte Schwäche des Gegners, ist die Mannschaft spürbar besser eingestellt (+1,5 % je Treffer).
- Der eng gedeckte Spieler verliert an Wirkung und kommt deutlich seltener zum Abschluss. Gedeckt werden Mittelfeld- und Angriffsspieler, keine Verteidiger.
- Widersprüche schließt die Besprechung aus: Früh stören und tief stehen – oder Flügel und Mitte – gehen nicht gleichzeitig.
- **Gegneranweisungen (`GegneranweisungEngine`):** Unter dem Plan steht die voraussichtliche Elf des Gegners, Mann für Mann. Je Gegenspieler lässt sich festlegen:
  - **Anlaufen:** *Immer* – wer unsicher am Ball ist, verliert ihn; einem Ballsicheren ist das egal, und jeder Dauerdruck kostet die eigene Elf etwas Kraft. *Kommen lassen* – ein Dribbler läuft sich fest, ein Passgeber hat alle Zeit.
  - **Zweikampf:** *Hart angehen* – wer körperlich nicht dagegenhält, verliert die Lust. Er wird öfter gefoult, und es gibt mehr Karten (gegen die ganze Elf etwa ein Foul und eine halbe Gelbe mehr je Spiel). *Nicht einsteigen* – weniger Fouls und Karten, dafür hat er mehr Platz.
  - **Auf den schwachen Fuß** (nur bei Spielern mit einem starken Fuß): Er muss öfter mit dem anderen abschließen.
  - Was eine Anweisung bringt, hängt an den Stärken des Spielers, gemessen an seinem eigenen Niveau. Der Analyst markiert die vier deutlichsten Fälle („unsicher am Ball – sofort Druck“) und lässt sich mit einem Knopf übernehmen. Unter zweieinhalb Sternen schweigt er, ein schwacher irrt sich öfter.
  - Die Anweisungen gelten wie der Plan nur für dieses Spiel, in Livespiel und Sofort-Simulation. Sie stehen auch auf der Tafel der Ansprache. Ohne Anweisungen rechnet das Spiel genau wie vorher.

### 3b-3. 💼 Der Jobmarkt des Trainers (`JobmarktEngine`)
Bisher kamen Angebote nur nach einer Entlassung, wer Erfolg hatte, blieb für immer beim ersten Verein. Jetzt bewegt sich der Markt – im Reiter *Verein* unter dem Trainerprofil:
- **Anfragen:** Trennt sich ein größerer Verein von seinem Trainer (unter dem Jahr oder im Sommer) und passt der eigene Ruf, fragt er mit einer gewissen Chance an – frühestens nach zehn Pflichtspielen im Amt. Das Angebot steht auf dem Schreibtisch und gilt fünf Tage. Ablehnen freut den eigenen Vorstand ein wenig.
- **Offene Stellen:** Wer in den letzten zwei Wochen den Trainer gewechselt hat, nimmt noch Bewerbungen an. Nach drei Tagen kommt die Antwort – je näher der eigene Ruf am Verein, desto eher ein Angebot.
- **Wechsel:** Die Station endet als „gewechselt“, beim alten Verein übernimmt ein Trainer aus dem Karussell. Wechseln lässt sich wie nach einer Entlassung nur in Ligen mit gleich vielen Spieltagen und nur mit der verlangten Lizenz.
- **Rücktritt:** Kostet keinen Ruf, aber die Station endet. Danach melden sich die Vereine, die einen nehmen würden – wie nach einer Entlassung.

### 3c. 📌 Der Schreibtisch
Das Dashboard zeigt, was heute eine Entscheidung braucht – nach Dringlichkeit sortiert, ein Klick springt in den zuständigen Reiter: unvollständige Startelf, Verhandlungen mit uns am Zug, Talente, um die ein größerer Verein wirbt (mit der Frist), Ausfälle, überlastete Spieler, auslaufende Verträge, unzufriedene Spieler, ungelesene Post. Gesprächswünsche, Wechselwünsche und offene Versprechen stehen ebenfalls dort – ein Klick öffnet die Akte des Spielers.

- **Direkt ans Ziel:** Bei auslaufenden Verträgen steht jeder Spieler einzeln da, die stärksten zuerst. Ein Tipp auf den Namen öffnet seine Akte gleich bei der Vertragsverlängerung, der Cursor steht im Gehaltsfeld. Eine Verhandlung, bei der wir am Zug sind, führt direkt zu ihrer Karte im Transfermarkt. Dasselbe gilt für Talente: *Vertragsgespräche aufnehmen* springt sofort in die Verhandlung mit dem Berater, *Zur Verhandlung* ebenso. Die Post über einen auslaufenden Vertrag hat einen Knopf *Vertrag verlängern*.

### 3d. 🗣️ Gespräche unter vier Augen (`PlayerTalkEngine`)
**Das Spielerprofil als eigene Seite wie im Vorbild (`uiProfil.js`):** Die Akte war ein Fenster über dem Reiter. Jetzt löst sie den Reiter ab, wie eine eigene Seite. Kopfleiste, Navigation und *Weiter* bleiben.
- **Zurück:** Der Knopf auf der Seite, der in der Kopfleiste, Alt+←, Escape und die Zurück-Taste am Handy führen dorthin, wo man herkam. Von einem Profil zum nächsten führt Zurück zum vorigen Profil.
  - Ein anderer Reiter schließt die Seite.
  - Nach *Weiter* zeigt eine offene Seite den neuen Stand.
  - Liegt ein Fenster darüber, schließt Escape nur das Fenster.
- **Kopf:**
  - links Rückennummer (beim eigenen Spieler zum Ändern), Name, Position mit allen Positionen, Flagge, Nation, Alter, Größe und Verein (ein Tipp öffnet ihn)
  - darunter Marken für Kaderrolle, Verletzung, Sperre, Leihe, U19/U23, Transferliste, Vorvertrag und Beobachtungsliste
  - in der Mitte Marktwert (beim fremden Spieler als Spanne), Gehalt, Vertragsende als Datum, eine Ausstiegsklausel und das Land mit Länderspielen und Toren
  - rechts Sterne für Stärke und Potenzial getrennt, jeweils mit Klasse
  - Der Knopf **Aktionen** steht wie im Vorbild direkt unter dem Namen. Sein Menü ist nach Themen gruppiert: *Vertrag* (verlängern, Profivertrag, verleihen), *Kabine* (Gespräch, Rückennummer), *Training* (Entwicklung), *Transfer* (verhandeln oder beim Vereinslosen Vertrag anbieten, ausleihen, Vorvertrag, Klausel ziehen, Verfügbarkeit erfragen), *Scouting* (scouten, Beobachtungsliste, ähnliche Spieler suchen, beim eigenen Spieler Ersatz suchen) und *Mehr* (vergleichen, Laufbahn, zum Verein). Ein Eintrag führt zum passenden Reiter, drückt den Knopf, den die Seite schon hat, oder ruft eine eigene Aktion auf.
  - **Verfügbarkeit erfragen** (`TransferEngine.verfuegbarkeit`): Der Verein antwortet, oben im Reiter *Vertrag & Transfer*, mit Knöpfen für den nächsten Schritt. Die Antwort folgt derselben Forderung, mit der eine Verhandlung eröffnet würde, gerundet („um 26 Mio. €“). Je nach Lage heißt sie *Vereinslos*, *Steht zum Verkauf* (Transferliste), *Gesprächsbereit* (Vertrag läuft aus), *Nicht auf dem Markt*, *Schlüsselspieler* (unter den drei Besten des Kaders mit mindestens zwei Jahren Vertrag) oder *Schon vergeben* (Vorvertrag woanders). Dazu steht, was einem Wechsel im Weg steht: geschlossenes Fenster, fehlende Arbeitserlaubnis, Leihe, Ausstiegsklausel.
  - **Ähnliche Spieler suchen** öffnet den Transfermarkt mit Position, Altersgruppe und Stärke dieses Spielers als Filter.
- **Übersicht:**
  - **Positionen** auf einem Feld: Wo er spielen kann, steht die Position in der Farbe seiner Eignung, die Stammposition mit Ring. Wo es nur zur Not geht, steht ein farbiger Punkt, sonst ein grauer.
  - Darunter die Positionen mit Sternen und die **Rollen** seiner Position mit Sternen.
  - In der Mitte die Werte in drei Spalten: Technik (beim Torwart die Torwartwerte), Kopf und Körper.
  - Rechts **Info**: Größe, starker Fuß, Persönlichkeit in einem Wort (erst, wenn der Scout ihn kennt) und Bekanntheit nach dem Marktwert unter allen Spielern. Dazu „Im Verein seit“ und Länderspiele.
  - Ebenfalls rechts: Eigenheiten mit Signatur, Ausbildung, Eingewöhnung und Beobachtungen.
- **Kacheln** unter der Übersicht:
  - *Zufriedenheit* mit Spielzeit, Vertrag und Moral. Beim fremden Spieler steht stattdessen *Scoutwissen*.
  - *Fitness* mit Kondition, Spielpraxis, Verletzung und Anfälligkeit.
  - *Form* als Kurve der letzten Ligaspiele mit den Noten (Tooltip: Gegner, Ergebnis, Tore).
  - *Disziplin* mit Gelb, Rot, Sperre und den Karten bis zur Gelbsperre.
  - *Training* mit Schwerpunkt, Feinschliff, Umschulung, Eigenheit, Mentor, Belastung und Fortschritt. Nur beim eigenen Spieler.
  - *Saison* je Wettbewerb und *Laufbahn* in Summe.
- **Reiter:**
  - **Übersicht**
  - **Entwicklung** (eigene Spieler)
  - **Vertrag & Kabine** (bei fremden **Vertrag & Transfer**)
  - **Leistung**: Saison je Wettbewerb mit Minuten, Karten und Note, die Form der letzten zehn Ligaspiele als Kurve und Tabelle, dazu die Werte je 90 Minuten aus der Datenzentrale.
  - **Laufbahn** in sieben Kacheln wie im Vorbild (`uiProfilLaufbahn.js`), für jeden Spieler außer Talenten:
    - *Biografie*: ein paar Sätze aus dem Spielstand: Alter, Position und Herkunft, Verein, Liga und Vertrag, Stellung im Kader, die drei größten Stärken (erst mit Scoutwissen), Spiele und Tore seit dem Start, Länderspiele, Auszeichnungen.
    - *Karrierestatistik*: Vereine, Spiele, Tore und Vorlagen, darunter Saison für Saison mit Wappen und Jahreszahlen („26/27“).
    - *Medien*: das Urteil der Presse aus Form, Bekanntheit, Wechselwunsch und Verletzung, dazu Bekanntheit und Persönlichkeit.
    - *Bezugspersonen*: Mentor, Schützlinge, Landsleute im Kader und frühere Mitspieler (dieselbe Saison beim selben Verein, heute woanders). Jeder Name öffnet sein Profil.
    - *Vereine*: aus der Jugend von, ausgebildet bei, die meisten Spiele für, heute bei.
    - *Nationalität*: Flagge, im Verein oder im Land ausgebildet, EU-Pass, Arbeitserlaubnis für England (wenn der eigene Verein dort spielt), Länderspiele und Sprachen (Muttersprache, nach zwei Jahren die Landessprache des Vereins).
    - *Meilensteine*: Auszeichnungen, Titel mit seinem Verein, runde Zahlen an Spielen und Toren, Vereinslegende, daneben die Summen.
    - Erfunden wird nichts. Was das Spiel erst seit dem Start kennt (Laufbahn, Länderspiele), steht ab dann da.
  - **Vergleich**: der Spielervergleich direkt auf der Seite statt in einem eigenen Fenster.
- Die Reiterleiste bleibt am breiten Bildschirm beim Scrollen oben. Der gewählte Reiter bleibt erhalten, solange dieselbe Akte offen ist. Ein Klick auf einen auslaufenden Vertrag öffnet gleich „Vertrag“.
- **Am Handy** steht alles untereinander: Kopfdaten und Sterne zu zweit, Kacheln zu zweit, die Werte über die volle Breite.
- **Starker Fuß für alle:** Den von Hand angelegten Kadern der deutschen ersten Liga (290 Spieler) fehlte er. Das Profil zeigte einen Strich, und die Regeln zum schwachen Fuß im Spiel griffen bei ihnen nicht. Jetzt bekommen sie ihn fest aus der Kennung (`PlayerGenerator.fussFuer`), ohne den Zufall zu verbrauchen. Ältere Spielstände bekommen ihn beim Laden nach.

**Gleich lange Balken:** Auf der Übersicht teilen sich Saisonziel, Vorstandszufriedenheit, Fanstimmung und Mediendruck ein Raster. Vorher nahm jede Beschriftung so viel Platz, wie sie brauchte, und neben „Vorstandszufriedenheit“ blieb der kürzeste Balken. Am Handy steht die Beschriftung über dem Balken.

**Spielerwerte wie im Vorbild (`PlayerGenerator.DETAILWERTE`):** Die Akte zeigt die Werte in drei Karten, nach Höhe eingefärbt:

| Karte | Werte |
|---|---|
| **Technik** | Abschluss, Ballannahme, Distanzschüsse, Dribbling, Ecken, Elfmeter, Flanken, Freistöße, Kopfball, Manndeckung, Passspiel, Tackling, Technik |
| **Kopf** | Aggressivität, Antizipation, Einsatz, Entscheidungen, Entschlossenheit, Führung, Konzentration, Kreativität, Mut, Nervenstärke, Ohne Ball, Stellungsspiel, Teamwork, Übersicht |
| **Körper** | Antritt, Ausdauer, Balance, Beweglichkeit, Grundfitness, Kraft, Schnelligkeit, Sprungkraft |
| **Torwart** (statt Technik) | Abschlag, Abwurf, Ballannahme, Eins gegen eins, Fangsicherheit, Herauslaufen, Hohe Bälle, Kommunikation, Passspiel, Reflexe, Stellungsspiel, Strafraumbeherrschung |

- **Woher sie kommen:** Die 22 neuen Werte folgen aus den groben Werten, die weiter im Training wachsen. Wer Schuss gewinnt, schließt besser ab und schießt bessere Freistöße. Dazu kommen:
  - die Position: Außenverteidiger flanken, Innenverteidiger köpfen, Flügel haben Antritt
  - die Größe bei Kopfball, Kraft, Sprungkraft und Beweglichkeit
  - die Persönlichkeit bei Aggressivität, Mut, Entschlossenheit und Grundfitness
  - ein persönlicher Anteil, fest je Spieler
  - Eigenheiten als Untergrenze: Wer „gefährlich bei direkten Freistößen“ ist, hat gute Freistöße.
- **Gespeichert wird davon nichts:** Der Spielstand wird nicht größer, alte Spielstände haben die Werte sofort. Gespeichert wird nur, was sich ein Spieler erarbeitet (siehe unten).
- **Im Spiel:** Beide Engines rechnen mit der Abweichung vom groben Wert, ohne den Positionsaufschlag, denn die Position steckt dort schon in den groben Werten und den Rollen. Im Mittel bleibt alles, wie es eingestellt war, der Spezialist sticht heraus.
  - Elfmeter, Freistöße und Ecken tritt, wer sie am besten kann.
  - Nach Flanke und Ecke zählen Kopfball und Sprungkraft, beim Steilpass Abschluss, Ballannahme und Antritt, beim Dribbling die Beweglichkeit.
  - Im Livespiel zählt im Strafraum der Abschluss, von weiter weg der Distanzschuss. Dazu Manndeckung im verteidigenden Kopfballduell und Tackling gegen den Dribbler.
  - Torhüter: Herauslaufen im Eins-gegen-eins, hohe Bälle und Strafraumbeherrschung bei Flanken.
  - Im Livespiel außerdem: Aggressivität beim Foul (sie enthält das Temperament, das vorher allein zählte) und im Zweikampf, Kraft im Zweikampf, Balance beim Dribbling im Kontakt, Antritt im freien Raum und Mut im Kopfballduell. In der Sofort-Simulation foult der Aggressivere öfter, die Zahl der Fouls bleibt.
  - Entschlossenheit, Kreativität und Grundfitness zeigen, was in der Persönlichkeit und den groben Werten schon wirkt. Eigene Effekte haben sie nicht.
- **Scoutwissen:** Bei fremden Spielern stehen die Werte als Spanne. Unter den Karten stehen die Grundwerte, denen die Detailwerte folgen. Der Spielervergleich führt alle Werte.

**Detailwerte mit eigenem Verlauf (`PlayerGenerator.detailAlter`, `detailPlus`, `detailReife`, `DevelopmentPlanEngine.setzeFeinschliff`):** Bisher folgten die Detailwerte allein den groben Werten. Ein 34-jähriger Flügelspieler war so beweglich wie mit 25, solange Dribbling und Technik hielten. Ein 19-Jähriger trat Freistöße wie ein Routinier. Und was einer im Training an einem einzelnen Wert feilte, ging in den groben Werten unter. Jetzt kommen zwei Anteile dazu:

- **Alter**, für alle Spieler, berechnet statt gespeichert:
  - Freistöße, Elfmeter, Ecken, Distanzschüsse, Manndeckung, Kopfball und Entschlossenheit reifen bis Anfang dreißig, ebenso Strafraumbeherrschung, Kommunikation, hohe Bälle und Herauslaufen beim Torwart. Mit 18 liegen sie bis zu 5 Punkte unter dem, was die groben Werte ergeben, mit 26 genau darauf, ab 32 bis zu 4 Punkte darüber.
  - Beweglichkeit, Sprungkraft, Balance, Antritt und Grundfitness: mit Anfang zwanzig leicht vorn, ab 30 geht es bergab, mit 35 bis zu 7 Punkte.
  - Die volle Kraft kommt erst mit Mitte zwanzig.
  - Über alle Spieler gemittelt verschiebt das keinen Wert um mehr als 0,3 Punkte. Die Spiel-Engine bleibt also geeicht, es ändert sich nur, wer wo stark ist.
- **Erarbeitetes**, nur für Spieler, die durch den eigenen Verein gehen. Gespeichert wird es als `player.detailPlus`, höchstens 12 Punkte je Wert:
  - **Feinschliff** im Entwicklungsplan der Akte: Gezielte Zusatzarbeit an einem Detailwert, etwa Freistöße, Kopfball, Flanken, Beweglichkeit oder beim Torwart Herauslaufen. Ein junger Profi gewinnt so rund vier Punkte je Saison, ein Dreißigjähriger die Hälfte. Je mehr schon erarbeitet ist und je weniger professionell er ist, desto zäher wird es. Die Zusatzschicht kostet etwas Kraft. Die Kopfwerte Aggressivität, Mut, Entschlossenheit und Kreativität kommen aus der Persönlichkeit und lassen sich nicht pauken.
  - **Spielpraxis** zum Saisonende, auch für verliehene Spieler: Ab 15 Einsätzen gibt es einen Punkt, ab 28 zwei. Sie gehen auf das, was die Position jede Woche verlangt: beim Innenverteidiger Manndeckung, Kopfball und Tackling, beim Stürmer Abschluss, Kopfball und Ballannahme, beim Torwart Strafraumbeherrschung, hohe Bälle, Kommunikation und Herauslaufen. Zuerst bekommt etwas, was bisher am wenigsten dazugewonnen hat. Ab 34 bringt Praxis nichts mehr.
  - Ab 30 baut das erarbeitete Körperliche ab, je Wert und Saison ein Punkt. Das gilt auch, wenn der Spieler den Verein inzwischen verlassen hat.
- **Sichtbar:**
  - In der Akte steht das Erarbeitete hochgestellt am Wert (+3). Ein Punkt markiert den laufenden Feinschliff.
  - Der Trainingsreiter (*Individuell*) zeigt den Feinschliff beim Schwerpunkt.
  - Der Monatsbericht hat einen Abschnitt „Feinschliff und Spielpraxis“.
- KI-Vereine bekommen kein Erarbeitetes. Ihre Spieler entwickeln sich wie bisher über die groben Werte, das Alter wirkt bei ihnen wie bei allen.

In der Spielerakte führt der Manager Gespräche mit jedem eigenen Spieler. Wie er reagiert, hängt an Form und Persönlichkeit:

| Gespräch | Wirkung |
|---|---|
| **Leistungen loben** | Spielt er stark, hebt es die Moral deutlich. Lob für ein schwaches Spiel durchschaut ein ehrgeiziger Profi. |
| **Leistungen kritisieren** | Bei schwacher Form nimmt ein Profi Kritik als Ansporn: Form und Entwicklung zwei Wochen lang besser. Ein Hitzkopf ist beleidigt. Kritik an einem starken Spieler kränkt immer. |
| **Mehr Spielzeit versprechen** | In den nächsten fünf Ligaspielen mindestens drei Einsätze ab 60 Minuten. Gehalten: Vertrauen und Moral steigen. Gebrochen: Er fühlt sich belogen und will womöglich weg. Höchstens vier Versprechen gleichzeitig. |
| **Um Geduld bitten** | Ein loyaler, professioneller Spieler wartet, ein ehrgeiziger nicht lange. |
| **Wechselwunsch akzeptieren / umstimmen** | Akzeptiert: Er kommt auf die Transferliste und bekommt öfter Angebote. Umstimmen gelingt eher bei Treuen und bei Vertrauen. |

- Nach jedem Gespräch braucht es sechs Tage Pause, bevor man denselben Spieler wieder spricht.
- **Gesprächswünsche:** Ein unzufriedener Spieler bittet um ein Gespräch. Wer ihn eine Woche warten lässt, kränkt ihn.
- **Wechselwunsch:** Drei Wochen tiefer Frust oder ein gebrochenes Wort werden zum Wechselwunsch.
- **Mannschaftsbesprechung:** In der Kabinen-Karte des Kaders holt der Trainer alle zwei Wochen die ganze Mannschaft zusammen.
  - **Loben** trägt nach einer guten Serie und wirkt nach Niederlagen unverdient.
  - **Mehr fordern** ist nach schlechten Ergebnissen ein Weckruf – Profis nehmen ihn an, Hitzköpfe sind gekränkt –, nach Siegen ist es unfair.
  - **Druck herausnehmen** hilft, wenn die Köpfe hängen.
  - **Das Saisonziel bekräftigen** stärkt, wer auf Kurs liegt.
  - Die Menschenführung des Trainers verstärkt die Wirkung, der Kapitän trägt seine Stimmung zu allen, und dieselbe Ansprache zweimal hintereinander wirkt nur noch halb.

### 4. 🔄 Transfersystem, Scouting & Verträge
- **Transfermarkt als Spielerdatenbank wie im Vorbild (`uiSpielerdatenbank.js`):**
  - Über der Tabelle stehen die Zahl der Treffer, das Transferfenster (offen bis … oder geschlossen) und der Schalter *Nur gescoutete Spieler*: ein eigener Bericht oder mindestens halbes Wissen (`ScoutingEngine.istGescoutet`).
  - Vierzehn Spalten: Status, Spieler, Nation, Verein mit Wappen, Position mit bester Rolle, Alter, Stärke und Potenzial getrennt, Ablöse und Gehalt als Spanne, Empfehlung, Wissen und die Knöpfe *Scouten* und *Verhandeln*.
  - **Status als Symbole:** auf der Beobachtungsliste, Scout unterwegs, Bericht liegt vor, Verhandlung läuft, steht zum Verkauf, Vertrag läuft aus, vereinslos, verletzt, ausgeliehen, woanders unterschrieben.
  - **Nation:** Die Flagge auch für Länder ohne eigene Liga im Spielstand, etwa Japan, Kroatien oder Senegal. Vorher stand dort ein Globus.
  - **Gehalt als Spanne (`TransferEngine.gehaltsSpanne`):** was der Spieler beim Wechsel ungefähr fordert, je Woche: von genügsam bis gierig, je nach Berater. Nach einer Verhandlung kennt man den Berater, dann steht die genaue Forderung da.
  - **Empfehlung als Note von A+ bis E (`ScoutingEngine.empfehlung`):** aus der Schätzung des Scouts, nicht aus den wahren Werten.
    - Gewertet wird, welchen Platz der Spieler im eigenen Mannschaftsteil hätte: der Beste, Stammspieler, Rotation, Ergänzung oder schwächer als alle.
    - Bei Jungen bis 23 zählt auch der Platz nach dem Potenzial. Ab 31 gibt es Abzug.
    - Eine Ablöse über dem Transferbudget kostet, ablösefrei bringt etwas. A+ gibt es nur, wenn er klar besser ist als der beste eigene Spieler.
    - Ohne Bericht ist die Note ein erster Eindruck, blass und gestrichelt. Die Gründe stehen im Tooltip.
    - Gemessen mit Dortmund zum Start, zwei Welten: 16 bis 28 A, 195 bis 247 B, gut 1.500 C, knapp 1.100 D, der Rest E von rund 9.000 erreichbaren Spielern. A+ ist selten.
  - Sortieren auch nach Empfehlung.
  - **Sechs Kacheln unter der Tabelle:**
    - *Transferfenster*: offen oder zu, wie lange noch, laufende Verhandlungen und Angebote.
    - *Scouting-Reichweite*: ab welcher Ligastufe, das Wissen über die fünf bekanntesten Länder, wie viele Spieler im Ausland noch unbekannt sind.
    - *Spielerempfehlungen*: die besten Noten unter den gescouteten Spielern, ohne Berichte die besten der Liste als erster Eindruck.
    - *Beobachtungsliste*: Zahl und die ersten vier mit dem, was sich getan hat.
    - *Budgets*: Transferbudget, Gehälter gegen Gehaltsbudget und was frei ist.
    - *Aufträge*: laufende Suchaufträge, Spieler in Beobachtung, Regionalscouts und der Suchauftrag des Sportdirektors.
  - Am Handy wird jede Zeile zur Karte mit Position, Name, Statussymbolen, Note, Sternen, Knöpfen und einer Zeile mit Verein, Ablöse und Wissen.
- **Transfermarkt mit Suchfiltern:** Name, Position oder Mannschaftsteil und Stärke stehen oben. Unter *Mehr Filter* kommen dazu:
  - Alter, Potenzial, Marktwert (auch „bis zum Transferbudget“)
  - Vertrag: läuft aus, auf der Transferliste, vereinslos
  - Land und Sortierung (Stärke, Potenzial, Alter, Marktwert)
  - Potenzial und Marktwert gelten so, wie der Scout sie sieht. Wen er kaum kennt, filtert er nach seiner Spanne.
  - Der Leihmarkt filtert nach Mannschaftsteil, Alter, Stärke, Rolle und Kosten (ohne Leihgebühr, Wochenkosten bis zum Kaderschnitt) und zeigt alle Treffer seitenweise.
- **Vertragsverlängerungen (`ContractEngine`):** Individuelle Gehaltsforderungen, Rollenabsprachen und Vertragslaufzeiten direkt im Spielermenü verhandeln.
- **Forderungen passen zur Liga:** Vorher forderte jeder Spieler mindestens 10.000 € pro Woche, gerundet auf Tausender – ein Landesligaspieler mit 120 € wollte plötzlich das Achtzigfache. Jetzt zählen sein Gehalt und das Marktgehalt seiner Stärke in dieser Liga: Wer unter Wert bezahlt ist, will aufholen (bis 70 % der Lücke), wer über Wert bezahlt ist und älter als 30, gibt etwas nach. Darauf kommen 10 % Erhöhung, bis 30 % für junge Talente mit Luft nach oben und 15 % für Schlüsselspieler – gemessen am eigenen Kader, sodass auch der Beste einer Landesligamannschaft als Schlüsselspieler gilt. Beispiele: Landesliga 450 € → 520 €, mit 120 € → 160 €; 1. Liga 87.000 € → 120.000 €. Gerundet wird auf zwei Stellen, die Eingabefelder gehen in passenden Schritten (10 € in der Landesliga, 1.000 € in der 1. Liga).
- **Rolle, Wechselwunsch und Treue im Vertragsgespräch:** Jeder Spieler sieht sich in einer Rolle – gemessen an seiner Stärke im eigenen Kader – und die Akte nennt sie. Bietet man eine Stufe weniger, will er rund 12 % mehr Geld, bei zwei Stufen weniger unterschreibt er nicht; eine größere Rolle macht ihn genügsamer, erhöht aber, was er an Einsätzen erwartet. Ein „Zukunftstalent" ist nur für junge Spieler mit Luft nach oben das Erhoffte. Wer einen Wechselwunsch geäußert hat oder tief unzufrieden ist, spricht gar nicht über eine Verlängerung – erst muss ihn ein Gespräch umstimmen. Treue Spieler, die schon länger da sind, kommen beim Gehalt etwas entgegen. Rolle und Ausstiegsklausel zeigen die neue Forderung sofort. Vorher war die Rolle nur eine Notiz, und jeder verlängerte zu jedem Status.
- **Transferfenster nach Datum, Winterpause je Land:** Das Sommerfenster ist die ganze Vorbereitung über offen und schließt am 31.08. (Deutschland, Frankreich) bzw. 01.09. (England, Spanien, Italien); das Winterfenster läuft vom 01.01. (Spanien und Italien: 02.01.) bis 02.02. Vorher hingen beide Fenster an Spieltagen, das Winterfenster lag auf zwei gewöhnlichen Spieltagen mitten über Weihnachten. Über den Jahreswechsel spielt jedes Land nach seinem Brauch: Die 1. Liga ruht von kurz vor Weihnachten bis zum 10.01., die Première Division ab Mitte Dezember und Primera División gut eine Woche (*Winterpause*: einige Tage frei, dann Training). In England gibt es keine Pause, dafür Spieltage am Boxing Day, am 29.12. und an Neujahr; die Prima Divisione spielt zwischen den Jahren und am Dreikönigstag. Am 24. und 25.12. wird nirgends gespielt. Gehandelt wird trotzdem überall ab dem 01.01. – auch dort, wo der Ball weiterrollt, und die KI-Vereine kaufen in der Pause wie an Spieltagen. Lange Ligen (First Division, Segunda División) legen Englische Wochen ein, damit alle Spieltage vor Juni liegen. Die Transferabteilung meldet, wenn ein Fenster öffnet, am letzten Tag (*Deadline Day*) und wenn es schließt – vorher geschah beides still. Vereinslose Spieler lassen sich jederzeit verpflichten.
  - **Deadline Day:** Am letzten Tag antworten Vereine und Berater sofort, auch der Medizincheck geht noch am selben Tag. Was am Vortag noch geprüft wurde, ist morgens beantwortet. So lässt sich am letzten Tag ein Spieler von der Ablöse bis zur Unterschrift holen. Vorher kam jede Antwort erst am nächsten Tag.
  - **Fensterschluss:** Was dann nicht unterschrieben ist, platzt: Transfers mit Ablöse und Leihen. Vorher liefen solche Verhandlungen weiter, ein Spieler kam noch eine Woche nach Fensterschluss. Vorverträge und Vereinslose brauchen kein Fenster.
- **Sommerpause vor dem Saisonwechsel:** Nach dem letzten Spieltag folgen drei Wochen bis zum Saisonwechsel, statt dass die neue Saison sofort beginnt. Das Saisonabschluss-Fenster nennt alle, deren Vertrag zum Wechsel endet (ein Tipp öffnet die Verlängerung), der Schreibtisch stellt sie ganz nach oben, der Kopf zählt die Tage herunter. Die Mannschaft hat frei: kein Trainingsplan, volle Erholung, kein Verletzungsrisiko im Training. Warten hat aber einen Preis: Jeden Tag holt sich mit 2 % Chance ein anderer Verein einen Spieler mit auslaufendem Vertrag, der für den eigenen Kader zählt (höchstens 4 Punkte unter dessen Niveau) – über die ganze Pause ist so ein Spieler zu gut einem Drittel weg. Wer unterschrieben hat, lässt nicht mehr verlängern und wechselt zum Saisonwechsel ablösefrei. Der Weiter-Knopf läuft durch die Pause und hält bei solchen Nachrichten an; *Pause überspringen* startet die neue Saison sofort. Wer in einer Saison verlängert hat oder einen Vorvertrag unterschrieben hat, beendet zum Wechsel nicht seine Karriere.
- **Vorverträge ab Januar:** Wer im letzten Vertragsjahr steht, darf ab dem 1. Januar mit anderen Vereinen verhandeln. Der Sportdirektor nennt zum Jahreswechsel alle Betroffenen im eigenen Kader. Fragt ein Verein bei einem eigenen Spieler an (bei Leistungsträgern häufiger), steht das im Postfach und in der Akte; der Spieler entscheidet sich nach zehn Tagen – eher für einen größeren Verein, eher, wenn er unzufrieden ist – und fordert in der Zwischenzeit mehr Gehalt. Wer verlängert, bleibt. Umgekehrt lässt sich jedem Spieler mit auslaufendem Vertrag aus der Akte ein Vorvertrag anbieten, auch bei geschlossenem Fenster: Verhandelt wird nur mit dem Berater, ohne Ablöse, mit höherem Handgeld; gewechselt wird zum Saisonwechsel zu den vereinbarten Konditionen. Wer unterschrieben hat, wird nicht mehr verkauft, verliehen oder verlängert. Vorher konnte man eine Verlängerung bis Mai liegen lassen, und fremde Spieler gab es ablösefrei erst, wenn sie schon vereinslos waren.
- **Der eigene Kader wird nicht mehr still gekürzt:** Beim Saisonwechsel bekamen auch volle Kader Nachwuchs, und dafür musste der schwächste Überzählige gehen – beim eigenen Verein oft ein Routinier, den der Manager gerade verlängert hatte. Der eigene Verein ist davon jetzt ausgenommen; seine Talente kommen aus der eigenen Akademie. Und kein Verein setzt mehr jemanden vor die Tür, den er in derselben Saison erst geholt hat – vorher wurde etwa ein Routinier, der per Vorvertrag kam, am selben Tag wieder aussortiert.
- **Scouting-Zentrale (`ScoutingEngine`):** Scouts für gezielte Positionen, Altersklassen und Mindeststärken entsenden und detaillierte Spielerberichte erhalten.
- **Spieler beobachten statt Sofortbericht:** *Scouten* (Transfermarkt, Spielerakte, Gegneranalyse) schickt den Scout los. Der ausführliche Bericht kommt nach einigen Tagen ins Postfach, erst dann wächst das Wissen. Er enthält Stärke, Potenzial, Rolle, Stärken, Schwächen, Charakter, Kaderrolle, Empfehlung und Verlässlichkeit, dazu Knöpfe zur Akte und zum Angebot. Wie lange es dauert:

  | Wo spielt er? | Dauer (Beispiel) |
  |---|---|
  | eigene Liga | 3 bis 6 Tage |
  | andere Liga im eigenen Land | etwa 1 bis 2 Wochen |
  | Ausland | etwa 2 Wochen |
  | weit außerhalb der eigenen Reichweite | bis 4 Wochen |

  Ein guter Chefscout ist schneller, bei Gegnern aus der Spielvorbereitung geht es schneller, und jede laufende Beobachtung verlängert die nächste. Höchstens fünf Spieler sind gleichzeitig in Beobachtung. Laufende Beobachtungen stehen im Transfermarkt unter den Scouting-Aufträgen.
- **Berichte so gut wie der Scout:** Wer den Bericht schreibt, entscheidet über seinen Inhalt – der eigene Chefscout aus dem Trainerstab oder, solange der Posten offen ist, eine Aushilfe. Die Sterne des Scouts wirken so:

  | Scout | Was im Bericht steht |
  |---|---|
  | ★ bis ★★ | Grobe Eindrücke: eine Stärke, eine Schwäche. Er verschätzt sich um bis zu eine Sternhälfte, das Potenzial junger Spieler kann er kaum einschätzen. |
  | ★★★ | Zwei bis drei Stärken und Schwächen, Einordnung in den eigenen Kader („wäre bei uns Stammspieler“), erste Hinweise zum Charakter. |
  | ★★★★ und mehr | Bis zu vier Stärken und drei Schwächen, Charakter, Verletzungsanfälligkeit, Loyalität, Nebenrolle und eine kaum verzerrte Schätzung. |

  Jeder Bericht zeigt, wie verlässlich er ist. Die Empfehlung folgt der Schätzung des Scouts, nicht den wahren Werten. Ein guter Scout bringt von einem Auftrag bis zu vier Berichte mit und hält sich an die verlangte Mindeststärke, ein schwacher liegt dabei auch mal daneben.
- **KI-Manager (`AIManagerEngine`):** KI-Vereine optimieren vor jedem Spieltag ihre Aufstellung und unterbreiten Angebote für deine Stars.
- **Angebote für eigene Spieler – nicht zu übersehen:** Ein neues Angebot springt nach dem Weiterklicken auf seine eigene Seite und steht oben auf dem Schreibtisch. Im Transfermarkt erscheint es als Karte mit Frist, Verhältnis zum Marktwert und den Knöpfen *Annehmen*, *Zum Angebot* und *Ablehnen*:
  - **Annehmen:** Der Spieler wechselt sofort.
  - **Mehr fordern:** Einmal möglich, auf der Seite des Angebots. Der Käufer geht mit, bessert bis zu seiner Grenze nach oder zieht bei einer maßlosen Forderung zurück.
  - **Ablehnen.**
- **Das Transferangebot als eigene Seite wie im Vorbild (`uiAngebot.js`):** Vorher kam ein Angebot als kleines Fenster mit der Karte aus dem Transfermarkt. Jetzt hat es eine eigene Seite wie das Spielerprofil, mit Zurück über den Verlauf (`uiSeiten.js`).
  - **Wege dorthin:** beim Eingang nach *Weiter*, *Zum Angebot* im Postfach, der Punkt auf dem Schreibtisch, *Ansehen* in der Meldung beim Anhalten und *Zum Angebot* auf der Karte im Transfermarkt. Von dort steht der Cursor gleich im Feld für die Forderung.
  - **Kopf:** der Käufer mit Wappen, der Spieler (ein Tipp öffnet sein Profil), die Ablöse in groß mit dem Verhältnis zum Marktwert und die Frist (*Antwort erwartet · bis 25.08. · noch 4 Tage*, zwei Tage vorher *Dringend*).
  - **Das Angebot:** Ablöse, Marktwert mit Balken (die Marke steht bei 100 %), Zahlweise mit Raten, das Gehalt beim Käufer neben dem heutigen und die Weiterverkaufsbeteiligung.
  - **Der Spieler:** Nummer, Position, Alter, Sterne, Rolle, Vertragsende und Saison. Darunter steht, wer auf seiner Position bleibt (die drei Besten des Mannschaftsteils, gleiche Position zuerst). Steht dort niemand mehr, sagt die Seite das.
  - **Was der Verkauf bringt:** Kasse und Transferbudget vorher und nachher (85 % des sofort fälligen Erlöses), bei Raten die Anzahlung und die Monatsraten, dazu das frei werdende Gehalt. Wer die Weiterverkaufsbeteiligung wählt, sieht die Zahlen gleich mit der kleineren Ablöse.
  - **Der Käufer:** Liga, Tabellenplatz, Ruf neben dem eigenen und ein Knopf zur Vereinsseite.
  - **Ihre Entscheidung:** Forderung mit Schnellwahl (+10, +20, +30 %), *Annehmen* mit dem Betrag, *Mehr fordern*, *Ablehnen*, *Später entscheiden*.
  - **Danach** bleibt die Seite offen und zeigt den Ausgang: *Angenommen*, *Abgelehnt*, *Verfallen* oder *Zurückgezogen*. Hat der Käufer nachgebessert, steht seine Antwort oben.
  - **Weitere offene Angebote** stehen unten und führen jeweils auf ihre Seite.

  Ein Angebot gilt vier Tage. Wer nicht antwortet, hat abgelehnt.
- **Angebote für eigene Spieler** kommen nur noch auf einem Weg: mit Frist, verdeckter Obergrenze und Zahlweise. Ein zweiter, älterer Weg legte Angebote ohne Frist ab, bei denen man nicht mehr fordern konnte. Solche Angebote aus alten Spielständen bekommen beim Laden die übliche Frist. Wer an einen KI-Verein verkauft wird, verdient dort ein Fünftel mehr als bisher, mit einer Laufzeit nach Alter. Vorher bekam jeder pauschal 50.000 € pro Woche.
  - **Auch in unteren Ligen:** Begehrt sind die sechs Besten jedes Kaders (`TransferEngine.BEGEHRT_AB_RANG`), dazu wie bisher jeder ab Stärke 74 und wer auf der Transferliste steht. Vorher galt nur die feste Stärke von 74: Im Durchklick-Test bekam ein Drittligist in über einer Saison kein einziges Angebot. Bieten dürfen nur Vereine, die mindestens ähnlich groß sind (Ruf höchstens 5 darunter, für Spieler auf der Transferliste 15). Vorher konnte jeder Verein der Welt mit genug Geld bieten.
- **Weiterverkaufsbeteiligung:** Beim Annehmen eines Angebots lassen sich 10 oder 20 % an einem späteren Weiterverkauf vereinbaren. Der Käufer zahlt dafür jetzt 5 bzw. 10 % weniger. Wechselt der Spieler später für eine Ablöse weiter, fließt der Anteil zurück.
- **Ablöse in Raten:** Im Ablöse-Angebot wählt man die Zahlweise.
  - **Sofort**, **12 Monate** (50 % Anzahlung) oder **24 Monate** (35 % Anzahlung). Den Rest zahlt der Käufer am Monatsersten in gleichen Raten.
  - Ins Transferbudget muss nur die Anzahlung passen. Alle offenen Raten zusammen müssen aber auf dem Konto gedeckt sein. Gezahlte Raten gehen auch vom Transferbudget ab.
  - Der Verkäufer rechnet mit Abschlag: Für ihn sind 12 Monatsraten rund 4 % weniger wert, 24 rund 10 %. Braucht er das Geld dringend, ist der Abschlag größer. Die Eingabe zeigt gleich Anzahlung, Rate und was das Angebot dem Verkäufer wert ist. Eine Gegenforderung nennt auch die Summe in Raten.
  - Auch KI-Vereine bieten für eigene Spieler in Raten, vor allem mit knapper Kasse, und legen dafür 4 bzw. 8 % drauf.
  - Die Finanzen zeigen, was der Verein noch schuldet und was ihm zusteht, und was am nächsten Monatsersten fällig wird.
- **Ausstiegsklauseln:** Bei einer Vertragsverlängerung lässt sich eine Klausel über das 1,5-, 2,5- oder 4-fache des Marktwerts vereinbaren. Je niedriger sie liegt, desto stärker sinkt die Gehaltsforderung (bis zu 10 %). Dafür kann jeder Verein, der die Summe zahlt, den Spieler holen – ablehnen geht nicht. Gut jeder fünfte Spieler anderer Vereine hat eine Klausel. Sie steht in der Akte und lässt sich dort ziehen, sofern der Spieler den Schritt zu Ihnen machen will.
- **Weitere Vertragsklauseln (`KlauselEngine`):** In der Verhandlung mit einem Neuzugang und bei der Verlängerung lassen sich unter „Weitere Klauseln“ vereinbaren:
  - **Gehaltssteigerung** um 5 oder 10 % in jeder weiteren Saison. Dafür nimmt der Spieler ein niedrigeres Startgehalt, über die Laufzeit gerechnet etwa gleich viel.
  - **Bei Abstieg** 30 % weniger Gehalt (dafür will er etwas mehr) oder ein ablösefreier Abgang (das gefällt ihm).
  - **Bei Aufstieg** 10 oder 25 % mehr Gehalt (ab der zweiten Liga). Er rechnet mit einem Aufstieg in jeder vierten Saison.
  - **Mindestablöse:** Für diesen Betrag darf ihn ein höherklassiger Verein aus dem eigenen Land holen. Liegt sie nicht deutlich über seinem Marktwert, greift im offenen Fenster bald einer zu.
  - **Vereinsoption:** Im letzten Vertragsjahr verlängert der Verein in der Akte um ein Jahr, ohne den Spieler zu fragen. Das mag er nicht und will dafür mehr Gehalt.
  - Was die Klauseln dem Spieler wert sind, steht gleich darunter und geht in die Gehaltsforderung ein. Zum Saisonwechsel greifen Steigerung, Auf- und Abstiegsklausel, das Postfach meldet die Änderungen. In der Akte stehen die Klauseln unter dem Vertrag. Mit einem Wechsel verfallen sie.
- **Laufbahn (`LaufbahnEngine`):** In der Akte steht unter den Werten die Laufbahn Saison für Saison: Verein, Spiele, Tore, Vorlagen, Note, dazu die laufende Saison und die Summe.
  - Zum Saisonende bekommt jeder Spieler mit Einsätzen eine Zeile. Vorher gingen die Saisonwerte mit dem Saisonwechsel verloren.
  - Wechselt einer unter dem Jahr den Verein (Transfer oder Leihe), gehört der Stand bis dahin dem alten Verein. Beide stehen in der Laufbahn.
  - Gespeichert werden die letzten zwölf Zeilen je Spieler, rund 165 KB je Saison im Spielstand.
  - Nebenbei behoben: Die Vereinsakte zeigt den Torjäger jetzt. Sie las ein Feld, das es nicht gab, und zeigte ihn deshalb nie.
- **Leihgeschäfte (`LoanEngine`, Unterreiter *Leihen*):**
  - *Verleihen wie im Vorbild:* In der Akte setzt man einen eigenen Spieler mit Bedingungen auf die Leihliste.
    - Die Bedingungen: Gehaltsanteil mindestens (egal, 50, 75 oder 100 %), Einsatz dort (Stammspieler, mindestens Rotation oder egal), Dauer bis zum Saisonende oder (im Sommer) bis zur Winterpause, Rückholrecht ja oder nein.
    - In den Tagen danach melden sich Vereine bis zwei Ligen tiefer, bei denen er so spielen würde, etwa jeden dritten Tag einer, höchstens drei zugleich. Jedes Angebot nennt Rolle, Gehaltsanteil, eine Leihgebühr für einen, der sofort spielt, manchmal eine Kaufoption, und gilt drei Tage. Mit Rückholrecht bieten die Vereine etwas weniger.
    - *Annehmen*, *Mehr fordern* (einmal: bis zur verborgenen Grenze geht der Verein mit, knapp darüber bessert er nach, weit darüber zieht er zurück) oder *Ablehnen*. Die Angebote stehen im Unterreiter *Leihen*, in der Akte und auf dem Schreibtisch.
    - Nach dem Annehmen entscheidet der Spieler über Nacht. Als Stammspieler geht er fast immer, ein sehr Ehrgeiziger aber nicht zwei Ligen tiefer. Als Ergänzungsspieler sagt der Ehrgeizige eher ab, je tiefer die Liga, desto eher.
    - Am Deadline Day kommen Angebote und Antwort sofort. Schließt das Fenster, ist die Leihliste leer.
    - Zurückholen geht nur mit vereinbartem Rückholrecht. Vorher war ein Spieler mit einem Tipp sofort verliehen und jederzeit zurückzuholen.
  - *Dauer und Rückholrecht:* Eine Leihe bis zur Winterpause endet mit dem Winterfenster. Ein Stammverein mit Rückholrecht holt seinen Spieler im Winter zurück, wenn er als Stammspieler kaum spielt. Beim Ausleihen verlangt der Stammverein für Spieler bis 23 ein Rückholrecht, ohne muss das Angebot höher sein. Bis zur Winterpause kostet die halbe Leihgebühr.
  - *Ausleihen:* Der Leihmarkt zeigt junge Spieler ohne Stammplatz und Reservisten anderer Vereine. *Anfragen* eröffnet eine Verhandlung mit dem Stammverein, wie bei einem Transfer:
    - Er fordert einen Gehaltsanteil, bei starken Spielern eine Leihgebühr und eine Einsatzzusage. Wer bei uns Stammspieler wäre, will das zugesagt bekommen.
    - Man bietet Anteil, Gebühr, Einsatzzusage und auf Wunsch die Kaufoption. Die Antwort kommt nach ein bis drei Tagen: Zusage, Gegenforderung oder Abbruch.
    - Weniger Einsatz als verlangt geht nicht, auch nicht mit mehr Geld. Zu niedrige Angebote kosten Geduld.
    - Spielt ein zugesagter Stammspieler nicht, meldet sich sein Verein. Vorher war ein Spieler mit einem Tipp sofort ausgeliehen.
  - Einmal im Monat kommt ein Leihbericht ins Postfach. Zum Saisonende kehren alle zurück. Verliehene Spieler stehen unter der Kadertabelle, werden nicht verkauft und kosten beide Vereine anteilig Gehalt.

- **Kaderplanung über drei Spielzeiten (`KaderplanungEngine`):** Die aufklappbare Karte unter der Kadertabelle zeigt je Mannschaftsteil (Tor, Innenverteidigung, Außenverteidigung, zentrales Mittelfeld, Offensive und Flügel, Sturm), wer in dieser, der nächsten und der übernächsten Saison noch da ist.
  - **Wer wegfällt:** Spieler mit auslaufendem Vertrag, wer mit 35 wahrscheinlich aufhört, wer per Vorvertrag woanders unterschrieben hat und wer nur geliehen ist.
  - **Wer dazukommt:** Leihrückkehrer und Zugänge mit Vorvertrag.
  - **Gemessen am Kaderplan der Liga:** Eine „Lücke“ hat weniger Spieler als nötig. „Dünn“ heißt: genug Spieler, aber zu wenige auf Stammspieler-Niveau (drei Sterne nach dem eingestellten Maßstab).
  - **Baustellen:** Der Sportdirektor nennt die dringendsten, die früheste Saison zuerst („Nächste Saison fehlen Spieler im Tor: 2 von 3 – Manuel Neuerer geht“). Jede lässt sich als Suchauftrag losschicken, für die Position, ab Stammspieler-Niveau und bis 27 Jahre.

### 4a. 🎯 Der Sportdirektor (`SportdirektorEngine`)
Der Verein hat einen Sportdirektor mit festem Namen. Er kennt den Kader nach Mannschaftsteilen (Tor, Innen- und Außenverteidigung, defensives und zentrales Mittelfeld, Flügel, Sturm) und sieht dort Bedarf, wo der Beste unter dem Kaderniveau liegt, wo Spieler fehlen oder der Stammspieler 32 oder älter ist.

- **Alle zwei Wochen drei Vorschläge im Postfach:** Spieler, die der Verein erreichen (Marktreichweite) und bezahlen kann (Ablöse im Transferbudget), höchstens einer je Verein und höchstens zwei je Mannschaftsteil. Jeder mit einer Begründung („Würde in der Innenverteidigung sofort spielen – nach meiner Einschätzung stärker als …“, Ablöse, erwartetes Gehalt) und den Knöpfen *Akte* und *Verhandeln*. Wer schon vorgeschlagen war, kommt acht Wochen lang nicht wieder.
- **Beratung im Transfermarkt (Reiter *Sportdirektor*):** Position oder „nach Bedarf“, Rolle (*Sofort Stammspieler*, *Kaderbreite*, *Talent mit Zukunft*), Höchstalter und Ablöserahmen bis hin zu „nur ablösefrei“ – er antwortet mit bis zu fünf Namen, oder sagt ehrlich, dass er niemanden findet. *Als Suchauftrag merken* richtet seine regelmäßigen Vorschläge danach aus; gibt der Auftrag gerade nichts her, sagt er das und schlägt vor, was dem Kader fehlt.
- **So gut wie der Chefscout:** Bei der Stärke fremder Spieler liegt er mit einem schwachen Chefscout bis zu vier Punkte daneben, mit einem sehr guten praktisch gar nicht.

### 4b. 🤝 Verhandlungen mit Vereinen und Beratern (`NegotiationEngine`)
Ein Transfer ist kein Knopfdruck mehr, sondern ein Vorgang über mehrere Tage:

1. **Ablöse** – Sie eröffnen mit einem Gebot, der abgebende Verein antwortet nach ein bis drei Tagen mit Zusage oder Gegenforderung.
2. **Persönliche Konditionen** – Der Berater verhandelt über Wochengehalt, Laufzeit und Handgeld.
3. **Medizincheck** – Zwei Tage später steht fest, ob der Wechsel hält. Verletzungsanfällige Spieler fallen hier durch.

- **Berater mit Charakter:** Fünf Profile von *Unerfahren* bis *Lautstark* bestimmen, wie hoch gefordert, wie schnell geantwortet und wie viel Geduld mitgebracht wird. Ein Spieler behält seinen Berater über die Jahre.
- **Geduld und Frist:** Jedes zu niedrige Gebot kostet Geduld. Bei 0 % oder nach 14 Tagen platzen die Gespräche. Ein Angebot unter 60 % der Forderung beendet sie sofort.
- **Die Gegenseite bewegt sich:** Mit jeder Runde gibt sie ein Stück nach – wer hart, aber fair verhandelt, spart Millionen.
- **Alles im Blick:** Der Reiter *Transfermarkt* zeigt jede laufende Verhandlung mit Phase, aktueller Forderung, Restgeduld, Frist und dem letzten Satz der Gegenseite, auch Leihen und Talente anderer Akademien. Am Deadline Day steht dort statt der Frist der Hinweis, dass heute Abend Schluss ist.

### 5. 🏋️ Training & Jugendakademie
- **Zwei Reiter:** *Training* zeigt Trainerstab, Trainingslager, Schwerpunkt und Intensität, Trainingsbericht und die individuellen Pläne. Alles zum Nachwuchs steht im eigenen Reiter *Jugend*, gleich darunter in der Seitenleiste und im Menü am Handy:
  - die Akademie mit Stufe, Plätzen, Jugendtag, Probetrainings, Sichtungstag und Jugendvorschau
  - die Talente der Akademie mit Jugendvertrag, Werbern und Knöpfen
  - Talente anderer Akademien und die Schwerpunkte für den nächsten Jahrgang, auf breiten Bildschirmen nebeneinander
  - die U19-Liga
  - oben eine Übersicht des Nachwuchses: U23 (Spieler, Tabellenplatz), U19, Akademie und verliehene Talente bis 23, ein Tipp springt zur Karte
  - die zweite Mannschaft (U23) mit Liga, letzten Spielen, Torjägern und Kader (Spiele, Tore, Schnitt, Form, Praxis, *Spieltag*, *Ganz hoch*), darunter junge Profis bis 23 ohne Platz in der Elf mit *In die U23*
  - die verliehenen Talente bis 23 mit Verein, Liga, Spielpraxis, Leihende und Rückholrecht

  Vorher stand das alles unten im Reiter Training, und für die Akademie musste man an Trainingsbericht und Plänen vorbei weit scrollen. Wirbt ein Verein um ein Talent, zeigt der Reiter die Zahl der offenen Anfragen. Post der Nachwuchsabteilung hat im Postfach die Kategorie *Nachwuchs*, einen eigenen Filter und den Knopf *Zur Jugend*.
- **Trainingsschwerpunkte:** Allround, Angriff, Defensive, Technik, Taktik, Regeneration, Jugendförderung.
- **Nachwuchsakademie (`YouthEngine`):** Akademie-Ausbau (Stufe 1 bis 5) für stärkere Talente und direkte Beförderung von Jugendspielern mit Profi-Vertrag in die 1. Mannschaft.
- **Jugendtag:** Einmal je Saison, im Frühjahr um den Spieltag bei 70 % der Saison (34 Spieltage: der 24.), stellt sich der neue Jahrgang vor. Drei Spieltage vorher kündigt der Nachwuchsleiter ihn im Postfach an und schätzt ein, wie gut er wird. Am Jugendtag selbst kommt eine Nachricht mit allen Namen.
- **Jugendvorschau:** Zur Ankündigung ist der Jahrgang schon gesichtet, und am Jugendtag kommen genau diese Talente.
  - Der Nachwuchsleiter beschreibt ihn: goldener, guter, ordentlicher oder schwacher Jahrgang, die Positionen und der Vielversprechendste („ein echtes Ausnahmetalent“).
  - Gemessen wird an dem, was die eigene Akademie üblicherweise hervorbringt. Mit einem ligaüblichen Nachwuchsleiter sind etwa 5–10 % der Jahrgänge golden und 35–45 % gut.
  - Ein guter Nachwuchsleiter schätzt genau. Ein schwacher oder die Aushilfe ohne Nachwuchsleiter irrt sich spürbar und sagt das auch.
  - Die Vorschau steht in der Akademie-Karte im Reiter *Jugend*. Wer bis zum Jugendtag die Schwerpunkte ändert, lässt neu sichten.
  - Die Sichtungskosten fallen erst am Jugendtag an.
- **Befördert ist befördert:** Die Talente des eigenen Vereins stehen in genau einer Liste. Vorher waren es nach dem Laden zwei Kopien: Ein beförderter Spieler blieb in der Akademie stehen und ließ sich ein zweites Mal befördern.
- **Schwerpunkte der Akademie:** Im Reiter *Jugend* lassen sich vier Dinge einstellen. Alles wirkt auf den nächsten Jahrgang am Jugendtag.

  | Schwerpunkt | Auswahl | Wirkung |
  |---|---|---|
  | **Ausbildung** | Technik, Athletik, Spielintelligenz, Zweikampf, ausgewogen | prägt, wie die Talente spielen; einmal je Saison änderbar |
  | **Positionen** | bis zu zwei aus Torhüter, Abwehr, Mittelfeld, Angriff | kommen deutlich häufiger nach |
  | **Jahrgang** | Breite, ausgewogen, Spitze | fünf Talente mit etwas weniger Potenzial, drei wie gewohnt oder zwei mit deutlich mehr |
  | **Einzugsgebiet** | Region, national, international | bringt mehr Potenzial und mehr ausländische Talente, kostet je Jahrgang (kleine Ligen zahlen weniger) |

  Der Nachwuchsleiter aus dem Trainerstab entscheidet mit: Ein guter holt Potenzial heraus und lässt die Jungs schneller wachsen, ein schwacher kostet beides. Gemessen wird am üblichen Niveau des Vereins: Ein eigener Mann bringt −4 bis +5 Punkte Potenzial je Talent, die Aushilfe bei offenem Posten kostet 2.
- **Talente passen zur Liga:** Ein Jahrgang richtet sich nach der Ligastufe des Vereins. In der Landesliga kommen Landesliga-Talente, in der 1. Liga Erstliga-Talente. Überall haben sie heute 0,5 bis 2,5 Sterne und im Schnitt 3 bis 4 Sterne Potenzial. Fünf Sterne gibt es nur mit guten Schwerpunkten, einem guten Nachwuchsleiter und etwas Glück.
- **Verletzungen & Sperren:** Realistische Ausfallzeiten (Leicht/Mittel/Schwer) und Gelb-/Rotsperren.

### 5a. 📈 Entwicklungsplan (`DevelopmentPlanEngine`)
Jeder eigene Spieler hat in seiner Akte einen Entwicklungsplan. Der Trainings-Reiter zeigt alle Pläne und die Spielpraxis der jungen Spieler.
- **Spielpraxis:** Ein gleitender Wert, wie viel der möglichen Minuten ein Spieler zuletzt gespielt hat – für jeden Spieler aller Vereine. Ein Talent bis 23 entwickelt sich mit regelmäßigen Einsätzen um gut ein Viertel schneller als im Schnitt, ohne Einsätze langsamer. Bis 28 zählt es ein wenig, danach nicht mehr. Genau dafür gibt es Leihen.
- **Eigener Trainingsschwerpunkt:** Abschluss, Passspiel, Zweikampf, Schnelligkeit, Dribbling, Kopfball (Torhüter: Reflexe, Herauslaufen). Wächst der Spieler, wachsen diese Werte mit. Die Zusatzschichten kosten etwas Kraft.
- **Umschulung:** Eine neue Position lernen, Einheit für Einheit. Wie schnell, hängt an der Anpassungsfähigkeit und daran, wie verwandt die Position ist. Ist sie gelernt, kommt eine Nachricht.
- **Mentor:** Ein Spieler ab 25 betreut bis zu drei Spieler bis 23. Seine Einstellung färbt ab: Professionalität, Ehrgeiz, Temperament, Nerven und Beständigkeit wandern langsam in seine Richtung. Mit etwas Glück schaut sich der junge Spieler eine Eigenheit ab – sofern sie zu seinen Werten passt. Ein guter Mentor beschleunigt die Entwicklung leicht.
- **Eigenheit antrainieren oder ablegen:** Im Plan wählt man eine Eigenheit, die zu Position und Werten passt (bis sechs Punkte unter der Voraussetzung geht es auch, nur mühsamer), oder eine, die er ablegen soll – etwa die Distanzschüsse, wenn sie nicht zur Taktik passen. Torhüter lernen nur Torwartsachen; mehr als drei Eigenheiten nimmt keiner an.
  - Ein durchschnittlicher Spieler braucht rund drei Monate. Junge, professionelle und anpassungsfähige Spieler schaffen es schneller, mit Anfang dreißig dauert es fast doppelt so lange. Ein guter Trainerstab hilft, ein Mentor, der die Eigenheit selbst hat, macht sie vor (30 % schneller).
  - Die Auswahl schätzt die Wochen, die Akte und der Trainings-Reiter zeigen den Stand. Ist es geschafft, meldet sich der Trainerstab. Die Extraschichten kosten etwas Kraft, ein Wechsel fängt von vorn an.

### 5b. 📋 Trainingsbericht: Belastung, Ermüdung und Risiko
Das Training läuft **Tag für Tag** über den Kalender statt im Wochenblock. Zwischen den Spieltagen zeigt der Trainingsbericht für jeden Spieler:

| Wert | Bedeutung |
|---|---|
| **Fitness / Ermüdung** | Wie frisch der Spieler ist. Ermüdung erhöht Belastung *und* Risiko. |
| **Tageslast** | Was die nächste Einheit kostet – abhängig von Intensität, Alter, Ausdauer und aktueller Ermüdung. |
| **Spielschärfe** | Steigt nur durch Einsatzminuten, sinkt auf der Bank und im Training. |
| **Verletzungsrisiko** | Prozentwert für die nächste Einheit. Der Bericht ist danach sortiert – die Wackelkandidaten stehen oben. |
| **Entwicklung** | Was der Spieler in den letzten Einheiten an Gesamtstärke gewonnen hat. |

Die Intensität ist eine echte Abwägung: Über Wochen pendelt sich die Kaderfitness bei *Schonend* auf rund 99 %, bei *Standard* auf 95 % und bei *Vollgas* auf etwa 72 % ein – dafür entwickeln sich die Spieler schneller. Ein Spieltag kostet deutlich mehr Substanz als jede Trainingseinheit.

#### 📈 Monatlicher Entwicklungsbericht
Zu jedem Monatswechsel schickt der Co-Trainer einen Bericht ins Postfach (Kategorie Training): wer seit dem letzten Monatsersten besser geworden ist und wer nachgelassen hat – je Spieler Stärke vorher und nachher und die bis zu drei Werte, die sich am meisten bewegt haben, bei Verletzten und Spielern ab 30 mit dem Grund. Dazu die Talente der Akademie. Ein Tipp auf einen Namen öffnet die Akte. Vorher sah man Fortschritte nur, wenn man jede Akte einzeln aufschlug.

### 5c. 🎓 Nachwuchs: Beförderung über den Berater
Ein Talent in den Profikader zu holen dauert jetzt seine Zeit. *Profivertrag anbieten* startet die Verhandlung mit dem Berater über Gehalt, Laufzeit und Handgeld; erst nach der Einigung – meist drei bis sechs Tage – unterschreibt der Spieler seinen ersten Profivertrag und taucht im Kader auf. Die Forderung richtet sich nach Potenzial und Ligastufe.

- **Talente kommen öfter und auf mehr Wegen:** Neben dem Jugendtag im Frühjahr meldet der Nachwuchsleiter unter dem Jahr immer wieder ein einzelnes Talent, das im Probetraining überzeugt hat – in der Grundausstattung etwa dreimal je Saison, mit ausgebauter Akademie, gutem Nachwuchsleiter und weltweitem Sichtungsnetz bis rund neunmal. Wer gezielt suchen will, setzt im Reiter Jugend selbst einen *Sichtungstag* an: ein bis zwei Talente gegen eine Gebühr nach Ligastufe (50.000 € in der 1. Liga, 1.500 € in der untersten Liga), danach sechs Wochen Pause. Die Herkunft steht als Marke am Namen.
- **Akademie mit Plätzen:** Platz für 8 Talente und 2 je Ausbaustufe; ist sie voll, kommt niemand mehr dazu. Ein Talent lässt sich *freigeben*. Zum Saisonwechsel werden die Talente ein Jahr älter, mit 19 ist ohne Profivertrag Schluss – vorher blieben sie für immer 15 bis 17 Jahre alt und für immer in der Akademie. Wer geht, steht danach vereinslos auf dem Markt (5e).
- Am Handy steht jedes Talent als Karte da statt als Tabellenzeile mit zerquetschten Spalten.

### 5d. 🎓 Nachwuchs wie im Vorbild: Jugendvertrag, Abwerben, Ausbildungsentschädigung
Bisher stand ein Talent ohne Vertrag in der Akademie, ließ sich in jedem Alter zum Profi machen, und niemand sonst interessierte sich für ihn. Jetzt läuft der Nachwuchs wie im Vorbild:

- **Jugendvertrag:** Jedes Talent hat einen Jugendvertrag bis 19 mit einer Ausbildungsvergütung je Woche (600 € in der 1. Liga, 20 € in der Landesliga; im Buchungsjournal als eigener Posten).
- **Profivertrag ab Mindestalter:** Den ersten Profivertrag darf ein Talent erst ab 16 unterschreiben, in England ab 17. Als Minderjähriger unterschreibt jeder höchstens drei Jahre - nach der Regel des Weltverbands auch bei Verlängerungen und Wechseln.
- **Abwerben:** Größere Vereine (mindestens 4 Punkte mehr Ruf) werben um die Besten der Akademie, die noch keinen Profivertrag haben - je besser das Talent für diese Akademie, desto öfter; bei einer guten Erstliga-Akademie ein- bis zweimal je Saison. Aus dem Ausland werben nur Erstligisten, und Minderjährige dürfen wie in Wirklichkeit nur im eigenen Land wechseln, mit 16 und 17 auch innerhalb der EU (England, Schottland, die Türkei und Brasilien gehören nicht dazu). Der Verein hat sieben Tage: Ein Profivertrag bindet das Talent, ein Gespräch über seine Perspektive kann ihn halten (einmal je Anfrage), oder man lässt ihn sofort ziehen. Sonst entscheidet er nach Ehrgeiz, Treue und Abstand der Vereine. Die Frist steht auf dem Schreibtisch, die Zahl der offenen Anfragen am Reiter *Jugend*.
- **Ausbildungsentschädigung:** Wer ein Talent ohne Profivertrag holt, zahlt dem Ausbilder je Ausbildungsjahr einen Betrag nach dessen Ligastufe (150.000 € in der 1. Liga bis 2.500 € in der Landesliga; die Länder im Hintergrund zählen wie die Kategorien des Weltverbands eine Stufe tiefer), für ein großes Talent bis zum 3,25-Fachen.
- **Talente anderer Akademien:** Die Nachwuchsabteilung hat je Saison vier Jugendliche kleinerer Vereine im Blick, drei von vier aus dem eigenen Land. Ihr Potenzial kennt man nur aus der Einschätzung des Nachwuchsleiters. *Anfragen* eröffnet eine Verhandlung in zwei Schritten:
  - Erst die Ausbildungsentschädigung mit seinem Verein, mit Gegenforderung wie bei einer Ablöse.
  - Dann entscheidet die Familie nach unserem Ruf gegenüber seinem Verein, nach Ehrgeiz und Treue des Talents. Zögert sie, nennt sie das Handgeld, das sie überzeugt. Die Zusage, mit den Profis zu trainieren (ab 16), hilft ebenso. Holt ihn auch das Doppelte nicht, bleibt er.
  - Vorher entschied ein Tipp auf *Holen* sofort per Zufall.
- **Entwicklung:** Talente haben eine Persönlichkeit (fest je Talent, ein guter Nachwuchsleiter zieht professionellere Jungs heran). Wie schnell sie wachsen, hängt neben Akademie und Nachwuchsleiter an Professionalität und Ehrgeiz, an den Einsätzen in der U19 und am Training: Bis zu drei Talente ab 16 können mit den Profis trainieren, ohne befördert zu sein, und wachsen dann ein Fünftel schneller. Wer befördert wird, nimmt seine Persönlichkeit mit.
- **Kaderrollen nach Rang (`PlayerGenerator.verteileKaderrollen`):** Die beste Elf aus einem Torwart und zehn Feldspielern spielt, ihre vier Stärksten sind Schlüsselspieler, die übrigen sieben Stammspieler. Dahinter kommen sechs Rotationsspieler, der Rest ergänzt, Junge mit Luft nach oben als Zukunftstalent. Ersatztorhüter rechnen nicht mit Spielzeit.
  - Vorher bekamen die vorgegebenen Kader der ersten Liga ihre Rolle nach festen Schwellen (ab 84 Schlüssel-, ab 78 Stammspieler): im Schnitt 6,5 Schlüssel- und 10,6 Stammspieler je Verein, kein einziger Ergänzungsspieler. Torhüter zählten überall wie Feldspieler: Freiburg hatte drei Torhüter als Schlüssel-, Stamm- und Rotationsspieler.
  - Neuzugänge bekommen die Rolle ihres Rangs im neuen Kader (`PlayerGenerator.rolleImKader`). Vorher blieb der Schlüsselspieler eines Drittligisten auch als Ersatzmann beim Spitzenklub Schlüsselspieler.
  - Die KI-Vereine ordnen ihre Rollen zu jeder neuen Saison neu (`GameState.ordneKaderrollen`). Ältere Spielstände gleichen sie beim Laden einmal an. Im eigenen Verein bleiben die Rollen, wie sie sind, denn sie sind Zusagen an die Spieler.
  - Ein Angebot für einen eigenen Spieler kommt nur von einem Verein, der ihn auch verpflichten darf. Vorher bot etwa ein englischer Klub für einen Ergänzungsspieler ohne Aussicht auf eine Arbeitserlaubnis. Nahm man an, scheiterte der Wechsel erst danach.
- **Spielzeit nach Rolle (`DressingRoomEngine.spielzeitDelta`):** Ohne Einsatz verlor bisher jeder gleich viel Zufriedenheit mit der Spielzeit. Ein Ergänzungsspieler, der nie mit Einsätzen gerechnet hatte, war zur Saisonmitte so unzufrieden wie ein Schlüsselspieler. Jetzt zählt, was die Rolle verspricht: Stamm- und Schlüsselspieler verlieren ohne Einsatz wie bisher, ein Rotationsspieler gut ein Drittel davon, ein Ergänzungsspieler ein Siebtel. Eine Einwechslung freut einen Rotations- oder Ergänzungsspieler. Gemessen mit Freiburg zur Saisonmitte: Zufriedenheit 77 statt 65, Moral 64 statt 43.
- **Kaderstatus Toptalent:** Ein Ausnahmetalent wird als *Toptalent* befördert. Es erwartet gelegentliche Einsätze bei den Profis und murrt auf der Bank eher als ein Zukunftstalent.
- **Im Verein ausgebildet:** Im Europapokal sind acht Plätze der Liste A für lokal Ausgebildete reserviert, höchstens vier davon für Spieler, die nur im Land ausgebildet sind - die übrigen müssen im Verein ausgebildet sein (drei Saisons zwischen 15 und 21, oder aus der eigenen Jugend). Fehlen welche, schrumpft die Liste. Wer schon zum Start der Karriere im Kader stand, dessen Jugendjahre kennt das Spiel nicht: Von den Spielern mit der Nationalität des Landes gilt dann etwa jeder vierte als im Verein ausgebildet. Die Meldeliste zeigt 🎓 für im Verein und 🏠 für im Land ausgebildet.

### 5e. 🎓 Nachwuchs realistisch: Tempo, Jahrgänge, Potenzial
Gemessen über drei Saisons mit einem Spitzenklub und einem Viertligisten:

- **Wachstum wie junge Profis (`YouthEngine.WACHSTUM_JE_SAISON`, `wachstumsChance`):**
  - Bisher machte ein Talent an jedem Spieltag mit 30 bis 45 % Chance einen Schritt, also zwölf bis fünfzehn Punkte je Saison. Ein Siebzehnjähriger ging so von 55 auf 82 und stand mit 18 an seinem Potenzial. Ein gleichaltriger Profi legte 3 bis 4 Punkte zu: Wer beförderte, bremste sein Talent aus.
  - Jetzt wächst ein Talent mit viel Luft rund 6 Punkte je Saison (mit 18: 5), verteilt auf die Spieltage der eigenen Liga.
  - Akademie, Nachwuchsleiter, Persönlichkeit, U19-Einsätze und das Talent selbst bewegen das um je gut zehn Prozent. Alle zusammen kommen auf höchstens neun Punkte, mit dem Training bei den Profis auf knapp elf. Nahe am Potenzial wird es zäh wie bei den Profis.
  - Fertig ist mit 18 kaum einer: Bei einem Spitzenklub stehen die Besten dann bei 70 bis 80. Der Weg in die erste Elf führt über Einsätze, die U23 oder eine Leihe.
- **Jahrgänge:**
  - Zum Jugendtag kommen Fünfzehn- und Sechzehnjährige (60 zu 40), im Probetraining und am Sichtungstag auch mal ein Siebzehnjähriger.
  - Wer älter kommt, ist schon weiter (2,5 Punkte je Jahr). Bisher war ein Siebzehnjähriger beim Einzug so stark wie ein Fünfzehnjähriger.
  - Wer mehr Potenzial hat, ist meist auch heute schon etwas weiter.
- **Potenzial schief verteilt (`potVerteilung`):**
  - Bisher lag es gleichmäßig in einem engen Band hoch oben. An der besten Akademie eines Spitzenklubs hatte das schwächste Talent Potenzial 82, fast jedes zweite 88 und mehr.
  - Jetzt werden die meisten Profis ihrer Liga, knapp unter dem Kaderschnitt. An der besten Akademie eines Spitzenklubs liegt die Mitte bei 83, eines von zehn erreicht 91. In der 4. Liga mit mittlerer Akademie liegt die Mitte bei 53, das beste Zehntel bei 61.
  - Die Einordnung als Ausnahmetalent und die Ausbildungsentschädigung messen an derselben Verteilung.
- **Entlassene bleiben in der Welt (`alsVereinslos`):**
  - Wer mit 19 ohne Profivertrag geht, stand bisher nirgends mehr.
  - Jetzt ist er vereinslos auf dem Markt, mit der Gehaltsvorstellung für einen Verein zwei Ligen tiefer, und findet meist einen Verein weiter unten. Das kann auch ein Rivale sein.
  - Zurückholen lässt er sich über den Transfermarkt. Ausgebildet bleibt er beim alten Verein.
- **U19 als Spielpraxis für junge Profis:** Wer als Profi in die U19 geschickt wird, sammelt dort jetzt Spielpraxis, etwas weniger als in der U23. Auf ihrer Bank verliert er sie. Bisher zählte die U19 für Profis gar nicht.
- **Gegner in der U19-Liga:** Ihre Stärke entspricht jetzt einem Jahrgang mit gut zwei Jahren Ausbildung, denn eine U19 spielt mit Siebzehn- und Achtzehnjährigen. Vorher wurde jede halbwegs gefüllte eigene Akademie Meister.
- **Talente anderer Akademien** kommen ebenfalls mit ihrem Alter: Ein Sechzehnjähriger ist weiter als ein Fünfzehnjähriger.

### 6. 💼 Finanzen, Sponsoren & Buchungsjournal
- **Gehaltsdisziplin der KI-Vereine (`FinanceEngine.gehaltsDisziplin`):** Jeder Wechsel und jede Verlängerung legt beim Gehalt etwas drauf. Angeglichen wurde bisher nur bei Auf- und Abstieg.
  - Gemessen lagen die Erstligisten nach drei Saisons bei 115 % dessen, was sie tragen können.
  - Wer zum Saisonwechsel mehr als 8 % darüber liegt, kommt jetzt auf halbem Weg zurück. Der eigene Verein bleibt außen vor.
  - Über fünf Saisons bleiben die Gehälter so bei 96–104 % des Tragbaren. Der Kassen-Median der KI-Vereine wächst von 3 auf 17 Mio. €, und kaum ein Verein steht im Minus.
- **Finanzübersicht (`FinanceEngine`):** Kontostand, Transferbudget, Gehaltsetat, Ticketeinnahmen und wöchentliche Sponsorenzahlungen.
- **Finanzseite in Kacheln wie im Vorbild (`uiFinanzen.js`):** Der Reiter *Finanzen* öffnet mit acht Kacheln, die alten Karten stehen im Unterreiter *Budgets*.
  - *Übersicht*: Kontostand, Verlauf als Linie mit einem Punkt je Monatserstem (`FinanceEngine.monatsStand`, bis zu 36 Monate) und die letzten Monatsstände als Tabelle.
  - *Einnahmen* und *Ausgaben* des laufenden Monats mit den drei größten Posten, dazu der Umsatz der Saison. Jede Buchung trägt dafür ihren Monat.
  - *Finanzregeln* mit Status und Kaderkostenquote, *Schulden und Raten* mit offenen Raten, Forderungen und Baukrediten.
  - *Gehälter*: Lohnsumme gegen Budget und aufgeteilt nach Kaderrolle. Ein Klick auf eine Rolle klappt ihre Spieler mit Restvertrag und Gehalt auf, der Bestverdiener zuerst. Jeder Name öffnet das Profil.
  - *Sponsoren* nach Art mit farbigem Balken: Hauptsponsor, Fanartikel, Aktionen, Investor.
  - *Prognose* für das Ende dieser und der nächsten Saison mit Kontostand, Umsatz und Transferbudget, ab dem dritten Spieltag aus den echten Buchungen, ohne Transfers, Prämien und Investor.
- **Gehaltsbudget passend zur Gehaltsliste (`FinanceEngine.gehaltsrahmen`):** Das Budget ist, was der Verein nach seinen Einnahmen trägt, mit 10 % Spielraum, und nie weniger als die heutige Gehaltsliste plus 3 %.
  - Vorher kam das Budget aus einer festen Tabelle je Ligastufe, die Gehälter aber aus den Einnahmen. Die Gehaltsliste lag dadurch in der zweiten Liga im Schnitt bei 116 % des Budgets, in der sechsten bei 153 %, in der siebten bei 219 %. Der VfR Höchst startete bei weit über 200 %.
  - Jetzt startet ein Verein im Schnitt bei 91 % seines Budgets, keiner darüber. Steigt oder fällt er ab, folgt das Budget den Einnahmen der neuen Liga. Vorher galt pauschal das 2,2-Fache beim Aufstieg und die Hälfte beim Abstieg.
  - Nebenbei können die KI-Vereine der unteren Ligen wieder Spieler kaufen. Mit dem alten Budget lag ihre Gehaltsliste fast immer darüber.
  - Ältere Spielstände werden beim Laden einmal angeglichen. Das eigene Budget wird dabei nur angehoben, nie gekürzt.
- **Untergrenze je Liga:** Ein Spieler bekommt mindestens 120 € je Woche, in der sechsten Liga 80 €, in der siebten 50 €. Mit 120 € für jeden zahlte der kleinste Landesligist mehr Gehalt, als er tragen kann.
- **Betriebsaufwand nach echten Zuschauern:** Der Betrieb (Verwaltung, Reisen, Spieltag) richtet sich nach den Einnahmen, beim Eintritt jetzt nach dem gleitenden Schnitt der echten Heimspiele. Vorher stand dort immer ein zu 80 % gefülltes Stadion: Ein schwacher Verein vor halbleeren Rängen zahlte Kosten für Zuschauer, die nicht kamen.
- **Erfolg kostet (`FinanceEngine.ERFOLGSPRAEMIE`, `SeasonEngine.PRAEMIE_JE_STUFE`):**
  - Nach jedem Ligaspiel zahlt ein Verein seiner Mannschaft eine Siegprämie (ein Viertel der Lohnsumme eines Spieltags) oder eine Remisprämie (8 %), der Meister am Saisonende das Anderthalbfache. Im Journal steht sie als „Siegprämie (2:1 gegen …)“.
  - Im Mittel kostet das rund 11 % der Lohnsumme. Um genau so viel ist der Anteil des Betriebsaufwands an den Gehältern gesunken: Der Durchschnittsverein steht wie vorher da, wer viel gewinnt, zahlt mehr.
  - Die Tabellenprämie fällt mit der Ligastufe: oben das 0,3-Fache einer Sponsorenzahlung je Platz vor dem 14., in der 4. Liga das 0,06-Fache, in der 6. und 7. das 0,03-Fache. Vorher galt überall 0,45 - der Zweite der 7. Liga bekam 302 Tsd. €, mehr als seine ganze Mannschaft im Jahr verdiente.
  - Gemessen über eine Saison: Der stärkste Verein einer Liga legte vorher 28 bis 31 % seines Umsatzes zurück, jetzt 19 bis 22 %. Das Mittelfeld bleibt bei rund 7 bis 16 %.
- **Sponsorentag:** Der Termin bringt eine Antrittsprämie von 15 bis 30 % der Sponsorenzahlung eines Spieltags. Vorher waren es überall 50.000 bis 100.000 €, die zwar im Journal standen, aber nie auf dem Konto ankamen.
- **Gemessen über eine Saison** mit dem VfR Höchst (7. Liga, schwächster Kader): vorher von 9.600 € auf −19.500 €, jetzt von 7.400 € auf 30.200 €. Die Erstligisten stehen im Median bei +6 % statt −19 % ihres Startguthabens, die übrigen Ligen bleiben in ihrer Spanne.
- **Transaktionsjournal:** Detailliertes Buchungsjournal mit lückenloser Historie aller Einnahmen und Ausgaben.
- **Infrastruktur:** Stadion, Trainingsgelände, Jugendzentrum und medizinische Abteilung. Jede Anlage hat Stufe, Zustand und Alter. Ausbau und Sanierung brauchen Zeit, und so lange ist der Betrieb eingeschränkt.
- **Bauzeit in Kalendertagen:** Gebaut wird jeden Tag, auch in der Sommer- und der Winterpause. Vorher zählte die Bauzeit in Spieltagen, und eine Baustelle stand in den Pausen still, gerade dann, wenn kein Spiel stört.
  - Ein Erstligist braucht für den Stadionausbau rund 10 Monate, für Trainingsgelände 5, Jugendakademie 6 und Medizin 3. Sanieren geht schneller.
  - Kleinere Vereine bauen Kleineres und brauchen weniger Zeit: zweite Liga 85 %, dritte 70 %, vierte 60 %, fünfte 50 %, sechste 45 % und siebte 40 % der Erstliga-Zeit. Ein Landesligist baut sein Stadion in 4 Monaten aus, das Trainingsgelände in 2.
  - *Im Schichtbetrieb bauen:* Im Baudialog lässt sich die Bauzeit um 30 % kürzen, für 35 % der Baukosten als Aufpreis. Den Aufpreis trägt der Verein allein, die Förderung zahlt nicht mit.
  - Anlagenkarte, Schreibtisch und Kalender nennen die Restzeit in Wochen, Anlagenkarte, Schreibtisch und Baubeginn-Post auch das Datum, an dem es voraussichtlich fertig ist.
  - Laufende Bauvorhaben aus älteren Spielständen werden umgerechnet: ein Spieltag ist eine Woche.
- **Bauen nach Ligastufe:** Die Preise richten sich nach der Liga. Ein Landesligist zahlt 4 % des Erstliga-Preises, ein Drittligist 28 %. So kostet der nächste Ausbau überall ungefähr einen ähnlichen Teil der Saisoneinnahmen. Beim FC Hanau 93 kostet ein zweites Trainingsfeld jetzt knapp 40.000 € statt 1,5 Millionen.

  | Liga | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  |---|---|---|---|---|---|---|---|
  | Preis gegenüber Liga 1 | 100 % | 55 % | 28 % | 14 % | 8 % | 5,5 % | 4 % |
  | Sportstättenförderung | – | – | – | 15 % | 25 % | 30 % | 35 % |

- **Finanzierung über die Hausbank:** Reicht die Kasse nicht, zahlt man ein Viertel an und den Rest mit 6 % Zinsen in Wochenraten, mindestens über ein halbes Jahr. Ist die Anlage vorher fertig, läuft der Kredit weiter, die Anlagenkarte nennt, was noch offen ist. Die Bank macht nur mit, wenn eine Rate höchstens ein Viertel der Einnahmen je Spieltag ausmacht. Vor jedem Bau zeigt ein Dialog Baukosten, Förderung, Eigenanteil und die Raten.
- **Budget umschichten:** In den Finanzen lässt sich freier Gehaltsetat ins Transferbudget schieben und umgekehrt. Der Kurs sind die Wochen bis zum Saisonwechsel: 10.000 € pro Woche bringen bei noch 30 Wochen 300.000 € Transferbudget. Mehr als frei ist, geht nicht – die laufenden Verträge müssen bezahlt bleiben –, und mehr Gehaltsetat kostet entsprechend Transferbudget. Die Umschichtung gilt für die laufende Saison; zum Wechsel steht der Gehaltsetat wieder dort, wo der Vorstand ihn haben will. Vorher lagen beide Budgets fest.
- **Kennzahlen auf einen Blick:** Die Vereinsseite beginnt mit einem Kopf aus Wappen, Liga und Kacheln für Tabellenplatz, Ruf, Fans, Stimmung, Teamchemie und Kontostand. Kader und Finanzen haben dieselbe Kennzahlenleiste (Kadergröße und Alter, Marktwert, Gehälter, Fitness, Ausfälle, auslaufende Verträge bzw. Kontostand, Budgets, Gehaltsquote, Sponsor, Heimspiel).

### 6b. 👔 Das Saisonziel des Vorstands (`BoardEngine.bestimmeZiel`)
Vor jeder Saison – und bei einem Vereinswechsel – misst der Vorstand den Verein an seiner Liga, jeweils als Rang: Stärke des Kaders (60 %), Etat aus Gehalts- und Transferbudget (20 %) und Ansehen (20 %). Daraus ergibt sich, wo der Verein hingehört, plus ein Platz Spielraum. Schlechter als den ersten Nichtabstiegsplatz verlangt er nie; wer klar vorn liegt, soll Meister werden oder – unterhalb der höchsten Liga – aufsteigen. Wer mitten in der Saison übernimmt, bekommt ein Ziel zwischen Kader und Tabelle.

| Beispiel (gemessen) | Kader/Etat/Ansehen | Ziel |
|---|---|---|
| Rot-Weiß München | 1/1/1 | Meisterschaft |
| VfL Wolfsburg | 10/7/8 | sicherer Mittelfeldplatz (Platz 10) |
| VfL Bochum | 14/16/17 | Klassenerhalt (Platz 16) |
| Hannover 96 (2. Liga) | 1/1/1 | Aufstieg |
| Karlsruher SC (2. Liga) | 7/6/7 | oberes Mittelfeld (Platz 8) |

Die Begrüßung und die Post zum Saisonstart nennen Ziel und Gründe, das Dashboard den Zielplatz. Vertrauen, Ultimatum, Saisonbilanz und der ehrgeizige Sponsor rechnen mit genau diesem Platz. Vorher stand das Ziel einmal fest und änderte sich nur pauschal bei Auf- oder Abstieg; die Platzgrenzen waren fest verdrahtet (Klassenerhalt hieß Platz 10, an anderer Stelle wurde mit allen 218 Vereinen der Welt gerechnet, und „Aufstieg“ kannte die Rechnung gar nicht).

**Verhandeln und Medienprognose:** In der Vorbereitung steht das Ziel oben im Reiter, mit den Gründen und der Prognose der Medien – die Liga nach Kaderstärke (drei Viertel) und Ansehen (ein Viertel), ohne Etat und Spielraum, also oft einen Platz neben dem Ziel des Vorstands. Einmal je Vorbereitung lässt der Vorstand mit sich reden: das Ziel annehmen, zwei Plätze tiefer anpeilen (20 % weniger Transferbudget, etwas weniger Vertrauen) oder zwei Plätze höher (20 % mehr Transferbudget, etwas mehr Vertrauen). Danach gilt das Ziel für die ganze Saison.

**Ein Wert für das Vertrauen:** Balken, Text auf der Vorstandskarte, Ultimatum und Anfragen lesen dasselbe Vorstandsvertrauen.
- **Grundstimmung:** Es entsteht jeden Spieltag aus dem Tabellenplatz gemessen am Ziel, der Kasse und der Form der letzten drei Spiele.
- **Nachwirkung:** Pressekonferenzen, Versprechen, ein verhandeltes Saisonziel oder eine abgelehnte Anfrage verschieben es. Die Wirkung gilt am nächsten Spieltag noch voll und klingt dann ab (jeden Spieltag um ein Fünftel).
- **Vorher:** Es liefen zwei Werte nebeneinander. Der Balken vergaß jede Pressekonferenz am nächsten Spieltag, und der Text konnte „besorgt“ melden, während der Balken bei 75 % stand.

**Anfragen an den Vorstand (`BoardEngine.stelleAnfrage`):** Unter der Vorstandskarte im Dashboard bittet der Trainer um mehr Transferbudget, einen höheren Gehaltsetat oder einen Zuschuss zum Ausbau von Trainingsgelände oder Jugendzentrum. Die Auswahl zeigt vorher, wie die Aussichten stehen; der Vorstand antwortet nach drei Tagen per Post.
- **Was zählt:** das Vorstandsvertrauen vor allem, dazu der Tabellenplatz gemessen am Saisonziel (ab drei Spielen), der Kontostand und wie oft er in dieser Saison schon Nein gesagt hat.
- **Was es bringt:** beim Transferbudget bis zur Hälfte des freien Geldes, beim Gehaltsetat zehn Prozent mehr, beim Ausbau die Hälfte der Baukosten. Der Zuschuss wird gutgeschrieben, sobald der Bau beginnt, und verfällt mit der Saison.
- **Was es kostet:** Ein Nein kostet etwas Vertrauen. Danach ist dieselbe Bitte acht Wochen gesperrt, ein Zuschuss sechzehn Wochen. Mit leerer Kasse, voll ausgebauter Anlage oder laufendem Bau nimmt der Vorstand die Bitte gar nicht erst an.

### 7. 🗓️ Kalender-Tagesablauf, 🔍 Gegneranalyse & 🌟 Scoutingsystem
- **Spielvorschau (`SpielvorschauEngine`):** Die Karte „Nächstes Spiel“ im Kalender klappt eine Vorschau auf. Schon zugeklappt nennt sie Sieg, Remis und Niederlage in Prozent.
  - **Quoten:** Sie kommen aus einem Tormodell. Beide Seiten erwarten Tore nach ihrer Stärke, dazu der Heimvorteil und die Spielkultur der Liga; die Buchmachermarge liegt bei 6 %. Geeicht ist es an je 250 simulierten Partien der Spiel-Engine.
  - **Direkter Vergleich:** die Bilanz seit Amtsantritt mit dem letzten Ergebnis, aus der Vereinschronik.
  - **Form und Torjäger:** von beiden Mannschaften.
  - **Ausfälle:** Wer bei beiden verletzt oder gesperrt fehlt, die wichtigsten zuerst.
- **Spielerbewertungssystem (`PlayerRatingEngine`):** Trennung von echten internen Fähigkeiten (CA/PA 1–200, Hidden Attributes wie Professionalität & Ehrgeiz) und sichtbaren, scoutabhängigen Einschätzungsbereichen.
- **Sternebewertungen mit wählbarem Maßstab:** Qualitätssterne (0,5 bis 5,0); zehn Punkte Stärke sind ein Stern. Woran sie gemessen werden, steht in den Einstellungen unter „Sterne“ und in der Kennzahlenleiste des Kaders:
  - **Am eigenen Kader (Standard):** Drei Sterne sind der Kaderschnitt. Der Stammspieler eines Landesligisten hat so viele Sterne wie der eines Spitzenklubs.
  - **An der eigenen Liga:** Drei Sterne sind der Ligaschnitt.
  - **Weltweit:** Drei Sterne sind ein solider Erstligaprofi (Stärke 70). Ein Erstliga-Star hat fünf, ein Landesligaspieler einen halben.
  - Der Maßstab gilt überall: Kader, Taktik, Spielerakte, Scoutberichte, Gegneranalyse und schon die Spieler eines Vereins im Karrierestart. Dort wurden sie vorher an allen Vereinen der Auswahl gemessen. Münchens Spieler hatten im Assistenten fünf Sterne und nach dem Start im Kader nur drei oder vier.
  - Die Kaderstärke im Vereinsvergleich des Assistenten misst weiter an der Auswahl, beim Weltmaßstab fest.
  - Der Sternefilter des Transfermarkts sucht nach demselben Maßstab und nennt ihn („Ab ★ 3,0 (Ligaschnitt)“).
- **Klasse in Worten (`PlayerRatingEngine.klasse`):** Die Sterne sagen, wie gut ein Spieler für den eigenen Verein ist, die Klasse, wie gut er überhaupt ist. Sie steht in Spielerakte, Kader, Transfermarkt, Scoutbericht und Gegneranalyse, etwa „Stammspieler der 2. Liga“ oder „Spitzenspieler der Landesliga“.
  - **Gemessen an der Welt:** Je Ligastufe des eigenen Landes zählen die besten elf jedes Vereins. Ab dem 85. Perzentil ist einer Spitze der Liga, ab dem 40. Stammspieler. Weltklasse ist das oberste Prozent aller Erstligastammspieler.
  - **Talente:** Junge Spieler mit Luft nach oben bekommen ein Ziel in derselben Sprache („Kann Stammspieler der 1. Liga werden“).
  - **Bei fremden Spielern** folgt die Klasse der Schätzung des Scouts und trägt ein „ca.“.
  - Vorher hingen die Worte an festen Schwellen: „Starker Erstligaspieler“ ab Stärke 75, obwohl ein typischer Erstliga-Stammspieler 78 hat.
- **Testspiele werden angesagt:** Ein Spieltermin der Vorbereitung erscheint wie ein Spieltag – mit beiden Mannschaften und der Wahl zwischen Live-Spiel und Sofortergebnis. Beide laufen über dieselbe Simulation; das Ergebnis wird so eingetragen, wie es auf dem Platz fiel.
- **Saisonkalender & Wochenplan (`CalendarEngine`):** Realistischer Tagesablauf zwischen Spieltagen (Regeneration, Schwerpunkt-Training, Medien-/Sponsoren-Events, Taktikschulung und Gegneranalyse).
- **Zeit Tag für Tag:** Der Weiter-Knopf läuft Tag für Tag bis zum nächsten Termin (Spiel, Testspiel, Pressekonferenz, Saisonende). Er hält aber auch dazwischen an, wenn etwas den Manager angeht:
  - ein Angebot für einen eigenen Spieler,
  - eine Antwort in einer Verhandlung,
  - eine Verletzung im Training,
  - ein Scoutbericht, Jugendtag, Vorstandspost, ein fertiger Bau oder ein auslaufender Vertrag.

  Der Grund steht im Tagesbericht, der nächste Klick läuft weiter. Wer jeden Tag einzeln sehen will, etwa zwischen Pressekonferenz und Anpfiff, nimmt den Knopf **+1 Tag** daneben. Er erscheint, sobald der Weiter-Knopf mehrere Tage überspringen würde.
- **Urlaub (`UrlaubEngine`, Kalender):** Bis zu einem Ziel durchspielen: eine Woche, zwei Wochen, Monatsende, bis das Transferfenster schließt oder öffnet, bis zum Saisonende.
  - Der Co-Trainer übernimmt: Er stellt auf, Spiele und Pokalabende werden ohne Livespiel gerechnet, Pressetermine nimmt er wahr.
  - Zum Saisonende, beim Saisonwechsel und bei einer Entlassung ist der Urlaub vorbei. Auf Wunsch hält er auch bei Wichtigem an, mit denselben Gründen wie der Weiter-Knopf (dazu jetzt auch Post zum Jobmarkt).
  - Danach steht die Bilanz im Tagesbericht: Tage, Ligaspiele mit Siegen, Remis und Niederlagen, Tabellenplatz vorher und nachher.
- **Ein Tag rechnet ein Drittel schneller:** gemessen über 60 Tage ab Saisonstart von 136 auf 78 ms an spielfreien Tagen und von 156 auf 114 ms an Spieltagen.
  - Die KI sucht Verstärkungen in einer nach Stärke sortierten Liste und hört auf, sobald niemand mehr besser ist. Zu teure Spieler fallen mit einer billigen Vorprüfung heraus.
  - Ein KI-Transfer baut kein eigenes Verzeichnis aller Spieler mehr auf.
  - Die Simulation zählt die Rollen einer Elf einmal je Aufstellung statt in jeder Spielszene.
- **Langzeit: sechs Saisons ohne Eingriff** (gemessen mit einem Erstliga-Verein, die KI spielt alles):
  - **Tempo:** Eine Saison dauerte anfangs 45 s, nach fünf Saisons 61 s. Jetzt sind es 43 und 57 s. Die Aufstellung der KI-Vereine sucht ihren Kader in einem Verzeichnis, das einmal je Spieltag entsteht, statt 384-mal in allen Spielern der Welt.
  - **Eintritt je Heimspiel:** Gehälter, Sponsor und Betrieb werden für alle Vereine einmal je Spieltag der eigenen Liga gebucht. Eintritt gab es dagegen für jedes echte Heimspiel, in der First Division also 23 statt 17. Jetzt bringt jede Saison so viel Eintritt, wie die Rechnung je Spieltag unterstellt.
  - **Fanstimmung:** Die Stimmung der eigenen Fans füllte jedes Stadion der Welt mit. Jetzt gilt sie nur zu Hause.
  - **Betriebsaufwand:** Von der zweiten bis zur siebten Liga blieben jedem Verein 12 bis 17 % seines Umsatzes. Der Anteil des Betriebs steigt jetzt von 45 % in der zweiten bis 78 % in der siebten Liga, übrig bleiben rund 3 bis 7 %.
  - **Rücklagen der KI-Vereine:** Was über dem Doppelten der üblichen Rücklage einer Stufe und Größe liegt, fließt zum Saisonwechsel zur Hälfte in Anlagen und Tilgung. Der eigene Verein bleibt außen vor.
  - **Transfers nach unten:** Ein junger Spieler geht nicht zwei Ligen hinunter, wenn er dort klar zu gut für die Elf ist. Eine Lücke im Kader füllt die KI ab zehn Punkten unter dem eigenen Niveau, nicht mit dem Stärksten, den sie sich leisten kann.
  - **Ergebnis:** Nach fünf Saisons hatte der Median-Drittligist vorher das Neunfache seines Startguthabens auf dem Konto, der Sechstligist das Vierzehnfache. Jetzt sind es nach sechs Saisons das 2,4- und das 5-Fache, und die Kontostände pendeln sich ein. Die Stärke der Elf je Liga bleibt bis auf rund einen Punkt stabil. Nur die sechste Liga legt weiter etwa 0,3 Punkte je Saison zu.
- **Talentsuche (`TransferEngine.talentsuche`):** Vereine bis zur fünften Liga holen junge Spieler (bis 21) aus tieferen Ligen, die bald mithalten können und das Potenzial für ihre Mannschaft haben. Ab der dritten Liga nur im eigenen Land.
  - Ohne diesen Weg waren die unteren Ligen fast geschlossen: Wer sich dort entwickelte, blieb. Der Schnitt der Kader sank jede Saison, die beste Elf aber stieg, weil die Talente die Älteren verdrängten.
  - Gemessen über je drei Läufe mit festem Zufall und fünf Saisons, Stärke der Elf je Saison: fünfte Liga +0,24 vorher, jetzt −0,01; sechste Liga +0,26, jetzt +0,06; dritte Liga in England +0,19, jetzt +0,02. Die erste und zweite Liga bleiben bei ±0,1, die dritte deutsche Liga gibt leicht nach (−0,2).
- **Ligen halten ihr Niveau (`WorldGenerator.niveauAusgleich`):** Beim Anlegen der Welt merkt sich jede Liga ihre Stärke (Schnitt der besten Elf je Verein, `state.ligaNiveau`). Wer beim Saisonwechsel nachgezogen wird, entsteht je Punkt Abweichung um fünf Fähigkeitspunkte stärker oder schwächer, höchstens um 15 (etwa acht Punkte Stärke).
  - Vorher verloren die zweiten und dritten Ligen in acht Saisons bis zu 1,7 Punkte. Wer aufstieg oder ins Ausland wechselte, wurde durch Spieler nach festen Spannen je Spielklasse ersetzt.
  - Gemessen über je drei Läufe mit festem Zufall und acht Saisons: vorher −1,7 bis +0,8 je Liga, jetzt −0,7 bis +0,6. Deutschland steht danach in der Fünfjahreswertung meist auf Rang 4.
  - Ältere Spielstände merken sich die Stärke beim ersten Saisonwechsel und gleichen ab dann aus.
- **Tempo und Spielstand über viele Saisons:**
  - **Suchen über ein Verzeichnis:** Am Saisonwechsel suchte das Spiel für jeden Verein jeden Spieler in der ganzen Liste, beim Auffüllen der Kader, beim Aufstellen, bei der Kaderplanung. Neue Spieler stehen hinten in der Liste, und nach einigen Saisons stammt ein guter Teil jedes Kaders von dort. Jetzt gibt es ein Verzeichnis nach ID (`GameState.spielerIndex`), der Saisonwechsel dauert 1,4 statt 4,4 s, nach fünf Saisons 2,2 statt 6,0 s.
  - **Kürzere Transfersuche:** Die KI wählt unter den fünf reizvollsten Kandidaten und bricht die Suche ab, sobald niemand mehr unter diese fünf käme. Die Wahl ist dieselbe wie vorher, geprüft mit festem Zufall.
  - **Ergebnis:** Eine Saison dauert 29 s, nach fünf Saisons 34 s (14 % mehr, vorher 21 %).
  - **Speicherformat `fmc3`:** Die Laufbahn je Spieler stand als Text mit Feldnamen und Vereinskürzel im Spielstand und wuchs um rund 160 KB je Saison. Jetzt ist sie eine flache Zahlenreihe, das Kürzel kommt aus dem Wörterbuch. Ein Spielstand nach fünf Saisons ist 4,6 statt 5,0 MB groß. Die Laufbahn behält höchstens zwölf Saisons je Spieler, der Spielstand wächst also nicht ohne Ende. Ältere Spielstände (`fmc1`, `fmc2`) bleiben lesbar.
- **Taktische Gegneranalyse (`OpponentAnalysisEngine`):** Vor jedem Ligaspiel detaillierte Stärken-/Schwächenprofile, gegnerische Taktiktendenzen, Gefahreinstufung und konkrete Trainer-Empfehlungen abrufen. Der Spielanalyst aus dem Trainerstab entscheidet, wie genau sie ist:
  - Ein schwacher Analyst liest die Mannschaftsteile ungenauer und stellt nur zwei Schlüsselspieler vor.
  - Ein guter Analyst stellt bis zu vier Schlüsselspieler vor und benennt die Schwachstelle der gegnerischen Elf samt Rat, wie man sie angeht.
- **Trainerstab in der Vorbereitung:**
  - **Posten:** Sechs Posten sind zu besetzen – Co-Trainer, Athletiktrainer, Spielanalyst, Mannschaftsarzt, Nachwuchsleiter und Chefscout.
  - **Gehälter nach Liga und Posten:** Ein Co-Trainer in der 1. Liga verdient rund 16 Tsd. € je Woche, in der Landesliga gibt es 100 € Aufwandsentschädigung. Arzt, Scout, Athletiktrainer, Analyst und Nachwuchsleiter verdienen weniger. Wer besser ist als das übliche Niveau des Vereins, verlangt mehr, etwa das Doppelte bei 15 Punkten darüber.
  - **Stab-Etat:** Der Etat ist anderthalb Mal ein durchschnittlich besetzter Stab, höchstens ein Viertel des Gehaltsbudgets. Er steht als Balken über der Liste. Jeder Bewerber zeigt Sterne, Forderung und ob er in den Etat passt.
  - **Pflichtposten passen immer:** Co-Trainer, Athletiktrainer und Arzt zum üblichen Gehalt passen immer in den Etat, mit einem Viertel Luft. Für jeden Pflichtposten ist mindestens ein Bewerber zum üblichen Gehalt dabei.
    - Vorher konnten alle drei Bewerber teurer sein, und der Etat hing am alten, zu niedrigen Gehaltsbudget. Bei Sportfreunde Heide (5. Liga) standen rund 1.000 € Etat einem günstigsten Co-Trainer für 460 € gegenüber.
    - Jetzt sind es dort rund 2.000 € Etat. Die günstigsten Pflichtbewerber kosten zusammen etwa 500 bis 800 €.
  - **Echte Kosten:** Die Gehälter gehen jede Woche als eigener Posten „Trainerstab“ von der Kasse ab. Der übliche Stabsanteil ist dafür aus dem Betriebsaufwand herausgenommen: Ein teurer Stab kostet mehr, ein sparsamer spart. Eine Aushilfe auf einem offenen Posten kostet gut ein Drittel eines üblichen Gehalts.
  - **Gehaltsverhandlung:** Wer verhandelt statt zur Forderung zu verpflichten, bietet Gehalt und Laufzeit. Längere Verträge machen den Bewerber günstiger. Er antwortet mit einem Gegenangebot. Wer ihn zu tief ansetzt oder drei Runden feilscht, verliert ihn.
  - **Meldungen:** Jede Verpflichtung meldet der Sportdirektor mit dem Stand des Etats und den noch offenen Posten.
  - **Pflichtposten:** Arzt, Athletiktrainer und Co-Trainer sind Pflicht. Eine Woche, drei Tage und einen Tag vor dem Start erinnert der Sportdirektor daran. Am ersten Spieltag fragt er nach, ob die Saison wirklich ohne sie beginnen soll, oder besetzt die Posten auf Wunsch kurzfristig.
  - **Offene Posten:** Ein offener Posten wird mit Aushilfen besetzt und ist spürbar schwächer als ein eigener Mann.
- **Detaillierte Spielberichte:** Textzusammenfassungen, xG-Vergleiche, Zweikampfquoten, Paraden und Auszeichnungen für den Mann des Spiels.
- **Verbessertes Postfach (`NewsEngine`):** Vollständige Suche, Filterleiste (Vorstand, Spiel, Transfers, Training, Finanzen) und dauerhafte Mail-Historie. Am Handy und auf schmalen Bildschirmen klappt eine Nachricht direkt unter ihrem Eintrag auf; ein zweiter Tipp klappt sie zu. Vorher stand sie unter der ganzen Liste, und man musste erst ans Ende scrollen. Breit steht sie wie gewohnt rechts daneben.
  Die Liste ist dicht: Absender und Datum in einer Zeile, darunter der Betreff. Gelesenes tritt zurück. Am Handy stehen die Filter in einer wischbaren Zeile.
- **Postfach wie im Vorbild (`NewsEngine.kategorie`, `dringlichkeit`, `anhaenge`, `uiPostfach.js`):** Vorher war jede Nachricht ein Absatz Text mit höchstens einem Knopf.
  - **Abteilungen:** Jede Nachricht gehört zu einer Abteilung, zum Beispiel Transfer, Verträge, Medizin, Spiel, Presse, Vorstand, Nachwuchs, Scouting oder Finanzen. Sie hat dafür eine eigene Farbe am Rand und ein eigenes Zeichen. Schreibt ein Verein, steht sein Wappen davor. In der Liste steht unter dem Betreff die erste Zeile des Textes.
  - **Die Filter folgen den Abteilungen.** Vorher fehlten Vorberichte unter *Spiel* und Verletzungen unter *Training*.
  - **Frist und Dringend:** Ein Angebot für einen eigenen Spieler steht als *Antwort erwartet · bis 25.08. · noch 4 Tage* da. Ab zwei Tagen vor Ablauf heißt es *Dringend*, in Rot mit einem leichten Puls.
    - Ist es entschieden, steht das an der Nachricht: *Angenommen*, *Abgelehnt*, *Verfallen* oder *Zurückgezogen*.
    - Ebenso markiert sind die Werbung um ein Talent der Akademie, ein Spieler mit Wechsel- oder Gesprächswunsch, ein auslaufender Vertrag und eine Verletzung (*Fällt aus · 3 Wo.*).
    - Der neue Filter *Antwort nötig* zeigt alles, was noch offen ist.
  - **Anhänge**, aufklappbar und immer mit dem Stand von heute:
    - das Angebot
    - der ärztliche Befund mit Ausfall, Rückkehrdatum und Anfälligkeit
    - Scoutbericht, Entwicklungsbericht und Kandidatenliste des Sportdirektors
    - die Gegneranalyse zum Vorbericht mit Rang, Form, Stärke der ersten Elf und bestem Torschützen
    - die Tabelle zur Rundschau
    - die Vertragsdaten mit der Forderung des Spielers
    - der neue Jahrgang zum Jugendtag
    - der Kontoauszug zur Finanzpost
  - **Namen als Verweise:** Spieler und Vereine im Text sind Links und öffnen Profil oder Vereinsseite. Bei gleichen Namen gewinnt der eigene Spieler.
  - **Knöpfe:** Unter jeder Nachricht steht, was man mit ihr tun kann, zum Beispiel *Zum Angebot*, *Annehmen*, *Ablehnen*, *Profil*, *Verhandeln*, *Vertrag verlängern*, *Gespräch führen*, der Verein des Absenders oder der passende Reiter.
  - **Eindeutige Kennungen:** Kamen zwei Angebote in derselben Millisekunde, trugen sie dieselbe Kennung, und *Annehmen* traf womöglich das andere. Jetzt hat jedes Angebot seine eigene, und die Nachricht kennt Angebot und Spieler. Nachrichten älterer Spielstände ohne Kennung finden ihr Angebot über Betreff und Absender.
- **Kopfleiste:** Am breiten Bildschirm bleibt alles einzeilig. Der Weiter-Knopf nennt oben, wann es weitergeht („Weiter · in 9 Tagen“), darunter wohin („Spiel bei Blau-Weiß Gelsenkirchen“), und kürzt bei Bedarf. Bis 1500 px Breite fällt der Schwierigkeitsgrad weg, bis 1280 px auch „Saison 1“ und die Beschriftung „Vorstand“.
- **Kleinigkeiten überall:** Dreibuchstabige Wappen passen in den Kreis. In der Formkurve sind noch nicht gespielte Partien leere Plätze statt Bindestriche. Ab einer Milliarde heißt es „1,09 Mrd. €“. Lange Wörter trennen an der Silbe (`hyphens: auto`). Im Kalender steht vor einem Termin nur noch ein Symbol, nicht Symbol und Emoji. Der Trainingsbericht zeigt die Einschätzung als Etikett („Pause nötig“, „Schonen“, „Praxis fehlt“), den ganzen Satz beim Darüberfahren. Die Kennzahlen im Kader stehen am Handy zu dritt in einer Reihe, der Sternemaßstab als Zeile darunter.
- **Anhalten mit Knöpfen (`CalendarEngine.unterbrechung`, `zeigeAnlass`):** Hält der Weiter-Knopf unterwegs an (Angebot, Neues in einer Verhandlung, Verletzung im Training, wichtige Post), nennt die Meldung den Anlass, darüber klein „Angehalten“ und das Datum. *Ansehen* springt dorthin (Verhandlungskarte, die Seite des Angebots, Akte des Verletzten, die Nachricht im Postfach). Weiter geht es mit dem Weiter-Knopf direkt darüber. Die Meldung bleibt stehen, bis man sie nutzt, schließt oder weiterspielt. Ein Tipp auf die Meldung selbst wirkt wie *Ansehen*. Vorher hieß es „Weiter geht es mit dem nächsten Klick“, und ein Tipp auf die Meldung tat nichts. Springt die Ansicht für den Anlass ohnehin auf eine Seite (ein neues Angebot), bleibt die Meldung weg.
- **Meldungen in einer Zeile und Meldungszentrale (`uiMeldungen.js`):** Statt gestapelter Kästen unten rechts gibt es eine einzige Zeile, mittig unter der Kopfleiste. Vorher standen oft drei Kästen übereinander über dem Inhalt, am Handy über der halben Seite.
  - Eine neue Meldung ersetzt die alte. Ein dünner Balken am unteren Rand zeigt die Restzeit. Steht der Zeiger darauf, wartet sie.
  - Jede Art hat ihr Symbol und ihre Farbe: erledigt grün, Hinweis blau, Achtung gelb, Fehler rot. Emojis vorn im Text entfallen, vorher stand etwa „✅ ✅ Aufstellung gespeichert“. Fehler stehen mindestens fünf Sekunden.
  - Meldungen mit Knöpfen bleiben stehen, bis man sie nutzt, schließt oder weiterspielt. Danach gelten ihre Knöpfe nicht mehr.
  - Die **Glocke** in der Kopfleiste öffnet die Meldungszentrale: die letzten vierzig Meldungen nach Tagen, die neueste oben, mit ihren Knöpfen, solange sie gelten. Die Zahl an der Glocke zählt nur Wichtiges, das noch niemand gesehen hat: Warnungen, Fehler und Meldungen mit Knöpfen.
  - Im Livespiel erscheint die Zeile unten, damit sie Spielstand und Uhr nicht verdeckt.
- **Ruhigere Optik:** Überschriften tragen Liniensymbole aus dem Symbolsatz des Spiels statt Emojis (22 Stellen). Der Weiter-Knopf und die Hauptknöpfe leuchten nicht mehr. In Tabellen sind Hauptknöpfe wie *Verhandeln* Umrisse und füllen sich erst in der Zeile unter dem Zeiger. Vorher standen im Transfermarkt dreißig leuchtend grüne Knöpfe untereinander. Zahlen in Tabellen und Kacheln haben gleich breite Ziffern.
- **Bedienung wie im Vorbild (`uiNavigation.js`):**
  - **Unterreiter:** Lange Reiter zeigen ihre Karten in Unterreitern unter dem Titel statt untereinander. Verein: Übersicht, Anlagen, Trainer, Vision & Partner, Chronik. Kader: Spieler, Unterbau, Kabine, Planung, Meldeliste. Training: Training, Trainingslager, Bericht, Individuell. Jugend: Akademie, U19, U23, Verliehen. Finanzen: Übersicht, Journal. Statistik: Ranglisten, Datenzentrale, Auszeichnungen, Fünfjahreswertung, Gerüchte & Trainer. Vorbereitung: Überblick, Trainerstab, Sponsoren, Testspiele. Der zuletzt gewählte bleibt gemerkt, leere blenden aus, und der Schreibtisch springt direkt in den passenden.
  - **Suche** in der Kopfleiste, auch mit `/` oder `Strg+K`: Spieler (nur, wen das eigene Scouting kennt), Vereine und Bereiche. Pfeiltasten wählen, Enter öffnet Akte, Vereinsseite oder Bereich.
  - **Zurück:** Knopf in der Kopfleiste, `Alt+←`, die Zurück-Taste der Maus und am Handy die Systemtaste. Ein offenes Fenster schließt dabei zuerst.
  - **Leertaste** spielt weiter wie der Weiter-Knopf.
  - **Kontextmenü:** Rechtsklick auf einen Spieler (am Handy langes Drücken, wo der Browser es meldet): Akte, Beobachtungsliste, Scouten, Verhandeln, Vergleichen.
  - **Sortieren:** Transfermarkt, Trainingsbericht und Beobachtungsliste sortieren per Spaltenkopf, Zahlen zuerst absteigend. Die Sortierung bleibt beim Neuzeichnen. Geschätzte Marktwerte zählen mit der Mitte ihrer Spanne, nicht mit dem verdeckten echten Wert.
  - **Kaderliste wie im Vorbild (`uiKader.js`):** Über der Liste steht eine Leiste. Vorher sortierte der Kader nur über die Spaltenköpfe. Die gibt es am Handy nicht, und bei mittlerer Breite fehlten Gehalt und Moral ganz.
    - **Ansichten** mit eigenen Spalten:
      - *Übersicht*: Stärke, Rolle, Kondition, Zufriedenheit, Form, Marktwert, Gehalt, Vertrag
      - *Vertrag*: Kaderrolle, Vertragsende als Datum, Gehalt, Marktwert, Zufriedenheit mit dem Vertrag und ein Hinweis (Vorvertrag, Werber, Wechselwunsch, Transfer- oder Leihliste, Ausstiegsklausel)
      - *Leistung*: Einsätze, Minuten, Tore, Vorlagen, Note, Form, Karten
      - *Fitness*: Kondition, Spielpraxis, Ausfall, Belastung, Zufriedenheit
      - Am Handy zeigt die Zeile unter jedem Spieler das Wichtigste der gewählten Ansicht.
    - **Sortieren** nach Position, Stärke, Potenzial, Alter, Vertragsende, Gehalt, Marktwert, Form, Kondition, Spielpraxis, Zufriedenheit, Einsätzen, Minuten, Toren, Vorlagen, Note, Rückennummer oder Name. Der Pfeil daneben dreht die Richtung. Die Spaltenköpfe sortieren am breiten Bildschirm genauso, ein zweiter Tipp dreht um.
    - **Schnellfilter:** *Vertrag läuft aus*, *Ausfälle*, *U21*, *Auf dem Markt* (Transfer- oder Leihliste, Vorvertrag), dazu die Zahl der gezeigten Spieler. Sie wirken zusammen mit den Knöpfen für den Mannschaftsteil.
    - Auslaufende Verträge stehen rot, solche mit noch zwei Jahren gelb.
    - Ansicht, Sortierung, Filter und Mannschaftsteil bleiben gemerkt, auch nach dem Neuladen. Vorher fiel die Liste beim Neuzeichnen auf „Alle“ zurück, obwohl der Knopf für den Mannschaftsteil markiert blieb.
  - **Beobachtungsliste (`ScoutingEngine.merke`, `beobachtungsliste`):** Bis zu 60 fremde Spieler, aufgenommen über die Akte oder das Kontextmenü, mit Stern im Transfermarkt und eigener Ansicht dort. Je Spieler Verein, Stärke, Marktwert, Vertrag, ob ein Bericht vorliegt oder ein Scout unterwegs ist, und Hinweise: Vertrag läuft aus, vereinslos, auf der Transferliste, verliehen, verletzt.
- **Weniger Post über fremde Wettbewerbe:** Eine Siegermail kommt nur noch für den eigenen Landespokal, für den Meisterpokal und für Wettbewerbe, in denen der eigene Verein gespielt hat oder ein Verein aus dem eigenen Land gewinnt.
  - Vorher kam am Saisonende für jeden der dreizehn Landespokale und alle drei Europapokale eine eigene Mail, vom brasilianischen bis zum schottischen.
  - Die Sieger stehen weiter an den Wettbewerben und in der Historie.
  - Der Saisonabschluss nennt den Meister der eigenen Liga („Meister der First Division ist …“). Vorher hieß es überall „Deutscher Meister“.

### 8. 🌐 Die Spielwelt: 384 Vereine aus fünf Ländern (`WorldGenerator`)
- **Zwanzig spielbare Ligen, 384 Vereine, über 8300 Spieler.** Die komplette Welt wird beim Karrierestart erzeugt und läuft Saison für Saison mit.
- **Zweite und dritte Ligen in England, Spanien, Italien und Frankreich:** First Division (24 Vereine, 46 Spieltage) und Second Division (24), Segunda División (22) und Tercera División (20), Seconda Divisione (20) und Terza Divisione (20), Deuxième Division (18) und National (18) – mit echten Vereinen samt Stadt, Stadion und Fassungsvermögen (die zweiten Ligen in der Zusammensetzung 2024/25, in den dritten Ligen Vereine, die auf oder nahe dieser Ebene spielen). Vorher hatten diese Länder nur eine Liga; die Erstligen verwiesen beim Abstieg auf Ligen, die es nicht gab, und niemand stieg ab. Jetzt tauschen die Erstligen mit den Zweitligen (Premier Division, Primera División, Prima Divisione je drei, Première Division zwei) und die Zweit- mit den Drittligen. Die Stärke liegt wie in Deutschland: zweite Ligen um 68, dritte um 60.
- **Laufende Karrieren bekommen die neuen Ligen beim Laden** (Spielstand-Version 9): Vereine, Kader und Spielplan werden nachträglich angelegt, die verpassten Spieltage holt die Simulation am nächsten Spieltag anteilig nach, und eine Nachricht des Ligavorstands kündigt sie an.
- **Was die größere Welt kostet:** Im Browser dauert der Aufbau 1,7 statt 0,7 Sekunden und ein Kalendertag 119 statt 77 ms; der Spielstand wächst kodiert von 2,4 auf 4,0 MB (er liegt in IndexedDB).
- **Acht Länder im Hintergrund mit je zwei Ligen:** Niederlande, Portugal, Belgien, Türkei, Österreich, Schweiz, Schottland und Brasilien spielen mit Tabellen, Kadern, Transfers und Landespokal mit, sind aber nicht wählbar. Jedes Land hat eine erste und eine zweite Liga (Eerste Divisie, Segunda Divisão, Tweede Klasse, İkinci Lig, 2. Liga Österreich, Nationalliga B, Scottish Second Division, Série Nacional B; 10 bis 20 Vereine) mit direktem Auf- und Abstieg: ein Platz in Österreich, der Schweiz und Schottland, zwei in den Niederlanden, Portugal und Belgien, drei in der Türkei, vier in Brasilien.
- **Namen passend zur Nationalität:** Ein Spieler heißt wie sein Land, nicht wie sein Verein. Vorher hieß ein Italiener bei einem deutschen Verein etwa „Jannik Hahn“.
  - Die Länder mit Liga haben ihre Namenspools. Für 41 weitere Nationen gibt es eigene Pools mit gewöhnlichen Vor- und Nachnamen, etwa Senegal, Kroatien, Japan oder Argentinien.
  - Das gilt für neue Spieler und für die Talente der eigenen Akademie.
  - Sprachräume zählen: Ein Österreicher darf deutsch heißen, ein Belgier französisch oder niederländisch, ein Kanadier englisch.
  - Ältere Spielstände werden beim Laden einmal berichtigt, fest je Spieler und ohne Zufall. Umbenannt wird nur, wessen Name ganz aus dem Pool eines fremden Sprachraums stammt. Die Kader der ersten Ligen und Namen aus einer Namensdatei bleiben.
  - Nebenbei behoben: „Kap Verde“ und „DR Kongo“ waren in den Listen in zwei Wörter zerfallen.
  - **Stärke:** Die zweiten Ligen liegen rund 12 Punkte unter der ersten Liga ihres Landes, ihr Ruf etwa auf Höhe der 2. Liga. Die Talentschmieden der Länder wirken auch dort: Der Scout findet in den zweiten Ligen junge Spieler mit Potenzial.
  - **Pokale:** Mit beiden Ligen haben die Niederlande, Portugal, die Türkei und Brasilien mehr als 32 Vereine und spielen ab der ersten Runde mit Freilosen, Belgien ab der zweiten, Österreich, Schweiz und Schottland ab dem Achtelfinale.
  - **Laufende Karrieren** bekommen die zweiten Ligen beim Laden dazu, die erste Liga des Landes hat ab dann Absteiger. Die Welt wächst auf 632 Vereine und rund 14.000 Spieler, der Spielstand kodiert von 5,7 auf 6,9 MB.
- **Top-5-Ligen:** Deutschland, England, Spanien, Italien und Frankreich – jede mit landestypischen Vereins-, Städte- und Spielernamen. In England spielen *Rovers* und *Wanderers*, in Spanien *Real* und *Deportivo*, in Italien *AC* und *Calcio*, in Frankreich *Olympique* und *Stade*.
- **Deutsche Ligapyramide (Stufe 1 bis 7):** 1. Liga, 2. Liga, 3. Liga, Regionalliga West & Bayern, Oberliga Nord, Verbandsliga und Landesliga.
- **Spielerstärke nach Ligastufe:** Der `PlayerGenerator` staffelt Fähigkeit (CA) und Potenzial (PA) nach Ligastufe *und* Ruf des Vereins. Ein Landesligist spielt mit Spielern um 20 Gesamtstärke, ein Erstliga-Spitzenklub um 80. Zwischen benachbarten Stufen bleibt eine Überschneidung: Der Zweitligameister kann stärker sein als der Erstliga-Absteiger.

| Ligastufe | schwacher Klub | Mittelfeld | Spitzenklub |
|---|---|---|---|
| 1. Liga | 67 | 76 | 82 |
| 2. Liga | 58 | 61 | 68 |
| 3. Liga | 51 | 56 | 59 |
| Regionalliga | 43 | 46 | 49 |
| Oberliga | 32 | 38 | 39 |
| Verbandsliga | 23 | 28 | 33 |
| Landesliga | 17 | 19 | 23 |

- **Alle Ligen laufen mit:** Pro Spieltag simuliert die `SeasonEngine` auch die elf übrigen Ligen. Da die Ligen 30, 34 oder 38 Spieltage haben, wird der Fortschritt anteilig umgerechnet – alle Ligen enden gemeinsam.
- **Ruf, Stadion und Etat nach Rangfolge:** Ein Spitzenklub hat rund das Siebenfache des Etats des Schlusslichts derselben Liga; die Stadionkapazität reicht von 82.000 (Topliga) bis 400 Plätzen (Landesliga).
- **Startbudgets nach einer Formel:** Auch die Erstligisten bekommen Transferbudget und Kontostand nach Ligastufe und Rang. Vorher galten dort von Hand eingetragene Werte. München startete mit 50,5 Mio. Transferbudget und Leverkusen mit 35,8 Mio., während Manchester, Madrid oder Paris nach der Formel höchstens 28 Mio. hatten. Jetzt starten alle Spitzenklubs mit 18–28 Mio. Die Gehaltsetats bleiben, sie sind auf die Kader abgestimmt.
- **Fernsehgeld je Land (`FinanceEngine.LAND_ECONOMY`):** Vorher hingen die Einnahmen nur an Ligastufe und Rang. Der Zehnte der Premier Division verdiente so viel wie der Zehnte der 1. Liga.
  - **Vorlage:** Umsatz je Erstligist 2023/24 laut Deloitte: Premier Division rund 370 Mio. €, 1. Liga 211, Primera División 190, Prima Divisione und Première Division je rund 145.
  - **Zwei Faktoren je Land:** Der Vorsprung liegt in der Breite, die Spitzenklubs der großen Ligen setzen ähnlich viel um. Deshalb gibt es einen Faktor auf den Sockel (Fernsehgeld für alle) und einen auf die Spanne (was der Rang dazubringt).
    - England: Sockel ×2,3
    - Spanien: Sockel ×0,75
    - Italien: Sockel ×0,6, Spanne ×0,75
    - Frankreich: Sockel ×0,5, Spanne ×0,75
  - **Ergebnis:** Manchester nimmt am meisten ein, München und Madrid knapp dahinter, Mailand und Paris etwa drei Viertel davon. Das Mittelfeld der Premier Division liegt beim Doppelten von Freiburg. Startbudgets und Gehälter folgen dem.
  - **Ticketpreise der 1. Liga:** Sie richten sich nach dem Ruf wie überall, mit deutschem Abschlag. Vorher zahlte man in München und Heidenheim dieselben 35 €.
- **Überschüsse der Spitzenklubs geeicht:** Gemessen über eine Saison legten Spitzenklubs 50–120 Mio. zurück (München +76, Manchester +123). Ihre Gehaltsquote lag bei 30 % der Einnahmen, real sind es eher 50–70 %. Drei Ursachen:
  - **Gehaltsetat:** Erstligisten tragen jetzt 60 statt 50 % ihrer Einnahmen als Gehalt, Zweitligisten 48 statt 45 %. Der Spitzenklub bekommt kaum noch Abschlag (5 statt 18 %).
  - **Tabellenprämie:** Sie ist halbiert. Sie kam zum Fernsehgeld dazu, das den Rang schon belohnt.
  - **Europapokal:** Die Prämien sind halbiert. Der Sieger der Königsklasse bekam 73 Mio., 43 % eines Spitzenumsatzes, real sind es rund 17 %.
  - **Danach:** Spitzenklubs legen 10–25 % ihres Umsatzes zurück (München +37, Manchester +18, Madrid +30). Das Mittelfeld steht vor Transfers bei null, und die Transfers entscheiden über Plus oder Minus.
- **Nationale Pokale & Europapokal:** Deutschlandpokal, National Cup, Copa Nacional, Coppa Nazionale und Coupe Nationale sowie Meisterpokal (`ucl`), Kontinentalpokal (`uel`) und Euro-Cup (`uecl`) mit Gruppen- und K.O.-Runden via `CompetitionEngine`.
- **Pokale in allen fünf Ländern (`CupEngine`):** Bisher gab es nur den Pokal im Land des eigenen Vereins. Jetzt spielt jedes Land seinen Pokal an denselben Abenden im Hintergrund aus, mit Prämien je Runde. Der Reiter „Spielplan & Tabelle“ zeigt alle fünf Tableaus.
  - **Freilose:** Spanien, Italien und Frankreich haben weniger als 64 Vereine. Dort fiel vorher in einer Runde ein Verein ohne Spiel heraus, und der Pokal endete eine Runde zu früh. Jetzt bekommen die stärksten Vereine ein Freilos, die zweite Runde geht mit 32 auf.
  - **Kontinentalpokal für den Pokalsieger:** Der Pokalsieger jedes Landes spielt Kontinentalpokal, auch aus der zweiten Liga. Steht er schon im Europapokal, rückt der Nächstplatzierte der Liga nach.
- **Ein Pokalabend, eine Runde:** Jeder Pokal- und Europapokalabend im Kalender spielt genau seine Runde. Nach dem eigenen Spiel geht es mit der Ligawoche weiter; die nächste Runde steht erst am nächsten Pokalabend an.
- **Supercup (`SupercupEngine`):** Am letzten Tag der Vorbereitung spielt im eigenen Land der Meister gegen den Pokalsieger der Vorsaison: Supercup, Super Cup, Supercopa Nacional, Supercoppa Nazionale oder Supercoupe.
  - Hat der Meister auch den Pokal geholt, kommt der Vizemeister. In der ersten Saison treffen sich die beiden Vereine mit dem größten Ruf der ersten Liga.
  - Ein Spiel auf neutralem Platz, bei Gleichstand Elfmeterschießen. Ist der eigene Verein dabei, hält der Weiter-Knopf am Termin, und es wird live oder als Sofortergebnis gespielt.
  - Der Sieger bekommt eine Prämie von zwei Sponsorbeiträgen je Spieltag. Gewinnt der eigene Verein, steht der Titel in der Trainerlaufbahn. Das Ergebnis kommt als Nachricht.
  - Spielt der Co-Trainer die Partie (ohne Livespiel), gibt es bei Gleichstand ebenfalls ein Elfmeterschießen. Vorher gewann in diesem Fall einfach die erstgenannte Mannschaft.
- **Europäischer Supercup (`EuroSupercupEngine`):** Zwei Tage vor dem nationalen Supercup spielt der Sieger der Königsklasse gegen den Sieger der Kontinentalpokal der Vorsaison.
  - Ein Spiel auf neutralem Platz, bei Gleichstand Elfmeterschießen. In der ersten Saison treffen sich die Vereine mit dem größten Ruf aus beiden Wettbewerben.
  - Beide bekommen 4 Mio. € Antrittsgeld, der Sieger 1 Mio. € dazu. Die Partie zählt in der Statistik zum Europapokal, der Titel steht in der Trainerlaufbahn.
  - Der Kalender zeigt den Termin als Europapokalabend, ohne eigene Beteiligung mit Paarung und Ergebnis.
  - Für beide Supercups zeigt die Spielkarte „Neutraler Platz“ statt des Heimstadions, und das Livespiel trägt eigene Farben und den Namen des Wettbewerbs statt dem der Liga. Nach einem Elfmeterschießen im Endspiel heißt es „holt den Titel“ statt „steht in der nächsten Runde“.
- **Echte Europapokal-Qualifikanten:** Die Startplätze folgen den `europeanSpots` der Ligadefinition – England, Spanien und Italien stellen vier Champions-League-Teilnehmer, Frankreich drei. Kein Verein startet in zwei Wettbewerben.
- **Auf- und Abstieg über die gesamte Pyramide:** Aus jeder Liga steigen genauso viele Vereine ab, wie von unten aufsteigen; alle Ligen behalten ihre Mannschaftszahl. Aufsteiger nehmen ihren Kader mit und starten bewusst als Außenseiter.
- **Relegation und Aufstiegs-Playoffs nach echtem Format (`PlayoffEngine`):**
  - **Deutschland:** Der 16. der 1. Liga spielt gegen den Dritten der 2. Liga (Hinspiel beim Erstligisten), der 16. der 2. Liga gegen den Dritten der 3. Liga (Hinspiel beim Drittligisten).
  - **England:** In First Division und Second Division spielen Dritter bis Sechster ein Halbfinale mit Hin- und Rückspiel, der schlechter Platzierte zuerst zu Hause; das Finale ist ein Spiel auf neutralem Platz.
  - **Spanien:** In der Segunda gilt dasselbe, auch das Finale mit Hin- und Rückspiel; nach der Verlängerung kommt der besser Platzierte weiter, ein Elfmeterschießen gibt es nicht.
  - **Italien:** In der Seconda Divisione spielen Dritter bis Achter, die Vorrunde in einem Spiel beim besser Platzierten; bei Gleichstand gewinnt der besser Platzierte, und mit 15 Punkten Vorsprung steigt der Dritte direkt auf.
  - **Frankreich:** In der Deuxième Division spielt der Fünfte beim Vierten, der Sieger beim Dritten; der Gewinner trifft in der Barrage auf den 16. der Première Division.
  - **Ablauf:** Gespielt wird an fünf Tagen der Sommerpause. Die eigenen Spiele laufen wie ein Pokalabend – live oder sofort, der Weiter-Knopf hält davor. Alle anderen rechnet die Engine, die Verlängerung samt Toren inklusive.
  - **Anzeige:** Die Tabelle markiert Relegations- und Playoffplätze, der Reiter *Wettbewerbe* zeigt alle Paarungen mit Hin- und Rückspiel, Verlängerung und Elfmeterschießen.
  - **Saisonwechsel:** Die Ergebnisse entscheiden über Auf- und Abstieg; die Spiele zählen nicht zur Statistik der neuen Saison. Vorher stiegen feste Plätze auf – in der First Division etwa einfach der Dritte –, und die Relegationsplätze der Ligadaten wurden nie ausgewertet.
- **Ligawechsel in der Tabellenansicht:** Der Wettbewerbswähler im Reiter *Wettbewerbe & Spielplan* zeigt jede Liga der Welt mit eigener Tabelle und eigenem Spielplan.
- **Die Welt bleibt im Gleichgewicht:** Über sechs Saisons (Startwert 11, Schnitt der vierzehn Besten je Kader) stieg die Landesliga bisher von 22,9 auf 29,3, die Verbandsliga von 30,4 auf 37,3, die Zahl der Spieler ab 90 verdreifachte sich, und am Ende trieben 683 Vereinslose durch eine Welt von 5588 statt 4752 Spielern. Vier Ursachen, vier Änderungen:
  - **Talente:** Ihr Potenzial hing am jetzigen Können und lag im Mittel gut 8 Punkte über den gestandenen Spielern ihres Vereins – jede Generation wurde besser als die vorige. Jetzt liegt es um das Vereinsniveau, meist etwas darüber; 3 bis 8 % reichen 14 Punkte und mehr darüber hinaus (`PlayerGenerator.talentPotenzial`).
  - **Nachwuchs:** Jeder Verein hält mindestens drei statt fünf Spieler bis 21. Fünf war fast ein Viertel des Kaders und doppelt so viel, wie die Altersverteilung der erzeugten Welt hergibt; Jahr für Jahr rückten so Hunderte Talente nach, und die Verdrängten wurden vereinslos.
  - **Verträge und Vereinslose nach eigenem Niveau:** Ob ein KI-Verein verlängert oder einen Vereinslosen holt, misst er am Schnitt seiner vierzehn Besten (`ContractEngine.vereinsNiveau`). Vorher galten feste Grenzen aus der 1. Liga („wichtig ab 55“): In der Landesliga lief so jeder zweite Vertrag aus, und die Lücken füllten Vereinslose aus höheren Ligen. Geholt wird jetzt nur, wer höchstens 6 Punkte über und 12 unter dem Kader liegt.
  - **Wer keinen Verein findet, hört auf:** Ein Vereinsloser hat eine Saison Zeit, ein Talent bis 21 zwei; danach verlässt er den Profifußball. Im Transfermarkt steht das am Abzeichen *Ablösefrei*.
  - Nachher, gleicher Startwert: Landesliga 22,9 → 23,0, Verbandsliga 30,4 → 32,0, 1. Liga 80,5 → 80,2; 57 Vereinslose, 4910 Spieler. Die Weltspitze (Schnitt der besten 50) steigt in den ersten beiden Saisons von 90,1 auf 91,5 und bleibt dann bei 92; Spieler ab 90 sind es nach vier Saisons 90 statt 150. Mit Startwert 7 dasselbe Bild. Was die Zweite Liga danach noch zulegt (rund 1 Punkt), kam vor allem aus dem Tausch der Auf- und Absteiger – dazu der nächste Punkt.
  - **Absteiger geben ab (`SeasonEngine.abstiegsfolgen`):** Bisher nahm ein Absteiger seinen ganzen Kader mit. Erstliga-Absteiger lagen danach im Schnitt 2,1 Punkte über den Aufsteigern, die ihren Platz einnahmen (vier Startwerte, fünf Saisons), und jeder Tausch hob die Zweite Liga. Jetzt zieht, wer für die neue Liga deutlich zu gut ist, seine Klausel für den Abstieg. Er wechselt für 60 % der üblichen Ablöse zu einem passenden KI-Verein der alten Liga oder darüber, Aufsteiger zuerst – aber nur, bis der Absteiger nicht mehr stärker ist als die Aufsteiger. Danach liegen beide gleichauf (−0,1). Ohne diese Bremse lagen Absteiger 1,7 bzw. 3,9 Punkte darunter, und die Dritte Liga verlor Stärke. Steigt der eigene Verein ab, geht niemand ungefragt: Die Spieler äußern einen Wechselwunsch, und der Trainer entscheidet.
  - **Karriereende ab 31 (`SeasonEngine.karriereendeChance`):** Es begann erst mit 32 und hing an festen Stärkegrenzen („ab 78 später, unter 55 früher“) – in den Bundesligen spielte so fast jeder länger, in den Amateurligen fast jeder kürzer. Vor 31 verließ kaum jemand die Welt, die Mitte alterte durch: Der Anteil ab 31 stieg auf 25 %. Jetzt beginnt das Karriereende mit 31, in den Amateurligen ab Stufe 5 mit 30, und wird je Jahr um 15 Punkte wahrscheinlicher. Die Stärke zählt am eigenen Kader: Ein Leistungsträger hängt eher ein Jahr dran, ein Ergänzungsspieler hört eher auf. Der Altersschnitt während der Saison bleibt bei 26,3 bis 26,5 statt auf 27,0 zu steigen (Bundesligen 26,7, Ligen 5 bis 7 25,6), der Anteil ab 31 liegt bei 17 %. Die Ligastärken ändern sich dabei nicht.

### 8b. 💾 Kompaktes Speicherformat (`SaveCodec`)
Eine komplette Welt mit über 4300 Spielern belegt als gewöhnliches JSON knapp 6 MB. Seit der Spielstand in IndexedDB liegt, ist das keine harte Grenze mehr – kleiner bleibt trotzdem schneller beim Speichern, Laden und Exportieren. Der `SaveCodec` wandelt Spieler und Spielplan-Partien deshalb in positionale Arrays um und legt alle Zeichenketten in einer gemeinsamen Tabelle ab. Namen, Nationalitäten und Positionen tauchen nur noch einmal auf.

- **5,9 MB → 1,6 MB** bei verlustfreier Rückwandlung; unbekannte Zusatzfelder überleben die Umwandlung in einem Restobjekt.
- Gespielte Partien geben ihre Timeline frei (rund 22 KB je Spiel) – die Zähler stecken danach ohnehin in `stats` und `events`.
- Partien fremder Ligen behalten nur das Ergebnis; nur die eigenen Spiele behalten Einzelkritiken, Ereignisse und Aufstellungen.
- **Taktiken je Spielstil gepackt:** Jede Vereinstaktik hat über vierzig Anweisungen, fast alle so, wie ihr Spielstil sie vorgibt. Je Stil steht die häufigste Taktik einmal als Vorlage im Stand; jeder Verein trägt nur seine Abweichungen (verlustfrei, samt fehlender Anweisungen und Reihenfolge). Fitness, Moral, Form und Notensumme werden auf drei Nachkommastellen gerundet – die Moral stand vorher mit vierzehn im Stand.
- Mit den neuen Ligen (384 Vereine, gut 8300 Spieler) liegt ein frischer Stand bei **3,5 MB** statt 3,9 MB. Das passt auch in den LocalStorage, der nur einspringt, wenn IndexedDB scheitert, und rund fünf Millionen Zeichen fasst.

### 9. 🎯 100% Synchrone Timeline-MatchEngine & 2D-Visualisierung
- **Deterministische Match-Timeline (`MatchEngine.generateTimeline`):** Generiert chronologische Ketten von Spielzügen (Pässe, Flanken, Dribblings, Schüsse, xG, Glanzparaden, Tore, Karten) inklusive 2D-Koordinaten (`start`, `end`).
- **Exakte 2D-Parität:** Die 2D-Simulation (`LiveMatch`) und die Sofortsimulation (`simulateFullMatch`) werten exakt dieselbe Timeline aus. Alle Torschützen, Vorlagengeber, Ticker-Texte, Statistiken und Spielberichte stimmen 1:1 mit der 2D-Darstellung überein.

### 10. 🌍 Länderspiele, Kabine, Verträge, Wetter, Trainerprofil und U23

- **Nationalmannschaften und Länderspielpausen (`NationalTeamEngine`):** Viermal im Jahr ruht die Liga. Jede Nation mit genug Spielern im Spiel nominiert ihren Kader (3 Torhüter, 8 Abwehr, 7 Mittelfeld, 5 Sturm), die Nationalspieler reisen ab, bestreiten zwei Länderspiele und kehren müde zurück – manchmal verletzt. Länderspiele und Tore stehen in der Spielerakte.
- **Nationaltrainer werden (Reiter *Nationalteam*):** Neben dem Verein lässt sich eine Nationalmannschaft übernehmen.
  - Jede Saison wird rund ein Viertel der Posten frei. Der Verband verlangt einen Ruf nach Weltrang: 82 für die besten drei, 72 bis Rang 8, 62 bis Rang 14, sonst 52; für die eigene Nationalität 6 weniger. Wer genug Ruf hat, bewirbt sich oder bekommt zum Saisonstart ein Angebot.
  - Vor jeder Länderspielpause bestimmt der Nationaltrainer 23 Spieler (vorgeschlagen sind die Besten je Mannschaftsteil) und die Ausrichtung: defensiv weniger Tore auf beiden Seiten, offensiv mehr. Fällt ein Gewählter aus, rückt der Beste seines Mannschaftsteils nach – aber keiner, den der Trainer aus dem Vorschlag gestrichen hat, solange es einen anderen gibt. Der Verband sagt mit Namen Bescheid.
  - Der Verband misst jedes Spiel an den Punkten, die nach Stärke zu erwarten waren. Liegt sein Vertrauen zum Saisonende unter 25 %, ist der Posten weg – der Verein bleibt davon unberührt. Mit Rückhalt steigt der Ruf als Trainer (+4 bei einer Nation unter den besten acht, sonst +2).
  - Beim Prüfen gefunden: Bei ungerader Zahl von Nationen bekam die letzte in der zweiten Runde einer Pause zwei Spiele am selben Tag. Jetzt setzt dann eine aus. Und im Browser-Rundgang holte die Nachnominierung genau den Star zurück, den der Trainer gestrichen hatte – sie nahm schlicht den Besten.
- **Kabinenhierarchie (`DressingRoomEngine`):** Führungsspieler, Neuzugänge und Grüppchen nach Sprache, jede Gruppe mit Wortführer und Stimmung. Ein unzufriedener Wortführer färbt auf seine Gruppe ab, ein unzufriedener Kapitän auf alle. Den Kapitän bestimmt der Trainer; wer einen Führungsspieler verkauft, hat ein paar Tage Unruhe.
- **Verträge:** Neben Gehalt und Laufzeit gehören Beraterhonorar, Einsatz- und Torprämien dazu. Prämien schonen das feste Gehalt und werden nach jedem Spiel ausgezahlt. Leihen können eine **Kaufoption** haben; KI-Vereine ziehen sie, wenn der Spieler gespielt hat und das Geld reicht.
- **Wetter und Platz (`WetterEngine`):** Jede Partie bekommt Wetter nach Jahreszeit und einen Rasen nach Ligastufe. Nasser Rasen macht Fernschüsse tückisch, tiefer Boden kostet Kraft und Genauigkeit, Wind verweht lange Bälle, Hitze zehrt an der Ausdauer. Vorschau, Livespiel und Spielbericht zeigen es an.
- **Spielanalyse:** Zu jedem eigenen Spiel – live oder als Sofort-Ergebnis – gehören Heatmaps beider Mannschaften und ein Passnetz: wer mit wem wie oft zusammengespielt hat und wo er im Schnitt stand. Fehlen die Laufwege (ältere Spielstände), sagt der Bericht das, statt eine Karte zu erfinden.
- **Trainerprofil (`TrainerProfilEngine`):** Fünf Werte von 1 bis 20 (Taktik, Motivation, Menschenführung, Jugendarbeit, Spielerbewertung), die wirklich wirken – auf Vertrautheit, Ansprachen, Einzelgespräche, Talententwicklung und Scoutberichte. Dazu B-, A- und Pro-Lizenz: Ab der Regionalliga verlangt der Verband die A-Lizenz, in den Bundesligen die Pro-Lizenz. Lehrgänge kosten Geld und Zeit. Am Saisonende wächst, was gefordert war.
- **Zweite Mannschaft (U23, `ReserveEngine`):** Talente, die bei den Profis nicht spielen, schickt man in die U23. Sie spielt an jedem Spieltag ein Spiel ihrer eigenen U23-Liga und bringt Spielpraxis (etwas weniger als bei den Profis), Spielschärfe und eine eigene Bilanz. Höchstens drei Spieler über 23, im Profikader bleiben mindestens 16. Die KI-Vereine geben ihren Talenten ohne Einsatz ebenfalls etwas Praxis.
- **Zugriff auf U23 und U19 (`ReserveEngine`, `YouthEngine.hochziehen`):** Beide Kader stehen mit ihrer Bilanz da, und wer gebraucht wird, ist mit einem Tipp bei den Profis.
  - **Bilanz je Spieler:** In U23 und U19 bekommt jeder in der Elf eine Note: Tore, Ergebnis, Stärke gegenüber der Elf und etwas Tagesform. Gezählt werden Spiele, Tore, Schnitt und Form (die letzten drei). Wer in drei Spielen eine Form ab 7,2 hat, ist mit ⭐ markiert.
  - **Kader-Reiter, Block „Unterbau“:** die U23 mit Bilanz und Knopf *Zu den Profis*, darunter die U19-Kandidaten, die alt genug sind, mit *Hochziehen*.
  - **Reiter Jugend:** der ganze Kader der U19 mit Talenten und jungen Profis, nach Form sortiert.
  - **Hochziehen:** Ein Talent ab 16 kommt sofort zu den Profis, ohne Berater und ohne Profivertrag. Es spielt mit seinem Jugendvertrag: Ausbildungsvergütung als Gehalt, Laufzeit bis 19.
    - Den Profivertrag bietet man in der Akte an, ab dem Mindestalter des Landes (in England 17).
    - Läuft der Jugendvertrag aus, ohne dass er unterschreibt, ist er frei.
    - Solange ein Verein um ihn wirbt oder über seinen ersten Vertrag verhandelt wird, geht es nicht.
    - Hochziehen schützt nicht vor Werbern: Bis er einen Profivertrag hat, darf weiter um ihn geworben werden. *Perspektive aufzeigen* und *Ziehen lassen* stehen dann in seiner Akte. Der Schreibtisch führt direkt dorthin. Geht er, kommt die Ausbildungsentschädigung, und ein Profivertrag beendet die Anfrage.
  - **Nur für den Spieltag (`ReserveEngine.nominieren`):** Neben *Ganz hoch* steht überall *Spieltag*. Wer so hochkommt, steht für Elf und Bank bereit, auch im Pokal dazwischen, und geht nach dem nächsten Ligaspiel von selbst zurück in U23 oder U19. Ein Talent kommt dabei mit seinem Jugendvertrag und spielt danach als junger Profi in der U19. *Behalten* macht die Nominierung dauerhaft, *Zurück* beendet sie sofort.
  - **In die U19:** Junge Profis bis 19 schickt man über die Akte in die U19. Dort spielen sie mit und stehen den Profis nicht zur Verfügung. Wer aus der Elf oder als einer der Besten hinunter muss, verliert an Moral. Wer beim Saisonwechsel 20 wird, kehrt von selbst zurück.
  - **Schreibtisch:** Sind weniger als 16 Profis einsatzbereit oder ist kein Torwart fit, meldet er Personalnot und nennt die drei besten Kandidaten aus U23 und U19, die in Form zuerst. Ein Tipp auf den Namen öffnet die Akte dort, wo er hochgeholt wird. Sind genug Profis fit, aber in einem Mannschaftsteil weniger, als die Formation dort braucht, meldet er einen Engpass, etwa „Engpass in der Abwehr: 3 fit, die Formation braucht 4“, mit Kandidaten für genau diese Positionen. Wer im Unterbau glänzt, steht ebenfalls dort.
  - **Aufstellung:** Bei Personalnot oder Engpass steht derselbe Hinweis über dem Feld, mit den Kandidaten und dem Knopf *Spieltag*.
- **Taktik:** Konter und tiefer Block wurden überarbeitet – Umschalten mit Verzögerung für Verteidiger, Befreiungsschläge aus der tiefen Linie, Laufwege in die Tiefe. Gemessen gegen einen hoch pressenden Favoriten (24 Spiele je Variante): Konter holt 0,71 Punkte je Spiel statt 0,38 mit der Grundeinstellung; der tiefe Block, der nach Ballgewinn sofort nach vorn spielt, kassiert 1,79 statt 2,88 Tore. Ehrlich gesagt: Gegen eine viel stärkere Mannschaft bleibt der tiefe Block auch so die schwierigste Wahl.
- **Langzeittest (acht Saisons, alle zwölf Ligen, Schnitt aller Spieler je Stufe):** Die Ligastufen bleiben stabil (Zweite Liga 64,1 → 64,1, Landesliga 21,3 → 21,0; vor dem Gleichgewicht der Welt, siehe Abschnitt 8, stieg die Landesliga schon in fünf Saisons von 21,0 auf 25,7). Die 1. Liga verliert in der Breite leicht (76,0 → 74,5, vorher 73,6), ihre vierzehn Besten je Kader nicht. Die Weltspitze wächst in den ersten Saisons und bleibt dann stehen (Schnitt der besten 50: 89,8 → 91,8, Höchstwert 94–95). 44 Vereinslose nach acht Saisons – vor dem Gleichgewicht waren es schon nach fünf 584. Am Saisonende, bevor Karriereenden und Nachwuchs greifen, liegt der Altersschnitt bei 27,4 (vorher 27,9); während der Saison bei 26,3 bis 26,5. Der Spielstand wächst von 2,1 auf 3,1 MB. Der Favorit nach Kaderstärke wird in 39 % der Ligen Meister, in 74 % kommt der Meister aus den drei stärksten Kadern (96 Meisterschaften). Offen: Ober- und Verbandsliga legen über acht Saisons gut einen Punkt zu (37,4 → 38,9 und 28,6 → 29,8) – das war vor diesen Änderungen genauso.
- **Abnahme (zehn Saisons ohne Eingriff, zwei Saisons Durchklicken am Handy):**
  - **Zehn-Saisons-Lauf:** keine Abstürze, keine ungültigen Werte, kein Kader unter 18 Spielern, Laden nach zehn Saisons ohne Abweichung. Der Spielstand wächst von 3,3 auf 5,1 Mio. Zeichen und liegt in IndexedDB. Supercups, Europäischer Supercup, EM und WM, Fünfjahreswertung und Finanzregeln laufen jede Saison mit. Die ersten Ligen bleiben stabil (1. Liga 79,9 → 81,0, Premier Division 81,1 → 82,2); zweite und dritte Ligen verlieren über zehn Saisons gut einen Punkt (2. Liga 69,9 → 68,4, Second Division 62,1 → 60,7).
  - **Durchklick-Test:** zwei komplette Saisons nur über die Oberfläche bei 390 × 844 Pixeln (Assistent, Weiter-Knopf, Sofort-Ergebnis, alle Dialoge, Rundgänge durch alle Reiter): 91 Spiele, keine Skriptfehler, nichts ragt außerhalb scrollbarer Tabellen über den Rand.
  - **Gefunden und behoben:**
    - Die Ansprache vor dem Anpfiff und die Pressekonferenz ließen sich über das Kreuz nicht schließen. Wer keine Ansprache halten wollte, saß fest, in der Halbzeit mitten im angehaltenen Spiel. Jetzt geht es ohne Ansprache weiter, dazu gibt es den Knopf „Ohne Ansprache auf den Platz“.
    - Nach dem Saisonende blieb ein geheilter Spieler als verletzt markiert. Die Prüfung vor dem Anpfiff sperrte ihn, „Beste 11“ stellte ihn trotzdem wieder auf, und das Spiel ließ sich nicht anpfeifen. Prüfung, KI-Aufstellung und Validierung zählen jetzt dieselben Werte (Verletzungsdauer und Sperren); gesperrte Spieler in der Startelf wurden vorher gar nicht gemeldet.
    - Die Frage vor dem ersten Spieltag hieß immer „Ohne Arzt in die Saison?“, auch wenn nur der Co-Trainer fehlte. Jetzt nennt sie die fehlenden Posten.
    - Deutschland fiel in der Fünfjahreswertung dauerhaft auf den letzten Platz, im Schnitt 3,8 Punkte je Saison hinter Frankreich. Drei Ursachen:
      - Freie Europapokal-Plätze rückten nach Ruf nach, bis zu acht schwache deutsche Vereine in der Euro-Cup. Jetzt rücken sie reihum je Land nach, jeweils der nächstplatzierte Verein.
      - Die handgepflegten Erstliga-Spieler hatten bei gleicher Gesamtstärke gut vier Punkte schwächere Einzelwerte als die erzeugten, und die Spiel-Engine rechnet mit den Einzelwerten. Beim Anlegen der Welt bekommt jetzt jeder so viel dazu, wie ihm im Schnitt gegenüber dem Profil seiner Position fehlt; Stärken und Schwächen bleiben.
      - Die erzeugten ersten Ligen waren alle gleich stark, die Première Division so stark wie die Premier Division. Jetzt haben sie eine Länderstärke: England vorn, Spanien, 1. Liga und Italien auf Augenhöhe, Frankreich dahinter.
    - Danach liegt Deutschland in den ersten Saisons meist auf Rang 4, später teils auf Rang 5, im Schnitt 0,5 bis 1,3 Punkte je Saison hinter den anderen (gemessen in sechs Läufen über je sechs Saisons).
  - **Tempo über zehn Saisons:** Gespeicherte Stände aus Saison 1 und Saison 10, jeweils frisch geladen: Ein ruhiger Tag dauert in Saison 10 58–63 ms statt 74–76 ms, ein Spieltag 1,07–1,13 s statt 1,14–1,18 s. Wer neu lädt, spielt in Saison 10 also so schnell wie in Saison 1. Laufen zehn Saisons ohne Neuladen im selben Prozess durch, wächst die Rechenzeit dagegen auf etwa das 1,45-Fache (Saison 1: 49 s, Saison 10: 71–72 s). Das liegt nicht an den Daten, sondern daran, wie die JavaScript-Engine über lange Laufzeit ihre Zugriffswege anpasst; Neuladen setzt es zurück. Ein Versuch, Felder mit `undefined` statt `delete` zu leeren, machte es langsamer und ist verworfen.
    - **Frisch laden beim Saisonwechsel:** Nach jeweils drei Saisonwechseln ohne Neuladen sichert das Spiel den Stand, lädt die Seite neu und setzt die Karriere ohne Startbildschirm fort (`UIManager.FRISCH_NACH_SAISONS`). Geprüft wurde vorher, ob sich das Abbremsen im Spiel selbst beheben lässt: Die De-Optimierungen der Engine nehmen von Saison zu Saison ab (210, 34, 15, 6), sie sind also nicht die Ursache. Ohne sichere Speicherung wird nicht neu geladen.
  - **Offen:** Die echte 1. Liga ist hinter den ersten vier dünner besetzt als die erzeugten Ligen mit ihrer flachen Spitze, das kostet Deutschland im Europapokal noch etwas. Zweite und dritte Ligen verlieren über zehn Saisons gut einen Punkt.
- **Lesbarkeit:** Gedimmte Schrift erreicht jetzt auf allen Kartenflächen mindestens 4,5:1 Kontrast (vorher 2,7:1). Überschriften und Knöpfe zeigen Symbole aus dem Iconset statt bunter Emojis.

---

## 🏷️ Namensdatei

Das Spiel bringt nur erfundene Namen mit. Eigene Namen kommen über eine JSON-Datei, die nur im Browser des Spielers liegt (`js/engine/namenEngine.js`):

```json
{
  "format": "fmpro-namen-1",
  "titel": "Meine Namen",
  "wettbewerbe": { "de_liga_1": "…", "de_cup": "…", "supercup_de": "…", "ucl": "…" },
  "vereine": { "muc": { "name": "…", "stadion": "…", "sponsor": "…" } },
  "spieler": { "1": "…", "2": "…" }
}
```

- **Laden:** Einstellungen → *Namen* → *Namensdatei laden*, oder auf dem Startbildschirm *Namensdatei laden*. Die Namen gelten sofort, für neue Karrieren wie für die laufende; jeder Spielstand übernimmt beim Laden die aktuelle Wahl.
- **Vorlage:** *Vorlage herunterladen* liefert alle Kennungen mit den erfundenen Namen – 384 Vereine, die 290 Spieler der ersten deutschen Liga (Kennungen 1 bis 290 in der Reihenfolge von `initialData.js`) und 28 Wettbewerbe.
- **Freiwillig:** Jeder Eintrag ist freiwillig. Was fehlt, behält seinen erfundenen Namen. Namen werden auf 60 Zeichen gekürzt, spitze Klammern fallen weg.
- **Zurück:** *Erfundene Namen verwenden* entfernt die Datei wieder. Ein Sponsor, den der Verein in der Karriere neu abgeschlossen hat, bleibt dabei unangetastet.

---

## 📁 Modulare Projektarchitektur

```plain text
untitled/
├── index.html                  # Hauptoberfläche & Responsive Shell
├── manifest.json               # PWA-Manifest (Name, Symbole, Vollbildmodus)
├── icon-192.png                # App-Symbol für den Startbildschirm
├── icon-512.png                # App-Symbol in hoher Auflösung (auch maskierbar)
├── service-worker.js           # Offline-Caching & PWA Service Worker
├── css/
│   └── style.css               # Modernes Dark-Mode UI Theme
├── js/
│   ├── app.js                  # App-Initialisierung & Controller
│   ├── core/
│   │   ├── constants.js        # Zentrale Konstanten & Enums
│   │   ├── moduleResolver.js   # Einheitliche Modulauflösung für Browser und Node
│   │   ├── dom.js              # Fehlertolerante DOM-Hilfsfunktionen
│   │   ├── formatters.js       # Formatierer für Geld, Datum, Prozente
│   │   ├── random.js           # Mathematische Zufallsgeneratoren
│   │   └── validators.js       # StateValidator für Spielstand, Aufstellung & Spielplan
│   ├── data/
│   │   ├── initialData.js      # 18 Erstliga-Vereine & Spielerdaten
│   │   ├── leagueData.js       # Top-5-Ligen, Ligapyramide, Pokale & Europa-Wettbewerbe
│   │   ├── countryNamePools.js # Landestypische Spieler-, Städte- und Vereinsnamen (DE/EN/ES/IT/FR)
│   │   └── namePools.js        # Namenspools für Jugend & Neugenerierungen
│   ├── services/
│   │   ├── saveService.js      # Speichern, Laden, Exportieren, Importieren
│   │   ├── speicherDB.js       # IndexedDB-Hülle: Spielstand ohne 5-MB-Grenze
│   │   ├── saveCodec.js        # Kompaktes Speicherformat: 5,9 MB Welt werden zu 1,6 MB
│   │   └── migrationService.js # Schema-Migrationen für Abwärtskompatibilität (v1 -> v6)
│   ├── engine/
│   │   ├── gameState.js        # Zentraler Zustand & Liga-Generator
│   │   ├── matchEngine.js      # Timeline-basierte Spielberechnung & synchrone 2D-Live-Canvas-Engine
│   │   ├── liveMatchDirector.js# Echtzeit-Regie der 2D-Simulation: Highlights, Ballführung, Laufwege
│   │   ├── matchFlowEngine.js  # Ballbesitz-Mikrosimulation: Druck, Passwege, Dribblings, Zweikämpfe
│   │   ├── positionEngine.js   # Positionsprofile, Eignungsmodell, Zonen- & Formationserkennung
│   │   ├── tacticsEngine.js    # Taktik: Formen mit/gegen Ball, Rollen, Anweisungen, Vorlagen, Verbindungen
│   │   ├── seasonEngine.js     # Spieltagsfortschritt & Saisonabschluss
│   │   ├── competitionEngine.js# Ligen, Pokalrunden, Europapokal & Auf-/Abstieg
│   │   ├── worldGenerator.js   # Baut die Welt: 384 Vereine in zwanzig Ligen samt Spielplänen
│   │   ├── clubGenerator.js    # Landestypische Vereine mit Ruf, Stadion und Etat je Ligastufe
│   │   ├── playerGenerator.js  # Kader nach Ligastufe & Vereinsruf, Attributprofile je Position
│   │   ├── transferEngine.js   # Markt- & Transferlogik
│   │   ├── negotiationEngine.js# Mehrtägige Verhandlungen mit Vereinen und Beratern
│   │   ├── managerEngine.js    # Kabinenansprachen, Pressekonferenzen & Aufgabenliste
│   │   ├── matchplanEngine.js  # Taktikbesprechung: Matchplan für ein Spiel
│   │   ├── gegneranweisungEngine.js # Anweisungen je Gegenspieler (Anlaufen, Zweikampf, Fuß)
│   │   ├── playerTalkEngine.js # Gespräche unter vier Augen, Versprechen, Wechselwünsche
│   │   ├── developmentPlanEngine.js # Schwerpunkt, Umschulung, Eigenheit, Mentor, Spielpraxis
│   │   ├── loanEngine.js       # Verleihen, Leihmarkt, Gehaltsanteile, Kaufoption, Rückkehr
│   │   ├── reserveEngine.js    # Zweite Mannschaft (U23): Spielpraxis, Bilanz, Regeln
│   │   ├── nationalTeamEngine.js # Nationalmannschaften, Nominierungen, Länderspielpausen, Nationaltrainer
│   │   ├── dressingRoomEngine.js # Kabine: Moral, Hierarchie, Grüppchen, Kapitän
│   │   ├── wetterEngine.js     # Wetter und Platzverhältnisse je Partie
│   │   ├── trainerProfilEngine.js # Trainerwerte, Lizenzen, Lehrgänge, Ruf
│   │   ├── trainingEngine.js   # Tägliche Belastung, Ermüdung, Risiko & Entwicklung
│   │   ├── financeEngine.js    # Spieltagseinnahmen, Gehälter & Journal
│   │   ├── boardEngine.js      # Vorstandszufriedenheit & Saisonziele
│   │   ├── auszeichnungEngine.js # Spieler/Talent/Trainer des Monats, Saisonpreise, Elf der Saison
│   │   ├── chronikEngine.js    # Vereinschronik: Rekorde, Titel, Saisonbilanzen, Legenden
│   │   ├── trainerwechselEngine.js # Trainer der KI-Vereine, Entlassungen, Nachfolger mit eigenem Stil
│   │   ├── ligaNachrichtenEngine.js # Saisonvorschau, Rundschau, Gerüchteküche
│   │   ├── spielvorschauEngine.js # Quoten, direkter Vergleich, Ausfälle vor dem nächsten Spiel
│   │   ├── partnerEngine.js    # Ausbildungspartner mit Einsatzgarantie, großer Partner mit Leihangeboten
│   │   ├── investorEngine.js   # Investoren, Übernahmen, 50+1, Rettung mit Auflagen und Punktabzug
│   │   ├── ehemaligeEngine.js  # Ehemalige Spieler im Trainerstab, Abschiedsspiel für Legenden
│   │   ├── visionEngine.js     # Vereinsvision: Fernziel mit Frist, Jahresziele, Bilanz
│   │   ├── kaderplanungEngine.js # Kader über drei Spielzeiten, Baustellen als Suchauftrag
│   │   ├── kaderregelEngine.js # Meldelisten: Europapokal (25, acht ausgebildet, Liste B), Premier Division, Primera División (Nicht-EU)
│   │   ├── koeffizientEngine.js # Fünfjahreswertung der Länder und Startplätze im Europapokal
│   │   ├── turnierEngine.js    # EM und WM im Sommer: Gruppen, K.-o.-Runden, Titel
│   │   ├── finanzregelEngine.js # Kaderkostenquote: Verwarnung, Geldstrafe, Punktabzug
│   │   ├── klauselEngine.js    # Steigerung, Auf-/Abstieg, Mindestablöse, Vereinsoption
│   │   ├── newsEngine.js       # Zentrales Nachrichtensystem & Postfach
│   │   ├── aiManagerEngine.js  # KI-Aufstellungen & KI-Transferangebote
│   │   ├── scoutingEngine.js   # Scoutaufträge & Spielerberichte
│   │   ├── youthEngine.js      # Jugendförderung & Akademieausbau
│   │   ├── contractEngine.js   # Vertragsforderungen, Verlängerungen & Ausstiegsklauseln
│   │   ├── sportdirektorEngine.js # Spielervorschläge und Beratung des Sportdirektors
│   │   ├── calendarEngine.js   # Saisonkalender & dynamischer Tagesablauf
│   │   ├── datenzentraleEngine.js # Liga nach xG und xPunkten, Form, Spielerwerte, Spielervergleich
│   │   ├── jobmarktEngine.js   # Anfragen, offene Stellen, Bewerbung, Wechsel und Rücktritt des Trainers
│   │   ├── laufbahnEngine.js   # Laufbahn je Spieler: Saison, Verein, Spiele, Tore, Vorlagen, Note
│   │   ├── urlaubEngine.js     # Urlaub: Ziele bis Monats-, Fenster- und Saisonende, Bilanz
│   │   ├── supercupEngine.js   # Supercup: Meister gegen Pokalsieger am Ende der Vorbereitung
│   │   ├── euroSupercupEngine.js # Europäischer Supercup: Sieger der Königsklasse gegen den der Kontinentalpokal
│   │   ├── jahrespreisEngine.js # Gala des Jahres: Weltfußballer, Talent, Torjäger Europas, Trainer, Elf
│   │   ├── statistikEngine.js  # Statistik je Wettbewerb: Liga, Pokal, Europapokal
│   │   └── opponentAnalysisEngine.js # Taktische Gegneranalyse
│   ├── ui/
│   │   ├── uiManager.js        # Kern: Reiter, Kopfzeile, Übersicht, Kalender, Weiter-Knopf, Saisonwechsel, Ereignisse
│   │   ├── uiAssistent.js      # Startbildschirm und Assistent: Liga- und Vereinswahl
│   │   ├── uiKader.js          # Kader: Kennzahlen, Kabine, Kaderplanung, Meldeliste
│   │   ├── uiTaktik.js         # Taktiktafel, Formationen, Rollen, Aufstellung
│   │   ├── uiWettbewerbe.js    # Tabellen, Spielplan, Pokal, Relegation, Europapokal
│   │   ├── uiTraining.js       # Reiter Training (Pläne, Trainerstab, Bericht) und Jugend (Akademie, Talente, U19)
│   │   ├── uiFinanzen.js       # Budget umschichten, Raten, Finanzregeln, Vorstandsanfragen
│   │   ├── uiVerein.js         # Vereinsseite: Jobmarkt, Vision, Investor, Partner, Chronik, Anlagen, Preise
│   │   ├── uiPostfach.js       # Postfach: Liste und Nachricht
│   │   ├── uiDialoge.js        # Gegneranalyse, Transferangebot, Matchplan, Ansprache
│   │   ├── uiKarriere.js       # Entlassung, Angebote an den Trainer, Laufbahnende, Zeugnis
│   │   ├── uiSpielfeld.js      # Leinwand des 2D-Spiels: Rasen, Radar, Einblendungen, Stadionklang
│   │   ├── klang.js            # Pfiffe, Stadionkulisse, Menütöne und Menümusik (Web Audio, ohne Aufnahmen)
│   │   ├── uiVorbereitung.js   # Vorbereitung: Stab, Sponsoren, Testspiele, Turniere
│   │   ├── uiTransfers.js      # Verhandlungen, Leihen, U23, Transfermarkt, Scoutberichte
│   │   ├── uiAkten.js          # Spieler- und Vereinsakte: Reiter, Werte, Vertrag
│   │   ├── uiSeiten.js         # Eigene Seiten im Inhaltsbereich: zeigen, ablösen, Zurück über den Verlauf
│   │   ├── uiProfil.js         # Spielerprofil als eigene Seite: Kopf, Übersicht, Kacheln
│   │   ├── uiProfilLaufbahn.js # Spielerprofil: Laufbahn in sieben Kacheln wie im Vorbild
│   │   ├── uiAngebot.js        # Transferangebot als eigene Seite: Angebot, Folgen, Käufer, Entscheidung
│   │   ├── uiVereinSeite.js    # Vereinsprofil als eigene Seite: Kopf, Übersicht, Kader, Spiele, Geschichte
│   │   ├── uiLivespiel.js      # Match-Center, Zurufe, Seitenlinie während der Partie
│   │   ├── uiLiveKacheln.js    # Livespiel als Kachelansicht: Aufstellungen, Statistik, Bank, Leiste
│   │   ├── uiLiveDarstellung.js # Torwiederholung im 2D-Bild, Pass- und Laufwege
│   │   ├── uiSpielbericht.js   # Spielbericht mit Schusskarte, Heatmaps und Passnetz
│   │   ├── uiSpeicher.js       # Speicherplätze, Sicherungen, Laden, Löschen, Import
│   │   ├── uiEinstieg.js       # Erste Schritte, Erklärkästen, Kurzanleitung und Begriffe
│   │   ├── uiNational.js       # Reiter Nationalteam: freie Posten, Kader, Ausrichtung, Ergebnisse
│   │   ├── uiDaten.js          # Datenzentrale und Spielervergleich
│   │   └── spielfeld3d.js      # 3D-Ansicht des Livespiels (three.js, nachgeladen): Stadion, Figuren, Bewegungen, Wiederholung, Qualitätsstufen
│   └── vendor/
│       └── three.min.js        # three.js r159 (MIT-Lizenz, THREE_LICENSE daneben)
├── pruefung.js                 # Statische Prüfung: Syntax, doppelte Methoden, globale Namen, Offline-Vorrat, CSS-Klammern
├── test_filter.js              # Gemeinsame Testhilfen: Filter, Laufzeiten, schneller Lauf, feste Zufallswerte
├── test_runner.js              # Zentraler Runner für alle Testsuiten
├── test_data.js                # Datenintegrität & Strukturprüfungen
├── test_wizard.js              # Wizard-Filter, DOM-Simulation & Regressionstests
├── test_engine.js              # Unit- & Modultests für alle Engines
└── test_e2e.js                 # End-to-End- & Mehr-Saison-Simulationstests
```

---

## 📱 Auf dem Smartphone spielen

### Die kurze Antwort auf „einfach index.html doppelklicken?"

**Auf dem Handy geht das leider nicht.** Am PC lädt der Browser bei einem Doppelklick auf `index.html` auch die 39 JavaScript-Dateien und das Stylesheet aus dem Ordner daneben. Auf dem Telefon ist genau das gesperrt: Android Chrome und iOS Safari erlauben einer lokal geöffneten HTML-Datei nicht, ihre Nachbardateien nachzuladen – die Seite bliebe schwarz. Das ist eine Sicherheitsentscheidung der Browser, keine Eigenheit dieses Projekts.

Der Ersatz ist aber genauso bequem und muss nur **einmal** eingerichtet werden. Danach liegt das Spiel als Symbol auf dem Startbildschirm und läuft **auch ohne Internet**.

---

### Weg 1: Einmal veröffentlichen, dann für immer auf dem Startbildschirm ⭐

Das ist der empfohlene Weg. GitHub stellt das Projekt kostenlos als Webseite bereit, das Handy installiert es als App.

**Einmalig am PC (etwa zwei Minuten):**

1. Repository auf GitHub öffnen → **Settings** → links **Pages**
2. Unter *Build and deployment* → *Source*: **Deploy from a branch**
3. Branch: **`master`**, Ordner: **`/ (root)`** → **Save**
4. Eine Minute warten, dann steht oben auf derselben Seite die Adresse:
   `https://<dein-benutzername>.github.io/fussball-manager/`

**Einmalig auf dem Handy:**

| | |
|---|---|
| **Android (Chrome)** | Adresse öffnen → Menü `⋮` → **„App installieren"** bzw. **„Zum Startbildschirm hinzufügen"** |
| **iPhone (Safari)** | Adresse öffnen → Teilen-Symbol `⎙` unten → **„Zum Home-Bildschirm"** |

> Auf dem iPhone muss es **Safari** sein. Chrome auf iOS kann keine Web-Apps auf den Startbildschirm legen.

Danach startet das Spiel im Vollbild ohne Browserleisten, hat ein eigenes Symbol und funktioniert **im Flugmodus**: Beim ersten Aufruf legt der Service Worker alle 45 Dateien im Gerätespeicher ab.

### Weg 2: Nur im Heimnetz, ohne etwas zu veröffentlichen

Wenn das Spiel nicht öffentlich im Netz stehen soll: PC und Handy ins selbe WLAN, dann am PC im Projektordner einen kleinen Server starten.

```bash
# Im Projektordner (Python ist auf macOS und Linux vorinstalliert)
python3 -m http.server 8000

# Windows mit Python
py -m http.server 8000

# Alternativ mit Node.js, falls installiert
npx --yes serve -l 8000
```

Dann die IP-Adresse des PCs herausfinden:

```bash
hostname -I | awk '{print $1}'     # Linux
ipconfig getifaddr en0             # macOS
ipconfig                           # Windows: "IPv4-Adresse" ablesen
```

Am Handy im Browser `http://<IP-des-PCs>:8000` aufrufen, zum Beispiel `http://192.168.178.42:8000`.

> Der PC muss dabei laufen, und über `http://` (ohne S) im lokalen Netz installiert Android die App nicht dauerhaft. Zum Ausprobieren ist der Weg ideal, zum täglichen Spielen ist Weg 1 der bessere.

### Weg 3: Am PC bleibt alles wie gehabt

`index.html` doppelklicken genügt weiterhin. Nur der Offline-Modus (Service Worker) bleibt dabei aus – der braucht `http://` oder `https://`. Fürs Spielen macht das keinen Unterschied, der Spielstand liegt so oder so lokal im Browser.

---

### Was auf dem Telefon anders aussieht

Das Spiel ist bis 375 px Breite hinunter bedienbar:

- **Untere Navigationsleiste** mit *Dashboard*, *Kader*, *Taktik*, *Kalender* und einem *Mehr*-Menü für die übrigen Bereiche.
- **Kader und Tabelle** zeigen die fünf bzw. sechs wichtigen Spalten und passen ohne Wischen auf den Bildschirm. Alle übrigen Werte stehen in den Spielerdetails – ein Tippen auf die Zeile öffnet sie.
- **Positionsfilter** im Kader sind wischbare Chips.
- **Verhandlungen, Ansprachen und Pressekonferenzen** stapeln ihre Eingabefelder untereinander.
- **Modale** schließen per Tippen daneben.
- Alle Bedienelemente sind mindestens 44 px hoch.

### Spielstand mitnehmen

Der Spielstand liegt im Browser des jeweiligen Geräts und wandert nicht automatisch mit. Zum Umziehen: **Spielstand & Optionen → Exportieren** am alten Gerät, die JSON-Datei übertragen (Mail, Cloud, Messenger) und am neuen Gerät importieren.

---

## 🧪 Tests ausführen

Führe im Projektverzeichnis den zentralen Test-Runner aus:
```bash
node test_runner.js
```

Hilfreiche Schalter (auch kombinierbar):
```bash
TEST_SCHNELL=1 node test_runner.js            # ohne die sieben langsamsten Tests (gut zwölf Minuten schneller)
TEST_FILTER="U23|Speicher" node test_runner.js # nur passende Tests
TEST_ZEIT=1 node test_runner.js               # Laufzeit je Test anzeigen
TEST_SEED=1234 node test_runner.js            # andere feste Zufallswerte; TEST_SEED=zufall für echten Zufall
TEST_TEIL=2/4 node test_runner.js             # nur den zweiten von vier Teilen - für parallele Läufe
node pruefung.js                              # nur die statische Prüfung
```

**Automatisch bei GitHub (`.github/workflows/tests.yml`):** Bei jedem Pull Request und jedem Push auf `master` laufen die statische Prüfung und die volle Suite, aufgeteilt auf vier parallele Läufe (`TEST_TEIL=1/4` bis `4/4`). Die schweren Tests sind nach ihrer gemessenen Dauer verteilt (`DAUER` in `test_filter.js`), damit kein Teil viel länger braucht als die anderen. Ein roter Haken am Pull Request heißt: nicht mergen. Über **Actions → Tests → Run workflow** lässt sich die Suite von Hand mit einem anderen Startwert starten, etwa `7` oder `zufall`.

Jeder Test bekommt feste Zufallswerte aus seinem Namen – er liefert allein dasselbe Ergebnis wie in der ganzen Suite. Vor jeder Suite läuft `pruefung.js`: Syntax aller Dateien, doppelte Methoden (auch über die ausgelagerten UI-Teile hinweg), doppelte globale Namen, ob jede Datei geladen und offline vorrätig ist, und ob in den Stylesheets jede geschweifte Klammer geschlossen wird. Ein vergessenes `}` hinter einem `@media`-Block meldet kein Browser – alles danach gilt dann still nur noch auf schmalen Bildschirmen. So geschehen beim Zusammenführen zweier Zweige; aufgefallen war es nur zufällig.

Oder führe die individuellen Test-Suiten aus:
```bash
node test_data.js && node test_wizard.js && node test_engine.js && node test_e2e.js
```
Alle 4 Testsuiten validieren lückenlos:
1. **Datenintegrität (`test_data.js`):** Alle 18 handgepflegten Vereine, Attribute, Torhüter, Gehalts- und Transferbudgets.
2. **Wizard & UI Regression (`test_wizard.js`):** Suchfilter, Schwierigkeitsstufen, Sortierungen, Edge-Cases, DOM-Simulation, Code-Regressionsprüfungen gegen Legacy-IDs sowie die Installierbarkeit auf dem Telefon (Manifest, vorhandene Symbole, vollständiger Offline-Vorrat).
3. **Engines (`test_engine.js`):** MatchEngine, SeasonEngine, Finance, Board, News, Contracts, Scouting, Youth, AIManager, SaveService & MigrationService sowie PositionEngine (Familiarität, Zonen- und Formationserkennung), eigene Formationen und die Echtzeit-Regie der 2D-Simulation. Dazu die Spielwelt: alle zwanzig Ligen gefüllt, Stärkestaffelung über die Ligastufen, Karrierestart in der Landesliga, Europapokal-Besetzung, Auf-/Abstieg und die verlustfreie Kodierung des Spielstands.
   - **Schneller unter Node:** Die Module lösen sich gegenseitig zur Laufzeit auf – im Browser über `window`, unter Node über `require`. Einige Helfer in den heißen Schleifen der Simulation (Positionsnormierung der Taktik, Formationsvorlagen und Taktik in der MatchEngine) riefen dabei bei jedem Aufruf `require` auf; das kostete gemessen ein Drittel bis die Hälfte der Rechenzeit eines Spieltags. Jetzt wird das gefundene Modul gemerkt, auch im gemeinsamen `createResolver`. Ein Saisontag läuft unter Node in 97 statt 189 ms; im Browser ändert sich nichts.
3b. Dazu die Sandbox-Systeme: Kabinenansprachen mit lageabhängiger Wirkung, Pressekonferenzen mit Themen nach Lage, Versprechen und Kampfansagen, die Taktikbesprechung, mehrtägige Transferverhandlungen über alle drei Phasen, das Scheitern von Lowball-Angeboten, Vertragsgespräche für Nachwuchsspieler, Trainingsbelastung mit Ermüdungs- und Risikokurve sowie Nebenpositionen und erlernte Routine.
4. **E2E & Integration (`test_e2e.js`):** Vollständiger Karrierestart, 2D-LiveMatch, Auswechslungen, Transfers, Training, Multi-Saison-Läufe und der komplette Weg von der selbst gezeichneten Formation über das Live-Spiel bis zu Export und Import.

---

## 🎮 Viel Erfolg auf dem Weg zur Meisterschaft! 🏆
