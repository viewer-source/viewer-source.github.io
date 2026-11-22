// Map names as in Finder, the format shown as the file's extension after the name (not part of it): two maps of one
// group may share a name only in different formats. No token (the reader's maps in this browser).
//   1. New map twice: Unnamed map, Unnamed map 2; New CellDesigner map: Unnamed map too (another format).
//   2. The extensions shown after the names (.sbgn, .xml); Hide file extensions takes them away.
//   3. Rename map to a name its group has in that format: refused (the field red, the name kept).
//   4. Move to a group holding the name in that format: the moved map becomes "<name> (1)".
//   5. Restore from Deleted where the group has the name in that format by then: "<name> (1)"; Make a copy twice:
//      Copy of <name>, Copy of <name> (1).
//   6. No token: a site map moved into a group holding its name and format: "<name> (1)" kept in this browser, also
//      after a reload, as its move is.
//   7. Case as on a Mac: a name differing only in case is taken; a map renamed to its own name in other case is fine.
//   node tests/names.js [base address] [--local]
// --local: the editor and the viewer of the working tree routed into the live page (run styles/update.sh first)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..');
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
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [], bad = 0;
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
  await page.route('https://api.github.com/**', function (r) { r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); });
  var list = async function () { if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]'); await page.waitForSelector('#m2-list .m2-map', { state: 'visible', timeout: 30000 }); };
  var menu = async function (sel, item) {
    await list();
    await page.click(sel, { button: 'right' }); await page.waitForTimeout(300);
    await page.click('.m2-cx button:text-is("' + item + '")'); await page.waitForTimeout(1500);
  };
  var hash = function () { return page.evaluate(function () { return location.hash.slice(1); }); };
  var row = function (id) { return page.$eval('#m2-list .m2-map[data-id="' + id + '"]', function (x) { var n = x.querySelector('.m2-name'), f = x.querySelector('.m2-fx'); return [n ? n.textContent : '', f ? f.textContent : '', x.dataset.group]; }).catch(function () { return null; }); };
  var toList = async function () { await page.keyboard.press('Escape'); await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800); if (await page.$('.m2-editing')) { await page.click('.m2-ri[data-win="edit"]').catch(function () {}); await page.waitForTimeout(800); await page.click('.m2-ri[data-win="list"]').catch(function () {}); await page.waitForTimeout(800); } await list(); };
  await page.goto(base + '#acly-graphml', { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 30000 }); await page.waitForTimeout(3000);

  // 1. new maps
  await menu('#m2-list .m2-map >> nth=0', 'New SBGN-ML map'); var a = await hash(); await toList();
  await menu('#m2-list .m2-map >> nth=0', 'New SBGN-ML map'); var a2 = await hash(); await toList();
  await menu('#m2-list .m2-map >> nth=0', 'New CellDesigner map'); var c = await hash(); await toList();
  var ra = await row(a), ra2 = await row(a2), rc = await row(c);
  ok('1. Unnamed map, Unnamed map 2 (SBGN-ML), Unnamed map (CellDesigner: another format)', ra && ra[0] === 'Unnamed map' && ra2 && ra2[0] === 'Unnamed map 2' && rc && rc[0] === 'Unnamed map', JSON.stringify([ra, ra2, rc]));

  // 2. extensions
  ok('2. the extensions after the names', ra[1] === '.sbgn' && rc[1] === '.xml' && ((await row('acly-graphml')) || [])[1] === '.graphml', JSON.stringify([ra, rc, await row('acly-graphml')]));
  await menu('#m2-list .m2-map >> nth=0', 'Hide file extensions');
  ok('2. hidden on Hide file extensions', ((await row(a)) || [])[1] === '' && ((await row('acly-graphml')) || [])[1] === '');
  await menu('#m2-list .m2-map >> nth=0', 'Show file extensions');

  // 3. rename refused
  await menu('#m2-list .m2-map[data-id="' + a2 + '"]', 'Rename map');
  await page.fill('#m2-list input.m2-map-edit', 'Unnamed map'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  var red = await page.$eval('#m2-list input.m2-map-edit', function (f) { return f.classList.contains('m2-bad'); }).catch(function () { return false; });
  ok('3. Rename map to a name its group has in its format: the field red', red);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  ok('3. the name kept', ((await row(a2)) || [])[0] === 'Unnamed map 2');
  await menu('#m2-list .m2-map[data-id="' + c + '"]', 'Rename map');   // the same name in another format: taken
  await page.fill('#m2-list input.m2-map-edit', 'Unnamed map 2'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  ok('3. the same name in another format: renamed', ((await row(c)) || [])[0] === 'Unnamed map 2');

  // 4. move into a group holding the name
  await menu('#m2-list .m2-group[data-group="AsthmaMap"]', 'New SBGN-ML map'); var g1 = await hash(); await toList();
  ok('4. a new map in AsthmaMap: Unnamed map (free there)', ((await row(g1)) || [])[0] === 'Unnamed map' && ((await row(g1)) || [])[2] === 'AsthmaMap', JSON.stringify(await row(g1)));
  await page.click('#m2-list .m2-map[data-id="' + a + '"]', { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Move to...")'); await page.waitForTimeout(400);
  await page.click('.m2-cx button:text-is("AsthmaMap")'); await page.waitForTimeout(1500);
  ok('4. moved into AsthmaMap, where its name was taken: Unnamed map (1)', JSON.stringify(await row(a)) === JSON.stringify(['Unnamed map (1)', '.sbgn', 'AsthmaMap']), JSON.stringify(await row(a)));

  // 5. restore and copies
  await menu('#m2-list .m2-map[data-id="' + g1 + '"]', 'Delete map');
  await menu('#m2-list .m2-map[data-id="' + a + '"]', 'Rename map');
  await page.fill('#m2-list input.m2-map-edit', 'Unnamed map'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  ok('5. the name free again once the other is in Deleted', ((await row(a)) || [])[0] === 'Unnamed map');
  if (/shut/.test(await page.$eval('#m2-list .m2-bin', function (h) { return h.className; }))) { await page.click('#m2-list .m2-bin'); await page.waitForTimeout(300); }
  await menu('#m2-list .m2-binned[data-id="' + g1 + '"]', 'Restore');
  ok('5. Restore where the group has the name in its format: Unnamed map (1)', ((await row(g1)) || [])[0] === 'Unnamed map (1)', JSON.stringify(await row(g1)));
  await menu('#m2-list .m2-map[data-id="' + a2 + '"]', 'Make a copy'); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await menu('#m2-list .m2-map[data-id="' + a2 + '"]', 'Make a copy'); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  var copies = await page.$$eval('#m2-list .m2-map:not(.m2-binned) .m2-name', function (l) { return l.map(function (x) { return x.textContent; }).filter(function (t) { return /^Copy of Unnamed map 2/.test(t); }); });
  ok('5. Make a copy twice: Copy of <name>, Copy of <name> (1)', copies.indexOf('Copy of Unnamed map 2') >= 0 && copies.indexOf('Copy of Unnamed map 2 (1)') >= 0, copies.join(' | '));

  // 6. a site map, no token
  await menu('#m2-list .m2-map[data-id="acly-graphml"]', 'Make a copy'); await page.keyboard.press('Escape'); await page.waitForTimeout(800);
  var cp6 = await page.evaluate(function () { var b = Array.prototype.slice.call(document.querySelectorAll('#m2-list .m2-map')).filter(function (x) { return /^Copy of Acetyl-CoA synthesis/.test(x.querySelector('.m2-name').textContent); })[0]; return b && b.dataset.id; });
  await page.click('#m2-list .m2-map[data-id="' + cp6 + '"]', { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Move to...")'); await page.waitForTimeout(400);
  await page.click('.m2-cx button:text-is("AsthmaMap")'); await page.waitForTimeout(1500);
  await menu('#m2-list .m2-map[data-id="' + cp6 + '"]', 'Rename map');
  await page.fill('#m2-list input.m2-map-edit', 'Acetyl-CoA synthesis'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  ok('6. a map of the reader\'s named Acetyl-CoA synthesis (GraphML) in AsthmaMap', JSON.stringify(await row(cp6)) === JSON.stringify(['Acetyl-CoA synthesis', '.graphml', 'AsthmaMap']), JSON.stringify(await row(cp6)));
  await page.click('#m2-list .m2-map[data-id="acly-graphml"]', { button: 'right' }); await page.waitForTimeout(300);
  await page.click('.m2-cx button:text-is("Move to...")'); await page.waitForTimeout(400);
  await page.click('.m2-cx button:text-is("AsthmaMap")'); await page.waitForTimeout(1500);
  ok('6. the site map moved there without a token: Acetyl-CoA synthesis (1)', JSON.stringify(await row('acly-graphml')) === JSON.stringify(['Acetyl-CoA synthesis (1)', '.graphml', 'AsthmaMap']), JSON.stringify(await row('acly-graphml')));
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(4000); await list();
  ok('6. after a reload too', JSON.stringify(await row('acly-graphml')) === JSON.stringify(['Acetyl-CoA synthesis (1)', '.graphml', 'AsthmaMap']), JSON.stringify(await row('acly-graphml')));

  // 7. case
  await menu('#m2-list .m2-map[data-id="' + cp6 + '"]', 'Rename map');
  await page.fill('#m2-list input.m2-map-edit', 'ACETYL-COA SYNTHESIS (1)'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  ok('7. a name taken in other case: refused', await page.$eval('#m2-list input.m2-map-edit', function (f) { return f.classList.contains('m2-bad'); }).catch(function () { return false; }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await menu('#m2-list .m2-map[data-id="' + cp6 + '"]', 'Rename map');
  await page.fill('#m2-list input.m2-map-edit', 'acetyl-CoA synthesis'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  ok('7. its own name in other case: kept as typed', ((await row(cp6)) || [])[0] === 'acetyl-CoA synthesis', JSON.stringify(await row(cp6)));

  ok('no script errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
