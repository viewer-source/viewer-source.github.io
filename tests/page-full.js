// The full screen sign in the icon column, before the ?: the whole page full screen with the list, tools and panel,
// the site's top bar gone and the map window down to the screen's bottom; a second click or Esc back, the bar again.
//   node tests/page-full.js [page address] [--local]
// --local: the live page with the change not yet released applied to its text, to check before a release.
var { chromium } = require('playwright');
var URL0 = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/#glycolysis-sbgn';
var local = process.argv.indexOf('--local') > 0;
var LOCAL = [
  ['pageSign.innerHTML = on ? EXIT_ICON : FULL_ICON;', "pageSign.innerHTML = (on ? EXIT_ICON : FULL_ICON).replace('<svg ', '<svg fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" ');"]
];
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (v || more === undefined ? '' : ' (' + more + ')')); };
  var page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', function (e) { errs.push(e.message); });
  if (local) await page.route(function (u) { return u.pathname === '/' || u.pathname.endsWith('/index.html'); }, async function (route) {
    var r = await route.fetch(), t = await r.text();
    LOCAL.forEach(function (x) { if (t.indexOf(x[0]) < 0) errs.push('local: not found ' + x[0].slice(0, 50)); t = t.replace(x[0], x[1]); });
    route.fulfill({ response: r, body: t });
  });
  await page.goto(URL0, { waitUntil: 'load' });
  await page.waitForFunction(function () { var i = document.getElementById('m2-img'); return i && i.style.width; }, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  var sign = '#m2-rail .m2-ri[data-win="full"]';
  var at = function () { return page.evaluate(function (s) {
    var m = document.querySelector('.wrapper-masthead'), v = document.getElementById('m2-view').getBoundingClientRect(), g = document.querySelector(s);
    return { fs: document.fullscreenElement === document.documentElement, bar: m ? m.getBoundingClientRect().height : -1, top: v.top, bottom: v.bottom, h: innerHeight, title: g && g.title, list: !!document.querySelector('.m2-nav').offsetWidth };
  }, sign); };
  ok('the sign is shown, last of the icons', await page.evaluate(function (s) { var f = document.querySelector(s); return !!(f && f.offsetParent && f.querySelector('svg') && !f.nextElementSibling); }, sign));
  ok('drawn as its neighbours: the same colour, line width and no fill as Settings', await page.evaluate(function (s) {
    var st = function (q) { var p = document.querySelector(q + ' svg path') || document.querySelector(q + ' svg circle'), c = getComputedStyle(p); return [c.stroke, c.strokeWidth, c.fill === 'none' || c.fill === 'rgba(0, 0, 0, 0)' ? 'none' : c.fill].join(); };
    return st(s) === st('#m2-rail .m2-ri[data-win="set"]');
  }, sign));
  var a = await at();
  ok('before: the top bar is there', a.bar > 20 && !a.fs, JSON.stringify(a));
  await page.click(sign); await page.waitForTimeout(800);
  a = await at();
  ok('a click: the whole page full screen', a.fs);
  ok('the top bar is gone', a.bar === 0, a.bar);
  ok('the map window starts at the top and takes the screen\'s height, less the download row', a.top < 2 && a.bottom > a.h - 80, JSON.stringify(a));
  ok('the list and tools stay', a.list);
  ok('the sign says how to leave', a.title === 'Exit full screen (Esc)', a.title);
  await page.click(sign); await page.waitForTimeout(800);
  a = await at();
  ok('a second click: back, the top bar again', !a.fs && a.bar > 20, JSON.stringify(a));
  ok('the sign back to Full screen with tools', a.title === 'Full screen with tools', a.title);
  ok('the map window under the top bar again', a.top >= a.bar - 1, JSON.stringify(a));
  ok('the ? key still opens Gestures and keys', await page.evaluate(function () { document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })); var t = document.getElementById('m2-tips'); return !!(t && !t.hidden); }));
  ok('no page errors', !errs.length); if (errs.length) console.log(errs.join('\n'));
  await b.close(); console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
