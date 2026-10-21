# Stadtwelt Hafenhausen – Bauanleitung (Version 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Ziel:** Eine Fantasie-Stadt „Hafenhausen“ als neues Gebiet. Man kommt mit dem Flugzeug hin, sieht viele Menschen und fährt mit Fahrrad, Roller, Skateboard, Cyber-Truck und Straßenbahn.

**Architektur:**
- Wie beim Flussplatz: Ein Gebiet weit im Süden der bestehenden Welt (`CITY`, z ≈ −3000) mit eigener Höhenfunktion (`cityHeight`) und eigener Hindernisliste (`cityCols`).
- Die Stadt wird beim ersten Besuch einmal gebaut (`buildCity`).
- Fahrzeuge sind ein neuer „Fahr-Zustand“ des Spielers (`player.ride`), so ähnlich wie `player.inBoat`.

**Technik:** Eine einzige `index.html`, Three.js r128 als globales `THREE`. Tests mit node:test + Playwright in `tests/spielstand.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-10-21-hafenhausen-stadtwelt-design.md` (freigegeben am 21.10.2026)

## Global Constraints

- Alles steckt in `index.html`. Three.js bleibt r128. Kein `import`, kein npm im Spiel.
- Spielstand: neues Feld nur mit Startwert:
  `city:{visited:false,vehicles:{bike:true,roller:false,skate:false,truck:false},parked:{},riding:''}`.
  `SAVE_VERSION` bleibt 2. Kein Feld wird gelöscht. Der Schlüssel `amazonas-angler-1` bleibt unverändert.
- Vor jedem Commit, der `index.html` ändert: `cd tests && npm test`, alles grün.
- Neue Funktion bedeutet einen `NEWS`-Eintrag ganz oben. v27 heißt „Hafenhausen“ mit Datum `21.10.2026`. Spätere Tasks ergänzen ihn nicht, sie schreiben ihn nur um, wenn nötig.
- Jugendschutz:
  - kein Firmenlogo, keine Marken („Cyber-Truck“ ist nur ein Name);
  - kein echtes Geld;
  - keine Unfälle und kein Schaden: Fahrzeuge halten an Hindernissen und Menschen einfach an;
  - keine Links ins Internet.
- Knöpfe mindestens 60 px. Texte auf Deutsch, kurze Sätze. Hinweise mit `toast()` (die Dauer passt sich schon an die Länge an).
- Tempo in m/s:
  - Laufen 5,5
  - Fahrrad 11
  - Roller 8
  - Skateboard 8
  - Cyber-Truck 20
  - Straßenbahn 6
- Preise:
  - Fahrrad geschenkt
  - Roller 60 Ludins
  - Skateboard 60 Ludins
  - Cyber-Truck 800 Ludins
  - Straßenbahn kostenlos
- Die Straßenbahn hält 6 s an jeder der 4 Haltestellen: `flugplatz`, `markt`, `hafen`, `park`.
- Menschen: 24 Stück. Sie bewegen sich nur, wenn der Spieler näher als 80 m ist.
- Commit-Nachrichten sind deutsch und enden mit den Zeilen `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` und `Claude-Session: https://claude.ai/code/session_01X3EUKLaGJioSPyZ4H9ayTr`.

## Review Focus

1. **Speichern beim Fahren und Neuladen:** Man steht nach dem Laden zu Fuß. Das Fahrzeug steht da, wo man war. Man steckt nie in einem Haus fest. Test kommt in Task 2.
2. **Wegfliegen oder Avatar-Werkstatt öffnen beim Fahren:** Erst absteigen und das Fahrzeug parken. Danach ist `player.ride` leer. Tests kommen in Task 2 (Werkstatt) und Task 4 (Flug aus der Bahn).
3. **Angel-Knopf in der Stadt:** zeigt den Hinweis „Angeln kannst du in der Angelwelt. Flieg zurück!“. Es gibt keinen Wurf und keinen Fehler. Test kommt in Task 1.
4. **Kaputter `city`-Wert im alten Spielstand** (zum Beispiel `city:"x"` oder `parked:{truck:{x:'a'}}`): Das Spiel lädt ohne Fehler und nimmt die Startwerte. Test kommt in Task 1.
5. **Fahrzeug fährt gegen einen Menschen oder ein Haus:** Es bleibt stehen. Der Mensch wird nicht geschoben, es gibt keinen Fehler. Test kommt in Task 2.

---

### Task 1: Die Stadt Hafenhausen (Gebiet, Anreise, Menschen, Karte, Spielstand)

**Dateien:**
- Ändern: `index.html`, und zwar
  - die Welt-Formeln um `DE` (Zeile ~585–615);
  - `inBounds` und `hitsCollider` (~1164–1171);
  - `fishPress` (~1256);
  - die Prüfung des Spielstands (~470–500);
  - `PLANES` (~2151);
  - `showGermany`, `flyTo` (~2646–2700);
  - `mapMarkers`, `showMap` (~2769–2850);
  - `NEWS` (~2853);
  - den Ort beim Laden (~2905–2915).
- Test: `tests/spielstand.test.mjs`

**Schnittstellen:**
- Erzeugt:
  - `const CITY={x:0,z:-3000,zone:-2400,w:150,l:150}`
  - `atCity():boolean` (z < `CITY.zone`)
  - `atDE()` ist neu `z<DE.zone&&!atCity()`
  - `cityHeight(x,z):number`. Straßen, Plätze und Häuser liegen bei 1,2. Im Süden fällt das Land am Hafen (z < `CITY.z`−110) auf −2,6 ab.
  - `let cityBuilt=false`
  - `buildCity():void`, baut nur einmal
  - `const cityCols=[]`
  - `const STOP_FLUGPLATZ={x:…,z:…}`, `STOP_MARKT`, `STOP_HAFEN`, `STOP_PARK` als reine Zahlen. Dazu `const STOPS={flugplatz:STOP_FLUGPLATZ,markt:STOP_MARKT,hafen:STOP_HAFEN,park:STOP_PARK}`. Das sind die Haltestellen, Task 4 braucht sie.
  - `const CITY_LAND={x:-125,z:-3010,f:1.5708}`
  - Test-Helfer `stadtWert(name)` in `tests/spielstand.test.mjs`
  - `const CITY_ROADS`: Liste von Rechtecken `{x0,x1,z0,z1}` für Straßen und Plätze. Task 2 braucht sie.
  - `onRoad(x,z):boolean`
  - `PLANES[3]={id:'city',x,z,land:{x,z,f},label:'✈️ Fliegen'}`
  - `flyTo('city')`
  - `state.city` mit den Startwerten oben
- Nutzt aus dem bestehenden Code: `buildAvatar`, `bx`, `cy`, `cn`, `ball`, `gable`, `grp`, `house`, `makeSign`, `makePlane(x,z,rot,parent,cols)`, `rng`, `mat`, `vcMat`, `toast`, `TIAGO`.

- [ ] **Schritt 1: Tests schreiben, die noch fehlschlagen.** Ans Ende von `tests/spielstand.test.mjs`.

```js
test('Hafenhausen: hinfliegen, Ort bleibt gespeichert, Angeln geht dort nicht', async () => {
  // const VX = 10 * Math.sin(1) + 24;   // wie im Spiel: riverX(0)+24
  // Seed: { ...ALT_V1, v:2, newsSeen:999, bucket:[], where:{ x: VX + 13 - 3.4, z: 1, f: Math.PI/2, boat:false } }  // 3,4 m neben dem Dorf-Flugzeug
  // '#btnGo' → warte '#btnCtx:has-text("Fliegen")' → klick '#btnCtx' → '#deMap' sichtbar → klick '[data-dest="city"]'
  // waitForFunction: JSON.parse(localStorage[KEY]).where.z < -2400
  // '#flight' wird hidden
  // klick '#btnFish' → '#toast' enthält 'Angeln kannst du in der Angelwelt'
  // pagehide, neu laden, '#btnGo', pagehide → where.z < -2400, city.visited === true
  // errors leer
});
test('Hafenhausen: kaputter city-Wert im alten Spielstand wird repariert', async () => {
  // Seed: { ...ALT_V1, v:2, newsSeen:999, city:'x' } → Spiel startet, '#btnGo', pagehide
  // city deepEqual {visited:false,vehicles:{bike:true,roller:false,skate:false,truck:false},parked:{},riding:''}
  // zweiter Seed: city:{vehicles:{truck:'ja'},parked:{truck:{x:'a',z:1}},riding:'rakete'}
  //   → vehicles.truck === false, parked.truck === undefined, riding === ''
  // errors leer
});
```

Die Tests lesen feste Stellen aus der Stadt mit einem kleinen Helfer aus `index.html`:
`stadtWert(name)` holt per Regex `const <name>={x:<zahl>,z:<zahl>…}` und gibt `{x,z,f?,r?}` zurück.
Deshalb stehen diese Konstanten in `index.html` als **reine Zahlen**, ohne Rechnung:
- `CITY_LAND={x:-125,z:-3010,f:1.5708}` (Landeplatz)
- `SHOP_AT` (vor dem Fahrzeug-Laden, Task 2)
- `TEST_HOUSE` (Task 2)
- die 4 `STOPS`

`PLANES[3].land` ist `CITY_LAND`.

- [ ] **Schritt 2: Tests laufen lassen, sie müssen fehlschlagen.**
  Befehl: `cd tests && node --test --test-name-pattern="Hafenhausen" spielstand.test.mjs`
  Erwartet: FAIL, weil `[data-dest="city"]` nicht gefunden wird und `city` undefined ist.

- [ ] **Schritt 3: Gebiet und Höhe einbauen.**
  - `CITY`, `atCity`, `cityHeight` kommen **vor** `heightAt`. Die erste Zeile von `heightAt` wird `if(z<CITY.zone)return cityHeight(x,z);`.
  - `atDE` bekommt `&&!atCity()`.
  - `inBounds` bekommt den Teil `(cityBuilt&&Math.abs(x-CITY.x)<CITY.w-6&&Math.abs(z-CITY.z)<CITY.l-6)`.
  - In `hitsCollider` kommt vor der DE-Zeile: `if(z<CITY.zone)return hitsList(cityCols,x,z,r);`.

- [ ] **Schritt 4: `buildCity()` schreiben.** Sie steht im neuen Abschnitt `/* ---- Hafenhausen ---- */` nach `buildHannes`.
  - **Boden:** eine Fläche 300×300 m mit Farben: Straße `#6b6f73`, Gehweg `#b9b4a8`, Wiese `#5a8f3a`, Hafen-Wasserkante `#b9a77a`. Höhen aus `cityHeight`.
  - **Straßengitter:** 4×4 Blöcke. Straßen sind 10 m breit, die Blöcke 50 m. Die Straßen stehen in `CITY_ROADS`, `onRoad(x,z)` prüft sie.
  - **Zebrastreifen:** weiße Boxen an den Kreuzungen um den Marktplatz.
  - **Marktplatz** in der Mitte (40×40 m) mit Brunnen aus `cy` und blauer Wasserscheibe.
  - **Park** im Nordosten-Block mit Teich und Bäumen. Nimm `treeC`/`BIRKE` als `InstancedMesh` mit `userData.shared=true`.
  - **Hafen:** Kaimauer, 3 Fischerboote (Boxen) und ein Leuchtturm. Den Leuchtturm-Code aus `LOOKS.leuchtturm` darfst du in eine Funktion `lighthouse(g,x,z)` herausziehen und an beiden Stellen nutzen.
  - **Häuser:** in jedem Block 4–6 Stück mit `house()` und den Farben `WALLS`/`ROOFS`. Jedes Haus kommt in `cityCols` mit r = halbe Breite + 0,3.
  - **Läden:** 3 mit `makeSign('Bald geöffnet','Laden', …)` und 1 mit `makeSign('Fahrzeuge','Laden', …)`. Diesen braucht Task 2.
  - **Flugplatz** am Westrand: graue Fläche, Flugzeug `makePlane(x,z,rot,cityGroup,cityCols)`. `PLANES[3]` bekommt `x`, `z`, `land`.
  - **Schild „Hafenhausen“** am Flugplatz, es schaut zum Landeplatz (Drehung wie beim See-Schild: `Math.atan2(dx,dz)`).
  - **Schild am Hafen:** „Angeln? In der Angelwelt!“.
  - **Haltestellen** `STOPS`: je ein Schild „🚋 Markt“ usw. und ein Dach (Box auf 2 Pfosten).
  - Am Ende `cityBuilt=true`.

- [ ] **Schritt 5: 24 Menschen einbauen.** `const people=[]`, je `{g, path:[{x,z},…], i, t, speed}`.
  - Wege laufen nur auf Gehwegen (Rand der `CITY_ROADS` ± 6 m).
  - Gebaut mit `buildAvatar` und Farben aus `SKINS`, `SHIRTS`, `PANTS`, `HAIRCOLS`, `HATS`.
  - `updatePeople(dt,t)` wird in `loop()` aufgerufen. Es tut nur etwas, wenn `atCity()` ist und der Abstand unter 80 m liegt.
  - Die Menschen laufen mit 1,2 m/s zum nächsten Wegpunkt, Beine wie in `updatePlayer`. Alle 6–12 s winkt jemand mit `arms[1].rotation.z` für 1,5 s.
  - **Kollision:** Jeder Mensch steht als `{x,z,r:0.5}` in `peopleCols`. `hitsCollider` prüft in der Stadt `cityCols` **und** `peopleCols`.

- [ ] **Schritt 6: Anreise einbauen.**
  - `showGermany('fly')` bekommt nach „🏞️ Heimat-See“ den Knopf `go('🏙️ Hafenhausen'…,'city',here==='city')`. `here` wird `atCity()?'city':atDE()?'de':…`.
  - `flyTo(dest)` bekommt den Zweig `dest==='city'`: Dann `buildCity()`, `l=PLANES[3].land`, `state.city.visited=true`, `camPitch=0.1`.
  - Begrüßung: „Willkommen in Hafenhausen! Dein Fahrrad steht am Flugplatz.“.
  - `planeNear` lässt `PLANES[3]` nur zu, wenn `cityBuilt` ist.
  - Nebel wie am Fluss: Die Bedingung `focusZ<DE.zone` deckt die Stadt schon mit ab, weil −3000 < −1300.

- [ ] **Schritt 7: Angeln sperren.**
  - In `fishPress` ganz oben: `if(atCity()){toast('Angeln kannst du in der Angelwelt. Flieg zurück!');return;}`.
  - In `updateCtx`: `placetrap` nur, wenn `!atCity()`.
  - In `tipText`: In der Stadt kommt zuerst der Satz `'Willkommen in Hafenhausen! Steig auf dein Fahrrad am Flugplatz.'`, solange `!state.city.parked.bike` ist. Danach kommt `''`.

- [ ] **Schritt 8: Spielstand.**
  - `state` bekommt das Feld `city:{visited:false,vehicles:{bike:true,roller:false,skate:false,truck:false},parked:{},riding:''}`.
  - Die Prüfung beim Laden steht nach der `fluss`-Prüfung:
    - `city` ist kein Objekt: Startwert nehmen.
    - `vehicles`: für jede bekannte id nur `true` übernehmen, sonst `false`. `bike` ist immer `true`.
    - `parked[id]`: nur behalten, wenn `x`, `z` und `yaw` endliche Zahlen sind und `id` bekannt ist. Sonst `delete parked[id]`. Das ist ein Eintrag in einer Liste, kein `state`-Feld.
    - `riding`: muss eine bekannte id oder `'tram'` sein, sonst `''`.
  - Die bekannten ids stehen in `const VEHICLE_IDS=['bike','roller','skate','truck']`. Task 2 macht daraus `VEHICLES`.
  - **Ort beim Laden:** vor `if(w.z<DE.zone&&…)` kommt `if(w.z<CITY.zone)buildCity();`.

- [ ] **Schritt 9: Karte.**
  - `mapMarkers` bekommt in der Stadt die Haltestellen (🚋) und den Fahrzeug-Laden (🛒). Geparkte Fahrzeuge kommen in Task 2 dazu.
  - `showMap()`: in der Stadt `if(atCity()){showCityMap();return;}`.
  - `showCityMap()` malt einen Stadtplan, Norden oben, mit `paintTerrain`. Darauf die Marker und der rote Pfeil (`drawMe`). Unten der Knopf „Fertig“.
  - Die kleine Karte (`drawMini`) funktioniert schon über `heightAt`. Straßen sind dort Land, das passt.

- [ ] **Schritt 10: NEWS v27.**
  `{v:27,day:'21.10.2026',ico:'🏙️',t:'Hafenhausen',d:'Mit dem Flugzeug fliegst du jetzt in die Stadt Hafenhausen. Dort gibt es einen Hafen, einen Markt und viele Menschen. Dein Fahrrad wartet am Flugplatz!'}`

- [ ] **Schritt 11: Tests laufen lassen, sie müssen jetzt bestehen.**
  - Befehl: `cd tests && node --test --test-name-pattern="Hafenhausen" spielstand.test.mjs`. Erwartet: beide PASS.
  - Danach `npm test`. Erwartet: alle PASS, das sind 29 alte und 2 neue.

- [ ] **Schritt 12: Bild prüfen.**
  - Ein Screenshot-Skript nach dem Muster von `see/shot12.mjs` (im Scratchpad) zeigt die Stadt bei 1024×768 vom Landeplatz aus.
  - Prüfen: Häuser, Straßen und Menschen sind zu sehen, keine Fehler in der Konsole.

- [ ] **Schritt 13: Commit.**
  `git add index.html tests/spielstand.test.mjs && git commit` mit der Nachricht „Hafenhausen: neue Stadtwelt mit Hafen, Markt und Menschen“ und den Abschlusszeilen.

---

### Task 2: Fahrrad, Roller, Skateboard, Fahrzeug-Laden, Parken

**Dateien:** Ändern `index.html`:
- Abschnitt Hafenhausen
- `updatePlayer` (~1177)
- `updateCtx` und der Klick-Handler (~1705–1740)
- `openCreator` (~1792)
- `saveWhere` und der Ort beim Laden (~2899–2915)
- `mapMarkers`

Test: `tests/spielstand.test.mjs`.

**Schnittstellen:**
- Nutzt: `CITY_ROADS`, `onRoad`, `cityCols`, `peopleCols`, `atCity`, `buildCity`, `state.city`, `VEHICLE_IDS`.
- Erzeugt:
  - `VEHICLES`:

    ```js
    const VEHICLES={bike:{name:'Fahrrad',ico:'🚲',price:0,speed:11,turn:6,on:'Aufsteigen',off:'Absteigen'},
      roller:{name:'Roller',ico:'🛴',price:60,speed:8,turn:8,on:'Aufsteigen',off:'Absteigen'},
      skate:{name:'Skateboard',ico:'🛹',price:60,speed:8,turn:8,on:'Aufsteigen',off:'Absteigen'},
      truck:{name:'Cyber-Truck',ico:'⚡',price:800,speed:20,turn:3,on:'Einsteigen',off:'Aussteigen'}}
    ```

  - `vehMesh[id]`: ein `THREE.Group` je Fahrzeug, in der Stadtgruppe.
  - `vehicleHome(id):{x,z,yaw}` ist der Startplatz: Fahrrad am Flugplatz, die anderen vor dem Fahrzeug-Laden.
  - `vehicleAt(id):{x,z,yaw}` = `state.city.parked[id]||vehicleHome(id)`
  - `mountVehicle(id):void`
  - `dismount():boolean`, false wenn kein Platz zum Absteigen ist
  - `player.ride` ist `''` oder eine Fahrzeug-id
  - `showVehicleShop():void`
  - `buildVehicleMesh(id):THREE.Group`. Das Fahrrad und die Roller sind einfache Boxen und Zylinder. Task 3 ersetzt `truck`.

- [ ] **Schritt 1: Tests schreiben, die noch fehlschlagen.**

```js
test('Hafenhausen: Fahrrad aufsteigen, fahren, absteigen, bleibt geparkt', async () => {
  // const L = stadtWert('CITY_LAND');  Seed: { ...ALT_V1, v:2, newsSeen:999, bucket:[], city:{visited:true}, where:{x:L.x,z:L.z,f:L.f,boat:false} }
  // das Fahrrad steht am Startplatz 2 m neben CITY_LAND; warte '#btnCtx:has-text("Aufsteigen")', klick → '#btnCtx' zeigt 'Absteigen'
  // Taste W 1500 ms gedrückt halten (page.keyboard.down('KeyW') … up)
  // klick '#btnCtx' (Absteigen) → pagehide → s.city.parked.bike hat x,z,yaw; s.city.riding === ''
  // Abstand parked.bike zu vehicleHome > 3 m
  // neu laden, '#btnGo', pagehide → parked.bike gleich wie vorher
  // errors leer
});
test('Hafenhausen: beim Fahren gespeichert und neu geladen steht man zu Fuß', async () => {
  // const L = stadtWert('CITY_LAND');  Seed: city:{visited:true,riding:'bike',parked:{bike:{x:L.x+2,z:L.z,yaw:0}}}, where:{x:L.x+2,z:L.z,f:0,boat:false}
  // '#btnGo' → '#btnCtx' zeigt 'Aufsteigen' (nicht 'Absteigen'), pagehide → city.riding === ''
});
test('Hafenhausen: Roller kaufen im Fahrzeug-Laden, Werkstatt öffnen beim Fahren parkt ihn', async () => {
  // const S = stadtWert('SHOP_AT');  Seed: ludins:100, city:{visited:true}, where:{x:S.x,z:S.z,f:0,boat:false}
  // klick '#btnCtx:has-text("Fahrzeug-Laden")' → '#card .item:has(b:text-is("Roller")) button' → ludins 40, city.vehicles.roller true
  // Laden zu, '#btnCtx:has-text("Aufsteigen")' (Roller steht vor dem Laden), aufsteigen
  // klick '#btnAvatar' → pagehide → city.riding === '', city.parked.roller existiert
});
test('Hafenhausen: Fahrrad fährt nicht durch Häuser', async () => {
  // const H = stadtWert('TEST_HOUSE');  // {x,z,r}: Haus direkt südlich der Flugplatz-Straße
  // Seed: where 4 m nördlich vom Haus {x:H.x, z:H.z+H.r+4, f:Math.PI (Richtung Haus)}, city:{visited:true,parked:{bike:{x:H.x,z:H.z+H.r+4,yaw:Math.PI}}}
  // Aufsteigen, Taste W 2000 ms → pagehide → Math.hypot(where.x-H.x, where.z-H.z) >= H.r
});
```

`SHOP_AT` und `TEST_HOUSE` sind Konstanten, die Task 2 in `index.html` anlegt:
- `SHOP_AT` ist die Stelle vor dem Fahrzeug-Laden.
- `TEST_HOUSE` ist das erste Haus südlich der Straße am Flugplatz, mit seinem Radius `r`.

So kann der Test sie aus `index.html` lesen.

- [ ] **Schritt 2: Tests laufen lassen, sie müssen fehlschlagen.**
  Befehl: `node --test --test-name-pattern="Hafenhausen: (Fahrrad|beim Fahren|Roller)" spielstand.test.mjs`
  Erwartet: FAIL, weil „Aufsteigen“ nicht gefunden wird.

- [ ] **Schritt 3: `VEHICLES`, `buildVehicleMesh`, `vehMesh` einbauen.**
  - Die Meshes baut `buildCity` mit.
  - Sie stehen bei `vehicleAt(id)` und sind nur sichtbar, wenn `state.city.vehicles[id]` wahr ist.

- [ ] **Schritt 4: Fahren in `updatePlayer` einbauen.**
  - Ist `player.ride` gesetzt, nimmt das Spiel `VEHICLES[ride].speed` und `VEHICLES[ride].turn` statt der Boot-Werte.
  - Gefahren wird wie beim Boot entlang `player.facing`.
  - Erlaubt sind die Stellen, an denen `walkable(x,z)` gilt. Der Truck braucht dazu einen Radius von 1,4 statt 0,35: `rideable(x,z,r)=inBounds&&heightAt>0.15&&!hitsCollider(x,z,r)`.
  - Das Fahrzeug-Mesh folgt dem Spieler. Beim Rad und beim Roller sitzt bzw. steht der Avatar darauf: `player.y` wie gehabt, Beine leicht beugen. Beim Truck ist der Avatar unsichtbar, die Kamera hat mehr Abstand (+3).
  - Kein Schieben: Ist der nächste Schritt nicht frei, bleibt man stehen, wie bei `walkable` heute.

- [ ] **Schritt 5: Kontext-Knopf einbauen.**
  - In `updateCtx`, wenn `!player.inBoat&&!player.ride&&atCity()`:
    - eigenes Fahrzeug näher als 2,5 m bedeutet `a='mount:'+id`, Text `VEHICLES[id].ico+' '+VEHICLES[id].on`;
    - Fahrzeug-Laden näher als 4 m (`SHOP_AT`) bedeutet `a='vshop'`, Text `'🛒 Zum Fahrzeug-Laden'`.
  - Wenn `player.ride` gesetzt ist: `exitSpot=findExit()`, dann `a='dismount'`, Text `VEHICLES[ride].off`.
  - Beim Klick: `mountVehicle(id)`, `dismount()` bzw. `showVehicleShop()`.
  - `dismount()` speichert in `state.city.parked[id]` die Stelle `{x,z,yaw}`, setzt den Spieler auf `exitSpot`, dann `player.ride=''`, `state.city.riding=''` und `save()`.

- [ ] **Schritt 6: Speichern und Laden.**
  - `saveWhere` speichert beim Fahren zusätzlich die Fahrzeugstelle in `parked[ride]`.
  - Beim Laden: Ist `state.city.riding` nicht leer, nimmt das Spiel `riding=''`. Der Spieler steht zu Fuß neben dem Fahrzeug, über `findExit()` vom Fahrzeug aus.
  - `openCreator`: Ist `player.ride` gesetzt, zuerst `dismount()`. Klappt das nicht, das Fahrzeug an der Stelle parken und den Spieler 2 m daneben stellen.
  - `flyTo`: Ist `player.ride` gesetzt, wird vorher geparkt und `ride=''` gesetzt.

- [ ] **Schritt 7: Fahrzeug-Laden.**
  - `showVehicleShop()`: Karte mit dem Kopf „Fahrzeug-Laden“.
  - Darin `buyList(items,showVehicleShop)` mit `items` aus `VEHICLES` (Roller, Skateboard, Truck). Jedes Item ist `{name,price,ico,desc,owned:()=>state.city.vehicles[id],buy:()=>{state.city.vehicles[id]=true;}}`. Die Nachrichten sind `'Dein Roller steht vor dem Laden!'` usw.
  - Unten der Knopf „Tschüss“.

- [ ] **Schritt 8: Karte.** `mapMarkers` zeigt in der Stadt die eigenen Fahrzeuge an `vehicleAt(id)` mit ihrem Symbol, aber nur, wenn man nicht gerade damit fährt.

- [ ] **Schritt 9: Tests laufen lassen.**
  Befehl: die 4 neuen Tests, dann `npm test`. Erwartet: alles PASS.

- [ ] **Schritt 10: Commit.** Nachricht: „Hafenhausen: Fahrrad, Roller und Skateboard fahren und parken“.

---

### Task 3: Cyber-Truck

**Dateien:** Ändern `index.html`: `buildVehicleMesh('truck')`, der HUD-Knopf, der Klick-Handler. Test: `tests/spielstand.test.mjs`.

**Schnittstellen:**
- Nutzt: `VEHICLES.truck`, `buildVehicleMesh`, `showVehicleShop`, `mountVehicle`, `player.ride`.
- Erzeugt:
  - HUD-Knopf `#btnHorn` mit dem Text „📯 Hupe“. Er ist nur sichtbar, wenn `player.ride==='truck'`.
  - `horn():void` spielt zwei Töne über `tone` (523 Hz und 659 Hz, je 0,15 s, `'square'`, Lautstärke 0,08).

- [ ] **Schritt 1: Test schreiben, der noch fehlschlägt.**

```js
test('Hafenhausen: Cyber-Truck kaufen, einsteigen, hupen, bleibt nach Neuladen', async () => {
  // Seed: ludins:1000, where vor dem Laden (SHOP_AT)
  // Laden → Truck kaufen → ludins 200, city.vehicles.truck true
  // '#btnCtx:has-text("Einsteigen")' → klick → '#btnHorn' sichtbar → klick (kein Fehler)
  // '#btnCtx' zeigt 'Aussteigen' → klick → '#btnHorn' versteckt
  // pagehide, neu laden, '#btnGo', pagehide → city.vehicles.truck true, ludins 200
  // errors leer
});
```

- [ ] **Schritt 2: Test laufen lassen, er muss fehlschlagen.** Erwartet: FAIL, weil `#btnHorn` nicht existiert.

- [ ] **Schritt 3: Aussehen des Trucks.**
  - Silberner Rumpf `#c9cdd2` aus 3 schrägen Boxen. Das Dach ist eine flache Pyramide, gebaut aus `gable` mit Länge 4,6 und Breite 2.
  - Fenster `#2b2f33`, 4 Räder `#1e1e1e` aus Zylindern.
  - Lichtleiste vorne: weiße Box 2 × 0,08 × 0,08. Rücklicht rot.
  - Kein Logo, keine Schrift.
  - Länge etwa 5,8 m.

- [ ] **Schritt 4: Hupe einbauen.**
  - `#btnHorn` steht in `.actions` vor `#btnCtx`, mit der Klasse `act baitbtn`.
  - `updateCtx` blendet den Knopf ein und aus. Der Klick ruft `horn()`.
  - Menschen in 10 m Nähe winken 1,5 s lang.

- [ ] **Schritt 5: Tests laufen lassen.** Erst den neuen Test, dann `npm test`. Erwartet: alles PASS.

- [ ] **Schritt 6: Bild prüfen.** Screenshot vom Truck vor dem Laden. Er soll silbern und eckig sein, ohne Logo.

- [ ] **Schritt 7: Commit.** Nachricht: „Hafenhausen: Cyber-Truck mit Hupe“.

---

### Task 4: Straßenbahn

**Dateien:** Ändern `index.html`: Abschnitt Hafenhausen, `updateCtx`, `updatePlayer`/`updateCamera`, `saveWhere`, `flyTo`, der Ort beim Laden. Test: `tests/spielstand.test.mjs`.

**Schnittstellen:**
- Nutzt: `STOPS`, `CITY_ROADS`, `buildCity`, `player.ride`, `state.city.riding`.
- Erzeugt:
  - `TRAM_ROUTE`: geschlossene Liste von Punkten `{x,z}` auf den Ring-Straßen um die Innenstadt, durch alle 4 Haltestellen in der Reihenfolge flugplatz → markt → hafen → park.
  - `tram={g,s,stopIdx,wait}`. `s` ist der Weg in Metern auf der Route.
  - `tramPos(s):{x,z,yaw}`
  - `updateTram(dt)`: Tempo 6 m/s. An einer Haltestelle steht die Bahn 6 s mit `wait`.
  - `tramAtStop():string|null` gibt die id der Haltestelle zurück, an der die Bahn gerade steht.
  - `player.ride==='tram'` heißt: Man fährt mit.

- [ ] **Schritt 1: Tests schreiben, die noch fehlschlagen.**

```js
test('Hafenhausen: Straßenbahn einsteigen und an der nächsten Haltestelle aussteigen', async () => {
  // STOPS stehen als einzelne Konstanten STOP_FLUGPLATZ, STOP_MARKT, STOP_HAFEN, STOP_PARK (reine Zahlen) → stadtWert('STOP_FLUGPLATZ')
  // Seed: city:{visited:true}, where:{x:F.x+3,z:F.z,f:0,boat:false}
  // waitFor '#btnCtx:has-text("🚋 Einsteigen")' (timeout 90000, die Bahn kommt rundherum)
  // klick → waitFor '#btnCtx:has-text("Aussteigen")' (timeout 90000) → klick
  // pagehide → where nahe STOPS.markt (Abstand < 8 m), city.riding === ''
  // errors leer
});
test('Hafenhausen: in der Straßenbahn wegfliegen geht nicht, speichern setzt an die letzte Haltestelle', async () => {
  // Seed: city.riding:'tram', where irgendwo auf der Route
  // '#btnGo' → pagehide → city.riding === '', where nahe einer der 4 STOPS (Abstand < 8 m)
});
```

- [ ] **Schritt 2: Tests laufen lassen, sie müssen fehlschlagen.** Erwartet: FAIL, weil „🚋 Einsteigen“ nicht kommt.

- [ ] **Schritt 3: Straßenbahn bauen und fahren lassen.**
  - Wagen: 12 × 2,6 × 3 m, Farbe `#f6c13b` mit weißem Streifen, Fenster, 2 Wagen gekoppelt.
  - Schienen: 2 dunkle Streifen auf dem Boden entlang `TRAM_ROUTE`.
  - Die Bahn ist in `cityCols` als **bewegtes** Hindernis eingetragen: `{x,z,r:3}`, die Stelle wird jedes Bild neu gesetzt.
  - Zur Sicherheit wartet die Bahn, wenn ein Mensch oder der Spieler auf der Route vor ihr steht (Abstand unter 6 m).

- [ ] **Schritt 4: Einsteigen und Aussteigen.**
  - Steht man näher als 6 m an einer Haltestelle und es gilt `tramAtStop()===diese`, zeigt der Knopf „🚋 Einsteigen“.
  - Beim Klick: `player.ride='tram'`, der Avatar ist unsichtbar, die Kamera folgt der Bahn.
  - Steht die Bahn an einer Haltestelle, die nicht die Einstiegs-Haltestelle ist: Der Knopf zeigt „Aussteigen“. Man kommt neben der Haltestelle heraus, mit `findExit` um `STOPS[id]`.
  - `state.city.riding='tram'` beim Fahren, `''` nach dem Aussteigen.

- [ ] **Schritt 5: Speichern und Fliegen.**
  - `saveWhere` speichert während der Bahnfahrt als `where` die **letzte Haltestelle**. `riding` wird dabei auf `''` gesetzt, damit man nach dem Neuladen zu Fuß an der Haltestelle steht.
  - Das Flugzeug ist in der Bahn nicht erreichbar. Weil `updateCtx` während `ride==='tram'` nur „Aussteigen“ anbietet, ist kein Extra-Code nötig.

- [ ] **Schritt 6: Tests laufen lassen.** Erst die neuen Tests, dann `npm test`. Erwartet: alles PASS.

- [ ] **Schritt 7: Commit.** Nachricht: „Hafenhausen: Straßenbahn mit 4 Haltestellen“.

---

### Task 5: Abschluss

**Dateien:** `CLAUDE.md`, `IDEEN.md`. Das Spiel selbst wird nur geändert, wenn die Prüfung einen Fehler findet.

- [ ] **Schritt 1: Bilder prüfen.**
  - Screenshots bei 1024×768 und 768×1024: Stadt vom Flugplatz, Fahrrad, Truck, Straßenbahn, Stadtplan.
  - Prüfen: Knöpfe ≥ 60 px, kein Text abgeschnitten, keine Fehler in der Konsole.
  - **Leistung:** Mit `renderer.info.render.calls` in einem Screenshot-Skript zählen, wie viele Zeichen-Aufrufe die Stadt braucht. Ziel: unter 400. Liegt es darüber, mehr als `InstancedMesh` zusammenfassen und neu messen.

- [ ] **Schritt 2: `CLAUDE.md`.**
  - Unter „Die Spielidee“ kommt ein Punkt „**Stadtwelt Hafenhausen**“ dazu. Er nennt `CITY`, `buildCity`, `VEHICLES` mit Preisen und Tempo, Straßenbahn `STOPS`, `state.city`.
  - Dazu die Regel „Fahrzeug-ids nie ändern“ und den Satz „Cyber-Truck ohne Logo/Marke“.

- [ ] **Schritt 3: `IDEEN.md`.**
  - „Hafenhausen mit Fahrzeugen“ abhaken.
  - Neu eintragen:
    - Menschen mit Aufgaben
    - Läden in Hafenhausen
    - Eigenes Haus in der Stadt
    - Bus
    - Ampeln und Verkehrsregeln
    - Goldschürfen
    - Mehr Menschen in der Angelwelt

- [ ] **Schritt 4: Alle Tests laufen lassen.** `cd tests && npm test`, erwartet: alles PASS.

- [ ] **Schritt 5: Commit und Push.**
  - Nachricht: „Hafenhausen: Anleitung und Ideenliste ergänzt“.
  - Push mit `git push -u origin claude/youthful-fermi-yjzvcg`.
  - Danach den Nutzer fragen, ob ein PR gemacht werden soll.
