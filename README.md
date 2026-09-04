# ⚽ FM PRO - Fußballmanager (Saison Edition)

Ein leichtgewichtiger, detailreicher und vollständig spielbarer **Fußballmanager im Browser**, der ohne Installation direkt gestartet, als PWA installiert oder als Paket (z. B. ZIP) an Freunde verschickt werden kann.

---

## 🚀 Spiel starten & Spielanleitung

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
3. **Schritt 2 (Liga):** Bestätige die Spielklasse (*Deutschland Liga 1* mit 18 Klubs und 34 Spieltagen).
4. **Schritt 3 (Vereinsauswahl & Kaderanalyse):** 
   - Filtere nach Name/Stadt, sortiere nach Kaderstärke oder Budget.
   - Wähle links einen Verein aus, um rechts sofort die detaillierte Analyse (Top-Spieler, Talente, Schwächen, Finanzen und Vorstandsziel) einzusehen.
   - Klicke auf **"✅ Diesen Verein übernehmen & Saison starten"**.
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

### 2b. 🧭 Positionseignung – nicht jeder kann überall spielen (`PositionEngine`)
- **Familiaritätsmodell:** Jeder Spieler hat eine Naturposition und – je nach Profil – Nebenpositionen. Wie gut er eine andere Position ausfüllt, ergibt sich aus dem Abstand der Mannschaftsteile und dem Seitenwechsel, verfeinert durch das versteckte Attribut *Anpassungsfähigkeit*.
- **Sechs Eignungsstufen:** Stammposition, Sehr gut geeignet, Geeignet, Ungewohnt, Deplatziert, Fehlbesetzung – mit Farbcode direkt am Spielerknoten.
- **Spürbare Auswirkung:** Die effektive Stärke sinkt auf bis zu 55 % der Grundstärke. Ein Stürmer als Innenverteidiger verliert rund ein Drittel seiner Wirkung, ein Feldspieler im Tor ist die schlechteste aller Notlösungen.
- **Überall wirksam:** `MatchEngine.calculateEffectivePlayerSkill` und `calculateTeamPower` bewerten Spieler auf der Position, auf der sie tatsächlich aufgestellt sind. Auch Torschützen und Zweikampfgegner im Spielbericht richten sich nach der Einsatzposition.
- **Sichtbar im UI:** Die Trikotzahl auf dem Taktikfeld zeigt die effektive Bewertung, die Ersatzbank den Wert für den ausgewählten Slot, eine Warnbox listet alle Spieler außerhalb ihrer Position. Die Spielerdetails enthalten ein vollständiges Positionsprofil.
- **Positionsbewusste Automatik:** „Beste 11 automatisch aufstellen“ und die KI-Manager verteilen die Spieler über eine Greedy-Zuordnung auf die Slots, auf denen ihre effektive Bewertung am höchsten ist.

### 3. 🎮 2D-Live-Match-Engine & Sofort-Simulation
- **Echtzeit-Regie (`LiveMatchDirector`):** Die Spieluhr läuft kontinuierlich statt in Minutensprüngen. Während eines Highlights läuft sie langsam, dazwischen holt sie auf – so passen Minute, Kommentar und Bild jederzeit zusammen.
- **Feld und Spielbericht Hand in Hand:** Jede Szene wird inszeniert (Anlauf zum Ausgangspunkt, Aktion, Auflösung). Aufbau-Kommentare erscheinen, während der Ball läuft; Torschuss, Parade und Fehlschuss werden exakt beim Eintreffen des Balls gemeldet.
- **Lebendige Ruhephasen:** Zwischen den Highlights zirkuliert der Ball über echte Spieler des Teams in Ballbesitz – mit Aufbau- und Pressing-Kommentar, Ballverlusten und wechselndem Ballbesitz.
- **Rollenabhängige Laufwege:** Abwehrkette, Mittelfeld und Angriff verschieben unterschiedlich stark, ballnahe Spieler pressen, der Ballführende dribbelt, Torhüter bleiben an ihrem Tor. Spieler stehen nie übereinander.
- **Flüssige Darstellung mit 60 Bildern pro Sekunde:** Delta-Zeit-basierte Bewegung, Mindestflugzeit für den Ball (keine Sprünge), Ballflughöhe mit wanderndem Schatten und Bewegungsschweif.
- **Optimiertes Canvas-Rendering:** DPR-korrekte Auflösung, einmalig vorgerenderter Rasen, Spielfeldmaße in echten Metern, zwischengespeicherte Textbreiten und ein inkrementell aktualisierter Ticker.
- **Live-Ticker auf Deutsch:** Farbcodierter Spielbericht für Tore, Karten, Auswechslungen und Glanzparaden.
- **Echtzeit-Statistiken:** Ballbesitz %, Schüsse, Schüsse aufs Tor, Fouls, Ecken und Expected Goals (xG).
- **In-Game Coaching:** Live-Taktikanpassungen und bis zu 5 Auswechslungen während des Spiels.

### 4. 🔄 Transfersystem, Scouting & Verträge
- **Transfermarkt mit Suchfiltern:** Nach Position, Stärke, Potenzial und Preisklasse filtern.
- **Vertragsverlängerungen (`ContractEngine`):** Individuelle Gehaltsforderungen, Rollenabsprachen und Vertragslaufzeiten direkt im Spielermenü verhandeln.
- **Scouting-Zentrale (`ScoutingEngine`):** Scouts für gezielte Positionen, Altersklassen und Mindeststärken entsenden und detaillierte Spielerberichte erhalten.
- **KI-Manager (`AIManagerEngine`):** KI-Vereine optimieren vor jedem Spieltag ihre Aufstellung und unterbreiten Angebote für deine Stars.

### 5. 🏋️ Training & Jugendakademie
- **Trainingsschwerpunkte:** Allround, Angriff, Defensive, Technik, Taktik, Regeneration, Jugendförderung.
- **Nachwuchsakademie (`YouthEngine`):** Akademie-Ausbau (Stufe 1 bis 5) für stärkere Talente und direkte Beförderung von Jugendspielern mit Profi-Vertrag in die 1. Mannschaft.
- **Verletzungen & Sperren:** Realistische Ausfallzeiten (Leicht/Mittel/Schwer) und Gelb-/Rotsperren.

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

### 8. 🌐 Multi-League, Wettbewerbe & deutsche Ligapyramide
- **Top-5-Ligen & Länder:** Deutschland, England, Spanien, Italien, Frankreich mit eigenen Liga- und Wettbewerbsregeln.
- **Deutsche Ligapyramide (Level 1 bis 7):** Bundesliga, 2. Bundesliga, 3. Liga, Regionalligen (West, Bayern, etc.), Oberligen, Verbandsliga und Landesliga mit fiktiver Generierung via `ClubGenerator` & `PlayerGenerator`.
- **Nationale Pokale & Europapokal:** Deutschland Pokal (`de_cup`), Champions League (`ucl`), Europa League (`uel`) und Conference League (`uecl`) mit Gruppen- und K.O.-Runden via `CompetitionEngine`.
- **Europäische Qualifikation:** Automatische Ermittlung der Teilnehmer für internationale Pokale am Saisonende nach Liga-Platzierung.

### 9. 🎯 100% Synchrone Timeline-MatchEngine & 2D-Visualisierung
- **Deterministische Match-Timeline (`MatchEngine.generateTimeline`):** Generiert chronologische Ketten von Spielzügen (Pässe, Flanken, Dribblings, Schüsse, xG, Glanzparaden, Tore, Karten) inklusive 2D-Koordinaten (`start`, `end`).
- **Exakte 2D-Parität:** Die 2D-Simulation (`LiveMatch`) und die Sofortsimulation (`simulateFullMatch`) werten exakt dieselbe Timeline aus. Alle Torschützen, Vorlagengeber, Ticker-Texte, Statistiken und Spielberichte stimmen 1:1 mit der 2D-Darstellung überein.

---

## 📁 Modulare Projektarchitektur

```plain text
untitled/
├── index.html                  # Hauptoberfläche & Responsive Shell
├── manifest.json               # PWA-Web-App-Manifest
├── service-worker.js           # Offline-Caching & PWA Service Worker
├── css/
│   └── style.css               # Modernes Dark-Mode UI Theme
├── js/
│   ├── app.js                  # App-Initialisierung & Controller
│   ├── core/
│   │   ├── constants.js        # Zentrale Konstanten & Enums
│   │   ├── dom.js              # Fehlertolerante DOM-Hilfsfunktionen
│   │   ├── formatters.js       # Formatierer für Geld, Datum, Prozente
│   │   ├── random.js           # Mathematische Zufallsgeneratoren
│   │   └── validators.js       # StateValidator für Spielstand, Aufstellung & Spielplan
│   ├── data/
│   │   ├── initialData.js      # 18 Bundesliga-Vereine & Spielerdaten
│   │   ├── leagueData.js       # Top-5-Ligen, Ligapyramide, Pokale & Europa-Wettbewerbe
│   │   └── namePools.js        # Namenspools für Jugend & Neugenerierungen
│   ├── services/
│   │   ├── saveService.js      # Speichern, Laden, Exportieren, Importieren
│   │   └── migrationService.js # Schema-Migrationen für Abwärtskompatibilität (v1 -> v6)
│   ├── engine/
│   │   ├── gameState.js        # Zentraler Zustand & Liga-Generator
│   │   ├── matchEngine.js      # Timeline-basierte Spielberechnung & synchrone 2D-Live-Canvas-Engine
│   │   ├── liveMatchDirector.js# Echtzeit-Regie der 2D-Simulation: Highlights, Ballführung, Laufwege
│   │   ├── positionEngine.js   # Positionsprofile, Eignungsmodell, Zonen- & Formationserkennung
│   │   ├── seasonEngine.js     # Spieltagsfortschritt & Saisonabschluss
│   │   ├── competitionEngine.js# Ligen, Pokalrunden, Europapokal & Auf-/Abstieg
│   │   ├── clubGenerator.js    # Generator für Amateur- und Pyramidenvereine
│   │   ├── playerGenerator.js  # Generator für fiktive Kader und Jugendtalente
│   │   ├── transferEngine.js   # Markt- & Transferlogik
│   │   ├── trainingEngine.js   # Wöchentliche Trainings- & Spielerentwicklung
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

## 📱 Auf dem Smartphone / Tablet spielen (Mobile & PWA)

FM PRO ist vollständig responsive und speziell für Smartphones und Tablets optimiert:

1. **Im mobilen Browser öffnen:**
   - Öffne das gehostete Spiel oder deinen lokalen Server auf deinem Smartphone (z. B. Chrome für Android oder Safari für iOS).
2. **Als App auf dem Homescreen installieren (PWA):**
   - **Android / Google Chrome:** Tippe oben rechts auf das Menü (`⋮`) -> **„Zum Startbildschirm hinzufügen“** bzw. **„App installieren“**.
   - **iPhone / Apple Safari:** Tippe unten auf das Teilen-Symbol (`⎙` / Pfeil nach oben) -> **„Zum Home-Bildschirm“**.
3. **App-Feeling & Touch-Optimierung:**
   - Startet im Vollbildmodus ohne Browserleisten (`standalone`).
   - Touch-optimierte **Bottom Navigation** mit Schnellzugriff auf *Dashboard*, *Kader*, *Taktik*, *Kalender* und das *Mehr*-Menü.
   - Alle Tabellen (Kader, Liga, Transfers) sind mobil horizontal wischbar (`touch-scroll`).
   - Modale, Taktik-Aufstellungsfeld und 2D-Live-Simulation passen sich dynamisch an jede Displaygröße (von 375px bis 1200px+) an.
4. **Offline & Speichern:**
   - Spielstände werden lokal auf deinem Smartphone im Browser gespeichert und können jederzeit als JSON exportiert oder importiert werden.

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
1. **Datenintegrität (`test_data.js`):** Alle 18 Vereine, Attribute, Torhüter, Gehalts- und Transferbudgets.
2. **Wizard & UI Regression (`test_wizard.js`):** Suchfilter, Schwierigkeitsstufen, Sortierungen, Edge-Cases, DOM-Simulation und Code-Regressionsprüfungen gegen Legacy-IDs.
3. **Engines (`test_engine.js`):** MatchEngine, SeasonEngine, Finance, Board, News, Contracts, Scouting, Youth, AIManager, SaveService & MigrationService sowie PositionEngine (Familiarität, Zonen- und Formationserkennung), eigene Formationen und die Echtzeit-Regie der 2D-Simulation.
4. **E2E & Integration (`test_e2e.js`):** Vollständiger Karrierestart, 2D-LiveMatch, Auswechslungen, Transfers, Training, Multi-Saison-Läufe und der komplette Weg von der selbst gezeichneten Formation über das Live-Spiel bis zu Export und Import.

---

## 🎮 Viel Erfolg auf dem Weg zur Meisterschaft! 🏆
