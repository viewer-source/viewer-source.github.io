// Right-click menus, object or map (core.js m2EditOnObject, the viewer's build): on Testing Glycolysis (SBGN-ML), Glycolysis
// (CellDesigner) and Glycolysis (GraphML), in edit mode a right click over a node (selected or not), a line, or inside
// a complex off its members holds that item's items only: none of the page's (Switch, New map, Full screen, Download,
// Copy image, Open in) and none of the whole map's tools (Show grid, Snap to grid, Snap map to grid, Repack all
// complexes, Remove all bend points); inside a complex Repack complex. On empty map space the page's items and the map's
// tools. In view mode the same places: over a molecule or complex its own items (Show annotation), none of the page's;
// on empty space the page's; inside a complex with no annotation (no item in view mode) the map's menu. Nothing is
// saved (no token). No script error.
//   node tests/menus-object.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/';
var PAGE = /^(Switch to|New SBGN-ML map|New CellDesigner map|Full screen|Download|Copy image|Open in)/, GRID = /^(Show grid|Snap to grid|Snap map to grid|Repack all complexes|Remove all bend points)/;
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var menu = async function (P) { await page.keyboard.press('Escape'); await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(350); var l = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); await page.keyboard.press('Escape'); return l; };
  var has = function (l, re) { return l.some(function (t) { return re.test(t); }); };
  // the places to right-click, read from the editor's drawing: a node holding nothing, a complex's inside off its
  // members, a line's middle, and empty map space (15 px from every node box and line)
  var places = function () { return page.evaluate(function () {
    var view = document.getElementById('m2-view').getBoundingClientRect();
    var ns = Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-n]')).map(function (g) { return { id: g.getAttribute('data-n'), r: g.getBoundingClientRect() }; })
      .filter(function (n) { return n.r.left > view.left + 20 && n.r.right < view.right - 20 && n.r.top > view.top + 20 && n.r.bottom < view.bottom - 20; });
    var inside = function (a, c) { return a.left >= c.left - 0.5 && a.top >= c.top - 0.5 && a.right <= c.right + 0.5 && a.bottom <= c.bottom + 0.5; };
    var kids = function (n) { return ns.filter(function (q) { return q !== n && q.r.width * q.r.height < n.r.width * n.r.height && inside(q.r, n.r); }); };
    var leaf = ns.filter(function (n) { return !kids(n).length && n.r.width > 25 && n.r.height > 15; })[0];
    var cpx = null;
    ns.forEach(function (n) {
      var k = kids(n); if (cpx || k.length < 1 || n.r.width > 600) return;
      for (var y = n.r.top + 3; y < n.r.bottom - 3 && !cpx; y += 2) for (var x = n.r.left + 3; x < n.r.right - 3 && !cpx; x += 2)
        if (!k.some(function (q) { return x > q.r.left - 4 && x < q.r.right + 4 && y > q.r.top - 4 && y < q.r.bottom + 4; })) cpx = { id: n.id, P: [x, y] };
    });
    var pts = [];   // every line's points on screen
    document.querySelectorAll('#m2-img [data-e] path, #m2-img [data-e] polyline, #m2-img [data-e] line').forEach(function (q) {
      if (!q.getTotalLength) return; var L = q.getTotalLength(), m = q.getScreenCTM();
      for (var s = 0; s <= L; s += 4) { var p = q.getPointAtLength(s); pts.push([m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f]); }
    });
    var line = null, best = 0;
    document.querySelectorAll('#m2-img [data-e]').forEach(function (g) {
      var q = Array.prototype.slice.call(g.querySelectorAll('path, polyline')).filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0];
      if (!q || q.getTotalLength() <= best) return; var p = q.getPointAtLength(q.getTotalLength() / 2), m = q.getScreenCTM(), P = [m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f];
      if (ns.some(function (n) { return P[0] > n.r.left - 6 && P[0] < n.r.right + 6 && P[1] > n.r.top - 6 && P[1] < n.r.bottom + 6; })) return;
      best = q.getTotalLength(); line = { id: g.getAttribute('data-e'), P: P };
    });
    var all = Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-n]')).map(function (g) { return g.getBoundingClientRect(); }), empty = null;
    for (var y = view.top + 40; y < view.bottom - 40 && !empty; y += 11) for (var x = view.left + 40; x < view.right - 40 && !empty; x += 11) {
      if (all.some(function (r) { return x > r.left - 15 && x < r.right + 15 && y > r.top - 15 && y < r.bottom + 15; })) continue;
      if (pts.some(function (p) { return Math.abs(p[0] - x) < 15 && Math.abs(p[1] - y) < 15; })) continue;
      empty = [x, y];
    }
    return { leaf: leaf && { id: leaf.id, P: [leaf.r.left + leaf.r.width / 2, leaf.r.top + leaf.r.height / 2] }, cpx: cpx, line: line, empty: empty };
  }); };

  for (var h of ['glycolysis-sbgn', 'glycolysis-celldesigner', 'glycolysis-graphml']) {
    await page.goto('about:blank'); await page.goto(base + '#' + h, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 }); await page.waitForTimeout(2000);
    var vEmpty0 = await page.evaluate(function () { var r = document.getElementById('m2-view').getBoundingClientRect(); return [r.left + 10, r.top + 10]; });
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!window.m2EditNow() && document.querySelectorAll('#m2-img [data-n]').length > 0; }, null, { timeout: 30000 }); await page.waitForTimeout(3000);
    var pl = await places();
    ok(h + ': places found (a node, a line, inside a complex, empty space)', pl.leaf && pl.line && pl.cpx && pl.empty, JSON.stringify(pl));
    if (!(pl.leaf && pl.empty)) continue;
    var m;
    m = await menu(pl.leaf.P);
    ok(h + ' edit: a node not selected, its own items only', m.length && !has(m, PAGE) && !has(m, GRID), m.join(' / '));
    await page.mouse.click(pl.leaf.P[0], pl.leaf.P[1]); await page.waitForTimeout(400);
    var selN = await page.$$eval('.m2-ed-handle', function (l) { return l.length; });   // eight handles round a node selected
    m = await menu(pl.leaf.P);
    ok(h + ' edit: the node selected, its own items only', selN > 0 && m.length && !has(m, PAGE) && !has(m, GRID), selN + ' ' + m.join(' / '));
    await page.keyboard.press('Escape');
    if (pl.line) {
      m = await menu(pl.line.P);
      ok(h + ' edit: a line, its own items only', m.length && !has(m, PAGE) && !has(m, GRID), m.join(' / '));
    }
    if (pl.cpx) {
      m = await menu(pl.cpx.P);
      ok(h + ' edit: inside a complex, Repack complex and none of the page\'s or grid items', m.indexOf('Repack complex') >= 0 && !has(m, PAGE) && !has(m, GRID), m.join(' / '));
    }
    m = await menu(pl.empty);
    ok(h + ' edit: empty space, the page\'s items and the map\'s tools', has(m, /^Switch to/) && has(m, /^Download/) && has(m, /^Full screen/) && has(m, /^Snap map to grid/) && has(m, /^Show grid/), m.join(' / '));
    // view mode, the map where it was
    var r0 = await page.$eval('#m2-img', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.width]; });
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !window.m2EditNow(); }, null, { timeout: 30000 }); await page.waitForTimeout(2500);
    var r1 = await page.$eval('#m2-img', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.width]; });
    ok(h + ': back in view mode, the map not moved', Math.abs(r0[0] - r1[0]) < 1 && Math.abs(r0[1] - r1[1]) < 1 && Math.abs(r0[2] - r1[2]) < 1, JSON.stringify([r0, r1]));
    m = await menu(pl.leaf.P);
    ok(h + ' view: a molecule, its own items only', m.indexOf('Show annotation') >= 0 && !has(m, PAGE), m.join(' / '));
    var mE = await menu(pl.empty);
    if (pl.cpx) {   // a complex is an item in view mode only where it has an annotation (the click data); else the map's menu
      m = await menu(pl.cpx.P);
      var own = m.indexOf('Show annotation') >= 0;
      ok(h + ' view: inside a complex, its own items only, or the map\'s where it is no item (' + (own ? 'an item' : 'no item') + ')', own ? !has(m, PAGE) && !has(m, GRID) : m.join('/') === mE.join('/'), m.join(' / '));
    }
    m = mE;
    ok(h + ' view: empty space, the page\'s items', has(m, /^Switch to/) && has(m, /^Download/) && has(m, /^Full screen/) && !has(m, GRID), m.join(' / '));
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
