// The palette's Strict SBGN tick box (plan 3 step 6), on Testing Glycolysis SBGN-ML. Unticked (the default): a phenotype
// is consumed, produced and catalyses (CellDesigner's phenotype is a species), a gene catalyses (CellDesigner 4.4.2 holds
// each, checked on a file opened there), an empty set never modulates, two entities take a stimulation (Reduced notation,
// ticked by default), a process takes a second catalysis, an empty set a second consumption. Ticked: each of these refused, the lines the map holds kept, Reduced notation pale and out of use with its tick kept; Cmd+Z
// unticks it again. Nothing is saved (no token).
//   node tests/strict-sbgn.js [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var make = async function (kind, x, y) { var b4 = await ids(); await page.click('#m2-editwin button[data-make="' + kind + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (z) { return b4.indexOf(z) < 0; })[0]; };
  var arcs = async function () { return ((await page.evaluate(function () { return window.m2EditNow().text; })).match(/<arc /g) || []).length; };
  var line = async function (kind, s, t) {   // drawn from the middle of s to the middle of t; the arcs it added
    var A = await rect(s), B = await rect(t), n0 = await arcs();
    await page.click('#m2-editwin button[data-make="' + kind + '"]');
    await page.mouse.move(A[0] + A[2] / 2, A[1] + A[3] / 2); await page.mouse.down(); await page.mouse.move(A[0] + A[2] / 2 + 8, A[1] + A[3] / 2 + 20, { steps: 4 });
    await page.mouse.move(B[0] + B[2] / 2, B[1] + B[3] / 2, { steps: 12 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(1200);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    return (await arcs()) - n0;
  };
  var box = function (c) { return page.evaluate(function (c) { var d = document.querySelector('#m2-editwin ' + c), i = d.querySelector('input'); return { shown: !d.hidden, on: i.checked, off: i.disabled, pale: d.classList.contains('m2-ed-poff') }; }, c); };
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-palette'); localStorage.removeItem('atlas-proposed-fanout'); localStorage.removeItem('atlas-cd-compatible'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="phenotype"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  await page.focus('#m2-view'); await page.keyboard.press('Meta+a'); await page.keyboard.press('Delete'); await page.waitForTimeout(1500); await page.keyboard.press('Escape');   // an empty map, so new glyphs land on nothing
  ok('the map\u2019s lines and glyphs taken away (its compartments may stay)', (await arcs()) === 0, String(await arcs()) + ' arcs');
  var s0 = await box('.m2-ed-psbgn'), r0 = await box('.m2-ed-pstrict');
  ok('Strict SBGN shown on the PD tab, unticked', s0.shown && !s0.on && !s0.off);
  ok('Reduced notation ticked and in use', r0.on && !r0.off && !r0.pale);
  var ph = await make('phenotype', 860, 380), m1 = await make('macromolecule', 860, 520), m2 = await make('macromolecule', 860, 660), m3 = await make('macromolecule', 700, 660);
  var gn = await make('nucleic acid feature ct:gene', 700, 520), es = await make('source and sink', 700, 380), p1 = await make('process', 1100, 380), p2 = await make('process', 1100, 520), p3 = await make('process', 1100, 660), p4 = await make('process', 1100, 780);
  ok('unticked: a phenotype consumed by a process (CellDesigner)', (await line('consumption', ph, p1)) === 1);
  ok('unticked: a phenotype stimulates a process', (await line('stimulation', ph, p2)) === 1);
  ok('unticked: a phenotype as a catalysis', (await line('catalysis', ph, p3)) === 1);
  ok('unticked: a phenotype produced', (await line('production', p2, ph)) === 1);
  ok('unticked: a gene as a catalysis', (await line('catalysis', gn, p2)) === 1);
  ok('unticked: an empty set no stimulation either (SBGN)', (await line('stimulation', es, p3)) === 0);
  ok('unticked: a stimulation between two entities (Reduced notation)', (await line('stimulation', m1, m2)) === 1);
  ok('a first catalysis', (await line('catalysis', m1, p3)) === 1);
  ok('unticked: a second catalysis on the same process', (await line('catalysis', m2, p3)) === 1);
  ok('an empty set consumed', (await line('consumption', es, p1)) === 1);
  ok('unticked: the empty set consumed again', (await line('consumption', es, p2)) === 1);
  var held = await arcs();
  await page.click('#m2-editwin .m2-ed-psbgn input'); await page.waitForTimeout(600);
  var s1 = await box('.m2-ed-psbgn'), r1 = await box('.m2-ed-pstrict');
  ok('Strict SBGN ticked', s1.on);
  ok('Reduced notation pale and out of use, its tick kept', r1.on && r1.off && r1.pale);
  ok('ticked: the lines the map holds kept', (await arcs()) === held);
  ok('ticked: a phenotype not consumed', (await line('consumption', ph, p4)) === 0);
  ok('ticked: a phenotype not produced', (await line('production', p4, ph)) === 0);
  ok('ticked: a phenotype no catalyst', (await line('catalysis', ph, p4)) === 0);
  ok('ticked: a gene no catalyst', (await line('catalysis', gn, p4)) === 0);
  ok('ticked: an empty set no stimulation', (await line('stimulation', es, p4)) === 0);
  ok('ticked: nothing leaves a phenotype', (await line('stimulation', ph, p4)) === 0);
  ok('ticked: no stimulation between two entities', (await line('stimulation', m2, m3)) === 0);
  ok('ticked: a first catalysis', (await line('catalysis', m3, p4)) === 1);
  ok('ticked: no second catalysis', (await line('catalysis', m1, p4)) === 0);
  ok('ticked: a stimulation beside the catalysis', (await line('stimulation', m1, p4)) === 1);
  ok('ticked: the empty set not consumed a third time', (await line('consumption', es, p4)) === 0);
  ok('ticked: catalysis onto a phenotype (the specification allows it)', (await line('catalysis', m2, ph)) === 1);
  await page.focus('#m2-view'); await page.keyboard.press('Escape');
  var undone = false;
  for (var i = 0; i < 6 && !undone; i++) { await page.keyboard.press('Meta+z'); await page.waitForTimeout(400); undone = !(await box('.m2-ed-psbgn')).on; }
  var r2 = await box('.m2-ed-pstrict');
  ok('Cmd+Z unticks Strict SBGN', undone);
  ok('Reduced notation back in use, still ticked', r2.on && !r2.off && !r2.pale);
  ok('no script error', !errs.length, errs.join(' / '));
  console.log(bad ? bad + ' wrong' : 'all ok');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
