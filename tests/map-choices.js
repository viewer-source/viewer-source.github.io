// Style and Colours belong to the map (create.js mapChoice, mapCols): on the styles page, in Edit, each map opened shows
// its own. A map with no choice shows what its colours are (the colour tests every species a confetti pastel: Confetti;
// a map recoloured to Default: Default); a choice made on one map is not shown on another and comes back with its map;
// a recolour undone shows the map as it is again. CellDesigner and SBGN-ML. Nothing is saved (no token).
//   node tests/map-choices.js [base address] [viewer folder: its editor served in place of the page's]
var chromium = require('playwright').chromium, fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/converter\/(sbgn_edit|cd_make)\.js/, function (r) { var f = /(sbgn_edit|cd_make)\.js/.exec(r.request().url())[0]; r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', f), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.goto(base + '#tag-celldesigner', { waitUntil: 'load' });
  await page.evaluate(function () { ['atlas-edit-map-choices', 'atlas-edit-originals', 'atlas-edit-defaults', 'atlas-edit-cd-defaults'].forEach(function (k) { localStorage.removeItem(k); }); });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.click('.m2-ri[data-win="edit"]');
  var F = '#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd', S = '#m2-editwin .m2-ed-pmap tr[data-k="style"] .m2-ed-pdd';
  await page.waitForSelector(F, { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var val = function (sel) { return page.$eval(sel, function (e) { return e.firstChild.textContent; }); };
  var open = async function (id) {
    await page.evaluate(function (h) { location.hash = h; }, id);
    await page.waitForFunction(function (h) { var n = window.m2EditNow && window.m2EditNow(); return n && location.hash === '#' + h && n.text && n.text.length > 100; }, id, { timeout: 30000 });
    await page.waitForTimeout(3000);
  };
  var pick = async function (sel, name) { await page.click(sel); await page.waitForTimeout(200); await page.click('body > .m2-ed-pdl button:has-text("' + name + '")'); await page.waitForTimeout(2500); };
  ok('Triacylglycerol (CellDesigner), its own colours: Original', (await val(F)) === 'Original', await val(F));
  await pick(F, 'Default'); await pick(S, 'Default');
  ok('Triacylglycerol: Default chosen', (await val(F)) === 'Default' && (await val(S)) === 'Default');
  await open('colour-test');
  ok('Glycolysis colour test (CellDesigner): Confetti, read from its colours', (await val(F)) === 'Confetti', await val(F));
  ok('Glycolysis colour test: Style From map, not triacylglycerol’s', (await val(S)) === 'From map', await val(S));
  await open('colour-glycolysis-sbgn');
  ok('Glycolysis colour test (SBGN-ML): Confetti', (await val(F)) === 'Confetti', await val(F));
  await open('srebp-sbgn');
  ok('SREBP (SBGN-ML), not chosen: Original', (await val(F)) === 'Original', await val(F));
  await pick(F, 'No colours');
  ok('SREBP (SBGN-ML): No colours chosen', (await val(F)) === 'No colours');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
  ok('SREBP (SBGN-ML): the recolour undone, Original again', (await val(F)) === 'Original', await val(F));
  await open('tag-celldesigner');
  ok('Triacylglycerol (CellDesigner) again: its Default back', (await val(F)) === 'Default' && (await val(S)) === 'Default', (await val(F)) + ', ' + (await val(S)));
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-map-choices'); });
  await open('colour-test'); await open('tag-celldesigner');
  ok('Triacylglycerol (CellDesigner), its choice forgotten: Default, read from its colours', (await val(F)) === 'Default', await val(F));
  // a new, empty map: nothing to read, the choice made stands and a glyph placed takes it
  if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
  await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
  await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:has-text("New SBGN-ML map")'); await page.waitForTimeout(3000);
  if (!(await page.$('#m2-editwin button[data-make="macromolecule"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector(F, { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1000);
  await pick(F, 'Confetti');
  ok('New map, empty: Confetti chosen stays', (await val(F)) === 'Confetti', await val(F));
  await page.click('#m2-editwin button[data-make="macromolecule"]'); await page.mouse.click(900, 500); await page.waitForTimeout(1500); await page.keyboard.press('Escape');
  ok('New map, a protein placed: still Confetti', (await val(F)) === 'Confetti', await val(F));
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
