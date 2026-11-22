// The error catcher: an error nobody caught while a map is edited is said in one line with its place in the editor's
// sources, and the map is put back as it was after the last change that ended. On the styles page, Glycolysis
// (GraphML; MAP=<id> for another map), no token. A node dragged; on the third step of the drag the page's setAttribute
// throws once (as a fault in the editor's drawing of the drag would): the status line names the source file and line,
// that line of the sources calls setAttribute, the map's text is as before the drag, the drag let go, and the next
// move works. What the browser reports that is no fault of the page (a ResizeObserver loop, a fetch cut off, an error of a browser extension) is passed
// by, and nothing is said in view mode.
//   node tests/error-catch.js [base address] [--local]
// --local: the editor of the working tree routed into the live page, to check before a release.
var engine = require('playwright')[process.env.BROWSER || 'chromium'], fs = require('fs'), path = require('path');
var base = process.argv[2] && process.argv[2][0] !== '-' ? process.argv[2] : 'https://viewer-source.github.io/styles/';
var local = process.argv.indexOf('--local') > 0, here = path.join(__dirname, '..'), bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
(async function () {
  var b = await engine.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });
  if (local) {   // the editor and its source map, built from the working tree
    var built = require(path.join(here, 'editor', 'build.js')).files(require(require.resolve('esbuild', { paths: [here] })));
    await ctx.route(/\/styles\/editor\/editor\.js(\?|$)/, function (r) { r.fulfill({ contentType: 'application/javascript', body: built.js }); });
    await ctx.route(/\/styles\/editor\/editor\.js\.map(\?|$)/, function (r) { r.fulfill({ contentType: 'application/json', body: built.map }); });
  }
  await page.addInitScript(function () {   // setAttribute throws once on the map's drawing while window.__boom is set
    try { localStorage.setItem('atlas-edit-level', 'full'); } catch (e) {}
    var set = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function () { if (window.__boom && this.closest && this.closest('#m2-img')) { window.__boom = false; throw new Error('test boom'); } return set.apply(this, arguments); };
  });
  var status = function () { return page.$eval('#m2-ed-status', function (s) { return s.textContent; }).catch(function () { return ''; }); };
  var now = function () { return page.evaluate(function () { var n = window.m2EditNow && window.m2EditNow(); return n ? n.text : null; }); };
  var node = function () { return page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 350 && r.top > 120 && r.right < 1300 && r.bottom < 800) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; }); };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); localStorage.setItem('atlas-edit-level', 'full'); });
  await page.goto(base + '#' + (process.env.MAP || 'glycolysis-graphml'), { waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(1500);

  // view mode: nothing said, nothing done
  await page.evaluate(function () { setTimeout(function () { throw new Error('test view'); }, 0); });
  await page.waitForTimeout(300);
  ok('view mode: an error says nothing in the Edit window', !(await status()), await status());

  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  var t0 = await now(), c = await node();
  await page.mouse.click(c[0], c[1]); await page.waitForTimeout(250);   // selected, then dragged
  await page.mouse.move(c[0], c[1]); await page.mouse.down();
  for (var i = 1; i <= 6; i++) { if (i === 3) await page.evaluate(function () { window.__boom = true; }); await page.mouse.move(c[0] + 12 * i, c[1] + 6 * i, { steps: 2 }); await page.waitForTimeout(60); }
  await page.mouse.up(); await page.waitForTimeout(1500);
  var st = await status(), m = /Something went wrong in the editor \(([\w.-]+\.js):(\d+): test boom\); the map is back as it was after the last change\./.exec(st);
  ok('the error said in one line with its place in the sources', !!m, st);
  if (m) {
    var f = path.join(here, 'editor', 'src', m[1]), line = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n')[+m[2] - 1] || '' : '';
    ok('that line of the sources is where setAttribute was called', /setAttribute/.test(line), m[1] + ':' + m[2] + '  ' + line.trim().slice(0, 100));
  }
  var t1 = await now();
  if (process.env.DEBUG && t1 !== t0) { var a = t0.split('\n'), z = t1.split('\n'); for (var q = 0; q < Math.max(a.length, z.length); q++) if (a[q] !== z[q]) { console.log('  - ' + (a[q] || '').trim().slice(0, 160)); console.log('  + ' + (z[q] || '').trim().slice(0, 160)); } }
  ok("the map's text as before the drag", t1 === t0);
  ok('only the planted error reached the page', errs.length === 2 && errs.every(function (e) { return /test (boom|view)/.test(e); }), errs.join(' | '));
  var c2 = await node();
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);   // a second click on a selected node deselects it
  await page.mouse.click(c2[0], c2[1]); await page.waitForTimeout(300);
  for (var k = 0; k < 2; k++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(150); }
  await page.waitForTimeout(800);
  ok('editing goes on: the next move changes the map', (await now()) !== t0);
  await page.keyboard.press('Meta+z'); await page.keyboard.press('Control+z'); await page.waitForTimeout(800);
  ok('and Undo takes that move back to the map before the drag', (await now()) === t0);

  // what the browser reports that is no fault of the page
  await page.evaluate(function () { document.getElementById('m2-ed-status').textContent = ''; });
  await page.evaluate(function () {
    window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
    Promise.reject(new TypeError('Failed to fetch'));
    Promise.reject(new TypeError('Load failed'));
    Promise.reject(new TypeError('Fetch API cannot load https://api.github.com/x due to access control checks.'));
    var ext = new TypeError("Cannot read properties of undefined (reading 'M_ID')");   // a browser extension's promise
    ext.stack = 'TypeError: ' + ext.message + '\n    at chrome-extension://abcdefgh/200.js:1:2345';
    Promise.reject(ext);
  });
  await page.waitForTimeout(500);
  ok('a ResizeObserver loop, fetches cut off and an extension\u2019s error are passed by', !(await status()), await status());
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
