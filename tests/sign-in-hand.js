// A line's sign kept in hand (double-clicked; editor/src/create.js linkHow and usual, cdcreate.js cdHow0 and cdUsual)
// draws its own kind where it fits the two ends, else the kind the ends give; a sign taken for one line (a click) makes
// its own kind or nothing; no Line sign in the palettes. SBGN-ML, Production in hand (the glycolysis demo map, where catalysis is the most used modulation): two
// entities get a process between them; an entity onto that process's side off its antennas the map's most used
// modulation; an entity onto its middle a consumption; the process to an entity a production. CellDesigner (the ACLY demo
// map, State transition in hand, where physical stimulation is the most used modifier): a species onto a reaction's square that modifier, onto its
// main line an added reactant, the reaction to a species an added product, two species a new reaction. Nothing is saved.
//   node tests/sign-in-hand.js [viewer folder: its editor served in place of the page's] [base address]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var local = process.argv[2], base = process.argv[3] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page, errs = [], bad = 0;
  var ed = local && require('./editor-now.js')(local);
  var fresh = async function () {   // a page of its own for each map (the one before is left in edit mode)
    page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    if (ed) await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    page.on('pageerror', function (e) { errs.push(e.message); });
  };
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-n'); }))); }); };
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };
  var box = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var at = async function (id) { var r = await box(id); return [r[0] + r[2] / 2, r[1] + r[3] / 2]; };
  var sign = function (k) { return page.click('#m2-editwin button[data-make="' + k + '"]'); };
  var made = async function (k, x, y) { var a = await ids(); await page.keyboard.press('Escape'); await sign(k); await page.mouse.click(x, y); await page.waitForTimeout(700); return (await ids()).filter(function (i) { return a.indexOf(i) < 0; }); };
  var drag = async function (A, B) { await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 8, A[1] + 25, { steps: 4 }); await page.mouse.move(B[0], B[1], { steps: 8 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(900); };
  var line = async function (A, B, k, once) {   // a line drawn with sign k kept in hand (once: taken for one line): the lines it made
    var e0 = await es(); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    if (once) await sign(k); else await page.dblclick('#m2-editwin button[data-make="' + k + '"]');
    await drag(A, B); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    return (await es()).filter(function (i) { return e0.indexOf(i) < 0; });
  };
  var lineAt = function (id) { return page.evaluate(function (id) {
    var all = []; document.querySelectorAll('#m2-img [data-e="' + id + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() / 2), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, id); };
  var kindOf = async function (id) {   // the kind checked in the line's Change identity window
    for (var n = 0; n < 2 && (await page.$('.m2-cx')); n++) await page.keyboard.press('Escape');
    var P = await lineAt(id); await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(300);
    await page.click('.m2-cx button:has-text("Change identity")').catch(function () {}); await page.waitForTimeout(300);
    var k = await page.$$eval('.m2-ci button[aria-checked="true"]', function (l) { return l.map(function (x) { return x.textContent; }).join(' '); });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); return k;
  };
  var signs = function () { return page.$$eval('#m2-editwin .m2-ed-psigns button', function (l) { return l.filter(function (x) { return x.offsetParent; }).map(function (x) { return x.dataset.make; }); }); };
  var start = async function (hash, first) {
    await fresh(); await page.goto(base + hash, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$('#m2-editwin button[data-make="' + first + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + first + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };

  // SBGN-ML
  await start('#glycolysis-sbgn', 'macromolecule');
  var s = await signs();
  ok('SBGN-ML: no Line sign, Consumption first of the arcs', s.indexOf('line') < 0 && s.indexOf('consumption') >= 0, s.slice(-8).join(' '));
  var m1 = (await made('macromolecule', 1150, 200))[0], c1 = (await made('simple chemical', 1080, 420))[0], c2 = (await made('simple chemical', 1320, 420))[0];
  var n0 = await ids(), pair = await line(await at(c1), await at(c2), 'production');
  var proc = (await ids()).filter(function (i) { return n0.indexOf(i) < 0; })[0];
  ok('two entities: a process made between them, a consumption and a production', !!proc && pair.length === 2, pair.join(' '));
  var B = await box(proc), C = [B[0] + B[2] / 2, B[1] + B[3] / 2];
  ok('Production taken for one line, onto the process\u2019s side: nothing made', (await line(await at(m1), [C[0], B[1] + 1], 'production', true)).length === 0);
  var mod = await line(await at(m1), [C[0], B[1] + 1], 'production');   // the top side: off the horizontal antennas
  ok('an entity onto the process’s side: one line', mod.length === 1, mod.join(' '));
  if (mod[0]) { var k1 = await kindOf(mod[0]); ok('it is the map’s most used modulation, catalysis', /^Catalysis/.test(k1), k1); }
  var c3 = (await made('simple chemical', 1200, 560))[0], cons = await line(await at(c3), C, 'production');
  ok('an entity onto the process’s middle: one line', cons.length === 1, cons.join(' '));
  var c4 = (await made('simple chemical', 1200, 300))[0], n1 = await ids(), prod = await line(C, await at(c4), 'production');
  ok('the process to an entity: one line, no new node', prod.length === 1 && (await ids()).length === n1.length, prod.join(' '));

  // CellDesigner
  await start('#acly-celldesigner', 'cd:PROTEIN');
  s = await signs();
  ok('CellDesigner: no Line sign, State transition first of the reactions', !s.some(function (k) { return /LINE$/.test(k); }) && s.indexOf('cd:G_UNKNOWN') + 1 === s.indexOf('cd:STATE_TRANSITION'), s.slice(9, 16).join(' '));
  var p1 = (await made('cd:PROTEIN', 1200, 700))[0];
  ok('State transition taken for one line, onto a reaction\u2019s square: nothing made', (await line(await at(p1), await at('re_n3|proc'), 'cd:STATE_TRANSITION', true)).length === 0);
  var mdf = await line(await at(p1), await at('re_n3|proc'), 'cd:STATE_TRANSITION');
  ok('a species onto a reaction’s square: a modifier', mdf.length === 1 && /^re_n3\|m\d+$/.test(mdf[0]), mdf.join(' '));
  if (mdf[0]) { var k2 = await kindOf(mdf[0]); ok('it is the map’s most used modifier, physical stimulation', /^Physical stimulation/.test(k2), k2); }
  var p2 = (await made('cd:SIMPLE_MOLECULE', 1250, 600))[0], rct = await line(await at(p2), await lineAt('re_n3|a'), 'cd:STATE_TRANSITION');
  ok('a species onto a reaction’s main line: an added reactant', rct.length === 1 && /^re_n3\|r\d+$/.test(rct[0]), rct.join(' '));
  var p3 = (await made('cd:SIMPLE_MOLECULE', 1250, 780))[0], prd = await line(await at('re_n3|proc'), await at(p3), 'cd:STATE_TRANSITION');
  ok('a reaction to a species: an added product', prd.length === 1 && /^re_n3\|p\d+$/.test(prd[0]), prd.join(' '));
  var rx = await line(await at(p1), await at(p3), 'cd:STATE_TRANSITION');
  ok('two species: a new reaction', rx.length >= 1 && !/^re_n3\|/.test(rx[0]), rx.join(' '));
  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  process.exit(bad ? 1 : 0);
})();
