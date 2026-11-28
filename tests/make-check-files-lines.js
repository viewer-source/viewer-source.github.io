// Files with lines made in the editor, for checking by hand in the tools of their formats (as make-check-files.js):
// 1. CellDesigner (ACLY): two proteins joined by a state transition drawn from the handle, an AND gate from an RNA and
//    a gene onto its reaction, an inhibition from a third protein onto the reaction.
// 2. SBGN-ML (Testing Glycolysis): two macromolecules joined from the handle (a process made between them, with its
//    consumption and production), an inhibition from a third macromolecule onto the process.
//   node tests/make-check-files-lines.js <out folder> [base address] --data=<clone of the data repository>   (Testing Glycolysis from its test set, added as a person adds a file)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var args = process.argv.slice(2).filter(function (a) { return a.slice(0, 2) !== '--'; });
var out = args[0], base = args[1] || 'https://viewer-source.github.io/';
var OM = require('./lib/open-map.js');   // a map by its address, checked; a test-set map added from its file
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-n'); }))); }); };
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };
  var at = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var start = async function (h, sign) {
    await OM.open(page, base, h); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    if (!(await page.$('#m2-editwin button[data-make="' + sign + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + sign + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var sign = function (k) { return page.click('#m2-editwin button[data-make="' + k + '"]'); };
  var made = async function (k, x, y) { var a = await ids(); await sign(k); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (i) { return a.indexOf(i) < 0; })[0]; };
  var drag = async function (A, B) { await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 8, A[1] + 25, { steps: 4 }); await page.mouse.move(B[0], B[1], { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1200); };
  var line = async function (A, B, k) {   // a line drawn with its sign picked in the palette
    await page.keyboard.press('Escape'); await sign(k); await drag(A, B); await page.keyboard.press('Escape');
  };
  var text = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };

  await start('acly-celldesigner', 'cd:PROTEIN');
  var p = await made('cd:PROTEIN', 1150, 250), m = await made('cd:PROTEIN', 1150, 480), r = await made('cd:RNA', 1000, 180), g = await made('cd:GENE', 1300, 180);
  var e0 = await es(); await line(await at(p), await at(m), 'cd:STATE_TRANSITION');
  var rid = (await es()).filter(function (i) { return e0.indexOf(i) < 0; })[0].split('|')[0];
  await sign('cd:G_AND'); await page.mouse.click.apply(page.mouse, await at(r)); await page.waitForTimeout(200); await page.mouse.click.apply(page.mouse, await at(g)); await page.waitForTimeout(200);
  await page.mouse.click.apply(page.mouse, await at(rid + '|proc')); await page.waitForTimeout(1200);
  var q = await made('cd:PROTEIN', 1320, 380); await sign('cd:INHIBITION'); await drag(await at(q), await at(rid + '|proc'));
  var cd = await text();
  console.log('CellDesigner: reaction ' + rid + ', gate ' + /BOOLEAN_LOGIC_GATE_AND/.test(cd) + ', inhibition ' + /type="INHIBITION"/.test(cd));
  fs.writeFileSync(path.join(out, 'acly-celldesigner-lines-v01.xml'), cd);

  await start('testing-glycolysis-sbgn', 'macromolecule');
  var a = await made('macromolecule', 1050, 250), c = await made('macromolecule', 1300, 250), d = await made('macromolecule', 1175, 420);
  var n0 = await ids(); await line(await at(a), await at(c), 'consumption');
  var pr = (await ids()).filter(function (i) { return n0.indexOf(i) < 0; })[0];
  await sign('inhibition'); await drag(await at(d), await at(pr));
  var sb = await text();
  console.log('SBGN-ML: process ' + pr + ', arcs: ' + (sb.match(/class="(consumption|production|inhibition)"/g) || []).slice(-3).join(' '));
  fs.writeFileSync(path.join(out, 'testing-glycolysis-sbgn-lines-v01.sbgn'), sb);
  console.log(errs.length ? 'script errors: ' + errs.join(' | ') : 'no script error');
  await b.close();
})();
