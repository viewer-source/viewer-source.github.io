// Edit panel Beside list (Settings, Editing): the Edit window in a panel after the list and before the map, 220 px at
// first, its own width kept apart from Right's, its separator on its right edge widening it, dragged far left shutting
// it as the Edit tab does; the list's separator still sets the list alone. Runs on the styles page.
//   node tests/edit-beside.js [address] [--local]
// --local: the working tree's atlas-app.html and look-lines.css (the styles copy) routed into the live page
var { chromium } = require('playwright'), cp = require('child_process'), path = require('path');
var url = process.argv[2] && process.argv[2].indexOf('http') === 0 ? process.argv[2] : 'https://viewer-source.github.io/styles/#glycolysis-sbgn';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
function hunks(file) {
  var d = cp.execFileSync('git', ['diff', '-U2', 'HEAD', '--', file], { cwd: here, maxBuffer: 1 << 26 }).toString(), out = [];
  d.split(/\n(?=@@ )/).slice(1).forEach(function (h) {
    var o = [], n = [];
    h.split('\n').slice(1).forEach(function (l) { if (l[0] === ' ') { o.push(l.slice(1)); n.push(l.slice(1)); } else if (l[0] === '-') o.push(l.slice(1)); else if (l[0] === '+') n.push(l.slice(1)); });
    out.push([o.join('\n'), n.join('\n')]);
  });
  return out;
}
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1500, height: 900 } }), bad = 0, errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  if (local) {
    var route = async function (match, hs, type) {
      await page.route(match, async function (r) {
        var res = await r.fetch(), t = await res.text(), miss = [];
        hs.forEach(function (h, i) { if (t.indexOf(h[0]) < 0) miss.push(i); else t = t.replace(h[0], function () { return h[1]; }); });
        if (miss.length) console.log('WRONG changes ' + miss.join(', ') + ' of ' + hs.length + ' did not apply to ' + r.request().url());
        r.fulfill({ response: res, body: t, headers: Object.assign({}, res.headers(), { 'content-type': type }) });
      });
    };
    var btn = '<button type="button" data-eside="right" title="The Edit window on the right, the list kept on the left">Right</button>';
    var page_hs = hunks('../styles/_includes/atlas-app.html').filter(function (h) { return h[0].indexOf('{%') < 0; });   // Liquid: the page has it rendered
    page_hs.push([btn, require('fs').readFileSync(path.join(here, '../styles/_includes/atlas-app.html'), 'utf8').match(/<button type="button" data-eside="right"[^]*?data-eside="beside"[^>]*>[^<]*<\/button>/)[0]]);
    await route(function (u) { return u.href.split('#')[0] === url.split('#')[0]; }, page_hs, 'text/html; charset=utf-8');
    await route(/\/styles\/styles\/default-edit\.css/, hunks('../styles/_includes/look-lines.css'), 'text/css');
  }
  await page.addInitScript(function () { if (!sessionStorage.getItem('t')) { sessionStorage.setItem('t', 1); localStorage.clear(); localStorage.setItem('atlas-edit-side', 'beside'); } });
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('#m2-view svg', { timeout: 30000 });
  ok('Settings shows three choices', await page.locator('#m2-set-eside button').count() === 3);
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-epanel #m2-editwin .m2-ed-palette button', { timeout: 20000 });
  await page.waitForTimeout(400);
  var r = async function () { return page.evaluate(function () {
    var q = function (s) { var e = document.querySelector(s); return e && e.offsetParent !== null ? e.getBoundingClientRect() : null; };
    var k = document.getElementById('m2-view').currentCSSZoom || 1, o = { nav: q('.m2-nav'), ep: q('#m2-epanel'), main: q('.m2-main'), sep: q('#m2-split-e'), ls: q('#m2-split'), docW: document.documentElement.scrollWidth, winW: innerWidth, k: k };
    ['nav', 'ep', 'main'].forEach(function (n) { if (o[n]) o[n] = { left: o[n].left, right: o[n].right, top: o[n].top, width: o[n].width / k }; });
    return o;
  }); };
  var a = await r();
  ok('list, panel, map from left to right', a.nav && a.ep && a.main && a.nav.right <= a.ep.left + 1 && a.ep.right <= a.main.left + 1, JSON.stringify([a.nav && a.nav.right, a.ep && [a.ep.left, a.ep.right], a.main && a.main.left]));
  ok('panel 220 px at first', a.ep && Math.round(a.ep.width) === 220, a.ep && a.ep.width);
  ok('no sideways scroll', a.docW <= a.winW, a.docW + ' ' + a.winW);
  ok('separator on the panel\'s right edge', a.sep && Math.abs((a.sep.left + a.sep.right) / 2 - a.ep.right) < 20, a.sep && JSON.stringify([a.sep.left, a.sep.right, a.ep.right]));
  await page.screenshot({ path: process.env.SHOT || '/tmp/beside.png' });
  // widen the panel by its separator
  var x = (a.sep.left + a.sep.right) / 2, y = a.sep.top + 200;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 30, y, { steps: 3 }); await page.mouse.move(x + 60, y, { steps: 3 }); await page.mouse.up();
  await page.waitForTimeout(200);
  var c = await r();
  var want = Math.round(220 + 60 / a.k);
  ok('dragged right, the panel wider by the drag', c.ep && Math.abs(c.ep.width - want) < 3, c.ep && c.ep.width + ' ' + want);
  ok('the list kept its width', Math.abs(c.nav.width - a.nav.width) < 1);
  ok('width kept apart from Right\'s', await page.evaluate(function (w) { return Math.abs(localStorage.getItem('atlas-edit-width-beside:' + location.pathname) - w) < 3 && !localStorage.getItem('atlas-edit-width:' + location.pathname); }, want));
  // the list's separator: the list alone
  ok('list separator on the list\'s edge', c.ls && Math.abs((c.ls.left + c.ls.right) / 2 - c.nav.right) < 6, c.ls && JSON.stringify([c.ls.left, c.ls.right, c.nav.right]));
  var ls = { x: (c.ls.left + c.ls.right) / 2, y: c.ls.top + 200 };
  await page.mouse.move(ls.x, ls.y); await page.mouse.down(); await page.mouse.move(ls.x - 20, ls.y, { steps: 3 }); await page.mouse.move(ls.x - 30, ls.y, { steps: 3 }); await page.mouse.up();
  await page.waitForTimeout(200);
  var d = await r();
  ok('list separator: list narrower, panel unchanged', d.nav.width < c.nav.width - 20 && Math.abs(d.ep.width - c.ep.width) < 1, d.nav.width + ' ' + d.ep.width);
  // drag the panel's separator far left: shut
  var s2 = d.sep, x2 = (s2.left + s2.right) / 2;
  await page.mouse.move(x2, y); await page.mouse.down(); await page.mouse.move(x2 - 100, y, { steps: 4 }); await page.mouse.move(x2 - 220, y, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(300);
  var e = await r();
  ok('dragged far left: panel shut, editing ended', !e.ep && await page.evaluate(function () { return !document.querySelector('.m2').classList.contains('m2-win-edit'); }));
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(500);
  var f = await r();
  ok('Edit tab opens it again at its kept width', f.ep && Math.abs(f.ep.width - want) < 3, f.ep && f.ep.width);
  // choosing Right moves it after the map with Right's own width
  await page.evaluate(function () { localStorage.setItem('atlas-edit-side', 'right'); });
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(200);
  var rb = page.locator('#m2-set-eside button[data-eside="right"]');
  if (await rb.isVisible()) {
    await page.evaluate(function () { localStorage.setItem('atlas-edit-side', 'beside'); });
    await rb.click(); await page.waitForTimeout(300);
    var g = await r();
    ok('Right: panel after the map, 240 px', g.ep && g.ep.left >= g.main.right - 1 && Math.round(g.ep.width) === 240, g.ep && JSON.stringify([g.ep.left, g.main.right, g.ep.width]));
  } else ok('Settings shows Edit panel', false);
  ok('no page errors', !errs.length, errs.join(' | '));
  await b.close(); console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
