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
- Man kann **angeln**, es gibt **viele Fische** (echte Amazonas-Fische)
- **Ab 7 Jahren**: nichts Gruseliges, keine Gewalt, kein Blut
- Eigener **Avatar** (Name, Haut, Haare, T-Shirt, Hose, Hut)
- Fische **verkaufen** bei Händlerin Rosa
- Das Geld heißt **Ludins**
- Mit genug Ludins kann man ein **Boot** kaufen (300 Ludins); Riesenfische nur vom Boot
- Wunsch: **echte Fotos** von den Fischen zeigen (noch offen)

## Technik
- Alles steckt in `index.html` (Three.js r128 von cdnjs, kein Build-Schritt).
- Ziel-Gerät: **iPad** (Touch). Links wischen = laufen, rechts wischen = umschauen.
  Große Knöpfe (mindestens 60 px), alles muss mit dem Finger gehen.
- Spielstand liegt im `localStorage` (Schlüssel `amazonas-angler-1`).
  Wenn sich das Format ändert: alte Spielstände weiter laden können.
- Fischdaten stehen in der Liste `FISH` (Name, Fakt, Seltenheit `w`, Preis, Größe, Farben, Form).
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

## Regeln für Änderungen
- Kleine Schritte: lieber eine Sache fertig machen als viele halb.
- Nach jeder Änderung prüfen, dass das Spiel noch startet (keine Fehler in der Konsole).
- Nach jeder fertigen Änderung einen Git-Commit mit einer deutschen Nachricht machen.
- Bilder und Töne nur verwenden, wenn man sie frei benutzen darf (z. B. Wikimedia Commons mit Lizenzangabe).
- Fakten über Tiere müssen stimmen.
