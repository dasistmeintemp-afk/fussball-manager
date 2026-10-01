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
3. **Schritt 2 (Liga):** Wähle die Liga, in der deine Karriere beginnt – **alle zwölf Ligen der Spielwelt** stehen zur Wahl, nach Ländern gruppiert: die komplette deutsche Pyramide von der Bundesliga bis zur Landesliga sowie Premier League, La Liga, Serie A und Ligue 1. Zu jeder Liga siehst du Vereinszahl, Spieltage, Wertung und Europapokalplätze.
4. **Schritt 3 (Vereinsauswahl & Kaderanalyse):**
   - Zur Auswahl stehen die Vereine **der in Schritt 2 gewählten Liga** – wer in der Landesliga anfangen will, bekommt hier auch nur Landesligisten angeboten. Die Liga lässt sich hier oben jederzeit wechseln.
   - Suche nach Name, Stadt oder Ligennamen und sortiere nach Kaderstärke oder Budget.
   - Wähle links einen Verein aus, um rechts sofort die detaillierte Analyse (Liga, Top-Spieler, Talente, Finanzen und Vorstandsziel) einzusehen.
   - Klicke auf **"✅ Diesen Verein übernehmen & Saison starten"**.
   - Startest du in der Landesliga, spielst du 30 Spieltage gegen 15 Amateurvereine – der Weg nach oben führt über den Aufstieg.
5. Du landest direkt in deinem Manager-Dashboard.

---

### 3. Spielstand-Speicherung & Weitergabe an Freunde

Das Spiel besitzt ein vollständiges, robustes Speichersystem:

* **Automatisches Speichern in IndexedDB (`SpeicherDB`):**
  Jede Aktion (Spieltage, Transfers, Taktik, Training, Vertragsverlängerungen) wird automatisch im Browser gesichert – in der Browser-Datenbank IndexedDB statt im LocalStorage. Der LocalStorage fasst je nach Browser nur 5 bis 10 MB; IndexedDB bekommt einen Anteil am freien Plattenplatz, meist mehrere hundert Megabyte. Auch lange Karrieren mit vielen Saisons Geschichte passen hinein.
  * Ein alter Spielstand aus dem LocalStorage zieht beim ersten Start automatisch um; danach wird der LocalStorage freigegeben.
  * Gibt es kein IndexedDB (sehr alte Browser, manche private Fenster) oder scheitert ein Schreibvorgang, springt der LocalStorage ein. Liegen in beiden Speichern Stände, gilt beim nächsten Start der jüngere.
  * Gesammelt wird eine Sekunde lang, dann einmal geschrieben. Beim Schließen oder Wegwechseln der Seite geht ein offener Stand sofort an die Datenbank.
  * Unter **Spielstand & Einstellungen** steht, wo der Stand liegt, wie groß er ist und wie viel Platz der Browser noch frei hält.
* **Spielstand fortsetzen:**
  Beim erneuten Öffnen zeigt der Startbildschirm deine Managerdaten, Verein, Saison, Spieltag, Tabellenplatz und den Speicherzeitpunkt. Klicke einfach auf **"▶️ Spielstand fortsetzen"**.
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

> **Live und sofort berechnet:** Die Sofort-Simulation erzeugt alle Ereignisse vorab als Timeline. Im Livespiel gibt sie seit dem Entscheidungsmodus nur noch den Rahmen vor (Wechsel, Verletzungen, Halbzeit, Abpfiff) – alles andere entsteht auf dem Feld (siehe unten). Jedes Ereignis wird dabei in dieselbe Timeline geschrieben, aus der auch der Spielbericht rechnet: Live-Anzeige und Bericht zeigen Feld für Feld dieselben Zahlen, ein Test prüft das.

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

### 5c. 🎓 Nachwuchs: Beförderung über den Berater
Ein Talent in den Profikader zu holen dauert jetzt seine Zeit. *Vertragsgespräche aufnehmen* startet die Verhandlung mit dem Berater über Gehalt, Laufzeit und Handgeld; erst nach der Einigung – meist drei bis sechs Tage – unterschreibt der Spieler seinen ersten Profivertrag und taucht im Kader auf. Die Forderung richtet sich nach Potenzial und Ligastufe.

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

### 7. 🗓️ Kalender-Tagesablauf, 🔍 Gegneranalyse & 🌟 Scoutingsystem
- **Spielerbewertungssystem (`PlayerRatingEngine`):** Trennung von echten internen Fähigkeiten (CA/PA 1–200, Hidden Attributes wie Professionalität & Ehrgeiz) und sichtbaren, scoutabhängigen Einschätzungsbereichen.
- **Relative Sternebewertungen:** Qualitätssterne (0.5 bis 5.0) werden dynamisch relativ zur Stärke des eigenen Kaders berechnet.
- **Testspiele werden angesagt:** Ein Spieltermin der Vorbereitung erscheint wie ein Spieltag – mit beiden Mannschaften und der Wahl zwischen Live-Spiel und Sofortergebnis. Das live gespielte Ergebnis wird so eingetragen, wie es auf dem Platz fiel.
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
- **Verbessertes Postfach (`NewsEngine`):** Vollständige Suche, Filterleiste (Vorstand, Spiel, Transfers, Training, Finanzen) und dauerhafte Mail-Historie.

### 8. 🌐 Die Spielwelt: 218 Vereine aus fünf Ländern (`WorldGenerator`)
- **Zwölf spielbare Ligen, 218 Vereine, über 4300 Spieler.** Die komplette Welt wird beim Karrierestart erzeugt und läuft Saison für Saison mit.
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

### 8b. 💾 Kompaktes Speicherformat (`SaveCodec`)
Eine komplette Welt mit über 4300 Spielern belegt als gewöhnliches JSON knapp 6 MB. Seit der Spielstand in IndexedDB liegt, ist das keine harte Grenze mehr – kleiner bleibt trotzdem schneller beim Speichern, Laden und Exportieren. Der `SaveCodec` wandelt Spieler und Spielplan-Partien deshalb in positionale Arrays um und legt alle Zeichenketten in einer gemeinsamen Tabelle ab. Namen, Nationalitäten und Positionen tauchen nur noch einmal auf.

- **5,9 MB → 1,6 MB** bei verlustfreier Rückwandlung; unbekannte Zusatzfelder überleben die Umwandlung in einem Restobjekt.
- Gespielte Partien geben ihre Timeline frei (rund 22 KB je Spiel) – die Zähler stecken danach ohnehin in `stats` und `events`.
- Partien fremder Ligen behalten nur das Ergebnis; nur die eigenen Spiele behalten Einzelkritiken, Ereignisse und Aufstellungen.

### 9. 🎯 100% Synchrone Timeline-MatchEngine & 2D-Visualisierung
- **Deterministische Match-Timeline (`MatchEngine.generateTimeline`):** Generiert chronologische Ketten von Spielzügen (Pässe, Flanken, Dribblings, Schüsse, xG, Glanzparaden, Tore, Karten) inklusive 2D-Koordinaten (`start`, `end`).
- **Exakte 2D-Parität:** Die 2D-Simulation (`LiveMatch`) und die Sofortsimulation (`simulateFullMatch`) werten exakt dieselbe Timeline aus. Alle Torschützen, Vorlagengeber, Ticker-Texte, Statistiken und Spielberichte stimmen 1:1 mit der 2D-Darstellung überein.

### 10. 🌍 Länderspiele, Kabine, Verträge, Wetter, Trainerprofil und U23

- **Nationalmannschaften und Länderspielpausen (`NationalTeamEngine`):** Viermal im Jahr ruht die Liga. Jede Nation mit genug Spielern im Spiel nominiert ihren Kader (3 Torhüter, 8 Abwehr, 7 Mittelfeld, 5 Sturm), die Nationalspieler reisen ab, bestreiten zwei Länderspiele und kehren müde zurück – manchmal verletzt. Länderspiele und Tore stehen in der Spielerakte.
- **Kabinenhierarchie (`DressingRoomEngine`):** Führungsspieler, Neuzugänge und Grüppchen nach Sprache, jede Gruppe mit Wortführer und Stimmung. Ein unzufriedener Wortführer färbt auf seine Gruppe ab, ein unzufriedener Kapitän auf alle. Den Kapitän bestimmt der Trainer; wer einen Führungsspieler verkauft, hat ein paar Tage Unruhe.
- **Verträge:** Neben Gehalt und Laufzeit gehören Beraterhonorar, Einsatz- und Torprämien dazu. Prämien schonen das feste Gehalt und werden nach jedem Spiel ausgezahlt. Leihen können eine **Kaufoption** haben; KI-Vereine ziehen sie, wenn der Spieler gespielt hat und das Geld reicht.
- **Wetter und Platz (`WetterEngine`):** Jede Partie bekommt Wetter nach Jahreszeit und einen Rasen nach Ligastufe. Nasser Rasen macht Fernschüsse tückisch, tiefer Boden kostet Kraft und Genauigkeit, Wind verweht lange Bälle, Hitze zehrt an der Ausdauer. Vorschau, Livespiel und Spielbericht zeigen es an.
- **Spielanalyse:** Nach einem live verfolgten Spiel gehören zum Spielbericht Heatmaps beider Mannschaften und ein Passnetz – wer mit wem wie oft zusammengespielt hat und wo er im Schnitt stand. Beim Sofort-Ergebnis rechnet das Spiel ohne Laufwege; dann sagt der Bericht, warum die Karte fehlt, statt eine zu erfinden.
- **Trainerprofil (`TrainerProfilEngine`):** Fünf Werte von 1 bis 20 (Taktik, Motivation, Menschenführung, Jugendarbeit, Spielerbewertung), die wirklich wirken – auf Vertrautheit, Ansprachen, Einzelgespräche, Talententwicklung und Scoutberichte. Dazu B-, A- und Pro-Lizenz: Ab der Regionalliga verlangt der Verband die A-Lizenz, in den Bundesligen die Pro-Lizenz. Lehrgänge kosten Geld und Zeit. Am Saisonende wächst, was gefordert war.
- **Zweite Mannschaft (U23, `ReserveEngine`):** Talente, die bei den Profis nicht spielen, schickt man in die U23. Sie spielt an jedem Spieltag ein eigenes Spiel und bringt Spielpraxis (etwas weniger als bei den Profis), Spielschärfe und eine eigene Bilanz. Höchstens drei Spieler über 23, im Profikader bleiben mindestens 16. Die KI-Vereine geben ihren Talenten ohne Einsatz ebenfalls etwas Praxis.
- **Taktik:** Konter und tiefer Block wurden überarbeitet – Umschalten mit Verzögerung für Verteidiger, Befreiungsschläge aus der tiefen Linie, Laufwege in die Tiefe. Gemessen gegen einen hoch pressenden Favoriten (24 Spiele je Variante): Konter holt 0,71 Punkte je Spiel statt 0,38 mit der Grundeinstellung; der tiefe Block, der nach Ballgewinn sofort nach vorn spielt, kassiert 1,79 statt 2,88 Tore. Ehrlich gesagt: Gegen eine viel stärkere Mannschaft bleibt der tiefe Block auch so die schwierigste Wahl.
- **Langzeittest (drei Saisons, alle zwölf Ligen):** Die Ligastufen bleiben stabil (Bundesliga 76,2 → 75,8, Landesliga 20,9 → 22,4 – vorher stieg sie auf 25,2, weil schwache Spieler nicht mehr abbauten). Die Weltspitze wächst leicht (Schnitt der besten 50: 89,9 → 92,7, Höchstwert 95). Der Spielstand wächst von 2,1 auf 3,1 MB. Der Favorit nach Kaderstärke wird in 39 % der Ligen Meister, in 58 % kommt der Meister aus den drei stärksten Kadern.
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
│   │   ├── worldGenerator.js   # Baut die Welt: 218 Vereine in zwölf Ligen samt Spielplänen
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
│   │   ├── nationalTeamEngine.js # Nationalmannschaften, Nominierungen, Länderspielpausen
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
│   │   ├── calendarEngine.js   # Saisonkalender & dynamischer Tagesablauf
│   │   └── opponentAnalysisEngine.js # Taktische Gegneranalyse
│   └── ui/
│       ├── uiManager.js        # Kern: Start, Assistent, Reiter, Kader, Taktik, Kalender, Ereignisse
│       ├── uiSpielfeld.js      # Leinwand des 2D-Spiels: Rasen, Radar, Einblendungen, Stadionklang
│       ├── uiVorbereitung.js   # Vorbereitung: Stab, Sponsoren, Testspiele, Turniere
│       ├── uiTransfers.js      # Verhandlungen, Leihen, U23, Transfermarkt, Scoutberichte
│       ├── uiAkten.js          # Spieler- und Vereinsakte
│       ├── uiLivespiel.js      # Match-Center, Zurufe, Seitenlinie während der Partie
│       └── uiSpielbericht.js   # Spielbericht mit Schusskarte, Heatmaps und Passnetz
├── pruefung.js                 # Statische Prüfung: Syntax, doppelte Methoden, globale Namen, Offline-Vorrat
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
node pruefung.js                              # nur die statische Prüfung
```
Jeder Test bekommt feste Zufallswerte aus seinem Namen – er liefert allein dasselbe Ergebnis wie in der ganzen Suite. Vor jeder Suite läuft `pruefung.js`: Syntax aller Dateien, doppelte Methoden (auch über die ausgelagerten UI-Teile hinweg), doppelte globale Namen und ob jede Datei geladen und offline vorrätig ist.

Oder führe die individuellen Test-Suiten aus:
```bash
node test_data.js && node test_wizard.js && node test_engine.js && node test_e2e.js
```
Alle 4 Testsuiten validieren lückenlos:
1. **Datenintegrität (`test_data.js`):** Alle 18 handgepflegten Vereine, Attribute, Torhüter, Gehalts- und Transferbudgets.
2. **Wizard & UI Regression (`test_wizard.js`):** Suchfilter, Schwierigkeitsstufen, Sortierungen, Edge-Cases, DOM-Simulation, Code-Regressionsprüfungen gegen Legacy-IDs sowie die Installierbarkeit auf dem Telefon (Manifest, vorhandene Symbole, vollständiger Offline-Vorrat).
3. **Engines (`test_engine.js`):** MatchEngine, SeasonEngine, Finance, Board, News, Contracts, Scouting, Youth, AIManager, SaveService & MigrationService sowie PositionEngine (Familiarität, Zonen- und Formationserkennung), eigene Formationen und die Echtzeit-Regie der 2D-Simulation. Dazu die Spielwelt: alle zwölf Ligen gefüllt, Stärkestaffelung über die Ligastufen, Karrierestart in der Landesliga, Europapokal-Besetzung, Auf-/Abstieg und die verlustfreie Kodierung des Spielstands.
3b. Dazu die Sandbox-Systeme: Kabinenansprachen mit lageabhängiger Wirkung, Pressekonferenzen mit Themen nach Lage, Versprechen und Kampfansagen, die Taktikbesprechung, mehrtägige Transferverhandlungen über alle drei Phasen, das Scheitern von Lowball-Angeboten, Vertragsgespräche für Nachwuchsspieler, Trainingsbelastung mit Ermüdungs- und Risikokurve sowie Nebenpositionen und erlernte Routine.
4. **E2E & Integration (`test_e2e.js`):** Vollständiger Karrierestart, 2D-LiveMatch, Auswechslungen, Transfers, Training, Multi-Saison-Läufe und der komplette Weg von der selbst gezeichneten Formation über das Live-Spiel bis zu Export und Import.

---

## 🎮 Viel Erfolg auf dem Weg zur Meisterschaft! 🏆
