// cd_edit in JavaScript (2026-11-13): the same text as cd_edit.py byte for byte (tests/cd-compare.js), so the editor
// works on a CellDesigner map with no Python; the master since 2026-11-13 (user: JavaScript the master for the viewer's own build and the editor). cd_edit.py beside it is its
// twin; a change is made in both in the same commit. The rules and their reasons are in cd_edit.py under the same names.
//   graphml(cdText, off, opt) -> GraphML text;  place(cdText, graphmlText, opt) -> [CellDesigner text, shift];
//   draw(cdText, graphmlText, opt) -> [svg, CellDesigner text, GraphML text]   (opt: { DOMParser } in Node)
(function (root) {
  'use strict';
  var cdr = typeof module !== 'undefined' && module.exports ? require('./cdrender.js') : root.cdrender;
  var py = cdr.py, X = cdr.xml, find = X.find, findall = X.findall, get = X.get, text = X.text, findtext = X.findtext, NS = X.NS;
  var F = py.F, I = py.I, repr = py.repr, escape = py.escape, round = py.round;
  var SQUARE = cdr.SQUARE, fromFrame = cdr.fromFrame, toFrame = cdr.toFrame, editPoints = cdr.editPoints, unit = cdr.unit, target = cdr.target;
  var YNS = 'http://www.yworks.com/xml/graphml', GNS = 'http://graphml.graphdrawing.org/xmlns';
  var PROC = 10.0;
  var FULL = ['STATE_TRANSITION', 'KNOWN_TRANSITION_OMITTED', 'UNKNOWN_TRANSITION', 'TRANSPORT', 'TRANSCRIPTION', 'TRANSLATION'];
  var SHAPE = { PROTEIN: 'Macromolecule', RECEPTOR: 'Macromolecule', ION_CHANNEL: 'Macromolecule', TRUNCATED: 'Macromolecule', PHENOTYPE: 'Phenotype',
    SIMPLE_MOLECULE: 'ellipse', ION: 'ellipse', DRUG: 'ellipse', UNKNOWN: 'ellipse', DEGRADED: 'ellipse' };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  function reEscape(s) { return String(s).replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&'); }
  function DP(opt) { return (opt && opt.DOMParser) || root.DOMParser; }

  function drawing(t, opt) { return new cdr.Drawing(t, { DOMParser: DP(opt) }); }
  function num(v) { return repr(round(F(v), 6)); }
  function compartments(d) {
    var out = new Map();
    findall(d.ext, 'cd:listOfCompartmentAliases/cd:compartmentAlias').forEach(function (a) {
      var b = find(a, 'cd:bounds');
      if (!b) return;
      var dl = find(a, 'cd:doubleLine');
      out.set(get(a, 'id'), [['x', 'y', 'w', 'h'].map(function (k) { return F(get(b, k)); }), a, dl ? F(get(dl, 'thickness', 12)) : 12.0]);
    });
    return out;
  }
  function inside(b, c) { return c[0] <= b[0] && c[1] <= b[1] && b[0] + b[2] <= c[0] + c[2] && b[1] + b[3] <= c[1] + c[3]; }
  function tree(d, comps) {
    var up = new Map();
    comps.forEach(function (v0, c) {
      var b = v0[0], best = null, ba = null;
      comps.forEach(function (v, k) {
        if (k !== c && inside(b, v[0]) && v[0][2] * v[0][3] > b[2] * b[3]) { var ar = v[0][2] * v[0][3]; if (best === null || ar < ba) { best = k; ba = ar; } }
      });
      up.set(c, best);
    });
    d.alias.forEach(function (A, i) {
      var p = get(A[2], 'complexSpeciesAlias'), ca = get(A[2], 'compartmentAlias');
      up.set(i, p !== null && d.alias.has(p) ? p : (ca !== null && comps.has(ca) ? ca : null));
    });
    return up;
  }
  function lines(d, rx) {
    var x = find(rx, 's:annotation/cd:extension');
    var rt = find(x, 'cd:reactionType'), typ = rt ? (text(rt) || '') : null;
    var br = findall(x, 'cd:baseReactants/cd:baseReactant'), bp = findall(x, 'cd:baseProducts/cd:baseProduct');
    var mods = findall(x, 'cd:listOfModification/cd:modification');
    if (br.length !== 1 || bp.length !== 1 || typ === 'BOOLEAN_LOGIC_GATE' || mods.some(function (m) { return (get(m, 'type') || '').indexOf('BOOLEAN') === 0; })) return null;
    var ra = get(br[0], 'alias'), pa = get(bp[0], 'alias');
    if (!d.alias.has(ra) || !d.alias.has(pa)) return null;
    var EA = d.end(br[0], ra), EB = d.end(bp[0], pa), A = EA[0], B = EB[0];
    var ep = find(x, 'cd:editPoints');
    var bends = editPoints(ep ? text(ep) : '').map(function (p) { return fromFrame(A, B, p); });
    var r = { id: get(rx, 'id'), x: x, ra: ra, pa: pa, A: A, B: B, ancA: EA[1], ancB: EB[1], bends: bends, glyph: FULL.indexOf(typ) >= 0, mods: [], links: [] };
    if (!r.glyph) return r;
    var line = cut(d, r, bends), cs = find(x, 'cd:connectScheme');
    var k = Math.min(cs ? I(get(cs, 'rectangleIndex', 0)) : 0, line.length - 2), P = line[k], Q = line[k + 1];
    var sq = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2], fl = unit(Q[0] - P[0], Q[1] - P[1]);
    r.k = k; r.sq = sq; r.fl = fl; r.P = P; r.Q = Q;
    mods.forEach(function (m, n) {
      var a = get(m, 'aliases');
      if (!d.alias.has(a)) return;
      var Mm = d.end(find(m, 'cd:linkTarget'), a), M = Mm[0], T = target(m, sq, fl);
      r.mods.push({ n: n, el: m, alias: a, M: M, anc: Mm[1], T: T, bends: editPoints(get(m, 'editPoints')).map(function (p) { return fromFrame(M, T, p); }) });
    });
    var joins = [0.375, 0.625].map(function (t) { return [P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]; });
    [['cd:listOfReactantLinks/cd:reactantLink', true], ['cd:listOfProductLinks/cd:productLink', false]].forEach(function (tg) {
      var into = tg[1];
      findall(x, tg[0]).forEach(function (l, n) {
        if (!d.alias.has(get(l, 'alias'))) return;
        var Oo = d.end(l, get(l, 'alias')), O = Oo[0], J = joins[into ? 0 : 1];
        var stored = editPoints(get(l, 'editPoints') || findtext(l, 'cd:editPoints', ''));
        r.links.push({ n: n, el: l, into: into, alias: get(l, 'alias'), O: O, anc: Oo[1], J: J,
          bends: stored.map(function (p) { return into ? fromFrame(O, J, p) : fromFrame(J, O, p); }) });
      });
    });
    return r;
  }
  function cut(d, r, bends) {
    var line = [r.A].concat(bends, [r.B]), L = line.length;
    line[0] = d.clip(r.ra, r.A, r.ancA, line[1]);
    line[L - 1] = d.clip(r.pa, r.B, r.ancB, line[L - 2]);
    return line;
  }

  // ---- the GraphML ----
  function marks(d, i) {
    var A = d.alias.get(i), x = A[1][0], y = A[1][1], w = A[1][2], h = A[1][3], a = A[2], si = A[4];
    var hd = si ? find(si, 'cd:state/cd:homodimer') : null, n = hd ? I(text(hd)) : 1;
    var fw = w - 6 * (n - 1), fh = h - 6 * (n - 1), pref = si ? find(si, 'cd:proteinReference') : null, pid = pref ? text(pref) : null, out = [];
    for (var k = 0; k < n; k++) {
      var b = [x + 6 * k, y + 6 * k, fw, fh];
      d.residues.forEach(function (r) { if (r[2] === pid) { var p = cdr.onBorder(b, r[0]); out.push([p[0] - 8, p[1] - 8, 16.0, 16.0]); } });
      (si ? findall(si, 'cd:state/cd:listOfStructuralStates/cd:structuralState') : []).forEach(function (st) {
        var sa = find(a, 'cd:structuralState'), p = cdr.onBorder(b, sa ? F(get(sa, 'angle')) : -Math.PI / 2);
        var rx = Math.trunc(cdr.width(get(st, 'structuralState') || '', 10) / 2 + 12);
        out.push([p[0] - rx, p[1] - 8, 2.0 * rx, 16.0]);
      });
    }
    var info = find(a, 'cd:info');
    if (info && get(info, 'state') === 'open') out.push([x + fw / 2 - 35, y - 8, 70.0, 16.0]);
    return out;
  }
  function labels(d, i, b) {
    var A = d.alias.get(i), cls = A[0], a = A[2], name = A[3], s = '';
    if (cls === 'COMPLEX') {
      var fe = find(a, 'cd:font'), z = fe && get(fe, 'size') ? F(get(fe, 'size')) : 12.0, nl = d.nameLines(name);
      s += '<y:NodeLabel modelName="internal" modelPosition="b" height="' + repr(z * 7 / 6 * nl.length) + '">' + escape(nl.join(' ') || ' ') + '</y:NodeLabel>';
    }
    marks(d, i).forEach(function (m) { s += '<y:NodeLabel iconData="cdmark" x="' + repr(m[0] - b[0]) + '" y="' + repr(m[1] - b[1]) + '" width="' + repr(m[2]) + '" height="' + repr(m[3]) + '"/>'; });
    return s;
  }
  function graphml(t, off, opt) {
    off = off || [0.0, 0.0];
    var d = drawing(t, opt), comps = compartments(d), up = tree(d, comps), ks = new Map();
    up.forEach(function (p, i) { if (!ks.has(p)) ks.set(p, []); ks.get(p).push(i); });
    var rxs = findall(d.model, 's:listOfReactions/s:reaction').map(function (rx) { return lines(d, rx); }).filter(function (r) { return r; });
    var chain = function (i) { var c = []; while (i !== null && i !== undefined) { c.push(i); i = up.has(i) ? up.get(i) : null; } return c; };
    rxs.forEach(function (r) {
      if (!r.glyph) return;
      var a = chain(r.ra), b = new Set(chain(r.pa)), p = null;
      for (var j = 1; j < a.length; j++) if (b.has(a[j])) { p = a[j]; break; }
      if (!ks.has(p)) ks.set(p, []); ks.get(p).push(r.id + '|proc');
    });
    var procs = {}; rxs.forEach(function (r) { if (r.glyph) procs[r.id + '|proc'] = r; });
    var box = function (i) { return comps.has(i) ? comps.get(i)[0] : d.alias.get(i)[1]; };
    var out = ['<?xml version="1.0" encoding="UTF-8"?>', '<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:y="http://www.yworks.com/xml/graphml">',
      '  <key for="node" id="d6" yfiles.type="nodegraphics"/>', '  <key for="edge" id="d10" yfiles.type="edgegraphics"/>',
      '  <key for="graphml" id="d7" yfiles.type="resources"/>', '  <graph edgedefault="directed" id="G">'];
    var geo = function (b) { return '<y:Geometry x="' + repr(b[0] - off[0]) + '" y="' + repr(b[1] - off[1]) + '" width="' + repr(F(b[2])) + '" height="' + repr(F(b[3])) + '"/>'; };
    var ZERO = '<y:Insets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/>';
    var ZB = '<y:BorderInsets bottom="0" bottomF="0.0" left="0" leftF="0.0" right="0" rightF="0.0" top="0" topF="0.0"/>';
    function node(i, ind) {
      var s = ' '.repeat(ind);
      if (has(procs, i)) {
        var c = procs[i].sq;
        out.push(s + '<node id="' + escape(i) + '"><data key="d6"><y:GenericNode configuration="com.yworks.sbgn.Process">' + geo([c[0] - PROC / 2, c[1] - PROC / 2, PROC, PROC]) + '</y:GenericNode></data></node>');
        return;
      }
      var b = box(i), ch = ks.get(i) || [], real;
      if (comps.has(i)) {
        var t2 = comps.get(i)[2], shape = findtext(comps.get(i)[1], 'cd:class', null) === 'OVAL' ? 'ellipse' : 'roundrectangle';
        var ins = ['left', 'top', 'right', 'bottom'].map(function (k) { return ' ' + k + '="' + round(t2, 0).toFixed(0) + '" ' + k + 'F="' + repr(t2) + '"'; }).join('');
        real = '<y:GroupNode>' + geo(b) + '<y:Shape type="' + shape + '"/><y:Insets' + ins + '/>' + ZB + '</y:GroupNode>';
      } else if (d.alias.get(i)[0] === 'COMPLEX') {
        real = '<y:GenericGroupNode configuration="com.yworks.sbgn.Complex">' + geo(b) + labels(d, i, b) + '<y:StyleProperties><y:Property name="com.yworks.sbgn.style.radiusX" value="5"/><y:Property name="com.yworks.sbgn.style.radiusY" value="5"/></y:StyleProperties>' + ZERO + ZB + '</y:GenericGroupNode>';
      } else {
        var k = SHAPE[d.alias.get(i)[0]] || 'rectangle';
        var props = k === 'Macromolecule' ? '<y:StyleProperties><y:Property name="com.yworks.sbgn.style.radius" value="5"/></y:StyleProperties>' : '';
        if (k === 'ellipse' || k === 'rectangle') out.push(s + '<node id="' + escape(i) + '"><data key="d6"><y:ShapeNode>' + geo(b) + labels(d, i, b) + '<y:Shape type="' + k + '"/></y:ShapeNode></data></node>');
        else out.push(s + '<node id="' + escape(i) + '"><data key="d6"><y:GenericNode configuration="com.yworks.sbgn.' + k + '">' + geo(b) + labels(d, i, b) + props + '</y:GenericNode></data></node>');
        return;
      }
      out.push(s + '<node id="' + escape(i) + '" yfiles.foldertype="group"><data key="d6"><y:ProxyAutoBoundsNode><y:Realizers active="0">' + real + '</y:Realizers></y:ProxyAutoBoundsNode></data>');
      out.push(s + '  <graph edgedefault="directed" id="' + escape(i) + ':">');
      ch.forEach(function (c2) { node(c2, ind + 4); });
      out.push(s + '  </graph>');
      out.push(s + '</node>');
    }
    (ks.get(null) || []).forEach(function (i) { node(i, 4); });
    var port = function (p, i) {
      if (!d.alias.has(i) && !comps.has(i)) throw new Error("TypeError: 'NoneType' object is not subscriptable");
      var b = box(i); return [p[0] - b[0] - b[2] / 2, p[1] - b[1] - b[3] / 2];
    };
    var edge = function (eid, s, t2, sp, tp, ps) {
      var q = ps.map(function (p) { return '<y:Point x="' + repr(p[0] - off[0]) + '" y="' + repr(p[1] - off[1]) + '"/>'; }).join('');
      out.push('    <edge id="' + escape(eid) + '" source="' + escape(s) + '" target="' + escape(t2) + '"><data key="d10"><y:PolyLineEdge><y:Path sx="' + repr(sp[0]) + '" sy="' + repr(sp[1]) + '" tx="' + repr(tp[0]) + '" ty="' + repr(tp[1]) + '">' + q + '</y:Path><y:BendStyle smoothed="false"/></y:PolyLineEdge></data></edge>');
    };
    rxs.forEach(function (r) {
      var rid = r.id, A = r.A, B = r.B, pa = r.ancA ? port(A, r.ra) : [0.0, 0.0], pb = r.ancB ? port(B, r.pa) : [0.0, 0.0];
      if (!r.glyph) { edge(rid + '|a', r.ra, r.pa, pa, pb, r.bends); return; }
      var g = rid + '|proc', k = r.k, sq = r.sq;
      edge(rid + '|a', r.ra, g, pa, [0.0, 0.0], r.bends.slice(0, k));
      edge(rid + '|b', g, r.pa, [0.0, 0.0], pb, r.bends.slice(k));
      r.mods.forEach(function (m) { edge(rid + '|m' + m.n, m.alias, g, m.anc ? port(m.M, m.alias) : [0.0, 0.0], [m.T[0] - sq[0], m.T[1] - sq[1]], m.bends); });
      r.links.forEach(function (l) {
        var o = l.anc ? port(l.O, l.alias) : [0.0, 0.0], j = [l.J[0] - sq[0], l.J[1] - sq[1]];
        if (l.into) edge(rid + '|r' + l.n, l.alias, g, o, j, l.bends); else edge(rid + '|p' + l.n, g, l.alias, j, o, l.bends);
      });
    });
    out.push('  </graph>', '  <data key="d7"><y:Resources><y:Resource id="cdmark"><y:GenericNode configuration="com.yworks.sbgn.StateVariable"/></y:Resource></y:Resources></data>', '</graphml>', '');
    return out.join('\n');
  }

  // ---- writing back ----
  function descendant(el, ns, name) {   // el.find('.//name')
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      if (c.namespaceURI === ns && c.localName === name) return c;
      var r = descendant(c, ns, name); if (r) return r;
    }
    return null;
  }
  function iter(el, ns, name, out) { out = out || []; if (el.namespaceURI === ns && el.localName === name) out.push(el); for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) iter(c, ns, name, out); return out; }
  function read(gtext, opt) {
    var r = new (DP(opt))().parseFromString(gtext, 'application/xml').documentElement, boxes = new Map(), bends = new Map(), paths = new Map();
    iter(r, GNS, 'node').forEach(function (n) { var g = descendant(n, YNS, 'Geometry'); boxes.set(get(n, 'id'), ['x', 'y', 'width', 'height'].map(function (k) { return F(get(g, k)); })); });
    iter(r, GNS, 'edge').forEach(function (e) {
      bends.set(get(e, 'id'), iter(e, YNS, 'Point').map(function (p) { return [F(get(p, 'x')), F(get(p, 'y'))]; }));
      var pa = descendant(e, YNS, 'Path');
      if (pa) paths.set(get(e, 'id'), ['sx', 'sy', 'tx', 'ty'].map(function (k) { return F(get(pa, k, 0)); }));
    });
    return [boxes, new Map(), bends, paths];
  }
  var SIDES = [['', [0.0, 0.0]], ['N', [0.0, -0.5]], ['S', [0.0, 0.5]], ['W', [-0.5, 0.0]], ['E', [0.5, 0.0]]];
  function side(p, b) {
    var best = null, bd = null;
    SIDES.forEach(function (s) { var dd = py.hypot(p[0] - s[1][0] * b[2], p[1] - s[1][1] * b[3]); if (best === null || dd < bd) { best = s[0]; bd = dd; } });
    return best;
  }
  var CDNS = NS.cd;
  function anchor(T, el, span, pos, tag, tgt) {
    var doc = el.ownerDocument;
    var mk = function (name, attrs) { var e = doc.createElementNS(CDNS, 'celldesigner:' + name); attrs.forEach(function (q) { e.setAttribute(q[0], q[1]); }); return e; };
    if (tgt) {
      var lt = find(el, 'cd:linkTarget');
      if (!lt) {
        if (!pos) return;
        lt = mk('linkTarget', [['species', tgt[0]], ['alias', tgt[1]]]);
        var first = null; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) { first = c; break; }
        el.insertBefore(lt, first);
        var cs = T.span('<celldesigner:connectScheme', span[0], span[1]);
        var at = cs ? cs[1] : T.t.indexOf('>', span[0]) + 1;
        T.put(at, at, '\n<celldesigner:linkTarget species="' + tgt[0] + '" alias="' + tgt[1] + '">\n<celldesigner:linkAnchor position="' + pos + '"/>\n</celldesigner:linkTarget>');
        lt.appendChild(mk('linkAnchor', [['position', pos]]));
        return;
      }
      el = lt; span = T.span('<celldesigner:linkTarget[\\s>/]', span[0], span[1]); tag = 'linkTarget';
    }
    var la = find(el, 'cd:linkAnchor');
    if (la) { if (pos) la.setAttribute('position', pos); else el.removeChild(la); }
    else if (pos) el.appendChild(mk('linkAnchor', [['position', pos]]));
    if (T.t.slice(span[1] - 2, span[1]) === '/>') {
      if (pos) T.put(span[0], span[1], T.t.slice(span[0], span[1] - 2).replace(/\s+$/, '') + '>\n<celldesigner:linkAnchor position="' + pos + '"/>\n</celldesigner:' + tag + '>');
      return;
    }
    var ls = T.span('<celldesigner:linkAnchor ', span[0], span[1]);
    if (ls && pos) T.attrs(ls[0], [['position', pos]]);
    else if (ls) T.put(ls[0], ls[1] + (T.t.slice(ls[1], ls[1] + 1) === '\n' ? 1 : 0), '');
    else if (pos) { var at2 = T.t.indexOf('>', span[0]) + 1; T.put(at2, at2, '\n<celldesigner:linkAnchor position="' + pos + '"/>'); }
  }
  function ports(d, T, s, o, paths, nw) {
    var rid = o.id, cen = function (b) { return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
    var moved = function (eid, which, alias, P, anc, old) {
      var q = paths.get(eid);
      if (!q) return null;
      var port = which === 's' ? q.slice(0, 2) : q.slice(2), c = cen(old.get(alias)), was = anc ? [P[0] - c[0], P[1] - c[1]] : [0.0, 0.0];
      if (py.hypot(port[0] - was[0], port[1] - was[1]) < 0.5) return null;
      return side(port, nw.get(alias));
    };
    var x = o.x;
    [['baseReactant', rid + '|a', 's', o.ra, o.A, o.ancA], ['baseProduct', rid + (o.glyph ? '|b' : '|a'), 't', o.pa, o.B, o.ancB]].forEach(function (q) {
      var pos = moved(q[1], q[2], q[3], q[4], q[5], o.old);
      if (pos !== null) {
        var el = find(x, 'cd:' + q[0] + 's/cd:' + q[0]);
        anchor(T, el, T.span('<celldesigner:' + q[0] + ' [^>]*alias="' + reEscape(q[3]) + '"', s[0], s[1]), pos, q[0]);
      }
    });
    var lists = {};
    [['listOfModification', 'modification'], ['listOfReactantLinks', 'reactantLink'], ['listOfProductLinks', 'productLink']].forEach(function (q) {
      var ls = T.span('<celldesigner:' + q[0] + '>', s[0], s[1]), found = [], i0 = ls ? ls[0] : null;
      while (ls) { var m = T.span('<celldesigner:' + q[1] + ' ', i0, ls[1]); if (!m) break; found.push(m); i0 = m[1]; }
      lists[q[1]] = found;
    });
    var at = function (list, n) { if (n >= list.length) throw new Error('IndexError: list index out of range'); return list[n]; };
    o.mods.forEach(function (m) {
      var pos = moved(rid + '|m' + m.n, 's', m.alias, m.M, m.anc, o.old);
      if (pos !== null) anchor(T, m.el, at(lists.modification, m.n), pos, 'modification', [get(m.el, 'modifiers'), m.alias]);
    });
    o.links.forEach(function (l) {
      var pos = moved(rid + '|' + (l.into ? 'r' : 'p') + l.n, l.into ? 's' : 't', l.alias, l.O, l.anc, o.old);
      if (pos !== null) { var tag = l.into ? 'reactantLink' : 'productLink'; anchor(T, l.el, at(lists[tag], l.n), pos, tag); }
    });
  }
  function near(p, q, tol) { tol = tol === undefined ? 1e-3 : tol; return Math.abs(p[0] - q[0]) < tol && Math.abs(p[1] - q[1]) < tol; }

  function Text(t) { this.t = t; this.e = []; }
  Text.prototype.search = function (src, start, end) {   // re.search(src, t, start, end): the match or null
    var re = new RegExp(src, 'g'), s = end === undefined || end === null ? this.t : this.t.slice(0, end);
    re.lastIndex = start || 0;
    return re.exec(s);
  };
  Text.prototype.span = function (open, start, end) {
    var m = this.search(open, start, end);
    if (!m) return null;
    var name = /^<([\w:]+)/.exec(m[0])[1], tagEnd = this.t.indexOf('>', m.index);
    if (this.t[tagEnd - 1] === '/') return [m.index, tagEnd + 1];
    var depth = 1, i = tagEnd + 1, pat = new RegExp('<(/?)' + reEscape(name) + '[\\s>/]', 'g');
    while (depth) {
      pat.lastIndex = i;
      var q = pat.exec(this.t);
      if (!q) throw new Error("AttributeError: 'NoneType' object has no attribute 'start'");
      var close = this.t.indexOf('>', q.index);
      if (this.t.slice(q.index, close + 1).slice(-2) === '/>') { i = q.index + q[0].length; continue; }
      depth += q[1] ? -1 : 1;
      i = close + 1;
    }
    return [m.index, i];
  };
  Text.prototype.attrs = function (at, values) {   // values: [[name, value or null], ...] in order
    var end = this.t.indexOf('>', at), tag = this.t.slice(at, end), close = tag.slice(-1) === '/';
    if (close) tag = tag.slice(0, -1);
    var nw = tag;
    values.forEach(function (q) {
      var k = q[0], v = q[1], m = new RegExp('\\s' + reEscape(k) + '="[^"]*"').exec(nw);
      if (v === null) nw = m ? nw.slice(0, m.index) + nw.slice(m.index + m[0].length) : nw;
      else if (m) nw = nw.slice(0, m.index) + ' ' + k + '="' + v + '"' + nw.slice(m.index + m[0].length);
      else nw = nw.replace(/[\t\n\x0b\x0c\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/, '') + ' ' + k + '="' + v + '"';
    });
    if (nw !== tag) this.e.push([at, at + tag.length, nw]);
  };
  Text.prototype.put = function (a, b, nw) { if (this.t.slice(a, b) !== nw) this.e.push([a, b, nw]); };
  Text.prototype.done = function () {
    var t = this.t;
    this.e.map(function (q, i) { return [q, i]; }).sort(function (p, q) { return q[0][0] - p[0][0] || p[1] - q[1]; }).forEach(function (p) {
      var q = p[0]; t = t.slice(0, q[0]) + q[2] + t.slice(q[1]);
    });
    return t;
  };
  function points(oldTokens, oldAbs, newAbs, frameSame, frame) {
    var toks = oldTokens ? oldTokens.split(/[\t\n\x0b\x0c\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/).filter(function (q) { return q; }) : [], out = [];
    newAbs.forEach(function (p, i) {
      if (frameSame && i < toks.length && i < oldAbs.length && near(p, oldAbs[i]) && oldAbs.length === newAbs.length) { out.push(toks[i]); return; }
      var q = frame(p);
      if (i < toks.length && oldAbs.length === newAbs.length) {
        var o = toks[i].split(',').map(F);
        if (Math.abs(o[0] - q[0]) < 1e-7 && Math.abs(o[1] - q[1]) < 1e-7) { out.push(toks[i]); return; }
      }
      out.push(repr(round(q[0], 12)) + ',' + repr(round(q[1], 12)));
    });
    return out.join(' ');
  }
  function directions(T, span, n) {
    var s = T.span('<celldesigner:listOfLineDirection>', span[0], span[1]);
    if (!s) return;
    var body = T.t.slice(s[0], s[1]), items = body.match(/<celldesigner:lineDirection [^>]*\/>/g) || [];
    if (items.length === n) return;
    var sep = body.indexOf('\n') >= 0 ? '\n' : '', vals = items.map(function (i) { return /value="([^"]*)"/.exec(i)[1]; }), nw = '';
    for (var j = 0; j < n; j++) nw += sep + '<celldesigner:lineDirection index="' + j + '" value="' + (j < vals.length ? vals[j] : 'unknown') + '"/>';
    T.put(s[0], s[1], '<celldesigner:listOfLineDirection>' + nw + sep + '</celldesigner:listOfLineDirection>');
  }
  var MARGIN = 40.0;
  function apply(t, gtext, opt) { return place(t, gtext, opt)[0]; }
  // one reaction's lines written into T (s: its span), as place does for each (also the editor's live drawing, live():
  // JavaScript only, it changes no text; cd_edit.py keeps this inside place)
  function reaction(d, T, s, rx, o, bends, paths, nw) {
    var rid = o.id;
    ports(d, T, s, o, paths, nw);
    var r = lines(d, rx), A = r.A, B = r.B;
    var ba = bends.get(rid + '|a') || [], bb = bends.get(rid + '|b') || [], main = ba.concat(bb), k = ba.length;
    var frameSame = near(A, o.A, 1e-6) && near(B, o.B, 1e-6);
    var seg = T.t.slice(s[0], s[1]), subs = [], re = /<celldesigner:(listOfReactantLinks|listOfProductLinks|listOfModification)>/g, m;
    while ((m = re.exec(seg))) subs.push(T.span('<celldesigner:' + m[1] + '>', s[0] + m.index, s[1]));
    var inSub = function (at) { return subs.some(function (q) { return q[0] <= at && at < q[1]; }); };
    var cs = null, re2 = /<celldesigner:connectScheme/g;
    while ((m = re2.exec(seg))) { var at = s[0] + m.index; if (!inSub(at)) { cs = T.span('<celldesigner:connectScheme', at, s[1]); break; } }
    var ep = T.span('<celldesigner:editPoints>', cs ? cs[1] : s[0], s[1]);
    if (ep && inSub(ep[0])) ep = null;
    var oldTok = ep ? T.t.slice(ep[0], ep[1]).replace(/<\/?celldesigner:editPoints>/g, '') : '';
    var txt = points(oldTok, o.bends, main, frameSame, function (p) { return toFrame(A, B, p); });
    if (ep) {
      if (main.length) T.put(ep[0], ep[1], '<celldesigner:editPoints>' + txt + '</celldesigner:editPoints>');
      else T.put(ep[0], ep[1] + (T.t.slice(ep[1], ep[1] + 1) === '\n' ? 1 : 0), '');
    } else if (main.length && cs) {
      var nl = T.t.slice(cs[1], cs[1] + 1) === '\n' ? '\n' : '';
      T.put(cs[1] + nl.length, cs[1] + nl.length, '<celldesigner:editPoints>' + txt + '</celldesigner:editPoints>' + nl);
    }
    if (cs) {
      directions(T, cs, main.length + 1);
      if (o.glyph) {
        var ri = /rectangleIndex="(\d+)"/.exec(T.t.slice(cs[0], T.t.indexOf('>', cs[0])));
        if ((ri ? I(ri[1]) : 0) !== k) T.attrs(cs[0], [['rectangleIndex', String(k)]]);
      }
    }
    if (!o.glyph) return;
    var line = cut(d, r, main), P = line[k], Q = line[k + 1];
    var sq = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2], fl = unit(Q[0] - P[0], Q[1] - P[1]), modSpans = [];
    subs.forEach(function (q) {
      if (T.t.startsWith('<celldesigner:listOfModification>', q[0])) {
        var i0 = q[0];
        while (true) { var mm2 = T.span('<celldesigner:modification ', i0, q[1]); if (!mm2) break; modSpans.push(mm2); i0 = mm2[1]; }
      }
    });
    o.mods.forEach(function (mo) {
      if (mo.n >= modSpans.length) throw new Error('IndexError: list index out of range');
      var ms = modSpans[mo.n], M = d.end(find(mo.el, 'cd:linkTarget'), mo.alias)[0], Tt = target(mo.el, sq, fl);
      var nb = bends.has(rid + '|m' + mo.n) ? bends.get(rid + '|m' + mo.n) : mo.bends, same = near(M, mo.M, 1e-6) && near(Tt, mo.T, 1e-6);
      var tx = points(get(mo.el, 'editPoints'), mo.bends, nb, same, function (p) { return toFrame(M, Tt, p); });
      T.attrs(ms[0], [['editPoints', tx || null]]);
      var c2 = T.span('<celldesigner:connectScheme', ms[0], ms[1]);
      if (c2) directions(T, c2, nb.length + 1);
    });
    var joins = [0.375, 0.625].map(function (t2) { return [P[0] + t2 * (Q[0] - P[0]), P[1] + t2 * (Q[1] - P[1])]; });
    o.links.forEach(function (l) {
      var key = rid + '|' + (l.into ? 'r' : 'p') + l.n;
      if (!l.bends.length && !(bends.get(key) || []).length) return;
      var O = d.end(l.el, l.alias)[0], J = joins[l.into ? 0 : 1], nb = bends.has(key) ? bends.get(key) : l.bends;
      var same = near(O, l.O, 1e-6) && near(J, l.J, 1e-6);
      var fr = l.into ? function (p) { return toFrame(O, J, p); } : function (p) { return toFrame(J, O, p); };
      var tx = points(get(l.el, 'editPoints') || findtext(l.el, 'cd:editPoints', ''), l.bends, nb, same, fr);
      var tag = l.into ? 'reactantLink' : 'productLink', ls = null;
      for (var si = 0; si < subs.length && !ls; si++) {
        var a = subs[si][0], b = subs[si][1];
        if (T.span('<celldesigner:' + tag + ' ', a, b)) {
          var i0 = a, c = -1;
          while (true) { var m3 = T.span('<celldesigner:' + tag + ' ', i0, b); if (!m3) break; c++; if (c === l.n) { ls = m3; break; } i0 = m3[1]; }
        }
      }
      if (!ls) return;
      var child = T.span('<celldesigner:editPoints>', ls[0], ls[1]);
      if (child) T.put(child[0], child[1], '<celldesigner:editPoints>' + tx + '</celldesigner:editPoints>');
      else T.attrs(ls[0], [['editPoints', tx || null]]);
      var c3 = T.span('<celldesigner:connectScheme', ls[0], ls[1]);
      if (c3) directions(T, c3, nb.length + 1);
    });
  }
  function place(t, gtext, opt) {
    var d = drawing(t, opt), comps = compartments(d), up = tree(d, comps), rd = read(gtext, opt), boxes = rd[0], bends = rd[2], paths = rd[3];
    var xs = [], ys = [];
    boxes.forEach(function (b) { xs.push(b[0]); ys.push(b[1]); });
    bends.forEach(function (ps) { ps.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    var block = function (m) { return m < 0 ? Math.ceil((MARGIN - m) / 16) * 16.0 : 0.0; };
    var mn = function (a) { return a.reduce(function (p, v) { return v < p ? v : p; }, Infinity); };
    var sh = [xs.length ? block(mn(xs)) : 0.0, ys.length ? block(mn(ys)) : 0.0], shifted = sh[0] !== 0 || sh[1] !== 0;
    if (shifted) {
      var nb = new Map(); boxes.forEach(function (b, i) { nb.set(i, [b[0] + sh[0], b[1] + sh[1], b[2], b[3]]); }); boxes = nb;
      var nbe = new Map(); bends.forEach(function (ps, i) { nbe.set(i, ps.map(function (p) { return [p[0] + sh[0], p[1] + sh[1]]; })); }); bends = nbe;
    }
    var old = new Map();
    d.alias.forEach(function (a, i) { old.set(i, a[1]); });
    comps.forEach(function (v, c) { old.set(c, v[0]); });
    var T = new Text(t), nw = new Map();
    old.forEach(function (b, i) { nw.set(i, boxes.has(i) ? boxes.get(i) : b); });
    old.forEach(function (b, i) {
      var n = nw.get(i);
      if ([0, 1, 2, 3].every(function (j) { return Math.abs(n[j] - b[j]) < 1e-3; })) return;
      var kind = comps.has(i) ? 'compartmentAlias' : d.alias.get(i)[0] === 'COMPLEX' ? 'complexSpeciesAlias' : 'speciesAlias';
      var s = T.span('<celldesigner:' + kind + ' id="' + reEscape(i) + '"');
      if (!s) throw new Error("TypeError: 'NoneType' object is not subscriptable");
      var bt = T.span('<celldesigner:bounds ', s[0], s[1]);
      T.attrs(bt[0], ['x', 'y', 'w', 'h'].map(function (k, j) { return [k, j]; }).filter(function (q) { return Math.abs(n[q[1]] - b[q[1]]) >= 1e-3; }).map(function (q) { return [q[0], num(n[q[1]])]; }));
      var p = up.has(i) ? up.get(i) : null, ip = T.span('<celldesigner:innerPosition ', s[0], s[1]);
      if (ip && p !== null) {
        var v = {}, re = /\s([xy])="([^"]*)"/g, mm, seg = T.t.slice(ip[0], ip[1]);
        while ((mm = re.exec(seg))) v[mm[1]] = F(mm[2]);
        if (!has(v, 'x') || !has(v, 'y')) throw new Error('KeyError: x');
        var pb = old.get(p), pn = nw.get(p);
        if (Math.abs(v.x - (b[0] - pb[0])) < 1e-3 && Math.abs(v.y - (b[1] - pb[1])) < 1e-3)
          T.attrs(ip[0], ['x', 'y'].map(function (k, j) { return [k, j]; }).filter(function (q) { return Math.abs((n[q[1]] - pn[q[1]]) - (b[q[1]] - pb[q[1]])) >= 1e-3; }).map(function (q) { return [q[0], num(n[q[1]] - pn[q[1]])]; }));
      }
      if (comps.has(i)) {
        var npt = T.span('<celldesigner:namePoint ', s[0], s[1]);
        if (npt && (Math.abs(n[0] - b[0]) >= 1e-3 || Math.abs(n[1] - b[1]) >= 1e-3)) {
          var mv = {}, re2 = /\s([xy])="([^"]*)"/g, m2, seg2 = T.t.slice(npt[0], npt[1]);
          while ((m2 = re2.exec(seg2))) mv[m2[1]] = m2[2];
          T.attrs(npt[0], [['x', num(F(mv.x) + n[0] - b[0])], ['y', num(F(mv.y) + n[1] - b[1])]]);
        }
      }
    });
    var far = [-Infinity, -Infinity];
    nw.forEach(function (n) { far[0] = Math.max(far[0], n[0] + n[2]); far[1] = Math.max(far[1], n[1] + n[3]); });
    var md = T.span('<celldesigner:modelDisplay ');
    if (md && (far[0] > d.W || far[1] > d.H))
      T.attrs(md[0], [['sizeX', far[0], d.W], ['sizeY', far[1], d.H]].filter(function (q) { return q[1] > q[2]; }).map(function (q) { return [q[0], String(Math.ceil(q[1] + 40))]; }));
    var rxsAll = findall(d.model, 's:listOfReactions/s:reaction'), olds = {};
    rxsAll.forEach(function (rx) { olds[get(rx, 'id')] = lines(d, rx); });
    d.alias.forEach(function (a, i) { d.alias.set(i, [a[0], nw.get(i), a[2], a[3], a[4]]); });
    rxsAll.forEach(function (rx) {
      var o = olds[get(rx, 'id')];
      if (!o) return;
      o.old = old;
      reaction(d, T, T.span('<reaction [^>]*\\bid="' + reEscape(o.id) + '"'), rx, o, bends, paths, nw);
    });
    if (shifted) {
      var ly = T.span('<celldesigner:listOfLayers>'), seg3 = ly ? T.t.slice(ly[0], ly[1]) : '', re3 = /<celldesigner:bounds /g, m4;
      while ((m4 = re3.exec(seg3))) {
        var tg = T.t.slice(ly[0] + m4.index, T.t.indexOf('>', ly[0] + m4.index)), v2 = {}, re4 = /\s([xy])="([^"]*)"/g, m5;
        while ((m5 = re4.exec(tg))) v2[m5[1]] = m5[2];
        T.attrs(ly[0] + m4.index, [['x', num(F(v2.x) + sh[0])], ['y', num(F(v2.y) + sh[1])]]);
      }
      var re5 = /<celldesigner:(?:GateMember|modification) [^>]*type="BOOLEAN_LOGIC_GATE[^>]*>/g, m6;
      while ((m6 = re5.exec(T.t))) {
        var e = /\seditPoints="([^"]*)"/.exec(m6[0]);
        if (e) {
          var ps = e[1].split(/\s+/).filter(function (q) { return q; }), g = ps[ps.length - 1].split(',').map(F);
          ps[ps.length - 1] = num(g[0] + sh[0]) + ',' + num(g[1] + sh[1]);
          T.attrs(m6.index, [['editPoints', ps.join(' ')]]);
        }
      }
    }
    return [T.done(), sh];
  }
  function draw(t, gtext, opt) {
    var p = place(t, gtext, opt), c = p[0], sh = p[1];
    var svg = cdr.render(c, { classes: true, groups: true, DOMParser: DP(opt) });
    if (sh[0] !== 0 || sh[1] !== 0) {
      svg = svg.replace('<g transform="translate(0,0)">', '<g transform="translate(' + repr(sh[0]) + ',' + repr(sh[1]) + ')"><g transform="translate(' + repr(-sh[0]) + ',' + repr(-sh[1]) + ')">');
      svg = svg.slice(0, svg.lastIndexOf('</svg>')) + '</g>\n</svg>\n';
    }
    return [svg, c, graphml(c, sh, opt)];
  }

  // the editor's live drawing of a move (2026-11-13, user: during a drag the reactions came apart, right only after the
  // drop): the drop's own code for the reactions a move touches, nothing estimated. live(cdText, graphmlText) reads the
  // map once (the drawing on screen); frame(boxes, bends, paths, rids) puts the live places in (maps of the GraphML's
  // node and edge ids, as read() gives them, only what changed), writes each reaction's lines as place() writes them
  // (reaction()), and draws them with cdrender's own reaction(): { rid: { halo, lines, sq, ang, len } } with each
  // reaction's groups as in the editor's drawing (the same text as draw()'s for that reaction, tests/cd-live.js), null
  // for one not drawn. JavaScript only (the editor), it writes no file.
  function live(t, gtext, opt) {
    var d = new cdr.Drawing(t, { classes: true, groups: true, DOMParser: DP(opt) }), comps = compartments(d), rd = read(gtext, opt);
    var old = new Map(), alias0 = new Map(), olds = {}, slices = {}, T0 = new Text(t), last = [], errors = [];
    d.alias.forEach(function (a, i) { old.set(i, a[1]); alias0.set(i, a); });
    comps.forEach(function (v, c) { old.set(c, v[0]); });
    findall(d.model, 's:listOfReactions/s:reaction').forEach(function (rx) { olds[get(rx, 'id')] = lines(d, rx); });
    var open = /<sbml\b[^>]*>/.exec(t)[0];
    var first = function (x) {   // a reaction's text as an element, read in the map's namespaces
      var doc = new (DP(opt))().parseFromString(open + x + '</sbml>', 'application/xml');
      for (var c = doc.documentElement.firstChild; c; c = c.nextSibling) if (c.nodeType === 1) return c;
      return null;
    };
    var slice = function (rid) {
      if (!has(slices, rid)) { var sp = T0.span('<reaction [^>]*\\bid="' + reEscape(rid) + '"'); slices[rid] = sp ? t.slice(sp[0], sp[1]) : null; }
      return slices[rid];
    };
    return {
      errors: errors,   // reactions that failed (drawn the old way by the editor; the test fails on any)
      frame: function (boxes, bends, paths, rids) {
        var nw = new Map(), B = new Map(rd[2]), P = new Map(rd[3]), out = {};
        // the boxes as place() takes them to write the lines (nw), and as it writes them into the file (six decimals),
        // which the drawing after the drop reads (fl)
        var fl = new Map();
        old.forEach(function (b, i) {
          var n = boxes.has(i) ? boxes.get(i) : b; nw.set(i, n);
          fl.set(i, n === b ? b : n.map(function (v, j) { return Math.abs(v - b[j]) < 1e-3 ? b[j] : F(num(v)); }));
        });
        var ids = Array.from(new Set(Array.from(boxes.keys()).concat(last))).filter(function (i) { return alias0.has(i); });
        var put = function (m) { ids.forEach(function (i) { var a0 = alias0.get(i); d.alias.set(i, [a0[0], m.get(i), a0[2], a0[3], a0[4]]); }); };
        last = Array.from(boxes.keys());
        bends.forEach(function (v, k) { B.set(k, v); });
        paths.forEach(function (v, k) { P.set(k, v); });
        rids.forEach(function (rid) {
          var sl = slice(rid);
          if (!olds[rid] || !sl) { out[rid] = null; return; }
          try {
            // the reaction read afresh each frame (ports() writes a moved line end into the elements it reads), as at rest
            put(old);
            var rx0 = first(sl), o = lines(d, rx0), T = new Text(sl);
            o.old = old;
            put(nw);
            reaction(d, T, [0, sl.length], rx0, o, B, P, nw);
            var rx = first(T.done());
            put(fl);
            d.lines = []; d.halo = []; d.cur = rid;
            d.reaction(rx);
            var r = lines(d, rx), q = r && r.glyph ? r : null;
            out[rid] = { halo: d.halo.join('\n'), lines: d.lines.join('\n'), sq: q ? q.sq : null,
              ang: q ? Math.atan2(q.fl[1], q.fl[0]) : 0, len: q ? Math.hypot(q.Q[0] - q.P[0], q.Q[1] - q.P[1]) : 0 };
          } catch (e) { out[rid] = null; errors.push(rid + ': ' + (e && e.message || e)); }
        });
        return out;
      },
      rest: function (rid) {   // where the reaction's glyph is on the drawing read: [sq, angle, length]
        var o = olds[rid];
        return o && o.glyph ? [o.sq, Math.atan2(o.fl[1], o.fl[0]), Math.hypot(o.Q[0] - o.P[0], o.Q[1] - o.P[1])] : null;
      }
    };
  }

  var api = { graphml: graphml, place: place, apply: apply, draw: draw, live: live };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.cd_edit = api;
})(typeof window !== 'undefined' ? window : globalThis);
