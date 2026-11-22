// Downloads in the list's right-click menu, as the map's own menu has them (no token).
//   1. A site map not shown, right-clicked in the list: Download <its format>, Download PNG, Download SVG after Rename
//      map, Make a copy, Move to..., under a line 2. Each gives a file: the map's own, its PNG, its SVG. 3. The map's menu on empty
//      space has the same three. 4. Several maps selected: no downloads. 5. The Downloads window and the row under the
//      map: the map's own file, PNG, SVG, no other format. 6. A map edited without a token (a draft), then another map
//      shown: the list's Download on the edited map gives the edited file, not the site's.
//   node tests/list-download.js [base address] [--local]
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
  var b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }), page = await ctx.newPage(), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
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
  var menu = function () { return page.$$eval('.m2-cx > button, .m2-cx > a, .m2-cx > .m2-sep', function (l) { return l.map(function (x) { return x.classList.contains('m2-sep') ? '|' : x.textContent; }); }); };
  // a map not shown: a CellDesigner one
  var row = '#m2-list .m2-map[data-id$="-celldesigner"]:not(.m2-on):not(.m2-binned) >> nth=0';
  if (!(await page.$(row))) row = '#m2-list .m2-map:not(.m2-on):not(.m2-binned) >> nth=0';
  var id = await page.$eval(row.split(' >> ')[0], function (r) { return r.dataset.id; });
  await page.click(row, { button: 'right' }); await page.waitForTimeout(300);
  var m1 = await menu(), dl = m1.filter(function (t) { return /^Download /.test(t); });
  ok('1. ' + id + ': three downloads', dl.length === 3 && /^Download (CellDesigner XML|GraphML|SBGN-ML)$/.test(dl[0]) && dl[1] === 'Download PNG' && dl[2] === 'Download SVG', m1.join(' / '));
  ok('1. after the map\'s own items, a group of their own between lines', m1.indexOf(dl[0]) > m1.indexOf('Move to...') && m1[m1.indexOf(dl[0]) - 1] === '|' && m1[m1.indexOf('Download SVG') + 1] === '|', m1.join(' / '));
  var got = [];
  for (var i = 0; i < dl.length; i++) {
    if (i) { await page.click(row, { button: 'right' }); await page.waitForTimeout(300); }
    var w = page.waitForEvent('download', { timeout: 20000 }).catch(function () { return null; });
    await page.click('.m2-cx button:text-is("' + dl[i] + '")');
    var d = await w, p = d && await d.path().catch(function () { return null; }), size = p ? fs.statSync(p).size : 0;
    got.push(d ? d.suggestedFilename() + ' ' + size : 'none');
    ok('2. ' + dl[i] + ' gives a file', !!d && size > 500, d ? d.suggestedFilename() + ', ' + size + ' bytes' : 'no download');
  }
  // 3. the map's menu on empty space: the same three
  var v = await (await page.$('#m2-view')).boundingBox();
  await page.mouse.click(v.x + 6, v.y + 6, { button: 'right' }); await page.waitForTimeout(300);
  var m3 = (await menu()).filter(function (t) { return /^Download /.test(t); });
  ok('3. the map\'s menu: the same three', m3.length === 3, m3.join(' / '));
  await page.keyboard.press('Escape');
  // 4. two maps selected: no downloads
  var mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=1'); await page.waitForTimeout(500);
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=2', { modifiers: [mod] }); await page.waitForTimeout(300);
  await page.click('#m2-list .m2-map:not(.m2-binned) >> nth=2', { button: 'right' }); await page.waitForTimeout(300);
  var m4 = await menu();
  ok('4. two maps selected: no downloads', !m4.some(function (t) { return /^Download /.test(t); }), m4.join(' / '));
  // 5. the row under the map and the Downloads window: the map's own file, PNG, SVG
  var rowDl = await page.$$eval('#m2-downloads > a', function (l) { return l.map(function (x) { return x.textContent.trim(); }); });
  var winDl = await page.$$eval('#m2-dlwin a:not(.m2-x)', function (l) { return l.map(function (x) { return x.textContent.trim(); }); });
  var three = function (l) { var f = l.filter(function (t) { return !/^(Data|References|Newt|MINERVA)$/.test(t); }); return f.length === 3 && /^(GraphML|CellDesigner|SBGN-ML)$/.test(f[0]) && f[1] === 'PNG' && f[2] === 'SVG'; };
  ok('5. the row: own file, PNG, SVG', three(rowDl), rowDl.join(' / '));
  ok('5. the Downloads window: the same', three(winDl), winDl.join(' / '));
  if (!(await page.$('#m2-dlwin a:visible'))) { await page.click('.m2-ri[data-win="dl"]'); await page.waitForTimeout(300); }
  var w5 = page.waitForEvent('download', { timeout: 20000 }).catch(function () { return null; });
  await page.click('#m2-dlwin a:text-is("PNG")');
  var d5 = await w5, p5 = d5 && await d5.path().catch(function () { return null; });
  ok('5. the window\'s PNG gives a PNG', !!p5 && fs.readFileSync(p5).slice(1, 4).toString() === 'PNG', d5 ? d5.suggestedFilename() : 'no download');
  // 6. a draft: glycolysis GraphML edited (every node one step right), then another map shown
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' }); await page.waitForTimeout(4000);
  var site6 = await page.evaluate(function () { var a = document.querySelector('#m2-dlwin a[download]') || document.querySelector('#m2-downloads a[download]'); return a ? fetch(a.href).then(function (r) { return r.text(); }) : ''; });
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(5000);
  var mod6 = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2);
  await page.keyboard.press(mod6 + '+a'); await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(3000);
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(1500);
  await page.click('#m2-list .m2-map:not(.m2-binned):not([data-id="glycolysis-graphml"]) >> nth=0'); await page.waitForTimeout(2000);
  await page.click('#m2-list .m2-map[data-id="glycolysis-graphml"]', { button: 'right' }); await page.waitForTimeout(300);
  var w6 = page.waitForEvent('download', { timeout: 20000 }).catch(function () { return null; });
  await page.click('.m2-cx button:text-is("Download GraphML")').catch(function () {});
  var d6 = await w6, p6 = d6 && await d6.path().catch(function () { return null; }), t6 = p6 ? fs.readFileSync(p6, 'utf8') : '';
  ok('6. the edited map\'s draft downloaded from the list', !!t6 && !!site6 && t6 !== site6 && /<graphml/.test(t6), (d6 ? d6.suggestedFilename() : 'no download') + ', ' + t6.length + ' vs ' + site6.length);
  ok('no script errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' WRONG' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
