// The drag preview against the drop, step by step: for a glyph whose drop changes more than its place (a submap's
// terminal sliding along a side and turning round a corner, with a line attached; a free tag joining a submap; a
// submap resized with terminals on it), at each step of the drag what is drawn (every visible shape and line of the
// editor's drawing, in screen pixels) is compared with what a release at that very step draws (the same drag replayed
// to that step, released, measured, undone). Any shape or line drawn during the drag that the drop does not draw, or the
// other way round, is a difference. Testing Glycolysis SBGN-ML, the full editor, no token, the working tree's editor
// and renderers routed into the live /styles/ page.
//   node tests/drag-preview.js [viewer folder]   (LIVE=1: the page's own code; ONLY=<case name part>; SHOT=<prefix>)
var engine = require('playwright')[process.env.BROWSER || 'chromium'], fs = require('fs'), path = require('path');
var NOISE = require('./lib/noise.js');   // what a browser reports that is no fault of the page
var here = process.argv[2] || path.join(__dirname, '..'), URL = 'https://viewer-source.github.io/styles/#testing-glycolysis-sbgn', bad = 0;
var ok = function (what, v, more) { if (!v) bad++; console.log((v ? 'ok    ' : 'WRONG ') + what + (more && !v ? '  ' + more : '')); };
async function open(b) {
  var p = await b.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  await p.addInitScript(require('./lib/screen.js'));   // window.__ctm, the screen matrix in every engine
  if (!process.env.LIVE) {
    var ed = require('./editor-now.js')(here);
    await p.route(/\/styles\/editor\/editor\.js(\?|$)/, function (r) { r.fulfill({ contentType: 'application/javascript', body: ed }); });
    await p.route(/\/styles\/renderers\/.*\.js/, function (r) { var f = /renderers\/(.*\.js)/.exec(r.request().url())[1]; r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(here, 'renderers', f), 'utf8') }); });
  }
  p.on('pageerror', function (e) { if (!NOISE.test(e.message)) errs.push(e.message); });
  await p.addInitScript(function () { try { localStorage.removeItem('atlas-cd-compatible'); localStorage.setItem('atlas-edit-level', 'full'); localStorage.setItem('atlas-drag-moves', 'off'); } catch (e) {} });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await p.click('.m2-ri[data-win="edit"]');
  await p.waitForSelector('#m2-editwin button[data-make="submap"]', { state: 'visible', timeout: 30000 }); await p.waitForTimeout(2500);
  p.errs = errs;
  return p;
}
// every visible path, polygon and polyline of the editor's drawing, its points on screen (to half a pixel)
function drawn(p) {
  return p.evaluate(function () {
    var e = document.querySelector('#m2-img [data-n]'), img = e && e.ownerSVGElement, out = [];
    if (!img) return out;
    var ov = document.getElementById('m2-edit-layer'), els = Array.prototype.slice.call(img.querySelectorAll('path, polygon, polyline, rect, ellipse, circle'));
    if (ov) els = els.concat(Array.prototype.slice.call(ov.querySelectorAll('.m2-ed-handle, .m2-ed-bend, .m2-ed-port, .m2-ed-place, .m2-ed-sel')));   // the editor's marks that stay after a drop (handles, bend and port squares); guides show only while dragging
    els.forEach(function (el) {
      for (var q0 = el; q0 && q0 !== img && q0 !== ov; q0 = q0.parentNode) if (getComputedStyle(q0).display === 'none' || getComputedStyle(q0).visibility === 'hidden') return;
      var m = window.__ctm(el), q = [], pt = function (x, y) { q.push([m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]); };
      var n = el.localName, num = function (a) { return parseFloat(el.getAttribute(a) || 0); };
      if (n === 'rect') { var x = num('x'), y = num('y'), w = num('width'), h = num('height'); if (!w || !h) return; pt(x, y); pt(x + w, y); pt(x + w, y + h); pt(x, y + h); }
      else if (n === 'ellipse' || n === 'circle') { var cx = num('cx'), cy = num('cy'), rx = n === 'circle' ? num('r') : num('rx'), ry = n === 'circle' ? num('r') : num('ry'); pt(cx - rx, cy - ry); pt(cx + rx, cy + ry); }
      else {
        var d = el.getAttribute(n === 'path' ? 'd' : 'points') || '';
        if (/[AaHhVvCcSsTtQq]/.test(d)) { var bb = el.getBBox(); pt(bb.x, bb.y); pt(bb.x + bb.width, bb.y); pt(bb.x + bb.width, bb.y + bb.height); pt(bb.x, bb.y + bb.height); }   // a box by its four corners, as a polygon gives them
        else { var v = d.match(/-?[\d.]+(?:e-?\d+)?/g) || []; for (var i = 0; i + 1 < v.length; i += 2) pt(+v[i], +v[i + 1]); }
      }
      out.push(q.filter(function (u, i) { return !q.slice(0, i).some(function (v) { return Math.abs(u[0] - v[0]) < 0.5 && Math.abs(u[1] - v[1]) < 0.5; }); }));   // a closing point repeated once
    });
    return out;
  });
}
function diff(a, b) {   // the shapes of a with no shape of b within 1.5 px at every point, and the other way round
  // the same points (a polygon may be written from another corner): each point of one within 1.5 px of a point of the other
  var close = function (u, v) { return Math.abs(u[0] - v[0]) <= 1.5 && Math.abs(u[1] - v[1]) <= 1.5; };
  var near = function (s, t) { return s.length === t.length && s.every(function (u) { return t.some(function (v) { return close(u, v); }); }) && t.every(function (v) { return s.some(function (u) { return close(u, v); }); }); };
  var left = b.slice(), only = [];
  a.forEach(function (s) { var i = left.findIndex(function (t) { return near(s, t); }); if (i >= 0) left.splice(i, 1); else only.push(s); });
  return { mid: only, drop: left };
}
var fmt = function (s) { return s.map(function (q) { return Math.round(q[0]) + ',' + Math.round(q[1]); }).join(' '); };
function rect(p, id) { return p.$eval('#m2-img [data-n="' + id + '"]', function (g) { var r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }); }
function ids(p) { return p.$$eval('#m2-img [data-n]', function (l) { return l.map(function (x) { return x.getAttribute('data-n'); }); }); }
async function make(p, kind, x, y) {
  var b4 = await ids(p);
  await p.click('#m2-editwin button[data-make="' + kind + '"]'); await p.mouse.click(x, y); await p.waitForTimeout(1200);
  await p.keyboard.press('Escape');
  return (await ids(p)).filter(function (z) { return b4.indexOf(z) < 0; })[0];
}
async function line(p, from, to) {   // a consumption from glyph from to glyph to
  var E = await rect(p, from), F = await rect(p, to);
  await p.click('#m2-editwin button[data-make="consumption"]');
  await p.mouse.move(E[0] + E[2] / 2, E[1] + E[3] / 2); await p.mouse.down(); await p.mouse.move(E[0] + E[2] / 2 + 8, E[1] + E[3] / 2 + 20, { steps: 4 });
  await p.mouse.move(F[0] + F[2] / 2, F[1] + F[3] / 2, { steps: 12 }); await p.waitForTimeout(150); await p.mouse.up(); await p.waitForTimeout(1500);
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
}
// one case: press at P (after a click selecting it, unless pick is false), go through the points pts; at each, the
// drawing compared with a release there. shift: Shift held for the drag
async function steps(p, name, P, pts, o) {
  o = o || {};
  if (process.env.ONLY && name.indexOf(process.env.ONLY) < 0) return;
  var text = function () { return p.evaluate(function () { return window.m2EditNow().text; }); };
  for (var k = 0; k < pts.length; k++) {
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    if (o.pick !== false) { var Q = o.pickAt || P; await p.mouse.click(Q[0], Q[1]); await p.waitForTimeout(300); }   // pickAt: the click that selects, when the press is on a handle
    if (o.line) {   // its line selected too, by Shift with a click on it outside the submap
      var lp = await p.evaluate(function (id) {
        var g = document.querySelector('#m2-img [data-e="' + id + '"] path'); if (!g) return null;
        var L = g.getTotalLength(), q = g.getPointAtLength(L * 0.3), m = window.__ctm(g); return [m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f];
      }, o.line);
      await p.keyboard.down('Shift'); await p.mouse.click(lp[0], lp[1]); await p.keyboard.up('Shift'); await p.waitForTimeout(300);
    }
    if (o.shift) await p.keyboard.down('Shift');
    var t0 = await text();
    await p.mouse.move(P[0], P[1]); await p.mouse.down();
    await p.mouse.move(P[0] + 5, P[1] + 5, { steps: 2 });
    for (var j = 0; j <= k; j++) await p.mouse.move(pts[j][0], pts[j][1], { steps: 4 });
    await p.waitForTimeout(250);
    var mid = await drawn(p);
    var laid = await p.evaluate(function () {   // the posed glyphs' boxes as the browser lays them out, to tell a drawing apart from a reading of it
      var s = window.m2EditState(), pn = null; Object.keys(s).forEach(function (k) { if (s[k] && s[k].poseNow) pn = s[k].poseNow; });
      return pn ? Array.prototype.slice.call(document.querySelectorAll('#m2-img [data-n][transform*="rotate"]')).map(function (g) { var r = g.getBoundingClientRect(); return g.getAttribute('data-n') + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','); }).join('; ') : '';
    });
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-' + name.replace(/\W+/g, '-') + '-' + k + '-mid.png' });
    await p.mouse.up(); if (o.shift) await p.keyboard.up('Shift');
    await p.waitForTimeout(1800);
    var drop = await drawn(p);
    if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT + '-' + name.replace(/\W+/g, '-') + '-' + k + '-drop.png' });
    var d = diff(mid, drop), same = !d.mid.length && !d.drop.length;
    ok(name + ', step ' + (k + 1) + ' of ' + pts.length + ': the drag draws what the drop there draws', same,
      'drawn only during the drag: ' + d.mid.slice(0, 3).map(fmt).join(' | ') + '  drawn only after the drop: ' + d.drop.slice(0, 3).map(fmt).join(' | ') + (laid ? '  laid out during the drag: ' + laid : ''));
    var moved = (await text()) !== t0;   // a drop that changed nothing has no undo step: Cmd+Z would take back the change before it
    ok(name + ', step ' + (k + 1) + ': the drop changes the map', moved);
    if (moved) { await p.keyboard.press('Control+z'); await p.waitForTimeout(1500); }
    ok(name + ', step ' + (k + 1) + ': the next step starts from the same map', (await text()) === t0);
  }
}
(async function () {
  var b = await engine.launch(), p = await open(b);
  // a submap made 240 by 160 in empty room, a terminal on its right side, a line to it from an entity of the map
  var sm = await make(p, 'submap', 1100, 700), S = await rect(p, sm);
  await p.mouse.click(S[0] + S[2] / 2, S[1] + S[3] / 2); await p.waitForTimeout(500);
  await p.fill('#m2-ed-w', '240'); await p.press('#m2-ed-w', 'Enter'); await p.waitForTimeout(1200);
  await p.fill('#m2-ed-h', '160'); await p.press('#m2-ed-h', 'Enter'); await p.waitForTimeout(1200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  S = await rect(p, sm);
  var tr = await make(p, 'tag', S[0] + S[2] - 1, S[1] + S[3] / 2);
  var ent = await p.evaluate(function () { var t = window.m2EditNow().text, m = /<glyph [^>]*class="macromolecule"[^>]*id="([^"]*)"|<glyph [^>]*id="([^"]*)"[^>]*class="macromolecule"/.exec(t); return m ? m[1] || m[2] : null; });
  await line(p, ent, tr);
  ok('set up: a submap, its terminal on the right side with a line to it', !!sm && !!tr && /class="terminal"/.test(await p.evaluate(function () { return window.m2EditNow().text; })), p.errs.join(' | '));
  S = await rect(p, sm); var R = await rect(p, tr), c = [R[0] + R[2] / 2, R[1] + R[3] / 2];
  var L = S[0], T = S[1], Rt = S[0] + S[2], B = S[1] + S[3];
  // along the right side, round the top right corner onto the top side, along it
  await steps(p, 'terminal round the top right corner', c, [[Rt + 6, T + 40], [Rt + 4, T + 8], [Rt + 10, T - 10], [Rt - 30, T - 6], [Rt - 90, T + 4]]);
  // round the bottom right corner onto the bottom side
  await steps(p, 'terminal round the bottom right corner', c, [[Rt + 6, B - 30], [Rt + 8, B + 8], [Rt - 40, B + 6], [Rt - 120, B - 4]]);
  // across to the left side, and round the top left corner
  await steps(p, 'terminal to the left side and round the top left corner', c, [[L + S[2] / 2, T + S[3] / 2], [L + 4, T + 60], [L - 8, T + 6], [L + 40, T - 8]]);
  // a free tag dragged into the submap: it joins, as a terminal on the side nearest
  var tf = await make(p, 'tag', 1250, 160), F = await rect(p, tf), fc = [F[0] + F[2] / 2, F[1] + F[3] / 2];
  await steps(p, 'free tag dragged into the submap', fc, [[L + S[2] * 0.5, T - 60], [L + S[2] * 0.5, T + S[3] * 0.25], [L + S[2] * 0.85, T + S[3] * 0.5]]);
  // a terminal on the bottom side near the right corner, dragged round it and up the right side
  await p.keyboard.press('Escape'); await p.mouse.click(c[0], c[1]); await p.waitForTimeout(300);
  await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.move(c[0] + 5, c[1] + 5, { steps: 2 });
  await p.mouse.move(Rt + 6, B + 6, { steps: 6 }); await p.mouse.move(Rt - 30, B + 4, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(1800);
  var tb = await p.evaluate(function (id) { var m = new RegExp('<glyph [^>]*id="' + id + '"[^>]*>').exec(window.m2EditNow().text); return m && (/orientation="([^"]*)"/.exec(m[0]) || [])[1]; }, tr);
  ok('set up: the terminal on the bottom side near the right corner, pointing up', tb === 'up', tb);
  var Rb = await rect(p, tr), cb = [Rb[0] + Rb[2] / 2, Rb[1] + Rb[3] / 2];
  await steps(p, 'terminal from the bottom side up the right side, from there', cb, [[Rt + 4, B - 6], [Rt + 6, B - 40], [Rt + 6, T + S[3] / 2]]);
  var le = await p.evaluate(function (id) { var m = new RegExp('<arc [^>]*id="([^"]*)"[^>]*target="' + id + '"|<arc [^>]*target="' + id + '"[^>]*id="([^"]*)"').exec(window.m2EditNow().text); return m && (m[1] || m[2]); }, tr);
  ok('set up: the terminal\u2019s line found', !!le && !!(await p.$('#m2-img [data-e="' + le + '"]')), le);
  await steps(p, 'terminal with its line selected, from the bottom side up the right side', cb, [[Rt + 4, B - 6], [Rt + 6, B - 40]], { line: le });
  // the submap resized by its bottom right handle: its terminal on the right side stays on it
  await steps(p, 'submap resized wider and taller', [Rt - 1, B - 1], [[Rt + 30, B + 20], [Rt + 80, B + 50]], { pickAt: [L + S[2] * 0.3, T + S[3] * 0.3] });   // selected first, so the corner is its handle
  ok('no script error', !p.errs.length, p.errs.join(' | '));
  await b.close();
  console.log(bad ? bad + ' wrong' : 'all ok'); process.exit(bad ? 1 : 0);
})();
