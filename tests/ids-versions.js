// A family's members under bqbiol:hasVersion in Identifiers (create.js idOwn; cd_make setIds; sbgn_edit idsOf, setIds,
// idsOut with the property Identity versions): on the styles page, PDP of the PDH map (CellDesigner and SBGN-ML) shows
// its members' identifiers each with a cross; a cross takes one out of the hasVersion bag; + adds a new one into that
// bag, not under bqbiol:is; undo puts the file back byte for byte. Nothing is saved (no token). No script error.
//   node tests/ids-versions.js [base address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var open = async function (hash, mark) {
    await page.goto('about:blank'); await page.goto(base + '#' + hash, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.$('#m2-editwin button[data-make="' + mark + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + mark + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var nodeByLabel = function (name) { return page.$$eval('#m2-img [data-n]', function (l, name) {
    var hit = l.filter(function (g) { return Array.from(g.querySelectorAll('text')).map(function (x) { return x.textContent.trim(); }).join(' ') === name; })[0];
    if (!hit) return null; var r = hit.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, name); };
  var rows = async function () { var m = await page.$('.m2-ed-pmore'); if (m && (await m.getAttribute('aria-expanded')) === 'false') { await m.click(); await page.waitForTimeout(300); } return rows0(); };   // a folded list opened first
  var rows0 = function () { return page.$$eval('.m2-ed-prefl tr', function (l) { return l.map(function (r) { return r.querySelector('th').textContent + ' ' + r.querySelector('.m2-ed-ppicname').textContent + (r.querySelector('.m2-ed-px') ? ' x' : ''); }); }); };
  var paste = async function (v) { await page.click('.m2-ed-pplus'); await page.waitForTimeout(200); await page.fill('.m2-ed-pin', v); await page.press('.m2-ed-pin', 'Enter'); await page.waitForTimeout(1200); };
  var undo = async function () { await page.keyboard.press('Control+z'); await page.waitForTimeout(1200); };
  var bagOf = function (t, q) {   // every link in t under the qualifier q, in order
    var out = [], re = new RegExp('<' + q + '[\\s>][\\s\\S]*?</' + q + '>', 'g'), m;
    while ((m = re.exec(t))) (m[0].match(/rdf:resource="[^"]*"/g) || []).forEach(function (x) { out.push(x.slice(14, -1)); });
    return out;
  };
  for (var f of [{ hash: 'pdh-celldesigner', mark: 'cd:PROTEIN', link: 'urn:miriam:uniprot:' }, { hash: 'pdh-sbgn', mark: 'macromolecule', link: 'identifiers.org/uniprot:' }]) {
    await open(f.hash, f.mark);
    var t0 = await now(), at = await nodeByLabel('PDP');
    ok(f.hash + ': PDP found', !!at);
    if (!at) continue;
    await page.keyboard.press('Escape'); await page.mouse.click(at[0], at[1]); await page.waitForTimeout(800);
    var vis = function () { return page.$$eval('.m2-ed-prefl tr', function (l) { var m = document.querySelector('.m2-ed-pfold .m2-ed-pmore'); return l.length + ' ' + (m ? m.getAttribute('aria-expanded') + ' ' + m.textContent : ''); }); };
    if (f.hash === 'pdh-celldesigner') {
      var v0 = await vis(), n = +v0.split(' ').pop();
      ok(f.hash + ': a long list folded to its first row, Show all N under it', /^1 false Show all \d+$/.test(v0) && n >= 3, v0);
      var lay = await page.evaluate(function () { var b = document.querySelector('.m2-ed-pfold .m2-ed-pmore').getBoundingClientRect(), r = document.querySelector('.m2-ed-prefl tr'), th = r.querySelector('th').getBoundingClientRect(), tr = r.getBoundingClientRect(); return { left: b.left + 4 - th.left, under: b.top - tr.bottom }; });
      ok(f.hash + ': on the left, its text in line with the labels, under the row', Math.abs(lay.left) <= 1 && lay.under >= -0.5, JSON.stringify(lay));
      await page.click('.m2-ed-pmore'); await page.waitForTimeout(300);
      ok(f.hash + ': it opens the whole list, Show fewer under it', (await vis()) === n + ' true Show fewer', await vis());
      await page.click('.m2-ed-pmore'); await page.waitForTimeout(300);
      ok(f.hash + ': Show fewer folds it again', (await vis()) === '1 false Show all ' + n, await vis());
    }
    var R = await rows();
    ok(f.hash + ': every member identifier has a cross', R.length >= 3 && R.every(function (x) { return / x$/.test(x); }), JSON.stringify(R));
    await page.click('.m2-ed-px[data-key="uniprot:Q9P2J9"]'); await page.waitForTimeout(1200);
    var t1 = await now(), hv1 = bagOf(t1, 'bqbiol:hasVersion').join(' ');
    ok(f.hash + ': the cross takes Q9P2J9 out of hasVersion, Q9P0J1 kept', !/Q9P2J9/.test(hv1) && /Q9P0J1/.test(hv1), hv1);
    await undo();
    var R1 = await rows();
    ok(f.hash + ': undo puts Q9P2J9 back, PDP still selected and its Identifiers in sight', R1.indexOf('UniProt Q9P2J9 x') >= 0 && R1.length === R.length, JSON.stringify(R1));
    await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(1200);
    ok(f.hash + ': redo takes it out again, still selected', (await rows()).indexOf('UniProt Q9P2J9 x') < 0 && (await rows()).length === R.length - 1);
    await paste('uniprot:Q8NCN5');
    var t2 = await now(), hv2 = bagOf(t2, 'bqbiol:hasVersion').join(' '), is2 = bagOf(t2, 'bqbiol:is').join(' ');
    ok(f.hash + ': + adds into hasVersion, not under bqbiol:is', hv2.indexOf(f.link + 'Q8NCN5') >= 0 && is2.indexOf('Q8NCN5') < 0, hv2 + ' | ' + is2);
    await undo(); await undo();
    ok(f.hash + ': undone, the file as it was', (await now()) === t0);
  }
  ok('no script error', !errs.length, errs.join(' | '));
  console.log(bad ? bad + ' WRONG' : 'all ok');
  await b.close(); process.exit(bad ? 1 : 0);
})();
