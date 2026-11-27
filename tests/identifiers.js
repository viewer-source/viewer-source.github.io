// Identifiers in Properties (create.js refsShow, refsAdd, refsParse with ID_DBS; cd_make idsOf, setIds; sbgn_edit idsOf,
// setIds, write's idsOut): on the styles page, on Testing Glycolysis (SBGN-ML) a simple chemical takes ChEBI IDs in any
// form and refuses a UniProt one (said not read, left in the box), a macromolecule takes a UniProt ID and an HGNC one,
// written as bqbiol:is identifiers.org links as the converter writes them; on Glycolysis (CellDesigner) a protein takes a
// UniProt page's link and an HGNC number, a simple molecule a ChEBI ID, written under bqbiol:is with CellDesigner's
// namespaces (urn:miriam:uniprot, hgnc, obo.chebi). A paste of one already there adds nothing; a cross takes one out; the
// box's hint names the item's databases; a reaction still shows References. Undo puts each file back byte for byte.
// Nothing is saved (no token). No script error.
//   node tests/identifiers.js [base address] [viewer folder: its editor and renderers served in place of the page's]
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
  var rows = function () { return page.$$eval('.m2-ed-prefs', function (l) {
    var t = l[0]; if (!t || t.hidden || t.closest('[hidden]')) return null;
    return { title: t.querySelector('.m2-ed-prefl th[colspan]').textContent, items: Array.from(t.querySelectorAll('.m2-ed-prefl tr')).slice(1).map(function (r) { return r.querySelector('th').textContent + ' ' + r.querySelector('.m2-ed-ppicname').textContent + (r.querySelector('.m2-ed-px') ? ' x' : ''); }),
      say: t.querySelector('.m2-ed-psay').hidden ? '' : t.querySelector('.m2-ed-psay').textContent, box: t.querySelector('.m2-ed-pin').value }; }); };
  var paste = async function (v) { await page.fill('.m2-ed-pin', v); await page.press('.m2-ed-pin', 'Enter'); await page.waitForTimeout(1200); };
  var cross = async function (k) { await page.click('.m2-ed-px[data-key="' + k + '"]'); await page.waitForTimeout(1200); };
  var undo = async function () { await page.mouse.click(10, 880); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); };
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };
  var glyphs = function (t, cls) { var re = new RegExp('<(?:\\w+:)?glyph\\b[^>]*class="' + cls + '"[^>]*>', 'g'); return (t.match(re) || []).map(function (g) { return /\bid="([^"]+)"/.exec(g)[1]; }); };
  var shown = function (id) { return page.$('#m2-img [data-n="' + id + '"]').then(function (h) { return !!h; }); };
  var first = async function (l) { for (var k = 0; k < l.length; k++) if (await shown(l[k])) return l[k]; return null; };
  var hint = function () { return page.$eval('.m2-ed-pin', function (f) { return f.placeholder; }); };

  // SBGN-ML: a simple chemical and a macromolecule
  await open('glycolysis-sbgn', 'compartment');
  var t0 = await now(), chem = await first(glyphs(t0, 'simple chemical')), mac = await first(glyphs(t0, 'macromolecule'));
  await click(await nodeAt(chem));
  var R = await rows(), had = R ? R.items.length : -1;
  ok(chem + ': Identifiers shown, the hint naming ChEBI', R && R.title === 'Identifiers' && (await hint()) === 'ChEBI IDs or links', JSON.stringify(R) + ' ' + (await hint()));
  await paste('CHEBI:15346, https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:17234 Q15831');
  R = await rows();
  var t1 = await now();
  ok(chem + ': two ChEBI added, the UniProt one not read and left in the box', R && R.items.length === had + 2 && /2 added/.test(R.say) && /not read: Q15831 \(ChEBI is digits/.test(R.say) && R.box === 'Q15831', JSON.stringify(R));
  ok(chem + ': written under bqbiol:is as the converter writes ChEBI', /<bqbiol:is[\s>][\s\S]*identifiers\.org\/CHEBI:15346[\s\S]*identifiers\.org\/CHEBI:17234[\s\S]*<\/bqbiol:is>/.test(t1));
  ok(chem + ': shown with a cross each', R && R.items.indexOf('ChEBI CHEBI:15346 x') >= 0 && R.items.indexOf('ChEBI CHEBI:17234 x') >= 0, JSON.stringify(R));
  await paste('15346');
  R = await rows();
  ok(chem + ': a plain number already there adds nothing', /1 already there/.test(R.say) && (await now()) === t1, JSON.stringify(R));
  await cross('chebi:CHEBI:17234');
  R = await rows();
  ok(chem + ': the cross takes one out', R.items.indexOf('ChEBI CHEBI:17234 x') < 0 && !/CHEBI:17234/.test(await now()), JSON.stringify(R));
  await click(await nodeAt(mac));
  R = await rows();
  ok(mac + ': the box empty again, its hint UniProt or HGNC', R && R.box === '' && (await hint()) === 'UniProt or HGNC IDs or links', JSON.stringify(R));
  had = R.items.length;
  await paste('uniprot:P53396 HGNC:115');
  R = await rows();
  var t2 = await now();
  ok(mac + ': UniProt and HGNC added', R && R.items.length === had + 2 && /identifiers\.org\/uniprot:P53396/.test(t2) && /identifiers\.org\/hgnc:115"/.test(t2), JSON.stringify(R));
  for (var u = 0; u < 3; u++) await undo();
  ok('SBGN-ML: undone, the file as it was', (await now()) === t0);

  // CellDesigner: a protein and a simple molecule; a reaction still shows References
  await open('glycolysis-celldesigner', 'cd:PROTEIN');
  var c0 = await now(), nodes = await page.$$eval('#m2-img [data-n]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-n'); }))); });
  var info = await page.evaluate(function (a) { return a[1].map(function (id) { try { return [id, window.cd_make.idsOf(a[0], id).cls]; } catch (e) { return [id, null]; } }); }, [c0, nodes]);
  var prot = (info.filter(function (x) { return x[1] === 'PROTEIN'; })[0] || [])[0], mol = (info.filter(function (x) { return x[1] === 'SIMPLE_MOLECULE'; })[0] || [])[0];
  var cdIds = function (t, id) { return page.evaluate(function (a) { return window.cd_make.idsOf(a[0], a[1]).links.filter(function (x) { return x.q === 'bqbiol:is'; }).map(function (x) { return x.link; }); }, [t, id]); };
  await click(await nodeAt(prot));
  R = await rows();
  ok(prot + ': Identifiers shown for a protein', R && R.title === 'Identifiers' && (await hint()) === 'UniProt or HGNC IDs or links', JSON.stringify(R));
  had = R ? R.items.length : 0;
  await paste('https://www.uniprot.org/uniprotkb/Q15831/entry 11389');
  R = await rows();
  var L = await cdIds(await now(), prot);
  ok(prot + ': written under bqbiol:is as CellDesigner names them', L.indexOf('urn:miriam:uniprot:Q15831') >= 0 && L.indexOf('urn:miriam:hgnc:11389') >= 0 && R.items.length === had + 2, JSON.stringify(L) + ' ' + JSON.stringify(R));
  await cross('hgnc:11389');
  ok(prot + ': the cross takes HGNC out', (await cdIds(await now(), prot)).indexOf('urn:miriam:hgnc:11389') < 0);
  if (mol) {
    await click(await nodeAt(mol));
    await paste('chebi:15346');
    ok(mol + ': ChEBI written as obo.chebi with its prefix', (await cdIds(await now(), mol)).indexOf('urn:miriam:obo.chebi:CHEBI%3A15346') >= 0);
    await undo();
  }
  await undo(); await undo();
  ok('CellDesigner: undone, the file as it was', (await now()) === c0);
  var main = (await es()).filter(function (e) { return /\|a$/.test(e); })[0];
  await click(await lineAt(main));
  R = await rows();
  ok('a reaction still shows References, its hint PubMed and DOI', R && R.title === 'References' && (await hint()) === 'PubMed IDs, DOIs or links', JSON.stringify(R));

  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
