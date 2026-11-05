# Ideen-Kiste – Bauanleitung

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kinder schreiben im Spiel Ideen fürs Spiel auf. Erwachsene lesen sie hinter der Rechenaufgabe und teilen sie als Text-Datei.

**Architecture:** Ein neues Spielstand-Feld `state.ideen`. Eine gemeinsame Prüf-Funktion `cleanIdeen` wird beim Laden und beim Lesen fremder Spieler-Plätze benutzt. Die Kinder-Karte startet aus `showHeute`. Die Erwachsenen-Karte startet aus der Avatar-Werkstatt über `adultGate`. Export als `.txt` über `navigator.share`, sonst Download wie bei der Sicherheitskopie.

**Tech Stack:** eine Datei `index.html` (Three.js r128 global, kein Build), Tests in `tests/spielstand.test.mjs` (node:test + Playwright).

**Spec:** `docs/superpowers/specs/2026-11-05-ideen-kiste-design.md`

## Global Constraints

- CLAUDE.md gilt zuerst, besonders **Spielstand**:
  - Schlüssel nie ändern, nichts löschen, `SAVE_VERSION` bleibt 2.
  - Neues Feld mit Startwert und Prüfung beim Laden nach dem SEC-001-Block.
  - Vor jedem Commit `cd tests && npm test`, alles grün.
- Ideen-Text wird **immer mit `esc()`** in HTML gezeigt. In der Datei steht er als reiner Text (UTF-8).
- Werte aus der Spec:
  - `IDEE_THEMEN` = `fisch` 🐟 Fisch, `ort` 🗺️ Ort, `fahrzeug` 🚗 Fahrzeug, `figur` 👤 Figur, `sonst` ✨ Sonstiges.
  - Text höchstens **200** Zeichen; „Abschicken“ erst ab **3** Zeichen nach dem Trimmen.
  - Höchstens **50** ungelesene Ideen pro Spieler (`IDEEN_MAX`).
  - Sticker ab **1** „💡 Erfinder“, ab **5** „💡💡 Ideen-Profi“, ab **10** „🏆 Ideen-König“. Gezählt werden alle Ideen; keine Ludins, kein `earn()`.
- Texte, wörtlich:
  - Dank: **„Danke für deine Idee! Ich gebe sie weiter.“**
  - Volle Kiste: **„Die Ideen-Kiste ist voll. Frag einen Erwachsenen, sie zu leeren.“**
  - Leer: **„Noch keine Ideen.“**
  - Hilfe über dem Feld: **„Schreib deine Idee auf. Du kannst auch das Mikrofon der Tastatur benutzen.“**
- Knöpfe mindestens 60 px. Texte deutsch, kurz, kindgerecht.
- `window.__test` nur bei `navigator.webdriver===true`.
- Uhr in Tests: `newPage(opts)` stellt Date auf heute 11:00 oder `opts.start`; `zeitSeite(iso)` / `festeZeit(ctx,iso)` (fest); `startZeitSeite(iso)` (läuft weiter). ISO immer mit Offset. Zeitstempel aus der Seiten-Uhr, nicht aus Node.
- Nicht `ctx.clock.setFixedTime` benutzen: Das macht die Tests langsam (Timeout-Welle).

## Review Focus

1. **Ein anderer Spieler-Platz ist kaputt** (kein JSON, `ideen` kein Array, HTML im Text): Die Erwachsenen-Ansicht zeigt die anderen trotzdem und stürzt nicht ab. → Test in Task 2.
2. **„Als gelesen markieren“ bei mehreren Spielern** ändert in fremden Plätzen nur `ideen[i].gelesen`. Alle anderen Felder bleiben Zeichen für Zeichen gleich. → Test in Task 2.
3. **Doppeltes Tippen auf „Abschicken“** ergibt nur eine Idee. → Test in Task 1.
4. **Spielzeit läuft ab, während das Kind tippt**: Der Text geht nicht verloren, wenn es schon abgeschickt hat. Nicht abgeschickter Text darf verloren gehen; nichts stürzt ab. → in Task 1 nur prüfen, kein eigener Test.
5. **Teilen wird abgebrochen** (`navigator.share` wirft `AbortError`): keine Fehlermeldung, kein Download. → Test in Task 2 mit gestubbtem `navigator.share`.

---

### Task 1: Ideen aufschreiben, speichern, Sticker

**Files:**
- Modify: `index.html`:
  - `state`-Startwert;
  - Prüfung beim Laden (nach dem `state.heute`-Block, ~Z. 622);
  - `showHeute` (~Z. 2480);
  - `showBook` (~Z. 2146);
  - neue Karte.
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Produces:
  - `const IDEE_THEMEN={fisch:'🐟 Fisch',ort:'🗺️ Ort',fahrzeug:'🚗 Fahrzeug',figur:'👤 Figur',sonst:'✨ Sonstiges'}`
  - `const IDEEN_MAX=50`
  - `cleanIdeen(v):Array<{thema,text,day,gelesen}>` (reine Funktion, nimmt jeden Wert).
    - Kein Array ergibt `[]`.
    - Einträge, die kein Objekt sind oder deren `text` kein String ist, werden übersprungen.
    - Unbekanntes `thema` wird `'sonst'`.
    - `text`: Steuerzeichen außer `\n` entfernen, dann `slice(0,200)`.
    - `day` über `dayOk`.
    - `gelesen` ist genau `true`, sonst `false`.
    - Andere Felder bleiben erhalten.
  - `state.ideen=cleanIdeen(state.ideen)` beim Laden.
  - `ideenOffen():number` = Anzahl der Ideen mit `!gelesen`.
  - `ideenSticker(n):string|''` mit `n` = Anzahl aller Ideen.
  - `showIdee()` öffnet die Karte „💡 Deine Idee“:
    - Schritt Thema: 5 Knöpfe mit `data-thema`.
    - Schritt Text: `#ideeText` (`textarea`, maxlength 200), Zähler `#ideeRest` („noch X Zeichen“), Knopf `#ideeOk` „Abschicken“ (disabled < 3), „Abbrechen“ zurück zu `showHeute`.
    - Bei vollem Stand (`ideenOffen()>=IDEEN_MAX`) nur der Volle-Kiste-Text.
  - Abschicken:
    - `state.ideen.push({thema,text:text.trim(),day:todayKey(),gelesen:false})`, dann sofort `save()`.
    - Danach den Dank zeigen, plus den neuen Sticker, falls er sich geändert hat.
    - Der Knopf wird sofort deaktiviert, damit ein doppeltes Tippen nur eine Idee ergibt.
  - In `showHeute`: Knopf `#btnIdee` „💡 Idee fürs Spiel“ unter den Zeilen, vor „🗺️ Karte“ / „Weiter spielen“.
  - In `showBook`: In der Kopfzeile neben dem Tagesfisch steht der Sticker als `.ideenSticker`, nur wenn es einen gibt.

- [ ] **Step 1: Failing tests**
  - `Ideen-Kiste: Idee mit Thema und Text abschicken, bleibt nach dem Neuladen`:
    1. Spiel starten und die Uhr antippen.
    2. `#btnIdee` antippen, dann `[data-thema="fisch"]`.
    3. In `#ideeText` „Ein Hai im Amazonas“ schreiben und `#ideeOk` antippen.
    4. Erwartet: Der Toast/Text enthält „Danke für deine Idee!“.
    5. `weg(page)` ergibt `ideen.length===1`, `ideen[0]` = `{thema:'fisch',text:'Ein Hai im Amazonas',day:<Seiten-todayKey>,gelesen:false}`.
    6. Nach dem Neuladen gilt das immer noch.
    7. Doppelklick auf `#ideeOk` (zwei schnelle Klicks): Danach gibt es nur 1 neue Idee.
  - `Ideen-Kiste: Abschicken erst ab 3 Zeichen, Zähler zählt herunter`:
    - Bei „ab“ ist `#ideeOk` disabled.
    - Bei „abc“ ist er aktiv.
    - `#ideeRest` zeigt „noch 197 Zeichen“.
  - `Ideen-Kiste: volle Kiste zeigt den Hinweis`: Seed mit 50 ungelesenen Ideen. `#btnIdee` zeigt den Volle-Kiste-Text und kein `#ideeText`.
  - `Alter Spielstand: ideen bekommt Startwert, kaputte Werte werden repariert`:
    - `ALT_V1` ohne `ideen` ergibt `[]`.
    - Seed `ideen:[{thema:'rakete',text:'x'.repeat(300),day:'gestern',gelesen:'ja',extra:1},'quatsch',{text:5}]`.
    - Erwartet: genau 1 Eintrag `{thema:'sonst',text:'x'.repeat(200),day:'',gelesen:false,extra:1}`.
  - `Ideen-Kiste: Sticker bei 1, 5 und 10 Ideen`: Seed mit 1, 5 und 10 Ideen (je eigene Seite). Das Fischbuch zeigt „💡 Erfinder“, „💡💡 Ideen-Profi“ und „🏆 Ideen-König“. Bei 0 Ideen gibt es kein `.ideenSticker`.
  - `Ideen-Kiste: HTML im Ideen-Text wird nicht ausgeführt (Fischbuch)`: Seed mit `text:'<img class="eingeschleust" src="x" onerror="window.__pwn=1">'`. Fischbuch öffnen. Erwartet: 0 `.eingeschleust`, `window.__pwn===undefined`.
- [ ] **Step 2:** FAIL, jeden roten Test einzeln laufen lassen.
- [ ] **Step 3:** Implementieren wie in Interfaces. Danach ein Bildschirmfoto der Karte im Hochformat (768×1024) anschauen.
- [ ] **Step 4:** PASS. Vorhandene Tests bleiben grün, besonders „Heute für dich“, „Leiste oben“ und SEC-001/SEC-006.
- [ ] **Step 5:** Voller `npm test`, dann Commit „Ideen-Kiste: Ideen aufschreiben und Erfinder-Sticker“. Noch keine NEWS (kommt in Task 2).

### Task 2: Ideen für Erwachsene – ansehen, teilen, als gelesen markieren

**Files:**
- Modify: `index.html`:
  - Werkstatt-Knopf neben `#btnTime` (~Z. 305);
  - neue Karte;
  - Export;
  - NEWS;
  - `window.__test`.
- Modify: `CLAUDE.md`, `IDEEN.md`
- Test: `tests/spielstand.test.mjs`

**Interfaces:**
- Consumes: `cleanIdeen`, `IDEE_THEMEN` (Task 1); `adultGate(box,onOk)` (~Z. 2677); `PLAYERS_KEY`, `slotKey(id)` (~Z. 633); `esc`, `dayOk`, `todayKey`.
- Produces:
  - Werkstatt-Knopf `#btnIdeen` „💡 Ideen der Kinder“ (Klasse wie `#btnTime`). Er öffnet die Karte mit `adultGate`.
  - `alleIdeen():Array<{player:string,name:string,ideen:Array}>`:
    - Der aktuelle Spieler kommt aus `state`.
    - Die anderen kommen aus `slotKey(id)` für die ids in `PLAYERS_KEY`. Das ist nur `JSON.parse` in `try`; der Name kommt aus `avatar.name` als Text.
    - `cleanIdeen` auf jeden Platz.
    - Ein kaputter Platz wird übersprungen.
  - Die Karte „💡 Ideen der Kinder“:
    - je Spieler eine Überschrift mit dem Namen (`esc`);
    - ungelesene Ideen oben als `.idee`, neueste zuerst, im Format `<Thema-Symbol> <Datum>: <Text>` mit `esc`;
    - darunter ein zugeklappter Teil „Schon gelesen“.
    - Gibt es keine Ideen, steht dort „Noch keine Ideen.“, und `#ideenTeilen` ist disabled.
  - `ideenText(list):string`:
    - erste Zeile `Ideen aus Amazonas Angler – <TT.MM.JJJJ>`;
    - je Spieler `\n<Name>:\n` und Zeilen `- [<Thema-Wort>] <TT.MM.JJJJ>: <Text>`;
    - nur ungelesene Ideen;
    - reiner Text.
  - `#ideenTeilen` „📤 Als Text-Datei teilen“ mit dem Dateinamen `Ideen-<Name des aktuellen Spielers, wie bei der Sicherheitskopie bereinigt>-<JJJJ-MM-TT>.txt`, Typ `text/plain;charset=utf-8`:
    - Gilt `navigator.canShare?.({files:[file]})`, dann `navigator.share({files:[file],title:'Ideen aus Amazonas Angler'})`. Ein `AbortError` wird still ignoriert.
    - Sonst wird die Datei geladen, wie die Sicherheitskopie (~Z. 2586: Blob und `a.download`).
  - `#ideenGelesen` „Als gelesen markieren“:
    - Beim aktuellen Spieler: `state.ideen[i].gelesen=true`, dann `save()`.
    - Bei jedem anderen Platz: lesen, ausschließlich `ideen[i].gelesen=true` setzen (geprüft mit `cleanIdeen`), zurückschreiben.
    - Andere Felder werden nicht angefasst, ein kaputter Platz wird nicht geschrieben.
    - Danach wird die Karte neu aufgebaut.
  - NEWS ganz oben: `v:43`, Datum `05.11.2026`, 💡, Titel „Ideen-Kiste“, Text „Du hast eine Idee fürs Spiel? Tipp auf die Uhr und dann auf 💡. Ein Erwachsener schickt sie weiter.“

- [ ] **Step 1: Failing tests**
  - `Ideen der Kinder: nur nach der Rechenaufgabe, mit zwei Spielern`:
    1. Seed mit zwei Spielern. Der aktuelle Spieler „Mia“ hat 2 Ideen, der Platz von „Tom“ hat 1 Idee.
    2. Werkstatt öffnen und `#btnIdeen` antippen. Es erscheint `#gateIn`, aber noch keine `.idee`.
    3. Eine falsche Antwort ergibt weiterhin 0 `.idee`.
    4. Die richtige Antwort (aus dem Aufgabentext rechnen) ergibt 3 `.idee` sowie die Überschriften „Mia“ und „Tom“.
  - `Ideen der Kinder: kaputter Spieler-Platz stört nicht`:
    - Ein dritter Platz enthält `'kein json'`, ein vierter `{ideen:'x'}`.
    - Die Ansicht zeigt trotzdem die 3 Ideen, es gibt keine Seitenfehler.
  - `Ideen der Kinder: HTML im Text wird nicht ausgeführt`: Toms Idee hat den Text `<img class="eingeschleust" src="x" onerror="window.__pwn=1">`. Erwartet: 0 `.eingeschleust`, `__pwn` undefined, und der Text ist als Text sichtbar.
  - `Ideen der Kinder: Text-Datei`:
    - `navigator.canShare` per `addInitScript` auf `undefined` setzen.
    - `page.waitForEvent('download')`, dann `#ideenTeilen` antippen.
    - Erwartet:
      - Der Name passt zu `/^Ideen-Mia-\d{4}-\d\d-\d\d\.txt$/`.
      - Der Inhalt beginnt mit „Ideen aus Amazonas Angler – “ und enthält „Mia:“, „Tom:“ und die 3 Texte.
  - `Ideen der Kinder: Teilen abbrechen`: `navigator.canShare=()=>true` und `navigator.share=()=>Promise.reject(new DOMException('x','AbortError'))`. Ein Klick löst keinen Download aus, es gibt keine Seitenfehler und keinen Fehler-Toast.
  - `Ideen der Kinder: als gelesen markieren löscht nichts`:
    1. `#ideenGelesen` antippen.
    2. Bei Mia: `ideen.length===2`, alle `gelesen:true`.
    3. Bei Tom (`slotKey`): Das JSON ist gleich dem vorherigen, nur mit `gelesen:true` (Vergleich mit `deepEqual` nach dem Setzen).
    4. Die Ansicht zeigt 0 offene `.idee`, und „Schon gelesen“ enthält 3.
    5. Danach ist `#btnIdee` für Mia wieder frei, auch wenn sie vorher 50 hatte. Das ist ein eigener kleiner Fall mit 50 ungelesenen Ideen, dann markieren, dann ist das Formular sichtbar.
  - `Was ist neu v43: Ideen-Kiste`: Der oberste NEWS-Eintrag hat `v:43` und den Text aus Interfaces.
- [ ] **Step 2:** FAIL, jeden roten Test einzeln laufen lassen.
- [ ] **Step 3:** Implementieren.
  - `CLAUDE.md`: im Abschnitt „Die Spielidee“ ein Punkt **Ideen-Kiste**. Er nennt `state.ideen`, `cleanIdeen`, `IDEEN_MAX`, den Werkstatt-Knopf hinter `adultGate`, den Export als `.txt` und den Satz „kein Server, Erwachsene teilen selbst“.
  - `IDEEN.md`: eine Zeile unter „Fertig“.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Voller `npm test`, dann Commit „Ideen-Kiste: Ideen für Erwachsene ansehen und teilen (v43)“.
