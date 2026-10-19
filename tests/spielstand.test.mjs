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
async function newPage() {
  const ctx = await browser.newContext();
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
  assert.equal(ids.length, 25, '15 Amazonas-Fische und 10 See-Fische');
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
  assert.equal(await page.locator('#card .bk .unknown').count(), 23, 'die anderen sind ein Fragezeichen');
  assert.equal(await page.locator('#card canvas').count(), 0, 'kein gemalter Fisch');
  await page.click('#card button.bk:has-text("Piranha")');
  await page.locator('#card .pic img.photo').waitFor();
  assert.equal(await page.locator('#card .pic img.photo').getAttribute('src'), 'fotos/piranha.jpg');
  assert.equal(await page.locator('#card canvas').count(), 0);
  assert.equal(await page.locator('#card button:has-text("Gemalt")').count(), 0, 'kein Knopf mehr zum Umschalten');
  assert.deepEqual(errors, []);
  await ctx.close();
});
