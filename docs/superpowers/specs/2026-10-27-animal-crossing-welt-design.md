# Animal-Crossing-Welt – Design

Idee von Felix und Papa (27.10.2026): Das Spiel soll sich mehr wie Animal Crossing anfühlen. Alle 4 Teile sind
im Gespräch bestätigt („Ja, passt“). Die vorher besprochenen Wünsche A–C (Menschen laufen nicht durch Fahrzeuge,
Strafzettel bei Unfällen, Reden mit Menschen) sind hier enthalten.

## Ziel und Erfolg
- Die Welt lebt nach der **echten Uhrzeit und dem echten Datum** des iPads: Himmel, Licht, Jahreszeit, Fische,
  Läden und Menschen.
- In Hafenhausen wohnen **Nachbarn mit Namen**, mit denen man redet, die Aufgaben geben und Freunde werden.
- Es gibt ein **Museum** für Fische und **jeden Tag etwas Neues**.
- Fertig für Felix: Er sieht nachmittags anderen Himmel als abends, fängt den Aal am Abend, liest im Fischbuch die
  Zeiten, redet mit „Frau Petersen“, bringt ihr einen Hering, spendet Fische ins Museum, findet eine Flaschenpost.
- Alles mit **15 Minuten Spielzeit nach der Schule (ab 16 Uhr)** erreichbar. Nichts ist gruselig, nichts verletzt.

## Gesagt (Felix/Papa) und angenommen
**Gesagt:** Himmel und Licht, Fische, Menschen und Läden nach Uhrzeit; Jahreszeiten; Nachbarn mit Freundschaft;
Museum; tägliche Sachen; Reden kurz mit Knöpfen (Stil i-have-adhd), Tipps, Aufgaben, Namen; Strafe je Fahrzeug
(5 / 20 Ludins) für Unfälle mit Menschen, Wänden, geparkten Fahrzeugen; „alles als ein großer Plan“.
**Angenommen (vom Plan festgelegt, kann geändert werden):**
- Zeitquelle ist die Uhr des iPads (`new Date()`); wer die Uhr verstellt, „reist in der Zeit“ wie bei Animal
  Crossing – kein Schutz nötig.
- Läden 8–22 Uhr. Fischzeiten so, dass **16–18 Uhr jeder Fisch möglich** ist.
- Jahreszeiten nur in Deutschland (Heimat-See, Flussplätze, Hafenhausen), am Amazonas Regen-/Trockenzeit nur als Text.
- Museum zeigt **nur echte Fotos** (keine gemalten oder 3D-Fische, siehe CLAUDE.md).

## Teil 1 – Weltzeit, Himmel, Licht
- Ein Modul **Weltzeit**: `now()` (Date), `localHour()`, `todayKey()` (`JJJJ-MM-TT`), `sunAt(lat, date)` →
  Sonnenhöhe (einfache Sonnenstands-Formel), `season(date)` (meteorologisch: Frühling ab 1.3., Sommer 1.6.,
  Herbst 1.9., Winter 1.12.). Alle anderen Teile fragen nur dieses Modul. Neu berechnet alle 30 s und beim
  Ortswechsel.
- Breitengrad je Gegend: Amazonas ≈ −3°, Deutschland/Hafenhausen/Heimat-See ≈ 51°. Dadurch: Amazonas immer etwa
  6–18 Uhr hell; Deutschland im Sommer bis ca. 21:30, im Winter ab ca. 16:30 dunkel.
- **Himmel**: Farbe von `scene.background` und Nebel aus einer Farbskala nach Sonnenhöhe (Nacht dunkelblau, nie
  schwarz; Dämmerung rosa/orange; Tag wie heute). `HemisphereLight` und `sun` (DirectionalLight): Stärke und Farbe
  nach Sonnenhöhe, nachts gedimmt, aber mit Mindesthelligkeit, damit man alles sieht. Sonnenrichtung folgt dem
  Sonnenstand.
- **Nacht**: Sterne (ein `THREE.Points`, nur nachts sichtbar), Mond (heller Kreis), in Hafenhausen leuchtende
  Laternen und Fenster (selbstleuchtende Farben, keine echten Lichtquellen – iPad-Leistung). Am Amazonas
  Glühwürmchen (wenige, sanft).
- Kein Wackeln, keine Blitze, keine gruseligen Geräusche.

## Teil 2 – Jahreszeiten
- Nach `season()`: Frühling Blüten an Bäumen (rosa/weiße Tupfer), Sommer wie heute, Herbst Laub gelb/orange/rot,
  Winter weißer Boden-Ton und Schnee auf Dächern/Wiesen (Farbwechsel der Materialien, keine neue Geometrie, damit
  `bakeCells` und Leistung gleich bleiben). Seen frieren **nicht** zu (Angeln bleibt möglich).
- Amazonas bleibt grün. Neue Infotafel am Amazonas „Regenzeit und Trockenzeit“ (Fakt prüfen, Skill
  `sachkunde-grundschule`). Neue `INFOBOARDS`-id, nie ändern.

## Teil 3 – Fische nach Uhrzeit
- Neues Feld in `FISH`: `zeit` = `'nacht'` (16–6 Uhr), `'tag'` (6–18 Uhr), `'daemmerung'` (5–9 und 16–21 Uhr) oder
  fehlt (immer). Nur Fische, bei denen das **biologisch stimmt** (Fakten mit Quellen prüfen), z. B. nachtaktiv: Aal,
  Wels, Quappe, Zander, Zitteraal, Antennenwels, Piraíba; tagaktiv: Hecht, Pfauenbarsch, Arowana.
- Außerhalb der Zeit beißt der Fisch nicht (wie Animal Crossing). Reusen beachten die Zeit beim Hineinschwimmen.
- Fischbuch zeigt die Zeit („🌙 abends und nachts“, „☀️ tagsüber“, „🌅 morgens und abends“), auch bei „?“-Fischen,
  als Hinweis.

## Teil 4 – Läden und Freilassen
- Rosa, Opa Tiago, alle Hannes-Stände, Fahrzeug-Laden, Bootshändler (später) und Museum: **8–22 Uhr**. Außerhalb:
  Schild „Geschlossen – öffnet um 8 Uhr 🌙“, Kontext-Knopf zeigt es, Laden öffnet nicht.
- Eimer bekommt „🐟 Fische freilassen“ (alle oder einzeln, keine Ludins, freundlicher Text). So kein Festhängen.

## Teil 5 – Menschen nach Uhrzeit und Verkehrsregeln
- Tagesplan der 24 Menschen in Hafenhausen: nachts (22–6) nur 4 unterwegs, morgens (6–9) viele, Kinder 13–19 Uhr
  (Werktage) bzw. 9–19 (Wochenende). Unsichtbare Menschen sind keine Hindernisse.
- **Ausweichen:** Menschen prüfen vor jedem Schritt geparkte Fahrzeuge, Straßenbahn, Abschleppwagen und das
  Fahrzeug des Spielers (`inPlayerWay`); versperrt → kurz warten, umdrehen. Geparkte Fahrzeuge werden für fahrende
  Fahrzeuge zu Hindernissen.
- **Strafzettel:** Unfall = beim Fahren mit mehr als 60 % Lenk-Ausschlag blockiert ein Mensch, eine Wand/ein Haus
  oder ein geparktes Fahrzeug den nächsten Schritt. Fahrzeug hält, kurzer „Bonk“-Ton, Mensch sagt „Hey, pass doch
  auf!“, Karte **🚨 Strafzettel**: Rad/Roller/Skateboard 5 Ludins, Cyber-Truck 20 Ludins. Höchstens alle 4 s eine
  Strafe, Ludins nie unter 0. Langsam anstoßen kostet nichts. Keine Verletzung, keine Animation von Umfallen.

## Teil 6 – Nachbarn, Gespräche, Freundschaft
- Jeder der 24 Menschen bekommt eine feste `id` (Index beim Bauen, Reihenfolge der Zufallszahlen unverändert),
  einen **Namen** und eine **Art** (freundlich, frech, ruhig, Opa/Oma, Kind) mit eigenen Begrüßungen.
- Nähe ≤ 3 m und zu Fuß → Kontext-Knopf „💬 Reden mit <Name>“. Der Mensch bleibt stehen und schaut dich an.
- Gesprächskarte im Stil i-have-adhd: 1–2 kurze Sätze, 2–3 große Antwort-Knöpfe, oben immer, worum es geht.
  Antworten: „Hast du einen Tipp?“ (Tipp-Liste: Fischzeiten, Hannes, Abschleppdienst, Museum, Straßenbahn …),
  „Kann ich dir helfen?“ (Aufgabe), „Tschüss!“.
- **Aufgaben:** „Bring mir eine Makrele“ u. Ä. (nur Fische, die man in Hafenhausen/am Heimat-See fangen kann).
  Höchstens 3 offen. Stadtplan zeigt „📝 Aufgaben“. Bringen: Knopf „Hier, bitte!“ nimmt den Fisch aus dem Eimer,
  Belohnung = 2 × Fischpreis + 10 Ludins, +3 Freundschaft.
- **Freundschaft:** +1 pro Tag fürs Reden, +3 pro Aufgabe; Stufen „Bekannt“, „Freund“, „Bester Freund“ (Herzen
  ❤️). Ab „Freund“ manchmal ein **Geschenk** (Köder, Ludins, ab „Bester Freund“ ein neuer Hut für die Werkstatt).

## Teil 7 – Museum
- Ein „Bald geöffnet“-Laden am Markt wird das **Museum** (Schild, Kontext-Knopf „🏛️ Ins Museum“).
- Fisch aus dem Eimer spenden (je Art einmal). Kurator sagt einen Fakt (aus `FISH.fact`).
- „Fisch-Ausstellung“: Karte mit Bereichen Amazonas / Heimat-See / Flüsse / Meer, für jeden gespendeten Fisch das
  **echte Foto** mit Tafel (Name, Größe, Datum, Fotonachweis). Nicht gespendete als „?“. Zähler „12 von 42“.
- Seltene Fische, die zurückgesetzt werden, können nicht gespendet werden (Hinweis: „Seltene Fische bleiben im Wasser.“).

## Teil 8 – Tägliche Sachen
- **Tagesfisch:** aus `todayKey()` berechnet (kein Speichern nötig), bringt heute bei Rosa/Hannes doppelte Ludins;
  Anzeige im Fischbuch und als Tipp der Nachbarn.
- **Tagesaufgaben:** jeden Tag neue Aufgaben-Angebote der Nachbarn (Startwert aus dem Datum).
- **Flaschenpost:** 1× pro Tag an einem Strand/Ufer (wechselnd: Amazonas-Dorf, Heimat-See, Hafenhausen). Inhalt:
  Rätsel (wie Quiz, kindgerecht), Tipp oder 10–30 Ludins.

## Spielstand (CLAUDE.md, Abschnitt Spielstand)
Neue Felder nur mit Startwert, `SAVE_VERSION` bleibt 2, nichts wird gelöscht:
- `state.museum = {}` (Fisch-id → `{cm, t}`)
- `state.nachbarn = {}` (Nachbar-id → `{f: Freundschaftspunkte, talk: 'JJJJ-MM-TT', gift: 'JJJJ-MM-TT'}`)
- `state.aufgaben = []` (`{n: Nachbar-id, fish: Fisch-id, day: 'JJJJ-MM-TT'}`, höchstens 3)
- `state.tag = {day: '', flasche: false}`
Prüfung beim Laden (wie SEC-001): Zahlen mit `num()`, ids nur aus festen Listen, Text als Text. Neue Felder bekommen
Tests in `tests/spielstand.test.mjs`. Nachbar-ids, Fisch-ids, Infotafel-ids nie ändern.

## Tests
- Zeit in Tests fest einstellen mit Playwright `page.clock` (z. B. 17:00 und 23:00, Juni und Dezember).
- Himmel: Farbe/Helligkeit tags ≠ nachts; Sterne nur nachts.
- Fische: um 23 Uhr kein `'tag'`-Fisch, um 12 Uhr kein `'nacht'`-Fisch; 17 Uhr alle möglich.
- Läden: 23 Uhr geschlossen, 9 Uhr offen; Freilassen leert den Eimer ohne Ludins.
- Strafzettel: Truck schnell gegen Haus → −20; langsam → 0; nie unter 0.
- Nachbarn: Reden, Aufgabe annehmen, Fisch bringen → Belohnung, Freundschaft, bleibt nach Neuladen.
- Museum: Spenden, Ausstellung zeigt Foto, bleibt nach Neuladen, doppelt spenden geht nicht.
- Flaschenpost: einmal pro Tag.
- Alter Spielstand ohne neue Felder bekommt Startwerte; kaputte Werte werden ersetzt.

## Neu-Seite
Jeder Teil bekommt einen eigenen `NEWS`-Eintrag (v32 ff.), 1–2 kindgerechte Sätze.

## Reihenfolge
1 Weltzeit/Himmel → 2 Jahreszeiten → 3 Fische nach Zeit → 4 Läden/Freilassen → 5 Menschen nach Zeit/Verkehrsregeln
→ 6 Nachbarn → 7 Museum → 8 Tägliche Sachen. Danach Luxusyacht (`2026-10-23-luxusyacht-meer-design.md`).

## Nicht dabei (später vielleicht)
Wetter (Regen/Schnee fallend), Feiertage/Feste, Insekten, Häuser der Nachbarn betreten, Mehrspieler.
