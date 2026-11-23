// A tag's line (an equivalence arc, SBGN only) with its entity end dragged onto another entity: the arc then joins the tag
// to that entity in the SBGN-ML text, one undo step; its tag end dragged elsewhere and its entity end onto a process stay
// where they are (an end let go there goes back onto its own node, a port move of its own). On Testing Glycolysis SBGN-ML, a tag and two macromolecules made. Nothing is saved (no token).
//   node tests/tag-line-move.js [address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) { var ed = require('./editor-now.js')(local); await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); }); }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var at = async function (id) { var r = await rect(id); return [r[0] + r[2] / 2, r[1] + r[3] / 2]; };
  var make = async function (kind, x, y) { var b4 = await ids(); await page.click('#m2-editwin button[data-make="' + kind + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (z) { return b4.indexOf(z) < 0; })[0]; };
  var text = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var arcOf = async function (id) { var m = (await text()).match(new RegExp('<arc [^>]*id="' + id + '"[^>]*>')); return m ? m[0] : ''; };
  var marks = function () { return page.$$eval('.m2-ed-bend', function (l) { return l.map(function (x) { var r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); }); };
  var lineAt = function (id, s) { return page.evaluate(function (a) {
    var all = []; document.querySelectorAll('#m2-img [data-e="' + a[0] + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() * a[1]), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, [id, s]); };
  var dragEnd = async function (arc, near, to) {   // the line selected, its end square nearest `near` dragged to `to`
    var m = [];
    for (var n = 0; n < 3 && !m.length; n++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); var mid = await lineAt(arc, 0.4 + 0.1 * n); await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(600); m = await marks(); }
    var sq = m.sort(function (u, v) { return Math.hypot(u[0] - near[0], u[1] - near[1]) - Math.hypot(v[0] - near[0], v[1] - near[1]); })[0];
    await page.mouse.move(sq[0], sq[1]); await page.mouse.down(); await page.mouse.move(sq[0] + 10, sq[1] + 10, { steps: 4 }); await page.mouse.move(to[0], to[1], { steps: 12 });
    await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(1500); await page.keyboard.press('Escape');
  };
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-cd-compatible'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="tag"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var tg = await make('tag', 900, 450), m1 = await make('macromolecule', 1150, 450), m2 = await make('macromolecule', 1150, 650), p = await make('process', 900, 700);
  var e0 = await es(), A = await at(tg), B = await at(m1);
  await page.click('#m2-editwin button[data-make="consumption"]');
  await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 8, A[1] + 20, { steps: 4 }); await page.mouse.move(B[0], B[1], { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(1200);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  var arc = (await es()).filter(function (i) { return e0.indexOf(i) < 0; })[0], a0 = await arcOf(arc);
  ok('the tag’s equivalence arc made to the first entity', /class="equivalence arc"/.test(a0) && a0.indexOf('"' + m1) >= 0, a0);
  await dragEnd(arc, await at(m1), await at(m2));
  var a1 = await arcOf(arc);
  ok('its entity end dragged onto the second entity: the arc joins the tag to it', a1.indexOf('"' + m2) >= 0 && a1.indexOf('"' + m1) < 0 && a1.indexOf('"' + tg) >= 0, a1);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1200);
  ok('one undo puts it back on the first entity', (await arcOf(arc)).indexOf('"' + m1) >= 0, await arcOf(arc));
  await page.keyboard.press('Control+y'); await page.waitForTimeout(1200);
  ok('redo joins it to the second again', (await arcOf(arc)) === a1, await arcOf(arc));
  await dragEnd(arc, await at(m2), await at(p));
  ok('its entity end dragged onto a process: it stays', (await arcOf(arc)) === a1, await arcOf(arc));
  await dragEnd(arc, await at(tg), await at(m1));
  ok('its tag end dragged onto an entity: it stays', (await arcOf(arc)) === a1, await arcOf(arc));
  ok('no script error', !errs.length, errs.join(' / '));
  console.log(bad ? bad + ' wrong' : 'all ok');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
