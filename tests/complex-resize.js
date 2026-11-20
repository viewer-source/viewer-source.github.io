// Resizing a complex and a complex's member by their handles on the live page (by default the styles page), on Glycolysis
// SBGN-ML and CellDesigner: a complex with members selected, its bottom right handle dragged in, never grows; dragged out it grows, its members
// staying where they are; dragged far in, it stops where its members still fit; a member's handle dragged out grows the
// member and its complex round it; Repack complex then keeps the member's new size and packs the complex round it
// again; undo takes each back. Boxes read from the selection's handles. Each map opened
// on a page of its own (about:blank first: a hash change keeps the old map's state). Nothing is saved (no token). No
// script error.
//   node tests/complex-resize.js [base address] [viewer folder: its editor and edit renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {   // the editor as Jekyll builds it (editor.js with its sources put in), from a working tree
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*_edit.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more ? '  ' + more : '')); };
  var handles = function () {   // the selection's handles: their extent (the box 3.3 units out) and the bottom right one's centre
    return page.$$eval('.m2-ed-handle', function (l) {
      if (!l.length) return null;
      var rs = l.map(function (h) { var r = h.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      var x0 = Math.min.apply(null, rs.map(function (q) { return q[0]; })), y0 = Math.min.apply(null, rs.map(function (q) { return q[1]; }));
      var x1 = Math.max.apply(null, rs.map(function (q) { return q[0]; })), y1 = Math.max.apply(null, rs.map(function (q) { return q[1]; }));
      return { box: [x0, y0, x1, y1], rb: [x1, y1] };
    });
  };
  var drag = async function (P, dx, dy) { await page.mouse.move(P[0], P[1]); await page.mouse.down(); await page.mouse.move(P[0] + dx, P[1] + dy, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(2500); };
  var select = async function (P) { await page.keyboard.press('Escape'); await page.mouse.click(P[0], P[1]); await page.waitForTimeout(400); return handles(); };
  var memberBox = function (id) { return page.evaluate(function (id) { var g = document.querySelector('#m2-img [data-n="' + id + '"]'); if (!g) return null; var r = g.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }, id); };
  var near = function (a, c, t) { return !!a && !!c && a.every(function (v, j) { return Math.abs(v - c[j]) <= (t || 1.5); }); };
  for (var h of ['glycolysis-sbgn', 'glycolysis-celldesigner']) {
    await page.goto('about:blank'); await page.goto(base + '#' + h, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    await page.waitForTimeout(2500); if (!(await page.$('#m2-editwin:visible'))) await page.click('.m2-ri[data-win="edit"]'); await page.waitForTimeout(5000);   // edit mode kept over a reload: not toggled off
    var spot = await page.evaluate(function () {   // a complex on screen, a point inside it on no member, one member
      var all = Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-n]')), rs = all.map(function (g) { return [g, g.getBoundingClientRect()]; });
      var inside = function (a, c) { return a.left >= c.left - 0.5 && a.top >= c.top - 0.5 && a.right <= c.right + 0.5 && a.bottom <= c.bottom + 0.5; };
      for (var i = 0; i < rs.length; i++) {
        var c = rs[i][1], kids = rs.filter(function (q, j) { return j !== i && inside(q[1], c) && q[1].width < c.width; });
        if (!kids.length || c.width < 30 || c.width > 500 || c.right > innerWidth - 150 || c.bottom > innerHeight - 150) continue;
        for (var y = c.top + 3; y < c.bottom - 3; y += 2) for (var x = c.left + 3; x < c.right - 3; x += 2) {
          if (kids.some(function (q) { var r = q[1]; return x > r.left - 3 && x < r.right + 3 && y > r.top - 3 && y < r.bottom + 3; })) continue;
          var k = kids[0][1];
          return { empty: [x, y], member: [k.left + k.width / 2, k.top + k.height / 2], mid: kids[0][0].getAttribute('data-n') };
        }
      }
      return null;
    });
    ok(h + ': a complex found on screen', !!spot, JSON.stringify(spot));
    if (!spot) continue;
    var s0 = await select(spot.empty), m0 = await memberBox(spot.mid);
    ok(h + ': the complex selected, its handles shown', !!s0);
    if (!s0) continue;
    await drag(s0.rb, -600, -600);   // straight in from the file's box: held round its members, never past where it started
    var sIn = await select(spot.empty), mIn = await memberBox(spot.mid);
    ok(h + ': dragged in from the file\'s box, never larger, its members inside', !!sIn && sIn.box.every(function (v, j) { return j < 2 ? v >= s0.box[j] - 0.5 : v <= s0.box[j] + 0.5; }) && sIn.box[2] >= mIn[2] && sIn.box[3] >= mIn[3], JSON.stringify([s0.box, sIn && sIn.box, mIn]));
    await page.keyboard.press('Escape'); await page.keyboard.press('Control+z'); await page.waitForTimeout(2000);
    s0 = await select(spot.empty);
    await drag(s0.rb, 48, 40);
    var s1 = await select(spot.empty), m1 = await memberBox(spot.mid);
    ok(h + ': its bottom right handle dragged out, the complex larger', !!s1 && s1.box[2] > s0.box[2] + 20 && s1.box[3] > s0.box[3] + 20 && near(s1.box.slice(0, 2), s0.box.slice(0, 2)), JSON.stringify([s0 && s0.box, s1 && s1.box]));
    ok(h + ': its members where they were', near(m0, m1), JSON.stringify([m0, m1]));
    await drag(s1.rb, -600, -600);
    var s2 = await select(spot.empty), m2 = await memberBox(spot.mid);
    ok(h + ': dragged far in, held round its members', !!s2 && s2.box[2] >= m2[2] && s2.box[3] >= m2[3] && s2.box[2] < s1.box[2] && s2.box[3] < s1.box[3] && near(s2.box.slice(0, 2), s0.box.slice(0, 2)), JSON.stringify([s0.box, s2 && s2.box, m2]));
    ok(h + ': its members still where they were', near(m0, m2), JSON.stringify([m0, m2]));
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z'); await page.waitForTimeout(2000);
    await page.keyboard.press('Control+z'); await page.waitForTimeout(2000);
    var s3 = await select(spot.empty);
    ok(h + ': two undos, the complex as it was', !!s3 && near(s3.box, s0.box), JSON.stringify([s0.box, s3 && s3.box]));
    // a member: its handle dragged out grows it, the complex round it
    var k0 = await select(spot.member);
    ok(h + ': a member selected, its handles shown', !!k0);
    if (!k0) continue;
    var c0 = s3 || s0;
    await drag(k0.rb, 40, 32);
    var k1 = await select(spot.member), c1 = await select(spot.empty);
    ok(h + ': the member larger', !!k1 && k1.box[2] - k1.box[0] > k0.box[2] - k0.box[0] + 15 && k1.box[3] - k1.box[1] > k0.box[3] - k0.box[1] + 10, JSON.stringify([k0.box, k1 && k1.box]));
    ok(h + ': the complex grown round it', !!c1 && !!k1 && c1.box[2] >= k1.box[2] && c1.box[3] >= k1.box[3] && (c1.box[2] > c0.box[2] + 1 || c1.box[3] > c0.box[3] + 1), JSON.stringify([c0.box, c1 && c1.box, k1 && k1.box]));
    // Repack complex (its right-click menu, inside it on empty space): the member's size kept, the complex fitted round it
    await page.keyboard.press('Escape'); await page.mouse.click(spot.empty[0], spot.empty[1], { button: 'right' }); await page.waitForTimeout(400);
    var rp = await page.$('.m2-cx button:text-is("Repack complex")');
    ok(h + ': Repack complex offered', !!rp);
    if (rp) { await rp.click(); await page.waitForTimeout(2500); }
    var kr = await select(spot.member), cr = await select(spot.empty), wd = function (q) { return [q.box[2] - q.box[0], q.box[3] - q.box[1]]; };
    ok(h + ': repacked, the member keeps its new size', !!kr && near(wd(kr), wd(k1)), JSON.stringify([k1 && wd(k1), kr && wd(kr)]));
    ok(h + ': repacked, the complex round its members', !!cr && !!kr && cr.box[0] <= kr.box[0] && cr.box[1] <= kr.box[1] && cr.box[2] >= kr.box[2] && cr.box[3] >= kr.box[3], JSON.stringify([c1 && c1.box, cr && cr.box, kr && kr.box]));
    await page.keyboard.press('Escape');
    if (rp) { await page.keyboard.press('Control+z'); await page.waitForTimeout(2000); }
    await page.keyboard.press('Control+z'); await page.waitForTimeout(2000);
    var k2 = await select(spot.member);
    ok(h + ': undo, the member as it was', !!k2 && near(k2.box, k0.box), JSON.stringify([k0.box, k2 && k2.box]));
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
