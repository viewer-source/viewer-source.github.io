// Sites as seen (the palette's Show sites; notes/sites-as-drawn.md): an SBGN-ML map is written as it is seen. On
// the live page with this tree's editor (--local) or the page's own, a reader's file added with no token:
// 1. Unticked: the file the editor writes has no site on any state variable, each in its glyph's PTM note, the
//    circles sized for the value.
// 2. Ticked: every site back on its state variable, the box sized for value@site; unticked again: as in 1.
// 3. That file of 1, as another tool saves it with the notes kept, added again with Show sites ticked: its sites
//    drawn again from the notes.
//   node tests/sites-as-seen.js <SBGN-ML file with sites> [base address] [--local]
var path = require('path'), fs = require('fs'), os = require('os'), { chromium } = require('playwright');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a !== '--local'; });
var file = args[0], base = args[1] || 'https://viewer-source.github.io/styles/', here = path.join(__dirname, '..'), bad = 0;
if (!file) { console.log('usage: node tests/sites-as-seen.js <SBGN-ML file with sites> [base] [--local]'); process.exit(2); }
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
var vars = function (t) { return (t.match(/<([\w.-]+:)?state [^>]*variable="/g) || []).length; };
var ptm = function (t) { return (t.match(/PTM:[^<\n]*/g) || []).join(' ').split(/\s+/).filter(function (x) { return x.indexOf('@') >= 0; }).length; };
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
  var orig = fs.readFileSync(file, 'utf8'), n = vars(orig), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sites-'));
  var add = async function (name, text) {
    var f = path.join(dir, name); fs.writeFileSync(f, text);
    var was = await page.evaluate(function () { return location.hash; });
    await page.setInputFiles('input[type=file]', f);
    await page.waitForFunction(function (was) { return location.hash.indexOf('#mine') === 0 && location.hash !== was; }, was, { polling: 200 });
    await page.waitForTimeout(1500);
    await page.keyboard.press('e');
    await page.waitForFunction(function () { return document.querySelector('.m2-editing') && window.m2EditNow && window.m2EditNow(); }, null, { polling: 200 });
    await page.waitForTimeout(800);
  };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var tick = async function () {   // the palette's Show sites, while editing
    await page.click('.m2-ed-psites input'); await page.waitForTimeout(800);
    return page.$eval('.m2-ed-psites input', function (x) { return x.checked; });
  };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); }); await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('input[type=file]', { state: 'attached' }); await page.waitForTimeout(2500);
  ok('the file has sites on its state variables', n > 0, n + ' sites');
  await add('sites-a.sbgn', orig);
  var t1 = await now();
  ok('1. unticked: no site on a state variable', vars(t1) === 0, vars(t1) + ' left');
  ok('1. each site kept in its glyph\'s PTM note', ptm(t1) === n, ptm(t1) + ' of ' + n);
  var c = await tick(), t2 = await now();
  ok('2. ticked: every site back on its state variable', c && vars(t2) === n && ptm(t2) === 0, vars(t2) + ' on circles, ' + ptm(t2) + ' in notes');
  c = await tick(); var t3 = await now();
  ok('2. unticked again: as written unticked', !c && t3 === t1);
  await tick();   // ticked for the file saved by another tool
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(1200);   // editing left, back to the list (the setting kept)
  await add('sites-b.sbgn', t1);
  var t4 = await now();
  ok('3. a file with its sites only in the notes, opened ticked: the sites drawn again', vars(t4) === n && ptm(t4) === 0, vars(t4) + ' on circles');
  var shown = await page.evaluate(function () { var p = document.getElementById('m2-img'); return p && p.outerHTML ? (p.outerHTML.match(/@S\d+/g) || []).length : -1; });
  ok('3. and in the drawing', shown > 0, shown + ' site texts in the editor\'s picture');
  ok('no page errors', !errs.length, errs.slice(0, 2).join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
