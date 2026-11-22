// Padding after moving away (Settings, Editing; core.js grown, away): an inner compartment flush in its holder's corner
// (padding 0) keeps that closer room only while it stays there; dragged away from the corner and back past where it
// began, in one drag, the holder grows with the padding (12). On a CellDesigner and an SBGN-ML map. Nothing is saved.
//   node tests/pad-away.js [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var local = process.argv[2];
var MAPS = [['https://viewer-source.github.io/styles/#acly-celldesigner', 'cd:COMPARTMENT', 'cd:PROTEIN', 12], ['https://viewer-source.github.io/styles/#glycolysis-sbgn', 'compartment', 'macromolecule', 0]];
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  for (var M of MAPS) {
    var page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    await page.addInitScript(function () { try { if (!sessionStorage.getItem('pa')) { localStorage.setItem('atlas-edit-padding', JSON.stringify({ comp: 0 })); sessionStorage.setItem('pa', 1); } } catch (e) {} });
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
    var B = await drop(M[1], 1250, 770);
    await sel(B, 0, 0.25); await type('w', '100'); await sel(B, 0.5, 0); await type('h', '80');
    var A = await drop(M[1], 1250, 770);
    await sel(A, 0, 0.25); await type('w', '400'); await sel(A, 0, 0.25); await type('h', '300');
    var ra = await rect(A), unit = (ra[2] - ra[0]) / 400;
    // padding 0: the inner one pushed into the holder's lower right corner, flush with its inner line
    await sel(B, 0, 0.25);
    for (var j = 0; j < 200; j++) await page.keyboard.press('ArrowRight');
    for (var j = 0; j < 200; j++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(1500); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    ra = await rect(A); var rb = await rect(B);
    ok(M[0].split('#')[1] + ': flush in the corner at padding 0 (' + ((ra[2] - rb[2]) / unit - M[3]).toFixed(1) + ')', Math.abs((ra[2] - rb[2]) / unit - M[3]) < 3);
    // padding 12, then one drag: up and left, away from the corner, then down and right past where it began
    await page.evaluate(function () { localStorage.setItem('atlas-edit-padding', JSON.stringify({ comp: 12 })); });
    var cx = rb[0] + 12, cy = rb[1] + (rb[3] - rb[1]) * 0.25;
    await sel(B, 0, 0.25);
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx - 60 * unit, cy - 60 * unit, { steps: 8 }); await page.waitForTimeout(300);
    await page.mouse.move(cx + 40 * unit, cy + 40 * unit, { steps: 12 }); await page.waitForTimeout(500);
    await page.mouse.up(); await page.waitForTimeout(2000); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    ra = await rect(A); rb = await rect(B);
    var gr = (ra[2] - rb[2]) / unit - M[3], gb = (ra[3] - rb[3]) / unit - M[3];
    ok(M[0].split('#')[1] + ': moved away and back, the padding on the right (' + gr.toFixed(1) + ')', Math.abs(gr - 12) < 3, JSON.stringify([ra, rb]));
    ok(M[0].split('#')[1] + ': and at the bottom (' + gb.toFixed(1) + ')', Math.abs(gb - 12) < 3, JSON.stringify([ra, rb]));
    await page.close();
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
