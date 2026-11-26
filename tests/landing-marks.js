// Where a line being drawn will land, on Testing Glycolysis SBGN-ML (create.js linkLand, landMarks): two
// macromolecules dropped from the palette, a production dragged from the first over the second: the blue square
// (.m2-ed-port) at the second's centre, no grey fill over it (.m2-ed-dark gone from the editor); released, the
// production and its process made; a stimulation dragged from the first over that process: the square on the middle of
// one of the process's sides, inside its box's reach. Nothing is saved (no token). No script error.
//   node tests/landing-marks.js --data=<clone of the data repository> [address] [viewer folder: its editor served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var OM = require('./lib/open-map.js'), argv = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });   // --data=... is no address or folder
var url = argv[0] || 'https://viewer-source.github.io/styles/#testing-glycolysis-sbgn', local = argv[1], base = url.split('#')[0], ref = url.split('#')[1] || '';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var rects = function () { return page.$$eval('#m2-img [data-n]', function (l) { var o = {}; l.forEach(function (g) { var r = g.getBoundingClientRect(); o[g.getAttribute('data-n')] = [r.left, r.top, r.right, r.bottom]; }); return o; }); };
  var marks = function () { return page.evaluate(function () {
    var c = function (x) { var r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    return { port: Array.from(document.querySelectorAll('.m2-ed-port')).map(c), dark: document.querySelectorAll('.m2-ed-dark').length }; }); };
  var drop = async function (sign, x, y) {
    var before = Object.keys(await rects()), s = await page.$eval('#m2-editwin button[data-make="' + sign + '"]', function (q) { var r = q.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await page.mouse.move(s[0], s[1]); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 6 }); await page.mouse.move(x, y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    return Object.keys(await rects()).filter(function (i) { return before.indexOf(i) < 0; })[0];
  };
  await OM.open(page, base, ref);
  await page.evaluate(function () { localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 }); await page.click('.m2-ri[data-win="edit"]');
  await page.waitForSelector('#m2-editwin button[data-make="macromolecule"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(3000);
  var view = await page.$eval('#m2-view', function (e) { var r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  var y0 = view[3] - 90, A = await drop('macromolecule', view[2] - 560, y0), B = await drop('macromolecule', view[2] - 160, y0);
  ok('two macromolecules dropped', !!A && !!B);
  var R = await rects(), ra = R[A], rb = R[B], ca = [(ra[0] + ra[2]) / 2, (ra[1] + ra[3]) / 2], cb = [(rb[0] + rb[2]) / 2, (rb[1] + rb[3]) / 2];
  var before = Object.keys(R);
  await page.click('#m2-editwin button[data-make="production"]'); await page.waitForTimeout(300);
  await page.mouse.move(ca[0], ca[1]); await page.mouse.down(); await page.mouse.move((ca[0] + cb[0]) / 2, ca[1] - 30, { steps: 8 });
  await page.mouse.move(cb[0] + 5, cb[1] + 3, { steps: 8 }); await page.waitForTimeout(200);
  var m = await marks();
  ok('over the second: one blue square at its centre', m.port.length === 1 && Math.hypot(m.port[0][0] - cb[0], m.port[0][1] - cb[1]) < 2, JSON.stringify([m.port, cb]));
  ok('no grey fill over it', m.dark === 0, m.dark);
  await page.mouse.up(); await page.waitForTimeout(1800); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  R = await rects();
  var P = Object.keys(R).filter(function (i) { return before.indexOf(i) < 0; })[0], rp = P && R[P];
  ok('released: a process made between them', !!rp, JSON.stringify(Object.keys(R).length));
  if (rp) {
    var cp = [(rp[0] + rp[2]) / 2, (rp[1] + rp[3]) / 2], hw = (rp[2] - rp[0]) / 2, hh = (rp[3] - rp[1]) / 2;
    await page.click('#m2-editwin button[data-make="stimulation"]'); await page.waitForTimeout(300);
    await page.mouse.move(ca[0], ca[1] + 4); await page.mouse.down(); await page.mouse.move(ca[0] + 60, ca[1] - 80, { steps: 8 });
    await page.mouse.move(cp[0], cp[1], { steps: 8 }); await page.waitForTimeout(200);
    m = await marks();
    var q = m.port[0], side = q && ((Math.abs(q[0] - cp[0]) < 1.5 && Math.abs(Math.abs(q[1] - cp[1]) - hh) < 3) || (Math.abs(q[1] - cp[1]) < 1.5 && Math.abs(Math.abs(q[0] - cp[0]) - hw) < 3));
    ok('a stimulation over the process: the square on the middle of one of its sides', m.port.length === 1 && side, JSON.stringify([m.port, cp, hw, hh]));
    ok('no grey fill over the process', m.dark === 0, m.dark);
    await page.mouse.up(); await page.waitForTimeout(1800);
    var t = await page.evaluate(function () { return window.m2EditNow().text; });
    var g = new RegExp('<glyph [^>]*id="' + P + '"[\\s\\S]*?<bbox x="([^"]*)" y="([^"]*)" w="([^"]*)" h="([^"]*)"').exec(t);
    var arcs = t.match(/<arc [^>]*class="stimulation"[\s\S]*?<\/arc>/g) || [], arc = arcs[arcs.length - 1], e = arc && /<end x="([^"]*)" y="([^"]*)"/.exec(arc);
    if (g && e && q) {
      var ga = new RegExp('<glyph [^>]*id="' + A + '"[\\s\\S]*?<bbox x="([^"]*)" y="([^"]*)" w="([^"]*)"').exec(t);   // the scale from a macromolecule (a process's drawing holds its antennas)
      var bx = g.slice(1).map(Number), k = (ra[2] - ra[0]) / +ga[3], want = [cp[0] + (+e[1] - bx[0] - bx[2] / 2) * k, cp[1] + (+e[2] - bx[1] - bx[3] / 2) * k];
      ok('released: the stimulation ends where the square was', Math.hypot(want[0] - q[0], want[1] - q[1]) < 3, JSON.stringify([want, q]));
    } else ok('released: a stimulation made at the process', false, JSON.stringify([!!g, !!e, !!q]));
  }
  ok('no script error', !errs.length, errs.join(' / '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok');
  process.exit(bad ? 1 : 0);
})();
