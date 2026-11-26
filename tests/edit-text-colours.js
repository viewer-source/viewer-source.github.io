// The Edit window's text in two colours on every format (atlas-app.html, --m2-ed-name and --m2-ed-value): names,
// headings and tick boxes' labels in the palette, the map's choices, Properties and Grid size #5f6368; a value in a
// field or a dropdown #202124; every tick box there 12 px with the same grey tick. SBGN-ML, CellDesigner and GraphML,
// a node selected so Properties shows (GraphML has no palette here). No script error.
//   node tests/edit-text-colours.js [site address, ending in /styles/]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  for (var m of ['glycolysis-sbgn', 'acly-celldesigner', 'glycogen-muscle-graphml']) {
    var page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    page.on('pageerror', function (e) { errs.push(e.message); });
    await page.goto(base + '#' + m, { waitUntil: 'load' });
    await page.evaluate(function () { localStorage.setItem('atlas-edit-level', 'full'); }); await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$('#m2-ed-gsize:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-ed-gsize', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2500);
    var P = await page.$eval('#m2-img [data-n]', function (g) { var r = g.getBoundingClientRect(); return [r.left + 4, r.top + 4]; });
    await page.mouse.click(P[0], P[1]); await page.waitForTimeout(800);
    var r = await page.evaluate(function () {
      var names = {}, values = {}, ticks = {}, props = 0, z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--zoom')) || 1;
      document.querySelectorAll('#m2-editwin .m2-ed-palette *, #m2-editwin .m2-ed-pmap *, #m2-editwin .m2-ed-props *, #m2-editwin .m2-ed-gsize *').forEach(function (e) {
        if (!e.offsetParent || e.closest('svg')) return;
        var cs = getComputedStyle(e);
        if (e.closest('.m2-ed-props')) props++;
        if (e.tagName === 'INPUT' && e.type === 'checkbox') { var k = Math.round(e.getBoundingClientRect().width / z) + 'px ' + cs.accentColor; (ticks[k] = ticks[k] || []).push(e.id || e.className); return; }
        if (e.tagName === 'SELECT' || (e.tagName === 'INPUT' && /^(text|number)$/.test(e.type) && !e.disabled) || (e.tagName === 'SPAN' && e.closest('.m2-ed-pdd'))) { (values[cs.color] = values[cs.color] || []).push(e.id || e.className || e.tagName); return; }
        var own = [].some.call(e.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
        if (own && !(e.tagName === 'BUTTON' && e.matches('.m2-ed-pdef, .m2-ed-pall, .m2-ed-pstd, .m2-ed-ppic button')) && !e.closest('button.m2-ed-pinfo')) { var t = [].map.call(e.childNodes, function (n) { return n.nodeType === 3 ? n.textContent.trim() : ''; }).join('').slice(0, 20); (names[cs.color] = names[cs.color] || []).push(t); }
      });
      return { names: names, values: values, ticks: ticks, props: props };
    });
    if (!/graphml/.test(m)) ok(m + ': Properties shown', r.props > 0);
    ok(m + ': names one grey', Object.keys(r.names).join() === 'rgb(95, 99, 104)', JSON.stringify(r.names));
    ok(m + ': values one colour', Object.keys(r.values).join() === 'rgb(32, 33, 36)', JSON.stringify(r.values));
    ok(m + ': tick boxes one size and tick', Object.keys(r.ticks).length <= 1 && Object.keys(r.ticks).every(function (k) { return k === '12px rgb(112, 117, 122)'; }), JSON.stringify(r.ticks));
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
