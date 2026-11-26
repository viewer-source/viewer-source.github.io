// The read-ahead entry kept on leaving edit (core.js keepAhead, with a token only) goes on serving the read-ahead and the
// next opening: a map edited with a token and left with a move, another map shown, the first shown again (the sweep reads
// its kept entry ahead), then edited again. GraphML and CellDesigner; an SBGN-ML map whose edited copy is not on GitHub
// yet, left with no move and edited again (the first save makes the copy). No page error (a TypeError in the sweep stops
// the read-ahead quietly) and editing starts again. GitHub is played by this script, files from a clone of the site's
// data repository.
//   node tests/ahead-kept.js <clone of the site's data repository> [base address] [--local] --data=<clone of the data repository>
// --local: the working tree's editor and renderers routed in
var path = require('path'), fs = require('fs'), { chromium } = require('playwright'), editorNow = require('./editor-now.js'), OM = require('./lib/open-map.js');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a.slice(0, 2) !== '--'; });
var data = args[0], base = args[1] || 'https://viewer-source.github.io/styles/', here = path.join(__dirname, '..');
var MAPS = { graphml: 'glycolysis-graphml', celldesigner: 'glycolysis-celldesigner', sbgn: 'glycolysis-sbgn' }, OTHER = 'glycolysis-graphml';   // sbgn: an example's SBGN-ML copy, the kind whose edited copy may be missing on GitHub
if (!data) { console.log('usage: node tests/ahead-kept.js <clone of the data repository> [base address] [--local] --data=<clone of the data repository>'); process.exit(2); }
(async function () {
  var b = await chromium.launch(), bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  for (var kind of Object.keys(MAPS)) {
    var ref = MAPS[kind], other = ref === OTHER ? MAPS.celldesigner : OTHER;
    var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
    page.setDefaultTimeout(120000);
    page.on('pageerror', function (e) { errs.push(e.message); });
    if (local) {
      var ed = editorNow(here);
      await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
      await page.route(/\/renderers\/(converter|yrender|layout)\/[^/?]+\.js/, function (r) {
        var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]);
        if (fs.existsSync(fp)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue();
      });
    }
    var noCopy = kind === 'sbgn', sha = {}, body = {};   // SBGN-ML: its edited copy (maps/sbgn-ml/...) not on GitHub
    await page.route('https://api.github.com/**', async function (route) {
      var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '';
      var json = function (st, o) { return route.fulfill({ status: st, contentType: 'application/json', body: JSON.stringify(o) }); };
      if (!m) return json(404, {});
      if (rest === '') return json(200, { permissions: { push: true } });
      var c = rest.match(/^\/contents\/(.+)$/);
      if (c && r.method() === 'PUT') { var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData()); body[p] = Buffer.from(d.content, 'base64').toString('utf8'); sha[p] = 'saved' + Object.keys(body).length; return json(200, { content: { sha: sha[p] } }).catch(function () {}); }
      if (c) {
        var p2 = decodeURIComponent(c[1].split('?')[0]), f = path.join(data, p2);
        var text = body[p2] != null ? body[p2] : noCopy && /^maps\/sbgn-ml\//.test(p2) ? null : fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null;
        if (text == null) return json(404, { message: 'Not Found' });
        if (!sha[p2]) sha[p2] = 'start';
        if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: text });
        return json(200, { sha: sha[p2], content: Buffer.from(text).toString('base64') });
      }
      if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
      return json(404, { message: 'Not Found' });
    });
    await page.goto(base, { waitUntil: 'load' });
    await page.evaluate(function () { localStorage.clear(); });
    var id = await OM.resolve(page, base, ref);   // a test-set map added with no token, so it is kept in this browser
    await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-edit-level', 'full'); });
    await OM.byAddress(page, base, id);
    await page.waitForSelector('.m2-ri[data-win="edit"]'); await page.waitForTimeout(2500);
    var editing = function () { return page.waitForFunction(function (id) { var n = window.m2EditNow && window.m2EditNow(); return !!(n && n.id === id); }, id, { timeout: 60000 }).then(function () { return true; }, function () { return false; }); };
    await page.click('.m2-ri[data-win="edit"]');
    ok(kind + ': editing', await editing());
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 350 && r.top > 120 && r.right < 1350 && r.bottom < 850) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
    if (c && !noCopy) { await page.mouse.click(c[0], c[1]); await page.waitForTimeout(400); await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(800); }
    await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(1500);   // editing left with a move: its entry kept (keepAhead)
    await page.click('#m2-list .m2-map[data-id="' + other + '"]'); await page.waitForTimeout(6000);
    await page.click('#m2-list .m2-map[data-id="' + id + '"]'); await page.waitForTimeout(8000);   // the sweep reads the kept entry ahead
    await page.click('.m2-ri[data-win="edit"]');
    var again = await editing(), st = await page.evaluate(function () { var s = document.querySelector('#m2-ed-status'); return s ? s.textContent : ''; });
    ok(kind + ': edited again after leaving and coming back', again, again ? '' : st);
    ok(kind + ': no page errors', !errs.length, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all right');
  process.exit(bad ? 1 : 0);
})();
