# Ideen-Kiste – Design

Wunsch von Papa (04.11.2026), mit ihm abgestimmt („ja, passt“).

## Ziel
Kinder schreiben im Spiel Ideen für das Spiel auf. Erwachsene lesen sie am iPad oder schicken sie als Text-Datei an Papa.
Es gibt **keinen Server**: Nichts verlässt das iPad, außer ein Erwachsener teilt die Datei selbst. Das ist so wie bei der Rekord-Karte.

Fertig ist es, wenn:
- ein Kind eine Idee mit Thema und Text abschicken kann;
- die Idee nach dem Neuladen noch da ist;
- ein Erwachsener sie nach der Rechenaufgabe sieht und als `.txt` teilen kann.

## Gesagt (von Papa)
- Weg: Ideen-Kiste auf dem iPad, Erwachsene teilen sie als Datei (kein Mail-Knopf, kein Server).
- Ort zum Schreiben: der Knopf im Spiel, in „📅 Heute für dich“ (Uhr antippen).
- Eingabe: Thema per großem Knopf, dazu ein kurzer Text.
- Datei: eine Text-Datei.
- Belohnung: Erfinder-Sticker im Fischbuch, keine Ludins.

## Idee aufschreiben (Kinder)
- In `showHeute` gibt es unter den Zeilen einen großen Knopf **„💡 Idee fürs Spiel“** (≥ 60 px). Er öffnet die Karte „💡 Deine Idee“.
- **Schritt 1, Thema:** fünf große Knöpfe aus `IDEE_THEMEN`:
  - `fisch` 🐟 Fisch
  - `ort` 🗺️ Ort
  - `fahrzeug` 🚗 Fahrzeug
  - `figur` 👤 Figur
  - `sonst` ✨ Sonstiges
- **Schritt 2, Text:** ein Textfeld (`<textarea>`, `maxlength` 200).
  - Darüber steht kurz: „Schreib deine Idee auf. Du kannst auch das Mikrofon der Tastatur benutzen.“
  - Unter dem Feld steht ein Zähler „noch X Zeichen“.
- **„Abschicken“** ist nur aktiv, wenn der Text nach dem Trimmen mindestens 3 Zeichen hat.
  - Danach sagt Opa Tiago: **„Danke für deine Idee! Ich gebe sie weiter.“**
  - Ist ein neuer Sticker dazugekommen, wird er gleich mit gezeigt.
- **Höchstens 50 Ideen pro Spieler** (`IDEEN_MAX`). Ist die Kiste voll, steht statt des Formulars: **„Die Ideen-Kiste ist voll. Frag einen Erwachsenen, sie zu leeren.“**
  - „Leeren“ heißt: als gelesen markieren, siehe unten.
  - Gezählt werden nur die ungelesenen Ideen.
- „Abbrechen“ führt zurück zu „Heute für dich“.

## Spielstand
- Neues Feld **`state.ideen = []`**. Jeder Eintrag sieht so aus: `{thema:'fisch'|…, text:string, day:'JJJJ-MM-TT', gelesen:boolean}`.
- Prüfung beim Laden, direkt nach den anderen Prüfungen, also nach dem SEC-001-Block:
  - Kein Array: `[]`.
  - Einträge, die kein Objekt sind oder deren `text` kein String ist, werden übersprungen (wie bei `aufgaben`, Ruling R4 der AC-Welt).
  - `thema`: Ist es nicht in `IDEE_THEMEN`, wird es `'sonst'`.
  - `text`: Er bleibt reiner Text. Er wird auf 200 Zeichen gekürzt, und Steuerzeichen außer Zeilenumbrüchen werden entfernt.
  - `day`: über `dayOk`.
  - `gelesen`: genau `true`, sonst `false`.
  - Unbekannte Zusatzfelder bleiben erhalten.
- `SAVE_VERSION` bleibt 2. Kein Schlüssel ändert sich, nichts wird gelöscht.
- Ideen-Text wird **immer mit `esc()`** angezeigt (Lehre aus SEC-001). In der Text-Datei steht er als reiner Text.

## Erfinder-Sticker (Belohnung)
- In der Kopfzeile des Fischbuchs stehen, je nach Zahl der Ideen insgesamt (gelesen und ungelesen):
  - ab 1: „💡 Erfinder“
  - ab 5: „💡💡 Ideen-Profi“
  - ab 10: „🏆 Ideen-König“
- Es gibt immer nur den höchsten erreichten Sticker, keine Ludins und kein `earn()`.

## Für Erwachsene
- In der Avatar-Werkstatt gibt es einen neuen Knopf **„💡 Ideen der Kinder“**, neben „⏰ Spielzeit“. Davor kommt dieselbe Rechenaufgabe (`adultGate`).
- **Ansicht:** die Ideen **aller Spieler auf diesem iPad**.
  - Woher: der aktuelle Stand aus `state` und die anderen aus `amazonas-angler-1-spieler-<id>`. Sie werden nur gelesen und so geprüft wie beim Laden.
  - Sortierung: nach Spieler, darin die neuesten zuerst.
  - Jede Zeile: Thema-Symbol, Datum, Text (`esc`).
  - Ungelesene stehen oben, „Schon gelesen“ darunter, zugeklappt.
- **„📤 Als Text-Datei teilen“** erstellt `Ideen-<Gerät oder Name>-<JJJJ-MM-TT>.txt`.
  - Kann das Gerät Dateien teilen (`navigator.canShare({files})`), öffnet sich das Teilen-Menü: AirDrop, Mail, Nachricht.
  - Sonst wird die Datei geladen, wie die Sicherheitskopie (`a.download`).
  - Inhalt: eine Kopfzeile „Ideen aus Amazonas Angler – <Datum>“. Danach je Spieler ein Abschnitt mit `- [Thema] Datum: Text`.
  - Die Datei ist reiner Text (UTF-8), kein HTML.
- **„Als gelesen markieren“** setzt bei allen angezeigten Ideen `gelesen:true` und speichert. Das gilt für den aktuellen Spieler und für die Plätze der anderen Spieler.
  - Es wird nichts gelöscht.
  - Danach zählt die volle Kiste wieder von vorn.

## Fehlerfälle
- Leerer Text oder nur Leerzeichen: Der Knopf „Abschicken“ ist grau.
- Die Kiste ist voll: der Hinweis aus dem Abschnitt „Idee aufschreiben“, kein Formular.
- Keine Ideen: In der Erwachsenen-Ansicht steht „Noch keine Ideen.“, und der Teilen-Knopf ist grau.
- Teilen wurde abgebrochen: keine Fehlermeldung, nichts ändert sich.
- Kaputter Stand eines anderen Spielers: Er wird übersprungen, das Spiel stürzt nicht ab.

## Tests (`tests/spielstand.test.mjs`)
- Idee mit Thema und Text abschicken, dann `state.ideen` prüfen. Nach dem Neuladen ist sie noch da.
- Alter Spielstand ohne `ideen` bekommt `[]`. Kaputte Werte werden repariert:
  - falsches Thema wird `'sonst'`;
  - zu langer Text wird gekürzt;
  - kein Objekt wird übersprungen.
- Präparierter Stand mit HTML im Ideen-Text: In der Erwachsenen-Ansicht und im Fischbuch gibt es kein eingeschleustes Element.
- Sticker bei 1, 5 und 10 Ideen.
- Die Erwachsenen-Ansicht öffnet sich nur nach der richtigen Rechenaufgabe und zeigt die Ideen von zwei Spielern.
- Text-Datei: Der Download-Name passt, und der Inhalt enthält die Texte.
- „Als gelesen markieren“: nichts gelöscht, `gelesen:true`, die volle Kiste ist danach wieder frei.

## Neu-Seite
**v43 „Ideen-Kiste“:** „Du hast eine Idee fürs Spiel? Tipp auf die Uhr und dann auf 💡. Ein Erwachsener schickt sie weiter.“

## Nicht dabei (später vielleicht)
- Bilder malen
- Abstimmen über Ideen
- Server oder automatisches Senden
- Ideen auf andere Geräte laden
