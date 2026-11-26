// Themes (Settings, Display, Theme; notes/themes.md): Default keeps the look's own colours; Linen gives the accent
// #71777c and the panels beside the map #f5f4f1, while the map window, fields, buttons and what floats over the page
// stay white. Tests from the design: the choice offered, the colours in both themes, no accent blue left in Linen, the
// light square of a palette sign seen against the panel, the choice kept over a reload and set before the page is
// painted, undo and redo of it, the right-click menu white, the SVG download the same in both themes.
//   node tests/themes.js [base address] [--local] --data=<clone of the data repository>   (default: the styles page; --local routes the working tree's viewer in)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process'), OM = require('./lib/open-map.js');
var base = process.argv.slice(2).filter(function (a) { return a[0] !== '-'; })[0] || 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
var MAP = 'testing-glycolysis-sbgn',   // from the test set: its address in this browser given by OM.resolve
    SVGMAP = 'colour-glycolysis-sbgn',   // a site SBGN-ML map, for the SVG download
    BLUE = 'rgb(65, 131, 196)', GREY = 'rgb(113, 119, 124)', LINEN = 'rgb(245, 244, 241)', WHITE = 'rgb(255, 255, 255)';
function viewerHunks() {   // [old, new] pieces of the styles copy of the viewer changed since HEAD
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '../styles/_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString(), out = [];
  d.split(/\n(?=@@ )/).slice(1).forEach(function (h) {
    var o = [], n = [];
    h.split('\n').slice(1).forEach(function (l) { if (l[0] === ' ') { o.push(l.slice(1)); n.push(l.slice(1)); } else if (l[0] === '-') o.push(l.slice(1)); else if (l[0] === '+') n.push(l.slice(1)); });
    out.push([o.join('\n'), n.join('\n')]);
  });
  return out;
}
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }), page = await ctx.newPage();
  var errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  if (local) {
    var hunks = viewerHunks();
    if (!hunks.length) { console.log('--local: no change against ' + (process.env.REV || 'HEAD') + ' to route in (set REV to the commit live now)'); process.exit(2); }
    await page.route(function (u) { return u.href.split('#')[0].split('?')[0] === base; }, async function (r) {
      var res = await r.fetch(), t = await res.text(), miss = 0;
      hunks.forEach(function (h) {
        if (t.indexOf(h[0]) >= 0) { t = t.replace(h[0], function () { return h[1]; }); return; }
        // a line with Liquid ({{ }}, {% %}, an {% if %} block): what Jekyll made of each taken as it is on the page
        var blk = /\{% if [\s\S]*?\{% endif %\}|\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g, esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
        var re = new RegExp(h[0].split(blk).map(esc).join('([\\s\\S]*?)')), m = t.match(re);
        if (!m) { miss++; return; }
        var i = 0; t = t.replace(re, function () { return h[1].replace(blk, function () { return m[++i]; }); });
      });
      if (miss) console.log('WRONG the viewer\'s changes did not apply to the page (' + miss + ' of ' + hunks.length + ')');
      r.fulfill({ response: res, body: t, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) });
    });
  }
  await page.addInitScript(function () {   // the theme as the viewer's first element is put in the page
    new MutationObserver(function (m, o) { if (document.querySelector('.m2')) { window.__th0 = document.documentElement.getAttribute('data-theme'); o.disconnect(); } }).observe(document, { childList: true, subtree: true });
  });
  var settle = async function () { await page.waitForSelector('.m2-ri[data-win="set"]', { timeout: 30000 }); await page.waitForTimeout(2500); };
  var openSet = async function () { if (!(await page.$eval('#m2-set-theme', function (x) { return !!x.offsetParent; }))) { await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(600); } };
  var bg = function (sel) { return page.$eval(sel, function (e) { return getComputedStyle(e).backgroundColor; }); };
  var theme = function () { return page.evaluate(function () { return document.documentElement.getAttribute('data-theme'); }); };
  var chosenBg = function () { return page.evaluate(function () { var e = document.querySelector('.m2-item.m2-on'); return e && getComputedStyle(e).backgroundColor; }); };
  var svg = async function () {   // the SVG download is offered for a site map only (a map added from a file has none): read on SVGMAP, then back to MAP
    await OM.byAddress(page, base, SVGMAP); await page.waitForTimeout(2500);
    var dl = page.waitForEvent('download', { timeout: 15000 }).catch(function () { return null; });
    await page.click('.m2-ri[data-win="dl"]'); await page.waitForTimeout(600);
    await page.evaluate(function () { var a = [].slice.call(document.querySelectorAll('#m2-dlwin a[download], #m2-downloads a[download]')).filter(function (x) { return /\.svg(\?|$)/.test(x.getAttribute('href')) && x.offsetParent; })[0]; if (a) a.click(); });
    var d = await dl, t = d ? fs.readFileSync(await d.path(), 'utf8') : null;
    await OM.byAddress(page, base, MAP); await page.waitForTimeout(2500);
    return t;
  };
  var blues = function () {   // elements of the page (not the map) showing the accent blue as fill, edge or text
    return page.evaluate(function (B) {
      return [].slice.call(document.querySelectorAll('body *')).filter(function (e) {
        if (e.closest('#m2-view svg, #m2-img, #m2-edit-layer')) return false;
        var s = getComputedStyle(e); return [s.backgroundColor, s.borderTopColor, s.color, s.fill, s.accentColor].indexOf(B) >= 0 && e.offsetParent;
      }).map(function (e) { return e.tagName + '.' + e.className; });
    }, BLUE);
  };

  await page.goto(base, { waitUntil: 'load' }); await page.evaluate(function () { localStorage.clear(); });
  MAP = await OM.resolve(page, base, MAP);   // after the storage is cleared
  await OM.byAddress(page, base, MAP); await settle(); await openSet();
  console.log('-- Default');
  var opts = await page.$$eval('#m2-set-theme option', function (os) { return os.map(function (o) { return o.textContent; }); });
  ok('Settings, Display: Theme, a drop-down with Default, Linen and Grey', opts.join() === 'Default,Linen,Grey', opts.join());
  ok('Default chosen, no theme on the page', (await page.$eval('#m2-set-theme', function (s) { return s.value; })) === 'default' && (await theme()) === null);
  ok('Default: the chosen map in the accent blue', (await chosenBg()) === BLUE, await chosenBg());
  ok('Default: the list\'s column the page\'s own white', ['rgba(0, 0, 0, 0)', WHITE].indexOf(await bg('.m2-nav')) >= 0, await bg('.m2-nav'));
  var svgD = await svg();

  console.log('-- Linen');
  await openSet(); await page.selectOption('#m2-set-theme', 'linen'); await page.waitForTimeout(400);
  ok('Linen chosen: kept in the browser', (await theme()) === 'linen' && (await page.evaluate(function () { return localStorage.getItem('atlas-theme'); })) === 'linen');
  ok('the chosen map in grey #71777c', (await chosenBg()) === GREY, await chosenBg());
  ok('the list\'s column linen', (await bg('.m2-nav')) === LINEN, await bg('.m2-nav'));
  ok('the map window white', (await bg('#m2-view')) === WHITE, await bg('#m2-view'));
  ok('the annotation panel beside the map linen', (await bg('.m2-info')) === LINEN, await bg('.m2-info'));
  ok('the Theme drop-down white on the linen', (await bg('#m2-set-theme')) === WHITE, await bg('#m2-set-theme'));
  var bl = await blues();
  ok('no accent blue left outside the map', bl.length === 0, bl.slice(0, 5).join(' '));
  await page.click('.m2-ri[data-win="maps"]').catch(function () {}); await page.waitForTimeout(300);
  await page.click('.m2-ri[data-win="search"]').catch(function () {}); await page.waitForTimeout(400);
  ok('the search field white', (await bg('#m2-search')) === WHITE, await bg('#m2-search'));
  await page.click('.m2-ri[data-win="search"]').catch(function () {}); await page.waitForTimeout(300);
  var box = await page.$eval('#m2-view', function (e) { var r = e.getBoundingClientRect(); return { x: r.x + r.width - 60, y: r.y + r.height - 60 }; });
  await page.mouse.click(box.x, box.y, { button: 'right' }); await page.waitForTimeout(400);
  var cx = await page.evaluate(function () { var m = [].slice.call(document.querySelectorAll('.m2-cx')).filter(function (e) { return e.offsetParent || getComputedStyle(e).display !== 'none'; })[0]; return m ? getComputedStyle(m).backgroundColor : null; });
  ok('the right-click menu white', cx === WHITE, cx);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  var svgL = await svg();
  ok('Download SVG the same file in both themes', svgD && svgL && svgD === svgL, svgD ? svgD.length + ' and ' + (svgL || '').length + ' characters' : 'no download');

  console.log('-- Grey');
  await openSet(); await page.selectOption('#m2-set-theme', 'grey'); await page.waitForTimeout(400);
  ok('Grey: the chosen map in grey #71777c', (await theme()) === 'grey' && (await chosenBg()) === GREY, await chosenBg());
  ok('Grey: the panels white', ['rgba(0, 0, 0, 0)', WHITE].indexOf(await bg('.m2-nav')) >= 0 && ['rgba(0, 0, 0, 0)', WHITE].indexOf(await bg('.m2-info')) >= 0, await bg('.m2-nav'));
  var blG = await blues();
  ok('Grey: no accent blue left outside the map', blG.length === 0, blG.slice(0, 5).join(' '));
  await page.selectOption('#m2-set-theme', 'linen'); await page.waitForTimeout(300);

  console.log('-- reload, undo, redo');
  await page.reload({ waitUntil: 'load' }); await settle();
  ok('a reload keeps Linen', (await theme()) === 'linen' && (await bg('.m2-nav')) === LINEN);
  ok('Linen set before the viewer is in the page', (await page.evaluate(function () { return window.__th0; })) === 'linen');
  await openSet(); await page.selectOption('#m2-set-theme', 'default'); await page.waitForTimeout(300);
  ok('Default again: the blue back', (await chosenBg()) === BLUE && (await theme()) === null && (await page.evaluate(function () { return localStorage.getItem('atlas-theme'); })) === null);
  await page.mouse.click(5, 880); await page.keyboard.press('Control+KeyZ'); await page.waitForTimeout(400);
  ok('Cmd+Z: Linen back, the drop-down with it', (await theme()) === 'linen' && (await page.$eval('#m2-set-theme', function (s) { return s.value; })) === 'linen');
  await page.keyboard.press('Control+Shift+KeyZ'); await page.waitForTimeout(400);
  ok('Cmd+Shift+Z: Default again', (await theme()) === null && (await page.$eval('#m2-set-theme', function (s) { return s.value; })) === 'default');
  await page.evaluate(function () { localStorage.setItem('atlas-theme', 'gone'); }); await page.reload({ waitUntil: 'load' }); await settle();
  ok('a theme no longer offered falls back to Default', (await theme()) === null && (await chosenBg()) === BLUE);

  console.log('-- Edit window in Linen');
  await page.evaluate(function () { localStorage.setItem('atlas-theme', 'linen'); localStorage.setItem('atlas-edit-level', 'full'); }); await page.reload({ waitUntil: 'load' }); await settle();
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(3500);
  var pal = await page.$('#m2-editwin .m2-ed-palette button:not(.m2-ed-pinfo):not([aria-pressed="true"])');
  if (pal) { await pal.hover(); await page.waitForTimeout(200); }
  var sq = pal ? await pal.evaluate(function (e) { return getComputedStyle(e).backgroundColor; }) : null;
  ok('a palette sign under the pointer: a square darker than the panel', sq && sq !== LINEN && sq !== 'rgba(0, 0, 0, 0)' && sq !== 'rgb(241, 243, 244)', sq);
  ok('the Edit window on the linen column', (await bg('.m2-nav')) === LINEN);
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(800);   // Edit panel Right while editing, as a reader does
  await page.click('#m2-set-eside button[data-eside="right"]'); await page.waitForTimeout(3000);
  ok('the Edit panel on the right linen', (await page.$eval('#m2-epanel', function (e) { return !!e.offsetParent; })) && (await bg('#m2-epanel')) === LINEN, await bg('#m2-epanel'));

  console.log('-- a dark style in Linen');
  await page.goto(base + '?style=default-panel-dark#' + MAP, { waitUntil: 'load' }); await page.waitForTimeout(4000);
  var tx = await page.evaluate(function () { var e = document.querySelector('.m2-item:not(.m2-on)'); return e && getComputedStyle(e).color; });
  var lum = tx ? tx.match(/\d+/g).slice(0, 3).reduce(function (a, v) { return a + +v; }, 0) / 3 : 255;
  ok('the list\'s text dark on the linen', (await bg('.m2-nav')) === LINEN && lum < 100, tx);
  ok('no script errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
