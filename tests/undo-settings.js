// Undo of settings: Cmd+Z and Cmd+Shift+Z, and the Edit window's Undo and Redo, take back and
// give again a change of Grid size, Grid, Snap, Settings' rows (Layout only, Drag selects an area, Paddings, File
// extensions), the palette's Reduced notation tick box; with a map's change and a setting's mixed, in the order made.
// Outside editing too (the list's undo when its last change is older). GitHub is played by this script, as in
// tests/undo-per-map.js.
//   node tests/undo-settings.js <base address> <clone of the site's data repository> [--local] --data=<clone of the data repository>
// --local: the editor and the viewer of the working tree routed into the live page (as tests/edit-reload.js).
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process'), OM = require('./lib/open-map.js');
var pos = process.argv.slice(2).filter(function (a) { return a.slice(0, 2) !== '--'; });
var base = pos[0] || 'https://viewer-source.github.io/styles/';
var data = pos[1], local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
if (!data) { console.log('usage: node tests/undo-settings.js <base address> <clone of the data repository> [--local] --data=<clone of the data repository>'); process.exit(2); }
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
  var key = async function (redo) { await page.keyboard.press(redo ? 'Control+Shift+KeyZ' : 'Control+KeyZ'); await page.waitForTimeout(700); };
  var gsize = function () { return page.$eval('#m2-ed-gsize', function (i) { return i.value; }); };
  var pressed = function (s) { return page.$eval(s, function (x) { return x.getAttribute('aria-pressed'); }); };
  var ls = function (k) { return page.evaluate(function (k) { return localStorage.getItem(k); }, k); };
  var pickNode = async function () {
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 350 && r.top > 120 && r.right < 1350 && r.bottom < 850) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(400);
  };
  var setSize = async function (v) { await page.fill('#m2-ed-gsize', String(v)); await page.press('#m2-ed-gsize', 'Enter'); await page.waitForTimeout(400); };

  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); });
  // the SBGN-ML map of the palette's part, from the test set unless named: added before the token, so kept in this browser
  var pm = await OM.resolve(page, base, process.env.PALMAP || 'testing-glycolysis-sbgn');
  await page.evaluate(function () { localStorage.setItem('atlas-edit-token', 'test-token'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-edit-side', 'right'); });
  var id = await OM.resolve(page, base, process.env.MAP || 'glycolysis-celldesigner');
  await OM.byAddress(page, base, id); await settle();
  await page.click('.m2-ri[data-win="edit"]'); await waitEdit();

  console.log('-- Grid size, Grid, Snap');
  var g0 = await gsize(), g1 = g0 === '32' ? '16' : '32';
  await setSize(g1);
  ok('grid size changed', (await gsize()) === g1);
  await key(); ok('Cmd+Z: grid size back', (await gsize()) === g0, await gsize());
  await key(true); ok('Cmd+Shift+Z: grid size again', (await gsize()) === g1);
  await page.click('#m2-ed-undo'); await page.waitForTimeout(500); ok('Undo button: grid size back', (await gsize()) === g0);
  await page.click('#m2-ed-redo'); await page.waitForTimeout(500); ok('Redo button: grid size again', (await gsize()) === g1);
  var sh0 = await pressed('#m2-ed-grid');
  await page.click('#m2-ed-grid'); await page.waitForTimeout(300);
  ok('Grid switched', (await pressed('#m2-ed-grid')) !== sh0);
  await key(); ok('Cmd+Z: Grid as it was', (await pressed('#m2-ed-grid')) === sh0);
  var sn0 = await pressed('#m2-ed-snap');
  await page.click('#m2-ed-snap'); await page.waitForTimeout(300);
  await key(); ok('Cmd+Z: Snap as it was', (await pressed('#m2-ed-snap')) === sn0);

  console.log('-- a map change and a setting, in the order made');
  var t0 = await now();
  await page.keyboard.press('Escape'); await pickNode();
  for (var i = 0; i < 3; i++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
  var t1 = await now();
  ok('a node moved', t1 && t1 !== t0);
  await setSize(g0 === '8' ? '64' : '8'); var g2 = await gsize();
  await page.mouse.click(700, 880); await page.waitForTimeout(200);   // the keys back on the page
  await key(); ok('first Cmd+Z: the grid size (the newer)', (await gsize()) !== g2 && (await now()) === t1, await gsize());
  await key(); await page.waitForTimeout(1200); ok('second Cmd+Z: the move', (await now()) === t0);
  await key(true); await page.waitForTimeout(1200); ok('Cmd+Shift+Z: the move again first', (await now()) === t1 && (await gsize()) !== g2);
  await key(true); ok('Cmd+Shift+Z: then the grid size', (await gsize()) === g2);

  console.log('-- the palette\'s Reduced notation tick box');
  var pin = '.m2-ed-pstrict input';
  if (await page.$(pin) && await page.$eval(pin, function (x) { return !!x.offsetParent; })) {
    var c0 = await page.$eval(pin, function (x) { return x.checked; });
    await page.click(pin); await page.waitForTimeout(300);
    ok('ticked or unticked', (await page.$eval(pin, function (x) { return x.checked; })) !== c0);
    await key(); ok('Cmd+Z: as it was', (await page.$eval(pin, function (x) { return x.checked; })) === c0);
  } else ok('the palette\'s Reduced notation shown', false);

  console.log('-- Settings, while editing');
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(800);
  var grab0 = await page.$eval('#m2-set-grab', function (x) { return x.checked; });
  await page.click('#m2-set-grab'); await page.waitForTimeout(300);
  await key(); ok('Cmd+Z: Drag selects an area as it was', (await page.$eval('#m2-set-grab', function (x) { return x.checked; })) === grab0 && (await ls('atlas-drag-moves')) === null);
  await page.selectOption('#m2-set-pad-comp', '24'); await page.waitForTimeout(300);
  ok('Paddings: Compartments 24', JSON.parse((await ls('atlas-edit-padding')) || '{}').comp === 24);
  await key(); ok('Cmd+Z: Compartments back', (await page.$eval('#m2-set-pad-comp', function (x) { return x.value; })) === '12' && JSON.parse((await ls('atlas-edit-padding')) || '{}').comp == null);
  await key(true); ok('Cmd+Shift+Z: 24 again', (await page.$eval('#m2-set-pad-comp', function (x) { return x.value; })) === '24');

  console.log('-- outside editing');
  await page.goto(base + '#' + id, { waitUntil: 'load' }); await page.evaluate(function () { localStorage.removeItem('atlas-edit-side'); }); await page.reload({ waitUntil: 'load' }); await settle();
  if (await page.evaluate(function () { return document.querySelector('.m2').classList.contains('m2-editing'); })) { await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800); }
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(800);
  var f0 = await page.$eval('#m2-set-formats', function (x) { return x.checked; });
  if (await page.$eval('#m2-set-formats', function (x) { return !!x.offsetParent; })) {
    await page.click('#m2-set-formats'); await page.waitForTimeout(400);
    await key(); ok('Cmd+Z: File extensions as they were', (await page.$eval('#m2-set-formats', function (x) { return x.checked; })) === f0);
    await key(true); ok('Cmd+Shift+Z: changed again', (await page.$eval('#m2-set-formats', function (x) { return x.checked; })) !== f0);
  } else console.log('-     File extensions not offered on this page');
  // a list change, then a setting: Cmd+Z the setting first, then the list's (a click in the list gives it the keys)
  var groups = function () { return page.$$eval('#m2-list .m2-group', function (l) { return l.map(function (x) { return x.textContent; }).join('|'); }); };
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(800);
  var gr0 = await groups();
  await page.click('#m2-list .m2-map[data-id="' + id + '"]', { button: 'right' }); await page.waitForTimeout(300);
  var ag = await page.$('.m2-cx button:text-is("Add group")');
  if (ag) {
    await ag.click(); await page.waitForTimeout(500);
    await page.keyboard.type('Undo test group'); await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    ok('Add group: the group there', (await groups()).indexOf('Undo test group') >= 0);
    await page.click('#m2-list .m2-map[data-id="' + id + '"]', { button: 'right' }); await page.waitForTimeout(300);
    var ext = await page.$('.m2-cx button:text-matches("file extensions")'), e0 = await ls('atlas-format-ext');
    if (ext) {
      await ext.click(); await page.waitForTimeout(500);
      await page.click('#m2-list .m2-map[data-id="' + id + '"]'); await page.waitForTimeout(800);
      await key(); ok('Cmd+Z after a list change and a setting: the setting first', (await ls('atlas-format-ext')) === e0 && (await groups()).indexOf('Undo test group') >= 0);
      await key(); await page.waitForTimeout(1500); ok('Cmd+Z again: the group undone', (await groups()) === gr0);
    } else ok('the list menu offers file extensions', false);
  } else ok('the list menu offers Add group', false);
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(800);
  var lay0 = await page.$eval('#m2-set-edit', function (x) { return x.checked; });
  if (await page.$eval('#m2-set-edit', function (x) { return !!x.offsetParent; })) {
    await page.click('#m2-set-edit'); await page.waitForTimeout(300);
    await key(); ok('Cmd+Z: Layout only as it was', (await page.$eval('#m2-set-edit', function (x) { return x.checked; })) === lay0);
  }
  // Map size (a slider: one step from its start to where it is let go), Source (its buttons and the S key), shapes
  var lsIs = async function (k, v, what) { ok(what, (await ls(k)) === v, String(await ls(k))); };
  var sz0 = await ls('atlas-map-size');
  await page.focus('#m2-set-size'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400);   // one key, one step
  await page.mouse.click(700, 880); await page.waitForTimeout(200);
  ok('Map size changed', (await ls('atlas-map-size')) !== sz0);
  await key(); await lsIs('atlas-map-size', sz0, 'Cmd+Z: Map size back');
  var sbId = await OM.resolve(page, base, process.env.SBMAP || 'glycolysis-celldesigner');
  await OM.byAddress(page, base, sbId); await settle();
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(800);
  if (await page.$eval('.m2-set-source', function (x) { return x.style.display !== 'none'; }).catch(function () { return false; })) {
    var src0 = await ls('atlas-map-source');
    await page.keyboard.press('KeyS'); await page.waitForTimeout(1500);
    ok('S: the other source', (await ls('atlas-map-source')) !== src0);
    await key(); await page.waitForTimeout(1500); await lsIs('atlas-map-source', src0, 'Cmd+Z: Source back');
    await key(true); await page.waitForTimeout(1500); ok('Cmd+Shift+Z: the other source again', (await ls('atlas-map-source')) !== src0);
    if (await page.$eval('.m2-set-shapes', function (x) { return x.style.display !== 'none'; }).catch(function () { return false; })) {
      var sh0b = await ls('atlas-sbgn-shapes'), other = sh0b === 'process' ? 'specific' : 'process';
      await page.$eval('#m2-set-shapes button[data-shapes="' + other + '"]', function (x) { x.click(); }); await page.waitForTimeout(1200);
      ok('Shapes changed', (await ls('atlas-sbgn-shapes')) !== sh0b);
      await key(); await page.waitForTimeout(1200); await lsIs('atlas-sbgn-shapes', sh0b, 'Cmd+Z: Shapes back');
    } else console.log('-     Shapes not offered on ' + sbId);
    await key(); await page.waitForTimeout(1500); await lsIs('atlas-map-source', src0, 'Cmd+Z: Source back once more');
  } else ok('Source offered on ' + sbId, false);

  console.log('-- the palette on an SBGN-ML map (PD or AF, Style, Set as default), Complexes');
  await page.evaluate(function () { localStorage.setItem('atlas-edit-side', 'right'); });
  await OM.byAddress(page, base, pm); await page.reload({ waitUntil: 'load' }); await settle();
  if (!(await page.evaluate(function () { return document.querySelector('.m2').classList.contains('m2-editing'); }))) { await page.click('.m2-ri[data-win="edit"]'); }
  await waitEdit();
  var entry = async function (k) { return page.evaluate(function (a) { var o = JSON.parse(localStorage.getItem(a[0]) || '{}'); var ks = Object.keys(o).filter(function (x) { return x.indexOf(a[1]) >= 0; }); return ks.length ? JSON.stringify(o[ks[0]]) : null; }, [k, pm.replace(/-sbgn$/, '')]); };
  var pal0 = await entry('atlas-edit-palette');
  var lang0 = await page.$eval('.m2-ed-palette button[data-lang="pd"]', function (b) { return b.getAttribute('aria-pressed') || b.className; });
  await page.click('.m2-ed-palette button[data-lang="af"]'); await page.waitForTimeout(500);
  ok('AF chosen', (await entry('atlas-edit-palette')) !== pal0 && /"af"/.test(await entry('atlas-edit-palette')), await entry('atlas-edit-palette'));
  await page.mouse.click(700, 880); await page.waitForTimeout(200);
  await key(); ok('Cmd+Z: PD again', (await entry('atlas-edit-palette')) === pal0 || /"pd"/.test(await entry('atlas-edit-palette') || '"pd"'), await entry('atlas-edit-palette'));
  await key(true); ok('Cmd+Shift+Z: AF again', /"af"/.test(await entry('atlas-edit-palette') || ''));
  await key(); ok('Cmd+Z: PD', !/"af"/.test(await entry('atlas-edit-palette') || ''));
  var st0 = await entry('atlas-edit-map-choices');
  var dd = await page.$('tr[data-k="style"] .m2-ed-pdd');
  if (dd) {
    await dd.click(); await page.waitForTimeout(300);
    await page.click('.m2-ed-pdl button:has-text("Standard sizes")'); await page.waitForTimeout(400);
    ok('Style: Standard sizes', /"style":"default"/.test(await entry('atlas-edit-map-choices') || ''), await entry('atlas-edit-map-choices'));
    await key(); ok('Cmd+Z: Style back', !/"style":"default"/.test(await entry('atlas-edit-map-choices') || ''), await entry('atlas-edit-map-choices'));
    await key(true); ok('Cmd+Shift+Z: Standard sizes again', /"style":"default"/.test(await entry('atlas-edit-map-choices') || ''));
    await key();
  } else ok('Style row shown', false);
  var def0 = await ls('atlas-edit-defaults'), ch0 = await entry('atlas-edit-map-choices');
  await page.keyboard.press('Escape'); await pickNode();
  var pdef = await page.$('.m2-ed-pdef');
  if (pdef && await pdef.isVisible()) {
    await pdef.click(); await page.waitForTimeout(500);
    ok('Set as default: a look kept, Style Custom', (await ls('atlas-edit-defaults')) !== def0 && /"style":"custom"/.test(await entry('atlas-edit-map-choices') || ''));
    await page.mouse.click(700, 880); await page.waitForTimeout(200);
    await key(); ok('Cmd+Z: the look and the choices as they were', (await ls('atlas-edit-defaults')) === def0 && (await entry('atlas-edit-map-choices')) === ch0, String(await ls('atlas-edit-defaults')));
  } else ok('Set as default shown for a selected node', false);
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(800);
  await page.selectOption('#m2-set-pad-cx', '16'); await page.waitForTimeout(300);
  ok('Paddings: Complexes 16', JSON.parse((await ls('atlas-edit-padding')) || '{}').cx === 16);
  await key(); ok('Cmd+Z: Complexes back', JSON.parse((await ls('atlas-edit-padding')) || '{}').cx == null && (await page.$eval('#m2-set-pad-cx', function (x) { return x.value; })) === 'repack');
  ok('no page errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
