// One HGNC symbol added to a protein with no name names it (create.js refsAdd): on the root page, on Testing
// Glycolysis (SBGN-ML) and Glycolysis (CellDesigner) a protein placed from the palette and left unnamed takes the
// symbol PDPK1 as its name too; a second symbol leaves the name; two symbols pasted at once on another unnamed protein
// name nothing; a molecule is never named by an identifier. Nothing is saved (no token). No script error.
//   node tests/ann-name.js [base address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-n'); }))); }); };
  var at = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var open = async function (hash, mark) {
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin button[data-make="' + mark + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + mark + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var place = async function (mark, x, y) {   // a glyph from the palette at an empty spot, its name box left empty
    var was = await ids();
    await page.click('#m2-editwin button[data-make="' + mark + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(800);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    return (await ids()).filter(function (i) { return was.indexOf(i) < 0; })[0];
  };
  var pick = async function (id) { var p = await at(id); await page.keyboard.press('Escape'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(700); };
  var paste = async function (v) {
    if (await page.$eval('.m2-ed-padd', function (r) { return r.hidden; })) { await page.click('.m2-ed-pplus'); await page.waitForTimeout(200); }
    await page.fill('.m2-ed-pin', v); await page.press('.m2-ed-pin', 'Enter'); await page.waitForTimeout(1200);
  };
  var formats = [
    { hash: 'glycolysis-sbgn', protein: 'macromolecule', molecule: 'simple chemical', name: function (t, id) { var g = new DOMParser().parseFromString(t, 'application/xml').querySelector('glyph[id="' + id + '"] > label'); return g ? g.getAttribute('text') : ''; } },
    { hash: 'glycolysis-celldesigner', protein: 'cd:PROTEIN', molecule: 'cd:SIMPLE_MOLECULE', name: function (t, id) { var a = window.cd_make.aliasInfo(t, id); return a.name && a.name !== a.id ? a.name : ''; } }   // a species made unnamed keeps its id as its name in the file
  ];
  for (var f of formats) {
    await open(f.hash, f.protein);
    var nameOf = function (id) { return page.evaluate(function (a) { return (new Function('return ' + a[0]))()(window.m2EditNow().text, a[1]); }, [f.name.toString(), id]); };
    var p1 = await place(f.protein, 1250, 820);
    ok(f.hash + ': a protein placed, no name', p1 && (await nameOf(p1)) === '', p1 + ' ' + (p1 && await nameOf(p1)));
    if (!p1) continue;
    await pick(p1); await paste('P04637');
    ok(f.hash + ': a UniProt accession with HGNC symbol chosen: not added, not named, said', (await nameOf(p1)) === '' && /P04637 reads as UniProt: choose UniProt/.test(await page.$eval('.m2-ed-psay', function (e) { return e.textContent; })) && (await page.$eval('.m2-ed-pin', function (f) { return document.activeElement === f && f.value; })) === 'P04637');
    await page.fill('.m2-ed-pin', ''); await page.keyboard.press('Escape');
    var tn = await page.evaluate(function () { return window.m2EditNow().text; });
    await pick(p1); await paste('PDPK1');
    ok(f.hash + ': one symbol names it', (await nameOf(p1)) === 'PDPK1', await nameOf(p1));
    await page.keyboard.press('Escape'); await page.mouse.click(700, 120); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200);
    ok(f.hash + ': one undo takes the symbol and the name back together', (await page.evaluate(function () { return window.m2EditNow().text; })) === tn);
    await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(1200);
    await pick(p1); await paste('PDPK2P');
    ok(f.hash + ': a second symbol leaves the name', (await nameOf(p1)) === 'PDPK1', await nameOf(p1));
    var p2 = await place(f.protein, 1150, 820);
    await pick(p2); await paste('AKT1 AKT2');
    ok(f.hash + ': two symbols at once name nothing', (await nameOf(p2)) === '', await nameOf(p2));
    var m1 = await place(f.molecule, 1050, 820);
    if (m1) { await pick(m1); await paste('15346'); ok(f.hash + ': a molecule given an identifier stays unnamed', (await nameOf(m1)) === '', await nameOf(m1)); }
  }
  ok('no script error', !errs.length, errs.join(' | '));
  console.log(bad ? bad + ' WRONG' : 'all ok');
  await b.close(); process.exit(bad ? 1 : 0);
})();
