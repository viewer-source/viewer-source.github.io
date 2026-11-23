// The GraphML engine (renderers/converter/graphml_edit.js) against the editor's code it replaced (tests/lib/graphml-edit-
// before.js), byte for byte, on every GraphML map of the demo and the GraphML cd_edit makes of each CellDesigner map:
// read (nodes, edges, bend points, geometries, what holds what, shapes, insets, the reactions' process glyphs), and
// with seeded choices on each map: places written (geometries and bend points), boxes, insets and border insets of the
// groups, line ends (an attribute changed, one added, an end moved to another node), a bend point put before one,
// after the last, as a line's first (a closed y:Path opened), bend points taken out, the shift out of negative places
// (made negative first), a tag's line end. Every output compared with the old code's; the first difference shown.
//   node tests/graphml-edit.js [GraphML or CellDesigner files or folders ...]   (default: maps/)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), GE = require(path.join(here, 'renderers/converter/graphml_edit.js')), OLD = require('./lib/graphml-edit-before.js');
var cd = require(path.join(here, 'renderers/converter/cd_edit.js')), se = require(path.join(here, 'renderers/converter/sbgn_edit.js'));
var DP = require('@xmldom/xmldom').DOMParser, opt = { DOMParser: DP };
var args = process.argv.slice(2), files = [];
(args.length ? args : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.(graphml|xml)$/.test(p)) files.push(p);
});
function rnd(seed) { return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; }
function pick(r, n, k) { var a = [], out = []; for (var i = 0; i < n; i++) a.push(i); while (a.length && out.length < k) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; }
function plain(R) {   // what read gives, without the elements themselves
  var pathIx = new Map(); Array.prototype.forEach.call(R.doc ? R.doc.getElementsByTagNameNS(GE.Y, 'Path') : [], function (p, i) { pathIx.set(p, i); });
  return JSON.stringify({ g: R.geos.length, p: R.points.length, procs: R.procs,
    n: R.nodes.map(function (n) { return [n.id, n.geo, n.inside, n.kids, n.ag, n.shape, n.hub, n.eq, n.up, n.comp, n.ins, n.lab, n.labPos || null]; }),
    e: R.edges.map(function (e) { return [e.id, e.s, e.t, e.path ? pathIx.get(e.path) : null, e.arr, e.pts, e.smooth]; }) });
}
var bad = 0, cases = 0, maps = 0;
function same(tag, a, b) {
  cases++;
  if (a === b) return;
  bad++;
  var c = 0; if (typeof a === 'string' && typeof b === 'string') while (c < a.length && a[c] === b[c]) c++;
  console.log('DIFF ' + tag + (typeof a === 'string' && typeof b === 'string' ? ' at ' + c + ': before ' + JSON.stringify(a.slice(Math.max(0, c - 60), c + 60)) + ' | now ' + JSON.stringify(b.slice(Math.max(0, c - 60), c + 60)) : ': ' + a + ' | ' + b));
}
files.forEach(function (f, fi) {
  var src = fs.readFileSync(f, 'utf8'), t, isCd = /\.xml$/.test(f);
  if (isCd) { if (src.slice(0, 3000).indexOf('celldesigner') < 0) return; try { t = cd.graphml(src, null, opt); } catch (e) { return; } }
  else t = src;
  var name = path.basename(f), doc = new DP().parseFromString(t, 'application/xml'), R0, R1;
  try { R0 = OLD.parse(t, doc, isCd); } catch (e) { R0 = String(e); }
  try { R1 = GE.read(t, { DOMParser: DP, cd: isCd }); } catch (e) { R1 = String(e); }
  maps++;
  if (typeof R0 === 'string' || typeof R1 === 'string') return same(name + ' read', typeof R0 === 'string' ? R0 : 'read', typeof R1 === 'string' ? R1 : 'read');
  R0.doc = doc;
  same(name + ' read', plain(R0), plain(R1));
  var r = rnd(7919 + fi), G = R1.geos.length, P = R1.points.length, E = R1.edges.length, num = GE.num;
  // places
  var g = {}, p = {};
  pick(r, G, 6).forEach(function (i) { g[i] = [GE.fmt(num(R1.geos[i], 'x') + 12.5), GE.fmt(num(R1.geos[i], 'y') - 7)]; });
  pick(r, P, 4).forEach(function (i) { p[i] = [GE.fmt(num(R1.points[i], 'x') - 3.25), GE.fmt(num(R1.points[i], 'y') + 9)]; });
  same(name + ' place', OLD.write(t, g, p), GE.place(t, g, p));
  // boxes
  var at = {}; pick(r, G, 5).forEach(function (i) { at[i] = [num(R1.geos[i], 'x') + 4, num(R1.geos[i], 'y') + 8, num(R1.geos[i], 'width') + 16.125, num(R1.geos[i], 'height') + 2].map(GE.fmt); });
  same(name + ' boxes', OLD.setBoxes(t, at), GE.boxes(t, at));
  // insets of the groups
  R1.nodes.filter(function (n) { return n.kids.length; }).slice(0, 4).forEach(function (n, k) {
    var ins = k % 2 ? [null, 2.5, null, 4] : [0, null, 7.125, null], bins = [1, 0, 3.25, k];
    same(name + ' insets ' + n.id, OLD.insetsOf(t, n.id, ins, bins), GE.insets(t, n.id, ins, bins));
  });
  // line ends
  if (E) {
    var by = new Map(), all = Array.prototype.slice.call(R1.doc.getElementsByTagNameNS(GE.Y, 'Path'));
    pick(r, E, 5).forEach(function (k, j) { var e = R1.edges[k]; if (e.path) by.set(all.indexOf(e.path), [['sx', '1.5'], ['ty', '-2.0']].concat(j % 2 ? [['spot', String(j + 1)]] : [])); });
    same(name + ' ends', OLD.setPorts(t, by, null), GE.ends(t, by, null));
    var k0 = Math.floor(r() * E), to = R1.nodes[Math.floor(r() * R1.nodes.length)];
    var re = { k: k0, att: k0 % 2 ? 'target' : 'source', id: to.id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') };
    same(name + ' ends, an end moved', OLD.setPorts(t, by, re), GE.ends(t, by, re));
    // a tag's line end (create.js tagTurnT)
    pick(r, E, 2).forEach(function (k, j) { var e = R1.edges[k]; same(name + ' tag end ' + e.id, OLD.tagEnd(t, e.id, j, [-12.5, 3], se.repr), GE.pathOf(t, e.id, [[j ? 'tx' : 'sx', se.repr(-12.5)], [j ? 'ty' : 'sy', se.repr(3)]])); });
    // bend points: before one, after the last, a line's first
    var withPts = R1.edges.filter(function (e) { return e.path && e.pts.length; }), without = R1.edges.filter(function (e) { return e.path && !e.pts.length; });
    var Q = [123.456, 78.9];
    withPts.slice(0, 3).forEach(function (e) {
      var nth = all.indexOf(e.path);
      same(name + ' bend before ' + e.id, OLD.bend(t, e, nth, 0, Q), GE.bend(t, { before: e.pts[0] }, Q[0], Q[1]));
      same(name + ' bend after ' + e.id, OLD.bend(t, e, nth, e.pts.length, Q), GE.bend(t, { after: e.pts[e.pts.length - 1] }, Q[0], Q[1]));
    });
    without.slice(0, 3).forEach(function (e) {
      var nth = all.indexOf(e.path);
      same(name + ' bend first ' + e.id, OLD.bend(t, e, nth, 0, Q), GE.bend(t, { path: nth }, Q[0], Q[1]));
    });
    var closed = (t.match(/<y:Path[\s>\/][^>]*>/g) || []).map(function (m, i) { return /\/>$/.test(m) ? i : -1; }).filter(function (i) { return i >= 0; })[0];
    if (closed != null) { var ec = R1.edges.filter(function (e) { return all.indexOf(e.path) === closed; })[0]; if (ec) same(name + ' bend first in a closed path ' + ec.id, OLD.bend(t, ec, closed, 0, Q), GE.bend(t, { path: closed }, Q[0], Q[1])); }
  }
  if (P) { var ul = pick(r, P, 3); same(name + ' unbend', OLD.unbend(t, ul), GE.unbend(t, ul)); }
  // the shift out of negative places: the map made negative first (every geometry and point moved by -500, -60)
  var neg = GE.shift(t, -500, -60), RN = GE.read(neg, { DOMParser: DP, cd: isCd });
  var bs = RN.nodes.map(function (n) { var q = RN.geos[n.ag]; return [num(q, 'x'), num(q, 'y')]; }), ps = RN.points.map(function (q) { return [num(q, 'x'), num(q, 'y')]; });
  [16, 8, 24].forEach(function (B) {
    var o = OLD.noNegative(neg, bs, ps, B), sh = GE.shiftOf(bs, ps, B);
    same(name + ' shift, block ' + B, o ? o.join('|') : 'none', sh ? [GE.shift(neg, sh[0], sh[1]), sh[0], sh[1]].join('|') : 'none');
  });
});
console.log(maps + ' maps, ' + cases + ' cases: ' + (bad ? bad + ' different' : 'all byte for byte as before'));
process.exit(bad || !maps ? 1 : 0);
