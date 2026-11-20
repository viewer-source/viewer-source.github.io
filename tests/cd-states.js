// State variables and units of information on a CellDesigner map (editor/src/cdcreate.js through create.js's svList,
// svAt, typeIn): on a protein made from the palette, the right-click menu's Add state variable (an empty residue,
// selected), its text typed in place by a double click (P@Y705: phosphorylated at the site Y705), a state CellDesigner
// does not have refused with the reason, the residue's own menu (Change state and Delete, no species items), its state
// changed from Change state's list, the residue dragged round the border to the right (its angle written), Add structural state and
// Add unit of information typed at once (active, N:2), the residue deleted by the Delete key and undone. Nothing is
// saved (no token). No script error.
//   node tests/cd-states.js [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#acly-celldesigner', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var menu = async function (P) { for (var n = 0; n < 2 && (await page.$('.m2-cx')); n++) await page.keyboard.press('Escape');
    await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(300); return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); };
  var pick = async function (label) { await page.click('.m2-cx button:text-is("' + label + '")'); await page.waitForTimeout(800); };
  var type = async function (v) { await page.waitForSelector('input.m2-ed-type', { timeout: 3000 }); await page.fill('input.m2-ed-type', v); await page.press('input.m2-ed-type', 'Enter'); await page.waitForTimeout(900); };
  var protein = function (t, sid) { var m = new RegExp('<species [^>]*id="' + sid + '"[\\s\\S]*?<celldesigner:proteinReference>([^<]*)<').exec(t); if (!m) return ''; var p = new RegExp('<celldesigner:protein [^>]*id="' + m[1] + '"[\\s\\S]*?(/>|</celldesigner:protein>)').exec(t); return p ? p[0] : ''; };
  var speciesOf = function (t, alias) { var m = new RegExp('<celldesigner:speciesAlias id="' + alias + '" species="([^"]*)"').exec(t); return m ? m[1] : ''; };
  var speciesText = function (t, sid) { var m = new RegExp('<species [^>]*id="' + sid + '"[\\s\\S]*?</species>').exec(t); return m ? m[0] : ''; };
  var aliasText = function (t, a) { var m = new RegExp('<celldesigner:speciesAlias id="' + a + '"[\\s\\S]*?</celldesigner:speciesAlias>').exec(t); return m ? m[0] : ''; };

  await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  var a0 = await ids(); await page.click('#m2-editwin button[data-make="cd:PROTEIN"]'); await page.mouse.click(1150, 300); await page.waitForTimeout(900);
  var p = (await ids()).filter(function (i) { return a0.indexOf(i) < 0; })[0];
  await page.keyboard.press('Escape');
  ok('a protein made', !!p);
  var R = await rect(p), C = [R[0] + R[2] / 2, R[1] + R[3] / 2], L = [R[0] + 1, R[1] + R[3] / 2], T = [R[0] + R[2] - 1, R[1] + R[3] / 2];
  var t = await now(), sid = speciesOf(t, p);
  var items = await menu(C);
  ok('the protein\'s menu offers Add state variable, Add structural state, Add unit of information first', items.slice(0, 3).join('|') === 'Add state variable|Add structural state|Add unit of information', items.join('|'));
  await pick('Add state variable');
  t = await now();
  ok('an empty residue on the protein, its state empty on the species', /<celldesigner:modificationResidue [^>]*id="rs\d+"/.test(protein(t, sid)) && /<celldesigner:modification residue="rs\d+" state="empty"\/>/.test(speciesText(t, sid)), protein(t, sid));
  await page.mouse.dblclick(L[0], L[1]); await type('P@Y705');
  t = await now();
  ok('P@Y705 typed: phosphorylated at the site Y705', / name="Y705"/.test(protein(t, sid)) && /state="phosphorylated"/.test(speciesText(t, sid)), protein(t, sid));
  await page.mouse.dblclick(L[0], L[1]); await type('zz@Y705');
  ok('a state CellDesigner does not have refused with the reason, the file unchanged', /no residue state zz/.test(await status()) && (await now()) === t, await status());
  items = await menu(L);
  ok('the residue\'s own menu: Change state and Delete, no species items', items.some(function (x) { return /^Change state/.test(x); }) && items.indexOf('Delete') >= 0 && items.indexOf('Change identity') < 0 && items.indexOf('Add state variable') < 0, items.join('|'));
  var items2 = await menu([L[0] - 5, L[1]]);
  ok('over the residue\'s outer half, out of the protein: its own menu, no map items', items2.join('|') === items.join('|'), items2.join('|'));
  await menu(L);
  await page.click('.m2-cx button:text-is("Change state")'); await page.waitForTimeout(300);
  await page.click('.m2-ci button:text-is("Ubiquitinated (Ub)")'); await page.waitForTimeout(900);
  t = await now();
  ok('Change state: ubiquitinated, the site kept', /state="ubiquitinated"/.test(speciesText(t, sid)) && / name="Y705"/.test(protein(t, sid)));
  await page.keyboard.press('Escape');
  await page.mouse.click(L[0], L[1]); await page.waitForTimeout(300);   // selected
  await page.mouse.move(L[0], L[1]); await page.mouse.down(); await page.mouse.move(L[0] + 10, L[1] - 10, { steps: 3 }); await page.mouse.move(T[0], T[1], { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(900);
  t = await now();
  var ang = /<celldesigner:modificationResidue angle="([^"]*)"/.exec(protein(t, sid));
  ok('dragged to the right side\'s middle: its angle 0', ang && Math.abs(+ang[1]) < 0.01, ang && ang[1]);
  await page.keyboard.press('Escape');
  await menu(C); await pick('Add structural state'); await type('active');
  t = await now();
  var sa = /<celldesigner:structuralState angle="([^"]*)"/.exec(aliasText(t, p));
  ok('Add structural state typed at once: active, at the bottom middle (the top is the unit\'s)', /<celldesigner:structuralState structuralState="active"\/>/.test(speciesText(t, sid)) && sa && Math.abs(+sa[1] - 3 * Math.PI / 2) < 0.01, sa && sa[1]);
  items = await menu(C);
  ok('no second Add structural state', items.indexOf('Add structural state') < 0 && items.indexOf('Add unit of information') >= 0, items.join('|'));
  await pick('Add unit of information'); await type('N:2');
  t = await now();
  ok('Add unit of information typed at once: N:2', /<celldesigner:info state="open" prefix="N" label="2"/.test(aliasText(t, p)), aliasText(t, p).slice(-300));
  await page.mouse.dblclick(R[0] + R[2] / 2, R[1] + R[3] - 1); await page.waitForSelector('input.m2-ed-type', { timeout: 3000 });
  ok('the structural state still reached by a double click', (await page.$eval('input.m2-ed-type', function (x) { return x.value; })) === 'active');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok('Esc leaves it as it was', (await now()) === t);
  items = await menu(C);
  ok('no second unit of information offered', items.indexOf('Add unit of information') < 0, items.join('|'));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  var t1 = await now();
  await page.mouse.click(T[0], T[1]); await page.waitForTimeout(300); await page.keyboard.press('Delete'); await page.waitForTimeout(900);
  t = await now();
  ok('the residue selected and deleted by the Delete key, the structural state kept', !/modificationResidue/.test(protein(t, sid)) && !/<celldesigner:modification residue=/.test(speciesText(t, sid)) && /structuralState="active"/.test(speciesText(t, sid)));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(900);
  ok('undo gives it back', (await now()) === t1);
  ok('no script error', !errs.length, errs.join(' / '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all right');
  process.exit(bad ? 1 : 0);
})();
