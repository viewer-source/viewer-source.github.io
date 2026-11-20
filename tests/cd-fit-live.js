// The canvas fitted by itself on Glycolysis (CellDesigner), on the live page (by default the styles page): no Resize canvas
// in the right-click menu; after a node is nudged, the file's canvas fits the content (its top left 40 to 56 from the
// corner on the default Grid size 8, block 16, the test browser storing none; the canvas 40 past its right and bottom), a node kept where it was on screen; a compartment dropped far right
// grows the canvas, deleting it shrinks the canvas back; undo and redo keep the map still. Nothing is saved (no token).
// No script error.
//   node tests/cd-fit-live.js [base address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var start = async function (h) {
    await page.goto(base + '#' + h, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(4000);
  };
  var empty = async function () {   // a point of the map window with nothing under it
    return page.evaluate(function () {
      var r = document.querySelector('#m2-view, .m2-view') ? (document.querySelector('#m2-view') || document.querySelector('.m2-view')).getBoundingClientRect() : document.getElementById('m2-img').getBoundingClientRect();
      for (var y = r.top + 20; y < r.bottom - 20; y += 13) for (var x = r.left + 20; x < r.right - 20; x += 13) { var e = document.elementFromPoint(x, y); if (e && !e.closest('[data-n],[data-e]') && e.closest('#m2-img, #m2-view, .m2-view')) return [x, y]; }
      return null;
    });
  };
  var menu = async function (P) { await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(300); return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); };
  var size = function () { return page.evaluate(function () { var m = /modelDisplay sizeX="([^"]*)" sizeY="([^"]*)"/.exec(window.m2EditNow().text); return m ? [+m[1], +m[2]] : null; }); };
  var where = function (id) { return page.evaluate(function (id) { var g = document.querySelector(id ? '#m2-img [data-n="' + id + '"]' : '#m2-img [data-n]'), r = g.getBoundingClientRect(); return [g.getAttribute('data-n'), Math.round(r.left), Math.round(r.top)]; }, id || null); };   // a node, the first one when none is named
  var fitted = function () { return page.evaluate(function () {   // the content's box against the canvas: [left, top, canvas less right, canvas less bottom]
    var t = window.m2EditNow().text, m = /modelDisplay sizeX="([^"]*)" sizeY="([^"]*)"/.exec(t), b, re = /<celldesigner:bounds x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"/g, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    while ((b = re.exec(t))) { x0 = Math.min(x0, +b[1]); y0 = Math.min(y0, +b[2]); x1 = Math.max(x1, +b[1] + +b[3]); y1 = Math.max(y1, +b[2] + +b[4]); }
    return [x0, y0, +m[1] - x1, +m[2] - y1];
  }); };
  var fits = function (f) { return f[0] >= 40 && f[0] < 56 && f[1] >= 40 && f[1] < 56 && f[2] >= 40 && f[2] < 56 && f[3] >= 40 && f[3] < 56; };
  await start('glycolysis-graphml');
  var P = await empty(), l0 = P ? await menu(P) : [];
  ok('GraphML map: no Resize canvas', P && l0.indexOf('Snap map to grid') >= 0 && l0.indexOf('Resize canvas') < 0, JSON.stringify(l0));
  await page.keyboard.press('Escape');
  await start('glycolysis-celldesigner');
  P = await empty(); var l1 = P ? await menu(P) : [];
  ok('CellDesigner map: no Resize canvas', l1.indexOf('Repack all complexes') >= 0 && l1.indexOf('Resize canvas') < 0, JSON.stringify(l1));
  await page.keyboard.press('Escape');
  var pic = function () { return page.evaluate(function () { var g = document.querySelector('img#m2-img'), r = g && g.getBoundingClientRect(); return r ? [Math.round(r.left), Math.round(r.top)] : null; }); };
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(1500);
  var pa = await pic();   // editing entered and left with no change: the site's picture where it was
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(3000);
  await page.click('.m2-ri[data-win="list"]'); await page.waitForTimeout(1500);
  var pb = await pic();
  ok('edit entered and left with no change: the map not moved', pa && pb && Math.abs(pb[0] - pa[0]) <= 1 && Math.abs(pb[1] - pa[1]) <= 1, JSON.stringify([pa, pb]));
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(3000);
  var id = (await where())[0];
  var w0 = await where(id);
  await page.mouse.click(w0[1] + 4, w0[2] + 4); await page.waitForTimeout(400);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(2500);
  var f1 = await fitted(), w1 = await where(id);
  ok('after a nudge the canvas fits the content (40 to 56 on every side)', fits(f1), JSON.stringify(f1));
  ok('the map stayed still on screen', w1[0] === id && Math.abs(w1[1] - w0[1]) <= 1 && Math.abs(w1[2] - w0[2]) <= 1, JSON.stringify([w0, w1]));
  var sg = await page.$eval('#m2-editwin button[data-make="cd:COMPARTMENT"]', function (x) { var q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.move(sg[0], sg[1]); await page.mouse.down(); await page.mouse.move(1000, 300, { steps: 6 }); await page.mouse.move(1350, 250, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(2500);
  var s2 = await size(), f2 = await fitted(), w2 = await where(id);
  ok('a compartment dropped far right: the canvas grows round it', fits(f2), JSON.stringify([s2, f2]));
  ok('the map still', Math.abs(w2[1] - w0[1]) <= 1 && Math.abs(w2[2] - w0[2]) <= 1, JSON.stringify([w0, w2]));
  await page.keyboard.press('Delete'); await page.waitForTimeout(2500);
  var s3 = await size(), f3 = await fitted(), w3 = await where(id);
  ok('deleted: the canvas shrinks back', fits(f3) && s3[0] < s2[0], JSON.stringify([s2, s3, f3]));
  ok('the map still', Math.abs(w3[1] - w0[1]) <= 1 && Math.abs(w3[2] - w0[2]) <= 1, JSON.stringify([w0, w3]));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
  var s4 = await size(), w4 = await where(id);
  ok('undo: the compartment and its canvas back, the map still', JSON.stringify(s4) === JSON.stringify(s2) && Math.abs(w4[1] - w0[1]) <= 1 && Math.abs(w4[2] - w0[2]) <= 1, JSON.stringify([s4, w4]));
  await page.keyboard.press('Control+y'); await page.waitForTimeout(2500);
  var s5 = await size(), w5 = await where(id);
  ok('redo: shrunk again, the map still', JSON.stringify(s5) === JSON.stringify(s3) && Math.abs(w5[1] - w0[1]) <= 1 && Math.abs(w5[2] - w0[2]) <= 1, JSON.stringify([s5, w5]));
  await page.mouse.move(sg[0], sg[1]); await page.mouse.down(); await page.mouse.move(500, 400, { steps: 6 }); await page.mouse.move(300, 120, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(2500);
  var f6 = await fitted(), w6 = await where(id);
  ok('a compartment dropped far left and above: the canvas fits round it', fits(f6), JSON.stringify(f6));
  ok('the map still', Math.abs(w6[1] - w0[1]) <= 1 && Math.abs(w6[2] - w0[2]) <= 1, JSON.stringify([w0, w6]));
  await page.keyboard.press('Delete'); await page.waitForTimeout(2500);
  var f7 = await fitted(), s7 = await size(), w7 = await where(id);
  ok('deleted: the content back at the corner, the canvas as before', fits(f7) && JSON.stringify(s7) === JSON.stringify(s3), JSON.stringify([f7, s7, s3]));
  ok('the map still', Math.abs(w7[1] - w0[1]) <= 1 && Math.abs(w7[2] - w0[2]) <= 1, JSON.stringify([w0, w7]));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
