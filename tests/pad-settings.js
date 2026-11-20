// Paddings in Settings, Editing (atlas-app.html PAD_KEY, the two lists; core.js pads, cxRoom, grown), on the styles page:
// the lists Compartments (0 to 64 in steps of 4, 12 shown by default) and Complexes (repack, then 0 to 32, repack shown by
// default); the circled i after Complexes gives what Repack leaves, read from layout.js room, once editing runs. On
// Testing Glycolysis (SBGN-ML) and Glycolysis (CellDesigner): a complex dropped from the palette and a protein dropped
// into it; the protein pushed right and up by the arrow keys keeps As Repack's room to the complex (the sides and top
// from layout.js room; the complexes' names are at the bottom); Complexes set to 24 in Settings, the protein moved away
// and pushed again keeps 24. A compartment dropped and a protein in it, Compartments set to 4 in Settings: the protein
// pushed right keeps 4 to the compartment's inner line (CellDesigner: inside its membrane, 12). Room measured on screen
// in map units (the protein's Width in Properties against its width on screen), within 1.5. Nothing is saved (no token).
// No script error.
//   node tests/pad-settings.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
var MAPS = [['glycolysis-sbgn', 'complex', 'macromolecule', 'compartment', 0], ['glycolysis-celldesigner', 'cd:COMPLEX', 'cd:PROTEIN', 'cd:COMPARTMENT', 12]];
(async function () {
  var b = await chromium.launch(), bad = 0, errs = [];
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  for (var M of MAPS) {
    var h = M[0], page = await b.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', function (e) { errs.push(e.message); });
    var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
    var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }); };
    var drop = async function (sign, x, y) {
      var before = await ids(), s = await page.$eval('#m2-editwin button[data-make="' + sign + '"]', function (q) { var r = q.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.mouse.move(s[0], s[1]); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 6 }); await page.mouse.move(x, y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(2000);
      await page.keyboard.press('Escape');
      return (await ids()).filter(function (i) { return before.indexOf(i) < 0; })[0];
    };
    var setPad = function (id, v) { return page.evaluate(function (a) { var s = document.getElementById(a[0]); s.value = a[1]; s.dispatchEvent(new Event('change')); }, [id, v]); };
    var sel = async function (id) { var r = await rect(id); await page.keyboard.press('Escape'); await page.mouse.click((r[0] + r[2]) / 2, r[1] + 4); await page.waitForTimeout(500); };
    var keys = async function (k, n) { for (var j = 0; j < n; j++) await page.keyboard.press(k); await page.waitForTimeout(1800); };
    var unit = async function (id) { await sel(id); var w = parseFloat(await page.inputValue('#m2-ed-w')), r = await rect(id); return (r[2] - r[0]) / w; };
    await page.goto(base + '#' + h, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    var lists = await page.evaluate(function () { var o = function (id) { var s = document.getElementById(id); return [s.value, Array.prototype.map.call(s.options, function (x) { return x.value; }).join(',')]; }; return [o('m2-set-pad-comp'), o('m2-set-pad-cx')]; });
    ok(h + ': Compartments 12 shown, 0 to 64 in steps of 4', lists[0][0] === '12' && lists[0][1] === '0,4,8,12,16,24,32,48,64', JSON.stringify(lists[0]));
    ok(h + ': Complexes repack shown, then 0 to 32', lists[1][0] === 'repack' && lists[1][1] === 'repack,0,4,8,12,16,24,32', JSON.stringify(lists[1]));
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + M[1] + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(3000);
    var room = await page.evaluate(function () { return window.layout && window.layout.room; });
    var info = await page.$eval('#m2-set-pad-cxinfo', function (x) { return x.dataset.info; });
    ok(h + ': the circled i gives what Repack leaves, from layout.js', !!room && info.indexOf('Now: ') >= 0 && info.indexOf('top ' + room.top) >= 0 && info.indexOf('bottom ' + room.bottom) >= 0, info + ' ' + JSON.stringify(room));
    var view = await page.$eval('#m2-view', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
    var X = view[2] - 260, Y = view[3] - 170;
    var C = await drop(M[1], X, Y), P = C && await drop(M[2], X, Y);
    ok(h + ': a complex dropped and a protein in it', !!C && !!P);
    if (C && P) {
      var u = await unit(P);
      var gaps = async function () { var c = await rect(C), p = await rect(P); return { r: (c[2] - p[2]) / u, t: (p[1] - c[1]) / u }; };
      await sel(P); await keys('ArrowRight', 200); await sel(P); await keys('ArrowUp', 200);
      var g = await gaps();
      ok(h + ': As Repack, pushed right: ' + room.right + ' to the complex (' + g.r.toFixed(1) + ')', Math.abs(g.r - room.right) < 1.5);
      ok(h + ': As Repack, pushed up: ' + room.top + ' to the complex (' + g.t.toFixed(1) + ')', Math.abs(g.t - room.top) < 1.5);
      await setPad('m2-set-pad-cx', '24');
      await sel(P); await keys('Shift+ArrowLeft', 4); await sel(P); await keys('ArrowRight', 200);
      await sel(P); await keys('Shift+ArrowDown', 4); await sel(P); await keys('ArrowUp', 200);
      g = await gaps();
      ok(h + ': Complexes 24, moved away and pushed right: 24 (' + g.r.toFixed(1) + ')', Math.abs(g.r - 24) < 1.5);
      ok(h + ': Complexes 24, pushed up: 24 (' + g.t.toFixed(1) + ')', Math.abs(g.t - 24) < 1.5);
      await setPad('m2-set-pad-cx', 'repack');
    }
    var K = await drop(M[3], view[0] + 420, view[3] - 170), Q = K && await drop(M[2], view[0] + 420, view[3] - 170);
    ok(h + ': a compartment dropped and a protein in it', !!K && !!Q);
    if (K && Q) {
      await setPad('m2-set-pad-comp', '4');
      var u2 = await unit(Q);
      await sel(Q); await keys('ArrowRight', 200);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      var k = await rect(K), q = await rect(Q), gc = (k[2] - q[2]) / u2 - M[4];
      ok(h + ': Compartments 4, pushed right: 4 to the inner line (' + gc.toFixed(1) + ')', Math.abs(gc - 4) < 1.5, JSON.stringify([k, q]));
    }
    await page.close();
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
