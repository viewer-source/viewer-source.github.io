// Grid size beyond 8 (core.js gridBlock): Snap map to grid on a grid of 10 puts node centres outside complexes on 10 (nearly
// all: a node on a line with another's port keeps it) and bend points on 5, on 32 with the line step 8 bend points on 8; cd_edit.place fitted with a block of 20
// or 32 shifts every CellDesigner map by whole blocks and leaves nothing nearer the corner than 40.
//   node tests/grid-size.js [folder of the demo's maps, acly-graphml.graphml among them]   (default: maps/)
var fs = require('fs'), path = require('path'), DP = require('@xmldom/xmldom').DOMParser;
global.DOMParser = DP;
var here = path.join(__dirname, '..'), dir = process.argv[2] || path.join(here, 'maps');
var lay = require(path.join(here, 'renderers/layout/layout.js')), ed = require(path.join(here, 'renderers/converter/cd_edit.js'));
var bad = 0, ok = function (what, c, more) { console.log((c ? 'ok   ' : 'FAIL ') + what + (c || !more ? '' : ' ' + more)); if (!c) bad++; };
var cd = 0, on = function (v, g) { return Math.abs(v / g - Math.round(v / g)) < 1e-6; };
var t = fs.readFileSync(path.join(dir, 'acly-graphml.graphml'), 'utf8'), r = lay.tidy(t, 'grid', [], false, { grid: 10, DOMParser: DP });
var d = new DP().parseFromString(r[0], 'application/xml'), n = 0, at = 0, pts = 0, pOn = 0;
Array.prototype.forEach.call(d.getElementsByTagName('node'), function (nd) {
  if (nd.getElementsByTagName('node').length) return;
  for (var p = nd.parentNode; p; p = p.parentNode) if (p.nodeName === 'node') return;
  var g = nd.getElementsByTagName('y:Geometry')[0];
  n++; if (on(+g.getAttribute('x') + g.getAttribute('width') / 2, 10) && on(+g.getAttribute('y') + g.getAttribute('height') / 2, 10)) at++;
});
Array.prototype.forEach.call(d.getElementsByTagName('y:Point'), function (p) { pts++; if (on(+p.getAttribute('x'), 5) && on(+p.getAttribute('y'), 5)) pOn++; });
ok('Snap on 10: node centres on 10 (' + at + ' of ' + n + ')', n > 0 && at >= n - 1);
ok('Snap on 10: bend points on 5 (' + pOn + ' of ' + pts + ')', pOn >= pts * 0.9);
ok('Snap on 10 again changes nothing', lay.tidy(r[0], 'grid', [], false, { grid: 10, DOMParser: DP })[1] === 0);
ok('Snap with no grid is Snap on 8', lay.tidy(t, 'grid', [], false, { DOMParser: DP })[0] === lay.tidy(t, 'grid', [], false, { grid: 8, DOMParser: DP })[0]);
fs.readdirSync(dir).filter(function (f) { return /-celldesigner\.xml$/.test(f); }).forEach(function (f) {   // every CellDesigner map, fitted on blocks of 20 and 32
  var c = fs.readFileSync(path.join(dir, f), 'utf8'), gm = ed.graphml(c, null, { DOMParser: DP });
  [20, 32].forEach(function (B) {
    var q = ed.place(c, gm, { DOMParser: DP, fit: true, block: B }), sh = q[1], xs = [], ys = [];
    q[0].replace(/<celldesigner:(?:species|complexSpecies|compartment)Alias [\s\S]*?<celldesigner:bounds ([^>]*)>/g, function (a, b) { xs.push(+/\sx="([^"]*)"/.exec(' ' + b)[1]); ys.push(+/\sy="([^"]*)"/.exec(' ' + b)[1]); });
    if (sh[0] % B || sh[1] % B) ok(f + ', block ' + B + ': shift in whole blocks', false, String(sh));
    var mx = Math.min.apply(null, xs), my = Math.min.apply(null, ys);
    if (!(mx >= 40 - 1e-6 && my >= 40 - 1e-6)) ok(f + ', block ' + B + ': nothing nearer the corner than 40', false, mx + ',' + my);
    cd++;
  });
});
ok('CellDesigner fit on blocks of 20 and 32: ' + cd + ' runs', cd > 0 && !bad);
var r32 = lay.tidy(t, 'grid', [], false, { grid: 32, route: 8, DOMParser: DP }), d32 = new DP().parseFromString(r32[0], 'application/xml'), p32 = 0, o32 = 0;
Array.prototype.forEach.call(d32.getElementsByTagName('y:Point'), function (p) { p32++; if (on(+p.getAttribute('x'), 8) && on(+p.getAttribute('y'), 8)) o32++; });
ok('Snap on 32 with the line step 8: bend points on 8 (' + o32 + ' of ' + p32 + ')', o32 >= p32 * 0.9);
process.exit(bad ? 1 : 0);
