// Settings, Editing, Proposed: Demerging links from logic gates (an AND or OR gate with several lines out). On Testing
// Glycolysis SBGN-ML: unticked (the default), an AND gate's second line out is refused; ticked, it is made, and the
// SBGN-ML text holds both arcs from the gate; a NOT gate keeps one line out either way; unticked again, the lines the
// map holds stay. The tick box is undone by Cmd+Z as every setting. Nothing is saved (no token).
//   node tests/fanout.js [address]
var { chromium } = require('playwright');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var make = async function (kind, x, y) { var b4 = await ids(); await page.click('#m2-editwin button[data-make="' + kind + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (z) { return b4.indexOf(z) < 0; })[0]; };
  var text = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var outs = async function (g) { return ((await text()).match(new RegExp('<arc [^>]*source="' + g + '[".]', 'g')) || []).length; };
  var line = async function (kind, s, t) {
    var A = await rect(s), B = await rect(t), n0 = ((await text()).match(/<arc /g) || []).length;
    await page.click('#m2-editwin button[data-make="' + kind + '"]');
    await page.mouse.move(A[0] + A[2] / 2, A[1] + A[3] / 2); await page.mouse.down(); await page.mouse.move(A[0] + A[2] / 2 + 8, A[1] + A[3] / 2 + 20, { steps: 4 });
    await page.mouse.move(B[0] + B[2] / 2, B[1] + B[3] / 2, { steps: 12 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(1200);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    return ((await text()).match(/<arc /g) || []).length - n0;
  };
  var tick = async function () {   // the tick box clicked in Settings, then back to the Edit window
    await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(400); await page.click('#m2-set-fanout'); await page.waitForTimeout(300);
    var v = await page.isChecked('#m2-set-fanout'); await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(800); return v;
  };
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-proposed-fanout'); localStorage.removeItem('atlas-cd-compatible'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="and"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var m1 = await make('macromolecule', 860, 420), m2 = await make('macromolecule', 860, 560), g = await make('and', 1040, 490), n = await make('not', 1040, 700);
  var p1 = await make('process', 1240, 420), p2 = await make('process', 1240, 600), p3 = await make('process', 1240, 760);
  await line('consumption', m1, g); await line('consumption', m2, g); await line('consumption', m1, n);
  ok('the AND gate’s first line out made', (await line('stimulation', g, p1)) === 1);
  ok('unticked: its second line out refused', (await line('stimulation', g, p2)) === 0);
  ok('the tick box ticked', await tick());
  ok('ticked: the AND gate’s second line out made', (await line('stimulation', g, p2)) === 1);
  ok('the SBGN-ML text holds both arcs from the gate', (await outs(g)) === 2, String(await outs(g)));
  ok('the NOT gate’s first line out made', (await line('inhibition', n, p3)) === 1);
  ok('ticked: a NOT gate’s second line out still refused', (await line('stimulation', n, p2)) === 0);
  ok('unticked again', !(await tick()));
  ok('unticked: the two lines the map holds stay', (await outs(g)) === 2);
  ok('unticked: a third line out refused', (await line('inhibition', g, p3)) === 0);
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(300); await page.keyboard.press('Meta+z'); await page.waitForTimeout(400);
  ok('Cmd+Z ticks it again', await page.isChecked('#m2-set-fanout'));
  ok('no script error', !errs.length, errs.join(' / '));
  console.log(bad ? bad + ' wrong' : 'all ok');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
