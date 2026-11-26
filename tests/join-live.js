// A glyph placed from the palette on a complex becomes its member (create.js joinPlan, joinDo; the format's F.join),
// on the styles page, Full editing, one SBGN-ML map and one CellDesigner map:
//   1. a complex placed from the palette on empty space, then a protein (macromolecule) placed on it: in the map's file
//      the protein is the complex's member (SBGN-ML: a glyph inside the complex's glyph; CellDesigner: a species alias
//      whose complexSpeciesAlias is the complex);
//   2. Cmd+Z takes the protein back out of the file, and the complex stays;
//   3. on a GraphML map the palette is not shown, so nothing is placed (no join asked).
// Nothing is saved (no token). No script error.
//   node tests/join-live.js [base address] [--local] --data=<clone of the data repository>   (--local: the working tree's editor and renderers routed in; Testing Glycolysis from its test set, added as a person adds a file)
var path = require('path'), fs = require('fs'), { chromium } = require('playwright'), editorNow = require('./editor-now.js'), here = path.join(__dirname, '..');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a.slice(0, 2) !== '--'; });
var OM = require('./lib/open-map.js');   // a map by its address, checked; a test-set map added from its file
var base = args[0] || 'https://viewer-source.github.io/styles/';
var MAPS = [
  { name: 'SBGN-ML', hash: 'testing-glycolysis-sbgn', complex: 'complex', protein: 'macromolecule' },
  { name: 'CellDesigner', hash: 'acly-celldesigner', complex: 'cd:COMPLEX', protein: 'cd:PROTEIN' }
];
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
  page.on('pageerror', function (e) { errs.push(e.message); });
  if (local) {
    var ed = editorNow(here);
    await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/(converter|yrender|layout)\/[^/?]+\.js/, function (r) {
      var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]);
      if (fs.existsSync(fp)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue();
    });
  }
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-level', 'full'); });
  // the file's members by complex: SBGN-ML glyphs inside a complex glyph, CellDesigner aliases by complexSpeciesAlias
  var members = function () {
    return page.evaluate(function () {
      var t = window.m2EditNow().text, d = new DOMParser().parseFromString(t, 'application/xml'), out = {};
      Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'glyph'), function (g) {
        if (g.getAttribute('class') !== 'complex') return;
        out[g.getAttribute('id')] = Array.prototype.filter.call(g.children, function (c) { return c.localName === 'glyph'; }).map(function (c) { return c.getAttribute('id'); });
      });
      Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'complexSpeciesAlias'), function (a) { out[a.getAttribute('id')] = []; });
      Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'speciesAlias'), function (a) {
        var c = a.getAttribute('complexSpeciesAlias');
        if (c) (out[c] = out[c] || []).push(a.getAttribute('id'));
      });
      return out;
    });
  };
  var sign = function (k) { return page.click('#m2-editwin button[data-make="' + k + '"]'); };
  var open = async function (hash, sel) {
    var id = await OM.resolve(page, base, hash);
    await page.goto('about:blank'); await OM.byAddress(page, base, id);
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 60000 });
    if (sel) await page.waitForSelector(sel, { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2000);
  };
  // an empty spot on the map's picture: a point off every node's box
  var empty = function () {
    return page.evaluate(function () {
      var img = document.querySelector('#m2-img').getBoundingClientRect(), bs = Array.prototype.map.call(document.querySelectorAll('#m2-img [data-n]'), function (g) { return g.getBoundingClientRect(); });
      for (var y = Math.max(img.top, 160) + 60; y < Math.min(img.bottom, 860) - 60; y += 20) for (var x = Math.max(img.left, 360) + 60; x < Math.min(img.right, 1340) - 60; x += 20)
        if (!bs.some(function (r) { return x > r.left - 70 && x < r.right + 70 && y > r.top - 50 && y < r.bottom + 50; })) return [x, y];
      return null;
    });
  };
  var centre = function (gid) {   // the screen centre of the node drawn for a file id (data-n, or its GraphML node of that id)
    return page.evaluate(function (gid) {
      var g = document.querySelector('#m2-img [data-n="' + gid + '"]') || Array.prototype.filter.call(document.querySelectorAll('#m2-img [data-n]'), function (q) { return (q.getAttribute('data-n') || '').split('__').pop() === gid; })[0];
      if (!g) return null;
      var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
    }, gid);
  };
  for (var M of MAPS) {
    console.log('-- ' + M.name);
    await open(M.hash, '#m2-editwin button[data-make="' + M.protein + '"]');
    var m0 = await members(), P = await empty();
    if (!P) { ok(M.name + ': an empty spot for the complex', false); continue; }
    await sign(M.complex); await page.mouse.click(P[0], P[1]); await page.waitForTimeout(1500); await page.keyboard.press('Escape');
    var m1 = await members(), cx = Object.keys(m1).filter(function (k) { return !(k in m0); })[0];
    ok(M.name + ': a complex placed', !!cx);
    if (!cx) continue;
    var C = await centre(cx) || P;
    await sign(M.protein); await page.mouse.click(C[0], C[1]); await page.waitForTimeout(2000); await page.keyboard.press('Escape');
    var m2 = await members();
    ok(M.name + ': the protein placed on the complex is its member in the file', (m2[cx] || []).length === 1, JSON.stringify(m2[cx]));
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(1500);
    var m3 = await members();
    ok(M.name + ': undo takes the protein back, the complex stays', cx in m3 && !(m3[cx] || []).length, JSON.stringify(m3[cx]));
  }
  console.log('-- GraphML');
  await open('glycolysis-graphml');
  ok('GraphML: no palette to place from', !(await page.$('#m2-editwin button[data-make="macromolecule"]:visible')));
  ok('no script error', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(bad ? bad + ' wrong' : 'all ok');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
