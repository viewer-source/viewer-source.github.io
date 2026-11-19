// The Edit panel on the right: opened and closed, the map on screen does not move; a map chosen while it is open opens
// centred in the map window between the two panels. GitHub played by the script.
//   node tests/edit-right-centre.js <base address> <clone of the site's data repository> [--local]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var data = process.argv[3], local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
if (!data) { console.log('usage: node tests/edit-reload.js <base address> <clone of the data repository> [--local]'); process.exit(2); }
function editorNow() {   // editor.js joined as Jekyll joins it
  var read = function (f) { return fs.readFileSync(path.join(here, 'editor', f), 'utf8'); };
  return read('editor.js').replace(/^---[\s\S]*?---\n/, '').replace(/\{% include_relative (\S+) %\}/g, function (m, f) { return read(f); });
}
function viewerHunks() {   // [old, new] pieces of the viewer's file changed since HEAD, to apply to the live page's text
  // the styles page's copy (what /styles/ serves) at REV (default HEAD; the commit live now) against the working tree
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '../styles/_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString();
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
    await page.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
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
  var off = function () { return page.evaluate(function () {
    var v = document.querySelector('#m2-view') || document.getElementById('m2-img').parentNode, i = document.getElementById('m2-img');
    var a = v.getBoundingClientRect(), b = i.getBoundingClientRect();
    return { d: (b.left + b.width / 2) - (a.left + a.width / 2), vw: a.width, w: b.width };
  }); };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-edit-side', 'right'); });
  var id = process.env.MAP || 'glycolysis-graphml';
  await page.goto(base + '#' + id, { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
  var a = await off();
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(2500);
  var b = await off();
  ok('panel open: the map window narrower', b.vw < a.vw - 100, a.vw + ' to ' + b.vw);
  ok('panel open: the map on screen not moved', Math.abs((b.d - (a.vw - b.vw) / 2) - a.d) < 2 && Math.abs(b.w - a.w) < 1, 'offset ' + a.d.toFixed(1) + ' then ' + b.d.toFixed(1));
  var others = (process.env.NEXT || 'glycogen-liver-graphml,glycolysis-celldesigner,colour-glycolysis-sbgn,enos-graphml').split(',');
  for (var i = 0; i < others.length; i++) {
    await page.click('.m2-map[data-id="' + others[i] + '"]'); await page.waitForTimeout(4000);
    var n = await off();
    ok('next map ' + others[i] + ' centred between the panels', Math.abs(n.d) < 2, 'offset ' + n.d.toFixed(1) + ', window ' + n.vw + ', map ' + n.w.toFixed(0));
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b0.close(); process.exit(bad ? 1 : 0);
})();
