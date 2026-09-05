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
3. **Schritt 2 (Liga):** Bestätige die Rahmenbedingungen deiner Karriere.
4. **Schritt 3 (Vereinsauswahl & Kaderanalyse):**
   - Zur Auswahl stehen **alle 218 Vereine der Spielwelt** – von den fünf europäischen Topligen bis hinunter zur Landesliga.
   - Filtere nach Liga, suche nach Name, Stadt oder Ligennamen und sortiere nach Kaderstärke oder Budget.
   - Wähle links einen Verein aus, um rechts sofort die detaillierte Analyse (Liga, Top-Spieler, Talente, Finanzen und Vorstandsziel) einzusehen.
   - Klicke auf **"✅ Diesen Verein übernehmen & Saison starten"**.
   - Startest du in der Landesliga, spielst du 30 Spieltage gegen 15 Amateurvereine – der Weg nach oben führt über den Aufstieg.
5. Du landest direkt in deinem Manager-Dashboard.

---

### 3. Spielstand-Speicherung & Weitergabe an Freunde

Das Spiel besitzt ein vollständiges, robustes Speichersystem:

* **Automatisches Speichern (`SaveService` & `localStorage`):**
  Jede Aktion (Spieltage, Transfers, Taktik, Training, Vertragsverlängerungen) wird automatisch im lokalen Browser-Speicher abgelegt.
* **Spielstand fortsetzen:**
  Beim erneuten Öffnen zeigt der Startbildschirm deine Managerdaten, Verein, Saison, Spieltag, Tabellenplatz und den Speicherzeitpunkt. Klicke einfach auf **"▶️ Spielstand fortsetzen"**.
* **Spielstand exportieren:**
  Klicke im Menü unter **"Spielstand & Optionen"** auf **"💾 Spielstand exportieren"**. Du erhältst eine `.json`-Datei mit einem sprechenden Dateinamen (z. B. `fm-save-fc-münchen-saison-1-spieltag-5.json`).
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

### 2. 📋 Aufstellung, Taktik & Teamchemie
- **Aufstellungsprüfung (`StateValidator`):** Verhindert Spielstart bei ungültiger Startelf (genau 11 Spieler, genau 1 TW, keine verletzten oder gesperrten Spieler).
- **Formationen:** `4-4-2`, `4-3-3`, `4-2-3-1`, `3-5-2`, `5-3-2`, `4-1-4-1`, `4-3-1-2`.
- **Freier Formations-Editor mit Raster:** Rasterüberlagerung (20 × 12 Zellen) plus Zonenbänder für Angriff, Mittelfeld, Abwehr und Torraum. Positionen lassen sich per Maus oder Finger frei verschieben – wahlweise am Raster ausgerichtet oder stufenlos.
- **Automatische Positions- und Formationserkennung:** Die Positionsbezeichnung folgt der Zone (wer in den Sechserraum gezogen wird, ist ein DM) und lässt sich pro Slot manuell überschreiben. Der Formationsname (`4-2-3-1`, `3-5-2`, …) wird live aus der Staffelung abgeleitet.
- **Eigene Formationen:** Beliebig viele eigene Aufstellungen benennen, speichern, zurücksetzen und löschen. Sie erscheinen im Formations-Dropdown und stehen allen Systemen zur Verfügung – Sofortsimulation, 2D-Live-Spiel und KI-Aufstellung.
- **Taktische Stellschrauben:** Mentalität, Pressing, Spieltempo, Passstil, Angriffsfokus.
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

### 3. 🎮 2D-Live-Match-Engine & Sofort-Simulation
- **Echtzeit-Regie (`LiveMatchDirector`):** Die Spieluhr läuft kontinuierlich statt in Minutensprüngen. Während eines Highlights läuft sie langsam, dazwischen holt sie auf – so passen Minute, Kommentar und Bild jederzeit zusammen.
- **Feld und Spielbericht Hand in Hand:** Jede Szene wird inszeniert (Anlauf zum Ausgangspunkt, Aktion, Auflösung). Aufbau-Kommentare erscheinen, während der Ball läuft; Torschuss, Parade und Fehlschuss werden exakt beim Eintreffen des Balls gemeldet.
- **Echtes Ballbesitzspiel (`MatchFlowEngine`):** Zwischen den Highlights wird nicht zufällig gepasst, sondern gespielt. Die Engine bewertet den Druck auf den Ballführenden, projiziert Gegner auf die Passwege, misst den Freiraum der Anspielstationen und wählt daraus die Option: kurzer Pass, Verlagerung, langer Ball, Dribbling oder Befreiungsschlag. Der Ausgang folgt den Attributen – Passgenauigkeit aus Passen, Übersicht und Technik gegen Druck und zugestellte Wege; Dribblings aus Dribbling und Tempo gegen die Defensivwerte des Gegenspielers.
- **Ballverluste haben Folgen:** Fehlpässe werden abgefangen, liegen frei oder gehen ins Aus. Über ein komplettes Spiel entstehen so rund 120 Spielaktionen mit realistischer Passquote und rund 19 Standardsituationen.
- **Standardsituationen:** Seitenaus führt zum Einwurf, Toraus zum Abstoß – jeweils mit Ausführendem, Schiedsrichterpfiff, kurzer Ruhephase und passender Aufstellung beider Mannschaften. Der Abstoß wird kurz aufgebaut oder lang geschlagen, je nach eingestelltem Passspiel.
- **Mannschaftsblöcke statt Punktehaufen:** Die angreifende Mannschaft rückt gestaffelt mit dem Ball auf, die verteidigende hält eine gemeinsame Abwehrlinie nach eingestellter Abwehrhöhe. Außenverteidiger hinterlaufen auf ihrer Seite, Stürmer starten in die Tiefe, Mittelfeld und Angriff stellen beim Verteidigen Gegenspieler zu.
- **Taktik ist sichtbar:** Direktes Passspiel erzeugt messbar längere Pässe als Kurzpassspiel, der Angriffsfokus verschiebt das Spiel auf die gewählte Seite, und eine sehr offensive Mannschaft spielt 80 % ihrer Pässe nach vorne (bei niedrigerer Erfolgsquote) gegenüber 40 % bei sehr defensiver Ausrichtung.
- **Kameraführung wie im Fernsehen:** Die Kamera folgt dem Ball mit Vorhalt und zoomt nach Situation – Totale im Spielaufbau, näher bei Highlights, eng bei Standardsituationen. Ein Übersichtsradar blendet sich ein, sobald herangezoomt wird.
- **Spieler mit Physis:** Blickrichtung, Sprintspur, abgesetzte Torwarttrikots und eine Kondition, die über die Spielminuten sinkt (unabhängig von der gewählten Abspielgeschwindigkeit) und das Tempo drückt. Eingewechselte Spieler kommen frisch aufs Feld.
- **Einblendungen:** Anpfiff, Halbzeit, Nachspielzeit, Abpfiff, Karten, Auswechslungen, Verletzungen sowie eine Torsequenz mit Schütze und Vorlagengeber.
- **Stadionatmosphäre:** Ein Publikumsteppich, dessen Pegel sich nach der Spielsituation richtet, Schiedsrichterpfiff bei Fouls und Standards, Raunen bei vergebenen Chancen.
- **Flüssige Darstellung mit 60 Bildern pro Sekunde:** Delta-Zeit-basierte Bewegung, Mindestflugzeit für den Ball (keine Sprünge), Ballflughöhe mit wanderndem Schatten und Bewegungsschweif.
- **Optimiertes Canvas-Rendering:** DPR-korrekte Auflösung, einmalig vorgerenderter Rasen, Spielfeldmaße in echten Metern, zwischengespeicherte Textbreiten und ein inkrementell aktualisierter Ticker.
- **Live-Ticker auf Deutsch:** Farbcodierter Spielbericht für Tore, Karten, Auswechslungen und Glanzparaden.
- **Echtzeit-Statistiken:** Ballbesitz %, Schüsse, Schüsse aufs Tor, Fouls, Ecken und Expected Goals (xG).
- **In-Game Coaching:** Live-Taktikanpassungen und bis zu 5 Auswechslungen während des Spiels.

> **Warum Ecken weiterhin nur aus der Timeline kommen:** Alle zählbaren Ereignisse (Tore, Schüsse, Karten, Fouls, Ecken) stammen ausschließlich aus der vorab erzeugten Timeline. Nur so zeigt eine sofort berechnete Partie exakt dieselben Zahlen wie eine im 2D-Modus verfolgte. Der Spielfluss erzeugt deshalb nur Einwürfe und Abstöße – Ereignisse, die in keiner Statistik auftauchen.

### 3b. 🗣️ Kabinenansprache & Pressekonferenz (`ManagerEngine`)
Ein Manager verwaltet keine Tabellen, er redet mit Leuten.

**Vor dem Anpfiff und in der Halbzeit** wählen Sie den Ton: *Ruhig bleiben*, *Anfeuern*, *Mehr fordern*, *Vertrauen aussprechen* oder *Lautstark werden*. Der Ton wird nicht bewertet, sondern wirkt – und zwar abhängig von der Lage:

| Situation | Anbrüllen | Mehr fordern | Vertrauen |
|---|---|---|---|
| 0:2 zurück, Favorit | **+6** Moral | **+7** Moral | ±0 |
| 2:0 vorn | **−8** Moral | +2 | ±0 |
| Verunsicherte Mannschaft | stark negativ | negativ | **+8** |

Jeder Spieler reagiert eigen: Temperament verstärkt jede Ansprache, Professionalität dämpft Kritik. Zwei, drei Spieler melden sich sichtbar zurück („nickt und klatscht in die Hände" / „schaut zu Boden und sagt nichts"). Die Wirkung landet in Moral und Form – und damit direkt in der Spielstärke. Eine wirksame **Halbzeitansprache** lässt den weiteren Spielverlauf neu berechnen.

**Am Medientag** stellen sich die Journalisten. Vier Themen (Form, ein Spieler in der Kritik, das Saisonziel, die Erwartung der Fans) mit je drei Antworten, die Fanstimmung, Medienrummel, Vorstandsvertrauen und Teammoral verschieben. Wer sich vor einen kritisierten Spieler stellt, gewinnt ihn zurück (+12 Moral) und zahlt beim Boulevard drauf.

### 3c. 📌 Der Schreibtisch
Das Dashboard zeigt, was heute eine Entscheidung braucht – nach Dringlichkeit sortiert, ein Klick springt in den zuständigen Reiter: unvollständige Startelf, Verhandlungen mit uns am Zug, Ausfälle, überlastete Spieler, auslaufende Verträge, unzufriedene Spieler, ungelesene Post.

### 4. 🔄 Transfersystem, Scouting & Verträge
- **Transfermarkt mit Suchfiltern:** Nach Position, Stärke, Potenzial und Preisklasse filtern.
- **Vertragsverlängerungen (`ContractEngine`):** Individuelle Gehaltsforderungen, Rollenabsprachen und Vertragslaufzeiten direkt im Spielermenü verhandeln.
- **Scouting-Zentrale (`ScoutingEngine`):** Scouts für gezielte Positionen, Altersklassen und Mindeststärken entsenden und detaillierte Spielerberichte erhalten.
- **KI-Manager (`AIManagerEngine`):** KI-Vereine optimieren vor jedem Spieltag ihre Aufstellung und unterbreiten Angebote für deine Stars.

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
- **Verletzungen & Sperren:** Realistische Ausfallzeiten (Leicht/Mittel/Schwer) und Gelb-/Rotsperren.

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
- **Infrastruktur:** Stadion, Trainingsgelände, Jugendzentrum und medizinische Abteilung.

### 7. 🗓️ Kalender-Tagesablauf, 🔍 Gegneranalyse & 🌟 FM-Scoutingsystem
- **FM-Spielerbewertungssystem (`PlayerRatingEngine`):** Trennung von echten internen Fähigkeiten (CA/PA 1–200, Hidden Attributes wie Professionalität & Ehrgeiz) und sichtbaren, scoutabhängigen Einschätzungsbereichen.
- **Relative Sternebewertungen:** Qualitätssterne (0.5 bis 5.0) werden dynamisch relativ zur Stärke des eigenen Kaders berechnet.
- **Saisonkalender & Wochenplan (`CalendarEngine`):** Realistischer Tagesablauf zwischen Spieltagen (Regeneration, Schwerpunkt-Training, Medien-/Sponsoren-Events, Taktikschulung und Gegneranalyse).
- **Taktische Gegneranalyse (`OpponentAnalysisEngine`):** Vor jedem Ligaspiel detaillierte Stärken-/Schwächenprofile, gegnerische Taktiktendenzen, Gefahreinstufung und konkrete Trainer-Empfehlungen abrufen.
- **Detaillierte Spielberichte:** Textzusammenfassungen, xG-Vergleiche, Zweikampfquoten, Paraden und Auszeichnungen für den Mann des Spiels.
- **Verbessertes Postfach (`NewsEngine`):** Vollständige Suche, Filterleiste (Vorstand, Spiel, Transfers, Training, Finanzen) und dauerhafte Mail-Historie.

### 8. 🌐 Die Spielwelt: 218 Vereine aus fünf Ländern (`WorldGenerator`)
- **Zwölf spielbare Ligen, 218 Vereine, über 4300 Spieler.** Die komplette Welt wird beim Karrierestart erzeugt und läuft Saison für Saison mit.
- **Top-5-Ligen:** Deutschland, England, Spanien, Italien und Frankreich – jede mit landestypischen Vereins-, Städte- und Spielernamen. In England spielen *Rovers* und *Wanderers*, in Spanien *Real* und *Deportivo*, in Italien *AC* und *Calcio*, in Frankreich *Olympique* und *Stade*.
- **Deutsche Ligapyramide (Stufe 1 bis 7):** Bundesliga, 2. Bundesliga, 3. Liga, Regionalliga West & Bayern, Oberliga Nord, Verbandsliga und Landesliga.
- **Spielerstärke nach Ligastufe – wie bei FM:** Der `PlayerGenerator` staffelt Fähigkeit (CA) und Potenzial (PA) nach Ligastufe *und* Ruf des Vereins. Ein Landesligist spielt mit Spielern um 20 Gesamtstärke, ein Bundesliga-Spitzenklub um 80. Zwischen benachbarten Stufen bleibt eine Überschneidung: Der Zweitligameister kann stärker sein als der Bundesliga-Absteiger.

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
- **Echte Europapokal-Qualifikanten:** Die Startplätze folgen den `europeanSpots` der Ligadefinition – England, Spanien und Italien stellen vier Champions-League-Teilnehmer, Frankreich drei. Kein Verein startet in zwei Wettbewerben.
- **Auf- und Abstieg über die gesamte Pyramide:** Aus jeder Liga steigen genauso viele Vereine ab, wie von unten aufsteigen; alle Ligen behalten ihre Mannschaftszahl. Aufsteiger nehmen ihren Kader mit und starten bewusst als Außenseiter.
- **Ligawechsel in der Tabellenansicht:** Der Wettbewerbswähler im Reiter *Wettbewerbe & Spielplan* zeigt jede Liga der Welt mit eigener Tabelle und eigenem Spielplan.

### 8b. 💾 Kompaktes Speicherformat (`SaveCodec`)
Eine komplette Welt mit über 4300 Spielern belegt als gewöhnliches JSON knapp 6 MB – mehr, als der LocalStorage der Browser üblicherweise zulässt (rund 5 MB). Der `SaveCodec` wandelt Spieler und Spielplan-Partien deshalb in positionale Arrays um und legt alle Zeichenketten in einer gemeinsamen Tabelle ab. Namen, Nationalitäten und Positionen tauchen nur noch einmal auf.

- **5,9 MB → 1,6 MB** bei verlustfreier Rückwandlung; unbekannte Zusatzfelder überleben die Umwandlung in einem Restobjekt.
- Gespielte Partien geben ihre Timeline frei (rund 22 KB je Spiel) – die Zähler stecken danach ohnehin in `stats` und `events`.
- Partien fremder Ligen behalten nur das Ergebnis; nur die eigenen Spiele behalten Einzelkritiken, Ereignisse und Aufstellungen.

### 9. 🎯 100% Synchrone Timeline-MatchEngine & 2D-Visualisierung
- **Deterministische Match-Timeline (`MatchEngine.generateTimeline`):** Generiert chronologische Ketten von Spielzügen (Pässe, Flanken, Dribblings, Schüsse, xG, Glanzparaden, Tore, Karten) inklusive 2D-Koordinaten (`start`, `end`).
- **Exakte 2D-Parität:** Die 2D-Simulation (`LiveMatch`) und die Sofortsimulation (`simulateFullMatch`) werten exakt dieselbe Timeline aus. Alle Torschützen, Vorlagengeber, Ticker-Texte, Statistiken und Spielberichte stimmen 1:1 mit der 2D-Darstellung überein.

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
│   │   ├── saveCodec.js        # Kompaktes Speicherformat: 5,9 MB Welt werden zu 1,6 MB
│   │   └── migrationService.js # Schema-Migrationen für Abwärtskompatibilität (v1 -> v6)
│   ├── engine/
│   │   ├── gameState.js        # Zentraler Zustand & Liga-Generator
│   │   ├── matchEngine.js      # Timeline-basierte Spielberechnung & synchrone 2D-Live-Canvas-Engine
│   │   ├── liveMatchDirector.js# Echtzeit-Regie der 2D-Simulation: Highlights, Ballführung, Laufwege
│   │   ├── matchFlowEngine.js  # Ballbesitz-Mikrosimulation: Druck, Passwege, Dribblings, Zweikämpfe
│   │   ├── positionEngine.js   # Positionsprofile, Eignungsmodell, Zonen- & Formationserkennung
│   │   ├── seasonEngine.js     # Spieltagsfortschritt & Saisonabschluss
│   │   ├── competitionEngine.js# Ligen, Pokalrunden, Europapokal & Auf-/Abstieg
│   │   ├── worldGenerator.js   # Baut die Welt: 218 Vereine in zwölf Ligen samt Spielplänen
│   │   ├── clubGenerator.js    # Landestypische Vereine mit Ruf, Stadion und Etat je Ligastufe
│   │   ├── playerGenerator.js  # Kader nach Ligastufe & Vereinsruf, Attributprofile je Position
│   │   ├── transferEngine.js   # Markt- & Transferlogik
│   │   ├── negotiationEngine.js# Mehrtägige Verhandlungen mit Vereinen und Beratern
│   │   ├── managerEngine.js    # Kabinenansprachen, Pressekonferenzen & Aufgabenliste
│   │   ├── trainingEngine.js   # Tägliche Belastung, Ermüdung, Risiko & Entwicklung
│   │   ├── financeEngine.js    # Spieltagseinnahmen, Gehälter & Journal
│   │   ├── boardEngine.js      # Vorstandszufriedenheit & Saisonziele
│   │   ├── newsEngine.js       # Zentrales Nachrichtensystem & Postfach
│   │   ├── aiManagerEngine.js  # KI-Aufstellungen & KI-Transferangebote
│   │   ├── scoutingEngine.js   # Scoutaufträge & Spielerberichte
│   │   ├── youthEngine.js      # Jugendförderung & Akademieausbau
│   │   ├── contractEngine.js   # Vertragsforderungen & Verlängerungen
│   │   ├── calendarEngine.js   # Saisonkalender & dynamischer Tagesablauf
│   │   └── opponentAnalysisEngine.js # Taktische Gegneranalyse
│   └── ui/
│       └── uiManager.js        # Render-Logik aller Ansichten & Modale
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

Oder führe die individuellen Test-Suiten aus:
```bash
node test_data.js && node test_wizard.js && node test_engine.js && node test_e2e.js
```
Alle 4 Testsuiten validieren lückenlos:
1. **Datenintegrität (`test_data.js`):** Alle 18 handgepflegten Vereine, Attribute, Torhüter, Gehalts- und Transferbudgets.
2. **Wizard & UI Regression (`test_wizard.js`):** Suchfilter, Schwierigkeitsstufen, Sortierungen, Edge-Cases, DOM-Simulation, Code-Regressionsprüfungen gegen Legacy-IDs sowie die Installierbarkeit auf dem Telefon (Manifest, vorhandene Symbole, vollständiger Offline-Vorrat).
3. **Engines (`test_engine.js`):** MatchEngine, SeasonEngine, Finance, Board, News, Contracts, Scouting, Youth, AIManager, SaveService & MigrationService sowie PositionEngine (Familiarität, Zonen- und Formationserkennung), eigene Formationen und die Echtzeit-Regie der 2D-Simulation. Dazu die Spielwelt: alle zwölf Ligen gefüllt, Stärkestaffelung über die Ligastufen, Karrierestart in der Landesliga, Europapokal-Besetzung, Auf-/Abstieg und die verlustfreie Kodierung des Spielstands.
3b. Dazu die Sandbox-Systeme: Kabinenansprachen mit lageabhängiger Wirkung, Pressekonferenzen, mehrtägige Transferverhandlungen über alle drei Phasen, das Scheitern von Lowball-Angeboten, Vertragsgespräche für Nachwuchsspieler, Trainingsbelastung mit Ermüdungs- und Risikokurve sowie Nebenpositionen und erlernte Routine.
4. **E2E & Integration (`test_e2e.js`):** Vollständiger Karrierestart, 2D-LiveMatch, Auswechslungen, Transfers, Training, Multi-Saison-Läufe und der komplette Weg von der selbst gezeichneten Formation über das Live-Spiel bis zu Export und Import.

---

## 🎮 Viel Erfolg auf dem Weg zur Meisterschaft! 🏆
