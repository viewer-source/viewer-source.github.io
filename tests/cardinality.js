// Cardinality in a line's Properties (create.js edgeSet, rxCounts; sbgn_edit recount, cd_make restoich): on the styles
// page, an SBGN-ML consumption and production on Testing Glycolysis each typed 2 (written as the arc's cardinality glyph,
// drawn on the line, shown), 1 typed (taken out), 3 typed; no row on a modulation; a CellDesigner added reactant's or
// product's line typed 2 (its speciesReference's stoichiometry, drawn), a reaction's Cardinality rows (one per reactant and
// product, named) typed 4 and 0.5, -1 refused, 1 writing nothing; nothing else in either file changed (on CellDesigner after the first change's canvas fit); undo puts each file back.
// Nothing is saved (no token). No script error.
//   node tests/cardinality.js [base address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/layout/layout.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/layout/layout.js'), 'utf8') }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var erows = function () { return page.$$eval('.m2-ed-pedge tr[data-k]', function (l) { return l.filter(function (r) { return !r.hidden && !r.closest('[hidden]'); }).map(function (r) { return r.dataset.k; }); }); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1200); };
  var drawn = function (id) { return page.$$eval('#m2-img [data-e="' + id + '"] text', function (l) { return l.map(function (x) { return x.textContent.trim(); }); }); };
  var shown = function (k) { return page.$eval('#m2-ed-' + k, function (f) { return !f.closest('tr').hidden && !f.closest('[hidden]') ? f.value : null; }); };
  var lineAt = function (id) { return page.evaluate(function (id) {   // the middle of the line's longest drawn part, on screen
    var all = []; document.querySelectorAll('#m2-img [data-e="' + id + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() / 2), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, id); };
  var open = async function (hash, mark) {
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' });   // a page of its own, not a hash change await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin button[data-make="' + mark + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + mark + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var pick = async function (id) { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.mouse.click.apply(page.mouse, await lineAt(id)); await page.waitForTimeout(600); };
  var undo = async function () { await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); };
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };

  // SBGN-ML: a consumption and a production at a process
  await open('glycolysis-sbgn', 'compartment');
  var t0 = await now(), ids = await es();
  var arcOf = function (cls) { return (t0.match(new RegExp('<(?:\\w+:)?arc\\b[^>]*class="' + cls + '"[^>]*>', 'g')) || []).map(function (a) { return /\bid="([^"]+)"/.exec(a)[1]; }).filter(function (a) { return ids.indexOf(a) >= 0; }); };
  var longest = function (as) { return page.evaluate(function (as) {
    var len = function (a) { var g = document.querySelector('#m2-img [data-e="' + a + '"] path'); return g && g.getTotalLength ? g.getTotalLength() : 0; };
    return as.sort(function (u, v) { return len(v) - len(u); })[0]; }, as); };
  var cons = await longest(arcOf('consumption')), prod = await longest(arcOf('production')), mod = await longest(arcOf('catalysis').concat(arcOf('stimulation')));
  var card = function (t, a) { var m = new RegExp('<(?:\\w+:)?arc\\b[^>]*\\bid="' + a + '"[\\s\\S]*?</(?:\\w+:)?arc>').exec(t); var c = m && /class="cardinality"[\s\S]*?<(?:\w+:)?label text="([^"]*)"/.exec(m[0]); return c ? c[1] : null; };
  for (var A of [cons, prod]) {
    await pick(A);
    ok(A + ': Cardinality shown, empty', (await shown('card')) === '', await shown('card'));
    await type('card', '2');
    ok(A + ': written as its cardinality glyph 2', card(await now(), A) === '2', card(await now(), A));
    ok(A + ': drawn 2 on the line', (await drawn(A)).indexOf('2') >= 0, JSON.stringify(await drawn(A)));
    ok(A + ': shown 2', (await shown('card')) === '2');
    await type('card', '1');
    ok(A + ': 1 takes it out', card(await now(), A) === null && (await drawn(A)).indexOf('2') < 0);
    await type('card', '3');
  }
  var t2 = await now();
  ok('SBGN-ML: the rest of the file as it was (only the two glyphs added)', t2.replace(/\s*<glyph class="cardinality"[^>]*>[\s\S]*?<\/glyph>/g, '') === t0.replace(/\s*<glyph class="cardinality"[^>]*>[\s\S]*?<\/glyph>/g, ''));
  if (mod) { await pick(mod); ok(mod + ': no Cardinality on a modulation', (await shown('card')) === null); }
  for (var u = 0; u < 6; u++) await undo();
  ok('SBGN-ML: undone, the file as it was', (await now()) === t0);

  // CellDesigner: an added reactant's or product's own line, and a reaction's main reactant and product
  await open('glycolysis-celldesigner', 'cd:PROTEIN');
  var c0 = await now(), all = await es(), link = all.filter(function (e) { return /\|[rp]\d+$/.test(e); })[0], main = all.filter(function (e) { return /\|a$/.test(e); })[0];
  var rid = main.replace(/\|a$/, ''), st = function (id) { return page.evaluate(function (id) { return window.cd_make.stoichiometry(window.m2EditNow().text, id); }, id); };
  await pick(link);
  ok(link + ': Cardinality shown, empty', (await shown('card')) === '', await shown('card'));
  await type('card', '2');
  var cFit = await now();
  ok(link + ': written as its stoichiometry 2', (await st(link)) === '2', await st(link));
  ok(link + ': drawn 2', (await drawn(link)).indexOf('2') >= 0, JSON.stringify(await drawn(link)));
  await pick(main);
  var rows = await page.$$eval('.m2-ed-pcard input[data-line]', function (l) { return l.filter(function (f) { return !f.closest('[hidden]'); }).map(function (f) { return f.dataset.line; }); });
  var nlinks = all.filter(function (e) { return e.indexOf(rid + '|r') === 0 || e.indexOf(rid + '|p') === 0; }).length;
  ok(rid + ': one Cardinality row per reactant and product (' + (nlinks + 2) + '), named, the line row hidden', rows.length === nlinks + 2 && rows.indexOf(rid + '|a') === 0 && (await shown('card')) === null, JSON.stringify(rows));
  ok(rid + ': the added one set before shows 2', await page.$eval('.m2-ed-pcard input[data-line="' + link + '"]', function (f) { return f.value; }) === '2');
  var tc = async function (line, v) { var sel = '.m2-ed-pcard input[data-line="' + line + '"]'; await page.fill(sel, v); await page.press(sel, 'Enter'); await page.waitForTimeout(1200); };
  await tc(rid + '|a', '4');
  ok(rid + ': the main reactant written 4', (await st(rid + '|a')) === '4', await st(rid + '|a'));
  ok(rid + ': drawn 4 on its half', (await drawn(rid + '|a')).indexOf('4') >= 0, JSON.stringify(await drawn(rid + '|a')));
  await tc(rid + '|b', '0.5');
  ok(rid + ': the main product written 0.5', (await st(rid + '|b')) === '0.5', await st(rid + '|b'));
  await tc(rid + '|b', '-1');
  ok(rid + ': not above 0, nothing written', (await st(rid + '|b')) === '0.5');
  await tc(rid + '|b', '1');
  ok(rid + ': 1 writes nothing', (await st(rid + '|b')) === '');
  ok('CellDesigner: only stoichiometry attributes added since the first change (which fits the canvas)', (await now()).replace(/ stoichiometry="[^"]*"/g, '') === cFit.replace(/ stoichiometry="[^"]*"/g, ''));
  for (var v = 0; v < 4; v++) await undo();
  ok('CellDesigner: undone, the file as it was', (await now()) === c0);
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
