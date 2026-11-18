// Add reactant and Add product on a CellDesigner map (editor/src/cdcreate.js), by default the styles page on the ACLY demo
// map: the two signs in the palette; while an added reactant is drawn onto a reaction, the blue place at its join on the
// main line where the file's added reactants already join, and the reaction's main line lit; the reactant added, ending
// there; an added product drawn from a point of the main line (not the square) to a new species, leaving at the
// products' join; a reaction sign onto a square and Add reactant between two species refused. Nothing is saved.
//   node tests/cd-add.js [address] [viewer folder: its editor served in place of the page's] [screenshot folder]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#acly-celldesigner', local = process.argv[3], shots = process.argv[4];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*_edit.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
    await page.route('**/renderers/converter/cd_make.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter/cd_make.js'), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };
  var at = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var along = function (id, f) {   // a point of edge id's drawn path, at share f of its length, on screen
    return page.$$eval('#m2-img [data-e="' + id + '"] polyline, #m2-img [data-e="' + id + '"] path', function (l, f) {
      var p = l[l.length - 1], q = p.getPointAtLength(p.getTotalLength() * f), m = p.getScreenCTM(); return [q.x * m.a + q.y * m.c + m.e, q.x * m.b + q.y * m.d + m.f];
    }, f);
  };
  var status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }); };
  var sign = function (k) { return page.click('#m2-editwin button[data-make="' + k + '"]'); };
  var port = function () { return page.$$eval('#m2-edit-layer .m2-ed-port', function (l) { return l.map(function (x) { var r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); }); };
  var near = function (A, B, d) { return A && B && Math.hypot(A[0] - B[0], A[1] - B[1]) <= d; };
  var drag = async function (A, B, mid) {   // mid: called with the pointer over B, before the release
    await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 8, A[1] + 25, { steps: 4 }); await page.mouse.move(B[0], B[1], { steps: 8 });
    await page.waitForTimeout(150); var r = mid ? await mid() : null; await page.mouse.up(); await page.waitForTimeout(900); return r;
  };
  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  if (local) {   // the working tree's marks (its edit layer's rules in atlas-app.html)
    var css = fs.readFileSync(path.join(local, '_includes/atlas-app.html'), 'utf8').split('\n').filter(function (l) { return /#m2-edit-layer \.m2-ed-/.test(l); }).join('\n');
    await page.addStyleTag({ content: css });
  }
  ok('Add reactant and Add product in the palette, after the reactions', (await page.$$eval('#m2-editwin .m2-ed-psigns button', function (l) { return l.filter(function (x) { return x.offsetParent; }).map(function (x) { return x.dataset.make; }).join(' '); })).indexOf('cd:UNKNOWN_TRANSITION cd:ADD_REACTANT cd:ADD_PRODUCT cd:CATALYSIS') >= 0);
  var e0 = await es(), J0 = await along('re_n3|r0', 1), Jp = await along('re_n3|p0', 0);
  // an added reactant from Histone acetylation's neighbour: a new protein placed at an empty spot
  var ids0 = await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); });
  await sign('cd:PROTEIN'); await page.mouse.click(1200, 700); await page.waitForTimeout(800);
  var nw = (await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); })).filter(function (i) { return ids0.indexOf(i) < 0; })[0];
  await page.keyboard.press('Escape'); await sign('cd:ADD_REACTANT');
  var mid = await drag(await at(nw), await at('re_n3|proc'), async function () {
    if (shots) await page.screenshot({ path: path.join(shots, 'cd-add-reactant.png') });
    return { port: await port(), lit: await page.$$eval('#m2-edit-layer .m2-ed-rxline', function (l) { return l.length; }) };
  });
  ok('the blue place at the reactants’ join', near(mid.port[0], J0, 2), JSON.stringify([mid.port[0], J0]));
  ok('the main line lit while drawing', mid.lit === 2);
  var e1 = await es(), add1 = e1.filter(function (i) { return e0.indexOf(i) < 0; });
  ok('an added reactant made', add1.length === 1 && add1[0] === 're_n3|r2', add1.join(' '));
  if (add1[0]) ok('it ends at the join', near(await along(add1[0], 1), J0, 2));
  // an added product from a point on the main line after the square to a new species
  ids0 = await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); });
  await page.keyboard.press('Escape'); await sign('cd:SIMPLE_MOLECULE'); await page.mouse.click(1250, 600); await page.waitForTimeout(800);
  var sm = (await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); })).filter(function (i) { return ids0.indexOf(i) < 0; })[0];
  await page.keyboard.press('Escape'); await sign('cd:ADD_PRODUCT');
  var from = await along('re_n3|b', 0.6);
  mid = await drag(from, await at(sm), async function () { if (shots) await page.screenshot({ path: path.join(shots, 'cd-add-product.png') }); return page.$$eval('#m2-edit-layer .m2-ed-rxline', function (l) { return l.length; }); });
  ok('the main line lit while drawing a product', mid === 2);
  var e2 = await es(), add2 = e2.filter(function (i) { return e1.indexOf(i) < 0; });
  ok('an added product made from the main line', add2.length === 1 && add2[0] === 're_n3|p3', add2.join(' '));
  if (add2[0]) ok('it leaves at the products’ join', near(await along(add2[0], 0), Jp, 2));
  // an added product from the square itself
  ids0 = await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); });
  await page.keyboard.press('Escape'); await sign('cd:SIMPLE_MOLECULE'); await page.mouse.click(1250, 760); await page.waitForTimeout(800);
  var sm2 = (await page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); })).filter(function (i) { return ids0.indexOf(i) < 0; })[0];
  await page.keyboard.press('Escape'); await sign('cd:ADD_PRODUCT'); await drag(await at('re_n3|proc'), await at(sm2));
  var e3 = await es(), add3 = e3.filter(function (i) { return e2.indexOf(i) < 0; });
  ok('an added product made from the square', add3.length === 1 && add3[0] === 're_n3|p4', add3.join(' '));
  e2 = e3;
  // refusals
  await page.keyboard.press('Escape'); await sign('cd:STATE_TRANSITION'); await drag(await at('sa_n13'), await at('re_n3|proc'));
  ok('a reaction sign onto a square refused, Add reactant named', /Add reactant/.test(await status()) && (await es()).length === e2.length, await status());
  await page.keyboard.press('Escape'); await sign('cd:ADD_REACTANT'); await drag(await at('sa_n13'), await at(sm));
  ok('Add reactant between two species refused', /Add reactant goes/.test(await status()) && (await es()).length === e2.length, await status());
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  process.exit(bad ? 1 : 0);
})();
