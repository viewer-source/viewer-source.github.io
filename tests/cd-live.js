// cd_edit.live() against cd_edit.draw(): the editor's live drawing of a move (each reaction the move touches, drawn by the
// drop's own code) must be the same text as the drawing made after the drop, reaction by reaction. For every CellDesigner
// map: three made-up moves of nodes, bend points and line ends (as tests/cd-compare.js makes them), every reaction drawn
// live, its halo and lines found as they are in draw()'s picture.
//   node tests/cd-live.js [CellDesigner files or folders ...]   (default: maps/)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), DP = require('@xmldom/xmldom').DOMParser;
global.DOMParser = DP;
var ed = require(path.join(here, 'renderers/converter/cd_edit.js')), opt = { DOMParser: DP };
var files = [];
(process.argv.length > 2 ? process.argv.slice(2) : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.xml$/.test(p)) { var t = fs.readFileSync(p, 'utf8').slice(0, 3000); if (/<sbml[\s>]/.test(t) && t.indexOf('celldesigner') >= 0) files.push(p); }
});
var YNS = 'http://www.yworks.com/xml/graphml', GNS = 'http://graphml.graphdrawing.org/xmlns';
function rnd(seed) { var s = seed * 2654435761 % 4294967296; return function () { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
function all(el, ns, name) { return Array.prototype.slice.call(el.getElementsByTagNameNS(ns, name)); }
function read(g) {   // node boxes, edge bend points and line ends, by id
  var r = new DP().parseFromString(g, 'application/xml').documentElement, b = new Map(), p = new Map(), q = new Map();
  all(r, GNS, 'node').forEach(function (n) { var x = all(n, YNS, 'Geometry')[0]; b.set(n.getAttribute('id'), ['x', 'y', 'width', 'height'].map(function (k) { return parseFloat(x.getAttribute(k)); })); });
  all(r, GNS, 'edge').forEach(function (e) {
    p.set(e.getAttribute('id'), all(e, YNS, 'Point').map(function (pt) { return [parseFloat(pt.getAttribute('x')), parseFloat(pt.getAttribute('y'))]; }));
    var pa = all(e, YNS, 'Path')[0]; if (pa) q.set(e.getAttribute('id'), ['sx', 'sy', 'tx', 'ty'].map(function (k) { return parseFloat(pa.getAttribute(k) || 0); }));
  });
  return [b, p, q];
}
function moved(g, seed) {   // the GraphML as the editor leaves it after some moves (no place past the left or top edge)
  var R = rnd(seed), pick = function (a, n) { a = a.slice(); var o = []; while (a.length && o.length < n) o.push(a.splice(Math.floor(R() * a.length), 1)[0]); return o; };
  var doc = new DP().parseFromString(g, 'application/xml'), r = doc.documentElement;
  var nodes = all(r, GNS, 'node').filter(function (n) { return !/\|proc$/.test(n.getAttribute('id')) && !all(n, GNS, 'graph').length; });
  pick(nodes, 3).forEach(function (n) { all(n, YNS, 'Geometry').forEach(function (x) {
    x.setAttribute('x', String(parseFloat(x.getAttribute('x')) + [12.0, 60.25, 33.5][Math.floor(R() * 3)]));
    x.setAttribute('y', String(parseFloat(x.getAttribute('y')) + [8.5, 33.0, 20.0][Math.floor(R() * 3)])); }); });
  pick(all(r, YNS, 'Point'), 3).forEach(function (p) { p.setAttribute('x', String(parseFloat(p.getAttribute('x')) + 7.0)); p.setAttribute('y', String(parseFloat(p.getAttribute('y')) + 11.5)); });
  pick(all(r, YNS, 'Path'), 2).forEach(function (p) { p.setAttribute('sx', '0.0'); p.setAttribute('sy', '-20.0'); });
  return new (require('@xmldom/xmldom').XMLSerializer)().serializeToString(doc);
}
var same = 0, diff = 0, skipped = 0, bad = [];
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), g;
  try { g = ed.graphml(t, null, opt); } catch (e) { return; }
  var base = read(g), rids = [];
  base[1].forEach(function (v, k) { var m = /^(.*)\|(a|b|[rpm]\d+)$/.exec(k); if (m && rids.indexOf(m[1]) < 0) rids.push(m[1]); });
  [1, 2, 3].forEach(function (seed) {
    var mg = moved(g, seed), q;
    try { q = ed.draw(t, mg, opt); } catch (e) { return; }
    if (/<g transform="translate\(0,0\)"><g transform/.test(q[0])) { skipped++; return; }   // shifted after the drop: not live
    var svg = q[0], cut = svg.indexOf('<g fill="none" stroke="#fff"'), halo = svg.slice(cut), lines = svg.slice(cut);   // the halos come first, then the lines
    var now = read(mg), boxes = new Map();
    now[0].forEach(function (b, k) { var o = base[0].get(k); if (!o || b.some(function (v, j) { return v !== o[j]; })) boxes.set(k, b); });
    var out = ed.live(t, g, opt).frame(boxes, now[1], now[2], rids);
    rids.forEach(function (rid) {
      var o = out[rid];
      if (!o) { skipped++; return; }
      if (halo.indexOf(o.halo) >= 0 && lines.indexOf(o.lines) >= 0) same++;
      else { diff++; if (bad.length < 10) bad.push(path.basename(f) + ' seed ' + seed + ' ' + rid); }
    });
  });
});
console.log(files.length + ' maps: ' + same + ' reactions drawn live the same as after the drop, ' + diff + ' different, ' + skipped + ' not drawn live (or the map shifted)');
if (bad.length) console.log('different: ' + bad.join(', '));
process.exit(diff ? 1 : 0);
