// An added reactant's or product's own line colour on a CellDesigner map (each line its own colour, as CellDesigner
// keeps one for each): on Glycolysis (CellDesigner) an added reactant or product clicked alone shows Line colour alone,
// written into its own link, drawn in it, the reaction's line kept; the reaction's main line then recoloured leaves the
// added line its own. Nothing is saved (no token). No script error.
//   node tests/cd-line-own.js [base address] [viewer folder: its editor and renderers served in place of the page's]
var engine = require('playwright')[process.env.BROWSER || 'chromium'], fs = require('fs'), path = require('path');   // BROWSER=webkit or firefox: the same test in another engine
var NOISE = require('./lib/noise.js');   // what a browser reports that is no fault of the page
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await engine.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { if (!NOISE.test(e.message)) errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  await page.goto(base + '#glycolysis-celldesigner', { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  var add = await page.evaluate(function () {   // an added reactant or product drawn on screen, its reaction's main line too
    var t = window.m2EditNow().text, M = window.cd_make, ids = (t.match(/<reaction [^>]*id="[^"]+"/g) || []).map(function (x) { return /id="([^"]+)"/.exec(x)[1]; });
    var vis = function (e) { var l = document.querySelector('#m2-img [data-e="' + e + '"] polyline[stroke]'); if (!l) return false; var r = l.getBoundingClientRect(); return r.left > 300 && r.top > 80 && r.bottom < 860 && r.right < 1390; };
    for (var i = 0; i < ids.length; i++) {
      var ab; try { ab = M.about(t, ids[i]); } catch (e) { continue; }
      var ps = ab.rl.map(function (x, n) { return 'r' + n; }).concat(ab.pl.map(function (x, n) { return 'p' + n; }));
      for (var j = 0; j < ps.length; j++) if (vis(ids[i] + '|' + ps[j]) && vis(ids[i] + '|a')) return [ids[i], ps[j]];
    }
    return null;
  });
  ok('an added reactant or product found', !!add, JSON.stringify(add));
  var on = async function (e) {
    var p = await page.$eval('#m2-img [data-e="' + e + '"] polyline[stroke]', function (l) { var q = l.points, k = Math.floor((q.numberOfItems - 1) / 2), a = q.getItem(k), c = q.getItem(k + 1), m = l.getScreenCTM(); return [(a.x + c.x) / 2 * m.a + m.e, (a.y + c.y) / 2 * m.d + m.f]; });
    await page.keyboard.press('Escape'); await page.mouse.click(1350, 880); await page.waitForTimeout(300);
    await page.mouse.click(p[0], p[1]); await page.waitForTimeout(500);
    return page.evaluate(function (a) {   // what lies under the click, and where the line is drawn on screen, said when the click selects nothing
      var h = document.elementFromPoint(a[0], a[1]), r = document.querySelector('#m2-img [data-e="' + a[2] + '"] polyline[stroke]').getBoundingClientRect(), g = h && h.closest && h.closest('[data-e],[data-n]');
      return 'clicked ' + Math.round(a[0]) + ',' + Math.round(a[1]) + ' on ' + (h ? h.tagName + (g ? ' of ' + (g.dataset.e || g.dataset.n) : '') : 'nothing') + '; line box ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(',');
    }, [p[0], p[1], e]);
  };
  var shown = function () { return page.evaluate(function () { return Array.from(document.querySelectorAll('#m2-editwin .m2-ed-props tr[data-k]')).filter(function (tr) { return tr.offsetParent; }).map(function (tr) { return tr.dataset.k; }); }); };
  var col = function (e) { return page.evaluate(function (e) { return window.cd_make.lineColour(window.m2EditNow().text, e); }, e); };
  var drawn = function (e) { return page.$$eval('#m2-img [data-e="' + e + '"] polyline[stroke]', function (l) { return l.map(function (x) { return x.getAttribute('stroke'); }).join(' '); }); };
  var put = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(700); };
  var line = add[0] + '|' + add[1], main = add[0] + '|a', m0 = await col(main);
  var hit = await on(line), sh = await shown();
  ok('the added line clicked alone: Line colour and width alone, with its Cardinality', JSON.stringify(sh) === JSON.stringify(['ecol', 'ewid', 'card']), JSON.stringify(sh) + (sh.length ? '' : '  ' + hit));
  ok('it shows its own colour', (await page.inputValue('#m2-ed-ecol')) === (await col(line)), await page.inputValue('#m2-ed-ecol'));
  await put('ecol', '#3456ab');
  ok('written into its own link, the reaction’s kept', (await col(line)) === '#3456ab' && (await col(main)) === m0, (await col(line)) + ' ' + (await col(main)));
  ok('drawn in it', (await drawn(line)) === '#3456ab', await drawn(line));
  ok('the main line not', (await drawn(main)) !== '#3456ab', await drawn(main));
  await on(main);
  var rows = await shown();
  ok('the main line clicked: Reversible and Line colour', rows.indexOf('rev') >= 0 && rows.indexOf('ecol') >= 0, JSON.stringify(rows));
  await put('ecol', '#ab12cd');
  ok('the reaction’s line written, the added line keeps its own', (await col(main)) === '#ab12cd' && (await col(line)) === '#3456ab', (await col(main)) + ' ' + (await col(line)));
  ok('both drawn so', (await drawn(main)) === '#ab12cd' && (await drawn(line)) === '#3456ab', (await drawn(main)) + ' ' + (await drawn(line)));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
