// Sign size (Settings, Editing; atlas-app.html setSigns): Large by default, the tools and the palette's signs 36 px with
// 24 px drawings, five in a row; Normal 32 px signs with 21 px drawings, six in a row; at either size the palette and the
// window's blocks as wide as the icon row above at the usual 240 px panel, the palette's outlines 1.2 px on screen, the
// tools' 1.4 as the top icons, the small arrows 1.2; one undo puts Large back; the choice stays after a reload; a panel narrower than the usual one wraps the signs
// and nothing passes its edge. Testing Glycolysis SBGN-ML, full editing. No script error.
//   node tests/sign-size.js [address]
var { chromium } = require('playwright');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#testing-glycolysis-sbgn';
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
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
      return { pal: span(pal), rail: span(vis('.m2-ri')), line: span([document.querySelector('#m2-editwin > .m2-ed-palette')]), box: Math.round(pal[0].getBoundingClientRect().width), draw: Math.round(pal[0].querySelector('svg').getBoundingClientRect().width), tool: Math.round(tools[0].getBoundingClientRect().width),
        weights: [].concat(pal.slice(0, 1), tools.slice(0, 1)).map(function (b) { var v = b.querySelector('svg'), k = v.getBoundingClientRect().width / v.viewBox.baseVal.width; return parseFloat(getComputedStyle(v.querySelector('rect, path')).strokeWidth) * k; }).concat(vis('#m2-editwin .m2-ed-gsf svg path').map(function (e) { return parseFloat(getComputedStyle(e).strokeWidth); })),
        rows: Object.keys(rows).sort(function (a, b) { return a - b; }).map(function (k) { return rows[k]; }), panelR: Math.round(panel.right), z: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1 };
    });
  }
  var page = await ctx.newPage(); page.on('pageerror', function (e) { errs.push(e.message); });
  await page.evaluate(function () {}).catch(function () {});
  await open(page); await page.evaluate(function () { localStorage.removeItem('atlas-sign-size'); }); await open(page); await edit(page);
  var L = await measure(page), z = L.z, px = function (v) { return Math.round(v / z); };
  ok('Large by default: signs 36 px', px(L.box) === 36 && px(L.tool) === 36, JSON.stringify(L));
  ok('Large: drawings 24 px', px(L.draw) === 24, JSON.stringify(L));
  ok('Large: the palette as wide as the icon row', Math.abs(L.pal[0] - L.rail[0]) <= 1 && Math.abs(L.pal[1] - L.rail[1]) <= 1, JSON.stringify(L));
  ok('Large: five in a row', L.rows[0] === 5, JSON.stringify(L.rows));
  ok('Large: palette 1.2 px, tools 1.4, the arrow 1.2', L.weights.every(function (w, i) { return Math.abs(w / z - (i === 1 ? 1.4 : 1.2)) < .03; }), JSON.stringify(L.weights));
  ok('Large: the lines as wide as the icon row', Math.abs(L.line[0] - L.rail[0]) <= 1 && Math.abs(L.line[1] - L.rail[1]) <= 1, JSON.stringify(L));
  // Normal, chosen in Settings
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(400);
  ok('Sign size in Settings, Large on', await page.isVisible('#m2-set-signs button[data-signs="normal"]') && await page.$eval('#m2-set-signs button[data-signs="large"]', function (e) { return e.classList.contains('m2-on'); }));
  await page.click('#m2-set-signs button[data-signs="normal"]'); await page.waitForTimeout(300);
  ok('Normal on after its click', await page.$eval('#m2-set-signs button[data-signs="normal"]', function (e) { return e.classList.contains('m2-on'); }));
  await edit(page);
  var N = await measure(page);
  ok('Normal: signs 32 px, drawings 21 px', px(N.box) === 32 && px(N.tool) === 32 && px(N.draw) === 21, JSON.stringify(N));
  ok('Normal: six in a row', N.rows[0] === 6, JSON.stringify(N.rows));
  ok('Normal: the palette as wide as the icon row', Math.abs(N.pal[0] - N.rail[0]) <= 1 && Math.abs(N.pal[1] - N.rail[1]) <= 1, JSON.stringify(N));
  ok('Normal: palette 1.2 px, tools 1.4, the arrow 1.2', N.weights.every(function (w, i) { return Math.abs(w / z - (i === 1 ? 1.4 : 1.2)) < .03; }), JSON.stringify(N.weights));
  // kept after a reload
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  ok('Normal kept after a reload', await page.evaluate(function () { return document.documentElement.classList.contains('m2-signs-normal'); }));
  // one undo puts Large back
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(300);
  await page.click('#m2-set-signs button[data-signs="large"]'); await page.click('#m2-set-signs button[data-signs="normal"]'); await page.waitForTimeout(200);
  await page.mouse.click(700, 450); await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  var und = await page.evaluate(function () { return !document.documentElement.classList.contains('m2-signs-normal') && localStorage.getItem('atlas-sign-size') === null; });
  if (!und) { await page.keyboard.press('Control+z'); await page.waitForTimeout(300); und = await page.evaluate(function () { return !document.documentElement.classList.contains('m2-signs-normal'); }); }
  ok('one undo puts Large back', und);
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
