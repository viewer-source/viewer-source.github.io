// Delete and Escape alike on every format, and an influence's arrow end moved to another activity, on a page with the
// editor, by default the styles page. Nothing is saved (no token). No script error.
// 1. SBGN-ML (Testing Glycolysis): a macromolecule placed, selected with a line elsewhere (Shift), Delete: both gone in
//    one step, undo brings both back.
// 2. Escape does one thing: with a node selected and a sign in hand, the first Escape drops the sign and keeps the
//    selection, the second clears the selection.
// 3. CellDesigner (Glycolysis): a species and a line selected, Delete from the right-click menu over the line: both gone.
// 4. Activity Flow (CaMKII): an influence's arrow end dragged onto another activity lands there.
//   node tests/delete-escape.js [base address] --data=<clone of the data repository>   (the Activity Flow map is its test set's CaMKII, added as a person adds a file)
var { chromium } = require('playwright'), path = require('path'), OM = require('./lib/open-map.js');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var data = (process.argv.filter(function (a) { return /^--data=/.test(a); })[0] || '').slice(7) ;
if (!data) { console.log('give --data=<clone of the site\'s data repository> (its test set)'); process.exit(2); }
var CAMKII_AF = path.join(data, 'test-maps/test-set/test-maps/sbgn-ml/af/sbgn-website/downloads/figure_to_sbgn/camkii_Nov2014_AF.sbgn');
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var start = async function (h, sign) {   // h: a site map's address, or { file } from the test set added by Add map from file
    if (h.file) await OM.byFile(page, base, h.file); else await OM.byAddress(page, base, h);
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    await page.waitForTimeout(2500);   // edit mode kept over a reload comes back by itself: the tab only when it did not
    if (!(await page.evaluate(function () { return document.querySelector('.m2').classList.contains('m2-editing'); }))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + sign + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var ids = function (sel) { return page.$$eval('#m2-img [' + sel + ']', function (l, sel) { return Array.from(new Set(l.map(function (x) { return x.getAttribute(sel); }))); }, sel); };
  var centre = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  // a point on a line's path at a fraction of its length, in the window
  var onLine = function (id, f) { return page.$eval('#m2-img [data-e="' + id + '"]', function (g, f) {
    var p = /^(path|polyline|line)$/.test(g.tagName) ? g : g.querySelector('path, polyline, line'); if (!p) return null;
    var L = p.getTotalLength(), q = p.getPointAtLength(L * f), m = p.getScreenCTM(); return [m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f]; }, f); };
  var count = function (tag) { return page.evaluate(function (tag) { var n = window.m2EditNow(); return n ? new DOMParser().parseFromString(n.text, 'application/xml').getElementsByTagName(tag).length : -1; }, tag); };
  var propsHidden = function () { return page.evaluate(function () { var m = document.querySelector('#m2-editwin .m2-ed-pmap'); return !m || !m.offsetParent; }); };
  var inView = function (P) { return P && P[0] > 260 && P[0] < 1380 && P[1] > 80 && P[1] < 880; };

  // 1 and 2, SBGN-ML
  await start('testing-glycolysis-sbgn', 'macromolecule');
  var n0 = await ids('data-n');
  await page.click('#m2-editwin button[data-make="macromolecule"]'); await page.mouse.click(700, 650); await page.waitForTimeout(900);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  var m = (await ids('data-n')).filter(function (x) { return n0.indexOf(x) < 0; })[0];
  ok('a macromolecule placed', !!m);
  var g0 = await count('glyph'), a0 = await count('arc'), line = null, P = null;
  for (var e of await ids('data-e')) { var q = await onLine(e, 0.5); if (inView(q)) { line = e; P = q; break; } }
  ok('a line in view to select', !!line);
  await page.mouse.click.apply(page.mouse, await centre(m)); await page.waitForTimeout(300);
  await page.keyboard.down('Shift'); await page.mouse.click(P[0], P[1]); await page.keyboard.up('Shift'); await page.waitForTimeout(300);
  await page.keyboard.press('Delete'); await page.waitForTimeout(900);
  var g1 = await count('glyph'), a1 = await count('arc');
  ok('Delete with a node and a line selected: the node gone', g1 === g0 - 1, g0 + ' -> ' + g1);
  ok('and the line gone too', a1 === a0 - 1, a0 + ' -> ' + a1);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
  ok('one undo brings both back', (await count('glyph')) === g0 && (await count('arc')) === a0);
  await page.mouse.click.apply(page.mouse, await centre(m)); await page.waitForTimeout(300);
  var selMarks = function () { return page.$$eval('#m2-edit-layer .m2-ed-handle, #m2-edit-layer .m2-ed-sel', function (l) { return l.length; }); };
  var s1 = await selMarks();
  await page.click('#m2-editwin button[data-make="process"]'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  var pressed = await page.$eval('#m2-editwin button[data-make="process"]', function (x) { return x.getAttribute('aria-pressed'); });
  ok('the first Escape drops the sign in hand', pressed !== 'true', String(pressed));
  ok('and keeps the selection', s1 > 0 && (await selMarks()) === s1, s1 + ' -> ' + (await selMarks()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok('the second Escape clears the selection', (await selMarks()) < s1, String(await selMarks()));

  // 3, CellDesigner
  await start('glycolysis-celldesigner', 'cd:PROTEIN');
  var cdCount = function (tag) { return page.evaluate(function (tag) { var n = window.m2EditNow(); return n ? new DOMParser().parseFromString(n.text, 'application/xml').getElementsByTagNameNS('*', tag).length : -1; }, tag); };
  var sp0 = await cdCount('speciesAlias'), r0 = await cdCount('reaction'), sp = null, ln = null, LP = null;
  for (var id of await ids('data-n')) { if (/\|/.test(id)) continue; var c = await centre(id); if (inView(c)) { sp = id; break; } }
  for (var e2 of await ids('data-e')) { var q2 = await onLine(e2, 0.3); if (inView(q2)) { ln = e2; LP = q2; break; } }
  ok('a species and a line in view', !!sp && !!ln, sp + ' ' + ln);
  await page.mouse.click.apply(page.mouse, await centre(sp)); await page.waitForTimeout(300);
  await page.keyboard.down('Shift'); await page.mouse.click(LP[0], LP[1]); await page.keyboard.up('Shift'); await page.waitForTimeout(300);
  await page.mouse.click(LP[0], LP[1], { button: 'right' }); await page.waitForTimeout(400);
  var del = await page.$('.m2-cx button:has-text("Delete"), .m2-cx [role="menuitem"]:has-text("Delete")');
  ok('Delete in the menu over the selected line', !!del);
  if (del) { await del.click(); await page.waitForTimeout(1500); }
  var sp1 = await cdCount('speciesAlias'), r1 = await cdCount('reaction');
  ok('the selected species gone too', sp1 < sp0, sp0 + ' -> ' + sp1);
  ok('and the line’s reaction', r1 < r0, r0 + ' -> ' + r1);

  // 4, Activity Flow
  await start({ file: CAMKII_AF }, 'activity');
  var arcs = await page.evaluate(function () { var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml'), g = {};
    Array.from(d.getElementsByTagName('glyph')).forEach(function (x) { g[x.getAttribute('id')] = x.getAttribute('class'); });
    return Array.from(d.getElementsByTagName('arc')).filter(function (a) { return a.getAttribute('class') === 'positive influence' && g[a.getAttribute('target')] === 'biological activity'; })
      .map(function (a) { return [a.getAttribute('id'), a.getAttribute('source'), a.getAttribute('target')]; }); });
  var acts = await page.evaluate(function () { return Array.from(new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml').getElementsByTagName('glyph')).filter(function (x) { return x.getAttribute('class') === 'biological activity'; }).map(function (x) { return x.getAttribute('id'); }); });
  var A = null;
  for (var a of arcs) { var E = await onLine(a[0], 1), S = await onLine(a[0], 0.5); if (inView(E) && inView(S)) { A = a; break; } }
  var to = null, TP = null;
  if (A) for (var t of acts) { if (t === A[1] || t === A[2]) continue; try { var c2 = await centre(t); if (inView(c2)) { to = t; TP = c2; break; } } catch (x) {} }
  ok('an influence between activities and another activity in view', !!A && !!to, JSON.stringify(A) + ' ' + to);
  if (A && to) {
    await page.mouse.click.apply(page.mouse, await onLine(A[0], 0.5)); await page.waitForTimeout(400);
    var EP = await onLine(A[0], 1);   // the end square nearest the line's end (the port, often inside the node)
    var sq = await page.$$eval('#m2-edit-layer rect', function (l) { return l.map(function (r) { var b = r.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }); });
    sq.sort(function (p, q) { return Math.hypot(p[0] - EP[0], p[1] - EP[1]) - Math.hypot(q[0] - EP[0], q[1] - EP[1]); });
    if (sq.length && Math.hypot(sq[0][0] - EP[0], sq[0][1] - EP[1]) < 60) EP = sq[0];
    await page.mouse.move(EP[0], EP[1]); await page.mouse.down(); await page.mouse.move((EP[0] + TP[0]) / 2, (EP[1] + TP[1]) / 2, { steps: 6 });
    await page.mouse.move(TP[0], TP[1], { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(1200);
    var now = await page.evaluate(function (id) { var x = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml').querySelector('arc[id="' + id + '"]'); return x ? x.getAttribute('target') : null; }, A[0]);
    ok('its arrow end dragged onto another activity lands there', now === to, A[2] + ' -> ' + now + ' (wanted ' + to + ')');
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
