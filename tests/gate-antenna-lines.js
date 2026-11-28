// Lines drawn from and to a logic gate's antennas (create.js linkDown, linkPaint; core.js landBox), on Testing Glycolysis
// (SBGN-ML), Demerging links from logic gates ticked, its AND gate upright with port one above and port two below. With Stimulation picked: a press on the lower
// antenna, off the gate's circle, starts a line (before, only a press inside the circle did); while dragged, the live
// line starts at port two, the antenna's tip, and the antenna is drawn from the circle to it; let go on a process, a
// stimulation from the gate is made. A press on the upper antenna starts one too. With Consumption / logic arc picked, a
// line from an entity dragged over the gate ends at port one, its antenna drawn from the circle. A press beside the
// gate, well off its antennas, starts nothing. A gate just made, with no lines and no ports: a line drawn into it shows
// its antenna to the port it will get (facing the line's source), and the line made lands there. Nothing is saved (no token). No script error.
//   node tests/gate-antenna-lines.js --data=<clone of the data repository> [address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var OM = require('./lib/open-map.js'), argv = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
var url = argv[0] || 'https://viewer-source.github.io/#testing-glycolysis-sbgn', local = argv[1], base = url.split('#')[0], ref = url.split('#')[1] || '';
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
    await page.route('**/renderers/yrender/yrender.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/yrender/yrender.js'), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  await page.addInitScript(function () { try { localStorage.setItem('atlas-proposed-fanout', 'on'); } catch (e) {} });   // the gate already has its line out: a second one allowed (Settings, Demerging links from logic gates)
  await OM.open(page, base, ref);
  await page.evaluate(function () { localStorage.setItem('atlas-edit-level', 'full'); });
  await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
  if (!(await page.$('#m2-editwin:visible'))) await page.click('.m2-ri[data-win="edit"]');
  await page.waitForFunction(function () { return !!window.m2EditNow(); }, null, { timeout: 30000 }); await page.waitForTimeout(3000);
  var text = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  // the gate's box in the file and on screen give the screen place of a map point
  // (its drawn box takes in the antennas, so its centre is the gate's centre and its width the circle's)
  var G = await rect('glyph_7'), k = G[2] / 30, scr = function (x, y) { return [G[0] + G[2] / 2 + (x - 1085) * k, G[1] + G[3] / 2 + (y - 640.153) * k]; };
  var pick = async function (title) { await page.click('.m2-ed-palette button[title^="' + title + ':"]'); await page.waitForTimeout(200); };
  var live = function () { return page.$$eval('.m2-ed-live', function (l) { return l.map(function (p) { var m = /M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/.exec(p.getAttribute('d')), c = p.getScreenCTM(); return m ? [[+m[1], +m[2], +m[3], +m[4]].map(function (v, i) { return i % 2 ? c.b * +m[i] + c.d * +m[i + 1] + c.f : c.a * +m[i + 1] + c.c * +m[i + 2] + c.e; })] : null; }).filter(Boolean).map(function (q) { return q[0]; }); }); };
  var near = function (a, bb, r) { return Math.hypot(a[0] - bb[0], a[1] - bb[1]) <= (r || 3); };
  var P2 = scr(1085, 670.153), P1 = scr(1085, 610.153), C = scr(1085, 640.153);
  var arcs0 = ((await text()).match(/<arc /g) || []).length;
  var target = await rect('re_n18');   // a process
  var T = [target[0] + target[2] / 2, target[1] + target[3] / 2];

  // 1. a press on the lower antenna, off the circle
  await pick('Stimulation');
  var A = scr(1085, 664);
  await page.mouse.move(A[0], A[1]); await page.mouse.down();
  await page.mouse.move(A[0] + 20, A[1] + 20, { steps: 3 }); await page.mouse.move(T[0], T[1], { steps: 8 }); await page.waitForTimeout(200);
  var L = await live();
  ok('a press on the lower antenna starts a line', L.length > 0, JSON.stringify(L));
  ok('the live line starts at port two', L.some(function (q) { return near([q[0], q[1]], P2); }), JSON.stringify(L) + ' port ' + P2);
  ok('the antenna to port two is drawn', L.some(function (q) { return near([q[2], q[3]], P2) && Math.abs(q[1] - C[1]) < Math.abs(P2[1] - C[1]); }), JSON.stringify(L));
  await page.mouse.up(); await page.waitForTimeout(1500);
  var t1 = await text();
  ok('let go on a process: a stimulation from the gate made', (t1.match(/<arc /g) || []).length === arcs0 + 1 && /<arc class="stimulation"[^>]*source="glyph_7[^"]*"[^>]*target="re_n18"/.test(t1));
  await page.keyboard.press('Control+z'); await page.waitForTimeout(1500);

  // 2. a press on the upper antenna
  await pick('Stimulation');
  A = scr(1085, 616);
  await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 30, A[1] - 30, { steps: 5 }); await page.waitForTimeout(200);
  ok('a press on the upper antenna starts a line', (await live()).length > 0);
  await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(500);

  // 3. beside the gate, well off its antennas: nothing
  await pick('Stimulation');
  A = scr(1085 + 40, 664);
  await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 30, A[1] + 30, { steps: 5 }); await page.waitForTimeout(200);
  ok('a press well beside the gate starts nothing', (await live()).length === 0);
  await page.mouse.up(); await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  // 4. into the gate: the line ends at port one, its antenna drawn (the press of 3 moved the map: places taken again)
  G = await rect('glyph_7'); P1 = scr(1085, 610.153); C = scr(1085, 640.153);
  await pick('Consumption / logic arc');
  var S = await rect('sa_n24'); A = [S[0] + S[2] / 2, S[1] + S[3] / 2];
  await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] + 10, A[1] + 10, { steps: 3 });
  await page.mouse.move(C[0], C[1], { steps: 10 }); await page.waitForTimeout(200);
  L = await live();
  ok('a line into the gate ends at port one', L.some(function (q) { return near([q[2], q[3]], P1); }), JSON.stringify(L) + ' port ' + P1);
  ok('the antenna to port one is drawn from the circle', L.some(function (q) { return near([q[2], q[3]], P1) && Math.abs(q[1] - C[1]) < Math.abs(P1[1] - C[1]) && Math.abs(q[0] - C[0]) < 2; }), JSON.stringify(L));
  await page.keyboard.press('Escape'); await page.mouse.up();

  // 5. a gate just made, no lines yet: the port shown while a line is drawn into it is where the line lands
  await page.click('.m2-ed-palette button[data-make="or"]'); await page.waitForTimeout(200);
  var E = scr(1085 - 150, 640.153 - 120);
  await page.mouse.click(E[0], E[1]); await page.waitForTimeout(1500);
  var t5 = await text(), gid = (t5.match(/<glyph class="or" id="([^"]+)"/g) || []).map(function (m) { return /id="([^"]+)"/.exec(m)[1]; }).filter(function (i) { return !/<glyph class="or" id="/.test(i) && t5.indexOf('target="' + i) < 0 && t5.indexOf('source="' + i) < 0; }).pop();
  ok('an OR gate made with no lines', !!gid);
  if (gid) {
    var R = await rect(gid), GC = [R[0] + R[2] / 2, R[1] + R[3] / 2];
    await pick('Consumption / logic arc');
    S = await rect('sa_n24'); A = [S[0] + S[2] / 2, S[1] + S[3] / 2];
    await page.mouse.move(A[0], A[1]); await page.mouse.down(); await page.mouse.move(A[0] - 10, A[1] - 10, { steps: 3 });
    await page.mouse.move(GC[0], GC[1], { steps: 10 }); await page.waitForTimeout(200);
    L = await live();
    var mark = await page.$$eval('.m2-ed-land, [class*="land"]', function (l) { return l.map(function (x) { var r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); });
    var stick = L.filter(function (q) { return Math.hypot(q[0] - GC[0], q[1] - GC[1]) < R[2] && Math.hypot(q[2] - q[0], q[3] - q[1]) > 2; })[0];
    ok('the antenna of a bare gate is drawn while the line comes in', !!stick, JSON.stringify(L));
    await page.mouse.up(); await page.waitForTimeout(1500);
    var t6 = await text(), port = new RegExp('<port id="' + gid + '\\.1" x="([-\\d.]+)" y="([-\\d.]+)"').exec(t6);
    var R2 = R;   // the made port on screen, from the gate's centre as drawn before (bare: the circle alone; the gate stays put)
    var gl = new RegExp('<glyph class="or" id="' + gid + '">[\\s\\S]*?<bbox x="([-\\d.]+)" y="([-\\d.]+)" w="([-\\d.]+)" h="([-\\d.]+)"').exec(t6);
    var made = port && gl ? [R2[0] + R2[2] / 2 + (+port[1] - (+gl[1] + +gl[3] / 2)) * R[2] / +gl[3], R2[1] + R2[3] / 2 + (+port[2] - (+gl[2] + +gl[4] / 2)) * R[3] / +gl[4]] : null;
    ok('the line made lands at the port shown', !!(made && stick && near([stick[2], stick[3]], made, 4)), JSON.stringify([made, stick]));
  }
  ok('no script error', !errs.length, errs.join(' | '));
  console.log(bad ? bad + ' WRONG' : 'all ok');
  await b.close(); process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(2); });
