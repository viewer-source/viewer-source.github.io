// A process's square, its antennas and the space between them are one target (core.js landBox, takerAt; create.js
// linkEnd), on Testing Glycolysis SBGN-ML: two macromolecules dropped, a production drawn between them (its process
// made). The consumption's end at the input port, pressed and dragged: over the square, the antenna's middle and the
// port's tip, one blue square at the port; far off, none; released on the antenna, the file unchanged. A new
// consumption drawn from a third macromolecule over the input antenna's middle: the blue square at the port, and
// released, its arc ends on that port. A stimulation drawn over the antenna's middle: the blue square on a side
// middle, as over the square. Nothing is saved (no token). No script error.
//   node tests/antenna-landing.js --data=<clone of the data repository> [address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright');
var OM = require('./lib/open-map.js'), argv = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
var url = argv[0] || 'https://viewer-source.github.io/#testing-glycolysis-sbgn', local = argv[1], base = url.split('#')[0], ref = url.split('#')[1] || '';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var rects = function () { return page.$$eval('#m2-img [data-n]', function (l) { var o = {}; l.forEach(function (g) { var r = g.getBoundingClientRect(); o[g.getAttribute('data-n')] = [r.left, r.top, r.right, r.bottom]; }); return o; }); };
  var blue = function () { return page.$$eval('.m2-ed-port', function (l) { return l.map(function (x) { var r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); }); };
  var drop = async function (sign, x, y) {
    var before = Object.keys(await rects()), s = await page.$eval('#m2-editwin button[data-make="' + sign + '"]', function (q) { var r = q.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.move(s[0], s[1]); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 6 }); await page.mouse.move(x, y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    return Object.keys(await rects()).filter(function (i) { return before.indexOf(i) < 0; })[0];
  };
  var bbox = function (t, id) { var g = new RegExp('<glyph [^>]*id="' + id + '"[\\s\\S]*?<bbox x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"').exec(t); return g && g.slice(1).map(Number); };
  var near = function (P, Q, d) { return !!P && !!Q && Math.hypot(P[0] - Q[0], P[1] - Q[1]) < (d || 3); };
  await OM.open(page, base, ref);
  await page.evaluate(function () { localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 }); await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="macromolecule"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(3000);
  var view = await page.$eval('#m2-view', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  var y0 = view[3] - 90, A = await drop('macromolecule', view[2] - 560, y0), B = await drop('macromolecule', view[2] - 160, y0);
  var C = await drop('macromolecule', view[2] - 400, y0 - 160);
  ok('three macromolecules dropped', !!A && !!B && !!C);
  var R = await rects(), ra = R[A], rb = R[B], ca = [(ra[0] + ra[2]) / 2, (ra[1] + ra[3]) / 2], cb = [(rb[0] + rb[2]) / 2, (rb[1] + rb[3]) / 2], rc = R[C], cc = [(rc[0] + rc[2]) / 2, (rc[1] + rc[3]) / 2];
  var before = Object.keys(R);
  await page.click('#m2-editwin button[data-make="production"]'); await page.waitForTimeout(300);
  await page.mouse.move(ca[0], ca[1]); await page.mouse.down(); await page.mouse.move((ca[0] + cb[0]) / 2, ca[1] - 30, { steps: 8 });
  await page.mouse.move(cb[0] + 5, cb[1] + 3, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1800);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  R = await rects();
  var P = Object.keys(R).filter(function (i) { return before.indexOf(i) < 0; })[0];
  ok('a process made between the first two', !!P);
  var rp0 = R[P];   // zoomed in round the process, so its antennas are long enough to aim at
  await page.mouse.move((rp0[0] + rp0[2]) / 2, (rp0[1] + rp0[3]) / 2); await page.keyboard.down('Control');
  for (var w = 0; w < 4; w++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(200); }
  await page.keyboard.up('Control'); await page.waitForTimeout(800);
  R = await rects(); ra = R[A]; rc = R[C]; ca = [(ra[0] + ra[2]) / 2, (ra[1] + ra[3]) / 2]; cc = [(rc[0] + rc[2]) / 2, (rc[1] + rc[3]) / 2];
  var t = await now(), bA = bbox(t, A), bP = bbox(t, P), k = (ra[2] - ra[0]) / bA[2];
  var scr = function (X, Y) { return [ra[0] + (X - bA[0]) * k, ra[1] + (Y - bA[1]) * k]; };
  var g = new RegExp('<glyph [^>]*id="' + P + '"[\\s\\S]*?</glyph>').exec(t)[0], ports = [], m, re = /<port [^>]*id="([^"]*)"[^>]*x="([^"]*)" y="([^"]*)"/g;
  while ((m = re.exec(g))) ports.push({ id: m[1], at: scr(+m[2], +m[3]) });
  var sq = scr(bP[0] + bP[2] / 2, bP[1] + bP[3] / 2), pin = ports.sort(function (u, v) { return Math.hypot(u.at[0] - ca[0], u.at[1] - ca[1]) - Math.hypot(v.at[0] - ca[0], v.at[1] - ca[1]); })[0];
  ok('the process has its two ports', ports.length === 2, JSON.stringify(ports));
  var edgeX = sq[0] + Math.sign(pin.at[0] - sq[0]) * bP[2] / 2 * k, mid = [(edgeX + pin.at[0]) / 2, pin.at[1]];   // the input antenna's middle, between the square and the port's tip
  // 1. the consumption's end at the input port dragged
  var arcRe = new RegExp('<arc [^>]*class="consumption"[^>]*target="' + pin.id + '"'), arc = (t.match(/<arc [^>]*>/g) || []).filter(function (a) { return arcRe.test(a); })[0];
  ok('the consumption ends on the input port', !!arc, pin.id);
  var aid = arc && /id="([^"]*)"/.exec(arc)[1];
  var along = await page.evaluate(function (id) {
    var q = Array.from(document.querySelectorAll('#m2-img [data-e="' + id + '"], #m2-img [data-e="' + id + '"] *')).filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0];
    var p = q.getPointAtLength(q.getTotalLength() * 0.3), M = q.getScreenCTM(); return [M.a * p.x + M.c * p.y + M.e, M.b * p.x + M.d * p.y + M.f]; }, aid);
  await page.mouse.click(along[0], along[1]); await page.waitForTimeout(600);
  var t0 = await now();
  await page.mouse.move(pin.at[0], pin.at[1]); await page.mouse.down();
  await page.mouse.move(pin.at[0] - 40, pin.at[1] - 60, { steps: 6 }); await page.waitForTimeout(150);
  var off = await blue();
  ok('dragged far off: no blue square', off.length === 0, JSON.stringify(off));
  var spots = [['the square', sq], ['the antenna\'s middle', mid], ['the port\'s tip', [pin.at[0] - 2, pin.at[1] + 2]]];
  for (var j = 0; j < spots.length; j++) {
    await page.mouse.move(spots[j][1][0], spots[j][1][1], { steps: 6 }); await page.waitForTimeout(150);
    var bl = await blue();
    ok('dragged over ' + spots[j][0] + ': one blue square at the port', bl.length === 1 && near(bl[0], pin.at), JSON.stringify([bl, pin.at]));
  }
  await page.mouse.move(mid[0], mid[1], { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(1200);
  ok('released on the antenna: the file unchanged', (await now()) === t0);
  await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.waitForTimeout(300);
  // 2. a new consumption drawn from the third macromolecule over the input antenna's middle
  await page.click('#m2-editwin button[data-make="consumption"]'); await page.waitForTimeout(300);
  await page.mouse.move(cc[0], cc[1]); await page.mouse.down(); await page.mouse.move(cc[0] + 40, cc[1] + 60, { steps: 8 });
  await page.mouse.move(mid[0], mid[1] - 2, { steps: 8 }); await page.waitForTimeout(200);
  var bn = await blue();
  ok('a new consumption over the antenna\'s middle: the blue square at the port', bn.length === 1 && near(bn[0], pin.at), JSON.stringify([bn, pin.at]));
  await page.mouse.up(); await page.waitForTimeout(1800); await page.keyboard.press('Escape');
  var t2 = await now(), made = (t2.match(/<arc [^>]*>/g) || []).filter(function (a) { return /class="consumption"/.test(a) && new RegExp('source="' + C + '"').test(a); })[0];
  ok('released: the new consumption ends on the input port', !!made && new RegExp('target="' + pin.id + '"').test(made), made);
  // 3. a stimulation drawn over the antenna's middle: a side middle, as over the square
  await page.click('#m2-editwin button[data-make="stimulation"]'); await page.waitForTimeout(300);
  await page.mouse.move(cc[0], cc[1] + 4); await page.mouse.down(); await page.mouse.move(cc[0] + 60, cc[1] + 40, { steps: 8 });
  await page.mouse.move(mid[0], mid[1] + 2, { steps: 8 }); await page.waitForTimeout(200);
  var bs = await blue(), hh = bP[3] / 2 * k;
  ok('a stimulation over the antenna\'s middle: the blue square on the middle of a side off the antennas', bs.length === 1 && Math.abs(bs[0][0] - sq[0]) < 2 && Math.abs(Math.abs(bs[0][1] - sq[1]) - hh) < 3, JSON.stringify([bs, sq, hh]));
  await page.mouse.up(); await page.waitForTimeout(1500);
  ok('no script error', !errs.length, errs.join(' / '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
