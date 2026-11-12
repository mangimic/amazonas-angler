# Riesen-Karpfen Angelina – Design

Wunsch von Kind und Papa (10.11.2026), mit ihnen abgestimmt („passt“).
Anlass: Zeitungsbericht über den schwersten bekannten Karpfen (pirsch.de, 08.11.2026).

## Ziel
Im Heimat-See lebt **Angelina**, ein Riesen-Karpfen. Man kann sie ganz selten mit der Grundrute fangen.
Man bekommt ein Erinnerungs-Foto und Ludins, dann schwimmt sie zurück ins Wasser. Sie ist ein besonderer Fang, **keine neue Fischart**.

Fertig ist es, wenn:
- Angelina am Heimat-See mit der Grundrute beißen kann, sonst nirgends;
- der Fang eine eigene Karte mit Erinnerungs-Foto zeigt und sie danach frei ist;
- die Zahl der Fänge nach dem Neuladen noch stimmt;
- im Fischbuch der Angelina-Sticker steht.

## Gesagt (von Kind und Papa)
- Name: Angelina, wie der echte Fisch.
- Wann: nur mit der Grundrute.
- Nach dem Fang: Foto, dann zurück ins Wasser.
- Belohnung: beim 1. Mal 100 Ludins, danach 20 Ludins.
- Weg A: besonderer Fang, keine 46. Fischart.

## Fakten (geprüft)
Quelle: pirsch.de, „Neuer Karpfen-Weltrekord: Angler fängt unfassbaren 52-Kilo-Giganten“, 08.11.2026; dazu Euronews (04.11.2026).
- Angelina ist ein **Schuppenkarpfen** in einem Angelsee in Ungarn (Euro-Aqua-See).
- Ende Oktober 2026 wog sie **52 kg** (114,6 Pfund).
- Sie wurde schon mehrmals gefangen und wieder ins Wasser gesetzt.
- 52 kg sind etwa so viel wie zwei Kinder mit 7–9 Jahren (je etwa 25 kg).
- Eine Länge wird in den Quellen nicht genannt. Das Spiel nennt darum **keine** Länge in cm.
- Das Foto kommt von `FOTOS.karpfen` (Schuppenkarpfen, lebend, CC BY-SA 3.0, Nachweis schon in `fotos/BILDNACHWEIS.md`). Es gibt kein neues Bild.

## Biss
- Neue Werte in `ANGELINA = {chance:0.04, first:100, again:20}`.
- In `catchFish()`, bevor `chooseFish()` den Fisch wählt, wird geprüft:
  - Der Spieler ist am Heimat-See (`atLake()`).
  - Die Angelart ist die Grundrute (`fishing.method === 'grund'`).
  - Heute wurde Angelina noch nicht gefangen (`state.angelina.day !== todayKey()`).
  - Ein Zufall `Math.random() < ANGELINA.chance` trifft.
- Trifft alles zu, kommt statt des normalen Fisches die Angelina-Karte (`showAngelina()`).
- Der Biss selbst (Piepen, ZIEHEN-Zeit) bleibt wie bei jedem Grundangel-Biss. Ein verpasster Biss ist nie Angelina.
- Sie zählt nicht für den Fluss-Stempel, die Schule und die Reuse. Sie ist nie Tagesfisch und nie Aufgaben-Fisch.

## Fang-Karte `showAngelina()`
- Kopf: „🏆 Du hast **Angelina** gefangen!“
- **Erinnerungs-Foto**: ein goldener Rahmen (`.angelinaFoto`). Links das Gesicht des Avatars als Kreis (Hautfarbe `state.avatar.skin`, Rand in der T-Shirt-Farbe `state.avatar.shirt`, wie in der Bestenliste). Rechts das Karpfen-Foto (`fishPic(FISH_BY.karpfen)`).
  Darunter der Avatar-Name (`esc`) und das heutige Datum („11.11.2026“).
- Eine Zeile mit zwei Werten: „52 kg“ und „Schuppenkarpfen“.
- Fakten-Text: „Die echte Angelina lebt in einem Angelsee in Ungarn. Im Oktober 2026 wog sie 52 Kilo – so viel wie zwei Kinder in deinem Alter. Sie wurde schon oft gefangen und wieder ins Wasser gesetzt.“
- Ab dem 2. Fang zusätzlich: „Du hast sie schon N-mal gefangen!“ (N = neue Zahl).
- Nur **ein** Knopf: „Zurück ins Wasser (+100 Ludins)“ beim ersten Fang, sonst „(+20 Ludins)“.
  - Die Karte hat die Klasse `card catch angelina`. Wie jede Fang-Karte (`catch`) schließt Tippen daneben sie nicht.
- Der Spielstand wird **schon beim Öffnen** der Karte gespeichert: `n` +1, `day` = heute, `first` = heute, wenn noch leer. Die Ludins kommen auch schon da dazu (`earn`). So ist nach einem Neuladen mitten in der Karte nichts verloren und nichts doppelt.
- Antippen des Knopfs: Karte zu, Platscher im Wasser, Toast „Tschüss, Angelina! Bis bald.“, `afterCatch()`.
- Angelina kommt **nie** in den Eimer. `state.book` ändert sich nicht. `heute.fische` zählt sie nicht, `heute.ludins` zählt die Ludins über `earn`.
- Auswerfen geht wie bisher nur mit Platz im Eimer. Angelina selbst braucht keinen Platz.

## Spielstand
- Neues Feld **`state.angelina = {n:0, first:'', day:''}`**.
  - `n`: wie oft gefangen.
  - `first`: Tag des ersten Fangs (wie `todayKey`).
  - `day`: Tag des letzten Fangs.
- Prüfung beim Laden direkt nach `state.ideen=cleanIdeen(…)`:
  - Kein Objekt: Startwert.
  - `n` über `num(…)`.
  - `first` und `day` über `dayOk`.
  - Unbekannte Zusatzfelder bleiben erhalten.
- `SAVE_VERSION` bleibt 2. Kein Schlüssel ändert sich, nichts wird gelöscht.

## Fischbuch
- In der Kopfzeile (neben dem Ideen-Sticker) steht ab dem ersten Fang: „🏆 Angelina: N× gefangen“ (gleicher Stil wie `.ideenSticker`).
- Vorher steht dort nichts.

## Neu-Seite
**v44 „Riesen-Karpfen Angelina“**, Symbol 🏆:
„Im Heimat-See lebt Angelina, ein Riesen-Karpfen! Mit der Grundrute kannst du sie fangen – wenn du Glück hast.“

## Fehlerfälle
- Kaputter Wert in `state.angelina` (z. B. `n:'viel'`, `day:5`): wird repariert, das Spiel stürzt nicht ab.
- Neuladen, während die Angelina-Karte offen ist: Fang und Ludins sind schon gespeichert; heute beißt sie nicht noch einmal.
- Spielzeit läuft ab, während die Karte offen ist: wie bei jeder anderen Fang-Karte.

## Tests (`tests/spielstand.test.mjs`)
- Alter Spielstand ohne `angelina` bekommt den Startwert. Kaputte Werte werden repariert, unbekannte Felder bleiben.
- Am Heimat-See mit der Grundrute und Zufall = Treffer kommt die Angelina-Karte.
- Mit der Pose am Heimat-See oder mit der Grundrute an einem anderen Ort kommt sie nicht.
- Nach einem Fang beißt sie heute nicht noch einmal. Am nächsten Tag geht es wieder.
- Erster Fang: +100 Ludins, zweiter: +20. `n`, `first`, `day` stimmen, auch nach dem Neuladen.
- Der Eimer und `state.book` bleiben unverändert.
- Der Avatar-Name mit HTML wird im Erinnerungs-Foto nicht als Element eingefügt.
- Das Fischbuch zeigt den Sticker „Angelina: 2× gefangen“, vorher keinen.

## CLAUDE.md
Im Abschnitt „Heimat-See“ eine Zeile ergänzen: Angelina, `ANGELINA`, `state.angelina`, nur Grundrute, einmal am Tag, keine Fischart, keine cm.

## Nicht dabei (später vielleicht)
- Erinnerungs-Foto als Bild-Datei speichern
- Boilies als neuer Köder
- weitere berühmte Fische
