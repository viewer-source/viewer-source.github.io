// Compartments that partly overlap, on the live page (core.js stackComps, sbgn_edit.stack): the smaller is put in front
// (after the larger in the file) when a move makes the overlap; a move that leaves every overlap as it was keeps the
// file's order, whatever it is (an author may have stacked them the other way: PD2AF's gene_activation, the cytosol
// before the larger nucleus).
//   1. a small compartment first in the file, a large one apart after it; the small one dragged onto the large one's
//      edge: the file then holds the large one first.
//   2. that map, everything moved by an arrow key: the order stays.
//   3. two compartments overlapping in the larger-in-front order: everything moved, then the larger alone dragged a
//      little within the same overlap: the order stays both times.
// node tests/stack-live.js [base address] [--local]   (--local: the working tree's editor and renderers routed in)
var path = require('path'), fs = require('fs'), os = require('os'), { chromium } = require('playwright');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a !== '--local'; });
var base = args[0] || 'https://viewer-source.github.io/styles/', here = path.join(__dirname, '..');
function sbgn(glyphs) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<sbgn xmlns="http://sbgn.org/libsbgn/0.3">\n  <map id="m" language="process description">\n' +
    glyphs.map(function (g) { return '    <glyph id="' + g[0] + '" class="compartment">\n      <label text="' + g[0] + '"/>\n      <bbox x="' + g[1] + '" y="' + g[2] + '" w="' + g[3] + '" h="' + g[4] + '"/>\n    </glyph>\n'; }).join('') +
    '  </map>\n</sbgn>\n';
}
function order(t) { var o = [], re = /<glyph id="([^"]*)" class="compartment"/g, m; while ((m = re.exec(t))) o.push(m[1]); if (process.env.STACK_SHOW) console.log(t.replace(/\s+/g, ' ').match(/<glyph id="[^"]*" class="compartment">.*?<bbox[^>]*>/g).join('\n')); return o.join(','); }
(async function () {
  var b = await chromium.launch(), fails = 0;
  var check = function (what, got, want) { var ok = got === want; if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + what + ': ' + got + (ok ? '' : ' (expected ' + want + ')')); };
  async function open(text) {
    var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-')), f = path.join(dir, 'stack.sbgn');
    fs.writeFileSync(f, text);
    var page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    page.setDefaultTimeout(60000);
    if (local) {
      var ed = require('./editor-now.js')(here);
      await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
      await page.route(/\/renderers\/(converter|yrender|layout)\/[^?]+\.(js|py)/, function (r) {
        var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]);
        if (fs.existsSync(fp)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue();
      });
    }
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.setInputFiles('input[type=file][accept*=".sbgn"]', f);
    await page.waitForFunction(function () { return location.hash.indexOf('#mine') === 0; });
    await page.waitForTimeout(1500);
    await page.keyboard.press('e');
    await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); });
    await page.waitForTimeout(1500);
    return page;
  }
  var now = function (page) { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var box = function (page, id) { return page.evaluate(function (id) { var g = document.querySelector('#m2-img [data-n="' + id + '"]'); var r = g && g.getBoundingClientRect(); return r ? [r.left, r.top, r.width, r.height] : null; }, id); };
  async function drag(page, id, dx, dy) {   // grabbed inside, below its middle, clear of the other's
    var r = await box(page, id), x = r[0] + r[2] / 2, y = r[1] + r[3] * 0.7;
    if (process.env.STACK_SHOW) console.log('grab', id, r, x, y, await page.evaluate(function (p) { var e = document.elementFromPoint(p[0], p[1]); return e ? e.tagName + ' ' + (e.closest('[data-n]') || { getAttribute: function () { return '-'; } }).getAttribute('data-n') + ' ' + (e.closest('[id]') || {}).id : null; }, [x, y]));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);   // nothing selected before
    await page.mouse.click(x, y); await page.waitForTimeout(400);   // selected first: a drag inside a holder not selected may draw a selection area
    await page.mouse.move(x, y); await page.mouse.down();
    for (var k = 1; k <= 12; k++) { await page.mouse.move(x + dx * k / 12, y + dy * k / 12); await page.waitForTimeout(25); }
    await page.mouse.up(); await page.waitForTimeout(1500);
  }
  async function moveAll(page) {
    await page.mouse.click(1300, 860);
    await page.keyboard.press((process.platform === 'darwin' ? 'Meta' : 'Control') + '+a');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2000);
  }

  var p1 = await open(sbgn([['small', 40, 40, 120, 100], ['large', 400, 40, 400, 300]]));
  var rs = await box(p1, 'small'), rl = await box(p1, 'large');
  await drag(p1, 'small', rl[0] - (rs[0] + rs[2]) + rs[2] / 2, 0);   // its right half over the large one's left edge
  check('1. a move makes the overlap: the smaller after the larger', order(await now(p1)), 'large,small');
  await moveAll(p1);
  check('2. everything moved together: order kept', order(await now(p1)), 'large,small');
  await p1.context().close();

  var p3 = await open(sbgn([['cytosol', 130, 95, 540, 210], ['nucleus', 130, 300, 440, 305]]));
  await moveAll(p3);
  check('3a. everything moved, the larger in front kept', order(await now(p3)), 'cytosol,nucleus');
  await drag(p3, 'nucleus', 40, 0);   // sideways: the 5 units of overlap kept
  check('3b. the larger moved within the same overlap: order kept', order(await now(p3)), 'cytosol,nucleus');
  await p3.context().close();
  await b.close();
  console.log(fails ? fails + ' failed' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
