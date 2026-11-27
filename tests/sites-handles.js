// A state variable selected marks the box drawn (the palette's Show sites; notes/sites-as-drawn.md): unticked, a
// value@site circle shows the value alone and its four handles sit round that circle, not round the whole text's box;
// ticked, round the whole one. On the live page with this tree's editor (--local) or the page's own, a reader's file
// with sites on its state variables added with no token; up to six circles clicked each way.
//   node tests/sites-handles.js <SBGN-ML file with sites on its state variables: notes/check-files/sites-shown-camk-v01.sbgn> [base address] [--local]
var path = require('path'), fs = require('fs'), os = require('os'), { chromium } = require('playwright');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a !== '--local'; });
var file = args[0], base = args[1] || 'https://viewer-source.github.io/styles/', here = path.join(__dirname, '..'), bad = 0;
if (!file) { console.log('usage: node tests/sites-handles.js <SBGN-ML file with sites> [base] [--local]'); process.exit(2); }
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
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
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); }); await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('input[type=file][accept*=".sbgn"]', { state: 'attached' }); await page.waitForTimeout(2500);
  var f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'handles-')), 'sites-handles.sbgn');
  fs.writeFileSync(f, fs.readFileSync(file, 'utf8'));
  await page.setInputFiles('input[type=file][accept*=".sbgn"]', f);
  await page.waitForFunction(function () { return location.hash.indexOf('#mine') === 0; }, null, { polling: 200 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('e');
  await page.waitForFunction(function () { return document.querySelector('.m2-editing') && window.m2EditNow && window.m2EditNow(); }, null, { polling: 200 });
  await page.waitForTimeout(1000);
  // the shapes of the circles drawn with a site (the group shown: sv-value unticked, sv-site ticked), on screen
  var circles = function (cls) {
    return page.evaluate(function (cls) {
      return Array.prototype.map.call(document.querySelectorAll('#m2-img g.' + cls), function (g) {
        var s = g.querySelector('path, rect, ellipse, polygon'), r = s && s.getBoundingClientRect();
        return r && r.width ? [r.left + r.width / 2, r.top + r.height / 2, r.width] : null;
      }).filter(Boolean).slice(0, 6);
    }, cls);
  };
  var marks = function () {   // the handles' span across, centre to centre plus one handle: the box marked
    return page.evaluate(function () {
      var hs = Array.prototype.map.call(document.querySelectorAll('.m2-ed-handle'), function (h) { return h.getBoundingClientRect(); });
      if (hs.length !== 4) return null;
      var L = Math.min.apply(null, hs.map(function (r) { return r.left + r.width / 2; })), R = Math.max.apply(null, hs.map(function (r) { return r.left + r.width / 2; }));
      return R - L;
    });
  };
  var check = async function (cls, said) {
    var cs = await circles(cls);
    ok(said + ': circles with sites drawn', cs.length > 0, cs.length + ' clicked');
    for (var k = 0; k < cs.length; k++) {
      await page.mouse.click(1, 1); await page.waitForTimeout(150);   // nothing selected
      await page.mouse.click(cs[k][0], cs[k][1]); await page.waitForTimeout(300);
      var w = await marks();
      ok(said + ': circle ' + (k + 1) + ' marked as drawn', w != null && Math.abs(w - cs[k][2]) < 2.5, 'marks ' + (w == null ? 'none' : w.toFixed(1)) + ', drawn ' + cs[k][2].toFixed(1));
    }
  };
  await check('sv-value', 'unticked');
  await page.click('.m2-ed-psites input'); await page.waitForTimeout(1200);
  await check('sv-site', 'ticked');
  ok('no page errors', !errs.length, errs.slice(0, 2).join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
