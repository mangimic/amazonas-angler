# Luxusyacht und offenes Meer – Bauanleitung

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Am Hafen von Hafenhausen gibt es einen Bootshafen mit einer Luxusyacht (20.000 Ludins). Mit ihr fährt man aufs offene Meer, mit Insel, Sandbank, Seehunden, Bojen und 3 Hochseefischen.

**Architecture:**
- Das Meer gehört zur Stadtwelt.
  - `cityHeight` liefert südlich des Hafens tiefes Wasser.
  - `inBounds` wird um das Meer erweitert.
  - Eine eigene Wasserfläche deckt das Meer ab.
- Gebaut wird alles in `buildCity` am Ende, mit eigener `rng` (nie die `R()`-Reihenfolge der Häuser ändern). Was sich bewegt, kommt nach `bakeCells`.
- Die Yacht ist ein eigenes Fahr-Ziel `player.ride==='luxus'`. Sie ist kein Eintrag in `VEHICLE_IDS`, also kein Parken auf der Straße und kein Abschleppen. Sie liegt an Liegeplätzen.

**Tech Stack:** eine Datei `index.html`, Three.js r128 (global `THREE`), Tests in `tests/spielstand.test.mjs` (node:test + Playwright).

**Spec:** `docs/superpowers/specs/2026-10-23-luxusyacht-meer-design.md`.
Die Spec ist vor der Animal-Crossing-Welt geschrieben. Wo sie widerspricht, gilt diese Anleitung (siehe „Anpassungen an die AC-Welt“).

## Global Constraints

- CLAUDE.md gilt vor allem anderen, besonders der Abschnitt **Spielstand**:
  - Schlüssel nie ändern, nie löschen.
  - Neue Felder mit Startwert und Prüfung beim Laden direkt nach dem SEC-001-Block (`hexCol`, `num`, `isObj`).
  - `SAVE_VERSION` bleibt 2.
  - Vor jedem Commit `cd tests && npm test`, alles grün.
- In `buildCity` bleibt die Reihenfolge der Zufallszahlen (`R()`) unverändert. Meer, Insel, Bojen und Bootshafen kommen ans Ende von `buildCity`, mit eigener `rng(…)`. Was sich bewegt oder ein-/ausgeblendet wird (Yacht, Seehund-Köpfe, Wellen), wird erst nach `bakeCells` gebaut.
- Feste Werte:
  - Preis **20.000 Ludins**.
  - Farbe **schwarz mit Gold**, Avatar-Name in Gold am Rumpf, Sonnendeck mit kleinem Pool.
  - Kein Logo, keine Marke.
- Bojen nach deutschem System (IALA A), von See kommend:
  - **rot links, grün rechts**.
  - Mit Blick nach Norden (+z) ist links = +x (Westen). Rote Bojen also bei x > 0, grüne bei x < 0.
- Seehunde, Hinweis: **„Abstand halten! Die Seehunde ruhen sich aus.“** Er kommt, wenn die Yacht näher als **25 m** ist, höchstens alle **20 s**.
- Aussteigen auf See: kein Knopf. Tipp: **„Fahr zu einem Steg, um auszusteigen.“**
- Game Feel sanft: leichtes Schaukeln, kein Wackeln. Knöpfe mindestens 60 px. Texte deutsch, kurz, kindgerecht. Fotos nur von lebenden Fischen (Wikimedia Commons, mit Lizenz).
- **Anpassungen an die AC-Welt (Rulings):**
  - NEWS: **v42 „Luxusyacht“**, nicht v31.
  - Der Bootshafen ist ein Laden: Öffnungszeiten 8–22 über `SHOP_CTX` (`'bootshafen'`) und `shopOpen()`. Einsteigen in die eigene Yacht geht immer, auch nachts.
  - Gekauft wird mit `state.ludins-=…`, nie mit `earn()`. Verdientes läuft wie überall über `earn(n)`.
  - Hochseefische (`home:'hochsee'`) sind nie Tagesfisch (`tagesfisch`) und nie Aufgabe (`AUFGABEN_FISCHE` nimmt schon nur `meer`/`see`). Grund: Man braucht die Yacht für 20.000 Ludins.
  - `zeit` für die neuen Fische nur mit Beleg (Fakten-Regel), sonst weglassen.
  - Bäume auf der Insel über `treeMat(geo)` (Jahreszeiten). Der Insel-Leuchtturm leuchtet nachts wie der Hafen-Leuchtturm.
- Test-Helfer `window.__test` nur bei `navigator.webdriver===true`.
- Zeit in Tests (Regel aus der AC-Welt):
  - `newPage(opts)` stellt Date auf heute 11:00 oder `opts.start`.
  - `zeitSeite(iso)` gibt eine feste Zeit, `startZeitSeite(iso)` startet zu dieser Zeit und läuft weiter.
  - ISO immer mit Offset.

## Review Focus

1. **Speichern während der Fahrt auf See**, dann Neuladen: Man steht zu Fuß an einem Steg, nie im Wasser. `city.riding` ist `''`, `yachtAt` ist der nächste Liegeplatz. → Test in Task 3.
2. **Fliegen, Werkstatt öffnen oder Spielzeit-Pause auf der Yacht:** Die Yacht legt am nächsten Liegeplatz an, man steht auf dem Steg. → Test in Task 3.
3. **Nachts:** Der Bootshafen-Laden ist zu. Die eigene Yacht kann man trotzdem betreten, und die Insel ist nie schwarz. → Test in Task 3.
4. **Wenden am Liegeplatz:** Die lange Yacht muss an beiden Stegen wenden und ablegen können (Bug und Heck frei). Steckt sie trotzdem fest, kommt ein Tipp. → Test in Task 3.
5. **Angeln von der Insel aus**, zu Fuß: Dort beißen Hochsee- und Meeresfische. Im Hafen beißen nur die 5 Hafenfische. → Test in Task 4.

---

### Task 1: Das offene Meer – Wasser, Insel, Sandbank mit Seehunden, Bojen

**Files:**
- Modify: `index.html`: `cityHeight` (~Z. 684), `inBounds` (~Z. 1438), Ende von `buildCity`, Karten (`showCityMap`, kleine Karte), `__test`.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Produces:
  - Literale neben `CITY`, rein aus Zahlen, damit Tests sie mit `stadtWert` lesen können:
    - `const SEA={x:0,z0:-3150,z1:-3650,w:300}` (Meer von z −3150 bis −3650, |x−SEA.x| < 300);
    - `const ISLAND={x:-120,z:-3480,r:20}`;
    - `const SANDBANK={x:110,z:-3380,rx:30,rz:14}`.
  - `atSea():boolean` = in der Stadtwelt und `player.pos.z < SEA.z0`.
  - `seaHeight(x,z):number` liefert:
    - −4 auf dem Meer;
    - Insel: Strand bis Gras, Mitte etwa 1.6, Rand weich ins Wasser;
    - Sandbank: etwa 0.4 über Wasser.
    `cityHeight` ruft `seaHeight` für `z < SEA.z0` auf. Der Hafen bleibt, wie er ist.
  - `inBounds` erlaubt (nur wenn `cityBuilt`) das Meer: `|x−SEA.x| < SEA.w−6` und `SEA.z1+6 < z < SEA.z0+40`. Der Streifen +40 überlappt mit dem Hafen.
  - Eine eigene Wasserfläche fürs Meer, ca. 600 × 520, mit derselben Textur und demselben Material-Look wie `water`. Sie bewegt sich sanft (Wellen) über die Textur-Verschiebung oder eine kleine Höhen-Schwingung, nicht über Wackeln.
  - Insel:
    - Strand, Gras, 6–10 Bäume über `treeMat(geo)`;
    - kleiner Leuchtturm `lighthouse(g,x,z)` mit Nachtlicht wie im Hafen;
    - ein Steg (begehbar). Dafür `onDock` um einen Bereich `IDOCK` erweitern, wie `DOCK`/`LDOCK`.
  - Sandbank:
    - Für Boote ein Hindernis (zu flach). Für Fußgänger gibt es keinen Weg dorthin.
    - 4–6 Seehunde (liegend, grau-gefleckt, freundlich). Die Köpfe heben sich ab und zu; das wird nach `bakeCells` gebaut.
  - Bojen: 3 Paare an der Fahrrinne vor der Hafeneinfahrt, bei z −3165, −3205 und −3245. Rote Bojen bei x = +25, grüne bei x = −25. Sie sind Hindernisse (Collider r 0.8).
  - Stadtplan und kleine Karte zeigen Meer, Insel, Sandbank und Bojen.
  - Testhilfen (nur bei `navigator.webdriver`): `__test.hoehe(x,z)` = `heightAt(x,z)`, `__test.bojen()` → `[{x,z,farbe:'rot'|'gruen'}]`.

- [ ] **Step 1: Failing tests**
  - `Meer: tiefes Wasser, Insel und Sandbank`:
    - Stadt-Seed, Spiel starten.
    - `__test.hoehe(0,-3400) < -3`.
    - `__test.hoehe(ISLAND.x, ISLAND.z) > 1`.
    - `__test.hoehe(SANDBANK.x, SANDBANK.z) > 0.2`.
    - Der Hafen ist unverändert: `__test.hoehe(0,-3125)` liegt zwischen −3 und −2.
  - `Meer: auf der Insel kann man herumlaufen`:
    - `warp` auf die Insel, 3 s W halten.
    - Die Position ändert sich, die Höhe bleibt > 0.3.
    - `where.z < SEA.z0`, und das bleibt nach dem Neuladen (`weg`) so.
  - `Meer: Bojen rot links, grün rechts`:
    - Regex auf `index.html`, dann Prüfung der Literal-Liste der Bojen.
    - Ins Spiel: Bojen-Positionen über `__test.bojen()` → `[{x,z,farbe}]`. Rote haben x > 0, grüne haben x < 0.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren wie in Interfaces. Danach ein Bildschirmfoto vom Meer mit Insel und Sandbank anschauen.
- [ ] **Step 4:** PASS. Vorhandene Hafen-Tests bleiben grün: Angeln im Hafen, Hannes Hafen, Straßenbahn, Leiste oben.
- [ ] **Step 5:** Voller `npm test`, dann Commit „Meer: offenes Meer mit Insel, Sandbank, Seehunden und Bojen“. Noch keine NEWS (das Meer ist ohne Yacht nicht erreichbar).

### Task 2: Bootshafen, Kauf und Spielstand

**Files:**
- Modify: `index.html`:
  - Ende von `buildCity` (Bootshafen-Haus, Hafen-Steg);
  - `state`-Startwert und Prüfung beim Laden;
  - `SHOP_CTX`, `cityCtx`/`updateCtx`/Klick;
  - neue `showBootshafen()` mit `buyList`;
  - Yacht-Modell;
  - Stadtplan-Marker.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `SEA`, `onDock` (Task 1), `SHOP_CTX`, `shopOpen()`, `buyList`.
- Produces:
  - `const LUXUS={price:20000,speed:14,turn:1.6,len:12}`.
  - Liegeplätze als flache Literale:
    - `const BERTH_HAFEN={x:…,z:…,f:…,yx:…,yz:…,yaw:…}`
    - `const BERTH_INSEL={…}`
    - `x,z,f` = Standplatz auf dem Steg, mit Blick zur Yacht.
    - `yx,yz,yaw` = Liegeplatz der Yacht.
  - `const LUXUS_BERTHS={hafen:BERTH_HAFEN,insel:BERTH_INSEL}`.
  - Der Hafen-Steg liegt im Hafenbecken neben dem Bootshafen. Er darf die Fischerboote (−60/−28/42), Hannes (−80) und den Leuchtturm (110) nicht stören. Ein Vorschlag ist x ≈ 70; nachmessen.
  - `const BOOTSHAFEN_AT={x:…,z:…}` = Gehweg vor der Tür. Er liegt nicht auf den Schienen (`railDist` > 2.5).
  - `state.city.luxus=false` und `state.city.yachtAt='hafen'` als Startwert. Prüfung beim Laden:
    - `luxus` muss genau `true` sein, sonst `false`;
    - `yachtAt` muss ein Schlüssel von `LUXUS_BERTHS` sein, sonst `'hafen'`;
    - nichts löschen.
  - Kontext `'bootshafen'` mit dem Text „⛵ Zum Bootshafen“. Er steht in `SHOP_CTX`, also gilt nachts der Geschlossen-Text.
  - `showBootshafen()`:
    - eine Karte mit Titel „⛵ Bootshafen“ und einer Ware „Luxusyacht“ (20.000 L);
    - Kauf über `buyList`;
    - zu wenig Ludins: grauer Knopf mit „Noch X L“, wie bei den anderen Läden;
    - gekauft: „Hast du“ und „Sie liegt am <Hafen-Steg | Insel-Steg>.“
  - `luxusMesh`: Yacht-Modell nach `bakeCells`, liegt bei `LUXUS_BERTHS[state.city.yachtAt]`. Es ist nur sichtbar, wenn `luxus`.
    - Rumpf schwarz, Reling/Streifen gold.
    - Sonnendeck mit kleinem blauen Pool.
    - Avatar-Name in Gold am Rumpf, wie `YACHT` am Amazonas, mit derselben Canvas-Text-Technik.
  - Stadtplan: Marker für Bootshafen ⛵, Yacht 🛥️ und Insel. Dazu Legende.

- [ ] **Step 1: Failing tests**
  - `Bootshafen: Luxusyacht kaufen`:
    - Seed mit `ludins:20050`, Stand bei `BOOTSHAFEN_AT` um 10:00.
    - Knopf „⛵ Zum Bootshafen“, dann Kauf.
    - Danach: `ludins===50`, `city.luxus===true`, `city.yachtAt==='hafen'`.
    - Das bleibt nach dem Neuladen so.
  - `Bootshafen: zu wenig Ludins`: Mit `ludins:100` ist der Kauf-Knopf grau und zeigt „Noch 19900 L“. Ein Klick ändert nichts.
  - `Bootshafen: um 23 Uhr geschlossen`: Der Knopf zeigt den Geschlossen-Text.
  - `Alter Spielstand: luxus und yachtAt bekommen Startwerte; kaputte Werte werden repariert`:
    - `luxus:'ja'` wird zu `false`;
    - `yachtAt:'mond'` wird zu `'hafen'`;
    - unbekannte `city`-Felder bleiben.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren. Ein Bildschirmfoto der Yacht am Hafen-Steg anschauen: schwarz-gold, Name, Pool.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Voller `npm test`, dann Commit „Bootshafen: Luxusyacht kaufen“.

### Task 3: Mit der Yacht fahren

**Files:**
- Modify: `index.html`:
  - `updatePlayer` (Fahrzweig);
  - `cityCtx`/`updateCtx`/Klick (an Bord, aussteigen);
  - `saveWhere` und Laden;
  - Flug, Werkstatt und Spielzeit-Pause (wie `tramOff`/`parkHere` dort);
  - Hupe;
  - Kamera.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `LUXUS`, `LUXUS_BERTHS`, `luxusMesh`, `state.city.luxus/yachtAt` (Task 2); `SEA`, `SANDBANK`, Bojen-Collider, `atSea()` (Task 1).
- Produces:
  - `luxusWater(x,z):boolean` = `inBounds` && `heightAt(x,z) < -1` && nicht auf einem Steg && kein Collider (Bojen, Leuchtturm, Fischerboote).
  - `luxusFits(x,z,yaw):boolean` prüft drei Punkte: Mitte, Bug und Heck (je ±`LUXUS.len*0.4` entlang `yaw`). Alle drei müssen `luxusWater` sein. Die Sandbank ist dadurch Hindernis.
  - Kontexte:
    - `'luxus_an'` mit „⛵ An Bord gehen“: zu Fuß, `luxus`, Abstand zum Standplatz des Liegeplatzes `yachtAt` < 3. Geht auch nachts.
    - `'luxus_ab'` mit „⚓ Aussteigen“: auf der Yacht und < 18 m vom Liegeplatz `yx/yz` eines Liegeplatzes.
  - Aussteigen setzt `yachtAt`, legt die Yacht genau auf `yx/yz/yaw`, stellt den Spieler auf `x/z/f` und speichert.
  - Fahren:
    - `player.ride='luxus'`, Geschwindigkeit `LUXUS.speed`, Drehung `LUXUS.turn`.
    - Schritt nur, wenn `luxusFits`. Kein Rutschen.
    - Drehen auf der Stelle geht, wenn `luxusFits` mit dem neuen Winkel stimmt.
    - Hängt die Yacht 1.5 s, obwohl man lenkt, kommt einmal der Tipp „Lenk in eine andere Richtung.“
    - Strafzettel gibt es nicht für die Yacht: `FINE` hat keinen Eintrag `luxus`.
  - Auf See ohne Liegeplatz in der Nähe: Tipp „Fahr zu einem Steg, um auszusteigen.“, höchstens alle 20 s, nur wenn man stillsteht.
  - Schaukeln: Rumpf-Neigung ±2°, Hub ±0.1 m, langsam. Die Kamera folgt weich, ohne Wackeln.
  - Seehund-Hinweis wie in den Global Constraints. Dazu hebt der nächste Seehund den Kopf.
  - Hupe:
    - Knopf „📯 Hupe“ wie beim Truck (`#btnHorn`), sichtbar bei `ride==='truck'||ride==='luxus'`.
    - Bei `luxus` ein tiefer Ton, z. B. `tone(110,0.6,'sine',0.1)`.
    - Menschen in der Nähe winken wie beim Truck.
  - Speichern (`saveWhere`) während `ride==='luxus'`:
    - `where` = Standplatz des nächsten Liegeplatzes;
    - `yachtAt` = dieser Liegeplatz;
    - `city.riding=''`.
  - Fliegen, Werkstatt öffnen oder Spielzeit-Pause: wie Speichern, also anlegen am nächsten Liegeplatz und auf dem Steg stehen.
  - Ein-/Aussteigen und Fahren ändern nichts an `VEHICLE_IDS`, `parked`, `tow`. Die Straßenbahn wartet nicht auf die Yacht.
  - Testhilfen (nur bei `navigator.webdriver`): `__test.wo()` → `{atSea,ride,x,z,facing}`; `__test.luxusWarp(p)` setzt die gerade gefahrene Yacht auf `p.yx/p.yz/p.yaw` (oder `p.x/p.z`), nur wenn `ride==='luxus'` und `luxusFits` dort stimmt.

- [ ] **Step 1: Failing tests**
  - `Yacht: einsteigen, aus dem Hafen fahren, an der Insel aussteigen`:
    1. Seed `luxus:true`, `yachtAt:'hafen'`, Stand bei `BERTH_HAFEN`.
    2. „⛵ An Bord gehen“.
    3. Fahren mit Tasten (kein Warp): drehen und W halten, bis `__test.wo().atSea`. Maximal 90 s.
    4. Danach `__test.luxusWarp(BERTH_INSEL)` (nur Testhilfe: setzt die fahrende Yacht vor den Insel-Steg).
    5. „⚓ Aussteigen“.
    6. Erwartet: `yachtAt==='insel'` und `where` nahe `BERTH_INSEL.x/z`. Nach dem Neuladen steht man auf der Insel (`hoehe > 0`) und die Yacht liegt dort.
  - `Yacht: Speichern auf See`:
    1. An Bord und auf See (`luxusWarp` auf einen Punkt mitten im Meer).
    2. `pagehide`.
    3. Erwartet: `city.riding===''`, `where` liegt an einem Steg, `yachtAt` ist der nächste Liegeplatz. Nach dem Neuladen ist `hoehe(where) > 0` oder man steht auf dem Steg.
  - `Yacht: Werkstatt öffnen auf See legt am Steg an`: Ablauf wie im Test davor, aber mit der Avatar-Werkstatt statt `pagehide`.
  - `Yacht: nachts einsteigen geht, der Laden ist zu`: um 23:00 zeigt `BOOTSHAFEN_AT` den Geschlossen-Text, `BERTH_HAFEN` zeigt „⛵ An Bord gehen“.
  - `Yacht: an beiden Stegen wenden`:
    1. An Bord am Hafen-Steg.
    2. Nur A halten (drehen) für 3 s.
    3. `facing` ändert sich um mehr als 1 rad.
    4. Dasselbe am Insel-Steg.
  - `Yacht: Sandbank ist Hindernis und die Seehunde mögen Abstand`:
    1. `luxusWarp` 30 m vor die Sandbank, Blick zu ihr.
    2. W halten.
    3. Der Toast „Abstand halten!“ erscheint.
    4. Die Yacht bleibt außerhalb der Sandbank: Der Abstand zur Mitte bleibt > `SANDBANK.rz`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren. Ein kurzes Bildschirmfoto während der Fahrt auf See anschauen (Schaukeln sanft).
- [ ] **Step 4:** PASS. Diese vorhandenen Tests bleiben grün: Truck, Tram, Abschleppdienst, Leiste oben, Spielzeit.
- [ ] **Step 5:** Voller `npm test`, dann Commit „Luxusyacht: fahren, anlegen, Seehunde“.

### Task 4: Hochseefische, Angeln auf See, Doku und NEWS

**Files:**
- Modify: `index.html`:
  - `FISH` (3 Einträge), `FOTOS`, `RULES`;
  - `chooseFish` (~Z. 1649), `findWater` (~Z. 1562), `fishPress` (Stadt-Prüfung);
  - Fischbuch-Teile, Museum-Abschnitte, `FISH_ORT` (~Z. 3553), `tagesfisch` (~Z. 1756);
  - NEWS.
- Create: `fotos/thunfisch.jpg`, `fotos/seelachs.jpg`, `fotos/steinbutt.jpg`
- Modify: `fotos/BILDNACHWEIS.md`, `docs/fakten-quellen.md`, `CLAUDE.md`, `IDEEN.md`
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `atSea()` (Task 1); `player.ride==='luxus'` (Task 3).
- Produces:
  - 3 Fische mit `home:'hochsee'`. Die ids nie ändern:
    - `thunfisch`: Roter Thun, selten. `RULES.thunfisch={selten:true}` wie beim Dorsch.
    - `seelachs`: Köhler.
    - `steinbutt`.
    - Jeder mit `name`, `fact` (kindgerecht, mit Quelle geprüft), `w`, `price`, `cm`, `art` wie die anderen.
    - `zeit` nur mit Beleg.
    - Die Preise passen zu den Hafenfischen. Mindestens einer hat `price>=40`, damit der Bootsbonus greift.
  - `chooseFish`:
    - Auf See (`atSea()`, zu Fuß auf der Insel oder an Bord): Pool = `hochsee` + `meer`. Die `meer`-Fische haben dabei halbes Gewicht `w`.
    - Im Hafen bleibt es bei nur `meer`.
    - Von Bord (`ride==='luxus'`) beißen Fische mit `price>=40` öfter, wie beim Boot am Amazonas.
    - `fishActive` und die Angelarten (`METHODS`) gelten wie überall.
  - Angeln von Bord:
    - `fishPress` erlaubt Angeln bei `ride==='luxus'` (sonst gilt weiter „Steig erst ab …“).
    - `findWater` wirft von Bord weiter: Abstände `[7,9,11]`.
  - `FISH_ORT.hochsee='auf dem offenen Meer'`.
  - Fischbuch: neuer Teil „Offenes Meer“ (Reihenfolge: nach „Meer“). Museum-Ausstellung: neuer Abschnitt „Offenes Meer“.
  - `tagesfisch`: schließt `home:'hochsee'` aus (Ruling in den Global Constraints).
  - NEWS ganz oben: `v:42`, Datum 28.10.2026, 🛥️, Titel „Luxusyacht“. Text: „Am Hafen gibt es jetzt einen Bootshafen. Kauf dir die schwarz-goldene Luxusyacht und fahr hinaus aufs Meer – zur Insel und zu den Seehunden!“

- [ ] **Step 1: Failing tests**
  - `Hochsee: draußen beißen nur Meeres- und Hochseefische`:
    - an Bord auf See, 3 Fänge.
    - Jede id hat `home` in `['meer','hochsee']`.
    - Über mehrere Fänge oder über `__test` mit vielen `chooseFish`-Würfen (wie in Task 3 der AC-Welt): mindestens ein `hochsee`-Fisch kommt vor.
  - `Hochsee: von der Insel aus beißen sie auch`: zu Fuß am Insel-Ufer, 1 Fang, `home` in `['meer','hochsee']`.
  - `Hafen: im Hafen bleiben es die 5 Hafenfische`: Der vorhandene Hafen-Test bleibt so. Ergänze ihn: kein `hochsee`.
  - Fischzahl:
    - Vorhandene Tests mit 42 Fischen oder „40 ?“ an `FISH.length` anpassen, nicht an eine neue feste Zahl.
    - `fotos/` enthält für jeden Fisch ein Bild.
  - `Tagesfisch: nie ein Hochseefisch`: Den vorhandenen Ganzjahres-Test um `home!=='hochsee'` ergänzen.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren.
  - Fotos von lebenden Fischen von Wikimedia Commons holen, verkleinern wie die anderen Fotos und in `BILDNACHWEIS.md` mit Urheber und Lizenz eintragen.
  - Fakten mit Quelle in `docs/fakten-quellen.md` belegen (Thun in der Nordsee: selten, wieder zurückgekehrt; Köhler; Steinbutt: Augen auf einer Seite).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:**
  - `CLAUDE.md`:
    - Abschnitt Hafenhausen um einen Punkt „Luxusyacht und Meer“ ergänzen: `SEA`, `ISLAND`, `SANDBANK`, `LUXUS`, `LUXUS_BERTHS`, `ride==='luxus'`, `state.city.luxus/yachtAt`, `home:'hochsee'`, Bojen rot links/grün rechts.
    - Fotos-Zeile: 45 Fische, 3 Hochsee.
  - `IDEEN.md`: Zeile unter „Fertig“.
  - Voller `npm test`, dann Commit „Hochsee: 3 neue Fische, Angeln auf dem Meer (v42)“.
