// Undo by place: Cmd+Z and Cmd+Shift+Z, and the Edit window's Undo and Redo, go to the list's history when the last
// press was in the list, else to the map being edited, whichever step is newer (a setting newer than that place's step
// first, as tests/undo-settings.js checks). A move on the map and a group added in the list, undone and redone from each.
//   node tests/undo-place.js <base address> <clone of the site's data repository> [--local]
// --local: the editor and the viewer of the working tree routed into the live page (as tests/edit-reload.js).
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var data = process.argv[3], local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
if (!data) { console.log('usage: node tests/undo-place.js <base address> <clone of the data repository> [--local]'); process.exit(2); }
function editorNow() {   // editor.js joined as Jekyll joins it
  return require('./editor-now.js')(here);
}
function viewerHunks() {   // [old, new] pieces of the styles page's viewer changed since REV (default HEAD), for the live page's text
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
  var errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { d.accept().catch(function () {}); });
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
  var sha = {};
  await page.route('https://api.github.com/**', async function (route) {
    var r = route.request(), u = new URL(r.url()), m = u.pathname.match(/^\/repos\/[^/]+\/[^/]+(\/.*)?$/), rest = m ? m[1] || '' : '';
    var json = function (s, o) { return route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(o) }); };
    if (!m) return json(404, {});
    if (rest === '') return json(200, { permissions: { push: true } });
    var c = rest.match(/^\/contents\/(.+)$/);
    if (c && r.method() === 'PUT') { var p = decodeURIComponent(c[1]); sha[p] = 'saved' + Date.now(); return json(200, { content: { sha: sha[p] } }).catch(function () {}); }
    if (c) {
      var p2 = decodeURIComponent(c[1].split('?')[0]), f = path.join(data, p2);
      var text = fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f, 'utf8') : null;
      if (text == null) return json(404, { message: 'Not Found' });
      if (!sha[p2]) sha[p2] = 'start';
      if (/raw/.test(r.headers().accept || '')) return route.fulfill({ status: 200, contentType: 'text/plain', body: text });
      return json(200, { sha: sha[p2], content: Buffer.from(text).toString('base64') });
    }
    if (/dispatches$/.test(rest)) return route.fulfill({ status: 204, body: '' });
    return json(404, { message: 'Not Found' });
  });
  var now = function () { return page.evaluate(function () { var n = window.m2EditNow && window.m2EditNow(); return n ? n.text : null; }); };
  var waitEdit = async function () { await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }); await page.waitForTimeout(1500); };
  var settle = async function () { await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500); };
  var key = async function (redo) { await page.keyboard.press(redo ? 'Control+Shift+KeyZ' : 'Control+KeyZ'); await page.waitForTimeout(1500); };
  var btn = async function (redo) { await page.click(redo ? '#m2-ed-redo' : '#m2-ed-undo'); await page.waitForTimeout(1500); };
  var groups = function () { return page.$$eval('#m2-list .m2-group', function (l) { return l.map(function (x) { return x.textContent; }).join('|'); }); };
  var hasGroup = async function () { return (await groups()).indexOf('Place test group') >= 0; };
  var onMap = async function () { await page.mouse.click(1000, 860); await page.waitForTimeout(300); };   // empty map space, the last press on the map
  var inList = async function () {   // empty room in the list, the last press in the list
    var p = await page.$eval('#m2-list', function (l) { var r = l.getBoundingClientRect(), b = 0; l.querySelectorAll('*').forEach(function (x) { var q = x.getBoundingClientRect(); if (q.height) b = Math.max(b, q.bottom); }); return [r.left + 20, Math.min(r.bottom - 4, b + 12)]; });
    await page.mouse.click(p[0], p[1]); await page.waitForTimeout(300);
  };
  var pickNode = async function () {
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 450 && r.top > 120 && r.right < 1050 && r.bottom < 800) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(400);
  };
  var move = async function () { await page.keyboard.press('Escape'); await pickNode(); for (var i = 0; i < 3; i++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(120); } await page.waitForTimeout(1500); };
  var addGroup = async function () {
    await page.click('#m2-list .m2-map[data-id="' + id + '"]', { button: 'right' }); await page.waitForTimeout(300);
    var ag = await page.$('.m2-cx button:text-is("Add group")');
    if (!ag) return false;
    await ag.click(); await page.waitForTimeout(500); await page.keyboard.type('Place test group'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    return hasGroup();
  };

  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-edit-side', 'right'); });
  var id = process.env.MAP || 'glycolysis-celldesigner';
  await page.goto(base + '#' + id, { waitUntil: 'load' }); await settle();
  await page.click('.m2-ri[data-win="edit"]'); await waitEdit();
  ok('the list shown beside the Edit window', await page.$eval('#m2-list', function (l) { return !!l.offsetParent; }));

  // a move on the map, then a group in the list (the newer): undo goes where the last press was, keys and buttons alike
  for (var how of ['button', 'keys']) {
    console.log('-- ' + how);
    var u = how === 'button' ? btn : key;
    var t0 = await now(); await move(); var t1 = await now();
    ok('a node moved', t1 && t1 !== t0);
    ok('Add group: the group there', await addGroup());
    await onMap(); await u();
    ok('a press on the map, then Undo: the move undone, the newer group kept', (await now()) === t0 && await hasGroup());
    await u(true);
    ok('Redo: the move again', (await now()) === t1 && await hasGroup());
    await inList(); await u();
    ok('a press in the list, then Undo: the group undone, the map as it was', !(await hasGroup()) && (await now()) === t1);
    await u(true);
    ok('Redo: the group again', await hasGroup());
    await u();
    ok('Undo again: the group undone (the press still in the list)', !(await hasGroup()));
    await onMap(); await u();
    ok('a press on the map: the move undone', (await now()) === t0);
  }
  if (errs.length) ok('no page errors', false, errs.join(' | '));
  console.log(bad ? bad + ' WRONG' : 'all ok');
  await b.close(); process.exit(bad ? 1 : 0);
})().catch(function (e) { console.log('WRONG ' + e.message); process.exit(1); });
