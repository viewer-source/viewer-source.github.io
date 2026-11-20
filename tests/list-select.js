// Several maps selected in the list, as in Finder (no token: the reader's maps in this browser).
//   1. Cmd with a click adds a map, the map shown no longer lit alone; again takes it out.
//   2. Shift with a click: every map from the last one clicked. 3. A drag beside the names: the box takes the maps.
//   4. Right click on the selection: Move N maps to..., Delete N maps; Delete N maps puts them in Deleted.
//   5. Esc ends a selection. 6. A selected map dragged, no Shift: moved, the drop line straight.
//   7. A map not selected pressed on its name is dragged, as in Finder (no box), and moved; Cmd with Z puts it back.
//   10. A site map not selected, dragged by its name onto another group's map: in that group.
//   8. Cmd with Z undoes Delete 3 maps, with Shift redoes. 9. Three selected, one dragged: all three go, all three faded
//      while dragged, none apart; Cmd with Z: the order as it was.
//   node tests/list-select.js [base address] [--local]
// --local: the editor and the viewer of the working tree routed into the live page (run styles/update.sh first)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..'), checks = path.join(here, '..', 'notes', 'check-files');
function editorNow() {
  var read = function (f) { return fs.readFileSync(path.join(here, 'editor', f), 'utf8'); };
  return read('editor.js').replace(/^---[\s\S]*?---\n/, '').replace(/\{% include_relative (\S+) %\}/g, function (m, f) { return read(f); });
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
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
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
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);
  if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
  await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 });
  // four maps of the reader's, at the top of the list
  await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
  var ch = page.waitForEvent('filechooser'); await page.click('.m2-cx button:text-is("Add map from file")');
  await (await ch).setFiles(['sel-a', 'sel-b', 'sel-c', 'sel-d'].map(function (n, i) { return { name: n + '.xml', mimeType: 'text/xml', buffer: fs.readFileSync(path.join(checks, ['not-gate-one-input-v01.xml', 'or-gate-one-input-v01.xml', 'unknown-gate-one-input-v01.xml'][i % 3])) }; }));
  await page.waitForTimeout(6000);
  var row = function (n) { return '#m2-list .m2-map:has(.m2-name:text-is("' + n + '"))'; };
  var lit = function () { return page.$$eval('#m2-list .m2-map.m2-on .m2-name', function (l) { return l.map(function (x) { return x.textContent; }).join(','); }); };
  var mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.click(row('sel-a')); await page.waitForTimeout(500);
  await page.click(row('sel-c'), { modifiers: [mod] }); await page.waitForTimeout(300);
  ok('1. Cmd with a click adds a map', (await lit()) === 'sel-a,sel-c', await lit());
  await page.click(row('sel-c'), { modifiers: [mod] }); await page.waitForTimeout(300);
  ok('1. again takes it out', (await lit()) === 'sel-a', await lit());
  await page.click(row('sel-d'), { modifiers: ['Shift'] }); await page.waitForTimeout(300);
  ok('2. Shift with a click: the range', (await lit()) === 'sel-a,sel-b,sel-c,sel-d', await lit());
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  ok('5. Esc: the map shown alone', (await lit()) === 'sel-d' || (await lit()).split(',').length === 1, await lit());
  // 3. the box: from beside sel-b's name down to sel-d
  var rb = await (await page.$(row('sel-b'))).boundingBox(), rd = await (await page.$(row('sel-d'))).boundingBox();
  await page.mouse.move(rb.x + rb.width - 6, rb.y + 4); await page.mouse.down();
  await page.mouse.move(rb.x + rb.width - 20, rd.y + 8, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
  ok('3. the box takes the maps it crosses', (await lit()) === 'sel-b,sel-c,sel-d', await lit());
  await page.click(row('sel-c'), { button: 'right' }); await page.waitForTimeout(300);
  var menu = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); });
  ok('4. the menu acts on the selection', menu.indexOf('Move 3 maps to...') >= 0 && menu.indexOf('Delete 3 maps') >= 0, menu.join(' | '));
  await page.click('.m2-cx button:text-is("Delete 3 maps")'); await page.waitForTimeout(1500);
  var bin = await page.$eval('#m2-list .m2-bin', function (h) { return h.textContent; }).catch(function () { return ''; });
  ok('4. Delete 3 maps: in Deleted', /Deleted \(3\)/.test(bin) && !(await page.$(row('sel-b'))), bin);
  var ids = function () { return page.$$eval('#m2-list .m2-map:not(.m2-binned)', function (l) { return l.map(function (x) { return x.dataset.id; }); }); };
  var names = function () { return page.$$eval('#m2-list .m2-map:not(.m2-binned) .m2-name', function (l) { return l.map(function (x) { return x.textContent; }).join(','); }); };
  // 8. Cmd with Z: Delete 3 maps undone, the three back; Shift too: deleted again; Z: back
  await page.click(row('sel-a')); await page.waitForTimeout(500);
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(1500);
  ok('8. Cmd+Z: the deleted maps back', !!(await page.$(row('sel-b'))) && !!(await page.$(row('sel-d'))));
  await page.keyboard.press(mod + '+Shift+z'); await page.waitForTimeout(1500);
  ok('8. Cmd+Shift+Z: deleted again', !(await page.$(row('sel-b'))));
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(1500);
  ok('8. Cmd+Z again: back', !!(await page.$(row('sel-c'))));
  // 9. three maps selected by the box, one of them dragged: all three go, together; Cmd+Z: the order as it was
  var rb9 = await (await page.$(row('sel-b'))).boundingBox(), rd9 = await (await page.$(row('sel-d'))).boundingBox();
  await page.mouse.move(rb9.x + rb9.width - 6, rb9.y + 4); await page.mouse.down();
  await page.mouse.move(rb9.x + rb9.width - 20, rd9.y + 8, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
  var n9 = await names(), nc = await (await page.$(row('sel-c') + ' .m2-name')).boundingBox(), top9 = await (await page.$('#m2-list .m2-map:not(.m2-binned) >> nth=0')).boundingBox();
  await page.mouse.move(nc.x + 5, nc.y + nc.height / 2); await page.mouse.down();
  await page.mouse.move(nc.x + 5, top9.y + 2, { steps: 10 });
  var fade9 = await page.$$eval('#m2-list .m2-moving .m2-name', function (l) { return l.map(function (x) { return x.textContent; }).join(','); });
  ok('9. every selected map shown moving, none apart', fade9 === 'sel-b,sel-c,sel-d', fade9);
  await page.mouse.up(); await page.waitForTimeout(1500);
  var a9 = await names(), f3 = a9.split(',').slice(0, 3).join(',');
  ok('9. the three selected dragged together', f3 === 'sel-b,sel-c,sel-d', a9.split(',').slice(0, 5).join());
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(1500);
  ok('9. Cmd+Z: the order as it was', (await names()) === n9, (await names()).split(',').slice(0, 5).join());
  // 7. a map not selected dragged by its name: grabbed, no box, moved (another map shown first)
  await page.click('#m2-list .m2-map:not(.m2-binned):not(:has(.m2-name:text-is("sel-a"))) >> nth=0'); await page.waitForTimeout(1500);
  var before7 = await ids(), n7 = await (await page.$(row('sel-a') + ' .m2-name')).boundingBox(), r7 = await (await page.$('#m2-list .m2-map:not(.m2-binned) >> nth=2')).boundingBox();
  ok('7. sel-a not selected before the drag', (await lit()).split(',').indexOf('sel-a') < 0, await lit());
  await page.mouse.move(n7.x + 5, n7.y + n7.height / 2); await page.mouse.down();
  await page.mouse.move(n7.x + 5, r7.y + r7.height * 0.8, { steps: 8 });
  var marq7 = !!(await page.$('.m2-marq')), grab7 = await page.evaluate(function () { return document.body.classList.contains('m2-dragging'); });
  await page.mouse.up(); await page.waitForTimeout(1200);
  ok('7. a map not selected dragged by its name: grabbed, no box', grab7 && !marq7, 'box ' + marq7);
  ok('7. and moved', (await ids()).join() !== before7.join());
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(1500);
  ok('7. Cmd+Z: back in its place', (await ids()).join() === before7.join());
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // 10. a site map not selected, dragged by its name onto a map of another group: in that group
  var site = await page.$$eval('#m2-list .m2-map:not(.m2-binned):not(.m2-mine)', function (l) { return l.map(function (x) { return [x.dataset.id, x.dataset.group]; }); });
  var g0 = site[0][1], other = site.filter(function (x) { return x[1] && x[1] !== g0; }), mover = other[0];
  await page.$eval('#m2-list', function (x) { x.scrollTop = 0; });
  var tgt = await (await page.$('#m2-list .m2-map[data-id="' + site[1][0] + '"]')).boundingBox();
  var src = await page.$('#m2-list .m2-map[data-id="' + mover[0] + '"] .m2-name'); await src.scrollIntoViewIfNeeded();
  var sb = await src.boundingBox(); tgt = await (await page.$('#m2-list .m2-map[data-id="' + site[1][0] + '"]')).boundingBox();
  if (tgt && tgt.y > 0) {
    await page.mouse.move(sb.x + 5, sb.y + sb.height / 2); await page.mouse.down();
    await page.mouse.move(sb.x + 5, tgt.y + tgt.height * 0.3, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(1500);
    var g10 = await page.$eval('#m2-list .m2-map[data-id="' + mover[0] + '"]', function (x) { return x.dataset.group; });
    ok('10. a site map dragged by its name into another group', g10 === site[1][1], mover[1] + ' -> ' + g10);
    await page.keyboard.press(mod + '+z'); await page.waitForTimeout(1500);
    ok('10. Cmd+Z: back in its group', (await page.$eval('#m2-list .m2-map[data-id="' + mover[0] + '"]', function (x) { return x.dataset.group; })) === mover[1]);
  } else ok('10. the two groups in sight together', false);
  // 6. a selected map dragged, no Shift: sel-a below the next map
  await page.click(row('sel-a')); await page.waitForTimeout(800);
  var before = await ids(), na = await (await page.$(row('sel-a') + ' .m2-name')).boundingBox(), r2 = await (await page.$('#m2-list .m2-map:not(.m2-binned) >> nth=2')).boundingBox();
  await page.mouse.move(na.x + 5, na.y + na.height / 2); await page.mouse.down();
  await page.mouse.move(na.x + 5, r2.y + r2.height * 0.8, { steps: 8 });
  var line = await page.evaluate(function () { var d = document.querySelector('.m2-drop, .m2-drop-after'); if (!d) return null; var s = getComputedStyle(d, d.classList.contains('m2-drop') ? '::before' : '::after'); return s.height + ' ' + getComputedStyle(d).boxShadow; });
  await page.mouse.up(); await page.waitForTimeout(800);
  var after = await ids();
  var ia = await page.$eval(row('sel-a'), function (x) { return x.dataset.id; });
  ok('6. selected, dragged without Shift: moved', after.indexOf(ia) !== before.indexOf(ia) && after.length === before.length, before.slice(0, 3).join() + ' -> ' + after.slice(0, 3).join());
  ok('6. the drop line straight (2px, no shadow)', !!line && Math.abs(parseFloat(line) - 2) < 0.05 && / none$/.test(line), line);
  ok('no script errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok'); process.exit(bad ? 1 : 0);
})();
