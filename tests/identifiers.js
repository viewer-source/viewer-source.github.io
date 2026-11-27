// Identifiers in Properties (create.js refsShow, refsAdd, refsParse with ID_DBS; cd_make idsOf, setIds; sbgn_edit idsOf,
// setIds, write's idsOut): on the styles page, on Testing Glycolysis (SBGN-ML) a simple chemical takes ChEBI IDs in any
// form and refuses a UniProt one (said not read, left in the box), a macromolecule takes a UniProt ID and an HGNC one,
// written as bqbiol:is identifiers.org links as the converter writes them; on Glycolysis (CellDesigner) a protein takes a
// UniProt page's link and an HGNC number, a simple molecule a ChEBI ID, written under bqbiol:is with CellDesigner's
// namespaces (urn:miriam:uniprot, hgnc, obo.chebi). A paste of one already there adds nothing; a cross takes one out; the
// list before the box offers the item's databases, the first chosen, a plain value read as the one chosen (one of another
// said with the database it fits; choosing it and Enter adds it); a reaction still shows References. Undo puts each file back byte for byte.
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
    await page.route(base.replace(/[#?].*$/, ''), async function (r) {   // the page's styles as in the folder (its main style block)
      var res = await r.fetch(), html = await res.text(), css = (fs.readFileSync(path.join(local, '_includes/atlas-app.html'), 'utf8').match(/<style>\n[\s\S]*?<\/style>/) || [])[0];
      var at = html.indexOf('<style>\n  /* The look in one place');
      if (css && at >= 0) html = html.slice(0, at) + css + html.slice(html.indexOf('</style>', at) + 8);
      r.fulfill({ response: res, body: html });
    });
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
  var undo = async function () { await page.evaluate(function () { if (document.activeElement) document.activeElement.blur(); }); await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); };   // no click: Properties stays open after an undo, a click there could land in a field
  var es = function () { return page.$$eval('#m2-img [data-e]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-e'); }))); }); };
  var glyphs = function (t, cls) { var re = new RegExp('<(?:\\w+:)?glyph\\b[^>]*class="' + cls + '"[^>]*>', 'g'); return (t.match(re) || []).map(function (g) { return /\bid="([^"]+)"/.exec(g)[1]; }); };
  var shown = function (id) { return page.$('#m2-img [data-n="' + id + '"]').then(function (h) { return !!h; }); };
  var first = async function (l) { for (var k = 0; k < l.length; k++) if (await shown(l[k])) return l[k]; return null; };
  // the database list before the box: its options, the one chosen, whether it is a choice at all
  var hint = function () { return page.$eval('.m2-ed-pdb', function (f) { return Array.from(f.options).map(function (o) { return o.textContent; }).join(' or ') + ' (' + (f.disabled ? '-' : f.options[f.selectedIndex].textContent) + ')'; }); };

  // SBGN-ML: a simple chemical and a macromolecule
  await open('glycolysis-sbgn', 'compartment');
  var t0 = await now(), chem = await first(glyphs(t0, 'simple chemical')), mac = await first(glyphs(t0, 'macromolecule'));
  await click(await nodeAt(chem));
  var R = await rows(), had = R ? R.items.length : -1;
  ok(chem + ': Identifiers shown, the list ChEBI alone, no choice', R && R.title === 'Identifiers' && (await hint()) === 'ChEBI (-)', JSON.stringify(R) + ' ' + (await hint()));
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
  ok(mac + ': the box empty again, its list HGNC symbol or UniProt, HGNC symbol chosen', R && R.box === '' && (await hint()) === 'HGNC symbol or UniProt (HGNC symbol)', JSON.stringify(R));
  had = R.items.length;
  var name0 = await page.evaluate(function (id) { var g = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml').querySelector('glyph[id="' + id + '"] > label'); return g ? g.getAttribute('text') : ''; }, mac);
  var rowNow = function () { return page.$eval('.m2-ed-padd', function (r) { var f = r.querySelector('.m2-ed-pin'); return (r.hidden ? 'closed' : 'open') + (document.activeElement === f ? ' focus' : '') + ' ' + r.querySelector('.m2-ed-pdb').value; }); };
  ok(mac + ': no row to add until +', (await rowNow()).indexOf('closed') === 0, await rowNow());
  await page.click('.m2-ed-pplus'); await page.waitForTimeout(200);
  ok(mac + ': + opens the row, the cursor in the box, HGNC symbol chosen', (await rowNow()) === 'open focus hgnc.symbol', await rowNow());
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok(mac + ': Esc closes it', (await rowNow()).indexOf('closed') === 0, await rowNow());
  await page.click('.m2-ed-pplus'); await page.waitForTimeout(200); await page.mouse.click(10, 880); await page.waitForTimeout(300);
  await click(await nodeAt(mac));
  ok(mac + ': a click away from the empty row closes it', (await rowNow()).indexOf('closed') === 0, await rowNow());
  await paste('ALDOA');
  var t2 = await now();
  ok(mac + ': a plain symbol added as HGNC symbol, the row closed', (await rowNow()).indexOf('closed') === 0 && /identifiers\.org\/hgnc\.symbol:ALDOA"/.test(t2), await rowNow());
  ok(mac + ': a name already there kept', (await page.evaluate(function (id) { var g = new DOMParser().parseFromString(window.m2EditNow().text, 'application/xml').querySelector('glyph[id="' + id + '"] > label'); return g ? g.getAttribute('text') : ''; }, mac)) === name0);
  await page.click('.m2-ed-pplus'); await page.waitForTimeout(200);
  ok(mac + ': + again keeps HGNC symbol (a family: its members have both)', (await rowNow()) === 'open focus hgnc.symbol', await rowNow());
  await page.keyboard.press('Escape');
  await plus(); await page.selectOption('.m2-ed-pdb', 'uniprot'); await page.fill('.m2-ed-pin', '8816'); await page.press('.m2-ed-pin', 'Enter'); await page.waitForTimeout(1200);
  R = await rows();
  ok(mac + ': an HGNC number not read, the symbol asked for', R && /not read: 8816 \(UniProt is/.test(R.say) && (await now()) === t2, JSON.stringify(R));
  await page.fill('.m2-ed-pin', 'PDPK1'); await page.press('.m2-ed-pin', 'Enter'); await page.waitForTimeout(1200);
  R = await rows();
  ok(mac + ': a symbol with UniProt chosen not read, said to fit HGNC symbol', R && /PDPK1 reads as HGNC symbol: choose HGNC symbol/.test(R.say) && R.box === 'PDPK1' && (await now()) === t2, JSON.stringify(R));
  await page.selectOption('.m2-ed-pdb', 'hgnc.symbol'); await page.waitForTimeout(300);
  ok(mac + ': choosing HGNC symbol puts the cursor back in the box', await page.$eval('.m2-ed-pin', function (f) { return document.activeElement === f; }));
  await page.press('.m2-ed-pin', 'Enter'); await page.waitForTimeout(1200);
  R = await rows();
  ok(mac + ': Enter adds it as HGNC symbol', R && /1 added/.test(R.say) && R.box === '' && /identifiers\.org\/hgnc\.symbol:PDPK1"/.test(await now()), JSON.stringify(R));
  await plus(); await page.selectOption('.m2-ed-pdb', 'uniprot'); await page.fill('.m2-ed-pin', 'P31749'); await page.focus('.m2-ed-pdb'); await page.waitForTimeout(600);
  ok(mac + ': leaving the box for the list adds nothing', (await page.$eval('.m2-ed-pin', function (f) { return f.value; })) === 'P31749' && !/P31749/.test(await now()));
  await page.press('.m2-ed-pin', 'Enter'); await page.waitForTimeout(1200);
  ok(mac + ': Enter adds it as UniProt', /identifiers\.org\/uniprot:P31749/.test(await now()));
  await paste('uniprot:P53396');
  R = await rows();
  var own = R.items.filter(function (x) { return / x$/.test(x); }).map(function (x) { return x.split(' ').slice(0, -2).join(' '); });
  var dbs = R.items.map(function (x) { return x.split(' ').slice(0, -2).join(' '); }), runs = dbs.filter(function (d, j) { return j === 0 || d !== dbs[j - 1]; });
  ok(mac + ': rows grouped, HGNC symbols, then UniProt, then the rest, each database once', runs[0] === 'HGNC symbol' && runs[1] === 'UniProt' && new Set(runs).size === runs.length && R.items.indexOf('HGNC symbol PDPK1 x') > R.items.indexOf('HGNC symbol ALDOA x'), JSON.stringify(R.items));
  for (var u = 0; u < 6; u++) await undo();
  ok('SBGN-ML: undone, the file as it was', (await now()) === t0);

  // CellDesigner: a protein and a simple molecule; a reaction still shows References
  await open('glycolysis-celldesigner', 'cd:PROTEIN');
  var c0 = await now(), nodes = await page.$$eval('#m2-img [data-n]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-n'); }))); });
  var info = await page.evaluate(function (a) { return a[1].map(function (id) { try { return [id, window.cd_make.idsOf(a[0], id).cls]; } catch (e) { return [id, null]; } }); }, [c0, nodes]);
  var prot = (info.filter(function (x) { return x[1] === 'PROTEIN'; })[0] || [])[0], mol = (info.filter(function (x) { return x[1] === 'SIMPLE_MOLECULE'; })[0] || [])[0];
  var cdIds = function (t, id) { return page.evaluate(function (a) { return window.cd_make.idsOf(a[0], a[1]).links.filter(function (x) { return x.q === 'bqbiol:is' || x.q === 'bqbiol:hasVersion'; }).map(function (x) { return x.link; }); }, [t, id]); };   // a family's go with its members (hasVersion)
  await click(await nodeAt(prot));
  R = await rows();
  ok(prot + ': Identifiers shown for a protein, HGNC symbol chosen', R && R.title === 'Identifiers' && (await hint()) === 'HGNC symbol or UniProt (HGNC symbol)', JSON.stringify(R));
  had = R ? R.items.length : 0;
  await paste('https://www.uniprot.org/uniprotkb/Q15831/entry hgnc.symbol:SMAD7');   // a prefix says its own database, whatever is chosen
  R = await rows();
  var L = await cdIds(await now(), prot);
  ok(prot + ': written as CellDesigner names them (a family: under hasVersion with its members)', L.indexOf('urn:miriam:uniprot:Q15831') >= 0 && L.indexOf('urn:miriam:hgnc.symbol:SMAD7') >= 0 && R.items.length === had + 2, JSON.stringify(L) + ' ' + JSON.stringify(R));
  await cross('hgnc.symbol:SMAD7');
  ok(prot + ': the cross takes the HGNC symbol out', (await cdIds(await now(), prot)).indexOf('urn:miriam:hgnc.symbol:SMAD7') < 0);
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
  ok('a reaction still shows References, its list PubMed or DOI, PubMed chosen', R && R.title === 'References' && (await hint()) === 'PubMed or DOI (PubMed)', JSON.stringify(R));

  // an HGNC symbol (or any database's ID) under bqbiol:is takes a cross as the others; + over the crosses' column
  await open('glycogen-liver-celldesigner', 'cd:PROTEIN');
  var g0 = await now(), gn = await page.$$eval('#m2-img [data-n]', function (l) { return Array.from(new Set(l.map(function (x) { return x.getAttribute('data-n'); }))); });
  var sym = (await page.evaluate(function (a) { return a[1].map(function (id) { try { if (window.cd_make.aliasInfo(a[0], id).complex) return [id, null]; return [id, window.cd_make.idsOf(a[0], id).links.filter(function (x) { return x.q === 'bqbiol:is' && x.key === 'hgnc.symbol:PDPK1'; }).map(function (x) { return x.key; })[0]]; } catch (e) { return [id, null]; } }); }, [g0, gn])).filter(function (x) { return x[1]; })[0];
  if (sym) {
    await click(await nodeAt(sym[0]));   // PDPK1 alone, no residue in its middle
    R = await rows();
    ok(sym[0] + ': the HGNC symbol shown with a cross', R && R.items.some(function (x) { return /^HGNC symbol .* x$/.test(x); }), JSON.stringify(R));
    var lay = await page.evaluate(function () {
      var p = document.querySelector('.m2-ed-pplus').getBoundingClientRect(), x = document.querySelector('.m2-ed-px').getBoundingClientRect(), s = document.querySelector('.m2-ed-pplus svg').getBoundingClientRect();
      return { right: Math.abs(p.right - x.right), w: [p.width, x.width], mid: Math.abs((s.left + s.right) / 2 - (p.left + p.right) / 2) + Math.abs((s.top + s.bottom) / 2 - (p.top + p.bottom) / 2) };
    });
    ok('the + square over the crosses, its sign in its middle', lay.right < 0.6 && Math.abs(lay.w[0] - lay.w[1]) < 0.6 && lay.mid < 0.6, JSON.stringify(lay));
    if (process.env.SHOT) await (await page.$('.m2-ed-props')).screenshot({ path: process.env.SHOT });
    await page.hover('.m2-ed-pplus'); if (process.env.SHOT) await (await page.$('.m2-ed-prefs')).screenshot({ path: process.env.SHOT.replace('.png', '-hover.png') });
    // + opens the row under the heading, over the list; a UniProt added lands in the list opened in full, shaded a moment
    await plus();
    var top = await page.evaluate(function () { var h = document.querySelector('.m2-ed-prefh tr').getBoundingClientRect(), r = document.querySelector('.m2-ed-padd').getBoundingClientRect(), l = document.querySelector('.m2-ed-prefl tr').getBoundingClientRect(); return h.bottom <= r.top + 0.5 && r.bottom <= l.top + 0.5; });
    ok('the row to add right under the heading, the list under it', top);
    await page.selectOption('.m2-ed-pdb', 'uniprot'); await page.fill('.m2-ed-pin', 'Q15118'); await page.press('.m2-ed-pin', 'Enter'); await page.waitForTimeout(400);
    var landed = await page.evaluate(function () { var l = Array.from(document.querySelectorAll('.m2-ed-prefl tr')), n = l.filter(function (r) { return r.classList.contains('m2-ed-pnew'); }); return { all: l.length, open: !!document.querySelector('.m2-ed-pmore') ? document.querySelector('.m2-ed-pmore').textContent : 'none', fresh: n.map(function (r) { return r.querySelector('.m2-ed-ppicname').textContent; }), shade: n[0] ? getComputedStyle(n[0].querySelector('td')).backgroundColor : '' }; });
    ok('the UniProt added: the list open in full, its row shaded where it landed', landed.fresh.join() === 'Q15118' && landed.all >= 2 && landed.open !== '+' + (landed.all - 1) && !/rgba\(0, 0, 0, 0\)|transparent/.test(landed.shade), JSON.stringify(landed));
    await page.waitForTimeout(2500);
    ok('the shade fades after a moment', await page.$eval('.m2-ed-pnew > td', function (c) { return /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(c).backgroundColor); }));
    await undo();
    await cross(sym[1]);
    ok(sym[0] + ': the cross takes the HGNC symbol out of the file', !(await cdIds(await now(), sym[0])).some(function (l) { return /hgnc\.symbol/.test(l); }));
    await undo();
    ok('glycogen liver: undone, the file as it was', (await now()) === g0);
  } else ok('glycogen liver: PDPK1 with its HGNC symbol', false);

  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
