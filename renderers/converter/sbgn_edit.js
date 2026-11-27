// sbgn_edit: an SBGN-ML map edited as the GraphML the converter makes of it (its copy in mapconv/:
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
//     it. A process or logic gate is one object with its two ports: its arcs at a port give the
//     port's place; a glyph with ports in the GraphML but none in the file gets them (<port> after its bbox, its id
//     with .1 for the consumptions, .2 for the products, the arcs pointed at them), so a turned process keeps its turn.
//   tests/sbgn-edit.js checks both ways against the converter on every SBGN-ML map of the demo.
//   unique(sbgnText, baseGraphml, opt) -> sbgnText with a glyph whose id an earlier glyph has renamed as sbgnml.read
//     reads it, arcs at the ends baseGraphml gives them (tests/sbgn-unique.js).
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
  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;'); }   // line breaks kept: read raw, they turn to spaces
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
  // glyphs deleted in the editor: their ids kept in a comment at the end of the editor's GraphML, so
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
  // A glyph whose id an earlier glyph of the map has is given <id>_<k> (k from 2, the first id not in the map: glyphs,
  // ports, arcs), as sbgnml.read reads it (unique_ids); each arc naming such an id takes the end the build's GraphML g0
  // gave it (sbgnml.read chose by where the arc's end lies), and a render style listing the id lists the new one too.
  // The file made valid when it is opened for editing, under the ids of g0. A file without such ids is returned as it is.
  function unique(t, g0, opt) {
    var re = /<(?:[\w.-]+:)?glyph\b[^>]*?\sid\s*=\s*(["'])([^"']*)\1/g, m, seen0 = {}, dup = false;
    while ((m = re.exec(t)) && !dup) { dup = !!seen0[m[2]]; seen0[m[2]] = 1; }
    if (!dup) return t;
    var doc = new (DP(opt))().parseFromString(t.replace(/^﻿/, ''), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return t;
    var map = kids(doc.documentElement, 'map')[0];
    if (!map) return t;
    var all = Array.prototype.slice.call(map.getElementsByTagName('*')), taken = {}, seen = {}, shared = {}, made = [];
    all.forEach(function (e) { if (e.getAttribute('id')) taken[e.getAttribute('id')] = 1; });
    all.forEach(function (g) {
      if (g.localName !== 'glyph') return;
      var i = g.getAttribute('id');
      if (!seen[i]) { seen[i] = 1; return; }
      var k = seen[i] + 1; while (taken[i + '_' + k]) k++;
      seen[i] = k; taken[i + '_' + k] = 1; made.push([g, i, i + '_' + k]);
      (shared[i] = shared[i] || [i]).push(i + '_' + k);
    });
    if (!made.length) return t;
    var T = new Tags(t, doc);
    made.forEach(function (q) { T.set(q[0], 'id', q[2]); });
    all.forEach(function (st) {   // the renamed glyph keeps the style of its id (sbgnml.read styles both by the file's id)
      if (st.localName !== 'style' || !st.getAttribute('idList')) return;
      var l = st.getAttribute('idList').split(/\s+/), add = made.filter(function (q) { return l.indexOf(q[1]) >= 0; }).map(function (q) { return q[2]; });
      if (add.length) T.set(st, 'idList', l.concat(add).join(' '));
    });
    var ends = {}, k2 = {};   // arc id -> the ends of g0's edges of that id, in order (two arcs of one id matched by their order)
    if (g0) Array.prototype.forEach.call(new (DP(opt))().parseFromString(g0, 'application/xml').getElementsByTagNameNS(GNS, 'edge'), function (e) {
      (ends[e.getAttribute('id')] = ends[e.getAttribute('id')] || []).push({ s: e.getAttribute('source'), t: e.getAttribute('target') });
    });
    all.forEach(function (a) {
      if (a.localName !== 'arc') return;
      var id = a.getAttribute('id'), j = k2[id] = (k2[id] || 0) + 1, e = (ends[id] || [])[j - 1];
      if (!e) return;   // not drawn: as it was
      [['source', e.s], ['target', e.t]].forEach(function (q) {
        var r = a.getAttribute(q[0]);
        if (shared[r] && q[1] !== r && shared[r].indexOf(q[1]) >= 0) T.set(a, q[0], q[1]);
      });
    });
    return T.text();
  }

  function centre(b) { return [b[0] + b[2] / 2, b[1] + b[3] / 2]; }
  function boxCut(b, aim) {   // where the line from the box's centre toward aim leaves the box
    var c = centre(b), u = [aim[0] - c[0], aim[1] - c[1]];
    if (!u[0] && !u[1]) return c;
    var tt = Math.min(u[0] ? b[2] / 2 / Math.abs(u[0]) : Infinity, u[1] ? b[3] / 2 / Math.abs(u[1]) : Infinity);
    return [c[0] + tt * u[0], c[1] + tt * u[1]];
  }
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
  function graphml(t, base, opt) { return refsIn(t, graphml0(t, base, opt), opt); }   // a glyph's references taken from the file last (refsIn)
  function graphml0(t, base, opt) {
    var S = sbgn(t, opt), G = gml(base, opt), T = new Tags(base, G.doc), out = {}, St = styles(S);
    Object.keys(G.node).forEach(function (id) {   // a glyph deleted in the editor: its node and lines out
      if (S.glyph[id] || S.port[id] || S.arc[id] || id.indexOf('|') >= 0 || !classOfCfg(cfgOf(G.node[id].geo.parentNode))) return;
      out[id] = 1;
    });
    Object.keys(out).forEach(function (id) {   // only the outermost cut: a glyph deleted with the compartment round it goes with it (two overlapping cuts break the file)
      for (var up = G.node[id].el.parentNode; up && up.nodeType === 1; up = up.parentNode) if (up.localName === 'node' && out[up.getAttribute('id')]) return;
      T.cut(G.node[id].el);
    });
    Object.keys(G.edge).forEach(function (id) {   // at a glyph deleted, or deleted itself (every edge of the converter's is an arc of the file)
      var e = G.edge[id];
      if (!S.arc[id]) T.cut(e.el);
    });
    Object.keys(G.node).forEach(function (id) {
      var g = S.glyph[id], n = G.node[id];
      if (!g) return;
      if (g.el.getAttribute('class') === 'submap') { var sr = n.geo.parentNode;   // yEd's Submap with its terminals, Activity Flow or PD as sbgnml.read
        if (sr.localName === 'GenericNode' && cfgOf(sr) !== 'Submap') T.set(sr, 'configuration', 'com.yworks.sbgn.Submap'); }
      if (/^(tag|terminal)$/.test(g.el.getAttribute('class') || '')) setWay(T, n.geo.parentNode, fileWay(g.el));   // its orientation as the file has it
      var ec = (g.el.getAttribute('class') || '').replace(/ multimer$/, ''), er = n.geo.parentNode;   // an entity made another (entityKind): its shape the file's class
      if (ENTITY.test(ec) && ENTITY.test(classOfCfg(cfgOf(er)) || '') && cfgOf(er) !== MAKE[ec]) T.set(er, 'configuration', 'com.yworks.sbgn.' + MAKE[ec]);
      var B = g.box, w = B[2], h = B[3], to = function (el, k, v) { if (el.getAttribute(k) !== v) T.set(el, k, v); };
      ['x', 'y', 'width', 'height'].forEach(function (k, j) { to(n.geo, k, repr(B[j])); });
      var gc = g.el.getAttribute('class') || '';
      var nw = LOOKS.test(gc) ? setLook(T, G, id, fileLook(St, id, gc), B) : null;   // nw: the name's width at the file's font, where it differs   // the file's look (a draft, a build of an older converter): what its styles state, else the converter's template
      // what graphml.write works out from the box: the state variables' and units of information's places (their ratios
      // read from the file as sbgnml.read reads them; a unit without a box spread along the top), a compartment's name
      // where the file has it. Counted by kind: one deleted in the editor is cut
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
          var ub = kid(units[j], 'bbox');   // where the file places it, as sbgnml.read reads it; else spread along the top
          rx = uRatio(j, units.length); ry = -0.5;   // its slot, kept where the file's place is the slot (layout.own_places)
          if (ub && w && h) {
            var ux = (F(ub.getAttribute('x')) + F(ub.getAttribute('w')) / 2 - B[0] - w / 2) / w, uy = (F(ub.getAttribute('y')) + F(ub.getAttribute('h')) / 2 - B[1] - h / 2) / h;
            if (Math.abs(ux - rx) > 1e-6 || Math.abs(uy - ry) > 1e-6) { rx = ux; ry = uy; }
          }
          to(p, 'nodeRatioX', repr(rx)); to(p, 'nodeRatioY', repr(ry));
        } else { rx = F(p.getAttribute('nodeRatioX')); ry = F(p.getAttribute('nodeRatioY')); }
        to(l, 'x', repr((0.5 + rx) * w - F(l.getAttribute('width')) / 2)); to(l, 'y', repr((0.5 + ry) * h - F(l.getAttribute('height')) / 2));
      });
      if (g.el.getAttribute('class') === 'compartment') {
        var l = labs.filter(function (x) { return !x.getAttribute('iconData'); })[0], lab = kid(g.el, 'label'), lb = lab && kid(lab, 'bbox');
        if (!l) return;
        var lw = nw != null ? nw : F(l.getAttribute('width'));
        if (!lb) { to(l, 'x', repr((w - lw) / 2)); to(l, 'y', '0.0'); return; }
        var lx = F(lb.getAttribute('x')) - B[0], ly = F(lb.getAttribute('y')) - B[1], np = namePlace(lx, ly, lw, F(l.getAttribute('height')), w, h);
        to(l, 'x', repr(lx)); to(l, 'y', repr(ly));
        to(l, 'modelPosition', np[0]); to(l, 'borderDistance', repr(np[1]));
      }
    });
    Object.keys(G.edge).forEach(function (id) {
      var a = S.arc[id], e = G.edge[id];
      if (!a) return;
      var fl = fileLook(St, id);
      setLine(T, e.el, fl.line); setWidth(T, e.el, fl.width);   // the file's colour and width (a draft, a build of an older converter)
      var E = ends(S, a), pts = E[4], want = ARROW[a.getAttribute('class')], ar = e.el.getElementsByTagNameNS(YNS, 'Arrows')[0];
      if (want != null && ar && ar.getAttribute('target') !== want) T.set(ar, 'target', want);   // an id used again by another arc (else a draft reopened over an old build keeps the old arrowhead)
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
    var out2 = renest(S, made(S, G, T.text(), t, opt), opt);   // nested as the file says
    // an arc whose end is a glyph the base lacks (made in the editor, then given its first arc): the glyph is in the
    // GraphML only now, so the arcs are read again onto it; the rest of a second pass changes nothing
    var late = Object.keys(S.arc).some(function (id) { var E = G.edge[id] && ends(S, S.arc[id]); return !!E && [0, 1].some(function (j) { return !G.node[E[j]] && !!S.glyph[E[j]]; }); });
    out2 = orderG(S, nestG(S, out2, opt), opt);   // a glyph the file holds in a complex that the base has beside it (joined in a draft the base predates); compartments stacked as the file has them
    return late && out2 !== base ? graphml0(t, out2, opt) : out2;
  }
  // what the editor made or renamed that the base GraphML lacks (a draft reopened before the build has drawn it)
  function made(S, G, out, t, opt) {
    var St = null, D = null, H = null, Hfor = null;   // the output read again only after it changed (a reading per glyph freezes a 2 MB map for minutes)
    var svOf = function (g) {   // a glyph's state variables: [text, rx, ry]
      var B = g.box;
      return kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; }).map(function (c) {
        var st = kid(c, 'state'), cb = kid(c, 'bbox'), cx = F(cb.getAttribute('x')) + F(cb.getAttribute('w')) / 2, cy = F(cb.getAttribute('y')) + F(cb.getAttribute('h')) / 2;
        return [st ? svText(st.getAttribute('value'), st.getAttribute('variable')) : '', (cx - B[0] - B[2] / 2) / B[2], (cy - B[1] - B[3] / 2) / B[3]];
      });
    };
    var props = {};   // activities drawn as such whose properties the base lacks
    var perf = {};   // activities the converter draws as the entity of their performance arc (Newt's hybrid maps): not nodes
    Object.keys(S.arc).forEach(function (k) { if (S.arc[k].getAttribute('class') === 'performance arc') perf[S.arc[k].getAttribute('target')] = 1; });
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], cls = g.el.getAttribute('class') || '', name = nameIn(g.el);
      var au = cls === 'biological activity' ? fileUnit(g.el) : null;   // an activity: its unit
      if (!G.node[id]) {
        var base = au != null ? actCls(au) : cls === 'perturbation' ? 'perturbing agent' : cls === 'terminal' ? 'tag' : cls.replace(/ multimer$/, ''), dk = au != null ? cls : base;   // AF's perturbation: yEd's perturbing agent; a terminal: a tag
        if (cls === 'terminal' && g.el.parentNode.getAttribute('class') !== 'submap') return;
        if (!MAKE[base] || (g.el.parentNode.localName !== 'map' && !inCx(g.el) && cls !== 'terminal') || perf[id]) return;   // a member of a complex: made beside it, then nested (nestG)
        St = St || styles(S); D = D || {}; D[dk] = D[dk] || defaults(t, opt, dk);
        var lk = fileLook(St, id, base), cref = g.el.getAttribute('compartmentRef');
        out = add(out, { id: id, cls: base, activity: au, label: name, box: g.box, parent: cref && S.glyph[cref] ? cref : null, fill: lk.fill, line: lk.line, width: lk.width, font: lk.font || D[dk].font,
                         states: svOf(g), units: unitsOf(g.el).map(unitText), multimer: fileMulti(g.el), way: base === 'tag' ? fileWay(g.el) : null,
                         letters: GLT.test(base) ? (lk.font != null ? lk.font : Math.round(14 * scaleOf(S) + 0.01) !== 14 ? Math.round(14 * scaleOf(S) + 0.01) : 12) : null }, opt);   // a gate's letters as graphml.write draws them: the file's, else 12 (the map's font where it is not 14)
        if (cls === 'terminal') { Hfor = null; out = terminal(out, id, true, opt); }
        var nlb = cls === 'compartment' && kid(g.el, 'label') && kid(kid(g.el, 'label'), 'bbox');
        if (nlb) {   // its name where the file has it (namePlace), as graphml() reads a compartment of the base
          var NG = gml(out, opt), nl = labelsOf(NG, id).main;
          if (nl) { var np = namePlace(F(nlb.getAttribute('x')) - g.box[0], F(nlb.getAttribute('y')) - g.box[1], F(nl.getAttribute('width')), F(nl.getAttribute('height')), g.box[2], g.box[3]); out = nameAt(out, id, np[0], opt, np[1]); }
        }
        return;
      }
      if (au != null) {   // an activity's unit set in a draft the base predates, or a base of an older build without the properties
        if (Hfor !== out) { H = gml(out, opt); Hfor = out; }
        if (actOf(H, id) !== au) {
          if (cfgOf(H.node[id].geo.parentNode) === MAKE[actCls(au)] && actOf(H, id) == null) props[id] = { 'SBGN class': 'biological activity', 'SBGN unit': au || null, 'SBGN AF class': null };   // drawn so already: its properties, all in one pass below (a reading per activity takes seconds)
          else out = activity(out, id, au, opt);
        }
      } else if (KEPN.test(cls) || cls === 'phenotype' || cls === 'perturbation') {   // an activity of the base that the file has since turned PD (toPd): its class off, as the converter reads the entity; a perturbing agent turned a perturbation or back (toAf, toPd): its class
        if (Hfor !== out) { H = gml(out, opt); Hfor = out; }
        var pc = H.node[id] && propEl(H, id, 'SBGN class'), pv = pc ? ownText(pc).trim() : '', agent = cls === 'perturbing agent' || cls === 'perturbation';
        // the activity kept for the map turning AF again (so a unit set by hand does not go back to the base's, and a new
        // activity's and a protein's unit are not lost): its unit stays ('SBGN unit'), marked 'SBGN AF class' (afUnitOf),
        // neither drawn nor read by the converter
        if (H.node[id] && actOf(H, id) != null && !/ multimer$/.test(cls) && unitFor(cls) != null && cfgOf(H.node[id].geo.parentNode) !== MAKE[cls]) { out = activity(out, id, unitFor(cls), opt); H = gml(out, opt); Hfor = out; }   // a unit the file was written with since (a draft reopened): its shape
        if (H.node[id] && actOf(H, id) != null) props[id] = { 'SBGN class': agent ? cls : null, 'SBGN AF class': 'biological activity' };
        else if (H.node[id] && agent && /^(perturbing agent|perturbation)$/.test(pv) && pv !== cls) props[id] = { 'SBGN class': cls, 'SBGN unit': null };
      }
      if (cls === 'tag' || cls === 'terminal') {   // a tag joined to a submap or taken out of one in a draft the base predates
        if (Hfor !== out) { H = gml(out, opt); Hfor = out; }
        if (H.node[id] && isTag(H, id) && isTerm(H, id) !== (cls === 'terminal')) out = terminal(out, id, cls === 'terminal', opt);
      }
      if (PROC.test(cls) || GATES.test(cls)) {   // a process's (a gate's) kind changed in a draft the base predates: its sign
        if (Hfor !== out) { H = gml(out, opt); Hfor = out; }
        if (H.node[id] && classOfR(H.node[id].geo.parentNode) !== cls) out = kind(out, id, cls, opt);
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
    if (Object.keys(props).length) out = setPropsAll(out, props, opt);
    // arcs the editor made: their edges, the ends as the converter reads them from the file
    var A = [];
    Object.keys(S.arc).forEach(function (id) {
      var a = S.arc[id], E = ends(S, a), c = a.getAttribute('class'), head = ARROW[c];
      if (G.edge[id] || head == null || !S.glyph[E[0]] || !S.glyph[E[1]]) return;
      if (Hfor !== out) { H = gml(out, opt); Hfor = out; }
      if (!H.node[E[0]] || !H.node[E[1]]) return;
      var pts = E[4], o = at(S, E[0], a.getAttribute('source'), E[2], (pts.length ? pts : [E[3]])[0])
        .concat(at(S, E[1], a.getAttribute('target'), E[3], (pts.length ? pts[pts.length - 1] : E[2]), flux(a)));
      A.push([id, E[0], E[1], o, head, pts]);
    });
    if (A.length) out = edgesIn(out, H, A);
    return countsIn(out, S, opt);
  }

  // ---------- cardinality (the converter's D37): an arc's cardinality glyph in the file, its number as a label on the
  // edge in the GraphML, placed as layout.count_box and graphml.write place it (the same arithmetic, so the same digits)
  var CARD = /^\s*(\d+(\.\d+)?|\?)\s*$/;
  var LAB = ['<y:EdgeLabel alignment="center" backgroundColor="#FFFFFF" configuration="AutoFlippingLabel" distance="2.0" fontFamily="Dialog" fontSize="9" fontStyle="plain" height="',
    '" horizontalTextPosition="center" iconTextGap="4" lineColor="#9AA0A6" modelName="six_pos" modelPosition="', '" preferredPlacement="anywhere" ratio="', '" textColor="#9AA0A6" verticalTextPosition="bottom" visible="true" width="',
    '" x="', '" xml:space="preserve" y="', '">', '<y:PreferredPlacementDescriptor angle="0.0" angleOffsetOnRightSide="0" angleReference="absolute" angleRotationOnRightSide="co" distance="-1.0" frozen="true" placement="anywhere" side="anywhere" sideReference="relative_to_edge_flow"/></y:EdgeLabel>'];
  function countText(v) {   // layout.count_text: ?, or a number as Python writes it (2, not 2.0; 2.5); anything else null
    var m = CARD.exec(v == null ? '' : String(v));
    if (!m) return null;
    if (m[1] === '?') return '?';
    var n = Number(m[1]);
    return n === Math.floor(n) ? String(n) : repr(n);
  }
  function arcCard(a) { return kids(a, 'glyph').filter(function (c) { return c.getAttribute('class') === 'cardinality'; })[0] || null; }
  function arcCount(a) { var g = arcCard(a), l = g && kid(g, 'label'); return l ? countText(l.getAttribute('text')) : null; }
  function edgeLab(e) { return Array.prototype.filter.call(e.getElementsByTagNameNS(YNS, 'EdgeLabel'), function (l) { return CARD.test(ownText(l)); })[0] || null; }
  function isProcN(G, id) { var n = G.node[id]; return !!n && cfgOf(n.geo.parentNode) === 'Process'; }
  function fluxE(G, e) {   // layout.flux on the GraphML: a plain line at a process (either way) or a production out of one
    var ar = e.el.getElementsByTagNameNS(YNS, 'Arrows')[0], hd = ar ? ar.getAttribute('target') : 'none', s = isProcN(G, e.s), t = isProcN(G, e.t);
    return !!G.node[e.s] && !!G.node[e.t] && (((hd === 'none' || !hd) && s !== t) || (hd === 'delta' && s && !t));
  }
  function centreOf(b) { return [b[0] + b[2] / 2, b[1] + b[3] / 2]; }
  function borderOf(b, p) {   // sbgnml.border: where the line from the box's centre to p leaves it
    var c = centreOf(b), dx = p[0] - c[0], dy = p[1] - c[1];
    if (!dx && !dy) return c;
    var t = Math.min(dx ? b[2] / 2 / Math.abs(dx) : Infinity, dy ? b[3] / 2 / Math.abs(dy) : Infinity);
    return [c[0] + t * dx, c[1] + t * dy];
  }
  // a cardinality's place (pos): { r: how far along its line from the entity (0) to the process (1), s: its side, 1 on
  // the left of that way (the normal -uy, ux), -1 on the right }; null: the middle, above it (right of a line near upright)
  function countLine(G, e) {   // layout.count_line: the line from where it leaves its entity to where it meets its process
    var first = !isProcN(G, e.s), E = G.node[first ? e.s : e.t].box, Hb = G.node[first ? e.t : e.s].box, Hc = centreOf(Hb);
    var at = first ? e.off.slice(0, 2) : e.off.slice(2), hub = first ? e.off.slice(2) : e.off.slice(0, 2), pts = first ? e.pts : e.pts.slice().reverse();
    var nxt = pts.length ? pts[0] : [Hc[0] + hub[0], Hc[1] + hub[1]], Ec = centreOf(E);
    var p0 = at[0] || at[1] ? [Ec[0] + at[0], Ec[1] + at[1]] : borderOf(E, nxt);
    var p1 = hub[0] || hub[1] ? [Hc[0] + hub[0], Hc[1] + hub[1]] : borderOf(Hb, pts.length ? pts[pts.length - 1] : p0);
    return [p0].concat(pts, [p1]);
  }
  function lineLens(line) { var lens = []; for (var i = 0; i + 1 < line.length; i++) { var ax = line[i + 1][0] - line[i][0], ay = line[i + 1][1] - line[i][1]; lens.push(Math.sqrt(ax * ax + ay * ay)); } return lens; }
  function countOn(line, text, pos) {   // layout.count_on: the box [x, y, w, h] at pos on the line, a long side along it, 1 px off it
    var lens = lineLens(line), tot = 0, k = 0;
    lens.forEach(function (v) { tot += v; });
    var half = tot * (pos ? pos.r : 0.5);
    while (k < lens.length - 1 && half > lens[k]) { half -= lens[k]; k++; }
    var L = lens[k] || 1, ux = (line[k + 1][0] - line[k][0]) / L, uy = (line[k + 1][1] - line[k][1]) / L;
    if (!lens[k]) { ux = 1; uy = 0; }
    var mx = line[k][0] + ux * half, my = line[k][1] + uy * half, nx = -uy, ny = ux;
    if (pos ? pos.s < 0 : (Math.abs(ny) < 0.2 ? nx < 0 : ny > 0)) { nx = -nx; ny = -ny; }
    var w = 5 * text.length + 6, h = 11, side = 1 + Math.abs(nx) * w / 2 + Math.abs(ny) * h / 2;
    var cx = mx + nx * side, cy = my + ny * side;
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function countAlong(line, P) {   // layout.count_place's walk: the nearest point of the line to P as [r, s] (unrounded), null for a line of no length
    var lens = lineLens(line), tot = 0, acc = 0, best = null;
    lens.forEach(function (v) { tot += v; });
    if (!tot) return null;
    for (var k = 0; k < lens.length; k++) {
      if (!lens[k]) { acc += lens[k]; continue; }
      var a = line[k], ux = (line[k + 1][0] - a[0]) / lens[k], uy = (line[k + 1][1] - a[1]) / lens[k];
      var t = Math.max(0, Math.min(lens[k], (P[0] - a[0]) * ux + (P[1] - a[1]) * uy)), qx = a[0] + ux * t, qy = a[1] + uy * t;
      var d = Math.sqrt((P[0] - qx) * (P[0] - qx) + (P[1] - qy) * (P[1] - qy));
      if (!best || d < best[0]) best = [d, (acc + t) / tot, (P[0] - qx) * -uy + (P[1] - qy) * ux >= 0 ? 1 : -1];
      acc += lens[k];
    }
    return [best[1], best[2]];
  }
  function countPlace(line, b) {   // layout.count_place: the pos of a box [x, y, w, h] drawn by its line (null: the middle, its usual side)
    var q = countAlong(line, centreOf(b));
    if (!q) return null;
    var r = Math.round(q[0] * 10000) / 10000;
    if (Math.abs(r - 0.5) < 0.005) {
      var d = countOn(line, 'x', null), u = countOn(line, 'x', { r: 0.5, s: q[1] });
      if (Math.abs(d[0] - u[0]) < 0.01 && Math.abs(d[1] - u[1]) < 0.01) return null;
      r = 0.5;
    }
    return { r: r, s: q[1] };
  }
  function bboxOf(g) { var bb = g && kid(g, 'bbox'); return bb ? ['x', 'y', 'w', 'h'].map(function (k) { return parseFloat(bb.getAttribute(k)) || 0; }) : null; }
  function samePos(a, b) { return (!a && !b) || (!!a && !!b && Math.abs(a.r - b.r) < 0.00005 && a.s === b.s); }
  function labPos(l) {   // a label's pos: ratio and the six_pos side (scentr left, tcentr right), center the usual place
    var m = l.getAttribute('modelPosition'), r = parseFloat(l.getAttribute('ratio'));
    return m === 'scentr' || m === 'tcentr' ? { r: isNaN(r) ? 0.5 : r, s: m === 'scentr' ? 1 : -1 } : null;
  }
  function countBox(G, e, text, pos) { return countOn(countLine(G, e), text, pos); }
  function labXml(G, e, text, pos) {   // graphml.write's label: its place from where the line leaves its source
    var b = countBox(G, e, text, pos), S = G.node[e.s].box, Sc = centreOf(S);
    var s0 = e.off[0] || e.off[1] ? [Sc[0] + e.off[0], Sc[1] + e.off[1]] : borderOf(S, e.pts.length ? e.pts[0] : centreOf(G.node[e.t].box));
    return LAB[0] + repr(b[3]) + LAB[1] + (pos ? (pos.s > 0 ? 'scentr' : 'tcentr') : 'center') + LAB[2] + (pos ? repr(pos.r) : '0.5') + LAB[3] + repr(b[2]) + LAB[4] + repr(b[0] - s0[0]) + LAB[5] + repr(b[1] - s0[1]) + LAB[6] + esc(text) + LAB[7];
  }
  function countSet(T, G, e, want, pos) {   // the edge's label made, changed or taken out (as lxml writes it: before the </y:PolyLineEdge>)
    var have = edgeLab(e.el), x = want ? labXml(G, e, want, pos) : '';
    if (have) { var s0 = T.at.get(have)[0], s1 = T.end(have); if (T.t.slice(s0, s1) !== x) T.ed.push([s0, s1, x]); return; }
    if (!want) return;
    var pl = e.el.getElementsByTagNameNS(YNS, 'PolyLineEdge')[0] || e.path.parentNode, end = T.end(pl), close = T.t.lastIndexOf('</', end);
    T.ed.push([close, close, x]);
  }
  function countsIn(t, S, opt) {   // graphml(): every edge's label as its arc's cardinality (the converter's GraphML)
    if (t.indexOf('<y:EdgeLabel') < 0 && !Object.keys(S.arc).some(function (k) { return arcCard(S.arc[k]); })) return t;
    var G = gml(t, opt), T = new Tags(t, G.doc);
    Object.keys(G.edge).forEach(function (id) {
      var a = S.arc[id], e = G.edge[id];
      if (!a || !/^(consumption|production)$/.test(a.getAttribute('class') || '')) { if (edgeLab(e.el) && a) countSet(T, G, e, null); return; }
      var bb = bboxOf(arcCard(a)), want = fluxE(G, e) ? arcCount(a) : null;
      countSet(T, G, e, want, want && bb ? countPlace(countLine(G, e), bb) : null);
    });
    return T.text();
  }
  //   countOf(g, id) -> the number on the line (its cardinality: '' for none), undefined for a line that takes none
  //   recount(g, id, v) -> g with the line's number v ('' or null: none)
  function countOf(t, id, opt) {
    var G = gml(t, opt), e = G.edge[id];
    if (!e || !fluxE(G, e)) return undefined;
    var l = edgeLab(e.el);
    return l ? countText(ownText(l)) : '';
  }
  function recount(t, id, v, opt) {
    var G = gml(t, opt), e = G.edge[id], want = countText(v);
    if (!e || !fluxE(G, e)) return t;
    var T = new Tags(t, G.doc), l = edgeLab(e.el);
    countSet(T, G, e, want === '1' ? null : want, l ? labPos(l) : null);
    return T.text();
  }
  //   countsAt(g) -> { line id: { line (entity to process), text, pos, box } } of every line with a cardinality
  //   countMove(g, id, pos) -> g with the cardinality at pos (null: the middle)
  //   countsPlace(g) -> g with every cardinality placed again at its pos on its line as it runs now (after a move)
  function countsAt(t, opt) {   // every line with a cardinality, by its id (one read of the text)
    var o = {};
    if (t.indexOf('<y:EdgeLabel') < 0) return o;
    var G = gml(t, opt);
    Object.keys(G.edge).forEach(function (id) {
      var e = G.edge[id], l = fluxE(G, e) && edgeLab(e.el);
      if (!l) return;
      var text = countText(ownText(l)), pos = labPos(l), line = countLine(G, e);
      o[id] = { line: line, text: text, pos: pos, box: countOn(line, text, pos) };
    });
    return o;
  }
  function countMove(t, id, pos, opt) {
    var G = gml(t, opt), e = G.edge[id], l = e && fluxE(G, e) && edgeLab(e.el);
    if (!l) return t;
    var T = new Tags(t, G.doc), line = countLine(G, e);
    if (pos && Math.abs(pos.r - 0.5) < 1e-9) { var d = countOn(line, 'x', null), u = countOn(line, 'x', pos); if (Math.abs(d[0] - u[0]) < 0.01 && Math.abs(d[1] - u[1]) < 0.01) pos = null; }   // the middle on its usual side: the default
    countSet(T, G, e, countText(ownText(l)), pos);
    return T.text();
  }
  function countsPlace(t, opt) {
    if (t.indexOf('<y:EdgeLabel') < 0) return t;
    var G = gml(t, opt), T = new Tags(t, G.doc);
    Object.keys(G.edge).forEach(function (id) {
      var e = G.edge[id], l = edgeLab(e.el);
      if (l && fluxE(G, e)) countSet(T, G, e, countText(ownText(l)), labPos(l));
    });
    return T.text();
  }
  // write(): every arc's cardinality glyph as the GraphML's label says, the rest byte for byte; a glyph whose arc this save
  // moved (start, next or end changed from the file t0) placed again beside it
  function countsOut(t, gtext, opt, t0) {
    if (gtext.indexOf('<y:EdgeLabel') < 0 && !/class="cardinality"/.test(t)) return t;
    var G = gml(gtext, opt), S = sbgn(t, opt), T = new Tags(t, S.doc), ids = {}, S0 = t0 && t0 !== t ? sbgn(t0, opt) : null;
    var route = function (a) { return a ? kids(a).filter(function (c) { return /^(start|next|end)$/.test(c.localName); }).map(function (c) { return c.getAttribute('x') + ',' + c.getAttribute('y'); }).join(' ') : null; };
    Array.prototype.forEach.call(S.doc.getElementsByTagName('*'), function (el) { var i = el.getAttribute && el.getAttribute('id'); if (i) ids[i] = 1; });
    Object.keys(S.arc).forEach(function (id) {
      var a = S.arc[id], e = G.edge[id];
      if (!e || !/^(consumption|production)$/.test(a.getAttribute('class') || '')) return;
      var l = fluxE(G, e) && edgeLab(e.el), want = l ? countText(ownText(l)) : null, g = arcCard(a), have = arcCount(a);
      var pos = l ? labPos(l) : null, bb = g && kid(g, 'bbox'), line = want ? countLine(G, e) : null;
      var moved = !!(S0 && g && route(S0.arc[id]) !== route(a));   // its line moved by this save
      var dragged = !!(want && bb && !moved && !samePos(pos, countPlace(line, bboxOf(g))));   // its place changed here
      if (want === have && !dragged && (!g || !want || !moved)) return;
      if (!want) { T.cut(g); return; }
      var b = countOn(line, want, pos);
      if (g) {
        if (kid(g, 'label')) { if (have !== want) T.set(kid(g, 'label'), 'text', want); }
        else { var at0 = kid(g, 'bbox') ? T.at.get(kid(g, 'bbox'))[0] : T.end(g) - '</glyph>'.length; T.ed.push([at0, at0, '<label text="' + esc(want) + '"/>']); }
        if (bb && (moved || dragged)) ['x', 'y', 'w', 'h'].forEach(function (k, j) { T.set(bb, k, num(b[j])); });
        return;
      }
      var at = kids(a).filter(function (c) { return /^(glyph|port|start)$/.test(c.localName); })[0], gid = id + '_card', k = 2;   // (b above)
      while (ids[gid]) gid = id + '_card' + k++;
      var x = '<glyph class="cardinality" id="' + esc(gid) + '"><label text="' + esc(want) + '"/><bbox x="' + num(b[0]) + '" y="' + num(b[1]) + '" w="' + num(b[2]) + '" h="' + num(b[3]) + '"/></glyph>';
      if (at) { var p = T.at.get(at)[0]; T.ed.push([p, p, x + '\n' + T.indent(at)]); }
      else { var e1 = T.end(a), c1 = T.t.lastIndexOf('</', e1); T.ed.push([c1, c1, x]); }
    });
    return T.text();
  }

  // ---------- back into the SBGN-ML text ----------
  function write(t, gtext, opt) { return idsOut(refsOut(countsOut(nest(write0(t, gtext, opt), gtext, opt, t), gtext, opt, t), gtext, opt), gtext, opt); }
  function write0(t, gtext, opt) {
    var dropped = {}, was = gone(gtext), t0 = t;   // dropped: glyphs one of whose units of information was deleted; was: ids never given again (the comment stays with the GraphML)
    var own = mapKind(t);   // the file's own kind before the glyphs deleted in the editor go (else the last process deleted leaves the map PD)
    var G = gml(gtext, opt), mb = members(drop(t, was, opt, dropped), G, opt);   // what holds what as the GraphML has it
    t = mb[0];
    var S = mb[1] || sbgn(t, opt);
    var t1 = retag(t, S, G);   // a tag joined to a submap or taken out of one: written again where it now belongs
    if (t1 !== t) { t = t1; S = sbgn(t, opt); }
    var again = was.filter(function (id) { return !!G.node[id]; });   // a node under the id of one deleted: dropped and made again on every pass (runs out of memory; the editor never gives one)
    if (again.length) throw new Error('a node has the id of one deleted (' + again.join(', ') + ')');
    // what the map is now, the file and the editor's drawing together: where
    // that differs from what the file alone is, the file is turned to it first, its own glyphs and arcs included (toAf,
    // toPd); a file whose kind the edits leave as it was is written as before (write(s, conv(s)) is s)
    // A PD file whose links alone read as AF (entities and direct links, nothing only PD has) is reduced notation: SBGN-ML
    // has no field for the display, so it keeps its PD classes when edited, what is made in it written in PD's form
    // (an activity as the entity its unit names, a link under PD's name); only a map that becomes AF by its edits turns
    var K = { own: own, now: kinds(t, S, G) }, af;
    var turnAf = K.now === 'af' && K.own !== 'af';
    if (turnAf) { t = toAf(t, S, was); S = sbgn(t, opt); af = true; }
    else if (K.now !== K.own && (K.now === 'pd' || K.now === 'hybrid') && afForm(t, S)) { t = toPd(t, S); S = sbgn(t, opt); af = false; }
    else af = K.now === 'af' && afForm(t, S);
    var T = new Tags(t, S.doc);
    // not Activity Flow: an entity the editor holds as an activity is written as the entity its unit names (a file's
    // activity turned PD by toPd included, also one kept so in the GraphML made again, afUnitOf; else a unit set by
    // hand is written as the base file's)
    var unitCls = {};   // the classes set here: the entity's kind below leaves them (one class written once)
    if (!af) Object.keys(S.glyph).forEach(function (id) {
      var c = S.glyph[id].el.getAttribute('class') || '', u = G.node[id] ? afUnitOf(G, id) : null;
      if (u != null && KPLAIN.test(c) && !/ multimer$|^perturbing agent$/.test(c) && actCls(u) !== c) { T.set(S.glyph[id].el, 'class', actCls(u)); unitCls[id] = 1; }
    });
    var close = function (a, b) { return Math.abs(a - b) < 1e-6; };   // (used by the names below too)
    var iconsOf = function (id, kind) {   // [text, rx, ry] of a node's state variables (or units of information) in the GraphML
      return labelsOf(G, id).icons.filter(function (q) { return q[1].kind === (kind || 'StateVariable'); }).map(function (q) {
        var p = q[0].getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0];
        return [q[1].text || '', F(p.getAttribute('nodeRatioX')), F(p.getAttribute('nodeRatioY'))];
      });
    };
    // an activity's unit of information made another or taken off in the editor (activity()): its entity, its box where
    // the editor draws it (afUnitBox), a unit given where it had none; written below, not mapped with the glyph
    // Under AF the unit's text too (text allowed in an activity's unit, as SBGN-ML keeps it, libsbgn's
    // AF test files: a label beside the entity; ct:gene and ct:mRNA tell a gene's activity from an mRNA's)
    var aChanged = {};
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], want = G.node[id] ? afUnitOf(G, id) : null;
      if (want != null && g.el.getAttribute('class') === 'biological activity' && (want !== fileUnit(g.el) || (af && actText(G, id) !== fileUText(g.el)))) aChanged[id] = want;
    });
    // units of information changed in the editor (one added, deleted or retyped): all of the glyph's written again where
    // the GraphML has them (uBoxAt, layout.decorations' size); untouched ones stay as the file has them
    var uChanged = {};
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id];
      if (!G.node[id] || !NAMED.test(g.el.getAttribute('class') || '') || (af && g.el.getAttribute('class') === 'biological activity')) return;   // under AF an activity's one unit is aChanged's (its entity and text written whole)
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
    var svMoved = new Set(), uMovedTo = new Map();   // state variables and units the editor moved along their glyph's border: placed below, not mapped here
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
      if (uChanged[id]) return;   // units written whole below
      var hu = unitsOf(g.el);
      iconsOf(id, 'UnitOfInformation').forEach(function (q, j) {   // a unit moved along the border: the same
        var cb = hu[j] && kid(hu[j], 'bbox'), B = g.box;
        if (!cb) return;
        var N = n.box, sized = !close(B[2], N[2]) || !close(B[3], N[3]), ab = af && (sized || aChanged[id] != null) && g.el.getAttribute('class') === 'biological activity' && fileUnit(g.el) ? afUnitBox(N, fileUnit(g.el), unitText(hu[j])) : null;
        if (ab && close(q[1], (ab[0] + ab[2] / 2 - N[0] - N[2] / 2) / N[2]) && close(q[2], (ab[1] + ab[3] / 2 - N[1] - N[3] / 2) / N[3])) return;   // a resized activity's unit, or one set, at its place (resize and activity() put it at afUnitBox): placed below as such, not moved along the border
        var rx = (F(cb.getAttribute('x')) + F(cb.getAttribute('w')) / 2 - B[0] - B[2] / 2) / B[2], ry = (F(cb.getAttribute('y')) + F(cb.getAttribute('h')) / 2 - B[1] - B[3] / 2) / B[3];
        if (!close(rx, q[1]) || !close(ry, q[2])) { svMoved.add(cb); uMovedTo.set(cb, q); }
      });
    });
    // a compartment's name put in another of its six places in the editor (nameAt), or its compartment resized: its bbox
    // where yEd and yrender draw it now (nameBox on the new box), so graphml() reads that place back (namePlace); a name
    // whose place and box are unchanged follows its box below. A label written below with no bbox (a compartment made or
    // named here) gets one from labelBbox when its place is not the converter's top middle
    var pre = S.doc.documentElement.prefix ? S.doc.documentElement.prefix + ':' : '';
    var nameWant = function (id) {   // [place, distance, x, y, w, h] of the name in the editor's GraphML, its box absolute
      var n = G.node[id], l = n && cfgOf(n.geo.parentNode) === 'Compartment' ? labelsOf(G, id).main : null;
      if (!l) return null;
      var lw = F(l.getAttribute('width')), lh = F(l.getAttribute('height')), pos = l.getAttribute('modelPosition') || 't', bd = F(l.getAttribute('borderDistance')) || 0, at = nameBox(pos, bd, lw, lh, n.box[2], n.box[3]);
      return [pos, bd, n.box[0] + at[0], n.box[1] + at[1], lw, Math.max(1, lh - 4), lh];   // the file's height without yEd's 4 (sbgnml.write's lines x LINE)
    };
    var labelBbox = function (id) { var q = nameWant(id); return q && !(q[0] === 't' && q[1] === 0) ? '<' + pre + 'bbox x="' + num(q[2]) + '" y="' + num(q[3]) + '" w="' + num(q[4]) + '" h="' + num(q[5]) + '"/>' : ''; };
    var named = {};
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], q = nameWant(id), lab = kid(g.el, 'label');
      if (!q || !lab || g.el.getAttribute('class') !== 'compartment') return;
      var lb = kid(lab, 'bbox'), o = g.box, b = G.node[id].box, sized = !close(o[2], b[2]) || !close(o[3], b[3]);
      var have = lb ? namePlace(F(lb.getAttribute('x')) - o[0], F(lb.getAttribute('y')) - o[1], q[4], q[6], o[2], o[3]) : ['t', 0];   // no bbox: the converter's top middle
      if (!lb && q[0] === 't' && q[1] === 0) return;
      if (have[0] === q[0] && Math.abs(have[1] - q[1]) < 1e-6 && !sized) return;
      named[id] = [q[2], q[3], lb ? F(lb.getAttribute('w')) : q[4], lb ? F(lb.getAttribute('h')) : q[5], lab, lb];
    });
    var map = {};   // glyph id -> function from an old point to the new
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], n = G.node[id];
      if (!n) return;
      var o = g.box, b = n.box;
      if (o.every(function (v, j) { return close(v, b[j]); })) return;
      ['x', 'y', 'w', 'h'].forEach(function (k, j) { if (!close(o[j], b[j])) T.set(g.bbox, k, n.geo.getAttribute(['x', 'y', 'width', 'height'][j])); });
      var actU = g.el.getAttribute('class') === 'biological activity' && fileUnit(g.el) ? kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'unit of information'; })[0] : null;
      var f = map[id] = function (p) { return [b[0] + (o[2] ? (p[0] - o[0]) * b[2] / o[2] : b[2] / 2), b[1] + (o[3] ? (p[1] - o[1]) * b[3] / o[3] : b[3] / 2)]; };
      kids(g.el, 'glyph').forEach(function (c) {   // state variables, units of information, glyphs the converter left out
        var cb = kid(c, 'bbox');
        if (!cb || G.node[c.getAttribute('id')] || svMoved.has(cb) || ((uChanged[id] || aChanged[id] != null) && c.getAttribute('class') === 'unit of information')) return;
        if (af && c === actU && (!close(o[2], b[2]) || !close(o[3], b[3]))) {   // a resized activity's unit where the editor draws it (afUnitBox); a move carries it along as the file has it
          var ab = afUnitBox(b, fileUnit(g.el), unitText(actU));
          ['x', 'y', 'w', 'h'].forEach(function (k, j) { if (!close(F(cb.getAttribute(k)), ab[j])) T.set(cb, k, num(ab[j])); });
          return;
        }
        var w = F(cb.getAttribute('w')), h = F(cb.getAttribute('h')), m = f([F(cb.getAttribute('x')) + w / 2, F(cb.getAttribute('y')) + h / 2]);
        setXY(cb, [m[0] - w / 2, m[1] - h / 2]);
      });
      var lab = kid(g.el, 'label'), lb = lab && kid(lab, 'bbox');
      if (lb && !named[id]) setXY(lb, [F(lb.getAttribute('x')) + b[0] - o[0], F(lb.getAttribute('y')) + b[1] - o[1]]);
    });
    Object.keys(named).forEach(function (id) {
      var q = named[id], lab = q[4], lb = q[5];
      if (lb) { setXY(lb, [q[0], q[1]]); return; }
      var ls = T.at.get(lab), ind = T.indent(lab), box = '<' + pre + 'bbox x="' + num(q[0]) + '" y="' + num(q[1]) + '" w="' + num(q[2]) + '" h="' + num(q[3]) + '"/>';
      if (ls[2]) T.ed.push([ls[1] - 2, ls[1], '>\n' + ind + '  ' + box + '\n' + ind + '</' + T.t.slice(ls[0] + 1).match(/^[^\s/>]+/)[0] + '>']);   // <label .../> opened
      else { var le = T.t.lastIndexOf('</', T.end(lab) - 1); T.ed.push([le, le, '\n' + ind + '  ' + box + '\n' + ind]); }
    });
    // names and state variables set in the editor, and glyphs it made
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
    var actUnitXml = function (gid, unit, b, ind, keep, txt) { return actUnitTag(S, was, pre, gid, unit, b, ind, keep, txt); };
    Object.keys(aChanged).forEach(function (id) {
      var g = S.glyph[id], want = aChanged[id], b = G.node[id].box, u = kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'unit of information'; })[0];
      var e = u && kid(u, 'entity'), ub = u && kid(u, 'bbox');
      var txt = af ? actText(G, id) : '';
      if (u && !ub) return;
      if (af) unitsOf(g.el).forEach(function (c) { if (c !== u) T.cut(c); });   // under AF one unit: other units with text go (their text, if kept, is the one written)
      if (!want && !txt) { if (u) T.cut(af || !unitText(u) ? u : e); return; }   // taken off: under AF the whole unit (elsewhere a unit with text keeps its text, its entity goes)
      if (!u) { var e0 = T.end(g.bbox); T.ed.push([e0, e0, actUnitXml(id, want, b, T.indent(g.bbox), null, txt)]); return; }
      // under AF the whole unit written again: its text, its entity, at afUnitBox; under a new id when text comes where it had
      // none, so the drawing's font is the editor's (a kept id keeps the file's style for it, Newt's 9, never drawn before)
      if (af) { var s0 = T.at.get(u)[0], kept = txt && !unitText(u) ? null : u.getAttribute('id'); T.ed.push([s0, T.end(u), actUnitXml(id, want, b, T.indent(u), kept, txt).replace(/^\n\s*/, '')]); return; }
      if (e) T.set(e, 'name', want);
      else { var at4 = T.at.get(ub)[0]; T.ed.push([at4, at4, '<' + pre + 'entity name="' + esc(want) + '"/>\n' + T.indent(ub)]); }
      var nb = afUnitBox(b, want, unitText(u));
      ['x', 'y', 'w', 'h'].forEach(function (k, j) { if (!close(F(ub.getAttribute(k)), nb[j])) T.set(ub, k, num(nb[j])); });
    });
    Object.keys(S.glyph).forEach(function (id) {   // a process made omitted or uncertain, or the generic one again (its sign in the GraphML)
      var g = S.glyph[id], n = G.node[id], cls = g.el.getAttribute('class') || '', want = (n && (PROC.test(cls) || /^(and|or|not)$/.test(cls)) && classOfR(n.geo.parentNode)) || cls;
      if (want !== cls) {
        T.set(g.el, 'class', want);
        var gl = GATES.test(want) && kid(g.el, 'label');   // a gate's label, as the converter writes it (AND, OR, NOT)
        if (gl) T.set(gl, 'text', GATE[want]);
      }
    });
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], n = G.node[id], cls = g.el.getAttribute('class') || '';
      if (!n || !NAMED.test(cls)) return;
      var L = labelsOf(G, id), lab = kid(g.el, 'label');
      if (L.main && ownText(L.main) !== nameIn(g.el)) {
        if (lab) T.set(lab, 'text', ownText(L.main));
        else { var at1 = T.at.get(g.bbox)[0], ib = T.indent(g.bbox), lbx = labelBbox(id); T.ed.push([at1, at1, '<' + pre + 'label text="' + esc(ownText(L.main)) + '"' + (lbx ? '>\n' + ib + '  ' + lbx + '\n' + ib + '</' + pre + 'label>' : '/>') + '\n' + ib]); }
      }
      // made a multimer or a single macromolecule again: the class, where the converter would read the
      // file otherwise (a multimer with N:1 reads as one unit: left as it is)
      // an entity made another (entityKind): its class from the GraphML's shape, a multimer kept where the new class has one
      var b0 = cls.replace(/ multimer$/, ''), cf = classOfCfg(cfgOf(n.geo.parentNode)) || '', base = ENTITY.test(b0) && ENTITY.test(cf) ? cf : b0, multi = isMulti(G, id);
      var nowCls = MULTI.test(base) && (base !== b0 || multi !== drawnMulti(cls, iconsOf(id, 'UnitOfInformation').map(function (q) { return q[0]; }))) ? base + (multi ? ' multimer' : '') : base !== b0 ? base : null;   // judged by the units as now typed
      if (nowCls && nowCls !== cls && !unitCls[id]) T.set(g.el, 'class', nowCls);
      var have = kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; }), more = '';
      var icons = iconsOf(id), hu = unitsOf(g.el), ui = iconsOf(id, 'UnitOfInformation'), cutEls = [];
      have.slice(icons.length).forEach(function (c) { T.cut(c); cutEls.push(c); });   // deleted in the editor
      var moreU = '';
      if (uChanged[id]) {   // units of information: their text, all placed as the converter draws them, new ones written
        hu.slice(ui.length).forEach(function (c) { T.cut(c); cutEls.push(c); });
        ui.forEach(function (q, k) {
          var ub = uBoxAt(q[0], n.box, q[1], q[2]);
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
      hu.forEach(function (c) {   // a unit moved along the border: its box centred there, its size kept
        var cb = kid(c, 'bbox'), q = cb && uMovedTo.get(cb);
        if (q) setXY(cb, [n.box[0] + (0.5 + q[1]) * n.box[2] - F(cb.getAttribute('w')) / 2, n.box[1] + (0.5 + q[2]) * n.box[3] - F(cb.getAttribute('h')) / 2]);
      });
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
    // the look set in the editor's properties: fill, border colour and width
    var St = styles(S), looks = new Map();   // glyph id -> the look wanted, where it is not the file's
    var mf = null, mapFont = function () { return mf != null ? mf : (mf = Math.round(14 * scaleOf(S) + 0.01)); };   // the converter's font for a glyph whose file states none
    var gateFont = function () { return mapFont() !== 14 ? mapFont() : 12; };   // the converter's letters on a gate whose file states no font (graphml.write: yed.graphml's 12, else the map's)
    Object.keys(S.glyph).forEach(function (id) {
      var cls = S.glyph[id].el.getAttribute('class') || '';
      if (!G.node[id] || !LOOKS.test(cls)) return;   // the glyphs the editor restyles
      var want = lookG(G, id), have = fileLook(St, id, cls);
      // the name's font: written where it differs from the file's (a file stating none drawn at the map's, graphml.write)
      var font = (NAMED.test(cls) || GLT.test(cls)) && want.font != null && want.font !== (have.font != null ? have.font : NAMED.test(cls) ? mapFont() : gateFont()) ? want.font : have.font;   // a name's, or AND, OR and NOT's letters
      if (want.fill !== have.fill || want.line !== have.line || want.width !== have.width || font !== have.font) looks.set(id, { fill: want.fill, line: want.line, width: want.width, font: font, cls: cls });
    });
    Object.keys(S.arc).forEach(function (id) {   // a line's colour and width: the rest of its style (a fill some tools give) kept
      if (!G.edge[id]) return;
      var want = lineOf(G.edge[id].el), ww = widthOf(G.edge[id].el), have = fileLook(St, id), w = St.some(function (st) { return st.plain && st.has.width && st.ids.indexOf(id) >= 0; });
      if (want !== have.line || ww !== have.width) looks.set(id, { fill: have.fill, line: want, width: ww !== 1 || w ? ww : null, font: have.font, cls: 'arc' });   // black and 1 with nothing else: only out of its styles; 1 written where its style gave a width (Newt's own default is 1.25)
    });
    Object.keys(S.glyph).forEach(function (id) {   // a tag or terminal turned in the editor: its orientation
      var el = S.glyph[id].el;
      if (G.node[id] && /^(tag|terminal)$/.test(el.getAttribute('class') || '') && isTag(G, id) && fileWay(el) !== wayOf(G.node[id].geo.parentNode)) T.set(el, 'orientation', wayOf(G.node[id].geo.parentNode));
    });
    var mapEl = kids(S.doc.documentElement, 'map')[0], tops = kids(mapEl, 'glyph'), last = tops[tops.length - 1];
    var ind0 = last ? T.indent(last) : T.indent(mapEl) + '  ', fresh = '', front = '', made = {};
    // terminals made in the editor: inside their submap (subNode), the file's one or one made in this pass (termXml, written
    // with it below), after what it holds
    var termXml = {}, termOf = {};
    G.ids.forEach(function (id) {
      if (S.glyph[id] || !isTerm(G, id)) return;
      var sm = termSub(G, id, S);
      if (!sm) return;
      termOf[id] = sm;
      var L0 = labelsOf(G, id), tn = L0.main ? ownText(L0.main) : '', si = S.glyph[sm] ? T.indent(S.glyph[sm].bbox) : ind0 + '  ';
      var xml = '<' + pre + 'glyph class="terminal" id="' + esc(id) + '" orientation="' + wayOf(G.node[id].geo.parentNode) + '">' + (tn ? '\n' + si + '  <' + pre + 'label text="' + esc(tn) + '"/>' : '') +
        '\n' + si + '  ' + bboxXml(G.node[id].box) + '\n' + si + '</' + pre + 'glyph>';
      termXml[sm] = (termXml[sm] || '') + '\n' + si + xml;   // in the order made (one insertion per submap)
      var lk = lookG(G, id), lf = L0.main ? F(L0.main.getAttribute('fontSize')) || 12 : null, own = lf != null && lf !== mapFont();   // its look, as a glyph made below
      if (lk.fill || lk.line || lk.width !== 1 || own) looks.set(id, { fill: lk.fill, line: lk.line, width: lk.width, font: L0.main ? lf : null, cls: 'terminal', fresh: true, own: own });
    });
    Object.keys(termXml).forEach(function (sm) {   // into a submap of the file, before its end
      if (!S.glyph[sm]) return;
      var el = S.glyph[sm].el, se = T.t.lastIndexOf('</', T.end(el) - 1);
      T.ed.push([se, se, termXml[sm].replace(/^\n\s*/, '  ') + '\n' + T.indent(el)]);
    });
    G.ids.forEach(function (id) {
      if (S.glyph[id] || S.port[id] || S.arc[id] || id.indexOf('|') >= 0) return;
      var n = G.node[id], cls = classOfR(n.geo.parentNode), act = af ? afUnitOf(G, id) : null;
      if (!cls) return;
      if (af && act == null && !n.el.getAttribute('yfiles.foldertype') && unitFor(cls) != null) act = unitFor(cls);   // a plain entity made: under AF its activity (a protein's with no unit)
      if (act != null) cls = 'biological activity';   // on an Activity Flow map (elsewhere written as its entity)
      if (af && cls === 'perturbing agent') cls = 'perturbation';   // AF's name for it
      if (termOf[id]) { made[id] = 1; return; }   // a terminal: written with its submap (termXml)
      made[id] = 1;
      var up = n.el.parentNode; while (up && up.localName !== 'node') up = up.parentNode;
      var uid = up && up.getAttribute('id'), cref = uid && (S.glyph[uid] ? S.glyph[uid].el.getAttribute('class') === 'compartment' : !!G.node[uid] && cfgOf(G.node[uid].geo.parentNode) === 'Compartment') ? uid : null;   // a compartment of the file or made with it
      var L = labelsOf(G, id), name = L.main && !PROC.test(cls) ? ownText(L.main) : '', lk = lookG(G, id);   // a process's sign is its class, no label
      if (GATES.test(cls)) name = /^(equivalence|delay)$/.test(cls) ? '' : GATE[cls];   // a gate's label as sbgnml.write writes it (none on the equivalence, the spec 2.9.4, nor on a delay: its class says it)
      var fu = iconsOf(id, 'UnitOfInformation');
      var xml = '\n' + ind0 + '<' + pre + 'glyph class="' + cls + (isMulti(G, id) && MULTI.test(cls) ? ' multimer' : '') + '" id="' + esc(id) + '"' + (cref ? ' compartmentRef="' + esc(cref) + '"' : '') + (cls === 'tag' ? ' orientation="' + wayOf(n.geo.parentNode) + '"' : '') + '>' +
        (name ? '\n' + ind0 + '  <' + pre + 'label text="' + esc(name) + '"' + (cls === 'compartment' && labelBbox(id) ? '>\n' + ind0 + '    ' + labelBbox(id) + '\n' + ind0 + '  </' + pre + 'label>' : '/>') : '') + '\n' + ind0 + '  ' + bboxXml(n.box) +
        (act != null ? (act || (fu[0] && fu[0][0]) ? actUnitXml(id, act, n.box, ind0 + '  ', null, fu[0] ? fu[0][0] : '') : '') :   // under AF no state variables, one unit with its text
        iconsOf(id).map(function (q, k) { return svXml(id, k, q, n.box, ind0 + '  '); }).join('') +
        fu.map(function (q, k) { return uiXml(id, k, q[0], uBoxAt(q[0], n.box, q[1], q[2]), ind0 + '  '); }).join('')) + (termXml[id] || '') + '\n' + ind0 + '</' + pre + 'glyph>';
      if (cls === 'compartment') front += xml; else fresh += xml;   // a compartment before the glyphs, as the editor draws it under them
      var lf = L.main ? F(L.main.getAttribute('fontSize')) || 12 : null, own = lf != null && (NAMED.test(cls) ? lf !== mapFont() : GLT.test(cls) && lf !== gateFont());   // a font of its own, not the map's (a gate's letters: not the converter's)
      if (lk.fill || lk.line || lk.width !== 1 || own) looks.set(id, { fill: lk.fill, line: lk.line, width: lk.width, font: L.main ? lf : null, cls: cls, fresh: true, own: own });
    });
    var ext = restyle0(S, T, St, looks, pre);   // a render extension written for an empty <map/>: put into it below
    if (front && tops.length) { var f0 = T.at.get(tops[0])[0]; T.ed.push([f0, f0, front.replace(/^\n\s*/, '') + '\n' + T.indent(tops[0])]); }
    else fresh = front + fresh;
    if (fresh) {
      var ms = T.at.get(mapEl);
      if (!last && ms[2]) T.ed.push([ms[0], ms[1], T.t.slice(ms[0], ms[1] - 2).replace(/\s+$/, '') + '>' + (ext || '') + fresh + '\n' + T.indent(mapEl) + '</' + pre + 'map>']);   // an empty <map/>
      else { var e2 = last ? T.end(last) : T.t.lastIndexOf('</', T.end(mapEl) - 1); T.ed.push([e2, e2, fresh.replace(/\s+$/, '') + (last ? '' : '\n' + T.indent(mapEl))]); }   // an empty <map></map>: before its end, after an extension written at its start
    }
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
      var hc = headClass(headOf(e)), pc = PD_ARC[cls] || cls;   // a modulation made another in the editor: its class from the arrowhead (an influence's under AF's name)
      if (MODS.test(pc) && hc && MODS.test(hc) && hc !== pc) T.set(a, 'class', (af || PD_ARC[cls]) && AF_ARC[hc] ? AF_ARC[hc] : hc);
      // an end moved to another glyph (the editor): the arc names that glyph, its port set below; the
      // arrowhead-less line is a consumption at a process and a logic arc at a gate (one connector for both)
      var moved = [0, 1].map(function (j) { var g = j ? e.t : e.s; return E[j] !== g && !!G.node[E[j]] && !!G.node[g] && !!S.glyph[g]; });
      moved.forEach(function (m, j) { if (m) { E[j] = ref[j] = j ? e.t : e.s; E[2 + j] = null; } });
      if (moved[0] || moved[1]) {
        var hub = (S.glyph[E[1]] && S.glyph[E[1]].el.getAttribute('class')) || '';
        if (cls === 'consumption' && GATES.test(hub)) cls = 'logic arc';
        else if (cls === 'logic arc' && HUB.test(hub) && !GATES.test(hub)) cls = 'consumption';
        if (cls !== a.getAttribute('class')) T.set(a, 'class', cls);
      }
      if (E[0] !== e.s || E[1] !== e.t || !G.node[E[0]] || !G.node[E[1]] || !S.glyph[E[0]] || !S.glyph[E[1]]) return;
      var nx = kids(a, 'next');
      if (nx.length !== e.pts.length || nx.some(function (q, j) { var p = xy(q); return !close(p[0], e.pts[j][0]) || !close(p[1], e.pts[j][1]); })) {
        var pre = a.prefix ? a.prefix + ':' : '';
        var yx = nx.length && /\sy\s*=[^>]*\sx\s*=/.test(T.t.slice(T.at.get(nx[0])[0], T.at.get(nx[0])[1]));   // the file's own order of x and y kept (the SBGN website's files write y first)
        var out = e.pts.map(function (p, j) { var x = 'x="' + e.ptEl[j].getAttribute('x') + '"', y = 'y="' + e.ptEl[j].getAttribute('y') + '"'; return '<' + pre + 'next ' + (yx ? y + ' ' + x : x + ' ' + y) + '/>'; });
        if (nx.length) {
          var ind = '\n' + T.indent(nx[0]);
          var from = T.at.get(nx[0])[0];
          if (!out.length) from = T.end(prevEl(nx[0]));   // all taken out: from the tag before them (a one-line file too)
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
                 old: q[4] && (map[gid] ? map[gid](q[4]) : q[4]) };   // with its glyph, scaled when the box was resized
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
      var cut = function (s, aim) { return boxCut(G.node[s.gid].box, aim); };
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
        var no = q[0] === 'source' ? 2 : /^(consumption|logic arc)$/.test(cls) ? 1 : 0;   // what leaves a process or gate (a production, a gate's output: a logic arc or a modulation) from its port two
        if (!s.zero && out2 && no && HUB.test(S.glyph[s.gid].el.getAttribute('class') || '')) {   // at a port of a process or gate
          // the arc named the glyph: now the port its glyph's other consumptions (products) use, else a port made
          var have = kids(S.glyph[s.gid].el, 'port').map(function (x) { return x.getAttribute('id'); }), other = use[s.gid + '\u0000' + (3 - no)];
          var pid = use[s.gid + '\u0000' + no] || (have.length >= 2 ? have.filter(function (x) { return x !== other; })[other ? 0 : no - 1] : null);
          var proc = !GATES.test(S.glyph[s.gid].el.getAttribute('class') || ''), d2 = function (Q) { return Q ? Math.hypot(Q[0] - P[0], Q[1] - P[1]) : Infinity; };
          if (no === 2 && proc && have.length >= 2) {   // a production of a reversible process leaves from the nearer port (the converter's sbgnml.write)
            var now = function (x) { return portAt[x] || (map[s.gid] ? map[s.gid](xy(S.port[x])) : xy(S.port[x])); };
            var near = have.slice().sort(function (x, y) { return d2(now(x)) - d2(now(y)); })[0];
            if (near !== pid && d2(now(near)) + 0.5 < d2(now(pid))) pid = near;
          }
          if (pid) { ref[j0] = pid; portAt[pid] = portAt[pid] || P; }
          else {
            var np = newPorts[s.gid] = newPorts[s.gid] || {}, k = no;
            if (no === 2 && proc && np[2] && d2(np[2]) > 0.5 && (!np[1] || d2(np[1]) <= 0.5)) k = 1;   // a bare process's second production, on the other side: its port in
            np[k] = np[k] || P;
            ref[j0] = newId(s.gid, k);
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
      if (!g.el.getAttribute('orientation') && HUB.test(g.el.getAttribute('class') || '') && !GATES.test(g.el.getAttribute('class'))) T.set(g.el, 'orientation', Math.abs(P[2][0] - P[1][0]) >= Math.abs(P[2][1] - P[1][1]) ? 'horizontal' : 'vertical');   // a bare process given its ports by its first arc
    });
    // a process's orientation, where the file gives one, follows its ports
    Object.keys(S.glyph).forEach(function (gid) {
      var g = S.glyph[gid], o = g.el.getAttribute('orientation');
      if (!o || !G.node[gid]) return;
      var ps = kids(g.el, 'port').map(function (p) { return portAt[p.getAttribute('id')] || (map[gid] ? map[gid](xy(p)) : xy(p)); });   // a free port where its glyph's move put it (compared with moved ones, a process can flip)
      if (ps.length < 2) return;
      var want = Math.abs(ps[1][0] - ps[0][0]) >= Math.abs(ps[1][1] - ps[0][1]) ? 'horizontal' : 'vertical';
      if (want !== o) T.set(g.el, 'orientation', want);
    });
    // an arc's end moved onto a glyph made in this editing (a bare process and its first arc): that glyph is in the file
    // only now, so the arcs are written again on the text that has it (else the move is lost on save); the
    // rest of a second pass changes nothing, the file already holding it
    if (Object.keys(G.edge).some(function (k) { return S.arc[k] && (made[G.edge[k].s] || made[G.edge[k].t]); })) return write(T.text(), gtext, opt);
    // arcs made in the editor: written after the file's arcs, naming their glyphs, their ends where the
    // GraphML has them; the second pass then gives a process end its port (a bare process its two, and its orientation)
    var out = T.text(), S2 = null, add = [];
    Object.keys(G.edge).forEach(function (k) {
      var e = G.edge[k];
      if (S.arc[k] || S.glyph[k] || S.port[k] || was.indexOf(k) >= 0) return;
      S2 = S2 || sbgn(out, opt);
      if (!S2.glyph[e.s] || !S2.glyph[e.t] || !G.node[e.s] || !G.node[e.t]) return;   // an end the file does not have (a glyph the converter left out)
      var cls = arcClass(G, e, S2);
      if (!cls) return;
      if (af && AF_ARC[cls]) cls = AF_ARC[cls];   // an influence (AF's names in an Activity Flow file)
      var pre2 = S2.doc.documentElement.prefix ? S2.doc.documentElement.prefix + ':' : '', pt = function (tag, p) { return '<' + pre2 + tag + ' x="' + num(p[0]) + '" y="' + num(p[1]) + '"/>'; };
      var A = [G.node[e.s].box, G.node[e.t].box].map(function (bb, j) { var c = centre(bb); return [c[0] + e.off[2 * j], c[1] + e.off[2 * j + 1]]; });
      // an end at the centre: where the line toward the next point leaves the box (sbgnml.at reads it back as the centre);
      // an end off it (a port of a process) at the centre at first, so the second pass sees it moved and names the port
      var P2 = [0, 1].map(function (j) {
        var aim = e.pts.length ? e.pts[j ? e.pts.length - 1 : 0] : A[1 - j], b = j ? G.node[e.t].box : G.node[e.s].box;
        return e.off[2 * j] || e.off[2 * j + 1] ? centre(b) : boxCut(b, aim);
      });
      add.push({ xml: '<' + pre2 + 'arc class="' + cls + '" id="' + esc(k) + '" source="' + esc(e.s) + '" target="' + esc(e.t) + '">',
                 body: [pt('start', P2[0])].concat(e.pts.map(function (p) { return pt('next', p); }), [pt('end', P2[1])]), end: '</' + pre2 + 'arc>' });
    });
    if (!add.length) return out;
    var T2 = new Tags(out, S2.doc), mapEl2 = kids(S2.doc.documentElement, 'map')[0], arcs2 = kids(mapEl2, 'arc'), glyphs2 = kids(mapEl2, 'glyph');
    var after = arcs2.length ? arcs2[arcs2.length - 1] : glyphs2[glyphs2.length - 1], ind3 = T2.indent(after), at3 = T2.end(after);
    T2.ed.push([at3, at3, add.map(function (q) { return '\n' + ind3 + q.xml + q.body.map(function (x) { return '\n' + ind3 + '  ' + x; }).join('') + '\n' + ind3 + q.end; }).join('')]);
    return write(T2.text(), gtext, opt);
  }

  // ---------- membership: what holds a glyph ----------
  // In the editor's GraphML a node's parent node holds it (yEd's nesting, on every format the editor edits); in SBGN-ML
  // a top glyph's compartmentRef names its compartment and a complex's members are glyphs inside the complex glyph
  // (sbgnml.read). The editor decides membership by geometry and moves nodes in its GraphML (moveInto; into a complex:
  // join); write() puts that into the file (members; into a complex: nest), graphml() takes it from the file (renest;
  // into a complex: nestG).
  //   moveInto(g, moves) -> g with each node, with what it holds, moved into another node's graph (moves: [[node id, parent
  //     node id or null for the top graph], ...], in that order): a compartment first in its new graph, so it lies under
  //     what is there, any other node before the graph's edges; a graph made in a group that has none; the rest byte for byte
  var COMPLEX = /^complex( multimer)?$/;
  function elEnd(t, name, at) {   // where the element whose start tag is at `at` ends (nested ones of its name counted)
    var re = new RegExp('<(/?)' + name + '(?=[\\s>/])[^>]*?(/?)>', 'g'), m, depth = 0;
    re.lastIndex = at;
    while ((m = re.exec(t))) { if (m[1]) depth--; else if (!m[2]) depth++; if (depth <= 0) return m.index + m[0].length; }
    return t.length;
  }
  function nodeAt(t, id) { var m = new RegExp('<node(?=[\\s>/])[^>]*?\\sid="' + esc(id).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '"').exec(t); return m ? m.index : -1; }
  function isGroup(t, at) { return /^<node(?=[\s>\/])[^>]*?\syfiles\.foldertype="group"/.test(t.slice(at, t.indexOf('>', at) + 1)); }
  function moveInto(t, moves) {
    moves.forEach(function (mv) {
      var at = nodeAt(t, mv[0]);
      if (at < 0) throw new Error('no node ' + mv[0]);
      var end = elEnd(t, 'node', at), block = t.slice(at, end), nl = t.lastIndexOf('\n', at - 1), from = nl >= 0 && /^[ \t]*$/.test(t.slice(nl + 1, at)) ? nl : at;
      if (mv[1] != null) { var pa = nodeAt(t, mv[1]); if (pa < 0) throw new Error('no node ' + mv[1]); if (pa >= at && pa < end) throw new Error(mv[1] + ' lies inside ' + mv[0]); }
      var gi = block.search(/<graph(?=[\s>\/])/), head = gi >= 0 ? block.slice(0, gi) : block;
      var comp = isGroup(block, 0) && !/configuration="com\.yworks\.sbgn\.Complex"/.test(head);   // a compartment: first in its graph
      t = t.slice(0, from) + t.slice(end);
      var g;
      if (mv[1] == null) g = t.search(/<graph(?=[\s>\/])/);
      else {
        var p = nodeAt(t, mv[1]), pEnd = elEnd(t, 'node', p), k = t.slice(p, pEnd).search(/<graph(?=[\s>\/])/);
        if (k < 0) {   // a group with no graph yet: one made before the group's end tag
          if (!isGroup(t, p)) throw new Error(mv[1] + ' is not a group');
          var c = t.lastIndexOf('</', pEnd - 1);
          t = t.slice(0, c) + '<graph edgedefault="directed" id="' + esc(mv[1]) + ':">' + block + '</graph>' + t.slice(c);
          return;
        }
        g = p + k;
      }
      var tagEnd = t.indexOf('>', g);
      if (t[tagEnd - 1] === '/') { t = t.slice(0, tagEnd - 1).replace(/\s+$/, '') + '>' + block + '</graph>' + t.slice(tagEnd + 1); return; }   // an empty graph
      var close = t.lastIndexOf('</', elEnd(t, 'graph', g) - 1), re = /<(\/?)(node|edge)(?=[\s>\/])[^>]*?(\/?)>/g, m, depth = 0, pos = close;
      re.lastIndex = tagEnd + 1;
      while ((m = re.exec(t)) && m.index < close) {   // the graph's own first node (for a compartment) or first edge
        if (!depth && !m[1] && (comp || m[2] === 'edge')) { pos = m.index; break; }
        if (m[2] === 'node' && !m[3]) depth += m[1] ? -1 : 1;
      }
      var ls = t.lastIndexOf('\n', pos - 1) + 1, lead = t.slice(ls, pos);
      if (ls > 0 && /^[ \t]*$/.test(lead)) t = pos === close ? t.slice(0, ls) + lead + '  ' + block + '\n' + t.slice(ls) : t.slice(0, pos) + block + '\n' + lead + t.slice(pos);
      else t = t.slice(0, pos) + block + t.slice(pos);
    });
    return t;
  }
  function gUp(G, id) { var u = upNode(G.node[id].el); return u ? u.getAttribute('id') : null; }   // the node that holds it in the GraphML
  function fileUp(el) {   // the glyph that holds it, as sbgnml.read nests it: a complex its members, a top glyph its compartmentRef; a glyph inside any other glyph sits beside it
    var p = el.parentNode;
    if (p.localName === 'map') return el.getAttribute('compartmentRef') || null;
    return COMPLEX.test(p.getAttribute('class') || '') ? p.getAttribute('id') : fileUp(p);
  }
  // the GraphML made from a base nested as the file says (a draft reopened, a file turned and made again): where they differ
  function renest(S, out, opt) {
    var G = gml(out, opt), moves = [];
    Object.keys(S.glyph).forEach(function (id) {
      if (!G.node[id]) return;
      var want = fileUp(S.glyph[id].el);
      if (want != null && !G.node[want]) want = null;
      if (want === gUp(G, id) || (want != null && cfgOf(G.node[want].geo.parentNode) === 'Complex')) return;   // into a complex: nestG
      moves.push([id, want]);
    });
    if (!moves.length) return out;
    try { return moveInto(out, moves); } catch (e) { return out; }   // nested in a way the GraphML cannot follow: as the base has it
  }
  // the file nested as the editor's GraphML: a top glyph's compartmentRef set or taken off; a complex's member the
  // GraphML takes out of it put after the complex's top glyph, with the compartmentRef the GraphML gives it; never into a
  // complex (the editor puts nothing into one). One member at a time, the file read again after each. -> [text, its reading or null]
  function members(t, G, opt) {
    for (;;) {
      var S = sbgn(t, opt), T = new Tags(t, S.doc), out = null, refs = [];
      Object.keys(S.glyph).some(function (id) {
        var el = S.glyph[id].el;
        if (!G.node[id]) return false;
        var have = fileUp(el), want = gUp(G, id);
        if (have != null && !G.node[have]) have = null;
        if (have === want || (want != null && cfgOf(G.node[want].geo.parentNode) === 'Complex')) return false;
        var p = el.parentNode;
        if (p.localName === 'map') { refs.push([el, want]); return false; }
        if (!COMPLEX.test(p.getAttribute('class') || '') || p.getAttribute('id') !== have) return false;   // inside a glyph that is no complex: as the file has it
        var top = el; while (top.parentNode.localName !== 'map') top = top.parentNode;
        var s = T.at.get(el), block = t.slice(s[0], T.end(el)), tag = block.slice(0, s[1] - s[0]).replace(/\s+compartmentRef\s*=\s*("[^"]*"|'[^']*')/, '');
        if (want != null) tag = tag.replace(/\s*(\/?)>$/, ' compartmentRef="' + esc(want) + '"$1>');
        T.cut(el);
        var e = T.end(top); T.ed.push([e, e, '\n' + T.indent(top) + tag + block.slice(s[1] - s[0])]);
        out = T.text();
        return true;
      });
      if (out != null) { t = out; continue; }
      refs.forEach(function (q) { if (q[1] == null) T.unset(q[0], 'compartmentRef'); else T.set(q[0], 'compartmentRef', q[1]); });
      return refs.length ? [T.text(), null] : [t, S];   // the file read, when it stays as it was
    }
  }

  // ---------- creating (entities added from a palette as in yEd and Newt) ----------
  // What the editor adds is written into its GraphML as graphml.write writes it (the yed.graphml templates, its label
  // and icon sizes), write() puts it into the SBGN-ML text, and graphml() makes it again from the SBGN-ML text (a draft
  // reopened before the build has drawn it). Among them: a macromolecule, its name, its state variables; a simple chemical and
  // its name (no state variable or unit of information: the glyph set the editor offers, CellDesigner keeps none).
  //   defaults(sbgnText, opt, cls) -> { w, h, font, fill, fallback } of a new glyph of that class on that map (its scale,
  //   the style most of the map's glyphs of that class use; no fill where they have none; the Default colours, fallback
  //   true, where the map has no glyph of that class); cls defaults to macromolecule
  //   add(g, { id, cls, label, box, parent, fill, font }) -> g with the node (parent: a compartment's node id)
  //   label(g, id, text) -> g with the node's name; state(g, id, value, rx, ry) -> g with a state variable added at that
  //   point of the border (rx, ry from the centre, as yEd's nodeRatio); stateValue(g, id, j, value): its j-th one's value
  //   resize(g, id, [x, y, w, h]) -> g with the node's box set, its name, state variables and line ends following
  var CHAR = 9.5, LINE = 16.5, ICON_CHAR = 5.4;   // graphml.py: a label line's height and a character's width at 14; an icon's character
  // what the palette makes: SBGN class -> yEd's configuration (a compartment is yEd's GroupNode, which has none: cfgOf);
  // the perturbing agent, phenotype, nucleic acid feature, empty set, complex, submap, compartment (2 px border) and
  // unspecified entity as graphml.write writes
  // each from its template in mapconv/yed.graphml (the master; the realizers below copy it): a complex made empty is the
  // plain Complex (a group only once it has members), a compartment the template's GroupNode with its 2 px border
  var MAKE = { macromolecule: 'Macromolecule', 'simple chemical': 'SimpleChemical', 'nucleic acid feature': 'NucleicAcidFeature',
               'unspecified entity': 'UnspecifiedEntity', complex: 'Complex', 'perturbing agent': 'PerturbingAgent', 'source and sink': 'EmptySet',
               phenotype: 'Phenotype', submap: 'Submap', compartment: 'Compartment',
               // processes (process, omitted, uncertain; no association or dissociation): yEd's
               // Process, the omitted and the uncertain one labelled with their sign (graphml.PROCESS_LABEL); made bare, no
               // ports or orientation in the file until a first arc gives them (yrender draws no antennas without arcs)
               process: 'Process', 'omitted process': 'Process', 'uncertain process': 'Process',
               // logic gates (AND, OR, NOT and the identity gate, SBGN's
               // equivalence operator): yEd's Operator labelled AND, OR, NOT or the equivalence's sign (graphml.EQUIV); made
               // bare as a process is, its ports written by its first arc
               and: 'Operator', or: 'Operator', not: 'Operator', equivalence: 'Operator',
               // Activity Flow's delay (the palette's AF tab): yEd's Operator labelled tau (graphml.DELAY), drawn as the equivalence
               delay: 'Operator',
               // a tag, and a submap's terminal (the node property SBGN class terminal): yEd's Tag, its point by its way
               tag: 'Tag' };
  var SIGN = { 'omitted process': '\\\\', 'uncertain process': '?' }, PROC = /^(process|omitted process|uncertain process)$/;
  var GATE = { and: 'AND', or: 'OR', not: 'NOT', equivalence: '\u2261', delay: '\u03c4' }, GATES = /^(and|or|not|equivalence|delay)$/;   // sbgnml.OPERATORS
  // sizes at the map's scale: the converter's standard ones (style.py) where it has them, else on the 8 grid near the
  // templates' (an empty complex 144 by 64, the empty set 32)
  var SIZE = { macromolecule: [80, 40], 'simple chemical': [40, 40], 'nucleic acid feature': [80, 40], 'unspecified entity': [80, 40], complex: [144, 64],
               'perturbing agent': [80, 40], 'source and sink': [32, 32], phenotype: [120, 40], submap: [120, 64], compartment: [400, 320],
               process: [20, 20], 'omitted process': [20, 20], 'uncertain process': [20, 20],   // a process: 20, room for its sign (the yEd maps' 18 before)
               and: [24, 24], or: [24, 24], not: [24, 24], equivalence: [24, 24], delay: [24, 24],   // a gate: 24, its letters 10 (GATE_FONT; the yEd maps' 30 and 12 before)
               'biological activity': [80, 40], tag: [48, 32] };   // every activity a protein's size, whatever its unit: 80 by 40; a tag 48 by 32, near a simple chemical's size
  // a process's or gate's antenna: ANT px from its box's side to its port (one length whatever the glyph's size), for
  // ports the editor works out (a bare glyph's first arc, the second arc's guess); a file's own ports and ports set in
  // Properties (antenna) kept as they are. GATE_FONT: AND, OR and NOT's letters on a new gate at the standard scale
  var ANT = 10, GATE_FONT = 10, GLT = /^(and|or|not)$/;
  function antFor(opt, gate) { var a = opt && opt.ant, v = a ? a[gate ? 'gate' : 'process'] : null; return v != null && v >= 1 ? v : ANT; }   // opt.ant: { process, gate }, the editor's choice (Style)
  function isHub(G, id) { return !!G.node[id] && /\.(Process|Operator)$/.test(G.node[id].geo.parentNode.getAttribute('configuration') || ''); }
  // the antenna of an end at offset (x, y) from the centre of box b: its length beyond the box along the nearer axis, or
  // null for an end that is no port (the centre, on a side: a modulation's)
  function portLen(b, x, y) {
    var hz = Math.abs(x) >= Math.abs(y), a = Math.abs(hz ? x : y), half = (hz ? b[2] : b[3]) / 2;
    return a > half + 0.5 && Math.abs(hz ? y : x) <= 0.5 ? a - half : null;
  }
  function cfgOf(r) { return r.localName === 'GroupNode' ? 'Compartment' : (r.getAttribute('configuration') || '').replace('com.yworks.sbgn.', ''); }
  function classOfCfg(cfg) { var c = null; Object.keys(MAKE).forEach(function (k) { if (!c && MAKE[k] === cfg) c = k; }); return c; }
  function classOfR(r) {   // the class a realizer of the editor's GraphML stands for: a process's by its sign
    var cfg = cfgOf(r);
    if (cfg !== 'Process' && cfg !== 'Operator') return classOfCfg(cfg);
    var l = kids(r, 'NodeLabel').filter(function (x) { return !x.getAttribute('iconData'); })[0], t = l ? ownText(l).trim() : '';
    if (cfg === 'Operator') return Object.keys(GATE).filter(function (k) { return GATE[k] === t || GATE[k] === t.toUpperCase(); })[0] || null;   // tau as it is (its upper case is another letter)
    return Object.keys(SIGN).filter(function (k) { return SIGN[k] === t; })[0] || 'process';
  }
  // a tag's or terminal's way (its point): SBGN-ML's orientation (horizontal, its default, to the right); in the GraphML
  // yEd's two, plain to the right and the style property inverse to the left, and orientation up or down (graphml.write)
  var WAYS = /^(left|right|up|down)$/;
  function fileWay(el) { var o = el.getAttribute('orientation') || ''; return WAYS.test(o) ? o : 'right'; }
  function wayOf(r) {
    var p = {};
    kids(kid(r, 'StyleProperties') || r, 'Property').forEach(function (q) { p[(q.getAttribute('name') || '').replace('com.yworks.sbgn.style.', '')] = q.getAttribute('value'); });
    return WAYS.test(p.orientation || '') ? p.orientation : p.inverse === 'true' ? 'left' : 'right';
  }
  function wayXml(w) {
    return w === 'right' ? '' : '<y:StyleProperties>\n            ' + (w === 'left' ? '<y:Property class="java.lang.Boolean" name="com.yworks.sbgn.style.inverse" value="true"/>'
      : '<y:Property class="java.lang.String" name="com.yworks.sbgn.style.orientation" value="' + w + '"/>') + '\n          </y:StyleProperties>\n';
  }
  function setWay(T, r, w) {   // a Tag's realizer pointing that way; other style properties a yEd file gave kept
    if (wayOf(r) === w) return;
    var sp = kid(r, 'StyleProperties'), ps = sp ? kids(sp, 'Property') : [], mine = function (q) { return /\.style\.(inverse|orientation)$/.test(q.getAttribute('name') || ''); };
    if (sp && ps.some(function (q) { return !mine(q); })) {   // its own properties stay: only the way's taken out and put in
      ps.filter(mine).forEach(function (q) { T.cut(q); });
      var m = wayXml(w).match(/<y:Property[^>]*\/>/), e1 = T.t.lastIndexOf('</', T.end(sp) - 1);
      if (m) T.ed.push([e1, e1, '  ' + m[0] + '\n' + T.indent(sp)]);
      return;
    }
    if (sp) T.cut(sp);
    var e = T.t.lastIndexOf('</', T.end(r) - 1);
    if (w !== 'right') T.ed.push([e, e, '  ' + wayXml(w) + T.indent(r)]);
  }
  function isTag(G, id) { return !!G.node[id] && cfgOf(G.node[id].geo.parentNode) === 'Tag'; }
  function isTerm(G, id) { var d = isTag(G, id) && propEl(G, id, 'SBGN class'); return !!d && ownText(d).trim() === 'terminal'; }
  //   way(g, id, w) -> g with the tag pointing w (left, right, up, down); terminal(g, id, on) -> g with the tag a submap's
  //   terminal (on its border) or a free tag again
  function way(t, id, w, opt) {
    var G = gml(t, opt);
    if (!isTag(G, id) || !WAYS.test(w)) return t;
    var T = new Tags(t, G.doc); setWay(T, G.node[id].geo.parentNode, w); return T.text();
  }
  // a terminal's node right after its submap's node and the terminals it has, as the converter reads a submap's
  // terminals after it (the file holds them inside the submap's glyph); the submap: the one its box touches, the nearest
  // a submap's node: yEd's Submap (graphml() turns an older base's phenotype for a submap into one)
  function isSub(G, k) { return cfgOf(G.node[k].geo.parentNode) === 'Submap'; }
  function subNode(G, id, S) {
    var b = G.node[id].box, best = null, bd = Infinity;
    G.ids.forEach(function (k) {
      var q = G.node[k].box;
      if (!isSub(G, k) || b[0] > q[0] + q[2] + 1 || q[0] > b[0] + b[2] + 1 || b[1] > q[1] + q[3] + 1 || q[1] > b[1] + b[3] + 1) return;
      var d = Math.hypot(b[0] + b[2] / 2 - q[0] - q[2] / 2, b[1] + b[3] / 2 - q[1] - q[3] / 2);
      if (d < bd) { bd = d; best = k; }
    });
    return best;
  }
  // the submap a terminal goes into: the one its box touches, if the file holds none under another class there; one
  // rule for retag (what is cut) and write0 (what is written), so the two never disagree and a pass changes nothing
  function termSub(G, id, S) { var sm = subNode(G, id, S); return sm && !(S.glyph[sm] && S.glyph[sm].el.getAttribute('class') !== 'submap') ? sm : null; }
  function termPlace(t, id, opt) {
    var G = gml(t, opt), sm = subNode(G, id);
    if (!sm) return t;
    var after = sm, sib = kids(G.node[sm].el.parentNode, 'node').map(function (n) { return n.getAttribute('id'); });
    for (var j = sib.indexOf(sm) + 1; j < sib.length && sib[j] !== id && isTerm(G, sib[j]) && subNode(G, sib[j]) === sm; j++) after = sib[j];
    if (sib[sib.indexOf(after) + 1] === id) return t;
    var at = nodeAt(t, id), end = elEnd(t, 'node', at), nl = t.lastIndexOf('\n', at - 1), from = nl >= 0 && /^[ \t]*$/.test(t.slice(nl + 1, at)) ? nl : at, block = t.slice(at, end);
    t = t.slice(0, from) + t.slice(end);
    var a = nodeAt(t, after), ae = elEnd(t, 'node', a), al = t.lastIndexOf('\n', a - 1), ind = al >= 0 && /^[ \t]*$/.test(t.slice(al + 1, a)) ? t.slice(al + 1, a) : '';
    return t.slice(0, ae) + (ind ? '\n' + ind : '') + block + t.slice(ae);
  }
  // write(): a tag the editor made a submap's terminal (or another submap's), or a terminal it took out: taken out of the
  // file, so it is written as one made (a terminal inside its submap, a tag at the top, each with its class and place)
  function retag(t, S, G) {
    var T = new Tags(t, S.doc), n = 0;
    Object.keys(S.glyph).forEach(function (id) {
      var el = S.glyph[id].el, c = el.getAttribute('class'), up = el.parentNode, inSub = c === 'terminal' && !!up.getAttribute && up.getAttribute('class') === 'submap';
      if (!G.node[id] || !isTag(G, id)) return;
      var term = isTerm(G, id), sm = term ? termSub(G, id, S) : null;
      // a terminal with no submap to go to (its submap moved away alone, a tag made a terminal or a new one touching
      // none) stays where the file has it: cut, it would be written as a free tag, cut again as the GraphML's terminal on
      // the next pass, and so on without end
      if (term && sm ? c === 'tag' || (inSub && sm !== up.getAttribute('id')) : inSub && !term) { T.cut(el); n++; }
    });
    return n ? T.text() : t;
  }
  // a terminal taken out: its node last among its graph's nodes, as the converter reads a tag written at the end
  function nodeLast(t, id, opt) {
    var G = gml(t, opt), n = G.node[id] && G.node[id].el;
    if (!n) return t;
    var sib = kids(n.parentNode, 'node'), last = sib[sib.length - 1];
    if (last === n) return t;
    var T = new Tags(t, G.doc), s = T.at.get(n), block = t.slice(s[0], T.end(n)), e = T.end(last);
    T.cut(n); T.ed.push([e, e, '\n' + T.indent(last) + block]);
    return T.text();
  }
  function terminal(t, id, on, opt) { t = setProps(t, id, { 'SBGN class': on ? 'terminal' : null }, opt); return on ? termPlace(t, id, opt) : nodeLast(t, id, opt); }
  var NAMED = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity|perturbing agent|phenotype|complex|submap|compartment)( multimer)?$|^(biological activity|perturbation|tag|terminal)$/;   // names kept in step both ways
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
    var sz = kind === 'UnitOfInformation' ? [Math.ceil(Math.max(text.length, 3) * ICON_CHAR * k + 8 * k), 16 * k] : svSize(text, k), b = labelBox(text, sz[0], sz[1], k * 10 / 14);
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
    var w = o.box[2], h = o.box[3], fs = o.font || 14, fill = o.fill ? '<y:Fill color="' + o.fill + '" transparent="false"/>' : '<y:Fill transparent="false" hasColor="false"/>';
    var border = '<y:BorderStyle color="' + (o.line || '#000000') + '" type="line" width="' + repr(o.width || (o.cls === 'compartment' ? 2 : 1)) + '"/>';
    if (o.cls === 'compartment') {   // yed.graphml's Compartment: its name centred at the top (graphml.write), the folded realizer as the template's
      var b = labelBox(o.label || '', w, h, fs / 14), named = o.label ? ' xml:space="preserve"' : '';
      var inner = function (x, y, lw, lh, f2, more) {
        return '<y:NodeLabel alignment="center" autoSizePolicy="content" borderDistance="0.0" fontFamily="Dialog" fontSize="' + f2 + '" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" height="' + repr(lh) +
          '" horizontalTextPosition="center" iconTextGap="4" modelName="internal" modelPosition="t" textColor="#000000" verticalTextPosition="bottom" visible="true" width="' + repr(lw) + '" x="' + repr(x) + '"' + named + ' y="' + repr(y) + '"' + more +
          (o.label ? '>' + esc(o.label) + '</y:NodeLabel>' : '/>');
      };
      return '<node id="' + esc(o.id) + '" yfiles.foldertype="group"><data key="ng">\n        <y:ProxyAutoBoundsNode>\n          <y:Realizers active="0">\n            <y:GroupNode>\n' +
        '              <y:Geometry height="' + repr(h) + '" width="' + repr(w) + '" x="' + repr(o.box[0]) + '" y="' + repr(o.box[1]) + '"/>\n              ' + fill + '\n              ' + border + '\n' +
        '              ' + inner((w - b[0]) / 2, 0, b[0], b[1], fs, ' hasText="' + (o.label ? 'true' : 'false') + '"') + '\n' +
        '              <y:Shape type="roundrectangle"/>\n              <y:State autoResize="false" closed="false" closedHeight="80.0" closedWidth="80.0" innerGraphDisplayEnabled="false"/>\n' +
        '              <y:Insets bottom="15" bottomF="15.0" left="15" leftF="15.0" right="15" rightF="15.0" top="15" topF="15.0"/>\n' +
        '              <y:BorderInsets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/>\n            </y:GroupNode>\n            <y:GroupNode>\n' +
        '              <y:Geometry height="740.0" width="1280.0" x="75.0" y="515.0"/>\n              <y:Fill color="#FFFFFF" transparent="false"/>\n              <y:BorderStyle color="#000000" type="line" width="1.0"/>\n' +
        '              ' + inner(615.13623046875, 0, 49.7275390625, 15.77734375, fs, '') + '\n' +
        '              <y:Shape type="roundrectangle"/>\n              <y:State closed="true" closedHeight="740.0" closedWidth="1280.0" innerGraphDisplayEnabled="false"/>\n' +
        '              <y:Insets bottom="15" bottomF="15.0" left="15" leftF="15.0" right="15" rightF="15.0" top="15" topF="15.0"/>\n' +
        '              <y:BorderInsets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/>\n            </y:GroupNode>\n          </y:Realizers>\n        </y:ProxyAutoBoundsNode>\n      </data>\n' +
        '      <graph edgedefault="directed" id="' + esc(o.id) + ':"/></node>';
    }
    var label;
    if (o.cls === 'complex') {   // yed.graphml's Complex: an internal label in the middle
      var c = labelBox(o.label || '', w, h, fs / 14);
      label = '<y:NodeLabel alignment="center" autoSizePolicy="content" fontFamily="Dialog" fontSize="' + fs + '" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" height="' + repr(c[1]) +
        '" horizontalTextPosition="center" iconTextGap="4" modelName="internal" modelPosition="c" textColor="#000000" verticalTextPosition="bottom" visible="true" width="' + repr(c[0]) + '" x="' + repr(c[2]) +
        '" xml:space="preserve" y="' + repr(c[3]) + '" hasText="' + (o.label ? 'true' : 'false') + '"' + (o.label ? '>' + esc(o.label) + '</y:NodeLabel>' : '/>');
    } else if (PROC.test(o.cls)) {   // yed.graphml's Process: its sign, if any, the font the template's 14, its box at the map's
      var pt = SIGN[o.cls] || '', pb = labelBox(pt, w, h, fs / 14);
      label = '<y:NodeLabel alignment="center" autoSizePolicy="content" bottomInset="0" fontFamily="Dialog" fontSize="14" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" hasText="' + (pt ? 'true' : 'false') + '" height="' + repr(pb[1]) +
        '" horizontalTextPosition="center" iconTextGap="4" leftInset="0" modelName="custom" rightInset="0" textColor="#000000" topInset="0" verticalTextPosition="center" visible="true" width="' + repr(pb[0]) + '" x="' + repr(pb[2]) + '" y="' + repr(pb[3]) + '">' + esc(pt) + LM +
        '<y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX="0.0" labelRatioY="0.0" nodeRatioX="0.0" nodeRatioY="0.0" offsetX="0.0" offsetY="0.0" upX="0.0" upY="-1.0"/></y:ModelParameter></y:NodeLabel>';
    } else if (GATES.test(o.cls)) {   // yed.graphml's Operator: AND, OR, NOT at the template's 12 (the map's font where it is not 14), the box at the
      // map's font; the equivalence's sign in Monospaced 18, as graphml.write draws yEd's palette's
      var gt = GATE[o.cls], eq = /^(equivalence|delay)$/.test(o.cls), gb = labelBox(gt, w, h, fs / 14);
      label = '<y:NodeLabel alignment="center" autoSizePolicy="content" bottomInset="0" fontFamily="' + (eq ? 'Monospaced' : 'Dialog') + '" fontSize="' + (eq ? 18 : o.letters != null ? o.letters : Math.round(GATE_FONT * fs / 14 * 2) / 2) + '" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" height="' + repr(gb[1]) +
        '" horizontalTextPosition="center" iconTextGap="4" leftInset="0" modelName="custom" rightInset="0" textColor="#000000" topInset="0" verticalTextPosition="center" visible="true" width="' + repr(gb[0]) + '" x="' + repr(gb[2]) + '" xml:space="preserve" y="' + repr(gb[3]) + '" hasText="true">' + esc(gt) + LM +
        '<y:ModelParameter><y:SmartNodeLabelModelParameter labelRatioX="0.0" labelRatioY="0.0" nodeRatioX="0.0" nodeRatioY="0.0" offsetX="0.0" offsetY="0.0" upX="0.0" upY="-1.0"/></y:ModelParameter></y:NodeLabel>';
    } else label = mainLabel(o.label || '', w, h, fs);
    var round = o.cls === 'macromolecule' || o.cls === 'nucleic acid feature';   // the templates with yEd's radius 10
    if (o.cls === 'tag' && o.way && o.way !== 'right') return nodeXml(Object.assign({}, o, { way: null })).replace('        </y:GenericNode>', '          ' + wayXml(o.way) + '        </y:GenericNode>');
    return '<node id="' + esc(o.id) + '"><data key="ng">\n        <y:GenericNode configuration="com.yworks.sbgn.' + MAKE[o.cls] + '">\n' +
      '          <y:Geometry height="' + repr(h) + '" width="' + repr(w) + '" x="' + repr(o.box[0]) + '" y="' + repr(o.box[1]) + '"/>\n' +
      '          ' + fill + '\n          ' + border + '\n          ' + label +
      (svs || []).map(function (q) { return iconLabel(q[0], q[1], w, h, q[2], q[3]); }).join('') + '\n' +
      (round || o.multimer ? '          <y:StyleProperties>\n            ' + (round ? '<y:Property class="java.lang.Integer" name="com.yworks.sbgn.style.radius" value="10"/>\n            ' : '') +
        (o.multimer ? MCOUNT : '') + '</y:StyleProperties>\n' : '') +   // the other templates have none
      '        </y:GenericNode>\n      </data>\n    </node>';
  }
  function add(t, o, opt) {   // o.activity: an Activity Flow activity with that unit ('' none), the node its entity's (activity())
    if (o.activity != null) return activity(add(t, Object.assign({}, o, { activity: null, cls: actCls(o.activity) }), opt), o.id, o.activity, opt);
    if (!MAKE[o.cls]) throw new Error('cannot make a ' + o.cls);
    var svs = [];
    var mac = o.cls === 'macromolecule', naf = o.cls === 'nucleic acid feature';   // the glyph set the editor offers: state variables on macromolecules only, units of information on them and on nucleic acid features
    (mac ? o.states || [] : []).forEach(function (q) { var r = svIcon(t, q[0], opt); t = r[1]; svs.push([r[0], r[2], q[1], q[2]]); });
    (mac || naf ? o.units || [] : []).forEach(function (u, k, all) { var r = svIcon(t, u, opt, null, 'UnitOfInformation'); t = r[1]; svs.push([r[0], r[2], uRatio(k, all.length), -0.5]); });
    var G = gml(t, opt), T = new Tags(t, G.doc), xml = nodeXml(o, svs), graph;
    if (o.parent && G.node[o.parent]) graph = kids(G.node[o.parent].el, 'graph')[0];
    if (!graph) graph = kids(G.doc.documentElement, 'graph')[0];
    var s = T.at.get(graph);
    if (s[2]) { T.ed.push([s[0], s[1], T.t.slice(s[0], s[1] - 2) + '>' + xml + '</graph>']); return T.text(); }
    // a compartment first in its graph, so it lies under what is there (write() puts it first in the file too)
    var first = o.cls === 'compartment' ? kids(graph)[0] : kids(graph, 'edge')[0], at0 = first ? T.at.get(first)[0] : T.t.lastIndexOf('</', T.end(graph) - 1);
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
    var inner = L.getAttribute('modelName') === 'internal';   // a complex's or a compartment's: placed by its model position, x and y as they are
    [['width', b[0]], ['height', b[1]]].concat(inner ? [] : [['x', b[2]], ['y', b[3]]]).forEach(function (q) { T.set(L, q[0], repr(q[1])); });
    T.set(L, 'hasText', text ? 'true' : 'false');
    var rs = L.parentNode.parentNode;   // a group's other realizers (folded in yEd): the same name, as graphml.write writes it
    if (rs && rs.localName === 'Realizers') kids(rs).forEach(function (r) {
      var l2 = r !== L.parentNode && kid(r, 'NodeLabel');
      if (!l2) return;
      var s2 = T.at.get(l2);
      T.ed.push(s2[2] ? [s2[1] - 2, s2[1], '>' + esc(text) + '</y:NodeLabel>'] : [s2[1], T.t.lastIndexOf('</', T.end(l2) - 1), esc(text)]);
    });
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
    var cf = n0 ? cfgOf(n0.geo.parentNode) : '';
    if (cf !== 'Macromolecule' && !(kind === 'UnitOfInformation' && (cf === 'NucleicAcidFeature' || actOf(G0, id) != null))) return t;   // the glyph set the editor offers: state variables on macromolecules only, units of information on them, on nucleic acid features and on any activity (its unit's text, AF; none on a simple chemical)
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
  // an attribute by its local name (libsbgn's Java writer gives the render ones a prefix: ns1:idList, ns1:fill, as
  // sbgnml.read takes them), and the name it has in the file
  function anode(el, k) { if (!el) return null; for (var i = 0; i < el.attributes.length; i++) { var a = el.attributes[i]; if ((a.localName || a.name) === k) return a; } return null; }
  function av(el, k) { var a = anode(el, k); return a ? a.value : null; }
  function styles(S) {
    var defs = {};
    Array.prototype.forEach.call(S.doc.getElementsByTagName('*'), function (e) { if (e.localName === 'colorDefinition') defs[av(e, 'id')] = av(e, 'value'); });
    var colour = function (c) { var v = defs[c] || c; if (!v || !/^#[0-9A-Fa-f]{3,8}$/.test(v)) return null; v = v.toUpperCase();   // hex only: a file's text never reaches markup
      return v.length === 9 && /FF$/.test(v) ? v.slice(0, 7) : v; };
    var out = Array.prototype.filter.call(S.doc.getElementsByTagName('*'), function (e) { return e.localName === 'style'; }).map(function (st) {
      var g = kids(st, 'g')[0], a = function (k) { return av(g, k) || null; }, il = anode(st, 'idList');
      return { el: st, g: g, fill: colour(a('fill')), line: colour(a('stroke')), width: a('stroke-width') ? F(a('stroke-width')) : null, font: a('font-size') ? F(a('font-size')) : null,
               has: { fill: !!a('fill'), line: !!a('stroke'), width: !!a('stroke-width'), font: !!a('font-size') },
               ids: ((il && il.value) || '').split(/\s+/).filter(Boolean), plain: !!il, idName: il ? il.name : 'idList' };
    });
    out.defs = defs;
    return out;
  }
  // a new glyph's fill where the map has no glyph of its kind (never left transparent; one with glyphs of its kind none
  // of which is filled gets none, drawn white as they are): the viewer's Default colour scheme, an activity's by its
  // unit's kind; a submap white as the other entities; processes and gates none. The master of these colours for the editor; the viewer keeps its own
  // copy as SCHEMES.default in _includes/atlas-app.html (compartment, complex, protein, metabolite, ..., white), kept the same
  var FILL = { macromolecule: '#C8D8EB', 'simple chemical': '#DBEBDB', compartment: '#F7F6F3', complex: '#FFFFFF', 'nucleic acid feature': '#FFFFFF',
               'unspecified entity': '#FFFFFF', 'perturbing agent': '#FFFFFF', phenotype: '#FFFFFF', submap: '#FFFFFF', tag: '#FFFFFF' };   // a tag white as the submap it serves
  function fillFor(cls, unit) { return FILL[cls === 'biological activity' ? actCls(unit) : (cls || '').replace(/ multimer$/, '')] || null; }
  function scaleOf(S) {   // the map's scale from its proteins, as style.scale_of (a protein's activity is a protein to the converter, sbgnml.ACTIVITY)
    var hs = [];
    Object.keys(S.glyph).forEach(function (id) {
      var c = S.glyph[id].el.getAttribute('class');
      if (c === 'macromolecule' || (c === 'biological activity' && actCls(fileUnit(S.glyph[id].el)) === 'macromolecule')) hs.push(S.glyph[id].box[3]);
    });
    hs.sort(function (a, b) { return a - b; });
    var m = hs.length ? (hs.length % 2 ? hs[(hs.length - 1) / 2] : (hs[hs.length / 2 - 1] + hs[hs.length / 2]) / 2) : 40, s = m / 40;
    return s > 1.2 || s < 1 / 1.2 ? s : 1;
  }
  function defaults(t, opt, cls, unit) {   // unit: an activity's, for its fill
    cls = cls || 'macromolecule';
    var S = sbgn(t, opt), best = null, n = 0, same = {};
    Object.keys(S.glyph).forEach(function (id) {
      var c = S.glyph[id].el.getAttribute('class');
      // the same kind: a multimer counts as its kind, an activity only as one of the same unit kind (so a metabolite
      // activity does not take the protein activities' fill)
      if ((c || '').replace(/ multimer$/, '') === cls && (c !== 'biological activity' || unit === undefined || actCls(fileUnit(S.glyph[id].el)) === actCls(unit))) same[id] = 1;
    });
    // the size most glyphs of that kind have on the map (the three process kinds counted as one, drawn alike), when two
    // share it or the kind has one glyph; else the size below at the map's scale. Compartments, complexes and submaps are
    // sized to what they hold, so theirs stay the size below
    var PROC = /^(omitted |uncertain )?process$/, cnt = {}, all = 0, top = null;
    if (!/^(compartment|complex|submap)$/.test(cls)) Object.keys(S.glyph).forEach(function (id) {
      var c = (S.glyph[id].el.getAttribute('class') || '').replace(/ multimer$/, ''), b = S.glyph[id].box, k = b[2] + ',' + b[3];
      if (PROC.test(cls) ? PROC.test(c) : same[id]) { all++; cnt[k] = (cnt[k] || 0) + 1; if (!top || cnt[k] > cnt[top]) top = k; }
    });
    var own = top && (cnt[top] > 1 || all === 1) ? top.split(',').map(Number) : null;
    var s = scaleOf(S);
    var filled = false;   // a glyph of that kind with a fill: a map whose glyphs of that kind have none (CaMKII) gets none
    styles(S).forEach(function (st) { var k = st.ids.filter(function (i) { return same[i]; }).length; if (st.fill && k) filled = true; if (st.fill && st.plain && k > n) { n = k; best = st; } });
    var sz = SIZE[cls] || SIZE.macromolecule, fallback = !best && (filled || !Object.keys(same).length);   // the Default colours only on a map with no glyph of that kind (a New map)
    // w0, h0: the size below, whatever the map has (the palette's Style: Default)
    return { w: own ? own[0] : sz[0] * s, h: own ? own[1] : sz[1] * s, w0: sz[0] * s, h0: sz[1] * s, font: best && best.font || Math.round(14 * s + 0.01), fill: best ? best.fill : fallback ? fillFor(cls, unit) : null, fallback: fallback,   // fallback: the fill is the Default colours' (create.js: dropped under No colours)
             line: best && best.line !== '#000000' ? best.line : null, width: cls === 'compartment' ? 2 : best && best.width || 1 };   // a new compartment's border 2 whatever the map's
  }
  // ---------- the look of a glyph (Properties as yEd's, with Newt's fields): its fill, border colour and
  // width (size: resize(); multimer: multimer()). In the GraphML as graphml.write writes them; in the SBGN-ML file in the
  // render extension, read as sbgnml.read reads it (each attribute from the last style naming the glyph that gives it; a
  // black border and a width of 1 are the defaults, a compartment's 2). LOOKS: every glyph Properties restyles
  var LOOKS = /^(macromolecule|simple chemical|nucleic acid feature|complex)( multimer)?$|^(biological activity|unspecified entity|perturbing agent|perturbation|phenotype|submap|source and sink|compartment|process|omitted process|uncertain process|association|dissociation|and|or|not|equivalence|delay|tag|terminal)$/;
  function lookG(G, id) { return lookOf(G.node[id].geo.parentNode); }
  function lookOf(r) {   // a node's realizer: its fill, border colour (null: black) and width, drawn as a multimer, its name's font size (null: no name label)
    var fl = kid(r, 'Fill'), bs = kid(r, 'BorderStyle'), line = ((bs && bs.getAttribute('color')) || '#000000').toUpperCase();
    var lab = kids(r, 'NodeLabel').filter(function (l) { return !l.getAttribute('iconData'); })[0];
    return { font: lab ? F(lab.getAttribute('fontSize')) || 12 : null, fill: fl && fl.getAttribute('hasColor') !== 'false' && fl.getAttribute('color') ? fl.getAttribute('color').toUpperCase() : null,
             line: line === '#000000' ? null : line, width: bs && bs.getAttribute('width') ? F(bs.getAttribute('width')) : 1,
             multimer: kids(kid(r, 'StyleProperties') || r, 'Property').some(function (q) { return q.getAttribute('name') === 'com.yworks.sbgn.style.mcount' && q.getAttribute('value') !== '1'; }) };
  }
  function fileLook(St, id, cls) {   // cls: the glyph's, for the converter's default border (a compartment's 2, else 1)
    var o = { fill: null, line: null, width: cls === 'compartment' ? 2 : 1, font: null };
    St.forEach(function (st) {
      if (!st.plain || st.ids.indexOf(id) < 0) return;
      if (st.has.fill) o.fill = st.fill;
      if (st.has.line) o.line = st.line;
      if (st.has.width) o.width = st.width || o.width;
      if (st.has.font) o.font = st.font;
    });
    if (o.line === '#000000') o.line = null;
    return o;
  }
  // the node's look in the GraphML set to o (fill, line, width: those given)
  function setLook(T, G, id, o, keep) {   // keep: setFont's; returns the name's new width where its font changed
    var n = G.node[id], r = n.geo.parentNode, fl = kid(r, 'Fill'), bs = kid(r, 'BorderStyle'), now = lookG(G, id);
    if ('fill' in o && o.fill !== now.fill && fl) {   // as graphml.write writes it: color first, or hasColor last
      var fs0 = T.at.get(fl), tr = fl.getAttribute('transparent') || 'false';
      T.ed.push([fs0[0], fs0[1], o.fill ? '<y:Fill color="' + o.fill + '" transparent="' + tr + '"/>' : '<y:Fill transparent="' + tr + '" hasColor="false"/>']);
    }
    if ('line' in o && o.line !== now.line && bs) T.set(bs, 'color', o.line || '#000000');
    if ('width' in o && o.width !== now.width && bs) T.set(bs, 'width', repr(o.width));
    if (o.font != null && now.font != null && o.font !== now.font) return setFont(T, G, id, o.font, keep);
  }
  // the name's font size in the GraphML, its label box measured again for it (as label() and graphml.write's _label);
  // a group's other realizers (folded in yEd) the same size
  // keep: graphml()'s box of the node (the DOM still has the old one): a compartment's name left where it is (graphml()
  // places it from the file, with the width returned); returns
  // the label's new width, else null
  function setFont(T, G, id, fs, keep) {
    var n = G.node[id], L = labelsOf(G, id).main;
    if (!L) return null;
    var w = (keep || n.box)[2], h = (keep || n.box)[3], b = labelBox(ownText(L), w, h, fs / 14), inner = L.getAttribute('modelName') === 'internal', z = repr(fs).replace(/\.0$/, '');
    var at = [['width', b[0]], ['height', b[1]]];
    if (!inner) at.push(['x', b[2]], ['y', b[3]]);
    else if (cfgOf(L.parentNode) === 'Complex') at.push(['x', (w - b[0]) / 2], ['y', L.getAttribute('modelPosition') === 'b' ? h - b[1] : (h - b[1]) / 2]);   // as graphml.write: centred, on the bottom edge with members
    else if (!keep && Math.abs(F(L.getAttribute('x')) + F(L.getAttribute('width')) / 2 - w / 2) < 0.5) at.push(['x', (w - b[0]) / 2]);   // a compartment's centred name stays centred
    T.set(L, 'fontSize', z);
    at.forEach(function (q) { T.set(L, q[0], repr(q[1])); });
    var rs = L.parentNode.parentNode;
    if (rs && rs.localName === 'Realizers') kids(rs).forEach(function (r) { var l2 = r !== L.parentNode && kid(r, 'NodeLabel'); if (l2) T.set(l2, 'fontSize', z); });
    return b[0];
  }
  //   lookOf(realizer) -> { fill, line, width, multimer, font } of a node of the editor's GraphML (its parsed realizer)
  //   restyle(g, id, o) -> g with the node's look set to o (any of fill, line, width, font: its name's size)
  function restyle(t, id, o, opt) {
    var G = gml(t, opt);
    if (!G.node[id]) return t;
    var T = new Tags(t, G.doc);
    setLook(T, G, id, o);
    return T.text();
  }
  //   restyleAll(g, { id: o }, opt, lines) -> g with each node's look set and, with lines (edge id -> #rrggbb or null for
  //   black, or a function of the edge id), each edge's colour; one parse for them all (a whole map recoloured)
  function restyleAll(t, M, opt, lines) {
    var G = gml(t, opt), T = new Tags(t, G.doc);
    Object.keys(M).forEach(function (id) { if (G.node[id]) setLook(T, G, id, M[id]); });
    if (lines) Object.keys(G.edge).forEach(function (id) { var c = typeof lines === 'function' ? lines(id) : lines[id]; if (c !== undefined) setLine(T, G.edge[id].el, c); });
    return T.text();
  }
  // a line's colour (Properties): in the GraphML its y:LineStyle color, as graphml.write draws Arc.line; in the SBGN-ML
  // file a style naming the arc, its stroke the colour (sbgnml.read's Arc.line). null: black, the default
  function lineOf(e) {   // an edge of the editor's GraphML (its parsed element)
    var ls = e.getElementsByTagNameNS(YNS, 'LineStyle')[0], c = ((ls && ls.getAttribute('color')) || '#000000').toUpperCase().replace(/^(#[0-9A-F]{6})FF$/, '$1');
    return c === '#000000' ? null : c;
  }
  function setLine(T, e, c) { var ls = e.getElementsByTagNameNS(YNS, 'LineStyle')[0]; if (ls && lineOf(e) !== c) T.set(ls, 'color', c || '#000000'); }
  // a line's width (Properties): its y:LineStyle width, as graphml.write draws Arc.weight; in the SBGN-ML file the
  // stroke-width of a style naming the arc (sbgnml.read's Arc.weight). 1 the default
  function widthOf(e) { var ls = e.getElementsByTagNameNS(YNS, 'LineStyle')[0]; return (ls && F(ls.getAttribute('width'))) || 1; }
  function setWidth(T, e, w) { var ls = e.getElementsByTagNameNS(YNS, 'LineStyle')[0]; if (ls && widthOf(e) !== w) T.set(ls, 'width', repr(w)); }
  //   colours(g) -> { node: { id: { fill, line } }, edge: { id: c } }: every node's fill and border colour and every edge's
  //   colour as they are (lookOf, lineOf; null: none, black), in one parse; restyleAll puts them back
  function colours(t, opt) {
    var G = gml(t, opt), o = { node: {}, edge: {} };
    G.ids.forEach(function (id) { var L = lookG(G, id); o.node[id] = { fill: L.fill, line: L.line }; });
    Object.keys(G.edge).forEach(function (id) { o.edge[id] = lineOf(G.edge[id].el); });
    return o;
  }
  //   recolour(g, id, c) -> g with the edge's colour set to c (#RRGGBB, null for black)
  function recolour(t, id, c, opt) {
    var G = gml(t, opt), e = G.edge[id];
    if (!e) return t;
    var T = new Tags(t, G.doc);
    setLine(T, e.el, c);
    return T.text();
  }
  //   rewidth(g, id, w) -> g with the edge's width set to w (1 the default)
  function rewidth(t, id, w, opt) {
    var G = gml(t, opt), e = G.edge[id];
    if (!e) return t;
    var T = new Tags(t, G.doc);
    setWidth(T, e.el, w);
    return T.text();
  }
  // the looks wanted put into the file's render styles: each glyph out of the styles naming it, into a plain style of its
  // fill, border and font (for a glyph made in the editor, a style with no font as well: the map's own), the one most of
  // the map's glyphs of its class use; else a style made for it, with the attributes of its old style it does not set
  // (font family, text colour), its colours in the map's colour definitions; a style left naming nothing taken out. Returns
  // the render extension's text when it is new and the map an empty <map/> (write() puts it in with the glyphs made)
  function carried(old) {   // the attributes a glyph's old styles give that a look does not set (font family, text colour)
    var at = {};
    old.forEach(function (st) { if (st.g) Array.prototype.forEach.call(st.g.attributes, function (a) { if (!/^(fill|stroke|stroke-width|font-size)$/.test(a.localName || a.name) && !/^xmlns/.test(a.name)) at[a.name] = a.value; }); });
    return at;
  }
  function restyle0(S, T, St, looks, pre) {
    if (!looks.size) return;
    var lists = new Map(), made = {}, order = [], used = {};
    var cnt = function (x, cls) { return x.ids.filter(function (i) { return S.glyph[i] && S.glyph[i].el.getAttribute('class') === cls; }).length; };
    var all = S.doc.getElementsByTagName('*'), first = function (name) { for (var i = 0; i < all.length; i++) if (all[i].localName === name) return all[i]; return null; };
    Array.prototype.forEach.call(all, function (e) { if (av(e, 'id')) used[av(e, 'id')] = 1; });
    var fresh = function (base) { var k = 1; while (used[base + k]) k++; used[base + k] = 1; return base + k; };
    looks.forEach(function (o, id) {
      var old = [];   // every style naming it, in order (a later one's attributes win, as sbgnml.read takes them)
      St.forEach(function (st) { if (st.plain && st.ids.indexOf(id) >= 0) { old.push(st); lists.set(st, (lists.get(st) || st.ids.slice()).filter(function (x) { return x !== id; })); } });
      var arc = o.cls === 'arc';
      if (arc && !o.line && !o.fill && o.width == null && !o.font) return;   // a line set back to black: out of the styles that coloured it
      var cand = St.filter(function (x) { return x.plain && x.fill === o.fill && (x.line === '#000000' ? null : x.line) === o.line && (o.width == null ? !x.has.width : (x.has.width ? x.width || 1 : o.cls === 'compartment' ? 2 : 1) === o.width) &&
        (x.font === o.font || (o.fresh && !o.own && x.font == null)) && x.ids.every(function (i) { return !!S.arc[i] === arc; }); });   // arcs' styles and glyphs' apart
      cand.sort(function (a, b) { return (b.font === o.font) - (a.font === o.font) || cnt(b, o.cls) - cnt(a, o.cls); });
      if (cand[0]) { lists.set(cand[0], (lists.get(cand[0]) || cand[0].ids.slice()).concat(id)); return; }
      var key = [arc, o.fill, o.line, o.width, o.font, JSON.stringify(carried(o.fresh ? [] : old))].join('\u0000');   // arcs' styles and glyphs' apart   // the same look and the same attributes kept: one style
      if (!made[key]) { made[key] = { o: o, old: o.fresh ? [] : old, ids: [] }; order.push(made[key]); }
      made[key].ids.push(id);
    });
    lists.forEach(function (ids, st) { if (ids.length) T.set(st.el, st.idName, ids.join(' ')); else T.cut(st.el); });   // a style left naming nothing taken out
    var lsEl = first('listOfStyles'), lcEl = first('listOfColorDefinitions'), defs = St.defs, mapEl = kids(S.doc.documentElement, 'map')[0], newRefs = {};
    // a colour definition the change left unused taken out (one a style used before, named by no style or other element
    // after it), so the file keeps no leftovers; one unused before stays as the file had it
    var tidy = function () {
      if (!lcEl) return;
      var isDef = function (v) { return Object.prototype.hasOwnProperty.call(defs, v); };
      var refs = function (el, into) { Array.prototype.forEach.call(el.getElementsByTagName('*'), function (e) { Array.prototype.forEach.call(e.attributes, function (a) { if (isDef(a.value)) into[a.value] = 1; }); }); };
      var before = {}, after = Object.assign({}, newRefs);
      St.forEach(function (st) { refs(st.el, before); var l = lists.get(st); if (!l || l.length) refs(st.el, after); });   // a style cut names nothing after
      Array.prototype.forEach.call(all, function (e) {   // any other element naming a colour (a background, a text colour)
        if (e.localName === 'colorDefinition' || e.localName === 'style') return;
        for (var u = e.parentNode; u; u = u.parentNode) if (u.localName === 'style' || u.localName === 'listOfColorDefinitions') return;
        Array.prototype.forEach.call(e.attributes, function (a) { if (isDef(a.value)) after[a.value] = 1; });
      });
      kids(lcEl, 'colorDefinition').forEach(function (d) { var i = av(d, 'id'); if (before[i] && !after[i]) T.cut(d); });
    };
    if (!order.length) { tidy(); return; }
    var rp = lsEl && lsEl.prefix ? lsEl.prefix + ':' : '', ap = St.some(function (x) { return x.idName.indexOf(':') > 0; }) ? rp : '', bi = lsEl ? T.indent(lsEl) : T.indent(mapEl) + '      ', colours = '', styles = '';
    var cid = function (v) {   // a colour's id in the map's definitions, one added when it has none
      if (!lcEl && lsEl) return v;   // a map whose styles give their colours as values
      for (var k in defs) if (defs[k] && defs[k].toUpperCase().replace(/^(#[0-9A-F]{6})FF$/, '$1') === v) { newRefs[k] = 1; return k; }
      var i = fresh('color_e'); defs[i] = v;
      colours += '\n' + bi + '  <' + rp + 'colorDefinition ' + ap + 'id="' + i + '" ' + ap + 'value="' + v.toLowerCase() + '"/>';
      return i;
    };
    order.forEach(function (m) {
      var o = m.o, at = carried(m.old);
      at[ap + 'stroke'] = cid(o.line || '#000000');
      if (o.fill) at[ap + 'fill'] = cid(o.fill);
      if (o.width != null) at[ap + 'stroke-width'] = num(o.width);   // a line's width only where its style gave one
      if (o.font) at[ap + 'font-size'] = num(o.font);
      styles += '\n' + bi + '  <' + rp + 'style ' + ap + 'id="' + fresh('style_e') + '" ' + ap + 'idList="' + m.ids.map(esc).join(' ') + '">\n' + bi + '    <' + rp + 'g' +
        Object.keys(at).map(function (k) { return ' ' + k + '="' + esc(at[k]) + '"'; }).join('') + '/>\n' + bi + '  </' + rp + 'style>';
    });
    var into = function (el, xml) {   // xml put at the end of el
      var s = T.at.get(el);
      if (s[2]) { T.ed.push([s[0], s[1], T.t.slice(s[0], s[1] - 2).replace(/\s+$/, '') + '>' + xml + '\n' + T.indent(el) + '</' + T.t.slice(s[0] + 1).match(/^[^\s/>]+/)[0] + '>']); return; }
      var e = T.t.lastIndexOf('</', T.end(el) - 1), ls = T.t.lastIndexOf('\n', e - 1);
      T.ed.push(/^\s*$/.test(T.t.slice(ls + 1, e)) ? [ls, ls, xml] : [e, e, xml + '\n' + T.indent(el)]);
    };
    tidy();
    if (lsEl) { if (colours) into(lcEl, colours); into(lsEl, styles); return; }
    var i0 = T.indent(mapEl) + '  ', R = 'http://www.sbml.org/sbml/level3/version1/render/version1';
    if (lcEl) {   // colour definitions but no styles yet: a list of styles beside them
      var lp = lcEl.prefix ? lcEl.prefix + ':' : '';
      if (colours) into(lcEl, colours);
      into(lcEl.parentNode, '\n' + T.indent(lcEl) + '<' + lp + 'listOfStyles>' + styles + '\n' + T.indent(lcEl) + '</' + lp + 'listOfStyles>');
      return;
    }
    // a map with no render extension yet: one written, as the converter writes it
    var info = '\n' + i0 + '  <renderInformation xmlns="' + R + '" id="renderInformation">\n' + i0 + '    <listOfColorDefinitions>' + colours + '\n' + i0 + '    </listOfColorDefinitions>\n' +
      i0 + '    <listOfStyles>' + styles + '\n' + i0 + '    </listOfStyles>\n' + i0 + '  </renderInformation>';
    var ext = kids(mapEl, 'extension')[0];
    if (ext) { into(ext, info); return; }
    var block = '\n' + i0 + '<' + pre + 'extension>' + info + '\n' + i0 + '</' + pre + 'extension>';
    if (T.at.get(mapEl)[2]) return block;   // an empty <map/>: write() puts it in with the glyphs made
    var notes = kids(mapEl, 'notes')[0], at0 = notes ? T.end(notes) : T.at.get(mapEl)[1];
    T.ed.push([at0, at0, block]);
  }
  function drop(t, ids, opt, lost) {   // the file with the glyphs (state variables too) deleted in the editor taken out, and every arc at them; lost: the glyphs that lose a unit of information
    if (!ids.length) return t;   // nothing deleted: no parse
    var S = sbgn(t, opt), del = {}, T = null, arcs = ids.filter(function (id) { return !!S.arc[id]; });   // arcs: deleted on their own
    ids.forEach(function (id) {
      var g = S.glyph[id];
      if (!g) return;
      del[id] = 1;
      if (lost && g.el.getAttribute('class') === 'unit of information' && g.el.parentNode.getAttribute) lost[g.el.parentNode.getAttribute('id')] = 1;
      Array.prototype.forEach.call(g.el.getElementsByTagName('*'), function (c) { if (c.getAttribute('id')) del[c.getAttribute('id')] = 1; });
    });
    if (!Object.keys(del).length && !arcs.length) return t;
    T = new Tags(t, S.doc);
    ids.forEach(function (id) {   // only the outermost cut: a state variable or member deleted with its glyph goes with it (two overlapping cuts break the file)
      if (!S.glyph[id]) return;
      for (var up = S.glyph[id].el.parentNode; up && up.nodeType === 1; up = up.parentNode) if (del[up.getAttribute('id')]) return;
      T.cut(S.glyph[id].el);
    });
    Object.keys(S.arc).forEach(function (id) { var a = S.arc[id]; if (del[a.getAttribute('source')] || del[a.getAttribute('target')] || arcs.indexOf(id) >= 0) { del[id] = 1; T.cut(a); } });
    styles(S).forEach(function (st) {   // the render styles name no deleted glyph or arc (idList included); a style left naming none goes
      var keep = st.ids.filter(function (x) { return !del[x]; });
      if (keep.length === st.ids.length) return;
      if (keep.length) T.set(st.el, st.idName, keep.join(' ')); else T.cut(st.el);
    });
    return T.text();
  }
  function svLabel(G, id, j, kind) { var L = G.node[id] && labelsOf(G, id); return L ? (L.icons.filter(function (x) { return x[1].kind === (kind || 'StateVariable'); })[j] || [])[0] : null; }
  function stateMove(t, id, j, rx, ry, opt, kind) {   // the j-th state variable (kind UnitOfInformation: unit) moved to rx, ry on its node's border (the editor's GraphML)
    var G = gml(t, opt), l = svLabel(G, id, j, kind);
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
  // units of information (free text) on the top edge: spread evenly along it as graphml.write places them,
  // (k + 1) / (n + 1) of the width, again whenever one is added or deleted; a unit moved to another side stays there
  function uRatio(k, n) { return (k + 1) / (n + 1) - 0.5; }
  function respace(t, id, opt) {
    var G = gml(t, opt), n = G.node[id], L = n && labelsOf(G, id);
    if (!L) return t;
    var us = L.icons.filter(function (q) { var p = q[0].getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0]; return q[1].kind === 'UnitOfInformation' && p && Math.abs(F(p.getAttribute('nodeRatioY')) + 0.5) < 1e-6; }), T = new Tags(t, G.doc), b = n.box;
    us.forEach(function (q, k) {
      var l = q[0], p = l.getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0], rx = uRatio(k, us.length), set = function (el, a, v) { if (el.getAttribute(a) !== v) T.set(el, a, v); };
      set(p, 'nodeRatioX', repr(rx)); set(p, 'nodeRatioY', repr(-0.5));
      set(l, 'x', repr((0.5 + rx) * b[2] - F(l.getAttribute('width')) / 2)); set(l, 'y', repr(-F(l.getAttribute('height')) / 2));
    });
    return T.text();
  }
  function unit(t, id, value, opt) { return withText(respace(state(t, id, value, 0, -0.5, opt, 'UnitOfInformation'), id, opt), id, value, opt); }
  function withText(t, id, value, opt) {   // text given to an activity with no unit: its unit a protein's (SBGN-ML requires an entity beside the text), so the editing reads as the file written
    return value && actOf(gml(t, opt), id) === '' ? activity(t, id, 'macromolecule', opt) : t;
  }
  function unitValue(t, id, j, value, opt) { return withText(stateValue(t, id, j, value, opt, 'UnitOfInformation'), id, value, opt); }
  function unitDelete(t, id, j, opt) { return stateDelete(t, id, j, opt, 'UnitOfInformation'); }
  function unitMove(t, id, j, rx, ry, opt) { return stateMove(t, id, j, rx, ry, opt, 'UnitOfInformation'); }
  // a multimer (Make multimer, Make macromolecule): yEd's two shapes, mcount 2 (graphml.write); the
  // count, if any, is a unit of information the reader types (N:3)
  var MCOUNT = '<y:Property class="java.lang.Integer" name="com.yworks.sbgn.style.mcount" value="2"/>', MULTI = /^(macromolecule|simple chemical|nucleic acid feature)$/;
  function mcountOf(G, id) {
    var r = G.node[id] && G.node[id].geo.parentNode, sp = r && kid(r, 'StyleProperties');
    return sp ? kids(sp, 'Property').filter(function (p) { return p.getAttribute('name') === 'com.yworks.sbgn.style.mcount'; })[0] || null : null;
  }
  function isMulti(G, id) { var p = mcountOf(G, id); return !!p && p.getAttribute('value') !== '1'; }
  // an entity made another: macromolecule, simple chemical, nucleic acid feature or unspecified entity, as a
  // CellDesigner species' class is changed; its box, name, icons and lines kept, its multimer dropped where the new
  // class has none; write() writes the class
  var ENTITY = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity)$/;
  function entityKind(t, id, cls, opt) {
    var G = gml(t, opt), n = G.node[id], r = n && n.geo.parentNode;
    if (!r || !ENTITY.test(cls) || !ENTITY.test(classOfCfg(cfgOf(r)) || '') || cfgOf(r) === MAKE[cls]) return t;
    var T = new Tags(t, G.doc), p = !MULTI.test(cls) && mcountOf(G, id);
    T.set(r, 'configuration', 'com.yworks.sbgn.' + MAKE[cls]);
    if (p) T.cut(p);
    return T.text();
  }
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
  function fileMulti(el) { return drawnMulti(el.getAttribute('class') || '', unitsOf(el).map(unitText)); }
  function drawnMulti(cls, units) {   // sbgnml.read's count: the first N:x, else 2 for a multimer; above 1 drawn as a multimer
    if (!/ multimer$/.test(cls)) return false;
    var n = units.filter(function (u) { return /^N:\d+$/.test(u); })[0];
    return (n ? parseInt(n.slice(2), 10) : 2) > 1;
  }
  function uBoxAt(txt, b, rx, ry) { var uw = Math.max(3, txt.length) * 7; return [b[0] + (0.5 + rx) * b[2] - uw / 2, b[1] + (0.5 + ry) * b[3] - 7.5, uw, 15]; }   // layout.decorations
  // a node's box set (a macromolecule or a simple chemical resized by its handles or its size typed):
  // the box written, its name kept centred, its state variables at their places on the border (yEd's ratios), and the
  // ends of its lines that are off its centre moved with the box in proportion, so a port on the border stays on it;
  // write() then scales what the SBGN-ML file's glyph carries the same way
  function resize(t, id, box, opt) {
    var G = gml(t, opt), n = G.node[id];
    if (!n) return t;
    var o = n.box, w = box[2], h = box[3], T = new Tags(t, G.doc);
    boxOn(T, G, id, box);
    scaleOn(T, G, id, o, box);
    return (Math.abs(o[2] - w) > 1e-9 || Math.abs(o[3] - h) > 1e-9) && actOf(G, id) ? afIcon(T.text(), id, opt) : T.text();
  }
  // node id's box set (geometry, its name centred, its icons at their places); noMain: its name left to setFont
  function boxOn(T, G, id, box, noMain) {
    var n = G.node[id], o = n.box, w = box[2], h = box[3];
    ['x', 'y', 'width', 'height'].forEach(function (k, j) { if (Math.abs(o[j] - box[j]) > 1e-9) T.set(n.geo, k, repr(box[j])); });
    var L = labelsOf(G, id);
    if (L.main && !noMain) { T.set(L.main, 'x', repr((w - F(L.main.getAttribute('width'))) / 2)); T.set(L.main, 'y', repr((h - F(L.main.getAttribute('height'))) / 2)); }
    L.icons.forEach(function (q) {
      var l = q[0], p = l.getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0];
      if (!p) return;
      T.set(l, 'x', repr((0.5 + F(p.getAttribute('nodeRatioX'))) * w - F(l.getAttribute('width')) / 2));
      T.set(l, 'y', repr((0.5 + F(p.getAttribute('nodeRatioY'))) * h - F(l.getAttribute('height')) / 2));
    });
  }
  // an activity's unit icon where write() puts the unit in the file after a resize or a unit set (afUnitBox), so the
  // GraphML draws as the converter draws the file written
  function afIcon(t, id, opt) {
    var G = gml(t, opt), n = G.node[id], act = n ? actOf(G, id) : null;
    if (!act) return t;
    var q = labelsOf(G, id).icons.filter(function (x) { return x[1].kind === 'UnitOfInformation'; })[0], l = q && q[0];
    var p = l && l.getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0], B = n.box, ub = p && afUnitBox(B, act, q[1].text || '');
    if (!ub) return t;
    var T = new Tags(t, G.doc), rx = (ub[0] + ub[2] / 2 - B[0] - B[2] / 2) / B[2], ry = (ub[1] + ub[3] / 2 - B[1] - B[3] / 2) / B[3];
    T.set(p, 'nodeRatioX', repr(rx)); T.set(p, 'nodeRatioY', repr(ry));
    T.set(l, 'x', repr((0.5 + rx) * B[2] - F(l.getAttribute('width')) / 2)); T.set(l, 'y', repr((0.5 + ry) * B[3] - F(l.getAttribute('height')) / 2));
    return T.text();
  }
  // the ends of node id's lines that are off its centre moved with its box (o to box) in proportion, so a port on the
  // border stays on it: a glyph resized, a complex resized by its handles (scaleEnds: its box already written)
  function scaleEnds(t, id, o, box, opt) {
    var G = gml(t, opt);
    if (!G.node[id]) return t;
    var T = new Tags(t, G.doc);
    scaleOn(T, G, id, o, box);
    return T.text();
  }
  function scaleOn(T, G, id, o, box, Lfix) {   // Lfix: a process's or gate's antenna set to that length
    var w = box[2], h = box[3], hub = isHub(G, id);
    // an end that comes to lie within 1.5 of the line from the centre toward the line's next point is read by the
    // converter as aimed at the centre (sbgnml.at): set so here too, so the editor draws what the file will hold
    var kx = o[2] ? w / o[2] : 1, ky = o[3] ? h / o[3] : 1, c = centre(box);
    var endAt = function (gid, ox, oy) { var b = gid === id ? box : G.node[gid] && G.node[gid].box; return b ? [b[0] + b[2] / 2 + ox, b[1] + b[3] / 2 + oy] : null; };
    Object.keys(G.edge).forEach(function (k) {
      var e = G.edge[k];
      [[e.s, 'sx', 'sy', 0], [e.t, 'tx', 'ty', 2]].forEach(function (q) {
        if (q[0] !== id || (!e.off[q[3]] && !e.off[q[3] + 1])) return;
        var v = [e.off[q[3]] * kx, e.off[q[3] + 1] * ky], j = 2 - q[3], L = hub ? portLen(o, e.off[q[3]], e.off[q[3] + 1]) : null;
        if (L != null && Lfix != null) L = Lfix;
        if (L != null) v = Math.abs(e.off[q[3]]) >= Math.abs(e.off[q[3] + 1]) ? [Math.sign(e.off[q[3]]) * (w / 2 + L), 0] : [0, Math.sign(e.off[q[3] + 1]) * (h / 2 + L)];   // a process's or gate's port: its antenna as long as before (or Lfix)
        var aim = e.pts.length ? e.pts[q[3] ? e.pts.length - 1 : 0] : endAt(q[3] ? e.s : e.t, e.off[j], e.off[j + 1]);
        if (aim && L == null) {
          var u = [aim[0] - c[0], aim[1] - c[1]], n = Math.hypot(u[0], u[1]);
          if (n && Math.abs(u[0] * v[1] - u[1] * v[0]) / n <= 1.5 && u[0] * v[0] + u[1] * v[1] >= 0) v = [0, 0];
        }
        var r4 = function (x) { return Math.round(x * 10000) / 10000; };   // as write() puts the point in the file: the offset the converter reads back
        if (v[0] || v[1]) v = [r4(c[0] + v[0]) - c[0], r4(c[1] + v[1]) - c[1]];
        if (Math.abs(v[0] - e.off[q[3]]) < 1e-9 && Math.abs(v[1] - e.off[q[3] + 1]) < 1e-9) return;   // unchanged: as written
        T.set(e.path, q[1], repr(v[0])); T.set(e.path, q[2], repr(v[1]));
      });
    });
  }
  // the axis yrender gives a process or gate whose arcs give no port (its hub_ports): [in, out] as offsets from its
  // centre at antenna L, from where its arcs come from and go to; null with no arc
  function drawnPorts(G, id, b, L) {
    var c = centre(b), I = [], O = [], aim = function (e, end) { return e.pts.length ? e.pts[end ? e.pts.length - 1 : 0] : G.node[end ? e.s : e.t] ? centre(G.node[end ? e.s : e.t].box) : null; };
    Object.keys(G.edge).forEach(function (k) {
      var e = G.edge[k], p;
      if (e.t === id && headOf(e) === 'none' && (p = aim(e, true))) I.push(p);
      else if (e.s === id && (p = aim(e, false))) O.push(p);
    });
    var mean = function (q) { return [q.reduce(function (s, p) { return s + p[0]; }, 0) / q.length, q.reduce(function (s, p) { return s + p[1]; }, 0) / q.length]; };
    var spread = function (q, i) { var v = q.map(function (p) { return p[i]; }); return Math.max.apply(null, v) - Math.min.apply(null, v); }, v;
    if (isGate(G, id) && O.length) { var go = mean(O); v = [go[0] - c[0], go[1] - c[1]]; }
    else if (I.length) { var a = mean(I), z = O.length ? mean(O) : c; v = [z[0] - a[0], z[1] - a[1]]; }
    else if (O.length > 1) v = [spread(O, 0), spread(O, 1)];
    else if (O.length) v = [O[0][0] - c[0], O[0][1] - c[1]];
    else return null;
    var hz = Math.abs(v[0]) >= Math.abs(v[1]), k = (hz ? v[0] : v[1]) >= 0 ? 1 : -1, r = (hz ? b[2] : b[3]) / 2 + (L != null ? L : Math.max(0.5 * (hz ? b[2] : b[3]), 9));   // yrender's ANTENNA, ANTENNA_MIN
    return [hz ? [-k * r, 0] : [0, -k * r], hz ? [k * r, 0] : [0, k * r]];
  }
  // the antenna of every process and gate of the map, { id: length }: the longest of its ports beyond its box, read from
  // its arcs' ends at them, else from the file's own ports (opt.sbgn: arcs read at the centre), else the one yrender
  // draws from its arcs (drawnPorts); one with no arc left out
  function antennas(t, opt) {
    var G = gml(t, opt), S = null, out = {};
    Object.keys(G.edge).forEach(function (k) {
      var e = G.edge[k];
      [[e.s, 0], [e.t, 2]].forEach(function (q) {
        var id = q[0], L = isHub(G, id) ? portLen(G.node[id].box, e.off[q[1]], e.off[q[1] + 1]) : null;
        if (L != null && !(out[id] >= L)) out[id] = L;
      });
    });
    G.ids.forEach(function (id) {
      if (out[id] != null || !isHub(G, id)) return;
      var b = G.node[id].box, pp = opt && opt.sbgn ? hubPorts(G, id, null, true, S || (S = sbgn(opt.sbgn, opt))) : [null];
      if (!pp[0]) pp = drawnPorts(G, id, b, null) || [null];
      var L = pp[0] ? portLen(b, pp[0][0], pp[0][1]) : null;
      if (L != null) out[id] = L;
    });
    Object.keys(out).forEach(function (id) { out[id] = Math.round(out[id] * 100) / 100; });
    return out;
  }
  // processes, gates (and other glyphs) given a box, an antenna and a gate's letters' size in one reading of the text:
  // items [{ id, box (its new box, or none), ant (the antenna's length, or none: kept), letters (AND, OR, NOT's size, or
  // none) }]. A resize keeps every antenna as long as it was (scaleOn); a glyph with no port yet (its arcs at the centre)
  // gets its ports where the file has them, else where yrender draws them (drawnPorts), at the antenna asked: the
  // consumptions (a gate's inputs) on the port in, what leaves on the port out (on the nearer with nothing coming in, or
  // with the file's own ports).
  // write() gives the file's ports these places
  function fit(t, items, opt) {
    var G = gml(t, opt), T = new Tags(t, G.doc), S = null;
    items.forEach(function (it) {
      var n = G.node[it.id];
      if (!n) return;
      var id = it.id, o = n.box, nb = it.box || o, hub = isHub(G, id), moved = nb.some(function (v, j) { return Math.abs(v - o[j]) > 1e-9; });
      var letters = it.letters != null && GLT.test(classOfR(n.geo.parentNode) || '') && lookG(G, id).font !== it.letters ? it.letters : null;
      if (moved) boxOn(T, G, id, nb, letters != null);
      if (letters != null) setFont(T, G, id, letters, nb);
      var ports = hub && Object.keys(G.edge).some(function (k) { var e = G.edge[k]; return (e.s === id && portLen(o, e.off[0], e.off[1]) != null) || (e.t === id && portLen(o, e.off[2], e.off[3]) != null); });
      var L = hub && it.ant != null ? Math.max(it.ant, 1) : null;
      if (moved || (ports && L != null)) scaleOn(T, G, id, o, nb, L);
      if (!hub || ports || L == null) return;
      var pp = opt && opt.sbgn ? hubPorts(G, id, null, true, S || (S = sbgn(opt.sbgn, opt))) : [null];
      var at = function (v) { return Math.abs(v[0]) >= Math.abs(v[1]) ? [Math.sign(v[0]) * (nb[2] / 2 + L), 0] : [0, Math.sign(v[1]) * (nb[3] / 2 + L)]; };
      var own = !!(pp[0] && pp[1]);
      pp = own ? [at(pp[0]), at(pp[1])] : drawnPorts(G, id, nb, L);
      if (!pp) return;
      var c = centre(nb), r4 = function (v) { return [Math.round((c[0] + v[0]) * 10000) / 10000 - c[0], Math.round((c[1] + v[1]) * 10000) / 10000 - c[1]]; };   // as write() puts the port in the file
      var ins = Object.keys(G.edge).some(function (k) { var e = G.edge[k]; return e.t === id && headOf(e) === 'none'; });
      Object.keys(G.edge).forEach(function (k) {
        var e = G.edge[k], v = null, a = null;
        if (e.t === id && headOf(e) === 'none' && !e.off[2] && !e.off[3]) { v = pp[0]; a = ['tx', 'ty']; }
        else if (e.s === id && !e.off[0] && !e.off[1]) {
          a = ['sx', 'sy']; v = pp[1];
          if (!ins || own) { var q = e.pts.length ? e.pts[0] : G.node[e.t] && centre(G.node[e.t].box), cc = centre(o); if (q && Math.hypot(cc[0] + pp[0][0] - q[0], cc[1] + pp[0][1] - q[1]) < Math.hypot(cc[0] + pp[1][0] - q[0], cc[1] + pp[1][1] - q[1])) v = pp[0]; }   // nothing coming in, or the file's own ports (a reversible process's products leave from both): the nearer port
        }
        if (!v) return;
        v = r4(v); T.set(e.path, a[0], repr(v[0])); T.set(e.path, a[1], repr(v[1]));
      });
    });
    return T.text();
  }
  function antenna(t, id, L, opt) { return fit(t, [{ id: id, ant: L }], opt); }   // every port of process or gate id at antenna L
  function remove(t, ids, opt) {   // nodes deleted in the editor's GraphML, a complex with its members, with every line at them; their ids kept for write()
    var G = gml(t, opt), T = new Tags(t, G.doc), del = {};
    ids.forEach(function (id) {
      if (!G.node[id]) return;
      del[id] = 1;
      Array.prototype.forEach.call(G.node[id].el.getElementsByTagNameNS(GNS, 'node'), function (m) { if (G.node[m.getAttribute('id')]) del[m.getAttribute('id')] = 1; });   // a complex's members go with it
    });
    Object.keys(del).forEach(function (id) {   // each element cut once: the outermost of what goes
      for (var p = G.node[id].el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (p.localName === 'node' && del[p.getAttribute('id')]) return;
      T.cut(G.node[id].el);
    });
    Object.keys(G.edge).forEach(function (k) {
      var e = G.edge[k]; if (!del[e.s] && !del[e.t]) return;
      for (var p = e.el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (p.localName === 'node' && del[p.getAttribute('id')]) return;   // inside a node cut already
      T.cut(e.el);
    });
    return goneMark(plainEmpty(T.text(), opt), Object.keys(del));
  }
  // a complex group left with no member (its last one deleted) made yEd's plain Complex again, as the converter writes an
  // empty complex (nodeXml: its name in the middle), so the editor draws what the file will hold and Delete takes it
  function plainEmpty(t, opt) {
    for (var pass = 0; pass < 1000; pass++) {
      var G = gml(t, opt), cid = G.ids.filter(function (id) {
        var n = G.node[id], g = kids(n.el, 'graph')[0];
        return cfgOf(n.geo.parentNode) === 'Complex' && g && !g.getElementsByTagNameNS(GNS, 'node').length;
      })[0];
      if (!cid) return t;
      var C = G.node[cid], r = C.geo.parentNode, T = new Tags(t, G.doc), raw = function (el) { return T.t.slice(T.at.get(el)[0], T.end(el)); }, B = C.box;
      var L = labelsOf(G, cid), name = L.main ? ownText(L.main) : '', fs = L.main ? F(L.main.getAttribute('fontSize')) || 14 : 14, c = labelBox(name, B[2], B[3], fs / 14);
      var label = '<y:NodeLabel alignment="center" autoSizePolicy="content" fontFamily="Dialog" fontSize="' + fs + '" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" height="' + repr(c[1]) +
        '" horizontalTextPosition="center" iconTextGap="4" modelName="internal" modelPosition="c" textColor="#000000" verticalTextPosition="bottom" visible="true" width="' + repr(c[0]) + '" x="' + repr(c[2]) +
        '" xml:space="preserve" y="' + repr(c[3]) + '" hasText="' + (name ? 'true' : 'false') + '"' + (name ? '>' + esc(name) + '</y:NodeLabel>' : '/>');
      var data = '<data key="ng">\n        <y:GenericNode configuration="com.yworks.sbgn.Complex">\n          <y:Geometry height="' + repr(B[3]) + '" width="' + repr(B[2]) + '" x="' + repr(B[0]) + '" y="' + repr(B[1]) + '"/>\n' +
        '          ' + (kid(r, 'Fill') ? raw(kid(r, 'Fill')) : '<y:Fill color="#FFFFFF" transparent="false"/>') + '\n          ' + (kid(r, 'BorderStyle') ? raw(kid(r, 'BorderStyle')) : '<y:BorderStyle color="#000000" type="line" width="1.0"/>') + '\n          ' + label +
        L.icons.map(function (q) { return raw(q[0]); }).join('') + '\n' + (isMulti(G, cid) ? '          <y:StyleProperties>\n            ' + MCOUNT + '</y:StyleProperties>\n' : '') + '        </y:GenericNode>\n      </data>';
      T.unset(C.el, 'yfiles.foldertype');
      T.ed.push([T.at.get(r.parentNode.parentNode.parentNode)[0], T.end(r.parentNode.parentNode.parentNode), data]);   // the data round ProxyAutoBoundsNode/Realizers
      T.cut(kids(C.el, 'graph')[0]);
      t = T.text();
    }
    return t;
  }
  // a process made another kind (the right-click menu's Make process, Make omitted process, Make
  // uncertain process): its sign written as its label, as graphml.write writes it
  function kind(t, id, cls, opt) {   // the sign at the template's 14 (graphml.write sets no font on a sign), its box at the map's font
    if (/^(and|or|not)$/.test(cls)) {   // a gate made another: AND, OR, NOT; the equivalence keeps its own rules (entities only)
      var Gg = gml(t, opt), ng = Gg.node[id], ins = Object.keys(Gg.edge).filter(function (k) { return Gg.edge[k].t === id; }).length;
      return ng && /^(and|or|not)$/.test(classOfR(ng.geo.parentNode) || '') && !(cls === 'not' && ins > 1) ? label(t, id, GATE[cls], opt) : t;   // a NOT has one input
    }
    if (!PROC.test(cls)) return t;
    var G0 = gml(t, opt), n0 = G0.node[id];   // never an association or dissociation (the node property SBGN class): not one the editor changes
    if (!n0 || kids(n0.el, 'data').some(function (d) { return /^(association|dissociation)$/.test(ownText(d).trim()); })) return t;
    t = label(t, id, SIGN[cls] || '', opt);
    var G = gml(t, opt), L = G.node[id] && labelsOf(G, id).main;
    if (!L || !SIGN[cls] || L.getAttribute('fontSize') === '14') return t;
    var T = new Tags(t, G.doc); T.set(L, 'fontSize', '14'); return T.text();
  }
  // ---------- arcs ----------
  // An arc made in the editor is an edge of its GraphML as graphml.write writes one from yed.graphml's template: its
  // arrowhead the class (graphml.ARROW), its end at an entity on the centre (0, 0), its end at a process on the port, so
  // yrender draws the antennas from it. write() puts the arc into the SBGN-ML file, its process end named the port (a
  // bare process gets its two ports and its orientation then), and graphml() makes the edge again from the file.
  // graphml.py's ARROW (its master), by SBGN class
  var ARROW = { consumption: 'none', production: 'delta', catalysis: 'white_circle', inhibition: 't_shape', modulation: 'white_diamond',
                stimulation: 'white_delta', 'necessary stimulation': 'white_delta_bar', 'logic arc': 'none', 'equivalence arc': 'none' };
  // Activity Flow's influences, drawn with the arrowheads of the modulations they read as (sbgnml.HEAD); after them, so
  // an arrowhead reads back as the PD class (headClass), named again by AF_ARC where the map is Activity Flow
  var AF_ARC = { stimulation: 'positive influence', inhibition: 'negative influence', modulation: 'unknown influence' }, PD_ARC = {};
  Object.keys(AF_ARC).forEach(function (k) { PD_ARC[AF_ARC[k]] = k; ARROW[AF_ARC[k]] = ARROW[k]; });
  function edgeXml(id, s, t, off, head, pts, ind) {   // graphml.write's edge (pretty printed as lxml writes it)
    var i1 = ind + '  ', i2 = i1 + '  ', i3 = i2 + '  ';
    return '<edge id="' + esc(id) + '" source="' + esc(s) + '" target="' + esc(t) + '">\n' + i1 + '<data key="eg">\n' + i2 + '<y:PolyLineEdge>\n' + i3 +
      '<y:Path sx="' + repr(off[0]) + '" sy="' + repr(off[1]) + '" tx="' + repr(off[2]) + '" ty="' + repr(off[3]) + '"' +
      (pts.length ? '>' + pts.map(function (p) { return '<y:Point x="' + repr(p[0]) + '" y="' + repr(p[1]) + '"/>'; }).join('') + '</y:Path>' : '/>') + '\n' + i3 +
      '<y:LineStyle color="#000000" type="line" width="1.0"/>\n' + i3 + '<y:Arrows source="none" target="' + head + '"/>\n' + i3 + '<y:BendStyle smoothed="false"/>\n' + i2 +
      '</y:PolyLineEdge>\n' + i1 + '</data>\n' + ind + '</edge>';
  }
  function edgesIn(t, G, list) {   // the edges ([id, s, t, off, head, pts]) put after the last edge of the map's graph
    var T = new Tags(t, G.doc), graph = kids(G.doc.documentElement, 'graph')[0], es = kids(graph, 'edge'), last = es[es.length - 1];
    var ind = last ? T.indent(last) : T.indent(graph) + '  ', xml = list.map(function (q) { return edgeXml(q[0], q[1], q[2], q[3], q[4], q[5], ind); });
    var s = T.at.get(graph);
    if (s[2]) T.ed.push([s[0], s[1], T.t.slice(s[0], s[1] - 2) + '>\n' + ind + xml.join('\n' + ind) + '\n' + T.indent(graph) + '</graph>']);
    else if (last) { var e = T.end(last); T.ed.push([e, e, '\n' + ind + xml.join('\n' + ind)]); }
    else { var c = T.t.lastIndexOf('</', T.end(graph) - 1); T.ed.push([c, c, xml.join('\n' + ind) + '\n' + T.indent(graph)]); }
    return T.text();
  }
  function headOf(e) { var a = e.el.getElementsByTagNameNS(YNS, 'Arrows')[0]; return a ? a.getAttribute('target') || 'none' : 'none'; }
  // the two ports of a process, from its centre: where its arcs have them (a consumption's end the port in, a production's
  // start the port out; a missing one mirrored), else on the axis toward `toward` (the first arc's other end), as yrender
  // puts antennas (the nearer of horizontal or vertical, side / 2 + the antenna out: antFor); [in, out]
  function isGate(G, id) { return /\.Operator$/.test(G.node[id].geo.parentNode.getAttribute('configuration') || ''); }
  function hubPorts(G, pid, toward, asIn, S, opt) {   // S: the SBGN-ML file read, for its ports; opt.ant: the antenna for ports worked out
    var n = G.node[pid], b = n.box, c = centre(b), pin = null, pout = null, nz = function (x, y) { return Math.abs(x) > 1e-9 || Math.abs(y) > 1e-9; };
    Object.keys(G.edge).forEach(function (k) {
      var e = G.edge[k], h = headOf(e);
      if (e.t === pid && h === 'none' && nz(e.off[2], e.off[3]) && !pin) pin = [e.off[2], e.off[3]];
    });
    Object.keys(G.edge).forEach(function (k) {   // a production from the port in (a reversible process) is not the port out
      var e = G.edge[k];
      if (e.s === pid && nz(e.off[0], e.off[1]) && !pout && !(pin && Math.abs(e.off[0] - pin[0]) < 1 && Math.abs(e.off[1] - pin[1]) < 1)) pout = [e.off[0], e.off[1]];
    });
    var f = !pin && !pout && S && S.glyph[pid], fp = f ? kids(f.el, 'port') : [];
    if (fp.length >= 2) {   // the file's own ports (its arcs at them read as the centre): the one its consumptions end at is in
      var ids = fp.map(function (q) { return q.getAttribute('id'); }), fc = centre(f.box), k0 = 0;
      Object.keys(S.arc).forEach(function (k) { var a = S.arc[k], j = ids.indexOf(a.getAttribute('target')); if (j >= 0 && flux(a) && !k0) k0 = j + 1; });
      var o = function (q) { var P = xy(q); return [P[0] - fc[0], P[1] - fc[1]]; };
      pin = o(fp[k0 ? k0 - 1 : 0]); pout = o(fp[k0 === 2 ? 0 : 1]);
    }
    if (!pin && !pout && toward) {
      var dx = toward[0] - c[0], dy = toward[1] - c[1], hz = Math.abs(dx) >= Math.abs(dy);
      // a modulation drawn to the bare process first holds a side: the antennas go along the other axis
      if (heldAxis(G, pid) === hz) hz = !hz;
      var side = hz ? b[2] : b[3], r = side / 2 + antFor(opt, isGate(G, pid));
      var p = hz ? [(dx >= 0 ? 1 : -1) * r, 0] : [0, (dy >= 0 ? 1 : -1) * r];
      if (asIn) pin = p; else pout = p;
    }
    if (!pin && pout) pin = [-pout[0], -pout[1]];
    if (!pout && pin) pout = [-pin[0], -pin[1]];
    var r4 = function (v) { return v && [Math.round((c[0] + v[0]) * 10000) / 10000 - c[0], Math.round((c[1] + v[1]) * 10000) / 10000 - c[1]]; };   // as write() puts the port in the file: the offset the converter reads back
    return [r4(pin), r4(pout)];
  }
  // the axis the modulations of process pid hold (true: they come in on the left or right), null when they hold none or
  // both: each modulation's end, or where it comes from when its end is at the centre
  function heldAxis(G, pid) {
    var c = centre(G.node[pid].box), held = Object.keys(G.edge).map(function (k) { return G.edge[k]; }).filter(function (e) { return e.t === pid && G.node[e.s] && MODS.test(headClass(headOf(e)) || ''); }).map(function (e) {
      var b = G.node[pid].box, x = Math.abs(e.off[2]) / (b[2] / 2 || 1), y = Math.abs(e.off[3]) / (b[3] / 2 || 1);
      if (x > 0.5 && y > 0.5) return null;   // at a corner: beside either axis, so it holds none
      if (Math.abs(e.off[2]) > 1e-9 || Math.abs(e.off[3]) > 1e-9) return Math.abs(e.off[2]) >= Math.abs(e.off[3]);
      var f = centre(G.node[e.s].box); return Math.abs(f[0] - c[0]) >= Math.abs(f[1] - c[1]);
    }).filter(function (h) { return h !== null; });
    return held.length && held.every(function (h) { return h === held[0]; }) ? held[0] : null;
  }
  // an arc from glyph s to glyph t, id given: a consumption
  // from an entity into a process, a production from a process to an entity, a logic arc into a gate (from an entity, or a
  // gate's port out) or out of an equivalence to an entity, a modulation (catalysis, stimulation, inhibition, necessary
  // stimulation, modulation) from an entity or a gate's port out to a process or a phenotype. An end at a process or gate
  // on its port (the axis guessed by the first arc, re-guessed by the second), a modulation's end at a process the middle of
  // the side off its antennas that faces where it comes from, an entity's end at its centre. opt.sbgn, the SBGN-ML text: a
  // process's own ports
  var sLast = [null, null], MODS = /^(catalysis|stimulation|inhibition|modulation|necessary stimulation)$/;
  function connect(t, id, s, tg, cls, opt) {
    var G = gml(t, opt);
    if (!G.node[s] || !G.node[tg] || !ARROW[cls]) return t;
    if (ARROW[cls] === 'none' && isTag(G, s) && !isTag(G, tg)) { var sw = s; s = tg; tg = sw; }   // a line at a tag: an equivalence arc, from the entity
    var off = [0, 0, 0, 0], cfg = function (x) { return G.node[x].geo.parentNode.getAttribute('configuration') || ''; };
    var hub = function (x) { return /\.(Process|Operator)$/.test(cfg(x)); };
    var S = opt && opt.sbgn ? (sLast[0] === opt.sbgn ? sLast[1] : (sLast = [opt.sbgn, sbgn(opt.sbgn, opt)])[1]) : null;   // read once for the arcs of one step (only read, never edited)
    var own = function (x) { return !!(S && S.glyph[x] && kids(S.glyph[x].el, 'port').length >= 2); };
    // the hub ends on their ports: the source's port out (a production, a gate's output), the target's port in (a
    // consumption, a gate's input)
    [[s, tg, false, cls === 'production' || cls === 'logic arc' || MODS.test(cls)], [tg, s, true, cls === 'consumption' || cls === 'logic arc']].forEach(function (q) {
      var pid = q[0], other = q[1], asIn = q[2];
      if (!q[3] || !hub(pid)) return;
      var re = !own(pid) ? reguess(t, G, pid, other, asIn, opt) : null;   // a process or gate without the file's own ports
      if (re) { t = re; G = gml(t, opt); }
      var pp = hubPorts(G, pid, centre(G.node[other].box), asIn, S, opt);
      if (asIn) { off[2] = pp[0][0]; off[3] = pp[0][1]; } else { off[0] = pp[1][0]; off[1] = pp[1][1]; }
    });
    if (MODS.test(cls) && /\.Process$/.test(cfg(tg))) {   // a modulation at a process: the middle of a side off the antennas
      var b = G.node[tg].box, c = centre(b), from = centre(G.node[s].box);
      from = [from[0] + off[0], from[1] + off[1]];
      var pp2 = hubPorts(G, tg, null, true, S), ax = pp2[0] ? (Math.abs(pp2[0][0]) >= Math.abs(pp2[0][1]) ? 'h' : 'v') : null;
      var dx = from[0] - c[0], dy = from[1] - c[1], vert = ax ? ax === 'h' : Math.abs(dy) > Math.abs(dx);   // on the top or bottom side
      var v = vert ? [0, (dy >= 0 ? 1 : -1) * b[3] / 2] : [(dx >= 0 ? 1 : -1) * b[2] / 2, 0];
      var u = [from[0] - c[0], from[1] - c[1]], n = Math.hypot(u[0], u[1]);
      if (n && Math.abs(u[0] * v[1] - u[1] * v[0]) / n <= 1.5 && u[0] * v[0] + u[1] * v[1] >= 0) v = [0, 0];   // on the line to the centre: read so by the converter (sbgnml.at)
      else v = [Math.round((c[0] + v[0]) * 10000) / 10000 - c[0], Math.round((c[1] + v[1]) * 10000) / 10000 - c[1]];   // as write() puts it in the file
      off[2] = v[0]; off[3] = v[1];
    }
    return edgesIn(t, G, [[id, s, tg, off, ARROW[cls], []]]);
  }
  // the second link re-guesses the axis (with both links known; a placing done by hand
  // is kept): a process with one consumption or production whose port still lies on the side the
  // first arc's guess gives (so not turned by hand, nor a file's own placing) is set again along the pull of both ends,
  // from the mean of what goes in to the mean of what comes out, the nearer of horizontal or vertical; the first arc's
  // end moved to its new port. The text with that change, or null when nothing is re-guessed
  function reguess(t, G, pid, other, asIn, opt) {
    var gate = /\.Operator$/.test(G.node[pid].geo.parentNode.getAttribute('configuration') || '');   // a gate's output: any arc out of it
    var flux = Object.keys(G.edge).map(function (k) { return G.edge[k]; }).filter(function (e) {
      return (e.t === pid && headOf(e) === 'none') || (e.s === pid && (gate || headOf(e) === 'delta'));
    });
    if (flux.length !== 1) return null;
    var e = flux[0], eIn = e.t === pid, o = eIn ? [e.off[2], e.off[3]] : [e.off[0], e.off[1]], b = G.node[pid].box, c = centre(b);
    if (Math.abs(o[0]) < 1e-9 && Math.abs(o[1]) < 1e-9) return null;   // at the centre: the file's own ports, kept
    var far = centre(G.node[eIn ? e.s : e.t].box), side = function (v) { return Math.abs(v[0]) >= Math.abs(v[1]) ? (v[0] >= 0 ? 'E' : 'W') : (v[1] >= 0 ? 'S' : 'N'); };
    if (side(o) !== side([far[0] - c[0], far[1] - c[1]])) return null;   // turned by hand, or placed so by the file: kept
    if (eIn === asIn) return null;   // one in and one out only: two of a kind keep the first guess (else two productions turn across their flow)
    var A = eIn ? far : centre(G.node[other].box), B = eIn ? centre(G.node[other].box) : far, dx = B[0] - A[0], dy = B[1] - A[1];
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
    var Lnow = portLen(b, o[0], o[1]);   // the antenna it has (one set in Properties kept): only the axis is guessed again
    var hz = Math.abs(dx) >= Math.abs(dy), k = (hz ? dx : dy) >= 0 ? 1 : -1, r = (hz ? b[2] : b[3]) / 2 + (Lnow != null ? Lnow : antFor(opt, gate));
    if (!gate && heldAxis(G, pid) === hz) return null;   // the antennas never onto a side a modulation holds
    var pout = hz ? [k * r, 0] : [0, k * r], want = eIn ? [-pout[0], -pout[1]] : pout;
    want = [Math.round((c[0] + want[0]) * 10000) / 10000 - c[0], Math.round((c[1] + want[1]) * 10000) / 10000 - c[1]];   // as hubPorts rounds
    if (Math.abs(want[0] - o[0]) < 1e-6 && Math.abs(want[1] - o[1]) < 1e-6) return null;
    var T = new Tags(t, G.doc), a = eIn ? ['tx', 'ty'] : ['sx', 'sy'];
    T.set(e.path, a[0], repr(want[0])); T.set(e.path, a[1], repr(want[1]));
    if ((Math.abs(o[0]) >= Math.abs(o[1])) !== hz) Object.keys(G.edge).forEach(function (k) {   // the axis turned a quarter: a modifier's end on a side off the antennas turned with it, as Turn process does
      var m = G.edge[k];
      if (m === e) return;
      [[m.t === pid, 2, ['tx', 'ty']], [m.s === pid, 0, ['sx', 'sy']]].forEach(function (q) {
        var x = m.off[q[1]], y = m.off[q[1] + 1];
        if (!q[0] || (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9)) return;
        T.set(m.path, q[2][0], repr(-y * b[2] / b[3])); T.set(m.path, q[2][1], repr(x * b[3] / b[2]));   // on the side it turns to (a glyph not square: scaled to it)
      });
    });
    return T.text();
  }
  // a process made reversible (Make reversible, as on CellDesigner reactions): each consumption turned into a production
  // leaving from the same port (the line reversed: its ends, its bend points, its colour and width kept), so the process
  // has productions on both sides, as SBGN draws a reversible process (only with a production already: else the reaction
  // would be drawn backwards); made irreversible: the productions on the port-in side (the file's port .1 where it has
  // its own ports) turned back into consumptions (at least one production stays). Lines between entities only, never
  // a gate's. The new arcs carry the line's colour, width and dash, not the file arc's notes or annotation. ids: one new edge id for each arc turned (the
  // old ids marked deleted for write()). reversibility(g, id) -> null for no process, else { can: the consumptions
  // Make reversible would turn, rev: the productions on the port-in side Make irreversible would turn back }
  function revSides(G, pid, opt) {   // [consumptions, productions on the port-in side, productions]
    var n = G.node[pid], c = centre(n.box), es = Object.keys(G.edge).map(function (k) { return G.edge[k]; });
    var ent = function (x) { return G.node[x] && !/\.(Process|Operator)$/.test(G.node[x].geo.parentNode.getAttribute('configuration') || ''); };   // an entity, not a gate or another process
    var cons = es.filter(function (e) { return e.t === pid && headOf(e) === 'none' && ent(e.s); });
    var prods = es.filter(function (e) { return e.s === pid && headOf(e) === ARROW.production && ent(e.t); });
    if (!prods.length) return [[], [], prods];   // no production: turning its consumptions would draw the reaction backwards
    if (cons.length || prods.length < 2) return [cons, [], prods];
    var dir = function (e) { return Math.abs(e.off[0]) > 1e-9 || Math.abs(e.off[1]) > 1e-9 ? [e.off[0], e.off[1]] : (function (f) { return [f[0] - c[0], f[1] - c[1]]; })(e.pts.length ? e.pts[0] : centre(G.node[e.t].box)); };
    var S = opt && opt.sbgn ? sbgn(opt.sbgn, opt) : null, f = S && S.glyph[pid], fp = f ? kids(f.el, 'port') : [], pin;
    if (fp.length >= 2) { var fc = centre(f.box), q1 = xy(fp[0]); pin = [q1[0] - fc[0], q1[1] - fc[1]]; }   // the file's own ports: its first (.1) is in, SBGN-ML's way
    else { var pp = hubPorts(G, pid, null, true, S); pin = pp[0] || (function (d) { return [-d[0], -d[1]]; })(dir(prods[0])); }
    var ins = prods.filter(function (e) { var d = dir(e); return d[0] * pin[0] + d[1] * pin[1] > 0; });
    return [cons, ins.length < prods.length ? ins : [], prods];
  }
  function reversibility(t, pid, opt) {
    var G = gml(t, opt);
    if (!G.node[pid] || !/\.Process$/.test(G.node[pid].geo.parentNode.getAttribute('configuration') || '')) return null;
    var r = revSides(G, pid, opt);
    return { can: r[0].length, rev: r[1].length };   // how many arcs each way would turn
  }
  function reversible(t, pid, on, ids, opt) {
    var G = gml(t, opt);
    if (!G.node[pid]) return t;
    var r = revSides(G, pid, opt), turn = on ? r[0] : r[1];
    if (!turn.length || ids.length < turn.length) return t;
    var looks = turn.map(function (e) { var ls = e.el.getElementsByTagNameNS(YNS, 'LineStyle')[0]; return ls ? [ls.getAttribute('color') || '#000000', ls.getAttribute('width') || '1.0', ls.getAttribute('type') || 'line'] : null; });
    var list = turn.map(function (e, k) { return [ids[k], e.t, e.s, [e.off[2], e.off[3], e.off[0], e.off[1]], on ? ARROW.production : 'none', e.pts.slice().reverse()]; });
    t = arcRemove(t, turn.map(function (e) { return e.el.getAttribute('id'); }), opt);
    t = edgesIn(t, gml(t, opt), list);
    list.forEach(function (q, k) {   // the line's own colour and width, as before
      var L = looks[k];
      if (!L || (L[0].toUpperCase() === '#000000' && F(L[1]) === 1 && L[2] === 'line')) return;
      var at = t.indexOf('<edge id="' + esc(q[0]) + '"'), ls = at >= 0 ? t.indexOf('<y:LineStyle ', at) : -1, end = ls >= 0 ? t.indexOf('>', ls) + 1 : -1;
      if (end > 0) t = t.slice(0, ls) + '<y:LineStyle color="' + esc(L[0]) + '" type="' + esc(L[2]) + '" width="' + esc(L[1]) + '"/>' + t.slice(end);
    });
    return t;
  }
  function arcRemove(t, ids, opt) {   // arcs deleted in the editor's GraphML; their ids kept for write()
    var G = gml(t, opt), T = new Tags(t, G.doc), del = [];
    ids.forEach(function (id) { if (G.edge[id]) { del.push(id); T.cut(G.edge[id].el); } });
    return del.length ? goneMark(T.text(), del) : t;
  }
  function arcClass(G, e, S) {   // the SBGN class of an edge the editor made: its arrowhead; the bare line a consumption, a logic arc into a gate
    var h = headOf(e);
    if (h !== 'none') return headClass(h);
    var tc = S && S.glyph[e.t] ? S.glyph[e.t].el.getAttribute('class') || '' : '', sc = S && S.glyph[e.s] ? S.glyph[e.s].el.getAttribute('class') || '' : '';
    if (/^(tag|terminal)$/.test(tc) || /^(tag|terminal)$/.test(sc) || isTag(G, e.t) || isTag(G, e.s)) return 'equivalence arc';   // a line at a tag
    return GATES.test(tc) || sc === 'equivalence' ? 'logic arc' : 'consumption';   // into a gate, or out of an equivalence to its entity
  }
  function headClass(h) { return h === 'none' ? null : Object.keys(ARROW).filter(function (k) { return ARROW[k] === h; })[0] || null; }
  // a modulation made another (the right-click menu over an arc): its arrowhead in the editor's GraphML;
  // write() sets the file's class from it, graphml() the arrowhead from the file's
  function arcKind(t, id, cls, opt) {
    var G = gml(t, opt), e = G.edge[id];
    if (!e || !MODS.test(cls) || !MODS.test(headClass(headOf(e)) || '')) return t;
    var ar = e.el.getElementsByTagNameNS(YNS, 'Arrows')[0];
    if (!ar || ar.getAttribute('target') === ARROW[cls]) return t;
    var T = new Tags(t, G.doc); T.set(ar, 'target', ARROW[cls]); return T.text();
  }
  function classOf(t, id, opt) { var g = sbgn(t, opt).glyph[id]; return g ? g.el.getAttribute('class') || '' : ''; }
  function nameable(t, id, opt) { var g = sbgn(t, opt).glyph[id]; return !!g && NAMED.test(g.el.getAttribute('class') || ''); }   // a name the editor may change: one write() carries
  function svText(value, variable) { return (value || '') + (variable ? '@' + variable : ''); }
  var HUB = /process|^(and|or|not|association|dissociation|equivalence|delay)$/;

  // ---------- Activity Flow (an AF map saved as clean SBGN Activity Flow whichever view it is drawn in) ----------
  // An activity is the node of its entity, as the converter draws it (CellDesigner's way; sbgnml.ACTIVITY the master: no
  // unit a protein's, an activity with no auxiliary unit is a protein activity), with the node properties "SBGN class"
  // biological activity and "SBGN unit" its unit's entity, if any, as sbgnml.read keeps them. write() writes a node so
  // marked as a biological activity with one unit of information: its entity and its text if any
  // (text allowed, free, ct:gene and ct:mRNA; the name goes in the activity), and the influences under AF's names, a plain entity made as its
  // activity (unitFor) and a perturbing agent as a perturbation, on a map that is Activity Flow (mapKind; one that turned
  // so by what was drawn on it is marked so). Elsewhere (a PD or hybrid map) the node is written as its entity.
  //   activity(g, id, unit) -> g with the node an activity of that unit ('' none): yEd's shape of the entity, the properties
  //   activities(g, opt, noText) -> { node id: unit } of the activities (noText: those whose unit has text left out, as
  //   proteinBoxes leaves them); afUnitBox(box, unit, text) -> the unit's box, drawn and written alike
  var UNIT_CLS = { '': 'macromolecule', macromolecule: 'macromolecule', 'simple chemical': 'simple chemical', 'nucleic acid feature': 'nucleic acid feature',
                   complex: 'complex', 'unspecified entity': 'unspecified entity', perturbation: 'phenotype' };   // the unit's entity -> the class drawn (sbgnml.ACTIVITY)
  // the unit an entity's activity gets by default, by its class or yEd's kind ('' for a protein's: no unit; null: not an
  // entity with an activity); the one master of this (graphml.js's SBGN view uses it; the palette keeps its own labels)
  function unitFor(k) {
    var c = (MAKE[k] ? k : classOfCfg(k) || k || '').replace(/ multimer$/, '');
    return c === 'macromolecule' ? '' : UNIT_CLS[c] === c ? c : null;
  }
  function actCls(unit) { return UNIT_CLS[(unit || '').replace(/ multimer$/, '')] || 'macromolecule'; }   // an unknown entity: a protein's, as the converter reads it
  function nameIn(el) {   // a glyph's name as sbgnml.read reads it: an activity's without 'activity' at its end ('SHC activity' is SHC)
    var lab = kid(el, 'label'), x = lab ? lab.getAttribute('text') || '' : '';
    return el.getAttribute('class') === 'biological activity' && /\sactivity\s*$/i.test(x) ? x.replace(/\s+activity\s*$/i, '') : x;
  }
  function fileUnit(el) {   // sbgnml.read: the entity of a biological activity's first unit of information, '' for none
    var u = kids(el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'unit of information'; })[0], e = u && kid(u, 'entity');
    return e ? e.getAttribute('name') || '' : '';
  }
  function keyOf(G, name) {   // the id of the node property's key, or null
    if (!G.K) { G.K = {}; kids(G.doc.documentElement, 'key').forEach(function (k) { if (k.getAttribute('for') === 'node' && k.getAttribute('attr.name')) G.K[k.getAttribute('attr.name')] = k.getAttribute('id'); }); }
    return G.K[name] || null;
  }
  function propEl(G, id, name) { var k = keyOf(G, name), n = G.node[id]; return k && n ? kids(n.el, 'data').filter(function (d) { return d.getAttribute('key') === k; })[0] || null : null; }
  function actText(G, id) {   // the text of an activity's unit: its node's first unit of information ('' none)
    var q = labelsOf(G, id).icons.filter(function (x) { return x[1].kind === 'UnitOfInformation'; })[0];
    return q ? q[1].text || '' : '';
  }
  function fileUText(el) { var u = unitsOf(el)[0]; return u ? unitText(u) : ''; }   // the file's, as the converter reads it: its first unit with text
  function afUnitFont(h) { return h * 0.72; }   // the text in an activity's unit, drawn in the SBGN AF view (the box's height 0.3 of the activity's)
  function actOf(G, id) {   // the unit of the activity id ('' none), or null: not an activity
    var c = propEl(G, id, 'SBGN class');
    if (!c || ownText(c).trim() !== 'biological activity') return null;
    var u = propEl(G, id, 'SBGN unit');
    return u ? ownText(u).trim() : '';
  }
  function afUnitOf(G, id) {   // write() under AF: the unit of an activity, or of a node kept as one while the file was PD (made(): 'SBGN AF class', its unit if its shape is still the unit's), null for neither
    var u = actOf(G, id);
    if (u != null) return u;
    var c = propEl(G, id, 'SBGN AF class');
    if (!c || ownText(c).trim() !== 'biological activity') return null;
    var p = propEl(G, id, 'SBGN unit'), k = p ? ownText(p).trim() : '', cfg = cfgOf(G.node[id].geo.parentNode);
    return MAKE[actCls(k)] === cfg ? k : unitFor(cfg);
  }
  // Protein auxiliary unit (a tick box: the units of protein activities shown or not, and the file
  // written as shown): every protein activity given the macromolecule unit (on) or its
  // unit taken off (off; one with text keeps it, SBGN-ML needing an entity beside the text); other units untouched
  function proteinBoxes(t, on, opt) {
    var G = gml(t, opt), M = {};
    G.ids.forEach(function (id) {
      var u = actOf(G, id);
      if (on && u === '') M[id] = { 'SBGN unit': 'macromolecule' };
      else if (!on && u === 'macromolecule' && !actText(G, id)) M[id] = { 'SBGN unit': null };
    });
    return Object.keys(M).length ? setPropsAll(t, M, opt) : t;
  }
  function activities(t, opt, noText) { var G = gml(t, opt), out = {}; G.ids.forEach(function (id) { var u = actOf(G, id); if (u != null && !(noText && u && actText(G, id))) out[id] = u; }); return out; }
  function setProps(t, id, P, opt) { var M = {}; M[id] = P; return setPropsAll(t, M, opt); }
  function setPropsAll(t, M, opt) {   // nodes' properties ({ id: { name -> text, null: none } }) in one pass, their keys declared where missing, as graphml.write writes them
    var G = gml(t, opt), T = new Tags(t, G.doc), keys = kids(G.doc.documentElement, 'key'), taken = keys.map(function (k) { return k.getAttribute('id'); }), decl = '', made = {};
    Object.keys(M).forEach(function (id) {
      var n = G.node[id], P = M[id], ins = '';
      if (!n) return;
      Object.keys(P).forEach(function (name) {
        var k = keyOf(G, name) || made[name], d = propEl(G, id, name), v = P[name];
        if (d) {
          if (v == null) T.cut(d);
          else if (ownText(d).trim() !== v) { var s = T.at.get(d); T.ed.push([s[0], T.end(d), '<data key="' + esc(k) + '">' + esc(v) + '</data>']); }
          return;
        }
        if (v == null) return;
        if (!k) {
          for (var j = 0; taken.indexOf('d' + j) >= 0; j++);
          k = made[name] = 'd' + j; taken.push(k);
          decl += '<key attr.name="' + esc(name) + '" attr.type="string" for="node" id="' + k + '"/>\n' + (keys.length ? T.indent(keys[0]) : '  ');
        }
        ins += '<data key="' + k + '">' + esc(v) + '</data>';
      });
      if (ins) { var e0 = T.at.get(n.el)[1]; T.ed.push([e0, e0, ins]); }
    });
    if (decl) { var at0 = keys.length ? T.at.get(keys[0])[0] : T.at.get(kids(G.doc.documentElement, 'graph')[0])[0]; T.ed.push([at0, at0, decl]); }
    return T.text();
  }
  var RADIUS = '<y:Property class="java.lang.Integer" name="com.yworks.sbgn.style.radius" value="10"/>';
  function activity(t, id, unit, opt) {
    var G = gml(t, opt), n = G.node[id], cls = actCls(unit);
    if (!n || n.el.getAttribute('yfiles.foldertype')) return t;   // a complex with members: not an activity of AF
    var r = n.geo.parentNode, was = actOf(G, id);
    if (was != null && was && !unit) {   // the unit taken off: its text goes with it (another kind keeps the text)
      var icons = labelsOf(G, id).icons.filter(function (q) { return q[1].kind === 'UnitOfInformation'; });
      if (icons.length) { var T0 = new Tags(t, G.doc); icons.forEach(function (q) { T0.cut(q[0]); }); t = T0.text(); G = gml(t, opt); n = G.node[id]; r = n.geo.parentNode; }
    }
    if (cfgOf(r) !== MAKE[cls]) {   // drawn as its entity (the reduced notation view): yEd's shape, rounded as the templates of a protein and a nucleic acid feature
      var T = new Tags(t, G.doc), sp = kid(r, 'StyleProperties'), rad = sp && kids(sp, 'Property').filter(function (p) { return p.getAttribute('name') === 'com.yworks.sbgn.style.radius'; })[0];
      var round = cls === 'macromolecule' || cls === 'nucleic acid feature';
      T.set(r, 'configuration', 'com.yworks.sbgn.' + MAKE[cls]);
      if (rad && !round) T.cut(kids(sp, 'Property').length > 1 ? rad : sp);
      if (!rad && round) {
        if (sp) { var s = T.at.get(sp); if (s[2]) T.ed.push([s[0], s[1], '<y:StyleProperties>' + RADIUS + '</y:StyleProperties>']); else { var c = T.t.lastIndexOf('</', T.end(sp) - 1); T.ed.push([c, c, RADIUS]); } }
        else { var c2 = T.t.lastIndexOf('</', T.end(r) - 1); T.ed.push([c2, c2, '<y:StyleProperties>' + RADIUS + '</y:StyleProperties>']); }
      }
      t = T.text();
    }
    var t2 = setProps(t, id, { 'SBGN class': 'biological activity', 'SBGN unit': unit || null, 'SBGN AF class': null }, opt);
    return was !== (unit || '') ? afIcon(t2, id, opt) : t2;
  }
  // the unit's box (small, at the top right, twice as wide as high for a protein, square for a metabolite): 0.3
  // of the activity's height (12 at 80 by 40), twice as wide, a simple chemical's as wide as high, centred on the top
  // edge, its inset from the right side a tenth of the width (at least 4)
  // A unit with text as wide as its text needs on one line (afUnitFont), a protein's when it has no entity
  function afUnitBox(b, unit, txt) {
    if (!unit && !txt) return null;
    var h = b[3] * 0.3, w = actCls(unit) === 'simple chemical' ? h : 2 * h;
    if (txt) w = Math.max(w, String(txt).trim().replace(/\s*\n\s*/g, ' ').length * afUnitFont(h) * 0.56 + h * 0.6);   // on one line, as the SBGN AF view draws it
    return [b[0] + b[2] - w - Math.max(4, b[2] * 0.1), b[1] - h / 2, w, h];
  }
  // what a map is, the one master (create.js palKind and write() read it), after
  // every change: with anything only PD has (KPDONLY, KPDARC, deco) 'pd', or 'hybrid' when a modulation ends on an entity
  // pool node or activity; else 'af' with an activity, a perturbation, an influence under AF's names, a modulation ending
  // on an entity (a direct link) or a file that says Activity Flow (its language, or SBGN-ML 0.3's version); else 'pd'
  // with entities, 'empty' with nothing but compartments. A link to a phenotype or a gate decides nothing
  var KMOD = /^(modulation|stimulation|catalysis|inhibition|necessary stimulation|positive influence|negative influence|unknown influence)$/;
  var KEPN = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity|complex|perturbing agent)( multimer)?$|^biological activity$/;
  var KPLAIN = /^(macromolecule|simple chemical|nucleic acid feature|unspecified entity|complex|perturbing agent)( multimer)?$/;   // an entity pool node, not an activity
  // what only Process Description has (it cannot be written
  // as clean Activity Flow): a process of any kind, an empty set, consumption, production, catalysis; on an
  // entity a state variable, a unit of information with text (ct:mRNA, N:2), members (a complex's), a multimer (deco)
  var KPDONLY = /^(process|omitted process|uncertain process|association|dissociation|source and sink)$/, KPDARC = /^(consumption|production|catalysis)$/;
  function kindOf(cls, arcs, fileAf, deco) {   // cls: { glyph id: class }, arcs: [[class, target id]], deco: an entity carries what only PD has
    var ids = Object.keys(cls);
    var ent = arcs.some(function (a) { return KMOD.test(a[0]) && KEPN.test(cls[a[1]] || ''); });
    if (deco || ids.some(function (i) { return KPDONLY.test(cls[i]); }) || arcs.some(function (a) { return KPDARC.test(a[0]); })) return ent ? 'hybrid' : 'pd';
    if (ent || ids.some(function (i) { return cls[i] === 'biological activity' || cls[i] === 'perturbation'; }) || arcs.some(function (a) { return !!PD_ARC[a[0]]; }) || fileAf) return 'af';
    // entities alone, no link between them: PD (the file's language aside, an AF file returned above), empty only when it
    // holds nothing but compartments
    var drawn = ids.some(function (i) { return !/^(compartment|state variable|unit of information|terminal)$/.test(cls[i]); });
    return drawn ? 'pd' : 'empty';
  }
  function decoS(el) {   // a glyph of the file: an entity that carries what only PD has (an activity: a state variable)
    var c = el.getAttribute('class') || '';
    if (c === 'biological activity') return kids(el, 'glyph').some(function (k) { return k.getAttribute('class') === 'state variable'; });
    if (!KPLAIN.test(c)) return false;
    if (/ multimer$/.test(c)) return true;
    return kids(el, 'glyph').some(function (k) { var kc = k.getAttribute('class'); return kc === 'unit of information' ? !!unitText(k) : true; });   // a state variable, a member
  }
  function decoG(G, id, el) {   // the same, in the editor's GraphML (el: the file's glyph, if any); an activity's unit may carry text (AF)
    var n = G.node[id];
    if (!n) return false;
    var ic = labelsOf(G, id).icons, act = el ? el.getAttribute('class') === 'biological activity' : afUnitOf(G, id) != null;
    return !!n.el.getAttribute('yfiles.foldertype') || isMulti(G, id) ||
      ic.some(function (q) { return q[1].kind === 'StateVariable' || (!act && q[1].kind === 'UnitOfInformation' && !!q[1].text); });
  }
  function mapKind(t) {   // from the SBGN-ML text alone, by its tags (no reading: create.js asks on every change of the drawing)
    t = t || '';
    var attr = function (tag, k) { var m = tag.match(new RegExp('\\s' + k + '\\s*=\\s*["\']([^"\']*)')); return m ? m[1] : ''; };
    var cls = {}, arcs = [], deco = false, st = [], mt, re = /<(\/?)(?:[\w.-]+:)?(glyph|arc|label)\b([^>]*?)(\/?)>/g;
    while ((mt = re.exec(t))) {
      if (mt[1]) { if (mt[2] !== 'label') st.pop(); continue; }
      var up = st[st.length - 1], a = mt[3], self = !!mt[4];
      if (mt[2] === 'label') { if (up && up.ui && attr(a, 'text')) deco = true; continue; }
      if (mt[2] === 'arc') { arcs.push([attr(a, 'class'), attr(a, 'target')]); if (!self) st.push({}); continue; }
      var c = attr(a, 'class'), id = attr(a, 'id'), plain = KPLAIN.test(c);
      if (id) cls[id] = c;
      if ((plain && / multimer$/.test(c)) || (up && up.plain && c !== 'unit of information') || (up && up.act && c === 'state variable')) deco = true;   // a multimer; a state variable or a member
      if (!self) st.push({ plain: plain, act: c === 'biological activity', ui: !!(up && up.plain) && c === 'unit of information' });
    }
    return kindOf(cls, arcs, isAf(t), deco);
  }
  function isAf(t) {   // the file says Activity Flow
    var m = (t || '').slice(0, 3000).match(/<(\w+:)?map\b[^>]*>/);
    return !!m && (/\blanguage=["']activity flow["']/.test(m[0]) || /\bversion=["'][^"']*sbgn\.af\./.test(m[0]));
  }
  // write(): what the file and the drawing make the map now (glyphs and arcs made in the editor, an arc made another, a
  // state variable, unit, multimer or member added or taken off); what the file alone is, write() reads by mapKind
  function kinds(t, S, G) {
    var cls2 = {}, arcs2 = [], d1 = false;
    Object.keys(S.glyph).forEach(function (id) {
      var el = S.glyph[id].el;
      cls2[id] = el.getAttribute('class') || '';
      if ((KPLAIN.test(cls2[id]) || cls2[id] === 'biological activity') && (G.node[id] ? decoG(G, id, el) : decoS(el))) d1 = true;
    });
    G.ids.forEach(function (id) {
      if (S.glyph[id] || id.indexOf('|') >= 0) return;
      var c = classOfR(G.node[id].geo.parentNode);
      if (!c) return;
      cls2[id] = afUnitOf(G, id) != null ? 'biological activity' : c;
      if (KPLAIN.test(c) && decoG(G, id, null)) d1 = true;
    });
    Object.keys(S.arc).forEach(function (id) {   // an arc of the file made another in the editor (its arrowhead)
      var c = S.arc[id].getAttribute('class') || '', e = G.edge[id], hc = e && headClass(headOf(e)), pc = PD_ARC[c] || c;
      arcs2.push([hc && MODS.test(pc) && MODS.test(hc) && hc !== pc ? hc : c, S.arc[id].getAttribute('target')]);
    });
    Object.keys(G.edge).forEach(function (id) { if (!S.arc[id]) arcs2.push([headClass(headOf(G.edge[id])) || '', G.edge[id].t]); });
    return kindOf(cls2, arcs2, isAf(t), d1);
  }
  function afForm(t, S) {   // the file written as Activity Flow: its language, or AF's glyphs or arcs
    return isAf(t) || Object.keys(S.glyph).some(function (id) { return /^(biological activity|perturbation)$/.test(S.glyph[id].el.getAttribute('class') || ''); }) ||
      Object.keys(S.arc).some(function (id) { return !!PD_ARC[S.arc[id].getAttribute('class') || '']; });
  }
  function actUnitTag(S, was, pre, gid, unit, b, ind, keep, txt) {   // an activity's unit of information: its text if any (the label first, as SBGN-ML orders them), its entity (a protein's when it has text only: SBGN-ML requires one); keep: the id of the one it replaces
    var uid = keep || gid + '_ui0', j = 0;
    while (!keep && (S.glyph[uid] || S.port[uid] || S.arc[uid] || was.indexOf(uid) >= 0)) uid = gid + '_ui0_' + (++j);
    var u = afUnitBox(b, unit, txt);
    return '\n' + ind + '<' + pre + 'glyph class="unit of information" id="' + esc(uid) + '">' + (txt ? '\n' + ind + '  <' + pre + 'label text="' + esc(txt) + '"/>' : '') +
      '\n' + ind + '  <' + pre + 'entity name="' + esc(unit || 'macromolecule') + '"/>\n' +
      ind + '  <' + pre + 'bbox x="' + num(u[0]) + '" y="' + num(u[1]) + '" w="' + num(u[2]) + '" h="' + num(u[3]) + '"/>\n' + ind + '</' + pre + 'glyph>';
  }
  // the file turned Activity Flow (once a direct link is made the map becomes Activity
  // Flow): every entity pool node an activity of its kind (unitFor: a protein's with no unit), same id, box, name and
  // look; a perturbing agent a perturbation; the modulations under AF's names; the language. Only a map with nothing
  // that only PD has gets here (kindOf), so no state variable, text unit, member or multimer is lost
  function toAf(t, S, was) {
    var T = new Tags(t, S.doc), pre = S.doc.documentElement.prefix ? S.doc.documentElement.prefix + ':' : '';
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], c = g.el.getAttribute('class') || '';
      if (!KPLAIN.test(c)) return;
      if (c === 'perturbing agent') { T.set(g.el, 'class', 'perturbation'); return; }
      var u = unitFor(c);
      T.set(g.el, 'class', 'biological activity');
      kids(g.el, 'glyph').forEach(function (k) { if (k.getAttribute('class') === 'unit of information') T.cut(k); });   // an empty one (one with text keeps the map PD)
      if (u) { var e = T.end(g.bbox); T.ed.push([e, e, actUnitTag(S, was || [], pre, id, u, g.box, T.indent(g.bbox))]); }
    });
    Object.keys(S.arc).forEach(function (id) { var a = S.arc[id], c = a.getAttribute('class'); if (AF_ARC[c]) T.set(a, 'class', AF_ARC[c]); });
    return language(T.text(), true);
  }
  // the file turned Process Description (once a process is introduced the map is back to
  // Process Description, hybrid): every activity the entity its unit names (actCls, as the converter draws it: none a
  // macromolecule, a perturbation's a phenotype), its unit taken off (a unit with text keeps its text), its name as the
  // converter read it ("X activity" is X); a perturbation a perturbing agent; AF's arcs under PD's names; the language
  function toPd(t, S) {
    var T = new Tags(t, S.doc);
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], c = g.el.getAttribute('class') || '';
      if (c === 'perturbation') { T.set(g.el, 'class', 'perturbing agent'); return; }
      if (c !== 'biological activity') return;
      T.set(g.el, 'class', actCls(fileUnit(g.el)));
      kids(g.el, 'glyph').forEach(function (k) {
        if (k.getAttribute('class') !== 'unit of information') return;
        var e = kid(k, 'entity');
        if (!unitText(k)) T.cut(k); else if (e) T.cut(e);
      });
      var lab = kid(g.el, 'label');
      if (lab && (lab.getAttribute('text') || '') !== nameIn(g.el)) T.set(lab, 'text', nameIn(g.el));
    });
    Object.keys(S.arc).forEach(function (id) { var a = S.arc[id], c = a.getAttribute('class'); if (PD_ARC[c]) T.set(a, 'class', PD_ARC[c]); });
    return language(T.text(), false);
  }
  function language(t, af) {   // the map marked Activity Flow (af) or Process Description: its language, and an SBGN-ML 0.3 version naming the other
    var L = af ? 'activity flow' : 'process description';
    return t.replace(/<(\w+:)?map\b[^>]*>/, function (tag) {
      tag = /\slanguage\s*=/.test(tag) ? tag.replace(/(\slanguage\s*=\s*)("[^"]*"|'[^']*')/, '$1"' + L + '"') : tag.replace(/(\/?>)$/, ' language="' + L + '"$1');
      return tag.replace(af ? /(\sversion\s*=\s*["'][^"']*sbgn\.)pd\./ : /(\sversion\s*=\s*["'][^"']*sbgn\.)af\./, '$1' + (af ? 'af.' : 'pd.'));
    });
  }

  // ---------- a compartment's name (in one of six places: top or bottom, left, middle or
  // right) ----------
  // namePlace: yEd's internal place (t, tl, tr, b, bl, br) and border distance of a name whose box is at lx, ly in a
  // compartment w by h, as the converter reads it (graphml.write, D29): the lower half the bottom, its distance from that
  // edge; left, middle or right by the third its middle stands in, the middle when it does not fit at a side.
  // nameBox: where yEd and yrender draw a name of that place (yrender's label_place). nameAt: the editor's choice.
  var NAME_PLACES = ['tl', 't', 'tr', 'bl', 'b', 'br'];
  function namePlace(lx, ly, lw, lh, w, h) {
    var low = ly + lh / 2 > h / 2, bd = Math.max(0, low ? h - ly - lh : ly), mid = (lx + lw / 2) / w, v = low ? 'b' : 't';
    return [lw + 2 * bd > w ? v : mid < 1 / 3 ? v + 'l' : mid > 2 / 3 ? v + 'r' : v, bd];
  }
  function nameBox(pos, bd, lw, lh, w, h) {
    var hz = /[lr]$/.test(pos) ? pos.slice(-1) : 'c';
    return [hz === 'l' ? bd : hz === 'r' ? w - lw - bd : (w - lw) / 2, pos.charAt(0) === 'b' ? h - lh - bd : bd];
  }
  function nameAt(t, id, pos, opt, dist) {   // compartment id's name put at pos, its distance from the border kept (dist: given)
    if (NAME_PLACES.indexOf(pos) < 0) throw new Error('no such place ' + pos);
    var G = gml(t, opt), n = G.node[id], l = n && labelsOf(G, id).main;
    if (!l || cfgOf(n.geo.parentNode) !== 'Compartment') return t;
    var bd = dist != null ? dist : F(l.getAttribute('borderDistance')) || 0, lw = F(l.getAttribute('width')), lh = F(l.getAttribute('height')), at = nameBox(pos, bd, lw, lh, n.box[2], n.box[3]), T = new Tags(t, G.doc);
    pos = namePlace(at[0], at[1], lw, lh, n.box[2], n.box[3])[0];   // where the file will read it (a name too wide for a side is in the middle)
    T.set(l, 'modelPosition', pos); T.set(l, 'borderDistance', repr(bd)); T.set(l, 'x', repr(at[0])); T.set(l, 'y', repr(at[1]));
    return T.text();
  }
  function namePlaces(t, id, opt) {   // a named compartment's name: [its place, the other places it can take], else null
    var G = gml(t, opt), n = G.node[id], l = n && labelsOf(G, id).main;
    if (!l || !ownText(l).trim()) return null;
    var now = l.getAttribute('modelPosition') || 't', bd = F(l.getAttribute('borderDistance')) || 0, lw = F(l.getAttribute('width')), lh = F(l.getAttribute('height'));
    return [now, NAME_PLACES.filter(function (q) { var at = nameBox(q, bd, lw, lh, n.box[2], n.box[3]); return q !== now && namePlace(at[0], at[1], lw, lh, n.box[2], n.box[3])[0] === q; })];
  }

  // ---------- stacking of compartments (under partial overlap nothing
  // belongs to anything, the smaller is drawn in front; a right-click 'Bring forward' / 'Send backward' only there) ----------
  // The order of a group's compartments in the file is the order they are drawn in (yrender draws a graph's compartments
  // first, in file order; the converter keeps the file's order among the compartments of one compartment, sbgnml.read).
  //   stack(g, id): compartment id put among its sibling compartments (those of its graph) after every larger one it
  //     partly overlaps and before every smaller one, moved as little as it can be (where the two cannot both hold, after
  //     the larger ones); the editor calls it for a compartment whose box changed. restack(g, id, +1 or -1): moved past
  //     the next (or the one before) sibling it partly overlaps, Bring forward / Send backward. stackMoves(g, id): [can it
  //     go back, can it go forward].
  // write() puts the GraphML's order of each compartment's compartments into the file (order), graphml() the file's into
  // the GraphML (orderG): both only where the two differ, as slots swapped, the rest byte for byte.
  function overlapOnly(a, b) {   // the boxes share some area, neither holds the other
    var ix = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]), iy = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
    var holds = function (p, q) { return p[0] <= q[0] && p[1] <= q[1] && p[0] + p[2] >= q[0] + q[2] && p[1] + p[3] >= q[1] + q[3]; };
    return ix > 0 && iy > 0 && !holds(a, b) && !holds(b, a);
  }
  function sibComps(G, id) {   // the compartments of node id's graph, in file order (elements)
    var n = G.node[id];
    if (!n || cfgOf(n.geo.parentNode) !== 'Compartment') return null;
    return kids(n.el.parentNode, 'node').filter(function (c) { var q = G.node[c.getAttribute('id')]; return q && cfgOf(q.geo.parentNode) === 'Compartment'; });
  }
  function slots(t, doc, els, want) {   // the elements' spans given the texts of want, in that order (els and want the same set)
    var T = new Tags(t, doc), txt = new Map();
    els.forEach(function (e) { txt.set(e, T.t.slice(T.at.get(e)[0], T.end(e))); });
    els.forEach(function (e, k) { if (want[k] !== e) T.ed.push([T.at.get(e)[0], T.end(e), txt.get(want[k])]); });
    return T.text();
  }
  function placeIn(t, G, els, id, pos) {   // els with node id put at pos among the others
    var me = els.filter(function (e) { return e.getAttribute('id') === id; })[0], rest = els.filter(function (e) { return e !== me; });
    rest.splice(pos, 0, me);
    return rest.every(function (e, k) { return e === els[k]; }) ? t : slots(t, G.doc, els, rest);
  }
  function stack(t, id, opt) {
    var G = gml(t, opt), els = sibComps(G, id);
    if (!els || els.length < 2) return t;
    var b = G.node[id].box, a = b[2] * b[3], others = els.filter(function (e) { return e.getAttribute('id') !== id; });
    var cur = els.map(function (e) { return e.getAttribute('id'); }).indexOf(id), lo = 0, hi = others.length;
    others.forEach(function (e, k) {
      var q = G.node[e.getAttribute('id')].box, aq = q[2] * q[3];
      if (!overlapOnly(b, q) || aq === a) return;
      if (aq > a) lo = Math.max(lo, k + 1); else hi = Math.min(hi, k);
    });
    return placeIn(t, G, els, id, lo <= hi ? Math.min(Math.max(cur, lo), hi) : lo);
  }
  function stackNext(G, els, id, dir) {   // the index among the others where id goes, or -1
    var ids = els.map(function (e) { return e.getAttribute('id'); }), k = ids.indexOf(id), b = G.node[id].box;
    for (var j = k + dir; j >= 0 && j < ids.length; j += dir) if (overlapOnly(b, G.node[ids[j]].box)) return j;
    return -1;
  }
  function restack(t, id, dir, opt) {
    var G = gml(t, opt), els = sibComps(G, id);
    if (!els) return t;
    var j = stackNext(G, els, id, dir);
    return j < 0 ? t : placeIn(t, G, els, id, j);   // after the next one (its index among the others is j once id is out) or before the one before
  }
  function stackMoves(t, id, opt) { var G = gml(t, opt), els = sibComps(G, id); return els ? [stackNext(G, els, id, -1) >= 0, stackNext(G, els, id, 1) >= 0] : [false, false]; }
  function order(t, S, G) {   // the file's compartments of each compartment (compartmentRef) in the GraphML's order
    var groups = {}, at = {};
    G.ids.forEach(function (id, k) { at[id] = k; });
    kids(kids(S.doc.documentElement, 'map')[0], 'glyph').forEach(function (g) {
      var id = g.getAttribute('id');
      if (g.getAttribute('class') !== 'compartment' || at[id] == null) return;
      var p = g.getAttribute('compartmentRef') || '';
      (groups[p] = groups[p] || []).push(g);
    });
    var els = [], want = [];
    Object.keys(groups).forEach(function (p) {
      var g = groups[p], w = g.slice().sort(function (x, y) { return at[x.getAttribute('id')] - at[y.getAttribute('id')]; });
      if (w.some(function (e, k) { return e !== g[k]; })) { els = els.concat(g); want = want.concat(w); }
    });
    return els.length ? slots(t, S.doc, els, want) : t;
  }
  function orderG(S, out, opt) {   // the GraphML's compartments of each graph in the file's order, one graph at a time (a
    // compartment's span holds its own graph: swaps of two graphs in one pass would overlap)
    var fileAt = {};
    Array.prototype.forEach.call(S.doc.getElementsByTagName('*'), function (e, k) { if (e.localName === 'glyph' && e.getAttribute('id') && fileAt[e.getAttribute('id')] == null) fileAt[e.getAttribute('id')] = k; });   // document order (Object.keys lists numeric ids first)
    for (var pass = 0; pass < 1000; pass++) {
      var G = gml(out, opt), job = null;
      Array.prototype.some.call(G.doc.getElementsByTagNameNS(GNS, 'graph'), function (gr) {
        var cs = kids(gr, 'node').filter(function (c) { var id = c.getAttribute('id'), q = G.node[id]; return q && fileAt[id] != null && cfgOf(q.geo.parentNode) === 'Compartment'; });
        var w = cs.slice().sort(function (x, y) { return fileAt[x.getAttribute('id')] - fileAt[y.getAttribute('id')]; });
        if (w.some(function (e, j) { return e !== cs[j]; })) job = [cs, w];
        return !!job;
      });
      if (!job) return out;
      out = slots(out, G.doc, job[0], job[1]);
    }
    return out;
  }

  // ---------- complex members (a glyph dropped on the surface of a complex becomes
  // a part of it) ----------
  // join(t, id, cid): the editor's GraphML with node id moved into complex cid's graph. A complex with no members is
  // yEd's plain Complex (MAKE); it is made the group the converter writes for a complex with members first (yed.graphml's
  // ComplexGroup: its name at the bottom, Insets 10, 10, 10, 15), its other data kept. The complex and the complexes round
  // it grow to hold what they hold with their Insets (and the name's height at the bottom), never shrink (opt.keep: no
  // growth, the boxes the file's: nestG). write() moves the glyph into the complex's glyph of the file (nest).
  var MEMBER = /^(Macromolecule|SimpleChemical|NucleicAcidFeature|UnspecifiedEntity|Complex)$/;   // SBGN PD's complex holds entity pools (perturbing agents and the empty set aside)
  function inCx(el) { var p = el.parentNode; return !!p && p.nodeType === 1 && p.localName === 'glyph' && /^complex( multimer)?$/.test(p.getAttribute('class') || ''); }
  function upNode(el) { var p = el.parentNode; while (p && p.nodeType === 1 && p.localName !== 'node') p = p.parentNode; return p && p.nodeType === 1 ? p : null; }
  function joinable(t, id, cid, opt) {   // why node id cannot join complex cid, '' when it can
    var G = gml(t, opt), M = G.node[id], C = G.node[cid];
    if (!M || !C || cfgOf(C.geo.parentNode) !== 'Complex') return 'no complex';
    if (!MEMBER.test(cfgOf(M.geo.parentNode))) return 'kind';
    for (var p = C.el; p; p = p.parentNode) if (p === M.el) return 'inside';
    var up = upNode(M.el);
    if (up && cfgOf(G.node[up.getAttribute('id')].geo.parentNode) === 'Complex') return 'member';
    var ids = [id].concat(Array.prototype.map.call(M.el.getElementsByTagNameNS(GNS, 'node'), function (n) { return n.getAttribute('id'); }));
    if (Object.keys(G.edge).some(function (k) { return ids.indexOf(G.edge[k].s) >= 0 || ids.indexOf(G.edge[k].t) >= 0; })) return 'lines';
    return '';
  }
  function join(t, id, cid, opt) {
    var why = opt && opt.checked ? '' : joinable(t, id, cid, opt);   // checked: the caller asked joinable already
    if (why && !(opt && opt.force && why === 'lines')) throw new Error('cannot join (' + why + ')');   // force: as the file has it (nestG), lines or not
    var G = gml(t, opt), T = new Tags(t, G.doc), M = G.node[id], C = G.node[cid];
    var m0 = T.at.get(M.el)[0], mText = T.t.slice(m0, T.end(M.el)), ind = T.indent(M.el);
    var graph = kids(C.el, 'graph')[0];
    T.cut(M.el);
    if (graph) {
      var gs = T.at.get(graph), ni = T.indent(C.el) + '  ';
      mText = mText.split('\n' + ind).join('\n' + ni);
      if (gs[2]) T.ed.push([gs[0], gs[1], T.t.slice(gs[0], gs[1] - 2).replace(/\s+$/, '') + '>' + mText + '</graph>']);
      else { var ge = T.t.lastIndexOf('</', T.end(graph) - 1); T.ed.push([ge, ge, mText]); }
    } else {   // the plain complex made a group
      var r = C.geo.parentNode, dd = r.parentNode, raw = function (el) { return T.t.slice(T.at.get(el)[0], T.end(el)); };
      var L = labelsOf(G, cid), name = L.main ? ownText(L.main) : '', fs = L.main ? F(L.main.getAttribute('fontSize')) || 14 : 14, B = C.box, lb = labelBox(name, B[2], B[3], fs / 14);
      var fill = kid(r, 'Fill') ? raw(kid(r, 'Fill')) : '<y:Fill color="#FFFFFF" transparent="false"/>', border = kid(r, 'BorderStyle') ? raw(kid(r, 'BorderStyle')) : '<y:BorderStyle color="#000000" type="line" width="1.0"/>';
      var lab = function (pos, w, h) {
        return '<y:NodeLabel alignment="center" autoSizePolicy="content" borderDistance="' + (pos === 'b' ? '0.0' : '8.0') + '" fontFamily="Dialog" fontSize="' + fs + '" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" hasText="' + (name ? 'true' : 'false') +
          '" height="' + repr(lb[1]) + '" horizontalTextPosition="center" iconTextGap="4" modelName="internal" modelPosition="' + pos + '" textColor="#000000" verticalTextPosition="bottom" visible="true" width="' + repr(lb[0]) +
          '" x="' + repr((w - lb[0]) / 2) + '" xml:space="preserve" y="' + repr(pos === 'b' ? h - lb[1] : 8) + '"' + (name ? '>' + esc(name) + '</y:NodeLabel>' : '/>');
      };
      var icons = L.icons.map(function (q) { return raw(q[0]); }).join('');
      var props = '              <y:StyleProperties>\n                <y:Property class="java.lang.Integer" name="com.yworks.sbgn.style.radiusY" value="12"/>\n                <y:Property class="java.lang.Integer" name="com.yworks.sbgn.style.radiusX" value="12"/>\n' +
        (isMulti(G, cid) ? '                ' + MCOUNT + '\n' : '') + '              </y:StyleProperties>\n';   // a complex multimer stays one (graphml.write's count)
      var insets = '              <y:Insets bottom="15" bottomF="15.0" left="10" leftF="10.0" right="10" rightF="10.0" top="10" topF="10.0"/>\n              <y:BorderInsets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/>\n';
      var data = '<data key="ng">\n        <y:ProxyAutoBoundsNode>\n          <y:Realizers active="0">\n            <y:GenericGroupNode configuration="com.yworks.sbgn.Complex">\n' +
        '              <y:Geometry height="' + repr(B[3]) + '" width="' + repr(B[2]) + '" x="' + repr(B[0]) + '" y="' + repr(B[1]) + '"/>\n              ' + fill + '\n              ' + border + '\n              ' + lab('b', B[2], B[3]) + icons + '\n' + props +
        '              <y:State autoResize="false" closed="false" closedHeight="80.0" closedWidth="80.0"/>\n' + insets + '            </y:GenericGroupNode>\n            <y:GenericGroupNode configuration="com.yworks.sbgn.Complex">\n' +
        '              <y:Geometry height="80.0" width="80.0" x="' + repr(B[0]) + '" y="' + repr(B[1]) + '"/>\n              ' + fill + '\n              ' + border + '\n              ' + lab('t', 80, 80) + '\n' + props +
        '              <y:State autoResize="true" closed="true" closedHeight="80.0" closedWidth="80.0"/>\n' + insets + '            </y:GenericGroupNode>\n          </y:Realizers>\n        </y:ProxyAutoBoundsNode>\n      </data>';
      T.set(C.el, 'yfiles.foldertype', 'group');
      T.ed.push([T.at.get(dd)[0], T.end(dd), data]);
      var ce = T.t.lastIndexOf('</', T.end(C.el) - 1), ni = T.indent(C.el) + '  ';
      T.ed.push([ce, ce, '\n' + ni + '<graph edgedefault="directed" id="' + esc(cid) + ':">' + mText.split('\n' + ind).join('\n' + ni) + '</graph>']);
    }
    t = T.text();
    return opt && opt.keep ? t : grow(t, cid, opt);
  }
  function grow(t, cid, opt) {   // complex cid and the complexes round it grown to hold their members, never smaller
    for (var c = cid; c;) {
      var G = gml(t, opt), C = G.node[c];
      if (!C || cfgOf(C.geo.parentNode) !== 'Complex') break;
      var r = C.geo.parentNode, ins = kid(r, 'Insets'), iv = function (k) { return ins ? F(ins.getAttribute(k + 'F') || ins.getAttribute(k)) || 0 : 0; };
      var L = labelsOf(G, c), lh = L.main && L.main.getAttribute('hasText') !== 'false' && L.main.getAttribute('modelPosition') === 'b' ? F(L.main.getAttribute('height')) || 0 : 0;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      Array.prototype.forEach.call(C.el.getElementsByTagNameNS(GNS, 'node'), function (n) {
        var q = G.node[n.getAttribute('id')];
        if (!q) return;
        x0 = Math.min(x0, q.box[0]); y0 = Math.min(y0, q.box[1]); x1 = Math.max(x1, q.box[0] + q.box[2]); y1 = Math.max(y1, q.box[1] + q.box[3]);
      });
      var B = C.box;
      if (x0 === Infinity) break;
      var nb = [Math.min(B[0], x0 - iv('left')), Math.min(B[1], y0 - iv('top'))];
      nb.push(Math.max(B[0] + B[2], x1 + iv('right')) - nb[0], Math.max(B[1] + B[3], y1 + iv('bottom') + lh) - nb[1]);
      nb = nb.map(function (v) { return Math.round(v * 10000) / 10000; });   // as write() puts the box in the file
      if (nb.some(function (v, j) { return Math.abs(v - B[j]) > 1e-6; })) {
        t = resize(t, c, nb, opt);   // the lines at it as the file will hold them
        var G2 = gml(t, opt), L2 = labelsOf(G2, c);
        if (L2.main && L2.main.getAttribute('modelPosition') === 'b') { var T = new Tags(t, G2.doc); T.set(L2.main, 'y', repr(nb[3] - F(L2.main.getAttribute('height')))); t = T.text(); }   // the name at the bottom stays there
      }
      var up = upNode(C.el);
      c = up ? up.getAttribute('id') : null;
    }
    return t;
  }
  function nestG(S, out, opt) {   // the GraphML's nodes put into the complexes the file holds them in
    for (var pass = 0; pass < 1000; pass++) {
      var G = gml(out, opt), job = null;
      Object.keys(S.glyph).some(function (id) {
        var g = S.glyph[id], cid = inCx(g.el) ? g.el.parentNode.getAttribute('id') : null;
        if (!cid || !G.node[id] || !G.node[cid]) return false;
        var up = upNode(G.node[id].el);
        if (up && up.getAttribute('id') === cid) return false;
        var why = joinable(out, id, cid, opt);
        if (why && why !== 'lines') return false;   // as the file has it, lines or not
        job = [id, cid]; return true;
      });
      if (!job) return out;
      out = join(out, job[0], job[1], Object.assign({}, opt, { keep: true, force: true }));
    }
    return out;
  }
  var GEO_A = /\s(?:x|y|width|height|sx|sy|tx|ty|nodeRatioX|nodeRatioY|labelRatioX|labelRatioY|offsetX|offsetY|borderDistance)="[^"]*"/g, nestNone = null;
  function nest(t, gtext, opt, from) {   // from: the file write() started from   // the file's glyphs put into the complexes the editor's GraphML holds them in
    // skipped when the GraphML differs from the last one that needed nothing only in its places (a move; else a
    // second reading of both files on every write)
    var key = gtext.replace(GEO_A, '') + '\u0000' + from;
    if (nestNone === key) return t;
    var G = gml(gtext, opt), t1 = t;
    for (var pass = 0; pass < 1000; pass++) {
      var S = sbgn(t, opt), job = null;
      Object.keys(S.glyph).some(function (id) {
        if (!G.node[id]) return false;
        var up = upNode(G.node[id].el), cid = up && up.getAttribute('id');
        if (!cid || !G.node[cid] || cfgOf(G.node[cid].geo.parentNode) !== 'Complex' || !S.glyph[cid] || S.glyph[id].el.parentNode === S.glyph[cid].el) return false;
        job = [S.glyph[id].el, S.glyph[cid]]; return true;
      });
      if (!job) { var t3 = order(t, S, G); if (t3 === t1) nestNone = key; return t3; }   // then the compartments' order (stacking)
      var T = new Tags(t, S.doc), el = job[0], C = job[1], ind = T.indent(el), ni = T.indent(C.el) + '  ';
      var txt = T.t.slice(T.at.get(el)[0], T.end(el)).replace(/^(<[^>]*?)\s+compartmentRef\s*=\s*("[^"]*"|'[^']*')/, '$1').split('\n' + ind).join('\n' + ni);   // a member is in its complex's compartment
      var last = kids(C.el, 'glyph').filter(function (c) { return c !== el; }).pop() || C.bbox, at = T.end(last);
      T.cut(el);
      T.ed.push([at, at, '\n' + ni + txt]);
      t = T.text();
    }
    return t;
  }

  // ---------- sites drawn or kept as links (what is seen is what the file holds) ----------
  // A state variable's site is drawn (<state value="P" variable="S1177"/>, its box sized for P@S1177) or kept on its
  // glyph as an RDF site link (below), the circle showing P.
  //   sitesOut(t) -> t with every drawn site moved into its glyph's site links, the box sized for the value alone
  //   sitesIn(t)  -> t with every site link, and every site of a PTM line in the notes, put back on its circle (its own
  //                  first, else the first of its value showing no site, an empty value too), its box sized for
  //                  value@site; a drawn site's box too narrow for its text widened. sitesIn(sitesOut(t)) shows every
  //                  site of t again.
  // Only the attributes, boxes, notes and links these touch change; the rest byte for byte.
  function svNeed(txt, h) { var n = Array.from(txt).length; return n <= 2 ? h : Math.round((n * 5.4 + 12) * h / 18 * 100) / 100; }   // the editor's svSize, at the box's height
  function svWiden(T, sv, txt, grow) {   // the state variable's box to the width its text needs, its centre kept
    var b = kid(sv, 'bbox'); if (!b) return;
    var x = F(b.getAttribute('x')), w = F(b.getAttribute('w')), h = F(b.getAttribute('h')), need = svNeed(txt, h);
    if (!(h > 0) || Math.abs(w - need) < 0.5 || (grow && w >= need)) return;
    T.set(b, 'x', num(x + w / 2 - need / 2)); T.set(b, 'w', num(need));
  }
  // the glyph's PTM line: a line of its notes (after a tag or a line break) that starts with PTM: and holds sites only, as
  // the converter reads one (annotation.from_notes); found and rewritten in the notes' own markup, so another tool's
  // text (a line that only mentions PTM, a line with words) is never taken for it
  var SITE = /^[^@\s]*@\S+$/;
  function unesc(v) { return v.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'); }
  function ptmOf(T, g) {
    var nt = kid(g, 'notes'), p = { notes: nt, sites: [], found: false };
    if (!nt) return p;
    p.s0 = T.at.get(nt)[0]; p.s1 = T.end(nt); p.raw = T.t.slice(p.s0, p.s1);
    var re = /(^|>|\n)[ \t]*(PTM:[ \t]*([^\n<]*))/g, m;
    while ((m = re.exec(p.raw))) {
      var ts = m[3].trim().split(/\s+/).filter(Boolean).map(unesc);
      if (ts.length && ts.every(function (x) { return SITE.test(x); })) { p.found = true; p.i = m.index + m[0].length - m[2].length; p.j = m.index + m[0].length; p.sites = ts; break; }
    }
    return p;
  }
  function ptmWrite(T, g, p, sites, pre) {   // the PTM line set to sites (none: the line out, the notes out when nothing else is left)
    var line = sites.length ? esc('PTM: ' + sites.join(' ')) : '';
    if (p.notes) {
      var raw = p.raw, out;
      if (p.found) {
        if (line) out = raw.slice(0, p.i) + line + raw.slice(p.j);
        else { var k = p.i; while (k > 0 && /[ \t]/.test(raw[k - 1])) k--; if (raw[k - 1] === '\n') k--; out = raw.slice(0, k) + raw.slice(p.j); }
      } else {
        if (!line) return;
        var said = /\S/.test(raw.replace(/<[^>]*>/g, '')), m = raw.match(/<\/([\w.-]+:)?body\s*>/) || raw.match(/<\/([\w.-]+:)?html\s*>/) || raw.match(/<\/([\w.-]+:)?notes\s*>$/);
        out = raw.slice(0, m.index) + (said ? '\n' : '') + line + raw.slice(m.index);
      }
      if (!/\S/.test(out.replace(/<[^>]*>/g, ''))) T.cut(p.notes); else T.ed.push([p.s0, p.s1, out]);
      return;
    }
    if (!line) return;
    var ind = T.indent(g) + '  ', st = T.at.get(g)[1];
    T.ed.push([st, st, '\n' + ind + '<' + pre + 'notes>\n' + ind + '  <html xmlns="http://www.w3.org/1999/xhtml">\n' + ind + '    <body>' + line + '</body>\n' + ind + '  </html>\n' + ind + '</' + pre + 'notes>']);
  }
  function svsOf(g) { return kids(g, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; }); }
  // A site not drawn is kept as an RDF statement on its entity glyph, bqbiol:hasProperty with the link
  // urn:sbgn:site:<state variable id>:<value>@<site>, the place other editors keep (Newt keeps an RDF statement with any link,
  // and drops a glyph's notes and unknown extensions); the order of the links is not kept, so each names its circle, the
  // value the fallback. A PTM line of the notes (the converter's place) is read too.
  var SITE_URN = 'urn:sbgn:site:', RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', BQB = 'http://biomodels.net/biology-qualifiers/';
  function kidL(el, name) { return el ? kids(el).filter(function (c) { return c.localName === name; })[0] || null : null; }
  function dec(x) { try { return decodeURIComponent(x); } catch (e) { return x; } }   // a malformed %XX kept as written
  function siteUrn(sv, full) { return SITE_URN + encodeURIComponent(sv).replace(/%40/g, '@') + ':' + encodeURIComponent(full).replace(/%40/g, '@'); }
  function rdfOf(g) {   // the glyph's own RDF description and the site links in it
    var ext = kidL(g, 'extension'), ann = kidL(ext, 'annotation'), rdf = kidL(ann, 'RDF'), desc = kidL(rdf, 'Description'), hps = [], items = [];
    if (desc) kids(desc).forEach(function (hp) {
      if (hp.localName !== 'hasProperty' || hp.namespaceURI !== BQB) return;
      var lis = hp.getElementsByTagNameNS(RDF_NS, 'li'), ours = 0;
      for (var k = 0; k < lis.length; k++) {
        var r = lis[k].getAttributeNS(RDF_NS, 'resource') || '';
        if (r.indexOf(SITE_URN) !== 0) continue;
        var rest = r.slice(SITE_URN.length), c = rest.indexOf(':'), full = dec(rest.slice(c + 1));
        if (c < 0 || full.indexOf('@') < 0) continue;
        ours++; items.push({ sv: dec(rest.slice(0, c)), full: full });
      }
      if (ours) hps.push({ el: hp, all: ours === lis.length });
    });
    return { g: g, ext: ext, ann: ann, rdf: rdf, desc: desc, hps: hps, items: items };
  }
  function siteWrite(T, r, items) {   // the glyph's site links set to items, none: taken out with what held only them
    var g = r.g;
    if (r.desc && !items.length && r.hps.length && r.hps.every(function (h) { return h.all; }) && kids(r.desc).length === r.hps.length) {
      var top = r.desc;   // nothing else left: the description, and what held only it, out
      while (top.parentNode && top.parentNode !== g && kids(top.parentNode).length === 1) top = top.parentNode;
      T.cut(top); return;
    }
    r.hps.forEach(function (h) { if (h.all) T.cut(h.el); else Array.prototype.forEach.call(h.el.getElementsByTagNameNS(RDF_NS, 'li'), function (li) { if ((li.getAttributeNS(RDF_NS, 'resource') || '').indexOf(SITE_URN) === 0) T.cut(li); }); });
    if (!items.length) return;
    var decl = bqDecl(r);
    rdfPut(T, r, function (ind) {
      return '\n' + ind + '<bqbiol:hasProperty' + decl + '>\n' + ind + '  <rdf:Bag>\n' +
        items.map(function (x) { return ind + '    <rdf:li rdf:resource="' + esc(siteUrn(x.sv, x.full)) + '"/>\n'; }).join('') + ind + '  </rdf:Bag>\n' + ind + '</bqbiol:hasProperty>';
    });
  }
  // the prefixes declared where the links go (Newt's files declare them once, on rdf:RDF) are not declared again
  function bqDecl(r) {
    var known = function (el, pfx, uri) { for (var e = el; e && e.nodeType === 1; e = e.parentNode) { var v = e.getAttribute('xmlns:' + pfx); if (v) return v === uri; } return false; };
    return r.desc && known(r.desc, 'bqbiol', BQB) && known(r.desc, 'rdf', RDF_NS) ? '' : ' xmlns:bqbiol="' + BQB + '" xmlns:rdf="' + RDF_NS + '"';
  }
  // a block of the glyph's RDF (block(indent): its text) put first in its description, made with what holds it where missing
  function rdfPut(T, r, block) {
    var g = r.g, pre = g.prefix ? g.prefix + ':' : '';
    if (r.desc) { var at = T.at.get(r.desc)[1]; T.ed.push([at, at, block(T.indent(r.desc) + '  ')]); return; }
    var gi = T.indent(g) + '  ', about = g.getAttribute('id') || '';
    var desc = function (ind) { return '\n' + ind + '<rdf:Description xmlns:rdf="' + RDF_NS + '" rdf:about="#' + esc(about) + '">' + block(ind + '  ') + '\n' + ind + '</rdf:Description>'; };
    var rdf = function (ind) { return '\n' + ind + '<rdf:RDF xmlns:rdf="' + RDF_NS + '">' + desc(ind + '  ') + '\n' + ind + '</rdf:RDF>'; };
    var ann = function (ind) { return '\n' + ind + '<' + pre + 'annotation>' + rdf(ind + '  ') + '\n' + ind + '</' + pre + 'annotation>'; };
    var into = function (el, text) { var a = T.at.get(el)[1]; T.ed.push([a, a, text]); };
    if (r.rdf) into(r.rdf, desc(T.indent(r.rdf) + '  '));
    else if (r.ann) into(r.ann, rdf(T.indent(r.ann) + '  '));
    else if (r.ext) into(r.ext, ann(T.indent(r.ext) + '  '));
    else {
      var nt = kidL(g, 'notes'), a2 = nt ? T.end(nt) : T.at.get(g)[1];
      T.ed.push([a2, a2, '\n' + gi + '<' + pre + 'extension>' + ann(gi + '  ') + '\n' + gi + '</' + pre + 'extension>']);
    }
  }

  // ---------- a glyph's references (Properties, References): PubMed and DOI ----------
  // In the editor's GraphML the node property References as graphml.write writes it (pubmed:N doi:10.x/y, separated by
  // spaces: the converter's annotation.references); in the SBGN-ML file the glyph's isDescribedBy links, read under either
  // qualifier set as sbgnml.read reads them (identifiers.org links and MIRIAM URNs; any other link is not a reference).
  //   refsOf(g, id) -> the property's text ('' for none)
  //   setRefs(g, id, text) -> g with the property set to text (empty: its data out), the key made where missing
  //   write() writes a glyph whose references differ from its file's (refsOut): a link gone is cut from its
  //   bqbiol:isDescribedBy bag (a bqmodel one stays), a new one goes into the first such bag, one made where missing
  //   (http://identifiers.org/pubmed:N, as the converter writes); graphml() takes them from the file (refsIn).
  var REFS = 'References';
  function refKey(G, name) { name = name || REFS; return Array.prototype.filter.call(G.doc.getElementsByTagNameNS(GNS, 'key'), function (k) { return k.getAttribute('attr.name') === name && (k.getAttribute('for') || 'node') === 'node'; })[0] || null; }
  function refData(G, id, k) { return k && G.node[id] ? kids(G.node[id].el, 'data').filter(function (d) { return d.getAttribute('key') === k.getAttribute('id'); })[0] || null : null; }
  function refKeys(text) {   // the references of a property's text as db:id (pubmed, doi), the converter's references() rules
    var out = [];
    String(text || '').split(/\s+/).forEach(function (x) {
      if (!x) return;
      var c = x.indexOf(':'), db = /^10\./.test(x) ? 'doi' : c > 0 ? x.slice(0, c).toLowerCase() : /^\d+$/.test(x) ? 'pubmed' : '', id = /^10\./.test(x) || c < 0 ? x : x.slice(c + 1);
      if (db === 'pmid') db = 'pubmed';
      if (db && id && out.indexOf(db + ':' + id) < 0) out.push(db + ':' + id);
    });
    return out;
  }
  function refKeyOf(link) {   // a link of the file as db:id, null where it is no identifiers.org link or MIRIAM URN
    var m = /^urn:miriam:([\w.]+):(.+)$/.exec(link) || /^https?:\/\/identifiers\.org\/(?:([\w.]+)\/|([\w.]+):)(.+)$/i.exec(link);
    if (!m) return null;
    var db = (m.length > 3 ? m[1] || m[2] : m[1]).toLowerCase(), id = m.length > 3 ? m[3] : m[2];
    try { id = decodeURIComponent(id); } catch (e) {}
    return db + ':' + id;
  }
  function refsOf(t, id, opt) { var G = gml(t, opt), d = refData(G, id, refKey(G)); return d ? (d.textContent || '').trim() : ''; }
  function setRefs(t, id, text, opt) { return setProp(t, id, REFS, refKeys(text).join(' '), false, opt); }
  function setProp(t, id, name, v, keep, opt) {   // the node's property name set to v; none: its data out, or (keep) left empty
    var G = gml(t, opt);
    if (!G.node[id]) return t;
    var T = new Tags(t, G.doc), k = refKey(G, name), d = refData(G, id, k);
    if (d) {
      if (!v && !keep) { T.cut(d); return T.text(); }
      var s = T.at.get(d), close = s[2] ? null : t.lastIndexOf('</', T.end(d) - 1);
      if (close == null) T.ed.push([s[0], s[1], t.slice(s[0], s[1] - 2).replace(/\s+$/, '') + '>' + esc(v) + '</data>']);
      else T.ed.push([s[1], close, esc(v)]);
      return T.text();
    }
    if (!v && !keep) return t;
    var kid0 = k ? k.getAttribute('id') : null;
    if (!kid0) {   // a key of its own, after the last key (the first id d0, d1, ... no key uses)
      var keys = Array.prototype.slice.call(G.doc.getElementsByTagNameNS(GNS, 'key')), used = keys.map(function (x) { return x.getAttribute('id'); }), n = 0;
      while (used.indexOf('d' + n) >= 0) n++;
      kid0 = 'd' + n;
      var line = '<key attr.name="' + name + '" attr.type="string" for="node" id="' + kid0 + '"/>';
      if (keys.length) { var last = keys[keys.length - 1], e = T.end(last); T.ed.push([e, e, '\n' + T.indent(last) + line]); }
      else { var r0 = T.at.get(G.doc.documentElement)[1]; T.ed.push([r0, r0, '\n  ' + line]); }
    }
    var n0 = G.node[id].el, a = T.at.get(n0)[1];
    T.ed.push([a, a, '\n' + T.indent(n0) + '  <data key="' + kid0 + '">' + esc(v) + '</data>']);
    return T.text();
  }
  function refDesc(g) {   // the glyph's own description as sbgnml.read takes it: the first in its own extension or annotation
    var own = kids(g).filter(function (c) { return c.localName === 'extension' || c.localName === 'annotation'; });
    for (var k = 0; k < own.length; k++) { var d = own[k].getElementsByTagNameNS(RDF_NS, 'Description')[0]; if (d) return d; }
    return null;
  }
  function refLinks(d, local, keyOf) {   // [{ el (its rdf:li), key (db:id or null), mine (under bqbiol), q (its qualifier element) }] of the isDescribedBy bags (local: another qualifier's; keyOf: its keys)
    var out = [];
    local = local || 'isDescribedBy'; keyOf = keyOf || refKeyOf;
    if (d) kids(d).forEach(function (q) {
      if (q.localName !== local) return;
      Array.prototype.forEach.call(q.getElementsByTagNameNS(RDF_NS, 'li'), function (li) { var u = li.getAttributeNS(RDF_NS, 'resource') || ''; out.push({ el: li, key: keyOf(u), mine: q.namespaceURI === BQB, q: q }); });
    });
    return out;
  }
  function refLink(key) { var c = key.indexOf(':'); return 'http://identifiers.org/' + key.slice(0, c) + ':' + encodeURI(key.slice(c + 1)).replace(/%25/g, '%').replace(/[#?]/g, encodeURIComponent); }
  //   refsAbout(st, id) -> the glyph's references under bqmodel:isDescribedBy in the file (db:id), which write() never cuts
  function refsAbout(st, id, opt) { var S = sbgn(st, opt), g = S.glyph[id]; return g ? refLinks(refDesc(g.el)).filter(function (x) { return !x.mine && x.key; }).map(function (x) { return x.key; }) : []; }
  function refCmp(k) { return /^doi:/.test(k) ? k.toLowerCase() : k; }   // a DOI compares without case
  function refsOut(st, gtext, opt) {
    if (gtext.indexOf('"' + REFS + '"') < 0) return st;   // no references in the GraphML: the file's own are as read
    var G = gml(gtext, opt), k = refKey(G), S = sbgn(st, opt), T = null, crlf = st.indexOf('\r\n') >= 0;
    Object.keys(S.glyph).forEach(function (id) {
      if (!G.node[id]) return;
      var d0 = refData(G, id, k), want = refKeys(d0 ? d0.textContent : ''), g = S.glyph[id].el, desc = refDesc(g), L = refLinks(desc);
      // a link whose key the property cannot hold as it is (a space in it) is never taken for one gone
      L.forEach(function (x) { if (x.key && refKeys(x.key).join(' ') !== x.key) x.key = null; });
      var wantC = want.map(refCmp), have = L.map(function (x) { return x.key && refCmp(x.key); }).filter(Boolean);
      var gone = L.filter(function (x) { return x.mine && x.key && wantC.indexOf(refCmp(x.key)) < 0; }), add = want.filter(function (x) { return have.indexOf(refCmp(x)) < 0; });
      if (gone.length || add.length) T = linksPut(T || new Tags(st, S.doc), st, g, desc, L, gone, add, 'isDescribedBy', refLink, crlf);
    });
    return T ? T.text() : st;
  }
  // gone (links of L) cut from the glyph's bqbiol:<local> bags, add (keys) written into the first one left, made where
  // missing (linkOf(key): the link written); a bag left with none: its qualifier out, the description with it when
  // nothing else is left
  function linksPut(T, st, g, desc, L, gone, add, local, linkOf, crlf) {
    var e0 = T.ed.length, cutQ = [];
    gone.forEach(function (x) {   // a bag left with none: its qualifier out (the description with it when nothing else is left)
      if (L.filter(function (y) { return y.q === x.q; }).every(function (y) { return gone.indexOf(y) >= 0; })) { if (cutQ.indexOf(x.q) < 0) cutQ.push(x.q); }
      else T.cut(x.el);
    });
    var left = kids(desc || g).filter(function (c) { return cutQ.indexOf(c) < 0; });
    if (desc && cutQ.length && !left.length && !add.length) {
      var top = desc; while (top.parentNode && top.parentNode !== g && kids(top.parentNode).length === 1) top = top.parentNode;
      T.cut(top);
    } else {
      cutQ.forEach(function (q) { T.cut(q); });
      if (add.length) {
        var bag = L.filter(function (x) { return x.q.namespaceURI === BQB && x.q.localName === local && cutQ.indexOf(x.q) < 0; }).map(function (x) { return x.el.parentNode; })[0];
        var lis = function (ind) { return add.map(function (x) { return '\n' + ind + '<rdf:li rdf:resource="' + esc(linkOf(x)) + '"/>'; }).join(''); };
        if (bag) {   // before the bag's end tag; on its own line when the end tag stands on one
          var c = st.lastIndexOf('</', T.end(bag) - 1), nl = st.lastIndexOf('\n', c), alone = nl >= 0 && /^[ \t\r]*$/.test(st.slice(nl + 1, c));
          var li0 = kids(bag).filter(function (c) { return c.localName === 'li'; })[0];   // the bag's own lines' indent
          if (alone) T.ed.push([st[nl - 1] === '\r' ? nl - 1 : nl, st[nl - 1] === '\r' ? nl - 1 : nl, lis(li0 ? T.indent(li0) : T.indent(bag) + '  ')]);
          else T.ed.push([c, c, add.map(function (x) { return '<rdf:li rdf:resource="' + esc(linkOf(x)) + '"/>'; }).join('')]);
        } else {
          var r = { g: g, desc: desc, ext: kidL(g, 'extension'), ann: kidL(kidL(g, 'extension'), 'annotation'), rdf: kidL(kidL(kidL(g, 'extension'), 'annotation'), 'RDF') }, decl = bqDecl(r);
          rdfPut(T, r, function (ind) { return '\n' + ind + '<bqbiol:' + local + decl + '>\n' + ind + '  <rdf:Bag>' + lis(ind + '    ') + '\n' + ind + '  </rdf:Bag>\n' + ind + '</bqbiol:' + local + '>'; });
        }
      }
    }
    if (crlf) for (var j = e0; j < T.ed.length; j++) T.ed[j][2] = T.ed[j][2].replace(/\r?\n/g, '\r\n');   // the file's line ends
    return T;
  }
  function refsIn(st, gtext, opt) {   // graphml(): each glyph's References as its file gives them
    if (st.indexOf('isDescribedBy') < 0 && gtext.indexOf('"' + REFS + '"') < 0) return gtext;
    var S = sbgn(st, opt), G = gml(gtext, opt), k = refKey(G), out = gtext;
    Object.keys(S.glyph).forEach(function (id) {
      if (!G.node[id]) return;
      var file = refKeys(refLinks(refDesc(S.glyph[id].el)).map(function (x) { return x.key; }).filter(Boolean).join(' '));
      var now = refKeys(refData(G, id, k) ? refData(G, id, k).textContent : '');
      if (file.join(' ') !== now.join(' ')) { out = setRefs(out, id, file.join(' '), opt); G = gml(out, opt); k = refKey(G); }
    });
    return out;
  }
  // ---------- a glyph's identifiers (Properties, Identifiers): UniProt, HGNC, ChEBI, GO, MeSH ----------
  // The links under bqbiol:is in the glyph's RDF. The editor's GraphML holds them only once changed here, as the node
  // property Identity (db:id keys separated by spaces, chebi:CHEBI:15346, go:GO:0016573, hgnc:11389; kept when empty, so
  // none left means none); without it the file's are the glyph's. write() writes a glyph whose Identity differs from its
  // file's (idsOut) as refsOut does, under bqbiol:is, as the converter writes them (http://identifiers.org/uniprot:Q15831,
  // hgnc:11389, CHEBI:15346, GO:0016573, mesh:D012345); a link of another database or under another qualifier is never
  // touched.
  //   idsOf(g, st, id) -> [{ q, key, link }]: every link of the glyph's own description in st (q its qualifier as
  //     written), those of the five databases under bqbiol:is replaced by the Identity property where it is set
  //   setIds(g, id, keys) -> g with the property set to keys (an array)
  var BQM = 'http://biomodels.net/model-qualifiers/', IDS = 'Identity', IDS_DB = ['uniprot', 'hgnc', 'chebi', 'go', 'mesh'], IDS_LINK = { uniprot: 'uniprot:', hgnc: 'hgnc:', chebi: '', go: '', mesh: 'mesh:' };
  function idKeyOf(link) {   // refKeyOf's db:id with CellDesigner's obo. names as identifiers.org's, ChEBI's and GO's prefix in the id, HGNC's not
    var m = /^https?:\/\/identifiers\.org\/(CHEBI|GO):(.+)$/i.exec(link), k = m ? m[1].toLowerCase() + ':' + m[2] : refKeyOf(link);
    if (!k) return null;
    var c = k.indexOf(':'), db = k.slice(0, c).replace(/^obo\.(chebi|go)$/, '$1'), v = k.slice(c + 1);
    if (db === 'chebi' || db === 'go') v = db.toUpperCase() + ':' + v.replace(/^(chebi|go):/i, '');
    else if (db === 'hgnc') v = v.replace(/^hgnc:/i, '');
    else if (db === 'uniprot' || db === 'mesh') v = v.toUpperCase();
    return db + ':' + v;
  }
  function idMine(x) { return x.mine && !!x.key && IDS_DB.indexOf(x.key.slice(0, x.key.indexOf(':'))) >= 0; }
  function idLink(key) { var c = key.indexOf(':'); return 'http://identifiers.org/' + IDS_LINK[key.slice(0, c)] + key.slice(c + 1); }
  function idsOf(t, st, id, opt) {
    var G = gml(t, opt), d = refData(G, id, refKey(G, IDS)), S = sbgn(st, opt), g = S.glyph[id], desc = g ? refDesc(g.el) : null, out = [];
    if (desc) kids(desc).forEach(function (q) {
      if (q.namespaceURI !== BQB && q.namespaceURI !== BQM) return;
      var qn = (q.namespaceURI === BQB ? 'bqbiol:' : 'bqmodel:') + q.localName;
      Array.prototype.forEach.call(q.getElementsByTagNameNS(RDF_NS, 'li'), function (li) {
        var u = li.getAttributeNS(RDF_NS, 'resource') || '', x = { q: qn, link: u, key: idKeyOf(u), mine: qn === 'bqbiol:is' };
        if (!d || !idMine(x)) out.push(x);
      });
    });
    if (d) (d.textContent || '').split(/\s+/).filter(Boolean).forEach(function (k) { out.push({ q: 'bqbiol:is', link: idLink(k), key: k }); });
    return out;
  }
  function setIds(t, id, keys, opt) { return setProp(t, id, IDS, keys.join(' '), true, opt); }
  function idsOut(st, gtext, opt) {
    if (gtext.indexOf('"' + IDS + '"') < 0) return st;   // nothing changed here: the file's own as read
    var G = gml(gtext, opt), k = refKey(G, IDS), S = sbgn(st, opt), T = null, crlf = st.indexOf('\r\n') >= 0;
    Object.keys(S.glyph).forEach(function (id) {
      var d0 = G.node[id] && refData(G, id, k);
      if (!d0) return;
      var want = (d0.textContent || '').split(/\s+/).filter(Boolean), g = S.glyph[id].el, desc = refDesc(g), L = refLinks(desc, 'is', idKeyOf);
      var have = L.filter(function (x) { return x.mine; }).map(function (x) { return x.key; }).filter(Boolean);   // under bqbiol:is only (a bqmodel:is one is not the glyph's identity)
      var gone = L.filter(function (x) { return idMine(x) && want.indexOf(x.key) < 0; }), add = want.filter(function (x) { return have.indexOf(x) < 0; });
      if (gone.length || add.length) T = linksPut(T || new Tags(st, S.doc), st, g, desc, L, gone, add, 'is', idLink, crlf);
    });
    return T ? T.text() : st;
  }
  // ---------- lines at a complex's members, put right on opening ----------
  // A complex's member has no lines of its own (SBGN PD 2.1, 2.3.4: a subunit has no incoming or outgoing arcs). A copy
  // of the converter's rule (rules.to_complex, its master; the same on every route there): a line drawn to or from a
  // member is joined to the outermost complex around it, its end at the complex's centre (so drawn to its outline), and
  // a line within one complex (two of its members, or a member and the complex) is taken out, as is a member's line
  // that repeats one the complex has. SBGN-ML and yEd GraphML; only the ends and lines it touches change.
  //   membersOut(t) -> { text, said: [one line per line changed] } (text unchanged and said empty when nothing is)
  function membersOut(t, opt) {
    if (t.charCodeAt(0) === 0xFEFF) { var r0 = membersOut(t.slice(1), opt); r0.text = '﻿' + r0.text; return r0; }
    var doc = new (DP(opt))().parseFromString(t, 'application/xml'), top = doc.documentElement, said = [];
    if (!top || (top.localName !== 'sbgn' && top.localName !== 'graphml')) return { text: t, said: said };
    var yed = top.localName === 'graphml', T = null, nodes = new Map(), owner = new Map(), arcs = [];
    var nameOf = function (el) {   // a node as found on the drawing: its label, else its kind
      if (!el) return '?';
      if (yed) { var l = Array.prototype.filter.call(el.getElementsByTagNameNS(YNS, 'NodeLabel'), function (x) { return !x.getAttribute('iconData'); })[0], c = cfg(el);
        return (l && l.textContent.trim()) || (c ? c.replace('com.yworks.sbgn.', '') : 'node'); }
      var lb = kid(el, 'label'); return (lb && (lb.getAttribute('text') || '').trim()) || el.getAttribute('class') || 'glyph';
    };
    var cfg = function (n) {   // a yEd node's shape (its realizer's configuration, a group's shown one)
      var d = Array.prototype.filter.call(n.getElementsByTagNameNS(YNS, '*'), function (x) { return x.getAttribute('configuration'); })[0];
      return d ? d.getAttribute('configuration') : '';
    };
    var isCx = function (el) { return yed ? cfg(el) === 'com.yworks.sbgn.Complex' : /^complex( multimer)?$/.test(el.getAttribute('class') || ''); };
    var up = function (el) {   // the node or glyph holding el, or null
      for (var p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (p.localName === (yed ? 'node' : 'glyph')) return p;
      return null;
    };
    var outer = function (el) { var out = null; for (var p = up(el); p; p = up(p)) if (isCx(p)) out = p; return out; };
    Array.prototype.forEach.call(doc.getElementsByTagName('*'), function (el) {
      if (el.localName === (yed ? 'node' : 'glyph') && el.getAttribute('id')) nodes.set(el.getAttribute('id'), el);
      if (!yed && el.localName === 'port' && el.parentNode) owner.set(el.getAttribute('id'), el.parentNode);
      if (el.localName === (yed ? 'edge' : 'arc')) arcs.push(el);
    });
    var at = function (id) { return nodes.get(id) || owner.get(id) || null; };   // a port's end is its glyph's
    var head = function (a) { if (!yed) return a.getAttribute('class'); var ar = a.getElementsByTagNameNS(YNS, 'Arrows')[0]; return ar ? ar.getAttribute('target') : ''; };
    var key = function (s, t, a) { return s.getAttribute('id') + '\u0000' + t.getAttribute('id') + '\u0000' + head(a); };
    var ends = new Set();
    arcs.forEach(function (a) { var s = at(a.getAttribute('source')), e = at(a.getAttribute('target')); if (s && e) ends.add(key(s, e, a)); });
    arcs.forEach(function (a) {
      var s = at(a.getAttribute('source')), e = at(a.getAttribute('target'));
      if (!s || !e) return;
      var cs = outer(s), ce = outer(e);
      if (!cs && !ce) return;
      T = T || new Tags(t, doc);
      var what = nameOf(s) + ' → ' + nameOf(e);
      if ((cs || s) === (ce || e)) { T.cut(a); said.push(what + ': within the complex ' + nameOf(cs || ce) + ', taken out'); return; }
      var ns = cs || s, ne = ce || e, k = key(ns, ne, a);
      if (ends.has(k)) { T.cut(a); said.push(what + ': drawn to a member, the same line as its complex\'s, taken out'); return; }
      ends.add(k);
      [[cs, 'source', 'start', 'sx', 'sy'], [ce, 'target', 'end', 'tx', 'ty']].forEach(function (x) {
        var c = x[0];
        if (!c) return;
        T.set(a, x[1], c.getAttribute('id'));
        if (yed) { var pt = a.getElementsByTagNameNS(YNS, 'Path')[0]; if (pt) { T.set(pt, x[3], '0.0'); T.set(pt, x[4], '0.0'); } }
        else { var p = kid(a, x[2]), b = kid(c, 'bbox'); if (p && b) { T.set(p, 'x', num(F(b.getAttribute('x')) + F(b.getAttribute('w')) / 2)); T.set(p, 'y', num(F(b.getAttribute('y')) + F(b.getAttribute('h')) / 2)); } }
      });
      said.push(what + ': drawn to ' + [[cs, s], [ce, e]].filter(function (x) { return x[0]; }).map(function (x) { return nameOf(x[1]) + ', a member of ' + nameOf(x[0]); }).join(', and ') + ', joined to the complex');
    });
    return { text: T ? T.text() : t, said: said };
  }
  function membersSaid(said) {   // what membersOut put right, as one sentence for the status line, or null
    if (!said.length) return null;
    return (said.length > 1 ? said.length + ' lines' : 'A line') + ' at complex members put right, as a complex\'s member has no lines of its own in SBGN: ' + said.join('; ') + '.';
  }
  function sitesOut(t, opt) {
    if (t.charCodeAt(0) === 0xFEFF) return '﻿' + sitesOut(t.slice(1), opt);   // a byte-order mark kept, the text read after it
    var doc = new (DP(opt))().parseFromString(t, 'application/xml'), T = new Tags(t, doc), any = false;
    Array.prototype.forEach.call(doc.getElementsByTagName('*'), function (g) {
      if (g.localName !== 'glyph') return;
      var moved = [];
      svsOf(g).forEach(function (sv) {
        var st = kid(sv, 'state'), vr = st && st.getAttribute('variable');
        if (!vr) return;
        var val = st.getAttribute('value') || '';
        moved.push({ sv: sv.getAttribute('id') || '', full: val + '@' + vr }); T.unset(st, 'variable'); svWiden(T, sv, val);
      });
      if (!moved.length) return;
      any = true;
      var r = rdfOf(g), mv = moved.map(function (x) { return x.sv; });
      siteWrite(T, r, moved.concat(r.items.filter(function (x) { return mv.indexOf(x.sv) < 0; })));
    });
    return any ? T.text() : t;
  }
  function sitesIn(t, opt) {
    if (t.charCodeAt(0) === 0xFEFF) return '﻿' + sitesIn(t.slice(1), opt);
    var doc = new (DP(opt))().parseFromString(t, 'application/xml'), T = new Tags(t, doc), any = false;
    Array.prototype.forEach.call(doc.getElementsByTagName('*'), function (g) {
      if (g.localName !== 'glyph') return;
      var r = rdfOf(g), p = ptmOf(T, g), svs = svsOf(g), shown = [];
      svs.forEach(function (sv) {
        var st = kid(sv, 'state'), vr = st && st.getAttribute('variable');
        if (vr) { var full = (st.getAttribute('value') || '') + '@' + vr; shown.push(full); var b0 = T.ed.length; svWiden(T, sv, full, true); if (T.ed.length > b0) any = true; }
      });
      if (!r.items.length && !p.sites.length) return;
      var items = r.items.slice(), left = p.sites.filter(function (x) { return shown.indexOf(x) < 0; }), took = false;
      var valOf = function (x) { return x.slice(0, x.indexOf('@')); };
      svs.forEach(function (sv) {   // a circle showing no site: its own link first, then a link or a PTM site of its value
        var st = kid(sv, 'state');
        if (!st || st.getAttribute('variable')) return;
        var val = st.getAttribute('value') || '', id = sv.getAttribute('id') || '', k, site = null;
        for (k = 0; k < items.length && site === null; k++) if (items[k].sv === id && valOf(items[k].full) === val) site = items.splice(k, 1)[0].full;
        for (k = 0; k < items.length && site === null; k++) if (valOf(items[k].full) === val) site = items.splice(k, 1)[0].full;
        for (k = 0; k < left.length && site === null; k++) if (valOf(left[k]) === val) site = left.splice(k, 1)[0];
        if (site === null) return;
        T.set(st, 'variable', site.slice(site.indexOf('@') + 1)); svWiden(T, sv, site);
        took = true;
      });
      if (!took) return;
      any = true;
      if (items.length !== r.items.length) siteWrite(T, r, items);
      if (left.length !== p.sites.filter(function (x) { return shown.indexOf(x) < 0; }).length || left.length !== p.sites.length) ptmWrite(T, g, p, left, g.prefix ? g.prefix + ':' : '');
    });
    return any ? T.text() : t;
  }

  var api = { unique: unique, LOOKS: LOOKS, ANT: ANT, GATE_FONT: GATE_FONT, SIZE: SIZE, antennas: antennas, antenna: antenna, fit: fit, GLT: GLT, NAMED: NAMED, MULTI: MULTI, graphml: graphml, write: write, join: join, joinable: joinable, nameAt: nameAt, namePlaces: namePlaces, stack: stack, restack: restack, stackMoves: stackMoves, NAME_PLACES: NAME_PLACES, defaults: defaults, add: add, lookOf: lookOf, restyle: restyle, restyleAll: restyleAll, colours: colours, lineOf: lineOf, recolour: recolour, widthOf: widthOf, rewidth: rewidth, label: label, state: state, stateValue: stateValue, stateMove: stateMove, unitMove: unitMove, entityKind: entityKind, ENTITIES: ['macromolecule', 'simple chemical', 'nucleic acid feature', 'unspecified entity'], stateDelete: stateDelete,
              unit: unit, unitValue: unitValue, unitDelete: unitDelete, multimer: multimer, classOf: classOf, MAKE: MAKE, kind: kind, PROCESSES: ['process'].concat(Object.keys(SIGN)), SIGN: SIGN, remove: remove, resize: resize, scaleEnds: scaleEnds, gone: gone, nameable: nameable,
              moveInto: moveInto, connect: connect, reversible: reversible, reversibility: reversibility, arcRemove: arcRemove, arcKind: arcKind, GATE: GATE, ARROW: ARROW, MODULATIONS: ['stimulation', 'catalysis', 'inhibition', 'necessary stimulation', 'modulation'],
              activity: activity, activities: activities, proteinBoxes: proteinBoxes, afUnitBox: afUnitBox, afUnitFont: afUnitFont, isAf: isAf, mapKind: mapKind, unitFor: unitFor, fillFor: fillFor, AF_ARC: AF_ARC, UNITS: Object.keys(UNIT_CLS).filter(function (u) { return u && u !== 'perturbation'; }), unitClass: actCls,
              way: way, wayOfR: function (r) { return cfgOf(r) === 'Tag' ? wayOf(r) : null; }, wayOf: function (t, id, opt) { var G = gml(t, opt); return isTag(G, id) ? wayOf(G.node[id].geo.parentNode) : null; }, terminal: terminal,
              countOf: countOf, recount: recount, refsOf: refsOf, setRefs: setRefs, refsAbout: refsAbout, idsOf: idsOf, setIds: setIds, countsAt: countsAt, countLens: lineLens, countMove: countMove, countsPlace: countsPlace, countOn: countOn, countAlong: countAlong, sitesIn: sitesIn, sitesOut: sitesOut, membersOut: membersOut, membersSaid: membersSaid, Tags: Tags, repr: repr, num: num };   // Tags, repr and num serve sbml_edit.js too
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.sbgn_edit = api;
})(typeof self !== 'undefined' ? self : this);
