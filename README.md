# ⚽ FM PRO - Fußballmanager (Saison Edition)

Ein leichtgewichtiger, detailreicher und vollständig spielbarer **Fußballmanager im Browser**, der ohne Installation direkt gestartet, als PWA installiert oder als Paket (z. B. ZIP) an Freunde verschickt werden kann.

---

## 🚀 Spiel starten & Spielanleitung

> 📱 **Auf dem Handy spielen?** Siehe [Auf dem Smartphone spielen](#-auf-dem-smartphone-spielen) weiter unten – auf dem Telefon reicht ein Doppelklick auf `index.html` nicht, dafür lässt sich das Spiel dort als App installieren und läuft dann offline.

### 1. Spiel starten (Keine Installation nötig!)
* **Einfacher Doppelklick:** Öffne die Datei **`index.html`** in einem modernen Webbrowser (Chrome, Firefox, Safari, Edge).
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
3. **Schritt 2 (Liga):** Wähle die Liga, in der deine Karriere beginnt – **alle zwanzig Ligen der Spielwelt** stehen zur Wahl, nach Ländern gruppiert: die komplette deutsche Pyramide von der Bundesliga bis zur Landesliga sowie je drei Ligen in England (Premier League, Championship, League One), Spanien (La Liga, Segunda División, Primera Federación), Italien (Serie A, Serie B, Serie C) und Frankreich (Ligue 1, Ligue 2, National). Zu jeder Liga siehst du Vereinszahl, Spieltage, Wertung und Europapokalplätze.
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
- **Kurzanleitung und Begriffe:** Worum es geht, wie ein Tag abläuft, und was Sterne, Potenzial, Moral, Form, Kondition, Spielschärfe, Vertrautheit, Rolle, Scoutwissen, Vorstandsvertrauen, Ruf und xG bedeuten. Erreichbar vom Startbildschirm, aus jedem Erklärkasten und aus den Einstellungen. Sie ersetzt die alte Spielbeschreibung, die noch von 18 Bundesligavereinen und 7 Formationen sprach.

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

### 1. 🏆 Liga & Wettbewerb
- **18 Vereine der Liga 1**: Vollständige Kader, Budgets, Stadien, Fanbasen, Sponsoren und Vereinsinfrastruktur.
- **Vollständiger Spielplan**: 34 Spieltage (Hin- & Rückrunde) nach Round-Robin-Verfahren.
- **Vollwertige Simulation**: An jedem Spieltag spielen alle 18 Klubs zeitgleich gegeneinander.
- **Live-Tabelle & Historie**: Punkte (3/1/0-System), Tordifferenz, Tore, Gegentore, Formkurven sowie Archivierung vergangener Meisterschaften.
- **Vereinsdetails per Klick:** Ein Klick auf einen Verein in der Tabelle, in der Dashboard-Tabelle oder im Spielplan öffnet seine Seite. Der eigene Verein führt in den Reiter *Verein*. Die Seite zeigt:
  - Kopf mit Tabellenplatz, Mannschaftsstärke in Sternen, Ruf, Fans, Kader und Stimmung, dazu ein Hinweis bei einem Derby gegen den eigenen Verein.
  - Die letzten fünf Ergebnisse und die nächsten drei Spiele.
  - Spielweise (Formation, Grundhaltung, Pressing, Passspiel, Abwehrlinie, Torjäger) und Anlagen.
  - Den Kader nach Mannschaftsteilen, mit Sternen und Werten so, wie das eigene Scouting sie kennt. Ein Klick öffnet die Spielerakte darüber.
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
- **Echtzeit-Regie (`LiveMatchDirector`):** Die Spieluhr läuft kontinuierlich statt in Minutensprüngen. Während eines Highlights läuft sie langsam, dazwischen holt sie auf – so passen Minute, Kommentar und Bild jederzeit zusammen.
- **Feld und Spielbericht Hand in Hand:** Jede Szene wird inszeniert (Anlauf zum Ausgangspunkt, Aktion, Auflösung). Aufbau-Kommentare erscheinen, während der Ball läuft; Torschuss, Parade und Fehlschuss werden exakt beim Eintreffen des Balls gemeldet.
- **Echtes Ballbesitzspiel (`MatchFlowEngine`):** Zwischen den Highlights wird nicht zufällig gepasst, sondern gespielt. Die Engine bewertet den Druck auf den Ballführenden, projiziert Gegner auf die Passwege, misst den Freiraum der Anspielstationen und wählt daraus die Option: kurzer Pass, Verlagerung, langer Ball, Dribbling oder Befreiungsschlag. Der Ausgang folgt den Attributen – Passgenauigkeit aus Passen, Übersicht und Technik gegen Druck und zugestellte Wege; Dribblings aus Dribbling und Tempo gegen die Defensivwerte des Gegenspielers.
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
- **Spieltempo:** Drei Stufen – 90 Minuten laufen in rund acht (Langsam), vier (Normal) oder anderthalb echten Minuten (Schnell) ab. Höhepunkte, Standards und der Anstoß bremsen die Uhr ohnehin ab, die entscheidenden Szenen laufen also in Ruhe.
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

> **Geduld am Ball – Qualität zeigt sich im Ballbesitz:** Bisher spielten Bayern und Augsburg denselben Fußball: gemessen rund 52 % Ballbesitz für Bayern bei fast gleicher Passquote. Jetzt hat jeder Spieler eine *Ruhe am Ball* (Technik, Passspiel, Dribbling, Nerven), und der Vorsprung einer Elf darin bestimmt ihre *Geduld* (`MatchFlowEngine.geduld`, einmal je Spielminute gerechnet, Wechsel zählen mit). Die überlegene Mannschaft lässt den Ball im Aufbau und im Mittelfeld laufen – der sichere Ball quer oder zurück zählt mehr, mit jeder Station rückt sie langsamer auf –, die unterlegene sucht schneller den Weg nach vorn. Vor dem gegnerischen Tor gilt das nicht, dort zählt der Abschluss; gleich gute Mannschaften spielen wie bisher.
> Gemessen (je 20 Spiele, Grundeinstellung): Bayern gegen Augsburg 61 % Ballbesitz statt 52 %, auswärts 59 % statt 54 %; Dortmund gegen Leverkusen weiter um 50 %. Der tiefe Block hält gegen Bayerns Gegenpressing 46 % statt 53 % – besser, aber noch nicht die üblichen 30 bis 40 %; das bleibt offen.
> Und das eigene Spiel bleibt so stark wie die Spiele der anderen (240 gleiche Paarungen, mit beiden Änderungen unten): Die Tordifferenz des Favoriten liegt live bei +1,15, im statistischen Modell bei +0,96, er gewinnt 66 % gegen 61 %; bei mehr als fünf Punkten Stärkeunterschied hat er live 56,3 % Ballbesitz, statistisch 57,1 % (live vorher 52,6 %).

> **Mannschaftsstärke im statistischen Modell – zwei Fehler, die die Ligen zufällig machten:** Der Favorit wurde nur in 39 % der Ligen Meister, und nur 58 % der Meister kamen aus den drei stärksten Kadern. Zwei Ursachen:
> - *Formationsplätze im falschen Mannschaftsteil:* Die Formationen benennen Halbpositionen fein (ZDM, LZM, RZM, ZOM, RAV …). Die Stärkeberechnung kannte nur die Grundpositionen und zählte jeden anderen Platz zum Sturm. In einer 4-3-3 oder 4-2-3-1 hatte eine Mannschaft rechnerisch kein Mittelfeld (Ersatzwert 65), ihre Sechser stürmten. Der AC Mailand, dritter nach Kaderstärke, wurde so im Schnitt Siebter. Der Livespiel-Regisseur übersetzte die Plätze längst, die Stärkeberechnung jetzt auch (`MatchEngine.grundPosition`).
> - *Taktik schuf Stärke:* Jede Anweisung, die das Mittelfeld stärkte, war ein Gewinn – es zählt in der Gesamtstärke 35 %, die Abwehr, die den Preis zahlte, nur 20 %. Gegenpressing und Positionsspiel machten eine Mannschaft so um 5 bis 6 % stärker, fast halb so viel, wie zwischen dem besten und dem schwächsten Bundesligakader liegt; Dortmund mit Gegenpressing war rechnerisch stärker als Bayern. Jetzt verschiebt die Taktik Stärke zwischen Angriff, Mittelfeld und Abwehr, ohne die Gesamtstärke zu ändern.
> Weil die Kader ohne den Taktik-Bonus der Spitzenklubs rechnerisch enger beieinanderliegen, entscheidet der Kaderunterschied jetzt etwas stärker, wer eine Szene hat (`MATCH_TUNING.sceneShare` 1,35 statt 1,15) – das gibt dem Favoriten seine alte Tordifferenz je Spiel zurück (+0,96 statt +0,63).
> Gemessen über drei Saisons in allen zwölf Ligen: Der Favorit wird in 50 % statt 39 % der Ligen Meister, der Meister kommt in 75 % statt 58 % aus den drei stärksten Kadern, sein Startrang liegt im Schnitt bei 2,6 statt 3,7. In der Serie A landen die fünf stärksten Kader im Schnitt auf den Plätzen 1,7 bis 4,7 statt 1,7 bis 8,3. Die Kalibrierung (500 Spiele: Tore, Schüsse, Karten, Elfmeter) bleibt grün.

> **Eine Simulation für das eigene Spiel:** Das Sofort-Ergebnis des eigenen Spiels – aus dem Kalender oder über den Knopf mitten im Livespiel – ist kein anderes Spiel mehr. Dieselbe Livespiel-Simulation läuft einfach ohne Bild weiter, in kleinen Häppchen je Bildschirmbild, auf der schnellsten Abspielstufe (die ein Vorlauf ist, kein anderes Spiel). Der Co-Trainer übernimmt Wechsel und Umstellungen, eine Einblendung zeigt Spielstand und Minute, nach zwei bis drei Sekunden steht der Spielbericht – mit Heatmap und Passnetz. Bisher wechselte das Sofort-Ergebnis ab dem Klick auf das statistische Modell. Die Spiele der übrigen Vereine rechnet weiter das statistische Modell, das auf die Livespiel-Simulation abgestimmt ist; für Hunderte Partien je Spieltag wäre die volle Simulation zu langsam.

> **Live und sofort berechnet:** Das statistische Modell erzeugt alle Ereignisse vorab als Timeline. Im Livespiel gibt sie seit dem Entscheidungsmodus nur noch den Rahmen vor (Wechsel, Verletzungen, Halbzeit, Abpfiff) – alles andere entsteht auf dem Feld (siehe unten). Jedes Ereignis wird dabei in dieselbe Timeline geschrieben, aus der auch der Spielbericht rechnet: Live-Anzeige und Bericht zeigen Feld für Feld dieselben Zahlen, ein Test prüft das.

### 3a. 🧠 Entscheidungsmodus: Jeder Spieler entscheidet nach seinen Werten
Im Livespiel wird nichts mehr vorab gewürfelt. Wie in den großen Managerspielen entscheidet der Ballführende in jeder Situation selbst – und seine Werte bestimmen, was er wählt und ob es gelingt.

- **Entscheiden:** Pass, Verlagerung, Steilpass, Dribbling, Flanke oder Abschluss werden gegeneinander abgewogen: Druck der Gegner, zugestellte Passwege, freie Mitspieler, Abstand und Winkel zum Tor. Ein Stürmer mit starkem Abschluss zieht aus 20 Metern ab, ein Techniker sucht lieber den Mitspieler.
- **Ausführen:** Ob der Pass ankommt, hängt an Passen, Übersicht und Technik gegen Druck; ob das Dribbling klappt, an Dribbling und Tempo gegen Zweikampf und Stellungsspiel. Jeder Abschluss bekommt eine Chancenqualität (xG) aus Entfernung, Winkel, Druck und Verteidigern im Schussweg. Verwandelt wird nach dem Duell Schütze gegen Torwart. Kopfbälle nach Flanken entscheiden Sprungkraft und Physis.
- **Alles entsteht aus dem Spiel:** Geblockte Schüsse und abgewehrte Flanken werden zur Ecke, Fouls im Zweikampf zum Freistoß (direkt aufs Tor oder als Flanke), Fouls im Strafraum zum Elfmeter. Karten folgen der Situation: Taktische Fouls beim Konter gibt es gelb, die Notbremse als letzter Mann rot.
- **Werte zählen wirklich:** Auf dem Feld wirken die Werte so, wie der Spieler gerade drauf ist – Fitness, Moral, Form und die Eignung für seine Position. Ein Innenverteidiger im Sturm ist ein schlechterer Stürmer. Ab der 60. Minute zieht die Müdigkeit die Werte nach unten.
- **Gemessene Statistik:** Ballbesitz ist die Zeit am Ball, die Passquote zählt die Pässe, gewonnene Zweikämpfe und vorbereitete Chancen gehen in die Spielernoten ein.
- **Jede Abspielstufe ist dasselbe Spiel:** Laufwege, Deckung und Abstände rechnen in Spielzeit. Auf „Schnell“ läuft die Partie nur im Vorlauf, sie wird nicht enger oder foulreicher.
- **Werte relativ zum Niveau:** Die Werte einer Partie werden so skaliert, dass ihr Schnitt bei 70 liegt. Das Verhältnis zwischen den Spielern bleibt dabei erhalten: Ein Landesligist mit 26 gegen einen mit 19 ist genauso überlegen wie ein Bundesligist mit 86 gegen einen mit 63.
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
- Zu sehen sind sie in der Spielerakte („Auf dem Platz“), als Symbol hinter dem Namen in Kader, Transfermarkt und Vereinsdetails und im Ticker („… 🎯 Eiskalter Vollstrecker!“). Jede Saison werden sie neu vergeben, ältere Spielstände bekommen sie beim Laden nachgereicht.

### 3b. 🗣️ Kabinenansprache & Pressekonferenz (`ManagerEngine`)
Ein Manager verwaltet keine Tabellen, er redet mit Leuten.

**Vor dem Anpfiff und in der Halbzeit** wählen Sie den Ton: *Ruhig bleiben*, *Anfeuern*, *Mehr fordern*, *Vertrauen aussprechen* oder *Lautstark werden*. Der Ton wird nicht bewertet, sondern wirkt – und zwar abhängig von der Lage:

| Situation | Anbrüllen | Mehr fordern | Vertrauen |
|---|---|---|---|
| 0:2 zurück, Favorit | **+6** Moral | **+7** Moral | ±0 |
| 2:0 vorn | **−8** Moral | +2 | ±0 |
| Verunsicherte Mannschaft | stark negativ | negativ | **+8** |

Jeder Spieler reagiert eigen: Temperament verstärkt jede Ansprache, Professionalität dämpft Kritik. Zwei, drei Spieler melden sich sichtbar zurück („nickt und klatscht in die Hände" / „schaut zu Boden und sagt nichts"). Die Wirkung landet in Moral und Form – und damit direkt in der Spielstärke. Eine wirksame **Halbzeitansprache** lässt den weiteren Spielverlauf neu berechnen.

**Am Medientag** stellen sich die Journalisten – zwei bis drei Fragen, und zwar zu dem, was gerade los ist: das Derby vor der Tür, eine Sieges- oder Niederlagenserie, Tabellenspitze oder Abstiegskampf, ein Ultimatum des Vorstands, der verletzte Leistungsträger, ein Angebot für einen eigenen Spieler, der Star des Gegners, ein Kantersieg oder ein Debakel. Ohne besonderen Anlass bleiben die Dauerbrenner (Form, Saisonziel, Fans, ein Spieler in der Kritik). Jede Frage stellt ein Journalist eines bestimmten Blattes, und das Blatt verstärkt die Wirkung:

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

### 3c. 📌 Der Schreibtisch
Das Dashboard zeigt, was heute eine Entscheidung braucht – nach Dringlichkeit sortiert, ein Klick springt in den zuständigen Reiter: unvollständige Startelf, Verhandlungen mit uns am Zug, Ausfälle, überlastete Spieler, auslaufende Verträge, unzufriedene Spieler, ungelesene Post. Gesprächswünsche, Wechselwünsche und offene Versprechen stehen ebenfalls dort – ein Klick öffnet die Akte des Spielers.

- **Direkt ans Ziel:** Bei auslaufenden Verträgen steht jeder Spieler einzeln da, die stärksten zuerst. Ein Tipp auf den Namen öffnet seine Akte gleich bei der Vertragsverlängerung, der Cursor steht im Gehaltsfeld. Eine Verhandlung, bei der wir am Zug sind, führt direkt zu ihrer Karte im Transfermarkt. Dasselbe gilt für Talente: *Vertragsgespräche aufnehmen* springt sofort in die Verhandlung mit dem Berater, *Zur Verhandlung* ebenso. Die Post über einen auslaufenden Vertrag hat einen Knopf *Vertrag verlängern*.

### 3d. 🗣️ Gespräche unter vier Augen (`PlayerTalkEngine`)
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

### 4. 🔄 Transfersystem, Scouting & Verträge
- **Transfermarkt mit Suchfiltern:** Nach Position, Stärke, Potenzial und Preisklasse filtern.
- **Vertragsverlängerungen (`ContractEngine`):** Individuelle Gehaltsforderungen, Rollenabsprachen und Vertragslaufzeiten direkt im Spielermenü verhandeln.
- **Forderungen passen zur Liga:** Vorher forderte jeder Spieler mindestens 10.000 € pro Woche, gerundet auf Tausender – ein Landesligaspieler mit 120 € wollte plötzlich das Achtzigfache. Jetzt zählen sein Gehalt und das Marktgehalt seiner Stärke in dieser Liga: Wer unter Wert bezahlt ist, will aufholen (bis 70 % der Lücke), wer über Wert bezahlt ist und älter als 30, gibt etwas nach. Darauf kommen 10 % Erhöhung, bis 30 % für junge Talente mit Luft nach oben und 15 % für Schlüsselspieler – gemessen am eigenen Kader, sodass auch der Beste einer Landesligamannschaft als Schlüsselspieler gilt. Beispiele: Landesliga 450 € → 520 €, mit 120 € → 160 €; Bundesliga 87.000 € → 120.000 €. Gerundet wird auf zwei Stellen, die Eingabefelder gehen in passenden Schritten (10 € in der Landesliga, 1.000 € in der Bundesliga).
- **Transferfenster nach Datum, Winterpause je Land:** Das Sommerfenster ist die ganze Vorbereitung über offen und schließt am 31.08. (Deutschland, Frankreich) bzw. 01.09. (England, Spanien, Italien); das Winterfenster läuft vom 01.01. (Spanien und Italien: 02.01.) bis 02.02. Vorher hingen beide Fenster an Spieltagen, das Winterfenster lag auf zwei gewöhnlichen Spieltagen mitten über Weihnachten. Über den Jahreswechsel spielt jedes Land nach seinem Brauch: Die Bundesliga ruht von kurz vor Weihnachten bis zum 10.01., die Ligue 1 ab Mitte Dezember und LaLiga gut eine Woche (*Winterpause*: einige Tage frei, dann Training). In England gibt es keine Pause, dafür Spieltage am Boxing Day, am 29.12. und an Neujahr; die Serie A spielt zwischen den Jahren und am Dreikönigstag. Am 24. und 25.12. wird nirgends gespielt. Gehandelt wird trotzdem überall ab dem 01.01. – auch dort, wo der Ball weiterrollt, und die KI-Vereine kaufen in der Pause wie an Spieltagen. Lange Ligen (Championship, Segunda División) legen Englische Wochen ein, damit alle Spieltage vor Juni liegen. Die Transferabteilung meldet, wenn ein Fenster öffnet, am letzten Tag (*Deadline Day*) und wenn es schließt – vorher geschah beides still. Vereinslose Spieler lassen sich jederzeit verpflichten.
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
- **Angebote für eigene Spieler – nicht zu übersehen:** Ein neues Angebot öffnet nach dem Weiterklicken ein eigenes Fenster und steht oben auf dem Schreibtisch. Im Transfermarkt erscheint es als Karte mit Frist, Verhältnis zum Marktwert und drei Antworten:
  - **Annehmen:** Der Spieler wechselt sofort.
  - **Mehr fordern:** Einmal möglich. Der Käufer geht mit, bessert bis zu seiner Grenze nach oder zieht bei einer maßlosen Forderung zurück.
  - **Ablehnen.**

  Ein Angebot gilt vier Tage. Wer nicht antwortet, hat abgelehnt.
- **Weiterverkaufsbeteiligung:** Beim Annehmen eines Angebots lassen sich 10 oder 20 % an einem späteren Weiterverkauf vereinbaren. Der Käufer zahlt dafür jetzt 5 bzw. 10 % weniger. Wechselt der Spieler später für eine Ablöse weiter, fließt der Anteil zurück.
- **Ausstiegsklauseln:** Bei einer Vertragsverlängerung lässt sich eine Klausel über das 1,5-, 2,5- oder 4-fache des Marktwerts vereinbaren. Je niedriger sie liegt, desto stärker sinkt die Gehaltsforderung (bis zu 10 %). Dafür kann jeder Verein, der die Summe zahlt, den Spieler holen – ablehnen geht nicht. Gut jeder fünfte Spieler anderer Vereine hat eine Klausel. Sie steht in der Akte und lässt sich dort ziehen, sofern der Spieler den Schritt zu Ihnen machen will.
- **Leihgeschäfte (`LoanEngine`, Unterreiter *Leihen*):**
  - *Verleihen:* In der Akte eines eigenen Spielers fragt man Interessenten an: Vereine bis zwei Ligen tiefer, bei denen er Stammspieler oder Rotation wäre. Der Leihverein übernimmt einen Teil des Gehalts. Bis zum Saisonende, vorzeitiges Zurückholen ist möglich.
  - *Ausleihen:* Der Leihmarkt zeigt junge Spieler ohne Stammplatz und Reservisten anderer Vereine. Der Stammverein verlangt einen Gehaltsanteil (darunter lehnt er ab), bei starken Spielern eine Leihgebühr, und meldet sich, wenn ein zugesagter Stammspieler nicht spielt.
  - Einmal im Monat kommt ein Leihbericht ins Postfach. Zum Saisonende kehren alle zurück. Verliehene Spieler stehen unter der Kadertabelle, werden nicht verkauft und kosten beide Vereine anteilig Gehalt.

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
- **Alles im Blick:** Der Reiter *Transfermarkt* zeigt jede laufende Verhandlung mit Phase, aktueller Forderung, Restgeduld, Frist und dem letzten Satz der Gegenseite.

### 5. 🏋️ Training & Jugendakademie
- **Trainingsschwerpunkte:** Allround, Angriff, Defensive, Technik, Taktik, Regeneration, Jugendförderung.
- **Nachwuchsakademie (`YouthEngine`):** Akademie-Ausbau (Stufe 1 bis 5) für stärkere Talente und direkte Beförderung von Jugendspielern mit Profi-Vertrag in die 1. Mannschaft.
- **Jugendtag:** Einmal je Saison, im Frühjahr um den Spieltag bei 70 % der Saison (34 Spieltage: der 24.), stellt sich der neue Jahrgang vor. Drei Spieltage vorher kündigt der Nachwuchsleiter ihn im Postfach an und schätzt ein, wie gut er wird. Am Jugendtag selbst kommt eine Nachricht mit allen Namen.
- **Befördert ist befördert:** Die Talente des eigenen Vereins stehen in genau einer Liste. Vorher waren es nach dem Laden zwei Kopien: Ein beförderter Spieler blieb in der Akademie stehen und ließ sich ein zweites Mal befördern.
- **Schwerpunkte der Akademie:** Im Reiter *Training* lassen sich vier Dinge einstellen. Alles wirkt auf den nächsten Jahrgang am Jugendtag.

  | Schwerpunkt | Auswahl | Wirkung |
  |---|---|---|
  | **Ausbildung** | Technik, Athletik, Spielintelligenz, Zweikampf, ausgewogen | prägt, wie die Talente spielen; einmal je Saison änderbar |
  | **Positionen** | bis zu zwei aus Torhüter, Abwehr, Mittelfeld, Angriff | kommen deutlich häufiger nach |
  | **Jahrgang** | Breite, ausgewogen, Spitze | fünf Talente mit etwas weniger Potenzial, drei wie gewohnt oder zwei mit deutlich mehr |
  | **Einzugsgebiet** | Region, national, international | bringt mehr Potenzial und mehr ausländische Talente, kostet je Jahrgang (kleine Ligen zahlen weniger) |

  Der Nachwuchsleiter aus dem Trainerstab entscheidet mit: Ein guter holt Potenzial heraus und lässt die Jungs schneller wachsen, ein schwacher kostet beides. Gemessen wird am üblichen Niveau des Vereins: Ein eigener Mann bringt −4 bis +5 Punkte Potenzial je Talent, die Aushilfe bei offenem Posten kostet 2.
- **Talente passen zur Liga:** Ein Jahrgang richtet sich nach der Ligastufe des Vereins. In der Landesliga kommen Landesliga-Talente, in der Bundesliga Bundesliga-Talente. Überall haben sie heute 0,5 bis 2,5 Sterne und im Schnitt 3 bis 4 Sterne Potenzial. Fünf Sterne gibt es nur mit guten Schwerpunkten, einem guten Nachwuchsleiter und etwas Glück.
- **Verletzungen & Sperren:** Realistische Ausfallzeiten (Leicht/Mittel/Schwer) und Gelb-/Rotsperren.

### 5a. 📈 Entwicklungsplan (`DevelopmentPlanEngine`)
Jeder eigene Spieler hat in seiner Akte einen Entwicklungsplan. Der Trainings-Reiter zeigt alle Pläne und die Spielpraxis der jungen Spieler.
- **Spielpraxis:** Ein gleitender Wert, wie viel der möglichen Minuten ein Spieler zuletzt gespielt hat – für jeden Spieler aller Vereine. Ein Talent bis 23 entwickelt sich mit regelmäßigen Einsätzen um gut ein Viertel schneller als im Schnitt, ohne Einsätze langsamer. Bis 28 zählt es ein wenig, danach nicht mehr. Genau dafür gibt es Leihen.
- **Eigener Trainingsschwerpunkt:** Abschluss, Passspiel, Zweikampf, Schnelligkeit, Dribbling, Kopfball (Torhüter: Reflexe, Herauslaufen). Wächst der Spieler, wachsen diese Werte mit. Die Zusatzschichten kosten etwas Kraft.
- **Umschulung:** Eine neue Position lernen, Einheit für Einheit. Wie schnell, hängt an der Anpassungsfähigkeit und daran, wie verwandt die Position ist. Ist sie gelernt, kommt eine Nachricht.
- **Mentor:** Ein Spieler ab 25 betreut bis zu drei Spieler bis 23. Seine Einstellung färbt ab: Professionalität, Ehrgeiz, Temperament, Nerven und Beständigkeit wandern langsam in seine Richtung. Mit etwas Glück schaut sich der junge Spieler eine Eigenheit ab – sofern sie zu seinen Werten passt. Ein guter Mentor beschleunigt die Entwicklung leicht.

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
Ein Talent in den Profikader zu holen dauert jetzt seine Zeit. *Vertragsgespräche aufnehmen* startet die Verhandlung mit dem Berater über Gehalt, Laufzeit und Handgeld; erst nach der Einigung – meist drei bis sechs Tage – unterschreibt der Spieler seinen ersten Profivertrag und taucht im Kader auf. Die Forderung richtet sich nach Potenzial und Ligastufe.

- **Talente kommen öfter und auf mehr Wegen:** Neben dem Jugendtag im Frühjahr meldet der Nachwuchsleiter unter dem Jahr immer wieder ein einzelnes Talent, das im Probetraining überzeugt hat – in der Grundausstattung etwa dreimal je Saison, mit ausgebauter Akademie, gutem Nachwuchsleiter und weltweitem Sichtungsnetz bis rund neunmal. Wer gezielt suchen will, setzt im Reiter Training selbst einen *Sichtungstag* an: ein bis zwei Talente gegen eine Gebühr nach Ligastufe (50.000 € in der Bundesliga, 1.500 € in der untersten Liga), danach sechs Wochen Pause. Die Herkunft steht als Marke am Namen.
- **Akademie mit Plätzen:** Platz für 8 Talente und 2 je Ausbaustufe; ist sie voll, kommt niemand mehr dazu. Ein Talent lässt sich *freigeben*. Zum Saisonwechsel werden die Talente ein Jahr älter, mit 19 ist ohne Profivertrag Schluss – vorher blieben sie für immer 15 bis 17 Jahre alt und für immer in der Akademie.
- Am Handy steht jedes Talent als Karte da statt als Tabellenzeile mit zerquetschten Spalten.

### 6. 💼 Finanzen, Sponsoren & Buchungsjournal
- **Finanzübersicht (`FinanceEngine`):** Kontostand, Transferbudget, Gehaltsetat, Ticketeinnahmen und wöchentliche Sponsorenzahlungen.
- **Transaktionsjournal:** Detailliertes Buchungsjournal mit lückenloser Historie aller Einnahmen und Ausgaben.
- **Infrastruktur:** Stadion, Trainingsgelände, Jugendzentrum und medizinische Abteilung. Jede Anlage hat Stufe, Zustand und Alter. Ausbau und Sanierung dauern Spieltage, und so lange ist der Betrieb eingeschränkt.
- **Bauen nach Ligastufe:** Die Preise richten sich nach der Liga. Ein Landesligist zahlt 4 % des Bundesliga-Preises, ein Drittligist 28 %. So kostet der nächste Ausbau überall ungefähr einen ähnlichen Teil der Saisoneinnahmen. Beim FC Hanau 93 kostet ein zweites Trainingsfeld jetzt knapp 40.000 € statt 1,5 Millionen.

  | Liga | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  |---|---|---|---|---|---|---|---|
  | Preis gegenüber Liga 1 | 100 % | 55 % | 28 % | 14 % | 8 % | 5,5 % | 4 % |
  | Sportstättenförderung | – | – | – | 15 % | 25 % | 30 % | 35 % |

- **Finanzierung über die Hausbank:** Reicht die Kasse nicht, zahlt man ein Viertel an und den Rest mit 6 % Zinsen in Raten über die Bauzeit. Die Bank macht nur mit, wenn eine Rate höchstens ein Viertel der Einnahmen je Spieltag ausmacht. Vor jedem Bau zeigt ein Dialog Baukosten, Förderung, Eigenanteil und die Raten.
- **Kennzahlen auf einen Blick:** Die Vereinsseite beginnt mit einem Kopf aus Wappen, Liga und Kacheln für Tabellenplatz, Ruf, Fans, Stimmung, Teamchemie und Kontostand. Kader und Finanzen haben dieselbe Kennzahlenleiste (Kadergröße und Alter, Marktwert, Gehälter, Fitness, Ausfälle, auslaufende Verträge bzw. Kontostand, Budgets, Gehaltsquote, Sponsor, Heimspiel).

### 6b. 👔 Das Saisonziel des Vorstands (`BoardEngine.bestimmeZiel`)
Vor jeder Saison – und bei einem Vereinswechsel – misst der Vorstand den Verein an seiner Liga, jeweils als Rang: Stärke des Kaders (60 %), Etat aus Gehalts- und Transferbudget (20 %) und Ansehen (20 %). Daraus ergibt sich, wo der Verein hingehört, plus ein Platz Spielraum. Schlechter als den ersten Nichtabstiegsplatz verlangt er nie; wer klar vorn liegt, soll Meister werden oder – unterhalb der höchsten Liga – aufsteigen. Wer mitten in der Saison übernimmt, bekommt ein Ziel zwischen Kader und Tabelle.

| Beispiel (gemessen) | Kader/Etat/Ansehen | Ziel |
|---|---|---|
| Bayern München | 1/1/1 | Meisterschaft |
| VfL Wolfsburg | 10/7/8 | sicherer Mittelfeldplatz (Platz 10) |
| VfL Bochum | 14/16/17 | Klassenerhalt (Platz 16) |
| Hannover 96 (2. Liga) | 1/1/1 | Aufstieg |
| Karlsruher SC (2. Liga) | 7/6/7 | oberes Mittelfeld (Platz 8) |

Die Begrüßung und die Post zum Saisonstart nennen Ziel und Gründe, das Dashboard den Zielplatz. Vertrauen, Ultimatum, Saisonbilanz und der ehrgeizige Sponsor rechnen mit genau diesem Platz. Vorher stand das Ziel einmal fest und änderte sich nur pauschal bei Auf- oder Abstieg; die Platzgrenzen waren fest verdrahtet (Klassenerhalt hieß Platz 10, an anderer Stelle wurde mit allen 218 Vereinen der Welt gerechnet, und „Aufstieg“ kannte die Rechnung gar nicht).

### 7. 🗓️ Kalender-Tagesablauf, 🔍 Gegneranalyse & 🌟 Scoutingsystem
- **Spielerbewertungssystem (`PlayerRatingEngine`):** Trennung von echten internen Fähigkeiten (CA/PA 1–200, Hidden Attributes wie Professionalität & Ehrgeiz) und sichtbaren, scoutabhängigen Einschätzungsbereichen.
- **Relative Sternebewertungen:** Qualitätssterne (0.5 bis 5.0) werden dynamisch relativ zur Stärke des eigenen Kaders berechnet.
- **Testspiele werden angesagt:** Ein Spieltermin der Vorbereitung erscheint wie ein Spieltag – mit beiden Mannschaften und der Wahl zwischen Live-Spiel und Sofortergebnis. Beide laufen über dieselbe Simulation; das Ergebnis wird so eingetragen, wie es auf dem Platz fiel.
- **Saisonkalender & Wochenplan (`CalendarEngine`):** Realistischer Tagesablauf zwischen Spieltagen (Regeneration, Schwerpunkt-Training, Medien-/Sponsoren-Events, Taktikschulung und Gegneranalyse).
- **Zeit Tag für Tag:** Der Weiter-Knopf läuft Tag für Tag bis zum nächsten Termin (Spiel, Testspiel, Pressekonferenz, Saisonende). Er hält aber auch dazwischen an, wenn etwas den Manager angeht:
  - ein Angebot für einen eigenen Spieler,
  - eine Antwort in einer Verhandlung,
  - eine Verletzung im Training,
  - ein Scoutbericht, Jugendtag, Vorstandspost, ein fertiger Bau oder ein auslaufender Vertrag.

  Der Grund steht im Tagesbericht, der nächste Klick läuft weiter. Wer jeden Tag einzeln sehen will, etwa zwischen Pressekonferenz und Anpfiff, nimmt den Knopf **+1 Tag** daneben. Er erscheint, sobald der Weiter-Knopf mehrere Tage überspringen würde.
- **Taktische Gegneranalyse (`OpponentAnalysisEngine`):** Vor jedem Ligaspiel detaillierte Stärken-/Schwächenprofile, gegnerische Taktiktendenzen, Gefahreinstufung und konkrete Trainer-Empfehlungen abrufen. Der Spielanalyst aus dem Trainerstab entscheidet, wie genau sie ist:
  - Ein schwacher Analyst liest die Mannschaftsteile ungenauer und stellt nur zwei Schlüsselspieler vor.
  - Ein guter Analyst stellt bis zu vier Schlüsselspieler vor und benennt die Schwachstelle der gegnerischen Elf samt Rat, wie man sie angeht.
- **Trainerstab in der Vorbereitung:**
  - **Posten:** Sechs Posten sind zu besetzen – Co-Trainer, Athletiktrainer, Spielanalyst, Mannschaftsarzt, Nachwuchsleiter und Chefscout.
  - **Gehälter nach Liga und Posten:** Ein Co-Trainer in der Bundesliga verdient rund 16 Tsd. € je Woche, in der Landesliga gibt es 100 € Aufwandsentschädigung. Arzt, Scout, Athletiktrainer, Analyst und Nachwuchsleiter verdienen weniger. Wer besser ist als das übliche Niveau des Vereins, verlangt mehr, etwa das Doppelte bei 15 Punkten darüber.
  - **Stab-Etat:** Der Etat ist anderthalb Mal ein durchschnittlich besetzter Stab. Er steht als Balken über der Liste. Jeder Bewerber zeigt Sterne, Forderung und ob er in den Etat passt.
  - **Echte Kosten:** Die Gehälter gehen jede Woche als eigener Posten „Trainerstab“ von der Kasse ab. Der übliche Stabsanteil ist dafür aus dem Betriebsaufwand herausgenommen: Ein teurer Stab kostet mehr, ein sparsamer spart. Eine Aushilfe auf einem offenen Posten kostet gut ein Drittel eines üblichen Gehalts.
  - **Gehaltsverhandlung:** Wer verhandelt statt zur Forderung zu verpflichten, bietet Gehalt und Laufzeit. Längere Verträge machen den Bewerber günstiger. Er antwortet mit einem Gegenangebot. Wer ihn zu tief ansetzt oder drei Runden feilscht, verliert ihn.
  - **Meldungen:** Jede Verpflichtung meldet der Sportdirektor mit dem Stand des Etats und den noch offenen Posten.
  - **Pflichtposten:** Arzt, Athletiktrainer und Co-Trainer sind Pflicht. Eine Woche, drei Tage und einen Tag vor dem Start erinnert der Sportdirektor daran. Am ersten Spieltag fragt er nach, ob die Saison wirklich ohne sie beginnen soll, oder besetzt die Posten auf Wunsch kurzfristig.
  - **Offene Posten:** Ein offener Posten wird mit Aushilfen besetzt und ist spürbar schwächer als ein eigener Mann.
- **Detaillierte Spielberichte:** Textzusammenfassungen, xG-Vergleiche, Zweikampfquoten, Paraden und Auszeichnungen für den Mann des Spiels.
- **Verbessertes Postfach (`NewsEngine`):** Vollständige Suche, Filterleiste (Vorstand, Spiel, Transfers, Training, Finanzen) und dauerhafte Mail-Historie. Am Handy und auf schmalen Bildschirmen klappt eine Nachricht direkt unter ihrem Eintrag auf; ein zweiter Tipp klappt sie zu. Vorher stand sie unter der ganzen Liste, und man musste erst ans Ende scrollen. Breit steht sie wie gewohnt rechts daneben.

### 8. 🌐 Die Spielwelt: 384 Vereine aus fünf Ländern (`WorldGenerator`)
- **Zwanzig spielbare Ligen, 384 Vereine, über 8300 Spieler.** Die komplette Welt wird beim Karrierestart erzeugt und läuft Saison für Saison mit.
- **Zweite und dritte Ligen in England, Spanien, Italien und Frankreich:** Championship (24 Vereine, 46 Spieltage) und League One (24), Segunda División (22) und Primera Federación (20), Serie B (20) und Serie C (20), Ligue 2 (18) und National (18) – mit echten Vereinen samt Stadt, Stadion und Fassungsvermögen (die zweiten Ligen in der Zusammensetzung 2024/25, in den dritten Ligen Vereine, die auf oder nahe dieser Ebene spielen). Vorher hatten diese Länder nur eine Liga; die Erstligen verwiesen beim Abstieg auf Ligen, die es nicht gab, und niemand stieg ab. Jetzt tauschen die Erstligen mit den Zweitligen (Premier League, La Liga, Serie A je drei, Ligue 1 zwei) und die Zweit- mit den Drittligen. Die Stärke liegt wie in Deutschland: zweite Ligen um 68, dritte um 60.
- **Laufende Karrieren bekommen die neuen Ligen beim Laden** (Spielstand-Version 9): Vereine, Kader und Spielplan werden nachträglich angelegt, die verpassten Spieltage holt die Simulation am nächsten Spieltag anteilig nach, und eine Nachricht des Ligavorstands kündigt sie an.
- **Was die größere Welt kostet:** Im Browser dauert der Aufbau 1,7 statt 0,7 Sekunden und ein Kalendertag 119 statt 77 ms; der Spielstand wächst kodiert von 2,4 auf 4,0 MB (er liegt in IndexedDB).
- **Top-5-Ligen:** Deutschland, England, Spanien, Italien und Frankreich – jede mit landestypischen Vereins-, Städte- und Spielernamen. In England spielen *Rovers* und *Wanderers*, in Spanien *Real* und *Deportivo*, in Italien *AC* und *Calcio*, in Frankreich *Olympique* und *Stade*.
- **Deutsche Ligapyramide (Stufe 1 bis 7):** Bundesliga, 2. Bundesliga, 3. Liga, Regionalliga West & Bayern, Oberliga Nord, Verbandsliga und Landesliga.
- **Spielerstärke nach Ligastufe:** Der `PlayerGenerator` staffelt Fähigkeit (CA) und Potenzial (PA) nach Ligastufe *und* Ruf des Vereins. Ein Landesligist spielt mit Spielern um 20 Gesamtstärke, ein Bundesliga-Spitzenklub um 80. Zwischen benachbarten Stufen bleibt eine Überschneidung: Der Zweitligameister kann stärker sein als der Bundesliga-Absteiger.

| Ligastufe | schwacher Klub | Mittelfeld | Spitzenklub |
|---|---|---|---|
| Bundesliga | 67 | 76 | 82 |
| 2. Bundesliga | 58 | 61 | 68 |
| 3. Liga | 51 | 56 | 59 |
| Regionalliga | 43 | 46 | 49 |
| Oberliga | 32 | 38 | 39 |
| Verbandsliga | 23 | 28 | 33 |
| Landesliga | 17 | 19 | 23 |

- **Alle Ligen laufen mit:** Pro Spieltag simuliert die `SeasonEngine` auch die elf übrigen Ligen. Da die Ligen 30, 34 oder 38 Spieltage haben, wird der Fortschritt anteilig umgerechnet – alle Ligen enden gemeinsam.
- **Ruf, Stadion und Etat nach Rangfolge:** Ein Spitzenklub hat rund das Siebenfache des Etats des Schlusslichts derselben Liga; die Stadionkapazität reicht von 82.000 (Topliga) bis 400 Plätzen (Landesliga).
- **Nationale Pokale & Europapokal:** Der Pokal deines Landes sowie Champions League (`ucl`), Europa League (`uel`) und Conference League (`uecl`) mit Gruppen- und K.O.-Runden via `CompetitionEngine`.
- **Ein Pokalabend, eine Runde:** Jeder Pokal- und Europapokalabend im Kalender spielt genau seine Runde. Nach dem eigenen Spiel geht es mit der Ligawoche weiter; die nächste Runde steht erst am nächsten Pokalabend an.
- **Echte Europapokal-Qualifikanten:** Die Startplätze folgen den `europeanSpots` der Ligadefinition – England, Spanien und Italien stellen vier Champions-League-Teilnehmer, Frankreich drei. Kein Verein startet in zwei Wettbewerben.
- **Auf- und Abstieg über die gesamte Pyramide:** Aus jeder Liga steigen genauso viele Vereine ab, wie von unten aufsteigen; alle Ligen behalten ihre Mannschaftszahl. Aufsteiger nehmen ihren Kader mit und starten bewusst als Außenseiter.
- **Ligawechsel in der Tabellenansicht:** Der Wettbewerbswähler im Reiter *Wettbewerbe & Spielplan* zeigt jede Liga der Welt mit eigener Tabelle und eigenem Spielplan.
- **Die Welt bleibt im Gleichgewicht:** Über sechs Saisons (Startwert 11, Schnitt der vierzehn Besten je Kader) stieg die Landesliga bisher von 22,9 auf 29,3, die Verbandsliga von 30,4 auf 37,3, die Zahl der Spieler ab 90 verdreifachte sich, und am Ende trieben 683 Vereinslose durch eine Welt von 5588 statt 4752 Spielern. Vier Ursachen, vier Änderungen:
  - **Talente:** Ihr Potenzial hing am jetzigen Können und lag im Mittel gut 8 Punkte über den gestandenen Spielern ihres Vereins – jede Generation wurde besser als die vorige. Jetzt liegt es um das Vereinsniveau, meist etwas darüber; 3 bis 8 % reichen 14 Punkte und mehr darüber hinaus (`PlayerGenerator.talentPotenzial`).
  - **Nachwuchs:** Jeder Verein hält mindestens drei statt fünf Spieler bis 21. Fünf war fast ein Viertel des Kaders und doppelt so viel, wie die Altersverteilung der erzeugten Welt hergibt; Jahr für Jahr rückten so Hunderte Talente nach, und die Verdrängten wurden vereinslos.
  - **Verträge und Vereinslose nach eigenem Niveau:** Ob ein KI-Verein verlängert oder einen Vereinslosen holt, misst er am Schnitt seiner vierzehn Besten (`ContractEngine.vereinsNiveau`). Vorher galten feste Grenzen aus der Bundesliga („wichtig ab 55“): In der Landesliga lief so jeder zweite Vertrag aus, und die Lücken füllten Vereinslose aus höheren Ligen. Geholt wird jetzt nur, wer höchstens 6 Punkte über und 12 unter dem Kader liegt.
  - **Wer keinen Verein findet, hört auf:** Ein Vereinsloser hat eine Saison Zeit, ein Talent bis 21 zwei; danach verlässt er den Profifußball. Im Transfermarkt steht das am Abzeichen *Ablösefrei*.
  - Nachher, gleicher Startwert: Landesliga 22,9 → 23,0, Verbandsliga 30,4 → 32,0, Bundesliga 80,5 → 80,2; 57 Vereinslose, 4910 Spieler. Die Weltspitze (Schnitt der besten 50) steigt in den ersten beiden Saisons von 90,1 auf 91,5 und bleibt dann bei 92; Spieler ab 90 sind es nach vier Saisons 90 statt 150. Mit Startwert 7 dasselbe Bild. Was die Zweite Liga danach noch zulegt (rund 1 Punkt), kam vor allem aus dem Tausch der Auf- und Absteiger – dazu der nächste Punkt.
  - **Absteiger geben ab (`SeasonEngine.abstiegsfolgen`):** Bisher nahm ein Absteiger seinen ganzen Kader mit. Bundesliga-Absteiger lagen danach im Schnitt 2,1 Punkte über den Aufsteigern, die ihren Platz einnahmen (vier Startwerte, fünf Saisons), und jeder Tausch hob die Zweite Liga. Jetzt zieht, wer für die neue Liga deutlich zu gut ist, seine Klausel für den Abstieg. Er wechselt für 60 % der üblichen Ablöse zu einem passenden KI-Verein der alten Liga oder darüber, Aufsteiger zuerst – aber nur, bis der Absteiger nicht mehr stärker ist als die Aufsteiger. Danach liegen beide gleichauf (−0,1). Ohne diese Bremse lagen Absteiger 1,7 bzw. 3,9 Punkte darunter, und die Dritte Liga verlor Stärke. Steigt der eigene Verein ab, geht niemand ungefragt: Die Spieler äußern einen Wechselwunsch, und der Trainer entscheidet.
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
- **Zweite Mannschaft (U23, `ReserveEngine`):** Talente, die bei den Profis nicht spielen, schickt man in die U23. Sie spielt an jedem Spieltag ein eigenes Spiel und bringt Spielpraxis (etwas weniger als bei den Profis), Spielschärfe und eine eigene Bilanz. Höchstens drei Spieler über 23, im Profikader bleiben mindestens 16. Die KI-Vereine geben ihren Talenten ohne Einsatz ebenfalls etwas Praxis.
- **Taktik:** Konter und tiefer Block wurden überarbeitet – Umschalten mit Verzögerung für Verteidiger, Befreiungsschläge aus der tiefen Linie, Laufwege in die Tiefe. Gemessen gegen einen hoch pressenden Favoriten (24 Spiele je Variante): Konter holt 0,71 Punkte je Spiel statt 0,38 mit der Grundeinstellung; der tiefe Block, der nach Ballgewinn sofort nach vorn spielt, kassiert 1,79 statt 2,88 Tore. Ehrlich gesagt: Gegen eine viel stärkere Mannschaft bleibt der tiefe Block auch so die schwierigste Wahl.
- **Langzeittest (acht Saisons, alle zwölf Ligen, Schnitt aller Spieler je Stufe):** Die Ligastufen bleiben stabil (Zweite Liga 64,1 → 64,1, Landesliga 21,3 → 21,0; vor dem Gleichgewicht der Welt, siehe Abschnitt 8, stieg die Landesliga schon in fünf Saisons von 21,0 auf 25,7). Die Bundesliga verliert in der Breite leicht (76,0 → 74,5, vorher 73,6), ihre vierzehn Besten je Kader nicht. Die Weltspitze wächst in den ersten Saisons und bleibt dann stehen (Schnitt der besten 50: 89,8 → 91,8, Höchstwert 94–95). 44 Vereinslose nach acht Saisons – vor dem Gleichgewicht waren es schon nach fünf 584. Am Saisonende, bevor Karriereenden und Nachwuchs greifen, liegt der Altersschnitt bei 27,4 (vorher 27,9); während der Saison bei 26,3 bis 26,5. Der Spielstand wächst von 2,1 auf 3,1 MB. Der Favorit nach Kaderstärke wird in 39 % der Ligen Meister, in 74 % kommt der Meister aus den drei stärksten Kadern (96 Meisterschaften). Offen: Ober- und Verbandsliga legen über acht Saisons gut einen Punkt zu (37,4 → 38,9 und 28,6 → 29,8) – das war vor diesen Änderungen genauso.
- **Lesbarkeit:** Gedimmte Schrift erreicht jetzt auf allen Kartenflächen mindestens 4,5:1 Kontrast (vorher 2,7:1). Überschriften und Knöpfe zeigen Symbole aus dem Iconset statt bunter Emojis.

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
│   │   ├── initialData.js      # 18 Bundesliga-Vereine & Spielerdaten
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
│   │   ├── playerTalkEngine.js # Gespräche unter vier Augen, Versprechen, Wechselwünsche
│   │   ├── developmentPlanEngine.js # Schwerpunkt, Umschulung, Mentor, Spielpraxis
│   │   ├── loanEngine.js       # Verleihen, Leihmarkt, Gehaltsanteile, Kaufoption, Rückkehr
│   │   ├── reserveEngine.js    # Zweite Mannschaft (U23): Spielpraxis, Bilanz, Regeln
│   │   ├── nationalTeamEngine.js # Nationalmannschaften, Nominierungen, Länderspielpausen, Nationaltrainer
│   │   ├── dressingRoomEngine.js # Kabine: Moral, Hierarchie, Grüppchen, Kapitän
│   │   ├── wetterEngine.js     # Wetter und Platzverhältnisse je Partie
│   │   ├── trainerProfilEngine.js # Trainerwerte, Lizenzen, Lehrgänge, Ruf
│   │   ├── trainingEngine.js   # Tägliche Belastung, Ermüdung, Risiko & Entwicklung
│   │   ├── financeEngine.js    # Spieltagseinnahmen, Gehälter & Journal
│   │   ├── boardEngine.js      # Vorstandszufriedenheit & Saisonziele
│   │   ├── newsEngine.js       # Zentrales Nachrichtensystem & Postfach
│   │   ├── aiManagerEngine.js  # KI-Aufstellungen & KI-Transferangebote
│   │   ├── scoutingEngine.js   # Scoutaufträge & Spielerberichte
│   │   ├── youthEngine.js      # Jugendförderung & Akademieausbau
│   │   ├── contractEngine.js   # Vertragsforderungen, Verlängerungen & Ausstiegsklauseln
│   │   ├── sportdirektorEngine.js # Spielervorschläge und Beratung des Sportdirektors
│   │   ├── calendarEngine.js   # Saisonkalender & dynamischer Tagesablauf
│   │   └── opponentAnalysisEngine.js # Taktische Gegneranalyse
│   ├── ui/
│   │   ├── uiManager.js        # Kern: Start, Assistent, Reiter, Kader, Taktik, Kalender, Ereignisse
│   │   ├── uiSpielfeld.js      # Leinwand des 2D-Spiels: Rasen, Radar, Einblendungen, Stadionklang
│   │   ├── uiVorbereitung.js   # Vorbereitung: Stab, Sponsoren, Testspiele, Turniere
│   │   ├── uiTransfers.js      # Verhandlungen, Leihen, U23, Transfermarkt, Scoutberichte
│   │   ├── uiAkten.js          # Spieler- und Vereinsakte
│   │   ├── uiLivespiel.js      # Match-Center, Zurufe, Seitenlinie während der Partie
│   │   ├── uiSpielbericht.js   # Spielbericht mit Schusskarte, Heatmaps und Passnetz
│   │   ├── uiSpeicher.js       # Speicherplätze, Sicherungen, Laden, Löschen, Import
│   │   ├── uiEinstieg.js       # Erste Schritte, Erklärkästen, Kurzanleitung und Begriffe
│   │   ├── uiNational.js       # Reiter Nationalteam: freie Posten, Kader, Ausrichtung, Ergebnisse
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
