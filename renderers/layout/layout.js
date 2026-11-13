// The layout tools of the editor in JavaScript (2026-11-13): complex_pack.py and snap_grid.py (copies of the layout
// skill's at 7fc1773 2026-11-12) and tidy.py, as one file, giving the same text as the Python byte for byte
// (tests/layout-compare.js). tidy's master is here since 2026-11-13 (user: JavaScript the master for the viewer's build and
// the editor; tidy.py is its twin); complex_pack and snap_grid keep their master in the layout skill (Python, used by its
// other scripts): a new copy of them (get_layout.sh) is made here too, and the comparison run. The rules and their reasons are in
// the Python files, function by function, under the same names; comments here are short.
//   browser: layout.tidy(text, what, ids, keepPorts) -> [new text, how many attributes changed]   (as tidy.tidy)
//   node:    require('./layout.js').tidy(text, ..., { DOMParser })
(function (root) {
  'use strict';
  var GNS = 'http://graphml.graphdrawing.org/xmlns', YNS = 'http://www.yworks.com/xml/graphml';
  var GAP = 8.0, LEFT = 12.0, TOP = 16.0, RIGHT = 12.0, BOTTOM = 16.0, GAP_COMPLEX = 10.0, TOL = 5.0, SHORT = 2.0;
  var INSETS = [['left', 10], ['top', 12], ['right', 10], ['bottom', 16]];

  // ---- Python's arithmetic where JavaScript's differs ----
  var buf = new DataView(new ArrayBuffer(8));
  function exactRound(v, nd) {   // round(v, nd) of Python: the exact value of the double, an exact half to even
    var a = Math.abs(v);
    buf.setFloat64(0, a);
    var hi = buf.getUint32(0), lo = buf.getUint32(4), e = (hi >>> 20) & 0x7ff;
    var m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), ex;
    if (e === 0) ex = -1074; else { m |= 1n << 52n; ex = e - 1075; }
    var n = m * 10n ** BigInt(nd), d = 1n;
    if (ex >= 0) n <<= BigInt(ex); else d <<= BigInt(-ex);
    var q = n / d, r = n - q * d;
    if (r * 2n > d || (r * 2n === d && (q & 1n))) q += 1n;
    var s = q.toString();
    while (s.length < nd + 1) s = '0' + s;
    var out = Number(s.slice(0, s.length - nd) + '.' + s.slice(s.length - nd));
    return v < 0 || Object.is(v, -0) ? -out : out;
  }
  function pyRound(v, nd) {   // toFixed is correctly rounded except an exact half; only a value next to a half goes the exact way
    if (!isFinite(v)) return v;
    if (!nd) {
      var f = Math.floor(v), diff = v - f;
      if (diff === 0.5) return f % 2 === 0 ? f : f + 1;
      return Math.round(v) === 0 && v < 0 ? -0 : Math.round(v);
    }
    var q = Math.abs(v) * Math.pow(10, nd), fr = q - Math.floor(q);
    if (Math.abs(fr - 0.5) < 1e-6) return exactRound(v, nd);
    var r = Number(v.toFixed(nd));
    return r === 0 && (v < 0 || Object.is(v, -0)) ? -0 : r;
  }
  function pySum(xs) {   // sum() of floats in Python 3.12: Neumaier's compensated sum
    var s = 0.0, c = 0.0;
    for (var i = 0; i < xs.length; i++) {
      var x = xs[i], t = s + x;
      if (Math.abs(s) >= Math.abs(x)) c += (s - t) + x; else c += (x - t) + s;
      s = t;
    }
    return c && isFinite(c) ? s + c : s;
  }
  function floorDiv(a, b) {   // a // b for floats, as CPython computes it
    var mod = a % b, div = (a - mod) / b;
    if (mod && ((b < 0) !== (mod < 0))) { mod += b; div -= 1.0; }
    var fd;
    if (div) { fd = Math.floor(div); if (div - fd > 0.5) fd += 1.0; }
    else fd = (a / b < 0 || Object.is(a / b, -0)) ? -0 : 0;
    return fd;
  }
  function F(s) {   // float(s)
    if (s === null || s === undefined) throw new Error('TypeError: float() argument must be a string or a real number, not NoneType');
    var t = String(s).trim();
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
      if (/^[+-]?(inf|infinity)$/i.test(t)) return t[0] === '-' ? -Infinity : Infinity;
      if (/^[+-]?nan$/i.test(t)) return NaN;
      throw new Error('ValueError: could not convert string to float: ' + s);
    }
    return Number(t);
  }
  function R(v) { return String(v); }   // repr(float(v)): any text that reads back as the same double (tidy's num writes the file)
  function maxFirst(arr, key) { var b = arr[0], bk = key(b); for (var i = 1; i < arr.length; i++) { var k = key(arr[i]); if (k > bk) { b = arr[i]; bk = k; } } return b; }

  // ---- the XML, as the lxml calls of the Python read it ----
  function get(el, a) { return el.hasAttribute(a) ? el.getAttribute(a) : null; }
  function is(el, ns, name) { return el && el.nodeType === 1 && el.namespaceURI === ns && el.localName === name; }
  function kids(el, ns, name) { var o = []; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (!ns || (c.namespaceURI === ns && (name === '*' || c.localName === name)))) o.push(c); return o; }
  function kid(el, ns, name) { for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && c.namespaceURI === ns && c.localName === name) return c; return null; }
  function find(el, steps) {   // el.find('a/b/c'): steps [[ns, name], ...], the first match in document order
    var cur = [el];
    for (var i = 0; i < steps.length; i++) {
      var nx = [];
      cur.forEach(function (c) { kids(c, steps[i][0], steps[i][1]).forEach(function (k) { nx.push(k); }); });
      if (!nx.length) return null;
      cur = nx;
    }
    return cur[0];
  }
  function iter(el, ns, names) {   // el.iter(...): itself and what is inside, in document order
    var out = [];
    (function walk(e) {
      if (e.namespaceURI === ns && names.indexOf(e.localName) >= 0) out.push(e);
      for (var c = e.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) walk(c);
    })(el);
    return out;
  }
  function descendant(el, ns, name) { var r = iter(el, ns, [name]); return r[0] === el ? r[1] || null : r[0] || null; }
  function leadText(el) { var s = ''; for (var c = el.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3 || c.nodeType === 4) s += c.nodeValue; else break; } return s; }
  function ancestors(el, ns, name) { var o = []; for (var p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (!ns || (p.namespaceURI === ns && p.localName === name)) o.push(p); return o; }
  function depth(el) { var k = 0; for (var p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) k++; return k; }
  var STRIP = /^[\t\n\x0b\x0c\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t\n\x0b\x0c\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g;
  function strip(s) { return s.replace(STRIP, ''); }

  // ---- complex_pack ----
  function realizer(n) {
    var gn = find(n, [[GNS, 'data'], [YNS, 'GenericNode']]);
    if (gn) return gn;
    var rs = find(n, [[GNS, 'data'], [YNS, 'ProxyAutoBoundsNode'], [YNS, 'Realizers']]);
    if (rs) return kids(rs)[parseInt(get(rs, 'active') || '0', 10)];
    var out = null;
    kids(n, GNS, 'data').some(function (d) { return kids(d).some(function (c) { if (kid(c, YNS, 'Geometry')) { out = c; return true; } return false; }); });
    return out;
  }
  function box(n) { var g = kid(realizer(n), YNS, 'Geometry'); return ['x', 'y', 'width', 'height'].map(function (a) { return F(get(g, a)); }); }
  function setBox(n, b) { var g = kid(realizer(n), YNS, 'Geometry'); ['x', 'y', 'width', 'height'].forEach(function (a, i) { g.setAttribute(a, R(F(b[i]))); }); }
  function shift(n, dx, dy) { iter(n, YNS, ['Geometry']).forEach(function (g) { g.setAttribute('x', R(F(get(g, 'x')) + dx)); g.setAttribute('y', R(F(get(g, 'y')) + dy)); }); }
  function members(g) { var sub = kid(g, GNS, 'graph'); return sub ? kids(sub, GNS, 'node') : []; }
  function isComplex(n) { return get(n, 'yfiles.foldertype') === 'group' && (get(realizer(n), 'configuration') || '').indexOf('omplex') >= 0; }
  function labelXY(l, w, h) {
    var mp = descendant(l, YNS, 'SmartNodeLabelModelParameter');
    if (!mp) return get(l, 'x') === null ? null : [F(get(l, 'x')), F(get(l, 'y'))];
    var f = function (a) { return F(get(mp, a)); }, lw = F(get(l, 'width')), lh = F(get(l, 'height'));
    return [w / 2 + f('nodeRatioX') * w - f('labelRatioX') * lw + f('offsetX') - lw / 2, h / 2 + f('nodeRatioY') * h - f('labelRatioY') * lh + f('offsetY') - lh / 2];
  }
  function extent(n) {
    var b = box(n), x = b[0], y = b[1], w = b[2], h = b[3], r = realizer(n), mc = null;
    var sp = kid(r, YNS, 'StyleProperties');
    if (sp) kids(sp, YNS, 'Property').some(function (p) { if (get(p, 'name') === 'com.yworks.sbgn.style.mcount') { mc = p; return true; } return false; });
    var d = mc && get(mc, 'value') !== '1' ? 6.0 : 0.0;
    var x0 = x, y0 = y, x1 = x + w + d, y1 = y + h + d;
    kids(r, YNS, 'NodeLabel').forEach(function (l) {
      var xy = labelXY(l, w, h);
      if ((get(l, 'iconData') || strip(leadText(l))) && xy) {
        var lx = x + xy[0], ly = y + xy[1];
        x0 = Math.min(x0, lx); y0 = Math.min(y0, ly);
        x1 = Math.max(x1, lx + F(get(l, 'width'))); y1 = Math.max(y1, ly + F(get(l, 'height')));
      }
    });
    return [x0, y0, x1, y1];
  }
  function maxOr0(a) { return a.length ? Math.max.apply(null, a) : 0.0; }
  function room(g, r) {
    var es = members(g).map(extent), b = box(g), x = b[0], y = b[1], w = b[2], h = b[3];
    var ins = kid(r, YNS, 'Insets'), i = {};
    ['left', 'top', 'right', 'bottom'].forEach(function (s) { i[s] = F(get(ins, s + 'F')); });
    var lab = {};
    ['t', 'b'].forEach(function (side) {
      lab[side] = maxOr0(kids(r, YNS, 'NodeLabel').filter(function (l) {
        return get(l, 'modelName') === 'internal' && get(l, 'visible') !== 'false' && (get(l, 'modelPosition') || '').slice(0, 1) === side;
      }).map(function (l) { return F(get(l, 'height')); }));
    });
    if (!es.length) throw new Error('ValueError: min() arg is an empty sequence');
    var mn = function (k) { return Math.min.apply(null, es.map(function (e) { return e[k]; })); };
    var mx = function (k) { return Math.max.apply(null, es.map(function (e) { return e[k]; })); };
    return [i, { left: mn(0) - x - i.left, top: mn(1) - y - i.top - lab.t, right: x + w - mx(2) - i.right, bottom: y + h - mx(3) - i.bottom - lab.b }];
  }
  var SIDES = ['left', 'top', 'right', 'bottom'];
  function realizersOf(g) { var rs = find(g, [[GNS, 'data'], [YNS, 'ProxyAutoBoundsNode'], [YNS, 'Realizers']]); return rs ? kids(rs) : null; }
  function fitInsetsOne(g, needBi) {
    var rs = realizersOf(g);
    if (!rs) throw new Error('TypeError: NoneType is not iterable');
    rs.forEach(function (r) {
      var q = room(g, r), i = q[0], need = q[1];
      if (need.top < 0 && r === realizer(g)) {
        var ins = kid(r, YNS, 'Insets'), t = Math.max(i.top + need.top, 0.0);
        ins.setAttribute('top', String(pyRound(t, 0))); ins.setAttribute('topF', R(t));
      }
      var bi = kid(r, YNS, 'BorderInsets');
      if (!bi) { if (needBi) throw new Error('AttributeError: NoneType has no attribute set'); return; }
      SIDES.forEach(function (s) { var v = Math.max(need[s], 0.0); bi.setAttribute(s, String(pyRound(v, 0))); bi.setAttribute(s + 'F', R(v)); });
    });
  }
  function fitInsets(rootEl) {
    iter(rootEl, GNS, ['node']).forEach(function (g) {
      if (get(g, 'yfiles.foldertype') !== 'group' || !members(g).length) return;
      fitInsetsOne(g, true);
    });
  }
  function faces(items, a, b) {
    return a.some(function (i) { return b.some(function (j) { return items[i][2][0] < items[j][2][1] && items[j][2][0] < items[i][2][1]; }); });
  }
  function sortedIdx(n, key) { var o = []; for (var i = 0; i < n; i++) o.push(i); return o.sort(function (a, b) { return key(a) - key(b); }); }
  function compact(items, start, floor, wide) {
    wide = wide || new Set();
    var lines = [];
    sortedIdx(items.length, function (i) { return items[i][0]; }).forEach(function (i) {
      if (lines.length && items[i][0] - items[lines[lines.length - 1][0]][0] < TOL) lines[lines.length - 1].push(i); else lines.push([i]);
    });
    var nw = new Array(items.length).fill(null);
    lines.forEach(function (line, k) {
      var c = start - Math.min.apply(null, line.map(function (i) { return items[i][3]; }));
      lines.slice(0, k).forEach(function (prev) {
        prev.forEach(function (i) {
          line.forEach(function (j) {
            if (faces(items, [i], [j])) {
              var g = wide.has(i) || wide.has(j) ? GAP_COMPLEX : GAP;
              c = Math.max(c, nw[i] + items[i][1][1] + g - items[j][1][0]);
            }
          });
        });
      });
      if (floor) c = Math.max(c, floor[k]);
      line.forEach(function (i) { nw[i] = c; });
    });
    if (!items.length) throw new Error('ValueError: max() arg is an empty sequence');   // a complex with nothing in it, as Python
    var end = -Infinity;
    for (var i = 0; i < items.length; i++) end = Math.max(end, nw[i] + items[i][1][1]);
    return [nw, end, lines];
  }
  function placed(items, start, wide) {
    var r = compact(items, start, null, wide), nw = r[0], end = r[1], lines = r[2];
    var floor = lines.map(function () { return -Infinity; });
    lines.forEach(function (line, k) {
      if (lines.length > 1 && !lines.some(function (other) { return other !== line && faces(items, line, other); })) {
        var lo = Infinity, hi = -Infinity;
        for (var i = 0; i < items.length; i++) if (line.indexOf(i) < 0) { lo = Math.min(lo, nw[i] - items[i][4]); hi = Math.max(hi, nw[i] + items[i][4]); }
        if (lo === Infinity) throw new Error('ValueError: min() arg is an empty sequence');
        floor[k] = Math.min((lo + hi) / 2, end - Math.max.apply(null, line.map(function (i) { return items[i][1][1]; })));
      }
    });
    if (Math.max.apply(null, floor) > -Infinity) { r = compact(items, start, floor, wide); nw = r[0]; end = r[1]; }
    return [nw, end];
  }
  function scaffold(k) {
    var gn = find(k, [[GNS, 'data'], [YNS, 'GenericNode']]);
    return !!gn && /Macromolecule$/.test(get(gn, 'configuration') || '') && box(k)[3] > 40.5;
  }
  function packOne(n, state) {
    var ks = members(n);
    ks.forEach(function (k) { if (isComplex(k)) packOne(k, state); });
    var b = box(n), x = b[0], y = b[1], w = b[2], h = b[3], cs = [];
    ks.forEach(function (k) {
      var kb = box(k), kw = kb[2], kh = kb[3], e = extent(k), cx = kb[0] + kw / 2, cy = kb[1] + kh / 2;
      var tops = [0.0];
      kids(realizer(k), YNS, 'NodeLabel').forEach(function (l) { if (state.has(get(l, 'iconData')) && labelXY(l, kw, kh)) tops.push(labelXY(l, kw, kh)[1]); });
      cs.push([cx, cy, [e[0] - cx, e[1] - cy, e[2] - cx, e[3] - cy], Math.min.apply(null, tops) - kh / 2, kw, kh]);
    });
    var xs, wn, ys, hn;
    if (ks.some(scaffold)) {
      var x0 = Math.min.apply(null, cs.map(function (c) { return c[0] + c[2][0]; }));
      var y0 = Math.min.apply(null, cs.map(function (c) { return c[1] + Math.min(c[2][1], c[3]); }));
      xs = cs.map(function (c) { return c[0] - x0 + LEFT; }); wn = Math.max.apply(null, cs.map(function (c) { return c[0] + c[2][2]; })) - x0 + LEFT;
      ys = cs.map(function (c) { return c[1] - y0 + TOP; }); hn = Math.max.apply(null, cs.map(function (c) { return c[1] + c[2][3]; })) - y0 + TOP;
    } else {
      var px = placed(cs.map(function (c) { return [c[0], [c[2][0], c[2][2]], [c[1] + c[2][1], c[1] + c[2][3]], c[2][0], c[4] / 2]; }), LEFT);
      xs = px[0]; wn = px[1];
      var wide = new Set(); ks.forEach(function (k, i) { if (isComplex(k)) wide.add(i); });
      var py = placed(cs.map(function (c) { return [c[1], [c[2][1], c[2][3]], [c[0] + c[2][0], c[0] + c[2][2]], c[3], c[5] / 2]; }), TOP, wide);
      ys = py[0]; hn = py[1];
    }
    var name = maxOr0(kids(realizer(n), YNS, 'NodeLabel').filter(function (l) {
      return get(l, 'modelName') === 'internal' && get(l, 'visible') !== 'false' && (get(l, 'modelPosition') || '').slice(0, 1) === 'b' && strip(leadText(l));
    }).map(function (l) { return F(get(l, 'height')); }));
    wn = wn + RIGHT; hn = hn + BOTTOM + name;
    var nx = x + w / 2 - wn / 2, ny = y + h / 2 - hn / 2;
    ks.forEach(function (k, i) { shift(k, nx + xs[i] - cs[i][0], ny + ys[i] - cs[i][1]); });
    setBox(n, [nx, ny, wn, hn]);
    var rs = realizersOf(n);
    if (!rs) throw new Error('TypeError: NoneType is not iterable');
    rs.forEach(function (r) {
      var ins = kid(r, YNS, 'Insets');
      INSETS.forEach(function (q) { ins.setAttribute(q[0], String(q[1])); ins.setAttribute(q[0] + 'F', R(q[1])); });
    });
  }
  function pack(rootEl) {
    var state = new Set();
    iter(rootEl, YNS, ['Resource']).forEach(function (r) {
      if (iter(r, YNS, ['GenericNode']).some(function (g) { return g !== r && get(g, 'configuration') === 'com.yworks.sbgn.StateVariable'; })) state.add(get(r, 'id'));
    });
    var nodes = new Map();
    iter(rootEl, GNS, ['node']).forEach(function (n) { nodes.set(get(n, 'id'), n); });
    var old = new Map();
    nodes.forEach(function (n, i) { if (isComplex(n)) old.set(i, box(n).slice(2)); });
    nodes.forEach(function (n) {
      var gp = n.parentNode.parentNode;
      if (isComplex(n) && !(gp.nodeType === 1 && isComplex(gp))) packOne(n, state);
    });
    iter(rootEl, GNS, ['edge']).forEach(function (e) {
      var p = descendant(e, YNS, 'Path');
      [[get(e, 'source'), 'sx', 'sy'], [get(e, 'target'), 'tx', 'ty']].forEach(function (q) {
        if (!old.has(q[0])) return;
        var o = old.get(q[0]), nb = box(nodes.get(q[0])).slice(2);
        [[q[1], o[0] / 2, nb[0] / 2], [q[2], o[1] / 2, nb[1] / 2]].forEach(function (z) {
          var v = F(get(p, z[0]));
          if (Math.abs(Math.abs(v) - z[1]) < 1 || Math.abs(v) > z[2]) p.setAttribute(z[0], R(v > 0 ? z[2] : -z[2]));
        });
      });
    });
    fitInsets(rootEl);
  }

  // ---- snap_grid ----
  function isGroup(n) { return get(n, 'yfiles.foldertype') === 'group'; }
  function units(rootEl) {
    var us = new Map(), unitOf = new Map();
    (function walk(graph) {
      kids(graph, GNS, 'node').forEach(function (n) {
        if (isComplex(n) || !isGroup(n)) {
          us.set(get(n, 'id'), n);
          iter(n, GNS, ['node']).forEach(function (d) { unitOf.set(get(d, 'id'), get(n, 'id')); });
        } else if (kid(n, GNS, 'graph')) walk(kid(n, GNS, 'graph'));
      });
    })(kid(rootEl, GNS, 'graph'));
    return [us, unitOf];
  }
  function collect(rootEl, centre, unitOf, link) {
    var pts = [[], []], at = new Map(), k0 = 0;
    centre.forEach(function (c, u) { pts[0].push([c[0], 'node', u]); pts[1].push([c[1], 'node', u]); at.set(u, k0++); });
    var links = [[], []];
    iter(rootEl, GNS, ['edge']).forEach(function (e) {
      var p = descendant(e, YNS, 'Path');
      if (!p) return;
      var path = [];
      [[get(e, 'source'), 's'], [get(e, 'target'), 't']].forEach(function (q) {
        var end = q[0], a = q[1], u = unitOf.has(end) ? unitOf.get(end) : undefined;
        if (u !== end) { path.push(null); return; }
        var c = centre.get(u), idx = [];
        ['x', 'y'].forEach(function (ax, k) {
          var o = F(get(p, a + ax));
          if (!o) idx.push(at.get(u));
          else { var free = Math.abs(o) < c[2 + k] / 2 - 0.5; idx.push(pts[k].length); pts[k].push([c[k] + o, 'port', [p, a + ax, u, free]]); }
        });
        path.push([c[0] + F(get(p, a + 'x')), c[1] + F(get(p, a + 'y')), idx[0], idx[1]]);
      });
      kids(p, YNS, 'Point').forEach(function (pt) {
        var v = [F(get(pt, 'x')), F(get(pt, 'y'))];
        path.splice(path.length - 1, 0, [v[0], v[1], pts[0].length, pts[1].length]);
        pts[0].push([v[0], 'bend', pt]); pts[1].push([v[1], 'bend', pt]);
      });
      for (var i = 0; i + 1 < path.length; i++) {
        var a = path[i], b = path[i + 1];
        if (!a || !b) continue;
        for (var k = 0; k < 2; k++) {
          var d = Math.abs(a[k] - b[k]), l = Math.abs(a[1 - k] - b[1 - k]);
          if (d < link && l > 2 * d && a[2 + k] !== null && b[2 + k] !== null) links[k].push([a[2 + k], b[2 + k]]);
        }
      }
    });
    return [pts, links];
  }
  function lines(values, tol, links, link) {
    var order = sortedIdx(values.length, function (i) { return values[i][0]; }), chains = [], out = [];
    order.forEach(function (i) {
      if (chains.length && values[i][0] - values[chains[chains.length - 1][chains[chains.length - 1].length - 1]][0] <= tol) chains[chains.length - 1].push(i);
      else chains.push([i]);
    });
    while (chains.length) {
      var c = chains.pop();
      if (values[c[c.length - 1]][0] - values[c[0]][0] <= 2 * tol) { out.push(c); continue; }
      var js = []; for (var j = 1; j < c.length; j++) js.push(j);
      var k = maxFirst(js, function (j) { return values[c[j]][0] - values[c[j - 1]][0]; });
      chains.push(c.slice(0, k), c.slice(k));
    }
    var line = new Map();
    out.forEach(function (c, k) { c.forEach(function (i) { line.set(i, k); }); });
    links.forEach(function (q) {
      var a = line.get(q[0]), b = line.get(q[1]);
      var vs = out[a].concat(out[b]).map(function (x) { return values[x][0]; });
      if (a !== b && Math.max.apply(null, vs) - Math.min.apply(null, vs) <= 2 * link) {
        out[b].forEach(function (x) { line.set(x, a); });
        out[a] = out[a].concat(out[b]); out[b] = [];
      }
    });
    var keyed = out.filter(function (c) { return c.length; }).map(function (c) { return [c, Math.min.apply(null, c.map(function (i) { return values[i][0]; }))]; });
    keyed.sort(function (a, b) { return a[1] - b[1]; });
    return keyed.map(function (q) { return q[0]; });
  }
  function targets(values, groups, node, route) {
    var res = new Map(), prev = null, moved = new Map();
    var foreign = function (gi) {
      var own = new Set(gi.filter(function (i) { return values[i][1] === 'node'; }).map(function (i) { return values[i][2]; }));
      return gi.filter(function (i) { return values[i][1] === 'port' && !values[i][2][3] && !own.has(values[i][2][2]); });
    };
    groups.forEach(function (gi) {
      var cs = gi.filter(function (i) { return values[i][1] === 'node'; }).map(function (i) { return values[i][0]; });
      if (!cs.length || foreign(gi).length) return;
      var t = pyRound(pySum(cs) / cs.length / node, 0) * node;
      if (prev !== null && t <= prev) t = (floorDiv(prev, node) + 1) * node;
      gi.forEach(function (i) { res.set(i, t); if (values[i][1] === 'node') moved.set(values[i][2], t - values[i][0]); });
      prev = t;
    });
    groups.forEach(function (gi) {
      if (res.has(gi[0])) return;
      var fg = foreign(gi), from = fg.length ? fg : gi;
      var ps = from.filter(function (i) { return values[i][1] === 'port' && moved.has(values[i][2][2]); }).map(function (i) { return values[i][0] + moved.get(values[i][2][2]); });
      var cs = gi.filter(function (i) { return values[i][1] === 'node'; }).map(function (i) { return values[i][0]; });
      var step = cs.length ? node : route, t;
      if (ps.length) t = pySum(ps) / ps.length;
      else { var src = cs.length ? cs : gi.map(function (i) { return values[i][0]; }); t = pyRound(pySum(src) / (cs.length ? cs.length : gi.length) / step, 0) * step; }
      gi.forEach(function (i) { res.set(i, t); if (values[i][1] === 'node') moved.set(values[i][2], t - values[i][0]); });
    });
    return [res, moved];
  }
  function compartments(rootEl) {
    var gs = iter(rootEl, GNS, ['node']).filter(function (g) { return isGroup(g) && !isComplex(g) && members(g).length; });
    return gs.map(function (g) { return [g, depth(g)]; }).sort(function (a, b) { return b[1] - a[1]; }).map(function (q) { return q[0]; });
  }
  function numbers(rootEl) {
    var out = [];
    iter(rootEl, YNS, ['Geometry', 'Point', 'Path', 'Insets', 'BorderInsets']).forEach(function (e) {
      Array.prototype.map.call(e.attributes, function (a) { return a.name; }).filter(function (k) { return k !== 'id' && k.indexOf('xmlns') !== 0; }).sort()
        .forEach(function (k) { out.push(pyRound(F(e.getAttribute(k)), 2)); });
    });
    return out.join(',');
  }
  function onePass(rootEl, node, route, tol, link) {
    pack(rootEl);
    var u2 = units(rootEl), us = u2[0], unitOf = u2[1], centre = new Map();
    us.forEach(function (n, u) { var b = box(n); centre.set(u, [b[0] + b[2] / 2, b[1] + b[3] / 2, b[2], b[3]]); });
    var c2 = collect(rootEl, centre, unitOf, link), pts = c2[0], lk = c2[1];
    var T = [0, 1].map(function (k) { return targets(pts[k], lines(pts[k], tol, lk[k], link), node, route); });
    var tx = T[0][0], mx = T[0][1], ty = T[1][0], my = T[1][1];
    us.forEach(function (n, u) { shift(n, mx.get(u), my.get(u)); });
    [[0, tx], [1, ty]].forEach(function (q) {
      var k = q[0], t = q[1];
      pts[k].forEach(function (pv, i) {
        if (pv[1] === 'bend') pv[2].setAttribute('xy'[k], R(t.get(i)));
        else if (pv[1] === 'port' && pv[2][3]) {
          var p = pv[2][0], a = pv[2][1], u = pv[2][2], half = centre.get(u)[2 + k] / 2 - 0.5;
          p.setAttribute(a, R(Math.max(-half, Math.min(half, t.get(i) - centre.get(u)[k] - (k ? my : mx).get(u)))));
        }
      });
    });
    compartments(rootEl).forEach(function (g) {
      var r = realizer(g), b = box(g), now = {}, rm = room(g, r)[1];
      SIDES.forEach(function (s) { now[s] = Math.min(rm[s], 0.0); });
      var x0 = b[0] + now.left, y0 = b[1] + now.top, x1 = b[0] + b[2] - now.right, y1 = b[1] + b[3] - now.bottom;
      var geo = kid(r, YNS, 'Geometry');
      [['x', x0], ['y', y0], ['width', x1 - x0], ['height', y1 - y0]].forEach(function (q) { geo.setAttribute(q[0], R(q[1])); });
    });
    fitInsets(rootEl);
    var most = 0.0;
    centre.forEach(function (c, u) { most = Math.max(most, Math.max(Math.abs(mx.get(u)), Math.abs(my.get(u)))); });
    return most;
  }
  function snap(rootEl) {
    var most = 0.0;
    for (var i = 0; i < 4; i++) {
      var before = numbers(rootEl);
      most = Math.max(most, onePass(rootEl, 8.0, 4.0, 4.0, 12.0));
      if (numbers(rootEl) === before) break;
    }
    return most;
  }

  // ---- tidy ----
  var TAG = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<\/[^>]*>|<([^\s/>!?]+)([^>]*)>/g;
  function num(v) {   // as the editor writes a number: at most three decimals, no trailing zeros
    var f;
    try { f = pyRound(F(v), 3); } catch (e) { if (/^ValueError/.test(e.message)) return v; throw e; }
    if (f === Math.trunc(f)) return String(Math.trunc(f) === 0 ? 0 : Math.trunc(f));
    return String(f);
  }
  function isCompartment(n) { return get(n, 'yfiles.foldertype') === 'group' && !isComplex(n); }
  function fit(rootEl, resize, moved) {
    var byid = new Map();
    iter(rootEl, GNS, ['node']).forEach(function (n) { byid.set(get(n, 'id'), n); });
    var gone = new Set();
    (moved || []).forEach(function (i) { if (byid.has(i)) iter(byid.get(i), GNS, ['node']).forEach(function (d) { gone.add(d); }); });
    var grow = [], insets = [], sized = null;
    if (resize && byid.has(resize[0]) && isCompartment(byid.get(resize[0]))) {
      sized = byid.get(resize[0]);
      var w = Math.max(F(resize[3]), 20.0), h = Math.max(F(resize[4]), 20.0);
      setBox(sized, [F(resize[1]), F(resize[2]), w, h]);
      grow.push(sized);
      ancestors(sized, GNS, 'node').forEach(function (a) { if (isCompartment(a)) grow.push(a); });
    }
    gone.forEach(function (n) {
      ancestors(n, GNS, 'node').forEach(function (a) { if (gone.has(a)) return; (isCompartment(a) ? grow : insets).push(a); });
    });
    var gset = Array.from(new Set(grow)).map(function (g) { return [g, depth(g)]; }).sort(function (a, b) { return b[1] - a[1]; }).map(function (q) { return q[0]; });
    gset.forEach(function (g) {
      if (!members(g).length) return;
      var b = box(g), rm = room(g, realizer(g))[1], now = {};
      SIDES.forEach(function (s) { now[s] = Math.min(rm[s], 0.0); });
      if (SIDES.some(function (s) { return now[s]; })) {
        var x0 = b[0] + now.left, y0 = b[1] + now.top, x1 = b[0] + b[2] - now.right, y1 = b[1] + b[3] - now.bottom;
        setBox(g, [x0, y0, x1 - x0, y1 - y0]);
      }
    });
    new Set(gset.concat(insets)).forEach(function (g) {
      if (!members(g).length) return;
      fitInsetsOne(g, false);
    });
  }
  function attrs(e) { var o = new Map(); for (var i = 0; i < e.attributes.length; i++) { var a = e.attributes[i]; if (a.name !== 'xmlns' && a.name.indexOf('xmlns:') !== 0) o.set(a.name, a.value); } return o; }
  function tidy(text, what, ids, keepPorts, opt) {
    var DP = (opt && opt.DOMParser) || root.DOMParser;
    var doc = new DP().parseFromString(text, 'application/xml'), rootEl = doc.documentElement;
    var els = [rootEl].concat(Array.prototype.slice.call(rootEl.getElementsByTagName('*')));
    var before = els.map(attrs);
    if (what === 'grid') snap(rootEl);
    else if (what === 'fit') fit(rootEl, ids && ids.resize, (ids && ids.moved) || []);
    else pack(rootEl);
    var after = els.map(attrs);
    if (keepPorts) after = after.map(function (a, i) { return is(els[i], YNS, 'Path') ? before[i] : a; });
    if (what === 'pack' && ids && ids.length) {
      var chosen = [];
      iter(rootEl, GNS, ['node']).forEach(function (n) {
        if (ids.indexOf(get(n, 'id')) < 0) return;
        var c = [n].concat(ancestors(n, GNS, 'node')).find(isComplex) || null;
        if (c && chosen.indexOf(c) < 0) chosen.push(c);
      });
      if (!chosen.length) return [text, -1];
      var keep = new Set(), inside = new Set();
      chosen.forEach(function (n) {
        iter(n, n.namespaceURI, [n.localName]).concat(Array.prototype.slice.call(n.getElementsByTagName('*'))).forEach(function (x) { keep.add(x); });
        ancestors(n, GNS, 'node').forEach(function (a) { var d = kid(a, GNS, 'data'); [d].concat(Array.prototype.slice.call(d.getElementsByTagName('*'))).forEach(function (x) { keep.add(x); }); });
        iter(n, GNS, ['node']).forEach(function (d) { inside.add(get(d, 'id')); });
      });
      iter(rootEl, GNS, ['edge']).forEach(function (e) {
        if (inside.has(get(e, 'source')) || inside.has(get(e, 'target'))) [e].concat(Array.prototype.slice.call(e.getElementsByTagName('*'))).forEach(function (x) { keep.add(x); });
      });
      after = after.map(function (a, i) { return keep.has(els[i]) ? a : before[i]; });
    }
    var out = [], k = -1, at = 0, changed = 0, m;
    TAG.lastIndex = 0;
    while ((m = TAG.exec(text))) {
      if (m[1] === undefined) continue;
      k++;
      var bf = before[k], nw = [];
      after[k].forEach(function (v, a) { if (bf.get(a) !== v && num(v) !== num(bf.has(a) ? bf.get(a) : '')) nw.push([a, v]); });
      if (!nw.length) continue;
      var tag = m[0];
      nw.forEach(function (q) {
        var a = q[0], v = q[1], local = a.split('}').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        var re = new RegExp('(\\s' + local + '=")[^"]*(")'), r = re.exec(tag);
        tag = r ? tag.slice(0, r.index) + r[1] + num(v) + r[2] + tag.slice(r.index + r[0].length) : tag.replace(m[1], m[1] + ' ' + a + '="' + num(v) + '"');
        changed++;
      });
      out.push(text.slice(at, m.index)); out.push(tag); at = m.index + m[0].length;
    }
    out.push(text.slice(at));
    return [out.join(''), changed];
  }

  var api = { tidy: tidy, pyRound: pyRound, pySum: pySum, floorDiv: floorDiv, num: num };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.layout = api;
})(typeof window !== 'undefined' ? window : globalThis);
