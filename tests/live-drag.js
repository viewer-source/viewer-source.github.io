// The live drawing of a move in the browser, compared between two versions of the editor: each case run on the live
// root page twice, once with the editor and renderers of a commit (default HEAD) and once with the working tree,
// both routed into the page, and the picture and the overlay read mid-move and after the release. Any difference is
// listed. Cases: a CellDesigner map shifted out of negative places, then a modifier's species dragged (its reaction
// drawn live); a complex member dragged out on CellDesigner and SBGN-ML (the complex growing); a member pushed out of a
// compartment (it grows); a reactant dragged (the process glyph following); the arrow keys held; a node resized by its
// handles; a line's end dragged (SBGN-ML and CellDesigner); a Shift drag; a CellDesigner compartment resized by its
// handle; an undo pressed during a drag. A case whose picture did not change during the move counts as failed (the press
// missed). Ids are the demo maps' as saved (Glycolysis CellDesigner names its species sa_n...).
// On CellDesigner maps the live reactions
// come from a session made while the browser is idle: a run where it is not ready yet draws the fallback, so a lone
// difference there is run again before it is believed. After the change is committed, pass the commit before it. Maps are the site's, read live: the two runs of a case follow each
// other, so a map changed on the site between them shows as a difference (run again).
//   node tests/live-drag.js [commit]        (needs Playwright; run from viewer/; ONLY=<part of a case's name> runs those)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), cp = require('child_process');
var here = path.join(__dirname, '..'), rev = process.argv[2] || 'HEAD', URL = 'https://viewer-source.github.io/#';
function src(which, rel) {   // a file of the working tree or of the commit
  if (which === 'now') return fs.readFileSync(path.join(here, rel), 'utf8');
  var top = cp.execFileSync('git', ['rev-parse', '--show-prefix'], { cwd: here }).toString().trim();
  return cp.execFileSync('git', ['show', rev + ':' + top + rel], { cwd: here, maxBuffer: 1 << 28 }).toString();
}
function editor(which) {   // editor.js joined as Jekyll joins it
  return src(which, 'editor/editor.js').replace(/^---[\s\S]*?---\n/, '').replace(/\{% include_relative (\S+) %\}/g, function (m, f) {
    try { return src(which, 'editor/' + f); } catch (e) { if (which === 'now') throw e; return ''; }   // a part not in that commit (live.js before it existed)
  });
}
async function open(browser, which, map, wait) {
  var p = await browser.newPage({ viewport: { width: 1400, height: 900 } }), errs = [];
  await p.route(/\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: editor(which) }); });
  await p.route(/\/renderers\/(converter\/(cdrender|cd_edit|cd_make|sbgn_edit)|yrender\/yrender|layout\/layout)\.js/, function (r) {
    var f = /renderers\/(.*\.js)/.exec(r.request().url())[1]; r.fulfill({ contentType: 'application/javascript', body: src(which, 'renderers/' + f) });
  });
  p.on('pageerror', function (e) { errs.push(e.message); });
  await p.addInitScript(function () { try { localStorage.setItem('atlas-edit-level', 'full'); } catch (e) {} });
  await p.goto(URL + map, { waitUntil: 'load' });
  await p.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 });
  await p.click('.m2-ri[data-win="edit"]');
  await p.waitForFunction(function (id) { return !!document.querySelector('[data-n="' + id + '"]'); }, wait, { timeout: 60000 });
  await p.waitForTimeout(2500);
  p.errs = errs;
  return p;
}
function centre(p, id) { return p.evaluate(function (id) { var q = document.querySelector('[data-n="' + id + '"]').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2, q.right, q.bottom]; }, id); }
function snap(p) {   // the picture and the overlay as they are, numbers to 2 decimals
  return p.evaluate(function () {
    var img = document.getElementById('m2-img'), ov = document.getElementById('m2-edit-layer');
    return ((img ? img.outerHTML : '') + '\n' + (ov ? ov.innerHTML : '')).replace(/-?\d+\.\d+/g, function (v) { return String(Math.round(parseFloat(v) * 100) / 100); });
  });
}
async function drag(p, id, dx, dy, o) {   // o: { shift, select, at: true to press at the box's bottom right corner (a handle) }
  o = o || {};
  var before = await snap(p), r = await centre(p, id), x = r[0], y = r[1];
  if (o.at) { x = r[2] - 1; y = r[3] - 1; }
  if (o.select !== false) { await p.mouse.click(r[0], r[1]); await p.waitForTimeout(250); }
  if (o.shift) await p.keyboard.down('Shift');
  await p.mouse.move(x, y); await p.mouse.down();
  for (var k = 1; k <= 12; k++) { await p.mouse.move(x + dx * k / 12, y + dy * k / 12); await p.waitForTimeout(25); }
  await p.waitForTimeout(250);
  var mid = await snap(p);
  if (mid === before) mid = 'NOTHING MOVED';
  await p.mouse.up(); if (o.shift) await p.keyboard.up('Shift');
  await p.waitForTimeout(3000);
  return [mid, await snap(p)];
}
// a line's end dragged: the first line with both ends in view (by id), selected by a click on its middle, its target end
// pressed and moved
async function endDrag(p, dx, dy) {
  var e = await p.evaluate(function () {
    var view = function (q) { return q.x > 320 && q.x < 1360 && q.y > 100 && q.y < 860; };
    var l = Array.prototype.map.call(document.querySelectorAll('#m2-img [data-e]'), function (g) {
      var q = /^(path|polyline|line)$/.test(g.tagName) ? g : g.querySelector('polyline[stroke], path, polyline, line'); if (!q || !q.getTotalLength) return null;
      var L = q.getTotalLength(), m = q.getScreenCTM(), at = function (f) { var r = q.getPointAtLength(L * f); return { x: m.a * r.x + m.c * r.y + m.e, y: m.b * r.x + m.d * r.y + m.f }; };
      return L > 60 && view(at(0)) && view(at(1)) ? [g.getAttribute('data-e'), at(0.5), at(1)] : null;
    }).filter(Boolean).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    return l[0] || null;
  });
  if (!e) return ['NO LINE', ''];
  var before = await snap(p);
  await p.mouse.click(e[1].x, e[1].y); await p.waitForTimeout(300);
  await p.mouse.move(e[2].x, e[2].y); await p.mouse.down();
  for (var k = 1; k <= 12; k++) { await p.mouse.move(e[2].x + dx * k / 12, e[2].y + dy * k / 12); await p.waitForTimeout(25); }
  await p.waitForTimeout(250);
  var mid = await snap(p);
  if (mid === before) mid = 'NOTHING MOVED';
  await p.mouse.up(); await p.waitForTimeout(3000);
  return [mid, await snap(p)];
}
// a drag with an undo pressed halfway (the move so far taken back or kept, as the editor does it), then released
async function undoMid(p, id, dx, dy) {
  var before = await snap(p), r = await centre(p, id);
  await p.mouse.click(r[0], r[1]); await p.waitForTimeout(250);
  await p.mouse.move(r[0], r[1]); await p.mouse.down();
  for (var k = 1; k <= 6; k++) { await p.mouse.move(r[0] + dx * k / 12, r[1] + dy * k / 12); await p.waitForTimeout(25); }
  await p.keyboard.press('Control+z'); await p.waitForTimeout(250);
  for (k = 7; k <= 12; k++) { await p.mouse.move(r[0] + dx * k / 12, r[1] + dy * k / 12); await p.waitForTimeout(25); }
  await p.waitForTimeout(250);
  var mid = await snap(p);
  if (mid === before) mid = 'NOTHING MOVED';
  await p.mouse.up(); await p.waitForTimeout(3000);
  return [mid, await snap(p)];
}
async function keys(p, id, key, n) {
  var r = await centre(p, id); await p.mouse.click(r[0], r[1]); await p.waitForTimeout(250);
  var before = await snap(p);
  for (var k = 0; k < n; k++) { await p.keyboard.down(key); await p.waitForTimeout(20); }
  var mid = await snap(p);
  if (mid === before) mid = 'NOTHING MOVED';
  await p.keyboard.up(key); await p.waitForTimeout(3000);
  return [mid, await snap(p)];
}
var CASES = [
  ['CellDesigner shifted, a modifier dragged', 'glycolysis-celldesigner', 'sa_n9', async function (p) { await drag(p, 'sa_n9', 0, -300); return drag(p, 'sa_n22', -40, -90); }],
  ['CellDesigner complex member out', 'glycolysis-celldesigner', 'sa_n3_n0', function (p) { return drag(p, 'sa_n3_n0', 60, -70); }],
  ['CellDesigner member pushed out of a compartment', 'carnitine-celldesigner', 'sa_n0_n1', function (p) { return drag(p, 'sa_n0_n1', -150, -40); }],
  ['CellDesigner compartment resized by its handle', 'carnitine-celldesigner', 'ca_n0', function (p) { return drag(p, 'ca_n0', 40, 30, { at: true }); }],
  ['CellDesigner line end dragged', 'glycolysis-celldesigner', 'sa_n22', function (p) { return endDrag(p, 30, 20); }],
  ['CellDesigner reactant dragged, glyph following', 'glycolysis-celldesigner', 'sa_n13', function (p) { return drag(p, 'sa_n13', 50, 30); }],
  ['CellDesigner arrow keys', 'glycolysis-celldesigner', 'sa_n22', function (p) { return keys(p, 'sa_n22', 'ArrowUp', 15); }],
  ['SBGN-ML complex member out', 'glycolysis-sbgn', 'n3__n1', function (p) { return drag(p, 'n3__n1', 70, 60); }],
  ['SBGN-ML node resized by its handle', 'glycolysis-sbgn', 'n14', function (p) { return drag(p, 'n14', 30, 20, { at: true }); }],
  ['SBGN-ML arrow keys', 'glycolysis-sbgn', 'n14', function (p) { return keys(p, 'n14', 'ArrowRight', 12); }],
  ['GraphML node dragged with its lines', 'glycolysis-graphml', 'n14', function (p) { return drag(p, 'n14', 40, -60); }],
  ['SBGN-ML line end dragged', 'glycolysis-sbgn', 'n14', function (p) { return endDrag(p, 30, 20); }],
  ['SBGN-ML Shift drag', 'glycolysis-sbgn', 'n14', function (p) { return drag(p, 'n14', 60, 40, { shift: true, select: false }); }],
  ['SBGN-ML undo during a drag', 'glycolysis-sbgn', 'n14', function (p) { return undoMid(p, 'n14', 50, 30); }],
  ['CellDesigner undo during a drag', 'glycolysis-celldesigner', 'sa_n22', function (p) { return undoMid(p, 'sa_n22', 50, 30); }]
];
(async function () {
  var browser = await chromium.launch(), bad = 0, ran = 0;
  for (var c of CASES.filter(function (c) { return !process.env.ONLY || c[0].indexOf(process.env.ONLY) >= 0; })) {
    var out = {};
    for (var which of ['ref', 'now']) {
      var p;
      try { p = await open(browser, which, c[1], c[2]); out[which] = await c[3](p); out[which].push(p.errs.join('; ')); }
      catch (e) { out[which] = ['', '', 'failed: ' + (e && e.message || e)]; }
      if (p) await p.close();
    }
    ran++;
    var diff = ['mid-move', 'after release', 'page errors'].filter(function (w, j) { return out.ref[j] !== out.now[j]; });
    if (out.now[2]) diff.push('errors now: ' + out.now[2].slice(0, 200));
    if (out.now[0] === 'NOTHING MOVED' || out.ref[0] === 'NOTHING MOVED') diff.push('nothing moved during the move');
    if (diff.length) { bad++; console.log('DIFF', c[0] + ':', diff.join(', ')); } else console.log('same', c[0]);
  }
  await browser.close();
  console.log(ran + ' cases against ' + rev + ': ' + (bad ? bad + ' different' : 'all the same'));
  process.exit(bad ? 1 : 0);
})();
