// A bend point dropped onto its neighbour on the line (core.js onNeighbour): on Aspirin (GraphML), the first line drawn
// with a bend, selected, its bend dragged onto the line's end square: the bend is gone in the same step (one handle
// fewer, the line still selected, no square hiding under another); Ctrl+Z brings it back; the bend dragged 30 px into
// open space stays; a new bend pulled out of the line and dropped onto the start square is not made (a bend a fraction of
// a unit before the end drew two squares one over the other, a 1 px edge showing).
// Nothing is saved (no token). No script error.
//   node tests/bend-merge.js [base address] [--local]   (--local: the working tree's editor routed in)
var { chromium } = require('playwright');
var path = require('path'), editorNow = require('./editor-now.js'), here = path.join(__dirname, '..');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a !== '--local'; });
var base = args[0] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) { var ed = editorNow(here); await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); }); }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  // the line's squares (a selected bend's four smaller marks round it counted as that one bend)
  var handles = function () { return page.$$eval('rect.m2-ed-bend', function (l) {
    var w = Math.max.apply(null, l.map(function (r) { return r.getBoundingClientRect().width; }).concat(0)), out = [], marks = [];
    l.forEach(function (r) { var q = r.getBoundingClientRect(), c = [q.left + q.width / 2, q.top + q.height / 2]; (q.width >= 0.9 * w ? out : marks).push(c); });
    if (marks.length === 4) out.push([marks.reduce(function (s, c) { return s + c[0]; }, 0) / 4, marks.reduce(function (s, c) { return s + c[1]; }, 0) / 4]);
    return out; }); };
  var drag = async function (A, B) { await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, { steps: 5 }); await page.mouse.move(B[0], B[1], { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(1500); };
  await page.goto(base + '#aspirin-graphml', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
  await page.click('button[data-win="edit"]');
  await page.waitForTimeout(2500);
  // the first line with a bend: its points on screen
  var line = await page.evaluate(function () {
    var gs = document.querySelectorAll('#m2-img g[data-e]');
    for (var i = 0; i < gs.length; i++) {
      var q = gs[i].querySelector('path'), d = q.getAttribute('d'), n = (d.match(/[ML]/g) || []).length;
      if (n < 3) continue;
      var m = q.getScreenCTM(), pts = d.match(/-?[\d.]+\s+-?[\d.]+/g).map(function (s) { var v = s.split(/\s+/).map(Number); return [m.a * v[0] + m.c * v[1] + m.e, m.b * v[0] + m.d * v[1] + m.f]; });
      return { id: gs[i].getAttribute('data-e'), pts: pts };
    }
    return null;
  });
  ok('a line with a bend found', !!line);
  if (!line) { await b.close(); process.exit(1); }
  var mid = [(line.pts[0][0] + line.pts[1][0]) / 2, (line.pts[0][1] + line.pts[1][1]) / 2];
  await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(800);
  var h0 = await handles();
  ok('the line selected shows its squares (' + h0.length + ')', h0.length >= 3);
  var n0 = h0.length, bend = h0[n0 - 2], end = h0[n0 - 1];
  // 1. the last bend dropped one px off the end's square: gone
  await drag(bend, [end[0] + 1, end[1]]);
  var h1 = await handles();
  ok('the bend dropped on the end is gone (' + n0 + ' to ' + h1.length + ')', h1.length === n0 - 1);
  var over = h1.some(function (p, i) { return h1.some(function (q, j) { return j !== i && Math.abs(p[0] - q[0]) < 4 && Math.abs(p[1] - q[1]) < 4; }); });
  ok('no square over another', !over);
  // 2. undo brings it back
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(800);
  var h2 = await handles();
  ok('Ctrl+Z brings the bend back (' + h2.length + ')', h2.length === n0);
  // 3. the bend dragged into open space stays
  var b2 = h2[n0 - 2], away = [b2[0] - 30, b2[1] - 30];
  await drag(b2, away);
  var h3 = await handles();
  ok('a bend dropped in open space stays (' + h3.length + ')', h3.length === n0);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);
  await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(800);
  // 4. a new bend pulled from the line's first segment and dropped onto the start square: none made
  var h4 = await handles(), m4 = [(h4[0][0] + h4[1][0]) / 2, (h4[0][1] + h4[1][1]) / 2];
  await drag(m4, [h4[0][0] + 1, h4[0][1]]);
  var h5 = await handles();
  ok('a new bend dropped on the start is not made (' + h5.length + ')', h5.length === h4.length);
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
