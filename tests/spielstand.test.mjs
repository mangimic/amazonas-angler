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
async function newPage(opts) { // opts: z. B. { viewport: … } (kleineres Fenster = mehr Bilder pro Sekunde)
  const ctx = await browser.newContext(opts);
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
  assert.equal(ids.length, 37, '15 Amazonas-Fische, 10 See-Fische und 12 Flussfische');
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
  assert.equal(await page.locator('#card .bk .unknown').count(), 35, 'die anderen sind ein Fragezeichen');
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
  assert.match(await page.locator('#card .rankrow').nth(0).textContent(), /Testkind.*2 \/ 37/);
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
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Angeln kannst du in der Angelwelt'), null, { timeout: 5000 });
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
  await seed(page, { [KEY]: JSON.stringify({ ...ALT_V1, v: 2, newsSeen: 999, city: 'x' }) });
  await startGame(page);
  await playAndLeave(page);
  let s = JSON.parse(await read(page));
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
  assert.equal(s.city.parked.truck, undefined);
  assert.equal(s.city.parked.rakete, undefined);
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
  await page.waitForTimeout(1200);
  const a = await weg(page);
  await page.waitForTimeout(1000);
  const b = await weg(page);
  await page.keyboard.up('KeyW');
  assert.equal(b.city.riding, 'bike');
  assert.ok(Math.hypot(a.where.x - touch.x, a.where.z - touch.z) < 0.8, 'man hält dort an, wo man den Brunnen berührt');
  assert.ok(Math.hypot(b.where.x - a.where.x, b.where.z - a.where.z) < 0.2, 'man rutscht nicht am Brunnen entlang');
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
  const s = await weg(page);
  assert.equal(s.city.riding, 'truck');
  assert.ok(s.where.z < at.z - 2, 'man ist auf das Haus zu gefahren');
  // der Truck ist fast 6 m lang: seine Mitte bleibt mindestens 2 m weiter weg als die Hauswand
  assert.ok(Math.hypot(s.where.x - H.x, s.where.z - H.z) >= H.r + 2, 'die Nase vom Truck steckt nicht im Haus');
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
  await page.locator('#btnCtx:has-text("🚋 Einsteigen")').waitFor({ timeout: 90000 }); // die Bahn steht am Flugplatz (oder kommt rundherum)
  await page.click('#btnCtx');
  assert.ok(await page.locator('#btnHorn').isHidden(), 'in der Straßenbahn gibt es keine Hupe');
  await page.locator('#btnCtx:has-text("Aussteigen")').waitFor({ timeout: 90000 }); // erst an der nächsten Haltestelle
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
