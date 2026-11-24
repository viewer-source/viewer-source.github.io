// The palette's rows and its CellDesigner compatible tick box (create.js palSigns, palBlocks, .m2-ed-pcdc), on Testing
// Glycolysis SBGN-ML with full editing: at the panel's usual width the gates start a row and the arcs start a row, with
// CellDesigner compatible ticked (no Tag) and unticked (Tag), under PD and AF; the tick box sits above Reduced notation,
// is not in Settings, takes the Tag (and AF's delay) out and puts it back, and one undo puts it back as it was. No script error.
//   node tests/palette-rows.js [address] [viewer folder: its editor served in place of the page's]
var engine = require('playwright')[process.env.BROWSER || 'chromium'], fs = require('fs'), path = require('path');   // BROWSER=webkit or firefox: the same test in another engine
var NOISE = require('./lib/noise.js');   // what a browser reports that is no fault of the page
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#testing-glycolysis-sbgn', local = process.argv[3];
(async function () {
  var b = await engine.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  page.on('pageerror', function (e) { if (!NOISE.test(e.message)) errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  // the left edge of the first sign and of the given signs
  var lefts = function (kinds) {
    return page.evaluate(function (kinds) {
      var all = document.querySelectorAll('#m2-editwin .m2-ed-psigns button[data-make]'), x0 = Math.round(all[0].getBoundingClientRect().left);
      return { x0: x0, x: kinds.map(function (k) { var e = document.querySelector('#m2-editwin .m2-ed-psigns button[data-make="' + k + '"]'); return e ? Math.round(e.getBoundingClientRect().left) : null; }) };
    }, kinds);
  };
  var rows = async function (what, gate, arc) {
    var L = await lefts([gate, arc]);
    ok(what + ': the gates start a row', L.x[0] === L.x0, JSON.stringify(L));
    ok(what + ': the arcs start a row', L.x[1] === L.x0, JSON.stringify(L));
  };
  var tag = function () { return page.isVisible('#m2-editwin button[data-make="tag"]'); };
  var ticked = function () { return page.$eval('#m2-editwin .m2-ed-pcdc input', function (i) { return i.checked; }); };
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-cd-compatible'); localStorage.removeItem('atlas-edit-palette'); localStorage.setItem('atlas-edit-level', 'full'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="submap"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  ok('the tick box in the palette', await page.isVisible('#m2-editwin .m2-ed-pcdc input'));
  ok('above Reduced notation', await page.evaluate(function () {
    var a = document.querySelector('#m2-editwin .m2-ed-pcdc'), s = document.querySelector('#m2-editwin .m2-ed-pstrict');
    return a.getBoundingClientRect().bottom <= s.getBoundingClientRect().top + 1;   // Reduced notation right under it
  }));
  if (!local) ok('not in Settings', !(await page.$('#m2-set-cdc')));   // the page itself: only on the live site
  ok('unticked: Tag offered', !(await ticked()) && await tag());
  await rows('PD, unticked', 'and', 'consumption');
  await page.click('#m2-editwin .m2-ed-pcdc input'); await page.waitForTimeout(800);
  ok('ticked: no Tag', (await ticked()) && !(await tag()));
  ok('kept in the browser', await page.evaluate(function () { return localStorage.getItem('atlas-cd-compatible') === 'on'; }));
  await rows('PD, CellDesigner compatible', 'and', 'consumption');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1000);
  ok('undo: unticked, Tag back', !(await ticked()) && await tag());
  await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(1000);
  ok('redo: ticked, no Tag', (await ticked()) && !(await tag()));
  await page.click('#m2-editwin button[data-lang="af"]'); await page.waitForTimeout(1000);
  await rows('AF, CellDesigner compatible', 'and', 'stimulation');
  var dl = function () { return page.isVisible('#m2-editwin button[data-make="delay"]'); }, eq = function () { return page.isVisible('#m2-editwin button[data-make="equivalence"]'); };
  ok('AF, CellDesigner compatible: no delay, the equivalence kept', !(await dl()) && await eq());
  await page.click('#m2-editwin .m2-ed-pcdc input'); await page.waitForTimeout(800);
  await rows('AF, unticked', 'and', 'stimulation');
  ok('AF, unticked: the delay offered', await dl());
  await page.click('#m2-editwin button[data-lang="pd"]'); await page.waitForTimeout(800);
  ok('no script error', !errs.length, errs.join(' / '));
  await page.evaluate(function () { localStorage.removeItem('atlas-cd-compatible'); localStorage.removeItem('atlas-edit-palette'); });
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
