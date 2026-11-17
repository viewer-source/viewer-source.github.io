// The CellDesigner palette (editor/src/cdcreate.js) on a page with the editor, by default the styles page on a
// CellDesigner demo map: its signs shown in place of PD and AF; species, a compartment and a complex placed by a click
// and by a drag from the palette; a protein placed on a complex its member; a state transition drawn between two species, undone
// and redone with the species made before it; an AND gate by three clicks onto the reaction's square; an inhibition onto
// the square; the gate's menu (no NOT for two inputs); the gate's line out and an input line deleted together; a reduced physical stimulation between two species; a name typed in place; the right-click menus' other kinds, a species' through Change identity's window;
// a species deleted with its reaction; New CellDesigner map making species and a reaction on an empty map. Nothing is
// saved (no token). No script error anywhere.
//   node tests/cd-palette.js [address]
var { chromium } = require('playwright');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#acly-celldesigner';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };
  var at = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }); };
  var sign = function (k) { return page.click('#m2-editwin button[data-make="' + k + '"]'); };
  var made = async function (k, x, y) { var a = await ids(); await sign(k); await page.mouse.click(x, y); await page.waitForTimeout(700); return (await ids()).filter(function (i) { return a.indexOf(i) < 0; })[0]; };
  var drag = async function (A, B) { await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 8, A[1] + 25, { steps: 4 }); await page.mouse.move(B[0], B[1], { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(800); };
  var menu = async function (P) { await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(300); return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); };
  var start = async function (u) {
    await page.goto(u, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  await start(url);
  ok('21 CellDesigner signs, no PD and AF', (await page.$$eval('#m2-editwin .m2-ed-psigns button', function (l) { return l.filter(function (x) { return x.offsetParent; }).length; })) === 21 && !(await page.$('#m2-editwin button[data-lang="pd"]:visible')));
  var p = await made('cd:PROTEIN', 1150, 250), m = await made('cd:SIMPLE_MOLECULE', 1150, 420), r = await made('cd:RNA', 1000, 180), g = await made('cd:GENE', 1300, 180);
  var c = await made('cd:COMPARTMENT', 900, 790);
  ok('species and a compartment placed by clicks', !!(p && m && r && g && c));
  var before = await ids(), sg = await page.$eval('#m2-editwin button[data-make="cd:COMPLEX"]', function (x) { var q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.move(sg[0], sg[1]); await page.mouse.down(); await page.mouse.move(600, 500, { steps: 6 }); await page.mouse.move(1280, 450, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(800);
  var cx = (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0];
  ok('a complex dropped from the palette', /^csa/.test(cx || ''));
  await sign('cd:PROTEIN'); var C = await at(cx); await page.mouse.click(C[0], C[1]); await page.waitForTimeout(1500);
  ok('a protein placed on the complex is its member', new RegExp('<celldesigner:speciesAlias id="[^"]+"[^>]*complexSpeciesAlias="' + cx + '"').test(await page.evaluate(function () { return window.m2EditNow().text; }))); await page.keyboard.press('Escape');
  var e0 = await es(); await drag(await at(p), await at(m));
  var rx = (await es()).filter(function (i) { return e0.indexOf(i) < 0; }), rid = rx[0] && rx[0].split('|')[0];
  ok('a state transition drawn between two species', rx.length === 2);
  for (var u = 0; u < 3; u++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(800); }
  ok('undo takes back the reaction, the protein in the complex, then the complex', !(await es()).some(function (i) { return i.indexOf(rid + '|') === 0; }) && (await ids()).indexOf(cx) < 0 && (await ids()).indexOf(p) >= 0);
  for (var u2 = 0; u2 < 3; u2++) { await page.keyboard.press('Control+y'); await page.waitForTimeout(800); }
  ok('redo gives them back', (await es()).some(function (i) { return i.indexOf(rid + '|') === 0; }) && (await ids()).indexOf(cx) >= 0);
  await sign('cd:G_AND'); await page.mouse.click.apply(page.mouse, await at(r)); await page.waitForTimeout(200); await page.mouse.click.apply(page.mouse, await at(g)); await page.waitForTimeout(200);
  ok('the gate asks for its target', /square/.test(await status()));
  await page.mouse.click.apply(page.mouse, await at(rid + '|proc')); await page.waitForTimeout(900);
  ok('an AND gate made on the reaction', (await ids()).indexOf(rid + '|g0') >= 0);
  var q = await made('cd:PROTEIN', 1320, 330); await sign('cd:INHIBITION'); e0 = await es(); await drag(await at(q), await at(rid + '|proc'));
  ok('an inhibition onto the square', (await es()).filter(function (i) { return e0.indexOf(i) < 0; }).some(function (i) { return /\|m\d+$/.test(i); }));
  await sign('cd:PHYSICAL_STIMULATION'); e0 = await es(); await drag(await at(g), await at(q));
  ok('a reduced physical stimulation between two species', (await es()).filter(function (i) { return e0.indexOf(i) < 0; }).length === 1);
  // the gate's line out and one input's line deleted together leave the inhibition; a NOT gate
  // offered only where it would have one input
  var lineAt = function (id) { return page.evaluate(function (id) {   // the middle of the line's longest drawn part, on screen
    var all = []; document.querySelectorAll('#m2-img [data-e="' + id + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() / 2), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, id); };
  var gl = await menu(await at(rid + '|g0')); await page.keyboard.press('Escape');
  ok('a two-input gate is not offered as NOT', gl.indexOf('Make OR gate') >= 0 && gl.indexOf('Make NOT gate') < 0);
  var inp = (await es()).filter(function (i) { return i.indexOf(rid + '|m') === 0; });
  await page.mouse.click(10, 880); await page.mouse.click.apply(page.mouse, await lineAt(rid + '|m0')); await page.keyboard.down('Shift'); await page.mouse.click.apply(page.mouse, await lineAt(rid + '|m2')); await page.keyboard.up('Shift');
  await page.waitForTimeout(200); await page.keyboard.press('Delete'); await page.waitForTimeout(900);
  var left = (await es()).filter(function (i) { return i.indexOf(rid + '|m') === 0; });
  ok('gate line out and an input line deleted together: the gate gone, the inhibition kept', inp.length === 4 && left.length === 1 && (await ids()).indexOf(rid + '|g0') < 0);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(800);
  ok('undo gives the gate back', (await ids()).indexOf(rid + '|g0') >= 0);
  await page.mouse.dblclick.apply(page.mouse, await at(p)); await page.waitForTimeout(300);
  var f = await page.$('.m2-ed-type'); ok('the name field opens empty on an unnamed species', !!f && (await f.inputValue()) === '');
  if (f) { await page.keyboard.type('MEK1'); await page.keyboard.press('Enter'); await page.waitForTimeout(800); }
  ok('the name written', /MEK1/.test(await page.$eval('#m2-img [data-n="' + p + '"]', function (x) { return x.textContent; })));
  var ci = function () { return page.$$eval('.m2-ci [role="menu"] button', function (l) { return l.map(function (x) { return x.textContent + (x.getAttribute('aria-checked') === 'true' ? '*' : ''); }); }); };
  var l1 = await menu(await at(p)); await page.click('.m2-cx button:has-text("Change identity")').catch(function () {}); await page.waitForTimeout(300);
  var k1 = await ci(); await page.click('.m2-ci button:has-text("Gene")').catch(function () {}); await page.waitForTimeout(800);
  var l2 = await menu(await at(p)); await page.click('.m2-cx button:has-text("Change identity")').catch(function () {}); await page.waitForTimeout(300);
  var k2 = await ci(); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('the species menu has one Change identity, under Delete', l1.indexOf('Change identity\u2026') === l1.indexOf('Delete') + 1 && !l1.some(function (t) { return /^Make /.test(t); }));
  ok('its window lists the seven kinds, the own checked, and retypes', k1.length === 7 && k1[0] === 'Protein*' && k2.indexOf('Gene*') >= 0 && k2.indexOf('Protein') >= 0);
  ok('Escape closes the window', !(await page.$('.m2-ci')));
  var l3 = await menu(await at(rid + '|proc')); await page.keyboard.press('Escape');
  ok('the square offers the other reaction types', l3.indexOf('Make unknown transition') >= 0 && l3.indexOf('Make state transition') < 0);
  await page.mouse.click(10, 880); await page.mouse.click.apply(page.mouse, await at(m)); await page.waitForTimeout(200); await page.keyboard.press('Delete'); await page.waitForTimeout(900);
  ok('a species deleted with its reaction', (await ids()).indexOf(m) < 0 && !(await es()).some(function (i) { return i.indexOf(rid + '|') === 0; }));
  // New CellDesigner map, from a fresh page (a map with changes not saved keeps the editor on it)
  await page.goto('about:blank'); await page.goto(url.replace(/#.*/, ''), { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(1500);
  var it = await page.$('.m2-map'), bb = await it.boundingBox(); await menu([bb.x + 20, bb.y + bb.height / 2]);
  await page.click('.m2-cx button:has-text("New CellDesigner map")'); await page.waitForTimeout(3500);
  ok('New CellDesigner map opens empty with the palette', (await ids()).length === 0 && !!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible')));
  var a = await made('cd:PROTEIN', 700, 300), z = await made('cd:GENE', 950, 300); e0 = await es(); await drag(await at(a), await at(z));
  ok('species and a reaction on the new map', !!a && !!z && (await es()).length === 2);
  ok('no script error', !errs.length); errs.forEach(function (e) { console.log('  ' + e); });
  await b.close();
  process.exit(bad ? 1 : 0);
})();
