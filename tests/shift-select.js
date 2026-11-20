// Shift with a drag selecting inside compartments and complexes (core.js down, band; release takes every node whose box
// lies wholly in the area): on Testing Glycolysis (SBGN-ML), Glycolysis (CellDesigner) and Glycolysis (GraphML), in edit
// mode, zoomed in on the largest complex, Shift with a drag started inside it, off its members, round one member: the
// band drawn while it runs; on release the members wholly in the area selected, the complex not; the map not moved,
// the file unchanged. The same
// inside a compartment: on the SBGN-ML and CellDesigner maps a compartment dropped from the palette and a protein put in
// it (these maps have no compartment), then Shift with a drag from the compartment's inside round the protein: the
// protein selected, the compartment not, nothing moved. Nothing is saved (no token). No script error.
//   node tests/shift-select.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var MAPS = [['glycolysis-sbgn', 'compartment', 'macromolecule'], ['glycolysis-celldesigner', 'cd:COMPARTMENT', 'cd:PROTEIN'], ['glycolysis-graphml', null, null]];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var rects = function () { return page.$$eval('#m2-img [data-n]', function (l) { var o = {}; l.forEach(function (g) { var r = g.getBoundingClientRect(); o[g.getAttribute('data-n')] = [r.left, r.top, r.right, r.bottom]; }); return o; }); };
  var ids = async function () { return Object.keys(await rects()); };
  var imgAt = function () { return page.$eval('#m2-img', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.width]; }); };
  var selected = function () { return page.evaluate(function () {   // eight handles round each node selected, matched to the drawn node nearest in centre and size
    var hs = Array.prototype.slice.call(document.querySelectorAll('.m2-ed-handle')).map(function (q) { var r = q.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    var ns = Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-n]')).map(function (g) { return [g.getAttribute('data-n'), g.getBoundingClientRect()]; }), out = [];
    for (var i = 0; i + 7 < hs.length; i += 8) {
      var L = hs[i][0], T = hs[i][1], R = hs[i + 7][0], B = hs[i + 7][1], cx = (L + R) / 2, cy = (T + B) / 2, best = null;
      ns.forEach(function (n) { var r = n[1], d = Math.abs(r.left + r.width / 2 - cx) + Math.abs(r.top + r.height / 2 - cy) + Math.abs(r.width - (R - L)) + Math.abs(r.height - (B - T)); if (!best || d < best[1]) best = [n[0], d]; });
      if (best) out.push(best[0]);
    }
    return Array.from(new Set(out)).sort(); }); };
  var drop = async function (sign, x, y) {
    var before = await ids(), s = await page.$eval('#m2-editwin button[data-make="' + sign + '"]', function (q) { var r = q.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.move(s[0], s[1]); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 6 }); await page.mouse.move(x, y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
    return (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0];
  };
  // Shift with a drag from S to E; whether the band was drawn midway; the selection after
  var shiftDrag = async function (S, E) {
    await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.waitForTimeout(200); await page.keyboard.press('Escape');
    await page.mouse.move(S[0], S[1]); await page.keyboard.down('Shift'); await page.mouse.down();
    await page.mouse.move((S[0] + E[0]) / 2, (S[1] + E[1]) / 2, { steps: 5 });
    var band = !!(await page.$('.m2-ed-band'));
    await page.mouse.move(E[0], E[1], { steps: 5 }); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(600);
    return { band: band, sel: await selected() };
  };
  // the band's corner opposite S round box m, 6 px outside it
  var corner = function (S, m) { return [S[0] <= m[0] ? m[2] + 6 : m[0] - 6, S[1] <= m[1] ? m[3] + 6 : m[1] - 6]; };
  var within = function (r, S, E) { var a = [Math.min(S[0], E[0]), Math.min(S[1], E[1])], c = [Math.max(S[0], E[0]), Math.max(S[1], E[1])]; return r[0] >= a[0] && r[1] >= a[1] && r[2] <= c[0] && r[3] <= c[1]; };
  var check = async function (name, holder, member) {   // Shift with a drag from inside holder round member
    var R = await rects(), H = R[holder], M = R[member];
    var kids = Object.keys(R).filter(function (k) { return k !== holder && R[k][0] >= H[0] - 0.5 && R[k][1] >= H[1] - 0.5 && R[k][2] <= H[2] + 0.5 && R[k][3] <= H[3] + 0.5; });
    var S = null;   // inside the holder, off what it holds, at a corner of the member's side
    for (var d = 4; d < 30 && !S; d += 2) [[H[0] + d, H[1] + d], [H[2] - d, H[1] + d], [H[0] + d, H[3] - d], [H[2] - d, H[3] - d]].forEach(function (P) {
      if (S || kids.some(function (k) { var q = R[k]; return P[0] > q[0] - 4 && P[0] < q[2] + 4 && P[1] > q[1] - 4 && P[1] < q[3] + 4; })) return;
      var E = corner(P, M); if (E[0] > H[0] + 1 && E[0] < H[2] - 1 && E[1] > H[1] + 1 && E[1] < H[3] - 1) S = P;
    });
    ok(name + ': a start inside it, off what it holds, the area ending inside it', !!S, JSON.stringify([H, M]));
    if (!S) return;
    var E = corner(S, M), t0 = await now(), i0 = await imgAt(), r = await shiftDrag(S, E);
    var want = kids.filter(function (k) { return within(R[k], S, E); });
    ok(name + ': the band drawn while dragging', r.band);
    ok(name + ': the member selected', r.sel.indexOf(member) >= 0, JSON.stringify(r.sel));
    ok(name + ': every node wholly in the area selected, nothing else, not the holder', want.every(function (k) { return r.sel.indexOf(k) >= 0; }) && r.sel.every(function (k) { return k !== holder && kids.indexOf(k) >= 0; }), JSON.stringify([want, r.sel]));
    var i1 = await imgAt();
    ok(name + ': the map not moved, the file unchanged', (await now()) === t0 && Math.abs(i0[0] - i1[0]) < 0.5 && Math.abs(i0[1] - i1[1]) < 0.5, JSON.stringify([i0, i1]));
  };

  for (var M of MAPS) {
    var h = M[0];
    await page.goto('about:blank'); await page.goto(base + '#' + h, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!window.m2EditNow() && document.querySelectorAll('#m2-img [data-n]').length > 0; }, null, { timeout: 30000 }); await page.waitForTimeout(3000);
    // the largest complex on screen holding a member that holds nothing, zoomed in (Ctrl with the wheel) to 400 px or more
    var view = await page.$eval('#m2-view', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
    var inR = function (a, c) { return a[0] >= c[0] - 0.5 && a[1] >= c[1] - 0.5 && a[2] <= c[2] + 0.5 && a[3] <= c[3] + 0.5; }, area = function (a) { return (a[2] - a[0]) * (a[3] - a[1]); };
    var find = function (R) {
      var pair = null;
      Object.keys(R).forEach(function (c) {
        if (!inR(R[c], view) || (pair && area(R[pair[0]]) >= area(R[c]))) return;
        var ks = Object.keys(R).filter(function (k) { return k !== c && area(R[k]) < area(R[c]) && inR(R[k], R[c]); });
        var leaf = ks.filter(function (k) { return !ks.some(function (j) { return j !== k && area(R[j]) < area(R[k]) && inR(R[j], R[k]); }); });
        if (ks.length >= 2 && leaf.length) pair = [c, leaf[0]];
      });
      return pair;
    };
    var pair = find(await rects());
    for (var z = 0; pair && z < 12; z++) {
      var Rc = (await rects())[pair[0]]; if (Rc[2] - Rc[0] >= 400) break;
      await page.mouse.move((Rc[0] + Rc[2]) / 2, (Rc[1] + Rc[3]) / 2); await page.keyboard.down('Control'); await page.mouse.wheel(0, -200); await page.keyboard.up('Control'); await page.waitForTimeout(400);
    }
    await page.waitForTimeout(800);
    ok(h + ': a complex with members on screen', !!pair);
    if (pair) await check(h + ', inside a complex', pair[0], pair[1]);
    if (M[1]) {
      var C = await drop(M[1], view[2] - 150, view[3] - 120), P = C && await drop(M[2], view[2] - 150, view[3] - 120);
      await page.keyboard.press('Escape');
      ok(h + ': a compartment dropped and a protein in it', !!C && !!P);
      if (C && P) await check(h + ', inside a compartment', C, P);
    }
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
