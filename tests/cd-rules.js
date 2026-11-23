// The rules table (renderers/converter/notation.js) on a CellDesigner map, as drawing and dragging ask it there
// (editor/src/cdcreate.js cdSays, cdMoveSays): on the ACLY demo map a gene, three proteins and a phenotype are made, then
// a reaction between two proteins; a catalysis from the gene onto its square refused (SBGN: a nucleic acid feature is no
// catalyst, kept by default though CellDesigner holds it, notes/rules-audit.md), a stimulation from it taken, the same
// stimulation again refused (the line is there already); a
// reaction into the phenotype and one from it taken (CellDesigner's phenotype is a species); the reaction's product end
// dragged onto the third protein moves there, then onto the phenotype. Nothing is saved (no token).
//   node tests/cd-rules.js [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var url = process.argv[2] || 'https://viewer-source.github.io/styles/#acly-celldesigner', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var at = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var text = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var count = function (t, re) { return (t.match(re) || []).length; };
  var make = async function (kind, x, y) { var b4 = await ids(); await page.click('#m2-editwin button[data-make="' + kind + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await page.keyboard.press('Escape'); return (await ids()).filter(function (z) { return b4.indexOf(z) < 0 && !/\|/.test(z); })[0]; };
  var draw = async function (kind, A, B) {   // the sign taken for one line (a click), drawn from A to B
    await page.click('#m2-editwin button[data-make="' + kind + '"]');
    await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 8, A[1] + 20, { steps: 4 }); await page.mouse.move(B[0], B[1], { steps: 12 });
    await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(1200); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  };
  var lineAt = function (id, s) { return page.evaluate(function (a) {
    var all = []; document.querySelectorAll('#m2-img [data-e="' + a[0] + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0];
    if (!q) return null;
    var pt = q.getPointAtLength(q.getTotalLength() * a[1]), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, [id, s]); };
  var marks = function () { return page.$$eval('.m2-ed-bend', function (l) { return l.map(function (x) { var r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); }); };
  var dragEnd = async function (line, near, to) {   // the line selected, its end square nearest `near` dragged to `to`
    var m = [];
    for (var n = 0; n < 3 && !m.length; n++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); var mid = await lineAt(line, 0.4 + 0.1 * n); if (!mid) break; await page.mouse.click(mid[0], mid[1]); await page.waitForTimeout(600); m = await marks(); }
    if (!m.length) return false;
    var sq = m.sort(function (u, v) { return Math.hypot(u[0] - near[0], u[1] - near[1]) - Math.hypot(v[0] - near[0], v[1] - near[1]); })[0];
    await page.mouse.move(sq[0], sq[1]); await page.mouse.down(); await page.mouse.move(sq[0] + 10, sq[1] + 10, { steps: 4 }); await page.mouse.move(to[0], to[1], { steps: 12 });
    await page.waitForTimeout(200); await page.mouse.up(); await page.waitForTimeout(1500); await page.keyboard.press('Escape');
    return true;
  };
  var productOf = function (t, rid) { var r = t.match(new RegExp('<reaction\\b[^>]*\\bid="' + rid + '"[\\s\\S]*?</reaction>')); var p = r && r[0].match(/<celldesigner:baseProduct\b[^>]*\balias="([^"]+)"/); return p ? p[1] : null; };
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  if (!(await page.$('#m2-editwin button[data-make="cd:PROTEIN"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="cd:PROTEIN"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  var gene = await make('cd:GENE', 1000, 560), p1 = await make('cd:PROTEIN', 1000, 700), p2 = await make('cd:PROTEIN', 1250, 700);
  var ph = await make('cd:PHENOTYPE', 1250, 560), p3 = await make('cd:PROTEIN', 1120, 800);
  ok('a gene, three proteins and a phenotype made', [gene, p1, p2, ph, p3].every(Boolean), [gene, p1, p2, ph, p3].join(' '));
  var t0 = await text(), rx0 = count(t0, /<reaction\b/g);
  await draw('cd:STATE_TRANSITION', await at(p1), await at(p2));
  var t1 = await text(), rids = (t1.match(/<reaction\b[^>]*\bid="([^"]+)"/g) || []).map(function (s) { return s.match(/id="([^"]+)"/)[1]; });
  var rid = rids.filter(function (r) { return t0.indexOf('id="' + r + '"') < 0; })[0];
  ok('a reaction drawn between the two proteins', count(t1, /<reaction\b/g) === rx0 + 1 && !!rid, rid);
  var sq = await at(rid + '|proc'), m0 = count(t1, /<celldesigner:modification\b/g);
  await draw('cd:CATALYSIS', await at(gene), sq);
  var t2 = await text(), cat = function (t) { return count(t, /<celldesigner:modification\b[^>]*type="CATALYSIS"/g); };
  ok('a catalysis from the gene onto its square refused (SBGN: a nucleic acid feature is no catalyst)', count(t2, /<celldesigner:modification\b/g) === m0 && cat(t2) === cat(t1));
  await draw('cd:PHYSICAL_STIMULATION', await at(gene), sq);
  var t2b = await text();
  ok('a stimulation from the gene onto its square taken', count(t2b, /<celldesigner:modification\b/g) === m0 + 1);
  await draw('cd:PHYSICAL_STIMULATION', await at(gene), sq);
  var t3 = await text();
  ok('the same stimulation again refused (the line is there already)', count(t3, /<celldesigner:modification\b/g) === m0 + 1);
  await draw('cd:STATE_TRANSITION', await at(p1), await at(ph));
  var t4 = await text();
  ok('a reaction into the phenotype taken (a phenotype is a product in CellDesigner)', count(t4, /<reaction\b/g) === count(t3, /<reaction\b/g) + 1);
  await draw('cd:STATE_TRANSITION', await at(ph), await at(p3));
  var t5 = await text();
  ok('a reaction from the phenotype taken (a phenotype is a reactant in CellDesigner)', count(t5, /<reaction\b/g) === count(t4, /<reaction\b/g) + 1);
  var was = productOf(t5, rid);
  ok('the reaction’s product is the second protein', was === p2, was);
  var did = await dragEnd(rid + '|b', await at(p2), await at(p3));
  ok('its product end dragged onto the third protein: it moves there', did && productOf(await text(), rid) === p3, productOf(await text(), rid));
  did = await dragEnd(rid + '|b', await at(p3), await at(ph));
  ok('then onto the phenotype: it moves there (a phenotype is a product in CellDesigner)', did && productOf(await text(), rid) === ph, productOf(await text(), rid));
  ok('no script error', !errs.length, errs.join(' / '));
  console.log(bad ? bad + ' wrong' : 'all ok');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
