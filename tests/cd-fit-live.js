// Resize canvas on the live page (by default the styles page), on Glycolysis (CellDesigner): in the right-click menu on empty
// map space after Repack all complexes, absent on a GraphML map; chosen, the file's canvas fitted (content's top left 40 to 56
// from the corner, 40 past its right and bottom), a node kept where it was on screen, undo and redo keeping it there too.
// Nothing is saved (no token). No script error.
//   node tests/cd-fit-live.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
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
  var where = function () { return page.evaluate(function () { var g = document.querySelector('#m2-img [data-n]'), r = g.getBoundingClientRect(); return [g.getAttribute('data-n'), Math.round(r.left), Math.round(r.top)]; }); };
  await start('glycolysis-graphml');
  var P = await empty(), l0 = P ? await menu(P) : [];
  ok('GraphML map: no Resize canvas', P && l0.indexOf('Snap map to grid') >= 0 && l0.indexOf('Resize canvas') < 0, JSON.stringify(l0));
  await page.keyboard.press('Escape');
  await start('glycolysis-celldesigner');
  P = await empty(); var l1 = P ? await menu(P) : [];
  ok('CellDesigner map: Resize canvas after Repack all complexes', l1.indexOf('Resize canvas') === l1.indexOf('Repack all complexes') + 1, JSON.stringify(l1));
  var s0 = await size(), w0 = await where();
  await page.click('.m2-cx button:has-text("Resize canvas")'); await page.waitForTimeout(2500);
  var s1 = await size(), w1 = await where();
  ok('the canvas changed', s1 && (s1[0] !== s0[0] || s1[1] !== s0[1]), JSON.stringify([s0, s1]));
  ok('the map stayed still on screen', w1[0] === w0[0] && Math.abs(w1[1] - w0[1]) <= 1 && Math.abs(w1[2] - w0[2]) <= 1, JSON.stringify([w0, w1]));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(2500);
  var s2 = await size(), w2 = await where();
  ok('undo: the canvas back, the map still', JSON.stringify(s2) === JSON.stringify(s0) && Math.abs(w2[1] - w0[1]) <= 1 && Math.abs(w2[2] - w0[2]) <= 1, JSON.stringify([s2, w2]));
  await page.keyboard.press('Control+y'); await page.waitForTimeout(2500);
  var s3 = await size(), w3 = await where();
  ok('redo: fitted again, the map still', JSON.stringify(s3) === JSON.stringify(s1) && Math.abs(w3[1] - w0[1]) <= 1 && Math.abs(w3[2] - w0[2]) <= 1, JSON.stringify([s3, w3]));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
