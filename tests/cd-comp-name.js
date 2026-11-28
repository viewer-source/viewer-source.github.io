// Compartment names at the top middle on a CellDesigner map (cdrender nameLeft, cd_make namePoint): on f001-glycolysis
// (the root page) a compartment dropped from the palette has its name drawn centred at its top; it stays centred at
// the top after a rename (Label in Properties), a move by a drag, a move by the arrow keys, a resize by its right handle
// dragged, and a Width typed. Centred: the name's middle within 2 px of the compartment's middle on screen, its top
// within 20 px of the compartment's top; the moves and resizes checked in the file's bounds. Nothing is saved (no
// token). No script error.
//   node tests/cd-comp-name.js [address]
var { chromium } = require('playwright');
var url = process.argv[2] || 'https://viewer-source.github.io/#f001-glycolysis';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1500); };
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:COMPARTMENT"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(3000);
  var view = await page.$eval('#m2-view', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  var sg = await page.$eval('#m2-editwin button[data-make="cd:COMPARTMENT"]', function (x) { var q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  var before = await ids();
  await page.mouse.move(sg[0], sg[1]); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 6 }); await page.mouse.move(view[2] - 300, view[3] - 200, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
  var comp = (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0];
  ok('a compartment dropped', /^ca/.test(comp || ''), comp);
  if (!comp) { await b.close(); process.exit(1); }
  var box = function () { return page.$eval('#m2-img [data-n="' + comp + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }); };
  var mid = function () { return page.$eval('#m2-img [data-n="' + comp + '"]', function (g) {   // the name's middle against the compartment's, its top against the compartment's top
    var t = g.querySelector('text'), r = g.getBoundingClientRect(), q = t.getBoundingClientRect(); return [q.left + q.width / 2 - (r.left + r.width / 2), q.top - r.top, t.textContent]; }); };
  var inFile = function () { return page.evaluate(function (c) {   // the alias's bounds and namePoint
    var t = window.m2EditNow().text, a = new RegExp('<celldesigner:compartmentAlias id="' + c + '"[\\s\\S]*?</celldesigner:compartmentAlias>').exec(t)[0];
    var bb = /bounds x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"/.exec(a).slice(1).map(parseFloat), np = /namePoint x="([^"]*)" y="([^"]*)"/.exec(a);
    return { b: bb, np: np ? [parseFloat(np[1]), parseFloat(np[2])] : null }; }, comp); };
  var select = async function () { var r = await box(); await page.keyboard.press('Escape'); await page.mouse.click(r[0] + 3, (r[1] + r[3]) / 2); await page.waitForTimeout(500); };
  var centred = async function (what) {
    var m = await mid();
    ok(what + ': the name at the top middle (' + m[0].toFixed(1) + ' px off the middle, ' + m[1].toFixed(1) + ' from the top)', Math.abs(m[0]) < 2 && m[1] >= 0 && m[1] < 20, JSON.stringify(m));
    return m;
  };
  await centred('dropped');
  await select(); await type('label', 'Mitochondrial matrix');
  var m1 = await centred('renamed');
  ok('renamed: the new name drawn', m1[2] === 'Mitochondrial matrix', m1[2]);
  // a move by a drag (selected first: a drag on a compartment not selected moves the map)
  var f0 = await inFile(); await select();
  var r0 = await box(), P = [r0[0] + 3, (r0[1] + r0[3]) / 2];
  await page.mouse.move(P[0], P[1]); await page.mouse.down(); await page.mouse.move(P[0] - 60, P[1] - 40, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
  var f1 = await inFile();
  ok('dragged: its place in the file changed', Math.abs(f1.b[0] - f0.b[0]) > 20, JSON.stringify([f0.b, f1.b]));
  await centred('moved by a drag');
  await select();
  for (var j = 0; j < 5; j++) await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(1500);
  var f2 = await inFile();
  ok('arrow keys: its place in the file changed', Math.abs(f2.b[0] - f1.b[0]) >= 40, JSON.stringify([f1.b, f2.b]));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await centred('moved by the arrow keys');
  // resized by its right handle
  await select();
  var hd = await page.evaluate(function () {   // the right middle handle: the fifth of the eight
    var h = document.querySelectorAll('.m2-ed-handle'); if (h.length < 8) return null; var r = h[4].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  ok('selected: its handles shown', !!hd);
  if (hd) {
    await page.mouse.move(hd[0], hd[1]); await page.mouse.down(); await page.mouse.move(hd[0] + 50, hd[1], { steps: 4 }); await page.mouse.move(hd[0] + 120, hd[1], { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
    var f3 = await inFile();
    ok('right handle dragged: wider in the file', f3.b[2] > f2.b[2] + 50, JSON.stringify([f2.b, f3.b]));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await centred('resized by its handle');
  }
  await select(); await type('w', '420');
  var f4 = await inFile();
  ok('Width 420 typed', Math.abs(f4.b[2] - 420) < 0.01, JSON.stringify(f4.b));
  await centred('resized by Width');
  await select(); await type('label', 'c');
  await centred('renamed short');
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
