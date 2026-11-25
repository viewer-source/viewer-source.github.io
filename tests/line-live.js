// The line being drawn behind its nodes (create.js linkPaint, core.js cutShape): on Testing Glycolysis (SBGN-ML, a
// production between two macromolecules) and Glycolysis (CellDesigner, a state transition between two proteins), two
// nodes dropped from the palette on empty space, the line's sign picked and dragged from the first: while the pointer
// is still inside the first node no line is drawn; over empty space the line (path.m2-ed-live) starts on the first
// node's outline and ends at the pointer; over the second node it stops on that node's outline. Straight across and at
// a slant (about 15 degrees). Checked on the drawn path's two ends against the nodes' boxes on screen, 2 px tolerance.
// GraphML maps have no palette, so no line is drawn there. Nothing is saved (no token). No script error.
//   node tests/line-live.js [base address] [--local]   (--local: the working tree's editor and renderers routed in)
var { chromium } = require('playwright');
var path = require('path'), fs = require('fs'), editorNow = require('./editor-now.js'), here = path.join(__dirname, '..');
var args = process.argv.slice(2), local = args.indexOf('--local') >= 0; args = args.filter(function (a) { return a !== '--local'; });
var base = args[0] || 'https://viewer-source.github.io/styles/';
var MAPS = [['glycolysis-sbgn', 'macromolecule', 'production'], ['glycolysis-celldesigner', 'cd:PROTEIN', 'cd:STATE_TRANSITION']];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {   // the working tree's editor and renderers routed in
    var ed = editorNow(here);
    await page.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await page.route(/\/renderers\/(converter|yrender|layout)\/[^/?]+\.js/, function (r) {
      var m = new URL(r.request().url()).pathname.match(/\/renderers\/(.+)$/), fp = path.join(here, 'renderers', m[1]);
      if (fs.existsSync(fp)) r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(fp, 'utf8') }); else r.continue();
    });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var rects = function () { return page.$$eval('#m2-img [data-n]', function (l) { var o = {}; l.forEach(function (g) { var r = g.getBoundingClientRect(); o[g.getAttribute('data-n')] = [r.left, r.top, r.right, r.bottom]; }); return o; }); };
  var drop = async function (sign, x, y) {
    var before = Object.keys(await rects()), s = await page.$eval('#m2-editwin button[data-make="' + sign + '"]', function (q) { var r = q.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.move(s[0], s[1]); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 6 }); await page.mouse.move(x, y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    return Object.keys(await rects()).filter(function (i) { return before.indexOf(i) < 0; })[0];
  };
  var live = function () { return page.evaluate(function () {   // the line being drawn: its two ends on screen, or null
    var q = document.querySelector('path.m2-ed-live'); if (!q) return null;
    var m = q.getScreenCTM(), L = q.getTotalLength(), a = q.getPointAtLength(0), z = q.getPointAtLength(L);
    return [[m.a * a.x + m.c * a.y + m.e, m.b * a.x + m.d * a.y + m.f], [m.a * z.x + m.c * z.y + m.e, m.b * z.x + m.d * z.y + m.f]]; }); };
  // on the box's outline: within 2 px outside it and not more than 2 px inside it
  var onRim = function (P, r) { var inX = P[0] >= r[0] - 2 && P[0] <= r[2] + 2, inY = P[1] >= r[1] - 2 && P[1] <= r[3] + 2, d = Math.min(P[0] - r[0], r[2] - P[0], P[1] - r[1], r[3] - P[1]); return inX && inY && d <= 2; };
  var f = function (P) { return P ? '[' + P[0].toFixed(1) + ',' + P[1].toFixed(1) + ']' : 'none'; };

  for (var M of MAPS) {
    var h = M[0];
    await page.goto('about:blank'); await page.goto(base + '#' + h, { waitUntil: 'load' });
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + M[1] + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(3000);
    var view = await page.$eval('#m2-view', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
    // two nodes on empty space at the lower right, first across from each other, then the second moved down for a slant
    var y0 = view[3] - 90, A = await drop(M[1], view[2] - 520, y0), B = await drop(M[1], view[2] - 180, y0);
    ok(h + ': two nodes dropped', !!A && !!B);
    if (!A || !B) continue;
    for (var slant of [false, true]) {
      if (slant) {   // B moved up by the arrow keys (selected first), about 25 degrees from A
        var rb0 = (await rects())[B];
        await page.mouse.click(rb0[0] + 4, rb0[1] + 4); await page.waitForTimeout(300);
        for (var j = 0; j < 15; j++) await page.keyboard.press('Shift+ArrowUp');
        await page.waitForTimeout(1500); await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.waitForTimeout(300);
      }
      var R = await rects(), ra = R[A], rbx = R[B], ca = [(ra[0] + ra[2]) / 2, (ra[1] + ra[3]) / 2], cb = [(rbx[0] + rbx[2]) / 2, (rbx[1] + rbx[3]) / 2], tag = h + (slant ? ', at a slant' : ', straight across');
      if (slant) { var ang = Math.atan2(ca[1] - cb[1], cb[0] - ca[0]) * 180 / Math.PI; ok(tag + ': the second node moved up, ' + ang.toFixed(0) + ' degrees', ang > 10 && ang < 40); }
      await page.click('#m2-editwin button[data-make="' + M[2] + '"]'); await page.waitForTimeout(300);
      await page.mouse.move(ca[0], ca[1]); await page.mouse.down();
      await page.mouse.move(ca[0] + (cb[0] - ca[0]) * 0.03, ca[1] + (cb[1] - ca[1]) * 0.03, { steps: 3 }); await page.waitForTimeout(150);
      var l0 = await live();
      ok(tag + ': the pointer still inside the first node, no line drawn', !l0, JSON.stringify(l0));
      var mid = [(ca[0] + cb[0]) / 2, (ca[1] + cb[1]) / 2 - 30];
      await page.mouse.move(mid[0], mid[1], { steps: 8 }); await page.waitForTimeout(150);
      var l1 = await live();
      ok(tag + ': over empty space, the line starts on the first node\'s outline', !!l1 && onRim(l1[0], ra), f(l1 && l1[0]) + ' box ' + JSON.stringify(ra));
      ok(tag + ': and ends at the pointer', !!l1 && Math.hypot(l1[1][0] - mid[0], l1[1][1] - mid[1]) < 2, f(l1 && l1[1]) + ' pointer ' + f(mid));
      await page.mouse.move(cb[0], cb[1], { steps: 8 }); await page.waitForTimeout(150);
      var l2 = await live();
      ok(tag + ': over the second node, it starts on the first node\'s outline', !!l2 && onRim(l2[0], ra), f(l2 && l2[0]) + ' box ' + JSON.stringify(ra));
      ok(tag + ': and stops on the second node\'s outline, not at its centre', !!l2 && onRim(l2[1], rbx) && Math.hypot(l2[1][0] - cb[0], l2[1][1] - cb[1]) > 10, f(l2 && l2[1]) + ' box ' + JSON.stringify(rbx));
      if (l2) {   // the line points from the first node's centre toward the second's
        var d1 = [l2[1][0] - l2[0][0], l2[1][1] - l2[0][1]], d0 = [cb[0] - ca[0], cb[1] - ca[1]], cos = (d1[0] * d0[0] + d1[1] * d0[1]) / Math.hypot(d1[0], d1[1]) / Math.hypot(d0[0], d0[1]);
        ok(tag + ': along the line between the two centres', cos > 0.995, cos.toFixed(4));
      }
      await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(800);
      await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    }
  }
  ok('no script error', !errs.length, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
