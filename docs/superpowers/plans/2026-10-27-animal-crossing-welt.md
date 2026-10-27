# Animal-Crossing-Welt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Spielwelt richtet sich nach der echten Uhrzeit und dem Datum. Dazu kommen Nachbarn mit Gesprächen und Freundschaft, Verkehrsregeln, ein Museum und tägliche Überraschungen.

**Architecture:** Alles bleibt in `index.html`. Ein kleines Modul **Weltzeit** (reine Funktionen und ein Zustand `WT`) liefert Tagesphase, Sonnenhöhe, Jahreszeit und Datums-Schlüssel. Alle anderen Teile lesen nur `WT` bzw. diese Funktionen. Neue Spielstand-Felder bekommen einen Startwert in `state` und werden beim Laden bereinigt, wie bei SEC-001 (`num()`, `hexCol()`, feste id-Listen).

**Tech Stack:** HTML/JS ohne Build, Three.js r128 (global `THREE`), Tests mit `node:test` und Playwright 1.56 (`tests/spielstand.test.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-27-animal-crossing-welt-design.md`

## Global Constraints

- Die Regeln aus CLAUDE.md gelten vor allem anderen. Am wichtigsten ist der Abschnitt **Spielstand**:
  - Die Schlüssel `amazonas-angler-1…` werden nie geändert.
  - Neue Felder gibt es nur mit Startwert.
  - `SAVE_VERSION` bleibt 2.
  - Es wird nichts gelöscht.
  - Vor jedem Commit, der `index.html` ändert, muss `cd tests && npm test` grün sein.
- Three.js bleibt r128. Kein `import`, kein npm im Spiel.
- Knöpfe sind mindestens 60 px groß. Texte sind deutsch, mit kurzen Sätzen.
- Hinweise laufen über `toast()`.
- Gespräche folgen dem Stil von i-have-adhd:
  - 1–2 Sätze;
  - 2–3 große Antwort-Knöpfe;
  - oben steht, worum es geht.
- Jugendschutz:
  - nichts Gruseliges; die Nacht ist nie schwarz;
  - keine Verletzungen, keine Umfall-Animation;
  - keine Links, keine Werbung;
  - Fische nur als echte Fotos (`fishImg`).
- In `buildCity` bleibt die Reihenfolge der Zufallszahlen (`R()`) unverändert. Was sich bewegt oder ein-/ausgeblendet wird, wird erst nach `bakeCells` gebaut.
- Diese ids werden nie geändert, denn sie stehen im Spielstand: Nachbar-ids `'n0'…'n23'` (Index beim Bauen), Fisch-ids, `INFOBOARDS`-ids.
- Feste Werte aus der Spec:
  - Läden haben **8–22 Uhr** geöffnet.
  - Fischzeiten:
    - `'nacht'` = 16–6 Uhr;
    - `'tag'` = 6–18 Uhr;
    - `'daemmerung'` = 5–9 und 16–21 Uhr;
    - also ist von **16–18 Uhr jeder Fisch** möglich.
  - Strafe: **5 Ludins** (bike/roller/skate) bzw. **20 Ludins** (truck). Sie gilt bei einem Lenk-Ausschlag über 0,6, höchstens alle 4 s, und die Ludins werden nie kleiner als 0.
  - Aufgaben: höchstens 3 offen. Die Belohnung ist 2 × Preis + 10 Ludins und +3 Freundschaft. Reden bringt +1 pro Tag.
  - Freundschaftsstufen: unter 5 Punkten „Bekannt“, ab 5 „Freund“, ab 15 „Bester Freund“.
  - Breitengrade: Amazonas −3°, Deutschland 51°.
  - Jahreszeiten beginnen meteorologisch am 1.3., 1.6., 1.9. und 1.12.
  - Nachts (22–6 Uhr) sind höchstens 4 Menschen sichtbar.
- Jede Aufgabe bekommt einen eigenen `NEWS`-Eintrag ganz oben. `v` wird um 1 erhöht, beginnend bei **32**.
- Tests stellen die Zeit mit `ctx.clock.setFixedTime(...)` ein. Der Kontext bekommt `timezoneId: 'Europe/Berlin'`, damit die Tests in der CI (UTC) gleich laufen.
- Nur für Tests gibt es eine Testhilfe `window.__test`. Sie wird nur angelegt, wenn `navigator.webdriver === true`, also nie auf einem echten iPad. Sie bietet `warp(x,z)` und `nachbar(k)` → `{x,z,sichtbar}`, sonst nichts.

## Review Focus

1. **Nach der Schule 16–18 Uhr, Winter oder Sommer:** Jeder Fisch muss beißen können. Kein Fisch darf wegen der Uhrzeit für ein Kind mit 15 Minuten Spielzeit unerreichbar sein. → Test in Task 3 bei 17:00 im Dezember.
2. **Eimer voll und alle Läden zu (23 Uhr):** Das Kind darf nicht festhängen. → Test zu „Freilassen“ in Task 4.
3. **CI läuft in UTC:** Die Phase muss trotzdem nach Berliner Ortszeit stimmen. → `timezoneId` in allen Zeit-Tests (Task 1).
4. **Strafe bei wenig Ludins:** Die Ludins werden nie negativ, und eine Strafe kommt nicht mehrfach pro Aufprall. → Test in Task 5.
5. **Alter Spielstand ohne neue Felder oder mit kaputten Werten:** Er bekommt Startwerte und wird nicht gelöscht. → Test in Task 6 (`nachbarn`/`aufgaben`), Task 7 (`museum`) und Task 8 (`tag`).
6. **Unsichtbare (schlafende) Menschen:** Sie sind kein Hindernis und kein Gesprächspartner. → Test in Task 5/6 über `__test.nachbar(k).sichtbar`.
7. **Nacht auf dem iPad:** Es bleibt hell genug, um zu spielen. → Task 1 hat eine Mindesthelligkeit (siehe Werte) und eine Screenshot-Prüfung.

---

### Task 1: Weltzeit, Himmel, Licht, Uhr im HUD

**Files:**
- Modify: `index.html`
  - in der Nähe von `const SKY`/`HemisphereLight`/`sun` (~Z. 735–738);
  - HUD neben `#timeChip` (~Z. 254);
  - Loop `loop()` (~Z. 3540);
  - NEWS.
- Test: `tests/spielstand.test.mjs`. Dazu kommt der Helfer `newPage({ timezoneId:'Europe/Berlin' })` und das Setzen der Zeit vor `seed`.

**Interfaces:**
- Produces:
  - `todayKey(d?:Date):string` gibt `'JJJJ-MM-TT'` in Ortszeit zurück.
  - `dayOfYear(d):number`
  - `regionNow():'amazonas'|'de'` gibt `'de'` zurück, wenn `atLake()||atDE()||atCity()`.
  - `solarHour(d,region):number`:
    - für `'de'`: UTC-Stunde + Minuten/60 + 10/15;
    - für `'amazonas'`: die Ortszeit-Stunde, damit dort immer etwa 6–18 Uhr hell ist.
  - `sunElevation(latDeg, solarHour, doy):number` in Grad. Deklination δ = −23,44°·cos(2π(doy+10)/365); Stundenwinkel = 15°·(solarHour−12).
  - `phaseOf(elev):'tag'|'daemmerung'|'nacht'`: `>6` ist tag, `>-6` ist daemmerung, sonst nacht.
  - `season(d):'fruehling'|'sommer'|'herbst'|'winter'`
  - `WT = {phase, elev, season, hour, region, key}` wird von `updateWorldTime()` alle 30 s, beim Start und nach `flyTo` neu gesetzt. Dabei werden auch `document.body.dataset.phase` und `dataset.season` gesetzt.
  - `#clockChip` zeigt „☀️ 14:05“, „🌅 20:40“ oder „🌙 23:00“.
  - `isNight()` gibt `WT.phase==='nacht'` zurück.

- [ ] **Step 1: Failing tests.** Füge den Helfer `zeitSeite(iso)` hinzu. Er ruft `newPage({ timezoneId:'Europe/Berlin' })` auf, danach `await ctx.clock.setFixedTime(new Date(iso))`, und gibt `{ctx,page,errors}` zurück.
  - `Weltzeit: Nachmittag im Juni ist Tag`: am Heimat-See um `2026-06-21T14:00:00+02:00` ist `body[data-phase="tag"]` und `#clockChip` enthält „14:00“.
  - `Weltzeit: 23 Uhr ist Nacht, mit Sternen`: am Heimat-See um `2026-06-21T23:00:00+02:00` ist `data-phase="nacht"`.
  - `Weltzeit: um 19 Uhr ist am Amazonas Nacht, in Deutschland Tag`: am Dorf (`ALT_V1`-Ort) um `2026-06-21T19:00:00+02:00` ist die Phase `'nacht'`. Am Heimat-See zur selben Zeit ist sie `'tag'`.
  - `Weltzeit: Jahreszeit`: 15.4. ergibt `fruehling`, 15.7. `sommer`, 15.10. `herbst`, 15.12. `winter` (`body[data-season]`).
- [ ] **Step 2:** `cd tests && node --test --test-name-pattern="Weltzeit" spielstand.test.mjs` muss mit FAIL enden, weil `data-phase` fehlt.
- [ ] **Step 3: Implementieren.**
  - Die Funktionen oben schreiben.
  - Himmel/Nebel/Licht: `skyColor(elev)` interpoliert diese Farben:
    - Tag `#a6dccd`;
    - Dämmerung `#f2a07b`;
    - Nacht `#22335e`;
    - Nachtnebel ebenfalls `#22335e`.
  - `HemisphereLight`-Stärke: Tag 0.9, Nacht **mindestens 0.45**. `sun`-Stärke: Tag 0.75, Nacht 0.15, Farbe kühlblau `#9fb4ff`.
  - Die Sonnenrichtung `sun.position` folgt dem Stundenwinkel.
  - Sterne: **ein** `THREE.Points` mit ca. 400 Punkten auf einer Halbkugel, Radius 300. Sie folgen der Kamera und sind nur sichtbar, wenn `WT.phase==='nacht'`.
  - Mond: eine helle Scheibe (`MeshBasicMaterial`), nur nachts.
  - Fenster und Laternen in Hafenhausen: Ihre Fensterfarbe (Material mit Farbe `#8fc3dd` bzw. Laternenkopf) wird nachts zu `#ffe39a` getauscht. Dafür eine eigene Material-Instanz, nicht die gemeinsame aus dem Cache.
  - Glühwürmchen am Amazonas: ≤ 30 Punkte in Dorfnähe, nur nachts.
  - Die Testhilfe `window.__test` anlegen, wenn `navigator.webdriver===true`. Sie hat `warp(x,z)`: Spieler versetzen, `groundY`, `save()`.
- [ ] **Step 4:** Test von Step 2 muss PASS sein. Dann einen Screenshot bei 23:00 in Hafenhausen machen und **ansehen**: Man muss Weg, Häuser und Avatar gut erkennen. Nichts darf gruselig wirken.
- [ ] **Step 5:** NEWS `{v:32, ico:'🌅', t:'Echte Tageszeit'}`, zum Beispiel: „Im Spiel ist jetzt dieselbe Uhrzeit wie bei dir. Abends geht die Sonne unter, nachts siehst du Sterne!“. Dann `npm test` (alles grün) und commit `Weltzeit: echte Tageszeit, Himmel und Uhr`.

### Task 2: Jahreszeiten (Deutschland) und Infotafel Regen-/Trockenzeit

**Files:**
- Modify: `index.html`:
  - Materialien für Wiese, Bäume und Laub an See, Fluss und in der Stadt;
  - `INFOBOARDS` und `INFO_TEXT`;
  - NEWS.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `WT.season`, `WT.region`
- Produces:
  - `applySeason(season)`: ändert nur `material.color`, als Faktor auf die Vertexfarben. Es entstehen **keine** neuen Meshes, und es wird nicht neu zusammengefasst. Das passiert nur in der Region `'de'`. Am Amazonas setzt es auf neutral zurück, also `color = #ffffff`.
  - Laub-Faktor:
    - fruehling `#ffe6ef` plus Blütentupfer: ein `THREE.Points` je Baumgruppe, ≤ 300 Punkte;
    - sommer `#ffffff`;
    - herbst `#ffb35c`;
    - winter `#e8eef2`.
  - Wiese/Boden im Winter: `#eef3f6`.
  - Neue Infotafel `{id:'regenzeit', …}` am Amazonas-Dorf.

- [ ] **Step 1: Failing test** `Jahreszeiten: Infotafel Regenzeit am Amazonas`. Neben der Tafel (Position aus `INFOBOARDS` per Regex wie `stadtWert`) erscheint „📋 Infotafel lesen“, und der Text enthält „Regenzeit“. Ergänze im Test aus Task 1 `data-season` am Heimat-See am 15.12. → `winter`. Am Amazonas am 15.12. bleibt `data-season` gleich (Datum), aber `body[data-region="amazonas"]`.
- [ ] **Step 2:** Test FAIL.
- [ ] **Step 3: Implementieren.**
  - Den Text der Infotafel mit dem Skill `sachkunde-grundschule` schreiben und prüfen. Inhalt:
    - Am Äquator gibt es keine 4 Jahreszeiten.
    - Es gibt eine Regenzeit und eine Trockenzeit.
    - Bei Manaus regnet es vor allem etwa von Dezember bis Mai.
    - Der Fluss steigt dann um viele Meter.
    - Zahlen nur mit Quelle.
  - `data-region` am `body` setzen.
- [ ] **Step 4:** PASS. Screenshot von Hafenhausen am 15.10. und am 15.12. ansehen. Herbst und Winter müssen erkennbar sein.
- [ ] **Step 5:** NEWS v33 „Jahreszeiten“. `npm test`, commit.

### Task 3: Fische nach Uhrzeit

**Files:**
- Modify: `index.html`: `FISH` (neues Feld `zeit`), `chooseFish`, `trapFish`, `showBook`, NEWS.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `WT.hour` (Ortszeit-Stunde mit Bruchteil)
- Produces:
  - `FISH[i].zeit ∈ {'nacht','tag','daemmerung'}` oder fehlt.
  - `fishActive(f, hour):boolean` mit den Fenstern aus den Global Constraints.
  - `ZEIT_TEXT = {nacht:'🌙 abends und nachts', tag:'☀️ tagsüber', daemmerung:'🌅 morgens und abends'}`.
  - `chooseFish` und `trapFish` filtern ihren Pool mit `fishActive`. Wird der Pool leer, gilt der alte Pool, damit nie kein Fisch beißt.

- [ ] **Step 1: Failing tests.** Der Test liest `zeit` je Fisch per Regex `/id:'(\w+)'[^}]*?zeit:'(\w+)'/g` aus `index.html`.
  - `Fische nach Uhrzeit: um 23 Uhr beißt am See kein Tag-Fisch`: Heimat-See am 21.6. um 23:00, 3 Fänge. Keine gefangene id hat `zeit==='tag'`.
  - `Fische nach Uhrzeit: um 12 Uhr kein Nacht-Fisch`: am Rhein (`bw-rhein`, wie im vorhandenen Rhein-Test) um 12:00, 3 Fänge. Kein `zeit==='nacht'`.
  - `Fische nach Uhrzeit: um 17 Uhr im Dezember ist jeder Fisch möglich`: rein rechnerisch prüfen, dass jedes `zeit`-Fenster 17:00 enthält.
  - `Fischbuch zeigt Zeiten`: im Fischbuch steht „🌙 abends und nachts“.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3: `zeit` setzen, nur wo die Biologie stimmt.**
  - Mit Quelle prüfen (Fakten-Regel in CLAUDE.md):
    - nacht: Aal, Wels, Quappe, Zander, Zitteraal, Antennenwels, Piraíba;
    - tag: Hecht, Pfauenbarsch, Arowana.
  - Weitere Fische nur mit Beleg. Belege als Kommentar oder in den Report schreiben.
  - Danach `fishActive`, die Pool-Filter und den Fischbuch-Text einbauen. Der Fischbuch-Text erscheint auch bei „?“-Fischen.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** NEWS v34 „Fische nach Uhrzeit“. `npm test`, commit.

### Task 4: Öffnungszeiten und Fische freilassen

**Files:**
- Modify: `index.html`:
  - `updateCtx` und den Klick-Handler (~Z. 1887–1925);
  - `showBucket` (~Z. 1716);
  - NEWS.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `WT.hour`
- Produces:
  - `SHOP_HOURS = {auf:8, zu:22}`
  - `shopOpen():boolean`
  - Kontext-Text bei geschlossenem Laden: `'🌙 Geschlossen – öffnet um 8 Uhr'`.
  - Ein Klick darauf öffnet den Laden nicht, sondern zeigt einen Toast mit demselben Text.
  - Das gilt für `shop`, `tiago`, `hannes`, `vshop` und später `museum`.
  - Eimer-Knopf `#btnRelease` „🐟 Fische freilassen“: leert `state.bucket`, ohne Ludins, und speichert. Toast: „Platsch! Deine Fische schwimmen wieder frei.“

- [ ] **Step 1: Failing tests.**
  - `Läden: um 23 Uhr hat Rosa zu`: neben Rosa (Seed-Ort wie im Rosa-Test) um 23:00 enthält `#btnCtx` „Geschlossen“. Nach einem Klick ist `#card` nicht sichtbar.
  - `Läden: um 9 Uhr hat Rosa offen`: `#btnCtx` enthält „Rosa“.
  - `Eimer: Fische freilassen geht immer`: um 23:00 mit `bucket:[{id:'hering',cm:25,value:6}]` öffnet man den Eimer und klickt `#btnRelease`. Danach ist `bucket` leer und die Ludins sind unverändert.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren. Wo die Schild-Texte der Läden stehen, zusätzlich „8–22 Uhr“.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** NEWS v35 „Öffnungszeiten“. `npm test`, commit.

### Task 5: Menschen nach Uhrzeit, Ausweichen, Strafzettel

**Files:**
- Modify: `index.html`:
  - `buildPeople`/`people` (Feld `id:'n'+k`, `kid`);
  - `updatePeople`;
  - `updatePlayer` (Fahrzeugzweig);
  - NEWS.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `WT.hour`, `todayKey`, `VEHICLES`, `vehicleAt`, `tram.cols`, `tow.cols`, `inPlayerWay`
- Produces:
  - `people[k].id = 'n'+k` und `people[k].kid:boolean`. Den vorhandenen Wert `kid` aus `buildPeople` speichern; es kommen **keine** neuen `R()`-Aufrufe dazu.
  - `personAwake(p, d:Date):boolean`. Plan:
    - 22–6 Uhr: nur `n0`–`n3` wach;
    - Kinder werktags 13–19 Uhr, am Wochenende 9–19 Uhr;
    - Erwachsene 6–22 Uhr.
  - Schlafende Menschen: `g.visible=false`, `col` weg vom Spielfeld (`x=z=1e6`), nicht ansprechbar.
  - `blockedForPeople(x,z):boolean` meldet: geparkte eigene Fahrzeuge (Kreis r 1.0, Truck 3 Kreise wie `truckFits`), `tram.cols`, `tow.cols` und `inPlayerWay`.
  - Fahrende Fahrzeuge stoßen an geparkte Fahrzeuge: `rideable` bzw. `truckFits` berücksichtigen sie, das eigene, gerade gefahrene Fahrzeug ausgenommen.
  - `FINE = {bike:5, roller:5, skate:5, truck:20}`
  - `crash(kind:'mensch'|'wand'|'fahrzeug')`:
    - zieht `min(ludins, FINE[ride])` ab;
    - Toast „🚨 Strafzettel! Du bist gegen … gefahren. −X Ludins“ (bewusst ein Toast statt einer Karte wie in der Spec: eine Karte würde das Fahren unterbrechen);
    - Ton „Bonk“: `tone(180,0.12,'sine',0.08)`;
    - bei `mensch` dreht sich der Mensch zum Spieler, `wave=1.5`, Text „Hey, pass doch auf!“;
    - Sperre 4 s (`crashT`).
  - Auslöser: Im Fahrzeugzweig von `updatePlayer` ist `mag>0.6`, der volle Schritt ist blockiert, und es gibt keine Sperre. Die Art ergibt sich daraus, was blockiert: Mensch, geparktes Fahrzeug oder sonstiges = Wand.
  - `document.body.dataset.leute` = Anzahl sichtbarer Menschen, einmal pro Sekunde.

- [ ] **Step 1: Failing tests.**
  - `Verkehr: Truck schnell gegen Haus kostet 20 Ludins`: wie der Test „Cyber-Truck steckt die Nase nicht in Häuser“, mit `ludins:100`. Nach dem Aufprall ist `ludins===80`, und der Toast enthält „Strafzettel“.
  - `Verkehr: Strafe macht Ludins nie negativ`: dasselbe mit `ludins:7` → `0`.
  - `Verkehr: eine Strafe pro Aufprall`: W 3 s halten → `ludins===80`, nicht weniger.
  - `Verkehr: Fahrrad gegen geparkten Truck kostet 5`: Truck mit `parked` vor das Rad stellen, darauf zufahren → −5.
  - `Menschen schlafen nachts`: Hafenhausen 23:00 → `Number(body.dataset.leute) <= 4`. Um 10:00 an einem Samstag → `>= 20`.
  - `Menschen laufen nicht durch Fahrzeuge`: über `__test` den Truck mitten auf einen Weg eines Menschen parken (`__test.nachbar(k)` liefert die Position, dann `warp` und absteigen). 60 s laufen lassen. Der Abstand des Menschen zur Truck-Mitte ist zu keiner Zeit kleiner als 1,9 m. Mit `__test.nachbar(k)` alle 0,5 s messen.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren. Die vorhandenen Tests „Fahrzeuge halten an … nicht rutschen“ und „Cyber-Truck steckt die Nase nicht…“ müssen grün bleiben. Ziehen sie jetzt Ludins ab, passen die bisherigen Annahmen noch, weil sie keine Ludins prüfen.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** NEWS v36 „Verkehrsregeln“, zum Beispiel: „Menschen laufen jetzt um Fahrzeuge herum. Wer zu schnell irgendwo dagegenfährt, bekommt einen Strafzettel.“ `npm test`, commit.

### Task 6: Nachbarn, Gespräche, Aufgaben, Freundschaft

**Files:**
- Modify: `index.html`:
  - `state`-Startwert;
  - Prüfung beim Laden (direkt nach dem SEC-001-Block);
  - `cityCtx`/`updateCtx`/Klick;
  - `showCityMap` mit Bereich Aufgaben;
  - NEWS.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `people[k].id/kid`, `personAwake`, `todayKey`, `FISH_BY`, `state.bucket`, `sellList`-Preise (`f.price`)
- Produces:
  - `NAMEN_ERW` (24 Einträge `{name, art}`, `art ∈ freundlich|frech|ruhig|oma|opa`) und `NAMEN_KIND` (12 Einträge `{name:'Tom', alter:8, art:'kind'}`).
  - `nachbarInfo(k)` vergibt Namen deterministisch: Kinder der Reihe nach aus `NAMEN_KIND`, Erwachsene aus `NAMEN_ERW`.
  - `state.nachbarn = {}` mit `id → {f:number, talk:'JJJJ-MM-TT'|'' , gift:'JJJJ-MM-TT'|''}`.
  - `state.aufgaben = []` mit `{n:'n7', fish:'hering', day:'JJJJ-MM-TT'}`, höchstens 3.
  - Prüfung beim Laden:
    - `nachbarn`: nur ids `/^n\d{1,2}$/`, `f=num(f,999)`, `talk` und `gift` nur `/^\d{4}-\d\d-\d\d$/` oder `''`;
    - `aufgaben`: nur Einträge mit gültigem `n` und `FISH_BY[fish]`, die ersten 3;
    - nichts wird gelöscht, außer Einträgen, die nach dieser Regel kein Objekt oder ungültig sind. Sie werden ersetzt bzw. ausgelassen.
  - `AUFGABEN_FISCHE`: nur Fische mit `home` `'meer'` oder `'see'` und ohne `selten`-Regel.
  - Kontext: `'talk:'+k`, wenn zu Fuß, in der Stadt, wach und `dist<3`. Text `'💬 Reden mit '+name`. Ein Spieler-Fahrzeug, das Fahrzeug-Aufsteigen und der Laden haben Vorrang.
  - `showTalk(k)`:
    - Gesprächskarte mit dem Titel „💬 <Name>“ und Herzen ❤️ je Stufe;
    - 1–2 Sätze aus `GRUSS_ART[art]`;
    - Knöpfe:
      - „Hast du einen Tipp?“ → zufälliger Tipp aus `TIPPS_STADT`;
      - „Kann ich dir helfen?“ → neue Aufgabe oder Anzeige der offenen Aufgabe;
      - „Hier, bitte!“ (nur wenn ein passender Fisch im Eimer ist) → abgeben, Belohnung, +3;
      - „Tschüss!“.
    - Beim ersten Gespräch des Tages +1 Freundschaft, `talk=todayKey()`.
    - Der Mensch steht still und schaut zum Spieler, solange die Karte offen ist.
  - Geschenk: Bei Stufe Freund oder höher und `gift!==todayKey()` gibt es mit Wahrscheinlichkeit 0.3:
    - bei „Freund“: `baits.frucht += 3` oder 10–30 Ludins;
    - bei „Bester Freund“: zusätzlich einmalig die Mütze `clothes.muetze=true`, mit neuem Hut-Eintrag `'muetze'` in `HATS`. Der Hut braucht ein Mesh in `buildAvatar`.
  - Stadtplan: Bereich „📝 Aufgaben“ mit „<Name>: bring <Fisch> (0/1)“.

- [ ] **Step 1: Failing tests.**
  - `Nachbarn: reden, Aufgabe, Fisch bringen, Belohnung`:
    1. Hafenhausen um 10:00 (Samstag).
    2. `__test.nachbar(0)` → `warp` daneben.
    3. Klick „💬 Reden mit“, dann „Kann ich dir helfen?“, `aufgaben.length===1`.
    4. Den gewünschten Fisch in `bucket` seeden und neu laden.
    5. Hingehen, „Hier, bitte!“.
    6. Erwartet: `ludins` steigt um `2*price+10`, `nachbarn.n0.f===4` (1 + 3), `aufgaben.length===0`, und das bleibt nach dem Neuladen.
  - `Nachbarn: einmal pro Tag +1`: zweimal reden ergibt `f===1`.
  - `Nachbarn: schlafende Nachbarn reden nicht`: um 23:00 bei einem Erwachsenen `k≥4` → kein „Reden“-Knopf.
  - `Nachbarn: kaputte Werte werden repariert`: Seed `nachbarn:{n0:{f:'<b>',talk:'x'},zz:{}}, aufgaben:[{n:'n1',fish:'gibtsnicht'},'x']` → `n0.f===0`, `n0.talk===''`. `zz` darf bleiben, solange es ein Objekt ist (nie löschen). Die Prüfung beim Laden ignoriert ungültige ids bei der Anzeige. `aufgaben` ergibt `[]`.
  - `Alter Spielstand: nachbarn und aufgaben bekommen Startwerte`: `ALT_V1` ohne Felder → `{}` und `[]`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren. Texte kurz, kindgerecht, ohne Gewalt. Namen sind Vornamen oder „Frau/Herr Nachname“, keine echten Promis.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** NEWS v37 „Nachbarn“, zum Beispiel: „In Hafenhausen haben alle Menschen jetzt Namen. Rede mit ihnen, hilf ihnen und werde Freund!“. `npm test`, commit.

### Task 7: Museum

**Files:**
- Modify: `index.html`:
  - Laden-Platz 2 „Bald geöffnet“ in `buildCity` (~Z. 3018) → Schild „Museum“;
  - neue Konstante `MUSEUM_AT` als Literal neben `SHOP_AT`;
  - Kontext und Klick;
  - `state`-Startwert;
  - Prüfung beim Laden;
  - NEWS.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `shopOpen()`, `fishImg`, `FOTOS`, `RULES` (selten), `state.bucket`
- Produces:
  - `MUSEUM_AT = {x:…, z:…}`: Gehweg vor der Tür, nachgemessen wie `SHOP_AT`.
  - `state.museum = {}` mit `fishId → {cm:number, t:number}`.
  - Beim Laden: nur `FISH_BY`-ids zur Anzeige. Unbekannte bleiben gespeichert. `cm=num(cm,10000)`, `t=num(t)`.
  - Kontext `'museum'` mit dem Text „🏛️ Ins Museum“. Er gilt nur, wenn `shopOpen()`, sonst kommt der Geschlossen-Text aus Task 4.
  - `showMuseum()` hat 2 Tabs:
    - „Spenden“: Liste der Eimer-Fische, deren Art noch nicht im Museum ist und die nicht `selten` sind. Ein Klick nimmt den Fisch aus dem Eimer und schreibt ihn in `museum`. Der Kurator „Herr Eugen“ sagt `f.fact`.
    - „Ausstellung“: Abschnitte Amazonas / Heimat-See / Flüsse / Meer. Für Gespendetes `fishImg(f)` plus Tafel mit Name, Größe, Datum und Fotonachweis (wie im Fischbuch). Sonst „?“. Dazu der Zähler „X von 42“.

- [ ] **Step 1: Failing tests.**
  - `Museum: Fisch spenden und ansehen`:
    1. Bei `MUSEUM_AT` um 10:00 mit `bucket:[{id:'hering',cm:25,value:6}]`.
    2. „🏛️ Ins Museum“ → „Hering“ spenden.
    3. Erwartet: `museum.hering.cm===25`, `bucket` leer.
    4. In der Ausstellung ist `img` von `fotos/hering.jpg` sichtbar.
    5. Nach dem Neuladen bleibt `museum.hering` erhalten.
  - `Museum: dieselbe Art geht nur einmal`: Mit einem zweiten Hering im Eimer steht der Hering nicht in der Spendenliste.
  - `Museum: um 23 Uhr geschlossen`.
  - `Alter Spielstand: museum bekommt Startwert {}`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren. Die Zufallszahlen in `buildCity` bleiben unverändert: Nur Text und Farbe des Schildes ändern sich, es kommt kein `R()` dazu.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** NEWS v38 „Museum“. `npm test`, commit.

### Task 8: Tägliche Sachen – Tagesfisch, Tagesaufgaben, Flaschenpost

**Files:**
- Modify: `index.html`:
  - `sellList` (Preis);
  - `showBook` (Kopfzeile);
  - Nachbarn (Aufgaben-Startwert);
  - neue Konstante `FLASCHE_SPOTS`;
  - `state`-Startwert `tag`;
  - Prüfung beim Laden;
  - NEWS.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `todayKey`, `FISH`, `QUIZ`, `fishActive`
- Produces:
  - `dayHash(key):number`: einfache, stabile Zahl aus dem String, zum Beispiel FNV-1a 32 Bit.
  - `tagesfisch(key):fish`: aus `FISH` ohne `boat` und ohne `selten`, über `dayHash(key) % n`.
  - `sellList` zahlt für den Tagesfisch `value*2` und zeigt „⭐ Tagesfisch ×2“.
  - Fischbuch-Kopfzeile: „⭐ Tagesfisch heute: <Name>“.
  - `FLASCHE_SPOTS = [{x,z,ort:'amazonas'},{x,z,ort:'see'},{x,z,ort:'stadt'}]`: Literale am Ufer bzw. Strand, begehbar, nachgemessen.
  - Heutiger Ort: `FLASCHE_SPOTS[dayHash(key)%3]`.
  - `state.tag = {day:'', flasche:false}`. Bei neuem Tag `{day:key, flasche:false}`. Beim Laden: `day` passt zum Muster oder `''`, `flasche` ist boolean.
  - Kontext `'flasche'` in ≤ 3 m mit dem Text „🍾 Flaschenpost“. Er erscheint nur, wenn `!state.tag.flasche`.
  - Inhalt aus `dayHash(key+'f')%3`:
    - 0: Rätsel aus `QUIZ`; richtig gibt +10;
    - 1: Tipp;
    - 2: `10 + dayHash % 21` Ludins.
  - Danach `flasche=true`, speichern.
  - Tagesaufgaben: Das Aufgaben-Angebot in Task 6 nimmt den Fisch aus `dayHash(key+id)` statt aus `Math.random`.

- [ ] **Step 1: Failing tests.**
  - `Tagesfisch: zählt doppelt`:
    1. Datum fest.
    2. Fischbuch öffnen und den Namen hinter „Tagesfisch heute:“ lesen.
    3. Diesen Fisch mit `value:10` in den Eimer seeden.
    4. Bei Rosa verkaufen.
    5. Erwartet: +20.
  - `Flaschenpost: einmal pro Tag`:
    1. Ort für den festen Tag: `FLASCHE_SPOTS` aus `index.html` lesen und den `dayHash` im Test nachrechnen, mit derselben FNV-1a-Formel wie in Interfaces.
    2. Knopf „🍾 Flaschenpost“ → öffnen → `tag.flasche===true`.
    3. Neu laden: Der Knopf erscheint nicht mehr.
    4. Am nächsten Tag (Uhr +1 Tag) erscheint er wieder an einem anderen oder demselben Ort.
  - `Alter Spielstand: tag bekommt Startwert`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:**
  - NEWS v39 „Jeden Tag neu“.
  - CLAUDE.md um einen Punkt „Animal-Crossing-Welt“ ergänzen. Er nennt `WT`/`updateWorldTime`, Öffnungszeiten, `zeit`, Nachbar-ids nie ändern, `state.museum/nachbarn/aufgaben/tag` und `window.__test` (nur bei `navigator.webdriver`).
  - IDEEN.md abhaken.
  - `npm test`, commit.
