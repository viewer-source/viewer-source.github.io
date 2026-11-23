// The editor's model of a map under Node, as core.js reads it (parse) and binds it to the holding engine (hm): the
// node records of a GraphML (up, kids, inside, comp, hub, shape, box, ins, lab) and holding.js bound to them. Used by
// tests/membership.js and tests/holding-live.js.
var path = require('path'), here = path.join(__dirname, '..', '..');
var DP = require('@xmldom/xmldom').DOMParser, HOLD = require(path.join(here, 'renderers/layout/holding.js')), LAY = require(path.join(here, 'renderers/layout/layout.js'));
var GN = 'http://graphml.graphdrawing.org/xmlns', YN = 'http://www.yworks.com/xml/graphml';
function model(N, boxOf, cd) {   // the engine's model of the map, as core.js hm() makes it (extOf: layout.extent), Settings' paddings by default: compartments 12, complexes As Repack
  return { nodes: N, box: boxOf, cd: !!cd, pad: 12, cx: 'repack', room: LAY.room,
  // what node k draws round box b: layout.extent of its element, measured against the box that element has (N[k].box)
    ext: function (k, b) { var e = LAY.extent(N[k].el), g = N[k].box; return [b[0] + e[0] - g[0], b[1] + e[1] - g[1], b[0] + b[2] + e[2] - g[0] - g[2], b[1] + b[3] + e[3] - g[1] - g[3]]; } };
}
function editorOf(g, cd) {   // the editor's nodes2 (up, kids, inside, comp, hub, shape), as parse() reads them
  var d = new DP().parseFromString(g, 'application/xml'), N = [], byEl = new Map();
  Array.prototype.forEach.call(d.getElementsByTagNameNS(GN, 'node'), function (n) { byEl.set(n, N.length); N.push({ el: n, id: n.getAttribute('id') }); });
  var owner = function (e) { for (var p = e.parentNode; p; p = p.parentNode) if (p.localName === 'node') return p; return null; };
  N.forEach(function (n) {
    n.inside = Array.prototype.map.call(n.el.getElementsByTagNameNS(GN, 'node'), function (c) { return byEl.get(c); });
    n.kids = n.inside.filter(function (c) { return owner(N[c].el) === n.el; });
    var rs = n.el.getElementsByTagNameNS(YN, 'Realizers')[0], r = rs ? Array.prototype.filter.call(rs.childNodes, function (c) { return c.nodeType === 1; })[+rs.getAttribute('active') || 0] : null;
    if (!r) Array.prototype.forEach.call(n.el.childNodes, function (dd) { if (dd.nodeType === 1 && dd.localName === 'data') Array.prototype.forEach.call(dd.childNodes, function (c) { if (!r && c.nodeType === 1 && c.namespaceURI === YN) r = c; }); });
    var cfg = r ? r.getAttribute('configuration') || '' : '';
    n.hub = !cd && /sbgn\.(Process|Operator)$/.test(cfg);
    n.comp = n.el.getAttribute('yfiles.foldertype') === 'group' && !/omplex/.test(cfg);
    n.shape = { kind: /^Generic/.test(r ? r.localName : '') ? cfg.replace('com.yworks.sbgn.', '') : 'rectangle' };
    var geo = r.getElementsByTagNameNS(YN, 'Geometry')[0];
    n.box = ['x', 'y', 'width', 'height'].map(function (k) { return parseFloat(geo.getAttribute(k)); });
    n.up = null;
    var ins = r.getElementsByTagNameNS(YN, 'Insets')[0], iv = function (k) { return ins ? parseFloat(ins.getAttribute(k + 'F') || ins.getAttribute(k)) || 0 : 0; };
    n.ins = [iv('left'), iv('top'), iv('right'), iv('bottom')]; n.lab = { t: 0, b: 0 };
    Array.prototype.forEach.call(r.childNodes, function (l) {   // its own labels inside, at the top or the bottom (as parse())
      if (l.nodeType !== 1 || l.localName !== 'NodeLabel' || l.getAttribute('modelName') !== 'internal' || l.getAttribute('visible') === 'false') return;
      var sd = (l.getAttribute('modelPosition') || '').charAt(0);
      if (sd === 't' || sd === 'b') n.lab[sd] = Math.max(n.lab[sd], parseFloat(l.getAttribute('height')) || 0);
    });
  });
  N.forEach(function (n, i) { n.kids.forEach(function (c) { N[c].up = i; }); });
  var boxOf = function (i) { return N[i].box.slice(); };
  var api = HOLD.make(model(N, boxOf, cd));   // cd: the editor's shared.cd (state.js)
  api.N = N; api.boxOf = boxOf; api.cd = cd;
  return api;
}
module.exports = { model: model, editorOf: editorOf, HOLD: HOLD, LAY: LAY };
