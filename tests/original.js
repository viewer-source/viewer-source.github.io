// Colours' Original (create.js colsPick): a map's own colours taken when another choice is made, and put back by Original
// after another map was opened in between; an element added under another choice keeps its colour and is counted. On the
// styles page, the triacylglycerol map (CellDesigner, red HSL) and SREBP (SBGN-ML). Read from the editor's drawing (every
// fill and stroke in order). Nothing is saved (no token).
//   node tests/original.js [base address] [viewer folder: its editor served in place of the page's]
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
  await page.evaluate(function () { ['atlas-edit-map-choices', 'atlas-edit-originals'].forEach(function (k) { localStorage.removeItem(k); }); });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.click('.m2-ri[data-win="edit"]');
  var F = '#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd';
  await page.waitForSelector(F, { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var val = function () { return page.$eval(F, function (e) { return e.firstChild.textContent; }); };
  var paint = function () { return page.evaluate(function () {   // every fill and stroke of the drawing, in order
    var d = new DOMParser().parseFromString(window.m2EditNow().svg, 'image/svg+xml');
    return Array.from(d.querySelectorAll('[fill],[stroke]')).map(function (e) { return (e.getAttribute('fill') || '') + '/' + (e.getAttribute('stroke') || ''); }).join(' ').toLowerCase();
  }); };
  var open = async function (id) {
    await page.evaluate(function (h) { location.hash = h; }, id);
    await page.waitForFunction(function (h) { var n = window.m2EditNow && window.m2EditNow(); return n && location.hash === '#' + h && n.text && n.text.length > 100; }, id, { timeout: 30000 });
    await page.waitForTimeout(3000);
  };
  var pick = async function (name) { await page.click(F); await page.waitForTimeout(200); await page.click('body > .m2-ed-pdl button:has-text("' + name + '")'); await page.waitForTimeout(2500); };
  var status = function () { return page.$eval('#m2-editwin', function (w) { return w.textContent; }); };
  async function run(map, kind, protein) {
    await open(map);
    ok(kind + ': opens on Original', (await val()) === 'Original', await val());
    var p0 = await paint();
    await pick('Mist and sage'); var p1 = await paint();
    ok(kind + ': Default recolours', p1 !== p0);
    await pick('Confetti');
    await open('colour-test'); await open(map);
    ok(kind + ': back from another map, still Confetti', (await val()) === 'Confetti', await val());
    await pick('Original');
    ok(kind + ': Original, the drawing as it was', (await paint()) === p0);
    ok(kind + ': Original shown', (await val()) === 'Original', await val());
    await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
    ok(kind + ': one undo, Confetti again', (await val()) === 'Confetti', await val());
    await pick('Mist and sage'); await pick('Original');   // after the undo the map was not in its own colours: the record kept, not taken again
    ok(kind + ': Original after an undo and Default, the drawing as it was', (await paint()) === p0);
    await pick('Confetti');
    // a protein added under Confetti, then Original: the others back, the new one kept and counted
    await page.click('#m2-editwin button[data-make="' + protein + '"]'); await page.mouse.click(1250, 820); await page.waitForTimeout(1200); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await pick('Original');
    ok(kind + ': an element added since: nothing said', !/Original:/.test(await status()) && (await page.$eval('#m2-ed-status', function (s) { return s.textContent; })) === '', (await status()).slice(0, 200));
  }
  await run('tag-celldesigner', 'CellDesigner', 'cd:PROTEIN');
  await run('srebp-sbgn', 'SBGN-ML', 'macromolecule');
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
