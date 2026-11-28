// Moves made just before leaving editing are kept (no token, a folder chosen). Leaving empties the editor's undo list
// (histKeep): the picture the viewer shows and the browser's draft written 0.8 s after the last move must not read it
// as "no moves". Per wait between the last move and leaving (0, 0.3, 1 s): the viewer shows the editor's drawing,
// editing again starts from every move, and so does a reload. Then, on a map opened from its draft: a move, out, back,
// that move undone and out at once: editing again starts from the draft, not from the undone move. The folder is
// played by the browser's private file system.
//   node tests/quick-leave.js [base address] [map id] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/', id = process.argv[3] || 'glycolysis-graphml', local = process.argv[4], bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
(async function () {
  var b = await chromium.launch();
  for (var wait of [0, 300, 1000]) {
    var ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), page = await ctx.newPage(), errs = [];
    page.on('pageerror', function (e) { errs.push(e.message); });
    if (local) {
      var ed = require('./editor-now.js')(local);
      await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    }
    await page.addInitScript(function () { window.showDirectoryPicker = function () { return navigator.storage.getDirectory().then(function (r) { return r.getDirectoryHandle('maps', { create: true }); }); }; });
    // the map's text without a group's border insets, which opening the map works out again from its members
    var now = function () { return page.evaluate(function () { var n = window.m2EditNow && window.m2EditNow(); return n ? n.text.replace(/<y:BorderInsets[^>]*\/>/g, '') : null; }); };
    var edit = async function () {
      await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(1500);
      var e = await page.$('#m2-ed-this:visible'); if (e) await e.click();
      await page.waitForFunction(function () { return !!(window.m2EditNow && window.m2EditNow()); }, null, { timeout: 30000 }); await page.waitForTimeout(1500);
    };
    var nudge = async function (n) { for (var i = 0; i < n; i++) { await page.keyboard.press('Shift+ArrowRight'); await page.waitForTimeout(100); } };
    await page.goto(base + '#' + id, { waitUntil: 'load' });
    await page.evaluate(function () { localStorage.clear(); }); await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);
    await edit();
    var c = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 350 && r.top > 120 && r.right < 1350 && r.bottom < 850) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
    await page.mouse.click(c[0], c[1]); await page.waitForTimeout(300);
    await nudge(3); await page.waitForTimeout(1200);   // the first draft written
    await page.click('#m2-ed-l-folder'); await page.waitForTimeout(800);
    await nudge(4);
    var t1 = await now();
    if (wait) await page.waitForTimeout(wait);
    var pic = await page.evaluate(function () { var n = window.m2EditNow(); return n && n.svg; });
    await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(2500);
    var shown = await page.evaluate(function () { var i = document.getElementById('m2-img'); return i.tagName.toLowerCase(); });
    ok('wait ' + wait + ': the viewer shows the editor’s drawing, not an older picture', shown === 'svg' && !!pic, shown);
    await edit();
    ok('wait ' + wait + ': editing again starts from every move', (await now()) === t1);
    await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(2000);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(4000);
    await edit();
    ok('wait ' + wait + ': after a reload, every move there', (await now()) === t1);
    if (wait === 0) {   // the draft's map: a move made and undone again in a later visit
      var tA = await now();
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);   // the node kept selected: a click on it would open its name
      var c2 = await page.$$eval('#m2-img [data-n]', function (l) { for (var g of l) { var r = g.getBoundingClientRect(); if (r.width > 20 && r.width < 200 && r.left > 350 && r.top > 120 && r.right < 1350 && r.bottom < 850) return [r.left + r.width / 2, r.top + r.height / 2]; } return null; });
      await page.mouse.click(c2[0], c2[1]); await page.waitForTimeout(300);
      await nudge(1); await page.waitForTimeout(1500);
      var tB = await now();
      await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(2500);
      await edit();
      for (var u = 0; u < 5 && (await now()) !== tA; u++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(400); }
      var undone = (await now()) === tA;
      await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(2500);
      await edit();
      ok('draft, a later move undone and out at once: editing again starts from the draft', undone && tB !== tA && (await now()) === tA, 'undone ' + undone + ' now=' + ((await now()) === tB ? 'B' : (await now()) === tA ? 'A' : 'other ' + ((await now()) || '').length + ' A ' + tA.length));
      await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(2000);
    }
    ok('wait ' + wait + ': no script error', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
