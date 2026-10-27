// Prüft, dass der Spielstand nach einem neuen Update erhalten bleibt.
// Start:  cd tests && npm install && npm test
// Die Tests öffnen das echte Spiel in einem unsichtbaren Browser.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const KEY = 'amazonas-angler-1';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.md': 'text/plain', '.json': 'application/json' };

let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/leer') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<title>leer</title>'); }
    const file = path.join(root, url === '/' ? 'index.html' : url);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  const opts = { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
  try { browser = await chromium.launch(opts); }
  catch { browser = await chromium.launch({ ...opts, executablePath: '/opt/pw-browsers/chromium' }); }
});
after(async () => { await browser?.close(); server?.close(); });

// Neues Browserfenster. Three.js kommt aus npm statt aus dem Internet, Schriften werden übersprungen.
// Die Uhr im Spiel steht am Anfang immer auf heute, 11 Uhr (Ortszeit dieses Rechners), und läuft dann weiter.
// So ist im Spiel immer Tag, auch wenn die Tests nachts laufen (Läden zu, Menschen schlafen …).
// Nur Date wird verschoben. Nicht ctx.clock.setSystemTime: die Playwright-Uhr springt bei langsamen Bildern
// manchmal viele Sekunden vor (dann ist z. B. der Kunstköder beim Spinnfischen sofort wieder da).
// start (ISO-Zeit, z. B. '2026-06-21T23:00:00+02:00'): die Uhr beginnt stattdessen dann und läuft weiter (für Angel-Tests zu einer Uhrzeit).
async function newPage(opts, start) { // opts: z. B. { viewport: … } (kleineres Fenster = mehr Bilder pro Sekunde)
  const ctx = await browser.newContext(opts);
  const elf = start ? new Date(start) : new Date(); if (!start) elf.setHours(11, 0, 0, 0);
  await ctx.addInitScript(off => {
    const Echt = Date;
    function Uhr(...a) { if (!new.target) return new Echt(Echt.now() + off).toString(); return a.length ? new Echt(...a) : new Echt(Echt.now() + off); }
    Uhr.prototype = Echt.prototype; Uhr.now = () => Echt.now() + off; Uhr.UTC = Echt.UTC; Uhr.parse = Echt.parse;
    window.Date = Uhr;
  }, elf.getTime() - Date.now());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Achtung: die zuletzt eingetragene Regel gewinnt, darum steht Three.js unten
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.request().resourceType() === 'stylesheet'
    ? r.fulfill({ contentType: 'text/css', body: '' }) : r.abort());
  await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js/, r =>
    r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(here, 'node_modules/three/build/three.min.js')) }));
  return { ctx, page, errors };
}
async function seed(page, items) {
  await page.goto(base + '/leer');
  await page.evaluate(items => { localStorage.clear(); for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v); }, items);
}
async function startGame(page) {
  await page.goto(base + '/index.html');
  await page.locator('#btnGo').waitFor({ state: 'visible', timeout: 30000 });
}
async function playAndLeave(page) {
  await page.click('#btnGo');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // so, als würde man das Spiel schließen
}
const read = (page, k = KEY) => page.evaluate(k => localStorage.getItem(k), k);

// So sah ein Spielstand der allerersten Version aus (ohne Versionsnummer)
const ALT_V1 = {
  ludins: 345, hasBoat: true, hasRod: true, hasBucket: false, usedBoat: true,
  bucket: [{ id: 'piranha', cm: 25, value: 11 }, { id: 'gibtEsNichtMehr', cm: 5, value: 7 }],
  book: { piranha: { n: 3, best: 30 }, diskus: { n: 1, best: 15 } },
  avatar: { name: 'Testkind', skin: '#9a6440', hair: 'lang', hairColor: '#1d1611', shirt: '#2f7fd8', pants: '#3d3a33', hat: 'kappe' }
};

test('alter Spielstand bleibt nach einem Update erhalten', async () => {
  const { ctx, page, errors } = await newPage();
  const raw = JSON.stringify(ALT_V1);
  await seed(page, { [KEY]: raw });
  await startGame(page);
  assert.equal(await page.inputValue('#nameIn'), 'Testkind');
  await playAndLeave(page);
  const s = JSON.parse(await read(page));
  assert.equal(s.ludins, 345 + 7, 'Ludins bleiben (plus Wert des Fisches, den es nicht mehr gibt)');
  assert.equal(s.bucket.length, 1);
  assert.equal(s.bucket[0].id, 'piranha');
  assert.equal(s.book.piranha.n, 3);
  assert.equal(s.book.diskus.best, 15);
  assert.equal(s.hasBoat, true);
  assert.equal(s.rod, 1, 'alte Profi-Angel wird übernommen');
  assert.equal(s.avatar.name, 'Testkind');
  assert.equal(s.avatar.hat, 'kappe');
  assert.equal(typeof s.v, 'number');
  assert.equal(await read(page, KEY + '-backup'), raw, 'Sicherheitskopie vom Spielstart');
  assert.equal(await read(page, KEY + '-vor-v' + s.v), raw, 'Kopie vor dem Umbau');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('kaputter Spielstand: Sicherheitskopie wird geladen', async () => {
  const { ctx, page, errors } = await newPage();
  const backup = JSON.stringify({ ...ALT_V1, v: 2, ludins: 99, bucket: [] });
  await seed(page, { [KEY]: '{kaputt', [KEY + '-backup']: backup });
  await startGame(page);
  await playAndLeave(page);
  const s = JSON.parse(await read(page));
  assert.equal(s.ludins, 99);
  assert.equal(s.avatar.name, 'Testkind');
  assert.equal(await read(page, KEY + '-kaputt'), '{kaputt', 'kaputter Stand wird aufgehoben');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Spielstand aus einer neueren Version geht nicht verloren', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 99, zukunft: { haustier: 'Faultier' } }) });
  await startGame(page);
  await playAndLeave(page);
  const s = JSON.parse(await read(page));
  assert.equal(s.v, 99, 'Versionsnummer wird nicht zurückgedreht');
  assert.deepEqual(s.zukunft, { haustier: 'Faultier' }, 'unbekannte Felder bleiben');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Ein Spielstand als alter Code, so wie ihn frühere Versionen gemacht haben
const alterCode = st => 'AMAZONAS1-' + Buffer.from(JSON.stringify(st), 'utf8').toString('base64');

test('Sicherheitskopie als Datei speichern und wieder laden (ohne Code)', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, ludins: 1234, bucket: [] }) });
  await startGame(page);
  await page.click('#btnSaveCode');
  await page.locator('text=Gerade eben gespeichert').waitFor();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnBackupSave')]);
  assert.match(download.suggestedFilename(), /^Amazonas-Angler-Testkind-\d{4}-\d{2}-\d{2}\.json$/);
  const datei = path.join(here, 'test-sicherheitskopie.json');
  await download.saveAs(datei);
  assert.equal(JSON.parse(fs.readFileSync(datei, 'utf8')).state.ludins, 1234);
  await seed(page, {});
  await startGame(page);
  assert.equal(await page.inputValue('#nameIn'), '', 'neues Spiel ist leer');
  await page.click('#btnSaveCode');
  await page.setInputFiles('#backupFile', { name: 'falsch.json', mimeType: 'application/json', buffer: Buffer.from('hallo') });
  await page.locator('text=keine Sicherheitskopie').waitFor();
  await page.setInputFiles('#backupFile', datei);
  await Promise.all([page.waitForEvent('load'), page.click('text=Ja, laden')]);
  fs.unlinkSync(datei);
  await page.locator('#btnGo').waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(await page.inputValue('#nameIn'), 'Testkind');
  assert.equal(JSON.parse(await read(page)).ludins, 1234);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Alter Spielstand-Code lässt sich weiter laden', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, {});
  await startGame(page);
  await page.click('#btnSaveCode');
  await page.click('#btnOldCode');
  await page.fill('#saveCodeIn', 'falscher Code');
  await page.click('text=Code laden');
  await page.locator('text=Dieser Code passt nicht').waitFor();
  await page.fill('#saveCodeIn', alterCode({ ...ALT_V1, v: 2, ludins: 1234, bucket: [] }));
  await page.click('text=Code laden');
  await Promise.all([page.waitForEvent('load'), page.click('text=Ja, laden')]);
  await page.locator('#btnGo').waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(await page.inputValue('#nameIn'), 'Testkind');
  assert.equal(JSON.parse(await read(page)).ludins, 1234);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Heimat-See: Ort und See-Fische bleiben nach einem Update erhalten', async () => {
  const { ctx, page, errors } = await newPage();
  // Spielstand von vor dem Heimat-See-Update (ohne visitedLake), plus einer, der am See steht
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, bucket: [{ id: 'hecht', cm: 80, value: 62 }], book: { hecht: { n: 1, best: 80 } },
    where: { x: 0, z: -931, f: 0, boat: false } }) });
  await startGame(page);
  await playAndLeave(page);
  const s = JSON.parse(await read(page));
  assert.ok(s.where.z < -900, 'man steht noch am See');
  assert.equal(s.bucket[0].id, 'hecht', 'der Hecht bleibt im Eimer');
  assert.equal(s.ludins, 345, 'Rosa hat den Hecht nicht abgekauft');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Reusen: ausgelegte Reusen und gekaufte Reusen bleiben erhalten', async () => {
  const { ctx, page, errors } = await newPage();
  const t = Date.now() - 5 * 60 * 1000;
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, bucket: [], reusen: 1,
    traps: [{ x: 11.5, z: 0, t, fish: [{ id: 'piranha', cm: 22, value: 10 }] }, { kaputt: true }] }) });
  await startGame(page);
  await playAndLeave(page);
  const s = JSON.parse(await read(page));
  assert.equal(s.reusen, 1, 'gekaufte Reuse bleibt');
  assert.equal(s.traps.length, 1, 'kaputter Eintrag fliegt raus, die echte Reuse bleibt');
  assert.equal(s.traps[0].t, t, 'die Zeit läuft weiter, auch wenn das Spiel zu war');
  assert.equal(s.traps[0].fish[0].id, 'piranha', 'Fisch in der Reuse bleibt');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Yacht: bleibt gekauft, und der Fischtank gibt 20 Plätze mehr', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, bucket: [], hasYacht: true, hasBucket: true }) });
  await startGame(page);
  await playAndLeave(page);
  const s = JSON.parse(await read(page));
  assert.equal(s.hasYacht, true);
  assert.equal(await page.textContent('#hudBucket'), '0/50', 'großer Eimer 30 + Fischtank 20');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Was ist neu: geht nach einem Update einmal auf und merkt sich das', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, bucket: [] }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#card h2:has-text("Was ist neu?")').waitFor({ timeout: 5000 });
  const s = JSON.parse(await read(page));
  assert.ok(s.newsSeen > 0, 'gesehen wird gespeichert');
  assert.equal(s.ludins, 345, 'der Spielstand bleibt dabei unverändert');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Fotos: jeder Fisch hat ein echtes Foto, und der Eimer zeigt Fotos', async () => {
  // Jede Fisch-id aus FISH braucht einen Eintrag in FOTOS und eine Datei in fotos/
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const fishList = html.slice(html.indexOf('const FISH=['), html.indexOf('];', html.indexOf('const FISH=[')));
  const ids = [...fishList.matchAll(/\{id:'(\w+)'/g)].map(m => m[1]);
  const fotos = html.slice(html.indexOf('const FOTOS={'), html.indexOf('};', html.indexOf('const FOTOS={')));
  assert.equal(ids.length, 42, '15 Amazonas-Fische, 10 See-Fische, 12 Flussfische und 5 Meeresfische');
  for (const id of ids) {
    assert.ok(fotos.includes(` ${id}:{src:'fotos/${id}.jpg'`), `FOTOS-Eintrag für ${id}`);
    assert.ok(fs.existsSync(path.join(root, 'fotos', id + '.jpg')), `fotos/${id}.jpg`);
  }
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999,
    bucket: [{ id: 'hecht', cm: 80, value: 62 }, { id: 'piranha', cm: 25, value: 11 }] }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnBucket');
  const thumbs = page.locator('#card .item img.thumb');
  await thumbs.first().waitFor({ timeout: 5000 });
  assert.equal(await thumbs.count(), 2, 'zwei kleine Fotos im Eimer');
  await page.waitForFunction(() => [...document.querySelectorAll('#card .item img.thumb')].every(i => i.complete && i.naturalWidth > 0));
  assert.deepEqual(await thumbs.evaluateAll(l => l.map(i => i.getAttribute('src'))), ['fotos/hecht.jpg', 'fotos/piranha.jpg']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Mehrere Spieler: jeder behält seinen eigenen Spielstand', async () => {
  const { ctx, page, errors } = await newPage();
  // Ein alter Spielstand von vor dem Spieler-Update wird automatisch Spieler 1
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [] }) });
  await startGame(page);
  await page.click('#btnPlayers');
  await page.locator('#card .player:has-text("Testkind")').waitFor();
  await Promise.all([page.waitForEvent('load'), page.click('text=+ Neuer Spieler')]);
  await page.locator('#btnGo').waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(await page.inputValue('#nameIn'), '', 'der neue Spieler fängt leer an');
  assert.equal(await page.locator('#card h2:has-text("Wer spielt?")').count(), 0, 'nach dem Wechsel nicht gleich wieder fragen');
  let s = JSON.parse(await read(page));
  assert.equal(s.ludins || 0, 0);
  assert.equal(s.playerId, 'p2');
  assert.equal(JSON.parse(await read(page, KEY + '-spieler-p1')).ludins, 345, 'Spieler 1 ist sicher aufgehoben');
  await page.fill('#nameIn', 'Geschwister');
  await playAndLeave(page);
  // Beim nächsten Start fragt das Spiel, wer spielt
  await startGame(page);
  await page.locator('#card h2:has-text("Wer spielt?")').waitFor({ timeout: 5000 });
  assert.equal(await page.locator('#card .player').count(), 2);
  await Promise.all([page.waitForEvent('load'), page.click('#card .player:has-text("Testkind")')]);
  await page.locator('#btnGo').waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(await page.inputValue('#nameIn'), 'Testkind');
  s = JSON.parse(await read(page));
  assert.equal(s.ludins, 345, 'Spieler 1 hat alles zurück');
  assert.equal(s.book.diskus.n, 1);
  assert.equal(JSON.parse(await read(page, KEY + '-spieler-p2')).avatar.name, 'Geschwister', 'Spieler 2 ist sicher aufgehoben');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Mehrere Spieler: Sicherheitskopie kommt als neuer Spieler dazu', async () => {
  const { ctx, page, errors } = await newPage();
  const kopie = JSON.stringify({ app: 'amazonas-angler', state: { ...ALT_V1, v: 2, newsSeen: 999, ludins: 777, bucket: [], avatar: { ...ALT_V1.avatar, name: 'Freund' } } });
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [] }) });
  await startGame(page);
  await page.click('#btnSaveCode');
  await page.setInputFiles('#backupFile', { name: 'freund.json', mimeType: 'application/json', buffer: Buffer.from(kopie) });
  await page.locator('text=Er kommt als neuer Spieler dazu').waitFor();
  await Promise.all([page.waitForEvent('load'), page.click('text=Ja, laden')]);
  await page.locator('#btnGo').waitFor({ state: 'visible', timeout: 30000 });
  assert.equal(await page.inputValue('#nameIn'), 'Freund');
  assert.equal(JSON.parse(await read(page)).ludins, 777);
  assert.equal(JSON.parse(await read(page, KEY + '-spieler-p1')).ludins, 345, 'der alte Spieler bleibt erhalten');
  assert.equal(JSON.parse(await read(page, KEY + '-spieler')).list.length, 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Sicherheit: eine präparierte Sicherheitskopie kann kein HTML einschleusen (SEC-001)', async () => {
  const { ctx, page, errors } = await newPage();
  const fremd = '<b class="eingeschleust">x</b>'; // harmloser Marker: taucht er als Element auf, wurde HTML eingeschleust
  const kopie = JSON.stringify({ app: 'amazonas-angler', state: { ...ALT_V1, v: 2, newsSeen: 999, ludins: 10,
    book: { piranha: { n: fremd, best: fremd } }, bucket: [{ id: 'piranha', cm: fremd, value: fremd }],
    traps: [{ x: 9, z: 9, t: 0, fish: [{ id: 'piranha', cm: fremd, value: fremd }] }],
    avatar: { name: 'Fremd' + fremd, skin: 'url(http://127.0.0.1:9/x.png)', hair: fremd, hairColor: 'red', shirt: 'url(x)', pants: '#3d3a33', hat: 'kappe' } } });
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [] }) });
  await startGame(page);
  await page.click('#btnSaveCode');
  await page.setInputFiles('#backupFile', { name: 'cheat.json', mimeType: 'application/json', buffer: Buffer.from(kopie) });
  await page.locator('text=Er kommt als neuer Spieler dazu').waitFor();
  assert.equal(await page.locator('.eingeschleust').count(), 0, 'auch die Frage vor dem Laden zeigt kein HTML');
  await Promise.all([page.waitForEvent('load'), page.click('text=Ja, laden')]);
  await page.locator('#btnGo').waitFor({ state: 'visible', timeout: 30000 });
  await page.click('#btnGo');
  const s = await weg(page); // speichern wie beim Schließen
  assert.deepEqual(s.book.piranha, { n: 0, best: 0 }, 'Fischbuch: nur Zahlen');
  assert.deepEqual([s.bucket[0].cm, s.bucket[0].value], [0, 0], 'Eimer: nur Zahlen');
  assert.deepEqual([s.traps[0].fish[0].cm, s.traps[0].fish[0].value], [0, 0], 'Reuse: nur Zahlen');
  assert.equal(s.avatar.skin, '#eab48c', 'Hautfarbe: nur echte Farben, sonst der Startwert');
  assert.equal(s.avatar.shirt, '#2f9e5b');
  assert.equal(s.avatar.hairColor, '#5a3720');
  assert.equal(s.avatar.hair, 'kurz');
  assert.equal(s.avatar.hat, 'kappe', 'gültige Werte bleiben genau so');
  assert.equal(s.avatar.pants, '#3d3a33');
  assert.equal(s.ludins, 10);
  for (const knopf of ['#btnBook', '#btnBucket', '#btnRank']) {
    await page.click(knopf);
    await page.locator('#card h2').first().waitFor();
    if (knopf === '#btnRank') { await page.locator('#card .rankrow').first().click(); await page.locator('#card .catches').waitFor(); }
    assert.equal(await page.locator('.eingeschleust').count(), 0, knopf + ': kein eingeschleustes HTML');
    await page.keyboard.press('Escape');
    await page.evaluate(() => { const c = document.querySelector('#card .b.alt, #card button:last-child'); if (c) c.click(); });
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Mehrere Spieler: kaputte Spielerliste, aber kein Spieler geht verloren', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], playerId: 'p1' }),
    [KEY + '-spieler-p2']: JSON.stringify({ v: 2, ludins: 99, playerId: 'p2', avatar: { name: 'Zweiter' } }),
    [KEY + '-spieler']: 'kaputt{' });
  await startGame(page);
  await page.locator('#card h2:has-text("Wer spielt?")').waitFor({ timeout: 5000 });
  assert.equal(await page.locator('#card .player:has-text("Zweiter")').count(), 1, 'Spieler 2 ist wieder in der Liste');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Fischbuch: nur echte Fotos, keine gemalten Fische', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [] }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnBook');
  await page.locator('#card .bk img.bkimg').first().waitFor({ timeout: 5000 });
  assert.equal(await page.locator('#card .bk img.bkimg').count(), 2, 'Piranha und Diskus als Foto');
  assert.equal(await page.locator('#card .bk .unknown').count(), 40, 'die anderen sind ein Fragezeichen');
  assert.equal(await page.locator('#card canvas').count(), 0, 'kein gemalter Fisch');
  await page.click('#card button.bk:has-text("Piranha")');
  await page.locator('#card .pic img.photo').waitFor();
  assert.equal(await page.locator('#card .pic img.photo').getAttribute('src'), 'fotos/piranha.jpg');
  assert.equal(await page.locator('#card canvas').count(), 0);
  assert.equal(await page.locator('#card button:has-text("Gemalt")').count(), 0, 'kein Knopf mehr zum Umschalten');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// So schreibt das Spiel das heutige Datum in den Spielstand
const heute = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
async function rechenaufgabe(page) {
  const t = await page.locator('.gate p').textContent();
  const [, a, b] = t.match(/(\d+) × (\d+)/);
  await page.fill('#gateIn', String(a * b));
  await page.click('#gateOk');
}

test('Spielzeit: Erwachsene stellen sie ein, danach macht das Spiel Pause', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [] }) });
  await startGame(page);
  await page.click('#btnTime');
  await page.locator('#card:has-text("15 Minuten")').waitFor(); // ohne Einstellung gelten 15 Minuten
  await page.click('#btnTimeChange');
  await page.fill('#gateIn', '1');
  await page.click('#gateOk');
  assert.equal(await page.locator('#card button:has-text("30 Min")').count(), 0, 'falsche Antwort: keine Einstellung');
  await rechenaufgabe(page);
  await page.click('#card button:has-text("30 Min")');
  assert.equal(JSON.parse(await read(page, KEY + '-spielzeit')).min, 30);
  await ctx.close();

  // Fast die ganze Zeit ist schon verbraucht: nach einer Sekunde kommt die Pause
  const b = await newPage();
  await seed(b.page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], playTime: { day: heute(), sec: 15 * 60 - 1, extra: 0 } }),
    [KEY + '-spielzeit']: JSON.stringify({ min: 15 }) });
  await startGame(b.page);
  await b.page.click('#btnGo');
  await b.page.locator('#timeup h2:has-text("Spielzeit ist um")').waitFor({ timeout: 10000 });
  await b.page.click('#btnMoreTime');
  await rechenaufgabe(b.page);
  await b.page.click('#timeup button:has-text("+ 15 Minuten")');
  assert.equal(await b.page.isVisible('#timeup'), false, 'es geht weiter');
  const s = JSON.parse(await read(b.page));
  assert.equal(s.playTime.extra, 15 * 60);
  assert.equal(s.ludins, 345, 'der Spielstand bleibt dabei unverändert');
  assert.match(await b.page.textContent('#timeChip'), /⏰ 1[56] Min/);
  assert.deepEqual(errors, []);
  assert.deepEqual(b.errors, []);
  await b.ctx.close();
});

test('Spielzeit: ein neuer Tag fängt wieder bei null an', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], playTime: { day: '2000-1-1', sec: 99999, extra: 0 } }),
    [KEY + '-spielzeit']: JSON.stringify({ min: 30 }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(500);
  assert.equal(await page.isVisible('#timeup'), false, 'keine Pause');
  assert.match(await page.textContent('#timeChip'), /⏰ (29|30) Min/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Bestenliste: Spieler auf diesem iPad, sortiert nach Ludins', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], playerId: 'p1' }),
    [KEY + '-spieler-p2']: JSON.stringify({ v: 2, ludins: 1210, playerId: 'p2', book: { hecht: { n: 2, best: 95 } }, avatar: { name: 'Papa' } }),
    [KEY + '-spieler']: JSON.stringify({ list: [{ id: 'p1' }, { id: 'p2', name: 'Papa' }] }) });
  await startGame(page);
  await page.locator('#card h2:has-text("Wer spielt?")').waitFor();
  await page.click('#card button:has-text("Fertig")');
  await page.click('#btnRanking');
  const rows = page.locator('#card .rankrow');
  await rows.first().waitFor();
  assert.equal(await rows.count(), 2);
  assert.match(await rows.nth(0).textContent(), /Papa.*1210 L/);
  assert.match(await rows.nth(1).textContent(), /Testkind.*345 L/);
  await page.click('#card .tabs button:has-text("Fischarten")');
  assert.match(await page.locator('#card .rankrow').nth(0).textContent(), /Testkind.*2 \/ 42/);
  await page.click('#card .rankrow:has-text("Papa")');
  assert.match(await page.textContent('#card .catches'), /Hecht.*2× · größter 95 cm/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Bestenliste: Rekord-Karte als bunte Sammelkarte (Bild) tauschen, ohne Internet', async () => {
  // Kind A speichert seine Rekord-Karte als Bild
  const a = await newPage();
  await seed(a.page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], book: { arapaima: { n: 1, best: 250 } } }) });
  await startGame(a.page);
  await a.page.click('#btnRanking');
  await a.page.click('#btnCardSave');
  await a.page.locator('#card img.mycard').waitFor({ timeout: 15000 });
  const [download] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#btnCardDownload')]);
  assert.equal(download.suggestedFilename(), 'Rekordkarte-Testkind.png');
  const datei = path.join(here, 'test-rekordkarte.png');
  await download.saveAs(datei);
  const bild = fs.readFileSync(datei);
  assert.deepEqual([...bild.subarray(0, 4)], [0x89, 0x50, 0x4E, 0x47], 'ein echtes PNG-Bild');
  assert.ok(bild.includes('amazonas-angler-karte'), 'die Kartendaten stecken im Bild');
  // Die eigene Karte kann man nicht als Freund laden
  await a.page.click('#card button:has-text("Zurück")');
  await a.page.setInputFiles('#cardFile', datei);
  await a.page.locator('text=deine eigene Rekord-Karte').waitFor();
  await a.ctx.close();

  // Kind B lädt die Karte auf seinem iPad
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ v: 2, newsSeen: 999, ludins: 777, book: { hecht: { n: 1, best: 80 } }, avatar: { name: 'Freund' } }) });
  await startGame(page);
  await page.click('#btnRanking');
  await page.setInputFiles('#cardFile', { name: 'kopie.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'amazonas-angler', state: {} })) });
  await page.locator('text=Das ist eine Sicherheitskopie').waitFor();
  // Ein Foto ohne Kartendaten (zum Beispiel beim Verschicken umgewandelt)
  await page.setInputFiles('#cardFile', path.join(root, 'fotos', 'hecht.jpg'));
  await page.locator('text=keine Kartendaten').waitFor();
  await page.setInputFiles('#cardFile', datei);
  await page.locator('#card .rankrow:has-text("Testkind")').waitFor();
  fs.unlinkSync(datei); // erst löschen, wenn das Spiel die Datei gelesen hat
  assert.match(await page.locator('#card .rankrow').nth(0).textContent(), /Freund.*777 L/);
  assert.match(await page.locator('#card .rankrow').nth(1).textContent(), /Testkind.*Rekord-Karte von Freund.*345 L/);
  await page.click('#card .tabs button:has-text("Größter Fisch")');
  assert.match(await page.locator('#card .rankrow').nth(0).textContent(), /Testkind.*Arapaima.*250 cm/);
  // Ältere Rekord-Karten (.json) gehen weiter
  await page.setInputFiles('#cardFile', { name: 'alt.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'amazonas-angler-karte', v: 1, id: 'kalt', name: 'Oma', ludins: 50, book: {} })) });
  await page.locator('#card .rankrow:has-text("Oma")').waitFor();
  assert.equal(JSON.parse(await read(page, KEY + '-freunde')).cards.length, 2);
  assert.equal(JSON.parse(await read(page)).ludins, 777, 'der eigene Spielstand bleibt unverändert');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Die Quizfragen und richtigen Antworten direkt aus dem Spiel lesen
function quizAusDemSpiel() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  return [...html.matchAll(/\{id:'(\w+)',k:'[^']*',q:'([^']*)',a:'([^']*)'/g)].map(m => ({ id: m[1], q: m[2], a: m[3] }));
}

test('Angel-Quiz bei Opa Tiago: richtige Antworten bringen Ludins und den Junior-Angelschein', async () => {
  const quiz = quizAusDemSpiel();
  assert.ok(quiz.length >= 20, 'genug Fragen für den Angelschein');
  const { ctx, page, errors } = await newPage();
  // 19 Fragen sind schon richtig, eine fehlt noch bis zum Angelschein
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], metTiago: true,
    quiz: { ok: quiz.slice(0, 19).map(q => q.id) }, where: { x: 33.8, z: 2.6, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Opa Tiago")').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  await page.locator('text=Noch 1 bis zum Angelschein!').waitFor();
  await page.click('#btnQuiz');
  for (let i = 0; i < 5; i++) {
    const frage = (await page.textContent('#card .qq')).trim();
    const q = quiz.find(x => x.q === frage);
    assert.ok(q, 'Frage gefunden: ' + frage);
    await page.click(`#card .qa:text-is("${q.a}")`);
    await page.locator('#card .qe:has-text("Richtig")').waitFor();
    await page.click('#card button:has-text("Weiter")');
  }
  await page.locator('#card .schein:has-text("Junior-Angelschein")').waitFor();
  const s = JSON.parse(await read(page));
  assert.equal(s.angelschein, true);
  assert.equal(s.quiz.ok.length, 24, 'die 5 neuen Fragen sind dazugekommen');
  assert.equal(s.ludins, 345 + 5 * 10 + 100, 'pro neuer richtiger Frage 10 Ludins, dazu 100 für den Angelschein');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Mindestmaß: zu kleine Fische aus der Reuse kommen zurück ins Wasser', async () => {
  const { ctx, page, errors } = await newPage();
  const t = Date.now() - 60 * 1000;
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], reusen: 0,
    traps: [{ x: 11.5, z: 0, t, fish: [{ id: 'hecht', cm: 40, value: 50 }, { id: 'karpfen', cm: 60, value: 25 }, { id: 'zander', cm: 47, value: 50 }] }],
    where: { x: 14, z: 0, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  await page.locator('#card .item:has-text("Hecht"):has-text("Zu klein")').waitFor();
  await page.click('#card button:has-text("In den Eimer")');
  const s = JSON.parse(await read(page));
  // Baden-Württemberg: Zander ab 45 cm, Schonzeit 1.4. bis 15.5.
  const d = new Date(), md = (d.getMonth() + 1) * 100 + d.getDate(), zanderSchonzeit = md >= 401 && md <= 515;
  assert.deepEqual(s.bucket.map(f => f.id), zanderSchonzeit ? ['karpfen'] : ['karpfen', 'zander'], 'Karpfen und (außer in der Schonzeit) der 47-cm-Zander dürfen mit');
  assert.equal(s.ludins, 345 + 5 * (zanderSchonzeit ? 2 : 1), 'Belohnung fürs Zurücksetzen');
  assert.equal(s.book.hecht.best, 40, 'der Hecht steht trotzdem im Fischbuch');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Spinnrute und Grundrute: kaufen, Angelart wechseln, bleibt gespeichert', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], ludins: 400, metTiago: true,
    where: { x: 33.8, z: 2.6, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  assert.equal(await page.isVisible('#btnMethod'), false, 'am Anfang gibt es nur die Pose');
  await page.locator('#btnCtx:has-text("Opa Tiago")').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  await page.click('#card .item:has-text("Spinnrute") button');
  await page.click('#card .item:has-text("Grundrute") button');
  let s = JSON.parse(await read(page));
  assert.deepEqual(s.methods, { spin: true, grund: true });
  assert.equal(s.ludins, 400 - 150 - 120);
  await page.click('#card button:has-text("Tschüss")');
  assert.match(await page.textContent('#btnMethod'), /Grundangeln/);
  await page.click('#btnMethod');
  assert.match(await page.textContent('#btnMethod'), /Posenangeln/);
  await page.click('#btnMethod');
  assert.match(await page.textContent('#btnMethod'), /Spinnfischen/);
  assert.equal(await page.isVisible('#btnBait'), false, 'beim Spinnfischen braucht man keinen Köder');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  s = JSON.parse(await read(page));
  assert.equal(s.method, 'spin', 'die Angelart bleibt gespeichert');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Spinnfischen: Kunstköder auswerfen, Biss, Fisch fangen', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], methods: { spin: true, grund: false }, method: 'spin',
    where: { x: 14, z: 0, f: -Math.PI / 2, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  let gefangen = false;
  for (let wurf = 0; wurf < 6 && !gefangen; wurf++) {
    await page.click('#btnFish');
    // warten, bis ein Fisch beißt oder der Köder wieder da ist
    const was = await page.waitForFunction(() => {
      const l = document.querySelector('#fishLbl').textContent;
      return l === 'ZIEHEN!' ? 'biss' : l === 'Angeln' ? 'leer' : false;
    }, null, { timeout: 60000, polling: 200 }).then(h => h.jsonValue()); // der Test-Browser ist langsam
    if (was === 'biss') { await page.keyboard.press('Space'); gefangen = true; } // Leertaste = ziehen (der Knopf pulsiert)
  }
  assert.ok(gefangen, 'in 6 Würfen hat ein Fisch gebissen');
  await page.locator('#card h2:has-text("gefangen")').waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Spielzeit: ohne Einstellung gelten 15 Minuten pro Tag', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [] }) });
  await startGame(page);
  await page.click('#btnGo');
  assert.match(await page.textContent('#timeChip'), /⏰ 1[45] Min/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Infotafeln: am Heimat-See lesen, +5 Ludins nur beim ersten Mal, bleibt gespeichert', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], visitedLake: true,
    where: { x: 4, z: -951, f: 0, boat: false } }) }); // da landet das Flugzeug, gleich neben der Regel-Tafel
  await startGame(page);
  await page.click('#btnGo');
  const knopf = page.locator('#btnCtx:has-text("Infotafel")');
  await knopf.waitFor({ timeout: 20000 });
  await knopf.click();
  const tabelle = page.locator('#card table.rules');
  await tabelle.waitFor();
  const text = await tabelle.textContent();
  assert.match(text, /Hecht/);
  assert.match(text, /50 cm/);
  assert.match(await page.textContent('#card'), /Neues Wissen! \+5 Ludins/);
  let s = JSON.parse(await read(page));
  assert.equal(s.ludins, 350);
  assert.deepEqual(s.infoRead, ['regeln']);
  await page.click('#card button:has-text("Fertig")');
  await knopf.click(); // zweites Mal lesen: kein Geld mehr
  await tabelle.waitFor();
  assert.doesNotMatch(await page.textContent('#card'), /Neues Wissen/);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  s = JSON.parse(await read(page));
  assert.equal(s.ludins, 350);
  assert.deepEqual(s.infoRead, ['regeln']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Die Flussplätze (SPOTS) direkt aus dem Spiel lesen
function flussplaetze() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const i = html.indexOf('const SPOTS=['), j = html.indexOf('];', i);
  return new Function('return ' + html.slice(i + 'const SPOTS='.length, j + 1))();
}
const landeplatz = (s, dx = 4, dz = -11) => ({ x: dx, z: -1800 - s.hw + dz, f: 0, boat: false });

test('Flüsse in Deutschland: ein Stempel öffnet den nächsten Fluss, der Ort bleibt gespeichert', async () => {
  const spots = flussplaetze(), rhein = spots.find(s => s.id === 'bw-rhein');
  assert.equal(spots.length, 18);
  assert.ok(spots.every(s => s.q.length >= 2 && s.fish.length >= 6), 'jeder Platz hat Rätsel und Fische');
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], visitedLake: true,
    fluss: { 'bw-rhein': { f: ['barbe', 'nase', 'doebel'], q: true, s: true, r: true } }, flussAt: 'bw-rhein',
    where: landeplatz(rhein, 10, -13.5) }) }); // gleich neben dem Flugzeug
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Fliegen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#deMap').waitFor();
  assert.equal(await page.locator('[data-dest="nw-rhein"]').count(), 0, 'Köln ist noch zu');
  assert.equal(await page.locator('[data-dest="bw-donau"]').count(), 1, 'Baden-Württemberg ist von Anfang an offen');
  await page.click('[data-dest="rp-rhein"]'); // der Stempel am Rhein bei Breisach öffnet die Loreley
  await page.waitForFunction(k => { const s = JSON.parse(localStorage.getItem(k)); return s.flussAt === 'rp-rhein' && s.where.z < -1300; }, KEY, { timeout: 15000 });
  await page.locator('#flight').waitFor({ state: 'hidden', timeout: 15000 });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const vorher = JSON.parse(await read(page));
  // neu laden: man steht wieder an der Loreley
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const s = JSON.parse(await read(page));
  assert.equal(s.flussAt, 'rp-rhein');
  assert.ok(Math.abs(s.where.z - vorher.where.z) < 0.5 && s.where.z < -1300, 'der Platz am Fluss bleibt erhalten');
  assert.deepEqual(s.fluss['bw-rhein'], { f: ['barbe', 'nase', 'doebel'], q: true, s: true, r: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Flüsse in Deutschland: Infotafel lesen, Rätsel lösen, Stempel bekommen', async () => {
  const rhein = flussplaetze().find(s => s.id === 'bw-rhein');
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [],
    fluss: { 'bw-rhein': { f: ['barbe', 'nase', 'doebel'] } }, flussAt: 'bw-rhein',
    where: { x: -2.8, z: -1800 - rhein.hw - 9, f: 0, boat: false } }) }); // vor der Infotafel
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Infotafel")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Rhein bei Breisach")').waitFor();
  assert.match(await page.textContent('#card'), /Baden-Württemberg/);
  assert.equal(JSON.parse(await read(page)).ludins, 350, '+5 Ludins fürs Lesen');
  await page.click('#btnRiddle');
  for (const q of rhein.q) {
    await page.locator('#card .qq', { hasText: q.q }).waitFor();
    await page.click(`#card button.qa:text-is("${q.a}")`);
    await page.click('#card button:has-text("Weiter")');
  }
  await page.locator('#card h2:has-text("Fluss-Stempel")').waitFor();
  const text = await page.textContent('#card');
  assert.match(text, /Rheinland-Pfalz/, 'ein neues Bundesland ist offen');
  assert.match(text, /Loreley/);
  const s = JSON.parse(await read(page));
  assert.equal(s.ludins, 375, '+25 Ludins für den Stempel');
  assert.equal(s.fluss['bw-rhein'].s, true);
  assert.equal(s.fluss['bw-rhein'].q, true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Flüsse in Deutschland: am Rhein beißen Rhein-Fische und zählen für den Stempel', async () => {
  const rhein = flussplaetze().find(s => s.id === 'bw-rhein');
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], book: {}, flussAt: 'bw-rhein',
    where: { x: 0, z: -1800 - rhein.hw + 6, f: 0, boat: false } }) }); // vorne auf dem Steg
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnFish');
  await page.waitForFunction(() => document.querySelector('#fishLbl').textContent === 'ZIEHEN!', null, { timeout: 60000, polling: 200 });
  await page.keyboard.press('Space');
  await page.locator('#card h2:has-text("gefangen")').waitFor();
  assert.match(await page.textContent('#card'), /Neue Fischart hier: 1 von 3/);
  const s = JSON.parse(await read(page));
  const ids = Object.keys(s.book);
  assert.equal(ids.length, 1);
  assert.ok(rhein.fish.includes(ids[0]), ids[0] + ' lebt im Rhein');
  assert.deepEqual(s.fluss['bw-rhein'].f, ids);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Fischer Hannes am Fluss: Fische verkaufen und Angelsachen kaufen', async () => {
  const neckar = flussplaetze().find(s => s.id === 'bw-neckar');
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, ludins: 100, flussAt: 'bw-neckar',
    bucket: [{ id: 'barbe', cm: 50, value: 24 }, { id: 'zander', cm: 60, value: 55 }],
    where: { x: -6, z: -1800 - neckar.hw - 12.5, f: 0, boat: false } }) }); // neben dem Stand
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Fischer Hannes")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Fischer Hannes")').waitFor();
  assert.match(await page.textContent('#card'), /Grüß Gott/, 'in Baden-Württemberg sagt Hannes „Grüß Gott“');
  await page.click('#card button:has-text("Alles verkaufen (+79 Ludins)")');
  let s = JSON.parse(await read(page));
  assert.equal(s.ludins, 179);
  assert.deepEqual(s.bucket, []);
  assert.equal(await page.locator('#card .tabs button:text-is("Boot")').count(), 0, 'Boote gibt es nur bei Opa Tiago');
  await page.click('#card .tabs button:text-is("Köder")');
  await page.click('#card .item:has(b:text-is("Blinker")) button');
  s = JSON.parse(await read(page));
  assert.equal(s.ludins, 119);
  assert.equal(s.baits.blinker, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Flussplätze: Hannes und die Infotafel stehen überall an Land (auch an der Saarschleife)', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999 }) });
  await startGame(page);
  await page.click('#btnGo');
  const r = await page.evaluate(() => window.__test.ufer());
  assert.equal(r.length, flussplaetze().length);
  for (const p of r) {
    assert.ok(p.hannes > 0.5, p.id + ': Hannes steht im Wasser (Höhe ' + p.hannes.toFixed(2) + ')');
    assert.ok(p.tafel > 0.5, p.id + ': Infotafel steht im Wasser (Höhe ' + p.tafel.toFixed(2) + ')');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Fischer Hannes am Heimat-See: Fische gleich dort verkaufen', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, ludins: 10, visitedLake: true,
    bucket: [{ id: 'hecht', cm: 70, value: 60 }], where: { x: -8.5, z: -954, f: 0, boat: false } }) }); // neben dem Stand am See
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Fischer Hannes")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Fischer Hannes")').waitFor();
  await page.click('#card .tabs button:text-is("🐟 Verkaufen")');
  await page.click('#card button:has-text("Alles verkaufen (+60 Ludins)")');
  const s = JSON.parse(await read(page));
  assert.equal(s.ludins, 70);
  assert.deepEqual(s.bucket, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Feste Stellen in Hafenhausen direkt aus dem Spiel lesen: const NAME={x:…,z:…,f:…,r:…} (nur reine Zahlen)
function stadtWert(name) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = html.match(new RegExp('const ' + name + '=\\{([^}]*)\\}'));
  assert.ok(m, name + ' steht in index.html');
  const o = {};
  for (const [, k, v] of m[1].matchAll(/(\w+):(-?\d+(?:\.\d+)?)/g)) o[k] = Number(v);
  assert.ok(Number.isFinite(o.x) && Number.isFinite(o.z), name + ' hat x und z als Zahlen');
  return o;
}
const STADT_START = { visited: false, vehicles: { bike: true, roller: false, skate: false, truck: false }, parked: {}, riding: '' };

test('Hafenhausen: hinfliegen, Ort bleibt gespeichert, Angeln geht dort nicht', async () => {
  const VX = 10 * Math.sin(1) + 24, L = stadtWert('CITY_LAND'); // wie im Spiel: riverX(0)+24
  assert.deepEqual(L, { x: -125, z: -3010, f: 1.5708 });
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [],
    where: { x: VX + 13 - 3.4, z: 1, f: Math.PI / 2, boat: false } }) }); // 3,4 m neben dem Dorf-Flugzeug
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Fliegen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#deMap').waitFor();
  await page.click('[data-dest="city"]');
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).where.z < -2400, KEY, { timeout: 15000 });
  await page.locator('#flight').waitFor({ state: 'hidden', timeout: 15000 });
  await page.click('#btnFish');
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Angeln kannst du hier am Hafen!'), null, { timeout: 5000 });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const vorher = JSON.parse(await read(page));
  assert.ok(Math.hypot(vorher.where.x - L.x, vorher.where.z - L.z) < 1, 'man steht am Landeplatz');
  assert.equal(vorher.city.visited, true);
  // neu laden: man ist immer noch in Hafenhausen
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const s = JSON.parse(await read(page));
  assert.ok(s.where.z < -2400, 'man ist nach dem Neuladen noch in Hafenhausen');
  assert.ok(Math.hypot(s.where.x - vorher.where.x, s.where.z - vorher.where.z) < 0.5, 'der Platz bleibt erhalten');
  assert.equal(s.city.visited, true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: kaputter city-Wert im alten Spielstand wird repariert', async () => {
  const { ctx, page, errors } = await newPage();
  // alter Spielstand ganz ohne city (von vor Hafenhausen): bekommt den Startwert
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999 }) });
  await startGame(page);
  await playAndLeave(page);
  let s = JSON.parse(await read(page));
  assert.deepEqual(s.city, STADT_START, 'alter Spielstand ohne city bekommt den Startwert');
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, city: 'x' }) });
  await startGame(page);
  await playAndLeave(page);
  s = JSON.parse(await read(page));
  assert.deepEqual(s.city, STADT_START);
  // einzelne kaputte Teile: nur diese werden repariert, gute Teile bleiben
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999,
    city: { visited: true, vehicles: { truck: 'ja', roller: true, bike: false }, parked: { truck: { x: 'a', z: 1 }, rakete: { x: 1, z: 2, yaw: 0 }, bike: { x: -123, z: -3010, yaw: 0.5 } }, riding: 'rakete' } }) });
  await startGame(page);
  await playAndLeave(page);
  s = JSON.parse(await read(page));
  assert.equal(s.city.vehicles.truck, false);
  assert.equal(s.city.vehicles.roller, true, 'gekaufter Roller bleibt');
  assert.equal(s.city.vehicles.bike, true, 'das Fahrrad hat man immer');
  assert.equal(s.city.vehicles.skate, false);
  // nichts aus dem Spielstand löschen: unbekannte oder kaputte Einträge bleiben gespeichert, das Spiel beachtet sie nur nicht
  assert.deepEqual(s.city.parked.truck, { x: 'a', z: 1 }, 'kaputter Eintrag bleibt gespeichert');
  assert.deepEqual(s.city.parked.rakete, { x: 1, z: 2, yaw: 0 }, 'unbekanntes Fahrzeug bleibt gespeichert');
  assert.deepEqual(s.city.parked.bike, { x: -123, z: -3010, yaw: 0.5 }, 'gut geparktes Fahrrad bleibt');
  assert.equal(s.city.riding, '');
  assert.equal(s.city.visited, true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Fahrzeuge in Hafenhausen: das Fahrrad steht 2 m neben dem Landeplatz (Startplatz), Roller und Skateboard vor dem Fahrzeug-Laden
const stadtSeed = (extra) => JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], ...extra });
const halten = async (page, key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
const weg = async (page) => { await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); return JSON.parse(await read(page)); };

test('Hafenhausen: Fahrrad aufsteigen, fahren, absteigen, bleibt geparkt', async () => {
  const L = stadtWert('CITY_LAND');
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true }, where: { x: L.x, z: L.z, f: L.f, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Aufsteigen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Absteigen")').waitFor({ timeout: 5000 });
  await halten(page, 'KeyW', 1500);
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Aufsteigen")').waitFor({ timeout: 5000 });
  const s = await weg(page);
  const p = s.city.parked.bike;
  assert.ok(p && [p.x, p.z, p.yaw].every(Number.isFinite), 'das Fahrrad ist geparkt');
  assert.equal(s.city.riding, '');
  assert.ok(Math.hypot(p.x - (L.x + 2), p.z - L.z) > 3, 'das Fahrrad ist weggefahren');
  assert.ok(Math.hypot(s.where.x - p.x, s.where.z - p.z) < 4, 'man steht neben dem Fahrrad');
  // neu laden: das Fahrrad steht noch da, wo man es abgestellt hat
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(500);
  const s2 = await weg(page);
  assert.deepEqual(s2.city.parked.bike, p);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: beim Fahren gespeichert und neu geladen steht man zu Fuß', async () => {
  const L = stadtWert('CITY_LAND');
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true, riding: 'bike', parked: { bike: { x: L.x + 2, z: L.z, yaw: 0 } } },
    where: { x: L.x + 2, z: L.z, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Aufsteigen")').waitFor({ timeout: 20000 });
  assert.equal(await page.locator('#btnCtx:has-text("Absteigen")').count(), 0, 'man fährt nicht mehr');
  const s = await weg(page);
  assert.equal(s.city.riding, '');
  assert.deepEqual(s.city.parked.bike, { x: L.x + 2, z: L.z, yaw: 0 }, 'das Fahrrad bleibt stehen');
  assert.ok(Math.hypot(s.where.x - (L.x + 2), s.where.z - L.z) > 0.5, 'man steht neben dem Fahrrad, nicht darauf');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: Roller kaufen im Fahrzeug-Laden, Werkstatt öffnen beim Fahren parkt ihn', async () => {
  const S = stadtWert('SHOP_AT');
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ ludins: 100, city: { visited: true }, where: { x: S.x, z: S.z, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Fahrzeug-Laden")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.click('#card .item:has(b:text-is("Roller")) button');
  let s = JSON.parse(await read(page));
  assert.equal(s.ludins, 40);
  assert.equal(s.city.vehicles.roller, true);
  assert.equal(s.city.vehicles.skate, false);
  await page.click('#card button:has-text("Tschüss")');
  await page.locator('#btnCtx:has-text("Aufsteigen")').waitFor({ timeout: 5000 }); // der Roller steht vor dem Laden
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Absteigen")').waitFor({ timeout: 5000 });
  s = JSON.parse(await read(page));
  assert.equal(s.city.riding, 'roller');
  await page.click('#btnAvatar');
  s = await weg(page);
  assert.equal(s.city.riding, '');
  const p = s.city.parked.roller;
  assert.ok(p && [p.x, p.z, p.yaw].every(Number.isFinite), 'der Roller ist geparkt');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: Fahrrad fährt nicht durch Häuser', async () => {
  const H = stadtWert('TEST_HOUSE'); // Haus direkt südlich der Flugplatz-Straße
  assert.ok(H.r > 3, 'TEST_HOUSE hat einen Radius');
  const { ctx, page, errors } = await newPage();
  const at = { x: H.x, z: H.z + H.r + 4 };
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true, parked: { bike: { ...at, yaw: Math.PI } } },
    where: { ...at, f: Math.PI, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Aufsteigen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Absteigen")').waitFor({ timeout: 5000 });
  await halten(page, 'KeyW', 2000);
  const s = await weg(page);
  assert.equal(s.city.riding, 'bike');
  assert.ok(s.where.z < at.z - 2, 'man ist auf das Haus zu gefahren');
  assert.ok(Math.hypot(s.where.x - H.x, s.where.z - H.z) >= H.r, 'man steht nicht im Haus');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: Fahrzeuge halten an Hindernissen an und rutschen nicht daran entlang', async () => {
  // schräg (45°) auf den Brunnen am Markt zu fahren, knapp neben der Mitte: hier laufen keine Menschen
  const B = stadtWert('FOUNTAIN');
  const r2 = v => Math.round(v * 100) / 100; // wie das Spiel beim Speichern rundet
  assert.deepEqual(B, { x: 0, z: -2985, r: 3.6 });
  const R = B.r + 0.35, f = -3 * Math.PI / 4, d = { x: Math.sin(f), z: Math.cos(f) }, n = { x: -d.z, z: d.x }; // n steht quer zur Fahrtrichtung
  const at = { x: r2(B.x + 3.2 * n.x - 6 * d.x), z: r2(B.z + 3.2 * n.z - 6 * d.z) };
  // dort berührt man den Brunnen zum ersten Mal
  const px = at.x - B.x, pz = at.z - B.z, pd = px * d.x + pz * d.z, t = -pd - Math.sqrt(pd * pd - (px * px + pz * pz - R * R));
  const touch = { x: at.x + t * d.x, z: at.z + t * d.z };
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true, parked: { bike: { ...at, yaw: f } } }, where: { ...at, f, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Aufsteigen")').waitFor({ timeout: 20000 });
  let s = await weg(page);
  assert.ok(Math.hypot(s.where.x - at.x, s.where.z - at.z) < 0.05, 'die Startstelle ist frei, man steht genau dort');
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Absteigen")').waitFor({ timeout: 5000 });
  await page.keyboard.down('KeyW');
  // warten, bis das Rad am Brunnen ist (auf langsamen Rechnern dauert die Fahrt länger, der Browser hängt manchmal kurz)
  let a = await weg(page);
  for (let i = 0; i < 50 && Math.hypot(a.where.x - touch.x, a.where.z - touch.z) >= 0.8; i++) {
    await page.waitForTimeout(300);
    a = await weg(page);
  }
  assert.ok(Math.hypot(a.where.x - touch.x, a.where.z - touch.z) < 0.8, 'man hält dort an, wo man den Brunnen berührt (Halt bei ' + a.where.x + ',' + a.where.z + ')');
  await page.waitForTimeout(1000);
  const b = await weg(page);
  await page.keyboard.up('KeyW');
  assert.equal(b.city.riding, 'bike');
  // ein paar Zentimeter geradeaus heranrollen ist erlaubt (kleinere Schritte bei langsamen Bildern), seitlich wegrutschen nicht
  const dx = b.where.x - a.where.x, dz = b.where.z - a.where.z;
  assert.ok(Math.abs(dx * n.x + dz * n.z) < 0.2, 'man rutscht nicht am Brunnen entlang');
  assert.ok(Math.hypot(b.where.x - touch.x, b.where.z - touch.z) < 0.8, 'man bleibt am Brunnen stehen');
  assert.ok(Math.hypot(b.where.x - B.x, b.where.z - B.z) >= B.r, 'man steht nicht im Brunnen');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: Cyber-Truck kaufen, einsteigen, hupen, bleibt nach Neuladen', async () => {
  const S = stadtWert('SHOP_AT');
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ ludins: 1000, city: { visited: true }, where: { x: S.x, z: S.z, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Fahrzeug-Laden")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.click('#card .item:has(b:text-is("Cyber-Truck")) button');
  let s = JSON.parse(await read(page));
  assert.equal(s.ludins, 200);
  assert.equal(s.city.vehicles.truck, true);
  await page.click('#card button:has-text("Tschüss")');
  await page.locator('#btnCtx:has-text("Einsteigen")').waitFor({ timeout: 5000 }); // der Truck steht vor dem Laden
  assert.ok(await page.locator('#btnHorn').isHidden(), 'zu Fuß gibt es keine Hupe');
  await page.click('#btnCtx');
  await page.locator('#btnHorn').waitFor({ state: 'visible', timeout: 5000 });
  assert.equal((await page.locator('#btnHorn').textContent()).trim(), '📯 Hupe');
  assert.ok((await page.locator('#btnHorn').boundingBox()).height >= 60, 'die Hupe ist ein großer Knopf');
  await page.click('#btnHorn');
  await page.locator('#btnCtx:has-text("Aussteigen")').waitFor({ timeout: 5000 });
  s = JSON.parse(await read(page));
  assert.equal(s.city.riding, 'truck');
  await page.click('#btnCtx');
  await page.locator('#btnHorn').waitFor({ state: 'hidden', timeout: 5000 });
  s = await weg(page);
  assert.equal(s.city.riding, '');
  // neu laden: der Truck gehört einem immer noch
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(500);
  s = await weg(page);
  assert.equal(s.city.vehicles.truck, true);
  assert.equal(s.ludins, 200);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: Cyber-Truck steckt die Nase nicht in Häuser', async () => {
  const H = stadtWert('TEST_HOUSE'); // Haus direkt südlich der Flugplatz-Straße
  const r2 = v => Math.round(v * 100) / 100;
  const at = { x: H.x, z: r2(H.z + H.r + 9) }; // auf der Straße, der Truck zeigt auf das Haus
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true, vehicles: { bike: true, truck: true }, parked: { truck: { ...at, yaw: Math.PI } } },
    where: { ...at, f: Math.PI, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Einsteigen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Aussteigen")').waitFor({ timeout: 5000 });
  await halten(page, 'KeyW', 2000);
  // lenkt man weiter gegen das Haus, gibt das Spiel einen Tipp
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Hier geht es nicht weiter. Lenk in eine andere Richtung.'), null, { timeout: 20000 });
  await page.keyboard.up('KeyW');
  const s = await weg(page);
  assert.equal(s.city.riding, 'truck');
  assert.ok(s.where.z < at.z - 2, 'man ist auf das Haus zu gefahren');
  // der Truck ist fast 6 m lang: seine Mitte bleibt mindestens 2 m weiter weg als die Hauswand
  assert.ok(Math.hypot(s.where.x - H.x, s.where.z - H.z) >= H.r + 2, 'die Nase vom Truck steckt nicht im Haus');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: Abschleppdienst bringt das Fahrrad für 10 Ludins zu dir', async () => {
  const me = { x: 30, z: -2985 }; // auf der Straße östlich vom Markt, weit weg vom Fahrrad am Flugplatz
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ ludins: 25, city: { visited: true }, where: { ...me, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnMap');
  await page.locator('#card button[data-tow="bike"]').click();
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Der Abschleppdienst kommt!'), null, { timeout: 5000 });
  let s = await weg(page);
  assert.equal(s.ludins, 15, '10 Ludins für den Abschleppdienst');
  const p = s.city.parked.bike;
  assert.ok(Math.hypot(p.x - me.x, p.z - me.z) < 6, 'der neue Parkplatz ist gleich neben dir (schon gespeichert)');
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Dein Fahrrad ist da!'), null, { timeout: 60000 });
  s = await weg(page);
  assert.deepEqual(s.city.parked.bike, p, 'das Fahrrad steht dort, wo es gespeichert wurde');
  assert.equal(s.city.riding, '');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: Abschleppdienst mit zu wenig Ludins geht nicht', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ ludins: 4, city: { visited: true }, where: { x: 30, z: -2985, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnMap');
  const b = page.locator('#card button[data-tow="bike"]');
  assert.ok(await b.isDisabled(), 'der Knopf ist grau');
  assert.match(await b.textContent(), /noch 6 L/);
  const s = await weg(page);
  assert.equal(s.ludins, 4);
  assert.equal(s.city.parked.bike, undefined, 'das Fahrrad bleibt am Flugplatz');
  assert.deepEqual(errors, []);
  await ctx.close();
});

const MEERESFISCHE = ['hering', 'makrele', 'scholle', 'hornhecht', 'dorsch'];
test('Hafenhausen: an der Kaimauer beißen Meeresfische', async () => {
  const { ctx, page, errors } = await newPage();
  // an der Kaimauer, der Blick geht nach Süden aufs Hafenbecken
  await seed(page, { [KEY]: stadtSeed({ book: {}, city: { visited: true }, where: { x: -50, z: -3111.8, f: Math.PI, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnFish');
  await page.waitForFunction(() => document.querySelector('#fishLbl').textContent === 'ZIEHEN!', null, { timeout: 60000, polling: 200 });
  await page.keyboard.press('Space');
  await page.locator('#card h2:has-text("gefangen")').waitFor();
  const s = JSON.parse(await read(page));
  const ids = Object.keys(s.book);
  assert.equal(ids.length, 1);
  assert.ok(MEERESFISCHE.includes(ids[0]), ids[0] + ' ist ein Meeresfisch');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Fischer Hannes am Hafen: Meeresfische verkaufen', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ ludins: 10, bucket: [{ id: 'hering', cm: 25, value: 6 }], city: { visited: true },
    where: { x: -80, z: -3106, f: Math.PI, boat: false } }) }); // vor der Theke von Hannes an der Kaimauer
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Fischer Hannes")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Fischer Hannes")').waitFor();
  assert.match(await page.textContent('#card'), /Moin/);
  await page.click('#card .tabs button:text-is("🐟 Verkaufen")');
  await page.click('#card button:has-text("Alles verkaufen (+6 Ludins)")');
  const s = JSON.parse(await read(page));
  assert.equal(s.ludins, 16);
  assert.deepEqual(s.bucket, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Abstand eines Punktes zu den Schienen (CITY_RING, geschlossen), direkt aus index.html gelesen
function schienenAbstand(p) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ring = [...html.match(/const CITY_RING=\[([^\]]*)\]/)[1].matchAll(/\{x:(-?\d+(?:\.\d+)?),z:(-?\d+(?:\.\d+)?)\}/g)].map(([, x, z]) => ({ x: Number(x), z: Number(z) }));
  let best = Infinity;
  ring.forEach((a, i) => { const b = ring[(i + 1) % ring.length], l = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / l));
    best = Math.min(best, Math.hypot(a.x + (b.x - a.x) * k - p.x, a.z + (b.z - a.z) * k - p.z)); });
  return best;
}

test('Hafenhausen: auf den Schienen kann man nicht parken', async () => {
  const L = stadtWert('CITY_LAND'), S = stadtWert('SHOP_AT');
  // die Startplätze der Fahrzeuge liegen weit weg von den Schienen
  for (const p of [{ x: L.x + 2, z: L.z }, { x: S.x - 1.8, z: S.z + 1.5 }, { x: S.x + 1.8, z: S.z + 1.5 }, { x: S.x, z: S.z + 4 }])
    assert.ok(schienenAbstand(p) > 6, 'Startplatz eines Fahrzeugs liegt nicht auf den Schienen');
  // 4 m neben den Schienen (die Bahn fährt bei x = −60), hinter der Bahn (sie steht am Flugplatz und fährt nach Süden).
  // Das Rad zeigt nach −x, also auf die Schienen zu.
  const at = { x: -56, z: -2955 }, f = -Math.PI / 2;
  assert.ok(Math.abs(schienenAbstand(at) - 4) < 0.01);
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true, parked: { bike: { ...at, yaw: f } } }, where: { ...at, f, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Aufsteigen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Absteigen")').waitFor({ timeout: 5000 });
  // auf die Schienen fahren und dort anhalten
  await page.keyboard.down('KeyW');
  let s;
  for (let i = 0; i < 300; i++) { s = await weg(page); if (s.where.x <= -58.5) break; await page.waitForTimeout(30); }
  await page.keyboard.up('KeyW');
  s = await weg(page);
  assert.ok(schienenAbstand(s.where) < 2.2, 'man steht mit dem Rad auf den Schienen (' + s.where.x + ')');
  await page.click('#btnCtx');
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Hier fährt die Straßenbahn. Stell dein Fahrzeug an den Rand.'), null, { timeout: 5000 });
  s = await weg(page);
  assert.equal(s.city.riding, 'bike', 'man fährt noch');
  assert.ok(await page.locator('#btnCtx:has-text("Absteigen")').isVisible());
  // Werkstatt öffnen beim Fahren auf den Schienen: das Rad wird trotzdem nicht auf die Schienen gestellt
  await page.click('#btnAvatar');
  s = await weg(page);
  assert.equal(s.city.riding, '');
  assert.ok(schienenAbstand(s.city.parked.bike) >= 2.2, 'das Rad steht nicht auf den Schienen');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: auf den Schienen gespeichert, nach dem Neuladen steht das Fahrzeug nicht mehr darauf', async () => {
  const at = { x: -60, z: -2955 };
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true, riding: 'bike', parked: { bike: { ...at, yaw: 0 } } }, where: { ...at, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(500);
  const s = await weg(page);
  assert.equal(s.city.riding, '');
  assert.ok(schienenAbstand(s.city.parked.bike) >= 2.2, 'das Rad steht nicht mehr auf den Schienen');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Straßenbahn: fährt auf CITY_RING (TRAM_ROUTE) im Kreis, Haltestellen der Reihe nach Flugplatz → Markt → Hafen → Park
const HALTESTELLEN = ['STOP_FLUGPLATZ', 'STOP_MARKT', 'STOP_HAFEN', 'STOP_PARK'];
test('Hafenhausen: alle Haltestellen liegen genau auf der Strecke der Straßenbahn', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /const TRAM_ROUTE=CITY_RING;/, 'die Bahn fährt auf dem Ring');
  const m = html.match(/const CITY_RING=\[([^\]]*)\]/);
  assert.ok(m, 'CITY_RING steht in index.html');
  const ring = [...m[1].matchAll(/\{x:(-?\d+(?:\.\d+)?),z:(-?\d+(?:\.\d+)?)\}/g)].map(([, x, z]) => ({ x: Number(x), z: Number(z) }));
  assert.ok(ring.length >= 4);
  const cum = [0];
  for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; cum.push(cum[i] + Math.hypot(b.x - a.x, b.z - a.z)); }
  const along = p => { for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], l = cum[i + 1] - cum[i];
    const k = ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / (l * l);
    if (k >= 0 && k <= 1 && Math.hypot(a.x + (b.x - a.x) * k - p.x, a.z + (b.z - a.z) * k - p.z) < 1e-6) return cum[i] + k * l; } return null; };
  const s = HALTESTELLEN.map(n => along(stadtWert(n)));
  s.forEach((v, i) => assert.ok(v !== null, HALTESTELLEN[i] + ' liegt auf der Strecke'));
  const L = cum[ring.length];
  for (let i = 0; i < s.length; i++) {
    const d = ((s[(i + 1) % s.length] - s[i]) % L + L) % L;
    assert.ok(d > 0 && d <= 240, 'von ' + HALTESTELLEN[i] + ' zur nächsten Haltestelle sind es höchstens 240 m (' + d + ')');
  }
  assert.equal(s.reduce((a, v, i) => a + ((s[(i + 1) % s.length] - v) % L + L) % L, 0), L, 'die Reihenfolge ist Flugplatz → Markt → Hafen → Park');
});

test('Hafenhausen: Straßenbahn einsteigen und an der nächsten Haltestelle aussteigen', async () => {
  const F = stadtWert('STOP_FLUGPLATZ'), MK = stadtWert('STOP_MARKT');
  // kleines Fenster: der unsichtbare Browser malt dann schneller, die Fahrt (gut 24 s Spielzeit) dauert nicht so lange
  const { ctx, page, errors } = await newPage({ viewport: { width: 640, height: 480 } });
  // 5,5 m neben dem Gleis (die Bahn fährt in der Straßenmitte bei x = F.x): nah an der Haltestelle, aber nicht in der Bahn
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true }, where: { x: F.x + 5.5, z: F.z, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  // die Bahn steht am Flugplatz. Verpasst man sie, kommt sie nach einer ganzen Runde wieder
  // (gut 120 s Spielzeit; der unsichtbare Browser läuft nur etwa halb so schnell, darum bis zu 300 s)
  await page.locator('#btnCtx:has-text("🚋 Einsteigen")').waitFor({ timeout: 300000 });
  await page.click('#btnCtx');
  assert.ok(await page.locator('#btnHorn').isHidden(), 'in der Straßenbahn gibt es keine Hupe');
  await page.locator('#btnCtx:has-text("Aussteigen")').waitFor({ timeout: 300000 }); // erst an der nächsten Haltestelle (auf langsamen Rechnern dauert das)
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Aussteigen")').waitFor({ state: 'hidden', timeout: 5000 });
  const s = await weg(page);
  assert.ok(Math.hypot(s.where.x - MK.x, s.where.z - MK.z) < 8, 'man steht an der Haltestelle Markt');
  assert.equal(s.city.riding, '');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Hafenhausen: in der Straßenbahn wegfliegen geht nicht, speichern setzt an die letzte Haltestelle', async () => {
  const stops = HALTESTELLEN.map(stadtWert);
  const { ctx, page, errors } = await newPage();
  // gespeichert, während man mit der Bahn zwischen Markt und Hafen fuhr (mitten auf der Strecke)
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true, riding: 'tram' }, where: { x: 0, z: -3075, f: Math.PI, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#btnCtx:has-text("Fliegen")').count(), 0, 'hier gibt es kein Flugzeug');
  const s = await weg(page);
  assert.equal(s.city.riding, '');
  assert.ok(stops.some(p => Math.hypot(s.where.x - p.x, s.where.z - p.z) < 8), 'man steht zu Fuß an einer Haltestelle');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Weltzeit: die Uhr im Spiel steht fest auf iso (deutsche Zeit). Für Tests, die eine bestimmte Tageszeit brauchen.
async function zeitSeite(iso) {
  const { ctx, page, errors } = await newPage({ timezoneId: 'Europe/Berlin' });
  await ctx.clock.setFixedTime(new Date(iso));
  return { ctx, page, errors };
}
const SEE_ORT = { x: 4, z: -951, f: 0, boat: false }; // am Heimat-See, da landet das Flugzeug
const phase = page => page.evaluate(() => document.body.dataset.phase);

test('Weltzeit: Nachmittag im Juni ist Tag', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-06-21T14:00:00+02:00');
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, where: SEE_ORT }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('body[data-phase="tag"]').waitFor({ state: 'attached', timeout: 5000 });
  assert.match(await page.textContent('#clockChip'), /14:00/);
  assert.match(await page.textContent('#clockChip'), /☀️/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Weltzeit: 23 Uhr ist Nacht, mit Sternen', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-06-21T23:00:00+02:00');
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, where: SEE_ORT }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('body[data-phase="nacht"]').waitFor({ state: 'attached', timeout: 5000 });
  assert.match(await page.textContent('#clockChip'), /🌙 23:00/);
  assert.equal((await page.evaluate(() => window.__test.welt())).stars, true, 'die Sterne sind zu sehen');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Weltzeit: um 19 Uhr ist am Amazonas Nacht, in Deutschland Tag', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-06-21T19:00:00+02:00');
  const VX = 10 * Math.sin(1) + 24; // wie im Spiel: riverX(0)+24
  await seed(page, { [KEY]: stadtSeed({ where: { x: VX + 13 - 3.4, z: 1, f: Math.PI / 2, boat: false } }) }); // am Dorf, neben dem Flugzeug
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('body[data-phase]').waitFor({ state: 'attached', timeout: 5000 });
  assert.equal(await phase(page), 'nacht', 'am Amazonas geht die Sonne um 18 Uhr unter');
  // zum Heimat-See fliegen: dort gilt gleich die deutsche Sonne
  await page.locator('#btnCtx:has-text("Fliegen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#deMap').waitFor();
  await page.click('[data-dest="see"]');
  await page.locator('body[data-phase="tag"]').waitFor({ state: 'attached', timeout: 15000 });
  assert.ok((await weg(page)).where.z < -600, 'man ist am Heimat-See');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Weltzeit: Jahreszeit', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-04-15T12:00:00+02:00');
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, where: SEE_ORT }) });
  for (const [iso, jz] of [['2026-04-15T12:00:00+02:00', 'fruehling'], ['2026-07-15T12:00:00+02:00', 'sommer'],
    ['2026-10-15T12:00:00+02:00', 'herbst'], ['2026-12-15T12:00:00+01:00', 'winter']]) {
    await ctx.clock.setFixedTime(new Date(iso));
    await startGame(page);
    await page.locator('body[data-season]').waitFor({ state: 'attached', timeout: 5000 });
    assert.equal(await page.evaluate(() => document.body.dataset.season), jz, iso);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Jahreszeiten: Farbe von Laub und Wiese (Faktor auf die Farben) und die Blüten im Frühling, nur in Deutschland
// laubFade/wieseFade: wie stark Grün ausbleicht (true = mehr als 0). Fichten haben das Material der Wiese (Nadelbäume färben sich nicht).
const SAISON = { fruehling: { laub: '#ffe6ef', wiese: '#ffffff', blueten: true, laubFade: false, wieseFade: false, fichten: true },
  sommer: { laub: '#ffffff', wiese: '#ffffff', blueten: false, laubFade: false, wieseFade: false, fichten: true },
  herbst: { laub: '#ffb35c', wiese: '#ffffff', blueten: false, laubFade: true, wieseFade: false, fichten: true },
  winter: { laub: '#e8eef2', wiese: '#eef3f6', blueten: false, laubFade: true, wieseFade: true, fichten: true } };
const saisonWerte = w => ({ laub: w.laub, wiese: w.wiese, blueten: w.blueten, laubFade: w.laubFade > 0, wieseFade: w.wieseFade > 0, fichten: w.fichten });
test('Jahreszeiten: am Heimat-See wechseln Laub und Wiese, am Amazonas bleibt alles grün', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-04-15T12:00:00+02:00');
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, where: SEE_ORT }) });
  for (const [iso, jz] of [['2026-04-15T12:00:00+02:00', 'fruehling'], ['2026-07-15T12:00:00+02:00', 'sommer'],
    ['2026-10-15T12:00:00+02:00', 'herbst'], ['2026-12-15T12:00:00+01:00', 'winter']]) {
    await ctx.clock.setFixedTime(new Date(iso));
    await startGame(page);
    await page.click('#btnGo');
    await page.locator('body[data-region="de"][data-season="' + jz + '"]').waitFor({ state: 'attached', timeout: 5000 });
    const w = await page.evaluate(() => window.__test.welt());
    assert.deepEqual(saisonWerte(w), SAISON[jz], jz);
  }
  // am 15.12. ins Dorf am Amazonas: das Datum bleibt Winter, aber dort gibt es keine Jahreszeiten-Farben
  const VX = 10 * Math.sin(1) + 24; // wie im Spiel: riverX(0)+24
  await page.evaluate(x => window.__test.warp(x, 2), VX - 6);
  await page.locator('body[data-region="amazonas"]').waitFor({ state: 'attached', timeout: 5000 });
  assert.equal(await page.evaluate(() => document.body.dataset.season), 'winter');
  const w = await page.evaluate(() => window.__test.welt());
  assert.deepEqual(saisonWerte(w), SAISON.sommer, 'Amazonas: neutral');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Jahreszeiten: Fichten bleiben im Herbst grün (Flussplatz und Hafenhausen)', async () => {
  const neckar = flussplaetze().find(s => s.id === 'bw-neckar');
  for (const where of [landeplatz(neckar), { ...stadtWert('CITY_LAND'), boat: false }]) {
    const { ctx, page, errors } = await zeitSeite('2026-10-15T12:00:00+02:00');
    await seed(page, { [KEY]: stadtSeed({ flussAt: 'bw-neckar', where }) });
    await startGame(page);
    await page.click('#btnGo');
    await page.locator('body[data-region="de"][data-season="herbst"]').waitFor({ state: 'attached', timeout: 5000 });
    const w = await page.evaluate(() => window.__test.welt());
    assert.equal(w.fichten, true, 'alle Fichten haben das Material der Wiese (z = ' + where.z + ')');
    assert.equal(w.wiese, '#ffffff', 'Fichten: Farbfaktor weiß');
    assert.equal(w.wieseFade, 0, 'Fichten: kein Ausbleichen');
    assert.equal(w.laub, '#ffb35c', 'Laubbäume: Herbst');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

// Position einer Infotafel aus INFOBOARDS lesen: {id:'…',x:VX±a,z:b,…} (x relativ zum Dorf)
function tafelOrt(id) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = html.match(new RegExp("\\{id:'" + id + "',x:VX([+-]\\d+(?:\\.\\d+)?),z:(-?\\d+(?:\\.\\d+)?),"));
  assert.ok(m, 'Infotafel ' + id + ' steht in INFOBOARDS');
  return { x: 10 * Math.sin(1) + 24 + Number(m[1]), z: Number(m[2]) }; // VX wie im Spiel: riverX(0)+24
}

test('Jahreszeiten: Infotafel Regenzeit am Amazonas', async () => {
  const T = tafelOrt('regenzeit');
  const { ctx, page, errors } = await zeitSeite('2026-12-15T12:00:00+01:00');
  await seed(page, { [KEY]: stadtSeed({ where: { x: T.x - 2, z: T.z, f: Math.PI / 2, boat: false } }) }); // vor der Tafel (Flussseite)
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('body[data-region="amazonas"][data-season="winter"]').waitFor({ state: 'attached', timeout: 5000 });
  const knopf = page.locator('#btnCtx:has-text("Infotafel lesen")');
  await knopf.waitFor({ timeout: 20000 });
  await knopf.click();
  await page.locator('#card.info').waitFor();
  const text = await page.textContent('#card');
  assert.match(text, /Regenzeit/);
  assert.match(text, /Trockenzeit/);
  assert.match(text, /Äquator/);
  assert.match(text, /Neues Wissen! \+5 Ludins/);
  assert.deepEqual((await weg(page)).infoRead, ['regenzeit']);
  assert.ok((await page.evaluate(([x, z]) => window.__test.hoehe(x, z), [T.x, T.z])) > 0.5, 'die Tafel steht an Land');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Sonnenhöhe wie im Spiel (sunElevation in index.html), für Deutschland: Sonnen-Uhrzeit = UTC + 10/15 Stunden
function sonnenhoehe(d) {
  const r = Math.PI / 180, doy = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1;
  const de = -23.44 * Math.cos(2 * Math.PI * (doy + 10) / 365) * r, ha = 15 * (d.getUTCHours() + d.getUTCMinutes() / 60 + 10 / 15 - 12) * r, la = 51 * r;
  return Math.asin(Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(ha)) / r;
}

test('Weltzeit: bei Sonnenuntergang ist Dämmerung', async () => {
  // heute, erste Minute nach Sonnenuntergang (Sonne gerade unter dem Horizont): sicher Dämmerung, egal an welchem Tag im Jahr
  const d = new Date(); d.setUTCHours(12, 0, 0, 0);
  while (sonnenhoehe(d) > 0) d.setUTCMinutes(d.getUTCMinutes() + 1);
  const h = sonnenhoehe(d);
  assert.ok(h > -3 && h <= 0, 'Sonne knapp unter dem Horizont: ' + h);
  const { ctx, page, errors } = await zeitSeite(d.toISOString());
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, where: SEE_ORT }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('body[data-phase="daemmerung"]').waitFor({ state: 'attached', timeout: 5000 });
  assert.match(await page.textContent('#clockChip'), /🌅/);
  assert.equal((await page.evaluate(() => window.__test.welt())).phase, 'daemmerung');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Weltzeit: in der Avatar-Werkstatt ist immer Tag, danach wieder die echte Zeit', async () => {
  const TAG = '#a6dccd', NACHT = '#22335e';
  const { ctx, page, errors } = await zeitSeite('2026-10-27T23:00:00+01:00');
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, where: SEE_ORT }) });
  await startGame(page); // das Spiel beginnt in der Werkstatt
  const welt = () => page.evaluate(() => window.__test.welt());
  let w = await welt();
  assert.equal(w.sky, TAG, 'Werkstatt beim Start: Tageshimmel');
  assert.equal(w.stars, false);
  await page.click('#btnGo');
  w = await welt();
  assert.equal(w.sky, NACHT, 'nach der Werkstatt: Nacht');
  assert.equal(w.stars, true);
  await page.click('#btnAvatar');
  await page.locator('#btnGo').waitFor({ state: 'visible' });
  w = await welt();
  assert.equal(w.sky, TAG, 'Werkstatt wieder offen: Tageshimmel');
  assert.equal(w.phase, 'nacht', 'die Weltzeit bleibt trotzdem Nacht');
  await page.click('#btnGo');
  assert.equal((await welt()).sky, NACHT, 'Werkstatt zu: wieder Nacht');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Fische nach Uhrzeit: welcher Fisch wann beißt, steht in index.html bei FISH (zeit:'nacht'|'tag'|'daemmerung')
function fischZeiten() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), z = {};
  for (const m of html.matchAll(/id:'(\w+)'[^}]*?zeit:'(\w+)'/g)) z[m[1]] = m[2];
  return z;
}
function zeitFenster() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const i = html.indexOf('const ZEIT_FENSTER='), j = html.indexOf('};', i);
  assert.ok(i >= 0, 'ZEIT_FENSTER steht in index.html');
  return new Function('return ' + html.slice(i + 'const ZEIT_FENSTER='.length, j + 1))();
}
const imFenster = (fenster, h) => fenster.some(([a, b]) => h >= a && h < b);
// Angeln braucht laufende Spielzeit (ein Fisch beißt erst nach einer Weile). Mit setFixedTime steht sie still, darum hier nur
// die Startzeit festlegen (deutsche Zeit), danach läuft die Uhr normal weiter.
const startZeitSeite = iso => newPage({ timezoneId: 'Europe/Berlin' }, iso);
// 3 Fische fangen (und wieder freilassen). Beim ersten Biss fragt der Test das Spiel außerdem 400-mal, welcher Fisch beißen würde.
async function dreiFaenge(page) {
  const probe = { angel: [], reuse: [] };
  for (let i = 0; i < 3; i++) {
    await page.click('#btnFish');
    await page.waitForFunction(() => document.querySelector('#fishLbl').textContent === 'ZIEHEN!', null, { timeout: 60000, polling: 200 });
    if (i === 0) probe.angel = await page.evaluate(() => window.__test.fische(400));
    await page.keyboard.press('Space');
    await page.locator('#card h2:has-text("gefangen")').waitFor();
    await page.click('#card .btns button:has-text("Freilassen"), #card .btns button:has-text("Zurücksetzen")');
    await page.locator('#modal').waitFor({ state: 'hidden' });
  }
  return probe;
}

test('Fische nach Uhrzeit: um 23 Uhr beißt am See kein Tag-Fisch', async () => {
  const zeit = fischZeiten();
  assert.equal(zeit.hecht, 'tag', 'der Hecht jagt tagsüber');
  const { ctx, page, errors } = await startZeitSeite('2026-06-21T23:00:00+02:00');
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, book: {}, where: { x: 10, z: -940, f: 0, boat: false } }) }); // am Südufer, Blick auf den See
  await startGame(page);
  await page.click('#btnGo');
  const probe = await dreiFaenge(page);
  const s = JSON.parse(await read(page));
  const ids = Object.keys(s.book);
  assert.ok(ids.length >= 1);
  for (const id of ids) assert.notEqual(zeit[id], 'tag', id + ' beißt nur tagsüber');
  assert.equal(probe.angel.length, 400);
  assert.deepEqual(probe.angel.filter(id => zeit[id] === 'tag'), [], 'kein Tag-Fisch an der Angel');
  const reuse = await page.evaluate(() => window.__test.reuse('see', 400));
  assert.deepEqual(reuse.filter(id => zeit[id] === 'tag'), [], 'kein Tag-Fisch in der Reuse');
  assert.ok(probe.angel.includes('zander') || reuse.includes('zander'), 'nachts beißt der Zander');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Fische nach Uhrzeit: um 12 Uhr kein Nacht-Fisch', async () => {
  const zeit = fischZeiten();
  const rhein = flussplaetze().find(s => s.id === 'bw-rhein');
  assert.ok(rhein.fish.some(id => zeit[id] === 'nacht'), 'im Rhein leben auch Nacht-Fische');
  const { ctx, page, errors } = await startZeitSeite('2026-06-21T12:00:00+02:00');
  await seed(page, { [KEY]: stadtSeed({ book: {}, flussAt: 'bw-rhein', where: { x: 0, z: -1800 - rhein.hw + 6, f: 0, boat: false } }) }); // vorne auf dem Steg
  await startGame(page);
  await page.click('#btnGo');
  const probe = await dreiFaenge(page);
  const s = JSON.parse(await read(page));
  const ids = Object.keys(s.book);
  assert.ok(ids.length >= 1);
  for (const id of ids) assert.notEqual(zeit[id], 'nacht', id + ' beißt nur abends und nachts');
  assert.deepEqual(probe.angel.filter(id => zeit[id] === 'nacht'), [], 'kein Nacht-Fisch an der Angel');
  assert.ok(probe.angel.every(id => rhein.fish.includes(id)), 'nur Rhein-Fische');
  const reuse = await page.evaluate(() => window.__test.reuse('amazonas', 400));
  assert.deepEqual(reuse.filter(id => zeit[id] === 'nacht'), [], 'kein Nacht-Fisch in der Reuse am Amazonas');
  assert.ok(reuse.includes('pfauen'), 'mittags kann der Pfauenbarsch in die Reuse');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Fische nach Uhrzeit: um 17 Uhr im Dezember ist jeder Fisch möglich', () => {
  const zeit = fischZeiten(), F = zeitFenster();
  // die festen Zeiten aus dem Plan: nacht 16–6 Uhr, tag 6–18 Uhr, daemmerung 5–9 und 16–21 Uhr
  assert.deepEqual(F, { nacht: [[16, 24], [0, 6]], tag: [[6, 18]], daemmerung: [[5, 9], [16, 21]] });
  assert.ok(Object.keys(zeit).length >= 5, 'einige Fische haben eine Zeit');
  for (const [id, z] of Object.entries(zeit)) {
    assert.ok(F[z], id + ': unbekannte Zeit ' + z);
    assert.ok(imFenster(F[z], 17), id + ' (' + z + ') beißt um 17 Uhr');
    assert.ok(imFenster(F[z], 17.99), id + ' (' + z + ') beißt um 17:59');
  }
});

test('Fischbuch zeigt Zeiten', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], book: { ...ALT_V1.book, antennen: { n: 1, best: 30 } } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnBook');
  await page.locator('#card .bk').first().waitFor({ timeout: 5000 });
  assert.match(await page.textContent('#card'), /🌙 abends und nachts/);
  assert.match(await page.textContent('#card .bk:has-text("Antennenwels")'), /🌙 abends und nachts/, 'gefangener Fisch zeigt die Zeit');
  assert.ok(await page.locator('#card .bk:has(.unknown):has-text("☀️ tagsüber")').count() >= 1, 'auch bei „?“-Fischen steht die Zeit');
  assert.doesNotMatch(await page.textContent('#card .bk:has-text("Piranha")'), /🌙|☀️|🌅/, 'Fische ohne feste Zeit zeigen keine');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Öffnungszeiten: die Läden sind von 8 bis 22 Uhr offen (SHOP_HOURS). Seed-Ort: neben Rosa bzw. Opa Tiago.
const VX_TEST = 10 * Math.sin(1) + 24;
const NEBEN_ROSA = { x: VX_TEST + 1, z: -1, f: 0, boat: false };
const NEBEN_TIAGO = { x: 33.8, z: 2.6, f: 0, boat: false };

test('Läden: um 23 Uhr hat Rosa zu', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-06-21T23:00:00+02:00');
  await seed(page, { [KEY]: stadtSeed({ where: NEBEN_ROSA }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Geschlossen")').waitFor({ timeout: 5000 });
  assert.equal((await page.textContent('#btnCtx')).trim(), '🌙 Geschlossen – öffnet um 8 Uhr');
  await page.click('#btnCtx');
  assert.equal(await page.locator('#modal').isVisible(), false, 'der Laden geht nicht auf');
  assert.equal(await page.locator('#card').isVisible(), false);
  assert.equal(await page.textContent('#toast'), 'Der Laden ist zu, bis 8 Uhr. Angeln geht immer. Deine Fische bleiben im Eimer.');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Läden: um 9 Uhr hat Rosa offen', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-06-21T09:00:00+02:00');
  await seed(page, { [KEY]: stadtSeed({ where: NEBEN_ROSA }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Rosa")').waitFor({ timeout: 5000 });
  assert.doesNotMatch(await page.textContent('#btnCtx'), /Geschlossen/);
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Rosas Fischhandel")').waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Läden: Opa Tiago macht um 22 Uhr zu und um 8 Uhr auf', async () => {
  for (const [iso, zu] of [['2026-06-21T21:59:00+02:00', false], ['2026-06-21T22:00:00+02:00', true], ['2026-06-21T07:59:00+02:00', true], ['2026-06-21T08:00:00+02:00', false]]) {
    const { ctx, page, errors } = await zeitSeite(iso);
    await seed(page, { [KEY]: stadtSeed({ where: NEBEN_TIAGO }) });
    await startGame(page);
    await page.click('#btnGo');
    await page.locator('#btnCtx').waitFor({ timeout: 5000 });
    const t = await page.textContent('#btnCtx');
    assert.equal(/Geschlossen/.test(t), zu, iso + ': ' + t);
    if (!zu) assert.match(t, /Opa Tiago/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Läden: die Schilder nennen die Öffnungszeit', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const name of ["'Rosas'", "'Opa Tiagos'", "'Fischer Hannes'"]) {
    const i = html.indexOf('fillText(' + name);
    assert.ok(i > 0, name + ' gefunden');
    assert.match(html.slice(i, i + 700), /SHOP_HOURS_TXT/, name + ': Schild nennt die Öffnungszeit');
  }
  assert.match(html, /makeSign\(s\.name,[^;]*SHOP_HOURS_TXT/, 'Fahrzeug-Laden');
  assert.match(html, /const SHOP_HOURS_TXT=SHOP_HOURS\.auf\+'–'\+SHOP_HOURS\.zu\+' Uhr'/, 'der Text ist „8–22 Uhr“');
});

test('Eimer: Fische freilassen geht immer', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-06-21T23:00:00+02:00');
  await seed(page, { [KEY]: stadtSeed({ ludins: 77, bucket: [{ id: 'hering', cm: 25, value: 6 }, { id: 'hecht', cm: 60, value: 50 }] }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnBucket');
  await page.locator('#card h2:has-text("Dein Eimer")').waitFor();
  const h = await page.locator('#btnRelease').evaluate(e => e.getBoundingClientRect().height);
  assert.ok(h >= 60, 'Knopf mindestens 60 px hoch: ' + h);
  await page.click('#btnRelease');
  // erst fragen, nicht gleich alles freilassen
  await page.locator('#btnReleaseOk').waitFor();
  assert.equal((await weg(page)).bucket.length, 2, 'ohne „Ja“ bleibt alles im Eimer');
  const h2 = await page.locator('#btnReleaseOk').evaluate(e => e.getBoundingClientRect().height);
  assert.ok(h2 >= 60, 'Bestätigen-Knopf mindestens 60 px: ' + h2);
  await page.click('#btnReleaseOk');
  const s = await weg(page);
  assert.deepEqual(s.bucket, []);
  assert.equal(s.ludins, 77, 'Freilassen bringt keine Ludins');
  assert.match(await page.textContent('#toast'), /Platsch! Deine Fische schwimmen wieder frei\./);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Eimer: leerer Eimer hat keinen Freilassen-Knopf', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ bucket: [] }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnBucket');
  await page.locator('#card h2:has-text("Dein Eimer")').waitFor();
  assert.equal(await page.locator('#btnRelease').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Verkehrsregeln: wer schnell gegen etwas fährt, bekommt einen Strafzettel (Rad, Roller, Skateboard 5 Ludins, Truck 20 Ludins)
async function truckGegenHaus(ludins, ms) {
  const H = stadtWert('TEST_HOUSE'); // Haus direkt südlich der Flugplatz-Straße (wie im Test „Cyber-Truck steckt die Nase nicht in Häuser“)
  const r2 = v => Math.round(v * 100) / 100;
  const at = { x: H.x, z: r2(H.z + H.r + 9) }; // auf der Straße, der Truck zeigt auf das Haus
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ ludins, city: { visited: true, vehicles: { bike: true, truck: true }, parked: { truck: { ...at, yaw: Math.PI } } },
    where: { ...at, f: Math.PI, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Einsteigen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Aussteigen")').waitFor({ timeout: 5000 });
  await halten(page, 'KeyW', ms);
  const s = await weg(page);
  assert.equal(s.city.riding, 'truck');
  assert.ok(s.where.z < at.z - 2, 'man ist auf das Haus zu gefahren');
  return { ctx, page, errors, s };
}

test('Verkehr: Truck schnell gegen Haus kostet 20 Ludins', async () => {
  const { ctx, page, errors, s } = await truckGegenHaus(100, 2000);
  assert.equal(s.ludins, 80);
  assert.match(await page.textContent('#toast'), /🚨 Strafzettel! Du bist gegen .+ gefahren\. −20 Ludins/);
  assert.match(await page.textContent('#toast'), /Fahr langsamer: wisch nur ein kleines Stück\./, 'der Strafzettel sagt, wie es besser geht');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Verkehr: Strafe macht Ludins nie negativ', async () => {
  const { ctx, page, errors, s } = await truckGegenHaus(7, 2000);
  assert.equal(s.ludins, 0);
  assert.match(await page.textContent('#toast'), /Strafzettel/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Verkehr: eine Strafe pro Aufprall', async () => {
  const { ctx, errors, s } = await truckGegenHaus(100, 3000); // 3 s lang gegen das Haus drücken
  assert.equal(s.ludins, 80, 'nur ein Strafzettel');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Verkehr: Fahrrad gegen geparkten Truck kostet 5', async () => {
  // auf dem Marktplatz (keine Schienen, der Brunnen ist 10 m weg): das Rad fährt nach −x, der Truck steht quer davor
  const at = { x: 15, z: -2975 }, f = -Math.PI / 2, T = { x: 6, z: -2975 };
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ ludins: 50, city: { visited: true, vehicles: { bike: true, truck: true },
    parked: { bike: { ...at, yaw: f }, truck: { ...T, yaw: 0 } } }, where: { ...at, f, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Aufsteigen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Absteigen")').waitFor({ timeout: 5000 });
  // fahren, bis das Rad am Truck ist (auf langsamen Rechnern dauert die Fahrt länger), dann noch 1 s weiter drücken
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Strafzettel'), null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');
  const s = await weg(page);
  assert.equal(s.city.riding, 'bike');
  assert.ok(s.where.x < at.x - 2, 'man ist auf den Truck zu gefahren');
  assert.ok(s.where.x > T.x + 1.4, 'das Rad fährt nicht durch den Truck (' + s.where.x + ')');
  assert.equal(s.ludins, 45);
  assert.match(await page.textContent('#toast'), /Strafzettel/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Menschen nach Uhrzeit: nachts sind nur 4 unterwegs, am Samstagvormittag fast alle (auch die Kinder)
test('Menschen schlafen nachts', async () => {
  const L = stadtWert('CITY_LAND');
  for (const [iso, ok] of [['2026-10-27T23:00:00+01:00', n => n <= 4], ['2026-10-31T10:00:00+01:00', n => n >= 20]]) {
    const { ctx, page, errors } = await startZeitSeite(iso);
    await seed(page, { [KEY]: stadtSeed({ city: { visited: true }, where: { x: L.x, z: L.z, f: L.f, boat: false } }) });
    await startGame(page);
    await page.click('#btnGo');
    await page.waitForFunction(() => document.body.dataset.leute !== undefined, null, { timeout: 20000 });
    const n = Number(await page.evaluate(() => document.body.dataset.leute));
    assert.ok(ok(n), iso + ': ' + n + ' Menschen unterwegs');
    if (iso.includes('T23')) { // nachts sind nur die ersten 4 Erwachsenen (nach Bau-Index) wach, keine Kinder (Ruling R14)
      const alle = await page.evaluate(() => Array.from({ length: 24 }, (_, k) => window.__test.nachbar(k)));
      const erste4 = alle.map((p, k) => ({ ...p, k })).filter(p => p.kid === false).slice(0, 4).map(p => p.k);
      assert.ok(alle.every(p => typeof p.kid === 'boolean'), 'nachbar(k).kid sagt, ob es ein Kind ist');
      assert.deepEqual(alle.map((p, k) => p.sichtbar ? k : -1).filter(k => k >= 0), erste4, 'wach sind genau die ersten 4 Erwachsenen');
      assert.equal(n, 4);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Menschen laufen nicht durch Fahrzeuge', async () => {
  const S = stadtWert('SHOP_AT');
  const { ctx, page, errors } = await startZeitSeite('2026-10-31T10:00:00+01:00');
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true, vehicles: { bike: true, truck: true } }, where: { x: S.x, z: S.z, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Einsteigen")').waitFor({ timeout: 20000 }); // der Truck steht vor dem Laden
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Aussteigen")').waitFor({ timeout: 5000 });
  // einen Menschen suchen, der gerade lange geradeaus läuft, weit weg von den Schienen. 8 m vor ihm parkt der Truck, genau auf seinem Weg.
  let wahl = null;
  for (let tries = 0; tries < 20 && !wahl; tries++) {
    const alle = await page.evaluate(() => Array.from({ length: 24 }, (_, k) => window.__test.nachbar(k)));
    for (let k = 0; k < alle.length && !wahl; k++) {
      const p = alle[k], l = Math.hypot(p.ziel.x - p.x, p.ziel.z - p.z);
      if (!p.sichtbar || l < 16) continue;
      const d = { x: (p.ziel.x - p.x) / l, z: (p.ziel.z - p.z) / l }, T = { x: p.x + d.x * 8, z: p.z + d.z * 8 };
      if ([-2, 0, 2].every(o => schienenAbstand({ x: T.x + d.x * o, z: T.z + d.z * o }) > 5)) wahl = { k, T, yaw: Math.atan2(d.x, d.z) };
    }
    if (!wahl) await page.waitForTimeout(1000);
  }
  assert.ok(wahl, 'ein Mensch läuft geradeaus');
  await page.evaluate(w => window.__test.warp(w.T.x, w.T.z, w.yaw), wahl);
  await page.locator('#btnCtx:has-text("Aussteigen")').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  const s = await weg(page);
  assert.equal(s.city.riding, '', 'ausgestiegen');
  const T = s.city.parked.truck;
  assert.ok(Math.hypot(T.x - wahl.T.x, T.z - wahl.T.z) < 0.05, 'der Truck steht auf dem Weg');
  // 60 s lang alle 0,5 s messen: der Mensch kommt nie näher als 1,9 m an die Truck-Mitte
  let nah = Infinity;
  for (let i = 0; i < 120; i++) {
    const p = await page.evaluate(k => window.__test.nachbar(k), wahl.k);
    const d = Math.hypot(p.x - T.x, p.z - T.z);
    nah = Math.min(nah, d);
    assert.ok(d >= 1.9, 'Mensch ' + wahl.k + ' ist ' + d.toFixed(2) + ' m von der Truck-Mitte weg');
    await page.waitForTimeout(500);
  }
  assert.ok(nah < 5, 'der Mensch ist bis an den Truck gekommen (' + nah.toFixed(2) + ' m)');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Verkehr: Truck steht auf dem Rad und kann trotzdem wegfahren', async () => {
  // das Rad steht genau dort, wo der Truck nach dem Kauf steht (Startplatz vor dem Laden): beide dürfen nicht festsitzen
  const S = stadtWert('SHOP_AT'), H = { x: S.x, z: S.z + 4 };
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ ludins: 100, city: { visited: true, vehicles: { bike: true, truck: true }, parked: { bike: { ...H, yaw: 0 } } },
    where: { x: S.x, z: S.z, f: Math.PI / 2, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Einsteigen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#btnCtx:has-text("Aussteigen")').waitFor({ timeout: 5000 });
  await halten(page, 'KeyW', 2000);
  const s = await weg(page);
  assert.equal(s.city.riding, 'truck');
  assert.ok(Math.hypot(s.where.x - H.x, s.where.z - H.z) > 3, 'der Truck ist vom Rad weggefahren (' + s.where.x + ',' + s.where.z + ')');
  assert.equal(s.ludins, 100, 'beim Wegfahren gibt es keinen Strafzettel');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Nachbarn in Hafenhausen: Namen, reden (+1 pro Tag), Aufgaben (Fisch bringen: 2 × Preis + 10 Ludins, +3 Freundschaft)
const SAMSTAG = '2026-10-31T10:00:00+01:00'; // Samstagvormittag: fast alle sind unterwegs, auch die Kinder
function fischPreis(id) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = html.match(new RegExp("\\{id:'" + id + "'[^}]*price:(\\d+)"));
  assert.ok(m, 'Preis von ' + id);
  return Number(m[1]);
}
async function stadtSeite(extra, iso = SAMSTAG, fest = false) {
  const L = stadtWert('CITY_LAND');
  const { ctx, page, errors } = fest ? await zeitSeite(iso) : await startZeitSeite(iso);
  await seed(page, { [KEY]: stadtSeed({ city: { visited: true }, where: { x: L.x, z: L.z, f: L.f, boat: false }, ...extra }) });
  await startGame(page);
  await page.click('#btnGo');
  return { ctx, page, errors };
}
// zu Mensch k gehen (1,5 m vor ihn auf seinen Weg) und „Reden“ antippen. Er läuft, darum schnell klicken (solange die Karte offen ist, bleibt er stehen).
async function redeMit(page, k) {
  for (let tries = 0; tries < 6; tries++) {
    await page.waitForFunction(k => window.__test.nachbar(k).sichtbar, k, { timeout: 20000 });
    const p = await page.evaluate(k => window.__test.nachbar(k), k);
    const l = Math.hypot(p.ziel.x - p.x, p.ziel.z - p.z) || 1, d = Math.min(1.5, l);
    await page.evaluate(([x, z]) => window.__test.warp(x, z), [p.x + (p.ziel.x - p.x) / l * d, p.z + (p.ziel.z - p.z) / l * d]);
    try {
      await page.locator('#btnCtx:has-text("💬 Reden mit")').click({ timeout: 2000 });
      await page.locator('#card h2:has-text("💬")').waitFor({ timeout: 2000 });
      return;
    } catch { /* er ist schon weitergelaufen: noch einmal hingehen */ }
  }
  assert.fail('Gespräch mit Mensch ' + k + ' geht nicht auf');
}

test('Nachbarn: reden, Aufgabe, Fisch bringen, Belohnung', async () => {
  const { ctx, page, errors } = await stadtSeite({ ludins: 100 });
  await redeMit(page, 0);
  // Gespräch: Thema oben, 2–3 große Knöpfe; „Hier, bitte!“ nur, wenn ein passender Fisch im Eimer ist
  const knoepfe = await page.locator('#card .btns button').evaluateAll(bs => bs.map(b => b.getBoundingClientRect().height));
  assert.ok(knoepfe.length >= 2 && knoepfe.length <= 3, 'zwei oder drei Knöpfe: ' + knoepfe.length);
  assert.ok(knoepfe.every(h => h >= 60), 'Knöpfe mindestens 60 px: ' + knoepfe);
  assert.equal(await page.locator('#card button:has-text("Hier, bitte!")').count(), 0);
  await page.click('#card button:has-text("Kann ich dir helfen?")');
  const neu = await page.textContent('#toast');
  assert.match(neu, /📝 Neue Aufgabe!.*Karte/, 'der Hinweis nennt die Karte');
  assert.doesNotMatch(neu, /🗺️/, '🗺️ ist sonst die Deutschland-Karte');
  let s = await weg(page);
  assert.equal(s.aufgaben.length, 1);
  const A = s.aufgaben[0];
  assert.equal(A.n, 'n0');
  assert.match(A.day, /^2026-10-31$/);
  assert.ok(['hering', 'makrele', 'scholle', 'hornhecht', 'rotauge', 'rotfeder', 'barsch', 'karausche', 'doebel', 'schleie', 'karpfen', 'forelle', 'zander', 'hecht'].includes(A.fish), A.fish);
  assert.equal(s.nachbarn.n0.f, 1, 'erstes Gespräch heute: +1');
  // noch einmal fragen: keine zweite Aufgabe von derselben Person
  await page.click('#card button:has-text("Kann ich dir helfen?")');
  assert.equal((await weg(page)).aufgaben.length, 1);
  // Stadtplan: Bereich Aufgaben
  await page.click('#card button:has-text("Tschüss!")');
  await page.click('#btnMap');
  await page.locator('#card h3:has-text("📝 Aufgaben")').waitFor();
  assert.match(await page.textContent('#card'), /: 🐟 .+ 0\/1 · fängst du (im Hafen|am Heimat-See) · \+\d+ Ludins/);
  // den gewünschten Fisch in den Eimer legen und neu laden
  await seed(page, { [KEY]: JSON.stringify({ ...s, bucket: [{ id: A.fish, cm: 30, value: 9 }] }) });
  await startGame(page);
  await page.click('#btnGo');
  await redeMit(page, 0);
  await page.click('#card button:has-text("Hier, bitte!")');
  s = await weg(page);
  const lohn = 2 * fischPreis(A.fish) + 10;
  assert.equal(s.ludins, 100 + lohn, 'Belohnung: 2 × Preis + 10 Ludins');
  assert.equal(s.nachbarn.n0.f, 4, '1 (Reden) + 3 (Aufgabe)');
  assert.deepEqual(s.aufgaben, []);
  assert.deepEqual(s.bucket, []);
  // bleibt nach dem Neuladen
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(500);
  s = await weg(page);
  assert.equal(s.ludins, 100 + lohn);
  assert.equal(s.nachbarn.n0.f, 4);
  assert.deepEqual(s.aufgaben, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Nachbarn: einmal pro Tag +1', async () => {
  const { ctx, page, errors } = await stadtSeite({});
  await redeMit(page, 0);
  // solange die Karte offen ist, bleibt der Mensch stehen (auch wenn man ihm nicht mehr im Weg steht: man steht jetzt hinter ihm)
  const a = await page.evaluate(() => window.__test.nachbar(0));
  const l = Math.hypot(a.ziel.x - a.x, a.ziel.z - a.z) || 1;
  await page.evaluate(([x, z]) => window.__test.warp(x, z), [a.x - (a.ziel.x - a.x) / l * 2, a.z - (a.ziel.z - a.z) / l * 2]);
  await page.waitForTimeout(2000);
  const b = await page.evaluate(() => window.__test.nachbar(0));
  assert.ok(Math.hypot(b.x - a.x, b.z - a.z) < 0.01, 'er steht still');
  await page.click('#card button:has-text("Tschüss!")');
  await redeMit(page, 0);
  const s = await weg(page);
  assert.equal(s.nachbarn.n0.f, 1);
  assert.equal(s.nachbarn.n0.talk, '2026-10-31');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Nachbarn: schlafende Nachbarn reden nicht', async () => {
  const { ctx, page, errors } = await stadtSeite({}, '2026-10-27T23:00:00+01:00', true);
  await page.waitForFunction(() => document.body.dataset.leute !== undefined, null, { timeout: 20000 });
  const alle = await page.evaluate(() => Array.from({ length: 24 }, (_, k) => ({ ...window.__test.nachbar(k), k })));
  const wach = alle.filter(p => p.sichtbar);
  // ein schlafender Erwachsener (nicht n8/n9, die sind nachts unterwegs), weit weg von allen, die wach sind
  const p = alle.find(p => p.k >= 4 && p.kid === false && !p.sichtbar && wach.every(w => Math.hypot(w.x - p.x, w.z - p.z) > 12));
  assert.ok(p, 'ein schlafender Erwachsener');
  await page.evaluate(([x, z]) => window.__test.warp(x, z), [p.x + 0.8, p.z]);
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('#btnCtx:has-text("Reden")').isVisible(), false, 'kein „Reden“-Knopf bei Mensch ' + p.k);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Nachbarn: kaputte Werte werden repariert', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({
    nachbarn: { n0: { f: '<b>', talk: 'x' }, zz: {}, n3: 'kaputt', yy: 5, n1: { f: 7.6, talk: '2026-10-30', gift: '<i>' } },
    aufgaben: [{ n: 'n1', fish: 'gibtsnicht' }, 'x', { n: 'n30', fish: 'hering' }] }) });
  await startGame(page);
  await playAndLeave(page);
  let s = JSON.parse(await read(page));
  assert.deepEqual(s.nachbarn.n0, { f: 0, talk: '', gift: '' });
  assert.deepEqual(s.nachbarn.zz, {}, 'unbekannte ids bleiben gespeichert (nie löschen), das Spiel beachtet sie nicht');
  assert.deepEqual(s.nachbarn.n3, { f: 0, talk: '', gift: '' }, 'kein Objekt: wird ersetzt');
  assert.equal(s.nachbarn.yy, 5, 'unbekannte id, kein Objekt: bleibt auch gespeichert (nie löschen), das Spiel beachtet sie nicht');
  assert.deepEqual(s.nachbarn.n1, { f: 8, talk: '2026-10-30', gift: '' });
  assert.deepEqual(s.aufgaben, [], 'n30 gibt es nicht (nur 24 Menschen): die Aufgabe fällt weg');
  // ganz kaputt: Startwerte; mehr als 3 Aufgaben: nur die ersten 3
  const vier = ['hering', 'barsch', 'karpfen', 'scholle'].map((fish, i) => ({ n: 'n' + i, fish, day: '2026-10-30' }));
  await seed(page, { [KEY]: stadtSeed({ nachbarn: 'x', aufgaben: [{ n: '<b>', fish: 'hering' }, { n: 'n24', fish: 'hering', day: '2026-10-30' }, ...vier] }) });
  await startGame(page);
  await playAndLeave(page);
  s = JSON.parse(await read(page));
  assert.deepEqual(s.nachbarn, {});
  assert.deepEqual(s.aufgaben, vier.slice(0, 3));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Alter Spielstand: nachbarn und aufgaben bekommen Startwerte', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify(ALT_V1) });
  await startGame(page);
  await playAndLeave(page);
  const s = JSON.parse(await read(page));
  assert.deepEqual(s.nachbarn, {});
  assert.deepEqual(s.aufgaben, []);
  assert.equal(s.clothes.muetze, false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Nachbarn: Bester Freund schenkt einmal die Mütze', async () => {
  const { ctx, page, errors } = await stadtSeite({ ludins: 0, nachbarn: { n0: { f: 20, talk: '', gift: '' } } });
  await page.click('#btnAvatar');
  assert.equal(await page.locator('#opHat button:text-is("Mütze")').count(), 0, 'ohne Mütze keine Mütze in der Werkstatt');
  await page.click('#btnGo');
  await page.evaluate(() => { Math.random = () => 0.1; }); // das Geschenk (Wahrscheinlichkeit 0,3) kommt sicher
  await redeMit(page, 0);
  assert.match(await page.textContent('#card'), /❤️❤️❤️/, 'drei Herzen: Bester Freund');
  const s = await weg(page);
  assert.equal(s.clothes.muetze, true);
  assert.equal(s.nachbarn.n0.gift, '2026-10-31');
  assert.equal(s.nachbarn.n0.f, 21);
  assert.ok(s.baits.frucht === 3 || (s.ludins >= 10 && s.ludins <= 30), 'dazu Früchte oder Ludins');
  await page.click('#card button:has-text("Tschüss!")');
  await page.click('#btnAvatar');
  await page.click('#opHat button:text-is("Mütze")');
  await page.click('#btnGo'); // in der Werkstatt wird erst beim Losgehen gespeichert
  assert.equal((await weg(page)).avatar.hat, 'muetze');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Fix-Runde 1: Aufgaben nie mit einem Fisch, der gerade Schonzeit hat (Bachforelle 1.10.–28.2.)
const ERLAUBT_AUFGABE = ['hering', 'makrele', 'scholle', 'hornhecht', 'rotauge', 'rotfeder', 'barsch', 'karausche', 'doebel', 'schleie', 'karpfen', 'forelle', 'zander', 'hecht'];
test('Nachbarn: Aufgaben nie mit Fischen in der Schonzeit', async () => {
  for (const [iso, forelle] of [['2026-10-31T10:00:00+01:00', false], ['2026-06-21T10:00:00+02:00', true]]) {
    const { ctx, page, errors } = await stadtSeite({}, iso, true);
    const fische = await page.evaluate(() => window.__test.aufgabe(400));
    assert.ok(fische.every(f => ERLAUBT_AUFGABE.includes(f)), iso);
    assert.equal(fische.includes('forelle'), forelle, iso + ': Forelle ' + (forelle ? 'erlaubt' : 'hat Schonzeit'));
    if (forelle) assert.equal(fische.includes('schleie'), false, 'Schleie hat am 21.6. Schonzeit (15.5.–30.6.)');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Nachbarn: offene Aufgabe mit Schonzeit-Fisch wird getauscht', async () => {
  const { ctx, page, errors } = await stadtSeite({ aufgaben: [{ n: 'n0', fish: 'forelle', day: '2026-09-30' }] });
  await redeMit(page, 0);
  assert.match(await page.textContent('#card'), /Oh, die Forelle hat gerade Schonzeit\. Dann bring mir lieber .+!/);
  assert.equal(await page.locator('#card .btns button').count(), 3, 'kein vierter Knopf');
  let s = await weg(page);
  assert.equal(s.aufgaben.length, 1);
  assert.equal(s.aufgaben[0].n, 'n0');
  assert.notEqual(s.aufgaben[0].fish, 'forelle');
  assert.ok(ERLAUBT_AUFGABE.includes(s.aufgaben[0].fish), s.aufgaben[0].fish);
  // gespeichert: der Stadtplan zeigt den neuen Fisch
  await page.click('#card button:has-text("Tschüss!")');
  await page.click('#btnMap');
  await page.locator('#card h3:has-text("📝 Aufgaben")').waitFor();
  assert.doesNotMatch(await page.textContent('#card'), /🐟 Forelle /);
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(300);
  s = await weg(page);
  assert.notEqual(s.aufgaben[0].fish, 'forelle', 'der Tausch bleibt nach dem Neuladen');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Museum in Hafenhausen: Fische spenden (Herr Eugen), Ausstellung mit Foto, Tafel und „?“
const MUSEUM_ISO = '2026-10-31T10:00:00+01:00';
async function museumSeite(extra, iso = MUSEUM_ISO, fest = false) {
  const M = stadtWert('MUSEUM_AT');
  return stadtSeite({ where: { x: M.x, z: M.z, f: 0, boat: false }, ...extra }, iso, fest);
}
async function museumAuf(page) {
  await page.locator('#btnCtx:has-text("🏛️ Ins Museum")').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Museum")').waitFor();
}

test('Museum: Fisch spenden und ansehen', async () => {
  const { ctx, page, errors } = await museumSeite({ bucket: [{ id: 'hering', cm: 25, value: 6 }] });
  await museumAuf(page);
  assert.match(await page.textContent('#card'), /Offen 8–22 Uhr/);
  const tabs = await page.locator('#card .tabs button').evaluateAll(bs => bs.map(b => [b.textContent, b.getBoundingClientRect().height]));
  assert.equal(tabs.length, 2, 'zwei Reiter');
  assert.match(tabs[0][0], /Spenden/);
  assert.match(tabs[1][0], /Ausstellung/);
  assert.ok(tabs.every(t => t[1] >= 60), 'Reiter mindestens 60 px: ' + tabs.map(t => t[1]));
  const row = page.locator('#card .item:has-text("Hering")');
  assert.equal(await row.count(), 1);
  assert.ok((await row.locator('button').boundingBox()).height >= 60, 'Knopf mindestens 60 px');
  await row.locator('button:has-text("Spenden")').click();
  // Herr Eugen sagt den Fisch-Fakt
  const info = await page.evaluate(() => window.__test.fischInfo('hering'));
  const fact = info.fact;
  const text = await page.textContent('#card');
  assert.match(text, /Herr Eugen/);
  assert.ok(text.includes(fact), 'Herr Eugen sagt den Fakt');
  let s = await weg(page);
  assert.equal(s.museum.hering.cm, 25);
  assert.ok(Number.isFinite(s.museum.hering.t) && s.museum.hering.t > 1e12, 'Datum (Zeitstempel) ist gespeichert');
  assert.deepEqual(s.bucket, []);
  assert.equal(await page.locator('#card .item').count(), 0, 'nichts mehr zu spenden');
  // Ausstellung: Foto, Tafel mit Name, Größe, Datum und Fotonachweis; alle anderen „?“
  await page.click('#card .tabs button:has-text("Ausstellung")');
  const img = page.locator('#card img[src$="fotos/hering.jpg"]');
  await img.waitFor({ state: 'visible' });
  const tafel = await page.textContent('#card .bk:has(img[src$="fotos/hering.jpg"])');
  assert.match(tafel, /Hering/);
  assert.match(tafel, /25 cm/);
  assert.match(tafel, /\d\d\.\d\d\.\d{4}/, 'Datum');
  assert.match(tafel, /Foto: .+ · .+/, 'Fotonachweis');
  const n = info.anzahl;
  assert.match(await page.textContent('#card'), new RegExp('1 von ' + n + '\\b'));
  assert.equal(await page.locator('#card .bk .unknown').count(), n - 1, 'alle anderen sind „?“');
  for (const t of ['Amazonas', 'Heimat-See', 'Flüsse', 'Meer']) assert.ok(await page.locator('#card h3.bookhead:has-text("' + t + '")').count() >= 1, t);
  // nach dem Neuladen ist der Hering noch da
  await startGame(page);
  await page.click('#btnGo');
  s = await weg(page);
  assert.equal(s.museum.hering.cm, 25);
  assert.deepEqual(s.bucket, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Museum: dieselbe Art geht nur einmal', async () => {
  const { ctx, page, errors } = await museumSeite({
    museum: { hering: { cm: 30, t: 1761900000000 } },
    bucket: [{ id: 'hering', cm: 20, value: 5 }, { id: 'makrele', cm: 26, value: 12 }, { id: 'makrele', cm: 33, value: 16 }, { id: 'dorsch', cm: 50, value: 20 }] });
  await museumAuf(page);
  const namen = await page.locator('#card .item b').allTextContents();
  assert.deepEqual(namen, ['Makrele'], 'Hering ist schon da, Dorsch ist selten, Makrele steht nur einmal');
  await page.locator('#card .item button:has-text("Spenden")').click();
  assert.equal(await page.locator('#card .item').count(), 0, 'auch die zweite Makrele wird nicht mehr angeboten');
  const s = await weg(page);
  assert.equal(s.museum.makrele.cm, 33, 'die größere Makrele geht ins Museum');
  assert.deepEqual(s.bucket.map(b => b.id + b.cm), ['hering20', 'makrele26', 'dorsch50'], 'nur dieser eine Fisch ist weg');
  assert.deepEqual(s.museum.hering, { cm: 30, t: 1761900000000 }, 'der alte Hering bleibt');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Museum: um 23 Uhr geschlossen', async () => {
  const { ctx, page, errors } = await museumSeite({ bucket: [{ id: 'hering', cm: 25, value: 6 }] }, '2026-10-31T23:00:00+01:00', true);
  await page.locator('#btnCtx:has-text("Geschlossen")').waitFor({ timeout: 5000 });
  assert.equal((await page.textContent('#btnCtx')).trim(), '🌙 Geschlossen – öffnet um 8 Uhr');
  await page.click('#btnCtx');
  assert.equal(await page.locator('#modal').isVisible(), false, 'das Museum geht nicht auf');
  assert.equal(await page.textContent('#toast'), 'Das Museum ist zu, bis 8 Uhr. Angeln geht immer. Deine Fische bleiben im Eimer.');
  const s = await weg(page);
  assert.equal(s.bucket.length, 1);
  assert.deepEqual(s.museum, {});
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Museum: MUSEUM_AT liegt auf dem Gehweg vor dem Museum, nicht auf den Schienen', async () => {
  const M = stadtWert('MUSEUM_AT');
  const { ctx, page, errors } = await museumSeite({});
  await page.locator('#btnCtx:has-text("🏛️ Ins Museum")').waitFor({ timeout: 5000 });
  const r = await page.evaluate(([x, z]) => ({ ...window.__test.stadtPunkt(x, z), hoehe: window.__test.hoehe(x, z) }), [M.x, M.z]);
  const S = stadtWert('SHOP_AT');
  r.shop = Math.hypot(M.x - S.x, M.z - S.z);
  r.haus = r.tueren.filter(d => d > 2.5 && d < 3.5).length; // eine Haustür liegt 3 m vor dem Platz (wie beim Fahrzeug-Laden)
  assert.equal(r.walk, true, 'auf dem Gehweg');
  assert.equal(r.road, false);
  assert.ok(r.rail > 5, 'weit weg von den Schienen: ' + r.rail);
  assert.ok(r.shop > 50, 'nicht beim Fahrzeug-Laden');
  assert.equal(r.haus, 1, 'genau ein Haus (das Museum) steht vor der Tür');
  assert.ok(Math.abs(r.hoehe - 1.2) < 0.01, 'ebener Boden');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /name:'Museum',w:9/, 'das Schild heißt Museum');
  assert.equal((html.match(/name:'Bald geöffnet'/g) || []).length, 2, 'zwei Läden sind noch „Bald geöffnet“');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Museum: kaputte Werte werden repariert', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ museum: { hering: { cm: '<b>', t: -5 }, makrele: 'kaputt', zzz: { cm: 7, t: 8 }, scholle: { cm: 99999, t: 1761900000000.7 } } }) });
  await startGame(page);
  await playAndLeave(page);
  const s = JSON.parse(await read(page));
  assert.deepEqual(s.museum.hering, { cm: 0, t: 0 });
  assert.deepEqual(s.museum.makrele, { cm: 0, t: 0 }, 'kein Objekt: wird ersetzt');
  assert.deepEqual(s.museum.zzz, { cm: 7, t: 8 }, 'unbekannte Fische bleiben gespeichert (nie löschen)');
  assert.deepEqual(s.museum.scholle, { cm: 10000, t: 1761900000001 });
  assert.deepEqual(errors, []);
  await ctx.close();
  const b = await newPage();
  await seed(b.page, { [KEY]: stadtSeed({ museum: 'x' }) });
  await startGame(b.page);
  await playAndLeave(b.page);
  assert.deepEqual(JSON.parse(await read(b.page)).museum, {});
  assert.deepEqual(b.errors, []);
  await b.ctx.close();
});

test('Alter Spielstand: museum bekommt Startwert {}', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: JSON.stringify(ALT_V1) });
  await startGame(page);
  await playAndLeave(page);
  const s = JSON.parse(await read(page));
  assert.deepEqual(s.museum, {});
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Jeden Tag neu: Tagesfisch, Tagesaufgaben, Flaschenpost. dayHash wie in index.html (FNV-1a, 32 Bit).
function dayHash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
// Die drei Orte der Flaschenpost direkt aus index.html lesen: const FLASCHE_SPOTS=[{x:…,z:…,ort:'…'},…]
function flascheOrte() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const m = html.match(/const FLASCHE_SPOTS=\[([^\]]*)\]/);
  assert.ok(m, 'FLASCHE_SPOTS steht in index.html');
  const l = [...m[1].matchAll(/\{x:(-?\d+(?:\.\d+)?),z:(-?\d+(?:\.\d+)?),ort:'(\w+)'\}/g)].map(([, x, z, ort]) => ({ x: Number(x), z: Number(z), ort }));
  assert.deepEqual(l.map(o => o.ort), ['amazonas', 'see', 'stadt']);
  return l;
}
const fischNamen = () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), n = {};
  for (const [, id, name] of html.matchAll(/\{id:'(\w+)',(?:art:'\w+',)?name:'([^']+)'/g)) n[name] = id;
  return n;
};
const spielRegeln = () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const i = html.indexOf('const RULES='), j = html.indexOf('}};', i);
  return new Function('return ' + html.slice(i + 'const RULES='.length, j + 2))();
};
const schonzeitAm = (r, d) => { if (!r || !r.von) return false; const md = (d.getMonth() + 1) * 100 + d.getDate(), a = r.von[0] * 100 + r.von[1], b = r.bis[0] * 100 + r.bis[1]; return a <= b ? md >= a && md <= b : md >= a || md <= b; };

test('Tagesfisch: zählt doppelt', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-10-31T10:00:00+01:00');
  await seed(page, { [KEY]: stadtSeed({ ludins: 0, where: NEBEN_ROSA }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnBook');
  const kopf = (await page.textContent('#card .tagesfisch')).trim();
  const m = kopf.match(/^⭐ Tagesfisch heute: (.+)$/);
  assert.ok(m, 'Kopfzeile im Fischbuch: ' + kopf);
  const id = fischNamen()[m[1]];
  assert.ok(id, 'Tagesfisch ' + m[1] + ' steht in FISH');
  const anderer = id === 'piranha' ? 'skalar' : 'piranha';
  await seed(page, { [KEY]: stadtSeed({ ludins: 0, where: NEBEN_ROSA, bucket: [{ id: anderer, cm: 20, value: 10 }, { id, cm: 30, value: 10 }] }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Rosa")').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Rosas Fischhandel")').waitFor();
  const reihe = page.locator('#card .item:has-text("⭐ Tagesfisch ×2")');
  assert.equal(await reihe.count(), 1, 'nur der Tagesfisch zählt doppelt');
  assert.match(await reihe.textContent(), /20 Ludins/);
  assert.match(await page.textContent('#card'), /Alles verkaufen \(\+30 Ludins\)/);
  await reihe.locator('button:has-text("Verkaufen")').click();
  let s = await weg(page);
  assert.equal(s.ludins, 20, 'Tagesfisch mit Wert 10 bringt 20 Ludins');
  assert.deepEqual(s.bucket.map(b => b.id), [anderer]);
  await page.click('#card .item button:has-text("Verkaufen")');
  s = await weg(page);
  assert.equal(s.ludins, 30, 'ein anderer Fisch zählt normal');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Tagesfisch: jeden Tag fest, nie Bootsfisch, seltener Fisch oder Schonzeit', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-10-31T10:00:00+01:00');
  await seed(page, { [KEY]: stadtSeed({ where: NEBEN_ROSA }) });
  await startGame(page);
  const tage = Array.from({ length: 366 }, (_, i) => { const d = new Date(2026, 0, 1 + i, 12); return [d, d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')]; });
  const ids = await page.evaluate(keys => keys.map(k => window.__test.tagesfisch(k)), tage.map(t => t[1]));
  const noch = await page.evaluate(keys => keys.map(k => window.__test.tagesfisch(k)), tage.map(t => t[1]));
  assert.deepEqual(noch, ids, 'gleicher Tag = gleicher Fisch');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), RULES = spielRegeln();
  const boot = [...html.matchAll(/\{id:'(\w+)'[^\n]*boat:true/g)].map(m => m[1]);
  assert.deepEqual(boot, ['piraiba', 'arapaima']);
  tage.forEach(([d, k], i) => {
    const id = ids[i], r = RULES[id];
    assert.ok(!boot.includes(id), k + ': ' + id + ' gibt es nur vom Boot');
    assert.ok(!(r && r.selten), k + ': ' + id + ' ist ein seltener Fisch');
    assert.ok(!schonzeitAm(r, d), k + ': ' + id + ' hat Schonzeit');
  });
  assert.ok(new Set(ids).size >= 15, 'viele verschiedene Tagesfische im Jahr: ' + new Set(ids).size);
  assert.ok(ids.includes('forelle'), 'im Sommer kann die Forelle Tagesfisch sein');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Tagesaufgaben: derselbe Mensch wünscht sich am selben Tag denselben Fisch', async () => {
  // Liste wie AUFGABEN_FISCHE (See- und Meeresfische ohne Dorsch), am 31.10. ohne Forelle (Schonzeit 1.10.–28.2.)
  const liste = ['rotauge', 'rotfeder', 'barsch', 'karausche', 'doebel', 'schleie', 'karpfen', 'zander', 'hecht', 'hering', 'makrele', 'scholle', 'hornhecht'];
  const erwartet = liste[dayHash('2026-10-31n0') % liste.length];
  for (let mal = 0; mal < 2; mal++) {
    const { ctx, page, errors } = await stadtSeite({});
    await page.evaluate(() => { Math.random = () => 0.99; }); // der Zufall darf keine Rolle spielen
    await redeMit(page, 0);
    await page.click('#card button:has-text("Kann ich dir helfen?")');
    const s = await weg(page);
    assert.equal(s.aufgaben.length, 1);
    assert.equal(s.aufgaben[0].fish, erwartet, 'Fisch aus dayHash(Tag + id)');
    const a = await page.evaluate(() => window.__test.aufgabe(50)), b = await page.evaluate(() => window.__test.aufgabe(50));
    assert.deepEqual(a, b, 'kein Zufall');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

// Was in der heutigen Flaschenpost steckt (wie in index.html): 0 = Rätsel, 1 = Tipp, 2 = Ludins
async function flascheOeffnen(page, key) {
  const art = dayHash(key + 'f') % 3;
  await page.locator('#btnCtx:has-text("🍾 Flaschenpost")').waitFor({ timeout: 20000 });
  const knopf = await page.locator('#btnCtx').boundingBox();
  assert.ok(knopf.height >= 60, 'Knopf mindestens 60 px');
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("🍾 Flaschenpost")').waitFor();
  if (art === 0) {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const frage = (await page.textContent('#card .qq')).trim();
    const m = html.match(new RegExp("q:'" + frage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "',a:'([^']+)'"));
    assert.ok(m, 'Frage aus QUIZ: ' + frage);
    assert.equal((await weg(page)).tag.flasche, false, 'erst nach der Antwort ist die Flasche leer');
    await page.click('#card .qa:text-is("' + m[1] + '")');
    await page.locator('#card .qe:has-text("Richtig")').waitFor();
    return 10;
  }
  if (art === 1) { assert.match(await page.textContent('#card'), /💡/); return 0; }
  const l = 10 + dayHash(key + 'l') % 21;
  assert.match(await page.textContent('#card'), new RegExp(l + ' Ludins'));
  return l;
}

test('Flaschenpost: einmal pro Tag', async () => {
  const orte = flascheOrte();
  let save = null;
  for (const key of ['2026-10-28', '2026-10-29', '2026-10-31']) {
    const ort = orte[dayHash(key) % 3];
    const { ctx, page, errors } = await zeitSeite(key + 'T10:00:00+01:00');
    const where = { x: ort.x, z: ort.z, f: 0, boat: false };
    await seed(page, { [KEY]: save ? JSON.stringify({ ...save, where }) : stadtSeed({ ludins: 0, city: { visited: true }, where }) });
    await startGame(page);
    await page.click('#btnGo');
    const vorher = await weg(page);
    assert.deepEqual(vorher.tag, { day: key, flasche: false }, key + ': neuer Tag, neue Flaschenpost');
    const plus = await flascheOeffnen(page, key);
    let s = await weg(page);
    assert.deepEqual(s.tag, { day: key, flasche: true }, key);
    assert.equal(s.ludins, vorher.ludins + plus, key + ': +' + plus + ' Ludins');
    // neu laden: heute keine zweite Flaschenpost
    await page.click('#card .btns button:has-text("Fertig")');
    await startGame(page);
    await page.click('#btnGo');
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('#btnCtx:has-text("Flaschenpost")').isVisible(), false, key + ': kein zweites Mal');
    s = await weg(page);
    assert.deepEqual(s.tag, { day: key, flasche: true });
    save = s;
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Flaschenpost: alle Orte liegen an Land, gleich am Wasser', async () => {
  const { ctx, page, errors } = await stadtSeite({}, '2026-10-31T10:00:00+01:00', true);
  for (const o of flascheOrte()) {
    await page.evaluate(([x, z]) => window.__test.warp(x, z), [o.x, o.z]);
    await page.waitForTimeout(1500); // Welt-Stücke in der Nähe bauen (Bäume sind Hindernisse)
    const p = await page.evaluate(([x, z]) => {
      const t = window.__test, w = [];
      for (let r = 1; r <= 6; r += 0.5) for (let a = 0; a < 32; a++) w.push(t.hoehe(x + Math.sin(a / 32 * 6.283) * r, z + Math.cos(a / 32 * 6.283) * r));
      return { h: t.hoehe(x, z), frei: t.begehbar(x, z), wasser: Math.min(...w), rail: t.stadtPunkt(x, z).rail };
    }, [o.x, o.z]);
    assert.ok(p.h > 0.3, o.ort + ': an Land (' + p.h + ')');
    assert.ok(p.frei, o.ort + ': man kann hingehen');
    assert.ok(p.wasser < -0.35, o.ort + ': Wasser höchstens 6 m weit weg (' + p.wasser + ')');
    if (o.ort === 'stadt') assert.ok(p.rail > 2.2, 'nicht auf den Schienen');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Alter Spielstand: tag bekommt Startwert, kaputte Werte werden repariert', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-10-31T10:00:00+01:00');
  await seed(page, { [KEY]: JSON.stringify(ALT_V1) });
  await startGame(page);
  await playAndLeave(page);
  assert.deepEqual(JSON.parse(await read(page)).tag, { day: '2026-10-31', flasche: false }, 'Startwert, dann gleich der heutige Tag');
  for (const [tag, soll] of [
    ['x', { day: '2026-10-31', flasche: false }],
    [{ day: '<b>', flasche: true }, { day: '2026-10-31', flasche: false }],
    [{ day: '2026-10-31', flasche: 'ja' }, { day: '2026-10-31', flasche: false }],
    [{ day: '2026-10-31', flasche: true, extra: 1 }, { day: '2026-10-31', flasche: true, extra: 1 }],
    [{ day: '2026-10-30', flasche: true }, { day: '2026-10-31', flasche: false }]]) {
    await seed(page, { [KEY]: stadtSeed({ tag }) });
    await startGame(page);
    await playAndLeave(page);
    assert.deepEqual(JSON.parse(await read(page)).tag, soll, JSON.stringify(tag));
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Oben in der Leiste darf nichts unter der kleinen Karte liegen: sonst trifft der Finger die Karte statt den Knopf.
// Mit der Spielzeit-Anzeige (ohne Einstellung: 15 Minuten) und mit einem langen Namen, im Hoch- und im Querformat.
test('Leiste oben: kein Knopf liegt unter der kleinen Karte (Hoch- und Querformat)', async () => {
  for (const name of ['Testkind', 'Abcdefghijklmnopqrst']) {
    const { ctx, page, errors } = await newPage({ viewport: { width: 768, height: 1024 } });
    await seed(page, { [KEY]: stadtSeed({ avatar: { ...ALT_V1.avatar, name } }) });
    await startGame(page);
    await page.click('#btnGo');
    await page.locator('#timeChip').waitFor({ state: 'visible' });
    for (const [width, height] of [[768, 1024], [820, 1180], [1024, 768], [1180, 820]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(200);
      const r = await page.evaluate(() => {
        const mm = document.querySelector('#btnMap').getBoundingClientRect();
        const treffer = ['#btnAvatar', '#btnRank', '#btnBook', '#clockChip'].filter(s => {
          const e = document.querySelector(s), b = e.getBoundingClientRect(), h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return !h || !(h === e || e.contains(h));
        });
        const unter = [...document.querySelectorAll('.topbar>*:not(.spacer)')].filter(e => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && !(b.right <= mm.left || b.left >= mm.right || b.bottom <= mm.top || b.top >= mm.bottom);
        }).map(e => e.id || e.className);
        return { treffer, unter };
      });
      const wo = width + '×' + height + ', Name ' + name.length + ' Zeichen';
      assert.deepEqual(r.treffer, [], wo + ': diese Knöpfe kann man nicht antippen');
      assert.deepEqual(r.unter, [], wo + ': diese Teile liegen unter der kleinen Karte');
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // Bildschirmfoto im Hochformat (zum Anschauen, wenn TOPBAR_FOTO gesetzt ist)
  if (process.env.TOPBAR_FOTO) {
    const { ctx, page } = await newPage({ viewport: { width: 768, height: 1024 } });
    await seed(page, { [KEY]: stadtSeed({ avatar: { ...ALT_V1.avatar, name: 'Abcdefghijklmnopqrst' } }) });
    await startGame(page);
    await page.click('#btnGo');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: process.env.TOPBAR_FOTO });
    await ctx.close();
  }
});

test('Karte: offene Aufgaben stehen auch auf der großen Karte', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ aufgaben: [{ n: 'n3', fish: 'hering', day: '2026-10-26' }] }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnMap');
  await page.locator('#card h3:has-text("Amazonas")').waitFor();
  await page.locator('#card h3:has-text("📝 Aufgaben")').waitFor();
  assert.match(await page.textContent('#card'), new RegExp(': 🐟 Hering 0/1 · fängst du im Hafen · \\+' + (2 * fischPreis('hering') + 10) + ' Ludins'));
  await page.click('#card button:has-text("Fertig")');
  // ohne offene Aufgaben: kein Bereich Aufgaben
  await seed(page, { [KEY]: stadtSeed({}) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnMap');
  await page.locator('#card h3:has-text("Amazonas")').waitFor();
  assert.equal(await page.locator('#card h3:has-text("Aufgaben")').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Nachbarn: Tipps zu Tagesfisch, Museum und Fisch-Zeiten', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-10-31T10:00:00+01:00');
  await seed(page, { [KEY]: stadtSeed({}) });
  await startGame(page);
  const namen = Object.fromEntries(Object.entries(fischNamen()).map(([n, id]) => [id, n]));
  // zwei Tage mit verschiedenem Tagesfisch: der Tipp wird erst beim Zeigen ausgerechnet
  const a = '2026-10-31', ids = {};
  for (let d = 1; d <= 9 && !ids.b; d++) {
    const k = '2026-11-0' + d, id = await page.evaluate(k => window.__test.tagesfisch(k), k);
    if (id !== await page.evaluate(k => window.__test.tagesfisch(k), a)) ids.b = [k, id];
  }
  ids.a = [a, await page.evaluate(k => window.__test.tagesfisch(k), a)];
  assert.ok(ids.b, 'ein Tag mit anderem Tagesfisch');
  for (const [k, id] of [ids.a, ids.b]) {
    if (k !== a) await ctx.clock.setFixedTime(new Date(k + 'T10:00:00+01:00'));
    const tipps = await page.evaluate(() => window.__test.tipps());
    assert.ok(tipps.every(t => typeof t === 'string' && t.length > 10), 'alle Tipps sind Text');
    const t = tipps.find(t => /doppelt/.test(t));
    assert.ok(t && t.includes(namen[id]), k + ': Tipp zum Tagesfisch ' + namen[id] + ': ' + t);
    assert.ok(tipps.some(t => /Museum/.test(t) && /Herr Eugen/.test(t)), 'Tipp zum Museum');
    assert.ok(tipps.some(t => /nachts/.test(t)), 'Tipp zu den Fisch-Zeiten');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Spielzeit um in der Avatar-Werkstatt: danach wieder Tageshimmel', async () => {
  const TAG = '#a6dccd', NACHT = '#22335e';
  const { ctx, page, errors } = await startZeitSeite('2026-10-27T23:00:00+01:00');
  await seed(page, { [KEY]: stadtSeed({ where: SEE_ORT, visitedLake: true, playTime: { day: '2026-10-27', sec: 15 * 60 - 1, extra: 0 } }),
    [KEY + '-spielzeit']: JSON.stringify({ min: 15 }) });
  await startGame(page); // das Spiel beginnt in der Werkstatt
  const welt = () => page.evaluate(() => window.__test.welt());
  assert.equal((await welt()).sky, TAG);
  await page.locator('#timeup h2:has-text("Spielzeit ist um")').waitFor({ timeout: 10000 });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // wie der Uhr-Takt alle 30 s
  assert.equal((await welt()).sky, NACHT, 'während der Pause: echte Zeit');
  await page.click('#btnMoreTime');
  await rechenaufgabe(page);
  await page.click('#timeup button:has-text("+ 15 Minuten")');
  assert.equal(await page.isVisible('#btnGo'), true, 'wieder in der Werkstatt');
  assert.equal((await welt()).sky, TAG, 'Werkstatt: wieder Tageshimmel');
  await page.click('#btnGo');
  assert.equal((await welt()).sky, NACHT);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Mehrere Spieler: Museum, Nachbarn und Aufgaben bleiben bei jedem Spieler', async () => {
  const { ctx, page, errors } = await newPage();
  const A = { museum: { hering: { cm: 22, t: 1761500000000 } }, nachbarn: { n0: { f: 7, talk: '2026-10-26', gift: '' } }, aufgaben: [{ n: 'n3', fish: 'hering', day: '2026-10-26' }] };
  const B = { museum: { barsch: { cm: 18, t: 1761400000000 } }, nachbarn: { n5: { f: 16, talk: '2026-10-20', gift: '2026-10-20' } }, aufgaben: [{ n: 'n1', fish: 'makrele', day: '2026-10-25' }] };
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], playerId: 'p1', ...A }),
    [KEY + '-spieler-p2']: JSON.stringify({ v: 2, ludins: 50, newsSeen: 999, playerId: 'p2', avatar: { name: 'Papa' }, ...B }),
    [KEY + '-spieler']: JSON.stringify({ list: [{ id: 'p1', name: 'Testkind' }, { id: 'p2', name: 'Papa' }] }) });
  const teile = s => ({ museum: s.museum, nachbarn: s.nachbarn, aufgaben: s.aufgaben });
  // zu Papa wechseln
  await startGame(page);
  await page.locator('#card h2:has-text("Wer spielt?")').waitFor({ timeout: 5000 });
  await Promise.all([page.waitForEvent('load'), page.click('#card .player:has-text("Papa")')]);
  await page.locator('#btnGo').waitFor({ state: 'visible', timeout: 30000 });
  await playAndLeave(page);
  let s = JSON.parse(await read(page));
  assert.equal(s.playerId, 'p2');
  assert.deepEqual(teile(s), B, 'Papa hat seine eigenen Teile');
  assert.deepEqual(teile(JSON.parse(await read(page, KEY + '-spieler-p1'))), A, 'Testkind ist sicher aufgehoben');
  // zurück zu Testkind
  await startGame(page);
  await page.locator('#card h2:has-text("Wer spielt?")').waitFor({ timeout: 5000 });
  await Promise.all([page.waitForEvent('load'), page.click('#card .player:has-text("Testkind")')]);
  await page.locator('#btnGo').waitFor({ state: 'visible', timeout: 30000 });
  await playAndLeave(page);
  s = JSON.parse(await read(page));
  assert.equal(s.playerId, 'p1');
  assert.deepEqual(teile(s), A, 'Testkind hat alles zurück');
  assert.deepEqual(teile(JSON.parse(await read(page, KEY + '-spieler-p2'))), B, 'Papa ist sicher aufgehoben');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Klarere Texte (Skill i-have-adhd): Meldungen nennen Ursache und Ausweg, Fortschritt heißt „noch …“, weniger Text auf einmal
function newsListe() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const i = html.indexOf('const NEWS=['), j = html.indexOf('];', i);
  return new Function('return ' + html.slice(i + 'const NEWS='.length, j + 1))();
}
const toastIst = (page, start) => page.waitForFunction(s => document.querySelector('#toast').textContent.startsWith(s), start, { timeout: 60000, polling: 100 });

test('Klarere Texte: volle Reuse am Heimat-See schickt dich zu Fischer Hannes', async () => {
  const { ctx, page, errors } = await newPage();
  const voll = Array.from({ length: 15 }, () => ({ id: 'rotauge', cm: 20, value: 5 }));
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, bucket: voll,
    traps: [{ x: 10, z: -936, t: Date.now() - 60 * 1000, fish: [{ id: 'karpfen', cm: 60, value: 25 }] }],
    where: { x: 10, z: -940, f: 0, boat: false } }) }); // am Südufer, die Reuse liegt 4 m weiter im See
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Reuse ansehen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.click('#card button:has-text("In den Eimer")');
  assert.equal(await page.textContent('#toast'), 'Dein Eimer ist voll! Verkaufe zuerst Fische bei Fischer Hannes.');
  assert.equal((await weg(page)).bucket.length, 15);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Klarere Texte: Fisch weg und Eimer voll sagen, was du tun kannst', async () => {
  // Posenangeln am Amazonas: einen Biss verpassen, dann einen Fisch fangen, der den Eimer voll macht
  const fast = Array.from({ length: 14 }, () => ({ id: 'piranha', cm: 20, value: 8 }));
  let { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ bucket: fast, where: { x: 14, z: 0, f: -Math.PI / 2, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnFish');
  await toastIst(page, 'Der Fisch ist weg'); // nicht ziehen: der Fisch schwimmt weg
  assert.equal(await page.textContent('#toast'), 'Der Fisch ist weg. Tipp schnell auf ZIEHEN, wenn die Pose taucht.');
  await page.click('#btnFish');
  await page.waitForFunction(() => document.querySelector('#fishLbl').textContent === 'ZIEHEN!', null, { timeout: 60000, polling: 100 });
  await page.keyboard.press('Space');
  await page.locator('#card h2:has-text("gefangen")').waitFor();
  await page.click('#card .btns button:has-text("In den Eimer")');
  assert.equal(await page.textContent('#toast'), 'Eimer voll! Bring die Fische zu Rosa.');
  assert.deepEqual(errors, []);
  await ctx.close();
  // Grundangeln: der Bissanzeiger piept
  ({ ctx, page, errors } = await newPage());
  await seed(page, { [KEY]: stadtSeed({ methods: { spin: false, grund: true }, method: 'grund', where: { x: 14, z: 0, f: -Math.PI / 2, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnFish');
  await toastIst(page, 'Der Fisch ist weg');
  assert.equal(await page.textContent('#toast'), 'Der Fisch ist weg. Tipp schnell auf ZIEHEN, wenn es piept.');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Klarere Texte: 5 Minuten vor Schluss kommt ein Tipp zum Verkaufen', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ playTime: { day: heute(), sec: 15 * 60 - 303, extra: 0 } }), [KEY + '-spielzeit']: JSON.stringify({ min: 15 }) });
  await startGame(page);
  await page.click('#btnGo');
  await toastIst(page, 'Noch 5 Minuten');
  assert.equal(await page.textContent('#toast'), 'Noch 5 Minuten! Jetzt ist eine gute Zeit, deine Fische zu verkaufen.');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Klarere Texte: Angel-Quiz zeigt, wie viele richtige Fragen noch fehlen', async () => {
  const quiz = quizAusDemSpiel();
  let { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ metTiago: true, quiz: { ok: quiz.slice(0, 7).map(q => q.id) }, where: NEBEN_TIAGO }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Opa Tiago")').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Opa Tiagos Angelladen")').waitFor();
  assert.match(await page.textContent('#card'), /🎓 7 von 20 richtig\. Noch 13 bis zum Angelschein!/);
  assert.doesNotMatch(await page.textContent('#card'), /Du hast schon/);
  assert.deepEqual(errors, []);
  await ctx.close();
  ({ ctx, page, errors } = await newPage());
  await seed(page, { [KEY]: stadtSeed({ metTiago: true, angelschein: true, quiz: { ok: quiz.slice(0, 20).map(q => q.id) }, where: NEBEN_TIAGO }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Opa Tiago")').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Opa Tiagos Angelladen")').waitFor();
  assert.match(await page.textContent('#card'), /🎓 Du hast den Junior-Angelschein!/);
  assert.doesNotMatch(await page.textContent('#card'), /Noch \d+ bis/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Klarere Texte: Nachbar-Karte zeigt, wie viele Herzen bis Freund fehlen', async () => {
  let { ctx, page, errors } = await stadtSeite({ nachbarn: { n0: { f: 2, talk: '', gift: '' } } });
  await redeMit(page, 0); // erstes Gespräch heute: +1, also 3 Herzen
  assert.equal((await page.locator('#card p.small').first().textContent()).trim(), '❤️ Bekannt · noch 2 Herzen bis Freund');
  assert.deepEqual(errors, []);
  await ctx.close();
  ({ ctx, page, errors } = await stadtSeite({ nachbarn: { n0: { f: 30, talk: '2026-10-31', gift: '2026-10-31' } } }));
  await redeMit(page, 0);
  assert.equal((await page.locator('#card p.small').first().textContent()).trim(), '❤️❤️❤️ Bester Freund');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Klarere Texte: Museum sagt, wie viele Arten schon ausgestellt sind', async () => {
  const { ctx, page, errors } = await museumSeite({ bucket: [{ id: 'hering', cm: 25, value: 6 }], museum: { hering: { cm: 30, t: 1761900000000 } } });
  await museumAuf(page);
  const n = await page.evaluate(() => window.__test.fischInfo('hering').anzahl);
  assert.match(await page.textContent('#card'), new RegExp('Im Museum: 1 von ' + n + '\\. Fang eine neue Art, dann kannst du spenden\\.'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Klarere Texte: Flussplatz-Tipp zählt, was für den Stempel fehlt, die Infotafel zeigt den Stempel oben', async () => {
  const rhein = flussplaetze().find(s => s.id === 'bw-rhein');
  const vorTafel = { x: -2.8, z: -1800 - rhein.hw - 9, f: 0, boat: false };
  const tipp = page => page.waitForFunction(() => document.querySelector('#tip').textContent.includes('Stempel'), null, { timeout: 20000 }).then(() => page.textContent('#tip'));
  let { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ fluss: { 'bw-rhein': { f: ['barbe'] } }, flussAt: 'bw-rhein', where: vorTafel }) });
  await startGame(page);
  await page.click('#btnGo');
  assert.equal(await tipp(page), 'Stempel: noch 2 Fischarten, dann das Rätsel an der Infotafel 🧩.');
  await page.locator('#btnCtx:has-text("Infotafel")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#card h2:has-text("Rhein bei Breisach")').waitFor();
  const teile = await page.evaluate(() => [...document.querySelectorAll('#card > *')].map(e => e.tagName + '.' + e.className));
  assert.deepEqual(teile.slice(0, 4), ['DIV.infohead', 'H2.', 'P.qe', 'DIV.rule'], 'Belohnung unter dem Titel, Stempel-Kasten vor dem Text: ' + teile);
  assert.deepEqual(errors, []);
  await ctx.close();
  // Rätsel schon gelöst: nur noch die Fischarten
  ({ ctx, page, errors } = await newPage());
  await seed(page, { [KEY]: stadtSeed({ fluss: { 'bw-rhein': { f: ['barbe', 'nase'], q: true } }, flussAt: 'bw-rhein', where: vorTafel }) });
  await startGame(page);
  await page.click('#btnGo');
  assert.equal(await tipp(page), 'Stempel: noch 1 Fischart.');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Klarere Texte: Infotafel zeigt die Belohnung gleich unter dem Titel', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, where: SEE_ORT }) }); // neben der Regel-Tafel
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Infotafel")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.locator('#card table.rules').waitFor();
  const teile = await page.evaluate(() => [...document.querySelectorAll('#card > *')].map(e => e.tagName + '.' + e.className));
  assert.deepEqual(teile.slice(0, 3), ['DIV.infohead', 'H2.', 'P.qe'], 'Belohnung gleich unter dem Titel: ' + teile);
  assert.equal(await page.textContent('#card .qe'), '📚 Neues Wissen! +5 Ludins · 1 von 8 Tafeln');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Was ist neu: zeigt nur die neuen Einträge, die älteren sind zugeklappt', async () => {
  const news = newsListe(), V = news[0].v;
  assert.equal(new Set(news.map(n => n.v)).size, news.length, 'jede Nummer gibt es nur einmal');
  assert.match(news.find(n => n.v === 5).d, /Sicherheitskopie als Datei/, 'v5 nennt die Sicherheitskopie');
  assert.doesNotMatch(news.find(n => n.v === 5).d, /Spielstand-Code/);
  const neu = news.find(n => n.v === 40);
  assert.ok(neu && neu.ico === '💡' && neu.t === 'Klarere Tipps' && neu.day === '27.10.2026', 'Eintrag v40');
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ newsSeen: V - 2 }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#card h2:has-text("Was ist neu?")').waitFor({ timeout: 5000 });
  await page.locator('#card h3:has-text("Neu für dich")').waitFor({ timeout: 2000 });
  const sichtbar = () => page.locator('#card .newsitem:visible').count();
  assert.equal(await sichtbar(), 2, 'nur die 2 neuen Einträge');
  const knopf = page.locator('#card button:has-text("Ältere Neuigkeiten")');
  assert.ok((await knopf.boundingBox()).height >= 60, 'Knopf mindestens 60 px');
  await knopf.click();
  assert.equal(await sichtbar(), news.length, 'aufgeklappt: alle Einträge');
  assert.equal((await weg(page)).newsSeen, V);
  // von Hand geöffnet, ohne Neues: die neuesten 3 und der Knopf
  await page.click('#card button:has-text("Los geht")');
  await page.click('#btnNews');
  await page.locator('#card h2:has-text("Was ist neu?")').waitFor();
  assert.equal(await sichtbar(), 3);
  assert.equal(await page.locator('#card h3:has-text("Neu für dich")').count(), 0);
  assert.equal(await page.locator('#card button:has-text("Ältere Neuigkeiten")').isVisible(), true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// Heute für dich (Uhr oben antippen) und das Spielzeit-Ende mit Erfolgen. state.heute = was heute geschafft ist.
const HEUTE_ISO = '2026-10-31T10:00:00+01:00', HEUTE_TAG = '2026-10-31';
const HEUTE_NULL = { day: HEUTE_TAG, fische: 0, ludins: 0, arten: 0 };
async function heuteKarte(page) {
  await page.click('#clockChip');
  await page.locator('#card h2:text-is("📅 Heute für dich")').waitFor({ timeout: 5000 });
  return {
    next: (await page.textContent('#card .next')).trim(),
    zeilen: (await page.locator('#card .heute p').allTextContents()).map(t => t.trim())
  };
}

test('Heute: alter Spielstand bekommt heute mit Startwert, kaputte Werte werden repariert', async () => {
  const { ctx, page, errors } = await zeitSeite(HEUTE_ISO);
  await seed(page, { [KEY]: JSON.stringify(ALT_V1) });
  await startGame(page);
  await playAndLeave(page);
  assert.deepEqual(JSON.parse(await read(page)).heute, HEUTE_NULL, 'Startwert, dann gleich der heutige Tag');
  for (const [heute, soll] of [
    ['x', HEUTE_NULL],
    [[1, 2], HEUTE_NULL],
    [{ day: '<b>', fische: 4 }, HEUTE_NULL],
    [{ day: HEUTE_TAG, fische: '7', ludins: -3, arten: 2.6, extra: 1 }, { day: HEUTE_TAG, fische: 7, ludins: 0, arten: 3, extra: 1 }],
    [{ day: HEUTE_TAG, fische: '<b>', ludins: 1e99 }, { day: HEUTE_TAG, fische: 0, ludins: 1e9, arten: 0 }],
    [{ day: '2026-10-30', fische: 5, ludins: 50, arten: 2, extra: 'a' }, { ...HEUTE_NULL, extra: 'a' }]]) {
    await seed(page, { [KEY]: stadtSeed({ heute }) });
    await startGame(page);
    await playAndLeave(page);
    assert.deepEqual(JSON.parse(await read(page)).heute, soll, JSON.stringify(heute));
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Heute: ein neuer Tag setzt die Zähler zurück und speichert gleich', async () => {
  const { ctx, page, errors } = await zeitSeite('2026-10-31T23:59:00+01:00');
  await seed(page, { [KEY]: stadtSeed({ heute: { day: HEUTE_TAG, fische: 6, ludins: 84, arten: 1 } }) });
  await startGame(page);
  await page.click('#btnGo');
  assert.deepEqual(JSON.parse(await read(page)).heute, { day: HEUTE_TAG, fische: 6, ludins: 84, arten: 1 }, 'heute zählt noch');
  await ctx.clock.setFixedTime(new Date('2026-11-01T00:01:00+01:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // wie der Uhr-Takt alle 30 s
  assert.deepEqual(JSON.parse(await read(page)).heute, { day: '2026-11-01', fische: 0, ludins: 0, arten: 0 }, 'ohne Schließen gespeichert');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Heute: ein Fang zählt Fische und neue Arten, ein Verkauf zählt Ludins', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ book: {}, ludins: 100, metTiago: true, where: { x: 14, z: 0, f: -Math.PI / 2, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.click('#btnFish');
  await page.waitForFunction(() => document.querySelector('#fishLbl').textContent === 'ZIEHEN!', null, { timeout: 60000, polling: 100 });
  await page.keyboard.press('Space');
  await page.locator('#card h2:has-text("gefangen")').waitFor();
  let s = await weg(page);
  assert.equal(s.heute.arten, 1, 'neu im Fischbuch: +1 Art');
  assert.equal(s.heute.fische, 0, 'noch nicht im Eimer');
  await page.click('#card .btns button:has-text("In den Eimer")');
  s = await weg(page);
  assert.deepEqual([s.heute.fische, s.heute.arten, s.heute.ludins], [1, 1, 0]);
  // zu Rosa und verkaufen: die Ludins zählen
  await page.evaluate(([x, z]) => window.__test.warp(x, z), [NEBEN_ROSA.x, NEBEN_ROSA.z]);
  await page.locator('#btnCtx:has-text("Rosa")').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  await page.click('#card button:has-text("Alles verkaufen")');
  s = await weg(page);
  assert.ok(s.ludins > 100);
  assert.equal(s.heute.ludins, s.ludins - 100, 'verdiente Ludins');
  assert.equal(s.heute.fische, 1, 'Verkaufen zählt nicht als Fang');
  // bei Opa Tiago einkaufen: das zieht Ludins ab, aber nichts von „Heute geschafft“
  const verdient = s.heute.ludins, vorher = s.ludins;
  await page.evaluate(() => { const c = document.querySelector('#card .b.alt, #card button:last-child'); if (c) c.click(); }); // Rosas Karte schließen
  await page.evaluate(([x, z]) => window.__test.warp(x, z), [NEBEN_TIAGO.x, NEBEN_TIAGO.z]);
  await page.locator('#btnCtx:has-text("Opa Tiago")').waitFor({ timeout: 5000 });
  await page.click('#btnCtx');
  await page.click('#card .tabs button:text-is("Köder")');
  await page.click('#card .item:has(b:text-is("Blinker")) button');
  s = await weg(page);
  assert.ok(s.ludins < vorher, 'Blinker gekauft');
  assert.equal(s.heute.ludins, verdient, 'Einkaufen zählt nicht als verdient');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Heute: Fische aus der Reuse zählen, Arten nur beim ersten Mal', async () => {
  const { ctx, page, errors } = await newPage();
  await seed(page, { [KEY]: stadtSeed({ visitedLake: true, ludins: 0, book: { ...ALT_V1.book, rotauge: { n: 1, best: 20 } },
    traps: [{ x: 10, z: -936, t: Date.now() - 60 * 1000, fish: [{ id: 'rotauge', cm: 20, value: 5 }, { id: 'karpfen', cm: 60, value: 25 }] }],
    where: { x: 10, z: -940, f: 0, boat: false } }) });
  await startGame(page);
  await page.click('#btnGo');
  await page.locator('#btnCtx:has-text("Reuse ansehen")').waitFor({ timeout: 20000 });
  await page.click('#btnCtx');
  await page.click('#card button:has-text("In den Eimer")');
  const s = await weg(page);
  assert.equal(s.bucket.length, 2);
  assert.deepEqual([s.heute.fische, s.heute.arten, s.heute.ludins], [2, 1, 0], 'Rotauge kennt das Fischbuch schon, der Karpfen ist neu');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Heute für dich: die Uhr öffnet die Karte, eine abgebbare Aufgabe kommt zuerst', async () => {
  const { ctx, page, errors } = await zeitSeite(HEUTE_ISO);
  const namen = Object.fromEntries(Object.entries(fischNamen()).map(([n, id]) => [id, n]));
  const flascheOrt = { amazonas: 'Amazonas-Dorf', see: 'Heimat-See', stadt: 'Hafen' }[flascheOrte()[dayHash(HEUTE_TAG) % 3].ort];
  const leicht = { ludins: 100, metTiago: true, builtOnce: true }; // dann hat das Spiel keinen anderen Tipp
  const start = async extra => { await seed(page, { [KEY]: stadtSeed({ ...leicht, ...extra }) }); await startGame(page); await page.click('#btnGo'); };
  // 1. Aufgabe abgebbar: Hering im Eimer
  await start({ aufgaben: [{ n: 'n3', fish: 'hering', day: HEUTE_TAG }], bucket: [{ id: 'hering', cm: 25, value: 6 }] });
  let k = await heuteKarte(page);
  assert.equal(k.next, '👉 Als Nächstes: Bring den Hering nach Hafenhausen!');
  assert.ok(k.zeilen.length <= 5, 'höchstens 5 Zeilen: ' + k.zeilen.length);
  assert.equal(k.zeilen[0], '📝 Aufgaben: 1 offen: Hering für jemanden in Hafenhausen ✅ bring ihn hin!');
  assert.equal(k.zeilen[1], '🍾 Flaschenpost: liegt heute am ' + flascheOrt);
  const tf = await page.evaluate(k => window.__test.tagesfisch(k), HEUTE_TAG);
  assert.equal(k.zeilen[2], '⭐ Tagesfisch: ' + namen[tf] + ' zählt heute doppelt');
  assert.equal(k.zeilen.length, 4, 'ohne Reusen keine Reusen-Zeile');
  assert.equal(k.zeilen[3], '🎯 Nächstes Ziel: Angelschein: noch 20 Quizfragen');
  for (const t of ['🗺️ Karte', 'Weiter spielen']) assert.ok((await page.locator('#card button:has-text("' + t + '")').boundingBox()).height >= 60, t + ': mindestens 60 px');
  await page.click('#card button:has-text("Weiter spielen")');
  assert.equal(await page.isVisible('#modal'), false);
  // 2. Eimer voll
  await start({ bucket: Array.from({ length: 15 }, () => ({ id: 'rotauge', cm: 20, value: 5 })) });
  k = await heuteKarte(page);
  assert.equal(k.next, '👉 Als Nächstes: Dein Eimer ist voll. Verkauf die Fische bei Rosa!');
  assert.equal(k.zeilen[0], '📝 Aufgaben: Keine Aufgabe. Frag in Hafenhausen jemanden!');
  // 3. Reuse mit Fischen
  await start({ reusen: 1, traps: [{ x: 10, z: -936, t: 0 }] }); // lange her: die Reuse ist voll (Date.now läuft hier nicht mit der festen Uhr mit)
  k = await heuteKarte(page);
  assert.equal(k.next, '👉 Als Nächstes: Hol die Fische aus deiner Reuse!');
  assert.ok(k.zeilen.includes('🪤 Reusen: 3 Fische in deinen Reusen'), k.zeilen.join(' | '));
  // 4. Flaschenpost noch nicht gefunden; die Tipp-Zeile zeigt denselben Schritt
  await start({});
  k = await heuteKarte(page);
  assert.equal(k.next, '👉 Als Nächstes: Such die Flaschenpost am ' + flascheOrt + '!');
  await page.click('#card button:has-text("Weiter spielen")');
  await page.waitForFunction(() => document.querySelector('#tip').textContent.startsWith('👉'), null, { timeout: 20000 }).catch(() => {}); // langsame Bilder: der Tipp kommt alle 0,2 s Spielzeit
  assert.equal(await page.textContent('#tip'), '👉 Such die Flaschenpost am ' + flascheOrt + '!');
  // 5. Flaschenpost gefunden: den Tagesfisch fangen
  await start({ tag: { day: HEUTE_TAG, flasche: true } });
  k = await heuteKarte(page);
  assert.match(k.next, new RegExp('^👉 Als Nächstes: Fang (einen|eine|ein) ' + namen[tf] + ' .+\\. (Er|Sie|Es) zählt heute doppelt!$'));
  assert.equal(k.zeilen[1], '🍾 Flaschenpost: gefunden ✅');
  // 6. Tagesfisch schon im Eimer: das nächste Ziel
  await start({ tag: { day: HEUTE_TAG, flasche: true }, angelschein: true, bucket: [{ id: tf, cm: 30, value: 9 }], museum: { piranha: { cm: 20, t: 1 } } });
  k = await heuteKarte(page);
  assert.equal(k.next, '👉 Als Nächstes: Schenk Herrn Eugen im Museum eine neue Fischart.');
  assert.equal(k.zeilen.at(-1), '🎯 Nächstes Ziel: Museum: 1 von ' + Object.keys(namen).length);
  // Knopf Karte: öffnet die Karte von hier (Amazonas)
  await page.click('#card button:has-text("🗺️ Karte")');
  await page.locator('#card h2:text-is("Karte")').waitFor({ timeout: 5000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Heute für dich: am Flussplatz zeigt das Ziel den Stempel', async () => {
  const s = flussplaetze().find(s => s.id === 'bw-neckar');
  const { ctx, page, errors } = await zeitSeite(HEUTE_ISO);
  await seed(page, { [KEY]: stadtSeed({ ludins: 100, metTiago: true, builtOnce: true, tag: { day: HEUTE_TAG, flasche: true }, flussAt: s.id,
    fluss: { [s.id]: { f: ['barbe'], q: false, s: false, r: false } }, where: landeplatz(s) }) });
  await startGame(page);
  await page.click('#btnGo');
  const k = await heuteKarte(page);
  assert.equal(k.zeilen.at(-1), '🎯 Nächstes Ziel: Stempel: noch 2 Fischarten');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Spielzeit-Ende zeigt, was du heute geschafft hast', async () => {
  for (const [heute, soll] of [
    [{ day: HEUTE_TAG, fische: 6, ludins: 84, arten: 1 }, 'Heute geschafft: 🐟 6 Fische · 💰 +84 Ludins · 📖 1 neue Art'],
    [{ day: HEUTE_TAG, fische: 1, ludins: 0, arten: 2 }, 'Heute geschafft: 🐟 1 Fisch · 📖 2 neue Arten'],
    [{ day: HEUTE_TAG, fische: 0, ludins: 0, arten: 0 }, 'Schön, dass du da warst!']]) {
    const { ctx, page, errors } = await startZeitSeite(HEUTE_ISO);
    await seed(page, { [KEY]: stadtSeed({ heute, playTime: { day: '2026-10-31', sec: 15 * 60 - 1, extra: 0 } }), [KEY + '-spielzeit']: JSON.stringify({ min: 15 }) });
    await startGame(page);
    await page.click('#btnGo');
    await page.locator('#timeup h2:has-text("Spielzeit ist um")').waitFor({ timeout: 10000 });
    assert.equal((await page.textContent('#timeup .geschafft')).trim(), soll);
    assert.match(await page.textContent('#timeup'), /Morgen wartet: eine neue Flaschenpost 🍾 und ein neuer Tagesfisch ⭐/);
    assert.equal(await page.isVisible('#btnMoreTime'), true, 'die Knöpfe für Erwachsene bleiben');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Klarere Texte: Spinnfischen sagt „platscht“, Was ist neu v41', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /miss:'wenn es am Köder platscht'/);
  assert.doesNotMatch(html, /am Köder spritzt/);
  const n = newsListe()[0];
  assert.deepEqual({ v: n.v, day: n.day, ico: n.ico, t: n.t, d: n.d }, { v: 41, day: '27.10.2026', ico: '📅', t: 'Heute für dich',
    d: 'Tipp auf die Uhr oben: Dort steht, was heute für dich ansteht – und was du schon geschafft hast.' });
});
