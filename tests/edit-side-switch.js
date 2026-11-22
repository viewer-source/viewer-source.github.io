// Settings, Editing, Edit panel chosen while editing: editing moves with the panel. From the Edit window on the left,
// Settings, Right: the panel on the right open and editing, the list on the left. Then Settings, Left: the Edit window
// in the list's place, still editing, the map not moved (also after a change to it). GitHub played by the script.
//   node tests/edit-side-switch.js <base address> <clone of the site's data repository> [--local]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var data = process.argv[3], local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
if (!data) { console.log('usage: node tests/edit-reload.js <base address> <clone of the data repository> [--local]'); process.exit(2); }
function editorNow() {   // editor.js joined as Jekyll joins it
  return require('./editor-now.js')(here);
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
  var b0 = await chromium.launch(), ctx = await b0.newContext({ viewport: { width: 1440, height: 760 } }), page = await ctx.newPage();
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
  var st = function () { return page.evaluate(function () { var g = document.querySelector('.m2'); return { editing: g.classList.contains('m2-editing'), right: g.classList.contains('m2-edit-right'), list: g.classList.contains('m2-win-list'), edwin: g.classList.contains('m2-win-edit') }; }); };
  var waitEdit = function () { return page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }).catch(function () {}); };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.removeItem('atlas-edit-side'); });
  var id = process.env.MAP || 'glycolysis-graphml';
  await page.goto(base + '#' + id, { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
  await page.click('.m2-ri[data-win="edit"]'); await waitEdit(); await page.waitForTimeout(1000);
  var s0 = await st();
  ok('editing on the left', s0.editing && s0.edwin, JSON.stringify(s0));
  var pos = function () { return page.evaluate(function () { var r = document.getElementById('m2-img').getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top); }); };
  var c0 = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 300 && r.top > 100 && r.right < 1400 && r.bottom < 740) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
  await page.mouse.click(c0[0], c0[1]); await page.waitForTimeout(400);
  for (var q = 0; q < 3; q++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(150); }
  await page.waitForTimeout(6000);   // a change, saved: the viewer then shows the edited drawing
  var p0 = await pos();
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(800);
  await page.click('#m2-set-eside button[data-eside="right"]'); await waitEdit(); await page.waitForTimeout(2000);
  var a = await st();
  ok('Right: still editing, the panel on the right, the list on the left', a.editing && a.right && a.list, JSON.stringify(a));
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(800);
  ok('Settings opened on the left: editing goes on', (await st()).editing);
  await page.click('#m2-set-eside button[data-eside="left"]'); await waitEdit(); await page.waitForTimeout(2000);
  var c = await st();
  ok('Left: still editing, the Edit window in the list\'s place', c.editing && !c.right && c.edwin, JSON.stringify(c));
  ok('the map not moved through Right and back to Left', (await pos()) === p0, p0 + ' then ' + (await pos()));
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(800);
  await page.click('#m2-set-eside button[data-eside="right"]'); await page.waitForTimeout(2000);
  var d = await st();
  ok('not editing before: Right does not start editing', !d.editing, JSON.stringify(d));
  ok('no script error', !errs.length, errs.join(' | '));
  await b0.close(); process.exit(bad ? 1 : 0);
})();
