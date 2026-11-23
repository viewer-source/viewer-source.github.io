// cdrender.js and cd_edit.js against the previous release (tests/compare.js) on the test set's CellDesigner maps, in
// every way the viewer uses them: the build's drawing (classes) and its click data, the plain drawing, the editor's
// drawing (groups), cd_edit's GraphML, and cd_edit's write-back after moves (nodes, bend points, ports, a modifier's
// end, as the editor makes them; three seeded sets of moves per map, the second also past the top left so the map
// shifts back).
//   BASE=<earlier release> node tests/cd-compare.js [CellDesigner files or folders ...]
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), cd = require(path.join(here, 'renderers/converter/cdrender.js'));
var ed = require(path.join(here, 'renderers/converter/cd_edit.js'));
var xd = require('@xmldom/xmldom'), DP = xd.DOMParser, XS = xd.XMLSerializer, C = require('./compare.js').open('cd');
var cdB = C.base('renderers/converter/cdrender.js'), edB = C.base('renderers/converter/cd_edit.js');
var files = C.files(process.argv.slice(2), function (p) { if (!/\.xml$/.test(p)) return false; var t = fs.readFileSync(p, 'utf8').slice(0, 3000); return /<sbml[\s>]/.test(t) && t.indexOf('celldesigner') >= 0; });
var G = 'http://graphml.graphdrawing.org/xmlns', Y = 'http://www.yworks.com/xml/graphml';
function rng(seed) {   // mulberry32: the same moves on every machine
  return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function sample(a, k, r) { a = a.slice(); var out = []; while (out.length < k && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; }
function pick(a, r) { return a[Math.floor(r() * a.length)]; }
function moved(g, seed) {   // the GraphML as the editor leaves it after some moves
  var d = new DP().parseFromString(g, 'application/xml'), r = rng(seed), all = function (ns, tag) { return Array.prototype.slice.call(d.getElementsByTagNameNS(ns, tag)); };
  var nodes = all(G, 'node').filter(function (n) { return !/\|proc$/.test(n.getAttribute('id')) && !n.getElementsByTagNameNS(G, 'graph').length; });
  sample(nodes, 3, r).forEach(function (n) {
    var dx = pick([-37.5, 12.0, 60.25], r), dy = pick([-20.0, 8.5, 33.0], r);
    Array.prototype.forEach.call(n.getElementsByTagNameNS(Y, 'Geometry'), function (geo) { geo.setAttribute('x', String(+geo.getAttribute('x') + dx)); geo.setAttribute('y', String(+geo.getAttribute('y') + dy)); });
  });
  sample(all(Y, 'Point'), 3, r).forEach(function (p) { p.setAttribute('x', String(+p.getAttribute('x') + 7)); p.setAttribute('y', String(+p.getAttribute('y') - 11.5)); });
  var path1 = function (e) { return e.getElementsByTagNameNS(Y, 'Path')[0]; };
  sample(all(G, 'edge').map(path1).filter(Boolean), 2, r).forEach(function (p) { p.setAttribute('sx', '0.0'); p.setAttribute('sy', '-20.0'); });
  sample(all(G, 'edge').filter(function (e) { return (e.getAttribute('id') || '').indexOf('|m') >= 0; }).map(path1).filter(Boolean), 2, r).forEach(function (p) {   // a modifier end moved round its glyph
    p.setAttribute('tx', pick(['4.5', '-5.25', '0.5'], r)); p.setAttribute('ty', pick(['-6.0', '3.75', '0.25'], r)); p.setAttribute('spot', String(2 + Math.floor(r() * 6)));
  });
  if (seed % 2 && nodes.length) { var geo = nodes[0].getElementsByTagNameNS(Y, 'Geometry')[0]; geo.setAttribute('x', '-120.0'); geo.setAttribute('y', '-60.0'); }   // past the left and top edges
  return new XS().serializeToString(d);
}
function js(f) { try { return f(); } catch (e) { var m = /^(\w+Error):/.exec(e.message); return 'refused: ' + (m ? m[1] : e.name); } }
var t0 = Date.now(), o = { DOMParser: DP };
files.forEach(function (f) {
  var t = fs.readFileSync(f, 'utf8'), name = path.relative(here, f);
  var both = function (key, fn) { C.check(name + ' ' + key, js(function () { return fn(cd, ed); }), cdB && js(function () { return fn(cdB, edB); })); };
  both('classes', function (c) { var h = c.renderHits(t, Object.assign({ classes: true }, o)); return [h[0], h[1]]; });
  both('plain', function (c) { return c.render(t, o); });
  both('groups', function (c) { return c.render(t, Object.assign({ classes: true, groups: true }, o)); });
  both('graphml', function (c, e) { return e.graphml(t, null, o); });
  var g = js(function () { return ed.graphml(t, null, o); });
  if (/^refused: /.test(g)) return;
  [1, 2, 3].forEach(function (seed) { var mg = moved(g, seed); both('edit ' + seed, function (c, e) { return e.draw(t, mg, o); }); });
});
process.exit(C.end(files.length + ' CellDesigner maps (' + (Date.now() - t0) + ' ms)') ? 0 : 1);
