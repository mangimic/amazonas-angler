# Europa freischalten – Design

Wunsch vom Kind (20.11.2026). Die Fischtreppe an der Elz ist ein eigener Wunsch und kommt später (steht in `IDEEN.md`).

## Ziel und Warum
Bisher fliegt man nur zu Flüssen in Deutschland. Das Kind möchte sich **Länder in Europa freischalten**, indem es den Flüssen über die Grenze folgt.
Wie bei der Deutschland-Karte soll man dabei lernen, wo die Länder liegen, wie ihre Hauptstädte heißen und wie die Flüsse sie verbinden (Sachkunde 3./4. Klasse).

Fertig ist es, wenn:
- 5 neue Angelplätze in 5 Ländern im Spiel sind, jeder mit Wahrzeichen, Infotafel, 2 Rätselfragen, Fischen und Fischer Hannes;
- man sie über Fluss-Stempel freischaltet, wie die Plätze in Deutschland;
- es eine **Europa-Karte** gibt, die zeigt, wo die Länder und Plätze liegen;
- der Spielstand alter Spieler unverändert weiterläuft.

## Gesagt (vom Kind)
- Freischalten: **den Flüssen folgen** (Fluss-Stempel öffnet den Nachbar-Platz).
- Länder: **alle vier** Vorschläge – Österreich + Ungarn (Donau), Schweiz (Rhein), Niederlande (Rhein), Tschechien (Elbe).
- Karte: **Weg 1**, eine eigene Europa-Karte; die Deutschland-Karte bleibt, wie sie ist.

## Nicht-Ziele
- Keine neuen Fischarten (jede neue Art bräuchte ein echtes Foto). Die Plätze nutzen Fische, die es im Spiel schon gibt.
- Keine Städte zum Herumlaufen wie Hafenhausen. Jeder Platz ist ein Flussplatz wie in Deutschland.
- Keine weiteren Länder (Frankreich, Polen, Dänemark …). Später vielleicht.
- Kein Umbau der Deutschland-Karte.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es läuft)
- Ein Spielstand geht verloren, oder alte Fluss-Stempel zählen nicht mehr.
- Falsche Fakten (Land, Hauptstadt, Fluss, Fische, Wahrzeichen).
- Die Deutschland-Karte wird schwerer lesbar.
- Daten fremder Dienste zur Laufzeit (keine Links, kein Laden aus dem Internet).

## Ansätze (besprochen, Weg 1 gewählt)
1. **Eigene Europa-Karte** (gewählt): Knopf „🌍 Europa“ auf der Deutschland-Karte öffnet eine zweite Karte. Deutschland-Karte bleibt groß. Braucht neue Kartendaten (Natural Earth).
2. Deutschland-Karte vergrößern bis Niederlande/Ungarn: weniger Arbeit, aber Deutschland und die 16 Bundesländer werden zu klein.
3. Keine Karte, nur eine Liste beim Flugzeug: am schnellsten, aber man sieht nicht, wo die Länder liegen.

## Die 5 neuen Plätze
Neue Einträge in `SPOTS` (gleicher Aufbau wie die deutschen: `hw`, `hills`, `bend`, `k`, `look`, `fish`, `p`, `q`).
Statt `bl` (Bundesland) haben sie `land` (Schlüssel in der neuen Tabelle `LAENDER`). **Die neuen `id`s sind ab dann fest** (stehen im Spielstand `state.fluss`).

| id | Land (Hauptstadt) | Platz (Vorschlag) | Wahrzeichen `look` | Hannes grüßt |
|---|---|---|---|---|
| `ch-rhein` | Schweiz (Bern) | Rhein am Rheinfall bei Schaffhausen | `rheinfall`: Wasserfall mit Felsen und Gischt | „Grüezi“ |
| `nl-rhein` | Niederlande (Amsterdam) | Rhein-Mündung bei Kinderdijk (dort heißt ein Rheinarm Lek) | `kinderdijk`: Windmühlen am Deich | „Goedendag“ |
| `at-donau` | Österreich (Wien) | Donau in Wien | `wien`: Riesenrad (dreht sich langsam) | „Servus“ |
| `hu-donau` | Ungarn (Budapest) | Donau in Budapest | `budapest`: Parlament am Ufer | „Jó napot“ |
| `cz-moldau` | Tschechien (Prag) | Moldau in Prag | `prag`: Karlsbrücke mit Brückentürmen | „Dobrý den“ |

Hinweis Tschechien: Prag liegt an der **Moldau**, nicht an der Elbe. Die Moldau fließt bei Mělník in die Elbe. Der Platz heißt darum „Moldau in Prag“, die Verbindung läuft über die Elbe (wie bei Saar und Mosel).

Infotafel und Rätsel je Platz: 2–3 kurze Absätze und 2 Fragen, deren Antworten auf der Tafel stehen.
Immer dabei: das Land, seine Hauptstadt, woher der Fluss kommt oder wohin er fließt, ein Satz zum Wahrzeichen.
Ideen (vom Bauer zu prüfen): Rheinfall gehört zu den größten Wasserfällen Europas; Kinderdijk hat viele alte Windmühlen gegen das Hochwasser; Wien mit Riesenrad im Prater; Budapest besteht aus Buda und Pest an beiden Ufern der Donau; Karlsbrücke in Prag ist eine alte Steinbrücke.

Fische je Platz: 6–9 Fischarten aus `FISH` (meist `home:'fluss'`, Karpfen und Hecht dürfen auch), die dort wirklich leben.
Ideen (vom Bauer zu prüfen): Rheinfall Äsche, Forelle, Barbe, Döbel; Niederlande Brachse, Zander, Aal, Rotauge, Barsch; Wien Barbe, Nase, Zander, Wels, Rapfen; Budapest Wels, Zander, Karpfen, Brachse, Rapfen; Prag Karpfen, Wels, Zander, Hecht, Döbel.

**Alle Fakten** (Texte, Rätsel, Fische) brauchen eine Quelle in `docs/fakten-quellen.md`, wie bisher (Skill `sachkunde-grundschule` für Stil und Prüfung).

## Freischalten
Neue Einträge in `LINKS` (gelten in beide Richtungen, wie alle Links):
- `bw-rhein` ↔ `ch-rhein`, Fluss „Rhein“: „Der Rhein kommt aus der Schweiz. Flussaufwärts liegt der Rheinfall.“
- `nw-rhein` ↔ `nl-rhein`, „Rhein“: „Der Rhein fließt in die Niederlande und dort in die Nordsee.“
- `by-donau` ↔ `at-donau`, „Donau“: „Hinter Passau fließt die Donau nach Österreich.“
- `at-donau` ↔ `hu-donau`, „Donau“: „Die Donau fließt von Wien weiter nach Ungarn.“
- `sn-elbe` ↔ `cz-moldau`, „Elbe“: „Die Elbe kommt aus Tschechien. Dort fließt die Moldau in die Elbe.“

`spotOpen`, `stamped`, `tryStamp` bleiben, wie sie sind. Wer heute schon den Stempel in Breisach, NRW, Passau oder Sachsen hat, findet das Nachbarland sofort offen. Das ist gewollt.
Fluss-Stempel funktioniert dort genauso (3 Fischarten + Rätsel, +25 Ludins).

## Europa-Karte
- Auf der Deutschland-Karte (`showGermany`, beide Modi „ansehen“ und „fliegen“) gibt es einen Knopf **„🌍 Europa“**. Er öffnet `showEuropa(mode)` im gleichen Modus.
- Die Europa-Karte zeigt (Norden oben, wie die Deutschland-Karte):
  - Meer, Deutschland als eine Fläche, die 5 Länder (farbig, wenn dort ein Platz offen ist, sonst grau), weitere Nachbarländer blass mit Namen;
  - die Hauptstädte der 5 Länder und Berlin;
  - die Flüsse Rhein, Donau, Elbe und Moldau;
  - die 5 neuen Plätze mit 🎣 offen · 🏅 Stempel · 🔒 zu, und gestrichelte Linien zu den deutschen Plätzen, von denen aus man sie freischaltet.
- Oben: „Freigespielt: X von 5 Ländern · Fluss-Stempel: Y von 5“.
- Antippen eines Platzes öffnet dieselbe Vorschau wie bisher (`showSpotPreview`, mit „Land“ statt „Bundesland“); im Fliegen-Modus mit „✈️ Hinfliegen“.
  Antippen von Deutschland führt zurück zur Deutschland-Karte. Antippen eines Landes: Toast „Schweiz · Hauptstadt: Bern“ (+ „noch nicht freigespielt“).
- Unten: „Kartendaten: Natural Earth (gemeinfrei).“ Knöpfe: „🇩🇪 Deutschland-Karte“ und „Fertig“/„Hierbleiben“.
- Im Fliegen-Modus steht unter den deutschen Flüssen in der Liste neben der Deutschland-Karte ein Abschnitt **„Europa“** mit den offenen Auslands-Plätzen.
- Kartendaten: Natural Earth (gemeinfrei, 1:50m oder 1:110m), wie `DEMAP` vorbereitet und als neue Konstante `EUMAP` in `index.html` eingebaut. Nichts wird zur Laufzeit geladen.

Skizze:
```
🌍 Europa-Karte        Freigespielt: 2 von 5 Ländern · Stempel: 1 von 5
┌───────────────────────────────┐
│  Nordsee   NL🎣                │
│        ·  DEUTSCHLAND  ·  CZ🔒 │
│            ·            Prag   │
│   CH🏅 Bern   AT🎣 Wien ── HU🔒│
└───────────────────────────────┘
[🇩🇪 Deutschland-Karte]   [Fertig]
```

## Was sich sonst ändert
- `showSpotInfo`, `showSpotPreview`, Fliegen-Liste, Fluss-Stempel-Karte: bei `land` „📍 Land: Schweiz · Hauptstadt: Bern“ statt Bundesland.
- Deutschland-Karte: zählt weiter „X von 16 Bundesländern“; die Auslands-Plätze stehen nicht auf ihr. „Fluss-Stempel: Y von N“ zählt nur die deutschen Plätze (18), die Europa-Karte zählt die 5 eigenen.
- Hannes (`GRUSS`): Gruß nach `land`.
- `buildSpot` baut die Auslands-Plätze wie die deutschen (Welt bei z um −1800, `atDE()` ist dort wahr).
- `NEWS` v45, Symbol 🌍, Titel „Europa“: „Folge den Flüssen über die Grenze! Mit einem Fluss-Stempel am Rhein, an der Donau oder an der Elbe schaltest du Länder in Europa frei.“
- `CLAUDE.md`: Abschnitt „Flüsse in Deutschland“ um Europa ergänzen (`LAENDER`, `EUMAP`, `showEuropa`, neue ids nie ändern).
- `IDEEN.md`: „Fischtreppe an der Elz“ unter „Als Nächstes“.

## Spielstand
- Kein neues Feld. Die Plätze stehen in `state.fluss` unter ihrer neuen `id`, wie die deutschen. `state.flussAt` darf eine neue `id` sein.
- `SAVE_VERSION` bleibt 2. Kein Schlüssel ändert sich, nichts wird gelöscht.
- Ein alter Stand ohne die neuen Plätze läuft unverändert. Ein Stand mit `flussAt` auf einem Auslands-Platz lädt dort.

## Tests (`tests/spielstand.test.mjs`)
- Ein alter Stand ohne Stempel: keine Auslands-Plätze offen. Mit Stempel in `bw-rhein`: `ch-rhein` offen, die anderen nicht. Mit Stempel in `at-donau`: `hu-donau` und `by-donau` offen.
- Hinfliegen nach `ch-rhein`: Platz gebaut, Hannes grüßt „Grüezi“, Infotafel zeigt „Land: Schweiz“ und „Bern“.
- Stempel an einem Auslands-Platz wird gespeichert und bleibt nach dem Neuladen.
- Neuladen mit `flussAt:'cz-moldau'` landet in Prag.
- Europa-Karte öffnet sich von der Deutschland-Karte, zeigt „X von 5 Ländern“, Antippen eines offenen Platzes öffnet die Vorschau mit „Hinfliegen“.
- Jede neue Rätsel-Antwort steht im Text der Tafel (wie der vorhandene Test für die deutschen Plätze), jeder Fisch eines Platzes gibt es in `FISH`.
- Die vorhandenen Tests, die 18 Plätze zählen, werden angepasst, wo nötig (im Bericht nennen).

## Klärungen (Entscheidungen von Claude, nach der Bauer-Prüfung)
- **Eine Liste:** Die Auslands-Plätze stehen in derselben `SPOTS`-Liste. Alles, was nur Deutschland meint (Deutschland-Karte, „von 16 Bundesländern“, „Fluss-Stempel: Y von 18“, `blOpen`, `BL[s.bl]`), nimmt nur Plätze ohne `land`. `SPOTS_BY`, `LINKS`, `spotOpen`, `tryStamp` gelten für alle.
- **Fische:** Erlaubt sind alle Arten aus `FISH`, die an diesem Fluss wirklich leben, egal ob `home:'fluss'` oder `home:'see'` (so ist es schon bei den deutschen Plätzen, z. B. Forelle an der Donau). Die Äsche gibt es als `aesche`.
- **Niederlande:** Der Platz heißt „Lek bei Kinderdijk“, `river:'Rhein'`. Die Tafel erklärt einfach: Der Rhein teilt sich in den Niederlanden in mehrere Arme; einer heißt Lek und fließt zur Nordsee.
- **`river`-Feld:** Rhein (Schweiz, Niederlande), Donau (Wien, Budapest), Moldau (Prag). Die Verbindung nach Prag heißt „Elbe“.
- **Hauptstadt der Niederlande:** Amsterdam (auf Karte und Tafel). Den Haag als Regierungssitz muss nicht vorkommen.
- **Kartendaten:** Natural Earth ist aus dieser Umgebung erreichbar (GitHub-Spiegel `nvkelso/natural-earth-vector`, GeoJSON). Die Karte wird daraus vereinfacht, nicht von Hand gezeichnet.

## Dem Bauer überlassen
- Genaue Texte, Rätsel und Fischlisten (mit Quellen, Fakten müssen stimmen).
- Aussehen der 5 Wahrzeichen und des Rheinfalls im Rahmen der vorhandenen Bauhelfer (`castle`, `church`, `bridge`, `town` …), sanft und kindgerecht.
- Kartenausschnitt, Projektion und Farben der Europa-Karte (im Stil der Deutschland-Karte, auf dem iPad gut lesbar).
- Wie die Kartendaten vorbereitet werden (Skript nicht im Spiel, Ergebnis als Konstante).
