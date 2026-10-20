# Amazonas Angler – Anleitung für Claude

Dieses Spiel entwickelt ein **Kind (ca. 7–9 Jahre)** zusammen mit seinem Papa.
Das Kind hat sich das Spiel ausgedacht. Seine Ideen haben Vorrang.

## So sprichst du mit uns
- Immer auf **Deutsch**, kurze Sätze, einfache Wörter.
- Erkläre nach jeder Änderung in 2–3 Sätzen, was jetzt neu ist und wie man es ausprobiert.
- Wenn ein Wunsch unklar ist: eine kurze Frage stellen, dann bauen.
- Keine Fachwörter ohne Erklärung.

## Die Spielidee (vom Kind)
- Wie Minecraft, aber **ohne Blöcke**: offene 3D-Welt
- Spielt am **Amazonas** (Fluss, Urwald, Riesenseerosen, Aras)
- Der Fluss ist über **2 km** lang, mit einer **Insel** und **Stromschnellen** (die schieben das Boot)
- Man kann **angeln**, es gibt **viele Fische** (echte Amazonas-Fische)
- **Heimat-See**: ein See wie in Deutschland, mit dem **Flugzeug** neben dem Dorf erreichbar.
  Dort beißen nur die 10 deutschen Fische (`home:'see'` in `FISH`). Verkauft werden sie bei Rosa.
- **Ab 7 Jahren**: nichts Gruseliges, keine Gewalt, kein Blut
- Eigener **Avatar** (Name, Haut, Haare, T-Shirt, Hose, Hut)
- Fische **verkaufen** bei Händlerin Rosa
- **Angelladen** von Opa Tiago neben Rosa: Angeln, Köder, Boot-Sachen, Kleidung
- **Reusen** (Fischfallen) bei Opa Tiago, 100 Ludins, höchstens 3. Man legt sie ins Wasser. Alle 2 Minuten
  schwimmt ein Fisch hinein (höchstens 3, echte Uhrzeit, läuft auch weiter, wenn das Spiel zu ist). Boje wird grün.
- **Karte**: kleine Karte oben rechts (60 m um dich herum), Antippen oder Taste M öffnet die große Karte
  (ganzer Fluss + Heimat-See). Auf der Karte zeigt **rechts nach Norden** (flussaufwärts).
- **Spielzeit** (für Eltern): In der Avatar-Werkstatt „⏰ Spielzeit“. Ändern geht nur nach einer Rechenaufgabe für Erwachsene.
  Aus/15/30/45/60/90 Minuten pro Tag, gilt fürs ganze Gerät (`amazonas-angler-1-spielzeit`), gezählt wird pro Spieler (`state.playTime`).
  Oben steht, wie viele Minuten übrig sind. Ist die Zeit um, macht das Spiel Pause; Erwachsene können +15/+30 Minuten geben.
- Das Geld heißt **Ludins**
- Mit genug Ludins kann man ein **Boot** kaufen (300 Ludins); Riesenfische nur vom Boot
- **Yacht** bei Opa Tiago (Tab Boot, 1500 Ludins, braucht das Boot): ersetzt das Kanu, ist am schnellsten,
  trägt den Avatar-Namen am Rumpf, Fischtank an Bord = 20 Plätze mehr im Eimer. Werte in `YACHT`.
- **Echte Fotos** von allen 25 Fischen (15 Amazonas, 10 See), Wikimedia Commons, Nachweis in `fotos/BILDNACHWEIS.md`.
  Fang, Fischbuch, Eimer, Rosa und Reuse zeigen immer das Foto. Noch nicht gefangene Fische zeigt das Fischbuch als „?“.

## Technik
- Alles steckt in `index.html` (Three.js r128 von cdnjs, kein Build-Schritt).
- Ziel-Gerät: **iPad** (Touch). Links wischen = laufen, rechts wischen = umschauen.
  Große Knöpfe (mindestens 60 px), alles muss mit dem Finger gehen.
- Spielstand: siehe Abschnitt **Spielstand** unten. Das ist die wichtigste Regel im ganzen Projekt.
- Die Welt wird in Stücken (`CHUNK`, 160 m) gebaut, nur in der Nähe des Spielers. Höhe überall: `heightAt(x,z)`.
- Fischdaten stehen in der Liste `FISH` (Name, Fakt, Seltenheit `w`, Preis, Größe, `home`, Artikel `art`).
  Fische werden **nur als echte Fotos** gezeigt (`fishImg`), es gibt keine gemalten Fische mehr. Neuer Fisch = auch ein Foto in `FOTOS`.
- Der Heimat-See liegt in der Welt weit im Süden (`LAKE`, z um −900). `heightAt` springt dort auf `lakeHeight`.
- Testen: `index.html` im Browser öffnen. Für das iPad: lokalen Server starten
  (`python3 -m http.server 8000`) und auf dem iPad `http://<IP-des-Computers>:8000` öffnen.

## Skills (in `.claude/skills/`, Quellen in `QUELLEN.md`)
Die Skills sind Wissen aus dem Internet. **Diese Datei hier gilt immer zuerst.**
- Three.js bleibt **r128** als globales `THREE`. Kein `import`, kein npm, kein Vite, kein TypeScript, nicht auf eine neuere Version umbauen.
- Die Three.js-Skills sind für neuere Versionen geschrieben. In r128 heißt es anders:
  `renderer.outputEncoding = THREE.sRGBEncoding` (nicht `outputColorSpace`),
  `texture.encoding = THREE.sRGBEncoding` (nicht `colorSpace`),
  kein `CapsuleGeometry`, kein `THREE.Timer`, keine `three/addons`.
  Lichtstärken aus den Skills sind für r128 viel zu hell.
- Knöpfe mindestens 60 px (auch wenn ein Skill weniger sagt).
- „Game Feel“ (wie gut sich etwas anfühlt) sanft halten: kein starkes Bildschirm-Wackeln, kein Kampf, keine Schadenszahlen.
- Keine bezahlten Dienste und keine KI-erzeugten Bilder oder Töne.

## Spielstand – darf nie verloren gehen
Der Spielstand liegt auf dem iPad im `localStorage` des Browsers. Ein Update auf GitHub Pages
löscht ihn nicht, solange die Adresse gleich bleibt und der Code ihn richtig liest.
- Schlüssel `amazonas-angler-1` **nie ändern**. Auch nicht `-backup`, `-vor-v…`, `-kaputt`, `-vor-code`.
- **Mehrere Spieler** pro Gerät: `KEY` ist immer der Stand dessen, der gerade spielt (`state.playerId`).
  Die anderen liegen in `amazonas-angler-1-spieler-<id>`, die Liste in `amazonas-angler-1-spieler`. Diese Schlüssel nie ändern.
  Spieler werden nie gelöscht (nur ganz leere, die nie gespielt haben). Eine geladene Sicherheitskopie kommt als neuer Spieler dazu.
- **Sichern ohne Code**: Das Spiel speichert von selbst. „Spielstand sichern“ speichert eine **Sicherheitskopie als Datei**
  (`Amazonas-Angler-<Name>-<Datum>.json`, landet in „Dateien“ → „Downloads“) und lädt sie wieder. Alte Spielstand-Codes kann man
  noch laden („Ich habe noch einen alten Code“), neue Codes gibt es nicht mehr.
- Neues Feld: nur in `state` mit Startwert eintragen. Fehlende Felder in alten Ständen bekommen so den Startwert.
- Feld umbenennen oder umbauen: `SAVE_VERSION` um 1 erhöhen und in `migrate()` einen neuen Schritt
  `if(from<N){…}` anhängen. Alte Schritte nie ändern oder löschen.
- Nie Felder aus `state` löschen und nie den ganzen Spielstand zurücksetzen.
  Für einen Neustart gibt es keinen Knopf – das ist Absicht.
- Fisch aus `FISH` entfernt? Dann kauft Rosa ihn beim Laden ab (schon eingebaut). Fisch-`id`s nie umbenennen.
- Repo-Name und Adresse (`mangimic.github.io/amazonas-angler`) nicht ändern. Neue Adresse = leerer Spielstand
  (dann hilft nur die **Sicherheitskopie** aus „Spielstand sichern“).
- **Vor jedem Commit, der `index.html` ändert, den Test laufen lassen:**
  `cd tests && npm install && npm test`. Alle Tests müssen grün sein.
  Bekommt der Spielstand neue Teile, auch einen Test dafür ergänzen (`tests/spielstand.test.mjs`).

## Regeln für Änderungen
- **Jede neue Funktion bekommt einen Eintrag in `NEWS`** (Seite „Was ist neu?“), ganz oben, mit `v` um 1 höher,
  Datum, Symbol und 1–2 kindgerechten Sätzen. So sieht man nach dem Update, was neu ist, und an der Versionsnummer, ob das iPad aktuell ist.
- Kleine Schritte: lieber eine Sache fertig machen als viele halb.
- Nach jeder Änderung prüfen, dass das Spiel noch startet (keine Fehler in der Konsole).
- Nach jeder fertigen Änderung einen Git-Commit mit einer deutschen Nachricht machen.
- Bilder und Töne nur verwenden, wenn man sie frei benutzen darf (z. B. Wikimedia Commons mit Lizenzangabe).
- Fakten über Tiere müssen stimmen.
- **Jugendschutz gilt für das ganze Spiel**: keine Links ins Internet, keine Werbung, kein Chat,
  keine Käufe mit echtem Geld, keine fremden Dienste, die Daten sehen (z. B. Google-Schriften). Fotos nur von lebenden Tieren, keine toten Fische, kein Blut, nichts Gruseliges.
