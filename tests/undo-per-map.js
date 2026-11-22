// Undo kept per map for the page's life. GitHub is played by this script (page.route on api.github.com, files from a
// clone of the site's data repository). With the Edit window on the right, a map edited and saved, another map chosen
// in the list and edited, the first chosen again: Cmd+Z takes the first map's change back and Cmd+Shift+Z gives it
// again, per format (GraphML, CellDesigner, SBGN-ML). With the Edit window on the left, editing left and the map edited
// again later: the same. A map whose file changed on GitHub while it was left: its history dropped, Cmd+Z does nothing.
//   node tests/undo-per-map.js <base address> <clone of the site's data repository> [--local]
// --local: the editor and the viewer of the working tree routed into the live page (as tests/edit-reload.js).
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

  var undoKey = async function (redo) { await page.keyboard.press(redo ? 'Control+Shift+KeyZ' : 'Control+KeyZ'); await page.waitForTimeout(1500); };
  var choose = async function (id) { await page.click('.m2-map[data-id="' + id + '"]'); await page.waitForTimeout(500); await waitEdit(); };
  var editNode = async function () { await page.keyboard.press('Escape'); await page.waitForTimeout(200); await pickNode(); await nudge(); };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-edit-side', 'right'); });
  var maps = (process.env.MAPS || 'glycolysis-graphml,glycolysis-celldesigner,testing-glycolysis-sbgn').split(',');
  var other = process.env.OTHER || 'glycogen-muscle-graphml';
  for (var mi = 0; mi < maps.length; mi++) {
    var id = maps[mi];
    console.log('-- ' + id + ', Edit window on the right');
    if (!mi) { await page.goto(base + '#' + id, { waitUntil: 'load' }); await settle(); await page.click('.m2-ri[data-win="edit"]'); await waitEdit(); }
    else await choose(id);   // the page stays (a new # alone does not reload it)
    var a0 = await now(); await editNode(); var a1 = await now();
    await page.waitForTimeout(5000);   // saved
    await choose(other);
    var b0 = await now(); await editNode(); var b1 = await now();
    ok('the other map edited', b1 && b1 !== b0);
    await page.waitForTimeout(5000);
    await choose(id);
    ok('back on the first map, its change there', (await now()) === a1 && a1 !== a0);
    await undoKey();
    ok('Cmd+Z takes the first map\'s change back', (await now()) === a0);
    await undoKey(true);
    ok('Cmd+Shift+Z gives it again', (await now()) === a1);
    await page.waitForTimeout(5000);
    await choose(other);
    await undoKey();
    ok('the other map\'s own history after it', (await now()) === b0);
    await page.waitForTimeout(5000);
    // its file changed on GitHub while left: the history dropped
    await choose(id); await page.waitForTimeout(5000); await choose(other);
    var p = Object.keys(body).filter(function (k) { return k.indexOf(id) >= 0 || k.indexOf(id.replace(/-(graphml|celldesigner|sbgn)$/, '')) >= 0; }).pop();
    if (p) { body[p] = body[p].replace(/(<\/[a-zA-Z:]+>\s*)$/, '$1\n'); sha[p] = 'elsewhere'; }
    await choose(id);
    var c0 = await now(); await undoKey();
    ok('a file changed elsewhere: nothing undone', p && (await now()) === c0, p || 'no saved file found');
    await page.waitForTimeout(5000);
  }
  // a glyph deleted on an SBGN-ML map, left, back, undone: the file as it was, byte for byte (its own parts the GraphML
  // does not carry, clones, notes, kept by writing from the file as first opened)
  var sbId = maps.filter(function (m) { return /sbgn/.test(m); })[0];
  if (sbId) {
    console.log('-- ' + sbId + ', a deletion undone after a switch');
    await choose(sbId);
    var d0 = await now();
    await page.keyboard.press('Escape'); await page.waitForTimeout(200); await pickNode();
    await page.keyboard.press('Delete'); await page.waitForTimeout(1500);
    var d1 = await now();
    await page.waitForTimeout(5000);
    await choose(other); await page.waitForTimeout(1000); await choose(sbId);
    await undoKey();
    ok('deleted, then undone after the switch: the file byte for byte', d1 !== d0 && (await now()) === d0, d1 === d0 ? 'nothing deleted' : '');
    await page.waitForTimeout(5000);
  }
  console.log('-- Edit window on the left');
  await page.evaluate(function () { localStorage.removeItem('atlas-edit-side'); });
  var id2 = maps[0];
  await page.goto(base + '#' + id2, { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' }); await settle();
  if (await editing()) { await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800); }
  await page.click('.m2-ri[data-win="edit"]'); await waitEdit();
  var l0 = await now(); await editNode(); var l1 = await now();
  await page.waitForTimeout(5000);
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  await page.click('.m2-map[data-id="' + other + '"]'); await page.waitForTimeout(1500);
  await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.click('.m2-map[data-id="' + id2 + '"]'); await page.waitForTimeout(1500);
  await page.click('.m2-ri[data-win="edit"]'); await waitEdit();
  ok('editing again, the change there', (await now()) === l1 && l1 !== l0);
  await undoKey();
  ok('Cmd+Z takes it back', (await now()) === l0);
  await page.waitForTimeout(5000);
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
