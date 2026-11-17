// The palette's Style and Colour scheme dropdowns (palDrop, editor/src/create.js) on a page with the editor, by default
// the styles page: on the Testing Glycolysis SBGN-ML map (its processes 10 by 10) and CellDesigner map, the two rows
// at the palette's end, From file chosen; a process and a macromolecule placed take the map's sizes; Style Default gives
// the built-in ones; the map's fill under From file; Colour scheme No colours leaves a new glyph unfilled. Nothing is saved (no token). No script error.
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
  var rows = function () { return page.$$eval('#m2-editwin .m2-ed-pcols', function (l) { return l.filter(function (x) { return !x.hidden; }).map(function (x) { return x.textContent.trim(); }); }); };
  var last = function () { return page.$eval('#m2-editwin .m2-ed-psigns', function (s) { var n = s.nextElementSibling, k = []; while (n) { if (!n.hidden && n.classList.contains('m2-ed-pcols')) k.push(n.textContent.trim()); n = n.nextElementSibling; } return k; }); };
  var made = async function (k, x, y) { var a = await ids(); await page.click('#m2-editwin button[data-make="' + k + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (i) { return a.indexOf(i) < 0; })[0]; };
  var pick = async function (row, name) { await page.click('#m2-editwin .m2-ed-pdrop-' + row + ' .m2-cs-box'); await page.waitForTimeout(200); await page.click('.m2-cs-menu button:has-text("' + name + '")'); await page.waitForTimeout(200); };
  var sbBox = function (id) { return page.evaluate(function (id) { var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml'), g = Array.from(d.getElementsByTagName('glyph')).filter(function (x) { return x.getAttribute('id') === id; })[0], bb = g && Array.from(g.children).filter(function (c) { return c.localName === 'bbox'; })[0]; return bb ? [+bb.getAttribute('w'), +bb.getAttribute('h')] : null; }, id); };
  var sbFill = function (id) { return page.evaluate(function (id) { var t = window.m2EditNow().text; return Array.from(new DOMParser().parseFromString(t, 'application/xml').getElementsByTagName('*')).filter(function (e) { return e.localName === 'style' && (' ' + (Array.from(e.attributes).filter(function (a) { return a.localName === 'idList'; }).map(function (a) { return a.value; })[0] || '') + ' ').indexOf(' ' + id + ' ') >= 0; }).map(function (e) { var g = e.firstElementChild, f = g && Array.from(g.attributes).filter(function (a) { return a.localName === 'fill'; })[0]; return f && f.value; }).filter(Boolean).pop() || null; }, id); };
  await page.goto(base, { waitUntil: 'load' }); await page.evaluate(function () { ['atlas-edit-style', 'atlas-edit-sb-colours', 'atlas-edit-cd-colours'].forEach(function (k) { localStorage.removeItem(k); }); });
  await start('testing-glycolysis-sbgn', 'process');
  var R = await last();
  ok('SBGN-ML: two dropdowns at the palette’s end, From file chosen', R.length === 2 && /^Colour scheme: From file/.test(R[0]) && /^Style: From file/.test(R[1]), JSON.stringify(R));
  var p = await made('process', 700, 450), m = await made('macromolecule', 700, 650);
  ok('a process placed takes the map’s 10 by 10', JSON.stringify(await sbBox(p)) === '[10,10]', JSON.stringify(await sbBox(p)));
  ok('a macromolecule placed takes the map’s 80 by 40', JSON.stringify(await sbBox(m)) === '[80,40]', JSON.stringify(await sbBox(m)));
  ok('and the map’s fill, #C2D4ED (Colour scheme From file)', String(await sbFill(m)).toUpperCase() === '#C2D4ED', String(await sbFill(m)));
  await pick('style', 'Default');
  var p2 = await made('process', 760, 450);
  ok('Style Default: the built-in process 18 by 18', JSON.stringify(await sbBox(p2)) === '[18,18]', JSON.stringify(await sbBox(p2)));
  await pick('cols', 'No colours');
  var m2 = await made('macromolecule', 900, 650);
  ok('Colour scheme No colours: a new macromolecule unfilled', !(await sbFill(m2)), String(await sbFill(m2)));
  ok('the boxes say the choices', JSON.stringify(await rows()) === JSON.stringify(['Colour scheme: No colours', 'Style: Default']), JSON.stringify(await rows()));
  await pick('style', 'From file'); await pick('cols', 'From file');
  await start('glycolysis-celldesigner', 'cd:PROTEIN');
  R = await last();
  ok('CellDesigner: the same two rows at the end, From file', R.length === 2 && /^Colour scheme: From file/.test(R[0]) && /^Style: From file/.test(R[1]), JSON.stringify(R));
  await page.click('#m2-editwin .m2-ed-pdrop-cols .m2-cs-box'); await page.waitForTimeout(200);
  var items = await page.$$eval('.m2-cs-menu button', function (l) { return l.map(function (x) { return x.querySelector('span').textContent; }); }); await page.keyboard.press('Escape');
  ok('its colour menu: From file, CellDesigner, Default, No colours', JSON.stringify(items) === JSON.stringify(['From file', 'CellDesigner', 'Default', 'No colours']), JSON.stringify(items));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
