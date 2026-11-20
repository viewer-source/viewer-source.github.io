// The bottom of a named complex after Repack all complexes (layout.js, the packer copied from the layout skill's
// complex_pack.py): on the styles page, every named complex of Testing Glycolysis (SBGN-ML) ends 24 under what its
// members draw (the name, 18.1 high there, 6 under them; a multimer's copy and a unit of information count as drawn) and
// every complex of Glycolysis CellDesigner 20 under; on the SBGN-ML map a complex inside another is followed by the next
// member 8 under it in the file, to that member's unit of information (its name not counted 10 below its new bottom); a named complex's label box lies inside it. Which complexes and members:
// the file the editor would save (m2EditNow); where they are drawn: each one's drawing on the map (getBBox, map units, its
// scale checked against the file). Undo puts the file back. Nothing is saved (no token). No script error.
//   node tests/repack-bottom.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var open = async function (h) {
    await page.goto('about:blank'); await page.goto(base + '#' + h, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    await page.waitForTimeout(2500); if (!(await page.$('#m2-editwin:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(4000);
  };
  var repackAll = async function () {   // the map's right-click menu on empty map space
    var P = await page.evaluate(function () {
      var rs = Array.prototype.map.call(document.querySelectorAll('#m2-img [data-n], #m2-img [data-e]'), function (g) { return g.getBoundingClientRect(); }), v = document.getElementById('m2-view').getBoundingClientRect();
      for (var y = v.top + 40; y < v.bottom - 40; y += 11) for (var x = v.left + 40; x < v.right - 300; x += 11) if (!rs.some(function (r) { return x > r.left - 8 && x < r.right + 8 && y > r.top - 8 && y < r.bottom + 8; })) return [x, y];
      return null;
    });
    await page.keyboard.press('Escape'); await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(400);
    var has = await page.$('.m2-cx button:text-is("Repack all complexes")');
    if (has) { await has.click(); await page.waitForTimeout(3000); }
    return !!has;
  };
  // the complexes in the file: [id, name, box, members [[id, box, is complex]], label box]
  var sbgnCx = function () { return page.evaluate(function () {
    var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml'), kid = function (e, n) { return Array.prototype.filter.call(e.children, function (c) { return c.localName === n; }); };
    var bb = function (e) { var q = kid(e, 'bbox')[0]; return q ? ['x', 'y', 'w', 'h'].map(function (k) { return +q.getAttribute(k); }) : null; };
    return Array.prototype.filter.call(d.getElementsByTagNameNS('*', 'glyph'), function (g) { return g.getAttribute('class') === 'complex'; }).map(function (g) {
      var L = kid(g, 'label')[0];
      return [g.getAttribute('id'), L ? L.getAttribute('text') : '', bb(g), kid(g, 'glyph').filter(function (m) { return !/^(state variable|unit of information)$/.test(m.getAttribute('class')); }).map(function (m) { var top = Math.min.apply(null, [m].concat(kid(m, 'glyph')).map(function (q) { var v = bb(q); return v ? v[1] : Infinity; })); return [m.getAttribute('id'), bb(m), m.getAttribute('class') === 'complex', top]; }), L ? bb(L) : null];
    }); }); };
  var cdCx = function () { return page.evaluate(function () {
    var t = window.m2EditNow().text, out = [], bounds = function (s) { var m = /<celldesigner:bounds x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"/.exec(s); return m.slice(1).map(Number); };
    var al = []; t.replace(/<celldesigner:(speciesAlias|complexSpeciesAlias) (id="([^"]+)"[^>]*)>[\s\S]*?<\/celldesigner:\1>/g, function (s, k, a, id) { var up = /complexSpeciesAlias="([^"]+)"/.exec(a); al.push([id, up ? up[1] : null, bounds(s), k === 'complexSpeciesAlias']); });
    al.filter(function (a) { return a[3]; }).forEach(function (c) { out.push([c[0], '', c[2], al.filter(function (m) { return m[1] === c[0]; }).map(function (m) { return [m[0], m[2], m[3]]; }), null]); });
    return out; }); };
  var drawnBoxes = function (cs) {   // each complex's and member's drawing [x, y, w, h] in map units; a member's box replaced by its drawing
    return page.evaluate(function (cs) {
      var bb = function (id) { var g = document.querySelector('#m2-img [data-n="' + id + '"]'); if (!g) return null; var r = g.getBBox(); return [r.x, r.y, r.width, r.height]; };
      return cs.map(function (c) { return [c[0], c[1], bb(c[0]), c[3].map(function (m) { return [m[0], bb(m[0]), m[2]]; }), c[4], c[2]]; });
    }, cs);
  };
  var bottomGap = function (c) { return c[2][1] + c[2][3] - Math.max.apply(null, c[3].map(function (m) { return m[1][1] + m[1][3]; })); };
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var under = function (c) {   // in the file: for each member complex, the gap from its box to the top of the next member under it
    var out = [];                 // (overlapping it across), a unit of information or state variable on that member's top counted
    c[3].filter(function (m) { return m[2]; }).forEach(function (ic) {
      var below = c[3].filter(function (m) { return m !== ic && m[1][1] >= ic[1][1] + ic[1][3] - 0.5 && m[1][0] < ic[1][0] + ic[1][2] && m[1][0] + m[1][2] > ic[1][0]; });
      if (below.length) out.push([ic[0], r2(Math.min.apply(null, below.map(function (m) { return m[3]; })) - (ic[1][1] + ic[1][3]))]);
    });
    return out;
  };

  // SBGN-ML
  await open('testing-glycolysis-sbgn');
  var t0 = await now();
  ok('testing-glycolysis-sbgn: Repack all complexes in the map\'s menu', await repackAll());
  var cf = (await sbgnCx()).filter(function (c) { return c[3].length; }), cs = await drawnBoxes(cf);
  ok('testing-glycolysis-sbgn: drawn at the file\'s scale', cs.length > 0 && cs.every(function (c) { return Math.abs(c[2][2] - c[5][2]) < 2.5; }), JSON.stringify(cs.map(function (c) { return [c[2], c[5]]; })));
  ok('testing-glycolysis-sbgn: complexes with members found', cs.length >= 3, JSON.stringify(cs.map(function (c) { return c[0]; })));
  cs.forEach(function (c) {
    var g = r2(bottomGap(c));
    if (c[1]) {
      ok('testing-glycolysis-sbgn ' + c[0] + ' (' + c[1] + '): 24 under what its members draw', Math.abs(g - 24) <= 0.6, g);
      ok('testing-glycolysis-sbgn ' + c[0] + ': its label box inside it in the file', !!c[4] && c[4][1] >= c[5][1] - 0.5 && c[4][1] + c[4][3] <= c[5][1] + c[5][3] + 0.5, JSON.stringify([c[5], c[4]]));
    } else console.log('      testing-glycolysis-sbgn ' + c[0] + ' (no name): ' + g + ' under its lowest member');
  });
  cf.forEach(function (c) { under(c).forEach(function (q) { ok('testing-glycolysis-sbgn ' + c[0] + ': the member under the complex ' + q[0] + ' 8 under it in the file (its unit of information\'s top)', Math.abs(q[1] - 8) <= 0.6, q[1]); }); });
  await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(2000);
  ok('testing-glycolysis-sbgn: one undo, the file as it was', (await now()) === t0);

  // CellDesigner
  await open('glycolysis-celldesigner');
  var c0 = await now();
  ok('glycolysis-celldesigner: Repack all complexes in the map\'s menu', await repackAll());
  var cc = await drawnBoxes((await cdCx()).filter(function (c) { return c[3].length; }));
  ok('glycolysis-celldesigner: drawn at the file\'s scale', cc.length > 0 && cc.every(function (c) { return Math.abs(c[2][2] - c[5][2]) < 2.5; }), JSON.stringify(cc.map(function (c) { return [c[2], c[5]]; })));
  ok('glycolysis-celldesigner: complexes with members found', cc.length >= 3, JSON.stringify(cc.map(function (c) { return c[0]; })));
  cc.forEach(function (c) {
    var g = r2(bottomGap(c));
    ok('glycolysis-celldesigner ' + c[0] + ': 20 under what its members draw', Math.abs(g - 20) <= 0.6, g);
  });
  await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(2000);
  ok('glycolysis-celldesigner: one undo, the file as it was', (await now()) === c0);
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
