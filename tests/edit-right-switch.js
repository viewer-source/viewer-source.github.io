// Edit panel on the right: a move made, then another map clicked in the list at once, while the move is still being
// drawn. The map left must reach GitHub (played by this script) and keep the move when opened again. MAP the map moved
// (default glycolysis-celldesigner), FILE a piece of its file's path, NEXT the map clicked, SLOW=1 the browser six
// times slower. Checked on GraphML, CellDesigner and SBGN-ML maps.
//   node tests/edit-right-switch.js <base address> <clone of the site's data repository> [--local]
// The Edit panel on the right: opened and closed, the map on screen does not move; a map chosen while it is open opens
// centred in the map window between the two panels. GitHub played by the script.
//   node tests/edit-right-centre.js <base address> <clone of the site's data repository> [--local]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var base = process.argv[2] || 'https://viewer-source.github.io/';
var data = process.argv[3], local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
if (!data) { console.log('usage: node tests/edit-right-switch.js <base address> <clone of the data repository> [--local]'); process.exit(2); }
function editorNow() {   // editor.js joined as Jekyll joins it
  return require('./editor-now.js')(here);
}
function viewerHunks() {   // [old, new] pieces of the viewer's file changed since HEAD, to apply to the live page's text
  // the page's include (what the root serves) at REV (default HEAD; the commit live now) against the working tree
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString();
  var out = [];
  d.split(/\n(?=@@ )/).slice(1).forEach(function (h) {
    var o = [], n = [];
    h.split('\n').slice(1).forEach(function (l) {
      if (l[0] === ' ') { o.push(l.slice(1)); n.push(l.slice(1)); } else if (l[0] === '-') o.push(l.slice(1)); else if (l[0] === '+') n.push(l.slice(1));
    });
    out.push([o.join('\n'), n.join('\n')]);
  });
  return out;
}
(async function () {
  var b0 = await chromium.launch(), ctx = await b0.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
  var errs = [], dialogs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { dialogs.push(d.type()); d.accept().catch(function () {}); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  if (local) {
    var ed = editorNow(), hunks = viewerHunks();
    await page.route(/\.io\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(function (u) { return u.href.split('#')[0] === base.split('#')[0]; }, async function (r) {
      var res = await r.fetch(), t = await res.text(), miss = 0;
      hunks.forEach(function (h) { if (t.indexOf(h[0]) < 0) miss++; else t = t.replace(h[0], function () { return h[1]; }); });
      if (miss) console.log('WRONG the viewer\'s changes did not apply to the page (' + miss + ' of ' + hunks.length + ')');
      r.fulfill({ response: res, body: t, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) });
    });
  }
  var sha = {}, puts = [], body = {}, noPic = null;
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '';
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (rest === '') return json(200, { permissions: { push: true } });
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && r.method() === 'PUT') {
      var p = decodeURIComponent(c[1]), d = JSON.parse(r.postData());
      if (sha[p] && d.sha !== sha[p]) return json(409, { message: 'test: sha does not match' });
      body[p] = Buffer.from(d.content, 'base64').toString('utf8'); sha[p] = 'saved' + (puts.length + 1); puts.push(p);
      return json(200, { content: { sha: sha[p] } }).catch(function () {});
    }
    if (c) {
      var p2 = decodeURIComponent(c[1].split('?')[0]), f = path.join(data, p2);
      var text = body[p2] != null ? body[p2] : fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null;
      if (text == null) return json(404, { message: 'Not Found' });
      if (!sha[p2]) sha[p2] = 'start';
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: text });
      return json(200, { sha: sha[p2], content: Buffer.from(text).toString('base64') });
    }
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    return json(404, { message: 'Not Found' });
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-edit-side', 'right'); });
  var id = process.env.MAP || 'glycolysis-celldesigner', next = process.env.NEXT || 'glycolysis-graphml';
  await page.goto(base + '#' + id, { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }); await page.waitForTimeout(2000);
  var cs = await page.$$eval('#m2-img [data-n]', function (l) { var out = []; for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 350 && r.top > 120 && r.right < 1100 && r.bottom < 850) out.push([r.left + r.width / 2, r.top + r.height / 2]); } return out; });
  var c = null;
  for (var ci = 0; ci < cs.length && !c; ci++) { await page.keyboard.press('Escape'); await page.mouse.click(cs[ci][0], cs[ci][1]); await page.waitForTimeout(300);
    if ((await page.evaluate(function () { return document.querySelectorAll('#m2-edit-layer .m2-ed-handle').length; })) === 8) c = cs[ci]; }
  var before = await page.evaluate(function () { return window.m2EditNow().text; });
  if (process.env.SLOW) { var cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 }); }
  await page.keyboard.press('Shift+ArrowRight');
  await page.click('.m2-map[data-id="' + next + '"]');   // at once, while the move is still being drawn
  await page.waitForTimeout(process.env.SLOW ? 25000 : 9000);
  var mine = puts.filter(function (p) { return p.indexOf(process.env.FILE || 'glycolysis') >= 0; });
  console.log('saves: ' + JSON.stringify(puts));
  var status = await page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; });
  console.log('status on the next map: ' + JSON.stringify(status));
  ok('the move of the map left reached GitHub', mine.length > 0);
  await page.click('.m2-map[data-id="' + id + '"]'); await page.waitForTimeout(process.env.SLOW ? 15000 : 6000);
  var back = await page.evaluate(function () { var n = window.m2EditNow && window.m2EditNow(); return n ? n.text : null; });
  ok('going back: the move is there', back && back !== before);
  console.log('saves after going back: ' + JSON.stringify(puts));
  ok('no script error', !errs.length, errs.join(' | '));
  await b0.close(); process.exit(bad ? 1 : 0);
})();
