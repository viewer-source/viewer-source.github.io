// A modifier's end at a process (core.js hubSides, sixPlaces; create.js atHub): on the root page, PKA-C's catalysis
// on its process (Glycolysis SBGN-ML) and a catalysis at a process of a GraphML map added from the test set (acly). While
// the end is dragged over its process: six landing squares (the middles of the two sides off the antennas and the four
// corners), one blue; dropped on each, Properties shows that place as Target port X and Y, and on the SBGN-ML map a
// corner is written as the arc's end. Turn process turns the end with it and the six places with the antennas. Target
// port X and Y typed are kept as typed, undone and redone by the keys. A production's end at the process stays locked,
// its row saying why. Nothing is saved (no token). No script error.
//   node tests/modifier-ends.js --data=<clone of the data repository> [base address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var OM = require('./lib/open-map.js'), argv = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
var base = argv[0] || 'https://viewer-source.github.io/', local = argv[1];
var dataDir = (process.argv.filter(function (a) { return /^--data=/.test(a); })[0] || '').slice(7);
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  if (local) {
    var ed = require('./editor-now.js')(local);
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/yrender/yrender.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/yrender/yrender.js'), 'utf8') }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(function () { localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); });
  var now = function () { return page.evaluate(function () { return window.m2EditNow().text; }); };
  var lineAt = function (id, f) { return page.evaluate(function (a) {
    var all = []; document.querySelectorAll('#m2-img [data-e="' + a[0] + '"]').forEach(function (g) { all.push(g); g.querySelectorAll('*').forEach(function (c) { all.push(c); }); });
    var q = all.filter(function (x) { return x.getTotalLength; }).sort(function (u, v) { return v.getTotalLength() - u.getTotalLength(); })[0], pt = q.getPointAtLength(q.getTotalLength() * a[1]), m = q.getScreenCTM();
    return [m.a * pt.x + m.c * pt.y + m.e, m.b * pt.x + m.d * pt.y + m.f]; }, [id, f]); };
  var fields = function () { return page.evaluate(function () { var o = {}; ['sx', 'sy', 'tx', 'ty'].forEach(function (k) { var f = document.getElementById('m2-ed-' + k); o[k] = parseFloat(f.value); o[k + 'Off'] = f.disabled; o[k + 'Tip'] = f.closest('tr').title; }); return o; }); };
  var squares = function (cls) { return page.$$eval(cls, function (l) { return l.map(function (x) { var r = x.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); }); };
  var near = function (L, P) { return L.slice().sort(function (u, v) { return Math.hypot(u[0] - P[0], u[1] - P[1]) - Math.hypot(v[0] - P[0], v[1] - P[1]); })[0]; };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); };
  var pick = async function (arc, f) { await page.keyboard.press('Escape'); await page.mouse.click(10, 880); await page.mouse.click.apply(page.mouse, await lineAt(arc, f || 0.6)); await page.waitForTimeout(600); };
  var key = async function (redo) { await page.mouse.click(10, 880); await page.keyboard.press(redo ? 'Control+Shift+KeyZ' : 'Control+KeyZ'); await page.waitForTimeout(1200); };
  var type = async function (k, v) { await page.fill('#m2-ed-' + k, v); await page.press('#m2-ed-' + k, 'Enter'); await page.waitForTimeout(1200); };
  var box = function (id) { return page.evaluate(function (id) {   // the process's box in the file: SBGN-ML bbox or yEd geometry
    var t = window.m2EditNow().text, d = new DOMParser().parseFromString(t, 'text/xml'), g = null;
    Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'glyph'), function (x) { if (x.getAttribute('id') === id) g = x.getElementsByTagNameNS('*', 'bbox')[0]; });
    Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'node'), function (x) { if (!g && x.getAttribute('id') === id) g = x.getElementsByTagNameNS('*', 'Geometry')[0]; });
    return g ? ['x', 'y', 'w', 'h'].map(function (a) { return parseFloat(g.getAttribute(a) || g.getAttribute({ w: 'width', h: 'height' }[a])); }) : null; }, id); };
  var key2 = function (o) { return Math.round(o[0] * 10) / 10 + ',' + Math.round(o[1] * 10) / 10; };
  var sixOf = function (B, vertical) {   // the six places (offsets from the centre) for antennas running upright or level
    var w = B[2] / 2, h = B[3] / 2, s = vertical ? [[-w, 0], [w, 0]] : [[0, -h], [0, h]];
    return s.concat([[-w, -h], [w, -h], [-w, h], [w, h]]).map(key2).sort();
  };
  // the end dragged from its square (the one nearest the process) to P; the landing squares seen just before the drop
  var dragEnd = async function (arc, proc, P, look) {
    await pick(arc);
    var c = await rect(proc), E = near(await squares('.m2-ed-bend'), c), seen = null;
    await page.mouse.move(E[0], E[1]); await page.mouse.down();
    await page.mouse.move(c[0] + 40, c[1] - 30, { steps: 6 }); await page.mouse.move(c[0] + 3, c[1] - 2, { steps: 6 }); await page.waitForTimeout(150);
    if (look) seen = { place: await squares('.m2-ed-place'), port: await squares('.m2-ed-port') };
    await page.mouse.move(P[0], P[1], { steps: 6 }); await page.waitForTimeout(150);
    var blue = await squares('.m2-ed-port');
    await page.mouse.up(); await page.waitForTimeout(1500);
    return { seen: seen, blue: blue };
  };
  var zoomIn = async function (proc) {
    var c = await rect(proc);
    await page.mouse.move(c[0], c[1]); await page.keyboard.down('Control');
    for (var i = 0; i < 8; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(200); }
    await page.keyboard.up('Control'); await page.waitForTimeout(800);
  };
  var enterEdit = async function () {
    await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 60000 });
    if (!(await page.evaluate(function () { return !!window.m2EditNow(); }))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForFunction(function () { return !!window.m2EditNow() && document.querySelectorAll('#m2-img [data-e]').length > 0; }, null, { timeout: 30000 }); await page.waitForTimeout(2500);
  };

  var yEnd = function (arc) { return page.evaluate(function (id) {   // a GraphML edge's target port as its file holds it
    var t = window.m2EditNow().text, m = new RegExp('<edge [^>]*id="' + id + '"[\\s\\S]*?<y:Path ([^>]*)>').exec(t), a = m ? m[1] : '';
    var g = function (k) { var q = new RegExp('\\b' + k + '="([^"]*)"').exec(a); return q ? parseFloat(q[1]) : 0; };
    return { tx: g('tx'), ty: g('ty') }; }, arc); };
  async function run(tag, arc, proc, flux, sbgnml) {
    var where = async function () { if (sbgnml) { await pick(arc); return fields(); } return yEnd(arc); };
    await zoomIn(proc);
    var B = await box(proc);
    ok(tag + ': the process found', !!B);
    if (!B) return;
    // landing squares while dragged: six, one blue
    var d = await dragEnd(arc, proc, await rect(proc), true), all = d.seen.place.concat(d.seen.port);
    ok(tag + ': six landing squares over the process, one blue', d.seen.place.length === 5 && d.seen.port.length === 1, JSON.stringify(d.seen));
    var c = await rect(proc), z = all.length === 6 ? Math.max.apply(null, all.map(function (q) { return Math.abs(q[0] - c[0]); })) / (B[2] / 2) : 1;
    var marks = all.map(function (q) { return key2([(q[0] - c[0]) / z, (q[1] - c[1]) / z]); }).sort();
    var vertical = marks.join(' ') === sixOf(B, true).join(' ');
    ok(tag + ': the squares at the middles of the sides off the antennas and the corners', vertical || marks.join(' ') === sixOf(B, false).join(' '), marks.join(' ') + ' / ' + sixOf(B, true).join(' '));
    // dropped on each: shown in Properties, a corner written to the SBGN-ML file
    var got = [];
    for (var j = 0; j < all.length; j++) {
      var dj = await dragEnd(arc, proc, all[j]);
      var F = await where(), o = [F.tx, F.ty];
      got.push(key2(o));
      if (sbgnml && Math.abs(o[0]) > 0.01 && Math.abs(o[1]) > 0.01) {
        var t = await now(), m = new RegExp('<(?:\\w+:)?arc [^>]*id="' + arc + '"[\\s\\S]*?<(?:\\w+:)?end x="([^"]*)" y="([^"]*)"').exec(t);
        ok(tag + ': the corner ' + key2(o) + ' written as the arc\'s end', m && Math.abs(+m[1] - (B[0] + B[2] / 2 + o[0])) < 0.05 && Math.abs(+m[2] - (B[1] + B[3] / 2 + o[1])) < 0.05, m && m[1] + ',' + m[2]);
      }
    }
    ok(tag + ': each of the six taken by a drop and shown as Target port X and Y', got.slice().sort().join(' ') === marks.join(' '), got.join(' '));
    if (sbgnml) { await pick(arc); ok(tag + ': the modifier\'s port fields open', !(await fields()).txOff && !(await fields()).tyOff); }
    // Turn process: the end at a corner turned a quarter clockwise with it, the places turned with the antennas
    var corner = all.filter(function (q) { return Math.abs(q[0] - c[0]) > 2 && Math.abs(q[1] - c[1]) > 2 && q[0] > c[0] && q[1] < c[1]; })[0];
    await dragEnd(arc, proc, corner);
    var before = await where();
    await page.keyboard.press('Escape'); await page.mouse.click(c[0], c[1], { button: 'right' }); await page.waitForTimeout(400);
    var turnBtn = await page.$('.m2-cx button:has-text("Turn")');
    ok(tag + ': Turn in the process\'s right-click menu', !!turnBtn);
    if (turnBtn) { await turnBtn.click(); await page.waitForTimeout(1500); }
    var after = await where(), want = [-before.ty * B[2] / B[3], before.tx * B[3] / B[2]];
    ok(tag + ': turned, the end on the corner a quarter clockwise', Math.abs(after.tx - want[0]) < 0.05 && Math.abs(after.ty - want[1]) < 0.05, key2([before.tx, before.ty]) + ' -> ' + key2([after.tx, after.ty]));
    var d2 = await dragEnd(arc, proc, await rect(proc), true), all2 = d2.seen.place.concat(d2.seen.port);
    var marks2 = all2.map(function (q) { return key2([(q[0] - c[0]) / z, (q[1] - c[1]) / z]); }).sort();
    ok(tag + ': turned, the six places with the antennas', marks2.join(' ') === sixOf(B, !vertical).join(' '), marks2.join(' '));
    await key(); await key();   // the drop and the turn undone
    // the arrow keys: from a side middle the arrow along that side steps to the corner it points to
    var side = all.filter(function (q) { return vertical ? Math.abs(q[1] - c[1]) < 2 && q[0] > c[0] : Math.abs(q[0] - c[0]) < 2 && q[1] < c[1]; })[0];
    await dragEnd(arc, proc, side); await pick(arc);
    var s0 = await where(), sq = near(await squares('.m2-ed-bend'), [c[0] + s0.tx * z, c[1] + s0.ty * z]);
    await page.mouse.click(sq[0], sq[1]); await page.waitForTimeout(400);
    await page.keyboard.press(vertical ? 'ArrowUp' : 'ArrowRight'); await page.waitForTimeout(1200);
    var s1 = await where(), wantK = vertical ? [B[2] / 2, -B[3] / 2] : [B[2] / 2, -B[3] / 2];
    ok(tag + ': an arrow key steps the end from a side middle to the corner it points to', Math.abs(s1.tx - wantK[0]) < 0.05 && Math.abs(s1.ty - wantK[1]) < 0.05, key2([s0.tx, s0.ty]) + ' -> ' + key2([s1.tx, s1.ty]));
    await key(); await key();
    if (!sbgnml) return;   // Properties not on GraphML maps yet
    // typed X and Y kept as typed, one undo step each, redone
    await pick(arc);
    var f0 = await fields();
    await type('tx', '3'); await type('ty', '-4');
    var f1 = await fields();
    ok(tag + ': typed 3 and -4 kept as typed', f1.tx === 3 && f1.ty === -4, f1.tx + ',' + f1.ty);
    await key(); await key(); await pick(arc);
    var f2 = await fields();
    ok(tag + ': undone twice, the end as before', f2.tx === f0.tx && f2.ty === f0.ty, f2.tx + ',' + f2.ty + ' / ' + f0.tx + ',' + f0.ty);
    await key(true); await key(true); await pick(arc);
    var f3 = await fields();
    ok(tag + ': redone twice, 3 and -4 again', f3.tx === 3 && f3.ty === -4, f3.tx + ',' + f3.ty);
    await key(); await key();
    // the production's end at the process: locked, its row saying why
    await pick(flux[0], 0.5);
    var fp = await fields(), off = flux[1] ? fp.sxOff : fp.txOff, tip = flux[1] ? fp.sxTip : fp.txTip;
    ok(tag + ': an antenna\'s end still locked, its row saying why', off && /antenna/.test(tip), JSON.stringify(fp));
  }

  // SBGN-ML: PKA-C's catalysis on its process
  await page.goto('about:blank'); await page.goto(base + '#glycolysis-sbgn', { waitUntil: 'load' });
  await enterEdit();
  var flux = await page.evaluate(function () {   // an arc at the process's antenna: [id, whether the process is its source]
    var t = window.m2EditNow().text, d = new DOMParser().parseFromString(t, 'text/xml'), r = null;
    Array.prototype.forEach.call(d.getElementsByTagNameNS('*', 'arc'), function (a) { if (!r && /^n19\b/.test(a.getAttribute('source')) && a.getAttribute('class') === 'production') r = [a.getAttribute('id'), true]; });
    return r; });
  await run('SBGN-ML', 'e21', 'n19', flux, true);

  // GraphML: a catalysis at a process of the acly map, added as a person outside adds a file
  if (dataDir) {
    await page.goto('about:blank'); await page.goto(base, { waitUntil: 'load' });
    await OM.byFile(page, base, path.join(dataDir, 'test-maps/test-set/maps/acly-graphml.graphml'));
    await enterEdit();
    var fl2 = await page.evaluate(function () {
      var t = window.m2EditNow().text, r = null;
      (t.match(/<edge [^>]*>[\s\S]*?<\/edge>/g) || []).forEach(function (e) {
        var a = /<y:Arrows source="([^"]+)" target="([^"]+)"/.exec(e), m = /<edge [^>]*id="([^"]+)"[^>]*source="([^"]+)"[^>]*target="([^"]+)"/.exec(e);
        if (!r && m && a && m[2] === 'n6' && a[1] === 'none' && a[2] === 'delta') r = [m[1], true];
        if (!r && m && a && m[3] === 'n6' && a[1] === 'none' && a[2] === 'none') r = [m[1], false];
      });
      return r; });
    ok('GraphML: an arc at the antenna found', !!fl2);
    if (fl2) await run('GraphML', 'e25', 'n6', fl2, false);
  } else ok('GraphML: --data given', false);

  ok('no script error', !errs.length, errs.join(' | '));
  console.log(bad ? bad + ' wrong' : 'all ok');
  await b.close();
  process.exit(bad ? 1 : 0);
})();
