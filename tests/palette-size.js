// The palette's one size (atlas-app.html; no Normal size): tools and palette 32 px tiles, six in a row,
// the tools' drawings 21 px, the palette's 24; no lines between the tools; the palette and the window's blocks as wide
// as the icon row above at the usual 240 px panel, the palette's outlines 1.2 px on screen, the tools' 1.4 as the top
// icons, the small arrows 1.2; no Sign size left in Settings; a panel narrower than the usual one wraps the signs and
// nothing passes its edge. Testing Glycolysis SBGN-ML, full editing. No script error.
//   node tests/palette-size.js [address]
var engine = require('playwright')[process.env.BROWSER || 'chromium'];   // BROWSER=webkit or firefox: the same test in another engine
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#testing-glycolysis-sbgn';
(async function () {
  var b = await engine.launch(), bad = 0, errs = [];
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  async function open(page, listW) {
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(function (w) { localStorage.setItem('atlas-edit-level', 'full'); localStorage.removeItem('atlas-edit-side'); if (w) localStorage.setItem('atlas-list-width:' + location.pathname, String(w)); else localStorage.removeItem('atlas-list-width:' + location.pathname); }, listW || 0);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  }
  async function edit(page) {
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="submap"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1200);
  }
  function measure(page) {
    return page.evaluate(function () {
      var vis = function (s) { return [].filter.call(document.querySelectorAll(s), function (e) { return e.offsetParent; }); };
      var span = function (els) { var r = els.map(function (e) { return e.getBoundingClientRect(); }); return [Math.min.apply(0, r.map(function (x) { return x.left; })), Math.max.apply(0, r.map(function (x) { return x.right; }))].map(Math.round); };
      var pal = vis('#m2-editwin .m2-ed-palette button[data-make]'), tools = vis('#m2-editwin .m2-ed-tools > button'), rows = {};
      pal.forEach(function (e) { var k = Math.round(e.getBoundingClientRect().top); rows[k] = (rows[k] || 0) + 1; });
      var panel = document.getElementById('m2-editwin').parentElement.getBoundingClientRect();
      return { pal: span(pal), rail: span(vis('.m2-ri')), line: span([document.querySelector('#m2-editwin > .m2-ed-palette')]), box: Math.round(pal[0].getBoundingClientRect().width), draw: Math.round(pal[0].querySelector('svg').getBoundingClientRect().width), tool: Math.round(tools[0].getBoundingClientRect().width), tdraw: Math.round(tools[0].querySelector('svg').getBoundingClientRect().width), seps: document.querySelectorAll('#m2-editwin .m2-ed-tools .m2-ed-sep').length,
        weights: [].concat(pal.slice(0, 1), tools.slice(0, 1)).map(function (b) { var v = b.querySelector('svg'), k = v.getBoundingClientRect().width / v.viewBox.baseVal.width; return parseFloat(getComputedStyle(v.querySelector('rect, path')).strokeWidth) * k; }).concat(vis('#m2-editwin .m2-ed-gsf svg path').map(function (e) { return parseFloat(getComputedStyle(e).strokeWidth); })),
        rows: Object.keys(rows).sort(function (a, b) { return a - b; }).map(function (k) { return rows[k]; }), panelR: Math.round(panel.right), z: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1 };
    });
  }
  var page = await ctx.newPage(); page.on('pageerror', function (e) { errs.push(e.message); });
  await page.evaluate(function () {}).catch(function () {});
  await open(page); await page.evaluate(function () { localStorage.setItem('atlas-sign-size', 'normal'); }); await open(page); await edit(page);   // an old Normal choice left in a browser changes nothing
  var L = await measure(page), z = L.z, px = function (v) { return Math.round(v / z); };
  ok('tiles 32 px, tools and palette', px(L.box) === 32 && px(L.tool) === 32, JSON.stringify(L));
  ok('palette drawings 24 px, tools 21', px(L.draw) === 24 && px(L.tdraw) === 21, JSON.stringify(L));
  ok('no lines between the tools', L.seps === 0, JSON.stringify(L));
  ok('the palette as wide as the icon row', Math.abs(L.pal[0] - L.rail[0]) <= 1 && Math.abs(L.pal[1] - L.rail[1]) <= 1, JSON.stringify(L));
  ok('six in a row', L.rows[0] === 6, JSON.stringify(L.rows));
  ok('palette 1.2 px, tools 1.4, the arrow 1.2', L.weights.every(function (w, i) { return Math.abs(w / z - (i === 1 ? 1.4 : 1.2)) < .03; }), JSON.stringify(L.weights));
  ok('the lines as wide as the icon row', Math.abs(L.line[0] - L.rail[0]) <= 1 && Math.abs(L.line[1] - L.rail[1]) <= 1, JSON.stringify(L));
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(400);
  ok('no Sign size in Settings', !(await page.$('#m2-set-signs')) && !(await page.evaluate(function () { return /Sign size/.test(document.getElementById('m2-setwin').textContent); })));
  await page.evaluate(function () { localStorage.removeItem('atlas-sign-size'); });
  // a narrower panel: the signs wrap, nothing passes its edge
  var p2 = await ctx.newPage(); p2.on('pageerror', function (e) { errs.push(e.message); });
  await open(p2, 200); await edit(p2);
  var W = await measure(p2);
  ok('narrower panel: the signs wrap within it', W.pal[1] <= W.panelR && W.rows[0] < L.rows[0], JSON.stringify(W));
  await open(p2, 0);
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  process.exit(bad ? 1 : 0);
})();
