// The page's zoom as each engine reports it, and whether a click on a node where it is drawn selects that node: the
// pointer's place is turned into the map's by the map window's box and the zoom (core.js at, the page's pz), so an
// engine that reports the box or the zoom in other units than the pointer selects the wrong place. On the styles page,
// Glycolysis (GraphML), edit mode. Prints the numbers; fails when a click on a node's drawn centre selects another or
// none, or when the zoom an element reports differs from the one its boxes show.
//   node tests/zoom-probe.js [base address]      BROWSER=webkit or firefox: the same in another engine
var engine = require('playwright')[process.env.BROWSER || 'chromium'];
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
(async function () {
  var b = await engine.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-level', 'full'); });
  await page.goto(base + '#' + (process.env.MAP || 'glycolysis-graphml'), { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(1500);
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  var z = await page.evaluate(function () {
    var v = document.getElementById('m2-view') || document.querySelector('#m2-img').parentElement, d = document.documentElement, r = v.getBoundingClientRect();
    return { currentCSSZoom: v.currentCSSZoom, boxes: +(r.width / v.offsetWidth).toFixed(4), page: +(d.getBoundingClientRect().width / d.clientWidth).toFixed(4),
      bodyZoom: getComputedStyle(document.body).zoom, htmlZoom: getComputedStyle(d).zoom, innerWidth: innerWidth, dpr: devicePixelRatio, view: v.id || v.className };
  });
  console.log('zoom  ' + JSON.stringify(z));
  ok('the zoom an element reports is the one its boxes show', z.currentCSSZoom == null || Math.abs(z.currentCSSZoom - z.boxes) < 0.01, z.currentCSSZoom + ' against ' + z.boxes);
  var nodes = await page.$$eval('#m2-img [data-n]', function (l) {
    return l.map(function (g) { var r = g.getBoundingClientRect(); return [g.dataset.n, r.left + r.width / 2, r.top + r.height / 2, r.width]; })
      .filter(function (n) { return n[3] > 20 && n[3] < 200 && n[1] > 400 && n[1] < 1300 && n[2] > 150 && n[2] < 850; }).slice(0, 4);
  });
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    var under = await page.evaluate(function (p) { var g = document.elementsFromPoint(p[0], p[1]).map(function (h) { return h.closest && h.closest('#m2-img [data-n]'); }).filter(Boolean)[0]; return g ? g.dataset.n : 'no node'; }, [n[1], n[2]]);
    await page.mouse.click(n[1], n[2]); await page.waitForTimeout(400);
    var sel = await page.evaluate(function (p) {   // the selection's handles: one node selected, its handles round the click
      var hs = Array.from(document.querySelectorAll('#m2-edit-layer .m2-ed-handle')).map(function (h) { return h.getBoundingClientRect(); });
      if (!hs.length) return 'nothing selected';
      var L = Math.min.apply(null, hs.map(function (r) { return r.left; })), R = Math.max.apply(null, hs.map(function (r) { return r.right; }));
      var T = Math.min.apply(null, hs.map(function (r) { return r.top; })), B = Math.max.apply(null, hs.map(function (r) { return r.bottom; }));
      return (L <= p[0] && p[0] <= R && T <= p[1] && p[1] <= B ? 'round it' : 'elsewhere') + ' (handles ' + [L, T, R, B].map(Math.round).join(',') + ')';
    }, [n[1], n[2]]);
    ok('a click on ' + n[0] + "'s drawn centre selects it", /^round it/.test(sel), 'at ' + Math.round(n[1]) + ',' + Math.round(n[2]) + ', under it ' + under + ', ' + sel);
  }
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
})();
