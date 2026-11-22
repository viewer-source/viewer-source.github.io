// Edit mode kept over a reload of the tab. GitHub is played by this script (page.route on api.github.com, files from a
// clone of the site's data repository). Per map (GraphML, CellDesigner, SBGN-ML): editing started, the map zoomed and
// panned, a node selected, moved and saved, then the page reloaded: no Leave page question, editing again, the map where
// it was (place and zoom), the node still selected, and no frame shown before editing started (the page revealed once,
// with the grid and the Edit window in place). A reload before the autosave asks Leave page, as before. The map's
// picture failing to load: editing starts all the same. A reload in view mode stays in view mode, and the same address
// opened in a new tab opens in view mode.
//   node tests/edit-reload.js <base address> <clone of the site's data repository> [--local]
// --local: the editor and the viewer of the working tree routed into the live page (the styles copy's changes since
// REV, default HEAD, applied to the page's text; run styles/update.sh first), to check before a release.
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
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage();
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
  await page.addInitScript(function () {   // frames shown with the Edit window open but editing not started yet: the blink
    window.__early = 0;
    var t0 = performance.now(), look = function () {
      var g = document.querySelector('.m2');
      if (g && !document.documentElement.classList.contains('m2-hold') && g.classList.contains('m2-win-edit') && !g.classList.contains('m2-editing')) window.__early++;
      if (performance.now() - t0 < 5000) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
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
  await page.route(/\/downloads\/[^/?#]+\.svg/, function (r) {
    if (noPic && r.request().url().indexOf('/downloads/' + noPic + '.svg') >= 0) return r.fulfill({ status: 404, body: '' });
    return r.continue();
  });
  var status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; }); };
  var now = function () { return page.evaluate(function () { var n = window.m2EditNow && window.m2EditNow(); return n ? n.text : null; }); };
  var editing = function () { return page.evaluate(function () { return document.querySelector('.m2').classList.contains('m2-editing'); }); };
  var view = function () { return page.$eval('#m2-img', function (i) { return [i.style.width, i.style.transform].join(' '); }); };
  var selCount = function () { return page.evaluate(function () { return document.querySelectorAll('#m2-edit-layer .m2-ed-handle').length; }); };
  var waitEdit = async function () { await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }); await page.waitForTimeout(1500); };
  var settle = async function () { await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500); };
  var pickNode = async function () {
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 350 && r.top > 120 && r.right < 1350 && r.bottom < 850) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(400);
  };
  var nudge = async function () { for (var i = 0; i < 3; i++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(120); } await page.waitForTimeout(500); };

  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-edit-level', 'full'); });
  var maps = (process.env.MAPS || 'glycolysis-graphml,glycolysis-celldesigner,testing-glycolysis-sbgn').split(',');
  for (var mi = 0; mi < maps.length; mi++) {
    var id = maps[mi];
    console.log('-- ' + id);
    puts.length = 0; dialogs.length = 0;
    await page.goto(base + '#' + id, { waitUntil: 'load' }); await settle();
    await page.click('.m2-ri[data-win="edit"]'); await waitEdit();
    await page.mouse.move(800, 450); await page.mouse.wheel(0, 120); await page.waitForTimeout(300);   // moved
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -200); await page.keyboard.up('Control'); await page.waitForTimeout(500);   // zoomed
    await pickNode();
    var sel0 = await selCount();
    await nudge();
    var moved = await now();
    await page.waitForTimeout(5500);   // saved
    var v0 = await view();
    ok('a node selected, moved and saved', sel0 > 0 && moved && puts.length === 1, 'handles ' + sel0 + ', ' + puts.length + ' saves');
    await page.reload({ waitUntil: 'load' }); await settle(); await waitEdit(); await page.waitForTimeout(1500);
    ok('no Leave page question once saved', !dialogs.length, dialogs.join(','));
    ok('editing again after the reload', await editing());
    ok('the map where it was', (await view()) === v0, v0 + ' | ' + (await view()));
    ok('the node still selected', (await selCount()) === sel0, (await selCount()) + ' handles');
    ok('the saved move there', (await now()) === moved);
    ok('no frame shown before editing started', (await page.evaluate(function () { return window.__early; })) === 0, (await page.evaluate(function () { return window.__early; })) + ' frames');
    // a reload before the autosave: the question as before
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);   // the node kept selected: a click on it would open its name
    await pickNode(); await nudge();
    dialogs.length = 0;
    await page.reload({ waitUntil: 'load' }); await settle();
    ok('a reload before the autosave asks Leave page', dialogs.indexOf('beforeunload') >= 0, dialogs.join(',') || 'no question');
    await waitEdit();
    // the map's picture failing to load: editing still starts
    noPic = id;
    await page.reload({ waitUntil: 'load' }); await settle();
    await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }).catch(function () {});
    ok('no picture: editing starts all the same', await editing());
    noPic = null;
    await page.waitForTimeout(5500);   // anything waiting saved
    await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'load' }); await settle();
    ok('a reload in view mode stays in view mode', !(await editing()) && !(await page.evaluate(function () { return document.querySelector('.m2').classList.contains('m2-win-edit'); })));
  }
  // the same address opened afresh after editing: view mode
  await page.click('.m2-ri[data-win="edit"]'); await waitEdit();
  var fresh = await ctx.newPage();
  fresh.on('pageerror', function (e) { errs.push(e.message); });
  await fresh.goto(page.url(), { waitUntil: 'load' }); await fresh.waitForTimeout(3000);
  ok('a new tab opens in view mode', !(await fresh.evaluate(function () { return document.querySelector('.m2').classList.contains('m2-editing'); })));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
