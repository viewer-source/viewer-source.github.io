// The baseline of plan 3 (step 0, measured again after step 5): per map, the time to open it (the address to its
// picture decoded), to enter edit (the Edit tab to the editor's grouped drawing in the page), of one change (a node
// moved by Shift+Arrow to the drawing made again), and the page's JavaScript heap after each (Chromium only). A map of
// the site by its id; a file from the computer by --add <file> (added with Add map from file, no token: its time to
// open is the adding and drawing in this browser). A test-set name (tests/lib/open-map.js TESTSET) is added by Add map
// from file first, untimed, and then opened by the address it got, as a site map. Each map in a fresh page; numbers
// printed, not checked.
//   node tests/baseline.js [base address] [map ids ...] [--add <file> ...] [--runs N] --data=<clone of the data repository>
var engine = require('playwright')[process.env.BROWSER || 'chromium'], fs = require('fs'), path = require('path'), zlib = require('zlib'), OM = require('./lib/open-map.js');
var args = process.argv.slice(2), base = 'https://viewer-source.github.io/', ids = [], adds = [], runs = 1;
for (var i = 0; i < args.length; i++) {
  if (args[i] === '--add') adds.push(args[++i]); else if (args[i] === '--runs') runs = +args[++i];
  else if (/^https?:/.test(args[i])) base = args[i]; else if (args[i].slice(0, 2) !== '--') ids.push(args[i]);
}
if (!ids.length && !adds.length) ids = ['glycolysis-graphml', 'asthmamap-mast-cell-graphml', 'asthmamap-mast-cell-celldesigner', 'recon2-v01'];
var LONG = 600000;
var s = function (ms) { return (ms / 1000).toFixed(2) + ' s'; };
var mb = function (b) { return b == null ? '-' : (b / 1048576).toFixed(0) + ' MB'; };

async function one(b, what) {
  var ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errs = [];
  page.setDefaultTimeout(LONG);   // a large map holds the page for many seconds
  page.on('pageerror', function (e) { errs.push(e.message); });
  var cdp = null; try { cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable'); } catch (e) { cdp = null; }
  var heap = async function () {
    if (!cdp) return null;
    try { await cdp.send('HeapProfiler.collectGarbage'); } catch (e) {}
    var m = (await cdp.send('Performance.getMetrics')).metrics; return (m.find(function (x) { return x.name === 'JSHeapUsedSize'; }) || {}).value;
  };
  var r = { what: what.id || path.basename(what.add) };
  var shown = function () {
    return page.waitForFunction(function () {
      var im = document.getElementById('m2-img');
      return im && im.complete && im.naturalWidth > 0 && !document.documentElement.classList.contains('m2-hold') && im.decode().then(function () { return true; }, function () { return true; });
    }, null, { timeout: LONG, polling: 50 });
  };
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.clear(); });
  var t = Date.now();
  if (what.id) {
    await OM.byAddress(page, base, await OM.resolve(page, base, what.id));   // after the storage is cleared; a test-set file added first
    t = Date.now();
    await page.reload({ waitUntil: 'load' });   // the address opened afresh, the files in the browser's cache as a returning reader has them
    await shown();
  } else {
    await page.waitForSelector('.m2-ri[data-win="edit"]', { state: 'attached', timeout: 60000 }); await page.waitForTimeout(3000);
    if (!(await page.$('#m2-list .m2-map:visible'))) await page.click('.m2-ri[data-win="list"]');
    await page.click('#m2-list .m2-map >> nth=0', { button: 'right' }); await page.waitForTimeout(300);
    var chooser = page.waitForEvent('filechooser');
    await page.click('.m2-cx button:text-is("Add map from file")');
    var buf = fs.readFileSync(what.add); if (/\.gz$/.test(what.add)) buf = zlib.gunzipSync(buf);
    var nm = path.basename(what.add).replace(/\.gz$/, '');
    t = Date.now();
    await (await chooser).setFiles([{ name: nm, mimeType: 'text/xml', buffer: buf }]);
    await page.waitForFunction(function (n) { return Array.from(document.querySelectorAll('#m2-list .m2-map.m2-on .m2-name, #m2-list .m2-map[aria-current] .m2-name')).some(function (x) { return x.textContent === n; }) || Array.from(document.querySelectorAll('#m2-list .m2-map .m2-name')).some(function (x) { return x.textContent === n; }); }, nm.replace(/\.[^.]+$/, ''), { timeout: LONG, polling: 100 });
    await shown();
  }
  r.open = Date.now() - t; r.heapOpen = await heap();
  await page.waitForSelector('.m2-ri[data-win="edit"]:visible', { timeout: 60000 });
  await page.waitForTimeout(3000);   // the read-ahead a reader's pause gives
  t = Date.now();
  await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()) && !!document.querySelector('#m2-ed-overlay, .m2-editing') && !!document.querySelector('[data-n]'); }, null, { timeout: LONG, polling: 50 });
  r.edit = Date.now() - t; r.heapEdit = await heap();
  var c = await page.$$eval('[data-n]', function (l) { for (var g of l) { var q = g.getBoundingClientRect(); if (q.width > 8 && q.left > 320 && q.top > 120 && q.right < 1400 && q.bottom < 860) return [q.left + q.width / 2, q.top + q.height / 2]; } return null; });
  if (c) {
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(1500);
    var before = await page.evaluate(function () { return window.m2EditNow().svg; });
    await page.evaluate(function (b0) { window.__b0 = b0; }, before);
    t = Date.now();
    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForFunction(function () { var n = window.m2EditNow(); return n && n.svg !== window.__b0; }, null, { timeout: LONG, polling: 'raf' });
    r.change = Date.now() - t; r.heapChange = await heap();
  }
  r.errs = errs.length;
  await ctx.close();
  return r;
}

(async function () {
  var b = await engine.launch(), list = ids.map(function (id) { return { id: id }; }).concat(adds.map(function (f) { return { add: f }; }));
  console.log('map | open | enter edit | one change | heap after open, edit, change | script errors');
  for (var w of list) for (var k = 0; k < runs; k++) {
    var r;
    try { r = await one(b, w); } catch (e) { console.log((w.id || w.add) + ' | failed: ' + e.message.split('\n')[0]); continue; }
    console.log([r.what, s(r.open), s(r.edit), r.change != null ? s(r.change) : '-', [mb(r.heapOpen), mb(r.heapEdit), mb(r.heapChange)].join(', '), r.errs].join(' | '));
  }
  await b.close();
})();
