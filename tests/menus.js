// The right-click menus against their list (MENUS in atlas-app.html) and the window arranging them (Settings, Menus).
//   1. Every node and line of a CellDesigner, an SBGN-ML and an Activity Flow map right-clicked in edit mode, and the
//      list's menus: each menu found is taken for one of MENUS, and its items stand in that menu's order (so a reader's
//      first move changes nothing else). The line above Delete is there after a submenu item too; a compartment's items
//      and the map's tools have a line between them. A run of more than 9 items without a line is reported (not wrong).
//   2. Nothing arranged: the menus as built (same items, same lines as before the reader's order existed).
//   3. The window: opened from Settings, a menu chosen, Delete moved to the top by its row menu; the other menus holding
//      Delete show it on top too (the stack of cards), Here only takes it back from them; a line added; the map's menu
//      then in that order; Cmd or Ctrl with Z undoes the line; Reset all menus leaves every menu as built.
//   node tests/menus.js [base address] [--local] --data=<clone of the data repository>
// --local: the editor and the viewer of the working tree routed into the live page (run styles/update.sh first)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
var OM = require('./lib/open-map.js'), data = (process.argv.filter(function (a) { return /^--data=/.test(a); })[0] || '').slice(7) ;
if (!data) { console.log('give --data=<clone of the site\'s data repository> (its test set)'); process.exit(2); }
// the maps right-clicked: two site maps by address and an Activity Flow file of the test set added as a person adds one
var MAPS = [{ id: 'srebp-celldesigner' }, { id: 'glycogen-muscle-sbgn' }, { file: path.join(data, 'test-maps/test-set/test-maps/sbgn-ml/af/libsbgn/test-files/AF/AF_Reference_Card.sbgn') }];
function editorNow() {
  return require('./editor-now.js')(here);
}
function viewerHunks() {
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '../styles/_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString();
  return d.split(/\n(?=@@ )/).slice(1).map(function (h) {
    var o = [], n = [];
    h.split('\n').slice(1).forEach(function (l) { if (l[0] === ' ') { o.push(l.slice(1)); n.push(l.slice(1)); } else if (l[0] === '-') o.push(l.slice(1)); else if (l[0] === '+') n.push(l.slice(1)); });
    return [o.join('\n'), n.join('\n')];
  });
}
(async function () {
  var b = await chromium.launch(), errs = [], bad = 0, ed = local && editorNow(), hunks = local && viewerHunks();
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  async function open(hash, edit) {
    var page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('pageerror', function (e) { errs.push(e.message); });
    await page.addInitScript(function () { try { localStorage.setItem('atlas-edit-level', 'full'); } catch (e) {} });
    if (local) {
      await page.route(/\/styles\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
      await page.route(function (u) { return u.href.split('#')[0] === base.split('#')[0]; }, async function (r) {
        var res = await r.fetch(), t = await res.text(), miss = 0;
        hunks.forEach(function (h) { if (t.indexOf(h[0]) < 0) miss++; else t = t.replace(h[0], function () { return h[1]; }); });
        if (miss) console.log('WRONG the viewer\'s changes did not apply to the page (' + miss + ' of ' + hunks.length + ')');
        r.fulfill({ response: res, body: t, headers: Object.assign({}, res.headers(), { 'content-type': 'text/html; charset=utf-8' }) });
      });
    }
    page.mapShown = hash.file ? await OM.byFile(page, base, hash.file) : await OM.byAddress(page, base, hash.id || hash);
    await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(2500);
    if (edit) { await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(4000); }
    return page;
  }
  var menuAt = async function (page, x, y, opts) {
    await page.keyboard.press('Escape'); await page.mouse.click(x, y, Object.assign({ button: 'right' }, opts || {})); await page.waitForTimeout(150);
    return page.evaluate(function (cd) {
      var m = document.querySelector('.m2-cx:not(.m2-me-card)'); if (!m) return null;
      var rows = Array.prototype.map.call(m.children, function (c) { return c.classList.contains('m2-sep') ? '|' : c.classList.contains('m2-cx-head') ? null : (c.querySelector('button') || c).childNodes[0].nodeValue.trim(); }).filter(function (x) { return x !== null; });
      var ed = document.querySelector('.m2.m2-editing, .m2-editing') ? true : false;
      return { rows: rows, id: window.m2Menus.which(m, ed, cd) };
    }, !!page.mapShown && page.mapShown.format === 'CellDesigner');   // the format of the map shown, never of the address
  };
  var points = function (page) { return page.evaluate(function () {
    var out = [], img = document.getElementById('m2-img'); if (!img) return out;
    var inView = function (x, y) { return x > 320 && x < 1560 && y > 70 && y < 970; };
    img.querySelectorAll('[data-n]').forEach(function (g) { var r = g.getBoundingClientRect(); if (r.width > 2) [[r.left + r.width / 2, r.top + r.height / 2], [r.left + r.width / 2, r.bottom - 2], [r.left + 3, r.top + 3]].forEach(function (p) { if (inView(p[0], p[1])) out.push(p); }); });
    img.querySelectorAll('[data-e] path, [data-e] line, [data-e] polyline').forEach(function (s) { try { var L = s.getTotalLength(), q = s.getPointAtLength(L * 0.3), m = s.getScreenCTM(), x = q.x * m.a + q.y * m.c + m.e, y = q.x * m.b + q.y * m.d + m.f; if (inView(x, y)) out.push([x, y]); } catch (e) {} });
    return out.slice(0, 450);
  }); };
  var seen = {};
  // 1, 2: the menus of three maps in edit mode
  for (var spec of MAPS) {
    var page = await open(spec, true), pts = await points(page), hash = page.mapShown.name + page.mapShown.ext;
    pts.push([1590, 990]);
    for (var p of pts) { var m = await menuAt(page, p[0], p[1]); if (m && m.rows.length) { var k = m.id + ' :: ' + m.rows.join(' / '); if (!seen[k]) seen[k] = { id: m.id, rows: m.rows, from: hash }; } }
    await page.close();
  }
  var page = await open('glycogen-muscle-sbgn', false);
  var vm = await menuAt(page, 1590, 990);   // view mode, empty map space
  if (vm) seen['view :: ' + vm.rows.join(' / ')] = { id: vm.id, rows: vm.rows, from: 'glycogen-muscle-sbgn' };
  if (!(await page.$('#m2-list .m2-map:visible'))) { await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800); }
  for (var ls of [['#m2-list .m2-map:not(.m2-on):not(.m2-binned) >> nth=3', 'list-map'], ['#m2-list .m2-group:not(.m2-bin) >> nth=1', 'list-group'], ['#m2-list .m2-binned >> nth=0', 'list-deleted-map']]) {
    var le = await page.$(ls[0]); if (!le) continue; await le.scrollIntoViewIfNeeded(); await page.waitForTimeout(200); var lr = await le.boundingBox(); if (!lr) continue;
    await page.keyboard.press('Escape'); await page.mouse.click(lr.x + 20, lr.y + lr.height / 2, { button: 'right' }); await page.waitForTimeout(250);
    var lm = await page.evaluate(function () { var m = document.querySelector('.m2-cx'); return m && Array.prototype.map.call(m.children, function (c) { return c.classList.contains('m2-sep') ? '|' : c.textContent.trim(); }); });
    if (lm) seen[ls[1] + ' :: ' + lm.join(' / ')] = { id: ls[1], rows: lm, from: 'the list' };
  }
  await page.keyboard.press('Escape');
  var list = await page.evaluate(function () { return window.m2Menus.list.map(function (m) { return { id: m.id, items: m.items }; }); });
  var key = function (t) { return page.evaluate(function (x) { return window.m2Menus.key(x); }, t); };
  var byId = {}; list.forEach(function (m) { byId[m.id] = m.items; });
  var found = Object.keys(seen).map(function (k) { return seen[k]; }), ids = {};
  for (var f of found) {
    ids[f.id] = 1;
    var keys = []; for (var t of f.rows) keys.push(t === '|' ? '|' : await key(t));
    var def = byId[f.id] || [], at = -1, inOrder = true, missing = [];
    keys.forEach(function (k, i) { if (k === '|') return; var j = def.indexOf(k); if (j < 0) { missing.push(k); return; } if (j < at && k !== keys[i - 1]) inOrder = false; at = Math.max(at, j); });
    ok('1. ' + f.id + ' (' + f.from + '): every item in the list, in its order', !!f.id && true, f.id ? '' : 'no menu of the list holds them all: ' + f.rows.join(' / '));
    if (!f.id) continue;
    ok('1. ' + f.id + ' (' + f.from + '): in its order', !missing.length && inOrder, missing.length ? 'not in the list: ' + missing.join(', ') : inOrder ? '' : keys.join(' / '));
    var di = keys.indexOf('Delete');
    if (di > 0 && f.id.indexOf('edit-') === 0) ok('1. ' + f.id + ': a line above Delete', keys[di - 1] === '|', keys.join(' / '));
    if (f.id === 'edit-compartment' && keys.indexOf('Snap map to grid') >= 0) { var sg = keys.indexOf('Snap map to grid'); ok('1. inside a compartment: a line above the map\'s tools', sg > 0 && keys[sg - 1] === '|', keys.join(' / ')); }
    var run = 0, most = 0; keys.forEach(function (k) { run = k === '|' ? 0 : run + 1; most = Math.max(most, run); });
    if (most > 9) console.log('note  ' + f.id + ': ' + most + ' items without a line: ' + keys.join(' / '));
  }
  console.log('      menus found: ' + Object.keys(ids).sort().join(', ') + ' (' + Object.keys(ids).length + ' of ' + list.length + ')');
  // 3. the window
  await page.click('.m2-ri[data-win="set"]'); await page.waitForTimeout(400);
  ok('3. Settings has Edit right-click menus', await page.isVisible('#m2-set-menus'));
  await page.click('#m2-set-menus'); await page.waitForTimeout(400);
  ok('3. the window opens with every menu listed', (await page.$$('.m2-me-pickmenu')).length === list.length, (await page.$$('.m2-me-pickmenu')).length + ' ' + errs.join(' | '));
  ok('3. Menus is the last of Settings', await page.evaluate(function () { var w = document.getElementById('m2-setwin'), l = w.lastElementChild; return l.classList.contains('m2-set-menus') || (!!l.querySelector('#m2-signout') && l.previousElementSibling.classList.contains('m2-set-menus')); }));
  var counts = await page.$$eval('.m2-me-pickmenu .m2-me-n', function (l) { return l.map(function (n) { return +n.textContent.replace(/\D/g, ''); }); });
  ok('3. the menus longest first', counts.every(function (c, i) { return !i || counts[i - 1] >= c; }) && await page.evaluate(function () { return document.querySelector('.m2-me-pickmenu').classList.contains('m2-on'); }), counts.join(' '));
  var ids0 = await page.$$eval('.m2-me-pickmenu', function (l) { return l.map(function (x) { return x.dataset.id; }); });
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
  ok('3. no item chosen: the arrow keys go through the menus', await page.getAttribute('.m2-me-pickmenu.m2-on', 'data-id') === ids0[2]);
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
  ok('3. and back up', await page.getAttribute('.m2-me-pickmenu.m2-on', 'data-id') === ids0[1]);
  await page.click('.m2-me-pickmenu[data-id="edit-macromolecule"]'); await page.waitForTimeout(200);
  var its = await page.$$eval('.m2-me-main .m2-me-row', function (l) { return l.map(function (r) { return r.dataset.k; }); });
  await page.click('.m2-me-main .m2-me-row >> nth=0'); await page.waitForTimeout(200);
  for (var ak = 0; ak < its.length + 2; ak++) await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  ok('3. an item chosen: the down arrow goes through the items, over the line, to the last', await page.textContent('.m2-me-main .m2-me-pick') === its[its.length - 1], its.join(' / '));
  await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
  ok('3. the up arrow one back', await page.textContent('.m2-me-main .m2-me-pick') === its[its.length - 2]);
  ok('3. the arrow keys change no order', await page.evaluate(function () { return localStorage.getItem('atlas-menus'); }) === null);
  await page.click('.m2-me-main .m2-me-pick'); await page.waitForTimeout(200);   // chosen again: let go
  await page.click('.m2-me-pickmenu[data-id="edit-macromolecule"]'); await page.waitForTimeout(200);
  await page.click('.m2-me-main .m2-me-row:text-is("Delete")'); await page.waitForTimeout(200);
  var cards = (await page.$$('.m2-me-deck .m2-me-mini')).length;
  ok('3. Delete chosen: the other menus holding it as cards', cards >= 8, cards + ' cards');
  var tops0 = await page.$$eval('.m2-me-deck .m2-me-mini', function (l) { return l.map(function (c) { var r = c.querySelector('.m2-me-row'); return r && r.dataset.k; }); });
  await page.click('.m2-me-main .m2-me-row:text-is("Delete")', { button: 'right' }); await page.waitForTimeout(200);
  await page.click('.m2-me-rowmenu button:text-is("Move to top")'); await page.waitForTimeout(300);
  var first = await page.$$eval('.m2-me-main .m2-me-row, .m2-me-main .m2-me-line', function (l) { return l[0].dataset.k; });
  ok('3. Delete on top of the menu', first === 'Delete');
  var tops = await page.$$eval('.m2-me-deck .m2-me-mini', function (l) { return l.map(function (c) { var r = c.querySelector('.m2-me-row'); return r && r.dataset.k; }); });
  ok('3. and on top of every other menu holding it', tops.length && tops.every(function (t) { return t === 'Delete'; }), tops.join(', '));
  ok('3. the bar says so, with Here only', /Moved in \d+ other menus too/.test(await page.textContent('.m2-me-say')));
  await page.click('.m2-me-say button:text-is("Here only")'); await page.waitForTimeout(300);
  tops = await page.$$eval('.m2-me-deck .m2-me-mini', function (l) { return l.map(function (c) { var r = c.querySelector('.m2-me-row'); return r && r.dataset.k; }); });
  ok('3. Here only: the others as before', tops.join() === tops0.join(), tops.join(', '));
  await page.click('.m2-me-main .m2-me-row:text-is("Add unit of information")', { button: 'right' }); await page.waitForTimeout(200);
  await page.click('.m2-me-rowmenu button:text-is("Add line below")'); await page.waitForTimeout(300);
  var mo = await page.$$eval('.m2-me-main .m2-me-row, .m2-me-main .m2-me-line', function (l) { return l.map(function (r) { return r.dataset.k; }); });
  ok('3. a line added below Add unit of information', mo[mo.indexOf('Add unit of information') + 1] === '|', mo.join(' / '));
  var stored = await page.evaluate(function () { return JSON.parse(localStorage.getItem('atlas-menus') || '{}'); });
  ok('3. kept in this browser for that menu only', Object.keys(stored).join() === 'edit-macromolecule', Object.keys(stored).join());
  // the arrangement applied to a menu as built: the macromolecule's own items given to menuArrange
  var applied = await page.evaluate(function () {
    var box = document.createElement('div');
    ['Add state variable', 'Add unit of information', 'Make multimer', 'Select all of this kind', '|', 'Delete'].forEach(function (t) { var n = document.createElement(t === '|' ? 'div' : 'button'); if (t === '|') n.className = 'm2-sep'; else n.textContent = t; box.appendChild(n); });
    window.m2Menus.arrange(box, 'edit-macromolecule');
    return Array.prototype.map.call(box.children, function (c) { return c.classList.contains('m2-sep') ? '|' : c.textContent; }).join(' / ');
  });
  ok('3. the menu as built put in that order', applied === 'Delete / Add state variable / Add unit of information / | / Make multimer / | / Select all of this kind', applied);
  var mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(300);
  mo = await page.$$eval('.m2-me-main .m2-me-row, .m2-me-main .m2-me-line', function (l) { return l.map(function (r) { return r.dataset.k; }); });
  ok('3. undone by the keys: the line gone, Delete still on top', mo.indexOf('|') === mo.lastIndexOf('|') && mo[0] === 'Delete', mo.join(' / '));
  await page.click('.m2-me-foot button:text-is("Reset all menus")'); await page.waitForTimeout(300);
  stored = await page.evaluate(function () { return localStorage.getItem('atlas-menus'); });
  ok('3. Reset all menus: nothing kept', stored === null, String(stored));
  // a real drag: Select all of this kind dragged above Add state variable
  await page.click('.m2-me-pickmenu[data-id="edit-macromolecule"]'); await page.waitForTimeout(200);
  var src = await (await page.$('.m2-me-main .m2-me-row:text-is("Select all of this kind")')).boundingBox(), dst = await (await page.$('.m2-me-main .m2-me-row:text-is("Add state variable")')).boundingBox();
  await page.mouse.move(src.x + 40, src.y + src.height / 2); await page.mouse.down();
  for (var st = 1; st <= 8; st++) await page.mouse.move(src.x + 40, src.y + src.height / 2 + (dst.y + 3 - src.y - src.height / 2) * st / 8);
  await page.mouse.up(); await page.waitForTimeout(300);
  mo = await page.$$eval('.m2-me-main .m2-me-row, .m2-me-main .m2-me-line', function (l) { return l.map(function (r) { return r.dataset.k; }); });
  ok('3. a drag puts Select all of this kind first', mo[0] === 'Select all of this kind', mo.join(' / '));
  await page.keyboard.press('Alt+ArrowDown'); await page.waitForTimeout(300);
  mo = await page.$$eval('.m2-me-main .m2-me-row, .m2-me-main .m2-me-line', function (l) { return l.map(function (r) { return r.dataset.k; }); });
  ok('3. Alt with the down arrow moves it one place down', mo[1] === 'Select all of this kind', mo.join(' / '));
  ok('3. the drag leaves nothing half done', !(await page.$('.m2-me-drag')));
  // Here only after Reset all menus offers nothing
  await page.click('.m2-me-foot button:text-is("Reset all menus")'); await page.waitForTimeout(300);
  ok('3. Reset all menus: no Here only left', !(await page.$('.m2-me-say button')));
  // a move next to a line stays in its group in the other menus: Download PNG moved to the top of the page's items
  await page.click('.m2-me-pickmenu[data-id="edit-empty"]'); await page.waitForTimeout(200);   // Map, edit mode: Empty map space
  var name = await page.textContent('.m2-me-main .m2-me-name');
  var o = await page.$$eval('.m2-me-main .m2-me-row, .m2-me-main .m2-me-line', function (l) { return l.map(function (r) { return r.dataset.k; }); });
  var to = o.indexOf('Switch to viewer or edit');
  src = await (await page.$('.m2-me-main .m2-me-row:text-is("Download PNG")')).boundingBox(); dst = await (await page.$('.m2-me-main .m2-me-row:text-is("Switch to viewer or edit")')).boundingBox();
  await page.mouse.move(src.x + 40, src.y + src.height / 2); await page.mouse.down();
  for (st = 1; st <= 10; st++) await page.mouse.move(src.x + 40, src.y + src.height / 2 + (dst.y + 3 - src.y - src.height / 2) * st / 10);
  await page.mouse.up(); await page.waitForTimeout(300);
  var orders = await page.evaluate(function () { return JSON.parse(localStorage.getItem('atlas-menus') || '{}'); });
  var cmp = orders['edit-compartment'] || [], view = orders['view-empty'] || [], lst = orders['list-map'];
  ok('3. ' + name + ': Download PNG first of the page\'s items', (orders['edit-empty'] || [])[to] === 'Download PNG', (orders['edit-empty'] || []).join(' / '));
  ok('3. inside a compartment too, under the line, not among the map\'s tools', cmp[cmp.indexOf('Download PNG') - 1] === '|' && cmp[cmp.indexOf('Download PNG') + 1] === 'Switch to viewer or edit', cmp.join(' / '));
  ok('3. view mode\'s empty map space: first', view[0] === 'Download PNG', view.join(' / '));
  ok('3. the list\'s menus left alone', !lst, String(lst));
  await page.click('.m2-me-foot button:text-is("Reset all menus")'); await page.waitForTimeout(300);
  // keys do not reach the page behind the window
  var mode0 = await page.evaluate(function () { return !!document.querySelector('.m2-editing'); });
  await page.keyboard.press('e'); await page.keyboard.press((process.platform === 'darwin' ? 'Meta' : 'Control') + '+e'); await page.waitForTimeout(500);
  ok('3. E behind the window does nothing', mode0 === await page.evaluate(function () { return !!document.querySelector('.m2-editing'); }) && !!(await page.$('.m2-me')));
  for (var tb = 0; tb < 40; tb++) await page.keyboard.press('Tab');
  ok('3. Tab stays in the window', await page.evaluate(function () { return !!document.activeElement.closest('.m2-me'); }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('3. Esc closes the window', !(await page.$('.m2-me')));
  ok('3. the focus back on Settings\' button', await page.evaluate(function () { return document.activeElement && document.activeElement.id === 'm2-set-menus'; }));
  ok('no script error', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
