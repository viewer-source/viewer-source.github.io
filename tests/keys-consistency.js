// The functional consistency review's small gaps, on the live page (by default the styles page), no token:
// 1. View mode: + and - zoom the map shown right after it is picked in the list, with no click on the map.
// 2. View mode: Cmd+Delete keeps the map shown while an area is selected on it; after Esc, Delete alone keeps it (as in
//    Finder) and Cmd+Delete puts it in Deleted.
// 3. Edit mode: an area over the whole map (nodes and bend points), then the Delete key: the glyphs go, as by the menu.
// 4. Edit mode: the right-click menu's Delete shows its key; the status line says nothing after a move.
// 5. Gestures and keys: + and - zoom in and out; S, Esc and Delete listed.
//   node tests/keys-consistency.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  page.on('dialog', function (d) { d.accept().catch(function () {}); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var tf = function () { return page.$eval('#m2-img', function (i) { return i.style.transform + ' ' + i.style.width; }); };
  var ids = function () { return page.$$eval('#m2-list .m2-map:not(.m2-binned)', function (l) { return l.map(function (x) { return x.dataset.id; }); }); };
  var hash = function () { return page.evaluate(function () { return location.hash.slice(1); }); };
  var editing = function () { return page.evaluate(function () { return document.querySelector('.m2').classList.contains('m2-editing'); }); };
  var list = async function () { if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]'); await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 }); };
  var menu = async function (sel, item) { await list(); await page.click(sel, { button: 'right' }); await page.waitForTimeout(300); await page.click('.m2-cx button:text-is("' + item + '")'); await page.waitForTimeout(2000); };
  var view = async function () { if (await editing()) { await page.keyboard.press('Escape'); await page.keyboard.press('e'); await page.waitForTimeout(1500); } };
  var mapBox = function () { return page.$eval('#m2-img', function (i) { var r = i.getBoundingClientRect(); return [Math.max(r.left, 300), Math.max(r.top, 90), Math.min(r.right, 1380), Math.min(r.bottom, 880)]; }); };
  var shiftDrag = async function (x1, y1, x2, y2) { await page.keyboard.down('Shift'); await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 12 }); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(400); };
  var glyphs = function () { return page.evaluate(function () { var n = window.m2EditNow && window.m2EditNow(); return n ? new DOMParser().parseFromString(n.text, 'application/xml').getElementsByTagName('glyph').length : -1; }); };

  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
  await view();

  // 1. zoom keys after a pick in the list
  await list();
  await page.click('#m2-list .m2-map[data-id="testing-glycolysis-sbgn"]'); await page.waitForTimeout(2500);
  var z0 = await tf();
  await page.keyboard.press('+'); await page.waitForTimeout(400);
  var z1 = await tf();
  ok('1. + zooms the map just picked in the list', z1 !== z0, z0 + ' -> ' + z1);
  await page.keyboard.press('-'); await page.waitForTimeout(400);
  ok('1. - zooms back', (await tf()) !== z1);

  // 2. Cmd+Delete with an area on the map: kept; after Esc: Delete alone kept, Cmd+Delete in Deleted
  var MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
  await menu('#m2-list .m2-map[data-id="acly-celldesigner"]', 'Make a copy'); await page.waitForTimeout(1500);   // a CellDesigner map: the site's SBGN-ML maps from another editor are not copied
  var copy = await hash();
  ok('2. Make a copy made one', copy !== 'acly-celldesigner' && (await ids()).indexOf(copy) >= 0, copy);
  await view(); await list();
  await page.click('#m2-list .m2-map[data-id="' + copy + '"]'); await page.waitForTimeout(2500);
  var B = await mapBox();
  await shiftDrag(B[0] + 40, B[1] + 40, B[0] + 300, B[1] + 260);
  ok('2. an area is selected', await page.$eval('#m2-area', function (e) { return e.style.display === 'block'; }));
  await page.keyboard.press(MOD + '+Delete'); await page.waitForTimeout(1500);
  ok('2. ' + MOD + '+Delete with an area: the map kept', (await ids()).indexOf(copy) >= 0 && (await hash()) === copy, await hash());
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('Delete'); await page.waitForTimeout(1500);
  ok('2. after Esc, Delete alone: the map kept, as in Finder', (await ids()).indexOf(copy) >= 0 && (await hash()) === copy, await hash());
  await page.keyboard.press(MOD + '+Delete'); await page.waitForTimeout(1500);
  ok('2. after Esc, ' + MOD + '+Delete puts it in Deleted', (await ids()).indexOf(copy) < 0, await hash());

  // 3 and 4. edit mode on the site's SBGN-ML map (its edits kept in this browser only, cleared at the end)
  await page.click('#m2-list .m2-map[data-id="testing-glycolysis-sbgn"]'); await page.waitForTimeout(2500);
  if (!(await editing())) { await page.keyboard.press('e'); await page.waitForTimeout(2500); }
  await page.waitForSelector('#m2-editwin button[data-make="macromolecule"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  var n0 = await glyphs();
  var node = await page.$eval('#m2-img [data-n]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(node[0], node[1], { button: 'right' }); await page.waitForTimeout(400);
  var key = await page.$eval('.m2-cx button:text-is("Delete") .m2-cx-key', function (k) { return k.textContent; }).catch(function () { return ''; });
  if (!key) key = await page.evaluate(function () { var b = Array.from(document.querySelectorAll('.m2-cx button')).filter(function (x) { return /^Delete/.test(x.textContent); })[0]; var k = b && b.querySelector('.m2-cx-key'); return k ? k.textContent : ''; });
  ok('4. the menu\'s Delete shows its key', key === 'Del' || key === '⌫', JSON.stringify(key));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.mouse.click(node[0], node[1]); await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(2500);
  var st = await page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; });
  ok('4. a move: the status line says nothing', st === '', JSON.stringify(st));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  B = await mapBox();
  await shiftDrag(B[0] + 2, B[1] + 2, B[2] - 2, B[3] - 2);
  var sel = await page.evaluate(function () { var s = window.m2EditSel && window.m2EditSel(); return s ? [s.n.length, s.p.length] : null; });
  await page.keyboard.press('Delete'); await page.waitForTimeout(2500);
  var n1 = await glyphs();
  ok('3. an area over the map, then Delete: glyphs removed', n1 >= 0 && n1 < n0, n0 + ' -> ' + n1 + ' (selected ' + JSON.stringify(sel) + ')');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await page.waitForTimeout(2500);
  ok('3. one undo brings them back', (await glyphs()) === n0, String(await glyphs()));

  // 5. Gestures and keys
  await view();
  await page.keyboard.press('?'); await page.waitForTimeout(500);
  var tips = await page.$eval('#m2-tips', function (t) { return t.hidden ? '' : t.textContent; }).catch(function () { return ''; });
  ok('5. Gestures and keys: + and - zoom in and out', /zoom in and out/.test(tips) && !/zoom out and in/.test(tips));
  ok('5. Gestures and keys: S, Esc, Cmd + Delete (Delete alone not); no editing rows (select all, save: the editor\'s help)', /the map’s own file or its SBGN-ML/.test(tips) && /clears the selection/.test(tips) && /Delete alone does not, as in Finder/.test(tips) && !/While editing/.test(tips) && !/save at once/.test(tips));
  await page.keyboard.press('Escape');

  ok('no script error', !errs.length, errs.join(' | '));
  await page.evaluate(function () { indexedDB.deleteDatabase('atlas-edit-drafts'); });
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
