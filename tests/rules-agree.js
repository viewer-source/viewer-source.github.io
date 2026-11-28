// Drawing and dragging against each other and against the rules table (plan 3 step 6): on Testing Glycolysis SBGN-ML,
// one node of every kind the palette makes and one line of every kind are made; then the editor's m2EditAsk puts each
// end of each line on every other node and asks dragging (core.js takes), drawing the same kind between the same two
// nodes (create.js linkKind) and the rules table (notation.js allowed) for each (the drag's counts without the moved line,
// drawing's with every line), with Reduced notation ticked, unticked, Strict SBGN ticked and on the AF tab. Where dragging or drawing differs
// from the table, the question is listed. Nothing is saved (no token).
//   node tests/rules-agree.js [address] [viewer folder: its editor and renderers served in place of the page's] [out.json]
// It lists and exits 0; with --check it exits 1 on any question answered differently: since drawing and dragging ask the
// table (plan 3 step 6, item 6) every question should agree, and tests/run-browser.sh runs it so.
var engine = require('playwright')[process.env.BROWSER || 'chromium'];
var NOISE = require('./lib/noise.js');   // what a browser reports that is no fault of the page
var args = process.argv.slice(2), check = args.indexOf('--check') >= 0; args = args.filter(function (a) { return a !== '--check'; });
var url = args[0] || 'https://viewer-source.github.io/#glycolysis-sbgn', local = args[1], out = args[2], fs = require('fs'), path = require('path');
(async function () {
  var b = await engine.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
    await page.route('**/renderers/yrender/yrender.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/yrender/yrender.js'), 'utf8') }); });
  }
  page.on('pageerror', function (e) { if (!NOISE.test(e.message)) errs.push(e.message); });
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var make = async function (kind, x, y) { var b4 = await ids(); await page.click('#m2-editwin button[data-make="' + kind + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (z) { return b4.indexOf(z) < 0; })[0]; };
  var line = async function (kind, s, t) {
    var A = await rect(s), B = await rect(t);
    await page.click('#m2-editwin button[data-make="' + kind + '"]');
    await page.mouse.move(A[0] + A[2] / 2, A[1] + A[3] / 2); await page.mouse.down(); await page.mouse.move(A[0] + A[2] / 2 + 8, A[1] + A[3] / 2 + 20, { steps: 4 });
    await page.mouse.move(B[0] + B[2] / 2, B[1] + B[3] / 2, { steps: 12 }); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
  };
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.removeItem('atlas-cd-compatible'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="submap"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(2000);
  var K = ['macromolecule', 'simple chemical', 'nucleic acid feature ct:gene', 'perturbing agent', 'source and sink', 'process', 'phenotype',
           'submap', 'tag', 'and', 'not', 'equivalence', 'macromolecule', 'process'], N = [];
  for (var i = 0; i < K.length; i++) N.push(await make(K[i], 840 + (i % 4) * 140, 390 + Math.floor(i / 4) * 125));
  var M = N[0], SC = N[1], P = N[5], AND = N[9], NOT = N[10], EQ = N[11], M2 = N[12], P2 = N[13], TG = N[8];
  await line('consumption', SC, P); await line('production', P, M2); await line('catalysis', M, P);
  for (var k of ['stimulation', 'inhibition', 'modulation', 'necessary stimulation']) await line(k, M, P2);
  await line('consumption', M, AND); await line('stimulation', AND, P2); await line('consumption', M2, NOT);
  await line('consumption', M, EQ); await line('consumption', M2, EQ); await line('consumption', EQ, SC); await line('consumption', TG, M);
  await line('stimulation', M, SC);   // reduced notation: a modulation onto an entity
  var plain = { consumption: 1, 'logic arc': 1, 'equivalence arc': 1 }, all = {}, n = 0, bad = 0;
  for (var mode of [{ lang: 'pd' }, { lang: 'pd', strict: true }, { lang: 'pd', sbgn: true }, { lang: 'af' }]) {
    var rows = await page.evaluate(function (o) { return window.m2EditAsk(o); }, mode) || [];
    var name = mode.lang === 'af' ? 'AF' : mode.sbgn ? 'PD, Strict SBGN' : mode.strict ? 'PD, Reduced notation unticked' : 'PD, Reduced notation ticked';
    var diff = rows.filter(function (r) {
      r.drawOk = r.draw === r.now || !!(plain[r.draw] && plain[r.now]);
      r.dragTable = r.tableDrag === null; r.drawTable = r.tableDraw === null;
      return r.drag !== r.dragTable || r.drawOk !== r.drawTable;
    });
    n += rows.length; bad += diff.length;
    all[name] = { asked: rows.length, differ: diff };
    console.log(name + ': ' + rows.length + ' questions, ' + diff.length + ' answered differently');
    diff.forEach(function (r) {
      console.log('  ' + r.arc + ' (' + r.line + '), its ' + r.end + ' end onto ' + (r.end === 'target' ? r.to : r.from) + (r.now !== r.arc ? ' (then a ' + r.now + ')' : '') + ': ' +
        'drag ' + (r.drag ? 'yes' : 'no') + ' / table ' + (r.dragTable ? 'yes' : 'no (' + r.tableDrag + ')') + '; draw ' + (r.drawOk ? 'yes' : 'no (' + r.draw + ')') + ' / table ' + (r.drawTable ? 'yes' : 'no (' + r.tableDraw + ')'));
    });
  }
  if (out) fs.writeFileSync(out, JSON.stringify(all, null, 1));
  if (errs.length) console.log('script errors: ' + errs.join(' / '));
  console.log(N.filter(Boolean).length + ' of ' + K.length + ' nodes made; ' + n + ' questions, ' + bad + ' answered differently');
  await b.close();
  process.exit(errs.length || (check && bad) || N.filter(Boolean).length !== K.length ? 1 : 0);
})();
