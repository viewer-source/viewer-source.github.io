// Files from outside (notes/functional-consistency.md, Checks before a release, 0; the hub rule What a person outside
// can do): files as other tools wrote them (Newt, CellDesigner, yEd, MINERVA, the SBGN website, libsbgn), each added
// on the live site through Add map from file with no token, as a person outside does, never through the build. Per
// file: added or refused (and the words said), drawn, editing started, everything selected and moved by an arrow
// key, the text the editor would save read back (m2EditNow): the move changes only numbers, never names, kinds or what
// is joined to what; a change made on entering edit (a rule kept on purpose, as positive influence taken in as reduced
// physical stimulation) counts only when the status line says it. OUTSIDE_DUMP=<folder>: the text on entry and after.
//   node tests/outside-files.js <data clone> [base address] [--local] [files ...]   (default: the list below, from the
//   site's data repository cloned at <data clone>)
// --local: the working tree's editor and renderers routed into the live page.
var path = require('path'), fs = require('fs'), os = require('os'), { chromium } = require('playwright');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a !== '--local'; });
var data = args.shift();
var base = args[0] && /^https?:/.test(args[0]) ? args.shift() : 'https://viewer-source.github.io/styles/';
var here = path.join(__dirname, '..');
var T = 'test-maps/test-set/', S = 'test-maps/sbgn-ml/';
var LIST = [   // [file in the data repository, the tool that wrote it]
  [T + 'test-maps/sbgn-ml/pd/newt-unstable/drosophila_cell_cycle.nwt', 'Newt (.nwt)'],
  [S + 'pd/newt-unstable/mammalian_cholesterol.nwt', 'Newt (.nwt)'],
  [S + 'pd/sbgn-website/downloads/examples/Repressilator_PD_v7.sbgn', 'SBGN website, SBGN-ML 0.2'],
  [S + 'pd/sbgn-website/downloads/examples/insulin-like_growth_factor_signaling_withSubmap_mapk_cascade.sbgn', 'SBGN website'],
  [S + 'pd/newt-unstable/glycolysis.sbgn', 'Newt (.sbgn)'],
  [T + 'test-maps/sbgn-ml/af/libsbgn/test-files/AF/AF_Reference_Card.sbgn', 'libsbgn, AF'],
  ['parked/sbml/minerva-from-reactome-raf.sbgn', 'MINERVA export'],
  [T + 'maps/f001-glycolysis.xml', 'CellDesigner'],
  [T + 'maps/enos-celldesigner.xml', 'CellDesigner'],
  ['parked/sbml/minerva-glycolysis-cardiac-celldesigner-original.xml', 'CellDesigner (on MINERVA)'],
  [T + 'maps/enos-graphml.graphml', 'yEd'],
  [T + 'maps/tag-graphml.graphml', 'yEd'],
];
var list = args.length ? args.map(function (f) { return [f, path.extname(f)]; }) : LIST.map(function (l) { return [path.join(data, l[0]), l[1]]; });
// what a move may change: numbers; the rest of the text (names, classes, ids, what is joined) must stay
// (a byte-order mark at the start is dropped by the browser reading any file)
function words(t) { return t.replace(/^\uFEFF/, '').replace(/-?\d+(\.\d+)?(e[+-]?\d+)?/gi, '#').replace(/\s+/g, ' '); }
(async function () {
  var b = await chromium.launch(), rows = [];
  for (var i = 0; i < list.length; i++) {
    var f = list[i][0], tool = list[i][1], name = path.basename(f), row = { name: name, tool: tool };
    rows.push(row);
    if (!fs.existsSync(f)) { row.added = 'no file'; continue; }
    // a file the picker offers: .graphml, .xml, .sbgn; a Newt file (.nwt) cannot be picked at all, so it is tried renamed
    var ext = path.extname(f).toLowerCase(), pickable = /^\.(graphml|xml|sbgn)$/.test(ext);
    row.pickable = pickable;
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-')), copy = path.join(dir, pickable ? name : name.replace(/\.[^.]+$/, '') + '.sbgn');
    fs.copyFileSync(f, copy);
    var orig = fs.readFileSync(copy, 'utf8');
    var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
    page.setDefaultTimeout(60000);
    page.on('pageerror', function (e) { errs.push(e.message); });
    if (local) {
      var ed = require('./editor-now.js')(here);
      await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
      await page.route(/\/renderers\/(converter|yrender|layout)\/[^?]+\.(js|py)/, function (r) {
        var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]);
        if (fs.existsSync(fp)) r.fulfill({ contentType: /\.py$/.test(fp) ? 'text/plain' : 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue();
      });
    }
    try {
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.waitForSelector('input[type=file]', { state: 'attached' });
      var t0 = Date.now();
      await page.setInputFiles('input[type=file]', copy);
      var got = await page.waitForFunction(function () {
        if (location.hash.indexOf('#mine') === 0) return 'added';
        var red = Array.prototype.map.call(document.querySelectorAll('#m2-list *'), function (e) { return e.children.length ? '' : e.textContent; }).filter(function (s) { return /cannot|not |nothing|refused|fail|Error\b/i.test(s); });   // Error: a reader's own words, said as they are
        return red.length ? 'refused: ' + red.join(' | ') : false;
      }, null, { polling: 200, timeout: 120000 }).then(function (h) { return h.jsonValue(); }, function () { return 'nothing after 120 s'; });
      row.added = got; row.addMs = Date.now() - t0;
      if (got === 'added') {
        await page.waitForTimeout(1500);
        row.drawn = await page.evaluate(function () { var p = document.getElementById('m2-img'); return !!p && (p.tagName.toLowerCase() === 'svg' ? p.querySelectorAll('*').length > 5 : !!p.getAttribute('src')); });
        t0 = Date.now();
        await page.keyboard.press('e');
        var ed2 = await page.waitForFunction(function () { return document.querySelector('.m2-editing') !== null && window.m2EditNow && window.m2EditNow(); }, null, { polling: 200, timeout: 60000 }).then(function () { return true; }, function () { return false; });
        row.edit = ed2; row.editMs = Date.now() - t0;
        row.status = await page.evaluate(function () { return (document.querySelector('#m2-ed-status') || {}).textContent || ''; });
        if (ed2) {
          var before = await page.evaluate(function () { return window.m2EditNow().text; });
          row.sameOnEntry = before === orig.replace(/^\uFEFF/, '');
          await page.mouse.click(700, 450);
          await page.keyboard.press((process.platform === 'darwin' ? 'Meta' : 'Control') + '+a');
          await page.keyboard.press('ArrowRight');
          await page.waitForTimeout(2500);
          var after = await page.evaluate(function () { return window.m2EditNow().text; });
          row.moved = after !== before;
          row.onlyNumbers = words(after) === words(orig);
          // the move itself, apart from what entering edit changed (a rule kept on purpose, said in the status line)
          row.moveOnlyNumbers = words(after) === words(before);
          if (process.env.OUTSIDE_DUMP) { fs.writeFileSync(path.join(process.env.OUTSIDE_DUMP, name + '.before'), before); fs.writeFileSync(path.join(process.env.OUTSIDE_DUMP, name + '.after'), after); }
          var a = orig.split('\n'), c = after.split('\n'), n = 0;
          for (var k = 0; k < Math.max(a.length, c.length); k++) if (a[k] !== c[k]) n++;
          row.linesChanged = n + ' of ' + a.length;
          row.status = await page.evaluate(function () { return (document.querySelector('#m2-ed-status') || {}).textContent || ''; }) || row.status;
        }
      }
    } catch (e) { row.error = String(e.message || e).split('\n')[0]; }
    row.errors = errs.slice(0, 2).join(' | ');
    console.log(JSON.stringify(row));
    await ctx.close();
  }
  await b.close();
  // short: not added, not editable, not moved, a move changing more than numbers, a change on entry the status did not
  // say, or an error on the page
  var bad = rows.filter(function (r) { return r.added !== 'added' || !r.edit || !r.moved || !r.moveOnlyNumbers || (!r.sameOnEntry && !r.status) || /Not drawn|Error/.test(r.status || '') || r.errors; }).length;
  console.log(bad ? bad + ' of ' + rows.length + ' files fall short' : 'all ' + rows.length + ' files open, edit and keep their content');
  process.exit(bad ? 1 : 0);
})();
