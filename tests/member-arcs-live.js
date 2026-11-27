// Lines at complex members put right on opening (sbgn_edit.membersOut), on the live page with this tree's editor
// (--local) or the page's own, files added as a reader adds them (Add map from file), no token:
// 1. Newt's CaMK sample (.nwt): CaMKK's catalysis, drawn from inside its complex, starts at the complex in the text the
//    editor works on, said in red once the map is drawn.
// 2. A yEd GraphML with a line between two members of one complex and one between members of two complexes: the first
//    taken out, the second joined at both ends, said.
// 3. A file with no such line: nothing said, the text as it came.
// 4. The mast cell map (yEd, compartments and complexes), from the site's data folder (--data): every line kept.
//   node tests/member-arcs-live.js <the converter's repository> [base address] [--local] [--data <the site's data folder>]
var path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process'), { chromium } = require('playwright');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0, di = args.indexOf('--data'), data = di >= 0 ? args.splice(di, 2)[1] : null; args = args.filter(function (a) { return a !== '--local'; });
var conv = args[0], base = args[1] || 'https://viewer-source.github.io/styles/', here = path.join(__dirname, '..'), bad = 0;
if (!conv) { console.log('usage: node tests/member-arcs-live.js <the converter\'s repository> [base] [--local]'); process.exit(2); }
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'member-arcs-'));
var CASE = '<sbgn xmlns="http://sbgn.org/libsbgn/0.3"><map id="m" language="process description">\n' +
  '  <glyph id="ab" class="complex"><label text="AB"/><bbox x="0" y="0" w="200" h="80"/>\n' +
  '    <glyph id="a" class="macromolecule"><label text="A"/><bbox x="10" y="20" w="60" h="40"/></glyph>\n' +
  '    <glyph id="b" class="macromolecule"><label text="B"/><bbox x="120" y="20" w="60" h="40"/></glyph></glyph>\n' +
  '  <glyph id="cd" class="complex"><label text="CD"/><bbox x="0" y="200" w="200" h="80"/>\n' +
  '    <glyph id="c" class="macromolecule"><label text="C"/><bbox x="10" y="220" w="60" h="40"/></glyph></glyph>\n' +
  '  <arc id="e1" class="stimulation" source="a" target="b"><start x="70" y="40"/><end x="120" y="40"/></arc>\n' +
  '  <arc id="e2" class="stimulation" source="a" target="c"><start x="40" y="60"/><end x="40" y="220"/></arc>\n' +
  '</map></sbgn>\n';
fs.writeFileSync(path.join(dir, 'case.sbgn'), CASE);
var g = cp.spawnSync('python3', ['-c', 'import sys, io, contextlib\nsys.path.insert(0, sys.argv[1])\nfrom mapconv import graphml, sbgnml, report\nwith report.collect(), contextlib.redirect_stdout(io.StringIO()):\n    t = graphml.write(sbgnml.read(sys.argv[2]))\nprint(t)', conv, path.join(dir, 'case.sbgn')], { encoding: 'utf8' });
if (g.status) { console.log(g.stderr); process.exit(2); }
fs.writeFileSync(path.join(dir, 'members-v01.graphml'), g.stdout);
(async function () {
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
  page.setDefaultTimeout(60000);
  page.on('pageerror', function (e) { errs.push(e.message); });
  if (local) {
    var ed = require('./editor-now.js')(here);
    await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/(converter|yrender|layout)\/[a-z_]+\.js/, function (r) {
      var f = path.join(here, 'renderers', /\/renderers\/(.+\.js)/.exec(new URL(r.request().url()).pathname)[1]);
      if (fs.existsSync(f)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f, 'utf8') }); else r.continue();
    });
  }
  var add = async function (f) {   // added from a file, then edited (E); the text the editor works on and the status line
    var was = await page.evaluate(function () { return location.hash; });
    if (await page.$('.m2-editing')) { await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(1200); }
    await page.setInputFiles('input[type=file][accept*=".sbgn"]', f);
    await page.waitForFunction(function (was) { return location.hash.indexOf('#mine') === 0 && location.hash !== was; }, was, { polling: 200 });
    await page.waitForTimeout(1500);
    await page.keyboard.press('e');
    await page.waitForFunction(function () { return document.querySelector('.m2-editing') && window.m2EditNow && window.m2EditNow(); }, null, { polling: 200 });
    await page.waitForTimeout(1500);
    return page.evaluate(function () { var s = document.querySelector('.m2-ed-warn'); return { text: window.m2EditNow().text, said: s ? s.textContent : '' }; });
  };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); }); await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('input[type=file][accept*=".sbgn"]', { state: 'attached' }); await page.waitForTimeout(2500);
  var nwt = path.join(conv, 'tests/external/newt/pd/samples/cam-camk_dependent_signaling_to_the_nucleus.nwt');
  var r1 = await add(nwt), arc = (r1.text.match(/<arc [^>]*id="arc25"[^>]*>/) || [''])[0];
  ok('1. CaMKK\'s catalysis starts at its complex', /source="glyph2"/.test(arc), arc);
  ok('1. said in red', /line at complex members put right/.test(r1.said) && /CaMKK/.test(r1.said), r1.said);
  var r2 = await add(path.join(dir, 'members-v01.graphml'));
  var edges = (r2.text.match(/<edge [^>]*>/g) || []);
  ok('2. the line between A and B taken out', !edges.some(function (e) { return /id="e1"/.test(e); }), edges.length + ' lines');
  var e2 = edges.filter(function (e) { return /id="e2"/.test(e); })[0] || '';
  ok('2. the line from A to C joined at both ends', /source="ab"/.test(e2) && /target="cd"/.test(e2), e2);
  ok('2. said in red', /2 lines at complex members put right/.test(r2.said), r2.said);
  var plain = path.join(conv, 'tests/external/newt/pd/samples/glycolysis.nwt');
  if (fs.existsSync(plain)) {
    var r3 = await add(plain);
    ok('3. a file with no such line: nothing about members said', !/complex members/.test(r3.said), r3.said || '(nothing)');
  }
  // 4. a yEd map with compartments and complexes and no line at a member (the review's case: a compartment taken for a
  // complex rewrote 504 lines): nothing said, every line kept
  var mast = data ? path.join(data, 'maps', 'asthmamap-mast-cell-graphml.graphml') : '';
  if (mast && fs.existsSync(mast)) {
    var r4 = await add(mast), n0 = (fs.readFileSync(mast, 'utf8').match(/<edge /g) || []).length, n4 = (r4.text.match(/<edge /g) || []).length;
    ok('4. a compartmented yEd map: nothing about members said, every line kept', !/complex members/.test(r4.said) && n4 === n0, n4 + ' of ' + n0 + ' lines; ' + (r4.said || '(nothing said)'));
  } else console.log('skip  4. (no --data)');
  ok('no script errors', !errs.length, errs.join('; '));
  await b.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
