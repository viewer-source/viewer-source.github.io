// Colours' O.L. (create.js OL_CD, OL_SB, olFill; cdcreate.js cdColourIn): on the styles page, on SREBP signalling as
// CellDesigner and as SBGN-ML, each in a fresh page: O.L. gives every protein #e7dbe2 and every metabolite #d7d8ba,
// every line and border black, the field then shows O.L.; a protein placed afterwards #e7dbe2; one undo takes it back
// to the map's own colours. Nothing is saved (no token).
//   node tests/ol-colours.js [base address] [viewer folder: its editor served in place of the page's]
var chromium = require('playwright').chromium, fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
async function run(b, map, kind, protein) {
  var page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.goto(base + '#' + map, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-map-choices'); });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var fills = function () { return page.evaluate(function () {
    var d = new DOMParser().parseFromString(window.m2EditNow().svg, 'image/svg+xml'), o = {};
    Array.from(d.querySelectorAll('[class]')).forEach(function (e) { var m = /\bc-(\w+)/.exec(e.getAttribute('class')); if (m && e.getAttribute('fill')) (o[m[1]] = o[m[1]] || []).push(e.getAttribute('fill').toLowerCase()); });
    return o;
  }); };
  var strokes = function () { return page.evaluate(function () {
    var d = new DOMParser().parseFromString(window.m2EditNow().svg, 'image/svg+xml'), o = {};
    Array.from(d.querySelectorAll('[stroke]')).forEach(function (e) { var c = e.getAttribute('stroke').toLowerCase(); if (!/^(none|#000|#000000|#fff|#ffffff|white|black)$/.test(c)) o[c] = (o[c] || 0) + 1; });
    return o;
  }); };
  var text = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var field = function () { return page.$eval('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd', function (f) { return f.textContent.trim(); }); };
  var t0 = await text();
  await page.click('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd'); await page.waitForTimeout(200);
  var items = await page.$$eval('body > .m2-ed-pdl button', function (l) { return l.map(function (x) { return x.textContent.trim(); }); });
  ok(kind + ': O.L. in the list, after Mist and sage', items.indexOf('O.L.') === items.indexOf('Mist and sage') + 1, JSON.stringify(items));
  await page.click('body > .m2-ed-pdl button:has-text("O.L.")'); await page.waitForTimeout(2500);
  var f = await fills();
  ok(kind + ': every protein #e7dbe2', (f.protein || []).length > 0 && f.protein.every(function (x) { return x === '#e7dbe2'; }), Array.from(new Set(f.protein || [])).join(' '));
  ok(kind + ': every metabolite #d7d8ba', (f.metabolite || []).length > 0 && f.metabolite.every(function (x) { return x === '#d7d8ba'; }), Array.from(new Set(f.metabolite || [])).join(' '));
  var sd = await strokes(); delete sd['#66b44d'];   // a CellDesigner compartment's lines in its paint
  ok(kind + ': every line and border black', Object.keys(sd).length === 0, JSON.stringify(sd));
  ok(kind + ': the field shows O.L.', /O\.L\./.test(await field()), await field());
  var ids = async function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var b4 = await ids(); await page.click('#m2-editwin button[data-make="' + protein + '"]'); await page.mouse.click(1150, 820); await page.waitForTimeout(900); await page.keyboard.press('Escape');
  var nid = (await ids()).filter(function (x) { return b4.indexOf(x) < 0; })[0];
  var nf = nid ? await page.$eval('#m2-img [data-n="' + nid + '"]', function (g) { var e = g.querySelector('[class*="c-protein"]') || g.querySelector('[fill]'); return e ? e.getAttribute('fill').toLowerCase() : null; }) : null;
  ok(kind + ': a new protein #e7dbe2', nf === '#e7dbe2', nid + ' ' + nf);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500); await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
  ok(kind + ': two undos, the file as it was', (await text()) === t0);
  ok(kind + ': no script error', errs.length === 0, errs.join(' | '));
  await page.close();
}
(async function () {
  var b = await chromium.launch();
  await run(b, 'tag-celldesigner', 'CellDesigner', 'cd:PROTEIN');
  await run(b, 'srebp-sbgn', 'SBGN-ML', 'macromolecule');
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
