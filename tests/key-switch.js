// An arrow key pressed just before another map is clicked (within the keys' 150 ms settle): the move settles on the
// map it was made on, the next map's text untouched (core.js stop, keyFlush). GraphML, whose opening is at once.
//   node tests/key-switch.js [--local]   (--local: the working tree's editor and renderers routed in)
var path = require('path'), fs = require('fs'), { chromium } = require('playwright'), here = path.join(__dirname, '..'), editorNow = require('./editor-now.js');
var local = process.argv.indexOf('--local') > 0, base = 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage(), errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  if (local) {
    var ed = editorNow(here);
    await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/(converter|yrender|layout)\/[^/?]+\.js/, function (r) { var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]); if (fs.existsSync(fp)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue(); });
  }
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-edit-side', 'right'); });
  var on = function (id) { return page.waitForFunction(function (id) { var n = window.m2EditNow && window.m2EditNow(); return !!(n && n.id === id); }, id, { timeout: 60000 }).then(function () { return page.waitForTimeout(1500); }); };
  var txt = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  await page.goto(base + '#glycolysis-graphml', { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]'); await page.waitForTimeout(2500);
  await page.click('.m2-ri[data-win="edit"]'); await on('glycolysis-graphml');
  await page.click('.m2-map[data-id="glycogen-muscle-graphml"]'); await on('glycogen-muscle-graphml');
  var b0 = await txt();
  await page.click('.m2-map[data-id="glycolysis-graphml"]'); await on('glycolysis-graphml');
  var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 350 && r.top > 120 && r.right < 1350 && r.bottom < 850) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
  await page.mouse.click(c[0], c[1]); await page.waitForTimeout(400);
  var a0 = await txt();
  await page.keyboard.press('Shift+ArrowRight');
  await page.click('.m2-map[data-id="glycogen-muscle-graphml"]');   // at once, before the keys' 150 ms settle
  await on('glycogen-muscle-graphml'); await page.waitForTimeout(1500);
  var b1 = await txt();
  await page.click('.m2-map[data-id="glycolysis-graphml"]'); await on('glycolysis-graphml');
  var a1 = await txt();
  console.log((b1 === b0 ? 'ok    ' : 'WRONG ') + 'the second map untouched by the first map\'s keys');
  console.log((a1 !== a0 ? 'ok    ' : 'WRONG ') + 'the first map keeps its move');
  console.log(errs.length ? 'WRONG page errors: ' + errs.slice(0, 2).join(' | ') : 'ok    no page errors');
  await b.close();
  process.exit(b1 === b0 && a1 !== a0 && !errs.length ? 0 : 1);
})();
