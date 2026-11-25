// A GraphML map moved whole keeps every group's Insets and BorderInsets as its file gives them (core.js refit, wholeMove:
// a group that moved by one step with all its members and no size changed is not refitted). Every node selected
// (Cmd+A) and moved by the arrow keys; read from the editor's text, nothing saved (no token). On eNOS GraphML the
// editor before the fix rewrote all 23 groups' insets.
//   node tests/insets-kept.js [map id] [--local]   (default enos-graphml; --local: the working tree's editor routed in)
var path = require('path'), fs = require('fs'), { chromium } = require('playwright'), here = path.join(__dirname, '..'), editorNow = require('./editor-now.js');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a !== '--local'; });
var id = args[0] || 'enos-graphml', base = 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage(), errs = [], bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  page.on('pageerror', function (e) { errs.push(e.message); });
  if (local) {
    var ed = editorNow(here);
    await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/(converter|yrender|layout)\/[^/?]+\.js/, function (r) { var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]); if (fs.existsSync(fp)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue(); });
  }
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-edit-side', 'right'); });
  await page.goto(base + '#' + id, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]'); await page.waitForTimeout(2500);
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function (id) { var n = window.m2EditNow && window.m2EditNow(); return !!(n && n.id === id); }, id, { timeout: 60000 }); await page.waitForTimeout(1500);
  var txt = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  // each group's (a node holding a graph) Insets and BorderInsets tags, by its id
  var insets = function (t) {
    var o = {}, re = /<node\b[^>]*\sid="([^"]+)"[^>]*yfiles\.foldertype="group"[^>]*>([\s\S]*?)<graph\b/g, m;
    while ((m = re.exec(t))) o[m[1]] = (m[2].match(/<y:(Border)?Insets\b[^>]*>/g) || []).join(' ');
    return o;
  };
  var t0 = await txt(), g0 = insets(t0), ids = Object.keys(g0);
  ok('the map has groups', ids.length > 0, String(ids.length));
  var c = await page.$eval('#m2-img', function (e) { var r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(c[0], c[1]);
  await page.keyboard.press('Meta+a'); await page.waitForTimeout(400);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(1500);
  var t1 = await txt(), g1 = insets(t1);
  ok('the map moved', t1 !== t0);
  var changed = ids.filter(function (k) { return g1[k] !== g0[k]; });
  ok('every group moved whole keeps its insets (' + ids.length + ')', !changed.length, changed.slice(0, 3).map(function (k) { return k + ': ' + g0[k] + ' -> ' + g1[k]; }).join(' | '));
  console.log(errs.length ? 'WRONG page errors: ' + errs.slice(0, 2).join(' | ') : 'ok    no page errors');
  if (errs.length) bad++;
  console.log(bad ? bad + ' WRONG' : 'all ok');
  await b.close(); process.exit(bad ? 1 : 0);
})();
