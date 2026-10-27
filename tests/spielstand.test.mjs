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
  await page.locator('text=Du hast schon 19').waitFor();
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
  assert.match(await page.textContent('#toast'), /Geschlossen – öffnet um 8 Uhr/);
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
  assert.match(await page.textContent('#card'), /: bring .+ \(0\/1\)/);
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
  assert.equal('yy' in s.nachbarn, false, 'ungültig und kein Objekt: fällt weg');
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
  assert.doesNotMatch(await page.textContent('#card'), /bring Forelle/);
  await startGame(page);
  await page.click('#btnGo');
  await page.waitForTimeout(300);
  s = await weg(page);
  assert.notEqual(s.aufgaben[0].fish, 'forelle', 'der Tausch bleibt nach dem Neuladen');
  assert.deepEqual(errors, []);
  await ctx.close();
});
