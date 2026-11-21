// Lines around phenotypes and submaps (create.js linkKind0, core.js takes0), on Testing Glycolysis SBGN-ML: with Reduced
// notation ticked (the default) a phenotype or a submap starts a stimulation, inhibition, necessary stimulation or
// modulation, to a process, an entity, a phenotype or a submap, and a submap takes one as a phenotype does (CellDesigner's
// phenotype stands for all three); a catalysis from them or onto a submap, a consumption or production refused; undone one step each. Unticked, SBGN
// PD's rules alone: nothing to or from a submap, nothing out of a phenotype or a perturbing agent onto an entity. Read
// from the SBGN-ML text the editor would save. Nothing is saved (no token). No script error.
//   node tests/phenotype-lines.js [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#glycolysis-sbgn', local = process.argv[3], fs = require('fs'), path = require('path');
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0, want = null;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
    await page.route('**/renderers/yrender/yrender.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/yrender/yrender.js'), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var make = async function (kind, x, y) { var b4 = await ids(); await page.click('#m2-editwin button[data-make="' + kind + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(1200); await page.keyboard.press('Escape'); return (await ids()).filter(function (z) { return b4.indexOf(z) < 0; })[0]; };
  var arcs = async function () { return ((await now()).match(/<arc [^>]*>/g) || []); };
  var line = async function (kind, s, t, name) {
    var A = await rect(s), B = await rect(t), n0 = (await arcs()).length;
    await page.click('#m2-editwin button[data-make="' + kind + '"]');
    await page.mouse.move(A[0] + A[2] / 2, A[1] + A[3] / 2); await page.mouse.down(); await page.mouse.move(A[0] + A[2] / 2 + 8, A[1] + A[3] / 2 + 20, { steps: 4 });
    await page.mouse.move(B[0] + B[2] / 2, B[1] + B[3] / 2, { steps: 12 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    var a = await arcs(), made = a.length > n0 ? a.filter(function (x) { return x.indexOf('"' + s + '"') >= 0 && x.indexOf('"' + t + '"') >= 0; }).map(function (x) { return /class="([^"]*)"/.exec(x)[1]; }) : [];
    var exp = want.shift();
    ok((exp ? 'made: ' : 'refused: ') + kind + ' ' + name, exp ? made.length === 1 && made[0] === kind : a.length === n0, JSON.stringify(made));
  };
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-cd-compatible'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="submap"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var e1 = await make('macromolecule', 900, 700), e2 = await make('macromolecule', 1250, 700);
  var sm = await make('submap', 1250, 400), ph = await make('phenotype', 1080, 820), pa = await make('perturbing agent', 900, 820);
  ok('two entities, a submap, a phenotype and a perturbing agent made', !!(e1 && e2 && sm && ph && pa), errs.join(' / '));
  var cases = async function () {
    await line('stimulation', e1, sm, 'entity -> submap');
    await line('inhibition', sm, e2, 'submap -> entity');
    await line('stimulation', e1, ph, 'entity -> phenotype');
    await line('stimulation', ph, e2, 'phenotype -> entity');
    await line('modulation', ph, sm, 'phenotype -> submap');
    await line('catalysis', sm, e2, 'submap -> entity');
    await line('consumption', ph, e2, 'phenotype -> entity');
    await line('stimulation', pa, e2, 'perturbing agent -> entity');    await line('catalysis', e1, sm, 'entity -> submap');
    await line('consumption', e1, sm, 'entity -> submap');
    await line('production', sm, e2, 'submap -> entity');
  };
  want = [1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0]; await cases();
  for (var k = 0; k < 6; k++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(900); }
  ok('six undos take the six lines of the submap and phenotype away', (await arcs()).filter(function (x) { return x.indexOf('"' + sm + '"') >= 0 || x.indexOf('"' + ph + '"') >= 0; }).length === 0);
  await page.click('.m2-ed-pstrict input'); await page.waitForTimeout(800);
  ok('Reduced notation unticked', !(await page.isChecked('.m2-ed-pstrict input')));
  want = [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]; await cases();
  await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
  ok('no script error', !errs.length, errs.join(' / '));
  console.log(bad ? bad + ' wrong' : 'all ok');
  await 
  await b.close();
  process.exit(bad ? 1 : 0);
})();
