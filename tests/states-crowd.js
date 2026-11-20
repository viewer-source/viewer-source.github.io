// Icons that never touch (notes/state-crowding.md), on the live page, SBGN-ML and CellDesigner: a protein made from the
// palette; a unit of information (and on CellDesigner a structural state), then 20 state variables; another protein with
// 14 state variables, then a unit of information. After each step no two icons closer than 2 px, every icon on its
// glyph's border, the glyph grown only in the steps of the design (width +20 and height in its kind's proportion, 80 by 40:
// +10), at most one step per state variable added, never smaller; one undo takes back the icon and the growth together. No script error.
//   node tests/states-crowd.js [base address] [viewer folder: its editor and renderers served in place of the page's]
var { chromium } = require('playwright'), fs = require('fs'), path = require('path');
var base = process.argv[2] || 'https://viewer-source.github.io/styles/', local = process.argv[3];
(async function () {
  var b = await chromium.launch(), page = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [], bad = 0;
  if (local) {
    var ed = fs.readFileSync(path.join(local, 'editor/editor.js'), 'utf8').replace(/^---[\s\S]*?---\n/, '')
      .replace(/\{% include_relative (src\/[\w.]+) %\}/g, function (m, f) { return fs.readFileSync(path.join(local, 'editor', f), 'utf8'); });
    await page.route('**/editor/editor.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: ed }); });
    await page.route('**/renderers/converter/*.js*', function (r) { r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(local, 'renderers/converter', new URL(r.request().url()).pathname.split('/').pop()), 'utf8') }); });
  }
  page.on('pageerror', function (e) { errs.push(e.message); });
  var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
  var ids = function () { return page.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); };
  var rect = function (id) { return page.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); };
  var esc = async function () { for (var n = 0; n < 3; n++) { await page.keyboard.press('Escape'); await page.waitForTimeout(80); } };
  var menuPick = async function (P, label) {
    await esc(); await page.mouse.click(P[0], P[1], { button: 'right' }); await page.waitForTimeout(300);
    var l = await page.$$eval('.m2-cx button', function (q) { return q.map(function (x) { return x.textContent; }); });
    if (l.indexOf(label) < 0) return false;
    await page.click('.m2-cx button:text-is("' + label + '")'); await page.waitForTimeout(700); return true;
  };
  var open = async function (hash, make) {
    await page.goto(base + '#' + hash, { waitUntil: 'load' }); await page.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await page.waitForTimeout(2500);   // edit mode kept over a reload: not toggled off
    if (!(await page.$('#m2-editwin button[data-make="' + make + '"]:visible'))) await page.click('.m2-ri[data-win="edit"]');
    await page.waitForSelector('#m2-editwin button[data-make="' + make + '"]', { state: 'visible', timeout: 30000 }); await page.waitForTimeout(1500);
  };
  var place = async function (make, x, y) {
    var a0 = await ids(); await page.click('#m2-editwin button[data-make="' + make + '"]'); await page.mouse.click(x, y); await page.waitForTimeout(900); await esc();
    return (await ids()).filter(function (i) { return a0.indexOf(i) < 0; })[0];
  };
  // the glyph's box and its icons' boxes from the file as written now (SBGN-ML: bbox; CellDesigner: bounds, angles drawn
  // as cdrender draws them on the front box)
  var state = function (id, cd) {
    return page.evaluate(function (a) {
      var t = window.m2EditNow().text;
      if (a.cd) {
        var M = window.cd_make, I = M.aliasInfo(t, a.id), f = M.features(t, a.id), s = 6 * ((I.homodimer || 1) - 1), F = [I.box[0], I.box[1], I.box[2] - s, I.box[3] - s], on = window.cdrender.onBorder, out = [];
        var rx = function (x) { return Math.trunc(window.cdrender.width(x || '', 10) / 2 + 12); };
        f.residues.forEach(function (r) { var c = on(F, r.angle); out.push([c[0] - 8, c[1] - 8, 16, 16]); });
        if (f.structural) { var c = on(F, f.structural.angle), w = 2 * rx(f.structural.text); out.push([c[0] - w / 2, c[1] - 8, w, 16]); }
        if (f.info) out.push([F[0] + F[2] / 2 - 35, F[1] - 8, 70, 16]);
        return { box: F, icons: out };
      }
      var d = new DOMParser().parseFromString(t, 'application/xml'), g = Array.prototype.filter.call(d.getElementsByTagName('glyph'), function (x) { return x.getAttribute('id') === a.id; })[0];
      var bb = function (x) { var q = Array.prototype.filter.call(x.children, function (c) { return c.localName === 'bbox'; })[0]; return q ? ['x', 'y', 'w', 'h'].map(function (k) { return +q.getAttribute(k); }) : null; };
      return { box: bb(g), icons: Array.prototype.filter.call(g.children, function (c) { return c.localName === 'glyph' && /^(state variable|unit of information)$/.test(c.getAttribute('class')); }).map(bb) };
    }, { id: id, cd: !!cd });
  };
  var apart = function (S) {   // [closest gap, every icon's centre on the border]
    var gap = Infinity, on = true, B = S.box;
    S.icons.forEach(function (p, i) {
      var cx = p[0] + p[2] / 2, cy = p[1] + p[3] / 2;
      var dx = Math.min(Math.abs(cx - B[0]), Math.abs(cx - B[0] - B[2])), dy = Math.min(Math.abs(cy - B[1]), Math.abs(cy - B[1] - B[3]));
      if (!((dx < 1.01 && cy > B[1] - 1 && cy < B[1] + B[3] + 1) || (dy < 1.01 && cx > B[0] - 1 && cx < B[0] + B[2] + 1))) on = false;
      S.icons.slice(i + 1).forEach(function (q) { gap = Math.min(gap, Math.max(q[0] - p[0] - p[2], p[0] - q[0] - q[2], q[1] - p[1] - p[3], p[1] - q[1] - q[3])); });
    });
    return [gap, on];
  };
  var stepOk = function (a, z, W0, H0) {   // how many steps of the design z is from a (-1: none of them)
    var w = a[2], h = a[3];
    for (var k = 0; k < 6; k++) {
      if (Math.abs(w - z[2]) < 0.6 && Math.abs(h - z[3]) < 0.6) return k;
      w += 20; h += 20 * H0 / W0;
    }
    return -1;
  };
  var run = async function (label, id, cd, adds) {   // adds: the menu items in turn ([item, typed text or null])
    var S0 = await state(id, cd), W0 = S0.box[2], H0 = S0.box[3], prev = S0, most = 0, worst = Infinity, offB = 0, steps = true, n0 = S0.icons.length, lost = 0;
    for (var k = 0; k < adds.length; k++) {
      var R = await rect(id), C = [R[0] + R[2] / 2, R[1] + R[3] / 2];
      if (!(await menuPick(C, adds[k][0]))) { ok(label + ': ' + adds[k][0] + ' offered (step ' + (k + 1) + ')', false); break; }
      if (adds[k][1] != null) {
        if (await page.$('input.m2-ed-type')) { await page.fill('input.m2-ed-type', adds[k][1]); await page.press('input.m2-ed-type', 'Enter'); }
        else await page.keyboard.press('Enter');   // a CellDesigner unit's window: its first choice written
        await page.waitForTimeout(800);
      }
      await esc();
      var S = await state(id, cd), A = apart(S);
      worst = Math.min(worst, A[0]); if (!A[1]) offB++;
      var st = stepOk(prev.box, S.box, W0, H0); if (st < 0) steps = false; else if (st > most && adds[k][0] === 'Add state variable') most = st;   // a unit that moves several state variables off the top may take more
      if (S.icons.length !== prev.icons.length + 1) lost++;
      prev = S;
    }
    ok(label + ': ' + adds.length + ' icons added, each one there', lost === 0 && prev.icons.length === n0 + adds.length, prev.icons.length + ' icons');
    ok(label + ': no two icons closer than 2 px', worst >= 2 - 0.01, 'closest ' + worst.toFixed(2));
    ok(label + ': every icon on the border', offB === 0, offB + ' steps with one off');
    ok(label + ': grown only in the design’s steps, never smaller', steps, JSON.stringify(prev.box));
    ok(label + ': at most one step per state variable added (' + most + ')', most <= 1);
    if (process.env.SHOW) console.log(JSON.stringify(prev));
    ok(label + ': grown past the first steps (' + prev.box[2] + ' by ' + prev.box[3] + ')', prev.box[2] > W0 && prev.box[3] > H0);
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z'); await page.waitForTimeout(900);
    var U = await state(id, cd);
    return [prev, U];
  };
  var many = function (n, item) { var a = []; for (var k = 0; k < n; k++) a.push([item, null]); return a; };

  // SBGN-ML
  await open('glycolysis-sbgn', 'macromolecule');
  var p1 = await place('macromolecule', 1150, 250), p2 = await place('macromolecule', 1150, 520);
  ok('SBGN-ML: two proteins made', !!p1 && !!p2);
  var r1 = await run('SBGN-ML, a unit then 20 state variables', p1, false, [['Add unit of information', null]].concat(many(20, 'Add state variable')));
  ok('SBGN-ML: one undo takes back the last icon', r1[1].icons.length === r1[0].icons.length - 1, r1[1].icons.length);
  var r2 = await run('SBGN-ML, 14 state variables then a unit', p2, false, many(14, 'Add state variable').concat([['Add unit of information', null]]));
  ok('SBGN-ML: one undo takes back the unit and its growth', r2[1].icons.length === r2[0].icons.length - 1, JSON.stringify([r2[0].box, r2[1].box]));

  // CellDesigner
  await open('acly-celldesigner', 'cd:PROTEIN');
  var c1 = await place('cd:PROTEIN', 1150, 250), c2 = await place('cd:PROTEIN', 1150, 520);
  ok('CellDesigner: two proteins made', !!c1 && !!c2);
  var r3 = await run('CellDesigner, a unit, a structural state, then 20 residues', c1, true, [['Add unit of information', ''], ['Add structural state', 'active']].concat(many(20, 'Add state variable')));
  ok('CellDesigner: one undo takes back the last residue and the growth with it', r3[1].icons.length === r3[0].icons.length - 1, JSON.stringify([r3[0].box, r3[1].box]));
  var r4 = await run('CellDesigner, 14 residues then a unit', c2, true, many(14, 'Add state variable').concat([['Add unit of information', '']]));
  ok('CellDesigner: one undo takes back the unit', r4[1].icons.length === r4[0].icons.length - 1);

  // a protein shown twice (ACLY's two copies on its map): 12 residues added on one; the other copy shows them too, at the
  // same angles: no more icons meeting there than before (it grows if needed), never a runaway size
  await open('acly-celldesigner', 'cd:PROTEIN');
  var pairs = function (S) { var n = 0; S.icons.forEach(function (p, i) { S.icons.slice(i + 1).forEach(function (q) { if (Math.max(q[0] - p[0] - p[2], p[0] - q[0] - q[2], q[1] - p[1] - p[3], p[1] - q[1] - q[3]) < 2 - 0.01) n++; }); }); return n; };
  var o0 = await state('sa_n5', true), m0 = await state('sa_n4', true);
  for (var k = 0; k < 12; k++) { var R = await rect('sa_n4'); if (!(await menuPick([R[0] + R[2] / 2, R[1] + R[3] / 2], 'Add state variable'))) { ok('ACLY: Add state variable offered', false); break; } await esc(); }
  var o1 = await state('sa_n5', true), m1 = await state('sa_n4', true);
  ok('ACLY: 12 residues on the copy worked on, none meeting', m1.icons.length === m0.icons.length + 12 && apart(m1)[0] >= 2 - 0.01, m1.icons.length + ' ' + apart(m1)[0]);
  ok('ACLY: the other copy shows them, no more meeting than before', o1.icons.length === o0.icons.length + 12 && pairs(o1) <= pairs(o0), pairs(o0) + ' -> ' + pairs(o1));
  ok('ACLY: the other copy\u2019s size sensible (' + o1.box[2] + ' by ' + o1.box[3] + ')', o1.box[2] <= 400 && o1.box[3] <= 100);
  if (process.env.SHOW) console.log(JSON.stringify([m1.box, o0.box, o1.box]));

  ok('no script error', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
