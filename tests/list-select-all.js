// Cmd+A in the list, as in Finder (no token: the reader's maps in this browser).
//   1. After a click on a map, Cmd+A selects every map of its group, and no text of the page.
//   2. Cmd+A after a click in Deleted selects every deleted map, none outside it; Cmd or Shift with a click works there.
//   3. Right click on several deleted maps: Restore N maps and Delete N maps forever; Restore N maps brings them back,
//      Cmd+Z puts them in Deleted again.
//   4. A text selection left on the list goes at the next press on it.
//   5. Cmd+A after a click on the map: the list's selection is left as it is.
//   6. Delete N maps forever: done at once, no dialog asking again.
//   node tests/list-select-all.js [base address] [--local]
// --local: the editor and the viewer of the working tree routed into the live page (build the editor first)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..'), checks = path.join(here, '..', 'notes', 'check-files');
function viewerHunks() {
  var d = cp.execFileSync('git', ['diff', '-U2', process.env.REV || 'HEAD', '--', '_includes/atlas-app.html'], { cwd: here, maxBuffer: 1 << 26 }).toString();
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
    var ed = require('./editor-now.js')(here), hunks = viewerHunks();
    await page.route(/\.io\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
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
  await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
  var ch = page.waitForEvent('filechooser'); await page.click('.m2-cx button:text-is("Add map from file")');
  await (await ch).setFiles(['all-a', 'all-b', 'all-c', 'all-d'].map(function (n, i) { return { name: n + '.xml', mimeType: 'text/xml', buffer: fs.readFileSync(path.join(checks, ['not-gate-one-input-v01.xml', 'or-gate-one-input-v01.xml', 'unknown-gate-one-input-v01.xml'][i % 3])) }; }));
  await page.waitForTimeout(6000);
  var row = function (n) { return '#m2-list .m2-map:not(.m2-binned):has(.m2-name:text-is("' + n + '"))'; };
  var brow = function (n) { return '#m2-list .m2-map.m2-binned:has(.m2-name:text-is("' + n + '"))'; };
  var lit = function () { return page.$$eval('#m2-list .m2-map.m2-on', function (l) { return l.map(function (x) { return (x.classList.contains('m2-binned') ? 'bin:' : '') + x.querySelector('.m2-name').textContent; }); }); };
  var mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  var pageText = function () { return page.evaluate(function () { return String(window.getSelection()); }); };
  // 1
  await page.click(row('all-b')); await page.waitForTimeout(800);
  var grp = await page.$eval(row('all-b'), function (r) { var g = r.getAttribute('data-group') || '', m = r.classList.contains('m2-mine'); return Array.prototype.filter.call(document.querySelectorAll('#m2-list .m2-map:not(.m2-binned)'), function (x) { return (x.getAttribute('data-group') || '') === g && (g || x.classList.contains('m2-mine') === m); }).map(function (x) { return x.querySelector('.m2-name').textContent; }); });
  await page.keyboard.press(mod + '+a'); await page.waitForTimeout(300);
  var l1 = await lit();
  ok('1. Cmd+A: every map of the group', l1.length === grp.length && grp.length >= 4 && ['all-a', 'all-b', 'all-c', 'all-d'].every(function (n) { return l1.indexOf(n) >= 0; }), l1.join(','));
  ok('1. no text of the page selected', (await pageText()) === '', JSON.stringify((await pageText()).slice(0, 40)));
  var menu = await (async function () { await page.click(row('all-c'), { button: 'right' }); await page.waitForTimeout(300); var m = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); await page.keyboard.press('Escape'); await page.waitForTimeout(200); return m; })();
  ok('1. the menu acts on them', menu.indexOf('Delete ' + grp.length + ' maps') >= 0, menu.join(' | '));
  // three into Deleted
  await page.keyboard.press('Escape'); await page.click(row('all-a')); await page.waitForTimeout(500);
  await page.click(row('all-c'), { modifiers: ['Shift'] }); await page.waitForTimeout(300);
  await page.click(row('all-b'), { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Delete 3 maps")'); await page.waitForTimeout(1500);
  var head = await page.$('#m2-list .m2-bin');
  if (await head.evaluate(function (h) { return h.classList.contains('m2-shut'); })) { await head.click(); await page.waitForTimeout(500); }
  var nBin = await page.$$eval('#m2-list .m2-map.m2-binned', function (l) { return l.length; });
  ok('3 maps in Deleted', nBin === 3, nBin);
  // 2
  await page.click(brow('all-b')); await page.waitForTimeout(1200);
  await page.keyboard.press(mod + '+a'); await page.waitForTimeout(300);
  var l2 = await lit();
  ok('2. Cmd+A in Deleted: every deleted map, none outside', l2.length === 3 && l2.every(function (n) { return n.indexOf('bin:') === 0; }), l2.join(','));
  await page.click(brow('all-a'), { modifiers: [mod] }); await page.waitForTimeout(300);
  ok('2. Cmd with a click takes one out', (await lit()).length === 2, (await lit()).join(','));
  await page.click(row('all-d'), { modifiers: [mod] }); await page.waitForTimeout(300);
  var l2b = await lit();
  ok('2. a map outside Deleted never joins a selection in it', l2b.join(',') === 'all-d', l2b.join(','));
  await page.click(brow('all-a'), { modifiers: [mod] }); await page.waitForTimeout(300);
  await page.click(brow('all-c'), { modifiers: ['Shift'] }); await page.waitForTimeout(300);
  var l2c = await lit();
  ok('2. Shift with a click in Deleted: the range', l2c.length === 3 && l2c.every(function (n) { return n.indexOf('bin:') === 0; }), l2c.join(','));
  // 3
  await page.click(brow('all-b'), { button: 'right' }); await page.waitForTimeout(300);
  var m3 = await page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); });
  ok('3. the menu: Restore 3 maps, Delete 3 maps forever', m3.indexOf('Restore 3 maps') >= 0 && m3.indexOf('Delete 3 maps forever') >= 0, m3.join(' | '));
  await page.click('.m2-cx button:text-is("Restore 3 maps")'); await page.waitForTimeout(2000);
  var back = await page.$$eval('#m2-list .m2-map:not(.m2-binned) .m2-name', function (l) { return l.map(function (x) { return x.textContent; }); });
  ok('3. Restore 3 maps: back in the list', ['all-a', 'all-b', 'all-c'].every(function (n) { return back.indexOf(n) >= 0; }) && !(await page.$('#m2-list .m2-map.m2-binned')), back.filter(function (n) { return /^all-/.test(n); }).join(','));
  await page.click(row('all-d')); await page.waitForTimeout(800);
  await page.keyboard.press(mod + '+z'); await page.waitForTimeout(2000);
  ok('3. Cmd+Z: in Deleted again', (await page.$$eval('#m2-list .m2-map.m2-binned', function (l) { return l.length; })) === 3);
  // 4
  await page.evaluate(function () { window.getSelection().selectAllChildren(document.getElementById('m2-list')); });
  await page.click(row('all-d')); await page.waitForTimeout(500);
  ok('4. a text selection on the list goes at the next press', (await pageText()) === '');
  // 5
  await page.click(row('all-d')); await page.waitForTimeout(800);
  var v = await (await page.$('#m2-view')).boundingBox();
  await page.mouse.click(v.x + 20, v.y + v.height - 20); await page.waitForTimeout(300);
  var l5a = await lit();
  await page.keyboard.press(mod + '+a'); await page.waitForTimeout(300);
  ok('5. Cmd+A after a click on the map: the list as it was', (await lit()).join() === l5a.join(), (await lit()).join(','));
  // 6
  var dialogs = 0; page.on('dialog', function () { dialogs++; });
  if (await (await page.$('#m2-list .m2-bin')).evaluate(function (h) { return h.classList.contains('m2-shut'); })) { await page.click('#m2-list .m2-bin'); await page.waitForTimeout(500); }
  await page.click(brow('all-a'), { modifiers: [mod] }); await page.waitForTimeout(300);
  await page.keyboard.press(mod + '+a'); await page.waitForTimeout(300);
  await page.click(brow('all-b'), { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Delete 3 maps forever")'); await page.waitForTimeout(2000);
  var left6 = await page.$$eval('#m2-list .m2-map.m2-binned', function (l) { return l.length; });
  ok('6. Delete 3 maps forever: gone, no dialog', left6 === 0 && dialogs === 0, left6 + ' left, ' + dialogs + ' dialogs');
  ok('no page errors', !errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
