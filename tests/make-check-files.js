// Files for checking by hand in the editors that made the formats: what the editor saves, made with the editor itself
// on the root page (no token: nothing is saved anywhere; the file text read from the editor).
// 1. CellDesigner (Glycolysis): a complex placed with two proteins dropped onto it (members), a protein resized to
//    120 by 60 in Properties, one species moved.
// 2. GraphML (Glycolysis): two nodes moved by the arrow keys (the GraphML editor moves, it makes nothing).
//   node tests/make-check-files.js <out folder> [base address]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var out = process.argv[2], base = process.argv[3] || 'https://viewer-source.github.io/';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-n'); }))); }); };
  var at = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var start = async function (h, sign) {
    await page.goto(base + '#' + h, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$('#m2-editwin button[data-make="' + sign + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + sign + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var made = async function (k, x, y) { var a = await ids(); await page.click('#m2-editwin button[data-make="' + k + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); return (await ids()).filter(function (i) { return a.indexOf(i) < 0; })[0]; };
  var size = async function (id, w, h) {
    await page.keyboard.press('Escape'); await page.mouse.click.apply(page.mouse, await at(id)); await page.waitForTimeout(400);
    for (var [k, v] of [['w', w], ['h', h]]) { var f = '#m2-editwin .m2-ed-pnode tr[data-k="' + k + '"] input'; await page.fill(f, String(v)); await page.press(f, 'Enter'); await page.waitForTimeout(700); }
    await page.keyboard.press('Escape');
  };
  var text = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };

  await start('glycolysis-celldesigner', 'cd:PROTEIN');
  var before = await ids(), sg = await page.$eval('#m2-editwin button[data-make="cd:COMPLEX"]', function (x) { var q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.move(sg[0], sg[1]); await page.mouse.down(); await page.mouse.move(600, 500, { steps: 6 }); await page.mouse.move(1150, 300, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(900);
  var cx = (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0];
  var C = await at(cx); await page.click('#m2-editwin button[data-make="cd:PROTEIN"]'); await page.mouse.click(C[0], C[1]); await page.waitForTimeout(1500);
  C = await at(cx); await page.click('#m2-editwin button[data-make="cd:PROTEIN"]'); await page.mouse.click(C[0], C[1]); await page.waitForTimeout(1500);
  var p = await made('cd:PROTEIN', 1150, 600);
  await size(p, 120, 60);
  var cd = await text();
  var members = (cd.match(/complexSpeciesAlias="/g) || []).length;
  console.log('CellDesigner: complex ' + cx + ', members ' + members + ', resized protein ' + p + ': ' + /w="120\.?0*" h="60\.?0*"|h="60\.?0*" w="120/.test(cd));
  fs.writeFileSync(path.join(out, 'glycolysis-celldesigner-edited-v01.xml'), cd);

  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 }); await page.waitForTimeout(2000);
  var g0 = await text(), moved = [];
  for (var n of (await ids()).slice(2, 4)) {
    await page.mouse.click.apply(page.mouse, await at(n)); await page.waitForTimeout(300);
    for (var i = 0; i < 4; i++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(150); }
    await page.waitForTimeout(900); await page.keyboard.press('Escape'); moved.push(n);
  }
  var g = await text();
  console.log('GraphML: moved ' + moved.join(', ') + ', changed: ' + (g !== g0));
  fs.writeFileSync(path.join(out, 'glycolysis-graphml-edited-v01.graphml'), g);
  console.log(errs.length ? 'script errors: ' + errs.join(' | ') : 'no script error');
  await b.close();
})();
