// graphml_edit: the editor's GraphML (a yEd file, or the GraphML cd_edit and sbgn_edit make of a CellDesigner or
// SBGN-ML map) read and written as text, each function pure: text in, text out, the rest of the text byte for byte, as
// sbgn_edit and cd_edit do for their formats. The editor (editor/src/core.js, graphml.js) calls these and commits what
// they return; tests/graphml-edit.js runs them under Node on every GraphML map of the demo.
//   read(t, opt) -> { doc, geos, points, nodes, edges, procs }: every y:Geometry and y:Point in document order (their
//     order in the text, which the writers below count by), the nodes with a geometry (id, the realizer's geometry
//     shown ag, what they hold, shape, a process or gate hub, insets, labels inside), the edges (source and target node
//     indices, path, arrows, bend point indices, smoothed), a CellDesigner reaction's process glyph with its two base
//     lines. opt.DOMParser (the browser's by default), opt.doc (a document of t already read), opt.cd (CellDesigner's
//     GraphML: no hubs). Throws 'not a readable XML file' or 'the file is not written as yEd writes it'.
//   place(t, g, p): new x and y for some y:Geometry (index -> [x, y] as text) and y:Point, in one pass.
//   boxes(t, at): new x, y, width and height for some y:Geometry (index -> four texts).
//   insets(t, id, ins, bins): the y:Insets (a null side kept) and y:BorderInsets of node id's realizer shown, each side's whole number cut as yEd writes it (6 beside 6.5).
//   ends(t, by, re): line ends, by: path index (its y:Path in the text) -> [[attribute, value], ...], an attribute
//     missing added; re { k, att, id }: edge k's source or target set to node id too. pathOf(t, id, kv): edge id's own
//     y:Path given these attributes, one missing added at its end.
//   bend(t, at, x, y): a y:Point put in as yEd writes one: at { before: point index } on a line of its own before it,
//     { after: point index } after it, { path: path index } the path's first (a y:Path closed in itself opened).
//   unbend(t, list): the y:Points of these indices taken out (a line of its own goes whole).
//   shift(t, sx, sy): every y:Geometry and y:Point moved by sx, sy (only the axis shifted is written); shiftOf(boxes,
//     points, block): the shift out of negative places, by whole blocks, to start at 40 or a little more.
(function (root) {
  'use strict';
  var G = 'http://graphml.graphdrawing.org/xmlns', Y = 'http://www.yworks.com/xml/graphml';
  function els(el) { return el.children ? Array.prototype.slice.call(el.children) : Array.prototype.filter.call(el.childNodes, function (c) { return c.nodeType === 1; }); }   // the browser's children, else the element nodes
  function num(el, a) { return parseFloat(el.getAttribute(a)); }
  function fmt(v) { v = Math.round(v * 1000) / 1000; return v % 1 ? String(v) : v.toFixed(1); }   // a whole number as yEd writes it (603.0)
  function realizerOf(el) {   // the node's own yEd realizer (of a group: the one shown)
    var cs = els(el);
    for (var i = 0; i < cs.length; i++) {
      var dd = cs[i];
      if (dd.localName !== 'data') continue;
      var rs0 = els(dd);
      for (var j = 0; j < rs0.length; j++) {
        var r = rs0[j];
        if (r.namespaceURI !== Y) continue;
        if (r.localName === 'ProxyAutoBoundsNode') {
          var rs = r.getElementsByTagNameNS(Y, 'Realizers')[0];
          return rs ? els(rs)[parseInt(rs.getAttribute('active') || '0', 10)] || null : null;
        }
        return r;
      }
    }
    return null;
  }
  function shapeOf(r) {   // as the yEd renderer reads it: the SBGN style or the plain shape, and the style's numbers
    var props = {}, kind;
    Array.prototype.forEach.call(r.getElementsByTagNameNS(Y, 'Property'), function (p) {
      props[(p.getAttribute('name') || '').replace('com.yworks.sbgn.style.', '')] = p.getAttribute('value');
    });
    if (/^Generic/.test(r.localName)) kind = (r.getAttribute('configuration') || '').replace('com.yworks.sbgn.', '');
    else { var sh = r.getElementsByTagNameNS(Y, 'Shape')[0]; kind = sh ? sh.getAttribute('type') : 'rectangle'; }
    return { kind: kind, props: props };
  }
  function read(t, opt) {
    opt = opt || {};
    var doc = opt.doc;
    if (!doc) {
      var DP = opt.DOMParser || root.DOMParser, bad = false;
      if (!DP) throw 'no DOMParser (under Node: opt.DOMParser)';
      try { doc = new DP({ onError: function (l) { if (l !== 'warning') bad = true; } }).parseFromString(t, 'application/xml'); } catch (e) { bad = true; }
      if (bad || !doc || !doc.documentElement) throw 'not a readable XML file';
    }
    if (doc.getElementsByTagName('parsererror').length) throw 'not a readable XML file';
    var geos = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Geometry'));
    var points = Array.prototype.slice.call(doc.getElementsByTagNameNS(Y, 'Point'));
    if ((t.match(/<y:Geometry\s/g) || []).length !== geos.length || (t.match(/<y:Point\s/g) || []).length !== points.length)
      throw 'the file is not written as yEd writes it';
    var owner = function (e, tag) { for (var p = e.parentNode; p; p = p.parentNode) if (p.localName === tag && p.namespaceURI === G) return p; return null; };
    var gi = new Map(), byEl = new Map();
    geos.forEach(function (g, i) { gi.set(g, i); });
    var nodes = Array.prototype.slice.call(doc.getElementsByTagNameNS(G, 'node')).map(function (n, i) {
      byEl.set(n, i);
      return { el: n, id: n.getAttribute('id'), geo: [] };
    });
    geos.forEach(function (g, i) { var n = owner(g, 'node'); if (n && byEl.has(n)) nodes[byEl.get(n)].geo.push(i); });
    nodes = nodes.filter(function (n) { return n.geo.length; });
    byEl = new Map(); nodes.forEach(function (n, i) { byEl.set(n.el, i); });
    nodes.forEach(function (n) {   // a group moves with what it holds, as in yEd
      n.inside = Array.prototype.slice.call(n.el.getElementsByTagNameNS(G, 'node')).map(function (c) { return byEl.get(c); }).filter(function (c) { return c != null; });
      n.kids = n.inside.filter(function (c) { return owner(nodes[c].el, 'node') === n.el; });
      var r = realizerOf(n.el), g = r && r.getElementsByTagNameNS(Y, 'Geometry')[0];
      n.ag = g && gi.has(g) ? gi.get(g) : n.geo[0];   // the geometry of the realizer shown (a group open or closed)
      n.shape = r ? shapeOf(r) : { kind: 'rectangle', props: {} };
      n.hub = !opt.cd && /sbgn\.(Process|Operator)$/.test(r ? r.getAttribute('configuration') || '' : '');   // a process or logic gate: one object with its two ports
      n.eq = n.hub && n.shape.kind === 'Operator' && Array.prototype.some.call(r.getElementsByTagNameNS(Y, 'NodeLabel'), function (l) { return l.textContent.trim() === '\u2261'; });   // an equivalence gate (yrender's eq)
      n.up = null;
      n.comp = n.el.getAttribute('yfiles.foldertype') === 'group' && !/omplex/.test(r ? r.getAttribute('configuration') || '' : '');
      var ins = r && r.getElementsByTagNameNS(Y, 'Insets')[0], iv = function (k) { return ins ? parseFloat(ins.getAttribute(k + 'F') || ins.getAttribute(k)) || 0 : 0; };
      n.ins = [iv('left'), iv('top'), iv('right'), iv('bottom')];
      n.lab = { t: 0, b: 0 };   // its own labels inside, at the top or the bottom (as the layout skill's room())
      if (r) els(r).forEach(function (l) {
        if (l.localName !== 'NodeLabel' || l.getAttribute('modelName') !== 'internal' || l.getAttribute('visible') === 'false') return;
        var side = (l.getAttribute('modelPosition') || '').charAt(0);
        if (side === 't' || side === 'b') n.lab[side] = Math.max(n.lab[side], parseFloat(l.getAttribute('height')) || 0);
        if (!n.labPos) n.labPos = l.getAttribute('modelPosition') || 'c';
      });
    });
    nodes.forEach(function (n, i) { n.kids.forEach(function (c) { nodes[c].up = i; }); });
    var byId = {}; nodes.forEach(function (n, i) { byId[n.id] = i; });
    var pi = new Map(); points.forEach(function (p, i) { pi.set(p, i); });
    var edges = Array.prototype.slice.call(doc.getElementsByTagNameNS(G, 'edge')).map(function (e) {
      var ar = e.getElementsByTagNameNS(Y, 'Arrows')[0];
      return { id: e.getAttribute('id'), s: byId[e.getAttribute('source')], t: byId[e.getAttribute('target')], path: e.getElementsByTagNameNS(Y, 'Path')[0] || null,
               arr: ar ? [ar.getAttribute('source') || 'none', ar.getAttribute('target') || 'none'] : ['none', 'none'],
               pts: Array.prototype.slice.call(e.getElementsByTagNameNS(Y, 'Point')).map(function (p) { return pi.get(p); }),
               smooth: e.getElementsByTagNameNS(Y, 'QuadCurveEdge').length > 0 || Array.prototype.some.call(e.getElementsByTagNameNS(Y, 'BendStyle'), function (b) { return b.getAttribute('smoothed') === 'true'; }) };
    });
    var byE = {}; edges.forEach(function (e, k) { byE[e.id] = k; });
    var procs = [];
    nodes.forEach(function (n, i) {
      var m = n.id.match(/^(.*)\|proc$/);
      if (m && byE[m[1] + '|a'] != null && byE[m[1] + '|b'] != null) procs.push({ g: i, a: byE[m[1] + '|a'], b: byE[m[1] + '|b'] });
    });
    return { doc: doc, geos: geos, points: points, nodes: nodes, edges: edges, procs: procs };
  }
  function place(t, g, p) {
    var k = { 'Geometry': -1, 'Point': -1 };
    return t.replace(/<y:(Geometry|Point)\s[^>]*>/g, function (tag, kind) {
      var i = ++k[kind], v = (kind === 'Geometry' ? g : p)[i];
      if (!v) return tag;
      return tag.replace(/(\sx=")[^"]*"/, '$1' + v[0] + '"').replace(/(\sy=")[^"]*"/, '$1' + v[1] + '"');
    });
  }
  function boxes(t, at) {
    var i = -1;
    return t.replace(/<y:Geometry\s[^>]*>/g, function (tag) {
      var v = at[++i];
      if (v) ['x', 'y', 'width', 'height'].forEach(function (a, j) { tag = tag.replace(new RegExp('(\\s' + a + '=")[^"]*"'), '$1' + v[j] + '"'); });
      return tag;
    });
  }
  function insets(t, id, ins, bins) {
    var q = id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    var m = new RegExp('<node(?=[\\s>/])[^>]*?\\sid="' + q + '"').exec(t);
    if (!m) return t;
    var rest = t.slice(m.index), own = rest.slice(0, Math.min.apply(null, [rest.search(/<graph(?=[\s>\/])/), rest.indexOf('</node>')].filter(function (k) { return k >= 0; }).concat([rest.length])));
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
        tag = tag.replace(new RegExp('(\\s' + sd + '=")[^"]*"'), '$1' + Math.trunc(v) + '"').replace(new RegExp('(\\s' + sd + 'F=")[^"]*"'), '$1' + (v % 1 ? String(v) : v + '.0') + '"');
      });
      if (tag !== x[0]) put.push([m.index + x.index, x[0].length, tag]);
    });
    put.sort(function (a, b) { return b[0] - a[0]; }).forEach(function (q2) { t = t.slice(0, q2[0]) + q2[2] + t.slice(q2[0] + q2[1]); });
    return t;
  }
  function ends(t, by, re) {
    var c = -1, ce = -1;
    if (re) t = t.replace(/<edge\b[^>]*>/g, function (tag) {
      return ++ce !== re.k ? tag : tag.replace(new RegExp('(\\s' + re.att + '\\s*=\\s*)("[^"]*"|\'[^\']*\')'), function (m, p1) { return p1 + '"' + re.id + '"'; });
    });
    return t.replace(/<y:Path\b[^>]*>/g, function (tag) {
      var kv = by.get(++c);
      if (!kv) return tag;
      kv.forEach(function (q) {
        var r = new RegExp('(\\s' + q[0] + '=")[^"]*"');
        tag = r.test(tag) ? tag.replace(r, '$1' + q[1] + '"') : tag.replace(/(\/?>)$/, ' ' + q[0] + '="' + q[1] + '"$1');
      });
      return tag;
    });
  }
  function pathOf(t, id, kv) {   // edge id's own y:Path given these attributes ([[name, value], ...]), one missing added at its end
    var xid = id.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp('(<edge id="' + xid + '"(?:(?!</edge>)[\\s\\S])*?<y:Path)([^>]*?)(/?>)'), function (m, a, at, close) {
      kv.forEach(function (k) {
        var v = ' ' + k[0] + '="' + k[1] + '"', re = new RegExp('\\s' + k[0] + '="[^"]*"');
        at = re.test(at) ? at.replace(re, v) : at + v;
      });
      return a + at + close;
    });
  }
  function bend(t, at, x, y) {
    var tag = '<y:Point x="' + fmt(x) + '" y="' + fmt(y) + '"/>';
    var nth = function (re, n) { var m, c = -1; re.lastIndex = 0; while ((m = re.exec(t))) if (++c === n) return m; return null; };
    var indent = function (pos) { var s0 = t.lastIndexOf('\n', pos - 1) + 1; return t.slice(s0, pos).match(/^[ \t]*/)[0]; };
    var m;
    if (at.before != null) {   // before a bend the arc has: on a line of its own, as that one
      m = nth(/<y:Point\s[^>]*>/g, at.before);
      if (!m) return null;
      return t.slice(0, m.index) + tag + '\n' + indent(m.index) + t.slice(m.index);
    }
    if (at.after != null) {   // after its last bend
      m = nth(/<y:Point\s[^>]*>/g, at.after);
      if (!m) return null;
      var end = m.index + m[0].length;
      return t.slice(0, end) + '\n' + indent(m.index) + tag + t.slice(end);
    }
    m = nth(/<y:Path[\s>\/][^>]*>/g, at.path);   // its first bend: inside the y:Path, opened if it closes in itself
    if (!m) return null;
    var w = indent(m.index), end2 = m.index + m[0].length;
    return /\/>$/.test(m[0])
      ? t.slice(0, m.index) + m[0].replace(/\s*\/>$/, '>') + '\n' + w + '  ' + tag + '\n' + w + '</y:Path>' + t.slice(end2)
      : t.slice(0, end2) + '\n' + w + '  ' + tag + t.slice(end2);
  }
  function unbend(t, list) {
    list = list.slice().sort(function (a, b) { return b - a; });   // last first, so the earlier ones keep their place in the text
    list.forEach(function (pi) {
      var re = /<y:Point\s[^>]*>/g, m, c = -1;
      while ((m = re.exec(t))) if (++c === pi) break;
      if (!m) return;
      var a = m.index, b = m.index + m[0].length;
      var s0 = t.lastIndexOf('\n', a - 1) + 1;
      if (/^[ \t]*$/.test(t.slice(s0, a)) && t[b] === '\n') { a = s0; b += 1; }   // on a line of its own: the line goes
      t = t.slice(0, a) + t.slice(b);
    });
    return t;
  }
  function shiftTag(tag, sx, sy) {   // only the axis shifted is written (an SBGN-ML map's other numbers stay as they are)
    if (sx) tag = tag.replace(/(\sx=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sx) + '"'; });
    if (sy) tag = tag.replace(/(\sy=")([^"]*)"/, function (a, k, v) { return k + fmt(parseFloat(v) + sy) + '"'; });
    return tag;
  }
  function shift(t, sx, sy) { return !sx && !sy ? t : t.replace(/<y:(?:Geometry|Point)\s[^>]*>/g, function (tag) { return shiftTag(tag, sx, sy); }); }
  function shiftOf(bs, ps, block) {   // bs: the boxes drawn ([x, y, ...]), ps: the bend points ([x, y]); [sx, sy], or null when nothing moves
    var mx = Infinity, my = Infinity;
    bs.concat(ps).forEach(function (b) { mx = Math.min(mx, b[0]); my = Math.min(my, b[1]); });
    var by = function (m) { return m < 0 ? Math.ceil((40 - m) / block) * block : 0; }, sx = by(mx), sy = by(my);
    return sx || sy ? [sx, sy] : null;
  }
  var api = { G: G, Y: Y, read: read, realizerOf: realizerOf, place: place, boxes: boxes, insets: insets, ends: ends, pathOf: pathOf, bend: bend, unbend: unbend,
              shift: shift, shiftOf: shiftOf, fmt: fmt, num: num };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.graphml_edit = api;
})(typeof self !== 'undefined' ? self : this);
