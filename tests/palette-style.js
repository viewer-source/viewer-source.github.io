// The map's Style and Colours rows under the palette (palDrop, editor/src/create.js) on a page with the editor, by default
// the styles page: on the Testing Glycolysis SBGN-ML map (its processes 10 by 10) and CellDesigner map, the two rows
// under a line below the palette while nothing is selected (Properties in their place otherwise), From file chosen; the list
// a small window under its field (above it with no room below) and closed by a choice; a process and a macromolecule placed take the map's sizes; Style Default gives
// the built-in ones; the map's fill under From file; Colours No colours leaves a new glyph unfilled; Custom takes what Set as default kept, as it is, and Set as default
// switches both rows to it; on a CellDesigner map the same with its own kept looks (by species class) and its own Colours.
// Nothing is saved (no token). No script error.
//   node tests/palette-style.js [base address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {   // the editor as Jekyll builds it (editor.js with its sources put in), from a working tree
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var start = async function (h, sign) {
    await page.goto(base + '#' + h, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$('#m2-editwin button[data-make="' + sign + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + sign + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var rows = function () { return page.$$eval('#m2-editwin .m2-ed-pmap tr[data-k]', function (l) { return l.filter(function (x) { return x.offsetParent; }).map(function (x) { return x.firstChild.textContent + ': ' + x.querySelector('.m2-ed-pdd').textContent; }); }); };
  var last = function () { return page.evaluate(function () { var m = document.querySelector('#m2-editwin .m2-ed-pmap'), p = document.querySelector('#m2-editwin .m2-ed-palette'); return m && m.offsetParent && p.compareDocumentPosition(m) & 4 && getComputedStyle(p).borderBottomStyle === 'solid' ? Array.from(m.querySelectorAll('tr[data-k]')).map(function (x) { return x.firstChild.textContent + ': ' + x.querySelector('.m2-ed-pdd').textContent; }) : []; }); };
  var hiddenWhileSelected = async function (id) { await page.mouse.click.apply(page.mouse, await page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })); await page.waitForTimeout(300); var v = await page.$eval('#m2-editwin .m2-ed-pmap', function (m) { return !m.offsetParent; }); await page.keyboard.press('Escape'); await page.mouse.click(1350, 880); await page.waitForTimeout(300); return v; };
  var made = async function (k, x, y) { var a = await ids(); await page.click('#m2-editwin button[data-make="' + k + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (i) { return a.indexOf(i) < 0; })[0]; };
  var pick = async function (row, name) { await page.keyboard.press('Escape'); await page.mouse.click(1350, 880); await page.waitForTimeout(300); await page.click('#m2-editwin .m2-ed-pmap tr[data-k="' + row + '"] .m2-ed-pdd'); await page.waitForTimeout(200); await page.click('body > .m2-ed-pdl button:has-text("' + name + '")'); await page.waitForTimeout(200); };
  var sbBox = function (id) { return page.evaluate(function (id) { var d = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml'), g = Array.from(d.getElementsByTagName('glyph')).filter(function (x) { return x.getAttribute('id') === id; })[0], bb = g && Array.from(g.children).filter(function (c) { return c.localName === 'bbox'; })[0]; return bb ? [+bb.getAttribute('w'), +bb.getAttribute('h')] : null; }, id); };
  var sbFill = function (id) { return page.evaluate(function (id) { var t = window.m2EditNow().text; return Array.from(new DOMParser().parseFromString(t, 'application/xml').getElementsByTagName('*')).filter(function (e) { return e.localName === 'style' && (' ' + (Array.from(e.attributes).filter(function (a) { return a.localName === 'idList'; }).map(function (a) { return a.value; })[0] || '') + ' ').indexOf(' ' + id + ' ') >= 0; }).map(function (e) { var g = e.firstElementChild, f = g && Array.from(g.attributes).filter(function (a) { return a.localName === 'fill'; })[0]; return f && f.value; }).filter(Boolean).pop() || null; }, id); };
  await page.goto(base, { waitUntil: 'load' }); await page.evaluate(function () { ['atlas-edit-map-choices', 'atlas-edit-defaults', 'atlas-edit-cd-defaults'].forEach(function (k) { localStorage.removeItem(k); }); });
  await start('testing-glycolysis-sbgn', 'process');
  var R = await last();
  ok('SBGN-ML: two rows under a line below the palette, From file chosen', R.length === 2 && /^Style: From file/.test(R[0]) && /^Colours: From file/.test(R[1]), JSON.stringify(R));
  var p = await made('process', 700, 450), m = await made('macromolecule', 700, 650);
  ok('a process placed takes the map’s 10 by 10', JSON.stringify(await sbBox(p)) === '[10,10]', JSON.stringify(await sbBox(p)));
  ok('a macromolecule placed takes the map’s 80 by 40', JSON.stringify(await sbBox(m)) === '[80,40]', JSON.stringify(await sbBox(m)));
  ok('and the map’s fill, #C2D4ED (Colours From file)', String(await sbFill(m)).toUpperCase() === '#C2D4ED', String(await sbFill(m)));
  ok('Properties in their place while a node is selected', await hiddenWhileSelected(m));
  ok('hidden while a process is selected too', await hiddenWhileSelected(p));
  await page.click('#m2-editwin button[data-make="macromolecule"]'); await page.click('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd'); await page.waitForTimeout(200); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('Escape closes the list and keeps the tool in hand', !(await page.$('body > .m2-ed-pdl')) && (await page.$eval('#m2-editwin button[data-make="macromolecule"]', function (b) { return b.getAttribute('aria-pressed'); })) === 'true');
  await page.keyboard.press('Escape');
  await pick('style', 'Default');
  var p2 = await made('process', 760, 450);
  ok('Style Default: the built-in process 18 by 18', JSON.stringify(await sbBox(p2)) === '[18,18]', JSON.stringify(await sbBox(p2)));
  await pick('cols', 'No colours');
  var m2 = await made('macromolecule', 900, 650);
  ok('Colours No colours: a new macromolecule unfilled', !(await sbFill(m2)), String(await sbFill(m2)));
  ok('the boxes say the choices', JSON.stringify(await rows()) === JSON.stringify(['Style: Default', 'Colours: No colours']), JSON.stringify(await rows()));
  await pick('style', 'From file'); await pick('cols', 'From file');
  // Custom: Set as default keeps the node's look as it is and switches both rows to Custom; a kind with none kept takes From file
  await page.evaluate(function () { localStorage.setItem('atlas-edit-defaults', JSON.stringify({ macromolecule: { w: 120, h: 60, fill: '#123456' }, complex: { w: 300, h: 300, fill: '#ABCDEF' }, 'simple chemical': { wr: 2, hr: 2, fill: '#FEDCBA' } })); });
  await pick('style', 'Custom'); await pick('cols', 'Custom');
  var m3 = await made('macromolecule', 1000, 650), p3 = await made('process', 820, 450);
  ok('Custom: a macromolecule at the kept 120 by 60, not a share of another size', JSON.stringify(await sbBox(m3)) === '[120,60]', JSON.stringify(await sbBox(m3)));
  ok('and the kept fill #123456', String(await sbFill(m3)).toUpperCase() === '#123456', String(await sbFill(m3)));
  var c3 = await made('simple chemical', 1150, 650);
  ok('a look kept the old way (a share of a size) left out: a simple chemical not #FEDCBA', String(await sbFill(c3)).toUpperCase() !== '#FEDCBA', String(await sbFill(c3)));
  ok('a process, none kept: the map’s 10 by 10', JSON.stringify(await sbBox(p3)) === '[10,10]', JSON.stringify(await sbBox(p3)));
  await pick('style', 'From file'); await pick('cols', 'From file');
  await page.mouse.click.apply(page.mouse, await page.$eval('#m2-img [data-n="' + m + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })); await page.waitForTimeout(400);
  await page.click('#m2-editwin .m2-ed-pdef'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.mouse.click(1350, 880); await page.waitForTimeout(400);
  var kept = await page.evaluate(function () { return JSON.parse(localStorage.getItem('atlas-edit-defaults')).macromolecule; });
  ok('Set as default keeps the node as it is (80 by 40, #C2D4ED)', kept.w === 80 && kept.h === 40 && String(kept.fill).toUpperCase() === '#C2D4ED', JSON.stringify(kept));
  ok('and switches both rows to Custom', JSON.stringify(await rows()) === JSON.stringify(['Style: Custom', 'Colours: Custom']), JSON.stringify(await rows()));
  await start('glycolysis-celldesigner', 'cd:PROTEIN');
  var cdLook = function (id) { return page.evaluate(function (id) { var t = window.m2EditNow().text, L = window.cd_make.look(t, id), A = window.cd_make.aliasInfo(t, id); return { w: A.box[2], h: A.box[3], fill: L.fill, width: L.width, multimer: L.multimer }; }, id); };
  R = await last();
  ok('CellDesigner: the same two rows, Style Custom (shared) and its own Colours From file', R.length === 2 && /^Style: Custom/.test(R[0]) && /^Colours: From file/.test(R[1]), JSON.stringify(R));
  await page.click('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd'); await page.waitForTimeout(200);
  var items = await page.$$eval('body > .m2-ed-pdl button', function (l) { return l.map(function (x) { return x.querySelector('span').textContent; }); });
  var place = function () { return page.evaluate(function () { var f = document.querySelector('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd').getBoundingClientRect(), w = document.querySelector('body > .m2-ed-pdl').getBoundingClientRect(); return { below: w.top >= f.bottom, above: w.bottom <= f.top, wide: w.width >= f.width - 1, left: Math.abs(w.left - f.left) < 1, inside: w.bottom <= innerHeight && w.top >= 0 }; }); };
  var P = await place();
  ok('the list a window under its field, at least its width, its left edge on the field\u2019s', P.below && P.wide && P.left, JSON.stringify(P));
  await page.click('body > .m2-ed-pdl button:has-text("From file")'); await page.waitForTimeout(200);
  ok('the list opens as a window by its field and closes on a choice', items.length === 6 && !(await page.$('body > .m2-ed-pdl')));
  var fb = await page.$eval('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd', function (f) { return f.getBoundingClientRect().bottom; });
  await page.setViewportSize({ width: 1400, height: Math.ceil(fb) + 40 }); await page.waitForTimeout(300);
  await page.click('#m2-editwin .m2-ed-pmap tr[data-k="cols"] .m2-ed-pdd'); await page.waitForTimeout(200);
  P = await place();
  ok('with no room below, the list opens above its field, inside the window', P.above && P.inside, JSON.stringify(P));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  ok('Escape closes it', !(await page.$('body > .m2-ed-pdl')));
  await page.setViewportSize({ width: 1400, height: 900 }); await page.waitForTimeout(300);
  ok('its colour menu: From file, CellDesigner, Default, No colours, Custom, Confetti', JSON.stringify(items) === JSON.stringify(['From file', 'CellDesigner', 'Default', 'No colours', 'Custom', 'Confetti']), JSON.stringify(items));
  var c1 = await made('cd:PROTEIN', 700, 450), L1 = await cdLook(c1);
  ok('a protein placed, none kept for proteins: the map’s size (Custom reads as From file)', L1.w > 0 && L1.h > 0, JSON.stringify(L1));
  var sel = async function (id) { await page.mouse.click.apply(page.mouse, await page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })); await page.waitForTimeout(400); };
  var put = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(500); };
  await sel(c1); await put('w', '120'); await put('h', '60'); await put('fill', '#abcdef'); await put('width', '3'); await page.check('#m2-ed-multimer'); await page.waitForTimeout(500);
  ok('Set as default shown in its Properties', await page.$eval('#m2-editwin .m2-ed-pdef', function (x) { return !x.hidden && !!x.offsetParent; }));
  await page.click('#m2-editwin .m2-ed-pdef'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.mouse.click(1350, 880); await page.waitForTimeout(400);
  var ck = await page.evaluate(function () { return JSON.parse(localStorage.getItem('atlas-edit-cd-defaults')).PROTEIN; });
  ok('Set as default keeps the protein as it is (126 by 66 with its second copy, #abcdef, border 3, multimer)', ck.w === 126 && ck.h === 66 && ck.fill === '#abcdef' && ck.width === 3 && ck.multimer === true, JSON.stringify(ck));
  ok('and switches both rows to Custom', JSON.stringify(await rows()) === JSON.stringify(['Style: Custom', 'Colours: Custom']), JSON.stringify(await rows()));
  var c2 = await made('cd:PROTEIN', 700, 650), L2 = await cdLook(c2);
  ok('the next protein comes so', L2.w === 126 && L2.h === 66 && L2.fill === '#abcdef' && L2.width === 3 && L2.multimer === true, JSON.stringify(L2));
  var g1 = await made('cd:GENE', 500, 650), G1 = await cdLook(g1);
  ok('a gene, none kept for genes: From file, no border or multimer from the protein', G1.fill !== '#abcdef' && G1.width === 1 && !G1.multimer, JSON.stringify(G1));
  await pick('cols', 'From file');
  var c3 = await made('cd:PROTEIN', 500, 450), L3 = await cdLook(c3);
  ok('Colours From file, Style Custom: the kept size and multimer, the map’s colour and border', L3.w === 126 && L3.h === 66 && L3.fill !== '#abcdef' && L3.width === 1 && L3.multimer === true, JSON.stringify(L3));
  await page.evaluate(function () { var a = JSON.parse(localStorage.getItem('atlas-edit-cd-defaults')); a.PROTEIN.copies = 3; a.PROTEIN.w = 132; a.PROTEIN.h = 72; localStorage.setItem('atlas-edit-cd-defaults', JSON.stringify(a)); });
  var c4 = await made('cd:PROTEIN', 900, 450), L4 = await page.evaluate(function (id) { var A = window.cd_make.aliasInfo(window.m2EditNow().text, id); return { box: A.box, n: A.homodimer }; }, c4);
  ok('a multimer of 3 kept: the same box and count, centred where clicked', L4.box[2] === 132 && L4.box[3] === 72 && L4.n === 3, JSON.stringify(L4));
  await pick('style', 'From file');
  await start('testing-glycolysis-sbgn', 'process');
  ok('Style From file chosen on a CellDesigner map is the SBGN-ML map’s too, its Colours its own', JSON.stringify(await rows()) === JSON.stringify(['Style: From file', 'Colours: Custom']), JSON.stringify(await rows()));
  await page.evaluate(function () { ['atlas-edit-map-choices', 'atlas-edit-defaults', 'atlas-edit-cd-defaults'].forEach(function (k) { localStorage.removeItem(k); }); });
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
