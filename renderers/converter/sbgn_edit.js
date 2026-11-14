// sbgn_edit (2026-11-14): an SBGN-ML map edited as the GraphML the converter makes of it (its copy in mapconv/:
// sbgnml.read, then graphml.write), as cd_edit does for CellDesigner. The converter keeps the glyph ids as the node ids
// and the arc ids as the edge ids, every box as the file's bbox, so the two files map number for number:
//   graphml(sbgnText, baseGraphml, opt) -> the GraphML of sbgnText, made from baseGraphml (the converter's GraphML of
//     a version of the same file, moves apart): the places read as sbgnml.read reads them, written as graphml.write
//     writes them (repr of each float), the rest of baseGraphml byte for byte. graphml(s, conv(s)) is conv(s).
//   write(sbgnText, graphmlText, opt) -> sbgnText with the places of graphmlText: only the numbers that change (the
//     bbox of a glyph moved or resized, of what it carries: its state variables, units of information, label, ports
//     no arc names; an arc's start, end and next points; a port's place), the rest byte for byte, so other tools open
//     it as before. write(s, conv(s)) is s. An arc end at the glyph's centre in the GraphML (0, 0) is written where the
//     line toward its next point leaves the glyph's box (the file's own end kept, or carried with a move, while it
//     still lies on that line: Newt stops short of the glyph for the arrowhead); any other end where the GraphML has
//     it. A process or logic gate is one object with its two ports (user, 2026-11-14): its arcs at a port give the
//     port's place; a glyph with ports in the GraphML but none in the file gets them (<port> after its bbox, its id
//     with .1 for the consumptions, .2 for the products, the arcs pointed at them), so a turned process keeps its turn.
//   tests/sbgn-edit.js checks both ways against the converter on every SBGN-ML map of the demo.
// Glyphs the converter leaves out (tags, terminals, clone markers have no box) and arcs to them are not moved.
(function (root) {
  'use strict';
  var YNS = 'http://www.yworks.com/xml/graphml', GNS = 'http://graphml.graphdrawing.org/xmlns';
  function DP(opt) { return (opt && opt.DOMParser) || root.DOMParser; }
  function kids(el, name) { var out = []; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (!name || c.localName === name)) out.push(c); return out; }
  function kid(el, name) { return kids(el, name)[0] || null; }
  function F(v) { return parseFloat(v); }
  // Python's repr of a float (graphml.write writes every number so)
  function repr(v) {
    if (v === 0) return 1 / v < 0 ? '-0.0' : '0.0';
    var a = Math.abs(v);
    if (a >= 1e16 || a < 1e-4) {
      var e = v.toExponential(), m = e.match(/^(-?[\d.]+)e([+-])(\d+)$/);
      return m[1] + 'e' + m[2] + (m[3].length < 2 ? '0' : '') + m[3];
    }
    var s = String(v);
    return /[.e]/.test(s) ? s : s + '.0';
  }
  // an attribute's value as XML text (an id may hold & < > ")
  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // the element before el among its parent's children (the start before an arc's first next)
  function prevEl(el) { var p = el.previousSibling; while (p && p.nodeType !== 1) p = p.previousSibling; return p; }
  // a number written into the SBGN-ML file: four places at most, as short as it goes
  function num(v) { var r = Math.round(v * 10000) / 10000; return String(r === 0 ? 0 : r); }

  // the start tags of a text in document order, which is the order of its elements (getElementsByTagName('*')), and
  // edits by element: an attribute's value set, a span replaced; applied from the end, so every place stays valid
  function Tags(t, doc) {
    this.t = t; this.ed = []; this.at = new Map();
    var re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/[^>]*>|<([A-Za-z_][^\s/>]*)(?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*(\/?)>/g, m, list = [];
    while ((m = re.exec(t))) if (m[1]) list.push([m.index, m.index + m[0].length, !!m[2]]);
    var all = doc.getElementsByTagName('*');
    if (all.length !== list.length) throw new Error('the file is not read tag for tag');
    for (var i = 0; i < all.length; i++) this.at.set(all[i], list[i]);
  }
  Tags.prototype.set = function (el, k, v) {   // the attribute's value, added before the tag's end when missing
    v = esc(v);
    var s = this.at.get(el), tag = this.t.slice(s[0], s[1]), re = new RegExp('(\\s' + k.replace(/[.:]/g, '\\$&') + '\\s*=\\s*)("[^"]*"|\'[^\']*\')'), m = tag.match(re);
    if (m) { var from = s[0] + m.index + m[1].length; this.ed.push([from, from + m[2].length, '"' + v + '"']); }
    else { var end = s[1] - (s[2] ? 2 : 1); this.ed.push([end, end, ' ' + k + '="' + v + '"']); }
  };
  Tags.prototype.unset = function (el, k) {   // the attribute taken out, where the tag has it
    var s = this.at.get(el), tag = this.t.slice(s[0], s[1]), m = tag.match(new RegExp('\\s+' + k.replace(/[.:]/g, '\\$&') + '\\s*=\\s*("[^"]*"|\'[^\']*\')'));
    if (m) this.ed.push([s[0] + m.index, s[0] + m.index + m[0].length, '']);
  };
  Tags.prototype.end = function (el) {   // where the element ends (a self-closed tag, or its end tag)
    var s = this.at.get(el);
    if (s[2]) return s[1];
    var name = this.t.slice(s[0] + 1).match(/^[^\s/>]+/)[0], re = new RegExp('<(/?)' + name.replace(/[.:]/g, '\\$&') + '(?=[\\s/>])[^>]*?(/?)>', 'g'), m, depth = 1;   // nested ones of the same name (a group's graph) counted
    re.lastIndex = s[1];
    while ((m = re.exec(this.t))) { if (m[1]) depth--; else if (!m[2]) depth++; if (!depth) return m.index + m[0].length; }
    return this.t.length;
  };
  Tags.prototype.indent = function (el) { var s = this.at.get(el), i = this.t.lastIndexOf('\n', s[0]); return this.t.slice(i + 1, s[0]).match(/^\s*/)[0]; };
  Tags.prototype.text = function () {
    var t = this.t;
    this.ed.sort(function (a, b) { return b[0] - a[0] || b[1] - a[1]; }).forEach(function (e) { t = t.slice(0, e[0]) + e[2] + t.slice(e[1]); });
    return t;
  };

  Tags.prototype.cut = function (el) {   // the element taken out, with the line it stood on when it stood alone there
    var s = this.at.get(el), i = this.t.lastIndexOf('\n', s[0] - 1), from = /^\s*$/.test(this.t.slice(i + 1, s[0])) && i >= 0 ? i : s[0];
    this.ed.push([from, this.end(el), '']);
  };
  // glyphs deleted in the editor (user, 2026-11-14): their ids kept in a comment at the end of the editor's GraphML, so
  // write() takes them out of the file (a glyph the GraphML lacks is no proof: the converter leaves some out)
  var GONE = /<!-- deleted: ([^>]*?) -->/;
  function gone(gtext) { var m = gtext.match(GONE); return m ? m[1].split(' ').map(decodeURIComponent) : []; }
  function goneMark(t, ids) {   // the ids added to the comment (encoded: an id with -- would end the comment)
    var all = gone(t).concat(ids).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    var mark = '<!-- deleted: ' + all.map(function (x) { return encodeURIComponent(x).replace(/-/g, '%2D'); }).join(' ') + ' -->';
    return GONE.test(t) ? t.replace(GONE, mark) : t.replace(/\s*$/, '\n' + mark + '\n');
  }

  // ---------- the SBGN-ML side, read as sbgnml.read reads it ----------
  function sbgn(t, opt) {
    var doc = new (DP(opt))().parseFromString(t.replace(/^\ufeff/, ''), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('not a readable SBGN-ML file');
    var map = kids(doc.documentElement, 'map')[0], S = { doc: doc, glyph: {}, port: {}, portOf: {}, arc: {} };
    var walk = function (g) {
      var i = g.getAttribute('id'), b = kid(g, 'bbox');
      if (i && b) S.glyph[i] = { el: g, bbox: b, box: ['x', 'y', 'w', 'h'].map(function (k) { return F(b.getAttribute(k)); }) };
      kids(g, 'port').forEach(function (p) { S.port[p.getAttribute('id')] = p; S.portOf[p.getAttribute('id')] = i; });
      kids(g, 'glyph').forEach(walk);
    };
    kids(map, 'glyph').forEach(walk);
    kids(map, 'arc').forEach(function (a) { S.arc[a.getAttribute('id')] = a; });
    return S;
  }
  function xy(el) { return el ? [F(el.getAttribute('x')), F(el.getAttribute('y'))] : null; }
  function centre(b) { return [b[0] + b[2] / 2, b[1] + b[3] / 2]; }
  // sbgnml.at: where an arc meets its glyph, from the glyph's centre
  function at(S, gid, ref, p, q, flux) {   // flux false: an arc ending at a port that is not a consumption's or a gate input's (a modifier), read as the centre
    var c = centre(S.glyph[gid].box);
    if (ref !== gid) { var P = flux !== false && xy(S.port[ref]); return P ? [P[0] - c[0], P[1] - c[1]] : [0, 0]; }
    if (!p || !q) return [0, 0];
    var ux = q[0] - c[0], uy = q[1] - c[1], vx = p[0] - c[0], vy = p[1] - c[1], n = Math.hypot(ux, uy);
    if (!n || (Math.abs(ux * vy - uy * vx) / n <= 1.5 && ux * vx + uy * vy >= 0)) return [0, 0];
    return [vx, vy];
  }
  function flux(a) { return /^(consumption|logic arc)$/.test(a.getAttribute('class')); }   // sbgnml.read's flux
  function ends(S, a) {   // [glyph of the source, of the target, the file's start, end, next points]
    var s = a.getAttribute('source'), t = a.getAttribute('target');
    return [S.portOf[s] || s, S.portOf[t] || t, xy(kid(a, 'start')), xy(kid(a, 'end')), kids(a, 'next').map(xy)];
  }

  // ---------- the GraphML side ----------
  function realizer(n) {   // the node's realizer shown (a group's active one), as graphml.realizer and the editor take it
    var dd = kids(n, 'data');
    for (var i = 0; i < dd.length; i++) {
      var r = kids(dd[i]).filter(function (c) { return c.namespaceURI === YNS; })[0];
      if (!r) continue;
      if (r.localName === 'ProxyAutoBoundsNode') { var rs = r.getElementsByTagNameNS(YNS, 'Realizers')[0]; return rs ? kids(rs)[parseInt(rs.getAttribute('active') || '0', 10)] : null; }
      return r;
    }
    return null;
  }
  function gml(t, opt) {
    var doc = new (DP(opt))().parseFromString(t, 'application/xml'), G = { doc: doc, node: {}, edge: {}, ids: [] };
    Array.prototype.forEach.call(doc.getElementsByTagNameNS(GNS, 'node'), function (n) {
      var r = realizer(n), geo = r && kid(r, 'Geometry');
      if (geo) G.ids.push(n.getAttribute('id'));
      if (geo) G.node[n.getAttribute('id')] = { el: n, geo: geo, box: ['x', 'y', 'width', 'height'].map(function (k) { return F(geo.getAttribute(k)); }) };
    });
    Array.prototype.forEach.call(doc.getElementsByTagNameNS(GNS, 'edge'), function (e) {
      var path = e.getElementsByTagNameNS(YNS, 'Path')[0];
      if (!path) return;
      G.edge[e.getAttribute('id')] = { el: e, path: path, s: e.getAttribute('source'), t: e.getAttribute('target'),
        off: ['sx', 'sy', 'tx', 'ty'].map(function (k) { return F(path.getAttribute(k)) || 0; }),
        pts: kids(path, 'Point').map(xy), ptEl: kids(path, 'Point') };
    });
    return G;
  }

  // the GraphML of sbgnText: baseGraphml with the places sbgnml.read takes from sbgnText (graphml.write's numbers)
  function graphml(t, base, opt) {
    var S = sbgn(t, opt), G = gml(base, opt), T = new Tags(base, G.doc), out = {};
    Object.keys(G.node).forEach(function (id) {   // a glyph deleted in the editor: its node and lines out
      var cfg = (G.node[id].geo.parentNode.getAttribute('configuration') || '').replace('com.yworks.sbgn.', '');
      if (S.glyph[id] || S.port[id] || S.arc[id] || id.indexOf('|') >= 0 || !Object.keys(MAKE).some(function (c) { return MAKE[c] === cfg; })) return;
      out[id] = 1; T.cut(G.node[id].el);
    });
    Object.keys(G.edge).forEach(function (id) { var e = G.edge[id]; if ((out[e.s] || out[e.t]) && !S.arc[id]) T.cut(e.el); });
    Object.keys(G.node).forEach(function (id) {
      var g = S.glyph[id], n = G.node[id];
      if (!g) return;
      var B = g.box, w = B[2], h = B[3], to = function (el, k, v) { if (el.getAttribute(k) !== v) T.set(el, k, v); };
      ['x', 'y', 'width', 'height'].forEach(function (k, j) { to(n.geo, k, repr(B[j])); });
      // what graphml.write works out from the box: the state variables' places (their ratios read from the file as
      // sbgnml.read reads them), the units of information spread evenly along the top (graphml.write, whatever the
      // file's places), a compartment's name where the file has it. Counted by kind: one deleted in the editor is cut
      var r = n.geo.parentNode, labs = kids(r, 'NodeLabel'), icons = labs.filter(function (l) { return l.getAttribute('iconData'); });
      var states = kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; }), units = unitsOf(g.el), js = 0, ju = 0;
      var R = G.R || (G.R = resources(G));
      icons.forEach(function (l) {
        var p = l.getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0], kind = (R[l.getAttribute('iconData')] || {}).kind, rx, ry, j;
        if (!p) return;
        if (kind === 'StateVariable') {
          if ((j = js++) >= states.length) { T.cut(l); return; }   // deleted in the editor
          var cb = kid(states[j], 'bbox'), cx = F(cb.getAttribute('x')) + F(cb.getAttribute('w')) / 2, cy = F(cb.getAttribute('y')) + F(cb.getAttribute('h')) / 2;
          rx = (cx - B[0] - w / 2) / w; ry = (cy - B[1] - h / 2) / h;
          to(p, 'nodeRatioX', repr(rx)); to(p, 'nodeRatioY', repr(ry));
        } else if (kind === 'UnitOfInformation') {
          if ((j = ju++) >= units.length) { T.cut(l); return; }
          rx = uRatio(j, units.length); ry = -0.5;
          to(p, 'nodeRatioX', repr(rx)); to(p, 'nodeRatioY', repr(ry));
        } else { rx = F(p.getAttribute('nodeRatioX')); ry = F(p.getAttribute('nodeRatioY')); }
        to(l, 'x', repr((0.5 + rx) * w - F(l.getAttribute('width')) / 2)); to(l, 'y', repr((0.5 + ry) * h - F(l.getAttribute('height')) / 2));
      });
      if (g.el.getAttribute('class') === 'compartment') {
        var l = labs.filter(function (x) { return !x.getAttribute('iconData'); })[0], lab = kid(g.el, 'label'), lb = lab && kid(lab, 'bbox');
        if (!l) return;
        var lw = F(l.getAttribute('width'));
        if (!lb) { to(l, 'x', repr((w - lw) / 2)); to(l, 'y', '0.0'); return; }
        var lx = F(lb.getAttribute('x')) - B[0], ly = F(lb.getAttribute('y')) - B[1], bd = Math.max(0, ly), mid = (lx + lw / 2) / w;
        to(l, 'x', repr(lx)); to(l, 'y', repr(ly));
        to(l, 'modelPosition', lw + 2 * bd > w ? 't' : mid < 1 / 3 ? 'tl' : mid > 2 / 3 ? 'tr' : 't'); to(l, 'borderDistance', repr(bd));
      }
    });
    Object.keys(G.edge).forEach(function (id) {
      var a = S.arc[id], e = G.edge[id];
      if (!a) return;
      var E = ends(S, a), pts = E[4];
      [['source', 's', 0], ['target', 't', 1]].forEach(function (q) {   // an end moved to another glyph in the editor: that glyph
        if (E[q[2]] !== e[q[1]] && G.node[E[q[2]]] && G.node[e[q[1]]]) { T.set(e.el, q[0], E[q[2]]); e[q[1]] = E[q[2]]; }
      });
      if (E[0] !== e.s || E[1] !== e.t || !S.glyph[E[0]] || !S.glyph[E[1]]) return;   // an activity's arcs moved to its entity: as the converter left them
      var o = at(S, E[0], a.getAttribute('source'), E[2], (pts.length ? pts : [E[3]])[0])
        .concat(at(S, E[1], a.getAttribute('target'), E[3], (pts.length ? pts[pts.length - 1] : E[2]), flux(a)));
      ['sx', 'sy', 'tx', 'ty'].forEach(function (k, j) { if (repr(o[j]) !== e.path.getAttribute(k)) T.set(e.path, k, repr(o[j])); });
      var same = pts.length === e.pts.length && pts.every(function (p, j) { return repr(p[0]) === e.ptEl[j].getAttribute('x') && repr(p[1]) === e.ptEl[j].getAttribute('y'); });
      if (same) return;
      // as lxml writes them: the points on the path's line, a path with none closed in itself
      var body = pts.map(function (p) { return '<y:Point x="' + repr(p[0]) + '" y="' + repr(p[1]) + '"/>'; }).join(''), s = T.at.get(e.path);
      T.ed.push([s[1] - (s[2] ? 2 : 1), T.end(e.path), body ? '>' + body + '</y:Path>' : '/>']);
    });
    return made(S, G, T.text(), t, opt);
  }
  // what the editor made or renamed that the base GraphML lacks (a draft reopened before the build has drawn it)
  function made(S, G, out, t, opt) {
    var St = null, D = null, H = null, Hfor = null;   // the output read again only after it changed (the review: a reading per glyph froze a 2 MB map for minutes)
    var svOf = function (g) {   // a glyph's state variables: [text, rx, ry]
      var B = g.box;
      return kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; }).map(function (c) {
        var st = kid(c, 'state'), cb = kid(c, 'bbox'), cx = F(cb.getAttribute('x')) + F(cb.getAttribute('w')) / 2, cy = F(cb.getAttribute('y')) + F(cb.getAttribute('h')) / 2;
        return [st ? svText(st.getAttribute('value'), st.getAttribute('variable')) : '', (cx - B[0] - B[2] / 2) / B[2], (cy - B[1] - B[3] / 2) / B[3]];
      });
    };
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], cls = g.el.getAttribute('class') || '', lab = kid(g.el, 'label'), name = lab ? lab.getAttribute('text') || '' : '';
      if (!G.node[id]) {
        var base = cls.replace(/ multimer$/, '');
        if (!MAKE[base] || g.el.parentNode.localName !== 'map') return;
        St = St || styles(S); D = D || {}; D[base] = D[base] || defaults(t, opt, base);
        var st = St.filter(function (x) { return x.ids.indexOf(id) >= 0; })[0], cref = g.el.getAttribute('compartmentRef');
        out = add(out, { id: id, cls: base, label: name, box: g.box, parent: cref && S.glyph[cref] ? cref : null, fill: st ? st.fill : null, font: st && st.font || D[base].font,
                         states: svOf(g), units: unitsOf(g.el).map(unitText), multimer: fileMulti(g.el) }, opt);
        return;
      }
      if (!NAMED.test(cls)) return;
      if (Hfor !== out) { H = gml(out, opt); Hfor = out; }
      var L = labelsOf(H, id);
      if (L.main && ownText(L.main) !== name) out = label(out, id, name, opt);
      var svs = L.icons.filter(function (q) { return q[1].kind === 'StateVariable'; }), uis = L.icons.filter(function (q) { return q[1].kind === 'UnitOfInformation'; });
      var multi = isMulti(H, id);
      svOf(g).forEach(function (q, j) {
        if (j >= svs.length) out = state(out, id, q[0], q[1], q[2], opt);
        else if ((svs[j][1].text || '') !== q[0]) out = stateValue(out, id, j, q[0], opt);
      });
      unitsOf(g.el).map(unitText).forEach(function (u, j) {
        if (j >= uis.length) out = unit(out, id, u, opt);
        else if ((uis[j][1].text || '') !== u) out = unitValue(out, id, j, u, opt);
      });
      if (multi !== fileMulti(g.el)) out = multimer(out, id, !multi, opt);
    });
    return out;
  }

  // ---------- back into the SBGN-ML text ----------
  function write(t, gtext, opt) {
    var dropped = {}, was = gone(gtext);   // dropped: glyphs one of whose units of information was deleted; was: ids never given again (the comment stays with the GraphML)
    t = drop(t, was, opt, dropped);
    var S = sbgn(t, opt), G = gml(gtext, opt), T = new Tags(t, S.doc);
    var close = function (a, b) { return Math.abs(a - b) < 1e-6; };
    var iconsOf = function (id, kind) {   // [text, rx, ry] of a node's state variables (or units of information) in the GraphML
      return labelsOf(G, id).icons.filter(function (q) { return q[1].kind === (kind || 'StateVariable'); }).map(function (q) {
        var p = q[0].getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0];
        return [q[1].text || '', F(p.getAttribute('nodeRatioX')), F(p.getAttribute('nodeRatioY'))];
      });
    };
    // units of information changed in the editor (one added, deleted or retyped): all of the glyph's written again where
    // the converter draws them, spread evenly along the top (layout.decorations); untouched ones stay as the file has them
    var uChanged = {};
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id];
      if (!G.node[id] || !NAMED.test(g.el.getAttribute('class') || '')) return;
      var have = unitsOf(g.el).map(unitText), now = iconsOf(id, 'UnitOfInformation').map(function (q) { return q[0]; });
      if (dropped[id] || have.length !== now.length || have.some(function (u, j) { return u !== now[j]; })) uChanged[id] = 1;
    });
    var setXY = function (el, p, kx, ky) {
      kx = kx || 'x'; ky = ky || 'y';
      if (!close(F(el.getAttribute(kx)), p[0])) T.set(el, kx, num(p[0]));
      if (!close(F(el.getAttribute(ky)), p[1])) T.set(el, ky, num(p[1]));
    };
    // the glyphs: their boxes, and what they carry mapped from the old box to the new (centres scaled with the box,
    // a label kept at its place from the top left)
    var svMoved = new Set();   // state variables the editor moved along their glyph's border: placed below, not mapped here
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], n = G.node[id];
      if (!n || !NAMED.test(g.el.getAttribute('class') || '')) return;
      var have = kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; });
      iconsOf(id).forEach(function (q, j) {
        var cb = have[j] && kid(have[j], 'bbox'), B = g.box;
        if (!cb) return;
        var rx = (F(cb.getAttribute('x')) + F(cb.getAttribute('w')) / 2 - B[0] - B[2] / 2) / B[2], ry = (F(cb.getAttribute('y')) + F(cb.getAttribute('h')) / 2 - B[1] - B[3] / 2) / B[3];
        if (!close(rx, q[1]) || !close(ry, q[2])) svMoved.add(cb);
      });
    });
    var map = {};   // glyph id -> function from an old point to the new
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], n = G.node[id];
      if (!n) return;
      var o = g.box, b = n.box;
      if (o.every(function (v, j) { return close(v, b[j]); })) return;
      ['x', 'y', 'w', 'h'].forEach(function (k, j) { if (!close(o[j], b[j])) T.set(g.bbox, k, n.geo.getAttribute(['x', 'y', 'width', 'height'][j])); });
      var f = map[id] = function (p) { return [b[0] + (o[2] ? (p[0] - o[0]) * b[2] / o[2] : b[2] / 2), b[1] + (o[3] ? (p[1] - o[1]) * b[3] / o[3] : b[3] / 2)]; };
      kids(g.el, 'glyph').forEach(function (c) {   // state variables, units of information, glyphs the converter left out
        var cb = kid(c, 'bbox');
        if (!cb || G.node[c.getAttribute('id')] || svMoved.has(cb) || (uChanged[id] && c.getAttribute('class') === 'unit of information')) return;
        var w = F(cb.getAttribute('w')), h = F(cb.getAttribute('h')), m = f([F(cb.getAttribute('x')) + w / 2, F(cb.getAttribute('y')) + h / 2]);
        setXY(cb, [m[0] - w / 2, m[1] - h / 2]);
      });
      var lab = kid(g.el, 'label'), lb = lab && kid(lab, 'bbox');
      if (lb) setXY(lb, [F(lb.getAttribute('x')) + b[0] - o[0], F(lb.getAttribute('y')) + b[1] - o[1]]);
    });
    // names and state variables set in the editor, and glyphs it made (user, 2026-11-14: the full editor)
    var pre = S.doc.documentElement.prefix ? S.doc.documentElement.prefix + ':' : '';
    var svBox = function (txt, b, rx, ry) { var sw = txt.length <= 2 ? 15 : 45; return [b[0] + b[2] / 2 + rx * b[2] - sw / 2, b[1] + b[3] / 2 + ry * b[3] - 7.5, sw, 15]; };   // layout.decorations
    var bboxXml = function (b) { return '<' + pre + 'bbox x="' + num(b[0]) + '" y="' + num(b[1]) + '" w="' + num(b[2]) + '" h="' + num(b[3]) + '"/>'; };
    var svXml = function (gid, k, q, b, ind) {
      var v = q[0].split('@'), val = v.shift(), vr = v.join('@'), sid = gid + '_sv' + k, j = 0;
      while (S.glyph[sid] || S.port[sid] || S.arc[sid] || was.indexOf(sid) >= 0) sid = gid + '_sv' + k + '_' + (++j);
      return '\n' + ind + '<' + pre + 'glyph class="state variable" id="' + esc(sid) + '">\n' + ind + '  <' + pre + 'state value="' + esc(val) + '"' + (vr ? ' variable="' + esc(vr) + '"' : '') + '/>\n' +
        ind + '  ' + bboxXml(svBox(q[0], b, q[1], q[2])) + '\n' + ind + '</' + pre + 'glyph>';
    };
    var uiXml = function (gid, k, txt, b, ind) {   // a unit of information as sbgnml.write writes it
      var uid = gid + '_ui' + k, j = 0;
      while (S.glyph[uid] || S.port[uid] || S.arc[uid] || was.indexOf(uid) >= 0) uid = gid + '_ui' + k + '_' + (++j);
      return '\n' + ind + '<' + pre + 'glyph class="unit of information" id="' + esc(uid) + '">\n' + ind + '  <' + pre + 'label text="' + esc(txt) + '"/>\n' +
        ind + '  ' + bboxXml(b) + '\n' + ind + '</' + pre + 'glyph>';
    };
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], n = G.node[id], cls = g.el.getAttribute('class') || '';
      if (!n || !NAMED.test(cls)) return;
      var L = labelsOf(G, id), lab = kid(g.el, 'label');
      if (L.main && ownText(L.main) !== (lab ? lab.getAttribute('text') || '' : '')) {
        if (lab) T.set(lab, 'text', ownText(L.main));
        else { var at1 = T.at.get(g.bbox)[0]; T.ed.push([at1, at1, '<' + pre + 'label text="' + esc(ownText(L.main)) + '"/>\n' + T.indent(g.bbox)]); }
      }
      // made a multimer or a single macromolecule again (user, 2026-11-14): the class, where the converter would read the
      // file otherwise (a multimer with N:1 reads as one unit: left as it is)
      var base = cls.replace(/ multimer$/, ''), multi = isMulti(G, id);
      if (MULTI.test(base) && multi !== fileMulti(g.el)) T.set(g.el, 'class', base + (multi ? ' multimer' : ''));
      var have = kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; }), more = '';
      var icons = iconsOf(id), hu = unitsOf(g.el), ui = iconsOf(id, 'UnitOfInformation'), cutEls = [];
      have.slice(icons.length).forEach(function (c) { T.cut(c); cutEls.push(c); });   // deleted in the editor
      var moreU = '';
      if (uChanged[id]) {   // units of information: their text, all placed as the converter draws them, new ones written
        hu.slice(ui.length).forEach(function (c) { T.cut(c); cutEls.push(c); });
        ui.forEach(function (q, k) {
          var ub = uBox(q[0], n.box, k, ui.length);
          if (k >= hu.length) { moreU += uiXml(id, k, q[0], ub, T.indent(g.bbox)); return; }
          var cb2 = kid(hu[k], 'bbox'), lab2 = kid(hu[k], 'label');
          if (unitText(hu[k]) !== q[0]) {
            if (lab2) T.set(lab2, 'text', q[0]);
            else { var at3 = T.at.get(cb2)[0]; T.ed.push([at3, at3, '<' + pre + 'label text="' + esc(q[0]) + '"/>\n' + T.indent(cb2)]); }
          }
          setXY(cb2, ub);
          if (!close(F(cb2.getAttribute('w')), ub[2])) T.set(cb2, 'w', num(ub[2]));
          if (!close(F(cb2.getAttribute('h')), ub[3])) T.set(cb2, 'h', num(ub[3]));
        });
      }
      icons.forEach(function (q, j) {
        if (j >= have.length) { more += svXml(id, j, q, n.box, T.indent(g.bbox)); return; }
        var cb = kid(have[j], 'bbox');
        if (svMoved.has(cb)) { var nb = svBox(q[0], n.box, q[1], q[2]), w0 = F(cb.getAttribute('w')), h0 = F(cb.getAttribute('h')); setXY(cb, [nb[0] + nb[2] / 2 - w0 / 2, nb[1] + nb[3] / 2 - h0 / 2]); }
        var st = kid(have[j], 'state'), v = q[0].split('@'), val = v.shift(), vr = v.join('@');
        if ((st ? svText(st.getAttribute('value'), st.getAttribute('variable')) : '') === q[0]) return;   // no state element reads as empty (sbgnml.read)
        if (!st) { var at2 = T.at.get(kid(have[j], 'bbox'))[0]; T.ed.push([at2, at2, '<' + pre + 'state value="' + esc(val) + '"' + (vr ? ' variable="' + esc(vr) + '"' : '') + '/>\n' + T.indent(kid(have[j], 'bbox'))]); return; }
        T.set(st, 'value', val);
        if (vr) T.set(st, 'variable', vr); else T.unset(st, 'variable');
      });
      if (more || moreU) {   // after the last state variable or unit of information that stays, else after the bbox
        var lastKid = have.concat(hu).filter(function (c) { return cutEls.indexOf(c) < 0; }).sort(function (x, y) { return T.at.get(y)[0] - T.at.get(x)[0]; })[0];
        var e1 = T.end(lastKid || g.bbox); T.ed.push([e1, e1, more + moreU]);
      }
    });
    var mapEl = kids(S.doc.documentElement, 'map')[0], tops = kids(mapEl, 'glyph'), last = tops[tops.length - 1];
    var ind0 = last ? T.indent(last) : T.indent(mapEl) + '  ', fresh = '', St = null, joinTo = new Map();
    G.ids.forEach(function (id) {
      if (S.glyph[id] || S.port[id] || S.arc[id] || id.indexOf('|') >= 0) return;
      var n = G.node[id], r = n.geo.parentNode, cfg = (r.getAttribute('configuration') || '').replace('com.yworks.sbgn.', ''), cls = null;
      Object.keys(MAKE).forEach(function (c) { if (MAKE[c] === cfg) cls = c; });
      if (!cls) return;
      var up = n.el.parentNode; while (up && up.localName !== 'node') up = up.parentNode;
      var cref = up && S.glyph[up.getAttribute('id')] && S.glyph[up.getAttribute('id')].el.getAttribute('class') === 'compartment' ? up.getAttribute('id') : null;
      var L = labelsOf(G, id), name = L.main ? ownText(L.main) : '', fl = kid(r, 'Fill'), fill = fl && fl.getAttribute('hasColor') !== 'false' ? (fl.getAttribute('color') || '').toUpperCase() : null;
      var fu = iconsOf(id, 'UnitOfInformation');
      fresh += '\n' + ind0 + '<' + pre + 'glyph class="' + cls + (isMulti(G, id) && MULTI.test(cls) ? ' multimer' : '') + '" id="' + esc(id) + '"' + (cref ? ' compartmentRef="' + esc(cref) + '"' : '') + '>' +
        (name ? '\n' + ind0 + '  <' + pre + 'label text="' + esc(name) + '"/>' : '') + '\n' + ind0 + '  ' + bboxXml(n.box) +
        iconsOf(id).map(function (q, k) { return svXml(id, k, q, n.box, ind0 + '  '); }).join('') +
        fu.map(function (q, k) { return uiXml(id, k, q[0], uBox(q[0], n.box, k, fu.length), ind0 + '  '); }).join('') + '\n' + ind0 + '</' + pre + 'glyph>';
      if (fill) {   // its colour: a style of that fill and of its font, the one most of the map's glyphs of its class use (defaults' choice)
        St = St || styles(S);
        var fs = L.main ? F(L.main.getAttribute('fontSize')) : null, kin = function (x) { return x.ids.filter(function (i) { return S.glyph[i] && S.glyph[i].el.getAttribute('class') === cls; }).length; };
        var cand = St.filter(function (x) { return x.plain && x.fill === fill && (x.font == null || x.font === fs); });
        cand.sort(function (a, b) { return (b.font === fs) - (a.font === fs) || kin(b) - kin(a); });
        if (cand[0]) joinTo.set(cand[0], (joinTo.get(cand[0]) || []).concat(id));
      }
    });
    if (fresh) {
      var ms = T.at.get(mapEl);
      if (!last && ms[2]) T.ed.push([ms[0], ms[1], T.t.slice(ms[0], ms[1] - 2).replace(/\s+$/, '') + '>' + fresh + '\n' + T.indent(mapEl) + '</' + pre + 'map>']);   // an empty <map/>
      else { var e2 = last ? T.end(last) : ms[1]; T.ed.push([e2, e2, fresh]); }
    }
    joinTo.forEach(function (ids, st) { T.set(st.el, 'idList', st.ids.concat(ids).join(' ')); });
    // the arcs: their bends, then their ends (an end at a port gives the port its place)
    var portAt = {}, newPorts = {}, use = {};
    Object.keys(S.arc).forEach(function (id) {   // which port of a glyph its consumptions (1) and products (2) use in the file
      var a = S.arc[id], src = a.getAttribute('source'), tgt = a.getAttribute('target');
      if (S.portOf[src]) use[S.portOf[src] + '\u0000' + 2] = use[S.portOf[src] + '\u0000' + 2] || src;
      if (S.portOf[tgt] && flux(a)) use[S.portOf[tgt] + '\u0000' + 1] = use[S.portOf[tgt] + '\u0000' + 1] || tgt;
    });
    var newId = function (gid, no) { var i = gid + '.' + no, k = 0; while (S.port[i] || S.glyph[i]) i = gid + '.p' + no + (k++ ? k : ''); return i; };
    Object.keys(S.arc).forEach(function (id) {
      var a = S.arc[id], e = G.edge[id];
      if (!e) return;
      var E = ends(S, a), ref = [a.getAttribute('source'), a.getAttribute('target')], cls = a.getAttribute('class');
      // an end moved to another glyph (the editor, user 2026-11-14): the arc names that glyph, its port set below; the
      // arrowhead-less line is a consumption at a process and a logic arc at a gate (user: one connector for both)
      var moved = [0, 1].map(function (j) { var g = j ? e.t : e.s; return E[j] !== g && !!G.node[E[j]] && !!G.node[g] && !!S.glyph[g]; });
      moved.forEach(function (m, j) { if (m) { E[j] = ref[j] = j ? e.t : e.s; E[2 + j] = null; } });
      if (moved[0] || moved[1]) {
        var hub = (S.glyph[E[1]] && S.glyph[E[1]].el.getAttribute('class')) || '';
        if (cls === 'consumption' && /^(and|or|not|equivalence)$/.test(hub)) cls = 'logic arc';
        else if (cls === 'logic arc' && HUB.test(hub) && !/^(and|or|not|equivalence)$/.test(hub)) cls = 'consumption';
        if (cls !== a.getAttribute('class')) T.set(a, 'class', cls);
      }
      if (E[0] !== e.s || E[1] !== e.t || !G.node[E[0]] || !G.node[E[1]] || !S.glyph[E[0]] || !S.glyph[E[1]]) return;
      var nx = kids(a, 'next');
      if (nx.length !== e.pts.length || nx.some(function (q, j) { var p = xy(q); return !close(p[0], e.pts[j][0]) || !close(p[1], e.pts[j][1]); })) {
        var pre = a.prefix ? a.prefix + ':' : '';
        var out = e.pts.map(function (p, j) { return '<' + pre + 'next x="' + (e.ptEl[j].getAttribute('x')) + '" y="' + (e.ptEl[j].getAttribute('y')) + '"/>'; });
        if (nx.length) {
          var ind = '\n' + T.indent(nx[0]);
          var from = T.at.get(nx[0])[0];
          if (!out.length) from = T.end(prevEl(nx[0]));   // all taken out: from the tag before them (a one-line file too: the review of V4)
          T.ed.push([from, T.end(nx[nx.length - 1]), out.join(ind)]);
        } else {
          var en = kid(a, 'end'), at0 = en ? T.at.get(en)[0] : T.end(kid(a, 'start'));
          var ind2 = en ? T.indent(en) : T.indent(kid(a, 'start'));
          if (out.length) T.ed.push([at0, at0, out.join('\n' + ind2) + (en ? '\n' + ind2 : '')]);
        }
      }
      // the ends: one at a port gives the port its place; one off the centre is written where the GraphML has it; one at
      // the centre (0, 0) where the converter reads it back as the centre: the file's own point (moved with its glyph)
      // while it lies on the line toward the next point (sbgnml.at's rule), else where that line leaves the box
      var side = [['source', 'start', 0, E[0], E[2]], ['target', 'end', 2, E[1], E[3]]].map(function (q) {
        var gid = q[3], b = G.node[gid].box, c = centre(b), o = S.glyph[gid].box;
        var port = ref[q[2] / 2] !== gid && (q[0] === 'source' || /^(consumption|logic arc)$/.test(cls));   // an end the converter reads at its port
        var zero = !e.off[q[2]] && !e.off[q[2] + 1] && !port;
        return { q: q, gid: gid, c: c, zero: zero, port: port, P: [c[0] + e.off[q[2]], c[1] + e.off[q[2] + 1]],
                 old: q[4] && (map[gid] ? [q[4][0] + b[0] - o[0], q[4][1] + b[1] - o[1]] : q[4]) };
      });
      // nothing about the arc changed (its glyphs, bends and ends as the converter reads them from the file): its ends kept
      var fileOff = at(S, E[0], a.getAttribute('source'), E[2], (E[4].length ? E[4] : [E[3]])[0])
        .concat(at(S, E[1], a.getAttribute('target'), E[3], (E[4].length ? E[4][E[4].length - 1] : E[2]), flux(a)));
      var still = !moved[0] && !moved[1] && !map[E[0]] && !map[E[1]] && nx.length === e.pts.length && fileOff.every(function (v, j) { return close(v, e.off[j]); }) &&
        e.pts.every(function (p, j) { var q = xy(nx[j]); return close(p[0], q[0]) && close(p[1], q[1]); });
      if (still) return;
      var keep = function (s, aim) { return !!s.old && onLine(s.c, s.old, aim); };   // the file's own end carried with its glyph while on the line
      var onLine = function (c, p, aim) {
        var u = [aim[0] - c[0], aim[1] - c[1]], v = [p[0] - c[0], p[1] - c[1]], n = Math.hypot(u[0], u[1]);
        return !n || (Math.abs(u[0] * v[1] - u[1] * v[0]) / n <= 1 && u[0] * v[0] + u[1] * v[1] >= 0);   // within 1 of the converter's 1.5: safe after rounding
      };
      var cut = function (s, aim) {
        var b = G.node[s.gid].box, c = s.c, u = [aim[0] - c[0], aim[1] - c[1]];
        if (!u[0] && !u[1]) return c;
        var tt = Math.min(u[0] ? b[2] / 2 / Math.abs(u[0]) : Infinity, u[1] ? b[3] / 2 / Math.abs(u[1]) : Infinity);
        return [c[0] + tt * u[0], c[1] + tt * u[1]];
      };
      var aim = [e.pts.length ? e.pts[0] : null, e.pts.length ? e.pts[e.pts.length - 1] : null];
      if (e.pts.length) side.forEach(function (s, j) { if (s.zero) s.P = keep(s, aim[j]) ? s.old : cut(s, aim[j]); });
      else if (side[0].zero && side[1].zero) {   // both at their centres: kept as a pair, else both on the line between the centres
        if (keep(side[0], side[1].old || side[1].c) && keep(side[1], side[0].old || side[0].c)) { side[0].P = side[0].old; side[1].P = side[1].old; }
        else { side[0].P = cut(side[0], side[1].c); side[1].P = cut(side[1], side[0].P); }   // toward the start written (the converter's aim)
      } else side.forEach(function (s, j) { var o = side[1 - j]; if (s.zero) s.P = keep(s, o.zero ? o.old || o.c : o.P) ? s.old : cut(s, o.P); });
      side.forEach(function (s) {
        var q = s.q, j0 = q[2] / 2, rf = ref[j0], el = kid(a, q[1]), P = s.P;
        if (!el) return;
        if (!s.port && rf !== s.gid && !s.zero) ref[j0] = s.gid;   // a modifier the file aimed at a port, moved: now at the glyph (read as the centre else)
        if (s.port) {
          // at a port: the port where the GraphML has it, the arc's end on it (the file's own kept while the port stays)
          portAt[rf] = portAt[rf] || P;
          var o0 = xy(S.port[rf]);
          if (!close(o0[0], portAt[rf][0]) || !close(o0[1], portAt[rf][1])) setXY(el, portAt[rf]);   // a port moved: the end on it
          return;
        }
        var b2 = G.node[s.gid].box, out2 = Math.abs(P[0] - s.c[0]) > b2[2] / 2 + 0.5 || Math.abs(P[1] - s.c[1]) > b2[3] / 2 + 0.5;
        var no = cls === 'production' ? 2 : cls === 'consumption' ? 1 : cls === 'logic arc' ? (q[0] === 'source' ? 2 : 1) : 0;   // a logic arc leaving a gate (into another gate) from its port two
        if (!s.zero && out2 && no && HUB.test(S.glyph[s.gid].el.getAttribute('class') || '')) {   // at a port of a process or gate
          // the arc named the glyph: now the port its glyph's other consumptions (products) use, else a port made
          var have = kids(S.glyph[s.gid].el, 'port').map(function (x) { return x.getAttribute('id'); }), other = use[s.gid + '\u0000' + (3 - no)];
          var pid = use[s.gid + '\u0000' + no] || (have.length >= 2 ? have.filter(function (x) { return x !== other; })[other ? 0 : no - 1] : null);
          if (pid) { ref[j0] = pid; portAt[pid] = portAt[pid] || P; }
          else {
            (newPorts[s.gid] = newPorts[s.gid] || {})[no] = newPorts[s.gid][no] || P;
            ref[j0] = newId(s.gid, no);
          }
        }
        setXY(el, P);
      });
      ['source', 'target'].forEach(function (k, j) { if (ref[j] !== a.getAttribute(k)) T.set(a, k, ref[j]); });
    });
    // the ports: where their arcs put them; a port no arc names moves with its glyph; a made one written
    Object.keys(S.port).forEach(function (pid) {
      var p = S.port[pid], gid = S.portOf[pid], P = portAt[pid] || (map[gid] && map[gid](xy(p)));
      if (P) setXY(p, P);
    });
    Object.keys(newPorts).forEach(function (gid) {
      var g = S.glyph[gid], P = newPorts[gid], c = centre(G.node[gid].box);
      P[1] = P[1] || [2 * c[0] - P[2][0], 2 * c[1] - P[2][1]]; P[2] = P[2] || [2 * c[0] - P[1][0], 2 * c[1] - P[1][1]];
      var ind = '\n' + T.indent(g.bbox), e = T.end(g.bbox);
      T.ed.push([e, e, [1, 2].map(function (k) { return ind + '<' + (g.el.prefix ? g.el.prefix + ':' : '') + 'port id="' + esc(newId(gid, k)) + '" x="' + num(P[k][0]) + '" y="' + num(P[k][1]) + '"/>'; }).join('')]);
    });
    // a process's orientation, where the file gives one, follows its ports
    Object.keys(S.glyph).forEach(function (gid) {
      var g = S.glyph[gid], o = g.el.getAttribute('orientation');
      if (!o || !G.node[gid]) return;
      var ps = kids(g.el, 'port').map(function (p) { return portAt[p.getAttribute('id')] || xy(p); });
      if (ps.length < 2) return;
      var want = Math.abs(ps[1][0] - ps[0][0]) >= Math.abs(ps[1][1] - ps[0][1]) ? 'horizontal' : 'vertical';
      if (want !== o) T.set(g.el, 'orientation', want);
    });
    return T.text();
  }

  // ---------- creating (user, 2026-11-14: the full editor, entities added from a palette as in yEd and Newt) ----------
  // What the editor adds is written into its GraphML as graphml.write writes it (the yed.graphml templates, its label
  // and icon sizes), write() puts it into the SBGN-ML text, and graphml() makes it again from the SBGN-ML text (a draft
  // reopened before the build has drawn it). So far: a macromolecule, its name, its state variables; a simple chemical and
  // its name (no state variable or unit of information: the house profile, user 2026-11-14, CellDesigner keeps none).
  //   defaults(sbgnText, opt, cls) -> { w, h, font, fill } of a new glyph of that class on that map (its scale, the style
  //   most of the map's glyphs of that class use); cls defaults to macromolecule
  //   add(g, { id, cls, label, box, parent, fill, font }) -> g with the node (parent: a compartment's node id)
  //   label(g, id, text) -> g with the node's name; state(g, id, value, rx, ry) -> g with a state variable added at that
  //   point of the border (rx, ry from the centre, as yEd's nodeRatio); stateValue(g, id, j, value): its j-th one's value
  var CHAR = 9.5, LINE = 16.5, ICON_CHAR = 5.4;   // graphml.py: a label line's height and a character's width at 14; an icon's character
  var MAKE = { macromolecule: 'Macromolecule', 'simple chemical': 'SimpleChemical' };   // what the palette makes: SBGN class -> yEd's configuration
  var SIZE = { macromolecule: [80, 40], 'simple chemical': [40, 40] };   // the converter's standard sizes (style.py), times the map's scale
  var NAMED = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity|perturbing agent|phenotype)( multimer)?$/;   // names kept in step both ways
  function ownText(el) { var t = ''; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 || c.nodeType === 4) t += c.nodeValue; return t; }
  function labelBox(text, w, h, k) {   // graphml._label: the label's box estimated and centred
    var lines = text ? text.split('\n') : [], n = 0;
    lines.forEach(function (x) { n = Math.max(n, x.length); });
    var lw = n * CHAR * k, lh = lines.length * LINE * k + 4;
    return [lw, lh, (w - lw) / 2, (h - lh) / 2];
  }
  var LM = '<y:LabelModel><y:SmartNodeLabelModel distance="4.0"/></y:LabelModel>';
  function mainLabel(text, w, h, fs) {
    var b = labelBox(text, w, h, fs / 14);
    return '<y:NodeLabel alignment="center" autoSizePolicy="content" fontFamily="Dialog" fontSize="' + fs + '" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" height="' + repr(b[1]) +
      '" horizontalTextPosition="center" iconTextGap="4" modelName="custom" textColor="#000000" verticalTextPosition="center" visible="true" width="' + repr(b[0]) + '" x="' + repr(b[2]) +
      '" xml:space="preserve" y="' + repr(b[3]) + '" hasText="' + (text ? 'true' : 'false') + '">' + esc(text) + LM +
      '<y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX="0.0" labelRatioY="0.0" nodeRatioX="0.0" nodeRatioY="0.0" offsetX="0.0" offsetY="0.0" upX="0.0" upY="-1.0"/></y:ModelParameter></y:NodeLabel>';
  }
  function svSize(text, k) { return text.length <= 2 ? [18 * k, 18 * k] : [Math.ceil(text.length * ICON_CHAR * k + 12 * k), 18 * k]; }   // graphml.write's resource (k: its font against 10)
  function iconLabel(rid, size, w, h, rx, ry) {
    return '<y:NodeLabel alignment="center" autoSizePolicy="content" borderDistance="0.0" bottomInset="0" fontFamily="Dialog" fontSize="12" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" hasText="false" height="' + repr(size[1]) +
      '" horizontalTextPosition="center" iconData="' + rid + '" iconTextGap="0" leftInset="0" modelName="custom" rightInset="0" textColor="#000000" topInset="0" verticalTextPosition="center" visible="true" width="' + repr(size[0]) +
      '" x="' + repr((0.5 + rx) * w - size[0] / 2) + '" y="' + repr((0.5 + ry) * h - size[1] / 2) + '">\n' +
      '                <y:LabelModel>\n                  <y:SmartNodeLabelModel distance="4.0"/>\n                </y:LabelModel>\n                <y:ModelParameter>\n' +
      '                  <y:SmartNodeLabelModelParameter labelRatioX="0.0" labelRatioY="0.0" nodeRatioX="' + repr(rx) + '" nodeRatioY="' + repr(ry) + '" offsetX="0.0" offsetY="0.0" upX="0.0" upY="-1.0"/>\n' +
      '                </y:ModelParameter>\n              </y:NodeLabel>';
  }
  function resources(G) {   // the GraphML's shared icons: id -> { kind, text, size, font }
    var out = {};
    Array.prototype.forEach.call(G.doc.getElementsByTagNameNS(YNS, 'Resource'), function (r) {
      var gn = r.getElementsByTagNameNS(YNS, 'GenericNode')[0], l = gn && kid(gn, 'NodeLabel'), geo = gn && kid(gn, 'Geometry');
      if (!gn || !l || !geo) return;
      out[r.getAttribute('id')] = { el: r, kind: (gn.getAttribute('configuration') || '').replace('com.yworks.sbgn.', ''), text: ownText(l), font: l.getAttribute('fontSize'), size: [F(geo.getAttribute('width')), F(geo.getAttribute('height'))] };
    });
    return out;
  }
  // a state variable's icon of that text (shared, as yEd shares them): its id, the text with the icon added when new
  function svIcon(t, text, opt, small, kind) {   // small: the node's icons' own font size (a Newt map's), else 10; kind: UnitOfInformation, else a state variable
    kind = kind || 'StateVariable';
    var G = gml(t, opt), R = resources(G), id = null, max = 0, fs = small ? String(small) : '10', k = (small || 10) / 10;
    Object.keys(R).forEach(function (q) { max = Math.max(max, parseInt(q, 10) || 0); if (R[q].kind === kind && R[q].text === text && R[q].font === fs) id = id || q; });
    if (id) return [id, t, R[id].size];
    var sz = kind === 'UnitOfInformation' ? [Math.ceil(text.length * ICON_CHAR * k + 8 * k), 16 * k] : svSize(text, k), b = labelBox(text, sz[0], sz[1], k * 10 / 14);
    id = String(max + 1);
    var res = '<y:Resource id="' + id + '">\n        <yed:NodeRealizerIcon>\n          <y:GenericNode configuration="com.yworks.sbgn.' + kind + '">\n' +
      '            <y:Geometry height="' + repr(sz[1]) + '" width="' + repr(sz[0]) + '" x="0.0" y="0.0"/>\n            <y:Fill color="#FFFFFF" transparent="false"/>\n            <y:BorderStyle color="#000000" type="line" width="1.0"/>\n' +
      '            <y:NodeLabel alignment="center" autoSizePolicy="content" fontFamily="Dialog" fontSize="' + fs + '" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" height="' + repr(b[1]) +
      '" horizontalTextPosition="center" iconTextGap="4" modelName="custom" textColor="#000000" verticalTextPosition="center" visible="true" width="' + repr(b[0]) + '" x="' + repr(b[2]) +
      '" xml:space="preserve" y="' + repr(b[3]) + '" hasText="' + (text ? 'true' : 'false') + '">' + esc(text) + LM +
      '<y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX="0.0" labelRatioY="0.0" nodeRatioX="0.0" nodeRatioY="0.0" offsetX="0.0" offsetY="0.0" upX="0.0" upY="-1.0"/></y:ModelParameter></y:NodeLabel>\n' +
      '          </y:GenericNode>\n        </yed:NodeRealizerIcon>\n      </y:Resource>';
    var rs = G.doc.getElementsByTagNameNS(YNS, 'Resources')[0], T = new Tags(t, G.doc);
    if (!G.doc.documentElement.getAttribute('xmlns:yed')) T.set(G.doc.documentElement, 'xmlns:yed', 'http://www.yworks.com/xml/yed/3');   // a map with no icons yet: lxml left the prefix out
    if (rs) {
      var s = T.at.get(rs);
      if (s[2]) T.ed.push([s[0], s[1], '<y:Resources>' + res + '</y:Resources>']);
      else { var e = T.end(rs), c = t.lastIndexOf('</', e - 1); T.ed.push([c, c, res]); }
    } else {
      var root = G.doc.documentElement, re = T.end(root), rc = t.lastIndexOf('</', re - 1);
      T.ed.push([rc, rc, '<data key="res"><y:Resources>' + res + '</y:Resources></data>\n']);
    }
    return [id, T.text(), sz];
  }
  function nodeXml(o, svs) {   // svs: [[icon id, size, rx, ry], ...], state variables then units of information
    var w = o.box[2], h = o.box[3];
    return '<node id="' + esc(o.id) + '"><data key="ng">\n        <y:GenericNode configuration="com.yworks.sbgn.' + MAKE[o.cls] + '">\n' +
      '          <y:Geometry height="' + repr(h) + '" width="' + repr(w) + '" x="' + repr(o.box[0]) + '" y="' + repr(o.box[1]) + '"/>\n' +
      '          ' + (o.fill ? '<y:Fill color="' + o.fill + '" transparent="false"/>' : '<y:Fill transparent="false" hasColor="false"/>') + '\n' +
      '          <y:BorderStyle color="#000000" type="line" width="1.0"/>\n          ' + mainLabel(o.label || '', w, h, o.font || 14) +
      (svs || []).map(function (q) { return iconLabel(q[0], q[1], w, h, q[2], q[3]); }).join('') + '\n' +
      (o.cls === 'macromolecule' || o.multimer ? '          <y:StyleProperties>\n            ' + (o.cls === 'macromolecule' ? '<y:Property class="java.lang.Integer" name="com.yworks.sbgn.style.radius" value="10"/>\n            ' : '') +
        (o.multimer ? MCOUNT : '') + '</y:StyleProperties>\n' : '') +   // yEd's simple chemical template has none
      '        </y:GenericNode>\n      </data>\n    </node>';
  }
  function add(t, o, opt) {
    if (!MAKE[o.cls]) throw new Error('cannot make a ' + o.cls);
    var svs = [];
    var mac = o.cls === 'macromolecule';   // the house profile: state variables and units of information on macromolecules only
    (mac ? o.states || [] : []).forEach(function (q) { var r = svIcon(t, q[0], opt); t = r[1]; svs.push([r[0], r[2], q[1], q[2]]); });
    (mac ? o.units || [] : []).forEach(function (u, k, all) { var r = svIcon(t, u, opt, null, 'UnitOfInformation'); t = r[1]; svs.push([r[0], r[2], uRatio(k, all.length), -0.5]); });
    var G = gml(t, opt), T = new Tags(t, G.doc), xml = nodeXml(o, svs), graph;
    if (o.parent && G.node[o.parent]) graph = kids(G.node[o.parent].el, 'graph')[0];
    if (!graph) graph = kids(G.doc.documentElement, 'graph')[0];
    var s = T.at.get(graph);
    if (s[2]) { T.ed.push([s[0], s[1], T.t.slice(s[0], s[1] - 2) + '>' + xml + '</graph>']); return T.text(); }
    var first = kids(graph, 'edge')[0], at0 = first ? T.at.get(first)[0] : T.t.lastIndexOf('</', T.end(graph) - 1);
    T.ed.push([at0, at0, xml]);
    return T.text();
  }
  function labelsOf(G, id) {   // the node's main label, and its icons ([label, resource])
    var n = G.node[id], R = G.R || (G.R = resources(G)), labs = n ? kids(n.geo.parentNode, 'NodeLabel') : [];
    return { main: labs.filter(function (l) { return !l.getAttribute('iconData'); })[0] || null,
             icons: labs.filter(function (l) { return l.getAttribute('iconData'); }).map(function (l) { return [l, R[l.getAttribute('iconData')] || {}]; }) };
  }
  function label(t, id, text, opt) {
    var G = gml(t, opt), n = G.node[id], L = n && labelsOf(G, id).main;
    if (!L) return t;
    var T = new Tags(t, G.doc), s = T.at.get(L), b = labelBox(text, n.box[2], n.box[3], (F(L.getAttribute('fontSize')) || 12) / 14);
    [['width', b[0]], ['height', b[1]], ['x', b[2]], ['y', b[3]]].forEach(function (q) { T.set(L, q[0], repr(q[1])); });
    T.set(L, 'hasText', text ? 'true' : 'false');
    if (s[2]) { T.ed.push([s[1] - 2, s[1], '>' + esc(text) + '</y:NodeLabel>']); return T.text(); }
    var c = L.firstChild, from = s[1], to = s[1];
    while (c && (c.nodeType === 3 || c.nodeType === 4)) c = c.nextSibling;
    to = c ? T.at.get(c)[0] : T.t.lastIndexOf('</', T.end(L) - 1);
    T.ed.push([from, to, esc(text)]);
    return T.text();
  }
  function smallOf(t, id, opt, G) {   // the font size the node's icons have, where it is not the usual 10 (G: t read already)
    G = G || gml(t, opt);
    var L = G.node[id] && labelsOf(G, id), f = L && L.icons.map(function (q) { return q[1].font; }).filter(function (x) { return x && x !== '10'; })[0];
    return f ? F(f) : null;
  }
  function state(t, id, value, rx, ry, opt, kind) {   // a state variable added after the node's last one (a unit of information after its last icon)
    kind = kind || 'StateVariable';
    var G0 = gml(t, opt), n0 = G0.node[id];
    if (!n0 || !/Macromolecule$/.test(n0.geo.parentNode.getAttribute('configuration') || '')) return t;   // the house profile: state variables and units of information on macromolecules only (none on a simple chemical)
    var r = svIcon(t, value, opt, smallOf(t, id, opt, G0), kind); t = r[1];
    var G = gml(t, opt), n = G.node[id], L = n && labelsOf(G, id);
    if (!L || !L.main) return t;
    var svs = L.icons.filter(function (q) { return kind === 'UnitOfInformation' || q[1].kind === 'StateVariable'; }), after = svs.length ? svs[svs.length - 1][0] : L.main;
    var T = new Tags(t, G.doc), e = T.end(after);
    T.ed.push([e, e, iconLabel(r[0], r[2], n.box[2], n.box[3], rx, ry)]);
    return T.text();
  }
  function stateValue(t, id, j, value, opt, kind) {
    kind = kind || 'StateVariable';
    var r = svIcon(t, value, opt, smallOf(t, id, opt), kind); t = r[1];
    var G = gml(t, opt), n = G.node[id], L = n && labelsOf(G, id), q = L && L.icons.filter(function (x) { return x[1].kind === kind; })[j];
    if (!q) return t;
    var T = new Tags(t, G.doc), p = q[0].getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0];
    var rx = F(p.getAttribute('nodeRatioX')), ry = F(p.getAttribute('nodeRatioY')), w = n.box[2], h = n.box[3];
    T.set(q[0], 'iconData', r[0]); T.set(q[0], 'width', repr(r[2][0])); T.set(q[0], 'height', repr(r[2][1]));
    T.set(q[0], 'x', repr((0.5 + rx) * w - r[2][0] / 2)); T.set(q[0], 'y', repr((0.5 + ry) * h - r[2][1] / 2));
    return T.text();
  }
  // the map's render styles: [{ el, fill (as yEd writes it), font, ids }]
  function styles(S) {
    var defs = {};
    Array.prototype.forEach.call(S.doc.getElementsByTagName('*'), function (e) { if (e.localName === 'colorDefinition') defs[e.getAttribute('id')] = e.getAttribute('value'); });
    var colour = function (c) { var v = defs[c] || c; if (!v || v.charAt(0) !== '#') return null; v = v.toUpperCase(); return v.length === 9 && /FF$/.test(v) ? v.slice(0, 7) : v; };
    return Array.prototype.filter.call(S.doc.getElementsByTagName('*'), function (e) { return e.localName === 'style'; }).map(function (st) {
      var g = kids(st, 'g')[0];
      return { el: st, fill: g ? colour(g.getAttribute('fill')) : null, font: g && g.getAttribute('font-size') ? F(g.getAttribute('font-size')) : null,
               ids: (st.getAttribute('idList') || '').split(/\s+/).filter(Boolean), plain: st.hasAttribute('idList') };
    });
  }
  function defaults(t, opt, cls) {
    cls = cls || 'macromolecule';
    var S = sbgn(t, opt), hs = [], best = null, n = 0, same = {};
    Object.keys(S.glyph).forEach(function (id) { var c = S.glyph[id].el.getAttribute('class'); if (c === 'macromolecule') hs.push(S.glyph[id].box[3]); if (c === cls) same[id] = 1; });
    hs.sort(function (a, b) { return a - b; });
    var m = hs.length ? (hs.length % 2 ? hs[(hs.length - 1) / 2] : (hs[hs.length / 2 - 1] + hs[hs.length / 2]) / 2) : 40, s = m / 40;   // the map's scale from its proteins, as style.scale_of
    if (!(s > 1.2 || s < 1 / 1.2)) s = 1;
    styles(S).forEach(function (st) { var k = st.ids.filter(function (i) { return same[i]; }).length; if (st.fill && st.plain && k > n) { n = k; best = st; } });
    var sz = SIZE[cls] || SIZE.macromolecule;
    return { w: sz[0] * s, h: sz[1] * s, font: best && best.font || Math.round(14 * s + 0.01), fill: best ? best.fill : null };
  }
  function drop(t, ids, opt, lost) {   // the file with the glyphs (state variables too) deleted in the editor taken out, and every arc at them; lost: the glyphs that lose a unit of information
    var S = sbgn(t, opt), del = {}, T = null;
    ids.forEach(function (id) {
      var g = S.glyph[id];
      if (!g) return;
      del[id] = 1;
      if (lost && g.el.getAttribute('class') === 'unit of information' && g.el.parentNode.getAttribute) lost[g.el.parentNode.getAttribute('id')] = 1;
      Array.prototype.forEach.call(g.el.getElementsByTagName('*'), function (c) { if (c.getAttribute('id')) del[c.getAttribute('id')] = 1; });
    });
    if (!Object.keys(del).length) return t;
    T = new Tags(t, S.doc);
    ids.forEach(function (id) { if (S.glyph[id]) T.cut(S.glyph[id].el); });
    Object.keys(S.arc).forEach(function (id) { var a = S.arc[id]; if (del[a.getAttribute('source')] || del[a.getAttribute('target')]) T.cut(a); });
    return T.text();
  }
  function svLabel(G, id, j, kind) { var L = G.node[id] && labelsOf(G, id); return L ? (L.icons.filter(function (x) { return x[1].kind === (kind || 'StateVariable'); })[j] || [])[0] : null; }
  function stateMove(t, id, j, rx, ry, opt) {   // the j-th state variable moved to rx, ry on its node's border (the editor's GraphML)
    var G = gml(t, opt), l = svLabel(G, id, j);
    if (!l) return t;
    var T = new Tags(t, G.doc), p = l.getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0], b = G.node[id].box;
    T.set(p, 'nodeRatioX', repr(rx)); T.set(p, 'nodeRatioY', repr(ry));
    T.set(l, 'x', repr((0.5 + rx) * b[2] - F(l.getAttribute('width')) / 2)); T.set(l, 'y', repr((0.5 + ry) * b[3] - F(l.getAttribute('height')) / 2));
    return T.text();
  }
  // the j-th state variable deleted; opt.sbgn, the SBGN-ML file the GraphML is written into: one of the file's own is
  // named in the deleted-ids comment by its id, so write() takes out that element and no other (the GraphML holds the
  // file's remaining state variables first, in the file's order, then those made in the editor)
  function stateDelete(t, id, j, opt, kind) {   // kind UnitOfInformation: the j-th unit of information, the others spread again
    var unit = kind === 'UnitOfInformation', G = gml(t, opt), l = svLabel(G, id, j, kind);
    if (!l) return t;
    var T = new Tags(t, G.doc); T.cut(l); t = T.text();
    if (unit) t = respace(t, id, opt);
    var g = opt && opt.sbgn && sbgn(opt.sbgn, opt).glyph[id], del = gone(t);
    var left = g ? (unit ? unitsOf(g.el) : kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; })).filter(function (c) { return del.indexOf(c.getAttribute('id')) < 0; }) : [];
    return j < left.length && left[j].getAttribute('id') ? goneMark(t, [left[j].getAttribute('id')]) : t;
  }
  // units of information (user, 2026-11-14: free text, "people know what they're doing"): spread evenly along the top as
  // graphml.write places them, (k + 1) / (n + 1) of the width, again whenever one is added or deleted
  function uRatio(k, n) { return (k + 1) / (n + 1) - 0.5; }
  function respace(t, id, opt) {
    var G = gml(t, opt), n = G.node[id], L = n && labelsOf(G, id);
    if (!L) return t;
    var us = L.icons.filter(function (q) { return q[1].kind === 'UnitOfInformation'; }), T = new Tags(t, G.doc), b = n.box;
    us.forEach(function (q, k) {
      var l = q[0], p = l.getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0], rx = uRatio(k, us.length), set = function (el, a, v) { if (el.getAttribute(a) !== v) T.set(el, a, v); };
      set(p, 'nodeRatioX', repr(rx)); set(p, 'nodeRatioY', repr(-0.5));
      set(l, 'x', repr((0.5 + rx) * b[2] - F(l.getAttribute('width')) / 2)); set(l, 'y', repr(-F(l.getAttribute('height')) / 2));
    });
    return T.text();
  }
  function unit(t, id, value, opt) { return respace(state(t, id, value, 0, -0.5, opt, 'UnitOfInformation'), id, opt); }
  function unitValue(t, id, j, value, opt) { return stateValue(t, id, j, value, opt, 'UnitOfInformation'); }
  function unitDelete(t, id, j, opt) { return stateDelete(t, id, j, opt, 'UnitOfInformation'); }
  // a multimer (user, 2026-11-14: "make multimer ... make macromolecule"): yEd's two shapes, mcount 2 (graphml.write); the
  // count, if any, is a unit of information the reader types (N:3)
  var MCOUNT = '<y:Property class="java.lang.Integer" name="com.yworks.sbgn.style.mcount" value="2"/>', MULTI = /^(macromolecule|simple chemical|nucleic acid feature)$/;
  function mcountOf(G, id) {
    var r = G.node[id] && G.node[id].geo.parentNode, sp = r && kid(r, 'StyleProperties');
    return sp ? kids(sp, 'Property').filter(function (p) { return p.getAttribute('name') === 'com.yworks.sbgn.style.mcount'; })[0] || null : null;
  }
  function isMulti(G, id) { var p = mcountOf(G, id); return !!p && p.getAttribute('value') !== '1'; }
  function multimer(t, id, on, opt) {
    var G = gml(t, opt), n = G.node[id];
    if (!n || isMulti(G, id) === !!on) return t;
    var T = new Tags(t, G.doc), p = mcountOf(G, id), r = n.geo.parentNode, sp = kid(r, 'StyleProperties');
    if (!on) { T.cut(p); return T.text(); }
    if (p) { T.set(p, 'value', '2'); return T.text(); }
    if (sp) { var s = T.at.get(sp); if (s[2]) T.ed.push([s[0], s[1], '<y:StyleProperties>' + MCOUNT + '</y:StyleProperties>']); else { var c = T.t.lastIndexOf('</', T.end(sp) - 1); T.ed.push([c, c, MCOUNT]); } }
    else { var c2 = T.t.lastIndexOf('</', T.end(r) - 1); T.ed.push([c2, c2, '<y:StyleProperties>' + MCOUNT + '</y:StyleProperties>']); }
    return T.text();
  }
  // the file's side, read as sbgnml.read reads it: a glyph's units of information (an empty one only off a biological
  // activity), their text, and whether the converter draws the glyph as a multimer (a count from N:x, else 2)
  function unitsOf(el) {
    var act = el.getAttribute('class') === 'biological activity';
    return kids(el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'unit of information' && (unitText(c) || !act); });
  }
  function unitText(c) { var l = kid(c, 'label'); return l ? l.getAttribute('text') || '' : ''; }
  function fileMulti(el) {
    if (!/ multimer$/.test(el.getAttribute('class') || '')) return false;
    var n = unitsOf(el).map(unitText).filter(function (u) { return /^N:\d+$/.test(u); })[0];
    return (n ? parseInt(n.slice(2), 10) : 2) > 1;
  }
  function uBox(txt, b, k, n) { var uw = Math.max(15, txt.length * 7); return [b[0] + (k + 1) / (n + 1) * b[2] - uw / 2, b[1] - 7.5, uw, 15]; }   // layout.decorations
  function remove(t, ids, opt) {   // nodes deleted in the editor's GraphML, with every line at them; their ids kept for write()
    var G = gml(t, opt), T = new Tags(t, G.doc), del = {};
    ids.forEach(function (id) { if (G.node[id]) { del[id] = 1; T.cut(G.node[id].el); } });
    Object.keys(G.edge).forEach(function (k) { var e = G.edge[k]; if (del[e.s] || del[e.t]) T.cut(e.el); });
    return goneMark(T.text(), Object.keys(del));
  }
  function nameable(t, id, opt) { var g = sbgn(t, opt).glyph[id]; return !!g && NAMED.test(g.el.getAttribute('class') || ''); }   // a name the editor may change: one write() carries
  function svText(value, variable) { return (value || '') + (variable ? '@' + variable : ''); }
  var HUB = /process|^(and|or|not|association|dissociation|equivalence)$/;

  var api = { graphml: graphml, write: write, defaults: defaults, add: add, label: label, state: state, stateValue: stateValue, stateMove: stateMove, stateDelete: stateDelete,
              unit: unit, unitValue: unitValue, unitDelete: unitDelete, multimer: multimer, remove: remove, gone: gone, nameable: nameable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.sbgn_edit = api;
})(typeof self !== 'undefined' ? self : this);
