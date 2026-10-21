# Amazonas Angler – Anleitung für Claude

Dieses Spiel entwickelt ein **Kind (ca. 7–9 Jahre)** zusammen mit seinem Papa.
Das Kind hat sich das Spiel ausgedacht. Seine Ideen haben Vorrang.

## So sprichst du mit uns
- Immer auf **Deutsch**, kurze Sätze, einfache Wörter.
- Erkläre nach jeder Änderung in 2–3 Sätzen, was jetzt neu ist und wie man es ausprobiert.
- Wenn ein Wunsch unklar ist: eine kurze Frage stellen, dann bauen.
- Keine Fachwörter ohne Erklärung.
- Antworten im Stil von Skill `i-have-adhd`: nächster Schritt zuerst, Schritte nummeriert, Stand jedes Mal nennen, am Ende ein konkreter nächster Schritt.
  Ausschalten, wenn wir „normaler Modus“ sagen. Die Regeln oben (Deutsch, einfache Wörter) gelten weiter.

## Die Spielidee (vom Kind)
- Wie Minecraft, aber **ohne Blöcke**: offene 3D-Welt
- Spielt am **Amazonas** (Fluss, Urwald, Riesenseerosen, Aras)
- Der Fluss ist über **2 km** lang, mit einer **Insel** und **Stromschnellen** (die schieben das Boot)
- Man kann **angeln**, es gibt **viele Fische** (echte Amazonas-Fische)
- **Heimat-See**: ein See wie in Deutschland, mit dem **Flugzeug** neben dem Dorf erreichbar.
  Dort beißen nur die 10 deutschen Fische (`home:'see'` in `FISH`). Verkauft werden sie bei Rosa oder am Stand von Fischer Hannes am See.
- **Ab 7 Jahren**: nichts Gruseliges, keine Gewalt, kein Blut
- Eigener **Avatar** (Name, Haut, Haare, T-Shirt, Hose, Hut)
- Fische **verkaufen** bei Händlerin Rosa
- **Angelladen** von Opa Tiago neben Rosa: Angeln, Köder, Boot-Sachen, Kleidung
- **Reusen** (Fischfallen) bei Opa Tiago, 100 Ludins, höchstens 3. Man legt sie ins Wasser. Alle 2 Minuten
  schwimmt ein Fisch hinein (höchstens 3, echte Uhrzeit, läuft auch weiter, wenn das Spiel zu ist). Boje wird grün.
- **Karte**: kleine Karte oben rechts (60 m um dich herum), Antippen oder Taste M öffnet die große Karte
  (ganzer Fluss + Heimat-See). Auf der Karte zeigt **rechts nach Norden** (flussaufwärts).
- **Spielzeit** (für Eltern): In der Avatar-Werkstatt „⏰ Spielzeit“. Ändern geht nur nach einer Rechenaufgabe für Erwachsene.
  Aus/15/30/45/60/90 Minuten pro Tag (**Standard: 15 Minuten**, `TIME_DEFAULT`), gilt fürs ganze Gerät (`amazonas-angler-1-spielzeit`), gezählt wird pro Spieler (`state.playTime`).
  Oben steht, wie viele Minuten übrig sind. Ist die Zeit um, macht das Spiel Pause; Erwachsene können +15/+30 Minuten geben.
- **Bestenliste** (🏆 oben und in der Avatar-Werkstatt): Ludins, Fischarten, größter Fisch; antippen zeigt, wer was gefangen hat.
  Ohne Internet: Spieler dieses iPads + **Rekord-Karten** von Freunden. Die Karte ist eine bunte **Sammelkarte als Bild** (`Rekordkarte-<Name>.png`,
  Avatar, Ludins, Fischarten, größte Fische mit Foto). Die Daten stecken unsichtbar im PNG (tEXt-Feld `amazonas-angler-karte`);
  als Datei verschicken, nicht als Foto (sonst werden sie entfernt). Alte `.json`-Karten lassen sich weiter laden.
  Erwachsene schicken sie selbst weiter. Freunde-Karten liegen in `amazonas-angler-1-freunde` (dürfen entfernt werden). Kein Server!
- **Angel-Wissen** (Themen der Fischerprüfung, kindgerecht): Bei Opa Tiago „🎓 Angel-Quiz“ (Liste `QUIZ`, je 5 Fragen,
  +10 Ludins für jede neue richtige Frage, ab 20 richtigen den **Junior-Angelschein** + 100 Ludins; `state.quiz`, `state.angelschein`).
  Beim Fangen kommen manchmal Tipps (`TIPS`). Quiz-`id`s nie ändern (stehen im Spielstand). Keine Fragen zum Töten von Fischen.
- **Schonzeit und Mindestmaß** am Heimat-See (`RULES`, echte Uhrzeit), wie in **Baden-Württemberg** (LFischVO, allgemeine Werte,
  Stand 2026, geprüft über Angel-Seiten und den Landesfischereiverband): Hecht 50 cm, 15.2.–15.5.; Zander 45 cm, 1.4.–15.5.;
  Bachforelle 25 cm, 1.10.–28.2.; Schleie 25 cm, 15.5.–30.6.; Karpfen 35 cm. Solche Fische dürfen nicht in den Eimer;
  Zurücksetzen bringt +5 Ludins (auch bei der Reuse). Das Angel-Wissen ist auf Baden-Württemberg ausgerichtet.
- **Angelarten** (`METHODS`, Knopf unten rechts zum Wechseln): 🎣 Posenangeln (hat jeder), 🌀 **Spinnfischen** mit der Spinnrute
  (150 Ludins: Kunstköder wird von selbst eingeholt, manchmal beißt keiner; Raubfische beißen 3× öfter) und ⚓ **Grundangeln**
  mit der Grundrute (120 Ludins: Blei am Grund, Bissanzeiger piept, längere Wartezeit, Grundfische und große Fische öfter).
  `state.methods`, `state.method`. Die Angel-Stufe (Bambus/Profi/Gold) gilt für alle Angelarten.
- **Infotafeln** (`INFOBOARDS`, Texte in `INFO_TEXT`): 7 Tafeln am Fluss und am Heimat-See. Hingehen, „📋 Infotafel lesen“ tippen.
  Jede neue Tafel bringt +5 Ludins (`state.infoRead`). Die Tafel „Regeln am See“ zeigt die Tabelle aus `RULES`. Tafel-`id`s nie ändern.
- **Flüsse in Deutschland** (Sachkunde wie in der 4. Klasse, Skill `sachkunde-grundschule`): Mit dem Flugzeug (es öffnet die **Deutschland-Karte**,
  Norden oben, Bundesländer, Landeshauptstädte, Flüsse, Nachbarländer) fliegt man zu 18 Angelplätzen an echten Flüssen (`SPOTS`, Bundesländer in `BL`).
  Start in **Baden-Württemberg** (`START_SPOTS`: Neckar, Rhein, Donau). Pro Platz: Infotafel, 2 Rätselfragen, Wahrzeichen (`LOOKS`), typische Fische.
  **Fluss-Stempel** = 3 verschiedene Fischarten dort fangen + Fluss-Rätsel lösen (+25 Ludins). Ein Stempel öffnet die Nachbar-Plätze in `LINKS`:
  so folgt man dem Fluss ins nächste Bundesland. `state.fluss` (pro Platz `f`,`q`,`s`,`r`), `state.flussAt`. **`SPOTS`-ids nie ändern.**
  12 Flussfische (`home:'fluss'`). Aal, Lachs, Stör und Huchen sind „seltene Fische“ und werden immer zurückgesetzt (`RULES` mit `selten`).
  Der Flussplatz liegt in der Welt bei z um −1800 (`DE`) und wird beim Hinfliegen neu gebaut (`buildSpot`). Kartendaten: Natural Earth (gemeinfrei).
  An jedem Flussplatz und am Heimat-See (`hannesSee`) steht der Stand von **Fischer Hannes** (`buildHannes`, `showHannes`): Fische verkaufen (wie bei Rosa, `sellList`)
  und Angelsachen kaufen (Opa Tiagos Waren ohne Boote, `buyList`). Er grüßt wie im Bundesland (`GRUSS`, z. B. „Grüß Gott“, „Moin“).
- **Stadtwelt Hafenhausen** (keine Angelwelt, Angeln geht dort nicht): Mit dem Flugzeug erreichbar, liegt in der Welt bei z um −3000
  (`CITY`, gebaut von `buildCity`). Häuser, Markt mit Brunnen, Hafen, Park, 24 Menschen, die winken. Der **Flugplatz liegt im Osten** der Stadt.
  Fahrzeuge in `VEHICLES`: 🚲 Fahrrad (hat jeder, 11 m/s), 🛴 Roller und 🛹 Skateboard (je 60 Ludins, 8 m/s), ⚡ **Cyber-Truck** mit Hupe
  (800 Ludins, 20 m/s, **ohne Logo/Marke**). Kaufen im Fahrzeug-Laden (`SHOP_AT`). Geparkt wird, wo man absteigt.
  Gelbe **Straßenbahn** im Kreis (`TRAM_ROUTE`, 6 m/s) mit 4 Haltestellen (`STOPS`: Flugplatz, Markt, Hafen, Park); sie wartet, wenn jemand auf den Schienen steht.
  Spielstand in `state.city` (`visited`, `vehicles`, `parked`, `riding`). **Fahrzeug-ids nie ändern** (stehen im Spielstand: `state.city.vehicles/parked`).
  **Nicht auf den Schienen parken** (`parkFree`): Absteigen sagt dort „Stell dein Fahrzeug an den Rand“. Geht es nicht anders (Werkstatt, Fliegen, Neuladen), kommt das Fahrzeug an seinen Startplatz (`vehicleHome`).
  In der Bahn bleibt die Kamera hinter der Bahn. Unbekannte Einträge in `parked` bleiben gespeichert, `vehicleAt` beachtet sie nicht.
  Stadtplan: Norden oben, Osten rechts (die kleine Karte zeigt wie überall Norden rechts).
  Was sich bewegt oder ein-/ausgeblendet wird, erst nach `bakeCells` bauen. `heightAt` prüft `CITY` vor `DE`.
  Die Stadt wird für weniger Zeichen-Aufrufe zusammengefasst (`bakeCells`, `bakeKids`); in `buildCity` die Reihenfolge der Zufallszahlen nie ändern.
- Das Geld heißt **Ludins**
- Mit genug Ludins kann man ein **Boot** kaufen (300 Ludins); Riesenfische nur vom Boot
- **Yacht** bei Opa Tiago (Tab Boot, 1500 Ludins, braucht das Boot): ersetzt das Kanu, ist am schnellsten,
  trägt den Avatar-Namen am Rumpf, Fischtank an Bord = 20 Plätze mehr im Eimer. Werte in `YACHT`.
- **Echte Fotos** von allen 37 Fischen (15 Amazonas, 10 See, 12 Fluss), Wikimedia Commons, Nachweis in `fotos/BILDNACHWEIS.md`.
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
