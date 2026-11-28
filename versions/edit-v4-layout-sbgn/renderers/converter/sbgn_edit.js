(function (root) {
  'use strict';
  var YNS = 'http://www.yworks.com/xml/graphml', GNS = 'http://graphml.graphdrawing.org/xmlns';
  function DP(opt) { return (opt && opt.DOMParser) || root.DOMParser; }
  function kids(el, name) { var out = []; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (!name || c.localName === name)) out.push(c); return out; }
  function kid(el, name) { return kids(el, name)[0] || null; }
  function F(v) { return parseFloat(v); }
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
  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function prevEl(el) { var p = el.previousSibling; while (p && p.nodeType !== 1) p = p.previousSibling; return p; }
  function num(v) { var r = Math.round(v * 10000) / 10000; return String(r === 0 ? 0 : r); }

  function Tags(t, doc) {
    this.t = t; this.ed = []; this.at = new Map();
    var re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/[^>]*>|<([A-Za-z_][^\s/>]*)(?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*(\/?)>/g, m, list = [];
    while ((m = re.exec(t))) if (m[1]) list.push([m.index, m.index + m[0].length, !!m[2]]);
    var all = doc.getElementsByTagName('*');
    if (all.length !== list.length) throw new Error('the file is not read tag for tag');
    for (var i = 0; i < all.length; i++) this.at.set(all[i], list[i]);
  }
  Tags.prototype.set = function (el, k, v) {    
    v = esc(v);
    var s = this.at.get(el), tag = this.t.slice(s[0], s[1]), re = new RegExp('(\\s' + k.replace(/[.:]/g, '\\$&') + '\\s*=\\s*)("[^"]*"|\'[^\']*\')'), m = tag.match(re);
    if (m) { var from = s[0] + m.index + m[1].length; this.ed.push([from, from + m[2].length, '"' + v + '"']); }
    else { var end = s[1] - (s[2] ? 2 : 1); this.ed.push([end, end, ' ' + k + '="' + v + '"']); }
  };
  Tags.prototype.end = function (el) {    
    var s = this.at.get(el);
    if (s[2]) return s[1];
    var name = this.t.slice(s[0] + 1).match(/^[^\s/>]+/)[0], i = this.t.indexOf('</' + name, s[1]);
    return this.t.indexOf('>', i) + 1;
  };
  Tags.prototype.indent = function (el) { var s = this.at.get(el), i = this.t.lastIndexOf('\n', s[0]); return this.t.slice(i + 1, s[0]).match(/^\s*/)[0]; };
  Tags.prototype.text = function () {
    var t = this.t;
    this.ed.sort(function (a, b) { return b[0] - a[0] || b[1] - a[1]; }).forEach(function (e) { t = t.slice(0, e[0]) + e[2] + t.slice(e[1]); });
    return t;
  };

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
  function at(S, gid, ref, p, q, flux) {    
    var c = centre(S.glyph[gid].box);
    if (ref !== gid) { var P = flux !== false && xy(S.port[ref]); return P ? [P[0] - c[0], P[1] - c[1]] : [0, 0]; }
    if (!p || !q) return [0, 0];
    var ux = q[0] - c[0], uy = q[1] - c[1], vx = p[0] - c[0], vy = p[1] - c[1], n = Math.hypot(ux, uy);
    if (!n || (Math.abs(ux * vy - uy * vx) / n <= 1.5 && ux * vx + uy * vy >= 0)) return [0, 0];
    return [vx, vy];
  }
  function flux(a) { return /^(consumption|logic arc)$/.test(a.getAttribute('class')); }    
  function ends(S, a) {    
    var s = a.getAttribute('source'), t = a.getAttribute('target');
    return [S.portOf[s] || s, S.portOf[t] || t, xy(kid(a, 'start')), xy(kid(a, 'end')), kids(a, 'next').map(xy)];
  }

  function realizer(n) {    
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
    var doc = new (DP(opt))().parseFromString(t, 'application/xml'), G = { doc: doc, node: {}, edge: {} };
    Array.prototype.forEach.call(doc.getElementsByTagNameNS(GNS, 'node'), function (n) {
      var r = realizer(n), geo = r && kid(r, 'Geometry');
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

  function graphml(t, base, opt) {
    var S = sbgn(t, opt), G = gml(base, opt), T = new Tags(base, G.doc);
    Object.keys(G.node).forEach(function (id) {
      var g = S.glyph[id], n = G.node[id];
      if (!g) return;
      var B = g.box, w = B[2], h = B[3], to = function (el, k, v) { if (el.getAttribute(k) !== v) T.set(el, k, v); };
      ['x', 'y', 'width', 'height'].forEach(function (k, j) { to(n.geo, k, repr(B[j])); });
      var r = n.geo.parentNode, labs = kids(r, 'NodeLabel'), icons = labs.filter(function (l) { return l.getAttribute('iconData'); });
      var states = kids(g.el, 'glyph').filter(function (c) { return c.getAttribute('class') === 'state variable'; });
      icons.forEach(function (l, j) {
        var p = l.getElementsByTagNameNS(YNS, 'SmartNodeLabelModelParameter')[0], rx, ry;
        if (!p) return;
        if (j < states.length) {
          var cb = kid(states[j], 'bbox'), cx = F(cb.getAttribute('x')) + F(cb.getAttribute('w')) / 2, cy = F(cb.getAttribute('y')) + F(cb.getAttribute('h')) / 2;
          rx = (cx - B[0] - w / 2) / w; ry = (cy - B[1] - h / 2) / h;
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
      [['source', 's', 0], ['target', 't', 1]].forEach(function (q) {    
        if (E[q[2]] !== e[q[1]] && G.node[E[q[2]]] && G.node[e[q[1]]]) { T.set(e.el, q[0], E[q[2]]); e[q[1]] = E[q[2]]; }
      });
      if (E[0] !== e.s || E[1] !== e.t || !S.glyph[E[0]] || !S.glyph[E[1]]) return;    
      var o = at(S, E[0], a.getAttribute('source'), E[2], (pts.length ? pts : [E[3]])[0])
        .concat(at(S, E[1], a.getAttribute('target'), E[3], (pts.length ? pts[pts.length - 1] : E[2]), flux(a)));
      ['sx', 'sy', 'tx', 'ty'].forEach(function (k, j) { if (repr(o[j]) !== e.path.getAttribute(k)) T.set(e.path, k, repr(o[j])); });
      var same = pts.length === e.pts.length && pts.every(function (p, j) { return repr(p[0]) === e.ptEl[j].getAttribute('x') && repr(p[1]) === e.ptEl[j].getAttribute('y'); });
      if (same) return;
      var body = pts.map(function (p) { return '<y:Point x="' + repr(p[0]) + '" y="' + repr(p[1]) + '"/>'; }).join(''), s = T.at.get(e.path);
      T.ed.push([s[1] - (s[2] ? 2 : 1), T.end(e.path), body ? '>' + body + '</y:Path>' : '/>']);
    });
    return T.text();
  }

  function write(t, gtext, opt) {
    var S = sbgn(t, opt), G = gml(gtext, opt), T = new Tags(t, S.doc);
    var close = function (a, b) { return Math.abs(a - b) < 1e-6; };
    var setXY = function (el, p, kx, ky) {
      kx = kx || 'x'; ky = ky || 'y';
      if (!close(F(el.getAttribute(kx)), p[0])) T.set(el, kx, num(p[0]));
      if (!close(F(el.getAttribute(ky)), p[1])) T.set(el, ky, num(p[1]));
    };
    var map = {};    
    Object.keys(S.glyph).forEach(function (id) {
      var g = S.glyph[id], n = G.node[id];
      if (!n) return;
      var o = g.box, b = n.box;
      if (o.every(function (v, j) { return close(v, b[j]); })) return;
      ['x', 'y', 'w', 'h'].forEach(function (k, j) { if (!close(o[j], b[j])) T.set(g.bbox, k, n.geo.getAttribute(['x', 'y', 'width', 'height'][j])); });
      var f = map[id] = function (p) { return [b[0] + (o[2] ? (p[0] - o[0]) * b[2] / o[2] : b[2] / 2), b[1] + (o[3] ? (p[1] - o[1]) * b[3] / o[3] : b[3] / 2)]; };
      kids(g.el, 'glyph').forEach(function (c) {    
        var cb = kid(c, 'bbox');
        if (!cb || G.node[c.getAttribute('id')]) return;
        var w = F(cb.getAttribute('w')), h = F(cb.getAttribute('h')), m = f([F(cb.getAttribute('x')) + w / 2, F(cb.getAttribute('y')) + h / 2]);
        setXY(cb, [m[0] - w / 2, m[1] - h / 2]);
      });
      var lab = kid(g.el, 'label'), lb = lab && kid(lab, 'bbox');
      if (lb) setXY(lb, [F(lb.getAttribute('x')) + b[0] - o[0], F(lb.getAttribute('y')) + b[1] - o[1]]);
    });
    var portAt = {}, newPorts = {}, use = {};
    Object.keys(S.arc).forEach(function (id) {    
      var a = S.arc[id], src = a.getAttribute('source'), tgt = a.getAttribute('target');
      if (S.portOf[src]) use[S.portOf[src] + '\u0000' + 2] = use[S.portOf[src] + '\u0000' + 2] || src;
      if (S.portOf[tgt] && flux(a)) use[S.portOf[tgt] + '\u0000' + 1] = use[S.portOf[tgt] + '\u0000' + 1] || tgt;
    });
    var newId = function (gid, no) { var i = gid + '.' + no, k = 0; while (S.port[i] || S.glyph[i]) i = gid + '.p' + no + (k++ ? k : ''); return i; };
    Object.keys(S.arc).forEach(function (id) {
      var a = S.arc[id], e = G.edge[id];
      if (!e) return;
      var E = ends(S, a), ref = [a.getAttribute('source'), a.getAttribute('target')], cls = a.getAttribute('class');
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
          if (!out.length) from = T.end(prevEl(nx[0]));    
          T.ed.push([from, T.end(nx[nx.length - 1]), out.join(ind)]);
        } else {
          var en = kid(a, 'end'), at0 = en ? T.at.get(en)[0] : T.end(kid(a, 'start'));
          var ind2 = en ? T.indent(en) : T.indent(kid(a, 'start'));
          if (out.length) T.ed.push([at0, at0, out.join('\n' + ind2) + (en ? '\n' + ind2 : '')]);
        }
      }
      var side = [['source', 'start', 0, E[0], E[2]], ['target', 'end', 2, E[1], E[3]]].map(function (q) {
        var gid = q[3], b = G.node[gid].box, c = centre(b), o = S.glyph[gid].box;
        var port = ref[q[2] / 2] !== gid && (q[0] === 'source' || /^(consumption|logic arc)$/.test(cls));    
        var zero = !e.off[q[2]] && !e.off[q[2] + 1] && !port;
        return { q: q, gid: gid, c: c, zero: zero, port: port, P: [c[0] + e.off[q[2]], c[1] + e.off[q[2] + 1]],
                 old: q[4] && (map[gid] ? [q[4][0] + b[0] - o[0], q[4][1] + b[1] - o[1]] : q[4]) };
      });
      var fileOff = at(S, E[0], a.getAttribute('source'), E[2], (E[4].length ? E[4] : [E[3]])[0])
        .concat(at(S, E[1], a.getAttribute('target'), E[3], (E[4].length ? E[4][E[4].length - 1] : E[2]), flux(a)));
      var still = !moved[0] && !moved[1] && !map[E[0]] && !map[E[1]] && nx.length === e.pts.length && fileOff.every(function (v, j) { return close(v, e.off[j]); }) &&
        e.pts.every(function (p, j) { var q = xy(nx[j]); return close(p[0], q[0]) && close(p[1], q[1]); });
      if (still) return;
      var keep = function (s, aim) { return !!s.old && onLine(s.c, s.old, aim); };    
      var onLine = function (c, p, aim) {
        var u = [aim[0] - c[0], aim[1] - c[1]], v = [p[0] - c[0], p[1] - c[1]], n = Math.hypot(u[0], u[1]);
        return !n || (Math.abs(u[0] * v[1] - u[1] * v[0]) / n <= 1 && u[0] * v[0] + u[1] * v[1] >= 0);    
      };
      var cut = function (s, aim) {
        var b = G.node[s.gid].box, c = s.c, u = [aim[0] - c[0], aim[1] - c[1]];
        if (!u[0] && !u[1]) return c;
        var tt = Math.min(u[0] ? b[2] / 2 / Math.abs(u[0]) : Infinity, u[1] ? b[3] / 2 / Math.abs(u[1]) : Infinity);
        return [c[0] + tt * u[0], c[1] + tt * u[1]];
      };
      var aim = [e.pts.length ? e.pts[0] : null, e.pts.length ? e.pts[e.pts.length - 1] : null];
      if (e.pts.length) side.forEach(function (s, j) { if (s.zero) s.P = keep(s, aim[j]) ? s.old : cut(s, aim[j]); });
      else if (side[0].zero && side[1].zero) {    
        if (keep(side[0], side[1].old || side[1].c) && keep(side[1], side[0].old || side[0].c)) { side[0].P = side[0].old; side[1].P = side[1].old; }
        else { side[0].P = cut(side[0], side[1].c); side[1].P = cut(side[1], side[0].P); }    
      } else side.forEach(function (s, j) { var o = side[1 - j]; if (s.zero) s.P = keep(s, o.zero ? o.old || o.c : o.P) ? s.old : cut(s, o.P); });
      side.forEach(function (s) {
        var q = s.q, j0 = q[2] / 2, rf = ref[j0], el = kid(a, q[1]), P = s.P;
        if (!el) return;
        if (!s.port && rf !== s.gid && !s.zero) ref[j0] = s.gid;    
        if (s.port) {
          portAt[rf] = portAt[rf] || P;
          var o0 = xy(S.port[rf]);
          if (!close(o0[0], portAt[rf][0]) || !close(o0[1], portAt[rf][1])) setXY(el, portAt[rf]);    
          return;
        }
        var b2 = G.node[s.gid].box, out2 = Math.abs(P[0] - s.c[0]) > b2[2] / 2 + 0.5 || Math.abs(P[1] - s.c[1]) > b2[3] / 2 + 0.5;
        var no = cls === 'production' ? 2 : cls === 'consumption' ? 1 : cls === 'logic arc' ? (q[0] === 'source' ? 2 : 1) : 0;    
        if (!s.zero && out2 && no && HUB.test(S.glyph[s.gid].el.getAttribute('class') || '')) {    
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
  var HUB = /process|^(and|or|not|association|dissociation|equivalence)$/;

  var api = { graphml: graphml, write: write };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.sbgn_edit = api;
})(typeof self !== 'undefined' ? self : this);
