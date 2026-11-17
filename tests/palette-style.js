// The map's Style and Colours rows under the palette (palDrop, editor/src/create.js) on a page with the editor, by default
// the styles page: on the Testing Glycolysis SBGN-ML map (its processes 10 by 10) and CellDesigner map, the two rows
// under a line below the palette while nothing is selected (Properties in their place otherwise), From file chosen; the list
// opened in place and closed by a choice; a process and a macromolecule placed take the map's sizes; Style Default gives
// the built-in ones; the map's fill under From file; Colours No colours leaves a new glyph unfilled. Nothing is saved (no token). No script error.
//   node tests/palette-style.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var start = async function (h, sign) {
    await page.goto(base + '#' + h, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$('#m2-editwin button[data-make="' + sign + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + sign + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var rows = function () { return page.$$eval('#m2-editwin .m2-ed-pmap tr[data-k]', function (l) { return l.filter(function (x) { return x.offsetParent; }).map(function (x) { return x.firstChild.textContent + ': ' + x.querySelector('.m2-ed-pdd').textContent; }); }); };
  var last = function () { return page.evaluate(function () { var m = document.querySelector('#m2-editwin .m2-ed-pmap'), p = document.querySelector('#m2-editwin .m2-ed-palette'); return m && m.offsetParent && p.compareDocumentPosition(m) & 4 && getComputedStyle(m).borderTopStyle === 'solid' ? Array.from(m.querySelectorAll('tr[data-k]')).map(function (x) { return x.firstChild.textContent + ': ' + x.querySelector('.m2-ed-pdd').textContent; }) : []; }); };
  var hiddenWhileSelected = async function (id) { await page.mouse.click.apply(page.mouse, await page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })); await page.waitForTimeout(300); var v = await page.$eval('#m2-editwin .m2-ed-pmap', function (m) { return !m.offsetParent; }); await page.keyboard.press('Escape'); await page.mouse.click(1350, 880); await page.waitForTimeout(300); return v; };
  var made = async function (k, x, y) { var a = await ids(); await page.click('#m2-editwin button[data-make="' + k + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (i) { return a.indexOf(i) < 0; })[0]; };
  var pick = async function (row, name) { await page.keyboard.press('Escape'); await page.mouse.click(1350, 880); await page.waitForTimeout(300); await page.click('#m2-editwin .m2-ed-pmap tr[data-k="' + row + '"] .m2-ed-pdd'); await page.waitForTimeout(200); await page.click('#m2-editwin .m2-ed-plist button:has-text("' + name + '")'); await page.waitForTimeout(200); };
  var sbBox = function (id) { return page.evaluate(function (id) { var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml'), g = Array.from(d.getElementsByTagName('glyph')).filter(function (x) { return x.getAttribute('id') === id; })[0], bb = g && Array.from(g.children).filter(function (c) { return c.localName === 'bbox'; })[0]; return bb ? [+bb.getAttribute('w'), +bb.getAttribute('h')] : null; }, id); };
  var sbFill = function (id) { return page.evaluate(function (id) { var t = window.m2EditNow().text; return Array.from(new DOMParser().parseFromString(t, 'application/xml').getElementsByTagName('*')).filter(function (e) { return e.localName === 'style' && (' ' + (Array.from(e.attributes).filter(function (a) { return a.localName === 'idList'; }).map(function (a) { return a.value; })[0] || '') + ' ').indexOf(' ' + id + ' ') >= 0; }).map(function (e) { var g = e.firstElementChild, f = g && Array.from(g.attributes).filter(function (a) { return a.localName === 'fill'; })[0]; return f && f.value; }).filter(Boolean).pop() || null; }, id); };
  await page.goto(base, { waitUntil: 'load' }); await page.evaluate(function () { ['atlas-edit-style', 'atlas-edit-sb-colours', 'atlas-edit-cd-colours'].forEach(function (k) { localStorage.removeItem(k); }); });
  await start('testing-glycolysis-sbgn', 'process');
  var R = await last();
  ok('SBGN-ML: two rows under a line below the palette, From file chosen', R.length === 2 && /^Style: From file/.test(R[0]) && /^Colours: From file/.test(R[1]), JSON.stringify(R));
  var p = await made('process', 700, 450), m = await made('macromolecule', 700, 650);
  ok('a process placed takes the map’s 10 by 10', JSON.stringify(await sbBox(p)) === '[10,10]', JSON.stringify(await sbBox(p)));
  ok('a macromolecule placed takes the map’s 80 by 40', JSON.stringify(await sbBox(m)) === '[80,40]', JSON.stringify(await sbBox(m)));
  ok('and the map’s fill, #C2D4ED (Colours From file)', String(await sbFill(m)).toUpperCase() === '#C2D4ED', String(await sbFill(m)));
  ok('Properties in their place while a node is selected', await hiddenWhileSelected(m));
  await pick('style', 'Default');
  var p2 = await made('process', 760, 450);
  ok('Style Default: the built-in process 18 by 18', JSON.stringify(await sbBox(p2)) === '[18,18]', JSON.stringify(await sbBox(p2)));
  await pick('cols', 'No colours');
  var m2 = await made('macromolecule', 900, 650);
  ok('Colours No colours: a new macromolecule unfilled', !(await sbFill(m2)), String(await sbFill(m2)));
  ok('the boxes say the choices', JSON.stringify(await rows()) === JSON.stringify(['Style: Default', 'Colours: No colours']), JSON.stringify(await rows()));
  await pick('style', 'From file'); await pick('cols', 'From file');
  await start('glycolysis-celldesigner', 'cd:PROTEIN');
  R = await last();
  ok('CellDesigner: the same two rows, From file', R.length === 2 && /^Style: From file/.test(R[0]) && /^Colours: From file/.test(R[1]), JSON.stringify(R));
  await page.click('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd'); await page.waitForTimeout(200);
  var items = await page.$$eval('#m2-editwin .m2-ed-plist button', function (l) { return l.map(function (x) { return x.querySelector('span').textContent; }); });
  await page.click('#m2-editwin .m2-ed-plist button:has-text("From file")'); await page.waitForTimeout(200);
  ok('the list opens in place under its row and closes on a choice', items.length === 4 && !(await page.$('#m2-editwin .m2-ed-plist')));
  ok('its colour menu: From file, CellDesigner, Default, No colours', JSON.stringify(items) === JSON.stringify(['From file', 'CellDesigner', 'Default', 'No colours']), JSON.stringify(items));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
