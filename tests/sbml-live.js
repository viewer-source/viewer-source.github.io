// SBML with a layout in the editor, on the live demo (no token: nothing saved), for a hand-drawn kinetic model, a
// COPASI drawing, an SBML-qual model and a MINERVA export:
// 1. the Edit tab starts editing; the palette is not shown (layout only);
// 2. a species selected and moved by the arrow keys: the file the editor would save differs from the file opened only
//    in numbers, and its glyph's position by the move;
// 3. Snap the whole map to the grid: the file still differs only in numbers (a point box put in for a reaction that had
//    none excepted), and undo gives the file back as it was opened;
// 4. no script error.
//   node tests/sbml-live.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var MAPS = ['sbml-biomodels-biomd0000000899-ota2015', 'sbml-biomodels-biomd0000000786-lipniacki2004',
  'sbml-biomodels-model2101150001-corral2021', 'sbml-minerva-glycolysis-cardiac'];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var strip = function (s) { return s.replace(/<([\w.-]+:)?boundingBox><([\w.-]+:)?position [^>]*\/><([\w.-]+:)?dimensions [^>]*\/><\/([\w.-]+:)?boundingBox>/g, '').replace(/-?\d+(\.\d+)?([eE][-+]?\d+)?/g, '#'); };
  var now = function () { return page.evaluate(function () { var n = window.m2EditNow(); return n ? n.text : null; }); };
  for (var id of MAPS) {
    console.log('-- ' + id);
    await page.goto(base + '#' + id, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
    var orig = await page.evaluate(function (id) {
      var m = (window.m2Maps || []).find(function (x) { return x.id === id; });
      var u = document.querySelector('.m2-dl a[href*="test-maps/sbml/"], #m2-dlwin a[href*="test-maps/sbml/"]');
      return u ? fetch(u.href).then(function (r) { return r.text(); }) : null;
    }, id);
    if (!(await page.evaluate(function () { return document.querySelector('.m2').classList.contains('m2-editing'); }))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 60000 }).catch(function () {});
    var t0 = await now();
    ok('editing starts', !!t0);
    if (!t0) continue;
    if (orig) ok('the file opened is the file published', t0 === orig);
    ok('no palette (layout only)', await page.evaluate(function () { var p = document.querySelector('#m2-editwin [data-make]'); return !p || !p.offsetParent; }));
    // a species: a node whose group is drawn, in view
    var P = await page.$$eval('#m2-img [data-n]', function (l) {
      for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 300 && r.right < 1350 && r.top > 120 && r.bottom < 850) return [r.left + r.width / 2, r.top + r.height / 2]; }
      return null;
    });
    ok('a node in view', !!P);
    if (P) {
      await page.mouse.click(P[0], P[1]); await page.waitForTimeout(400);
      for (var k = 0; k < 5; k++) await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(1500);
      var t1 = await now();
      ok('moved by the keys: the file changed', t1 && t1 !== t0);
      ok('only in numbers', t1 && strip(t1) === strip(t0));
    }
    await page.click('#m2-ed-tidy-grid'); await page.waitForTimeout(3000);
    var t2 = await now();
    ok('Snap the whole map to the grid: the file changed', t2 && t2 !== t0);
    ok('only in numbers', t2 && strip(t2) === strip(t0));
    for (var u = 0; u < 4; u++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(700); }
    ok('undone: the file as opened', (await now()) === t0);
    await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800);
  }
  ok('no script error', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all right');
  process.exit(bad ? 1 : 0);
})();
