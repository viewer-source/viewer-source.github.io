// An edge member (a glyph crossing its compartment's border) dragged on the live page, CellDesigner and SBGN-ML:
// a plain drag inward takes it fully inside, the compartment unchanged; dragged back past the border after that release it
// is an inside member and the compartment grows round it; in one drag through the whole compartment and out past its far
// side it stays crossing, the compartment growing to keep it. Dragged outward, the border follows its centre where another
// compartment is drawn outside it there (the centre one unit inside), its edge where nothing is (kept crossing, the centre
// out). On SBGN-ML the member is first put onto the border with Shift (no demo map draws one crossing). Nothing is saved (no token). The editor is the live one, or with --local the
// working tree's editor.js routed into the page.
// The maps are files of the test set, added by Add map from file in each page's own browser context.
//   node tests/transmembrane.js [--local] --data=<clone of the data repository>   (needs Playwright; run from viewer/)
var { chromium } = require('playwright'), fs = require('fs'), path = require('path'), OM = require('./lib/open-map.js');
var here = path.join(__dirname, '..'), local = process.argv.indexOf('--local') >= 0, BASE = 'https://viewer-source.github.io/';
function editor() {   // editor.js joined as Jekyll joins it
  return require('./editor-now.js')(here);
}
async function open(b, map, id, zoom) {
  var p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  if (local) await p.route(/\.io\/editor\/editor\.js/, function (r) { r.fulfill({ contentType: 'application/javascript', body: editor() }); });
  await p.addInitScript(function () { try { localStorage.setItem('atlas-edit-level', 'full'); } catch (e) {} });
  await OM.open(p, BASE, map);   // the test-set file added in this page's context, then opened by its own address
  await p.waitForSelector('.m2-ri[data-win="edit"]', { timeout: 30000 }); await p.click('.m2-ri[data-win="edit"]');
  await p.waitForSelector('[data-n="' + id + '"]', { timeout: 60000 }); await p.waitForTimeout(3000);
  var r = await box(p, id); await p.mouse.move((r[0] + r[2]) / 2, (r[1] + r[3]) / 2);
  for (var i = 0; i < zoom; i++) { await p.keyboard.down('Control'); await p.mouse.wheel(0, -200); await p.keyboard.up('Control'); await p.waitForTimeout(300); }
  await p.waitForTimeout(1500);
  return p;
}
function box(p, id) { return p.evaluate(function (id) { var q = document.querySelector('[data-n="' + id + '"]').getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom].map(Math.round); }, id); }
// press: where on the box, as fractions of its width and height (a complex's empty corner, not a member); the first drag
// of a page clicks first to select (a second click on what is selected would deselect it)
async function drag(p, id, dy, o) {
  var r = await box(p, id), x = r[0] + (r[2] - r[0]) * o.at[0], y = r[1] + (r[3] - r[1]) * o.at[1];
  if (!p.clicked) { p.clicked = true; await p.mouse.click(x, y); await p.waitForTimeout(300); }
  if (o.shift) await p.keyboard.down('Shift');
  await p.mouse.move(x, y); await p.mouse.down();
  for (var k = 1; k <= 15; k++) { await p.mouse.move(x, y + dy * k / 15); await p.waitForTimeout(30); }
  await p.mouse.up(); if (o.shift) await p.keyboard.up('Shift');
  await p.waitForTimeout(3500);
}
function inside(n, c) { return c[0] <= n[0] && c[1] <= n[1] && n[2] <= c[2] && n[3] <= c[3]; }
function cross(n, c) { return n[0] < c[2] && c[0] < n[2] && n[1] < c[3] && c[1] < n[3] && !inside(n, c); }
var CASES = [   // name, map, member, compartment, zoom steps, where to press, put on the border with Shift first
  ['CellDesigner, ITPR complex on the ER', 'asthmamap-mast-cell-celldesigner', 'csa39', 'ca6', 6, [0.1, 0.25], false],
  ['SBGN-ML, INS on the extracellular border', 'colour-glycogen-muscle-sbgn', 'n2__n0', 'n2', 0, [0.5, 0.5], 'top']
];
var OUT = [   // name, map, member, compartment, zoom, where to press, put on that border with Shift first (false: on it), the drag (up or down), the rule expected
  ['CellDesigner, ITPR complex on the ER, the cell outside', 'asthmamap-mast-cell-celldesigner', 'csa39', 'ca6', 6, [0.1, 0.25], false, 'up', 'centre'],
  ['SBGN-ML, INS on the extracellular space against the plasma membrane', 'colour-glycogen-muscle-sbgn', 'n2__n0', 'n2', 0, [0.5, 0.5], 'bottom', 'down', 'centre'],
  ['SBGN-ML, INS on the extracellular space against empty space', 'colour-glycogen-muscle-sbgn', 'n2__n0', 'n2', 0, [0.5, 0.5], 'top', 'up', 'edge']
];
(async function () {
  var b = await chromium.launch(), bad = 0, ran = 0;
  var t = function (c, m, v, d) { ran++; if (!v) { bad++; console.log('FAIL', c[0] + ':', m, JSON.stringify(d)); } };
  for (var c of CASES) {
    var N = c[2], C = c[3], o = { at: c[5] };
    var start = async function (p) {   // the member on the border
      if (c[6]) { var n = await box(p, N), k = await box(p, C); await drag(p, N, (c[6] === 'bottom' ? k[3] : k[1]) - n[1] - (n[3] - n[1]) / 2, { at: c[5], shift: true }); }
      var n0 = await box(p, N), c0 = await box(p, C); t(c, 'starts crossing', cross(n0, c0), [n0, c0]); return [n0, c0];
    };
    var p = await open(b, c[1], N, c[4]), s = await start(p);
    await drag(p, N, (s[1][1] + s[1][3]) / 2 - (s[0][1] + s[0][3]) / 2, o);
    var n1 = await box(p, N), c1 = await box(p, C);
    t(c, 'plain drag inward: fully inside', inside(n1, c1), [n1, c1]);
    t(c, 'compartment unchanged', c1.every(function (v, i) { return Math.abs(v - s[1][i]) <= 1; }), [s[1], c1]);
    await drag(p, N, s[1][1] - n1[3] - 5, o);
    var n2 = await box(p, N), c2 = await box(p, C);
    t(c, 'back past the border after release: inside, the compartment grown upward', inside(n2, c2) && c2[1] < c1[1] && Math.abs(c2[3] - c1[3]) <= 1, [n2, c2]);
    await p.close();
    p = await open(b, c[1], N, c[4]); s = await start(p);
    await drag(p, N, s[1][3] - s[0][1] + 6, o);
    var n3 = await box(p, N), c3 = await box(p, C);
    t(c, 'one drag through and past the far side: still crossing, the compartment grown downward', cross(n3, c3) && c3[3] > s[1][3] && Math.abs(c3[1] - s[1][1]) <= 1, [n3, c3]);
    await p.close();
  }
  for (var c of OUT) {   // dragged outward by its height and a half: the border follows its centre, or its edge
    var N = c[2], C = c[3], up = c[7] === 'up';
    var p = await open(b, c[1], N, c[4]);
    if (c[6]) { var n = await box(p, N), k = await box(p, C); await drag(p, N, (c[6] === 'bottom' ? k[3] : k[1]) - n[1] - (n[3] - n[1]) / 2, { at: c[5], shift: true }); }
    var n0 = await box(p, N), c0 = await box(p, C), h = n0[3] - n0[1];
    t(c, 'starts crossing', cross(n0, c0), [n0, c0]);
    await drag(p, N, (up ? -1 : 1) * h * 1.5, { at: c[5] });
    var n1 = await box(p, N), c1 = await box(p, C), mid = (n1[1] + n1[3]) / 2, side = up ? c1[1] : c1[3];
    t(c, 'still crossing, the compartment grown ' + c[7] + 'ward', cross(n1, c1) && (up ? c1[1] < c0[1] - h / 2 : c1[3] > c0[3] + h / 2), [n0, c0, n1, c1]);
    if (c[8] === 'centre') t(c, 'its centre inside, the border just past it', up ? side <= mid && side >= mid - 6 : side >= mid && side <= mid + 6, [n1, c1]);
    else t(c, 'its centre outside, the border just inside its far edge', up ? side > mid && Math.abs(side - n1[3]) <= 4 : side < mid && Math.abs(side - n1[1]) <= 4, [n1, c1]);
    await p.close();
  }
  await b.close();
  console.log(ran + ' checks on ' + (CASES.length + OUT.length) + ' cases: ' + (bad ? bad + ' failed' : 'all ok'));
  process.exit(bad ? 1 : 0);
})();
