// Compartments padding for nested compartments (Settings, Editing; core.js pads().comp, grown): a compartment inside
// another, dragged against its holder's side, grows the holder and keeps the padding between them, from the inner one's
// outer line to the holder's inner line (CellDesigner: inside the membrane, 12 by default). Set to 48 in this browser
// before the page loads, on a CellDesigner and an SBGN-ML map; a species keeps the same 48. Nothing is saved.
//   node tests/nested-pad.js [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var local = process.argv[2];
var MAPS = [['https://viewer-source.github.io/styles/#acly-celldesigner', 'cd:COMPARTMENT', 'cd:PROTEIN', 12], ['https://viewer-source.github.io/styles/#glycolysis-sbgn', 'compartment', 'macromolecule', 0]];
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  for (var M of MAPS) {
    var page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    await page.addInitScript(function () { try { localStorage.setItem('atlas-edit-padding', JSON.stringify({ comp: 48 })); } catch (e) {} });
    if (local) {
      var ed = require('./editor-now.js')(local);
      await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
      await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
    }
    page.on('pageerror', function (e) { errs.push(e.message); });
    var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
    var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }); };
    var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1200); };
    var drop = async function (sign, x, y) {
      var before = await ids(), s = await page.$eval('#m2-editwin button[data-make="' + sign + '"]', function (q) { var r = q.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.mouse.move(s[0], s[1]); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 6 }); await page.mouse.move(x, y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
      return (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0];
    };
    await page.goto(M[0], { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$('#m2-editwin button[data-make="' + M[1] + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + M[1] + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
    var sel = async function (id, fx, fy) { var r = await rect(id); await page.keyboard.press('Escape'); await page.mouse.click(r[0] + (r[2] - r[0]) * fx, r[1] + (r[3] - r[1]) * fy); await page.waitForTimeout(500); };
    // the inner one first, made small; the outer dropped on it takes it in, then typed larger (its centre kept)
    var B = await drop(M[1], 1250, 770);
    await sel(B, 0, 0.25); await type('w', '100'); await sel(B, 0.5, 0); await type('h', '80');   // on its left side and its top, clear of the handles
    var A = await drop(M[1], 1250, 770);
    await sel(A, 0, 0.25); await type('w', '400'); await sel(A, 0, 0.25); await type('h', '300');
    var ra = await rect(A), rb = await rect(B), unit = (ra[2] - ra[0]) / 400, cxA = (ra[0] + ra[2]) / 2;
    ok(M[0].split('#')[1] + ': a compartment inside another', !!B && rb[0] > ra[0] && rb[2] < ra[2] && rb[1] > ra[1] && rb[3] < ra[3], JSON.stringify([ra, rb]));
    await sel(B, 0, 0.25);   // selected, then moved right by the arrow keys well past its holder's side (a press on its side would resize it)
    for (var j = 0; j < 200; j++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); ra = await rect(A); rb = await rect(B);
    var gap = (ra[2] - rb[2]) / unit - M[3];
    ok(M[0].split('#')[1] + ': pushed against its holder, 48 between them (' + gap.toFixed(1) + ')', Math.abs(gap - 48) < 3, JSON.stringify([ra, rb]));
    var P = await drop(M[2], cxA - 60, (ra[1] + ra[3]) / 2), rp = await rect(P);
    await sel(P, 0.5, 0.5);
    for (var j = 0; j < 200; j++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); ra = await rect(A); rp = await rect(P);
    var g2 = (ra[3] - rp[3]) / unit - M[3];
    ok(M[0].split('#')[1] + ': a species pushed down keeps the same padding, 48 (' + g2.toFixed(1) + ')', Math.abs(g2 - 48) < 3, JSON.stringify([ra, rp]));
    await page.close();
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
