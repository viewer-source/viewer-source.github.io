// Line grid in the browser (core.js lineStep, portStep, gridSpot): ports and bend points step by the line grid that
// follows Grid size (Grid size 8: 4, 16: 8, 10: 5), set in this browser before the page loads with Snap to grid on.
// Glycolysis (GraphML): the longest line selected, its source end clicked (the end the keys move), Left pressed three
// times: each press after the first moves the port (sx, sy in the file, the offset from the node's centre) by the step,
// to a place on the step's lattice, and the end then dragged a few px with Snap on lands on the lattice in x and y; a bend point made by dragging the line with Snap on lands on the lattice (y:Point x
// and y multiples of the step); the arrow keys on that bend point move it by 1, Shift 10, as nodes (as designed, not the
// step). Testing Glycolysis (SBGN-ML): the same port presses, measured on screen by the four marks round the end (map
// units from the bend point's Shift move of 10), and the bend point made by a drag on the lattice (the arc's next point
// in the file). CellDesigner maps have no line grid (F.fixedEnds, celldesigner.js), not tested here. Nothing is saved (no token). No script error.
//   node tests/line-grid.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var STEPS = [[8, 4], [16, 8], [10, 5]];
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var near = function (a, b, t) { return Math.abs(a - b) < (t || 0.02); };
  var onLat = function (v, s) { return near(v / s, Math.round(v / s), 0.004); };
  for (var G of STEPS) for (var h of ['glycolysis-graphml', 'glycolysis-sbgn']) {
    var g = G[0], st = G[1], tag = h + ', Grid size ' + g;
    var page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', function (e) { errs.push(e.message); });
    await page.addInitScript(function (g) { try { localStorage.setItem('atlas-edit-grid', JSON.stringify({ shown: true, snap: true, step: g })); } catch (e) {} }, g);
    var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
    var lineAt = function (id, at) { return page.evaluate(function (a) {   // a point at share a[1] along the line's longest drawn part, on screen
      var all = []; document.querySelectorAll('#m2-img [data-e="' + a[0] + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
      var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() * a[1]), m = q.getScreenCTM();
      return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, [id, at]); };
    var marks = function () { return page.$$eval('.m2-ed-bend', function (l) { return l.map(function (x) { var r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); }); };
    var partAt = async function () { var m = await marks(); if (m.length < 4) return null; m = m.slice(-4); return [(m[0][0] + m[1][0] + m[2][0] + m[3][0]) / 4, (m[0][1] + m[1][1] + m[2][1] + m[3][1]) / 4]; };   // the four marks round the part the keys move, pushed last (paint)
    // the file's line geometry: GraphML each y:Path's sx, sy, tx, ty and its points; SBGN-ML each arc's start, next, end
    var geo = function () { return page.evaluate(function () {
      var t = window.m2EditNow().text, o = [];
      if (/<graphml/.test(t)) (t.match(/<y:Path\b[^>]*?(?:\/>|>[\s\S]*?<\/y:Path>)/g) || []).forEach(function (p) {
        var n = function (k) { var m = new RegExp('\\s' + k + '="([^"]*)"').exec(p); return m ? parseFloat(m[1]) : 0; };
        o.push({ port: [n('sx'), n('sy'), n('tx'), n('ty')], pts: (p.match(/<y:Point [^>]*>/g) || []).map(function (q) { return [parseFloat(/x="([^"]*)"/.exec(q)[1]), parseFloat(/y="([^"]*)"/.exec(q)[1])]; }) });
      });
      else { var d = new DOMParser().parseFromString(t, 'application/xml'); Array.prototype.forEach.call(d.getElementsByTagName('*'), function (a) {
        if (a.localName !== 'arc') return; var pt = function (n) { return Array.prototype.filter.call(a.children, function (c) { return c.localName === n; }).map(function (c) { return [parseFloat(c.getAttribute('x')), parseFloat(c.getAttribute('y'))]; }); };
        o.push({ port: pt('start').concat(pt('end')).reduce(function (u, v) { return u.concat(v); }, []), pts: pt('next') });
      }); }
      return o; }); };
    var changed = function (A, B) { var out = []; A.forEach(function (a, i) { if (JSON.stringify(a) !== JSON.stringify(B[i])) out.push([a, B[i]]); }); return out; };

    await page.goto(base + '#' + h, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!window.m2EditNow() && document.querySelectorAll('#m2-img [data-e]').length > 0; }, null, { timeout: 30000 }); await page.waitForTimeout(3000);
    // the longest drawn line between two nodes
    var arc = await page.evaluate(function () {
      var len = function (g) { var q = Array.prototype.slice.call(g.querySelectorAll('path, polyline')).filter(function (x) { return x.getTotalLength; }).map(function (x) { return x.getTotalLength(); }); return Math.max.apply(null, [0].concat(q)); };
      return Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-e]')).sort(function (u, v) { return len(v) - len(u); })[0].getAttribute('data-e'); });
    var portMoves = null;
    // the port: the line selected, its source end square clicked, then Left three times
    await page.mouse.click(10, 880); await page.keyboard.press('Escape');
    var mid = await lineAt(arc, 0.5);
    await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(500);
    var sq = await marks(), src = await lineAt(arc, 0.0);
    var end = sq.sort(function (u, v) { return Math.hypot(u[0] - src[0], u[1] - src[1]) - Math.hypot(v[0] - src[0], v[1] - src[1]); })[0];   // the end square nearest the line's drawn start
    if (!end) { ok(tag + ': the line selected, its end squares shown', false); await page.close(); continue; }
    await page.mouse.click(end[0], end[1]); await page.waitForTimeout(500);
    var g0 = await geo(), p0 = await partAt(), ps = [p0], gs = [g0];
    ok(tag + ': its end clicked, the four marks round it', !!p0);
    for (var j = 0; j < 3; j++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(900); ps.push(await partAt()); gs.push(await geo()); }
    if (/graphml/.test(h)) {
      var ch = gs.slice(1).map(function (G2, j) { return changed(gs[j], G2); });
      var xs = ch.map(function (c) { return c.length === 1 ? c[0][1].port : null; });
      var d1 = ch[1].length === 1 ? Math.hypot(ch[1][0][1].port[0] - ch[1][0][0].port[0], ch[1][0][1].port[1] - ch[1][0][0].port[1]) + Math.hypot(ch[1][0][1].port[2] - ch[1][0][0].port[2], ch[1][0][1].port[3] - ch[1][0][0].port[3]) : null;
      var d2 = ch[2].length === 1 ? Math.hypot(ch[2][0][1].port[0] - ch[2][0][0].port[0], ch[2][0][1].port[1] - ch[2][0][0].port[1]) + Math.hypot(ch[2][0][1].port[2] - ch[2][0][0].port[2], ch[2][0][1].port[3] - ch[2][0][0].port[3]) : null;
      ok(tag + ': Left, the second and third presses each move the port by ' + st, d1 != null && near(d1, st) && d2 != null && near(d2, st), JSON.stringify(ch.map(function (c) { return c.map(function (q) { return [q[0].port, q[1].port]; }); })));
      var c3 = ch[2][0], xi = c3 && (c3[1].port[0] !== c3[0].port[0] ? 0 : 2), xv = c3 ? c3[1].port[xi] : null;
      ok(tag + ': the port moved along x, on the lattice of ' + st + ' (' + xv + ')', xv != null && onLat(xv, st), JSON.stringify(c3));
      // the end dragged a little inside its node, Snap on: lands on the lattice in x and y
      var pe = ps[3], G3 = gs[3];
      if (pe) {
        await page.mouse.move(pe[0], pe[1]); await page.mouse.down(); await page.mouse.move(pe[0] + 3, pe[1] + 2, { steps: 3 }); await page.mouse.move(pe[0] + 7, pe[1] + 5, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(1500);
        var cd2 = changed(G3, await geo()), pp = cd2.length === 1 ? cd2[0][1].port : null, pv = pp && [pp[xi], pp[xi + 1]];
        ok(tag + ': the end dragged with Snap on, x and y on the lattice of ' + st + ' (' + (pv || []).join(', ') + ')', !!pv && onLat(pv[0], st) && onLat(pv[1], st), JSON.stringify(cd2));
      }
    } else portMoves = ps;   // SBGN-ML: on screen, measured once the unit is known (below)
    // a bend point made by dragging the line at a third of its length, Snap on
    await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.keyboard.press('Escape');
    var B0 = await geo(), q1 = await lineAt(arc, 0.33);
    await page.mouse.click(q1[0], q1[1]); await page.waitForTimeout(400);
    await page.mouse.move(q1[0], q1[1]); await page.mouse.down(); await page.mouse.move(q1[0] + 9, q1[1] + 13, { steps: 4 }); await page.mouse.move(q1[0] + 23, q1[1] + 37, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(1500);
    var B1 = await geo(), cb = changed(B0, B1);
    var newPt = cb.length === 1 ? cb[0][1].pts.filter(function (p) { return !cb[0][0].pts.some(function (q) { return near(p[0], q[0]) && near(p[1], q[1]); }); })[0] : null;
    ok(tag + ': a bend point made by a drag', !!newPt, JSON.stringify(cb));
    if (newPt) {
      ok(tag + ': on the lattice of ' + st + ' (' + newPt.join(', ') + ')', onLat(newPt[0], st) && onLat(newPt[1], st));
      // the arrow keys on a bend point stay 1, Shift 10, as for nodes (notes/port-grid.md)
      var s1 = await partAt();
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1200);
      var B2 = await geo(), c2 = changed(B1, B2), moved = c2.length === 1 ? c2[0][1].pts.filter(function (p) { return !c2[0][0].pts.some(function (q) { return near(p[0], q[0]) && near(p[1], q[1]); }); })[0] : null;
      ok(tag + ': Right moves the bend point by 1', !!moved && near(moved[0] - newPt[0], 1) && near(moved[1], newPt[1]), JSON.stringify([newPt, moved]));
      var s2 = await partAt();
      await page.keyboard.press('Shift+ArrowDown'); await page.waitForTimeout(1200);
      var B3 = await geo(), c3b = changed(B2, B3), m3 = c3b.length === 1 ? c3b[0][1].pts.filter(function (p) { return !c3b[0][0].pts.some(function (q) { return near(p[0], q[0]) && near(p[1], q[1]); }); })[0] : null;
      var s3 = await partAt();
      ok(tag + ': Shift with Down moves it by 10', !!m3 && !!moved && near(m3[1] - moved[1], 10) && near(m3[0], moved[0]), JSON.stringify([moved, m3]));
      if (portMoves && s2 && s3) {   // the end's moves on screen in map units, the unit from the bend point's 10
        var unit = Math.abs(s3[1] - s2[1]) / 10, dd = portMoves.slice(1).map(function (p, j) { return p && portMoves[j] ? Math.hypot(p[0] - portMoves[j][0], p[1] - portMoves[j][1]) / unit : null; });
        ok(tag + ': Left, the second and third presses each move the end by ' + st + ' (' + dd.map(function (v) { return v == null ? '-' : v.toFixed(2); }).join(', ') + ')', dd[1] != null && near(dd[1], st, 0.15) && near(dd[2], st, 0.15));
      }
    }
    await page.close();
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
