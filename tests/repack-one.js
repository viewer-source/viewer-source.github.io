// Repack complex on the live page (by default the styles page), on Glycolysis (GraphML and CellDesigner): a right click inside a
// complex on empty space offers Repack complex and none of the whole map's tools (grid, Repack all complexes); on a member, Repack complex in its own menu;
// on empty map space outside every complex, no Repack complex. Chosen after a member is moved out of place, only that
// complex's members move back. On an SBGN-ML map, a state variable added to a member has its own menu, without Repack complex.
// Nothing is saved (no token). No script error.
//   node tests/repack-one.js [base address]
var { chromium } = require('playwright');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var menu = async function (P) { await page.keyboard.press('Escape'); await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(300); return page.$$eval('.m2-cx button', function (l) { return l.map(function (x) { return x.textContent; }); }); };
  for (var h of ['glycolysis-graphml', 'glycolysis-celldesigner']) {
    await page.goto(base + '#' + h, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
    await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(4000);
    // a complex on screen: a [data-n] holding others; a point inside it on no member, and a member's centre
    var spot = await page.evaluate(function () {
      var all = Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-n]')), rs = all.map(function (g) { return [g, g.getBoundingClientRect()]; });
      var inside = function (a, c) { return a.left >= c.left - 0.5 && a.top >= c.top - 0.5 && a.right <= c.right + 0.5 && a.bottom <= c.bottom + 0.5; };
      for (var i = 0; i < rs.length; i++) {
        var c = rs[i][1], kids = rs.filter(function (q, j) { return j !== i && inside(q[1], c) && q[1].width < c.width; });
        if (!kids.length || c.width < 30 || c.width > 600) continue;
        for (var y = c.top + 3; y < c.bottom - 3; y += 2) for (var x = c.left + 3; x < c.right - 3; x += 2) {
          if (kids.some(function (q) { var r = q[1]; return x > r.left - 3 && x < r.right + 3 && y > r.top - 3 && y < r.bottom + 3; })) continue;
          var k = kids[0][1];
          return { id: rs[i][0].getAttribute('data-n'), empty: [x, y], member: [k.left + k.width / 2, k.top + k.height / 2], mid: kids[0][0].getAttribute('data-n') };
        }
      }
      return null;
    });
    ok(h + ': a complex found on screen', !!spot, JSON.stringify(spot));
    if (!spot) continue;
    var l1 = await menu(spot.empty);
    ok(h + ': inside a complex, Repack complex and none of the whole map\'s tools', l1.indexOf('Repack complex') >= 0 && !l1.some(function (t) { return /^(Snap map to grid|Repack all complexes|Show grid|Snap to grid|Remove all bend points|Resize canvas)/.test(t); }), JSON.stringify(l1));
    var l2 = await menu(spot.member);
    ok(h + ': on a member, Repack complex in its menu', l2.indexOf('Repack complex') >= 0 && l2.indexOf('Repack all complexes') < 0, JSON.stringify(l2));
    var out = await page.evaluate(function () {
      var r = document.querySelector('#m2-view, .m2-view') ? (document.querySelector('#m2-view') || document.querySelector('.m2-view')).getBoundingClientRect() : document.getElementById('m2-img').getBoundingClientRect();
      for (var y = r.top + 20; y < r.bottom - 20; y += 13) for (var x = r.left + 20; x < r.right - 20; x += 13) { var e = document.elementFromPoint(x, y); if (e && !e.closest('[data-n],[data-e]') && e.closest('#m2-img, #m2-view, .m2-view')) return [x, y]; }
      return null;
    });
    var l3 = out ? await menu(out) : [];
    ok(h + ': outside every complex, no Repack complex', l3.indexOf('Repack all complexes') >= 0 && l3.indexOf('Repack complex') < 0, JSON.stringify(l3));
    await page.keyboard.press('Escape');
    // move a member a little inside its complex, then repack the complex from its empty space: the text changes
    var t0 = await page.evaluate(function () { return window.m2EditNow().text; });
    await page.mouse.click(spot.member[0], spot.member[1]); await page.mouse.move(spot.member[0], spot.member[1]); await page.mouse.down();
    await page.mouse.move(spot.member[0] + 4, spot.member[1] + 3, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(1200);
    var t1 = await page.evaluate(function () { return window.m2EditNow().text; });
    await page.keyboard.press('Escape');
    var l4 = await menu(spot.empty);
    if (l4.indexOf('Repack complex') >= 0) { await page.click('.m2-cx button:text-is("Repack complex")'); await page.waitForTimeout(3000); }
    var t2 = await page.evaluate(function () { return window.m2EditNow().text; });
    ok(h + ': moved, then chosen, the complex repacked', t1 !== t0 && t2 !== t1, JSON.stringify([t1 !== t0, t2 !== t1]));
  }
  // SBGN-ML: a state variable on a complex member, its own menu only
  await page.goto(base + '#glycolysis-sbgn', { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(4000);
  var mem = await page.evaluate(function () {
    var rs = Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-n]')).map(function (g) { return g.getBoundingClientRect(); });
    var inside = function (a, c) { return a.left >= c.left - 0.5 && a.top >= c.top - 0.5 && a.right <= c.right + 0.5 && a.bottom <= c.bottom + 0.5; };
    for (var i = 0; i < rs.length; i++) for (var j = 0; j < rs.length; j++) if (i !== j && rs[j].width < rs[i].width && inside(rs[j], rs[i])) { var k = rs[j]; return [k.left, k.top, k.width, k.height]; }
    return null;
  });
  var svOk = false, svMenu = null;
  if (mem) {
    var lm = await menu([mem[0] + mem[2] / 2, mem[1] + mem[3] / 2]);
    if (lm.indexOf('Add state variable') >= 0) {
      await page.click('.m2-cx button:text-is("Add state variable")'); await page.waitForTimeout(1500); await page.keyboard.press('Escape');
      for (var y = mem[1] - 8; y <= mem[1] + mem[3] + 8 && !svMenu; y += 2) for (var x = mem[0] - 8; x <= mem[0] + mem[2] + 8 && !svMenu; x += 3) {
        if (y > mem[1] + 6 && y < mem[1] + mem[3] - 6 && x > mem[0] + 6 && x < mem[0] + mem[2] - 6) continue;   // the border only
        var l = await menu([x, y]);
        if (l.length && l.indexOf('Select all of this kind') < 0 && l.indexOf('Delete') >= 0 && l.indexOf('Snap map to grid') < 0) svMenu = l;
      }
      svOk = !!svMenu && svMenu.indexOf('Repack complex') < 0 && svMenu.indexOf('Name by members') < 0;
    }
  }
  ok('glycolysis-sbgn: a state variable on a member, its own menu without complex items', svOk, JSON.stringify([mem, svMenu]));
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close(); process.exit(bad ? 1 : 0);
})();
