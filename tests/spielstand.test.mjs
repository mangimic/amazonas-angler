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
  await page.click('#btnTimeChange');
  await page.fill('#gateIn', '1');
  await page.click('#gateOk');
  assert.equal(await page.locator('#card button:has-text("15 Min")').count(), 0, 'falsche Antwort: keine Einstellung');
  await rechenaufgabe(page);
  await page.click('#card button:has-text("15 Min")');
  assert.equal(JSON.parse(await read(page, KEY + '-spielzeit')).min, 15);
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
  assert.match(await page.locator('#card .rankrow').nth(0).textContent(), /Testkind.*2 \/ 25/);
  await page.click('#card .rankrow:has-text("Papa")');
  assert.match(await page.textContent('#card .catches'), /Hecht.*2× · größter 95 cm/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Bestenliste: Rekord-Karten von Freunden tauschen (ohne Internet)', async () => {
  // Kind A speichert seine Rekord-Karte
  const a = await newPage();
  await seed(a.page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, bucket: [], book: { arapaima: { n: 1, best: 250 } } }) });
  await startGame(a.page);
  await a.page.click('#btnRanking');
  const [download] = await Promise.all([a.page.waitForEvent('download'), a.page.click('#btnCardSave')]);
  assert.equal(download.suggestedFilename(), 'Rekordkarte-Testkind.json');
  const datei = path.join(here, 'test-rekordkarte.json');
  await download.saveAs(datei);
  const karte = JSON.parse(fs.readFileSync(datei, 'utf8'));
  assert.equal(karte.app, 'amazonas-angler-karte');
  assert.equal(karte.ludins, 345);
  assert.equal(karte.bucket, undefined, 'nur Rekorde, kein ganzer Spielstand');
  // Die eigene Karte kann man nicht als Freund laden
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
  await page.setInputFiles('#cardFile', datei);
  await page.locator('#card .rankrow:has-text("Testkind")').waitFor();
  fs.unlinkSync(datei); // erst löschen, wenn das Spiel die Datei gelesen hat
  assert.match(await page.locator('#card .rankrow').nth(0).textContent(), /Freund.*777 L/);
  assert.match(await page.locator('#card .rankrow').nth(1).textContent(), /Testkind.*Rekord-Karte von Freund.*345 L/);
  await page.click('#card .tabs button:has-text("Größter Fisch")');
  assert.match(await page.locator('#card .rankrow').nth(0).textContent(), /Testkind.*Arapaima.*250 cm/);
  assert.equal(JSON.parse(await read(page, KEY + '-freunde')).cards.length, 1);
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
