# Riesen-Karpfen Angelina – Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Am Heimat-See beißt mit der Grundrute ganz selten Angelina, ein Riesen-Karpfen. Es gibt ein Erinnerungs-Foto und Ludins, dann schwimmt sie zurück (NEWS v44).

**Architecture:** Alles in `index.html`. Neue Konstante `ANGELINA` und ein neues Spielstand-Feld `state.angelina`. In `catchFish()` entscheidet `angelinaBeisst()` vor `chooseFish()`, ob statt eines normalen Fisches die Karte `showAngelina()` kommt. Angelina ist keine Fischart: `FISH`, `state.book` und der Eimer bleiben unberührt.

**Tech Stack:** eine HTML-Datei, Three.js r128 (global `THREE`), Tests mit node:test und Playwright in `tests/spielstand.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-11-angelina-riesenkarpfen-design.md`

## Global Constraints
- Alle Texte auf Deutsch, kurz, für Kinder von 7–9 Jahren. Wortlaut wie in der Spec.
- `SAVE_VERSION` bleibt 2. Kein localStorage-Schlüssel ändert sich, kein Feld wird gelöscht. Unbekannte Zusatzfelder in `state.angelina` bleiben erhalten.
- Alles, was aus dem Spielstand kommt (z. B. `state.avatar.name`), nur mit `esc()` ins HTML.
- Knöpfe mindestens 60 px hoch (`.b` erfüllt das schon).
- Keine Länge in cm für Angelina. Kein neues Foto, kein neuer `FISH`-Eintrag.
- Werte: `ANGELINA={chance:0.04,first:100,again:20}`.
- Ludins nur mit `earn(n)` gutschreiben.
- Neue Test-Hilfen in `window.__test` nur im vorhandenen `navigator.webdriver`-Block.
- Tests: Zeit nie mit `ctx.clock.setFixedTime` stellen; `newPage()` stellt die Uhr auf heute 11 Uhr. Jede Seite mit `ctx.close()` schließen, `errors` muss leer sein.
- Vor jedem Commit: `cd tests && npm test` (alle grün). Für schnelle Runden vorher nur die neuen Tests: `node --test --test-name-pattern="Angelina" spielstand.test.mjs`.
- Commits auf Deutsch, mit den Zeilen
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` und
  `Claude-Session: https://claude.ai/code/session_01X3EUKLaGJioSPyZ4H9ayTr`.

## Review Focus
1. Neuladen, während die Angelina-Karte offen ist: Fang und Ludins sind genau einmal gespeichert, heute kommt sie nicht noch einmal. (Test in Task 1)
2. Avatar ohne Namen (`name:''`): das Foto zeigt „Du“ statt einer leeren Zeile. (Test in Task 1)
3. Avatar-Name mit HTML: kein eingeschleustes Element im Foto. (Test in Task 1)
4. Angelina mit vollem Eimer bis auf einen Platz: der Eimer bleibt gleich, kein „Eimer voll“-Toast. (Test in Task 1, Eimer prüfen)
5. Kaputtes `state.angelina` (kein Objekt, `n:'viel'`, `day:5`): wird repariert, kein Absturz. (Test in Task 1)

---

### Task 1: Angelina beißt, Fang-Karte, Spielstand

**Files:**
- Modify: `index.html` (Startwert in `state` ~Z. 531; Prüfung nach `state.ideen=cleanIdeen(state.ideen);` ~Z. 650; `catchFish()` ~Z. 1844; neue Funktion `showAngelina()` direkt nach `showCatch()` ~Z. 2160; CSS bei `.ideenSticker` ~Z. 243; `window.__test` ~Z. 4754)
- Test: `tests/spielstand.test.mjs` (am Ende anhängen)

**Interfaces:**
- Produces:
  - `const ANGELINA={chance:0.04,first:100,again:20}`
  - `state.angelina={n:0,first:'',day:''}` (nach dem Laden geprüft)
  - `angelinaBeisst(): boolean`: `atLake() && fishing.method==='grund' && state.angelina.day!==todayKey() && Math.random()<ANGELINA.chance`
  - `showAngelina(): void`: speichert den Fang und öffnet die Karte
  - `window.__test.fang()`: setzt `fishing.method=methodNow()`, `fishing.target` auf `findWater()` (wenn es Wasser gibt) und ruft `catchFish()` auf

- [ ] **Step 1: Write the failing tests** (am Ende von `tests/spielstand.test.mjs`)

Hilfen:
```js
const SEE_WURF = { x: 10, z: -940, f: 0, boat: false }; // Südufer, Blick auf den See
const gestern = page => page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
const heute = page => page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
async function angelinaSeite(extra = {}) { // am See, Grundrute in der Hand, Zufall = Treffer
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, methods: { spin: false, grund: true }, method: 'grund', where: SEE_WURF, ...extra }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.evaluate(() => { Math.random = () => 0.01; });
  return { ctx, page, errors };
}
```

Tests (Namen beginnen alle mit „Angelina:“):
- `'Angelina: alter Spielstand bekommt den Startwert, kaputte Werte werden repariert'`
  - Seed ohne `angelina` → `s.angelina` deepEqual `{ n: 0, first: '', day: '' }` (nach `playAndLeave`).
  - Seed `angelina: 'kaputt'` → Startwert.
  - Seed `angelina: { n: 'viel', first: 5, day: '2026-13', extra: 'bleibt' }` → `n === 0`, `first === ''`, `day === ''`, `extra === 'bleibt'`.
- `'Angelina: am See mit der Grundrute kommt die Karte, +100 Ludins, Eimer und Fischbuch bleiben gleich'`
  - Seed mit `ludins: 345` und einem Eimer aus 14 Hechten (`{ id: 'hecht', cm: 60, value: 40 }`). `ALT_V1` hat `hasBucket:false`, also `bucketMax()` = 15: ein Platz frei.
  - `await page.evaluate(() => window.__test.fang())`
  - `#card h2` enthält „Angelina“; `#card .angelinaFoto` sichtbar; Text enthält „52 kg“ und „Schuppenkarpfen“; Knopf `#angelinaOk` Text „Zurück ins Wasser (+100 Ludins)“.
  - Ohne Klick gelesen: `s.angelina.n === 1`, `s.angelina.first === heute`, `s.angelina.day === heute`, `s.ludins === 445`, `s.bucket` gleich wie vorher, `s.book` deepEqual `ALT_V1.book`.
  - Klick `#angelinaOk` → `#modal` versteckt, Toast enthält „Tschüss, Angelina!“; Eimer unverändert; kein Text „Eimer voll“ im Toast.
- `'Angelina: mit der Pose oder am Amazonas kommt sie nicht'`
  - `angelinaSeite({ method: 'pose' })` → `fang()` → `#card h2` enthält „gefangen“ und nicht „Angelina“.
  - Seed mit Grundrute ohne `where` (Start am Amazonas) und `Math.random = () => 0.01` → keine Angelina.
- `'Angelina: einmal am Tag, am nächsten Tag wieder, beim zweiten Mal +20'`
  - `angelinaSeite({ angelina: { n: 1, first: '2026-10-01', day: heute } })` → `fang()` → keine Angelina (normale Fang-Karte).
  - `angelinaSeite({ ludins: 345, angelina: { n: 1, first: '2026-10-01', day: gestern } })` → `fang()` → Knopf „(+20 Ludins)“, Text „Du hast sie schon 2-mal gefangen!“; `s.ludins === 365`, `s.angelina.n === 2`, `s.angelina.first === '2026-10-01'`.
  - (`heute`/`gestern` vor dem Seed auf derselben Seite ausrechnen: erst `page.goto(base + '/leer')`, dann die Hilfe aufrufen.)
- `'Angelina: Neuladen bei offener Karte zählt genau einmal'`
  - `angelinaSeite({ ludins: 345 })` → `fang()` → Karte offen → `page.reload()` → Startknopf → `s.ludins === 445`, `s.angelina.n === 1` → `Math.random = () => 0.01` → `fang()` → normale Fang-Karte (keine Angelina).
- `'Angelina: Erinnerungs-Foto zeigt Namen sicher, ohne Namen „Du“'`
  - `avatar: { ...ALT_V1.avatar, name: '<img class="eingeschleust" src="x" onerror="window.__pwn=1">' }` → `fang()` → `#card .eingeschleust` count 0, `window.__pwn` undefined, `.angelinaName` enthält `<img` als Text.
  - Avatar mit `name: ''` → `.angelinaName` Text beginnt mit „Du“.

- [ ] **Step 2: Run the new tests, expect FAIL**

Run: `cd tests && node --test --test-name-pattern="Angelina" spielstand.test.mjs`
Expected: FAIL (`window.__test.fang is not a function`, `angelina` fehlt im Spielstand)

- [ ] **Step 3: Implement in `index.html`**
- Startwert `angelina:{n:0,first:'',day:''}` in `state` (hinter `ideen:[]`).
- Prüfung nach `state.ideen=cleanIdeen(state.ideen);`, im Stil von `state.heute`:
  `{const a=state.angelina;state.angelina=isObj(a)?Object.assign(a,{n:num(a.n),first:dayOk(a.first),day:dayOk(a.day)}):{n:0,first:'',day:''};}`
- `ANGELINA` und `angelinaBeisst()` neben `catchFish()`.
- `catchFish()`: als erste Zeile `if(angelinaBeisst()){splash(fishing.target.x,fishing.target.z,true);sfxSplash();sfxCatch();stopFishing();showAngelina();return;}` (kein Schul-Zähler, kein Fluss-Stempel, kein Fischbuch).
- `showAngelina()`:
  - zuerst speichern: `n` +1, `day=todayKey()`, `first` setzen, wenn leer; `earn(n===1?ANGELINA.first:ANGELINA.again)`; `save()`; `refreshHud(true)`.
  - `openModal()`, `card.className='card catch angelina'`.
  - Inhalt in dieser Reihenfolge: `h2` „🏆 Du hast Angelina gefangen!“; Rahmen `div.angelinaFoto` mit `div.pface` (Hintergrund `state.avatar.skin`, Rand `state.avatar.shirt`, wie in `showRanking`) und `fishPic(FISH_BY.karpfen)`; darunter `div.angelinaName` mit `esc(state.avatar.name||'Du')+' · '+Datum` (Datum `TT.MM.JJJJ` mit `pad2`); `div.stats` mit „52 kg“ und „Schuppenkarpfen“; `p` mit dem Fakten-Text aus der Spec (wörtlich); ab `n>=2` `p` „Du hast sie schon N-mal gefangen!“; `div.btns` mit `button.b.go#angelinaOk` „Zurück ins Wasser (+100 Ludins)“ bzw. „(+20 Ludins)“.
  - Klick: `closeModal()`, `splash(...)` vor dem Spieler wie bei „Freilassen“, `toast('Tschüss, Angelina! Bis bald.')`, `afterCatch()`.
- CSS: `.angelinaFoto` goldener Rahmen (`border:4px solid var(--gold)`, abgerundet, Avatar-Kreis und Foto nebeneinander); `.angelinaName` fett, mittig.
- `window.__test.fang()` wie unter Interfaces.

- [ ] **Step 4: Run the new tests, expect PASS**

Run: `cd tests && node --test --test-name-pattern="Angelina" spielstand.test.mjs`
Expected: alle „Angelina:“-Tests PASS

- [ ] **Step 5: Run all tests**

Run: `cd tests && npm test`
Expected: alle grün (6 neue Tests mehr als vorher)

- [ ] **Step 6: Commit**

```bash
git add index.html tests/spielstand.test.mjs
git commit -m "Angelina: Riesen-Karpfen beißt am Heimat-See mit der Grundrute"
```

---

### Task 2: Sticker im Fischbuch, NEWS v44, CLAUDE.md

**Files:**
- Modify: `index.html` (`showBook()` Kopfzeile ~Z. 2180; `NEWS` oben ~Z. 4497)
- Modify: `CLAUDE.md` (Abschnitt „Heimat-See“, Spiegelstrich am Anfang der Spielidee)
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `state.angelina.n` aus Task 1.
- Produces: `.angelinaSticker` in der Fischbuch-Kopfzeile; NEWS-Eintrag `v:44`.

- [ ] **Step 1: Write the failing tests**
- `'Angelina: Sticker im Fischbuch erst nach dem ersten Fang'`
  - Für `[[0, null], [1, '🏆 Angelina: 1× gefangen'], [2, '🏆 Angelina: 2× gefangen']]`: Seed `angelina: { n, first: n ? '2026-11-01' : '', day: n ? '2026-11-01' : '' }`, `#btnBook`, warten auf `#card h2:text-is("Fischbuch")`, `#card .angelinaSticker` count 0 bzw. Text gleich.
- `'Angelina: NEWS v44 steht ganz oben'`: `const n = newsListe()[0]` → `n.v === 44`, `n.t === 'Riesen-Karpfen Angelina'`, `n.ico === '🏆'`. Der vorhandene Test am Dateiende (~Z. 4159, prüft heute v43 als obersten Eintrag) wird so geändert, dass er v43 per `newsListe().find(n => n.v === 43)` sucht; im Bericht nennen.

- [ ] **Step 2: Run, expect FAIL**

Run: `cd tests && node --test --test-name-pattern="Angelina" spielstand.test.mjs`
Expected: FAIL (kein `.angelinaSticker`, oberster Eintrag ist v43)

- [ ] **Step 3: Implement**
- In `showBook()` nach dem Ideen-Sticker: `if(state.angelina.n>0)kopf.appendChild(el('span','ideenSticker angelinaSticker','🏆 Angelina: '+state.angelina.n+'× gefangen'));`
- `NEWS` ganz oben: `{v:44,day:'11.11.2026',ico:'🏆',t:'Riesen-Karpfen Angelina',d:'Im Heimat-See lebt Angelina, ein Riesen-Karpfen! Mit der Grundrute kannst du sie fangen – wenn du Glück hast.'}`
- `CLAUDE.md`, Spiegelstrich „Heimat-See“, neue Zeile: „**Angelina** (Riesen-Karpfen, `ANGELINA`, `showAngelina`): beißt nur am Heimat-See mit der Grundrute, höchstens einmal am Tag (`state.angelina`: `n`, `first`, `day`). Keine Fischart, kein Eimer, keine cm. Erinnerungs-Foto, dann zurück ins Wasser (+100 Ludins, danach +20). Fakten: echter Schuppenkarpfen in Ungarn, 52 kg (2026).“

- [ ] **Step 4: Run new tests, expect PASS; then all tests**

Run: `cd tests && node --test --test-name-pattern="Angelina|Neu" spielstand.test.mjs` → PASS, dann `npm test` → alle grün.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/spielstand.test.mjs CLAUDE.md
git commit -m "Angelina: Sticker im Fischbuch und Was-ist-neu v44"
```
