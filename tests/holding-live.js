// What holds what, the same under Node and in the browser (plan 3 step 7): on Testing Glycolysis SBGN-ML in the full
// editor (no token, the working tree's editor and renderers routed into the live /styles/ page), a compartment is made
// with a glyph inside it and one outside, and the editor's gestures are made on them: the member dragged past the
// compartment's border (its holder grows), the member taken out with Shift (it leaves), the free glyph dragged into the
// compartment (it joins), the compartment resized so the member is no longer in it (it is let go). After each, the
// editor's GraphML (every node's holder and box) is compared with holding.settle run under Node on the GraphML from
// before the gesture, given the same moves; then the gesture is undone. Any holder or box that differs is named.
//   node tests/holding-live.js [viewer folder]   (LIVE=1: the page's own code)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var here = process.argv[2] || path.join(__dirname, '..'), URL = 'https://viewer-source.github.io/styles/#testing-glycolysis-sbgn', bad = 0;
var HM = require('./lib/holding-model.js');
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
function nodesOf(g) {   // id -> { up: holder id, box }
  var E = HM.editorOf(g, false), o = {};
  E.N.forEach(function (n, k) { o[n.id] = { up: n.up == null ? null : E.N[n.up].id, box: E.boxOf(k) }; });
  return o;
}
// what Node gives for a gesture: the GraphML before (g0), how, the ids moved, the boxes after for those ids (now)
function expected(g0, how, ids, now) {
  var E = HM.editorOf(g0, false), N = E.N, before = {}, at = {};
  N.forEach(function (n, k) { before[n.id] = E.boxOf(k); at[n.id] = k; });
  var B = function (k) { return now[N[k].id] || E.boxOf(k); }, d = ids.length && how !== 'box' ? [now[ids[0]][0] - before[ids[0]][0], now[ids[0]][1] - before[ids[0]][1]] : [0, 0];
  var r = HM.HOLD.settle(HM.model(N, B, false), { how: how, ids: ids, before: before, away: { x0: Math.min(0, d[0]), x1: Math.max(0, d[0]), y0: Math.min(0, d[1]), y1: Math.max(0, d[1]) } });
  var o = {};
  N.forEach(function (n, k) { o[n.id] = { up: n.up == null ? null : N[n.up].id, box: B(k) }; });
  r.moves.forEach(function (m) { o[m[0]].up = m[1]; });
  Object.keys(r.boxes).forEach(function (id) { o[id].box = r.boxes[id]; });
  return o;
}
function compare(what, want, got) {
  var diffs = [], close = function (a, b) { return a.every(function (v, j) { return Math.abs(v - b[j]) <= 0.06; }); };
  Object.keys(want).forEach(function (id) {
    var g = got[id];
    if (!g) { diffs.push(id + ' missing'); return; }
    if (g.up !== want[id].up) diffs.push(id + ' held by ' + g.up + ', Node: ' + want[id].up);
    if (!close(g.box, want[id].box)) diffs.push(id + ' box ' + g.box.map(Math.round) + ', Node: ' + want[id].box.map(Math.round));
  });
  ok(what + ': the same holders and boxes as under Node', !diffs.length, diffs.slice(0, 4).join('; '));
}
(async function () {
  var b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  if (!process.env.LIVE) {
    var ed = require('./editor-now.js')(here);
    await p.route(/\/styles\/editor\/editor\.js(\?|$)/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await p.route(/\/styles\/renderers\/.*\.js/, function (r) { var f = /renderers\/(.*\.js)/.exec(r.request().url())[1]; r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(here, 'renderers', f), 'utf8') }); });
  }
  p.on('pageerror', function (e) { errs.push(e.message); });
  await p.addInitScript(function () { try { localStorage.removeItem('atlas-cd-compatible'); localStorage.removeItem('atlas-edit-padding'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); } catch (e) {} });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await p.click('.m2-ri[data-win="edit"]');
  await p.waitForSelector('#m2-editwin button[data-make="compartment"]', { state: 'visible', timeout: 30000 }); await p.waitForTimeout(2500);
  var text = function () { return p.evaluate(function () { var s = window.m2EditState(), t = null; Object.keys(s).forEach(function (k) { if (s[k] && typeof s[k].text === 'string') t = s[k].text; }); return t; }); };
  var ids = function () { return p.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var rect = function (id) { return p.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var make = async function (kind, x, y) { var b4 = await ids(); await p.click('#m2-editwin button[data-make="' + kind + '"]'); await p.mouse.click(x, y); await p.waitForTimeout(1200); await p.keyboard.press('Escape'); return (await ids()).filter(function (z) { return b4.indexOf(z) < 0; })[0]; };
  var drag = async function (from, to, shift) {
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    await p.mouse.click(from[0], from[1]); await p.waitForTimeout(300);   // selected first, as a person does
    if (shift) await p.keyboard.down('Shift');
    await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.mouse.move(to[0], to[1], { steps: 16 }); await p.waitForTimeout(150); await p.mouse.up();
    if (shift) await p.keyboard.up('Shift');
    await p.waitForTimeout(1800);
  };
  var undo = async function () { await p.keyboard.press('Control+z'); await p.waitForTimeout(1500); };
  var C = await make('compartment', 900, 450);
  var c = await rect(C);
  var A = await make('macromolecule', c[0] + c[2] / 2, c[1] + c[3] / 2), F = await make('macromolecule', c[0] - 200, c[1] + c[3] / 2);
  var g0 = await text(), n0 = nodesOf(g0);
  ok('made: a compartment holding a glyph, a glyph outside it', n0[A] && n0[A].up === C && n0[F] && n0[F].up == null, JSON.stringify({ A: n0[A], F: n0[F] }));
  var gesture = async function (what, how, moved, run) {
    var g = await text(), before = nodesOf(g);
    await run();
    var g1 = await text(), after = nodesOf(g1), now = {};
    if (g1 === g) { ok(what + ': the editor changed the map', false); return; }
    moved.forEach(function (id) { now[id] = after[id].box; });
    compare(what, expected(g, how, moved, now), after);
    await undo();
    ok(what + ': undone', (await text()) === g);
  };
  var a = await rect(A), cr = await rect(C);
  await gesture('the member dragged 40 px past the compartment’s right border (it grows)', 'plain', [A], function () { return drag([a[0] + a[2] / 2, a[1] + a[3] / 2], [cr[0] + cr[2] - a[2] / 2 + 40, a[1] + a[3] / 2]); });
  await gesture('the member taken out with Shift (it leaves)', 'alone', [A], function () { return drag([a[0] + a[2] / 2, a[1] + a[3] / 2], [cr[0] + cr[2] + a[2] + 220, cr[1] - a[3] - 60], true); });
  var f = await rect(F);
  await gesture('the free glyph dragged into the compartment (it joins)', 'plain', [F], function () { return drag([f[0] + f[2] / 2, f[1] + f[3] / 2], [cr[0] + cr[2] / 2, cr[1] + cr[3] / 2 + a[3] + 10]); });
  // the compartment resized from its left edge past the member (it is let go): selected first by a click on its border
  await gesture('the compartment resized past its member (it is let go)', 'box', [C], async function () {
    await p.keyboard.press('Escape'); await p.mouse.click(cr[0] + 1, cr[1] + cr[3] / 2); await p.waitForTimeout(400);
    await p.mouse.move(cr[0] + 1, cr[1] + cr[3] / 2); await p.mouse.down(); await p.mouse.move(a[0] + a[2] + 30, cr[1] + cr[3] / 2, { steps: 16 }); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(1800);
  });
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(bad ? bad + ' wrong' : 'all right');
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.log('WRONG', e && e.stack || e); process.exit(1); });
