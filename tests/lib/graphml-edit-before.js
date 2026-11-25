// The editor's GraphML reading and writing as they were before they moved into renderers/converter/graphml_edit.js
// (editor/src/core.js parse, write, setBoxes, insetsOf, setPorts, bend, unbend; graphml.js noNegative's shift;
// create.js tagTurnT's line end), each taken out of the editor as it stood and given the text in place of the map's
// shared state, nothing else changed: tests/graphml-edit.js runs each against the engine on every GraphML map, byte
// for byte. A reference kept for that test only; the editor's code is the engine's.
var G = 'http://graphml.graphdrawing.org/xmlns', Y = 'http://www.yworks.com/xml/graphml';
function num(el, a) { return parseFloat(el.getAttribute(a)); }
function fmt(v) { v = Math.round(v * 1000) / 1000; return v % 1 ? String(v) : v.toFixed(1); }   // as the engine since whole numbers are written as yEd writes them
function children(el) { return Array.prototype.filter.call(el.childNodes, function (c) { return c.nodeType === 1; }); }   // the browser's el.children
function realizerOf(el) {
  for (var i = 0; i < children(el).length; i++) {
    var dd = children(el)[i];
    if (dd.localName !== 'data') continue;
    for (var j = 0; j < children(dd).length; j++) {
      var r = children(dd)[j];
      if (r.namespaceURI !== Y) continue;
      if (r.localName === 'ProxyAutoBoundsNode') {
        var rs = r.getElementsByTagNameNS(Y, 'Realizers')[0];
        return rs ? children(rs)[parseInt(rs.getAttribute('active') || '0', 10)] || null : null;
      }
      return r;
    }
  }
  return null;
}
function shapeOf(r) {
  var props = {}, kind;
  Array.prototype.forEach.call(r.getElementsByTagNameNS(Y, 'Property'), function (p) {
    props[(p.getAttribute('name') || '').replace('com.yworks.sbgn.style.', '')] = p.getAttribute('value');
  });
  if (/^Generic/.test(r.localName)) kind = (r.getAttribute('configuration') || '').replace('com.yworks.sbgn.', '');
  else { var sh = r.getElementsByTagNameNS(Y, 'Shape')[0]; kind = sh ? sh.getAttribute('type') : 'rectangle'; }
  return { kind: kind, props: props };
}
// parse(), its reading: shared.cd as cd
function parse(text, doc, cd) {
  var geos = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Geometry'));
  var points = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Point'));
  if ((text.match(/<y:Geometry\s/g) || []).length !== geos.length || (text.match(/<y:Point\s/g) || []).length !== points.length)
    throw 'the file is not written as yEd writes it';
  var owner = function (e, tag) { for (var p = e.parentNode; p; p = p.parentNode) if (p.localName === tag && p.namespaceURI === G) return p; return null; };
  var gi = new Map(), byEl = new Map();
  geos.forEach(function (g, i) { gi.set(g, i); });
  var nodes2 = Array.prototype.slice.call(doc.getElementsByTagNameNS(G, 'node')).map(function (n, i) {
    byEl.set(n, i);
    return { el: n, id: n.getAttribute('id'), geo: [] };
  });
  geos.forEach(function (g, i) { var n = owner(g, 'node'); if (n && byEl.has(n)) nodes2[byEl.get(n)].geo.push(i); });
  nodes2 = nodes2.filter(function (n) { return n.geo.length; });
  byEl = new Map(); nodes2.forEach(function (n, i) { byEl.set(n.el, i); });
  nodes2.forEach(function (n) {
    n.inside = Array.prototype.slice.call(n.el.getElementsByTagNameNS(G, 'node')).map(function (c) { return byEl.get(c); }).filter(function (c) { return c != null; });
    n.kids = n.inside.filter(function (c) { return owner(nodes2[c].el, 'node') === n.el; });
    var r = realizerOf(n.el), g = r && r.getElementsByTagNameNS(Y, 'Geometry')[0];
    n.ag = g && gi.has(g) ? gi.get(g) : n.geo[0];
    n.shape = r ? shapeOf(r) : { kind: 'rectangle', props: {} };
    n.hub = !cd && /sbgn\.(Process|Operator)$/.test(r ? r.getAttribute('configuration') || '' : '');
    n.eq = n.hub && n.shape.kind === 'Operator' && Array.prototype.some.call(r.getElementsByTagNameNS(Y, 'NodeLabel'), function (l) { return l.textContent.trim() === '\u2261'; });
    n.up = null;
    n.comp = n.el.getAttribute('yfiles.foldertype') === 'group' && !/omplex/.test(r ? r.getAttribute('configuration') || '' : '');
    var ins = r && r.getElementsByTagNameNS(Y, 'Insets')[0], iv = function (k) { return ins ? parseFloat(ins.getAttribute(k + 'F') || ins.getAttribute(k)) || 0 : 0; };
    n.ins = [iv('left'), iv('top'), iv('right'), iv('bottom')];
    n.lab = { t: 0, b: 0 };
    if (r) children(r).forEach(function (l) {
      if (l.localName !== 'NodeLabel' || l.getAttribute('modelName') !== 'internal' || l.getAttribute('visible') === 'false') return;
      var side = (l.getAttribute('modelPosition') || '').charAt(0);
      if (side === 't' || side === 'b') n.lab[side] = Math.max(n.lab[side], parseFloat(l.getAttribute('height')) || 0);
      if (!n.labPos) n.labPos = l.getAttribute('modelPosition') || 'c';
    });
  });
  nodes2.forEach(function (n, i) { n.kids.forEach(function (c) { nodes2[c].up = i; }); });
  var byId = {}; nodes2.forEach(function (n, i) { byId[n.id] = i; });
  var pi = new Map(); points.forEach(function (p, i) { pi.set(p, i); });
  var edges2 = Array.prototype.slice.call(doc.getElementsByTagNameNS(G, 'edge')).map(function (e) {
    var ar = e.getElementsByTagNameNS(Y, 'Arrows')[0];
    return { id: e.getAttribute('id'), s: byId[e.getAttribute('source')], t: byId[e.getAttribute('target')], path: e.getElementsByTagNameNS(Y, 'Path')[0] || null,
             arr: ar ? [ar.getAttribute('source') || 'none', ar.getAttribute('target') || 'none'] : ['none', 'none'],
             pts: Array.prototype.slice.call(e.getElementsByTagNameNS(Y, 'Point')).map(function (p) { return pi.get(p); }),
             smooth: e.getElementsByTagNameNS(Y, 'QuadCurveEdge').length > 0 || Array.prototype.some.call(e.getElementsByTagNameNS(Y, 'BendStyle'), function (b) { return b.getAttribute('smoothed') === 'true'; }) };
  });
  var byE = {}; edges2.forEach(function (e, k) { byE[e.id] = k; });
  var procs = [];
  nodes2.forEach(function (n, i) {
    var m = n.id.match(/^(.*)\|proc$/);
    if (m && byE[m[1] + '|a'] != null && byE[m[1] + '|b'] != null) procs.push({ g: i, a: byE[m[1] + '|a'], b: byE[m[1] + '|b'] });
  });
  return { geos: geos, points: points, nodes: nodes2, edges: edges2, procs: procs };
}
function write(text, g, p) {
  var k = { 'Geometry': -1, 'Point': -1 };
  return text.replace(/<y:(Geometry|Point)\s[^>]*>/g, function (tag, kind) {
    var i = ++k[kind], v = (kind === 'Geometry' ? g : p)[i];
    if (!v) return tag;
    return tag.replace(/(\sx=")[^"]*"/, '$1' + v[0] + '"').replace(/(\sy=")[^"]*"/, '$1' + v[1] + '"');
  });
}
function insetsOf(text, id, ins, bins) {
  var q = id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  var m = new RegExp('<node(?=[\\s>/])[^>]*?\\sid="' + q + '"').exec(text);
  if (!m) return text;
  var rest = text.slice(m.index), own = rest.slice(0, Math.min.apply(null, [rest.search(/<graph(?=[\s>\/])/), rest.indexOf('</node>')].filter(function (k) { return k >= 0; }).concat([rest.length])));
  var act = /<y:Realizers\s[^>]*active="(\d+)"/.exec(own), k = act ? +act[1] : 0, put = [];
  [['Insets', ins], ['BorderInsets', bins]].forEach(function (q2) {
    var re = new RegExp('<y:' + q2[0] + '\\s[^>]*>', 'g'), x;
    for (var j = 0; (x = re.exec(own)) && j < k; j++);
    if (!x) return;
    var tag = x[0];
    ['left', 'top', 'right', 'bottom'].forEach(function (sd, j) {
      var v = q2[1][j];
      if (v == null) return;
      v = Math.round(v * 1000) / 1000;
      tag = tag.replace(new RegExp('(\\s' + sd + '=")[^"]*"'), '$1' + Math.round(v) + '"').replace(new RegExp('(\\s' + sd + 'F=")[^"]*"'), '$1' + (v % 1 ? String(v) : v + '.0') + '"');
    });
    if (tag !== x[0]) put.push([m.index + x.index, x[0].length, tag]);
  });
  put.sort(function (a, b) { return b[0] - a[0]; }).forEach(function (q2) { text = text.slice(0, q2[0]) + q2[2] + text.slice(q2[0] + q2[1]); });
  return text;
}
function setBoxes(text, at) {
  var i = -1;
  return text.replace(/<y:Geometry\s[^>]*>/g, function (tag) {
    var v = at[++i];
    if (v) ['x', 'y', 'width', 'height'].forEach(function (a, j) { tag = tag.replace(new RegExp('(\\s' + a + '=")[^"]*"'), '$1' + v[j] + '"'); });
    return tag;
  });
}
function setPorts(text, by, re) {
  var c = -1, ce = -1;
  if (re) text = text.replace(/<edge\b[^>]*>/g, function (tag) {
    return ++ce !== re.k ? tag : tag.replace(new RegExp('(\\s' + re.att + '\\s*=\\s*)("[^"]*"|\'[^\']*\')'), function (m, p1) { return p1 + '"' + re.id + '"'; });
  });
  return text.replace(/<y:Path\b[^>]*>/g, function (tag) {
    var kv = by.get(++c);
    if (!kv) return tag;
    kv.forEach(function (q) {
      var re = new RegExp('(\\s' + q[0] + '=")[^"]*"');
      tag = re.test(tag) ? tag.replace(re, '$1' + q[1] + '"') : tag.replace(/(\/?>)$/, ' ' + q[0] + '="' + q[1] + '"$1');
    });
    return tag;
  });
}
// bend(): e: { pts (point indices) }, pathNth: its y:Path's index, at: the segment's index, Q: the point
function bend(text, e, pathNth, at, Q) {
  var tag = '<y:Point x="' + fmt(Q[0]) + '" y="' + fmt(Q[1]) + '"/>';
  var nth = function (re, n) { var m, c = -1; re.lastIndex = 0; while ((m = re.exec(text))) if (++c === n) return m; return null; };
  var indent = function (pos) { var s0 = text.lastIndexOf('\n', pos - 1) + 1, w = text.slice(s0, pos).match(/^[ \t]*/)[0]; return w; };
  var m;
  if (at < e.pts.length) {
    m = nth(/<y:Point\s[^>]*>/g, e.pts[at]);
    return text.slice(0, m.index) + tag + '\n' + indent(m.index) + text.slice(m.index);
  } else if (e.pts.length) {
    m = nth(/<y:Point\s[^>]*>/g, e.pts[e.pts.length - 1]);
    var end = m.index + m[0].length;
    return text.slice(0, end) + '\n' + indent(m.index) + tag + text.slice(end);
  }
  m = nth(/<y:Path[\s>\/][^>]*>/g, pathNth);
  if (!m) return null;
  var w = indent(m.index), end2 = m.index + m[0].length;
  return /\/>$/.test(m[0])
    ? text.slice(0, m.index) + m[0].replace(/\s*\/>$/, '>') + '\n' + w + '  ' + tag + '\n' + w + '</y:Path>' + text.slice(end2)
    : text.slice(0, end2) + '\n' + w + '  ' + tag + text.slice(end2);
}
function unbend(text, list) {
  list = list.slice().sort(function (a, b) { return b - a; });
  var t = text;
  list.forEach(function (pi) {
    var re = /<y:Point\s[^>]*>/g, m, c = -1;
    while ((m = re.exec(t))) if (++c === pi) break;
    if (!m) return;
    var a = m.index, b = m.index + m[0].length;
    var s0 = t.lastIndexOf('\n', a - 1) + 1;
    if (/^[ \t]*$/.test(t.slice(s0, a)) && t[b] === '\n') { a = s0; b += 1; }
    t = t.slice(0, a) + t.slice(b);
  });
  return t;
}
function shiftTag(tag, sx, sy) {
  if (sx) tag = tag.replace(/(\sx=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sx) + '"'; });
  if (sy) tag = tag.replace(/(\sy=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sy) + '"'; });
  return tag;
}
// noNegative(): boxes of the nodes drawn and the bend points, the grid's block
function noNegative(text, bs, ps, B) {
  var mx = Infinity, my = Infinity, re = /<y:(?:Geometry|Point)\s[^>]*>/g;
  bs.forEach(function (b) { mx = Math.min(mx, b[0]); my = Math.min(my, b[1]); });
  ps.forEach(function (p) { mx = Math.min(mx, p[0]); my = Math.min(my, p[1]); });
  var block = function (m) { return m < 0 ? Math.ceil((40 - m) / B) * B : 0; }, sx = block(mx), sy = block(my);
  if (!sx && !sy) return null;
  return [text.replace(re, function (tag) { return shiftTag(tag, sx, sy); }), sx, sy];
}
// tagTurnT's line end: repr is sbgn_edit's
function tagEnd(t, id, end, p, repr) {
  var xid = id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return t.replace(new RegExp('(<edge id="' + xid + '"(?:(?!</edge>)[\\s\\S])*?<y:Path)([^>]*?)(/?>)'), function (m, a, at, close) {
    [[end ? 'tx' : 'sx', p[0]], [end ? 'ty' : 'sy', p[1]]].forEach(function (k) {
      var v = ' ' + k[0] + '="' + repr(k[1]) + '"', re = new RegExp('\\s' + k[0] + '="[^"]*"');
      at = re.test(at) ? at.replace(re, v) : at + v;
    });
    return a + at + close;
  });
}
module.exports = { parse: parse, write: write, insetsOf: insetsOf, setBoxes: setBoxes, setPorts: setPorts, bend: bend, unbend: unbend, noNegative: noNegative, tagEnd: tagEnd, num: num };
