// layout.js's tidy on every map against the reference set (tests/reference.js): the text and the count of changes.
// Cases per map: Snap map to grid, Pack all, Pack the first complex, a compartment resized larger and smaller (the
// first two that hold something), the fit after a node in a compartment moved 200 right and 120 down; a CellDesigner
// map through cd_edit's GraphML with its ports kept (Snap, Pack, the resizes).
// Replaced layout-compare.js, the comparison with tidy.py and the layout skill's scripts (the viewer's
// layout and the skill are unlinked since, each its own master).
//   node tests/layout-reference.js [GraphML or CellDesigner files or folders ...]   (default: maps/)
var fs = require('fs'), path = require('path');
var here = path.join(__dirname, '..'), lay = require(path.join(here, 'renderers/layout/layout.js'));
var ed = require(path.join(here, 'renderers/converter/cd_edit.js'));
var xd = require('@xmldom/xmldom'), DP = xd.DOMParser, XS = xd.XMLSerializer, R = require('./reference.js').open('layout', process.argv.length <= 2);
var files = [];
(process.argv.length > 2 ? process.argv.slice(2) : [path.join(here, 'maps')]).forEach(function walk(p) {
  var st; try { st = fs.statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { if (!/(^|\/)(\.git|node_modules)$/.test(p)) fs.readdirSync(p).sort().forEach(function (f) { walk(path.join(p, f)); }); }
  else if (/\.graphml$/.test(p) || (/\.xml$/.test(p) && /<sbml[\s>]/.test(fs.readFileSync(p, 'utf8').slice(0, 3000)))) files.push(p);
});
var G = 'http://graphml.graphdrawing.org/xmlns', Y = 'http://www.yworks.com/xml/graphml';
function kids(n, tag) { return Array.prototype.filter.call(n.childNodes, function (c) { return c.nodeType === 1 && c.namespaceURI === G && c.localName === tag; }); }
function els(n) { return Array.prototype.filter.call(n.childNodes, function (c) { return c.nodeType === 1; }); }
function realizer(n) {   // as layout.js reads it: a GenericNode, else a group's active realizer, else what holds a Geometry
  var ys = [].concat.apply([], kids(n, 'data').map(els)).filter(function (x) { return x.namespaceURI === Y; });
  var gn = ys.filter(function (x) { return x.localName === 'GenericNode'; })[0];
  if (gn) return gn;
  var pa = ys.filter(function (x) { return x.localName === 'ProxyAutoBoundsNode'; })[0], rs = pa && els(pa).filter(function (x) { return x.localName === 'Realizers'; })[0];
  if (rs) return els(rs)[parseInt(rs.getAttribute('active') || '0', 10)];
  return ys.filter(function (x) { return els(x).some(function (c) { return c.localName === 'Geometry'; }); })[0];
}
function geo(n) { var r = realizer(n); return r && els(r).filter(function (c) { return c.localName === 'Geometry'; })[0]; }
function isGroup(n) { return n.getAttribute('yfiles.foldertype') === 'group'; }
function isComplex(n) { var r = realizer(n); return isGroup(n) && ((r && r.getAttribute('configuration')) || '').indexOf('omplex') >= 0; }
function members(n) { var g = kids(n, 'graph')[0]; return g ? kids(g, 'node') : []; }
function cases(text) {
  var d = new DP().parseFromString(text, 'application/xml'), nodes = Array.prototype.slice.call(d.getElementsByTagNameNS(G, 'node'));
  var out = [['grid', []], ['pack', []]], cx = nodes.filter(isComplex);
  if (cx.length) out.push(['pack', [cx[0].getAttribute('id')]]);
  nodes.filter(function (n) { return isGroup(n) && !isComplex(n) && members(n).length && geo(n); }).slice(0, 2).forEach(function (c) {
    var g = geo(c), x = +g.getAttribute('x'), y = +g.getAttribute('y'), w = +g.getAttribute('width'), h = +g.getAttribute('height'), id = c.getAttribute('id');
    out.push(['fit', { resize: [id, x - 30, y - 30, w + 60, h + 60] }]);
    out.push(['fit', { resize: [id, x + 5, y + 5, 10, 10] }]);
  });
  return out;
}
function moved(text) {   // a node in a compartment moved 200 to the right and 120 down, as a drag would leave the text
  var d = new DP().parseFromString(text, 'application/xml'), nodes = Array.prototype.slice.call(d.getElementsByTagNameNS(G, 'node'));
  var n = nodes.filter(function (n) { var up = n.parentNode && n.parentNode.parentNode; return up && up.localName === 'node' && up.namespaceURI === G && isGroup(up) && !isComplex(up) && !isGroup(n); })[0];
  if (!n) return null;
  Array.prototype.forEach.call(n.getElementsByTagNameNS(Y, 'Geometry'), function (g) { g.setAttribute('x', String(+g.getAttribute('x') + 200)); g.setAttribute('y', String(+g.getAttribute('y') + 120)); });
  return [new XS().serializeToString(d), n.getAttribute('id')];
}
function run(text, what, ids, keep) {
  try { return lay.tidy(text, what, ids, keep, { DOMParser: DP }); }
  catch (e) { var nm = /^(\w+Error):/.exec(e.message); return 'refused: ' + (nm ? nm[1] : e.name); }
}
var t0 = Date.now(), n = 0;
files.forEach(function (f) {
  var text = fs.readFileSync(f, 'utf8'), file = text, keep = false, name = path.relative(here, f);   // file: what is hashed (text may become cd_edit's GraphML)
  if (/\.xml$/.test(f)) {
    try { text = ed.graphml(text, null, { DOMParser: DP }); keep = true; } catch (e) { return; }   // not a CellDesigner map the editor can open
  }
  cases(text).forEach(function (c, k) { n++; R.check(name + ' ' + k + ' ' + c[0], [file, k, c[0]], run(text, c[0], c[1], keep), [text]); });
  if (!keep) { var m = moved(text); if (m) { n++; R.check(name + ' moved fit', [file, 'moved'], run(m[0], 'fit', { moved: [m[1]] }, false), [m[0]]); } }
});
var ok = R.end(files.length + ' maps, ' + n + ' runs (' + (Date.now() - t0) + ' ms)');
process.exit(ok ? 0 : 1);
