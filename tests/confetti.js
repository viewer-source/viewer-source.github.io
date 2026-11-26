// Confetti, a choice of the palettes' Colours (create.js confettiFill): on the styles page, on the Testing Glycolysis
// SBGN-ML map and the CellDesigner glycolysis map, each in a fresh page, Confetti chosen, three nodes placed: each new
// node a pastel of its own (HSL lightness 82%), the three apart, each, with a working tree given, the colour its confettiFill
// gives for the map as it was. Nothing is saved (no token). No script error.
//   node tests/confetti.js [base address] [viewer folder: its editor served in place of the page's] --data=<clone of the data repository>
var chromium = require('playwright').chromium, fs = require('fs'), path = require('path'), OM = require('./lib/open-map.js');
var pos = process.argv.slice(2).filter(function (a) { return a.slice(0, 2) !== '--'; });
var base = pos[0] || 'https://viewer-source.github.io/styles/', local = pos[1], bad = 0;
var confettiFill = null;
if (local) { var cs = fs.readFileSync(path.join(local, 'editor/src/create.js'), 'utf8'); eval(cs.slice(cs.indexOf('    function confettiHex'), cs.indexOf('    function confettiSquares'))); }
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
async function run(b, map, sign, kind) {
  var page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/converter\/(sbgn_edit|cd_make)\.js/, function (r) { var f = /(sbgn_edit|cd_make)\.js/.exec(r.request().url())[0]; r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', f), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  await OM.open(page, base, map);   // a test-set map added to this page's browser, a site map by its address
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-map-choices'); });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="' + sign + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="' + sign + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  await page.click('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd'); await page.waitForTimeout(200);
  var sq = await page.$$eval('body > .m2-ed-pdl button', function (l) { var c = l.filter(function (x) { return x.querySelector('span').textContent === 'Confetti'; })[0]; return c ? c.querySelectorAll('.m2-cs-sw i').length : -1; });
  ok(kind + ': Confetti in the Colours list, with five squares', sq === 5, String(sq));
  await page.click('body > .m2-ed-pdl button:has-text("Confetti")'); await page.waitForTimeout(200);
  var fillOf = function (id, cd) { return page.evaluate(function (a) {
      var t = window.m2EditNow().text;
      if (a.cd) return '#' + window.cd_make.look(t, a.id).fill.replace('#', '').slice(-6).toLowerCase();
      var attr = function (e, n) { var a = Array.from(e.attributes).filter(function (x) { return x.localName === n; })[0]; return a && a.value; };
      var all = Array.from(new DOMParser().parseFromString(t, 'application/xml').getElementsByTagName('*'));
      var ref = all.filter(function (e) { return e.localName === 'style' && (' ' + (attr(e, 'idList') || '') + ' ').indexOf(' ' + a.id + ' ') >= 0; }).map(function (e) { return e.firstElementChild && attr(e.firstElementChild, 'fill'); }).filter(Boolean).pop();
      var d = ref && all.filter(function (e) { return e.localName === 'colorDefinition' && attr(e, 'id') === ref; })[0];
      return String(d ? attr(d, 'value') : ref).toLowerCase();
    }, { id: id, cd: cd }); };
  var fills = [];
  for (var i = 0; i < 3; i++) {
    var want = await page.evaluate(function () { return window.m2EditNow().text; });
    var before = await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); });
    await page.click('#m2-editwin button[data-make="' + sign + '"]'); await page.mouse.click(600 + i * 150, 800); await page.waitForTimeout(1000); await page.keyboard.press('Escape');
    var id = (await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); })).filter(function (x) { return before.indexOf(x) < 0; })[0];
    var f = await fillOf(id, kind === 'CellDesigner');
    fills.push(f);
    var exp = confettiFill ? confettiFill(want) : null;   // with a working tree: its own confettiFill
    if (exp) ok(kind + ': node ' + (i + 1) + ' the colour confettiFill gives for the map as it was', f === exp, f + ' ' + exp);
    ok(kind + ': node ' + (i + 1) + ' made and filled', !!id && /^#[0-9a-f]{6}$/.test(f || ''), id + ' ' + f);
  }
  var light = fills.every(function (x) { var c = [1, 3, 5].map(function (k) { return parseInt(x.substr(k, 2), 16) / 255; }); return Math.abs((Math.max.apply(0, c) + Math.min.apply(0, c)) / 2 - .82) < .01; });
  ok(kind + ': each a pastel at lightness 82%', light, fills.join(' '));
  ok(kind + ': the three apart', new Set(fills).size === 3, fills.join(' '));
  if (kind === 'SBGN-ML') {   // a process keeps From map's look: no pastel
    var b4 = await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); });
    await page.click('#m2-editwin button[data-make="process"]'); await page.mouse.click(1050, 800); await page.waitForTimeout(1000); await page.keyboard.press('Escape');
    var pid = (await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); })).filter(function (x) { return b4.indexOf(x) < 0; })[0];
    var pf = await fillOf(pid, false);
    ok('SBGN-ML: a process placed gets no confetti fill', !!pid && fills.indexOf(pf) < 0 && !/^#(?!fff)[0-9a-f]{6}$/.test(pf === '#ffffff' ? '#fff' : pf), pid + ' ' + pf);
  }
  ok(kind + ': no script error', errs.length === 0, errs.join(' | '));
  await page.close();
}
(async function () {
  var b = await chromium.launch();
  await run(b, 'testing-glycolysis-sbgn', 'macromolecule', 'SBGN-ML');
  await run(b, 'glycolysis-celldesigner', 'cd:PROTEIN', 'CellDesigner');
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
