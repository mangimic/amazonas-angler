# Stadtwelt „Hafenhausen“ – Plan für Version 1

Stand: 21.10.2026 · Brainstorming mit Felix (Kind) und Papa · `CLAUDE.md` gilt immer zuerst.

## 1. Worum es geht

**Was Felix gesagt hat:**
- Das Spiel bekommt **verschiedene Welten**:
  - die Angelwelt (gibt es schon),
  - eine **Stadtwelt**,
  - später **Goldschürfen**.
- Es soll **mehr Menschen** geben.
- Zuerst kommt die **Stadtwelt**. Darin wichtig: herumfahren, einkaufen und verkaufen, Menschen helfen, eigenes Haus. **Herumfahren kommt zuerst.**
- Fahrzeuge: **eckiger Stahl-Truck**, Fahrrad, Bus oder Straßenbahn, Roller oder Skateboard.
- Die Stadt ist eine **eigene Fantasie-Stadt** und heißt **Hafenhausen**.
- Der Truck heißt **„Cyber-Truck“**.

**Was Papa entschieden hat:**
- Die Stadt wird ein **neues Gebiet** in der bestehenden Spielwelt (Weg A), so wie Heimat-See und Flussplatz. Man kommt mit dem Flugzeug hin.

**Annahmen (bitte prüfen):**
- „Cyber-Truck“ ist nur ein Name. Es gibt kein Firmenlogo und keinen Firmennamen, damit es keine Werbung ist.
- Bus und Straßenbahn sind fast dasselbe. Version 1 hat nur die **Straßenbahn**.

**Wann ist Version 1 gelungen?**
- Felix fliegt nach Hafenhausen.
- Er fährt mit Fahrrad, Roller, Skateboard, Cyber-Truck und Straßenbahn durch die Stadt.
- Er sieht viele Menschen.
- Nach dem Neuladen ist alles noch da.
- Alle Tests sind grün.

## 2. Was Version 1 hat und was nicht

**In Version 1:**
1. Die Stadt Hafenhausen mit Straßen, Marktplatz, Hafen, Park, Häusern und Flugplatz.
2. 20–30 Menschen, die spazieren gehen und winken.
3. Fahrrad (geschenkt), Roller und Skateboard (je 60 Ludins), Cyber-Truck (800 Ludins).
4. Straßenbahn auf einem Rundkurs mit 4 Haltestellen, kostenlos.

**Später, mit eigenem Plan:**
- Menschen mit Aufgaben, zum Beispiel: „Bring dem Koch 3 Forellen“.
- Läden zum Einkaufen und Verkaufen. In Version 1 tragen sie das Schild „Bald geöffnet“.
- Eigenes Haus in der Stadt.
- Bus.
- Ampeln und Verkehrsregeln, zum Beispiel passend zur Fahrradprüfung in Klasse 4.
- Welt Goldschürfen.
- Mehr Menschen in der Angelwelt.

## 3. Die Welt

- **Ort:** `CITY={x:0,z:-3000,...}`, weit hinter dem Flussplatz (`DE`, z ≈ −1800).
  - `heightAt` prüft `CITY` **vor** `DE`: `if(z<CITY.zone)return cityHeight(x,z);`. `CITY.zone` ≈ −2400.
  - `atCity()` ist neu. `atDE()` und `atLake()` gelten dort nicht mehr: `atDE` wird zu `z<DE.zone&&!atCity()`.
- **Größe:** etwa 300 × 300 m. Die Stadt ist eben, damit man gut fahren kann. Nur am Hafen fällt das Land zum Meer ab.
- **Gebaut wird beim ersten Besuch** (`buildCity()`, nur einmal). So startet das iPad schneller.
  - Häuser und Bäume werden als `InstancedMesh` gezeichnet, das heißt, viele gleiche Teile werden in einem Rutsch gemalt.
  - Für den Boden reicht eine große Fläche mit Straßen-Textur.
- **Stadtplan:**
  - Straßengitter mit 4 × 4 Blöcken, Gehwegen und Zebrastreifen.
  - Marktplatz in der Mitte mit Brunnen.
  - Hafen im Süden am Meer mit Fischerbooten und Leuchtturm.
  - Park mit Teich und Bäumen.
  - Flugplatz am Stadtrand.
  - Ein Fahrzeug-Laden.
  - Bunte Häuser, einige Läden mit dem Schild „Bald geöffnet“.
- **Wasser:** Die Wasserfläche (`water`) läuft schon mit dem Spieler mit. Am Hafen liegt das Land einfach unter y = 0, das Wasser ist dann von selbst da.
- **Nebel und Sicht:** wie am Flussplatz, also weiter als am Amazonas.
- **Grenzen:** `inBounds` bekommt das Stadtgebiet dazu. Hindernisse wie Häuser kommen in eine eigene Liste (`cityCols`), wie `deCols` am Fluss.
- **Kleine Karte:** zeigt Straßen, Haltestellen 🚋, den Fahrzeug-Laden und geparkte Fahrzeuge. Die große Karte zeigt in der Stadt einen Stadtplan mit Norden oben.

## 4. Anreise

- **Flugzeug-Menü:** Die Deutschland-Karte (`showGermany('fly')`) bekommt einen Knopf „🏙️ Hafenhausen“ neben „🌴 Amazonas“ und „🏞️ Heimat-See“.
- In der Stadt steht ein Flugzeug am Flugplatz (`PLANES` bekommt einen 4. Eintrag `id:'city'`).
- `flyTo('city')` landet am Flugplatz. Beim ersten Besuch erscheint der Hinweis: „Willkommen in Hafenhausen! Dein Fahrrad steht am Flugplatz.“

## 5. Menschen

- 20–30 Menschen werden mit `buildAvatar` gebaut, mit zufälligen Farben für Haut, Haare, Kleidung und Hut.
- Sie laufen langsam auf festen Wegen auf den Gehwegen hin und her und winken ab und zu.
- **Sie bewegen sich nur, wenn man in der Nähe ist** (Abstand unter 80 m), damit das iPad flüssig bleibt.
- Fahrzeuge halten an, wenn jemand im Weg ist. Es gibt **keine Unfälle, keinen Schaden und keine Geräusche von Zusammenstößen**.

## 6. Fahrzeuge

| id | Name | Preis | Tempo (m/s) | Wo |
|---|---|---|---|---|
| `bike` | 🚲 Fahrrad | geschenkt | 11 | steht am Flugplatz |
| `roller` | 🛴 Roller | 60 Ludins | 8 | Fahrzeug-Laden |
| `skate` | 🛹 Skateboard | 60 Ludins | 8 | Fahrzeug-Laden |
| `truck` | ⚡ Cyber-Truck | 800 Ludins | 20 | Fahrzeug-Laden |

Zum Vergleich: Laufen ist 5,5 m/s, die Yacht 24 m/s.

- **Daten:** in `VEHICLES` (Name, Symbol, Preis, Tempo, Wenderadius).
- **Einsteigen:** Steht man neben einem eigenen Fahrzeug, zeigt der Kontext-Knopf „🚲 Aufsteigen“ oder „⚡ Einsteigen“.
- **Aussteigen:** „Absteigen“ oder „Aussteigen“ funktioniert wie beim Boot mit `findExit()`.
- **Fahren:** Man steuert wie das Boot, die Richtung kommt aus dem linken Wischen. Fahren geht nur auf Straßen, Gehwegen und Plätzen, nicht durch Häuser.
- **Parken:** Wo man aussteigt, bleibt das Fahrzeug stehen. Die Stelle wird gespeichert.
- **Cyber-Truck:** silbern und eckig, aus Boxen gebaut, mit Lichtleiste vorne. Er hat einen Hup-Knopf, der ein freundliches „Tüt“ macht (`tone`, kein Tondatei-Download). Kein Logo.
- **Fahrzeug-Laden:** Ein Laden am Marktplatz mit `buyList`, wie bei Opa Tiago. Gekauft wird mit Ludins aus dem Spiel, **nie mit echtem Geld**.

## 7. Straßenbahn

- Sie fährt auf einem Rundkurs um die Innenstadt mit 4 Haltestellen: Flugplatz, Marktplatz, Hafen, Park.
- Sie fährt dauernd. An jeder Haltestelle hält sie 6 Sekunden.
- **Einsteigen:** Steht man an der Haltestelle und die Bahn ist da, zeigt der Knopf „🚋 Einsteigen“. Dann fährt man mit. Die Kamera bleibt hinter der Bahn.
- **Aussteigen:** An der nächsten Haltestelle erscheint der Knopf „Aussteigen“. Fährt man weiter, kommt er an der nächsten Haltestelle wieder.
- Kein Fahrschein, kostenlos.

## 8. Spielstand

Neues Feld mit Startwert (Regel aus `CLAUDE.md`: nur neue Felder mit Startwert, kein `SAVE_VERSION`-Schritt nötig):

```js
city:{visited:false,vehicles:{bike:true,roller:false,skate:false,truck:false},parked:{},riding:''}
```

- **Prüfen beim Laden:**
  - `city` muss ein Objekt sein. Bei `vehicles` nur `true`/`false` übernehmen.
  - `parked[id]` braucht gültige Zahlen `{x,z,yaw}`. Sonst steht das Fahrzeug an seinem Startplatz.
  - `riding` muss eine gültige id sein, sonst `''`.
- **Ort:** `state.where` liegt in der Stadt, wenn `z<CITY.zone`. Beim Laden wird die Stadt zuerst gebaut, dann wird der Ort geprüft. Das ist dasselbe Muster wie beim Flussplatz.
- **In der Straßenbahn speichern:** Wird beim Fahren gespeichert, steht man nach dem Neuladen an der letzten Haltestelle.

## 9. Was in der Stadt nicht geht

- **Angeln und Reusen:** Der Angel-Knopf zeigt den Hinweis „Angeln kannst du in der Angelwelt. Flieg zurück!“.
- Am Hafen steht ein Schild mit demselben Hinweis.
- **Eimer:** Die Fische im Eimer bleiben drin. Verkaufen geht in Version 1 noch nicht, die Läden haben „Bald geöffnet“.

## 10. Tests (`tests/spielstand.test.mjs`)

1. **Hinfliegen:**
   - Flugzeug-Menü öffnen und „Hafenhausen“ tippen.
   - Danach steht man in der Stadt (`where.z<-2400`).
   - Nach dem Neuladen ist man immer noch dort.
2. **Fahrrad:**
   - Am Flugplatz aufsteigen und ein Stück fahren (Taste W drücken).
   - Absteigen.
   - `city.parked.bike` ist gespeichert und nach dem Neuladen gleich.
3. **Cyber-Truck:**
   - Mit 1000 Ludins im Fahrzeug-Laden kaufen.
   - Danach `ludins` = 200 und `city.vehicles.truck` = true.
   - Nach dem Neuladen gehört er dir noch.
4. **Straßenbahn:**
   - An einer Haltestelle warten, bis „🚋 Einsteigen“ erscheint, und einsteigen.
   - An der nächsten Haltestelle aussteigen.
   - Man steht jetzt an der nächsten Haltestelle.
5. **Alter Spielstand ohne `city`:** wird geladen, und `city` bekommt die Startwerte.
6. **Alle alten Tests bleiben grün.**

Vor jedem Commit läuft `cd tests && npm test`.

## 11. Bauschritte

Jeder Schritt bekommt einen eigenen Commit, und vor jedem Commit laufen die Tests.

1. **Stadt:** `CITY`, `cityHeight`, `buildCity`, Flugzeug-Menü, Menschen, Karte, NEWS v27 „Hafenhausen“. Tests 1 und 5.
2. **Fahrrad, Roller, Skateboard:** Fahren, Parken, Fahrzeug-Laden. Test 2.
3. **Cyber-Truck:** Aussehen, Hupe, Kauf. Test 3.
4. **Straßenbahn:** Rundkurs, Haltestellen, Einsteigen und Aussteigen. Test 4.

Danach: Screenshots auf dem iPad-Format prüfen, `CLAUDE.md` ergänzen, PR.

## 12. Jugendschutz und Regeln

- Keine Werbung: kein Firmenlogo, keine echten Marken. „Cyber-Truck“ ist nur ein Name.
- Kein echtes Geld, kein Chat, keine fremden Dienste.
- Keine Unfälle, keine Gewalt, nichts Gruseliges.
- Knöpfe sind mindestens 60 px groß.
- Kurze Texte, die je nach Länge lange genug stehen bleiben (`toastMs`).
- Three.js bleibt r128. Alles steckt in `index.html`.
