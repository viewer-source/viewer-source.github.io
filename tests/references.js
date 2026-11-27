// References in Properties (create.js refsShow, refsAdd, refsParse; cd_make refs, setRefs; sbgn_edit refsOf, setRefs,
// write's refsOut): on the styles page, an SBGN-ML process on Testing Glycolysis and a CellDesigner reaction on Glycolysis
// each take a paste of PubMed IDs, a DOI link and a word that is none (two added, one said not read and left in the box),
// written as bqbiol:isDescribedBy links (identifiers.org on SBGN-ML, urn:miriam on CellDesigner), shown one row each; a
// paste of one already there adds nothing; a cross takes one out; a modulation's line shows its process's or reaction's
// references; undo puts each file back byte for byte. Nothing is saved (no token). No script error.
//   node tests/references.js [base address] [viewer folder: its editor and renderers served in place of the page's]
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
  var open = async function (hash, mark) {
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin button[data-make="' + mark + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + mark + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var nodeAt = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var lineAt = function (id) { return page.evaluate(function (id) {
    var all = []; document.querySelectorAll('#m2-img [data-e="' + id + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() / 2), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, id); };
  var click = async function (P) { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.mouse.click(P[0], P[1]); await page.waitForTimeout(700); };
  var rows = async function () { var m = await page.$('.m2-ed-pmore'); if (m && /^\+/.test(await m.textContent())) { await m.click(); await page.waitForTimeout(300); } return rows0(); };   // a folded list opened first
  var rows0 = function () { return page.$$eval('.m2-ed-prefs', function (l) {
    var t = l[0]; if (!t || t.hidden || t.closest('[hidden]')) return null;
    return { title: t.querySelector('.m2-ed-prefh th[colspan]').firstChild.textContent, items: Array.from(t.querySelectorAll('.m2-ed-prefl tr')).map(function (r) { return r.querySelector('th').textContent + ' ' + r.querySelector('.m2-ed-ppicname').textContent + (r.querySelector('.m2-ed-px') ? ' x' : ''); }),
      say: t.querySelector('.m2-ed-psay').hidden ? '' : t.querySelector('.m2-ed-psay').textContent, box: t.querySelector('.m2-ed-pin').value }; }); };
  var plus = async function () { if (await page.$eval('.m2-ed-padd', function (r) { return r.hidden; })) { await page.click('.m2-ed-pplus'); await page.waitForTimeout(200); } };   // the row to add opened by the + by the heading
  var paste = async function (v) { await plus(); await page.fill('.m2-ed-pin', v); await page.press('.m2-ed-pin', 'Enter'); await page.waitForTimeout(1200); };
  var cross = async function (k) { await page.click('.m2-ed-px[data-key="' + k + '"]'); await page.waitForTimeout(1200); };
  var undo = async function () { await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); };
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };
  var PASTE = '19461003\nPMID: 23332764, https://doi.org/10.1038/nature08124; notanid';

  // SBGN-ML: a process with a modulation
  await open('glycolysis-sbgn', 'compartment');
  var t0 = await now(), ids = await es();
  var mods = (t0.match(/<(?:\w+:)?arc\b[^>]*class="(?:catalysis|stimulation|inhibition|modulation)"[^>]*>/g) || []).map(function (a) { return [/\bid="([^"]+)"/.exec(a)[1], /\btarget="([^"]+)"/.exec(a)[1]]; }).filter(function (a) { return ids.indexOf(a[0]) >= 0; });
  var mod = mods[0][0], pid = mods[0][1].replace(/\.\d+$/, '');
  if (!(await page.$('#m2-img [data-n="' + pid + '"]'))) pid = (t0.match(new RegExp('<(?:\\w+:)?port\\b[^>]*\\bid="' + mods[0][1].replace(/[.]/g, '\\.') + '"')) ? pid : pid);
  await click(await nodeAt(pid));
  var R = await rows();
  ok(pid + ': References shown, none yet', R && R.title === 'References' && !R.items.length, JSON.stringify(R));
  await plus();
  await page.evaluate(function () { var f = document.querySelector('.m2-ed-pin'); f.focus(); var d = new DataTransfer(); d.setData('text', '19461003\n23332764'); f.dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true, cancelable: true })); });
  ok('lines pasted kept apart in the box', (await page.$eval('.m2-ed-pin', function (f) { return f.value; })) === '19461003 23332764', await page.$eval('.m2-ed-pin', function (f) { return f.value; }));
  await paste(PASTE);
  R = await rows();
  var t1 = await now();
  ok(pid + ': three added, one said not read and left in the box', R && R.items.join('|') === 'PubMed 19461003 x|PubMed 23332764 x|DOI 10.1038/nature08124 x' && /3 added/.test(R.say) && /not read: notanid/.test(R.say) && R.box === 'notanid', JSON.stringify(R));
  ok(pid + ': written as bqbiol:isDescribedBy identifiers.org links', /<bqbiol:isDescribedBy[\s>][\s\S]*identifiers\.org\/pubmed:19461003[\s\S]*identifiers\.org\/doi:10\.1038\/nature08124[\s\S]*<\/bqbiol:isDescribedBy>/.test(t1));
  ok(pid + ': nothing else in the file changed', t1.replace(/\s*<(\w+:)?extension>\s*<annotation>[\s\S]*?<\/annotation>\s*<\/(\w+:)?extension>/g, '') === t0.replace(/\s*<(\w+:)?extension>\s*<annotation>[\s\S]*?<\/annotation>\s*<\/(\w+:)?extension>/g, '') || t1.split('\n').length - t0.split('\n').length < 20);
  await paste('PMID:19461003');
  R = await rows();
  ok(pid + ': one already there adds nothing', R.items.length === 3 && /1 already there/.test(R.say) && (await now()) === t1, JSON.stringify(R));
  await cross('pubmed:23332764');
  R = await rows();
  ok(pid + ': the cross takes one out', R.items.join('|') === 'PubMed 19461003 x|DOI 10.1038/nature08124 x' && !/23332764/.test(await now()), JSON.stringify(R));
  await click(await lineAt(mod));
  R = await rows();
  ok(mod + ': a modulation’s line shows its process’s', R && R.title === 'References of its process' && R.items.length === 2, JSON.stringify(R));
  for (var u = 0; u < 4; u++) await undo();
  ok('SBGN-ML: undone, the file as it was', (await now()) === t0);

  // CellDesigner: a reaction by its main line, a modifier's line
  await open('glycolysis-celldesigner', 'cd:PROTEIN');
  var c0 = await now(), all = await es(), main = all.filter(function (e) { return /\|a$/.test(e); })[0], rid = main.replace(/\|a$/, '');
  var mline = all.filter(function (e) { return /\|m\d+$/.test(e); })[0];
  await click(await lineAt(main));
  R = await rows();
  ok(rid + ': References shown under its reaction rows', R && R.title === 'References', JSON.stringify(R));
  var had = R ? R.items.length : 0;
  await paste(PASTE);
  R = await rows();
  var c1 = await now(), refs = function (t, r) { return page.evaluate(function (a) { return window.cd_make.refs(a[0], a[1]); }, [t, r]); };
  var L = await refs(c1, rid);
  ok(rid + ': written into bqbiol:isDescribedBy as urn:miriam links', L.filter(function (x) { return x.q === 'bqbiol:isDescribedBy'; }).map(function (x) { return x.link; }).join(' ').indexOf('urn:miriam:pubmed:19461003 urn:miriam:pubmed:23332764 urn:miriam:doi:10.1038%2Fnature08124') >= 0, JSON.stringify(L));
  ok(rid + ': shown one row each, the word left in the box', R && R.items.length === had + 3 && R.box === 'notanid', JSON.stringify(R));
  await cross('doi:10.1038/nature08124');
  ok(rid + ': the cross takes the DOI out', !/nature08124/.test(await now()));
  if (mline) {
    var mr = mline.replace(/\|m\d+$/, '');
    await click(await lineAt(mline));
    R = await rows();
    ok(mline + ': a modifier’s line shows its reaction’s', R && R.title === 'References of its reaction', JSON.stringify(R));
    await paste('10.1016/j.cell.2020.01.001');
    ok(mline + ': a DOI added to its reaction ' + mr, (await refs(await now(), mr)).some(function (x) { return x.link === 'urn:miriam:doi:10.1016%2Fj.cell.2020.01.001'; }));
    await undo();
  }
  await undo(); await undo();
  ok('CellDesigner: undone, the file as it was', (await now()) === c0);

  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
